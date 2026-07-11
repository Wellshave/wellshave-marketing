/**
 * Wellgroup team-proxy — Cloudflare Worker
 *
 * Stuurt POST /anthropic door naar de Anthropic API met de server-side key,
 * zodat teamleden in de Atelier Console alleen de worker-URL hoeven in te
 * vullen en NIEMAND een API-key in de browser hoeft te plakken.
 *
 * Deploy (5 min, via de Cloudflare-dashboard, geen CLI nodig):
 * 1. dash.cloudflare.com → Workers & Pages → Create → Worker
 *    (naam bv. wellgroup-team-proxy) → Deploy.
 * 2. Edit code → vervang ALLES door dit bestand → Deploy.
 * 3. Worker → Settings → Variables & Secrets → Add → type "Secret",
 *    naam ANTHROPIC_KEY, waarde je sk-ant-… key (console.anthropic.com → API keys).
 * 4. In de Atelier Console (⚙ Instellingen): API-key veld LEEG laten,
 *    team-proxy URL = https://<jouw-worker>.workers.dev → "Test AI-verbinding".
 *
 * Endpoints:
 *   GET  /health     → { ok: true } (snelle check)
 *   POST /anthropic  → doorgestuurd naar https://api.anthropic.com/v1/messages
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      // Desgewenst aanscherpen tot je eigen domein:
      // 'Access-Control-Allow-Origin': 'https://wellshave-adgen.netlify.app',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, anthropic-version',
      'Access-Control-Max-Age': '86400'
    };
    const json = (obj, status) => new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json', ...cors }
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health') return json({ ok: true, service: 'wellgroup-team-proxy' });
    if (url.pathname !== '/anthropic' || request.method !== 'POST') {
      return json({ error: { message: 'Gebruik POST /anthropic (of GET /health).' } }, 404);
    }
    if (!env.ANTHROPIC_KEY) {
      return json({ error: { message: 'ANTHROPIC_KEY-secret ontbreekt in de worker (Settings → Variables & Secrets).' } }, 500);
    }

    const body = await request.text();
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01'
      },
      body
    });

    const headers = new Headers({ 'Content-Type': upstream.headers.get('Content-Type') || 'application/json', ...cors });
    return new Response(await upstream.text(), { status: upstream.status, headers });
  }
};
