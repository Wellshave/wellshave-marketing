/* ═══════════════════════════════════════════════════════════════════════════
   Het team — de mensen

   Beslisvraag (opgeschreven vóór deze regel code):

       "Wie is dit, en wat doet die voor mij?"

   Hier stonden mensen en agents naast elkaar, met de redenering dat Atlas voor
   wie het systeem gebruikt net zo goed een collega was als Willem. Sinds de
   agents eruit zijn klopt die pagina niet meer, en het is geen kwestie van een
   lege sectie verbergen: de hele tweedeling was de vorm. Wat overblijft is een
   teampagina, en dat is precies wat het is.

   Twee dingen bepalen wat er nu staat.

   1. Wie hier staat, staat er omdat een beheerder het account heeft
      goedgekeurd. Er is geen tweede soort deelnemer meer.

   2. Wie zichzelf nog niet heeft voorgesteld, laat een gat zien. Geen
      opgevulde placeholder, geen "geen omschrijving beschikbaar" — een
      uitnodiging, met een knop. Een lege plek die eruitziet als een lege plek
      wordt ingevuld; een nette standaardzin blijft twee jaar staan.

   Dit bestand schrijft één ding: je eigen introductie, via
   hq_stel_jezelf_voor(). Die functie raakt alleen jouw rij aan en alleen twee
   velden — niet je rol en niet je rechten.
   ═══════════════════════════════════════════════════════════════════════════ */

var _team = { rijen: null, fout: null, laden: false, geladen: false, bewerken: false, bezig: false };

function teamEsc(t) { return escapeHtml(t == null ? '' : String(t)); }
function teamSb() { return (window._sb && window._authProfile && window._authProfile.id) ? window._sb : null; }
function teamIk() { return (window._authProfile && window._authProfile.id) || null; }

/* ── ophalen ─────────────────────────────────────────────────────────────── */

function renderTeam() {
  var sb = teamSb();
  var mount = document.getElementById('team-mount');
  if (!mount) return;
  if (!sb) {
    mount.innerHTML = '<div class="str"><p class="str-vraag">Wie werkt hier?</p>'
      + '<div class="loading-card">Log in om het team te zien.</div></div>';
    return;
  }
  if (_team.geladen) { teamTeken(); return; }
  _team.laden = true; teamTeken();

  sb.from('hq_team').select('*')
    .then(function (r) {
      _team.laden = false; _team.geladen = true;
      if (r && r.error) { _team.fout = r.error.message; _team.rijen = null; }
      else { _team.rijen = (r && r.data) || []; }
      teamTeken();
    })
    .catch(function (e) {
      _team.laden = false; _team.geladen = true;
      _team.fout = (e && e.message) || String(e); teamTeken();
    });
}
function teamVernieuw() { _team.geladen = false; _team.rijen = null; _team.fout = null; renderTeam(); }

/* ── jezelf voorstellen ──────────────────────────────────────────────────── */

function teamBewerk() { _team.bewerken = true; teamTeken(); }
function teamStop() { _team.bewerken = false; teamTeken(); }

function teamBewaar() {
  var sb = teamSb();
  if (!sb || _team.bezig) return;
  var tekst = (document.getElementById('team-voorstellen') || {}).value || '';
  var titel = (document.getElementById('team-roltitel') || {}).value || '';
  _team.bezig = true; teamTeken();

  /* Via de functie en niet via een update op de tabel: die functie schrijft
     alleen in de rij van wie hem aanroept, en alleen in deze twee velden.
     Een rechtstreekse update zou een policy nodig hebben die per rij werkt en
     niet per kolom — en dan mag iedereen ook zijn eigen rechten aanpassen. */
  sb.rpc('hq_stel_jezelf_voor', { p: { voorstellen: tekst, rol_titel: titel } })
    .then(function (r) {
      _team.bezig = false;
      if (r && r.error) { _team.fout = r.error.message; teamTeken(); return; }
      _team.bewerken = false;
      teamVernieuw();
    })
    .catch(function (e) {
      _team.bezig = false;
      _team.fout = (e && e.message) || String(e); teamTeken();
    });
}

/* ── opmaak ──────────────────────────────────────────────────────────────── */

function teamKaart(r, isIk) {
  var h = '<article class="team-kaart' + (isIk ? ' team-kaart--ik' : '') + '">';

  h += '<header class="team-kop">'
    + '<div class="team-avatar team-avatar--mens">'
    +   teamEsc((r.naam || '?').trim().charAt(0).toUpperCase()) + '</div>'
    + '<div><h3 class="team-naam">' + teamEsc(r.naam)
    +   (isIk ? ' <span class="team-jij">jij</span>' : '') + '</h3>'
    + '<p class="team-rol">' + teamEsc(r.rol || '') + '</p></div></header>';

  if (r.voorstellen) {
    h += '<p class="team-voorstellen">' + teamEsc(r.voorstellen) + '</p>';
  } else if (isIk) {
    /* De uitnodiging staat alleen bij jezelf. Bij een collega is een lege plek
       geen taak voor jou. */
    h += '<p class="team-leeg">Je hebt jezelf nog niet voorgesteld. '
      +  '<button class="str-knop" onclick="teamBewerk()">Doe dat nu</button></p>';
  } else {
    h += '<p class="team-leeg">Heeft zichzelf nog niet voorgesteld.</p>';
  }

  /* Alleen als er al iets staat. Is de kaart nog leeg, dan zit de uitnodiging
     al in het lege blok hierboven en zouden er twee knoppen staan die hetzelfde
     doen -- dat leest als twee verschillende dingen. */
  if (isIk && r.voorstellen && !_team.bewerken) {
    h += '<button class="str-knop team-bewerk" onclick="teamBewerk()">Bewerk je introductie</button>';
  }
  return h + '</article>';
}

function teamFormulier(ik) {
  return '<div class="team-formulier">'
    + '<h3 class="team-h3">Stel jezelf voor</h3>'
    + '<p class="team-uitleg">Eén alinea is genoeg. Waar ben je van, waar kunnen collega\'s '
    +   'je voor halen, en wat doe je liever niet. Dit staat op de teampagina, verder nergens.</p>'
    + '<label class="team-label">Je rol, in je eigen woorden</label>'
    + '<input id="team-roltitel" class="str-zoek team-input" type="text" maxlength="60" '
    +   'placeholder="Bijvoorbeeld: Merkstrateeg" value="' + teamEsc(ik && ik.rol_titel || '') + '">'
    + '<label class="team-label">Je introductie</label>'
    + '<textarea id="team-voorstellen" class="team-textarea" rows="5" maxlength="600" '
    +   'placeholder="Ik ben...">' + teamEsc(ik && ik.voorstellen || '') + '</textarea>'
    + '<div class="team-knoppen">'
    +   '<button class="str-knop str-knop--aan" onclick="teamBewaar()"'
    +     (_team.bezig ? ' disabled' : '') + '>' + (_team.bezig ? 'Bezig...' : 'Bewaren') + '</button>'
    +   '<button class="str-knop" onclick="teamStop()">Annuleren</button>'
    + '</div></div>';
}

/* ── tekenen ─────────────────────────────────────────────────────────────── */

function teamTeken() {
  var mount = document.getElementById('team-mount');
  if (!mount) return;

  var kop = '<div class="str"><p class="str-vraag">Wie werkt hier, en wat doet die voor mij?</p>';

  if (_team.laden) { mount.innerHTML = kop + '<div class="loading-card">Het team laadt...</div></div>'; return; }
  if (_team.fout) {
    mount.innerHTML = kop + '<div class="loading-card"><strong>Het team kon niet worden geladen.</strong><br>'
      + teamEsc(_team.fout) + '<br><br>Staat migratie <code>0040_teampagina.sql</code> in Supabase? '
      + 'Zonder die view bestaat <code>hq_team</code> niet.</div></div>';
    return;
  }
  var alle = _team.rijen || [];
  if (!alle.length) {
    mount.innerHTML = kop + '<div class="loading-card">Er is nog niemand om te tonen. '
      + 'De teampagina is alleen zichtbaar voor een goedgekeurd teamlid.</div></div>';
    return;
  }

  var ikId = teamIk();
  var mensen = alle.slice()
    .sort(function (a, b) { return String(a.naam).localeCompare(String(b.naam)); });
  var ik = mensen.filter(function (r) { return r.id === ikId; })[0];

  var h = kop;

  if (_team.bewerken) h += teamFormulier(ik);

  /* De twee specialisten bovenaan en de mensen eronder. Niet omdat ze
     belangrijker zijn, maar omdat de vraag boven deze pagina "wat doet die
     voor mij" is, en dat bij hen het meest onzichtbaar is: hun oordeel zit in
     schermen die je gebruikt zonder dat hun naam erbij staat. */
  if (typeof specSectie === 'function') h += specSectie();

  h += '<section class="team-sectie">'
    + '<h2 class="team-h2">De mensen</h2>'
    + '<p class="team-sectie-uitleg">Wie hier staat, staat er omdat een beheerder '
    + 'het account heeft goedgekeurd. Iedereen schrijft zijn eigen introductie.</p>'
    + '<div class="team-raster">'
    + mensen.map(function (r) { return teamKaart(r, r.id === ikId); }).join('')
    + '</div></section>';

  h += '<p class="trk-telling"><a href="javascript:void(0)" onclick="teamVernieuw()">vernieuwen</a></p>';
  mount.innerHTML = h + '</div>';
}
