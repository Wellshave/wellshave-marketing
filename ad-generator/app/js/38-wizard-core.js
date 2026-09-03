/* Static Ad Wizard — de romp.
 *
 * Vervangt het losse formulier van de Static Ad Generator door negen stappen.
 * Alleen voor "vanaf nul" statics: Kopieer ad, Itereren en de Ad Transformer
 * blijven ongemoeid en draaien nog op het oude formulier.
 *
 * Dit bestand doet drie dingen en verder niets:
 *   1. de toestand vasthouden (wizState) en bewaren over een refresh heen
 *   2. de navigatie bewaken: welke stap mag je in, en wat is er verlopen
 *   3. de romp tekenen (voortgangsbalk, stap-container, Rory-paneel)
 *
 * Het tekenen van de stappen zelf staat in 40-wizard-steps.js, Rory in
 * 39-wizard-rory.js en de uitvoer in 41-wizard-output.js.
 *
 * TAAL: alle interface-tekst hier is Engels, dat is de afspraak voor het nieuwe
 * marketingsysteem. De commentaren blijven Nederlands, in lijn met de rest van
 * deze codebase. Advertentie-copy, klantonderzoek en productteksten worden
 * NOOIT vertaald — die komen door zoals ze zijn.
 */

/* ── De negen stappen ───────────────────────────────────────────────────── */

var WIZ_STEPS = [
  { key: 'product',  num: 1, label: 'Product',  title: 'Product and placement',  sub: 'What are we advertising, and where does it run?' },
  { key: 'audience', num: 2, label: 'Audience', title: 'Audience',               sub: 'Who is this ad for, and what do they already know?' },
  { key: 'strategy', num: 3, label: 'Strategy', title: 'Creative strategy',      sub: 'The argument the ad makes.' },
  { key: 'format',   num: 4, label: 'Format',   title: 'Format',                 sub: 'The shape that argument takes.' },
  { key: 'visual',   num: 5, label: 'Visual',   title: 'Visual direction',       sub: 'What you actually see.' },
  { key: 'copy',     num: 6, label: 'Copy',     title: 'Copy',                   sub: 'The words on the ad.' },
  { key: 'review',   num: 7, label: 'Review',   title: 'Creative blueprint',     sub: 'Everything we decided, before we spend a generation.' },
  { key: 'concepts', num: 8, label: 'Concepts', title: 'Creative concepts',      sub: 'Three routes within the approved strategy.' },
  { key: 'generate', num: 9, label: 'Final',    title: 'Final static',           sub: 'Generate, then adjust one element at a time.' }
];

function wizStepIndex(key) {
  for (var i = 0; i < WIZ_STEPS.length; i++) if (WIZ_STEPS[i].key === key) return i;
  return -1;
}
function wizStep(key) { var i = wizStepIndex(key); return i < 0 ? null : WIZ_STEPS[i]; }

/* ── Afhankelijkheden tussen stappen ────────────────────────────────────────
 *
 * Wie leest van wie. Dit is geen cosmetische volgorde: het bepaalt wat er
 * verloopt als je terugloopt en een eerdere keuze omgooit. Een andere persona
 * maakt de hoek verdacht, maar zegt niets over de plaatsing — die blijft dus
 * staan. Zonder deze tabel zou terugbladeren of alles wissen of niets, en
 * allebei is fout. */
var WIZ_DEPENDS = {
  product:  [],
  audience: ['product'],
  strategy: ['product', 'audience'],
  format:   ['product', 'audience', 'strategy'],
  visual:   ['product', 'strategy', 'format'],
  copy:     ['product', 'audience', 'strategy', 'format'],
  review:   ['product', 'audience', 'strategy', 'format', 'visual', 'copy'],
  concepts: ['product', 'audience', 'strategy', 'format', 'visual', 'copy'],
  generate: ['concepts']
};

/* Alle stappen die (direct of indirect) van `key` afhangen. */
function wizDependentsOf(key) {
  var out = [], veranderd = [key], gevonden = true;
  while (gevonden) {
    gevonden = false;
    WIZ_STEPS.forEach(function (s) {
      if (out.indexOf(s.key) !== -1 || s.key === key) return;
      var deps = WIZ_DEPENDS[s.key] || [];
      for (var i = 0; i < deps.length; i++) {
        if (veranderd.indexOf(deps[i]) !== -1) {
          out.push(s.key); veranderd.push(s.key); gevonden = true; return;
        }
      }
    });
  }
  return out;
}

/* ── Toestand ───────────────────────────────────────────────────────────── */

function wizBlankData() {
  return {
    product:  { productId: '', placement: 'feed11', funnel: '' },
    /* Awareness zegt hoe direct je mag praten; sophistication zegt welk soort
       claim de markt nog gelooft. Ze horen bij elkaar en ze staan er allebei,
       want een boodschap voor een beginner boven een beeld voor een kenner is
       de meest voorkomende manier waarop een verder nette ad omvalt. */
    audience: { personaId: '', awareness: '', sophistication: '', market: '' },
    /* goal en theme komen uit het interview en zijn echte velden, geen
       samenvatting: straks wil je kunnen zien welk doel en welke hoek het
       best liepen. */
    /* differentiation: welke van de vijf manieren van anders-zijn deze hoek
       gebruikt. Zonder dat veld is 'anders' een compliment in plaats van een
       besluit. mechanism is het hoe -- vanaf sophistication 3 is dat het enige
       wat een uitgekeken markt nog gelooft. */
    /* destination: waar de klik landt. Dit is geen nazorg maar onderdeel van
       de strategie: het platform leest de ad EN de pagina en beslist op beide
       aan wie hij hem laat zien. Een ad voor een nieuwe tribe die naar een
       pagina voor de oude massa wijst, geeft een tegenstrijdig signaal. */
    strategy: { angleType: '', goal: '', theme: '', differentiation: '', mechanism: '',
                marketingAngle: '', messaging: '', desire: '', ultimateDesire: '', timing: '',
                pain: '', proof: '', objection: '', destination: '' },
    format:   { formatId: '' },
    /* basisFoto: de foto waar de ad OP gebouwd wordt, in plaats van een beeld dat
       helemaal uit niets ontstaat. Dat is wat een founder-ad nodig heeft: de
       foto van de oprichter is het uitgangspunt, en het product komt nog steeds
       exact uit de referentiefoto's. Null betekent: bouw vanaf nul. */
    /* refsUit: welke referentiebeelden van het product NIET mee mogen, als
       stabiele sleutels ('product:0'). Uitsluiten in plaats van insluiten,
       zodat een foto die later aan het product wordt toegevoegd vanzelf
       meedoet in plaats van stilletjes te ontbreken.
       extraRefs: foto's die alleen voor DEZE ad gelden -- de founder, een
       model, een scene. Ze staan niet in het productbestand omdat ze daar
       ook niet horen. */
    /* newsArchetype/newsAfzender: alleen in gebruik bij een redactioneel
       formaat. Het archetype bepaalt de anatomie van het beeld; de afzender
       is de enige plek waar dit formaat werkelijk fout gaat, en leeg betekent
       hier bewust leeg -- dan blijft de mastheadpositie onbedrukt. */
    visual:   { composition: '', humanPresence: '', scene: '', framing: '', mood: '', productVisibility: '', background: '', productUsage: '', textPlacement: '', referenceUsage: 'product', basisFoto: null, refsUit: [], extraRefs: [], newsArchetype: '', newsAfzender: '' },
    /* removed: wat er bewust niet op de static staat. Een regel die verplicht
       is omdat weglaten anders nooit gebeurt: elke toevoeging voelt gratis en
       is het niet -- ze delen samen de halve seconde aandacht. */
    copy:     { direction: '', headline: '', supporting: '', body: '', proof: '', cta: '', removed: '' },
    review:   { visualDescription: '' },
    concepts: { list: [], selected: null },
    /* pass: 'visueel' is de batchregel -- een idee, dezelfde woorden, drie
       beelden. De hoekpass verandert ook de kop en is daarmee geen batch maar
       drie losse ideeen; die kies je bewust. */
    generate: { varIndex: null, takes: null, uitwerkingen: null, selectedTake: null, pass: 'visueel' }
  };
}

var wizState = {
  open: false,
  current: 'product',
  data: wizBlankData(),
  /* Per veld onthouden we wie het gezet heeft. 'rory' mag overschreven worden
     bij een verversing, 'user' nooit — een handmatige keuze is een besluit, en
     dat gooien we niet weg omdat een eerdere stap wijzigde. */
  source: {},
  /* Stappen die de gebruiker heeft afgerond. */
  done: {},
  /* Stappen waarvan het advies op verouderde aannames rust. */
  stale: {},
  /* Rory's motivatie en gebruikte bronnen per stap. */
  advice: {},
  /* Per stap een eigen gesprek: sparren over de hoek is een ander gesprek dan
     sparren over het format, en ze door elkaar laten lopen maakt allebei
     onleesbaar. */
  chat: {},
  busy: false,
  /* Rory's eigen werk: het advies dat hij bij het openen van een stap uit
     zichzelf ophaalt, de beeldbeschrijving, en het sparren. Apart van busy,
     want anders blokkeert zijn achtergrondwerk jouw knoppen -- en sinds een
     drukke API netjes wordt uitgezeten duurt dat tot ruim veertig seconden. */
  roryBezig: false,
  /* Vragen die Rory uit zichzelf gesteld heeft, per stap. */
  asked: {},
  /* Stappen waarop Rory al uit zichzelf gekeken heeft. Zonder dit blijft hij
     opnieuw beginnen zodra een advies mislukt, want dan is `advice` leeg en
     ziet de volgende hertekening dat als "nog niet gekeken". */
  advised: {},
  /* Stappen waar de gebruiker het formulier heeft opengeklapt. */
  unfolded: {},
  /* De voorproef van de blueprint: één goedkoop beeld om te zien of de
     compositie klopt voordat er drie concepten gemaakt worden. Bewust NIET in
     `data`, want alles daarin gaat naar localStorage -- en een base64-beeld
     kan die opslag vol laten lopen, waarna de wizard stilletjes niets meer
     bewaart. Na een verversing is hij weg; dat kost één goedkoop beeld. */
  voorproef: null, voorproefBezig: false, voorproefFout: null,
  /* Waar dit werk vandaan komt als het is afgekeken bij een concurrent:
     welk merk, hoe lang die advertentie daar draait, welke vorm hij had en
     voor wie hij daar was. Null zolang je vanaf nul werkt. */
  onderzoekBron: null
};

var WIZ_STORE_KEY = 'wizard_static_v1';

function wizSave() {
  try {
    localStorage.setItem(STORAGE_PREFIX + WIZ_STORE_KEY, JSON.stringify({
      current: wizState.current, data: wizState.data, source: wizState.source,
      /* Waar dit vandaan kwam hoort een verversing te overleven: anders is het
         patroon na één F5 spoorloos terwijl de velden er nog staan. */
      onderzoekBron: wizState.onderzoekBron || null,
      done: wizState.done, stale: wizState.stale, advice: wizState.advice,
      chat: wizState.chat, asked: wizState.asked,
      advised: wizState.advised, unfolded: wizState.unfolded,
      /* Het gesprek hoort ook een refresh te overleven: het is werk. */
      interview: (typeof iw2 !== 'undefined')
        ? { spoor: iw2.spoor, i: iw2.i, chat: iw2.chat.slice(-60), antwoorden: iw2.antwoorden,
            klaar: iw2.klaar, samenvatting: iw2.samenvatting }
        : null
    }));
  } catch (e) { /* localStorage vol of geblokkeerd: de wizard werkt door, alleen zonder geheugen */ }
}

function wizLoad() {
  try {
    var raw = localStorage.getItem(STORAGE_PREFIX + WIZ_STORE_KEY);
    if (!raw) return false;
    var saved = JSON.parse(raw);
    if (!saved || !saved.data) return false;
    /* Samenvoegen in plaats van vervangen: een oudere opslag mist velden die
       later zijn bijgekomen, en die moeten hun lege standaard houden in plaats
       van undefined te worden. */
    var blank = wizBlankData();
    Object.keys(blank).forEach(function (k) {
      blank[k] = Object.assign(blank[k], (saved.data && saved.data[k]) || {});
    });
    wizState.data = blank;
    wizState.current = saved.current || 'product';
    wizState.source = saved.source || {};
    wizState.onderzoekBron = saved.onderzoekBron || null;
    wizState.done = saved.done || {};
    wizState.stale = saved.stale || {};
    wizState.advice = saved.advice || {};
    /* Het gesprek is per stap. Oude opslag had er een lijst staan voor de
       hele wizard; die zetten we onder de stap waar hij vandaan kwam, zodat
       niemand zijn gesprek kwijtraakt bij het bijwerken. */
    wizState.chat = Array.isArray(saved.chat)
      ? (saved.chat.length ? { product: saved.chat.slice(-40) } : {})
      : (saved.chat || {});
    wizState.asked = saved.asked || {};
    wizState.advised = saved.advised || {};
    wizState.unfolded = saved.unfolded || {};
    if (saved.interview && typeof iw2 !== 'undefined') {
      iw2.spoor = saved.interview.spoor || null;
      iw2.i = saved.interview.i || 0;
      iw2.chat = saved.interview.chat || [];
      iw2.antwoorden = saved.interview.antwoorden || {};
      iw2.klaar = !!saved.interview.klaar;
      iw2.samenvatting = saved.interview.samenvatting || '';
    }
    return true;
  } catch (e) { return false; }
}

/* Een waarde zetten en vastleggen wie hem zette. */
function wizSet(stepKey, field, value, who) {
  var vak = wizState.data[stepKey];
  if (!vak) return;
  var oud = vak[field];
  if (oud === value) return;
  vak[field] = value;
  wizState.source[stepKey + '.' + field] = who || 'user';
  wizInvalidate(stepKey);
  wizSave();
}

function wizSourceOf(stepKey, field) { return wizState.source[stepKey + '.' + field] || null; }

/* Markeer alles wat van deze stap afhangt als verlopen — wissen doen we niet.
 * De gebruiker ziet dat het advies op een oude aanname rust en beslist zelf of
 * Rory opnieuw moet kijken. Stappen zonder inhoud raken niet verlopen, anders
 * staat de hele wizard vol waarschuwingen voor keuzes die nooit gemaakt zijn. */
function wizInvalidate(stepKey) {
  wizDependentsOf(stepKey).forEach(function (k) {
    if (wizHasContent(k)) wizState.stale[k] = true;
  });
}

function wizHasContent(stepKey) {
  var vak = wizState.data[stepKey];
  if (!vak) return false;
  if (stepKey === 'concepts') return (vak.list || []).length > 0;
  return Object.keys(vak).some(function (f) {
    var v = vak[f];
    return v !== '' && v != null && !(Array.isArray(v) && !v.length);
  });
}

/* ── Wanneer is een stap af ─────────────────────────────────────────────── */

var WIZ_REQUIRED = {
  product:  ['productId', 'placement', 'funnel'],
  audience: ['personaId', 'awareness', 'sophistication'],
  strategy: ['angleType', 'marketingAngle', 'messaging', 'differentiation'],
  format:   ['formatId'],
  visual:   ['composition', 'humanPresence', 'scene', 'mood'],
  copy:     ['headline', 'cta'],
  review:   [],
  concepts: [],
  generate: []
};

function wizStepComplete(stepKey) {
  if (stepKey === 'concepts') return wizState.data.concepts.selected != null;
  if (stepKey === 'review') return !!wizState.done.review;
  if (stepKey === 'generate') return !!wizState.done.generate;
  var req = WIZ_REQUIRED[stepKey] || [];
  var vak = wizState.data[stepKey] || {};
  return req.every(function (f) { return vak[f] !== '' && vak[f] != null; });
}

/* Je mag een stap in als alle eerdere stappen af zijn. Terugkeren naar een
 * afgeronde stap mag altijd — dat is het hele punt van de voortgangsbalk. */
function wizCanEnter(stepKey) {
  var doel = wizStepIndex(stepKey);
  if (doel <= 0) return true;
  for (var i = 0; i < doel; i++) {
    if (!wizStepComplete(WIZ_STEPS[i].key)) return false;
  }
  return true;
}

function wizFirstIncomplete() {
  for (var i = 0; i < WIZ_STEPS.length; i++) {
    if (!wizStepComplete(WIZ_STEPS[i].key)) return WIZ_STEPS[i].key;
  }
  return WIZ_STEPS[WIZ_STEPS.length - 1].key;
}

/* ── Openen, sluiten, navigeren ─────────────────────────────────────────── */

/* De wizard staat in de pagina, niet in een overlay.
 *
 * Dat is geen smaakverschil. In een overlay verdwijnt de zijbalk en daarmee
 * het besef waar je bent: je zit dan in een venster over de console heen in
 * plaats van in een scherm ván de console. Zo staat het ook in het ontwerp --
 * de zwarte zijbalk blijft gewoon staan.
 *
 * Openen betekent hier dus: de ingang en het oude formulier opzij, het
 * wizardpaneel ervoor in de plaats. */
function wizOpen() {
  wizState.open = true;
  wizToonInline();
  wizRender();
}

/* Exit verlaat Statics. Er is niets meer om naar terug te vallen: het
   klassieke formulier hoort bij Kopieer ad en Itereren, niet hier. Je werk
   blijft staan -- wizSave heeft het al -- dus je pakt het later op waar je
   was. */
function wizClose() {
  wizSave();
  if (typeof switchMainTab === 'function') switchMainTab('dashboard');
}

/* Wat er zichtbaar is in de generatorkolom hangt af van twee dingen: draait de
   wizard, en zitten we wel in scratch-modus. Kopieer ad en Itereren delen dit
   scherm en hebben het oude formulier nodig. */
function wizToonInline() {
  var paneel = document.getElementById('wiz-inline');
  var scratch = (!state.generatorMode || state.generatorMode === 'scratch');
  /* In Statics is de wizard het scherm, punt. Er valt niets te openen of te
     sluiten: een nieuwe static maak je via de negen stappen. Kopieer ad en
     Itereren delen dit tabblad en draaien op het klassieke formulier, dus daar
     blijft de wizard weg. */
  var aan = scratch;
  wizState.open = aan;
  if (paneel) paneel.style.display = aan ? '' : 'none';
  /* Draait de wizard, dan is hij het scherm. Configuratie links en Resultaat
     rechts horen bij het klassieke formulier; naast een stap-voor-stap-vraag
     zijn het twee kolommen die om aandacht vragen die je nu niet hebt. */
  var tab = document.getElementById('main-tab-generator');
  if (tab) tab.classList.toggle('wiz-volscherm', aan);
  wizIngangBij();
  wizSyncClassic();
}

/* De ingang naar het gesprek. Twee gedaanten op dezelfde plek:
 *   - op stap 1, zonder lopend gesprek: de tweede weg naar binnen
 *   - met een lopend gesprek, op elke stap: de weg terug
 * Tijdens het interview zelf staat hij er niet -- je bent er al.
 * Alleen op stap 1 beginnen is een bewuste keuze: halverwege de stappen een
 * gesprek starten zou betekenen dat twee routes tegelijk aan dezelfde ad
 * werken, en dan is niet meer te zeggen welke gewonnen heeft. */
function wizIngangBij() {
  var el = document.getElementById('iw2-ingang');
  if (!el) return;
  var bezig = (typeof iw2 !== 'undefined') && iw2.open;
  var loopt = (typeof iw2 !== 'undefined') && iw2.chat && iw2.chat.length > 0;
  var mag = wizState.open && !bezig && (loopt || wizState.current === 'product');
  el.style.display = mag ? '' : 'none';
  if (!mag) return;
  el.className = 'iw2-ingang' + (loopt ? ' terug' : '');
  el.innerHTML = loopt
    ? '<span class="iw2-ingang-i">✦</span><span class="iw2-ingang-t">Return to interview</span>'
    : '<span class="iw2-ingang-i"><img src="img/rory.jpg" alt="" onerror="this.remove()"><i>R</i></span>' +
      '<span><span class="iw2-ingang-t">Interview with Rory</span>' +
      '<span class="iw2-ingang-s">Let Rory build it with you</span></span>';
}

/* Eén knop rechtsboven, twee betekenissen: uit de wizard, of uit het gesprek.
   Het gesprek verlaten vraagt door, want daar gaat werk verloren. */
function iw2Ingang() {
  if (typeof iw2 === 'undefined') return;
  if (iw2.chat && iw2.chat.length) iw2Hervat(); else iw2Start();
}

function wizExitBij() {
  var el = document.getElementById('wiz-exit');
  if (!el) return;
  var bezig = (typeof iw2 !== 'undefined') && iw2.open;
  el.textContent = bezig ? 'Exit interview' : 'Exit';
  el.setAttribute('onclick', bezig ? 'iw2VraagExit()' : 'wizClose()');
}

/* De eerste stap vóór het doel die nog niet af is. Dat is de reden dat je er
   niet in mag, en dus ook de enige zinnige plek om je heen te sturen. */
function wizBlokkerendeStap(stepKey) {
  var doel = wizStepIndex(stepKey);
  for (var i = 0; i < doel; i++) {
    if (!wizStepComplete(WIZ_STEPS[i].key)) return WIZ_STEPS[i].key;
  }
  return null;
}

function wizGo(stepKey) {
  if (!wizCanEnter(stepKey)) {
    /* "Finish the earlier steps first" is waar en waardeloos: op stap 8 met
       drie concepten in beeld weet je niet wat er acht stappen terug ontbreekt.
       Noem de stap, noem het veld, en zet de gebruiker er meteen neer. */
    var blok = wizBlokkerendeStap(stepKey);
    if (!blok) return;
    var s = wizStep(blok);
    if (typeof toast === 'function') {
      toast((s ? s.label + ': ' : '') + wizMissingMessage(blok), true);
    }
    wizState.current = blok;
    wizSave();
    wizRender();
    return;
  }
  wizState.current = stepKey;
  wizSave();
  wizRender();
}

function wizNext() {
  var i = wizStepIndex(wizState.current);
  if (!wizStepComplete(wizState.current)) {
    if (typeof toast === 'function') toast(wizMissingMessage(wizState.current), true);
    return;
  }
  wizState.done[wizState.current] = true;
  if (i < WIZ_STEPS.length - 1) wizGo(WIZ_STEPS[i + 1].key);
}

function wizBack() {
  var i = wizStepIndex(wizState.current);
  if (i > 0) wizGo(WIZ_STEPS[i - 1].key);
}

var WIZ_FIELD_LABELS = {
  productId: 'a product', placement: 'a placement', funnel: 'a campaign goal',
  personaId: 'a persona', awareness: 'an awareness level', sophistication: 'a sophistication stage',
  angleType: 'an angle type', marketingAngle: 'a marketing angle', messaging: 'core messaging',
  differentiation: 'what makes this different', mechanism: 'a mechanism',
  formatId: 'a format',
  composition: 'a composition', humanPresence: 'human presence', scene: 'a scene', mood: 'a mood',
  headline: 'a headline', cta: 'a call to action'
};

function wizMissingMessage(stepKey) {
  if (stepKey === 'concepts') return 'Pick a concept to continue';
  var req = WIZ_REQUIRED[stepKey] || [];
  var vak = wizState.data[stepKey] || {};
  var mist = req.filter(function (f) { return vak[f] === '' || vak[f] == null; })
                .map(function (f) { return WIZ_FIELD_LABELS[f] || f; });
  if (!mist.length) return 'This step is not finished yet';
  return 'Still missing: ' + mist.join(', ');
}

/* Opnieuw beginnen. Bewust achter een bevestiging: de wizard is een half uur
   werk als hij vol staat. */
function wizReset(stil) {
  if (!stil && !confirm('Start over? This clears every decision in this wizard.')) return;
  wizState.data = wizBlankData();
  wizState.source = {}; wizState.done = {}; wizState.stale = {};
  wizState.advice = {}; wizState.chat = {}; wizState.asked = {};
  wizState.advised = {}; wizState.unfolded = {};
  /* Ook de herkomst. Blijft die staan, dan zegt de regel bovenin dat er iets
     is overgenomen terwijl elk veld dat het betrof net leeggemaakt is. */
  wizState.onderzoekBron = null;
  /* En de voorproef, want die hoort bij een blueprint die er niet meer is. */
  wizState.voorproef = null; wizState.voorproefFout = null;
  wizState.current = 'product';
  wizSave();
  if (wizState.open) wizRender();
}

/* ── Tekenen ────────────────────────────────────────────────────────────── */

function wizEsc(t) {
  return (typeof escapeHtml === 'function') ? escapeHtml(t == null ? '' : String(t)) : String(t == null ? '' : t);
}

/* De stappenbalk. Genummerde bolletjes met hun naam ernaast, precies zoals in
   het ontwerp. De nummers zijn hier geen versiering: dit ís een volgorde, en
   welk nummer je hebt gehad zegt hoever je bent. */
function wizRenderProgress() {
  var el = document.getElementById('wiz-progress');
  if (!el) return;
  el.innerHTML = WIZ_STEPS.map(function (s) {
    var af = wizStepComplete(s.key);
    var nu = (wizState.current === s.key);
    var kan = wizCanEnter(s.key);
    var oud = !!wizState.stale[s.key];
    var cls = 'wiz-step' + (nu ? ' on' : '') + (af ? ' done' : '') + (kan ? '' : ' locked') + (oud ? ' stale' : '');
    return '<button type="button" class="' + cls + '" ' + (kan ? '' : 'disabled ') +
      'onclick="wizGo(\'' + s.key + '\')" title="' + wizEsc(s.title) + '">' +
      '<span class="wiz-step-num">' + (af && !nu ? '✓' : s.num) + '</span>' +
      '<span class="wiz-step-label">' + wizEsc(s.label) + '</span>' +
      (oud ? '<span class="wiz-step-flag" title="Based on an earlier choice that changed">!</span>' : '') +
      '</button>';
  }).join('');
  wizPasProgressAan();
}

/* Passen alle negen namen niet, dan houden de nummers hun plek en houdt alleen
   de stap waar je staat zijn naam. Dat is een meting en geen breekpunt in de
   css: hoeveel er past hangt af van de breedte van het paneel, niet van die
   van het venster, en een geraden breekpunt verbergt de namen ook wanneer er
   ruimte voor is -- of kapt de negende af wanneer er net geen ruimte is. */
function wizPasProgressAan() {
  var el = document.getElementById('wiz-progress');
  if (!el) return;
  /* Staat het paneel niet in beeld, dan valt er niets te meten en zou elke
     uitkomst toeval zijn. */
  if (!el.clientWidth) return;
  el.classList.remove('compact');
  if (el.scrollWidth > el.clientWidth + 1) el.classList.add('compact');
}

window.addEventListener('resize', function () { wizPasProgressAan(); });

/* De adviesregel onder de stappenbalk: één zin over wat Rory op deze stap doet
   of gedaan heeft. In het ontwerp is dit de enige plek waar hij het woord
   neemt vóór je iets ziet; de onderbouwing staat rechts in de kolom. */
/* Doet Rory op dit moment iets? Bewust een eigen vraag.
 *
 * wizState.busy was EEN vlag voor alles: de generatie die jij start, en het
 * advies dat Rory uit zichzelf ophaalt bij het openen van een stap. Dat ging
 * goed zolang zo'n advies een seconde duurde. Sinds een drukke API netjes
 * wordt uitgezeten (vier herkansingen, oplopend tot ruim veertig seconden)
 * betekende het dat de hele stap al die tijd op slot zat: elke knop
 * uitgeschakeld, elke klik genegeerd, en geen woord waarom. "Hij werkt niet."
 *
 * Rory's eigen werk zit nu in roryBezig. Dat blokkeert jouw knoppen niet meer;
 * het laat alleen zien dat hij nadenkt. */
function wizRoryBezig() {
  return !!(wizState.roryBezig || wizState.busy);
}

/* Wat er uit Creative Research is meegekomen, boven de stappen. Zonder deze
   regel kom je de wizard binnen op stap 1 met een leeg productveld en is er
   niets te zien van het patroon dat je net hebt laten lezen -- terwijl de
   audience-, strategie- en formaatstap wel degelijk ingevuld zijn. Dan lijkt
   het alsof er niets is overgenomen, en begin je opnieuw.

   Het staat er ook omdat het een derde soort herkomst is: niet jouw keuze en
   niet Rory's advies, maar afgekeken bij een ander. Dat hoort zichtbaar te
   zijn zolang het meegaat. */
function wizRenderOnderzoek() {
  var el = document.getElementById('wiz-onderzoek');
  if (!el) return;
  var b = wizState.onderzoekBron;
  if (!b) { el.innerHTML = ''; el.style.display = 'none'; return; }
  var uit = Object.keys(wizState.source).filter(function (k) {
    return wizState.source[k] === 'onderzoek';
  }).length;
  var h = '<div class="wiz-onderzoek-kop">Overgenomen uit Creative Research' +
    (b.merk ? ' — gezien bij ' + wizEsc(b.merk) : '') +
    (b.dagen_actief ? ', draait daar al ' + wizEsc(b.dagen_actief) + ' dagen' : '') + '</div>';
  var regels = [];
  if (uit) regels.push(uit + ' ' + (uit === 1 ? 'veld staat' : 'velden staan') + ' al ingevuld');
  if (b.publiek) regels.push('Voor wie het daar was: ' + b.publiek);
  if (b.formaat) regels.push('Vorm daar: ' + b.formaat);
  /* Wat er NIET meekwam hoort in dezelfde regel te staan als wat er wel
     meekwam. Anders leest "overgenomen" als "alles is geregeld". */
  regels.push('Het beeld, de copy en de claims van dat merk zijn niet meegekomen. ' +
    'Welk van onze producten dit wordt, kies je zelf.');
  h += '<div class="wiz-onderzoek-tekst">' + regels.map(wizEsc).join(' · ') + '</div>';
  h += '<button type="button" class="wiz-onderzoek-weg" onclick="wizOnderzoekWeg()" ' +
    'title="deze regel weghalen">×</button>';
  el.innerHTML = h;
  el.style.display = 'block';
}

/* Weghalen haalt de regel weg, niet de ingevulde velden: die zijn een besluit
   geworden zodra je ermee doorwerkt. */
function wizOnderzoekWeg() {
  wizState.onderzoekBron = null;
  wizSave();
  wizRenderOnderzoek();
}

function wizRenderRoryBalk() {
  var el = document.getElementById('wiz-rorybalk');
  if (!el) return;
  var k = wizState.current;
  var adv = wizState.advice[k] || {};
  var tekst = '';
  if (wizRoryBezig()) tekst = WIZ_BEZIG[k] || 'Rory is working on this step.';
  else if (adv.error) tekst = adv.error;
  else if (adv.why) tekst = adv.why;
  else tekst = WIZ_OPENING[k] || '';
  el.innerHTML = tekst
    ? '<span class="wiz-rorybalk-punt' + (wizRoryBezig() ? ' bezig' : '') + '"></span>' +
      '<span>' + wizEsc(tekst) + '</span>' +
      /* Een mislukte aanroep is bijna altijd tijdelijk: druk, een afgekapte
         verbinding. Zonder knop staat er een mededeling die je alleen kunt
         wegkijken, en dan vul je de stap zelf in terwijl een tweede poging
         het gedaan had. */
      (!wizRoryBezig() && adv.error
        ? ' <button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'' + k + '\')">Try again</button>'
        : '') +
      /* De lichtlijn bestaat alleen terwijl er echt iets draait: beweging die
         niets betekent is decoratie, en decoratie went binnen een dag. */
      (wizRoryBezig() ? '<span class="wiz-lichtlijn" aria-hidden="true"></span>' : '')
    : '';
  el.classList.toggle('bezig', !!(tekst && wizRoryBezig()));
  el.style.display = tekst ? '' : 'none';
}

/* Wat er staat terwijl Rory kijkt, per stap. Een spinner zonder woorden laat
   de gebruiker raden waar hij op wacht. */
var WIZ_BEZIG = {
  product:  'Rory is analyzing your product and placement to build the best foundation.',
  audience: 'Rory is weighing the personas against this product and funnel stage.',
  strategy: 'Rory is building the strategic foundation from the research.',
  format:   'Rory is narrowing 42 formats down to the ones that carry this angle.',
  visual:   'Rory is turning the strategy into a picture.',
  copy:     'Rory is writing the copy that fits the strategy and visual.',
  review:   'Rory is writing out what the ad will look like.',
  concepts: 'Rory is working out three concepts that keep the same strategy.'
};

/* En wat er staat vóór hij iets gezegd heeft. */
var WIZ_OPENING = {
  product:  'Select the product and where the ad will appear.',
  audience: 'Based on your product and funnel stage, Rory picks the audience.',
  strategy: 'Rory creates the strategic foundation for this audience.',
  format:   'Rory picks the formats that fit your strategy and audience best.',
  visual:   'Rory recommends a visual direction for the selected format.',
  copy:     'Rory writes the copy that fits the strategy and visual.',
  review:   'Review the complete blueprint before generating.',
  concepts: 'Choose your favourite concept direction.',
  generate: 'Generate and fine-tune your final static ad.'
};

/* Het interview in hetzelfde paneel, maar met een eigen kop en een eigen voet.
   Hergebruik van de romp in plaats van een tweede scherm ernaast: de zijbalk,
   het paneel en de plek op het scherm blijven zo gelijk, en je hoeft niet te
   ontdekken waar je nu weer bent. */
function wizRenderInterview() {
  var paneel = document.querySelector('.wiz-paneel');
  if (paneel) paneel.classList.add('iw2-modus');
  /* Rory's eigen kolom gaat weg zolang het gesprek loopt: hij zit erin. Twee
     Rory's naast elkaar op één scherm is niet dubbel zo veel hulp, het is de
     vraag welke van de twee je aanspreekt. */
  var kolom = document.getElementById('wiz-rory');
  if (kolom) kolom.style.display = 'none';
  wizExitBij();
  wizIngangBij();

  var kop = iw2Kop();
  var head = document.getElementById('wiz-head');
  if (head) {
    head.innerHTML = '<h2 class="wiz-title">' + kop.num + '. Interview — ' + wizEsc(kop.titel) +
      ' <span class="iw2-beta">Beta</span></h2>';
  }
  var balk = document.getElementById('wiz-rorybalk');
  if (balk) balk.innerHTML = '';

  var body = document.getElementById('wiz-body');
  if (body) {
    var uit = iw2Render();
    body.className = 'wiz-body wiz-tweekolom iw2-body';
    body.innerHTML = '<div class="wiz-links">' + (uit.links || '') + '</div>' +
                     '<div class="wiz-rechts">' + (uit.rechts || '') + '</div>';
    /* Het gesprek groeit naar onderen; je wil het laatste zien, niet het eerste. */
    var chat = document.getElementById('iw2-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }
  var voet = document.getElementById('wiz-footer');
  if (voet) voet.innerHTML = iw2RenderVoet();
}

/* Een stap levert twee kolommen: de beslissingen links, en rechts de
   tegenhanger die laat zien waar ze op rusten -- de productkaart, de andere
   persona's, "Why this works", de preview. Een renderer mag ook één string
   teruggeven; dan vult die de volle breedte. */
function wizRender() {
  if (!wizState.open) return;
  /* Draait het interview, dan neemt dat het paneel over: geen stappenbalk, geen
     stapkop, geen voetknoppen. Je bent uit de stappenmodus, en een halve
     stappenbalk boven een gesprek zegt iets wat niet waar is. */
  if (typeof iw2 !== 'undefined' && iw2.open) { wizRenderInterview(); return; }
  var paneel = document.querySelector('.wiz-paneel');
  if (paneel) paneel.classList.remove('iw2-modus');
  var roryKolom = document.getElementById('wiz-rory');
  if (roryKolom) roryKolom.style.display = '';
  wizExitBij();
  wizIngangBij();
  wizRenderProgress();
  var s = wizStep(wizState.current);
  var head = document.getElementById('wiz-head');
  if (head && s) {
    /* Het nummer hoort bij de kop, niet alleen bij het balkje: dan weet je op
       elk scherm hoeveelste vraag dit is zonder omhoog te kijken. */
    head.innerHTML = '<h2 class="wiz-title">' + s.num + '. ' + wizEsc(s.title) + '</h2>' +
      '<p class="wiz-sub">' + wizEsc(s.sub) + '</p>' +
      (wizState.stale[wizState.current]
        ? '<div class="wiz-stale-note">An earlier decision changed after this step was filled in. ' +
          'Your own choices are kept. <button type="button" class="wiz-linkbtn" onclick="wizRefreshStep()">Ask Rory to reconsider</button></div>'
        : '');
  }
  wizRenderRoryBalk();
  wizRenderOnderzoek();

  var body = document.getElementById('wiz-body');
  if (body) {
    var fn = window['wizRender_' + wizState.current];
    var uit = (typeof fn === 'function') ? fn() : '<div class="wiz-empty">This step is not available yet.</div>';
    if (uit && typeof uit === 'object') {
      body.className = 'wiz-body wiz-tweekolom';
      body.innerHTML = '<div class="wiz-links">' + (uit.links || '') + '</div>' +
                       '<div class="wiz-rechts">' + (uit.rechts || '') + '</div>';
    } else {
      body.className = 'wiz-body';
      body.innerHTML = uit || '';
    }
    var after = window['wizAfter_' + wizState.current];
    if (typeof after === 'function') { try { after(); } catch (e) { console.error(e); } }
  }
  wizRenderFooter();
  if (typeof wizRenderRory === 'function') wizRenderRory();
  wizMisschienAdviseren();
}

/* Rory kijkt uit zichzelf.
 *
 * Dit is het verschil tussen een wizard en een formulier met een hulpknop. De
 * opdracht was expliciet: Rory wacht niet tot de gebruiker alles handmatig
 * configureert. Dus zodra je een stap binnenkomt waar hij nog niet gekeken
 * heeft, en er genoeg bovenliggende data ligt om iets zinnigs te zeggen, gaat
 * hij aan het werk. De gebruiker ziet een voorstel, geen leeg veld.
 *
 * Twee remmen. `advised` zorgt dat een mislukt advies niet meteen opnieuw
 * begint -- anders loopt een kapotte verbinding zichzelf in een kring. En een
 * stap die de gebruiker al zelf heeft ingevuld laten we met rust: dan is er
 * niets meer voor te stellen wat niet zijn eigen keuze overschrijft. */
function wizMisschienAdviseren() {
  var k = wizState.current;
  if (wizState.busy) return;
  if (wizState.advised[k]) return;
  if (wizState.advice[k]) return;
  if (typeof wizAdvise !== 'function') return;
  if (typeof WIZ_ADVICE_SPEC === 'undefined' || !WIZ_ADVICE_SPEC[k]) return;
  /* Zonder sleutel geen aanroep. Anders staat een gebruiker zonder koppeling
     bij elke stap tegen een mislukking aan te kijken die niets met zijn keuze
     te maken heeft, en gaat de proxy voor niets aan het werk. */
  if (!wizSleutelAanwezig()) return;
  /* Stappen zonder eigen invoer (review, concepten, genereren) adviseert hij
     niet: daar is de beslissing al gevallen. */
  if (!wizVoorwaardenGehaald(k)) return;
  /* Niet "heeft deze stap al inhoud" maar "is deze stap al af". Dat verschil
     is geen haarkloverij: stap 1 heeft vanaf het begin een standaardplaatsing
     staan, dus op inhoud toetsen betekent dat Rory er nooit naar kijkt. Een
     afgeronde stap laat hij wél met rust -- daar valt niets voor te stellen
     wat niet iemands eigen keuze overschrijft. */
  if (wizStepComplete(k) && !wizState.stale[k]) return;

  wizState.advised[k] = true;
  wizAdvise(k).then(function (adv) {
    if (adv && !adv.error) wizApplyAdvice(k);
    wizRender();
  });
}

function wizSleutelAanwezig() {
  if (window.__WG_TEAMSERVER) return true;
  var el = document.getElementById('anthropic-key');
  return !!(el && el.value && el.value.trim());
}

/* Heeft Rory genoeg om op te staan? Elke stap leest van zijn voorgangers; is
   die nog leeg, dan zou hij gaan gissen en dat is precies wat een leeg veld
   beter maakt dan een verzonnen veld. */
/* Sommige stappen hebben geen voorganger en toch een onderwerp. Stap 1 is de
   enige: zonder gekozen product is er niets om over te adviseren, en dan is een
   aanbeveling over de funnelfase een mening over een product dat nog niet
   bestaat. Dat leest als kennis en is het niet. */
var WIZ_ONDERWERP = { product: 'productId' };

function wizVoorwaardenGehaald(stepKey) {
  var eigen = WIZ_ONDERWERP[stepKey];
  if (eigen && !(wizState.data[stepKey] || {})[eigen]) return false;
  var deps = WIZ_DEPENDS[stepKey] || [];
  return deps.every(function (d) { return wizStepComplete(d); });
}

/* De hoofdknop heet naar wat er gebeurt als je hem indrukt. "Continue" op de
   stap waar drie beelden gegenereerd worden verzwijgt precies het enige wat je
   moet weten: dat het nu geld gaat kosten. */
var WIZ_KNOP = {
  review:   { label: 'Generate concepts →', fn: 'wizApproveBlueprint()' },
  concepts: { label: 'Generate final ad →', fn: 'wizNaarEindbeeld()' },
  /* "Save ad" enkelvoud verzweeg dat er drie meegaan. Een concept is een ad
     set en die krijgt drie variaties; alle drie gaan de bibliotheek in. */
  generate: { label: 'Save all 3 →',        fn: 'wizHandOff()' }
};

function wizRenderFooter() {
  var el = document.getElementById('wiz-footer');
  if (!el) return;
  var i = wizStepIndex(wizState.current);
  var k = WIZ_KNOP[wizState.current];
  el.innerHTML =
    (i > 0 ? '<button type="button" class="wiz-btn ghost" onclick="wizBack()">← Back</button>' : '<span></span>') +
    '<div class="wiz-footer-right">' +
    '<button type="button" class="wiz-btn ghost" onclick="wizReset()">Start over</button>' +
    '<button type="button" class="wiz-btn primary" id="wiz-next" onclick="' +
      (k ? k.fn : 'wizNext()') + '"' + (wizState.busy ? ' disabled' : '') + '>' +
      wizEsc(k ? k.label : 'Continue →') + '</button>' +
    '</div>';
}

/* De romp wordt één keer in de DOM gezet, buiten de bestaande generator-markup
   om. Zo raakt het oude formulier niets kwijt en blijven Kopieer ad, Itereren
   en de Transformer draaien op precies dezelfde elementen als hiervoor. */
/* Het paneel komt in de generatorkolom te staan, vlak boven het klassieke
   formulier. Niet in body: dan zou het buiten de kolom vallen en zou de
   zijbalk er weer overheen liggen. */
function wizMount() {
  if (document.getElementById('wiz-inline')) return;
  var anker = document.getElementById('classic-toggle') || document.getElementById('classic-form');
  if (!anker || !anker.parentNode) return;

  var el = document.createElement('div');
  el.id = 'wiz-inline';
  el.className = 'wiz-inline scratch-only';
  el.style.display = 'none';
  el.innerHTML =
    '<div class="wiz-paneel">' +
    /* Naam en uitgang op de eerste regel, de stappen op de tweede. Op één
       regel samen paste de negende stap er niet meer bij en schoof hij buiten
       beeld -- en juist die balk moet vertellen waar je bent en wat er nog
       komt. */
    '  <div class="wiz-topbar">' +
    '    <div class="wiz-topbar-rij">' +
    '      <div class="wiz-brand">Static Ad Generator</div>' +
    '      <button type="button" class="wiz-close" id="wiz-exit" onclick="wizClose()">Exit</button>' +
    '    </div>' +
    '    <div class="wiz-progress" id="wiz-progress"></div>' +
    '  </div>' +
    '  <div class="wiz-onderzoek" id="wiz-onderzoek"></div>' +
    '  <div class="wiz-rorybalk" id="wiz-rorybalk"></div>' +
    '  <div class="wiz-head" id="wiz-head"></div>' +
    '  <div class="wiz-body" id="wiz-body"></div>' +
    '  <div class="wiz-footer" id="wiz-footer"></div>' +
    /* De ingang naar het gesprek, zwevend rechtsonder in het paneel. Subtiel en
       altijd op dezelfde plek: op stap 1 is het de tweede weg naar binnen, en
       daarna is het de weg terug naar een gesprek dat al loopt. */
    '  <button type="button" class="iw2-ingang" id="iw2-ingang" onclick="iw2Ingang()"></button>' +
    '</div>' +
    '<aside class="wiz-rory" id="wiz-rory"></aside>';
  anker.parentNode.insertBefore(el, anker);
}

/* ── Het klassieke formulier ────────────────────────────────────────────────
 *
 * Kopieer ad en Itereren delen dit scherm met de generator: switchMainTab zet
 * beide op main-tab-generator en roept alleen setMode aan. Het oude formulier
 * mag dus niet zomaar weg — in die twee modi IS het het scherm. Vandaar deze
 * regel: ingeklapt zolang we vanaf nul bouwen, altijd open zodra het een
 * andere modus is. */

var wizClassicOpen = false;

function wizSyncClassic() {
  var wrap = document.getElementById('classic-form');
  if (!wrap) return;
  var scratch = (!state.generatorMode || state.generatorMode === 'scratch');
  /* Draait de wizard, dan is het oude formulier eronder alleen ruis: dezelfde
     beslissingen, twee keer, met een kans dat ze uit elkaar lopen. */
  var open = scratch ? (wizClassicOpen && !wizState.open) : true;
  wrap.classList.toggle('collapsed', !open);
  var lbl = document.getElementById('classic-toggle-label');
  if (lbl) lbl.textContent = open ? 'Hide the classic form' : 'Use the classic form instead';
  var tog = document.getElementById('classic-toggle');
  if (tog) tog.classList.toggle('open', open);
}

function toggleClassicForm() {
  wizClassicOpen = !wizClassicOpen;
  wizSyncClassic();
}

function wizBoot() {
  wizMount();
  wizLoad();

  /* setMode omwikkelen in plaats van aanpassen: de modus-logica zelf is van
     Kopieer ad en Itereren en daar blijven we vanaf. We willen alleen weten
     dát hij wisselde. */
  if (typeof window.setMode === 'function' && !window.setMode.__wizWrapped) {
    var origineel = window.setMode;
    var omhulsel = function () {
      var r = origineel.apply(this, arguments);
      wizToonInline();
      wizRender();
      return r;
    };
    omhulsel.__wizWrapped = true;
    window.setMode = omhulsel;
  }

  /* Hetzelfde voor het tabblad: Statics binnenlopen is de wizard binnenlopen,
     dus na de wissel moet hij getekend staan. */
  if (typeof window.switchMainTab === 'function' && !window.switchMainTab.__wizWrapped) {
    var origTab = window.switchMainTab;
    var omhulselTab = function (tab) {
      var r = origTab.apply(this, arguments);
      wizToonInline();
      if (tab === 'generator') wizRender();
      return r;
    };
    omhulselTab.__wizWrapped = true;
    window.switchMainTab = omhulselTab;
  }
  wizToonInline();
}

if (document.readyState !== 'loading') wizBoot();
else document.addEventListener('DOMContentLoaded', wizBoot);

/* Alles wat vanuit onclick-attributen aangeroepen wordt moet op window staan —
   console-boot.cjs controleert dat, en terecht: een functie die alleen in de
   modulescope leeft geeft een stille ReferenceError bij de klik. */
window.wizOpen = wizOpen; window.wizClose = wizClose; window.wizGo = wizGo;
window.wizNext = wizNext; window.wizBack = wizBack; window.wizReset = wizReset;
window.wizRender = wizRender; window.wizSet = wizSet; window.wizState = wizState;
window.wizStepComplete = wizStepComplete; window.wizCanEnter = wizCanEnter;
window.wizDependentsOf = wizDependentsOf; window.wizSourceOf = wizSourceOf;
window.wizEsc = wizEsc; window.WIZ_STEPS = WIZ_STEPS; window.wizSave = wizSave;
window.wizRenderOnderzoek = wizRenderOnderzoek; window.wizOnderzoekWeg = wizOnderzoekWeg;
window.wizFirstIncomplete = wizFirstIncomplete; window.wizHasContent = wizHasContent;
window.wizMissingMessage = wizMissingMessage; window.toggleClassicForm = toggleClassicForm;
window.wizBlokkerendeStap = wizBlokkerendeStap; window.WIZ_ONDERWERP = WIZ_ONDERWERP;
window.iw2Ingang = iw2Ingang; window.wizIngangBij = wizIngangBij;
window.wizRenderInterview = wizRenderInterview;
window.wizSyncClassic = wizSyncClassic; window.wizRenderProgress = wizRenderProgress;
window.wizRenderFooter = wizRenderFooter; window.wizInvalidate = wizInvalidate;
window.wizStepIndex = wizStepIndex; window.wizBlankData = wizBlankData;
window.wizMisschienAdviseren = wizMisschienAdviseren;
window.wizVoorwaardenGehaald = wizVoorwaardenGehaald;
window.wizSleutelAanwezig = wizSleutelAanwezig; window.wizRoryBezig = wizRoryBezig;
