// Translation between the OpenAI Chat Completions shape (what the ad generator
// currently speaks) and the Anthropic Messages shape (what Fable 5 speaks).
//
// Covers the parts an ad generator actually uses: system prompts, multi-turn
// text, image inputs, temperature/top_p/max_tokens/stop, JSON response hints,
// streaming, and function/tool calls.

import { randomUUID } from 'node:crypto';

export function rid() {
  return randomUUID().replace(/-/g, '');
}

// ---------------------------------------------------------------------------
// OpenAI request  ->  Anthropic request
// ---------------------------------------------------------------------------

export function openaiToAnthropic(body, { defaultMaxTokens = 4096 } = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const systemParts = [];
  const anthMessages = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const role = msg.role;

    if (role === 'system' || role === 'developer') {
      const t = extractText(msg.content);
      if (t) systemParts.push(t);
      continue;
    }

    if (role === 'tool') {
      // An OpenAI tool result becomes an Anthropic tool_result block carried by a user turn.
      anthMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : extractText(msg.content),
        }],
      });
      continue;
    }

    if (role === 'assistant') {
      const blocks = [];
      const text = extractText(msg.content);
      if (text) blocks.push({ type: 'text', text });
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          if (tc && tc.type === 'function' && tc.function) {
            let input = {};
            try { input = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; }
            catch { input = {}; }
            blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
          }
        }
      }
      anthMessages.push({ role: 'assistant', content: blocks.length ? blocks : '' });
      continue;
    }

    // Default: user message (may be multimodal).
    anthMessages.push({ role: 'user', content: toAnthropicContent(msg.content) });
  }

  const req = {
    // `model` is injected by the Anthropic caller (primary/fallback), not here.
    messages: anthMessages,
    max_tokens: firstNumber(body.max_completion_tokens, body.max_tokens, defaultMaxTokens),
  };

  let system = systemParts.join('\n\n');

  // Anthropic has no `response_format`; nudge JSON via the system prompt instead.
  const rf = body.response_format;
  if (rf && typeof rf.type === 'string' && rf.type.startsWith('json')) {
    system = (system ? system + '\n\n' : '') +
      'Respond with a single valid JSON value only. No prose, no explanations, no markdown code fences.';
  }
  if (system) req.system = system;

  if (typeof body.temperature === 'number') req.temperature = body.temperature;
  if (typeof body.top_p === 'number') req.top_p = body.top_p;
  if (body.stop != null) req.stop_sequences = Array.isArray(body.stop) ? body.stop : [body.stop];
  if (body.stream) req.stream = true;

  if (Array.isArray(body.tools) && body.tools.length) {
    const tools = body.tools
      .filter((t) => t && t.type === 'function' && t.function)
      .map((t) => ({
        name: t.function.name,
        description: t.function.description || '',
        input_schema: t.function.parameters || { type: 'object', properties: {} },
      }));
    if (tools.length) {
      req.tools = tools;
      const choice = mapToolChoice(body.tool_choice);
      if (choice) req.tool_choice = choice;
    }
  }

  return req;
}

function mapToolChoice(tc) {
  if (tc == null) return undefined;
  if (tc === 'auto') return { type: 'auto' };
  if (tc === 'required') return { type: 'any' };
  if (tc === 'none') return { type: 'none' };
  if (typeof tc === 'object' && tc.type === 'function' && tc.function && tc.function.name) {
    return { type: 'tool', name: tc.function.name };
  }
  return undefined;
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : p && p.type === 'text' ? p.text || '' : ''))
      .join('');
  }
  return '';
}

function toAnthropicContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const blocks = [];
  for (const part of content) {
    if (typeof part === 'string') { blocks.push({ type: 'text', text: part }); continue; }
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text') {
      blocks.push({ type: 'text', text: part.text || '' });
    } else if (part.type === 'image_url' && part.image_url) {
      const url = typeof part.image_url === 'string' ? part.image_url : part.image_url.url;
      if (url) blocks.push(imageBlock(url));
    }
  }
  return blocks.length ? blocks : '';
}

function imageBlock(url) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (m) return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  return { type: 'image', source: { type: 'url', url } };
}

function firstNumber(...vals) {
  for (const v of vals) if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return undefined;
}

// ---------------------------------------------------------------------------
// Anthropic response  ->  OpenAI response (non-streaming)
// ---------------------------------------------------------------------------

export function anthropicToOpenAI(msg, { model, created }) {
  const textParts = [];
  const toolCalls = [];
  for (const block of msg.content || []) {
    if (block.type === 'text') textParts.push(block.text);
    else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }

  const message = { role: 'assistant', content: textParts.join('') };
  if (toolCalls.length) {
    message.tool_calls = toolCalls;
    if (!message.content) message.content = null;
  }

  const out = {
    id: 'chatcmpl-' + (msg.id ? msg.id.replace(/^msg_/, '') : rid()),
    object: 'chat.completion',
    created,
    model,
    choices: [{
      index: 0,
      message,
      finish_reason: mapStopReason(msg.stop_reason, toolCalls.length > 0),
    }],
  };

  if (msg.usage) {
    const inTok = msg.usage.input_tokens ?? 0;
    const outTok = msg.usage.output_tokens ?? 0;
    out.usage = { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok };
  }
  return out;
}

export function mapStopReason(stopReason, hasTools) {
  switch (stopReason) {
    case 'max_tokens': return 'length';
    case 'tool_use': return 'tool_calls';
    case 'stop_sequence': return 'stop';
    case 'end_turn': return hasTools ? 'tool_calls' : 'stop';
    default: return hasTools ? 'tool_calls' : 'stop';
  }
}

// ---------------------------------------------------------------------------
// Anthropic SSE stream  ->  OpenAI SSE stream
// ---------------------------------------------------------------------------

export function openaiStreamFromAnthropic(anthropicBody, { model, created, id }) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = anthropicBody.getReader();

  // Persist across pull() calls.
  let buffer = '';
  let sentRole = false;
  let toolIndex = -1;
  let finishReason = 'stop';
  let finished = false;
  const blocks = {}; // anthropic block index -> { kind, oi }

  function frameBytes(delta, finish_reason = null) {
    return encoder.encode(
      'data: ' + JSON.stringify({
        id, object: 'chat.completion.chunk', created, model,
        choices: [{ index: 0, delta, finish_reason }],
      }) + '\n\n'
    );
  }

  return new ReadableStream({
    // Loop reading upstream until we have actually enqueued at least one chunk
    // (or the stream ends). A pull() that enqueues nothing is not re-invoked by
    // the runtime, so we must guarantee forward progress on every call.
    async pull(controller) {
      let produced = false;
      const emit = (bytes) => { controller.enqueue(bytes); produced = true; };

      const ensureRole = () => {
        if (!sentRole) { emit(frameBytes({ role: 'assistant', content: '' })); sentRole = true; }
      };
      const finish = () => {
        if (finished) return;
        finished = true;
        ensureRole();
        emit(frameBytes({}, finishReason));
        emit(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };
      const handle = (evt) => {
        switch (evt.type) {
          case 'message_start':
            ensureRole();
            break;
          case 'content_block_start': {
            const block = evt.content_block || {};
            if (block.type === 'tool_use') {
              toolIndex += 1;
              blocks[evt.index] = { kind: 'tool', oi: toolIndex };
              emit(frameBytes({ tool_calls: [{ index: toolIndex, id: block.id, type: 'function', function: { name: block.name || '', arguments: '' } }] }));
            } else {
              blocks[evt.index] = { kind: 'text' };
              ensureRole();
            }
            break;
          }
          case 'content_block_delta': {
            const d = evt.delta || {};
            const meta = blocks[evt.index];
            if (d.type === 'text_delta') { ensureRole(); emit(frameBytes({ content: d.text || '' })); }
            else if (d.type === 'input_json_delta' && meta && meta.kind === 'tool') {
              emit(frameBytes({ tool_calls: [{ index: meta.oi, function: { arguments: d.partial_json || '' } }] }));
            }
            break;
          }
          case 'message_delta':
            if (evt.delta && evt.delta.stop_reason) finishReason = mapStopReason(evt.delta.stop_reason, toolIndex >= 0);
            break;
          case 'error':
            finish(); // upstream error mid-stream: close out cleanly
            break;
          default:
            break;
        }
      };

      while (!finished && !produced) {
        const { done, value } = await reader.read();
        if (done) { finish(); return; }
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const jsonStr = dataLine.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          let evt;
          try { evt = JSON.parse(jsonStr); } catch { continue; }
          handle(evt);
          if (finished) return;
        }
      }
    },
    cancel(reason) { reader.cancel(reason); },
  });
}
