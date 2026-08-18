(function () {
  'use strict';
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var gen = document.getElementById('main-tab-generator');
  var right = gen && gen.querySelector('.ws8-right');
  var inspire = gen && gen.querySelector('.ws8-inspire');
  if (!gen || !right || !inspire || document.getElementById('ws9-advies')) return;

  var PLACEMENTS = { feed11: { r: '1 / 1', n: 'Feed 1:1' }, feed45: { r: '4 / 5', n: 'Feed 4:5' }, stories: { r: '9 / 16', n: 'Story 9:16' }, reels: { r: '9 / 16', n: 'Reels 9:16' } };
  var FUNNEL_TIP = {
    tof: 'Koud publiek kent je nog niet: native en lo-fi formats en een nieuwsgierige hook stoppen de scroll — verkoop het probleem, dan pas het product.',
    mof: 'Dit publiek vergelijkt: vergelijkings- en educatieformats met bewijs werken hier het hardst.',
    bof: 'Warm publiek twijfelt nog ergens over: stapel bewijs en waarde, en durf een harde CTA te gebruiken.',
    rtg: 'Retargeting mag persoonlijk en direct: reminder-formats en bezwaar-beantwoording maken de cirkel rond.'
  };
  function recFor(funnel, f) {
    if (!funnel || !f) return false;
    if (funnel === 'tof') return f.brandless || ['wist-je-dat', 'probleem-agitatie', 'checklist-herkenbaar', 'stat-data-callout'].indexOf(f.id) !== -1;
    /* Product-led (cat A) hoort bij product aware publiek: midden en onderin de funnel */
    if (funnel === 'mof') return f.cat === 'C' || f.cat === 'A' || f.proof;
    return f.cta === 'hard' || f.proof || f.cat === 'A' || ['reminder-ad', 'faq-objection'].indexOf(f.id) !== -1;
  }
  function funnelVal() { var r = document.querySelector('input[name="funnel"]:checked'); return r ? r.value : ''; }
  function fmtIndex() { var m = {}; try { AD_FORMATS.forEach(function (f) { m[f.id] = f; }); } catch (e) {} return m; }
  var FMTS = fmtIndex();
  function libStats() {
    var lib = (typeof state !== 'undefined' && state.library) ? state.library : [];
    var byMode = {}, byCombo = {};
    lib.forEach(function (it) {
      var m = it.metadata || {};
      if (m.mode) byMode[m.mode] = (byMode[m.mode] || 0) + 1;
      if (m.mode && m.archetype) { var k = m.mode + '|' + m.archetype; byCombo[k] = (byCombo[k] || 0) + 1; }
    });
    return { lib: lib, byMode: byMode, byCombo: byCombo };
  }

  /* ---------- 1. adviespaneel bovenin de rechterkolom ---------- */
  var advies = document.createElement('div');
  advies.className = 'ws9-advies'; advies.id = 'ws9-advies';
  inspire.insertBefore(advies, inspire.firstChild);

  /* ---------- 2. previewvak wordt platform-mockup ---------- */
  var prevCard = inspire.querySelector('.ws8-insp-card');
  if (prevCard) {
    prevCard.innerHTML = '<div class="ws9-frame-lbl"><b>Preview</b><span id="ws9-frame-place">Feed 1:1</span></div>'
      + '<div class="ws9-frame"><div class="ws9-frame-top"><div class="ws9-frame-av" id="ws9-frame-av">W</div>'
      + '<div class="ws9-frame-nm"><span id="ws9-frame-brand">wellshave</span><small>Gesponsord</small></div><div class="ws9-frame-dots">···</div></div>'
      + '<div class="ws9-frame-media" id="ws9-frame-media"><span class="ws9-frame-badge">wacht op generatie</span>'
      + '<div class="ws9-frame-cap" id="ws9-frame-cap">Je headline landt hier</div></div>'
      + '<div class="ws9-frame-foot"><div class="ws9-sk"></div><div class="ws9-sk w60"></div>'
      + '<div class="ws9-frame-cta"><span id="ws9-frame-cta">Shop nu</span><span>→</span></div></div></div>';
  }

  /* ---------- 3. Theriot-paragrafen worden een visuele checklist ---------- */
  var cards = inspire.querySelectorAll('.ws8-insp-card');
  var tipCard = cards[cards.length - 1];
  if (tipCard && /Theriot/.test(tipCard.textContent)) {
    tipCard.innerHTML = '<div class="ws8-insp-t">Theriot-checklist per variatie</div><div class="ws9-checks">'
      + [['H', 'Hook in 0,3 sec'], ['E', 'Emotie zichtbaar'], ['B', 'Bewijs, geen claim'], ['M', 'Mechanisme uitgelegd'], ['S', 'Sophistication-match'], ['C', 'Eén duidelijke CTA']]
        .map(function (c) { return '<div class="ws9-check"><i>' + c[0] + '</i>' + c[1] + '</div>'; }).join('')
      + '</div>';
  }

  /* ---------- 4. productkaart command center (linkerkolom) ---------- */
  var prodPrev = document.getElementById('product-preview');
  var prodPanel = document.createElement('div');
  prodPanel.className = 'ws9-prod'; prodPanel.id = 'ws9-prod';
  if (prodPrev && prodPrev.parentNode) prodPrev.parentNode.insertBefore(prodPanel, prodPrev.nextSibling);
  function stepProduct(dir) {
    var sel = document.getElementById('product-select'); if (!sel || !sel.options.length) return;
    var i = sel.selectedIndex + dir;
    if (i < 0) i = sel.options.length - 1;
    if (i >= sel.options.length) i = 0;
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ---------- 5. format-kaarten decoreren ---------- */
  function decorateFormats() {
    var grid = document.getElementById('fmt-grid'); if (!grid) return;
    var fun = funnelVal(); var stats = libStats();
    grid.querySelectorAll('.fmt-card').forEach(function (card) {
      var m = (card.getAttribute('onclick') || '').match(/pickFormat\('([^']+)'\)/);
      var f = m && FMTS[m[1]]; if (!f) return;
      var key = f.id + '|' + fun + '|' + (stats.byMode[f.id] || 0);
      if (card.dataset.ws9 === key) return;
      card.dataset.ws9 = key;
      var old = card.querySelector('.ws9-fmt-meta'); if (old) old.remove();
      var oldRec = card.querySelector('.ws9-rec'); if (oldRec) oldRec.remove();
      var fits = { tof: recFor('tof', f), mof: recFor('mof', f), bof: recFor('bof', f) };
      var used = stats.byMode[f.id] || 0;
      var meta = document.createElement('div');
      meta.className = 'ws9-fmt-meta';
      meta.innerHTML = '<span class="ws9-ff" title="Funnel-fit volgens de Theriot-regels">'
        + '<i class="' + (fits.tof ? 'on' : '') + '">T</i><i class="' + (fits.mof ? 'on' : '') + '">M</i><i class="' + (fits.bof ? 'on' : '') + '">B</i></span>'
        + (f.proof ? '<span class="ws9-pill proof">bewijs</span>' : '')
        + (f.cta === 'hard' ? '<span class="ws9-pill">harde CTA</span>' : f.cta === 'none' ? '<span class="ws9-pill">native</span>' : '')
        + (used ? '<span class="ws9-pill used">' + used + '× gebruikt</span>' : '');
      card.appendChild(meta);
      if (fun && recFor(fun === 'rtg' ? 'bof' : fun, f)) {
        var badge = document.createElement('span');
        badge.className = 'ws9-rec'; badge.textContent = 'AANBEVOLEN';
        badge.title = 'Past volgens de Theriot-regels bij de gekozen funnel-fase';
        card.appendChild(badge);
      }
    });
  }
  var fmtGrid = document.getElementById('fmt-grid');
  if (fmtGrid) { try { new MutationObserver(function () { decorateFormats(); }).observe(fmtGrid, { childList: true }); } catch (e) {} }

  /* ---------- synchronisatie ---------- */
  function selOpt(id) { var s = document.getElementById(id); if (!s || !s.value) return null; return s.options[s.selectedIndex]; }
  function sync2() {
    var fun = funnelVal();
    var stats = libStats();
    var perOpt = selOpt('persona-select');
    var prodSel = document.getElementById('product-select');
    var p = null;
    try { p = (state.products || []).find(function (x) { return prodSel && (x.id === prodSel.value || x.name === (prodSel.options[prodSel.selectedIndex] || {}).text); }); } catch (e) {}

    /* advies */
    var rows = '';
    if (fun && FUNNEL_TIP[fun]) rows += '<div class="ws9-ins"><span class="ws9-ins-src">THERIOT</span><span>' + FUNNEL_TIP[fun] + '</span></div>';
    var best = null, bestN = 0;
    Object.keys(stats.byCombo).forEach(function (k) { if (stats.byCombo[k] > bestN) { bestN = stats.byCombo[k]; best = k; } });
    if (best && bestN > 1) {
      var parts = best.split('|');
      var fname = FMTS[parts[0]] ? FMTS[parts[0]].name : parts[0];
      rows += '<div class="ws9-ins"><span class="ws9-ins-src lib">JOUW DATA</span><span>Meest bewaarde combinatie tot nu toe: <b>' + esc(fname) + '</b> met archetype <b>' + esc(parts[1]) + '</b> (' + bestN + '×).</span></div>';
    } else if (!stats.lib.length) {
      rows += '<div class="ws9-ins"><span class="ws9-ins-src lib">JOUW DATA</span><span>Nog geen bewaarde ads — na de eerste generaties verschijnen hier patronen uit je eigen bibliotheek.</span></div>';
    }
    if (perOpt) {
      var per = null;
      try { per = (state.personas || []).find(function (x) { return x.id === document.getElementById('persona-select').value || x.name === perOpt.text.split(',')[0]; }); } catch (e) {}
      if (per) {
        var nAng = (per.angles && per.angles.length) || 0;
        rows += '<div class="ws9-ins"><span class="ws9-ins-src">RORY</span><span><b>' + esc((per.name || '').split(',')[0]) + '</b> heeft ' + (nAng ? nAng + ' uitgewerkte angles — Rory kiest hieruit de scherpste hoek.' : 'nog geen uitgewerkte angles; verrijk de persona voor scherpere hoeken.') + '</span></div>';
      }
    }
    advies.innerHTML = '<div class="ws9-advies-t">Rory &amp; Theriot denken mee</div>' + (rows || '<div class="ws9-ins"><span>Kies een funnel-fase en persona; het advies verschijnt hier.</span></div>');

    /* preview-mockup */
    var plOpt = document.getElementById('placement-select');
    var pl = PLACEMENTS[plOpt && plOpt.value] || PLACEMENTS.feed11;
    var media = document.getElementById('ws9-frame-media');
    var place = document.getElementById('ws9-frame-place');
    if (media) media.style.aspectRatio = pl.r;
    if (place) place.textContent = pl.n;
    var brandEl = document.getElementById('ws9-frame-brand'), avEl = document.getElementById('ws9-frame-av');
    var isShine = (typeof ACTIVE_BRAND !== 'undefined' && ACTIVE_BRAND === 'wellshine');
    if (brandEl) brandEl.textContent = isShine ? 'wellshine' : 'wellshave';
    if (avEl) avEl.textContent = isShine ? 'S' : 'W';
    if (media && p) {
      var url = (typeof window._wgProdHero === 'function') ? window._wgProdHero(p) : null;
      var next = url ? "url('" + url + "')" : '';
      if (media.dataset.img !== next) {
        media.dataset.img = next;
        media.style.opacity = '0.35';
        setTimeout(function () { media.style.backgroundImage = next; media.style.opacity = '1'; }, 180);
      }
      var cap = document.getElementById('ws9-frame-cap');
      if (cap) cap.textContent = 'Je headline over ' + (p.name || 'dit product') + ' landt hier';
    }
    var cta = document.getElementById('ws9-frame-cta');
    if (cta) cta.textContent = fun === 'tof' ? 'Meer informatie' : fun === 'mof' ? 'Ontdek waarom' : 'Shop nu';

    /* productkaart */
    if (p) {
      var bd = { product: 0, lifestyle: 0, packaging: 0 };
      try { bd = refBreakdown(p.references) || bd; } catch (e) {}
      var fotos = (bd.product || 0) + (bd.lifestyle || 0) + (bd.packaging || 0);
      var ads = stats.lib.filter(function (it) { return it.metadata && it.metadata.product === p.name; }).length;
      prodPanel.innerHTML = '<div class="ws9-prod-row">'
        + '<div class="ws9-prod-stat"><b>' + fotos + '</b><span>foto’s</span></div>'
        + '<div class="ws9-prod-stat"><b>' + ads + '</b><span>ads gemaakt</span></div>'
        + '<div class="ws9-prod-stat"><b>' + ((p.usps || []).length) + '</b><span>USP’s</span></div></div>'
        + '<div class="ws9-usps">' + (p.usps || []).slice(0, 3).map(function (u) { return '<span class="ws9-usp">' + esc(u) + '</span>'; }).join('') + '</div>'
        + '<div class="ws9-prod-nav"><button type="button" data-dir="-1">◂ Vorig product</button><button type="button" data-dir="1">Volgend ▸</button></div>';
      prodPanel.querySelectorAll('button[data-dir]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); stepProduct(parseInt(b.getAttribute('data-dir'), 10)); });
      });
    }

    /* klaar-staat op de werkbalk */
    var doneTxt = document.getElementById('ws8-done-txt');
    var genBtn = gen.querySelector('.ws8-h-generate');
    if (doneTxt && genBtn) {
      var ready = doneTxt.textContent.trim() === '5/5';
      genBtn.classList.toggle('ready', ready);
      genBtn.textContent = ready ? 'Klaar — genereer' : 'Genereer';
    }
    decorateFormats();
  }
  gen.addEventListener('change', function () { setTimeout(sync2, 80); });
  gen.addEventListener('click', function () { setTimeout(sync2, 150); });
  var t0 = 0, iv = setInterval(function () { t0++; sync2(); if (t0 > 8) clearInterval(iv); }, 600);
})();
