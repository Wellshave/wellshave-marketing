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
  filters: {}, selectie: {}, kolomkiezer: false,
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
  { id: 'verantwoordelijke', naam: 'Wie',       standaard: true },
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
  { id: 'roas',                 naam: 'ROAS',   soort: 'getal' },
  { id: 'ctr',                  naam: 'CTR',    soort: 'getal' },
  { id: 'verdict',              naam: 'Verdict' },
  { id: 'next_step',            naam: 'Learning / vervolg' }
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
function strFiltersLeeg() { _str.filters = {}; _str.zoek = ''; strTeken(); }

function strZichtbaar() {
  var rijen = (_str.rijen || []).slice();
  Object.keys(_str.filters).forEach(function (v) {
    var w = _str.filters[v];
    if (w) rijen = rijen.filter(function (r) { return String(r[v] || '') === w; });
  });
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
  return strEsc(String(w).length > 90 ? String(w).slice(0, 88) + '…' : w);
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
    h += '<tr class="str-rij str-rij--' + g.id + '" onclick="strDossier(' + r.creative_id + ')">'
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

function strDossierTeken(d) {
  var oud = document.getElementById('str-dos'); if (oud) oud.remove();
  var o = document.createElement('div');
  o.id = 'str-dos'; o.className = 'str-dos-overlay';

  if (d._laden) { o.innerHTML = '<div class="str-dos"><div class="loading-card">Dossier laden...</div></div>'; }
  else if (d._fout) {
    o.innerHTML = '<div class="str-dos"><div class="str-dos-kop"><strong>Dossier</strong>'
      + '<button class="str-x" onclick="strDossierSluit()">×</button></div>'
      + '<p class="str-sec-leeg">' + strEsc(d._fout) + '</p></div>';
  } else {
    var m = d.meting || {}, pub = d.publicatie || {};
    var h = '<div class="str-dos"><div class="str-dos-kop"><strong>' + strEsc(d.ad_name || 'Creative')
      + '</strong><span class="str-status str-status--' + strGroep(d).id + '">'
      + strEsc(strGroep(d).naam) + '</span>'
      + '<button class="str-x" onclick="strDossierSluit()" aria-label="Sluiten">×</button></div>';

    // A. Testsamenvatting
    h += strSec('A · De test', '<dl class="str-dl">'
      + strPaar('Status', d.status) + strPaar('Product', d.product)
      + strPaar('Persona', d.persona) + strPaar('Angle', d.marketing_angle)
      + strPaar('Awareness', d.awareness_level)
      + strPaar('Sophistication', d.sophistication_naam
          ? d.sophistication + ' · ' + d.sophistication_naam
            + (d.sophistication_bevestigd ? ' (bevestigd)' : ' (voorstel, nog niet bevestigd)') : null)
      + strPaar('Hypothese', d.hypothesis) + strPaar('Testvariabele', d.test_variable)
      + strPaar('Verantwoordelijke', d.verantwoordelijke)
      + strPaar('Volgende stap', d.volgende_stap) + '</dl>');

    // B. Creative
    h += strSec('B · De creative',
      (d.heeft_beeld ? '' : '<p class="str-sec-leeg">Er is nog geen beeld gegenereerd.</p>')
      + '<dl class="str-dl">'
      + strPaar('Headline', d.headline) + strPaar('Body copy', d.body_copy)
      + strPaar('CTA', d.cta) + strPaar('Format', d.format)
      + strPaar('Media type', d.media_type) + strPaar('Kanaal', d.channel)
      + strPaar('Visueel concept', d.visual_concept)
      + strPaar('Image prompt', d.image_prompt) + '</dl>');

    // C. Strategische herkomst
    var regels = d.denkstuk_regels || [];
    h += strSec('C · Waar dit vandaan komt',
      '<dl class="str-dl">'
      + strPaar('Redenering van Rory', d.rory_reasoning)
      + strPaar('Aanscherping van Theriot', d.theriot_reasoning)
      + strPaar('Onderbouwing', d.onderbouwing) + '</dl>'
      + (regels.length
        ? '<table class="str-mini"><thead><tr><th>Vraag</th><th>Antwoord</th><th>Zekerheid</th></tr></thead><tbody>'
          + regels.map(function (r) {
              return '<tr class="str-zeker--' + strEsc(r.zekerheid || 'leeg') + '"><td>' + strEsc(r.tekst) + '</td>'
                + '<td>' + (r.antwoord ? strEsc(r.antwoord) : '<em>onbeantwoord</em>') + '</td>'
                + '<td>' + strEsc(r.zekerheid || '—') + (r.bron ? '<br><small>' + strEsc(r.bron) + '</small>' : '')
                + '</td></tr>'; }).join('')
          + '</tbody></table>'
        : '<p class="str-sec-leeg">Er hangt geen denkstuk aan deze creative — deze test rust nergens op.</p>'));

    // D. Werkstuk en agents
    var stappen = d.stappen || [], overdrachten = d.overdrachten || [],
        oordelen = d.oordelen || [], discussies = d.discussies || [];
    h += strSec('D · Het werkstuk en wie wat deed',
      (d.werkstuk ? '<p class="str-werkstuk">' + strEsc(d.werkstuk) + '</p>' : '')
      + (stappen.length
        ? '<table class="str-mini"><thead><tr><th>Station</th><th>Wie</th><th>Status</th><th>Waarom</th></tr></thead><tbody>'
          + stappen.map(function (s) {
              return '<tr><td>' + s.station + ' · ' + strEsc(s.naam) + '</td><td>' + strEsc(s.wie)
                + '</td><td>' + strEsc(s.status) + '</td><td>' + strEsc(s.waarom || '—') + '</td></tr>'; }).join('')
          + '</tbody></table>' : '')
      + (oordelen.length
        ? '<div class="str-oordeel"><strong>Criticus: ' + strEsc(oordelen[0].oordeel) + '</strong> — '
          + strEsc(oordelen[0].reden) + '</div>'
        : '<p class="str-sec-leeg">De Criticus heeft hier nog geen oordeel over geveld.</p>')
      + (overdrachten.length
        ? overdrachten.map(function (t) {
            return '<div class="str-overdracht"><strong>' + t.van_station + ' → ' + (t.naar_station || '?')
              + '</strong> ' + strEsc(t.besluit)
              + '<br><small>Te controleren: ' + strEsc(t.controleren) + '</small>'
              + (t.mens_nodig ? '<br><small class="str-let-op">Er moet een mens bij.</small>' : '')
              + '</div>'; }).join('') : '')
      + (discussies.length
        ? '<div class="str-sub">Discussies</div>' + discussies.map(function (b) {
            return '<div class="str-bericht"><strong>' + strEsc(b.van) + ' → ' + strEsc(b.aan) + '</strong> '
              + strEsc(b.onderwerp) + (b.gelezen ? '' : ' <em>(nooit opgehaald)</em>')
              + '<p>' + strEsc(b.body) + '</p></div>'; }).join('')
        : ''));

    // E. Publicatie en performance — alleen gemeten, nooit ingevuld
    h += strSec('E · Live en gemeten',
      (m.spend != null || pub.status
        ? '<dl class="str-dl">'
          + strPaar('Account', pub.account_id) + strPaar('Publicatiestatus', pub.status)
          + strPaar('Live sinds', d.date_live) + strPaar('Spend', m.spend)
          + strPaar('Impressies', m.impressions) + strPaar('CTR', m.ctr)
          + strPaar('CPA', m.cpa) + strPaar('ROAS', m.roas)
          + strPaar('Dagen live', m.dagen_live)
          + strPaar('Beoordeelbaar', m.beoordeelbaar == null ? null
              : (m.beoordeelbaar ? 'ja' : 'nog niet — onder de drempel van 0008'))
          + strPaar('Alle dagen definitief', m.alles_definitief == null ? null
              : (m.alles_definitief ? 'ja' : 'nee, de attributie loopt nog na'))
          + '</dl>'
        : null),
      'Deze creative heeft nog niet gedraaid. Zodra hij live staat, vult Atlas dit vanzelf.');

    // F. Learning en vervolg
    var l = d.learnings || [];
    /* De volgende stap hoort erbij, maar hij mag de lege sectie niet vullen:
       anders leest "nog niets geleerd" als "er staat iets" terwijl er alleen
       een vervolgveld is. Vandaar het aparte staartje ná de sectie-uitleg. */
    var vervolg = '<dl class="str-dl">' + strPaar('Volgende stap', d.next_step) + '</dl>';
    h += strSec('F · Wat we hieruit leerden',
      (l.length
        ? l.map(function (x) {
            return '<div class="str-learning"><strong>' + strEsc(x.hoek) + ' bij ' + strEsc(x.persona)
              + '</strong><br>' + x.advertenties + ' advertenties, € '
              + Number(x.spend || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })
              + ', ROAS ' + (x.roas == null ? '—' : Number(x.roas).toFixed(2))
              + '<br><small>' + (x.betrouwbaar
                  ? 'Betrouwbaar: genoeg advertenties en budget om iets te mogen zeggen.'
                  : 'Nog niet betrouwbaar — onder drie advertenties of onder €300 blijft dit een aanname.')
              + '</small></div>'; }).join('') + vervolg
        : null),
      'Er is nog niets geleerd op deze hoek. Dat komt pas als een batch is afgerond.');
    if (!l.length) h = h.replace(/<\/section>$/, vervolg + '</section>');

    h += '</div>';
    o.innerHTML = h;
  }

  document.body.appendChild(o);
  o.addEventListener('click', function (e) { if (e.target === o) strDossierSluit(); });
}
