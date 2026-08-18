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
  dynOpties: null,
  /* Waarom een veld staat zoals het staat, per pad. Gevuld door de keuze zelf,
     door een doorvraag en door de sluitaanroep. Dit is het antwoord op "ik heb
     alles ingevuld en ik weet niet hoe we hier gekomen zijn". */
  redenen: {},
  /* Op welke vragen Rory al een keer doorgevraagd heeft. Eenmaal per vraag, en
     hoogstens IW2_MAX_DIEP keer in het hele gesprek: doorvragen is de bedoeling,
     een verhoor niet. */
  gediept: {},
  /* Zijn openingsanalyse: wat hij aanneemt voordat je iets gezegd hebt, en
     waarop. Zonder dit begint het gesprek bij nul terwijl de console een
     productbestand, klantonderzoek en een advertentiehistorie heeft. */
  aannames: null
};

/* Hoe vaak Rory in een gesprek mag doorvragen. Vier: genoeg om ergens te komen,
   te weinig om een examen te worden. */
var IW2_MAX_DIEP = 4;

/* Op welke vragen doorvragen zin heeft. Niet op alle: bij een format of een
   visuele stijl is jouw antwoord het antwoord, maar bij de dragende besluiten
   verandert het waarom wel degelijk wat er daarna gebeurt. */
var IW2_DIEPVRAGEN = ['theme', 'persona', 'sofist', 'goal'];

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
        sub: 'Cold reach. The biggest audience and the most indirect message: they do not know you, so the ad has to earn the look before it sells anything.',
        zet: [['strategy', 'goal', 'Reach new customers'], ['product', 'funnel', 'tof']],
        gevolg: 'Perfect. We will focus on a message that attracts people who do not know the brand yet.' },
      { key: 'sales', label: 'Drive sales of a specific product',
        sub: 'Conversion. Aimed at people close to buying, so proof and the objection matter more than attention.',
        zet: [['strategy', 'goal', 'Drive sales of a specific product'], ['product', 'funnel', 'bof']],
        gevolg: 'Clear. We aim at people who are close to buying and need a reason to do it now.' },
      { key: 'offer', label: 'Promote an offer or discount',
        sub: 'The deal carries the ad. Works on people who already trust you, and teaches everyone else to wait for the next discount.',
        zet: [['strategy', 'goal', 'Promote an offer or discount'], ['product', 'funnel', 'bof']],
        gevolg: 'Right. The offer carries the ad, so the product has to be recognisable in one look.' },
      { key: 'angle', label: 'Test a new angle',
        sub: 'A deliberate experiment. Only worth running if it says something your current ads do not.',
        zet: [['strategy', 'goal', 'Test a new angle'], ['product', 'funnel', 'mof']],
        gevolg: 'Good. A test is only worth running if it says something the current ads do not.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        sub: 'He reads the product data and what already ran, and picks the goal that fits.',
        gevolg: 'I will set the goal from the product data and what already ran.' }
    ]
  },
  {
    key: 'theme', titel: 'Angle direction', spoor: 'beide', vrij: ['strategy', 'theme'],
    vraag: 'The next big decision is the angle. Which direction should we lead with?',
    opties: 'themes'
  },
  {
    key: 'sofist', titel: 'Market sophistication', spoor: 'beide',
    vraag: 'One more thing before the format, and it decides what we are even allowed to claim: how tired is this market of hearing this claim?',
    vraagUitleg: 'Write your bare product claim, search it in the Ads Library, count who else makes it. Then stay one stage ahead of them.',
    opts: [
      { key: 's1', label: 'Nobody else says this', sub: 'A virgin claim: you are first, so a plain statement is enough and anything cleverer only costs you.',
        zet: [['audience', 'sophistication', 's1']],
        gevolg: 'Then state it plainly. A direct claim is enough, and complicating it would only cost you.' },
      { key: 's2', label: 'A few say it', sub: 'Same claim, we go bigger',
        zet: [['audience', 'sophistication', 's2']],
        gevolg: 'Then we escalate: a specific number, a bigger scale. Same claim, sharper.' },
      { key: 's3', label: 'Everybody says it', sub: 'Bare claims are dead here',
        zet: [['audience', 'sophistication', 's3']],
        gevolg: 'Then the claim is spent and we lead with the mechanism. The how is the only thing still believed.' },
      { key: 's4', label: 'Everybody has a mechanism too', sub: 'Ours has to be better',
        zet: [['audience', 'sophistication', 's4']],
        gevolg: 'Then it is product against product, and the superiority has to be visible on the image.' },
      { key: 's5', label: 'They have heard everything', sub: 'Only identity is left',
        zet: [['audience', 'sophistication', 's5']],
        gevolg: 'Then we stop selling the product and sell who they are. We open it like an ad for someone who does not know the problem yet.' },
      { key: 'rory', label: 'Let Rory judge the market', rory: true,
        sub: 'He reads what already ran and sets the stage one step ahead of the category.',
        gevolg: 'I will read what already ran and set the stage one step ahead of the category.' }
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
        sub: 'Controlled light, deep tones, nothing cheap in frame. Take it when the price has to feel earned, or when the market is tired of claims and only identity is left.',
        zet: [['visual', 'mood', 'premium']],
        gevolg: 'Premium builds trust and positions the product as the safe choice.' },
      { key: 'ugc', label: 'Raw UGC',
        sub: 'Looks like a photo someone took, not like an ad. Take it for a cold audience that scrolls past anything that announces itself as advertising.',
        zet: [['visual', 'mood', 'raw-ugc']],
        gevolg: 'Raw does not look like an ad, which is exactly why it survives the scroll.' },
      { key: 'minimal', label: 'Minimal',
        sub: 'One object, one line, empty space. Take it when the single thing left in frame is strong enough to carry the whole ad. If it is not, this is the weakest of the five.',
        zet: [['visual', 'mood', 'minimal']],
        gevolg: 'Minimal only works if the one thing left in frame is strong enough to carry the ad.' },
      { key: 'editorial', label: 'Editorial',
        sub: 'Composed like a magazine page: a person, a headline, a caption. Take it when you borrow authority, and only when the claim deserves it.',
        zet: [['visual', 'mood', 'editorial']],
        gevolg: 'Editorial borrows the authority of a magazine page. The claim has to deserve it.' },
      { key: 'clinical', label: 'Clinical',
        sub: 'Flat light, close on the mechanism, labels and numbers. Take it when there is something to prove — a market at sophistication 3 or 4 that stopped believing bare claims.',
        zet: [['visual', 'mood', 'clinical']],
        gevolg: 'Clinical reads as evidence. Only worth it when there is a mechanism to show.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        sub: 'He matches the style to the brand, the market stage and what this audience already trusts.',
        gevolg: 'I will match the style to the brand and to what the audience already trusts.' }
    ]
  },
  {
    key: 'human', titel: 'Human presence', spoor: 'beide',
    vraag: 'Should we include a person in the ad? This helps set the right scene and framing.',
    opts: [
      { key: 'model', label: 'Yes, use a model',
        sub: 'Someone the buyer can place himself next to. It makes the message relatable, and it costs you if the casting is off: a stranger who is too polished reads as an ad.',
        zet: [['visual', 'humanPresence', 'male-model']],
        gevolg: 'A person in a real environment makes the message relatable.' },
      { key: 'hands', label: 'Hands only',
        sub: 'Use without a face. It shows the product working and asks nobody to identify with a stranger — the safe middle when the product is the proof.',
        zet: [['visual', 'humanPresence', 'hands']],
        gevolg: 'Hands show use without asking the viewer to identify with a stranger.' },
      { key: 'none', label: 'No person',
        sub: 'Product and claim only. Take it when the mechanism or the number is the whole idea and a person would just share out the attention.',
        zet: [['visual', 'humanPresence', 'none']],
        gevolg: 'No person keeps all attention on the product and the claim.' },
      { key: 'rory', label: 'Let Rory decide', rory: true,
        sub: 'He decides from the format and the reference photos we actually have.',
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
  { key: 'safety',      label: 'Safety & Confidence',    sub: 'Lead with what could go wrong and how you prevent it. Take it when the fear of getting it wrong is bigger than the wish to get it right.',
    fasen: ['tof', 'mof', 'bof', 'retargeting'],
    gevolg: 'Leading with safety works when the fear of getting it wrong is bigger than the wish to get it right.' },
  { key: 'convenience', label: 'Convenience & Simplicity', sub: 'Sell the time and hassle back, not the product. Needs a concrete before and after, or it is a vague claim.',
    fasen: ['tof', 'mof'],
    gevolg: 'Convenience sells the time back, not the product. That needs a concrete before and after.' },
  { key: 'performance', label: 'Performance & Quality',  sub: 'It simply works better. Needs proof inside the ad, otherwise it is a claim like all the others.',
    fasen: ['mof', 'bof'],
    gevolg: 'Performance needs proof in the ad itself, otherwise it is a claim like every other claim.' },
  { key: 'premium',     label: 'Premium & Upgrade',
    sub: 'A promise about the buyer rather than the product. The visual has to carry it, or it reads as an expensive nothing.',
    fasen: ['mof', 'bof'],
    gevolg: 'Premium is a promise about the buyer, not about the product. The visual has to carry it.' },
  { key: 'result',      label: 'The result, not the tool', sub: 'Sell the outcome, not the tool. Works when the outcome is visible; when it is not, this goes vague fast.',
    fasen: ['tof', 'mof'],
    gevolg: 'Selling the outcome works when the outcome is visible. If it is not, this becomes a vague claim.' },
  { key: 'identity',    label: 'Identity & Belonging',   sub: 'Speak to a tribe on purpose. Fewer people, far more recognition among those few.',
    fasen: ['tof', 'mof'],
    gevolg: 'Identity narrows the audience on purpose: fewer people, far more recognition.' },
  { key: 'value',       label: 'Price & Value',          sub: 'Price and what you get for it. Only an angle when the comparison is concrete: cheap on its own is not a reason.',
    fasen: ['bof', 'retargeting'],
    gevolg: 'Price is only an angle if the comparison is concrete. Cheap on its own is not a reason.' },
  { key: 'health',      label: 'Health & Skin Care',     sub: 'Reframe grooming as care and maintenance. Needs a mechanism, or it is a mood.',
    fasen: ['tof', 'mof'],
    gevolg: 'Care reframes the product as maintenance rather than grooming. That needs a mechanism.' },
  { key: 'contrarian',  label: 'Against the category',   sub: 'Say the opposite of the category. Buys attention, and then you have to make it stand up.',
    fasen: ['tof'],
    gevolg: 'Saying the opposite of the category buys attention, and then you have to make it stand up.' },
  { key: 'time',        label: 'Time and effort saved',  sub: 'How much time it gives back. Lands when you name the minutes; "faster" is not a number.',
    fasen: ['tof', 'mof', 'bof'],
    gevolg: 'Time saved lands when you name the minutes. "Faster" is not a number.' },
  { key: 'mechanism',   label: 'The mechanism explained', sub: 'Explain how it works. The strongest move in a market that stopped believing claims.',
    fasen: ['mof', 'bof'],
    gevolg: 'Explaining how it works turns a claim into a reason. It needs one thing to show, not three.' },
  { key: 'comparison',  label: 'Versus the alternative', sub: 'You against the thing they use now. Only persuades if you compare against what they actually use.',
    fasen: ['mof', 'bof', 'retargeting'],
    gevolg: 'A comparison only persuades if the thing you compare against is the one they actually use.' },
  { key: 'objection',   label: 'Kill the main objection', sub: 'Name the doubt out loud and answer it in the same frame. Beats pretending it is not there.',
    fasen: ['bof', 'retargeting'],
    gevolg: 'Naming the doubt out loud beats ignoring it, as long as the answer is in the same frame.' },
  { key: 'risk',        label: 'Risk reversal',          sub: 'Take the risk off the buyer: guarantee, trial, no-questions return. Works when risk is the real blocker, not price.',
    fasen: ['bof', 'retargeting'],
    gevolg: 'Taking the risk off the buyer works when the risk is the real blocker, not the price.' },
  { key: 'social',      label: 'Social proof',           sub: 'Other buyers do the talking. Needs a name, a number or a face; anonymous praise reads as marketing.',
    fasen: ['mof', 'bof', 'retargeting'],
    gevolg: 'Proof needs a name, a number or a face. Anonymous praise reads as marketing.' },
  { key: 'authority',   label: 'Expert authority',       sub: 'Someone credible says it. Fast to borrow, and it collapses the moment the expert looks staged.',
    fasen: ['tof', 'mof', 'bof'],
    gevolg: 'Borrowed authority is fast, and it collapses the moment the expert looks staged.' },
  { key: 'ritual',      label: 'The daily ritual',       sub: 'The place it takes in their day. Sells repeat use, and needs a moment you can picture.',
    fasen: ['tof', 'mof'],
    gevolg: 'Selling the routine sells repeat use. It needs a moment in the day you can picture.' },
  { key: 'mistake',     label: 'The mistake they make',  sub: 'They are doing it wrong and do not know it. Buys attention and spends goodwill, so be right.',
    fasen: ['tof', 'mof'],
    gevolg: 'Telling someone they are doing it wrong buys attention and spends goodwill. Be right.' },
  { key: 'occasion',    label: 'A specific occasion',    sub: 'A specific moment creates a deadline the product itself does not have.',
    fasen: ['tof', 'bof', 'retargeting'],
    gevolg: 'An occasion creates a deadline the product itself does not have.' },
  { key: 'gift',        label: 'As a gift',              sub: 'Written for the giver, not the user. That changes who you are talking to entirely.',
    fasen: ['tof', 'bof'],
    gevolg: 'Gifting changes the buyer: you are writing for the giver, not the user.' }
];

/* De headline-richtingen. Dit is geen smaaklijst maar het veldrapport van wat
 * er op dit moment geld opneemt, achttien vormen, elk met een ander trekpunt.
 *
 * Twee dingen staan er bewust bij. `bewust` zegt bij welk bewustzijnsniveau de
 * vorm hoort -- een aanbieding zegt niets tegen wie het probleem niet kent, en
 * een diagnose is verspild aan wie al in het karretje staat. En `gevolg` zegt
 * wat de keuze betekent, want een lijst zonder gevolgen is een menukaart.
 *
 * De lijst is om aan te toetsen, niet om uit te putten: wie hier begint komt
 * uit op het categoriegemiddelde. De hoek komt eerst, deze vorm daarna. */
var IW2_COPY = [
  { key: 'without',    label: 'The result without the hated thing', sub: 'The outcome, minus the friction everyone complains about',
    fasen: ['tof', 'mof'], bewust: ['problem', 'solution'],
    gevolg: 'Strong opener: it anchors on whatever they already resent about the usual solution.' },
  { key: 'pain',       label: 'Problem named', sub: 'The problem, sharply and in their words',
    fasen: ['tof', 'mof', 'bof'], bewust: ['problem'],
    gevolg: 'I will name the fear before the product. Kindly: name the problem, never shame the buyer.' },
  { key: 'diagnosis',  label: 'The diagnosis', sub: 'Oddly specific symptoms, then the deeper cause',
    fasen: ['tof', 'mof'], bewust: ['unaware', 'problem'],
    gevolg: 'He recognises himself in the list, so he believes the cause. Powerful and easy to abuse.' },
  { key: 'failed',     label: 'The failed-solutions list', sub: 'Everything they tried that did not work',
    fasen: ['tof', 'mof'], bewust: ['problem', 'solution'],
    gevolg: 'It earns the right to be heard by a market that has already been disappointed.' },
  { key: 'mechanism',  label: 'New mechanism plus superiority', sub: 'The how, and what it produces',
    fasen: ['mof', 'bof'], bewust: ['solution', 'product'],
    gevolg: 'The stage-3 move: a market that stopped believing claims will still listen to a how.' },
  { key: 'mechq',      label: 'A question from the mechanism', sub: 'What if the actual cause were shut off?',
    fasen: ['tof', 'mof'], bewust: ['unaware', 'problem', 'solution'],
    gevolg: 'This reframes an exhausted market as a new opportunity, which is the hardest thing to do.' },
  { key: 'speed',      label: 'Speed to result', sub: 'How fast, specifically',
    fasen: ['mof', 'bof'], bewust: ['solution', 'product'],
    gevolg: 'Only works with a real number. "Faster" is not a number.' },
  { key: 'switch',     label: 'I ditched the usual thing for this', sub: 'A switch, and what happened',
    fasen: ['tof', 'mof'], bewust: ['problem', 'solution'],
    gevolg: 'It plants the question the reader answers himself: so what are you using now?' },
  { key: 'current',    label: 'Call out their current solution', sub: 'What they use now, and why it fails them',
    fasen: ['mof', 'bof'], bewust: ['solution', 'product'],
    gevolg: 'Direct and risky: be right about what they use, or you are talking to nobody.' },
  { key: 'question',   label: 'Problem as a question', sub: 'Why does this have to be so bad?',
    fasen: ['tof'], bewust: ['unaware', 'problem'],
    gevolg: 'A question qualifies the right reader, as long as the answer is obviously yes.' },
  { key: 'compare',    label: 'Better than the alternatives', sub: 'Yours against theirs, plainly',
    fasen: ['mof', 'bof'], bewust: ['product'],
    gevolg: 'The stage-4 play for when everyone sells the same thing. Name what you compare against.' },
  { key: 'price',      label: 'Price as the USP', sub: 'The comparison stated line by line',
    fasen: ['bof', 'retargeting'], bewust: ['product', 'most'],
    gevolg: 'Price is an angle only when the comparison is concrete. Cheap alone is not a reason.' },
  { key: 'justify',    label: 'Price justification', sub: '"You said it was expensive, so here is what changed"',
    fasen: ['bof', 'retargeting'], bewust: ['product', 'most'],
    gevolg: 'Expensive nearly always means under-justified rather than over-priced.' },
  { key: 'proof',      label: 'Customer testimonial open', sub: 'Start in a buyer\'s own voice',
    fasen: ['mof', 'bof', 'retargeting'], bewust: ['solution', 'product'],
    gevolg: 'Specific proof beats loud proof: a name, a number, a before-state.' },
  { key: 'beforeafter',label: 'Before and after', sub: 'The transformation, shown',
    fasen: ['tof', 'mof', 'bof'], bewust: ['problem', 'solution', 'product'],
    gevolg: 'The most literal proof there is. It lives or dies on whether the after is believable.' },
  { key: 'easy',       label: 'It is easy with the right thing', sub: 'Not hard, if you have the right tool',
    fasen: ['mof', 'bof'], bewust: ['solution', 'product'],
    gevolg: 'It removes blame from the buyer, which is why it is read as friendly rather than salesy.' },
  { key: 'goliath',    label: 'David and Goliath', sub: 'Make it sound unsolvable, then solve it',
    fasen: ['tof', 'mof'], bewust: ['unaware', 'problem'],
    gevolg: 'The size of the problem is what buys the attention. Do not solve it in the first line.' },
  { key: 'news',       label: 'News-story framing', sub: 'Presented as a report, not an ad',
    fasen: ['tof', 'mof'], bewust: ['unaware', 'problem'],
    gevolg: 'It borrows the authority of the page it imitates. No real network branding, ever.' },
  { key: 'identity',   label: 'Identity', sub: '"For men who…"',
    fasen: ['tof', 'mof'], bewust: ['unaware', 'solution'],
    gevolg: 'The stage-5 move: fewer people, read far more closely by those few.' },
  { key: 'offer',      label: 'The offer, plainly', sub: 'The deal is the message',
    fasen: ['bof', 'retargeting'], bewust: ['most'],
    gevolg: 'It converts the ready and teaches everyone else to wait for a discount.' },
  { key: 'ending',     label: 'The offer ending', sub: 'A real deadline with a real reason',
    fasen: ['bof', 'retargeting'], bewust: ['most'],
    gevolg: 'A deadline only works if it is true. Fake scarcity is a trust problem, not a tactic.' }
];

/* Acht uit de lijst die bij deze funnelfase horen, plus de uitweg. Staat er nog
   geen funnelfase, dan de eerste acht -- dat is beter dan niets tonen.
   Acht en niet alles: een lijst van twintig lees je niet meer, je scrollt hem.
   Wat er niet bij staat vraag je gewoon door te typen. */
function iw2Selectie(catalogus, veld, hoeveel) {
  var fase = wizState.data.product.funnel;
  var bewust = wizState.data.audience.awareness;
  var passend = catalogus.filter(function (o) { return !fase || o.fasen.indexOf(fase) > -1; });
  /* Kent de lijst bewustzijnsniveaus, dan gaat die filter er nog overheen. Dat
     is de scherpere van de twee: de funnelfase zegt wat de campagne wil, het
     bewustzijnsniveau zegt wat deze lezer al weet, en het tweede bepaalt of een
     zin uberhaupt te volgen is. */
  if (bewust && catalogus.some(function (o) { return o.bewust; })) {
    var scherper = passend.filter(function (o) { return !o.bewust || o.bewust.indexOf(bewust) > -1; });
    if (scherper.length >= 3) passend = scherper;
  }
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
  angle:   ['start', 'theme', 'goal', 'sofist', 'format', 'visual', 'human', 'copy'],
  persona: ['start', 'persona', 'goal', 'theme', 'sofist', 'format', 'visual', 'human', 'copy']
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
               sub: 'He reads the customer research and picks the entry point with the least resistance.',
               gevolg: 'I will read the customer research and pick the entry point with the least resistance.' }]);
  if (v.opties === 'copyrichtingen') return iw2Selectie(IW2_COPY, ['copy', 'direction'])
    .concat([{ key: 'rory', label: 'Let Rory write the headline', rory: true,
               sub: 'He picks the direction from the awareness level and writes the line itself.',
               gevolg: 'I will pick the direction from the awareness level and write it out.' }]);
  if (v.opties === 'personas') {
    var lijst = (state.personas || []).slice(0, 6).map(function (p) {
      /* Wie dit is in een regel: rol als die er staat, anders de omschrijving,
         anders de scherpste pijn. Een naam alleen zegt niets tegen wie de
         persona-bibliotheek niet uit zijn hoofd kent. */
      var wie = p.role || p.description || p.summary_nl || '';
      if ((p.pains || []).length) {
        wie = (wie ? wie + ' — ' : '') + 'biggest pain: ' + p.pains.filter(Boolean)[0];
      }
      return { key: p.id, label: p.name, sub: wie,
               zet: [['audience', 'personaId', p.id]],
               gevolg: 'Good. Everything after this is written for ' + p.name + '.' };
    });
    lijst.push({ key: 'rory', label: 'Let Rory choose based on research', rory: true,
                 sub: 'He reads the research and picks the persona with the sharpest fit.',
                 gevolg: 'I will read the research and pick the persona with the sharpest fit.' });
    return lijst;
  }
  if (v.opties === 'formats') {
    var aanbevolen = iw2AanbevolenFormat();
    var f = (typeof AD_FORMATS !== 'undefined' ? AD_FORMATS : []);
    var keuze = f.filter(function (x) { return iw2FormatKern().indexOf(x.id) > -1; });
    var uit = keuze.map(function (x) {
      /* De beschrijving is de context; de tags waren een rij losse woorden
         waar je niets aan hebt op het moment dat je moet kiezen. */
      return { key: x.id, label: x.name, sub: x.desc || (x.tags || []).slice(0, 3).join(' · '),
               aanbevolen: x.id === aanbevolen,
               zet: [['format', 'formatId', x.id]],
               gevolg: x.desc };
    });
    uit.push({ key: 'rory', label: 'Let Rory pick from all formats', rory: true,
               sub: 'He chooses from all 42 formats, not just this shortlist.',
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
  iw2.redenen = {};
  iw2.gediept = {};
  iw2.aannames = null;
  /* Ook de bezig-vlag. Bleef die van een mislukte aanroep staan, dan zou het
     volgende gesprek nooit op gang komen: elke aanroep begint met "if (busy)
     return", en dan lijkt het scherm stuk zonder dat er iets stuk is. */
  iw2.busy = false;
  iw2Zeg('rory', IW2_VRAGEN[0].vraag);
  wizToonInline();
  wizRender();
  iw2Aannames();
}

/* ── Wat Rory al denkt voordat je iets zegt ────────────────────────────────
 *
 * Een gesprek dat begint met "waar wil je beginnen?" doet alsof er niets
 * bekend is, terwijl de console een productbestand, klantonderzoek en een
 * advertentiehistorie heeft. Dat is niet bescheiden maar lui: het legt het werk
 * bij de mens dat de data al kan doen.
 *
 * Dus begint hij met zijn aannames op tafel, elk met waar hij hem vandaan
 * haalt, en met de uitnodiging er een onderuit te halen. Waar hij niets heeft
 * zegt hij dat -- dat is de nuttigste regel van de vijf, want daar zit precies
 * wat jij wel weet en het systeem niet. */
function iw2Aannames() {
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) return;
  if (iw2.busy) return;
  iw2.busy = true;
  wizRender();

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  var sys = WIZ_RORY_SYSTEM + '\n\nYou are opening an interview about a new static ad. ' +
    'Before the first question, put your assumptions on the table: what you already believe ' +
    'about this product, this market and this buyer, and what you are reading that from. ' +
    'Three or four, no more. Diagnose before you prescribe: the point is to be corrected ' +
    'early, not to look prepared.\n' +
    'Say plainly where you have nothing. A gap you name is worth more than an assumption you ' +
    'dress up, because that gap is exactly where the marketer knows something the data does not.\n' +
    'Then ask ONE opening question that would change your recommendation most.\n' +
    'Answer with strict JSON: {"assumptions":[{"claim":"one sentence","from":"what you read it ' +
    'from, or \'nothing — I am guessing\'"}],"gaps":["what you cannot see from here"],' +
    '"question":"the one question","options":[{"label":"short answer","sub":"what it implies"}]}';

  wizCall(sys, [{ role: 'user', content: ctx.text }], 1200)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (!o || !(o.assumptions || []).length) return;
      iw2.aannames = { lijst: o.assumptions, gaten: o.gaten || o.gaps || [] };
      /* Zijn openingsvraag komt in het gesprek te staan, met zijn eigen snelle
         antwoorden. De vaste startvraag blijft: die bepaalt de route. */
      if (o.question) {
        iw2Zeg('rory', o.question);
        var vs = iw2VerwerkVoorstellen(IW2_VRAGEN[0], o.options || []);
        if (vs) iw2.dynOpties = vs;
      }
    })
    .catch(function () { /* geen aannames is jammer, geen reden om het gesprek te blokkeren */ })
    .finally(function () { iw2.busy = false; wizRender(); });
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

  /* De reden bij het besluit vastleggen. Bij een eigen keuze is dat wat de
     optie zelf zegt; koos je de uitweg, dan komt de reden straks van Rory. */
  if (opt.zet && opt.gevolg) {
    opt.zet.forEach(function (z) { iw2.redenen[z[0] + '.' + z[1]] = opt.gevolg; });
  }

  /* En dan de vraag die dit gesprek van een formulier onderscheidt: heeft dit
     antwoord iets opengelaten dat zijn advies zou veranderen? Zo ja, dan vraagt
     hij door voordat we verder lopen. */
  if (iw2MagDiepen(v)) { iw2Diep(v, opt.label); return; }

  iw2Volgende();
}

/* ── Doorvragen ────────────────────────────────────────────────────────────
 *
 * Het verschil tussen een interview en een keuzelijst met tekstballonnen is dat
 * er iets teruggevraagd wordt. Maar niet alles is het waard: een vraag stellen
 * waarvan het antwoord niets verandert is de vermoeiendste vorm van
 * beleefdheid, en de vorige versie van dit scherm was er vol mee.
 *
 * Dus drie grenzen, en die zijn allemaal een rem op hetzelfde:
 *
 *   1. Alleen op de dragende vragen (IW2_DIEPVRAGEN). Bij een visuele stijl is
 *      jouw antwoord het antwoord; bij de hoek, de persona, het stadium en het
 *      doel zit er een waarom achter dat alles erna stuurt.
 *   2. Een keer per vraag.
 *   3. Hoogstens vier keer in het gesprek.
 *
 * En de belangrijkste: Rory mag zelf zeggen dat het niet nodig is. Vindt hij
 * het antwoord duidelijk genoeg, dan lopen we door zonder vraag. */
function iw2MagDiepen(v) {
  if (!v || IW2_DIEPVRAGEN.indexOf(v.key) === -1) return false;
  if (iw2.gediept[v.key]) return false;
  if (Object.keys(iw2.gediept).length >= IW2_MAX_DIEP) return false;
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) return false;
  return true;
}

function iw2Diep(v, antwoord) {
  iw2.gediept[v.key] = true;
  if (iw2.busy) { iw2Volgende(); return; }
  iw2.busy = true;
  wizRender();

  var ctx = (typeof wizContext === 'function') ? wizContext() : { text: '' };
  var sys = WIZ_RORY_SYSTEM + '\n\nYou are mid-interview. The marketer just answered ' +
    '"' + antwoord + '" to: "' + v.vraag + '".\n' +
    'Decide one thing: would knowing more about WHY they said that change what you ' +
    'recommend? Not whether it would be interesting — whether it would change the work.\n' +
    'If it would not, say so and we move on. Most answers do not need a follow-up, and a ' +
    'question whose answer changes nothing is the most tiring kind of politeness.\n' +
    'If it would, ask exactly one question, and make it one only someone who read the ' +
    'product data and the customer research could ask. Not "tell me more" — something with ' +
    'the market, the buyer or the product in it. Where the data disagrees with their answer, ' +
    'say so plainly and ask about that.\n' +
    'Answer with strict JSON: {"dig":true|false,"question":"the one question, or empty",' +
    '"why":"one line: what it would change","options":[{"label":"short answer","sub":"what it implies"}]}';

  wizCall(sys, [{ role: 'user', content: ctx.text }], 700)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      if (o && o.dig && o.question) {
        iw2Zeg('rory', o.question);
        var vs = iw2VerwerkVoorstellen(v, o.options || []);
        if (vs) iw2.dynOpties = vs;
        /* Blijven staan: dit is nu de vraag. Antwoorden loopt via iw2Antwoord,
           dat de volgende stap zet zodra Rory hem opgelost noemt. */
        iw2.busy = false;
        wizRender();
        return;
      }
      iw2.busy = false;
      iw2Volgende();
    })
    .catch(function () { iw2.busy = false; iw2Volgende(); })
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
    '"fill":{"field":"value"},' +
    '"reasons":{"vak.veld":"why this value and not another, one line"},' +
    '"summary":"two or three sentences ' +
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
      /* Zijn redenen vastleggen bij het veld. Wat hij invulde zonder dat jij
         het koos, hoort te zeggen waarom -- anders staat er een besluit zonder
         eigenaar in de blueprint. */
      Object.keys(o.reasons || {}).forEach(function (pad) {
        if (!iw2.redenen[pad]) iw2.redenen[pad] = o.reasons[pad];
      });
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

/* De toegestane waarden staan in de leer (43-wizard-leer.js): het gesprek en
   de brain dump vullen dezelfde velden en delen dus dezelfde grens. */
function iw2Toegestaan(vak, veld) {
  return (typeof wizToegestaan === 'function') ? wizToegestaan(vak, veld) : null;
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
  /* Zijn aannames staan boven het gesprek: het is wat hij dacht voordat jij
     iets zei, en dat hoort niet halverwege ergens op te duiken. */
  var links = iw2RenderAannames();
  links += '<div class="iw2-chat" id="iw2-chat">' + iw2.chat.map(function (r) {
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
  { label: 'Product', pad: 'product.productId', lees: function (d) { var p = wizProduct(); return p ? p.name : ''; } },
  { label: 'Goal', pad: 'strategy.goal', lees: function (d) { return d.strategy.goal; } },
  { label: 'Funnel', pad: 'product.funnel', lees: function (d) { return d.product.funnel ? wizLabel('funnel', d.product.funnel) : ''; } },
  { label: 'Audience', pad: 'audience.personaId', lees: function (d) { var p = wizPersona(); return p ? p.name : ''; } },
  { label: 'Awareness', pad: 'audience.awareness', lees: function (d) { return d.audience.awareness ? wizLabel('awareness', d.audience.awareness) : ''; } },
  { label: 'Sophistication', pad: 'audience.sophistication', lees: function (d) { return d.audience.sophistication ? wizSofistLabel(d.audience.sophistication) : ''; } },
  { label: 'Desire', pad: 'strategy.desire', lees: function (d) { return d.strategy.desire; } },
  { label: 'Angle', pad: 'strategy.theme', lees: function (d) { return d.strategy.theme; } },
  { label: 'Marketing angle', pad: 'strategy.marketingAngle', lees: function (d) { return d.strategy.marketingAngle; } },
  { label: 'Different how', pad: 'strategy.differentiation', lees: function (d) { return d.strategy.differentiation ? wizDiffLabel(d.strategy.differentiation) : ''; } },
  { label: 'Mechanism', pad: 'strategy.mechanism', lees: function (d) { return d.strategy.mechanism; } },
  { label: 'Format', pad: 'format.formatId', lees: function (d) { var f = wizFormat(); return f ? f.name : ''; } },
  { label: 'Visual style', pad: 'visual.mood', lees: function (d) { return d.visual.mood ? wizVisualLabel('mood', d.visual.mood) : ''; } },
  { label: 'Human', pad: 'visual.humanPresence', lees: function (d) { return d.visual.humanPresence ? wizVisualLabel('humanPresence', d.visual.humanPresence) : ''; } },
  { label: 'Headline', pad: 'copy.headline', lees: function (d) { return d.copy.headline; } },
  { label: 'CTA', pad: 'copy.cta', lees: function (d) { return d.copy.cta; } }
];

/* Zijn openingsanalyse boven het gesprek. Niet als losse kaart ergens rechts:
   het is het eerste wat hij zegt, dus het staat waar hij praat. */
function iw2RenderAannames() {
  var a = iw2.aannames;
  if (!a || !(a.lijst || []).length) return '';
  return '<div class="iw2-aannames">' +
    '<div class="iw2-aannames-k">What I am assuming before you say anything</div>' +
    (a.lijst || []).map(function (x) {
      return '<div class="iw2-aanname"><span class="iw2-aanname-c">' + wizEsc(x.claim || '') + '</span>' +
        '<span class="iw2-aanname-b">' + wizEsc(x.from || '') + '</span></div>';
    }).join('') +
    ((a.gaten || []).length
      ? '<div class="iw2-gaten"><span class="iw2-gaten-k">What I cannot see from here</span>' +
        (a.gaten || []).map(function (g) { return '<span class="iw2-gat">' + wizEsc(g) + '</span>'; }).join('') +
        '</div>'
      : '') +
    '<div class="iw2-aannames-v">Pull one of these apart if it is wrong — that is worth more to me than the answers.</div>' +
    '</div>';
}

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
    /* Per regel: wat er staat, wie het koos, en waarom. Die laatste twee zijn
       waar het gesprek op stukliep -- je liep tien vragen langs, en aan het eind
       stond er een blueprint waarvan je niet meer wist welk deel jouw besluit
       was en welk deel Rory had ingevuld, laat staan waarom. */
    IW2_RIJEN.map(function (r) {
      var w = r.lees(d) || '';
      var bron = r.pad ? wizState.source[r.pad] : null;
      var reden = r.pad ? iw2.redenen[r.pad] : null;
      return '<div class="iw2-bp-rij' + (w ? '' : ' leeg') + '">' +
        '<span>' + wizEsc(r.label) + '</span>' +
        '<b>' + (w ? wizEsc(w) : '—') + '</b>' +
        (w && bron ? '<i class="iw2-bp-bron ' + wizEsc(bron) + '">' +
          (bron === 'user' ? 'you' : 'Rory') + '</i>' : '') +
        (w && reden ? '<u class="iw2-bp-reden">' + wizEsc(reden) + '</u>' : '') +
        '</div>';
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
window.iw2Aannames = iw2Aannames; window.iw2RenderAannames = iw2RenderAannames;
window.iw2Diep = iw2Diep; window.iw2MagDiepen = iw2MagDiepen;
window.iw2Vraag = iw2Vraag; window.iw2Opties = iw2Opties; window.IW2_VRAGEN = IW2_VRAGEN;
window.IW2_RIJEN = IW2_RIJEN; window.iw2Afronden = iw2Afronden;
window.iw2OpenVelden = iw2OpenVelden; window.iw2OpenTekst = iw2OpenTekst;
window.iw2Toegestaan = iw2Toegestaan; window.iw2VulAan = iw2VulAan;
