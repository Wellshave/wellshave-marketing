/* Testlus voor de werkbank — de werkruimte om het agentteam te managen.
 *
 * Het templateantwoord voor een agentsysteem is een raster van negen kaartjes
 * met statusbolletjes. Hoofdstuk 3 van het ontwerpcontract verbiedt dat, en
 * niet uit smaak: zo'n raster toont negen wezens die iets doen, maar nooit dat
 * ze sámen ergens uitkomen. De eenheid hier is het werkstuk.
 *
 * Wat hier bewezen moet worden:
 *   - elk werkstuk toont ALLE zes de stations, ook de stappen die nog niet
 *     gebeurd zijn (regel 3.1 — een lege stap is informatie)
 *   - een afgeronde stap krijgt een vinkje, niet alleen een kleur (regel 4.4)
 *   - de actieve stap zegt waaróp gewacht wordt, in mensentaal (regel 3.3)
 *   - er is nooit een leeg vlak waar een reden hoort (regel 0.4)
 *
 *   node ad-generator/test/werkbank.cjs
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

/* De view levert sinds 0021 per stap ook `door` (de naam) en `door_soort`
   (mens of agent). Een stap waaraan gewerkt is zonder naam bestaat echt: twee
   werkstukken uit juli zijn niet te herleiden en blijven zo. */
const st = (station, naam, agent, status, overdracht, waarom, door, door_soort) =>
  ({ station, naam, agent, status, overdracht, waarom, afgerond: null,
     door: door === undefined ? (agent ? agent : null) : door,
     door_soort: door_soort === undefined ? (agent ? 'agent' : null) : door_soort });

/* De echte stand op productie voor de eerste twee, plus drie verzonnen gevallen
   die de takken raken die daar (nog) niet in voorkomen. */
const RIJEN = [
  { id: 9, brand: 'wellshave', titel: '184.000+ mannen googelden dit ook.',
    product: 'Groom Guard', persona: 'Mark de Vries', angle_type: null,
    toestand: 'loopt', stappen_af: 1, station_nu: 4,
    station_naam: 'live', overdracht: 'poort', wacht_op: 'jij',
    stil_uren: 77, stil_grens_uren: 72, te_stil: true,
    waarom: 'ligt bij jou op station 4 — live',
    blokkade: 'de Criticus heeft hier nog geen oordeel over geveld',
    blokkade_soort: 'oordeel', aantal_creatives: 3,
    aantal_ads: 6, spend: 340, roas: 1.82, winnaars: 1,
    stappen: [
      st(1,'signaal','radar','niet_vastgelegd','vanzelf','bestond vóór de estafette'),
      st(2,'briefing','nova','niet_vastgelegd','vanzelf','bestond vóór de estafette'),
      st(3,'creatie',null,'klaar','mens','Creative gemaakt in de Atelier Console','Dustin Gibson','mens'),
      st(4,'live','bolt','open','poort',null),
      st(5,'meting','atlas','open','vanzelf',null),
      st(6,'oogst','echo','open','poort',null) ] },

  { id: 12, brand: 'wellshave', titel: 'Nekirritatie bij hoge kraag',
    product: 'Scheerschuim', persona: 'Man 30-45', angle_type: 'Problem-Solution',
    toestand: 'loopt', stappen_af: 1, station_nu: 2,
    station_naam: 'briefing', overdracht: 'vanzelf', wacht_op: 'nova',
    stil_uren: 3, stil_grens_uren: 24, te_stil: false,
    waarom: 'ligt bij nova op station 2 — briefing',
    blokkade: null, blokkade_soort: null, aantal_creatives: 0,
    aantal_ads: 0, spend: null, roas: null, winnaars: 0,
    stappen: [
      st(1,'signaal','radar','klaar','vanzelf','hoek kwam op in de markt'),
      st(2,'briefing','nova','bezig','vanzelf',null),
      st(3,'creatie',null,'open','mens',null),
      st(4,'live','bolt','open','poort',null),
      st(5,'meting','atlas','open','vanzelf',null),
      st(6,'oogst','echo','open','poort',null) ] },

  { id: 14, brand: 'wellshave', titel: 'Vastgelopen idee',
    product: 'Scheermes', persona: 'Man 45+', angle_type: 'Authority / Expert',
    toestand: 'vastgelopen', stappen_af: 2, station_nu: 3,
    station_naam: 'creatie', overdracht: 'mens', wacht_op: 'jij',
    stil_uren: 300, stil_grens_uren: 168, te_stil: true,
    waarom: 'een stap is mislukt en niemand heeft hem opgepakt',
    blokkade: 'de Criticus liet dit niet door: de belofte staat niet op de landingspagina',
    blokkade_soort: 'afgekeurd', aantal_creatives: 2,
    aantal_ads: 0, spend: null, roas: null, winnaars: 0,
    stappen: [
      st(1,'signaal','radar','klaar','vanzelf','signaal'),
      st(2,'briefing','nova','klaar','vanzelf','gebrieft'),
      st(3,'creatie',null,'mislukt','mens','beeldgeneratie viel om', null, null),
      st(4,'live','bolt','open','poort',null),
      st(5,'meting','atlas','open','vanzelf',null),
      st(6,'oogst','echo','open','poort',null) ] },

  { id: 15, brand: 'wellshave', titel: 'Afgerond idee',
    product: 'Scheermes', persona: 'Man 30-45', angle_type: 'Social Proof / Reviews',
    toestand: 'klaar', stappen_af: 6, station_nu: null,
    station_naam: null, overdracht: null, wacht_op: null,
    stil_uren: 400, stil_grens_uren: 72, te_stil: false,
    waarom: 'alle zes de stations af',
    blokkade: null, blokkade_soort: null, aantal_creatives: 3,
    aantal_ads: 3, spend: 900, roas: 3.1, winnaars: 2,
    stappen: [1,2,3,4,5,6].map(n => st(n, ['','signaal','briefing','creatie','live','meting','oogst'][n],
      'nova', 'klaar', 'vanzelf', 'af')) },
];

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
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const teken = async (antwoord, ingelogd = true) => await page.evaluate(async ({ antwoord, ingelogd }) => {
    window._sb = ingelogd ? { from: function () {
      const q = {};
      ['select', 'eq', 'ilike', 'in', 'order', 'limit'].forEach(m => { q[m] = () => q; });
      q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
      return q;
    }} : null;
    window._authProfile = ingelogd ? { id: 'test' } : null;
    window._userRole = 'admin';
    switchMainTab('werkbank');
    _wbk.geladen = false; _wbk.rijen = null; _wbk.fout = null;
    renderWerkbank();
    await new Promise(r => setTimeout(r, 250));

    const m = document.getElementById('wbk-mount');
    const stuk = (i) => {
      const k = m.querySelectorAll('.wbk-stuk')[i];
      if (!k) return null;
      return {
        titel: k.querySelector('.wbk-titel').textContent.trim(),
        stations: [...k.querySelectorAll('.wbk-stap-naam')].map(e => e.textContent.trim()),
        tekens: [...k.querySelectorAll('.wbk-bol')].map(e => e.textContent.trim()),
        soorten: [...k.querySelectorAll('.wbk-bol')].map(e =>
          [...e.classList].find(c => c.startsWith('wbk-bol--')) || ''),
        agents: [...k.querySelectorAll('.wbk-stap-agent')].map(e => e.textContent.trim()),
        teller: k.querySelector('.wbk-teller').textContent.trim(),
        wachtOp: k.querySelector('.wbk-wacht-op').textContent.trim(),
        waarom: k.querySelector('.wbk-wacht-tekst').textContent.trim(),
        chip: (k.querySelector('.wbk-chip') || {}).textContent,
        stilKlasse: k.classList.contains('wbk-stuk--stil'),
        cijfers: (k.querySelector('.wbk-cijfers') || {}).textContent,
        blokKop:   (k.querySelector('.wbk-blok-kop')   || {}).textContent,
        blokTekst: (k.querySelector('.wbk-blok-tekst') || {}).textContent,
      };
    };
    return {
      vraag: (m.querySelector('.wbk-vraag') || {}).textContent,
      bron: (m.querySelector('.wbk-bron') || {}).textContent,
      groepen: [...m.querySelectorAll('.wbk-groep-kop')].map(e => e.textContent.trim()),
      stukken: [0,1,2,3].map(stuk).filter(Boolean),
      leegKoppen: [...m.querySelectorAll('.wbk-leeg-kop')].map(e => e.textContent.trim()),
      leegTekst: [...m.querySelectorAll('.wbk-leeg p')].map(e => e.textContent.trim()).join(' '),
      alles: m.textContent.replace(/\s+/g, ' ').trim(),
      tabZichtbaar: getComputedStyle(document.getElementById('main-tab-werkbank')).display,
      knopActief: document.getElementById('main-tab-btn-werkbank').classList.contains('active'),
      titel: document.getElementById('ws-page-title').textContent,
    };
  }, { antwoord, ingelogd });

  const uit = await teken({ data: RIJEN });

  console.log('\n  het tabblad zelf');
  check('het paneel is zichtbaar',      uit.tabZichtbaar, 'block');
  check('de knop staat actief',         uit.knopActief, true);
  check('en de paginatitel klopt',      uit.titel, 'Werkbank');

  console.log('\n  regel 0.1 — de beslisvraag staat op het scherm');
  check('voluit', uit.vraag, 'Welk werk ligt stil, en op wie wacht het?');
  check('met hoeveel er op jou wachten',
    /2 wachten op jou/.test(uit.bron), true);

  console.log('\n  hoofdstuk 3 — de eenheid is het werkstuk, niet de agent');
  check('drie groepen, op toestand en niet op agent',
    uit.groepen.map(g => g.split('(')[0].trim()), ['Te lang stil', 'Loopt', 'Af of gestopt']);
  check('te lang stil eerst, grootste stilte bovenaan',
    uit.stukken.map(s => s.titel),
    ['184.000+ mannen googelden dit ook.', 'Vastgelopen idee',
     'Nekirritatie bij hoge kraag', 'Afgerond idee']);

  console.log('\n  regel 3.1 — de volledige keten, ook wat nog moet gebeuren');
  const w9 = uit.stukken[0];
  check('alle zes de stations staan er', w9.stations,
    ['signaal','briefing','creatie','live','meting','oogst']);
  check('ook bij een werkstuk dat pas bij station 4 is', w9.stations.length, 6);
  check('de teller zegt hoe ver het is', w9.teller, '1 van 6 stations af');

  console.log('\n  regel 4.4 — vorm draagt de betekenis, niet alleen kleur');
  check('een afgeronde stap krijgt een vinkje', w9.tekens[2], '✓');
  check('de actieve stap een bolletje',        w9.tekens[3], '●');
  check('en wat nog moet komen zijn nummers',  w9.tekens.slice(4), ['5','6']);
  check('een mislukte stap roept',             uit.stukken[1].tekens[2], '!');
  check('en elk teken heeft een eigen soort',
    w9.soorten, ['wbk-bol--open','wbk-bol--open','wbk-bol--klaar','wbk-bol--nu','wbk-bol--open','wbk-bol--open']);

  console.log('\n  regel 3.2 — wie het deed staat erbij');
  check('per station een naam', w9.agents,
    ['radar','nova','Dustin Gibson','bolt','atlas','echo']);
  check('een mens staat er met zijn eigen naam, niet als "jij"', w9.agents[2], 'Dustin Gibson');
  // Een stap waaraan gewerkt is zonder bekende naam mag niet de agent van het
  // station lenen -- dan zou er staan dat iemand iets deed wat hij niet deed.
  check('een naamloze stap zegt dat, en leent geen naam',
    uit.stukken[1].agents[2], 'naamloos');
  check('en een stap die nog moet gebeuren toont wie het hoort te doen',
    uit.stukken[1].agents[3], 'bolt');

  console.log('\n  regel 3.3 — waarop gewacht wordt, in mensentaal');
  check('wacht het op jou, dan staat dat er zo',   w9.wachtOp, 'Wacht op jou');
  check('wacht het op een agent, dan met naam',    uit.stukken[2].wachtOp, 'Wacht op nova');
  check('een afgerond werkstuk wacht op niemand',  uit.stukken[3].wachtOp, 'Niemand wacht');
  check('met de reden erachter',                   w9.waarom, 'ligt bij jou op station 4 — live');

  console.log('\n  stilte is een getal met een grens erbij');
  check('te lang stil zegt "te lang"',      w9.chip, '77 uur stil — te lang');
  check('en anders staat de grens erbij',   uit.stukken[2].chip, '3 uur stil van 24');
  check('alleen wat te lang stilligt krijgt de rand',
    uit.stukken.map(s => s.stilKlasse), [true, true, false, false]);

  console.log('\n  cijfers alleen waar ze bestaan');
  check('een werkstuk met advertenties toont ze',
    /6 advertenties.*€ 340.*ROAS 1,82.*1 winnaar/.test(w9.cijfers || ''), true);
  check('een werkstuk zonder advertenties toont geen lege cijfers',
    uit.stukken[2].cijfers, undefined);

  console.log('\n  wat het tegenhoudt staat er, en alleen waar het bestaat');
  // Waar het ligt en waarom het daar niet weg kan zijn twee dingen. Stonden ze
  // in één zin, dan zou "ligt bij jou op station 4" blijven suggereren dat jij
  // aan zet bent terwijl het op een oordeel wacht.
  check('een werkstuk dat op een oordeel wacht zegt dat',
    w9.blokKop, 'Wacht op de Criticus');
  check('met de reden eronder',
    w9.blokTekst, 'de Criticus heeft hier nog geen oordeel over geveld');
  check('en de regel waar het ligt blijft daarnaast staan',
    w9.waarom, 'ligt bij jou op station 4 — live');
  // Tegengehouden vraagt om terugsturen, wachten vraagt om lezen. Twee
  // besluiten, dus twee woorden -- niet één kleurtje met twee betekenissen.
  check('afgekeurd krijgt een ander woord dan wachten',
    uit.stukken[1].blokKop, 'Tegengehouden');
  check('en de reden van de Criticus staat er letterlijk bij',
    /de belofte staat niet op de landingspagina/.test(uit.stukken[1].blokTekst || ''), true);
  check('zonder blokkade staat er geen blok',
    uit.stukken[2].blokKop, undefined);
  check('een afgerond werkstuk kent geen blokkade',
    uit.stukken[3].blokKop, undefined);

  console.log('\n  het aantal creatives wordt geteld, niet onthouden');
  check('een werkstuk dat nog nooit draaide toont zijn creatives',
    /2 creatives, nog niet gedraaid/.test(uit.stukken[1].cijfers || ''), true);
  check('en met advertenties erbij vervalt die toevoeging',
    /3 creatives.*6 advertenties/.test(w9.cijfers || ''), true);
  check('nul creatives geeft geen lege regel',
    uit.stukken[2].cijfers, undefined);

  console.log('\n  regel 0.4 — nooit een leeg vlak');
  const geenStil = await teken({ data: RIJEN.filter(r => !r.te_stil) });
  check('een lege groep blijft staan met een reden',
    geenStil.leegKoppen.indexOf('Niets ligt te lang stil.') > -1, true);
  check('en die reden legt uit waarom dat goed nieuws is',
    /recenter aangeraakt dan wat bij zijn soort overdracht normaal is/.test(geenStil.leegTekst), true);

  const leeg = await teken({ data: [] });
  check('nul werkstukken geeft geen leeg scherm', leeg.leegKoppen[0], 'Er is nog geen werkstuk.');
  check('met uitleg wat een werkstuk is',
    /één idee dat langs zes stations reist/.test(leeg.leegTekst), true);
  check('en de vraag blijft staan',
    /Welk werk ligt stil/.test(leeg.alles), true);

  const stuk_ = await teken({ error: { message: 'relation "public.hq_werkbank" does not exist' } });
  check('een ontbrekende view noemt de migratie',
    /0019_brein\.sql/.test(stuk_.leegTekst), true);

  const uit_ = await teken({ data: [] }, false);
  check('niet ingelogd zegt waarom er niets staat',
    uit_.leegKoppen[0], 'Log in om de werkbank te zien.');

  console.log('\n  geen knop die iets uitvoert');
  const knoppen = await page.evaluate(() =>
    [...document.querySelectorAll('#wbk-mount button, #wbk-mount input')].length);
  check('nul knoppen of velden', knoppen, 0);

  console.log('\n  regel 4.5 — kleuren uit het tokenblok');
  const css = fs.readFileSync(path.join(APP, 'css', '14-werkbank.css'), 'utf8');
  check('geen losse hex in het component', (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []), []);

  console.log('\n  regel 4.1 — contrast, gemeten');
  await teken({ data: RIJEN });
  const contrast = await page.evaluate(() => {
    const lum = c => {
      const [r,g,b] = c.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
      return 0.2126*r + 0.7152*g + 0.0722*b;
    };
    const meet = (sel, bgSel) => {
      const el = document.querySelector(sel), bg = document.querySelector(bgSel);
      if (!el || !bg) return null;
      const a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(bg).backgroundColor);
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    return {
      stapAgent: meet('.wbk-stap-agent', '.wbk-stuk'),
      waarom:    meet('.wbk-wacht-tekst', '.wbk-stuk'),
      teller:    meet('.wbk-teller', '.wbk-stuk'),
      blokTekst: meet('.wbk-blok-tekst', '.wbk-blok'),
      blokKop:   meet('.wbk-blok-kop', '.wbk-blok'),
      bolNu:     meet('.wbk-bol--nu', '.wbk-bol--nu'),
      bolKlaar:  meet('.wbk-bol--klaar', '.wbk-bol--klaar'),
    };
  });
  Object.keys(contrast).forEach(k => {
    const v = contrast[k], goed = v !== null && v >= 4.5;
    if (!goed) fout++;
    console.log(`  ${goed ? 'ok  ' : 'FOUT'} ${k}: ${v}:1${goed ? '' : '  — onder 4,5:1'}`);
  });

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
