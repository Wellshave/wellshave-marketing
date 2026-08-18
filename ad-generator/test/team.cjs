/* Testlus voor de teampagina.
 *
 * Het templateantwoord op "toon het team" is een nette lijst met kaartjes waar
 * bij iedereen iets staat. Dat is precies wat hier niet mag, om twee redenen:
 *
 *   1. Wat een profiel over zichzelf zegt is een tekst, geen meting. De agents
 *      die dat probleem hadden zijn weg; de twee specialisten die er nu staan
 *      hebben het in een andere vorm. Daarom noemt elk profiel de velden die
 *      het werkelijk stuurt, met het pad zoals de wizard ze kent, en zoekt de
 *      test die paden op in het datamodel. Verdwijnt er een, dan valt deze lus
 *      om in plaats van dat de pagina iets blijft beweren.
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

/* Drie rijen die drie gevallen zijn: ikzelf zonder introductie, een collega
   mét, en een collega zonder. Agentrijen staan er niet meer in: die tabel kent
   ze sinds migratie 0051 niet. Wat er wel bij kwam zijn de twee specialisten,
   en die komen niet uit de database -- ze zijn de werkwijze zelf, en dat is
   precies waarom ze apart getest worden. */
const RIJEN = [
  { soort: 'mens', id: 'test', naam: 'Dustin Gibson', rol: 'Beheerder',
    voorstellen: null, rol_titel: null },
  { soort: 'mens', id: 'w1', naam: 'Willem de Groot', rol: 'Merkstrateeg',
    voorstellen: 'Ik doe de merkkant en kijk mee op alles wat naar buiten gaat.',
    rol_titel: 'Merkstrateeg' },
  { soort: 'mens', id: 'w2', naam: 'Nieuwe Collega', rol: 'Teamlid',
    voorstellen: null, rol_titel: null }
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
  check('de mensen en de twee specialisten staan apart gegroepeerd',
    uit.koppen, ['De twee die het vak bepalen', 'De mensen']);
  check('drie mensen plus twee specialisten', uit.kaarten.length, 5);

  console.log('\n  wie bepaalt hier hoe een ad eruitziet');
  const rory = uit.kaarten.find(k => k.naam === 'Rory Sutherland');
  const nick = uit.kaarten.find(k => k.naam === 'Nick Theriot');
  check('Rory staat op de pagina', !!rory, true);
  check('en Nick ook', !!nick, true);
  /* Ze zien er niet uit als een collega met een account: dat was precies de
     fout van de oude agentkaarten. */
  check('ze zijn geen mens-kaart', [rory.soort, nick.soort],
    ['team-avatar--spec', 'team-avatar--spec']);
  check('en de sectie zegt dat ze niets uit zichzelf doen',
    /doen niets uit zichzelf/.test(uit.alles), true);
  check('met de volgorde erbij: eerst bedenken, dan filteren',
    /filter draaien voordat er iets bedacht is/.test(uit.alles), true);

  console.log('\n  wat ze doen, en waar het ophoudt');
  const open = await page.evaluate(async () => {
    specToggle('rory');
    await new Promise(r => setTimeout(r, 120));
    const kaart = [...document.querySelectorAll('.team-kaart--spec')]
      .find(k => k.querySelector('.team-naam').textContent.trim() === 'Rory Sutherland');
    const uit = {
      koppen: [...kaart.querySelectorAll('.spec-h')].map(e => e.textContent),
      grenzen: kaart.querySelectorAll('.spec-grens li').length,
      velden: [...kaart.querySelectorAll('.spec-velden')].map(e => e.textContent),
      ander: (kaart.querySelector('.spec-ander') || {}).textContent || '',
      anderOpen: document.querySelectorAll('.team-kaart--open').length
    };
    /* Nick erbij openen: er hoort er maar een tegelijk open te staan. */
    specToggle('nick');
    await new Promise(r => setTimeout(r, 120));
    uit.naTweede = [...document.querySelectorAll('.team-kaart--open')]
      .map(k => k.querySelector('.team-naam').textContent.trim());
    return uit;
  });
  check('een profiel toont werkwijze, plek in het systeem en grenzen',
    open.koppen, ['Hoe hij werkt', 'Waar hij in dit systeem aan zit', 'Guardrails']);
  check('en de guardrails zijn er meer dan een', open.grenzen >= 4, true);
  check('met de verwijzing naar de ander erbij',
    /advertentieaccount/.test(open.ander) && /Nick\./.test(open.ander), true);
  check('er staat er een tegelijk open', open.anderOpen, 1);
  check('en de tweede vervangt de eerste', open.naTweede, ['Nick Theriot']);

  /* De regel die deze pagina eerlijk houdt. Een profiel dat beweert een veld te
     sturen dat niet meer bestaat, is een tekst die ooit waar was -- precies wat
     de oude agentkaarten deden. Dus wordt elk genoemd pad opgezocht in het
     datamodel van de wizard zelf. */
  console.log('\n  wat ze beweren te sturen, bestaat ook');
  const paden = await page.evaluate(() => {
    const blanco = wizBlankData();
    const bestaat = p => {
      const d = p.split('.');
      return !!(blanco[d[0]] && d[1] in blanco[d[0]]);
    };
    const alle = [], onbekend = [];
    TEAM_SPECIALISTEN.forEach(s => (s.stuurt || []).forEach(x => (x.velden || []).forEach(v => {
      alle.push(v);
      if (!bestaat(v)) onbekend.push(v);
    })));
    return { alle, onbekend };
  });
  check('elk genoemd veld bestaat echt in de wizard', paden.onbekend, []);
  check('en het zijn er genoeg om iets te betekenen', paden.alle.length >= 8, true);

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
