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
  } else if (wizRoryBezig()) {
    rechts += wizDenkt('Rory is writing out what the ad will look like.');
  } else {
    rechts += '<div class="wiz-leegzij">Rory has not described the ad yet. ' +
      '<button type="button" class="wiz-linkbtn" onclick="wizDescribeVisual()">Describe it</button></div>';
  }

  rechts += wizVoorproefPaneel();

  return { links: links, rechts: rechts };
}

/* ── De voorproef ─────────────────────────────────────────────────────────
 *
 * Het vak "Visual preview" toonde een productfoto uit de bibliotheek met de
 * copy eronder. Dat is een layout-indruk en geen concept: de blueprint
 * beschrijft een man op de rand van een onopgemaakt bed met een vrouw op de
 * achtergrond, en in het vak stond een packshot op wit. Twee dingen die niets
 * met elkaar te maken hebben, met "preview" erboven.
 *
 * Dit maakt er één echt beeld van, vóór de drie concepten. Met opzet het
 * goedkoopste model op lage kwaliteit: het is een voorproef, geen oplevering.
 * Je kijkt of de compositie klopt en of de kop past -- niet of de huid goed is.
 *
 * Hij wordt NIET opgeslagen. Een base64-beeld in localStorage kan de opslag
 * vol laten lopen, en dan slaat de wizard stilletjes niets meer op: je hele
 * blueprint weg omdat er een voorproef in paste. Na een verversing maak je hem
 * opnieuw, en dat kost één goedkoop beeld.
 */
var WIZ_VOORPROEF_MODEL = 'gpt-image-1-mini';

function wizVoorproefPrompt() {
  var d = wizState.data;
  var r = [];
  r.push('Render a realistic preview of this single social ad creative, as it would appear in the feed.');
  if (d.review.visualDescription) r.push(d.review.visualDescription);
  var f = wizFormat();
  if (f) r.push('Format: ' + f.name + '.');
  /* De copy hoort in het beeld, want de vraag die je aan een voorproef stelt is
     of de kop past en leesbaar blijft naast wat er staat. Zonder de tekst kijk
     je naar een foto en niet naar een advertentie. */
  if (d.copy.headline) r.push('Headline text on the image, exactly: "' + d.copy.headline + '".');
  if (d.copy.supporting) r.push('Smaller supporting line: "' + d.copy.supporting + '".');
  if (d.copy.cta) r.push('Call to action element: "' + d.copy.cta + '".');
  if (typeof buildSafeZoneInstruction === 'function') {
    r.push(buildSafeZoneInstruction(d.product.placement));
  }
  r.push('This is a quick layout preview: composition, framing and text placement matter, ' +
    'fine detail does not.');
  return r.join(' ');
}

function wizVoorproefMaat() {
  var kaart = (typeof SIZE_MAP !== 'undefined' && SIZE_MAP[WIZ_VOORPROEF_MODEL]) || null;
  return (kaart && kaart[wizState.data.product.placement]) || '1024x1024';
}

async function wizVoorproef() {
  if (wizState.voorproefBezig) return;
  if (!wizState.data.review.visualDescription) {
    wizState.voorproefFout = 'Rory has not described the ad yet — describe it first, ' +
      'otherwise the preview is a guess at a guess.';
    return wizRender();
  }
  var apiKey = (window.__WG_TEAMSERVER ? 'teamserver'
    : ((document.getElementById('openai-key') || {}).value || '').trim());
  if (!apiKey) {
    wizState.voorproefFout = 'No OpenAI key set.';
    return wizRender();
  }
  wizState.voorproefBezig = true;
  wizState.voorproefFout = null;
  wizRender();
  var maat = wizVoorproefMaat();
  try {
    var data = await fetchJsonWithRetry((PROXY_BASE).replace(/\/$/, '') + '/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: WIZ_VOORPROEF_MODEL,
        prompt: wizVoorproefPrompt(),
        size: maat,
        quality: 'low',
        n: 1
      })
    });
    var b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) throw new Error('no image came back');
    wizState.voorproef = { b64: b64, model: WIZ_VOORPROEF_MODEL, size: maat, ts: Date.now() };
  } catch (e) {
    wizState.voorproefFout = 'The preview failed: ' + String((e && e.message) || e);
  }
  wizState.voorproefBezig = false;
  wizRender();
}

/* Het vak zelf. Zolang er geen voorproef is blijft de layout-indruk staan --
   die zegt tenminste iets over de volgorde van de elementen -- maar met een
   bijschrift dat hem noemt wat hij is. */
function wizVoorproefPaneel() {
  var d = wizState.data;
  if (wizState.voorproefBezig) {
    return wizPaneel('Visual preview',
      '<div class="wiz-vizdenkt">Drawing a rough preview of the blueprint…</div>');
  }
  if (wizState.voorproef) {
    var v = wizState.voorproef;
    return wizPaneel('Visual preview',
      '<div class="wiz-vizvoorbeeld"><img src="data:image/png;base64,' + v.b64 + '" alt=""></div>' +
      '<div class="wiz-vizvoorbeeld-bij">A rough preview of the blueprint, drawn at low quality ' +
      'on the cheapest model (' + wizEsc(v.model) + ', ' + wizEsc(v.size) + '). ' +
      'It shows the composition and whether the headline fits — not the finish. ' +
      'The three concepts come next, at your own quality setting.</div>' +
      '<div class="wiz-actions"><button type="button" class="wiz-btn ghost small" ' +
      'onclick="wizVoorproef()">Draw it again</button></div>');
  }

  var p = wizProduct();
  var refs = (p && typeof normalizeRefs === 'function') ? normalizeRefs(p.references) : null;
  var beeld = refs && ((refs.usage && refs.usage[0]) || (refs.lifestyle && refs.lifestyle[0]) || (refs.product && refs.product[0]));
  var h = '<div class="wiz-adpreview">' +
    (beeld ? '<div class="wiz-adpreview-beeld"><img src="' + beeld + '" alt=""></div>' : '') +
    '<div class="wiz-adpreview-tekst">' +
      '<div class="wiz-copy-headline">' + wizEsc(d.copy.headline) + '</div>' +
      (d.copy.supporting ? '<div class="wiz-copy-sub">' + wizEsc(d.copy.supporting) + '</div>' : '') +
      (d.copy.cta ? '<div class="wiz-copy-cta">' + wizEsc(d.copy.cta) + '</div>' : '') +
    '</div></div>';
  /* Precies zeggen wat dit is. "Visual preview" boven een packshot met de copy
     eronder leest als "zo wordt de advertentie", en dat is het niet. */
  h += '<div class="wiz-vizvoorbeeld-bij">This is the product photo from your library with the copy ' +
    'underneath — the order of the elements, not the ad. Draw a real preview to see the concept.</div>';
  if (wizState.voorproefFout) {
    h += '<div class="wiz-warn"><div class="wiz-warn-t">' + wizEsc(wizState.voorproefFout) + '</div></div>';
  }
  h += '<div class="wiz-actions"><button type="button" class="wiz-btn small" ' +
    'onclick="wizVoorproef()">Draw a preview of this blueprint</button></div>';
  return wizPaneel('Visual preview', h);
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
  if (wizRoryBezig()) return;
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
  /* Bij een redactioneel formaat komt de afzender erbij. Die staat niet in dit
     rijtje omdat hij alleen dan bestaat -- op een productposter is het geen
     gat maar een veld dat niet meedoet. */
  if (typeof wizNieuwsGaten === 'function') gaten = gaten.concat(wizNieuwsGaten());
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
  /* Ook dit doet Rory uit zichzelf zodra je de blueprint opent. Met de
     gedeelde vlag lag de hele stap stil zolang die beschrijving liep. */
  if (wizRoryBezig()) return;
  wizState.roryBezig = true;
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
    .finally(function () { wizState.roryBezig = false; wizRender(); });
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
  /* De nieuws- en artikelstijl staat NA de format-mode en gaat er dus boven:
     de format-mode zegt "opgemaakt als nieuwsartikel", dit zegt welk soort
     artikel, hoe het eruitziet en wat er niet op mag. */
  if (typeof wizNieuwsBrief === 'function') t += wizNieuwsBrief();

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
         'en geen andere persoon.\n' +
         /* En expliciet over het gezicht, want dat is wat er in de praktijk
            misgaat: het model maakt er een gladdere, jongere versie van en dan
            staat er een vreemde die op de founder lijkt. */
         'Het gezicht van de persoon op die foto is van een echt mens en blijft exact zoals ' +
         'het is: dezelfde trekken, dezelfde leeftijd, dezelfde huid. Beschrijf nooit een ' +
         'ander gezicht, een andere uitstraling of een "verzorgde versie" van hem.\n';
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
      /* Drie toestanden, en dat waren er twee te weinig. De kaart toonde
         altijd "no preview yet", ook terwijl er een beeld werd gemaakt. En
         omdat elke wizRender de kaart opnieuw opbouwt, veegde hij de
         laadstatus weg die generateImage er zelf in had gezet: van drie
         gestarte previews bleef er zichtbaar één over, namelijk de laatste,
         omdat daarna niets meer hertekende. */
      '<span class="wiz-concept-preview" id="gen-image-' + i + '">' +
        wizConceptBeeldvak(i) + '</span>' +
      '<span class="wiz-concept-body">' +
        '<span class="wiz-concept-h">' + wizEsc(c.headline_nl || '') + '</span>' +
        (c.hook_label_nl ? '<span class="wiz-concept-hook">' + wizEsc(c.hook_label_nl) + '</span>' : '') +
        (c.visual_nl ? '<span class="wiz-concept-vis">' + wizEsc(c.visual_nl) + '</span>' : '') +
        /* Een opnieuw geënsceneerd concept zegt dat zelf. Zonder deze regel
           lees je een scene die je nooit goedgekeurd hebt als de scene die
           Rory bedacht had. */
        (c.herstage_nl ? '<span class="wiz-concept-herstage">Restaged after the filter refusal: ' +
          wizEsc(c.herstage_nl) + '</span>' : '') +
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

/* Het beeldvak van een conceptkaart. Vier standen, en bij een filterweigering
   ook de enige knop die dan zin heeft.

   Het is een span met role=button en geen <button>: deze kaart IS al een knop
   en een knop in een knop is ongeldige html. stopPropagation hoort erbij,
   anders selecteer je het concept terwijl je op herstage drukt. */
function wizConceptBeeldvak(i) {
  if (wizHerstageBezig[i]) {
    return '<span class="wiz-concept-bezig"><span class="wiz-concept-spin"></span>' +
      '<span>Rory is restaging this scene…</span></span>';
  }
  if (wizBeeldBezig[i]) {
    return '<span class="wiz-concept-bezig"><span class="wiz-concept-spin"></span>' +
      '<span>Rendering…</span></span>';
  }
  var h = '<span class="wiz-concept-geenbeeld">' + wizBeeldStand(i) + '</span>';
  if (wizBeeldFilterGeweigerd(i)) {
    h += '<span class="wiz-concept-herstel" role="button" tabindex="0" ' +
      'onclick="event.stopPropagation();wizHerstage(' + i + ')">Restage this scene</span>';
  }
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
    ';base64,' + v.b64 + '">' + wizVersieBalk(i, st);
  return true;
}

/* Bladeren door de versies. Dit stond er als LABEL -- "version 2 of 2" -- en
   verder niets: na een verfijning was de vorige versie onbereikbaar, terwijl
   hij gewoon in state.generatedImages[i].versions staat. Je zag dat er twee
   waren en kon er maar één zien.

   Het zijn spans en geen knoppen, want in stap 8 zit dit vak in een button en
   een knop in een knop is ongeldige html. Vandaar ook stopPropagation: anders
   selecteer je het concept terwijl je terugbladert. */
function wizVersieBalk(i, st) {
  if (!st || !st.versions || st.versions.length < 2) return '';
  var nu = st.currentIndex || 0;
  var pijl = function (delta, teken, titel, uit) {
    return '<span class="wiz-beeld-pijl' + (uit ? ' uit' : '') + '" role="button" tabindex="0"' +
      (uit ? '' : ' onclick="event.stopPropagation();wizBeeldVersie(' + i + ',' + delta + ')"') +
      ' title="' + titel + '">' + teken + '</span>';
  };
  return '<span class="wiz-beeld-v">' +
    pijl(-1, '‹', 'previous version', nu <= 0) +
    '<span class="wiz-beeld-v-t">version ' + (nu + 1) + ' of ' + st.versions.length + '</span>' +
    pijl(1, '›', 'next version', nu >= st.versions.length - 1) +
    '</span>';
}

function wizBeeldVersie(i, delta) {
  var st = (state.generatedImages || {})[i];
  if (!st || !st.versions || !st.versions.length) return;
  var nieuw = (st.currentIndex || 0) + delta;
  if (nieuw < 0 || nieuw >= st.versions.length) return;
  st.currentIndex = nieuw;
  wizToonBeeld(i);
  /* Het bewerkpaneel toont wat er met DEZE versie gedaan is; blader je terug,
     dan hoort dat mee te bewegen. */
  if (typeof renderEditPanel === 'function') { try { renderEditPanel(i); } catch (e) { } }
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
/* Welke beelden er langer over doen dan gewoonlijk. Apart van 'bezig', want
   "hij loopt nog" en "hij loopt al twee minuten" vragen om een andere zin. */
var wizBeeldTraag = {};

/* De brug tussen de bewaarde concepten en de generator.
 *
 * De wizard bewaart zichzelf in localStorage; state.lastGenerated doet dat
 * niet en begint elke sessie op null. Gevolg: je komt terug op stap 8, ziet
 * je drie uitgewerkte concepten staan, drukt op "Generate 3 previews" en
 * krijgt "Work out the concepts first" -- terwijl ze er zichtbaar staan. Een
 * melding die je tegenspreekt op het scherm ernaast.
 *
 * De data is er wel: concepts.list IS de lijst variaties. Die hoort dus
 * hersteld te worden in plaats van geweigerd. Geeft terug of er nu iets
 * bruikbaars staat.
 *
 * Alleen aanvullen, nooit overschrijven: een lastGenerated uit Kopieer ad of
 * Itereren hoort niet door de wizard weggeduwd te worden. */
function wizHerstelGeneratie() {
  var lijst = (wizState.data.concepts.list || []);
  if (!lijst.length) return false;
  if (state.lastGenerated && (state.lastGenerated.variations || []).length) return true;
  state.lastGenerated = {
    variations: lijst.slice(),
    metadata: wizMetadata(),
    /* Zodat een latere generatie weet dat dit uit de bewaarde wizard komt en
       niet vers uit het model. */
    hersteld: true
  };
  if (!state.generatedImages || typeof state.generatedImages !== 'object') {
    state.generatedImages = {};
  }
  if (typeof wizZetBasisFotos === 'function') {
    wizZetBasisFotos(lijst.map(function (x, i) { return i; }));
  }
  return true;
}

/* Wat er op een kaart zonder beeld staat. Vier standen die er tot nu toe
   identiek uitzagen -- allemaal "no preview yet" -- en die om vier verschillende
   dingen vragen: wachten, geduld, opnieuw proberen, of iets repareren. */
function wizBeeldStand(i) {
  if (wizBeeldBezig[i]) {
    return wizBeeldTraag[i]
      ? 'still drawing — this is taking longer than usual'
      : 'drawing…';
  }
  var fout = (state.imageErrors || {})[i];
  if (fout) {
    /* "failed: Your request was rejected by the safety system. If you believe
       this is an error, contact us at help.openai.com and include the request
       ID req_54ab..." -- daar staat alles in behalve wat je eraan kunt doen.
       beeldWeigering zet er een diagnose voor in de plaats; herkent hij de
       zin niet, dan blijft de rauwe tekst staan. */
    var w = (typeof beeldWeigering === 'function') ? beeldWeigering(fout) : null;
    if (w && w.oorzaak !== 'onbekend') {
      return 'failed: ' + wizEsc(w.zin) + (w.verzoekId ? ' (' + wizEsc(w.verzoekId) + ')' : '');
    }
    return 'failed: ' + wizEsc(String(fout)).slice(0, 160);
  }
  return 'no preview yet';
}

/* Waar een filterweigering om vraagt is niet "nog een keer", want dezelfde
   prompt wordt opnieuw geweigerd. Hij vraagt om andere regie: dezelfde hoek,
   dezelfde belofte, een ander toneel. Dat is werk voor Rory en niet voor de
   knop 'opnieuw'. */
function wizBeeldFilterGeweigerd(i) {
  var fout = (state.imageErrors || {})[i];
  if (!fout || typeof beeldWeigering !== 'function') return false;
  var w = beeldWeigering(fout);
  return !!w && w.oorzaak === 'contentfilter';
}

/* ── Opnieuw ensceneren na een filterweigering ─────────────────────────────
 *
 * Wat OpenAI weigert is de SCENE, niet de hoek. Een man op de rand van een bed
 * met zijn shirt in zijn hand en een partner die vanuit bed toekijkt wordt als
 * expliciet gelezen; dezelfde belofte, staand voor een badkamerspiegel, komt er
 * gewoon doorheen. Twee van de drie concepten vielen daarop om, en op de kaart
 * stond alleen "failed".
 *
 * Dus: Rory herschrijft de enscenering van dit ene concept. Wat vast blijft is
 * de hook, de kop en de reden dat dit concept bestaat -- anders test je iets
 * anders dan je goedkeurde. Wat er verandert komt op de kaart te staan, want
 * een stilletjes vervangen scene is een tweede concept dat doet alsof het het
 * eerste is. */
var wizHerstageBezig = {};

function wizHerstageBrief(c, w) {
  return 'Een van de drie concepten is door het contentfilter van de beeldgenerator geweigerd. ' +
    'De hoek, de belofte en de kop zijn goedgekeurd en blijven staan; alleen de ENSCENERING moet anders.\n\n' +
    'De geweigerde melding: ' + (w && w.ruw ? w.ruw : 'rejected by the safety system') + '\n\n' +
    'Concept:\n' +
    'headline_nl: ' + (c.headline_nl || '') + '\n' +
    'hook_label_nl: ' + (c.hook_label_nl || '') + '\n' +
    'visual_nl (geweigerd): ' + (c.visual_nl || '') + '\n' +
    'image_prompt_en (geweigerd): ' + (c.image_prompt_en || '') + '\n\n' +
    'Wat een beeldfilter laat vallen: een ontkleed of half ontkleed lichaam in of op een bed, ' +
    'een tweede persoon die vanuit bed toekijkt, aanraking tussen ontklede personen, een ' +
    'slaapkamer als decor bij bloot. Wat wel doorkomt: dezelfde belofte in een badkamer, voor ' +
    'een spiegel, staand, aangekleed of met alleen de romp in beeld buiten een slaapkamercontext.\n\n' +
    'Herschrijf de enscenering zo dat het beeld dezelfde boodschap draagt en er wel doorheen komt. ' +
    'Verzwak de hoek niet en verander de kop niet.\n\n' +
    'Antwoord met UITSLUITEND JSON:\n' +
    '{"visual_nl":"de nieuwe scene in het Nederlands","image_prompt_en":"de volledige nieuwe beeldprompt in het Engels, een regel",' +
    '"wat_veranderde_nl":"een zin: wat er aan het toneel veranderd is en wat gelijk bleef"}';
}

function wizHerstage(i) {
  if (wizHerstageBezig[i] || wizBeeldBezig[i]) return;
  var lijst = wizState.data.concepts.list || [];
  var c = lijst[i];
  if (!c) return;
  var fout = (state.imageErrors || {})[i];
  var w = (typeof beeldWeigering === 'function') ? beeldWeigering(fout) : null;
  var sleutel = (window.__WG_TEAMSERVER ? 'teamserver' : ((document.getElementById('anthropic-key') || {}).value || ''));
  if (!sleutel) { if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true); return; }

  wizHerstageBezig[i] = true;
  wizRender();
  wizCall(SYSTEM_PROMPT, [{ role: 'user', content: wizHerstageBrief(c, w) }], 2000)
    .then(function (data) {
      var obj = wizParseJson(wizTextOf(data));
      if (!obj || !obj.image_prompt_en) throw new Error('no new staging came back');
      /* De oude scene bewaren, niet overschrijven: je moet kunnen zien waar dit
         vandaan komt, net als bij de beeldversies. */
      c.visual_nl_geweigerd = c.visual_nl || '';
      c.visual_nl = obj.visual_nl || c.visual_nl;
      c.image_prompt_en = obj.image_prompt_en;
      c.herstage_nl = obj.wat_veranderde_nl || '';
      /* state.lastGenerated draagt dezelfde objecten, maar niet gegarandeerd:
         na een herstel uit localStorage is het een kopie. Dus expliciet. */
      if (state.lastGenerated && state.lastGenerated.variations &&
          state.lastGenerated.variations[i] &&
          state.lastGenerated.variations[i] !== c) {
        state.lastGenerated.variations[i].visual_nl = c.visual_nl;
        state.lastGenerated.variations[i].image_prompt_en = c.image_prompt_en;
      }
      if (state.imageErrors) delete state.imageErrors[i];
      wizSave();
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Restaging failed: ' + err.message, true);
    })
    .finally(function () {
      delete wizHerstageBezig[i];
      wizRender();
      /* Alleen tekenen als het gelukt is: bij een mislukking staat de oude
         weigering er nog en zou dit hem meteen weer laten weigeren. */
      if (!(state.imageErrors || {})[i]) wizPreview(i);
    });
}

function wizPreview(i) {
  if (!wizHerstelGeneratie()) {
    if (typeof toast === 'function') toast('Work out the concepts first', true); return;
  }
  if (typeof generateImage !== 'function') return;
  wizBeeldBezig[i] = true;
  delete wizBeeldTraag[i];
  if (state.imageErrors) delete state.imageErrors[i];
  wizRender();
  generateImage(i);
  wizWachtOpBeeld(i);
}


/* De beeldgenerator meldt zichzelf niet af, dus kijken we of het beeld er is.
   Elke seconde.

   Dit stopte na twee minuten en tekende dan gewoon opnieuw -- waarna de kaart
   terugviel op "no preview yet", precies dezelfde tekst als "nog niet
   geprobeerd". Drie kaarten tegelijk door één proxy halen die twee minuten
   makkelijk, dus dat gebeurde vaak, en het las als een knop die je nog moest
   indrukken.

   Nu: vijf minuten volhouden, en na twee minuten zeggen dat het langer duurt
   dan gewoonlijk in plaats van te doen alsof er niets loopt. Loopt het écht
   mis, dan staat de reden inmiddels in state.imageErrors en toont de kaart
   die. */
var WIZ_BEELD_TRAAG = 120;
var WIZ_BEELD_OP = 300;

function wizWachtOpBeeld(i, pogingen) {
  var n = pogingen || 0;
  if (!wizBeeldBezig[i]) return;
  var klaar = !!((state.generatedImages || {})[i] || {}).versions;
  var mislukt = !!((state.imageErrors || {})[i]);
  if (klaar || mislukt || n > WIZ_BEELD_OP) {
    delete wizBeeldBezig[i];
    if (!klaar && !mislukt) {
      /* Opgegeven zonder uitslag. Dat is zelf een uitslag en hoort er te
         staan, anders is hij niet te onderscheiden van niet begonnen. */
      if (!state.imageErrors) state.imageErrors = {};
      state.imageErrors[i] = 'Timed out after five minutes. The request may still be running at ' +
        'OpenAI — try again, or generate this one on its own.';
    }
    wizRender();
    return;
  }
  /* Eén keer hertekenen zodra het langer duurt dan gewoonlijk, zodat de kaart
     dat kan zeggen. Niet elke seconde: dat zou de knoppen onder je vinger weg
     tekenen. */
  if (n === WIZ_BEELD_TRAAG) { wizBeeldTraag[i] = true; wizRender(); }
  setTimeout(function () { wizWachtOpBeeld(i, n + 1); }, 1000);
}

/* Alle ontbrekende previews tegelijk. Niet door wizPreview drie keer aan te
   roepen: die tekent zelf, en elke herteken bouwt de kaarten opnieuw op --
   waarmee de laadstatus van de vorige twee verdween. Dus: eerst alle vlaggen
   zetten, EEN keer tekenen, en dan pas starten. */
function wizPreviewAll() {
  if (!wizHerstelGeneratie()) {
    if (typeof toast === 'function') toast('Work out the concepts first', true);
    return;
  }
  if (typeof generateImage !== 'function') return;
  var n = (wizState.data.concepts.list || []).length;
  var beelden = (state && state.generatedImages) || {};
  var todo = [];
  for (var i = 0; i < n; i++) {
    if (beelden[i]) continue;
    wizBeeldBezig[i] = true;
    delete wizBeeldTraag[i];
    if (state.imageErrors) delete state.imageErrors[i];
    todo.push(i);
  }
  if (!todo.length) return;
  wizRender();
  todo.forEach(function (i) { generateImage(i); wizWachtOpBeeld(i); });
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
  if (sel == null) return [];
  /* Ook hier eerst herstellen: kom je terug in een bewaarde sessie, dan staan
     de concepten er wel en state.lastGenerated niet, en dan levert deze
     functie een lege lijst -- waarna stap 9 doet alsof er niets is. */
  if (!wizHerstelGeneratie()) return [];
  if (!state.lastGenerated || !state.lastGenerated.variations) return [];
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

/* De spreiding over de drie takes, en waarom die niet vast kan staan.
 *
 * Er stond een vaste verdeling: take 1 een mens, take 2 een macro zonder
 * mens, take 3 het product met labels. Prima voor een productadvertentie, en
 * verwoestend voor een founder-ad: twee van de drie takes gooien dan precies
 * datgene uit beeld waar het concept om draait. Je koos een oprichter in een
 * magazijn en kreeg een macro van een scheerkop terug.
 *
 * De spreiding hoort dus te volgen wat er vastligt. Staat er een mens in de
 * visuele richting, dan blijft die mens in alle drie -- wat varieert is zijn
 * houding, blik, afstand en omgeving. Het formaat (redactioneel, nieuws)
 * blijft ook staan: dat is de reden dat het concept werkte. */
function wizTakeSpreiding() {
  var d = wizState.data;
  var mens = d.visual.humanPresence;
  var f = wizFormat();
  var formaat = f ? f.name : '';
  var persoon = (typeof WIZ_PERSONEN !== 'undefined' && WIZ_PERSONEN[mens])
    ? WIZ_PERSONEN[mens].wie : null;

  if (!persoon) {
    return 'Default spread: take 1 a credible person holding or using the product, looking at ' +
      'camera, editorial framing; take 2 an extreme macro of the area or the mechanism ' +
      'the claim is about, no person; take 3 the product itself with callouts or labels ' +
      'pointing at what matters.\n';
  }

  return 'LOCKED, because it is the reason this concept works: ' + persoon +
    ' is in frame in ALL THREE takes' +
    (formaat ? ', and all three keep the ' + formaat + ' treatment' : '') +
    '. Do not drop the person for a macro or a packshot in one of them: that is not a ' +
    'variation of this idea, it is a different ad.\n' +
    'What varies instead: the pose, the expression, the distance and the setting.\n' +
    'Default spread: take 1 ' + persoon + ' facing camera, holding the product, mid-shot, ' +
    'the setting doing the talking; take 2 the same person mid-gesture or mid-sentence, ' +
    'looking away from camera, closer in, as if caught during the interview; take 3 the ' +
    'same person wider in their own environment, the product smaller in frame but still ' +
    'clearly held, more of the place around them.\n' +
    'Same person throughout: same face, same build, same clothing register. A different ' +
    'man in take 2 reads as a stock photo and undoes the whole reason for using a real ' +
    'founder.\n';
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
         wizTakeSpreiding() +
         'Three colourways of the same shot is not a test, it is a mood board. If two takes ' +
         'would look alike in a feed, change one of them.\n\n';
    if (typeof wizLeerBrief === 'function') t += wizLeerBrief();
    /* De zelfcontrole hoorde hier ook te staan en stond er niet. Zolang de
       hoekpass de standaard was viel dat niet op, maar de visuele pass is nu
       wat je standaard draait -- en dan levert de generator drie beelden af
       die nooit tegen de acht eigenschappen zijn gehouden. */
    if (typeof wizZelfcontrole === 'function') t += wizZelfcontrole();
    /* Ook de variaties zijn nieuwsbeelden. Zonder deze regels houdt take 1 de
       krantenopmaak vast en zakken take 2 en 3 terug naar een gewone
       productadvertentie -- precies de klacht dat de derde variatie niet meer
       op een nieuwsartikel leek. */
    if (typeof wizNieuwsBrief === 'function') t += wizNieuwsBrief();
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
       '2. The visual: a different scene, different framing and a different text layout. ' +
       wizTakeSpreiding() +
       '3. The call to action, when the wording genuinely follows from the headline. ' +
       'Same offer and same destination, different words on the button.\n' +
       '4. The vibe: three takes that could not be mistaken for each other in a feed.\n\n' +
       'Three macro shots of the same product head is a failure, even with different ' +
       'headlines. If two takes would look alike, change one of them.\n\n';

  if (typeof wizLeerBrief === 'function') t += wizLeerBrief();
  if (typeof wizZelfcontrole === 'function') t += wizZelfcontrole();
  if (typeof wizNieuwsBrief === 'function') t += wizNieuwsBrief();

  t += '\nPlacement: ' + wizLabel('placement', d.product.placement) + '.\n';
  t += 'Return exactly 3 variations in the JSON shape you always use.\n';
  return t;
}

function wizGenerateTakes() {
  /* Stil terugkeren op een lopende beurt betekent: je drukt, er gebeurt
     niets, en je weet niet of hij bezig is of stuk. Zeg het gewoon. */
  if (wizState.busy) {
    if (typeof toast === 'function') toast('Rory is still working on the previous round', true);
    return;
  }
  if (!wizHerstelGeneratie()) {
    if (typeof toast === 'function') toast('Work out the concepts first', true); return;
  }
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
      /* Alle drie de vlaggen zetten, EEN keer tekenen, dan pas starten.
         wizPreview tekent zelf, en drie keer tekenen veegt de laadstatus van
         de vorige twee weg -- dezelfde fout die de knop "Generate 3 previews"
         had. */
      idx.forEach(function (i) { wizBeeldBezig[i] = true; });
      wizRender();
      idx.forEach(function (i) { generateImage(i); wizWachtOpBeeld(i); });
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

  /* Wat er nu loopt, boven de drie kaarten. Zonder dit was er tijdens het
     opnieuw uitwerken NERGENS een teken: de knop stond stil op disabled, en
     de "Working…"-tekst in het beeldvak verschijnt alleen als dat vak leeg
     is -- dus met drie bestaande beelden zag je precies niets gebeuren. */
  if (wizState.busy) {
    h += '<div class="iw2-bezig" role="status" aria-live="polite">' +
      '<div class="iw2-bezig-balk"><span></span></div>' +
      '<div class="iw2-bezig-tekst">Rory is working out three new variations. ' +
      'The pictures follow once the three executions are there.</div></div>';
  }

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
      '<div class="wiz-final-preview' + (wizBewerkBezig === i ? ' bewerkt' : '') + '" ' +
      'id="gen-image-' + i + '">' +
        (heeft ? '' :
          '<span class="wiz-take-leeg">' +
          (wizBeeldBezig[i] ? 'Drawing this one…' : (wizState.busy ? 'Working…' : 'No image yet')) +
          '</span>') +
      '</div>' +
      /* De lopende bewerking als eigen regel onder het beeld. In het vak zelf
         zou hij het beeld overschrijven dat je juist wilt vergelijken met wat
         eruit komt. */
      (wizBewerkBezig === i
        ? '<div class="wiz-take-bewerkt"><span class="wiz-concept-spin"></span>' +
          '<span>Applying your change…</span></div>'
        : '') +
      (heeft || wizBeeldBezig[i] ? '' :
        '<button type="button" class="wiz-linkbtn wiz-take-opnieuwbeeld" ' +
        'onclick="wizPreview(' + i + ')">Generate this picture</button>') +
      (v.headline_nl ? '<div class="wiz-take-h">' + wizEsc(v.headline_nl) + '</div>' : '') +
      (v.cta_nl ? '<div class="wiz-take-cta">' + wizEsc(v.cta_nl) + '</div>' : '') +
      (v.visual_nl ? '<div class="wiz-take-v">' + wizEsc(v.visual_nl) + '</div>' : '') +
      /* "Choose this one" suggereerde dat de andere twee afvallen, en dat is
         niet hoe je ze inzet: alle drie gaan als ad set mee. Deze knop kiest
         alleen welke je nu verfijnt. */
      '<button type="button" class="wiz-take-kies' + (aan ? ' on' : '') + '" ' +
      'onclick="wizPickTake(' + i + ')">' + (aan ? 'Refining this one' : 'Refine this one') + '</button>' +
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
/* Foto's die bij DEZE aanpassing horen. "Change model" met alleen een
   beschrijving is een gok: hoe iemand eruit moet zien is nu juist iets wat je
   laat zien in plaats van uitschrijft. Deze leven per bewerking en niet op de
   ad, want ze horen bij die ene wijziging. */
var wizTweakFotos = [];

function wizTweakFotoToe(dataUrls) {
  var nieuw = (dataUrls || []).filter(Boolean).slice(0, 4 - wizTweakFotos.length);
  if (!nieuw.length) return;
  wizTweakFotos = wizTweakFotos.concat(nieuw);
  wizRender();
}
function wizTweakFotoWeg(i) { wizTweakFotos.splice(i, 1); wizRender(); }
function wizTweakFotoLees(files) {
  var lijst = [].slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
  return Promise.all(lijst.map(function (f) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { res(null); };
      r.readAsDataURL(f);
    });
  })).then(function (urls) { wizTweakFotoToe(urls); return urls.filter(Boolean).length; });
}
function wizTweakDrop(e) {
  e.preventDefault(); e.stopPropagation();
  if (e.currentTarget) e.currentTarget.classList.remove('over');
  if (e.dataTransfer) wizTweakFotoLees(e.dataTransfer.files);
}
function wizTweakKies(e) { wizTweakFotoLees(e.target.files); e.target.value = ''; }

function wizTweakPaneel() {
  var t = WIZ_TWEAKS.filter(function (x) { return x.key === wizState.tweakOpen; })[0];
  if (!t) return '';
  return '<div class="wiz-veldpaneel">' +
    '<div class="wiz-veldpaneel-t">' + wizEsc(t.vraag) + '</div>' +
    '<textarea id="wiz-tweak-in" rows="2" placeholder="Leave empty to let Rory decide."></textarea>' +
    /* En de andere helft van het antwoord: laten zien in plaats van
       beschrijven. "Change model" met alleen woorden is een gok. */
    '<div class="wiz-tweakfotos"><div class="wiz-tweakfotos-k">Or show it</div>' +
    '<div class="wiz-tweakfotos-rij">' +
    wizTweakFotos.map(function (src, i) {
      return '<div class="wiz-ref aan eigen"><img src="' + wizEsc(src) + '" alt="">' +
        '<button type="button" class="wiz-ref-weg" onclick="wizTweakFotoWeg(' + i + ')" ' +
        'aria-label="Verwijderen">×</button></div>';
    }).join('') +
    (wizTweakFotos.length < 4
      ? '<label class="wiz-refdrop" ondrop="wizTweakDrop(event)" ' +
        'ondragover="wizRefOver(event)" ondragleave="wizRefUit(event)">' +
        '<input type="file" accept="image/*" multiple onchange="wizTweakKies(event)" hidden>' +
        '<span class="wiz-refdrop-plus">+</span>' +
        '<span class="wiz-refdrop-tekst">Drop a photo<br>or click</span></label>'
      : '') +
    '</div></div>' +
    '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn primary small" onclick="wizTweak()"' +
    (wizBewerkBezig ? ' disabled' : '') + '>' +
    (wizBewerkBezig ? 'Applying…' : 'Apply this change') + '</button>' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizOpenTweak(null)">Cancel</button>' +
    '</div></div>';
}

function wizOpenTweak(key) {
  wizState.tweakOpen = (wizState.tweakOpen === key) ? null : key;
  wizRender();
}

/* Loopt er een bewerking, en op welke take. Zonder dit gebeurde er na
   "Apply this change" zichtbaar niets: de bewerking startte wel, maar de
   wizard hertekende meteen daarna en veegde de laadstatus weg die het
   bewerkpaneel in het beeldvak had gezet -- en er kwam pas weer iets in beeld
   als je toevallig zelf iets aanklikte. Precies dezelfde fout als bij de drie
   previews. */
var wizBewerkBezig = null;

function wizTweak() {
  /* Bewerken gaat over de take die je gekozen hebt, niet over het concept:
     er staan er drie, en zonder die keuze zou de wizard er zelf een aanwijzen. */
  var sel = wizHuidigeTake();
  var t = WIZ_TWEAKS.filter(function (x) { return x.key === wizState.tweakOpen; })[0];
  if (sel == null || !t) return;
  if (wizBewerkBezig != null) return;
  var st = (state.generatedImages || {})[sel];
  if (!st || !st.versions || !st.versions.length) {
    if (typeof toast === 'function') toast('Generate the takes first, then adjust one', true);
    return;
  }
  var el = document.getElementById('wiz-tweak-in');
  var extra = el ? el.value.trim() : '';
  var instructie = t.instructie + (extra ? (' Requested change: ' + extra) : '');
  if (!state.pendingEdits || typeof state.pendingEdits !== 'object') state.pendingEdits = {};
  state.pendingEdits[sel] = [{ type: 'adjust', text: instructie }];

  /* De foto's bij deze wijziging doorgeven aan het bewerkpaneel, dat ze als
     visuele referentie meestuurt. */
  if (wizTweakFotos.length) {
    if (!state.pendingEditRefs || typeof state.pendingEditRefs !== 'object') state.pendingEditRefs = {};
    state.pendingEditRefs[sel] = wizTweakFotos.map(function (src) {
      var m = String(src).match(/^data:([^;]+);base64,(.+)$/);
      return m ? { mimeType: m[1], b64: m[2] } : null;
    }).filter(Boolean);
  }

  wizState.tweakOpen = null;
  if (typeof applyCombinedEdits !== 'function') {
    if (typeof toast === 'function') toast('The edit panel is not available', true);
    wizRender();
    return;
  }
  /* Hoeveel versies er nu zijn: aan de groei daarvan zien we dat de bewerking
     klaar is. Wachten op de belofte kan niet -- applyCombinedEdits geeft er
     geen terug die iets zegt over het resultaat. */
  var voor = st.versions.length;
  wizBewerkBezig = sel;
  wizTweakFotos = [];
  wizRender();
  applyCombinedEdits(sel);
  wizWachtOpBewerking(sel, voor, 0);
}

/* Wachten tot er een versie bij is gekomen, en dan pas hertekenen. */
function wizWachtOpBewerking(sel, voor, n) {
  if (wizBewerkBezig !== sel) return;
  var st = (state.generatedImages || {})[sel] || {};
  var nu = (st.versions || []).length;
  if (nu > voor || n > 150) {
    wizBewerkBezig = null;
    wizRender();
    if (nu > voor && typeof toast === 'function') toast('Change applied');
    return;
  }
  setTimeout(function () { wizWachtOpBewerking(sel, voor, n + 1); }, 1000);
}

/* Einde van de negen stappen: de ad gaat naar de bibliotheek, waar bewaarde
   ads horen, en je gaat mee zodat je ziet dat hij er staat.

   Dit ging eerst naar het oude resultatenscherm in de rechterkolom. Dat scherm
   hoort bij het klassieke formulier en is in Statics weg; de bibliotheek heeft
   hetzelfde bewerkpaneel en de versiegeschiedenis eromheen. */
function wizHandOff() {
  if (!state.lastGenerated) { if (typeof toast === 'function') toast('Nothing to save yet', true); return; }
  /* ALLE DRIE gaan de bibliotheek in, niet alleen de gekozen.
     Dit sloeg er eerst één op, met als redenering dat er maar één kan lopen.
     Dat klopt niet met hoe je ze inzet: een concept is een ad set, en die
     krijgt drie variaties die naast elkaar draaien. Sla je er één op, dan
     gooi je twee gegenereerde beelden weg die je zelf hebt betaald, en je
     kunt achteraf niet meer zien welke drie bij elkaar hoorden.

     De gekozen blijft wel bijzonder: die staat vooraan en is degene die je
     aan het verfijnen bent. */
  var idx = wizTakeIndexen();
  var metBeeld = idx.filter(function (i) {
    var st = (state.generatedImages || {})[i];
    return !!(st && st.versions && st.versions.length);
  });
  if (!metBeeld.length) { if (typeof toast === 'function') toast('Generate the takes first', true); return; }
  /* De gekozen vooraan, zodat hij in de bibliotheek de eerste van de groep is. */
  var sel = wizHuidigeTake();
  if (sel != null && metBeeld.indexOf(sel) > 0) {
    metBeeld = [sel].concat(metBeeld.filter(function (i) { return i !== sel; }));
  }
  wizState.done.generate = true;
  wizSave();
  var klaar = function () {
    if (typeof switchMainTab === 'function') switchMainTab('library');
    if (typeof toast === 'function') {
      toast(metBeeld.length === 1
        ? 'Saved to the library, your wizard decisions are kept'
        : 'All ' + metBeeld.length + ' variations saved as one ad set');
    }
  };
  if (typeof saveToLibraryFromCard !== 'function') { klaar(); return Promise.resolve(); }
  /* Achter elkaar en niet tegelijk: saveToLibraryFromCard zet de batch-id op
     de eerste die binnenkomt, en die id moet voor alle drie dezelfde zijn --
     dat is wat ze in de bibliotheek tot één ad set maakt. */
  return metBeeld.reduce(function (keten, i) {
    return keten.then(function () {
      var r = saveToLibraryFromCard(i);
      return (r && typeof r.then === 'function') ? r : Promise.resolve();
    });
  }, Promise.resolve()).then(klaar, klaar);
}

window.wizRender_review = wizRender_review; window.wizRender_concepts = wizRender_concepts;
window.wizHerstage = wizHerstage; window.wizHerstageBrief = wizHerstageBrief;
window.wizConceptBeeldvak = wizConceptBeeldvak; window.wizBeeldFilterGeweigerd = wizBeeldFilterGeweigerd;
window.wizVoorproef = wizVoorproef; window.wizVoorproefPaneel = wizVoorproefPaneel;
window.wizVoorproefPrompt = wizVoorproefPrompt; window.wizVoorproefMaat = wizVoorproefMaat;
window.WIZ_VOORPROEF_MODEL = WIZ_VOORPROEF_MODEL;
window.wizRender_generate = wizRender_generate; window.wizBestemmingPaneel = wizBestemmingPaneel;
window.wizAfter_review = wizAfter_review; window.wizAfter_concepts = wizAfter_concepts;
window.wizAfter_generate = wizAfter_generate;
window.wizDescribeVisual = wizDescribeVisual; window.wizApproveBlueprint = wizApproveBlueprint;
window.wizGenerateConcepts = wizGenerateConcepts; window.wizPickConcept = wizPickConcept;
window.wizPreview = wizPreview; window.wizPreviewAll = wizPreviewAll; window.wizHerstelGeneratie = wizHerstelGeneratie;
window.wizBeeldVersie = wizBeeldVersie; window.wizVersieBalk = wizVersieBalk;
window.wizBeeldStand = wizBeeldStand;
window.wizTweak = wizTweak; window.wizOpenTweak = wizOpenTweak;
window.wizTweakFotoToe = wizTweakFotoToe;
window.wizTweakFotoWeg = wizTweakFotoWeg; window.wizTweakFotoLees = wizTweakFotoLees;
window.wizTweakDrop = wizTweakDrop; window.wizTweakKies = wizTweakKies;
window.wizWachtOpBewerking = wizWachtOpBewerking; window.wizHandOff = wizHandOff;
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
