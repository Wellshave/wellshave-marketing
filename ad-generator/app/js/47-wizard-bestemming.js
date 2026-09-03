/* Static Ad Wizard — bestemming en dossier.
 *
 * Drie dingen die tot nu toe ontbraken, en die alle drie hetzelfde probleem
 * hebben: de beslissing wordt wel genomen, maar nergens vastgelegd, dus je
 * kunt er later niet op sturen.
 *
 *   1. WAAR DE KLIK LANDT. Een landingspagina is geen nazorg. Het platform
 *      leest de advertentie EN de pagina, en beslist op allebei aan wie hij
 *      hem laat zien. Een ad die een nieuwe groep aanspreekt en dan naar een
 *      pagina voor de oude massa wijst, geeft een tegenstrijdig signaal: de
 *      lezer verliest de draad, en het algoritme ook. In het gedocumenteerde
 *      voorbeeld zakte de kostprijs per aankoop van ~$85 naar ~$62 door
 *      alleen de bestemming te wisselen -- de conversie bewoog nauwelijks,
 *      de CPM en de kosten per klik zakten. Dat is het congruentie-effect,
 *      geen overtuigingseffect.
 *
 *   2. DE ADVERTENTIENAAM. Een creative die in de bibliotheek staat maar in
 *      Meta "Copy of Copy of Ad 3" heet, is achteraf niet terug te vinden.
 *      Dan staat er wel data maar weet niemand meer welke hoek erachter zat,
 *      en dat is precies de data waarop je zou willen itereren.
 *
 *   3. HET DOSSIER. Hoek, differentiatie, verlangen, awareness,
 *      sophistication, mechanisme: dat staat in de wizard, maar verdween bij
 *      het opslaan. Zonder die velden naast het beeld is een bibliotheek een
 *      plakboek in plaats van een testlog.
 *
 * De interfacetaal is Engels; de commentaren hier zijn Nederlands.
 */

/* ── De vier bestemmingen ───────────────────────────────────────────────── */

/* past: bij welke awareness-stadia deze bestemming hoort. Dat is geen smaak
   maar dezelfde as als de rest van de wizard: hoe minder de lezer al weet,
   hoe meer pagina er nodig is voordat een product logisch wordt. */
var WIZ_BESTEMMINGEN = [
  { value: 'listicle', label: 'Listicle',
    hint: '"N reasons why". You control which points land before the product page.',
    past: ['solution', 'product'],
    waarom: 'It lets you place the USPs and the us-versus-them comparison in the order you want, which is what a reader who knows the solution types but not you still needs.' },
  { value: 'advertorial', label: 'Advertorial',
    hint: 'Reads like an article: what they tried, why it failed, then the new solution.',
    past: ['unaware', 'problem'],
    waarom: 'A reader who does not yet know the problem, or knows it but no solution, needs the diagnosis before the product means anything.' },
  { value: 'quiz', label: 'Quiz funnel',
    hint: 'The reader answers and diagnoses themselves. The product answers their own conclusion.',
    past: ['unaware', 'problem'],
    waarom: 'The ad plants the problem, the quiz confirms it in their own words, and the product lands as the answer to a diagnosis they just gave themselves.' },
  { value: 'pdp', label: 'Product page',
    hint: 'Straight to the product. For traffic that has already been sold.',
    past: ['product', 'most'],
    waarom: 'Someone who knows the brand and is waiting for a reason does not need another article in the way.' }
];

function wizBestemming(waarde) {
  var v = waarde || wizState.data.strategy.destination;
  return WIZ_BESTEMMINGEN.filter(function (b) { return b.value === v; })[0] || null;
}

/* Welke bestemming bij dit publiek hoort. Geeft null terug zonder awareness:
   zonder publiek is er niets te adviseren, en een verzonnen aanbeveling is
   erger dan een leeg veld. */
function wizBestemmingAdvies() {
  var aw = wizState.data.audience.awareness;
  if (!aw) return null;
  var passend = WIZ_BESTEMMINGEN.filter(function (b) { return b.past.indexOf(aw) !== -1; });
  if (!passend.length) return null;
  /* Bij unaware en problem passen er twee (advertorial en quiz). De
     advertorial is de standaard omdat hij zonder extra bouwwerk kan; de quiz
     staat er als bewuste tweede keuze naast. */
  return { keuze: passend[0].value, ook: passend.slice(1).map(function (b) { return b.value; }) };
}

/* Waarschuwt als de gekozen bestemming niet bij de awareness past. Dit is de
   enige harde controle hier: hij blokkeert niets, want soms is er maar één
   pagina die bestaat, maar hij laat het wel zien. */
function wizBestemmingMismatch() {
  var aw = wizState.data.audience.awareness, dest = wizState.data.strategy.destination;
  if (!aw || !dest) return null;
  var b = wizBestemming(dest);
  if (!b || b.past.indexOf(aw) !== -1) return null;
  var advies = wizBestemmingAdvies();
  var beter = advies ? wizBestemming(advies.keuze) : null;
  return 'This audience is ' + aw + '-aware. ' + b.label + ' is built for ' +
    b.past.join(' and ') + '-aware traffic' +
    (beter ? ', so ' + beter.label + ' fits this ad better.' : '.') +
    ' Meta reads the ad and the page together, so a mismatch costs you reach before it costs you conversion.';
}

/* ── De advertentienaam voor het advertentie-account ────────────────────── */

/* Waarom een vaste volgorde met korte codes: je leest hem terug in een
   rapportage die naast elkaar staat, dus hij moet op breedte te scannen zijn
   en op elk deel te filteren. Product eerst (waar gaat het over), dan de
   twee assen (tegen wie praat je hoe), dan de hoek en het anders-zijn (wat
   test je), dan de bestemming, en pas dan de variant en de datum.

   De codes komen uit dezelfde tabellen als de bestandsnaam, zodat een
   gedownload beeld en de advertentie in Meta dezelfde taal spreken. */

var WIZ_DEST_CODE = { listicle: 'LIST', advertorial: 'ADVT', quiz: 'QUIZ', pdp: 'PDP' };
var WIZ_DIFF_CODE = { mechanism: 'MECH', exaggeration: 'EXAG', avatar: 'AVTR', desire: 'DSIR', style: 'STYL' };

function wizNaamStuk(tekst, lengte) {
  return String(tekst || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, lengte || 24);
}

/* meta is het metadata-object van een bibliotheekitem (of van de wizard).
   variant is 1-gebaseerd: mensen tellen advertenties vanaf 1, niet vanaf 0. */
function wizAdNaam(meta, variant) {
  meta = meta || {};
  var w = meta.wizardBrief || {};
  var strat = w.strategy || {};
  var stukken = [];

  stukken.push(wizNaamStuk(meta.product, 20) || 'ad');
  if (meta.awareness) stukken.push('AW-' + (typeof abbrevAware === 'function' ? abbrevAware(meta.awareness) : wizNaamStuk(meta.awareness, 6).toUpperCase()));
  if (meta.sophistication) stukken.push('SO-' + (typeof abbrevSoph === 'function' ? abbrevSoph(meta.sophistication) : wizNaamStuk(meta.sophistication, 4).toUpperCase()));
  /* De hoek is het enige vrije tekstveld in de naam. Hij moet erin: zonder de
     hoek is een rij in de rapportage een productnaam met codes eromheen, en
     dan weet je nog steeds niet wat er getest werd. */
  var hoek = strat.theme || meta.concept || '';
  if (hoek) stukken.push('ANG-' + wizNaamStuk(hoek, 28));
  if (strat.differentiation) stukken.push('DF-' + (WIZ_DIFF_CODE[strat.differentiation] || wizNaamStuk(strat.differentiation, 6).toUpperCase()));
  if (strat.destination) stukken.push('LP-' + (WIZ_DEST_CODE[strat.destination] || wizNaamStuk(strat.destination, 6).toUpperCase()));
  if (meta.personaName) stukken.push('PE-' + (typeof abbrevPersona === 'function' ? abbrevPersona(meta.personaName) : wizNaamStuk(meta.personaName, 6).toUpperCase()));
  if (meta.funnel) stukken.push(String(meta.funnel).toUpperCase());
  stukken.push('V' + (variant == null ? 1 : (variant + 1)));

  var d = new Date(meta.timestamp || Date.now());
  var datum = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  stukken.push(datum);
  return stukken.join('_');
}

/* ── Het dossier: wat er over deze creative vastligt ────────────────────── */

/* Eén plek die bepaalt welke velden meegaan naar de bibliotheek en welke er
   op de kaart komen te staan. Zonder die ene plek gaan de opslag en de
   weergave uit elkaar lopen, en dan toont de kaart iets anders dan er
   bewaard is. */
var WIZ_DOSSIER = [
  { key: 'angle',           label: 'Marketing angle',   pad: ['strategy', 'theme'] },
  { key: 'marketingAngle',  label: 'The angle in full', pad: ['strategy', 'marketingAngle'] },
  { key: 'differentiation', label: 'Different how',     pad: ['strategy', 'differentiation'], opts: 'WIZ_DIFFERENTIATION' },
  { key: 'mechanism',       label: 'Mechanism',         pad: ['strategy', 'mechanism'] },
  { key: 'desire',          label: 'Desire',            pad: ['strategy', 'desire'] },
  { key: 'ultimateDesire',  label: 'Ultimate desire',   pad: ['strategy', 'ultimateDesire'] },
  { key: 'awareness',       label: 'Awareness',         pad: ['audience', 'awareness'], opts: 'WIZ_AWARENESS' },
  { key: 'sophistication',  label: 'Sophistication',    pad: ['audience', 'sophistication'], opts: 'WIZ_SOPHISTICATION' },
  { key: 'destination',     label: 'Lands on',          pad: ['strategy', 'destination'], opts: 'WIZ_BESTEMMINGEN' },
  { key: 'proof',           label: 'Proof',             pad: ['strategy', 'proof'] },
  { key: 'timing',          label: 'Why now',           pad: ['strategy', 'timing'] },
  /* Bij een redactioneel formaat zijn dit twee besluiten die je later terug
     wilt kunnen zien: welke artikelstijl het was, en wie eronder stond. Het
     tweede vooral -- als er ooit een klacht komt is dat de vraag. */
  { key: 'newsArchetype',   label: 'Editorial style',   pad: ['visual', 'newsArchetype'], opts: 'NIEUWS_ARCHETYPEN' },
  { key: 'newsAfzender',    label: 'Article from',      pad: ['visual', 'newsAfzender'], opts: 'NIEUWS_AFZENDERS' }
];

/* Zet een opgeslagen waarde om naar het label dat de mens koos. Zonder dit
   staat er "mechanism" en "s3" op de kaart in plaats van "New mechanism" en
   het stadium zoals het in de wizard heet. */
function wizDossierLabel(regel, waarde) {
  if (!waarde) return '';
  if (!regel.opts) return String(waarde);
  var lijst = window[regel.opts];
  if (!Array.isArray(lijst)) return String(waarde);
  /* De ene catalogus heet zijn sleutel 'value', de andere 'id'. Beide
     accepteren scheelt een tweede labelfunctie die na een maand uit de pas
     loopt met deze. */
  var o = lijst.filter(function (x) { return (x.value || x.id) === waarde; })[0];
  return o ? o.label : String(waarde);
}

/* Het dossier uit een wizardBrief halen. Werkt zowel op de levende wizard
   (wizState.data) als op een bewaard item, want dat is dezelfde vorm. */
function wizDossierVan(brief) {
  if (!brief) return [];
  return WIZ_DOSSIER.map(function (r) {
    var v = ((brief[r.pad[0]] || {})[r.pad[1]]) || '';
    return { key: r.key, label: r.label, waarde: v, tekst: wizDossierLabel(r, v) };
  }).filter(function (r) { return r.waarde; });
}

window.WIZ_BESTEMMINGEN = WIZ_BESTEMMINGEN; window.wizBestemming = wizBestemming;
window.wizBestemmingAdvies = wizBestemmingAdvies; window.wizBestemmingMismatch = wizBestemmingMismatch;
window.wizAdNaam = wizAdNaam; window.WIZ_DOSSIER = WIZ_DOSSIER;
window.wizDossierVan = wizDossierVan; window.wizDossierLabel = wizDossierLabel;
