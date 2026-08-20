/* Static Ad Wizard — de nieuws- en artikelstijl.
 *
 * Waar dit vandaan komt: twee swipe files over statics die naar een
 * advertorial sturen (26 creatives) en over statics die zich als nieuws
 * voordoen (40 creatives), allebei uit Meta's advertentietransparantie.
 *
 * Wat het systeem hiervoor wist over dit formaat was één zin: "opgemaakt als
 * nieuwsartikel: krantenkop, subkop, intro-alinea". Dat is genoeg om een
 * model iets te laten tekenen dat vaag naar een krant riekt, en te weinig om
 * te bepalen WELK soort artikel het is, hoe het eruitziet en waarom het de
 * scroll breekt. Vandaar dit bestand.
 *
 * De drie dingen die uit die 66 creatives volgen en die hier vastliggen:
 *
 *   1. HET ARCHETYPE. "Nieuwsstijl" is geen stijl maar zes stijlen, die
 *      verschillen in wie de aandacht vangt (de kop, de typografie, het
 *      cijfer of juist het volstrekte ontbreken van opmaak) en die elk een
 *      andere anatomie hebben. Een krantenkop en een gewoon telefoonbeeld
 *      zijn allebei "nieuws" en zijn elkaars tegenpolen.
 *
 *   2. DE OPVALLENDHEID. Wat deze beelden laat werken zit niet in de
 *      opsmuk maar in negen keuzes die je kunt navertellen: de kop gaat over
 *      de wereld en niet over het product, er staat één getal in dat klopt,
 *      de doelgroep wordt genoemd, de knop belooft lezen. Ze staan hier als
 *      regels omdat ze anders per generatie opnieuw uitgevonden worden.
 *
 *   3. DE GRENS. Dit is het formaat met de meeste juridische ellende erin,
 *      en al die ellende komt uit één plek: de afzender. Nagebouwde
 *      uitgeverijen, geleende logo's, verzonnen keurmerken, verzonnen
 *      onderzoek. De best presterende creative uit beide bestanden was
 *      telkens juist degene die zijn autoriteit ECHT verdiend had. Dus staat
 *      hier een lijst van wat nooit verzonnen wordt, met naast elke regel wat
 *      je in plaats daarvan doet -- want een verbod zonder alternatief wordt
 *      genegeerd.
 *
 * Deze leer draait alleen mee als er ook werkelijk een redactioneel formaat
 * gekozen is. Op een productposter is een krantenkop geen verbetering maar
 * ruis.
 *
 * TAAL: interface Engels, commentaren Nederlands.
 */

/* ── Wanneer deze leer meedraait ───────────────────────────────────────── */

/* De formaten die redactioneel zijn. Ze zitten niet allemaal in categorie E:
   een weetje of een groot cijfer wordt óók een artikelbeeld zodra de klik op
   een advertorial landt, en dan hoort dezelfde anatomie te gelden. */
var NIEUWS_FORMATS = ['news-headline-advertorial', 'magazine-cover',
                      'seizoensmoment-editorial', 'wist-je-dat', 'stat-data-callout'];

/* ── De zes archetypes ─────────────────────────────────────────────────── */

/* Per archetype: wanneer je hem kiest, waar de aandacht vandaan komt, en de
   anatomie -- de elementen die er in die volgorde op staan. Die anatomie is
   het deel dat naar de beeldopdracht gaat, want "als een nieuwsartikel" laat
   het model raden en dan tekent hij een krantenpagina met een merklogo erop. */
var NIEUWS_ARCHETYPEN = [
  {
    id: 'krantenkop',
    label: 'The news headline',
    kort: 'Kicker, serif headline, byline, documentary photo, read button.',
    wanneer: 'Unaware and problem-aware traffic heading for an advertorial. You have something to report about the world, not about the product.',
    aandacht: 'The typography does the work. A newspaper serif in a feed full of brand sans-serif reads as "something to read" before a single word is understood.',
    anatomie: [
      'A kicker in small capitals above the headline: the subject, not a publication name.',
      'The headline in a newspaper serif, 5 to 9 words, near-black on off-white, generous leading.',
      'One sub-headline line that adds the detail the headline left out.',
      'A thin horizontal rule, then a byline with a real name and a date.',
      'Below it one documentary photograph: available light, real place, no studio.',
      'At the bottom a button drawn INTO the image that promises reading: "Lees het hele artikel →".'
    ],
    weglaten: 'No brand wordmark, no gold CTA pill, no price, no product name in the headline.',
    risico: 'laag'
  },
  {
    id: 'tijdschriftpagina',
    label: 'The magazine page',
    kort: 'Two columns, drop cap, pull quote, folio. Premium and calm.',
    wanneer: 'Solution-aware traffic and a product that survives being photographed slowly. Works when the brand can carry an unhurried, expensive look.',
    aandacht: 'It is the opposite of urgent, and that is the pattern break. Everything around it in the feed is shouting.',
    anatomie: [
      'Two text columns, or one column with a wide outer margin.',
      'An oversized initial capital on the first paragraph.',
      'A pull quote in italic serif between two hairlines, taken from the body.',
      'A folio in the corner: a page number and the section name.',
      'One editorial photograph -- a still life or a reportage frame, never a packshot on white.'
    ],
    weglaten: 'No CTA pill, no badges, no starburst. The product is small and part of the page.',
    risico: 'laag'
  },
  {
    id: 'redactietest',
    label: 'The editorial test',
    kort: 'Every product in the category, flat lay, a score on each.',
    wanneer: 'Solution-aware and product-aware traffic that is already comparing. Only if you actually ran the test.',
    aandacht: 'You do not have to read anything. The difference between the numbers IS the advertisement.',
    anatomie: [
      'All tested products photographed from directly above on one neutral surface, in identical light.',
      'A small dark label on each product carrying its score.',
      'The winner is not crowned: it simply holds the highest number.',
      'No headline needed. If there is one, it names the count: "Wij testten er tien".',
      'The method line at the bottom, small, in the same face as the labels.'
    ],
    weglaten: 'No laurel wreath, no "winner" seal, no logo of a publication that did not run the test.',
    risico: 'hoog'
  },
  {
    id: 'onthulling',
    label: 'The reveal',
    kort: 'Condensed capitals, hard contrast, one detail circled.',
    wanneer: 'Problem-aware traffic and a genuinely surprising finding. The loudest of the six and the one that burns out fastest.',
    aandacht: 'Tabloid typography plus a marked-up photograph reads as evidence, and evidence stops a scroll harder than a promise.',
    anatomie: [
      'The headline in condensed sans capitals, tight tracking, two or three lines, maximum contrast.',
      'One photograph beneath or behind it, and one detail in it circled or arrowed in red as if by hand.',
      'A question mark where the claim would otherwise be flat -- it keeps the curiosity and softens the assertion.',
      'One number, and it must be a number you can source.',
      'A read button, not a buy button.'
    ],
    weglaten: 'No broadcaster logo, no seal, no "banned" or "exposed" unless something was actually banned or exposed.',
    risico: 'hoog'
  },
  {
    id: 'weetje',
    label: 'The fact on a plain ground',
    kort: 'Text only. No product, no model, no photograph.',
    wanneer: 'Unaware traffic, and the cheapest first test of any angle. Make fifteen in an afternoon.',
    aandacht: 'It looks like something a person posted, not something a brand bought. Text-only carries the highest hit rate of any static style in the only serious dataset that exists (11.6 percent, Motion Creative Benchmarks 2026).',
    anatomie: [
      'A plain or softly textured ground: paper, a wall, a single flat colour.',
      'Two or three lines of text in a serif, set large, with wide margins around them.',
      'The fact carries the whole thing -- no supporting graphics, no icons, no arrows.',
      'If the product appears at all it is small and at the bottom.'
    ],
    weglaten: 'No brand colour, no wordmark, no button. It should be shareable, not clickable-looking.',
    risico: 'zeer laag'
  },
  {
    id: 'bericht',
    label: 'The plain report',
    kort: 'One documentary photo, no overlay at all. The news lives in the copy.',
    wanneer: 'Unaware and problem-aware traffic where the primary text does the telling. The purest "this is not an advertisement" move.',
    aandacht: 'Nothing about it announces itself, so it is read before it is classified. The image asks a question the caption answers.',
    anatomie: [
      'One photograph taken on a phone: available light, real room or real street, slight grain.',
      'A crooked horizon and an imperfect crop are advantages, not mistakes.',
      'No text on the image. None. Not a word, not a logo, not a button.',
      'The frame should raise a question that only the primary text resolves.'
    ],
    weglaten: 'Everything. If you are tempted to add one small line, that is the archetype telling you to pick a different one.',
    risico: 'zeer laag'
  }
];

/* Welk archetype standaard bij welk formaat hoort. Een suggestie, geen slot:
   je kunt een weetje ook als krantenkop opmaken, en dat is een besluit dat de
   mens neemt. */
var NIEUWS_STANDAARD = {
  'news-headline-advertorial': 'krantenkop',
  'magazine-cover': 'tijdschriftpagina',
  'seizoensmoment-editorial': 'tijdschriftpagina',
  'wist-je-dat': 'weetje',
  'stat-data-callout': 'onthulling'
};

/* ── Wat deze beelden laat opvallen ────────────────────────────────────── */

/* Negen regels, allemaal terug te voeren op de creatives in beide bestanden.
   Ze staan hier los van het archetype omdat ze voor alle zes gelden. */
var NIEUWS_OPVAL = [
  'The headline is about the world, not about your product. Not one winning headline in either file names the product.',
  'One surprising number, and it has to be true. 127 creams, 24 devices, 48 hours, 87 percent. If you cannot source it, drop it -- the burden of proof is on the advertiser.',
  'Name the audience in the headline. "Mannen boven de 40", "na uw 55e". It filters and it flatters in one move.',
  'A question mark is an ally. It softens a claim legally without costing any curiosity.',
  'The button promises reading, never buying: "Lees het hele artikel", "Lees meer". That also matches what actually sits behind the click, which is what the platform checks.',
  'Typography carries the genre: a newspaper serif or condensed capitals. Never the brand typeface, never a template look.',
  'Palette is newsprint and ink plus at most one accent. No brand colour, no gold pill, no gradient.',
  'The photograph is documentary, not studio: available light, a real place, an imperfect crop.',
  'The product is small or absent. Of the 26 advertorial statics, three showed the product as the subject.'
];

/* ── De grens ──────────────────────────────────────────────────────────── */

/* Alles wat in beide swipe files misging, ging mis op de afzender. Elke regel
   heeft daarom een "wel": een verbod zonder alternatief wordt genegeerd, en
   het alternatief presteerde in de data telkens beter dan het geleende. */
var NIEUWS_GRENS = [
  { nooit: 'A publication that does not exist -- an invented magazine, journal or masthead, with a name or a logo.',
    wel:   'Your own domain with your own name above it. One advertiser in the file reached 886.000 people with the article simply sitting on its own /blogs/news/.' },
  { nooit: 'The name, logo or lettering of a real medium, retailer or television programme you have no licence for.',
    wel:   'One real placement with one real publisher, labelled as a collaboration. That is the route that reached 416.000 people in the file.' },
  { nooit: 'An invented seal, test-winner badge or quality mark.',
    wel:   'A mark you are genuinely entitled to display. The single best performing creative across both files -- 2,5 million reach -- was the one whose seal was real and licensed.' },
  { nooit: 'An invented study, panel, sample size or measuring instrument.',
    wel:   'A test you ran yourself, with the method published and your own losses included, or a reference to a publication that actually exists.' },
  { nooit: 'A staged conversation, review or screenshot presented as real.',
    wel:   'A real conversation used with permission from everyone in it, or the same thing marked plainly as an illustration.' },
  { nooit: 'A doctor, a white coat, a pharmacy or a practice you do not have.',
    wel:   'The founder, with his own name and his own face. That is an authority you own outright.' },
  { nooit: 'Urgency that is not real: "alleen vandaag" on a creative that will run for months.',
    wel:   'A deadline that exists, or no deadline at all. The reveal works on curiosity, not on a countdown.' }
];

/* ── De afzender ───────────────────────────────────────────────────────── */

/* Alleen echte opties. Er staat met opzet geen "een magazine dat we verzinnen"
   in deze lijst: een keuzelijst is een aanbod, en wat je aanbiedt wordt
   gekozen. */
var NIEUWS_AFZENDERS = [
  { value: 'eigen-domein', label: 'Our own domain, our own name',
    uitleg: 'The article sits on wellshave.com under the Wellshave name. Nothing to borrow, nothing to defend.' },
  { value: 'founder', label: 'The founder, on his own name',
    uitleg: 'Written and signed by the founder. His face and his name are authority you already own.' },
  { value: 'eigen-test', label: 'Our own test, method published',
    uitleg: 'We bought the competitors, tested them and published how -- including where we lose. Required for the editorial test archetype.' },
  { value: 'echte-plaatsing', label: 'A real placement with a real publisher',
    uitleg: 'A paid collaboration with an existing title, labelled as one. Needs an actual agreement before the ad runs.' },
  { value: 'echt-keurmerk', label: 'A mark we are entitled to carry',
    uitleg: 'A licensed seal or an award actually won. Needs the licence in hand.' }
];

/* ── Lezen en afleiden ─────────────────────────────────────────────────── */

function wizNieuwsFormatId() {
  return ((wizState.data.format || {}).formatId) || '';
}

/* Draait deze leer mee? Alleen bij een redactioneel formaat. Anders krijgt een
   productposter er een krantenkop bij die niemand besteld heeft. */
function wizNieuwsActief() {
  return NIEUWS_FORMATS.indexOf(wizNieuwsFormatId()) !== -1;
}

/* Het gekozen archetype, of anders dat wat bij het formaat hoort. Nooit een
   verzonnen middenweg: staat er niets en past er niets, dan is het leeg. */
function wizNieuwsArchetype() {
  var gekozen = (wizState.data.visual || {}).newsArchetype || '';
  var id = gekozen || NIEUWS_STANDAARD[wizNieuwsFormatId()] || '';
  if (!id) return null;
  return NIEUWS_ARCHETYPEN.filter(function (a) { return a.id === id; })[0] || null;
}

function wizNieuwsAfzender() {
  var v = (wizState.data.visual || {}).newsAfzender || '';
  return NIEUWS_AFZENDERS.filter(function (a) { return a.value === v; })[0] || null;
}

/* ── De gaten ──────────────────────────────────────────────────────────── */

/* Twee dingen die je pas merkt als de advertentie al draait, en dan is het
   duur. Ze komen als gat terug zodat de knop "breng me erheen" ze kan
   aanwijzen, net als de andere meldingen op de blueprint. */
function wizNieuwsGaten() {
  if (!wizNieuwsActief()) return [];
  var gaten = [];
  var arch = wizNieuwsArchetype();
  if (arch && !wizNieuwsAfzender()) {
    gaten.push({ label: 'who this article is from', stap: 'visual', veld: 'newsAfzender' });
  }
  /* De redactietest zonder eigen test is geen stijlkwestie: dan staat er een
     onafhankelijk oordeel in beeld dat niemand heeft geveld. */
  if (arch && arch.id === 'redactietest' &&
      (wizState.data.visual || {}).newsAfzender !== 'eigen-test') {
    gaten.push({ label: 'the test behind the scores', stap: 'visual', veld: 'newsAfzender' });
  }
  return gaten;
}

/* ── Naar de opdracht ──────────────────────────────────────────────────── */

/* Wat er in de conceptbrief terechtkomt. Alleen als de leer meedraait, en
   met de anatomie voluit: dit is precies het stuk dat een model zelf invult
   als je het niet oplegt, en dan komt er een krantenpagina met een logo op. */
function wizNieuwsBrief() {
  if (!wizNieuwsActief()) return '';
  var arch = wizNieuwsArchetype();
  var t = '\n## DE NIEUWS- EN ARTIKELSTIJL (geldt boven de standaardlook van het format)\n';

  if (arch) {
    t += 'Archetype: ' + arch.label + ' — ' + arch.kort + '\n';
    t += 'Where the attention comes from: ' + arch.aandacht + '\n';
    t += 'ANATOMY, in this order, and image_prompt_en must describe it:\n' +
      arch.anatomie.map(function (r) { return ' - ' + r; }).join('\n') + '\n';
    t += 'Leave out: ' + arch.weglaten + '\n';
  }

  t += '\nWhat makes this genre stop a scroll:\n' +
    NIEUWS_OPVAL.map(function (r) { return ' - ' + r; }).join('\n') + '\n';

  var afz = wizNieuwsAfzender();
  if (afz) {
    t += '\nThe sender under this article is REAL and it is: ' + afz.label + ' — ' + afz.uitleg + '\n' +
      'Put that sender in the image where a publication name would otherwise sit.\n';
  } else {
    t += '\nNo real sender has been chosen yet. Leave the masthead position EMPTY rather than ' +
      'filling it: an invented publication is the one mistake in this genre that costs an ad account.\n';
  }

  t += '\nHARD LIMITS — these are not style preferences:\n' +
    NIEUWS_GRENS.map(function (g) { return ' - Never: ' + g.nooit + ' Instead: ' + g.wel; }).join('\n') + '\n';
  return t;
}

/* En de compacte versie die met de beeldopdracht meegaat. De brief beschrijft;
   deze regel bepaalt. Kort houden: hij staat naast de veiligezone-instructie
   en een opdracht die alles even hard roept stuurt niets meer. */
function wizNieuwsBeeldregel() {
  if (!wizNieuwsActief()) return '';
  var arch = wizNieuwsArchetype();
  if (!arch) return '';
  var t = ' EDITORIAL FORMAT: this creative must read as ' + arch.label.toLowerCase() +
    ', not as an advertisement. ' + arch.anatomie.join(' ') + ' ' + arch.weglaten +
    ' Set the type in a newspaper serif or condensed capitals, never a brand typeface; ' +
    'keep the palette to newsprint and ink plus at most one accent colour.';
  var afz = wizNieuwsAfzender();
  t += afz
    ? (' The sender named on the image is: ' + afz.label + '.')
    : (' Do not put any publication name, masthead, logo or seal on the image: ' +
       'no real sender has been established, and inventing one is forbidden.');
  return t;
}

/* ── Het paneel in de visuele stap ─────────────────────────────────────── */

function wizNieuwsKies(id) {
  wizSet('visual', 'newsArchetype', id, 'user');
  wizRender();
}

function wizRenderNieuwsstijl() {
  if (!wizNieuwsActief()) return '';
  var arch = wizNieuwsArchetype();
  var gekozen = arch ? arch.id : '';
  var afzWaarde = (wizState.data.visual || {}).newsAfzender || '';

  var h = '<div class="wiz-refs wiz-nieuws">' +
    '<div class="wiz-refs-kop">Editorial style' +
      '<span class="wiz-refs-telling">' + NIEUWS_ARCHETYPEN.length + ' archetypes</span></div>' +
    '<p class="wiz-refs-uitleg">A news-style static is six different pictures, not one. ' +
    'Pick the one this angle needs — it decides the typography, the photograph and what may not be on it.</p>';

  h += '<div class="wiz-nieuwsrij">' + NIEUWS_ARCHETYPEN.map(function (a) {
    return '<button type="button" class="wiz-nieuwskaart' + (a.id === gekozen ? ' aan' : '') + '" ' +
      'onclick="wizNieuwsKies(\'' + a.id + '\')">' +
      '<span class="wiz-nieuwskaart-t">' + wizEsc(a.label) + '</span>' +
      '<span class="wiz-nieuwskaart-k">' + wizEsc(a.kort) + '</span>' +
      '</button>';
  }).join('') + '</div>';

  /* Het gekozen archetype uitgeschreven. Niet in een uitklap: wat er straks op
     het beeld komt te staan hoort te lezen te zijn voordat je genereert. */
  if (arch) {
    h += '<div class="wiz-nieuwsuit">' +
      '<div class="wiz-nieuwsuit-r"><em>When</em>' + wizEsc(arch.wanneer) + '</div>' +
      '<div class="wiz-nieuwsuit-r"><em>Why it stops a scroll</em>' + wizEsc(arch.aandacht) + '</div>' +
      '<div class="wiz-nieuwsuit-r"><em>On the image</em><ul>' +
      arch.anatomie.map(function (r) { return '<li>' + wizEsc(r) + '</li>'; }).join('') +
      '</ul></div>' +
      '<div class="wiz-nieuwsuit-r"><em>Left out</em>' + wizEsc(arch.weglaten) + '</div>' +
      '</div>';
  }

  /* De afzender. Dit is de enige plek waar dit formaat werkelijk fout gaat, en
     daarom staat hij hier als vraag en niet als optie in een uitklap. */
  h += '<div class="wiz-nieuwsbron' + (afzWaarde ? '' : ' leeg') + '">' +
    '<label for="wizf-visual-newsAfzender">Who is this article from?</label>' +
    '<select id="wizf-visual-newsAfzender" ' +
    'onchange="wizPick(\'visual\',\'newsAfzender\',this.value)">' +
    '<option value=""' + (afzWaarde ? '' : ' selected') + '>Not established yet</option>' +
    NIEUWS_AFZENDERS.map(function (a) {
      return '<option value="' + wizEsc(a.value) + '"' +
        (a.value === afzWaarde ? ' selected' : '') + '>' + wizEsc(a.label) + '</option>';
    }).join('') + '</select>' +
    '<p class="wiz-nieuwsbron-u">' +
    wizEsc(wizNieuwsAfzender()
      ? wizNieuwsAfzender().uitleg
      : 'Until this is set, the masthead position stays empty. Every account-level problem in this ' +
        'genre comes from an invented sender, never from the headline.') +
    '</p></div>';

  return h;
}

window.NIEUWS_ARCHETYPEN = NIEUWS_ARCHETYPEN; window.NIEUWS_FORMATS = NIEUWS_FORMATS;
window.NIEUWS_OPVAL = NIEUWS_OPVAL; window.NIEUWS_GRENS = NIEUWS_GRENS;
window.NIEUWS_AFZENDERS = NIEUWS_AFZENDERS; window.NIEUWS_STANDAARD = NIEUWS_STANDAARD;
window.wizNieuwsActief = wizNieuwsActief; window.wizNieuwsArchetype = wizNieuwsArchetype;
window.wizNieuwsAfzender = wizNieuwsAfzender; window.wizNieuwsGaten = wizNieuwsGaten;
window.wizNieuwsBrief = wizNieuwsBrief; window.wizNieuwsBeeldregel = wizNieuwsBeeldregel;
window.wizRenderNieuwsstijl = wizRenderNieuwsstijl; window.wizNieuwsKies = wizNieuwsKies;
