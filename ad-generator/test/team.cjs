/* Testlus voor de teampagina.
 *
 * Het templateantwoord op "toon het team" is een nette lijst met kaartjes waar
 * bij iedereen iets staat. Dat is precies wat hier niet mag, om twee redenen:
 *
 *   1. Wat een agent over zichzelf zegt is een tekst, geen meting. Als het
 *      scherm die tekst laat doorgaan voor een status, gelooft het team iets
 *      wat maanden geleden waar was. Daarom staat naast elke agent wat er
 *      werkelijk gebeurd is — aan of uit, hoe vaak gedraaid, wanneer voor het
 *      laatst — en komt dat uit de database en niet uit de alinea.
 *
 *   2. Wie zichzelf nog niet heeft voorgesteld moet een gat laten zien. Een
 *      opgevulde standaardzin ("geen omschrijving beschikbaar") blijft twee
 *      jaar staan; een lege plek met een knop wordt ingevuld.
 *
 * Verder de grens: het formulier schrijft via hq_stel_jezelf_voor en nergens
 * anders, want een rechtstreekse update op team_members zou een policy nodig
 * hebben die per rij werkt en niet per kolom.
 *
 *   node ad-generator/test/team.cjs
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

/* Zes rijen die zes gevallen zijn: ikzelf zonder introductie, een collega mét,
   een collega zonder, een agent die draait, een agent die uitstaat, en een
   agent die nog nooit iets gedaan heeft. */
const RIJEN = [
  { soort: 'mens', id: 'test', naam: 'Dustin Gibson', rol: 'Beheerder',
    voorstellen: null, levert: null, schrijft_in: null, staat_aan: true,
    laatst_actief: null, keer_gedraaid: null, vaste_momenten: null, rol_titel: null },
  { soort: 'mens', id: 'w1', naam: 'Willem de Groot', rol: 'Merkstrateeg',
    voorstellen: 'Ik doe de merkkant en kijk mee op alles wat naar buiten gaat.',
    levert: null, schrijft_in: null, staat_aan: true, laatst_actief: null,
    keer_gedraaid: null, vaste_momenten: null, rol_titel: 'Merkstrateeg' },
  { soort: 'mens', id: 'w2', naam: 'Nieuwe Collega', rol: 'Teamlid',
    voorstellen: null, levert: null, schrijft_in: null, staat_aan: true,
    laatst_actief: null, keer_gedraaid: null, vaste_momenten: null, rol_titel: null },

  { soort: 'agent', id: 'atlas', naam: 'Atlas', rol: 'Data-analyst',
    voorstellen: 'Ik ben Atlas en ik ben de eerste die kijkt.',
    levert: 'dagrapport op accountniveau', schrijft_in: 'reports, creatives',
    staat_aan: true, laatst_actief: new Date(Date.now() - 86400000).toISOString(),
    keer_gedraaid: 25, vaste_momenten: 3, rol_titel: null },
  { soort: 'agent', id: 'echo', naam: 'Echo', rol: 'E-mailmarketeer',
    voorstellen: 'Ik ben Echo en ik doe e-mail. Op dit moment sta ik uit.',
    levert: 'flow-audit en campagneconcepten', schrijft_in: 'email_drafts',
    staat_aan: false, laatst_actief: null, keer_gedraaid: 0, vaste_momenten: 0, rol_titel: null },
  { soort: 'agent', id: 'sage', naam: 'Sage', rol: 'SEO-specialist',
    voorstellen: null, levert: null, schrijft_in: null,
    staat_aan: false, laatst_actief: null, keer_gedraaid: 0, vaste_momenten: 0, rol_titel: null }
];

let fout = 0;
const check = (naam, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (goed) { console.log(`  ok   ${naam}`); return; }
  fout++;
  console.log(`  FOUT ${naam}`);
  console.log(`       verwacht ${JSON.stringify(verwacht)}`);
  console.log(`       kreeg    ${JSON.stringify(echt)}`);
};

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const nep = async (rijen, { ingelogd = true, fout = null } = {}) =>
    await page.evaluate(async ({ rijen, ingelogd, fout }) => {
      window._rpcAanroepen = [];
      window._sb = ingelogd ? {
        from: function () {
          const q = {};
          ['select', 'eq', 'order', 'limit'].forEach(m => { q[m] = () => q; });
          const antwoord = fout ? { error: { message: fout } } : { data: rijen };
          q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
          return q;
        },
        rpc: function (naam, args) {
          window._rpcAanroepen.push({ naam, args });
          return Promise.resolve({ data: { ok: true } });
        }
      } : null;
      window._authProfile = ingelogd ? { id: 'test' } : null;
      window._userRole = 'admin';
      _team.geladen = false; _team.rijen = null; _team.fout = null;
      _team.bewerken = false; _team.bezig = false;
      switchMainTab('team');
      await new Promise(r => setTimeout(r, 300));
      return null;
    }, { rijen, ingelogd, fout });

  const lees = async () => await page.evaluate(() => {
    const m = document.getElementById('team-mount');
    return {
      zichtbaar: getComputedStyle(document.getElementById('main-tab-team')).display,
      knopActief: document.getElementById('main-tab-btn-team').classList.contains('active'),
      koppen: [...m.querySelectorAll('.team-h2')].map(e => e.textContent),
      kaarten: [...m.querySelectorAll('.team-kaart')].map(k => ({
        naam: k.querySelector('.team-naam').textContent.replace(/\s+/g, ' ').trim(),
        soort: [...k.querySelector('.team-avatar').classList].find(c => c.startsWith('team-avatar--')),
        voorstellen: (k.querySelector('.team-voorstellen') || {}).textContent || null,
        leeg: (k.querySelector('.team-leeg') || {}).textContent || null,
        feiten: [...k.querySelectorAll('.team-feit')].map(f => f.textContent),
        ik: k.classList.contains('team-kaart--ik'),
        uit: k.classList.contains('team-kaart--uit')
      })),
      alles: m.textContent.replace(/\s+/g, ' ').trim()
    };
  });

  await nep(RIJEN);
  let uit = await lees();

  console.log('\n  de pagina zit in het menu');
  check('het tabblad opent', uit.zichtbaar, 'block');
  check('en de menuknop staat aan', uit.knopActief, true);
  check('mensen en agents staan apart gegroepeerd', uit.koppen, ['Mensen', 'Agents']);
  check('alle zes staan er', uit.kaarten.length, 6);

  console.log('\n  wat een agent zegt is niet wat hij doet');
  const atlas = uit.kaarten.find(k => k.naam.startsWith('Atlas'));
  check('Atlas stelt zichzelf voor in de eerste persoon',
    /^Ik ben Atlas/.test(atlas.voorstellen || ''), true);
  /* De feiten komen uit de database en niet uit die zin. Zonder deze regel kan
     een tekst uit maart nog steeds zeggen dat hij elke ochtend draait. */
  check('en de feiten ernaast komen uit het systeem', atlas.feiten,
    ['Staat aan', '3 vaste momenten', '25 keer gedraaid', 'Laatst actief gisteren']);

  const echo = uit.kaarten.find(k => k.naam.startsWith('Echo'));
  check('een agent die uitstaat zegt dat ook', echo.feiten[0], 'Staat uit');
  check('en is als zodanig gemerkt', echo.uit, true);
  check('met de historie erbij, want uit en nooit gedraaid is niet hetzelfde',
    echo.feiten.indexOf('Nog niet gedraaid') > -1, true);
  check('de sectie zegt hoeveel er uitstaan', /2 van de 3 staan uit/.test(uit.alles), true);

  console.log('\n  een gat blijft een gat');
  const ik = uit.kaarten.find(k => k.ik);
  check('mijn eigen kaart is gemerkt', ik.naam, 'Dustin Gibson jij');
  check('en nodigt me uit als ik niets heb geschreven',
    /nog niet voorgesteld/.test(ik.leeg || ''), true);
  const collega = uit.kaarten.find(k => k.naam === 'Nieuwe Collega');
  /* Bij een collega hoort geen knop: dat is niet jouw werk. En vooral geen
     verzonnen zin die het gat dichtsmeert. */
  check('bij een collega staat het er zonder knop',
    /Heeft zichzelf nog niet voorgesteld/.test(collega.leeg || ''), true);
  check('en er wordt niets voor hem verzonnen', collega.voorstellen, null);
  const sage = uit.kaarten.find(k => k.naam.startsWith('Sage'));
  check('ook een agent zonder introductie krijgt geen standaardzin', sage.voorstellen, null);

  console.log('\n  jezelf voorstellen');
  const na = await page.evaluate(async () => {
    teamBewerk();
    await new Promise(r => setTimeout(r, 150));
    const form = !!document.getElementById('team-voorstellen');
    document.getElementById('team-voorstellen').value = 'Ik stuur het geheel aan.';
    document.getElementById('team-roltitel').value = 'Oprichter';
    teamBewaar();
    await new Promise(r => setTimeout(r, 200));
    return { form, rpc: window._rpcAanroepen };
  });
  check('het formulier gaat open', na.form, true);
  /* Via de functie en niet via een update op de tabel: dat is de hele grens.
     Een update zou een policy nodig hebben die per rij werkt en niet per
     kolom, en dan mag iedereen ook zijn eigen rechten aanzetten. */
  check('er wordt één ding aangeroepen', na.rpc.length, 1);
  check('en dat is de functie, niet een update op de tabel',
    na.rpc[0].naam, 'hq_stel_jezelf_voor');
  check('met alleen deze twee velden erin',
    Object.keys(na.rpc[0].args.p).sort(), ['rol_titel', 'voorstellen']);
  check('en de tekst die ik typte', na.rpc[0].args.p.voorstellen, 'Ik stuur het geheel aan.');

  console.log('\n  als er iets misgaat');
  await nep(RIJEN, { fout: 'relation "hq_team" does not exist' });
  const stuk = await lees();
  check('de fout staat er in woorden', /does not exist/.test(stuk.alles), true);
  check('met wat eraan te doen is', /0040_teampagina/.test(stuk.alles), true);
  await nep(RIJEN, { ingelogd: false });
  const uitgelogd = await lees();
  check('uitgelogd vraagt om inloggen', /Log in om het team te zien/.test(uitgelogd.alles), true);
  await nep([]);
  const leeg = await lees();
  check('en zonder rijen zegt het scherm waarom dat kan',
    /alleen zichtbaar voor een goedgekeurd teamlid/.test(leeg.alles), true);

  await browser.close();
  srv.close();
  console.log(fout === 0 ? '\nAlle controles geslaagd' : `\n${fout} controle(s) mislukt`);
  process.exit(fout === 0 ? 0 : 1);
})();
