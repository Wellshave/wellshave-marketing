/* ═══════════════════════════════════════════════════════════════════════════
   Creative Research — wat er in de markt draait, en wat wij ermee doen

   Beslisvraag (opgeschreven vóór deze regel code):

       "Welke advertentie draait bij een ander al zo lang dat het geen toeval
        meer is, en welk patroon zit daaronder dat wij kunnen gebruiken?"

   Drie dingen bepalen de vorm van dit scherm, en alle drie zijn een reactie op
   hoe dit soort schermen misgaat.

   1. HET VOORBEHOUD STAAT BOVENAAN, NIET IN DE VOETNOOT. Tien advertenties met
      bereikcijfers ernaast zien eruit als een ranglijst van winnaars. Wij
      kennen van geen enkele de omzet. Het enige wat we weten is dat de
      adverteerder hem niet heeft uitgezet. De zin die dat zegt komt uit de
      bronlaag mee en wordt hier getoond -- niet hier verzonnen, zodat hij niet
      kan verdwijnen als iemand dit bestand herschrijft.

   2. ELKE SORTERING ZEGT WAT HIJ MEET. Looptijd en bereikgroei beantwoorden
      verschillende vragen, en ze door elkaar halen maakt het scherm nutteloos.
      Dus staat bij elke knop wat hij je vertelt, in dezelfde stijl als de rest
      van de console: een optie die niet zegt wanneer je hem kiest is een
      raadspelletje met meer stappen.

   3. WAT ER OVERGENOMEN WORDT IS HET PATROON, NOOIT HET WERK. De structuur,
      de hoek, het mechanisme, de bewijsvorm. Niet het beeld, niet de copy,
      niet de claim. Dat is niet alleen de nette lezing -- het is ook de enige
      bruikbare: de foto van een ander merk werkt niet in jouw advertentie, en
      hun claim is hun claim om waar te maken. Die grens staat in de prompt die
      naar Claude gaat, en hij staat in de brief die naar de wizard gaat.

   Dit bestand schrijft niets naar de bibliotheek. Het eindigt bij een ingevulde
   wizard; wat daar gemaakt wordt, wordt daar bewaard.
   ═══════════════════════════════════════════════════════════════════════════ */

var CR_SORTERINGEN = [
  { id: 'looptijd', label: 'Draait het langst',
    zegt: 'Al maanden in de lucht. Er zit een budget achter dat elke dag opnieuw verlengd wordt -- het betrouwbaarste openbare signaal dat er is.',
    let_op: 'Ook het traagste: wat hier bovenaan staat heeft de rest van de markt inmiddels ook gezien.' },
  { id: 'bereik', label: 'Grootste bereik',
    zegt: 'Het grootste publiek in dit venster.',
    let_op: 'Zegt hoe groot hij is, niet hoe lang hij al werkt. Een dure lancering staat hier ook bovenaan.' },
  { id: 'groei', label: 'Schaalt nu op',
    zegt: 'Hier wordt op dit moment geld op bijgezet.',
    let_op: 'Het vroegste signaal en het onbetrouwbaarste: dit kan over drie dagen stilstaan.' }
];

var CR_VENSTERS = [
  { id: 7, label: '7 dagen' },
  { id: 14, label: '14 dagen' },
  { id: 30, label: '30 dagen' }
];

var _cr = {
  /* De Brand Tracker is de standaard. "Wat draait er in de markt" en "wat
     draait er bij onze concurrenten" zijn twee verschillende vragen, en de
     tweede is de vraag die je stelt: de hele markt levert een Duitse
     kinderopvang op, de Brand Tracker levert Manscaped en BALZY. */
  bereik: 'brandtracker', merk: '', merken: null,
  sorteer: 'looptijd', dagen: 14, land: 'NL', taal: '', soort: '', zoek: '', limiet: 10,
  lijst: null, voorbehoud: null, venster: null, dagenGevraagd: null,
  hoeGerangschikt: null, merkenGebruikt: null, merkenMislukt: null, bereikMismatch: null,
  veldenZonderBeeld: null,
  bezig: false, fout: null, open: null, patroon: null, patroonBezig: false,
  /* De beelden die we al opgehaald hebben, per adres. Zonder dit haalt elke
     hertekening ze opnieuw op, en dat is bij tien kaarten tien verzoeken per
     klik op een filterknop. */
  beelden: {}
};

function crEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* Een getal zoals je het leest, en een leeg veld dat leeg blijft. Een streepje
   is hier het juiste antwoord: 0 zou een meting suggereren. */
function crGetal(n) {
  if (n === null || n === undefined || n === '') return '—';
  var x = Number(n);
  if (!isFinite(x)) return '—';
  if (x >= 1000000) return (x / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (x >= 1000) return Math.round(x / 1000) + 'k';
  return String(x);
}

function crBasis() {
  return (typeof PROXY_BASE === 'string' ? PROXY_BASE : '').replace(/\/$/, '');
}

/* Elke aanroep draagt het teamtoken. Zonder dat token weigert de worker, en
   dat is precies de bedoeling: deze route kost credits bij TrendTrack. */
async function crVraag(pad) {
  var o = { headers: { 'Content-Type': 'application/json' } };
  if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
  var r = await fetch(crBasis() + pad, o);
  var data = null;
  try { data = await r.json(); } catch (e) { data = {}; }
  if (!r.ok) {
    /* Nooit blind String() op wat er binnenkomt: de worker geeft bij een
       geweigerde login {error: "..."} en bij een onbekende route
       {error: {message: "..."}}, en die tweede werd "[object Object]" op het
       scherm -- een zin die niets zegt op de plek waar hoort te staan wat er
       mis is. */
    var melding = (typeof wgFoutTekst === 'function')
      ? wgFoutTekst(data, r.status) : ('de worker antwoordde met ' + r.status);
    var teOud = (typeof wgWorkerTeOud === 'function') ? wgWorkerTeOud(r.status, melding, '/onderzoek') : null;
    throw new Error(teOud || melding);
  }
  return data;
}

/* Het beeld van een concurrent kan de browser niet rechtstreeks ophalen, en de
   proxy die dat wel kan zit achter de login -- dus een <img src> werkt niet:
   die stuurt geen Authorization mee. Vandaar ophalen als blob en er een lokaal
   adres van maken. Dat adres is ook wat Claude straks leest. */
async function crBeeld(adres) {
  if (!adres) return null;
  if (_cr.beelden[adres]) return _cr.beelden[adres];
  var o = { headers: {} };
  if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
  var r = await fetch(crBasis() + '/onderzoek/beeld?u=' + encodeURIComponent(adres), o);
  if (!r.ok) return null;
  var blob = await r.blob();
  var lokaal = URL.createObjectURL(blob);
  _cr.beelden[adres] = { url: lokaal, blob: blob };
  return _cr.beelden[adres];
}

function crBlobNaarBase64(blob) {
  return new Promise(function (klaar, mislukt) {
    var lezer = new FileReader();
    lezer.onload = function () {
      var m = String(lezer.result).match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return mislukt(new Error('kon het beeld niet omzetten'));
      klaar({ mime: m[1], b64: m[2] });
    };
    lezer.onerror = function () { mislukt(new Error('kon het beeld niet lezen')); };
    lezer.readAsDataURL(blob);
  });
}

/* De gevolgde merken, los van een analyse. Zo staat de lijst er al voordat je
   credits uitgeeft aan advertenties. */
async function crHaalMerken() {
  try {
    var uit = await crVraag('/onderzoek/merken');
    _cr.merken = uit.merken || [];
  } catch (e) {
    /* Geen merkenlijst is vervelend maar niet fataal: je kunt nog steeds op
       alle merken tegelijk analyseren. */
    _cr.merken = [];
  }
  crRender();
}

/* ── Terug naar de lijst ───────────────────────────────────────────────────
   Een detailweergave zonder weg terug is een doodlopende weg, en de eerste
   plek waar iemand hem zoekt is de terugknop van de browser -- niet een link
   in de pagina. Vandaar een echte stap in de geschiedenis: openen duwt er een
   bij, terug haalt hem eraf, en de knop in de pagina doet hetzelfde als de
   knop van de browser. */
function crOpenAd(ad) {
  _cr.open = ad;
  _cr.patroon = null;
  try {
    history.pushState({ crOpen: true }, '', location.href);
  } catch (e) { /* geen geschiedenis is geen reden om niets te tonen */ }
  crRender();
}

function crSluitAd(viaGeschiedenis) {
  if (!_cr.open) return;
  _cr.open = null;
  _cr.patroon = null;
  /* Klikte je op de knop in de pagina, dan moet de stap ook uit de
     geschiedenis. Anders moet je twee keer terug voor er iets gebeurt. */
  if (!viaGeschiedenis) {
    try { if (history.state && history.state.crOpen) history.back(); } catch (e) { }
  }
  crRender();
  crLaadBeelden();
}

window.addEventListener('popstate', function () {
  if (_cr.open) crSluitAd(true);
});

/* ── De lijst ──────────────────────────────────────────────────────────── */

async function crHaalLijst() {
  _cr.bezig = true; _cr.fout = null; _cr.open = null; _cr.patroon = null;
  crRender();
  try {
    var p = new URLSearchParams({
      bereik: _cr.bereik, sorteer: _cr.sorteer, dagen: String(_cr.dagen), limiet: String(_cr.limiet)
    });
    if (_cr.bereik === 'brandtracker') {
      if (_cr.merk) p.set('merk', _cr.merk);
    } else {
      /* De filters op land, taal en soort horen bij de hele markt. Bij de Brand
         Tracker zijn ze zinloos: je hebt die merken zelf uitgekozen. */
      if (_cr.land) p.set('land', _cr.land);
      if (_cr.taal) p.set('taal', _cr.taal);
      if (_cr.soort) p.set('soort', _cr.soort);
      if (_cr.zoek) p.set('zoek', _cr.zoek);
    }
    var uit = await crVraag('/onderzoek/toplijst?' + p);
    /* Wat we vroegen naast wat we kregen. Dit is geen theoretische controle:
       een worker die de bereik-parameter nog niet kent negeert hem zwijgend en
       stuurt de hele markt terug -- en dan staat er "Analyseer onze Brand
       Tracker" boven een lijst met een Duitse kinderopvang erin. Het scherm
       geloofde zijn eigen knop in plaats van het antwoord.

       Ontbreekt het veld helemaal, dan is de worker ouder dan deze console. */
    _cr.bereikMismatch = null;
    if (!uit.bereik) {
      _cr.bereikMismatch = 'De worker weet nog niet wat een bereik is: hij is ouder dan deze console. ' +
        'Wat je hieronder ziet is de hele markt, niet onze Brand Tracker. Rol de worker uit ' +
        '(versie 22 of hoger) en probeer het opnieuw.';
    } else if (uit.bereik !== _cr.bereik) {
      _cr.bereikMismatch = 'Er is om ' + (_cr.bereik === 'brandtracker' ? 'onze Brand Tracker' : 'de hele markt') +
        ' gevraagd, maar er kwam ' + (uit.bereik === 'brandtracker' ? 'de Brand Tracker' : 'de hele markt') +
        ' terug. Wat hieronder staat is dus niet waar de knop om vroeg.';
    }
    _cr.lijst = uit.advertenties || [];
    if (uit.merken) _cr.merken = uit.merken;
    _cr.hoeGerangschikt = uit.hoe_gerangschikt || null;
    _cr.merkenGebruikt = uit.merken_gebruikt || null;
    _cr.merkenMislukt = uit.merken_mislukt || null;
    _cr.veldenZonderBeeld = uit.velden_zonder_beeld || null;
    /* Het voorbehoud en het gebruikte venster komen uit de bron mee. Ze worden
       hier niet opnieuw geformuleerd: dan zouden ze uit elkaar kunnen lopen. */
    _cr.voorbehoud = uit.voorbehoud || null;
    _cr.venster = uit.venster || null;
    _cr.dagenGevraagd = uit.dagen_gevraagd || null;
  } catch (e) {
    _cr.fout = String((e && e.message) || e);
    _cr.lijst = null;
  }
  _cr.bezig = false;
  crRender();
  if (_cr.lijst) crLaadBeelden();
}

/* De beelden komen na de lijst binnen, een voor een. De lijst wachten op tien
   plaatjes zou het scherm seconden leeg houden terwijl de tekst er al is. */
async function crLaadBeelden() {
  for (var i = 0; i < (_cr.lijst || []).length; i++) {
    var ad = _cr.lijst[i];
    if (!ad.beeld) continue;
    try {
      var b = await crBeeld(ad.beeld);
      if (!b) continue;
      var vak = document.querySelector('.cr-kaart[data-i="' + i + '"] .cr-beeld');
      if (vak) vak.innerHTML = '<img src="' + crEsc(b.url) + '" alt="">';
    } catch (e) { /* een beeld dat niet komt is geen reden om te stoppen */ }
  }
}

function crKaartHtml(ad, i) {
  var regels = [];
  if (ad.dagen_actief != null) regels.push('<b>' + crGetal(ad.dagen_actief) + '</b> dagen');
  if (ad.bereik != null) regels.push('<b>' + crGetal(ad.bereik) + '</b> bereik');
  /* Bij een gevolgd merk geeft TrendTrack geen bereik maar wel een positie.
     Die tonen in plaats van drie streepjes: een kaart zonder enig cijfer geeft
     je niets om op te kiezen. Lager is beter, dus met een hekje ervoor -- "12"
     zonder context leest als een hoeveelheid. */
  if (ad.bereik == null && ad.rang != null) {
    regels.push('positie <b>#' + crGetal(ad.rang) + '</b>');
  }
  if (ad.rang_delta != null && ad.rang_delta > 0) {
    regels.push('<b>+' + crGetal(ad.rang_delta) + '</b> gestegen');
  }
  if (ad.varianten != null) regels.push('<b>' + crGetal(ad.varianten) + '</b> varianten');
  return '<button type="button" class="cr-kaart" data-i="' + i + '" data-action="cr-open">' +
    '<div class="cr-beeld"><span class="cr-beeld-leeg">' +
      (ad.beeld ? 'beeld laden…' : 'geen beeld') + '</span></div>' +
    '<div class="cr-kaart-body">' +
      '<div class="cr-merk">' + crEsc(ad.merk || 'onbekend merk') + '</div>' +
      (ad.copy && ad.copy.kop ? '<div class="cr-kop">' + crEsc(ad.copy.kop) + '</div>' : '') +
      '<div class="cr-cijfers">' + (regels.join(' <span class="cr-punt">·</span> ') || '—') + '</div>' +
    '</div></button>';
}

var CR_BEREIKEN = [
  { id: 'brandtracker', label: 'Onze Brand Tracker',
    zegt: 'Alleen de merken die we volgen. Dit is de vraag die je meestal stelt: wat draait er bij de concurrenten waar we tegen vechten.' },
  { id: 'markt', label: 'De hele markt',
    zegt: 'Alles wat TrendTrack heeft. Bruikbaar om een hoek te vinden buiten de categorie, maar de meeste treffers gaan niet over ons.' }
];

function crFilterHtml() {
  var h = '<div class="cr-filters">';
  /* Het bereik eerst: dat bepaalt waar de rest van de filters over gaat, en
     het is de keuze die het vaakst verkeerd stond. */
  h += '<div class="cr-filterrij">';
  CR_BEREIKEN.forEach(function (b) {
    h += '<button type="button" class="cr-keuze' + (_cr.bereik === b.id ? ' aan' : '') + '" ' +
      'data-action="cr-bereik" data-id="' + b.id + '">' + crEsc(b.label) + '</button>';
  });
  h += '</div>';
  var bActief = CR_BEREIKEN.filter(function (b) { return b.id === _cr.bereik; })[0];
  if (bActief) h += '<p class="cr-uitleg">' + crEsc(bActief.zegt) + '</p>';
  /* Bij de Brand Tracker: alle merken, of inzoomen op er een. */
  if (_cr.bereik === 'brandtracker' && _cr.merken && _cr.merken.length) {
    h += '<div class="cr-filterrij">';
    h += '<button type="button" class="cr-keuze klein' + (!_cr.merk ? ' aan' : '') +
      '" data-action="cr-merk" data-id="">Alle ' + _cr.merken.length + ' merken</button>';
    _cr.merken.forEach(function (m) {
      h += '<button type="button" class="cr-keuze klein' + (_cr.merk === m.id ? ' aan' : '') +
        '" data-action="cr-merk" data-id="' + crEsc(m.id) + '">' + crEsc(m.naam) +
        (m.actieve_ads != null ? ' <span class="cr-letop">' + crGetal(m.actieve_ads) + '</span>' : '') +
        '</button>';
    });
    h += '</div>';
  }
  h += '<div class="cr-filterrij">';
  CR_SORTERINGEN.forEach(function (s) {
    h += '<button type="button" class="cr-keuze' + (_cr.sorteer === s.id ? ' aan' : '') + '" ' +
      'data-action="cr-sorteer" data-id="' + s.id + '">' + crEsc(s.label) + '</button>';
  });
  h += '</div>';
  /* Onder de knoppen staat wat de gekozen sortering meet, en waar hij tekort
     schiet. Allebei -- een optie die alleen zijn sterke kant noemt is reclame,
     geen uitleg. */
  var actief = CR_SORTERINGEN.filter(function (s) { return s.id === _cr.sorteer; })[0];
  if (actief) {
    h += '<p class="cr-uitleg">' + crEsc(actief.zegt) +
      ' <span class="cr-letop">' + crEsc(actief.let_op) + '</span></p>';
  }
  h += '<div class="cr-filterrij">';
  CR_VENSTERS.forEach(function (v) {
    h += '<button type="button" class="cr-keuze klein' + (_cr.dagen === v.id ? ' aan' : '') + '" ' +
      'data-action="cr-dagen" data-id="' + v.id + '">' + crEsc(v.label) + '</button>';
  });
  if (_cr.bereik === 'markt') {
    ['', 'image', 'video'].forEach(function (s) {
      var label = s === '' ? 'Alles' : (s === 'image' ? 'Beeld' : 'Video');
      h += '<button type="button" class="cr-keuze klein' + (_cr.soort === s ? ' aan' : '') + '" ' +
        'data-action="cr-soort" data-id="' + s + '">' + label + '</button>';
    });
  }
  h += '</div>';
  h += '<div class="cr-filterrij">';
  /* Zoeken op een woord en filteren op land horen bij de hele markt. Bij de
     Brand Tracker zijn ze zinloos -- die merken heb je zelf uitgekozen -- en een
     filter dat niets doet is erger dan een filter dat er niet is. */
  if (_cr.bereik === 'markt') {
    h += '<input type="text" id="cr-zoek" class="cr-invoer" placeholder="Zoekwoord in de advertentietekst (leeg = alles)" value="' + crEsc(_cr.zoek) + '">' +
      '<input type="text" id="cr-land" class="cr-invoer kort" placeholder="Land" value="' + crEsc(_cr.land) + '">';
  }
  h += '<button type="button" class="cr-knop" data-action="cr-haal"' + (_cr.bezig ? ' disabled' : '') + '>' +
      (_cr.bezig ? 'Bezig…' : (_cr.bereik === 'brandtracker' ? 'Analyseer onze Brand Tracker' : 'Analyseer de hele markt')) + '</button>' +
    '</div>';
  h += '</div>';
  return h;
}

function crLijstHtml() {
  if (_cr.bezig) return '<div class="cr-melding">Bezig met ophalen bij TrendTrack…</div>';
  if (_cr.fout) {
    return '<div class="cr-melding fout"><b>Dat lukte niet.</b><br>' + crEsc(_cr.fout) + '</div>';
  }
  if (!_cr.lijst) {
    return '<div class="cr-melding">Kies waarop je wilt sorteren en druk op <b>Analyseer TrendTrack</b>. ' +
      'Je krijgt de advertenties die op dit moment draaien, met hoe lang ze al lopen en hoe groot hun bereik is.</div>';
  }
  if (!_cr.lijst.length) {
    return '<div class="cr-melding">Niets gevonden met deze filters. Een zoekwoord weglaten of een ander land ' +
      'proberen levert meestal meer op dan een breder venster.</div>';
  }
  var h = '';
  /* Bovenaan en opvallend: een lijst die iets anders is dan de knop belooft
     wordt anders gewoon gelezen als de lijst die je vroeg. */
  if (_cr.bereikMismatch) {
    h += '<div class="cr-melding fout"><b>Dit is niet wat je vroeg.</b><br>' +
      crEsc(_cr.bereikMismatch) + '</div>';
  }
  if (_cr.voorbehoud) {
    h += '<p class="cr-voorbehoud">' + crEsc(_cr.voorbehoud) + '</p>';
  }
  /* Gevraagd en gemeten allebei, als ze verschillen. Veertien dagen bestaat
     niet bij deze bron; dertig meten en veertien opschrijven is de fout
     waarbij je een maand afleest als twee weken. */
  if (_cr.venster && _cr.dagenGevraagd && _cr.venster !== ('last' + _cr.dagenGevraagd + 'd')) {
    h += '<p class="cr-venstermelding">Je vroeg om ' + crEsc(_cr.dagenGevraagd) +
      ' dagen. TrendTrack kent dat venster niet en heeft <b>' + crEsc(_cr.venster) +
      '</b> gemeten.</p>';
  }
  /* Hoe deze rangschikking tot stand kwam. Bij de Brand Tracker halen we per
     merk de topadvertenties op en rangschikken we die aan onze kant -- dat is
     iets anders dan "de langst draaiende die zij ooit hadden", en dat verschil
     hoort te lezen te zijn. */
  if (_cr.hoeGerangschikt) {
    h += '<p class="cr-venstermelding">' + crEsc(_cr.hoeGerangschikt) + '</p>';
  }
  /* Een merk dat niet opgehaald kon worden. Een lijst die stil korter is dan
     hij hoort te zijn leest als "die concurrent doet even niets". */
  if (_cr.merkenMislukt && _cr.merkenMislukt.length) {
    h += '<p class="cr-venstermelding">Niet opgehaald: ' +
      crEsc(_cr.merkenMislukt.join(' · ')) + '</p>';
  }
  /* Als er geen beelden uitkwamen: welke velden er dan wel stonden. Dat is
     geen boodschap voor dagelijks gebruik maar wel precies wat er nodig is om
     het te repareren, en het staat er alleen als het misgaat. */
  if (_cr.veldenZonderBeeld && _cr.veldenZonderBeeld.length) {
    h += '<p class="cr-venstermelding">Geen beeld te vinden in het antwoord. ' +
      'De bron gebruikte deze velden: <b>' + crEsc(_cr.veldenZonderBeeld.join(', ')) + '</b>. ' +
      'Stuur die regel door, dan weet ik waar het beeld zit.</p>';
  }
  h += '<div class="cr-raster">' + _cr.lijst.map(crKaartHtml).join('') + '</div>';
  return h;
}

/* ── Eén advertentie, en het patroon eronder ───────────────────────────── */

function crDetailHtml() {
  var ad = _cr.open;
  if (!ad) return '';
  var b = ad.beeld ? _cr.beelden[ad.beeld] : null;
  var h = '<div class="cr-detail">';
  h += '<button type="button" class="cr-terug" data-action="cr-sluit">' +
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
    'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Terug naar de lijst</button>';
  h += '<div class="cr-detail-boven">';
  h += '<div class="cr-detail-beeld">' + (b ? '<img src="' + crEsc(b.url) + '" alt="">' : '<span class="cr-beeld-leeg">geen beeld</span>') + '</div>';
  h += '<div class="cr-detail-naast">';
  h += '<h3>' + crEsc(ad.merk || 'onbekend merk') + '</h3>';
  if (ad.domein) h += '<div class="cr-domein">' + crEsc(ad.domein) + '</div>';
  h += '<dl class="cr-feiten">';
  [['Draait al', ad.dagen_actief != null ? crGetal(ad.dagen_actief) + ' dagen' : null],
   ['Bereik', ad.bereik != null ? crGetal(ad.bereik) : null],
   ['Varianten', ad.varianten != null ? crGetal(ad.varianten) : null],
   ['Eerst gezien', ad.eerst_gezien], ['Land', ad.land], ['Taal', ad.taal]
  ].forEach(function (r) {
    /* Alleen wat we weten. Een rij met een streepje erachter vult de lijst en
       zegt niets; een rij die er niet staat zegt hetzelfde en leest beter. */
    if (r[1]) h += '<dt>' + crEsc(r[0]) + '</dt><dd>' + crEsc(r[1]) + '</dd>';
  });
  h += '</dl>';
  if (ad.copy && (ad.copy.kop || ad.copy.tekst)) {
    h += '<div class="cr-copy">';
    if (ad.copy.kop) h += '<div class="cr-copy-kop">' + crEsc(ad.copy.kop) + '</div>';
    if (ad.copy.tekst) h += '<div class="cr-copy-tekst">' + crEsc(ad.copy.tekst) + '</div>';
    if (ad.copy.cta) h += '<div class="cr-copy-cta">' + crEsc(ad.copy.cta) + '</div>';
    h += '</div>';
  }
  h += '</div></div>';

  h += '<div class="cr-patroon">';
  if (_cr.patroonBezig) {
    h += '<div class="cr-melding">Nick leest de advertentie…</div>';
  } else if (_cr.patroon && _cr.patroon.fout) {
    h += '<div class="cr-melding fout">' + crEsc(_cr.patroon.fout) + '</div>' + crLeesKnop();
  } else if (_cr.patroon) {
    h += crPatroonHtml(_cr.patroon);
  } else {
    h += '<p class="cr-uitleg">Lees het patroon eronder: welke hoek, welk mechanisme, ' +
      'voor wie, en welk soort bewijs. Dat is wat je kunt overnemen — het beeld en de ' +
      'copy van dit merk niet.</p>' + crLeesKnop();
  }
  h += '</div></div>';
  return h;
}

function crLeesKnop() {
  return '<button type="button" class="cr-knop" data-action="cr-lees">Lees het patroon</button>';
}

var CR_PATROONVELDEN = [
  { sleutel: 'hoek', label: 'De hoek' },
  { sleutel: 'mechanisme', label: 'Het mechanisme' },
  { sleutel: 'awareness', label: 'Awareness' },
  { sleutel: 'sophistication', label: 'Sophistication' },
  { sleutel: 'publiek', label: 'Voor wie' },
  { sleutel: 'bewijs', label: 'Bewijsvorm' },
  { sleutel: 'formaat', label: 'Formaat' },
  { sleutel: 'waarom', label: 'Waarom dit werkt' }
];

function crPatroonHtml(p) {
  var h = '<h4>Het patroon eronder</h4><dl class="cr-feiten breed">';
  CR_PATROONVELDEN.forEach(function (v) {
    var w = p[v.sleutel];
    /* Een leeg veld overslaan in plaats van vullen. Een verzonnen mechanisme
       ziet er precies zo uit als een gelezen mechanisme, en daar bouw je dan
       een advertentie op. */
    if (w) h += '<dt>' + crEsc(v.label) + '</dt><dd>' + crEsc(w) + '</dd>';
  });
  h += '</dl>';
  h += '<button type="button" class="cr-knop groot" data-action="cr-wizard">Maak hier onze versie van</button>';
  h += '<p class="cr-uitleg">Dit vult de statics-wizard met de hoek, het mechanisme en het publiek. ' +
    'Het beeld, de copy en de claim van dit merk gaan niet mee — die zijn van hen.</p>';
  return h;
}

function crPatroonPrompt(ad) {
  var d = [];
  d.push('Je kijkt naar een advertentie die op dit moment draait bij een ander merk.');
  if (ad.dagen_actief) d.push('Hij loopt al ' + ad.dagen_actief + ' dagen.');
  if (ad.merk) d.push('Merk: ' + ad.merk + '.');
  if (ad.copy && ad.copy.kop) d.push('Kop: ' + ad.copy.kop);
  if (ad.copy && ad.copy.tekst) d.push('Tekst: ' + ad.copy.tekst);
  return d.join('\n') + '\n\n' +
    'Benoem het PATROON eronder, niet de uitvoering. Wij gaan hier onze eigen versie van maken ' +
    'voor een ander merk in een andere categorie, dus alles wat merkgebonden is, is onbruikbaar.\n\n' +
    'Geef STRICT JSON, geen markdown, met deze sleutels:\n' +
    '  hoek            - de invalshoek in een zin (niet de kop overschrijven, de hoek erachter)\n' +
    '  mechanisme      - het "hoe werkt het" dat de advertentie belooft, of leeg als er geen is\n' +
    '  awareness       - een van: unaware, problem, solution, product, most\n' +
    '  sophistication  - een van: s1, s2, s3, s4, s5\n' +
    '  publiek         - wie hier wordt aangesproken, in een zin\n' +
    '  bewijs          - welk soort bewijs gebruikt wordt (demonstratie, cijfer, getuige, autoriteit, voor-na, geen)\n' +
    '  formaat         - de vorm (nieuwsartikel, advertorial, productfoto, vergelijking, meme, screenshot, anders)\n' +
    '  waarom          - waarom dit werkt bij dit publiek, in twee zinnen\n\n' +
    'Weet je iets niet, laat het veld dan LEEG. Een verzonnen mechanisme ziet er precies zo uit ' +
    'als een gelezen mechanisme, en daar wordt een advertentie op gebouwd.\n' +
    'Neem geen enkele claim van dit merk over als feit: schrijf wat de advertentie BEWEERT, ' +
    'niet wat waar is.';
}

async function crLeesPatroon() {
  var ad = _cr.open;
  if (!ad) return;
  _cr.patroonBezig = true; _cr.patroon = null; crRender();
  try {
    var inhoud = [];
    if (ad.beeld) {
      var b = await crBeeld(ad.beeld);
      if (b) {
        var beeld = await crBlobNaarBase64(b.blob);
        inhoud.push({ type: 'image', source: { type: 'base64', media_type: beeld.mime, data: beeld.b64 } });
      }
    }
    inhoud.push({ type: 'text', text: crPatroonPrompt(ad) });
    var model = (document.getElementById('anthropic-model') || {}).value || 'claude-opus-5';
    var data = await fetchJsonWithRetry(crBasis() + '/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 1200, messages: [{ role: 'user', content: inhoud }] })
    });
    var tekst = wgClaudeText(data);
    var s = tekst.indexOf('{'), e = tekst.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('geen JSON in het antwoord');
    _cr.patroon = JSON.parse(tekst.substring(s, e + 1));
  } catch (err) {
    _cr.patroon = { fout: 'Het lezen liep vast: ' + String((err && err.message) || err) };
  }
  _cr.patroonBezig = false;
  crRender();
}

/* ── Naar de wizard ────────────────────────────────────────────────────── */

/* Wat er meegaat is het patroon. Wat er niet meegaat is het werk van de ander:
   geen beeld, geen copy, geen claim. Dat is geen voorzichtigheid maar de enige
   bruikbare lezing -- hun foto werkt niet in onze advertentie en hun belofte is
   de hunne om waar te maken. */
function crNaarWizard() {
  var ad = _cr.open, p = _cr.patroon;
  if (!ad || !p || p.fout) return;
  if (typeof wizState === 'undefined' || typeof wizOpen !== 'function') {
    if (typeof toast === 'function') toast('De wizard is hier niet beschikbaar', true);
    return;
  }
  var d = wizState.data;
  if (p.hoek) d.strategy.marketingAngle = p.hoek;
  if (p.mechanisme) d.strategy.mechanism = p.mechanisme;
  if (p.awareness) d.audience.awareness = p.awareness;
  if (p.sophistication) d.audience.sophistication = p.sophistication;
  if (p.bewijs && p.bewijs !== 'geen') d.strategy.proof = p.bewijs;
  /* Waar dit vandaan komt hoort zichtbaar te zijn. 'onderzoek' is geen keuze
     van de gebruiker en geen advies van Rory: het is afgekeken, en dat is een
     derde soort herkomst die je moet kunnen zien staan. */
  ['marketingAngle', 'mechanism', 'proof'].forEach(function (v) {
    if (d.strategy[v]) wizState.source['strategy.' + v] = 'onderzoek';
  });
  ['awareness', 'sophistication'].forEach(function (v) {
    if (d.audience[v]) wizState.source['audience.' + v] = 'onderzoek';
  });
  wizState.onderzoekBron = {
    merk: ad.merk || null, dagen_actief: ad.dagen_actief || null,
    formaat: p.formaat || null, waarom: p.waarom || null
  };
  if (typeof wizSave === 'function') wizSave();
  if (typeof switchMainTab === 'function') switchMainTab('generator');
  if (typeof wizOpen === 'function') wizOpen();
  if (typeof toast === 'function') {
    toast('Patroon overgenomen. Het beeld en de copy van ' + (ad.merk || 'dat merk') + ' zijn niet meegekomen.');
  }
}

/* ── Tekenen en klikken ────────────────────────────────────────────────── */

function crRender() {
  var el = document.getElementById('cr-inhoud');
  if (!el) return;
  el.innerHTML = _cr.open ? crDetailHtml() : (crFilterHtml() + crLijstHtml());
}

function crKlik(e) {
  var knop = e.target.closest ? e.target.closest('[data-action]') : null;
  if (!knop) return;
  var act = knop.getAttribute('data-action');
  if (act === 'cr-bereik') {
    _cr.bereik = knop.getAttribute('data-id');
    /* De lijst hoort bij het vorige bereik. Hem laten staan terwijl de knop
       iets anders zegt is precies hoe je naar de markt kijkt in de
       veronderstelling dat het je concurrenten zijn. */
    _cr.lijst = null; _cr.open = null; _cr.hoeGerangschikt = null;
    crRender();
    if (_cr.bereik === 'brandtracker' && !_cr.merken) crHaalMerken();
  } else if (act === 'cr-merk') { _cr.merk = knop.getAttribute('data-id'); _cr.lijst = null; crRender(); }
  else if (act === 'cr-sorteer') { _cr.sorteer = knop.getAttribute('data-id'); crRender(); }
  else if (act === 'cr-dagen') { _cr.dagen = Number(knop.getAttribute('data-id')); crRender(); }
  else if (act === 'cr-soort') { _cr.soort = knop.getAttribute('data-id'); crRender(); }
  else if (act === 'cr-haal') {
    var z = document.getElementById('cr-zoek'), l = document.getElementById('cr-land');
    if (z) _cr.zoek = z.value.trim();
    if (l) _cr.land = l.value.trim().toUpperCase();
    crHaalLijst();
  } else if (act === 'cr-open') {
    crOpenAd(_cr.lijst[Number(knop.getAttribute('data-i'))]);
  } else if (act === 'cr-sluit') { crSluitAd(false); }
  else if (act === 'cr-lees') { crLeesPatroon(); }
  else if (act === 'cr-wizard') { crNaarWizard(); }
}

function renderCreativeResearch() {
  var el = document.getElementById('cr-inhoud');
  if (el && !el._crGebonden) { el.addEventListener('click', crKlik); el._crGebonden = true; }
  crRender();
  /* De gevolgde merken staan er meteen, zonder dat je eerst een analyse hoeft
     te draaien: dan weet je wat je gaat bevragen voordat je credits uitgeeft. */
  if (_cr.bereik === 'brandtracker' && !_cr.merken) crHaalMerken();
}

window.renderCreativeResearch = renderCreativeResearch;
window.crRender = crRender; window.crHaalLijst = crHaalLijst;
window.crHaalMerken = crHaalMerken; window.crOpenAd = crOpenAd; window.crSluitAd = crSluitAd;
window.CR_BEREIKEN = CR_BEREIKEN;
window.crNaarWizard = crNaarWizard; window.crLeesPatroon = crLeesPatroon;
window.crPatroonPrompt = crPatroonPrompt; window.crPatroonHtml = crPatroonHtml;
window.crKaartHtml = crKaartHtml; window.crLijstHtml = crLijstHtml;
window.crFilterHtml = crFilterHtml; window.crDetailHtml = crDetailHtml;
window.crGetal = crGetal; window._cr = _cr;
window.CR_SORTERINGEN = CR_SORTERINGEN; window.CR_PATROONVELDEN = CR_PATROONVELDEN;
