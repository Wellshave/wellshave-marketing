/* Static Ad Wizard — stap 7, 8 en 9.
 *
 * Hier gaan de losse besluiten naar een prompt, drie concepten en uiteindelijk
 * één static. Bewust in die volgorde: de blueprint is de laatste plek waar
 * corrigeren gratis is, daarna kost elke stap een generatie.
 *
 * Zelfde vormtaal als stap 1 tot en met 6: het voorstel staat er al, in gewone
 * taal, en het formulier zit achter een uitklap. De eerste versie van stap 7
 * was een tabel met dertien rijen -- dat is een controlelijst, geen briefing,
 * en je leest er niet uit wat je gaat krijgen.
 *
 * Belangrijk voor het begrijpen van dit bestand: de wizard bouwt GEEN eigen
 * beeldpijplijn. Hij zet de gestructureerde besluiten om in dezelfde
 * variations-vorm die het systeem al gebruikt en geeft die door aan
 * renderResults en generateImage. Alles wat daar al goed geregeld is --
 * safe zones, referentiefoto's, merk-anatomie, het bewerkpaneel -- blijft
 * daardoor werken zonder dat het hier herhaald wordt.
 *
 * Eén ding doet de wizard bewust NIET vanzelf: beeld genereren. Rory mag
 * adviseren zonder te vragen, want dat kost een paar cent aan tekst. Een
 * afbeelding kost echt geld, en in dit systeem is de menselijke goedkeuring de
 * enige rem daarop. Dus blijft dat één bewuste klik, met erbij hoeveel beelden
 * het zijn.
 */

/* ── Leesbare namen ─────────────────────────────────────────────────────── */

var WIZ_LABELS = {
  funnel: { tof: 'cold reach', mof: 'consideration', bof: 'conversion', retargeting: 'retargeting' },
  placement: { feed11: 'Feed 1:1', feed45: 'Feed 4:5', stories: 'Stories 9:16', reels: 'Reels 9:16' },
  awareness: { unaware: 'unaware', problem: 'problem aware', solution: 'solution aware',
               product: 'product aware', most: 'most aware' }
};

function wizLabel(soort, waarde) {
  var m = WIZ_LABELS[soort];
  return (m && m[waarde]) || waarde || '';
}

function wizVisualLabel(field, value) {
  var g = (typeof WIZ_VISUAL !== 'undefined')
    ? WIZ_VISUAL.filter(function (x) { return x.field === field; })[0] : null;
  if (!g) return value || '';
  var o = g.opts.filter(function (x) { return x.value === value; })[0];
  return o ? o.label : (value || '');
}

/* ── Stap 7: Creative blueprint ───────────────────────────────────────────── */

/* De blueprint leest als een briefing en niet als een tabel: eerst wat je gaat
   zien, dan in drie groepen waar dat op rust. Elke groep heeft één ingang om
   terug te springen, want de opdracht was dat je een onderdeel kunt bijstellen
   zonder de wizard opnieuw te doorlopen. */
function wizRender_review() {
  var d = wizState.data;
  var p = wizProduct(), pers = wizPersona(), f = wizFormat();

  var visueel = (typeof WIZ_VISUAL !== 'undefined' ? WIZ_VISUAL : [])
    .filter(function (g) { return d.visual[g.field]; })
    .map(function (g) { return wizVisualLabel(g.field, d.visual[g.field]); });

  /* Links de blueprint in groepen, elk met een eigen ingang terug. Rechts wat
     je gaat krijgen: de beschrijving in gewone taal en een beeldindruk. */
  var links = '<div class="wiz-brief">' +
    wizBriefGroep('Product', 'product', [
      p ? p.name : '', wizLabel('placement', d.product.placement), wizLabel('funnel', d.product.funnel)
    ]) +
    wizBriefGroep('Audience', 'audience', [
      pers ? pers.name : '', wizLabel('awareness', d.audience.awareness)
    ]) +
    wizBriefGroep('Angle', 'strategy', [
      d.strategy.marketingAngle, d.strategy.messaging,
      d.strategy.proof ? ('proof: ' + d.strategy.proof) : ''
    ]) +
    wizBriefGroep('Format', 'format', [f ? f.name : d.format.formatId]) +
    wizBriefGroep('Visual direction', 'visual', visueel) +
    wizBriefGroep('Copy', 'copy', [
      d.copy.headline, d.copy.supporting, d.copy.proof,
      d.copy.cta ? ('CTA: ' + d.copy.cta) : ''
    ]) +
    '</div>';

  var ontbreekt = wizBlueprintGaps();
  if (ontbreekt.length) {
    links += '<div class="wiz-warn">Still empty: ' + wizEsc(ontbreekt.join(', ')) +
      '. You can continue, but the generator will fill those gaps on its own.</div>';
  }

  var rechts = '';
  if (d.review.visualDescription) {
    rechts += wizPaneel('What will be generated',
      '<div class="wiz-vizdesc">' + wizEsc(d.review.visualDescription) + '</div>' +
      '<div class="wiz-actions"><button type="button" class="wiz-btn ghost small" ' +
      'onclick="wizDescribeVisual()">Describe it again</button></div>');
  } else if (wizState.busy) {
    rechts += wizDenkt('Rory is writing out what the ad will look like.');
  } else {
    rechts += '<div class="wiz-leegzij">Rory has not described the ad yet. ' +
      '<button type="button" class="wiz-linkbtn" onclick="wizDescribeVisual()">Describe it</button></div>';
  }

  var refs = (p && typeof normalizeRefs === 'function') ? normalizeRefs(p.references) : null;
  var beeld = refs && ((refs.usage && refs.usage[0]) || (refs.lifestyle && refs.lifestyle[0]) || (refs.product && refs.product[0]));
  rechts += wizPaneel('Visual preview',
    '<div class="wiz-adpreview">' +
      (beeld ? '<div class="wiz-adpreview-beeld"><img src="' + beeld + '" alt=""></div>' : '') +
      '<div class="wiz-adpreview-tekst">' +
        '<div class="wiz-copy-headline">' + wizEsc(d.copy.headline) + '</div>' +
        (d.copy.supporting ? '<div class="wiz-copy-sub">' + wizEsc(d.copy.supporting) + '</div>' : '') +
        (d.copy.cta ? '<div class="wiz-copy-cta">' + wizEsc(d.copy.cta) + '</div>' : '') +
      '</div></div>' +
    '<div class="wiz-vizvoorbeeld-bij">Layout impression from your decisions. Nothing has been generated yet.</div>');

  return { links: links, rechts: rechts };
}

function wizBriefGroep(titel, stap, regels) {
  var gevuld = (regels || []).filter(function (r) { return r && String(r).trim(); });
  return '<div class="wiz-brief-groep">' +
    '<div class="wiz-brief-kop"><span>' + wizEsc(titel) + '</span>' +
    '<button type="button" class="wiz-bp-edit" onclick="wizGo(\'' + stap + '\')">Edit</button></div>' +
    (gevuld.length
      ? '<ul class="wiz-brief-lijst">' + gevuld.map(function (r) { return '<li>' + wizEsc(r) + '</li>'; }).join('') + '</ul>'
      : '<div class="wiz-brief-leeg">nothing set</div>') +
    '</div>';
}

/* Rory beschrijft het beeld zodra je hier binnenkomt, net als hij op de andere
   stappen uit zichzelf kijkt. Dat is tekst, geen beeld -- dus geen geld. */
function wizAfter_review() {
  if (wizState.data.review.visualDescription) return;
  if (wizState.busy) return;
  if (wizState.beschreven) return;
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) return;
  wizState.beschreven = true;
  wizDescribeVisual();
}

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

/* Het scharnierpunt van de hele wizard: gestructureerde besluiten in, één
   prompt uit. Geen enkele stap schrijft rechtstreeks in een promptveld, zodat
   dezelfde besluiten later ook naar performance-data of learnings kunnen --
   dat bouwen we hier nog niet, maar de vorm staat het toe. */
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
   generate() in 10-kopieermodus.js oplevert -- zo werkt de rest ongewijzigd. */
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
    return wizDenkt('Rory is working out ' + WIZ_CONCEPT_COUNT + ' routes within the approved strategy.');
  }
  if (!lijst.length) {
    return '<div class="wiz-empty">No concepts yet. ' +
      '<button type="button" class="wiz-linkbtn" onclick="wizGenerateConcepts()">Work them out</button></div>';
  }

  var sel = wizState.data.concepts.selected;
  var beelden = (typeof state !== 'undefined' && state.generatedImages) ? state.generatedImages : {};
  var zonderBeeld = lijst.filter(function (c, i) { return !beelden[i]; }).length;

  var h = '<div class="wiz-concepts">' + lijst.map(function (c, i) {
    var aan = (sel === i);
    return '<button type="button" class="wiz-concept' + (aan ? ' on' : '') + '" ' +
      'aria-pressed="' + (aan ? 'true' : 'false') + '" onclick="wizPickConcept(' + i + ')">' +
      '<span class="wiz-concept-preview" id="gen-image-' + i + '">' +
        '<span class="wiz-concept-geenbeeld">no preview yet</span></span>' +
      '<span class="wiz-concept-body">' +
        '<span class="wiz-concept-h">' + wizEsc(c.headline_nl || '') + '</span>' +
        (c.hook_label_nl ? '<span class="wiz-concept-hook">' + wizEsc(c.hook_label_nl) + '</span>' : '') +
        (c.visual_nl ? '<span class="wiz-concept-vis">' + wizEsc(c.visual_nl) + '</span>' : '') +
        (c.reasoning_nl ? '<span class="wiz-concept-why"><em>Rory</em>' + wizEsc(c.reasoning_nl) + '</span>' : '') +
      '</span></button>';
  }).join('') + '</div>';

  /* Beeld kost geld, dus dit blijft een bewuste klik met het aantal erbij. */
  h += '<div class="wiz-actions">' +
    (zonderBeeld
      ? '<button type="button" class="wiz-btn" onclick="wizPreviewAll()">Generate ' + zonderBeeld +
        ' preview' + (zonderBeeld > 1 ? 's' : '') + '</button>'
      : '') +
    '<button type="button" class="wiz-btn ghost small" onclick="wizGenerateConcepts()"' +
      (wizState.busy ? ' disabled' : '') + '>Work out three different ones</button>' +
    '</div>';
  return h;
}

/* Na het tekenen de al gemaakte beelden terugzetten: generateImage schrijft ze
   ooit in deze containers, maar een hertekening maakt die leeg. */
function wizAfter_concepts() { wizToonBewaardeBeelden(); }

function wizToonBewaardeBeelden() {
  var beelden = (typeof state !== 'undefined' && state.generatedImages) ? state.generatedImages : {};
  Object.keys(beelden).forEach(function (i) {
    var el = document.getElementById('gen-image-' + i);
    if (el && beelden[i]) {
      el.innerHTML = '<img src="data:image/png;base64,' + beelden[i] + '" alt="">';
    }
  });
}

function wizGenerateConcepts() {
  if (wizState.busy) return;
  var sleutel = (window.__WG_TEAMSERVER ? 'teamserver' : ((document.getElementById('anthropic-key') || {}).value || ''));
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

function wizPreview(i) {
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Work out the concepts first', true); return; }
  if (typeof generateImage !== 'function') return;
  generateImage(i);
}

function wizPreviewAll() {
  var n = (wizState.data.concepts.list || []).length;
  var beelden = (state && state.generatedImages) || {};
  for (var i = 0; i < n; i++) if (!beelden[i]) wizPreview(i);
}

/* ── Stap 9: De uiteindelijke static ────────────────────────────────────── */

/* De gerichte acties na generatie. Elke actie verandert één element en laat de
   rest staan; ze gaan naar het bestaande bewerkpaneel in plaats van de hele
   strategie opnieuw op te bouwen. Gegroepeerd naar wat ze raken, want negen
   losse chips op een rij is weer een control panel. */
var WIZ_TWEAKS = [
  { key: 'headline',    groep: 'Words',   label: 'Change headline',         vraag: 'What should the headline become?',
    instructie: 'Replace only the headline text. Keep the composition, product, scene, lighting and every other element exactly as they are.' },
  { key: 'text',        groep: 'Words',   label: 'Move the text',           vraag: 'Where should the text sit?',
    instructie: 'Move the text block to a different position within the safe zone. Do not change the wording, the product or the scene.' },
  { key: 'composition', groep: 'Framing', label: 'Change composition',      vraag: 'How should it be composed?',
    instructie: 'Rearrange the composition and framing. Keep the same product, scene, headline text and mood.' },
  { key: 'position',    groep: 'Framing', label: 'Move the product',        vraag: 'Where should the product sit?',
    instructie: 'Move the product to a different position in frame. Change nothing else.' },
  { key: 'scene',       groep: 'Scene',   label: 'Change scene',            vraag: 'Which scene should it be?',
    instructie: 'Move this to a different scene or environment. Keep the product, the headline text, the framing and the mood.' },
  { key: 'background',  groep: 'Scene',   label: 'Change background',       vraag: 'What should the background become?',
    instructie: 'Replace only the background. Keep the product, any person, the framing and all text exactly as they are.' },
  { key: 'model',       groep: 'Scene',   label: 'Change model',            vraag: 'Who should be in frame?',
    instructie: 'Change the person in frame. Keep the product, scene, composition, headline text and mood.' },
  { key: 'variation',   groep: 'Rebuild', label: 'Create a variation',      vraag: 'Anything to steer the variation?',
    instructie: 'Produce a close variation of this image: same strategy, same headline, slightly different execution.' },
  { key: 'regenerate',  groep: 'Rebuild', label: 'Regenerate the visual',   vraag: 'Anything to change while regenerating?',
    instructie: 'Generate this same concept again from scratch.' }
];

function wizRender_generate() {
  var sel = wizState.data.concepts.selected;
  if (sel == null) {
    return '<div class="wiz-empty">Pick a concept first. ' +
      '<button type="button" class="wiz-linkbtn" onclick="wizGo(\'concepts\')">Back to the concepts</button></div>';
  }
  var c = (wizState.data.concepts.list || [])[sel] || {};
  var heeftBeeld = !!((state && state.generatedImages) || {})[sel];

  /* Links het beeld zelf, zo groot als het paneel toelaat. Rechts de gerichte
     acties, onder elkaar zoals in het ontwerp -- ze veranderen elk één ding en
     laten de rest staan. */
  var links = '<div class="wiz-final-head"><div class="wiz-final-h">' + wizEsc(c.headline_nl || '') + '</div>' +
    (c.visual_nl ? '<div class="wiz-final-vis">' + wizEsc(c.visual_nl) + '</div>' : '') + '</div>' +
    '<div class="wiz-final-preview" id="gen-image-' + sel + '">' +
    (heeftBeeld ? '' :
      '<button type="button" class="wiz-btn primary" onclick="wizPreview(' + sel + ')">Generate the final static</button>') +
    '</div>';

  var rechts;
  if (!heeftBeeld) {
    rechts = '<div class="wiz-leegzij">Generate the static first. The refine actions appear once there is an image to change.</div>';
  } else {
    var groepen = [];
    WIZ_TWEAKS.forEach(function (t) { if (groepen.indexOf(t.groep) === -1) groepen.push(t.groep); });
    rechts = wizPaneel('Refine this ad',
      groepen.map(function (g) {
        return '<div class="wiz-tweakgroep"><span class="wiz-tweakgroep-t">' + wizEsc(g) + '</span>' +
          '<div class="wiz-tweaklijst">' + WIZ_TWEAKS.filter(function (t) { return t.groep === g; }).map(function (t) {
            var aan = (wizState.tweakOpen === t.key);
            return '<button type="button" class="wiz-tweakknop' + (aan ? ' on' : '') + '" ' +
              'onclick="wizOpenTweak(\'' + t.key + '\')">' + wizEsc(t.label) + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      wizTweakPaneel() +
      '<div class="wiz-tweak-note">Each action changes that one element and leaves the rest of the ad alone.</div>');
  }
  return { links: links, rechts: rechts };
}

/* De hoofdknop op stap 8. Doorlopen naar het eindbeeld kan alleen met een
   gekozen concept -- anders zou de wizard raden welk van de drie je bedoelt. */
function wizNaarEindbeeld() {
  if (wizState.data.concepts.selected == null) {
    if (typeof toast === 'function') toast('Pick a concept to continue', true);
    return;
  }
  wizState.done.concepts = true;
  wizSave();
  wizGo('generate');
}

function wizAfter_generate() { wizToonBewaardeBeelden(); }

/* Geen prompt()-venster meer. Dat blokkeert de pagina, is niet te testen en
   past bij geen enkel ander scherm hier. */
function wizTweakPaneel() {
  var t = WIZ_TWEAKS.filter(function (x) { return x.key === wizState.tweakOpen; })[0];
  if (!t) return '';
  return '<div class="wiz-veldpaneel">' +
    '<div class="wiz-veldpaneel-t">' + wizEsc(t.vraag) + '</div>' +
    '<textarea id="wiz-tweak-in" rows="2" placeholder="Leave empty to let Rory decide."></textarea>' +
    '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn primary small" onclick="wizTweak()">Apply this change</button>' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizOpenTweak(null)">Cancel</button>' +
    '</div></div>';
}

function wizOpenTweak(key) {
  wizState.tweakOpen = (wizState.tweakOpen === key) ? null : key;
  wizRender();
}

function wizTweak() {
  var sel = wizState.data.concepts.selected;
  var t = WIZ_TWEAKS.filter(function (x) { return x.key === wizState.tweakOpen; })[0];
  if (sel == null || !t) return;
  if (!state.generatedImages || !state.generatedImages[sel]) {
    if (typeof toast === 'function') toast('Generate the static first, then adjust it', true);
    return;
  }
  var el = document.getElementById('wiz-tweak-in');
  var extra = el ? el.value.trim() : '';
  var instructie = t.instructie + (extra ? (' Requested change: ' + extra) : '');
  if (!state.pendingEdits || typeof state.pendingEdits !== 'object') state.pendingEdits = {};
  state.pendingEdits[sel] = [{ type: 'adjust', text: instructie }];
  wizState.tweakOpen = null;
  if (typeof applyCombinedEdits === 'function') {
    applyCombinedEdits(sel);
  } else if (typeof toast === 'function') {
    toast('The edit panel is not available', true);
  }
  wizRender();
}

/* Einde van de negen stappen: de ad gaat naar de bibliotheek, waar bewaarde
   ads horen, en je gaat mee zodat je ziet dat hij er staat.

   Dit ging eerst naar het oude resultatenscherm in de rechterkolom. Dat scherm
   hoort bij het klassieke formulier en is in Statics weg; de bibliotheek heeft
   hetzelfde bewerkpaneel en de versiegeschiedenis eromheen. */
function wizHandOff() {
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Nothing to save yet', true); return; }
  var sel = wizState.data.concepts.selected;
  if (sel == null) { if (typeof toast === 'function') toast('Pick a concept first', true); return; }
  wizState.done.generate = true;
  wizSave();
  var klaar = function () {
    if (typeof switchMainTab === 'function') switchMainTab('library');
    if (typeof toast === 'function') toast('Saved to the library, your wizard decisions are kept');
  };
  if (typeof saveToLibraryFromCard === 'function') {
    var r = saveToLibraryFromCard(sel);
    /* saveToLibraryFromCard is async en comprimeert het beeld; pas daarna staat
       het er echt, dus pas daarna wisselen we van scherm. De belofte gaat terug
       naar de aanroeper zodat een test op het einde kan wachten in plaats van
       op een timer te gokken. */
    if (r && typeof r.then === 'function') return r.then(klaar, klaar);
  }
  klaar();
  return Promise.resolve();
}

window.wizRender_review = wizRender_review; window.wizRender_concepts = wizRender_concepts;
window.wizRender_generate = wizRender_generate;
window.wizAfter_review = wizAfter_review; window.wizAfter_concepts = wizAfter_concepts;
window.wizAfter_generate = wizAfter_generate;
window.wizDescribeVisual = wizDescribeVisual; window.wizApproveBlueprint = wizApproveBlueprint;
window.wizGenerateConcepts = wizGenerateConcepts; window.wizPickConcept = wizPickConcept;
window.wizPreview = wizPreview; window.wizPreviewAll = wizPreviewAll;
window.wizTweak = wizTweak; window.wizOpenTweak = wizOpenTweak; window.wizHandOff = wizHandOff;
window.wizBuildBrief = wizBuildBrief; window.wizMetadata = wizMetadata;
window.wizBlueprintGaps = wizBlueprintGaps; window.wizVisualLabel = wizVisualLabel;
window.wizLabel = wizLabel; window.WIZ_TWEAKS = WIZ_TWEAKS;
window.wizClearMainResults = wizClearMainResults; window.wizBriefGroep = wizBriefGroep;
window.wizToonBewaardeBeelden = wizToonBewaardeBeelden; window.WIZ_CONCEPT_COUNT = WIZ_CONCEPT_COUNT;
window.wizNaarEindbeeld = wizNaarEindbeeld;
