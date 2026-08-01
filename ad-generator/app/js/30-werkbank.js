/* ═══════════════════════════════════════════════════════════════════════════
   De werkbank — de werkruimte om het agentteam te managen

   Beslisvraag (regel 0.1, opgeschreven vóór deze regel code en vóór migratie
   0019):

       "Welk werk ligt stil, en op wie wacht het?"

   De eenheid op dit scherm is het WERKSTUK en niet de agent. Dat is hoofdstuk
   3 van het ontwerpcontract, en het is de enige regel die je hier echt kunt
   overtreden: het templateantwoord voor een agentsysteem is een raster van
   negen kaartjes met statusbolletjes. Dat toont negen wezens die iets doen,
   maar nooit dat ze sámen ergens uitkomen — en dat laatste is precies wat dit
   systeem moet laten zien.

   Dus staat er per idee de hele keten, inclusief de stations die nog niet
   gebeurd zijn. Die lege stations zijn de informatie: daar ligt het stil.

   Dit bestand rekent niets uit. `te_stil`, `wacht_op` en `waarom` komen
   rechtstreeks uit `public.hq_werkbank`.
   ═══════════════════════════════════════════════════════════════════════════ */

var _wbk = { rijen: null, fout: null, laden: false, geladen: false };

function wbkEsc(t) { return escapeHtml(t == null ? '' : String(t)); }

function wbkSb() { return (window._sb && window._authProfile && window._authProfile.id) ? window._sb : null; }

/* ── ophalen ────────────────────────────────────────────────────────────── */

function renderWerkbank() {
  var sb = wbkSb();
  var mount = document.getElementById('wbk-mount');
  if (!mount) return;
  if (!sb) {
    mount.innerHTML = wbkKop()
      + wbkLeeg('Log in om de werkbank te zien.',
          ['De werkbank leest mee met wie er kijkt. Zonder inloggen is er niets te tonen — '
           + 'niet omdat het verborgen is, maar omdat de database niet weet wie je bent.'])
      + '</div>';
    return;
  }
  if (_wbk.geladen) { wbkRender(); return; }
  _wbk.laden = true;
  wbkRender();

  sb.from('hq_werkbank')
    .select('id,brand,titel,product,persona,angle_type,toestand,stappen_af,station_nu,stappen,'
          + 'aantal_ads,spend,omzet,roas,winnaars,station_naam,overdracht,wacht_op,'
          + 'stil_uren,stil_grens_uren,te_stil,waarom')
    .order('te_stil', { ascending: false })
    .order('stil_uren', { ascending: false })
    .then(function (r) {
      _wbk.laden = false;
      _wbk.geladen = true;
      if (r && r.error) { _wbk.fout = r.error.message; _wbk.rijen = null; }
      else { _wbk.rijen = (r && r.data) || []; }
      wbkRender();
    })
    .catch(function (e) {
      _wbk.laden = false; _wbk.geladen = true;
      _wbk.fout = (e && e.message) || String(e);
      wbkRender();
    });
}

function wbkVernieuw() { _wbk.geladen = false; _wbk.fout = null; _wbk.rijen = null; renderWerkbank(); }

/* ── de estafette ───────────────────────────────────────────────────────── */

/* De zes stations liggen vast in de database (0009). Ze staan hier ook, zodat
   een werkstuk zonder vastgelegde stappen tóch zijn volledige keten toont —
   een keten met gaten is informatie, een keten die half wegvalt is een bug. */
var WBK_STATIONS = [
  { nr: 1, naam: 'signaal',  agent: 'Radar' },
  { nr: 2, naam: 'briefing', agent: 'Nova' },
  { nr: 3, naam: 'creatie',  agent: 'jij' },
  { nr: 4, naam: 'live',     agent: 'Bolt' },
  { nr: 5, naam: 'meting',   agent: 'Atlas' },
  { nr: 6, naam: 'oogst',    agent: 'Echo' }
];

function wbkStap(station, stap, stationNu) {
  var status = stap ? stap.status : 'open';
  var klaar = status === 'klaar';
  var fout = status === 'mislukt';
  var nu = !klaar && !fout && station.nr === stationNu;
  var toekomst = !klaar && !fout && !nu;

  // Een afgeronde stap krijgt een vinkje en niet alleen een kleur (regel 4.4).
  var teken = klaar ? '✓' : fout ? '!' : nu ? '●' : station.nr;
  var soort = klaar ? 'klaar' : fout ? 'fout' : nu ? 'nu' : 'open';

  var agent = (stap && stap.agent) ? stap.agent : station.agent;
  if (stap && stap.overdracht === 'mens') agent = 'jij';

  return '<div class="wbk-stap' + (toekomst ? ' wbk-stap--toekomst' : '') + '"'
    + ' title="' + wbkEsc(stap && stap.waarom ? stap.waarom : station.naam) + '">'
    + '<div class="wbk-bol wbk-bol--' + soort + '">' + teken + '</div>'
    + '<div class="wbk-stap-naam">' + wbkEsc(station.naam) + '</div>'
    + '<div class="wbk-stap-agent">' + wbkEsc(agent) + '</div>'
    + '</div>';
}

function wbkKeten(w) {
  var perStation = {};
  (w.stappen || []).forEach(function (s) { if (s && s.station) perStation[s.station] = s; });
  var h = '<div class="wbk-keten">';
  WBK_STATIONS.forEach(function (st) { h += wbkStap(st, perStation[st.nr], w.station_nu); });
  return h + '</div>';
}

/* ── één werkstuk ───────────────────────────────────────────────────────── */

function wbkStuk(w) {
  var onder = [w.product, w.persona, w.angle_type || 'hoek nog open']
    .filter(function (x) { return x; }).map(wbkEsc).join(' · ');

  // Wacht het op jou, dan is dat een beslissing die klaarligt (regel 3.3).
  var wacht = w.wacht_op
    ? '<span class="wbk-wacht-op">' + (w.wacht_op === 'jij' ? 'Wacht op jou' : 'Wacht op ' + wbkEsc(w.wacht_op)) + '</span>'
    : '<span class="wbk-wacht-op">Niemand wacht</span>';

  // Stilte staat er als getal én als woord, met de grens erbij zodat je kunt
  // zien waarom 77 uur wél en 30 uur niet te lang is.
  var stil = '<span class="wbk-chip' + (w.te_stil ? ' wbk-chip--stil' : '') + '">'
    + w.stil_uren + ' uur stil'
    + (w.te_stil ? ' — te lang' : ' van ' + w.stil_grens_uren)
    + '</span>';

  var cijfers = '';
  if (w.aantal_ads) {
    cijfers = '<div class="wbk-cijfers">'
      + '<span>' + w.aantal_ads + ' advertentie' + (w.aantal_ads === 1 ? '' : 's') + '</span>'
      + '<span>uitgegeven <b>€ ' + Number(w.spend || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 }) + '</b></span>'
      + (w.roas != null ? '<span>ROAS <b>' + Number(w.roas).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</b></span>' : '')
      + (w.winnaars ? '<span>' + w.winnaars + ' winnaar' + (w.winnaars === 1 ? '' : 's') + '</span>' : '')
      + '</div>';
  }

  return '<div class="wbk-stuk' + (w.te_stil ? ' wbk-stuk--stil' : '') + '">'
    + '<h3 class="wbk-titel">' + wbkEsc(w.titel) + '</h3>'
    + '<p class="wbk-onder">' + onder + '</p>'
    + wbkKeten(w)
    + '<div class="wbk-teller">' + w.stappen_af + ' van 6 stations af</div>'
    + '<div class="wbk-wacht">'
    +   wacht
    +   '<span class="wbk-wacht-tekst">' + wbkEsc(w.waarom) + '</span>'
    +   stil
    + '</div>'
    + cijfers
    + '</div>';
}

/* ── groepen ────────────────────────────────────────────────────────────── */

function wbkLeeg(kop, alineas) {
  var h = '<div class="wbk-leeg"><div class="wbk-leeg-kop">' + wbkEsc(kop) + '</div>';
  alineas.forEach(function (p) { h += '<p>' + p + '</p>'; });
  return h + '</div>';
}

function wbkGroep(titel, rijen, uitleg, leegReden) {
  var h = '<div class="wbk-groep">'
    + '<div class="wbk-groep-kop">' + wbkEsc(titel) + ' (' + rijen.length + ')</div>';
  if (uitleg) h += '<p class="wbk-groep-uitleg">' + uitleg + '</p>';
  // Een lege groep is een uitkomst met een reden, geen leeg vlak (regel 0.4).
  if (!rijen.length) h += wbkLeeg(leegReden.kop, leegReden.tekst);
  rijen.forEach(function (w) { h += wbkStuk(w); });
  return h + '</div>';
}

function wbkKop() {
  return '<div class="wbk">'
    + '<h2 class="wbk-vraag">Welk werk ligt stil, en op wie wacht het?</h2>';
}

/* ── tekenen ────────────────────────────────────────────────────────────── */

function wbkRender() {
  var mount = document.getElementById('wbk-mount');
  if (!mount) return;

  if (_wbk.laden) {
    mount.innerHTML = wbkKop() + '<div class="loading-card">De werkbank laden...</div></div>';
    return;
  }

  if (_wbk.fout) {
    mount.innerHTML = wbkKop() + wbkLeeg('De werkbank kon niet worden geladen.', [
      wbkEsc(_wbk.fout),
      'Staat migratie <code>0019_brein.sql</code> al in Supabase? Zonder die view '
      + 'bestaat <code>hq_werkbank</code> niet.'
    ]) + '</div>';
    return;
  }

  var rijen = _wbk.rijen || [];

  if (!rijen.length) {
    mount.innerHTML = wbkKop() + wbkLeeg('Er is nog geen werkstuk.', [
      'Een werkstuk is één idee dat langs zes stations reist: van het signaal uit de '
      + 'markt tot de landingspagina. Zodra Radar of Nova er een start — of jij er zelf '
      + 'een aanmaakt — staat hier waar het ligt en op wie het wacht.'
    ]) + '</div>';
    return;
  }

  var stil  = rijen.filter(function (w) { return w.te_stil; });
  var loopt = rijen.filter(function (w) { return !w.te_stil && w.toestand !== 'klaar' && w.toestand !== 'gestopt'; });
  var af    = rijen.filter(function (w) { return w.toestand === 'klaar' || w.toestand === 'gestopt'; });

  var jij = rijen.filter(function (w) { return w.wacht_op === 'jij'; }).length;

  var bron = '<p class="wbk-bron">'
    + rijen.length + ' werkstuk' + (rijen.length === 1 ? '' : 'ken') + ' · '
    + (jij ? '<strong>' + jij + '</strong> wacht' + (jij === 1 ? '' : 'en') + ' op jou' : 'geen enkel wacht op jou')
    + ' · <a href="javascript:void(0)" onclick="wbkVernieuw()">vernieuwen</a></p>';

  var h = wbkKop() + bron;

  h += wbkGroep('Te lang stil', stil,
    'Stilte telt per soort overdracht: een stap die vanzelf door hoort te lopen mag een dag '
    + 'stil zijn, een poort drie dagen, creatief werk een week. Wat hier staat is daar '
    + 'overheen — niet zomaar "lang geleden".',
    { kop: 'Niets ligt te lang stil.',
      tekst: ['Elk lopend werkstuk is recenter aangeraakt dan wat bij zijn soort overdracht '
            + 'normaal is. Er is vandaag niets dat om die reden je aandacht vraagt.'] });

  h += wbkGroep('Loopt', loopt, null,
    { kop: 'Er loopt op dit moment niets.',
      tekst: ['Alles staat óf te lang stil óf is afgerond. Als de bovenste lijst ook leeg is, '
            + 'wacht het systeem op een nieuw signaal van Radar of een nieuw idee van jou.'] });

  h += wbkGroep('Af of gestopt', af, null,
    { kop: 'Nog niets afgerond of gestopt.',
      tekst: ['Een werkstuk is af als alle zes de stations gedaan zijn, en gestopt als iemand '
            + 'het bewust heeft stilgezet — met de reden erbij, want dat is een constraint '
            + 'en geen goed voornemen.'] });

  mount.innerHTML = h + '</div>';
}
