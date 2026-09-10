/* De bestemming, de advertentienaam en het dossier.
 *
 * Drie beslissingen die het systeem wel nam maar nergens vastlegde, en die
 * daardoor niet te gebruiken waren op het moment dat het ertoe deed:
 *
 *   1. WAAR DE KLIK LANDT. Het platform leest de advertentie en de pagina
 *      samen en beslist op allebei aan wie hij hem laat zien, dus een ad voor
 *      een nieuwe groep die naar een pagina voor de oude massa wijst kost
 *      bereik voordat hij conversie kost. De bestemming volgt uit de
 *      awareness: hoe minder de lezer weet, hoe meer pagina er nodig is.
 *
 *   2. DE ADVERTENTIENAAM. Zonder een naam die de hoek draagt staat er in het
 *      advertentie-account straks data zonder beslissing ernaast, en dan valt
 *      er niets te itereren.
 *
 *   3. HET DOSSIER. Hoek, verschil, verlangen en de twee assen stonden in de
 *      wizard en verdwenen bij het opslaan.
 *
 * En een vierde, die geen veld is maar een regel: de standaardpass is de
 * visuele. Een idee, dezelfde woorden, drie beelden. Verandert er ook een kop
 * mee, dan weet je bij een winnaar niet waardoor hij won.
 *
 *   node ad-generator/test/bestemming.cjs
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
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof wizBlankData === 'function' && typeof wizAdNaam === 'function');

  console.log('\n  de bestemming volgt uit de awareness');
  const advies = await page.evaluate(() => {
    const uit = {};
    ['unaware', 'problem', 'solution', 'product', 'most'].forEach(aw => {
      wizState.data = wizBlankData();
      wizState.data.audience.awareness = aw;
      const a = wizBestemmingAdvies();
      uit[aw] = a ? a.keuze : null;
    });
    // en zonder awareness valt er niets te adviseren
    wizState.data = wizBlankData();
    uit.leeg = wizBestemmingAdvies();
    return uit;
  });
  /* Wie het probleem nog niet kent heeft de diagnose nodig voordat een product
     iets betekent; wie de oplossingssoorten kent maar jou niet, moet eerst de
     punten in jouw volgorde lezen; wie klaar is om te kopen hoeft geen artikel
     meer in de weg. */
  check('unaware krijgt een advertorial', advies.unaware, 'advertorial');
  check('probleembewust ook', advies.problem, 'advertorial');
  check('oplossingsbewust krijgt een listicle', advies.solution, 'listicle');
  check('productbewust ook', advies.product, 'listicle');
  check('meest bewust mag rechtstreeks naar de productpagina', advies.most, 'pdp');
  check('en zonder awareness adviseert hij niets', advies.leeg, null);

  console.log('\n  een bestemming die niet bij het publiek past, wordt gezegd');
  const mismatch = await page.evaluate(() => {
    wizState.data = wizBlankData();
    wizState.data.audience.awareness = 'unaware';
    wizState.data.strategy.destination = 'pdp';
    const fout = wizBestemmingMismatch();
    wizState.data.strategy.destination = 'advertorial';
    const goed = wizBestemmingMismatch();
    wizState.data = wizBlankData();
    wizState.data.strategy.destination = 'pdp';
    const geenPubliek = wizBestemmingMismatch();
    return { fout, goed, geenPubliek };
  });
  check('een productpagina voor onbewust verkeer geeft een waarschuwing',
    /unaware-aware/.test(mismatch.fout || '') && /Advertorial fits this ad better/.test(mismatch.fout || ''), true);
  check('en die waarschuwing noemt waarom het bereik kost',
    /reads the ad and the page together/.test(mismatch.fout || ''), true);
  check('de passende bestemming geeft geen waarschuwing', mismatch.goed, null);
  check('en zonder publiek valt er niets te vergelijken', mismatch.geenPubliek, null);

  console.log('\n  de advertentienaam draagt de beslissing, niet alleen het product');
  const naam = await page.evaluate(() => {
    wizState.data = wizBlankData();
    wizState.data.audience.awareness = 'problem';
    wizState.data.audience.sophistication = 's3';
    wizState.data.strategy.theme = 'Geen sneetjes meer';
    wizState.data.strategy.differentiation = 'mechanism';
    wizState.data.strategy.destination = 'advertorial';
    const meta = {
      product: 'Wellshave Trimmer', awareness: 'problem', sophistication: 's3',
      personaName: 'Gevoelige Huid Gijs', funnel: 'tof', timestamp: Date.UTC(2026, 7, 20),
      wizardBrief: JSON.parse(JSON.stringify(wizState.data))
    };
    return { een: wizAdNaam(meta, 0), twee: wizAdNaam(meta, 1),
             kaal: wizAdNaam({ product: 'Trimmer', timestamp: Date.UTC(2026, 7, 20) }, 0) };
  });
  check('de naam draagt de hoek', /ANG-geen-sneetjes-meer/.test(naam.een), true);
  check('en het soort verschil', /DF-MECH/.test(naam.een), true);
  check('en de bestemming', /LP-ADVT/.test(naam.een), true);
  check('en allebei de assen', /AW-PROB/.test(naam.een) && /SO-S3/.test(naam.een), true);
  /* Mensen tellen advertenties vanaf 1. V0 in een rapportage leest als een
     fout, en dan gaat iemand hem hernoemen -- en daar breekt de koppeling. */
  check('de eerste variant heet V1, niet V0', /_V1_/.test(naam.een), true);
  check('de tweede heet V2', /_V2_/.test(naam.twee), true);
  check('een kale metadata levert nog steeds een bruikbare naam',
    naam.kaal, 'trimmer_V1_2026-08-20');

  console.log('\n  het dossier komt mee uit de brief');
  const dossier = await page.evaluate(() => {
    wizState.data = wizBlankData();
    wizState.data.audience.awareness = 'solution';
    wizState.data.audience.sophistication = 's2';
    wizState.data.strategy.theme = 'De scheerbeurt zonder nabranden';
    wizState.data.strategy.differentiation = 'mechanism';
    wizState.data.strategy.desire = 'Geen rode vlekken na het scheren';
    wizState.data.strategy.destination = 'listicle';
    const r = wizDossierVan(wizState.data);
    const opKey = {}; r.forEach(x => { opKey[x.key] = x.tekst; });
    return { aantal: r.length, opKey, leeg: wizDossierVan(wizBlankData()).length };
  });
  /* De ruwe waarde is een sleutel ('mechanism', 'solution'); op de kaart hoort
     te staan wat de mens koos, anders leest een testlog als een databasedump. */
  check('het verschil staat er als label, niet als sleutel',
    dossier.opKey.differentiation, 'New mechanism');
  check('de awareness ook', dossier.opKey.awareness, 'Solution aware');
  check('en de bestemming ook', dossier.opKey.destination, 'Listicle');
  check('de hoek staat er letterlijk in', dossier.opKey.angle, 'De scheerbeurt zonder nabranden');
  check('een leeg dossier levert geen lege rijen op', dossier.leeg, 0);

  console.log('\n  de sophistication komt eindelijk in de metadata terecht');
  const meta = await page.evaluate(() => {
    wizState.data = wizBlankData();
    wizState.data.audience.awareness = 'problem';
    wizState.data.audience.sophistication = 's4';
    wizState.data.strategy.destination = 'quiz';
    const m = wizMetadata();
    return { soph: m.sophistication, aware: m.awareness, dest: m.destination };
  });
  /* Dit stond hardgecodeerd op null: de wizard vroeg het stadium wel, de
     bibliotheek zag het nooit, en de chip en de bestandsnaamcode bleven leeg. */
  check('sophistication staat in de metadata', meta.soph, 's4');
  check('awareness ook', meta.aware, 'problem');
  check('en de bestemming ook', meta.dest, 'quiz');

  console.log('\n  de batchregel: standaard verandert alleen het beeld');
  const pass = await page.evaluate(() => {
    wizState.data = wizBlankData();
    const standaard = wizPass();
    /* De terugval apart: een state die voor deze regel is bewaard heeft
       helemaal geen pass, en valt dan op de regel in wizPass terug. Zonder
       deze controle kan die terugval stilletjes op de hoekpass blijven staan
       terwijl het datamodel de visuele belooft. */
    delete wizState.data.generate.pass;
    const terugval = wizPass();
    wizState.data.generate.pass = 'visueel';
    wizState.data.audience.awareness = 'problem';
    wizState.data.strategy.messaging = 'Kern';
    wizState.data.strategy.destination = 'advertorial';
    wizState.data.copy.headline = 'De kop die vaststaat';
    wizState.data.concepts.list = [{ headline_nl: 'De kop die vaststaat', visual_nl: 'iets' }];
    wizState.data.concepts.selected = 0;
    const visueel = wizBuildTakeBrief();
    wizState.data.generate.pass = 'hoek';
    const hoek = wizBuildTakeBrief();
    return { standaard, terugval, visueel, hoek };
  });
  check('de standaardpass is de visuele', pass.standaard, 'visueel');
  check('en een state zonder pass valt ook op de visuele terug', pass.terugval, 'visueel');
  check('en die zet de woorden vast',
    /Do not rewrite them, not even slightly/.test(pass.visueel), true);
  check('de hoekpass laat de kop juist wel verschillen',
    /The headline: same promise, different wording/.test(pass.hoek), true);
  check('beide passes sturen naar dezelfde pagina',
    /Destination: Advertorial \(all three send to the same page\)/.test(pass.visueel)
    && /Destination: Advertorial/.test(pass.hoek), true);

  console.log('\n  de leer vertelt het model de bestemmingsregel');
  const leer = await page.evaluate(() => {
    wizState.data = wizBlankData();
    wizState.data.audience.awareness = 'problem';
    wizState.data.audience.sophistication = 's2';
    return wizLeerBrief();
  });
  check('de leer noemt de bestemming als onderdeel van de ad',
    /Destination is part of the ad, not an afterthought/.test(leer), true);
  check('en legt het algoritme-signaal uit',
    /reads the creative AND the page/.test(leer), true);

  console.log('\n  een verzonnen bestemming wordt geweigerd');
  const validator = await page.evaluate(() => {
    wizState.data = wizBlankData();
    const goed = wizZetGevalideerd('strategy', 'destination', 'listicle', 'test');
    const na = wizState.data.strategy.destination;
    const slecht = wizZetGevalideerd('strategy', 'destination', 'tiktokshop', 'test');
    return { goed, na, slecht, alsnog: wizState.data.strategy.destination };
  });
  check('een bestaande bestemming wordt gezet', [validator.goed, validator.na], [true, 'listicle']);
  check('een onbekende wordt geweigerd', validator.slecht, false);
  check('en overschrijft de goede niet', validator.alsnog, 'listicle');

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
