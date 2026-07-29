/* Opstarttest voor de Atelier Console.
 *
 * De console is opgesplitst in 12 css- en 28 js-bestanden die de browser in
 * een vaste volgorde binnenkrijgt. Die volgorde is het enige wat hem overeind
 * houdt: er is geen bundler die dat voor je controleert. Deze test start de
 * echte pagina in Chromium en kijkt of hij nog heel is.
 *
 *   node ad-generator/test/console-boot.cjs
 *
 * Met een referentiebestand vergelijkt hij twee versies in plaats van te
 * controleren op vaste drempels — zo is de opsplitsing zelf bewezen:
 *
 *   node ad-generator/test/console-boot.cjs pad/naar/oude-index.html
 *
 * Alles behalve script-, style- en link-tags moet dan tot op het element
 * gelijk zijn. Netwerkfouten (CDN's, Supabase) horen erbij als je offline
 * draait; ze tellen alleen mee als de twee versies erin verschillen.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const REFERENTIE = process.argv[2] ? path.resolve(process.argv[2]) : null;
const CHROOM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serve(root, bestand) {
  const s = http.createServer((req, res) => {
    const rel = req.url === '/' ? bestand : decodeURIComponent(req.url.split('?')[0]).slice(1);
    const p = path.join(root, rel);
    if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end('x'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'text/plain' });
    res.end(fs.readFileSync(p));
  });
  return new Promise(r => s.listen(0, () => r([s, s.address().port])));
}

/* De functies die de HTML via onclick= aanroept. Die MOETEN op window staan;
   dat is precies wat een opsplitsing in ES-modules zou hebben gesloopt, want
   die krijgen hun eigen scope. Vandaar losse <script src> zonder type=module. */
const GEEN_FUNCTIE = new Set(['if', 'for', 'while', 'switch', 'catch', 'return',
  'typeof', 'function', 'new', 'do', 'else', 'try', 'this', 'delete', 'void']);

function handlerNamen() {
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  const namen = new Set();
  for (const m of html.matchAll(/\son[a-z]+="([^"]*)"/g))
    // (?<![.\w]) sluit methode-aanroepen uit: el.focus() is geen globale functie
    for (const f of m[1].matchAll(/(?<![.\w])([A-Za-z_][A-Za-z0-9_]*)\s*\(/g))
      if (!GEEN_FUNCTIE.has(f[1])) namen.add(f[1]);
  return [...namen];
}

/* Afgeleid uit de markup, niet gegokt: de meest gebruikte klassen plus de
   dragende elementen. Als de cascade verschuift, verschuift hier een waarde. */
const SLEUTELS = ['body', '.label', '.field', '.btn', '.btn-small', '.btn-ghost',
                  '.ws-nav-item', '.proxy-step', '.archetype-title', '.example-link',
                  'h1', 'input', 'textarea', 'select', 'button', '#results'];

async function meet(browser, port, namen) {
  const page = await browser.newPage();
  const fouten = [];
  page.on('pageerror', e => fouten.push('js: ' + String(e.message).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') fouten.push('console: ' + m.text().slice(0, 120)); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);          // init + setTimeout-werk laten landen

  const r = await page.evaluate(({ namen, sleutels }) => {
    const stijl = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const c = getComputedStyle(el);
      return [c.backgroundColor, c.color, c.fontFamily, c.fontSize, c.padding,
              c.borderRadius, c.display, c.width].join('|');
    };
    return {
      // script-, style- en link-tags tellen niet mee: dat IS de opsplitsing
      // (één inline blok werd 19 verwijzingen, 12 <style> werden <link>).
      elementen: document.querySelectorAll('*:not(script):not(link):not(style)').length,
      tags: document.querySelectorAll('script, link, style').length,
      ids: [...document.querySelectorAll('[id]')].map(e => e.id).sort().join(','),
      ontbrekend: namen.filter(n => typeof window[n] !== 'function'),
      stijlen: sleutels.map(s => s + '=' + stijl(s)).join('\n'),
      titel: document.title,
      tekst: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 4000),
    };
  }, { namen, sleutels: SLEUTELS });
  await page.close();
  return { ...r, fouten };
}

let fout = 0;
const check = (label, ok, uitleg) => {
  if (!ok) fout++;
  console.log(`  ${ok ? 'ok  ' : 'FOUT'} ${label}${ok || !uitleg ? '' : `\n       ${uitleg}`}`);
};

(async () => {
  const namen = handlerNamen();
  const [srvApp, poortApp] = await serve(APP, 'index.html');
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const b = await meet(browser, poortApp, namen);

  if (REFERENTIE) {
    const [srvRef, poortRef] = await serve(path.dirname(REFERENTIE), path.basename(REFERENTIE));
    const a = await meet(browser, poortRef, namen);
    const gelijk = (l, x, y) => check(l, JSON.stringify(x) === JSON.stringify(y),
      `origineel ${String(x).slice(0, 90)}\n       nieuw     ${String(y).slice(0, 90)}`);
    console.log(`  vergelijking met ${path.basename(REFERENTIE)} (${namen.length} handlers)\n`);
    gelijk('paginatitel', a.titel, b.titel);
    gelijk('DOM-elementen (excl. script/style/link)', a.elementen, b.elementen);
    gelijk('alle element-ids', a.ids, b.ids);
    gelijk('zichtbare tekst', a.tekst, b.tekst);
    gelijk(`berekende stijlen van ${SLEUTELS.length} sleutelelementen`, a.stijlen, b.stijlen);
    gelijk('globale functies die de HTML aanroept', a.ontbrekend, b.ontbrekend);
    // Alleen JavaScript-fouten hard vergelijken. Netwerkfouten (geblokkeerde
    // CDN's, Supabase) komen er offline per run anders uit; die exact
    // vergelijken maakt de test wisselvallig zonder iets te bewijzen.
    const js = r => r.fouten.filter(f => f.startsWith('js:'));
    gelijk('JavaScript-fouten tijdens opstarten', js(a), js(b));
    const net = r => r.fouten.length - js(r).length;
    console.log(`\n  netwerkfouten (niet vergeleken): ${net(a)} origineel, ${net(b)} nieuw`);
    console.log(`\n  origineel ${a.elementen} elementen + ${a.tags} tags · nieuw ${b.elementen} + ${b.tags}`);
    srvRef.close();
  } else {
    const jsFouten = b.fouten.filter(f => f.startsWith('js:'));
    console.log(`  ${namen.length} handlers, ${b.elementen} elementen, ${b.tags} script/style/link-tags\n`);
    check('de pagina start zonder JavaScript-fouten', jsFouten.length === 0, jsFouten.slice(0, 3).join('\n       '));
    check('alle onclick-functies staan op window',
      b.ontbrekend.length === 0, 'ontbreekt: ' + b.ontbrekend.slice(0, 10).join(', '));
    check('de markup is opgebouwd', b.elementen > 2500, `maar ${b.elementen} elementen`);
    const aanwezig = b.stijlen.split('\n').filter(r => !r.endsWith('=null'));
    const kaal = aanwezig.filter(r => !/rgb/.test(r)).map(r => r.split('=')[0]);
    check('de stijlen zijn toegepast',
      aanwezig.length === SLEUTELS.length && kaal.length === 0,
      `${aanwezig.length}/${SLEUTELS.length} gevonden` +
      (kaal.length ? `, zonder stijl: ${kaal.join(', ')}` : '') +
      (aanwezig.length < SLEUTELS.length
        ? `, ontbreekt: ${SLEUTELS.filter(x => !aanwezig.some(r => r.startsWith(x + '='))).join(', ')}` : ''));
    check('elk css- en js-bestand is geladen',
      b.tags >= 12 + 28, `maar ${b.tags} tags — een bestand mist of laadt niet`);
    const net = b.fouten.filter(f => !f.startsWith('js:'));
    if (net.length) console.log(`\n  (${net.length} netwerkfout(en) — normaal zonder internet: CDN's en Supabase)`);
  }

  await browser.close(); srvApp.close();
  console.log(fout ? `\n  ${fout} controle(s) mislukt` : '\n  Alle controles geslaagd');
  process.exit(fout ? 1 : 0);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
