/* Testlus voor het statusvocabulaire in de klassieke bewerkbare tabel.
 *
 * De statussen stonden op drie plekken: in creative_statussen, als array in
 * 03-defaults-state-opslag.js, en als <option>-rij in index.html. Drie lijsten
 * die uit elkaar lopen zodra er een status bijkomt — en sinds 0030 weigert de
 * database een status die hij niet kent, dus dan faalt het opslaan zonder dat
 * iemand begrijpt waarom.
 *
 * Wat hier bewezen moet worden:
 *
 *   - de lijst komt uit de database en nergens anders
 *   - een verouderde status blijft zichtbaar, maar is niet opnieuw te kiezen
 *   - een bestaande 'To Test'-rij gaat gewoon open
 *   - hij is pas op te slaan nadat een mens een geldige status koos
 *   - lukt het laden niet, dan staat het veld op slot in plaats van dat het
 *     terugvalt op een lijstje in de code
 *
 *   node ad-generator/test/statusvocabulaire.cjs
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

/* De tien statussen zoals ze in 0030 staan, in volgorde. Ze staan hier als
   ANTWOORD van de nep-database, niet als lijst waar de console uit put — dat
   is precies het verschil dat deze lus meet. */
const STATUSSEN = [
  { status: 'Concept', volgorde: 10, fase: 'maken', verantwoordelijke: 'de maker',
    volgende_stap: 'indienen voor review, of laten liggen' },
  { status: 'Klaar voor review', volgorde: 20, fase: 'beoordelen', verantwoordelijke: 'de Criticus',
    volgende_stap: 'een oordeel: door of niet door, met de reden' },
  { status: 'Goedgekeurd voor test', volgorde: 30, fase: 'beoordelen', verantwoordelijke: 'Bolt',
    volgende_stap: 'beeld uploaden en de ad-creative aanmaken' },
  { status: 'Klaar voor publicatie', volgorde: 40, fase: 'draaien', verantwoordelijke: 'jij',
    volgende_stap: 'live zetten' },
  { status: 'Live', volgorde: 50, fase: 'draaien', verantwoordelijke: 'Atlas',
    volgende_stap: 'meten tot de drempel gehaald is, dan oordelen' },
  { status: 'Winner', volgorde: 60, fase: 'oordeel', verantwoordelijke: 'jij',
    volgende_stap: 'opschalen' },
  { status: 'Middelmatig', volgorde: 61, fase: 'oordeel', verantwoordelijke: 'jij',
    volgende_stap: 'laten lopen of vervangen' },
  { status: 'Verliezer', volgorde: 62, fase: 'oordeel', verantwoordelijke: 'jij',
    volgende_stap: 'uitzetten' },
  { status: 'Itereren', volgorde: 63, fase: 'oordeel', verantwoordelijke: 'de maker',
    volgende_stap: 'een variant maken' },
  { status: 'Gestopt', volgorde: 90, fase: 'oordeel', verantwoordelijke: 'niemand',
    volgende_stap: 'niets — dit is een eindpunt' },
];

/* Twee rijen zoals ze na 0030 op productie staan: één op het oude woord, één
   op een geldige status. */
const RIJEN = [
  { id: 2, brand: 'wellshave', ad_name: 'WS.Oud', product: 'Groom Guard', persona: 'Mark',
    status: 'To Test', angle_type: 'safety', format: 'Static 4:5', roas: null },
  { id: 3, brand: 'wellshave', ad_name: 'WS.Nieuw', product: 'Groom Guard', persona: 'Mark',
    status: 'Live', angle_type: 'humor', format: 'Static 1:1', roas: 2.1 },
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const opzetten = async (statussen, rijen) =>
    await page.evaluate(async ({ statussen, rijen }) => {
      const maakSb = () => ({ from: function (tabel) {
        const q = {};
        ['select', 'eq', 'ilike', 'or', 'in', 'order', 'range', 'limit'].forEach(m => { q[m] = () => q; });
        const antwoord = (tabel === 'hq_creative_statussen')
          ? (statussen ? { data: statussen } : { error: { message: 'relation does not exist' } })
          : { data: rijen, count: (rijen || []).length };
        q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
        return q;
      }});
      window.maakSb = maakSb;
      window._sb = maakSb();
      window._authProfile = { id: 'test' };
      window._userRole = 'admin';
      /* Eerst het tabblad, dán de nep-sessie: het openen van een tab loopt via
         hydrate(), en die zet _authProfile terug op null als er geen echte
         sessie is. Andersom laadt de tabel dus leeg. */
      switchMainTab('creatives');
      strWissel('tabel');
      await new Promise(r => setTimeout(r, 200));
      window._sb = maakSb(); window._authProfile = { id: 'test' }; window._userRole = 'admin';
      _csStatussen = null;
      _cs.rows = null; _cs.editing = null;
      /* De pagina hydrateert zichzelf opnieuw bij elke focus, en zet daarbij
         _authProfile terug op null. Deze helper zet de nep-sessie terug zodat
         elke controle hieronder van dezelfde stand vertrekt. */
      window.herstel = async function () {
        window._sb = maakSb(); window._authProfile = { id: 'test' }; window._userRole = 'admin';
        /* De rijen rechtstreeks zetten in plaats van csFetch af te wachten:
           deze lus gaat over het statusveld, niet over het ophalen. Dat het
           ophalen werkt, bewijst de eerste controle hierboven. */
        _cs.rows = JSON.parse(JSON.stringify(rijen || []));
        _cs.total = (rijen || []).length;
        if (_csStatussen === null) await new Promise(function (k) { csStatussenLaden(k); });
        csVulStatusFilter();
        csRenderTable();
      };
      await window.herstel();
      return null;
    }, { statussen, rijen });

  await opzetten(STATUSSEN, RIJEN);

  console.log('\n  de lijst komt uit de database');
  const filter = await page.evaluate(() =>
    [...document.querySelectorAll('#cs-f-status option')].map(o => o.textContent.trim()));
  check('het filtermenu is gevuld met de tien statussen',
    filter.slice(0, 11), ['Alle statussen', 'Concept', 'Klaar voor review', 'Goedgekeurd voor test',
      'Klaar voor publicatie', 'Live', 'Winner', 'Middelmatig', 'Verliezer', 'Itereren', 'Gestopt']);
  // Een verouderde waarde die nog op een rij staat hoort filterbaar te zijn:
  // anders kun je niet vinden wat er nog opgeruimd moet worden.
  check('en met de verouderde waarde die nog in de tabel staat',
    filter[11], 'To Test (verouderd)');

  const badges = await page.evaluate(() =>
    [...document.querySelectorAll('#cs-table-wrap .cs-badge')].map(b => ({
      tekst: b.textContent.replace(/\s+/g, ' ').trim(),
      verouderd: b.classList.contains('cs-b-verouderd')
    })));
  check('een verouderde status staat als verouderd in de tabel',
    badges.filter(b => b.verouderd).map(b => b.tekst), ['To Test verouderd']);
  check('en een geldige status niet',
    badges.filter(b => !b.verouderd).map(b => b.tekst), ['Live']);

  console.log('\n  een bestaande To Test-rij openen');
  const oud = await page.evaluate(async () => {
    await window.herstel();
    csOpenDetail(2);
    await new Promise(r => setTimeout(r, 250));
    const sel = document.getElementById('csd-status');
    return {
      open: !!document.getElementById('cs-detail') &&
            document.getElementById('cs-detail').style.display !== 'none',
      waarde: sel ? sel.value : null,
      opties: sel ? [...sel.options].map(o => ({ t: o.textContent.trim(), uit: o.disabled })) : null,
      letop: (document.querySelector('.cs-status-let-op') || {}).textContent,
    };
  });
  check('de rij gaat open zonder fout', oud.open, true);
  check('de huidige status staat er nog', oud.waarde, 'To Test');
  // Zichtbaar maar niet te kiezen: hij mag blijven staan op een bestaande rij,
  // en tegelijk mag niemand hem opnieuw kiezen.
  check('de verouderde waarde staat er als eerste optie',
    oud.opties[0].t, 'To Test — verouderd, kies hieronder een nieuwe');
  check('en is niet te kiezen', oud.opties[0].uit, true);
  check('de tien geldige statussen staan er wel',
    oud.opties.filter(o => !o.uit).length, 10);
  check('en elke optie zegt wat de volgende stap is',
    /Concept — indienen voor review/.test(oud.opties[1].t), true);
  check('er staat bij waarom dit een keuze vraagt',
    /blijft staan tot jij er bewust een nieuwe kiest/.test(oud.letop || ''), true);
  check('en dat de code dat niet voor je doet',
    /kan meer dan één ding betekenen/.test(oud.letop || ''), true);

  console.log('\n  opslaan');
  const geblokkeerd = await page.evaluate(async () => {
    let melding = null, gestuurd = null;
    const echt = window.toast;
    window.toast = function (t) { melding = t; };
    /* Een nep-database die wél kan schrijven: anders bewijst "er ging niets
       weg" alleen dat de test geen update kent. */
    window._sb.from = function () {
      const q = {};
      ['select', 'eq', 'limit'].forEach(m => { q[m] = () => q; });
      q.update = function (v) { gestuurd = v; return q; };
      q.insert = function (v) { gestuurd = v; return q; };
      q.then = (res) => Promise.resolve({ data: [{}], error: null }).then(res);
      return q;
    };
    csSaveDetail();
    await new Promise(r => setTimeout(r, 250));
    window.toast = echt;
    return { melding: melding, gestuurd: gestuurd };
  });
  // De database zou dit weigeren met "violates foreign key constraint" — juist,
  // en voor niemand leesbaar. Daarom hier tegengehouden met een zin.
  check('opslaan met een verouderde status wordt tegengehouden',
    /Kies eerst een geldige status/.test(geblokkeerd.melding || ''), true);
  check('en er gaat niets naar de database', geblokkeerd.gestuurd, null);

  const gekozen = await page.evaluate(async () => {
    const sel = document.getElementById('csd-status');
    sel.value = 'Klaar voor review';
    let gestuurd = null, melding = null;
    const echt = window.toast;
    window.toast = function (t) { melding = t; };
    window._sb.from = function () {
      const q = {};
      ['select', 'eq', 'limit'].forEach(m => { q[m] = () => q; });
      q.update = function (v) { gestuurd = v; return q; };
      q.insert = function (v) { gestuurd = v; return q; };
      q.then = (res) => Promise.resolve({ data: [{}], error: null }).then(res);
      return q;
    };
    csSaveDetail();
    await new Promise(r => setTimeout(r, 250));
    window.toast = echt;
    return { status: gestuurd ? gestuurd.status : null, melding: melding };
  });
  check('na een bewuste keuze gaat hij wel weg', gekozen.status, 'Klaar voor review');
  check('en niet stiekem als iets anders',
    ['To Test', 'Concept', null].indexOf(gekozen.status), -1);

  console.log('\n  een nieuwe rij');
  const nieuw = await page.evaluate(async () => {
    window._sb = maakSb(); window._authProfile = { id: 'test' }; window._userRole = 'admin';
    csNewRow();
    await new Promise(r => setTimeout(r, 250));
    const sel = document.getElementById('csd-status');
    return { waarde: sel ? sel.value : null,
             opties: sel ? [...sel.options].filter(o => !o.disabled).length : null };
  });
  // De beginwaarde komt uit de volgorde in de database: wat je maakt is een
  // concept tot je het indient. Niet uit een woord hier.
  check('een nieuwe rij begint op de eerste status uit de levensloop', nieuw.waarde, 'Concept');
  check('en kan alleen uit de tien kiezen', nieuw.opties, 10);

  console.log('\n  als de lijst niet geladen kan worden');
  await opzetten(null, RIJEN);
  const stuk = await page.evaluate(async () => {
    await window.herstel();
    csOpenDetail(2);
    await new Promise(r => setTimeout(r, 250));
    return {
      select: !!document.getElementById('csd-status'),
      opSlot: !!document.querySelector('#cs-detail input[disabled]'),
      uitleg: (document.querySelector('.cs-status-let-op') || {}).textContent,
    };
  });
  // Terugvallen op een lijstje in de code zou precies de tweede waarheid zijn
  // die we net hebben weggehaald. Liever niets kunnen kiezen.
  check('er is geen keuzemenu meer', stuk.select, false);
  check('het veld staat op slot', stuk.opSlot, true);
  check('met de reden erbij',
    /De statuslijst kon niet uit de database geladen worden/.test(stuk.uitleg || ''), true);
  check('en de rest van de rij blijft opslaanbaar',
    /De rest van deze rij kun je gewoon opslaan/.test(stuk.uitleg || ''), true);

  console.log('\n  nergens nog een tweede lijst');
  // Dit is de controle die de andere negen overbodig maakt als hij faalt: staat
  // er ergens nog een lijst met de oude woorden, dan komt hij vroeg of laat
  // weer in een insert terecht.
  const bestanden = fs.readdirSync(path.join(APP, 'js')).filter(f => f.endsWith('.js'));
  const oude = /'(To Test|Not yet|Killed|Iterate)'|>(To Test|Not yet|Killed|Iterate)</;
  const vuil = [];
  bestanden.forEach(f => {
    // 01-fable-en-changelog.js is het changelog: dat beschrijft wat de app in
    // een oudere versie deed en is geen lijst waar iets uit gekozen wordt.
    if (f === '01-fable-en-changelog.js') return;
    /* Commentaar telt niet mee, maar wel per regel: een oud woord in een
       toelichting is uitleg, in code is het een tweede lijst. Blokcommentaar
       wordt eerst weggehaald zodat een vervolgregel niet meetelt. */
    const t = fs.readFileSync(path.join(APP, 'js', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    t.split('\n').forEach((r, i) => {
      const code = r.replace(/\/\/.*$/, '');
      if (oude.test(code)) vuil.push(`${f}:${i + 1}`);
    });
  });
  check('geen oude statuswaarde meer in de js', vuil, []);
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  const opties = (html.match(/<option>(To Test|Not yet|Killed|Iterate|Live|Winner)<\/option>/g) || []);
  check('en geen statusopties meer in de html', opties, []);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
