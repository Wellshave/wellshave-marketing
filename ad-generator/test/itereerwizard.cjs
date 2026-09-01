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
  window.__lijst = { advertenties: [
    { id: '120001', naam: 'WS - 160 - 1', beeld: null,
      cijfers: { spend: 241.15, roas: 5.56, aankopen: 22, impressions: 40270, klikken: 542 } },
    { id: '120002', naam: 'WS - 161 - 2', beeld: null,
      cijfers: { spend: 88, roas: null, aankopen: null, impressions: 9000, klikken: 60 } }
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
  check('twee advertenties', lijst.kaarten, 2);
  check('met naam en uitgave', /WS - 160 - 1/.test(lijst.tekst) && /241\.15/.test(lijst.tekst), true);
  check('en het gekozen venster ging mee', /dagen=30/.test(lijst.url), true);
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
    return document.getElementById('iw-paneel').textContent;
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

  console.log('\n  handmatig invullen kan nog steeds');
  const hand = await page.evaluate(() => {
    document.querySelector('[data-action="iw-handmatig"]').click();
    const oud = document.getElementById('iterate-handmatig');
    /* Zonder gekozen advertentie leest collectIterateData weer de velden. Dat
       is de terugval, en hij hoort echt te werken -- niet alleen te bestaan. */
    _iw.gekozen = null;
    const el = document.getElementById('iterate-adname');
    if (el) el.value = 'Met de hand ingevuld';
    return { zichtbaar: oud.style.display === 'block', naam: collectIterateData().adName };
  });
  check('het formulier komt in beeld', hand.zichtbaar, true);
  check('en wordt dan ook gelezen', hand.naam, 'Met de hand ingevuld');

  check('en geen enkele paginafout onderweg', paginafouten, []);

  await browser.close();
  srv.close();
  console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
  process.exit(fout ? 1 : 0);
})();
