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
  schedules: [], taken: [], taak_runs: [], systeem_events: [], reports: [],
  meta_publications: [], approvals: [], meta_insights_daily: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }],
  ad_accounts: [
    { account_id: '242238038391551', naam: 'Wellshave®', merk: 'wellshave', actief: true, primair: true }
  ],
  creatives: []
};

function tabelUit(url) { const m = url.match(/\/rest\/v1\/([a-z_]+)/); return m ? m[1] : null; }
function defaults(t) {
  if (t === 'taken') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  if (t === 'taak_runs') return { status: 'running' };
  if (t === 'systeem_events') return { level: 'info' };
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
    let rijen = db[tabel];
    if (/actief=is\.true/.test(url)) rijen = rijen.filter(r => r.actief);
    const idM = url.match(/[?&]id=eq\.([^&]+)/);
    if (idM) rijen = rijen.filter(r => String(r.id) === idM[1]);
    const statusM = url.match(/status=eq\.([^&]+)/);
    if (statusM) rijen = rijen.filter(r => r.status === statusM[1]);
    return ok(rijen);
  }

  /* Geen Anthropic-tak meer. Die stond hier omdat de agent zijn gereedschap via
     het model aanriep; de inhaalslag is een systeemtaak en praat rechtstreeks
     met Meta. Komt er toch een aanroep, dan hoort deze test te klappen. */

  if (url.includes('graph.facebook.com')) {
    const u = new URL(url);
    const venster = JSON.parse(u.searchParams.get('time_range'));
    const perDag = u.searchParams.get('time_increment') === '1';
    vroegPerDag = perDag;
    vroegVenster = venster;
    vensters.push({ ...venster, level: u.searchParams.get('level'), perDag: perDag });

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

/* ── 1. Er is geen manier meer om een periodetotaal op te vragen ────────────
   Vóór versie 16 was `breakdown_by_day` een schakelaar die standaard uit stond,
   en dat was de hele fout van 0049: zonder time_increment geeft Meta één rij
   voor de hele periode, met date_start op de eerste dag van het venster, en die
   rij ging gewoon de dagtabel in.

   De reparatie van augustus zette de standaard om. Deze versie gaat verder: de
   schakelaar bestaat niet meer. Dat is te controleren zonder de code te lezen —
   elk verzoek aan Meta draagt time_increment=1, ongeacht wat je vraagt. */
const inhaal = async (payload, gaten, dekking) => {
  vensters = []; vroegPerDag = null;
  db.meta_insights_daily = []; db.systeem_events = []; db.taken = []; db.taak_runs = [];
  db.meta_meetgaten = gaten;
  db.meta_meetdekking = dekking;
  await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
    body: JSON.stringify({ kind: 'meta_inhaalslag', payload: payload || {} }) }), env);
  await worker.fetch(new Request('https://w/systeem/tick', { method: 'POST', ...auth }), env);
  await new Promise(r => setTimeout(r, 120));
  return {
    rijen: db.meta_insights_daily,
    vervolg: db.taken.filter(j => j.kind === 'meta_inhaalslag' && j.status === 'queued'),
    run: db.taak_runs[db.taak_runs.length - 1]
  };
};

/* Het echte gat: 6 oktober tot 2 februari, 120 dagen, met Black Friday erin. */
const HET_GAT = [{ account_id: '242238038391551', brand: 'wellshave',
                   van: '2025-10-06', tot: '2026-02-02', dagen: 120 }];

console.log('\n  elk verzoek vraagt om een uitsplitsing per dag');
let g = await inhaal({}, HET_GAT, [{ brand: 'wellshave', dagen_ontbreken: 57, grootste_gat_dagen: 49 }]);
check('de worker vraagt Meta om dagen', vroegPerDag, true);
/* Mutatietest: haal time_increment uit bouw() en deze twee vallen om, de rest
   van het bestand niet -- daarom staan ze er allebei. */
check('en dat geldt voor élk verzoek, ook de latere stukken',
  vensters.length > 1 && vensters.every(v => v.perDag), true);

console.log('\n  en levert dagen op, geen periodetotalen');
check('120 dagen x twee advertenties op advertentieniveau',
  g.rijen.filter(r => r.level === 'ad').length, 240);
check('en 120 verschillende datums',
  new Set(g.rijen.filter(r => r.level === 'ad').map(x => x.insight_date)).size, 120);
/* Zonder deze controle zou een gat in de reeks niet opvallen: 240 rijen kan
   ook 120 dagen met een dubbele zijn. */
check('elke datum draagt precies twee advertentierijen',
  [...new Set(g.rijen.filter(r => r.level === 'ad').map(x => x.insight_date))].every(
    d => g.rijen.filter(x => x.level === 'ad' && x.insight_date === d).length === 2), true);
check('geen enkele rij draagt het periodetotaal',
  g.rijen.every(x => Number(x.spend) === PER_DAG), true);

console.log('\n  de inhaalslag haalt precies het gat op');
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

console.log('\n  een onbekende taak wordt geweigerd, niet geïnterpreteerd');
/* Toen de agents er nog waren viel een onbekende opdracht terug op het model.
   Dat is precies wat er niet meer moet kunnen. */
const onzin = await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
  body: JSON.stringify({ kind: 'verzin_een_rapport' }) }), env);
check('het verzoek wordt afgewezen', onzin.status, 400);
check('en er staat niets in de rij',
  db.taken.filter(t => t.kind === 'verzin_een_rapport').length, 0);

console.log('');
console.log(fouten === 0 ? 'Alles klopt' : `${fouten} controle(s) mislukt`);
process.exit(fouten > 0 ? 1 : 0);