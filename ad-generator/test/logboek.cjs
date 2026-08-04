/* Testlus voor het logboek — wat het team deed, per dag.
 *
 * Het templateantwoord voor een agentlog is een oneindige lijst met
 * tijdstempels. Die leest als actueel, ook wanneer de laatste regel van vorige
 * week is — en dat is precies de fout die dit scherm moet voorkomen.
 *
 * Wat hier bewezen moet worden:
 *   - hoe oud het logboek is staat BOVENAAN en in woorden, niet onderaan als
 *     tijdstempel
 *   - een bericht dat nooit is opgehaald wordt als bevinding gemeld, niet als
 *     regeltje in de stroom
 *   - elke soort regel zegt met een woord wat hij is (regel 4.4: geen
 *     betekenis die alleen in kleur of pictogram zit)
 *   - er is nooit een leeg vlak waar een reden hoort (regel 0.4)
 *
 *   node ad-generator/test/logboek.cjs
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

/* De data is opgebouwd rondom de echte stand: de ochtendcyclus draait, maar de
   laatste regel in de database is van dagen geleden. Dat gat is het geval dat
   dit scherm moet vangen, dus staat het in de fixture. */
const nu = new Date();
const dagenTerug = (n, uur = 5) => {
  const d = new Date(nu); d.setDate(d.getDate() - n); d.setHours(uur, 20, 0, 0); return d.toISOString();
};
const dagVan = (t) => String(t).slice(0, 10);

const OUD = dagenTerug(8);
const OUDER = dagenTerug(9);

const STROOM = [
  { wanneer: OUD, soort: 'bericht', wie: 'atlas', toon: 'warn',
    wat: 'atlas → nova: ROOD: GroomGuard-testcampagne loopt uit de hand  (nog niet opgepakt)',
    werkstuk_id: null, bron: 'agent_messages', bron_id: 1,
    details: { aan: 'nova', body: 'Campagne 001 schaalde in 2 dagen van €45,77 naar €106,15 @ 0,56 ROAS.', gelezen: null } },
  { wanneer: OUD, soort: 'rapport', wie: 'atlas', toon: 'info',
    wat: 'Dagrapport 27 juli', werkstuk_id: null, bron: 'reports', bron_id: 2, details: {} },
  { wanneer: OUD, soort: 'run', wie: 'atlas', toon: 'info',
    wat: 'daily_report afgerond', werkstuk_id: null, bron: 'agent_runs', bron_id: 3,
    details: { model: 'claude-opus-5', kosten_usd: '0.0412' } },
  { wanneer: OUDER, soort: 'poort', wie: 'nova', toon: 'warn',
    wat: 'budget_change wacht op een mens', werkstuk_id: null, bron: 'approvals', bron_id: 4, details: {} },
  { wanneer: OUDER, soort: 'bericht', wie: 'radar', toon: 'info',
    wat: 'radar → nova: Testimonial-static schaalt het hardst', werkstuk_id: null,
    bron: 'agent_messages', bron_id: 5,
    details: { aan: 'nova', body: 'BALZY echte-klant-hook schaalt meerdere dagen op rij.', gelezen: OUDER } },
  { wanneer: OUDER, soort: 'overdracht', wie: 'Dustin Gibson', toon: 'info',
    wat: 'creatie → live', werkstuk_id: 11, bron: 'werkstuk_overdrachten', bron_id: 6,
    details: { controleren: 'Dat creative 11 een beeld heeft voordat er iets live gaat' } },
];

const DAGEN = [
  { dag: dagVan(OUD), gebeurtenissen: 3, agents_actief: 1, wie: 'atlas', rapporten: 1,
    berichten: 1, poorten: 0, fouten: 0, waarschuwingen: 1, kosten_usd: '0.0412',
    eerste: OUD, laatste: OUD },
  { dag: dagVan(OUDER), gebeurtenissen: 3, agents_actief: 2, wie: 'nova, radar', rapporten: 0,
    berichten: 1, poorten: 1, fouten: 0, waarschuwingen: 1, kosten_usd: '0',
    eerste: OUDER, laatste: OUDER },
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  /* De nep-Supabase geeft per tabel een ander antwoord terug; het logboek haalt
     er twee op. Zonder dat onderscheid test je één query twee keer. */
  const teken = async (stroom, dagen, ingelogd = true, fout = null) =>
    await page.evaluate(async ({ stroom, dagen, ingelogd, fout }) => {
      window._sb = ingelogd ? { from: function (tabel) {
        const q = {};
        ['select', 'eq', 'ilike', 'in', 'order', 'limit'].forEach(m => { q[m] = () => q; });
        const antwoord = fout ? { error: { message: fout } }
          : { data: tabel === 'hq_brein_dag' ? dagen : stroom };
        q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
        return q;
      }} : null;
      window._authProfile = ingelogd ? { id: 'test' } : null;
      window._userRole = 'admin';
      switchMainTab('logboek');
      _log.geladen = false; _log.stroom = null; _log.dagen = null; _log.fout = null;
      _log.open = {}; _log.filter = null;
      renderLogboek();
      await new Promise(r => setTimeout(r, 300));
      const m = document.getElementById('lgb-mount');
      return {
        vraag: (m.querySelector('.lgb-vraag') || {}).textContent,
        versKop: (m.querySelector('.lgb-vers-kop') || {}).textContent,
        versTekst: (m.querySelector('.lgb-vers-tekst') || {}).textContent,
        // De eerste vers-blok is de verstheid zelf; een tweede zou de
        // ongelezen post zijn, en die heeft dezelfde opvallende opmaak.
        versStil: !!(m.querySelector('.lgb-vers')
                     && m.querySelector('.lgb-vers').classList.contains('lgb-vers--stil')),
        versKoppen: [...m.querySelectorAll('.lgb-vers-kop')].map(e => e.textContent.trim()),
        dagKoppen: [...m.querySelectorAll('.lgb-dag-datum')].map(e => e.textContent.trim()),
        dagTellingen: [...m.querySelectorAll('.lgb-dag-telling')].map(e => e.textContent.trim()),
        filters: [...m.querySelectorAll('.lgb-filter')].map(e => e.textContent.trim()),
        regels: [...m.querySelectorAll('.lgb-regel')].length,
        leegKoppen: [...m.querySelectorAll('.lgb-leeg-kop')].map(e => e.textContent.trim()),
        leegTekst: [...m.querySelectorAll('.lgb-leeg p')].map(e => e.textContent.trim()).join(' '),
        alles: m.textContent.replace(/\s+/g, ' ').trim(),
        titel: document.getElementById('ws-page-title').textContent,
        zichtbaar: getComputedStyle(document.getElementById('main-tab-logboek')).display,
      };
    }, { stroom, dagen, ingelogd, fout });

  /* Leest de regels BINNEN één dag. Zonder die begrenzing lees je na twee keer
     uitklappen de regels van de vorige dag terug, en dan test je niets. */
  const klapUit = async (i) => await page.evaluate(async (i) => {
    const m = document.getElementById('lgb-mount');
    m.querySelectorAll('.lgb-dag').forEach((d, j) => {
      const open = d.classList.contains('lgb-dag--open');
      if ((j === i) !== open) d.querySelector('.lgb-dag-kop').click();
    });
    await new Promise(r => setTimeout(r, 200));
    const dag = document.getElementById('lgb-mount').querySelectorAll('.lgb-dag')[i];
    const regel = (j) => {
      const r = dag.querySelectorAll('.lgb-regel')[j];
      if (!r) return null;
      return {
        tijd: r.querySelector('.lgb-tijd').textContent.trim(),
        wie: r.querySelector('.lgb-wie').textContent.trim(),
        soort: (r.querySelector('.lgb-soort') || {}).textContent,
        wat: r.querySelector('.lgb-wat').textContent.trim(),
        body: (r.querySelector('.lgb-body') || {}).textContent,
        meta: (r.querySelector('.lgb-meta') || {}).textContent,
        werkstuk: (r.querySelector('.lgb-werkstuk') || {}).textContent,
        klasse: [...r.classList].find(c => c.startsWith('lgb-regel--')),
      };
    };
    return { aantal: dag.querySelectorAll('.lgb-regel').length,
             regels: [0,1,2].map(regel).filter(Boolean) };
  }, i);

  const uit = await teken(STROOM, DAGEN);

  console.log('\n  het tabblad bestaat en heet iets');
  check('het logboek is zichtbaar', uit.zichtbaar, 'block');
  check('en heeft een eigen paginatitel', uit.titel, 'Logboek');
  check('met de beslisvraag bovenaan',
    /Wat deed het team, en wat gaven ze aan elkaar door\?/.test(uit.vraag || ''), true);

  console.log('\n  hoe oud is dit — het eerste wat je moet weten');
  // Acht dagen oude data mag niet als actueel lezen. Dit is de kern van dit
  // scherm: de lijst ziet er gevuld uit, dus zonder deze regel trek je
  // conclusies over een week die niet is vastgelegd.
  check('een logboek dat achterloopt zegt hoeveel dagen', uit.versKop, 'Al 8 dagen niets vastgelegd');
  check('en waarom dat een storing is en geen rustige week',
    /schreef hij zijn werk niet naar de database/.test(uit.versTekst || ''), true);
  check('het valt op zonder dat je ernaar zoekt', uit.versStil, true);

  const vers = await teken(
    STROOM.map(r => ({ ...r, wanneer: new Date().toISOString() })),
    [{ ...DAGEN[0], dag: dagVan(new Date().toISOString()) }]);
  check('en is het wél bij, dan staat dat er ook', vers.versKop, 'Bijgewerkt vandaag');
  check('zonder alarm', vers.versStil, false);

  console.log('\n  post die nooit is opgehaald');
  check('ongelezen berichten worden als bevinding gemeld',
    uit.versKoppen.indexOf('1 bericht nooit opgehaald') > -1, true);
  check('met de reden erbij: de runtime zet de post niet klaar',
    /De runtime zet die post niet klaar/.test(uit.alles), true);
  const gelezen = await teken(
    STROOM.map(r => r.soort === 'bericht' ? { ...r, details: { ...r.details, gelezen: OUD } } : r), DAGEN);
  check('is alles gelezen, dan staat die melding er niet',
    gelezen.versKoppen.filter(k => /nooit opgehaald/.test(k)).length, 0);

  console.log('\n  per dag, met wat eruit kwam');
  check('twee dagen, nieuwste bovenaan', uit.dagKoppen.length, 2);
  check('de dag zegt in woorden wat er gebeurde',
    /1 agent · 1 rapport · 1 bericht/.test(uit.dagTellingen[0] || ''), true);
  check('en een dag met een poort noemt die apart',
    /2 agents · 1 bericht · 1 op goedkeuring/.test(uit.dagTellingen[1] || ''), true);
  check('dichtgeklapt staat er geen enkele regel', uit.regels, 0);

  console.log('\n  uitgeklapt: wie deed wat');
  const dag0 = await klapUit(0);
  check('drie regels op die dag', dag0.aantal, 3);
  check('elke regel zegt met een woord wat het is',
    dag0.regels.map(r => r.soort), ['zei', 'schreef', 'draaide']);
  check('een bericht toont zijn inhoud, niet alleen het onderwerp',
    /Campagne 001 schaalde in 2 dagen/.test(dag0.regels[0].body || ''), true);
  check('een ongelezen bericht valt op', dag0.regels[0].klasse, 'lgb-regel--warn');
  check('een run zegt wat hij kostte', /0.0412/.test(dag0.regels[2].meta || ''), true);
  check('en met welk model', /claude-opus-5/.test(dag0.regels[2].meta || ''), true);
  check('de tijd staat erbij', /^\d{2}:\d{2}$/.test(dag0.regels[0].tijd), true);
  check('en wie het deed', dag0.regels[0].wie, 'atlas');

  const dag1 = await klapUit(1);
  check('een overdracht noemt het werkstuk',
    dag1.regels.map(r => r.werkstuk).filter(Boolean), ['werkstuk 11']);
  check('en wat de volgende moet controleren',
    /Dat creative 11 een beeld heeft/.test(dag1.regels.map(r => r.body || '').join(' ')), true);

  console.log('\n  filteren op soort');
  check('een filterknop per soort die voorkomt', uit.filters.length, 6);
  check('met "alles" vooraan en een telling', uit.filters[0], 'alles (6)');
  const gefilterd = await page.evaluate(async () => {
    lgbFilter('bericht');
    await new Promise(r => setTimeout(r, 150));
    document.querySelectorAll('.lgb-dag').forEach(d => {
      if (!d.classList.contains('lgb-dag--open')) d.querySelector('.lgb-dag-kop').click();
    });
    await new Promise(r => setTimeout(r, 250));
    const m = document.getElementById('lgb-mount');
    return { soorten: [...m.querySelectorAll('.lgb-soort')].map(e => e.textContent.trim()) };
  });
  check('filteren laat alleen die soort zien', [...new Set(gefilterd.soorten)], ['zei']);

  console.log('\n  regel 0.4 — nooit een leeg vlak');
  const leeg = await teken([], []);
  check('een leeg logboek legt uit wat erin hoort te komen',
    leeg.leegKoppen[0], 'Er is nog niets vastgelegd.');
  check('met de vijf bronnen erbij', /vijf bronnen/.test(leeg.leegTekst), true);

  const stuk = await teken(null, null, true, 'relation "public.hq_brein" does not exist');
  check('een ontbrekende view noemt de migratie', /0019_brein\.sql/.test(stuk.leegTekst), true);

  const uitgelogd = await teken(STROOM, DAGEN, false);
  check('niet ingelogd zegt waarom er niets staat',
    uitgelogd.leegKoppen[0], 'Log in om het logboek te zien.');

  console.log('\n  regel 4.5 — kleuren uit het tokenblok');
  const css = fs.readFileSync(path.join(APP, 'css', '16-logboek.css'), 'utf8');
  check('geen losse hex in het component', (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []), []);

  console.log('\n  regel 4.1 — contrast, gemeten');
  await teken(STROOM, DAGEN);
  await page.evaluate(() => document.querySelector('.lgb-dag-kop').click());
  await page.waitForTimeout(200);
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
      versTekst: meet('.lgb-vers-tekst', '.lgb-vers'),
      dagTelling: meet('.lgb-dag-telling', '.lgb-dag'),
      regelSoort: meet('.lgb-soort', '.lgb-dag'),
      regelBody: meet('.lgb-body', '.lgb-regel'),
      tijd: meet('.lgb-tijd', '.lgb-dag'),
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
