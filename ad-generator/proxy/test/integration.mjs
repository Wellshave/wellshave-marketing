// End-to-end test: real HTTP requests through the handler against a mock
// Anthropic upstream. Exercises the Fable 5 -> Opus 4.8 fallback, the OpenAI
// and native routes, streaming, and auth. No external network.
//
// Run with: node test/integration.mjs

import http from 'node:http';
import assert from 'node:assert/strict';

let passed = 0;
const ok = (name) => { passed += 1; console.log('  ✓ ' + name); };

// --- mock Anthropic upstream ------------------------------------------------
const calls = [];
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const j = JSON.parse(body || '{}');
    calls.push({ model: j.model, stream: !!j.stream, auth: req.headers['x-api-key'] });

    // Simulate Fable 5 being unavailable so the fallback path is exercised.
    if (j.model === 'claude-fable-5') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-fable-5 not found' } }));
      return;
    }

    if (j.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const evts = [
        { type: 'message_start', message: { id: 'msg_m' } },
        { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello ' } },
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'world' } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' },
      ];
      for (const e of evts) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      res.end();
      return;
    }

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_m', type: 'message', role: 'assistant',
      content: [{ type: 'text', text: 'Hello world' }],
      model: j.model, stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 2 },
    }));
  });
});

await new Promise((r) => mock.listen(0, r));
const mockPort = mock.address().port;

// --- configure env, then import the handler ---------------------------------
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.ANTHROPIC_BASE_URL = `http://localhost:${mockPort}`;
process.env.PRIMARY_MODEL = 'claude-fable-5';
process.env.FALLBACK_MODEL = 'claude-opus-4-8';
process.env.PROXY_API_KEY = 'secret123';

const { handleRequest } = await import('../src/handler.js');

const req = (path, { method = 'POST', body, headers = {} } = {}) =>
  handleRequest(new Request('http://localhost' + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));

const AUTH = { authorization: 'Bearer secret123' };

// --- health + models are open (no auth) -------------------------------------
{
  const res = await req('/health', { method: 'GET' });
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.equal(j.primary_model, 'claude-fable-5');
  assert.equal(j.anthropic_key_configured, true);
  ok('GET /health is open and reports config');
}

// --- auth is enforced on the API routes -------------------------------------
{
  const res = await req('/v1/chat/completions', { body: { messages: [{ role: 'user', content: 'hi' }] } });
  assert.equal(res.status, 401);
  ok('POST without proxy key is rejected 401');
}

// --- non-streaming chat.completions falls back to Opus ----------------------
{
  calls.length = 0;
  const res = await req('/v1/chat/completions', {
    headers: AUTH,
    body: { model: 'gpt-4o', messages: [{ role: 'system', content: 'Be terse.' }, { role: 'user', content: 'hi' }] },
  });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.object, 'chat.completion');
  assert.equal(j.choices[0].message.content, 'Hello world');
  assert.equal(j.choices[0].finish_reason, 'stop');
  assert.equal(j.model, 'claude-opus-4-8', 'should report the model that actually answered');
  assert.equal(res.headers.get('x-proxy-model'), 'claude-opus-4-8');
  assert.deepEqual(calls.map((c) => c.model), ['claude-fable-5', 'claude-opus-4-8'], 'tries Fable 5 first, then Opus');
  assert.equal(calls[0].auth, 'test-key', 'forwards the server-side Anthropic key upstream');
  ok('non-stream chat.completions: Fable5->Opus fallback, OpenAI shape, usage');
  assert.deepEqual(j.usage, { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 });
  ok('usage is translated');
}

// --- streaming chat.completions ---------------------------------------------
{
  const res = await req('/v1/chat/completions', {
    headers: AUTH,
    body: { messages: [{ role: 'user', content: 'hi' }], stream: true },
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /event-stream/);
  const text = await res.text();
  const chunks = text.split('\n\n')
    .map((b) => b.split('\n').find((l) => l.startsWith('data:')))
    .filter(Boolean).map((l) => l.slice(5).trim())
    .filter((s) => s && s !== '[DONE]').map((s) => JSON.parse(s));
  const content = chunks.flatMap((c) => (c.choices?.[0]?.delta?.content ? [c.choices[0].delta.content] : [])).join('');
  assert.equal(content, 'Hello world');
  assert.ok(chunks.some((c) => c.choices?.[0]?.finish_reason === 'stop'));
  assert.match(text, /data: \[DONE\]/);
  ok('streaming chat.completions produces OpenAI SSE ending in [DONE]');
}

// --- native /v1/messages passthrough still forces the model + fallback ------
{
  calls.length = 0;
  const res = await req('/v1/messages', {
    headers: AUTH,
    body: { model: 'claude-fable-5', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] },
  });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.type, 'message');
  assert.equal(j.content[0].text, 'Hello world');
  assert.equal(res.headers.get('x-proxy-model'), 'claude-opus-4-8');
  assert.deepEqual(calls.map((c) => c.model), ['claude-fable-5', 'claude-opus-4-8']);
  ok('native /v1/messages passthrough keeps Anthropic shape + fallback');
}

console.log(`\n${passed} integration checks passed`);
mock.close();
