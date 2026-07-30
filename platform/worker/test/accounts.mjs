/* Testlus voor 0014 in de runtime — vijf accounts in plaats van één.
 *
 * De databasekant staat in platform/db/test/accounts.sh. Hier gaat het om drie
 * dingen die alleen in de worker misgaan:
 *
 *   1. Haalt hij álle draaiende accounts op, of stiekem alleen de eerste.
 *   2. Neemt één account dat weigert de rest mee omlaag.
 *   3. Belandt een Wellshine-creative in het Wellshave-account.
 *
 * Dat laatste is de enige van de drie die geld kost en niet terug te draaien
 * is: een advertentie in het verkeerde account haal je met geen enkele query
 * meer weg.
 *
 *   node platform/worker/test/accounts.mjs
 */

import worker from '../marketing-os.worker.js';

let wellshineWeigert = false;

const db = {
  agents: [{ id: 'atlas', name: 'Atlas', status: 'idle' }, { id: 'bolt', name: 'Bolt', status: 'idle' }],
  schedules: [], agent_jobs: [], agent_runs: [], agent_events: [], reports: [],
  meta_publications: [], approvals: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }],
  ad_accounts: [
    { account_id: '242238038391551',  naam: 'Wellshave®',     merk: 'wellshave', actief: true,  primair: true },
    { account_id: '2776743939329385', naam: 'Wellshine B.V.', merk: 'wellshine', actief: true,  primair: true },
    { account_id: '1301619051500441', naam: 'Wellshine',      merk: 'wellshine', actief: false, primair: false }
  ],
  creatives: [
    { id: 7, brand: 'wellshine', ad_name: 'Wellshine test', image_b64: 'AAAA', has_image: true,
      status: 'To Test', hook_short: 'Hook', marketing_angle: 'Hoek' },
    { id: 8, brand: 'peppermint', ad_name: 'Onbekend merk', image_b64: 'AAAA', has_image: true,
      status: 'To Test', hook_short: 'Hook', marketing_angle: 'Hoek' }
  ]
};
let volgendeId = 1;
let teKlaarzetten = 7;
const claudeAanroepen = [], metaPaden = [];

function tabelUit(url) { const m = url.match(/\/rest\/v1\/([a-z_]+)/); return m ? m[1] : null; }
function defaults(t) {
  if (t === 'agent_jobs') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  if (t === 'agent_runs') return { status: 'running' };
  if (t === 'agent_events') return { level: 'info' };
  return {};
}

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });
  if (url.includes('/rest/v1/rpc/claim_job')) {
    const j = db.agent_jobs.find(x => x.status === 'queued' && new Date(x.scheduled_for) <= new Date());
    if (!j) return ok(null);
    j.status = 'running'; j.attempts++; j.locked_at = new Date().toISOString();
    return ok(j);
  }
  if (url.includes('/rest/v1/rpc/reap_stuck_jobs')) return ok(0);

  if (url.includes('/rest/v1/')) {
    const tabel = tabelUit(url);
    if (!db[tabel]) db[tabel] = [];
    if (methode === 'POST') {
      const rijen = JSON.parse(opts.body).map(r => ({ id: volgendeId++, created_at: new Date().toISOString(), ...defaults(tabel), ...r }));
      db[tabel].push(...rijen);
      return ok(rijen);
    }
    if (methode === 'PATCH') {
      const patch = JSON.parse(opts.body);
      const idM = url.match(/id=eq\.([^&]+)/);
      const doelen = idM ? db[tabel].filter(r => String(r.id) === idM[1]) : db[tabel];
      doelen.forEach(r => Object.assign(r, patch));
      return ok(doelen);
    }
    /* Genoeg PostgREST om de filters te volgen die 0014 gebruikt: actief en
       merk. Zonder die twee zou de test elke resolutie laten slagen en dus
       niets bewijzen. */
    let rijen = db[tabel];
    if (/actief=is\.true/.test(url)) rijen = rijen.filter(r => r.actief);
    const merkM = url.match(/merk=eq\.([^&]+)/);
    if (merkM) rijen = rijen.filter(r => r.merk === decodeURIComponent(merkM[1]));
    const idM = url.match(/[?&]id=eq\.([^&]+)/);
    if (idM) rijen = rijen.filter(r => String(r.id) === idM[1]);
    const statusM = url.match(/status=eq\.([^&]+)/);
    if (statusM) rijen = rijen.filter(r => r.status === statusM[1]);
    return ok(rijen);
  }

  if (url.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    claudeAanroepen.push(body);
    const beurt = Math.floor(body.messages.length / 2) + 1;
    const usage = { input_tokens: 1000, output_tokens: 200 };

    /* Bolt zet klaar, Atlas meet. Welke van de twee aan het woord is, staat in
       de systeeminstructie. */
    if (body.system && body.system.includes('Je bent Bolt')) {
      if (beurt === 1) {
        return ok({ stop_reason: 'tool_use', usage, content: [{
          type: 'tool_use', id: 'p1', name: 'meta_prepare_ad',
          input: { creative_id: teKlaarzetten, hypothese: 'als we X, dan Y, omdat Z' }
        }] });
      }
      return ok({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Klaargezet.' }] });
    }

    if (beurt === 1) {
      return ok({ stop_reason: 'tool_use', usage,
        content: [{ type: 'tool_use', id: 't1', name: 'meta_insights', input: { level: 'account', days: 30 } }] });
    }
    if (beurt === 2) {
      return ok({ stop_reason: 'tool_use', usage,
        content: [{ type: 'tool_use', id: 't2', name: 'write_report', input: {
          kind: 'audit', title: 'Audit', body_md: '# Audit',
          periode_start: '2026-06-30', periode_eind: '2026-07-29',
          cijfers: { accounts: 2 } } }] });
    }
    return ok({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Twee accounts gemeten.' }] });
  }

  if (url.includes('graph.facebook.com')) {
    const pad = url.split('graph.facebook.com/')[1].split('?')[0];
    metaPaden.push(pad);
    const accM = pad.match(/act_(\d+)/);
    const acc = accM ? accM[1] : null;
    if (pad.includes('2776743939329385') && wellshineWeigert) {
      return ok({ error: { message: 'Unsupported get request. Object does not exist or you lack permission' } });
    }
    if (pad.endsWith('/adimages')) return ok({ images: { a: { hash: 'hash_' + acc } } });
    if (pad.endsWith('/adcreatives')) return ok({ id: 'creative_999' });
    if (pad.includes('/insights')) {
      return ok({ data: [{ date_start: '2026-07-28', spend: acc === '242238038391551' ? '3425.92' : '1207.74',
        impressions: '88000', clicks: '1400', actions: [{ action_type: 'purchase', value: '31' }],
        action_values: [{ action_type: 'purchase', value: '1655.20' }] }] });
    }
    return ok({ data: [] });
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

const env = { ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551',
  META_PAGE_ID: '123', META_ADSET_ID: '456' };
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};
const uitkomstVan = (aanroep, id) => {
  for (const b of aanroep.messages) {
    if (!Array.isArray(b.content)) continue;
    const r = b.content.find(c => c.type === 'tool_result' && c.tool_use_id === id);
    if (r) return JSON.parse(r.content);
  }
  return null;
};

/* ── Health ──────────────────────────────────────────────────────────────── */
console.log('\n  health vertelt welke accounts meetellen');
const gezond = await (await worker.fetch(new Request('https://w/health'), env)).json();
check('twee draaiende accounts', gezond.accounts.length, 2);
check('met hun merk erbij', gezond.accounts.map(a => a.merk).sort(), ['wellshave', 'wellshine']);
check('en geen noodrem', gezond.accounts.every(a => !a.noodrem), true);

/* ── Meten over alle accounts ────────────────────────────────────────────── */
console.log('\n  meten gaat over alle draaiende accounts');
await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'atlas', kind: 'account_audit' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 50));

const gemeten = uitkomstVan(claudeAanroepen[1], 't1');
check('beide accounts opgehaald', gemeten.accounts, 2);
check('het stille account is overgeslagen',
  gemeten.per_account.some(a => a.account_id === '1301619051500441'), false);
check('en de cijfers staan per account apart',
  db.meta_insights_daily.map(r => r.account_id).sort(),
  ['242238038391551', '2776743939329385']);
check('met verschillende bedragen, dus niet twee keer hetzelfde account',
  db.meta_insights_daily.map(r => r.spend).sort(), [1207.74, 3425.92]);

/* ── Eén account dat weigert ─────────────────────────────────────────────── */
console.log('\n  één account dat weigert neemt de rest niet mee');
wellshineWeigert = true;
db.agent_jobs.length = 0; db.agent_runs.length = 0; claudeAanroepen.length = 0;
db.meta_insights_daily.length = 0; db.reports.length = 0;
await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'atlas', kind: 'account_audit' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 50));

const half = uitkomstVan(claudeAanroepen[1], 't1');
check('Wellshave is gewoon gemeten', half.accounts, 1);
check('Wellshine staat als gat', half.gaten.length, 1);
check('met de naam erbij, niet alleen een id', half.gaten[0].naam, 'Wellshine B.V.');
check('de run loopt door', db.agent_jobs[0].status, 'done');
check('en er is een rapport', db.reports.length, 1);
wellshineWeigert = false;

/* ── Publiceren volgt het merk ───────────────────────────────────────────── */
console.log('\n  publiceren volgt het merk van de creative');
metaPaden.length = 0; claudeAanroepen.length = 0;
db.agent_jobs.length = 0; db.agent_runs.length = 0;
teKlaarzetten = 7;
await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'bolt', kind: 'publish_queue' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 60));

const upload = metaPaden.find(p => p.endsWith('/adimages'));
check('een wellshine-creative gaat naar het Wellshine-account',
  (upload.match(/act_(\d+)/) || [])[1], '2776743939329385');
check('en niet naar het account uit het secret',
  metaPaden.some(p => p.includes('act_242238038391551')), false);

/* Het onbekende merk. Terugvallen op een standaardaccount zou hier het
   makkelijkst zijn en het duurst: een advertentie in het verkeerde account is
   niet terug te draaien. */
console.log('\n  een merk zonder account wordt geweigerd');
metaPaden.length = 0; claudeAanroepen.length = 0;
db.agent_jobs.length = 0; db.agent_runs.length = 0; db.meta_publications.length = 0;
teKlaarzetten = 8;
await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'bolt', kind: 'publish_queue' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 60));

check('er is niets naar Meta gegaan', metaPaden.length, 0);
check('er is geen publicatie aangemaakt', db.meta_publications.length, 0);
const mis = uitkomstVan(claudeAanroepen[1], 'p1');
check('en de fout noemt het merk', String(mis.error).includes('peppermint'), true);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
