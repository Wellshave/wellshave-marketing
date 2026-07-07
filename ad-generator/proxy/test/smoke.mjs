// Offline unit tests for the translation + fallback logic. No network.
// Run with: npm test   (or: node test/smoke.mjs)

import assert from 'node:assert/strict';
import {
  openaiToAnthropic,
  anthropicToOpenAI,
  openaiStreamFromAnthropic,
  mapStopReason,
} from '../src/translate.js';
import { isModelUnavailable } from '../src/anthropic.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

console.log('openaiToAnthropic');

test('extracts system messages into top-level system', () => {
  const a = openaiToAnthropic({
    messages: [
      { role: 'system', content: 'You are a Wellshave ad writer.' },
      { role: 'user', content: 'Write a headline.' },
    ],
  });
  assert.equal(a.system, 'You are a Wellshave ad writer.');
  assert.equal(a.messages.length, 1);
  assert.equal(a.messages[0].role, 'user');
  assert.equal(a.messages[0].content, 'Write a headline.');
});

test('defaults max_tokens and honours explicit value', () => {
  assert.equal(openaiToAnthropic({ messages: [] }, { defaultMaxTokens: 4096 }).max_tokens, 4096);
  assert.equal(openaiToAnthropic({ messages: [], max_tokens: 128 }).max_tokens, 128);
  assert.equal(openaiToAnthropic({ messages: [], max_completion_tokens: 77 }).max_tokens, 77);
});

test('maps temperature, top_p and stop', () => {
  const a = openaiToAnthropic({ messages: [], temperature: 0.4, top_p: 0.9, stop: ['\n\n', 'END'] });
  assert.equal(a.temperature, 0.4);
  assert.equal(a.top_p, 0.9);
  assert.deepEqual(a.stop_sequences, ['\n\n', 'END']);
  const b = openaiToAnthropic({ messages: [], stop: 'STOP' });
  assert.deepEqual(b.stop_sequences, ['STOP']);
});

test('json response_format adds a JSON instruction to system', () => {
  const a = openaiToAnthropic({ messages: [{ role: 'user', content: 'hi' }], response_format: { type: 'json_object' } });
  assert.match(a.system, /valid JSON/i);
});

test('handles multimodal image_url content (url and data uri)', () => {
  const a = openaiToAnthropic({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'What product is this?' },
        { type: 'image_url', image_url: { url: 'https://cdn.example/x.jpg' } },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
      ],
    }],
  });
  const blocks = a.messages[0].content;
  assert.equal(blocks[0].type, 'text');
  assert.deepEqual(blocks[1], { type: 'image', source: { type: 'url', url: 'https://cdn.example/x.jpg' } });
  assert.deepEqual(blocks[2], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } });
});

test('maps tools and tool_choice', () => {
  const a = openaiToAnthropic({
    messages: [{ role: 'user', content: 'go' }],
    tools: [{ type: 'function', function: { name: 'make_ad', description: 'd', parameters: { type: 'object', properties: { x: { type: 'string' } } } } }],
    tool_choice: 'required',
  });
  assert.equal(a.tools[0].name, 'make_ad');
  assert.deepEqual(a.tools[0].input_schema, { type: 'object', properties: { x: { type: 'string' } } });
  assert.deepEqual(a.tool_choice, { type: 'any' });
});

test('round-trips an assistant tool_call and a tool result', () => {
  const a = openaiToAnthropic({
    messages: [
      { role: 'user', content: 'go' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'make_ad', arguments: '{"n":2}' } }] },
      { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
    ],
  });
  const asst = a.messages[1];
  assert.equal(asst.role, 'assistant');
  assert.deepEqual(asst.content[0], { type: 'tool_use', id: 'call_1', name: 'make_ad', input: { n: 2 } });
  const toolMsg = a.messages[2];
  assert.equal(toolMsg.content[0].type, 'tool_result');
  assert.equal(toolMsg.content[0].tool_use_id, 'call_1');
});

console.log('anthropicToOpenAI');

test('maps a text message with usage and stop_reason', () => {
  const o = anthropicToOpenAI({
    id: 'msg_abc', content: [{ type: 'text', text: 'Sharper shave, less irritation.' }],
    stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 6 },
  }, { model: 'claude-fable-5', created: 1700000000 });
  assert.equal(o.object, 'chat.completion');
  assert.equal(o.model, 'claude-fable-5');
  assert.equal(o.choices[0].message.content, 'Sharper shave, less irritation.');
  assert.equal(o.choices[0].finish_reason, 'stop');
  assert.deepEqual(o.usage, { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 });
  assert.ok(o.id.startsWith('chatcmpl-'));
});

test('maps tool_use blocks into tool_calls with length finish', () => {
  const o = anthropicToOpenAI({
    id: 'msg_x', content: [{ type: 'tool_use', id: 'toolu_1', name: 'make_ad', input: { n: 3 } }],
    stop_reason: 'tool_use',
  }, { model: 'claude-fable-5', created: 1 });
  const tc = o.choices[0].message.tool_calls[0];
  assert.equal(tc.function.name, 'make_ad');
  assert.equal(tc.function.arguments, '{"n":3}');
  assert.equal(o.choices[0].message.content, null);
  assert.equal(o.choices[0].finish_reason, 'tool_calls');
});

test('mapStopReason', () => {
  assert.equal(mapStopReason('max_tokens'), 'length');
  assert.equal(mapStopReason('end_turn'), 'stop');
  assert.equal(mapStopReason('tool_use'), 'tool_calls');
  assert.equal(mapStopReason('stop_sequence'), 'stop');
});

console.log('isModelUnavailable (fallback trigger)');

test('triggers on 404/403/529 and model-ish 400, not on generic 400/422/429', () => {
  assert.equal(isModelUnavailable(404, { error: {} }), true);
  assert.equal(isModelUnavailable(403, {}), true);
  assert.equal(isModelUnavailable(529, {}), true);
  assert.equal(isModelUnavailable(400, { error: { type: 'not_found_error', message: 'model: claude-fable-5 not found' } }), true);
  assert.equal(isModelUnavailable(400, { error: { type: 'invalid_request_error', message: 'model claude-fable-5 does not exist or you do not have access' } }), true);
  assert.equal(isModelUnavailable(400, { error: { type: 'invalid_request_error', message: 'messages: at least one message is required' } }), false);
  assert.equal(isModelUnavailable(422, { error: {} }), false);
  assert.equal(isModelUnavailable(429, { error: { message: 'rate limit' } }), false);
});

console.log('openaiStreamFromAnthropic');

await test_async('translates an Anthropic SSE text stream into OpenAI chunks', async () => {
  const events = [
    { type: 'message_start', message: { id: 'msg_1' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Sharper ' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'shave.' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
    { type: 'message_stop' },
  ];
  const anthropicBody = sseStream(events);
  const out = openaiStreamFromAnthropic(anthropicBody, { model: 'claude-fable-5', created: 1, id: 'chatcmpl-test' });
  const text = await drain(out);

  const chunks = parseOpenAiSse(text);
  const contents = chunks.flatMap((c) => (c.choices?.[0]?.delta?.content ? [c.choices[0].delta.content] : []));
  assert.equal(contents.join(''), 'Sharper shave.');
  assert.equal(chunks.some((c) => c.choices?.[0]?.delta?.role === 'assistant'), true);
  assert.equal(chunks.some((c) => c.choices?.[0]?.finish_reason === 'stop'), true);
  assert.match(text, /data: \[DONE\]/);
});

await test_async('translates a streamed tool_use into tool_call argument deltas', async () => {
  const events = [
    { type: 'message_start', message: { id: 'msg_2' } },
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_9', name: 'make_ad' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"n":' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '3}' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
    { type: 'message_stop' },
  ];
  const out = openaiStreamFromAnthropic(sseStream(events), { model: 'm', created: 1, id: 'chatcmpl-t2' });
  const chunks = parseOpenAiSse(await drain(out));
  const args = chunks.flatMap((c) => {
    const tc = c.choices?.[0]?.delta?.tool_calls?.[0];
    return tc?.function?.arguments ? [tc.function.arguments] : [];
  });
  assert.equal(args.join(''), '{"n":3}');
  const named = chunks.find((c) => c.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name);
  assert.equal(named.choices[0].delta.tool_calls[0].function.name, 'make_ad');
  assert.equal(chunks.some((c) => c.choices?.[0]?.finish_reason === 'tool_calls'), true);
});

// --- async test helpers -----------------------------------------------------

async function test_async(name, fn) {
  try { await fn(); passed += 1; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}

function sseStream(events) {
  const encoder = new TextEncoder();
  // Emit each event as its own SSE frame, some split oddly to exercise buffering.
  const raw = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = encoder.encode(raw);
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= bytes.length) { controller.close(); return; }
      const end = Math.min(i + 7, bytes.length); // tiny chunks -> frames span reads
      controller.enqueue(bytes.slice(i, end));
      i = end;
    },
  });
}

async function drain(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function parseOpenAiSse(text) {
  return text
    .split('\n\n')
    .map((b) => b.split('\n').find((l) => l.startsWith('data:')))
    .filter(Boolean)
    .map((l) => l.slice(5).trim())
    .filter((s) => s && s !== '[DONE]')
    .map((s) => JSON.parse(s));
}

console.log(`\n${passed} checks passed`);
