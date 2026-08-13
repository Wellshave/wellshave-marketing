/* Testlus voor groepering — ontwerpcontract 6c.
 *
 * Waarom dit een testlus verdient en niet "even kijken of het mooi is":
 *
 *   Groepering is het enige onderdeel van het ontwerp dat je niet ziet als het
 *   klopt en ook niet als het níét klopt. Je merkt alleen dat een scherm
 *   vermoeiend leest. Precies daarom verdween het: twintig css-lagen die elk
 *   een afstand bijstelden, en niemand die naging of de afstand tussen twee
 *   groepen nog groter was dan de afstand binnen één groep. Op het moment dat
 *   deze lus geschreven werd, was in de zijbalk beide 2px en bij de kolommen
 *   12 tegen 14. Dat is niet "een beetje krap" — dat is ruimte die actief
 *   beweert dat alles even veel met elkaar te maken heeft.
 *
 *   De lus meet daarom verhoudingen in een echte browser en geen vaste
 *   pixelwaarden. Een vaste waarde breekt zodra iemand de schaal verschuift;
 *   een verhouding breekt alleen als de betekenis breekt.
 *
 *   node ad-generator/test/groepering.cjs
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

let fouten = 0;
const check = (label, ok, uitleg) => {
  if (!ok) fouten++;
  console.log(`  ${ok ? 'ok  ' : 'FOUT'} ${label}${ok || !uitleg ? '' : `\n       ${uitleg}`}`);
};

/* Wordt in de pagina uitgevoerd. Alles wat gemeten wordt komt uit
   getBoundingClientRect: dat is waar het oog naar kijkt, niet wat de css
   beweert. Een marge die door een andere laag wordt overschreven staat nog
   steeds in het stylesheet maar niet meer op het scherm. */
function meetInPagina() {
  const zichtbaar = el => el.getBoundingClientRect().height > 0;
  const gat = (a, b) => Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom);

  /* ── zijbalk ── */
  const zij = [...document.querySelector('.ws-sidebar').children].filter(zichtbaar);
  const binnenGroep = [], tussenGroepen = [];
  for (let i = 1; i < zij.length; i++) {
    const a = zij[i - 1], b = zij[i];
    if (!a.classList.contains('ws-nav-item')) continue;
    if (b.classList.contains('ws-nav-item')) binnenGroep.push(gat(a, b));
    else if (b.classList.contains('ws-nav-section')) tussenGroepen.push(gat(a, b));
  }
  const koppen = [...document.querySelectorAll('.ws-sidebar .ws-nav-section')].filter(zichtbaar);
  const randBoven = k => parseFloat(getComputedStyle(k).borderTopWidth) || 0;

  /* De kop hoort dichter bij zijn eigen groep te staan dan bij de vorige. */
  const kopNaarGroep = koppen.map(k => {
    let n = k.nextElementSibling;
    while (n && !zichtbaar(n)) n = n.nextElementSibling;
    return n ? gat(k, n) : null;
  }).filter(v => v !== null);

  /* ── kolommen van het werkscherm ── */
  const kolommen = ['.ws8-left', '.ws8-center', '.ws8-right'].map(s => document.querySelector(s));
  const goot = kolommen[0] && kolommen[1]
    ? Math.round(kolommen[1].getBoundingClientRect().left - kolommen[0].getBoundingClientRect().right) : null;
  const binnenKolom = [];
  for (const k of kolommen) {
    if (!k) continue;
    const kids = [...k.children].filter(zichtbaar);
    for (let i = 2; i < kids.length; i++) binnenKolom.push(gat(kids[i - 1], kids[i]));
  }

  /* ── kolomkoppen ── */
  const zoneKoppen = kolommen.map(k => {
    if (!k) return null;
    const l = k.querySelector(':scope > .ws8-zone-lbl');
    if (!l) return null;
    return { tekst: l.textContent.trim(), rand: parseFloat(getComputedStyle(l).borderBottomWidth) || 0,
             eerste: k.firstElementChild === l };
  });

  /* ── zwevende stapkoppen ── */
  const stappen = [...document.querySelectorAll('.ws8-step')].filter(zichtbaar).map(s => {
    const zussen = [...s.parentNode.children].filter(zichtbaar);
    const i = zussen.indexOf(s);
    return { tekst: s.textContent.trim().slice(0, 22),
             boven: i > 0 ? gat(zussen[i - 1], s) : null,
             onder: i < zussen.length - 1 ? gat(s, zussen[i + 1]) : null };
  });

  return { binnenGroep, tussenGroepen, kopNaarGroep,
           eersteKopHeeftRand: koppen.length ? randBoven(koppen[0]) > 0 : null,
           latereKoppenHebbenRand: koppen.slice(1).map(randBoven),
           goot, binnenKolom, zoneKoppen, stappen };
}

(async () => {
  const [srv, port] = await serve(APP);
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const jsFouten = [];
  page.on('pageerror', e => jsFouten.push(String(e.message).split('\n')[0]));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.click('#main-tab-btn-generator');
  await page.waitForTimeout(900);
  const m = await page.evaluate(meetInPagina);

  const max = a => a.length ? Math.max(...a) : null;
  const min = a => a.length ? Math.min(...a) : null;

  console.log('\n  regel 6c.1 — tussen groepen is minstens het dubbele van binnen een groep');
  check('de zijbalk heeft groepen om te meten',
    m.binnenGroep.length >= 3 && m.tussenGroepen.length >= 3,
    `binnen ${m.binnenGroep.length}, tussen ${m.tussenGroepen.length}`);
  check('zijbalk: de sprong naar een nieuwe groep is minstens 2x de stap binnen een groep',
    min(m.tussenGroepen) >= 2 * max(m.binnenGroep),
    `binnen max ${max(m.binnenGroep)}px, tussen min ${min(m.tussenGroepen)}px`);
  check('werkscherm: de goot tussen twee kolommen is minstens 2x de ruimte binnen een kolom',
    m.goot !== null && m.binnenKolom.length > 0 && m.goot >= 2 * max(m.binnenKolom),
    `goot ${m.goot}px, binnen een kolom max ${max(m.binnenKolom)}px`);

  console.log('\n  regel 6c.2 — één zichtbare naad per groepsgrens, en geen naad waar geen grens is');
  check('elke groepskop behalve de eerste draagt een lijn',
    m.latereKoppenHebbenRand.length >= 3 && m.latereKoppenHebbenRand.every(w => w > 0),
    JSON.stringify(m.latereKoppenHebbenRand));
  /* De eerste kop grenst aan het logo. Een lijn daar tekent een scheiding
     tussen twee dingen die niet gescheiden hoeven te worden. */
  check('de eerste groepskop draagt er geen — daar begint niets nieuws',
    m.eersteKopHeeftRand === false, `rand boven eerste kop: ${m.eersteKopHeeftRand}`);

  console.log('\n  regel 6c.3 — een kop hoort bij wat eronder staat en bewijst dat met ruimte');
  check('zijbalk: elke groepskop staat hoogstens half zo ver van zijn groep als van de vorige',
    m.kopNaarGroep.length >= 3 && max(m.kopNaarGroep) * 2 <= min(m.tussenGroepen),
    `kop→groep max ${max(m.kopNaarGroep)}px, vorige→kop min ${min(m.tussenGroepen)}px`);
  check('er staat minstens één stapkop op het werkscherm', m.stappen.length >= 1,
    JSON.stringify(m.stappen));
  for (const s of m.stappen)
    check(`"${s.tekst}" staat dichter bij wat hij benoemt dan bij wat erboven staat`,
      s.onder !== null && s.boven !== null && s.onder * 2 <= s.boven,
      `${s.boven}px erboven, ${s.onder}px eronder`);

  console.log('\n  regel 6c.6 — elke kolom draagt zijn naam met een lijn eronder');
  const namen = ['links', 'midden', 'rechts'];
  m.zoneKoppen.forEach((k, i) => {
    check(`de ${namen[i]}e kolom heeft een kop`, !!k, 'geen .ws8-zone-lbl als eerste kind');
    if (!k) return;
    check(`  "${k.tekst}" staat bovenaan de kolom`, k.eerste === true);
    check(`  en draagt de lijn die de kolom afbakent`, k.rand > 0, `randbreedte ${k.rand}`);
  });

  console.log('\n  de laag breekt niets');
  check('geen javascript-fouten op de pagina', jsFouten.length === 0, jsFouten.join('\n       '));

  await browser.close(); srv.close();
  console.log('');
  if (fouten) { console.log(`${fouten} controle(s) mislukt`); process.exit(1); }
  console.log('Alles klopt');
})();
