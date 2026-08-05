/* Testlus voor de controlekaart — klaarzetten voor test.
 *
 * De belofte van dit scherm is "geen dubbele invoer": alles wat tijdens het
 * interview en de generatie bekend werd, staat er al. Die belofte is makkelijk
 * te breken zonder dat iemand het merkt — een veld dat niet doorkomt ziet er
 * precies zo uit als een veld dat leeg wás.
 *
 * Daarom test dit bestand vooral of wat bekend is ook werkelijk is meegenomen,
 * en of de twee dingen die het systeem NIET kan weten wél gevraagd worden.
 *
 *   node ad-generator/test/testklaar.cjs
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
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  /* De stand na een generatie mét interview: dit is wat het systeem op dat
     moment werkelijk in het geheugen heeft. */
  const open = async (extra = {}) => await page.evaluate(async (extra) => {
    window._rpc = [];
    window._sb = {
      rpc: function (naam, args) {
        window._rpc.push({ naam, args });
        const antwoord = naam === 'hq_ad_naam_voorstel'
          ? { data: 'WS.Groom-Guard.Mark-de-Vries.safety.01' }
          : (window._rpcAntwoord || { data: { creative_id: 9, werkstuk_id: 4, denkstuk_id: 2, ad_name: 'WS.Groom-Guard.Mark-de-Vries.safety.01' } });
        return { then: (r, j) => Promise.resolve(antwoord).then(r, j), catch: () => {} };
      }
    };
    window._authProfile = { id: 'u1', email: 'dustin@wellshave.com', full_name: 'Dustin Gibson' };
    window.ACTIVE_BRAND = 'wellshave';

    state.lastGenerated = Object.assign({
      variations: [{
        hook_type: 'Vondst', hook_label_nl: 'mechanisme tonen',
        headline_nl: 'Dit is het verschil',
        body_copy_nl: 'Vlak, afgerond, geen open mesjes.',
        cta_nl: 'Bekijk de kop',
        image_prompt_en: 'side by side macro of two trimmer heads',
        visual_nl: 'Links een trimmer die de huid meetrekt, rechts de Groom Guard.',
        reasoning_nl: 'Wantrouwen valt weg bij zichtbaar bewijs.',
        hypothese_nl: 'Als we het mechanisme tonen, dan stijgt de CTR, omdat twijfel wegvalt.'
      }],
      metadata: {
        product: 'Groom Guard', personaName: 'Mark de Vries',
        awareness: 'solution', funnel: 'TOF', format: 'Before / After',
        concept: 'het mechanisme tonen'
      }
    }, extra);
    state.generatedImages = [{ currentIndex: 0, versions: [{ b64: 'AAAA' }] }];
    window.iw = {
      known: { 'kern-pijn': 'losse haartjes na vier passes', hoek: 'het mechanisme tonen',
               'kern-bezwaar': 'al 2-3 trimmers versleten' },
      briefing: { theriot_note: 'Show dont tell: het verschil in beeld, niet in tekst.' },
      bronnen: [{ wat: 'interview met Rory', soort: 'gesprek' }]
    };
    tkOpen(0);
    await new Promise(r => setTimeout(r, 300));
    const q = (s) => document.querySelector(s);
    const regels = {};
    document.querySelectorAll('.tk-regel').forEach(r => {
      regels[r.querySelector('.tk-label').textContent.trim()] = r.querySelector('.tk-waarde').textContent.trim();
    });
    return {
      open: !!q('#tk-overlay'),
      naam: (q('#tk-naam') || {}).value,
      hypothese: (q('#tk-hyp') || {}).value,
      testvariabele: (q('#tk-var') || {}).value,
      regels,
      legeRegels: [...document.querySelectorAll('.tk-regel--leeg .tk-label')].map(e => e.textContent.trim()),
      beeld: !!q('.tk-beeld:not(.tk-beeld--leeg)'),
      preview: (q('.tk-preview-tekst strong') || {}).textContent,
      acties: [...document.querySelectorAll('.tk-acties button')].map(b => b.textContent.trim()),
      onderbouwing: (q('#tk-onderbouwing') || {}).textContent || '',
      rpc: window._rpc.map(r => r.naam)
    };
  }, extra);

  const uit = await open();

  console.log('\n  de kaart gaat open en toont de creative');
  check('de controlekaart staat er', uit.open, true);
  check('met de headline als preview', uit.preview, 'Dit is het verschil');
  check('en het gegenereerde beeld', uit.beeld, true);

  console.log('\n  geen dubbele invoer — wat bekend is, staat er');
  // Elk veld hier is een veld dat de gebruiker anders had moeten overtypen.
  check('product', uit.regels['Product'], 'Groom Guard');
  check('persona', uit.regels['Persona'], 'Mark de Vries');
  check('de hoek komt uit het interview', uit.regels['Angle'], 'het mechanisme tonen');
  check('awareness', uit.regels['Awareness'], 'solution');
  check('funnel', uit.regels['Funnel'], 'TOF');
  check('format', uit.regels['Format'], 'Before / After');
  check('de hypothese komt uit de generatie',
    /Als we het mechanisme tonen/.test(uit.hypothese), true);

  console.log('\n  en wat het systeem niet kan weten, wordt gevraagd');
  // De testvariabele is per definitie een vergelijking met de andere varianten.
  // Die staat nergens, dus die hoort leeg te zijn en verplicht.
  check('de testvariabele staat leeg', uit.testvariabele, '');
  check('de naam is voorgesteld door de database', uit.naam, 'WS.Groom-Guard.Mark-de-Vries.safety.01');
  check('en het voorstel is opgehaald, niet lokaal verzonnen',
    uit.rpc.indexOf('hq_ad_naam_voorstel') > -1, true);

  console.log('\n  de vier uitgangen');
  check('alle vier staan er', uit.acties,
    ['Bevestigen en naar Creative Strategy', 'Terug naar de creative', 'Opslaan als concept', 'Niet testen']);

  console.log('\n  waar het op rust');
  check('een volledig ingevulde kaart zegt dat het aannames blijven',
    /als aanname het denkstuk in/.test(uit.onderbouwing), true);
  const kaal = await open({ metadata: { product: 'Groom Guard' } });
  check('en een kale kaart noemt wat er mist',
    /geen persona gekozen/.test(kaal.onderbouwing), true);
  check('lege velden staan er als leeg, niet als lege plek',
    kaal.legeRegels.length > 0, true);

  console.log('\n  de grendel, hier al zichtbaar');
  const zonder = await page.evaluate(async () => {
    document.getElementById('tk-hyp').value = '';
    tkBevestig();
    await new Promise(r => setTimeout(r, 100));
    const e1 = document.getElementById('tk-fout').textContent;
    document.getElementById('tk-hyp').value = 'Als we A, dan B, omdat C';
    document.getElementById('tk-var').value = '';
    tkBevestig();
    await new Promise(r => setTimeout(r, 100));
    const e2 = document.getElementById('tk-fout').textContent;
    document.getElementById('tk-var').value = 'de kop toont het mechanisme';
    document.getElementById('tk-soph').value = '3';
    tkBevestig();
    await new Promise(r => setTimeout(r, 100));
    return { e1, e2, e3: document.getElementById('tk-fout').textContent };
  });
  check('zonder hypothese komt hij er niet door', /geen hypothese/.test(zonder.e1), true);
  check('zonder testvariabele ook niet', /testvariabele/.test(zonder.e2), true);
  check('en een sophistication-keuze zonder reden evenmin', /waarom/.test(zonder.e3), true);

  console.log('\n  bevestigen stuurt alles mee');
  const verstuurd = await page.evaluate(async () => {
    document.getElementById('tk-soph-reden').value = 'concurrenten leggen het mechanisme al uit';
    window._rpc = [];
    tkBevestig();
    await new Promise(r => setTimeout(r, 300));
    const call = window._rpc.filter(r => r.naam === 'hq_creative_testklaar')[0];
    return { p: call ? call.p || call.args.p : null, dicht: !document.getElementById('tk-overlay'),
             werkstuk: state.lastGenerated.werkstuk_id };
  });
  const p = verstuurd.p || {};
  check('de hypothese gaat mee', /Als we A, dan B/.test(p.hypothesis || ''), true);
  check('de testvariabele ook', p.test_variable, 'de kop toont het mechanisme');
  check('de redenering van Rory', p.rory_reasoning, 'Wantrouwen valt weg bij zichtbaar bewijs.');
  check('en die van Theriot', /Show dont tell/.test(p.theriot_reasoning || ''), true);
  check('de kernpijn uit het interview', p.kernpijn, 'losse haartjes na vier passes');
  check('het kernbezwaar', p.kernbezwaar, 'al 2-3 trimmers versleten');
  check('de image prompt', /side by side macro/.test(p.image_prompt || ''), true);
  check('het beeld zelf', p.image_b64, 'AAAA');
  check('sophistication met zijn reden', [p.sophistication, !!p.sophistication_reden], [3, true]);
  check('de bronnen', Array.isArray(p.bronnen) && p.bronnen.length, 1);
  check('de kaart gaat dicht na bevestigen', verstuurd.dicht, true);
  // Een tweede variant uit dezelfde generatie hoort aan hetzelfde werkstuk.
  check('en het werkstuk wordt onthouden', verstuurd.werkstuk, 4);

  console.log('\n  regel 4.5 — kleuren uit het tokenblok');
  const css = fs.readFileSync(path.join(APP, 'css', '17-testklaar.css'), 'utf8');
  check('geen losse hex in het component', (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []), []);

  console.log('\n  regel 4.1 — contrast, gemeten');
  await open();
  const contrast = await page.evaluate(() => {
    const lum = c => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const meet = (sel, bgSel) => {
      const el = document.querySelector(sel), bg = document.querySelector(bgSel);
      if (!el || !bg) return null;
      const a = lum(getComputedStyle(el).color), b = lum(getComputedStyle(bg).backgroundColor);
      const [hi, lo] = a > b ? [a, b] : [b, a];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    return {
      lede: meet('.tk-lede', '.tk-kaart'),
      label: meet('.tk-label', '.tk-kaart'),
      waarde: meet('.tk-waarde', '.tk-kaart'),
      hint: meet('.tk-veld small', '.tk-kaart'),
      onderbouwing: meet('.tk-ob-uitleg', '.tk-onderbouwing')
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
