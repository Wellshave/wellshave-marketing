/* Bibliotheek-rust: lezen zonder dat alles onder je dichtklapt.
 *
 * De klacht: je opent een concept in de bibliotheek, zit te lezen, en
 * ineens "refresht" alles — open groepen klappen dicht, het menu laadt
 * opnieuw. De oorzaak zat in tweeën:
 *
 *   1. de teamsync hertekende álle schermen op elke venster-focus en elk
 *      realtime-bericht, ook als de data byte-voor-byte gelijk was;
 *   2. welke groep open stond leefde alleen in de DOM, en innerHTML gooit
 *      die DOM weg — dus zelfs een terechte herteken klapte alles dicht.
 *
 * Deze test bewijst beide fixes in de echte pagina:
 *
 *   node ad-generator/test/bibliotheek.cjs
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

  /* De sync-module stapt zonder Supabase-client meteen uit — en dan valt er
     niets te testen. Een stub met precies genoeg oppervlak: getSession zegt
     "niet ingelogd" (dus geen echte sync start), de rest is inert. */
  await page.addInitScript(() => {
    window.supabase = {
      createClient: function () {
        var keten = { on: function () { return keten; }, subscribe: function () {} };
        var vraag = {
          select: function () { return vraag; }, eq: function () { return vraag; },
          order: function () { return vraag; }, limit: function () { return vraag; },
          maybeSingle: function () { return Promise.resolve({ data: null }); },
          upsert: function () { return Promise.resolve({}); },
          delete: function () { return vraag; },
          then: function (fn) { return Promise.resolve({ data: [] }).then(fn); }
        };
        return {
          auth: {
            onAuthStateChange: function () {},
            getSession: function () { return Promise.resolve({ data: { session: null } }); }
          },
          from: function () { return vraag; },
          channel: function () { return keten; }
        };
      }
    };
  });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => window._wgSync && typeof renderLibrary === 'function');

  console.log('\n  gelijke data uit de cloud raakt niets aan');
  const stil = await page.evaluate(() => {
    // personas_v1 is een lichte sleutel: die leeft echt in localStorage.
    // Directe property-toewijzing gaat om de sync-mirror heen, dus dit is
    // puur "zo staat het er lokaal al" zonder een cloud-push uit te lokken.
    window.localStorage['ws_personas_v1'] = JSON.stringify([{ id: 'p1', name: 'Test' }]);
    const zelfde = window._wgSync.applyRows([{ key: 'personas_v1', value: [{ id: 'p1', name: 'Test' }] }]);
    const anders = window._wgSync.applyRows([{ key: 'personas_v1', value: [{ id: 'p1', name: 'Nieuw' }] }]);
    const nogEens = window._wgSync.applyRows([{ key: 'personas_v1', value: [{ id: 'p1', name: 'Nieuw' }] }]);
    return { zelfde, anders, nogEens };
  });
  check('een rij die lokaal al zo staat telt niet als wijziging', stil.zelfde, false);
  check('een echt nieuwe rij wel', stil.anders, true);
  check('en direct daarna is ook die rij weer rust', stil.nogEens, false);

  console.log('\n  en de plekken die hertekenen vragen het eerst');
  /* applyRows kán het juiste antwoord geven terwijl hydrate en realtime er
     niet naar luisteren — dan is de klacht terug. Dus: staat de vraag er. */
  const syncBron = fs.readFileSync(path.join(APP, 'js', '21-supabase-sync.js'), 'utf8');
  check('hydrate hertekent alleen bij een echte wijziging',
    /if \(applyRows\(rows\)\) softRefresh\(\)/.test(syncBron), true);
  check('realtime stopt als het bericht niets nieuws bracht',
    /if \(!applyRows\(\[payload\.new\]\)\) return;/.test(syncBron), true);

  console.log('\n  een open groep overleeft een herteken');
  const groep = await page.evaluate(() => {
    state.library = [
      { id: 'a1', batch_id: 'batch-1', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'TOF', archetype: 'x', concept: 'Geen sneetjes' }, variation: { image_prompt_en: 'p' } },
      { id: 'a2', batch_id: 'batch-1', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'TOF', archetype: 'x', concept: 'Geen sneetjes' }, variation: { image_prompt_en: 'p' } },
      { id: 'b1', batch_id: 'batch-2', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'MOF', archetype: 'x', concept: 'Ander idee' }, variation: { image_prompt_en: 'p' } },
      { id: 'b2', batch_id: 'batch-2', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'MOF', archetype: 'x', concept: 'Ander idee' }, variation: { image_prompt_en: 'p' } }
    ];
    renderLibrary();
    const lib = document.getElementById('library');
    // De eerste groep openklikken, zoals de gebruiker doet
    toggleLibGroup(lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-head'));
    const openVoor = lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-body').style.display !== 'none';
    // En dan komt de teamsync met een herteken (zoals softRefresh doet)
    renderLibrary();
    const openNa = lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-body').style.display !== 'none';
    const dichtGebleven = lib.querySelector('.lib-group[data-batch="b:batch-2"] .lib-group-body').style.display === 'none';
    const kopNa = lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-head').classList.contains('open');
    return { openVoor, openNa, dichtGebleven, kopNa };
  });
  check('de groep stond open', groep.openVoor, true);
  check('en staat na het hertekenen nog steeds open', groep.openNa, true);
  check('de kop draagt de open-stijl ook nog', groep.kopNa, true);
  check('een groep die dicht was blijft gewoon dicht', groep.dichtGebleven, true);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
