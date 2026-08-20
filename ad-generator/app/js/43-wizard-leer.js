/* Static Ad Wizard — de leer.
 *
 * Eén plek voor wat het systeem gelooft over statics, afkomstig uit de twee
 * skills die de mens ernaast gebruikt: Rory Sutherland (het creatieve atelier)
 * en Nick Theriot (de media-inkoper die kijkt of het spendt). Waar ze het
 * oneens zijn staat dat er ook bij, want dat is informatie en geen probleem.
 *
 * Waarom dit een apart bestand is en niet vijf keer in een prompt: dezelfde
 * regels sturen de conceptbrief, de takes, Rory's advies per stap en de
 * scorekaart achteraf. Staan ze op vijf plekken, dan lopen ze uit elkaar en
 * beoordeelt de scorekaart iets anders dan de brief heeft opgedragen.
 *
 * De kern, in twee zinnen die alles eronder verklaren:
 *
 *   Awareness bepaalt hoe DIRECT je mag praten. Sophistication bepaalt WELK
 *   SOORT claim er nog geloofd wordt. Zet je er een verkeerd, dan redt geen
 *   enkele uitvoering het.
 *
 * En de wet van de static: één idee, een halve seconde. Het faalgeval is nooit
 * te weinig, het is altijd optellen -- nog een voordeel, nog een badge, nog een
 * regel. Elke toevoeging voelt gratis en deelt de aandacht op.
 *
 * TAAL: interface Engels, commentaren Nederlands.
 */

/* ── De twee assen ──────────────────────────────────────────────────────── */

/* Wat een static voorop zet, per bewustzijnsniveau. Uit Schwartz via beide
   skills. Let op 'unaware': daar verkoop je het product NIET in de hook, je
   verkoopt de reden om te blijven kijken. */
var WIZ_AWARENESS_SPEL = {
  unaware:  'Do not lead with the product, and not even with the problem. Lead with something that earns the look: a question, a comparison, a spectacle. The image is deliberately plain and native; the argument lives in the primary text.',
  problem:  'Name the problem sharply and kindly, in their own words, then show the mechanism. Diagnosis works here.',
  solution: 'Lead with the outcome they want, or with your solution positioned against the alternatives. Which of the two is a sophistication decision.',
  product:  'Why you: proof, comparison, the objection killed on the image itself.',
  most:     'The offer is the creative. Deal, deadline, last chance.'
};

/* Welk claimniveau nog werkt, per sophistication-stadium. */
var WIZ_SOFIST_SPEL = {
  s1: 'State the claim plainly. You are first; do not complicate it.',
  s2: 'Same claim as everyone, escalated: a specific number, a bigger scale, a sharper promise.',
  s3: 'Bare claims are spent here. Introduce the mechanism -- the how -- and pair it with the superiority it produces.',
  s4: 'Everyone has a mechanism now. Yours must be visibly better, product against product.',
  s5: 'Stop selling the product. Sell the identity and the tribe. Open it the way you open an unaware ad: the reason to keep looking, not the product.'
};

/* ── De acht eigenschappen van ads die spenden ──────────────────────────── */

/* De pre-launch scorekaart, ongeacht het formaat. Nummer 2 is degene die een
   creatief mens systematisch mist, en degene die het vaakst verklaart waarom
   een mooie ad nooit spendt. */
var WIZ_TRAITS = [
  { key: 'visual',    label: 'Visual hook that grabs',
    vraag: 'Is the opening image something this person has not seen a hundred times, and does it catch the RIGHT person?' },
  { key: 'tam',       label: 'Built for a large audience',
    vraag: 'Are the call-out, problem and desire shared by enough people to spend into? Narrow and poetic does not scale.' },
  { key: 'intention', label: 'Intention behind every word',
    vraag: 'Does every line do a job -- call out, open curiosity, name the problem, answer the objection, prove, explain, ask? Any filler?' },
  { key: 'close',     label: 'Built to close on this ad alone',
    vraag: 'Problem, why it matters, how it works, proof, CTA: are they all present in this one ad?' },
  { key: 'simple',    label: 'Explains the product very simply',
    vraag: 'Would a twelve-year-old follow it? A confused mind says no.' },
  { key: 'different', label: 'It is different',
    vraag: 'Different visual, avatar, mechanism or format than the others selling something similar? Name which.' },
  { key: 'now',       label: 'Relevant right now',
    vraag: 'Is this desire intense THIS week -- season, weather, occasion, deadline? Or is it a must-be-nice?' },
  { key: 'boring',    label: 'It is not boring',
    vraag: 'Honestly: does it bore you on your own screen? Then it is boring and it will not convert.' }
];

/* De statische checklist. Overlapt bewust met de acht: dit zijn de dingen die
   alleen bij een poster gelden. */
var WIZ_STATIC_CHECK = [
  'One idea, graspable in half a second',
  'Different from the feed, not merely competent',
  'Main headline short; a longer message split into a sub-headline',
  'Proof visible, not claimed',
  'Copy and image on the same awareness AND sophistication stage',
  'Not overloaded -- something was deliberately left out',
  'Who it is for: called out or shown',
  'Audience large enough to be worth owning',
  'Not boring'
];

/* ── De opdracht die uit de leer volgt ──────────────────────────────────── */

function wizLeerAwareness() {
  var a = wizState.data.audience.awareness;
  return a ? (WIZ_AWARENESS_SPEL[a] || '') : '';
}

function wizLeerSofist() {
  var sf = wizState.data.audience.sophistication;
  return sf ? (WIZ_SOFIST_SPEL[sf] || '') : '';
}

/* Het blok dat aan elke generatie-opdracht hangt. Dit is de leer als
 * instructie: de twee assen ingevuld voor DEZE ad, de wet van het ene idee, en
 * de regels die anders stilzwijgend overtreden worden.
 *
 * De laatste alinea is de belangrijkste en de makkelijkste om te vergeten:
 * genereer vanuit het mechanisme en toets aan wat werkt, nooit andersom. Een
 * model dat uit de lijst met werkende patronen put levert precies het
 * categoriegemiddelde, en dat is waar we vanaf proberen te komen. */
function wizLeerBrief() {
  var d = wizState.data;
  var t = '\n## DE LEER (dit gaat voor op smaak)\n';

  var a = wizLeerAwareness();
  if (a) t += 'Awareness — ' + wizLabel('awareness', d.audience.awareness) + ': ' + a + '\n';
  var sf = wizLeerSofist();
  if (sf) t += 'Sophistication — ' + wizSofistLabel(d.audience.sophistication) + ': ' + sf + '\n';
  if (a && sf) {
    t += 'Copy and image must sit on BOTH of those stages at once. A headline written for ' +
         'a beginner over an image composed for a connoisseur is the most common way a ' +
         'competent static fails, and it is invisible unless you check for it.\n';
  }
  if (d.strategy.differentiation) {
    t += 'Different how: ' + wizDiffLabel(d.strategy.differentiation) +
         '. Every concept must actually use that lever, not merely be pretty.\n';
  }
  /* De bestemming staat in de leer en niet alleen in de brief, omdat hij een
     regel is en geen voorkeur: hoe minder de lezer weet, hoe meer pagina er
     nodig is voordat een product logisch wordt. Meta leest de ad en de pagina
     samen, dus een mismatch kost bereik voordat hij conversie kost. */
  t += 'Destination is part of the ad, not an afterthought. Unaware and problem-aware ' +
       'traffic needs an advertorial or a quiz, because the diagnosis has to happen ' +
       'before a product means anything. Solution-aware and product-aware traffic belongs ' +
       'on a listicle, where you control which points land before the product page. ' +
       'Product-aware and most-aware traffic can go straight to the product page. ' +
       'The platform reads the creative AND the page and uses both to decide who to show ' +
       'this to, so an ad built for a new tribe pointing at a page built for the old mass ' +
       'market sends a contradictory signal.\n';

  t += '\nThe law of the static: ONE idea, half a second. The failure mode is never too ' +
       'little, it is addition -- one more benefit, one more badge, one more line. If an ' +
       'element does not serve the one idea, it is not neutral: remove it.\n' +
       'Proof must be VISIBLE, not claimed. Show the before and after, the mechanism, the ' +
       'guard against the skin, the review, a number precise enough to be checked. ' +
       'Assertions are free and read as free.\n' +
       'Headline short. Needs it more room, split it: a short line that survives the ' +
       'glance plus a sub-headline for whoever the glance recruited. Specific beats ' +
       'superlative, and on a static it beats it twice, because a precise number is the ' +
       'cheapest proof there is.\n' +
       'Next to your ad sit the competitors\' ads. If everyone says the same thing the ' +
       'customer picks at random, and you cannot win a coin flip at scale.\n' +
       '\nGenerate from the mechanism -- why this works on a human being -- and only then ' +
       'check it against what is currently taking spend. Never the other way round: ' +
       'working from the list of what already works produces the category average.\n';
  return t;
}

/* ── De uitlijningscontrole ─────────────────────────────────────────────── */

/* Wat je zonder model kunt vaststellen. Geen oordeel over smaak, alleen de
 * dingen die aantoonbaar niet kloppen. Dit draait vóór er beeld gegenereerd
 * wordt, want een misuitgelijnd concept kost anders een generatie om te leren.
 *
 * Elke controle geeft een reden terug, niet alleen een vlag: "mist" is
 * bruikbaar, "ongeldig" is dat niet. */
function wizUitlijning(concept) {
  var d = wizState.data, uit = [];
  var c = concept || {};

  if (!d.audience.awareness) uit.push({ key: 'awareness', tekst: 'No awareness stage set, so nothing can be aligned to it.' });
  if (!d.audience.sophistication) uit.push({ key: 'sophistication', tekst: 'No sophistication stage set: the claim level is a guess.' });

  /* Twee combinaties gedragen zich hetzelfde en worden allebei stelselmatig
     verkeerd uitgevoerd: bij unaware en bij stadium 5 mag het product niet de
     opening zijn. */
  if ((d.audience.awareness === 'unaware' || d.audience.sophistication === 's5')) {
    var kop = String(c.headline_nl || d.copy.headline || '');
    var p = wizProduct();
    if (p && kop && kop.toLowerCase().indexOf(String(p.name).toLowerCase()) > -1) {
      uit.push({ key: 'opening',
                 tekst: 'At this stage the opening sells the reason to keep looking, not the product, but the product name is in the headline.' });
    }
  }

  /* Vanaf stadium 3 gelooft de markt geen kale claim meer. Dan moet er een
     mechanisme zijn -- niet omdat het mooi staat, maar omdat het het enige is
     wat een uitgekeken markt nog als reden accepteert. */
  if ((d.audience.sophistication === 's3' || d.audience.sophistication === 's4') && !d.strategy.mechanism) {
    uit.push({ key: 'mechanism',
               tekst: 'Sophistication 3 or higher without a mechanism: a bare claim in a market that stopped believing bare claims.' });
  }

  if (!d.strategy.proof && !d.copy.proof) {
    uit.push({ key: 'proof', tekst: 'Nothing to show. A static cannot argue, so it has to demonstrate.' });
  }

  if (!d.strategy.differentiation) {
    uit.push({ key: 'different', tekst: 'No differentiation lever named, so "different" is a compliment rather than a decision.' });
  }

  if (!d.copy.removed) {
    uit.push({ key: 'removed', tekst: 'Nothing was deliberately left out. Addition is the failure mode of every static.' });
  }

  var kopl = String(c.headline_nl || d.copy.headline || '');
  if (kopl && kopl.length > 60) {
    uit.push({ key: 'headline', tekst: 'Headline is ' + kopl.length + ' characters. Nobody reads a long headline on an image; split it.' });
  }

  return uit;
}

window.WIZ_AWARENESS_SPEL = WIZ_AWARENESS_SPEL; window.WIZ_SOFIST_SPEL = WIZ_SOFIST_SPEL;
window.WIZ_TRAITS = WIZ_TRAITS; window.WIZ_STATIC_CHECK = WIZ_STATIC_CHECK;
window.wizLeerBrief = wizLeerBrief; window.wizUitlijning = wizUitlijning;
window.wizLeerAwareness = wizLeerAwareness; window.wizLeerSofist = wizLeerSofist;

/* ── Welke waarden een veld aankan ──────────────────────────────────────── */

/* Zonder deze lijst mag een model iets terugsturen wat de wizard niet kent --
   'moody bathroom' waar 'bathroom' hoort -- en dan is het veld formeel gevuld
   maar staat er niets dat de generator leest. Het staat hier en niet bij een
   van de twee ingangen, omdat het gesprek en de brain dump allebei dezelfde
   velden vullen en dus dezelfde grens nodig hebben. */
function wizToegestaan(vak, veld) {
  function w(lijst) { return (lijst || []).map(function (o) { return o.value; }); }
  if (vak === 'product' && veld === 'placement' && typeof WIZ_PLACEMENTS !== 'undefined') return w(WIZ_PLACEMENTS);
  if (vak === 'product' && veld === 'funnel' && typeof WIZ_FUNNELS !== 'undefined') return w(WIZ_FUNNELS);
  if (vak === 'audience' && veld === 'awareness' && typeof WIZ_AWARENESS !== 'undefined') return w(WIZ_AWARENESS);
  if (vak === 'audience' && veld === 'sophistication' && typeof WIZ_SOPHISTICATION !== 'undefined') return w(WIZ_SOPHISTICATION);
  if (vak === 'strategy' && veld === 'differentiation' && typeof WIZ_DIFFERENTIATION !== 'undefined') return w(WIZ_DIFFERENTIATION);
  if (vak === 'strategy' && veld === 'destination' && typeof WIZ_BESTEMMINGEN !== 'undefined') return w(WIZ_BESTEMMINGEN);
  if (vak === 'visual' && typeof WIZ_VISUAL !== 'undefined') {
    var r = WIZ_VISUAL.filter(function (x) { return x.field === veld; })[0];
    if (r) return w(r.opts);
  }
  if (vak === 'format' && veld === 'formatId' && typeof AD_FORMATS !== 'undefined') {
    return AD_FORMATS.map(function (x) { return x.id; });
  }
  return null;
}

/* Zetten met de grens erbij. Een waarde die niet in de lijst staat wordt
   geweigerd in plaats van opgeslagen: leeg is zichtbaar, een onbekende waarde
   ziet eruit als een besluit en is het niet. Geeft terug of het gelukt is. */
function wizZetGevalideerd(vak, veld, waarde, bron) {
  if (waarde === '' || waarde == null) return false;
  var lijst = wizToegestaan(vak, veld);
  if (lijst && lijst.length && lijst.indexOf(waarde) === -1) {
    var raak = lijst.filter(function (v) {
      return String(v).toLowerCase() === String(waarde).toLowerCase();
    })[0];
    if (!raak) return false;
    waarde = raak;
  }
  wizSet(vak, veld, waarde, bron || 'rory');
  return true;
}

/* ── De zelfcontrole vooraf ─────────────────────────────────────────────────
 *
 * De scorekaart vond fouten in concepten die uit een volledig interview kwamen.
 * Dat is de verkeerde volgorde: als we weten waarop straks beoordeeld wordt,
 * dan hoort dat in de opdracht te staan en niet pas in het rapport erna.
 *
 * Dus krijgt de conceptopdracht de acht eigenschappen mee als voorwaarde, met
 * de twee die het vaakst sneuvelen expliciet: gebouwd om op deze ene ad te
 * sluiten (probleem, waarom het ertoe doet, hoe het werkt, bewijs, CTA) en
 * bewijs dat je ZIET. Plus de opdracht om het eigen werk na te lopen voordat
 * het ingeleverd wordt.
 *
 * Dat maakt de scorekaart niet overbodig -- een tweede paar ogen vindt altijd
 * iets -- maar het scheelt het verschil tussen een rapport met vijf gele
 * driehoekjes en een met een enkele. */
function wizZelfcontrole() {
  var t = '\n## VOORDAT JE DIT INLEVERT\n' +
    'This gets scored against the eight traits of ads that spend before it runs. Meet them ' +
    'now rather than being told afterwards:\n';
  WIZ_TRAITS.forEach(function (tr, i) {
    t += (i + 1) + '. ' + tr.label + ' — ' + tr.vraag + '\n';
  });
  t += '\nTwo of these fail most often, so treat them as conditions rather than ambitions:\n' +
    '- BUILT TO CLOSE ON THIS AD ALONE. Assume it is the only ad they will ever see. The ' +
    'problem, why it matters, how it works, the proof and the call to action are all present ' +
    'on the one image. A headline plus a button is not an ad, it is a poster for one.\n' +
    '- PROOF YOU CAN SEE. A pretty close-up of metal proves nothing. Name what is visible in ' +
    'frame that a sceptic could check: the mechanism doing its work, a before and after, a ' +
    'rating with its number, a guarantee with its term.\n' +
    '\nThen read your own concept back as if you were the buyer scrolling past it, and repair ' +
    'whatever you would have scrolled past. Do that before you answer, not after.\n';
  return t;
}

window.wizZelfcontrole = wizZelfcontrole;

/* ── De scorekaart ──────────────────────────────────────────────────────────
 *
 * De pre-launch controle op het gekozen concept. Twee lagen, bewust
 * gescheiden:
 *
 *   1. Wat vaststaat zonder model (wizUitlijning hierboven). Ontbrekende
 *      stadia, geen mechanisme waar de markt er een eist, geen bewijs, een
 *      headline van tachtig tekens. Dat is geen smaak, dat is te tellen, en
 *      het draait gratis en direct.
 *   2. Wat een oordeel vraagt: de acht eigenschappen. Daar gaat Rory over, en
 *      dat kost een aanroep, dus het gebeurt op verzoek en niet vanzelf.
 *
 * De volgorde is niet willekeurig. Laag 1 vangt precies de fouten waarvoor je
 * geen $4M aan spend nodig hebt om ze te zien, en die het model anders
 * beleefd zou wegschrijven. */

var wizScore = { bezig: false, uitslag: null, voorConcept: null, toegepast: null, nick: null };

function wizScorekaartBrief() {
  var d = wizState.data;
  var c = (d.concepts.list || [])[d.concepts.selected] || {};
  var t = 'Score this static against the eight traits of ads that spend. Be honest: ' +
          'vague praise helps nobody, and if the core idea is dead, say so and name a ' +
          'different angle instead of polishing it.\n\n';

  t += 'THE AD\n';
  t += 'Headline: ' + (c.headline_nl || d.copy.headline || '') + '\n';
  if (c.hook_label_nl) t += 'Hook type: ' + c.hook_label_nl + '\n';
  if (c.visual_nl) t += 'Visual: ' + c.visual_nl + '\n';
  if (d.copy.supporting) t += 'Supporting line: ' + d.copy.supporting + '\n';
  if (d.copy.cta) t += 'CTA: ' + d.copy.cta + '\n';
  if (d.copy.removed) t += 'Deliberately left out: ' + d.copy.removed + '\n';

  t += '\nTHE DECISIONS BEHIND IT\n';
  var pers = wizPersona(), p = wizProduct();
  if (p) t += 'Product: ' + p.name + '\n';
  if (pers) t += 'Persona: ' + pers.name + '\n';
  if (d.audience.awareness) t += 'Awareness: ' + wizLabel('awareness', d.audience.awareness) + '\n';
  if (d.audience.sophistication) t += 'Sophistication: ' + wizSofistLabel(d.audience.sophistication) + '\n';
  if (d.strategy.differentiation) t += 'Differentiation lever: ' + wizDiffLabel(d.strategy.differentiation) + '\n';
  if (d.strategy.mechanism) t += 'Mechanism: ' + d.strategy.mechanism + '\n';
  if (d.strategy.marketingAngle) t += 'Marketing angle: ' + d.strategy.marketingAngle + '\n';
  if (d.strategy.proof) t += 'Proof: ' + d.strategy.proof + '\n';
  if (d.strategy.timing) t += 'Why now: ' + d.strategy.timing + '\n';

  t += '\nTHE EIGHT TRAITS\n';
  WIZ_TRAITS.forEach(function (tr, i) {
    t += (i + 1) + '. ' + tr.label + ' — ' + tr.vraag + '\n';
  });

  t += '\nAnswer with strict JSON, no markdown fences:\n' +
       '{"verdict":"one line: will this take spend and hold, and the single biggest reason",' +
       '"spend":true|false,' +
       '"traits":[{"key":"visual|tam|intention|close|simple|different|now|boring",' +
       '"score":"strong|weak|broken","why":"one sentence of evidence"}],' +
       '"fixes":[{"before":"the weak line or element as it is now","after":"your rewrite"}]}\n' +
       'Score all eight. At most three fixes, highest leverage first.';
  return t;
}

function wizScorekaart() {
  if (wizScore.bezig) return;
  if (wizState.data.concepts.selected == null) {
    if (typeof toast === 'function') toast('Pick a concept to score', true);
    return;
  }
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true);
    return;
  }
  wizScore.bezig = true;
  wizScore.voorConcept = wizState.data.concepts.selected;
  wizRender();

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  wizCall(WIZ_RORY_SYSTEM, [{ role: 'user', content: ctx.text + '\n\n' + wizScorekaartBrief() }], 1600)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      wizScore.uitslag = (o && o.traits) ? o : null;
      if (!wizScore.uitslag) throw new Error('no scorecard came back');
    })
    .catch(function (err) {
      wizScore.uitslag = null;
      if (typeof toast === 'function') toast('Scorecard failed: ' + err.message, true);
    })
    .finally(function () { wizScore.bezig = false; wizRender(); });
}

/* De harde controles horen altijd zichtbaar te zijn, ook zonder aanroep: ze
   kosten niets en ze vangen de fouten die een generatie verspillen. */
function wizRenderScorekaart() {
  var gaten = wizUitlijning((wizState.data.concepts.list || [])[wizState.data.concepts.selected]);
  var h = '';

  /* Wat de vorige ronde veranderd heeft, blijft even staan: anders zie je de
     knop iets doen en weet je niet wat. */
  if (wizScore.toegepast) {
    h += '<div class="wiz-score-gedaan"><div class="wiz-score-kop">Applied</div><ul>' +
      (wizScore.toegepast.veranderd || []).map(function (v) {
        return '<li>' + wizEsc(v) + '</li>'; }).join('') + '</ul>' +
      (wizScore.toegepast.beeldVerouderd
        ? '<div class="wiz-score-oud">The picture still shows the previous version. ' +
          'Generate it again when you are happy with the words.</div>'
        : '') + '</div>';
  }

  if (gaten.length) {
    h += '<div class="wiz-score-hard"><div class="wiz-score-kop">Before you spend a generation</div>' +
      '<ul>' + gaten.map(function (g) {
        return '<li>' + wizEsc(g.tekst) + '</li>';
      }).join('') + '</ul></div>';
  } else {
    h += '<div class="wiz-score-hard ok">Nothing structural is missing: both stages set, a mechanism ' +
         'where the market needs one, proof to show, a named difference and something left out.</div>';
  }

  if (wizScore.bezig) return h + wizDenkt('Rory is scoring this against the eight traits of ads that spend.');

  var u = wizScore.uitslag;
  if (!u || wizScore.voorConcept !== wizState.data.concepts.selected) {
    return h + '<div class="wiz-actions"><button type="button" class="wiz-btn ghost small" ' +
      'onclick="wizScorekaart()">Score the eight traits</button></div>';
  }

  var teken = { strong: '✅', weak: '⚠️', broken: '❌' };
  h += '<div class="wiz-score">' +
    '<div class="wiz-score-verdict' + (u.spend ? '' : ' nee') + '">' + wizEsc(u.verdict || '') + '</div>' +
    '<div class="wiz-score-rijen">' + (u.traits || []).map(function (t) {
      var tr = WIZ_TRAITS.filter(function (x) { return x.key === t.key; })[0];
      return '<div class="wiz-score-rij ' + wizEsc(t.score || '') + '">' +
        '<span class="wiz-score-t">' + (teken[t.score] || '•') + '</span>' +
        '<span class="wiz-score-l">' + wizEsc(tr ? tr.label : t.key) + '</span>' +
        '<span class="wiz-score-w">' + wizEsc(t.why || '') + '</span></div>';
    }).join('') + '</div>';

  if ((u.fixes || []).length) {
    h += '<div class="wiz-score-fixes"><div class="wiz-score-kop">Highest-leverage fixes</div>' +
      (u.fixes || []).map(function (f) {
        return '<div class="wiz-score-fix">' +
          '<div class="wiz-score-voor">' + wizEsc(f.before || '') + '</div>' +
          '<div class="wiz-score-na">' + wizEsc(f.after || '') + '</div></div>';
      }).join('') + '</div>';
  }

  h += '<div class="wiz-actions">' +
    ((u.fixes || []).length
      ? '<button type="button" class="wiz-btn primary" onclick="wizFixesToepassen()">' +
        'Apply these ' + (u.fixes || []).length + ' fixes</button>'
      : '') +
    '<button type="button" class="wiz-btn ghost small" onclick="wizScorekaart()">Score again</button>' +
    '</div>';
  return h + '</div>';
}

window.wizToegestaan = wizToegestaan;
window.wizZetGevalideerd = wizZetGevalideerd;
/* ── De fixes toepassen ─────────────────────────────────────────────────────
 *
 * Een scorekaart die zegt wat er mis is en je het zelf laat overtypen is een
 * rapport, geen gereedschap. Rory heeft de voor-en-na al geschreven; dan hoort
 * er een knop te zitten die ze doorvoert.
 *
 * Wat hij aanraakt: het gekozen concept en de copy-velden. Niet de strategie --
 * persona, awareness, sophistication en de hoek zijn besluiten die jij genomen
 * hebt, en die herschrijft een fix-knop niet. Verandert er iets aan de
 * uitvoering, dan is het beeld verouderd, en dat zeggen we in plaats van het
 * stilletjes te laten staan. */
function wizFixesToepassen() {
  if (wizScore.bezig || !wizScore.uitslag) return;
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true);
    return;
  }
  var sel = wizState.data.concepts.selected;
  if (sel == null) return;

  wizScore.bezig = true;
  wizRender();

  var u = wizScore.uitslag;
  var d = wizState.data;
  var c = (d.concepts.list || [])[sel] || {};
  var opdracht = 'Rewrite this static so the weak points below are gone. Not a new idea: the ' +
    'same concept, repaired.\n\n' +
    'THE CONCEPT AS IT STANDS\n' +
    'Headline: ' + (c.headline_nl || d.copy.headline || '') + '\n' +
    (c.visual_nl ? 'Visual: ' + c.visual_nl + '\n' : '') +
    (d.copy.supporting ? 'Supporting line: ' + d.copy.supporting + '\n' : '') +
    (d.copy.cta ? 'CTA: ' + d.copy.cta + '\n' : '') + '\n' +
    'THE VERDICT\n' + (u.verdict || '') + '\n\n' +
    'WHAT IS WEAK OR BROKEN\n' +
    (u.traits || []).filter(function (t) { return t.score !== 'strong'; })
      .map(function (t) {
        var tr = WIZ_TRAITS.filter(function (x) { return x.key === t.key; })[0];
        return '- ' + (tr ? tr.label : t.key) + ': ' + (t.why || '');
      }).join('\n') + '\n\n' +
    'THE FIXES YOU ALREADY WROTE (carry them out, do not restate them)\n' +
    (u.fixes || []).map(function (f) {
      return '- was: ' + (f.before || '') + '\n  becomes: ' + (f.after || '');
    }).join('\n') + '\n\n' +
    'Keep the persona, the awareness stage, the sophistication stage, the angle and the core ' +
    'promise exactly as they are. Those are decided. What you change is the execution: the ' +
    'words on the image and what the picture has to show.\n' +
    'Answer with strict JSON: {"headline_nl":"","visual_nl":"what the picture shows, with the ' +
    'proof visible","supporting_nl":"","cta_nl":"","removed":"what you left off and why",' +
    '"changed":["one line per thing you actually changed"]}';

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  wizCall(WIZ_RORY_SYSTEM, [{ role: 'user', content: ctx.text + '\n\n' + opdracht }], 1600)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (!o || !o.headline_nl) throw new Error('nothing came back');

      var lijst = wizState.data.concepts.list || [];
      var vernieuwd = JSON.parse(JSON.stringify(lijst[sel] || {}));
      vernieuwd.headline_nl = o.headline_nl;
      if (o.visual_nl) vernieuwd.visual_nl = o.visual_nl;
      lijst[sel] = vernieuwd;
      /* Ook in de variatielijst waar de beeldgenerator uit leest, anders maakt
         hij straks nog het oude beeld. */
      if (state.lastGenerated && state.lastGenerated.variations) {
        state.lastGenerated.variations[sel] = vernieuwd;
      }

      wizSet('copy', 'headline', o.headline_nl, 'rory');
      if (o.supporting_nl) wizSet('copy', 'supporting', o.supporting_nl, 'rory');
      if (o.cta_nl) wizSet('copy', 'cta', o.cta_nl, 'rory');
      if (o.removed) wizSet('copy', 'removed', o.removed, 'rory');

      /* Het beeld dat er staat hoort bij de vorige versie. Dat zeggen we, en we
         gooien het niet weg: vergelijken is het halve werk. */
      wizScore.toegepast = { veranderd: o.changed || [], beeldVerouderd: !!(state.generatedImages || {})[sel] };
      wizScore.uitslag = null;
      wizSave();
      if (typeof toast === 'function') toast('Fixes applied to this concept');
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Could not apply the fixes: ' + err.message, true);
    })
    .finally(function () { wizScore.bezig = false; wizRender(); });
}

window.wizFixesToepassen = wizFixesToepassen;
window.wizScore = wizScore; window.wizScorekaart = wizScorekaart;
window.wizRenderScorekaart = wizRenderScorekaart; window.wizScorekaartBrief = wizScorekaartBrief;

/* ── Nick over een beeld dat er al staat ────────────────────────────────────
 *
 * De scorekaart oordeelt over het idee. Dit oordeelt over de foto, en dat is
 * een andere vraag: een concept kan kloppen terwijl het beeld het niet waar
 * maakt -- de claim staat er, maar je ziet hem niet.
 *
 * Daarom een aparte lens, en bewust die van de media-inkoper: hij kijkt of dit
 * beeld in een feed opvalt en of het bewijs zichtbaar is, niet of het mooi is.
 * Wat eruit komt is geen advies maar een nieuwe beeldopdracht, die meteen als
 * bewerking op dezelfde variatie gaat. Advies dat je zelf moet overtypen is de
 * helft van het werk.
 */
function wizNickHerprompt(i) {
  if (wizState.busy) return;
  var st = (state.generatedImages || {})[i];
  if (!st || !st.versions || !st.versions.length) {
    if (typeof toast === 'function') toast('Generate this picture first', true);
    return;
  }
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true);
    return;
  }
  var v = (state.lastGenerated && state.lastGenerated.variations[i]) || {};
  var d = wizState.data;

  wizState.busy = true;
  wizRender();

  var sys = 'You are Nick Theriot, a direct-response media buyer who spends roughly $4M a month ' +
    'on Meta. You are looking at ONE static that has already been rendered, and the only ' +
    'question you answer is whether this picture will take spend.\n' +
    'It is almost never the media buying, it is the creative, and the customer sees the ad, not ' +
    'the ad account. So judge the picture: is the visual hook something this person has not seen ' +
    'a hundred times, is the proof VISIBLE rather than claimed, does it look unlike the feed ' +
    'around it, and is it boring?\n' +
    'Being different is the whole game: next to this sit the competitor ads, and if everyone ' +
    'shows the same thing the buyer picks at random.\n' +
    'Exaggerate in the framing, the scale and the specificity, never in a claim about what the ' +
    'product does. Do not copy a direct competitor; borrow structures from other niches.\n' +
    'Answer with strict JSON: {"verdict":"one line: will this picture take spend, and the single ' +
    'biggest reason","weak":["what is wrong with the picture, one line each"],' +
    '"prompt":"the rewritten image instruction, in the language of the current one, concrete ' +
    'about what is in frame and where the proof is visible"}';

  var opdracht = 'THE PICTURE AS BRIEFED\n' + (v.visual_nl || d.review.visualDescription || '') + '\n\n' +
    'THE WORDS ON IT\n' + (v.headline_nl || d.copy.headline || '') + '\n' +
    (v.cta_nl || d.copy.cta ? 'CTA: ' + (v.cta_nl || d.copy.cta) + '\n' : '') + '\n' +
    'THE DECISIONS BEHIND IT\n' +
    (d.audience.awareness ? 'Awareness: ' + wizLabel('awareness', d.audience.awareness) + '\n' : '') +
    (d.audience.sophistication ? 'Sophistication: ' + wizSofistLabel(d.audience.sophistication) + '\n' : '') +
    (d.strategy.differentiation ? 'Differentiation lever: ' + wizDiffLabel(d.strategy.differentiation) + '\n' : '') +
    (d.strategy.mechanism ? 'Mechanism: ' + d.strategy.mechanism + '\n' : '') +
    (d.strategy.proof ? 'Proof available: ' + d.strategy.proof + '\n' : '');

  wizCall(sys, [{ role: 'user', content: opdracht }], 1200)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (!o || !o.prompt) throw new Error('no rewritten prompt came back');
      wizScore.nick = { voor: i, verdict: o.verdict || '', zwak: o.weak || [], prompt: o.prompt };
      wizSave();
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Nick could not look at it: ' + err.message, true);
    })
    .finally(function () { wizState.busy = false; wizRender(); });
}

/* Zijn herschreven opdracht uitvoeren. Als bewerking op dezelfde variatie, dus
   de vorige versie blijft staan om naast te leggen. */
function wizNickUitvoeren() {
  var n = wizScore.nick;
  if (!n || n.voor == null) return;
  if (!state.pendingEdits || typeof state.pendingEdits !== 'object') state.pendingEdits = {};
  state.pendingEdits[n.voor] = [{ type: 'adjust', text: n.prompt }];
  wizScore.nick = null;
  if (typeof applyCombinedEdits === 'function') {
    applyCombinedEdits(n.voor);
    if (typeof wizBeeldBezig !== 'undefined') { wizBeeldBezig[n.voor] = true; wizWachtOpBeeld(n.voor); }
  } else if (typeof toast === 'function') {
    toast('The edit panel is not available', true);
  }
  wizRender();
}

function wizNickWeg() { wizScore.nick = null; wizRender(); }

/* Zijn oordeel onder de drie variaties. Alleen bij de variatie waar het over
   gaat: een oordeel over take 1 onder take 3 is een oordeel over niets. */
function wizRenderNick(i) {
  var n = wizScore.nick;
  if (!n || n.voor !== i) return '';
  return '<div class="wiz-nick">' +
    '<div class="wiz-nick-k">Nick on this picture</div>' +
    '<div class="wiz-nick-v">' + wizEsc(n.verdict) + '</div>' +
    ((n.zwak || []).length
      ? '<ul class="wiz-nick-z">' + (n.zwak || []).map(function (z) {
          return '<li>' + wizEsc(z) + '</li>'; }).join('') + '</ul>'
      : '') +
    '<div class="wiz-nick-p">' + wizEsc(n.prompt) + '</div>' +
    '<div class="wiz-actions">' +
    '<button type="button" class="wiz-btn primary small" onclick="wizNickUitvoeren()">Redraw it this way</button>' +
    '<button type="button" class="wiz-btn ghost small" onclick="wizNickWeg()">Keep what I have</button>' +
    '</div></div>';
}

window.wizNickHerprompt = wizNickHerprompt; window.wizNickUitvoeren = wizNickUitvoeren;
window.wizNickWeg = wizNickWeg; window.wizRenderNick = wizRenderNick;
