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
  samenvatting: '',
  /* Antwoorden die Rory zelf voorstelde bij zijn laatste vervolgvraag. Zolang
     die er staan vervangen ze de vaste lijst -- zijn vraag is veranderd, dus de
     snelle antwoorden horen mee te veranderen. */
  dynOpties: null
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
    opties: 'themes'
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
        zet: [['visual', 'mood', 'raw-ugc']],
        gevolg: 'Raw does not look like an ad, which is exactly why it survives the scroll.' },
      { key: 'minimal', label: 'Minimal',
        zet: [['visual', 'mood', 'minimal']],
        gevolg: 'Minimal only works if the one thing left in frame is strong enough to carry the ad.' },
      { key: 'editorial', label: 'Editorial',
        zet: [['visual', 'mood', 'editorial']],
        gevolg: 'Editorial borrows the authority of a magazine page. The claim has to deserve it.' },
      { key: 'clinical', label: 'Clinical',
        zet: [['visual', 'mood', 'clinical']],
        gevolg: 'Clinical reads as evidence. Only worth it when there is a mechanism to show.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        gevolg: 'I will match the style to the brand and to what the audience already trusts.' }
    ]
  },
  {
    key: 'human', titel: 'Human presence', spoor: 'beide',
    vraag: 'Should we include a person in the ad? This helps set the right scene and framing.',
    opts: [
      { key: 'model', label: 'Yes, use a model',
        zet: [['visual', 'humanPresence', 'male-model']],
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
    opties: 'copyrichtingen'
  }
];

/* ── De catalogus ───────────────────────────────────────────────────────────
 *
 * Vier hoeken en drie headline-richtingen waren te weinig, en dat is geen
 * smaakkwestie: als de lijst het veld niet dekt, kiest iemand de minst
 * verkeerde in plaats van de juiste, en dan staat er een besluit in de
 * blueprint dat niemand genomen heeft.
 *
 * Alles tegelijk tonen is de andere fout -- twaalf knoppen onder een vraag is
 * een catalogus, geen gesprek. Daarom staat hier de volledige lijst, en toont
 * het scherm de zes die bij deze funnelfase horen. Een koud publiek heeft geen
 * aanbieding nodig maar een reden om te kijken; een warm publiek precies
 * andersom. En je kunt altijd zelf antwoorden met iets wat er niet bij staat.
 */
var IW2_THEMES = [
  { key: 'safety',      label: 'Safety & Confidence',    fasen: ['tof', 'mof', 'bof', 'retargeting'],
    gevolg: 'Leading with safety works when the fear of getting it wrong is bigger than the wish to get it right.' },
  { key: 'convenience', label: 'Convenience & Simplicity', fasen: ['tof', 'mof'],
    gevolg: 'Convenience sells the time back, not the product. That needs a concrete before and after.' },
  { key: 'performance', label: 'Performance & Quality',  fasen: ['mof', 'bof'],
    gevolg: 'Performance needs proof in the ad itself, otherwise it is a claim like every other claim.' },
  { key: 'premium',     label: 'Premium & Upgrade',      fasen: ['mof', 'bof'],
    gevolg: 'Premium is a promise about the buyer, not about the product. The visual has to carry it.' },
  { key: 'result',      label: 'The result, not the tool', fasen: ['tof', 'mof'],
    gevolg: 'Selling the outcome works when the outcome is visible. If it is not, this becomes a vague claim.' },
  { key: 'identity',    label: 'Identity & Belonging',   fasen: ['tof', 'mof'],
    gevolg: 'Identity narrows the audience on purpose: fewer people, far more recognition.' },
  { key: 'value',       label: 'Price & Value',          fasen: ['bof', 'retargeting'],
    gevolg: 'Price is only an angle if the comparison is concrete. Cheap on its own is not a reason.' },
  { key: 'health',      label: 'Health & Skin Care',     fasen: ['tof', 'mof'],
    gevolg: 'Care reframes the product as maintenance rather than grooming. That needs a mechanism.' },
  { key: 'contrarian',  label: 'Against the category',   fasen: ['tof'],
    gevolg: 'Saying the opposite of the category buys attention, and then you have to make it stand up.' },
  { key: 'time',        label: 'Time and effort saved',  fasen: ['tof', 'mof', 'bof'],
    gevolg: 'Time saved lands when you name the minutes. "Faster" is not a number.' },
  { key: 'mechanism',   label: 'The mechanism explained', fasen: ['mof', 'bof'],
    gevolg: 'Explaining how it works turns a claim into a reason. It needs one thing to show, not three.' },
  { key: 'comparison',  label: 'Versus the alternative', fasen: ['mof', 'bof', 'retargeting'],
    gevolg: 'A comparison only persuades if the thing you compare against is the one they actually use.' },
  { key: 'objection',   label: 'Kill the main objection', fasen: ['bof', 'retargeting'],
    gevolg: 'Naming the doubt out loud beats ignoring it, as long as the answer is in the same frame.' },
  { key: 'risk',        label: 'Risk reversal',          fasen: ['bof', 'retargeting'],
    gevolg: 'Taking the risk off the buyer works when the risk is the real blocker, not the price.' },
  { key: 'social',      label: 'Social proof',           fasen: ['mof', 'bof', 'retargeting'],
    gevolg: 'Proof needs a name, a number or a face. Anonymous praise reads as marketing.' },
  { key: 'authority',   label: 'Expert authority',       fasen: ['tof', 'mof', 'bof'],
    gevolg: 'Borrowed authority is fast, and it collapses the moment the expert looks staged.' },
  { key: 'ritual',      label: 'The daily ritual',       fasen: ['tof', 'mof'],
    gevolg: 'Selling the routine sells repeat use. It needs a moment in the day you can picture.' },
  { key: 'mistake',     label: 'The mistake they make',  fasen: ['tof', 'mof'],
    gevolg: 'Telling someone they are doing it wrong buys attention and spends goodwill. Be right.' },
  { key: 'occasion',    label: 'A specific occasion',    fasen: ['tof', 'bof', 'retargeting'],
    gevolg: 'An occasion creates a deadline the product itself does not have.' },
  { key: 'gift',        label: 'As a gift',              fasen: ['tof', 'bof'],
    gevolg: 'Gifting changes the buyer: you are writing for the giver, not the user.' }
];

var IW2_COPY = [
  { key: 'pain',       label: 'Pain-focused',       sub: 'Name the problem and the fear',
    fasen: ['tof', 'mof', 'bof'],
    gevolg: 'I will write pain-led headlines that name the fear before the product.' },
  { key: 'benefit',    label: 'Benefit-focused',    sub: 'Lead with the main benefit',
    fasen: ['mof', 'bof', 'retargeting'],
    gevolg: 'Benefit-led only beats pain-led when the benefit is one nobody else claims.' },
  { key: 'curiosity',  label: 'Curiosity-driven',   sub: 'Open a loop they want closed',
    fasen: ['tof', 'mof'],
    gevolg: 'Curiosity earns the click, but the ad has to pay it off or the click is wasted.' },
  { key: 'authority',  label: 'Authority',          sub: 'An expert or a study says it',
    fasen: ['tof', 'mof'],
    gevolg: 'Authority borrows trust. It only holds if the source is real and named.' },
  { key: 'proof',      label: 'Social proof',       sub: 'What other buyers say',
    fasen: ['mof', 'bof', 'retargeting'],
    gevolg: 'Specific proof beats loud proof: a number, a timeframe, a before-state.' },
  { key: 'comparison', label: 'Comparison',         sub: 'Against the alternative they know',
    fasen: ['mof', 'bof'],
    gevolg: 'Comparison works for people already weighing options. Name what you are compared to.' },
  { key: 'myth',       label: 'Myth-busting',       sub: 'Correct something they believe',
    fasen: ['tof', 'mof'],
    gevolg: 'Correcting a belief creates an aha-moment, and an opening for a new mechanism.' },
  { key: 'number',     label: 'Number claim',       sub: 'One specific figure carries it',
    fasen: ['tof', 'mof', 'bof'],
    gevolg: 'A precise number stops the scroll. A round one reads as marketing.' },
  { key: 'question',   label: 'Direct question',    sub: 'Ask what they recognise',
    fasen: ['tof'],
    gevolg: 'A question qualifies the right reader, as long as the answer is obviously yes.' },
  { key: 'offer',      label: 'Offer-led',          sub: 'The deal is the message',
    fasen: ['bof', 'retargeting'],
    gevolg: 'Offer-led converts the ready and trains everyone else to wait for a discount.' },
  { key: 'identity',   label: 'Identity',           sub: '"For men who…"',
    fasen: ['tof', 'mof'],
    gevolg: 'Identity headlines speak to fewer people and are read far more closely by those few.' }
];

/* Acht uit de lijst die bij deze funnelfase horen, plus de uitweg. Staat er nog
   geen funnelfase, dan de eerste acht -- dat is beter dan niets tonen.
   Acht en niet alles: een lijst van twintig lees je niet meer, je scrollt hem.
   Wat er niet bij staat vraag je gewoon door te typen. */
function iw2Selectie(catalogus, veld, hoeveel) {
  var fase = wizState.data.product.funnel;
  var passend = catalogus.filter(function (o) { return !fase || o.fasen.indexOf(fase) > -1; });
  if (passend.length < 3) passend = catalogus;
  return passend.slice(0, hoeveel || 8).map(function (o) {
    return { key: o.key, label: o.label, sub: o.sub, gevolg: o.gevolg,
             zet: [[veld[0], veld[1], o.label]] };
  });
}

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
  /* Heeft Rory op deze vraag zelf antwoorden voorgesteld, dan zijn dat ze. Zijn
     vervolgvraag gaat over iets anders dan de oorspronkelijke vraag, en dan is
     de oude lijst geen snelkoppeling meer maar een verkeerd antwoord dat klaar
     ligt om aangeklikt te worden. */
  if (iw2.dynOpties && iw2.dynOpties.vraag === v.key && iw2.dynOpties.opts.length) {
    return iw2.dynOpties.opts.concat(iw2Uitweg(v));
  }
  if (v.opties === 'themes') return iw2Selectie(IW2_THEMES, ['strategy', 'theme'])
    .concat([{ key: 'rory', label: 'Let Rory choose based on research', rory: true,
               gevolg: 'I will read the customer research and pick the entry point with the least resistance.' }]);
  if (v.opties === 'copyrichtingen') return iw2Selectie(IW2_COPY, ['copy', 'direction'])
    .concat([{ key: 'rory', label: 'Let Rory write the headline', rory: true,
               gevolg: 'I will pick the direction from the awareness level and write it out.' }]);
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
/* De uitweg hoort bij elke vraag, ook bij de dynamische lijsten. */
function iw2Uitweg(v) {
  var vast = (v.opts || []).filter(function (o) { return o.rory; });
  if (vast.length) return vast;
  return [{ key: 'rory', label: 'Let Rory decide', rory: true,
            gevolg: 'I will decide this one from the brief and the research.' }];
}

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
  iw2.dynOpties = null;
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

  /* Een antwoord dat Rory zelf voorstelde gaat terug als tekst, niet als
     vastgelegde keuze: hij vroeg iets anders dan de oorspronkelijke vraag, en
     wat dat voor de blueprint betekent moet hij zelf bepalen. */
  if (opt.voorstel) {
    var vak = document.getElementById('iw2-in');
    if (vak) { vak.value = opt.label; iw2Antwoord(); }
    return;
  }

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
  /* Nieuwe vraag, dus de voorgestelde antwoorden van de vorige vervallen. */
  iw2.dynOpties = null;
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
  var open = iw2OpenVelden().map(iw2OpenTekst);
  /* Twee zachte velden erbij: ze zijn niet verplicht, maar ze sturen wel de
     concepten, en het gesprek vraagt ze niet altijd. */
  if (!wizState.data.strategy.theme) open.push('strategy.theme (the angle direction, short)');
  if (!wizState.data.copy.direction) open.push('copy.direction (the headline direction, short)');

  var sys = 'You are Rory Sutherland, closing an interview with a marketer. ' +
    'The decisions already made are in the context. Write the parts a picklist cannot deliver, ' +
    'and fill in only what is still missing. Be concrete, no marketing adjectives. ' +
    'Answer with strict JSON: {"marketingAngle":"one sentence","messaging":"one sentence",' +
    '"desire":"what this customer actually wants, in their words, one short line",' +
    '"headline":"the headline itself","cta":"the call to action, a few words",' +
    '"fill":{"field":"value"},"summary":"two or three sentences ' +
    'explaining what this creative does and why"}. ' +
    'Fill every one of these still-open fields, using the exact field name as the key ' +
    'and, where a list of values is given, one value from that list verbatim: ' +
    (open.join('; ') || 'none') + '.';

  wizCall(sys, [{ role: 'user', content: ctx.text }], 900)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (o.marketingAngle) wizSet('strategy', 'marketingAngle', o.marketingAngle, 'rory');
      if (o.messaging) wizSet('strategy', 'messaging', o.messaging, 'rory');
      /* Het verlangen staat in de blueprint, dus het moet er ook echt in komen:
         zonder dit veld leest de hoek als een bewering zonder iemand die hem
         wil horen. */
      if (o.desire && !wizState.data.strategy.desire) wizSet('strategy', 'desire', o.desire, 'rory');
      if (o.headline) wizSet('copy', 'headline', o.headline, 'rory');
      if (o.cta && !wizState.data.copy.cta) wizSet('copy', 'cta', o.cta, 'rory');
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

/* Welke waarden een veld aankan. Zonder deze lijst mag Rory iets terugsturen
   wat de wizard niet kent -- 'moody bathroom' waar 'bathroom' hoort -- en dan
   is het veld formeel gevuld maar staat er niets dat de generator leest. */
function iw2Toegestaan(vak, veld) {
  function w(lijst) { return (lijst || []).map(function (o) { return o.value; }); }
  if (vak === 'product' && veld === 'placement' && typeof WIZ_PLACEMENTS !== 'undefined') return w(WIZ_PLACEMENTS);
  if (vak === 'product' && veld === 'funnel' && typeof WIZ_FUNNELS !== 'undefined') return w(WIZ_FUNNELS);
  if (vak === 'audience' && veld === 'awareness' && typeof WIZ_AWARENESS !== 'undefined') return w(WIZ_AWARENESS);
  if (vak === 'visual' && typeof WIZ_VISUAL !== 'undefined') {
    var r = WIZ_VISUAL.filter(function (x) { return x.field === veld; })[0];
    if (r) return w(r.opts);
  }
  if (vak === 'format' && veld === 'formatId' && typeof AD_FORMATS !== 'undefined') {
    return AD_FORMATS.map(function (x) { return x.id; });
  }
  return null;
}

/* Elk verplicht veld dat nog leeg staat, uit dezelfde tabel als de poort van de
 * wizard. Dat het dezelfde tabel is, is het hele punt: het gesprek kan zo niets
 * overslaan waar stap 9 later op vastloopt. Het product zelf staat er niet bij
 * -- dat kies je vóór het gesprek, en Rory hoort niet te raden waar je reclame
 * voor maakt. */
function iw2OpenVelden() {
  var uit = [];
  if (typeof WIZ_REQUIRED === 'undefined') return uit;
  Object.keys(WIZ_REQUIRED).forEach(function (vak) {
    (WIZ_REQUIRED[vak] || []).forEach(function (veld) {
      if (veld === 'productId') return;
      var w = (wizState.data[vak] || {})[veld];
      if (w !== '' && w != null) return;
      uit.push({ vak: vak, veld: veld, toegestaan: iw2Toegestaan(vak, veld) });
    });
  });
  return uit;
}

function iw2OpenTekst(o) {
  var naam = o.vak + '.' + o.veld;
  if (naam === 'audience.personaId') return 'audience.personaId (the exact name of a persona from the library)';
  if (o.toegestaan && o.toegestaan.length) return naam + ' (one of: ' + o.toegestaan.join(', ') + ')';
  var label = (typeof WIZ_FIELD_LABELS !== 'undefined' && WIZ_FIELD_LABELS[o.veld]) || o.veld;
  return naam + ' (' + label + ', a few words)';
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

/* De sleutel mag 'visual.mood' zijn of het kale 'mood'. Beide vormen komen
   voor: de opdracht vraagt de volledige naam, de korte namen stonden er al. */
function iw2Doel(naam) {
  if (IW2_VULBAAR[naam]) return IW2_VULBAAR[naam];
  var d = String(naam).split('.');
  if (d.length === 2 && wizState.data[d[0]] && d[1] in wizState.data[d[0]]) return [d[0], d[1]];
  return null;
}

function iw2VulAan(fill) {
  Object.keys(fill || {}).forEach(function (naam) {
    var doel = iw2Doel(naam);
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
    } else {
      /* Kent het veld een vaste lijst, dan moet het antwoord daarin staan.
         Een waarde ernaast laat het veld liever leeg: leeg is zichtbaar, een
         onbekende waarde ziet eruit als een besluit en is het niet. */
      var lijst = iw2Toegestaan(doel[0], doel[1]);
      if (lijst && lijst.length && lijst.indexOf(waarde) === -1) {
        var raak = lijst.filter(function (v) {
          return String(v).toLowerCase() === String(waarde).toLowerCase();
        })[0];
        if (!raak) return;
        waarde = raak;
      }
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
    /* De taal dreef weg: hij antwoordde in het Engels en sloeg halverwege om
       naar Nederlands, omdat de context vol Nederlandse productteksten en
       klantonderzoek zit. De afspraak is dat de interface Engels is, dus is het
       gesprek dat ook -- ongeacht in welke taal de vraag gesteld wordt. Wat
       geen interface is blijft staan zoals het is: advertentiecopy, quotes uit
       onderzoek en productteksten worden nooit vertaald. */
    'ALWAYS write your reply in English, whatever language they write in. ' +
    'Do not translate ad copy, customer research quotes or product text: quote those verbatim.\n' +
    'The options on screen are: ' + opts.map(function (o) { return o.key + ' = ' + o.label; }).join('; ') + '.\n' +
    (vrij
      ? 'You may also record their own wording as the answer, if it is concrete enough.'
      : 'This decision must end up as one of the options above; their own wording cannot be stored here. ' +
        'If their reply points at one of them, choose it and say so.') + '\n' +
    /* Vraag je iets terug, lever dan ook de antwoorden bij díé vraag. Anders
       blijven de knoppen van de oorspronkelijke vraag staan, en die gaan over
       iets anders dan wat je zojuist vroeg. */
    'If you are asking something back, also give three or four short quick answers ' +
    'for that new question, in English, each a few words. Leave options empty when ' +
    'you resolved the question.\n' +
    'Answer with strict JSON: {"reply":"what you say back","resolved":true|false,' +
    '"choice":"option key or null","value":"their answer in a few words, or null",' +
    '"funnel":"tof|mof|bof|retargeting or null",' +
    '"options":[{"label":"short answer","sub":"optional one-line explanation"}]}. ' +
    'Set resolved false whenever you are asking something back.';

  wizCall(sys, [{ role: 'user', content: ctx.text + '\n\nTheir reply: ' + t }], 700)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      iw2Zeg('rory', o.reply || 'Let me put that differently.');
      if (!o.resolved) {
        iw2.dynOpties = iw2VerwerkVoorstellen(v, o.options);
        wizRender();
        return;
      }
      iw2Vastleggen(v, o, t);
      iw2Volgende();
    })
    .catch(function (err) {
      iw2Zeg('rory', 'That did not go through: ' + err.message + ' — pick an option, or try again.');
    })
    .finally(function () { iw2.busy = false; wizRender(); });
}

/* Rory's eigen antwoordvoorstellen omzetten naar knoppen. Ze leggen niets vast
   uit zichzelf: klik je erop, dan gaat de tekst als jouw antwoord terug het
   gesprek in en beoordeelt hij hem net zo goed als getypte tekst. Zo kan een
   voorgesteld antwoord nooit een veld zetten dat Rory niet bedoeld had. */
function iw2VerwerkVoorstellen(v, voorstellen) {
  if (!Array.isArray(voorstellen) || !voorstellen.length) return null;
  var opts = voorstellen.slice(0, 4)
    .filter(function (o) { return o && o.label; })
    .map(function (o, n) {
      return { key: 'voorstel' + n, label: String(o.label).slice(0, 80),
               sub: o.sub ? String(o.sub).slice(0, 120) : '', voorstel: true };
    });
  return opts.length ? { vraag: v.key, opts: opts } : null;
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
/* Wat er in de blueprint hoort te staan. De volgorde is de redenering: voor
 * wie, wat die wil, wat we daarover beweren, en pas dan hoe het eruitziet.
 *
 * Twee dingen stonden er eerder niet in en hadden dat wel moeten doen. Het
 * bewustzijnsniveau bepaalt wat je uberhaupt mag beweren -- dezelfde headline
 * is sterk bij iemand die het probleem kent en onbegrijpelijk bij iemand die
 * het niet kent -- en het verlangen is waar de hele hoek op rust. Zonder die
 * twee leest de blueprint als een lijst instellingen in plaats van als een
 * redenering die je kunt controleren.
 *
 * En de copyregel toonde de richting ('Curiosity-driven') in plaats van de
 * headline. De richting is een keuze onderweg; wat er straks op de static
 * staat is de headline zelf. */
var IW2_RIJEN = [
  { label: 'Product', lees: function (d) { var p = wizProduct(); return p ? p.name : ''; } },
  { label: 'Goal', lees: function (d) { return d.strategy.goal; } },
  { label: 'Funnel', lees: function (d) { return d.product.funnel ? wizLabel('funnel', d.product.funnel) : ''; } },
  { label: 'Audience', lees: function (d) { var p = wizPersona(); return p ? p.name : ''; } },
  { label: 'Awareness', lees: function (d) { return d.audience.awareness ? wizLabel('awareness', d.audience.awareness) : ''; } },
  { label: 'Desire', lees: function (d) { return d.strategy.desire; } },
  { label: 'Angle', lees: function (d) { return d.strategy.theme; } },
  { label: 'Marketing angle', lees: function (d) { return d.strategy.marketingAngle; } },
  { label: 'Format', lees: function (d) { var f = wizFormat(); return f ? f.name : ''; } },
  { label: 'Visual style', lees: function (d) { return d.visual.mood ? wizVisualLabel('mood', d.visual.mood) : ''; } },
  { label: 'Human', lees: function (d) { return d.visual.humanPresence ? wizVisualLabel('humanPresence', d.visual.humanPresence) : ''; } },
  { label: 'Headline', lees: function (d) { return d.copy.headline; } },
  { label: 'CTA', lees: function (d) { return d.copy.cta; } }
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
    /* Een lege regel weglaten maakt de blueprint mooier en onbruikbaar: dan zie
       je niet dat het format ontbreekt, je ziet alleen geen format. Een streepje
       is een gat dat je kunt aanwijzen. */
    IW2_RIJEN.map(function (r) {
      var w = r.lees(d) || '';
      return '<div class="iw2-bp-rij' + (w ? '' : ' leeg') + '"><span>' + wizEsc(r.label) +
        '</span><b>' + (w ? wizEsc(w) : '—') + '</b></div>';
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
  /* Bleef er een verplicht veld open -- Rory kwam er niet uit, of de aanroep
     mislukte -- dan sturen we je daarheen in plaats van naar de concepten.
     Anders loop je door tot stap 8 en pas daar tegen de poort aan, met drie
     beelden op het scherm en geen idee wat er acht stappen terug ontbreekt. */
  var open = iw2OpenVelden();
  if (open.length) {
    var stap = open[0].vak;
    wizState.done.review = false;
    iw2.open = false;
    wizSave();
    wizGo(stap);
    return;
  }
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
window.iw2OpenVelden = iw2OpenVelden; window.iw2OpenTekst = iw2OpenTekst;
window.iw2Toegestaan = iw2Toegestaan; window.iw2VulAan = iw2VulAan;
