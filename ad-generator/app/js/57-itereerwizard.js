/* ═══════════════════════════════════════════════════════════════════════════
   De itereerwizard — van een draaiende advertentie naar drie iteraties

   Beslisvraag (opgeschreven vóór deze regel code):

       "Welke advertentie itereren we, waar lekt hij, en wat testen we dus?"

   Wat hier vervangen wordt: dertig invoervelden die je met de hand overtikte
   uit Ads Manager, of uit een screenshot liet uitlezen. Dat was niet alleen
   werk -- het was ook de plek waar de cijfers stilletjes verkeerd werden. Een
   komma waar een punt hoort, een percentage dat als getal binnenkomt, dertig
   dagen in het ene veld en zeven in het andere.

   Drie stappen, in de volgorde waarin het werk gebeurt:

     1. WELKE ADVERTENTIE. Uit je eigen account, via Atria of Meta. Je ziet wat
        hij kostte en opleverde vóór je kiest. Handmatig invullen kan nog
        steeds, in dezelfde stap -- dat is de terugval als de koppeling er niet
        is, niet een tweede route die apart onderhouden moet worden.

     2. WAAR LEKT HIJ. De trap van vertoning naar bestelling, elke stap
        vergeleken met hetzelfde account over hetzelfde venster. Het knelpunt
        is de zwakste stap die ook werkelijk onder de norm zit.

     3. WAT TESTEN WE. Volgt uit het knelpunt. En als het lek ná de klik zit,
        staat dat er: dan lost een nieuwe creative het niet op, en drie nieuwe
        hooks lekken alle drie even hard. Je mag dan alsnog doorgaan -- het is
        jouw geld -- maar niet zonder dat het er staat.

   Wat hier NIET verandert: de analyse van Theriot en het genereren zelf. Die
   werkten al en ze werken hetzelfde. Wat verandert is waar hun cijfers vandaan
   komen, en dat de winnende static niet meer geüpload hoeft te worden: die
   komt met de advertentie mee.
   ═══════════════════════════════════════════════════════════════════════════ */

var _iw = {
  bron: null, account: null, dagen: 30,
  bronnen: null, lijst: null, gekozen: null, diagnose: null, norm: null,
  bezig: false, fout: null, handmatig: false, stap: 1,
  /* Welke ingang naar de lijst gekozen is. "recent" is de hele lijst: dat is
     wat je ziet voordat je een keuze maakt, en dus de eerlijke standaard. */
  preset: 'recent',
  /* Of er een vorige periode te vergelijken viel, en zo niet: waarom. Zonder
     dat is "geen dalende advertenties" niet te onderscheiden van "niet
     gemeten", en die twee vragen om iets heel anders. */
  trendBeschikbaar: null, trendReden: null,
  analyseBezig: false, analyseFout: null,
  /* Waarom er geen beeld staat, als er geen beeld staat. Null betekent: er is
     er wel een, of we hebben het nog niet geprobeerd. */
  beeldFout: null
};

function iwEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* Een getal zoals je het leest. Onbekend is een streepje en nooit een nul:
   een nul is een meting, en "wij weten het niet" is dat niet. */
function iwGetal(n, soort) {
  if (n === null || n === undefined || n === '') return '—';
  var x = Number(n);
  if (!isFinite(x)) return '—';
  if (soort === 'geld') return '€ ' + x.toFixed(2);
  if (soort === 'procent') return x.toFixed(2) + '%';
  if (soort === 'ratio') return x.toFixed(2);
  if (x >= 1000000) return (x / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (x >= 1000) return Math.round(x / 1000) + 'k';
  return String(Math.round(x));
}

function iwBasis() {
  return (typeof PROXY_BASE === 'string' ? PROXY_BASE : '').replace(/\/$/, '');
}

async function iwVraag(pad) {
  var o = { headers: { 'Content-Type': 'application/json' } };
  if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
  var r = await fetch(iwBasis() + pad, o);
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
    var teOud = (typeof wgWorkerTeOud === 'function') ? wgWorkerTeOud(r.status, melding, '/itereren') : null;
    throw new Error(teOud || melding);
  }
  return data;
}

/* ── Stap 1: welke advertentie ─────────────────────────────────────────── */

async function iwHaalBronnen() {
  _iw.bezig = true; _iw.fout = null; iwRender();
  try {
    var uit = await iwVraag('/itereren/bronnen');
    _iw.bronnen = uit.bronnen || [];
    /* De eerste bruikbare bron alvast kiezen. Een keuzemenu waarin je zelf
       moet uitzoeken welke van de twee werkt is werk dat het scherm zelf kan
       doen -- maar hij blijft te wisselen, want de twee tellen niet identiek. */
    var eerste = _iw.bronnen.filter(function (b) { return b.bruikbaar; })[0];
    if (eerste && !_iw.bron) {
      _iw.bron = eerste.bron;
      if (eerste.accounts && eerste.accounts.length) _iw.account = eerste.accounts[0].id;
    }
  } catch (e) {
    _iw.fout = String((e && e.message) || e);
  }
  _iw.bezig = false; iwRender();
}

async function iwHaalLijst() {
  if (!_iw.bron || !_iw.account) { _iw.fout = 'Kies eerst een bron en een account'; return iwRender(); }
  _iw.bezig = true; _iw.fout = null; _iw.gekozen = null; _iw.diagnose = null; iwRender();
  try {
    var uit = await iwVraag('/itereren/advertenties?bron=' + encodeURIComponent(_iw.bron) +
      '&account=' + encodeURIComponent(_iw.account) + '&dagen=' + _iw.dagen +
      '&limiet=25&vergelijk=1');
    _iw.lijst = uit.advertenties || [];
    _iw.trendBeschikbaar = uit.trend_beschikbaar !== false;
    _iw.trendReden = uit.trend_reden || null;
    /* Stond de ingang op "dalend" en kan deze bron dat niet, dan terug naar de
       hele lijst. Anders staat er een lege lijst onder een knop die aan staat. */
    if (!_iw.trendBeschikbaar && _iw.preset === 'dalend') _iw.preset = 'recent';
  } catch (e) {
    _iw.fout = String((e && e.message) || e);
    _iw.lijst = null;
  }
  _iw.bezig = false; iwRender();
}

async function iwKies(i) {
  var kort = _iw.lijst[i];
  if (!kort) return;
  _iw.bezig = true; _iw.fout = null; iwRender();
  try {
    var uit = await iwVraag('/itereren/advertentie?bron=' + encodeURIComponent(_iw.bron) +
      '&account=' + encodeURIComponent(_iw.account) + '&id=' + encodeURIComponent(kort.id) +
      '&dagen=' + _iw.dagen);
    _iw.gekozen = uit.advertentie;
    _iw.norm = uit.norm;
    _iw.diagnose = uit.diagnose;
    _iw.stap = 2;
    _iw.analyseFout = null;
    /* Het beeld van de advertentie wordt de bron-ad. Dat is de hele reden dat
       dit sneller is dan het oude formulier: je hoeft de static die je zelf
       hebt gemaakt niet opnieuw te uploaden om erop te kunnen itereren. */
    await iwZetBronAd(_iw.gekozen);
  } catch (e) {
    _iw.fout = String((e && e.message) || e);
  }
  _iw.bezig = false; iwRender();
}

/* Waarom er geen beeld staat. Drie oorzaken die er op het scherm identiek
   uitzagen -- "geen beeld bij deze advertentie" -- terwijl ze om iets heel
   anders vragen: de bron gaf geen adres, het adres komt van een host die wij
   niet ophalen, of het ophalen zelf ging mis. De eerste vraag om een andere
   uitlezing, de tweede om een host op de lijst, de derde om opnieuw proberen. */
async function iwZetBronAd(ad) {
  _iw.beeldFout = null;
  /* Eerst het vorige beeld weg. Zonder dit blijft de creative van de VORIGE
     advertentie staan zodra de nieuwe er geen heeft -- en dan leest Rory het
     ene beeld met de cijfers van het andere. Dat ziet er volkomen normaal uit
     en is het duurste soort fout in dit scherm. */
  var st = iwState();
  if (st) st.sourceAd = null;
  if (typeof renderSourceAdPreview === 'function') renderSourceAdPreview();
  if (!ad) return;
  if (!ad.beeld) {
    if (ad.video) {
      _iw.beeldFout = 'Dit is een videoadvertentie. Er is geen stilstaand beeld om op te itereren.';
    } else if (ad.velden_zonder_beeld && ad.velden_zonder_beeld.length) {
      /* Dezelfde diagnose als bij Creative Research, en om dezelfde reden: dit
         zegt of we verkeerd zoeken of dat er werkelijk niets is. */
      _iw.beeldFout = 'De bron gaf geen beeldadres. Deze velden stonden er wel: ' +
        ad.velden_zonder_beeld.slice(0, 24).join(', ') + '.';
    } else {
      _iw.beeldFout = 'De bron gaf geen beeldadres bij deze advertentie.';
    }
    return;
  }
  try {
    var o = { headers: {} };
    if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
    var r = await fetch(iwBasis() + '/onderzoek/beeld?u=' + encodeURIComponent(ad.beeld), o);
    if (!r.ok) {
      var d = null;
      try { d = await r.json(); } catch (e) { d = null; }
      _iw.beeldFout = 'Het beeld was niet op te halen: ' +
        ((typeof wgFoutTekst === 'function') ? wgFoutTekst(d, r.status) : ('de worker antwoordde met ' + r.status));
      return;
    }
    var blob = await r.blob();
    var dataUrl = await new Promise(function (klaar, mislukt) {
      var lezer = new FileReader();
      lezer.onload = function () { klaar(String(lezer.result)); };
      lezer.onerror = function () { mislukt(new Error('kon het beeld niet lezen')); };
      lezer.readAsDataURL(blob);
    });
    var m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return;
    state.sourceAd = { b64: m[2], mimeType: m[1], fileName: 'meta-' + (ad.id || 'ad') + '.png',
                       size: blob.size, uploadedAt: Date.now() };
    if (typeof renderSourceAdPreview === 'function') renderSourceAdPreview();
  } catch (e) {
    /* Geen beeld is vervelend, geen cijfers is fataal en die hebben we. Maar
       stil is het niet meer: wat er misging staat op de kaart. */
    _iw.beeldFout = 'Het beeld was niet op te halen: ' + String((e && e.message) || e);
  }
}

/* ── De cijfers, in onze eigen woorden ─────────────────────────────────── */

var IW_KERNCIJFERS = [
  { sleutel: 'spend', label: 'Uitgegeven', soort: 'geld' },
  { sleutel: 'roas', label: 'ROAS', soort: 'ratio' },
  { sleutel: 'aankopen', label: 'Bestellingen' },
  { sleutel: 'cpa', label: 'Kosten per bestelling', soort: 'geld' },
  { sleutel: 'aov', label: 'Gemiddelde order', soort: 'geld' },
  { sleutel: 'impressions', label: 'Vertoningen' },
  { sleutel: 'klikken', label: 'Linkkliks' },
  { sleutel: 'ctr', label: 'CTR', soort: 'procent' },
  { sleutel: 'cpm', label: 'CPM', soort: 'geld' },
  { sleutel: 'lpv', label: 'Paginabezoeken' },
  { sleutel: 'atc', label: 'In de wagen' },
  { sleutel: 'omzet', label: 'Omzet', soort: 'geld' }
];

/* Een verhouding als een verschil in procenten, want "0,84" zegt niemand iets
   en "16% onder het account" wel. */
function iwVerschil(verhouding) {
  if (verhouding === null || verhouding === undefined) return null;
  var p = Math.round((verhouding - 1) * 100);
  if (p === 0) return 'gelijk aan het account';
  return Math.abs(p) + '% ' + (p > 0 ? 'boven' : 'onder') + ' het account';
}

function iwTrapHtml() {
  var d = _iw.diagnose;
  if (!d) return '';
  var h = '<div class="iw-trap">';
  d.stappen.forEach(function (s) {
    var knel = d.knelpunt === s.sleutel;
    h += '<div class="iw-stap' + (knel ? ' knelpunt' : '') + (s.oordeel ? ' o-' + s.oordeel : '') + '">';
    h += '<div class="iw-stap-kop"><span class="iw-stap-label">' + iwEsc(s.label) + '</span>';
    if (knel) h += '<span class="iw-vlag">het lek</span>';
    h += '</div>';
    /* Wat er gemeten is, en waartegen. Zonder de norm ernaast is een
       percentage een cijfer zonder betekenis. */
    if (s.waarde !== null && s.waarde !== undefined) {
      var toon = s.sleutel === 'inkoop' ? iwGetal(s.waarde, 'geld')
        : (s.sleutel === 'orderwaarde' ? iwGetal(s.waarde, 'geld') : (s.waarde * 100).toFixed(1) + '%');
      h += '<div class="iw-stap-waarde">' + iwEsc(toon) + '</div>';
    } else {
      h += '<div class="iw-stap-waarde leeg">niet gemeten</div>';
    }
    var v = iwVerschil(s.verhouding);
    if (v && s.genoeg_data) h += '<div class="iw-stap-norm">' + iwEsc(v) + '</div>';
    else if (!s.genoeg_data) {
      /* Te weinig data is een uitslag, geen oordeel. Er staat waarom, want
         "geen oordeel" zonder reden leest als een storing. */
      h += '<div class="iw-stap-norm leeg">te weinig data (' +
        iwEsc(iwGetal(s.noemer)) + ' van de ' + iwEsc(iwGetal(s.drempel)) + ' nodig)</div>';
    } else {
      h += '<div class="iw-stap-norm leeg">geen norm om tegen te meten</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}

function iwDiagnoseHtml() {
  var d = _iw.diagnose;
  if (!d) return '';
  var h = '<h4>Waar lekt hij</h4>';
  h += iwTrapHtml();
  if (!d.knelpunt) {
    h += '<p class="iw-uitleg"><b>Geen lek gevonden.</b> ' + iwEsc(d.reden) +
      (d.meetbaar ? ' Dat is een uitslag: deze advertentie doet het op elke meetbare stap ' +
        'net zo goed als of beter dan het account. Itereren mag, maar opschalen ligt meer voor de hand.' : '') +
      '</p>';
    return h;
  }
  var wt = d.wat_testen || {};
  h += '<h4>Wat testen we</h4>';
  h += '<p class="iw-uitleg' + (wt.creative === false ? ' waarschuwing' : '') + '">' + iwEsc(wt.zeg || '') + '</p>';
  if (wt.creative === false) {
    /* De duurste fout in dit hele scherm is hier doorklikken zonder dit te
       lezen. Dus staat het er, en de knop zegt wat hij doet. */
    h += '<p class="iw-uitleg">Je kunt alsnog iteraties maken — het is jouw budget en soms wil je ' +
      'een tweede meting. Maar verwacht niet dat het lek daarmee dicht is.</p>';
  }
  if (wt.varieer && wt.varieer.length) {
    h += '<p class="iw-uitleg">Voorgestelde testdimensies: <b>' + iwEsc(wt.varieer.join(', ')) + '</b>. ' +
      'Die worden hieronder aangevinkt; je kunt ze aanpassen.</p>';
  }
  return h;
}

/* ── Tekenen: vijf stappen ─────────────────────────────────────────────── */

/* De stappen staan hier één keer opgeschreven. Een stappenbalk die de nummers
   zelf telt en een scherm dat er los van beslist welke stap actief is lopen na
   twee wijzigingen uit elkaar -- dan wijst de balk stap 3 aan terwijl je naar
   stap 2 kijkt. */
var IW_STAPPEN = [
  { nr: 1, label: 'Advertentie' },
  { nr: 2, label: 'Analyse' },
  { nr: 3, label: 'Strategie' },
  { nr: 4, label: 'Iteraties' },
  { nr: 5, label: 'Resultaat' }
];

function iwStapperHtml() {
  var h = '<div class="iw-stapper">';
  IW_STAPPEN.forEach(function (s, i) {
    var af = s.nr < _iw.stap && (s.nr === 1 || _iw.gekozen || _iw.handmatig);
    var nu = s.nr === _iw.stap;
    if (i) h += '<span class="iw-stapper-lijn' + (af ? ' af' : '') + '"></span>';
    /* Terug mag, vooruit niet: stap 3 zonder gekozen advertentie is een leeg
       scherm met een balk erboven die zegt dat je er bent. */
    h += '<button type="button" class="iw-stapper-stap' + (af ? ' af' : '') + (nu ? ' nu' : '') + '"' +
      (af ? ' data-action="iw-stap" data-id="' + s.nr + '"' : ' disabled') + '>' +
      '<span class="iw-stapper-bol">' + (af ? '✓' : s.nr) + '</span>' +
      '<span class="iw-stapper-label">' + iwEsc(s.label) + '</span></button>';
  });
  return h + '</div>';
}

/* ── Stap 1: welke advertentie ─────────────────────────────────────────── */

/* De ingangen naar dezelfde lijst. Elk zegt wat hij selecteert, want "winnende
   advertenties" is geen eigenschap van een advertentie maar een keuze die
   iemand gemaakt heeft, en welke keuze dat is hoort op de kaart te staan. */
var IW_PRESETS = [
  { id: 'winnaars', label: 'Winnende advertenties', zegt: 'Hoogste ROAS',
    let_op: 'Alleen advertenties met bestellingen: een ROAS uit nul bestellingen is geen ROAS.' },
  { id: 'spend', label: 'Voldoende spend', zegt: 'Meer dan € 100 uitgegeven',
    let_op: 'Genoeg budget gezien om iets te betekenen. Zegt niets over de uitslag.' },
  { id: 'dalend', label: 'Dalende prestaties', zegt: 'ROAS onder de vorige periode',
    trend: true, let_op: 'Vergelijkt dit venster met het venster ervoor. Zonder vorige periode geen oordeel.' },
  { id: 'recent', label: 'Recente advertenties', zegt: 'Alles in dit venster',
    let_op: 'De hele lijst, op uitgaven gesorteerd.' },
  { id: 'bewaard', label: 'Opgeslagen advertenties', zegt: 'Handmatig bewaard',
    let_op: 'Wat je zelf met het sterretje bewaarde. Staat in deze browser, niet bij het team.' }
];

var IW_BEWAARD_SLEUTEL = 'wg-iw-bewaard';

function iwBewaard() {
  try {
    var w = JSON.parse(localStorage.getItem(IW_BEWAARD_SLEUTEL) || '[]');
    return Array.isArray(w) ? w.map(String) : [];
  } catch (e) { return []; }
}

function iwBewaarToggle(id) {
  var w = iwBewaard();
  var i = w.indexOf(String(id));
  if (i === -1) w.push(String(id)); else w.splice(i, 1);
  try { localStorage.setItem(IW_BEWAARD_SLEUTEL, JSON.stringify(w)); } catch (e) { }
  return w;
}

/* Welke advertenties bij een ingang horen, en in welke volgorde. Apart van het
   tekenen, want dit is de plek waar een filter stil het verkeerde antwoord kan
   geven: een lege lijst leest als "er is er geen die daalt" terwijl het
   betekent dat we het niet gemeten hebben. */
function iwFilter(lijst, preset, bewaard) {
  var l = (lijst || []).slice();
  if (preset === 'winnaars') {
    return l.filter(function (a) { return a.cijfers && a.cijfers.roas !== null && (a.cijfers.aankopen || 0) > 0; })
            .sort(function (a, b) { return b.cijfers.roas - a.cijfers.roas; });
  }
  if (preset === 'spend') {
    return l.filter(function (a) { return a.cijfers && (a.cijfers.spend || 0) >= 100; });
  }
  if (preset === 'dalend') {
    /* Geen trend is geen daling. Een advertentie die vorige periode niet
       bestond hoort hier niet te staan, ook niet onderaan. */
    return l.filter(function (a) { return a.trend && a.trend.roas !== null && a.trend.roas < 1; })
            .sort(function (a, b) { return a.trend.roas - b.trend.roas; });
  }
  if (preset === 'bewaard') {
    var w = bewaard || [];
    return l.filter(function (a) { return w.indexOf(String(a.id)) !== -1; });
  }
  return l;
}

function iwPresetHtml() {
  var trendKan = _iw.trendBeschikbaar !== false;
  var h = '<div class="iw-sublabel">Of kies een recente advertentie</div><div class="iw-presets">';
  IW_PRESETS.forEach(function (p) {
    var kan = !p.trend || trendKan;
    h += '<button type="button" class="iw-preset' + (_iw.preset === p.id ? ' aan' : '') + '"' +
      (kan ? '' : ' disabled title="' + iwEsc(_iw.trendReden || 'niet beschikbaar bij deze bron') + '"') +
      ' data-action="iw-preset" data-id="' + p.id + '">' +
      '<span class="iw-preset-label">' + iwEsc(p.label) + '</span>' +
      '<span class="iw-preset-zegt">' + iwEsc(p.zegt) + '</span></button>';
  });
  return h + '</div>';
}

function iwBronkeuzeHtml() {
  if (!_iw.bronnen) {
    return '<p class="iw-uitleg">Verbind je advertentieaccount en kies een advertentie om te ' +
      'analyseren en te verbeteren.</p>' +
      '<button type="button" class="iw-knop" data-action="iw-bronnen"' + (_iw.bezig ? ' disabled' : '') + '>' +
      (_iw.bezig ? 'Bezig…' : 'Verbind advertentieaccount') + '</button>';
  }
  var h = '<div class="iw-rij">';
  _iw.bronnen.forEach(function (b) {
    h += '<button type="button" class="iw-keuze' + (_iw.bron === b.bron ? ' aan' : '') +
      '"' + (b.bruikbaar ? '' : ' disabled title="' + iwEsc(b.reden || '') + '"') +
      ' data-action="iw-bron" data-id="' + iwEsc(b.bron) + '">' + iwEsc(b.naam) + '</button>';
  });
  h += '</div>';
  /* Een bron die niet werkt zegt waarom. Een uitgegrijsde knop zonder reden
     stuurt iemand naar de worker terwijl het aan de sleutel ligt. */
  var stuk = _iw.bronnen.filter(function (b) { return !b.bruikbaar && b.reden; });
  if (stuk.length) {
    h += '<p class="iw-uitleg leeg">' + stuk.map(function (b) {
      return iwEsc(b.naam) + ': ' + iwEsc(b.reden);
    }).join('<br>') + '</p>';
  }
  var bron = _iw.bronnen.filter(function (b) { return b.bron === _iw.bron; })[0];
  if (bron && bron.accounts && bron.accounts.length > 1) {
    h += '<div class="iw-rij">';
    bron.accounts.forEach(function (a) {
      h += '<button type="button" class="iw-keuze klein' + (_iw.account === a.id ? ' aan' : '') +
        '" data-action="iw-account" data-id="' + iwEsc(a.id) + '">' + iwEsc(a.naam) + '</button>';
    });
    h += '</div>';
  }
  h += '<div class="iw-rij">';
  [7, 14, 30, 90].forEach(function (d) {
    h += '<button type="button" class="iw-keuze klein' + (_iw.dagen === d ? ' aan' : '') +
      '" data-action="iw-dagen" data-id="' + d + '">' + d + ' dagen</button>';
  });
  h += '<button type="button" class="iw-knop" data-action="iw-lijst"' + (_iw.bezig ? ' disabled' : '') + '>' +
    (_iw.bezig ? 'Bezig…' : 'Haal mijn advertenties op') + '</button>';
  h += '</div>';
  h += iwPresetHtml();
  h += iwLijstHtml();
  return h;
}

function iwLijstHtml() {
  if (!_iw.lijst) return '';
  var bewaard = iwBewaard();
  var lijst = iwFilter(_iw.lijst, _iw.preset, bewaard);
  if (!lijst.length) {
    /* Waarom hij leeg is, want leeg heeft hier drie verschillende betekenissen
       en alle drie leiden ze tot een ander volgend zetje. */
    var p = IW_PRESETS.filter(function (x) { return x.id === _iw.preset; })[0];
    var zin = !_iw.lijst.length
      ? 'Geen advertenties met uitgaven in dit venster.'
      : 'Geen advertentie voldoet aan “' + ((p && p.label) || _iw.preset) + '”. ' +
        'Er staan er wel ' + _iw.lijst.length + ' in dit venster — kies een andere ingang.';
    return '<p class="iw-uitleg leeg">' + iwEsc(zin) + '</p>';
  }
  var h = '<div class="iw-lijst">';
  lijst.forEach(function (ad) {
    /* Het echte nummer in de opgehaalde lijst, niet de plek in de gefilterde:
       die twee lopen uiteen zodra je een ingang kiest, en dan open je een
       andere advertentie dan je aanklikte. */
    var i = _iw.lijst.indexOf(ad);
    var bew = bewaard.indexOf(String(ad.id)) !== -1;
    h += '<div class="iw-adrij">';
    h += '<button type="button" class="iw-adkaart" data-action="iw-kies" data-i="' + i + '">' +
      '<span class="iw-adnaam">' + iwEsc(ad.naam) + '</span>' +
      '<span class="iw-adcijfers">' +
        iwGetal(ad.cijfers.spend, 'geld') + ' <span class="iw-punt">·</span> ' +
        'ROAS ' + iwGetal(ad.cijfers.roas, 'ratio') + ' <span class="iw-punt">·</span> ' +
        iwGetal(ad.cijfers.aankopen) + ' bestellingen' +
        (ad.trend && ad.trend.roas !== null
          ? ' <span class="iw-punt">·</span> <span class="iw-trend ' +
            (ad.trend.roas < 1 ? 'omlaag' : 'omhoog') + '">' +
            iwEsc(iwVerschilKort(ad.trend.roas)) + ' t.o.v. de vorige periode</span>'
          : '') +
      '</span></button>';
    h += '<button type="button" class="iw-ster' + (bew ? ' aan' : '') + '" ' +
      'title="' + (bew ? 'uit opgeslagen halen' : 'bewaren') + '" ' +
      'data-action="iw-bewaar" data-id="' + iwEsc(ad.id) + '">' + (bew ? '★' : '☆') + '</button>';
    h += '</div>';
  });
  return h + '</div>';
}

function iwVerschilKort(verhouding) {
  if (verhouding === null || verhouding === undefined) return '';
  var p = Math.round((verhouding - 1) * 100);
  if (p === 0) return 'gelijk';
  return (p > 0 ? '+' : '') + p + '%';
}

function iwStap1Html() {
  var h = '<h3 class="iw-titel">1. Kies de advertentie die je wilt itereren</h3>';
  h += '<p class="iw-onder">Selecteer een winnende of relevante advertentie uit het ' +
    'advertentieaccount, of upload er zelf een.</p>';
  h += '<div class="iw-kolommen">';

  h += '<section class="iw-kaart"><div class="iw-kaart-kop">' +
    '<span class="iw-kaart-titel">Uit advertentieaccount</span>' +
    (_iw.bron ? '<span class="iw-badge">' + iwEsc(_iw.bron === 'atria' ? 'Atria' : 'Meta') + '</span>' : '') +
    '</div>';
  h += iwBronkeuzeHtml();
  h += '</section>';

  h += '<section class="iw-kaart"><div class="iw-kaart-kop">' +
    '<span class="iw-kaart-titel">Handmatig uploaden</span></div>' +
    '<p class="iw-uitleg">Upload een afbeelding van de advertentie die je wilt itereren. ' +
    'De cijfers vul je dan zelf in — zonder cijfers is er geen funnel om tegen te meten.</p>' +
    '<button type="button" class="iw-dropzone" data-action="iw-upload">' +
    '<span class="iw-dropzone-icoon">⬆</span>' +
    '<span class="iw-dropzone-t">Klik om een bestand te kiezen</span>' +
    '<span class="iw-dropzone-s">JPG of PNG</span></button>' +
    '<p class="iw-uitleg leeg"><button type="button" class="iw-link" data-action="iw-handmatig">' +
    'Of vul alleen de cijfers met de hand in</button></p>';
  h += '</section>';

  h += '</div>';
  return h;
}

/* ── Stap 2: de analyse ────────────────────────────────────────────────── */

/* `state` is met let gedeclareerd en hangt dus NIET aan window. Een
   voorzichtige `window.state && state.x` leest daardoor altijd niets -- en dat
   is precies het soort voorzichtigheid dat een leeg scherm oplevert dat er
   werkend uitziet. Dit is de enige veilige vorm. */
function iwState() {
  return (typeof state !== 'undefined' && state) ? state : null;
}

/* De cijfers die op de kaart van de advertentie staan. Kort, want dit is de
   samenvatting; de volledige lijst staat eronder in de funnel. */
var IW_KAARTCIJFERS = [
  { sleutel: 'spend', label: 'Spend', soort: 'geld' },
  { sleutel: 'roas', label: 'ROAS', soort: 'ratio' },
  { sleutel: 'ctr', label: 'CTR', soort: 'procent' },
  { sleutel: 'cpa', label: 'CPA', soort: 'geld' },
  { sleutel: 'aankopen', label: 'Bestellingen' }
];

/* Een link naar de advertentie zoals hij bij de bron staat. Alleen bij Meta:
   daar bestaat een adres dat werkt. Bij Atria weet ik er geen, en een knop die
   nergens heen gaat is erger dan geen knop. */
function iwBronLink(ad) {
  if (!ad || _iw.bron !== 'meta' || !ad.id || !_iw.account) return null;
  return 'https://business.facebook.com/adsmanager/manage/ads?act=' +
    encodeURIComponent(String(_iw.account).replace(/^act_/, '')) +
    '&selected_ad_ids=' + encodeURIComponent(ad.id);
}

function iwAdkaartHtml() {
  var ad = _iw.gekozen;
  if (!ad) return '';
  var st = iwState();
  var beeld = (st && st.sourceAd)
    ? 'data:' + st.sourceAd.mimeType + ';base64,' + st.sourceAd.b64 : null;
  var h = '<section class="iw-kaart"><div class="iw-kaart-kop">' +
    '<span class="iw-kaart-titel">Geselecteerde advertentie</span></div>';
  h += '<div class="iw-adbeeld">' + (beeld
    ? '<img src="' + iwEsc(beeld) + '" alt="">'
    : '<span class="iw-leeg">' + iwEsc(_iw.beeldFout || 'geen beeld bij deze advertentie') + '</span>') + '</div>';
  h += '<div class="iw-adtitel">' + iwEsc(ad.naam) + '</div>';
  h += '<div class="iw-adonder">' +
    iwEsc(_iw.bron === 'atria' ? 'Atria' : 'Meta Ads') + ' <span class="iw-punt">·</span> laatste ' +
    _iw.dagen + ' dagen' + (ad.staat ? ' <span class="iw-punt">·</span> ' + iwEsc(ad.staat) : '') + '</div>';

  h += '<div class="iw-kaartcijfers">';
  IW_KAARTCIJFERS.forEach(function (c) {
    var w = ad.cijfers ? ad.cijfers[c.sleutel] : null;
    /* Alleen wat gemeten is. Een tegel met een streepje vult de rij en zegt
       niets; hem weglaten zegt hetzelfde en leest beter. */
    if (w === null || w === undefined) return;
    h += '<div class="iw-tegel"><span class="iw-tegel-l">' + iwEsc(c.label) + '</span>' +
      '<span class="iw-tegel-w">' + iwEsc(iwGetal(w, c.soort)) + '</span></div>';
  });
  h += '</div>';

  var link = iwBronLink(ad);
  h += '<div class="iw-adacties">';
  h += '<button type="button" class="iw-link" data-action="iw-anders">andere advertentie</button>';
  if (link) h += '<a class="iw-knop klein" href="' + iwEsc(link) + '" target="_blank" rel="noopener">' +
    'Originele advertentie bekijken ↗</a>';
  h += '</div>';
  h += '</section>';
  return h;
}

/* De velden die Rory teruggeeft, in de volgorde waarin je ze leest. Wat hij
   niet ingevuld heeft komt niet op het scherm: een leeg veld is een uitslag,
   een gevuld veld dat verzonnen is ziet er precies zo uit als een gelezen. */
var IW_ANALYSEVELDEN = [
  { sleutel: 'archetype', label: 'Concept' },
  { sleutel: 'hook_mechaniek', label: 'Hook' },
  { sleutel: 'persona', label: 'Persona' },
  { sleutel: 'compositie', label: 'Visueel concept' },
  { sleutel: 'angle', label: 'Angle' },
  { sleutel: 'bewijs', label: 'Bewijs / proof' },
  { sleutel: 'funnel', label: 'Funnel stage' },
  { sleutel: 'offer', label: 'Offer' },
  { sleutel: 'hoofdpersoon', label: 'Hoofdpersoon' },
  { sleutel: 'cta_aanpak', label: 'CTA' },
  { sleutel: 'narratief_perspectief', label: 'Narratief perspectief' },
  { sleutel: 'format_mode', label: 'Format' }
];

function iwAnalyseHtml() {
  var st = iwState();
  var a = (st && st.iterateAnalysis) || null;
  var h = '<section class="iw-kaart breed"><div class="iw-kaart-kop">' +
    '<span class="iw-kaart-titel">Rory’s analyse</span></div>';
  if (_iw.analyseBezig) {
    h += '<div class="iw-bezig">Rory analyseert deze advertentie…<span class="iw-bezig-s">' +
      'Dit duurt meestal 20 tot 30 seconden.</span></div>';
  } else if (_iw.analyseFout) {
    h += '<div class="iw-fout"><b>De analyse liep vast.</b><br>' + iwEsc(_iw.analyseFout) + '</div>' +
      '<button type="button" class="iw-knop" data-action="iw-analyse">Opnieuw proberen</button>';
  } else if (!a) {
    h += '<p class="iw-uitleg">Rory leest de advertentie en de cijfers, en benoemt het concept, ' +
      'de hook, het publiek en de bewijsvorm.</p>' +
      '<button type="button" class="iw-knop" data-action="iw-analyse">Analyseer deze advertentie</button>';
  } else {
    h += '<div class="iw-velden">';
    IW_ANALYSEVELDEN.forEach(function (v) {
      var w = a[v.sleutel];
      if (!w) return;
      h += '<div class="iw-veld"><span class="iw-veld-l">' + iwEsc(v.label) + '</span>' +
        '<span class="iw-veld-w">' + iwEsc(String(w)) + '</span></div>';
    });
    h += '</div>';
    if (a.cijfer_diagnose || a.grootste_kans) {
      h += '<div class="iw-conclusie"><div class="iw-conclusie-k">Rory’s conclusie</div>';
      if (a.cijfer_diagnose) h += '<p>' + iwEsc(a.cijfer_diagnose) + '</p>';
      if (a.grootste_kans) h += '<p>' + iwEsc(a.grootste_kans) + '</p>';
      h += '</div>';
    }
    if (Array.isArray(a.vasthouden) && a.vasthouden.length) {
      h += '<div class="iw-sterk"><div class="iw-sterk-k">Wat blijft sterk</div><ul>' +
        a.vasthouden.map(function (x) { return '<li>' + iwEsc(String(x)) + '</li>'; }).join('') +
        '</ul></div>';
    }
  }
  return h + '</section>';
}

function iwStap2Html() {
  var h = '<h3 class="iw-titel">2. Wat is dit voor advertentie, en waar lekt hij</h3>';
  if (!_iw.gekozen) {
    /* De handmatige terugval: geen advertentie uit de bron, dus ook geen
       cijfers uit de bron. Het formulier eronder is dan de enige plek waar ze
       vandaan komen, en dat hoort er te staan in plaats van een lege kaart. */
    h += '<p class="iw-onder">Geen advertentie uit het account gekozen. Vul de cijfers hieronder ' +
      'met de hand in — zonder cijfers is er geen funnel om tegen te meten.</p>';
    h += '<div class="iw-voet"><button type="button" class="iw-knop groot" data-action="iw-stap" ' +
      'data-id="3">Ga verder naar strategie →</button></div>';
    return h;
  }
  h += '<div class="iw-kolommen smal-breed">';
  h += iwAdkaartHtml();
  h += iwAnalyseHtml();
  h += '</div>';
  if (_iw.diagnose) {
    h += '<section class="iw-kaart"><div class="iw-kaart-kop">' +
      '<span class="iw-kaart-titel">De funnel, gemeten tegen hetzelfde account</span></div>' +
      iwDiagnoseHtml() + '</section>';
  }
  h += '<div class="iw-voet"><button type="button" class="iw-knop groot" data-action="iw-stap" ' +
    'data-id="3">Ga verder naar strategie →</button></div>';
  return h;
}

function iwRender() {
  var el = document.getElementById('iw-paneel');
  if (!el) return;
  var h = iwStapperHtml();
  if (_iw.fout) h += '<div class="iw-fout"><b>Dat lukte niet.</b><br>' + iwEsc(_iw.fout) + '</div>';
  if (_iw.stap === 1) h += iwStap1Html();
  else if (_iw.stap === 2) h += iwStap2Html();
  else h += '<p class="iw-uitleg">De instellingen en het werkblad staan hieronder.</p>';
  el.innerHTML = h;

  iwToonWerkblad();
  var oud = document.getElementById('iterate-handmatig');
  if (oud) oud.style.display = (_iw.handmatig && _iw.stap >= 2) ? 'block' : 'none';
}

/* Vanaf stap 3 neemt het bestaande werkblad het over: het uploadvak, de
   testdimensies, de richting en het genereren. Die werkten al en veranderen
   hier niet -- wat verandert is dat ze pas in beeld komen als de advertentie
   gekozen en gelezen is. Ze stonden er allemaal meteen onder, en dan begin je
   aan het onderste eind van het scherm.

   Alleen op het itereerscherm. Kopieer ad deelt deze blokken en heeft ze vanaf
   het begin nodig; ze daar verbergen zou dat scherm slopen. */
var IW_WERKBLADEN = ['iterate-werkblad', 'source-ad-section', 'classic-form'];

function iwToonWerkblad() {
  var itereert = document.body && document.body.classList.contains('iterate-mode-active');
  IW_WERKBLADEN.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    /* Buiten het itereerscherm bepaalt dit niets: dan gaat de eigen stand van
       het element weer gelden. */
    el.style.display = itereert ? (_iw.stap >= 3 ? 'block' : 'none') : '';
  });
}

/* De testdimensies die uit de diagnose volgen alvast aanvinken. Ze blijven te
   wijzigen: dit is een voorstel op grond van de cijfers, geen slot. */
function iwZetDimensies() {
  var wt = _iw.diagnose && _iw.diagnose.wat_testen;
  if (!wt || !wt.varieer || !wt.varieer.length) return;
  document.querySelectorAll('input[name="iterate-vary"]').forEach(function (cb) {
    cb.checked = wt.varieer.indexOf(cb.value) !== -1;
  });
}

/* Rory leest de advertentie. Het werk zelf zat er al -- analyzeWinningAd
   bestaat en werkt -- dus dit zet er alleen de stand omheen die de wizard
   nodig heeft: bezig, mislukt, of klaar. Wat er misging komt op het scherm en
   niet alleen in de console. */
async function iwAnalyse() {
  if (_iw.analyseBezig) return;
  if (typeof analyzeWinningAd !== 'function') {
    _iw.analyseFout = 'De analyse is niet geladen.'; return iwRender();
  }
  /* Rory leest het beeld én de cijfers. Zonder beeld weigert de analyse, en
     dat gebeurde met een toast die je een seconde later kwijt bent. Waarom er
     geen beeld is staat al op de kaart; hier staat wat je eraan kunt doen. */
  var st0 = iwState();
  if (!st0 || !st0.sourceAd) {
    _iw.analyseFout = (_iw.beeldFout ? _iw.beeldFout + ' ' : '') +
      'Rory leest de advertentie zelf, dus zonder beeld kan hij niet lezen. ' +
      'Upload de creative met de hand in stap 1.';
    return iwRender();
  }
  _iw.analyseBezig = true; _iw.analyseFout = null; iwRender();
  var st = iwState();
  var voor = (st && st.iterateAnalysis) || null;
  try {
    await analyzeWinningAd();
    st = iwState();
    var na = (st && st.iterateAnalysis) || null;
    /* Geen nieuwe analyse is een mislukking, ook als er geen fout gegooid is.
       De oude analyse laten staan alsof hij vers is, is het soort stilte dat
       je op een verkeerd plan zet. */
    if (!na || na === voor) _iw.analyseFout = 'Er kwam geen analyse terug.';
  } catch (e) {
    _iw.analyseFout = String((e && e.message) || e);
  }
  _iw.analyseBezig = false; iwRender();
}

function iwKlik(e) {
  var knop = e.target.closest ? e.target.closest('[data-action]') : null;
  if (!knop) return;
  var act = knop.getAttribute('data-action');
  if (act === 'iw-bronnen') iwHaalBronnen();
  else if (act === 'iw-stap') {
    var n = Number(knop.getAttribute('data-id'));
    /* Vooruit alleen als er een advertentie ligt. Stap 3 zonder gekozen
       advertentie is een werkblad zonder cijfers, en dat is precies het
       formulier waar dit vanaf moest. */
    if (n > 1 && !_iw.gekozen && !_iw.handmatig) return;
    _iw.stap = n; iwRender();
  }
  else if (act === 'iw-preset') { _iw.preset = knop.getAttribute('data-id'); iwRender(); }
  else if (act === 'iw-bewaar') { iwBewaarToggle(knop.getAttribute('data-id')); iwRender(); }
  else if (act === 'iw-analyse') iwAnalyse();
  else if (act === 'iw-upload') {
    /* De terugval: zelf een beeld aanleveren. Dan zijn er geen cijfers uit de
       bron, dus komt het handmatige formulier erbij -- niet in plaats van de
       koppeling maar omdat er anders niets te meten valt. */
    _iw.handmatig = true;
    var inp = document.getElementById('source-ad-input');
    if (inp) inp.click();
  }
  else if (act === 'iw-bron') {
    _iw.bron = knop.getAttribute('data-id');
    var b = _iw.bronnen.filter(function (x) { return x.bron === _iw.bron; })[0];
    _iw.account = (b && b.accounts && b.accounts[0]) ? b.accounts[0].id : null;
    _iw.lijst = null; iwRender();
  } else if (act === 'iw-account') { _iw.account = knop.getAttribute('data-id'); _iw.lijst = null; iwRender(); }
  else if (act === 'iw-dagen') { _iw.dagen = Number(knop.getAttribute('data-id')); _iw.lijst = null; iwRender(); }
  else if (act === 'iw-lijst') iwHaalLijst();
  else if (act === 'iw-kies') {
    iwKies(Number(knop.getAttribute('data-i'))).then(iwZetDimensies);
  } else if (act === 'iw-anders') {
    _iw.gekozen = null; _iw.diagnose = null; _iw.stap = 1; iwRender();
  }
  else if (act === 'iw-handmatig') { _iw.handmatig = true; _iw.stap = 2; iwRender(); }
  else if (act === 'iw-koppeling') { _iw.handmatig = false; _iw.stap = 1; iwRender(); }
}

/* Wat er naar Theriot en naar de generatie gaat. Is er een advertentie
   gekozen, dan komen de cijfers daarvandaan en niet uit de invoervelden --
   anders zou je twee verschillende getallen in dezelfde prompt krijgen. */
function iwCijfertekst() {
  var ad = _iw.gekozen;
  if (!ad) return null;
  var regels = [];
  IW_KERNCIJFERS.forEach(function (c) {
    var w = ad.cijfers[c.sleutel];
    if (w === null || w === undefined) return;
    regels.push(c.label + ': ' + iwGetal(w, c.soort));
  });
  var tekst = 'Advertentie: ' + ad.naam + '\nPeriode: laatste ' + _iw.dagen + ' dagen (' +
    (_iw.bron === 'atria' ? 'Atria' : 'Meta Ads') + ')\n\n' + regels.join('\n');

  var d = _iw.diagnose;
  if (d) {
    tekst += '\n\nDE FUNNEL, GEMETEN TEGEN HETZELFDE ACCOUNT OVER HETZELFDE VENSTER:';
    d.stappen.forEach(function (s) {
      if (!s.genoeg_data || s.verhouding === null) return;
      tekst += '\n- ' + s.label + ': ' + iwVerschil(s.verhouding) + ' (' + s.oordeel + ')';
    });
    if (d.knelpunt) {
      var wt = d.wat_testen || {};
      /* Waar het knelpunt zit staat op de STAP, niet op wat_testen. Dat is een
         verschil van een woord en het leverde letterlijk "HET KNELPUNT ZIT ."
         op in de prompt: een lege plek waar de plaats hoort te staan, in een
         zin die er verder overtuigend uitziet. */
      var knelStap = d.stappen.filter(function (s) { return s.sleutel === d.knelpunt; })[0] || {};
      tekst += '\n\nHET KNELPUNT ZIT ' + String(knelStap.zit || 'onbekend waar').toUpperCase() + '. ' + (wt.zeg || '');
      if (knelStap.ligt_aan) tekst += '\nDat ligt meestal aan ' + knelStap.ligt_aan + '.';
      if (wt.creative === false) {
        tekst += '\nLET OP: dit lek zit na de klik. Een nieuwe creative lost het niet op. ' +
          'Zeg dat, en maak geen iteraties die doen alsof het wel zo is.';
      }
    } else {
      tekst += '\n\nEr is geen lek gevonden: ' + d.reden + '.';
    }
  }
  return { adName: ad.naam, period: 'laatste ' + _iw.dagen + ' dagen', text: tekst };
}

function renderItereerWizard() {
  var el = document.getElementById('iw-paneel');
  if (el && !el._iwGebonden) { el.addEventListener('click', iwKlik); el._iwGebonden = true; }
  iwRender();
}

window.renderItereerWizard = renderItereerWizard;
window.iwRender = iwRender; window.iwCijfertekst = iwCijfertekst;
window.iwHaalBronnen = iwHaalBronnen; window.iwHaalLijst = iwHaalLijst; window.iwKies = iwKies;
window.iwDiagnoseHtml = iwDiagnoseHtml; window.iwTrapHtml = iwTrapHtml;
window.iwGetal = iwGetal; window.iwVerschil = iwVerschil; window.iwZetDimensies = iwZetDimensies;
window.IW_KERNCIJFERS = IW_KERNCIJFERS; window._iw = _iw;
window.IW_STAPPEN = IW_STAPPEN; window.IW_PRESETS = IW_PRESETS;
window.IW_ANALYSEVELDEN = IW_ANALYSEVELDEN; window.IW_KAARTCIJFERS = IW_KAARTCIJFERS;
window.iwFilter = iwFilter; window.iwBewaard = iwBewaard; window.iwBewaarToggle = iwBewaarToggle;
window.iwStapperHtml = iwStapperHtml; window.iwStap1Html = iwStap1Html; window.iwStap2Html = iwStap2Html;
window.iwAnalyse = iwAnalyse; window.iwState = iwState;
window.iwToonWerkblad = iwToonWerkblad; window.IW_WERKBLADEN = IW_WERKBLADEN; window.iwBronLink = iwBronLink; window.iwVerschilKort = iwVerschilKort;
