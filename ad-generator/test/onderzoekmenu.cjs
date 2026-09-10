/* Creative Research — het scherm.
 *
 * De bronlaag staat in platform/worker/test/onderzoek.mjs; daar wordt bewaakt
 * wat er binnenkomt. Hier gaat het om wat dit scherm ermee doet, en dat is een
 * ander soort risico -- vier fouten die er alle vier goed uitzien:
 *
 *   1. HET VOORBEHOUD SNEUVELT ONDERWEG. De bronlaag stuurt de zin mee die
 *      zegt dat dit signalen zijn en geen bewijs. Een scherm dat hem niet
 *      toont maakt van tien advertenties met cijfers een ranglijst van
 *      winnaars, en daar wordt op besloten.
 *
 *   2. EEN ONBEKENDE MAAT WORDT EEN NUL. Bereik bestaat alleen in de
 *      EU-rapportage van Meta. Een 0 op het scherm zegt "niemand heeft hem
 *      gezien"; de waarheid is "wij weten het niet".
 *
 *   3. HET SCHERM ZEGT NIET WAT EEN SORTERING MEET. Looptijd en bereikgroei
 *      beantwoorden verschillende vragen. Alleen de sterke kant noemen is
 *      reclame, geen uitleg -- dus staat de keerzijde er ook.
 *
 *   4. HET WERK VAN DE ANDER GAAT MEE NAAR DE WIZARD. Dit is de duurste. Het
 *      patroon overnemen is de bedoeling; de copy, het beeld en de claim van
 *      een ander merk overnemen is het niet -- die werken niet voor ons en ze
 *      zijn niet van ons.
 *
 *   node ad-generator/test/onderzoekmenu.cjs
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'app');
const CHROOM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };

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

/* De worker nabootsen in de pagina. Alles wat het scherm ophaalt gaat door
   fetch, dus dat is de plek waar je hem afvangt -- en meteen de plek waar je
   ziet WAT er gevraagd is. */
function ONDERSCHEP() {
  window.__gevraagd = [];
  window.__antwoord = {
    voorbehoud: 'Lang draaien en veel bereik zijn signalen, geen bewijs. Van geen enkele advertentie hier kennen we de omzet; het enige wat we weten is dat de adverteerder hem niet heeft uitgezet.',
    bereik: 'brandtracker',
    sorteert_op: 'draait het langst', venster: null, dagen_gevraagd: 14,
    advertenties: [
      { id: 'c-900', merk: 'Concurrent BV', domein: 'concurrent.nl', beeld: 'https://x.fbcdn.net/1.jpg',
        soort: 'image', copy: { kop: 'Waarom mannen overstappen', tekst: 'Drie maanden getest.', cta: 'SHOP_NOW' },
        bereik: 412000, dagen_actief: 96, varianten: 4, eerst_gezien: '2026-05-20', land: 'NL', taal: 'nl' },
      { id: 'c-901', merk: 'Zonder cijfers BV', domein: null, beeld: null, soort: 'image',
        copy: { kop: 'Een tweede', tekst: null, cta: null },
        bereik: null, dagen_actief: null, varianten: null, eerst_gezien: null, land: null, taal: null },
      /* En eentje met bewegend beeld: het bestand apart, de poster apart. Dit
         is de advertentie die als zwart vlak op het scherm stond. */
      { id: 'c-902', merk: 'Bewegend BV', domein: 'bewegend.nl',
        beeld: 'https://x.fbcdn.net/poster.jpg', video: 'https://x.fbcdn.net/film.mp4',
        soort: 'video', copy: { kop: 'Kijk wat er gebeurt', tekst: null, cta: null },
        bereik: null, dagen_actief: 40, varianten: null, eerst_gezien: null, land: null, taal: null }
    ]
  };
  window.__merken = [
    /* Het eerste domein is bij TrendTrack vaak de landingsplek en niet het merk:
       bij manscaped.com staat amazon.co.uk vooraan. Daarom staat die val hier
       in de fixture. */
    { id: 'm1', naam: 'Manscaped', domein: 'amazon.co.uk',
      domeinen: ['amazon.co.uk', 'manscaped.com'], map_id: 13318, actieve_ads: 155 },
    { id: 'm2', naam: 'BALZY', domein: 'balzy.nl', domeinen: ['balzy.nl'],
      map_id: 13318, actieve_ads: 428 },
    { id: 'm3', naam: 'Cloud Nine', domein: 'cloudninehair.com',
      domeinen: ['cloudninehair.com'], map_id: 14127, actieve_ads: 1165 },
    /* En een merk waarvan geen enkel domein bij de naam hoort: dat hoort GEEN
       logo te krijgen, want dat wordt het logo van een ander bedrijf. */
    { id: 'm4', naam: 'Skull Shaver', domein: 'mercadolibre.com.mx',
      domeinen: ['mercadolibre.com.mx'], map_id: null, actieve_ads: 106 }
  ];
  window.__mappen = [
    { id: 13318, naam: 'Wellshave', aantal: 2 },
    { id: 14127, naam: 'Wellshine', aantal: 1 }
  ];
  window.__claude = { hoek: 'De oprichter rekent het voor', mechanisme: 'Direct van fabriek naar deur',
    awareness: 'problem', sophistication: 's4', publiek: 'Mannen die te veel betalen voor mesjes',
    bewijs: 'cijfer', formaat: 'nieuwsartikel', waarom: 'Het publiek gelooft geen belofte meer, wel een som.' };
  const echt = window.fetch;
  window.fetch = async function (url, opties) {
    const u = String(url);
    window.__gevraagd.push({ url: u, auth: (opties && opties.headers && opties.headers.Authorization) || null,
      body: (opties && opties.body) || null });
    if (u.indexOf('/onderzoek/merken') > -1) {
      return { ok: true, status: 200, json: async () => ({ merken: window.__merken, mappen: window.__mappen }) };
    }
    if (u.indexOf('/onderzoek/toplijst') > -1) {
      return { ok: true, status: 200, json: async () => window.__antwoord };
    }
    if (u.indexOf('/onderzoek/beeld') > -1) {
      return { ok: true, status: 200, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) };
    }
    if (u.indexOf('/onderzoek/video') > -1) {
      if (window.__videoStuk) return { ok: false, status: 502, json: async () => ({ error: 'de video was niet op te halen (404)' }) };
      return { ok: true, status: 200, blob: async () => new Blob(['mp4'], { type: 'video/mp4' }) };
    }
    if (u.indexOf('/anthropic') > -1) {
      return { ok: true, status: 200,
        json: async () => ({ content: [{ type: 'text', text: JSON.stringify(window.__claude) }] }) };
    }
    return echt(url, opties);
  };
  window.__WG_TOKEN = 'token-van-de-baas';
}

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const paginafouten = [];
  page.on('pageerror', e => paginafouten.push(String(e)));
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof renderCreativeResearch === 'function');
  await page.evaluate(fx => { eval('(' + fx + ')()'); }, ONDERSCHEP.toString());

  console.log('\n  het menu bestaat en opent');
  const menu = await page.evaluate(() => {
    switchMainTab('research');
    const view = document.getElementById('main-tab-research');
    return {
      knop: !!document.getElementById('main-tab-btn-research'),
      knopTekst: (document.getElementById('main-tab-btn-research') || {}).textContent.trim(),
      zichtbaar: view && view.style.display === 'block',
      actief: (document.getElementById('main-tab-btn-research') || { classList: { contains: () => false } }).classList.contains('active'),
      titel: (document.getElementById('ws-page-title') || {}).textContent,
      /* En de andere schermen zijn weg. Twee zichtbare vlakken tegelijk is de
         klassieke fout bij een tab die erbij komt: hij werkt, en de vorige
         staat er nog onder. */
      anderen: ['generator', 'library', 'transformer', 'team']
        .filter(t => { const el = document.getElementById('main-tab-' + t); return el && el.style.display !== 'none'; })
    };
  });
  check('er is een navigatieknop', menu.knop, true);
  check('en hij heet Creative Research', menu.knopTekst, 'Creative Research');
  check('het scherm wordt zichtbaar', menu.zichtbaar, true);
  check('de knop staat aan', menu.actief, true);
  check('de paginatitel klopt', menu.titel, 'Creative Research');
  check('en er staat niets anders meer open', menu.anderen, []);

  /* En de andere kant op. Dat een nieuw vlak opent is de helft; dat het weer
     dichtgaat als je verdergaat is de andere helft, en dat is de helft die bij
     een tab die erbij komt vergeten wordt -- dan staat Creative Research onder
     elk ander scherm door. */
  const weer = await page.evaluate(() => {
    switchMainTab('research');
    switchMainTab('library');
    const el = document.getElementById('main-tab-research');
    return { verborgen: el.style.display === 'none',
             knopUit: !document.getElementById('main-tab-btn-research').classList.contains('active') };
  });
  check('en hij gaat weer dicht als je verdergaat', weer.verborgen, true);
  check('met de knop uit', weer.knopUit, true);
  await page.evaluate(() => switchMainTab('research'));

  console.log('\n  elk onderzoeksdoel zegt wat het meet, en wat niet');
  /* Een optie die alleen zijn sterke kant noemt is reclame. De keerzijde staat
     er daarom bij, en dat is precies het soort regel dat bij een herschrijving
     stilletjes sneuvelt. En een doel dat wij niet kunnen uitvoeren hoort niet
     aanklikbaar te zijn: een kaart die stil de standaardlijst oplevert laat je
     denken dat je iets gemeten hebt. */
  const doelen = await page.evaluate(() => {
    var bewaard = _cr.doel, bewaardMeer = _cr.meerDoelen;
    _cr.meerDoelen = true;
    var getekend = CR_DOELEN.map(d => {
      if (!d.nog_niet) crZetDoel(d.id);
      var el = document.createElement('div');
      el.innerHTML = crDoelenBlokHtml();
      var t = el.textContent;
      return { id: d.id,
               zegt: d.nog_niet ? t.indexOf(d.nog_niet) > -1 : t.indexOf(d.zegt) > -1,
               letop: d.nog_niet ? true : t.indexOf(d.let_op) > -1 };
    });
    /* De niet-uitvoerbare doelen staan uit, en veranderen niets als je ze toch
       aanklikt. */
    crZetDoel('looptijd');
    var voor = { doel: _cr.doel, sorteer: _cr.sorteer };
    /* Netjes weigeren, niet klappen: een doel dat nog niet kan hoort false te
       geven en niets aan te raken. */
    var geweigerd;
    try { geweigerd = crZetDoel('concepten'); } catch (e) { geweigerd = 'stuk: ' + e.message; }
    var na = { doel: _cr.doel, sorteer: _cr.sorteer };
    var el2 = document.createElement('div');
    el2.innerHTML = crDoelenBlokHtml();
    var uit = el2.querySelectorAll('.cr-doel[disabled]').length;
    /* En een doel dat wél kan zet de knoppen die de vraag sturen. */
    crZetDoel('evergreen');
    var evergreen = { sorteer: _cr.sorteer, minDagen: _cr.minDagen };
    crZetDoel('videos');
    var video = { sorteer: _cr.sorteer, soort: _cr.toonSoort };
    /* En een doel dat een ANDERE sortering vraagt zet die ook werkelijk om --
       anders vraag je om wat er opschaalt en krijg je wat er het langst loopt. */
    crZetDoel('groei');
    var groei = _cr.sorteer;
    _cr.doel = bewaard; _cr.meerDoelen = bewaardMeer; crZetDoel(bewaard);
    return {
      aantal: CR_DOELEN.length,
      uitvoerbaar: CR_DOELEN.filter(d => !d.nog_niet).length,
      zonderZegt: getekend.filter(g => !g.zegt).map(g => g.id),
      zonderLetop: getekend.filter(g => !g.letop).map(g => g.id),
      geweigerd, voor, na, uit, evergreen, video, groei
    };
  });
  check('de drie oude sorteringen zijn er nog, plus nieuwe doelen',
    doelen.uitvoerbaar >= 6 && doelen.aantal > doelen.uitvoerbaar, true);
  check('elke uitleg komt ook werkelijk in beeld', doelen.zonderZegt, []);
  check('en elke keerzijde ook', doelen.zonderLetop, []);
  check('een doel dat nog niet kan wordt geweigerd', doelen.geweigerd, false);
  check('en verandert dus niets', doelen.na, doelen.voor);
  check('het staat ook zichtbaar uit', doelen.uit >= 3, true);
  check('evergreen zet de minimale looptijd op negentig dagen',
    doelen.evergreen, { sorteer: 'looptijd', minDagen: 90 });
  check('en video zet het formaat op video', doelen.video, { sorteer: 'looptijd', soort: 'video' });
  check('opschalen zet de sortering echt om', doelen.groei, 'groei');

  console.log('\n  de lijst komt binnen');
  const lijst = await page.evaluate(async () => {
    await crHaalLijst();
    const el = document.getElementById('cr-inhoud');
    return {
      kaarten: el.querySelectorAll('.cr-kaart').length,
      tekst: el.textContent,
      auth: (window.__gevraagd[0] || {}).auth,
      /* De eerste aanroep is inmiddels de merkenlijst; de sortering staat op de
         toplijst. Op index 0 blijven kijken is hoe een test iets anders gaat
         controleren dan hij denkt. */
      url: (window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/toplijst') > -1)[0] || {}).url
    };
  });
  check('drie kaarten', lijst.kaarten, 3);
  check('met het merk erop', /Concurrent BV/.test(lijst.tekst), true);
  check('en de vraag droeg het teamtoken', lijst.auth, 'Bearer token-van-de-baas');
  check('met de gekozen sortering', /sorteer=looptijd/.test(lijst.url), true);

  console.log('\n  het voorbehoud staat er, en het staat bovenaan');
  const voorbehoud = await page.evaluate(() => {
    const el = document.getElementById('cr-inhoud');
    const v = el.querySelector('.cr-voorbehoud');
    const eersteKaart = el.querySelector('.cr-kaart');
    if (!v || !eersteKaart) return { er: false };
    /* Boven de kaarten, niet eronder: onder tien cijfers is het een voetnoot,
       en een voetnoot wordt niet gelezen. */
    return {
      er: true, tekst: v.textContent,
      boven: v.compareDocumentPosition(eersteKaart) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false,
      /* En hij komt uit de bron, niet uit dit bestand. */
      letterlijk: v.textContent.trim() === window.__antwoord.voorbehoud
    };
  });
  check('het voorbehoud staat op het scherm', voorbehoud.er, true);
  check('boven de kaarten', voorbehoud.boven, true);
  check('en letterlijk zoals de bron hem gaf', voorbehoud.letterlijk, true);

  console.log('\n  een verzonnen voorbehoud zou niet meekomen');
  /* De zelfcontrole: als het scherm de zin zelf zou formuleren, blijft het
     blok hierboven ook groen. Dit blok laat de bron iets anders zeggen en
     controleert dat het scherm meebeweegt. */
  const anders = await page.evaluate(async () => {
    window.__antwoord = Object.assign({}, window.__antwoord, { voorbehoud: 'EEN HEEL ANDER VOORBEHOUD' });
    await crHaalLijst();
    return (document.querySelector('.cr-voorbehoud') || {}).textContent;
  });
  check('het scherm toont wat de bron zegt', (anders || '').trim(), 'EEN HEEL ANDER VOORBEHOUD');
  await page.evaluate(async () => {
    window.__antwoord = Object.assign({}, window.__antwoord, {
      voorbehoud: 'Lang draaien en veel bereik zijn signalen, geen bewijs. Van geen enkele advertentie hier kennen we de omzet; het enige wat we weten is dat de adverteerder hem niet heeft uitgezet.'
    });
    await crHaalLijst();
  });

  console.log('\n  onbekend blijft leeg, ook op het scherm');
  /* Een 0 zegt "niemand heeft hem gezien". De waarheid is "wij weten het
     niet", en dat is een streepje. */
  const leeg = await page.evaluate(() => ({
    nul: crGetal(0), leeg: crGetal(null), onbepaald: crGetal(undefined), tekst: crGetal(''),
    duizend: crGetal(412000), klein: crGetal(96),
    tweedeKaart: document.querySelectorAll('.cr-kaart')[1].textContent
  }));
  check('nul is nul', leeg.nul, '0');
  check('maar niets is een streepje', [leeg.leeg, leeg.onbepaald, leeg.tekst], ['—', '—', '—']);
  check('grote getallen leesbaar', [leeg.duizend, leeg.klein], ['412k', '96']);
  check('en een kaart zonder cijfers toont er geen', /0 dagen|0 bereik/.test(leeg.tweedeKaart), false);

  console.log('\n  een venster dat de bron anders maakte wordt gemeld');
  const venster = await page.evaluate(async () => {
    window.__antwoord = Object.assign({}, window.__antwoord, { venster: 'last30d', dagen_gevraagd: 14 });
    await crHaalLijst();
    return document.getElementById('cr-inhoud').textContent;
  });
  check('het scherm zegt wat er werkelijk gemeten is', /last30d/.test(venster), true);
  check('en waar je om vroeg', /14 dagen/.test(venster), true);

  console.log('\n  doorklikken naar een advertentie');
  const detail = await page.evaluate(async () => {
    document.querySelector('.cr-kaart').click();
    const el = document.getElementById('cr-inhoud');
    return { tekst: el.textContent, leesknop: !!el.querySelector('[data-action="cr-lees"]'),
             terug: !!el.querySelector('[data-action="cr-sluit"]'),
             /* Nog geen knop naar de wizard: die hoort pas te bestaan als er
                een patroon gelezen is. Anders neem je niets over. */
             wizardknop: !!el.querySelector('[data-action="cr-wizard"]') };
  });
  check('de copy van de advertentie staat er', /Drie maanden getest/.test(detail.tekst), true);
  check('en hoe lang hij draait', /96 dagen/.test(detail.tekst), true);
  check('er is een knop om het patroon te lezen', detail.leesknop, true);
  check('en een weg terug', detail.terug, true);
  check('maar nog geen knop naar de wizard', detail.wizardknop, false);

  console.log('\n  het patroon wordt gelezen, niet de uitvoering');
  const prompt = await page.evaluate(() => crPatroonPrompt(window.__antwoord.advertenties[0]));
  check('de prompt vraagt om het patroon', /PATROON eronder, niet de uitvoering/.test(prompt), true);
  check('en zegt dat het voor een ander merk is', /ander merk in een andere categorie/.test(prompt), true);
  /* Een leeg veld is het juiste antwoord bij twijfel. Zonder deze regel vult
     het model de gaten, en een verzonnen mechanisme ziet er precies zo uit als
     een gelezen mechanisme. */
  check('een onbekend veld blijft leeg', /laat het veld dan LEEG/.test(prompt), true);
  check('en claims blijven claims', /niet wat waar is/.test(prompt), true);

  const patroon = await page.evaluate(async () => {
    await crLeesPatroon();
    const el = document.getElementById('cr-inhoud');
    return { tekst: el.textContent, wizardknop: !!el.querySelector('[data-action="cr-wizard"]') };
  });
  check('het patroon staat op het scherm', /De oprichter rekent het voor/.test(patroon.tekst), true);
  check('met het mechanisme', /Direct van fabriek naar deur/.test(patroon.tekst), true);
  check('en nu is er wel een knop naar de wizard', patroon.wizardknop, true);

  console.log('\n  een leeg veld in het patroon wordt niet gevuld');
  const lekker = await page.evaluate(() => {
    const html = crPatroonHtml({ hoek: 'Alleen een hoek', mechanisme: '', awareness: null });
    return { hoek: /Alleen een hoek/.test(html),
             mechanisme: /Het mechanisme/.test(html), awareness: /Awareness/.test(html) };
  });
  check('wat er is komt in beeld', lekker.hoek, true);
  check('een leeg mechanisme krijgt geen regel', lekker.mechanisme, false);
  check('en een lege awareness ook niet', lekker.awareness, false);

  console.log('\n  een video wordt geen static');
  /* Dit ging stil mis en het kostte een generatie: de knop stuurde alles naar
     de statics-wizard, ook een advertentie van zevenentwintig seconden met een
     voice-over. Dan bouw je een bewegend concept na als één stilstaand beeld
     en houd je de eerste frame over. */
  const soort = await page.evaluate(() => ({
    /* Zonder soort, want die komt niet altijd mee. Het bestand alleen is al
       genoeg bewijs dat het bewegend beeld is. */
    video: crIsVideo({ video: 'https://x.fbcdn.net/film.mp4', soort: null }),
    metSoort: crIsVideo({ video: null, soort: 'video' }),
    still: crIsVideo({ video: null, soort: 'image' }),
    leeg: crIsVideo(null)
  }));
  check('een bestand maakt het een video', soort.video, true);
  check('en het soort ook', soort.metSoort, true);
  check('een still is geen video', soort.still, false);
  check('en niets is ook geen video', soort.leeg, false);

  const knoppen = await page.evaluate(() => {
    const uit = {};
    _cr.patroon = window.__claude;
    _cr.open = window.__antwoord.advertenties[0];
    crRender();
    uit.static = document.getElementById('cr-inhoud').textContent;
    _cr.open = window.__antwoord.advertenties[2];
    crRender();
    uit.video = document.getElementById('cr-inhoud').textContent;
    return uit;
  });
  check('bij een still heet de knop static', /Maak hier onze static van/.test(knoppen.static), true);
  check('en bij een video script', /Maak hier ons script van/.test(knoppen.video), true);
  check('de uitleg noemt de Scriptwriter', /Scriptwriter/.test(knoppen.video), true);
  check('en bij een still de statics-wizard', /statics-wizard/.test(knoppen.static), true);

  console.log('\n  het formaat wordt vertaald, of het blijft leeg');
  /* Een gok invullen is erger dan niets invullen: een ingevuld veld leest als
     een besluit. En de volgorde is betekenis -- een advertorial IS een artikel,
     dus die moet eerst gevonden worden. */
  const formaten = await page.evaluate(() => ({
    advertorial: crFormaatNaar(window.CR_FORMAAT_STATIC, 'advertorial in nieuwsstijl'),
    nieuws: crFormaatNaar(window.CR_FORMAAT_STATIC, 'nieuwsartikel'),
    demo: crFormaatNaar(window.CR_FORMAAT_SCRIPT, 'demonstratie'),
    founder: crFormaatNaar(window.CR_FORMAAT_SCRIPT, 'Founder Story'),
    onbekend: crFormaatNaar(window.CR_FORMAAT_STATIC, 'iets wat wij niet kennen'),
    leeg: crFormaatNaar(window.CR_FORMAAT_STATIC, '')
  }));
  check('advertorial vindt het advertorialformaat', formaten.advertorial, 'news-headline-advertorial');
  check('nieuwsartikel ook', formaten.nieuws, 'news-headline-advertorial');
  check('demonstratie wordt een demo-script', formaten.demo, 'UGC Demo / How-To');
  check('een founder story ook', formaten.founder, 'Founder Story / Origin Video');
  check('wat we niet kennen blijft leeg', formaten.onbekend, '');
  check('en leeg blijft leeg', formaten.leeg, '');
  /* En waar twee woorden allebei passen wint de meest specifieke. Een
     "productdemonstratie" is een demonstratie, geen productfoto -- wie de
     volgorde omgooit maakt er stil een packshot van. */
  const volgorde = await page.evaluate(() => ({
    demoVoorProduct: crFormaatNaar(window.CR_FORMAAT_STATIC, 'productdemonstratie'),
    founderVoorGetuige: crFormaatNaar(window.CR_FORMAAT_SCRIPT, 'founder testimonial')
  }));
  check('een productdemonstratie is een demonstratie', volgorde.demoVoorProduct, 'how-it-works');
  check('en een founder-testimonial is een founder story',
    volgorde.founderVoorGetuige, 'Founder Story / Origin Video');

  const soph = await page.evaluate(() => [crSophNummer('s4'), crSophNummer('4'), crSophNummer(''),
    crSophNummer('onbekend'), crSophNummer('s7'), crSophNummer('stadium 12')]);
  check('s4 wordt 4, en onbekend blijft leeg', soph.slice(0, 4), ['4', '4', '', '']);
  /* Buiten de schaal is geen stadium. Een 7 of een 12 doorgeven levert een
     keuzelijst op die terugspringt naar de eerste optie -- en dan staat er
     stadium 1 waar niemand iets gekozen heeft. */
  check('en buiten de schaal blijft leeg', soph.slice(4), ['', '1']);

  console.log('\n  een keuzelijst krijgt nooit een waarde die hij niet kent');
  /* Zet je een select op iets wat er niet in staat, dan springt hij terug naar
     de eerste optie -- en dan staat er een waarde die niemand gekozen heeft. */
  const zetten = await page.evaluate(() => {
    const sel = document.createElement('select');
    sel.id = 'test-select';
    sel.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    document.body.appendChild(sel);
    const kan = crZetVeld('test-select', 'b');
    const waarde1 = sel.value;
    const nietKan = crZetVeld('test-select', 'zzz');
    const waarde2 = sel.value;
    sel.remove();
    return { kan: kan, waarde1: waarde1, nietKan: nietKan, waarde2: waarde2 };
  });
  check('een bekende waarde wordt gezet', [zetten.kan, zetten.waarde1], [true, 'b']);
  check('een onbekende niet, en de oude blijft staan', [zetten.nietKan, zetten.waarde2], [false, 'b']);

  console.log('\n  de video gaat naar de Scriptwriter, voorgevuld');
  const script = await page.evaluate(() => {
    _cr.open = window.__antwoord.advertenties[2];
    _cr.patroon = window.__claude;
    /* De richting leeg zetten: wat er al staat is werk van iemand en hoort te
       blijven staan -- dat controleren we hierna. */
    const dir = document.getElementById('sw-direction');
    if (dir) dir.value = '';
    crNaarScriptwriter();
    return {
      tab: (document.getElementById('main-tab-scriptwriter') || {}).style
        ? document.getElementById('main-tab-scriptwriter').style.display : null,
      awareness: (document.getElementById('sw-awareness') || {}).value,
      soph: (document.getElementById('sw-sophistication') || {}).value,
      richting: (document.getElementById('sw-direction') || {}).value,
      velden: (_cr.overgenomen || {}).velden || []
    };
  });
  check('de Scriptwriter staat open', script.tab, 'block');
  check('awareness is overgenomen', script.awareness, 'problem');
  check('sophistication ook, als nummer', script.soph, '4');
  check('de hoek staat in de richting', /De oprichter rekent het voor/.test(script.richting), true);
  check('het mechanisme ook', /Direct van fabriek naar deur/.test(script.richting), true);
  check('en het publiek', /Mannen die te veel betalen/.test(script.richting), true);
  /* En wat er NIET in mag: de copy en het beeld van de ander. */
  check('geen copy van de ander in de brief', /Kijk wat er gebeurt/.test(script.richting), false);
  check('geen beeldadres in de brief', /fbcdn/.test(script.richting), false);
  check('de brief zegt dat het patroon meegaat en de uitvoering niet',
    /niet de uitvoering/.test(script.richting), true);

  /* En de knop zelf, niet alleen de functie erachter. Dit is de fout die het
     midden hield: de knop heette goed en stuurde alles naar de statics-wizard. */
  const viaKnop = await page.evaluate(() => {
    switchMainTab('research');
    _cr.open = window.__antwoord.advertenties[2];
    _cr.patroon = window.__claude;
    wizReset(true);
    crRender();
    document.querySelector('[data-action="cr-wizard"]').click();
    return {
      scriptwriter: (document.getElementById('main-tab-scriptwriter') || {}).style.display,
      generator: (document.getElementById('main-tab-generator') || {}).style.display,
      /* En de statics-wizard is niet gevuld: die had hier niets te doen. */
      wizardLeeg: !wizState.data.strategy.marketingAngle
    };
  });
  check('de knop opent de Scriptwriter', viaKnop.scriptwriter, 'block');
  check('en niet de generator', viaKnop.generator, 'none');
  check('de statics-wizard is niet aangeraakt', viaKnop.wizardLeeg, true);

  const nietOverschrijven = await page.evaluate(() => {
    const dir = document.getElementById('sw-direction');
    dir.value = 'Hier zat iemand tien minuten aan';
    crNaarScriptwriter();
    return dir.value;
  });
  check('een richting die er al staat blijft staan', nietOverschrijven, 'Hier zat iemand tien minuten aan');

  console.log('\n  naar de wizard gaat het patroon, niet het werk van de ander');
  /* De duurste fout van de vier. Het patroon overnemen is de bedoeling; de
     copy, het beeld en de claim van een ander merk overnemen is het niet --
     die werken niet voor ons en ze zijn niet van ons. */
  const over = await page.evaluate(() => {
    /* Terug naar de stilstaande advertentie: de controle hiervoor stond op de
       video, en die gaat naar de Scriptwriter. */
    _cr.open = window.__antwoord.advertenties[0];
    crNaarWizard();
    const d = wizState.data;
    return {
      hoek: d.strategy.marketingAngle,
      mechanisme: d.strategy.mechanism,
      awareness: d.audience.awareness,
      sophistication: d.audience.sophistication,
      bewijs: d.strategy.proof,
      /* Wat er NIET in mag staan: de kop, de tekst en het beeldadres van de
         ander. Het hele databestand van de wizard doorzoeken, want een veld
         waar het per ongeluk in belandt is precies het veld waar niemand
         kijkt. */
      lek: JSON.stringify(d).indexOf('Waarom mannen overstappen') > -1
        || JSON.stringify(d).indexOf('Drie maanden getest') > -1
        || JSON.stringify(d).indexOf('fbcdn') > -1,
      herkomst: wizState.source['strategy.marketingAngle'],
      bron: wizState.onderzoekBron
    };
  });
  check('de hoek gaat mee', over.hoek, 'De oprichter rekent het voor');
  check('het mechanisme ook', over.mechanisme, 'Direct van fabriek naar deur');
  check('awareness en sophistication', [over.awareness, over.sophistication], ['problem', 's4']);
  check('de bewijsvorm', over.bewijs, 'cijfer');
  check('en de copy, de kop en het beeld van de ander NIET', over.lek, false);
  /* Afgekeken is een derde soort herkomst, naast een keuze van de gebruiker en
     een advies van Rory. Dat hoort zichtbaar te zijn. */
  check('de herkomst staat op onderzoek', over.herkomst, 'onderzoek');
  check('met het merk waar het vandaan komt', over.bron.merk, 'Concurrent BV');

  console.log('\n  de statics-wizard staat niet leeg als je binnenkomt');
  /* De klacht was concreet: je komt binnen op stap 1, het productveld is leeg
     en er is verder niets ingevuld -- terwijl er net een patroon gelezen is.
     Wat we weten hoort te staan; wat we niet weten (welk van ONZE producten
     dit wordt) blijft een besluit. */
  const gevuld = await page.evaluate(() => {
    wizReset(true);
    _cr.open = window.__antwoord.advertenties[0];
    _cr.patroon = Object.assign({}, window.__claude, { formaat: 'nieuwsartikel' });
    crNaarWizard();
    const d = wizState.data;
    return {
      formaat: d.format.formatId,
      formaatHerkomst: wizState.source['format.formatId'],
      richting: d.copy.direction,
      richtingHerkomst: wizState.source['copy.direction'],
      product: d.product.productId,
      publiek: (wizState.onderzoekBron || {}).publiek
    };
  });
  check('het formaat is vertaald en ingevuld', gevuld.formaat, 'news-headline-advertorial');
  check('met de herkomst erbij', gevuld.formaatHerkomst, 'onderzoek');
  check('de brief staat in het richtingsveld', /De oprichter rekent het voor/.test(gevuld.richting), true);
  check('ook met herkomst', gevuld.richtingHerkomst, 'onderzoek');
  check('het publiek is bewaard', /Mannen die te veel betalen/.test(gevuld.publiek || ''), true);
  /* Welk product dit wordt staat niet in de advertentie van een ander. Dat
     invullen zou een besluit verzinnen. */
  check('en het product blijft een keuze', gevuld.product, '');

  /* En ook hier: een richting die er al staat is werk van iemand. */
  const staatAl = await page.evaluate(() => {
    wizReset(true);
    wizState.data.copy.direction = 'Dit had iemand al bedacht';
    crNaarWizard();
    return { richting: wizState.data.copy.direction,
             herkomst: wizState.source['copy.direction'] };
  });
  check('een bestaande richting blijft staan', staatAl.richting, 'Dit had iemand al bedacht');
  check('en krijgt geen herkomststempel die niet klopt', staatAl.herkomst, undefined);

  const eenProduct = await page.evaluate(() => {
    wizReset(true);
    const bewaard = state.products;
    state.products = [{ id: 'p-enig', name: 'Het enige product' }];
    crNaarWizard();
    const een = wizState.data.product.productId;
    wizReset(true);
    state.products = [{ id: 'p1', name: 'Een' }, { id: 'p2', name: 'Twee' }];
    crNaarWizard();
    const twee = wizState.data.product.productId;
    state.products = bewaard;
    return { een: een, twee: twee };
  });
  check('is er maar één product, dan is er niets te kiezen', eenProduct.een, 'p-enig');
  check('zijn het er meer, dan kies je zelf', eenProduct.twee, '');

  console.log('\n  en de wizard zegt waar het vandaan komt');
  const regel = await page.evaluate(() => {
    wizReset(true);
    _cr.patroon = Object.assign({}, window.__claude, { formaat: 'nieuwsartikel' });
    crNaarWizard();
    wizRenderOnderzoek();
    const el = document.getElementById('wiz-onderzoek');
    const tekst = el ? el.textContent : '';
    const zichtbaar = el ? el.style.display : null;
    /* En weg is weg -- maar de ingevulde velden blijven, want daar werk je
       inmiddels mee. */
    wizOnderzoekWeg();
    return { tekst: tekst, zichtbaar: zichtbaar,
             naWeg: (document.getElementById('wiz-onderzoek') || {}).style.display,
             veldenNaWeg: wizState.data.format.formatId };
  });
  check('de regel staat in beeld', regel.zichtbaar, 'block');
  check('met het merk erbij', /Concurrent BV/.test(regel.tekst), true);
  check('en hoeveel velden er al staan', /velden staan al ingevuld/.test(regel.tekst), true);
  check('het zegt ook wat er NIET meekwam', /niet meegekomen/.test(regel.tekst), true);
  check('en dat het product jouw keuze blijft', /kies je zelf/.test(regel.tekst), true);
  check('weghalen haalt de regel weg', regel.naWeg, 'none');
  check('maar niet de ingevulde velden', regel.veldenNaWeg, 'news-headline-advertorial');

  const zonderOnderzoek = await page.evaluate(() => {
    wizReset(true);
    wizRenderOnderzoek();
    const el = document.getElementById('wiz-onderzoek');
    return { zichtbaar: el ? el.style.display : null, tekst: el ? el.textContent : 'x' };
  });
  check('vanaf nul staat er geen regel', zonderOnderzoek.zichtbaar, 'none');
  check('en hij is ook echt leeg', zonderOnderzoek.tekst, '');

  console.log('\n  het beeld gaat via de worker, met het token');
  const beeld = await page.evaluate(() => {
    const b = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/beeld') > -1);
    return { aantal: b.length, auth: (b[0] || {}).auth,
             /* Het adres van de concurrent gaat als parameter mee, niet als
                pad: de browser mag daar niet rechtstreeks heen. */
             viaWorker: b.length ? /\/onderzoek\/beeld\?u=/.test(b[0].url) : false,
             rechtstreeks: window.__gevraagd.filter(g => /^https:\/\/x\.fbcdn\.net/.test(g.url)).length };
  });
  check('het beeld is opgehaald', beeld.aantal > 0, true);
  check('via de worker', beeld.viaWorker, true);
  check('met het teamtoken', beeld.auth, 'Bearer token-van-de-baas');
  check('en nooit rechtstreeks bij de concurrent', beeld.rechtstreeks, 0);

  console.log('\n  standaard kijken we naar onze Brand Tracker');
  /* Dit is de fout die het scherm nutteloos maakte: je drukt op analyseren en
     krijgt de hele markt, met een Duitse kinderopvang bovenaan. */
  /* De standaard zelf, vóór er iets gekozen is. Hem in de test eerst op
     'brandtracker' zetten en dan controleren bewijst niets -- dan test je je
     eigen regel. */
  const standaard = await page.evaluate(() => _cr.bereik);
  check('het bereik staat standaard op de Brand Tracker', standaard, 'brandtracker');
  const bereik = await page.evaluate(async () => {
    _cr.open = null; _cr.lijst = null; _cr.merken = null;
    await crHaalMerken();
    await crHaalLijst();
    const el = document.getElementById('cr-inhoud');
    const vraag = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/toplijst') > -1).pop();
    return {
      gevraagdBereik: (vraag.url.match(/bereik=([a-z]+)/) || [])[1],
      knop: (el.querySelector('[data-action="cr-haal"]') || {}).textContent,
      /* Welke bron er geanalyseerd wordt staat in de scope, naast de knop. Dit
         was de tekst OP de knop; het hoort ergens te staan, want een lijst van
         de hele markt die doorgaat voor je concurrenten is de fout die dit
         scherm nutteloos maakte. */
      scope: (el.querySelector('.cr-scope') || {}).textContent || '',
      merkknoppen: el.querySelectorAll('[data-action="cr-merk"]').length,
      tekst: el.textContent,
      /* Zoeken op een woord en filteren op land horen bij de hele markt. Bij de
         Brand Tracker doen ze niets, en een filter dat niets doet is erger dan
         een filter dat er niet is. */
      zoekveld: !!el.querySelector('#cr-zoek'),
      landveld: !!el.querySelector('#cr-land')
    };
  });
  check('de vraag gaat naar de Brand Tracker', bereik.gevraagdBereik, 'brandtracker');
  check('en de scope zegt dat ook', /Brand Tracker/.test(bereik.scope), true);
  check('met een knop die zegt wat hij doet', /Analyseer/.test(bereik.knop), true);
  check('elk gevolgd merk heeft zijn eigen knop', bereik.merkknoppen, 4);
  check('met hun naam', /Manscaped/.test(bereik.tekst) && /BALZY/.test(bereik.tekst), true);
  check('geen zoekveld bij de Brand Tracker', bereik.zoekveld, false);
  check('en geen landfilter', bereik.landveld, false);

  console.log('\n  de hele markt kan nog steeds, maar je kiest hem');
  const markt = await page.evaluate(async () => {
    document.querySelector('[data-action="cr-bereik"][data-id="markt"]').click();
    const el = document.getElementById('cr-inhoud');
    /* De lijst van het vorige bereik hoort weg te zijn. Hem laten staan terwijl
       de knop iets anders zegt is precies hoe je naar de markt kijkt in de
       veronderstelling dat het je concurrenten zijn. */
    const lijstWeg = !el.querySelector('.cr-kaart');
    await crHaalLijst();
    const vraag = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/toplijst') > -1).pop();
    return { lijstWeg, bereik: (vraag.url.match(/bereik=([a-z]+)/) || [])[1],
             zoekveld: !!document.getElementById('cr-zoek'),
             scope: (el.querySelector('.cr-scope') || {}).textContent || '' };
  });
  check('de oude lijst is weg bij het wisselen', markt.lijstWeg, true);
  check('en de vraag gaat naar de markt', markt.bereik, 'markt');
  check('daar is het zoekveld er wel', markt.zoekveld, true);
  check('en de scope zegt het', /hele markt/.test(markt.scope), true);
  await page.evaluate(async () => {
    document.querySelector('[data-action="cr-bereik"][data-id="brandtracker"]').click();
    await crHaalLijst();
  });

  console.log('\n  het scherm is een onderzoeksbouwer over de volle breedte');
  /* Het stond in een kolom met de halve pagina leeg ernaast: filterrijen onder
     elkaar, en dan pas de kaarten. Nu bouw je bovenin het onderzoek -- merk,
     concurrenten, doel -- naast elkaar, en daaronder komt de uitslag. */
  const breed = await page.evaluate(async () => {
    /* Zichtbaar zetten voor we meten: een vak dat niet getekend wordt is nul
       pixels breed, en dan slaagt een breedtecontrole zonder iets te meten. */
    switchMainTab('research');
    await crHaalLijst();
    var el = document.getElementById('cr-inhoud');
    var raster = el.querySelector('.cr-bouwraster');
    var blokken = raster ? raster.querySelectorAll(':scope > .cr-blok') : [];
    var uitslag = el.querySelector('.cr-uitslag');
    var scope = el.querySelector('.cr-scope');
    var breedte = function (n) { return n ? n.getBoundingClientRect().width : 0; };
    return {
      bouwer: !!el.querySelector('.cr-bouw'),
      blokken: blokken.length,
      /* De drie bouwblokken staan naast elkaar, niet onder elkaar. */
      naastElkaar: blokken.length === 3 &&
        breedte(blokken[0]) > 100 &&
        Math.abs(blokken[0].getBoundingClientRect().top - blokken[2].getBoundingClientRect().top) < 4,
      /* Het middenblok (de concurrenten) is het breedst: daar zit het werk. */
      middenBreedst: blokken.length === 3 &&
        breedte(blokken[1]) > breedte(blokken[0]) && breedte(blokken[1]) > breedte(blokken[2]),
      /* En de uitslag loopt over de volle breedte eronder. */
      uitslagOnder: !!uitslag && !!raster &&
        uitslag.getBoundingClientRect().top > raster.getBoundingClientRect().bottom - 1 &&
        breedte(uitslag) > breedte(raster) * 0.95,
      eigenContainer: uitslag ? getComputedStyle(uitslag).containerName : '',
      /* De scope staat naast de filters en zegt wat er straks gevraagd wordt. */
      scopeErnaast: !!scope && breedte(scope) > 100,
      /* De kaarten staan naast elkaar; dat is waar die breedte voor is. */
      kolommen: (function () {
        var k = uitslag ? uitslag.querySelectorAll('.cr-kaart') : [];
        if (k.length < 2) return 0;
        var eerste = k[0].getBoundingClientRect().top, n = 0;
        for (var i = 0; i < k.length; i++) {
          if (Math.abs(k[i].getBoundingClientRect().top - eerste) < 4) n++;
        }
        return n;
      })()
    };
  });
  check('er is een onderzoeksbouwer', breed.bouwer, true);
  check('met drie blokken', breed.blokken, 3);
  check('die naast elkaar staan', breed.naastElkaar, true);
  check('en de concurrenten krijgen de meeste ruimte', breed.middenBreedst, true);
  check('de uitslag staat eronder, over de volle breedte', breed.uitslagOnder, true);
  check('en meet zijn kolommen tegen zijn eigen vlak', breed.eigenContainer, 'crlijst');
  check('de scope staat erbij', breed.scopeErnaast, true);
  check('en de kaarten staan naast elkaar', breed.kolommen >= 2, true);

  console.log('\n  je kiest zelf welke merken meedoen');
  /* Het was een merk OF alles. Daartussen zit precies wat je wilt: de
     concurrenten van het ene merk zonder die van het andere erbij. */
  const keuze = await page.evaluate(async () => {
    var el = document.getElementById('cr-inhoud');
    el.querySelector('[data-action="cr-merk"][data-id="m2"]').click();
    el.querySelector('[data-action="cr-merk"][data-id="m3"]').click();
    await crHaalLijst();
    var vraag = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/toplijst') > -1).pop();
    var twee = (vraag.url.match(/merken=([^&]+)/) || [])[1];
    /* Nog een keer drukken zet hem weer uit. */
    el = document.getElementById('cr-inhoud');
    el.querySelector('[data-action="cr-merk"][data-id="m3"]').click();
    var naUit = (_cr.merkSel || []).slice();
    /* Leeg is alles, en dan gaat er geen merkfilter mee. */
    document.getElementById('cr-inhoud').querySelector('[data-action="cr-merk-alles"]').click();
    await crHaalLijst();
    var alles = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/toplijst') > -1).pop();
    return {
      twee: decodeURIComponent(twee || ''),
      naUit: naUit,
      allesHeeftGeenFilter: /merken=/.test(alles.url),
      /* En bij niets gekozen doet iedereen mee -- dat is iets anders dan
         niemand, en het scherm hoort dat te zeggen. */
      allesTelt: crGekozenMerken().length
    };
  });
  check('twee merken gaan samen mee in de vraag', keuze.twee, 'm2,m3');
  check('nog een keer drukken zet er een uit', keuze.naUit, ['m2']);
  check('alle merken betekent geen merkfilter', keuze.allesHeeftGeenFilter, false);
  check('en dan doen ze allemaal mee', keuze.allesTelt, 4);

  console.log('\n  de merkcontext kiest zijn eigen concurrenten');
  /* Voor welk van onze merken doe je dit onderzoek? Dat is geen sier: de
     concurrenten van Wellshave en die van Wellshine zijn twee markten. */
  const context = await page.evaluate(() => {
    var el = document.getElementById('cr-inhoud');
    var kaarten = el.querySelectorAll('[data-action="cr-context"]');
    el.querySelector('[data-action="cr-context"][data-id="13318"]').click();
    var na = { sel: (_cr.merkSel || []).slice(), context: _cr.context, bereik: _cr.bereik };
    /* En terug naar alles laat geen selectie van dat merk achter: dan sta je op
       "alle gevolgde merken" terwijl er nog vier aangevinkt staan. */
    document.getElementById('cr-inhoud')
      .querySelector('[data-action="cr-bereik"][data-id="brandtracker"]').click();
    var terug = { sel: (_cr.merkSel || []).slice(), context: _cr.context };
    /* De hele markt is geen eenrichtingsdeur: er is een weg terug. */
    document.getElementById('cr-inhoud')
      .querySelector('[data-action="cr-bereik"][data-id="markt"]').click();
    var wegTerug = !!document.getElementById('cr-inhoud')
      .querySelector('[data-action="cr-bereik"][data-id="brandtracker"]');
    document.getElementById('cr-inhoud')
      .querySelector('[data-action="cr-bereik"][data-id="brandtracker"]').click();
    return { kaarten: kaarten.length, na: na, terug: terug, wegTerug: wegTerug };
  });
  check('elke map is een merkcontext, plus alles en de markt', context.kaarten, 2);
  check('een context selecteert zijn concurrenten', context.na.sel, ['m1', 'm2']);
  check('en zet het bereik op de Brand Tracker', context.na.bereik, 'brandtracker');
  check('terug naar alles laat geen selectie achter', context.terug, { sel: [], context: '' });
  check('en vanaf de hele markt is er een weg terug', context.wegTerug, true);

  console.log('\n  de concurrenten zijn kaarten, geen pillen');
  const merkkaarten = await page.evaluate(() => {
    var el = document.getElementById('cr-inhoud');
    var kaart = el.querySelector('.cr-merkkaart');
    var uit = {
      aantal: el.querySelectorAll('.cr-merkkaart').length,
      /* Logo, naam en telling op elke kaart: dat is wat je laat scannen. */
      heeftLogo: !!kaart.querySelector('.cr-logo'),
      naam: (kaart.querySelector('.cr-merknaam') || {}).textContent,
      telling: (kaart.querySelector('.cr-merksub') || {}).textContent,
      /* En de keuze is te zien zonder de randkleur met de buurman te
         vergelijken. */
      gedrukt: kaart.getAttribute('aria-pressed')
    };
    kaart.click();
    var na = document.getElementById('cr-inhoud').querySelector('.cr-merkkaart');
    uit.naKlik = na.getAttribute('aria-pressed');
    uit.markering = na.classList.contains('aan');
    /* Zoeken krimpt de lijst en laat de rest staan. */
    _cr.merkZoek = 'balz';
    crRender();
    uit.naZoek = document.getElementById('cr-inhoud').querySelectorAll('.cr-merkkaart').length;
    _cr.merkZoek = 'zzzz';
    crRender();
    uit.geenTreffer = document.getElementById('cr-inhoud').querySelectorAll('.cr-merkkaart').length;
    uit.zegtHetOok = /Geen merk met/.test(document.getElementById('cr-inhoud').textContent);
    _cr.merkZoek = '';
    _cr.merkSel = [];
    crRender();
    return uit;
  });
  check('elk merk krijgt een kaart', merkkaarten.aantal, 4);
  check('met een logo', merkkaarten.heeftLogo, true);
  check('een naam', merkkaarten.naam, 'Manscaped');
  check('en het aantal actieve ads', merkkaarten.telling, '155 actieve ads');
  check('de kaart zegt of hij aan staat', [merkkaarten.gedrukt, merkkaarten.naKlik], ['false', 'true']);
  check('en toont dat ook', merkkaarten.markering, true);
  check('zoeken krimpt de lijst', merkkaarten.naZoek, 1);
  check('geen treffer laat de andere merken staan', merkkaarten.geenTreffer, 0);
  check('en zegt dat het er wel zijn', merkkaarten.zegtHetOok, true);

  console.log('\n  de scope zegt wat er straks gevraagd wordt');
  /* Een knop met "Analyseer" zonder te zeggen waarover is precies hoe je de
     hele markt analyseert in de veronderstelling dat het je concurrenten zijn. */
  const scope = await page.evaluate(() => {
    _cr.merkSel = ['m2']; crZetDoel('evergreen'); _cr.dagen = 30; crRender();
    var t = document.getElementById('cr-inhoud').querySelector('.cr-scope').textContent;
    _cr.merkSel = []; crZetDoel('looptijd'); _cr.dagen = 14; crRender();
    return t;
  });
  check('de scope noemt de bron', /Brand Tracker/.test(scope), true);
  check('hoeveel merken', /1 van de 4/.test(scope), true);
  check('het doel', /Evergreen winners/.test(scope), true);
  check('het venster', /30 dagen/.test(scope), true);
  check('en de minimale looptijd die het doel zette', /90\+ dagen/.test(scope), true);

  console.log('\n  de mappen van de Brand Tracker zijn de echte groepen');
  /* Wellshave en Wellshine hebben elk hun eigen concurrenten. Op een hoop is
     dat een analyse van twee markten tegelijk, en dus van geen van beide. */
  const mappen = await page.evaluate(async () => {
    var el = document.getElementById('cr-inhoud');
    var knoppen = el.querySelectorAll('[data-action="cr-map"]');
    el.querySelector('[data-action="cr-map"][data-id="13318"]').click();
    var naMap = (_cr.merkSel || []).slice();
    /* Nog een keer op dezelfde map: terug naar alles. */
    document.getElementById('cr-inhoud').querySelector('[data-action="cr-map"][data-id="13318"]').click();
    var naTweede = (_cr.merkSel || []).slice();
    /* Geen mappen van de bron betekent geen groepen op het scherm -- ze hier
       verzinnen zou een indeling suggereren die niemand gemaakt heeft. */
    var bewaard = _cr.mappen;
    _cr.mappen = [];
    var zonder = crMappenRij();
    _cr.mappen = bewaard;
    return { aantal: knoppen.length, naMap: naMap, naTweede: naTweede, zonder: zonder };
  });
  check('elke map is een knop', mappen.aantal, 2);
  check('een map kiest zijn merken in één klik', mappen.naMap, ['m1', 'm2']);
  check('en nog een keer drukken zet hem uit', mappen.naTweede, []);
  check('zonder mappen staat er geen rij', mappen.zonder, '');

  console.log('\n  het logo komt van het domein dat bij de naam hoort');
  /* Het eerste domein is vaak de landingsplek. Het logo van Amazon boven
     Manscaped is erger dan geen logo. */
  const logos = await page.evaluate(() => {
    var m = window.__merken;
    return {
      manscaped: crMerkDomein(m[0]),
      balzy: crMerkDomein(m[1]),
      cloudnine: crMerkDomein(m[2]),
      /* Geen enkel domein hoort bij deze naam: dan geen logo. */
      skull: crMerkDomein(m[3]),
      skullHtml: /<img/.test(crLogoHtml(m[3])),
      letter: (crLogoHtml(m[3]).match(/<i>([^<]*)<\/i>/) || [])[1],
      manscapedHtml: /favicons\?sz=64&domain=manscaped\.com/.test(crLogoHtml(m[0])),
      valtTerug: /onerror="this\.remove\(\)"/.test(crLogoHtml(m[0]))
    };
  });
  check('manscaped krijgt zijn eigen domein, niet amazon', logos.manscaped, 'manscaped.com');
  check('balzy ook', logos.balzy, 'balzy.nl');
  check('en een naam met een spatie vindt zijn domein', logos.cloudnine, 'cloudninehair.com');
  check('een merk zonder passend domein krijgt er geen', logos.skull, '');
  check('en dus geen vreemd logo', logos.skullHtml, false);
  check('maar wel zijn beginletter', logos.letter, 'S');
  check('het logo hangt aan het juiste domein', logos.manscapedHtml, true);
  check('en valt terug op de letter als het niet laadt', logos.valtTerug, true);

  console.log('\n  filteren over wat er al binnen is');
  /* Dit vraagt niets nieuws op: het verbergt wat je nu niet wilt zien. En dat
     verschil hoort op het scherm te staan -- "geen video gevonden" en "video
     verborgen" zijn twee heel verschillende uitslagen. */
  const toon = await page.evaluate(async () => {
    await crHaalLijst();
    var alles = crZichtbaar().length;
    _cr.toonSoort = 'video';
    var video = crZichtbaar().length;
    crRender();
    var melding = document.getElementById('cr-inhoud').textContent;
    _cr.toonSoort = '';
    _cr.minDagen = 180;
    var lang = crZichtbaar().length;
    _cr.minDagen = 0;
    crRender();
    return { alles: alles, video: video, lang: lang,
             zegtVerborgen: /staan hier niet/.test(melding) };
  });
  check('zonder filter zie je alles', toon.alles > 0, true);
  check('op video blijft de video over', toon.video, 1);
  check('en dat is minder dan alles', toon.video < toon.alles, true);
  check('het scherm zegt hoeveel er verborgen is', toon.zegtVerborgen, true);
  check('en een lange looptijd filtert de korte weg', toon.lang < toon.alles, true);

  console.log('\n  de weg terug werkt, ook met de knop van de browser');
  /* Een detailweergave zonder weg terug is een doodlopende weg, en de eerste
     plek waar iemand hem zoekt is de terugknop van de browser -- niet een link
     in de pagina. */
  const geopend = await page.evaluate(() => {
    const el = document.getElementById('cr-inhoud');
    el.querySelector('.cr-kaart').click();
    return { open: !!el.querySelector('.cr-detail'),
             stapErbij: !!(history.state && history.state.crOpen === true) };
  });
  check('de advertentie opent', geopend.open, true);
  check('en zet een stap in de geschiedenis', geopend.stapErbij, true);
  /* Alleen echt teruggaan als die stap er is. Zonder die stap navigeert
     history.back() de hele pagina weg en klapt de test op iets anders dan
     waar het om gaat. */
  const terug = geopend.stapErbij ? await page.evaluate(async () => {
    history.back();
    await new Promise(r => setTimeout(r, 80));
    const el = document.getElementById('cr-inhoud');
    return { naTerug: !!el.querySelector('.cr-detail'), lijstTerug: !!el.querySelector('.cr-kaart') };
  }) : { naTerug: true, lijstTerug: false };
  check('de terugknop van de browser sluit hem', terug.naTerug, false);
  check('en de lijst staat er weer', terug.lijstTerug, true);

  const terugKnop = await page.evaluate(async () => {
    const el = document.getElementById('cr-inhoud');
    el.querySelector('.cr-kaart').click();
    const k = document.getElementById('cr-inhoud').querySelector('[data-action="cr-sluit"]');
    /* De knop in de pagina moet eruitzien als een knop, niet als een zinnetje:
       in de vorige versie was hij tekst in de kleur van een bijschrift. */
    const stijl = k ? getComputedStyle(k) : null;
    const heeftRand = stijl && stijl.borderStyle !== 'none' && parseFloat(stijl.borderTopWidth) > 0;
    const heeftPijl = !!(k && k.querySelector('svg'));
    k.click();
    await new Promise(r => setTimeout(r, 60));
    return { heeftRand, heeftPijl,
             dicht: !document.getElementById('cr-inhoud').querySelector('.cr-detail') };
  });
  check('de knop in de pagina heeft een rand', terugKnop.heeftRand, true);
  check('en een pijl', terugKnop.heeftPijl, true);
  check('en sluit hem ook', terugKnop.dicht, true);

  console.log('\n  het antwoord zegt hoe er gerangschikt is');
  const uitleg = await page.evaluate(async () => {
    window.__antwoord = Object.assign({}, window.__antwoord, {
      hoe_gerangschikt: 'Per gevolgd merk zijn de 6 best presterende advertenties opgehaald (2 van de 2 merken).',
      merken_mislukt: ['Freebird: die is stuk']
    });
    _cr.open = null;
    await crHaalLijst();
    return document.getElementById('cr-inhoud').textContent;
  });
  check('dat staat op het scherm', /6 best presterende/.test(uitleg), true);
  /* Een lijst die stil korter is dan hij hoort te zijn leest als "die
     concurrent doet even niets". */
  check('en welk merk ontbrak', /Freebird/.test(uitleg), true);

  console.log('\n  als er geen beeld uitkomt, zegt het scherm welke velden er wel waren');
  const veldMelding = await page.evaluate(async () => {
    const bewaard = window.__antwoord;
    window.__antwoord = Object.assign({}, bewaard, {
      velden_zonder_beeld: ['id', 'creative', 'snapshot']
    });
    _cr.open = null;
    await crHaalLijst();
    const met = document.getElementById('cr-inhoud').textContent;
    /* En als het wel goed gaat staat er niets: een technische melding die er
       altijd staat wordt genegeerd, en dan is hij er niet als je hem nodig hebt. */
    window.__antwoord = bewaard;
    await crHaalLijst();
    const zonder = document.getElementById('cr-inhoud').textContent;
    return { met, zonder };
  });
  check('de veldnamen komen in beeld', /creative, snapshot/.test(veldMelding.met), true);
  check('met wat eraan te doen is', /Stuur die regel door/.test(veldMelding.met), true);
  check('en bij een goed antwoord staat er niets',
    /Geen beeld te vinden/.test(veldMelding.zonder), false);

  console.log('\n  waar bereik ontbreekt komt de positie in beeld');
  /* Bij een gevolgd merk geeft TrendTrack geen bereik. Drie streepjes op een
     kaart geven je niets om op te kiezen; de positie binnen de advertenties van
     dat merk wel. */
  const rang = await page.evaluate(() => {
    const zonderBereik = { id: 'x', merk: 'MANSCAPED', beeld: null, copy: {},
      bereik: null, varianten: null, dagen_actief: 8, rang: 3, rang_delta: 33 };
    const metBereik = { id: 'y', merk: 'Ander', beeld: null, copy: {},
      bereik: 412000, varianten: 4, dagen_actief: 96, rang: 12, rang_delta: null };
    const d = document.createElement('div');
    d.innerHTML = crKaartHtml(zonderBereik, 0) + crKaartHtml(metBereik, 1);
    const kaarten = d.querySelectorAll('.cr-cijfers');
    return { zonder: kaarten[0].textContent, met: kaarten[1].textContent };
  });
  check('de positie staat er, met een hekje', /positie #3/.test(rang.zonder), true);
  check('en hoeveel hij gestegen is', /\+33 gestegen/.test(rang.zonder), true);
  check('geen leeg bereik als streepje', /bereik/.test(rang.zonder), false);
  /* En waar bereik er wel is blijft dat leidend: de positie is de terugval,
     geen extra kolom die er altijd bij komt. */
  check('met bereik blijft het bereik staan', /412k bereik/.test(rang.met), true);
  check('en dan geen positie', /positie/.test(rang.met), false);

  console.log('\n  een antwoord dat niet is wat je vroeg wordt gemeld');
  /* Dit gebeurde echt: de console was uitgerold en de worker niet. Die kende de
     bereik-parameter nog niet, negeerde hem zwijgend en stuurde de hele markt
     terug -- en het scherm zette "Analyseer onze Brand Tracker" boven een lijst
     met een Duitse kinderopvang erin. Het geloofde zijn eigen knop in plaats
     van het antwoord. */
  const mismatch = await page.evaluate(async () => {
    _cr.open = null; _cr.bereik = 'brandtracker';
    /* Een oude worker: geen bereik in het antwoord. */
    const bewaard = window.__antwoord;
    window.__antwoord = Object.assign({}, bewaard);
    delete window.__antwoord.bereik;
    await crHaalLijst();
    const zonderVeld = document.getElementById('cr-inhoud').textContent;
    /* En een worker die iets anders terugstuurt dan gevraagd. */
    window.__antwoord = Object.assign({}, bewaard, { bereik: 'markt' });
    await crHaalLijst();
    const anderBereik = document.getElementById('cr-inhoud').textContent;
    /* En als het wel klopt: geen waarschuwing. Een melding die er altijd staat
       wordt niet gelezen. */
    window.__antwoord = Object.assign({}, bewaard, { bereik: 'brandtracker' });
    await crHaalLijst();
    const klopt = document.getElementById('cr-inhoud').textContent;
    window.__antwoord = bewaard;
    return { zonderVeld, anderBereik, klopt };
  });
  check('een oude worker wordt herkend', /ouder dan deze console/.test(mismatch.zonderVeld), true);
  check('met wat je moet doen', /versie 22 of hoger/.test(mismatch.zonderVeld), true);
  check('en wat je nu ziet', /de hele markt, niet onze Brand Tracker/.test(mismatch.zonderVeld), true);
  check('een ander bereik wordt gemeld', /niet waar de knop om vroeg/.test(mismatch.anderBereik), true);
  check('met wat er gevraagd is', /om onze Brand Tracker gevraagd/.test(mismatch.anderBereik), true);
  /* En de tegenproef: klopt het, dan staat er niets. */
  check('bij een kloppend antwoord geen waarschuwing',
    /Dit is niet wat je vroeg/.test(mismatch.klopt), false);

  console.log('\n  een foutmelding is nooit [object Object]');
  /* Vijfde keer dat ditzelfde patroon toeslaat: er komt een object binnen waar
     tekst verwacht werd, String() maakt er "[object Object]" van, en dat komt
     zo op het scherm. Eerder was het het Score-veld in het dossier; nu de
     foutmelding van de worker, die bij een onbekende route een object geeft en
     bij een geweigerde login een string. */
  const vormen = await page.evaluate(() => ({
    string: wgFoutTekst({ error: 'unauthorized' }, 401),
    object: wgFoutTekst({ error: { message: 'Gebruik /systeem/*' } }, 404),
    genest: wgFoutTekst({ error: { error: { message: 'twee lagen diep' } } }, 500),
    losseMessage: wgFoutTekst({ message: 'zo doet Atria het' }, 502),
    lijst: wgFoutTekst({ error: ['eerste', 'tweede'] }, 400),
    /* Niets bruikbaars: dan een eerlijke zin met de status, niet de letterlijke
       tekst "[object Object]" en ook geen lege melding. */
    leeg: wgFoutTekst({}, 503),
    niets: wgFoutTekst(null, 500),
    letterlijk: wgFoutTekst({ error: '[object Object]' }, 500),
    /* Een kringverwijzing mag geen vastloper worden. Netjes afvangen, want een
       test die op een stack overflow klapt meldt alleen dát hij klapte -- niet
       wat er stuk is. */
    kring: (function () {
      const a = { error: {} }; a.error.error = a;
      try { return wgFoutTekst(a, 500); }
      catch (e) { return 'VASTGELOPEN: ' + String(e && e.message).slice(0, 40); }
    })()
  }));
  check('een string komt er gewoon uit', vormen.string, 'unauthorized');
  check('een object wordt uitgepakt', vormen.object, 'Gebruik /systeem/*');
  check('ook twee lagen diep', vormen.genest, 'twee lagen diep');
  check('en een losse message', vormen.losseMessage, 'zo doet Atria het');
  check('een lijst wordt samengevoegd', vormen.lijst, 'eerste , tweede');
  check('niets bruikbaars levert de status op', vormen.leeg, 'de server antwoordde met 503 zonder uitleg');
  check('en helemaal niets ook', vormen.niets, 'de server antwoordde met 500 zonder uitleg');
  check('de letterlijke tekst wordt geweigerd', vormen.letterlijk, 'de server antwoordde met 500 zonder uitleg');
  check('een kringverwijzing loopt niet vast', vormen.kring, 'de server antwoordde met 500 zonder uitleg');

  console.log('\n  en een te oude worker zegt dat, niet iets algemeens');
  /* Dit is de fout die je het vaakst krijgt: de console is uitgerold en de
     worker nog niet. Dan bestaat de route in de browser en niet op de server,
     en antwoordt de worker met een zin over /systeem en /anthropic waar de
     lezer niets aan heeft. */
  const teOud = await page.evaluate(async () => {
    const echt = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).indexOf('/onderzoek/toplijst') > -1) {
        return { ok: false, status: 404,
                 json: async () => ({ error: { message: 'Gebruik /systeem/*, POST /anthropic of /openai/… (of GET /health).' } }) };
      }
      return echt(u, o);
    };
    _cr.open = null;
    await crHaalLijst();
    const t = document.getElementById('cr-inhoud').textContent;
    window.fetch = echt;
    return t;
  });
  check('geen [object Object] meer', /\[object Object\]/.test(teOud), false);
  check('er staat wat er moet gebeuren', /wrangler deploy/.test(teOud), true);
  check('en waaraan je ziet of het gelukt is', /versie 20 of hoger/.test(teOud), true);

  console.log('\n  een videoadvertentie is geen zwart vlak');
  /* Eerst de lijst terug: de controles hiervoor lieten hem gefilterd of leeg
     achter, en dan meet ik iets anders dan ik denk. */
  await page.evaluate(async () => { _cr.open = null; await crHaalLijst(); });
  /* Dit is de fout waarmee dit begon: de mp4 stond in het beeldveld, het scherm
     zette hem in een <img>, en er verscheen een zwart vlak zonder melding. Nu
     staat de poster er, met een speelmerk erop zodat je ziet dat er iets te
     zien is. */
  const kaarten = await page.evaluate(() => {
    const alle = [...document.querySelectorAll('.cr-kaart')];
    return alle.map(k => ({ speel: !!k.querySelector('.cr-speel'), tekst: k.textContent }));
  });
  check('er staan drie kaarten om naar te kijken', kaarten.length, 3);
  check('de videoadvertentie draagt een speelmerk', (kaarten[2] || {}).speel, true);
  check('en een still niet', (kaarten[0] || {}).speel, false);

  /* En het speelmerk overleeft het binnenkomen van de poster. De beelden komen
     na de lijst binnen en vervingen eerst het hele vak -- inclusief het merk. */
  const naBeeld = await page.evaluate(async () => {
    await crLaadBeelden();
    const k = document.querySelectorAll('.cr-kaart')[2];
    return { speel: !!k.querySelector('.cr-speel'), plaatje: !!k.querySelector('img') };
  });
  check('de poster staat er', naBeeld.plaatje, true);
  check('en het speelmerk staat er nog steeds', naBeeld.speel, true);

  /* Openen en sluiten lopen via de geschiedenis, en die is asynchroon: na
     crSluitAd komt er nog een popstate achteraan die het detail opnieuw zou
     sluiten. Vandaar wachten tot het scherm werkelijk staat in plaats van op
     een aantal milliseconden gokken. */
  await page.evaluate(() => {
    window.__wacht = async function (kies, aan) {
      for (var i = 0; i < 60; i++) {
        if (!!document.querySelector(kies) === aan) return true;
        await new Promise(r => setTimeout(r, 25));
      }
      return false;
    };
  });

  console.log('\n  het bestand komt pas als je de advertentie opent');
  const voorOpenen = await page.evaluate(() =>
    window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/video') > -1).length);
  check('de lijst haalt geen films binnen', voorOpenen, 0);

  const speler = await page.evaluate(async () => {
    document.querySelectorAll('.cr-kaart')[2].click();
    await window.__wacht('.cr-detail-beeld video', true);
    const v = document.querySelector('.cr-detail-beeld video');
    const g = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/video') > -1);
    return {
      speler: !!v,
      poster: v ? /^blob:/.test(v.getAttribute('poster') || '') : null,
      bron: v ? /^blob:/.test(v.getAttribute('src') || '') : null,
      knoppen: v ? v.hasAttribute('controls') : null,
      aantal: g.length,
      /* Via onze eigen poort, met het token -- niet rechtstreeks naar Meta. */
      viaOns: g.length ? /\/onderzoek\/video\?u=/.test(g[0].url) : null,
      auth: g.length ? g[0].auth : null,
      rechtstreeks: window.__gevraagd.filter(g => /^https:\/\/x\.fbcdn\.net\/film/.test(g.url)).length
    };
  });
  check('er staat een speler', speler.speler, true);
  check('met bedieningsknoppen', speler.knoppen, true);
  check('het bestand komt uit een lokaal adres', speler.bron, true);
  check('en de poster ook', speler.poster, true);
  check('één keer opgehaald', speler.aantal, 1);
  check('via onze eigen poort', speler.viaOns, true);
  check('met het teamtoken', speler.auth, 'Bearer token-van-de-baas');
  check('en niet rechtstreeks bij Meta', speler.rechtstreeks, 0);

  /* Een tweede keer openen haalt hem niet opnieuw op. Een film van vijf mega
     per klik op "terug" en weer terug is een rekening zonder doel. */
  const nogmaals = await page.evaluate(async () => {
    crSluitAd(false);
    await window.__wacht('.cr-kaart', true);
    document.querySelectorAll('.cr-kaart')[2].click();
    await window.__wacht('.cr-detail-beeld video', true);
    return window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/video') > -1).length;
  });
  check('en blijft daarna staan', nogmaals, 1);

  console.log('\n  een video die niet komt zegt dat, en blijft niet laden');
  const stukkeVideo = await page.evaluate(async () => {
    crSluitAd(false);
    await window.__wacht('.cr-kaart', true);
    window.__videoStuk = true;
    delete _cr.videos['https://x.fbcdn.net/film.mp4'];
    document.querySelectorAll('.cr-kaart')[2].click();
    await window.__wacht('.cr-detail-beeld', true);
    /* Wachten tot het antwoord er is, en dus NIET op "video laden" -- die
       stond er al voordat er iets misging. */
    for (var i = 0; i < 80 && !/kwam niet binnen/.test(
      (document.querySelector('.cr-detail-beeld') || {}).textContent || ''); i++) {
      await new Promise(r => setTimeout(r, 25));
    }
    const t = (document.querySelector('.cr-detail-beeld') || {}).textContent || '(geen detail)';
    window.__videoStuk = false;
    return t;
  });
  check('de melding staat op het scherm', /De video kwam niet binnen/.test(stukkeVideo), true);
  check('en hij staat niet eeuwig te laden', /video laden/.test(stukkeVideo), false);

  console.log('\n  de beelden waar Nick naar kijkt');
  /* Claude kijkt geen video. Wat hij krijgt zijn stilstaande beelden uit het
     bestand, verspreid over de looptijd -- de hook vooraan, de CTA achteraan.
     Zes keer hetzelfde beeld is de fout die je niet ziet: het antwoord ziet er
     dan precies zo uit als een goed antwoord. */
  const tijden = await page.evaluate(() => ({
    zes: crFrameTijden(30, 6),
    kort: crFrameTijden(3, 6),
    /* Een video zonder bekende duur: één beeld, en dat is waar. Verzonnen
       tijdstippen leveren zwarte beelden op. */
    onbekend: crFrameTijden(Infinity, 6),
    nul: crFrameTijden(0, 6)
  }));
  check('zes beelden over dertig seconden', tijden.zes.map(t => Math.round(t * 100) / 100), [0, 6, 12, 18, 24, 29.85]);
  check('het laatste beeld valt net voor het einde', tijden.zes[5] < 30, true);
  check('bij een korte video schuiven ze mee', tijden.kort.length, 6);
  check('een onbekende duur levert één beeld', tijden.onbekend, [0]);
  check('en een lege video ook', tijden.nul, [0]);

  /* En de lus die de beelden werkelijk trekt. Een echte <video> valt hier niet
     te maken zonder een echt bestand, dus staat er een dubbelganger die zich
     gedraagt zoals de API belooft: springen naar een tijdstip, "seeked" melden,
     en dan een ander beeld tonen. Wat hier bewaakt wordt is dat er per tijdstip
     GEEN kopie van hetzelfde beeld uitkomt. */
  const frames = await page.evaluate(async () => {
    const doek = document.createElement('canvas');
    doek.width = 40; doek.height = 40;
    const ctx = doek.getContext('2d');
    let t = 0;
    Object.defineProperty(doek, 'duration', { value: 10 });
    Object.defineProperty(doek, 'videoWidth', { value: 40 });
    Object.defineProperty(doek, 'videoHeight', { value: 40 });
    Object.defineProperty(doek, 'currentTime', {
      get: () => t,
      set: function (w) {
        t = w;
        /* Zoals een echte speler het doet: het beeld verandert PAS als het
           springen klaar is. Wie meteen na het zetten van currentTime tekent,
           tekent het vorige beeld -- en krijgt zes keer hetzelfde zonder dat er
           iets misgaat dat je kunt zien. */
        setTimeout(() => {
          ctx.fillStyle = 'hsl(' + Math.round(w * 36) + ' 90% 50%)';
          ctx.fillRect(0, 0, 40, 40);
          doek.dispatchEvent(new Event('seeked'));
        }, 2);
      }
    });
    const uit = await crVideoFrames(doek, 4);
    return { aantal: uit.length, tijden: uit.map(f => Math.round(f.t * 100) / 100),
             mimes: [...new Set(uit.map(f => f.mime))],
             verschillend: new Set(uit.map(f => f.b64)).size };
  });
  check('vier beelden', frames.aantal, 4);
  check('op de goede tijdstippen', frames.tijden, [0, 3.33, 6.67, 9.85]);
  check('als jpeg', frames.mimes, ['image/jpeg']);
  check('en het zijn vier VERSCHILLENDE beelden', frames.verschillend, 4);

  console.log('\n  en de prompt zegt wat Nick niet gezien heeft');
  /* Dit is het veld dat stil verzonnen wordt. Bij een videoadvertentie zit het
     mechanisme vaak in de voice-over, en die hoort hij niet. Staat dat er niet
     bij, dan schrijft hij op wat er gezegd zou kunnen zijn -- en dat ziet er
     precies zo uit als iets wat hij gelezen heeft. */
  const videoPrompt = await page.evaluate(() =>
    crPatroonPrompt(window.__antwoord.advertenties[2],
      [{ t: 0 }, { t: 6 }, { t: 12 }, { t: 18 }, { t: 24 }, { t: 29.85 }]));
  check('het zegt dat het een video is', /Dit is een VIDEO/.test(videoPrompt), true);
  check('met hoeveel beelden', /6 stilstaande beelden/.test(videoPrompt), true);
  check('en op welke seconden', /0s, 6s, 12s, 18s, 24s, 30s/.test(videoPrompt), true);
  check('het geluid ontbreekt en dat staat er', /geluid NIET/.test(videoPrompt), true);
  check('met wat dat betekent voor het mechanisme', /voice-over/.test(videoPrompt), true);
  check('en de opdracht om het veld dan leeg te laten', /laat het veld dan leeg/.test(videoPrompt), true);

  /* Bij een still staat er niets over video. Een prompt die altijd over
     ontbrekend geluid praat leert het model dat het er niet toe doet. */
  const stillPrompt = await page.evaluate(() => crPatroonPrompt(window.__antwoord.advertenties[0], null));
  check('een still krijgt geen videoregels', /VIDEO|geluid/.test(stillPrompt), false);

  console.log('\n  Nick krijgt de beelden, niet het bestand');
  const gestuurd = await page.evaluate(async () => {
    window.__videoStuk = false;
    _cr.open = window.__antwoord.advertenties[2];
    /* De eigen speler vervangen: een echt bestand valt hier niet te decoderen.
       Wat we bewaken is dat de beelden meegaan en de film niet. */
    const echteSpeler = window.crEigenSpeler;
    window.crEigenSpeler = async () => {
      const doek = document.createElement('canvas');
      doek.width = 20; doek.height = 20;
      const ctx = doek.getContext('2d');
      let t = 0;
      Object.defineProperty(doek, 'duration', { value: 12 });
      Object.defineProperty(doek, 'videoWidth', { value: 20 });
      Object.defineProperty(doek, 'videoHeight', { value: 20 });
      Object.defineProperty(doek, 'currentTime', { get: () => t, set: function (w) {
        t = w;
        setTimeout(() => {
          ctx.fillStyle = 'hsl(' + Math.round(w * 30) + ' 90% 50%)'; ctx.fillRect(0, 0, 20, 20);
          doek.dispatchEvent(new Event('seeked'));
        }, 2);
      } });
      return doek;
    };
    await crLeesPatroon();
    window.crEigenSpeler = echteSpeler;
    const v = window.__gevraagd.filter(g => g.url.indexOf('/anthropic') > -1).pop();
    const b = JSON.parse(v.body);
    const inhoud = b.messages[0].content;
    return {
      beelden: inhoud.filter(x => x.type === 'image').length,
      tekst: inhoud.filter(x => x.type === 'text').map(x => x.text).join(''),
      /* Het bestand zelf mag er niet in zitten -- geen blob-adres, geen mp4. */
      geenFilm: !/blob:|\.mp4/.test(v.body)
    };
  });
  check('zes beelden gingen mee', gestuurd.beelden, 6);
  check('met de uitleg erbij', /Dit is een VIDEO/.test(gestuurd.tekst), true);
  check('en het bestand zelf niet', gestuurd.geenFilm, true);

  console.log('\n  een fout van de bron komt op het scherm, niet in de console');
  const stuk = await page.evaluate(async () => {
    const echt = window.fetch;
    window.fetch = async (u, o) => {
      if (String(u).indexOf('/onderzoek/toplijst') > -1) {
        return { ok: false, status: 502, json: async () => ({ error: 'TrendTrack: de dienst antwoordde met 401' }) };
      }
      return echt(u, o);
    };
    _cr.open = null;
    await crHaalLijst();
    return document.getElementById('cr-inhoud').textContent;
  });
  check('de melding staat er', /Dat lukte niet/.test(stuk), true);
  check('met wat de bron zei', /antwoordde met 401/.test(stuk), true);

  check('en geen enkele paginafout onderweg', paginafouten, []);

  await browser.close();
  srv.close();
  console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
  process.exit(fout ? 1 : 0);
})();
