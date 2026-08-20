/* Terugkomen in een bewaarde sessie.
 *
 * De klacht: je staat op stap 8, ziet je drie uitgewerkte concepten staan,
 * drukt op "Generate 3 previews" en krijgt "Work out the concepts first".
 * Een melding die wordt tegengesproken door het scherm ernaast.
 *
 * De oorzaak: de wizard bewaart zichzelf in localStorage, maar
 * state.lastGenerated doet dat niet en begint elke sessie op null. De
 * concepten waren er dus wel, alleen de brug naar de beeldpijplijn niet.
 *
 * De data was er de hele tijd -- concepts.list IS de lijst variaties -- dus
 * die hoort hersteld te worden in plaats van geweigerd.
 *
 *   node ad-generator/test/hervatten.cjs
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

const OPZET = () => {
  state.products = [{ id: 'p1', name: 'Gentleman Shaver Elite', category: 'Shaver',
                      usps: ['4-in-1'], references: { product: [], lifestyle: [], usage: [], packaging: [] } }];
  state.personas = [{ id: 'pe1', name: 'Mark', category: 'Shaver' }];
  wizOpen();
  wizSet('product', 'productId', 'p1', 'user');
  wizSet('audience', 'personaId', 'pe1', 'user');
  wizState.data.concepts.list = [
    { headline_nl: 'Waarom wij €49,95 vragen', visual_nl: 'De oprichter in Helmond', image_prompt_en: 'a' },
    { headline_nl: '€150 minder, zelfde scheerbeurt', visual_nl: 'Aan zijn bureau', image_prompt_en: 'b' },
    { headline_nl: 'Dit is de reclame', visual_nl: 'In een magazijn', image_prompt_en: 'c' }
  ];
  wizState.data.concepts.selected = null;
  /* Precies de toestand na terugkomen: de wizard is hersteld uit de opslag,
     maar de generatorbrug bestaat nog niet. */
  state.lastGenerated = null;
  state.generatedImages = {};
};

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof wizOpen === 'function' && typeof wizHerstelGeneratie === 'function');

  console.log('\n  bewaarde concepten zonder generatorbrug');
  const herstel = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    const voor = !!state.lastGenerated;
    const gelukt = wizHerstelGeneratie();
    /* Voorzichtig uitlezen. Faalt het herstel, dan hoort deze test een FOUT
       te melden en niet met een uitzondering af te breken: een test die
       crasht rapporteert niets, en dan lijkt een mutatie die hem sloopt juist
       overleefd te hebben. */
    const lg = state.lastGenerated || {};
    const vars = lg.variations || [];
    return { voor: voor, gelukt: gelukt,
             variaties: vars.length,
             eersteKop: vars.length ? vars[0].headline_nl : null,
             metaProduct: (lg.metadata || {}).product || null,
             gemerkt: lg.hersteld === true };
  }, OPZET.toString());
  check('er was geen brug', herstel.voor, false);
  check('en die is er nu wel', herstel.gelukt, true);
  check('met de drie bewaarde concepten', herstel.variaties, 3);
  check('en hun eigen koppen', herstel.eersteKop, 'Waarom wij €49,95 vragen');
  check('de metadata komt uit de wizard', herstel.metaProduct, 'Gentleman Shaver Elite');
  /* Zodat later te zien is dat dit uit de opslag komt en niet vers uit het
     model: anders lijkt een herstelde sessie een verse generatie. */
  check('en het staat er als hersteld bij', herstel.gemerkt, true);

  console.log('\n  zonder concepten valt er niets te herstellen');
  const leeg = await page.evaluate(() => {
    wizState.data.concepts.list = [];
    state.lastGenerated = null;
    return { gelukt: wizHerstelGeneratie(), brug: !!state.lastGenerated };
  });
  check('hij verzint geen generatie uit het niets', leeg.gelukt, false);
  check('en laat de brug leeg', leeg.brug, false);

  console.log('\n  een bestaande generatie wordt niet overschreven');
  /* Kopieer ad en Itereren zetten hun eigen lastGenerated. Die hoort de
     wizard niet weg te duwen. */
  const vreemd = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    state.lastGenerated = { variations: [{ headline_nl: 'Van Kopieer ad' }], metadata: { product: 'Iets anders' } };
    const gelukt = wizHerstelGeneratie();
    const lg = state.lastGenerated || {}; const vars = lg.variations || [];
    return { gelukt: gelukt, kop: vars.length ? vars[0].headline_nl : null,
             aantal: vars.length };
  }, OPZET.toString());
  check('hij zegt dat er iets bruikbaars staat', vreemd.gelukt, true);
  check('en laat die generatie met rust', vreemd.kop, 'Van Kopieer ad');
  check('zonder er concepten bij te duwen', vreemd.aantal, 1);

  console.log('\n  en de knop doet nu wat hij zegt');
  const knop = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    const meldingen = [];
    const echteToast = window.toast;
    window.toast = m => meldingen.push(String(m));
    /* generateImage onderscheppen: we toetsen dat de beeldpijplijn wordt
       aangeroepen, niet of OpenAI antwoordt. */
    const gevraagd = [];
    const echteGen = window.generateImage;
    window.generateImage = i => { gevraagd.push(i); return Promise.resolve(); };
    wizPreviewAll();
    window.generateImage = echteGen;
    window.toast = echteToast;
    return { gevraagd: gevraagd, meldingen: meldingen };
  }, OPZET.toString());
  check('alle drie de previews worden gevraagd', knop.gevraagd, [0, 1, 2]);
  /* Dit is de klacht: een melding die je tegenspreekt terwijl de concepten
     zichtbaar op het scherm staan. */
  check('en er komt geen "werk eerst de concepten uit"',
    knop.meldingen.filter(m => /Work out the concepts first/.test(m)), []);

  console.log('\n  drie previews starten er ook echt drie');
  /* De knop riep wizPreview drie keer aan, en die tekent zelf. Elke herteken
     bouwt de kaarten opnieuw op en veegde daarmee de laadstatus van de vorige
     twee weg: van drie gestarte previews bleef er zichtbaar een over, de
     laatste, omdat daarna niets meer hertekende. */
  const drie = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    const gevraagd = [];
    let hertekens = 0;
    const echteGen = window.generateImage;
    const echteRender = window.wizRender;
    window.generateImage = i => { gevraagd.push(i); return Promise.resolve(); };
    window.wizRender = function () { hertekens++; return echteRender.apply(this, arguments); };
    wizPreviewAll();
    window.generateImage = echteGen;
    window.wizRender = echteRender;
    return { gevraagd: gevraagd, hertekens: hertekens,
             bezig: Object.keys(wizBeeldBezig).sort() };
  }, OPZET.toString());
  check('alle drie worden gestart', drie.gevraagd, [0, 1, 2]);
  check('en alle drie staan als bezig gemerkt', drie.bezig, ['0', '1', '2']);
  /* Een keer tekenen, niet per preview: dat is wat de vorige twee wegvaagde. */
  check('er wordt maar een keer hertekend', drie.hertekens, 1);

  console.log('\n  en een bezige kaart zegt dat ook');
  const kaart = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    Object.keys(wizBeeldBezig).forEach(k => { delete wizBeeldBezig[k]; });
    const leeg = (() => {
      const d = document.createElement('div');
      d.innerHTML = wizRender_concepts();
      return { geen: d.querySelectorAll('.wiz-concept-geenbeeld').length,
               bezig: d.querySelectorAll('.wiz-concept-bezig').length };
    })();
    wizBeeldBezig[0] = true; wizBeeldBezig[2] = true;
    const d2 = document.createElement('div');
    d2.innerHTML = wizRender_concepts();
    const uit = { geen: d2.querySelectorAll('.wiz-concept-geenbeeld').length,
                  bezig: d2.querySelectorAll('.wiz-concept-bezig').length,
                  spinner: d2.querySelectorAll('.wiz-concept-spin').length };
    Object.keys(wizBeeldBezig).forEach(k => { delete wizBeeldBezig[k]; });
    return { leeg: leeg, bezig: uit };
  }, OPZET.toString());
  check('zonder beelden staan er drie lege kaarten', drie.gevraagd.length && kaart.leeg.geen, 3);
  check('en geen enkele bezig', kaart.leeg.bezig, 0);
  check('met twee lopende previews staan er twee bezig', kaart.bezig.bezig, 2);
  check('en nog een lege ernaast', kaart.bezig.geen, 1);
  check('met een draaiend teken erin', kaart.bezig.spinner, 2);

  console.log('\n  stap 9 vindt zijn takes ook terug');
  const takes = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    wizState.data.concepts.selected = 1;
    const idx = wizTakeIndexen();
    const vars = (state.lastGenerated || {}).variations || [];
    return { idx: idx, aantal: idx.length,
             eerste: (idx.length && vars[idx[0]]) ? vars[idx[0]].headline_nl : null };
  }, OPZET.toString());
  check('er zijn drie takeplekken', takes.aantal, 3);
  check('en ze dragen het gekozen concept', takes.eerste, '€150 minder, zelfde scheerbeurt');

  console.log('\n  de drie variaties gooien de founder niet uit beeld');
  /* De spreiding stond vast: take 2 een macro zonder mens, take 3 het product
     met labels. Voor een productadvertentie prima, voor een founder-ad
     verwoestend -- twee van de drie takes gooien dan precies weg waar het
     concept om draait. */
  const spreiding = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    wizState.data.concepts.selected = 0;
    wizState.data.strategy.messaging = 'Kern';
    wizState.data.copy.headline = 'Vanuit Helmond';

    wizState.data.visual.humanPresence = 'none';
    const zonderMens = { spreiding: wizTakeSpreiding(), brief: wizBuildTakeBrief() };
    wizState.data.visual.humanPresence = 'founder';
    const metFounder = { spreiding: wizTakeSpreiding(), brief: wizBuildTakeBrief() };
    wizState.data.generate.pass = 'hoek';
    const hoekpass = wizBuildTakeBrief();
    wizState.data.generate.pass = 'visueel';
    wizState.data.visual.humanPresence = '';
    return { zonderMens, metFounder, hoekpass };
  }, OPZET.toString());
  /* Zonder mens blijft de oude spreiding staan: die klopt daar wel. */
  check('zonder mens mag take 2 een macro zonder mens zijn',
    /an extreme macro of the area or the mechanism/.test(spreiding.zonderMens.spreiding), true);
  check('met een founder juist niet',
    /an extreme macro of the area or the mechanism/.test(spreiding.metFounder.spreiding), false);
  check('en staat hij in alle drie in beeld',
    /the founder is in frame in ALL THREE takes/.test(spreiding.metFounder.spreiding), true);
  /* Wat er dan wel varieert: houding, blik, afstand, omgeving. Precies wat
     je van drie variaties van hetzelfde idee verwacht. */
  check('wat varieert is houding, blik, afstand en omgeving',
    /the pose, the expression, the distance and the setting/.test(spreiding.metFounder.spreiding), true);
  /* En het moet dezelfde man blijven: een ander gezicht in take 2 leest als
     een stockfoto en haalt de hele reden voor een echte founder weg. */
  check('en het blijft dezelfde persoon',
    /same face, same build/.test(spreiding.metFounder.spreiding), true);
  check('de takebrief draagt die spreiding ook echt',
    /is in frame in ALL THREE takes/.test(spreiding.metFounder.brief), true);
  check('ook in de hoekpass', /is in frame in ALL THREE takes/.test(spreiding.hoekpass), true);

  console.log('\n  alle drie de variaties worden bewaard, niet een');
  /* Een concept is een ad set en die krijgt drie variaties die naast elkaar
     draaien. Er een opslaan gooit twee beelden weg die je zelf hebt betaald,
     en dan is achteraf niet meer te zien welke drie bij elkaar hoorden. */
  const bewaren = await page.evaluate(async opzet => {
    eval('(' + opzet + ')()');
    wizState.data.concepts.selected = 0;
    const idx = wizTakeIndexen();
    state.generatedImages = {};
    idx.forEach(i => { state.generatedImages[i] = { versions: [{ b64: 'AAA', mime: 'image/png' }], currentIndex: 0 }; });
    wizState.data.generate.selectedTake = idx[1];
    const bewaard = [];
    const echt = window.saveToLibraryFromCard;
    window.saveToLibraryFromCard = i => { bewaard.push(i); return Promise.resolve(); };
    const echteTab = window.switchMainTab; window.switchMainTab = () => {};
    const meldingen = []; const echteToast = window.toast;
    window.toast = m => meldingen.push(String(m));
    await wizHandOff();
    window.saveToLibraryFromCard = echt; window.switchMainTab = echteTab; window.toast = echteToast;
    return { bewaard, idx, meldingen };
  }, OPZET.toString());
  check('alle drie gaan de bibliotheek in', bewaren.bewaard.length, 3);
  /* De gekozen vooraan, zodat hij in de bibliotheek de eerste van de groep is. */
  check('de gekozen staat vooraan', bewaren.bewaard[0], bewaren.idx[1]);
  check('en de melding zegt dat het er drie zijn',
    bewaren.meldingen.some(m => /All 3 variations saved as one ad set/.test(m)), true);

  console.log('\n  zonder beeld valt er niets te bewaren');
  const geenBeeld = await page.evaluate(async opzet => {
    eval('(' + opzet + ')()');
    wizState.data.concepts.selected = 0;
    wizTakeIndexen();
    state.generatedImages = {};
    const bewaard = [];
    const echt = window.saveToLibraryFromCard;
    window.saveToLibraryFromCard = i => { bewaard.push(i); return Promise.resolve(); };
    const meldingen = []; const echteToast = window.toast;
    window.toast = m => meldingen.push(String(m));
    await wizHandOff();
    window.saveToLibraryFromCard = echt; window.toast = echteToast;
    return { bewaard, meldingen };
  }, OPZET.toString());
  check('er wordt niets opgeslagen', geenBeeld.bewaard, []);
  check('met de reden erbij',
    geenBeeld.meldingen.some(m => /Generate the takes first/.test(m)), true);

  console.log('\n  een aanpassing laat zien dat hij loopt');
  /* Na "Apply this change" gebeurde er zichtbaar niets: de bewerking startte,
     maar de wizard hertekende meteen en veegde de laadstatus weg die het
     bewerkpaneel in het beeldvak had gezet. */
  const bewerken = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    wizState.data.concepts.selected = 0;
    const idx = wizTakeIndexen();
    state.generatedImages = {};
    idx.forEach(i => { state.generatedImages[i] = { versions: [{ b64: 'AAA', mime: 'image/png' }], currentIndex: 0 }; });
    wizState.data.generate.selectedTake = idx[0];
    wizState.tweakOpen = 'model';
    let gestart = null;
    const echt = window.applyCombinedEdits;
    window.applyCombinedEdits = i => { gestart = i; return Promise.resolve(); };
    wizTweak();
    window.applyCombinedEdits = echt;
    const d = document.createElement('div');
    d.innerHTML = (wizRender_generate() || '');
    const bezigNu = wizBewerkBezig;
    wizBewerkBezig = null;
    return { gestart, bezig: bezigNu, idx0: idx[0],
             opScherm: !!d.querySelector('.wiz-take-bewerkt'),
             tekst: (d.querySelector('.wiz-take-bewerkt') || {}).textContent || '' };
  }, OPZET.toString());
  check('de bewerking wordt gestart op de gekozen variatie', bewerken.gestart, bewerken.idx0);
  check('en staat als lopend gemerkt', bewerken.bezig, bewerken.idx0);
  check('met een zichtbare regel op de kaart', bewerken.opScherm, true);
  check('die zegt wat er gebeurt', /Applying your change/.test(bewerken.tekst), true);

  console.log('\n  en je kunt een foto meegeven in plaats van hem te beschrijven');
  /* "Change model" met alleen woorden is een gok: hoe iemand eruit moet zien
     laat je zien. */
  const fotoBijEdit = await page.evaluate(async opzet => {
    eval('(' + opzet + ')()');
    wizState.data.concepts.selected = 0;
    const idx = wizTakeIndexen();
    state.generatedImages = {};
    idx.forEach(i => { state.generatedImages[i] = { versions: [{ b64: 'AAA', mime: 'image/png' }], currentIndex: 0 }; });
    wizState.data.generate.selectedTake = idx[0];
    wizState.tweakOpen = 'model';

    const paneel = document.createElement('div');
    paneel.innerHTML = wizTweakPaneel();
    const heeftVak = !!paneel.querySelector('.wiz-refdrop');

    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = await (await fetch(px)).blob();
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'model.png', { type: 'image/png' }));
    await wizTweakFotoLees(dt.files);
    const naToevoegen = wizTweakFotos.length;

    const echt = window.applyCombinedEdits;
    window.applyCombinedEdits = () => Promise.resolve();
    wizTweak();
    window.applyCombinedEdits = echt;
    const refs = (state.pendingEditRefs || {})[idx[0]] || [];
    const leeggemaakt = wizTweakFotos.length;
    wizBewerkBezig = null;
    return { heeftVak, naToevoegen, refs: refs.length,
             mime: refs.length ? refs[0].mimeType : null, leeggemaakt };
  }, OPZET.toString());
  check('het bewerkpaneel heeft een sleepvak', fotoBijEdit.heeftVak, true);
  check('een gesleepte foto komt erbij', fotoBijEdit.naToevoegen, 1);
  check('en gaat mee als visuele referentie', fotoBijEdit.refs, 1);
  check('in de vorm die het bewerkpaneel verwacht', fotoBijEdit.mime, 'image/png');
  /* Ze horen bij die ene wijziging, dus daarna zijn ze weg -- anders sleep je
     ze ongemerkt mee naar de volgende. */
  check('daarna is het vak weer leeg', fotoBijEdit.leeggemaakt, 0);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
