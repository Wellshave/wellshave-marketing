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

/* De sorteringen staan niet meer los: ze zijn onderdeel van de
   onderzoeksdoelen (CR_DOELEN, verderop). Een doel ZET de sortering, zodat er
   geen tweede lijst is die uit de pas kan lopen met wat het scherm belooft. */

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
  bereik: 'brandtracker',
  /* Welke merken je analyseert. Leeg betekent: alle gevolgde merken. Dit was
     een enkele keuze -- een merk of alles -- en daartussen zit precies wat je
     wilt: de vier concurrenten van Wellshine zonder die van Wellshave erbij. */
  merkSel: [], merken: null, mappen: null,
  /* Filters over de opgehaalde lijst. Ze vragen niets nieuws op: ze verbergen
     wat je nu niet wilt zien, en zeggen dat ook. */
  toonSoort: '', minDagen: 0,
  /* De bouwtoestand: welk merk je onderzoekt, wat je wilt ontdekken, en of de
     geavanceerde filters open staan. Het onderzoeksdoel is een voorkeuze over
     de bestaande knoppen (sortering, minimale looptijd, soort) en geen tweede
     mechaniek ernaast -- anders lopen de twee uit elkaar zodra er een filter
     bij komt. */
  context: '', doel: 'looptijd', merkZoek: '', meerFilters: false,
  sorteer: 'looptijd', dagen: 14, land: 'NL', taal: '', soort: '', zoek: '', limiet: 10,
  lijst: null, voorbehoud: null, venster: null, dagenGevraagd: null,
  hoeGerangschikt: null, merkenGebruikt: null, merkenMislukt: null, bereikMismatch: null,
  veldenZonderBeeld: null,
  bezig: false, fout: null, open: null, patroon: null, patroonBezig: false,
  /* De beelden die we al opgehaald hebben, per adres. Zonder dit haalt elke
     hertekening ze opnieuw op, en dat is bij tien kaarten tien verzoeken per
     klik op een filterknop. */
  beelden: {},
  /* En hetzelfde voor bewegend beeld, apart. Een video is groot genoeg om hem
     niet twee keer te willen halen, en hij komt pas als je hem opent -- tien
     kaarten die alvast tien films binnenhalen is een lijst die minutenlang
     laadt voordat je iets ziet. */
  videos: {}, videoBezig: false, videoFout: null
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

/* Dezelfde route als het beeld, en om dezelfde reden: de proxy zit achter de
   login, dus een <video src> werkt niet. Het verschil is dat dit pas gebeurt
   als je een advertentie opent. Doorspoelen werkt daarna gewoon: de browser
   heeft het hele bestand lokaal staan. */
async function crVideoHaal(adres) {
  if (!adres) return null;
  if (_cr.videos[adres]) return _cr.videos[adres];
  var o = { headers: {} };
  if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
  var r = await fetch(crBasis() + '/onderzoek/video?u=' + encodeURIComponent(adres), o);
  if (!r.ok) {
    var d = null;
    try { d = await r.json(); } catch (e) { d = null; }
    throw new Error((typeof wgFoutTekst === 'function') ? wgFoutTekst(d, r.status)
      : ('de video was niet op te halen (' + r.status + ')'));
  }
  var blob = await r.blob();
  _cr.videos[adres] = { url: URL.createObjectURL(blob), blob: blob };
  return _cr.videos[adres];
}

/* De video wordt opgehaald zodra je een advertentie met bewegend beeld opent.
   Niet bij het tekenen van de lijst: dan haal je tien films binnen voor de ene
   die je wilt zien. */
async function crOpenVideo() {
  var ad = _cr.open;
  if (!ad || !ad.video || _cr.videos[ad.video] || _cr.videoBezig) return;
  _cr.videoBezig = true; _cr.videoFout = null; crRender();
  try {
    await crVideoHaal(ad.video);
  } catch (e) {
    _cr.videoFout = 'De video kwam niet binnen: ' + String((e && e.message) || e);
  }
  _cr.videoBezig = false;
  crRender();
}

/* ── Wat Nick van een video te zien krijgt ─────────────────────────────── */

/* Claude kijkt geen video. Wat we hem wél kunnen geven zijn stilstaande
   beelden uit het bestand, in volgorde, met de seconde erbij. Dat is genoeg
   voor het patroon: de hook staat in het eerste beeld, de bewijsvorm in het
   midden, de CTA op het eind.

   Wat er NIET bij zit is het geluid en de beweging. Bij een videoadvertentie
   zit het mechanisme vaak precies daar -- in de voice-over die uitlegt hoe het
   werkt. Dat staat in de prompt, zodat het veld leeg blijft in plaats van
   ingevuld met een gok. */
var CR_FRAMES = 6;

function crFrameTijden(duur, aantal) {
  var n = Math.max(1, aantal || CR_FRAMES);
  /* Een video zonder bekende duur levert één beeld op: het eerste. Dat is
     mager, maar het is waar -- verzonnen tijdstippen leveren zwarte beelden. */
  if (!isFinite(duur) || !(duur > 0)) return [0];
  if (n === 1) return [0];
  var uit = [];
  for (var i = 0; i < n; i++) {
    /* Precies op het einde staan levert vaak een zwart beeld op, en juist daar
       staat de CTA. Vandaar een tikje ervoor. */
    uit.push(Math.min(i * (duur / (n - 1)), Math.max(0, duur - 0.15)));
  }
  return uit;
}

/* Naar één tijdstip springen en wachten tot het beeld er werkelijk staat.
   Zonder het wachten teken je het vorige frame nog een keer: de canvas heeft
   geen idee dat de speler nog aan het zoeken is. */
function crSpringNaar(vid, t) {
  return new Promise(function (klaar, mislukt) {
    var op = setTimeout(function () { mislukt(new Error('het beeld op ' + t + 's kwam niet')); }, 5000);
    var klaarmaken = function () {
      clearTimeout(op); vid.removeEventListener('seeked', klaarmaken); klaar();
    };
    vid.addEventListener('seeked', klaarmaken);
    vid.currentTime = t;
  });
}

/* Een eigen speler, los van die op het scherm. De speler in de pagina wordt
   opnieuw getekend zodra "Nick leest mee" verschijnt, en dan sta je frames te
   trekken uit een element dat net vervangen is -- dat levert niets op, en het
   levert het STIL niets op. Dit element hangt nergens aan en gaat nergens heen.
   Het bestand staat al lokaal, dus dit kost geen tweede verzoek. */
function crEigenSpeler(url) {
  return new Promise(function (klaar, mislukt) {
    var vid = document.createElement('video');
    vid.preload = 'auto';
    vid.muted = true;
    vid.playsInline = true;
    var op = setTimeout(function () { mislukt(new Error('de video liet zich niet openen')); }, 15000);
    vid.addEventListener('loadeddata', function () { clearTimeout(op); klaar(vid); });
    vid.addEventListener('error', function () { clearTimeout(op); mislukt(new Error('de video liet zich niet openen')); });
    vid.src = url;
  });
}

async function crVideoFrames(vid, aantal) {
  var tijden = crFrameTijden(vid.duration, aantal);
  var doek = document.createElement('canvas');
  doek.width = vid.videoWidth || 640;
  doek.height = vid.videoHeight || 640;
  var ctx = doek.getContext('2d');
  var uit = [];
  for (var i = 0; i < tijden.length; i++) {
    try {
      await crSpringNaar(vid, tijden[i]);
      ctx.drawImage(vid, 0, 0, doek.width, doek.height);
      var data = doek.toDataURL('image/jpeg', 0.7);
      var m = String(data).match(/^data:([^;]+);base64,(.+)$/);
      if (m) uit.push({ t: tijden[i], mime: m[1], b64: m[2] });
    } catch (e) {
      /* Eén beeld dat niet komt is geen reden om de rest te laten vallen. Vijf
         beelden zijn nog steeds vijf beelden meer dan geen. */
    }
  }
  return uit;
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
    /* Mappen komen alleen als de bron ze geeft. Geen mappen is geen fout: dan
       staan de merken er zonder groepen. */
    _cr.mappen = uit.mappen || [];
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
  _cr.videoFout = null;
  try {
    history.pushState({ crOpen: true }, '', location.href);
  } catch (e) { /* geen geschiedenis is geen reden om niets te tonen */ }
  crRender();
  /* Nu pas de video, en alleen deze ene. */
  if (ad && ad.video) crOpenVideo();
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
      if ((_cr.merkSel || []).length) p.set('merken', _cr.merkSel.join(','));
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
      if (!vak) continue;
      /* Alleen het lege vakje vervangen, nooit het hele blok: het speelmerk
         staat ernaast en hoort te blijven staan. Met innerHTML verdween het,
         en dan ziet een videoadvertentie er weer uit als een still. */
      var oud = vak.querySelector('img');
      var leegvak = vak.querySelector('.cr-beeld-leeg');
      if (oud) oud.src = b.url;
      else if (leegvak) leegvak.outerHTML = '<img src="' + crEsc(b.url) + '" alt="">';
      else vak.insertAdjacentHTML('afterbegin', '<img src="' + crEsc(b.url) + '" alt="">');
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
  /* Een videoadvertentie zegt dat hij er een is. Zonder dit ziet hij eruit als
     een still die toevallig niet laadt -- en dat was precies wat er gebeurde. */
  var speel = ad.video ? '<span class="cr-speel" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
    '<path d="M8 5v14l11-7z"/></svg></span>' : '';
  var leeg = ad.beeld ? 'beeld laden…' : (ad.video ? 'video' : 'geen beeld');
  return '<button type="button" class="cr-kaart" data-i="' + i + '" data-action="cr-open">' +
    '<div class="cr-beeld"><span class="cr-beeld-leeg">' + leeg + '</span>' + speel + '</div>' +
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

/* ── Het logo van een merk ──────────────────────────────────────────────────
 *
 * TrendTrack levert geen logo. Wat het wel levert is een lijst domeinen, en
 * daar zit het logo achter -- maar niet in het eerste domein: bij manscaped.com
 * staat amazon.co.uk vooraan, want dat is waar hun advertenties heen linken.
 * Het logo van Amazon boven Manscaped is erger dan geen logo, dus:
 *
 *   1. de naam zelf als hij een domein IS (manscaped.com);
 *   2. anders het domein dat bij de naam hoort (BALZY -> balzy.nl,
 *      Freebird -> myfreebird.com);
 *   3. anders geen logo, alleen de beginletter.
 *
 * Nooit "dan maar het eerste domein". Dat is precies hoe je Mercado Libre als
 * logo van Skull Shaver in beeld krijgt. */
function crSlug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function crMerkDomein(m) {
  if (!m) return '';
  var naam = String(m.naam || '');
  if (/^[a-z0-9-]+(\.[a-z]{2,}){1,2}$/i.test(naam.trim())) return naam.trim().toLowerCase();
  var slug = crSlug(naam);
  if (!slug) return '';
  var kandidaten = (m.domeinen && m.domeinen.length ? m.domeinen : [m.domein]).filter(Boolean);
  for (var i = 0; i < kandidaten.length; i++) {
    var host = String(kandidaten[i]).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    var kern = crSlug(host.split('/')[0].split('.')[0]);
    if (!kern) continue;
    if (kern === slug || kern.indexOf(slug) === 0 || slug.indexOf(kern) === 0 ||
        kern.indexOf(slug) > -1) {
      return host.split('/')[0];
    }
  }
  return '';
}

function crLogoHtml(m) {
  var domein = crMerkDomein(m);
  var letter = crEsc(String(m && m.naam || '?').replace(/^[^a-z0-9]*/i, '').charAt(0).toUpperCase() || '?');
  return '<span class="cr-logo" aria-hidden="true">' +
    (domein ? '<img src="https://www.google.com/s2/favicons?sz=64&domain=' + crEsc(domein) +
      '" alt="" loading="lazy" onerror="this.remove()">' : '') +
    '<i>' + letter + '</i></span>';
}

/* Welke merken er nu gekozen zijn. Leeg is alles -- en dat staat er dan ook,
   zodat "geen selectie" niet leest als "geen merken". */
function crGekozenMerken() {
  var alle = _cr.merken || [];
  var sel = _cr.merkSel || [];
  if (!sel.length) return alle;
  return alle.filter(function (m) { return sel.indexOf(m.id) !== -1; });
}

function crMerkKnopHtml(m) {
  var aan = (_cr.merkSel || []).indexOf(m.id) !== -1;
  var alles = !(_cr.merkSel || []).length;
  return '<button type="button" class="cr-merkknop' + (aan ? ' aan' : (alles ? ' mee' : '')) + '" ' +
    'data-action="cr-merk" data-id="' + crEsc(m.id) + '" ' +
    'title="' + crEsc(m.naam || '') + (m.domein ? ' · ' + crEsc(m.domein) : '') + '">' +
    crLogoHtml(m) +
    '<span class="cr-merknaam">' + crEsc(m.naam || m.id) + '</span>' +
    (m.actieve_ads != null ? '<span class="cr-merkgetal">' + crGetal(m.actieve_ads) + '</span>' : '') +
    '</button>';
}

/* De merken van één map, als die map er is. De mappen komen uit de Brand
   Tracker zelf: in dit account Wellshave en Wellshine, elk met hun eigen
   concurrenten. Zonder mappen staat deze rij er niet -- er valt dan niets te
   groeperen dat wij niet zouden verzinnen. */
function crMapMerken(mapId) {
  return (_cr.merken || []).filter(function (m) {
    return String(m.map_id) === String(mapId);
  });
}

function crMappenRij() {
  var mappen = (_cr.mappen || []).filter(function (f) { return crMapMerken(f.id).length; });
  if (!mappen.length) return '';
  var h = '<div class="cr-filterrij klein">';
  mappen.forEach(function (f) {
    var leden = crMapMerken(f.id).map(function (m) { return m.id; });
    var aan = leden.length && leden.every(function (id) { return (_cr.merkSel || []).indexOf(id) !== -1; }) &&
      (_cr.merkSel || []).length === leden.length;
    h += '<button type="button" class="cr-keuze klein' + (aan ? ' aan' : '') + '" ' +
      'data-action="cr-map" data-id="' + crEsc(f.id) + '">' + crEsc(f.naam) +
      ' <span class="cr-letop">' + leden.length + '</span></button>';
  });
  h += '</div>';
  return h;
}

/* ── Wat wil je ontdekken ───────────────────────────────────────────────────
 *
 * Een onderzoeksdoel is een VOORKEUZE over de knoppen die er al zijn: welke
 * sortering, welke minimale looptijd, welk soort beeld. Geen tweede mechaniek
 * ernaast, want dan lopen die twee uit elkaar zodra er een filter bij komt --
 * en dan zegt de kaart iets anders dan de vraag die weggaat.
 *
 * En het belangrijkste: een doel dat wij niet kunnen uitvoeren staat er als
 * NIET beschikbaar, met de reden erbij. Een kaart die je kunt aanklikken en
 * die vervolgens gewoon de standaardlijst oplevert is erger dan een kaart die
 * er niet is: dan denk je dat je iets gemeten hebt. */
var CR_DOELEN = [
  { id: 'looptijd', label: 'Draait het langst', kort: 'Ads die al maanden lopen',
    zet: { sorteer: 'looptijd', minDagen: 0, toonSoort: '' },
    zegt: 'Al maanden in de lucht. Er zit een budget achter dat elke dag opnieuw verlengd wordt -- het betrouwbaarste openbare signaal dat er is.',
    let_op: 'Ook het traagste: wat hier bovenaan staat heeft de rest van de markt inmiddels ook gezien.' },
  { id: 'evergreen', label: 'Evergreen winners', kort: 'Al langer dan drie maanden actief',
    zet: { sorteer: 'looptijd', minDagen: 90, toonSoort: '' },
    zegt: 'Hetzelfde signaal, maar alleen wat de drie maanden gehaald heeft. Dit is de bodem van hun account: wat hier staat is uitgetest.',
    let_op: 'De strengste snede, dus vaak een korte lijst. Is hij leeg, dan is dat ook een uitslag.' },
  { id: 'bereik', label: 'Grootste bereik', kort: 'Ads met het grootste publiek',
    zet: { sorteer: 'bereik', minDagen: 0, toonSoort: '' },
    zegt: 'Het grootste publiek in dit venster.',
    let_op: 'Zegt hoe groot hij is, niet hoe lang hij al werkt. Een dure lancering staat hier ook bovenaan. Bij gevolgde merken geeft TrendTrack geen bereik; dan wordt er op positie gerangschikt.' },
  { id: 'groei', label: 'Schaalt nu op', kort: 'Ads die nu duidelijk opschalen',
    zet: { sorteer: 'groei', minDagen: 0, toonSoort: '' },
    zegt: 'Hier wordt op dit moment geld op bijgezet.',
    let_op: 'Het vroegste signaal en het onbetrouwbaarste: dit kan over drie dagen stilstaan.' },
  { id: 'statisch', label: 'Alleen statics', kort: 'Stilstaand beeld',
    zet: { sorteer: 'looptijd', minDagen: 0, toonSoort: 'image' },
    zegt: 'Alleen stilstaand beeld, gerangschikt op looptijd. Dit is de lijst waar je een static uit bouwt.',
    let_op: 'Bij gevolgde merken filtert dit de opgehaalde lijst, niet de bron: je ziet dus de statics uit hun topadvertenties.' },
  { id: 'videos', label: 'Alleen video', kort: 'Bewegend beeld',
    zet: { sorteer: 'looptijd', minDagen: 0, toonSoort: 'video' },
    zegt: 'Alleen bewegend beeld, gerangschikt op looptijd. Dit is de lijst waar je een script uit bouwt.',
    let_op: 'Bij gevolgde merken filtert dit de opgehaalde lijst, niet de bron.' },
  /* Hieronder: doelen die pas kunnen als er over de opgehaalde set geanalyseerd
     wordt. Ze staan er wel, want ze horen bij dit menu -- maar uitgegrijsd en
     met de reden erbij. */
  { id: 'concepten', label: 'Meest herhaalde concepten', kort: 'Welke uitvoering telkens terugkomt',
    nog_niet: 'Dit is geen filter bij de bron maar een analyse over de opgehaalde advertenties. Komt in de resultatenstap.' },
  { id: 'hoeken', label: 'Terugkerende hoeken', kort: 'Welke belofte telkens terugkomt',
    nog_niet: 'Dit is geen filter bij de bron maar een analyse over de opgehaalde advertenties. Komt in de resultatenstap.' },
  { id: 'aanbiedingen', label: 'Aanbiedingen & acties', kort: 'Bundels, korting, verzending',
    nog_niet: 'Vraagt om het lezen van de advertentieteksten van de hele set. Komt in de resultatenstap.' }
];

function crDoel(id) {
  return CR_DOELEN.filter(function (d) { return d.id === (id || _cr.doel); })[0] || CR_DOELEN[0];
}

/* Het doel toepassen op de knoppen die de vraag werkelijk sturen. Alleen als
   het doel uitvoerbaar is -- een doel dat nog niet kan verandert niets, want
   dan zou de lijst iets anders zijn dan het kaartje belooft. */
function crZetDoel(id) {
  var d = CR_DOELEN.filter(function (x) { return x.id === id; })[0];
  if (!d || d.nog_niet) return false;
  _cr.doel = d.id;
  _cr.sorteer = d.zet.sorteer;
  _cr.minDagen = d.zet.minDagen;
  _cr.toonSoort = d.zet.toonSoort;
  return true;
}

/* ── De merkcontext ─────────────────────────────────────────────────────────
 *
 * Voor welk van onze merken doe je dit onderzoek? Dat is geen sier: de
 * concurrenten van Wellshave en die van Wellshine zijn twee verschillende
 * markten, en ze samen analyseren levert een uitkomst op die bij geen van
 * beide hoort.
 *
 * De contexten komen uit de mappen van de Brand Tracker zelf. Zijn die er
 * niet, dan is er geen context om te kiezen en staat dit blok er niet -- twee
 * merken verzinnen die TrendTrack niet kent is precies het soort indeling dat
 * later niet blijkt te kloppen. */
function crContexten() {
  return (_cr.mappen || []).filter(function (f) { return crMapMerken(f.id).length; });
}

function crContextHtml() {
  var ctx = crContexten();
  var h = '<section class="cr-blok"><div class="cr-bloknr">1</div>' +
    '<div class="cr-bloktitel">Voor welk merk doe je onderzoek?</div>';
  if (!ctx.length) {
    h += '<p class="cr-uitleg">De Brand Tracker geeft geen mappen terug, dus er is geen indeling ' +
      'in merken om uit te kiezen. Je concurrenten staan hiernaast op een rij.</p>';
    h += crMarktKaartHtml();
    return h + '</section>';
  }
  /* De hele Brand Tracker, zonder in te zoomen op een van onze merken. Deze
     stond er niet, en zonder hem was "Ander merk" een eenrichtingsdeur: je kon
     naar de hele markt en niet meer terug. */
  var alleAan = (_cr.bereik === 'brandtracker' && !_cr.context);
  h += '<button type="button" class="cr-contextkaart' + (alleAan ? ' aan' : '') + '" ' +
    'data-action="cr-bereik" data-id="brandtracker">' +
    '<span class="cr-contextnaam">Alle gevolgde merken</span>' +
    '<span class="cr-contextsub">' + ((_cr.merken || []).length || 0) +
    ' merken in onze Brand Tracker</span></button>';
  ctx.forEach(function (f) {
    var leden = crMapMerken(f.id);
    var aan = (_cr.context === String(f.id));
    h += '<button type="button" class="cr-contextkaart' + (aan ? ' aan' : '') + '" ' +
      'data-action="cr-context" data-id="' + crEsc(f.id) + '">' +
      '<span class="cr-contextnaam">' + crEsc(f.naam) + '</span>' +
      '<span class="cr-contextsub">' + leden.length + ' concurrent' + (leden.length === 1 ? '' : 'en') +
      ' gevolgd</span></button>';
  });
  h += crMarktKaartHtml();
  return h + '</section>';
}

function crMarktKaartHtml() {
  var aan = (_cr.bereik === 'markt');
  return '<button type="button" class="cr-contextkaart stil' + (aan ? ' aan' : '') + '" ' +
    'data-action="cr-bereik" data-id="markt">' +
    '<span class="cr-contextnaam">Ander merk</span>' +
    '<span class="cr-contextsub">De hele markt van TrendTrack, buiten onze Brand Tracker om</span>' +
    '</button>';
}

/* ── De concurrenten ────────────────────────────────────────────────────────
 *
 * Kaarten en geen pillen: een pil met alleen een naam dwingt je de lijst te
 * lezen, een kaart met logo en aantal laat je hem scannen. En het aantal
 * actieve ads is geen versiering -- een merk met elf advertenties en een merk
 * met veertienhonderd vragen om een ander soort aandacht. */
function crMerkenBlokHtml() {
  var h = '<section class="cr-blok breed"><div class="cr-bloknr">2</div>' +
    '<div class="cr-bloktitel">Selecteer concurrenten</div>';
  if (_cr.bereik === 'markt') {
    h += '<p class="cr-uitleg">Bij de hele markt kies je geen merken: je zoekt op een woord en een land. ' +
      'Die velden staan bij de filters hieronder.</p></section>';
    return h;
  }
  if (!_cr.merken) {
    return h + '<p class="cr-uitleg">De gevolgde merken worden opgehaald…</p></section>';
  }
  if (!_cr.merken.length) {
    return h + '<p class="cr-uitleg">Er staan geen merken in de Brand Tracker. Voeg ze daar toe, ' +
      'dan verschijnen ze hier.</p></section>';
  }
  var zoek = crSlug(_cr.merkZoek);
  var lijst = _cr.merken.filter(function (m) {
    return !zoek || crSlug(m.naam).indexOf(zoek) > -1 || crSlug(m.domein).indexOf(zoek) > -1;
  });
  var gekozen = (_cr.merkSel || []).length;

  h += '<div class="cr-merkbalk">' +
    '<input type="text" id="cr-merkzoek" class="cr-invoer" placeholder="Zoek een merk…" ' +
      'value="' + crEsc(_cr.merkZoek) + '" data-action="cr-merkzoek">' +
    '<span class="cr-merkstand">' + (gekozen
      ? (gekozen + ' merk' + (gekozen === 1 ? '' : 'en') + ' geselecteerd')
      : ('alle ' + _cr.merken.length + ' merken')) + '</span>' +
    '</div>';

  h += '<div class="cr-snelrij">';
  crContexten().forEach(function (f) {
    var leden = crMapMerken(f.id).map(function (m) { return m.id; });
    var aan = leden.length && (_cr.merkSel || []).length === leden.length &&
      leden.every(function (id) { return (_cr.merkSel || []).indexOf(id) !== -1; });
    h += '<button type="button" class="cr-snel' + (aan ? ' aan' : '') + '" ' +
      'data-action="cr-map" data-id="' + crEsc(f.id) + '">' +
      'Concurrenten van ' + crEsc(f.naam) + '</button>';
  });
  h += '<button type="button" class="cr-snel" data-action="cr-merk-alles">Selecteer alle</button>' +
    (gekozen ? '<button type="button" class="cr-snel" data-action="cr-merk-geen">Wis selectie</button>' : '') +
    '</div>';

  if (!lijst.length) {
    h += '<p class="cr-uitleg">Geen merk met "' + crEsc(_cr.merkZoek) + '" in de naam. ' +
      'De andere ' + _cr.merken.length + ' staan er nog; wis het zoekwoord om ze te zien.</p>';
  } else {
    h += '<div class="cr-merkraster">' + lijst.map(crMerkKaartHtml).join('') + '</div>';
  }
  return h + '</section>';
}

function crMerkKaartHtml(m) {
  var aan = (_cr.merkSel || []).indexOf(m.id) !== -1;
  var alles = !(_cr.merkSel || []).length;
  return '<button type="button" class="cr-merkkaart' + (aan ? ' aan' : (alles ? ' mee' : '')) + '" ' +
    'data-action="cr-merk" data-id="' + crEsc(m.id) + '" aria-pressed="' + (aan ? 'true' : 'false') + '">' +
    crLogoHtml(m) +
    '<span class="cr-merkkaart-t">' +
      '<span class="cr-merknaam">' + crEsc(m.naam || m.id) + '</span>' +
      '<span class="cr-merksub">' + (m.actieve_ads != null
        ? (crGetal(m.actieve_ads) + ' actieve ads') : (crEsc(m.domein || '') || 'geen telling')) + '</span>' +
    '</span>' +
    '<span class="cr-vink" aria-hidden="true"></span>' +
    '</button>';
}

/* ── Wat wil je ontdekken ───────────────────────────────────────────────── */
function crDoelenBlokHtml() {
  var h = '<section class="cr-blok"><div class="cr-bloknr">3</div>' +
    '<div class="cr-bloktitel">Wat wil je ontdekken?</div>';
  var zichtbaar = _cr.meerDoelen ? CR_DOELEN : CR_DOELEN.slice(0, 4);
  zichtbaar.forEach(function (d) {
    var aan = (_cr.doel === d.id);
    h += '<button type="button" class="cr-doel' + (aan ? ' aan' : '') + (d.nog_niet ? ' nogniet' : '') + '" ' +
      'data-action="cr-doel" data-id="' + crEsc(d.id) + '"' + (d.nog_niet ? ' disabled' : '') + '>' +
      '<span class="cr-doelnaam">' + crEsc(d.label) + '</span>' +
      '<span class="cr-doelsub">' + crEsc(d.nog_niet || d.kort) + '</span>' +
      '</button>';
  });
  h += '<button type="button" class="cr-meer" data-action="cr-meerdoelen">' +
    (_cr.meerDoelen ? 'Minder doelen' : 'Meer doelen') + '</button>';
  var d = crDoel();
  if (d) {
    h += '<p class="cr-uitleg">' + crEsc(d.nog_niet || d.zegt) +
      (d.let_op ? ' <span class="cr-letop">' + crEsc(d.let_op) + '</span>' : '') + '</p>';
  }
  return h + '</section>';
}

/* ── Filters, en wat er nog niet is ─────────────────────────────────────── */
function crFiltersBlokHtml() {
  var h = '<section class="cr-blok breed"><div class="cr-bloknr">4</div>' +
    '<div class="cr-bloktitel">Filters &amp; instellingen</div>';
  h += '<div class="cr-velden">';
  h += '<label class="cr-veld"><span>Tijdvenster</span><div class="cr-filterrij klein">';
  CR_VENSTERS.forEach(function (v) {
    h += '<button type="button" class="cr-keuze klein' + (_cr.dagen === v.id ? ' aan' : '') + '" ' +
      'data-action="cr-dagen" data-id="' + v.id + '">' + crEsc(v.label) + '</button>';
  });
  h += '</div></label>';
  h += '<label class="cr-veld"><span>Formaat</span><div class="cr-filterrij klein">';
  [['', 'Alles'], ['image', 'Static'], ['video', 'Video']].forEach(function (p) {
    h += '<button type="button" class="cr-keuze klein' + (_cr.toonSoort === p[0] ? ' aan' : '') +
      '" data-action="cr-toonsoort" data-id="' + p[0] + '">' + p[1] + '</button>';
  });
  h += '</div></label>';
  /* Platform staat vast en dat hoort te lezen te zijn. Een keuzelijst met een
     optie is een belofte dat er meer komt; een vaste chip zegt wat het is. */
  h += '<label class="cr-veld"><span>Platform</span>' +
    '<span class="cr-vast">Meta · Facebook &amp; Instagram<em>de enige bron die TrendTrack ons hier geeft</em></span>' +
    '</label>';
  if (_cr.bereik === 'markt') {
    h += '<label class="cr-veld"><span>Land</span>' +
      '<input type="text" id="cr-land" class="cr-invoer kort" placeholder="NL" value="' + crEsc(_cr.land) + '"></label>';
    h += '<label class="cr-veld breed"><span>Zoekwoord in de advertentietekst</span>' +
      '<input type="text" id="cr-zoek" class="cr-invoer" placeholder="leeg = alles" value="' + crEsc(_cr.zoek) + '"></label>';
  }
  h += '</div>';

  h += '<button type="button" class="cr-meer" data-action="cr-meerfilters">' +
    (_cr.meerFilters ? 'Minder filters' : 'Meer filters') + '</button>';
  if (_cr.meerFilters) {
    h += '<div class="cr-velden">';
    h += '<label class="cr-veld"><span>Minimale looptijd</span><div class="cr-filterrij klein">';
    CR_MINDAGEN.forEach(function (dg) {
      h += '<button type="button" class="cr-keuze klein' + (_cr.minDagen === dg ? ' aan' : '') +
        '" data-action="cr-mindagen" data-id="' + dg + '">' + (dg ? (dg + '+ dagen') : 'Alles') + '</button>';
    });
    h += '</div></label>';
    if (_cr.bereik === 'markt') {
      h += '<label class="cr-veld"><span>Taal</span>' +
        '<input type="text" id="cr-taal" class="cr-invoer kort" placeholder="nl" value="' + crEsc(_cr.taal) + '"></label>';
    }
    h += '</div>';
    /* Wat er NIET is. Dit hoort erbij te staan: anders zoek je naar een filter
       dat niet bestaat en denk je dat je het over het hoofd ziet. */
    h += '<p class="cr-uitleg">Nog niet mogelijk via deze bron: CTA-type, landingspagina, ' +
      'aantal duplicaten, partner-badge en een eigen datumbereik. ' +
      '<span class="cr-letop">Ze staan hier bewust niet als knop -- een filter dat niets doet is erger dan een filter dat er niet is.</span></p>';
  }
  return h + '</section>';
}

/* ── De scope, en de knop ───────────────────────────────────────────────── */
function crScopeHtml() {
  var merken = crGekozenMerken();
  var d = crDoel();
  var regels = [];
  if (_cr.bereik === 'markt') {
    regels.push(['bron', 'De hele markt van TrendTrack']);
    if (_cr.land) regels.push(['land', _cr.land]);
    if (_cr.zoek) regels.push(['zoekwoord', _cr.zoek]);
  } else {
    regels.push(['bron', 'Onze Brand Tracker']);
    var ctx = crContexten().filter(function (f) { return String(f.id) === _cr.context; })[0];
    if (ctx) regels.push(['merk', ctx.naam]);
    regels.push(['concurrenten', (_cr.merkSel || []).length
      ? (merken.length + ' van de ' + (_cr.merken || []).length)
      : ('alle ' + ((_cr.merken || []).length || 0))]);
  }
  regels.push(['doel', d.label]);
  regels.push(['venster', _cr.dagen + ' dagen']);
  regels.push(['platform', 'Meta']);
  if (_cr.toonSoort) regels.push(['formaat', _cr.toonSoort === 'video' ? 'Video' : 'Static']);
  if (_cr.minDagen) regels.push(['looptijd', _cr.minDagen + '+ dagen']);

  var kan = (_cr.bereik === 'markt') || !!(_cr.merken && _cr.merken.length);
  return '<aside class="cr-scope"><div class="cr-bloktitel">Onderzoeksscope</div>' +
    '<dl class="cr-scopelijst">' + regels.map(function (r) {
      return '<div><dt>' + crEsc(r[0]) + '</dt><dd>' + crEsc(r[1]) + '</dd></div>';
    }).join('') + '</dl>' +
    '<button type="button" class="cr-knop groot" data-action="cr-haal"' +
      (_cr.bezig || !kan ? ' disabled' : '') + '>' +
      (_cr.bezig ? 'Bezig…' : 'Analyseer met TrendTrack') + '</button>' +
    (kan ? '' : '<p class="cr-uitleg">Er zijn nog geen merken opgehaald.</p>') +
    '</aside>';
}

/* Wat er straks gebeurt, in gewone taal. Dit is geen decoratie: het verschil
   tussen "hij doet iets" en "hij haalt advertenties op, groepeert ze en zoekt
   het patroon" is het verschil tussen wachten en weten waarop je wacht. */
function crRoryHtml() {
  return '<div class="cr-rory">' +
    (typeof teamPortret === 'function' ? teamPortret('rory', 'cr-rory-foto') : '') +
    '<div class="cr-rory-t"><b>Rory gaat aan de slag</b>' +
    '<span>Hij haalt de advertenties op die nu draaien, zet ze op een rij naar het doel dat je koos, ' +
    'en leest daarna het patroon onder de advertentie die je aanklikt.</span></div>' +
    '<div class="cr-stappen">' +
      '<span>Ads ophalen</span><span>Rangschikken</span><span>Patroon lezen</span>' +
    '</div></div>';
}

function crStapperHtml() {
  var stap = _cr.lijst ? 3 : (_cr.bezig ? 2 : 1);
  var namen = ['Bouw onderzoek', 'Analyse', 'Resultaten'];
  return '<ol class="cr-stapper">' + namen.map(function (n, i) {
    var nr = i + 1;
    return '<li class="' + (nr === stap ? 'nu' : (nr < stap ? 'af' : '')) + '">' +
      '<span class="cr-stapnr">' + nr + '</span>' + crEsc(n) + '</li>';
  }).join('') + '</ol>';
}

function crBouwHtml() {
  return '<div class="cr-bouw">' +
    '<div class="cr-bouwkop"><div><h3>Bouw je onderzoek</h3>' +
      '<p>Stel je onderzoek samen en laat TrendTrack het werk doen.</p></div>' +
      crStapperHtml() + '</div>' +
    '<div class="cr-bouwraster">' +
      crContextHtml() + crMerkenBlokHtml() + crDoelenBlokHtml() +
    '</div>' +
    '<div class="cr-bouwonder">' +
      '<div>' + crFiltersBlokHtml() + crRoryHtml() + '</div>' +
      crScopeHtml() +
    '</div></div>';
}

/* ── Filteren over wat er al binnen is ──────────────────────────────────────
 *
 * Deze twee vragen niets nieuws op bij TrendTrack: ze verbergen wat je nu niet
 * wilt zien in de lijst die er staat. Dat verschil staat op het scherm, want
 * "geen video's gevonden" en "video's verborgen" zijn twee heel verschillende
 * uitslagen. */
function crZichtbaar() {
  var lijst = _cr.lijst || [];
  return lijst.filter(function (ad) {
    if (_cr.toonSoort === 'video' && !ad.video) return false;
    if (_cr.toonSoort === 'image' && ad.video) return false;
    if (_cr.minDagen && !(ad.dagen_actief >= _cr.minDagen)) return false;
    return true;
  });
}

var CR_MINDAGEN = [0, 30, 90, 180];

function crToonFilterHtml() {
  if (!_cr.lijst || !_cr.lijst.length) return '';
  var h = '<div class="cr-toonfilter"><span class="cr-bloklabel">Toon</span>';
  [['', 'Alles'], ['image', 'Beeld'], ['video', 'Video']].forEach(function (p) {
    h += '<button type="button" class="cr-keuze klein' + (_cr.toonSoort === p[0] ? ' aan' : '') +
      '" data-action="cr-toonsoort" data-id="' + p[0] + '">' + p[1] + '</button>';
  });
  CR_MINDAGEN.forEach(function (d) {
    h += '<button type="button" class="cr-keuze klein' + (_cr.minDagen === d ? ' aan' : '') +
      '" data-action="cr-mindagen" data-id="' + d + '">' +
      (d ? (d + '+ dagen') : 'Elke looptijd') + '</button>';
  });
  return h + '</div>';
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
  h += crToonFilterHtml();
  /* De lijst zoals hij nu getoond wordt, en gezegd hoeveel er verborgen is.
     Een gefilterde lijst die zich voordoet als de hele lijst is de manier
     waarop je concludeert dat er weinig video draait. */
  var zichtbaar = crZichtbaar();
  var verborgen = _cr.lijst.length - zichtbaar.length;
  if (!zichtbaar.length) {
    return h + '<div class="cr-melding">Er zijn ' + _cr.lijst.length +
      ' advertenties opgehaald, maar dit filter verbergt ze allemaal. ' +
      'Zet het filter terug op alles.</div>';
  }
  if (verborgen > 0) {
    h += '<p class="cr-venstermelding">' + verborgen + ' van de ' + _cr.lijst.length +
      ' opgehaalde advertenties staan hier niet: die vallen buiten dit filter.</p>';
  }
  h += '<div class="cr-raster">' + zichtbaar.map(function (ad) {
    return crKaartHtml(ad, _cr.lijst.indexOf(ad));
  }).join('') + '</div>';
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
  h += '<div class="cr-detail-beeld">' + crDetailBeeldHtml(ad, b) + '</div>';
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
    h += '<div class="cr-melding">' +
      (ad.video ? 'Nick bekijkt ' + CR_FRAMES + ' beelden uit de video…' : 'Nick leest de advertentie…') +
      '</div>';
  } else if (_cr.patroon && _cr.patroon.fout) {
    h += '<div class="cr-melding fout">' + crEsc(_cr.patroon.fout) + '</div>' + crLeesKnop();
  } else if (_cr.patroon) {
    h += crPatroonHtml(_cr.patroon);
  } else {
    h += '<p class="cr-uitleg">Lees het patroon eronder: welke hoek, welk mechanisme, ' +
      'voor wie, en welk soort bewijs. Dat is wat je kunt overnemen — het beeld en de ' +
      'copy van dit merk niet.' +
      (ad.video ? ' Bij een video kijkt Nick naar ' + CR_FRAMES + ' beelden uit het bestand. ' +
        'Het geluid hoort hij niet, dus zit het mechanisme in de voice-over, dan blijft dat veld leeg.' : '') +
      '</p>' + crLeesKnop();
  }
  h += '</div></div>';
  return h;
}

/* Bewegend beeld krijgt een speler, stilstaand beeld een plaatje, en een
   advertentie waar we niets van hebben zegt dat gewoon. De poster van de video
   is het beeld dat we al hadden: dan staat er iets terwijl het bestand nog
   binnenkomt, in plaats van een zwart vlak. */
function crDetailBeeldHtml(ad, b) {
  if (ad.video) {
    var v = _cr.videos[ad.video];
    if (v) {
      return '<video class="cr-video" controls playsinline preload="metadata" ' +
        (b ? 'poster="' + crEsc(b.url) + '" ' : '') +
        'src="' + crEsc(v.url) + '"></video>';
    }
    if (_cr.videoFout) return '<span class="cr-beeld-leeg fout">' + crEsc(_cr.videoFout) + '</span>';
    return (b ? '<img src="' + crEsc(b.url) + '" alt="">' : '') +
      '<span class="cr-beeld-leeg">video laden…</span>';
  }
  if (b) return '<img src="' + crEsc(b.url) + '" alt="">';
  return '<span class="cr-beeld-leeg">geen beeld</span>';
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
  /* De knop zegt WAT er gemaakt wordt. "Maak hier onze versie van" liet in het
     midden of dat een static of een video werd, en stuurde altijd naar de
     statics-wizard -- ook bij een advertentie van zevenentwintig seconden. */
  var video = crIsVideo(_cr.open);
  h += '<button type="button" class="cr-knop groot" data-action="cr-wizard">' +
    (video ? 'Maak hier ons script van' : 'Maak hier onze static van') + '</button>';
  h += '<p class="cr-uitleg">Dit vult ' +
    (video ? 'de Scriptwriter met de hoek, het mechanisme, het publiek en de vorm — jij kiest het product'
           : 'de statics-wizard met de hoek, het mechanisme, het publiek, de bewijsvorm en het formaat') +
    '. Het beeld, de copy en de claim van dit merk gaan niet mee — die zijn van hen.</p>';
  return h;
}

function crPatroonPrompt(ad, frames) {
  var d = [];
  d.push('Je kijkt naar een advertentie die op dit moment draait bij een ander merk.');
  /* Wat Claude wel en niet gezien heeft, en dat expliciet. Zonder deze regels
     leest hij zes losse plaatjes als zes advertenties, en vult hij het
     mechanisme in met wat de voice-over gezegd zou kunnen hebben. Precies het
     soort veld dat er ingevuld uitziet en verzonnen is. */
  if (frames && frames.length) {
    d.push('Dit is een VIDEO. Je krijgt ' + frames.length + ' stilstaande beelden uit die video, ' +
      'in volgorde, op ' + frames.map(function (f) { return Math.round(f.t) + 's'; }).join(', ') + '.');
    d.push('Je hoort het geluid NIET en je ziet de beweging niet. Bij een videoadvertentie zit ' +
      'het mechanisme vaak juist in de voice-over. Kun je het niet uit de beelden of de copy ' +
      'aflezen, laat het veld dan leeg -- schrijf niet op wat er gezegd zou kunnen zijn.');
  }
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
    '  formaat         - de vorm (nieuwsartikel, advertorial, productfoto, vergelijking, meme, screenshot, ' +
    'talking head, demonstratie, UGC, voor-na, anders)\n' +
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
    var frames = null;
    /* Bij bewegend beeld gaat de film zelf niet mee -- die kan Claude niet
       lezen. Wat er wel heen gaat is een reeks stilstaande beelden uit die
       film, en de prompt zegt erbij dat het er zes zijn en dat het geluid
       ontbreekt. */
    if (ad.video) {
      var v = await crVideoHaal(ad.video);
      if (v) {
        frames = await crVideoFrames(await crEigenSpeler(v.url), CR_FRAMES);
        frames.forEach(function (f) {
          inhoud.push({ type: 'image', source: { type: 'base64', media_type: f.mime, data: f.b64 } });
        });
      }
    }
    if (!(frames && frames.length) && ad.beeld) {
      var b = await crBeeld(ad.beeld);
      if (b) {
        var beeld = await crBlobNaarBase64(b.blob);
        inhoud.push({ type: 'image', source: { type: 'base64', media_type: beeld.mime, data: beeld.b64 } });
      }
    }
    inhoud.push({ type: 'text', text: crPatroonPrompt(ad, frames) });
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

/* ── Van een patroon naar ons eigen werk ───────────────────────────────── */

/* Een video wordt geen static. Dat lijkt vanzelfsprekend en het ging toch mis:
   de knop stuurde alles naar de statics-wizard, ook een advertentie van
   zevenentwintig seconden met een voice-over. Dan bouw je een bewegend concept
   na als één stilstaand beeld, en het enige wat overblijft is de eerste frame.

   Bewegend beeld gaat naar de Scriptwriter, stilstaand beeld naar de
   statics-wizard. Het patroon is hetzelfde; het ambacht niet. */
function crIsVideo(ad) {
  return !!(ad && (ad.video || /video/i.test(String(ad.soort || ''))));
}

/* Van het formaat dat Rory leest naar een formaat dat wij kennen. Volgorde is
   betekenis: 'advertorial' staat voor 'artikel', want een advertorial IS een
   artikel en de omgekeerde volgorde zou hem als nieuwsbericht wegzetten.

   Herkent hij niets, dan blijft het veld leeg -- en leeg betekent hier "kies
   zelf" of "laat Theriot kiezen". Een gok invullen is erger dan niets
   invullen: een ingevuld veld leest als een besluit. */
var CR_FORMAAT_STATIC = [
  { woorden: ['advertorial'], id: 'news-headline-advertorial' },
  { woorden: ['nieuwsartikel', 'nieuwsbericht', 'artikel', 'news'], id: 'news-headline-advertorial' },
  { woorden: ['voor-na', 'voor/na', 'before'], id: 'before-after' },
  { woorden: ['vergelijking', 'comparison', 'us vs'], id: 'us-vs-them-tabel' },
  { woorden: ['meme'], id: 'meme-format' },
  { woorden: ['screenshot'], id: 'review-screenshot' },
  { woorden: ['getuige', 'testimonial', 'review'], id: 'testimonial-pull-quote' },
  { woorden: ['demonstratie', 'demo', 'hoe het werkt'], id: 'how-it-works' },
  { woorden: ['productfoto', 'packshot', 'product'], id: 'product-hero' }
];

var CR_FORMAAT_SCRIPT = [
  { woorden: ['advertorial'], id: 'Native Article / Advertorial' },
  { woorden: ['nieuwsartikel', 'nieuwsbericht', 'artikel', 'news'], id: 'Native Article / Advertorial' },
  { woorden: ['voor-na', 'voor/na', 'before'], id: 'Before & After / Transformation' },
  { woorden: ['vergelijking', 'comparison', 'split'], id: 'Split Screen Comparison' },
  { woorden: ['founder', 'oprichter'], id: 'Founder Story / Origin Video' },
  { woorden: ['getuige', 'testimonial', 'talking head', 'review'], id: 'UGC Talking Head Testimonial' },
  { woorden: ['demonstratie', 'demo', 'how-to', 'hoe het werkt'], id: 'UGC Demo / How-To' },
  { woorden: ['verhaal', 'story', 'dag uit'], id: 'UGC Story Time / Day in the Life' }
];

function crFormaatNaar(tabel, formaat) {
  if (!formaat) return '';
  var t = String(formaat).toLowerCase();
  for (var i = 0; i < tabel.length; i++) {
    for (var j = 0; j < tabel[i].woorden.length; j++) {
      if (t.indexOf(tabel[i].woorden[j]) !== -1) return tabel[i].id;
    }
  }
  return '';
}

/* Sophistication komt als 's4' binnen en de Scriptwriter wil '4'. Een stille
   mismatch levert daar een leeg veld op -- en dan valt hij terug op stadium 3
   terwijl de markt op 4 zit, wat precies het verschil is tussen een claim die
   nog gelooft wordt en een die dat niet meer wordt. */
function crSophNummer(s) {
  var m = String(s || '').match(/([1-5])/);
  return m ? m[1] : '';
}

/* Een veld alleen zetten als de keuzelijst die waarde werkelijk kent. Zet je
   een select op iets wat er niet in staat, dan springt hij terug naar de
   eerste optie -- en dan staat er een waarde die niemand gekozen heeft. */
function crZetVeld(id, waarde) {
  var el = document.getElementById(id);
  if (!el || !waarde) return false;
  if (el.tagName === 'SELECT') {
    var kan = [].slice.call(el.options).some(function (o) { return o.value === String(waarde); });
    if (!kan) return false;
  }
  el.value = String(waarde);
  if (typeof el.dispatchEvent === 'function') el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/* De brief die meegaat. Het patroon gaat mee, het werk van de ander niet:
   geen beeld, geen copy, geen claim. Dat staat er ook in, want deze tekst gaat
   rechtstreeks een model in en dat leest alles wat er staat als opdracht. */
function crBrief(ad, p, soort) {
  var r = [];
  r.push('Nagebouwd patroon uit Creative Research' + (ad.merk ? ' (gezien bij ' + ad.merk + ')' : '') + '.');
  if (ad.dagen_actief) r.push('Die advertentie draait daar al ' + ad.dagen_actief + ' dagen.');
  if (p.hoek) r.push('Hoek: ' + p.hoek);
  if (p.mechanisme) r.push('Mechanisme: ' + p.mechanisme);
  if (p.publiek) r.push('Voor wie: ' + p.publiek);
  if (p.bewijs && p.bewijs !== 'geen') r.push('Bewijsvorm: ' + p.bewijs);
  if (p.waarom) r.push('Waarom dit daar werkt: ' + p.waarom);
  r.push('Wij maken hier onze eigen ' + (soort === 'script' ? 'video' : 'static') +
    ' van, voor ons eigen product. Neem het patroon over, niet de uitvoering: ' +
    'het beeld, de copy en de claims van dat merk gaan niet mee.');
  return r.join('\n');
}

/* Alles wat we uit het onderzoek weten, klaargezet voordat het scherm opengaat.
   Wat we NIET weten is welk van onze producten dit wordt -- dat is een besluit
   en geen aflezing, dus dat blijft de ene open keuze. */
function crNaarScriptwriter() {
  var ad = _cr.open, p = _cr.patroon;
  if (!ad || !p || p.fout) return;
  if (typeof switchMainTab !== 'function' || !document.getElementById('sw-direction')) {
    if (typeof toast === 'function') toast('De Scriptwriter is hier niet beschikbaar', true);
    return;
  }
  switchMainTab('scriptwriter');
  if (typeof setSwMode === 'function') setSwMode('new');

  var gezet = [];
  if (crZetVeld('sw-awareness', p.awareness)) gezet.push('awareness');
  if (crZetVeld('sw-sophistication', crSophNummer(p.sophistication))) gezet.push('sophistication');
  if (crZetVeld('sw-format', crFormaatNaar(CR_FORMAAT_SCRIPT, p.formaat))) gezet.push('format');

  /* Een richting die er al staat is werk van iemand anders. Die overschrijven
     we niet -- dan verdwijnt een brief waar iemand tien minuten aan zat. */
  var dir = document.getElementById('sw-direction');
  if (dir && !dir.value.trim()) { dir.value = crBrief(ad, p, 'script'); gezet.push('richting'); }

  _cr.overgenomen = { naar: 'scriptwriter', velden: gezet, merk: ad.merk || null };
  if (typeof toast === 'function') {
    toast('Patroon overgenomen in de Scriptwriter. Kies je product, de rest staat klaar. ' +
      'Het beeld en de copy van ' + (ad.merk || 'dat merk') + ' zijn niet meegekomen.');
  }
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
  /* Het formaat ook. Dit was de grootste lege stap: je kwam de wizard binnen
     met een gelezen patroon en moest het formaat alsnog zelf kiezen, terwijl
     Rory net had opgeschreven welke vorm het daar had. */
  var fid = crFormaatNaar(CR_FORMAAT_STATIC, p.formaat);
  if (fid && typeof AD_FORMATS !== 'undefined' &&
      AD_FORMATS.some(function (f) { return f.id === fid; })) {
    d.format.formatId = fid;
    wizState.source['format.formatId'] = 'onderzoek';
  }

  /* En de brief, in het richtingsveld van de copy-stap. Die staat er anders
     leeg terwijl alles wat erin hoort net gelezen is. Wat er al stond blijft
     staan: dat is werk van iemand. */
  if (!d.copy.direction) {
    d.copy.direction = crBrief(ad, p, 'static');
    wizState.source['copy.direction'] = 'onderzoek';
  }

  /* Eén product? Dan is er niets te kiezen en is die stap geen stap. Zijn het
     er meer, dan blijft het een besluit -- welk van ONZE producten dit wordt
     staat niet in de advertentie van een ander. */
  if (!d.product.productId && typeof state !== 'undefined' &&
      Array.isArray(state.products) && state.products.length === 1) {
    d.product.productId = state.products[0].id;
  }

  wizState.onderzoekBron = {
    merk: ad.merk || null, dagen_actief: ad.dagen_actief || null,
    formaat: p.formaat || null, waarom: p.waarom || null,
    /* Voor wie het daar was. Er is geen vrij tekstveld voor het publiek in de
       wizard -- audience.market gaat over wáár de campagne draait, niet over
       wie -- dus zou dit verdwijnen als het hier niet stond. */
    publiek: p.publiek || null
  };
  if (typeof wizSave === 'function') wizSave();
  if (typeof switchMainTab === 'function') switchMainTab('generator');
  if (typeof wizOpen === 'function') wizOpen();
  if (typeof toast === 'function') {
    toast('Patroon overgenomen. Het beeld en de copy van ' + (ad.merk || 'dat merk') + ' zijn niet meegekomen.');
  }
}

/* ── Tekenen en klikken ────────────────────────────────────────────────── */

/* Het scherm is een werkbank en geen formulier. Bovenin bouw je het onderzoek
   -- merk, concurrenten, doel, filters -- en daaronder komt wat eruit rolt. Het
   was een kolom filterrijen met de halve pagina leeg ernaast, en dan lees je
   die rijen als een vragenlijst die je eerst moet invullen.

   De bouwer blijft staan zolang er nog geen uitslag is; hij klapt in zodra die
   er wel is (dat is de volgende stap in deze verbouwing). */
function crRender() {
  var el = document.getElementById('cr-inhoud');
  if (!el) return;
  el.innerHTML = _cr.open ? crDetailHtml() :
    ('<div class="cr-werk">' +
       crBouwHtml() +
       '<div class="cr-uitslag">' + crLijstHtml() + '</div>' +
     '</div>');
  /* Het zoekveld houdt zijn plek in de tekst: na een hertekening staat de
     cursor anders vooraan en typ je achterstevoren. */
  var z = document.getElementById('cr-merkzoek');
  if (z && _cr.merkZoekActief) { z.focus(); z.setSelectionRange(z.value.length, z.value.length); }
}

/* Zoeken op merknaam. Een eigen luisteraar en geen knop: je typt, de lijst
   krimpt mee. */
function crTyp(e) {
  var el = e.target;
  if (!el || el.id !== 'cr-merkzoek') return;
  _cr.merkZoek = el.value;
  _cr.merkZoekActief = true;
  crRender();
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
    /* Terug naar de Brand Tracker betekent: geen merk uitgelicht en geen
       selectie van dat merk meer. Anders sta je op "alle gevolgde merken"
       terwijl er nog vier van Wellshine aangevinkt staan. */
    _cr.context = '';
    if (_cr.bereik === 'brandtracker') _cr.merkSel = [];
    crRender();
    if (_cr.bereik === 'brandtracker' && !_cr.merken) crHaalMerken();
  } else if (act === 'cr-merk') {
    /* Aan- en uitzetten, niet vervangen. Een merk kiezen betekende de vorige
       laten vallen, en dat is precies de keuze die je niet wilt maken. */
    var id = knop.getAttribute('data-id');
    var sel = (_cr.merkSel || []).slice();
    var pos = sel.indexOf(id);
    if (pos === -1) sel.push(id); else sel.splice(pos, 1);
    _cr.merkSel = sel; _cr.lijst = null; crRender();
  } else if (act === 'cr-merk-alles') { _cr.merkSel = []; _cr.lijst = null; crRender(); }
  else if (act === 'cr-merk-geen') { _cr.merkSel = []; _cr.lijst = null; crRender(); }
  else if (act === 'cr-map') {
    /* Een map is een selectie in een klik: alle concurrenten van Wellshine, of
       die van Wellshave. Nog een keer drukken zet hem uit. */
    var leden = crMapMerken(knop.getAttribute('data-id')).map(function (m) { return m.id; });
    var alAan = leden.length && leden.every(function (x) { return (_cr.merkSel || []).indexOf(x) !== -1; }) &&
      (_cr.merkSel || []).length === leden.length;
    _cr.merkSel = alAan ? [] : leden;
    _cr.lijst = null; crRender();
  }
  else if (act === 'cr-toonsoort') { _cr.toonSoort = knop.getAttribute('data-id'); crRender(); crLaadBeelden(); }
  else if (act === 'cr-mindagen') { _cr.minDagen = Number(knop.getAttribute('data-id')); crRender(); crLaadBeelden(); }
  else if (act === 'cr-doel') {
    /* Een doel dat nog niet kan verandert niets. Hem laten "aanstaan" zou een
       lijst opleveren die iets anders is dan het kaartje belooft. */
    if (crZetDoel(knop.getAttribute('data-id'))) { _cr.lijst = null; crRender(); }
  }
  else if (act === 'cr-meerdoelen') { _cr.meerDoelen = !_cr.meerDoelen; crRender(); }
  else if (act === 'cr-meerfilters') { _cr.meerFilters = !_cr.meerFilters; crRender(); }
  else if (act === 'cr-context') {
    /* Een merkcontext kiezen betekent: zijn concurrenten selecteren. Dat is de
       hele reden dat die mappen er zijn. */
    _cr.context = knop.getAttribute('data-id');
    _cr.bereik = 'brandtracker';
    _cr.merkSel = crMapMerken(_cr.context).map(function (m) { return m.id; });
    _cr.lijst = null; crRender();
  }
  else if (act === 'cr-dagen') { _cr.dagen = Number(knop.getAttribute('data-id')); crRender(); }
  else if (act === 'cr-soort') { _cr.soort = knop.getAttribute('data-id'); crRender(); }
  else if (act === 'cr-haal') {
    var z = document.getElementById('cr-zoek'), l = document.getElementById('cr-land'),
        t = document.getElementById('cr-taal');
    if (z) _cr.zoek = z.value.trim();
    if (l) _cr.land = l.value.trim().toUpperCase();
    if (t) _cr.taal = t.value.trim();
    crHaalLijst();
  } else if (act === 'cr-open') {
    crOpenAd(_cr.lijst[Number(knop.getAttribute('data-i'))]);
  } else if (act === 'cr-sluit') { crSluitAd(false); }
  else if (act === 'cr-lees') { crLeesPatroon(); }
  else if (act === 'cr-wizard') {
    /* Bewegend beeld wordt een script, stilstaand beeld een static. */
    if (crIsVideo(_cr.open)) crNaarScriptwriter(); else crNaarWizard();
  }
}

function renderCreativeResearch() {
  var el = document.getElementById('cr-inhoud');
  if (el && !el._crGebonden) {
    el.addEventListener('click', crKlik);
    el.addEventListener('input', crTyp);
    el._crGebonden = true;
  }
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
window.crNaarScriptwriter = crNaarScriptwriter; window.crIsVideo = crIsVideo;
window.crFormaatNaar = crFormaatNaar; window.crSophNummer = crSophNummer;
window.crZetVeld = crZetVeld; window.crBrief = crBrief;
window.CR_FORMAAT_STATIC = CR_FORMAAT_STATIC; window.CR_FORMAAT_SCRIPT = CR_FORMAAT_SCRIPT;
window.crPatroonPrompt = crPatroonPrompt; window.crPatroonHtml = crPatroonHtml;
window.crKaartHtml = crKaartHtml; window.crLijstHtml = crLijstHtml;
window.crDetailHtml = crDetailHtml;
window.crBouwHtml = crBouwHtml; window.crContextHtml = crContextHtml;
window.crMerkenBlokHtml = crMerkenBlokHtml; window.crDoelenBlokHtml = crDoelenBlokHtml;
window.crFiltersBlokHtml = crFiltersBlokHtml; window.crScopeHtml = crScopeHtml;
window.crMerkKaartHtml = crMerkKaartHtml; window.crContexten = crContexten;
window.crTyp = crTyp; window.crStapperHtml = crStapperHtml; window.crRoryHtml = crRoryHtml;
window.CR_DOELEN = CR_DOELEN; window.crDoel = crDoel; window.crZetDoel = crZetDoel;
window.crGetal = crGetal; window._cr = _cr;
window.crMerkDomein = crMerkDomein; window.crLogoHtml = crLogoHtml; window.crSlug = crSlug;
window.crZichtbaar = crZichtbaar; window.crToonFilterHtml = crToonFilterHtml;
window.crMapMerken = crMapMerken; window.crMappenRij = crMappenRij;
window.crGekozenMerken = crGekozenMerken; window.CR_MINDAGEN = CR_MINDAGEN;
window.crFrameTijden = crFrameTijden; window.crVideoFrames = crVideoFrames;
window.crDetailBeeldHtml = crDetailBeeldHtml; window.crOpenVideo = crOpenVideo;
window.CR_FRAMES = CR_FRAMES; window.crEigenSpeler = crEigenSpeler;
window.crVideoHaal = crVideoHaal;
window.CR_PATROONVELDEN = CR_PATROONVELDEN;
