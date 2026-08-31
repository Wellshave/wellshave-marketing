/* Het adminmenu waarin de sleutels gezet worden — de consolekant.
 *
 * De worker bewaakt de toegang; dat staat in platform/worker/test/sleutels.mjs
 * en dat is waar de beveiliging zit. Hier gaat het om wat dit scherm doet met
 * iets dat je er net in geplakt hebt, en dat is een ander soort risico:
 *
 *   1. HET VELD BLIJFT STAAN. Een sleutel die na verzenden in het invoerveld
 *      blijft, komt in de volgende screenshot terecht. Ook -- juist -- als het
 *      misging.
 *
 *   2. HET SCHERM ONTHOUDT HEM. localStorage, een variabele, een dataset op
 *      een element: alle drie zijn ze precies de fout die we net hebben
 *      opgeruimd, alleen op een andere plek.
 *
 *   3. "BEWAARD" TERWIJL HIJ NIET WERKT. Dat is de les van de vorige ronde:
 *      de statusbalk stond groen omdat het veld gevuld was, terwijl de sleutel
 *      al ingetrokken was. Gevuld en geldig zijn twee dingen, en het scherm
 *      moet het verschil zeggen.
 *
 *   node ad-generator/test/sleutelmenu.cjs
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const CHROOM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };

/* Een sleutel die nergens van is: opgebouwd uit een herhaald teken. */
const NEP = 'sk-ant-api03-' + 'A'.repeat(40);

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

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

/* De worker nabootsen in de browser, zodat het scherm echt door zijn eigen
   lus loopt in plaats van dat we de functies los aanroepen. */
function ONDERSCHEP(antwoorden) {
  window.__verzonden = [];
  window.__WG_TOKEN = 'token-van-de-baas';
  const echt = window.fetch;
  window.fetch = async (url, opties) => {
    const u = String(url);
    if (!/\/systeem\/sleutels/.test(u)) return echt(url, opties);
    window.__verzonden.push({
      url: u,
      method: (opties && opties.method) || 'GET',
      auth: (opties && opties.headers && opties.headers['Authorization']) || null,
      body: (opties && opties.body) || null
    });
    const sleutel = /proef/.test(u) ? 'proef' : (((opties && opties.method) || 'GET') + ' ' + '/systeem/sleutels');
    const a = antwoorden[sleutel] || { status: 200, data: {} };
    return { ok: a.status < 400, status: a.status, json: async () => a.data };
  };
}

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof sleutelPaneel === 'function');

  console.log('\n  het paneel toont wat er staat, zonder het te tonen');
  const paneel = await page.evaluate(async (arg) => {
    eval('(' + arg.onderschep + ')(' + JSON.stringify({
      'GET /systeem/sleutels': { status: 200, data: { master: true, sleutels: [
        { naam: 'ANTHROPIC_KEY', bron: 'database', staart: 'WXYZ', gezet_door: 'dustin@wellshave.com', gezet_op: new Date().toISOString() },
        { naam: 'OPENAI_KEY', bron: 'ontbreekt', staart: null, gezet_door: null, gezet_op: null }
      ] } }
    }) + ')');
    const el = document.createElement('div');
    el.id = 'ws-admin-body';
    document.body.appendChild(el);
    await window.sleutelPaneel(el);
    return {
      regels: el.querySelectorAll('.sl-regel').length,
      html: el.innerHTML,
      /* Het invoerveld is een wachtwoordveld: anders staat een geplakte
         sleutel gewoon leesbaar op het scherm terwijl je hem plakt. */
      typen: [].slice.call(el.querySelectorAll('.sl-invoer')).map(i => i.type),
      /* Tegen de bronlijst tellen, niet tegen een getal: een sleutel erbij
         hoort een regel erbij te zijn, en een test met een hard getal moet dan
         opgezocht en aangepast worden terwijl hij niets bewaakt. */
      verwacht: window.SLEUTEL_VELDEN.length,
      namen: window.SLEUTEL_VELDEN.map(v => v.naam),
      auth: (window.__verzonden[0] || {}).auth
    };
  }, { onderschep: ONDERSCHEP.toString() });
  check('elke sleutel die het systeem kent heeft een regel', paneel.regels, paneel.verwacht);
  /* En de drie die er horen te zijn, bij naam. Alleen tellen laat een
     hernoemde of vervangen sleutel ongemerkt door. */
  check('Claude, OpenAI, Atria en TrendTrack', paneel.namen,
    ['ANTHROPIC_KEY', 'OPENAI_KEY', 'ATRIA_API_KEY', 'TRENDTRACK_API_KEY']);
  check('de staart is zichtbaar', /WXYZ/.test(paneel.html), true);
  check('met wie hem zette', /dustin@wellshave\.com/.test(paneel.html), true);
  check('en wanneer, in gewone taal', /vandaag/.test(paneel.html), true);
  check('de ontbrekende sleutel zegt dat hij ontbreekt',
    /er staat geen sleutel/.test(paneel.html), true);
  check('elk invoerveld verbergt wat je typt',
    paneel.typen.filter(t => t !== 'password').length + '/' + paneel.typen.length,
    '0/' + paneel.verwacht);
  check('en de vraag droeg het teamtoken', paneel.auth, 'Bearer token-van-de-baas');

  console.log('\n  zonder hoofdsleutel staat er wat je moet doen');
  /* Anders is het veld eronder een knop die niet werkt, en dan ga je zoeken
     in de worker in plaats van in je terminal. */
  const zonderMaster = await page.evaluate(async (arg) => {
    eval('(' + arg.onderschep + ')(' + JSON.stringify({
      'GET /systeem/sleutels': { status: 200, data: { master: false, sleutels: [
        { naam: 'ANTHROPIC_KEY', bron: 'worker secret', staart: null },
        { naam: 'OPENAI_KEY', bron: 'worker secret', staart: null }
      ] } }
    }) + ')');
    const el = document.getElementById('ws-admin-body');
    await window.sleutelPaneel(el);
    return el.innerHTML;
  }, { onderschep: ONDERSCHEP.toString() });
  check('er staat een waarschuwing', /nog geen hoofdsleutel/.test(zonderMaster), true);
  check('met het commando erbij', /wrangler secret put SLEUTEL_MASTER/.test(zonderMaster), true);
  /* En een sleutel die uit het Worker secret komt hoort dat te zeggen: hij
     werkt, maar je kunt hem hier niet wisselen zonder een nieuwe te zetten. */
  check('en een secret-sleutel zegt waar hij staat', /Worker secret/.test(zonderMaster), true);

  console.log('\n  een sleutel bewaren');
  const bewaard = await page.evaluate(async (arg) => {
    eval('(' + arg.onderschep + ')(' + JSON.stringify({
      'GET /systeem/sleutels': { status: 200, data: { master: true, sleutels: [
        { naam: 'ANTHROPIC_KEY', bron: 'database', staart: 'AAAA' },
        { naam: 'OPENAI_KEY', bron: 'ontbreekt' }
      ] } },
      'POST /systeem/sleutels': { status: 200, data: { ok: true, naam: 'ANTHROPIC_KEY', staart: 'AAAA', proef: { geldig: true } } }
    }) + ')');
    const el = document.getElementById('ws-admin-body');
    await window.sleutelPaneel(el);
    const regel = el.querySelector('.sl-regel[data-naam="ANTHROPIC_KEY"]');
    regel.querySelector('.sl-invoer').value = arg.nep;
    await window.sleutelBewaar(regel);
    const post = window.__verzonden.filter(v => v.method === 'POST')[0] || {};
    return {
      /* De waarde gaat mee naar de worker; dat is de bedoeling. */
      verstuurd: post.body ? JSON.parse(post.body) : null,
      melding: (el.querySelector('.sl-regel[data-naam="ANTHROPIC_KEY"] .sl-melding') || {}).textContent || '',
      veldNa: (el.querySelector('.sl-regel[data-naam="ANTHROPIC_KEY"] .sl-invoer') || {}).value,
      /* En hij mag nergens achterblijven in de browser. */
      inOpslag: JSON.stringify(Object.assign({}, localStorage)).includes(arg.nep) ||
                JSON.stringify(Object.assign({}, sessionStorage)).includes(arg.nep),
      inPagina: document.documentElement.outerHTML.includes(arg.nep)
    };
  }, { onderschep: ONDERSCHEP.toString(), nep: NEP });
  check('de sleutel is naar de worker gestuurd', bewaard.verstuurd && bewaard.verstuurd.waarde, NEP);
  check('onder de juiste naam', bewaard.verstuurd && bewaard.verstuurd.naam, 'ANTHROPIC_KEY');
  check('het scherm meldt dat hij werkt', /Bewaard en werkt/.test(bewaard.melding), true);
  /* Dit is de kern: na verzenden is het veld leeg. */
  check('het invoerveld is leeg', bewaard.veldNa, '');
  check('hij staat niet in localStorage of sessionStorage', bewaard.inOpslag, false);
  check('en nergens meer in de pagina', bewaard.inPagina, false);

  console.log('\n  bewaard maar ongeldig is geen half succes');
  /* Precies wat er vorige keer misging: opgeslagen, groen, en het werkte niet.
     Het scherm moet dat als één zin zeggen, met de reden van de dienst erbij. */
  const ongeldig = await page.evaluate(async (arg) => {
    eval('(' + arg.onderschep + ')(' + JSON.stringify({
      'GET /systeem/sleutels': { status: 200, data: { master: true, sleutels: [{ naam: 'ANTHROPIC_KEY', bron: 'database', staart: 'AAAA' }] } },
      'POST /systeem/sleutels': { status: 200, data: { ok: true, naam: 'ANTHROPIC_KEY', staart: 'AAAA',
        proef: { geldig: false, reden: 'invalid x-api-key' } } }
    }) + ')');
    const el = document.getElementById('ws-admin-body');
    await window.sleutelPaneel(el);
    const regel = el.querySelector('.sl-regel[data-naam="ANTHROPIC_KEY"]');
    regel.querySelector('.sl-invoer').value = arg.nep;
    await window.sleutelBewaar(regel);
    const na = el.querySelector('.sl-regel[data-naam="ANTHROPIC_KEY"]');
    return { melding: (na.querySelector('.sl-melding') || {}).textContent || '',
             veldNa: (na.querySelector('.sl-invoer') || {}).value };
  }, { onderschep: ONDERSCHEP.toString(), nep: NEP });
  check('het scherm zegt dat hij niet werkt', /werkt niet/.test(ongeldig.melding), true);
  check('met de reden van de dienst', /invalid x-api-key/.test(ongeldig.melding), true);
  check('en zegt er niet "bewaard" achteraan zonder meer',
    /^Bewaard en werkt/.test(ongeldig.melding), false);
  check('het veld is ook nu leeg', ongeldig.veldNa, '');

  console.log('\n  en een fout van de worker komt gewoon op het scherm');
  const fouten = await page.evaluate(async (arg) => {
    eval('(' + arg.onderschep + ')(' + JSON.stringify({
      'GET /systeem/sleutels': { status: 200, data: { master: true, sleutels: [{ naam: 'ANTHROPIC_KEY', bron: 'ontbreekt' }] } },
      'POST /systeem/sleutels': { status: 400, data: { error: 'dat ziet er niet uit als een ANTHROPIC_KEY. Controleer of de hele sleutel geplakt is.' } }
    }) + ')');
    const el = document.getElementById('ws-admin-body');
    await window.sleutelPaneel(el);
    const regel = el.querySelector('.sl-regel[data-naam="ANTHROPIC_KEY"]');
    regel.querySelector('.sl-invoer').value = 'sk-ant-api03-halve';
    await window.sleutelBewaar(regel);
    const uit = { melding: (regel.querySelector('.sl-melding') || {}).textContent || '',
                  veldNa: (regel.querySelector('.sl-invoer') || {}).value };
    /* En een leeg veld hoort er niet eens heen te gaan. */
    window.__verzonden.length = 0;
    regel.querySelector('.sl-invoer').value = '   ';
    await window.sleutelBewaar(regel);
    uit.leegMelding = (regel.querySelector('.sl-melding') || {}).textContent || '';
    uit.leegVerstuurd = window.__verzonden.length;
    return uit;
  }, { onderschep: ONDERSCHEP.toString() });
  check('de melding van de worker staat er', /hele sleutel geplakt/.test(fouten.melding), true);
  /* Ook bij een fout: het veld leeg. Wat erin stond was een poging tot een
     sleutel, en die hoort net zo goed niet te blijven staan. */
  check('en het veld is ook na een fout leeg', fouten.veldNa, '');
  check('een leeg veld levert een melding', /nog niets in het veld/.test(fouten.leegMelding), true);
  check('en gaat niet naar de worker', fouten.leegVerstuurd, 0);

  console.log('\n  het tabblad hangt in het adminpaneel');
  /* Het paneel zelf is admin-only (js/21 hangt de knop alleen op voor een
     admin), en de worker weigert de rest. Hier alleen: het tabblad bestaat en
     wijst naar dit scherm. */
  const bron = fs.readFileSync(path.join(APP, 'js', '21-supabase-sync.js'), 'utf8');
  check('er is een tabblad Sleutels', /adm-tab-sleutels/.test(bron), true);
  check('dat het paneel opent', /window\.sleutelPaneel\(/.test(bron), true);
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  check('en het bestand wordt geladen', /js\/53-sleutelbeheer\.js/.test(html), true);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
