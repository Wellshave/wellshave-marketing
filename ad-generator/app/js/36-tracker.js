/* ═══════════════════════════════════════════════════════════════════════════
   Creative Strategy — de tracker

   Beslisvraag (opgeschreven vóór deze regel code):

       "Welke advertentie heeft iets opgeleverd, en wat weten we daardoor?"

   Dit is het derde blik op public.creatives, naast "Tests en dossier" (wat
   vraagt om een beslissing) en "Bewerken" (cijfers bijwerken). Dezelfde
   rijen, een andere vraag — geen tweede waarheid.

   Vier dingen bepalen de vorm, en drie ervan zijn een reactie op wat er in
   het bronbestand misging.

   1. Drie blokken, in de volgorde waarin het werk gebeurt: PLAN, LIVE &
      PERFORMANCE, BESLUIT. Dat is de indeling van de Test Tracker zelf en hij
      is goed — je vult links in vóór je geld uitgeeft, rechts pas als er
      cijfers zijn.

   2. Elk gemiddelde zegt waar het op rust. In de sheet stond onderaan een
      kolom 'Avg. Score' die voor elke doorsnede een streepje gaf, want er is
      nooit een score ingevuld. Een leeg gemiddelde ziet eruit als een
      gemiddelde. Daarom staat hier naast elk aantal hoeveel rijen er een
      Meta-meting, een met de hand ingetypt getal, of niets onder hebben.

   3. Wat niet ingevuld is krijgt een regel. De breakdowns in de sheet tellen
      tegen een vaste lijst: 'Per Persona' stond op nul terwijl 624 rijen een
      persona hadden, omdat er Alex in de kolom staat en Mark op de lijst. De
      database telt tegen de rijen zelf en geeft de rest een eigen regel.

   4. Het oordeel over een getal komt uit de database (0036, 0037), niet uit
      dit bestand. Er staat hier geen enkele grens: `hook_band` komt binnen als
      'goed' of 'matig' en dit scherm kiest alleen de kleur. De dag dat iemand
      de banden herijkt, verandert de tracker mee.

   Dit bestand schrijft niets.
   ═══════════════════════════════════════════════════════════════════════════ */

var _trk = {
  rijen: null, vlakken: null, sync: null, fout: null, laden: false, geladen: false,
  zoek: '', filters: {}, sorteer: 'ad_name', omgekeerd: false,
  dimensie: 'awareness_level', toon: 100
};

function trkEsc(t) { return escapeHtml(t == null ? '' : String(t)); }
function trkSb() { return (window._sb && window._authProfile && window._authProfile.id) ? window._sb : null; }

/* ── ophalen ─────────────────────────────────────────────────────────────── */

function renderTracker() {
  var sb = trkSb();
  var mount = document.getElementById('trk-mount');
  if (!mount) return;
  if (!sb) {
    mount.innerHTML = '<div class="str"><p class="str-vraag">Welke advertentie heeft iets opgeleverd?</p>'
      + '<div class="loading-card">Log in om de tracker te zien.</div></div>';
    return;
  }
  if (_trk.geladen) { trkTeken(); return; }
  _trk.laden = true; trkTeken();

  /* Twee verzoeken, niet één. De breakdown wordt door de database geteld en
     niet hier: bij 631 rijen kan de browser dat ook, maar dan staat de manier
     van tellen op twee plekken en gaat er één afwijken. */
  Promise.all([
    sb.from('hq_creative_kaart').select('*').limit(3000),
    sb.from('hq_tracker_breakdown').select('*'),
    sb.from('hq_meta_sync_status').select('*'),
    sb.from('hq_map_gaten').select('creative_id,ontbreekt,moet_ingevuld,spend').limit(3000),
    sb.from('hq_map_gaten_totaal').select('*')
  ]).then(function (r) {
    _trk.laden = false; _trk.geladen = true;
    var a = r[0], b = r[1], c = r[2], d = r[3], e = r[4];
    if (a && a.error) { _trk.fout = a.error.message; }
    else if (b && b.error) { _trk.fout = b.error.message; }
    else {
      _trk.rijen = (a && a.data) || [];
      _trk.vlakken = (b && b.data) || [];
      /* De sync-status mag ontbreken zonder het scherm te breken: dit is de
         nieuwste view en een console die vooruitloopt op de migratie hoort
         gewoon de tracker te tonen. */
      _trk.sync = (c && c.data && c.data[0]) || null;
      /* Idem voor de gaten. Een tracker die weigert te tonen omdat de nieuwste
         view nog niet bestaat, is erger dan een tracker zonder markering. */
      _trk.gaten = {};
      ((d && d.data) || []).forEach(function (g) {
        if (g.moet_ingevuld) _trk.gaten[g.creative_id] = g;
      });
      _trk.gatenTotaal = (e && e.data) || [];
    }
    trkTeken();
  }).catch(function (e) {
    _trk.laden = false; _trk.geladen = true;
    _trk.fout = (e && e.message) || String(e); trkTeken();
  });
}
function trkVernieuw() {
  _trk.geladen = false; _trk.rijen = null; _trk.vlakken = null; _trk.sync = null;
  _trk.gaten = null; _trk.gatenTotaal = null; _trk.fout = null;
  renderTracker();
}

/* ── de gaten ────────────────────────────────────────────────────────────── */
/* Een creative die geld heeft uitgegeven en waarvan een beslisveld leeg is,
   valt uit elke kruistabel die dit scherm moet gaan beantwoorden -- niet een
   beetje maar helemaal. Dat hoort op de rij zelf te staan en niet alleen in een
   telling bovenaan, want de telling leest als een schoonmaakklusje en de rij
   als een besluit. */
function trkGat(rij) {
  return (_trk.gaten && rij && _trk.gaten[rij.id]) || null;
}
function trkGatMerk(rij) {
  var g = trkGat(rij);
  if (!g || !g.ontbreekt || !g.ontbreekt.length) return '';
  return '<span class="trk-gat" title="Zonder ' + trkEsc(g.ontbreekt.join(', '))
       + ' valt deze creative buiten elke analyse">moet ingevuld: '
       + trkEsc(g.ontbreekt.join(', ')) + '</span>';
}
/* Eén regel bovenaan met het bedrag erbij. Zonder bedrag zakt dit naar onderen
   op ieders lijst; met bedrag is het een keuze. */
function trkGatenMelding() {
  if (!_trk.gatenTotaal || !_trk.gatenTotaal.length) return '';
  var per = _trk.gatenTotaal.slice().sort(function (a, b) {
    return Number(b.spend_zonder_dit_veld) - Number(a.spend_zonder_dit_veld);
  });
  var zwaarste = per[0];
  var hoeveel = Object.keys(_trk.gaten || {}).length;
  if (!hoeveel) return '';
  return '<div class="trk-melding trk-melding--let-op">'
    + '<strong>' + hoeveel + ' creative' + (hoeveel === 1 ? '' : 's')
    + ' die gedraaid ' + (hoeveel === 1 ? 'heeft' : 'hebben') + ', kan het brein niets mee.</strong> '
    + 'Er ontbreekt een beslisveld, en dan valt zo\'n creative uit élke kruistabel — '
    + 'niet een beetje, maar helemaal.'
    + '<br>Het zwaarst weegt <strong>' + trkEsc(zwaarste.veld) + '</strong>: '
    + trkEuro(zwaarste.spend_zonder_dit_veld) + ' aan uitgaven over '
    + zwaarste.creatives + ' creative' + (Number(zwaarste.creatives) === 1 ? '' : 's')
    + ' waar niets van te leren valt.'
    + '</div>';
}

/* ── filteren en sorteren ────────────────────────────────────────────────── */

var TRK_FILTERS = [
  { id: 'product',         naam: 'Product' },
  { id: 'awareness_level', naam: 'Awareness' },
  { id: 'angle_type',      naam: 'Angle' },
  { id: 'format',          naam: 'Format' },
  { id: 'persona',         naam: 'Persona' },
  { id: 'status',          naam: 'Status' },
  { id: 'cijfers_bron',    naam: 'Cijfers' }
];

function trkZet(veld, waarde) { _trk.filters[veld] = waarde || ''; _trk.toon = 100; trkTeken(); }
function trkZoek(v) { _trk.zoek = String(v || '').toLowerCase(); _trk.toon = 100; trkTeken(); }
function trkLeeg() { _trk.filters = {}; _trk.zoek = ''; _trk.toon = 100; trkTeken(); }
function trkMeer() { _trk.toon += 200; trkTeken(); }
function trkDimensie(d) { _trk.dimensie = d; trkTeken(); }
function trkSorteer(id) {
  if (_trk.sorteer === id) { _trk.omgekeerd = !_trk.omgekeerd; }
  else { _trk.sorteer = id; _trk.omgekeerd = true; }
  trkTeken();
}

function trkZichtbaar() {
  var rijen = (_trk.rijen || []).slice();
  Object.keys(_trk.filters).forEach(function (veld) {
    var w = _trk.filters[veld];
    if (!w) return;
    rijen = rijen.filter(function (r) {
      return w === '— niet ingevuld' ? !r[veld] : String(r[veld] || '') === w;
    });
  });
  if (_trk.zoek) {
    rijen = rijen.filter(function (r) {
      return ['ad_name', 'hook_short', 'marketing_angle', 'desires', 'product', 'notes']
        .some(function (k) { return String(r[k] || '').toLowerCase().indexOf(_trk.zoek) > -1; });
    });
  }
  var s = _trk.sorteer, om = _trk.omgekeerd ? -1 : 1;
  rijen.sort(function (a, b) {
    var x = a[s], y = b[s];
    /* Leeg zakt altijd naar beneden, ook als je omgekeerd sorteert. Anders
       staat er bij "hoogste ROAS eerst" een scherm vol niks bovenaan. */
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * om;
    return String(x).localeCompare(String(y)) * om;
  });
  return rijen;
}

/* ── opmaak ──────────────────────────────────────────────────────────────── */

function trkGetal(w, achter) {
  if (w == null || w === '') return '<span class="trk-leeg">–</span>';
  var n = Number(w);
  if (!isFinite(n)) return trkEsc(w);
  return n.toLocaleString('nl-NL', { minimumFractionDigits: achter || 0, maximumFractionDigits: achter || 0 });
}
function trkPct(w, band) {
  if (w == null || w === '') return '<span class="trk-leeg">–</span>';
  var tekst = (Number(w) * 100).toLocaleString('nl-NL', { maximumFractionDigits: 2 }) + '%';
  if (!band) return '<span class="trk-cijfer">' + tekst + '</span>';
  var titel = band === 'onmogelijk'
    ? 'Boven de 100% — dit is een invoerfout, geen uitschieter'
    : 'Band uit de benchmarks: ' + band;
  return '<span class="trk-band trk-band--' + band + '" title="' + trkEsc(titel) + '">' + tekst + '</span>';
}
function trkEuro(w) {
  if (w == null || w === '') return '<span class="trk-leeg">–</span>';
  return '€ ' + Number(w).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function trkDatum(w) {
  if (!w) return '<span class="trk-leeg">–</span>';
  var d = new Date(w);
  return isNaN(d) ? trkEsc(w) : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: '2-digit' });
}
function trkRoas(r) {
  if (r.roas == null) return '<span class="trk-leeg">–</span>';
  var tekst = Number(r.roas).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (r.boven_breakeven === true) {
    return '<span class="trk-band trk-band--goed" title="Boven break-even van '
      + trkEsc(r.breakeven_roas) + '">' + tekst + '</span>';
  }
  if (r.boven_breakeven === false) {
    return '<span class="trk-band trk-band--matig" title="Onder break-even van '
      + trkEsc(r.breakeven_roas) + '">' + tekst + '</span>';
  }
  /* Geen oordeel: of er is geen break-even bekend, of de ROAS is nul. Die nul
     is in de geïmporteerde rijen bijna altijd een leeg vakje dat als getal is
     opgeslagen, en die twee moeten er verschillend uitzien. */
  return '<span class="trk-cijfer trk-cijfer--stil" title="Geen oordeel: '
    + (r.breakeven_roas == null ? 'break-even onbekend' : 'een ROAS van nul is hier geen meting')
    + '">' + tekst + '</span>';
}

var TRK_BRON = {
  meta:      { label: 'Meta',      uitleg: 'Gemeten via de Meta-koppeling' },
  handmatig: { label: 'handmatig', uitleg: 'Met de hand ingetypt, niet gemeten' },
  /* Vastgezet is niet hetzelfde als ingetypt: hier heeft iemand de meting
     bewust overschreven. Dat moet je kunnen zien zonder de rij te openen,
     anders is het een stille afwijking. */
  'handmatig-vast': { label: 'vastgezet', uitleg: 'Met de hand rechtgezet; blijft staan ook als Meta iets anders meet' },
  geen:      { label: '–',         uitleg: 'Geen cijfers' }
};
function trkBron(r) {
  var b = TRK_BRON[r.cijfers_bron] || TRK_BRON.geen;
  var uitleg = b.uitleg;
  if (r.cijfers_bron === 'handmatig-vast') {
    if (r.cijfers_vastgezet_naam) uitleg += ' — door ' + r.cijfers_vastgezet_naam;
    if (r.gemeten_roas != null) uitleg += '. Meta mat een ROAS van ' + r.gemeten_roas;
  }
  return '<span class="trk-bron trk-bron--' + trkEsc(r.cijfers_bron) + '" title="' + trkEsc(uitleg) + '">'
    + trkEsc(b.label) + '</span>';
}

/* ── de kaarten bovenaan ─────────────────────────────────────────────────── */

function trkKaarten(alle) {
  var t = function (s) { return alle.filter(function (r) { return r.status === s; }).length; };
  var gemeten = alle.filter(function (r) { return r.cijfers_bron === 'meta'; }).length;
  var vast = alle.filter(function (r) { return r.cijfers_bron === 'handmatig-vast'; }).length;
  var kaarten = [
    { n: alle.length, label: 'advertenties', bij: 'in de tracker' },
    { n: t('Live'),      label: 'live',       bij: 'draaien nu',        klasse: 'live' },
    { n: t('Winner'),    label: 'winners',    bij: 'opschalen',         klasse: 'winner' },
    { n: t('Itereren'),  label: 'itereren',   bij: 'variant maken',     klasse: 'iter' },
    { n: t('Verliezer'), label: 'verliezers', bij: 'uitgezet',          klasse: 'verlies' },
    { n: t('Concept'),   label: 'concept',    bij: 'nog niet gedraaid' }
  ];
  var h = '<div class="trk-kaarten">';
  kaarten.forEach(function (k) {
    h += '<div class="trk-kaart' + (k.klasse ? ' trk-kaart--' + k.klasse : '') + '">'
      +  '<div class="trk-kaart-n">' + k.n + '</div>'
      +  '<div class="trk-kaart-l">' + trkEsc(k.label) + '</div>'
      +  '<div class="trk-kaart-b">' + trkEsc(k.bij) + '</div></div>';
  });
  h += '</div>';

  /* Hier stond eerst alleen "geen enkele advertentie heeft een Meta-meting".
     Dat klopte, en het was het verkeerde bericht: het las als "de koppeling
     staat nog niet aan" terwijl de worker draaide, het token werkte en Meta
     elke ochtend opnieuw weigerde om één veld dat niet meer bestaat. Die
     storing liep twee dagen door omdat hij alleen in het systeemlogboek stond.

     Wachten en ingrijpen zijn verschillende dingen, en dit is de plek waar
     dat verschil zichtbaar hoort te zijn. Vandaar de toestand uit
     hq_meta_sync_status en niet een telling van lege kolommen. */
  var s = _trk.sync;
  if (s && s.toestand === 'kapot') {
    h += '<div class="trk-melding trk-melding--kapot">'
      +  '<strong>De Meta-koppeling ligt eruit.</strong> '
      +  (s.mislukte_pogingen_36u ? s.mislukte_pogingen_36u + ' mislukte pogingen in 36 uur. ' : '')
      +  'Er komt niets binnen, en de cijfers hieronder zijn met de hand ingevuld. '
      +  'Dit lost zichzelf niet op.'
      +  (s.laatste_fout ? '<br><code class="trk-fout">' + trkEsc(s.laatste_fout) + '</code>' : '')
      +  '</div>';
  } else if (s && s.toestand === 'werkt' && !gemeten) {
    /* De koppeling haalt data op, maar niet op het niveau waar de tracker iets
       aan heeft. Dat verschil moet er staan: de vorige tekst zei "zodra de
       koppeling draait verandert deze kolom mee", en dat klopte toen hij stuk
       was. Nu draait hij, verandert er niets, en gaat de lezer wachten op iets
       wat al gebeurd is. */
    h += '<div class="trk-melding trk-melding--let-op">'
      +  '<strong>De Meta-koppeling werkt, maar meet niet per advertentie.</strong> '
      +  'Er komen cijfers binnen op ' + trkEsc(s.gemeten_niveaus || 'accountniveau')
      +  ' — genoeg voor het dagrapport, niet voor deze tabel. Een advertentie krijgt hier pas '
      +  'een gemeten cijfer als er op advertentieniveau gemeten wordt '
      +  '<em>en</em> de advertentie aan een Meta-ad gekoppeld is.'
      +  '<br>Nu: ' + (Number(s.metingen_advertentieniveau) || 0) + ' metingen op advertentieniveau, '
      +  (Number(s.gekoppelde_advertenties) || 0) + ' gekoppelde advertenties.'
      +  '</div>';
  } else if (s && s.toestand === 'nooit gedraaid') {
    h += '<div class="trk-melding trk-melding--let-op">'
      +  '<strong>De Meta-koppeling heeft nog nooit iets opgehaald.</strong> '
      +  'Alle cijfers hieronder zijn met de hand ingevuld.</div>';
  } else if (!gemeten) {
    h += '<div class="trk-melding trk-melding--let-op">'
      +  '<strong>Geen enkele advertentie is gekoppeld aan een Meta-meting.</strong> '
      +  'Alle cijfers hieronder zijn met de hand ingevuld. Zodra de Meta-koppeling '
      +  'draait, winnen gemeten cijfers automatisch van ingetypte en verandert deze '
      +  'kolom mee — er hoeft niets overgetypt te worden.</div>';
  } else {
    h += '<p class="trk-telling">' + gemeten + ' van ' + alle.length
      +  ' advertenties heeft een Meta-meting; de rest is met de hand ingevuld'
      +  (vast ? ', waarvan ' + vast + ' bewust vastgezet' : '') + '.</p>';
  }
  /* Onder de meetstatus en niet erboven: eerst of de cijfers kloppen, dan pas
     of we er iets mee kunnen. Andersom lees je een verwijt voordat je weet
     waar het over gaat. */
  h += trkGatenMelding();
  return h;
}

/* ── de tabel ────────────────────────────────────────────────────────────── */

/* Drie blokken, in de volgorde van het werk. `kop` is de tekst boven de kolom,
   `blok` bepaalt de groepskop erboven. */
var TRK_KOLOMMEN = [
  { id: 'ad_name',         kop: 'Ad name',   blok: 'plan',  cel: function (r) {
      return '<strong>' + trkEsc(r.ad_name) + '</strong>' + trkGatMerk(r); } },
  { id: 'product',         kop: 'Product',   blok: 'plan', kort: true },
  { id: 'awareness_level', kop: 'Awareness', blok: 'plan', kort: true },
  { id: 'angle_type',      kop: 'Angle',     blok: 'plan', kort: true },
  { id: 'format',          kop: 'Format',    blok: 'plan', kort: true },
  { id: 'hook_short',      kop: 'Hook',      blok: 'plan',  cel: function (r) {
      return r.hook_short
        ? '<span class="trk-hook" title="' + trkEsc(r.hook_short) + '">' + trkEsc(r.hook_short) + '</span>'
        : '<span class="trk-leeg">–</span>'; } },
  { id: 'persona',         kop: 'Persona',   blok: 'plan', kort: true },

  { id: 'date_live',    kop: 'Live sinds',  blok: 'live', cel: function (r) { return trkDatum(r.date_live); } },
  { id: 'budget',       kop: 'Budget',      blok: 'live', cel: function (r) { return trkEuro(r.budget); } },
  { id: 'hook_rate',    kop: 'Hook rate',   blok: 'live', cel: function (r) { return trkPct(r.hook_rate, r.hook_band); } },
  { id: 'hold_rate',    kop: 'Hold rate',   blok: 'live', cel: function (r) { return trkPct(r.hold_rate, r.hold_band); } },
  { id: 'ctr',          kop: 'CTR',         blok: 'live', cel: function (r) { return trkPct(r.ctr, r.ctr_band); } },
  { id: 'cvr',          kop: 'CVR',         blok: 'live', cel: function (r) { return trkPct(r.cvr, r.cvr_band); } },
  { id: 'cpa',          kop: 'CPA',         blok: 'live', cel: function (r) { return trkEuro(r.cpa); } },
  { id: 'roas',         kop: 'ROAS',        blok: 'live', cel: function (r) { return trkRoas(r); } },
  { id: 'cijfers_bron', kop: 'Bron',        blok: 'live', cel: function (r) { return trkBron(r); } },

  { id: 'status',    kop: 'Status',        blok: 'besluit', cel: function (r) {
      return '<span class="trk-status trk-status--' + trkEsc((r.status || '').toLowerCase()) + '">'
        + trkEsc(r.status || '–') + '</span>'; } },
  { id: 'score',     kop: 'Score',         blok: 'besluit', cel: function (r) {
      return r.score == null ? '<span class="trk-leeg">–</span>' : trkGetal(r.score, 1); } },
  { id: 'next_step', kop: 'Volgende stap', blok: 'besluit', kort: true, cel: function (r) {
      return r.next_step
        ? '<span class="trk-kort" title="' + trkEsc(r.next_step) + '">' + trkEsc(r.next_step) + '</span>'
        : '<span class="trk-leeg" title="Niet vastgelegd">–</span>'; } }
];

var TRK_BLOKKEN = [
  { id: 'plan',    kop: 'Plan',              uitleg: 'Ingevuld vóór er geld aan uitgegeven wordt' },
  { id: 'live',    kop: 'Live & performance', uitleg: 'Pas invullen als de advertentie gedraaid heeft' },
  { id: 'besluit', kop: 'Besluit',           uitleg: 'Wat vinden we ervan, en wat doen we nu' }
];

function trkTabel(rijen) {
  var h = '<div class="trk-tabelwrap"><table class="trk-tabel"><thead>';

  h += '<tr class="trk-blokrij">';
  TRK_BLOKKEN.forEach(function (b) {
    var n = TRK_KOLOMMEN.filter(function (k) { return k.blok === b.id; }).length;
    h += '<th class="trk-blok trk-blok--' + b.id + '" colspan="' + n + '" title="' + trkEsc(b.uitleg) + '">'
      + trkEsc(b.kop) + '</th>';
  });
  h += '</tr><tr>';
  TRK_KOLOMMEN.forEach(function (k) {
    var pijl = _trk.sorteer === k.id ? (_trk.omgekeerd ? ' ▾' : ' ▴') : '';
    h += '<th class="trk-th trk-th--' + k.blok + '">'
      + '<button class="str-sorteer" onclick="trkSorteer(\'' + k.id + '\')">'
      + trkEsc(k.kop) + pijl + '</button></th>';
  });
  h += '</tr></thead><tbody>';

  if (!rijen.length) {
    h += '<tr><td class="str-geen" colspan="' + TRK_KOLOMMEN.length + '">'
      + 'Geen advertentie voldoet aan deze filters. Dat is een uitkomst, geen fout — '
      + '<a href="javascript:void(0)" onclick="trkLeeg()">zet de filters leeg</a>.</td></tr>';
  }
  rijen.slice(0, _trk.toon).forEach(function (r) {
    h += '<tr class="trk-rij">';
    TRK_KOLOMMEN.forEach(function (k) {
      /* Eén regel per rij, met de hele tekst in de title. Bij zeshonderd rijen
         is een tabel die per rij vier regels hoog wordt niet vollediger maar
         onscanbaar: je ziet er nog vier tegelijk in plaats van vijftien. */
      var ruw = r[k.id];
      var inhoud = k.cel ? k.cel(r)
        : (ruw ? (k.kort
            ? '<span class="trk-kort" title="' + trkEsc(ruw) + '">' + trkEsc(ruw) + '</span>'
            : trkEsc(ruw))
          : '<span class="trk-leeg">–</span>');
      h += '<td class="trk-td trk-td--' + k.blok + '">' + inhoud + '</td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';

  if (rijen.length > _trk.toon) {
    h += '<p class="trk-telling"><button class="str-knop" onclick="trkMeer()">Toon '
      + Math.min(200, rijen.length - _trk.toon) + ' meer</button> '
      + '<span class="trk-leeg">' + _trk.toon + ' van ' + rijen.length + ' getoond</span></p>';
  }
  return h;
}

/* ── de doorsneden ───────────────────────────────────────────────────────── */

var TRK_DIMENSIES = [
  { id: 'awareness_level', naam: 'Awareness' },
  { id: 'format',          naam: 'Format' },
  { id: 'angle_type',      naam: 'Angle type' },
  { id: 'product',         naam: 'Product' },
  { id: 'persona',         naam: 'Persona' },
  { id: 'media_type',      naam: 'Media type' }
];

function trkDoorsnede() {
  var alles = _trk.vlakken || [];
  var regels = alles.filter(function (v) { return v.dimensie === _trk.dimensie; })
    .sort(function (a, b) { return b.aantal - a.aantal; });

  var h = '<div class="trk-doorsnede"><div class="trk-doorsnede-kop">'
    + '<h3 class="trk-h3">Wat werkt waar</h3><div class="trk-tabs">';
  TRK_DIMENSIES.forEach(function (d) {
    h += '<button class="str-knop' + (_trk.dimensie === d.id ? ' str-knop--aan' : '') + '"'
      + ' onclick="trkDimensie(\'' + d.id + '\')">' + trkEsc(d.naam) + '</button>';
  });
  h += '</div></div>';

  if (!regels.length) {
    h += '<div class="loading-card">Nog geen doorsnede op deze dimensie.</div></div>';
    return h;
  }

  h += '<table class="trk-tabel trk-tabel--smal"><thead><tr>'
    + '<th>Waarde</th><th>Aantal</th><th>Gedraaid</th><th>Winners</th><th>Verliezers</th>'
    + '<th>Itereren</th><th>Waar de cijfers op rusten</th><th>Score</th></tr></thead><tbody>';

  regels.forEach(function (v) {
    /* Het staafje toont de verhouding meting / handmatig / niets. Dat is
       geen versiering: zonder die verhouding leest "3 winners van 97" als een
       bevinding, terwijl er nul metingen onder kunnen liggen. */
    var totaal = v.aantal || 1;
    var breed = function (n) { return (100 * (n || 0) / totaal).toFixed(1) + '%'; };
    h += '<tr' + (v.waarde === '— niet ingevuld' ? ' class="trk-rij--leegwaarde"' : '') + '>'
      + '<td>' + trkEsc(v.waarde) + '</td>'
      + '<td class="trk-num">' + v.aantal + '</td>'
      + '<td class="trk-num">' + (v.ooit_gedraaid || 0) + '</td>'
      + '<td class="trk-num">' + (v.winners || 0) + '</td>'
      + '<td class="trk-num">' + (v.verliezers || 0) + '</td>'
      + '<td class="trk-num">' + (v.itereren || 0) + '</td>'
      + '<td><div class="trk-staaf" title="' + (v.met_meting || 0) + ' gemeten, '
      +   (v.met_handmatig || 0) + ' met de hand, ' + (v.zonder_cijfers || 0) + ' zonder cijfers">'
      +   '<i class="trk-staaf--meta" style="width:' + breed(v.met_meting) + '"></i>'
      +   '<i class="trk-staaf--hand" style="width:' + breed(v.met_handmatig) + '"></i>'
      +   '<i class="trk-staaf--geen" style="width:' + breed(v.zonder_cijfers) + '"></i>'
      +   '</div></td>'
      + '<td class="trk-num">' + (v.met_score
          ? trkGetal(v.gem_score, 1) + ' <span class="trk-leeg">(' + v.met_score + ')</span>'
          : '<span class="trk-leeg" title="Geen enkele rij heeft een score">–</span>') + '</td>'
      + '</tr>';
  });
  h += '</tbody></table>'
    + '<p class="trk-legenda">'
    + '<span class="trk-vlek trk-staaf--meta"></span> gemeten via Meta '
    + '<span class="trk-vlek trk-staaf--hand"></span> met de hand ingevuld '
    + '<span class="trk-vlek trk-staaf--geen"></span> geen cijfers'
    + ' — de kolom Score toont tussen haakjes op hoeveel rijen het gemiddelde rust.</p>'
    + '</div>';
  return h;
}

/* ── tekenen ─────────────────────────────────────────────────────────────── */

function trkTeken() {
  var mount = document.getElementById('trk-mount');
  if (!mount) return;

  var kop = '<div class="str"><p class="str-vraag">Welke advertentie heeft iets opgeleverd, '
    + 'en wat weten we daardoor?</p>';

  if (_trk.laden) { mount.innerHTML = kop + '<div class="loading-card">De tracker laadt...</div></div>'; return; }
  if (_trk.fout) {
    mount.innerHTML = kop + '<div class="loading-card"><strong>De tracker kon niet worden geladen.</strong><br>'
      + trkEsc(_trk.fout) + '<br><br>Staan de migraties 0035 t/m 0037 in Supabase? Zonder die '
      + 'views bestaan <code>hq_creative_kaart</code> en <code>hq_tracker_breakdown</code> niet '
      + 'in deze vorm.</div></div>';
    return;
  }
  var alle = _trk.rijen || [];
  if (!alle.length) {
    mount.innerHTML = kop + '<div class="loading-card">Er staat nog geen advertentie in de tracker.</div></div>';
    return;
  }

  var rijen = trkZichtbaar();
  var h = kop + trkKaarten(alle);

  h += '<div class="str-balk">'
    + '<input class="str-zoek" type="search" placeholder="Zoek in naam, hook, angle, notities..." '
    +   'value="' + trkEsc(_trk.zoek) + '" oninput="trkZoek(this.value)">';
  TRK_FILTERS.forEach(function (f) {
    /* Een filterlijst uit de rijen zelf, met "niet ingevuld" als echte keuze.
       Als je die weglaat kun je de rijen die nergens bij horen niet vinden —
       en dat zijn precies de rijen die aandacht nodig hebben. */
    var waarden = [...new Set(alle.map(function (r) { return r[f.id] || '— niet ingevuld'; }))].sort();
    if (waarden.length < 2) return;
    h += '<select class="str-filter" onchange="trkZet(\'' + f.id + '\', this.value)">'
      + '<option value="">' + trkEsc(f.naam) + ': alle</option>'
      + waarden.map(function (w) {
          return '<option value="' + trkEsc(w) + '"' + (_trk.filters[f.id] === w ? ' selected' : '') + '>'
            + trkEsc(w) + '</option>'; }).join('')
      + '</select>';
  });
  h += '<button class="str-knop" onclick="trkLeeg()">Filters leeg</button></div>';

  h += '<p class="trk-telling">' + rijen.length + ' van ' + alle.length + ' advertenties'
    + ' · <a href="javascript:void(0)" onclick="trkVernieuw()">vernieuwen</a></p>';

  h += trkTabel(rijen);
  h += trkDoorsnede();
  mount.innerHTML = h + '</div>';
}
