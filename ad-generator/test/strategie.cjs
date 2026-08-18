/* Testlus voor de Creative Strategy-tabel en het testdossier.
 *
 * Het templateantwoord op "toon alle tests" is een tabel met vijfentwintig
 * kolommen: technisch volledig, in de praktijk onleesbaar. Bij honderd rijen
 * scan je op één ding tegelijk, en elke kolom die je nooit gebruikt kost elke
 * keer aandacht. Daarom moet hier bewezen worden:
 *
 *   - de tabel begint op tien kolommen en niet op alles
 *   - de kolomkeuze blijft bewaard, want anders kies je hem elke keer opnieuw
 *   - status is een groep en geen tint: zes dingen die je verschillend doet,
 *     elk met een woord erbij (regel 4.4)
 *   - een rij opent het dossier met alle zes secties, ook de lege — en een
 *     lege sectie zegt in woorden waarom hij leeg is (regel 0.4)
 *   - een aanname ziet er anders uit dan een meting, anders lees je een gok
 *     als feit
 *   - de bestaande bewerkbare tabel blijft bestaan en bereikbaar
 *
 *   node ad-generator/test/strategie.cjs
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const CHROOM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve(root) {
  const s = http.createServer((req, res) => {
    const rel = req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]).slice(1);
    const p = path.join(root, rel);
    if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end('x'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'text/plain' });
    res.end(fs.readFileSync(p));
  });
  return new Promise(r => s.listen(0, () => r([s, s.address().port])));
}

/* Vier rijen die vier verschillende gevallen zijn: een concept zonder
   hypothese, iets dat op een oordeel wacht, iets dat live staat en gemeten is,
   en iets dat gestopt is. Vier rijen van hetzelfde bewijzen niets. */
const RIJEN = [
  { creative_id: 1, brand: 'Wellshave', ad_name: 'WS-GG-MARK-BEWIJS-001',
    product: 'Groom Guard', persona: 'Mark', marketing_angle: 'Sociaal bewijs',
    angle_type: 'social_proof', awareness_level: 'Problem Aware', funnel_stage: 'TOF',
    format: 'Static 4:5', media_type: 'image', channel: 'Meta',
    headline: 'Vier op de vijf mannen', body_copy: 'Kort en droog.', cta: 'Shop nu',
    heeft_beeld: true, hypothesis: 'Bewijs verlaagt de drempel bij twijfelaars.',
    test_variable: 'hook', status: 'Live', status_fase: 'live',
    verantwoordelijke: 'Atlas', volgende_stap: 'meten tot de drempel gehaald is',
    created_at: '2026-07-20T09:00:00Z', date_live: '2026-07-22T09:00:00Z',
    roas: 2.4, ctr: 1.8, verdict: 'test', verdict_actie: 'iterate',
    verdict_reden: 'De hook doet het, het beeld niet.', werkstuk_id: 11, denkstuk_id: 4,
    placement: 'feed', product_refs: ['groomguard-front.jpg'],
    status_betekenis: 'Draait en geeft geld uit.',
    onderbouwd: 1, aanname: 1, open_gelaten: 1, denkstuk_status: 'bezig',
    sophistication: 3, sophistication_naam: 'Mechanisme', sophistication_bevestigd: true,
    onderbouwing: '3 van de 7 antwoorden zijn onderbouwd', niet_testklaar: null },

  { creative_id: 2, brand: 'Wellshave', ad_name: 'WS-GG-MARK-PIJN-002',
    product: 'Groom Guard', persona: 'Mark', marketing_angle: 'Pijnpunt',
    angle_type: 'pain', awareness_level: 'Problem Aware', funnel_stage: 'TOF',
    format: 'Static 1:1', media_type: 'image', channel: 'Meta',
    headline: 'Elke ochtend hetzelfde', heeft_beeld: true,
    hypothesis: 'De pijn benoemen wint van het product tonen.',
    test_variable: 'visual', status: 'Klaar voor review', status_fase: 'review',
    verantwoordelijke: 'de Criticus', volgende_stap: 'een oordeel: door of niet door',
    created_at: '2026-07-25T09:00:00Z', werkstuk_id: 11, denkstuk_id: 4,
    onderbouwing: 'niets is gemeten; alles rust op aannames', niet_testklaar: null },

  { creative_id: 3, brand: 'Wellshine', ad_name: null,
    product: 'Shine Serum', persona: 'Eva', marketing_angle: 'Ritueel',
    angle_type: 'ritual', format: 'Static 9:16', heeft_beeld: false,
    hypothesis: null, test_variable: null, status: 'Concept', status_fase: 'concept',
    verantwoordelijke: 'de maker', volgende_stap: 'indienen voor review, of laten liggen',
    created_at: '2026-08-01T09:00:00Z', werkstuk_id: null, denkstuk_id: null,
    onderbouwing: 'geen denkstuk — deze test rust nergens op',
    niet_testklaar: 'geen hypothese — een afbeelding zonder hypothese is geen test' },

  /* Een rij zoals de drie Google Search-varianten op productie: een stub
     zonder beeld, zonder copy en zonder verwijzing naar de bibliotheek. */
  { creative_id: 6, brand: 'Wellshave', ad_name: '23:47. Incognito. Wij weten wat je zoekt.',
    product: 'Groom Guard', persona: 'Mark', marketing_angle: 'Search',
    angle_type: 'search', format: null, heeft_beeld: false, bibliotheek_id: null,
    batch_id: null, variant_index: null, status: 'Concept', status_fase: 'maken',
    verantwoordelijke: 'de maker', volgende_stap: 'indienen voor review',
    created_at: '2026-07-23T09:00:00Z', werkstuk_id: 9, denkstuk_id: null,
    beeld_herkomst: 'niet gekoppeld aan een bibliotheekvariant — beeld en copy zijn niet terug te vinden',
    onderbouwing: 'geen denkstuk', niet_testklaar: null },

  /* Een rij zoals de zeven op productie: nog op het oude woord, dus zonder
     verantwoordelijke en zonder fase uit de statustabel. */
  { creative_id: 5, brand: 'Wellshave', ad_name: 'WS-OUD-005',
    product: 'Groom Guard', persona: 'Mark', marketing_angle: 'Onbekend',
    angle_type: 'legacy', format: 'Static 4:5', heeft_beeld: true,
    status: 'To Test', status_fase: null, verantwoordelijke: null, volgende_stap: null,
    created_at: '2026-06-01T09:00:00Z', werkstuk_id: 12, denkstuk_id: null,
    onderbouwing: 'geen denkstuk — deze test rust nergens op', niet_testklaar: null },

  { creative_id: 4, brand: 'Wellshave', ad_name: 'WS-GG-MARK-GRAP-004',
    product: 'Groom Guard', persona: 'Mark', marketing_angle: 'Humor',
    angle_type: 'humor', format: 'Static 4:5', heeft_beeld: true,
    hypothesis: 'Humor haalt de schaamte eruit.', test_variable: 'copy',
    status: 'Gestopt', status_fase: 'gestopt', verantwoordelijke: 'niemand',
    volgende_stap: 'Niets — dit idee is bewust gestopt',
    created_at: '2026-07-10T09:00:00Z', werkstuk_id: 12, denkstuk_id: 5,
    onderbouwing: '1 van de 7 antwoorden zijn onderbouwd', niet_testklaar: null },
];

/* Het dossier van rij 1: het enige geval waarin álle zes secties gevuld zijn.
   Rij 2 hergebruikt dezelfde vorm zonder meting, en dat is de test op leeg. */
const DOSSIER = Object.assign({}, RIJEN[0], {
  werkstuk: 'Groom Guard bij twijfelende Mark',
  rory_reasoning: 'Mark twijfelt niet aan de prijs maar aan zichzelf.',
  theriot_reasoning: 'De hook mag concreter: een getal in plaats van een gevoel.',
  next_step: 'Itereren op de headline',
  mens_ingeving: 'Viel me op in de reviews: mannen noemen het zelf een risico.',
  rory_interview: { kernpijn: 'angst voor sneetjes', kernbezwaar: 'weer een abonnement',
    echte_vijand: 'de wegwerpmesjes', na_situatie: 'een gezicht zonder rode plekken' },
  bronnen: ['klantinterviews juni', 'review-export mei'],
  learning_kern: 'Bewijs in beeld verlaagt de drempel.',
  learning_behouden: 'Het getal in de kop.',
  learning_veranderen: 'De kleur van de knop.',
  iteratie_voorstel: 'Zelfde kop, ander beeld.',
  vervolgtests: 'Dezelfde hook bij Eva.',
  learning_bevestigd: false, learning_door_agent: 'nova',
  tijdlijn: [
    { wanneer: '2026-07-20T09:00:00Z', soort: 'klaargezet', wie: 'Dustin Gibson',
      door: 'mens', wat: 'klaargezet voor test', waarom: 'Bewijs verlaagt de drempel.' },
    { wanneer: '2026-07-21T09:00:00Z', soort: 'oordeel', wie: 'Criticus',
      door: 'agent', wat: 'oordeel: twijfel', waarom: 'Niet falsifieerbaar.' },
  ],
  denkstuk_regels: [
    { vraag: 1, tekst: 'Wie is dit voor?', antwoord: 'Mark, 34, twijfelt.',
      zekerheid: 'onderbouwd', bron: 'klantinterviews juni' },
    { vraag: 2, tekst: 'Waarom nu?', antwoord: 'Zomer, kort haar.',
      zekerheid: 'aanname', bron: null },
  { vraag: 3, tekst: 'Wat is het bewijs?', antwoord: null, zekerheid: null, bron: null },
    { vraag: 6, tekst: 'Wat moet getest worden?',
      antwoord: 'Of bewijs in beeld de CTR verhoogt bij twijfelaars.',
      zekerheid: 'open', bron: null },
  ],
  stappen: [
    { station: 3, naam: 'creatie', status: 'afgerond', wie: 'Dustin Gibson',
      soort: 'mens', waarom: 'Beeld en copy staan.' },
    { station: 4, naam: 'live', status: 'loopt', wie: 'Atlas', soort: 'agent', waarom: null },
  ],
  overdrachten: [
    { van_station: 3, naar_station: 4, besluit: 'Deze mag live op klein budget.',
      controleren: 'Dat het beeld op mobiel leesbaar blijft', mens_nodig: true, status: 'geaccepteerd' },
  ],
  oordelen: [{ oordeel: 'twijfel', reden: 'De hypothese is niet falsifieerbaar geformuleerd.',
      door: 'Criticus' }],
  discussies: [{ van: 'atlas', aan: 'nova', onderwerp: 'ROAS zakt',
      body: 'Dag drie loopt terug naar 0,9.', gelezen: null }],
  publicatie: { account_id: 'act_123', status: 'gepubliceerd', meta_ad_id: '99' },
  meting: { spend: 312.4, impressions: 41022, clicks: 738, ctr: 1.8, cpa: 24.1,
    roas: 2.4, purchases: 13, dagen_live: 6, beoordeelbaar: true, alles_definitief: false },
  learnings: [{ hoek: 'social_proof', persona: 'Mark', advertenties: 4, spend: 980,
    roas: 2.1, winnaars: 1, betrouwbaar: true }],
});

/* Een creative die zijn bibliotheekvariant kwijt is: geen beeld, geen copy,
   geen verwijzing. Precies de drie Google Search-varianten op productie. */
const DOSSIER_LOS = Object.assign({}, RIJEN[3], {
  werkstuk: 'Niemand praat erover, maar iedereen googelt het',
  denkstuk_regels: null, stappen: null, overdrachten: null, oordelen: null,
  discussies: null, publicatie: null, meting: null, learnings: null, tijdlijn: null,
});

/* Het dossier van een creative van vóór de testflow: geen denkstuk, geen
   interview, geen hypothese. Precies de zeven die op productie staan. */
const DOSSIER_OUD = Object.assign({}, RIJEN[4], {
  werkstuk: 'Oud werkstuk', mens_ingeving: null, rory_interview: null,
  rory_reasoning: null, theriot_reasoning: null, bronnen: [],
  denkstuk_regels: null, stappen: null, overdrachten: null, oordelen: null,
  discussies: null, publicatie: null, meting: null, learnings: null, tijdlijn: null,
  learning_kern: null, next_step: null,
});

const DOSSIER_LEEG = Object.assign({}, RIJEN[1], {
  werkstuk: 'Groom Guard bij twijfelende Mark',
  denkstuk_regels: null, stappen: null, overdrachten: null, oordelen: null,
  discussies: null, publicatie: { account_id: 'act_123', status: 'gepubliceerd' },
  /* Twee dagen live en zestig euro: hij draait, maar 0008 zegt dat er nog niets
     over te zeggen valt. Precies het geval waarin "nee" zonder reden als een
     storing leest in plaats van als geduld. */
  meting: { spend: 61.2, impressions: 820, dagen_live: 2,
    beoordeelbaar: false, alles_definitief: true },
  learnings: null, tijdlijn: null,
  rory_interview: null, mens_ingeving: null, learning_kern: null,
});

let fout = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fout++;
  console.log(`  ${goed ? 'ok  ' : 'FOUT'} ${label}`);
  if (!goed) {
    console.log(`       verwacht ${JSON.stringify(verwacht)}`);
    console.log(`       kreeg    ${JSON.stringify(echt)}`);
  }
};

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  /* De nep-Supabase geeft per tabel een ander antwoord: de tabel leest
     hq_testkaart, het dossier hq_creative_dossier. Zonder dat onderscheid test
     je één query twee keer. */
  const nep = async (rijen, dossier, { ingelogd = true, fout = null, wis = true } = {}) =>
    await page.evaluate(async ({ rijen, dossier, ingelogd, fout, wis }) => {
      window._sb = ingelogd ? { from: function (tabel) {
        const q = {};
        ['select', 'eq', 'ilike', 'or', 'in', 'order', 'range', 'limit'].forEach(m => { q[m] = () => q; });
        const antwoord = fout ? { error: { message: fout } }
          : { data: tabel === 'hq_creative_dossier' ? (dossier ? [dossier] : []) : rijen };
        q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
        return q;
      }} : null;
      window._authProfile = ingelogd ? { id: 'test' } : null;
      window._userRole = 'admin';
      /* Expliciet 'tests' en niet wissen: sinds de tracker erbij kwam is dat de
         standaardweergave, en deze lus gaat over de testtabel ernaast. Wissen
         zou hier de tracker openen en elke controle hieronder laten falen op
         een verborgen element. */
      if (wis) { localStorage.removeItem('str_kolommen_v1'); localStorage.setItem('str_weergave_v1', 'tests'); }
      _str.kolommen = null;
      _str.geladen = false; _str.rijen = null; _str.fout = null;
      _str.zoek = ''; _str.filters = {}; _str.selectie = {}; _str.kolomkiezer = false;
      _str.sorteer = 'created_at'; _str.omgekeerd = true;
      switchMainTab('creatives');
      strWisselTeken();
      await new Promise(r => setTimeout(r, 350));
      return null;
    }, { rijen, dossier, ingelogd, fout, wis });

  const lees = async () => await page.evaluate(() => {
    const m = document.getElementById('str-mount');
    const t = m.querySelector('.str-tabel');
    return {
      vraag: (m.querySelector('.str-vraag') || {}).textContent,
      koppen: [...m.querySelectorAll('.str-sorteer')].map(e => e.textContent.replace(/[▴▾]/g, '').trim()),
      rijen: [...m.querySelectorAll('.str-rij')].map(r => ({
        naam: r.querySelectorAll('td')[2].textContent.trim(),
        status: (r.querySelector('.str-status') || {}).textContent,
        groep: [...r.classList].find(c => c.startsWith('str-rij--')),
      })),
      telling: (m.querySelector('.str-telling') || {}).textContent,
      leegKop: (m.querySelector('.str-leeg-kop') || {}).textContent,
      leegTekst: [...m.querySelectorAll('.str-leeg p')].map(e => e.textContent.trim()).join(' '),
      geen: (m.querySelector('.str-geen') || {}).textContent,
      alles: m.textContent.replace(/\s+/g, ' ').trim(),
      breedte: t ? t.scrollWidth <= m.querySelector('.str-tabelwrap').clientWidth : null,
      zichtbaar: getComputedStyle(m).display,
      klassiekZichtbaar: getComputedStyle(document.getElementById('cs-klassiek')).display,
    };
  });

  await nep(RIJEN, DOSSIER);
  let uit = await lees();

  console.log('\n  de tabel staat er, met de vraag erboven');
  check('het tabblad toont de testtabel', uit.zichtbaar, 'block');
  check('en de beslisvraag staat bovenaan',
    /Welke test vraagt nu om een beslissing\?/.test(uit.vraag || ''), true);
  check('zes tests, alle zes zichtbaar', uit.rijen.length, 6);
  check('met een telling erbij', /6 van 6 tests/.test(uit.telling || ''), true);
  // Een status die de database niet kent, krijgt geen verzonnen betekenis.
  check('een verouderde status heet verouderd en geen concept',
    uit.rijen.filter(r => /verouderd/.test(r.status || '')).map(r => r.status),
    ['To Test · verouderd']);

  console.log('\n  tien kolommen, niet vijfentwintig');
  // Alles tegelijk tonen is niet vollediger maar onleesbaar. Zonder deze regel
  // groeit de tabel bij elk nieuw veld stilletjes door tot hij horizontaal
  // scrollt en niemand hem meer scant.
  check('de tabel begint op tien kolommen', uit.koppen.length, 10);
  check('en dat zijn de beslissingskolommen', uit.koppen,
    ['Preview', 'Ad name', 'Product', 'Persona', 'Angle', 'Format',
     'Status', 'Wie', 'Aangemaakt', 'Volgende stap']);
  // Tien kolommen die alleen passen als je horizontaal schuift zijn geen tien
  // kolommen: dan scan je alsnog niet. Vandaar dat de breedte gemeten wordt.
  // Tien kolommen die alleen passen als je horizontaal schuift zijn geen tien
  // kolommen: dan scan je alsnog niet. Vandaar dat de breedte gemeten wordt.
  check('ze passen zonder horizontaal schuiven', uit.breedte, true);

  const kiezer = await page.evaluate(async () => {
    strKolomkiezer(); await new Promise(r => setTimeout(r, 150));
    const m = document.getElementById('str-mount');
    const n = m.querySelectorAll('.str-vink').length;
    strKolomAan('hypothesis'); await new Promise(r => setTimeout(r, 150));
    return { keuzes: n,
             koppen: [...m.querySelectorAll('.str-sorteer')].map(e => e.textContent.replace(/[▴▾]/g, '').trim()),
             bewaard: JSON.parse(localStorage.getItem('str_kolommen_v1') || 'null') };
  });
  check('achter de kiezer zitten alle kolommen', kiezer.keuzes, 27);
  check('een kolom aanzetten voegt hem toe', kiezer.koppen.indexOf('Hypothese') > -1, true);
  check('en de keuze wordt bewaard', (kiezer.bewaard || []).indexOf('hypothesis') > -1, true);

  // Herladen met wis=false: de bewaarde keuze moet de herstart overleven,
  // anders kies je hem elke ochtend opnieuw.
  await nep(RIJEN, DOSSIER, { wis: false });
  uit = await lees();
  check('na herladen staat de kolom er nog', uit.koppen.indexOf('Hypothese') > -1, true);
  const terug = await page.evaluate(async () => {
    strKolommenTerug(); await new Promise(r => setTimeout(r, 150));
    return [...document.querySelectorAll('#str-mount .str-sorteer')].length;
  });
  check('en er is een weg terug naar de standaard tien', terug, 10);

  console.log('\n  status is een groep, geen tint (regel 4.4)');
  await nep(RIJEN, DOSSIER);
  uit = await lees();
  check('elke status staat er in woorden', uit.rijen.map(r => r.status),
    ['concept', 'wacht op een oordeel', 'concept', 'live', 'gestopt', 'To Test · verouderd']);
  check('en de groepen zijn verschillend', uit.rijen.map(r => r.groep),
    ['str-rij--concept', 'str-rij--wacht', 'str-rij--concept', 'str-rij--live',
     'str-rij--gestopt', 'str-rij--verouderd']);

  console.log('\n  zoeken, filteren, sorteren');
  const gefilterd = await page.evaluate(async () => {
    strZoek('humor'); await new Promise(r => setTimeout(r, 150));
    const na = [...document.querySelectorAll('#str-mount .str-rij')].length;
    strZoek(''); strZet('status', 'Live'); await new Promise(r => setTimeout(r, 150));
    const filter = [...document.querySelectorAll('#str-mount .str-rij')].length;
    strZet('status', 'Concept'); await new Promise(r => setTimeout(r, 150));
    const naam = document.querySelector('#str-mount .str-rij td:nth-child(3)').textContent.trim();
    strFiltersLeeg(); await new Promise(r => setTimeout(r, 150));
    strSorteer('ad_name'); await new Promise(r => setTimeout(r, 150));
    const gesorteerd = [...document.querySelectorAll('#str-mount .str-rij td:nth-child(3)')]
      .map(e => e.textContent.trim());
    return { na, filter, naam, gesorteerd,
             alles: [...document.querySelectorAll('#str-mount .str-rij')].length };
  });
  check('zoeken op een hoek vindt die ene test', gefilterd.na, 1);
  check('filteren op status ook', gefilterd.filter, 1);
  check('een rij zonder naam laat dat zien in plaats van leeg', gefilterd.naam, '—');
  check('filters leeg geeft alles terug', gefilterd.alles, 6);
  check('sorteren op naam zet ze op volgorde',
    gefilterd.gesorteerd[0], '23:47. Incognito. Wij weten wat je zoekt.');

  console.log('\n  wat op een mens wacht, staat er in woorden');
  // De kern van "duidelijke aanduiding wanneer menselijke actie nodig is":
  // een kleur alleen is niet genoeg (regel 4.4), en bij honderd rijen wil je
  // het aantal zien vóór je gaat scannen.
  const wacht = await page.evaluate(async () => {
    const m = document.getElementById('str-mount');
    const banner = (m.querySelector('.str-wacht') || {}).textContent;
    const merken = [...m.querySelectorAll('.str-jij')].length;
    strAlleenWacht(); await new Promise(r => setTimeout(r, 150));
    const na = [...document.querySelectorAll('#str-mount .str-rij')].length;
    strFiltersLeeg(); await new Promise(r => setTimeout(r, 150));
    return { banner, merken, na, terug: [...document.querySelectorAll('#str-mount .str-rij')].length };
  });
  check('het aantal wachtende tests staat bovenaan',
    /2 tests wachten op jou/.test(wacht.banner || ''), true);
  check('en de rij zegt het ook met een woord', wacht.merken, 2);
  check('je kunt er direct op filteren', wacht.na, 2);
  check('en weer terug', wacht.terug, 6);

  const resultaat = await page.evaluate(async () => {
    strKolomAan('resultaat'); await new Promise(r => setTimeout(r, 200));
    const kolommen = [...document.querySelectorAll('#str-mount .str-sorteer')]
      .map(e => e.textContent.replace(/[▴▾]/g, '').trim());
    const i = kolommen.indexOf('Resultaat');
    const cellen = [...document.querySelectorAll('#str-mount .str-rij')]
      .map(r => r.querySelectorAll('td')[i + 1].textContent.trim());
    strKolomAan('resultaat'); await new Promise(r => setTimeout(r, 150));
    return cellen;
  });
  // Resultaat komt uit de meting en is nooit een leeg vakje: staat er niets,
  // dan zegt de cel waarom niet.
  check('resultaat toont de meting waar die er is',
    resultaat.some(c => /ROAS 2,40/.test(c)), true);
  check('en zegt waarom er niets staat waar dat zo is',
    resultaat.filter(c => c === 'niet live').length, 5);

  const geenFilter = await page.evaluate(async () => {
    strZoek('bestaatniet'); await new Promise(r => setTimeout(r, 150));
    return (document.querySelector('#str-mount .str-geen') || {}).textContent;
  });
  // Nul resultaten is een uitkomst en geen storing. Zonder deze zin denk je dat
  // de tabel stuk is terwijl je zelf een filter aan hebt staan.
  check('geen resultaat zegt dat dat een uitkomst is',
    /Dat is een uitkomst, geen fout/.test(geenFilter || ''), true);

  console.log('\n  het dossier opent met het antwoord, niet met de brondata');
  await nep(RIJEN, DOSSIER);
  const dos = await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[0].click();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('str-dos');
    const zichtbaar = el => el && el.getClientRects().length > 0;
    return {
      titel: o.querySelector('.str-dos-kop strong').textContent.trim(),
      oordeel: (o.querySelector('.str-oordeel-kop') || {}).textContent,
      waarom: (o.querySelector('.str-oordeel-waarom') || {}).textContent,
      actie: (o.querySelector('.str-actie-knop, .str-actie-label') || {}).textContent,
      actieIsKnop: !!o.querySelector('button.str-actie-knop'),
      hoe: (o.querySelector('.str-actie-hoe') || {}).textContent,
      chips: [...o.querySelectorAll('.str-chip')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      groepen: [...o.querySelectorAll('.str-groep')].map(g => ({
        titel: g.querySelector('.str-groep-titel').textContent.trim(),
        samenvatting: g.querySelector('.str-groep-samenvatting').textContent.trim(),
        open: g.hasAttribute('open'),
        waarschuwing: (g.querySelector('.str-waarschuwing') || {}).textContent || null,
      })),
      // Wat je ziet zónder iets open te klappen.
      zichtbaarTekst: [...o.querySelectorAll('.str-besluit, .str-samenvatting, .str-groep-kop')]
        .map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' '),
      veldenZichtbaar: [...o.querySelectorAll('.str-paar')].filter(zichtbaar).length,
      alles: o.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  check('de kop noemt de advertentie', dos.titel, 'WS-GG-MARK-BEWIJS-001');

  // Het oordeel is een zin die een mens leest, geen statuscode. 'Live' zegt
  // niets over wat je nu moet doen; "heeft genoeg data voor een verdict" wel.
  check('bovenaan staat een oordeel in mensentaal',
    dos.oordeel, 'Deze test heeft genoeg data voor een verdict');
  check('met de reden erbij, in twee zinnen',
    /6 dagen live, € 312,4, 41\.022 vertoningen\. Daarmee is de drempel gehaald/.test(dos.waarom || ''),
    true);
  check('en één primaire actie', dos.actie, 'Verdict beoordelen');
  // Deze handeling gebeurt niet in de console, dus is het een label en geen
  // knop: doen alsof je erop kunt drukken is een belofte die niet klopt.
  check('een actie die hier niet uitgevoerd kan worden is geen knop', dos.actieIsKnop, false);
  check('met wat de agents voorstellen', /blijf testen/.test(dos.hoe || ''), true);

  // Tien seconden: dat kan alleen als er niet eerst een veldlijst staat.
  check('geen enkele veldregel staat standaard open', dos.veldenZichtbaar, 0);
  check('de compacte samenvatting staat er wel, als chips', dos.chips.length >= 6, true);
  check('en noemt product, persona en angle',
    dos.chips.map(c => c.replace(/^(Product|Persona|Angle|Format|Status|Werkstuk|Wie)/, '$1: '))
      .filter(c => /^(Product|Persona|Angle):/.test(c)),
    ['Product: Groom Guard', 'Persona: Mark', 'Angle: Sociaal bewijs']);

  console.log('\n  progressive disclosure: vijf groepen, allemaal dicht');
  check('vijf inklapbare groepen', dos.groepen.length, 5);
  check('en ze heten waar ze over gaan', dos.groepen.map(g => g.titel),
    ['Creative', 'Strategie', 'Samenwerking', 'Publicatie en performance', 'Learning en vervolg']);
  check('alle vijf staan standaard dicht', dos.groepen.filter(g => g.open).length, 0);
  // Inklappen mag alleen als de kop zegt of er iets te halen valt.
  check('elke kop draagt een samenvatting',
    dos.groepen.every(g => g.samenvatting.length > 3), true);
  check('de learninggroep zegt dat hij op bevestiging wacht',
    dos.groepen[4].waarschuwing, 'wacht op bevestiging');

  console.log('\n  de volledige onderbouwing blijft bereikbaar');
  const open = await page.evaluate(async () => {
    document.querySelectorAll('#str-dos .str-groep').forEach(g => g.setAttribute('open', ''));
    await new Promise(r => setTimeout(r, 150));
    const o = document.getElementById('str-dos');
    return {
      velden: [...o.querySelectorAll('.str-paar')].length,
      alles: o.textContent.replace(/\s+/g, ' ').trim(),
      mini: o.querySelectorAll('.str-mini tbody tr').length,
      aannames: o.querySelectorAll('.str-zeker--aanname').length,
      tijdlijn: [...o.querySelectorAll('.str-tl')].length,
      tijdlijnDoor: [...o.querySelectorAll('.str-tl-door')].map(e => e.textContent.trim()),
      tijdlijnWat: [...o.querySelectorAll('.str-tl-wat')].map(e => e.textContent.trim()),
    };
  });
  check('opengeklapt staan alle velden er weer', open.velden > 20, true);
  check('de hypothese', /Bewijs verlaagt de drempel/.test(open.alles), true);
  check('het interview', /angst voor sneetjes/.test(open.alles)
    && /weer een abonnement/.test(open.alles) && /de wegwerpmesjes/.test(open.alles), true);
  check('de ingeving waar het mee begon', /Viel me op in de reviews/.test(open.alles), true);
  check('het denkstuk vraag voor vraag', open.mini >= 4, true);
  check('een aanname blijft te onderscheiden van een meting', open.aannames, 1);
  check('de onderbouwingsstatus', /1 onderbouwd, 1 aanname, 1 open gelaten/.test(open.alles), true);
  check('de bronnen', /review-export mei/.test(open.alles), true);
  check('het oordeel van de Criticus', /twijfel/.test(open.alles), true);
  check('de meting', /41022|41\.022/.test(open.alles), true);
  check('en de learning', /Bewijs in beeld verlaagt de drempel/.test(open.alles), true);

  console.log('\n  de tijdlijn is te scannen en spreekt geen databasetaal');
  check('twee gebeurtenissen', open.tijdlijn, 2);
  check('met bij elke regel of het een mens of een agent was',
    open.tijdlijnDoor, ['mens', 'agent']);
  // "2 → 3" is geen zin. Zonder deze vertaling moet je de werkbank uit je hoofd
  // kennen om je eigen tijdlijn te lezen.
  check('een overdracht staat er als zin', open.tijdlijnWat.join(' | '),
    'Klaargezet voor test | Oordeel van De Criticus: twijfel');
  const stations = await page.evaluate(() => [
    strWat({ wat: '2 → 3' }), strWat({ wat: '3 → 4' }), strWat({ wat: '5 → ?' })]);
  check('en de stations bij naam', stations, [
    'Briefing droeg over aan Creatie',
    'Creatie droeg over aan Live',
    'Meting droeg over, maar niet aan wie']);

  console.log('\n  nergens een ruw object of een databasewaarde');
  check('geen [object Object]', /\[object Object\]/.test(open.alles), false);
  check('geen undefined of null in beeld',
    /\bundefined\b|\bNaN\b/.test(open.alles), false);

  const leegDos = await page.evaluate(async () => {
    strDossierSluit();
    await new Promise(r => setTimeout(r, 100));
    return document.getElementById('str-dos') === null;
  });
  check('het dossier sluit weer', leegDos, true);

  console.log('\n  een test die nog niet beoordeelbaar is');
  await nep(RIJEN, DOSSIER_LEEG);
  const leeg = await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[1].click();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('str-dos');
    return {
      oordeel: (o.querySelector('.str-oordeel-kop') || {}).textContent,
      actie: o.querySelector('.str-actie-knop, .str-actie-label'),
      hoe: (o.querySelector('.str-actie-hoe') || {}).textContent,
      legacy: (o.querySelector('.str-legacy') || {}).textContent,
      groepen: [...o.querySelectorAll('.str-groep')].map(g => ({
        titel: g.querySelector('.str-groep-titel').textContent.trim(),
        samenvatting: g.querySelector('.str-groep-samenvatting').textContent.trim(),
      })),
      groepenWaarschuwing: [...o.querySelectorAll('.str-groep')].map(g =>
        (g.querySelector('.str-waarschuwing') || {}).textContent || null),
      // Hoe vaak staat "niet vastgelegd" op het scherm, ook opengeklapt?
      nietVastgelegd: (o.textContent.match(/niet vastgelegd/g) || []).length,
      alles: o.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  check('het oordeel zegt dat hij wacht op data',
    leeg.oordeel, 'Deze creative wacht op De Criticus');
  check('vijf groepen, ook hier', leeg.groepen.length, 5);
  // Als er niets te doen is, hoort dat er te staan in plaats van een lege plek.
  // Deze draait twee dagen: er is wél gemeten, maar niet genoeg. De kop zegt
  // wat er staat, het waarschuwingslabel zegt dat het nog niet telt.
  check('de performancegroep vat de meting samen in de kop',
    leeg.groepen[3].samenvatting, '2 dagen live, € 61,2, 820 vertoningen');
  check('met een waarschuwing dat het nog niet genoeg is',
    leeg.groepenWaarschuwing[3], 'nog onvoldoende data');
  check('en de learninggroep zegt dat er niets is', leeg.groepen[4].samenvatting, 'Nog geen learning');

  console.log('\n  legacy: één melding in plaats van twintig lege velden');
  await nep(RIJEN, DOSSIER_OUD);
  const oud = await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[5].click();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('str-dos');
    document.querySelectorAll('#str-dos .str-groep').forEach(g => g.setAttribute('open', ''));
    await new Promise(r => setTimeout(r, 150));
    return {
      oordeel: (o.querySelector('.str-oordeel-kop') || {}).textContent,
      actie: (o.querySelector('.str-actie-knop, .str-actie-label') || {}).textContent,
      actieIsKnop: !!o.querySelector('button.str-actie-knop'),
      legacy: (o.querySelector('.str-legacy') || {}).textContent,
      nietVastgelegd: (o.textContent.match(/niet vastgelegd/g) || []).length,
      strategieKop: [...o.querySelectorAll('.str-groep')]
        .map(g => g.querySelector('.str-groep-samenvatting').textContent.trim())[1],
      alles: o.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  check('een verouderde status krijgt geen verzonnen betekenis',
    oud.oordeel, 'Oude status — deze creative moet opnieuw beoordeeld worden');
  check('met een actie die een mens kan uitvoeren', oud.actie, 'Kies een geldige status');
  // De knop zag eruit als een knop en deed niets. Een actie die de console zelf
  // kan uitvoeren hoort een echte <button> te zijn.
  check('en dat is een echte knop, geen plaatje van een knop', oud.actieIsKnop, true);
  // Twintig keer "niet vastgelegd" is geen informatie maar ruis. Eén zin die
  // zegt waarom het ontbreekt, is bruikbaar.
  check('één melding legt uit waarom de strategie ontbreekt',
    /gemaakt vóór de nieuwe testflow/.test(oud.legacy || ''), true);
  check('en niet twintig losse lege velden', oud.nietVastgelegd <= 3, true);
  check('de strategiegroep zegt het ook in zijn kop',
    oud.strategieKop, 'niet vastgelegd — van vóór de testflow');

  const leegContrast = await page.evaluate(() => {
    const lum = c => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const el = document.querySelector('.str-sec-leeg');
    const a = lum(getComputedStyle(el).color);
    const b = lum(getComputedStyle(document.querySelector('.str-dos')).backgroundColor);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  });
  check('en de uitleg is leesbaar (>= 4,5:1)', leegContrast >= 4.5, true);

  console.log('\n  de bestaande tabel blijft bestaan');
  await page.evaluate(() => strDossierSluit());
  const wissel = await page.evaluate(async () => {
    strWissel('tabel'); await new Promise(r => setTimeout(r, 200));
    const uit = { tests: getComputedStyle(document.getElementById('str-mount')).display,
                  klassiek: getComputedStyle(document.getElementById('cs-klassiek')).display,
                  bewaard: localStorage.getItem('str_weergave_v1') };
    strWissel('tests'); await new Promise(r => setTimeout(r, 250));
    uit.terug = getComputedStyle(document.getElementById('str-mount')).display;
    uit.knoppen = [...document.querySelectorAll('#str-wissel .str-knop')].map(e => e.textContent.trim());
    return uit;
  });
  check('de bewerkbare tabel is één klik weg', wissel.klassiek, 'block');
  check('en de testtabel wijkt dan', wissel.tests, 'none');
  check('de keuze wordt onthouden', wissel.bewaard, 'tabel');
  check('en je kunt terug', wissel.terug, 'block');
  /* Drie sinds de tracker erbij kwam. De volgorde is de volgorde van gebruik:
     eerst kijken wat er gebeurd is, dan wat om een beslissing vraagt, dan
     bijwerken. */
  check('alle drie staan er met een woord bij', wissel.knoppen,
    ['Tracker', 'Tests en dossier', 'Bewerken (cijfers en status)']);

  console.log('\n  regel 0.4 — nooit een leeg vlak');
  await nep([], null);
  uit = await lees();
  check('nul tests legt uit hoe er een komt', uit.leegKop, 'Er staat nog geen test.');
  check('met de knop erbij die je moet hebben',
    /Klaarzetten voor test/.test(uit.leegTekst), true);

  await nep(RIJEN, DOSSIER, { fout: 'relation "public.hq_testkaart" does not exist' });
  uit = await lees();
  check('een ontbrekende view noemt de migratie', /0030_testklaar\.sql/.test(uit.leegTekst), true);

  await nep(RIJEN, DOSSIER, { ingelogd: false });
  uit = await lees();
  check('niet ingelogd zegt waarom er niets staat', uit.leegKop, 'Log in om de tests te zien.');

  console.log('\n  een creative die zijn bibliotheekvariant kwijt is');
  await nep(RIJEN, DOSSIER_LOS);
  const los = await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[2].click();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('str-dos');
    return {
      oordeel: (o.querySelector('.str-oordeel-kop') || {}).textContent,
      waarom: (o.querySelector('.str-oordeel-waarom') || {}).textContent,
      actie: (o.querySelector('.str-actie-knop, .str-actie-label') || {}).textContent,
      isKnop: !!o.querySelector('button.str-actie-knop'),
      hoe: (o.querySelector('.str-actie-hoe') || {}).textContent,
      creativeKop: [...o.querySelectorAll('.str-groep')]
        .map(g => g.querySelector('.str-groep-samenvatting').textContent.trim())[0],
      alles: o.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  // Dit staat vooraan omdat je een advertentie die je niet kunt zien ook niet
  // kunt beoordelen. Een leeg dossier zonder uitleg is de fout die gemeld werd.
  check('het ontbreken van de koppeling is het hoofdoordeel',
    los.oordeel, 'Deze creative is niet gekoppeld aan zijn bibliotheekvariant');
  check('met de reden erbij', /geen verwijzing naar het bibliotheekitem/.test(los.waarom || ''), true);
  check('en een actie die de console zelf uitvoert', los.actie, 'Koppel aan de bibliotheek');
  check('als echte knop', los.isKnop, true);
  check('met de reden dat het systeem het niet zelf doet',
    /koppelt niet op een gelijke titel/.test(los.hoe || ''), true);
  check('de creativegroep zegt dat hij niet gekoppeld is',
    /niet gekoppeld/.test(los.creativeKop || ''), true);

  console.log('\n  de koppelkeuze: een mens kiest, met de beelden ernaast');
  const koppel = await page.evaluate(async () => {
    /* Een bibliotheek met drie varianten uit dezelfde generatie, waarvan er
       twee dezelfde kop hebben. Zou de koppeling op naam gaan, dan is dit
       precies het geval waarin het misgaat. */
    state.library = [
      { id: 'lib-a', batch_id: 'batch-1', variant_index: 0, image: 'data:image/png;base64,AAA',
        variation: { headline_nl: 'Jij googelt het ook.', body_copy_nl: 'B1', cta_nl: 'Shop' },
        metadata: { product: 'Groom Guard' } },
      { id: 'lib-b', batch_id: 'batch-1', variant_index: 1, image: 'data:image/png;base64,BBB',
        variation: { headline_nl: 'Jij googelt het ook.', body_copy_nl: 'B2', cta_nl: 'Shop' },
        metadata: { product: 'Groom Guard' } },
      { id: 'lib-c', batch_id: 'batch-2', variant_index: 0, image: 'data:image/png;base64,CCC',
        variation: { headline_nl: 'Iets heel anders', body_copy_nl: 'B3', cta_nl: 'Nu' },
        metadata: { product: 'Groom Guard' } },
    ];
    document.querySelector('button.str-actie-knop').click();
    await new Promise(r => setTimeout(r, 250));
    const o = document.getElementById('str-koppel');
    const eerst = o.querySelector('.str-kandidaat input');
    const knopVoor = o.querySelector('.str-acties .str-knop--aan').disabled;
    eerst.click();
    await new Promise(r => setTimeout(r, 200));
    const o2 = document.getElementById('str-koppel');
    return {
      kandidaten: [...o.querySelectorAll('.str-kandidaat')].length,
      beelden: [...o.querySelectorAll('.str-kandidaat img')].length,
      ids: [...o.querySelectorAll('.str-kandidaat-tekst small')].map(e => e.textContent.trim()),
      knopVoor: knopVoor,
      knopNa: o2.querySelector('.str-acties .str-knop--aan').disabled,
      uitleg: (o.querySelector('.str-sec-noot') || {}).textContent,
    };
  });
  check('alle drie de varianten staan er', koppel.kandidaten, 3);
  // Zonder beeld is de vraag onbeantwoordbaar: twee varianten hebben dezelfde
  // kop, dus alleen het beeld zegt welke het is.
  check('elk met zijn beeld', koppel.beelden, 3);
  // Deze creative heeft zelf geen generatie, dus is er niets om op voor te
  // sorteren; ze staan op variantnummer. Wél met hun id erbij en niet met
  // alleen hun titel, want twee titels zijn hier gelijk.
  check('en met hun id erbij, niet hun titel', koppel.ids.sort(), ['lib-a', 'lib-b', 'lib-c']);
  check('er is niets voorgeselecteerd', koppel.knopVoor, true);
  check('pas na een keuze kun je koppelen', koppel.knopNa, false);
  check('met de reden waarom het systeem dit niet zelf doet',
    /dezelfde kop hebben/.test(koppel.uitleg || ''), true);

  const gestuurd = await page.evaluate(async () => {
    let payload = null;
    window._sb.rpc = function (naam, args) { payload = { naam: naam, args: args };
      return Promise.resolve({ data: {}, error: null }); };
    document.querySelector('#str-koppel .str-acties .str-knop--aan').click();
    await new Promise(r => setTimeout(r, 250));
    return payload;
  });
  // De koppeling gaat via de gecontroleerde deur, met het id als sleutel.
  check('de koppeling gaat via hq_creative_koppelen', gestuurd.naam, 'hq_creative_koppelen');
  check('met het bibliotheek-id als sleutel', gestuurd.args.p.bibliotheek_id, 'lib-a');
  check('en niet met de titel', gestuurd.args.p.headline !== undefined
    && Object.keys(gestuurd.args.p).indexOf('ad_name'), -1);
  check('het variantnummer gaat mee', gestuurd.args.p.variant_index, 0);
  check('en de generatie', gestuurd.args.p.batch_id, 'batch-1');

  console.log('\n  het beeld komt uit de gekoppelde variant, niet uit de eerste de beste');
  const beeld = await page.evaluate(async () => {
    strKoppelSluit(); strDossierSluit();
    /* De koppelbevestiging hierboven heropent het dossier na 400 ms. Even
       wachten, anders overschrijft die het dossier dat we hier neerzetten. */
    await new Promise(r => setTimeout(r, 700));
    strDossierSluit();
    /* Twee varianten met dezelfde kop, verschillende beelden. Wordt het beeld
       op titel gezocht in plaats van op id, dan toont het dossier hier het
       beeld van de ander — een fout die je niet ziet tenzij je hem meet. */
    state.library = [
      { id: 'lib-a', batch_id: 'batch-1', variant_index: 0, image: 'data:image/png;base64,AAA',
        variation: { headline_nl: 'Jij googelt het ook.' }, metadata: {} },
      { id: 'lib-b', batch_id: 'batch-1', variant_index: 1, image: 'data:image/png;base64,BBB',
        variation: { headline_nl: 'Jij googelt het ook.' }, metadata: {} },
    ];
    strDossierTeken({ creative_id: 99, ad_name: 'Jij googelt het ook.',
      status: 'Concept', status_fase: 'maken', verantwoordelijke: 'de maker',
      heeft_beeld: false, bibliotheek_id: 'lib-b', batch_id: 'batch-1', variant_index: 1 });
    await new Promise(r => setTimeout(r, 200));
    document.querySelectorAll('#str-dos .str-groep').forEach(g => g.setAttribute('open', ''));
    await new Promise(r => setTimeout(r, 150));
    const img = document.querySelector('#str-dos .str-dos-beeld');
    return { src: img ? img.getAttribute('src') : null,
             noot: (document.querySelector('#str-dos .str-sec-noot') || {}).textContent };
  });
  check('het beeld van de gekoppelde variant wordt getoond',
    beeld.src, 'data:image/png;base64,BBB');
  check('met erbij dat het uit de bibliotheek komt',
    /komt uit de bibliotheek \(lib-b\)/.test(beeld.noot || ''), true);

  console.log('\n  wat de bibliotheek wegschrijft naar Creative Strategy');
  const weggeschreven = await page.evaluate(async () => {
    let rij = null;
    window._sb = { from: function () {
      return { insert: function (r) { rij = r; return { then: function (res) {
        return Promise.resolve({ error: null }).then(res); } }; } };
    }};
    window._authProfile = { id: 't', email: 'x@y.nl' };
    window._userRole = 'admin';
    window._pxAngleContext = { angle_id: 'a1', angle_title: 'Search', persona_name: 'Mark', stage: 'problem' };
    state.lastGenerated = { variations: [{}, {}, {}], _pxAngle: window._pxAngleContext };
    pxTagCreative({ id: 'lib-x', batch_id: 'batch-x', variant_index: 2,
      image: 'data:image/png;base64,XXX',
      variation: { headline_nl: 'Kop', body_copy_nl: 'Body', cta_nl: 'Shop',
                   visual_nl: 'Visueel', image_prompt_en: 'prompt' },
      metadata: { product: 'Groom Guard', format: 'feed11' } });
    await new Promise(r => setTimeout(r, 150));
    return rij;
  });
  // Dit is de plek waar het misging: de rij werd een stub met alleen een naam.
  check('de rij draagt het bibliotheek-id', weggeschreven.bibliotheek_id, 'lib-x');
  check('de generatie en het variantnummer', 
    [weggeschreven.batch_id, weggeschreven.variant_index], ['batch-x', 2]);
  check('het beeld gaat mee', weggeschreven.image_b64, 'data:image/png;base64,XXX');
  check('en de copy ook',
    [weggeschreven.headline, weggeschreven.body_copy, weggeschreven.cta],
    ['Kop', 'Body', 'Shop']);

  console.log('\n  regel 4.5 — kleuren uit het tokenblok');
  const css = fs.readFileSync(path.join(APP, 'css', '18-strategie.css'), 'utf8');
  check('geen losse hex in het component', (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []), []);

  console.log('\n  regel 4.1 — contrast, gemeten');
  await nep(RIJEN, DOSSIER);
  await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[0].click();
    await new Promise(r => setTimeout(r, 300));
  });
  /* Het volle dossier heeft geen lege sectie; die kleur is hierboven gemeten
     op het dossier dat er wel een heeft. */
  const contrast = await page.evaluate(() => {
    const lum = c => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    /* Meet tegen de kleur die je werkelijk ziet: een doorzichtige achtergrond
       is geen achtergrond, dus loop door tot er een echte kleur staat.
       Zonder dat meet je tegen zwart en slaagt of zakt elke regel willekeurig. */
    const achtergrond = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      }
      return 'rgb(255,255,255)';
    };
    const meet = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const a = lum(getComputedStyle(el).color), b = lum(achtergrond(el.parentElement || el));
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    return {
      kolomkop: meet('.str-sorteer'),
      cel: meet('.str-rij td'),
      leegCel: meet('.str-leeg-cel'),
      telling: meet('.str-telling'),
      statusWacht: meet('.str-status--wacht'),
      statusGestopt: meet('.str-status--gestopt'),
      jijAanZet: meet('.str-jij'),
      tijdlijnDoor: meet('.str-tl-door'),
      tijdlijnWaarom: meet('.str-tl-waarom'),
      dossierLabel: meet('.str-paar dt'),
      dossierWaarde: meet('.str-paar dd'),
      dossierKop: meet('.str-groep-titel'),
      oordeelKop: meet('.str-oordeel-kop'),
      oordeelWaarom: meet('.str-oordeel-waarom'),
      actieHoe: meet('.str-actie-hoe'),
      groepSamenvatting: meet('.str-groep-samenvatting'),
      chipLabel: meet('.str-chip-l'),
      dossierAanname: meet('.str-zeker--aanname td'),
    };
  });
  Object.keys(contrast).forEach(k => {
    const v = contrast[k], goed = v !== null && v >= 4.5;
    if (!goed) fout++;
    console.log(`  ${goed ? 'ok  ' : 'FOUT'} ${k}: ${v}:1${goed ? '' : '  — onder 4,5:1'}`);
  });

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
