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
  schedules: [], taken: [], taak_runs: [], systeem_events: [],
  meta_insights_daily: [], meta_meetgaten: [], meta_meetdekking: [],
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
  if (t === 'taken') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  if (t === 'taak_runs') return { status: 'running' };
  if (t === 'systeem_events') return { level: 'info' };
  return {};
}

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });
  if (url.includes('/rest/v1/rpc/claim_taak')) {
    const j = db.taken.find(x => x.status === 'queued' && new Date(x.scheduled_for) <= new Date());
    if (!j) return ok(null);
    j.status = 'running'; j.attempts++; j.locked_at = new Date().toISOString();
    return ok(j);
  }
  if (url.includes('/rest/v1/rpc/maak_vastgelopen_taken_vrij')) return ok(0);

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

  /* Geen Anthropic-tak meer. De accounts worden nu doorlopen door
     meta_inhaalslag en door het klaarzet-endpoint, allebei zonder model.
     Komt hier toch een aanroep, dan hoort deze test te klappen. */

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
console.log('\n  welke accounts meetellen staat achter de login');
/* /health is open. Daar hoort niets over het bedrijf erachter te staan: geen
   accountnummers, geen merknamen, en geen databasecall bij elke aanroep. */
const gezond = await (await worker.fetch(new Request('https://w/health'), env)).json();
check('health zegt dat de runtime draait', gezond.runtime, 'actief');
check('maar lekt geen accountgegevens', gezond.accounts, undefined);
check('en noemt geen enkel accountnummer',
  JSON.stringify(gezond).includes('2776743939329385'), false);

const zonderLogin = await worker.fetch(new Request('https://w/systeem/status'), env);
check('de accountlijst vraagt een login', zonderLogin.status, 401);

const statusIn = await (await worker.fetch(new Request('https://w/systeem/status', auth), env)).json();
check('ingelogd staan er twee draaiende accounts', statusIn.accounts.length, 2);
check('met hun merk erbij', statusIn.accounts.map(a => a.merk).sort(), ['wellshave', 'wellshine']);
check('en geen noodrem', statusIn.accounts.every(a => !a.noodrem), true);

/* ── Meten over alle accounts ────────────────────────────────────────────── */
console.log('\n  meten gaat over alle draaiende accounts');

const HET_GAT = [{ account_id: null, brand: 'wellshave',
                   van: '2026-06-30', tot: '2026-07-01', dagen: 2 }];

const meet = async () => {
  db.taken.length = 0; db.taak_runs.length = 0;
  db.meta_insights_daily.length = 0; db.systeem_events.length = 0;
  db.meta_meetgaten = HET_GAT;
  db.meta_meetdekking = [{ brand: 'wellshave', dagen_ontbreken: 0 }];
  await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
    body: JSON.stringify({ kind: 'meta_inhaalslag' }) }), env);
  await worker.fetch(new Request('https://w/systeem/tick', { method: 'POST', ...auth }), env);
  await new Promise(r => setTimeout(r, 60));
  return db.taak_runs[db.taak_runs.length - 1];
};

let run = await meet();
check('het stille account is overgeslagen',
  db.meta_insights_daily.some(r => r.account_id === '1301619051500441'), false);
check('en de cijfers staan per account apart',
  [...new Set(db.meta_insights_daily.map(r => r.account_id))].sort(),
  ['242238038391551', '2776743939329385']);
check('met verschillende bedragen, dus niet twee keer hetzelfde account',
  [...new Set(db.meta_insights_daily.map(r => r.spend))].sort((x, y) => x - y), [1207.74, 3425.92]);

/* ── Eén account dat weigert ─────────────────────────────────────────────── */
console.log('\n  één account dat weigert neemt de rest niet mee');
wellshineWeigert = true;
run = await meet();
check('Wellshave is gewoon gemeten',
  db.meta_insights_daily.some(r => r.account_id === '242238038391551'), true);
check('Wellshine leverde niets',
  db.meta_insights_daily.some(r => r.account_id === '2776743939329385'), false);
/* Het gat moet luid zijn. Stil doorgaan is precies de storing waar 0049 over
   ging: dan ziet de meting er compleet uit terwijl er een account ontbreekt. */
check('en dat staat als waarschuwing in het logboek',
  db.systeem_events.some(e => e.level === 'warn' && /Wellshine/.test(e.message)), true);
check('de run loopt door', db.taken[0].status, 'done');
wellshineWeigert = false;

/* ── Publiceren volgt het merk ───────────────────────────────────────────── */
console.log('\n  publiceren volgt het merk van de creative');
const klaarzetten = async (creativeId) => {
  metaPaden.length = 0;
  db.meta_publications.length = 0;
  return (await worker.fetch(new Request('https://w/systeem/publicaties/klaarzetten', {
    method: 'POST', ...auth,
    body: JSON.stringify({ creative_id: creativeId, adset_id: '120252206157150577',
                           hypothesis: 'als we X, dan Y, omdat Z' })
  }), env)).json();
};

await klaarzetten(7);
const upload = metaPaden.find(p => p.endsWith('/adimages'));
check('een wellshine-creative gaat naar het Wellshine-account',
  (upload.match(/act_(\d+)/) || [])[1], '2776743939329385');
check('en niet naar het account uit het secret',
  metaPaden.some(p => p.includes('act_242238038391551')), false);

/* Het onbekende merk. Terugvallen op een standaardaccount zou hier het
   makkelijkst zijn en het duurst: een advertentie in het verkeerde account is
   niet terug te draaien. */
console.log('\n  een merk zonder account wordt geweigerd');
const mis = await klaarzetten(8);
check('er is niets naar Meta gegaan', metaPaden.length, 0);
check('er is geen publicatie aangemaakt', db.meta_publications.length, 0);
check('en de fout noemt het merk', String(mis.error).includes('peppermint'), true);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
