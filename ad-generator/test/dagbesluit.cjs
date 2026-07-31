/* Testlus voor het dagbesluit bovenaan de Creative Strategy-tab.
 *
 * Het scherm draagt één beslisvraag: "Welke advertentie zet ik vandaag uit, en
 * welke geef ik meer budget?" Wat hier bewezen moet worden is niet dat er iets
 * op het scherm komt, maar dat er nooit een leeg vlak staat waar een besluit
 * hoort. Dat is regel 0.4 van het ontwerpcontract, en het is precies de regel
 * die je pas mist als de data op is.
 *
 * Vier toestanden, en alle vier moeten iets zeggen:
 *   - besluiten om te nemen
 *   - wel gemeten, geen oordeel        (te weinig volume of te weinig peers)
 *   - niets gemeten                    (dit is vandaag de werkelijkheid)
 *   - de view bestaat niet             (migratie 0018 nog niet toegepast)
 *
 *   node ad-generator/test/dagbesluit.cjs
 *
 * Draait de echte console in Chromium met een nep-Supabase eronder, zodat de
 * werkelijke dbsFetch en dbsRender draaien en niet een kopie ervan.
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

/* Dezelfde reeks als in platform/db/test/dagbesluit.sh, maar dan zoals de view
   hem teruggeeft. De bedragen zijn met opzet niet in ROAS-volgorde: A3 heeft
   een hógere ROAS dan A4 en moet er tóch boven staan, want daar zit het geld. */
const RIJEN = [
  { account_id: 'acc_a', account_naam: 'Wellshave®', merk: 'wellshave', entity_id: 'A3',
    naam: 'WS - 200 - Social Proof v2', ad_naam: 'Meta-naam A3', creative_id: 101, gekoppeld: true,
    spend: 500, roas: 0.4, ctr: 1.0, aankopen: 25, roas_mediaan: 1.2, ctr_mediaan: 1.0,
    eensgezind: true, omzet_min_spend: -300, oordeel: 'stoppen', actie: 'uitzetten', rang: 1,
    waarom: 'onder de mediaan op beide signalen én onder break-even' },
  { account_id: 'acc_a', account_naam: 'Wellshave®', merk: 'wellshave', entity_id: 'A4',
    naam: 'Meta-naam A4', ad_naam: 'Meta-naam A4', creative_id: null, gekoppeld: false,
    spend: 100, roas: 0.2, ctr: 0.5, aankopen: 2, roas_mediaan: 1.2, ctr_mediaan: 1.0,
    eensgezind: true, omzet_min_spend: -80, oordeel: 'stoppen', actie: 'uitzetten', rang: 2,
    waarom: 'onder de mediaan op beide signalen én onder break-even' },
  { account_id: 'acc_a', account_naam: 'Wellshave®', merk: 'wellshave', entity_id: 'A1',
    naam: 'WS - 118 - Problem Solution', ad_naam: 'Meta-naam A1', creative_id: 88, gekoppeld: true,
    spend: 400, roas: 4.0, ctr: 3.0, aankopen: 40, roas_mediaan: 1.2, ctr_mediaan: 1.0,
    eensgezind: true, omzet_min_spend: 1200, oordeel: 'opschalen', actie: 'meer budget', rang: 1,
    waarom: 'beide signalen boven de accountmediaan' },
  { account_id: 'acc_a', account_naam: 'Wellshave®', merk: 'wellshave', entity_id: 'A6',
    naam: 'WS - 141 - Authority', ad_naam: 'Meta-naam A6', creative_id: 90, gekoppeld: true,
    spend: 250, roas: 2.5, ctr: 0.6, aankopen: 25, roas_mediaan: 1.2, ctr_mediaan: 1.0,
    eensgezind: false, omzet_min_spend: 375, oordeel: 'converteert, bereikt te weinig',
    actie: 'meer budget', rang: 2,
    waarom: 'zet bovengemiddeld om maar wordt weinig aangeklikt — meer bereik hierop is waarschijnlijk winst' },
  { account_id: 'acc_a', account_naam: 'Wellshave®', merk: 'wellshave', entity_id: 'A5',
    naam: 'WS - 155 - FOMO', ad_naam: 'Meta-naam A5', creative_id: 91, gekoppeld: true,
    spend: 200, roas: 0.8, ctr: 2.8, aankopen: 20, roas_mediaan: 1.2, ctr_mediaan: 1.0,
    eensgezind: false, omzet_min_spend: -40, oordeel: 'materiaal werkt, bestemming niet',
    actie: 'onderzoeken', rang: 1,
    waarom: 'trekt bovengemiddeld door maar zet niet om — kijk naar de pagina en het aanbod, niet naar het materiaal' },
  { account_id: 'acc_a', account_naam: 'Wellshave®', merk: 'wellshave', entity_id: 'A8',
    naam: 'WS - 210 - nieuw', ad_naam: 'Meta-naam A8', creative_id: 95, gekoppeld: true,
    spend: 20, roas: 2.0, ctr: 2.0, aankopen: 1, roas_mediaan: null, ctr_mediaan: null,
    eensgezind: null, omzet_min_spend: 20, oordeel: null, actie: null, rang: null,
    waarom: 'onder de drempel: minder dan 1.000 vertoningen of 50 euro' },
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
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  /* Zet een nep-Supabase neer, draai de echte dbsFetch, en lees terug wat er
     werkelijk in de DOM staat — niet wat de functie retourneert. */
  const teken = async (antwoord) => await page.evaluate(async (antwoord) => {
    window._sb = { from: function () {
      const q = {};
      ['select', 'eq', 'ilike', 'in', 'order', 'limit'].forEach(m => { q[m] = () => q; });
      q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
      return q;
    }};
    window._authProfile = { id: 'test' };
    if (!document.getElementById('dbs-mount')) {
      const d = document.createElement('div'); d.id = 'dbs-mount'; document.body.appendChild(d);
    }
    _dbs.merk = null; _dbs.rijen = null; _dbs.fout = null;   // cache leeg
    dbsFetch();
    await new Promise(r => setTimeout(r, 250));

    const m = document.getElementById('dbs-mount');
    const kolom = (klasse) => {
      const k = m.querySelector('.dbs-kolom--' + klasse);
      if (!k) return null;
      return {
        titel: k.querySelector('.dbs-kop-titel').textContent.trim(),
        aantal: k.querySelector('.dbs-kop-aantal').textContent.trim(),
        namen:   [...k.querySelectorAll('.dbs-naam')].map(e => e.firstChild.textContent.trim()),
        ids:     [...k.querySelectorAll('.dbs-id-nr')].map(e => e.textContent.trim()),
        rangen:  [...k.querySelectorAll('.dbs-rang')].map(e => e.textContent.trim()),
        bedragen:[...k.querySelectorAll('.dbs-bedrag-getal')].map(e => e.textContent.trim()),
        labels:  [...k.querySelectorAll('.dbs-bedrag-label')].map(e => e.textContent.trim()),
        chips:   [...k.querySelectorAll('.dbs-chip')].map(e => e.textContent.trim()),
        redenen: [...k.querySelectorAll('.dbs-waarom')].map(e => e.textContent.trim()),
      };
    };
    return {
      vraag: (m.querySelector('.dbs-vraag') || {}).textContent,
      uit: kolom('uitzetten'),
      meer: kolom('meer'),
      inklap: [...m.querySelectorAll('.dbs-rest details')].map(d => ({
        kop: d.querySelector('summary').textContent.trim(),
        open: d.open,
        items: [...d.querySelectorAll('.dbs-rest-lijst li')].length,
      })),
      leegKop: (m.querySelector('.dbs-leeg-kop') || {}).textContent,
      leegTekst: [...m.querySelectorAll('.dbs-leeg p')].map(e => e.textContent.trim()).join(' '),
      tekstTotaal: m.textContent.replace(/\s+/g, ' ').trim(),
    };
  }, antwoord);

  /* ── 1. de beslisvraag staat er, letterlijk ──────────────────────────── */
  console.log('\n  regel 0.1 — de beslisvraag staat op het scherm');
  const vol = await teken({ data: RIJEN });
  check('de vraag staat er voluit',
    vol.vraag, 'Welke advertentie zet ik vandaag uit, en welke geef ik meer budget?');

  /* ── 2. welke zet ik uit ─────────────────────────────────────────────── */
  console.log('\n  "welke zet ik vandaag uit?"');
  check('twee advertenties',            vol.uit.aantal, '2');
  check('grootste verlies bovenaan',    vol.uit.namen, ['WS - 200 - Social Proof v2', 'Meta-naam A4']);
  check('genummerd, want het is een volgorde', vol.uit.rangen, ['1', '2']);
  check('met het Meta-id erbij (regel 0.3)',   vol.uit.ids, ['A3', 'A4']);
  // Het id moet plakbaar zijn in Meta, dus het staat apart van de chips ernaast.
  check('en het id is los te selecteren van de chips',
    await page.evaluate(() => getComputedStyle(document.querySelector('.dbs-id-nr')).userSelect), 'all');
  check('het bedrag is de kop',         vol.uit.bedragen, ['− € 300', '− € 80']);
  check('met een label eronder (regel 6b.3)',
    vol.uit.labels, ['kostte meer dan het opbracht', 'kostte meer dan het opbracht']);
  check('en de reden erbij',
    vol.uit.redenen[0], 'onder de mediaan op beide signalen én onder break-even');

  /* ── 3. welke geef ik meer budget ────────────────────────────────────── */
  console.log('\n  "en welke geef ik meer budget?"');
  check('twee advertenties, grootste opbrengst eerst',
    vol.meer.namen, ['WS - 118 - Problem Solution', 'WS - 141 - Authority']);
  check('het teken staat in de tekst, niet alleen in de kleur (regel 6b.4)',
    vol.meer.bedragen, ['+ € 1.200', '+ € 375']);
  check('zekerheid staat er als woord (regel 4.4)',
    vol.meer.chips, ['twee signalen', 'één signaal']);
  check('een advertentie zonder tracker-rij zegt dat ook',
    vol.uit.chips.indexOf('niet in de tracker') > -1, true);

  /* ── 4. de rest staat ingeklapt onder de conclusie ───────────────────── */
  console.log('\n  regel 6.3 — het oordeel eerst, de nuance eronder');
  check('twee ingeklapte groepen',
    vol.inklap.map(d => d.kop.split('(')[0].trim()), ['Onderzoeken', 'Nog geen oordeel']);
  check('en ze staan dicht',  vol.inklap.map(d => d.open), [false, false]);
  check('met hun rijen erin', vol.inklap.map(d => d.items), [1, 1]);

  /* ── 5. de regel die je pas mist als de data op is ───────────────────── */
  console.log('\n  regel 0.4 — nooit een leeg vlak, altijd de reden');

  const geenUit = await teken({ data: RIJEN.filter(r => r.actie !== 'uitzetten') });
  check('een lege kolom blijft staan',        geenUit.uit.aantal, '0');
  check('en zegt waarom hij leeg is',
    /onder de accountmediaan én onder break-even/.test(geenUit.uit.redenen.join(' ')), true);

  const niets = await teken({ data: [] });
  check('nul rijen geeft geen leeg scherm',
    niets.leegKop, 'Er is nog niets gemeten in dit account.');
  check('met wat er moet gebeuren voordat er wel iets staat',
    /Atlas haalt elke ochtend de cijfers bij Meta op/.test(niets.leegTekst), true);
  check('en de vraag blijft er ook dan staan',
    /Welke advertentie zet ik vandaag uit/.test(niets.tekstTotaal), true);

  const geenOordeel = await teken({ data: RIJEN.filter(r => !r.actie) });
  check('wel gemeten maar geen oordeel is een eigen toestand',
    geenOordeel.leegKop, '1 advertentie gemeten, geen enkele met een oordeel.');
  check('met de drempel erbij, zodat het geen storing lijkt',
    /duizend vertoningen, vijftig euro en drie soortgenoten/.test(geenOordeel.leegTekst), true);
  check('en per reden hoe vaak hij voorkwam',
    /1× onder de drempel/.test(geenOordeel.leegTekst), true);

  const stuk = await teken({ error: { message: 'relation "public.hq_dagbesluit" does not exist' } });
  check('een ontbrekende view is ook een uitkomst',
    stuk.leegKop, 'Het dagbesluit kon niet worden geladen.');
  check('met de migratie die eronder hoort',
    /0018_dagbesluit\.sql/.test(stuk.leegTekst), true);

  /* ── 6. het scherm grijpt nergens in ─────────────────────────────────── */
  console.log('\n  geen knop die geld uitgeeft');
  const knoppen = await page.evaluate(() =>
    [...document.querySelectorAll('#dbs-mount button, #dbs-mount a[href], #dbs-mount input')].length);
  check('nul knoppen, links of velden in het paneel', knoppen, 0);
  check('en het staat er ook zwart op wit',
    /Uitvoeren doe je in Meta/.test(vol.tekstTotaal), true);

  /* ── 7. contrast, gemeten en niet aangenomen ─────────────────────────── */
  console.log('\n  regel 4.1 — elke tekst haalt 4,5:1');
  await teken({ data: RIJEN });
  const contrasten = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    // De achtergrond van het paneel is wit; die van de kop van de uitzet-kolom
    // is amber-wash. Beide worden echt uit de opmaak gelezen.
    const meet = (sel, achterSel) => {
      const el = document.querySelector(sel);
      const bg = document.querySelector(achterSel);
      if (!el || !bg) return null;
      const a = lum(getComputedStyle(el).color);
      const b = lum(getComputedStyle(bg).backgroundColor);
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    return {
      waarom: meet('.dbs-waarom', '.dbs-kolom'),
      label:  meet('.dbs-bedrag-label', '.dbs-kolom'),
      rang:   meet('.dbs-rang', '.dbs-kolom'),
      kopOpAmber: meet('.dbs-kolom--uitzetten .dbs-kop-titel', '.dbs-kolom--uitzetten .dbs-kop'),
    };
  });
  Object.keys(contrasten).forEach(k => {
    const v = contrasten[k];
    const goed = v !== null && v >= 4.5;
    if (!goed) fout++;
    console.log(`  ${goed ? 'ok  ' : 'FOUT'} ${k}: ${v}:1${goed ? '' : '  — onder 4,5:1'}`);
  });

  /* ── 8. geen rauwe hex buiten het tokenblok (regel 4.5) ──────────────── */
  console.log('\n  regel 4.5 — kleuren komen uit het tokenblok');
  const css = fs.readFileSync(path.join(APP, 'css', '13-dagbesluit.css'), 'utf8');
  const hexen = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []);
  check('geen enkele losse hex in het component', hexen, []);

  console.log('');
  console.log(fout === 0 ? `  Alle controles geslaagd` : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
