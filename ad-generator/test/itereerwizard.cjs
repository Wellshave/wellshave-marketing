/* De itereerwizard — de consolekant.
 *
 * De bronlaag staat in platform/worker/test/itereren.mjs. Hier gaat het om wat
 * het scherm met die cijfers doet, en dat is een ander soort risico. Vier
 * fouten, alle vier stil:
 *
 *   1. TWEE WAARHEDEN IN DEZELFDE PROMPT. Het oude formulier bestaat nog als
 *      terugval en houdt zijn oude waarden. Als beide invoerwegen meetellen,
 *      krijgt het model cijfers van een advertentie die niet bestaat -- en dan
 *      is de diagnose op niets gebaseerd terwijl hij er overtuigd uitziet.
 *
 *   2. HET LEK NA DE KLIK WORDT EEN CREATIVE-OPDRACHT. De duurste. Zit het
 *      lek op de pagina of bij het afrekenen, dan lost een nieuwe hook niets
 *      op; drie iteraties lekken dan alle drie even hard. Dat moet op het
 *      scherm staan én in wat er naar het model gaat.
 *
 *   3. TE WEINIG DATA KRIJGT EEN OORDEEL. Een conversiepercentage op zeven
 *      klikken is ruis. Ruis met een kleurtje eromheen is erger dan geen
 *      oordeel.
 *
 *   4. ONBEKEND WORDT NUL. Een streepje zegt "wij weten het niet". Een nul
 *      zegt "het is nul keer gebeurd", en daar wordt een iteratie op gebouwd.
 *
 *   node ad-generator/test/itereerwizard.cjs
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

function ONDERSCHEP() {
  window.__gevraagd = [];
  window.__bronnen = { bronnen: [
    { bron: 'atria', naam: 'Atria', bruikbaar: true, reden: null,
      accounts: [{ id: 'a1', naam: 'Wellshave NL' }] },
    { bron: 'meta', naam: 'Meta Ads', bruikbaar: false, reden: 'er staat geen META_ACCESS_TOKEN', accounts: [] }
  ] };
  window.__lijst = { trend_beschikbaar: true, advertenties: [
    { id: '120001', naam: 'WS - 160 - 1', beeld: null,
      cijfers: { spend: 241.15, roas: 5.56, aankopen: 22, impressions: 40270, klikken: 542 },
      trend: { roas: 1.12, spend: 1.4 } },
    { id: '120002', naam: 'WS - 161 - 2', beeld: null,
      cijfers: { spend: 88, roas: null, aankopen: null, impressions: 9000, klikken: 60 },
      trend: null },
    /* Eentje die daalt: dezelfde advertentie draait nog, maar de ROAS is een
       derde lager dan de periode ervoor. */
    { id: '120003', naam: 'WS - 158 - 4', beeld: null,
      cijfers: { spend: 512.4, roas: 2.1, aankopen: 18, impressions: 60000, klikken: 700 },
      trend: { roas: 0.66, spend: 1.02 } },
    /* Een ROAS zonder bestellingen. Dat komt echt voor -- omzet uit een bron
       die de bestellingen niet meldt -- en het is geen winnaar: een verhouding
       zonder noemer is geen uitslag. */
    { id: '120004', naam: 'WS - 162 - 9', beeld: null,
      cijfers: { spend: 150, roas: 9.9, aankopen: 0, impressions: 20000, klikken: 210 },
      trend: { roas: 1.0, spend: 1.0 } }
  ] };
  /* Een advertentie die goed klikt maar lekt op de pagina. Dat is het geval
     waarin een nieuwe creative het probleem niet oplost. */
  window.__detail = {
    advertentie: { id: '120001', naam: 'WS - 160 - 1', beeld: null, staat: 'ACTIVE', copy: null,
      cijfers: { spend: 241.15, impressions: 40270, reach: 28000, klikken: 542, ctr: 1.35,
                 cpm: 5.99, cpc: 0.44, lpv: 384, atc: 41, aankopen: 22, omzet: 1341.56,
                 roas: 5.56, aov: 60.98, cpa: 10.96, frequency: 1.4 } },
    norm: { spend: 5000, impressions: 800000, klikken: 8000, lpv: 7000, atc: 1400, aankopen: 700 },
    diagnose: {
      knelpunt: 'pagina', meetbaar: 4, reden: null,
      wat_testen: { creative: false, varieer: [],
        zeg: 'Het lek zit na de klik: mensen komen op de pagina en leggen niets in de wagen. Een nieuwe creative lost dit niet op.' },
      stappen: [
        { sleutel: 'aandacht', label: 'Vertoning naar klik', waarde: 0.01346, norm: 0.01, verhouding: 1.35,
          noemer: 40270, drempel: 1000, genoeg_data: true, oordeel: 'sterk', zit: 'in de advertentie' },
        { sleutel: 'klikkwaliteit', label: 'Klik naar landingspagina', waarde: 0.708, norm: 0.875, verhouding: 0.81,
          noemer: 542, drempel: 100, genoeg_data: true, oordeel: 'zwak', zit: 'tussen advertentie en pagina' },
        { sleutel: 'pagina', label: 'Landingspagina naar winkelwagen', waarde: 0.1068, norm: 0.2, verhouding: 0.53,
          noemer: 384, drempel: 100, genoeg_data: true, oordeel: 'zwak', zit: 'op de pagina' },
        { sleutel: 'afrekenen', label: 'Winkelwagen naar bestelling', waarde: 0.536, norm: 0.5, verhouding: 1.07,
          noemer: 41, drempel: 25, genoeg_data: true, oordeel: 'gemiddeld', zit: 'bij het afrekenen' },
        /* Deze heeft te weinig eronder: hij hoort geen oordeel te krijgen en
           geen knelpunt te worden, hoe slecht de verhouding ook is. */
        { sleutel: 'orderwaarde', label: 'Gemiddelde orderwaarde', waarde: 60.98, norm: 90, verhouding: 0.68,
          noemer: 22, drempel: 25, genoeg_data: false, oordeel: null, zit: 'in het aanbod' },
        { sleutel: 'inkoop', label: 'Prijs per duizend vertoningen', waarde: 5.99, norm: null, verhouding: null,
          noemer: 40270, drempel: 1000, genoeg_data: true, oordeel: null, zit: 'in de veiling' }
      ]
    }
  };
  const echt = window.fetch;
  window.fetch = async function (url, opties) {
    const u = String(url);
    window.__gevraagd.push({ url: u, auth: (opties && opties.headers && opties.headers.Authorization) || null });
    if (u.indexOf('/itereren/bronnen') > -1) return { ok: true, status: 200, json: async () => window.__bronnen };
    if (u.indexOf('/itereren/advertenties') > -1) return { ok: true, status: 200, json: async () => window.__lijst };
    if (u.indexOf('/itereren/advertentie') > -1) return { ok: true, status: 200, json: async () => window.__detail };
    if (u.indexOf('/onderzoek/beeld') > -1) {
      return { ok: true, status: 200, blob: async () => new Blob(['JPEGDATA'], { type: 'image/jpeg' }) };
    }
    return echt(url, opties);
  };
  window.__WG_TOKEN = 'token-van-de-baas';
}

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const paginafouten = [];
  page.on('pageerror', e => paginafouten.push(String(e)));
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof renderItereerWizard === 'function');
  await page.evaluate(fx => { eval('(' + fx + ')()'); }, ONDERSCHEP.toString());

  console.log('\n  het oude formulier is niet meer de eerste weg');
  /* Dertig velden overtikken was de oude ingang. Hij bestaat nog als terugval,
     maar hij staat niet meer in beeld tenzij je erom vraagt -- anders is het
     geen terugval maar een tweede route. */
  const start = await page.evaluate(() => {
    switchMainTab('iterate');
    const oud = document.getElementById('iterate-handmatig');
    return {
      wizard: !!document.getElementById('iw-paneel'),
      getekend: document.getElementById('iw-paneel').textContent.length > 40,
      oudErNog: !!oud,
      oudZichtbaar: oud && oud.style.display !== 'none',
      /* En de analyseknop blijft: die stap verandert niet, alleen waar zijn
         cijfers vandaan komen. */
      analyse: !!document.getElementById('iterate-analyze-btn')
    };
  });
  check('de wizard staat er', start.wizard, true);
  check('en is getekend', start.getekend, true);
  check('het oude formulier bestaat nog', start.oudErNog, true);
  check('maar staat niet in beeld', start.oudZichtbaar, false);
  check('de analyseknop is er nog', start.analyse, true);

  console.log('\n  itereren is een eigen scherm, geen drie kolommen');
  /* De drie kolommen van de studio horen bij het maken van een nieuwe static.
     Bij itereren stel je niets in -- de advertentie bestaat al en de cijfers
     komen uit de koppeling -- en er is geen resultaat tot je op genereren
     drukt. Twee lege kolommen naast het enige dat ertoe doet. */
  const kolommen = await page.evaluate(() => {
    switchMainTab('iterate');
    const zichtbaar = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      return getComputedStyle(n).display !== 'none';
    };
    const paneel = document.getElementById('iw-paneel');
    const bron = document.getElementById('source-ad-section');
    /* En de volgorde: eerst de cijfers ophalen, dan pas het uploadvak. Dat is
       de volgorde waarin het werk gebeurt. */
    const doos = paneel && paneel.closest('#iterate-options');
    return {
      configuratie: zichtbaar('.ws8-left'),
      resultaat: zichtbaar('.ws8-right'),
      werkblad: zichtbaar('.ws8-center'),
      wizardEerst: !!(doos && bron &&
        (doos.compareDocumentPosition(bron) & Node.DOCUMENT_POSITION_FOLLOWING) > 0)
        || !!(doos && bron && parseInt(getComputedStyle(doos).order, 10) < parseInt(getComputedStyle(bron).order, 10)),
      /* En bij Kopieer ad staan ze er gewoon nog: dit is een verschil per
         scherm, geen verwijdering. Statics is hier niet de tegenproef -- daar
         is de wizard het scherm en is de kolom om een andere reden weg. */
      naKopieer: (function () { setMode('copy'); return zichtbaar('.ws8-left'); })()
    };
  });
  check('de configuratiekolom is weg', kolommen.configuratie, false);
  check('de resultaatkolom ook', kolommen.resultaat, false);
  check('het werkblad blijft', kolommen.werkblad, true);
  check('en de cijfers staan boven het uploadvak', kolommen.wizardEerst, true);
  check('bij Kopieer ad staat de configuratie er gewoon', kolommen.naKopieer, true);
  await page.evaluate(() => switchMainTab('iterate'));

  console.log('\n  en het werkblad krijgt de hele breedte, niet een strook');
  /* De controle hierboven keek of de kolommen "display: none" waren. Dat waren
     ze -- en het scherm was tóch kapot: de rasterbreedtes stonden met
     !important vast op 296px / 484px / 336px, dus het werkblad kreeg 290
     pixels midden op een leeg scherm van 1600. Zichtbaarheid meten is hier
     niet genoeg; je moet de breedte meten. */
  const breedte = await page.evaluate(() => {
    switchMainTab('iterate');
    _iw.stap = 1; iwRender();
    const b = (sel) => {
      const el = document.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().width) : null;
    };
    return { grid: b('.ws8-grid'), center: b('.ws8-center'), paneel: b('#iw-paneel'),
             kolommen: getComputedStyle(document.querySelector('.ws8-grid')).gridTemplateColumns };
  });
  check('het werkblad vult het raster', breedte.center !== null && breedte.grid - breedte.center < 40, true);
  check('en het paneel is breed, geen strook', breedte.paneel > 800, true);
  check('het raster heeft nog maar één kolom',
    /^[0-9.]+px$/.test(breedte.kolommen || '') && breedte.kolommen.split(' ').length, 1);

  console.log('\n  de commandobalk van Statics hoort hier niet');
  /* Hij zegt "Statics", telt 2/5 van een andere wizard, en zijn Genereer-knop
     start de statics-generatie. Op het itereerscherm is elk woord ervan
     onwaar -- en hij stond er gewoon, boven de stappenbalk. */
  const balk = await page.evaluate(() => {
    switchMainTab('iterate');
    const h = document.querySelector('.ws8-header');
    const bijItereren = h ? getComputedStyle(h).display : null;
    setMode('copy');
    const bijKopieer = h ? getComputedStyle(h).display : null;
    setMode('iterate');
    return { bijItereren: bijItereren, bijKopieer: bijKopieer, bestaat: !!h };
  });
  check('de balk bestaat wel', balk.bestaat, true);
  check('maar staat niet op het itereerscherm', balk.bijItereren, 'none');
  check('en bij Kopieer ad staat hij er gewoon', balk.bijKopieer !== 'none', true);

  console.log('\n  stap 1 staat in twee kolommen, zoals het ontwerp zegt');
  const twee = await page.evaluate(() => {
    _iw.stap = 1; _iw.gekozen = null; iwRender();
    const k = [].slice.call(document.querySelectorAll('.iw-kaart'));
    const st = document.querySelector('.iw-stapper');
    return {
      kaarten: k.length,
      naastElkaar: k.length === 2 && Math.abs(k[0].getBoundingClientRect().top - k[1].getBoundingClientRect().top) < 4,
      breedtes: k.map(e => Math.round(e.getBoundingClientRect().width)),
      /* De stappenbalk is één rij, geen blokje van vijf onder elkaar. */
      stapperHoog: st ? Math.round(st.getBoundingClientRect().height) : null
    };
  });
  check('twee kaarten', twee.kaarten, 2);
  check('naast elkaar', twee.naastElkaar, true);
  check('en even breed', Math.abs(twee.breedtes[0] - twee.breedtes[1]) < 20, true);
  check('de stappenbalk is één rij', twee.stapperHoog !== null && twee.stapperHoog < 60, true);

  console.log('\n  het oude werkblad staat er pas vanaf stap 3');
  /* Het stond allemaal meteen onder de wizard: het uploadvak, de winnende ad,
     de testdimensies en de knop "Analyseer en genereer iteraties". Dan begin je
     aan het onderste eind van het scherm, en de wizard erboven is decoratie. */
  const perStap = await page.evaluate(() => {
    const zicht = () => ['iterate-werkblad', 'source-ad-section', 'classic-form'].map(id => {
      const el = document.getElementById(id);
      return el ? getComputedStyle(el).display !== 'none' : null;
    });
    const uit = {};
    [1, 2, 3].forEach(n => { _iw.stap = n; iwRender(); uit[n] = zicht(); });
    /* En bij het verlaten van itereren komt alles weer terug. Blijft het op
       none staan, dan opent Kopieer ad met een leeg scherm -- kapot door een
       instelling van een ander scherm. */
    _iw.stap = 1; iwRender();
    setMode('copy');
    uit.naKopieer = zicht();
    setMode('iterate');
    return uit;
  });
  check('op stap 1 niets ervan', perStap['1'], [false, false, false]);
  check('op stap 2 nog steeds niet', perStap['2'], [false, false, false]);
  check('op stap 3 alles', perStap['3'], [true, true, true]);
  check('en Kopieer ad krijgt zijn scherm terug', perStap.naKopieer, [true, true, true]);

  console.log('\n  ook als je via de modusknop binnenkomt');
  /* Twee ingangen naar hetzelfde scherm en maar een ervan tekent: dat zie je
     pas als iemand het meldt. */
  const viaModus = await page.evaluate(() => {
    document.getElementById('iw-paneel').innerHTML = '';
    setMode('iterate');
    return document.getElementById('iw-paneel').textContent.length > 40;
  });
  check('dan tekent hij ook', viaModus, true);

  console.log('\n  de bronnen komen binnen, met een reden als ze niet werken');
  const bronnen = await page.evaluate(async () => {
    await iwHaalBronnen();
    const t = document.getElementById('iw-paneel').textContent;
    return { tekst: t, bron: _iw.bron, account: _iw.account,
             auth: (window.__gevraagd[0] || {}).auth };
  });
  check('Atria is gekozen omdat hij werkt', bronnen.bron, 'atria');
  check('met zijn account erbij', bronnen.account, 'a1');
  check('en de vraag droeg het teamtoken', bronnen.auth, 'Bearer token-van-de-baas');
  /* Een uitgegrijsde knop zonder reden stuurt iemand naar de worker terwijl
     het aan de sleutel ligt. */
  check('waarom Meta niet kan staat erbij', /META_ACCESS_TOKEN/.test(bronnen.tekst), true);

  console.log('\n  de eigen advertenties, met wat ze kostten en opleverden');
  const lijst = await page.evaluate(async () => {
    await iwHaalLijst();
    const el = document.getElementById('iw-paneel');
    return { kaarten: el.querySelectorAll('.iw-adkaart').length, tekst: el.textContent,
             url: window.__gevraagd.filter(g => g.url.indexOf('/itereren/advertenties') > -1)[0].url };
  });
  check('vier advertenties', lijst.kaarten, 4);
  check('met naam en uitgave', /WS - 160 - 1/.test(lijst.tekst) && /241\.15/.test(lijst.tekst), true);
  check('en het gekozen venster ging mee', /dagen=30/.test(lijst.url), true);
  /* En de vorige periode erbij gevraagd. Zonder dat is "daalt hij" niet te
     beantwoorden, en dan staat het filter erop zonder iets te filteren. */
  check('met de vorige periode erbij gevraagd', /vergelijk=1/.test(lijst.url), true);
  /* De tweede heeft geen ROAS. Een streepje, geen 0,00 -- een nul zou zeggen
     dat er niets verkocht is, en de waarheid is dat we het niet weten. */
  check('een onbekende ROAS is een streepje', /ROAS —/.test(lijst.tekst), true);
  check('en nergens een verzonnen nul', /ROAS 0\.00/.test(lijst.tekst), false);

  console.log('\n  de trap laat zien waar het lek zit');
  const trap = await page.evaluate(async () => {
    await iwKies(0);
    const el = document.getElementById('iw-paneel');
    const knel = el.querySelectorAll('.iw-stap.knelpunt');
    return {
      stappen: el.querySelectorAll('.iw-stap').length,
      knelpunten: knel.length,
      knelLabel: knel.length ? knel[0].textContent : '',
      tekst: el.textContent
    };
  });
  check('alle zes stappen staan er', trap.stappen, 6);
  /* Precies een. Alles laten opvallen is hetzelfde als niets laten opvallen. */
  check('en precies een is het lek', trap.knelpunten, 1);
  check('de landingspagina', /Landingspagina naar winkelwagen/.test(trap.knelLabel), true);
  check('met het woord erbij', /het lek/.test(trap.knelLabel), true);
  check('de verhouding staat er in gewone taal', /47% onder het account/.test(trap.tekst), true);
  check('en de sterke stap ook', /35% boven het account/.test(trap.tekst), true);

  console.log('\n  de static komt met de advertentie mee');
  /* Dit is de winst van de hele wizard: de static die je zelf gemaakt hebt
     hoef je niet opnieuw te uploaden om erop te kunnen itereren. Zonder deze
     controle blijft het scherm groen terwijl je alsnog staat te slepen. */
  const bronAd = await page.evaluate(async () => {
    state.sourceAd = null;
    window.__detail.advertentie.beeld = 'https://scontent.xx.fbcdn.net/v/b.jpg';
    await iwKies(0);
    return { er: !!state.sourceAd,
             soort: state.sourceAd && state.sourceAd.mimeType,
             naam: state.sourceAd && state.sourceAd.fileName,
             /* En via de worker, niet rechtstreeks: die servers laten een
                browser van een vreemde herkomst niet toe. */
             viaWorker: window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/beeld') > -1).length > 0 };
  });
  check('de advertentie is nu de bron-ad', bronAd.er, true);
  check('als afbeelding', bronAd.soort, 'image/jpeg');
  check('met een naam die zegt waar hij vandaan komt', /^meta-/.test(bronAd.naam || ''), true);
  check('opgehaald via de worker', bronAd.viaWorker, true);

  /* En als het beeld er niet is, gaat de rest gewoon door: geen beeld is
     vervelend, geen cijfers is fataal en die hebben we al. */
  const zonderBeeld = await page.evaluate(async () => {
    state.sourceAd = null;
    window.__detail.advertentie.beeld = null;
    await iwKies(0);
    return { bronAd: state.sourceAd, diagnose: !!_iw.diagnose };
  });
  check('zonder beeld blijft de bron-ad leeg', zonderBeeld.bronAd, null);
  check('maar de diagnose is er wel', zonderBeeld.diagnose, true);

  console.log('\n  te weinig data krijgt geen oordeel, en wordt geen lek');
  const dun = await page.evaluate(() => {
    const el = document.getElementById('iw-paneel');
    const vakken = [].slice.call(el.querySelectorAll('.iw-stap'));
    const orderwaarde = vakken.filter(v => /orderwaarde/i.test(v.textContent))[0];
    return { tekst: orderwaarde ? orderwaarde.textContent : '',
             knelpunt: orderwaarde ? orderwaarde.classList.contains('knelpunt') : null,
             kleur: orderwaarde ? (orderwaarde.className.match(/o-\w+/) || [''])[0] : '' };
  });
  check('er staat dat er te weinig data is', /te weinig data/.test(dun.tekst), true);
  check('met hoeveel er nodig was', /22 van de 25/.test(dun.tekst), true);
  check('hij wordt geen lek', dun.knelpunt, false);
  /* En hij krijgt geen kleur. Ruis met een kleurtje eromheen is erger dan geen
     oordeel: het ziet eruit als een bevinding. */
  check('en geen kleur', dun.kleur, '');

  console.log('\n  een lek na de klik zegt dat een creative het niet oplost');
  /* De duurste fout van de vier: drie nieuwe hooks die alle drie even hard
     lekken, gemaakt omdat het scherm niets zei. */
  const waarschuwing = await page.evaluate(() => {
    const el = document.getElementById('iw-paneel');
    return { tekst: el.textContent, gemarkeerd: !!el.querySelector('.iw-uitleg.waarschuwing') };
  });
  check('het staat er met zoveel woorden', /lost dit niet op/.test(waarschuwing.tekst), true);
  check('en het valt op', waarschuwing.gemarkeerd, true);
  /* En je mag toch doorgaan: het is zijn budget. Maar niet zonder dat het er
     staat. */
  check('doorgaan mag nog steeds', /Je kunt alsnog iteraties maken/.test(waarschuwing.tekst), true);

  console.log('\n  de cijfers gaan naar het model, en de diagnose erbij');
  const naarModel = await page.evaluate(() => {
    const c = collectIterateData();
    return { naam: c.adName, periode: c.period, tekst: c.text };
  });
  check('de naam van de advertentie', naarModel.naam, 'WS - 160 - 1');
  check('en het venster', naarModel.periode, 'laatste 30 dagen');
  check('de uitgave staat erin', /241\.15/.test(naarModel.tekst), true);
  check('de ROAS ook', /5\.56/.test(naarModel.tekst), true);
  check('met de funnel tegen het account', /GEMETEN TEGEN HETZELFDE ACCOUNT/.test(naarModel.tekst), true);
  check('en waar het knelpunt zit', /HET KNELPUNT ZIT OP DE PAGINA/.test(naarModel.tekst), true);
  /* Het model moet dit expliciet te horen krijgen, niet alleen de gebruiker.
     Anders schrijft het alsnog drie hooks alsof het lek daar zit. */
  check('het model wordt gewaarschuwd', /Een nieuwe creative lost het niet op/.test(naarModel.tekst), true);
  /* En wat er NIET in staat: de stappen zonder genoeg data. Die zouden als
     bevinding meelezen terwijl het ruis is. */
  check('een stap zonder genoeg data staat er niet in',
    /Gemiddelde orderwaarde/.test(naarModel.tekst), false);

  console.log('\n  het oude formulier mengt zich er niet in');
  /* Dit is de fout die de prompt op een advertentie baseert die niet bestaat:
     de invoervelden houden hun oude waarden, en als die meetellen krijgt het
     model twee verschillende getallen voor dezelfde maat. */
  const gemengd = await page.evaluate(() => {
    const el = document.getElementById('iterate-spend');
    if (el) el.value = '99999';
    const c = collectIterateData();
    return { spend: /99999/.test(c.text), naam: c.adName };
  });
  check('het oude bedrag komt er niet in', gemengd.spend, false);
  check('en de naam komt uit de bron', gemengd.naam, 'WS - 160 - 1');

  console.log('\n  de testdimensies volgen uit de diagnose');
  const dims = await page.evaluate(() => {
    /* Bij een lek op de pagina hoort GEEN creative-dimensie. Wat er stond
       blijft dan staan -- het scherm vinkt niets aan wat het niet meent. */
    const voor = [].slice.call(document.querySelectorAll('input[name="iterate-vary"]:checked')).map(c => c.value);
    iwZetDimensies();
    const naPagina = [].slice.call(document.querySelectorAll('input[name="iterate-vary"]:checked')).map(c => c.value);
    /* En met een lek in de aandacht wel: dan wordt de hook aangevinkt. */
    _iw.diagnose.wat_testen = { creative: true, varieer: ['hook', 'headline', 'opening'], zeg: 'x' };
    iwZetDimensies();
    const naHook = [].slice.call(document.querySelectorAll('input[name="iterate-vary"]:checked')).map(c => c.value);
    return { voor, naPagina, naHook };
  });
  check('bij een paginalek wordt er niets aangevinkt', dims.naPagina, dims.voor);
  check('bij een aandachtslek de voorgestelde dimensies', dims.naHook.sort(), ['headline', 'hook', 'opening']);

  console.log('\n  een fout van de bron komt op het scherm');
  const stuk = await page.evaluate(async () => {
    const echt = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).indexOf('/itereren/advertenties') > -1) {
        return { ok: false, status: 502, json: async () => ({ error: 'Atria: The provided API key is invalid' }) };
      }
      return echt(u, o);
    };
    _iw.gekozen = null;
    await iwHaalLijst();
    const t = document.getElementById('iw-paneel').textContent;
    /* En de stukke fetch weer weg. Zonder dit blijft /itereren/advertenties de
       rest van de lus kapot, en meet elke controle daarna een leeg scherm dat
       er niets over zegt. */
    window.fetch = echt;
    return t;
  });
  check('de melding staat er', /Dat lukte niet/.test(stuk), true);
  check('met wat de bron zei', /API key is invalid/.test(stuk), true);

  console.log('\n  een te oude worker zegt dat, en nooit [object Object]');
  /* Precies wat er op het scherm stond toen de console al uitgerold was en de
     worker nog niet: "[object Object]" in een rood vak. De worker geeft bij een
     onbekende route een object terug waar de console een string verwachtte. */
  const teOud = await page.evaluate(async () => {
    const echt = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).indexOf('/itereren/bronnen') > -1) {
        return { ok: false, status: 404,
                 json: async () => ({ error: { message: 'Gebruik /systeem/*, POST /anthropic of /openai/… (of GET /health).' } }) };
      }
      return echt(u, o);
    };
    _iw.gekozen = null; _iw.bronnen = null;
    await iwHaalBronnen();
    const t = document.getElementById('iw-paneel').textContent;
    window.fetch = echt;
    return t;
  });
  check('geen [object Object] meer', /\[object Object\]/.test(teOud), false);
  check('er staat wat er moet gebeuren', /wrangler deploy/.test(teOud), true);
  check('en waaraan je ziet of het gelukt is', /versie 20 of hoger/.test(teOud), true);

  console.log('\n  vijf stappen, en je kunt er niet doorheen springen');
  /* Een stappenbalk die alles laat aanklikken is geen balk maar een rij
     knoppen: dan sta je op stap 3 met een leeg werkblad en de balk zegt dat je
     er bent. Terug mag altijd, vooruit alleen als er iets ligt. */
  const stapper = await page.evaluate(() => {
    _iw.stap = 1; _iw.gekozen = null; _iw.handmatig = false; iwRender();
    const el = document.getElementById('iw-paneel');
    const stappen = [...el.querySelectorAll('.iw-stapper-stap')];
    return {
      aantal: stappen.length,
      labels: stappen.map(s => s.querySelector('.iw-stapper-label').textContent),
      nu: stappen.filter(s => s.classList.contains('nu')).length,
      klikbaar: stappen.filter(s => !s.disabled).length
    };
  });
  check('vijf stappen', stapper.aantal, 5);
  check('met de namen uit het ontwerp', stapper.labels,
    ['Advertentie', 'Analyse', 'Strategie', 'Iteraties', 'Resultaat']);
  check('precies één is de huidige', stapper.nu, 1);
  check('en zonder advertentie is er niets aan te klikken', stapper.klikbaar, 0);

  /* En de grendel zelf, niet alleen het uitgegrijsde knopje. Een tweede weg
     naar dezelfde stap -- een oude knop, een link, een toets -- moet op
     dezelfde grendel stuiten. */
  const sprong = await page.evaluate(() => {
    const el = document.getElementById('iw-paneel');
    const k = document.createElement('button');
    k.setAttribute('data-action', 'iw-stap');
    k.setAttribute('data-id', '3');
    el.appendChild(k);
    k.click();
    const zonder = _iw.stap;
    _iw.handmatig = true;
    el.appendChild(k);
    k.click();
    const met = _iw.stap;
    _iw.handmatig = false; _iw.stap = 1; iwRender();
    return { zonder: zonder, met: met };
  });
  check('zonder advertentie kom je niet op stap 3', sprong.zonder, 1);
  check('met de handmatige weg wel', sprong.met, 3);

  console.log('\n  de ingangen naar de lijst filteren wat ze beloven');
  const filters = await page.evaluate(() => {
    const l = window.__lijst.advertenties;
    /* Een filter dat struikelt over een advertentie zonder trend hoort een
       gezakte controle op te leveren en niet een dode testlus: dan zie je
       WELKE ingang het is. */
    const veilig = function (id, bewaard) {
      try { return iwFilter(l, id, bewaard || []).map(a => a.id); }
      catch (e) { return 'viel om: ' + String((e && e.message) || e); }
    };
    return {
      winnaars: veilig('winnaars'), spend: veilig('spend'), dalend: veilig('dalend'),
      recent: veilig('recent'), bewaard: veilig('bewaard', ['120002'])
    };
  });
  /* Een ROAS uit nul bestellingen is geen ROAS: die advertentie hoort niet in
     een lijst met "winnaars", ook niet onderaan. */
  check('winnaars: alleen met bestellingen, hoogste ROAS eerst', filters.winnaars, ['120001', '120003']);
  check('een ROAS van 9,9 uit nul bestellingen telt niet mee',
    Array.isArray(filters.winnaars) && filters.winnaars.indexOf('120004') === -1, true);
  check('spend: alleen boven de honderd euro', filters.spend, ['120001', '120003', '120004']);
  /* Geen vorige periode is geen daling. De tweede heeft geen trend en hoort
     hier dus niet te staan -- niet als stabiel en niet als dalend. */
  check('dalend: alleen wie werkelijk daalde', filters.dalend, ['120003']);
  check('recent: de hele lijst', filters.recent, ['120001', '120002', '120003', '120004']);
  check('bewaard: alleen wat bewaard is', filters.bewaard, ['120002']);

  console.log('\n  een gefilterde kaart opent de advertentie die erop staat');
  /* De controles hiervoor lieten een stukke bron achter: geen bronnen, geen
     lijst, een foutmelding. Eerst alles terugzetten -- anders meet ik een leeg
     scherm en denk ik dat het aan het filter ligt. */
  await page.evaluate(async () => {
    _iw.fout = null; _iw.bronnen = window.__bronnen.bronnen;
    _iw.bron = 'atria'; _iw.account = 'a1';
    await iwHaalLijst();
  });
  /* De plek in de gefilterde lijst en de plek in de opgehaalde lijst lopen
     uiteen zodra je een ingang kiest. Wie de eerste doorgeeft opent een andere
     advertentie dan hij aanklikte -- en dat ziet er volkomen normaal uit,
     want er verschijnt gewoon een advertentie. */
  const gefilterd = await page.evaluate(async () => {
    _iw.preset = 'dalend'; _iw.gekozen = null; iwRender();
    const kaarten = [...document.querySelectorAll('.iw-adkaart')];
    const opKaart = kaarten.length === 1 ? kaarten[0].textContent : '(' + kaarten.length + ' kaarten)';
    if (!kaarten.length) { _iw.preset = 'recent'; return { opKaart: opKaart, url: '' }; }
    kaarten[0].click();
    for (var i = 0; i < 60 && !_iw.gekozen; i++) await new Promise(r => setTimeout(r, 25));
    const gevraagd = window.__gevraagd.filter(g => /\/itereren\/advertentie\?/.test(g.url)).pop();
    _iw.preset = 'recent';
    return { opKaart: opKaart, url: (gevraagd || {}).url || '' };
  });
  check('er staat één dalende advertentie', /WS - 158 - 4/.test(gefilterd.opKaart), true);
  check('en die wordt ook opgehaald', /id=120003/.test(gefilterd.url), true);

  console.log('\n  een lege uitkomst zegt waarom hij leeg is');
  /* Drie soorten leeg met drie verschillende vervolgstappen: geen
     advertenties, geen treffers voor deze ingang, of niet gemeten. Eén zin
     "geen resultaten" maakt ze alle drie hetzelfde. */
  const leeg = await page.evaluate(() => {
    /* Terug naar stap 1: de controle hiervoor koos een advertentie, en op stap
       2 staat de lijst er niet. */
    _iw.stap = 1; _iw.gekozen = null;
    _iw.preset = 'bewaard';
    try { localStorage.removeItem('wg-iw-bewaard'); } catch (e) { }
    iwRender();
    const t = document.getElementById('iw-paneel').textContent;
    _iw.preset = 'recent';
    return t;
  });
  check('het zegt welke ingang niets opleverde', /Opgeslagen advertenties/.test(leeg), true);
  check('en hoeveel er wel in het venster staan', /wel 4 in dit venster/.test(leeg), true);

  console.log('\n  bewaren staat in deze browser, en het scherm zegt dat');
  const ster = await page.evaluate(() => {
    try { localStorage.removeItem('wg-iw-bewaard'); } catch (e) { }
    _iw.preset = 'recent'; iwRender();
    const el = document.getElementById('iw-paneel');
    const voor = el.querySelectorAll('.iw-ster.aan').length;
    el.querySelector('.iw-ster').click();
    const na = document.getElementById('iw-paneel').querySelectorAll('.iw-ster.aan').length;
    const bewaard = iwBewaard();
    /* En weer terug: een sterretje dat alleen aan kan is een sterretje dat je
       niet durft aan te raken. */
    document.getElementById('iw-paneel').querySelector('.iw-ster').click();
    return { voor: voor, na: na, bewaard: bewaard, weer: iwBewaard().length,
             zegt: /Handmatig bewaard/.test(el.textContent) };
  });
  check('eerst is er niets bewaard', ster.voor, 0);
  check('na een klik eentje', ster.na, 1);
  check('en het is de goede', ster.bewaard, ['120001']);
  check('nog een klik haalt hem er weer uit', ster.weer, 0);
  check('en de kaart zegt wat "opgeslagen" betekent', ster.zegt, true);

  console.log('\n  een bron zonder vorige periode zegt dat, en filtert niet stil');
  /* Atria kent alleen vaste periodes. Dan is "dalend" niet te beantwoorden --
     en een lege lijst onder een knop die aan staat leest als "er daalt niets",
     wat een geruststelling is die we niet gemeten hebben. */
  const geenTrend = await page.evaluate(async () => {
    window.__lijst = { trend_beschikbaar: false,
      trend_reden: 'Atria levert alleen vaste periodes, geen vorige periode om tegen te vergelijken.',
      advertenties: window.__lijst.advertenties };
    _iw.preset = 'dalend';
    await iwHaalLijst();
    const el = document.getElementById('iw-paneel');
    const knop = [...el.querySelectorAll('.iw-preset')]
      .filter(k => k.getAttribute('data-id') === 'dalend')[0];
    return { uit: knop ? knop.disabled : null, reden: knop ? knop.getAttribute('title') : null,
             preset: _iw.preset };
  });
  check('de knop staat uit', geenTrend.uit, true);
  check('met de reden erbij', /vaste periodes/.test(geenTrend.reden || ''), true);
  check('en de ingang valt terug op de hele lijst', geenTrend.preset, 'recent');

  console.log('\n  de kaart van de gekozen advertentie');
  const kaart = await page.evaluate(async () => {
    window.__lijst = { trend_beschikbaar: true, advertenties: window.__lijst.advertenties };
    await iwHaalLijst();
    await iwKies(0);
    const el = document.getElementById('iw-paneel');
    const tegels = [...el.querySelectorAll('.iw-tegel')].map(t => t.textContent);
    return { stap: _iw.stap, tegels: tegels, tekst: el.textContent,
             link: (el.querySelector('.iw-adacties a') || {}).href || null };
  });
  check('kiezen brengt je naar stap 2', kaart.stap, 2);
  check('met de kerncijfers erop', kaart.tegels.length, 5);
  check('spend staat erbij', kaart.tegels.some(t => /Spend/.test(t) && /241\.15/.test(t)), true);
  /* Bij Atria kennen we geen adres waar de advertentie te bekijken valt. Een
     knop die nergens heen gaat is erger dan geen knop. */
  check('en geen link naar een bron die we niet kennen', kaart.link, null);

  const metaLink = await page.evaluate(() => {
    _iw.bron = 'meta'; _iw.account = 'act_998'; iwRender();
    const a = document.querySelector('.iw-adacties a');
    return a ? a.getAttribute('href') : null;
  });
  check('bij Meta staat er wel een adres', /adsmanager/.test(metaLink || ''), true);
  check('met het account erin', /act=998/.test(metaLink || ''), true);
  check('en de advertentie erin', /selected_ad_ids=120001/.test(metaLink || ''), true);
  await page.evaluate(() => { _iw.bron = 'atria'; _iw.account = 'a1'; iwRender(); });

  console.log('\n  Rory leest de advertentie, en een leeg veld blijft leeg');
  const analyse = await page.evaluate(() => {
    state.iterateAnalysis = {
      archetype: 'Founder Story', hook_mechaniek: '"Waarom ik Wellshave begon"',
      persona: 'Mannen 25-45', compositie: 'Founder in authentieke setting',
      angle: 'Authenticiteit & vertrouwen', bewijs: 'Eigen ervaring & productresultaat',
      funnel: 'TOF', offer: 'Betere scheerervaring zonder irritatie',
      hoofdpersoon: 'Dustin (Founder)', cta_aanpak: 'Shop nu',
      /* Dit veld blijft met opzet leeg: het hoort dan niet op het scherm te
         staan, ook niet als kopje met niets erachter. */
      narratief_perspectief: '', format_mode: 'Static Image (1:1)',
      cijfer_diagnose: 'Sterk presterende Founder Story.',
      grootste_kans: 'De opening kan frisser.',
      vasthouden: ['Authentieke founder angle', 'Heldere persoonlijke motivatie']
    };
    iwRender();
    const el = document.getElementById('iw-paneel');
    const velden = [...el.querySelectorAll('.iw-veld-l')].map(x => x.textContent);
    return { velden: velden, tekst: el.textContent };
  });
  check('elf gelezen velden staan er', analyse.velden.length, 11);
  check('in de volgorde van het ontwerp', analyse.velden.slice(0, 4),
    ['Concept', 'Hook', 'Persona', 'Visueel concept']);
  check('het lege veld staat er niet', analyse.velden.indexOf('Narratief perspectief'), -1);
  check('de conclusie staat er', /Rory’s conclusie/.test(analyse.tekst), true);
  check('en wat blijft staan ook', /Wat blijft sterk/.test(analyse.tekst), true);

  console.log('\n  een analyse die niets oplevert is een mislukking, geen stilte');
  /* De vorige analyse laten staan alsof hij vers is, is het soort stilte dat
     je op een verkeerd plan zet: de velden gaan over een andere advertentie. */
  const stille = await page.evaluate(async () => {
    const echt = window.analyzeWinningAd;
    window.analyzeWinningAd = async () => { /* doet niets, geeft niets terug */ };
    await iwAnalyse();
    window.analyzeWinningAd = echt;
    return { fout: _iw.analyseFout, tekst: document.getElementById('iw-paneel').textContent };
  });
  check('er staat dat er niets terugkwam', /geen analyse terug/.test(stille.fout || ''), true);
  check('en het scherm zegt het ook', /De analyse liep vast/.test(stille.tekst), true);

  console.log('\n  het werkblad komt pas bij stap 3 in beeld');
  const werkblad = await page.evaluate(() => {
    const uit = {};
    [1, 2, 3].forEach(function (n) {
      _iw.stap = n; iwRender();
      uit[n] = document.getElementById('iterate-werkblad').style.display;
    });
    return uit;
  });
  check('op stap 1 niet', werkblad['1'], 'none');
  check('op stap 2 niet', werkblad['2'], 'none');
  check('op stap 3 wel', werkblad['3'], 'block');

  console.log('\n  handmatig invullen kan nog steeds');
  const hand = await page.evaluate(() => {
    /* De handmatige weg staat in stap 1, in de kaart naast de koppeling. Eerst
       terug dus -- de controles hiervoor lieten de wizard op stap 2 staan. */
    _iw.stap = 1; _iw.gekozen = null; _iw.handmatig = false;
    iwRender();
    const link = document.querySelector('[data-action="iw-handmatig"]');
    if (!link) return { zichtbaar: '(geen handmatige weg in stap 1)', naam: null };
    link.click();
    const oud = document.getElementById('iterate-handmatig');
    /* Zonder gekozen advertentie leest collectIterateData weer de velden. Dat
       is de terugval, en hij hoort echt te werken -- niet alleen te bestaan. */
    _iw.gekozen = null;
    const el = document.getElementById('iterate-adname');
    if (el) el.value = 'Met de hand ingevuld';
    return { zichtbaar: oud.style.display === 'block', naam: collectIterateData().adName,
             stap: _iw.stap };
  });
  check('het formulier komt in beeld', hand.zichtbaar, true);
  check('en wordt dan ook gelezen', hand.naam, 'Met de hand ingevuld');
  check('en de wizard staat op stap 2', hand.stap, 2);

  check('en geen enkele paginafout onderweg', paginafouten, []);

  await browser.close();
  srv.close();
  console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
  process.exit(fout ? 1 : 0);
})();
