/* Testlus voor de paginatie in metaInsights.
 *
 * Waarom dit een eigen bestand is:
 *
 *   Meta geeft nooit alles in één antwoord. Hij geeft een pagina en een
 *   verwijzing naar de volgende, en die verwijzing werd nooit gevolgd. Op
 *   accountniveau over zeven dagen viel dat niet op -- dat zijn zeven rijen,
 *   ruim onder de limiet. Op advertentieniveau over een half jaar zijn het er
 *   duizenden.
 *
 *   Dat is de gevaarlijkste soort storing die dit systeem kan hebben: een sync
 *   die de helft laat liggen ziet er precies zo uit als een die klopt. Geen
 *   foutmelding, geen waarschuwing, alleen minder rijen dan er zijn -- en op
 *   basis daarvan wordt straks besloten welke persona werkt.
 *
 *   De nagemaakte Meta in de andere testbestanden geeft geen `paging`, en
 *   bewees dus niets over dit gedrag. Precies dat maakte de fout onzichtbaar:
 *   de stub was makkelijker dan de werkelijkheid. Hier geeft hij `paging.next`
 *   zoals de echte, inclusief het geval waarin hij midden in de reeks stukgaat.
 *
 *   node platform/worker/test/paginatie.mjs
 */

import worker from '../marketing-os.worker.js';

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

/* Wat de nagemaakte Meta deze ronde doet. */
let paginas = 3;
let knaptOpPagina = 0;
/* Wat de agent deze ronde vraagt. */
let gevraagd = { level: 'ad', days: 7 };
/* Welk venster de worker werkelijk aan Meta vroeg. */
let gevraagdVenster = null;
/* Alle vensters die de worker deze ronde vroeg, op volgorde. */
let gevraagdeVensters = [];
/* Vensters die de nagemaakte Meta weigert, zoals de echte doet bij te veel data. */
let weigertVensterMetDagen = 0;

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

/* Eén rij per advertentie, met een naam zoals ze in het echte account staan.
   De namen doen er hier toe: valt er een rij weg door de paginatie, dan valt
   er een creative uit de Creative Strategy Map. */
const rijVoor = (n) => ({
  date_start: '2026-07-28',
  ad_id: 'ad_' + n,
  ad_name: 'WS - ' + String(n).padStart(3, '0') + ' - 1',
  spend: '10.00', impressions: '1000', clicks: '20',
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

  if (url.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    const beurt = Math.floor(body.messages.length / 2) + 1;
    const usage = { input_tokens: 1000, output_tokens: 200 };
    if (beurt === 1) {
      return ok({ stop_reason: 'tool_use', usage,
        content: [{ type: 'tool_use', id: 't1', name: 'meta_insights', input: gevraagd }] });
    }
    return ok({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Gemeten.' }] });
  }

  if (url.includes('graph.facebook.com')) {
    /* De echte Meta zet zijn cursor in de next-URL en verwacht hem terug. De
       nagemaakte doet dat ook, anders bewijst deze test alleen dat we kunnen
       tellen. */
    const u = new URL(url);
    const pagina = Number(u.searchParams.get('__pagina') || '1');
    if (u.searchParams.get('time_range')) {
      gevraagdVenster = JSON.parse(u.searchParams.get('time_range'));
      gevraagdVenster.level = u.searchParams.get('level');
      if (pagina === 1) gevraagdeVensters.push(gevraagdVenster);
      /* De echte Meta weigert een te groot verzoek met deze tekst -- niet met
         een leeg antwoord. Dat onderscheid is de hele reden dat de inhaalslag
         van 400 dagen stukliep terwijl de dagelijkse run gewoon werkte. */
      const dagen = Math.round(
        (new Date(gevraagdVenster.until) - new Date(gevraagdVenster.since)) / 86400000) + 1;
      if (weigertVensterMetDagen && dagen >= weigertVensterMetDagen) {
        return ok({ error: { message: "Please reduce the amount of data you're asking for, then retry your request", code: 1 } });
      }
    }

    if (knaptOpPagina && pagina === knaptOpPagina) {
      return ok({ error: { message: 'Please reduce the amount of data you are asking for, then retry your request', code: 1 } });
    }

    const data = [];
    for (let i = 0; i < 2; i++) data.push(rijVoor((pagina - 1) * 2 + i + 1));

    const antwoord = { data };
    if (pagina < paginas) {
      const volgende = new URL(url);
      volgende.searchParams.set('__pagina', String(pagina + 1));
      antwoord.paging = { cursors: { after: 'c' + pagina }, next: volgende.toString() };
    } else {
      antwoord.paging = { cursors: { after: 'c' + pagina } };
    }
    return ok(antwoord);
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

const env = {
  ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

/* Sinds versie 16 is meta_inhaalslag de enige weg naar metaInsights. Het
   venster komt dus uit een gat in plaats van uit een `days`-parameter; de
   paginering die hier getest wordt zit erachter en verandert daar niet van. */
const haal = async (input) => {
  gevraagd = input; gevraagdVenster = null; gevraagdeVensters = [];
  db.meta_insights_daily = []; db.systeem_events = []; db.taken = []; db.taak_runs = [];
  const eind = new Date();
  const start = new Date(eind.getTime() - ((input.days || 7) - 1) * 86400000);
  const dag = (d) => d.toISOString().slice(0, 10);
  db.meta_meetgaten = [{ account_id: '242238038391551', brand: 'wellshave',
                         van: dag(start), tot: dag(eind), dagen: input.days || 7 }];
  db.meta_meetdekking = [{ brand: 'wellshave', dagen_ontbreken: 0 }];
  await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
    body: JSON.stringify({ kind: 'meta_inhaalslag' }) }), env);
  await worker.fetch(new Request('https://w/systeem/tick', { method: 'POST', ...auth }), env);
  await new Promise(r => setTimeout(r, 80));
  return {
    /* Alleen advertentieniveau: de inhaalslag haalt ook accountcijfers op, en
       die verdubbelen elke telling hieronder zonder iets over paginering te
       zeggen. */
    rijen: db.meta_insights_daily.filter(r => r.level === 'ad'),
    waarschuwingen: db.systeem_events.filter(e => e.level === 'warn')
  };
};

console.log('\n  alle paginas worden gevolgd');
paginas = 3; knaptOpPagina = 0;
let r = await haal({ level: 'ad', days: 7 });
/* Drie pagina's van twee rijen. Vóór deze reparatie waren het er twee: alleen
   de eerste pagina, zonder enig teken dat er meer was. */
check('drie paginas leveren zes rijen', r.rijen.length, 6);
check('en de laatste advertentie zit erbij',
  r.rijen.some(x => x.entity_name === 'WS - 006 - 1'), true);
check('de namen komen mee, anders koppelt de map niets',
  r.rijen.every(x => x.entity_name && x.entity_name.startsWith('WS - ')), true);
check('geen waarschuwing bij een nette reeks', r.waarschuwingen.length, 0);

console.log('\n  één pagina blijft één pagina');
paginas = 1; knaptOpPagina = 0;
r = await haal({ level: 'ad', days: 7 });
check('zonder next stopt hij meteen', r.rijen.length, 2);

console.log('\n  breekt Meta halverwege, dan is dat te zien');
paginas = 5; knaptOpPagina = 3;
r = await haal({ level: 'ad', days: 7 });
/* Wat binnen is blijft binnen -- twee pagina's zijn beter dan niets. Maar het
   mag niet doorgaan voor een volledige meting. */
check('de rijen tot de breuk blijven behouden', r.rijen.length, 4);
/* Twee, niet één: de inhaalslag haalt advertentie- én accountniveau op en
   beide lopen op dezelfde breuk stuk. Eén zou betekenen dat een van de twee
   niveaus stil overgeslagen werd. */
check('en er staat per niveau een waarschuwing bij', r.waarschuwingen.length, 2);
check('die zegt na hoeveel paginas het misging',
  /brak af na 2 pagina/.test(r.waarschuwingen[0] ? r.waarschuwingen[0].message : ''), true);

console.log('\n  het venster reikt tot voorbij een jaar');
paginas = 1; knaptOpPagina = 0;
r = await haal({ level: 'ad', days: 400 });
/* De Creative Strategy Map begint op 4 augustus 2025. Op de oude grens van 30
   dagen was die historie onbereikbaar en bleef het inhaalslagje leeg. */
/* Niet het aantal rijen tellen -- dat zegt niets over het venster. Het gaat
   erom welke `since` er werkelijk naar Meta ging. Op de oude grens van 30
   dagen kwam die op ergens in juli 2026 uit en bleef augustus 2025 buiten
   bereik.

   Sinds versie 14 is per dag de standaard, dus dit verzoek wordt geknipt en is
   er niet één venster maar veertien. De vraag blijft dezelfde -- reikt het
   geheel 400 dagen terug -- alleen meet je hem nu over de rand van álle
   stukken samen. Naar het laatste stuk kijken zou hier 9 dagen opleveren en
   groen zijn om de verkeerde reden. */
const alles = gevraagdeVensters.filter(v => v.level !== 'account').slice().sort((a, b) => a.since < b.since ? -1 : 1);
const dagenTerug = Math.round(
  (new Date(alles[alles.length - 1].until) - new Date(alles[0].since)) / 86400000);
check('het gevraagde venster is echt 400 dagen', dagenTerug, 399);
check('en reikt dus tot voor 4 augustus 2025',
  alles[0].since < '2025-08-04', true);

console.log('\n  een groot venster wordt in stukken geknipt');
paginas = 1; knaptOpPagina = 0; weigertVensterMetDagen = 0;
r = await haal({ level: 'ad', days: 400, breakdown_by_day: true });
/* Meta weigerde 400 dagen per dag op advertentieniveau letterlijk met "Please
   reduce the amount of data you're asking for". Niet paginatie: hij komt daar
   niet eens aan toe, hij wijst het verzoek zelf af. */
check('400 dagen wordt opgeknipt', gevraagdeVensters.filter(v => v.level !== 'account').length > 1, true);
check('geen enkel stuk is groter dan 30 dagen',
  gevraagdeVensters.every(v =>
    Math.round((new Date(v.until) - new Date(v.since)) / 86400000) + 1 <= 30), true);
/* De stukken moeten samen het hele venster dekken en elkaar niet overlappen:
   een gat is een maand die stil ontbreekt, een overlap telt een maand dubbel. */
const opVolgorde = gevraagdeVensters.filter(v => v.level !== 'account')
  .slice().sort((a, b) => a.since < b.since ? -1 : 1);
check('de stukken sluiten op elkaar aan, zonder gat of overlap',
  opVolgorde.every((v, i) => i === 0 ||
    Math.round((new Date(v.since) - new Date(opVolgorde[i - 1].until)) / 86400000) === 1), true);
check('en samen reiken ze tot voor 4 augustus 2025',
  opVolgorde[0].since < '2025-08-04', true);
check('elk stuk levert zijn rijen', r.rijen.length, opVolgorde.length * 2);

console.log('\n  de dagelijkse run blijft precies één verzoek');
weigertVensterMetDagen = 0;
r = await haal({ level: 'ad', days: 7 });
/* Een reparatie die het normale geval verandert, repareert niet maar
   verplaatst. Zeven dagen hoort exact te blijven zoals het was: één verzoek
   per niveau, niet geknipt. */
check('zeven dagen blijft één venster per niveau',
  gevraagdeVensters.filter(v => v.level !== 'account').length, 1);

/* Hier stond een controle op `breakdown_by_day: false` -- of een verzoek
   zonder uitsplitsing één ongeknipt venster opleverde. Die schakelaar bestaat
   sinds versie 16 niet meer: er is geen aanroeper die hem kon zetten, dus is
   de tak weggehaald in plaats van bewaakt. Wat er nog van overblijft is dat
   élk verzoek per dag gaat, en dat bewaakt dagrijen.mjs. */

console.log('\n  weigert Meta één periode, dan is dat te zien');
weigertVensterMetDagen = 0;
/* Eén specifiek venster laten mislukken: de nagemaakte Meta weigert alles wat
   30 dagen of langer is, en het laatste stuk is korter. */
weigertVensterMetDagen = 30;
r = await haal({ level: 'ad', days: 400, breakdown_by_day: true });
check('de rest komt gewoon binnen', r.rijen.length > 0, true);
check('en er staat een waarschuwing bij',
  r.waarschuwingen.some(w => /vensters niet/.test(w.message)), true);
check('die zegt hoeveel periodes ontbreken',
  r.waarschuwingen.some(w => /van de \d+ vensters/.test(w.message)), true);

console.log('\n  weigert Meta alles, dan is het geen halve meting');
weigertVensterMetDagen = 1;
r = await haal({ level: 'ad', days: 400, breakdown_by_day: true });
/* Nul rijen mag nooit doorgaan voor een geslaagde inhaalslag: dan ziet de map
   er compleet uit terwijl er een jaar ontbreekt. */
check('er komt niets binnen', r.rijen.length, 0);
/* Vroeger meldde de tool-wrapper dit met "Meta gaf geen cijfers". Die wrapper
   is weg; nu gooit metaInsights zelf zodra géén enkel venster lukt, en vangt
   de inhaalslag dat per niveau op. De eis is dezelfde gebleven: nul rijen mag
   nooit stil doorgaan voor een geslaagde meting. */
check('en het account wordt als mislukt gemeld',
  r.waarschuwingen.some(w => /Inhaalslag ad mislukt/.test(w.message)), true);
check('met de reden erbij, niet alleen dat het misging',
  r.waarschuwingen.some(w => /geen enkel venster gelukt/.test(JSON.stringify(w.data || {}))), true);

console.log('');
if (fouten) { console.log(`${fouten} controle(s) mislukt`); process.exit(1); }
console.log('Alles klopt');
