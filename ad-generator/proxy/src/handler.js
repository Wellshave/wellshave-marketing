// Framework-agnostic request handler written against the Web Fetch API
// (Request in -> Response out). The same function backs the standalone Node
// server and the Netlify Function, so behaviour is identical everywhere.

import { CONFIG } from './config.js';
import { callAnthropic } from './anthropic.js';
import {
  openaiToAnthropic,
  anthropicToOpenAI,
  openaiStreamFromAnthropic,
  rid,
} from './translate.js';

export async function handleRequest(request) {
  const { pathname } = new URL(request.url);

  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));

  if (request.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    return withCors(json({
      status: 'ok',
      service: 'fable5-proxy',
      primary_model: CONFIG.primaryModel,
      fallback_model: CONFIG.fallbackModel,
      anthropic_key_configured: Boolean(CONFIG.anthropicApiKey),
    }));
  }

  if (request.method === 'GET' && pathname === '/v1/models') {
    const data = [CONFIG.primaryModel, CONFIG.fallbackModel]
      .filter(Boolean)
      .map((id) => ({ id, object: 'model', owned_by: 'anthropic' }));
    return withCors(json({ object: 'list', data }));
  }

  const authError = checkAuth(request);
  if (authError) return withCors(authError);

  if (request.method === 'POST' && pathname === '/v1/chat/completions') {
    return withCors(await handleChatCompletions(request));
  }
  if (request.method === 'POST' && pathname === '/v1/messages') {
    return withCors(await handleNativeMessages(request));
  }

  return withCors(json(openaiError({ status: 404, message: `No route for ${request.method} ${pathname}`, type: 'invalid_request_error' }), 404));
}

// --- OpenAI-compatible endpoint --------------------------------------------

async function handleChatCompletions(request) {
  let body;
  try { body = await request.json(); }
  catch { return json(openaiError({ message: 'Request body is not valid JSON', type: 'invalid_request_error' }), 400); }

  const wantStream = Boolean(body.stream);
  const anthropicReq = openaiToAnthropic(body, { defaultMaxTokens: CONFIG.defaultMaxTokens });

  const overrideModel = typeof body.model === 'string' && body.model.startsWith('claude') ? body.model : null;
  const { res, model, error } = await callAnthropic(anthropicReq, { stream: wantStream, overrideModel });
  if (error || !res) return json(openaiError({ status: error?.status, message: upstreamMessage(error), type: 'upstream_error' }), error?.status || 502);

  const created = nowSeconds();
  if (wantStream) {
    const stream = openaiStreamFromAnthropic(res.body, { model, created, id: 'chatcmpl-' + rid() });
    return new Response(stream, { status: 200, headers: streamHeaders(model) });
  }

  const msg = await res.json();
  return json(anthropicToOpenAI(msg, { model, created }), 200, { 'x-proxy-model': model });
}

// --- Anthropic-native passthrough ------------------------------------------
// Keeps the native Messages shape but still forces the model + fallback + auth,
// so the existing "Ad generator Claude" key path can also route through Fable 5.

async function handleNativeMessages(request) {
  let body;
  try { body = await request.json(); }
  catch { return json(anthropicErrorBody('Request body is not valid JSON'), 400); }

  const wantStream = Boolean(body.stream);
  const { model: clientModel, stream: _s, ...rest } = body;
  const overrideModel = typeof clientModel === 'string' && clientModel.startsWith('claude') ? clientModel : null;

  const { res, model, error } = await callAnthropic(rest, { stream: wantStream, overrideModel });
  if (error || !res) return json(anthropicErrorBody(upstreamMessage(error)), error?.status || 502);

  if (wantStream) {
    return new Response(res.body, { status: 200, headers: { ...streamHeaders(model), 'content-type': 'text/event-stream' } });
  }
  const data = await res.json();
  return json(data, 200, { 'x-proxy-model': model });
}

// --- helpers ----------------------------------------------------------------

function checkAuth(request) {
  if (!CONFIG.proxyApiKey) return null;
  const auth = request.headers.get('authorization') || '';
  const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, '').trim() : '';
  const xkey = request.headers.get('x-api-key') || '';
  if (bearer === CONFIG.proxyApiKey || xkey === CONFIG.proxyApiKey) return null;
  return json(openaiError({ message: 'Invalid or missing proxy API key', type: 'authentication_error' }), 401);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function streamHeaders(model) {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-proxy-model': model,
  };
}

function withCors(res) {
  res.headers.set('access-control-allow-origin', CONFIG.corsOrigin);
  res.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.headers.set('access-control-allow-headers', 'authorization, x-api-key, content-type, anthropic-version');
  return res;
}

function openaiError({ message, type = 'upstream_error', status }) {
  return { error: { message: message || 'Unexpected proxy error', type, code: status || null } };
}

function anthropicErrorBody(message) {
  return { type: 'error', error: { type: 'api_error', message: message || 'Unexpected proxy error' } };
}

function upstreamMessage(error) {
  if (!error) return 'Unknown upstream error';
  if (error.errJson && error.errJson.error && error.errJson.error.message) {
    return `Upstream ${error.status} on ${error.model}: ${error.errJson.error.message}`;
  }
  return `Upstream ${error.status || ''} on ${error.model || 'anthropic'}: ${String(error.text || '').slice(0, 300)}`.trim();
}
