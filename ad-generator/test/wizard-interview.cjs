/* Testlus voor de interviewmodus van de Static Ad Wizard.
 *
 *   node ad-generator/test/wizard-interview.cjs
 *
 * Draait de echte console in Chromium. Er gaat geen enkele aanroep naar een
 * taalmodel: de sleutel staat expliciet uit, zodat de sluitaanroep van Rory
 * overgeslagen wordt en alles wat hier bewezen wordt logica is die ook zonder
 * hem moet kloppen.
 *
 * Waarom deze lus bestaat, en wat er zonder misgaat:
 *
 *   1. Het interview vult DEZELFDE velden als de negen stappen. Gaat dat stuk,
 *      dan ontstaat er een tweede administratie over dezelfde ad en loopt die
 *      onvermijdelijk uit elkaar met de eerste. Dat merk je niet aan het
 *      scherm, alleen aan een ad die niet klopt met wat je koos.
 *   2. Elke vraag heeft een uitweg. Verdwijnt die bij één vraag, dan loopt wie
 *      het antwoord niet weet daar vast -- en dat is precies het publiek waar
 *      deze modus voor is.
 *   3. Exit gooit een gesprek weg en "Open in wizard" niet. Als die twee door
 *      elkaar gaan lopen, verliest iemand werk zonder waarschuwing.
 *   4. De startvraag bepaalt de route. Doet hij dat niet, dan is het een vraag
 *      zonder gevolg, en dat is erger dan geen vraag.
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

/* Stap 1 gevuld en geen sleutel: dan slaat de sluitaanroep zichzelf over en is
   het hele gesprek deterministisch. */
const OPZET = `
  window.__WG_TEAMSERVER = false;
  var el = document.getElementById('anthropic-key'); if (el) el.value = '';
  wizReset(true);
  switchMainTab('generator');
  wizSet('product','productId',(state.products[0]||{}).id||'p1','user');
  wizSet('product','placement','feed11','user');
`;

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const jsFouten = [];
  page.on('pageerror', e => jsFouten.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1400);

  /* ── De ingang ────────────────────────────────────────────────────────── */
  console.log('\n  de ingang op stap 1');

  const ingang = await page.evaluate(opzet => {
    eval(opzet);
    var el = function () { return document.getElementById('iw2-ingang'); };
    var zicht = function () { var e = el(); return !!(e && e.offsetParent); };
    var uit = { opStap1: zicht(), tekst: el() ? el().textContent : '' };
    /* Stap 2 zonder gesprek: geen ingang. Halverwege een gesprek beginnen zou
       betekenen dat twee routes tegelijk aan dezelfde ad werken. */
    wizSet('product', 'funnel', 'tof', 'user');
    wizGo('audience');
    uit.opStap2 = zicht();
    wizGo('product');
    return uit;
  }, OPZET);
  check('op stap 1 staat de interviewknop er', ingang.opStap1, true);
  check('met de uitnodiging erbij', /Interview with Rory/.test(ingang.tekst), true);
  check('en "let Rory build it with you"', /Let Rory build it with you/.test(ingang.tekst), true);
  check('op stap 2 staat hij er niet', ingang.opStap2, false);

  /* ── Het interview neemt het paneel over ──────────────────────────────── */
  console.log('\n  het gesprek neemt het scherm over');

  const start = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    var zicht = function (sel) { var e = document.querySelector(sel); return !!(e && e.offsetParent); };
    return {
      kop: (document.querySelector('#wiz-head .wiz-title') || {}).textContent,
      stappenbalk: zicht('#wiz-progress'),
      exit: (document.getElementById('wiz-exit') || {}).textContent,
      ingang: zicht('#iw2-ingang'),
      opties: document.querySelectorAll('.iw2-optie').length,
      rijen: document.querySelectorAll('.iw2-brij').length,
      typeveld: !!document.getElementById('iw2-in')
    };
  }, OPZET);
  check('de kop noemt het interview en het onderwerp', start.kop, '2. Interview — Starting point Beta');
  check('de stappenbalk is weg', start.stappenbalk, false);
  check('Exit heet nu Exit interview', start.exit, 'Exit interview');
  check('de ingang is weg -- je bent er al', start.ingang, false);
  check('de eerste vraag heeft twee antwoorden', start.opties, 2);
  check('en het begrepen-paneel staat er met negen regels', start.rijen, 9);
  check('en je kunt altijd zelf typen', start.typeveld, true);

  /* ── De startvraag bepaalt de route ───────────────────────────────────── */
  console.log('\n  waar begin je: bij de hoek of bij de mens');

  const sporen = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    iw2Kies('persona');
    var viaPersona = iw2Vragen().map(function (v) { return v.key; });
    var tweedeVraagPersona = iw2Vraag().key;
    eval(opzet);
    iw2Start();
    iw2Kies('angle');
    var viaHoek = iw2Vragen().map(function (v) { return v.key; });
    var tweedeVraagHoek = iw2Vraag().key;
    return { viaPersona, viaHoek, tweedeVraagPersona, tweedeVraagHoek };
  }, OPZET);
  check('begin je bij de persona, dan is dat de tweede vraag', sporen.tweedeVraagPersona, 'persona');
  /* Vanuit de hoek begin je bij de boodschap, niet bij het doel: dat is precies
     het verschil tussen de twee routes. */
  check('begin je bij de hoek, dan komt de hoek eerst', sporen.tweedeVraagHoek, 'theme');
  check('en de persona-vraag zit dan niet in de route', sporen.viaHoek.indexOf('persona'), -1);
  check('vanuit de persona komt de hoek pas na het doel',
        sporen.viaPersona.indexOf('theme') > sporen.viaPersona.indexOf('goal'), true);
  check('en vanuit de hoek juist ervoor',
        sporen.viaHoek.indexOf('theme') < sporen.viaHoek.indexOf('goal'), true);

  /* ── Elke vraag heeft een uitweg ──────────────────────────────────────── */
  console.log('\n  je kunt op elke vraag zeggen: doe jij het maar');

  const uitwegen = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    iw2Kies('persona');
    var zonder = [];
    var n = 0;
    while (!iw2.klaar && n < 12) {
      var v = iw2Vraag();
      if (!v) break;
      var opts = iw2Opties(v);
      if (!opts.some(function (o) { return o.rory; })) zonder.push(v.key);
      /* de uitweg kiezen als die er is, anders de eerste optie */
      var uitweg = opts.filter(function (o) { return o.rory; })[0];
      iw2Kies(uitweg ? uitweg.key : opts[0].key);
      n++;
    }
    return { zonder: zonder, klaar: iw2.klaar,
             /* alles overgelaten aan Rory: dan hoort er niets van de gebruiker
                te staan, want zonder model vult hij niets in */
             goal: wizState.data.strategy.goal,
             theme: wizState.data.strategy.theme };
  }, OPZET);
  check('geen enkele vraag zonder uitweg', uitwegen.zonder, []);
  check('en alles overlaten brengt je ook bij de blueprint', uitwegen.klaar, true);
  check('een uitweg zet zelf geen doel', uitwegen.goal, '');
  check('en ook geen hoek', uitwegen.theme, '');

  /* ── De keuzes vullen de echte velden ─────────────────────────────────── */
  console.log('\n  het gesprek vult dezelfde velden als de stappen');

  const velden = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    iw2Kies('angle');
    iw2Kies('safety');     /* hoek eerst, want dat is deze route */
    iw2Kies('reach');      /* doel: nieuwe klanten */
    var naDoel = { goal: wizState.data.strategy.goal, funnel: wizState.data.product.funnel };
    iw2Kies(iw2Opties(iw2Vraag())[0].key); /* format */
    iw2Kies('premium');    /* visueel */
    iw2Kies('hands');      /* mens */
    iw2Kies('pain');       /* copy */
    return { naDoel: naDoel,
             theme: wizState.data.strategy.theme,
             formatGezet: !!wizState.data.format.formatId,
             mood: wizState.data.visual.mood,
             mens: wizState.data.visual.humanPresence,
             richting: wizState.data.copy.direction,
             /* wie het zette telt: een keuze van de gebruiker mag Rory later
                niet overschrijven */
             bron: wizSourceOf('strategy', 'theme'),
             klaar: iw2.klaar };
  }, OPZET);
  /* Eén antwoord kan meer dan één veld zetten: "nieuwe klanten bereiken" zegt
     ook iets over de funnelfase, en dat hoef je niet twee keer te vertellen. */
  check('het doel wordt opgeslagen', velden.naDoel.goal, 'Reach new customers');
  check('en zet de funnelfase mee', velden.naDoel.funnel, 'tof');
  check('de hoek komt in strategy.theme', velden.theme, 'Safety & Confidence');
  check('het format wordt gezet', velden.formatGezet, true);
  check('de visuele stijl ook', velden.mood, 'premium');
  check('de menselijke aanwezigheid ook', velden.mens, 'hands');
  check('en de copy-richting', velden.richting, 'Pain-focused');
  check('met de gebruiker als bron', velden.bron, 'user');
  check('en daarna staat de blueprint klaar', velden.klaar, true);

  /* ── Het begrepen-paneel loopt vol ────────────────────────────────────── */
  console.log('\n  wat Rory begrepen heeft, zichtbaar tijdens het gesprek');

  const begrepen = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    var tel = function () {
      return document.querySelectorAll('.iw2-brij.vol').length;
    };
    var voor = tel();
    iw2Kies('angle');
    iw2Kies('safety');
    return { voor: voor, na: tel(),
             streepjes: [].slice.call(document.querySelectorAll('.iw2-brij:not(.vol) .iw2-brij-w'))
               .every(function (e) { return e.textContent.trim() === '—'; }) };
  }, OPZET);
  check('aan het begin staat alleen het product er', begrepen.voor, 1);
  check('na twee antwoorden staan er meer', begrepen.na > begrepen.voor, true);
  check('en wat nog niet gezegd is blijft een streepje', begrepen.streepjes, true);

  /* ── De blueprint en zijn drie uitgangen ──────────────────────────────── */
  console.log('\n  de blueprint aan het eind');

  const blueprint = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start(); iw2Kies('angle');
    ['safety', 'reach'].forEach(function (k) { iw2Kies(k); });
    iw2Kies(iw2Opties(iw2Vraag())[0].key);
    ['premium', 'hands', 'pain'].forEach(function (k) { iw2Kies(k); });
    return { rijen: document.querySelectorAll('.iw2-bp-rij').length,
             knoppen: [].slice.call(document.querySelectorAll('.iw2-slotknoppen .wiz-btn'))
               .map(function (b) { return b.textContent.trim(); }),
             kop: (document.querySelector('#wiz-head .wiz-title') || {}).textContent };
  }, OPZET);
  check('de blueprint toont de besluiten', blueprint.rijen > 5, true);
  check('met drie uitgangen', blueprint.knoppen,
        ['Generate concepts', 'Open in wizard', 'Refine with Rory']);
  check('en de kop zegt dat hij klaar is', /Blueprint ready/.test(blueprint.kop), true);

  /* ── Open in wizard houdt het gesprek ─────────────────────────────────── */
  console.log('\n  van gesprek naar stappen, en terug');

  const naarWizard = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start(); iw2Kies('angle');
    ['safety', 'reach'].forEach(function (k) { iw2Kies(k); });
    iw2Kies(iw2Opties(iw2Vraag())[0].key);
    ['premium', 'hands', 'pain'].forEach(function (k) { iw2Kies(k); });
    wizState.done.review = true;   /* de poort van stap 7 */
    iw2NaarWizard('review');
    var ing = document.getElementById('iw2-ingang');
    var uit = { stap: wizState.current, interviewOpen: iw2.open,
                gesprekBewaard: iw2.chat.length > 0,
                terugknop: !!(ing && ing.offsetParent),
                terugtekst: ing ? ing.textContent : '',
                stappenbalk: !!(document.getElementById('wiz-progress') || {}).offsetParent };
    /* En terug in het gesprek, waar je was. */
    iw2Ingang();
    uit.hervat = iw2.open;
    uit.zelfdeGesprek = iw2.chat.length > 0;
    uit.nogSteedsKlaar = iw2.klaar;
    return uit;
  }, OPZET);
  check('Open in wizard brengt je naar stap 7', naarWizard.stap, 'review');
  check('het interview staat niet meer open', naarWizard.interviewOpen, false);
  check('maar het gesprek is bewaard', naarWizard.gesprekBewaard, true);
  check('de stappenbalk is terug', naarWizard.stappenbalk, true);
  check('en er staat een weg terug', naarWizard.terugknop, true);
  check('die zegt Return to interview', /Return to interview/.test(naarWizard.terugtekst), true);
  check('erop klikken opent het gesprek weer', naarWizard.hervat, true);
  check('met het gesprek dat er al was', naarWizard.zelfdeGesprek, true);
  check('en de blueprint nog klaar', naarWizard.nogSteedsKlaar, true);

  /* ── Generate concepts gaat naar stap 8 ───────────────────────────────── */
  console.log('\n  concepten uitwerken vanaf de blueprint');

  const concepten = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start(); iw2Kies('angle');
    ['safety', 'reach'].forEach(function (k) { iw2Kies(k); });
    iw2Kies(iw2Opties(iw2Vraag())[0].key);
    ['premium', 'hands', 'pain'].forEach(function (k) { iw2Kies(k); });
    /* Zonder sleutel doet wizGenerateConcepts niets, dus vervangen we hem even
       om te zien of hij überhaupt aangeroepen wordt. Landen op stap 8 zonder
       dat er iets uitgewerkt wordt is een leeg scherm met een belofte. */
    var echt = window.wizGenerateConcepts;
    var geroepen = 0;
    window.wizGenerateConcepts = function () { geroepen++; };
    iw2Genereer();
    window.wizGenerateConcepts = echt;
    return { stap: wizState.current, interviewOpen: iw2.open,
             geroepen: geroepen, reviewAf: !!wizState.done.review };
  }, OPZET);
  /* Er is één conceptenscherm en dat staat in de wizard. Het interview bouwt
     het niet nog een keer -- twee schermen voor hetzelfde lopen uit elkaar. */
  check('je komt op stap 8 uit', concepten.stap, 'concepts');
  check('en de concepten worden meteen uitgewerkt', concepten.geroepen, 1);
  check('het interview sluit', concepten.interviewOpen, false);
  check('en stap 7 staat af, want de blueprint is goedgekeurd', concepten.reviewAf, true);

  /* ── Exit vraagt door en gooit dan weg ───────────────────────────────── */
  console.log('\n  Exit interview');

  const exit = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    iw2Kies('angle');
    var voorVraag = { open: iw2.open, chat: iw2.chat.length };
    iw2VraagExit();
    var vraag = { nogOpen: iw2.open,
                  waarschuwing: (document.getElementById('wiz-footer') || {}).textContent || '',
                  keuzes: document.querySelectorAll('#wiz-footer .wiz-btn').length };
    /* eerst nee zeggen: dan verandert er niets */
    iw2ExitAf();
    var na_nee = { open: iw2.open, chat: iw2.chat.length };
    iw2VraagExit();
    iw2Exit();
    return { voorVraag, vraag, na_nee,
             na: { open: iw2.open, chat: iw2.chat.length, stap: wizState.current },
             stappenbalk: !!(document.getElementById('wiz-progress') || {}).offsetParent };
  }, OPZET);
  check('Exit sluit niet meteen', exit.vraag.nogOpen, true);
  check('maar waarschuwt dat het gesprek verloren gaat',
        /will be lost/.test(exit.vraag.waarschuwing), true);
  check('met twee keuzes', exit.vraag.keuzes, 2);
  check('blijven laat alles staan', exit.na_nee, exit.voorVraag);
  check('doorzetten sluit het gesprek', exit.na.open, false);
  check('en gooit het weg', exit.na.chat, 0);
  check('je staat weer in de stappen', exit.stappenbalk, true);

  /* ── Zelf antwoorden ─────────────────────────────────────────────────── */
  console.log('\n  je mag in je eigen woorden antwoorden');

  const zonderSleutel = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start();
    iw2Kies('angle');
    var voor = JSON.stringify(wizState.data);
    document.getElementById('iw2-in').value = 'Safety, but only if we can prove it.';
    iw2Antwoord();
    return { staatInGesprek: iw2.chat.some(function (r) {
               return r.wie === 'user' && /only if we can prove it/.test(r.tekst);
             }),
             velden: JSON.stringify(wizState.data) === voor,
             zegtWaarom: /without a key/.test((iw2.chat[iw2.chat.length - 1] || {}).tekst || '') };
  }, OPZET);
  check('je antwoord komt in het gesprek', zonderSleutel.staatInGesprek, true);
  /* Zonder model kan niemand bepalen wat je bedoelde. Dan mag er ook niets
     vastgelegd worden -- een gok is hier erger dan een lege plek. */
  check('zonder sleutel wordt er niets vastgelegd', zonderSleutel.velden, true);
  check('en Rory zegt waarom', zonderSleutel.zegtWaarom, true);

  /* De kern van het gesprek is wat er met Rory's oordeel gebeurt. Dat oordeel
     komt van het model en is hier dus nagemaakt; wat de wizard ermee doet is
     wel te testen, en dat is precies waar het misgaat. */
  console.log('\n  wat Rory uit je antwoord haalt');

  const vastleggen = await page.evaluate(opzet => {
    eval(opzet);
    iw2Start(); iw2Kies('angle');
    var v = iw2Vraag();                      /* de hoek-vraag: vrij veld */
    var uit = {};

    /* 1. Hij vraagt door: dan verandert er niets en blijf je op de vraag. */
    var voor = JSON.stringify(wizState.data);
    iw2Vastleggen(v, { resolved: false, reply: 'Which part exactly?' }, 'iets vaags');
    uit.vraagtDoorLaatStaan = JSON.stringify(wizState.data) === voor;
    uit.zelfdeVraag = iw2Vraag().key === v.key;

    /* 2. Hij herkent je woorden als antwoord: die woorden gaan het veld in. */
    iw2Vastleggen(v, { resolved: true, choice: null, value: 'Cuts, not convenience' }, 'lange uitleg');
    uit.eigenWoorden = wizState.data.strategy.theme;
    uit.bron = wizSourceOf('strategy', 'theme');

    /* 3. Hij wijst je antwoord aan als een van de opties: dan doet die optie
          zijn eigen werk, inclusief de velden die eraan hangen. */
    eval(opzet);
    iw2Start(); iw2Kies('angle');
    iw2Vastleggen(iw2Vraag(), { resolved: true, choice: 'premium', value: null }, 'ik wil premium');
    uit.viaOptie = wizState.data.strategy.theme;

    /* 4. Bij een vraag die géén vrij veld heeft blijft het leeg als hij geen
          optie aanwijst -- daar kan je eigen formulering niet in. */
    eval(opzet);
    iw2Start(); iw2Kies('persona');
    var pv = iw2Vraag();
    iw2Vastleggen(pv, { resolved: true, choice: null, value: 'iemand van 45 met een baard' }, 'x');
    uit.geenVrijVeld = wizState.data.audience.personaId;
    return uit;
  }, OPZET);
  check('vraagt hij door, dan verandert er niets', vastleggen.vraagtDoorLaatStaan, true);
  check('en je blijft op dezelfde vraag', vastleggen.zelfdeVraag, true);
  check('herkent hij je woorden, dan komen die in het veld',
        vastleggen.eigenWoorden, 'Cuts, not convenience');
  check('met de gebruiker als bron', vastleggen.bron, 'user');
  check('wijst hij een optie aan, dan doet die zijn eigen werk',
        vastleggen.viaOptie, 'Premium & Upgrade');
  check('bij een vraag zonder vrij veld blijft het leeg', vastleggen.geenVrijVeld, '');

  /* ── Een schone lei bij de start ─────────────────────────────────────── */
  console.log('\n  het gesprek begint niet met andermans antwoorden');

  const schoon = await page.evaluate(opzet => {
    eval(opzet);
    /* Een vorige sessie liet dit achter. Het gesprek gaat hier nog over. */
    wizSet('audience', 'personaId', (state.personas[0] || {}).id || 'x1', 'user');
    wizSet('format', 'formatId', 'product-hero', 'user');
    wizSet('visual', 'mood', 'premium', 'rory');
    wizSet('copy', 'direction', 'Pain-focused', 'user');
    wizSet('product', 'funnel', 'tof', 'user');
    iw2Start();
    return { persona: wizState.data.audience.personaId,
             format: wizState.data.format.formatId,
             mood: wizState.data.visual.mood,
             richting: wizState.data.copy.direction,
             /* stap 1 blijft: dat heb je net zelf gekozen */
             funnel: wizState.data.product.funnel,
             product: !!wizState.data.product.productId,
             gevuld: document.querySelectorAll('.iw2-brij.vol').length };
  }, OPZET);
  check('de doelgroep uit een vorige sessie is weg', schoon.persona, '');
  check('het format ook', schoon.format, '');
  check('de visuele stijl ook', schoon.mood, '');
  check('en de copy-richting ook', schoon.richting, '');
  check('maar stap 1 blijft staan: het product', schoon.product, true);
  check('en de funnelfase die je daar koos', schoon.funnel, 'tof');
  /* Product en Funnel: de twee regels die stap 1 kan vullen. Plaatsing is geen
     regel in dit paneel. */
  check('dus alleen stap 1 staat er bij "wat ik begrepen heb"', schoon.gevuld, 2);

  /* ── Engels ───────────────────────────────────────────────────────────── */
  console.log('\n  de randvoorwaarde: Engelse interface');

  const engels = await page.evaluate(opzet => {
    eval(opzet);
    var gezien = [];
    var nl = ['Kies ', 'Genereer', 'Volgende', 'Doelgroep', 'Invalshoek', 'Plaatsing',
              'Bewerk', 'Opslaan', 'Aanbevolen', 'Vraag ', 'Stap ', 'Verlaten'];
    iw2Start();
    var lees = function () {
      var t = (document.querySelector('.wiz-paneel') || {}).innerText || '';
      nl.forEach(function (w) { if (t.indexOf(w) > -1 && gezien.indexOf(w) === -1) gezien.push(w); });
    };
    lees();
    iw2Kies('angle');
    ['safety', 'reach'].forEach(function (k) { lees(); iw2Kies(k); });
    lees();
    iw2Kies(iw2Opties(iw2Vraag())[0].key);
    ['premium', 'hands', 'pain'].forEach(function (k) { lees(); iw2Kies(k); });
    lees();
    return gezien;
  }, OPZET);
  check('geen Nederlandse interface-tekst in het interview', engels, []);

  /* ── Leesbaarheid van de zwevende knop ───────────────────────────────── */
  console.log('\n  de knop is leesbaar tegen zijn eigen achtergrond');

  const leesbaar = await page.evaluate(opzet => {
    eval(opzet);
    /* De knop draagt een vaste donkere achtergrond, ongeacht het thema van de
       console. Een themakleur voor de tekst wordt dan zwart-op-zwart zodra de
       console licht staat, en dan is het een leeg zwart vlak. */
    var el = document.getElementById('iw2-ingang');
    var st = getComputedStyle(el);
    var lum = function (kleur) {
      var m = kleur.match(/[\d.]+/g).slice(0, 3).map(Number).map(function (v) {
        v = v / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    };
    var a = lum(st.color), b = lum(st.backgroundColor);
    var hoog = Math.max(a, b), laag = Math.min(a, b);
    return { verhouding: Math.round(((hoog + 0.05) / (laag + 0.05)) * 10) / 10,
             tekst: st.color, achtergrond: st.backgroundColor };
  }, OPZET);
  console.log(`       gemeten: ${leesbaar.verhouding}:1 — ${leesbaar.tekst} op ${leesbaar.achtergrond}`);
  check('tekst tegen achtergrond haalt minstens 4.5:1', leesbaar.verhouding >= 4.5, true);

  /* ── Welk model er gevraagd wordt ────────────────────────────────────── */
  console.log('\n  welk model de console vraagt');

  const model = await page.evaluate(() => {
    var el = document.getElementById('anthropic-model');
    var gekozen = el.value;
    /* En waar hij op terugvalt als er niets gekozen is. */
    el.value = '';
    var terugval = wizModel();
    el.value = gekozen;
    return { gekozen: gekozen, terugval: terugval };
  });
  check('standaard staat Opus 5 ingesteld', model.gekozen, 'claude-opus-5');
  check('en zonder keuze valt hij daar ook op terug', model.terugval, 'claude-opus-5');

  console.log('\n  geen stille fouten');
  const onclicks = await page.evaluate(() => {
    var mist = [];
    [].slice.call(document.querySelectorAll('.wiz-paneel [onclick]')).forEach(function (el) {
      var naam = (el.getAttribute('onclick') || '').replace(/\(.*$/, '').trim();
      if (naam && typeof window[naam] !== 'function' && mist.indexOf(naam) === -1) mist.push(naam);
    });
    return mist;
  });
  check('elke onclick in het interview bestaat op window', onclicks, []);
  check('de pagina draaide zonder JavaScript-fouten', jsFouten, []);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
