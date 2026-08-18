/* Static Ad Wizard — stap 1 tot en met 6.
 *
 * Elke stap is een functie wizRender_<key> die HTML teruggeeft, plus optioneel
 * wizAfter_<key> die na het invoegen draait (voor het ophalen van advies).
 * De romp in 38-wizard-core.js roept ze aan; ze weten niets van elkaar.
 *
 * Uitgangspunt van de vormgeving: geen leeg formulier. Elke stap opent met
 * Rory's voorstel en de keuzes eromheen. Wie het er niet mee eens is klikt iets
 * anders aan; dat telt dan als een handmatige keuze en blijft daarna staan.
 *
 * Alle interface-tekst is Engels. Wat uit productdata, persona's of onderzoek
 * komt tonen we zoals het is — daar zit Nederlands tussen en dat hoort zo.
 */

/* ── Herbruikbare bouwstenen ────────────────────────────────────────────── */

/* Een rij keuzekaarten. `opts` is [{value,label,hint}]. */
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
  wizRender();
}

/* Een tekstveld dat bij verlaten opslaat. Bewust op blur en niet op elke
   toetsaanslag: anders hertekent de wizard onder je handen vandaan. */
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

/* De knop die Rory op een stap laat kijken. */
function wizAdviseButton(stepKey, label) {
  return '<button type="button" class="wiz-btn advise" onclick="wizAskFor(\'' + stepKey + '\')"' +
    (wizState.busy ? ' disabled' : '') + '>' + wizEsc(label || 'Ask Rory to recommend') + '</button>';
}

function wizAskFor(stepKey) {
  wizAdvise(stepKey).then(function (adv) {
    if (adv && !adv.error) wizApplyAdvice(stepKey);
    wizRender();
  });
}

/* Alternatieven van Rory als aanklikbare kaarten. */
function wizAlternatives(stepKey) {
  var adv = wizState.advice[stepKey];
  if (!adv || !adv.alternatives || !adv.alternatives.length) return '';
  return '<div class="wiz-alts"><div class="wiz-alts-title">Other directions Rory considered</div>' +
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
  /* Bewust een handmatige keuze: de gebruiker koos het alternatief, dus het is
     geen advies meer en mag niet stilletjes teruggedraaid worden. */
  Object.keys(alt.values).forEach(function (f) {
    if (f in (wizState.data[stepKey] || {})) wizSet(stepKey, f, String(alt.values[f]), 'user');
  });
  wizRender();
}

/* ── Stap 1: Product en plaatsing ───────────────────────────────────────── */

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

function wizRender_product() {
  var prods = state.products || [];
  if (!prods.length) {
    return '<div class="wiz-empty">No products yet. Add one in the Products tab first — the wizard builds everything on that data.</div>';
  }
  var sel = wizState.data.product.productId;
  var h = '';
  h += '<div class="wiz-field"><label for="wiz-product-select">Product</label>' +
    '<select id="wiz-product-select" onchange="wizPickProduct(this.value)">' +
    '<option value="">Choose a product…</option>' +
    prods.map(function (p) {
      return '<option value="' + wizEsc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + wizEsc(p.name) + '</option>';
    }).join('') + '</select></div>';

  var p = wizProduct();
  if (p) {
    var usps = (p.usps || []).filter(Boolean);
    h += '<div class="wiz-readout"><div class="wiz-readout-t">' + wizEsc(p.name) + (p.category ? ' · ' + wizEsc(p.category) : '') + '</div>' +
      (usps.length ? '<ul class="wiz-readout-list">' + usps.slice(0, 5).map(function (u) { return '<li>' + wizEsc(u) + '</li>'; }).join('') + '</ul>' : '<div class="wiz-readout-none">No USPs recorded for this product.</div>') +
      '</div>';
  }

  h += '<div class="wiz-block"><div class="wiz-block-t">Campaign goal</div>' + wizChoices('product', 'funnel', WIZ_FUNNELS, 2) + '</div>';
  h += '<div class="wiz-block"><div class="wiz-block-t">Placement</div>' + wizChoices('product', 'placement', WIZ_PLACEMENTS, 2) + '</div>';
  h += '<div class="wiz-actions">' + wizAdviseButton('product', 'Ask Rory to read this product') + '</div>';
  h += wizAlternatives('product');
  return h;
}

function wizPickProduct(id) {
  wizSet('product', 'productId', id, 'user');
  /* Nieuw product betekent een andere persona-set en andere USP's; de historie
     die bij de oude persona hoorde zegt hier niets meer. */
  wizState.hist = null;
  wizRender();
}

/* ── Stap 2: Doelgroep ──────────────────────────────────────────────────── */

var WIZ_AWARENESS = [
  { value: 'unaware', label: 'Unaware', hint: 'Does not know the problem yet' },
  { value: 'problem', label: 'Problem aware', hint: 'Feels the pain, knows no solution' },
  { value: 'solution', label: 'Solution aware', hint: 'Knows solution types, not the brand' },
  { value: 'product', label: 'Product aware', hint: 'Knows the brand, not convinced' },
  { value: 'most', label: 'Most aware', hint: 'Ready, waiting for a reason' }
];

function wizRender_audience() {
  var p = wizProduct();
  var alle = state.personas || [];
  var passend = alle.filter(function (x) { return !p || !x.category || x.category === p.category; });
  var lijst = passend.length ? passend : alle;
  var sel = wizState.data.audience.personaId;
  var tip = ((wizState.advice.audience || {}).recommendation || {}).personaId;

  var h = '';
  if (!lijst.length) {
    h += '<div class="wiz-empty">No personas available. You can continue, but Rory will have no customer research to lean on.</div>';
  } else {
    h += '<div class="wiz-block"><div class="wiz-block-t">Persona</div><div class="wiz-personas">' +
      lijst.map(function (x) {
        var aan = (x.id === sel), rec = (x.id === tip);
        return '<button type="button" class="wiz-persona' + (aan ? ' on' : '') + (rec ? ' rec' : '') + '" ' +
          'onclick="wizPick(\'audience\',\'personaId\',\'' + wizEsc(x.id) + '\')">' +
          (rec ? '<span class="wiz-choice-rec">Rory</span>' : '') +
          '<span class="wiz-persona-name">' + wizEsc(x.name) + '</span>' +
          '<span class="wiz-persona-desc">' + wizEsc(x.description || '') + '</span>' +
          '</button>';
      }).join('') + '</div></div>';
  }

  var pers = wizPersona();
  if (pers) {
    var blok = function (titel, arr) {
      var v = (arr || []).filter(Boolean);
      if (!v.length) return '';
      return '<div class="wiz-res-col"><div class="wiz-res-t">' + titel + '</div><ul>' +
        v.slice(0, 4).map(function (x) { return '<li>' + wizEsc(x) + '</li>'; }).join('') + '</ul></div>';
    };
    var kolommen = blok('Pains', pers.pains) + blok('Desires', pers.desires) + blok('Objections', pers.objections);
    if (kolommen) h += '<div class="wiz-research">' + kolommen + '</div>';
  }

  h += '<div class="wiz-block"><div class="wiz-block-t">Awareness level</div>' + wizChoices('audience', 'awareness', WIZ_AWARENESS) + '</div>';
  h += wizField('audience', 'market', 'Market', 'optional, only when this campaign runs somewhere specific');
  h += '<div class="wiz-actions">' + wizAdviseButton('audience', 'Ask Rory to pick the audience') + '</div>';
  h += wizAlternatives('audience');
  return h;
}

/* De testhistorie hangt aan de persona, dus die halen we op zodra er een
   persona staat en we hem nog niet hebben. */
function wizAfter_audience() {
  if (wizState.data.audience.personaId && !wizState.hist) {
    wizLoadHistory(function () { if (wizState.current === 'audience') wizRenderRory(); });
  }
}

/* ── Stap 3: Creatieve strategie ────────────────────────────────────────── */

function wizRender_strategy() {
  var h = '';
  var s = wizState.data.strategy;
  if (!s.marketingAngle && !wizState.busy) {
    h += '<div class="wiz-prompt-card">' +
      '<p>Rory builds the strategic foundation from the product, the persona and everything already tested. ' +
      'You do not have to fill this in yourself — read his proposal and push back where you disagree.</p>' +
      wizAdviseButton('strategy', 'Build the strategy') + '</div>';
  }
  h += wizField('strategy', 'angleType', 'Marketing angle type', 'the family this argument belongs to');
  h += wizField('strategy', 'marketingAngle', 'Marketing angle', 'the argument in one sentence', true);
  h += wizField('strategy', 'messaging', 'Core messaging', 'what the viewer should walk away with', true);
  h += '<div class="wiz-two">' + wizField('strategy', 'desire', 'Primary desire') + wizField('strategy', 'pain', 'Primary pain point') + '</div>';
  h += '<div class="wiz-two">' + wizField('strategy', 'proof', 'Proof mechanism') + wizField('strategy', 'objection', 'Main objection', 'when relevant') + '</div>';
  if (s.marketingAngle) h += '<div class="wiz-actions">' + wizAdviseButton('strategy', 'Rebuild the strategy') + '</div>';
  h += wizAlternatives('strategy');
  return h;
}

/* ── Stap 4: Format ─────────────────────────────────────────────────────── */

function wizRender_format() {
  if (typeof AD_FORMATS === 'undefined') return '<div class="wiz-empty">Format data is not loaded.</div>';
  var adv = wizState.advice.format || {};
  var rec = adv.recommendation || {};
  var aanbevolen = [rec.formatId].concat(rec.runnersUp || []).filter(Boolean);
  var sel = wizState.data.format.formatId;
  var alles = !!wizState.showAllFormats;
  var h = '';

  if (!aanbevolen.length && !alles && !wizState.busy) {
    h += '<div class="wiz-prompt-card"><p>Rory narrows 42 formats down to the three that execute this angle. ' +
      'You can always open the full list.</p>' + wizAdviseButton('format', 'Recommend formats') + '</div>';
  }

  var tonen = alles
    ? AD_FORMATS
    : AD_FORMATS.filter(function (f) { return aanbevolen.indexOf(f.id) !== -1; });
  /* Staat de eigen keuze niet in de aanbevelingen, dan hoort hij er alsnog bij:
     anders verdwijnt een bewust gekozen format uit beeld zodra Rory opnieuw
     kijkt, en lijkt het alsof het weg is. */
  if (!alles && sel && !tonen.some(function (f) { return f.id === sel; })) {
    var eigen = AD_FORMATS.find(function (f) { return f.id === sel; });
    if (eigen) tonen = tonen.concat([eigen]);
  }

  if (tonen.length) {
    h += '<div class="wiz-formats">' + tonen.map(function (f) {
      var aan = (f.id === sel), tip = (f.id === rec.formatId);
      return '<button type="button" class="wiz-format' + (aan ? ' on' : '') + (tip ? ' rec' : '') + '" ' +
        'onclick="wizPick(\'format\',\'formatId\',\'' + wizEsc(f.id) + '\')">' +
        (tip ? '<span class="wiz-choice-rec">Rory</span>' : '') +
        '<span class="wiz-format-name">' + wizEsc(f.name) + '</span>' +
        '<span class="wiz-format-tags">' + (f.tags || []).map(function (t) { return '<em>' + wizEsc(t) + '</em>'; }).join('') + '</span>' +
        '<span class="wiz-format-desc">' + wizEsc(f.desc) + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  h += '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn ghost" onclick="wizToggleAllFormats()">' +
    (alles ? 'Show only recommended' : 'View all formats') + '</button>' +
    (aanbevolen.length ? wizAdviseButton('format', 'Recommend again') : '') +
    '</div>';
  return h;
}

function wizToggleAllFormats() { wizState.showAllFormats = !wizState.showAllFormats; wizRender(); }

/* ── Stap 5: Visuele richting ───────────────────────────────────────────── */

var WIZ_VISUAL = [
  { field: 'composition', title: 'Composition', opts: [
    { value: 'product-dominant', label: 'Product dominant' },
    { value: 'person-dominant', label: 'Person dominant' },
    { value: 'split', label: 'Split composition' },
    { value: 'editorial', label: 'Editorial' },
    { value: 'close-up', label: 'Close up' },
    { value: 'wide-scene', label: 'Wide scene' }
  ] },
  { field: 'humanPresence', title: 'Human presence', opts: [
    { value: 'none', label: 'No person' },
    { value: 'hands', label: 'Hands only' },
    { value: 'male-model', label: 'Male model' },
    { value: 'founder', label: 'Founder' },
    { value: 'ugc-person', label: 'UGC style person' }
  ] },
  { field: 'scene', title: 'Scene', opts: [
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'studio', label: 'Studio' },
    { value: 'lifestyle', label: 'Lifestyle environment' },
    { value: 'minimal-setup', label: 'Minimal product setup' },
    { value: 'custom', label: 'Custom environment' }
  ] },
  { field: 'framing', title: 'Camera framing', opts: [
    { value: 'macro', label: 'Macro' },
    { value: 'close', label: 'Close' },
    { value: 'medium', label: 'Medium' },
    { value: 'wide', label: 'Wide' },
    { value: 'overhead', label: 'Overhead' }
  ] },
  { field: 'mood', title: 'Visual mood', opts: [
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

/* De optielijst als tekst, zodat Rory alleen bestaande waardes kan teruggeven.
   Zonder dit verzint een model zijn eigen labels en klikt er niets aan. */
function wizVisualOptionsText() {
  return WIZ_VISUAL.map(function (g) {
    return g.field + ': ' + g.opts.map(function (o) { return o.value; }).join(', ');
  }).join('\n');
}

function wizRender_visual() {
  var h = '';
  if (!wizState.data.visual.composition && !wizState.busy) {
    h += '<div class="wiz-prompt-card"><p>This is where the ad stops being a strategy and starts being a picture. ' +
      'Rory proposes a direction that fits the format and the angle; every choice stays yours to change.</p>' +
      wizAdviseButton('visual', 'Propose a visual direction') + '</div>';
  }
  h += WIZ_VISUAL.map(function (g) {
    return '<div class="wiz-block"><div class="wiz-block-t">' + wizEsc(g.title) + '</div>' +
      wizChoices('visual', g.field, g.opts, 3) + '</div>';
  }).join('');
  var p = wizProduct();
  var bd = (p && typeof refBreakdown === 'function') ? refBreakdown(p.references) : null;
  if (bd && bd.usage > 0) {
    h += '<div class="wiz-note">' + bd.usage + ' usage photo' + (bd.usage > 1 ? 's are' : ' is') +
      ' on file for this product. The generator will follow them for how the product is held and applied, ' +
      'whatever is chosen above.</div>';
  }
  if (wizState.data.visual.composition) h += '<div class="wiz-actions">' + wizAdviseButton('visual', 'Rethink the visual direction') + '</div>';
  return h;
}

/* ── Stap 6: Copy ───────────────────────────────────────────────────────── */

function wizRender_copy() {
  var h = '';
  var c = wizState.data.copy;
  var f = wizFormat();
  if (!c.headline && !wizState.busy) {
    h += '<div class="wiz-prompt-card"><p>Everything the copy needs is decided: the angle, the format and the visual. ' +
      'Rory writes it in the brand\'s own language, carrying the approved angle.</p>' +
      wizAdviseButton('copy', 'Write the copy') + '</div>';
  }
  h += wizField('copy', 'headline', 'Headline', 'the one line that has to land', true);
  h += wizField('copy', 'supporting', 'Supporting line', 'optional');
  if (!f || f.proof !== false) h += wizField('copy', 'proof', 'Proof copy', 'the claim that makes it believable');
  h += wizField('copy', 'body', 'Body copy', 'only when the format carries it', 3);
  h += wizField('copy', 'cta', 'Call to action');
  if (c.headline) h += '<div class="wiz-actions">' + wizAdviseButton('copy', 'Write alternatives') + '</div>';
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
