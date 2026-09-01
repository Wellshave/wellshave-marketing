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
        bereik: null, dagen_actief: null, varianten: null, eerst_gezien: null, land: null, taal: null }
    ]
  };
  window.__merken = [
    { id: 'm1', naam: 'Manscaped', domein: 'manscaped.com', actieve_ads: 155 },
    { id: 'm2', naam: 'BALZY', domein: 'balzy.nl', actieve_ads: 428 }
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
      return { ok: true, status: 200, json: async () => ({ merken: window.__merken }) };
    }
    if (u.indexOf('/onderzoek/toplijst') > -1) {
      return { ok: true, status: 200, json: async () => window.__antwoord };
    }
    if (u.indexOf('/onderzoek/beeld') > -1) {
      return { ok: true, status: 200, blob: async () => new Blob(['x'], { type: 'image/jpeg' }) };
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

  console.log('\n  elke sortering zegt wat hij meet, en wat niet');
  /* Een optie die alleen zijn sterke kant noemt is reclame. De keerzijde staat
     er daarom bij, en dat is precies het soort regel dat bij een herschrijving
     stilletjes sneuvelt. */
  const sorteringen = await page.evaluate(() => {
    /* Van elke sortering nagaan of BEIDE helften werkelijk op het scherm komen.
       Alleen controleren dat het veld bestaat is niet genoeg: dan blijft dit
       blok groen terwijl de keerzijde nergens getekend wordt, en dat is precies
       de regel die bij een herschrijving als eerste sneuvelt. */
    const getekend = CR_SORTERINGEN.map(s => {
      _cr.sorteer = s.id;
      const html = crFilterHtml();
      const el = document.createElement('div');
      el.innerHTML = html;
      const t = el.textContent;
      return { id: s.id, zegt: t.indexOf(s.zegt) > -1, letop: t.indexOf(s.let_op) > -1 };
    });
    _cr.sorteer = 'looptijd';
    return {
      aantal: CR_SORTERINGEN.length,
      allemaalUitleg: CR_SORTERINGEN.filter(s => s.zegt && s.zegt.length > 30).length,
      allemaalKeerzijde: CR_SORTERINGEN.filter(s => s.let_op && s.let_op.length > 25).length,
      zonderZegt: getekend.filter(g => !g.zegt).map(g => g.id),
      zonderLetop: getekend.filter(g => !g.letop).map(g => g.id)
    };
  });
  check('drie sorteringen', sorteringen.aantal, 3);
  check('elk met uitleg', sorteringen.allemaalUitleg, 3);
  check('en elk met een keerzijde', sorteringen.allemaalKeerzijde, 3);
  check('elke uitleg komt ook werkelijk in beeld', sorteringen.zonderZegt, []);
  check('en elke keerzijde ook', sorteringen.zonderLetop, []);

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
  check('twee kaarten', lijst.kaarten, 2);
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

  console.log('\n  naar de wizard gaat het patroon, niet het werk van de ander');
  /* De duurste fout van de vier. Het patroon overnemen is de bedoeling; de
     copy, het beeld en de claim van een ander merk overnemen is het niet --
     die werken niet voor ons en ze zijn niet van ons. */
  const over = await page.evaluate(() => {
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
  check('en de knop zegt dat ook', /Brand Tracker/.test(bereik.knop), true);
  check('de gevolgde merken staan er, plus "alle"', bereik.merkknoppen, 3);
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
             knop: (el.querySelector('[data-action="cr-haal"]') || {}).textContent };
  });
  check('de oude lijst is weg bij het wisselen', markt.lijstWeg, true);
  check('en de vraag gaat naar de markt', markt.bereik, 'markt');
  check('daar is het zoekveld er wel', markt.zoekveld, true);
  check('en de knop zegt het', /hele markt/.test(markt.knop), true);
  await page.evaluate(async () => {
    document.querySelector('[data-action="cr-bereik"][data-id="brandtracker"]').click();
    await crHaalLijst();
  });

  console.log('\n  op een enkel merk inzoomen');
  const eenMerk = await page.evaluate(async () => {
    document.querySelector('[data-action="cr-merk"][data-id="m2"]').click();
    await crHaalLijst();
    const vraag = window.__gevraagd.filter(g => g.url.indexOf('/onderzoek/toplijst') > -1).pop();
    return (vraag.url.match(/merk=([a-z0-9]+)/) || [])[1];
  });
  check('het merk gaat mee in de vraag', eenMerk, 'm2');
  await page.evaluate(async () => {
    document.querySelector('[data-action="cr-merk"][data-id=""]').click();
    await crHaalLijst();
  });

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
