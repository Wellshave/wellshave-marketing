/* Static Ad Wizard — stap 1 tot en met 6.
 *
 * De vorm van dit scherm is één beslissing, en die is het waard om op te
 * schrijven omdat de eerste versie hem miste.
 *
 *   EEN STAP IS EEN ZIN, GEEN FORMULIER.
 *
 * De eerste versie zette per stap alle keuzevelden naast elkaar met een knop
 * "vraag Rory". Dat is een control panel in negen delen: de gebruiker moet nog
 * steeds alles zelf invullen, alleen verdeeld over meer schermen. De opdracht
 * was het omgekeerde -- Rory beslist, legt uit, en de gebruiker corrigeert.
 *
 * Dus opent elke stap met wat Rory gekozen heeft, geschreven als gewone zin:
 *
 *     We advertise Groom Guard to cold traffic, in a 1:1 feed placement.
 *
 * De vetgedrukte woorden zijn de beslissingen. Klik erop en de keuzes klappen
 * open, precies daar. Wie niets wil veranderen leest één regel en gaat door.
 * Wie alles wil zien klikt "Change this" en krijgt het volledige paneel.
 *
 * Wat dat oplevert tegenover de vorige versie:
 *   - geen lege velden meer; er staat altijd al een antwoord
 *   - stap 5 toont vijf hoofdkeuzes in plaats van tien blokken tegelijk
 *   - de copy staat er als copy, op ware grootte, niet als invoervakken
 *
 * Interface-tekst is Engels. Wat uit productdata, persona's, onderzoek of de
 * advertentiecopy zelf komt tonen we onvertaald -- dat is bronmateriaal.
 */

/* ── De zin ─────────────────────────────────────────────────────────────────
 *
 * Een zin is een lijst stukken: gewone tekst, of een beslissing. Een
 * beslissing rendert als klikbaar woord dat zijn eigen keuzelijst opent. */

function wizZin(stepKey, delen) {
  var h = '<p class="wiz-zin">' + delen.map(function (d) {
    if (typeof d === 'string') return wizEsc(d);
    var waarde = (wizState.data[stepKey] || {})[d.field];
    var etiket = d.label ? d.label(waarde) : waarde;
    var leeg = !etiket;
    return '<button type="button" class="wiz-woord' + (leeg ? ' leeg' : '') + '" ' +
      'aria-expanded="' + (wizState.openVeld === stepKey + '.' + d.field ? 'true' : 'false') + '" ' +
      'onclick="wizOpenVeld(\'' + stepKey + '\',\'' + d.field + '\')">' +
      wizEsc(leeg ? (d.leeg || 'choose') : etiket) + '</button>';
  }).join('') + '</p>' + wizVeldPaneel(stepKey, delen);
  return h;
}

/* Het paneel dat onder de zin openklapt zodra je op een woord klikt. */
function wizVeldPaneel(stepKey, delen) {
  var open = wizState.openVeld;
  if (!open || open.indexOf(stepKey + '.') !== 0) return '';
  var veld = open.slice(stepKey.length + 1);
  var deel = delen.filter(function (d) { return typeof d !== 'string' && d.field === veld; })[0];
  if (!deel || !deel.opts) return '';
  return '<div class="wiz-veldpaneel">' +
    '<div class="wiz-veldpaneel-t">' + wizEsc(deel.titel || veld) + '</div>' +
    wizChoices(stepKey, veld, deel.opts, 3) +
    '</div>';
}

function wizOpenVeld(stepKey, field) {
  var sleutel = stepKey + '.' + field;
  wizState.openVeld = (wizState.openVeld === sleutel) ? null : sleutel;
  wizRender();
}

/* Een rij keuzekaarten. */
function wizChoices(stepKey, field, opts, kolommen) {
  var huidig = (wizState.data[stepKey] || {})[field];
  var aanbevolen = ((wizState.advice[stepKey] || {}).recommendation || {})[field];
  return '<div class="wiz-choices' + (kolommen ? ' cols-' + kolommen : '') + '">' + opts.map(function (o) {
    var aan = (String(huidig) === String(o.value));
    var tip = (String(aanbevolen) === String(o.value));
    return '<button type="button" class="wiz-choice' + (aan ? ' on' : '') + (tip ? ' rec' : '') + '" ' +
      'data-field="' + wizEsc(field) + '" data-value="' + wizEsc(o.value) + '" ' +
      'onclick="wizPick(\'' + stepKey + '\',\'' + field + '\',this.getAttribute(\'data-value\'))">' +
      (tip ? '<span class="wiz-choice-rec">Rory</span>' : '') +
      '<span class="wiz-choice-label">' + wizEsc(o.label) + '</span>' +
      (o.hint ? '<span class="wiz-choice-hint">' + wizEsc(o.hint) + '</span>' : '') +
      '</button>';
  }).join('') + '</div>';
}

function wizPick(stepKey, field, value) {
  wizSet(stepKey, field, value, 'user');
  wizState.openVeld = null;
  wizRender();
}

/* Het volledige paneel, achter "Change this". Alleen wie het wil ziet het. */
function wizUitklap(stepKey, inhoud, label) {
  var open = !!wizState.unfolded[stepKey];
  return '<div class="wiz-uitklap">' +
    '<button type="button" class="wiz-uitklap-knop' + (open ? ' open' : '') + '" onclick="wizToggleUitklap(\'' + stepKey + '\')">' +
    wizEsc(open ? 'Hide the details' : (label || 'Change this')) + '<span class="wiz-chev">▾</span></button>' +
    (open ? '<div class="wiz-uitklap-body">' + inhoud + '</div>' : '') +
    '</div>';
}

function wizToggleUitklap(stepKey) {
  wizState.unfolded[stepKey] = !wizState.unfolded[stepKey];
  wizSave();
  wizRender();
}

/* Terwijl Rory kijkt. Geen spinner zonder woorden: de gebruiker moet weten
   waar hij naar wacht, anders voelt elke seconde als een storing. */
function wizDenkt(watRoryDoet) {
  return '<div class="wiz-denkt"><span class="wiz-denkt-punt"></span>' +
    '<span>' + wizEsc(watRoryDoet) + '</span></div>';
}

/* Een tekstveld, alleen nog in de uitklap. */
function wizField(stepKey, field, label, hint, meerregelig) {
  var v = (wizState.data[stepKey] || {})[field] || '';
  var bron = wizSourceOf(stepKey, field);
  var id = 'wizf-' + stepKey + '-' + field;
  return '<div class="wiz-field">' +
    '<label for="' + id + '">' + wizEsc(label) +
      (bron === 'rory' ? '<span class="wiz-tag rory">Rory</span>' : '') +
      (bron === 'user' ? '<span class="wiz-tag user">yours</span>' : '') +
      (hint ? '<span class="wiz-hint">' + wizEsc(hint) + '</span>' : '') + '</label>' +
    (meerregelig
      ? '<textarea id="' + id + '" rows="' + (meerregelig === true ? 3 : meerregelig) + '" onblur="wizFieldSave(\'' + stepKey + '\',\'' + field + '\',this.value)">' + wizEsc(v) + '</textarea>'
      : '<input id="' + id + '" value="' + wizEsc(v) + '" onblur="wizFieldSave(\'' + stepKey + '\',\'' + field + '\',this.value)">') +
    '</div>';
}

function wizFieldSave(stepKey, field, value) {
  var oud = (wizState.data[stepKey] || {})[field] || '';
  if (String(oud) === String(value)) return;
  wizSet(stepKey, field, value, 'user');
  wizRenderProgress();
  wizRenderFooter();
}

function wizAskFor(stepKey) {
  wizState.advised[stepKey] = true;
  wizAdvise(stepKey).then(function (adv) {
    if (adv && !adv.error) wizApplyAdvice(stepKey);
    wizRender();
  });
}

function wizHerzie(stepKey, label) {
  return '<button type="button" class="wiz-btn ghost small" onclick="wizAskFor(\'' + stepKey + '\')"' +
    (wizState.busy ? ' disabled' : '') + '>' + wizEsc(label || 'Have Rory rethink this') + '</button>';
}

/* Alternatieven, als stille rij onder de zin. */
function wizAlternatives(stepKey) {
  var adv = wizState.advice[stepKey];
  if (!adv || !adv.alternatives || !adv.alternatives.length) return '';
  return '<div class="wiz-alts"><div class="wiz-alts-title">Rory also considered</div>' +
    adv.alternatives.slice(0, 3).map(function (a, i) {
      return '<button type="button" class="wiz-alt" onclick="wizTakeAlternative(\'' + stepKey + '\',' + i + ')">' +
        '<span class="wiz-alt-label">' + wizEsc(a.label || ('Alternative ' + (i + 1))) + '</span>' +
        '<span class="wiz-alt-sum">' + wizEsc(a.summary || '') + '</span></button>';
    }).join('') + '</div>';
}

function wizTakeAlternative(stepKey, i) {
  var adv = wizState.advice[stepKey];
  var alt = adv && adv.alternatives && adv.alternatives[i];
  if (!alt || !alt.values) return;
  Object.keys(alt.values).forEach(function (f) {
    if (f in (wizState.data[stepKey] || {})) wizSet(stepKey, f, String(alt.values[f]), 'user');
  });
  wizRender();
}

/* ── Optielijsten ───────────────────────────────────────────────────────── */

var WIZ_PLACEMENTS = [
  { value: 'feed11', label: 'Feed 1:1', hint: 'Square, safe everywhere' },
  { value: 'feed45', label: 'Feed 4:5', hint: 'More vertical space in feed' },
  { value: 'stories', label: 'Stories 9:16', hint: 'Full screen, short dwell' },
  { value: 'reels', label: 'Reels 9:16', hint: 'Full screen, heavy bottom UI' }
];

var WIZ_FUNNELS = [
  { value: 'tof', label: 'Cold reach', hint: 'They do not know the brand yet' },
  { value: 'mof', label: 'Consideration', hint: 'They are weighing options' },
  { value: 'bof', label: 'Conversion', hint: 'Ready to buy, needs a push' },
  { value: 'retargeting', label: 'Retargeting', hint: 'Visited the site, did not buy' }
];

var WIZ_AWARENESS = [
  { value: 'unaware', label: 'Unaware', hint: 'Does not know the problem yet' },
  { value: 'problem', label: 'Problem aware', hint: 'Feels the pain, knows no solution' },
  { value: 'solution', label: 'Solution aware', hint: 'Knows solution types, not the brand' },
  { value: 'product', label: 'Product aware', hint: 'Knows the brand, not convinced' },
  { value: 'most', label: 'Most aware', hint: 'Ready, waiting for a reason' }
];

function wizOptLabel(opts, waarde) {
  var o = (opts || []).filter(function (x) { return x.value === waarde; })[0];
  return o ? o.label : '';
}

/* ── Stap 1: Product en plaatsing ───────────────────────────────────────── */

function wizRender_product() {
  var prods = state.products || [];
  if (!prods.length) {
    return '<div class="wiz-empty">No products yet. Add one in the Products tab first — the wizard builds everything on that data.</div>';
  }
  var p = wizProduct();
  var h = '';

  if (!p) {
    h += '<div class="wiz-block"><div class="wiz-block-t">Which product?</div>' +
      '<div class="wiz-choices cols-2">' + prods.map(function (x) {
        return '<button type="button" class="wiz-choice" onclick="wizPickProduct(\'' + wizEsc(x.id) + '\')">' +
          '<span class="wiz-choice-label">' + wizEsc(x.name) + '</span>' +
          (x.category ? '<span class="wiz-choice-hint">' + wizEsc(x.category) + '</span>' : '') +
          '</button>';
      }).join('') + '</div></div>';
    return h;
  }

  if (wizState.busy && !wizState.advice.product) {
    h += wizDenkt('Rory is reading the product data, the USPs and what already ran.');
  }

  h += wizZin('product', [
    'We advertise ',
    { field: 'productId', titel: 'Product', label: function () { return p.name; },
      opts: prods.map(function (x) { return { value: x.id, label: x.name, hint: x.category || '' }; }) },
    ' to ',
    { field: 'funnel', titel: 'Campaign goal', leeg: 'which audience',
      label: function (v) { return wizOptLabel(WIZ_FUNNELS, v); }, opts: WIZ_FUNNELS },
    ', as a ',
    { field: 'placement', titel: 'Placement', leeg: 'placement',
      label: function (v) { return wizOptLabel(WIZ_PLACEMENTS, v); }, opts: WIZ_PLACEMENTS },
    ' ad.'
  ]);

  var usps = (p.usps || []).filter(Boolean);
  h += wizUitklap('product',
    '<div class="wiz-readout"><div class="wiz-readout-t">' + wizEsc(p.name) +
      (p.category ? ' · ' + wizEsc(p.category) : '') + '</div>' +
      (usps.length
        ? '<ul class="wiz-readout-list">' + usps.map(function (u) { return '<li>' + wizEsc(u) + '</li>'; }).join('') + '</ul>'
        : '<div class="wiz-readout-none">No USPs recorded for this product.</div>') +
      (p.price ? '<div class="wiz-readout-none">Price point: ' + wizEsc(p.price) + '</div>' : '') +
      '</div>' +
    '<div class="wiz-actions">' + wizHerzie('product') + '</div>',
    'See the product data');

  h += wizAlternatives('product');
  return h;
}

function wizPickProduct(id) {
  wizSet('product', 'productId', id, 'user');
  /* Ander product betekent een andere persona-set en andere USP's; de historie
     die bij de oude persona hoorde zegt hier niets meer. En Rory mag opnieuw
     kijken, want zijn vorige lezing ging over iets anders. */
  wizState.hist = null;
  wizState.advised.product = false;
  delete wizState.advice.product;
  wizState.openVeld = null;
  wizRender();
}

/* ── Stap 2: Doelgroep ──────────────────────────────────────────────────── */

function wizRender_audience() {
  var p = wizProduct();
  var alle = state.personas || [];
  var passend = alle.filter(function (x) { return !p || !x.category || x.category === p.category; });
  var lijst = passend.length ? passend : alle;
  var pers = wizPersona();
  var h = '';

  if (!lijst.length) {
    return '<div class="wiz-empty">No personas available. Add customer research in the Personas tab — without it Rory has nothing to build the angle on.</div>';
  }

  if (wizState.busy && !wizState.advice.audience) {
    h += wizDenkt('Rory is weighing the personas against this product and goal.');
  }

  h += wizZin('audience', [
    'This ad speaks to ',
    { field: 'personaId', titel: 'Persona', leeg: 'which persona',
      label: function () { return pers ? pers.name : ''; },
      opts: lijst.map(function (x) { return { value: x.id, label: x.name, hint: (x.description || '').slice(0, 70) }; }) },
    ', who is ',
    { field: 'awareness', titel: 'Awareness level', leeg: 'at which stage',
      label: function (v) { return (wizOptLabel(WIZ_AWARENESS, v) || '').toLowerCase(); }, opts: WIZ_AWARENESS },
    '.'
  ]);

  /* Het onderzoek waar het advies op rust. Dit is geen decoratie: de opdracht
     vraagt dat zichtbaar is welke informatie Rory gebruikt. */
  if (pers) {
    var blok = function (titel, arr) {
      var v = (arr || []).filter(Boolean);
      if (!v.length) return '';
      return '<div class="wiz-res-col"><div class="wiz-res-t">' + titel + '</div><ul>' +
        v.slice(0, 4).map(function (x) { return '<li>' + wizEsc(x) + '</li>'; }).join('') + '</ul></div>';
    };
    var kolommen = blok('Pains', pers.pains) + blok('Desires', pers.desires) + blok('Objections', pers.objections);
    if (kolommen) {
      h += wizUitklap('audience',
        '<div class="wiz-research">' + kolommen + '</div>' +
        wizField('audience', 'market', 'Market', 'only when this campaign runs somewhere specific') +
        '<div class="wiz-actions">' + wizHerzie('audience') + '</div>',
        'See the customer research');
    }
  }

  h += wizAlternatives('audience');
  return h;
}

function wizAfter_audience() {
  if (wizState.data.audience.personaId && !wizState.hist) {
    wizLoadHistory(function () { if (wizState.current === 'audience') wizRenderRory(); });
  }
}

/* ── Stap 3: Creatieve strategie ────────────────────────────────────────── */

function wizRender_strategy() {
  var s = wizState.data.strategy;
  var h = '';

  if (!s.marketingAngle) {
    return wizState.busy
      ? wizDenkt('Rory is building the argument from the research and what already ran.')
      : '<div class="wiz-empty">Rory has not built the strategy yet. ' +
        '<button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'strategy\')">Build it now</button></div>';
  }

  /* De strategie is geen rij velden maar een stelling met bewijs eronder. Zo
     lees je in één blik of het argument klopt, wat je van losse invoervakken
     nooit kunt zien. */
  h += '<div class="wiz-stelling">' +
    '<div class="wiz-stelling-kicker">' + wizEsc(s.angleType || 'The angle') + '</div>' +
    '<blockquote class="wiz-stelling-q">' + wizEsc(s.marketingAngle) + '</blockquote>' +
    (s.messaging ? '<p class="wiz-stelling-sub">' + wizEsc(s.messaging) + '</p>' : '') +
    '</div>';

  var kaart = function (label, waarde) {
    if (!waarde) return '';
    return '<div class="wiz-mini"><span class="wiz-mini-k">' + wizEsc(label) + '</span>' +
      '<span class="wiz-mini-v">' + wizEsc(waarde) + '</span></div>';
  };
  var minis = kaart('Desire', s.desire) + kaart('Pain', s.pain) +
              kaart('Proof', s.proof) + kaart('Objection', s.objection);
  if (minis) h += '<div class="wiz-minis">' + minis + '</div>';

  h += wizUitklap('strategy',
    wizField('strategy', 'angleType', 'Marketing angle type', 'the family this argument belongs to') +
    wizField('strategy', 'marketingAngle', 'Marketing angle', 'the argument in one sentence', true) +
    wizField('strategy', 'messaging', 'Core messaging', 'what the viewer should walk away with', true) +
    '<div class="wiz-two">' + wizField('strategy', 'desire', 'Primary desire') + wizField('strategy', 'pain', 'Primary pain point') + '</div>' +
    '<div class="wiz-two">' + wizField('strategy', 'proof', 'Proof mechanism') + wizField('strategy', 'objection', 'Main objection') + '</div>' +
    '<div class="wiz-actions">' + wizHerzie('strategy', 'Have Rory build a different angle') + '</div>',
    'Edit the strategy');

  h += wizAlternatives('strategy');
  return h;
}

/* ── Stap 4: Format ─────────────────────────────────────────────────────── */

function wizRender_format() {
  if (typeof AD_FORMATS === 'undefined') return '<div class="wiz-empty">Format data is not loaded.</div>';
  var adv = wizState.advice.format || {};
  var rec = adv.recommendation || {};
  var sel = wizState.data.format.formatId;
  var f = wizFormat();
  var alles = !!wizState.showAllFormats;
  var h = '';

  if (!sel && wizState.busy) return wizDenkt('Rory is narrowing 42 formats down to the ones that carry this angle.');

  if (f) {
    h += '<p class="wiz-zin">This becomes a <button type="button" class="wiz-woord" onclick="wizToggleAllFormats()">' +
      wizEsc(f.name) + '</button> ad.</p>';
    h += '<div class="wiz-formatkaart">' +
      '<div class="wiz-format-tags">' + (f.tags || []).map(function (t) { return '<em>' + wizEsc(t) + '</em>'; }).join('') + '</div>' +
      '<p class="wiz-format-desc">' + wizEsc(f.desc) + '</p></div>';
  }

  var aanbevolen = [rec.formatId].concat(rec.runnersUp || []).filter(Boolean);
  var tonen = alles ? AD_FORMATS : AD_FORMATS.filter(function (x) { return aanbevolen.indexOf(x.id) !== -1; });
  if (!alles && sel && !tonen.some(function (x) { return x.id === sel; })) {
    var eigen = AD_FORMATS.filter(function (x) { return x.id === sel; })[0];
    if (eigen) tonen = tonen.concat([eigen]);
  }

  if (tonen.length && (alles || !f || aanbevolen.length > 1)) {
    h += '<div class="wiz-block"><div class="wiz-block-t">' +
      (alles ? 'All 42 formats' : 'Rory\'s shortlist') + '</div>' +
      '<div class="wiz-formats">' + tonen.map(function (x) {
        var aan = (x.id === sel), tip = (x.id === rec.formatId);
        return '<button type="button" class="wiz-format' + (aan ? ' on' : '') + (tip ? ' rec' : '') + '" ' +
          'onclick="wizPick(\'format\',\'formatId\',\'' + wizEsc(x.id) + '\')">' +
          (tip ? '<span class="wiz-choice-rec">Rory</span>' : '') +
          '<span class="wiz-format-name">' + wizEsc(x.name) + '</span>' +
          '<span class="wiz-format-desc">' + wizEsc(x.desc) + '</span>' +
          '</button>';
      }).join('') + '</div></div>';
  }

  h += '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizToggleAllFormats()">' +
    (alles ? 'Back to the shortlist' : 'View all 42 formats') + '</button>' +
    wizHerzie('format') + '</div>';
  return h;
}

function wizToggleAllFormats() { wizState.showAllFormats = !wizState.showAllFormats; wizRender(); }

/* ── Stap 5: Visuele richting ───────────────────────────────────────────────
 *
 * Tien keuzes, maar niet tien blokken. De eerste vijf bepalen wat je ziet en
 * staan in de zin; de andere vijf zijn verfijning en zitten in de uitklap.
 * Dat onderscheid is niet willekeurig: compositie, mens, scene, kader en sfeer
 * veranderen het beeld, de rest verschuift details binnen dat beeld. */

var WIZ_VISUAL = [
  { field: 'composition', title: 'Composition', hoofd: true, opts: [
    { value: 'product-dominant', label: 'Product dominant' },
    { value: 'person-dominant', label: 'Person dominant' },
    { value: 'split', label: 'Split composition' },
    { value: 'editorial', label: 'Editorial' },
    { value: 'close-up', label: 'Close up' },
    { value: 'wide-scene', label: 'Wide scene' }
  ] },
  { field: 'humanPresence', title: 'Human presence', hoofd: true, opts: [
    { value: 'none', label: 'No person' },
    { value: 'hands', label: 'Hands only' },
    { value: 'male-model', label: 'Male model' },
    { value: 'founder', label: 'Founder' },
    { value: 'ugc-person', label: 'UGC style person' }
  ] },
  { field: 'scene', title: 'Scene', hoofd: true, opts: [
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'studio', label: 'Studio' },
    { value: 'lifestyle', label: 'Lifestyle environment' },
    { value: 'minimal-setup', label: 'Minimal product setup' },
    { value: 'custom', label: 'Custom environment' }
  ] },
  { field: 'framing', title: 'Camera framing', hoofd: true, opts: [
    { value: 'macro', label: 'Macro' },
    { value: 'close', label: 'Close' },
    { value: 'medium', label: 'Medium' },
    { value: 'wide', label: 'Wide' },
    { value: 'overhead', label: 'Overhead' }
  ] },
  { field: 'mood', title: 'Visual mood', hoofd: true, opts: [
    { value: 'premium', label: 'Premium' },
    { value: 'masculine', label: 'Masculine' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'editorial', label: 'Editorial' },
    { value: 'raw-ugc', label: 'Raw UGC' },
    { value: 'clinical', label: 'Clinical' }
  ] },
  { field: 'productVisibility', title: 'Product visibility', opts: [
    { value: 'hero', label: 'Hero, unmissable' },
    { value: 'clear', label: 'Clearly visible' },
    { value: 'in-context', label: 'In context, secondary' },
    { value: 'implied', label: 'Implied only' }
  ] },
  { field: 'background', title: 'Background', opts: [
    { value: 'clean', label: 'Clean / seamless' },
    { value: 'textured', label: 'Textured surface' },
    { value: 'real-room', label: 'Real room' },
    { value: 'dark', label: 'Dark, low key' },
    { value: 'bright', label: 'Bright, high key' }
  ] },
  { field: 'productUsage', title: 'Product usage', opts: [
    { value: 'not-in-use', label: 'Not in use' },
    { value: 'held', label: 'Held, ready' },
    { value: 'in-use', label: 'Actively in use' },
    { value: 'after', label: 'After the result' }
  ] },
  { field: 'textPlacement', title: 'Text placement', opts: [
    { value: 'top', label: 'Top' },
    { value: 'upper-left', label: 'Upper left' },
    { value: 'centre', label: 'Centre' },
    { value: 'bottom', label: 'Bottom' },
    { value: 'side-panel', label: 'Side panel' }
  ] },
  { field: 'referenceUsage', title: 'Reference image usage', opts: [
    { value: 'product', label: 'Product shots lead' },
    { value: 'lifestyle', label: 'Lifestyle shots lead' },
    { value: 'usage', label: 'Usage shots lead' },
    { value: 'both', label: 'Lifestyle and usage' }
  ] }
];

function wizVisualOptionsText() {
  return WIZ_VISUAL.map(function (g) {
    return g.field + ': ' + g.opts.map(function (o) { return o.value; }).join(', ');
  }).join('\n');
}

function wizVisueelDeel(g) {
  return { field: g.field, titel: g.title, leeg: g.title.toLowerCase(), opts: g.opts,
           label: function (v) { return (wizOptLabel(g.opts, v) || '').toLowerCase(); } };
}

function wizRender_visual() {
  var v = wizState.data.visual;
  if (!v.composition) {
    return wizState.busy
      ? wizDenkt('Rory is turning the strategy into a picture.')
      : '<div class="wiz-empty">Rory has not proposed a visual direction yet. ' +
        '<button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'visual\')">Propose one</button></div>';
  }

  var g = function (naam) { return WIZ_VISUAL.filter(function (x) { return x.field === naam; })[0]; };
  var h = wizZin('visual', [
    'A ', wizVisueelDeel(g('composition')),
    ' in a ', wizVisueelDeel(g('scene')),
    ', ', wizVisueelDeel(g('humanPresence')),
    ', shot ', wizVisueelDeel(g('framing')),
    ', in a ', wizVisueelDeel(g('mood')), ' mood.'
  ]);

  var rest = WIZ_VISUAL.filter(function (x) { return !x.hoofd; });
  h += wizUitklap('visual',
    rest.map(function (x) {
      return '<div class="wiz-block"><div class="wiz-block-t">' + wizEsc(x.title) + '</div>' +
        wizChoices('visual', x.field, x.opts, 3) + '</div>';
    }).join('') +
    '<div class="wiz-actions">' + wizHerzie('visual') + '</div>',
    'Refine five more details');

  var p = wizProduct();
  var bd = (p && typeof refBreakdown === 'function') ? refBreakdown(p.references) : null;
  if (bd && bd.usage > 0) {
    h += '<div class="wiz-note">' + bd.usage + ' usage photo' + (bd.usage > 1 ? 's are' : ' is') +
      ' on file. The generator follows them for how the product is held and applied, whatever is chosen here.</div>';
  }
  return h;
}

/* ── Stap 6: Copy ───────────────────────────────────────────────────────── */

function wizRender_copy() {
  var c = wizState.data.copy;
  if (!c.headline) {
    return wizState.busy
      ? wizDenkt('Rory is writing the copy in the brand\'s own language.')
      : '<div class="wiz-empty">Rory has not written the copy yet. ' +
        '<button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'copy\')">Write it</button></div>';
  }

  /* De copy staat er zoals hij op de advertentie komt, niet als invoervakken.
     Een headline beoordeel je op formaat en ritme, en dat zie je niet in een
     veld van één regel. Bewust niet vertaald: dit is advertentiecopy. */
  var h = '<div class="wiz-copyblad">' +
    '<div class="wiz-copy-headline">' + wizEsc(c.headline) + '</div>' +
    (c.supporting ? '<div class="wiz-copy-sub">' + wizEsc(c.supporting) + '</div>' : '') +
    (c.body ? '<div class="wiz-copy-body">' + wizEsc(c.body) + '</div>' : '') +
    (c.proof ? '<div class="wiz-copy-proof">' + wizEsc(c.proof) + '</div>' : '') +
    (c.cta ? '<div class="wiz-copy-cta">' + wizEsc(c.cta) + '</div>' : '') +
    '</div>';

  h += wizUitklap('copy',
    wizField('copy', 'headline', 'Headline', 'the one line that has to land', true) +
    wizField('copy', 'supporting', 'Supporting line') +
    wizField('copy', 'proof', 'Proof copy', 'the claim that makes it believable') +
    wizField('copy', 'body', 'Body copy', 'only when the format carries it', 3) +
    wizField('copy', 'cta', 'Call to action') +
    '<div class="wiz-actions">' + wizHerzie('copy', 'Have Rory write it differently') + '</div>',
    'Edit the copy');

  h += wizAlternatives('copy');
  return h;
}

window.wizRender_product = wizRender_product; window.wizRender_audience = wizRender_audience;
window.wizRender_strategy = wizRender_strategy; window.wizRender_format = wizRender_format;
window.wizRender_visual = wizRender_visual; window.wizRender_copy = wizRender_copy;
window.wizAfter_audience = wizAfter_audience;
window.wizPick = wizPick; window.wizPickProduct = wizPickProduct;
window.wizFieldSave = wizFieldSave; window.wizAskFor = wizAskFor;
window.wizToggleAllFormats = wizToggleAllFormats; window.wizTakeAlternative = wizTakeAlternative;
window.wizVisualOptionsText = wizVisualOptionsText; window.WIZ_VISUAL = WIZ_VISUAL;
window.WIZ_AWARENESS = WIZ_AWARENESS; window.WIZ_FUNNELS = WIZ_FUNNELS; window.WIZ_PLACEMENTS = WIZ_PLACEMENTS;
window.wizOpenVeld = wizOpenVeld; window.wizToggleUitklap = wizToggleUitklap;
window.wizZin = wizZin; window.wizDenkt = wizDenkt; window.wizUitklap = wizUitklap;
window.wizOptLabel = wizOptLabel; window.wizChoices = wizChoices; window.wizField = wizField;
