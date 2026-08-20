/* Bibliotheek-rust: lezen zonder dat alles onder je dichtklapt.
 *
 * De klacht: je opent een concept in de bibliotheek, zit te lezen, en
 * ineens "refresht" alles — open groepen klappen dicht, het menu laadt
 * opnieuw. De oorzaak zat in tweeën:
 *
 *   1. de teamsync hertekende álle schermen op elke venster-focus en elk
 *      realtime-bericht, ook als de data byte-voor-byte gelijk was;
 *   2. welke groep open stond leefde alleen in de DOM, en innerHTML gooit
 *      die DOM weg — dus zelfs een terechte herteken klapte alles dicht.
 *
 * Deze test bewijst beide fixes in de echte pagina:
 *
 *   node ad-generator/test/bibliotheek.cjs
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

(async () => {
  const [srv, poort] = await serve(APP);
  const browser = await chromium.launch({ executablePath: CHROOM });
  const page = await browser.newPage();

  /* De sync-module stapt zonder Supabase-client meteen uit — en dan valt er
     niets te testen. Een stub met precies genoeg oppervlak: getSession zegt
     "niet ingelogd" (dus geen echte sync start), de rest is inert. */
  await page.addInitScript(() => {
    window.supabase = {
      createClient: function () {
        var keten = { on: function () { return keten; }, subscribe: function () {} };
        var vraag = {
          select: function () { return vraag; }, eq: function () { return vraag; },
          order: function () { return vraag; }, limit: function () { return vraag; },
          maybeSingle: function () { return Promise.resolve({ data: null }); },
          upsert: function () { return Promise.resolve({}); },
          delete: function () { return vraag; },
          then: function (fn) { return Promise.resolve({ data: [] }).then(fn); }
        };
        return {
          auth: {
            onAuthStateChange: function () {},
            getSession: function () { return Promise.resolve({ data: { session: null } }); }
          },
          from: function () { return vraag; },
          channel: function () { return keten; }
        };
      }
    };
  });
  await page.goto('http://127.0.0.1:' + poort + '/');
  await page.waitForFunction(() => window._wgSync && typeof renderLibrary === 'function');

  console.log('\n  gelijke data uit de cloud raakt niets aan');
  const stil = await page.evaluate(() => {
    // personas_v1 is een lichte sleutel: die leeft echt in localStorage.
    // Directe property-toewijzing gaat om de sync-mirror heen, dus dit is
    // puur "zo staat het er lokaal al" zonder een cloud-push uit te lokken.
    window.localStorage['ws_personas_v1'] = JSON.stringify([{ id: 'p1', name: 'Test' }]);
    const zelfde = window._wgSync.applyRows([{ key: 'personas_v1', value: [{ id: 'p1', name: 'Test' }] }]);
    const anders = window._wgSync.applyRows([{ key: 'personas_v1', value: [{ id: 'p1', name: 'Nieuw' }] }]);
    const nogEens = window._wgSync.applyRows([{ key: 'personas_v1', value: [{ id: 'p1', name: 'Nieuw' }] }]);
    return { zelfde, anders, nogEens };
  });
  check('een rij die lokaal al zo staat telt niet als wijziging', stil.zelfde, false);
  check('een echt nieuwe rij wel', stil.anders, true);
  check('en direct daarna is ook die rij weer rust', stil.nogEens, false);

  console.log('\n  en de plekken die hertekenen vragen het eerst');
  /* applyRows kán het juiste antwoord geven terwijl hydrate en realtime er
     niet naar luisteren — dan is de klacht terug. Dus: staat de vraag er. */
  const syncBron = fs.readFileSync(path.join(APP, 'js', '21-supabase-sync.js'), 'utf8');
  check('hydrate hertekent alleen bij een echte wijziging',
    /if \(applyRows\(rows\)\) softRefresh\(\)/.test(syncBron), true);
  check('realtime stopt als het bericht niets nieuws bracht',
    /if \(!applyRows\(\[payload\.new\]\)\) return;/.test(syncBron), true);

  console.log('\n  een open groep overleeft een herteken');
  const groep = await page.evaluate(() => {
    state.library = [
      { id: 'a1', batch_id: 'batch-1', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'TOF', archetype: 'x', concept: 'Geen sneetjes' }, variation: { image_prompt_en: 'p' } },
      { id: 'a2', batch_id: 'batch-1', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'TOF', archetype: 'x', concept: 'Geen sneetjes' }, variation: { image_prompt_en: 'p' } },
      { id: 'b1', batch_id: 'batch-2', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'MOF', archetype: 'x', concept: 'Ander idee' }, variation: { image_prompt_en: 'p' } },
      { id: 'b2', batch_id: 'batch-2', saved_at: new Date().toISOString(), metadata: { product: 'Trimmer', funnel: 'MOF', archetype: 'x', concept: 'Ander idee' }, variation: { image_prompt_en: 'p' } }
    ];
    renderLibrary();
    const lib = document.getElementById('library');
    // De eerste groep openklikken, zoals de gebruiker doet
    toggleLibGroup(lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-head'));
    const openVoor = lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-body').style.display !== 'none';
    // En dan komt de teamsync met een herteken (zoals softRefresh doet)
    renderLibrary();
    const openNa = lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-body').style.display !== 'none';
    const dichtGebleven = lib.querySelector('.lib-group[data-batch="b:batch-2"] .lib-group-body').style.display === 'none';
    const kopNa = lib.querySelector('.lib-group[data-batch="b:batch-1"] .lib-group-head').classList.contains('open');
    return { openVoor, openNa, dichtGebleven, kopNa };
  });
  check('de groep stond open', groep.openVoor, true);
  check('en staat na het hertekenen nog steeds open', groep.openNa, true);
  check('de kop draagt de open-stijl ook nog', groep.kopNa, true);
  check('een groep die dicht was blijft gewoon dicht', groep.dichtGebleven, true);

  console.log('\n  de kaart blijft een keuzekaart');
  /* Wat op de kaart hoort is genoeg om te KIEZEN: beeld, kop, en de chips die
     in een oogopslag zeggen voor wie en op welk stadium hij gemaakt is. Het
     volledige verhaal staat in het zijpaneel; twee uitklappers per kaart
     midden in een scrollende lijst is de verkeerde plek om te lezen. */
  const kaart = await page.evaluate(() => {
    const brief = wizBlankData();
    brief.audience.awareness = 'solution';
    brief.audience.sophistication = 's3';
    brief.strategy.theme = 'De scheerbeurt zonder nabranden';
    brief.strategy.differentiation = 'mechanism';
    brief.strategy.desire = 'Geen rode vlekken';
    brief.strategy.destination = 'listicle';
    state.library = [{
      id: 'x1', batch_id: 'batch-x', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
      ad_name: 'trimmer_AW-SOLU_SO-S3_ANG-de-scheerbeurt_V1_2026-08-20',
      metadata: { product: 'Trimmer', funnel: 'tof', archetype: 'mix', awareness: 'solution',
                  sophistication: 's3', personaName: 'Gijs', wizardBrief: brief },
      variation: { headline_nl: 'Kop', image_prompt_en: 'p' }
    }];
    renderLibrary();
    const lib = document.getElementById('library');
    const tekst = lib.textContent;
    wgOpenLibraryItem('x1');
    const pan = document.querySelector('.wg-drill-panel');
    return {
      kaartKop: tekst.indexOf('Kop') !== -1,
      sophChip: tekst.indexOf('Soph: s3') !== -1,
      awareChip: tekst.indexOf('Aware: solution') !== -1,
      panNaam: (pan.querySelector('.lib-adnaam code') || {}).textContent || '',
      panKnop: !!pan.querySelector('button[data-action="copy-name"]'),
      panHoek: pan.textContent.indexOf('De scheerbeurt zonder nabranden') !== -1,
      panVerschil: pan.textContent.indexOf('New mechanism') !== -1,
      panBestemming: pan.textContent.indexOf('Listicle') !== -1
    };
  });
  check('de kop staat op de kaart', kaart.kaartKop, true);
  /* De sophistication stond hardgecodeerd op null in wizMetadata, dus deze
     chip verscheen nooit. */
  check('de sophistication-chip verschijnt nu ook', kaart.sophChip, true);
  check('en de awareness-chip', kaart.awareChip, true);
  check('de advertentienaam staat in het paneel',
    kaart.panNaam, 'trimmer_AW-SOLU_SO-S3_ANG-de-scheerbeurt_V1_2026-08-20');
  check('met een knop om hem te kopieren', kaart.panKnop, true);
  check('de hoek staat er', kaart.panHoek, true);
  check('het soort verschil als label', kaart.panVerschil, true);
  check('en waar de klik landt', kaart.panBestemming, true);

  console.log('\n  het opslaan legt de naam zelf vast');
  /* De kaart kan de naam ook berekenen, dus een test op de kaart alleen zegt
     niets over de opslag. En juist de opslag is wat telt: zodra de
     wizard-state weg is valt de hoek niet meer te reconstrueren, dus de naam
     moet op het item staan en niet elke keer opnieuw ontstaan. */
  const opgeslagen = await page.evaluate(async () => {
    state.library = [];
    wizState.data = wizBlankData();
    wizState.data.audience.awareness = 'product';
    wizState.data.audience.sophistication = 's2';
    wizState.data.strategy.theme = 'Scheren zonder spiegel';
    wizState.data.strategy.differentiation = 'avatar';
    wizState.data.strategy.destination = 'pdp';
    state.lastGenerated = {
      variations: [{ headline_nl: 'Kop een', image_prompt_en: 'p' },
                   { headline_nl: 'Kop twee', image_prompt_en: 'p' }],
      metadata: wizMetadata()
    };
    state.generatedImages = {};
    // Geen beeld: de bevestigingsvraag zou blijven staan, dus even ja zeggen
    const echteConfirm = window.confirm; window.confirm = () => true;
    await saveToLibraryFromCard(1);
    window.confirm = echteConfirm;
    const it = state.library[0] || {};
    return { naam: it.ad_name || null, variant: it.variant_index };
  });
  check('de tweede variant is als V2 opgeslagen', /_V2_/.test(opgeslagen.naam || ''), true);
  check('met de hoek erin', /ANG-scheren-zonder-spiegel/.test(opgeslagen.naam || ''), true);
  check('het soort verschil', /DF-AVTR/.test(opgeslagen.naam || ''), true);
  check('de bestemming', /LP-PDP/.test(opgeslagen.naam || ''), true);
  check('en de sophistication die de wizard verzamelde',
    /SO-S2/.test(opgeslagen.naam || ''), true);

  console.log('\n  een oud item zonder opgeslagen naam krijgt er alsnog een');
  /* De bibliotheek mag niet in twee soorten uiteenvallen: items van voor deze
     wijziging hebben geen ad_name, en die moeten hem berekend krijgen in
     plaats van een leeg vak te tonen. */
  const oud = await page.evaluate(() => {
    const brief = wizBlankData();
    brief.strategy.theme = 'Oude hoek';
    state.library = [{
      id: 'oud1', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
      metadata: { product: 'Trimmer', timestamp: Date.UTC(2026, 7, 20), wizardBrief: brief },
      variation: { headline_nl: 'Kop', image_prompt_en: 'p' }
    }];
    renderLibrary();
    wgOpenLibraryItem('oud1');
    const c = document.querySelector('.wg-drill-panel .lib-adnaam code');
    return c ? c.textContent : null;
  });
  check('het oude item toont een berekende naam met de hoek erin',
    /ANG-oude-hoek/.test(oud || ''), true);

  console.log('\n  het zijpaneel draagt het hele verhaal, de kaart niet meer');
  /* De kaart in de lijst is er om te KIEZEN, het paneel om te LEZEN. Twee
     uitklappers per kaart, middenin een lijst waar je doorheen scrolt, is de
     verkeerde plek: je klapt iets open, leest, en scrolt het weer kwijt. */
  const paneel = await page.evaluate(() => {
    const brief = wizBlankData();
    brief.audience.awareness = 'problem';
    brief.audience.sophistication = 's4';
    brief.strategy.theme = 'Veilig daar beneden';
    brief.strategy.differentiation = 'mechanism';
    brief.strategy.desire = 'Geen wondjes';
    brief.strategy.destination = 'advertorial';
    state.library = [{
      id: 'p1', batch_id: 'b-p', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
      ad_name: 'groom-guard_AW-PROB_SO-S4_ANG-veilig_V1_2026-08-20',
      matrix: { hook: 'De bestaande hook' },
      metadata: { product: 'Groom Guard', funnel: 'mof', archetype: 'premium',
                  awareness: 'problem', sophistication: 's4', wizardBrief: brief },
      variation: { headline_nl: 'Veilig daar beneden', body_copy_nl: 'Body',
                   visual_nl: 'Een macro van de kop', hypothese_nl: 'Dit werkt omdat',
                   image_prompt_en: 'p' }
    }];
    renderLibrary();
    const kaart = document.querySelector('.library-item');
    const kaartTekst = kaart.textContent;
    const kaartUitklappers = kaart.querySelectorAll('details').length;

    wgOpenLibraryItem('p1');
    const pan = document.querySelector('.wg-drill-panel');
    const panTekst = pan.textContent;
    return {
      kaartUitklappers: kaartUitklappers,
      kaartHeeftDossier: kaartTekst.indexOf('Veilig daar beneden') !== -1
                         && kaartTekst.indexOf('New mechanism') !== -1,
      panHoek: panTekst.indexOf('Veilig daar beneden') !== -1,
      panVerschil: panTekst.indexOf('New mechanism') !== -1,
      panBestemming: panTekst.indexOf('Advertorial') !== -1,
      panNaam: (pan.querySelector('.lib-adnaam code') || {}).textContent || '',
      panVisual: panTekst.indexOf('Een macro van de kop') !== -1,
      panHypothese: panTekst.indexOf('Dit werkt omdat') !== -1,
      panMatrix: !!pan.querySelector('[data-matrix-field="hook"]'),
      panMatrixWaarde: (pan.querySelector('[data-matrix-field="hook"]') || {}).value,
      panUitklappers: pan.querySelectorAll('details').length,
      panChips: pan.querySelectorAll('.lib-chip').length
    };
  });
  check('de kaart heeft geen uitklappers meer', paneel.kaartUitklappers, 0);
  check('en draagt het dossier niet meer', paneel.kaartHeeftDossier, false);
  check('het paneel toont de hoek', paneel.panHoek, true);
  check('het soort verschil', paneel.panVerschil, true);
  check('waar de klik landt', paneel.panBestemming, true);
  check('de advertentienaam', paneel.panNaam, 'groom-guard_AW-PROB_SO-S4_ANG-veilig_V1_2026-08-20');
  check('de visual en de hypothese', [paneel.panVisual, paneel.panHypothese], [true, true]);
  check('en de scorekaart-matrix met wat er al ingevuld was',
    [paneel.panMatrix, paneel.panMatrixWaarde], [true, 'De bestaande hook']);
  check('in het paneel staat alles open, niets weggeklapt', paneel.panUitklappers, 0);
  check('de chips staan er ook', paneel.panChips > 0, true);

  console.log('\n  een tweede creative vervangt het paneel, hij stapelt niet');
  /* Gevonden doordat de test het verkeerde paneel las: het paneel werd
     toegevoegd zonder het vorige weg te halen, dus het id wg-drill kwam twee
     keer voor. Alles wat het paneel daarna opzoekt (matrixvelden, de
     kopieerknop) landt dan op het OUDSTE exemplaar terwijl je naar het
     nieuwste kijkt: je typt in het ene en bewerkt het andere. */
  const stapel = await page.evaluate(() => {
    state.library = [
      { id: 's1', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
        metadata: { product: 'Eerste', wizardBrief: wizBlankData() },
        variation: { headline_nl: 'Eerste kop', image_prompt_en: 'p' } },
      { id: 's2', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
        metadata: { product: 'Tweede', wizardBrief: wizBlankData() },
        variation: { headline_nl: 'Tweede kop', image_prompt_en: 'p' } }
    ];
    renderLibrary();
    wgOpenLibraryItem('s1');
    wgOpenLibraryItem('s2');
    const panelen = document.querySelectorAll('.wg-drill-panel');
    return { aantal: panelen.length,
             tekst: panelen.length ? panelen[0].textContent.indexOf('Tweede kop') !== -1 : false };
  });
  check('er staat precies een paneel open', stapel.aantal, 1);
  check('en dat is die van de laatst aangeklikte creative', stapel.tekst, true);

  console.log('\n  en wat je in het paneel typt, wordt bewaard');
  /* De matrixvelden zaten met een lus in renderLibrary aan de KAART vast.
     Nu ze in het paneel staan moet dezelfde koppeling daar gelden, anders
     typ je een notitie die verdwijnt zodra je het paneel sluit. */
  const typen = await page.evaluate(async () => {
    /* Eigen opzet: het stapelblok hierboven verving de bibliotheek, dus dit
       blok mag niet op een eerdere fixture leunen. Een test die van de
       volgorde van een ander blok afhangt, valt om zodra iemand er iets
       tussen zet. */
    state.library = [{
      id: 'p1', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
      metadata: { product: 'Groom Guard', wizardBrief: wizBlankData() },
      variation: { headline_nl: 'Kop', image_prompt_en: 'p' }
    }];
    renderLibrary();
    wgOpenLibraryItem('p1');
    const veld = document.querySelector('.wg-drill-panel [data-matrix-field="notes"]');
    if (!veld) return { gelukt: false };
    veld.value = 'Deze liep op 2,4 ROAS';
    veld.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    const it = state.library.find(x => x.id === 'p1');
    return { gelukt: true, bewaard: (it.matrix || {}).notes };
  });
  check('het notitieveld staat in het paneel', typen.gelukt, true);
  check('en wat je typt landt op het item', typen.bewaard, 'Deze liep op 2,4 ROAS');

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
