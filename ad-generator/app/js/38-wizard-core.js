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
  { key: 'generate', num: 9, label: 'Generate', title: 'Final static',           sub: 'Generate, then adjust one element at a time.' }
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
    audience: { personaId: '', awareness: '', market: '' },
    strategy: { angleType: '', marketingAngle: '', messaging: '', desire: '', pain: '', proof: '', objection: '' },
    format:   { formatId: '' },
    visual:   { composition: '', humanPresence: '', scene: '', framing: '', mood: '', productVisibility: '', background: '', productUsage: '', textPlacement: '', referenceUsage: 'product' },
    copy:     { headline: '', supporting: '', body: '', proof: '', cta: '' },
    review:   { visualDescription: '' },
    concepts: { list: [], selected: null },
    generate: { varIndex: null }
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
  chat: [],
  busy: false,
  /* Vragen die Rory uit zichzelf gesteld heeft, per stap. */
  asked: {},
  /* Stappen waarop Rory al uit zichzelf gekeken heeft. Zonder dit blijft hij
     opnieuw beginnen zodra een advies mislukt, want dan is `advice` leeg en
     ziet de volgende hertekening dat als "nog niet gekeken". */
  advised: {},
  /* Stappen waar de gebruiker het formulier heeft opengeklapt. */
  unfolded: {}
};

var WIZ_STORE_KEY = 'wizard_static_v1';

function wizSave() {
  try {
    localStorage.setItem(STORAGE_PREFIX + WIZ_STORE_KEY, JSON.stringify({
      current: wizState.current, data: wizState.data, source: wizState.source,
      done: wizState.done, stale: wizState.stale, advice: wizState.advice,
      chat: wizState.chat.slice(-40), asked: wizState.asked,
      advised: wizState.advised, unfolded: wizState.unfolded
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
    wizState.done = saved.done || {};
    wizState.stale = saved.stale || {};
    wizState.advice = saved.advice || {};
    wizState.chat = saved.chat || [];
    wizState.asked = saved.asked || {};
    wizState.advised = saved.advised || {};
    wizState.unfolded = saved.unfolded || {};
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
  audience: ['personaId', 'awareness'],
  strategy: ['angleType', 'marketingAngle', 'messaging'],
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

function wizOpen() {
  wizState.open = true;
  var ov = document.getElementById('wiz-overlay');
  if (ov) ov.style.display = 'flex';
  document.body.classList.add('wiz-open');
  wizRender();
}

function wizClose() {
  wizState.open = false;
  var ov = document.getElementById('wiz-overlay');
  if (ov) ov.style.display = 'none';
  document.body.classList.remove('wiz-open');
  wizSave();
}

function wizGo(stepKey) {
  if (!wizCanEnter(stepKey)) {
    if (typeof toast === 'function') toast('Finish the earlier steps first', true);
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
  personaId: 'a persona', awareness: 'an awareness level',
  angleType: 'an angle type', marketingAngle: 'a marketing angle', messaging: 'core messaging',
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
  wizState.advice = {}; wizState.chat = []; wizState.asked = {};
  wizState.advised = {}; wizState.unfolded = {};
  wizState.current = 'product';
  wizSave();
  if (wizState.open) wizRender();
}

/* ── Tekenen ────────────────────────────────────────────────────────────── */

function wizEsc(t) {
  return (typeof escapeHtml === 'function') ? escapeHtml(t == null ? '' : String(t)) : String(t == null ? '' : t);
}

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
}

function wizRender() {
  if (!wizState.open) return;
  wizRenderProgress();
  var s = wizStep(wizState.current);
  var head = document.getElementById('wiz-head');
  if (head && s) {
    head.innerHTML = '<div class="wiz-kicker">Step ' + s.num + ' of ' + WIZ_STEPS.length + '</div>' +
      '<h2 class="wiz-title">' + wizEsc(s.title) + '</h2>' +
      '<p class="wiz-sub">' + wizEsc(s.sub) + '</p>' +
      (wizState.stale[wizState.current]
        ? '<div class="wiz-stale-note">An earlier decision changed after this step was filled in. ' +
          'Your own choices are kept. <button type="button" class="wiz-linkbtn" onclick="wizRefreshStep()">Ask Rory to reconsider</button></div>'
        : '');
  }
  var body = document.getElementById('wiz-body');
  if (body) {
    var fn = window['wizRender_' + wizState.current];
    body.innerHTML = (typeof fn === 'function') ? fn() : '<div class="wiz-empty">This step is not available yet.</div>';
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
function wizVoorwaardenGehaald(stepKey) {
  var deps = WIZ_DEPENDS[stepKey] || [];
  return deps.every(function (d) { return wizStepComplete(d); });
}

function wizRenderFooter() {
  var el = document.getElementById('wiz-footer');
  if (!el) return;
  var i = wizStepIndex(wizState.current);
  var laatste = (i === WIZ_STEPS.length - 1);
  el.innerHTML =
    (i > 0 ? '<button type="button" class="wiz-btn ghost" onclick="wizBack()">← Back</button>' : '<span></span>') +
    '<div class="wiz-footer-right">' +
    '<button type="button" class="wiz-btn ghost" onclick="wizReset()">Start over</button>' +
    (laatste ? '' : '<button type="button" class="wiz-btn primary" id="wiz-next" onclick="wizNext()">Continue →</button>') +
    '</div>';
}

/* De romp wordt één keer in de DOM gezet, buiten de bestaande generator-markup
   om. Zo raakt het oude formulier niets kwijt en blijven Kopieer ad, Itereren
   en de Transformer draaien op precies dezelfde elementen als hiervoor. */
function wizMount() {
  if (document.getElementById('wiz-overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'wiz-overlay';
  ov.className = 'wiz-overlay';
  ov.style.display = 'none';
  ov.innerHTML =
    '<div class="wiz-shell" role="dialog" aria-label="Static ad wizard">' +
    '  <div class="wiz-topbar">' +
    '    <div class="wiz-brand">Static ad wizard</div>' +
    '    <div class="wiz-progress" id="wiz-progress"></div>' +
    '    <button type="button" class="wiz-close" onclick="wizClose()" aria-label="Close">✕</button>' +
    '  </div>' +
    '  <div class="wiz-main">' +
    '    <div class="wiz-stage">' +
    '      <div class="wiz-head" id="wiz-head"></div>' +
    '      <div class="wiz-body" id="wiz-body"></div>' +
    '      <div class="wiz-footer" id="wiz-footer"></div>' +
    '    </div>' +
    '    <aside class="wiz-rory" id="wiz-rory"></aside>' +
    '  </div>' +
    '</div>';
  document.body.appendChild(ov);
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
  var open = scratch ? wizClassicOpen : true;
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
  /* Nooit openen bij het laden van de pagina: de gebruiker beslist wanneer hij
     de wizard in gaat. We herstellen alleen de inhoud. */

  /* setMode omwikkelen in plaats van aanpassen: de modus-logica zelf is van
     Kopieer ad en Itereren en daar blijven we vanaf. We willen alleen weten
     dát hij wisselde. */
  if (typeof window.setMode === 'function' && !window.setMode.__wizWrapped) {
    var origineel = window.setMode;
    var omhulsel = function () {
      var r = origineel.apply(this, arguments);
      wizSyncClassic();
      return r;
    };
    omhulsel.__wizWrapped = true;
    window.setMode = omhulsel;
  }
  wizSyncClassic();
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
window.wizFirstIncomplete = wizFirstIncomplete; window.wizHasContent = wizHasContent;
window.wizMissingMessage = wizMissingMessage; window.toggleClassicForm = toggleClassicForm;
window.wizSyncClassic = wizSyncClassic; window.wizRenderProgress = wizRenderProgress;
window.wizRenderFooter = wizRenderFooter; window.wizInvalidate = wizInvalidate;
window.wizStepIndex = wizStepIndex; window.wizBlankData = wizBlankData;
window.wizMisschienAdviseren = wizMisschienAdviseren;
window.wizVoorwaardenGehaald = wizVoorwaardenGehaald;
window.wizSleutelAanwezig = wizSleutelAanwezig;
