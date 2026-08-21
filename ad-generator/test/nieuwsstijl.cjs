/* De nieuws- en artikelstijl.
 *
 * Aanleiding: twee swipe files met 66 live statics die naar een advertorial
 * sturen of zich als nieuws voordoen. Wat het systeem hiervoor over dat
 * formaat wist was één zin ("opgemaakt als nieuwsartikel"), en dat is genoeg
 * om een model iets te laten tekenen dat vaag naar een krant riekt.
 *
 * Wat hier bewaakt wordt, in de volgorde waarop het misgaat:
 *
 *   1. DE LEER DRAAIT ALLEEN MEE ALS HET FORMAAT REDACTIONEEL IS. Op een
 *      productposter is een krantenkop geen verbetering maar ruis, en een
 *      opdracht die alles even hard roept stuurt niets meer.
 *
 *   2. HET ARCHETYPE BEREIKT HET BEELD. De anatomie kan keurig in de brief
 *      staan terwijl de beeldopdracht hem nooit ziet -- dat is precies wat er
 *      met de identiteitsregel gebeurde. Dus: de echte generateImage draaien
 *      met een onderschepte fetch en de verstuurde opdracht uitlezen.
 *
 *   3. DE VARIATIES HOUDEN DE STIJL VAST. De klacht was dat de derde variatie
 *      niet meer op een nieuwsartikel leek. Die brief is een andere dan de
 *      conceptbrief, en daar zat de stijl niet in.
 *
 *   4. ER WORDT GEEN AFZENDER VERZONNEN. Alle juridische ellende in die 66
 *      creatives kwam uit één plek: een uitgever, een logo, een keurmerk of
 *      een onderzoek dat niet bestond. Zolang er geen echte afzender staat
 *      hoort de mastheadpositie leeg te blijven, en hoort de keuzelijst er
 *      ook geen aan te bieden -- wat je aanbiedt wordt gekozen.
 *
 *   node ad-generator/test/nieuwsstijl.cjs
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const CHROOM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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

/* Een wizard met genoeg erin om een brief te kunnen bouwen. */
function OPZET() {
  wizOpen();
  state.products = [{ id: 'p1', name: 'Gentleman Shaver Elite', category: 'Shaver',
                      usps: ['4-in-1'], price: '49,95' }];
  wizState.data = wizBlankData();
  wizSet('product', 'productId', 'p1', 'user');
  wizSet('product', 'funnel', 'tof', 'user');
  wizSet('audience', 'awareness', 'problem', 'user');
  wizSet('strategy', 'marketingAngle', 'Scheren zonder irritatie', 'user');
  wizSet('strategy', 'messaging', 'Kern', 'user');
  wizSet('copy', 'headline', 'Kop', 'user');
}

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof wizNieuwsActief === 'function');

  console.log('\n  de leer draait alleen bij een redactioneel formaat');
  const aanuit = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    const uit = {};
    /* Een productposter: hier hoort geen letter nieuwsstijl bij te komen. */
    wizSet('format', 'formatId', 'product-hero', 'user');
    uit.posterActief = wizNieuwsActief();
    uit.posterBrief = wizNieuwsBrief();
    uit.posterBeeld = wizNieuwsBeeldregel();
    uit.posterPaneel = wizRenderNieuwsstijl();
    /* En een advertorial-formaat: hier wel. */
    wizSet('format', 'formatId', 'news-headline-advertorial', 'user');
    uit.nieuwsActief = wizNieuwsActief();
    uit.nieuwsArch = (wizNieuwsArchetype() || {}).id;
    return uit;
  }, OPZET.toString());
  check('op een productposter staat de leer uit', aanuit.posterActief, false);
  check('en levert hij geen brief', aanuit.posterBrief, '');
  check('geen beeldregel', aanuit.posterBeeld, '');
  check('en geen paneel', aanuit.posterPaneel, '');
  check('op een advertorial-formaat staat hij aan', aanuit.nieuwsActief, true);
  /* Zonder eigen keuze het archetype dat bij het formaat hoort: een leeg
     archetype zou betekenen dat de anatomie ontbreekt precies wanneer je hem
     nodig hebt. */
  check('met het archetype dat bij dat formaat hoort', aanuit.nieuwsArch, 'krantenkop');

  console.log('\n  en je eigen keuze wint van de standaard');
  const keuze = await page.evaluate(() => {
    wizSet('visual', 'newsArchetype', 'weetje', 'user');
    const eigen = (wizNieuwsArchetype() || {}).id;
    /* Een verzonnen archetype hoort geweigerd te worden: leeg is zichtbaar,
       een onbekende waarde ziet eruit als een besluit en is het niet. */
    const geweigerd = wizZetGevalideerd('visual', 'newsArchetype', 'kranten-achtig-iets', 'rory');
    return { eigen: eigen, geweigerd: geweigerd, na: wizState.data.visual.newsArchetype };
  });
  check('de gekozen stijl wint', keuze.eigen, 'weetje');
  check('een verzonnen stijl wordt geweigerd', keuze.geweigerd, false);
  check('en de keuze blijft staan', keuze.na, 'weetje');

  console.log('\n  de brief draagt de anatomie van precies dit archetype');
  const brief = await page.evaluate(() => {
    wizSet('visual', 'newsArchetype', 'redactietest', 'user');
    const t = wizNieuwsBrief();
    const arch = NIEUWS_ARCHETYPEN.filter(a => a.id === 'redactietest')[0];
    return {
      label: t.indexOf(arch.label) !== -1,
      /* Elke regel van de anatomie, niet alleen de eerste. Een brief die de
         helft meeneemt levert een half beeld. */
      alleRegels: arch.anatomie.filter(r => t.indexOf(r) === -1),
      weglaten: t.indexOf(arch.weglaten) !== -1,
      /* En niet de anatomie van een ander archetype: dan krijg je een
         krantenkop over een vergelijkingstest heen. */
      andere: t.indexOf(NIEUWS_ARCHETYPEN.filter(a => a.id === 'krantenkop')[0].anatomie[0]) !== -1,
      opval: NIEUWS_OPVAL.filter(r => t.indexOf(r) === -1).length,
      grens: NIEUWS_GRENS.filter(g => t.indexOf(g.nooit) === -1 || t.indexOf(g.wel) === -1).length
    };
  });
  check('het archetype staat er met naam', brief.label, true);
  check('elke regel van de anatomie staat erin', brief.alleRegels, []);
  check('inclusief wat er juist niet op mag', brief.weglaten, true);
  check('en niet de anatomie van een ander archetype', brief.andere, false);
  check('de negen opvallendheidsregels staan er', brief.opval, 0);
  /* De grens telkens mét het alternatief: een verbod zonder uitweg wordt
     genegeerd, en dan staat er alsnog een verzonnen keurmerk. */
  check('en de grens, elke regel met zijn alternatief', brief.grens, 0);

  console.log('\n  en de kopvormen bereiken de plek waar de kop geschreven wordt');
  /* Deze tien zijn uit levende campagnes gehaald en leeggeschraapt: er staat
     geen claim in, alleen de vorm. Zonder ze schrijft het model de kop die
     iedereen schrijft -- een belofte over het product -- terwijl de sterkste
     vormen juist de verklaring wegnemen die de lezer al had. */
  const koppen = await page.evaluate(() => {
    const t = wizNieuwsBrief();
    /* De copystap is waar de kop ontstaat, dus daar moeten ze staan en niet
       pas in de conceptbrief -- daar is de kop al goedgekeurd. */
    const vraagCopy = wizAdviesVraag('copy', WIZ_ADVICE_SPEC.copy, '');
    const vraagProduct = wizAdviesVraag('product', WIZ_ADVICE_SPEC.product, '');
    return {
      aantal: NIEUWS_KOPFORMULES.length,
      inBrief: NIEUWS_KOPFORMULES.filter(k => t.indexOf(k.vorm) === -1).length,
      metWaarom: NIEUWS_KOPFORMULES.filter(k => t.indexOf(k.waarom) === -1).length,
      inCopy: NIEUWS_KOPFORMULES.filter(k => vraagCopy.indexOf(k.vorm) === -1).length,
      /* En niet overal: een productstap heeft niets met kopvormen te maken. */
      inProduct: NIEUWS_KOPFORMULES.filter(k => vraagProduct.indexOf(k.vorm) !== -1).length,
      /* Geen enkele vorm mag zelf al een claim of een productnaam dragen --
         dan zou het systeem een bewering aanreiken in plaats van een vorm. */
      metHaakjes: NIEUWS_KOPFORMULES.filter(k => !/\[[^\]]+\]/.test(k.vorm)).length
    };
  });
  check('alle tien vormen staan er', koppen.aantal, 10);
  check('en gaan mee in de brief', koppen.inBrief, 0);
  check('met de reden waarom ze werken', koppen.metWaarom, 0);
  check('ze staan in de vraag aan de copystap', koppen.inCopy, 0);
  check('en niet in een stap die er niets mee te maken heeft', koppen.inProduct, 0);
  /* Op twee na is elke vorm een mal met open plekken. De twee zonder haakjes
     zijn volledige zinnen zonder claim ("De grootste denkfout bij..." heeft er
     wel een; "Een negatieve uitslag..." niet). */
  check('en op een na draagt elke vorm open plekken', koppen.metHaakjes, 1);

  console.log('\n  zonder echte afzender blijft de masthead leeg');
  const afzender = await page.evaluate(() => {
    /* Eigen archetype zetten: de redactietest uit het vorige blok stelt een
       extra eis aan de afzender, en dan meet dit blok die eis in plaats van
       de afzender zelf. */
    wizSet('visual', 'newsArchetype', 'krantenkop', 'user');
    wizSet('visual', 'newsAfzender', '', 'user');
    const zonder = { brief: wizNieuwsBrief(), beeld: wizNieuwsBeeldregel(), gaten: wizNieuwsGaten() };
    wizSet('visual', 'newsAfzender', 'eigen-domein', 'user');
    const met = { brief: wizNieuwsBrief(), beeld: wizNieuwsBeeldregel(), gaten: wizNieuwsGaten() };
    return { zonder: zonder, met: met,
             /* De keuzelijst zelf: hij hoort geen verzonnen uitgever aan te
                bieden, want wat je aanbiedt wordt gekozen. */
             opties: NIEUWS_AFZENDERS.map(a => a.value) };
  });
  check('de brief zegt dat de mastheadpositie leeg blijft',
    /Leave the masthead position EMPTY/.test(afzender.zonder.brief), true);
  check('en de beeldopdracht verbiedt een naam of logo',
    /Do not put any publication name, masthead, logo or seal/.test(afzender.zonder.beeld), true);
  check('met een afzender staat die er wel in',
    /The sender named on the image is: Our own domain/.test(afzender.met.beeld), true);
  check('en dan is de melding weg', afzender.met.gaten.length, 0);
  check('elke afzender in de lijst is een echte',
    afzender.opties, ['eigen-domein', 'founder', 'eigen-test', 'echte-plaatsing', 'echt-keurmerk']);

  console.log('\n  en een ontbrekende afzender is een melding met een uitweg');
  const gat = await page.evaluate(() => {
    wizSet('visual', 'newsArchetype', 'redactietest', 'user');
    wizSet('visual', 'newsAfzender', '', 'user');
    const alleen = wizNieuwsGaten();
    /* De redactietest zonder eigen test is geen stijlkwestie: dan staat er een
       onafhankelijk oordeel in beeld dat niemand geveld heeft. */
    wizSet('visual', 'newsAfzender', 'eigen-domein', 'user');
    const verkeerd = wizNieuwsGaten();
    wizSet('visual', 'newsAfzender', 'eigen-test', 'user');
    const goed = wizNieuwsGaten();
    /* En ze komen mee op de blueprint, waar de knop ze kan aanwijzen. */
    wizSet('visual', 'newsAfzender', '', 'user');
    const opBlueprint = wizBlueprintGaps().filter(g => g.veld === 'newsAfzender');
    return { alleen: alleen, verkeerd: verkeerd, goed: goed, opBlueprint: opBlueprint };
  });
  check('een leeg afzenderveld levert een gat met stap en veld',
    gat.alleen[0], { label: 'who this article is from', stap: 'visual', veld: 'newsAfzender' });
  check('de redactietest eist een echte test',
    gat.verkeerd.some(g => /test behind the scores/.test(g.label)), true);
  check('en met die test is er niets meer aan de hand', gat.goed, []);
  check('het gat komt terug op de blueprint', gat.opBlueprint.length > 0, true);

  console.log('\n  het paneel laat de zes stijlen zien met hun anatomie');
  const paneel = await page.evaluate(() => {
    wizSet('visual', 'newsArchetype', 'onthulling', 'user');
    wizSet('visual', 'newsAfzender', '', 'user');
    const d = document.createElement('div');
    d.innerHTML = wizRenderNieuwsstijl();
    const arch = NIEUWS_ARCHETYPEN.filter(a => a.id === 'onthulling')[0];
    return {
      kaarten: d.querySelectorAll('.wiz-nieuwskaart').length,
      aan: [].slice.call(d.querySelectorAll('.wiz-nieuwskaart.aan'))
        .map(b => (b.getAttribute('onclick') || '').replace(/\D*'([^']+)'.*/, '$1')),
      /* De anatomie hoort leesbaar te zijn vóór je genereert, niet in een
         uitklap: wat er straks op het beeld staat is de hele keuze. */
      regels: d.querySelectorAll('.wiz-nieuwsuit-r li').length,
      eersteRegel: (d.querySelector('.wiz-nieuwsuit-r li') || {}).textContent || '',
      bronvak: !!d.querySelector('.wiz-nieuwsbron'),
      bronLeeg: !!d.querySelector('.wiz-nieuwsbron.leeg'),
      bronOpties: d.querySelectorAll('.wiz-nieuwsbron option').length,
      anatomieAantal: arch.anatomie.length
    };
  });
  check('alle zes stijlen staan er', paneel.kaarten, 6);
  check('de gekozen stijl is de gemarkeerde', paneel.aan, ['onthulling']);
  check('de anatomie staat uitgeschreven', paneel.regels, paneel.anatomieAantal);
  check('met de eerste regel voluit', paneel.eersteRegel,
    'The headline in condensed sans capitals, tight tracking, two or three lines, maximum contrast.');
  check('en het afzendervak staat eronder', paneel.bronvak, true);
  check('gemerkt zolang er niets gekozen is', paneel.bronLeeg, true);
  /* Vijf echte afzenders plus de lege stand. Geen zesde optie. */
  check('met vijf echte keuzes en een lege stand', paneel.bronOpties, 6);

  console.log('\n  de conceptbrief en de variatiebrief dragen hem allebei');
  const briefjes = await page.evaluate(opzet => {
    eval('(' + opzet + ')()');
    wizSet('format', 'formatId', 'news-headline-advertorial', 'user');
    wizSet('visual', 'newsArchetype', 'krantenkop', 'user');
    wizSet('visual', 'newsAfzender', 'founder', 'user');
    wizState.data.concepts.list = [{ headline_nl: 'Kop', visual_nl: 'Beeld' }];
    wizState.data.concepts.selected = 0;
    const merk = NIEUWS_ARCHETYPEN.filter(a => a.id === 'krantenkop')[0].anatomie[0];
    const concept = wizBuildBrief(3);
    /* Beide passes: de visuele pass is wat je standaard draait, de hoekpass
       kies je bewust. Ze bouwen een andere brief. */
    wizState.data.generate.pass = 'visueel';
    const visueel = wizBuildTakeBrief();
    wizState.data.generate.pass = 'hoek';
    const hoek = wizBuildTakeBrief();
    return { concept: concept.indexOf(merk) !== -1,
             visueel: visueel.indexOf(merk) !== -1,
             hoek: hoek.indexOf(merk) !== -1 };
  }, OPZET.toString());
  check('de conceptbrief draagt de anatomie', briefjes.concept, true);
  /* Dit was de klacht: de derde variatie leek niet meer op een nieuwsartikel.
     De variatiebrief is een andere brief, en de stijl zat er niet in. */
  check('de visuele variatiebrief ook', briefjes.visueel, true);
  check('en de hoekpass ook', briefjes.hoek, true);

  console.log('\n  en de beeldopdracht die werkelijk de deur uit gaat');
  /* De brief kan kloppen terwijl de beeldopdracht hem nooit ziet. Dat is
     precies wat er met de identiteitsregel gebeurde, dus hier de echte
     generateImage met een onderschepte fetch. */
  const opdracht = await page.evaluate(async (pixel) => {
    window.__WG_TEAMSERVER = true;
    const prompts = [];
    const echteFetch = window.fetch;
    window.fetch = async (url, opties) => {
      if (!/\/v1\/images\//.test(String(url))) return echteFetch(url, opties);
      const body = opties && opties.body;
      prompts.push(String((body && body.get ? body.get('prompt') : (JSON.parse(body || '{}').prompt)) || ''));
      return { ok: true, json: async () => ({ data: [{ b64_json: 'AAA' }] }) };
    };
    wizSet('format', 'formatId', 'news-headline-advertorial', 'user');
    wizSet('visual', 'newsArchetype', 'weetje', 'user');
    wizSet('visual', 'newsAfzender', 'eigen-domein', 'user');
    wizState.data.visual.extraRefs = [pixel];
    state.lastGenerated = {
      variations: [{ headline_nl: 'K', image_prompt_en: 'iets', cta_nl: 'Nu' }],
      metadata: wizMetadata()
    };
    state.generatedImages = {}; state.basePhotos = {};
    if (!document.getElementById('gen-image-0')) {
      const vak = document.createElement('div'); vak.id = 'gen-image-0';
      document.body.appendChild(vak);
    }
    try { await generateImage(0); } catch (e) {}
    /* En dezelfde generatie op een productposter: daar hoort er geen woord
       nieuwsstijl in te staan. */
    wizSet('format', 'formatId', 'product-hero', 'user');
    state.lastGenerated.metadata = wizMetadata();
    state.generatedImages = {};
    try { await generateImage(0); } catch (e) {}
    window.fetch = echteFetch;
    return { nieuws: prompts[0] || '', poster: prompts[1] || '' };
  }, PIXEL);
  check('de opdracht noemt het redactionele formaat',
    /EDITORIAL FORMAT/.test(opdracht.nieuws), true);
  check('met de stijl die gekozen is',
    /the fact on a plain ground/.test(opdracht.nieuws), true);
  check('en de anatomie erbij',
    /Two or three lines of text in a serif/.test(opdracht.nieuws), true);
  check('de typografie ligt vast',
    /newspaper serif or condensed capitals, never a brand typeface/.test(opdracht.nieuws), true);
  check('de afzender staat erin',
    /The sender named on the image is: Our own domain/.test(opdracht.nieuws), true);
  check('en op een productposter staat er niets van dit alles',
    /EDITORIAL FORMAT/.test(opdracht.poster), false);

  console.log('\n  het besluit is later terug te vinden');
  /* Een stijlkeuze die alleen in de generatie leeft is na een week weg. De
     afzender vooral: als er ooit een klacht komt is dat de vraag. */
  const dossier = await page.evaluate(() => {
    wizSet('format', 'formatId', 'news-headline-advertorial', 'user');
    wizSet('visual', 'newsArchetype', 'tijdschriftpagina', 'user');
    wizSet('visual', 'newsAfzender', 'echte-plaatsing', 'user');
    const regels = wizDossierVan(wizBriefZonderBeeld(wizState.data));
    const vind = k => (regels.filter(r => r.key === k)[0] || {}).tekst;
    return { stijl: vind('newsArchetype'), afzender: vind('newsAfzender') };
  });
  check('de artikelstijl staat in het dossier', dossier.stijl, 'The magazine page');
  check('met het label van de afzender, niet de sleutel',
    dossier.afzender, 'A real placement with a real publisher');

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
