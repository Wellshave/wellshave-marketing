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
  try { return localStorage.getItem('str_weergave_v1') || 'tracker'; } catch (e) { return 'tracker'; }
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
  var tracker = document.getElementById('trk-mount');
  if (knoppen) {
    knoppen.innerHTML =
      '<button class="str-knop' + (w === 'tracker' ? ' str-knop--aan' : '') + '"'
      + ' onclick="strWissel(\'tracker\')">Tracker</button>'
      + '<button class="str-knop' + (w === 'tests' ? ' str-knop--aan' : '') + '"'
      + ' onclick="strWissel(\'tests\')">Tests en dossier</button>'
      + '<button class="str-knop' + (w === 'tabel' ? ' str-knop--aan' : '') + '"'
      + ' onclick="strWissel(\'tabel\')">Bewerken (cijfers en status)</button>';
  }
  if (mount)    mount.style.display    = (w === 'tests')   ? '' : 'none';
  if (tracker)  tracker.style.display  = (w === 'tracker') ? '' : 'none';
  if (klassiek) klassiek.style.display = (w === 'tabel')   ? '' : 'none';
  if (w === 'tests')   renderStrategie();
  if (w === 'tracker' && typeof renderTracker === 'function') renderTracker();
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
/* De verdicts in gewone taal. Het Engelse woord uit meta_recommendations zegt
   niets tegen wie de tabel leest. Die tabel blijft staan met wat er al in zat;
   er komt alleen niets meer bij nu er geen agent meer oordeelt. */
var STR_VERDICT = { winner: 'winnaar', loser: 'verliezer', test: 'blijf testen',
                    onvoldoende_data: 'te weinig data' };

/* Wacht dit op een mens? De statustabel weet het: daar staat wie er aan zet is.
   Niet hier nog een keer opsommen — dat zou een tweede waarheid zijn. */
function strMensNodig(r) {
  return ['jij', 'de maker', 'een mens'].indexOf(String(r.verantwoordelijke || '')) > -1;
}

function strGroep(r) {
  /* Een status die de database niet kent is verouderd, en dat hoort er te
     staan. Hem stilletjes als 'concept' tonen zou een tweede uitleg zijn van
     wat 'To Test' betekende — precies waarom 0030 die omzetting niet doet.
     De testkaart geeft geen verantwoordelijke bij een onbekende status, en dat
     is hier het signaal. */
  if (r.status && !r.verantwoordelijke && !r.status_fase)
    return { id: 'verouderd', naam: r.status + ' · verouderd' };
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
      +  'Bij de rest is de meting aan zet. '
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
/* Een leeg veld levert geen regel op.

   Dit was andersom: elk veld kreeg zijn regel, en een leeg veld zei "niet
   vastgelegd". Bij een creative van vóór de testflow stond dat twintig keer op
   het scherm, en dan is het geen informatie meer maar ruis die verbergt wat er
   wél staat. Waaróm iets ontbreekt staat nu één keer bovenaan.

   Een veld dat de gebruiker nú moet aanvullen is een ander geval: dat komt
   langs strPaarNodig en staat er wél, met wat er moet gebeuren. */
function strPaar(label, waarde) {
  var w = strTekst(waarde);
  if (!w) return '';
  return '<div class="str-paar"><dt>' + strEsc(label) + '</dt><dd>' + strEsc(w) + '</dd></div>';
}
function strPaarNodig(label, waarde, wat) {
  var w = strTekst(waarde);
  if (w) return strPaar(label, w);
  return '<div class="str-paar str-paar--nodig"><dt>' + strEsc(label) + '</dt>'
    + '<dd>' + strEsc(wat) + '</dd></div>';
}


/* Een lijst met een reden erbij als hij leeg is. Overal hetzelfde, want "leeg"
   is in dit dossier nooit hetzelfde als "niets aan de hand": het betekent
   ofwel nog niet gebeurd, ofwel niet vastgelegd, en dat verschil telt. */
function strLijst(regels) {
  var gevuld = regels.filter(Boolean);
  return gevuld.length ? '<dl class="str-dl">' + gevuld.join('') + '</dl>' : '';
}

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

/* ═══════════════════════════════════════════════════════════════════════════
   Het dossier

   Het dossier had alles, en daardoor zei het niets. Zeven secties onder elkaar
   met elk vijftien regels: technisch volledig, en om te weten wat er aan de
   hand was moest je het hele ding lezen en zelf de conclusie trekken. Dat is
   werk dat het systeem kan doen, want het systeem weet het al.

   Daarom opent het dossier nu met het antwoord: één zin die zegt wat er aan de
   hand is, twee zinnen waarom, en één ding dat je kunt doen. De onderbouwing
   staat er nog steeds — volledig, niets weggehaald — maar ingeklapt. Wie het
   wil zien klapt open; wie wil beslissen hoeft dat niet.

   Eén plek bepaalt het oordeel, de reden en de actie: strOordeel(). Ze horen
   bij elkaar en mogen niet uit elkaar lopen — een oordeel met een actie die er
   niet bij past is erger dan geen actie.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Niets in dit dossier mag als [object Object] op het scherm komen. Een waarde
   die geen tekst is, is een programmeerfout die je niet aan de gebruiker moet
   laten zien — hier wordt hij een leesbare regel of niets. */
function strTekst(w) {
  if (w == null) return null;
  if (typeof w === 'string') return w.trim() === '' ? null : w;
  if (typeof w === 'number' || typeof w === 'boolean') return String(w);
  if (Array.isArray(w)) {
    var d = w.map(strTekst).filter(Boolean);
    return d.length ? d.join(' · ') : null;
  }
  if (typeof w === 'object') {
    var v = w.naam || w.titel || w.tekst || w.url || w.bron;
    return v ? String(v) : null;
  }
  return null;
}

/* De zes stations bij naam. In de database staan ze als nummer, en "2 → 3"
   zegt niets tegen wie de werkbank niet uit zijn hoofd kent. */
var STR_STATIONS = { 1: 'Signaal', 2: 'Briefing', 3: 'Creatie', 4: 'Live', 5: 'Meting', 6: 'Oogst' };
function strStation(n) { return STR_STATIONS[n] || ('station ' + n); }

/* ── het oordeel ─────────────────────────────────────────────────────────── */

/* Eén beslisboom, op volgorde van wat het eerst tegenhoudt. De volgorde is de
   inhoud: een creative die niet testklaar is, hoeft niet te horen dat hij op
   de Criticus wacht — hij komt daar niet eens.

   Alles hieronder komt uit velden die er al staan. Er wordt niets geraden en
   niets bijgeschat; waar het systeem het niet weet, zegt het dat. */
function strOordeel(d) {
  var m = d.meting || {}, pub = d.publicatie || {};
  var oordeelVanCriticus = (d.oordelen || [])[0];

  /* 0. Geen beeld en geen verwijzing naar de bibliotheek. Dit staat vooraan
        omdat je een advertentie die je niet kunt zien ook niet kunt
        beoordelen: elke andere vraag komt daarna. */
  if (!d.heeft_beeld && !d.bibliotheek_id) {
    return { id: 'geen-koppeling', ernst: 'blokkade',
      oordeel: 'Deze creative is niet gekoppeld aan zijn bibliotheekvariant',
      waarom: 'Er staat geen beeld en geen copy bij deze rij, en er is geen verwijzing '
        + 'naar het bibliotheekitem waar hij uit komt. Zo is niet te zien wélke '
        + 'advertentie dit is.',
      actie: 'Koppel aan de bibliotheek',
      hoe: 'Kies zelf welke variant hierbij hoort. Het systeem koppelt niet op een '
         + 'gelijke titel — twee varianten uit één generatie kunnen dezelfde kop hebben.' };
  }

  /* 1. Een status die de statustabel niet kent. Dan weet het systeem niet in
        welke fase deze creative zit, en elk verder oordeel zou gokwerk zijn. */
  if (d.status && !d.status_fase && !d.verantwoordelijke) {
    return { id: 'verouderd', ernst: 'let-op',
      oordeel: 'Oude status — deze creative moet opnieuw beoordeeld worden',
      waarom: 'De status "' + strEsc(d.status) + '" komt uit het oude vocabulaire en '
        + 'bestaat niet meer. Zolang die er staat, weet het systeem niet in welke fase '
        + 'deze creative zit.',
      actie: 'Kies een geldige status',
      hoe: 'In de bewerkbare tabel, bij Status. De code kiest niet voor je: het oude '
         + 'woord kon meer dan één ding betekenen.' };
  }

  /* 2. Niet testklaar. De reden staat al in de database uitgerekend, in
        dezelfde woorden als de werkbank hem gebruikt. */
  if (d.niet_testklaar) {
    return { id: 'niet-testklaar', ernst: 'blokkade',
      oordeel: 'Deze creative is nog niet testklaar',
      waarom: strHoofdletter(d.niet_testklaar) + '. Zonder die informatie is achteraf '
        + 'niet vast te stellen waarom deze advertentie won of verloor.',
      actie: 'Testcontext aanvullen',
      hoe: 'Hypothese, testvariabele en het werkstuk waar hij bij hoort.' };
  }

  /* 2. Wacht op een oordeel van de Criticus. */
  if (d.status === 'Klaar voor review') {
    if (oordeelVanCriticus && oordeelVanCriticus.oordeel === 'twijfel') {
      return { id: 'twijfel', ernst: 'let-op',
        oordeel: 'De Criticus twijfelt over deze creative',
        waarom: strTekst(oordeelVanCriticus.reden) || 'Er is twijfel uitgesproken zonder reden erbij.',
        actie: 'Denkstuk beoordelen',
        hoe: 'Weeg de twijfel, pas het denkstuk aan of laat hem alsnog door.' };
    }
    return { id: 'wacht-criticus', ernst: 'wacht',
      oordeel: 'Deze creative wacht op De Criticus',
      waarom: 'Hij is ingediend en er ligt nog geen oordeel. De Criticus kijkt of de '
        + 'test toetsbaar is voordat er geld aan wordt uitgegeven.',
      actie: 'Naar De Criticus sturen',
      hoe: 'De Criticus is een mens die het denkstuk naloopt. Er is nooit een agent '
         + 'geweest die dit deed, en er komt er ook geen.' };
  }

  /* 3. Doorgelaten, maar nog niet klaargezet bij Meta. */
  if (d.status === 'Goedgekeurd voor test') {
    return { id: 'wacht-klaarzetten', ernst: 'wacht',
      oordeel: 'Deze creative is goedgekeurd en wacht op klaarzetten bij Meta',
      waarom: 'Het beeld moet geüpload worden en de ad-creative aangemaakt. Dat kost '
        + 'nog niets: er wordt pas geld uitgegeven als hij live gaat.',
      actie: 'Klaarzetten bij Meta',
      hoe: 'Klaarzetten maakt de creative aan bij Meta en zet meteen een goedkeuring '
         + 'klaar. Live zetten vraagt daarna een admin.' };
  }

  /* 4. De poort waar geld begint te lopen. Het enige moment waarop een mens
        expliciet moet tekenen. */
  if (d.status === 'Klaar voor publicatie') {
    return { id: 'wacht-jij', ernst: 'jij',
      oordeel: 'Deze creative wacht op jouw goedkeuring',
      waarom: 'Hij staat klaar bij Meta en kost nu nog niets. Zodra je hem live zet, '
        + 'begint het budget te lopen.',
      actie: 'Publicatie goedkeuren',
      hoe: 'Dit is de enige poort waar een mens moet tekenen.' };
  }

  /* 5. Live. Beoordeelbaarheid komt uit de meting en is nergens instelbaar. */
  if (d.status === 'Live') {
    if (m.beoordeelbaar === true) {
      return { id: 'klaar-voor-verdict', ernst: 'jij',
        oordeel: 'Deze test heeft genoeg data voor een verdict',
        waarom: strMeetzin(m) + ' Daarmee is de drempel gehaald en mag er iets over '
          + 'gezegd worden.',
        actie: 'Verdict beoordelen',
        hoe: d.verdict ? ('Er ligt nog een oud voorstel: ' + (STR_VERDICT[d.verdict] || d.verdict) + '.')
                       : 'Er ligt geen voorstel. Het oordeel is aan jou.' };
    }
    return { id: 'wacht-data', ernst: 'geduld',
      oordeel: 'Deze test is live maar nog niet beoordeelbaar',
      waarom: strMeetzin(m) + ' De drempel ligt op vier dagen, vijftig euro en duizend '
        + 'vertoningen — daaronder is elk oordeel toeval.',
      actie: null,
      hoe: 'Geen actie nodig — de meting loopt door tot de drempel gehaald is.' };
  }

  /* 6. Er ligt een verdict. Dan gaat het nog om de learning. */
  if (d.status === 'Itereren') {
    return { id: 'itereren', ernst: 'jij',
      oordeel: 'Deze creative is klaar voor een iteratie',
      waarom: 'Er werkte iets, maar niet genoeg. ' + (strTekst(d.iteratie_voorstel)
        || 'Wat er precies doorgaat naar de volgende variant staat nog niet vast.'),
      actie: 'Iteratie starten',
      hoe: 'Een nieuwe variant die naar deze verwijst, zodat de reeks terug te lezen is.' };
  }
  if (d.status === 'Winner' || d.status === 'Verliezer' || d.status === 'Middelmatig') {
    var uitgesproken = { Winner: 'Deze test heeft gewonnen',
      Verliezer: 'Deze test heeft verloren', Middelmatig: 'Deze test viel in het midden' };
    if (!d.learning_kern) {
      return { id: 'learning-open', ernst: 'jij',
        oordeel: uitgesproken[d.status] + ' — de learning staat nog open',
        waarom: 'Het oordeel is geveld, maar wat we hieruit leren is nergens vastgelegd. '
          + 'Zonder dat blijft dit één advertentie in plaats van kennis.',
        actie: 'Learning vastleggen',
        hoe: 'Wat behouden moet blijven, wat anders moet, en of er een vervolgtest is.' };
    }
    if (!d.learning_bevestigd) {
      return { id: 'learning-voorstel', ernst: 'jij',
        oordeel: uitgesproken[d.status] + ' — de learning wacht op jouw bevestiging',
        waarom: strTekst(d.learning_kern) + ' Dat is nu een voorstel, geen vastgesteld feit.',
        actie: 'Learning bevestigen',
        hoe: 'Een learning is pas vastgesteld als een mens tekent. Dat gold al toen een '
           + 'agent het voorstel schreef, en het geldt nog steeds.' };
    }
    return { id: 'afgerond', ernst: 'rustig',
      oordeel: uitgesproken[d.status] + ' en de learning is vastgelegd',
      waarom: strTekst(d.learning_kern),
      actie: null, hoe: 'Geen actie nodig — deze test is afgerond.' };
  }

  /* 7. Bewust gestopt. */
  if (d.status === 'Gestopt') {
    return { id: 'gestopt', ernst: 'rustig',
      oordeel: 'Deze creative is bewust stopgezet',
      waarom: strTekst(d.next_step) || 'Er is geen reden bij vastgelegd.',
      actie: null, hoe: 'Geen actie nodig — dit is een eindpunt.' };
  }

  /* 8. Concept: mag nog rammelen. */
  return { id: 'concept', ernst: 'rustig',
    oordeel: 'Dit is nog een concept',
    waarom: 'Hij is gemaakt maar niet ingediend. In deze fase mag alles nog onaf zijn.',
    actie: 'Indienen voor review',
    hoe: 'Of laten liggen — een idee niet doorzetten is een geldige uitkomst.' };
}

function strHoofdletter(t) {
  t = String(t || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* Wat er tot nu toe gemeten is, als zin. Losse getallen zeggen pas iets als er
   een woord omheen staat. */
function strMeetzin(m) {
  if (!m || m.spend == null) return 'Er is nog niets gemeten.';
  var d = [];
  if (m.dagen_live != null) d.push(m.dagen_live + (m.dagen_live === 1 ? ' dag' : ' dagen') + ' live');
  if (m.spend != null) d.push('€ ' + strGetal(m.spend));
  if (m.impressions != null) d.push(strGetal(m.impressions) + ' vertoningen');
  return d.length ? (strHoofdletter(d.join(', ')) + '.') : 'Er is nog niets gemeten.';
}

/* ── legacy: één melding in plaats van twintig keer "niet vastgelegd" ─────── */

/* Een creative van vóór de nieuwe testflow mist bijna alles. Dat twintig keer
   apart melden maakt het scherm een klaagmuur en verbergt wat er wél staat.
   Eén zin die zegt waaróm het ontbreekt is bruikbaarder dan twintig die zeggen
   dát het ontbreekt. */
function strLegacy(d) {
  var mist = !d.denkstuk_id && !d.hypothesis && !d.test_variable
          && !(d.rory_interview && Object.keys(d.rory_interview).length);
  if (!mist) return null;
  return 'Deze creative is gemaakt vóór de nieuwe testflow. Strategische interviewdata, '
    + 'hypothese en testvariabele zijn daarom niet beschikbaar. Dat is geen fout in de '
    + 'gegevens — ze zijn er nooit geweest.';
}

/* ── tekenen ─────────────────────────────────────────────────────────────── */

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
    var w = strOordeel(d);
    var legacy = strLegacy(d);

    var h = '<div class="str-dos">'
      + '<div class="str-dos-kop"><strong>' + strEsc(d.ad_name || 'Nog geen naam') + '</strong>'
      + '<button class="str-x" onclick="strDossierSluit()" aria-label="Sluiten">×</button></div>';

    /* De beslislaag. Dit is wat je in tien seconden moet kunnen lezen. */
    h += '<div class="str-besluit str-besluit--' + w.ernst + '">'
      +  '<h3 class="str-oordeel-kop">' + strEsc(w.oordeel) + '</h3>'
      +  '<p class="str-oordeel-waarom">' + strEsc(w.waarom) + '</p>'
      +  '<div class="str-actie">'
      +    strActieKnop(d, w)
      +    '<span class="str-actie-hoe">' + strEsc(w.hoe) + '</span>'
      +  '</div></div>';

    /* De compacte samenvatting: chips, geen veldlijst. */
    h += '<div class="str-samenvatting">'
      + (d.heeft_beeld ? '<span class="str-mini-beeld" title="er is een beeld">▣</span>'
                       : '<span class="str-mini-beeld str-mini-beeld--leeg" title="nog geen beeld">▢</span>')
      + '<div class="str-chips">'
      +   strChip('Product', d.product) + strChip('Persona', d.persona)
      +   strChip('Angle', d.marketing_angle) + strChip('Format', d.format)
      +   strChip('Status', strStatusMens(d)) + strChip('Werkstuk', d.werkstuk)
      +   strChip('Wie', d.verantwoordelijke)
      + '</div></div>';

    if (legacy) h += '<p class="str-legacy">' + strEsc(legacy) + '</p>';

    h += strDosGroep('creative',    'Creative',                strDosCreative(d));
    h += strDosGroep('strategie',   'Strategie',               strDosStrategie(d, legacy));
    h += strDosGroep('samenwerking','Samenwerking',            strDosSamen(d));
    h += strDosGroep('performance', 'Publicatie en performance', strDosPerf(d));
    h += strDosGroep('learning',    'Learning en vervolg',     strDosLearning(d));

    o.innerHTML = h + '</div>';
  }

  document.body.appendChild(o);
  o.addEventListener('click', function (e) { if (e.target === o) strDossierSluit(); });
}

/* De actie zag eruit als een knop en was er geen: een <span> zonder klik.
   Dat is erger dan geen knop, want het kost een poging en een moment twijfel
   voordat je doorhebt dat er niets gebeurt.

   Nu is hij een echte knop waar de console de handeling kan uitvoeren, en
   anders een label dat er niet uitziet als iets waarop je kunt drukken. Wat je
   dan wél moet doen staat ernaast. */
var STR_ACTIES = {
  'verouderd': function (d) {
    return { doen: 'strNaarStatus(' + d.creative_id + ')' };
  },
  'geen-koppeling': function (d) {
    return { doen: 'strKoppelOpen(' + d.creative_id + ')' };
  }
};

function strActieKnop(d, w) {
  if (!w.actie) return '';
  var kan = STR_ACTIES[w.id] ? STR_ACTIES[w.id](d) : null;
  if (kan) {
    return '<button class="str-actie-knop" onclick="' + kan.doen + '">'
      + strEsc(w.actie) + '</button>';
  }
  /* Geen knop maar een label: deze handeling gebeurt ergens anders, en doen
     alsof hij hier zit is een belofte die niet klopt. */
  return '<span class="str-actie-label">' + strEsc(w.actie) + '</span>';
}

/* Naar de bewerkbare tabel, met deze rij open. Dat is waar de status gekozen
   wordt; het dossier leest alleen. */
function strNaarStatus(id) {
  strDossierSluit();
  strWissel('tabel');
  if (typeof csOpenDetail === 'function') {
    if (!(_cs.rows || []).some(function (r) { return r.id === id; })) {
      if (typeof csFetch === 'function') csFetch();
      setTimeout(function () { csOpenDetail(id); }, 600);
    } else {
      csOpenDetail(id);
    }
  }
}

function strChip(label, waarde) {
  var w = strTekst(waarde);
  if (!w) return '';
  return '<span class="str-chip"><span class="str-chip-l">' + strEsc(label) + '</span>'
    + strEsc(w.length > 40 ? w.slice(0, 38) + '…' : w) + '</span>';
}

/* De status in mensentaal. De technische waarde blijft als tooltip bestaan —
   beschikbaar voor wie hem nodig heeft, nooit de hoofdboodschap. */
function strStatusMens(d) {
  if (!d.status) return null;
  if (!d.status_fase && !d.verantwoordelijke) return 'Oude status — opnieuw beoordelen';
  return d.status;
}

/* Een inklapbare groep. <details> en niet een eigen open/dicht-toestand: dan
   werkt toetsenbordbediening en zoeken-in-pagina vanzelf, en is er geen tweede
   plek waar "is dit open" bijgehouden wordt.

   De kop draagt de samenvatting. Wie niet openklapt, weet dan nog steeds of er
   iets te halen valt — dat is het hele punt van inklappen. */
function strDosGroep(id, titel, inhoud) {
  var leeg = !inhoud.body;
  return '<details class="str-groep' + (inhoud.blokkade ? ' str-groep--blokkade' : '')
    + (leeg ? ' str-groep--leeg' : '') + '" data-groep="' + id + '">'
    + '<summary class="str-groep-kop">'
    +   '<span class="str-groep-titel">' + strEsc(titel) + '</span>'
    +   '<span class="str-groep-samenvatting">' + strEsc(inhoud.kop || '') + '</span>'
    +   (inhoud.blokkade ? '<span class="str-waarschuwing">' + strEsc(inhoud.blokkade) + '</span>' : '')
    + '</summary>'
    + '<div class="str-groep-body">'
    + (inhoud.body || '<p class="str-sec-leeg">' + strEsc(inhoud.leeg || 'Nog niets vastgelegd.') + '</p>')
    + '</div></details>';
}

/* ── A. Creative ─────────────────────────────────────────────────────────── */

function strDosCreative(d) {
  /* Het beeld hoort in het dossier en niet alleen in de bibliotheek: wie een
     creative beoordeelt, moet hem kunnen zien. Staat hij niet in de database,
     dan wordt hij uit het bibliotheekitem gehaald — dezelfde variant, dezelfde
     bytes, opgezocht op id en niet op titel. */
  var beeld = strBeeld(d);
  var regels = [
    strPaar('Headline', strTekst(d.headline)),
    strPaar('Body copy', strTekst(d.body_copy)),
    strPaar('CTA', strTekst(d.cta)),
    strPaar('Format', strTekst(d.format)),
    strPaar('Plaatsing', strTekst(d.placement)),
    strPaar('Visueel concept', strTekst(d.visual_concept)),
    strPaar('Image prompt', strTekst(d.image_prompt))
  ];
  var gevuld = [d.headline, d.body_copy, d.cta, d.visual_concept].filter(Boolean).length;
  var lijst = strLijst(regels);
  var body = (beeld.html || '') + lijst;
  return {
    kop: beeld.aanwezig ? (gevuld ? 'beeld en tekst' : 'alleen een beeld')
                        : (gevuld ? 'tekst, nog geen beeld' : (beeld.reden || 'nog leeg')),
    blokkade: beeld.aanwezig ? null : (d.bibliotheek_id ? 'beeld staat in de bibliotheek'
                                                        : 'niet gekoppeld'),
    body: body || null,
    leeg: 'Er is nog geen beeld of tekst voor deze creative.'
  };
}

/* Het beeld, in volgorde van betrouwbaarheid: eerst wat in de database staat,
   dan het bibliotheekitem waar deze creative aan gekoppeld is. Nooit zoeken op
   titel — twee varianten uit één generatie kunnen dezelfde kop hebben, en dan
   toont het dossier de verkeerde advertentie zonder dat iemand het merkt. */
function strBibItem(id) {
  if (!id || typeof state === 'undefined' || !state.library) return null;
  for (var i = 0; i < state.library.length; i++) {
    if (state.library[i] && state.library[i].id === id) return state.library[i];
  }
  return null;
}
function strBeeld(d) {
  if (d.image_b64) {
    return { aanwezig: true, html: '<img class="str-dos-beeld" alt="" src="'
      + strEsc(d.image_b64.indexOf('data:') === 0 ? d.image_b64
                                                  : 'data:image/png;base64,' + d.image_b64) + '">' };
  }
  var item = strBibItem(d.bibliotheek_id);
  if (item && item.image) {
    return { aanwezig: true, html: '<img class="str-dos-beeld" alt="" src="' + strEsc(item.image) + '">'
      + '<p class="str-sec-noot">Dit beeld komt uit de bibliotheek (' + strEsc(d.bibliotheek_id)
      + '), niet uit de database.</p>' };
  }
  if (d.bibliotheek_id) {
    return { aanwezig: false, reden: 'beeld staat in de bibliotheek',
      html: '<p class="str-sec-leeg">Deze creative is gekoppeld aan bibliotheekitem '
        + strEsc(d.bibliotheek_id) + ', maar dat item staat niet in deze browser. '
        + 'Open de Bibliotheek een keer, dan is het beeld hier ook zichtbaar.</p>' };
  }
  return { aanwezig: false, reden: 'niet gekoppeld',
    html: '<p class="str-sec-leeg">Er is geen beeld, en geen verwijzing naar een '
      + 'bibliotheekvariant. Wat deze advertentie liet zien, is vanuit hier niet te '
      + 'achterhalen.</p>' };
}

/* ── B. Strategie ────────────────────────────────────────────────────────── */

function strDosStrategie(d, legacy) {
  if (legacy) {
    /* Alles wat hier hoort te staan ontbreekt, en dat is één feit en geen
       vijftien. De melding staat al bovenaan; hier alleen wat er wél is. */
    var wel = strLijst([
      strPaar('Awarenessniveau', d.awareness_level),
      strPaar('Funnelstadium', d.funnel_stage),
      strPaar('Marketingangle', d.marketing_angle)
    ]);
    return { kop: 'niet vastgelegd — van vóór de testflow', blokkade: null,
      body: wel || null,
      leeg: 'Deze creative komt uit de tijd vóór het denkstuk. Er is geen interview, '
          + 'geen hypothese en geen testvariabele — die zijn er nooit geweest.' };
  }

  var iv = d.rory_interview || {};
  var regels = d.denkstuk_regels || [];
  var stand = (d.onderbouwd || 0) + ' onderbouwd, ' + (d.aanname || 0) + ' aanname'
    + ((d.aanname || 0) === 1 ? '' : 's') + ', ' + (d.open_gelaten || 0) + ' open gelaten';
  var bronnen = strTekst(d.bronnen);

  var body = strLijst([
    strPaar('Oorspronkelijke ingeving', strTekst(d.mens_ingeving)),
    strPaarNodig('Hypothese', d.hypothesis, 'vul dit aan — zonder hypothese is dit geen test'),
    strPaarNodig('Testvariabele', d.test_variable,
      'vul dit aan — anders is achteraf niet te zeggen wát het deed'),
    strPaar('Kernpijn', strTekst(iv.kernpijn)),
    strPaar('Kernbezwaar', strTekst(iv.kernbezwaar)),
    strPaar('Echte vijand', strTekst(iv.echte_vijand)),
    strPaar('Gewenste na-situatie', strTekst(iv.na_situatie)),
    strPaar('Awarenessniveau', strTekst(d.awareness_level)),
    strPaar('Funnelstadium', strTekst(d.funnel_stage)),
    strPaar('Market sophistication', d.sophistication
      ? d.sophistication + ' · ' + strTekst(d.sophistication_naam)
        + (d.sophistication_bevestigd ? ' (bevestigd)' : ' (voorstel)') : null),
    strPaar('Rory reasoning', strTekst(d.rory_reasoning)),
    strPaar('Theriot-aanscherping', strTekst(d.theriot_reasoning)),
    strPaar('Onderbouwing', regels.length ? stand : null),
    strPaar('Bronnen', bronnen)
  ]);

  if (regels.length) {
    body += '<div class="str-sub">Het denkstuk, vraag voor vraag</div>'
      + '<table class="str-mini"><thead><tr><th>Vraag</th><th>Antwoord</th><th>Zekerheid</th>'
      + '</tr></thead><tbody>'
      + regels.map(function (r) {
          return '<tr class="str-zeker--' + strEsc(r.zekerheid || 'leeg') + '">'
            + '<td>' + strEsc(strTekst(r.tekst) || '—') + '</td>'
            + '<td>' + (r.antwoord ? strEsc(r.antwoord) : '<em>onbeantwoord</em>') + '</td>'
            + '<td>' + strEsc(r.zekerheid || '—')
            + (r.bron ? '<br><small>' + strEsc(strTekst(r.bron)) + '</small>' : '') + '</td></tr>';
        }).join('') + '</tbody></table>';
  }

  var blok = null;
  if (!d.hypothesis || !d.test_variable) blok = 'testcontext onvolledig';
  else if (!regels.length) blok = 'geen denkstuk';
  else if ((d.onderbouwd || 0) === 0) blok = 'alles rust op aannames';

  return {
    kop: regels.length ? stand : (d.hypothesis ? 'hypothese zonder denkstuk' : 'niet onderbouwd'),
    blokkade: blok, body: body,
    leeg: 'Er is geen strategische onderbouwing vastgelegd.'
  };
}

/* ── C. Samenwerking ─────────────────────────────────────────────────────── */

function strDosSamen(d) {
  var tl = d.tijdlijn || [], overdrachten = d.overdrachten || [],
      oordelen = d.oordelen || [];
  var body = '';

  if (tl.length) {
    body += '<ol class="str-tijdlijn">' + tl.map(strTijdlijnregel).join('') + '</ol>';
  }

  if (oordelen.length) {
    body += '<div class="str-sub">Oordeel van De Criticus</div>'
      + oordelen.map(function (k) {
          return '<div class="str-oordeel"><strong>' + strEsc(strTekst(k.oordeel) || '—')
            + '</strong> — ' + strEsc(strTekst(k.reden) || 'geen reden vastgelegd')
            + '<br><small>' + strEsc(strTekst(k.door) || 'de Criticus') + '</small></div>';
        }).join('');
  }

  if (overdrachten.length) {
    body += '<div class="str-sub">Overdrachten</div>' + overdrachten.map(function (t) {
      var vol = [strTekst(t.waarom), strTekst(t.controleren) ? 'Te controleren: ' + strTekst(t.controleren) : null,
                 strTekst(t.onzekerheden) ? 'Onzeker: ' + strTekst(t.onzekerheden) : null]
                .filter(Boolean).join('\n\n');
      return '<div class="str-overdracht"><strong>' + strEsc(strStation(t.van_station))
        + ' → ' + strEsc(strStation(t.naar_station)) + '</strong> '
        + strEsc(strKort(strTekst(t.besluit)))
        + (t.mens_nodig ? ' <span class="str-let-op">er moet een mens bij</span>' : '')
        + strOnderbouwing(vol) + '</div>';
    }).join('');
  }

  /* Hier stond "Discussies": de berichten die agents elkaar stuurden, uit
     agent_messages. Die tabel is weg met de agents. Het blok is niet verborgen
     maar verwijderd -- een kop die altijd leeg blijft leest als een storing. */

  var kop = tl.length
    ? tl.length + (tl.length === 1 ? ' gebeurtenis' : ' gebeurtenissen')
    : 'nog niets vastgelegd';

  return {
    kop: kop,
    blokkade: overdrachten.some(function (t) { return t.mens_nodig; }) ? 'een mens moet erbij' : null,
    body: body || null,
    leeg: 'Er is nog niets vastgelegd aan stappen, overdrachten of berichten.'
  };
}

/* Eén regel in de tijdlijn: wie, wat, wanneer, en het besluit in twee regels.
   De volledige tekst zit achter "Bekijk onderbouwing" — samenvatten mag nooit
   betekenen dat de brontekst weg is. */
function strTijdlijnregel(t) {
  /* 'agent' kan hier nog uit oude rijen komen: de historie blijft staan, alleen
     komt er niets meer bij. Daarom blijft de derde tak bestaan. */
  var door = t.door === 'mens' ? 'mens' : t.door === 'agent' ? 'agent' : 'onbekend';
  var wie = strTekst(t.wie);
  if (!wie || wie === 'naamloos') wie = 'Historische uitvoerder niet vastgelegd';
  var waarom = strTekst(t.waarom);
  return '<li class="str-tl str-tl--' + door + '">'
    + '<span class="str-tl-wie">' + strEsc(wie) + '</span>'
    + '<span class="str-tl-door">' + door + '</span>'
    + '<span class="str-tl-wat">' + strEsc(strWat(t)) + '</span>'
    + '<span class="str-tl-wanneer">' + strEsc(strDatum(t.wanneer) || 'datum onbekend') + '</span>'
    + (waarom ? '<p class="str-tl-waarom">' + strEsc(strKort(waarom)) + '</p>' : '')
    + (waarom && waarom.length > 160 ? strOnderbouwing(waarom) : '')
    + '</li>';
}

/* "2 → 3" is geen zin. Dit maakt er een zin van. */
function strWat(t) {
  var wat = strTekst(t.wat) || '';
  var m = wat.match(/^(\d+)\s*→\s*(\d+|\?)$/);
  if (m) {
    return m[2] === '?'
      ? strStation(+m[1]) + ' droeg over, maar niet aan wie'
      : strStation(+m[1]) + ' droeg over aan ' + strStation(+m[2]);
  }
  if (t.soort === 'klaargezet') return 'Klaargezet voor test';
  if (t.soort === 'oordeel') return wat.replace(/^oordeel:\s*/, 'Oordeel van De Criticus: ');
  return strHoofdletter(wat);
}

/* Afkappen op twee regels. De grens is een leesbaarheidskeuze en geen techniek:
   langer dan dit scan je niet meer, je leest het of je slaat het over. */
function strKort(t) {
  t = strTekst(t) || '';
  if (t.length <= 160) return t;
  var snee = t.slice(0, 158);
  var spatie = snee.lastIndexOf(' ');
  return (spatie > 100 ? snee.slice(0, spatie) : snee) + '…';
}
function strOnderbouwing(vol) {
  if (!vol || String(vol).length <= 160) return '';
  return '<details class="str-meer"><summary>Bekijk onderbouwing</summary>'
    + '<p>' + strEsc(vol).replace(/\n\n/g, '</p><p>') + '</p></details>';
}

/* ── D. Publicatie en performance ────────────────────────────────────────── */

function strDosPerf(d) {
  var m = d.meting || {}, pub = d.publicatie || {};
  var heeft = (m.spend != null) || pub.status || d.date_live;
  if (!heeft) {
    return { kop: 'Nog geen performance', blokkade: null, body: null,
      leeg: 'Deze creative heeft nog niet gedraaid. Zodra hij live staat vult de '
          + 'terugkoppeling dit vanzelf uit de metingen — hier wordt niets met de '
          + 'hand ingevuld.' };
  }
  var body = strLijst([
    strPaar('Publicatiestatus', strTekst(pub.status)),
    strPaar('Kanaal', strTekst(d.channel)),
    strPaar('Advertentieaccount', strTekst(pub.account_id)),
    strPaar('Datum live', strDatum(d.date_live)),
    strPaar('Spend', m.spend != null ? '€ ' + strGetal(m.spend) : null),
    strPaar('Vertoningen', strGetal(m.impressions)),
    strPaar('Resultaten', m.purchases == null ? null
      : m.purchases + ' aankopen · € ' + (strGetal(m.omzet) || '0') + ' omzet'),
    strPaar('CTR', strGetal(m.ctr, '%')),
    strPaar('CPA', m.cpa != null ? '€ ' + strGetal(m.cpa) : null),
    strPaar('ROAS', strGetal(m.roas)),
    strPaar('Beoordeelbaarheid', m.beoordeelbaar == null ? null
      : (m.beoordeelbaar ? 'genoeg dagen, budget en vertoningen om iets te mogen zeggen'
                         : 'Nog onvoldoende data — onder vier dagen, vijftig euro of duizend vertoningen')),
    strPaar('Datakwaliteit', m.alles_definitief == null ? null
      : (m.alles_definitief ? 'alle meetdagen zijn definitief'
                            : 'de attributie loopt nog na; deze cijfers kunnen bewegen')),
    strPaar('Verdict', d.verdict ? (STR_VERDICT[d.verdict] || d.verdict)
      + (d.verdict_reden ? ' — ' + strKort(strTekst(d.verdict_reden)) : '') : null)
  ]);
  return {
    kop: m.roas != null ? ('ROAS ' + strGetal(m.roas) + ' · ' + strMeetzin(m).replace(/\.$/, ''))
                        : strMeetzin(m).replace(/\.$/, ''),
    blokkade: m.beoordeelbaar === false ? 'nog onvoldoende data' : null,
    body: body
  };
}

/* ── E. Learning en vervolg ──────────────────────────────────────────────── */

function strDosLearning(d) {
  var l = d.learnings || [];
  var eigen = d.learning_kern || d.learning_behouden || d.learning_veranderen
           || d.iteratie_voorstel || d.vervolgtests || d.next_step;
  var body = '';

  if (eigen) {
    body += strLijst([
      strPaar('Belangrijkste learning', strTekst(d.learning_kern)),
      strPaar('Wat behouden moet blijven', strTekst(d.learning_behouden)),
      strPaar('Wat gewijzigd moet worden', strTekst(d.learning_veranderen)),
      strPaar('Aanbevolen iteratie', strTekst(d.iteratie_voorstel)),
      strPaar('Mogelijke vervolgtests', strTekst(d.vervolgtests)),
      strPaar('Vervolgstap', strTekst(d.next_step)),
      strPaar('Menselijke bevestiging', d.learning_bevestigd
        ? 'bevestigd door ' + (strTekst(d.learning_bevestigd_door) || 'een teamlid')
          + ' op ' + (strDatum(d.learning_bevestigd_op) || 'onbekende datum')
        : (d.learning_kern ? 'nog niet bevestigd — dit is een voorstel' : null))
    ]);
  }

  if (l.length) {
    body += '<div class="str-sub">Wat we op deze hoek al weten</div>'
      + l.map(function (x) {
          return '<div class="str-learning"><strong>' + strEsc(strTekst(x.hoek) || 'onbekende hoek')
            + ' bij ' + strEsc(strTekst(x.persona) || 'onbekende persona') + '</strong><br>'
            + x.advertenties + ' advertenties, € '
            + Number(x.spend || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })
            + ', ROAS ' + (x.roas == null ? '—' : Number(x.roas).toFixed(2))
            + '<br><small>' + (x.betrouwbaar
                ? 'Betrouwbaar: genoeg advertenties en budget om iets te mogen zeggen.'
                : 'Nog niet betrouwbaar — onder drie advertenties of onder €300 blijft dit een aanname.')
            + '</small></div>';
        }).join('');
  }

  return {
    kop: d.learning_kern ? (d.learning_bevestigd ? 'vastgelegd en bevestigd' : 'voorstel, nog niet bevestigd')
       : (l.length ? 'nog geen learning voor deze test' : 'Nog geen learning'),
    blokkade: (d.learning_kern && !d.learning_bevestigd) ? 'wacht op bevestiging' : null,
    body: body || null,
    leeg: 'Er is nog geen learning vastgelegd. Dat kan pas zinvol als er gemeten is — '
        + 'een conclusie zonder meting is een mening.'
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   De koppeling leggen

   De drie Google Search-varianten staan in de bibliotheek met hun beeld en hun
   copy, en in public.creatives als drie stubs. Ze horen bij elkaar, maar geen
   veld zegt welke bij welke.

   Automatisch koppelen op een gelijke kop zou hier werken en is toch fout: twee
   varianten uit één generatie kunnen dezelfde headline hebben, en dan hangt het
   beeld van variant 1 onder variant 2 zonder dat iemand het merkt. Een fout die
   je niet kunt zien is erger dan een vraag die je moet beantwoorden.

   Daarom kiest een mens, één keer, met de beelden ernaast.
   ═══════════════════════════════════════════════════════════════════════════ */

var _strKoppel = { creative: null, gekozen: null, bezig: false, fout: null };

/* De kandidaten: alles uit de bibliotheek dat nog nergens aan hangt. Gesorteerd
   op dezelfde generatie eerst, want daar zit het antwoord meestal. */
function strKandidaten(d) {
  var alles = (typeof state !== 'undefined' && state.library) ? state.library : [];
  var bezet = {};
  (_str.rijen || []).forEach(function (r) { if (r.bibliotheek_id) bezet[r.bibliotheek_id] = r.creative_id; });
  return alles
    .filter(function (i) { return i && i.id && !bezet[i.id]; })
    .map(function (i) {
      var v = i.variation || {}, m = i.metadata || {};
      return {
        id: i.id, batch_id: i.batch_id || null,
        variant_index: (i.variant_index == null ? null : i.variant_index),
        headline: v.headline_nl || v.headline || '',
        body: v.body_copy_nl || v.body_copy || '',
        cta: v.cta_nl || v.cta || '',
        visual: v.visual_nl || '', prompt: v.image_prompt_en || '',
        product: m.product || '', format: m.format || i.batch_title || '',
        image: i.image || null,
        zelfde: !!(d.batch_id && i.batch_id === d.batch_id)
      };
    })
    .sort(function (a, b) {
      if (a.zelfde !== b.zelfde) return a.zelfde ? -1 : 1;
      return (a.variant_index || 0) - (b.variant_index || 0);
    });
}

function strKoppelOpen(id) {
  var d = _str.dossier;
  if (!d || d.creative_id !== id) return;
  _strKoppel = { creative: d, gekozen: null, bezig: false, fout: null };
  strKoppelTeken();
}
function strKoppelSluit() {
  _strKoppel.creative = null;
  var o = document.getElementById('str-koppel'); if (o) o.remove();
}
function strKoppelKies(libId) { _strKoppel.gekozen = libId; strKoppelTeken(); }

function strKoppelTeken() {
  var oud = document.getElementById('str-koppel'); if (oud) oud.remove();
  var d = _strKoppel.creative; if (!d) return;
  var kandidaten = strKandidaten(d);

  var o = document.createElement('div');
  o.id = 'str-koppel'; o.className = 'str-dos-overlay';
  var h = '<div class="str-dos str-koppel">'
    + '<div class="str-dos-kop"><strong>Welke variant is dit?</strong>'
    + '<button class="str-x" onclick="strKoppelSluit()" aria-label="Sluiten">×</button></div>'
    + '<p class="str-sec-noot">De rij in Creative Strategy heet <em>' + strEsc(d.ad_name || 'naamloos')
    + '</em>. Kies hieronder welk bibliotheekitem daarbij hoort. Het systeem doet dit niet '
    + 'voor je: twee varianten uit één generatie kunnen dezelfde kop hebben, en dan zou het '
    + 'beeld van de een onder de ander belanden.</p>';

  if (!kandidaten.length) {
    h += '<p class="str-sec-leeg">Er staat geen enkele vrije bibliotheekvariant in deze browser. '
      + 'Open eerst de Bibliotheek — die wordt per browser bewaard, dus hij moet een keer '
      + 'geladen zijn voordat hij hier te kiezen is.</p>';
  } else {
    h += '<div class="str-kandidaten">' + kandidaten.map(function (k) {
      return '<label class="str-kandidaat' + (_strKoppel.gekozen === k.id ? ' str-kandidaat--aan' : '')
        + (k.zelfde ? ' str-kandidaat--zelfde' : '') + '">'
        + '<input type="radio" name="str-kandidaat"' + (_strKoppel.gekozen === k.id ? ' checked' : '')
        +   ' onchange="strKoppelKies(\'' + strEsc(k.id) + '\')">'
        + (k.image ? '<img alt="" src="' + strEsc(k.image) + '">'
                   : '<span class="str-kandidaat-geenbeeld">geen beeld</span>')
        + '<span class="str-kandidaat-tekst">'
        +   '<strong>' + strEsc(k.headline || 'geen kop') + '</strong>'
        +   (k.variant_index != null ? '<span class="str-kandidaat-nr">variant '
              + (k.variant_index + 1) + '</span>' : '')
        +   '<small>' + strEsc(k.id) + '</small>'
        +   (k.zelfde ? '<small class="str-let-op">uit dezelfde generatie</small>' : '')
        + '</span></label>';
    }).join('') + '</div>';
  }

  if (_strKoppel.fout) h += '<p class="str-fout">' + strEsc(_strKoppel.fout) + '</p>';

  h += '<div class="str-acties">'
    + '<button class="str-knop str-knop--aan" ' + (_strKoppel.gekozen && !_strKoppel.bezig ? '' : 'disabled ')
    +   'onclick="strKoppelBevestig()">' + (_strKoppel.bezig ? 'Bezig...' : 'Koppel deze variant') + '</button>'
    + '<button class="str-knop" onclick="strKoppelSluit()">Annuleren</button>'
    + '<span class="str-actie-hoe">Dit legt de koppeling vast en vult alleen velden die nu leeg zijn. '
    +   'Wat er al staat blijft staan.</span>'
    + '</div></div>';

  o.innerHTML = h;
  document.body.appendChild(o);
  o.addEventListener('click', function (e) { if (e.target === o) strKoppelSluit(); });
}

function strKoppelBevestig() {
  var sb = strSb(), d = _strKoppel.creative;
  if (!sb || !d || !_strKoppel.gekozen) return;
  var k = strKandidaten(d).filter(function (x) { return x.id === _strKoppel.gekozen; })[0];
  if (!k) return;
  _strKoppel.bezig = true; _strKoppel.fout = null; strKoppelTeken();

  sb.rpc('hq_creative_koppelen', { p: {
    creative_id: d.creative_id, bibliotheek_id: k.id,
    batch_id: k.batch_id, variant_index: k.variant_index,
    headline: k.headline, body_copy: k.body, cta: k.cta,
    visual_concept: k.visual, image_prompt: k.prompt, format: k.format,
    image_b64: k.image || null
  }}).then(function (r) {
    _strKoppel.bezig = false;
    if (r && r.error) { _strKoppel.fout = r.error.message; strKoppelTeken(); return; }
    strKoppelSluit();
    if (typeof toast === 'function') toast('Gekoppeld aan ' + k.id);
    /* De tabel én het open dossier opnieuw ophalen: de rij is veranderd, en
       een scherm dat de oude stand blijft tonen is een tweede waarheid. */
    var id = d.creative_id;
    strVernieuw();
    setTimeout(function () { strDossier(id); }, 400);
  }).catch(function (e) {
    _strKoppel.bezig = false;
    _strKoppel.fout = (e && e.message) || 'De koppeling lukte niet.';
    strKoppelTeken();
  });
}
