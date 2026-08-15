/* Static Ad Wizard — stap 7, 8 en 9.
 *
 * Hier gaan de losse besluiten naar een prompt, drie concepten en uiteindelijk
 * één static. Bewust in die volgorde: de blueprint is de laatste plek waar
 * corrigeren gratis is, daarna kost elke stap een generatie.
 *
 * Belangrijk voor het begrijpen van dit bestand: de wizard bouwt GEEN eigen
 * beeldpijplijn. Hij zet de gestructureerde besluiten om in dezelfde
 * variations-vorm die het systeem al gebruikt en geeft die door aan
 * renderResults en generateImage. Alles wat daar al goed geregeld is —
 * safe zones, referentiefoto's, merk-anatomie, het bewerkpaneel — blijft
 * daardoor werken zonder dat het hier herhaald wordt.
 */

/* ── De blueprint als tekst ─────────────────────────────────────────────── */

var WIZ_LABELS = {
  funnel: { tof: 'Cold reach', mof: 'Consideration', bof: 'Conversion', retargeting: 'Retargeting' },
  placement: { feed11: 'Feed 1:1', feed45: 'Feed 4:5', stories: 'Stories 9:16', reels: 'Reels 9:16' },
  awareness: { unaware: 'Unaware', problem: 'Problem aware', solution: 'Solution aware', product: 'Product aware', most: 'Most aware' }
};

function wizLabel(soort, waarde) {
  var m = WIZ_LABELS[soort];
  return (m && m[waarde]) || waarde || '';
}

/* Leesbare naam van een visuele keuze, zodat de blueprint geen slugs toont. */
function wizVisualLabel(field, value) {
  var g = (typeof WIZ_VISUAL !== 'undefined') ? WIZ_VISUAL.find(function (x) { return x.field === field; }) : null;
  if (!g) return value || '';
  var o = g.opts.find(function (x) { return x.value === value; });
  return o ? o.label : (value || '');
}

/* ── Stap 7: Creative blueprint ─────────────────────────────────────────── */

function wizRender_review() {
  var d = wizState.data;
  var p = wizProduct(), pers = wizPersona(), f = wizFormat();

  var rij = function (label, waarde, stap) {
    return '<div class="wiz-bp-row">' +
      '<div class="wiz-bp-k">' + wizEsc(label) + '</div>' +
      '<div class="wiz-bp-v">' + (waarde ? wizEsc(waarde) : '<em class="wiz-bp-empty">not set</em>') + '</div>' +
      '<button type="button" class="wiz-bp-edit" onclick="wizGo(\'' + stap + '\')">Edit</button>' +
      '</div>';
  };

  var visueel = (typeof WIZ_VISUAL !== 'undefined' ? WIZ_VISUAL : [])
    .map(function (g) { return d.visual[g.field] ? (g.title + ': ' + wizVisualLabel(g.field, d.visual[g.field])) : null; })
    .filter(Boolean).join(' · ');

  var h = '<div class="wiz-bp">';
  h += rij('Product', p ? p.name : '', 'product');
  h += rij('Placement', wizLabel('placement', d.product.placement), 'product');
  h += rij('Campaign goal', wizLabel('funnel', d.product.funnel), 'product');
  h += rij('Audience', pers ? pers.name : '', 'audience');
  h += rij('Awareness', wizLabel('awareness', d.audience.awareness), 'audience');
  h += rij('Marketing angle', d.strategy.marketingAngle, 'strategy');
  h += rij('Core messaging', d.strategy.messaging, 'strategy');
  h += rij('Proof mechanism', d.strategy.proof, 'strategy');
  h += rij('Format', f ? f.name : d.format.formatId, 'format');
  h += rij('Visual direction', visueel, 'visual');
  h += rij('Headline', d.copy.headline, 'copy');
  h += rij('Proof copy', d.copy.proof, 'copy');
  h += rij('Call to action', d.copy.cta, 'copy');
  h += '</div>';

  h += '<div class="wiz-block"><div class="wiz-block-t">What will be generated</div>';
  if (d.review.visualDescription) {
    h += '<div class="wiz-vizdesc">' + wizEsc(d.review.visualDescription) + '</div>' +
      '<div class="wiz-actions"><button type="button" class="wiz-btn ghost" onclick="wizDescribeVisual()">Describe again</button></div>';
  } else {
    h += '<div class="wiz-prompt-card"><p>Before you spend a generation, Rory writes out in plain language what the ad will look like.</p>' +
      '<button type="button" class="wiz-btn advise" onclick="wizDescribeVisual()"' + (wizState.busy ? ' disabled' : '') + '>Describe the ad</button></div>';
  }
  h += '</div>';

  var ontbreekt = wizBlueprintGaps();
  if (ontbreekt.length) {
    h += '<div class="wiz-warn">Still empty: ' + wizEsc(ontbreekt.join(', ')) +
      '. You can continue, but the generator will fill those gaps on its own.</div>';
  }

  h += '<div class="wiz-actions big">' +
    '<button type="button" class="wiz-btn primary" onclick="wizApproveBlueprint()"' + (wizState.busy ? ' disabled' : '') + '>' +
    'Approve and generate 3 concepts</button></div>';
  return h;
}

/* Welke velden leeg zijn gebleven. Eerlijk benoemen is beter dan ze stilletjes
   door het model laten invullen zonder dat iemand het weet. */
function wizBlueprintGaps() {
  var d = wizState.data, gaten = [];
  if (!d.strategy.proof) gaten.push('proof mechanism');
  if (!d.strategy.objection) gaten.push('main objection');
  if (!d.copy.supporting) gaten.push('supporting line');
  if (!d.copy.proof) gaten.push('proof copy');
  return gaten;
}

function wizDescribeVisual() {
  if (wizState.busy) return;
  wizState.busy = true;
  wizRender();
  var ctx = wizContext();
  var sys = 'You are Rory Sutherland. Describe, in two or three plain English sentences, what the static ad that follows from these decisions will actually look like: ' +
    'the scene, who is in it, how the product sits in frame, the framing and lighting, and where the headline goes. ' +
    'Describe the picture, not the strategy. No marketing adjectives. Answer with strict JSON: {"description":"..."}';
  wizCall(sys, [{ role: 'user', content: ctx.text }], 600)
    .then(function (data) {
      var obj = wizParseJson(wizTextOf(data));
      wizState.data.review.visualDescription = obj.description || '';
      wizState.source['review.visualDescription'] = 'rory';
      wizSave();
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Could not describe the ad: ' + err.message, true);
    })
    .finally(function () { wizState.busy = false; wizRender(); });
}

function wizApproveBlueprint() {
  wizState.done.review = true;
  wizSave();
  wizGo('concepts');
  wizGenerateConcepts();
}

/* ── De prompt uit de besluiten ─────────────────────────────────────────── */

/* Dit is het scharnierpunt van de hele wizard: gestructureerde besluiten in,
   één prompt uit. Geen enkele stap schrijft rechtstreeks in een promptveld,
   zodat dezelfde besluiten later ook naar performance-data of learnings
   kunnen — dat bouwen we hier nog niet, maar de vorm staat het toe. */
function wizBuildBrief(aantal) {
  var d = wizState.data, p = wizProduct(), pers = wizPersona(), f = wizFormat();
  var t = '';

  t += 'Generate ' + aantal + ' variation' + (aantal > 1 ? 's' : '') + ' for the following approved brief.\n\n';
  t += 'PRIMAIR PRODUCT: ' + (p ? p.name : '') + (p && p.category ? (' (' + p.category + ')') : '') + '\n';
  if (p) {
    var usps = (p.usps || []).filter(Boolean);
    if (usps.length) t += 'USPs:\n' + usps.map(function (u) { return ' - ' + u; }).join('\n') + '\n';
    if (p.target) t += 'Doelgroep: ' + p.target + '\n';
    if (p.price) t += 'Prijspunt: ' + p.price + '\n';
    if (p.appearance) t += 'Uiterlijk-fallback: ' + p.appearance + '\n';
    if (p.forbidden) t += 'Verboden claims: ' + p.forbidden + '\n';
    var bd = (typeof refBreakdown === 'function') ? refBreakdown(p.references) : null;
    if (bd && bd.usage > 0) {
      t += "GEBRUIKSFOTO'S aanwezig: het product MOET in image_prompt_en op exact dezelfde, correcte manier " +
        'worden vastgehouden en toegepast als op die foto\'s. Verzin nooit een onmogelijke toepassing.\n';
    }
  }

  t += '\nFUNNEL-FASE: ' + wizLabel('funnel', d.product.funnel) + ' (' + d.product.funnel + ')\n';
  t += 'PLAATSING: ' + wizLabel('placement', d.product.placement) + '\n';
  t += 'CUSTOMER AWARENESS: ' + wizLabel('awareness', d.audience.awareness) + '\n';
  if (d.audience.market) t += 'MARKT: ' + d.audience.market + '\n';

  if (pers) {
    t += '\nCUSTOMER PERSONA: ' + pers.name + '\n';
    if (pers.description) t += 'Beschrijving: ' + pers.description + '\n';
    if (pers.pains && pers.pains.length) t += 'Pijnpunten: ' + pers.pains.filter(Boolean).join(' , ') + '\n';
    if (pers.desires && pers.desires.length) t += 'Wensen: ' + pers.desires.filter(Boolean).join(' , ') + '\n';
    if (pers.objections && pers.objections.length) t += 'Bezwaren: ' + pers.objections.filter(Boolean).join(' , ') + '\n';
  }

  t += '\n## GOEDGEKEURDE STRATEGIE (VASTGEZET, GELDT VOOR ELKE VARIATIE)\n';
  if (d.strategy.angleType) t += 'Angle-type: ' + d.strategy.angleType + '\n';
  t += 'Marketing-angle: ' + d.strategy.marketingAngle + '\n';
  t += 'Kernboodschap: ' + d.strategy.messaging + '\n';
  if (d.strategy.desire) t += 'Primaire wens: ' + d.strategy.desire + '\n';
  if (d.strategy.pain) t += 'Primaire pijn: ' + d.strategy.pain + '\n';
  if (d.strategy.proof) t += 'Bewijsmechanisme: ' + d.strategy.proof + '\n';
  if (d.strategy.objection) t += 'Weg te nemen bezwaar: ' + d.strategy.objection + '\n';

  if (f) t += '\nFORMAT-MODE: ' + ((typeof AD_FORMAT_DIRECTIVE !== 'undefined' && AD_FORMAT_DIRECTIVE[f.id]) || (f.name + ' — ' + f.desc)) + '\n';

  t += '\n## VISUELE RICHTING (HARDE DRIVER voor image_prompt_en)\n';
  (typeof WIZ_VISUAL !== 'undefined' ? WIZ_VISUAL : []).forEach(function (g) {
    var v = d.visual[g.field];
    if (v) t += '- ' + g.title + ': ' + wizVisualLabel(g.field, v) + '\n';
  });
  if (d.review.visualDescription) t += 'In gewone taal: ' + d.review.visualDescription + '\n';
  t += 'Deze visuele richting is door de gebruiker goedgekeurd en gaat VOOR op de standaardlook van het format. ' +
    'Wijk er niet van af voor de afwisseling.\n';

  t += '\n## GOEDGEKEURDE COPY\n';
  t += 'Headline: ' + d.copy.headline + '\n';
  if (d.copy.supporting) t += 'Ondersteunende regel: ' + d.copy.supporting + '\n';
  if (d.copy.body) t += 'Body: ' + d.copy.body + '\n';
  if (d.copy.proof) t += 'Bewijs-copy: ' + d.copy.proof + '\n';
  if (d.copy.cta) t += 'CTA: ' + d.copy.cta + '\n';

  if (aantal > 1) {
    t += '\n## WAT MAG VARIEREN EN WAT NIET\n' +
      'Alle ' + aantal + ' varianten dragen DEZELFDE persona, awareness, marketing-angle en kernboodschap. ' +
      'Die zijn goedgekeurd en staan vast. Varieer alleen de uitvoering: compositie, kadrering, moment, ' +
      'formulering van de headline en de layout. Een variant die van hoek of doelgroep wisselt is fout.\n';
  } else {
    t += '\nLever exact deze uitvoering, zonder de goedgekeurde copy of hoek te herschrijven.\n';
  }

  t += '\nOutput: alleen het JSON-object.';
  return t;
}

/* De metadata die renderResults en generateImage verwachten. Zelfde vorm als
   generate() in 10-kopieermodus.js oplevert — zo werkt de rest ongewijzigd. */
function wizMetadata() {
  var d = wizState.data, p = wizProduct(), pers = wizPersona();
  return {
    product: p ? p.name : '',
    productId: p ? p.id : null,
    funnel: d.product.funnel,
    archetype: 'mix',
    placement: d.product.placement,
    concept: d.strategy.marketingAngle,
    offer: '',
    mode: d.format.formatId || 'auto',
    sophistication: null,
    awareness: d.audience.awareness || null,
    timestamp: Date.now(),
    bundleProductIds: [],
    personaId: pers ? pers.id : null,
    personaName: pers ? pers.name : null,
    wizardBrief: JSON.parse(JSON.stringify(d))
  };
}

/* ── Stap 8: Concepten ──────────────────────────────────────────────────── */

var WIZ_CONCEPT_COUNT = 3;

function wizRender_concepts() {
  var lijst = wizState.data.concepts.list || [];
  if (wizState.busy && !lijst.length) {
    return '<div class="wiz-loading">Rory is working out ' + WIZ_CONCEPT_COUNT + ' routes within the approved strategy…</div>';
  }
  if (!lijst.length) {
    return '<div class="wiz-prompt-card"><p>No concepts yet.</p>' +
      '<button type="button" class="wiz-btn advise" onclick="wizGenerateConcepts()">Generate concepts</button></div>';
  }
  var sel = wizState.data.concepts.selected;
  var h = '<div class="wiz-concepts">' + lijst.map(function (c, i) {
    var aan = (sel === i);
    return '<div class="wiz-concept' + (aan ? ' on' : '') + '">' +
      '<div class="wiz-concept-preview" id="gen-image-' + i + '">' +
      '<button type="button" class="wiz-btn small" onclick="wizPreview(' + i + ')">Generate preview</button>' +
      '</div>' +
      '<div class="wiz-concept-body">' +
      '<div class="wiz-concept-h">' + wizEsc(c.headline_nl || '') + '</div>' +
      (c.hook_label_nl ? '<div class="wiz-concept-hook">' + wizEsc(c.hook_label_nl) + '</div>' : '') +
      (c.visual_nl ? '<div class="wiz-concept-vis"><span>Composition</span>' + wizEsc(c.visual_nl) + '</div>' : '') +
      (c.reasoning_nl ? '<div class="wiz-concept-why"><span>Rory</span>' + wizEsc(c.reasoning_nl) + '</div>' : '') +
      '<button type="button" class="wiz-btn ' + (aan ? 'primary' : 'ghost') + ' full" onclick="wizPickConcept(' + i + ')">' +
      (aan ? 'Selected' : 'Choose this concept') + '</button>' +
      '</div></div>';
  }).join('') + '</div>';
  h += '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn ghost" onclick="wizGenerateConcepts()"' + (wizState.busy ? ' disabled' : '') + '>Generate different concepts</button>' +
    '<button type="button" class="wiz-btn ghost" onclick="wizPreviewAll()"' + (wizState.busy ? ' disabled' : '') + '>Generate all previews</button>' +
    '</div>';
  return h;
}

function wizGenerateConcepts() {
  if (wizState.busy) return;
  var sleutel = (window.__WG_TEAMSERVER ? 'teamserver' : (document.getElementById('anthropic-key') || {}).value);
  if (!sleutel) { if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true); return; }
  wizState.busy = true;
  wizState.data.concepts.list = [];
  wizState.data.concepts.selected = null;
  wizRender();

  /* De resultatenlijst op de hoofdpagina leegmaken: die gebruikt dezelfde
     gen-image-ids als de conceptkaarten hier, en twee elementen met hetzelfde
     id betekent dat het beeld in de verkeerde landt. */
  wizClearMainResults();

  wizCall(SYSTEM_PROMPT, [{ role: 'user', content: wizBuildBrief(WIZ_CONCEPT_COUNT) }], 8000)
    .then(function (data) {
      var parsed = wizParseJson(wizTextOf(data));
      var vars = parsed.variations || [];
      if (!vars.length) throw new Error('no variations came back');
      wizState.data.concepts.list = vars;
      state.lastGenerated = { variations: vars, metadata: wizMetadata() };
      state.generatedImages = {};
      wizSave();
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Concepts failed: ' + err.message, true);
    })
    .finally(function () { wizState.busy = false; wizRender(); });
}

function wizClearMainResults() {
  var el = document.getElementById('results');
  if (el) el.innerHTML = '';
}

function wizPickConcept(i) {
  wizState.data.concepts.selected = i;
  wizState.source['concepts.selected'] = 'user';
  wizSave();
  wizRender();
}

/* Preview via de bestaande beeldpijplijn. generateImage schrijft in
   #gen-image-<i>, en die staat hier op de conceptkaart. */
function wizPreview(i) {
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Generate the concepts first', true); return; }
  if (typeof generateImage !== 'function') return;
  generateImage(i);
}

function wizPreviewAll() {
  var n = (wizState.data.concepts.list || []).length;
  for (var i = 0; i < n; i++) wizPreview(i);
}

/* ── Stap 9: De uiteindelijke static ────────────────────────────────────── */

/* De gerichte acties na generatie. Elke actie verandert één element en laat de
   rest staan; ze gaan naar het bestaande bewerkpaneel in plaats van de hele
   strategie opnieuw op te bouwen. */
var WIZ_TWEAKS = [
  { key: 'headline',    label: 'Change headline',      instructie: 'Replace only the headline text. Keep the composition, product, scene, lighting and every other element exactly as they are.' },
  { key: 'composition', label: 'Change composition',   instructie: 'Rearrange the composition and framing. Keep the same product, scene, headline text and mood.' },
  { key: 'scene',       label: 'Change scene',         instructie: 'Move this to a different scene or environment. Keep the product, the headline text, the framing and the mood.' },
  { key: 'model',       label: 'Change model',         instructie: 'Change the person in frame. Keep the product, scene, composition, headline text and mood.' },
  { key: 'position',    label: 'Change product position', instructie: 'Move the product to a different position in frame. Change nothing else.' },
  { key: 'background',  label: 'Change background',    instructie: 'Replace only the background. Keep the product, any person, the framing and all text exactly as they are.' },
  { key: 'text',        label: 'Change text placement', instructie: 'Move the text block to a different position within the safe zone. Do not change the wording, the product or the scene.' },
  { key: 'variation',   label: 'Create variation',     instructie: 'Produce a close variation of this image: same strategy, same headline, slightly different execution.' },
  { key: 'regenerate',  label: 'Regenerate visual',    instructie: 'Generate this same concept again from scratch.' }
];

function wizRender_generate() {
  var sel = wizState.data.concepts.selected;
  if (sel == null) {
    return '<div class="wiz-empty">Pick a concept first. <button type="button" class="wiz-linkbtn" onclick="wizGo(\'concepts\')">Back to concepts</button></div>';
  }
  var c = (wizState.data.concepts.list || [])[sel] || {};
  var h = '';
  h += '<div class="wiz-final-head"><div class="wiz-final-h">' + wizEsc(c.headline_nl || '') + '</div>' +
    (c.visual_nl ? '<div class="wiz-final-vis">' + wizEsc(c.visual_nl) + '</div>' : '') + '</div>';
  h += '<div class="wiz-final-preview" id="gen-image-' + sel + '">' +
    '<button type="button" class="wiz-btn primary" onclick="wizPreview(' + sel + ')">Generate the final static</button></div>';
  h += '<div class="wiz-block"><div class="wiz-block-t">Adjust one element</div>' +
    '<div class="wiz-tweaks">' + WIZ_TWEAKS.map(function (t) {
      return '<button type="button" class="wiz-chip" onclick="wizTweak(\'' + t.key + '\')">' + wizEsc(t.label) + '</button>';
    }).join('') + '</div>' +
    '<div class="wiz-tweak-note">Each action changes that one element and leaves the rest of the ad alone.</div></div>';
  h += '<div class="wiz-actions big">' +
    '<button type="button" class="wiz-btn primary" onclick="wizHandOff()">Open in the full editor</button>' +
    '</div>';
  return h;
}

/* De gerichte actie zet de instructie klaar in het bestaande bewerkpaneel en
   draait dat. Zo krijgt de wizard geen tweede, afwijkende bewerkroute. */
function wizTweak(key) {
  var sel = wizState.data.concepts.selected;
  if (sel == null) return;
  if (!state.generatedImages || !state.generatedImages[sel]) {
    if (typeof toast === 'function') toast('Generate the static first, then adjust it', true);
    return;
  }
  var t = WIZ_TWEAKS.find(function (x) { return x.key === key; });
  if (!t) return;
  var extra = prompt(t.label + '\n\nWhat should it become? Leave empty to let Rory decide.');
  if (extra === null) return;
  var instructie = t.instructie + (extra.trim() ? (' Requested change: ' + extra.trim()) : '');
  if (typeof state.pendingEdits !== 'object' || !state.pendingEdits) state.pendingEdits = {};
  state.pendingEdits[sel] = [{ type: 'adjust', text: instructie }];
  if (typeof applyCombinedEdits === 'function') {
    applyCombinedEdits(sel);
  } else if (typeof toast === 'function') {
    toast('The edit panel is not available', true);
  }
}

/* Overdracht naar het bestaande resultatenscherm, met het volledige
   bewerkpaneel, de versiegeschiedenis en de bibliotheek eromheen. */
function wizHandOff() {
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Nothing to hand over yet', true); return; }
  wizState.done.generate = true;
  wizSave();
  /* Eerst de wizard-kaarten uit de DOM halen: die dragen dezelfde
     gen-image-ids als de kaarten die renderResults zo aanmaakt. */
  var body = document.getElementById('wiz-body');
  if (body) body.innerHTML = '';
  wizClose();
  if (typeof renderResults === 'function') {
    renderResults(state.lastGenerated.variations, state.lastGenerated.metadata);
  }
  if (typeof toast === 'function') toast('Opened in the editor, your wizard decisions are kept');
}

window.wizRender_review = wizRender_review; window.wizRender_concepts = wizRender_concepts;
window.wizRender_generate = wizRender_generate;
window.wizDescribeVisual = wizDescribeVisual; window.wizApproveBlueprint = wizApproveBlueprint;
window.wizGenerateConcepts = wizGenerateConcepts; window.wizPickConcept = wizPickConcept;
window.wizPreview = wizPreview; window.wizPreviewAll = wizPreviewAll;
window.wizTweak = wizTweak; window.wizHandOff = wizHandOff;
window.wizBuildBrief = wizBuildBrief; window.wizMetadata = wizMetadata;
window.wizBlueprintGaps = wizBlueprintGaps; window.wizVisualLabel = wizVisualLabel;
window.wizLabel = wizLabel; window.WIZ_TWEAKS = WIZ_TWEAKS;
window.wizClearMainResults = wizClearMainResults;
