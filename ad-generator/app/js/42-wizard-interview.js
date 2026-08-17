/* Static Ad Wizard — de interviewmodus.
 *
 * De tweede weg naar dezelfde blueprint. De negen stappen zijn klikken; dit is
 * praten. Rory stelt vraag na vraag, jij kiest uit een lijst of typt zelf, en
 * rechts loopt zichtbaar vol wat hij inmiddels van je begrepen heeft.
 *
 * Waarom dit naast de stappen bestaat en niet in plaats daarvan: de stappen zijn
 * beter als je weet wat je wil en alleen wilt bijstellen. Het gesprek is beter
 * als je nog niet weet waar je heen gaat -- dan is een leeg formulier met negen
 * kopjes een examen, en een vraag per keer niet.
 *
 * De regels die dit bestand volgt:
 *
 *   1. Het interview vult DEZELFDE velden als de stappen. Geen tweede
 *      administratie ernaast, want twee waarheden over dezelfde ad lopen
 *      gegarandeerd uit elkaar. Alles gaat via wizSet, met bron 'rory' of
 *      'user' zoals overal.
 *   2. Elke vraag heeft een uitweg ("Let Rory decide"). Wie het niet weet hoort
 *      niet vast te lopen op een keuze die hij niet kan maken.
 *   3. De keuzes zetten hun velden zelf, zonder taalmodel. Dat houdt het gesprek
 *      snel en gratis. Eén keer aan het eind roept Rory het model aan om de
 *      zinnen te schrijven die geen keuzelijst kan leveren: de hoek in woorden,
 *      de boodschap, de headline en zijn samenvatting.
 *   4. Beeld genereren doet dit bestand nooit. Dat blijft één bewuste klik in de
 *      wizard, want dat is de enige rem op de kosten.
 *
 * TAAL: interface Engels, commentaren Nederlands, net als de rest van de wizard.
 */

/* ── Toestand ───────────────────────────────────────────────────────────── */

var iw2 = {
  open: false,
  /* 'angle' of 'persona': waar we het concept vandaan beginnen. Dit bepaalt de
     volgorde van de vragen erna, want beginnen bij de boodschap en beginnen bij
     de mens leveren een ander gesprek op. */
  spoor: null,
  /* Index in de vragenlijst van het gekozen spoor. */
  i: 0,
  /* Het gesprek zoals het op het scherm staat: {wie:'rory'|'user', tekst, tijd} */
  chat: [],
  /* Welke optie je op welke vraag koos, voor de weg terug. */
  antwoorden: {},
  klaar: false,
  busy: false,
  /* Rory's samenvatting bij de blueprint. */
  samenvatting: ''
};

function iw2Tijd() {
  var d = new Date();
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

/* ── De vragen ──────────────────────────────────────────────────────────────
 *
 * Elke optie zegt zelf wat hij zet (`zet`) en wat Rory daarop antwoordt
 * (`gevolg`). Dat antwoord is geen sier: je moet kunnen zien wat je keuze
 * betekent, anders klik je door een lijst zonder te weten wat je besluit.
 *
 * `rory: true` markeert de uitweg. Die zet niets vast; Rory vult het veld aan
 * het eind in, en dan staat er bron 'rory' bij in plaats van 'user'. */

var IW2_VRAGEN = [
  {
    key: 'start', titel: 'Starting point', spoor: 'beide',
    vraag: 'Before we dive in: where do you want to start from?',
    opts: [
      { key: 'angle', label: 'From a marketing angle',
        sub: 'Start with the message. Rory works out who it fits.',
        gevolg: 'Good. We start with the message and I will find the audience that fits it.' },
      { key: 'persona', label: 'From a customer persona',
        sub: 'Start with who we are speaking to. Rory works out the angle.',
        gevolg: 'Good. We start with the person and I will find the angle that lands with them.' }
    ]
  },
  {
    key: 'persona', titel: 'Audience', spoor: 'persona',
    vraag: 'Who are we speaking to?',
    opties: 'personas',
    vraagUitleg: 'From your persona library.'
  },
  {
    key: 'goal', titel: 'Goal', spoor: 'beide', vrij: ['strategy', 'goal'],
    vraag: 'To get started, what is the main goal for this ad?',
    opts: [
      { key: 'reach', label: 'Reach new customers',
        zet: [['strategy', 'goal', 'Reach new customers'], ['product', 'funnel', 'tof']],
        gevolg: 'Perfect. We will focus on a message that attracts people who do not know the brand yet.' },
      { key: 'sales', label: 'Drive sales of a specific product',
        zet: [['strategy', 'goal', 'Drive sales of a specific product'], ['product', 'funnel', 'bof']],
        gevolg: 'Clear. We aim at people who are close to buying and need a reason to do it now.' },
      { key: 'offer', label: 'Promote an offer or discount',
        zet: [['strategy', 'goal', 'Promote an offer or discount'], ['product', 'funnel', 'bof']],
        gevolg: 'Right. The offer carries the ad, so the product has to be recognisable in one look.' },
      { key: 'angle', label: 'Test a new angle',
        zet: [['strategy', 'goal', 'Test a new angle'], ['product', 'funnel', 'mof']],
        gevolg: 'Good. A test is only worth running if it says something the current ads do not.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        gevolg: 'I will set the goal from the product data and what already ran.' }
    ]
  },
  {
    key: 'theme', titel: 'Angle direction', spoor: 'beide', vrij: ['strategy', 'theme'],
    vraag: 'The next big decision is the angle. Which direction should we lead with?',
    opts: [
      { key: 'safety', label: 'Safety & Confidence',
        zet: [['strategy', 'theme', 'Safety & Confidence']],
        gevolg: 'Leading with safety works when the fear of getting it wrong is bigger than the wish to get it right.' },
      { key: 'convenience', label: 'Convenience & Simplicity',
        zet: [['strategy', 'theme', 'Convenience & Simplicity']],
        gevolg: 'Convenience sells the time back, not the product. That needs a concrete before and after.' },
      { key: 'performance', label: 'Performance & Quality',
        zet: [['strategy', 'theme', 'Performance & Quality']],
        gevolg: 'Performance needs proof in the ad itself, otherwise it is a claim like every other claim.' },
      { key: 'premium', label: 'Premium & Upgrade',
        zet: [['strategy', 'theme', 'Premium & Upgrade']],
        gevolg: 'Premium is a promise about the buyer, not about the product. The visual has to carry it.' },
      { key: 'rory', label: 'Let Rory choose based on research', rory: true,
        gevolg: 'I will read the customer research and pick the entry point with the least resistance.' }
    ]
  },
  {
    key: 'format', titel: 'Format preference', spoor: 'beide',
    vraag: 'Now let us choose the format that will communicate this angle best.',
    opties: 'formats'
  },
  {
    key: 'visual', titel: 'Visual approach', spoor: 'beide', vorm: 'tegels',
    vraag: 'Let us define how the ad should look and feel. Which visual style would you prefer?',
    opts: [
      { key: 'premium', label: 'Premium', aanbevolen: true,
        zet: [['visual', 'mood', 'premium']],
        gevolg: 'Premium builds trust and positions the product as the safe choice.' },
      { key: 'ugc', label: 'Raw UGC',
        zet: [['visual', 'mood', 'ugc']],
        gevolg: 'Raw does not look like an ad, which is exactly why it survives the scroll.' },
      { key: 'minimal', label: 'Minimal',
        zet: [['visual', 'mood', 'minimal']],
        gevolg: 'Minimal only works if the one thing left in frame is strong enough to carry the ad.' },
      { key: 'bold', label: 'Bold & Vibrant',
        zet: [['visual', 'mood', 'bold']],
        gevolg: 'Bold buys attention. It has to survive being seen next to a calm feed.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        gevolg: 'I will match the style to the brand and to what the audience already trusts.' }
    ]
  },
  {
    key: 'human', titel: 'Human presence', spoor: 'beide',
    vraag: 'Should we include a person in the ad? This helps set the right scene and framing.',
    opts: [
      { key: 'model', label: 'Yes, use a model',
        zet: [['visual', 'humanPresence', 'model']],
        gevolg: 'A person in a real environment makes the message relatable.' },
      { key: 'hands', label: 'Hands only',
        zet: [['visual', 'humanPresence', 'hands']],
        gevolg: 'Hands show use without asking the viewer to identify with a stranger.' },
      { key: 'none', label: 'No person',
        zet: [['visual', 'humanPresence', 'none']],
        gevolg: 'No person keeps all attention on the product and the claim.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        gevolg: 'I will decide from the format and the reference photos we have.' }
    ]
  },
  {
    key: 'copy', titel: 'Copy direction', spoor: 'beide', vrij: ['copy', 'direction'],
    vraag: 'Let us craft the message. Which headline direction do you prefer?',
    opts: [
      { key: 'pain', label: 'Pain-focused', sub: 'Focus on the problem and the fear',
        zet: [['copy', 'direction', 'Pain-focused']],
        gevolg: 'I will write pain-led headlines that name the fear before the product.' },
      { key: 'benefit', label: 'Benefit-focused', sub: 'Lead with the main benefit',
        zet: [['copy', 'direction', 'Benefit-focused']],
        gevolg: 'Benefit-led only beats pain-led when the benefit is one nobody else claims.' },
      { key: 'curiosity', label: 'Curiosity-driven', sub: 'Use curiosity to start',
        zet: [['copy', 'direction', 'Curiosity-driven']],
        gevolg: 'Curiosity earns the click, but the ad has to pay it off or the click is wasted.' },
      { key: 'rory', label: 'Let Rory write the headline', rory: true,
        gevolg: 'I will pick the direction from the awareness level and write it out.' }
    ]
  }
];

/* De twee routes. Dit is waarom de startvraag gesteld wordt: hij bepaalt de
 * volgorde, en die volgorde is het gesprek.
 *
 *   Vanuit de hoek: eerst de boodschap, dan waar hij voor moet zorgen. De
 *   persona vraag ik niet -- ik zoek erbij wie het beste bij die boodschap past,
 *   want dat is de omgekeerde vraag en die kan ik met de research beantwoorden.
 *
 *   Vanuit de persona: eerst wie het is, dan wat je bij die persoon wil bereiken,
 *   en pas dan de hoek. Anders zou je een hoek kiezen voordat je weet voor wie,
 *   en dan is de persona een controle achteraf in plaats van een vertrekpunt.
 */
var IW2_ROUTES = {
  angle:   ['start', 'theme', 'goal', 'format', 'visual', 'human', 'copy'],
  persona: ['start', 'persona', 'goal', 'theme', 'format', 'visual', 'human', 'copy']
};

function iw2Vragen() {
  var route = IW2_ROUTES[iw2.spoor];
  /* Voordat je gekozen hebt is er één vraag: welke route het wordt. */
  if (!route) return [IW2_VRAGEN[0]];
  return route.map(function (k) {
    return IW2_VRAGEN.filter(function (v) { return v.key === k; })[0];
  }).filter(Boolean);
}

function iw2Vraag() {
  var v = iw2Vragen()[iw2.i];
  return v || null;
}

/* Opties die uit de eigen data komen in plaats van uit de lijst hierboven. */
function iw2Opties(v) {
  if (v.opties === 'personas') {
    var lijst = (state.personas || []).slice(0, 6).map(function (p) {
      return { key: p.id, label: p.name, sub: p.role || p.summary_nl || '',
               zet: [['audience', 'personaId', p.id]],
               gevolg: 'Good. Everything after this is written for ' + p.name + '.' };
    });
    lijst.push({ key: 'rory', label: 'Let Rory choose based on research', rory: true,
                 gevolg: 'I will read the research and pick the persona with the sharpest fit.' });
    return lijst;
  }
  if (v.opties === 'formats') {
    var aanbevolen = iw2AanbevolenFormat();
    var f = (typeof AD_FORMATS !== 'undefined' ? AD_FORMATS : []);
    var keuze = f.filter(function (x) { return iw2FormatKern().indexOf(x.id) > -1; });
    var uit = keuze.map(function (x) {
      return { key: x.id, label: x.name, sub: (x.tags || []).slice(0, 3).join(' · '),
               aanbevolen: x.id === aanbevolen,
               zet: [['format', 'formatId', x.id]],
               gevolg: x.desc };
    });
    uit.push({ key: 'rory', label: 'Let Rory pick from all formats', rory: true,
               gevolg: 'I will choose from all formats, not just the shortlist.' });
    return uit;
  }
  return v.opts || [];
}

/* Een korte lijst in plaats van alle formats. Tweeënveertig opties in een
   gesprek is geen vraag maar een catalogus. */
function iw2FormatKern() {
  return ['probleem-agitatie', 'product-hero', 'us-vs-them-tabel',
          'testimonial-pull-quote', 'news-headline-advertorial'];
}

/* De aanbeveling volgt uit het doel: koud publiek heeft een probleem nodig
   voordat het een product wil zien, warm publiek niet. */
function iw2AanbevolenFormat() {
  var f = wizState.data.product.funnel;
  if (f === 'bof' || f === 'retargeting') return 'product-hero';
  if (f === 'mof') return 'us-vs-them-tabel';
  return 'probleem-agitatie';
}

/* ── Openen en sluiten ──────────────────────────────────────────────────── */

function iw2Start() {
  /* Schone lei voor alles waar het gesprek zelf over gaat. Zonder dit staat er
     bij "wat ik tot nu toe begrepen heb" een doelgroep, een format en een stijl
     uit een vorige sessie, terwijl je nog bij de eerste vraag zit -- en dan
     beweert het scherm iets wat Rory helemaal niet weet. Stap 1 blijft staan:
     product, plaatsing en funnel heb je daar net zelf gekozen. */
  ['audience', 'strategy', 'format', 'visual', 'copy'].forEach(function (vak) {
    Object.keys(wizState.data[vak]).forEach(function (veld) {
      if (veld === 'referenceUsage') return;   /* geen keuze maar een instelling */
      wizSet(vak, veld, '', 'user');
    });
  });
  iw2.open = true;
  iw2.spoor = null;
  iw2.i = 0;
  iw2.chat = [];
  iw2.antwoorden = {};
  iw2.klaar = false;
  iw2.samenvatting = '';
  iw2Zeg('rory', IW2_VRAGEN[0].vraag);
  wizToonInline();
  wizRender();
}

/* Terug in het gesprek waar je was. Dit is niet hetzelfde als opnieuw
   beginnen: je hebt de wizard bekeken en wil iets uitpraten. */
function iw2Hervat() {
  iw2.open = true;
  wizToonInline();
  wizRender();
}

/* Exit vraagt door. Het gesprek is werk, en werk gooi je niet weg op één klik
   die je ook per ongeluk kunt doen. */
function iw2VraagExit() {
  iw2.exitVraag = true;
  wizRender();
}

function iw2ExitAf() { iw2.exitVraag = false; wizRender(); }

function iw2Exit() {
  iw2.open = false;
  iw2.exitVraag = false;
  iw2.chat = [];
  iw2.antwoorden = {};
  iw2.spoor = null;
  iw2.i = 0;
  iw2.klaar = false;
  wizToonInline();
  wizRender();
}

/* Naar de wizard, gesprek intact. Anders dan Exit: hier gaat niets verloren en
   staat de weg terug open. */
function iw2NaarWizard(stap) {
  iw2.open = false;
  iw2.exitVraag = false;
  wizToonInline();
  stap = stap || 'review';
  /* De poort van de wizard laat je alleen door als elke eerdere stap compleet
     is. Dat is juist zolang je klikt, maar niet na een interview: dat levert een
     blueprint met misschien een gat erin, en die moet je kunnen bekijken in
     plaats van er stil buiten te blijven staan. De blueprint zegt zelf welke
     velden nog leeg zijn. De blueprint bereikt hebben is hier de toestemming;
     zonder dat geldt de gewone poort. */
  if (iw2.klaar) {
    wizState.current = stap;
    wizSave();
    wizRender();
    return;
  }
  wizGo(stap);
}

function iw2Zeg(wie, tekst) {
  iw2.chat.push({ wie: wie, tekst: tekst, tijd: iw2Tijd() });
}

/* ── Antwoorden ─────────────────────────────────────────────────────────── */

function iw2Kies(optieKey) {
  if (iw2.busy) return;
  var v = iw2Vraag();
  if (!v) return;
  var opt = iw2Opties(v).filter(function (o) { return o.key === optieKey; })[0];
  if (!opt) return;

  iw2.antwoorden[v.key] = optieKey;
  iw2Zeg('user', opt.label);

  if (v.key === 'start') iw2.spoor = optieKey;

  /* De keuze zet zijn eigen velden. Een uitweg zet niets: dan blijft het veld
     leeg tot Rory het aan het eind invult, en dan staat er ook 'rory' bij. */
  if (opt.zet) {
    opt.zet.forEach(function (z) { wizSet(z[0], z[1], z[2], 'user'); });
  }
  if (opt.gevolg) iw2Zeg('rory', opt.gevolg);

  iw2Volgende();
}

function iw2Volgende() {
  var vragen = iw2Vragen();
  if (iw2.i < vragen.length - 1) {
    iw2.i++;
    var v = iw2Vraag();
    iw2Zeg('rory', v.vraag);
    wizSave();
    wizRender();
    return;
  }
  iw2Afronden();
}

/* Eén modelaanroep aan het eind. De keuzelijsten hebben de besluiten al gezet;
   wat een lijst niet kan leveren zijn de zinnen -- de hoek in woorden, de
   boodschap, de headline -- en de uitwegen die nog open staan. */
function iw2Afronden() {
  iw2.klaar = true;
  wizSave();
  wizRender();
  if (iw2.busy) return;
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) return;
  iw2.busy = true;
  wizRender();

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  var d = wizState.data;
  var open = [];
  if (!d.audience.personaId) open.push('persona (pick one from the library by name)');
  if (!d.audience.awareness) open.push('awareness level');
  if (!d.strategy.goal) open.push('goal');
  if (!d.strategy.theme) open.push('angle theme');
  if (!d.format.formatId) open.push('format');
  if (!d.visual.mood) open.push('visual mood');
  if (!d.copy.direction) open.push('headline direction');

  var sys = 'You are Rory Sutherland, closing an interview with a marketer. ' +
    'The decisions already made are in the context. Write the parts a picklist cannot deliver, ' +
    'and fill in only what is still missing. Be concrete, no marketing adjectives. ' +
    'Answer with strict JSON: {"marketingAngle":"one sentence","messaging":"one sentence",' +
    '"headline":"the headline itself","fill":{"field":"value"},"summary":"two or three sentences ' +
    'explaining what this creative does and why"}. ' +
    'Use field names from this list only when they are still open: ' + (open.join(', ') || 'none') + '.';

  wizCall(sys, [{ role: 'user', content: ctx.text }], 900)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (o.marketingAngle) wizSet('strategy', 'marketingAngle', o.marketingAngle, 'rory');
      if (o.messaging) wizSet('strategy', 'messaging', o.messaging, 'rory');
      if (o.headline) wizSet('copy', 'headline', o.headline, 'rory');
      iw2VulAan(o.fill || {});
      iw2.samenvatting = o.summary || '';
      /* De stappen die het gesprek gevuld heeft staan af: je hoeft ze niet nog
         een keer langs te lopen om verder te mogen. */
      ['product', 'audience', 'strategy', 'format', 'visual', 'copy'].forEach(function (k) {
        if (wizStepComplete(k)) wizState.done[k] = true;
      });
      wizSave();
    })
    .catch(function (err) {
      iw2Zeg('rory', 'I could not finish the blueprint: ' + err.message);
    })
    .finally(function () { iw2.busy = false; wizRender(); });
}

/* Rory's aanvullingen op de open gebleven velden. Alleen velden die de wizard
   kent, en alleen als ze nog leeg zijn -- een advies mag geen keuze van de
   gebruiker overschrijven. */
var IW2_VULBAAR = {
  persona: ['audience', 'personaId'], personaId: ['audience', 'personaId'],
  awareness: ['audience', 'awareness'],
  goal: ['strategy', 'goal'], theme: ['strategy', 'theme'],
  format: ['format', 'formatId'], formatId: ['format', 'formatId'],
  mood: ['visual', 'mood'], humanPresence: ['visual', 'humanPresence'],
  direction: ['copy', 'direction']
};

function iw2VulAan(fill) {
  Object.keys(fill || {}).forEach(function (naam) {
    var doel = IW2_VULBAAR[naam];
    if (!doel) return;
    var huidig = wizState.data[doel[0]][doel[1]];
    if (huidig) return;
    var waarde = fill[naam];
    /* Een persona komt terug als naam; het veld wil een id. */
    if (doel[1] === 'personaId') {
      var p = (state.personas || []).filter(function (x) {
        return String(x.name).toLowerCase() === String(waarde).toLowerCase();
      })[0];
      if (!p) return;
      waarde = p.id;
    }
    wizSet(doel[0], doel[1], waarde, 'rory');
  });
}

/* ── Zelf antwoorden ────────────────────────────────────────────────────────
 *
 * Dit is het verschil tussen een interview en een formulier met tekstballonnen.
 * De keuzelijst is een snelkoppeling, niet de enige weg: je mag in je eigen
 * woorden antwoorden, en dan is het aan Rory om te bepalen wat je gezegd hebt.
 *
 * Hij kan drie dingen met je antwoord:
 *
 *   1. Het beantwoordt de vraag  -> hij legt vast wat je bedoelde en gaat door.
 *   2. Het is te vaag om vast te leggen -> hij zegt waarom en vraagt door op
 *      dezelfde vraag. Je blijft dus staan tot het concreet genoeg is.
 *   3. Het gaat ergens anders over -> hij gaat erop in en brengt je terug.
 *
 * Zonder die derde mogelijkheid zou een terzijde ("de batterij van de concurrent
 * gaat binnen drie jaar stuk") ofwel genegeerd worden ofwel als antwoord op de
 * vraag geboekt worden. Allebei fout: het is bruikbare informatie, alleen niet
 * het antwoord op déze vraag.
 */
function iw2Antwoord() {
  var el = document.getElementById('iw2-in');
  var t = el ? el.value.trim() : '';
  if (!t || iw2.busy) return;
  el.value = '';
  iw2Zeg('user', t);
  wizRender();

  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    iw2Zeg('rory', 'I cannot read that without a key on the server. Pick one of the options for now.');
    wizRender();
    return;
  }

  var v = iw2Vraag();
  /* Na de blueprint is er geen vraag meer; dan is het een gewone vraag aan Rory. */
  if (!v || iw2.klaar) return iw2Losvraag(t);

  var opts = iw2Opties(v).filter(function (o) { return !o.rory; });
  iw2.busy = true;
  wizRender();

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  var vrij = !!v.vrij;
  var sys = 'You are Rory Sutherland, interviewing a marketer about one static ad. ' +
    'You asked: "' + v.vraag + '". They replied in their own words. ' +
    'Decide what their reply means for this one decision. Be a sparring partner, not a form: ' +
    'if the reply is vague, say what is missing and ask one sharper question. ' +
    'If the reply is about something else, respond to it properly and then bring them back. ' +
    'If it does answer, say in one or two sentences what you take from it and why that works. ' +
    'Never invent facts about the product or the audience.\n' +
    'The options on screen are: ' + opts.map(function (o) { return o.key + ' = ' + o.label; }).join('; ') + '.\n' +
    (vrij
      ? 'You may also record their own wording as the answer, if it is concrete enough.'
      : 'This decision must end up as one of the options above; their own wording cannot be stored here. ' +
        'If their reply points at one of them, choose it and say so.') + '\n' +
    'Answer with strict JSON: {"reply":"what you say back","resolved":true|false,' +
    '"choice":"option key or null","value":"their answer in a few words, or null",' +
    '"funnel":"tof|mof|bof|retargeting or null"}. ' +
    'Set resolved false whenever you are asking something back.';

  wizCall(sys, [{ role: 'user', content: ctx.text + '\n\nTheir reply: ' + t }], 700)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      iw2Zeg('rory', o.reply || 'Let me put that differently.');
      if (!o.resolved) { wizRender(); return; }
      iw2Vastleggen(v, o, t);
      iw2Volgende();
    })
    .catch(function (err) {
      iw2Zeg('rory', 'That did not go through: ' + err.message + ' — pick an option, or try again.');
    })
    .finally(function () { iw2.busy = false; wizRender(); });
}

/* Wat Rory uit je antwoord haalde vastleggen. Een gekozen optie zet zijn eigen
   velden, precies alsof je erop geklikt had; anders gaan je eigen woorden het
   veld in -- maar alleen bij vragen waar dat kan. */
function iw2Vastleggen(v, o, tekst) {
  /* Vraagt hij door, dan is er nog geen antwoord om vast te leggen. De aanroeper
     let daar al op, maar een functie die "leg dit vast" heet en dat ook doet bij
     een onafgemaakt antwoord is een val voor de volgende aanroeper. */
  if (!o || !o.resolved) return;
  iw2.antwoorden[v.key] = o.choice || 'vrij';
  if (v.key === 'start' && (o.choice === 'angle' || o.choice === 'persona')) iw2.spoor = o.choice;

  var opt = o.choice ? iw2Opties(v).filter(function (x) { return x.key === o.choice; })[0] : null;
  if (opt && opt.zet) {
    opt.zet.forEach(function (z) { wizSet(z[0], z[1], z[2], 'user'); });
    return;
  }
  if (v.vrij) {
    wizSet(v.vrij[0], v.vrij[1], o.value || tekst, 'user');
    /* Het doel zegt vaak ook iets over de funnelfase; die hoef je niet apart
       te vertellen. */
    if (o.funnel && !wizState.data.product.funnel) wizSet('product', 'funnel', o.funnel, 'rory');
  }
}

/* Een vraag die niet over de huidige stap gaat, of gesteld na de blueprint. */
function iw2Losvraag(t) {
  iw2.busy = true;
  wizRender();
  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  var sys = 'You are Rory Sutherland, mid-interview with a marketer about one static ad. ' +
    'Answer their question in two or three plain sentences. Do not change their decisions. ' +
    'Answer with strict JSON: {"answer":"..."}';
  wizCall(sys, [{ role: 'user', content: ctx.text + '\n\nTheir question: ' + t }], 500)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      iw2Zeg('rory', o.answer || 'I have nothing useful to add there.');
    })
    .catch(function (err) { iw2Zeg('rory', 'That did not go through: ' + err.message); })
    .finally(function () { iw2.busy = false; wizRender(); });
}

/* ── Tekenen ────────────────────────────────────────────────────────────── */

/* De kop van het interview: nummer, onderwerp en het Beta-label. */
function iw2Kop() {
  if (iw2.klaar) return { num: iw2Vragen().length + 1, titel: 'Blueprint ready' };
  var v = iw2Vraag();
  return { num: iw2.i + 2, titel: v ? v.titel : '' };
}

function iw2Render() {
  var links = '<div class="iw2-chat" id="iw2-chat">' + iw2.chat.map(function (r) {
    if (r.wie === 'user') {
      return '<div class="iw2-jij"><div class="iw2-bubbel">' + wizEsc(r.tekst) +
        '</div><div class="iw2-meta">You · ' + wizEsc(r.tijd) + ' ✓</div></div>';
    }
    return '<div class="iw2-rory"><div class="iw2-avatar">R</div>' +
      '<div><div class="iw2-bubbel">' + wizEsc(r.tekst) + '</div>' +
      '<div class="iw2-meta">Rory · ' + wizEsc(r.tijd) + '</div></div></div>';
  }).join('') + '</div>';

  if (iw2.klaar) {
    links += iw2RenderBlueprint();
  } else {
    var v = iw2Vraag();
    var opts = v ? iw2Opties(v) : [];
    var tegels = v && v.vorm === 'tegels';
    links += '<div class="' + (tegels ? 'iw2-tegels' : 'iw2-opties') + '">' +
      opts.map(function (o) {
        return '<button type="button" class="iw2-optie' + (o.rory ? ' uitweg' : '') + '" ' +
          'onclick="iw2Kies(\'' + o.key + '\')">' +
          '<span class="iw2-optie-t">' + wizEsc(o.label) + '</span>' +
          (o.sub ? '<span class="iw2-optie-s">' + wizEsc(o.sub) + '</span>' : '') +
          (o.aanbevolen ? '<span class="iw2-aanbevolen">Recommended</span>' : '') +
          '</button>';
      }).join('') + '</div>';
  }

  return { links: links, rechts: iw2RenderBegrepen() };
}

/* "What I understand so far": de blueprint die tijdens het gesprek volloopt. Dit
   is het antwoord op "waar zijn we eigenlijk", zonder dat je het gesprek terug
   hoeft te lezen. */
var IW2_RIJEN = [
  { label: 'Product', lees: function (d) { var p = wizProduct(); return p ? p.name : ''; } },
  { label: 'Goal', lees: function (d) { return d.strategy.goal; } },
  { label: 'Funnel', lees: function (d) { return d.product.funnel ? wizLabel('funnel', d.product.funnel) : ''; } },
  { label: 'Audience', lees: function (d) { var p = wizPersona(); return p ? p.name : ''; } },
  { label: 'Angle', lees: function (d) { return d.strategy.theme; } },
  { label: 'Format', lees: function (d) { var f = wizFormat(); return f ? f.name : ''; } },
  { label: 'Visual style', lees: function (d) { return d.visual.mood ? wizVisualLabel('mood', d.visual.mood) : ''; } },
  { label: 'Human', lees: function (d) { return d.visual.humanPresence ? wizVisualLabel('humanPresence', d.visual.humanPresence) : ''; } },
  { label: 'Copy', lees: function (d) { return d.copy.direction; } }
];

function iw2RenderBegrepen() {
  var d = wizState.data;
  return wizPaneel('What I understand so far',
    '<div class="iw2-begrepen">' + IW2_RIJEN.map(function (r) {
      var w = r.lees(d) || '';
      return '<div class="iw2-brij' + (w ? ' vol' : '') + '">' +
        '<div class="iw2-brij-l">' + wizEsc(r.label) + '</div>' +
        '<div class="iw2-brij-w">' + (w ? wizEsc(w) : '—') + '</div></div>';
    }).join('') + '</div>');
}

function iw2RenderBlueprint() {
  var d = wizState.data;
  var uit = '<div class="iw2-blueprint">' +
    '<div class="iw2-bp-kop">Creative Blueprint</div>' +
    IW2_RIJEN.map(function (r) {
      var w = r.lees(d) || '';
      if (!w) return '';
      return '<div class="iw2-bp-rij"><span>' + wizEsc(r.label) + '</span><b>' + wizEsc(w) + '</b></div>';
    }).join('') + '</div>';

  if (iw2.busy) {
    uit += wizDenkt('Rory is writing out the angle, the message and the headline.');
    return uit;
  }

  if (iw2.samenvatting) {
    uit += '<div class="iw2-samenvatting">' + wizEsc(iw2.samenvatting) + '</div>';
  }
  uit += '<div class="iw2-slot">Shall I generate concepts from this blueprint?</div>' +
    '<div class="iw2-slotknoppen">' +
    '<button type="button" class="wiz-btn primary" onclick="iw2Genereer()">Generate concepts</button>' +
    '<button type="button" class="wiz-btn" onclick="iw2NaarWizard(\'review\')">Open in wizard</button>' +
    '<button type="button" class="wiz-btn ghost" onclick="iw2Doorpraten()">Refine with Rory</button>' +
    '</div>';
  return uit;
}

/* Doorpraten na de blueprint: de knoppen weg, het typeveld blijft. Je bent niet
   klaar omdat Rory dat vindt. */
function iw2Doorpraten() {
  iw2.klaar = false;
  /* Terug naar de laatste vraag zodat het gesprek een plek heeft, maar zonder
     die vraag opnieuw te stellen -- je hebt hem al beantwoord. */
  iw2Zeg('rory', 'Tell me what to change and I will rework the blueprint.');
  iw2.doorpraten = true;
  wizRender();
}

/* Concepten uitwerken vanaf de blueprint. Het conceptenscherm bestaat al in de
   wizard; dat bouwen we hier niet nog een keer. */
function iw2Genereer() {
  wizState.done.review = true;
  wizSave();
  iw2NaarWizard('concepts');
  if (typeof wizGenerateConcepts === 'function') wizGenerateConcepts();
}

/* De invoerregel onderaan, en de exit-vraag als die openstaat. */
function iw2RenderVoet() {
  if (iw2.exitVraag) {
    return '<div class="iw2-exitvraag">' +
      '<div class="iw2-exitvraag-t">Leave the interview?</div>' +
      '<div class="iw2-exitvraag-s">The conversation and everything it worked out will be lost. ' +
      'The nine steps stay as you left them.</div>' +
      '<div class="wiz-actions">' +
      '<button type="button" class="wiz-btn primary small" onclick="iw2Exit()">Yes, leave</button>' +
      '<button type="button" class="wiz-btn ghost small" onclick="iw2ExitAf()">Stay in the interview</button>' +
      '</div></div>';
  }
  /* De uitnodiging zegt wat je hier kunt: antwoorden in je eigen woorden. Met
     "ask Rory anything" leest het als een hulpvenster naast de vraag, en dan
     blijft de keuzelijst het enige wat een antwoord lijkt. */
  var v = iw2Vraag();
  var uitnodiging = (iw2.klaar || !v)
    ? 'Ask Rory anything, or tell him what to change…'
    : 'Answer in your own words, or pick one above…';
  return '<div class="iw2-invoer">' +
    '<textarea id="iw2-in" rows="1" placeholder="' + wizEsc(uitnodiging) + '"' +
    (iw2.busy ? ' disabled' : '') + '></textarea>' +
    '<button type="button" class="iw2-stuur" onclick="iw2Antwoord()"' +
    (iw2.busy ? ' disabled' : '') + ' aria-label="Send">➤</button>' +
    '</div>';
}

window.iw2 = iw2;
window.iw2Start = iw2Start; window.iw2Hervat = iw2Hervat;
window.iw2Exit = iw2Exit; window.iw2VraagExit = iw2VraagExit; window.iw2ExitAf = iw2ExitAf;
window.iw2Kies = iw2Kies; window.iw2Render = iw2Render; window.iw2Kop = iw2Kop;
window.iw2RenderVoet = iw2RenderVoet; window.iw2Antwoord = iw2Antwoord;
window.iw2Losvraag = iw2Losvraag; window.iw2Vastleggen = iw2Vastleggen;
window.iw2Genereer = iw2Genereer; window.iw2NaarWizard = iw2NaarWizard;
window.iw2Doorpraten = iw2Doorpraten; window.iw2Vragen = iw2Vragen;
window.iw2Vraag = iw2Vraag; window.iw2Opties = iw2Opties; window.IW2_VRAGEN = IW2_VRAGEN;
window.IW2_RIJEN = IW2_RIJEN; window.iw2Afronden = iw2Afronden;
