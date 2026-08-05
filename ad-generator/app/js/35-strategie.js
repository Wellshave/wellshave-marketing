/* ═══════════════════════════════════════════════════════════════════════════
   Creative Strategy — de tabel en het dossier

   Beslisvraag (opgeschreven vóór deze regel code):

       "Welke test vraagt nu om een beslissing, en waar rust die op?"

   Twee dingen bepalen de vorm.

   1. Tien kolommen, niet vierentwintig. Alles tegelijk tonen is niet
      vollediger maar onleesbaar: bij honderd rijen scan je op één ding
      tegelijk, en een kolom die je nooit gebruikt kost elke keer aandacht.
      De rest staat achter de kolomkiezer, en de keuze blijft bewaard.

   2. Status is geen kleurtje maar een groep. Concept, wacht op jou, klaar voor
      test, live, uitgesproken oordeel, gestopt — dat zijn zes verschillende
      dingen die je doet, en niet zes tinten van hetzelfde. De groep komt uit
      de fase in de database (0030), niet uit een lijstje hier: twee waarheden
      over status is precies wat we niet wilden.

   Beoordeelbaarheid staat er als afgeleid feit en is nergens instelbaar. Hij
   komt uit creative_results, waar 0008 hem uitrekent uit de metingen.

   Dit bestand schrijft niets. Alle wijzigingen lopen via de functies uit 0030.
   ═══════════════════════════════════════════════════════════════════════════ */

var _str = {
  rijen: null, fout: null, laden: false, geladen: false,
  dossier: null, dossierLaden: false,
  zoek: '', sorteer: 'created_at', omgekeerd: true,
  filters: {}, selectie: {}, kolomkiezer: false, alleenWacht: false,
  kolommen: null
};

function strEsc(t) { return escapeHtml(t == null ? '' : String(t)); }
function strSb() { return (window._sb && window._authProfile && window._authProfile.id) ? window._sb : null; }

/* ── de kolommen ─────────────────────────────────────────────────────────── */

/* `standaard: true` is de tienkolommenset uit de opdracht: genoeg om te
   beslissen, niet meer. De rest is beschikbaar maar staat uit. */
var STR_KOLOMMEN = [
  { id: 'preview',      naam: 'Preview',        standaard: true,  soort: 'beeld' },
  { id: 'ad_name',      naam: 'Ad name',        standaard: true },
  { id: 'product',      naam: 'Product',        standaard: true },
  { id: 'persona',      naam: 'Persona',        standaard: true },
  { id: 'marketing_angle', naam: 'Angle',       standaard: true },
  { id: 'format',       naam: 'Format',         standaard: true },
  { id: 'status',       naam: 'Status',         standaard: true,  soort: 'status' },
  { id: 'verantwoordelijke', naam: 'Wie',       standaard: true,  soort: 'wie' },
  { id: 'created_at',   naam: 'Aangemaakt',     standaard: true,  soort: 'datum' },
  { id: 'volgende_stap', naam: 'Volgende stap', standaard: true },

  { id: 'brand',                naam: 'Merk' },
  { id: 'awareness_level',      naam: 'Awareness' },
  { id: 'funnel_stage',         naam: 'Funnel' },
  { id: 'sophistication_naam',  naam: 'Sophistication' },
  { id: 'angle_type',           naam: 'Angle type' },
  { id: 'media_type',           naam: 'Media type' },
  { id: 'channel',              naam: 'Kanaal' },
  { id: 'hypothesis',           naam: 'Hypothese' },
  { id: 'test_variable',        naam: 'Testvariabele' },
  { id: 'onderbouwing',         naam: 'Onderbouwing' },
  { id: 'date_live',            naam: 'Live sinds', soort: 'datum' },
  { id: 'resultaat',            naam: 'Resultaat',  soort: 'resultaat' },
  { id: 'roas',                 naam: 'ROAS',   soort: 'getal' },
  { id: 'ctr',                  naam: 'CTR',    soort: 'getal' },
  { id: 'verdict',              naam: 'Verdict',    soort: 'verdict' },
  { id: 'learning_kern',        naam: 'Learning',   soort: 'learning' },
  { id: 'next_step',            naam: 'Vervolg' }
];

function strActieveKolommen() {
  if (_str.kolommen) return _str.kolommen;
  var bewaard = null;
  try { bewaard = JSON.parse(localStorage.getItem('str_kolommen_v1') || 'null'); } catch (e) {}
  _str.kolommen = (bewaard && bewaard.length)
    ? bewaard
    : STR_KOLOMMEN.filter(function (k) { return k.standaard; }).map(function (k) { return k.id; });
  return _str.kolommen;
}
function strKolomAan(id) {
  var l = strActieveKolommen().slice();
  var i = l.indexOf(id);
  if (i > -1) l.splice(i, 1); else l.push(id);
  _str.kolommen = l;
  try { localStorage.setItem('str_kolommen_v1', JSON.stringify(l)); } catch (e) {}
  strTeken();
}
function strKolomkiezer() { _str.kolomkiezer = !_str.kolomkiezer; strTeken(); }
function strKolommenTerug() {
  _str.kolommen = STR_KOLOMMEN.filter(function (k) { return k.standaard; }).map(function (k) { return k.id; });
  try { localStorage.setItem('str_kolommen_v1', JSON.stringify(_str.kolommen)); } catch (e) {}
  strTeken();
}

/* ── twee blikken op dezelfde rijen ──────────────────────────────────────── */

/* De bestaande tabel blijft staan en blijft doen wat hij deed: cijfers en
   status met de hand bijwerken. Dit is er een tweede vraag naast, geen
   vervanging — beide lezen public.creatives, dus er is één waarheid. */
function strWeergave() {
  try { return localStorage.getItem('str_weergave_v1') || 'tests'; } catch (e) { return 'tests'; }
}
function strWissel(v) {
  try { localStorage.setItem('str_weergave_v1', v); } catch (e) {}
  strWisselTeken();
}
function strWisselTeken() {
  var w = strWeergave();
  var knoppen = document.getElementById('str-wissel');
  var mount = document.getElementById('str-mount');
  var klassiek = document.getElementById('cs-klassiek');
  if (knoppen) {
    knoppen.innerHTML =
      '<button class="str-knop' + (w === 'tests' ? ' str-knop--aan' : '') + '"'
      + ' onclick="strWissel(\'tests\')">Tests en dossier</button>'
      + '<button class="str-knop' + (w === 'tabel' ? ' str-knop--aan' : '') + '"'
      + ' onclick="strWissel(\'tabel\')">Bewerken (cijfers en status)</button>';
  }
  if (mount) mount.style.display = (w === 'tests') ? '' : 'none';
  if (klassiek) klassiek.style.display = (w === 'tests') ? 'none' : '';
  if (w === 'tests') renderStrategie();
}

/* ── ophalen ─────────────────────────────────────────────────────────────── */

function renderStrategie() {
  var sb = strSb();
  var mount = document.getElementById('str-mount');
  if (!mount) return;
  if (!sb) {
    mount.innerHTML = strKop() + strLeeg('Log in om de tests te zien.',
      ['De tabel leest mee met wie er kijkt. Zonder inloggen is er niets te tonen.']) + '</div>';
    return;
  }
  if (_str.geladen) { strTeken(); return; }
  _str.laden = true; strTeken();

  /* De hele testkaart in één keer. Bij honderden rijen is dat nog steeds één
     verzoek; filteren en sorteren gebeurt hier, zodat een filterwissel niet
     opnieuw over de lijn hoeft. Loopt het richting duizenden, dan verhuist het
     filteren naar de database — dat is een verandering in deze functie en
     nergens anders. */
  sb.from('hq_testkaart').select('*').limit(2000)
    .then(function (r) {
      _str.laden = false; _str.geladen = true;
      if (r && r.error) { _str.fout = r.error.message; _str.rijen = null; }
      else { _str.rijen = (r && r.data) || []; }
      strTeken();
    })
    .catch(function (e) {
      _str.laden = false; _str.geladen = true;
      _str.fout = (e && e.message) || String(e); strTeken();
    });
}
function strVernieuw() { _str.geladen = false; _str.rijen = null; _str.fout = null; renderStrategie(); }

/* ── filteren, zoeken, sorteren ──────────────────────────────────────────── */

var STR_FILTERS = [
  { id: 'product', naam: 'Product' }, { id: 'persona', naam: 'Persona' },
  { id: 'marketing_angle', naam: 'Angle' }, { id: 'status', naam: 'Status' },
  { id: 'format', naam: 'Format' }, { id: 'verantwoordelijke', naam: 'Wie' }
];

function strZet(veld, waarde) { _str.filters[veld] = waarde || ''; strTeken(); }
function strZoek(v) { _str.zoek = String(v || '').toLowerCase(); strTeken(); }
function strSorteer(id) {
  if (_str.sorteer === id) _str.omgekeerd = !_str.omgekeerd;
  else { _str.sorteer = id; _str.omgekeerd = false; }
  strTeken();
}
function strFiltersLeeg() { _str.filters = {}; _str.zoek = ''; _str.alleenWacht = false; strTeken(); }

function strZichtbaar() {
  var rijen = (_str.rijen || []).slice();
  Object.keys(_str.filters).forEach(function (v) {
    var w = _str.filters[v];
    if (w) rijen = rijen.filter(function (r) { return String(r[v] || '') === w; });
  });
  if (_str.alleenWacht) rijen = rijen.filter(strMensNodig);
  if (_str.zoek) {
    rijen = rijen.filter(function (r) {
      return ['ad_name', 'product', 'persona', 'marketing_angle', 'hypothesis', 'test_variable', 'headline']
        .some(function (k) { return String(r[k] || '').toLowerCase().indexOf(_str.zoek) > -1; });
    });
  }
  var s = _str.sorteer;
  rijen.sort(function (a, b) {
    var x = a[s], y = b[s];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y), 'nl');
  });
  if (_str.omgekeerd) rijen.reverse();
  return rijen;
}

/* ── de statusgroep ──────────────────────────────────────────────────────── */

/* Zes groepen die je verschillend behandelt. De fase komt uit de database, de
   vertaling naar "wacht op jou" gebeurt hier omdat het over jou gaat en niet
   over de rij. */
/* De verdicts van de agents in gewone taal. Het Engelse woord uit
   meta_recommendations zegt niets tegen wie de tabel leest. */
var STR_VERDICT = { winner: 'winnaar', loser: 'verliezer', test: 'blijf testen',
                    onvoldoende_data: 'te weinig data' };

/* Wacht dit op een mens? De statustabel weet het: daar staat wie er aan zet is.
   Niet hier nog een keer opsommen — dat zou een tweede waarheid zijn. */
function strMensNodig(r) {
  return ['jij', 'de maker', 'een mens'].indexOf(String(r.verantwoordelijke || '')) > -1;
}

function strGroep(r) {
  if (r.status === 'Gestopt') return { id: 'gestopt', naam: 'gestopt' };
  if (['Winner', 'Verliezer', 'Middelmatig', 'Itereren'].indexOf(r.status) > -1)
    return { id: 'oordeel', naam: r.status === 'Winner' ? 'winnaar'
                                : r.status === 'Verliezer' ? 'verliezer' : 'beoordeeld' };
  if (r.status === 'Live') return { id: 'live', naam: 'live' };
  if (r.status === 'Klaar voor publicatie') return { id: 'wacht', naam: 'wacht op jou' };
  if (r.status === 'Goedgekeurd voor test') return { id: 'klaar', naam: 'klaar voor test' };
  if (r.status === 'Klaar voor review') return { id: 'wacht', naam: 'wacht op een oordeel' };
  return { id: 'concept', naam: 'concept' };
}

/* ── tekenen ─────────────────────────────────────────────────────────────── */

function strKop() {
  return '<div class="str">'
    + '<h2 class="str-vraag">Welke test vraagt nu om een beslissing?</h2>';
}
function strLeeg(kop, alineas) {
  var h = '<div class="str-leeg"><div class="str-leeg-kop">' + strEsc(kop) + '</div>';
  (alineas || []).forEach(function (p) { h += '<p>' + p + '</p>'; });
  return h + '</div>';
}

function strCel(r, k) {
  var w = r[k.id];
  if (k.soort === 'beeld') {
    return r.heeft_beeld
      ? '<span class="str-thumb" title="beeld aanwezig">●</span>'
      : '<span class="str-thumb str-thumb--leeg" title="nog geen beeld">○</span>';
  }
  if (k.soort === 'status') {
    var g = strGroep(r);
    return '<span class="str-status str-status--' + g.id + '">' + strEsc(g.naam) + '</span>';
  }
  /* Wie er aan zet is komt uit de statustabel. Staat daar "jij" of "de maker",
     dan wacht het op een mens, en dat mag niet alleen in een kleur zitten:
     het staat er met een woord bij. */
  if (k.soort === 'wie') {
    if (!w) return '<span class="str-leeg-cel">—</span>';
    return strMensNodig(r)
      ? '<span class="str-jij">jij bent aan zet</span>'
      : strEsc(w);
  }
  /* Resultaat is één regel uit de meting en nooit iets dat je zelf invult.
     Staat er niets, dan is er niets gemeten — dat is een uitkomst. */
  if (k.soort === 'resultaat') {
    if (r.roas == null && r.ctr == null) {
      return '<span class="str-leeg-cel">' + (r.date_live ? 'nog niets gemeten' : 'niet live') + '</span>';
    }
    /* Nederlandse notatie, net als de rest van de tabel: een punt als
       decimaalteken leest hier als duizendtal. */
    var nl = function (x) { return Number(x).toLocaleString('nl-NL',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var d = [];
    if (r.roas != null) d.push('ROAS ' + nl(r.roas));
    if (r.ctr != null) d.push('CTR ' + nl(r.ctr) + '%');
    return strEsc(d.join(' · '));
  }
  if (k.soort === 'verdict') {
    if (!w) return '<span class="str-leeg-cel">geen oordeel</span>';
    return '<span class="str-verdict">' + strEsc(STR_VERDICT[w] || w) + '</span>';
  }
  /* Een learning die nog niet bevestigd is, is een voorstel. Dat verschil hoort
     zichtbaar te zijn, anders leest een aanname als vastgesteld feit. */
  if (k.soort === 'learning') {
    if (!w) return '<span class="str-leeg-cel">—</span>';
    return strEsc(String(w).length > 70 ? String(w).slice(0, 68) + '…' : w)
      + (r.learning_bevestigd ? '' : ' <em class="str-voorstel">(voorstel)</em>');
  }
  if (k.soort === 'datum') {
    if (!w) return '<span class="str-leeg-cel">—</span>';
    var d = new Date(w);
    return isNaN(d) ? strEsc(w) : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
  if (k.soort === 'getal') {
    return (w == null || w === '') ? '<span class="str-leeg-cel">—</span>'
      : Number(w).toLocaleString('nl-NL', { maximumFractionDigits: 2 });
  }
  if (w == null || String(w).trim() === '') return '<span class="str-leeg-cel">—</span>';
  /* Afkappen op 46 tekens is geen esthetiek maar de voorwaarde waaronder tien
     kolommen zonder horizontaal schuiven passen. De hele tekst staat in het
     dossier, één klik verderop. */
  return '<span title="' + strEsc(w) + '">'
    + strEsc(String(w).length > 46 ? String(w).slice(0, 44) + '…' : w) + '</span>';
}

function strTeken() {
  var mount = document.getElementById('str-mount');
  if (!mount) return;
  if (_str.laden) { mount.innerHTML = strKop() + '<div class="loading-card">De tests laden...</div></div>'; return; }
  if (_str.fout) {
    mount.innerHTML = strKop() + strLeeg('De tabel kon niet worden geladen.', [
      strEsc(_str.fout),
      'Staat migratie <code>0030_testklaar.sql</code> al in Supabase? Zonder die view bestaat '
      + '<code>hq_testkaart</code> niet.']) + '</div>';
    return;
  }
  var alle = _str.rijen || [];
  if (!alle.length) {
    mount.innerHTML = strKop() + strLeeg('Er staat nog geen test.', [
      'Een test ontstaat in de generator: maak een variant en klik op '
      + '<strong>Klaarzetten voor test</strong>. Dan komt hij hier binnen met zijn hypothese, '
      + 'zijn testvariabele en het werkstuk waar hij aan hangt.']) + '</div>';
    return;
  }

  var kol = STR_KOLOMMEN.filter(function (k) { return strActieveKolommen().indexOf(k.id) > -1; });
  var rijen = strZichtbaar();
  var gekozen = Object.keys(_str.selectie).filter(function (k) { return _str.selectie[k]; }).length;

  var h = strKop();

  h += '<div class="str-balk">'
    + '<input class="str-zoek" type="search" placeholder="Zoek in naam, hoek, hypothese..." '
    +   'value="' + strEsc(_str.zoek) + '" oninput="strZoek(this.value)">';
  STR_FILTERS.forEach(function (f) {
    var waarden = [...new Set(alle.map(function (r) { return r[f.id]; }).filter(Boolean))].sort();
    if (!waarden.length) return;
    h += '<select class="str-filter" onchange="strZet(\'' + f.id + '\', this.value)">'
      + '<option value="">' + strEsc(f.naam) + ': alle</option>'
      + waarden.map(function (w) {
          return '<option value="' + strEsc(w) + '"' + (_str.filters[f.id] === w ? ' selected' : '') + '>'
            + strEsc(w) + '</option>'; }).join('')
      + '</select>';
  });
  h += '<button class="str-knop" onclick="strKolomkiezer()">Kolommen (' + kol.length + ')</button>'
    +  '<button class="str-knop" onclick="strFiltersLeeg()">Filters leeg</button>'
    +  '</div>';

  if (_str.kolomkiezer) {
    h += '<div class="str-kiezer"><div class="str-kiezer-kop">Welke kolommen wil je zien?'
      +  '<button class="str-knop" onclick="strKolommenTerug()">Terug naar de standaard tien</button></div>'
      +  '<div class="str-kiezer-lijst">';
    STR_KOLOMMEN.forEach(function (k) {
      var aan = strActieveKolommen().indexOf(k.id) > -1;
      h += '<label class="str-vink"><input type="checkbox"' + (aan ? ' checked' : '')
        +  ' onchange="strKolomAan(\'' + k.id + '\')"> ' + strEsc(k.naam) + '</label>';
    });
    h += '</div><p class="str-kiezer-uitleg">Standaard staan er tien aan: genoeg om te beslissen. '
      +  'Alles tegelijk tonen is niet vollediger maar onleesbaar.</p></div>';
  }

  /* Het eerste wat je wilt weten is niet hoeveel er zijn, maar hoeveel er op
     jou liggen te wachten. Dat staat er dus vóór de tabel en niet als kleurtje
     in een cel — een tabel van honderd rijen scan je niet op tinten. */
  var wachtend = alle.filter(strMensNodig).length;
  if (wachtend) {
    h += '<div class="str-wacht' + (_str.alleenWacht ? ' str-wacht--aan' : '') + '">'
      +  '<strong>' + wachtend + (wachtend === 1 ? ' test wacht' : ' tests wachten') + ' op jou.</strong> '
      +  'Bij de rest is een agent of de meting aan zet. '
      +  '<button class="str-knop" onclick="strAlleenWacht()">'
      +  (_str.alleenWacht ? 'toon alles' : 'toon alleen deze') + '</button></div>';
  }

  h += '<p class="str-telling">' + rijen.length + ' van ' + alle.length + ' tests'
    + (gekozen ? ' · <strong>' + gekozen + '</strong> geselecteerd' : '')
    + ' · <a href="javascript:void(0)" onclick="strVernieuw()">vernieuwen</a></p>';

  h += '<div class="str-tabelwrap"><table class="str-tabel"><thead><tr><th class="str-vinkkolom"></th>';
  kol.forEach(function (k) {
    var pijl = _str.sorteer === k.id ? (_str.omgekeerd ? ' ▾' : ' ▴') : '';
    h += '<th><button class="str-sorteer" onclick="strSorteer(\'' + k.id + '\')">'
      + strEsc(k.naam) + pijl + '</button></th>';
  });
  h += '</tr></thead><tbody>';

  if (!rijen.length) {
    h += '<tr><td class="str-geen" colspan="' + (kol.length + 1) + '">'
      + 'Geen test voldoet aan deze filters. Dat is een uitkomst, geen fout — '
      + '<a href="javascript:void(0)" onclick="strFiltersLeeg()">zet de filters leeg</a>.</td></tr>';
  }
  rijen.forEach(function (r) {
    var g = strGroep(r);
    h += '<tr class="str-rij str-rij--' + g.id + (strMensNodig(r) ? ' str-rij--jij' : '')
      + '" onclick="strDossier(' + r.creative_id + ')">'
      + '<td class="str-vinkkolom" onclick="event.stopPropagation()">'
      +   '<input type="checkbox"' + (_str.selectie[r.creative_id] ? ' checked' : '')
      +   ' onchange="strKies(' + r.creative_id + ')" aria-label="selecteer"></td>';
    kol.forEach(function (k) { h += '<td>' + strCel(r, k) + '</td>'; });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  mount.innerHTML = h + '</div>';
}

function strKies(id) { _str.selectie[id] = !_str.selectie[id]; strTeken(); }
function strAlleenWacht() { _str.alleenWacht = !_str.alleenWacht; strTeken(); }

/* ── het dossier ─────────────────────────────────────────────────────────── */

function strDossierSluit() { _str.dossier = null; var o = document.getElementById('str-dos'); if (o) o.remove(); }

function strDossier(id) {
  var sb = strSb(); if (!sb) return;
  _str.dossierLaden = true;
  strDossierTeken({ _laden: true });
  sb.from('hq_creative_dossier').select('*').eq('creative_id', id).limit(1)
    .then(function (r) {
      _str.dossierLaden = false;
      if (r && r.error) { strDossierTeken({ _fout: r.error.message }); return; }
      var d = (r.data || [])[0];
      _str.dossier = d || null;
      strDossierTeken(d || { _fout: 'Dit dossier bestaat niet (meer).' });
    })
    .catch(function (e) { strDossierTeken({ _fout: (e && e.message) || String(e) }); });
}

function strSec(titel, inhoud, leeg) {
  return '<section class="str-sec"><h3>' + strEsc(titel) + '</h3>'
    + (inhoud ? inhoud : '<p class="str-sec-leeg">' + strEsc(leeg || 'Nog niets vastgelegd.') + '</p>')
    + '</section>';
}
function strPaar(label, waarde) {
  var leeg = waarde == null || String(waarde).trim() === '';
  return '<div class="str-paar' + (leeg ? ' str-paar--leeg' : '') + '">'
    + '<dt>' + strEsc(label) + '</dt><dd>' + (leeg ? 'niet vastgelegd' : strEsc(waarde)) + '</dd></div>';
}


/* Een lijst met een reden erbij als hij leeg is. Overal hetzelfde, want "leeg"
   is in dit dossier nooit hetzelfde als "niets aan de hand": het betekent
   ofwel nog niet gebeurd, ofwel niet vastgelegd, en dat verschil telt. */
function strLijst(regels) { return '<dl class="str-dl">' + regels.join('') + '</dl>'; }

function strDatum(w) {
  if (!w) return null;
  var d = new Date(w);
  return isNaN(d) ? String(w) : d.toLocaleDateString('nl-NL',
    { day: 'numeric', month: 'long', year: 'numeric' });
}
function strGetal(w, achter) {
  if (w == null || w === '') return null;
  return Number(w).toLocaleString('nl-NL', { maximumFractionDigits: 2 }) + (achter || '');
}

function strDossierTeken(d) {
  var oud = document.getElementById('str-dos'); if (oud) oud.remove();
  var o = document.createElement('div');
  o.id = 'str-dos'; o.className = 'str-dos-overlay';

  if (d._laden) {
    o.innerHTML = '<div class="str-dos"><div class="loading-card">Dossier laden...</div></div>';
  } else if (d._fout) {
    o.innerHTML = '<div class="str-dos"><div class="str-dos-kop"><strong>Dossier</strong>'
      + '<button class="str-x" onclick="strDossierSluit()">×</button></div>'
      + '<p class="str-sec-leeg">' + strEsc(d._fout) + '</p></div>';
  } else {
    var g = strGroep(d);
    var h = '<div class="str-dos"><div class="str-dos-kop"><strong>'
      + strEsc(d.ad_name || 'Nog geen naam') + '</strong>'
      + '<span class="str-status str-status--' + g.id + '">' + strEsc(g.naam) + '</span>'
      + (strMensNodig(d) ? '<span class="str-jij">jij bent aan zet</span>' : '')
      + '<button class="str-x" onclick="strDossierSluit()" aria-label="Sluiten">×</button></div>';

    h += strDosA(d) + strDosB(d) + strDosC(d) + strDosD(d) + strDosE(d) + strDosF(d);
    h += '</div>';
    o.innerHTML = h;
  }

  document.body.appendChild(o);
  o.addEventListener('click', function (e) { if (e.target === o) strDossierSluit(); });
}

/* ── 1. Testsamenvatting ─────────────────────────────────────────────────── */

function strDosA(d) {
  /* "Wat de test moet uitwijzen" is denkstukvraag 6 en geen nieuw veld: die
     vraag stond er al sinds 0023, en hem hier nog eens apart laten intypen zou
     twee antwoorden op dezelfde vraag opleveren. */
  var v6 = (d.denkstuk_regels || []).filter(function (r) { return r.vraag === 6; })[0];
  return strSec('1 · Testsamenvatting', strLijst([
    strPaar('Ad name', d.ad_name),
    strPaar('Status', d.status ? d.status + ' — ' + (d.status_betekenis || '') : null),
    strPaar('Product', d.product),
    strPaar('Persona', d.persona),
    strPaar('Marketingangle', d.marketing_angle),
    strPaar('Awarenessniveau', d.awareness_level),
    strPaar('Funnelstadium', d.funnel_stage),
    strPaar('Market sophistication', d.sophistication
      ? d.sophistication + ' · ' + (d.sophistication_naam || '')
        + (d.sophistication_bevestigd ? ' (bevestigd)' : ' (voorstel, nog niet bevestigd)')
      : null),
    strPaar('Hypothese', d.hypothesis),
    strPaar('Testvariabele', d.test_variable),
    strPaar('Wat de test moet uitwijzen', v6 ? v6.antwoord : null),
    strPaar('Verantwoordelijke', d.verantwoordelijke),
    strPaar('Volgende stap', d.volgende_stap)
  ]) + (d.niet_testklaar
    ? '<p class="str-blokkade">Deze creative is nog niet testklaar: ' + strEsc(d.niet_testklaar) + '</p>'
    : ''));
}

/* ── 2. Creative ─────────────────────────────────────────────────────────── */

function strDosB(d) {
  var refs = d.product_refs || [];
  return strSec('2 · Creative',
    (d.heeft_beeld
      ? '<p class="str-sec-noot">Er is een beeld gegenereerd. Het staat in de bibliotheek '
        + 'en wordt hier niet opnieuw geladen — dat zou het dossier traag maken.</p>'
      : '<p class="str-sec-leeg">Er is nog geen beeld gegenereerd.</p>')
    + strLijst([
      strPaar('Headline', d.headline),
      strPaar('Body copy', d.body_copy),
      strPaar('CTA', d.cta),
      strPaar('Format', d.format),
      strPaar('Plaatsing', d.placement),
      strPaar('Media type', d.media_type),
      strPaar('Kanaal', d.channel),
      strPaar('Visueel concept', d.visual_concept),
      strPaar('Image prompt', d.image_prompt),
      strPaar('Productreferenties', refs.length
        ? refs.map(function (r) { return typeof r === 'string' ? r : (r.naam || r.url || ''); }).join(', ')
        : null)
    ]));
}

/* ── 3. Strategische herkomst ────────────────────────────────────────────── */

function strDosC(d) {
  var iv = d.rory_interview || {};
  var regels = d.denkstuk_regels || [];
  var bronnen = d.bronnen || [];

  /* De zekerheid per antwoord is het hele punt van het denkstuk: wat is
     gemeten, wat is aangenomen, wat weten we niet. Die drie tellingen staan er
     als zin en niet als drie getallen, want een getal zonder woord eromheen
     leest als een score. */
  var stand = (d.onderbouwd || 0) + ' onderbouwd, ' + (d.aanname || 0) + ' aanname'
    + ((d.aanname || 0) === 1 ? '' : 's') + ', ' + (d.open_gelaten || 0) + ' open gelaten';

  return strSec('3 · Strategische herkomst',
    strLijst([
      strPaar('Oorspronkelijke menselijke ingeving', d.mens_ingeving),
      strPaar('Kernpijn', iv.kernpijn),
      strPaar('Echte vijand', iv.echte_vijand),
      strPaar('Kernbezwaar', iv.kernbezwaar),
      strPaar('Gewenste na-situatie', iv.na_situatie),
      strPaar('Rory reasoning', d.rory_reasoning),
      strPaar('Theriot-aanscherping', d.theriot_reasoning),
      strPaar('Onderbouwingsstatus', regels.length ? stand : null),
      strPaar('Gebruikte bronnen', bronnen.length
        ? bronnen.map(function (b) { return typeof b === 'string' ? b : (b.titel || b.bron || b.url || ''); }).join(' · ')
        : null)
    ])
    + (regels.length
      ? '<div class="str-sub">Het Rory-interview, vraag voor vraag</div>'
        + '<table class="str-mini"><thead><tr><th>Vraag</th><th>Antwoord</th>'
        + '<th>Zekerheid</th></tr></thead><tbody>'
        + regels.map(function (r) {
            return '<tr class="str-zeker--' + strEsc(r.zekerheid || 'leeg') + '">'
              + '<td>' + strEsc(r.tekst) + '</td>'
              + '<td>' + (r.antwoord ? strEsc(r.antwoord) : '<em>onbeantwoord</em>') + '</td>'
              + '<td>' + strEsc(r.zekerheid || '—')
              + (r.bron ? '<br><small>' + strEsc(r.bron) + '</small>' : '') + '</td></tr>';
          }).join('')
        + '</tbody></table>'
      : '<p class="str-sec-leeg">Er hangt geen denkstuk aan deze creative — deze test rust nergens op.</p>'));
}

/* ── 4. Werkstuk en samenwerking ─────────────────────────────────────────── */

function strDosD(d) {
  var tl = d.tijdlijn || [], overdrachten = d.overdrachten || [],
      oordelen = d.oordelen || [], discussies = d.discussies || [];

  var h = strLijst([
    strPaar('Gekoppeld werkstuk', d.werkstuk_id ? '#' + d.werkstuk_id + ' · ' + (d.werkstuk || '') : null),
    strPaar('Denkstuk', d.denkstuk_id
      ? '#' + d.denkstuk_id + ' · ' + (d.denkstuk_status === 'bevestigd'
          ? 'afgetekend door een mens' : 'nog niet afgetekend') : null)
  ]);

  /* Eén tijdlijn uit vier tabellen. "Wie besloot dit" is één vraag, en het
     antwoord stond tot nu toe verspreid over stappen, overdrachten, oordelen
     en de post. Mens en agent staan er met een woord bij: dat verschil is het
     hele punt van de werkbank. */
  h += '<div class="str-sub">Tijdlijn: wie deed wat</div>'
    + (tl.length
      ? '<ol class="str-tijdlijn">' + tl.map(function (t) {
          return '<li class="str-tl str-tl--' + strEsc(t.door || 'onbekend') + '">'
            + '<span class="str-tl-wie">' + strEsc(t.wie) + '</span>'
            + '<span class="str-tl-door">' + (t.door === 'mens' ? 'mens' : t.door === 'agent' ? 'agent' : 'onbekend') + '</span>'
            + '<span class="str-tl-wat">' + strEsc(t.wat) + '</span>'
            + '<span class="str-tl-wanneer">' + strEsc(strDatum(t.wanneer) || '') + '</span>'
            + (t.waarom ? '<p class="str-tl-waarom">' + strEsc(t.waarom) + '</p>' : '')
            + '</li>';
        }).join('') + '</ol>'
      : '<p class="str-sec-leeg">Er is nog niets vastgelegd aan stappen of overdrachten.</p>');

  h += '<div class="str-sub">Oordeel van De Criticus</div>'
    + (oordelen.length
      ? oordelen.map(function (k) {
          return '<div class="str-oordeel"><strong>' + strEsc(k.oordeel) + '</strong> — '
            + strEsc(k.reden) + '<br><small>' + strEsc(k.door || 'de Criticus') + '</small></div>';
        }).join('')
      : '<p class="str-sec-leeg">De Criticus heeft hier nog geen oordeel over geveld.</p>');

  if (overdrachten.length) {
    h += '<div class="str-sub">Overdrachten</div>' + overdrachten.map(function (t) {
      return '<div class="str-overdracht"><strong>' + t.van_station + ' → '
        + (t.naar_station == null ? '?' : t.naar_station) + '</strong> ' + strEsc(t.besluit)
        + '<br><small>Te controleren: ' + strEsc(t.controleren || 'niets opgegeven') + '</small>'
        + (t.onzekerheden ? '<br><small>Onzeker: ' + strEsc(t.onzekerheden) + '</small>' : '')
        + (t.mens_nodig ? '<br><small class="str-let-op">Er moet een mens bij.</small>' : '')
        + '</div>';
    }).join('');
  }

  h += '<div class="str-sub">Discussies en meningsverschillen</div>'
    + (discussies.length
      ? discussies.map(function (b) {
          return '<div class="str-bericht"><strong>' + strEsc(b.van) + ' → ' + strEsc(b.aan) + '</strong> '
            + strEsc(b.onderwerp)
            + (b.gelezen ? '' : ' <em class="str-let-op">(nooit opgehaald)</em>')
            + '<p>' + strEsc(b.body) + '</p></div>';
        }).join('')
      : '<p class="str-sec-leeg">De agents hebben hier niets over aan elkaar geschreven.</p>');

  return strSec('4 · Werkstuk en samenwerking', h);
}

/* ── 5. Publicatie en performance ────────────────────────────────────────── */

function strDosE(d) {
  var m = d.meting || {}, pub = d.publicatie || {};
  var heeft = (m.spend != null) || pub.status || d.date_live;
  if (!heeft) {
    return strSec('5 · Publicatie en performance', null,
      'Deze creative heeft nog niet gedraaid. Zodra hij live staat vult Atlas dit '
      + 'vanzelf uit de metingen — hier wordt niets met de hand ingevuld.');
  }
  /* Beoordeelbaarheid is afgeleid uit de meting (0008: vier dagen, vijftig
     euro, duizend vertoningen) en nergens instelbaar. Daarom staat de reden er
     altijd bij: anders leest "nee" als een fout in plaats van als geduld. */
  return strSec('5 · Publicatie en performance', strLijst([
    strPaar('Kanaal', d.channel),
    strPaar('Advertentieaccount', pub.account_id),
    strPaar('Publicatiestatus', pub.status),
    strPaar('Datum live', strDatum(d.date_live)),
    strPaar('Spend', strGetal(m.spend) ? '€ ' + strGetal(m.spend) : null),
    strPaar('Impressies', strGetal(m.impressions)),
    strPaar('Resultaten', m.purchases == null ? null
      : m.purchases + ' aankopen · € ' + (strGetal(m.omzet) || '0') + ' omzet'),
    strPaar('CTR', strGetal(m.ctr, '%')),
    strPaar('CPA', strGetal(m.cpa) ? '€ ' + strGetal(m.cpa) : null),
    strPaar('ROAS', strGetal(m.roas)),
    strPaar('Dagen live', m.dagen_live),
    strPaar('Beoordeelbaarheid', m.beoordeelbaar == null ? null
      : (m.beoordeelbaar
          ? 'ja — genoeg dagen, budget en vertoningen om iets te mogen zeggen'
          : 'nog niet — onder de drempel van vier dagen, vijftig euro en duizend vertoningen')),
    strPaar('Datakwaliteit', m.alles_definitief == null ? null
      : (m.alles_definitief
          ? 'alle meetdagen zijn definitief'
          : 'de attributie loopt nog na; deze cijfers kunnen nog bewegen')),
    strPaar('Verdict', d.verdict
      ? (STR_VERDICT[d.verdict] || d.verdict)
        + (d.verdict_actie ? ' · ' + d.verdict_actie : '')
        + (d.verdict_reden ? ' — ' + d.verdict_reden : '')
      : null)
  ]));
}

/* ── 6. Learning en vervolg ──────────────────────────────────────────────── */

function strDosF(d) {
  var l = d.learnings || [];
  var eigen = d.learning_kern || d.learning_behouden || d.learning_veranderen
           || d.iteratie_voorstel || d.vervolgtests || d.next_step;

  var h = eigen
    ? strLijst([
        strPaar('Belangrijkste learning', d.learning_kern),
        strPaar('Wat behouden moet blijven', d.learning_behouden),
        strPaar('Wat veranderd moet worden', d.learning_veranderen),
        strPaar('Aanbevolen iteratie', d.iteratie_voorstel),
        strPaar('Mogelijke vervolgtests', d.vervolgtests),
        strPaar('Vervolgstap', d.next_step),
        /* Een learning die nog niet getekend is, is een voorstel. Dat verschil
           staat er in woorden: een agent mag voorstellen, een mens bevestigt. */
        strPaar('Menselijke bevestiging', d.learning_bevestigd
          ? 'bevestigd door ' + (d.learning_bevestigd_door || 'een teamlid')
            + ' op ' + (strDatum(d.learning_bevestigd_op) || 'onbekende datum')
          : (d.learning_kern
              ? 'nog niet bevestigd — dit is een voorstel'
              + (d.learning_door_agent ? ' van ' + d.learning_door_agent : '')
              : null))
      ])
    : '<p class="str-sec-leeg">Er is nog geen learning vastgelegd voor deze creative. '
      + 'Dat kan pas zinvol als er gemeten is — een conclusie zonder meting is een mening.</p>';

  /* De learning op de hoek staat eronder en niet erin: die gaat over alle
     advertenties op deze hoek samen, en dat is een andere uitspraak dan wat
     déze test opleverde. */
  h += '<div class="str-sub">Wat we op deze hoek al weten</div>'
    + (l.length
      ? l.map(function (x) {
          return '<div class="str-learning"><strong>' + strEsc(x.hoek) + ' bij ' + strEsc(x.persona)
            + '</strong><br>' + x.advertenties + ' advertenties, € '
            + Number(x.spend || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })
            + ', ROAS ' + (x.roas == null ? '—' : Number(x.roas).toFixed(2))
            + (x.winnaars != null ? ', ' + x.winnaars + ' winnaar(s)' : '')
            + '<br><small>' + (x.betrouwbaar
                ? 'Betrouwbaar: genoeg advertenties en budget om iets te mogen zeggen.'
                : 'Nog niet betrouwbaar — onder drie advertenties of onder €300 blijft dit een aanname.')
            + '</small></div>';
        }).join('')
      : '<p class="str-sec-leeg">Er is nog niets geleerd op deze hoek. Dat komt pas als een '
        + 'batch is afgerond.</p>');

  return strSec('6 · Learning en vervolg', h);
}
