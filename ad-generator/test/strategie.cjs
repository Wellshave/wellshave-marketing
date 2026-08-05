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
      if (wis) { localStorage.removeItem('str_kolommen_v1'); localStorage.removeItem('str_weergave_v1'); }
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
  check('vier tests, alle vier zichtbaar', uit.rijen.length, 4);
  check('met een telling erbij', /4 van 4 tests/.test(uit.telling || ''), true);

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
    ['concept', 'wacht op een oordeel', 'live', 'gestopt']);
  check('en de groepen zijn verschillend', uit.rijen.map(r => r.groep),
    ['str-rij--concept', 'str-rij--wacht', 'str-rij--live', 'str-rij--gestopt']);

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
  check('filters leeg geeft alles terug', gefilterd.alles, 4);
  check('sorteren op naam zet ze op volgorde',
    gefilterd.gesorteerd[0], 'WS-GG-MARK-BEWIJS-001');

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
    /1 test wacht op jou/.test(wacht.banner || ''), true);
  check('en de rij zegt het ook met een woord', wacht.merken, 1);
  check('je kunt er direct op filteren', wacht.na, 1);
  check('en weer terug', wacht.terug, 4);

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
    resultaat.filter(c => c === 'niet live').length, 3);

  const geenFilter = await page.evaluate(async () => {
    strZoek('bestaatniet'); await new Promise(r => setTimeout(r, 150));
    return (document.querySelector('#str-mount .str-geen') || {}).textContent;
  });
  // Nul resultaten is een uitkomst en geen storing. Zonder deze zin denk je dat
  // de tabel stuk is terwijl je zelf een filter aan hebt staan.
  check('geen resultaat zegt dat dat een uitkomst is',
    /Dat is een uitkomst, geen fout/.test(geenFilter || ''), true);

  console.log('\n  het dossier: zes secties, ook de lege (regel 0.4)');
  await nep(RIJEN, DOSSIER);
  const dos = await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[0].click();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('str-dos');
    return {
      secties: [...o.querySelectorAll('.str-sec h3')].map(e => e.textContent.trim()),
      titel: o.querySelector('.str-dos-kop strong').textContent.trim(),
      paren: [...o.querySelectorAll('.str-paar dt')].map(e => e.textContent.trim()),
      leegParen: [...o.querySelectorAll('.str-paar--leeg dd')].map(e => e.textContent.trim()),
      aannames: o.querySelectorAll('.str-zeker--aanname').length,
      mini: [...o.querySelectorAll('.str-mini tbody tr')].length,
      tijdlijn: [...o.querySelectorAll('.str-tl')].map(e => e.textContent.trim()),
      tijdlijnDoor: [...o.querySelectorAll('.str-tl-door')].map(e => e.textContent.trim()),
      alles: o.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  check('zes secties, A tot en met F', dos.secties.length, 6);
  check('en ze zeggen waar ze over gaan', dos.secties,
    ['1 · Testsamenvatting', '2 · Creative', '3 · Strategische herkomst',
     '4 · Werkstuk en samenwerking', '5 · Publicatie en performance',
     '6 · Learning en vervolg']);
  check('de kop noemt de advertentie', dos.titel, 'WS-GG-MARK-BEWIJS-001');
  check('1 toont de hypothese', /Bewijs verlaagt de drempel/.test(dos.alles), true);
  check('en de testvariabele', dos.paren.indexOf('Testvariabele') > -1, true);
  check('en of sophistication bevestigd is', /Mechanisme \(bevestigd\)/.test(dos.alles), true);
  check('1 zegt ook wat de test moet uitwijzen',
    /Of bewijs in beeld de CTR verhoogt/.test(dos.alles), true);
  check('2 noemt de plaatsing en de productreferenties',
    /feed/.test(dos.alles) && /groomguard-front\.jpg/.test(dos.alles), true);
  check('3 toont het denkstuk vraag voor vraag', dos.mini >= 4, true);
  check('3 toont de ingeving waar het mee begon',
    /Viel me op in de reviews/.test(dos.alles), true);
  check('en de kernpijn, het kernbezwaar en de echte vijand uit het interview',
    /angst voor sneetjes/.test(dos.alles) && /weer een abonnement/.test(dos.alles)
      && /de wegwerpmesjes/.test(dos.alles), true);
  check('met de onderbouwingsstatus in woorden',
    /1 onderbouwd, 1 aanname, 1 open gelaten/.test(dos.alles), true);
  check('en de gebruikte bronnen', /review-export mei/.test(dos.alles), true);
  // Een aanname mag er niet uitzien als een meting: anders lees je een gok als
  // feit en bouw je de volgende test op zand.
  check('een aanname is te onderscheiden van een meting', dos.aannames, 1);
  check('een onbeantwoorde vraag zegt dat met een woord', /onbeantwoord/.test(dos.alles), true);
  check('4 noemt het oordeel van de Criticus', /twijfel/.test(dos.alles), true);
  // De tijdlijn is de enige plek waar "wie besloot dit" in één keer te lezen
  // is. Mens en agent moeten er met een woord bij staan, niet met een kleur.
  check('4 zet mens en agent in één tijdlijn', dos.tijdlijn.length, 2);
  check('met bij elke regel of het een mens of een agent was',
    dos.tijdlijnDoor, ['mens', 'agent']);
  check('4 noemt het werkstuk en het denkstuk',
    /#11/.test(dos.alles) && /#4/.test(dos.alles), true);
  check('en de overdracht met wat er te controleren valt',
    /Dat het beeld op mobiel leesbaar blijft/.test(dos.alles), true);
  check('post die nooit is opgehaald staat er ook', /nooit opgehaald/.test(dos.alles), true);
  check('5 toont wat gemeten is', /41022|41\.022/.test(dos.alles), true);
  check('en waarom iets wel of niet beoordeelbaar is',
    /genoeg dagen, budget en vertoningen/.test(dos.alles), true);
  check('en dat de attributie nog naloopt', /de attributie loopt nog na/.test(dos.alles), true);
  check('5 vertaalt het verdict naar gewone taal', /blijf testen/.test(dos.alles), true);
  check('6 toont de learning van deze test',
    /Bewijs in beeld verlaagt de drempel/.test(dos.alles), true);
  // Een learning die niemand getekend heeft is een voorstel. Zonder dit
  // onderscheid landt een gok als vastgesteld feit in de analyse.
  check('en dat hij nog een voorstel is', /nog niet bevestigd — dit is een voorstel/.test(dos.alles), true);
  check('6 toont wat behouden en wat veranderd moet worden',
    /Het getal in de kop/.test(dos.alles) && /De kleur van de knop/.test(dos.alles), true);
  check('6 toont de learning op de hoek apart',
    /Betrouwbaar: genoeg advertenties en budget/.test(dos.alles), true);
  check('een niet ingevuld veld zegt dat in woorden',
    dos.leegParen.every(t => t === 'niet vastgelegd'), true);

  const leegDos = await page.evaluate(async () => {
    strDossierSluit();
    await new Promise(r => setTimeout(r, 100));
    return document.getElementById('str-dos') === null;
  });
  check('het dossier sluit weer', leegDos, true);

  await nep(RIJEN, DOSSIER_LEEG);
  const leeg = await page.evaluate(async () => {
    document.querySelectorAll('#str-mount .str-rij')[1].click();
    await new Promise(r => setTimeout(r, 300));
    const o = document.getElementById('str-dos');
    return { secties: o.querySelectorAll('.str-sec').length,
             uitleg: [...o.querySelectorAll('.str-sec-leeg')].map(e => e.textContent.trim()),
             alles: o.textContent.replace(/\s+/g, ' ').trim() };
  });
  check('een test zonder meting toont nog steeds zes secties', leeg.secties, 6);
  check('sectie 5 toont wat er wél gemeten is', /820/.test(leeg.alles), true);
  check('een test die nog niet lang genoeg draait zegt waarom hij dat niet is',
    /onder de drempel van vier dagen, vijftig euro en duizend vertoningen/.test(leeg.alles), true);
  check('en waarom er nog geen learning is',
    /een conclusie zonder meting is een mening/.test(leeg.alles), true);
  check('en waarom er niets op de hoek staat',
    /Er is nog niets geleerd op deze hoek/.test(leeg.alles), true);
  check('en dat de agents er niets over schreven',
    /niets over aan elkaar geschreven/.test(leeg.alles), true);
  check('en dat de Criticus nog niets vond',
    /De Criticus heeft hier nog geen oordeel/.test(leeg.alles), true);
  check('nergens een leeg vlak zonder reden',
    leeg.uitleg.every(t => t.length > 12), true);
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
  check('beide staan er met een woord bij', wissel.knoppen,
    ['Tests en dossier', 'Bewerken (cijfers en status)']);

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
      dossierKop: meet('.str-sec h3'),
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
