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
  opties.args = ['--host-resolver-rules=MAP console.test 127.0.0.1'];
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

  console.log('\n  wie krijgt het token');
  // De kern. De vraag is niet "welke hostnaam" maar "gaat dit naar onze
  // server" -- rechtstreeks of over de proxy op de eigen origin.
  const oordeel = await proxyPage.evaluate(() => {
    const paden = [
      '/anthropic', '/v1/images/edits', '/openai/images', '/agents/status', '/health'
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
    oordeel.viaEigenOrigin.map(p => p[1]), [true, true, true, true, true]);
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

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
