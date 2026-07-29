/* Testlus voor de angle-volgorde in de testwizard.
 *
 * De volgorde is een oordeel, geen opmaak: hij bepaalt waar iemand op klikt als
 * hij een nieuwe test plant. De regel die hier bewezen moet worden is dat een
 * hoge ROAS die op te weinig data rust NIET boven een lagere komt die wel op
 * genoeg advertenties rust. Anders stuurt toeval de creatieve keuze.
 *
 *   node ad-generator/test/wizard-angles.cjs
 *
 * Draait de echte console in Chromium met een nep-Supabase eronder, zodat de
 * werkelijke wgpLoadAngleHist en wgpScreen draaien en niet een kopie ervan.
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

/* Bewust zo gekozen dat de valkuil zichtbaar wordt:
   Benefits-Driven heeft de hoogste ROAS van allemaal (9.9) maar staat op
   betrouwbaar=false. Als die bovenaan eindigt, is de drempel niet aan het werk. */
const FIXTURES = {
  hq_angle_learnings: [
    { angle_type: 'Problem-Solution',        roas: 4.1, aantal_ads: 6, winnaars: 2, betrouwbaar: true  },
    { angle_type: 'Social Proof / Reviews',  roas: 3.4, aantal_ads: 4, winnaars: 1, betrouwbaar: true  },
    { angle_type: 'Benefits-Driven',         roas: 9.9, aantal_ads: 1, winnaars: 0, betrouwbaar: false },
  ],
  creatives: [
    { angle_type: 'Problem-Solution',        roas: 5.2 },
    { angle_type: 'Problem-Solution',        roas: 3.0 },
    { angle_type: 'Social Proof / Reviews',  roas: 3.9 },
    { angle_type: 'Benefits-Driven',         roas: 9.9 },
    { angle_type: 'Storytelling / Narrative', roas: 2.0 },
    { angle_type: 'Storytelling / Narrative', roas: 1.1 },
    { angle_type: 'Curiosity / Intrigue',    roas: null },
  ],
};

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

  const lees = async fixtures => await page.evaluate(async fixtures => {
    // nep-Supabase: elke keten-methode geeft zichzelf terug, .then levert de rijen
    window._sb = { from: function (tabel) {
      const q = {};
      ['select', 'eq', 'ilike', 'in', 'order', 'limit'].forEach(m => { q[m] = () => q; });
      q.then = (res, rej) => Promise.resolve({ data: fixtures[tabel] || [] }).then(res, rej);
      return q;
    }};
    window._authProfile = { id: 'test' };
    window.wgpRender = function () {};          // scherm hoeft niet echt getekend

    wgp.sel.persona = 'Man 30-45';
    wgpLoadAngleHist();
    await new Promise(r => setTimeout(r, 300));

    wgp.step = 'angle';
    const html = wgpScreen();
    const d = document.createElement('div');
    d.innerHTML = html;

    // groepskoppen en de kaarttitels eronder, in de volgorde van het scherm
    const groepen = [];
    d.querySelectorAll('.wgp-groep').forEach(g => {
      const grid = g.nextElementSibling;
      groepen.push({
        label: g.textContent.trim(),
        kaarten: [...grid.querySelectorAll('.wgp-card .t')].map(e => e.textContent.trim()),
        chips: [...grid.querySelectorAll('.wgp-card .wgp-tag')].map(e => e.textContent.trim()),
      });
    });
    return { groepen, ruw: html.slice(0, 200), hist: wgp.angleHist };
  }, fixtures);

  const uit = await lees(FIXTURES);

  // Als de kaarttitel-selector niet klopt, valt de test stil zonder iets te zeggen.
  if (!uit.groepen.length || uit.groepen.every(g => !g.kaarten.length)) {
    console.log('  De kaarten zijn niet uit te lezen — selector klopt niet.');
    console.log('  ruwe html:', uit.ruw);
    await browser.close(); srv.close(); process.exit(1);
  }

  console.log(`  ${uit.groepen.length} groepen op het scherm\n`);

  check('drie groepen, in deze volgorde',
    uit.groepen.map(g => g.label),
    ['Werkt bij deze persona', 'Geprobeerd, nog geen oordeel', 'Nog niet geprobeerd bij deze persona']);

  check('bewezen angles op gewogen ROAS, hoogste eerst',
    uit.groepen[0].kaarten, ['Problem-Solution', 'Social Proof / Reviews']);

  check('ROAS 9.9 op EEN ad staat NIET bovenaan',
    uit.groepen[0].kaarten.includes('Benefits-Driven'), false);

  check('te dunne data zakt naar de tweede groep',
    uit.groepen[1].kaarten,
    ['Benefits-Driven', 'Storytelling / Narrative', 'Curiosity / Intrigue']);

  check('ongeteste angles blijven zichtbaar als eigen groep',
    uit.groepen[2].kaarten.length, 5);

  check('de chip van een bewezen angle noemt waarop het rust',
    uit.groepen[0].chips[0], 'ROAS 4.1 over 6 ads · 2 winners');

  check('de chip van een dunne angle zegt dat het te dun is',
    /nog te dun voor een oordeel/.test(uit.groepen[1].chips[0]), true);

  check('alle tien angles staan er nog',
    uit.groepen.reduce((n, g) => n + g.kaarten.length, 0), 10);

  /* Twee gevallen die vandaag de werkelijkheid zijn. Zonder deze twee zou de
     wizard er goed uitzien op data die er nog niet is. */

  console.log('\n  leeg account, nog niets getest');
  const leeg = await lees({ hq_angle_learnings: [], creatives: [] });
  check('alles in de groep "nog niet geprobeerd"',
    leeg.groepen.map(g => [g.label, g.kaarten.length]),
    [['Nog niet geprobeerd bij deze persona', 10]]);

  /* Migratie 0008 hoeft nog niet op de live database te staan. PostgREST geeft
     dan een fout terug in plaats van rijen. De wizard moet dan terugvallen op
     de ruwe creatives-telling, niet leeglopen. */
  console.log('\n  hq_angle_learnings bestaat nog niet');
  const zonderView = await lees({ hq_angle_learnings: null, creatives: FIXTURES.creatives });
  check('valt terug op de ruwe telling uit creatives',
    zonderView.groepen.map(g => g.label),
    ['Geprobeerd, nog geen oordeel', 'Nog niet geprobeerd bij deze persona']);
  check('en zet daar de beste losse ad bovenaan',
    zonderView.groepen[0].kaarten[0], 'Benefits-Driven');
  check('nog steeds alle tien angles',
    zonderView.groepen.reduce((n, g) => n + g.kaarten.length, 0), 10);

  await browser.close(); srv.close();
  console.log(fout ? `\n  ${fout} controle(s) mislukt` : '\n  Alle controles geslaagd');
  process.exit(fout ? 1 : 0);
})().catch(e => { console.error('FOUT:', e.message); process.exit(1); });
