/* Testlus voor de vraag "gaat deze call naar onze server, en moet de login mee?"
 *
 * Dit bestaat omdat het fout ging. De console herkende de teamserver aan zijn
 * hostnaam: begint de url met https://marketing-ads., dan hoort het teamtoken
 * erbij. Dat klopte zolang er één omgeving was.
 *
 * Toen er een tweede omgeving bij kwam, gingen de calls daar over de eigen
 * origin naar de worker (een proxy in _redirects, zodat CORS geen rol speelt).
 * De url werd https://<die-site>/anthropic, de hostnaamtest faalde stil, en de
 * worker kreeg elk verzoek zonder token: 401. Geen generatie, geen sparren, en
 * geen foutmelding die zei waaróm — want de proxy zelf werkte prima.
 *
 * Een test die met console-boot meekomt vangt dit niet: die logt niet in en
 * doet geen enkele call. Vandaar deze, die precies één ding vraagt: krijgt de
 * juiste url het token, en de verkeerde niet.
 *
 *   node ad-generator/test/teamserver.cjs
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
  /* De browser krijgt één verzonnen hostnaam die naar dezelfde testserver
     wijst. Anders is er geen manier om de console op een ándere host te laten
     draaien dan localhost, en juist dát verschil is wat hier getest wordt. */
  const opties = fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {};
  opties.args = ['--host-resolver-rules=MAP console.test 127.0.0.1, MAP wellshave-werkbank.netlify.app 127.0.0.1, MAP deploy-preview-14--wellshave-adgen.netlify.app 127.0.0.1'];
  const browser = await chromium.launch(opties);

  /* Twee pagina's, want er zijn twee situaties en ze verschillen alleen in de
     hostnaam waarop de console draait:
       127.0.0.1    -> bekende host, dus rechtstreeks naar de worker
       console.test -> onbekende host, dus over de eigen origin (omgeving twee)
     Hetzelfde bestand, dezelfde server, alleen een ander adres in de balk. */
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const proxyPage = await browser.newPage();
  await proxyPage.goto(`http://console.test:${poort}/`, { waitUntil: 'load' });
  await proxyPage.waitForTimeout(1200);

  /* En de tweede omgeving zelf. Die stond tot 4 augustus op de proxyroute; sinds
     de worker haar in zijn CORS-lijst kent, hoort ze rechtstreeks te praten. */
  const werkbankPage = await browser.newPage();
  await werkbankPage.goto(`http://wellshave-werkbank.netlify.app:${poort}/`, { waitUntil: 'load' });
  await werkbankPage.waitForTimeout(1200);

  /* En een deploy preview van diezelfde console. Die draait dezelfde code en
     dus dezelfde lange calls; via de tussenstap sneuvelt het uitwerken van
     drie concepten op de dertig seconden. */
  const previewPage = await browser.newPage();
  await previewPage.goto(`http://deploy-preview-14--wellshave-adgen.netlify.app:${poort}/`, { waitUntil: 'load' });
  await previewPage.waitForTimeout(1200);

  console.log('\n  PROXY_BASE kiest per host');
  const basis = await page.evaluate(() => ({
    hier: PROXY_BASE,
    worker: typeof WORKER_URL !== 'undefined' ? WORKER_URL : null,
    teamserver: window.__WG_TEAMSERVER
  }));
  const basisProxy = await proxyPage.evaluate(() => ({
    hier: PROXY_BASE, origin: location.origin, teamserver: window.__WG_TEAMSERVER
  }));
  check('een bekende host praat rechtstreeks met de worker', basis.hier, basis.worker);
  check('een onbekende host gebruikt zijn eigen origin', basisProxy.hier, basisProxy.origin);
  check('de worker blijft bekend als vaste waarde',
    /^https:\/\/marketing-ads\./.test(basis.worker || ''), true);
  check('en de console blijft in beide gevallen in teamserver-modus',
    [basis.teamserver, basisProxy.teamserver], [true, true]);

  // De lijst in js/01 hoort gelijk te zijn aan ORIGINS in de worker. Loopt die
  // uit de pas, dan valt een omgeving stil terug op de trage route zonder dat
  // iemand het merkt -- tot een lang gesprek halverwege afkapt.
  const werkbank = await werkbankPage.evaluate(() => ({
    hier: PROXY_BASE, worker: WORKER_URL,
    tussenstap: _naarDeWorker(location.origin + '/anthropic')
  }));
  check('de tweede omgeving praat nu rechtstreeks met de worker',
    werkbank.hier, werkbank.worker);
  check('en heeft de tussenstap dus niet meer nodig', werkbank.tussenstap, false);

  const preview = await previewPage.evaluate(() => ({
    hier: PROXY_BASE, worker: WORKER_URL, tussenstap: PROXY_BASE === location.origin
  }));
  check('een deploy preview praat rechtstreeks met de worker', preview.hier, preview.worker);
  check('en heeft de tussenstap dus niet nodig', preview.tussenstap, false);

  console.log('\n  wie krijgt het token');
  // De kern. De vraag is niet "welke hostnaam" maar "gaat dit naar onze
  // server" -- rechtstreeks of over de proxy op de eigen origin.
  const oordeel = await proxyPage.evaluate(() => {
    /* /agents/status stond hier ook in. Die route is verdwenen met de agents
       zelf, dus de console routeert hem niet meer -- en dat hoort ook niet. */
    const paden = [
      '/anthropic', '/v1/images/edits', '/openai/images', '/health'
    ].map(p => [location.origin + p, _naarDeWorker(location.origin + p)]);
    return {
      viaEigenOrigin: paden,
      rechtstreeks: _naarDeWorker('https://marketing-ads.dustin-9ff.workers.dev/anthropic'),
      relatief: _naarDeWorker('/anthropic'),
      vreemdeHost: _naarDeWorker('https://voorbeeld.nl/anthropic'),
      eigenPlaatje: _naarDeWorker(location.origin + '/img/logo.png'),
      eigenModule: _naarDeWorker(location.origin + '/js/08-generator.js'),
      eigenPagina: _naarDeWorker(location.origin + '/'),
      onzin: _naarDeWorker(null)
    };
  });
  check('elk doorgezet pad op de eigen origin telt als de worker',
    oordeel.viaEigenOrigin.map(p => p[1]), [true, true, true, true]);
  check('rechtstreeks naar de worker ook', oordeel.rechtstreeks, true);
  check('en een relatief pad net zo goed', oordeel.relatief, true);

  console.log('\n  en wie niet — een teamtoken deel je niet uit');
  check('een vreemde host krijgt niets', oordeel.vreemdeHost, false);
  check('een plaatje van de eigen site ook niet', oordeel.eigenPlaatje, false);
  check('een js-bestand van de eigen site evenmin', oordeel.eigenModule, false);
  check('en de pagina zelf niet', oordeel.eigenPagina, false);
  check('onzin geeft geen fout maar nee', oordeel.onzin, false);

  console.log('\n  de header komt er ook echt op');
  // Niet alleen de beslissing testen maar de uitvoering: een juiste beslissing
  // met een vergeten header is nog steeds een 401.
  const headers = await proxyPage.evaluate(async () => {
    window.__WG_TOKEN = 'test-token-123';
    const gezien = [];
    const echt = window.fetch;
    window.fetch = async (url, opties) => {
      gezien.push({
        url: String(url),
        auth: (opties && opties.headers && (opties.headers.Authorization
               || (opties.headers.get && opties.headers.get('Authorization')))) || null
      });
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) };
    };
    await fetchJsonWithRetry(location.origin + '/anthropic',
      { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 100 }) });
    await fetchJsonWithRetry(location.origin + '/js/08-generator.js', { method: 'GET' });
    await fetchJsonWithRetry('https://marketing-ads.dustin-9ff.workers.dev/anthropic',
      { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 100 }) });
    window.fetch = echt;
    return gezien;
  });
  check('de call over de eigen origin draagt de login', headers[0].auth, 'Bearer test-token-123');
  check('een gewoon bestand van dezelfde site niet', headers[1].auth, null);
  check('en de rechtstreekse call draagt hem ook', headers[2].auth, 'Bearer test-token-123');

  console.log('\n  de tijdgrens verschilt per route');
  /* Over de eigen origin ligt de grens rond dertig seconden; rechtstreeks mag
     de worker veel langer doorwerken. Een call die op de ene route past en op
     de andere afkapt, hoort dus niet met dezelfde instelling verstuurd te
     worden. */
  const denkwerk = await proxyPage.evaluate(async () => {
    const gezien = [];
    const echt = window.fetch;
    window.fetch = async (url, opties) => {
      gezien.push(JSON.parse(opties.body));
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) };
    };
    await fetchJsonWithRetry(location.origin + '/anthropic',
      { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 1500 }) });
    await fetchJsonWithRetry('https://marketing-ads.dustin-9ff.workers.dev/anthropic',
      { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 1500 }) });
    await fetchJsonWithRetry('https://marketing-ads.dustin-9ff.workers.dev/anthropic',
      { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 8000 }) });
    window.fetch = echt;
    return gezien;
  });
  check('over de tussenstap wordt ook een kleine call begrensd',
    (denkwerk[0].output_config || {}).effort, 'low');
  check('rechtstreeks mag een kleine call vol nadenken',
    (denkwerk[1].output_config || {}).effort, undefined);
  check('en een zware call blijft rechtstreeks ook begrensd',
    (denkwerk[2].output_config || {}).effort, 'low');

  console.log('\n  en een afgekapte call zegt wat er gebeurde');
  const melding = await proxyPage.evaluate(async () => {
    const echt = window.fetch;
    window.fetch = async () => ({ ok: false, status: 504, json: async () => ({}) });
    let tekst = null;
    try {
      await fetchJsonWithRetry(location.origin + '/anthropic',
        { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 100 }) }, 0);
    } catch (e) { tekst = e.message; }
    window.fetch = echt;
    return tekst;
  });
  // "API fout (status 504)" stuurt je naar Anthropic zoeken naar iets wat hier
  // gebeurde. De melding hoort te zeggen wat er werkelijk afkapte -- en vooral
  // wélke van de twee tijdgrenzen het was, want daar hangt de oplossing aan.
  check('een 504 over de tussenstap noemt de tussenstap',
    /tussenstap op deze omgeving kapte af/.test(melding || ''), true);

  const meldingDirect = await werkbankPage.evaluate(async () => {
    const echt = window.fetch;
    window.fetch = async () => ({ ok: false, status: 504, json: async () => ({}) });
    let tekst = null;
    try {
      await fetchJsonWithRetry(WORKER_URL + '/anthropic',
        { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 100 }) }, 0);
    } catch (e) { tekst = e.message; }
    window.fetch = echt;
    return tekst;
  });
  check('en dezelfde 504 rechtstreeks noemt de worker en de honderd seconden',
    /worker kapte af na ongeveer honderd seconden|verbinding met de worker kapte af na ongeveer honderd seconden/
      .test(meldingDirect || ''), true);

  console.log('\n  een overload wordt uitgezeten, niet doorgegeven');
  /* Anthropic geeft bij drukte een 529 met "Overloaded". Dat duurt meestal
     tientallen seconden -- twee snelle pogingen zaten dat nooit uit, en dan
     stond er "Concepts failed: Overloaded" op een generatie die gewoon even
     later gelukt was. Drie dingen horen waar te zijn: hij probeert vaker met
     oplopend wachten, hij zégt dat hij wacht, en als het echt niet lukt legt
     de melding uit dat opnieuw drukken volstaat. */
  const overload = await proxyPage.evaluate(async () => {
    const echt = window.fetch;
    const echteToast = window.toast;
    let pogingen = 0;
    const wachttijden = [];
    const meldingen = [];
    const echteSetTimeout = window.setTimeout;
    window.setTimeout = (fn, ms) => { wachttijden.push(ms); return echteSetTimeout(fn, 1); };
    window.toast = (m) => meldingen.push(String(m));
    window.fetch = async () => {
      pogingen++;
      if (pogingen < 3) return { ok: false, status: 529, json: async () => ({ error: { message: 'Overloaded' } }) };
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'gelukt' }] }) };
    };
    /* delayMs op 40 zodat de test niet echt seconden zit te wachten; de
       verdubbeling (40, 80) is wat hier getest wordt, niet de absolute duur.
       Het filter eronder houdt alleen die herkenbare waarden over, zodat een
       toevallige timer van de app zelf de meting niet vervuilt. */
    const data = await fetchJsonWithRetry(location.origin + '/anthropic',
      { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 100 }) }, 4, 40);

    // En nu een overload die nooit overgaat: wat zegt de eindmelding?
    window.fetch = async () => ({ ok: false, status: 529, json: async () => ({ error: { message: 'Overloaded' } }) });
    let eind = null;
    try {
      await fetchJsonWithRetry(location.origin + '/anthropic',
        { method: 'POST', body: JSON.stringify({ messages: [], max_tokens: 100 }) }, 1, 5);
    } catch (e) { eind = e.message; }

    window.fetch = echt; window.toast = echteToast; window.setTimeout = echteSetTimeout;
    return { pogingen, wachttijden, meldingen, tekst: (data.content || [{}])[0].text, eind };
  });
  check('na twee keer 529 komt de derde poging er gewoon door', overload.tekst, 'gelukt');
  check('en het wachten verdubbelt per poging',
    overload.wachttijden.filter(ms => ms === 40 || ms === 80).slice(0, 2), [40, 80]);
  check('tijdens het wachten staat er een melding, geen bevroren scherm',
    overload.meldingen.filter(m => /busy|retrying/i.test(m)).length >= 2, true);
  check('een overload die aanhoudt legt uit dat opnieuw drukken volstaat',
    /overloaded right now[\s\S]*press the button again/i.test(overload.eind || ''), true);
  /* De tests hierboven geven het aantal pogingen expliciet mee; de console
     zelf leunt op de standaard. Die hoort op vier te staan (3+6+12+24 s zit
     een gewone overload uit) -- terug naar twee en het oude gedrag is stil
     terug. */
  const proxyBron = fs.readFileSync(path.join(APP, 'js', '04-instellingen-en-proxy.js'), 'utf8');
  check('de standaard is vier herkansingen', /maxRetries = 4/.test(proxyBron), true);

  console.log('\n  de lijst hier en de lijst in de worker lopen gelijk');
  const workerBron = fs.readFileSync(
    path.join(__dirname, '..', '..', 'platform', 'worker', 'marketing-os.worker.js'), 'utf8');
  const uitWorker = (workerBron.match(/const ORIGINS = \[([\s\S]*?)\]/) || [])[1] || '';
  const hostsWorker = (uitWorker.match(/https:\/\/[^']+/g) || []).map(u => u.replace('https://', ''));
  const appBron = fs.readFileSync(path.join(APP, 'js', '01-fable-en-changelog.js'), 'utf8');
  const hostsApp = ((appBron.match(/WORKER_HOSTS = \[([^\]]*)\]/) || [])[1] || '')
    .split(',').map(s2 => s2.trim().replace(/'/g, '')).filter(Boolean);
  check('elke host die de console rechtstreeks aanroept, staat ook in de worker',
    hostsApp.filter(h => hostsWorker.indexOf(h) === -1), []);

  /* Sinds de deploy previews erbij mogen staat er naast de lijst een patroon,
     aan beide kanten. Lopen die uit elkaar, dan belt de console rechtstreeks
     aan bij een worker die de deur dichthoudt -- en dan valt de app terug op
     de tussenstap die lange calls afkapt. Precies de storing die dit patroon
     moest oplossen, maar dan onvindbaar. */
  const patroonApp = new RegExp(
    (appBron.match(/WORKER_HOST_PATROON = \/(.+?)\/;/) || [])[1] || '$^');
  const patroonWorker = new RegExp(
    (workerBron.match(/ORIGIN_PATROON = \/(.+?)\/;/) || [])[1] || '$^');
  const proef = ['deploy-preview-14--wellshave-adgen.netlify.app',
                 'deploy-preview-7--wellshave-werkbank.netlify.app'];
  const nep = ['deploy-preview-14--wellshave-adgen.netlify.app.kwaad.nl',
               'boos--wellshave-adgen.netlify.app'];
  check('de console laat de deploy previews rechtstreeks bellen',
    proef.filter(h => !patroonApp.test(h)), []);
  check('en de worker doet voor exact dezelfde adressen open',
    proef.filter(h => !patroonWorker.test('https://' + h)), []);
  check('een adres dat er alleen op lijkt komt er bij geen van beide in',
    nep.filter(h => patroonApp.test(h) || patroonWorker.test('https://' + h)), []);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
