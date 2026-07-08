// Framework-agnostic request handler written against the Web Fetch API
// (Request in -> Response out). The same function backs the standalone Node
// server and the Netlify Function, so behaviour is identical everywhere.
//
// This is a THIN, verbatim passthrough to the Anthropic Messages API — it does
// not translate or rewrite the body. Model fallback is handled server-side by
// Anthropic via the `fallbacks` field in the body plus the
// `anthropic-beta: server-side-fallback-*` header, which the proxy forwards
// unchanged. Contract owned by the Atelier Console ad generator app.

import { CONFIG } from './config.js';

const ALLOW_HEADERS = 'Content-Type, anthropic-version, anthropic-beta, x-api-key';

export async function handleRequest(request) {
  const { pathname } = new URL(request.url);

  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

  if (request.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    return cors(json({
      ok: true,
      service: CONFIG.serviceName,
      anthropic_key_configured: Boolean(CONFIG.anthropicApiKey),
    }));
  }

  if (request.method === 'POST' && pathname === '/anthropic') {
    return cors(await proxyAnthropic(request));
  }

  return cors(json({ ok: false, error: `No route for ${request.method} ${pathname}` }, 404));
}

async function proxyAnthropic(request) {
  if (!CONFIG.anthropicApiKey) {
    return json({ type: 'error', error: { type: 'api_error', message: 'Proxy misconfigured: ANTHROPIC_API_KEY is not set' } }, 500);
  }

  // Read the body as raw text and forward it byte-for-byte — no parsing, no
  // rewriting. Whatever the app sends (output_config, fallbacks, system,
  // messages, ...) reaches Anthropic exactly as-is.
  const bodyText = await request.text();

  const headers = {
    'content-type': 'application/json',
    'x-api-key': CONFIG.anthropicApiKey,
    // Pass the client's version/beta through unchanged; fall back to defaults
    // only if the caller omitted them (so `fallbacks` still works on raw curls).
    'anthropic-version': request.headers.get('anthropic-version') || CONFIG.defaultAnthropicVersion,
  };
  const beta = request.headers.get('anthropic-beta') || CONFIG.defaultAnthropicBeta;
  if (beta) headers['anthropic-beta'] = beta;

  let upstream;
  try {
    upstream = await fetch(CONFIG.anthropicBaseUrl + '/v1/messages', {
      method: 'POST',
      headers,
      body: bodyText,
    });
  } catch (e) {
    return json({ type: 'error', error: { type: 'api_error', message: 'Upstream request failed: ' + e.message } }, 502);
  }

  // Relay the Anthropic response unchanged: same status, same body, same
  // content-type. Error bodies and refusals pass straight through to the app.
  const out = new Response(upstream.body, { status: upstream.status });
  const ct = upstream.headers.get('content-type');
  if (ct) out.headers.set('content-type', ct);
  return out;
}

// --- helpers ----------------------------------------------------------------

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function cors(res) {
  res.headers.set('access-control-allow-origin', CONFIG.corsOrigin);
  res.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.headers.set('access-control-allow-headers', ALLOW_HEADERS);
  res.headers.set('access-control-max-age', '86400');
  return res;
}
