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
  bezig: false, fout: null, handmatig: false, stap: 1
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
      '&account=' + encodeURIComponent(_iw.account) + '&dagen=' + _iw.dagen + '&limiet=25');
    _iw.lijst = uit.advertenties || [];
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
    /* Het beeld van de advertentie wordt de bron-ad. Dat is de hele reden dat
       dit sneller is dan het oude formulier: je hoeft de static die je zelf
       hebt gemaakt niet opnieuw te uploaden om erop te kunnen itereren. */
    await iwZetBronAd(_iw.gekozen);
  } catch (e) {
    _iw.fout = String((e && e.message) || e);
  }
  _iw.bezig = false; iwRender();
}

async function iwZetBronAd(ad) {
  if (!ad || !ad.beeld) return;
  try {
    var o = { headers: {} };
    if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
    var r = await fetch(iwBasis() + '/onderzoek/beeld?u=' + encodeURIComponent(ad.beeld), o);
    if (!r.ok) return;
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
  } catch (e) { /* geen beeld is vervelend, geen cijfers is fataal en die hebben we */ }
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

/* ── Tekenen ───────────────────────────────────────────────────────────── */

function iwBronkeuzeHtml() {
  if (_iw.handmatig) {
    return '<p class="iw-uitleg">Je vult de cijfers met de hand in. ' +
      '<button type="button" class="iw-link" data-action="iw-koppeling">Terug naar de koppeling</button></p>';
  }
  if (!_iw.bronnen) {
    return '<p class="iw-uitleg">Haal je draaiende advertenties op uit Atria of Meta, ' +
      'dan hoef je de cijfers niet over te tikken.</p>' +
      '<button type="button" class="iw-knop" data-action="iw-bronnen"' + (_iw.bezig ? ' disabled' : '') + '>' +
      (_iw.bezig ? 'Bezig…' : 'Verbind met je advertentieaccount') + '</button> ' +
      '<button type="button" class="iw-link" data-action="iw-handmatig">of vul het met de hand in</button>';
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
  if (_iw.lijst) {
    if (!_iw.lijst.length) {
      h += '<p class="iw-uitleg">Geen advertenties met uitgaven in dit venster.</p>';
    } else {
      h += '<div class="iw-lijst">';
      _iw.lijst.forEach(function (ad, i) {
        h += '<button type="button" class="iw-adkaart" data-action="iw-kies" data-i="' + i + '">' +
          '<span class="iw-adnaam">' + iwEsc(ad.naam) + '</span>' +
          '<span class="iw-adcijfers">' +
            iwGetal(ad.cijfers.spend, 'geld') + ' <span class="iw-punt">·</span> ' +
            'ROAS ' + iwGetal(ad.cijfers.roas, 'ratio') + ' <span class="iw-punt">·</span> ' +
            iwGetal(ad.cijfers.aankopen) + ' bestellingen' +
          '</span></button>';
      });
      h += '</div>';
    }
  }
  h += '<p class="iw-uitleg leeg"><button type="button" class="iw-link" data-action="iw-handmatig">' +
    'Of vul de cijfers met de hand in</button></p>';
  return h;
}

function iwGekozenHtml() {
  var ad = _iw.gekozen;
  if (!ad) return '';
  var h = '<div class="iw-gekozen">';
  h += '<div class="iw-gekozen-kop"><b>' + iwEsc(ad.naam) + '</b>' +
    '<button type="button" class="iw-link" data-action="iw-anders">andere advertentie</button></div>';
  h += '<div class="iw-cijfers">';
  IW_KERNCIJFERS.forEach(function (c) {
    var w = ad.cijfers[c.sleutel];
    /* Alleen wat gemeten is. Een rij met een streepje vult de tabel en zegt
       niets; hem weglaten zegt hetzelfde en leest beter. */
    if (w === null || w === undefined) return;
    h += '<div class="iw-cijfer"><span class="iw-cijfer-label">' + iwEsc(c.label) + '</span>' +
      '<span class="iw-cijfer-waarde">' + iwEsc(iwGetal(w, c.soort)) + '</span></div>';
  });
  h += '</div></div>';
  return h;
}

function iwRender() {
  var el = document.getElementById('iw-paneel');
  if (!el) return;
  var h = '';
  if (_iw.fout) h += '<div class="iw-fout"><b>Dat lukte niet.</b><br>' + iwEsc(_iw.fout) + '</div>';

  h += '<div class="iw-blok"><div class="iw-stapkop"><span class="iw-nr">1</span> Welke advertentie itereren we</div>';
  h += _iw.gekozen ? iwGekozenHtml() : iwBronkeuzeHtml();
  h += '</div>';

  if (_iw.gekozen) {
    h += '<div class="iw-blok"><div class="iw-stapkop"><span class="iw-nr">2</span> Waar lekt hij</div>';
    h += iwDiagnoseHtml();
    h += '</div>';
  }
  el.innerHTML = h;

  /* Het oude formulier blijft bestaan als terugval, maar het staat alleen in
     beeld als je er zelf voor kiest. Twee invoerwegen tegelijk tonen is hoe je
     twee verschillende cijfers in dezelfde prompt krijgt. */
  var oud = document.getElementById('iterate-handmatig');
  if (oud) oud.style.display = _iw.handmatig ? 'block' : 'none';
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

function iwKlik(e) {
  var knop = e.target.closest ? e.target.closest('[data-action]') : null;
  if (!knop) return;
  var act = knop.getAttribute('data-action');
  if (act === 'iw-bronnen') iwHaalBronnen();
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
  } else if (act === 'iw-anders') { _iw.gekozen = null; _iw.diagnose = null; iwRender(); }
  else if (act === 'iw-handmatig') { _iw.handmatig = true; iwRender(); }
  else if (act === 'iw-koppeling') { _iw.handmatig = false; iwRender(); }
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
