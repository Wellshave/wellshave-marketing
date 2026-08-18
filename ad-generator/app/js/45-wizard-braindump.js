/* Static Ad Wizard — de brain dump op stap 1.
 *
 * De derde weg naar dezelfde blueprint, en de snelste.
 *
 *   De negen stappen zijn klikken. Het interview is praten. Dit is één keer
 *   opschrijven wat je in je hoofd hebt, en dan staat de hele werkwijze er.
 *
 * Waarom dit ernaast bestaat: soms weet je het al. Je hebt een vondst, een
 * seizoen, een irritatie van een klant, een deal die morgen ingaat -- en dan is
 * zowel een formulier met negen kopjes als een gesprek van acht vragen een
 * omweg. Je wilt het opschrijven zoals je het aan een collega zou zeggen.
 *
 * Drie regels, en ze zijn allemaal een reactie op hoe dit fout kan gaan:
 *
 *   1. Alles wat Rory invult is een VOORSTEL met een reden erbij. De reden
 *      staat naast het besluit, niet in een samenvatting eronder -- anders is
 *      het een zwarte doos die je moet vertrouwen, en dat is precies wat een
 *      strateeg niet hoort te vragen.
 *
 *   2. Wat er niet in staat, blijft leeg. Een brain dump van één zin bevat geen
 *      persona-keuze, en dan is een ingevulde persona een verzinsel dat er
 *      uitziet als een besluit. Wat hij openliet staat er apart bij, met de
 *      reden.
 *
 *   3. Hij vult dezelfde velden als de andere twee wegen, via wizSet en met de
 *      grens van wizZetGevalideerd. Geen vierde administratie.
 *
 * TAAL: interface Engels, commentaren Nederlands.
 */

var wizBd = {
  tekst: '',
  bezig: false,
  /* Wat Rory ervan maakte: { gezet: [{veld, waarde, waarom}], open: [{veld,
     waarom}], conflicten: [...], samenvatting } */
  uitslag: null,
  toelichtingOpen: false
};

/* ── De opdracht ────────────────────────────────────────────────────────── */

function wizBdBrief() {
  var t = 'A marketer just typed what is in their head. Turn it into a complete ' +
          'creative decision set for ONE static ad, and say why for every single choice.\n\n';

  t += 'THE BRAIN DUMP (verbatim, do not translate it):\n"""\n' + wizBd.tekst + '\n"""\n\n';

  t += 'HOW TO READ IT\n' +
       '1. Time context first. A season, an event, a deadline (World Cup, Black Friday, ' +
       "Father's Day, tomorrow) decides whether this is seasonal and which funnel stage " +
       'fits. It also answers "why now", which is the cheapest performance lever there is.\n' +
       '2. Funnel stage. Does this audience know the brand yet? Cold reach, consideration, ' +
       'conversion, or retargeting.\n' +
       '3. Awareness AND sophistication. What does this reader already know (how directly ' +
       'may you speak), and how many times has this market heard this claim (what kind of ' +
       'claim is still believed). Both, always. One without the other is worse than neither, ' +
       'because it looks finished.\n' +
       '4. The angle, and which of the five ways of being different it uses: a new ' +
       'mechanism, exaggerated execution, a different avatar, a different desire, a ' +
       'different creative style. If you cannot name one, the concept is not ready.\n' +
       '5. Persona matching. Only if the text points at a specific group. Never pick a ' +
       'persona because the list has one.\n' +
       '6. Conflicts. Contradictory signals (a premium feeling plus 70% off, a cold audience ' +
       'plus an offer-led headline) get flagged with a proposed resolution, not silently ' +
       'averaged out.\n\n';

  t += 'WHAT YOU MAY NOT DO\n' +
       'Do not fill a field the text gives you no ground for. An empty field is visible and ' +
       'fixable; an invented one looks like a decision and is not. Judgement fields ' +
       '(persona, awareness, sophistication) need a reason you can point at in the text, in ' +
       'the product data or in the customer research. If you have none, leave it open and ' +
       'say what you would need to know.\n\n';

  if (typeof wizLeerBrief === 'function') t += wizLeerBrief();

  /* De keuzelijsten erbij, met de exacte waarden. Anders komt er iets terug wat
     de wizard niet kent en is het veld formeel gevuld maar feitelijk leeg. */
  t += '\nALLOWED VALUES (use these exact strings)\n';
  t += 'product.funnel: ' + (WIZ_FUNNELS || []).map(function (o) { return o.value; }).join(', ') + '\n';
  t += 'product.placement: ' + (WIZ_PLACEMENTS || []).map(function (o) { return o.value; }).join(', ') + '\n';
  t += 'audience.awareness: ' + (WIZ_AWARENESS || []).map(function (o) { return o.value; }).join(', ') + '\n';
  t += 'audience.sophistication: ' + (WIZ_SOPHISTICATION || []).map(function (o) {
    return o.value + ' (' + o.label + ')'; }).join(', ') + '\n';
  t += 'strategy.differentiation: ' + (WIZ_DIFFERENTIATION || []).map(function (o) { return o.value; }).join(', ') + '\n';
  (typeof WIZ_VISUAL !== 'undefined' ? WIZ_VISUAL : []).forEach(function (g) {
    if (!g.hoofd) return;
    t += 'visual.' + g.field + ': ' + g.opts.map(function (o) { return o.value; }).join(', ') + '\n';
  });

  var producten = (state.products || []);
  if (producten.length) {
    t += '\nPRODUCTS (use the exact id)\n';
    producten.forEach(function (p) { t += '- id=' + p.id + ' | ' + p.name + '\n'; });
  }
  var personas = (state.personas || []);
  if (personas.length) {
    t += '\nPERSONAS (use the exact id, or leave empty)\n';
    personas.forEach(function (p) {
      t += '- id=' + p.id + ' | ' + p.name + ' | ' + ((p.description || '').slice(0, 90)) + '\n';
    });
  }
  if (typeof AD_FORMATS !== 'undefined' && AD_FORMATS.length) {
    t += '\nFORMATS (use the exact id)\n';
    AD_FORMATS.slice(0, 42).forEach(function (f) { t += '- id=' + f.id + ' | ' + f.name + '\n'; });
  }

  t += '\nANSWER with strict JSON, no markdown fences:\n' +
       '{"decisions":[{"field":"audience.sophistication","value":"s3",' +
       '"why":"one sentence, in terms of the market and the text, not the mechanics"}],' +
       '"open":[{"field":"audience.personaId","why":"what you would need to know"}],' +
       '"conflicts":[{"what":"the two signals that fight","resolution":"what you propose"}],' +
       '"summary":"two or three sentences: what this ad is and why it should work"}\n' +
       'Fields you may set: product.productId, product.funnel, product.placement, ' +
       'audience.personaId, audience.awareness, audience.sophistication, strategy.goal, ' +
       'strategy.theme, strategy.angleType, strategy.differentiation, strategy.mechanism, ' +
       'strategy.marketingAngle, strategy.messaging, strategy.desire, strategy.ultimateDesire, ' +
       'strategy.timing, strategy.pain, strategy.proof, strategy.objection, format.formatId, ' +
       'visual.composition, visual.humanPresence, visual.scene, visual.mood, copy.direction, ' +
       'copy.headline, copy.supporting, copy.cta, copy.removed.\n' +
       'Write the ad copy itself (headline, supporting, cta) in the language of the brand and ' +
       'its customer research. Everything you address to the user is English.';
  return t;
}

/* ── Uitvoeren ──────────────────────────────────────────────────────────── */

function wizBdLees() {
  var el = document.getElementById('wiz-bd-in');
  return el ? String(el.value || '').trim() : '';
}

function wizBdAnalyse() {
  if (wizBd.bezig) return;
  var tekst = wizBdLees();
  if (!tekst) {
    if (typeof toast === 'function') toast('Type your idea first', true);
    return;
  }
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true);
    return;
  }
  wizBd.tekst = tekst;
  wizBd.bezig = true;
  wizBd.uitslag = null;
  wizRender();

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  wizCall(WIZ_RORY_SYSTEM, [{ role: 'user', content: ctx.text + '\n\n' + wizBdBrief() }], 3000)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (!o || !o.decisions || !o.decisions.length) throw new Error('nothing came back');
      wizBd.uitslag = wizBdToepassen(o);
      wizSave();
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Brain dump failed: ' + err.message, true);
    })
    .finally(function () { wizBd.bezig = false; wizRender(); });
}

/* Zetten wat er terugkomt, en onthouden wat er geweigerd is.
 *
 * Geweigerd is niet hetzelfde als niet-teruggekomen, en het verschil hoort
 * zichtbaar te zijn: een veld dat Rory openliet is een oordeel, een veld dat de
 * wizard weigerde is een fout in de aanroep. Ze in één lijst gooien maakt de
 * tweede onvindbaar. */
function wizBdToepassen(o) {
  var gezet = [], geweigerd = [];

  (o.decisions || []).forEach(function (b) {
    var d = String(b.field || '').split('.');
    if (d.length !== 2 || !wizState.data[d[0]] || !(d[1] in wizState.data[d[0]])) {
      geweigerd.push({ veld: b.field, reden: 'the wizard has no such field' });
      return;
    }
    var ok = (typeof wizZetGevalideerd === 'function')
      ? wizZetGevalideerd(d[0], d[1], b.value, 'rory')
      : false;
    if (!ok) {
      geweigerd.push({ veld: b.field, reden: 'value "' + b.value + '" is not one this field accepts' });
      return;
    }
    gezet.push({ veld: b.field, waarde: b.value, waarom: b.why || '' });
  });

  /* De stappen die hierdoor compleet zijn geworden staan af: je hoeft ze niet
     nog een keer langs te lopen om verder te mogen. */
  ['product', 'audience', 'strategy', 'format', 'visual', 'copy'].forEach(function (k) {
    if (wizStepComplete(k)) wizState.done[k] = true;
  });

  return {
    gezet: gezet, geweigerd: geweigerd,
    open: (o.open || []).map(function (x) { return { veld: x.field, waarom: x.why || '' }; }),
    conflicten: o.conflicts || [],
    samenvatting: o.summary || ''
  };
}

/* Doorlopen na de analyse. Is alles er, dan naar de blueprint: dat is het punt
   waarop je in één blik ziet wat er besloten is. Ontbreekt er iets, dan naar de
   eerste stap die nog open staat -- de poort zou je daar toch heen sturen. */
function wizBdNaarBlueprint() {
  var eerste = (typeof wizBlokkerendeStap === 'function') ? wizBlokkerendeStap('review') : null;
  if (eerste) { wizGo(eerste); return; }
  wizState.done.review = false;
  wizGo('review');
}

function wizBdWis() {
  wizBd.uitslag = null;
  wizBd.tekst = '';
  var el = document.getElementById('wiz-bd-in');
  if (el) el.value = '';
  wizRender();
}

function wizBdToelichting() {
  wizBd.toelichtingOpen = !wizBd.toelichtingOpen;
  wizRender();
}

/* ── Tekenen ────────────────────────────────────────────────────────────── */

var WIZ_BD_UITLEG = [
  ['Time context first', 'A season, an event or a deadline decides the funnel stage and answers "why now" — the cheapest performance lever there is.'],
  ['Funnel stage', 'Does this audience know the brand yet: cold reach, consideration, conversion or retargeting.'],
  ['Awareness and sophistication', 'What this reader already knows, and how many times this market has heard the claim. Both, because one without the other looks finished and is not.'],
  ['The angle, and how it is different', 'Which of the five levers it uses: a new mechanism, exaggerated execution, a different avatar, a different desire, a different style.'],
  ['Persona matching', 'Only when you point at a specific group. Never a persona picked because the library has one.'],
  ['Conflicts', 'Contradictory signals — a premium feeling plus 70% off — get flagged with a proposed resolution instead of being averaged away.']
];

function wizBdVeldLabel(pad) {
  var d = String(pad).split('.');
  var label = (typeof WIZ_FIELD_LABELS !== 'undefined' && WIZ_FIELD_LABELS[d[1]]) || d[1];
  /* De labels staan in het lidwoordvorm ("a persona") omdat ze uit de
     poortmelding komen; hier lezen ze als kop, dus het lidwoord eraf. */
  return String(label).replace(/^(a|an|the) /, '');
}

function wizBdWaarde(pad, waarde) {
  var d = String(pad).split('.');
  if (d[0] === 'audience' && d[1] === 'awareness') return wizLabel('awareness', waarde);
  if (d[0] === 'audience' && d[1] === 'sophistication') return wizSofistLabel(waarde);
  if (d[0] === 'strategy' && d[1] === 'differentiation') return wizDiffLabel(waarde);
  if (d[0] === 'product' && d[1] === 'funnel') return wizLabel('funnel', waarde);
  if (d[0] === 'product' && d[1] === 'placement') return wizLabel('placement', waarde);
  if (d[0] === 'visual') return wizVisualLabel(d[1], waarde);
  if (d[0] === 'audience' && d[1] === 'personaId') {
    var p = (state.personas || []).filter(function (x) { return x.id === waarde; })[0];
    return p ? p.name : waarde;
  }
  if (d[0] === 'product' && d[1] === 'productId') {
    var pr = (state.products || []).filter(function (x) { return x.id === waarde; })[0];
    return pr ? pr.name : waarde;
  }
  if (d[0] === 'format') {
    var f = (typeof AD_FORMATS !== 'undefined' ? AD_FORMATS : []).filter(function (x) { return x.id === waarde; })[0];
    return f ? f.name : waarde;
  }
  return waarde;
}

function wizRenderBrainDump() {
  if (wizBd.bezig) {
    return '<div class="wiz-bd">' +
      wizDenkt('Rory is reading your brain dump and working out the whole approach.') +
      '</div>';
  }

  var u = wizBd.uitslag;
  if (u) return wizBdRenderUitslag(u);

  var h = '<div class="wiz-bd">' +
    '<div class="wiz-bd-kop"><span class="wiz-bd-t">Quick start — brain dump</span>' +
    '<button type="button" class="wiz-linkbtn" onclick="wizBdToelichting()">' +
    (wizBd.toelichtingOpen ? 'Hide how Rory reads this' : 'How does Rory read this?') + '</button></div>' +
    '<div class="wiz-bd-hint">Type whatever is in your head: a find, a season, an audience, ' +
    'an irritation, a deal. Rory reads it, works out the whole approach and fills in the ' +
    'steps, with the reason next to every choice. You can overrule all of it.</div>';

  if (wizBd.toelichtingOpen) {
    h += '<ol class="wiz-bd-uitleg">' + WIZ_BD_UITLEG.map(function (r) {
      return '<li><strong>' + wizEsc(r[0]) + '</strong> ' + wizEsc(r[1]) + '</li>';
    }).join('') + '</ol>';
  }

  h += '<textarea id="wiz-bd-in" class="wiz-bd-in" rows="4" ' +
    'placeholder="Bv: voor de WK, jonge vaders die niet te lang in de douche willen, ik denk premium. ' +
    'Of: Black Friday bundel, hoe overtuig ik mensen die al twijfelden?">' + wizEsc(wizBd.tekst) + '</textarea>' +
    '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn primary" onclick="wizBdAnalyse()">' +
    'Work out the whole approach</button></div></div>';
  return h;
}

function wizBdRenderUitslag(u) {
  var h = '<div class="wiz-bd wiz-bd--klaar">' +
    '<div class="wiz-bd-kop"><span class="wiz-bd-t">What Rory made of it</span>' +
    '<button type="button" class="wiz-linkbtn" onclick="wizBdWis()">Start over</button></div>';

  if (u.samenvatting) h += '<div class="wiz-bd-sam">' + wizEsc(u.samenvatting) + '</div>';

  /* Conflicten bovenaan: het is het enige wat om een besluit van jou vraagt. */
  (u.conflicten || []).forEach(function (c) {
    h += '<div class="wiz-bd-conflict"><strong>Conflicting signals.</strong> ' +
      wizEsc(c.what || '') + ' <em>' + wizEsc(c.resolution || '') + '</em></div>';
  });

  h += '<div class="wiz-bd-lijst">' + (u.gezet || []).map(function (b) {
    return '<div class="wiz-bd-rij">' +
      '<div class="wiz-bd-veld">' + wizEsc(wizBdVeldLabel(b.veld)) + '</div>' +
      '<div class="wiz-bd-waarde">' + wizEsc(wizBdWaarde(b.veld, b.waarde)) + '</div>' +
      '<div class="wiz-bd-waarom">' + wizEsc(b.waarom) + '</div></div>';
  }).join('') + '</div>';

  if ((u.open || []).length) {
    h += '<div class="wiz-bd-open"><div class="wiz-bd-open-k">Left open on purpose</div>' +
      (u.open || []).map(function (o) {
        return '<div class="wiz-bd-rij"><div class="wiz-bd-veld">' + wizEsc(wizBdVeldLabel(o.veld)) +
          '</div><div class="wiz-bd-waarde">—</div>' +
          '<div class="wiz-bd-waarom">' + wizEsc(o.waarom) + '</div></div>';
      }).join('') + '</div>';
  }

  /* Geweigerde waarden staan er apart onder. Dit is geen oordeel van Rory maar
     een fout in het samenspel, en dat mag je zien in plaats van dat een veld
     stilletjes leeg blijft. */
  if ((u.geweigerd || []).length) {
    h += '<div class="wiz-bd-geweigerd">Not applied: ' + (u.geweigerd || []).map(function (g) {
      return wizEsc(g.veld) + ' (' + wizEsc(g.reden) + ')';
    }).join('; ') + '</div>';
  }

  h += '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn primary" onclick="wizBdNaarBlueprint()">Go to the blueprint</button>' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizBdAnalyse()">Read it again</button>' +
    '</div></div>';
  return h;
}

window.wizBd = wizBd; window.wizBdAnalyse = wizBdAnalyse; window.wizBdBrief = wizBdBrief;
window.wizBdToepassen = wizBdToepassen; window.wizBdNaarBlueprint = wizBdNaarBlueprint;
window.wizBdWis = wizBdWis; window.wizBdToelichting = wizBdToelichting;
window.wizRenderBrainDump = wizRenderBrainDump; window.WIZ_BD_UITLEG = WIZ_BD_UITLEG;
