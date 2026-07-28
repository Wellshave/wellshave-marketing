/* ============================================================
 * Rory's dagelijkse check — Meta-agent routine
 *
 * Draait elke ochtend (bv 07:00) via een RemoteTrigger cloud-routine
 * of een Cloudflare Worker Cron Trigger. Doet:
 *   1. Haalt per actieve ad de Meta Ads-metrics op (laatste 7 dagen).
 *   2. Laat Claude Fable 5 elke ad classificeren: Winner / Test / Loser
 *      + advies (scale / iterate / copy / new / pause) met onderbouwing.
 *   3. Schrijft de aanbevelingen naar Supabase (rory_recommendations).
 *   4. Het Bibliotheek-scherm ("Rory's dagelijkse check") leest die tabel.
 *
 * Benodigde env-vars / secrets:
 *   META_ACCESS_TOKEN     Long-lived token van de Meta Business (ads_read)
 *   META_AD_ACCOUNT_ID    bv 'act_1234567890'
 *   ANTHROPIC_PROXY_URL   dezelfde team-proxy als de app (…/anthropic)
 *   SUPABASE_URL          https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (server-side; NIET in de browser)
 *   ROAS_WINNER           drempel Winner (default 3.5)
 *   ROAS_LOSER            drempel Loser (default 2.5)
 *
 * Fable 5-regels: model 'claude-fable-5', geen thinking-param, effort via
 * output_config, JSON via output_config.format, refusal-fallback → opus-4-8.
 * ============================================================ */

const META_API = 'https://graph.facebook.com/v21.0';

const CFG = {
  metaToken:  env('META_ACCESS_TOKEN'),
  adAccount:  env('META_AD_ACCOUNT_ID'),
  proxyUrl:   env('ANTHROPIC_PROXY_URL'),
  sbUrl:      env('SUPABASE_URL'),
  sbKey:      env('SUPABASE_SERVICE_KEY'),
  winner:     parseFloat(env('ROAS_WINNER') || '3.5'),
  loser:      parseFloat(env('ROAS_LOSER')  || '2.5'),
};

function env(k) {
  // werkt zowel in Cloudflare Workers (globalThis[k] via binding) als Node (process.env)
  if (typeof process !== 'undefined' && process.env && process.env[k] != null) return process.env[k];
  if (typeof globalThis !== 'undefined' && globalThis[k] != null) return globalThis[k];
  return null;
}

/* ---------- 1. Meta Ads-metrics ophalen ---------- */
async function fetchMetaInsights() {
  // Per-ad insights, laatste 7 dagen. Velden spiegelen de Itereren-matrix.
  const fields = [
    'ad_id', 'ad_name', 'spend', 'impressions', 'cpm',
    'inline_link_clicks', 'outbound_clicks', 'ctr', 'cpc',
    'actions', 'action_values', 'purchase_roas'
  ].join(',');
  const url = `${META_API}/${CFG.adAccount}/insights`
    + `?level=ad&date_preset=last_7d&limit=200`
    + `&fields=${encodeURIComponent(fields)}`
    + `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'ad.effective_status', operator: 'IN', value: ['ACTIVE'] }]))}`
    + `&access_token=${CFG.metaToken}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error('Meta: ' + j.error.message);
  return (j.data || []).map(normalizeMetric);
}

function normalizeMetric(d) {
  const roas = num(firstVal(d.purchase_roas));
  const findAction = (t) => num((d.actions || []).find(a => a.action_type === t)?.value);
  const findValue  = (t) => num((d.action_values || []).find(a => a.action_type === t)?.value);
  const purchases  = findAction('purchase') || findAction('omni_purchase');
  const purchaseValue = findValue('purchase') || findValue('omni_purchase');
  return {
    metaAdId: d.ad_id, adName: d.ad_name,
    spend: num(d.spend), impressions: num(d.impressions), cpm: num(d.cpm),
    linkClicks: num(d.inline_link_clicks), clicksOutbound: num(firstVal(d.outbound_clicks)),
    ctr: num(d.ctr), cpc: num(d.cpc),
    purchases, purchaseValue, roas,
    cpa: purchases ? +(num(d.spend) / purchases).toFixed(2) : null,
    atc: findAction('add_to_cart'), lpv: findAction('landing_page_view'),
  };
}
function firstVal(x){ return Array.isArray(x) ? (x[0] && (x[0].value ?? x[0])) : x; }
function num(x){ const n = parseFloat(x); return isNaN(n) ? null : n; }

/* ---------- 2. Fable 5 laten oordelen ---------- */
const RORY_SYSTEM =
  'Je bent Rory — strateeg à la Rory Sutherland, met de scherpte van een direct-response media buyer. '
  + 'Je beoordeelt Meta-advertenties op basis van hun cijfers en geeft één concreet, uitvoerbaar advies. '
  + 'Merk: Wellgroup (DTC grooming). Wees direct en onderbouwd; geen fluff.';

const REC_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['Winner', 'Test', 'Loser'] },
    action:  { type: 'string', enum: ['scale', 'iterate', 'copy', 'new', 'pause'] },
    reasoning: { type: 'string' }
  },
  required: ['verdict', 'action', 'reasoning']
};

async function judge(metric) {
  // Voorclassificatie op ROAS-drempels; Fable 5 verfijnt en onderbouwt.
  const pre = metric.roas == null ? 'onbekend'
    : metric.roas >= CFG.winner ? 'Winner'
    : metric.roas < CFG.loser ? 'Loser' : 'Test';
  const user = `Ad "${metric.adName}". Cijfers (7 dagen): ROAS ${fmt(metric.roas)}, CTR ${fmt(metric.ctr)}%, `
    + `CPA ${fmt(metric.cpa)}, spend €${fmt(metric.spend)}, aankopen ${fmt(metric.purchases)}, CPM €${fmt(metric.cpm)}. `
    + `Voorlopige classificatie op ROAS-drempels (winner ≥ ${CFG.winner}, loser < ${CFG.loser}): ${pre}. `
    + `Geef het eindoordeel (Winner/Test/Loser), één actie (scale/iterate/copy/new/pause) en een korte onderbouwing van max 2 zinnen.`;
  try {
    const body = {
      model: 'claude-fable-5',
      max_tokens: 600,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: REC_SCHEMA } },
      fallbacks: [{ model: 'claude-opus-4-8' }],
      system: RORY_SYSTEM,
      messages: [{ role: 'user', content: user }]
    };
    const r = await fetch(CFG.proxyUrl.replace(/\/+$/, '') + '/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-06-01' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (data.stop_reason === 'refusal') throw new Error('refusal');
    let txt = '';
    (data.content || []).forEach(b => { if (b.type === 'text') txt += b.text; });
    return JSON.parse(txt);
  } catch (e) {
    // Val terug op de puur-numerieke classificatie als Fable 5 onbereikbaar is.
    return {
      verdict: pre === 'onbekend' ? 'Test' : pre,
      action: pre === 'Winner' ? 'scale' : pre === 'Loser' ? 'pause' : 'iterate',
      reasoning: 'Automatische classificatie op ROAS-drempel (Fable 5 onbereikbaar).'
    };
  }
}
function fmt(x){ return x == null ? '—' : x; }

/* ---------- 3. Wegschrijven naar Supabase ---------- */
async function saveRecommendations(rows) {
  const url = CFG.sbUrl.replace(/\/+$/, '') + '/rest/v1/rory_recommendations';
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: CFG.sbKey, Authorization: 'Bearer ' + CFG.sbKey,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error('Supabase insert: ' + (await r.text()).slice(0, 200));
}

/* ---------- hoofdroutine ---------- */
async function run() {
  const missing = ['metaToken', 'adAccount', 'proxyUrl', 'sbUrl', 'sbKey'].filter(k => !CFG[k]);
  if (missing.length) throw new Error('Ontbrekende env-vars: ' + missing.join(', '));

  const metrics = await fetchMetaInsights();
  const rows = [];
  for (const m of metrics) {
    const j = await judge(m);
    rows.push({
      meta_ad_id: m.metaAdId, ad_name: m.adName,
      roas: m.roas, ctr: m.ctr, cpa: m.cpa, spend: m.spend,
      verdict: j.verdict, action: j.action, reasoning: j.reasoning,
      metrics: m
    });
  }
  if (rows.length) await saveRecommendations(rows);
  return { checked: metrics.length, saved: rows.length };
}

/* ---------- entrypoints ---------- */
// Cloudflare Worker Cron Trigger:
export default {
  async scheduled(event, envBindings, ctx) {
    Object.assign(globalThis, envBindings); // secrets als globals beschikbaar maken voor env()
    const res = await run();
    console.log('rory-daily-check:', JSON.stringify(res));
  },
  // handmatige HTTP-trigger om te testen: GET /run
  async fetch(request, envBindings) {
    Object.assign(globalThis, envBindings);
    try { return new Response(JSON.stringify(await run()), { headers: { 'Content-Type': 'application/json' } }); }
    catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
  }
};

// Node / RemoteTrigger:
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('rory-daily-check.routine.js')) {
  run().then(r => { console.log('rory-daily-check:', r); }).catch(e => { console.error(e); process.exit(1); });
}
