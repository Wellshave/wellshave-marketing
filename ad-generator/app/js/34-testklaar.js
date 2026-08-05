/* ═══════════════════════════════════════════════════════════════════════════
   Klaarzetten voor test — van variant naar testklaar werkstuk

   Beslisvraag (opgeschreven vóór deze regel code):

       "Wat weet het systeem al, en wat moet de mens nog bevestigen?"

   Alles wat tijdens het interview en de generatie bekend werd, is hier al
   bekend. De gebruiker hoeft niets opnieuw in te typen; hij hoeft alleen te
   kijken of het klopt en te tekenen. Elk veld dat hij hier wél moet invullen,
   is een veld dat we eerder hadden moeten vangen.

   Twee dingen die dit scherm bewust NIET doet:

   1. Het verandert niets aan de generator. De kaart, de velden, de knoppen en
      de opslag in de bibliotheek blijven exact zoals ze waren. Er komt één
      knop bij.

   2. Het maakt geen tweede Creative Strategy. De rij landt in public.creatives
      — dezelfde tabel waar de Scriptwriter al in schrijft en waar de tabel al
      uit leest — en hangt aan een werkstuk in de bestaande estafette.

   Het schrijven zelf gebeurt in één databasefunctie (0030). Niet omdat dat
   netter oogt, maar omdat de console marketing_hq alleen mag lezen: zonder die
   deur zou elke tab in elke browser de estafette kunnen aanpassen. En omdat
   "klaarzetten" één besluit is en geen vier inserts die elk half kunnen slagen.
   ═══════════════════════════════════════════════════════════════════════════ */

var _tk = { open: false, index: null, gegevens: null, bezig: false, naamGeraakt: false };

function tkEsc(t) { return escapeHtml(t == null ? '' : String(t)); }
function tkSb() { return (window._sb && window._authProfile && window._authProfile.id) ? window._sb : null; }

/* ── wat we al weten ─────────────────────────────────────────────────────── */

/* Verzamelt de testcontext uit wat er al in het geheugen staat. Drie bronnen,
   en ze vullen elkaar aan in deze volgorde: het Rory-interview weet het
   scherpst, de generatie-metadata weet de configuratie, de variatie weet de
   uitvoering. */
function tkVerzamel(i) {
  var lg = state.lastGenerated || {};
  var v = (lg.variations || [])[i] || {};
  var m = lg.metadata || {};
  var iw = (window.iw && window.iw.known) ? window.iw.known : {};
  var brief = (window.iw && window.iw.briefing) ? window.iw.briefing : {};

  var beeld = null;
  try {
    var st = state.generatedImages[i];
    if (st && st.versions && st.versions.length) beeld = st.versions[st.currentIndex].b64 || null;
  } catch (e) {}

  /* De hoek komt uit het interview als Rory hem scherp kreeg, anders uit de
     briefing, anders uit het concept van de generatie. Nooit leeg laten: een
     hoek is de sleutel waarop later samengevoegd wordt. */
  var hoek = iw.hoek || brief.angle || m.angleType || m.concept || '';

  return {
    brand: (typeof ACTIVE_BRAND !== 'undefined' ? ACTIVE_BRAND : 'wellshave'),
    product: m.product || '',
    persona: m.personaName || iw.persona || brief.persona || '',
    angle_type: brief.angle_type || m.angleType || '',
    marketing_angle: hoek,
    awareness_level: m.awareness || brief.awareness || '',
    funnel_stage: m.funnel || brief.funnel || '',
    format: m.format || brief.format || (v.hook_label_nl || ''),
    media_type: 'Static',
    creative_concept: v.visual_nl || m.concept || '',

    kernpijn: iw['kern-pijn'] || iw.kernpijn || iw.pijn || '',
    kernbezwaar: iw['kern-bezwaar'] || iw.kernbezwaar || iw.bezwaar || '',
    na_situatie: iw['gewenste na-situatie'] || iw.na_situatie || '',
    waarom_nu: iw['waarom nu'] || m.season || '',

    headline: v.headline_nl || '',
    body_copy: v.body_copy_nl || '',
    cta: v.cta_nl || '',
    visual_concept: v.visual_nl || '',
    image_prompt: v.image_prompt_en || '',
    hypothesis: v.hypothese_nl || '',
    rory_reasoning: v.reasoning_nl || brief.rory_reasoning || '',
    theriot_reasoning: brief.theriot_note || m.theriotNote || '',
    image_b64: beeld,

    /* De testvariabele is het enige veld dat het systeem niet kan weten: wat er
       precies anders is aan déze variant tegenover de andere. Daarom staat hij
       leeg en is hij verplicht — een hypothese zonder testvariabele is niet
       toetsbaar, en dan valt achteraf niet te zeggen wát het deed. */
    test_variable: '',

    bronnen: (window.iw && window.iw.bronnen) ? window.iw.bronnen : [],
    werkstuk_id: (lg.werkstuk_id || null),
    creative_id: null,
    _index: i
  };
}

/* ── de naam ─────────────────────────────────────────────────────────────── */

/* Het voorstel komt uit de database, want daar staat de conventie per merk en
   daar is ook te tellen hoeveel er al zijn. Lukt dat niet, dan bouwen we hem
   hier na — een naamvoorstel hoort nooit de reden te zijn dat je vastloopt. */
function tkNaamVoorstel(g, klaar) {
  var sb = tkSb();
  var terug = function (n) { if (!_tk.naamGeraakt) { var el = document.getElementById('tk-naam'); if (el) el.value = n; } if (klaar) klaar(n); };
  if (!sb) return terug(tkNaamLokaal(g));
  sb.rpc('hq_ad_naam_voorstel', { p_brand: g.brand, p_product: g.product, p_persona: g.persona, p_angle: g.angle_type })
    .then(function (r) { terug((r && !r.error && r.data) ? r.data : tkNaamLokaal(g)); })
    .catch(function () { terug(tkNaamLokaal(g)); });
}
function tkNaamLokaal(g) {
  var deel = function (t) {
    return (String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'onbekend';
  };
  var pre = (String(g.brand).toLowerCase() === 'wellshine') ? 'WLS' : 'WS';
  return [pre, deel(g.product), deel(g.persona), deel(g.angle_type), '01'].join('.');
}

/* ── de controlekaart ────────────────────────────────────────────────────── */

function tkOpen(i) {
  if (!tkSb()) { if (typeof toast === 'function') toast('Log in om een variant testklaar te maken.', true); return; }
  _tk.index = i; _tk.gegevens = tkVerzamel(i); _tk.open = true; _tk.naamGeraakt = false;
  tkTeken();
  tkNaamVoorstel(_tk.gegevens);
}
function tkSluit() { _tk.open = false; var o = document.getElementById('tk-overlay'); if (o) o.remove(); }

function tkRegel(label, waarde, leegTekst) {
  var leeg = waarde == null || String(waarde).trim() === '';
  return '<div class="tk-regel' + (leeg ? ' tk-regel--leeg' : '') + '">'
    + '<div class="tk-label">' + tkEsc(label) + '</div>'
    + '<div class="tk-waarde">' + (leeg ? tkEsc(leegTekst || 'niet ingevuld') : tkEsc(waarde)) + '</div>'
    + '</div>';
}

function tkTeken() {
  var g = _tk.gegevens; if (!g) return;
  var oud = document.getElementById('tk-overlay'); if (oud) oud.remove();

  var beeld = g.image_b64
    ? '<img class="tk-beeld" alt="" src="data:image/png;base64,' + g.image_b64 + '">'
    : '<div class="tk-beeld tk-beeld--leeg">nog geen beeld gegenereerd</div>';

  var o = document.createElement('div');
  o.id = 'tk-overlay';
  o.className = 'tk-overlay';
  o.innerHTML =
    '<div class="tk-kaart" role="dialog" aria-label="Klaarzetten voor test">'
    + '<div class="tk-kop"><strong>Klaarzetten voor test</strong>'
    +   '<button class="tk-x" onclick="tkSluit()" aria-label="Sluiten">×</button></div>'

    + '<p class="tk-lede">Alles hieronder komt uit het interview en de generatie. '
    +   'Kijk of het klopt en pas aan wat niet klopt — je hoeft niets opnieuw in te typen.</p>'

    + '<div class="tk-body">'
    +   '<div class="tk-links">' + beeld
    +     '<div class="tk-preview-tekst"><strong>' + tkEsc(g.headline) + '</strong>'
    +     (g.body_copy ? '<p>' + tkEsc(g.body_copy) + '</p>' : '')
    +     (g.cta ? '<span class="tk-cta">' + tkEsc(g.cta) + '</span>' : '') + '</div></div>'

    +   '<div class="tk-rechts">'
    +     '<div class="tk-veld"><label for="tk-naam">Ad name</label>'
    +       '<input id="tk-naam" type="text" oninput="_tk.naamGeraakt=true">'
    +       '<small>Voorstel volgens de merkconventie. Je mag hem veranderen.</small></div>'

    +     tkRegel('Product', g.product)
    +     tkRegel('Persona', g.persona)
    +     tkRegel('Angle', g.marketing_angle)
    +     tkRegel('Angle type', g.angle_type)
    +     tkRegel('Awareness', g.awareness_level)
    +     tkRegel('Funnel', g.funnel_stage)
    +     tkRegel('Format', g.format)

    +     '<div class="tk-veld"><label for="tk-hyp">Hypothese</label>'
    +       '<textarea id="tk-hyp" rows="3">' + tkEsc(g.hypothesis) + '</textarea>'
    +       '<small>Als we X, dan Y, omdat Z. Zonder hypothese is dit geen test.</small></div>'

    +     '<div class="tk-veld"><label for="tk-var">Testvariabele</label>'
    +       '<textarea id="tk-var" rows="2" placeholder="Wat is er precies anders aan deze variant?">'
    +       tkEsc(g.test_variable) + '</textarea>'
    +       '<small>Het enige wat het systeem niet kan weten. Zonder dit valt achteraf '
    +       'niet te zeggen wát het deed.</small></div>'

    +     '<div class="tk-veld"><label for="tk-soph">Market sophistication</label>'
    +       '<select id="tk-soph">'
    +         '<option value="">nog niet bepaald</option>'
    +         '<option value="1">1 · nieuw — de simpele claim werkt</option>'
    +         '<option value="2">2 · claim-race — groter of specifieker</option>'
    +         '<option value="3">3 · mechanisme — leg uit hóé het werkt</option>'
    +         '<option value="4">4 · mechanisme+ — beter, sneller, bewezen</option>'
    +         '<option value="5">5 · identificatie — wie je bent, niet wat je doet</option>'
    +       '</select>'
    +       '<input id="tk-soph-reden" type="text" placeholder="Waarom dit niveau? (verplicht bij een keuze)">'
    +       '<small>Hoort bij het werkstuk, niet bij deze variant — vier varianten op '
    +       'dezelfde hoek delen hem.</small></div>'

    +     '<div class="tk-onderbouwing" id="tk-onderbouwing"></div>'
    +   '</div>'
    + '</div>'

    + '<div class="tk-fout" id="tk-fout" hidden></div>'

    + '<div class="tk-acties">'
    +   '<button class="btn btn-primary" id="tk-bevestig" onclick="tkBevestig()">Bevestigen en naar Creative Strategy</button>'
    +   '<button class="btn btn-ghost" onclick="tkSluit()">Terug naar de creative</button>'
    +   '<button class="btn btn-ghost" onclick="tkConcept()">Opslaan als concept</button>'
    +   '<button class="btn btn-ghost tk-niet" onclick="tkNietTesten()">Niet testen</button>'
    + '</div></div>';

  document.body.appendChild(o);
  o.addEventListener('click', function (e) { if (e.target === o) tkSluit(); });
  tkOnderbouwing();
}

/* Waar deze test op rust, in dezelfde woorden als de werkbank. Geen cijfer maar
   een zin: "3 van de 7 onderbouwd" zegt niets als je niet weet dat de rest
   aannames zijn. */
function tkOnderbouwing() {
  var g = _tk.gegevens, el = document.getElementById('tk-onderbouwing');
  if (!el || !g) return;
  var aannames = [];
  if (!g.kernpijn) aannames.push('de kernpijn is niet uit het interview gekomen');
  if (!g.persona) aannames.push('er is geen persona gekozen');
  if (!g.marketing_angle) aannames.push('de hoek is niet vastgelegd');
  if (!g.image_b64) aannames.push('er is nog geen beeld');

  el.innerHTML = '<div class="tk-ob-kop">Waar dit op rust</div>'
    + (aannames.length
        ? '<ul class="tk-ob-lijst"><li>' + aannames.map(tkEsc).join('</li><li>') + '</li></ul>'
          + '<p class="tk-ob-uitleg">Dat mag — het denkstuk legt ze vast als aanname, en de test '
          + 'moet ze uitwijzen. Het staat er zodat je het weet, niet om je tegen te houden.</p>'
        : '<p class="tk-ob-uitleg">Interview, persona, hoek en beeld zijn allemaal ingevuld. '
          + 'De antwoorden gaan als aanname het denkstuk in tot een meting ze bevestigt.</p>');
}

/* ── bevestigen ──────────────────────────────────────────────────────────── */

function tkFout(t) {
  var el = document.getElementById('tk-fout');
  if (!el) return;
  if (!t) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false; el.textContent = t;
}

function tkLees() {
  var g = Object.assign({}, _tk.gegevens);
  var w = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  g.ad_name = w('tk-naam');
  g.hypothesis = w('tk-hyp');
  g.test_variable = w('tk-var');
  var s = w('tk-soph');
  if (s) { g.sophistication = Number(s); g.sophistication_reden = w('tk-soph-reden'); }
  g.user_email = (window._authProfile || {}).email || null;
  g.user_name = (window._authProfile || {}).full_name || (window._authProfile || {}).email || null;
  delete g._index;
  return g;
}

function tkBevestig() {
  if (_tk.bezig) return;
  var sb = tkSb(); if (!sb) return;
  var g = tkLees();

  /* Dezelfde eisen als de database, maar hier al gecontroleerd — een melding
     die je meteen ziet is beter dan een foutmelding uit Postgres. De grendel
     zelf blijft in de database staan: dit scherm is niet de enige weg naar
     binnen. */
  if (!g.hypothesis) { tkFout('Er staat geen hypothese. Zonder hypothese is dit geen test.'); return; }
  if (!g.test_variable) { tkFout('Vul de testvariabele in: wat is er precies anders aan deze variant?'); return; }
  if (g.sophistication && !g.sophistication_reden) {
    tkFout('Je koos een sophistication-niveau. Zet erbij waarom, anders is het een getal dat niemand kan wegen.');
    return;
  }

  _tk.bezig = true; tkFout('');
  var knop = document.getElementById('tk-bevestig');
  if (knop) { knop.disabled = true; knop.textContent = 'Bezig...'; }

  sb.rpc('hq_creative_testklaar', { p: g }).then(function (r) {
    _tk.bezig = false;
    if (knop) { knop.disabled = false; knop.textContent = 'Bevestigen en naar Creative Strategy'; }
    if (r && r.error) { tkFout(r.error.message || 'Het opslaan lukte niet.'); return; }
    var uit = (r && r.data) || {};
    /* Het werkstuk onthouden: een tweede variant uit dezelfde generatie hoort
       aan hetzelfde werkstuk te hangen en niet aan een nieuw. */
    if (state.lastGenerated && uit.werkstuk_id) state.lastGenerated.werkstuk_id = uit.werkstuk_id;
    tkSluit();
    if (typeof toast === 'function') toast('Klaargezet als ' + (uit.ad_name || 'test') + ' — staat in Creative Strategy');
    if (typeof _cs !== 'undefined') { _cs.inited = _cs.inited; if (typeof csLoad === 'function') csLoad(); }
  }).catch(function (e) {
    _tk.bezig = false;
    if (knop) { knop.disabled = false; knop.textContent = 'Bevestigen en naar Creative Strategy'; }
    tkFout((e && e.message) || 'Het opslaan lukte niet.');
  });
}

/* Opslaan als concept doet wat het zegt: het gaat naar de bibliotheek zoals
   altijd, zonder werkstuk en zonder test. Dat is geen halve test maar een
   bewaarde gedachte. */
function tkConcept() {
  tkSluit();
  if (typeof saveToLibraryFromCard === 'function') saveToLibraryFromCard(_tk.index);
}

/* Niet testen is een geldige uitkomst en moet altijd kunnen — anders wordt elke
   gegenereerde variant vanzelf een test. */
function tkNietTesten() { tkSluit(); if (typeof toast === 'function') toast('Niet getest. De variant blijft staan in dit scherm.'); }
