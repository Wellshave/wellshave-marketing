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

var wizScore = { bezig: false, uitslag: null, voorConcept: null };

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

  h += '<div class="wiz-actions"><button type="button" class="wiz-btn ghost small" ' +
    'onclick="wizScorekaart()">Score again</button></div>';
  return h + '</div>';
}

window.wizScore = wizScore; window.wizScorekaart = wizScorekaart;
window.wizRenderScorekaart = wizRenderScorekaart; window.wizScorekaartBrief = wizScorekaartBrief;
