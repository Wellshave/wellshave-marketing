/* ═══════════════════════════════════════════════════════════════════════════
   Het dagbesluit — bovenaan de Creative Strategy-tab

   Beslisvraag (regel 0.1, opgeschreven vóór de eerste regel code en ook vóór
   migratie 0018):

       "Welke advertentie zet ik vandaag uit, en welke geef ik meer budget?"

   Dit bestand rekent niets uit. Alles wat hier op het scherm komt — het
   oordeel, de handeling, de volgorde, de reden — staat al in
   `public.hq_dagbesluit`. Dat is met opzet: een berekening die ook in de
   browser gebeurt, is een tweede plek waar het antwoord kan afwijken van wat
   de database zegt.

   Dit scherm is de reden dat "de agents eruit" geen verlies aan oordeel is. Wat
   hier staat — welke advertentie je vandaag zou uitzetten en welke meer budget
   verdient — komt uit een view over de gemeten cijfers. Daar kwam nooit een
   model aan te pas, en het is precies het soort besluit dat overblijft als je
   het systeem intern slimmer maakt in plaats van er een agent op te zetten.

   De tabel eronder blijft precies zoals hij was.
   ═══════════════════════════════════════════════════════════════════════════ */

var _dbs = { rijen: null, fout: null, laden: false, merk: null };

function dbsEsc(t) { return escapeHtml(t == null ? '' : String(t)); }

function dbsEuro(v) {
  if (v == null || v === '') return '—';
  var n = Math.abs(Number(v));
  if (isNaN(n)) return '—';
  return '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function dbsGetal(v, dec) {
  if (v == null || v === '') return '—';
  var n = Number(v);
  if (isNaN(n)) return '—';
  return n.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* ── ophalen ────────────────────────────────────────────────────────────── */

function dbsFetch() {
  var sb = csSb();
  var mount = document.getElementById('dbs-mount');
  if (!sb || !mount) return;

  var merk = csBrand();
  // Al binnen voor dit merk: niet opnieuw ophalen bij elke tabwissel.
  if (_dbs.merk === merk && (_dbs.rijen || _dbs.fout)) { dbsRender(); return; }

  _dbs.merk = merk;
  _dbs.laden = true;
  _dbs.rijen = null;
  _dbs.fout = null;
  dbsRender();

  sb.from('hq_dagbesluit')
    .select('account_id,account_naam,merk,entity_id,naam,ad_naam,creative_id,gekoppeld,'
          + 'tracker_status,spend,roas,ctr,aankopen,cpa,roas_mediaan,ctr_mediaan,'
          + 'soortgenoten,eensgezind,omzet_min_spend,dagen,oordeel,actie,waarom,rang')
    .eq('merk', merk)
    .order('account_id', { ascending: true })
    .order('rang', { ascending: true, nullsFirst: false })
    .then(function (r) {
      _dbs.laden = false;
      if (r && r.error) { _dbs.fout = r.error.message; _dbs.rijen = null; }
      else { _dbs.rijen = (r && r.data) || []; }
      dbsRender();
    })
    .catch(function (e) {
      _dbs.laden = false;
      _dbs.fout = (e && e.message) || String(e);
      dbsRender();
    });
}

/* ── één advertentie ────────────────────────────────────────────────────── */

function dbsRij(r) {
  var bedrag = Number(r.omzet_min_spend);
  var soort = isNaN(bedrag) ? '' : (bedrag < 0 ? ' dbs-bedrag--verlies' : ' dbs-bedrag--winst');
  var label = isNaN(bedrag) ? '' : (bedrag < 0 ? 'kostte meer dan het opbracht' : 'boven break-even');
  // Het teken hoort in de tekst en niet in een ::before. Een voorleesprogramma
  // slaat een pseudo-element over, en wie het bedrag kopieert houdt een getal
  // zonder richting over -- terwijl richting hier het hele punt is (regel 6b.4).
  var teken = isNaN(bedrag) ? '' : (bedrag < 0 ? '\u2212 ' : '+ ');

  // Twee signalen die dezelfde kant op wijzen is een ander soort zekerheid dan
  // één. Dat staat er als woord, niet als kleurverschil (regel 4.4).
  var chip = '';
  if (r.eensgezind === true)  chip = '<span class="dbs-chip dbs-chip--zeker">twee signalen</span>';
  if (r.eensgezind === false) chip = '<span class="dbs-chip dbs-chip--eensignaal">één signaal</span>';

  var koppel = r.gekoppeld ? '' : '<span class="dbs-chip">niet in de tracker</span>';

  return '<div class="dbs-rij">'
    + '<div class="dbs-rang">' + dbsEsc(r.rang) + '</div>'
    + '<div>'
    +   '<div class="dbs-naam">' + dbsEsc(r.naam) + '</div>'
    // Naam en id horen bij elkaar en blijven dus tegen elkaar aan staan; de
    // chips komen erachter, op dezelfde regel (regel 0.3).
    +   '<div class="dbs-id"><span class="dbs-id-nr">' + dbsEsc(r.entity_id) + '</span>'
    +     chip + koppel + '</div>'
    + '</div>'
    + '<div class="dbs-bedrag' + soort + '">'
    +   '<span class="dbs-bedrag-getal">' + teken + dbsEuro(r.omzet_min_spend) + '</span>'
    +   '<span class="dbs-bedrag-label">' + label + '</span>'
    + '</div>'
    + '<div class="dbs-cijfers">'
    +   '<span>ROAS <b>' + dbsGetal(r.roas, 2) + '</b> <span title="mediaan van dit account">(mediaan ' + dbsGetal(r.roas_mediaan, 2) + ')</span></span>'
    +   '<span>CTR <b>' + dbsGetal(r.ctr, 2) + '%</b> <span title="mediaan van dit account">(mediaan ' + dbsGetal(r.ctr_mediaan, 2) + '%)</span></span>'
    +   '<span>uitgegeven <b>' + dbsEuro(r.spend) + '</b></span>'
    +   '<span>' + dbsEsc(r.aankopen) + ' aankopen</span>'
    + '</div>'
    + '<div class="dbs-waarom">' + dbsEsc(r.waarom) + '</div>'
    + '</div>';
}

function dbsKolom(titel, klasse, rijen, leegReden) {
  var h = '<div class="dbs-kolom ' + klasse + '">'
        + '<div class="dbs-kop">'
        +   '<span class="dbs-kop-titel">' + dbsEsc(titel) + '</span>'
        +   '<span class="dbs-kop-aantal">' + rijen.length + '</span>'
        + '</div>';
  // Een lege kolom is een uitkomst, geen leeg vlak: er staat waarom er vandaag
  // niets in staat (regel 0.4). "Niets te doen" is ook een besluit, maar
  // alleen als je weet waarom.
  if (!rijen.length) {
    h += '<div class="dbs-rij"><div class="dbs-rang">—</div>'
       + '<div class="dbs-waarom" style="grid-column:2/-1;margin-top:3px;">'
       + dbsEsc(leegReden) + '</div></div>';
  }
  rijen.forEach(function (r) { h += dbsRij(r); });
  h += '</div>';
  return h;
}

/* ── de rest, ingeklapt ─────────────────────────────────────────────────── */

function dbsInklap(titel, toelichting, rijen) {
  if (!rijen.length) return '';
  var h = '<details><summary>' + dbsEsc(titel) + ' (' + rijen.length + ')'
        + '<span>' + dbsEsc(toelichting) + '</span></summary>'
        + '<ul class="dbs-rest-lijst">';
  rijen.forEach(function (r) {
    h += '<li><b>' + dbsEsc(r.naam) + '</b> <code>' + dbsEsc(r.entity_id) + '</code><br>'
       + dbsEsc(r.waarom) + '</li>';
  });
  h += '</ul></details>';
  return h;
}

/* ── als er niets te besluiten valt ─────────────────────────────────────── */
/* Elk van deze gevallen heeft een eigen reden, en die staat er. Een leeg vlak
   is geen geldige uitkomst (regel 0.4). */

function dbsLeeg(kop, alineas) {
  var h = '<div class="dbs-leeg"><div class="dbs-leeg-kop">' + dbsEsc(kop) + '</div>';
  alineas.forEach(function (p) { h += '<p>' + p + '</p>'; });
  return h + '</div>';
}

function dbsGeenCijfers() {
  return dbsLeeg('Er is nog niets gemeten in dit account.', [
    'De cijfers komen binnen via de meting bij Meta. Zodra de eerste dagen '
    + 'binnen zijn, staat hier welke advertenties je vandaag zou uitzetten en '
    + 'welke meer budget verdienen.',
    'Tot die tijd is de tabel hieronder wat je hebt: het plan en wat er met de '
    + 'hand is ingevuld.'
  ]);
}

function dbsNiksBeoordeelbaar(rijen) {
  var redenen = {};
  rijen.forEach(function (r) { redenen[r.waarom] = (redenen[r.waarom] || 0) + 1; });
  var lijst = Object.keys(redenen).map(function (k) {
    return '<b>' + redenen[k] + '×</b> ' + dbsEsc(k);
  }).join('<br>');

  return dbsLeeg(
    rijen.length + ' advertentie' + (rijen.length === 1 ? '' : 's') + ' gemeten, geen enkele met een oordeel.',
    ['Dat is geen storing. Een oordeel vraagt om minstens duizend vertoningen, '
     + 'vijftig euro en drie soortgenoten om tegen af te zetten — daaronder is '
     + 'het verschil tussen twee advertenties ruis.',
     lijst]
  );
}

/* ── tekenen ────────────────────────────────────────────────────────────── */

function dbsRender() {
  var mount = document.getElementById('dbs-mount');
  if (!mount) return;

  var kop = '<div class="dbs">'
          + '<h2 class="dbs-vraag">Welke advertentie zet ik vandaag uit, en welke geef ik meer budget?</h2>';

  if (_dbs.laden) {
    mount.innerHTML = kop + '<div class="loading-card">Het dagbesluit laden...</div></div>';
    return;
  }

  if (_dbs.fout) {
    // Ook een fout krijgt een reden en een vervolgstap; anders staat er een
    // rood vlak waar niemand iets mee kan.
    mount.innerHTML = kop + dbsLeeg('Het dagbesluit kon niet worden geladen.', [
      dbsEsc(_dbs.fout),
      'Staat migratie <code>0018_dagbesluit.sql</code> al in Supabase? Zonder '
      + 'die view bestaat <code>hq_dagbesluit</code> niet.'
    ]) + '</div>';
    return;
  }

  var rijen = _dbs.rijen || [];

  if (!rijen.length) { mount.innerHTML = kop + dbsGeenCijfers() + '</div>'; return; }

  var uit  = rijen.filter(function (r) { return r.actie === 'uitzetten'; });
  var meer = rijen.filter(function (r) { return r.actie === 'meer budget'; });
  var ond  = rijen.filter(function (r) { return r.actie === 'onderzoeken'; });
  var laat = rijen.filter(function (r) { return r.actie === 'laten staan'; });
  var geen = rijen.filter(function (r) { return !r.actie; });

  if (!uit.length && !meer.length && !ond.length && !laat.length) {
    mount.innerHTML = kop + dbsNiksBeoordeelbaar(geen) + '</div>';
    return;
  }

  // Waar het geld vandaan komt, in één regel, zodat niemand hoeft te raden
  // over welke periode dit gaat of waarop de mediaan rust.
  var accounts = {};
  rijen.forEach(function (r) { accounts[r.account_naam] = 1; });
  var bron = '<p class="dbs-bron">Laatste 30 dagen · '
           + dbsEsc(Object.keys(accounts).join(', ')) + ' · '
           + 'afgezet tegen de mediaan van het account, niet tegen het gemiddelde. '
           + '<strong>Uitvoeren doe je in Meta</strong> — dit scherm grijpt nergens in.</p>';

  var kolommen = '<div class="dbs-kolommen">';
  kolommen += dbsKolom('Vandaag uitzetten', 'dbs-kolom--uitzetten', uit,
    'Geen enkele advertentie zit onder de accountmediaan én onder break-even. '
    + 'De onderste helft heeft elk account; die is pas een reden om te stoppen '
    + 'als hij ook geld kost.');
  kolommen += dbsKolom('Meer budget', 'dbs-kolom--meer', meer,
    'Geen enkele advertentie zit boven de accountmediaan op ROAS. Meer budget '
    + 'op de bovenste helft van een middelmatig veld verplaatst het probleem.');
  kolommen += '</div>';

  // Alles wat vandaag geen handeling is, staat ingeklapt onder de conclusie
  // die eruit volgt (regel 6.3).
  var rest = '<div class="dbs-rest">'
    + dbsInklap('Onderzoeken', 'materiaal werkt, de bestemming niet', ond)
    + dbsInklap('Laten staan', 'onderste helft, maar wel boven break-even', laat)
    + dbsInklap('Nog geen oordeel', 'te weinig cijfers of te weinig soortgenoten', geen)
    + '</div>';

  mount.innerHTML = kop + bron + kolommen + rest + '</div>';
}
