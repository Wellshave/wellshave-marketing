/* Static Ad Wizard — stap 1 tot en met 6.
 *
 * De vorm volgt het ontwerp: elke stap heeft twee kolommen.
 *
 *   LINKS WAT JE BESLIST, RECHTS WAAR DIE BESLISSING OP RUST.
 *
 * Links staan de keuzes als gelabelde velden, tegels en kaarten. Rechts staat
 * hun tegenhanger: de productkaart met de USP's, de andere persona's, "Why
 * this works", een beeldvoorbeeld, de ad-preview. Dat is niet decoratie maar
 * de reden dat een keuze te beoordelen is -- een persona kiezen zonder het
 * onderzoek ernaast is gokken met een dropdown.
 *
 * Hiervoor stonden hier twee andere vormen, en het is nuttig te weten waarom
 * ze het niet werden:
 *
 *   1. Alle velden naast elkaar met een knop "vraag Rory". Dat is een control
 *      panel in negen delen: je vult nog steeds alles zelf in, alleen verdeeld
 *      over meer schermen.
 *   2. Eén zin met de beslissingen als klikbare woorden. Rustig om te lezen,
 *      maar er is geen plek voor het bewijs ernaast, en bij acht visuele
 *      keuzes wordt een zin een opsomming.
 *
 * Wat uit beide is blijven staan: Rory kijkt uit zichzelf (38-wizard-core.js),
 * er staat nooit een leeg veld waar een voorstel kan staan, en wat de
 * gebruiker zelf zet overleeft een advies.
 *
 * Interface-tekst is Engels. Wat uit productdata, persona's, onderzoek of de
 * advertentiecopy zelf komt tonen we onvertaald -- dat is bronmateriaal.
 */

/* ── De zin ─────────────────────────────────────────────────────────────────
 *
 * Nog in gebruik op de plekken waar één regel genoeg is (stap 8). Een zin is
 * een lijst stukken: gewone tekst, of een beslissing die als klikbaar woord
 * zijn eigen keuzelijst opent. */

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

/* De keuze die zojuist gemaakt is, als 'vak.veld.waarde'. Kort daarna weer
 * leeg: de pulse is een bevestiging van de klik, geen eigenschap van de
 * toestand. Een geselecteerd element dat blijft pulseren zegt na een seconde
 * niets meer en irriteert na een minuut. */
var wizNetGekozen = null;
var wizNetTimer = null;

function wizNetKlas(stepKey, field, value) {
  return wizNetGekozen === (stepKey + '.' + field + '.' + value) ? ' net' : '';
}

function wizPick(stepKey, field, value) {
  wizSet(stepKey, field, value, 'user');
  wizState.openVeld = null;
  wizNetGekozen = stepKey + '.' + field + '.' + value;
  clearTimeout(wizNetTimer);
  wizNetTimer = setTimeout(function () { wizNetGekozen = null; }, 1100);
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
    (wizRoryBezig() ? ' disabled' : '') + '>' + wizEsc(label || 'Have Rory rethink this') + '</button>';
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

/* `vorm` tekent het miniatuurtje in de tegel: een vierkant, een staande of een
   liggende verhouding. `kort` is het label op de funneltegel -- TOF/MOF/BOF
   zoals in het ontwerp, met de betekenis eronder als hint elders. */
var WIZ_PLACEMENTS = [
  { value: 'feed11', label: 'Feed 1:1', vorm: 'vk', hint: 'Square, safe everywhere' },
  { value: 'stories', label: 'Story 9:16', vorm: 'st', hint: 'Full screen, short dwell' },
  { value: 'feed45', label: 'Feed 4:5', vorm: 'lg', hint: 'More vertical space in feed' },
  { value: 'reels', label: 'Reels 9:16', vorm: 'st', hint: 'Full screen, heavy bottom UI' }
];

var WIZ_FUNNELS = [
  { value: 'tof', kort: 'TOF', label: 'Cold reach', hint: 'They do not know the brand yet' },
  { value: 'mof', kort: 'MOF', label: 'Consideration', hint: 'They are weighing options' },
  { value: 'bof', kort: 'BOF', label: 'Conversion', hint: 'Ready to buy, needs a push' },
  { value: 'retargeting', kort: 'Retarget', label: 'Retargeting', hint: 'Visited the site, did not buy' }
];

/* Market sophistication: hoeveel claims deze markt al gehoord heeft. Awareness
 * bepaalt hoe direct je mag praten, sophistication bepaalt wat voor claim er
 * uberhaupt nog geloofd wordt. Uit Schwartz, Breakthrough Advertising.
 *
 * De regel bij het kiezen is niet "zo hoog mogelijk" maar precies een stap
 * voor op de concurrentie: schrijf je kale productclaim op, zoek hem in de Ads
 * Library, tel hoeveel concurrenten hem maken. Druk bezet, dan een stap
 * verder; leeg, dan is een directe claim genoeg. Achterlopen klinkt als
 * iedereen, te ver vooruit is nodeloos ingewikkeld.
 *
 * Stadium 5 gedraagt zich als 'unaware': in beide gevallen verkoop je in de
 * hook niet het product maar de reden om te blijven kijken. */
var WIZ_SOPHISTICATION = [
  { value: 's1', label: 'Stage 1 — direct claim', hint: 'Virgin market, you are first. State it plainly.' },
  { value: 's2', label: 'Stage 2 — bigger claim', hint: 'Same claim, escalated and more specific.' },
  { value: 's3', label: 'Stage 3 — new mechanism', hint: 'Bare claims are dead. Name the how.' },
  { value: 's4', label: 'Stage 4 — better mechanism', hint: 'Everyone has a mechanism. Yours is superior.' },
  { value: 's5', label: 'Stage 5 — identity', hint: 'Fully sceptical market. Sell who they are, not the product.' }
];

/* De vijf manieren om anders te zijn. Elke hoek noemt er een: zonder dat is
   'anders' een compliment achteraf in plaats van een besluit vooraf. */
var WIZ_DIFFERENTIATION = [
  { value: 'mechanism', label: 'New mechanism', hint: 'A new how, and the superiority it produces. The strongest.' },
  { value: 'exaggeration', label: 'Exaggerated execution', hint: 'Bigger in specificity, scale and spectacle. Never a bigger claim.' },
  { value: 'avatar', label: 'Different avatar', hint: 'Same product, new tribe. The cheapest and most reliable.' },
  { value: 'desire', label: 'Different desire', hint: 'Same product, a different outcome sold.' },
  { value: 'style', label: 'Different creative style', hint: 'Early to a format. Real, and perishable.' }
];

/* Wat het gekozen stadium betekent voor de ad, in een regel. Twee stadia zijn
   het vermelden waard omdat ze tegen de intuitie in gaan: bij 5 verkoop je in
   de hook niet het product, precies als bij een publiek dat het probleem nog
   niet kent. */
function wizSofistHint() {
  var a = wizState.data.audience.awareness, sf = wizState.data.audience.sophistication;
  if (!sf) return 'Write your bare product claim, search it in the Ads Library, count the competitors making it. Crowded means one stage further.';
  var per = {
    s1: 'A direct claim is enough here. Do not complicate it.',
    s2: 'Same claim as the others, escalated: specific numbers, bigger scale.',
    s3: 'Bare claims are spent. Lead with the mechanism, the how.',
    s4: 'Everyone has a mechanism now. Yours has to be visibly better than theirs.',
    s5: 'Stop selling the product. Sell who they are. Open like an unaware ad: the reason to keep looking, not the product.'
  }[sf] || '';
  if (sf === 's5' && a && a !== 'unaware') {
    per += ' Note the tension with the awareness stage: at 5 the opening behaves unaware whatever they already know.';
  }
  return per;
}

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

/* ── Bouwstenen uit het ontwerp ─────────────────────────────────────────── */

/* Een gelabeld veld met een keuzelijst erin. In het ontwerp is dit de
   basisvorm van elke beslissing: label erboven, waarde eronder. */
function wizSelect(stepKey, field, label, opts, leeg) {
  var v = (wizState.data[stepKey] || {})[field] || '';
  var tip = ((wizState.advice[stepKey] || {}).recommendation || {})[field];
  var id = 'wizs-' + stepKey + '-' + field;
  return '<div class="wiz-veld">' +
    '<label for="' + id + '">' + wizEsc(label) +
      (tip && tip === v ? '<span class="wiz-tag rory">Rory</span>' : '') + '</label>' +
    '<select id="' + id + '" onchange="wizPick(\'' + stepKey + '\',\'' + field + '\',this.value)">' +
    (leeg ? '<option value=""' + (v ? '' : ' selected') + '>' + wizEsc(leeg) + '</option>' : '') +
    opts.map(function (o) {
      return '<option value="' + wizEsc(o.value) + '"' + (String(o.value) === String(v) ? ' selected' : '') + '>' +
        wizEsc(o.label) + '</option>';
    }).join('') + '</select></div>';
}

/* Een rij tegels, zoals de plaatsing en de funnelfase in het ontwerp. */
function wizTegels(stepKey, field, opts) {
  var v = (wizState.data[stepKey] || {})[field];
  var tip = ((wizState.advice[stepKey] || {}).recommendation || {})[field];
  return '<div class="wiz-tegels">' + opts.map(function (o) {
    var aan = String(v) === String(o.value);
    return '<button type="button" class="wiz-tegel' + (aan ? ' on' : '') +
      (aan ? wizNetKlas(stepKey, field, o.value) : '') +
      (String(tip) === String(o.value) ? ' rec' : '') + '" ' +
      'onclick="wizPick(\'' + stepKey + '\',\'' + field + '\',\'' + wizEsc(o.value) + '\')">' +
      (o.vorm ? '<span class="wiz-tegel-vorm ' + o.vorm + '"></span>' : '') +
      '<span class="wiz-tegel-label">' + wizEsc(o.label) + '</span>' +
      '</button>';
  }).join('') + '</div>';
}

/* De paneeltitel boven een blok in de rechterkolom. */
function wizPaneel(titel, inhoud, extra) {
  return '<div class="wiz-zijpaneel' + (extra ? ' ' + extra : '') + '">' +
    (titel ? '<div class="wiz-zijpaneel-t">' + wizEsc(titel) + '</div>' : '') + inhoud + '</div>';
}

/* ── Stap 1: Product en plaatsing ───────────────────────────────────────── */

function wizRender_product() {
  var prods = state.products || [];
  if (!prods.length) {
    return '<div class="wiz-empty">No products yet. Add one in the Products tab first — the wizard builds everything on that data.</div>';
  }
  var p = wizProduct();

  /* De brain dump staat boven de keuzes en niet eronder. Hij is de snelste van
     de drie wegen naar dezelfde blueprint, en wie hem onder het formulier zet
     heeft hem verstopt: dan vul je eerst drie velden in en zie je daarna pas
     dat het in een keer had gekund. */
  var links = (typeof wizRenderBrainDump === 'function') ? wizRenderBrainDump() : '';

  links += wizSelect('product', 'productId', 'Select product',
    prods.map(function (x) { return { value: x.id, label: x.name + (x.category ? ' (' + x.category + ')' : '') }; }),
    'Choose a product…');

  links += '<div class="wiz-veld"><label>Placement</label>' +
    wizTegels('product', 'placement', WIZ_PLACEMENTS.map(function (o) {
      return { value: o.value, label: o.label, vorm: o.vorm };
    })) + '</div>';

  links += '<div class="wiz-veld"><label>Funnel stage</label>' +
    wizTegels('product', 'funnel', WIZ_FUNNELS.map(function (o) {
      return { value: o.value, label: o.kort };
    })) + '</div>';

  /* Rechts de productkaart: beeld, naam, categorie en de USP's met vinkjes.
     Dat is niet decoratie -- het is precies de data waar Rory zijn advies op
     bouwt, en die hoort zichtbaar te zijn op het moment dat je kiest. */
  /* Welke referentiebeelden deze ad gebruikt, onder de keuzes. Het beeld is
     het halve werk, en je hoort voor het genereren te weten waar hij vandaan
     tekent -- niet pas als je naar het resultaat kijkt. */
  if (typeof wizRenderReferenties === 'function') links += wizRenderReferenties();

  var rechts = '';
  if (p) {
    var usps = (p.usps || []).filter(Boolean);
    var refs = (typeof normalizeRefs === 'function') ? normalizeRefs(p.references) : null;
    var beeld = refs && refs.product && refs.product[0];
    rechts = wizPaneel(null,
      (beeld ? '<div class="wiz-prodbeeld"><img src="' + beeld + '" alt=""></div>' : '') +
      '<div class="wiz-prodnaam">' + wizEsc(p.name) + '</div>' +
      (p.category ? '<div class="wiz-prodcat">' + wizEsc(p.category) + '</div>' : '') +
      (usps.length
        ? '<ul class="wiz-usps">' + usps.slice(0, 5).map(function (u) {
            return '<li>' + wizEsc(u) + '</li>'; }).join('') + '</ul>'
        : '<div class="wiz-readout-none">No USPs recorded for this product.</div>') +
      (p.price ? '<div class="wiz-prodprijs">' + wizEsc(p.price) + '</div>' : ''),
      'productkaart');
  } else {
    rechts = '<div class="wiz-leegzij">Pick a product and its data appears here.</div>';
  }

  return { links: links, rechts: rechts };
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

  /* Geen personas: dat was een doodlopende melding ("voeg klantonderzoek toe
     in een ander tabblad"), terwijl je middenin een ad zit. Er valt hier wel
     degelijk iets te doen. */
  if (!lijst.length) {
    return '<div class="wiz-empty">No customer research for this category yet.</div>' +
      ((typeof wizRenderPersonaBouwer === 'function') ? wizRenderPersonaBouwer() : '');
  }

  /* De aanbevolen persona groot, de rest als lijst ernaast. Dat is de kern van
     deze stap in het ontwerp: één voorstel dat je kunt lezen, en de anderen
     binnen handbereik zonder dat ze om aandacht vechten. */
  var tip = ((wizState.advice.audience || {}).recommendation || {}).personaId;
  var hoofd = pers || lijst.filter(function (x) { return x.id === tip; })[0] || null;

  var links = '';
  if (hoofd) {
    var isTip = (hoofd.id === tip);
    links += '<div class="wiz-veld"><label>Recommended persona</label>' +
      '<button type="button" class="wiz-personakaart' + (pers && pers.id === hoofd.id ? ' on' : '') + '" ' +
      'onclick="wizPick(\'audience\',\'personaId\',\'' + wizEsc(hoofd.id) + '\')">' +
      (isTip ? '<span class="wiz-choice-rec">Recommended</span>' : '') +
      '<span class="wiz-personakaart-naam">' + wizEsc(hoofd.name) +
      /* Een persona die uit productdata is afgeleid is geen klantonderzoek.
         Dat verschil hoort op de kaart te staan, niet alleen in de data. */
      ((typeof wizPxIsWerk === 'function' && wizPxIsWerk(hoofd))
        ? '<span class="wiz-pxmerk">working persona</span>' : '') + '</span>' +
      '<span class="wiz-personakaart-desc">' + wizEsc(hoofd.description || '') + '</span>' +
      '</button></div>';
  }

  /* De bouwer onder de aanbeveling: hij hoort erbij als geen van de bestaande
     personas de mens van deze ad is, en dat merk je pas als je ze ziet. */
  if (typeof wizRenderPersonaBouwer === 'function') links += wizRenderPersonaBouwer();

  links += '<div class="wiz-veld"><label>Awareness level</label>' +
    '<div class="wiz-pillen">' + WIZ_AWARENESS.map(function (o) {
      var aan = (wizState.data.audience.awareness === o.value);
      var rec = (((wizState.advice.audience || {}).recommendation || {}).awareness === o.value);
      return '<button type="button" class="wiz-pil' + (aan ? ' on' + (aan ? wizNetKlas('audience', 'awareness', o.value) : '') : '') + (rec ? ' rec' : '') + '" ' +
        'onclick="wizPick(\'audience\',\'awareness\',\'' + o.value + '\')">' + wizEsc(o.label) + '</button>';
    }).join('') + '</div></div>';

  /* Awareness en sophistication staan onder elkaar en niet verstopt achter
     "More options": ze bepalen samen wat de ad mag beweren, en een van de twee
     invullen is erger dan geen van beide -- dan denk je dat je het gedaan hebt. */
  links += '<div class="wiz-veld"><label>Market sophistication</label>' +
    '<div class="wiz-pillen">' + WIZ_SOPHISTICATION.map(function (o) {
      var aan = (wizState.data.audience.sophistication === o.value);
      var rec = (((wizState.advice.audience || {}).recommendation || {}).sophistication === o.value);
      return '<button type="button" class="wiz-pil' + (aan ? ' on' + (aan ? wizNetKlas('audience', 'sophistication', o.value) : '') : '') + (rec ? ' rec' : '') + '" ' +
        'title="' + wizEsc(o.hint) + '" ' +
        'onclick="wizPick(\'audience\',\'sophistication\',\'' + o.value + '\')">' + wizEsc(o.label) + '</button>';
    }).join('') + '</div>' +
    '<div class="wiz-hint">' + wizEsc(wizSofistHint()) + '</div></div>';

  var anderen = lijst.filter(function (x) { return !hoofd || x.id !== hoofd.id; });
  var rechts = wizPaneel('Other personas',
    anderen.length
      ? '<div class="wiz-personalijst">' + anderen.map(function (x) {
          return '<button type="button" class="wiz-personarij' +
            (pers && pers.id === x.id ? ' on' : '') + '" ' +
            'onclick="wizPick(\'audience\',\'personaId\',\'' + wizEsc(x.id) + '\')">' +
            '<span class="wiz-personarij-naam">' + wizEsc(x.name) + '</span>' +
            '<span class="wiz-personarij-desc">' + wizEsc((x.description || '').split(',')[0]) + '</span>' +
            '</button>';
        }).join('') + '</div>'
      : '<div class="wiz-readout-none">No other personas for this category.</div>');

  /* Het onderzoek waar het advies op rust. De opdracht vraagt expliciet dat
     zichtbaar is welke informatie Rory gebruikt. */
  if (pers) {
    var blok = function (titel, arr) {
      var v = (arr || []).filter(Boolean);
      if (!v.length) return '';
      return '<div class="wiz-res-col"><div class="wiz-res-t">' + titel + '</div><ul>' +
        v.slice(0, 4).map(function (x) { return '<li>' + wizEsc(x) + '</li>'; }).join('') + '</ul></div>';
    };
    var kolommen = blok('Pains', pers.pains) + blok('Desires', pers.desires) + blok('Objections', pers.objections);
    if (kolommen) rechts += wizPaneel('Customer research', '<div class="wiz-research">' + kolommen + '</div>');
  }

  links += wizUitklap('audience',
    wizField('audience', 'market', 'Market', 'only when this campaign runs somewhere specific') +
    '<div class="wiz-actions">' + wizHerzie('audience') + '</div>',
    'More options');
  links += wizAlternatives('audience');

  return { links: links, rechts: rechts };
}

function wizAfter_audience() {
  if (wizState.data.audience.personaId && !wizState.hist) {
    wizLoadHistory(function () { if (wizState.current === 'audience') wizRenderRory(); });
  }
}

/* ── Stap 3: Creatieve strategie ────────────────────────────────────────── */

/* De zes rijen van de strategie, in de volgorde uit het ontwerp. */
var WIZ_STRATEGIE_RIJEN = [
  { field: 'marketingAngle', label: 'Marketing angle' },
  { field: 'messaging',      label: 'Core messaging' },
  { field: 'mechanism',      label: 'Mechanism' },
  { field: 'desire',         label: 'Primary desire' },
  { field: 'ultimateDesire', label: 'Ultimate desire' },
  { field: 'timing',         label: 'Why now' },
  { field: 'pain',           label: 'Primary pain point' },
  { field: 'proof',          label: 'Proof mechanism' },
  { field: 'objection',      label: 'Main objection' }
];

function wizRender_strategy() {
  var s = wizState.data.strategy;

  if (!s.marketingAngle) {
    return wizRoryBezig()
      ? wizDenkt('Rory is building the argument from the research and what already ran.')
      : '<div class="wiz-empty">Rory has not built the strategy yet. ' +
        '<button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'strategy\')">Build it now</button></div>';
  }

  /* Links de zes beslissingen als gelabelde rijen, direct bewerkbaar. Geen
     uitklap meer: dit ís het formulier, en in het ontwerp staat het open. */
  var links = WIZ_STRATEGIE_RIJEN.map(function (r) {
    return wizField('strategy', r.field, r.label, null, r.field === 'marketingAngle' || r.field === 'messaging');
  }).join('');

  /* Welke van de vijf manieren van anders-zijn deze hoek gebruikt. Dit staat
     bewust naast de hoek zelf en niet eronder verstopt: als je hem niet kunt
     aanwijzen, is het concept niet af. Naast je ad staan de ads van de
     concurrent, en zegt iedereen hetzelfde, dan kiest de klant willekeurig. */
  links += '<div class="wiz-veld"><label>What makes this different</label>' +
    '<div class="wiz-pillen">' + WIZ_DIFFERENTIATION.map(function (o) {
      var aan = (s.differentiation === o.value);
      var rec = (((wizState.advice.strategy || {}).recommendation || {}).differentiation === o.value);
      return '<button type="button" class="wiz-pil' + (aan ? ' on' + (aan ? wizNetKlas('strategy', 'differentiation', o.value) : '') : '') + (rec ? ' rec' : '') + '" ' +
        'title="' + wizEsc(o.hint) + '" ' +
        'onclick="wizPick(\'strategy\',\'differentiation\',\'' + o.value + '\')">' + wizEsc(o.label) + '</button>';
    }).join('') + '</div></div>';

  /* Waar de klik landt. Dit hoort bij de strategie en niet bij de nazorg:
     Meta leest de advertentie en de pagina samen en beslist op allebei aan
     wie hij hem laat zien. Een ad voor een nieuwe groep die naar een pagina
     voor de oude massa wijst, kost bereik voordat hij conversie kost. */
  if (typeof WIZ_BESTEMMINGEN !== 'undefined') {
    var destAdv = (typeof wizBestemmingAdvies === 'function') ? wizBestemmingAdvies() : null;
    links += '<div class="wiz-veld"><label>Where the click lands</label>' +
      '<div class="wiz-pillen">' + WIZ_BESTEMMINGEN.map(function (o) {
        var aan = (s.destination === o.value);
        var rec = !!(destAdv && (destAdv.keuze === o.value || (destAdv.ook || []).indexOf(o.value) !== -1));
        return '<button type="button" class="wiz-pil' + (aan ? ' on' + wizNetKlas('strategy', 'destination', o.value) : '') + (rec ? ' rec' : '') + '" ' +
          'title="' + wizEsc(o.hint) + '" ' +
          'onclick="wizPick(\'strategy\',\'destination\',\'' + o.value + '\')">' + wizEsc(o.label) + '</button>';
      }).join('') + '</div>';
    var mis = (typeof wizBestemmingMismatch === 'function') ? wizBestemmingMismatch() : null;
    if (mis) links += '<p class="wiz-waarschuwing">' + wizEsc(mis) + '</p>';
    else if (!s.destination && !wizState.data.audience.awareness) {
      links += '<p class="wiz-hint">Pick the awareness stage first and the fitting destination lights up.</p>';
    }
    links += '</div>';
  }

  var adv = wizState.advice.strategy || {};
  var aantalAlt = (adv.alternatives || []).length;
  links += '<div class="wiz-actions">' +
    (aantalAlt
      ? '<button type="button" class="wiz-btn ghost small" onclick="wizToggleUitklap(\'strategy\')">' +
        (wizState.unfolded.strategy ? 'Hide alternatives' : 'Show alternative strategies (' + aantalAlt + ')') + '</button>'
      : '') +
    wizHerzie('strategy', 'Have Rory build a different angle') + '</div>';
  if (wizState.unfolded.strategy) links += wizAlternatives('strategy');

  /* Rechts waarom dit werkt. Dat is de kolom uit het ontwerp, en het is het
     enige wat een strategie toetsbaar maakt: zonder redenering is het een
     mening met een vakje eromheen. */
  var rechts = '';
  if (adv.why) {
    rechts += wizPaneel('Why this works', '<p class="wiz-waarom">' + wizEsc(adv.why) + '</p>');
  }
  if (adv.evidence && adv.evidence.length) {
    rechts += wizPaneel('What Rory used',
      '<ul class="wiz-bronnen">' + adv.evidence.map(function (e) {
        return '<li>' + wizEsc(e) + '</li>'; }).join('') + '</ul>');
  }
  if (!rechts) rechts = '<div class="wiz-leegzij">Rory has not explained this yet.</div>';

  return { links: links, rechts: rechts };
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

  if (!sel && wizRoryBezig()) return wizDenkt('Rory is narrowing 42 formats down to the ones that carry this angle.');

  var aanbevolen = [rec.formatId].concat(rec.runnersUp || []).filter(Boolean);
  var tonen = alles ? AD_FORMATS : AD_FORMATS.filter(function (x) { return aanbevolen.indexOf(x.id) !== -1; });
  if (!alles && sel && !tonen.some(function (x) { return x.id === sel; })) {
    var eigen = AD_FORMATS.filter(function (x) { return x.id === sel; })[0];
    if (eigen) tonen = tonen.concat([eigen]);
  }

  /* Drie kaarten naast elkaar met een miniatuur van de opbouw, zoals in het
     ontwerp. Het wireframe is geen plaatje maar een paar blokjes die de
     verhouding van het format tonen -- genoeg om te zien of het een tekstad,
     een productad of een vergelijking is. */
  h += '<div class="wiz-formats' + (alles ? ' alles' : '') + '">' + tonen.map(function (x) {
    var aan = (x.id === sel), tip = (x.id === rec.formatId);
    return '<button type="button" class="wiz-format' + (aan ? ' on' : '') + (tip ? ' rec' : '') + '" ' +
      'onclick="wizPick(\'format\',\'formatId\',\'' + wizEsc(x.id) + '\')">' +
      (tip ? '<span class="wiz-choice-rec">Recommended</span>' : '') +
      '<span class="wiz-format-name">' + wizEsc(x.name) + '</span>' +
      '<span class="wiz-format-desc">' + wizEsc(x.desc) + '</span>' +
      '<span class="wiz-wire ' + wizWireVorm(x) + '"></span>' +
      '</button>';
  }).join('') + '</div>';

  h += wizBuitenDeLijntjes(sel);

  h += '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizToggleAllFormats()">' +
    (alles ? 'Back to the shortlist' : 'View all formats (' + AD_FORMATS.length + ')') + '</button>' +
    wizHerzie('format') + '</div>';
  return h;
}

/* ── Wanneer de nette layout de conventie IS ───────────────────────────────
 *
 * Elke ad kwam er hetzelfde uit: vette kop, body eronder, knop, soms een
 * Trustpilot. Dat is niet altijd fout -- bij BOF en retargeting doet die knop
 * werk -- maar bij een uitgekeken markt is diezelfde layout precies wat
 * iedereen doet, en dan zegt hij niets meer. Hij leest als behang.
 *
 * Dit is geen keuze die het scherm maakt. Het is een opmerking op het moment
 * dat hij ertoe doet, met de reden erbij, en drie formaten die het anders
 * doen. De nette layout blijft gewoon kiesbaar; hij is hier alleen niet meer
 * vanzelfsprekend.
 *
 * Twee ingangen, want er zijn twee redenen om de vorm te breken en ze vragen
 * om iets anders:
 *   - SOPHISTICATION 4-5: de markt heeft de claim al honderd keer gezien. De
 *     vorm moet anders, niet de belofte.
 *   - KOUD EN PROBLEEMBEWUST: "eruitzien als een advertentie" is hier het
 *     handicap. Native koopt aandacht die een ontworpen layout niet koopt.
 * ------------------------------------------------------------------------ */

var WIZ_BUITEN = {
  sophistication: {
    /* Vier formaten die de conventie breken zonder de boodschap te verliezen. */
    formaten: ['review-screenshot', 'whatsapp-chat', 'news-headline-advertorial', 'ugly-ad'],
    zegt: 'This market has seen the claim before. At stage 4 and 5 the polished ad layout IS the ' +
      'category convention: everyone runs it, so it stops being a signal. What has to change here is ' +
      'the form, not the promise.'
  },
  koud: {
    formaten: ['review-screenshot', 'notification-screenshot', 'tweet-reddit-screenshot', 'meme-format'],
    zegt: 'Cold and problem-aware. Looking like an ad is the handicap here — a native or lo-fi form ' +
      'buys attention that a designed layout cannot.'
  }
};

function wizBuitenReden() {
  var a = wizState.data.audience;
  var soph = String(a.sophistication || '');
  if (soph === 's4' || soph === 's5') return 'sophistication';
  var aw = String(a.awareness || '');
  var funnel = String(wizState.data.product.funnel || '');
  if ((aw === 'unaware' || aw === 'problem') && (!funnel || funnel === 'tof')) return 'koud';
  return null;
}

function wizBuitenDeLijntjes(sel) {
  var reden = wizBuitenReden();
  if (!reden) return '';
  var b = WIZ_BUITEN[reden];
  if (typeof AD_FORMATS === 'undefined') return '';
  var lijst = AD_FORMATS.filter(function (x) { return b.formaten.indexOf(x.id) !== -1; });
  if (!lijst.length) return '';
  /* Staat er al een formaat dat de conventie breekt, dan is de opmerking
     gemaakt en hoeft hij niet nog een keer. Een advies dat blijft staan nadat
     je het opgevolgd hebt, leest als een advies dat je niet opgevolgd hebt. */
  var gekozen = AD_FORMATS.filter(function (x) { return x.id === sel; })[0];
  if (gekozen && gekozen.brandless) return '';

  return '<div class="wiz-buiten">' +
    '<div class="wiz-buiten-kop">Worth breaking the template here</div>' +
    '<div class="wiz-buiten-tekst">' + wizEsc(b.zegt) + '</div>' +
    '<div class="wiz-buiten-lijst">' + lijst.map(function (x) {
      return '<button type="button" class="wiz-btn ghost small" ' +
        'onclick="wizPick(\'format\',\'formatId\',\'' + wizEsc(x.id) + '\')">' +
        wizEsc(x.name) + '</button>';
    }).join('') + '</div>' +
    '<div class="wiz-buiten-bij">The polished layout stays a valid answer — at BOF and retargeting ' +
    'it is the right one. Here it is just no longer the obvious one.</div>' +
    '</div>';
}

/* Welke miniatuur bij een format hoort. Afgeleid van de categorie, zodat een
   nieuw format vanzelf een passend blokje krijgt in plaats van een lege plek. */
function wizWireVorm(f) {
  if (!f) return 'w-product';
  if (f.cat === 'B') return 'w-proof';
  if (f.cat === 'C') return 'w-split';
  if (f.cat === 'D') return 'w-native';
  if (f.cat === 'E') return 'w-editorial';
  return 'w-product';
}

function wizToggleAllFormats() { wizState.showAllFormats = !wizState.showAllFormats; wizRender(); }
window.wizBuitenDeLijntjes = wizBuitenDeLijntjes; window.wizBuitenReden = wizBuitenReden;
window.WIZ_BUITEN = WIZ_BUITEN;

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
    return wizRoryBezig()
      ? wizDenkt('Rory is turning the strategy into a picture.')
      : '<div class="wiz-empty">Rory has not proposed a visual direction yet. ' +
        '<button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'visual\')">Propose one</button></div>';
  }

  /* Acht keuzes in twee kolommen, zoals in het ontwerp: elk een label met een
     keuzelijst eronder. Geen uitklap meer -- op deze stap is juist het
     overzicht de bedoeling, want de combinatie bepaalt het beeld. */
  var links = '<div class="wiz-tweeveld">' +
    WIZ_VISUAL.filter(function (x) { return x.field !== 'referenceUsage'; }).map(function (g) {
      return wizSelect('visual', g.field, g.title, g.opts, 'Choose…');
    }).join('') + '</div>';

  /* De foto van de mens in beeld, direct onder de keuzes en niet in de
     uitklap: hij verschijnt pas als er werkelijk een mens gekozen is, en dan
     is het geen extra optie maar de vraag die er op dat moment toe doet. */
  if (typeof wizRenderEigenFotos === 'function') links += wizRenderEigenFotos();

  /* En bij een redactioneel formaat het archetype plus de afzender. Dat hoort
     hier en niet op de formatstap: het is een beeldbesluit -- het bepaalt de
     typografie, de foto en wat er niet op mag. */
  if (typeof wizRenderNieuwsstijl === 'function') links += wizRenderNieuwsstijl();

  links += wizUitklap('visual',
    wizSelect('visual', 'referenceUsage', 'Reference image usage',
      (WIZ_VISUAL.filter(function (x) { return x.field === 'referenceUsage'; })[0] || {}).opts || []) +
    ((typeof wizRenderBasisFoto === 'function') ? wizRenderBasisFoto() : '') +
    '<div class="wiz-actions">' + wizHerzie('visual') + '</div>',
    'More options');

  /* Rechts een indruk van het beeld. Zolang er nog geen generatie is, is dat
     de sterkste referentiefoto van het product -- eerlijk gelabeld, want het
     is een voorbeeld en niet de advertentie. */
  var p = wizProduct();
  var refs = (p && typeof normalizeRefs === 'function') ? normalizeRefs(p.references) : null;
  var voorbeeld = refs && ((refs.usage && refs.usage[0]) || (refs.lifestyle && refs.lifestyle[0]) || (refs.product && refs.product[0]));
  /* Is er een basisfoto gekozen, dan is DAT wat je straks terugziet, en dan
     hoort er geen willekeurige productfoto te staan die iets anders belooft. */
  var basis = (typeof wizBasisFotoSrc === 'function') ? wizBasisFotoSrc() : '';
  var rechts;
  if (basis) {
    rechts = wizPaneel(null, '<div class="wiz-vizvoorbeeld"><img src="' + wizEsc(basis) + '" alt=""></div>' +
      '<div class="wiz-vizvoorbeeld-bij">The ad gets built on this photo. Its composition, light and ' +
      'the person in it stay; the product comes from the reference shots.</div>');
  } else if (voorbeeld) {
    rechts = wizPaneel(null, '<div class="wiz-vizvoorbeeld"><img src="' + voorbeeld + '" alt=""></div>' +
      '<div class="wiz-vizvoorbeeld-bij">This is a reference photo, not the ad. The generated visual follows the direction on the left.</div>');
  } else {
    rechts = '<div class="wiz-leegzij">No reference photos on file for this product.</div>';
  }

  var bd = (p && typeof refBreakdown === 'function') ? refBreakdown(p.references) : null;
  if (bd && bd.usage > 0) {
    rechts += '<div class="wiz-note">' + bd.usage + ' usage photo' + (bd.usage > 1 ? 's are' : ' is') +
      ' on file. The generator follows them for how the product is held and applied, whatever is chosen here.</div>';
  }
  return { links: links, rechts: rechts };
}

/* ── Stap 6: Copy ───────────────────────────────────────────────────────── */

function wizRender_copy() {
  var c = wizState.data.copy;
  if (!c.headline) {
    return wizRoryBezig()
      ? wizDenkt('Rory is writing the copy in the brand\'s own language.')
      : '<div class="wiz-empty">Rory has not written the copy yet. ' +
        '<button type="button" class="wiz-linkbtn" onclick="wizAskFor(\'copy\')">Write it</button></div>';
  }

  /* Links de headline-opties als keuze, plus de losse regels. Rechts de ad
     zoals hij eruit komt te zien: op ware grootte en in de goede verhouding,
     want een headline beoordeel je op ritme en lengte en dat zie je niet in
     een invoerveld van één regel. Bewust niet vertaald: dit is
     advertentiecopy. */
  var opties = wizHeadlineOpties();
  var links = '';
  if (opties.length > 1) {
    links += '<div class="wiz-veld"><label>Headline options</label>' +
      '<div class="wiz-headlines">' + opties.map(function (t, i) {
        var aan = (t === c.headline);
        return '<button type="button" class="wiz-headline' + (aan ? ' on' : '') + '" ' +
          'data-h="' + wizEsc(t) + '" ' +
          'onclick="wizPick(\'copy\',\'headline\',this.getAttribute(\'data-h\'))">' +
          wizEsc(t) + '</button>';
      }).join('') + '</div></div>';
  } else {
    links += wizField('copy', 'headline', 'Headline', 'the one line that has to land', true);
  }
  links += wizField('copy', 'supporting', 'Support line');
  links += wizField('copy', 'cta', 'CTA');

  links += wizUitklap('copy',
    wizField('copy', 'headline', 'Headline', 'the one line that has to land', true) +
    wizField('copy', 'proof', 'Proof copy', 'the claim that makes it believable') +
    wizField('copy', 'body', 'Body copy', 'only when the format carries it', 3) +
    '<div class="wiz-actions">' + wizHerzie('copy', 'Have Rory write it differently') + '</div>',
    'More options');

  var p = wizProduct();
  var refs = (p && typeof normalizeRefs === 'function') ? normalizeRefs(p.references) : null;
  var beeld = refs && ((refs.usage && refs.usage[0]) || (refs.lifestyle && refs.lifestyle[0]) || (refs.product && refs.product[0]));
  var rechts = wizPaneel('Preview',
    '<div class="wiz-adpreview">' +
      (beeld ? '<div class="wiz-adpreview-beeld"><img src="' + beeld + '" alt=""></div>' : '') +
      '<div class="wiz-adpreview-tekst">' +
        '<div class="wiz-copy-headline">' + wizEsc(c.headline) + '</div>' +
        (c.supporting ? '<div class="wiz-copy-sub">' + wizEsc(c.supporting) + '</div>' : '') +
        (c.proof ? '<div class="wiz-copy-proof">' + wizEsc(c.proof) + '</div>' : '') +
        (c.cta ? '<div class="wiz-copy-cta">' + wizEsc(c.cta) + '</div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="wiz-vizvoorbeeld-bij">Layout impression. The generator decides the final composition.</div>');

  return { links: links, rechts: rechts };
}

/* De headlines waaruit je kunt kiezen: de huidige plus wat Rory als
   alternatief aandroeg. Zonder dubbelen, want twee keer dezelfde regel als
   "keuze" aanbieden is geen keuze. */
function wizHeadlineOpties() {
  var c = wizState.data.copy;
  var uit = c.headline ? [c.headline] : [];
  ((wizState.advice.copy || {}).alternatives || []).forEach(function (a) {
    var t = a && a.values && a.values.headline;
    if (t && uit.indexOf(t) === -1) uit.push(t);
  });
  return uit;
}

window.wizRender_product = wizRender_product; window.wizRender_audience = wizRender_audience;
window.wizRender_strategy = wizRender_strategy; window.wizRender_format = wizRender_format;
window.wizRender_visual = wizRender_visual; window.wizRender_copy = wizRender_copy;
window.wizAfter_audience = wizAfter_audience;
window.wizPick = wizPick; window.wizPickProduct = wizPickProduct;
window.wizFieldSave = wizFieldSave; window.wizAskFor = wizAskFor;
window.wizToggleAllFormats = wizToggleAllFormats; window.wizTakeAlternative = wizTakeAlternative;
window.wizVisualOptionsText = wizVisualOptionsText; window.WIZ_VISUAL = WIZ_VISUAL;
window.WIZ_AWARENESS = WIZ_AWARENESS; window.WIZ_SOPHISTICATION = WIZ_SOPHISTICATION;
window.WIZ_DIFFERENTIATION = WIZ_DIFFERENTIATION; window.wizSofistHint = wizSofistHint; window.WIZ_FUNNELS = WIZ_FUNNELS; window.WIZ_PLACEMENTS = WIZ_PLACEMENTS;
window.wizOpenVeld = wizOpenVeld; window.wizToggleUitklap = wizToggleUitklap;
window.wizNetKlas = wizNetKlas; window.wizZin = wizZin; window.wizDenkt = wizDenkt; window.wizUitklap = wizUitklap;
window.wizOptLabel = wizOptLabel; window.wizChoices = wizChoices; window.wizField = wizField;
window.wizSelect = wizSelect; window.wizTegels = wizTegels; window.wizPaneel = wizPaneel;
window.wizWireVorm = wizWireVorm; window.wizHeadlineOpties = wizHeadlineOpties;
window.WIZ_STRATEGIE_RIJEN = WIZ_STRATEGIE_RIJEN;
