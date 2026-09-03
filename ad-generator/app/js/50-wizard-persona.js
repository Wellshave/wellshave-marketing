/* Een persona die ter plekke voor dit product wordt uitgewerkt.
 *
 * De persona-bibliotheek is per categorie opgebouwd, en voor een nieuwe
 * categorie staat er dus niets. Dan krijg je de personas van een ander
 * product voorgeschoteld, en dat is erger dan een lege lijst: een persona van
 * de verkeerde categorie ziet eruit als een besluit en stuurt de hele
 * blueprint de verkeerde kant op.
 *
 * Dus: laat hem er een uitwerken voor het product dat je nu voor je hebt, uit
 * de productdata en de klanttaal die er wel is. Twee regels maken het verschil
 * tussen nuttig en gevaarlijk:
 *
 *   1. HIJ STAAT APART. Een persona die uit een productbeschrijving is
 *      afgeleid is geen klantonderzoek. Hij draagt een eigen merk (herkomst
 *      'wizard') en een eigen kopje, zodat niemand hem over een half jaar
 *      aanziet voor iemand die daadwerkelijk geïnterviewd is.
 *
 *   2. HIJ BEWAART ZICHZELF NIET STIL. Hij geldt voor deze ad. Wil je hem
 *      houden, dan zet je hem er zelf bij -- en dan is dat een besluit van
 *      een mens, niet een bijwerking van een generatie.
 */

var wizPx = { bezig: false, voorstel: null, fout: '' };

/* Wat het product en het merk aan grond leveren. Zonder product is er niets
   te bouwen: dan zou hij een klant verzinnen bij een leeg vak. */
function wizPxKanBouwen() {
  return !!(typeof wizProduct === 'function' && wizProduct());
}

function wizPxWis() {
  wizPx.voorstel = null;
  wizPx.fout = '';
  wizRender();
}

function wizPxBouw() {
  if (wizPx.bezig) return Promise.resolve();
  var p = (typeof wizProduct === 'function') ? wizProduct() : null;
  if (!p) return Promise.resolve();
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true);
    return Promise.resolve();
  }
  wizPx.bezig = true;
  wizPx.fout = '';
  wizRender();

  var sys = 'You are Rory Sutherland, working out ONE customer for a product that has no ' +
    'research behind it yet.\n' +
    'Build the person from what the product actually is: what it does, what it costs, who ' +
    'would be shopping in that aisle, and what they would have tried before. Give them a ' +
    'specific life, not a demographic bracket: a name, an age, and the moment the problem ' +
    'shows up in their week.\n' +
    'Two rules. Write the pains, desires and objections in the customer\'s own words, the way ' +
    'someone would type them in a review, not in marketing language. And keep the tribe big ' +
    'enough to spend into: a person so specific that only a hundred people recognise ' +
    'themselves is a poem, not an audience.\n' +
    'Say plainly what you are unsure of. This is derived from a product description, not ' +
    'from interviews, and pretending otherwise is how a whole campaign ends up built on a ' +
    'guess.\n' +
    'Answer with strict JSON: {"name":"Firstname Lastname, de <bijnaam>","age":<number>,' +
    '"description":"one or two sentences: who they are and when the problem bites",' +
    '"pains":["..."],"desires":["..."],"objections":["..."],' +
    '"onzeker":"what you could not tell from the product data"}';

  var c = 'PRODUCT: ' + p.name + (p.category ? ' (' + p.category + ')' : '') + '\n';
  if ((p.usps || []).filter(Boolean).length) c += 'USPs: ' + p.usps.filter(Boolean).join(' | ') + '\n';
  if (p.price) c += 'Price: ' + p.price + '\n';
  if (p.target) c += 'Stated target: ' + p.target + '\n';
  if (p.forbidden) c += 'Forbidden claims: ' + p.forbidden + '\n';
  var d = wizState.data;
  if (d.product.funnel) c += 'Funnel stage: ' + wizLabel('funnel', d.product.funnel) + '\n';
  if (d.strategy.goal) c += 'Goal of this ad: ' + d.strategy.goal + '\n';
  /* De personas die er al zijn gaan mee als NEGATIEF voorbeeld: hij moet er
     iemand naast zetten, niet iemand overschrijven. */
  var bestaand = (state.personas || []).slice(0, 6).map(function (x) { return x.name; });
  if (bestaand.length) {
    c += '\nPersonas that already exist for other categories (do not repeat these): ' +
      bestaand.join(', ') + '\n';
  }

  return wizCall(sys, [{ role: 'user', content: c }], 1400)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (!o || !o.name) throw new Error('no persona came back');
      wizPx.voorstel = {
        id: 'wizpx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        name: String(o.name),
        age: o.age || null,
        category: p.category || '',
        description: String(o.description || ''),
        pains: (o.pains || []).map(String).filter(Boolean),
        desires: (o.desires || []).map(String).filter(Boolean),
        objections: (o.objections || []).map(String).filter(Boolean),
        onzeker: String(o.onzeker || ''),
        /* Waar hij vandaan komt. Dit veld is het hele verschil tussen een
           werkhypothese en klantonderzoek, en het reist met hem mee. */
        herkomst: 'wizard',
        voorProduct: p.id
      };
    })
    .catch(function (err) {
      wizPx.fout = 'Could not work one out: ' + err.message;
    })
    .finally(function () { wizPx.bezig = false; wizRender(); });
}

/* Hem gebruiken voor DEZE ad. Hij komt in de lijst zodat alles wat een
   persona opzoekt hem vindt, maar met zijn herkomst erbij. */
function wizPxGebruik() {
  var v = wizPx.voorstel;
  if (!v) return;
  state.personas = state.personas || [];
  if (!state.personas.some(function (x) { return x.id === v.id; })) {
    state.personas.push(JSON.parse(JSON.stringify(v)));
  }
  wizSet('audience', 'personaId', v.id, 'user');
  wizSave();
  wizRender();
  if (typeof toast === 'function') toast('Working persona in use for this ad');
}

/* Hem in de bibliotheek houden. Bewust een aparte handeling: bewaren is een
   besluit van een mens, geen bijwerking van een generatie. */
function wizPxBewaar() {
  var v = wizPx.voorstel;
  if (!v) return;
  state.personas = state.personas || [];
  var bestaat = state.personas.filter(function (x) { return x.id === v.id; })[0];
  if (!bestaat) { state.personas.push(JSON.parse(JSON.stringify(v))); bestaat = state.personas[state.personas.length - 1]; }
  bestaat.herkomst = 'wizard-bewaard';
  if (typeof savePersonas === 'function') savePersonas();
  wizRender();
  if (typeof toast === 'function') toast('Bewaard in de persona-bibliotheek');
}

/* Is deze persona een werkhypothese in plaats van onderzoek? */
function wizPxIsWerk(persona) {
  return !!(persona && String(persona.herkomst || '').indexOf('wizard') === 0);
}

function wizRenderPersonaBouwer() {
  if (!wizPxKanBouwen()) return '';
  var p = wizProduct();
  var alle = state.personas || [];
  var passend = alle.filter(function (x) { return !x.category || x.category === (p.category || ''); });
  var v = wizPx.voorstel;

  var h = '<div class="wiz-pxbouw' + (v ? ' met' : '') + '">';

  if (!v) {
    /* De aanleiding er eerlijk bij: staat er niets voor deze categorie, dan is
       dit geen extraatje maar de enige goede weg. */
    h += '<div class="wiz-pxbouw-kop">No research for this category yet</div>' +
      '<p class="wiz-pxbouw-uitleg">' +
      (passend.length
        ? 'There are ' + passend.length + ' personas for ' + wizEsc(p.category || 'this category') +
          '. If none of them is the person for this ad, have one worked out from the product itself.'
        : 'The personas in the list belong to other categories, and one of those is worse than none: ' +
          'it looks like a decision and it points the whole blueprint the wrong way. Have one worked ' +
          'out from ' + wizEsc(p.name) + ' instead.') +
      '</p>' +
      '<button type="button" class="wiz-btn ghost small" onclick="wizPxBouw()"' +
      (wizPx.bezig ? ' disabled' : '') + '>' +
      (wizPx.bezig ? 'Working one out…' : 'Work out a persona for ' + wizEsc(p.name)) + '</button>';
    if (wizPx.fout) h += '<p class="wiz-pxbouw-fout">' + wizEsc(wizPx.fout) + '</p>';
    return h + '</div>';
  }

  var gekozen = wizState.data.audience.personaId === v.id;
  h += '<div class="wiz-pxbouw-kop">Working persona' +
    '<span class="wiz-pxbouw-merk">from product data, not interviews</span></div>' +
    '<div class="wiz-pxkaart' + (gekozen ? ' on' : '') + '">' +
    '<div class="wiz-pxnaam">' + wizEsc(v.name) + (v.age ? ' · ' + wizEsc(String(v.age)) : '') + '</div>' +
    '<div class="wiz-pxdesc">' + wizEsc(v.description) + '</div>' +
    ['pains', 'desires', 'objections'].map(function (k) {
      var lijst = v[k] || [];
      if (!lijst.length) return '';
      var kop = { pains: 'Pains', desires: 'Desires', objections: 'Objections' }[k];
      return '<div class="wiz-pxblok"><div class="wiz-pxblok-k">' + kop + '</div><ul>' +
        lijst.map(function (x) { return '<li>' + wizEsc(x) + '</li>'; }).join('') + '</ul></div>';
    }).join('') +
    (v.onzeker
      ? '<div class="wiz-pxonzeker"><strong>Not certain:</strong> ' + wizEsc(v.onzeker) + '</div>'
      : '') +
    '</div>' +
    '<div class="wiz-pxknoppen">' +
    (gekozen
      ? '<span class="wiz-pxinuse">In use for this ad</span>'
      : '<button type="button" class="wiz-btn primary small" onclick="wizPxGebruik()">Use for this ad</button>') +
    '<button type="button" class="wiz-btn ghost small" onclick="wizPxBewaar()">Keep in the library</button>' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizPxBouw()"' +
    (wizPx.bezig ? ' disabled' : '') + '>' + (wizPx.bezig ? 'Working…' : 'Another one') + '</button>' +
    '<button type="button" class="wiz-linkbtn" onclick="wizPxWis()">Discard</button>' +
    '</div>';
  return h + '</div>';
}

window.wizPx = wizPx; window.wizPxBouw = wizPxBouw; window.wizPxGebruik = wizPxGebruik;
window.wizPxBewaar = wizPxBewaar; window.wizPxWis = wizPxWis; window.wizPxIsWerk = wizPxIsWerk;
window.wizPxKanBouwen = wizPxKanBouwen; window.wizRenderPersonaBouwer = wizRenderPersonaBouwer;
