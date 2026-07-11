/* ============================================================
 * Wellgroup team-proxy (Cloudflare Worker)  —  BEVEILIGDE VERSIE
 *
 * De sleutels staan hier als secret, niet in de browser van teamleden.
 * Data-endpoints (/anthropic, /openai, /bol) vereisen nu een geldige
 * Supabase-login van een teamlid (token die de OS meestuurt), of een
 * server-to-server service-token (X-Service-Token: <RELAY_TOKEN>).
 *
 * Secrets (Worker > Settings > Variables and Secrets, type Secret):
 *   ANTHROPIC_KEY, OPENAI_KEY
 *   BOL_CLIENT_ID, BOL_CLIENT_SECRET            (Retailer API)
 *   BOL_ADS_CLIENT_ID, BOL_ADS_CLIENT_SECRET    (Advertising API)
 *   SLACK_BOT_TOKEN, RELAY_TOKEN, NOTION_TOKEN  (notify relay)
 * Plaintext var:
 *   NOTION_DATABASE_ID                          (Tasks DB voor de notify relay)
 *
 * Endpoints:
 *   GET   <worker>/                    -> health (open)
 *   GET   <worker>/health              -> health (open)
 *   POST  <worker>/anthropic           -> Claude            (TEAM-login vereist)
 *   POST  <worker>/v1/<rest>           -> OpenAI            (TEAM-login vereist)
 *   POST  <worker>/openai/<rest>       -> OpenAI            (TEAM-login vereist)
 *   *     <worker>/bol/<rest>          -> bol Retailer      (TEAM-login vereist)
 *   *     <worker>/bol/ads/<rest>      -> bol Advertising   (TEAM-login vereist)
 *   POST  <worker>/notify              -> Slack + Notion    (Bearer RELAY_TOKEN)
 *   POST  <worker>/slack/send          -> Slack             (Bearer RELAY_TOKEN)
 *   POST  <worker>/notify-proxy        -> injecteert RELAY_TOKEN server-side
 * ============================================================ */

/* ---- Team-beveiliging (Supabase) ---- */
const SUPA_URL = 'https://npqdlptyuxnnnoqxkpjm.supabase.co';
const SUPA_ANON = 'sb_publishable_Mqr3GMzlUdb-OrjoJKdLPg_OmfcobLu';
const ALLOWED_DOMAINS = ['wellshave.com', 'well-shine.nl', 'platformrebels.com'];
const ALLOWED_ORIGINS = ['https://bol-os.netlify.app', 'https://wellshave-adgen.netlify.app', 'http://localhost:8123', 'http://127.0.0.1:8123', 'http://localhost:8823', 'http://127.0.0.1:8823']; /* [ATELIER] adgen-origins */

function pickOrigin(request) {
  const o = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0];
}

const _teamCache = new Map(); // token -> { exp, ok }
async function verifyTeam(request) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!t) return false;
  const now = Date.now();
  const c = _teamCache.get(t);
  if (c && c.exp > now) return c.ok;
  let ok = false;
  try {
    const r = await fetch(SUPA_URL + '/auth/v1/user', {
      headers: { 'Authorization': 'Bearer ' + t, 'apikey': SUPA_ANON }
    });
    if (r.ok) {
      // toegang = een bestaand Supabase-account; alleen de beheerder maakt
      // accounts aan (zelf-registratie uit), dus geen domein-check meer
      const u = await r.json();
      ok = !!(u && u.id);
    }
  } catch (e) { ok = false; }
  /* [ATELIER] ook logins van de Atelier Console (ad-generator) accepteren.
     Daar staat zelf-registratie AAN, dus strenger dan hierboven: alleen
     accounts die door een admin zijn goedgekeurd (team_members.status
     = 'approved'). Alle andere routes/systemen blijven ongewijzigd. */
  if (!ok) {
    try {
      const AT_URL = 'https://bequyhghgkvekvibufhw.supabase.co';
      const AT_KEY = 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv';
      const r2 = await fetch(AT_URL + '/auth/v1/user', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': AT_KEY } });
      if (r2.ok) {
        const u2 = await r2.json();
        if (u2 && u2.id) {
          const r3 = await fetch(AT_URL + '/rest/v1/team_members?id=eq.' + u2.id + '&select=status', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': AT_KEY } });
          if (r3.ok) { const rows = await r3.json(); ok = !!(rows && rows[0] && rows[0].status === 'approved'); }
        }
      }
    } catch (e2) { }
  }
  _teamCache.set(t, { exp: now + 60000, ok });
  return ok;
}

// Geldig als: ingelogd teamlid (browser) OF server-to-server service-token.
async function authorized(request, env) {
  const svc = request.headers.get('X-Service-Token') || '';
  if (env.RELAY_TOKEN && svc && svc === env.RELAY_TOKEN) return true;
  return await verifyTeam(request);
}

function cors(resp, origin) {
  const h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, anthropic-beta, Accept, apikey, X-Service-Token');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  h.set('Vary', 'Origin');
  return new Response(resp.body, { status: resp.status, headers: h });
}
function json(obj, status, origin) {
  return cors(new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } }), origin);
}

export default {
  async fetch(request, env) {
    const origin = pickOrigin(request);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (path === '' || path === '/health') {
      return json({ ok: true, service: 'wellgroup-team-proxy' }, 200, origin);
    }

    try {
      // ---- Notify relay: Slack + Notion (Bearer RELAY_TOKEN, server-to-server) ----
      if (path === '/notify' || path === '/slack/send') {
        return handleNotify(request, env, path, origin);
      }

      // ---- Admin: nightly handmatig draaien / status (X-Admin-Token = RELAY_TOKEN) ----
      if (path === '/admin/run-nightly' || path === '/admin/nightly-status') {
        const tok = request.headers.get('X-Admin-Token') || '';
        if (!env.RELAY_TOKEN || tok !== env.RELAY_TOKEN) return json({ ok: false, error: 'unauthorized' }, 401, origin);
        if (path === '/admin/nightly-status') {
          const stRows = await sbSvc(env, 'GET', 'nightly_state?key=eq.run&select=value,updated_at');
          return json({ ok: true, state: (stRows && stRows[0]) || null }, 200, origin);
        }
        const date = url.searchParams.get('date') || null;
        const res = await runNightlyChunk(env, date);
        return json(res, 200, origin);
      }

      // ---- Notify-proxy: injecteert RELAY_TOKEN server-side ----
      if (path === '/notify-proxy') {
        if (!env.RELAY_TOKEN) return json({ ok: false, error: 'RELAY_TOKEN secret ontbreekt op de Worker' }, 500, origin);
        const h = new Headers(request.headers);
        h.set('Authorization', 'Bearer ' + env.RELAY_TOKEN);
        return handleNotify(new Request(request, { headers: h }), env, '/notify', origin);
      }

      // ===== Vanaf hier: TEAM-login vereist (of service-token) =====
      if (!(await authorized(request, env))) {
        return json({ ok: false, error: 'unauthorized', hint: 'Log in via de OS of stuur een geldige X-Service-Token mee.' }, 401, origin);
      }

      // ---- Anthropic (Claude), JSON ----
      if (path === '/anthropic') {
        if (!env.ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_KEY secret ontbreekt op de Worker' }, 500, origin);
        const body = await request.text();
        const headers = {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_KEY,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01'
        };
        const beta = request.headers.get('anthropic-beta');
        if (beta) headers['anthropic-beta'] = beta;
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body });
        return cors(new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } }), origin);
      }

      // ---- OpenAI (beeld), body GEBUFFERD doorgeven ----
      let oaPath = null;
      if (path.startsWith('/v1/')) oaPath = path.slice(1);
      else if (path.startsWith('/openai/')) oaPath = path.slice('/openai/'.length);
      if (oaPath !== null) {
        if (!env.OPENAI_KEY) return json({ error: 'OPENAI_KEY secret ontbreekt op de Worker' }, 500, origin);
        const target = oaPath.startsWith('v1/')
          ? ('https://api.openai.com/' + oaPath)
          : ('https://api.openai.com/v1/' + oaPath);
        const headers = { 'Authorization': 'Bearer ' + env.OPENAI_KEY };
        const ct = request.headers.get('content-type');
        if (ct) headers['Content-Type'] = ct;
        let body;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          body = await request.arrayBuffer();
        }
        const r = await fetch(target, { method: request.method, headers, body });
        const out = await r.arrayBuffer();
        return cors(new Response(out, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json' } }), origin);
      }

      // ---- bol.com (Retailer + Advertising) ----
      if (path.startsWith('/bol')) return handleBol(request, env, origin);

      return json({ error: 'Onbekend endpoint: ' + path }, 404, origin);
    } catch (e) {
      return json({ error: String(e && e.message ? e.message : e) }, 500, origin);
    }
  },

  // Cron Trigger (zet in Cloudflare meerdere firings, bv. 20/30/40/50 na 3u UTC —
  // elke firing werkt een chunk af; is de run klaar, dan doet de rest niets meer)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runNightlyChunk(env, null).catch(function (e) { console.log('nightly:', e && e.message); }));
  }
};

let _bolToken = null;    // { access_token, expires_at }  (retailer)
let _bolAdsToken = null; // { access_token, expires_at }  (advertising)

async function _bolFetchToken(id, secret) {
  const basic = btoa(id + ':' + secret);
  const r = await fetch('https://login.bol.com/token?grant_type=client_credentials', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + basic, 'Accept': 'application/json' }
  });
  const txt = await r.text();
  if (!r.ok) throw new Error('token ' + r.status + ': ' + txt.slice(0, 300));
  return JSON.parse(txt);
}

async function getBolToken(env) {
  const now = Date.now();
  if (_bolToken && _bolToken.expires_at > now + 30000) return _bolToken.access_token;
  if (!env.BOL_CLIENT_ID || !env.BOL_CLIENT_SECRET) {
    throw new Error('BOL_CLIENT_ID of BOL_CLIENT_SECRET ontbreekt in de Worker-secrets');
  }
  const j = await _bolFetchToken(env.BOL_CLIENT_ID, env.BOL_CLIENT_SECRET);
  _bolToken = { access_token: j.access_token, expires_at: now + ((j.expires_in || 299) * 1000) };
  return _bolToken.access_token;
}

async function getBolAdsToken(env) {
  const now = Date.now();
  if (_bolAdsToken && _bolAdsToken.expires_at > now + 30000) return _bolAdsToken.access_token;
  if (!env.BOL_ADS_CLIENT_ID || !env.BOL_ADS_CLIENT_SECRET) {
    throw new Error('BOL_ADS_CLIENT_ID of BOL_ADS_CLIENT_SECRET ontbreekt in de Worker-secrets (maak Advertising API credentials aan in het Seller Dashboard)');
  }
  const j = await _bolFetchToken(env.BOL_ADS_CLIENT_ID, env.BOL_ADS_CLIENT_SECRET);
  _bolAdsToken = { access_token: j.access_token, expires_at: now + ((j.expires_in || 299) * 1000) };
  return _bolAdsToken.access_token;
}

function bolCors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, apikey, X-Service-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function bolJson(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...bolCors(origin), 'Content-Type': 'application/json' }
  });
}

async function handleBol(request, env, origin) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: bolCors(origin) });
  }

  const url = new URL(request.url);
  let path = url.pathname.replace(/^\/bol/, '');
  if (!path.startsWith('/')) path = '/' + path;

  // Healthcheck retailer: GET /bol of /bol/ping
  if (path === '/' || path === '/ping') {
    try {
      await getBolToken(env);
      return bolJson({ ok: true, message: 'bol-proxy actief, token opgehaald' }, 200, origin);
    } catch (e) {
      return bolJson({ ok: false, error: e.message }, 502, origin);
    }
  }

  // ============ ADVERTISING API: /bol/ads/* ============
  if (path === '/ads/ping') {
    try {
      await getBolAdsToken(env);
      return bolJson({ ok: true, message: 'bol-ads actief, token opgehaald' }, 200, origin);
    } catch (e) {
      return bolJson({ ok: false, error: e.message }, 502, origin);
    }
  }
  if (path.startsWith('/ads/')) {
    let adsToken;
    try {
      adsToken = await getBolAdsToken(env);
    } catch (e) {
      return bolJson({ error: { message: 'bol ads auth mislukt: ' + e.message } }, 502, origin);
    }
    const adsTarget = 'https://api.bol.com/advertiser/sponsored-products' + path.slice(4) + url.search;
    const clientAcceptAds = request.headers.get('Accept') || '';
    const adsAccept = clientAcceptAds.indexOf('application/vnd.advertiser') === 0
      ? clientAcceptAds
      : 'application/vnd.advertiser.v11+json';
    const adsHeaders = { 'Authorization': 'Bearer ' + adsToken, 'Accept': adsAccept };
    let adsBody;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      adsBody = await request.text();
      if (adsBody) adsHeaders['Content-Type'] = 'application/vnd.advertiser.v11+json';
    }
    let adsResp;
    try {
      adsResp = await fetch(adsTarget, { method: request.method, headers: adsHeaders, body: adsBody });
    } catch (e) {
      return bolJson({ error: { message: 'bol ads request mislukt: ' + e.message } }, 502, origin);
    }
    const adsText = await adsResp.text();
    return new Response(adsText, {
      status: adsResp.status,
      headers: { ...bolCors(origin), 'Content-Type': adsResp.headers.get('content-type') || 'application/json' }
    });
  }

  // ============ RETAILER API ============
  let token;
  try {
    token = await getBolToken(env);
  } catch (e) {
    return bolJson({ error: { message: 'bol auth mislukt: ' + e.message } }, 502, origin);
  }

  const apiBase = path.startsWith('/process-status')
    ? 'https://api.bol.com/shared'
    : 'https://api.bol.com/retailer';
  const target = apiBase + path + url.search;

  const clientAccept = request.headers.get('Accept') || '';
  const accept = clientAccept.indexOf('application/vnd.retailer') === 0
    ? clientAccept
    : 'application/vnd.retailer.v10+json';
  const headers = { 'Authorization': 'Bearer ' + token, 'Accept': accept };

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
    if (body) headers['Content-Type'] = 'application/vnd.retailer.v10+json';
  }

  let resp;
  try {
    resp = await fetch(target, { method: request.method, headers, body });
  } catch (e) {
    return bolJson({ error: { message: 'bol request mislukt: ' + e.message } }, 502, origin);
  }

  const outText = await resp.text();
  return new Response(outText, {
    status: resp.status,
    headers: { ...bolCors(origin), 'Content-Type': resp.headers.get('content-type') || 'application/json' }
  });
}

/* ============================================================
 * Notify relay: Slack + Notion.
 * ============================================================ */

const NOTIFY_DEFAULT_CHANNEL = 'C0B6R08RB0A'; // #bol_wellshave

async function handleNotify(request, env, path, origin) {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, origin);

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.RELAY_TOKEN || token !== env.RELAY_TOKEN) return json({ ok: false, error: 'unauthorized' }, 401, origin);

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'invalid_json' }, 400, origin); }
  const text = (body.text != null ? body.text : (body.message != null ? body.message : '')).toString().trim();
  if (!text && !body.blocks) return json({ ok: false, error: 'missing_text' }, 400, origin);

  const slackOnly = path === '/slack/send';
  const wantSlack = slackOnly || body.slack !== false;
  const wantNotion = !slackOnly && body.notion !== false && !!env.NOTION_TOKEN;

  const results = {};
  if (wantSlack) results.slack = await notifyPostSlack(env, body, text);
  if (wantNotion) results.notion = await notifyCreateNotionTask(env, body, text);
  const ok = Object.keys(results).length > 0 && Object.values(results).every(r => r.ok);
  return json(Object.assign({ ok }, results), ok ? 200 : 502, origin);
}

async function notifyPostSlack(env, body, text) {
  if (!env.SLACK_BOT_TOKEN) return { ok: false, error: 'SLACK_BOT_TOKEN ontbreekt' };
  const channel = (body.channel || env.DEFAULT_CHANNEL || NOTIFY_DEFAULT_CHANNEL).toString();
  const payload = { channel, unfurl_links: false };
  if (text) payload.text = text;
  if (body.blocks) { payload.blocks = body.blocks; if (!payload.text) payload.text = 'Bericht'; }
  try {
    const r = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.SLACK_BOT_TOKEN, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    return d.ok ? { ok: true, channel: d.channel, ts: d.ts } : { ok: false, error: d.error || 'slack_error' };
  } catch (e) {
    return { ok: false, error: 'slack_unreachable' };
  }
}

async function notifyCreateNotionTask(env, body, text) {
  if (!env.NOTION_DATABASE_ID) return { ok: false, error: 'NOTION_DATABASE_ID ontbreekt' };
  const n = (body.notion && typeof body.notion === 'object') ? body.notion : {};
  const title = (n.title || text || 'BOL-notificatie').toString().slice(0, 2000);
  const sourceUrl = n.url || body.url || '';
  const context = n.body || '';
  const properties = {
    Title: { title: [{ text: { content: title } }] },
    Status: { status: { name: env.NOTION_DEFAULT_STATUS || 'Todo' } },
    Subject: { multi_select: [{ name: env.NOTION_SUBJECT || 'Marketplaces' }] }
  };
  if (n.priority) properties.Priority = { select: { name: n.priority } };
  const children = [];
  if (context) children.push(notifyParagraph(context));
  if (sourceUrl) children.push(notifyParagraph('Bron: ', sourceUrl));
  const payload = { parent: { database_id: env.NOTION_DATABASE_ID }, properties };
  if (children.length) payload.children = children;
  try {
    const r = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.NOTION_TOKEN,
        'Notion-Version': env.NOTION_VERSION || '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    return r.ok ? { ok: true, id: d.id, url: d.url } : { ok: false, error: d.message || d.code || 'notion_error' };
  } catch (e) {
    return { ok: false, error: 'notion_unreachable' };
  }
}

function notifyParagraph(label, link) {
  const rich = [{ type: 'text', text: { content: label } }];
  if (link) rich.push({ type: 'text', text: { content: link, link: { url: link } } });
  return { object: 'block', type: 'paragraph', paragraph: { rich_text: rich } };
}

/* ============================================================
 * NIGHTLY (v15) — dagelijkse snapshots, auto-events, signalen,
 * brain-findings en Slack-digest.
 *
 * Hervatbaar in chunks: voortgang staat in Supabase (nightly_state).
 * Elke aanroep (cron-firing of /admin/run-nightly) werkt door tot het
 * subrequest-budget op is en geeft {done:false, phase} terug; de
 * volgende aanroep gaat verder waar 'ie was. done:true = klaar.
 *
 * Extra secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY, SLACK_WEBHOOK_URL (optioneel).
 * Optionele plaintext var: NIGHTLY_BUDGET (default 35; op paid plan 600).
 * ============================================================ */

const NCFG = {
  vat: 1.21,
  minWeeklyVisits: 50,        // onder dit aantal 7d-bezoeken: "te weinig data", geen signaal
  convDropWarn: 0.25,         // 7d-conversie < baseline −25% relatief → warn
  convDropCrit: 0.40,         // −40% → critical
  visitsMovePct: 0.30,        // 7d-visits ±30% vs baseline
  wasteClicks: 8,             // ≥8 klikken, 0 ads-sales in 14d → ads_waste
  wasteMinCost: 5,            // of ≥ €5 ads-kosten met ACOS > doel ×1.25
  acosFactor: 1.25,
  defTargetAcos: 15, defTargetTacos: 8, defMinConversion: 5,   // accountdoelen (fallback)
  brainMinAgeDays: 7, brainMaxAgeDays: 21, brainMaxPerNight: 5,
  minHistoryDays: 10,         // pas signalen geven vanaf zoveel dagen snapshots (voorkomt valse baselines)
  budgetDefault: 35
};

function nSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function nDate(base, offsetDays) { const d = base ? new Date(base + 'T12:00:00Z') : new Date(); d.setUTCDate(d.getUTCDate() + (offsetDays || 0)); return d.toISOString().slice(0, 10); }
function nNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function nRound(v) { return v == null ? null : Math.round(v * 100) / 100; }
function nMedian(arr) { if (!arr.length) return 0; const s = arr.slice().sort(function (a, b) { return a - b; }); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

class NBudgetStop extends Error { constructor() { super('budget op'); this.budget = true; } }

/* ---- Supabase service-client (service key: alléén hier, nooit in de app) ---- */
async function sbSvc(env, method, path, body, prefer) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL of SUPABASE_SERVICE_KEY ontbreekt (Worker-secrets)');
  const h = { 'apikey': env.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' };
  if (prefer) h['Prefer'] = prefer;
  const r = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, { method: method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + path.split('?')[0] + ': ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}
async function nLoadKV(env, key) { const rows = await sbSvc(env, 'GET', 'nightly_state?key=eq.' + key + '&select=value'); return (rows && rows[0] && rows[0].value) || null; }
async function nSaveKV(env, key, value) { await sbSvc(env, 'POST', 'nightly_state?on_conflict=key', [{ key: key, value: value, updated_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal'); }

/* ---- bol-fetch met budget + 429-afhandeling (zelfde throttle-gedachte als de app) ---- */
async function nBol(env, B, path, accept) {
  const token = await getBolToken(env);
  for (let a = 0; a < 4; a++) {
    if (--B.left < 0) throw new NBudgetStop();
    const base = path.startsWith('/process-status') ? 'https://api.bol.com/shared' : 'https://api.bol.com/retailer';
    const r = await fetch(base + path, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': accept || 'application/vnd.retailer.v10+json' } });
    if (r.status === 429) { const ra = parseInt(r.headers.get('Retry-After') || '6', 10); await nSleep((ra > 0 ? ra : 6) * 1000); continue; }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('bol ' + r.status + ' ' + path.split('?')[0]);
    if (accept && accept.indexOf('csv') >= 0) return await r.text();
    const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  throw new Error('bol blijft rate-limiten: ' + path.split('?')[0]);
}
async function nBolPost(env, B, path, body) {
  const token = await getBolToken(env);
  for (let a = 0; a < 4; a++) {
    if (--B.left < 0) throw new NBudgetStop();
    const r = await fetch('https://api.bol.com/retailer' + path, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.retailer.v10+json', 'Content-Type': 'application/vnd.retailer.v10+json' }, body: JSON.stringify(body) });
    if (r.status === 429) { const ra = parseInt(r.headers.get('Retry-After') || '6', 10); await nSleep((ra > 0 ? ra : 6) * 1000); continue; }
    if (!r.ok) throw new Error('bol ' + r.status + ' ' + path);
    return await r.json();
  }
  throw new Error('bol blijft rate-limiten: ' + path);
}
async function nAds(env, B, path, body) {
  const token = await getBolAdsToken(env);
  for (let a = 0; a < 4; a++) {
    if (--B.left < 0) throw new NBudgetStop();
    const opts = { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.advertiser.v11+json' } };
    if (body !== undefined) { opts.method = 'POST'; opts.headers['Content-Type'] = 'application/vnd.advertiser.v11+json'; opts.body = JSON.stringify(body); }
    const r = await fetch('https://api.bol.com/advertiser/sponsored-products' + path, opts);
    if (r.status === 429) { const ra = parseInt(r.headers.get('Retry-After') || '6', 10); await nSleep((ra > 0 ? ra : 6) * 1000); continue; }
    if (!r.ok) throw new Error('bol-ads ' + r.status + ' ' + path.split('?')[0]);
    const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }
  throw new Error('bol-ads blijft rate-limiten');
}
function nPickArray(j) {
  if (!j) return [];
  if (Array.isArray(j)) return j;
  const keys = Object.keys(j);
  for (let i = 0; i < keys.length; i++) if (Array.isArray(j[keys[i]])) return j[keys[i]];
  return [];
}

/* ---- Claude (server-side, rechtstreeks) ---- */
async function nClaude(env, system, user, maxTokens) {
  if (!env.ANTHROPIC_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-fable-5', max_tokens: maxTokens || 1500, system: system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) return null;
    const j = await r.json();
    return ((j.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('') || '').trim();
  } catch (e) { return null; }
}
function nJsonArr(t) { if (!t) return null; const m = t.match(/\[[\s\S]*\]/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } }

/* ---- Slack ---- */
async function nSlack(env, text) {
  try {
    if (env.SLACK_WEBHOOK_URL) {
      await fetch(env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text }) });
      return true;
    }
    if (env.SLACK_BOT_TOKEN) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + env.SLACK_BOT_TOKEN, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ channel: env.DEFAULT_CHANNEL || NOTIFY_DEFAULT_CHANNEL, text: text, unfurl_links: false })
      });
      return true;
    }
  } catch (e) { }
  return false;
}

/* ---- CSV-parser (offers-export, quoted velden) ---- */
function nParseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function nParseOffers(csv) {
  const rows = nParseCsv(csv); if (rows.length < 2) return [];
  const head = rows[0].map(function (h) { return (h || '').toLowerCase(); });
  const ix = function (name) { return head.indexOf(name.toLowerCase()); };
  const iOffer = ix('offerId'), iEan = ix('ean'), iPrice = ix('bundlePricesPrice'),
        iOnHold = ix('onHoldByRetailer'), iCorr = ix('correctedStock'), iStock = ix('stockAmount'), iFul = ix('fulfilmentType');
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r]; if (!c[iEan]) continue;
    out.push({
      offerId: c[iOffer], ean: c[iEan], price: nNum(c[iPrice]),
      onHold: (String(c[iOnHold]).toLowerCase() === 'true') ? 1 : 0,
      stockFbr: iCorr >= 0 ? Math.round(nNum(c[iCorr])) : Math.round(nNum(c[iStock])),
      fulfilment: c[iFul] || ''
    });
  }
  return out;
}
function nTitleFromCatalog(j) {
  try {
    const attrs = (j && (j.attributes || (j.catalogProduct && j.catalogProduct.attributes))) || [];
    for (let i = 0; i < attrs.length; i++) {
      const id = String(attrs[i].id || '').toLowerCase();
      if (id === 'title' || id === 'titel') { const v = attrs[i].values && attrs[i].values[0]; return (v && (v.value || v.textValue)) || null; }
    }
  } catch (e) { }
  return null;
}

/* ================= HOOFD-LOOP ================= */
async function runNightlyChunk(env, forceDate) {
  const B = { left: parseInt(env.NIGHTLY_BUDGET || '', 10) || NCFG.budgetDefault };
  const yday = forceDate || nDate(null, -1);
  let st = await nLoadKV(env, 'run');
  if (!st || st.date !== yday) st = { date: yday, phase: 'export_start', cursor: 0, tries: 0, log: [], data: {} };
  if (st.phase === 'done') return { done: true, date: st.date, log: st.log };
  try {
    while (st.phase !== 'done') {
      await nStep(env, st, B);
      await nSaveKV(env, 'run', st);
    }
    return { done: true, date: st.date, log: st.log };
  } catch (e) {
    await nSaveKV(env, 'run', st).catch(function () { });
    if (e && e.budget) return { done: false, date: st.date, phase: st.phase, cursor: st.cursor, hint: 'budget op — roep opnieuw aan of wacht op de volgende cron-firing' };
    st.log.push('FOUT in ' + st.phase + ': ' + (e && e.message));
    await nSaveKV(env, 'run', st).catch(function () { });
    return { done: false, date: st.date, phase: st.phase, error: String(e && e.message || e) };
  }
}

async function nStep(env, st, B) {
  const D = st.data, yday = st.date;
  switch (st.phase) {

    case 'export_start': {
      const j = await nBolPost(env, B, '/offers/export', { format: 'CSV' });
      D.psId = j.processStatusId; st.phase = 'export_poll'; st.tries = 0; return;
    }
    case 'export_poll': {
      const pj = await nBol(env, B, '/process-status/' + D.psId);
      if (pj && pj.status === 'SUCCESS') { D.reportId = pj.entityId; st.phase = 'export_get'; return; }
      if (pj && pj.status === 'FAILURE') throw new Error('offers-export mislukt');
      st.tries = (st.tries || 0) + 1; if (st.tries > 40) throw new Error('offers-export timeout');
      await nSleep(4000); return;
    }
    case 'export_get': {
      const csv = await nBol(env, B, '/offers/export/' + D.reportId, 'application/vnd.retailer.v10+csv');
      D.offers = nParseOffers(csv || ''); if (!D.offers.length) throw new Error('offers-export leeg');
      st.log.push('offers: ' + D.offers.length); st.phase = 'inventory'; return;
    }
    case 'inventory': {
      const inv = {};
      for (let p = 1; p <= 6; p++) {
        const j = await nBol(env, B, '/inventory?page=' + p);
        const rows = (j && j.inventory) || [];
        rows.forEach(function (r) { inv[r.ean] = (r.regularStock || 0) + (r.gradedStock || 0); });
        if (rows.length < 50) break;
      }
      D.lvb = inv; st.phase = 'insights'; st.cursor = 0; return;
    }
    case 'insights': {
      D.vis = D.vis || {};
      while (st.cursor < D.offers.length) {
        const o = D.offers[st.cursor];
        try {
          const j = await nBol(env, B, '/insights/offer?offer-id=' + o.offerId + '&period=DAY&number-of-periods=2&name=PRODUCT_VISITS,BUY_BOX_PERCENTAGE');
          const rec = { visits: null, buybox: null };
          ((j && j.offerInsights) || []).forEach(function (ins) {
            (ins.periods || []).forEach(function (p) {
              const pd = p.period || {}; const ds = pd.year + '-' + String(pd.month).padStart(2, '0') + '-' + String(pd.day).padStart(2, '0');
              if (ds !== yday) return;
              if (ins.name === 'PRODUCT_VISITS') rec.visits = Math.round(nNum(p.total != null ? p.total : (p.countries && p.countries.reduce(function (s, c) { return s + nNum(c.value); }, 0))));
              if (ins.name === 'BUY_BOX_PERCENTAGE') rec.buybox = nNum(p.total != null ? p.total : (p.countries && p.countries.length ? p.countries.reduce(function (s, c) { return s + nNum(c.value); }, 0) / p.countries.length : null));
            });
          });
          D.vis[o.ean] = rec;
        } catch (e) { if (e && e.budget) throw e; }
        st.cursor++;
      }
      st.phase = 'orders_list'; st.cursor = 0; return;
    }
    case 'orders_list': {
      const ids = [];
      const fms = ['FBR', 'FBB'];
      for (let f = 0; f < fms.length; f++) {
        for (let p = 1; p <= 6; p++) {
          const j = await nBol(env, B, '/orders?status=ALL&fulfilment-method=' + fms[f] + '&latest-change-date=' + yday + '&page=' + p);
          const rows = (j && j.orders) || [];
          rows.forEach(function (o) { if (ids.indexOf(o.orderId) < 0) ids.push(o.orderId); });
          if (rows.length < 50) break;
        }
      }
      D.orderIds = ids.slice(0, 200); D.sales = {}; st.phase = 'orders_detail'; st.cursor = 0;
      st.log.push('orders (changed ' + yday + '): ' + D.orderIds.length); return;
    }
    case 'orders_detail': {
      while (st.cursor < D.orderIds.length) {
        const id = D.orderIds[st.cursor];
        try {
          const od = await nBol(env, B, '/orders/' + id);
          if (od && String(od.orderPlacedDateTime || '').slice(0, 10) === yday) {
            (od.orderItems || []).forEach(function (it) {
              const e = it.ean || (it.product && it.product.ean); if (!e) return;
              const qty = it.quantity || 0; const price = nNum(it.unitPrice);
              const s = D.sales[e] = D.sales[e] || { units: 0, revenue: 0, orders: 0 };
              s.units += qty; s.revenue += price * qty; s.orders += 1;
            });
          }
        } catch (e) { if (e && e.budget) throw e; }
        st.cursor++;
      }
      st.phase = 'ads_lists'; st.cursor = 0; return;
    }
    case 'ads_lists': {
      let camps = [];
      for (let p = 1; p <= 10; p++) { const j = await nAds(env, B, '/campaign-management/campaigns/list', { page: p, pageSize: 50 }); const rows = (j && j.campaigns) || []; camps = camps.concat(rows); if (rows.length < 50) break; }
      let ads = [];
      for (let p = 1; p <= 40; p++) { const j = await nAds(env, B, '/campaign-management/ads/list', { page: p, pageSize: 50 }); const rows = (j && j.ads) || []; ads = ads.concat(rows); if (rows.length < 50) break; }
      D.campaigns = camps.map(function (c) { return { id: c.campaignId || c.id, name: c.name, state: c.state, budget: c.dailyBudget != null ? c.dailyBudget : c.budget }; });
      D.ads = ads.map(function (a) { return { id: a.adId || a.id, ean: a.ean, adGroupId: a.adGroupId, campaignId: a.campaignId, state: a.state }; });
      st.phase = 'ads_report'; st.cursor = 0;
      st.log.push('campagnes: ' + D.campaigns.length + ', ads: ' + D.ads.length); return;
    }
    case 'ads_report': {
      D.adPerf = D.adPerf || {};
      const ids = (D.ads || []).map(function (a) { return a.id; }).filter(Boolean);
      while (st.cursor < ids.length) {
        const batch = ids.slice(st.cursor, st.cursor + 100);
        const j = await nAds(env, B, '/reporting/performance?entity-type=AD&entity-ids=' + batch.join(',') + '&period-start-date=' + yday + '&period-end-date=' + yday);
        nPickArray(j).forEach(function (r) { const id = r.entityId || r.adId || r.id; if (id != null) D.adPerf[id] = r; });
        st.cursor += 100;
      }
      st.phase = 'titles'; st.cursor = 0; return;
    }
    case 'titles': {
      D.titles = D.titles || {};
      while (st.cursor < D.offers.length) {
        const o = D.offers[st.cursor];
        try {
          const j = await nBol(env, B, '/content/catalog-products/' + o.ean);
          const t = nTitleFromCatalog(j); if (t) D.titles[o.ean] = t;
        } catch (e) { if (e && e.budget) throw e; }
        st.cursor++;
      }
      st.phase = 'write'; return;
    }
    case 'write': {
      const adsByEan = {};
      (D.ads || []).forEach(function (a) {
        const p = (D.adPerf || {})[a.id]; if (!p || !a.ean) return;
        const s = adsByEan[a.ean] = adsByEan[a.ean] || { cost: 0, sales: 0, clicks: 0, impr: 0 };
        s.cost += nNum(p.cost); s.sales += nNum(p.sales14d != null ? p.sales14d : p.sales);
        s.clicks += nNum(p.clicks); s.impr += nNum(p.impressions);
      });
      const rows = (D.offers || []).map(function (o) {
        const v = (D.vis || {})[o.ean] || {}; const s = (D.sales || {})[o.ean] || { units: 0, revenue: 0, orders: 0 };
        const a = adsByEan[o.ean] || { cost: 0, sales: 0, clicks: 0, impr: 0 };
        const conv = (v.visits > 0) ? (s.orders / v.visits * 100) : null;
        const acos = (a.sales > 0) ? (a.cost / a.sales * 100) : null;
        const tacos = (s.revenue > 0) ? (a.cost / (s.revenue / NCFG.vat) * 100) : null;
        return {
          d: yday, ean: o.ean, price: o.price,
          stock_lvb: (D.lvb || {})[o.ean] != null ? D.lvb[o.ean] : null, stock_fbr: o.stockFbr, on_hold: o.onHold,
          visits: v.visits, buybox: v.buybox != null ? nRound(v.buybox) : null,
          conversion: nRound(conv), orders: s.orders, units: s.units, revenue: nRound(s.revenue),
          ads_cost: nRound(a.cost), ads_sales: nRound(a.sales), ads_clicks: Math.round(a.clicks), ads_impressions: Math.round(a.impr),
          acos: nRound(acos), tacos: nRound(tacos)
        };
      });
      await sbSvc(env, 'POST', 'daily_snapshots?on_conflict=d,ean', rows, 'resolution=merge-duplicates,return=minimal');
      st.log.push('snapshots: ' + rows.length); st.phase = 'diff'; return;
    }
    case 'diff': {
      const prevRows = await sbSvc(env, 'GET', 'daily_snapshots?select=ean,price,stock_lvb,stock_fbr&d=eq.' + nDate(yday, -1)) || [];
      const prevMap = {}; prevRows.forEach(function (r) { prevMap[r.ean] = r; });
      const prevMeta = (await nLoadKV(env, 'prev_meta')) || {};
      const events = [];
      (D.offers || []).forEach(function (o) {
        const p = prevMap[o.ean];
        if (p && p.price != null && o.price != null && Math.abs(p.price - o.price) > 0.009)
          events.push({ ean: o.ean, source: 'auto', type: 'price', before: String(p.price), after: String(o.price), detail: { via: 'nightly' } });
        if (p) {
          const prevStock = (p.stock_lvb || 0) + (p.stock_fbr || 0);
          const nowStock = ((D.lvb || {})[o.ean] || 0) + (o.stockFbr || 0);
          if ((nowStock === 0) !== (prevStock === 0))
            events.push({ ean: o.ean, source: 'auto', type: 'stock', before: String(prevStock), after: String(nowStock), detail: { note: nowStock === 0 ? 'uitverkocht' : 'weer op voorraad' } });
        }
      });
      Object.keys(D.titles || {}).forEach(function (ean) {
        const old = (prevMeta.titles || {})[ean];
        if (old && old !== D.titles[ean])
          events.push({ ean: ean, source: 'auto', type: 'title', before: String(old).slice(0, 300), after: String(D.titles[ean]).slice(0, 300), detail: { via: 'nightly' } });
      });
      (D.campaigns || []).forEach(function (c) {
        const old = (prevMeta.campaigns || {})[c.id];
        if (old) {
          if (old.state !== c.state) events.push({ ean: null, source: 'auto', type: 'campaign_state', before: old.state, after: c.state, detail: { campaignId: c.id, name: c.name } });
          if (nNum(old.budget) !== nNum(c.budget)) events.push({ ean: null, source: 'auto', type: 'budget', before: String(old.budget), after: String(c.budget), detail: { campaignId: c.id, name: c.name } });
        }
      });
      if (events.length) await sbSvc(env, 'POST', 'events', events, 'return=minimal');
      st.log.push('auto-events: ' + events.length);
      const meta = { titles: Object.keys(D.titles || {}).length ? D.titles : (prevMeta.titles || {}), campaigns: {} };
      (D.campaigns || []).forEach(function (c) { meta.campaigns[c.id] = { state: c.state, budget: c.budget }; });
      await nSaveKV(env, 'prev_meta', meta);
      st.phase = 'signals'; return;
    }
    case 'signals': { await nSignals(env, st); st.phase = 'brain'; return; }
    case 'brain': { await nBrain(env, st); st.phase = 'slack'; return; }
    case 'slack': { await nDigest(env, st); st.phase = 'done'; st.log.push('klaar ✓'); return; }
  }
  throw new Error('onbekende fase: ' + st.phase);
}

/* ================= SIGNALEN ================= */
async function nSignals(env, st) {
  const yday = st.date;
  const from = nDate(yday, -27);
  const snaps = await sbSvc(env, 'GET', 'daily_snapshots?select=d,ean,visits,conversion,orders,units,revenue,ads_cost,ads_sales,ads_clicks,acos,stock_lvb,stock_fbr&d=gte.' + from + '&d=lte.' + yday + '&order=d.asc') || [];
  const targets = {}; (await sbSvc(env, 'GET', 'product_targets?select=*') || []).forEach(function (t) { targets[t.ean] = t; });
  const open = await sbSvc(env, 'GET', 'signals?select=ean,kind&status=in.(new,seen)') || [];
  const openKey = {}; open.forEach(function (s) { openKey[(s.ean || '') + '|' + s.kind] = 1; });
  let supplier = null;
  try { const osr = await sbSvc(env, 'GET', 'os_state?select=value&namespace=eq.supplier'); supplier = (osr && osr[0] && osr[0].value) || null; } catch (e) { }

  const byEan = {};
  snaps.forEach(function (r) { (byEan[r.ean] = byEan[r.ean] || []).push(r); });
  const titles = st.data.titles || {};
  const name = function (ean) { return titles[ean] ? titles[ean].replace(/^Wellshave\s*/i, '').slice(0, 60) : ean; };
  const found = [];
  const sum = function (rows, f) { return rows.reduce(function (s, r) { return s + nNum(r[f]); }, 0); };

  Object.keys(byEan).forEach(function (ean) {
    const rows = byEan[ean];
    const histDays = {}; rows.forEach(function (r) { histDays[r.d] = 1; });
    const enoughHistory = Object.keys(histDays).length >= NCFG.minHistoryDays;
    const last7 = rows.filter(function (r) { return r.d > nDate(yday, -7); });
    const visits7 = sum(last7, 'visits'), orders7 = sum(last7, 'orders');
    const visitsAll = rows.map(function (r) { return nNum(r.visits); });
    const baseWeek = nMedian(visitsAll) * 7;
    const visits28 = sum(rows, 'visits'), orders28 = sum(rows, 'orders');
    const conv7 = visits7 > 0 ? orders7 / visits7 * 100 : null;
    const baseConv = visits28 > 0 ? orders28 / visits28 * 100 : null;
    const t = targets[ean] || {};
    const tAcos = nNum(t.target_acos) || NCFG.defTargetAcos;

    // conversie-daling
    if (enoughHistory && visits7 >= NCFG.minWeeklyVisits && baseConv > 0 && conv7 != null) {
      const relDrop = 1 - conv7 / baseConv;
      if (relDrop >= NCFG.convDropCrit) found.push({ ean: ean, kind: 'conversion_drop', severity: 'critical', metric: { conv7: nRound(conv7), visits7: visits7 }, baseline: { conv28: nRound(baseConv) } });
      else if (relDrop >= NCFG.convDropWarn) found.push({ ean: ean, kind: 'conversion_drop', severity: 'warn', metric: { conv7: nRound(conv7), visits7: visits7 }, baseline: { conv28: nRound(baseConv) } });
    }
    // bezoek daling / stijging
    if (enoughHistory && baseWeek >= NCFG.minWeeklyVisits) {
      if (visits7 <= baseWeek * (1 - NCFG.visitsMovePct)) found.push({ ean: ean, kind: 'visits_drop', severity: 'warn', metric: { visits7: visits7 }, baseline: { weekMediaan: Math.round(baseWeek) } });
      else if (visits7 >= baseWeek * (1 + NCFG.visitsMovePct)) found.push({ ean: ean, kind: 'visits_rise', severity: 'info', metric: { visits7: visits7 }, baseline: { weekMediaan: Math.round(baseWeek) } });
    }
    // trends: 3 aaneengesloten weken
    const wk = [0, 1, 2].map(function (w) {
      const rowsW = rows.filter(function (r) { return r.d > nDate(yday, -7 * (w + 1)) && r.d <= nDate(yday, -7 * w); });
      return { rev: sum(rowsW, 'revenue'), conv: (sum(rowsW, 'visits') > 0 ? sum(rowsW, 'orders') / sum(rowsW, 'visits') * 100 : 0) };
    });
    if (enoughHistory && wk[2].rev > 0 && wk[2].rev < wk[1].rev && wk[1].rev < wk[0].rev)
      found.push({ ean: ean, kind: 'trend_up', severity: 'info', metric: { weken: [nRound(wk[2].rev), nRound(wk[1].rev), nRound(wk[0].rev)] }, baseline: {} });
    if (enoughHistory && wk[0].rev > 0 && wk[2].rev > wk[1].rev && wk[1].rev > wk[0].rev)
      found.push({ ean: ean, kind: 'trend_down', severity: 'warn', metric: { weken: [nRound(wk[2].rev), nRound(wk[1].rev), nRound(wk[0].rev)] }, baseline: {} });
    // ads-verspilling (14d, productniveau; keyword-niveau zit in de app-drill)
    const last14 = rows.filter(function (r) { return r.d > nDate(yday, -14); });
    const clicks14 = sum(last14, 'ads_clicks'), cost14 = sum(last14, 'ads_cost'), adsSales14 = sum(last14, 'ads_sales');
    if (enoughHistory && clicks14 >= NCFG.wasteClicks && adsSales14 === 0)
      found.push({ ean: ean, kind: 'ads_waste', severity: 'warn', metric: { clicks14: clicks14, cost14: nRound(cost14) }, baseline: { reden: 'klikken zonder ads-omzet' } });
    else if (enoughHistory && cost14 >= NCFG.wasteMinCost && adsSales14 > 0 && (cost14 / adsSales14 * 100) > tAcos * NCFG.acosFactor)
      found.push({ ean: ean, kind: 'ads_waste', severity: 'warn', metric: { acos14: nRound(cost14 / adsSales14 * 100), cost14: nRound(cost14) }, baseline: { doelAcos: tAcos } });
    // voorraad (secundair)
    const lastRow = rows[rows.length - 1] || {};
    const stockNow = (nNum(lastRow.stock_lvb) + nNum(lastRow.stock_fbr));
    const units28 = sum(rows, 'units');
    if (stockNow === 0 && units28 >= 10)
      found.push({ ean: ean, kind: 'stock_risk', severity: 'critical', metric: { voorraad: 0, verkocht28d: units28 }, baseline: {} });
    else if (enoughHistory && supplier && units28 > 0) {
      const sup = supplier[ean] || (supplier.items && supplier.items[ean]);
      const lead = sup ? nNum(sup.leadDays || sup.leadtime || sup.levertijd) : 0;
      const daysLeft = stockNow / (units28 / 28);
      if (lead > 0 && daysLeft < lead) found.push({ ean: ean, kind: 'stock_risk', severity: daysLeft < lead / 2 ? 'warn' : 'info', metric: { dagenVoorraad: Math.round(daysLeft) }, baseline: { levertijdDagen: lead } });
    }
  });

  // ontdubbel t.o.v. open signalen
  const fresh = found.filter(function (s) { return !openKey[(s.ean || '') + '|' + s.kind]; });

  // AI-tips (één batch-call); fallback = sjabloon
  const tipFallback = {
    conversion_drop: 'Check prijs vs concurrentie, hoofdfoto en recente reviews; overweeg tijdelijke sponsored-boost.',
    visits_drop: 'Vindbaarheid herstellen: keywords in titel/bullets checken en sponsored-druk op dit EAN verhogen.',
    visits_rise: 'Momentum benutten: voorraad checken en overwegen het bod iets te verhogen.',
    trend_up: 'Analyseer wat er veranderd is (logboek) en schaal wat werkt.',
    trend_down: 'Vergelijk met logboek-events; content en prijs herzien.',
    ads_waste: 'Bod verlagen of pauzeren; zoektermen met 0 conversies als negatief keyword toevoegen (zie ads-drill).',
    stock_risk: 'Supply chain informeren; bij 0 voorraad de sponsored ads pauzeren.'
  };
  fresh.forEach(function (s) { s.tip = tipFallback[s.kind] || ''; s.d = yday; s.status = 'new'; });
  if (fresh.length && env.ANTHROPIC_KEY) {
    const payload = fresh.map(function (s, i) { return { i: i, product: name(s.ean), kind: s.kind, severity: s.severity, metric: s.metric, baseline: s.baseline }; });
    const txt = await nClaude(env,
      'Je bent de bol-agent van Wellshave (scheerapparaten/trimmers op bol.com). Geef per signaal één concrete, direct uitvoerbare tip in het Nederlands (max 2 zinnen). Prioriteit: listingkwaliteit en vindbaarheid; voorraad is secundair. Antwoord ALLEEN met een JSON-array [{"i":0,"tip":"..."}].',
      JSON.stringify(payload), 1200);
    const arr = nJsonArr(txt);
    if (arr) arr.forEach(function (t) { if (fresh[t.i] && t.tip) fresh[t.i].tip = String(t.tip).slice(0, 400); });
  }
  if (fresh.length) await sbSvc(env, 'POST', 'signals', fresh, 'return=minimal');
  st.data.newSignals = fresh.map(function (s) { return { ean: s.ean, product: name(s.ean), kind: s.kind, severity: s.severity, tip: s.tip }; });
  st.log.push('signalen: ' + fresh.length + ' nieuw (' + found.length + ' gedetecteerd)');
}

/* ================= BRAIN ================= */
async function nBrain(env, st) {
  const yday = st.date;
  const evFrom = nDate(yday, -NCFG.brainMaxAgeDays), evTo = nDate(yday, -NCFG.brainMinAgeDays);
  const events = await sbSvc(env, 'GET', 'events?select=id,ts,ean,type,before,after,detail&ts=gte.' + evFrom + '&ts=lte.' + evTo + 'T23:59:59Z&order=ts.asc') || [];
  if (!events.length) { st.log.push('brain: geen events in venster'); return; }
  const done = await sbSvc(env, 'GET', 'findings?select=event_id') || [];
  const doneIds = {}; done.forEach(function (f) { doneIds[f.event_id] = 1; });
  const todo = events.filter(function (e) { return !doneIds[e.id]; }).slice(0, NCFG.brainMaxPerNight);
  if (!todo.length) { st.log.push('brain: alles al geanalyseerd'); return; }

  const snapFrom = nDate(yday, -(NCFG.brainMaxAgeDays + 8));
  const snaps = await sbSvc(env, 'GET', 'daily_snapshots?select=d,ean,visits,conversion,orders,revenue,ads_cost,ads_sales,acos,tacos&d=gte.' + snapFrom + '&order=d.asc') || [];
  const agg = function (ean, from, to) {
    const rows = snaps.filter(function (r) { return (!ean || r.ean === ean) && r.d >= from && r.d <= to; });
    const s = { visits: 0, orders: 0, revenue: 0, ads_cost: 0, ads_sales: 0, days: {} };
    rows.forEach(function (r) { s.visits += nNum(r.visits); s.orders += nNum(r.orders); s.revenue += nNum(r.revenue); s.ads_cost += nNum(r.ads_cost); s.ads_sales += nNum(r.ads_sales); s.days[r.d] = 1; });
    s.conversion = s.visits > 0 ? nRound(s.orders / s.visits * 100) : null;
    s.acos = s.ads_sales > 0 ? nRound(s.ads_cost / s.ads_sales * 100) : null;
    s.revenue = nRound(s.revenue); s.ads_cost = nRound(s.ads_cost);
    s.nDays = Object.keys(s.days).length; delete s.days;
    return s;
  };

  const items = todo.map(function (e) {
    const evDate = String(e.ts).slice(0, 10);
    const before = agg(e.ean, nDate(evDate, -7), nDate(evDate, -1));
    const after = agg(e.ean, nDate(evDate, 1), nDate(evDate, 7));
    return { event: e, before: before, after: after };
  }).filter(function (it) { return it.before.nDays >= 3 && it.after.nDays >= 3; });
  if (!items.length) { st.log.push('brain: te weinig snapshot-dagen rond events'); return; }

  const payload = items.map(function (it, i) {
    return { i: i, type: it.event.type, ean: it.event.ean, before_waarde: it.event.before, after_waarde: it.event.after, week_voor: it.before, week_na: it.after };
  });
  const txt = await nClaude(env,
    'Je bent de super-brain van het Wellshave bol OS. Per event: vergelijk de week vóór en na, en schrijf een korte Nederlandse narrative in de stijl "duidelijk met voorbehoud" — bv. "Sinds de prijsverlaging op 2 juli: conversie +0,6pp. Waarschijnlijk hierdoor; seizoen kan meespelen." Wees eerlijk als het effect onduidelijk is. Antwoord ALLEEN met JSON-array [{"i":0,"narrative":"...","confidence":"hoog|middel|laag"}].',
    JSON.stringify(payload), 1600);
  const arr = nJsonArr(txt) || [];
  const findings = items.map(function (it, i) {
    const a = arr.find(function (x) { return x.i === i; }) || {};
    const delta = {
      conversie_pp: (it.after.conversion != null && it.before.conversion != null) ? nRound(it.after.conversion - it.before.conversion) : null,
      omzet_pct: it.before.revenue > 0 ? nRound((it.after.revenue - it.before.revenue) / it.before.revenue * 100) : null,
      visits_pct: it.before.visits > 0 ? nRound((it.after.visits - it.before.visits) / it.before.visits * 100) : null,
      acos_pp: (it.after.acos != null && it.before.acos != null) ? nRound(it.after.acos - it.before.acos) : null
    };
    return {
      event_id: it.event.id, window_before: it.before, window_after: it.after, metrics_delta: delta,
      narrative: a.narrative || ('Voor/na: omzet ' + (delta.omzet_pct != null ? delta.omzet_pct + '%' : '?') + ', conversie ' + (delta.conversie_pp != null ? delta.conversie_pp + 'pp' : '?') + ' (automatisch, zonder AI-duiding).'),
      confidence: a.confidence || 'laag'
    };
  });
  await sbSvc(env, 'POST', 'findings', findings, 'return=minimal');
  st.log.push('brain: ' + findings.length + ' findings');
}

/* ================= SLACK-DIGEST ================= */
async function nDigest(env, st) {
  const yday = st.date;
  const sig = st.data.newSignals || [];
  const sev = { critical: '🔴', warn: '🟠', info: '🟢' };
  const kindNl = { conversion_drop: 'conversie ↓', visits_drop: 'bezoek ↓', visits_rise: 'bezoek ↑', trend_up: 'trend ↑', trend_down: 'trend ↓', ads_waste: 'ads-verspilling', stock_risk: 'voorraad' };

  // omzet-kop
  let head = '';
  try {
    const rows = await sbSvc(env, 'GET', 'daily_snapshots?select=revenue,ads_cost&d=eq.' + yday) || [];
    const rev = rows.reduce(function (s, r) { return s + nNum(r.revenue); }, 0);
    const cost = rows.reduce(function (s, r) { return s + nNum(r.ads_cost); }, 0);
    head = 'Omzet gisteren: €' + rev.toFixed(2) + ' · ads: €' + cost.toFixed(2);
  } catch (e) { }

  const lines = sig.slice(0, 12).map(function (s) { return (sev[s.severity] || '•') + ' *' + s.product + '* — ' + (kindNl[s.kind] || s.kind) + (s.tip ? '\n    ↳ ' + s.tip : ''); });
  const digest = '*📡 Radar-digest ' + yday + '*\n' + head + '\n' + (lines.length ? lines.join('\n') : 'Geen nieuwe signalen — alles binnen de baselines.') + '\n\nBekijk: https://bol-os.netlify.app (Radar)';
  await nSlack(env, digest);

  const crits = sig.filter(function (s) { return s.severity === 'critical'; });
  if (crits.length) {
    await nSlack(env, '🚨 *Kritiek* — directe aandacht nodig:\n' + crits.map(function (s) { return '• *' + s.product + '*: ' + (kindNl[s.kind] || s.kind) + (s.tip ? ' — ' + s.tip : ''); }).join('\n'));
  }

  // maandag: week-samenvatting (welke acties aantoonbaar werkten)
  const isMonday = new Date(yday + 'T12:00:00Z').getUTCDay() === 0; /* yday=zondag → vandaag=maandag */
  if (isMonday) {
    try {
      const wkFrom = nDate(yday, -6);
      const f = await sbSvc(env, 'GET', 'findings?select=narrative,confidence,created_at&created_at=gte.' + wkFrom + '&order=created_at.desc&limit=10') || [];
      const ev = await sbSvc(env, 'GET', 'events?select=type,ean,ts&ts=gte.' + wkFrom + '&order=ts.desc&limit=30') || [];
      const sg = await sbSvc(env, 'GET', 'signals?select=kind,severity&d=gte.' + wkFrom) || [];
      let txt = null;
      if (env.ANTHROPIC_KEY) {
        txt = await nClaude(env,
          'Schrijf een korte Nederlandse week-samenvatting (max 10 regels) voor het Wellshave-team over hun bol.com-prestaties: welke acties aantoonbaar werkten (uit findings), welke signalen speelden, en 1-2 focuspunten voor komende week. Toon: duidelijk met voorbehoud. Alleen platte tekst met • bullets.',
          JSON.stringify({ findings: f, events_count: ev.length, event_types: ev.map(function (e) { return e.type; }), signalen: sg }), 900);
      }
      await nSlack(env, '*🗓 Weekoverzicht*\n' + (txt || ('Deze week: ' + ev.length + ' events, ' + sg.length + ' signalen, ' + f.length + ' brain-findings. Zie het OS voor detail.')));
    } catch (e) { }
  }
}
