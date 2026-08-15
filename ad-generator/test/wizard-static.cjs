/* Testlus voor de Static Ad Wizard.
 *
 *   node ad-generator/test/wizard-static.cjs
 *
 * Draait de echte console in Chromium, zodat de werkelijke wizard-functies
 * getest worden en niet een kopie ervan. Er gaat geen enkele aanroep naar een
 * taalmodel: alles wat hier bewezen wordt is logica die ook zonder Rory moet
 * kloppen. Wat Rory terugstuurt is niet te testen, wat de wizard ermee doet
 * wel — en dat is precies waar het misgaat als je niet oplet.
 *
 * De vier regels die hier bewezen moeten worden:
 *
 *   1. Je kunt geen stap in waarvan de voorgangers niet af zijn. Anders bouwt
 *      de wizard een briefing op gaten en merkt niemand dat.
 *   2. Een eerdere keuze omgooien markeert wat ervan afhangt als verlopen,
 *      maar wist niets, en raakt niet wat er los van staat.
 *   3. Een handmatige keuze overleeft een advies van Rory. Wie zelf een format
 *      koos wil dat niet stilletjes teruggedraaid zien.
 *   4. De briefing die naar de generator gaat draagt de vastgezette strategie
 *      letterlijk mee. Valt dat weg, dan drijven de drie concepten uit elkaar
 *      en is de goedkeuring in stap 7 waardeloos.
 *
 * En twee randvoorwaarden uit de opdracht: de nieuwe interface is Engels, en
 * Kopieer ad en Itereren blijven op het oude formulier draaien.
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

/* Een volledig ingevulde wizard, zonder Rory. Dit is de toestand waarin de
   interessante fouten zitten: alles staat, en dan verandert er iets vroegs. */
const VULLEN = `
  var p = (state.products || [])[0];
  var pers = (state.personas || [])[0];
  wizSet('product','productId', p ? p.id : 'p1','user');
  wizSet('product','placement','feed45','user');
  wizSet('product','funnel','tof','user');
  wizSet('audience','personaId', pers ? pers.id : 'x1','user');
  wizSet('audience','awareness','problem','user');
  wizSet('strategy','angleType','Problem-Solution','rory');
  wizSet('strategy','marketingAngle','Scheren hoeft niet te schuren.','rory');
  wizSet('strategy','messaging','Een mesje dat de huid met rust laat.','rory');
  wizSet('format','formatId','before-after','user');
  wizSet('visual','composition','split','rory');
  wizSet('visual','humanPresence','hands','rory');
  wizSet('visual','scene','bathroom','rory');
  wizSet('visual','mood','masculine','rory');
  wizSet('copy','headline','Glad zonder gedoe','rory');
  wizSet('copy','cta','Bestel nu','rory');
`;

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage();
  const jsFouten = [];
  page.on('pageerror', e => jsFouten.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  /* ── De romp ──────────────────────────────────────────────────────────── */
  console.log('\n  de romp');

  const romp = await page.evaluate(() => {
    wizReset(true);
    wizOpen();
    return {
      stappen: WIZ_STEPS.length,
      knoppen: document.querySelectorAll('#wiz-progress .wiz-step').length,
      zichtbaar: document.getElementById('wiz-overlay').style.display,
      eerste: wizState.current,
      kop: (document.querySelector('#wiz-head .wiz-title') || {}).textContent
    };
  });
  check('de wizard heeft negen stappen', romp.stappen, 9);
  check('en tekent er negen in de voortgangsbalk', romp.knoppen, 9);
  check('hij opent zichtbaar', romp.zichtbaar, 'flex');
  check('en begint bij het product', romp.eerste, 'product');
  check('met de kop van stap 1', romp.kop, 'Product and placement');

  /* ── 1. Poortwachter ──────────────────────────────────────────────────── */
  console.log('\n  je komt niet in een stap waarvan de voorganger leeg is');

  const poort1 = await page.evaluate(() => {
    wizReset(true);
    return {
      productMag: wizCanEnter('product'),
      audienceMag: wizCanEnter('audience'),
      strategieMag: wizCanEnter('strategy'),
      genereerMag: wizCanEnter('generate')
    };
  });
  check('stap 1 mag altijd', poort1.productMag, true);
  check('stap 2 mag nog niet', poort1.audienceMag, false);
  check('stap 3 mag nog niet', poort1.strategieMag, false);
  check('stap 9 mag nog niet', poort1.genereerMag, false);

  const poort2 = await page.evaluate(() => {
    wizReset(true);
    wizSet('product', 'productId', 'p1', 'user');
    wizSet('product', 'placement', 'feed11', 'user');
    var half = wizCanEnter('audience');
    wizSet('product', 'funnel', 'tof', 'user');
    return { half: half, heel: wizCanEnter('audience'), nogSteedsNiet: wizCanEnter('strategy') };
  });
  check('een half ingevulde stap 1 opent stap 2 niet', poort2.half, false);
  check('een volledige stap 1 wel', poort2.heel, true);
  check('maar stap 3 blijft dicht tot stap 2 af is', poort2.nogSteedsNiet, false);

  /* Springen mag ook niet via de knop, niet alleen niet via de functie. */
  const sprong = await page.evaluate(() => {
    wizReset(true);
    wizOpen();
    wizGo('copy');
    return wizState.current;
  });
  check('wizGo naar een gesloten stap doet niets', sprong, 'product');

  /* ── 2. Verlopen, niet wissen ─────────────────────────────────────────── */
  console.log('\n  een eerdere keuze omgooien');

  const verlopen = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    /* alles staat; nu de persona omgooien */
    var voor = JSON.parse(JSON.stringify(wizState.data));
    wizSet('audience', 'personaId', 'andere-persona', 'user');
    return {
      strategieVerlopen: !!wizState.stale.strategy,
      copyVerlopen: !!wizState.stale.copy,
      formatVerlopen: !!wizState.stale.format,
      /* De plaatsing hangt niet van de persona af en mag dus niet meelopen. */
      productVerlopen: !!wizState.stale.product,
      /* En niets is gewist. */
      hoekBewaard: wizState.data.strategy.marketingAngle,
      headlineBewaard: wizState.data.copy.headline,
      plaatsingBewaard: wizState.data.product.placement,
      hoekVoor: voor.strategy.marketingAngle
    };
  }, VULLEN);
  check('de strategie raakt verlopen', verlopen.strategieVerlopen, true);
  check('de copy raakt verlopen', verlopen.copyVerlopen, true);
  check('het format raakt verlopen', verlopen.formatVerlopen, true);
  check('het product raakt NIET verlopen', verlopen.productVerlopen, false);
  check('de hoek blijft gewoon staan', verlopen.hoekBewaard, verlopen.hoekVoor);
  check('de headline blijft staan', verlopen.headlineBewaard, 'Glad zonder gedoe');
  check('de plaatsing blijft staan', verlopen.plaatsingBewaard, 'feed45');

  /* Andersom: een late stap omgooien mag niets vroegs raken. */
  const omlaag = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    wizState.stale = {};
    wizSet('copy', 'headline', 'Andere kop', 'user');
    return { strategie: !!wizState.stale.strategy, product: !!wizState.stale.product, review: !!wizState.stale.review };
  }, VULLEN);
  check('de copy aanpassen laat de strategie met rust', omlaag.strategie, false);
  check('en het product ook', omlaag.product, false);

  /* Een lege afhankelijke stap hoeft niet te verlopen: er staat niets in. */
  const leeg = await page.evaluate(() => {
    wizReset(true);
    wizSet('product', 'productId', 'p1', 'user');
    wizSet('product', 'funnel', 'tof', 'user');
    wizSet('product', 'placement', 'feed11', 'user');
    wizSet('product', 'funnel', 'bof', 'user');
    return { strategie: !!wizState.stale.strategy };
  });
  check('een lege vervolgstap raakt niet verlopen', leeg.strategie, false);

  /* ── 3. Handmatig wint van Rory ───────────────────────────────────────── */
  console.log('\n  een handmatige keuze overleeft een advies');

  const vastgezet = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    /* format stond op 'user', visual.composition op 'rory' */
    wizApplyAdvice('format', { formatId: 'product-hero' });
    wizApplyAdvice('visual', { composition: 'editorial' });
    return {
      format: wizState.data.format.formatId,
      compositie: wizState.data.visual.composition,
      formatBron: wizSourceOf('format', 'formatId')
    };
  }, VULLEN);
  check('Rory overschrijft een zelfgekozen format niet', vastgezet.format, 'before-after');
  check('en de bron blijft de gebruiker', vastgezet.formatBron, 'user');
  check('maar zijn eigen eerdere advies mag hij wel bijstellen', vastgezet.compositie, 'editorial');

  /* Expliciet doordrukken mag wel — dat is wat "You decide" doet. */
  const doordrukken = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    wizApplyAdvice('format', { formatId: 'product-hero' }, true);
    return wizState.data.format.formatId;
  }, VULLEN);
  check('met force overschrijft hij wel', doordrukken, 'product-hero');

  /* ── 4. De briefing draagt de strategie ───────────────────────────────── */
  console.log('\n  de briefing naar de generator');

  const brief = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    var t = wizBuildBrief(3);
    return {
      hoek: t.indexOf('Scheren hoeft niet te schuren.') > -1,
      boodschap: t.indexOf('Een mesje dat de huid met rust laat.') > -1,
      awareness: t.indexOf('Problem aware') > -1,
      visueel: t.indexOf('Split composition') > -1,
      scene: t.indexOf('Bathroom') > -1,
      slot: t.indexOf('DEZELFDE persona, awareness, marketing-angle en kernboodschap') > -1,
      headline: t.indexOf('Glad zonder gedoe') > -1,
      /* metadata moet de vorm hebben die generateImage verwacht */
      meta: Object.keys(wizMetadata()).sort()
    };
  }, VULLEN);
  check('de vastgezette hoek staat in de briefing', brief.hoek, true);
  check('de kernboodschap ook', brief.boodschap, true);
  check('het awareness-niveau staat er leesbaar in', brief.awareness, true);
  check('de visuele richting staat erin, niet als slug', brief.visueel, true);
  check('en de scene ook', brief.scene, true);
  check('de goedgekeurde headline gaat mee', brief.headline, true);
  check('en bij 3 concepten staat de vastzet-regel erin', brief.slot, true);
  check('de metadata heeft de velden die de beeldpijplijn leest',
    ['awareness', 'funnel', 'personaId', 'placement', 'productId'].every(k => brief.meta.indexOf(k) > -1), true);

  /* Bij 1 variant hoort die vastzet-regel er juist NIET te staan. */
  const een = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    return wizBuildBrief(1).indexOf('DEZELFDE persona') > -1;
  }, VULLEN);
  check('bij een enkele variant vervalt de spreidingsregel', een, false);

  /* ── Bewaren over een refresh ─────────────────────────────────────────── */
  console.log('\n  de wizard onthoudt waar je was');

  await page.evaluate(vullen => { wizReset(true); eval(vullen); wizState.current = 'format'; wizSave(); }, VULLEN);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const naHerlaad = await page.evaluate(() => ({
    hoek: wizState.data.strategy.marketingAngle,
    stap: wizState.current,
    bron: wizSourceOf('format', 'formatId'),
    open: document.getElementById('wiz-overlay').style.display
  }));
  check('de hoek staat er na een refresh nog', naHerlaad.hoek, 'Scheren hoeft niet te schuren.');
  check('en de stap waar je was', naHerlaad.stap, 'format');
  check('inclusief wie welk veld zette', naHerlaad.bron, 'user');
  check('maar hij springt niet vanzelf open', naHerlaad.open, 'none');

  /* ── Rory leidt ───────────────────────────────────────────────────────────
   *
   * De kern van de opdracht: Rory wacht niet tot de gebruiker alles handmatig
   * invult. Bij binnenkomst op een stap kijkt hij uit zichzelf. Wat hij
   * terugstuurt is hier niet te testen -- er gaat geen model aan te pas -- maar
   * wanneer hij wél en niet mag beginnen wel, en dat is waar het misgaat. */
  console.log('\n  Rory kijkt uit zichzelf');

  const vanzelf = await page.evaluate(() => {
    wizReset(true);
    wizState.busy = false;
    var gevraagd = [];
    var echt = window.wizAdvise;
    window.wizAdvise = function (k) { gevraagd.push(k); return Promise.resolve(null); };
    /* Teamserver-modus levert de sleutel buiten het invoerveld om; die moet
       hier uit, anders test dit blok niets. */
    var team = window.__WG_TEAMSERVER;
    window.__WG_TEAMSERVER = false;
    document.getElementById('anthropic-key').value = '';
    wizOpen();
    var zonderSleutel = gevraagd.slice();

    /* met sleutel wel, en meteen bij het openen van stap 1 */
    document.getElementById('anthropic-key').value = 'sk-ant-test';
    wizState.advised = {};
    wizRender();
    var metSleutel = gevraagd.slice();
    window.__WG_TEAMSERVER = team;

    /* een tweede hertekening mag hem niet opnieuw laten beginnen */
    wizRender(); wizRender();
    var naDrieRenders = gevraagd.length;

    window.wizAdvise = echt;
    return { zonderSleutel, metSleutel, naDrieRenders };
  });
  check('zonder API-sleutel vraagt hij niets', vanzelf.zonderSleutel, []);
  check('met sleutel begint hij vanzelf aan stap 1', vanzelf.metSleutel, ['product']);
  check('en hij begint niet bij elke hertekening opnieuw', vanzelf.naDrieRenders, 1);

  const wachten = await page.evaluate(() => {
    wizReset(true);
    /* Een echte aanroep uit het vorige blok kan nog lopen; die zet busy en dan
       adviseert hij hier niets, wat op een fout in de logica lijkt terwijl het
       de test zelf is. */
    wizState.busy = false;
    var gevraagd = [];
    var echt = window.wizAdvise;
    window.wizAdvise = function (k) { gevraagd.push(k); return Promise.resolve(null); };
    document.getElementById('anthropic-key').value = 'sk-ant-test';
    wizOpen();
    /* stap 3 leest van 1 en 2; met een lege stap 2 mag hij niet gaan gissen */
    wizState.current = 'strategy';
    wizState.advised = {};
    wizRender();
    var metLegeVoorganger = gevraagd.filter(k => k === 'strategy').length;

    wizSet('product', 'productId', 'p1', 'user');
    wizSet('product', 'funnel', 'tof', 'user');
    wizSet('product', 'placement', 'feed11', 'user');
    wizSet('audience', 'personaId', 'x1', 'user');
    wizSet('audience', 'awareness', 'problem', 'user');
    wizState.advised = {};
    wizRender();
    var metVolledigeVoorganger = gevraagd.filter(k => k === 'strategy').length;

    window.wizAdvise = echt;
    return { metLegeVoorganger, metVolledigeVoorganger };
  });
  check('met een lege voorganger gaat hij niet gissen', wachten.metLegeVoorganger, 0);
  check('zodra de voorganger vol is begint hij wel', wachten.metVolledigeVoorganger, 1);

  /* ── De stap is een zin, geen formulier ───────────────────────────────── */
  console.log('\n  een stap is een zin, geen formulier');

  const zin = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    var tel = function (html) {
      var d = document.createElement('div'); d.innerHTML = html;
      return { velden: d.querySelectorAll('input, textarea').length,
               woorden: d.querySelectorAll('.wiz-woord').length,
               zin: (d.querySelector('.wiz-zin') || {}).textContent || '' };
    };
    return {
      product: tel(wizRender_product()),
      visueel: tel(wizRender_visual()),
      copy: tel(wizRender_copy()),
      strategie: tel(wizRender_strategy())
    };
  }, VULLEN);
  check('stap 1 opent zonder een enkel invoerveld', zin.product.velden, 0);
  check('en zet de beslissingen als woorden in de zin', zin.product.woorden, 3);
  check('stap 5 toont vijf hoofdkeuzes, niet tien blokken', zin.visueel.woorden, 5);
  check('stap 5 opent ook zonder invoervelden', zin.visueel.velden, 0);
  check('stap 6 toont de copy, geen invoervakken', zin.copy.velden, 0);
  check('stap 3 toont de stelling, geen formulier', zin.strategie.velden, 0);

  /* De uitklap is waar het formulier zit. Dicht is dicht. */
  const uitklap = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    var telVelden = function (html) {
      var d = document.createElement('div'); d.innerHTML = html;
      return d.querySelectorAll('input, textarea').length;
    };
    var dicht = telVelden(wizRender_copy());
    wizToggleUitklap('copy');
    var open = telVelden(wizRender_copy());
    return { dicht, open };
  }, VULLEN);
  check('dichtgeklapt staan er geen velden', uitklap.dicht, 0);
  check('opengeklapt staat het volledige formulier er wel', uitklap.open > 3, true);

  /* ── De opdracht: Engels, en de rest ongemoeid ────────────────────────── */
  console.log('\n  de randvoorwaarden uit de opdracht');

  /* Alle zichtbare tekst van de wizard langs een lijst Nederlandse woorden die
     in deze codebase overal voorkomen. Eén ervan in de wizard betekent dat er
     een Nederlands label is blijven staan. */
  const engels = await page.evaluate(() => {
    wizReset(true);
    wizOpen();
    var gezien = [];
    var nl = ['Kies ', 'Genereer', 'Volgende', 'Terug naar', 'Doelgroep', 'Invalshoek',
              'Plaatsing', 'Bewerk', 'Opslaan', 'Aanbevolen', 'advertentie', 'Stap '];
    ['product', 'audience', 'strategy', 'format', 'visual', 'copy', 'review', 'concepts', 'generate']
      .forEach(function (k) {
        var html = '';
        try { html = (window['wizRender_' + k] || function () { return ''; })(); } catch (e) { html = ''; }
        var d = document.createElement('div');
        d.innerHTML = html;
        var tekst = (d.textContent || '');
        nl.forEach(function (w) { if (tekst.indexOf(w) > -1) gezien.push(k + ': ' + w); });
      });
    /* de romp zelf ook: kop, voortgang, voettekst */
    var romp = (document.getElementById('wiz-topbar') || document.querySelector('.wiz-topbar') || {}).textContent || '';
    romp += (document.getElementById('wiz-footer') || {}).textContent || '';
    romp += (document.getElementById('wiz-head') || {}).textContent || '';
    nl.forEach(function (w) { if (romp.indexOf(w) > -1) gezien.push('shell: ' + w); });
    return gezien;
  });
  check('geen Nederlandse interface-tekst in de wizard', engels, []);

  /* De oude modi delen dit scherm. Het klassieke formulier moet daar open en
     compleet zijn, anders sloopt deze wizard Kopieer ad en Itereren. */
  const oud = await page.evaluate(() => {
    var uit = {};
    setMode('scratch');
    uit.scratchIngeklapt = document.getElementById('classic-form').classList.contains('collapsed');
    uit.launchZichtbaar = !!document.getElementById('wiz-launch');
    setMode('copy');
    uit.copyOpen = !document.getElementById('classic-form').classList.contains('collapsed');
    uit.copyKnop = !!document.getElementById('generate-btn');
    uit.copyBron = !!document.getElementById('source-ad-dropzone');
    setMode('iterate');
    uit.iterateOpen = !document.getElementById('classic-form').classList.contains('collapsed');
    uit.iterateVelden = !!document.getElementById('iterate-fields');
    setMode('scratch');
    uit.terugIngeklapt = document.getElementById('classic-form').classList.contains('collapsed');
    /* en met de hand open te klappen */
    toggleClassicForm();
    uit.handmatigOpen = !document.getElementById('classic-form').classList.contains('collapsed');
    return uit;
  });
  check('vanaf nul staat het oude formulier ingeklapt', oud.scratchIngeklapt, true);
  check('en staat de wizard-ingang er', oud.launchZichtbaar, true);
  check('in Kopieer ad staat het oude formulier open', oud.copyOpen, true);
  check('met de genereer-knop erin', oud.copyKnop, true);
  check('en de bron-ad dropzone', oud.copyBron, true);
  check('in Itereren staat het ook open', oud.iterateOpen, true);
  check('met de iteratie-velden', oud.iterateVelden, true);
  check('terug naar vanaf nul klapt het weer in', oud.terugIngeklapt, true);
  check('en je kunt het zelf openklappen', oud.handmatigOpen, true);

  /* De Ad Transformer is een eigen tab en mag niet geraakt zijn. */
  const transformer = await page.evaluate(() => {
    var el = document.getElementById('main-tab-transformer');
    return { bestaat: !!el, inhoud: el ? el.children.length > 0 : false };
  });
  check('de Ad Transformer staat er nog', transformer.bestaat, true);
  check('en is niet leeggehaald', transformer.inhoud, true);

  /* ── Geen stille fouten ───────────────────────────────────────────────── */
  console.log('\n  geen stille fouten');
  const losseHandlers = await page.evaluate(() => {
    var mist = [];
    /* if/for/while zijn geen handlers maar taalconstructies; die staan al in de
       bestaande markup van de Transformer en de Copywriter. */
    var sleutelwoorden = ['if', 'for', 'while', 'switch', 'return', 'typeof'];
    document.querySelectorAll('[onclick]').forEach(function (el) {
      var m = String(el.getAttribute('onclick')).match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);
      if (!m || sleutelwoorden.indexOf(m[1]) > -1) return;
      if (typeof window[m[1]] !== 'function') mist.push(m[1]);
    });
    return [...new Set(mist)];
  });
  check('elke onclick in de wizard bestaat op window', losseHandlers, []);
  check('de pagina draaide zonder JavaScript-fouten', jsFouten, []);

  await browser.close();
  srv.close();
  console.log(fout ? `\n  ${fout} controle(s) mislukt\n` : '\n  Alle controles geslaagd\n');
  process.exit(fout ? 1 : 0);
})();
