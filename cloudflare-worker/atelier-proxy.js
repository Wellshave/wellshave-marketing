/* ============================================================
 * Atelier-proxy — EIGEN Cloudflare Worker voor de Atelier Console
 * (Wellgroup ad-generator). Volledig LOS van wellgroup-team-proxy:
 * bol-OS, notify, nightly e.d. kunnen hierdoor nooit geraakt worden.
 *
 * Deploy (5 min, dashboard):
 * 1. dash.cloudflare.com → Workers & Pages → Create → Worker,
 *    naam bv. "atelier-proxy" → Deploy.
 * 2. Edit code → alles vervangen door dit bestand → Deploy.
 * 3. Settings → Variables & Secrets → Add → type Secret (allebei):
 *    ANTHROPIC_KEY = een sk-ant-… key (console.anthropic.com → API keys)
 *    OPENAI_KEY    = een sk-… key    (platform.openai.com → API keys)
 *    (bestaande secrets van andere workers zijn niet uitleesbaar — maak
 *    gerust nieuwe keys aan.)
 * 4. In de Atelier Console (⚙): API-key veld LEEG, team-proxy URL =
 *    https://atelier-proxy.<jouw-subdomein>.workers.dev → Test → Opslaan.
 *
 * Endpoints:
 *   GET   /health            -> health (open)
 *   POST  /anthropic         -> Claude (copy/concepten)   (login vereist)
 *   POST  /openai/<rest>     -> OpenAI (beeldgeneratie)   (login vereist)
 *   POST  /v1/<rest>         -> OpenAI (alias)            (login vereist)
 *
 * Beveiliging: alleen ingelogde, door een admin GOEDGEKEURDE leden van de
 * Atelier Console (team_members.status = 'approved') mogen genereren.
 * ============================================================ */

const AT_URL = 'https://bequyhghgkvekvibufhw.supabase.co';
const AT_KEY = 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv';
const ORIGINS = ['https://wellshave-adgen.netlify.app', 'http://localhost:8823', 'http://127.0.0.1:8823'];

function corsHeaders(request) {
  const o = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, anthropic-beta',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

const _cache = new Map(); // token -> { exp, ok }
async function approvedMember(request) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!t) return false;
  const now = Date.now();
  const c = _cache.get(t);
  if (c && c.exp > now) return c.ok;
  let ok = false;
  try {
    const r = await fetch(AT_URL + '/auth/v1/user', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': AT_KEY } });
    if (r.ok) {
      const u = await r.json();
      if (u && u.id) {
        const r2 = await fetch(AT_URL + '/rest/v1/team_members?id=eq.' + u.id + '&select=status', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': AT_KEY } });
        if (r2.ok) { const rows = await r2.json(); ok = !!(rows && rows[0] && rows[0].status === 'approved'); }
      }
    }
  } catch (e) { }
  _cache.set(t, { exp: now + 60000, ok });
  return ok;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request);
    const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', ...cors } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (path === '' || path === '/health') return json({ ok: true, service: 'atelier-proxy' });
    if (!(await approvedMember(request))) return json({ ok: false, error: 'unauthorized', hint: 'Log in in de Atelier Console met een goedgekeurd teamaccount.' }, 401);

    // ---- Anthropic (Claude): copy, concepten, analyses ----
    if (path === '/anthropic' && request.method === 'POST') {
      if (!env.ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_KEY secret ontbreekt op deze worker' }, 500);
      const body = await request.text();
      const h = { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01' };
      const beta = request.headers.get('anthropic-beta');
      if (beta) h['anthropic-beta'] = beta;
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: h, body });
      return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    // ---- OpenAI (beeldgeneratie), body GEBUFFERD doorgeven ----
    let oaPath = null;
    if (path.startsWith('/v1/')) oaPath = path.slice(1);
    else if (path.startsWith('/openai/')) oaPath = path.slice('/openai/'.length);
    if (oaPath !== null) {
      if (!env.OPENAI_KEY) return json({ error: 'OPENAI_KEY secret ontbreekt op deze worker' }, 500);
      const target = oaPath.startsWith('v1/') ? ('https://api.openai.com/' + oaPath) : ('https://api.openai.com/v1/' + oaPath);
      const headers = { 'Authorization': 'Bearer ' + env.OPENAI_KEY };
      const ct = request.headers.get('content-type');
      if (ct) headers['Content-Type'] = ct;
      let body;
      if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.arrayBuffer();
      const r = await fetch(target, { method: request.method, headers, body });
      const out = await r.arrayBuffer();
      return new Response(out, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', ...cors } });
    }

    return json({ error: { message: 'Gebruik POST /anthropic of /openai/… (of GET /health).' } }, 404);
  }
};
