/* Testlus voor de auditopdracht — de runtimekant van migratie 0013.
 *
 * Het rekenwerk staat in platform/db/test/audit.sh, tegen een echte Postgres
 * en met de werkelijke cijfers van Wellshave®. Hier gaat het om wat de runtime
 * eromheen doet: haalt Atlas de uitsplitsing naar publiek op, komt hij netjes
 * door een Meta die die uitsplitsing weigert, en meldt hij dat dan als gat in
 * plaats van het weg te laten.
 *
 *   node platform/worker/test/audit.mjs
 */

import worker from '../marketing-os.worker.js';

/* De uitsplitsing is niet op elk account beschikbaar. Deze schakelaar laat
   Meta hem één keer weigeren, zodat de weg omlaag ook gelopen wordt. */
let publiekWerkt = true;

const db = {
  agents: [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
  schedules: [], agent_jobs: [], agent_runs: [], agent_events: [], reports: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }],
  /* Wat de views zouden teruggeven — de uitkomsten uit audit.sh. */
  trechter: [
    { entity_id: '120250501609280577', entity_name: 'Advertorial Pages', lpv_naar_atc_pct: 8.72,
      atc_naar_ic_pct: 37.59, ic_naar_aankoop_pct: 86.00, roas: 2.109, cpa: 27.17,
      zwakste_stap: 'winkelwagen naar checkout', waarschuwing: null },
    { entity_id: '120252205202730577', entity_name: '001 - CBO - GroomGuard', lpv_naar_atc_pct: 4.19,
      atc_naar_ic_pct: 90.00, ic_naar_aankoop_pct: 55.56, roas: 1.036, cpa: 53.56,
      zwakste_stap: 'checkout naar aankoop',
      waarschuwing: 'ViewContent vuurt nauwelijks (37 op 477 landingspagina-weergaven) — pixel controleren voordat je hier iets uit afleidt' }
  ],
  publiek_verzadiging: [
    { segment: 'prospecting', spend: 3014.75, frequentie: 2.48, staat: 'gezond' },
    { segment: 'engaged', spend: 410.49, frequentie: 17.00, staat: 'stukgedraaid' }
  ],
  advertentie_scorekaart: [
    { entity_id: '120249635910050577', ad_naam: 'WS - 102 - 1 - Copy', oordeel: 'opschalen', signalen: 2 },
    { entity_id: '120252206157180577', ad_naam: 'C1 - 4 Reasons Why',
      oordeel: 'materiaal werkt, bestemming niet', signalen: 2 },
    { entity_id: '120252206202030577', ad_naam: 'C3 - Social Proof', oordeel: null,
      waarom: 'onder de drempel: minder dan 1.000 vertoningen of 50 euro', signalen: 2 }
  ]
};
let volgendeId = 1;
const claudeAanroepen = [];

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
    let rijen = db[tabel];
    const statusM = url.match(/status=eq\.([^&]+)/);
    if (statusM) rijen = rijen.filter(r => r.status === statusM[1]);
    const limM = url.match(/limit=(\d+)/);
    if (limM) rijen = rijen.slice(0, Number(limM[1]));
    return ok(rijen);
  }

  if (url.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    claudeAanroepen.push(body);
    const beurt = Math.floor(body.messages.length / 2) + 1;
    const usage = { input_tokens: 1000, output_tokens: 200 };
    const roep = (id, name, input) => ok({ stop_reason: 'tool_use', usage, content: [{ type: 'tool_use', id, name, input }] });

    if (beurt === 1) return roep('t1', 'meta_publiek', { days: 30 });
    if (beurt === 2) return roep('t2', 'db_query', { table: 'trechter' });
    if (beurt === 3) return roep('t3', 'db_query', { table: 'advertentie_scorekaart' });
    if (beurt === 4) {
      return roep('t4', 'write_report', {
        kind: 'audit', title: 'Audit Wellshave®', body_md: '# Audit',
        periode_start: '2026-06-30', periode_eind: '2026-07-29',
        cijfers: { spend: 3425.92, roas: 1.74, frequentie_engaged: 17.0 },
        signalen: [{ naam: 'frequentie engaged', richting: 'op', waarde: 17.0 }],
        gaten: ['kwaliteitsrangschikking', 'industriebenchmark CTR']
      });
    }
    return ok({ stop_reason: 'end_turn', usage,
      content: [{ type: 'text', text: 'Audit geschreven. Engaged draait op frequentie 17; twee signalen beschikbaar, niet drie.' }] });
  }

  if (url.includes('graph.facebook.com') && url.includes('user_segment_key')) {
    if (!publiekWerkt) return ok({ error: { message: 'breakdown user_segment_key is not supported for this account' } });
    return ok({ data: [
      { date_start: '2026-06-30', date_stop: '2026-07-29', user_segment_key: 'prospecting', spend: '3014.75', impressions: '459568', reach: '185682' },
      { date_start: '2026-06-30', date_stop: '2026-07-29', user_segment_key: 'engaged', spend: '410.49', impressions: '53792', reach: '3164' },
      { date_start: '2026-06-30', date_stop: '2026-07-29', user_segment_key: 'unknown', spend: '0.68', impressions: '99', reach: '95' }
    ] });
  }
  if (url.includes('graph.facebook.com')) return ok({ data: [] });

  throw new Error('onverwachte fetch in test: ' + url);
};

const env = { ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551' };
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

await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'atlas', kind: 'account_audit' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 50));

console.log('\n  de uitsplitsing naar publiek');
check('de audit loopt door tot het eind', db.agent_jobs[0].status, 'done');
check('drie segmenten opgehaald', uitkomstVan(claudeAanroepen[1], 't1').aantal, 3);
check('en weggeschreven als één venster, niet als dagen', db.meta_publiek.length, 3);
const engaged = db.meta_publiek.find(r => r.segment === 'engaged');
check('het venster staat als periode vast', [engaged.van, engaged.tot], ['2026-06-30', '2026-07-29']);
check('bereik is meegekomen — zonder dat is er geen frequentie', engaged.reach, 3164);
check('en de frequentie die eruit volgt is 17', Math.round(engaged.impressions / engaged.reach * 100) / 100, 17);

console.log('\n  het rekenwerk komt uit de views, niet uit het hoofd van de agent');
check('trechter staat op de leeslijst', uitkomstVan(claudeAanroepen[2], 't2').aantal, 2);
check('de scorekaart ook', uitkomstVan(claudeAanroepen[3], 't3').aantal, 3);
check('en de waarschuwing over de pixel komt mee',
  JSON.stringify(uitkomstVan(claudeAanroepen[2], 't2')).includes('ViewContent vuurt nauwelijks'), true);

console.log('\n  het rapport');
check('er staat een auditrapport', db.reports.length, 1);
check('van het juiste soort', db.reports[0].kind, 'audit');
check('met de bevinding als cijfer, niet alleen als zin', db.reports[0].cijfers.frequentie_engaged, 17.0);
check('en de twee ontbrekende signalen als gat', db.reports[0].gaten,
  ['kwaliteitsrangschikking', 'industriebenchmark CTR']);
check('de samenvatting zegt hoeveel signalen er waren',
  db.agent_runs[0].summary.includes('twee signalen'), true);

/* ── Meta die de uitsplitsing weigert ────────────────────────────────────── */
console.log('\n  als Meta de uitsplitsing niet geeft');
publiekWerkt = false;
db.agent_jobs.length = 0; db.agent_runs.length = 0; claudeAanroepen.length = 0;
db.meta_publiek.length = 0; db.reports.length = 0;
await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'atlas', kind: 'account_audit' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 50));

const geweigerd = uitkomstVan(claudeAanroepen[1], 't1');
check('de weigering komt terug als gat, niet als crash', geweigerd.gat, 'publiek per segment');
check('met de reden erbij', String(geweigerd.error).includes('user_segment_key'), true);
check('de audit loopt gewoon door', db.agent_jobs[0].status, 'done');
check('er is niets half weggeschreven', db.meta_publiek.length, 0);
check('en er komt nog steeds een rapport', db.reports.length, 1);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
