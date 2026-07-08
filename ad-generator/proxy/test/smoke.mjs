// Offline tests for routing, CORS and health. No network, no key needed.
// Run with: node test/smoke.mjs

import assert from 'node:assert/strict';
import { handleRequest } from '../src/handler.js';

let passed = 0;
const ok = (name) => { passed += 1; console.log('  ✓ ' + name); };

const req = (path, { method = 'GET', headers = {} } = {}) =>
  handleRequest(new Request('http://localhost' + path, { method, headers }));

// CORS preflight
{
  const res = await req('/anthropic', { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const allow = res.headers.get('access-control-allow-headers').toLowerCase();
  for (const h of ['content-type', 'anthropic-version', 'anthropic-beta']) {
    assert.ok(allow.includes(h), `allow-headers must include ${h}`);
  }
  ok('OPTIONS preflight returns 204 with the required CORS allow-headers');
}

// health + root
{
  const res = await req('/health');
  const j = await res.json();
  assert.equal(res.status, 200);
  assert.equal(j.ok, true);
  assert.equal(j.service, 'fable5-proxy');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  ok('GET /health returns { ok: true, service }');

  const root = await (await req('/')).json();
  assert.equal(root.ok, true);
  ok('GET / returns { ok: true }');
}

// unknown route
{
  const res = await req('/nope', { method: 'GET' });
  assert.equal(res.status, 404);
  const j = await res.json();
  assert.equal(j.ok, false);
  ok('unknown route returns 404 { ok: false }');
}

console.log(`\n${passed} smoke checks passed`);
