/* Drie klachten uit één sessie, en ze hangen samen: je ziet niet wat er
 * gebeurt, en je bepaalt niet wat er meegaat.
 *
 *   1. HET INTERVIEW DEED NIETS. Op "from a customer persona" gebeurde
 *      niets. De openingsanalyse zette dezelfde bezig-vlag als het gesprek,
 *      dus elke klik liep tegen "if (busy) return" aan -- stil. Er gebeurde
 *      juist iets, alleen onzichtbaar, en met de nieuwe herkansingen kan die
 *      aanroep tientallen seconden duren.
 *
 *   2. DUS MOET WACHTEN ZICHTBAAR ZIJN. Een balk bovenaan, met wat er
 *      gebeurt, zolang er werkelijk iets loopt.
 *
 *   3. EN REFERENTIEBEELDEN. De generator stuurde alles van het product mee
 *      en je zag er een. Nu staan ze er allemaal, kun je er een uitzetten, en
 *      kun je een eigen foto (de founder, een model) erbij slepen.
 *
 *   node ad-generator/test/referenties.cjs
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

/* Echte piepkleine plaatjes, zodat de dropzone met een echte File werkt.
   Vier ONDERSCHEIDBARE plaatjes en niet vier keer hetzelfde: een implementatie
   die op de data-url uitsluit in plaats van op de positie haalt anders alle
   identieke foto's tegelijk weg, en met vier kopieen van dezelfde pixel zie
   je dat verschil niet. Precies die fout zat er eerst in. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PIXELS = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z1BfDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='
];

const OPZET = `
  state.products = [{ id: 'p1', name: 'Gentleman Shaver Elite', category: 'Shaver',
    usps: ['4-in-1'],
    references: { product: ['${PIXELS[0]}', '${PIXELS[1]}'], usage: ['${PIXELS[2]}'],
                  lifestyle: ['${PIXELS[3]}'], packaging: [] } }];
  state.personas = [{ id: 'pe1', name: 'Mark de Vries', role: 'Relatie-pragmaticus', pains: ['sneetjes'] },
                    { id: 'pe2', name: 'Tom', role: 'Starter', pains: ['tijd'] }];
`;

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof wizOpen === 'function' && typeof wizRefLijst === 'function');

  console.log('\n  het interview loopt niet meer vast op zijn eigen analyse');
  /* De openingsanalyse vult "wat ik tot nu toe begrepen heb". Nuttig, maar hij
     bepaalt de eerste vraag niet, dus hij hoort het gesprek niet stil te
     leggen. Toen dit dezelfde vlag was, deed elke klik niets. */
  const gesprek = await page.evaluate(async (opzet) => {
    eval(opzet);
    wizOpen();
    wizSet('product', 'productId', 'p1', 'user');
    iw2Start();
    /* Doen alsof de analyse loopt: precies de toestand waarin de gebruiker
       klikte. Geen echte aanroep, want die hangt van het netwerk af. */
    iw2.analyseBezig = true;
    const voor = { vraag: (iw2Vraag() || {}).key, spoor: iw2.spoor };
    iw2Kies('persona');
    const na = { vraag: (iw2Vraag() || {}).key, spoor: iw2.spoor, i: iw2.i };
    const opties = [].slice.call(document.querySelectorAll('.iw2-optie'))
      .map(e => e.textContent.trim().split('\n')[0].slice(0, 20));
    iw2.analyseBezig = false;
    return { voor, na, opties };
  }, OPZET);
  check('de eerste vraag is de startvraag', gesprek.voor.vraag, 'start');
  check('en een klik komt door terwijl de analyse loopt', gesprek.na.spoor, 'persona');
  check('het gesprek staat op de personavraag', gesprek.na.vraag, 'persona');
  check('met de persona\'s als antwoord', gesprek.opties.length >= 2, true);

  console.log('\n  maar een lopende BEURT blokkeert wel, want anders lopen er twee door elkaar');
  const beurt = await page.evaluate(() => {
    const voor = iw2.spoor;
    iw2.busy = true;
    iw2Kies('angle');
    const na = iw2.spoor;
    iw2.busy = false;
    return { voor, na };
  });
  check('een tweede antwoord tijdens een lopende beurt wordt genegeerd',
    beurt.na, beurt.voor);

  console.log('\n  en wachten is zichtbaar, met wat er gebeurt');
  const balk = await page.evaluate(() => {
    const meet = () => {
      const h = iw2RenderBezig();
      const d = document.createElement('div'); d.innerHTML = h;
      const el = d.querySelector('.iw2-bezig');
      return { er: !!el, tekst: el ? el.textContent.trim() : '', balk: !!d.querySelector('.iw2-bezig-balk span') };
    };
    iw2.busy = false; iw2.analyseBezig = false; iw2.klaar = false;
    const rustig = meet();
    iw2.analyseBezig = true;
    const analyse = meet();
    iw2.analyseBezig = false; iw2.busy = true;
    const denkt = meet();
    iw2.klaar = true;
    const blueprint = meet();
    iw2.busy = false; iw2.klaar = false;
    return { rustig, analyse, denkt, blueprint };
  });
  check('als er niets loopt staat er geen balk', balk.rustig.er, false);
  check('tijdens de openingsanalyse wel', balk.analyse.er, true);
  check('en die zegt wat hij doet',
    /reading the product data and the customer research/.test(balk.analyse.tekst), true);
  check('bij een antwoord zegt hij dat hij daarover nadenkt',
    /thinking about your answer/.test(balk.denkt.tekst), true);
  check('en bij de blueprint iets anders',
    /writing out the angle/.test(balk.blueprint.tekst), true);
  check('er zit een bewegend deel in, geen stilstaand vlak', balk.analyse.balk, true);

  console.log('\n  de referentiebeelden staan er allemaal, niet één');
  const refs = await page.evaluate(() => {
    wizGo('product');
    const lijst = wizRefLijst();
    const d = document.createElement('div');
    d.innerHTML = wizRenderReferenties();
    return {
      aantal: lijst.length,
      bakken: lijst.map(r => r.bak),
      allemaalAan: lijst.every(r => r.aan),
      inGebruik: wizRefsInGebruik().length,
      miniaturen: d.querySelectorAll('.wiz-ref img').length,
      dropzone: !!d.querySelector('.wiz-refdrop'),
      telling: (d.querySelector('.wiz-refs-telling') || {}).textContent
    };
  });
  /* Twee productshots, een gebruiksfoto en een lifestyle: vier in totaal. */
  check('alle vier de referenties staan er', refs.aantal, 4);
  check('per bak gegroepeerd', refs.bakken, ['product', 'product', 'usage', 'lifestyle']);
  check('en ze doen standaard allemaal mee', refs.allemaalAan, true);
  check('het paneel toont ze ook echt', refs.miniaturen, 4);
  check('met een plek om er een bij te slepen', refs.dropzone, true);
  check('en de telling klopt', refs.telling, '4 in use');

  console.log('\n  en het paneel staat werkelijk op stap 1, niet alleen in een functie');
  /* wizRenderReferenties() aanroepen bewijst dat de HTML klopt, niet dat hij
     ergens terechtkomt. Deze controle ontbrak, en daardoor had de stap het
     paneel kunnen missen zonder dat een test omviel. */
  const inPagina = await page.evaluate(() => {
    /* Het interview stond nog open uit het blok hierboven, en dan toont de
       wizard het gesprek in plaats van stap 1. Eerst dicht. */
    iw2.open = false;
    switchMainTab('generator');
    wizGo('product');
    wizRender();
    const el = document.querySelector('#wiz-inline .wiz-refs');
    const r = el ? el.getBoundingClientRect() : null;
    return { er: !!el, breed: r ? r.width > 100 : false, hoog: r ? r.height > 60 : false,
             tegels: document.querySelectorAll('#wiz-inline .wiz-ref').length,
             drop: !!document.querySelector('#wiz-inline .wiz-refdrop') };
  });
  check('het paneel staat in de wizard zelf', inPagina.er, true);
  check('en heeft werkelijk afmetingen', [inPagina.breed, inPagina.hoog], [true, true]);
  check('met de tegels erin', inPagina.tegels >= 4, true);
  check('en de sleepplek', inPagina.drop, true);

  console.log('\n  er een uitzetten houdt hem uit de generatie');
  const uitzetten = await page.evaluate(() => {
    wizRefToggle('product:1');
    const lijst = wizRefLijst();
    const meta = wizMetadata();
    return { aan: lijst.filter(r => r.aan).length,
             uitInMeta: (meta.refKeuze || {}).uit,
             inGebruik: wizRefsInGebruik().length,
             nogSteedsZichtbaar: lijst.length };
  });
  check('er doen er nog drie mee', uitzetten.aan, 3);
  /* Weghalen zou de indruk wekken dat de foto er niet meer is; hij blijft
     staan, gedimd, zodat je hem terug kunt zetten. */
  check('maar hij blijft wel zichtbaar', uitzetten.nogSteedsZichtbaar, 4);
  check('en de generator krijgt te horen welke eruit moet',
    uitzetten.uitInMeta, ['product:1']);
  check('wizRefsInGebruik telt hem niet mee', uitzetten.inGebruik, 3);

  console.log('\n  en een eigen foto erbij slepen');
  const eigen = await page.evaluate(async (pixel) => {
    const blob = await (await fetch(pixel)).blob();
    const file = new File([blob], 'founder.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    await wizRefLees(dt.files);
    const meta = wizMetadata();
    const d = document.createElement('div'); d.innerHTML = wizRenderReferenties();
    return { extra: (wizState.data.visual.extraRefs || []).length,
             inGebruik: wizRefsInGebruik().length,
             inMeta: ((meta.refKeuze || {}).extra || []).length,
             eigenTegels: d.querySelectorAll('.wiz-ref.eigen').length,
             telling: (d.querySelector('.wiz-refs-telling') || {}).textContent };
  }, PIXEL);
  check('de foto staat erbij', eigen.extra, 1);
  check('en telt mee in wat er gebruikt wordt', eigen.inGebruik, 4);
  check('de generator krijgt hem mee', eigen.inMeta, 1);
  check('hij staat als eigen tegel in het paneel', eigen.eigenTegels, 1);
  check('en de telling telt hem mee', eigen.telling, '4 in use');

  console.log('\n  de bibliotheek wordt niet volgestouwd met dezelfde foto');
  /* De brief wordt bij ELKE bewaarde variatie meegekopieerd. Data-urls daarin
     betekent dezelfde foto tien keer in de opslag, terwijl het dossier alleen
     de beslissingen nodig heeft. */
  const licht = await page.evaluate(() => {
    wizState.data.visual.basisFoto = 'data:image/png;base64,' + 'A'.repeat(400);
    const meta = wizMetadata();
    const b = meta.wizardBrief.visual;
    return { basis: b.basisFoto, gebruikt: b.basisFotoGebruikt,
             extra: b.extraRefs.length, aantal: b.extraRefsAantal,
             refKeuzeHeeftHemNog: (meta.refKeuze.extra || []).length };
  });
  check('de basisfoto zit niet in de brief', licht.basis, null);
  check('maar je ziet nog wel dat er een was', licht.gebruikt, true);
  check('de eigen referenties ook niet', licht.extra, 0);
  check('met hun aantal bewaard', licht.aantal, 1);
  /* De generator heeft ze wel nodig: die leest refKeuze, niet de brief. */
  check('en de generator krijgt ze nog steeds', licht.refKeuzeHeeftHemNog, 1);

  console.log('\n  en de generator stuurt werkelijk die beelden mee');
  /* Het paneel kan kloppen terwijl de generator er niets mee doet, en dan is
     het een mooie leugen. Dus: de echte generateImage draaien met een
     onderschepte fetch, en tellen wat er de deur uit gaat. */
  const echt = await page.evaluate(async (pixel) => {
    /* De generator wil een sleutel zien voor hij iets doet. Teamserver-modus
       is precies wat de console in productie draait. */
    window.__WG_TEAMSERVER = true;
    const gezien = [];
    const echteFetch = window.fetch;
    window.fetch = async (url, opties) => {
      /* Alleen de beeld-API onderscheppen. De generator gebruikt fetch OOK om
         zijn data-urls naar blobs te lezen; die moeten gewoon door, anders
         valt hij stil voordat hij bij de API is. */
      if (!/\/v1\/images\//.test(String(url))) return echteFetch(url, opties);
      const beelden = (opties && opties.body && opties.body.getAll) ? opties.body.getAll('image[]') : [];
      gezien.push({ url: String(url).replace(/^https?:\/\/[^/]+/, ''), aantal: beelden.length });
      return { ok: true, json: async () => ({ data: [{ b64_json: 'AAA' }] }) };
    };
    /* Vier productreferenties, waarvan er een uit staat, plus een eigen foto:
       drie plus een is vier beelden. */
    wizState.data.visual.refsUit = ['product:1'];
    wizState.data.visual.extraRefs = [pixel];
    state.lastGenerated = {
      variations: [{ headline_nl: 'K', image_prompt_en: 'iets', cta_nl: 'Nu' }],
      metadata: wizMetadata()
    };
    state.generatedImages = {};
    state.basePhotos = {};
    /* De generator schrijft zijn laadstatus in het beeldvak van de kaart. In
       de app staat dat er omdat de resultaten getekend zijn; hier zetten we
       alleen dat ene element klaar. */
    if (!document.getElementById('gen-image-0')) {
      const vak = document.createElement('div'); vak.id = 'gen-image-0';
      document.body.appendChild(vak);
    }
    let mislukt = null;
    try { await generateImage(0); } catch (e) { mislukt = e.message; }
    window.fetch = echteFetch;
    return { gezien: gezien, mislukt: mislukt };
  }, PIXEL);
  check('er ging een beeldaanroep de deur uit', [echt.gezien.length, echt.mislukt], [1, null]);
  /* Drie overgebleven productreferenties plus de eigen foto. Stond de
     uitgezette er nog bij, dan waren het er vijf; deed de eigen foto niet
     mee, dan drie. */
  check('met precies de gekozen beelden erin', echt.gezien[0] && echt.gezien[0].aantal, 4);

  console.log('\n  een nieuwe ad begint met een schone keuze');
  const schoon = await page.evaluate(() => {
    const d = wizBlankData();
    return { uit: d.visual.refsUit, extra: d.visual.extraRefs };
  });
  check('geen uitgezette referenties', schoon.uit, []);
  check('en geen eigen foto\'s van de vorige ad', schoon.extra, []);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
