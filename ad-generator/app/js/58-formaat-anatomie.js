/* ═══════════════════════════════════════════════════════════════════════════
   De anatomie van een formaat — waarom niet elke ad hetzelfde hoort te zijn

   Beslisvraag (opgeschreven vóór deze regel code):

       "Waarom komt er uit tweeënveertig formaten altijd dezelfde advertentie?"

   Het antwoord bleek geen smaakkwestie maar een lek in onze eigen promptlaag.
   De catalogus wéét al welke formaten merkloos zijn, welke geen knop hebben en
   welke op bewijs leunen -- die vlaggen staan er per formaat in. Ze werden
   alleen gebruikt om een labeltje op de keuzekaart te zetten. Ze bereikten de
   beeldprompt nooit.

   Wat de beeldprompt WEL kreeg, bij elke generatie:
     - "every piece of text, the WELLSHAVE wordmark and the CTA button must sit
       fully inside the safe area" -- een zin die aanneemt dat er een wordmark
       en een knop zijn;
     - een overlay-blok dat kop, body en CTA rendert zodra die velden gevuld
       zijn, en de copystap vult ze altijd.

   Je kon dus "Review screenshot" kiezen en er kwam een huisstijlblok met een
   gouden knop uit. Tweeënveertig formaten, één advertentie.

   Dit bestand doet twee dingen:

     1. HET ZEGT HOE EEN FORMAAT ERUITZIET. Eén regel per formaat: wat er in
        beeld is, wat de typografie doet, en wat er beslist NIET op mag. Zonder
        die regel weet het model wel dát het "WhatsApp-chat" heet en niet hoe
        dat eruitziet -- en dan valt het terug op wat het het vaakst gezien
        heeft, en dat is de nette DR-layout.

     2. HET LAAT DE VLAGGEN DOORWERKEN. brandless betekent geen wordmark, geen
        merkfonts, geen trust-badge. cta 'none' betekent geen knop. proof
        false betekent geen badge. Dat stond al in de catalogus; het werd
        alleen nooit doorgegeven.

   Wat hier NIET gebeurt: kiezen. Welk formaat het wordt blijft een besluit van
   de gebruiker, en de nette layout blijft een geldig antwoord -- bij BOF en
   retargeting is hij zelfs het juiste. Zie wizFormaatAdvies() voor het moment
   waarop Rory voorstelt hem te breken.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Per formaat: wat je ziet. In het Engels, want dit gaat rechtstreeks de
   beeldprompt in en die is Engels -- vertalen zou een tweede vertaalslag in
   het model leggen.

   Elke regel zegt drie dingen: wat er in beeld is, wat de tekst doet, en wat
   er niet mag. Dat laatste is het belangrijkst: zonder "no brand layout" valt
   het model terug op de layout die het het vaakst gezien heeft. */
var FORMAAT_ANATOMIE = {
  /* A · Product-led */
  'product-hero': 'The product alone on a clean, uncluttered surface or gradient, lit like a catalogue shot. Generous negative space around it. One short headline; nothing else competes.',
  'feature-callout': 'The product centred, with four to six thin leader lines pointing outward to small feature labels in a light sans-serif. Technical, calm, diagram-like. No paragraph of body copy.',
  'benefit-stack': 'The product on one side, a vertical stack of three to five short benefit lines with check marks on the other. Reads like a summary card.',
  'what-s-in-the-box': 'A flat lay, shot from directly above: every part of the package laid out on a neutral surface with small labels naming each item. No lifestyle scene.',
  'exploded-view': 'The product taken apart into floating layers along one axis, evenly spaced, with thin lines and short technical labels. Studio background, engineered feel.',
  'offer-bundle-stack': 'Multiple products stacked or arranged as one bundle, with a value anchor: an original price struck through and the new price next to it.',
  'grid-collage': 'A grid of four to six panels in one frame: product, use, result, detail. Thin gutters between panels, each panel a distinct photo.',
  'prijsanker-deal': 'One very large price or discount number dominating the frame, the product smaller beside it. Bold, loud, sale-like. Nothing subtle.',
  'gift-guide': 'The product presented as a gift: wrapping, a seasonal setting or a giving moment, framed for the buyer rather than the user.',

  /* B · Social proof */
  'testimonial-pull-quote': 'A large quote in quotation marks filling most of the frame, set in an editorial serif or heavy sans, with the product small in a corner. The quote is the image.',
  'review-wall': 'Three to five review cards tiled across the frame, each with a star row, a short line of text and a first name. Slight overlap, like a wall of cards.',
  '5-sterren-cards': 'Two or three cards side by side, each with a real-looking customer photo, a five-star row and one sentence. Feels like a social feed, not a poster.',
  'review-screenshot': 'A literal screenshot of a review interface: the platform chrome visible, star rating, review title, body text, reviewer name and date, verified badge. Slightly imperfect crop, real UI proportions. It must NOT look designed.',
  'whatsapp-chat': 'A phone screenshot of a chat thread: green and white message bubbles, timestamps, read ticks, contact name in the header. Two or three messages, a recommendation between friends. Nothing else in the frame.',
  'tweet-reddit-screenshot': 'A screenshot of a single social post: avatar, handle, the post text, and the interaction row underneath. Native platform typography and spacing, no design polish.',
  'ig-comment-section': 'The product image on top, an Instagram comment section beneath it: avatars, usernames, short comments, like counts. Native UI, not a designed layout.',
  'tiktok-made-me-buy-it': 'A vertical UGC still with a chunky white caption bar over it in the platform font, slightly off-centre, phone-camera quality.',
  'stat-data-callout': 'One very large number or percentage as the whole image, with a short line naming what it measures and a small source note. Editorial, spare.',
  'ugc-still-klantfoto': 'A photo that looks taken on a phone by a customer: available light, imperfect framing, ordinary room. No studio lighting, no retouching, no graphic elements at all.',

  /* C · Vergelijking & educatie */
  'us-vs-them-tabel': 'A split frame or two-column table: one side with check marks, the other with crosses, four to six comparison rows. Clean, legible, chart-like.',
  'before-after': 'One frame split into two halves, or a diptych with a thin divider: the before state and the after state, same framing and light in both so the difference is the only variable.',
  '3-redenen-waarom': 'Three numbered blocks stacked or side by side, each with a short line. The numbers are large; the structure carries the image.',
  'checklist-herkenbaar': 'A list of three to five recognisable complaints with check boxes, set as a note or list. The product appears small, at the end, as the answer.',
  'how-it-works': 'Three steps left to right or top to bottom, each with a small illustration or photo and a short caption. Arrows between steps. Explanatory, mechanism-first.',
  'faq-objection': 'A question set large as the headline, the answer beneath it in smaller type. Set like a FAQ entry, quiet and direct.',
  'mythe-vs-feit': 'Two blocks: MYTH struck through or in red on one side, FACT on the other. The contrast is the composition.',
  'kostenvergelijking': 'Two cost figures compared over a period, as a simple bar or two columns, with the yearly total large. Rational, spreadsheet-like clarity.',
  'persona-callout': 'A line beginning "Voor mannen die..." set large over a photo of exactly that person. The callout does the targeting; nothing else is needed.',
  'probleem-agitatie': 'The problem shown large and close: a macro of the irritation, the damage, the mess. The product is small or absent. Uncomfortable rather than pretty.',
  'wist-je-dat': 'An insight or fact set as the headline over a simple, slightly surprising image. Editorial tone, no product hero shot.',

  /* D · Native & lo-fi */
  'ugly-ad': 'Deliberately undesigned: system font, flat bright background colour, text typed rather than typeset, no grid, no polish. It must look like it was made in five minutes.',
  'meme-format': 'A recognisable meme structure: image with impact-style caption text top and bottom, or a two-panel comparison. Rough, funny, of the internet. No brand layout.',
  'whiteboard-notitie': 'Handwriting on a whiteboard, a notebook page or a notes app screen. The whole pitch written by hand. No typeset text at all.',
  'search-bar-ad': 'A search bar with a typed query and an autocomplete dropdown beneath it, exactly like a browser or app. Native UI, nothing else in the frame.',
  'reminder-ad': 'Plain text on a plain background, like a personal message. Small type, lots of space, no imagery. Reads as a note rather than an ad.',
  'notification-screenshot': 'A phone lock screen or notification banner with one message visible, the time and date behind it. Exact platform proportions. Nothing designed on top.',
  'post-it-handgeschreven': 'A sticky note or torn paper with a handwritten line, photographed in a real environment: on a mirror, a fridge, a bathroom cabinet.',
  'photo-dump-casual': 'An ordinary phone snapshot, uncomposed, natural light, slight blur. The product is present but incidental, as it would be in a real photo.',

  /* E · Editorial & advertorial */
  'news-headline-advertorial': 'An article layout: masthead area, a serif headline, a standfirst, a byline and date line, a photo with a caption, and the first paragraphs of body text in columns. It reads as journalism.',
  'magazine-cover': 'A magazine cover: full-bleed cover photo, a masthead across the top, and three or four cover lines down one side. Premium print typography.',
  'founder-note': 'A letter or note from the founder: a portrait or workspace photo, a short handwritten-feeling message and a signature. Personal, low on graphics.',
  'seizoensmoment-editorial': 'An editorial photo carrying a seasonal moment, with one line of type set like a magazine caption rather than an ad headline.'
};

/* De vlaggen, in woorden die het beeldmodel begrijpt. Dit is het stuk dat er
   niet was: `brandless: true` stond in de catalogus en het beeld kreeg
   niettemin het volledige huisstijlblok. */
function formaatVlagregels(f) {
  if (!f) return '';
  var r = [];
  if (f.brandless) {
    r.push('This format is NATIVE: it must not look like a designed brand ad. No wordmark or logo, ' +
      'no brand fonts, no brand colour scheme, no trust badge, no designed button. ' +
      'If the brand appears at all it is only because it is genuinely part of the scene.');
  }
  if (f.cta === 'none') {
    r.push('No CTA button and no call-to-action element anywhere in the image.');
  } else if (f.cta === 'soft') {
    r.push('At most a restrained call to action: a small text link or a modest button, never a large loud button.');
  }
  if (!f.proof) {
    r.push('No review badge, star rating, Trustpilot element, customer count or guarantee seal.');
  }
  return r.join(' ');
}

/* De regel die de beeldprompt in gaat. Leeg als we het formaat niet kennen --
   dan is er niets te zeggen, en iets verzinnen is erger dan zwijgen. */
function formaatBeeldregel(formatId) {
  if (!formatId || formatId === 'auto') return '';
  if (typeof AD_FORMATS === 'undefined') return '';
  var f = AD_FORMATS.filter(function (x) { return x.id === formatId; })[0];
  if (!f) return '';
  var anat = FORMAAT_ANATOMIE[formatId] || '';
  var vlaggen = formaatVlagregels(f);
  if (!anat && !vlaggen) return '';
  return 'FORMAT ANATOMY (this is what the ad looks like, it overrides any default ad layout): ' +
    f.name + '. ' + (anat ? anat + ' ' : '') + vlaggen;
}

/* Of dit formaat een knop en een merkblok verdraagt. De layoutregel in de
   prompt noemde de wordmark en de knop altijd bij naam, alsof ze er waren --
   bij een screenshot of een meme is dat een opdracht om ze erbij te tekenen. */
function formaatWilKnop(formatId) {
  if (typeof AD_FORMATS === 'undefined') return true;
  var f = AD_FORMATS.filter(function (x) { return x.id === formatId; })[0];
  return !f || f.cta !== 'none';
}

function formaatWilMerk(formatId) {
  if (typeof AD_FORMATS === 'undefined') return true;
  var f = AD_FORMATS.filter(function (x) { return x.id === formatId; })[0];
  return !f || !f.brandless;
}

window.FORMAAT_ANATOMIE = FORMAAT_ANATOMIE;
window.formaatBeeldregel = formaatBeeldregel;
window.formaatVlagregels = formaatVlagregels;
window.formaatWilKnop = formaatWilKnop;
window.formaatWilMerk = formaatWilMerk;
