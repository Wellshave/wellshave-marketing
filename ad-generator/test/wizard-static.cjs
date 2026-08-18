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
  wizSet('audience','sophistication','s3','user');
  wizSet('strategy','angleType','Problem-Solution','rory');
  wizSet('strategy','differentiation','mechanism','rory');
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
    var paneel = document.getElementById('wiz-inline');
    return {
      stappen: WIZ_STEPS.length,
      knoppen: document.querySelectorAll('#wiz-progress .wiz-step').length,
      zichtbaar: paneel ? paneel.style.display : '(ontbreekt)',
      /* In de pagina, niet in een overlay: de zijbalk van de console hoort
         zichtbaar te blijven zodat je in een scherm ván het systeem zit. */
      inDeGeneratorkolom: !!(paneel && paneel.closest('#main-tab-generator')),
      zijbalkErnaast: !!document.querySelector('.ws-sidebar'),
      eerste: wizState.current,
      kop: (document.querySelector('#wiz-head .wiz-title') || {}).textContent,
      adviesregel: !!document.getElementById('wiz-rorybalk'),
      roryKolom: !!document.getElementById('wiz-rory')
    };
  });
  check('de wizard heeft negen stappen', romp.stappen, 9);
  check('en tekent er negen in de voortgangsbalk', romp.knoppen, 9);
  check('hij opent zichtbaar', romp.zichtbaar, '');
  check('hij staat in de generatorkolom, niet in een overlay', romp.inDeGeneratorkolom, true);
  check('en de zijbalk blijft daarnaast staan', romp.zijbalkErnaast, true);
  check('er is een adviesregel onder de stappenbalk', romp.adviesregel, true);
  check('en Rory heeft nog steeds zijn eigen kolom', romp.roryKolom, true);
  check('en begint bij het product', romp.eerste, 'product');
  check('met de kop van stap 1, met nummer', romp.kop, '1. Product and placement');

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
      /* Leesbaar, niet de ruwe slug. Valt dit terug op 'problem', dan mist
         'problem aware' en slaat deze controle alsnog aan. */
      awareness: t.toLowerCase().indexOf('problem aware') > -1,
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
  const naHerlaad = await page.evaluate(() => {
    var uit = {
      hoek: wizState.data.strategy.marketingAngle,
      stap: wizState.current,
      bron: wizSourceOf('format', 'formatId')
    };
    /* En je pakt hem op waar je was: Statics is de wizard, dus na een refresh
       sta je weer op stap 4 en niet aan het begin. */
    switchMainTab('generator');
    uit.zichtbaar = !!(document.getElementById('wiz-inline') || {}).offsetParent;
    uit.kop = (document.querySelector('#wiz-head .wiz-title') || {}).textContent;
    return uit;
  });
  check('de hoek staat er na een refresh nog', naHerlaad.hoek, 'Scheren hoeft niet te schuren.');
  check('en de stap waar je was', naHerlaad.stap, 'format');
  check('inclusief wie welk veld zette', naHerlaad.bron, 'user');
  check('Statics staat er weer', naHerlaad.zichtbaar, true);
  check('en op de stap waar je was', naHerlaad.kop, '4. Format');

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

    /* Met sleutel, maar zonder gekozen product: nog steeds niets. Een richting
       geven over een product dat je nog niet gekozen hebt leest als kennis en
       is het niet. */
    document.getElementById('anthropic-key').value = 'sk-ant-test';
    wizState.advised = {};
    wizRender();
    var zonderProduct = gevraagd.slice();

    /* Zodra het onderwerp er is, begint hij vanzelf. */
    wizSet('product', 'productId', (state.products[0] || {}).id || 'p1', 'user');
    wizState.advised = {};
    wizRender();
    var metSleutel = gevraagd.slice();
    window.__WG_TEAMSERVER = team;

    /* een tweede hertekening mag hem niet opnieuw laten beginnen */
    wizRender(); wizRender();
    var naDrieRenders = gevraagd.length;

    window.wizAdvise = echt;
    return { zonderSleutel, zonderProduct, metSleutel, naDrieRenders };
  });
  check('zonder API-sleutel vraagt hij niets', vanzelf.zonderSleutel, []);
  check('met sleutel maar zonder product nog steeds niet', vanzelf.zonderProduct, []);
  check('zodra er een product staat begint hij vanzelf', vanzelf.metSleutel, ['product']);
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
    wizSet('audience', 'sophistication', 's3', 'user');
    wizState.advised = {};
    wizRender();
    var metVolledigeVoorganger = gevraagd.filter(k => k === 'strategy').length;

    window.wizAdvise = echt;
    return { metLegeVoorganger, metVolledigeVoorganger };
  });
  check('met een lege voorganger gaat hij niet gissen', wachten.metLegeVoorganger, 0);
  check('zodra de voorganger vol is begint hij wel', wachten.metVolledigeVoorganger, 1);

  /* ── Twee kolommen: beslissing links, onderbouwing rechts ─────────────────
   *
   * De vorm uit het ontwerp. Wat hier bewezen moet worden is niet hoe het
   * eruitziet maar dat élke stap zijn onderbouwing meelevert: een persona
   * kiezen zonder het onderzoek ernaast is gokken met een dropdown. */
  console.log('\n  elke stap levert links de keuze en rechts waar die op rust');

  const kolommen = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    wizState.advice.strategy = {
      recommendation: {}, why: 'Because the research says so.',
      evidence: ['5 USPs on Groom Guard', 'Customer research'], alternatives: []
    };
    var lees = function (k) {
      var uit = window['wizRender_' + k]();
      if (typeof uit === 'string') return { tweekolom: false };
      var L = document.createElement('div'); L.innerHTML = uit.links || '';
      var R = document.createElement('div'); R.innerHTML = uit.rechts || '';
      return {
        tweekolom: true,
        linksLeeg: !(uit.links || '').trim(),
        rechtsLeeg: !(uit.rechts || '').trim(),
        linksBedienbaar: L.querySelectorAll('button, select, input, textarea').length,
        rechtsTekst: (R.textContent || '').trim().length
      };
    };
    return {
      product: lees('product'), audience: lees('audience'),
      strategy: lees('strategy'), visual: lees('visual'), copy: lees('copy')
    };
  }, VULLEN);
  ['product', 'audience', 'strategy', 'visual', 'copy'].forEach(k => {
    check('stap ' + k + ' levert twee kolommen', kolommen[k].tweekolom, true);
    check('  met bedienbare keuzes links', kolommen[k].linksBedienbaar > 0, true);
    check('  en onderbouwing rechts', kolommen[k].rechtsTekst > 0, true);
  });

  /* Stap 1 toont de productdata waar het advies op rust, niet alleen de naam. */
  const productkaart = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    var uit = wizRender_product();
    var R = document.createElement('div'); R.innerHTML = uit.rechts;
    var L = document.createElement('div'); L.innerHTML = uit.links;
    return {
      usps: R.querySelectorAll('.wiz-usps li').length,
      tegels: L.querySelectorAll('.wiz-tegel').length,
      keuzelijst: L.querySelectorAll('select').length
    };
  }, VULLEN);
  check('de productkaart toont de USPs', productkaart.usps > 0, true);
  check('plaatsing en funnel staan als tegels', productkaart.tegels, 8);
  check('en het product zelf als keuzelijst', productkaart.keuzelijst, 1);

  /* Stap 5: acht keuzes zichtbaar, niet verstopt achter een uitklap. */
  const visueel = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    var uit = wizRender_visual();
    var L = document.createElement('div'); L.innerHTML = uit.links;
    return { zichtbaar: L.querySelectorAll('.wiz-tweeveld select').length };
  }, VULLEN);
  check('stap 5 toont negen visuele keuzes in het zicht', visueel.zichtbaar, 9);

  /* De uitklap draagt nu de extra's, niet het hoofdformulier. Dicht is dicht. */
  const uitklap = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    var tel = function () {
      var uit = wizRender_copy();
      var d = document.createElement('div'); d.innerHTML = uit.links;
      return d.querySelectorAll('input, textarea').length;
    };
    var dicht = tel();
    wizToggleUitklap('copy');
    var open = tel();
    return { dicht, open };
  }, VULLEN);
  check('dichtgeklapt staan alleen de hoofdvelden', uitklap.dicht <= 3, true);
  check('opengeklapt komen de extra velden erbij', uitklap.open > uitklap.dicht, true);

  /* ── Stap 7, 8 en 9 ───────────────────────────────────────────────────── */
  console.log('\n  de blueprint, de concepten en het eindbeeld');

  const uitvoer = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    wizState.data.review.visualDescription = 'Premium bathroom, hands holding the Groom Guard.';
    /* Stap 7 levert sinds de mockup-indeling twee kolommen op in plaats van
       één string. Beide kolommen samen zijn wat de gebruiker ziet. */
    var uit = wizRender_review();
    var d = document.createElement('div');
    d.innerHTML = (typeof uit === 'string') ? uit : ((uit.links || '') + (uit.rechts || ''));
    return {
      /* geen tabel meer, maar groepen met elk een eigen ingang */
      groepen: d.querySelectorAll('.wiz-brief-groep').length,
      ingangen: d.querySelectorAll('.wiz-bp-edit').length,
      tabelrijen: d.querySelectorAll('.wiz-bp-row').length,
      beschrijvingBoven: !!d.querySelector('.wiz-vizdesc'),
      velden: d.querySelectorAll('input, textarea').length
    };
  }, VULLEN);
  check('de blueprint is geen tabel meer', uitvoer.tabelrijen, 0);
  check('maar zes groepen, één per stap', uitvoer.groepen, 6);
  check('elk met een eigen ingang om terug te springen', uitvoer.ingangen, 6);
  check('en de beschrijving van het beeld staat er', uitvoer.beschrijvingBoven, true);

  /* De hoofdknop heet naar wat er gebeurt. "Continue" op de stap waar drie
     beelden gemaakt worden verzwijgt precies het enige wat je moet weten. */
  const knoppen = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    wizOpen();
    var lees = function (k) {
      wizState.current = k; wizRenderFooter();
      var b = document.getElementById('wiz-next');
      return b ? b.textContent.trim() : '(geen knop)';
    };
    return { product: lees('product'), review: lees('review'),
             concepts: lees('concepts'), generate: lees('generate') };
  }, VULLEN);
  check('op een gewone stap staat Continue', knoppen.product, 'Continue →');
  check('op de blueprint staat wat er gaat gebeuren', knoppen.review, 'Generate concepts →');
  check('op de concepten ook', knoppen.concepts, 'Generate final ad →');
  check('en op het eindbeeld Save ad', knoppen.generate, 'Save ad →');

  /* Beeld kost geld. Dat mag nooit vanzelf gebeuren, hoe graag de wizard ook
     wil leiden -- de menselijke goedkeuring is de enige rem op uitgaven. */
  const geldrem = await page.evaluate(vullen => {
    wizReset(true);
    eval(vullen);
    var geroepen = [];
    var echt = window.generateImage;
    window.generateImage = function (i) { geroepen.push(i); };
    wizState.data.concepts.list = [
      { headline_nl: 'A', visual_nl: 'x', reasoning_nl: 'r' },
      { headline_nl: 'B', visual_nl: 'y', reasoning_nl: 'r' },
      { headline_nl: 'C', visual_nl: 'z', reasoning_nl: 'r' }
    ];
    /* wizPreview weigert terecht zolang er geen gegenereerde varianten staan;
       zonder dit test dit blok die weigering in plaats van de geldrem. */
    state.lastGenerated = { variations: wizState.data.concepts.list, metadata: wizMetadata() };
    state.generatedImages = {};
    wizState.current = 'concepts';
    wizRender();
    var naRender = geroepen.slice();
    wizPreviewAll();
    var naKlik = geroepen.slice();
    window.generateImage = echt;
    return { naRender, naKlik };
  }, VULLEN);
  check('concepten tekenen genereert uit zichzelf geen beeld', geldrem.naRender, []);
  check('pas na de klik worden de drie previews gemaakt', geldrem.naKlik, [0, 1, 2]);

  const concepten = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    wizState.data.concepts.list = [
      { headline_nl: 'Glad zonder gedoe', visual_nl: 'split frame', reasoning_nl: 'werkt omdat' },
      { headline_nl: 'Tweede', visual_nl: 'x', reasoning_nl: 'y' }
    ];
    var d = document.createElement('div');
    d.innerHTML = wizRender_concepts();
    var kaarten = d.querySelectorAll('.wiz-concept');
    wizPickConcept(1);
    var d2 = document.createElement('div');
    d2.innerHTML = wizRender_concepts();
    return {
      kaarten: kaarten.length,
      /* de hele kaart is de knop, niet een knopje erin */
      kaartIsKnop: kaarten[0] ? kaarten[0].tagName : '',
      gekozen: d2.querySelectorAll('.wiz-concept.on').length,
      gekozenIndex: wizState.data.concepts.selected
    };
  }, VULLEN);
  check('elk concept is een kaart', concepten.kaarten, 2);
  check('en de hele kaart is de keuzeknop', concepten.kaartIsKnop, 'BUTTON');
  check('kiezen markeert er precies een', concepten.gekozen, 1);
  check('en onthoudt welke', concepten.gekozenIndex, 1);

  /* De knop op stap 8 maakt het eindbeeld van een van de drie concepten. Zonder
     keuze zou de wizard moeten raden welk; dan hoort hij te blijven staan. */
  const doorlopen = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    /* Stap 7 moet af zijn, anders houdt de gewone poort je al tegen en zegt
       deze test niets over de conceptkeuze zelf. */
    wizState.data.review.visualDescription = 'Premium bathroom, hands holding the Groom Guard.';
    wizState.done.review = true;
    wizState.data.concepts.list = [{ headline_nl: 'A', visual_nl: 'x' }];
    wizState.current = 'concepts';
    /* De algemene poort houdt je hier ook tegen, maar met "Finish the earlier
       steps first" -- terwijl de eerdere stappen af zijn. Daarom kijken we naar
       wat er gezegd wordt, en of stap 8 niet ten onrechte op af gaat. */
    var gezegd = [];
    var echteToast = window.toast;
    window.toast = function (t) { gezegd.push(String(t)); };
    wizNaarEindbeeld();
    var zonderKeuze = wizState.current;
    var zonderKeuzeAf = !!wizState.done.concepts;
    var melding = gezegd[0] || '';
    window.toast = echteToast;
    wizPickConcept(0);
    wizNaarEindbeeld();
    return { zonderKeuze: zonderKeuze, zonderKeuzeAf: zonderKeuzeAf,
             melding: melding, metKeuze: wizState.current };
  }, VULLEN);
  check('zonder gekozen concept blijf je op stap 8', doorlopen.zonderKeuze, 'concepts');
  check('en de stap gaat niet ten onrechte op af', doorlopen.zonderKeuzeAf, false);
  check('en je hoort waarom: kies een concept', /pick a concept/i.test(doorlopen.melding), true);
  check('met een keuze ga je door naar het eindbeeld', doorlopen.metKeuze, 'generate');

  /* Stap 9 gebruikte een prompt()-venster. Dat blokkeert de pagina en is niet
     te bedienen vanuit een test; het hoort een paneel in het scherm te zijn. */
  const bijstellen = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    wizState.data.concepts.list = [{ headline_nl: 'A', visual_nl: 'x' }];
    wizState.data.concepts.selected = 0;
    /* Stap 9 werkt met drie takes van het gekozen concept. Die takes hangen
       achter de conceptenlijst in state.lastGenerated, dus die moet er zijn
       voordat er iets te tonen valt. */
    state.lastGenerated = { variations: [{ headline_nl: 'A' }], metadata: {} };
    var takes = wizTakeIndexen();
    /* Zo bewaart de app een beeld echt: een versielijst met een index. Deze
       fixture stond hier als losse string, en juist daardoor bleef een fout in
       het terugzetten van beelden onopgemerkt. */
    var NEPBEELD = { versions: [{ b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
                                  model: 'gpt-image-1', size: '1024x1024', quality: 'high' }], currentIndex: 0 };
    var nep = function () { return JSON.parse(JSON.stringify(NEPBEELD)); };
    state.generatedImages = {}; takes.forEach(function (i) { state.generatedImages[i] = nep(); });
    var telPaneel = function () {
      var uit = wizRender_generate();
      var d = document.createElement('div');
      d.innerHTML = (typeof uit === 'string') ? uit : ((uit.links || '') + (uit.rechts || ''));
      return { paneel: d.querySelectorAll('#wiz-tweak-in').length,
               groepen: d.querySelectorAll('.wiz-tweakgroep').length,
               knoppen: d.querySelectorAll('.wiz-tweaklijst .wiz-tweakknop').length,
               /* De takes horen bóven de bewerkacties te staan: eerst kijken
                  waar je uit kiest, dan wat je ermee doet. */
               beeldEerst: (function () {
                 var h = (typeof uit === 'string') ? uit : ((uit.links || '') + (uit.rechts || ''));
                 var b = h.indexOf('gen-image-'), a = h.indexOf('wiz-tweaklijst');
                 return b > -1 && a > -1 && b < a;
               })() };
    };
    var dicht = telPaneel();
    wizOpenTweak('headline');
    var open = telPaneel();
    wizOpenTweak(null);
    /* Zonder beeld hebben de acties niets om aan te werken; dan hoort er een
       uitleg te staan in plaats van knoppen die niets doen. */
    state.generatedImages = {};
    var zonderBeeld = telPaneel();
    takes.forEach(function (i) { state.generatedImages[i] = nep(); });
    /* Drie takes, en geen twee keer dezelfde plek in de beeldpijplijn -- dan
       zouden ze elkaars beeld overschrijven. */
    var uniek = takes.filter(function (v, n) { return takes.indexOf(v) === n; });
    var d3 = document.createElement('div');
    var uit3 = wizRender_generate();
    d3.innerHTML = (typeof uit3 === 'string') ? uit3 : ((uit3.links || '') + (uit3.rechts || ''));
    return { dicht, open, zonderBeeld,
             aantalTakes: takes.length, uniekeTakes: uniek.length,
             vakken: d3.querySelectorAll('[id^="gen-image-"]').length,
             kiesknoppen: d3.querySelectorAll('.wiz-take-kies').length,
             gekozenIsTake: takes.indexOf(wizHuidigeTake()) > -1,
             prompt: String(window.wizTweak).indexOf('prompt(') > -1 };
  }, VULLEN);
  check('stap 9 maakt drie takes van het gekozen concept', bijstellen.aantalTakes, 3);
  check('elk met een eigen plek in de beeldpijplijn', bijstellen.uniekeTakes, 3);
  check('en er staan drie beeldvakken op het scherm', bijstellen.vakken, 3);
  check('met per take een knop om hem te kiezen', bijstellen.kiesknoppen, 3);
  /* Er staat er altijd een gekozen: anders zou opslaan of bijstellen moeten
     raden welke van de drie je bedoelt. */
  check('er staat er altijd een gekozen', bijstellen.gekozenIsTake, true);
  check('de bewerkacties staan gegroepeerd', bijstellen.dicht.groepen, 4);
  check('met alle negen acties', bijstellen.dicht.knoppen, 9);
  check('dicht staat er geen invoerpaneel', bijstellen.dicht.paneel, 0);
  check('een actie kiezen opent het paneel in het scherm', bijstellen.open.paneel, 1);
  check('en er komt geen prompt-venster meer aan te pas', bijstellen.prompt, false);
  check('zonder gegenereerd beeld staan er geen bewerkacties', bijstellen.zonderBeeld.knoppen, 0);
  /* Stap 9 stond als twee kolommen: beeld links, acties rechts. Met drie takes
     werkt dat niet meer -- naast Rory's kolom is het paneel dan te smal en
     krijg je drie duimnagels, precies wat vergelijken onmogelijk maakt. Dus
     één kolom: de takes boven, wat je ermee doet eronder. */
  check('de takes staan boven de bewerkacties', bijstellen.dicht.beeldEerst, true);

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
    setMode('copy');
    uit.copyOpen = !document.getElementById('classic-form').classList.contains('collapsed');
    uit.copyKnop = !!document.getElementById('generate-btn');
    uit.copyBron = !!document.getElementById('source-ad-dropzone');
    setMode('iterate');
    uit.iterateOpen = !document.getElementById('classic-form').classList.contains('collapsed');
    uit.iterateVelden = !!document.getElementById('iterate-fields');
    setMode('scratch');
    uit.terugIngeklapt = document.getElementById('classic-form').classList.contains('collapsed');
    /* In Statics is het formulier niet meer te bereiken -- ook niet met de
       hand. Twee keer dezelfde beslissingen op één scherm lopen gegarandeerd
       uit elkaar, en de negen stappen zijn nu de weg. */
    toggleClassicForm();
    uit.blijftDichtInStatics = document.getElementById('classic-form').classList.contains('collapsed');
    return uit;
  });
  /* Het werkblad van Statics bestond uit vier blokken oude route met de wizard
     eronder. Wat telt is wat je tegenkomt, niet wat er ergens in de DOM staat:
     in Statics is er niets anders dan de wizard. */
  const eersteIndruk = await page.evaluate(() => {
    switchMainTab('generator');
    setMode('scratch');
    var naam = function (e) { return e.id || e.className.split(' ')[0]; };
    /* Het werkblad is de middenkolom: de studio-opbouw leegt .form-grid en
       verdeelt alles over drie kolommen. Meten in .form-grid zou nul opleveren
       en dus nooit iets aantonen. */
    var werkblad = document.querySelector('.ws8-center') || document.querySelector('.form-grid');
    return [].slice.call(werkblad.children)
      .filter(function (e) { return e.offsetParent !== null; })
      .map(naam)
      /* de kolomkop "Werkblad" is een opschrift, geen blok waar je iets doet */
      .filter(function (n) { return n !== 'ws8-zone-lbl'; });
  });
  /* Het hele werkblad, niet alleen het eerste blok. Wie hier iets aan toevoegt
     moet dat bewust doen. */
  check('in Statics is het werkblad de wizard, meer niet',
        eersteIndruk, ['wiz-inline']);

  /* Statics IS de wizard. Je komt binnen op stap 1 en het scherm is van hem:
     Configuratie links en Resultaat rechts tonen dezelfde beslissingen nog
     een keer, naast een scherm dat je één vraag tegelijk stelt. */
  const volScherm = await page.evaluate(() => {
    wizReset(true);
    switchMainTab('library');
    switchMainTab('generator');
    var zicht = function (sel) {
      var e = document.querySelector(sel);
      return !!(e && e.offsetParent !== null);
    };
    var meet = function () {
      return { wizard: zicht('#wiz-inline'), configuratie: zicht('.ws8-left'),
               resultaat: zicht('.ws8-right'), balk: zicht('.ws8-header'),
               formulier: zicht('#brain-dump-card'), stap: wizState.current };
    };
    var binnen = meet();
    /* Exit verlaat Statics; er is niets meer om naar terug te vallen. */
    wizClose();
    var naExit = { generatorOpen: zicht('#wiz-inline'),
                   tab: document.getElementById('main-tab-dashboard')
                        ? document.getElementById('main-tab-dashboard').style.display : '(ontbreekt)' };
    switchMainTab('generator');
    var terug = meet();
    return { binnen: binnen, naExit: naExit, terug: terug };
  });
  check('Statics opent meteen in de wizard', volScherm.binnen.wizard, true);
  check('en begint bij stap 1', volScherm.binnen.stap, 'product');
  check('de configuratiekolom is weg', volScherm.binnen.configuratie, false);
  check('de resultaatkolom ook', volScherm.binnen.resultaat, false);
  check('en de chipbalk erboven', volScherm.binnen.balk, false);
  check('en het klassieke formulier komt er niet in voor', volScherm.binnen.formulier, false);
  check('Exit verlaat Statics', volScherm.naExit.generatorOpen, false);
  check('en zet je op het dashboard', volScherm.naExit.tab, 'block');
  check('terugkomen op Statics zet je weer in de wizard', volScherm.terug.wizard, true);

  /* De stappenbalk is de enige plek die zegt waar je bent en wat er nog komt.
     Een stap die buiten beeld valt doet dat niet: op één regel met de naam
     ernaast paste de negende er niet meer bij. */
  const balk = await page.evaluate(() => {
    switchMainTab('generator');
    wizOpen();
    var vak = document.getElementById('wiz-progress').getBoundingClientRect();
    var pillen = [].slice.call(document.querySelectorAll('.wiz-step'));
    return { totaal: pillen.length,
             binnenBeeld: pillen.filter(function (b) {
               return b.getBoundingClientRect().right <= vak.right + 1;
             }).length };
  });
  check('alle negen stappen staan in beeld', balk.binnenBeeld, balk.totaal);
  check('en dat zijn er ook echt negen', balk.totaal, 9);

  /* Of de namen erbij passen is een meting, geen breekpunt: op een breed scherm
     horen ze er te staan, op een smal scherm horen de nummers te blijven in
     plaats van dat er stappen wegscrollen. */
  const meetBalk = async () => page.evaluate(() => {
    wizOpen();
    var el = document.getElementById('wiz-progress');
    var vak = el.getBoundingClientRect();
    var pillen = [].slice.call(document.querySelectorAll('.wiz-step'));
    var naam = document.querySelector('.wiz-step:not(.on) .wiz-step-label');
    return { inBeeld: pillen.filter(function (b) {
               return b.getBoundingClientRect().right <= vak.right + 1;
             }).length,
             namen: naam ? getComputedStyle(naam).display !== 'none' : null };
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(300);
  const breed = await meetBalk();
  await page.setViewportSize({ width: 1150, height: 1000 });
  await page.waitForTimeout(300);
  const smal = await meetBalk();
  await page.setViewportSize({ width: 1280, height: 720 });
  check('op een breed scherm staan de negen namen erbij', breed.namen, true);
  check('en alle negen in beeld', breed.inBeeld, 9);
  check('op een smal scherm vervallen de namen', smal.namen, false);
  check('maar de negen stappen blijven in beeld', smal.inBeeld, 9);

  /* ── Drie takes zijn drie uitvoeringen, geen drie pogingen ───────────────
   *
   * Dit ging fout en het was niet te zien aan de code: de wizard kopieerde het
   * concept drie keer, dus ging dezelfde prompt drie keer naar het beeldmodel.
   * Resultaat: drie keer dezelfde foto met andere ruis, en niets te kiezen. */
  console.log('\n  drie takes van een concept verschillen echt');

  const takeBrief = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    wizSet('strategy', 'theme', 'Safety & Confidence', 'user');
    wizSet('strategy', 'proof', 'SkinSafe ceramic blades', 'rory');
    wizState.data.concepts.list = [{ headline_nl: 'Zo trim je gevoelige zones', visual_nl: 'macro van de kop' }];
    wizState.data.concepts.selected = 0;
    var t = wizBuildTakeBrief();
    return {
      /* wat vast staat hoort er letterlijk in te staan, anders herinterpreteert
         het model het concept en zijn het drie concepten in plaats van drie
         uitvoeringen */
      persona: /Persona:/.test(t),
      hoek: /Safety & Confidence/.test(t),
      boodschap: /Core message:/.test(t),
      bewijs: /SkinSafe ceramic blades/.test(t),
      /* en wat moet verschillen, moet er even hard in staan */
      headlineAnders: /different wording/.test(t) && /different way of\s+communicating/.test(t.replace(/\n/g, ' ')),
      beeldAnders: /different scene/.test(t),
      geenClaims: /Do not add claims/.test(t),
      waarschuwing: /Three macro shots/.test(t),
      aantal: /exactly 3 variations/.test(t)
    };
  }, VULLEN);
  check('de briefing zet de persona vast', takeBrief.persona, true);
  check('de invalshoek ook', takeBrief.hoek, true);
  check('en de kernboodschap', takeBrief.boodschap, true);
  check('het bewijs gaat mee', takeBrief.bewijs, true);
  check('hij eist een andere headline en een andere manier van communiceren', takeBrief.headlineAnders, true);
  check('en een andere scene per take', takeBrief.beeldAnders, true);
  check('zonder nieuwe claims te verzinnen', takeBrief.geenClaims, true);
  check('met de val er expliciet in: drie macro-shots is mislukt', takeBrief.waarschuwing, true);
  check('en precies drie uitvoeringen', takeBrief.aantal, true);

  /* Wat er met het antwoord gebeurt. Het model is hier nagemaakt -- wat Rory
     terugstuurt is niet te testen, wat de wizard ermee doet wel. */
  const takeUitvoering = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    switchMainTab('generator');
    wizState.data.concepts.list = [{ headline_nl: 'Concept', visual_nl: 'macro' }];
    wizState.data.concepts.selected = 0;
    state.lastGenerated = { variations: [{ headline_nl: 'Concept', visual_nl: 'macro' }], metadata: {} };
    window.__WG_TEAMSERVER = true;
    /* Een eerder blok kan de wizard op bezig hebben laten staan, en dan stapt
       wizGenerateTakes er meteen weer uit -- dan meet dit blok niets. */
    wizState.busy = false;

    var drie = { content: [{ type: 'text', text: JSON.stringify({ variations: [
      { headline_nl: 'Huidtherapeut: zo trim je gevoelige zones', visual_nl: 'Huidtherapeut kijkt in de camera met het product in haar hand, redactioneel', hook_label_nl: 'Persstory', image_prompt_en: 'a' },
      { headline_nl: 'Wist je dat 37% de rug vergeet?', visual_nl: 'Extreme macro van de huid, geen persoon in beeld', hook_label_nl: 'Vondst', image_prompt_en: 'b' },
      { headline_nl: 'Keramische bladen, geen sneetjes', visual_nl: 'Het product met annotaties en icoontjes bij de bladen', hook_label_nl: 'Voor-na', image_prompt_en: 'c' }
    ] }) }] };

    var echtCall = window.wizCall, echtPreview = window.wizPreview;
    var beeldjes = [];
    window.wizPreview = function (i) { beeldjes.push(i); };
    window.wizCall = function () { return Promise.resolve(drie); };
    wizState.current = 'generate';
    wizGenerateTakes();
    return new Promise(function (klaar) {
      setTimeout(function () {
        var takes = wizState.data.generate.takes || [];
        var vs = takes.map(function (i) { return state.lastGenerated.variations[i] || {}; });
        window.wizCall = echtCall; window.wizPreview = echtPreview;
        klaar({
          aantal: takes.length,
          headlines: vs.map(function (v) { return v.headline_nl; }),
          uniekeHeadlines: vs.map(function (v) { return v.headline_nl; })
            .filter(function (h, n, a) { return a.indexOf(h) === n; }).length,
          uniekeBeelden: vs.map(function (v) { return v.visual_nl; })
            .filter(function (h, n, a) { return a.indexOf(h) === n; }).length,
          beeldjes: beeldjes.length,
          /* en op het scherm moet je het verschil kunnen lezen */
          headlinesOpScherm: document.querySelectorAll('.wiz-take-h').length,
          beeldtekstOpScherm: document.querySelectorAll('.wiz-take-v').length
        });
      }, 60);
    });
  }, VULLEN);
  check('er komen drie takes', takeUitvoering.aantal, 3);
  check('met drie verschillende headlines', takeUitvoering.uniekeHeadlines, 3);
  check('en drie verschillende visuele uitwerkingen', takeUitvoering.uniekeBeelden, 3);
  check('daarna gaan er drie beelden in de maak', takeUitvoering.beeldjes, 3);
  check('de headline van elke take staat op het scherm', takeUitvoering.headlinesOpScherm, 3);
  check('en de uitwerking ernaast', takeUitvoering.beeldtekstOpScherm, 3);

  /* Mislukt de uitwerking, dan hoort er geen enkel beeld te komen. Drie
     identieke beelden zijn hier het slechtste antwoord: je betaalt drie keer en
     kunt nog niets kiezen. */
  const takeMislukt = await page.evaluate(vullen => {
    wizReset(true); eval(vullen);
    switchMainTab('generator');
    wizState.data.concepts.list = [{ headline_nl: 'Concept', visual_nl: 'macro' }];
    wizState.data.concepts.selected = 0;
    state.lastGenerated = { variations: [{ headline_nl: 'Concept' }], metadata: {} };
    window.__WG_TEAMSERVER = true;
    wizState.busy = false;
    var echtCall = window.wizCall, echtPreview = window.wizPreview, echtToast = window.toast;
    var beeldjes = 0, gezegd = [];
    window.wizPreview = function () { beeldjes++; };
    window.toast = function (t) { gezegd.push(String(t)); };
    window.wizCall = function () { return Promise.reject(new Error('model deed niets')); };
    wizState.current = 'generate';
    wizGenerateTakes();
    return new Promise(function (klaar) {
      setTimeout(function () {
        window.wizCall = echtCall; window.wizPreview = echtPreview; window.toast = echtToast;
        klaar({ beeldjes: beeldjes, takes: wizState.data.generate.takes,
                busy: wizState.busy, melding: gezegd.join(' ') });
      }, 60);
    });
  }, VULLEN);
  check('een mislukte uitwerking genereert geen enkel beeld', takeMislukt.beeldjes, 0);
  check('en laat geen halve takes staan', takeMislukt.takes, null);
  check('de wizard blijft niet hangen op bezig', takeMislukt.busy, false);
  check('en je hoort wat er misging', /Could not work out the three takes/.test(takeMislukt.melding), true);

  /* ── Bijstellen vanuit de wizard ─────────────────────────────────────────
   *
   * De bewerkacties roepen dezelfde functie aan als het oude resultatenscherm.
   * Die functie zette een knop op "bezig" die alleen in dát scherm bestaat, dus
   * viel elke bewerking vanuit stap 9 om op een null -- zichtbaar als een rode
   * foutbalk, en er gebeurde niets. Deze lus voert de bewerking echt uit, met
   * een nagemaakt antwoord in plaats van een beeldmodel. */
  console.log('\n  een take bijstellen vanuit de wizard');

  const bijwerken = await page.evaluate(() => {
    wizReset(true);
    switchMainTab('generator');
    wizState.busy = false;
    window.__WG_TEAMSERVER = true;
    wizState.data.concepts.list = [{ headline_nl: 'A', visual_nl: 'x' }];
    wizState.data.concepts.selected = 0;
    state.lastGenerated = { variations: [{ headline_nl: 'A' }], metadata: { placement: 'feed11' } };
    var takes = wizTakeIndexen();
    var vlak = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    state.generatedImages = {};
    takes.forEach(function (i) {
      state.generatedImages[i] = { versions: [{ b64: vlak, mime: 'image/png', model: 'gpt-image-1',
                                                size: '1024x1024', quality: 'high' }], currentIndex: 0 };
    });
    wizState.current = 'generate';
    wizRender();

    var echt = window.fetchJsonWithRetry;
    var geroepen = 0;
    window.fetchJsonWithRetry = function () {
      geroepen++;
      return Promise.resolve({ data: [{ b64_json: vlak }] });
    };
    var fouten = [];
    var opgevangen = function (e) { fouten.push(String((e.reason && e.reason.message) || e.message || e)); };
    window.addEventListener('unhandledrejection', opgevangen);
    window.addEventListener('error', opgevangen);

    var sel = wizHuidigeTake();
    wizOpenTweak('headline');
    document.getElementById('wiz-tweak-in').value = 'Maak hem korter';
    /* De toestand waarin het misging: het beeld staat in de state, maar de kaart
       eromheen staat niet in het scherm -- en dus ook niet de knop waar de
       bewerkfunctie zonder omhaal op schreef. Dat gebeurt zodra er hertekend is
       voordat de beelden er weer in stonden.

       Dit moet ná wizOpenTweak: die hertekent, en dan zet de wizard de bewaarde
       beelden netjes terug. Ervoor leegmaken bewijst dus niets -- daar liep mijn
       eerste poging op stuk. */
    var vak = document.getElementById('gen-image-' + sel);
    if (vak) vak.innerHTML = '';
    wizTweak();

    return new Promise(function (klaar) {
      setTimeout(function () {
        window.fetchJsonWithRetry = echt;
        window.removeEventListener('unhandledrejection', opgevangen);
        window.removeEventListener('error', opgevangen);
        var st = state.generatedImages[sel] || {};
        klaar({ fouten: fouten, geroepen: geroepen,
                versies: (st.versions || []).length,
                staatOpNieuwste: st.currentIndex === (st.versions || []).length - 1 });
      }, 300);
    });
  });
  check('bijstellen valt niet om zonder kaart in beeld', bijwerken.fouten, []);
  check('de bewerking gaat echt de deur uit', bijwerken.geroepen, 1);
  check('en levert een tweede versie op', bijwerken.versies, 2);
  check('waarbij je naar de nieuwste kijkt', bijwerken.staatOpNieuwste, true);

  /* Elke hertekening bouwt de beeldvakken leeg opnieuw op. Zet de wizard de
     bewaarde beelden er dan niet goed in terug, dan verdwijnen bij het kiezen
     van een andere take alle drie de beelden -- en dan valt er niets meer te
     kiezen, want je ziet niet meer waar je uit koos. */
  const beeldBlijft = await page.evaluate(() => {
    wizReset(true);
    switchMainTab('generator');
    wizState.data.concepts.list = [{ headline_nl: 'A', visual_nl: 'x' }];
    wizState.data.concepts.selected = 0;
    state.lastGenerated = { variations: [{ headline_nl: 'A', image_prompt_en: 'x' }],
                            metadata: { placement: 'feed11' } };
    var takes = wizTakeIndexen();
    var beeld = { versions: [{ b64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
                              model: 'gpt-image-1', size: '1024x1024', quality: 'high' }], currentIndex: 0 };
    state.generatedImages = {};
    takes.forEach(function (i) { state.generatedImages[i] = JSON.parse(JSON.stringify(beeld)); });
    wizState.current = 'generate';
    wizRender();
    /* Tellen dat er een img-tag staat zegt niets: een kapotte bron is ook een
       img. Het moet het beeld zijn dat we erin zetten. */
    var tel = function () {
      return [].slice.call(document.querySelectorAll('#wiz-body [id^="gen-image-"] img'))
        .filter(function (b) { return b.getAttribute('src') === 'data:image/png;base64,' + beeld.versions[0].b64; })
        .length;
    };
    var voor = tel();
    wizPickTake(takes[1]);
    return { voor: voor, na: tel(), gekozen: wizHuidigeTake() === takes[1] };
  });
  check('na het genereren staan er drie beelden op het scherm', beeldBlijft.voor, 3);
  check('een andere take kiezen laat alle drie staan', beeldBlijft.na, 3);
  check('en de keuze verschuift echt', beeldBlijft.gekozen, true);

  /* Het einde van de negen stappen. Dit ging naar het oude resultatenscherm in
     de rechterkolom; die kolom is er niet meer, dus de ad hoort naar de
     bibliotheek te gaan en jij hoort mee te gaan om te zien dat hij er staat. */
  const overdracht = await page.evaluate(async () => {
    wizReset(true);
    switchMainTab('generator');
    wizState.data.concepts.list = [{ headline_nl: 'Glad zonder gedoe', visual_nl: 'x' }];
    wizState.data.concepts.selected = 0;
    state.lastGenerated = { variations: [{ headline_nl: 'Glad zonder gedoe' }],
                            metadata: { product: 'Groom Guard' } };
    /* De drie takes maken en de tweede kiezen: opslaan hoort de gekozen take te
       bewaren, niet het concept en niet de eerste die er staat. */
    var takes = wizTakeIndexen();
    wizPickTake(takes[1]);
    /* Met een beeld erbij, anders vraagt het opslaan om bevestiging en dat
       venster beantwoordt niemand in een test. */
    state.generatedImages = {};
    state.generatedImages[takes[1]] = { versions: [{ b64: '', mime: 'image/png' }], currentIndex: 0 };
    var voor = (state.library || []).length;
    await wizHandOff();
    var lib = document.getElementById('main-tab-library');
    return { erbij: (state.library || []).length - voor,
             naarBibliotheek: !!lib && lib.style.display !== 'none',
             stapAf: !!wizState.done.generate };
  });
  check('opslaan zet de ad in de bibliotheek', overdracht.erbij, 1);
  check('en brengt je erheen', overdracht.naarBibliotheek, true);
  check('en zet stap 9 op af', overdracht.stapAf, true);

  check('in Statics staat het oude formulier ingeklapt', oud.scratchIngeklapt, true);
  check('in Kopieer ad staat het oude formulier open', oud.copyOpen, true);
  check('met de genereer-knop erin', oud.copyKnop, true);
  check('en de bron-ad dropzone', oud.copyBron, true);
  check('in Itereren staat het ook open', oud.iterateOpen, true);
  check('met de iteratie-velden', oud.iterateVelden, true);
  check('terug naar Statics klapt het weer in', oud.terugIngeklapt, true);
  check('en in Statics is het niet te openen, ook niet met de hand', oud.blijftDichtInStatics, true);

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
  /* ── Drie concepten blijven drie concepten ───────────────────────────── */
  console.log('\n  het reserveren van takes vervuilt de conceptenlijst niet');

  const zes = await page.evaluate(vullen => {
    eval(vullen);
    /* Precies de toestand uit de melding: drie concepten uitgewerkt, er een
       gekozen, en dan naar stap 9 waar plekken voor de takes gereserveerd
       worden. De conceptenlijst hoort daar niets van te merken. */
    var vars = [
      { headline_nl: 'Geen sneetjes. Ook daar niet.', visual_nl: 'macro' },
      { headline_nl: '7000 RPM. Nul sneetjes.', visual_nl: 'hero' },
      { headline_nl: 'Het blad dat je huid niet pakt.', visual_nl: 'standaard' }
    ];
    /* Via de echte weg: wizGenerateConcepts zet beide lijsten, en de fout zat
       precies in het feit dat het er een was. De lijst hier zelf neerzetten zou
       de regel die stukging niet eens aanraken. */
    window.__WG_TEAMSERVER = true;
    var echtCall = window.wizCall, echtPrev = window.wizPreview;
    window.wizPreview = function () {};
    window.wizCall = function () {
      return Promise.resolve({ content: [{ type: 'text',
        text: JSON.stringify({ variations: vars }) }] });
    };
    wizState.busy = false;
    wizGenerateConcepts();
    return new Promise(function (klaar) {
      setTimeout(function () {
        window.wizCall = echtCall; window.wizPreview = echtPrev;
        window.__WG_TEAMSERVER = false;
        wizState.data.concepts.selected = 0;
        wizState.data.generate.takes = null;

        var voor = wizState.data.concepts.list.length;
        var idx = wizTakeIndexen();
        var na = wizState.data.concepts.list.length;

        /* En op het scherm ook: drie kaarten, niet zes. */
        wizState.current = 'concepts';
        var d = document.createElement('div');
        d.innerHTML = wizRender_concepts();
        klaar({ voor: voor, na: na, gereserveerd: idx.length,
                kaarten: d.querySelectorAll('.wiz-concept').length,
                koppen: [].slice.call(d.querySelectorAll('.wiz-concept-h')).map(function (e) { return e.textContent; }),
                variaties: state.lastGenerated.variations.length });
      }, 80);
    });
  }, VULLEN);
  check('er waren drie concepten', zes.voor, 3);
  check('er worden drie plekken gereserveerd', zes.gereserveerd, 3);
  check('en het blijven drie concepten', zes.na, 3);
  check('op het scherm staan er ook drie', zes.kaarten, 3);
  /* Het waren drie kopieen van het gekozen concept die erbij kwamen: dat is
     hoe je het herkent als het terugkomt. */
  check('en niet drie keer dezelfde kop',
        zes.koppen.filter(function (k) { return k === 'Geen sneetjes. Ook daar niet.'; }).length, 1);
  check('de plekken staan wel achter de variatielijst', zes.variaties, 6);

  /* ── Het einde is één vraag ──────────────────────────────────────────── */
  console.log('\n  stap 9: één knop, drie kaarten, kiezen');

  const eind = await page.evaluate(vullen => {
    eval(vullen);
    var vars = [{ headline_nl: 'Geen sneetjes.', visual_nl: 'macro' }];
    wizState.data.concepts.list = vars.slice();
    state.lastGenerated = { variations: vars, metadata: {} };
    wizState.data.concepts.selected = 0;
    wizState.data.generate.takes = null;
    state.generatedImages = {};
    wizState.busy = false;
    /* Ook de bezig-vlaggen van de beeldgenerator: een eerder blok in deze
       pagina kan er een hebben laten staan, en dan meet je die in plaats van
       wat deze test bedoelt. */
    Object.keys(wizBeeldBezig).forEach(function (k) { delete wizBeeldBezig[k]; });

    var d = document.createElement('div');
    d.innerHTML = wizRender_generate();
    var start = {
      knoppen: d.querySelectorAll('button').length,
      tekst: d.textContent.replace(/\s+/g, ' ').trim(),
      /* Geen keuzeblokken meer bovenaan: die stonden er voordat je iets had. */
      passblokken: d.querySelectorAll('.wiz-passknop').length,
      verfijnen: d.querySelectorAll('.wiz-tweakknop').length
    };

    /* Met drie variaties, zonder beeld. */
    wizTakeIndexen();
    var takes = wizState.data.generate.takes;
    state.lastGenerated.variations[takes[0]] = { headline_nl: 'A', cta_nl: 'Bestel nu', visual_nl: 'macro' };
    state.lastGenerated.variations[takes[1]] = { headline_nl: 'B', cta_nl: 'Bekijk hem', visual_nl: 'scene' };
    state.lastGenerated.variations[takes[2]] = { headline_nl: 'C', cta_nl: 'Probeer 100 dagen', visual_nl: 'labels' };
    var d2 = document.createElement('div');
    d2.innerHTML = wizRender_generate();
    var zonderBeeld = {
      kaarten: d2.querySelectorAll('.wiz-take').length,
      zegtWaarom: [].slice.call(d2.querySelectorAll('.wiz-take-leeg')).map(function (e) { return e.textContent; }),
      perKaartOpnieuw: d2.querySelectorAll('.wiz-take-opnieuwbeeld').length,
      ctas: [].slice.call(d2.querySelectorAll('.wiz-take-cta')).map(function (e) { return e.textContent; }),
      /* Verfijnen kan nog niet: er is niets om te verfijnen. */
      verfijnen: d2.querySelectorAll('.wiz-tweakknop').length
    };

    /* Met beeld en een gekozen variatie. */
    state.generatedImages[takes[0]] = { versions: ['x'], currentIndex: 0 };
    wizState.data.generate.selectedTake = takes[0];
    var d3 = document.createElement('div');
    d3.innerHTML = wizRender_generate();
    var metBeeld = {
      verfijnen: d3.querySelectorAll('.wiz-tweakknop').length > 0,
      geenLegeMelding: d3.querySelectorAll('.wiz-take-leeg').length,
      andereManier: /vary only the picture|vary the headline as well/.test(d3.textContent)
    };
    return { start: start, zonderBeeld: zonderBeeld, metBeeld: metBeeld };
  }, VULLEN);
  /* Voor je begint is er één knop en verder niets: geen passkeuze, geen
     verfijnrij, geen uitleg waarom je nog niet kunt verfijnen. */
  check('voor je begint staat er één knop', eind.start.knoppen, 1);
  check('en die zegt wat hij doet', /Generate 3 variations/.test(eind.start.tekst), true);
  check('geen keuzeblokken voor de pass', eind.start.passblokken, 0);
  check('en geen verfijnknoppen zonder beeld', eind.start.verfijnen, 0);

  check('daarna staan er drie variaties', eind.zonderBeeld.kaarten, 3);
  /* Een grijs vlak zonder woorden liet je raden of je moest wachten. */
  check('een kaart zonder beeld zegt dat ook',
        eind.zonderBeeld.zegtWaarom, ['No image yet', 'No image yet', 'No image yet']);
  check('met een knop om dat beeld alsnog te maken', eind.zonderBeeld.perKaartOpnieuw, 3);
  /* De call to action mag meeveranderen met de headline. */
  check('en elke variatie draagt zijn eigen call to action',
        eind.zonderBeeld.ctas, ['Bestel nu', 'Bekijk hem', 'Probeer 100 dagen']);
  check('verfijnen kan nog steeds niet', eind.zonderBeeld.verfijnen, 0);

  check('met beeld en een keuze verschijnt het verfijnen', eind.metBeeld.verfijnen, true);
  check('en de lege melding is weg bij die kaart', eind.metBeeld.geenLegeMelding, 2);
  check('de andere manier van varieren staat er als regel', eind.metBeeld.andereManier, true);

  /* ── Beweging betekent iets ──────────────────────────────────────────── */
  console.log('\n  de goudlaag: beweging alleen met een reden');

  const goud = await page.evaluate(vullen => {
    eval(vullen);
    wizReset(true);
    wizState.busy = false;
    wizOpen();
    wizGo('product');

    /* 1. De bevestigingspulse: alleen op de zojuist gekozen tegel, en hij
       dooft — na de timer is de klasse weg en draait er niets meer. */
    wizPick('product', 'placement', 'stories');
    var direct = document.querySelector('.wiz-tegel.on.net');
    var directAnim = direct ? getComputedStyle(direct).animationName : '';

    return new Promise(function (klaar) {
      setTimeout(function () {
        wizRender();
        var later = document.querySelector('.wiz-tegel.on.net');
        var aan = document.querySelector('.wiz-tegel.on');
        var vinkje = aan ? getComputedStyle(aan, '::after').content : '';

        /* 2. Busy draagt zijn klassen: de statusbalk en de avatar weten dat er
           iets draait, en zonder busy weten ze van niets. */
        wizState.busy = true;
        wizRenderRoryBalk();
        if (typeof wizRenderRory === 'function') wizRenderRory();
        var balk = document.getElementById('wiz-rorybalk');
        var bezig = {
          balkKlasse: balk ? balk.classList.contains('bezig') : false,
          lichtlijn: !!(balk && balk.querySelector('.wiz-lichtlijn')),
          avatar: !!document.querySelector('.wiz-rory-avatar.denkt')
        };
        wizState.busy = false;
        wizRenderRoryBalk();
        if (typeof wizRenderRory === 'function') wizRenderRory();
        var rustig = {
          balkKlasse: balk ? balk.classList.contains('bezig') : false,
          lichtlijn: !!(balk && balk.querySelector('.wiz-lichtlijn')),
          avatar: !!document.querySelector('.wiz-rory-avatar.denkt')
        };

        /* 3. De laag is gescoped op de wizard: het klassieke formulier en de
           andere modules dragen geen enkele wizardklasse. */
        var css = [].slice.call(document.styleSheets).filter(function (sh) {
          return /24-wizard-goud/.test(sh.href || ''); })[0];
        var regels = css ? [].slice.call(css.cssRules) : [];
        var selectors = [];
        var loop = function (rs) { [].slice.call(rs).forEach(function (r) {
          if (r.selectorText) selectors.push(r.selectorText);
          if (r.cssRules) loop(r.cssRules);
        }); };
        loop(regels);
        var buitenDeWizard = selectors.filter(function (sel) {
          return sel.split(',').some(function (deel) {
            return !/\.wiz|#wiz|\.iw2|:root/.test(deel);
          });
        });

        /* 4. Reduced motion staat in het bestand als echt blok. */
        var heeftReduced = regels.some(function (r) {
          return r.media && /prefers-reduced-motion/.test(r.media.mediaText);
        });

        klaar({
          directNet: !!direct, directAnim: directAnim,
          laterNet: !!later, vinkje: vinkje,
          bezig: bezig, rustig: rustig,
          buitenDeWizard: buitenDeWizard,
          heeftReduced: heeftReduced,
          bladGeladen: !!css
        });
      }, 1250);
    });
  }, VULLEN);
  check('de goudlaag is geladen', goud.bladGeladen, true);
  check('direct na de klik draagt de gekozen tegel de pulse', goud.directNet, true);
  check('en die pulse is de settle-animatie', /wgSettle/.test(goud.directAnim), true);
  /* Een geselecteerd element dat blijft pulseren zegt na een seconde niets
     meer; de klasse hoort te verdwijnen. */
  check('na ruim een seconde is de pulse weg', goud.laterNet, false);
  check('het vinkje op de gekozen tegel blijft', /✓/.test(goud.vinkje), true);
  check('terwijl er iets draait weet de statusbalk dat', goud.bezig.balkKlasse, true);
  check('met de lichtlijn erin', goud.bezig.lichtlijn, true);
  check('en gloeit de avatar', goud.bezig.avatar, true);
  check('zodra het klaar is, is de balk stil', goud.rustig.balkKlasse, false);
  check('de lichtlijn weg', goud.rustig.lichtlijn, false);
  check('en de avatar rustig', goud.rustig.avatar, false);
  /* Kopieer ad, Itereren en de rest mogen hier niets van merken. */
  check('geen enkele regel reikt buiten de wizard', goud.buitenDeWizard, []);
  check('en reduced motion heeft zijn eigen blok', goud.heeftReduced, true);

  /* ── Geen oordeel over niets ─────────────────────────────────────────── */
  console.log('\n  zonder onderwerp geen richting');

  const leegPaneel = await page.evaluate(vullen => {
    eval(vullen);
    wizReset(true);
    wizState.busy = false;
    wizOpen();
    wizGo('product');
    /* Zonder product: geen advies, en het paneel zegt waarom. */
    var zonder = {
      mag: wizVoorwaardenGehaald('product'),
      tekst: (document.getElementById('wiz-rory') || {}).textContent || '',
      /* En de knoppen die om uitleg vragen bij een aanbeveling staan er niet:
         "waarom raad je dit aan" zonder aanbeveling vraagt om een verklaring
         voor iets wat niet gezegd is. */
      chips: document.querySelectorAll('#wiz-rory .wiz-chip').length,
      /* Maar sparren kan wel. */
      invoer: !!document.getElementById('wiz-chat-in')
    };

    wizSet('product', 'productId', (state.products[0] || {}).id || 'p1', 'user');
    wizRender();
    var met = { mag: wizVoorwaardenGehaald('product') };

    return { zonder: zonder, met: met };
  }, VULLEN);
  check('zonder product mag Rory niets adviseren', leegPaneel.zonder.mag, false);
  check('en het paneel zegt waarom in plaats van een richting te tonen',
        /Pick a product first/.test(leegPaneel.zonder.tekst), true);
  check('geen "waarom raad je dit aan" zonder aanbeveling', leegPaneel.zonder.chips, 0);
  check('sparren kan wel gewoon', leegPaneel.zonder.invoer, true);
  check('met een product mag hij weer', leegPaneel.met.mag, true);

  /* ── Elk gesprek hoort bij zijn stap ─────────────────────────────────── */
  console.log('\n  sparren doe je per stap');

  const gesprek = await page.evaluate(vullen => {
    eval(vullen);
    wizOpen();
    wizGo('product');
    wizChatVan('product').push({ role: 'user', content: 'Hoort dit bij stap een?' });
    wizGo('audience');
    var opAudience = (document.getElementById('wiz-rory') || {}).textContent || '';
    wizChatVan('audience').push({ role: 'user', content: 'En dit bij stap twee?' });
    wizGo('product');
    var opProduct = (document.getElementById('wiz-rory') || {}).textContent || '';

    /* Oude opslag had een platte lijst voor de hele wizard. Die hoort bij het
       laden onder een stap te belanden en niet weggegooid te worden: het is
       werk van iemand. */
    localStorage.setItem(STORAGE_PREFIX + 'wizard_static_v1', JSON.stringify({
      current: 'product', data: wizState.data, source: {}, done: {}, stale: {},
      advice: {}, chat: [{ role: 'user', content: 'uit de oude opslag' }],
      asked: {}, advised: {}, unfolded: {}
    }));
    wizLoad();
    var gemigreerd = (wizChatVan('product') || []).map(function (m) { return m.content; });

    return {
      lengtes: { product: (wizState.chat.product || []).length,
                 audience: (wizState.chat.audience || []).length },
      opAudienceZonderStapEen: opAudience.indexOf('Hoort dit bij stap een?') === -1,
      opAudienceMetKop: /Sparring — Audience/.test(opAudience),
      opProductWelStapEen: opProduct.indexOf('Hoort dit bij stap een?') > -1,
      opProductZonderStapTwee: opProduct.indexOf('En dit bij stap twee?') === -1,
      platteLijstOverleeft: gemigreerd.indexOf('uit de oude opslag') > -1
    };
  }, VULLEN);
  /* Sparren over de hoek is een ander gesprek dan sparren over het format; door
     elkaar maakt allebei onleesbaar. */
  check('stap 2 toont het gesprek van stap 1 niet', gesprek.opAudienceZonderStapEen, true);
  check('met de stap in de kop', gesprek.opAudienceMetKop, true);
  check('en terug op stap 1 staat het er weer', gesprek.opProductWelStapEen, true);
  check('zonder dat van stap 2 erdoorheen', gesprek.opProductZonderStapTwee, true);
  check('een plat gesprek uit oude opslag raakt niet zoek', gesprek.platteLijstOverleeft, true);

  /* ── Bouwen op een bestaande foto ────────────────────────────────────── */
  console.log('\n  een founder-ad begint bij een foto, niet bij het product');

  const basis = await page.evaluate(vullen => {
    eval(vullen);
    wizState.data.visual.basisFoto = null;
    state.basePhotos = {};

    /* Zonder keuze verandert er niets: de wizard bouwt vanaf nul, zoals altijd. */
    var briefZonder = wizBuildBrief(3);
    wizZetBasisFotos([0, 1, 2]);
    var zonder = Object.keys(state.basePhotos).length;

    /* De foto's die de console al heeft, staan er als keuze. */
    var beschikbaar = wizBeschikbareFotos();

    /* Een foto kiezen. */
    wizState.data.visual.basisFoto = {
      b64: 'AAA', mimeType: 'image/png', naam: 'founder in de werkplaats', bron: 'upload'
    };
    wizZetBasisFotos([0, 1, 2]);
    var briefMet = wizBuildBrief(3);
    var d = document.createElement('div');
    d.innerHTML = wizRenderBasisFoto();

    /* En het voorbeeld op stap 5 toont die foto, niet een willekeurige productshot. */
    wizState.current = 'visual';
    var vis = wizRender_visual();
    var rechts = document.createElement('div');
    rechts.innerHTML = (vis && vis.rechts) || '';
    var voorbeeldSrc = (rechts.querySelector('.wiz-vizvoorbeeld img') || {}).getAttribute
      ? rechts.querySelector('.wiz-vizvoorbeeld img').getAttribute('src') : '';

    return {
      zonder: zonder,
      briefZonderVermelding: /gebouwd OP een bestaande foto/.test(briefZonder),
      beschikbaar: beschikbaar.length > 0,
      soorten: beschikbaar.map(function (f) { return f.soort; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
      /* De pijplijn krijgt hem voor elke variatie. */
      klaargezet: Object.keys(state.basePhotos).length,
      eerste: (state.basePhotos[0] || {}).b64,
      /* En de opdracht weet ervan, anders beschrijft hij een andere scene. */
      briefMetVermelding: /gebouwd OP een bestaande foto/.test(briefMet),
      briefNoemtNaam: briefMet.indexOf('founder in de werkplaats') > -1,
      briefVerbiedtAnderePersoon: /Verzin geen andere scene en geen andere persoon/.test(briefMet),
      opScherm: /built on this photo/.test(d.textContent),
      voorbeeldIsDeBasis: /^data:image\/png;base64,AAA/.test(voorbeeldSrc),
      /* Weghalen zet alles terug. */
      naWissen: (function () {
        wizWisBasisFoto();
        wizZetBasisFotos([0, 1, 2]);
        return Object.keys(state.basePhotos).length;
      })()
    };
  }, VULLEN);
  check('zonder keuze bouwt de wizard vanaf nul', basis.zonder, 0);
  check('en de opdracht zegt daar niets over', basis.briefZonderVermelding, false);
  check('de foto\'s die de console al heeft staan er als keuze', basis.beschikbaar, true);
  check('met hun soort erbij', basis.soorten.length > 0, true);
  /* De pijplijn kende basePhotos al; wat ontbrak was een manier om er in de
     wizard een te kiezen. */
  check('een gekozen foto gaat naar elke variatie', basis.klaargezet, 3);
  check('en het is die foto', basis.eerste, 'AAA');
  check('de opdracht weet dat er op een foto gebouwd wordt', basis.briefMetVermelding, true);
  check('en noemt welke', basis.briefNoemtNaam, true);
  /* Anders beschrijft hij een verzonnen mens naast de echte. */
  check('met het verbod om er een andere persoon bij te verzinnen',
        basis.briefVerbiedtAnderePersoon, true);
  check('het scherm zegt wat er met die foto gebeurt', basis.opScherm, true);
  check('en het voorbeeld toont die foto, niet een productshot', basis.voorbeeldIsDeBasis, true);
  check('weghalen zet de generatie terug op vanaf nul', basis.naWissen, 0);

  /* ── Wat straks beoordeeld wordt, staat vooraf in de opdracht ────────── */
  console.log('\n  de acht eigenschappen staan in de opdracht, niet pas in het rapport');

  const vooraf = await page.evaluate(vullen => {
    eval(vullen);
    wizSet('audience', 'awareness', 'product', 'user');
    wizSet('audience', 'sophistication', 's4', 'user');
    var concept = wizBuildBrief(3);
    wizState.data.concepts.list = [{ headline_nl: 'x', visual_nl: 'y' }];
    state.lastGenerated = { variations: wizState.data.concepts.list, metadata: {} };
    wizState.data.concepts.selected = 0;
    var takes = wizBuildTakeBrief();
    var kaart = wizScorekaartBrief();
    return {
      /* Dezelfde acht als waarop de scorekaart straks oordeelt. */
      alleAchtInConcept: WIZ_TRAITS.every(function (t) { return concept.indexOf(t.label) > -1; }),
      alleAchtInTakes: WIZ_TRAITS.every(function (t) { return takes.indexOf(t.label) > -1; }),
      zelfdeAlsScorekaart: WIZ_TRAITS.every(function (t) { return kaart.indexOf(t.label) > -1; }),
      /* En de twee die het vaakst sneuvelden, als voorwaarde. */
      sluitAlleen: /BUILT TO CLOSE ON THIS AD ALONE/.test(concept),
      bewijsZichtbaar: /A pretty close-up of metal proves nothing/.test(concept),
      leestTerug: /read your own concept back as if you were the buyer/.test(concept)
    };
  }, VULLEN);
  check('de conceptopdracht draagt alle acht eigenschappen', vooraf.alleAchtInConcept, true);
  check('de variaties ook', vooraf.alleAchtInTakes, true);
  check('en het zijn dezelfde acht als waarop de scorekaart oordeelt',
        vooraf.zelfdeAlsScorekaart, true);
  /* Precies de twee die in de praktijk rood en geel kleurden. */
  check('sluiten op deze ene ad staat er als voorwaarde', vooraf.sluitAlleen, true);
  check('en zichtbaar bewijs ook', vooraf.bewijsZichtbaar, true);
  check('met de opdracht het eigen werk eerst terug te lezen', vooraf.leestTerug, true);

  /* ── Van oordeel naar daad ───────────────────────────────────────────── */
  console.log('\n  de scorekaart is gereedschap, geen rapport');

  const fixes = await page.evaluate(vullen => {
    eval(vullen);
    var vars = [{ headline_nl: 'Geen sneetjes. Ook daar niet.', visual_nl: 'macro van de kop' }];
    wizState.data.concepts.list = vars.slice();
    state.lastGenerated = { variations: vars, metadata: {} };
    wizState.data.concepts.selected = 0;
    state.generatedImages = { 0: { versions: [{ b64: 'AAA', mime: 'image/png' }], currentIndex: 0 } };
    wizScore.uitslag = {
      verdict: 'Juiste hoek, onafgemaakte uitvoering.', spend: false,
      traits: [{ key: 'close', score: 'broken', why: 'Geen bewijs, geen mechanisme in beeld.' },
               { key: 'tam', score: 'strong', why: 'Brede angst.' }],
      fixes: [{ before: 'Macro met strijklicht', after: 'Macro waarin het haar gepakt wordt en de huid niet' }]
    };
    /* De uitslag hoort bij dit concept: zonder dat toont het scherm terecht
       alleen de knop om alsnog te scoren. */
    wizScore.voorConcept = 0;
    wizScore.toegepast = null;
    wizScore.bezig = false;
    wizState.busy = false;

    var d = document.createElement('div');
    d.innerHTML = wizRenderScorekaart();
    var knop = /wizFixesToepassen\(\)/.test(d.innerHTML);

    /* De knop uitvoeren, met Rory's antwoord onderschept. */
    window.__WG_TEAMSERVER = true;
    var echt = window.wizCall;
    var opdracht = null;
    window.wizCall = function (sys, msgs) {
      opdracht = msgs[0].content;
      return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify({
        headline_nl: 'Het haar wordt gepakt. Je huid niet.',
        visual_nl: 'Macro op strakke huid met een doorgesneden haar erboven, huid ongeschonden',
        supporting_nl: 'Keramische afgeronde snijkant, achter de folie',
        cta_nl: 'Bestel de Flex Guard',
        removed: 'De garantiebadge, die vecht met de claim',
        changed: ['Headline benoemt het mechanisme', 'Beeld toont het bewijs']
      }) }] });
    };
    wizFixesToepassen();
    return new Promise(function (klaar) {
      setTimeout(function () {
        window.wizCall = echt; window.__WG_TEAMSERVER = false;
        var d2 = document.createElement('div');
        d2.innerHTML = wizRenderScorekaart();
        klaar({
          knop: knop,
          /* De opdracht draagt het oordeel en de fixes letterlijk mee. */
          draagtVerdict: /Juiste hoek, onafgemaakte uitvoering/.test(opdracht || ''),
          draagtZwak: /Geen bewijs, geen mechanisme in beeld/.test(opdracht || ''),
          draagtSterkeNiet: !/Brede angst/.test(opdracht || ''),
          draagtFix: /Macro waarin het haar gepakt wordt/.test(opdracht || ''),
          /* En de strategie blijft met rust. */
          strategieMetRust: /Keep the persona, the awareness stage/.test(opdracht || ''),
          /* Wat er nu in het concept staat. */
          conceptKop: (wizState.data.concepts.list[0] || {}).headline_nl,
          variatieKop: (state.lastGenerated.variations[0] || {}).headline_nl,
          copyKop: wizState.data.copy.headline,
          cta: wizState.data.copy.cta,
          weggelaten: wizState.data.copy.removed,
          /* De oude scorekaart is weg: hij ging over de vorige versie. */
          oudeUitslagWeg: wizScore.uitslag === null,
          gedaanOpScherm: /Headline benoemt het mechanisme/.test(d2.textContent),
          beeldVerouderd: /still shows the previous version/.test(d2.textContent)
        });
      }, 80);
    });
  }, VULLEN);
  check('bij fixes staat er een knop om ze door te voeren', fixes.knop, true);
  check('de opdracht draagt het oordeel mee', fixes.draagtVerdict, true);
  check('en wat er zwak of kapot was', fixes.draagtZwak, true);
  /* Wat sterk was hoeft niet gerepareerd te worden, en meesturen zou hem
     uitnodigen daar ook aan te zitten. */
  check('maar niet wat al sterk was', fixes.draagtSterkeNiet, true);
  check('en de fix die Rory zelf schreef', fixes.draagtFix, true);
  check('de strategie blijft expliciet met rust', fixes.strategieMetRust, true);
  check('de headline van het concept is vervangen',
        fixes.conceptKop, 'Het haar wordt gepakt. Je huid niet.');
  /* Ook in de lijst waar de beeldgenerator uit leest, anders maakt hij het
     oude beeld opnieuw. */
  check('ook in de variatielijst', fixes.variatieKop, 'Het haar wordt gepakt. Je huid niet.');
  check('en in het copy-veld', fixes.copyKop, 'Het haar wordt gepakt. Je huid niet.');
  check('de call to action komt mee', fixes.cta, 'Bestel de Flex Guard');
  check('en de weglaatregel ook', fixes.weggelaten, 'De garantiebadge, die vecht met de claim');
  check('de oude score is weg, die ging over de vorige versie', fixes.oudeUitslagWeg, true);
  check('je ziet wat er veranderd is', fixes.gedaanOpScherm, true);
  check('en dat het beeld nog van de vorige versie is', fixes.beeldVerouderd, true);

  /* ── Nick kijkt naar het beeld ───────────────────────────────────────── */
  console.log('\n  een tweede lens op de foto zelf');

  const nick = await page.evaluate(vullen => {
    eval(vullen);
    var vars = [{ headline_nl: 'Geen sneetjes.', visual_nl: 'macro op donker steen', cta_nl: 'Bestel' }];
    wizState.data.concepts.list = vars.slice();
    state.lastGenerated = { variations: vars, metadata: {} };
    wizState.data.concepts.selected = 0;
    wizSet('audience', 'sophistication', 's3', 'user');
    wizSet('strategy', 'differentiation', 'mechanism', 'user');
    wizState.busy = false;
    wizScore.nick = null;
    state.generatedImages = {};

    /* Zonder beeld vraagt hij niets: er is niets om naar te kijken. */
    var gezegd = [];
    var echtToast = window.toast;
    window.toast = function (t) { gezegd.push(String(t)); };
    wizNickHerprompt(0);
    var zonderBeeld = gezegd.join(' | ');
    window.toast = echtToast;

    state.generatedImages = { 0: { versions: [{ b64: 'AAA' }], currentIndex: 0 } };
    window.__WG_TEAMSERVER = true;
    var echt = window.wizCall;
    var sys = null;
    window.wizCall = function (s) {
      sys = s;
      return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify({
        verdict: 'Mooi, maar het bewijst niets.',
        weak: ['Het mechanisme is niet te zien'],
        prompt: 'Macro waarin het haar gepakt wordt en de huid ongeschonden blijft'
      }) }] });
    };
    wizNickHerprompt(0);
    return new Promise(function (klaar) {
      setTimeout(function () {
        window.wizCall = echt; window.__WG_TEAMSERVER = false;
        var d = document.createElement('div');
        d.innerHTML = wizRenderNick(0);
        var bijAndere = wizRenderNick(1);

        /* Uitvoeren zet zijn opdracht klaar als bewerking op dezelfde variatie. */
        var echtEdit = window.applyCombinedEdits;
        var geraakt = null;
        window.applyCombinedEdits = function (i) { geraakt = i; };
        wizNickUitvoeren();
        window.applyCombinedEdits = echtEdit;

        klaar({
          zonderBeeld: zonderBeeld,
          /* Zijn lens, niet die van Rory: het gaat over spenden en over de foto. */
          isNick: /Nick Theriot/.test(sys || '') && /take spend/.test(sys || ''),
          overDeFoto: /judge the picture/.test(sys || ''),
          geenValseClaims: /never in a claim about what the/.test(sys || ''),
          verdictOpScherm: /bewijst niets/.test(d.textContent),
          zwakOpScherm: /mechanisme is niet te zien/.test(d.textContent),
          promptOpScherm: /haar gepakt wordt/.test(d.textContent),
          alleenBijZijnEigen: bijAndere,
          bewerktDezelfde: geraakt,
          klaarNa: wizScore.nick
        });
      }, 80);
    });
  }, VULLEN);
  check('zonder beeld valt er niets te beoordelen', /Generate this picture first/.test(nick.zonderBeeld), true);
  check('het is Nicks lens en die gaat over spenden', nick.isNick, true);
  check('en over de foto, niet over het idee', nick.overDeFoto, true);
  /* Overdrijven mag in de framing, nooit in de claim. */
  check('met de grens aan overdrijven erbij', nick.geenValseClaims, true);
  check('zijn oordeel staat op het scherm', nick.verdictOpScherm, true);
  check('met wat er zwak aan is', nick.zwakOpScherm, true);
  check('en de herschreven beeldopdracht', nick.promptOpScherm, true);
  /* Een oordeel over take 1 onder take 3 is een oordeel over niets. */
  check('en dat staat alleen bij de variatie waar het over gaat', nick.alleenBijZijnEigen, '');
  check('uitvoeren bewerkt diezelfde variatie', nick.bewerktDezelfde, 0);
  check('en daarna is zijn kaart weg', nick.klaarNa, null);

  /* ── De brain dump op stap 1 ─────────────────────────────────────────── */
  console.log('\n  in een keer opschrijven wat je in je hoofd hebt');

  const bdScherm = await page.evaluate(vullen => {
    eval(vullen);
    wizReset(true);
    wizOpen();
    wizGo('product');
    var paneel = document.getElementById('wiz-paneel') || document.querySelector('.wiz-paneel');
    var bd = document.querySelector('.wiz-bd');
    var veld = document.getElementById('wiz-bd-in');
    /* Hij hoort bovenaan te staan: onder de productkeuze is hij verstopt. */
    var keuze = document.querySelector('.wiz-veld');
    var boven = !!(bd && keuze &&
      (bd.compareDocumentPosition(keuze) & Node.DOCUMENT_POSITION_FOLLOWING));

    /* En alleen op stap 1: halverwege de stappen alsnog alles laten overschrijven
       zou de besluiten wissen die je net genomen hebt. Stap 1 moet dan wel af
       zijn, anders houdt de poort je hier en bewijst de test niets. */
    wizSet('product', 'productId', (state.products[0] || {}).id || 'p1', 'user');
    wizSet('product', 'placement', 'feed11', 'user');
    wizSet('product', 'funnel', 'tof', 'user');
    wizSet('audience', 'personaId', (state.personas[0] || {}).id || 'x', 'user');
    wizSet('audience', 'awareness', 'problem', 'user');
    wizSet('audience', 'sophistication', 's3', 'user');
    wizGo('audience');
    var opStap2 = !!document.querySelector('.wiz-bd');

    return { erIsEen: !!bd, typeveld: !!veld, boven: boven, opStap2: opStap2,
             echtOpStap2: wizState.current, heeftPaneel: !!paneel };
  }, VULLEN);
  check('de brain dump staat op stap 1', bdScherm.erIsEen, true);
  check('met een veld om in te typen', bdScherm.typeveld, true);
  check('en hij staat boven de productkeuze, niet eronder', bdScherm.boven, true);
  check('we staan echt op stap 2', bdScherm.echtOpStap2, 'audience');
  check('en daar staat hij er niet', bdScherm.opStap2, false);

  const bdOpdracht = await page.evaluate(vullen => {
    eval(vullen);
    wizBd.tekst = 'Voor de WK, jonge vaders die niet te lang in de douche willen, premium gevoel';
    var b = wizBdBrief();
    return {
      letterlijk: b.indexOf('Voor de WK, jonge vaders') > -1,
      /* De leer hangt eraan, anders bedenkt hij een ad zonder de twee assen. */
      leer: /DE LEER/.test(b),
      /* En de toegestane waarden, anders komt er iets terug wat de wizard niet kent. */
      waarden: /audience\.sophistication: s1/.test(b) && /product\.funnel: tof/.test(b),
      producten: /PRODUCTS \(use the exact id\)/.test(b),
      /* De regel die dit eerlijk houdt. */
      nietsVerzinnen: /Do not fill a field the text gives you no ground for/.test(b),
      vraagtWaarom: /"why"/.test(b),
      vraagtOpen: /"open"/.test(b),
      vraagtConflicten: /"conflicts"/.test(b),
      tijdEerst: /Time context first/.test(b)
    };
  }, VULLEN);
  check('de opdracht draagt je tekst letterlijk mee', bdOpdracht.letterlijk, true);
  check('met de leer eraan', bdOpdracht.leer, true);
  check('en de toegestane waarden erbij', bdOpdracht.waarden, true);
  check('en de productlijst', bdOpdracht.producten, true);
  check('hij mag niets invullen waar de tekst geen grond voor geeft', bdOpdracht.nietsVerzinnen, true);
  check('elk besluit moet een reden meekrijgen', bdOpdracht.vraagtWaarom, true);
  check('en wat hij openliet moet hij melden', bdOpdracht.vraagtOpen, true);
  check('net als tegenstrijdige signalen', bdOpdracht.vraagtConflicten, true);
  check('de tijd-context komt eerst', bdOpdracht.tijdEerst, true);

  const bdToepassen = await page.evaluate(vullen => {
    eval(vullen);
    wizReset(true);
    var pers = (state.personas || [])[0] || { id: 'x' };
    var u = wizBdToepassen({
      decisions: [
        { field: 'product.funnel', value: 'tof', why: 'De WK is een moment, geen doelgroep.' },
        { field: 'audience.awareness', value: 'problem', why: 'Ze voelen het, ze kennen ons niet.' },
        { field: 'audience.sophistication', value: 's3', why: 'Iedereen claimt glad en huidvriendelijk.' },
        { field: 'audience.personaId', value: pers.id, why: 'Jonge vaders staan in de library.' },
        { field: 'strategy.differentiation', value: 'mechanism', why: 'Het enige onbezette pad hier.' },
        /* Een waarde die het veld niet kent, en een veld dat niet bestaat. */
        { field: 'visual.mood', value: 'moody candlelit bathroom', why: 'sfeer' },
        { field: 'strategy.vibe', value: 'stoer', why: 'bestaat niet' }
      ],
      open: [{ field: 'strategy.proof', why: 'Ik weet niet wat dit product kan tonen.' }],
      conflicts: [{ what: 'premium plus 70% korting', resolution: 'kies premium, laat de korting weg' }],
      summary: 'Een mechanisme-ad voor jonge vaders rond de WK.'
    });
    return {
      funnel: wizState.data.product.funnel,
      awareness: wizState.data.audience.awareness,
      sofist: wizState.data.audience.sophistication,
      persona: wizState.data.audience.personaId === pers.id,
      diff: wizState.data.strategy.differentiation,
      /* De onbekende waarde is NIET opgeslagen. */
      mood: wizState.data.visual.mood,
      gezet: u.gezet.length,
      /* De reden hoort mee te reizen van de aanroep naar het scherm. Zonder
         deze regel kan hij onderweg weggegooid worden en merkt niemand het:
         het scherm toont dan een lege kolom die eruitziet als "geen reden". */
      redenen: u.gezet.map(function (b) { return b.waarom; }).filter(Boolean).length,
      eersteReden: (u.gezet[0] || {}).waarom,
      geweigerd: u.geweigerd.map(function (g) { return g.veld; }).sort(),
      open: u.open.map(function (o) { return o.veld; }),
      conflicten: u.conflicten.length,
      /* De stappen die hierdoor compleet zijn, staan af. */
      audienceAf: !!wizState.done.audience,
      /* En de bron is Rory, niet de gebruiker: dit is een voorstel. */
      bron: wizState.source['audience.awareness']
    };
  }, VULLEN);
  check('de funnelfase komt binnen', bdToepassen.funnel, 'tof');
  check('het bewustzijnsniveau ook', bdToepassen.awareness, 'problem');
  check('en het sophistication-stadium', bdToepassen.sofist, 's3');
  check('de persona wordt op id gezet', bdToepassen.persona, true);
  check('en de manier van anders-zijn', bdToepassen.diff, 'mechanism');
  check('een waarde die het veld niet kent wordt niet opgeslagen', bdToepassen.mood, '');
  check('en staat bij de geweigerde, met het onbekende veld',
        bdToepassen.geweigerd, ['strategy.vibe', 'visual.mood']);
  check('vijf besluiten landden', bdToepassen.gezet, 5);
  check('en alle vijf dragen hun reden mee', bdToepassen.redenen, 5);
  check('woordelijk zoals Rory hem gaf', bdToepassen.eersteReden,
        'De WK is een moment, geen doelgroep.');
  check('wat hij openliet staat er apart bij', bdToepassen.open, ['strategy.proof']);
  check('en het conflict ook', bdToepassen.conflicten, 1);
  check('de stap die hierdoor af is, staat af', bdToepassen.audienceAf, true);
  check('alles komt binnen als voorstel van Rory, niet als jouw keuze',
        bdToepassen.bron, 'rory');

  const bdUitslag = await page.evaluate(vullen => {
    eval(vullen);
    wizBd.uitslag = {
      gezet: [{ veld: 'audience.sophistication', waarde: 's3', waarom: 'Iedereen claimt het al.' }],
      geweigerd: [{ veld: 'visual.mood', reden: 'value "moody" is not one this field accepts' }],
      open: [{ veld: 'strategy.proof', waarom: 'Ik weet niet wat dit kan tonen.' }],
      conflicten: [{ what: 'premium plus korting', resolution: 'kies premium' }],
      samenvatting: 'Een mechanisme-ad.'
    };
    var d = document.createElement('div');
    d.innerHTML = wizRenderBrainDump();
    var rij = d.querySelector('.wiz-bd-rij');
    return {
      leesbaarStadium: rij ? rij.querySelector('.wiz-bd-waarde').textContent : '',
      redenErnaast: rij ? rij.querySelector('.wiz-bd-waarom').textContent : '',
      conflictBoven: !!d.querySelector('.wiz-bd-conflict'),
      openBlok: (d.querySelector('.wiz-bd-open') || {}).textContent || '',
      geweigerdZichtbaar: (d.querySelector('.wiz-bd-geweigerd') || {}).textContent || '',
      naarBlueprint: d.innerHTML.indexOf('wizBdNaarBlueprint()') > -1
    };
  }, VULLEN);
  /* Een stadium heet 's3' in de data en dat zegt niemand iets op het scherm. */
  check('het stadium leest als een naam, niet als een sleutel',
        /Stage 3/.test(bdUitslag.leesbaarStadium), true);
  check('de reden staat naast het besluit, niet in een voetnoot',
        /Iedereen claimt het al/.test(bdUitslag.redenErnaast), true);
  check('een conflict staat er als conflict', bdUitslag.conflictBoven, true);
  check('wat hij openliet staat er met de reden',
        /Ik weet niet wat dit kan tonen/.test(bdUitslag.openBlok), true);
  /* Geweigerd is iets anders dan opengelaten: het eerste is een fout, het
     tweede een oordeel, en dat verschil hoort zichtbaar te zijn. */
  check('een geweigerde waarde is apart zichtbaar',
        /not one this field accepts/.test(bdUitslag.geweigerdZichtbaar), true);
  check('en je kunt door naar de blueprint', bdUitslag.naarBlueprint, true);

  /* ── De leer: awareness x sophistication ─────────────────────────────── */
  console.log('\n  de twee assen sturen de opdracht');

  const leer = await page.evaluate(vullen => {
    eval(vullen);
    /* Wat de brief zegt bij een publiek dat het probleem nog niet kent in een
       markt die alles al gehoord heeft. Op allebei die punten geldt hetzelfde:
       het product is niet de opening. */
    wizSet('audience', 'awareness', 'unaware', 'user');
    wizSet('audience', 'sophistication', 's5', 'user');
    var koud = wizBuildBrief(3);

    wizSet('audience', 'awareness', 'most', 'user');
    wizSet('audience', 'sophistication', 's1', 'user');
    var warm = wizBuildBrief(3);

    return {
      koudNietProduct: /Do not lead with the product/.test(koud),
      koudIdentiteit: /Sell the identity/.test(koud),
      warmAanbieding: /The offer is the creative/.test(koud) === false && /The offer is the creative/.test(warm),
      warmDirect: /State the claim plainly/.test(warm),
      /* De wetten staan in beide, want die gelden altijd. */
      eenIdee: /ONE idea, half a second/.test(koud) && /ONE idea, half a second/.test(warm),
      bewijsZichtbaar: /Proof must be VISIBLE/.test(warm),
      uitlijning: /same awareness AND sophistication|BOTH of those stages/.test(koud),
      vanuitMechanisme: /Generate from the mechanism/.test(warm)
    };
  }, VULLEN);
  check('een onwetend publiek krijgt niet het product als opening', leer.koudNietProduct, true);
  check('en een uitgekeken markt krijgt identiteit', leer.koudIdentiteit, true);
  check('een koopklaar publiek krijgt juist de aanbieding', leer.warmAanbieding, true);
  check('en een lege markt een directe claim', leer.warmDirect, true);
  check('de wet van het ene idee staat er altijd in', leer.eenIdee, true);
  check('en dat bewijs zichtbaar moet zijn', leer.bewijsZichtbaar, true);
  check('de uitlijningscontrole staat in de opdracht', leer.uitlijning, true);
  check('en de volgorde: eerst mechanisme, dan toetsen', leer.vanuitMechanisme, true);

  /* ── De harde controles vóór een generatie ───────────────────────────── */
  console.log('\n  wat je zonder model al kunt zien');

  const hard = await page.evaluate(vullen => {
    eval(vullen);
    var sleutels = function () { return wizUitlijning().map(function (g) { return g.key; }); };

    /* Alles ingevuld behalve de dingen die de leer eist. */
    wizSet('audience', 'awareness', 'problem', 'user');
    wizSet('audience', 'sophistication', 's3', 'user');
    wizSet('strategy', 'proof', 'Trustpilot 4.6 op 915 reviews', 'user');
    wizSet('strategy', 'differentiation', 'mechanism', 'user');
    wizSet('copy', 'removed', 'De garantiebadge, want die vecht met de claim', 'user');
    wizSet('strategy', 'mechanism', 'Een flexibele kam die met de huid meebuigt', 'user');
    var metMechanisme = sleutels();
    wizSet('strategy', 'mechanism', '', 'user');
    var zonderMechanisme = sleutels();
    wizSet('strategy', 'mechanism', 'Een flexibele kam die met de huid meebuigt', 'user');

    /* Een markt op stadium 1 vraagt geen mechanisme: daar is een kale claim
       genoeg, en erom vragen zou nodeloos ingewikkeld zijn. */
    wizSet('audience', 'sophistication', 's1', 'user');
    wizSet('strategy', 'mechanism', '', 'user');
    var stadium1 = sleutels();
    wizSet('audience', 'sophistication', 's3', 'user');
    wizSet('strategy', 'mechanism', 'Een flexibele kam', 'user');

    /* De weglaatregel en het bewijs. */
    wizSet('copy', 'removed', '', 'user');
    var zonderWeglaten = sleutels();
    wizSet('copy', 'removed', 'De garantiebadge', 'user');
    wizSet('strategy', 'proof', '', 'user');
    wizSet('copy', 'proof', '', 'user');
    var zonderBewijs = sleutels();
    wizSet('strategy', 'proof', 'Trustpilot 4.6', 'user');

    /* Een headline van tachtig tekens leest niemand op een beeld. */
    var lang = wizUitlijning({ headline_nl: 'Een headline die zo lang is dat niemand hem op een beeld nog leest, want dat doet niemand' })
      .map(function (g) { return g.key; });

    /* Bij unaware mag het product niet in de headline staan. */
    wizSet('audience', 'awareness', 'unaware', 'user');
    var p = wizProduct();
    var metProduct = wizUitlijning({ headline_nl: 'De ' + (p ? p.name : 'x') + ' is er' })
      .map(function (g) { return g.key; });
    var zonderProduct = wizUitlijning({ headline_nl: 'Waarom scheren zo vaak misgaat' })
      .map(function (g) { return g.key; });

    return { metMechanisme, zonderMechanisme, stadium1, zonderWeglaten, zonderBewijs,
             lang, metProduct, zonderProduct };
  }, VULLEN);
  check('met alles ingevuld blijft er niets te melden', hard.metMechanisme, []);
  check('stadium 3 zonder mechanisme is een kale claim in een markt die die niet gelooft',
        hard.zonderMechanisme, ['mechanism']);
  check('op stadium 1 wordt geen mechanisme geeist', hard.stadium1.indexOf('mechanism'), -1);
  check('niets weggelaten wordt opgemerkt', hard.zonderWeglaten, ['removed']);
  check('geen bewijs wordt opgemerkt', hard.zonderBewijs, ['proof']);
  check('een te lange headline wordt gemeten', hard.lang.indexOf('headline') > -1, true);
  check('bij een onwetend publiek is het product in de kop een fout',
        hard.metProduct.indexOf('opening') > -1, true);
  check('en zonder productnaam niet', hard.zonderProduct.indexOf('opening'), -1);

  /* ── De twee passes ──────────────────────────────────────────────────── */
  console.log('\n  visuele pass en hoekpass isoleren iets anders');

  const passes = await page.evaluate(vullen => {
    eval(vullen);
    wizSet('audience', 'awareness', 'problem', 'user');
    wizSet('audience', 'sophistication', 's3', 'user');
    wizSet('copy', 'headline', 'De kam die met je huid meebuigt', 'user');
    wizState.data.concepts.list = [{ headline_nl: 'De kam die met je huid meebuigt', visual_nl: 'macro' }];
    wizState.data.concepts.selected = 0;

    wizZetPass('visueel');
    var v = wizBuildTakeBrief();
    wizZetPass('hoek');
    var h = wizBuildTakeBrief();

    return {
      visueelHoudtWoordenVast: /IDENTICAL in all three — the headline/.test(v),
      visueelNoemtDeHeadline: v.indexOf('De kam die met je huid meebuigt') > -1,
      visueelVraagtGeenNieuweKop: /The headline: same promise, different wording/.test(v) === false,
      hoekVraagtWelNieuweKoppen: /The headline: same promise, different wording/.test(h),
      hoekHoudtBeloftevast: /The promise the ad makes is the same in all three/.test(h),
      beideDeLeer: /DE LEER/.test(v) && /DE LEER/.test(h),
      standaard: (function () { wizReset(true); return wizPass(); })()
    };
  }, VULLEN);
  check('de visuele pass zet de woorden vast', passes.visueelHoudtWoordenVast, true);
  check('en schrijft de goedgekeurde headline letterlijk in de opdracht',
        passes.visueelNoemtDeHeadline, true);
  check('en vraagt juist niet om drie andere koppen', passes.visueelVraagtGeenNieuweKop, true);
  check('de hoekpass vraagt daar wel om', passes.hoekVraagtWelNieuweKoppen, true);
  check('maar houdt de belofte vast', passes.hoekHoudtBeloftevast, true);
  check('beide passes dragen de leer mee', passes.beideDeLeer, true);
  check('en de hoekpass is wat je standaard draait', passes.standaard, 'hoek');

  /* ── De scorekaart ───────────────────────────────────────────────────── */
  console.log('\n  de acht eigenschappen worden echt gevraagd');

  const score = await page.evaluate(vullen => {
    eval(vullen);
    wizSet('audience', 'awareness', 'problem', 'user');
    wizSet('audience', 'sophistication', 's3', 'user');
    wizSet('strategy', 'differentiation', 'mechanism', 'user');
    wizSet('strategy', 'mechanism', 'Een flexibele kam', 'user');
    wizState.data.concepts.list = [{ headline_nl: 'Kort', visual_nl: 'macro' }];
    wizState.data.concepts.selected = 0;
    var b = wizScorekaartBrief();
    return {
      alleAcht: WIZ_TRAITS.every(function (t) { return b.indexOf(t.label) > -1; }),
      aantal: WIZ_TRAITS.length,
      vraagtOordeel: /"verdict"/.test(b) && /"spend":true\|false/.test(b),
      vraagtFixes: /"before"/.test(b) && /"after"/.test(b),
      geenLegePraat: /vague praise helps nobody/.test(b),
      draagtDeAssen: /Sophistication: /.test(b) && /Awareness: /.test(b)
    };
  }, VULLEN);
  check('de scorekaart vraagt alle acht eigenschappen', score.alleAcht, true);
  check('en het zijn er acht', score.aantal, 8);
  check('met een oordeel of hij spendt', score.vraagtOordeel, true);
  check('en met voor-en-na fixes', score.vraagtFixes, true);
  check('en de opdracht verbiedt vage complimenten', score.geenLegePraat, true);
  check('de twee assen staan in de scorekaart', score.draagtDeAssen, true);

  check('elke onclick in de wizard bestaat op window', losseHandlers, []);
  check('de pagina draaide zonder JavaScript-fouten', jsFouten, []);

  await browser.close();
  srv.close();
  console.log(fout ? `\n  ${fout} controle(s) mislukt\n` : '\n  Alle controles geslaagd\n');
  process.exit(fout ? 1 : 0);
})();
