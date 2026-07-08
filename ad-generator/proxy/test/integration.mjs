// End-to-end test of the /anthropic passthrough against a mock upstream that
// echoes what it received. Verifies verbatim body forwarding, header injection,
// response relay, CORS, header defaults, and error passthrough. No real network.
//
// Run with: node test/integration.mjs

import http from 'node:http';
import assert from 'node:assert/strict';

let passed = 0;
const ok = (name) => { passed += 1; console.log('  ✓ ' + name); };

// --- mock Anthropic upstream: capture + echo --------------------------------
let received = null;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    received = { url: req.url, method: req.method, headers: req.headers, body };
    const j = JSON.parse(body || '{}');
    if (j.__mockStatus) {
      res.writeHead(j.__mockStatus, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_1', type: 'message', role: 'assistant', model: j.model,
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"headline":"Sharper shave, less irritation"}' }],
      usage: { input_tokens: 5, output_tokens: 3 },
    }));
  });
});
await new Promise((r) => mock.listen(0, r));
const port = mock.address().port;

// --- configure env, then import the handler ---------------------------------
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.ANTHROPIC_BASE_URL = `http://localhost:${port}`;
const { handleRequest } = await import('../src/handler.js');

const APP_HEADERS = {
  'content-type': 'application/json',
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'server-side-fallback-2026-06-01',
};

// The exact body the Atelier Console app sends (native Anthropic + new fields).
const appBody = {
  model: 'claude-fable-5',
  max_tokens: 4000,
  output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object', properties: { headline: { type: 'string' } } } } },
  fallbacks: [{ model: 'claude-opus-4-8' }],
  system: 'You are the Wellshave ad writer.',
  messages: [{ role: 'user', content: 'Write one headline.' }],
};

// --- happy path: verbatim forward + relay -----------------------------------
{
  const rawBody = JSON.stringify(appBody);
  const res = await handleRequest(new Request('http://localhost/anthropic', { method: 'POST', headers: APP_HEADERS, body: rawBody }));

  // Upstream saw an exact, unmodified copy at /v1/messages.
  assert.equal(received.url, '/v1/messages');
  assert.equal(received.body, rawBody, 'body must be forwarded byte-for-byte');
  assert.deepEqual(JSON.parse(received.body), appBody, 'output_config + fallbacks survive intact');

  // Proxy injected the key and forwarded version/beta unchanged.
  assert.equal(received.headers['x-api-key'], 'test-key');
  assert.equal(received.headers['anthropic-version'], '2023-06-01');
  assert.equal(received.headers['anthropic-beta'], 'server-side-fallback-2026-06-01');
  ok('POST /anthropic forwards body verbatim + injects x-api-key + passes version/beta');

  // Response relayed unchanged and readable exactly as the app expects.
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const j = await res.json();
  assert.equal(j.stop_reason, 'end_turn');
  assert.equal(j.content[0].type, 'text');
  assert.deepEqual(JSON.parse(j.content[0].text), { headline: 'Sharper shave, less irritation' });
  assert.deepEqual(j.usage, { input_tokens: 5, output_tokens: 3 });
  ok('Anthropic response is relayed unchanged (content/text, stop_reason, usage) with CORS');
}

// --- header defaults when the caller omits them -----------------------------
{
  received = null;
  await handleRequest(new Request('http://localhost/anthropic', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-fable-5', messages: [] }),
  }));
  assert.equal(received.headers['anthropic-version'], '2023-06-01');
  assert.equal(received.headers['anthropic-beta'], 'server-side-fallback-2026-06-01');
  ok('missing version/beta headers are filled with the documented defaults');
}

// --- error passthrough preserves status + body ------------------------------
{
  const res = await handleRequest(new Request('http://localhost/anthropic', {
    method: 'POST', headers: APP_HEADERS, body: JSON.stringify({ __mockStatus: 400, model: 'claude-fable-5' }),
  }));
  assert.equal(res.status, 400, 'upstream status is preserved');
  const j = await res.json();
  assert.equal(j.type, 'error');
  assert.equal(j.error.type, 'invalid_request_error');
  ok('upstream errors pass through unchanged with their status code');
}

console.log(`\n${passed} integration checks passed`);
mock.close();
