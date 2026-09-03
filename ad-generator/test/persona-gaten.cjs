/* Drie dingen die je opviel in één sessie, plus een bug die eronder zat.
 *
 *   0. RORY WAS ONBEREIKBAAR. "prompt is too long: 1694198 tokens". Een
 *      basisfoto is een data-url van makkelijk een megabyte, en die ging via
 *      het LOCKED-blok woord voor woord de opdracht in. De melding wees naar
 *      de lengte in plaats van naar de oorzaak, en Rory deed op elke stap
 *      niets meer.
 *
 *   1. EEN MELDING MOET EEN UITWEG HEBBEN. "Still empty: proof copy" zei DAT
 *      er iets leeg was, niet waar. Dan klik je hem weg. Nu staat er per gat
 *      een knop die je naar het veld brengt en het aanwijst.
 *
 *   2. EN EEN PERSONA VOOR EEN NIEUWE CATEGORIE. De bibliotheek is per
 *      categorie opgebouwd; voor de scheerapparaten stond er niets. Dan krijg
 *      je personas van een ander product voorgeschoteld, en dat is erger dan
 *      een lege lijst: het ziet eruit als een besluit.
 *
 *   node ad-generator/test/persona-gaten.cjs
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const CHROOM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

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

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof wizOpen === 'function' && typeof wizZonderBeeld === 'function');

  console.log('\n  geen beelddata in een tekstprompt');
  /* Een foto van een megabyte in de opdracht is 1,7 miljoen tokens, en dan is
     Rory op elke stap onbereikbaar. Twee lagen: de plek die het deed, en een
     vangnet zodat de volgende keer geen drie ronden kost. */
  const schoon = await page.evaluate(async () => {
    const grote = 'data:image/png;base64,' + 'A'.repeat(50000);
    const viaVangnet = wizZonderBeeld('kop\n' + grote + '\nstaart');

    wizOpen();
    state.products = [{ id: 'p1', name: 'Shaver', category: 'Shaver', usps: ['x'] }];
    wizSet('product', 'productId', 'p1', 'user');
    /* Precies de toestand uit de melding: een basisfoto die de gebruiker zelf
       koos, dus met bron 'user' -- en dat is wat het LOCKED-blok uitschrijft. */
    wizState.data.visual.basisFoto = grote;
    wizState.source['visual.basisFoto'] = 'user';
    const ctx = wizContext();

    /* En de hele weg: wat gaat er werkelijk over de lijn? */
    let verstuurd = '';
    const echt = window.fetch;
    window.__WG_TEAMSERVER = true;
    window.fetch = async (url, opties) => {
      if (opties && typeof opties.body === 'string') verstuurd += opties.body;
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{}' }] }) };
    };
    await wizCall('systeem ' + grote, [{ role: 'user', content: 'vraag ' + grote }], 100)
      .catch(() => {});
    window.fetch = echt;

    return {
      vangnet: viaVangnet,
      ctxLengte: ctx.text.length,
      ctxHeeftFoto: ctx.text.indexOf('AAAAAAAAAA') !== -1,
      ctxNoemtHem: /visual\.basisFoto = \[an image you chose yourself\]/.test(ctx.text),
      verstuurdHeeftFoto: verstuurd.indexOf('AAAAAAAAAA') !== -1,
      verstuurdLengte: verstuurd.length
    };
  });
  check('het vangnet haalt de payload eruit', schoon.vangnet, 'kop\n[image omitted]\nstaart');
  check('de context draagt de foto niet meer', schoon.ctxHeeftFoto, false);
  /* Maar hij moet wel WETEN dat je een beeld hebt vastgezet: dat is een
     besluit dat hij niet mag wegadviseren. De mededeling wel, de megabyte niet. */
  check('maar noemt hem wel als besluit', schoon.ctxNoemtHem, true);
  check('en de context blijft klein', schoon.ctxLengte < 4000, true);
  check('er gaat geen beelddata over de lijn', schoon.verstuurdHeeftFoto, false);
  check('ook niet via een andere weg', schoon.verstuurdLengte < 5000, true);

  console.log('\n  een melding wijst naar het veld');
  const gaten = await page.evaluate(() => {
    wizState.data.strategy.proof = '';
    wizState.data.strategy.objection = 'twijfel';
    wizState.data.copy.supporting = 'iets';
    wizState.data.copy.proof = '';
    const lijst = wizBlueprintGaps();
    wizGo('review');
    const d = document.createElement('div');
    d.innerHTML = wizRender_review().links || '';
    const knoppen = [].slice.call(d.querySelectorAll('.wiz-warn-knoppen button'))
      .map(b => ({ tekst: b.textContent.trim(), aan: b.getAttribute('onclick') }));
    return { lijst: lijst, knoppen: knoppen };
  });
  /* Een gat weet nu op welke stap zijn veld staat: zonder die plek kun je er
     geen knop op zetten die ergens heen gaat. */
  check('elk gat draagt zijn stap en veld',
    gaten.lijst, [{ label: 'proof mechanism', stap: 'strategy', veld: 'proof' },
                  { label: 'proof copy', stap: 'copy', veld: 'proof' }]);
  check('en er staat een knop per gat', gaten.knoppen.length, 2);
  check('de eerste brengt je naar de strategie',
    gaten.knoppen[0].aan, "wizNaarGat('strategy','proof')");
  check('de tweede naar de copy', gaten.knoppen[1].aan, "wizNaarGat('copy','proof')");
  check('en zegt welk veld je gaat invullen',
    /Fill in proof mechanism/.test(gaten.knoppen[0].tekst), true);

  console.log('\n  en die knop wijst het veld ook echt aan');
  const wijzen = await page.evaluate(async () => {
    switchMainTab('generator');
    /* De knop staat alleen op de blueprint, en daar kom je met de verplichte
       velden gevuld -- de gaten zijn juist de NIET-verplichte. Zonder die
       opzet stuurt de poort je terecht terug naar de eerste lege stap, en dan
       meet deze controle de poort in plaats van de knop. */
    (typeof WIZ_REQUIRED !== 'undefined' ? Object.keys(WIZ_REQUIRED) : []).forEach(function (stap) {
      (WIZ_REQUIRED[stap] || []).forEach(function (veld) {
        if (!wizState.data[stap][veld]) {
          var toegestaan = (typeof wizToegestaan === 'function') ? wizToegestaan(stap, veld) : null;
          wizSet(stap, veld, (toegestaan && toegestaan[0]) || 'x', 'user');
        }
      });
    });
    wizNaarGat('strategy', 'proof');
    await new Promise(r => setTimeout(r, 150));
    const el = document.getElementById('wizf-strategy-proof');
    return { stap: wizState.current, gemarkeerd: !!(el && el.classList.contains('wiz-aangewezen')),
             focus: !!(el && document.activeElement === el) };
  });
  check('hij springt naar de juiste stap', wijzen.stap, 'strategy');
  check('en markeert het veld', wijzen.gemarkeerd, true);
  check('met de cursor erin', wijzen.focus, true);

  console.log('\n  een mislukte aanroep krijgt een herkansing');
  const herkansing = await page.evaluate(() => {
    wizState.advice.audience = { error: 'Rory could not be reached (te lang).' };
    wizState.current = 'audience';
    /* Het vorige blok stapte naar een stap, en daarmee ging Rory zelf denken;
       die aanroep hangt hier nog. Beide vlaggen los, anders meet dit blok een
       bezige Rory in plaats van een mislukte aanroep. */
    wizState.busy = false;
    wizState.roryBezig = false;
    wizRenderRoryBalk();
    const balk = document.getElementById('wiz-rorybalk');
    /* wizRenderRory schrijft in het paneel en geeft niets terug, dus lezen we
       het paneel zelf. */
    wizRenderRory();
    const paneel = document.getElementById('wiz-rorypaneel') ||
                   document.querySelector('.wiz-rory');
    return { balkKnop: !!(balk && balk.querySelector('button')),
             balkTekst: balk ? (balk.querySelector('button') || {}).textContent : '',
             paneelKnop: !!(paneel && paneel.querySelector('.wiz-rory-error button')) };
  });
  check('de balk biedt een nieuwe poging', herkansing.balkKnop, true);
  check('met die woorden', herkansing.balkTekst, 'Try again');
  check('en het paneel ook', herkansing.paneelKnop, true);

  console.log('\n  een persona voor een categorie waar niets voor staat');
  const bouwer = await page.evaluate(() => {
    state.products = [{ id: 'sh', name: 'Gentleman Shaver Elite', category: 'Shaver',
                        usps: ['4-in-1'], price: '49,95' }];
    state.personas = [{ id: 'oud', name: 'Iemand anders', category: 'Baardolie',
                        description: 'Van een ander product' }];
    wizState.data = wizBlankData();
    wizSet('product', 'productId', 'sh', 'user');
    wizPx.voorstel = null;
    const d = document.createElement('div');
    d.innerHTML = wizRenderPersonaBouwer();
    return { er: !!d.querySelector('.wiz-pxbouw'),
             tekst: d.textContent,
             knop: (d.querySelector('button') || {}).textContent || '' };
  });
  check('de bouwer staat er', bouwer.er, true);
  /* De reden er eerlijk bij: een persona uit een andere categorie is erger
     dan geen persona, want hij ziet eruit als een besluit. */
  check('en zegt waarom een vreemde persona erger is dan geen',
    /worse than none/.test(bouwer.tekst), true);
  check('met een knop die het product noemt',
    /Work out a persona for Gentleman Shaver Elite/.test(bouwer.knop), true);

  console.log('\n  hij bouwt er een, en die draagt zijn herkomst');
  const gebouwd = await page.evaluate(async () => {
    window.__WG_TEAMSERVER = true;
    let gezienSys = '';
    const echt = window.wizCall;
    window.wizCall = function (sys, msgs) {
      gezienSys = sys;
      return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify({
        name: 'Bram Hendriks, de Ochtendhaastige', age: 34,
        description: 'Scheert zich om 7:10 met een kind aan zijn been.',
        pains: ['elke ochtend sneetjes'], desires: ['klaar in twee minuten'],
        objections: ['weer zo een apparaat dat na een maand stomp is'],
        onzeker: 'Of hij al eerder een 4-in-1 had.'
      }) }] });
    };
    await wizPxBouw();
    window.wizCall = echt;
    const v = wizPx.voorstel;
    const d = document.createElement('div'); d.innerHTML = wizRenderPersonaBouwer();
    return { naam: v && v.naam, herkomst: v && v.herkomst, categorie: v && v.category,
             onzeker: v && v.onzeker,
             sysVraagtKlanttaal: /customer's own words/.test(gezienSys),
             sysVraagtTAM: /big enough to spend into/.test(gezienSys),
             sysEerlijk: /not from interviews/.test(gezienSys),
             merkOpScherm: /from product data, not interviews/.test(d.textContent),
             onzekerOpScherm: /Not certain/.test(d.textContent),
             nogNietInLijst: !(state.personas || []).some(x => x.id === (v || {}).id) };
  });
  check('hij komt uit de wizard, en dat staat erop', gebouwd.herkomst, 'wizard');
  check('met de categorie van het product', gebouwd.categorie, 'Shaver');
  /* De opdracht draagt de regels die het verschil maken tussen bruikbaar en
     gevaarlijk: klanttaal, een tribe die groot genoeg is, en eerlijk over
     wat hij niet weet. */
  check('de opdracht vraagt om klanttaal', gebouwd.sysVraagtKlanttaal, true);
  check('en om een groep die groot genoeg is', gebouwd.sysVraagtTAM, true);
  check('en zegt dat dit geen interviews zijn', gebouwd.sysEerlijk, true);
  check('het scherm draagt datzelfde merk', gebouwd.merkOpScherm, true);
  check('en toont wat hij niet zeker weet', gebouwd.onzekerOpScherm, true);
  /* Bewaren is een besluit van een mens, geen bijwerking van een generatie. */
  check('hij staat nog niet in de bibliotheek', gebouwd.nogNietInLijst, true);

  console.log('\n  gebruiken en bewaren zijn twee verschillende dingen');
  const gebruik = await page.evaluate(() => {
    const id = wizPx.voorstel.id;
    /* Het echte verschil is niet het label maar of hij wordt WEGGESCHREVEN.
       Gebruiken is voor deze ad; bewaren is een besluit van een mens. Zonder
       deze telling kan "gebruiken" stilletjes gaan bewaren zonder dat een
       test omvalt. */
    let opgeslagen = 0;
    const echteSave = window.savePersonas;
    window.savePersonas = function () { opgeslagen++; return echteSave.apply(this, arguments); };
    wizPxGebruik();
    const saveNaGebruik = opgeslagen;
    const naGebruik = { gekozen: wizState.data.audience.personaId === id,
                        inLijst: (state.personas || []).some(x => x.id === id),
                        herkomst: ((state.personas || []).filter(x => x.id === id)[0] || {}).herkomst };
    wizPxBewaar();
    const saveNaBewaar = opgeslagen;
    window.savePersonas = echteSave;
    const naBewaar = ((state.personas || []).filter(x => x.id === id)[0] || {}).herkomst;
    return { naGebruik, naBewaar, saveNaGebruik, saveNaBewaar };
  });
  check('gebruiken zet hem op deze ad', gebruik.naGebruik.gekozen, true);
  check('en in de lijst zodat alles hem vindt', gebruik.naGebruik.inLijst, true);
  check('nog steeds als werkpersona', gebruik.naGebruik.herkomst, 'wizard');
  check('bewaren maakt er een besluit van', gebruik.naBewaar, 'wizard-bewaard');
  check('gebruiken schrijft niets naar de bibliotheek', gebruik.saveNaGebruik, 0);
  check('bewaren wel', gebruik.saveNaBewaar, 1);

  console.log('\n  en op de audience-stap draagt hij zijn merk');
  const opStap = await page.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = (wizRender_audience() || {}).links || '';
    return { merk: !!d.querySelector('.wiz-pxmerk'),
             merkTekst: (d.querySelector('.wiz-pxmerk') || {}).textContent || '' };
  });
  check('de kaart zegt dat het een werkpersona is', opStap.merk, true);
  check('met die woorden', opStap.merkTekst, 'working persona');

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
