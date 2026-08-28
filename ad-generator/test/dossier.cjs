/* Het creative dossier — het detailscherm van een bewaarde static.
 *
 * Drie dingen komen hier samen die elk apart al mis konden gaan, en die alle
 * drie stil mislukken:
 *
 *   1. HET OORDEEL PER AS. Nick beoordeelt op vier assen in plaats van met
 *      een cijfer, want een enkel cijfer verbergt juist welke as zwak is --
 *      en dat is het enige waar je iets aan hebt. Levert het model iets
 *      anders dan zwak/gemiddeld/sterk, dan hoort dat geweigerd te worden en
 *      niet weergegeven: een veld met onzin ziet eruit alsof er een oordeel
 *      staat.
 *
 *   2. HET SCHARNIER NAAR DE LANDINGSPAGINA. De zwakste as bepaalt wat de
 *      pagina moet dichten. Zonder die koppeling is een beoordeling een
 *      rapportcijfer; met die koppeling is het een opdracht. Dit is het deel
 *      dat het makkelijkst stilletjes losraakt, want alles blijft er verder
 *      hetzelfde uitzien.
 *
 *   3. DE PROMPT IS AF. Een prompt die je nog moet aanvullen wordt aangevuld
 *      uit iemands hoofd, en dan staat er iets anders op de pagina dan in de
 *      advertentie. Dus: de kop moet erin, de hoek, het publiek, en het gat.
 *
 * En de bug die dit alles aan het licht bracht: bij "Score (1-5)" stond
 * letterlijk [object Object]. Het model antwoordde met een object en dat werd
 * blind naar tekst omgezet.
 *
 *   node ad-generator/test/dossier.cjs
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

/* Een ad set van drie, zoals hij uit de wizard komt. */
function FIXTURE() {
  const brief = {
    product: { productId: 'p1', funnel: 'tof', placement: 'feed45' },
    audience: { awareness: 'problem', sophistication: 's4', personaId: 'x' },
    strategy: {
      theme: 'Founder als bewijs', marketingAngle: 'De oprichter rekent het voor',
      messaging: 'Geen tussenhandel, dus geen reclamemarge', destination: 'advertorial',
      mechanism: 'Direct van fabriek naar deur', pain: 'Betalen voor het merk',
      desire: 'Niet voor de gek gehouden worden', objection: 'Te mooi om waar te zijn', proof: ''
    },
    copy: { headline: '184.000 Nederlanders kochten zijn scheerapparaat' },
    visual: {}
  };
  const mk = (i, id) => ({
    id: id, batch_id: 'b1', variant_index: i, saved_at: Date.now(),
    variation: {
      headline_nl: '184.000 Nederlanders kochten zijn scheerapparaat, dit is waarom',
      body_copy_nl: 'Hij begon als loodgieter, niet als groomingexpert.',
      cta_nl: 'Lees verder', visual_nl: 'Reportagefoto van de oprichter'
    },
    metadata: {
      product: 'Groom Guard', funnel: 'tof', placement: 'feed45', archetype: 'mix',
      awareness: 'problem', sophistication: 's4', personaName: 'Mark de Vries',
      wizardBrief: brief
    },
    matrix: {}
  });
  state.library = [mk(0, 'a'), mk(1, 'b'), mk(2, 'c')];
  return state.library[0];
}

function TEKEN(item) {
  const d = document.createElement('div');
  d.innerHTML = window.dosPaneelHtml(item);
  return d;
}

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const paginafouten = [];
  page.on('pageerror', e => paginafouten.push(String(e)));
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => typeof dosPaneelHtml === 'function');

  console.log('\n  een cijfer dat geen cijfer is wordt geweigerd');
  /* Dit is de bug die in de bibliotheek zichtbaar was: bij Score stond
     [object Object]. Het model antwoordde met {waarde: 4, reden: "..."} en
     String() op een object levert die tekst. Geen fout, geen melding, gewoon
     een veld met onzin dat er ingevuld uitziet. */
  const schoon = await page.evaluate(() => ({
    object: nickSchoon('score', { waarde: 4, reden: 'want zus en zo' }),
    objectZonderWaarde: nickSchoon('score', { toelichting: 'iets' }),
    getal: nickSchoon('score', 4),
    breuk: nickSchoon('score', '4/5'),
    zin: nickSchoon('score', 'score: 3 van de 5'),
    woord: nickSchoon('score', 'vier'),
    buitenBereik: nickSchoon('score', 9),
    letterlijk: nickSchoon('score', '[object Object]'),
    tekstveld: nickSchoon('hook', { waarde: 'Een kop' }),
    lijst: nickSchoon('hook', ['een', 'twee'])
  }));
  check('een object wordt uitgepakt', schoon.object, '4');
  check('een object zonder bruikbare sleutel levert niets', schoon.objectZonderWaarde, '');
  check('een getal blijft een getal', schoon.getal, '4');
  check('uit 4/5 komt de 4', schoon.breuk, '4');
  check('uit een zin komt het cijfer', schoon.zin, '3');
  /* Een woord is geen antwoord op "1 tot 5". Leeg is zichtbaar; "vier" in een
     cijferveld ziet eruit als een oordeel en is het niet. */
  check('een woord wordt geweigerd', schoon.woord, '');
  check('en een cijfer buiten het bereik ook', schoon.buitenBereik, '');
  check('de letterlijke tekst wordt geweigerd', schoon.letterlijk, '');
  check('een tekstveld pakt hetzelfde object uit', schoon.tekstveld, 'Een kop');
  check('en een lijst wordt een regel', schoon.lijst, 'een , twee');

  console.log('\n  de vier assen, en alleen de drie standen');
  const standen = await page.evaluate(() => ({
    aantal: NICK_ASSEN.length,
    sterk: nickStand('Sterk'), hoog: nickStand('hoog'), high: nickStand('High'),
    zwak: nickStand('zwak'), gemiddeld: nickStand('Gemiddeld'),
    /* Een heel verhaal betekent dat de vraag niet begrepen is. Dat levert
       niets op in plaats van een as met een alinea erin. */
    verhaal: nickStand('Nou, het hangt er een beetje vanaf hoe je het bekijkt'),
    leeg: nickStand(''), niets: nickStand(null)
  }));
  check('er zijn vier assen', standen.aantal, 4);
  check('sterk in alle vormen', [standen.sterk, standen.hoog, standen.high], ['sterk', 'sterk', 'sterk']);
  check('zwak en gemiddeld ook', [standen.zwak, standen.gemiddeld], ['zwak', 'gemiddeld']);
  check('een heel verhaal levert niets op', standen.verhaal, '');
  check('en leeg blijft leeg', [standen.leeg, standen.niets], ['', '']);

  console.log('\n  de zwakste as is het scharnier naar de landingspagina');
  /* Zonder deze koppeling is een beoordeling een rapportcijfer. Met deze
     koppeling weet de pagina wat hij moet repareren. */
  const scharnier = await page.evaluate(fx => {
    eval('(' + fx + ')()');
    const it = state.library[0];
    const uit = {};
    it.matrix = { as_strategie: 'sterk', as_executie: 'sterk', as_bewijs: 'gemiddeld', as_test: 'sterk' };
    const z = nickZwakstePunt(it);
    uit.as = z && z.as; uit.stand = z && z.stand;
    uit.inEisen = lpEisen(it).filter(e => e.gat).map(e => e.tekst.slice(0, 40));
    uit.inPrompt = /HET GAT DAT DEZE PAGINA MOET DICHTEN/.test(lpPrompt(it));
    /* Alles sterk: dan is er geen gat, en dan hoort er ook geen gat-kopje in
       de prompt te staan. Een prompt die altijd een gat noemt leert je die
       alinea over te slaan. */
    it.matrix = { as_strategie: 'sterk', as_executie: 'sterk', as_bewijs: 'sterk', as_test: 'sterk' };
    uit.geenZwak = nickZwakstePunt(it);
    uit.geenGatInEisen = lpEisen(it).filter(e => e.gat).length;
    uit.geenGatInPrompt = /HET GAT DAT DEZE PAGINA MOET DICHTEN/.test(lpPrompt(it));
    /* En zwak weegt zwaarder dan gemiddeld, ook als gemiddeld eerder in de
       lijst staat. */
    it.matrix = { as_strategie: 'gemiddeld', as_executie: 'sterk', as_bewijs: 'zwak', as_test: 'sterk' };
    uit.eerste = (nickZwakstePunt(it) || {}).as;
    return uit;
  }, FIXTURE.toString());
  check('de zwakke as wordt gevonden', [scharnier.as, scharnier.stand], ['as_bewijs', 'gemiddeld']);
  check('en levert een eis voor de pagina op', scharnier.inEisen.length, 1);
  check('die als gat in de prompt staat', scharnier.inPrompt, true);
  check('zonder zwakke as geen gat', scharnier.geenZwak, null);
  check('dus ook geen gat-eis', scharnier.geenGatInEisen, 0);
  check('en geen gat-kopje in de prompt', scharnier.geenGatInPrompt, false);
  /* Nu nog: de eerste die hij vindt is de eerste in de lijst, en strategie
     staat vooraan. Dat is met opzet -- een ad op de verkeerde as redt geen
     enkele uitvoering, dus die wordt eerst genoemd. */
  check('strategie gaat voor als hij ook niet sterk is', scharnier.eerste, 'as_strategie');

  console.log('\n  het soort landingspagina volgt uit wat er vastligt');
  const soort = await page.evaluate(fx => {
    eval('(' + fx + ')()');
    const it = state.library[0];
    const uit = { gekozen: lpSoort(it) };
    /* Niets vastgelegd: dan uit awareness. Problem-aware hoort bij een
       advertorial, want de diagnose moet voor het product komen. */
    delete it.metadata.wizardBrief.strategy.destination;
    uit.afgeleid = lpSoort(it);
    /* En zonder awareness ook: dan is elke keuze een gok, en een gok is hier
       duurder dan een leeg vak. */
    it.metadata.wizardBrief.audience.awareness = '';
    it.metadata.awareness = '';
    uit.niets = lpSoort(it);
    /* Most-aware hoort bij de productpagina: die is al verkocht. */
    it.metadata.awareness = 'most';
    uit.most = lpSoort(it);
    return uit;
  }, FIXTURE.toString());
  check('een vastgelegde bestemming wint', soort.gekozen, { soort: 'advertorial', afgeleid: false });
  check('anders volgt hij uit awareness', soort.afgeleid, { soort: 'advertorial', afgeleid: true });
  check('en zonder awareness blijft hij leeg', soort.niets, null);
  check('most aware gaat naar de productpagina', soort.most.soort, 'pdp');

  console.log('\n  elke bestemming heeft een Nederlandse reden');
  /* De brief gaat als geheel naar een model dat een Nederlandse pagina bouwt.
     Een Engelse alinea middenin is precies het soort naad dat in de uitvoer
     terugkomt -- en de wizard spreekt Engels, dus die tekst kan hier niet
     zomaar vandaan komen. */
  const talen = await page.evaluate(() => {
    const uit = { zonder: [], engels: [], zonderRug: [] };
    Object.keys(LP_SOORTEN).forEach(k => {
      const s = LP_SOORTEN[k];
      if (!s.waarom) uit.zonder.push(k);
      /* Ruw maar afdoende: deze woorden komen in geen Nederlandse zin voor
         en staan wel in elke Engelse uitleg in WIZ_BESTEMMINGEN. */
      if (/\b(the|reader|needs|does not|which is)\b/.test(s.waarom || '')) uit.engels.push(k);
      if (!s.ruggengraat || s.ruggengraat.length < 4) uit.zonderRug.push(k);
    });
    /* En alle vier de bestemmingen van de wizard moeten hier bestaan, anders
       valt er een bestemming stil als iemand hem kiest. */
    uit.mist = WIZ_BESTEMMINGEN.map(b => b.value).filter(v => !LP_SOORTEN[v]);
    return uit;
  });
  check('elke bestemming heeft een reden', talen.zonder, []);
  check('en die is Nederlands', talen.engels, []);
  check('elke bestemming heeft een ruggengraat', talen.zonderRug, []);
  check('en de wizard kent geen bestemming die hier ontbreekt', talen.mist, []);

  console.log('\n  de prompt is af, niet half');
  /* Een prompt die je nog moet aanvullen wordt aangevuld uit iemands hoofd,
     en dan staat er iets anders op de pagina dan in de advertentie. */
  const prompt = await page.evaluate(fx => {
    eval('(' + fx + ')()');
    const it = state.library[0];
    it.matrix = { as_bewijs: 'gemiddeld' };
    const p = lpPrompt(it);
    /* Per sectie kijken en niet in de hele tekst. De kop staat ook in de
       eisenlijst, dus "komt de kop erin voor" bleef waar toen het hele
       advertentieblok verdween -- en zonder dat blok weet het model niet
       waarvandaan de lezer komt. */
    const blok = (kop) => {
      const i = p.indexOf(kop);
      if (i === -1) return '';
      const rest = p.slice(i + kop.length);
      const j = rest.search(/\n[A-Z][A-Z ]{6,}\n/);
      return j === -1 ? rest : rest.slice(0, j);
    };
    const advertentie = blok('DE ADVERTENTIE DIE HIERHEEN LEIDT');
    return {
      heeftBlok: advertentie !== '',
      kop: advertentie.indexOf('184.000 Nederlanders kochten zijn scheerapparaat, dit is waarom') !== -1,
      hoek: advertentie.indexOf('De oprichter rekent het voor') !== -1,
      boodschap: advertentie.indexOf('Geen tussenhandel') !== -1,
      mechanisme: p.indexOf('Direct van fabriek naar deur') !== -1,
      bezwaar: p.indexOf('Te mooi om waar te zijn') !== -1,
      awareness: advertentie.indexOf('problem') !== -1,
      waarom: p.indexOf('diagnose') !== -1,
      ruggengraat: p.indexOf('Auteursregel') !== -1,
      /* De grens hoort erin: dit is precies het formaat waarin een verzonnen
         magazine ontstaat. */
      grens: p.indexOf('verzonnen magazine') !== -1,
      lengte: p.length,
      /* En geen lege regels van velden die niet bestaan. */
      leegLabel: /: *$/m.test(p)
    };
  }, FIXTURE.toString());
  check('het advertentieblok staat er', prompt.heeftBlok, true);
  check('met de kop van de advertentie erin', prompt.kop, true);
  check('de marketing angle', prompt.hoek, true);
  check('de kernboodschap', prompt.boodschap, true);
  check('het mechanisme', prompt.mechanisme, true);
  check('het bezwaar', prompt.bezwaar, true);
  check('het publiek', prompt.awareness, true);
  check('waarom juist dit soort pagina', prompt.waarom, true);
  check('de ruggengraat van dat soort', prompt.ruggengraat, true);
  check('en de grens tegen een verzonnen afzender', prompt.grens, true);
  check('hij is lang genoeg om af te zijn', prompt.lengte > 1200, true);
  check('en er staat geen leeg label in', prompt.leegLabel, false);

  console.log('\n  het paneel zet het in de volgorde waarin je kijkt');
  const paneel = await page.evaluate((arg) => {
    eval('(' + arg.fx + ')()');
    const it = state.library[0];
    it.matrix = { as_strategie: 'sterk', as_executie: 'sterk', as_bewijs: 'gemiddeld', as_test: 'sterk', score: '4' };
    const d = document.createElement('div');
    d.innerHTML = window.dosPaneelHtml(it);
    document.body.appendChild(d);
    return {
      titel: (d.querySelector('.dos-titel') || {}).textContent,
      kruimels: [].slice.call(d.querySelectorAll('.dos-kruimels span')).map(x => x.textContent),
      /* De drie variaties horen bij elkaar; ze stonden als drie losse kaarten
         in de bibliotheek alsof ze niets met elkaar te maken hadden. */
      strip: d.querySelectorAll('.dos-strip button').length,
      set: (d.querySelector('.dos-pil.set') || {}).textContent,
      assen: [].slice.call(d.querySelectorAll('.dos-as')).map(x => x.className.replace('dos-as ', '')),
      cijfer: (d.querySelector('.dos-cijfer') || {}).textContent,
      tabs: [].slice.call(d.querySelectorAll('.dos-tabs button')).map(x => x.textContent),
      /* Drie en niet zeven: een tabblad dat leeg opengaat leert je om niet
         meer te klikken. */
      zichtbaar: [].slice.call(d.querySelectorAll('[data-paneel]')).filter(p => !p.hidden).length,
      kernrijen: d.querySelectorAll('.dos-kern > div').length,
      legeKern: d.querySelectorAll('.dos-kern dd.leeg').length,
      matrixblokken: d.querySelectorAll('.dos-veld').length,
      afgeleid: d.querySelectorAll('.dos-veld.af').length,
      gat: d.querySelectorAll('.dos-moet li.gat').length
    };
  }, { fx: FIXTURE.toString() });
  check('de kop is de headline', paneel.titel, '184.000 Nederlanders kochten zijn scheerapparaat, dit is waarom');
  check('met een kruimelpad eronder', paneel.kruimels, ['Groom Guard', 'TOF', 'Founder als bewijs']);
  check('de drie variaties staan onder het beeld', paneel.strip, 3);
  check('en er staat hoeveel het er zijn', paneel.set, '3 variaties');
  check('de vier assen met hun stand', paneel.assen, ['sterk', 'sterk', 'gemiddeld', 'sterk']);
  check('het cijfer staat ernaast', paneel.cijfer, '4/5');
  check('drie tabbladen', paneel.tabs, ['Overzicht', 'Landingspagina', 'Matrix']);
  check('waarvan er een openstaat', paneel.zichtbaar, 1);
  check('de kerninformatie staat er voluit', paneel.kernrijen, 12);
  /* Een leeg veld blijft staan met "niet vastgelegd". Weglaten zou de indruk
     wekken dat het veld niet bestaat, en dan mis je dat het ontbreekt. */
  check('en een leeg veld zegt dat het leeg is', paneel.legeKern > 0, true);
  check('de matrix staat als leesbare blokken', paneel.matrixblokken > 0, true);
  check('afgeleide waarden zijn gemarkeerd', paneel.afgeleid > 0, true);
  check('en het gat staat in de landingsbrief', paneel.gat, 1);

  console.log('\n  zonder oordeel staat er wat je moet doen');
  /* Geen leeg kader dat eruitziet alsof er iets kapot is, maar de knop die
     het oplost. */
  const zonder = await page.evaluate(fx => {
    eval('(' + fx + ')()');
    const it = state.library[0];
    it.matrix = {};
    const d = document.createElement('div');
    d.innerHTML = window.dosPaneelHtml(it);
    return {
      leeg: !!d.querySelector('.dos-oordeel.leeg'),
      knop: !!d.querySelector('[data-action="nick-analyse"]'),
      geenAssen: d.querySelectorAll('.dos-as').length,
      geenCijfer: !d.querySelector('.dos-cijfer')
    };
  }, FIXTURE.toString());
  check('het oordeelvak zegt dat er nog niets is', zonder.leeg, true);
  check('met de knop die het oplost', zonder.knop, true);
  check('geen assen', zonder.geenAssen, 0);
  check('en geen cijfer', zonder.geenCijfer, true);

  console.log('\n  en het paneel opent zonder fouten');
  const echt = await page.evaluate(fx => {
    eval('(' + fx + ')()');
    state.library[0].matrix = { as_bewijs: 'gemiddeld', score: '4' };
    window.wgOpenLibraryItem('a');
    const ov = document.getElementById('wg-drill');
    return {
      open: !!ov,
      titel: !!(ov && ov.querySelector('.dos-titel')),
      tabs: ov ? ov.querySelectorAll('.dos-tabs button').length : 0,
      acties: ov ? [].slice.call(ov.querySelectorAll('[data-proxy]')).map(b => b.getAttribute('data-proxy')) : []
    };
  }, FIXTURE.toString());
  check('het paneel gaat open', echt.open, true);
  check('met het dossier erin', echt.titel, true);
  check('en de drie tabbladen', echt.tabs, 3);
  check('de acties staan onderaan', echt.acties, ['view', 'iterate', 'delete']);

  /* Van tabblad wisselen hoort het paneel niet opnieuw op te bouwen: dan
     springt je scrollpositie terug naar boven terwijl je net zat te lezen. */
  const wissel = await page.evaluate(() => {
    const ov = document.getElementById('wg-drill');
    const knop = [].slice.call(ov.querySelectorAll('.dos-tabs button'))
      .filter(b => b.getAttribute('data-tab') === 'landing')[0];
    knop.click();
    return {
      actief: [].slice.call(ov.querySelectorAll('.dos-tabs button'))
        .filter(b => b.getAttribute('aria-selected') === 'true').map(b => b.textContent),
      zichtbaar: [].slice.call(ov.querySelectorAll('[data-paneel]'))
        .filter(p => !p.hidden).map(p => p.getAttribute('data-paneel'))
    };
  });
  check('een ander tabblad wordt actief', wissel.actief, ['Landingspagina']);
  check('en alleen dat paneel staat open', wissel.zichtbaar, ['landing']);

  console.log('\n  een afgeleide waarde bevestigen legt hem vast');
  const bevestig = await page.evaluate(() => {
    const ov = document.getElementById('wg-drill');
    [].slice.call(ov.querySelectorAll('.dos-tabs button'))
      .filter(b => b.getAttribute('data-tab') === 'matrix')[0].click();
    const blok = ov.querySelector('.dos-veld.af');
    const veld = blok.getAttribute('data-veld');
    const tekstVoor = blok.querySelector('p').textContent;
    blok.querySelector('.dos-bevestig').click();
    const it = state.library.filter(x => x.id === 'a')[0];
    return {
      veld: veld,
      opgeslagen: it.matrix[veld] === tekstVoor,
      nogAf: blok.classList.contains('af'),
      merk: blok.querySelector('.dos-merk').textContent,
      knopWeg: !blok.querySelector('.dos-bevestig')
    };
  });
  check('de waarde staat nu in de matrix', bevestig.opgeslagen, true);
  check('de markering is weg', bevestig.nogAf, false);
  check('hij heet nu bevestigd', bevestig.merk, 'Bevestigd');
  check('en de knop is verdwenen', bevestig.knopWeg, true);

  check('er zijn geen fouten in de pagina opgetreden', paginafouten, []);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
