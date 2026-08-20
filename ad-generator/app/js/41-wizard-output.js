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

function wizSofistLabel(v) {
  var o = (typeof WIZ_SOPHISTICATION !== 'undefined' ? WIZ_SOPHISTICATION : [])
    .filter(function (x) { return x.value === v; })[0];
  return o ? o.label : (v || '');
}

function wizDiffLabel(v) {
  var o = (typeof WIZ_DIFFERENTIATION !== 'undefined' ? WIZ_DIFFERENTIATION : [])
    .filter(function (x) { return x.value === v; })[0];
  return o ? o.label : (v || '');
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
    links += '<div class="wiz-warn">' +
      '<div class="wiz-warn-t">Still empty. You can continue, and the generator will fill these ' +
      'in on its own -- but it will guess, and you know the answer.</div>' +
      '<div class="wiz-warn-knoppen">' +
      ontbreekt.map(function (g) {
        return '<button type="button" class="wiz-btn ghost small" ' +
          'onclick="wizNaarGat(\'' + g.stap + '\',\'' + g.veld + '\')">' +
          'Fill in ' + wizEsc(g.label) + ' →</button>';
      }).join('') + '</div></div>';
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

/* De gaten met hun plek erbij. Een melding die zegt DAT er iets leeg is maar
   niet WAAR, laat je zelf zoeken -- en dan klik je hem weg. Elk gat weet nu
   op welke stap het veld staat, zodat er een knop op kan die je erheen
   brengt en het veld aanwijst. */
function wizBlueprintGaps() {
  var d = wizState.data, gaten = [];
  if (!d.strategy.proof) gaten.push({ label: 'proof mechanism', stap: 'strategy', veld: 'proof' });
  if (!d.strategy.objection) gaten.push({ label: 'main objection', stap: 'strategy', veld: 'objection' });
  if (!d.copy.supporting) gaten.push({ label: 'supporting line', stap: 'copy', veld: 'supporting' });
  if (!d.copy.proof) gaten.push({ label: 'proof copy', stap: 'copy', veld: 'proof' });
  return gaten;
}

/* Naar het lege veld toe: de stap open, en het veld zelf gemarkeerd en met
   de cursor erin. Alleen de stap openen laat je nog steeds zoeken welk van de
   acht velden het was. */
function wizNaarGat(stap, veld) {
  wizGo(stap);
  setTimeout(function () {
    var el = document.getElementById('wizf-' + stap + '-' + veld);
    if (!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
    try { el.focus(); } catch (e) {}
    el.classList.add('wiz-aangewezen');
    setTimeout(function () { el.classList.remove('wiz-aangewezen'); }, 2200);
  }, 60);
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
  if (d.strategy.differentiation) t += 'Manier van anders-zijn: ' + wizDiffLabel(d.strategy.differentiation) + '\n';
  if (d.strategy.mechanism) t += 'Mechanisme (het hoe): ' + d.strategy.mechanism + '\n';
  t += 'Marketing-angle: ' + d.strategy.marketingAngle + '\n';
  t += 'Kernboodschap: ' + d.strategy.messaging + '\n';
  if (d.strategy.desire) t += 'Primaire wens: ' + d.strategy.desire + '\n';
  if (d.strategy.ultimateDesire) t += 'Uiteindelijke wens: ' + d.strategy.ultimateDesire + '\n';
  if (d.strategy.timing) t += 'Waarom nu: ' + d.strategy.timing + '\n';
  if (d.strategy.pain) t += 'Primaire pijn: ' + d.strategy.pain + '\n';
  if (d.strategy.proof) t += 'Bewijsmechanisme: ' + d.strategy.proof + '\n';
  if (d.strategy.objection) t += 'Weg te nemen bezwaar: ' + d.strategy.objection + '\n';
  /* De bestemming stuurt de CTA en hoeveel de ad zelf moet afmaken. Wie naar
     een artikel gaat hoeft niet in de ad al te kopen; wie naar de
     productpagina gaat wel. Zonder dit staat er een koop-CTA boven een
     bestemming die eerst nog iets uit te leggen heeft. */
  if (d.strategy.destination && typeof wizBestemming === 'function') {
    var _b = wizBestemming(d.strategy.destination);
    if (_b) {
      t += 'Bestemming van de klik: ' + _b.label + ' -- ' + _b.hint + '\n';
      t += 'Waarom die pagina bij dit publiek hoort: ' + _b.waarom + '\n';
      t += (d.strategy.destination === 'pdp'
        ? 'De CTA mag rechtstreeks op kopen aansturen; de pagina verkoopt niet meer voor je.\n'
        : 'De CTA stuurt naar lezen of ontdekken, niet naar kopen: de pagina doet de verkoop.\n');
    }
  }

  if (typeof wizLeerBrief === 'function') t += wizLeerBrief();
  if (typeof wizZelfcontrole === 'function') t += wizZelfcontrole();
  if (f) t += '\nFORMAT-MODE: ' + ((typeof AD_FORMAT_DIRECTIVE !== 'undefined' && AD_FORMAT_DIRECTIVE[f.id]) || (f.name + ' — ' + f.desc)) + '\n';

  t += '\n## VISUELE RICHTING (HARDE DRIVER voor image_prompt_en)\n';
  (typeof WIZ_VISUAL !== 'undefined' ? WIZ_VISUAL : []).forEach(function (g) {
    var v = d.visual[g.field];
    if (v) t += '- ' + g.title + ': ' + wizVisualLabel(g.field, v) + '\n';
  });
  if (d.review.visualDescription) t += 'In gewone taal: ' + d.review.visualDescription + '\n';
  if (d.visual.basisFoto) {
    /* De beeldpijplijn stuurt deze foto als eerste beeld mee. De tekst moet dat
       weten, anders beschrijft hij een scene die met de foto niets te maken
       heeft en vecht de opdracht met zijn eigen uitgangspunt. */
    t += 'LET OP: dit beeld wordt gebouwd OP een bestaande foto die als eerste referentie ' +
         'meegestuurd wordt (' + (d.visual.basisFoto.naam || 'basisfoto') + '). Compositie, licht, ' +
         'omgeving en de persoon daarin blijven staan. Beschrijf wat er MET die foto gebeurt: ' +
         'waar het product komt, waar de tekst staat, wat er weg moet. Verzin geen andere scene ' +
         'en geen andere persoon.\n';
  }
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
/* De brief zoals hij de bibliotheek in gaat: zonder de beelddata.
   Een basisfoto en de eigen referenties zijn data-urls van tientallen kB per
   stuk, en de brief wordt bij ELKE bewaarde variatie meegekopieerd. Dat vult
   de opslag met dezelfde foto in tienvoud, terwijl het dossier alleen de
   BESLISSINGEN nodig heeft. Wat er stond blijft als telling zichtbaar, zodat
   je nog kunt zien dat er op een foto gebouwd is. */
function wizBriefZonderBeeld(d) {
  var kopie = JSON.parse(JSON.stringify(d));
  if (kopie.visual) {
    kopie.visual.basisFotoGebruikt = !!kopie.visual.basisFoto;
    kopie.visual.basisFoto = null;
    kopie.visual.extraRefsAantal = (kopie.visual.extraRefs || []).length;
    kopie.visual.extraRefs = [];
  }
  return kopie;
}

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
    /* Dit stond hardgecodeerd op null terwijl de wizard het stadium wel
       vraagt. Gevolg: de bibliotheek toonde nooit een sophistication-chip en
       de SO-code in de bestandsnaam bleef leeg -- precies het veld waarop je
       later wilt terugkijken om te zien welk claimniveau het deed. */
    sophistication: d.audience.sophistication || null,
    awareness: d.audience.awareness || null,
    destination: d.strategy.destination || null,
    /* Welke referentiebeelden deze ad gebruikt. De generator kende alleen het
       productbestand en wist niets van een foto die je voor deze ene ad
       erbij sleepte, of van een productshot dat je juist niet wilde. */
    refKeuze: (typeof wizRefsInGebruik === 'function')
      ? { uit: (d.visual.refsUit || []).slice(), extra: (d.visual.extraRefs || []).slice() }
      : null,
    timestamp: Date.now(),
    bundleProductIds: [],
    personaId: pers ? pers.id : null,
    personaName: pers ? pers.name : null,
    wizardBrief: wizBriefZonderBeeld(d)
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

  /* De scorekaart hoort hier en niet na het genereren: dit is het laatste
     moment waarop een oordeel nog gratis is. Na stap 9 heb je het beeld al
     betaald en beoordeel je iets wat je toch al gemaakt hebt. */
  if (sel != null && typeof wizRenderScorekaart === 'function') {
    h += wizRenderScorekaart();
  }

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

/* Elke hertekening bouwt de beeldvakken leeg opnieuw op; de beelden zelf staan
   in state.generatedImages en moeten er daarna weer in. Dit stond hier fout: het
   plakte state.generatedImages[i] als base64 in een img-tag, terwijl daar een
   object met een versielijst in zit. Resultaat was "[object Object]" als bron --
   een leeg vak. Je zag het alleen als er iets hertekende, dus precies bij het
   kiezen van een andere take, en dan waren alle drie de beelden weg.

   renderGeneratedImage is de functie die dit al goed doet, inclusief de
   versieknoppen en de safe-zone-overlay. Die roepen we dus aan in plaats van er
   een tweede, slechtere versie van te onderhouden. */
/* In de wizard tonen we het beeld en verder niets.
 *
 * renderGeneratedImage tekent de volledige kaart van het klassieke scherm: de
 * donkergrijze blokken met Bewerken, Ook in ander formaat, Download PNG en
 * Genereer opnieuw vanaf nul. Naast elkaar in drie kolommen is dat vier keer
 * zoveel tekst als beeld, in een grijstint die je moet ontcijferen -- en het
 * dubbelt met de verfijnacties die de wizard er zelf onder zet.
 *
 * Dus hier alleen de foto. Wat je ermee doet staat eronder, een keer, voor de
 * variatie die je gekozen hebt. */
function wizToonBeeld(i) {
  var vak = document.getElementById('gen-image-' + i);
  if (!vak) return false;
  var st = (state.generatedImages || {})[i];
  if (!st || !st.versions || !st.versions.length) return false;
  var v = st.versions[st.currentIndex] || st.versions[0];
  if (!v || !v.b64) return false;
  vak.innerHTML = '<img class="wiz-beeld" alt="" src="data:' + (v.mime || 'image/png') +
    ';base64,' + v.b64 + '">' +
    (st.versions.length > 1
      ? '<span class="wiz-beeld-v">version ' + (st.currentIndex + 1) + ' of ' + st.versions.length + '</span>'
      : '');
  return true;
}

function wizToonBewaardeBeelden() {
  var beelden = (typeof state !== 'undefined' && state.generatedImages) ? state.generatedImages : {};
  Object.keys(beelden).forEach(function (i) {
    if (!document.getElementById('gen-image-' + i)) return;
    wizToonBeeld(i);
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
      /* Een eigen kopie, geen gedeelde array. Stap 9 reserveert straks drie
         plekken achter deze lijst voor de takes, en met een gedeelde array
         groeide de conceptenlijst mee: dan stonden er zes kaarten op stap 8,
         waarvan drie een kopie van het gekozen concept zonder beeld. */
      wizState.data.concepts.list = vars.slice();
      state.lastGenerated = { variations: vars, metadata: wizMetadata() };
      state.generatedImages = {};
      /* De foto waar de ad op gebouwd wordt, klaarzetten voor elk concept.
         Zonder deze regel kies je in stap 5 een founder-foto en tekent de
         generator er alsnog een verzonnen mens bij. */
      if (typeof wizZetBasisFotos === 'function') {
        wizZetBasisFotos(vars.map(function (x, i) { return i; }));
      }
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

/* Welke beelden op dit moment gemaakt worden. Zonder dit stond er een grijs
   vlak met "geen beeld" terwijl de generator gewoon bezig was, en dan denk je
   dat er niets gebeurt -- precies de klacht. */
var wizBeeldBezig = {};

function wizPreview(i) {
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Work out the concepts first', true); return; }
  if (typeof generateImage !== 'function') return;
  wizBeeldBezig[i] = true;
  wizRender();
  generateImage(i);
  wizWachtOpBeeld(i);
}

/* De beeldgenerator meldt zichzelf niet af, dus kijken we of het beeld er is.
   Elke seconde, en na twee minuten geven we het op en zeggen dat ook: eeuwig
   "bezig" tonen is net zo misleidend als niets tonen. */
function wizWachtOpBeeld(i, pogingen) {
  var n = pogingen || 0;
  if (!wizBeeldBezig[i]) return;
  var klaar = !!((state.generatedImages || {})[i] || {}).versions;
  if (klaar || n > 120) {
    delete wizBeeldBezig[i];
    wizRender();
    return;
  }
  setTimeout(function () { wizWachtOpBeeld(i, n + 1); }, 1000);
}

function wizPreviewAll() {
  var n = (wizState.data.concepts.list || []).length;
  var beelden = (state && state.generatedImages) || {};
  for (var i = 0; i < n; i++) if (!beelden[i]) wizPreview(i);
}

/* ── Stap 9: De uiteindelijke static ──────────────────────────────────────
 *
 * Drie takes van hetzelfde concept, niet één. Eén beeld is geen keuze: het
 * beeldmodel levert bij dezelfde briefing elke keer een andere uitvoering, en
 * juist die spreiding is wat je wilt kunnen vergelijken voordat een ad de deur
 * uit gaat. Met één beeld beslist het toeval welke uitvoering je krijgt. */
var WIZ_TAKE_COUNT = 3;

/* De beeldpijplijn werkt per variatie-index in state.lastGenerated. Drie takes
   van één concept maken we daarom door drie kopieën van dat concept achter de
   conceptenlijst te hangen. Daarmee werken generateImage, het bewerkpaneel, de
   versiegeschiedenis en het opslaan in de bibliotheek ongewijzigd door -- geen
   tweede pijplijn ernaast die daarna uit elkaar gaat lopen. */
function wizTakeIndexen() {
  var sel = wizState.data.concepts.selected;
  if (sel == null || !state.lastGenerated || !state.lastGenerated.variations) return [];
  var bewaard = wizState.data.generate.takes;
  /* Nieuwe concepten betekenen een nieuwe lijst; oude indexen wijzen dan naar
     niets meer en moeten opnieuw gemaakt worden. */
  if (bewaard && bewaard.length === WIZ_TAKE_COUNT &&
      bewaard.every(function (i) { return !!state.lastGenerated.variations[i]; })) return bewaard;

  var concept = state.lastGenerated.variations[sel];
  if (!concept) return [];
  var idx = [];
  for (var n = 0; n < WIZ_TAKE_COUNT; n++) {
    idx.push(state.lastGenerated.variations.length);
    state.lastGenerated.variations.push(JSON.parse(JSON.stringify(concept)));
  }
  wizState.data.generate.takes = idx;
  wizState.data.generate.selectedTake = idx[0];
  wizSave();
  return idx;
}

function wizHuidigeTake() {
  var idx = wizState.data.generate.takes || [];
  var t = wizState.data.generate.selectedTake;
  if (t != null && idx.indexOf(t) > -1) return t;
  return idx.length ? idx[0] : null;
}

function wizPickTake(i) {
  wizState.data.generate.selectedTake = i;
  wizSave();
  wizRender();
}

/* De briefing voor de drie uitvoeringen. Dit is het verschil tussen drie takes
 * en drie pogingen: één concept, drie manieren om het te maken.
 *
 * Wat vast staat, staat vast: product, persona, funnelfase, de invalshoek en de
 * kernboodschap. Dat is het concept en dat is in stap 1 tot 7 besloten.
 *
 * Wat moet verschillen: de headline en de manier waaróp die communiceert, en de
 * hele visuele uitwerking -- scene, wie of wat er in beeld is, compositie,
 * tekstindeling, sfeer. De eerste versie kopieerde het concept drie keer, dus
 * ging dezelfde prompt drie keer naar het beeldmodel. Dan krijg je drie keer
 * dezelfde foto met een andere ruis erover, en dan valt er niets te kiezen.
 */
/* De twee passes.
 *
 * Hier zijn de twee skills het oneens, en dat is geen fout in een van beide:
 * ze isoleren een andere variabele.
 *
 *   VISUEEL — een idee, EEN headline, drie behandelingen. Alleen het beeld
 *   verschilt. Dit is de zuivere visuele-hooktest: wint er een, dan weet je
 *   dat het aan het beeld lag, want de woorden stonden vast.
 *
 *   HOEK — drie uitwerkingen die dezelfde belofte op een andere manier
 *   brengen: andere headline, andere manier van communiceren, ander beeld.
 *   Meer spreiding per generatie, maar wint er een, dan weet je niet waardoor.
 *
 * Drie kleurstellingen van hetzelfde idee is geen test, dat is een moodboard.
 * Varieer het idee of varieer het beeld, en weet welke van de twee je doet --
 * daarom staat het op het scherm en niet in de code verstopt. */
/* De twee passes doen niet hetzelfde soort werk, en dat verschil bepaalt wat
   je uit een test leert.

   De visuele pass is de echte batch: één idee, één tekst, drie beelden. Wint
   er een, dan weet je dat het aan het beeld lag, want de woorden waren de
   controle. Dat is de standaard, en niet uit voorzichtigheid: drie
   tegelijk gewijzigde dingen leveren een winnaar op waar je niets van leert.

   De hoekpass is geen batch maar drie kandidaat-ideeen naast elkaar. Elke
   andere kop is namelijk zelf een nieuwe test. Nuttig als je nog zoekt welk
   idee draagt, maar de winnaar hoort daarna alsnog zijn eigen visuele pass
   te krijgen. */
var WIZ_PASSES = [
  { key: 'visueel', label: 'Visual pass',
    sub: 'One idea, one headline, three pictures. The words are the control, so a winner tells you what won.' },
  { key: 'hoek', label: 'Angle pass',
    sub: 'Three candidate ideas side by side. Use it to find the idea, then run the winner as a visual pass.' }
];

function wizPass() {
  return wizState.data.generate.pass || 'visueel';
}

function wizZetPass(key) {
  wizState.data.generate.pass = key;
  wizSave();
  wizRender();
}

function wizBuildTakeBrief() {
  var d = wizState.data, p = wizProduct(), pers = wizPersona(), f = wizFormat();
  var c = (d.concepts.list || [])[d.concepts.selected] || {};
  var t = '';

  t += 'ONE CONCEPT, THREE EXECUTIONS.\n\n';
  t += 'LOCKED — identical in all three, do not reinterpret:\n';
  if (p) t += '- Product: ' + p.name + '\n';
  if (pers) t += '- Persona: ' + pers.name + '\n';
  if (d.audience.awareness) t += '- Awareness: ' + wizLabel('awareness', d.audience.awareness) + '\n';
  if (d.product.funnel) t += '- Funnel stage: ' + wizLabel('funnel', d.product.funnel) + '\n';
  if (d.strategy.theme) t += '- Angle: ' + d.strategy.theme + '\n';
  if (d.strategy.marketingAngle) t += '- Marketing angle: ' + d.strategy.marketingAngle + '\n';
  if (d.strategy.messaging) t += '- Core message: ' + d.strategy.messaging + '\n';
  if (d.strategy.proof) t += '- Proof: ' + d.strategy.proof + '\n';
  if (f) t += '- Format: ' + f.name + ' (' + f.desc + ')\n';
  if (d.strategy.destination && typeof wizBestemming === 'function') {
    var _tb = wizBestemming(d.strategy.destination);
    if (_tb) t += '- Destination: ' + _tb.label + ' (all three send to the same page)\n';
  }
  if (c.headline_nl) t += '- Approved concept headline: ' + c.headline_nl + '\n';
  if (c.visual_nl) t += '- Approved concept visual: ' + c.visual_nl + '\n';
  t += '\nThe promise the ad makes is the same in all three. Do not add claims that ' +
       'are not in this brief.\n\n';

  if (wizPass() === 'visueel') {
    /* De zuivere visuele-hooktest: de woorden staan vast, dus wint er een, dan
       weet je waardoor. Dit is de pass waar de media-inkoper op staat. */
    t += 'IDENTICAL in all three — the headline and every word on the image:\n' +
         '- Headline: ' + (c.headline_nl || d.copy.headline || '') + '\n' +
         (d.copy.supporting ? '- Supporting line: ' + d.copy.supporting + '\n' : '') +
         (d.copy.cta ? '- CTA: ' + d.copy.cta + '\n' : '') +
         'Do not rewrite them, not even slightly. This is a test of the picture, and the ' +
         'words are the control.\n\n' +
         'MUST DIFFER between the three: the picture, and only the picture.\n' +
         '1. A different composition and a different subject in frame.\n' +
         '2. A different place for the proof to be visible.\n' +
         '3. A different setting, light and distance.\n' +
         'Default spread: take 1 a credible person holding or using the product, looking at ' +
         'camera, editorial framing; take 2 an extreme macro of the area or the mechanism ' +
         'the claim is about, no person; take 3 the product itself with callouts or labels ' +
         'pointing at what matters.\n' +
         'Three colourways of the same shot is not a test, it is a mood board. If two takes ' +
         'would look alike in a feed, change one of them.\n\n';
    if (typeof wizLeerBrief === 'function') t += wizLeerBrief();
    /* De zelfcontrole hoorde hier ook te staan en stond er niet. Zolang de
       hoekpass de standaard was viel dat niet op, maar de visuele pass is nu
       wat je standaard draait -- en dan levert de generator drie beelden af
       die nooit tegen de acht eigenschappen zijn gehouden. */
    if (typeof wizZelfcontrole === 'function') t += wizZelfcontrole();
    t += '\nPlacement: ' + wizLabel('placement', d.product.placement) + '.\n';
    t += 'Return exactly 3 variations in the JSON shape you always use, with the same ' +
         'headline text in all three.\n';
    return t;
  }

  t += 'MUST DIFFER between the three, and clearly so:\n' +
       '1. The headline: same promise, different wording AND a different way of ' +
       'communicating it. Default spread, adapt to the format but keep them apart: ' +
       'take 1 speaks with authority (expert, editorial, news), take 2 opens with ' +
       'curiosity (a question, a surprising fact), take 3 simply demonstrates.\n' +
       '2. The visual: a different scene, different framing, a different subject in ' +
       'frame, and a different text layout. Default spread: take 1 a credible person ' +
       'holding or using the product, looking at camera, editorial framing; take 2 an ' +
       'extreme macro of the area or the mechanism the claim is about, no person; ' +
       'take 3 the product itself with callouts, icons or labels pointing at what ' +
       'matters.\n' +
       '3. The call to action, when the wording genuinely follows from the headline. ' +
       'Same offer and same destination, different words on the button.\n' +
       '4. The vibe: three takes that could not be mistaken for each other in a feed.\n\n' +
       'Three macro shots of the same product head is a failure, even with different ' +
       'headlines. If two takes would look alike, change one of them.\n\n';

  if (typeof wizLeerBrief === 'function') t += wizLeerBrief();
  if (typeof wizZelfcontrole === 'function') t += wizZelfcontrole();

  t += '\nPlacement: ' + wizLabel('placement', d.product.placement) + '.\n';
  t += 'Return exactly 3 variations in the JSON shape you always use.\n';
  return t;
}

function wizGenerateTakes() {
  if (wizState.busy) return;
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Work out the concepts first', true); return; }
  if (wizState.data.concepts.selected == null) {
    if (typeof toast === 'function') toast('Pick a concept first', true); return;
  }
  var sleutel = (window.__WG_TEAMSERVER ? 'teamserver' : ((document.getElementById('anthropic-key') || {}).value || ''));
  if (!sleutel) { if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true); return; }

  var idx = wizTakeIndexen();
  if (!idx.length) return;
  wizState.busy = true;
  /* Nog geen beeld genereren: eerst moeten de drie uitwerkingen er zijn. Anders
     betaal je voor drie keer hetzelfde beeld. */
  wizRender();

  wizCall(SYSTEM_PROMPT, [{ role: 'user', content: wizBuildTakeBrief() }], 8000)
    .then(function (data) {
      var parsed = wizParseJson(wizTextOf(data));
      var vars = parsed.variations || [];
      if (vars.length < WIZ_TAKE_COUNT) {
        throw new Error('got ' + vars.length + ' executions instead of ' + WIZ_TAKE_COUNT);
      }
      /* De gereserveerde plekken vullen met de echte uitwerkingen. */
      idx.forEach(function (plek, n) { state.lastGenerated.variations[plek] = vars[n]; });
      state.generatedImages = {};
      if (typeof wizZetBasisFotos === 'function') wizZetBasisFotos(idx);
      wizSave();
      wizState.busy = false;
      /* Tekenen voordat de beelden komen: generateImage schrijft in
         #gen-image-<i> en die vakken moeten er staan. En je ziet nu al waarin de
         drie verschillen, voordat er een euro aan beeld op gaat. */
      wizRender();
      idx.forEach(function (i) { wizPreview(i); });
    })
    .catch(function (err) {
      wizState.busy = false;
      /* Mislukt betekent geen beeld. Drie identieke beelden zouden hier het
         ergste antwoord zijn: je betaalt drie keer en kunt niets kiezen. */
      wizState.data.generate.takes = null;
      wizSave();
      wizRender();
      if (typeof toast === 'function') toast('Could not work out the three takes: ' + err.message, true);
    });
}

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

/* Stap 9 doet één ding: van het gekozen concept drie variaties maken, met beeld,
 * en jou er één laten kiezen.
 *
 * Deze stap was te ingewikkeld geworden. Er stonden twee grote keuzeblokken
 * voor de pass, een knop om takes uit te werken, een knop om ze opnieuw uit te
 * werken, een rij verfijnacties en een uitleg waarom je nog niets kon
 * verfijnen -- terwijl je hier maar één vraag hebt: welke van de drie loopt er?
 *
 * Dus: één knop, drie kaarten, kiezen. De verfijnacties komen pas als er een
 * gekozen is, en de tweede manier van varieren staat als één regel onder de
 * drie in plaats van als blok erboven. */
/* Het bestemmingspaneel op de laatste stap. Drie toestanden: er is een keuze
   (dan staat er waarom die past, of dat hij juist niet past), er is alleen
   een aanbeveling (dan staat die er met een knop om hem over te nemen), of er
   is nog geen awareness en dan is er niets te zeggen. */
function wizBestemmingPaneel() {
  if (typeof WIZ_BESTEMMINGEN === 'undefined') return '';
  var d = wizState.data;
  var gekozen = d.strategy.destination ? wizBestemming(d.strategy.destination) : null;
  var advies = (typeof wizBestemmingAdvies === 'function') ? wizBestemmingAdvies() : null;

  if (!gekozen && !advies) {
    return '<div class="wiz-bestemming leeg">Where this click should land follows from the ' +
      'awareness stage, and that is not set yet.</div>';
  }
  if (!gekozen && advies) {
    var b = wizBestemming(advies.keuze);
    return '<div class="wiz-bestemming">' +
      '<div class="wiz-best-kop">Send this traffic to a ' + wizEsc(b.label.toLowerCase()) + '</div>' +
      '<p>' + wizEsc(b.waarom) + '</p>' +
      '<button type="button" class="wiz-linkbtn" onclick="wizPick(\'strategy\',\'destination\',\'' +
      b.value + '\')">Set ' + wizEsc(b.label) + ' as the destination</button></div>';
  }
  var mis = (typeof wizBestemmingMismatch === 'function') ? wizBestemmingMismatch() : null;
  return '<div class="wiz-bestemming' + (mis ? ' mismatch' : '') + '">' +
    '<div class="wiz-best-kop">Lands on: ' + wizEsc(gekozen.label) + '</div>' +
    '<p>' + wizEsc(mis || gekozen.waarom) + '</p></div>';
}

function wizRender_generate() {
  var sel = wizState.data.concepts.selected;
  if (sel == null) {
    return '<div class="wiz-empty">Pick a concept first. ' +
      '<button type="button" class="wiz-linkbtn" onclick="wizGo(\'concepts\')">Back to the concepts</button></div>';
  }
  var c = (wizState.data.concepts.list || [])[sel] || {};
  var beelden = (state && state.generatedImages) || {};
  var takes = wizState.data.generate.takes || [];
  var gekozen = wizHuidigeTake();

  var h = '<div class="wiz-final-head"><div class="wiz-final-h">' + wizEsc(c.headline_nl || '') + '</div>' +
    (c.visual_nl ? '<div class="wiz-final-vis">' + wizEsc(c.visual_nl) + '</div>' : '') + '</div>';

  /* Waar de klik heen moet. Dit staat hier en niet alleen op de strategiestap,
     omdat dit het moment is waarop de ad de deur uit gaat: wie hem nu naar de
     verkeerde pagina hangt, betaalt dat in bereik. Zonder awareness geen
     advies -- een verzonnen bestemming is erger dan een leeg vak. */
  h += wizBestemmingPaneel();

  /* Nog niets: één knop en één zin over wat er gebeurt. */
  if (!takes.length) {
    return h + '<div class="wiz-final-start">' +
      '<button type="button" class="wiz-btn primary" onclick="wizGenerateTakes()"' +
      (wizState.busy ? ' disabled' : '') + '>' +
      (wizState.busy ? 'Working out three variations…' : 'Generate ' + WIZ_TAKE_COUNT + ' variations') +
      '</button>' +
      '<div class="wiz-take-uitleg">' + (wizPass() === 'visueel'
        ? 'Same persona, same angle, same promise, and the same words on all three. Only the ' +
          'picture changes, so whichever wins tells you it was the picture. You pick the one that runs.'
        : 'Same persona, same angle, same promise. Three different headlines and three different ' +
          'pictures: three candidate ideas rather than one batch. Run the winner as a visual pass ' +
          'afterwards.') + '</div></div>';
  }

  /* De drie naast elkaar. Elke kaart zegt in welke toestand hij is: er is een
     beeld, hij wordt gemaakt, of hij is er niet gekomen. Een grijs vlak zonder
     woorden liet je raden of je moest wachten of iets stuk was. */
  h += '<div class="wiz-takes">' + takes.map(function (i, n) {
    var aan = (i === gekozen);
    var v = (state.lastGenerated && state.lastGenerated.variations[i]) || {};
    var heeft = !!beelden[i];
    return '<div class="wiz-take' + (aan ? ' on' : '') + '">' +
      '<div class="wiz-take-kop">Variation ' + (n + 1) +
      (v.hook_label_nl ? '<span class="wiz-take-hook">' + wizEsc(v.hook_label_nl) + '</span>' : '') +
      '</div>' +
      '<div class="wiz-final-preview" id="gen-image-' + i + '">' +
        (heeft ? '' :
          '<span class="wiz-take-leeg">' +
          (wizBeeldBezig[i] ? 'Drawing this one…' : (wizState.busy ? 'Working…' : 'No image yet')) +
          '</span>') +
      '</div>' +
      (heeft || wizBeeldBezig[i] ? '' :
        '<button type="button" class="wiz-linkbtn wiz-take-opnieuwbeeld" ' +
        'onclick="wizPreview(' + i + ')">Generate this picture</button>') +
      (v.headline_nl ? '<div class="wiz-take-h">' + wizEsc(v.headline_nl) + '</div>' : '') +
      (v.cta_nl ? '<div class="wiz-take-cta">' + wizEsc(v.cta_nl) + '</div>' : '') +
      (v.visual_nl ? '<div class="wiz-take-v">' + wizEsc(v.visual_nl) + '</div>' : '') +
      '<button type="button" class="wiz-take-kies' + (aan ? ' on' : '') + '" ' +
      'onclick="wizPickTake(' + i + ')">' + (aan ? 'Chosen' : 'Choose this one') + '</button>' +
      /* De tweede lens, en alleen op een beeld dat bestaat: Nick oordeelt over
         de foto, niet over het idee. */
      (heeft ? '<button type="button" class="wiz-linkbtn wiz-take-nick" ' +
        'onclick="wizNickHerprompt(' + i + ')"' + (wizState.busy ? ' disabled' : '') + '>' +
        (wizState.busy ? 'Nick is looking…' : 'Ask Nick if this picture will spend') + '</button>' : '') +
      (typeof wizRenderNick === 'function' ? wizRenderNick(i) : '') +
      '</div>';
  }).join('') + '</div>';

  /* Opnieuw, en de andere manier van varieren -- als regels, niet als blokken.
     Ze zijn allebei een uitzondering op wat je hier normaal doet. */
  h += '<div class="wiz-take-opnieuw">' +
    '<button type="button" class="wiz-linkbtn" onclick="wizGenerateTakes()"' +
    (wizState.busy ? ' disabled' : '') + '>Work out three new variations</button>' +
    '<span class="wiz-take-of">or</span>' +
    '<button type="button" class="wiz-linkbtn" onclick="wizAnderePass()">' +
    (wizPass() === 'visueel'
      ? 'vary the headline as well, not just the picture'
      : 'keep the headline identical and vary only the picture') +
    '</button></div>';

  /* Verfijnen kan pas als er iets te verfijnen valt, en gaat over de gekozen
     variatie. Staat er niets gekozen of niets in beeld, dan staat deze hele
     rij er niet: knoppen die niets doen zijn erger dan geen knoppen. */
  if (gekozen != null && beelden[gekozen]) {
    var groepen = [];
    WIZ_TWEAKS.forEach(function (t) { if (groepen.indexOf(t.groep) === -1) groepen.push(t.groep); });
    h += '<div class="wiz-refine">' + wizPaneel('Refine the chosen variation',
      '<div class="wiz-refine-rij">' + groepen.map(function (g) {
        return '<div class="wiz-tweakgroep"><span class="wiz-tweakgroep-t">' + wizEsc(g) + '</span>' +
          '<div class="wiz-tweaklijst">' + WIZ_TWEAKS.filter(function (t) { return t.groep === g; }).map(function (t) {
            var aanT = (wizState.tweakOpen === t.key);
            return '<button type="button" class="wiz-tweakknop' + (aanT ? ' on' : '') + '" ' +
              'onclick="wizOpenTweak(\'' + t.key + '\')">' + wizEsc(t.label) + '</button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>' +
      wizTweakPaneel() +
      '<div class="wiz-tweak-note">Each action changes that one element and leaves the rest alone.</div>') +
      '</div>';
  }

  return h;
}

/* Wisselen tussen de twee manieren van varieren. Eén regel in plaats van twee
   keuzeblokken: het is een uitzondering, geen kruispunt. */
function wizAnderePass() {
  wizZetPass(wizPass() === 'visueel' ? 'hoek' : 'visueel');
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
  /* Bewerken gaat over de take die je gekozen hebt, niet over het concept:
     er staan er drie, en zonder die keuze zou de wizard er zelf een aanwijzen. */
  var sel = wizHuidigeTake();
  var t = WIZ_TWEAKS.filter(function (x) { return x.key === wizState.tweakOpen; })[0];
  if (sel == null || !t) return;
  if (!state.generatedImages || !state.generatedImages[sel]) {
    if (typeof toast === 'function') toast('Generate the takes first, then adjust one', true);
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
  /* De gekozen take gaat de bibliotheek in, niet het concept: die drie zijn
     verschillende ads en er kan er maar één lopen. */
  var sel = wizHuidigeTake();
  if (sel == null) { if (typeof toast === 'function') toast('Generate the takes first', true); return; }
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
window.wizRender_generate = wizRender_generate; window.wizBestemmingPaneel = wizBestemmingPaneel;
window.wizAfter_review = wizAfter_review; window.wizAfter_concepts = wizAfter_concepts;
window.wizAfter_generate = wizAfter_generate;
window.wizDescribeVisual = wizDescribeVisual; window.wizApproveBlueprint = wizApproveBlueprint;
window.wizGenerateConcepts = wizGenerateConcepts; window.wizPickConcept = wizPickConcept;
window.wizPreview = wizPreview; window.wizPreviewAll = wizPreviewAll;
window.wizTweak = wizTweak; window.wizOpenTweak = wizOpenTweak; window.wizHandOff = wizHandOff;
window.wizBuildBrief = wizBuildBrief; window.wizMetadata = wizMetadata; window.wizBriefZonderBeeld = wizBriefZonderBeeld;
window.wizBlueprintGaps = wizBlueprintGaps; window.wizNaarGat = wizNaarGat; window.wizVisualLabel = wizVisualLabel;
window.wizLabel = wizLabel; window.WIZ_TWEAKS = WIZ_TWEAKS;
window.wizSofistLabel = wizSofistLabel; window.wizDiffLabel = wizDiffLabel;
window.wizClearMainResults = wizClearMainResults; window.wizBriefGroep = wizBriefGroep;
window.wizToonBewaardeBeelden = wizToonBewaardeBeelden; window.WIZ_CONCEPT_COUNT = WIZ_CONCEPT_COUNT;
window.wizNaarEindbeeld = wizNaarEindbeeld;
window.wizGenerateTakes = wizGenerateTakes; window.wizPickTake = wizPickTake;
window.wizToonBeeld = wizToonBeeld; window.wizBeeldBezig = wizBeeldBezig;
window.wizAnderePass = wizAnderePass; window.wizZetPass = wizZetPass; window.wizPass = wizPass; window.WIZ_PASSES = WIZ_PASSES;
window.wizHuidigeTake = wizHuidigeTake; window.wizTakeIndexen = wizTakeIndexen;
window.WIZ_TAKE_COUNT = WIZ_TAKE_COUNT;
