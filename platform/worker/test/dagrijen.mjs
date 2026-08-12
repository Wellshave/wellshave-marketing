/* Testlus: alleen dagen mogen in de dagtabel.
 *
 * Waarom dit een eigen bestand is:
 *
 *   meta_insights_daily heet daily maar niets dwong dat af. Vraag je Meta om
 *   cijfers zónder time_increment, dan krijg je één rij per advertentie voor
 *   de hele periode, met date_start op de eerste dag van het venster. Die rij
 *   ging daarna gewoon de dagtabel in.
 *
 *   Dat is precies wat er is gebeurd. Op 12 juli 2026 stond € 2.180,10 over 96
 *   advertenties -- elf keer een normale dag. Die rijen waren opgehaald in een
 *   run van 10 augustus 06:31 terwijl alle omliggende dagen van 11 augustus
 *   18:22 kwamen. Eén creative telde daardoor € 2.251 waar het account
 *   € 1.172 zegt.
 *
 *   Twee dingen maakten het onzichtbaar, en dit bestand bewaakt ze allebei:
 *
 *     1. De standaard stond op de gevaarlijke kant. `breakdown_by_day` was
 *        false-tenzij-gevraagd, dus wie niets invulde kreeg de variant die de
 *        data bederft.
 *     2. Er werd hoe dan ook weggeschreven. Ook een periodetotaal.
 *
 *   De nagemaakte Meta hier doet daarom wat de echte doet: mét time_increment
 *   één rij per dag, zonder time_increment één rij voor het hele venster. Een
 *   stub die dat verschil niet maakt, kan deze fout per definitie niet vangen
 *   -- en dat is exact waarom hij maanden kon blijven staan.
 *
 *   node platform/worker/test/dagrijen.mjs
 */

import worker from '../marketing-os.worker.js';

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

let gevraagd = { level: 'ad', days: 7 };
/* Wat de worker werkelijk aan Meta vroeg. */
let vroegPerDag = null;
let vroegVenster = null;
/* Alle vensters op volgorde, en op welk niveau. Bij de inhaalslag is het
   laatste venster maar een stukje van het geheel -- daar moet je naar de rand
   van alles samen kijken. */
let vensters = [];
/* Wat de agent uiteindelijk terugkreeg van het gereedschap. */
let toolUitkomst = null;

let volgendeId = 1;
const db = {
  agents: [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
  schedules: [], agent_jobs: [], agent_runs: [], agent_events: [], reports: [],
  meta_publications: [], approvals: [], meta_insights_daily: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }],
  ad_accounts: [
    { account_id: '242238038391551', naam: 'Wellshave®', merk: 'wellshave', actief: true, primair: true }
  ],
  creatives: []
};

function tabelUit(url) { const m = url.match(/\/rest\/v1\/([a-z_]+)/); return m ? m[1] : null; }
function defaults(t) {
  if (t === 'agent_jobs') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  if (t === 'agent_runs') return { status: 'running' };
  if (t === 'agent_events') return { level: 'info' };
  return {};
}

const DAG = 86400000;
const datum = (d) => d.toISOString().slice(0, 10);

/* Twee advertenties, € 10 per dag elk. Met dat vaste bedrag is een
   periodetotaal meteen te herkennen: 7 dagen wordt € 70 op één datum. */
const ADS = [
  { id: 'ad_1', naam: 'WS - 001 - 1' },
  { id: 'ad_2', naam: 'WS - 002 - 1' }
];
const PER_DAG = 10;

const rij = (ad, dag, spend) => ({
  date_start: dag, date_stop: dag,
  ad_id: ad.id, ad_name: ad.naam,
  spend: spend.toFixed(2), impressions: '1000', clicks: '20',
  actions: [{ action_type: 'purchase', value: '1' }],
  action_values: [{ action_type: 'purchase', value: '30.00' }]
});

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
    if (/actief=is\.true/.test(url)) rijen = rijen.filter(r => r.actief);
    const idM = url.match(/[?&]id=eq\.([^&]+)/);
    if (idM) rijen = rijen.filter(r => String(r.id) === idM[1]);
    const statusM = url.match(/status=eq\.([^&]+)/);
    if (statusM) rijen = rijen.filter(r => r.status === statusM[1]);
    return ok(rijen);
  }

  if (url.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    const beurt = Math.floor(body.messages.length / 2) + 1;
    const usage = { input_tokens: 1000, output_tokens: 200 };
    if (beurt === 1) {
      return ok({ stop_reason: 'tool_use', usage,
        content: [{ type: 'tool_use', id: 't1', name: 'meta_insights', input: gevraagd }] });
    }
    /* De uitkomst van het gereedschap komt terug als tool_result in de tweede
       beurt. Daar leest deze test wat de agent te horen kreeg. */
    const laatste = body.messages[body.messages.length - 1];
    if (Array.isArray(laatste.content)) {
      const res = laatste.content.find(c => c.type === 'tool_result');
      if (res) { try { toolUitkomst = JSON.parse(res.content); } catch { /* geen json */ } }
    }
    return ok({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Gemeten.' }] });
  }

  if (url.includes('graph.facebook.com')) {
    const u = new URL(url);
    const venster = JSON.parse(u.searchParams.get('time_range'));
    const perDag = u.searchParams.get('time_increment') === '1';
    vroegPerDag = perDag;
    vroegVenster = venster;
    vensters.push({ ...venster, level: u.searchParams.get('level') });

    const since = new Date(venster.since + 'T00:00:00Z');
    const until = new Date(venster.until + 'T00:00:00Z');
    const dagen = Math.round((until - since) / DAG) + 1;

    const data = [];
    if (perDag) {
      /* Zoals de echte: één rij per advertentie per dag. */
      for (const ad of ADS) {
        for (let i = 0; i < dagen; i++) {
          data.push(rij(ad, datum(new Date(since.getTime() + i * DAG)), PER_DAG));
        }
      }
    } else {
      /* Zoals de echte: één rij per advertentie voor de hele periode, met
         date_start op de eerste dag van het venster. Dit is de rij die de
         dagtabel vergiftigde. */
      for (const ad of ADS) {
        data.push(rij(ad, venster.since, PER_DAG * dagen));
      }
    }
    return ok({ data, paging: { cursors: { after: 'c1' } } });
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

const env = {
  ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

const haal = async (input) => {
  gevraagd = input;
  vroegPerDag = null; vroegVenster = null; toolUitkomst = null; vensters = [];
  db.meta_insights_daily = []; db.agent_events = []; db.agent_jobs = []; db.agent_runs = [];
  await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth,
    body: JSON.stringify({ agent_id: 'atlas', kind: 'account_audit' }) }), env);
  await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
  await new Promise(r => setTimeout(r, 80));
  return { rijen: db.meta_insights_daily, uitkomst: toolUitkomst };
};

/* ── 1. De standaard staat op de veilige kant ───────────────────────────────
   Dit is de kern. Vóór deze reparatie leverde precies deze aanroep -- level en
   days, zonder breakdown_by_day, wat een agent vanzelf doet -- twee rijen van
   € 70 op één datum op. */
console.log('\n  zonder breakdown_by_day is per dag de standaard');
let r = await haal({ level: 'ad', days: 7 });
check('de worker vraagt Meta om een uitsplitsing per dag', vroegPerDag, true);
check('zeven dagen x twee advertenties is veertien rijen', r.rijen.length, 14);
check('en elke rij staat op een eigen datum',
  new Set(r.rijen.map(x => x.insight_date)).size, 7);
check('geen enkele rij draagt het periodetotaal',
  r.rijen.every(x => Number(x.spend) === PER_DAG), true);
check('het gereedschap meldt dat het per dag ging', r.uitkomst && r.uitkomst.per_dag, true);
check('en dat er is weggeschreven', r.uitkomst && r.uitkomst.weggeschreven, true);

/* ── 2. Expliciet uitzetten mag, maar dan wordt er niets bewaard ────────────
   De agent mag een periodetotaal opvragen -- dat is een legitieme vraag. Wat
   niet mag is dat zo'n totaal in de dagtabel belandt. */
console.log('\n  een periodetotaal komt de dagtabel niet in');
r = await haal({ level: 'ad', days: 30, breakdown_by_day: false });
check('de worker vraagt Meta nu zonder uitsplitsing', vroegPerDag, false);
check('en schrijft niets weg', r.rijen.length, 0);
check('de agent krijgt de cijfers wel te zien', r.uitkomst && r.uitkomst.aantal, 2);
check('het gereedschap zegt dat er niets bewaard is', r.uitkomst && r.uitkomst.weggeschreven, false);
check('met een zin die vertelt hoe het wel moet',
  !!(r.uitkomst && r.uitkomst.let_op && r.uitkomst.let_op.includes('breakdown_by_day')), true);

/* ── 3. De inhaalslag over een lang venster blijft per dag ──────────────────
   Boven de 45 dagen knipt de worker het venster in stukken van 30. Die stukken
   moeten elk per dag uitgesplitst blijven, anders levert een inhaalslag over
   400 dagen veertien lompe rijen op in plaats van 400 dagen. */
console.log('\n  ook een lange inhaalslag levert dagen');
r = await haal({ level: 'ad', days: 120 });
check('nog steeds per dag', vroegPerDag, true);
check('120 dagen x twee advertenties', r.rijen.length, 240);
check('en 120 verschillende datums',
  new Set(r.rijen.map(x => x.insight_date)).size, 120);
/* Zonder deze controle zou een gat in de reeks niet opvallen: 240 rijen kan
   ook 120 dagen met een dubbele zijn. */
check('elke datum draagt precies twee rijen',
  [...new Set(r.rijen.map(x => x.insight_date))].every(
    d => r.rijen.filter(x => x.insight_date === d).length === 2), true);

/* ── 4. Explicit true blijft gewoon werken ─────────────────────────────────*/
console.log('\n  expliciet aanzetten verandert niets');
r = await haal({ level: 'ad', days: 7, breakdown_by_day: true });
check('per dag', vroegPerDag, true);
check('veertien rijen', r.rijen.length, 14);

/* ── 5. Het niveau doet er niet toe ────────────────────────────────────────
   Campagne- en accountniveau schrijven naar dezelfde tabel en hadden dus
   dezelfde fout. In de database staan 23 campagnerijen over 7 "dagen" en 12
   accountrijen -- ook die kwamen hiervandaan. */
console.log('\n  hetzelfde geldt voor campagne- en accountniveau');
r = await haal({ level: 'campaign', days: 30, breakdown_by_day: false });
check('campagneniveau schrijft ook niets weg', r.rijen.length, 0);
r = await haal({ level: 'account', days: 30, breakdown_by_day: false });
check('accountniveau ook niet', r.rijen.length, 0);

/* ── 6. De inhaalslag ──────────────────────────────────────────────────────
   Een systeemtaak, geen opdracht aan een agent: welke dagen ontbreken staat in
   meta_meetgaten en daar valt niets aan te oordelen. Hij doet één gat per run
   en zet zichzelf terug in de rij zolang er meer zijn -- 177 dagen passen niet
   in één Worker-run. */
const inhaal = async (payload, gaten, dekking) => {
  vensters = []; toolUitkomst = null;
  db.meta_insights_daily = []; db.agent_events = []; db.agent_jobs = []; db.agent_runs = [];
  db.meta_meetgaten = gaten;
  db.meta_meetdekking = dekking;
  await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth,
    body: JSON.stringify({ agent_id: 'atlas', kind: 'meta_inhaalslag', payload: payload || {} }) }), env);
  await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
  await new Promise(r => setTimeout(r, 120));
  return {
    rijen: db.meta_insights_daily,
    vervolg: db.agent_jobs.filter(j => j.kind === 'meta_inhaalslag' && j.status === 'queued'),
    run: db.agent_runs[db.agent_runs.length - 1]
  };
};

/* Het echte gat: 6 oktober tot 2 februari, 120 dagen, met Black Friday erin. */
const HET_GAT = [{ account_id: '242238038391551', brand: 'wellshave',
                   van: '2025-10-06', tot: '2026-02-02', dagen: 120 }];

console.log('\n  de inhaalslag haalt precies het gat op');
let g = await inhaal({}, HET_GAT, [{ brand: 'wellshave', dagen_ontbreken: 57, grootste_gat_dagen: 49 }]);
const advertentievensters = vensters.filter(v => v.level === 'ad')
  .sort((a, b) => a.since < b.since ? -1 : 1);
check('hij begint op de eerste dag van het gat',
  advertentievensters[0].since, '2025-10-06');
check('en eindigt op de laatste',
  advertentievensters[advertentievensters.length - 1].until, '2026-02-02');
/* Zonder deze controle zou hij ook "de laatste 300 dagen" kunnen ophalen en
   toevallig groen zijn -- terwijl hij dan tien keer zoveel werk doet en niet
   na te rekenen is welk stuk aan de beurt was. */
check('en niets buiten het gat',
  advertentievensters.every(v => v.since >= '2025-10-06' && v.until <= '2026-02-02'), true);
check('in stukken van hooguit 30 dagen',
  advertentievensters.every(v =>
    Math.round((new Date(v.until) - new Date(v.since)) / DAG) + 1 <= 30), true);
check('de stukken sluiten op elkaar aan',
  advertentievensters.every((v, i) => i === 0 ||
    Math.round((new Date(v.since) - new Date(advertentievensters[i - 1].until)) / DAG) === 1), true);
check('alles per dag uitgesplitst', vroegPerDag, true);

console.log('\n  en haalt ook accountniveau op');
/* Zonder accountcijfer per dag kan meta_meetdag (0049) niet narekenen of een
   dag compleet is. Mutatietest: haal 'account' uit de lus en deze valt om. */
check('er zijn ook accountvensters gevraagd',
  vensters.some(v => v.level === 'account'), true);
check('over hetzelfde gat',
  vensters.filter(v => v.level === 'account')
    .every(v => v.since >= '2025-10-06' && v.until <= '2026-02-02'), true);
check('en beide niveaus staan in de dagtabel',
  new Set(g.rijen.map(r => r.level)).size, 2);

console.log('\n  hij zet zichzelf terug in de rij zolang er gaten zijn');
check('er staat een vervolgopdracht klaar', g.vervolg.length, 1);
check('van dezelfde soort', g.vervolg[0] && g.vervolg[0].kind, 'meta_inhaalslag');
check('en de samenvatting noemt wat er nog te gaan is',
  /Nog 57 dag\(en\) ontbreken/.test(g.run && g.run.summary || ''), true);

console.log('\n  en stopt zodra er niets meer ontbreekt');
g = await inhaal({}, HET_GAT, [{ brand: 'wellshave', dagen_ontbreken: 0, grootste_gat_dagen: 0 }]);
check('geen vervolgopdracht meer', g.vervolg.length, 0);
check('en hij zegt dat het klaar is',
  /Geen ontbrekende dagen meer/.test(g.run && g.run.summary || ''), true);

console.log('\n  zonder gaten doet hij niets');
g = await inhaal({}, [], [{ brand: 'wellshave', dagen_ontbreken: 0 }]);
check('er wordt niets opgehaald', vensters.length, 0);
check('en niets weggeschreven', g.rijen.length, 0);

console.log('\n  een handmatig venster mag, maar dan expliciet');
g = await inhaal({ van: '2025-11-24', tot: '2025-12-01' }, HET_GAT,
                 [{ brand: 'wellshave', dagen_ontbreken: 0 }]);
const handmatig = vensters.filter(v => v.level === 'ad');
check('hij volgt het opgegeven venster', handmatig[0].since, '2025-11-24');
check('en niet het gat uit de database', handmatig[0].since !== '2025-10-06', true);

console.log('');
console.log(fouten === 0 ? 'Alles klopt' : `${fouten} controle(s) mislukt`);
process.exit(fouten > 0 ? 1 : 0);
