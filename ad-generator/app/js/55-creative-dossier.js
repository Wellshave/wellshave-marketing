/* Het creative dossier — wat je krijgt als je in de bibliotheek op een static
 * klikt.
 *
 * Wat er stond: het beeld, de kop, een regel meta, en daaronder het hele
 * dossier plus de matrix onder elkaar geplakt. Acht matrixvelden met precies
 * hetzelfde gewicht, elk in een tekstvakje van drie regels met zijn eigen
 * schuifbalk -- dus je scrolde binnen een vakje om een zin te lezen die je
 * niet aan het bewerken was.
 *
 * Wat er nu staat, en waarom in deze volgorde:
 *
 *   1. DE KOP. De headline is de titel, met een kruimelpad eronder. Dat is
 *      meteen duidelijk wat je voor je hebt; beginnen met een label is de
 *      conclusie voor het onderwerp zetten.
 *
 *   2. HET BEELD MET ZIJN VARIANTEN. Een concept IS een ad set van drie, en
 *      die stonden als drie losse kaarten in de bibliotheek alsof ze niets
 *      met elkaar te maken hadden. Ze horen bij elkaar en je wilt ze naast
 *      elkaar kunnen zien.
 *
 *   3. NICKS OORDEEL, PER AS. Vier assen in plaats van een cijfer. Een enkel
 *      cijfer verbergt juist welke as zwak is, en dat is het enige waar je
 *      iets aan hebt: "een 4" zegt niet wat je moet repareren, "bewijskracht
 *      gemiddeld, de rest sterk" wel. Het cijfer blijft ernaast staan als
 *      optelsom, want daar sorteer je op.
 *
 *   4. KERNINFORMATIE. Het dossier als sleutel-waardelijst. Leest sneller dan
 *      een rij chips, en een leeg veld valt op in plaats van weg.
 *
 *   5. DRIE TABBLADEN. Overzicht, landingspagina, matrix. Niet zeven: een
 *      tabblad dat leeg opengaat leert je binnen een week om niet meer te
 *      klikken, en dan klik je ook niet meer op de tabbladen die wel iets
 *      hebben. Performance, learnings en iteraties komen erbij zodra er een
 *      databron achter zit.
 *
 * TAAL: dit paneel is Nederlands, net als de rest van de bibliotheek.
 */

function dosEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* ── De variaties die bij elkaar horen ──────────────────────────────────── */

/* Alles uit dezelfde batch, op volgorde van hun plek erin. Zonder batch-id
   staat een item alleen -- dat is een item van voor de batches en dat is geen
   fout, alleen minder. */
function dosVarianten(item) {
  var lib = (typeof state !== 'undefined' && state.library) ? state.library : [];
  if (!item || !item.batch_id) return [item].filter(Boolean);
  return lib.filter(function (x) { return x.batch_id === item.batch_id; })
    .sort(function (a, b) { return (a.variant_index || 0) - (b.variant_index || 0); });
}

/* ── De kop ─────────────────────────────────────────────────────────────── */

/* Het kruimelpad: product, stijl, funnel, hoek. Alleen wat er werkelijk is --
   een pad met lege schakels erin leest als kapot. */
function dosKruimels(item) {
  var m = item.metadata || {}, b = m.wizardBrief || {};
  var stukken = [];
  if (m.product) stukken.push(m.product);
  if (typeof wizNieuwsArchetype === 'function' && b.visual && b.visual.newsArchetype
      && typeof NIEUWS_ARCHETYPEN !== 'undefined') {
    var a = NIEUWS_ARCHETYPEN.filter(function (x) { return x.id === b.visual.newsArchetype; })[0];
    if (a) stukken.push(a.label);
  } else if (m.mode) {
    var f = (typeof AD_FORMATS !== 'undefined' ? AD_FORMATS : []).filter(function (x) { return x.id === m.mode; })[0];
    if (f) stukken.push(f.name);
  }
  if (m.funnel) stukken.push(String(m.funnel).toUpperCase());
  if (b.strategy && b.strategy.theme) stukken.push(b.strategy.theme);
  return stukken;
}

/* ── Het oordeel ────────────────────────────────────────────────────────── */

function dosOordeelHtml(item) {
  var mat = item.matrix || {};
  var cijfer = (typeof nickSchoon === 'function') ? nickSchoon('score', mat.score) : '';
  var geveld = (typeof NICK_ASSEN !== 'undefined')
    ? NICK_ASSEN.filter(function (a) { return (typeof nickStand === 'function') && nickStand(mat[a.key]); })
    : [];

  /* Nog geen oordeel: dan staat er wat er nodig is om er een te krijgen, en
     niet een leeg kader dat eruitziet alsof er iets kapot is. */
  if (!geveld.length && !cijfer) {
    return '<div class="dos-kaart dos-oordeel leeg">' +
      '<div class="dos-oordeel-kop"><span class="dos-avatar" aria-hidden="true">N</span>' +
      '<span class="dos-naam">Nicks oordeel</span></div>' +
      '<p class="dos-leegtekst">Nog niet beoordeeld. Nick kijkt naar de vier assen waarop een static ' +
      'wel of niet gaat spenden, en zegt welke het zwakst is.</p>' +
      '<button type="button" class="dos-knop" data-action="nick-analyse" data-id="' + dosEsc(item.id) + '">' +
      'Laat Nick kijken</button></div>';
  }

  var assen = (typeof NICK_ASSEN !== 'undefined' ? NICK_ASSEN : []).map(function (a) {
    var st = (typeof nickStand === 'function') ? nickStand(mat[a.key]) : '';
    if (!st) return '';
    return '<div class="dos-as ' + st + '" title="' + dosEsc(a.vraag) + '">' +
      '<em>' + dosEsc(a.label) + '</em>' +
      '<b>' + dosEsc(st.charAt(0).toUpperCase() + st.slice(1)) + '</b>' +
      '<u><i></i></u></div>';
  }).join('');

  var zwak = (typeof nickZwakstePunt === 'function') ? nickZwakstePunt(item) : null;
  return '<div class="dos-kaart dos-oordeel">' +
    '<div class="dos-oordeel-kop">' +
      '<span class="dos-avatar" aria-hidden="true">N</span>' +
      '<span class="dos-naam">Nicks oordeel</span>' +
      (cijfer ? '<span class="dos-cijfer">' + dosEsc(cijfer) + '<small>/5</small></span>' : '') +
    '</div>' +
    (zwak
      ? '<p class="dos-oordeel-zin">Zwakste as: <b>' + dosEsc(zwak.label) + '</b>. ' +
        'Dat is waar de volgende ronde aan werkt, en wat de landingspagina moet dichten.</p>'
      : '<p class="dos-oordeel-zin">Alle vier de assen staan sterk.</p>') +
    '<div class="dos-assen">' + assen + '</div>' +
    '</div>';
}

/* ── Kerninformatie ─────────────────────────────────────────────────────── */

/* Welke velden er staan, in leesvolgorde en niet in de volgorde waarin ze in
   de brief zitten. Een leeg veld blijft staan met "niet vastgelegd": dat is
   informatie, en weglaten zou de indruk wekken dat het veld niet bestaat. */
var DOS_KERN = [
  { label: 'Product',        pad: ['metadata', 'product'] },
  { label: 'Marketing angle', pad: ['brief', 'strategy', 'marketingAngle'] },
  { label: 'Plaatsing',      pad: ['metadata', 'placement'] },
  { label: 'Kernboodschap',  pad: ['brief', 'strategy', 'messaging'] },
  { label: 'Funnel',         pad: ['metadata', 'funnel'] },
  { label: 'Pijn',           pad: ['brief', 'strategy', 'pain'] },
  { label: 'Awareness',      pad: ['brief', 'audience', 'awareness'], opts: 'WIZ_AWARENESS' },
  { label: 'Verlangen',      pad: ['brief', 'strategy', 'desire'] },
  { label: 'Sophistication', pad: ['brief', 'audience', 'sophistication'], opts: 'WIZ_SOPHISTICATION' },
  { label: 'Mechanisme',     pad: ['brief', 'strategy', 'mechanism'] },
  { label: 'Persona',        pad: ['metadata', 'personaName'] },
  { label: 'Bewijs',         pad: ['brief', 'strategy', 'proof'] }
];

function dosKernWaarde(item, regel) {
  var bron = regel.pad[0] === 'brief'
    ? ((item.metadata || {}).wizardBrief || {})
    : (item[regel.pad[0]] || {});
  var w = bron;
  for (var i = 1; i < regel.pad.length; i++) { w = (w || {})[regel.pad[i]]; }
  if (w == null || String(w).trim() === '') return '';
  var tekst = String(w);
  if (regel.opts && Array.isArray(window[regel.opts])) {
    var o = window[regel.opts].filter(function (x) { return x.value === tekst; })[0];
    if (o) tekst = o.label;
  }
  return tekst;
}

function dosKernHtml(item) {
  var rijen = DOS_KERN.map(function (r) {
    var w = dosKernWaarde(item, r);
    return '<div><dt>' + dosEsc(r.label) + '</dt>' +
      (w ? '<dd>' + dosEsc(w) + '</dd>' : '<dd class="leeg">Niet vastgelegd</dd>') + '</div>';
  }).join('');
  return '<div class="dos-kaart"><h4>Kerninformatie</h4><div class="dos-kern">' + rijen + '</div></div>';
}

/* ── Tabblad 1: overzicht ───────────────────────────────────────────────── */

/* Wat werkt goed, wat kan beter, wat is de volgende stap. Dit is de scorecard
   in de vorm waarin je hem gebruikt. De inhoud komt uit de matrix en het
   oordeel; er wordt niets bijverzonnen -- staat er niets, dan staat dat er. */
function dosOverzichtHtml(item) {
  var mat = item.matrix || {};
  var goed = [], beter = [];

  var hook = (typeof nickVeld === 'function') ? nickVeld(item, 'hook').waarde : '';
  var proof = (typeof nickVeld === 'function') ? nickVeld(item, 'proof').waarde : '';
  var cow = (typeof nickVeld === 'function') ? nickVeld(item, 'purplecow').waarde : '';

  (typeof NICK_ASSEN !== 'undefined' ? NICK_ASSEN : []).forEach(function (a) {
    var st = (typeof nickStand === 'function') ? nickStand(mat[a.key]) : '';
    if (st === 'sterk') goed.push(a.label + ' staat sterk.');
    else if (st === 'gemiddeld' || st === 'zwak') beter.push(a.label + ' staat ' + st + '.');
  });
  if (hook) goed.push('Hook: ' + hook);
  if (cow) goed.push('Anders dan de rest: ' + cow);
  if (proof) beter.push('Bewijs zoals het nu in beeld staat: ' + proof);

  var zwak = (typeof nickZwakstePunt === 'function') ? nickZwakstePunt(item) : null;
  var lijst = function (items, klasse) {
    if (!items.length) return '<p class="dos-leegtekst">Nog niets vastgelegd.</p>';
    return '<ul class="' + klasse + '">' + items.map(function (t) {
      return '<li>' + dosEsc(t) + '</li>';
    }).join('') + '</ul>';
  };

  /* En Rory's redenering bij deze variatie. Die stond in het oude paneel en
     is bij het herbouwen bijna blijven liggen: het is de enige plek waar
     staat WAAROM deze uitvoering zo gekozen is, en zonder dat lees je straks
     een beeld terug zonder de gedachte erachter. */
  var v = item.variation || {};
  var redenering = '';
  if (typeof libExtraHtml === 'function') redenering = libExtraHtml(v, true);

  return (redenering ? '<div class="dos-redenering">' + redenering + '</div>' : '') +
    '<div class="dos-drie">' +
    '<div class="dos-kaart"><h4 class="dos-kaartkop">Wat werkt goed</h4>' + lijst(goed, 'dos-goed') + '</div>' +
    '<div class="dos-kaart"><h4 class="dos-kaartkop">Verbeterpunten</h4>' + lijst(beter, 'dos-beter') + '</div>' +
    '<div class="dos-kaart dos-stap"><h4 class="dos-kaartkop">Volgende stap</h4>' +
      (zwak
        ? '<p>Draai een variant die <b>' + dosEsc(zwak.label.toLowerCase()) + '</b> repareert. ' +
          'Dat is de as die nu op ' + dosEsc(zwak.stand) + ' staat, en de enige waar winst te halen is.</p>' +
          '<button type="button" class="dos-knop" data-action="itereer" data-id="' + dosEsc(item.id) + '">Maak deze variant</button>'
        : '<p class="dos-leegtekst">Laat Nick eerst kijken; dan staat hier waar de volgende ronde aan werkt.</p>' +
          '<button type="button" class="dos-knop stil" data-action="nick-analyse" data-id="' + dosEsc(item.id) + '">Laat Nick kijken</button>') +
    '</div></div>';
}

/* ── Tabblad 2: de landingspagina ───────────────────────────────────────── */

function dosLandingHtml(item) {
  var s = (typeof lpSoort === 'function') ? lpSoort(item) : null;
  if (!s) {
    /* Melden dat er iets ontbreekt en het daarbij laten is de helft van een
       bericht. Deze creative komt meestal uit de itereerroute, waar de
       strategie van de bron niet meekwam; dan wil je hem hier alsnog kunnen
       zetten in plaats van de wizard opnieuw te doorlopen.
       Vier knoppen, en elke knop zegt wanneer hij hoort -- kiezen uit vier
       namen zonder uitleg is ook gokken, alleen met meer stappen. */
    var soorten = (typeof LP_SOORTEN !== 'undefined') ? LP_SOORTEN : {};
    return '<p class="dos-leegtekst">Er is geen bestemming vastgelegd en er is geen awareness om er ' +
      'een uit af te leiden. Zonder een van die twee is elke pagina een gok. ' +
      'Kies hieronder waar de klik landt, dan staat de rest er meteen.</p>' +
      '<div class="dos-kies">' +
      Object.keys(soorten).map(function (k) {
        return '<button type="button" class="dos-kieskaart" data-action="kies-bestemming" ' +
          'data-id="' + dosEsc(item.id) + '" data-soort="' + dosEsc(k) + '">' +
          '<b>' + dosEsc(soorten[k].label) + '</b>' +
          '<span>' + dosEsc(soorten[k].kern) + '</span></button>';
      }).join('') +
      '</div>';
  }
  var soort = LP_SOORTEN[s.soort];
  var eisen = (typeof lpEisen === 'function') ? lpEisen(item) : [];
  var prompt = (typeof lpPrompt === 'function') ? lpPrompt(item) : '';

  return '<div class="dos-lpkop">' +
      '<h3>De pagina waar de klik landt</h3>' +
      '<span class="dos-soort">' + dosEsc(soort.label) + '</span>' +
      (s.afgeleid ? '<span class="dos-merk">Afgeleid uit awareness</span>' : '') +
    '</div>' +
    '<p class="dos-waarom">' + dosEsc(lpWaarom(item)) + '</p>' +
    '<p class="dos-eyebrow">Wat er op die pagina moet staan</p>' +
    '<ul class="dos-moet">' + eisen.map(function (e) {
      return '<li' + (e.gat ? ' class="gat"' : '') + '>' + dosEsc(e.tekst) + '</li>';
    }).join('') + '</ul>' +
    '<div class="dos-promptvak">' +
      '<button type="button" class="dos-kopieer" data-action="kopieer-lp" data-id="' + dosEsc(item.id) + '">Kopieer prompt</button>' +
      '<pre>' + dosEsc(prompt) + '</pre>' +
    '</div>';
}

/* ── Tabblad 3: de matrix ───────────────────────────────────────────────── */

/* De vier tekstvelden plus de notities, als leesbare blokken. Klik erin om te
   wijzigen. Een afgeleide waarde draagt een streep in de kantlijn en een knop
   die hem als bevestigd vastlegt -- zonder dat verschil weet je over een
   maand niet meer wat een mens heeft nagekeken. */
var DOS_MATRIX = ['hook', 'proof', 'avatar', 'purplecow', 'notes'];

function dosMatrixHtml(item) {
  var blokken = DOS_MATRIX.map(function (key) {
    var regel = (typeof NICK_MATRIX !== 'undefined' ? NICK_MATRIX : []).filter(function (r) { return r.key === key; })[0];
    if (!regel) return '';
    var r = (typeof nickVeld === 'function') ? nickVeld(item, key) : { waarde: '', afgeleid: false };
    var leeg = !r.waarde;
    var merk = leeg ? 'Nog leeg' : (r.afgeleid ? 'Afgeleid' : 'Bevestigd');
    return '<div class="dos-veld' + (r.afgeleid ? ' af' : '') + (leeg ? ' leeg' : '') + '" data-veld="' + key + '">' +
      '<div class="dos-veldkop"><b>' + dosEsc(regel.label) + '</b>' +
        '<span class="dos-merk' + (!leeg && !r.afgeleid ? ' vast' : '') + '">' + merk + '</span>' +
        (r.afgeleid ? '<button type="button" class="dos-bevestig" data-action="bevestig" ' +
          'data-id="' + dosEsc(item.id) + '" data-veld="' + key + '">Klopt</button>' : '') +
      '</div>' +
      '<p contenteditable="true" data-matrix-id="' + dosEsc(item.id) + '" data-matrix-field="' + key + '">' +
        dosEsc(r.waarde || 'Klik hier om iets vast te leggen.') + '</p>' +
      '</div>';
  }).join('');

  var naam = (typeof libAdNaam === 'function') ? libAdNaam(item) : (item.ad_name || '');
  return '<div class="dos-velden">' + blokken +
    (naam ? '<div class="dos-veld"><div class="dos-veldkop"><b>Advertentienaam</b>' +
      '<span class="dos-merk vast">Vastgelegd</span>' +
      '<button type="button" class="dos-bevestig" data-action="copy-name" data-id="' + dosEsc(item.id) + '">Kopieer</button></div>' +
      '<p class="dos-adnaam">' + dosEsc(naam) + '</p></div>' : '') +
    '</div>' +
    '<p class="dos-hint">Klik in een blok om het te wijzigen. &ldquo;Klopt&rdquo; legt een afgeleide waarde vast ' +
    'als bevestigd &mdash; daarna telt hij als beslissing en niet meer als gok.</p>';
}

/* ── Het geheel ─────────────────────────────────────────────────────────── */

var DOS_TABS = [
  { key: 'overzicht', label: 'Overzicht', bouw: dosOverzichtHtml },
  { key: 'landing',   label: 'Landingspagina', bouw: dosLandingHtml },
  { key: 'matrix',    label: 'Matrix', bouw: dosMatrixHtml }
];

function dosPaneelHtml(item, actief) {
  actief = actief || 'overzicht';
  var v = item.variation || {}, m = item.metadata || {};
  var varianten = dosVarianten(item);
  var hasImg = !!(item.image && item.image.b64);
  var d = new Date(item.saved_at);
  var datum = isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });

  var beeld = hasImg
    ? '<img class="dos-beeld-img" src="data:' + ((item.image.mime) || 'image/png') + ';base64,' + item.image.b64 + '" alt="">'
    : '<div class="dos-geenbeeld">Geen afbeelding bewaard</div>';

  var strip = varianten.length > 1
    ? '<div class="dos-strip">' + varianten.map(function (x, i) {
        return '<button type="button" data-action="wissel" data-id="' + dosEsc(x.id) + '" ' +
          'aria-pressed="' + (x.id === item.id) + '">' +
          (x.image && x.image.b64
            ? '<img src="data:' + ((x.image.mime) || 'image/png') + ';base64,' + x.image.b64 + '" alt="Variatie ' + (i + 1) + '">'
            : ('V' + (i + 1))) + '</button>';
      }).join('') + '</div>'
    : '';

  return '<div class="dos-kop">' +
      '<div class="dos-koprij">' +
        '<span class="dos-pil">Static ad</span>' +
        (varianten.length > 1 ? '<span class="dos-pil set">' + varianten.length + ' variaties</span>' : '') +
        (datum ? '<span class="dos-datum">Bewaard op ' + dosEsc(datum) + '</span>' : '') +
      '</div>' +
      '<h3 class="dos-titel">' + dosEsc(v.headline_nl || '(geen headline)') + '</h3>' +
      '<div class="dos-kruimels">' + dosKruimels(item).map(function (k, i) {
        return (i ? '<i>&middot;</i>' : '') + '<span>' + dosEsc(k) + '</span>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="dos-lijf">' +
      '<div class="dos-beeld">' + beeld + strip + '</div>' +
      '<div class="dos-kolom">' + dosOordeelHtml(item) + dosKernHtml(item) + '</div>' +
    '</div>' +
    '<div class="dos-tabs" role="tablist">' + DOS_TABS.map(function (t) {
      return '<button type="button" role="tab" data-action="tab" data-tab="' + t.key + '" ' +
        'data-id="' + dosEsc(item.id) + '" aria-selected="' + (t.key === actief) + '">' +
        dosEsc(t.label) + '</button>';
    }).join('') + '</div>' +
    DOS_TABS.map(function (t) {
      return '<div class="dos-paneel" data-paneel="' + t.key + '"' + (t.key === actief ? '' : ' hidden') + '>' +
        t.bouw(item) + '</div>';
    }).join('');
}

window.dosPaneelHtml = dosPaneelHtml; window.dosVarianten = dosVarianten;
window.dosKruimels = dosKruimels; window.dosOordeelHtml = dosOordeelHtml;
window.dosKernHtml = dosKernHtml; window.dosOverzichtHtml = dosOverzichtHtml;
window.dosLandingHtml = dosLandingHtml; window.dosMatrixHtml = dosMatrixHtml;
window.DOS_TABS = DOS_TABS; window.DOS_KERN = DOS_KERN; window.dosKernWaarde = dosKernWaarde;
