/* Testlus voor de tracker op de Creative Strategy-pagina.
 *
 * Het templateantwoord op "bouw een tracker" is de spreadsheet natekenen. Die
 * spreadsheet bestaat al en zijn analyselaag werkt niet: de doorsneden tellen
 * tegen een vaste lijst en laten vallen wat er niet op staat, een gemiddelde
 * over nul ingevulde scores ziet eruit als een gemiddelde, en een hook rate
 * van 1233% kleurt donkergroen. Als dit scherm dat overneemt, is het een
 * mooiere versie van hetzelfde probleem.
 *
 * Daarom gaat deze lus vooral over wat er zichtbaar moet zijn als er iets
 * ontbreekt:
 *
 *   - een cijfer zegt waar het vandaan komt: gemeten of ingetypt
 *   - staat er nergens een meting, dan staat dat bovenaan en niet onderaan
 *   - een onmogelijke waarde is niet 'uitstekend' maar doorgestreept
 *   - een ROAS van nul krijgt geen oordeel, ook niet 'onder break-even'
 *   - de doorsnede toont waar hij op rust, en geeft 'niet ingevuld' een regel
 *   - de grenzen van de banden staan niet in dit scherm maar in de database
 *
 *   node ad-generator/test/tracker.cjs
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

/* Zeven rijen die zeven verschillende gevallen zijn. Ze komen uit de echte
   import, inclusief de rommel: een advertentie met een onmogelijke hook rate,
   een met een ROAS van nul zonder impressions eronder, en een zonder persona.
   Zeven nette rijen bewijzen niets over een tabel waarvan de meest
   voorkomende waarde 'leeg' is. */
const RIJEN = [
  { id: 1, ad_name: '003-1', product: 'Groom Guard', awareness_level: '2. Problem Aware',
    angle_type: 'Social Proof / Reviews', format: '📱 UGC Talking Head Testimonial',
    media_type: '🎬 Video', hook_short: 'Mannen die zich niet goed scheren? Dat is een afknapper',
    persona: 'Daan', date_live: '2025-08-06', budget: 307, hook_rate: 0.3422, hook_band: 'goed',
    hold_rate: 0.0858, hold_band: 'prima', ctr: 0.0184, ctr_band: 'goed', cvr: 0.0267,
    cvr_band: 'prima', cpa: 25, roas: 1.82, breakeven_roas: 1.9, boven_breakeven: false,
    cijfers_bron: 'handmatig', status: 'Itereren', score: null, next_step: null },

  { id: 2, ad_name: '001-1', product: 'Shave Package 3.0', awareness_level: '2. Problem Aware',
    angle_type: 'Storytelling / Narrative', format: '📱 UGC Talking Head Testimonial',
    media_type: '🎬 Video', hook_short: 'Er zijn dus trimmers die de gevoelige plekken aankunnen',
    persona: 'Luca', date_live: '2025-08-04', budget: 7.69, hook_rate: 0.25, hook_band: 'prima',
    hold_rate: 0.0374, hold_band: 'matig', ctr: 0.0051, ctr_band: 'matig', cvr: null,
    cvr_band: null, cpa: null, roas: 0, breakeven_roas: 1.81, boven_breakeven: null,
    cijfers_bron: 'handmatig', status: 'Verliezer', score: null, next_step: null },

  { id: 3, ad_name: '020-1', product: 'Groom Guard', awareness_level: '1. Unaware',
    angle_type: 'Curiosity / Intrigue', format: '👤 Founder Story / Origin Video',
    media_type: '🎬 Video', hook_short: 'Invoerfout in de bron', persona: 'Alex',
    date_live: '2025-09-01', budget: 40, hook_rate: 12.33, hook_band: 'onmogelijk',
    hold_rate: null, hold_band: null, ctr: null, ctr_band: null, cvr: null, cvr_band: null,
    cpa: null, roas: null, breakeven_roas: 1.9, boven_breakeven: null,
    cijfers_bron: 'handmatig', status: 'Verliezer', score: null, next_step: null },

  { id: 4, ad_name: '110-2', product: 'Flex Guard', awareness_level: '3. Solution Aware',
    angle_type: 'Comparison / Anti-X', format: '🎬 Studio / Polished Brand Video',
    media_type: '🎬 Video', hook_short: 'Dit is de winnaar', persona: 'Mark',
    date_live: '2025-11-02', budget: 900, hook_rate: 0.44, hook_band: 'uitstekend',
    hold_rate: 0.22, hold_band: 'uitstekend', ctr: 0.021, ctr_band: 'uitstekend',
    cvr: 0.058, cvr_band: 'uitstekend', cpa: 18.4, roas: 3.1, breakeven_roas: 1.9,
    boven_breakeven: true, cijfers_bron: 'meta', status: 'Winner', score: 9,
    next_step: 'Opschalen naar 250 per dag' },

  { id: 5, ad_name: '144-1', product: 'Flex Guard', awareness_level: '3. Solution Aware',
    angle_type: 'Bundle Offer', format: '🖼 Single Image + Text Overlay', media_type: '🖼 Image',
    hook_short: null, persona: null, date_live: null, budget: null, hook_rate: null,
    hook_band: null, hold_rate: null, hold_band: null, ctr: null, ctr_band: null, cvr: null,
    cvr_band: null, cpa: null, roas: null, breakeven_roas: null, boven_breakeven: null,
    cijfers_bron: 'geen', status: 'Concept', score: null, next_step: null },

  { id: 6, ad_name: '150-1', product: 'Blade Baron', awareness_level: '5. Most Aware',
    angle_type: 'FOMO / Scarcity', format: '🎠 Carousel (Meta / Instagram)', media_type: '🖼 Image',
    hook_short: 'Nog drie dagen', persona: 'Alex', date_live: '2026-01-10', budget: 120,
    hook_rate: 0.19, hook_band: 'matig', hold_rate: null, hold_band: null, ctr: 0.009,
    ctr_band: 'prima', cvr: null, cvr_band: null, cpa: null, roas: 2.4, breakeven_roas: 2.15,
    boven_breakeven: true, cijfers_bron: 'handmatig', status: 'Live', score: null, next_step: null },

  { id: 7, ad_name: '151-1', product: 'Blade Baron', awareness_level: null,
    angle_type: 'Authority / Expert', format: '📰 Native Article / Advertorial',
    media_type: '🎬 Video', hook_short: 'Zonder awareness in de bron', persona: null,
    date_live: null, budget: null, hook_rate: null, hook_band: null, hold_rate: null,
    hold_band: null, ctr: null, ctr_band: null, cvr: null, cvr_band: null, cpa: null,
    roas: null, breakeven_roas: null, boven_breakeven: null, cijfers_bron: 'geen',
    status: 'Concept', score: null, next_step: null }
];

/* De doorsnede komt uit de database en niet uit de rijen hierboven: het scherm
   telt niet zelf. Deze cijfers zijn met opzet niet af te leiden uit RIJEN —
   zou het scherm stiekem toch zelf tellen, dan valt dat hier door de mand. */
const VLAKKEN = [
  { dimensie: 'awareness_level', waarde: '2. Problem Aware', aantal: 253, winners: 4,
    verliezers: 69, itereren: 20, live: 36, ooit_gedraaid: 139, met_meting: 0,
    met_handmatig: 205, zonder_cijfers: 48, met_score: 0, gem_score: null },
  { dimensie: 'awareness_level', waarde: '3. Solution Aware', aantal: 184, winners: 5,
    verliezers: 78, itereren: 15, live: 8, ooit_gedraaid: 107, met_meting: 12,
    met_handmatig: 170, zonder_cijfers: 2, met_score: 3, gem_score: 7.3 },
  { dimensie: 'awareness_level', waarde: '— niet ingevuld', aantal: 2, winners: 0,
    verliezers: 0, itereren: 0, live: 2, ooit_gedraaid: 0, met_meting: 0,
    met_handmatig: 0, zonder_cijfers: 2, met_score: 0, gem_score: null },
  { dimensie: 'format', waarde: '📱 UGC Talking Head Testimonial', aantal: 229, winners: 4,
    verliezers: 92, itereren: 30, live: 20, ooit_gedraaid: 150, met_meting: 0,
    met_handmatig: 200, zonder_cijfers: 29, met_score: 0, gem_score: null }
];

let fout = 0;
const check = (naam, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (goed) { console.log(`  ok   ${naam}`); return; }
  fout++;
  console.log(`  FOUT ${naam}`);
  console.log(`       verwacht ${JSON.stringify(verwacht)}`);
  console.log(`       kreeg    ${JSON.stringify(echt)}`);
};

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch(fs.existsSync(CHROOM) ? { executablePath: CHROOM } : {});
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`http://127.0.0.1:${poort}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const nep = async (rijen, vlakken, { ingelogd = true, fout = null, sync = null,
                                       gaten = [], gatenTotaal = [] } = {}) =>
    await page.evaluate(async ({ rijen, vlakken, ingelogd, fout, sync, gaten, gatenTotaal }) => {
      window._sb = ingelogd ? { from: function (tabel) {
        const q = {};
        ['select', 'eq', 'ilike', 'or', 'in', 'order', 'range', 'limit'].forEach(m => { q[m] = () => q; });
        const antwoord = fout ? { error: { message: fout } }
          : { data: tabel === 'hq_tracker_breakdown' ? vlakken
                  : tabel === 'hq_meta_sync_status' ? (sync ? [sync] : [])
                  : tabel === 'hq_map_gaten' ? gaten
                  : tabel === 'hq_map_gaten_totaal' ? gatenTotaal
                  : rijen };
        q.then = (res, rej) => Promise.resolve(antwoord).then(res, rej);
        return q;
      }} : null;
      window._authProfile = ingelogd ? { id: 'test' } : null;
      window._userRole = 'admin';
      localStorage.setItem('str_weergave_v1', 'tracker');
      _trk.geladen = false; _trk.rijen = null; _trk.vlakken = null; _trk.sync = null; _trk.fout = null;
      _trk.gaten = null; _trk.gatenTotaal = null;
      _trk.zoek = ''; _trk.filters = {}; _trk.toon = 100;
      _trk.dimensie = 'awareness_level'; _trk.sorteer = 'ad_name'; _trk.omgekeerd = false;
      switchMainTab('creatives');
      strWisselTeken();
      await new Promise(r => setTimeout(r, 400));
      return null;
    }, { rijen, vlakken, ingelogd, fout, sync, gaten, gatenTotaal });

  const lees = async () => await page.evaluate(() => {
    const m = document.getElementById('trk-mount');
    const cel = (rij, klasse) => (rij.querySelector(klasse) || {}).textContent;
    return {
      zichtbaar: getComputedStyle(m).display,
      vraag: (m.querySelector('.str-vraag') || {}).textContent,
      blokken: [...m.querySelectorAll('.trk-blok')].map(e => e.textContent.trim()),
      kaarten: [...m.querySelectorAll('.trk-kaart')].map(e => ({
        n: e.querySelector('.trk-kaart-n').textContent,
        l: e.querySelector('.trk-kaart-l').textContent
      })),
      melding: (m.querySelector('.trk-melding') || {}).textContent,
      meldingen: [...m.querySelectorAll('.trk-melding')].map(e => e.textContent),
      gaten: [...m.querySelectorAll('.trk-gat')].map(e => e.textContent),
      rijen: [...m.querySelectorAll('.trk-rij')].map(r => ({
        naam: r.querySelector('td').textContent.trim(),
        bron: cel(r, '.trk-bron'),
        status: cel(r, '.trk-status'),
        banden: [...r.querySelectorAll('.trk-band')].map(b =>
          [...b.classList].find(c => c.startsWith('trk-band--')).replace('trk-band--', '')),
        stil: r.querySelectorAll('.trk-cijfer--stil').length,
        leeg: r.querySelectorAll('.trk-leeg').length
      })),
      doorsnedeRijen: [...m.querySelectorAll('.trk-tabel--smal tbody tr')].map(r => ({
        waarde: r.querySelector('td').textContent.trim(),
        cellen: [...r.querySelectorAll('td')].map(t => t.textContent.trim()),
        leegwaarde: r.classList.contains('trk-rij--leegwaarde'),
        staaf: [...r.querySelectorAll('.trk-staaf > i')].map(i => i.style.width)
      })),
      filters: [...m.querySelectorAll('.str-filter')].map(s =>
        [...s.options].map(o => o.textContent)),
      alles: m.textContent.replace(/\s+/g, ' ').trim(),
      breedte: (() => {
        const w = m.querySelector('.trk-tabelwrap');
        return w ? w.scrollWidth > w.clientWidth : null;
      })()
    };
  });

  await nep(RIJEN, VLAKKEN);
  let uit = await lees();

  console.log('\n  de tracker is wat je als eerste ziet');
  check('het scherm staat er', uit.zichtbaar, 'block');
  check('met de beslisvraag erboven',
    /Welke advertentie heeft iets opgeleverd/.test(uit.vraag || ''), true);
  check('de drie blokken staan in de volgorde van het werk', uit.blokken,
    ['Plan', 'Live & performance', 'Besluit']);

  console.log('\n  de kaarten tellen de statussen');
  check('zes kaarten', uit.kaarten.length, 6);
  check('en ze tellen wat er staat', uit.kaarten.map(k => k.n + ' ' + k.l),
    ['7 advertenties', '1 live', '1 winners', '1 itereren', '2 verliezers', '2 concept']);

  console.log('\n  een cijfer zegt waar het vandaan komt');
  check('elke rij noemt zijn bron', uit.rijen.map(r => r.bron),
    ['handmatig', 'handmatig', 'handmatig', 'Meta', '–', 'handmatig', '–']);

  console.log('\n  de banden komen uit de database, niet uit dit scherm');
  // 003-1: hook goed, hold prima, ctr goed, cvr prima, en de ROAS onder
  // break-even kleurt als 'matig' -- dat is vijf gekleurde cellen.
  check('003-1 krijgt vijf oordelen', uit.rijen[1].banden,
    ['goed', 'prima', 'goed', 'prima', 'matig']);
  // De winnaar: vier keer uitstekend plus een ROAS boven break-even.
  check('de winnaar krijgt er ook vijf', uit.rijen[3].banden,
    ['uitstekend', 'uitstekend', 'uitstekend', 'uitstekend', 'goed']);

  console.log('\n  wat de spreadsheet fout doet, doet dit scherm niet');
  // In de sheet kleurt 1233% donkergroen en komt die rij bovenaan elke
  // ranglijst. Hier is hij doorgestreept en heet hij niet 'uitstekend'.
  check('een onmogelijke waarde is niet uitstekend', uit.rijen[2].banden, ['onmogelijk']);
  check('en hij staat doorgestreept', await page.evaluate(() => {
    const b = document.querySelector('#trk-mount .trk-band--onmogelijk');
    return b ? getComputedStyle(b).textDecorationLine : null;
  }), 'line-through');
  // Een ROAS van 0,00 zonder impressions is geen meting maar een leeg vakje.
  // 'onder break-even' antwoorden zou een oordeel verzinnen.
  check('een ROAS van nul krijgt geen oordeel', uit.rijen[0].stil, 1);
  // Hook, hold en CTR krijgen wel een band -- die zijn gemeten. Het gaat om de
  // vierde die er niet is: de ROAS. Een telling zou hier slagen op de
  // verkeerde reden, dus staat de hele lijst er.
  check('maar de andere drie wel', uit.rijen[0].banden, ['prima', 'matig', 'matig']);

  console.log('\n  staat er nergens een meting, dan staat dat bovenaan');
  const zonderMeta = RIJEN.map(r => ({ ...r, cijfers_bron: r.cijfers_bron === 'meta' ? 'handmatig' : r.cijfers_bron }));
  await nep(zonderMeta, VLAKKEN);
  let leeg = await lees();
  check('de waarschuwing staat er', /Geen enkele advertentie is gekoppeld aan een Meta-meting/.test(leeg.melding || ''), true);
  check('en hij zegt dat er niets overgetypt hoeft te worden',
    /er hoeft niets overgetypt te worden/.test(leeg.melding || ''), true);
  await nep(RIJEN, VLAKKEN);
  uit = await lees();
  check('met een meting erbij verdwijnt de waarschuwing', uit.melding, undefined);

  console.log('\n  de doorsnede laat zien waar hij op rust');
  check('drie regels op deze dimensie', uit.doorsnedeRijen.length, 3);
  check('wat niet ingevuld is krijgt een eigen regel',
    uit.doorsnedeRijen.map(r => r.waarde).indexOf('— niet ingevuld') > -1, true);
  check('en die regel is als zodanig gemerkt',
    uit.doorsnedeRijen.find(r => r.waarde === '— niet ingevuld').leegwaarde, true);
  // 205 van 253 met de hand, 0 gemeten, 48 zonder: het staafje moet dat tonen.
  check('het staafje toont de verhouding', uit.doorsnedeRijen[0].staaf,
    ['0%', '81%', '19%']);
  // Dit is de kolom die in de sheet voor elke doorsnede een streepje gaf.
  check('een gemiddelde zonder scores is een streepje',
    uit.doorsnedeRijen[0].cellen[7], '–');
  check('en met scores staat erbij op hoeveel het rust',
    uit.doorsnedeRijen[1].cellen[7], '7,3 (3)');

  console.log('\n  het scherm telt niet zelf');
  // De doorsnede zegt 253 Problem Aware terwijl er 7 rijen op het scherm staan.
  // Zou het scherm zelf tellen, dan stond hier 2.
  check('de aantallen komen uit de database', uit.doorsnedeRijen[0].cellen[1], '253');

  console.log('\n  filteren op wat ontbreekt');
  check('"niet ingevuld" is een echte keuze in de filters',
    uit.filters.some(o => o.indexOf('— niet ingevuld') > -1), true);
  const gefilterd = await page.evaluate(async () => {
    trkZet('persona', '— niet ingevuld');
    await new Promise(r => setTimeout(r, 200));
    const n = document.querySelectorAll('#trk-mount .trk-rij').length;
    trkLeeg();
    await new Promise(r => setTimeout(r, 200));
    return { n, terug: document.querySelectorAll('#trk-mount .trk-rij').length };
  });
  check('en hij vindt de rijen zonder persona', gefilterd.n, 2);
  check('filters leeg geeft alles terug', gefilterd.terug, 7);

  console.log('\n  sorteren zet leeg altijd onderaan');
  const gesorteerd = await page.evaluate(async () => {
    trkSorteer('roas');   // een nieuwe kolom begint omgekeerd: hoogste eerst
    await new Promise(r => setTimeout(r, 200));
    return [...document.querySelectorAll('#trk-mount .trk-rij')]
      .map(r => r.querySelector('td').textContent.trim());
  });
  check('de hoogste ROAS staat bovenaan', gesorteerd[0], '110-2');
  check('en de rijen zonder ROAS onderaan', gesorteerd.slice(-3).sort(),
    ['020-1', '144-1', '151-1']);


  console.log('\n  een kapotte sync leest anders dan een lege');
  /* Dit is het geval dat twee dagen doorliep: de worker draaide, het token
     werkte, en Meta weigerde elke ochtend om een veld dat niet meer bestaat.
     Het scherm zei "geen metingen", wat leest als "staat nog niet aan". */
  await nep(zonderMeta, VLAKKEN, { sync: {
    toestand: 'kapot', gemeten_rijen: 0, mislukte_pogingen_36u: 30,
    laatste_fout: '(#100) video_3_sec_watched_actions is not valid for fields param'
  }});
  const kapot = await lees();
  check('het scherm zegt dat de koppeling eruit ligt',
    /De Meta-koppeling ligt eruit/.test(kapot.melding || ''), true);
  check('met het aantal mislukte pogingen', /30 mislukte pogingen/.test(kapot.melding || ''), true);
  check('en de fout van Meta zelf erbij',
    /video_3_sec_watched_actions/.test(kapot.melding || ''), true);
  check('en het zegt dat het zichzelf niet oplost',
    /lost zichzelf niet op/.test(kapot.melding || ''), true);
  check('de melding is als storing gemarkeerd, niet als waarschuwing',
    await page.evaluate(() => !!document.querySelector('#trk-mount .trk-melding--kapot')), true);

  /* Het geval van 7 augustus: de koppeling haalt data op, maar op account- en
     campagneniveau. De tracker heeft advertentieniveau nodig plus een
     koppeling. Zei het scherm hier "zodra de koppeling draait verandert deze
     kolom mee", dan gaat de lezer wachten op iets wat al gebeurd is. */
  await nep(zonderMeta, VLAKKEN, { sync: {
    toestand: 'werkt', gemeten_rijen: 19, mislukte_pogingen_36u: 0,
    gemeten_niveaus: 'account, campaign', metingen_advertentieniveau: 0,
    gekoppelde_advertenties: 0
  }});
  const werktNietPerAd = await lees();
  check('werkend maar niet per advertentie leest anders',
    /werkt, maar meet niet per advertentie/.test(werktNietPerAd.melding || ''), true);
  check('met de niveaus die wel binnenkomen',
    /account, campaign/.test(werktNietPerAd.melding || ''), true);
  check('en de twee tellingen die het gat verklaren',
    /0 metingen op advertentieniveau, 0 gekoppelde advertenties/.test(werktNietPerAd.melding || ''), true);
  check('het is geen storing', await page.evaluate(() =>
    !!document.querySelector('#trk-mount .trk-melding--kapot')), false);
  check('en het belooft niet dat wachten helpt',
    /Zodra de Meta-koppeling draait/.test(werktNietPerAd.melding || ''), false);

  await nep(zonderMeta, VLAKKEN, { sync: { toestand: 'nooit gedraaid', gemeten_rijen: 0, mislukte_pogingen_36u: 0 } });
  const nooit = await lees();
  check('nooit gedraaid leest anders dan kapot',
    /nog nooit iets opgehaald/.test(nooit.melding || ''), true);
  check('en is geen storing', await page.evaluate(() =>
    !!document.querySelector('#trk-mount .trk-melding--kapot')), false);

  console.log('\n  handmatig blijft kunnen naast de meting');
  /* Meta meet niet altijd goed. Zet iemand een cijfer recht, dan moet dat
     blijven staan en moet je kunnen zien dat het een besluit was. */
  const metVast = RIJEN.map(r => r.ad_name === '003-1'
    ? { ...r, cijfers_bron: 'handmatig-vast', cijfers_vastgezet: true,
        cijfers_vastgezet_naam: 'Dustin Gibson', gemeten_roas: 9.99 }
    : r);
  await nep(metVast, VLAKKEN, { sync: { toestand: 'werkt', gemeten_rijen: 400, mislukte_pogingen_36u: 0 } });
  const vast = await lees();
  check('een vastgezet cijfer heet vastgezet en niet handmatig',
    vast.rijen[1].bron, 'vastgezet');
  check('en niet zomaar Meta', vast.rijen[1].bron === 'Meta', false);
  const titel = await page.evaluate(() => {
    const b = document.querySelector('#trk-mount .trk-bron--handmatig-vast');
    return b ? b.getAttribute('title') : null;
  });
  check('wie het vastzette staat erbij', /Dustin Gibson/.test(titel || ''), true);
  /* Zonder de gemeten waarde ernaast is niet te zien hoe ver de correctie van
     de meting af staat, en dan is vastzetten een vrijbrief. */
  check('en wat Meta zelf mat', /9\.99/.test(titel || ''), true);

  console.log('\n  de andere twee blikken blijven bereikbaar');
  const wissel = await page.evaluate(async () => {
    strWissel('tabel');
    await new Promise(r => setTimeout(r, 200));
    const klassiek = getComputedStyle(document.getElementById('cs-klassiek')).display;
    const tracker = getComputedStyle(document.getElementById('trk-mount')).display;
    strWissel('tracker');
    await new Promise(r => setTimeout(r, 200));
    return { klassiek, tracker, terug: getComputedStyle(document.getElementById('trk-mount')).display };
  });
  check('de bewerkbare tabel is één klik weg', wissel.klassiek, 'block');
  check('en de tracker wijkt dan', wissel.tracker, 'none');
  check('en je kunt terug', wissel.terug, 'block');

  console.log('\n  als er iets misgaat');
  await nep(RIJEN, VLAKKEN, { fout: 'relation "hq_creative_kaart" does not exist' });
  const stuk = await lees();
  check('de fout staat er in woorden', /does not exist/.test(stuk.alles), true);
  check('met wat eraan te doen is', /0035 t\/m 0037/.test(stuk.alles), true);
  await nep(RIJEN, VLAKKEN, { ingelogd: false });
  const uitgelogd = await lees();
  check('uitgelogd vraagt om inloggen', /Log in om de tracker te zien/.test(uitgelogd.alles), true);

  console.log('\n  wat het brein niet kan lezen, staat er als zodanig bij');
  /* De C-reeks uit 0046: draait, geeft geld uit, en mist persona en
     bewustzijnsniveau. Zonder markering ziet zo'n rij er precies zo uit als een
     complete rij en verdwijnt hij stil uit elke kruistabel. */
  const GAT_RIJEN = RIJEN.slice(0, 2);
  /* De tweede rij staat er bewust in mét lege velden maar zonder moet_ingevuld:
     zo'n rij heeft nog niet gedraaid en mag leeg zijn. Zonder deze rij bewijst
     de test niet dat er op moet_ingevuld gefilterd wordt. */
  const GATEN = [
    { creative_id: GAT_RIJEN[0].id, ontbreekt: ['persona', 'bewustzijnsniveau'],
      moet_ingevuld: true,  spend: 1414.76 },
    { creative_id: GAT_RIJEN[1].id, ontbreekt: ['persona', 'desire'],
      moet_ingevuld: false, spend: null }
  ];
  /* Het zwaarste veld staat hier expres níét bovenaan. Anders klopt de melding
     ook als er helemaal niet op bedrag gesorteerd wordt. */
  const GATEN_TOTAAL = [
    { brand: 'wellshave', veld: 'angle',             creatives: 3, spend_zonder_dit_veld: 349.03 },
    { brand: 'wellshave', veld: 'bewustzijnsniveau', creatives: 6, spend_zonder_dit_veld: 1900.00 },
    { brand: 'wellshave', veld: 'persona',           creatives: 6, spend_zonder_dit_veld: 2472.31 }
  ];
  await nep(GAT_RIJEN, VLAKKEN, { gaten: GATEN, gatenTotaal: GATEN_TOTAAL });
  const g = await lees();
  check('de rij draagt zijn ontbrekende velden', g.gaten.length, 1);
  check('en noemt ze bij naam', /persona/.test(g.gaten[0]) && /bewustzijnsniveau/.test(g.gaten[0]), true);
  check('alleen de rij die het betreft', g.gaten.length < GAT_RIJEN.length, true);
  /* De tweede rij heeft ook lege velden, maar heeft niet gedraaid. Die hoort
     geen markering te krijgen: een scherm dat alles markeert, markeert niets. */
  check('een rij die nog niet draaide krijgt niets', /desire/.test(g.gaten.join(' ')), false);
  /* Zonder bedrag zakt dit naar onderen op ieders lijst; met bedrag is het een
     besluit. Het zwaarste veld hoort bovenaan te staan, niet het eerste. */
  const gatMelding = g.meldingen.filter(t => /kan het brein niets mee/.test(t))[0] || '';
  check('bovenaan staat hoeveel creatives het zijn', /1 creative die gedraaid heeft/.test(gatMelding), true);
  check('met het zwaarste veld erbij', /persona/.test(gatMelding), true);
  check('en niet het eerste het beste veld', /angle/.test(gatMelding), false);
  check('en het bedrag dat het kost', /2\.472,31/.test(gatMelding), true);

  /* Staat alles ingevuld, dan hoort er geen melding te zijn. Een scherm dat
     altijd waarschuwt, waarschuwt nergens meer voor. */
  await nep(GAT_RIJEN, VLAKKEN, { gaten: [], gatenTotaal: [] });
  const heel = await lees();
  check('zonder gaten geen markering', heel.gaten.length, 0);
  check('en geen melding erover', heel.meldingen.filter(t => /kan het brein niets mee/.test(t)).length, 0);

  /* De view mag ontbreken zonder het scherm te breken: een console die
     vooruitloopt op de migratie hoort gewoon de tracker te tonen. */
  await nep(GAT_RIJEN, VLAKKEN, { gaten: null, gatenTotaal: null });
  const oud = await lees();
  check('een console zonder 0047 toont de tracker gewoon', oud.rijen.length > 0, true);

  await browser.close();
  srv.close();
  console.log(fout === 0 ? '\nAlle controles geslaagd' : `\n${fout} controle(s) mislukt`);
  process.exit(fout === 0 ? 0 : 1);
})();
