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
      /* De naam staat nu op het matrix-tabblad van het dossier in plaats van
         los in het paneel. Zelfde informatie, andere plek: het paneel is
         herbouwd rond kop, oordeel, kerninformatie en drie tabbladen. */
      panNaam: (function () {
        var t = pan.querySelector('.dos-tabs button[data-tab="matrix"]');
        if (t) t.click();
        return (pan.querySelector('.dos-adnaam') || {}).textContent || '';
      })(),
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

  console.log('\n  drie variaties met dezelfde kop blijven drie items');
  /* De visuele pass is per definitie een idee met DEZELFDE woorden en drie
     verschillende beelden. De ontdubbeling keek naar kop + product + funnel +
     archetype, en die vier zijn dan voor alle drie gelijk: take 2 herkende
     zichzelf als take 1 en schreef eroverheen, take 3 daarna weer. Er bleef
     één item over en twee betaalde beelden waren weg.
     Dus: drie keer opslaan met dezelfde kop, en er moeten er drie staan. */
  const driemaal = await page.evaluate(async () => {
    state.library = [];
    wizState.data = wizBlankData();
    state.lastGenerated = {
      variations: [
        { headline_nl: 'Bij hen betaal je de reclame mee', image_prompt_en: 'a' },
        { headline_nl: 'Bij hen betaal je de reclame mee', image_prompt_en: 'b' },
        { headline_nl: 'Bij hen betaal je de reclame mee', image_prompt_en: 'c' }
      ],
      metadata: wizMetadata()
    };
    state.generatedImages = {};
    const echteConfirm = window.confirm; window.confirm = () => true;
    await saveToLibraryFromCard(0);
    await saveToLibraryFromCard(1);
    await saveToLibraryFromCard(2);
    /* En nog een keer dezelfde take: dát hoort wél bij te werken in plaats
       van een vierde rij te maken -- dat is waar de ontdubbeling voor is. */
    await saveToLibraryFromCard(1);
    window.confirm = echteConfirm;
    const uit = {
      aantal: state.library.length,
      indexen: state.library.map(i => i.variant_index).sort(),
      batches: [...new Set(state.library.map(i => i.batch_id))].length,
      prompts: state.library.map(i => i.variation.image_prompt_en).sort()
    };
    /* Een tweede generatie is een nieuwe creative en hoort niet over de
       eerste heen te schrijven, ook al is de kop hetzelfde. */
    state.lastGenerated = {
      variations: [{ headline_nl: 'Bij hen betaal je de reclame mee', image_prompt_en: 'd' }],
      metadata: wizMetadata()
    };
    window.confirm = () => true;
    await saveToLibraryFromCard(0);
    window.confirm = echteConfirm;
    uit.naTweedeRonde = state.library.length;
    return uit;
  });
  check('alle drie de variaties staan er', driemaal.aantal, 3);
  check('elk met zijn eigen plek in de batch', driemaal.indexen, [0, 1, 2]);
  /* Eén batch-id maakt ze in de bibliotheek tot één ad set. Drie losse
     id's zou drie ongerelateerde creatives zijn. */
  check('onder één gedeelde batch', driemaal.batches, 1);
  /* De harde controle: het beeld van take 1 en 3 mag niet overschreven zijn
     door dat van take 2. */
  check('en elk beeld is bewaard, niet overschreven', driemaal.prompts, ['a', 'b', 'c']);
  check('dezelfde take nog eens opslaan werkt hem bij', driemaal.aantal, 3);
  check('een nieuwe generatie komt er los bij', driemaal.naTweedeRonde, 4);

  console.log('\n  en de knoppenrij breekt de rij, niet het woord');
  /* Vijf knoppen in een flexrij zonder wrap werden samengeknepen tot ze hun
     eigen tekst over drie regels braken: vijf knoppen met vijf hoogtes. */
  const knoppen = await page.evaluate(() => {
    const rij = document.createElement('div');
    rij.className = 'library-item';
    rij.style.width = '360px';
    rij.innerHTML = '<div class="lib-actions">' +
      '<button class="btn btn-small">Bekijk in generator</button>' +
      '<button class="btn btn-small">Itereer op deze</button>' +
      '<button class="btn btn-small btn-ghost">Kopieer prompt</button>' +
      '<button class="btn btn-small btn-ghost">Download beeld</button>' +
      '<button class="btn btn-small btn-ghost btn-danger">×</button></div>';
    document.body.appendChild(rij);
    const el = rij.querySelector('.lib-actions');
    const cs = getComputedStyle(el);
    const knop = [].slice.call(el.querySelectorAll('.btn'));
    const hoogtes = [...new Set(knop.map(b => Math.round(b.getBoundingClientRect().height)))];
    const uit = {
      wrap: cs.flexWrap,
      nowrap: getComputedStyle(knop[0]).whiteSpace,
      hoogtes: hoogtes.length,
      /* Verwijderen hoort rechts, weg van wat je wél wilt doen. */
      deleteRechts: getComputedStyle(knop[4]).marginLeft === 'auto' ||
        Math.round(knop[4].getBoundingClientRect().right) >=
        Math.round(el.getBoundingClientRect().right) - 2
    };
    rij.remove();
    return uit;
  });
  check('de rij mag breken', knoppen.wrap, 'wrap');
  check('de knoptekst niet', knoppen.nowrap, 'nowrap');
  check('dus alle knoppen zijn even hoog', knoppen.hoogtes, 1);
  check('en verwijderen staat apart, rechts', knoppen.deleteRechts, true);

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
    var t = document.querySelector('.wg-drill-panel .dos-tabs button[data-tab="matrix"]');
    if (t) t.click();
    const c = document.querySelector('.wg-drill-panel .dos-adnaam');
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
      /* Rory's redenering staat op het overzichtstabblad, de matrix en de
         advertentienaam op het matrixtabblad. Dat is de herbouw: alles staat
         er nog, verdeeld over drie tabbladen in plaats van onder elkaar. */
      panVisual: panTekst.indexOf('Een macro van de kop') !== -1,
      panHypothese: panTekst.indexOf('Dit werkt omdat') !== -1,
      panUitklappers: pan.querySelectorAll('details').length,
      panKern: pan.querySelectorAll('.dos-kern > div').length,
      matrix: (function () {
        var t = pan.querySelector('.dos-tabs button[data-tab="matrix"]');
        if (t) t.click();
        var blok = pan.querySelector('.dos-veld[data-veld="hook"] p');
        return {
          naam: (pan.querySelector('.dos-adnaam') || {}).textContent || '',
          er: !!blok,
          waarde: blok ? blok.textContent : ''
        };
      })()
    };
  });
  check('de kaart heeft geen uitklappers meer', paneel.kaartUitklappers, 0);
  check('en draagt het dossier niet meer', paneel.kaartHeeftDossier, false);
  check('het paneel toont de hoek', paneel.panHoek, true);
  check('het soort verschil', paneel.panVerschil, true);
  check('waar de klik landt', paneel.panBestemming, true);
  check('de advertentienaam', paneel.matrix.naam, 'groom-guard_AW-PROB_SO-S4_ANG-veilig_V1_2026-08-20');
  check('de visual en de hypothese', [paneel.panVisual, paneel.panHypothese], [true, true]);
  check('en de scorekaart-matrix met wat er al ingevuld was',
    [paneel.matrix.er, paneel.matrix.waarde], [true, 'De bestaande hook']);
  check('in het paneel staat alles open, niets weggeklapt', paneel.panUitklappers, 0);
  /* De chips zijn vervangen door de kerninformatie: een sleutel-waardelijst
     leest sneller dan een rij chips, en een leeg veld valt op in plaats van
     weg. Dezelfde velden, andere vorm. */
  check('de kerninformatie staat er', paneel.panKern > 0, true);

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
    /* Het notitieveld staat op het matrixtabblad, en het is een blok waarin je
       typt in plaats van een tekstvak met een schuifbalk -- dat laatste was
       precies het probleem: je scrolde binnen een vakje om een zin te lezen. */
    const mtab = document.querySelector('.wg-drill-panel .dos-tabs button[data-tab="matrix"]');
    if (mtab) mtab.click();
    const veld = document.querySelector('.wg-drill-panel p[data-matrix-field="notes"]');
    if (!veld) return { gelukt: false };
    /* Eerst focus: een leeg blok toont een uitnodiging, en die hoort weg te
       zijn zodra je begint te typen. */
    veld.dispatchEvent(new Event('focus', { bubbles: true }));
    veld.textContent = 'Deze liep op 2,4 ROAS';
    veld.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    const it = state.library.find(x => x.id === 'p1');
    return { gelukt: true, bewaard: (it.matrix || {}).notes };
  });
  check('het notitieveld staat in het paneel', typen.gelukt, true);
  check('en wat je typt landt op het item', typen.bewaard, 'Deze liep op 2,4 ROAS');

  console.log('\n  de scorekaart staat al ingevuld waar het systeem het weet');
  /* Een matrix die je uit je eigen briefing moet overtypen wordt niet
     ingevuld, en dan staat er een leeg testlog terwijl de beslissingen wel
     genomen zijn. Wat in de brief staat wordt afgeleid, niet verzonnen. */
  const matrix = await page.evaluate(() => {
    const brief = wizBlankData();
    brief.audience.awareness = 'solution';
    brief.audience.sophistication = 's4';
    brief.strategy.differentiation = 'mechanism';
    brief.strategy.mechanism = 'Keramische kop, geen huidcontact';
    brief.strategy.desire = 'Geen wondjes';
    brief.strategy.ultimateDesire = 'Er niet meer over nadenken';
    brief.strategy.proof = 'LED maakt zichtbaar wat je doet';
    state.library = [{
      id: 'mx', variant_index: 0, saved_at: Date.UTC(2026, 7, 20),
      metadata: { product: 'Groom Guard', personaName: 'Mark de Vries', wizardBrief: brief },
      variation: { headline_nl: 'Veilig daar beneden', hook_label_nl: 'contraire stelling',
                   image_prompt_en: 'p' }
    }];
    const it = state.library[0];
    const af = nickAfgeleid(it);
    renderLibrary(); wgOpenLibraryItem('mx');
    const pan = document.querySelector('.wg-drill-panel');
    /* De waarde bij de bron: nickVeld is wat de matrix toont, ongeacht in
       welke vorm het paneel hem laat zien. Zo blijft deze controle over het
       AFLEIDEN gaan en niet over de opmaak eromheen. */
    const veld = k => nickVeld(it, k).waarde;
    /* En hoe hij in het paneel terechtkomt. De vier tekstvelden staan op het
       matrixtabblad als leesbare blokken; sophistication en awareness staan
       in de kerninformatie, want dat zijn posities die je leest en niet
       velden die je typt. */
    const mtab = pan.querySelector('.dos-tabs button[data-tab="matrix"]');
    if (mtab) mtab.click();
    const blok = k => {
      const el = pan.querySelector('.dos-veld[data-veld="' + k + '"] p');
      return el ? el.textContent : undefined;
    };
    const kern = label => {
      const rijen = [].slice.call(pan.querySelectorAll('.dos-kern > div'));
      const r = rijen.filter(x => x.querySelector('dt').textContent === label)[0];
      return r ? r.querySelector('dd').textContent : undefined;
    };
    return {
      af: af,
      gaten: nickGaten(it),
      hook: veld('hook'), proof: veld('proof'), avatar: veld('avatar'),
      cow: veld('purplecow'), soph: veld('sophistication'), aware: veld('awareness'),
      score: veld('score'), notes: veld('notes'),
      blokHook: blok('hook'), blokNotes: blok('notes'),
      kernSoph: kern('Sophistication'), kernAware: kern('Awareness'),
      afgeleideLabels: pan.querySelectorAll('.dos-veld.af').length,
      knop: !!pan.querySelector('button[data-action="nick-analyse"]'),
      knopTekst: (pan.querySelector('button[data-action="nick-analyse"]') || {}).textContent
    };
  });
  check('de hook komt uit de kop van deze creative',
    matrix.hook, 'Veilig daar beneden (contraire stelling)');
  check('het bewijs uit de strategie', matrix.proof, 'LED maakt zichtbaar wat je doet');
  check('avatar en verlangen staan samen, met het uiteindelijke erachter',
    matrix.avatar, 'Mark de Vries · Geen wondjes · → Er niet meer over nadenken');
  check('Purple Cow is de differentiatie plus het mechanisme',
    matrix.cow, 'New mechanism · Keramische kop, geen huidcontact');
  check('en beide assen staan er', [matrix.soph, matrix.aware], ['s4', 'solution']);
  /* In het paneel staan die twee bij de kerninformatie, met hun label en niet
     hun sleutel: "s4" zegt niemand iets. */
  check('in het paneel met hun label', [matrix.kernSoph, matrix.kernAware],
    ['Stage 4 — better mechanism', 'Solution aware']);
  check('en de hook staat als leesbaar blok in de matrix',
    matrix.blokHook, 'Veilig daar beneden (contraire stelling)');
  /* Het resultaat is wat er NA de test gebeurde. Daar iets in schrijven zou
     een uitkomst verzinnen die er nog niet is. */
  check('het notitieveld blijft leeg', matrix.notes, '');
  check('en het cijfer ook, want dat valt nergens uit af te leiden', matrix.score, '');
  check('alleen het cijfer is nog een gat', matrix.gaten, ['score']);
  /* Vier van de vijf blokken op het matrixtabblad zijn afgeleid; het
     notitieveld niet, want dat hoort leeg te blijven tot er een resultaat is.
     Sophistication en awareness staan niet meer als invoerveld maar in de
     kerninformatie -- die typ je niet, die volgen uit de brief. */
  check('de afgeleide blokken zijn gemarkeerd', matrix.afgeleideLabels, 4);
  check('en er staat een knop om Nick ernaar te laten kijken', matrix.knop, true);
  /* In het dossier heet hij korter: hij staat naast Nicks naam en een knop
     die zijn eigen context herhaalt leest als een formulier. Op de kaart in
     de bibliotheek staat de lange tekst nog wel, want daar is geen context. */
  check('met een tekst die zegt wat hij doet',
    (matrix.knopTekst || '').indexOf('Laat Nick') !== -1, true);

  console.log('\n  wat iemand zelf typte wint van het afgeleide');
  const eigen = await page.evaluate(() => {
    const it = state.library.find(x => x.id === 'mx');
    it.matrix = { proof: 'Dit heb ik zelf nagekeken' };
    renderLibrary(); wgOpenLibraryItem('mx');
    const pan = document.querySelector('.wg-drill-panel');
    const mtab = pan.querySelector('.dos-tabs button[data-tab="matrix"]');
    if (mtab) mtab.click();
    const lab = pan.querySelector('.dos-veld[data-veld="proof"]');
    return { waarde: pan.querySelector('.dos-veld[data-veld="proof"] p').textContent,
             afgeleid: lab.classList.contains('af') };
  });
  check('het eigen bewijs staat er', eigen.waarde, 'Dit heb ik zelf nagekeken');
  check('en is niet langer als afgeleid gemarkeerd', eigen.afgeleid, false);

  console.log('\n  zonder gaten geen knop');
  /* Een knop die niets te doen heeft, leert je af om op knoppen te drukken. */
  const zonderGaten = await page.evaluate(() => {
    const it = state.library.find(x => x.id === 'mx');
    it.matrix = { hook: 'a', proof: 'b', avatar: 'c', purplecow: 'd',
                  sophistication: 's4', awareness: 'solution', score: '4' };
    renderLibrary(); wgOpenLibraryItem('mx');
    const pan = document.querySelector('.wg-drill-panel');
    const uit = { gaten: nickGaten(it),
                  metGaten: !!pan.querySelector('button[data-action="nick-analyse"]') };
    /* De velden zijn vol maar de vier assen zijn nog niet geveld, en dat is
       een tweede reden om Nick te laten kijken: de matrix beschrijft de
       creative, het oordeel zegt of hij gaat spenden. Pas als beide er zijn
       heeft de knop niets meer te doen. */
    it.matrix.as_strategie = 'sterk'; it.matrix.as_executie = 'sterk';
    it.matrix.as_bewijs = 'gemiddeld'; it.matrix.as_test = 'sterk';
    wgOpenLibraryItem('mx');
    const pan2 = document.querySelector('.wg-drill-panel');
    uit.metOordeel = !!pan2.querySelector('button[data-action="nick-analyse"]');
    return uit;
  });
  check('er is niets meer leeg', zonderGaten.gaten, []);
  check('maar zonder oordeel staat de knop er nog', zonderGaten.metGaten, true);
  check('en met een oordeel erbij is hij weg', zonderGaten.metOordeel, false);

  console.log('\n  Nick vult de gaten en niets anders');
  const nick = await page.evaluate(async () => {
    const it = state.library.find(x => x.id === 'mx');
    /* Terug naar alleen een cijfer als gat, plus een eigen bewijs dat hij
       niet mag overschrijven. */
    it.matrix = { proof: 'Dit heb ik zelf nagekeken' };
    renderLibrary(); wgOpenLibraryItem('mx');

    window.__WG_TEAMSERVER = true;
    const gezien = {};
    const echt = window.wizCall;
    window.wizCall = function (sys, msgs) {
      gezien.sys = sys; gezien.opdracht = msgs[0].content;
      /* Nick antwoordt sinds het dossier ook met de vier assen: die worden
         elke ronde opnieuw geveld, ook als er al een oordeel stond. Een
         creative die je hebt aangepast verdient een nieuw oordeel. */
      return Promise.resolve({ content: [{ type: 'text', text: JSON.stringify({
        score: '4', proof: 'DIT MAG NIET OVERSCHRIJVEN', notes: 'EN DIT AL HELEMAAL NIET',
        as_strategie: 'sterk', as_executie: 'sterk', as_bewijs: 'gemiddeld', as_test: 'sterk'
      }) }] });
    };
    await nickAnalyseer('mx');
    window.wizCall = echt;
    const na = state.library.find(x => x.id === 'mx').matrix;
    const pan = document.querySelector('.wg-drill-panel');
    return { score: na.score, proof: na.proof, notes: na.notes, door: na._door,
             assen: NICK_ASSEN.map(a => na[a.key]),
             vroegAssen: /ALSO JUDGE THESE FOUR AXES/.test(gezien.opdracht || ''),
             gevraagd: /FILL THESE KEYS: score/.test(gezien.opdracht || ''),
             sysAcht: /eight traits of ads that spend/.test(gezien.sys || ''),
             sysGeenResultaat: /Never invent a result/.test(gezien.sys || ''),
             knopWeg: !pan.querySelector('button[data-action="nick-analyse"]'),
             veldNa: (pan.querySelector('.dos-cijfer') || {}).textContent };
  });
  check('hij vult het cijfer in', nick.score, '4');
  /* Hij krijgt alleen de gaten te vullen. Zou hij toch meer terugsturen, dan
     hoort dat genegeerd te worden: een veld dat iemand zelf invulde is een
     besluit, geen suggestie. */
  check('en overschrijft het eigen bewijs niet', nick.proof, 'Dit heb ik zelf nagekeken');
  check('en raakt het resultaatveld niet aan', nick.notes, undefined);
  check('er staat bij dat het zijn oordeel was', nick.door, 'nick');
  check('de opdracht vroeg alleen om het cijfer', nick.gevraagd, true);
  check('en vroeg om de vier assen erbij', nick.vroegAssen, true);
  check('de assen staan in de matrix', nick.assen, ['sterk', 'sterk', 'gemiddeld', 'sterk']);
  check('de opdracht draagt de acht eigenschappen', nick.sysAcht, true);
  check('en verbiedt een verzonnen resultaat', nick.sysGeenResultaat, true);
  /* Het cijfer staat nu bovenaan als optelsom naast de vier assen, niet meer
     als achtste invoerveldje tussen de rest. */
  check('het cijfer staat meteen in het paneel', nick.veldNa, '4/5');
  check('en de knop is verdwenen want er is niets meer leeg', nick.knopWeg, true);

  console.log('');
  console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
  await browser.close();
  srv.close();
  process.exit(fout > 0 ? 1 : 0);
})();
