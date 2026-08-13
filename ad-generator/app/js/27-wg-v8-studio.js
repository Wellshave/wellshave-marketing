(function () {
  'use strict';
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var gen = document.getElementById('main-tab-generator');
  var formGrid = gen && gen.querySelector('.form-grid');
  if (!gen || !formGrid || gen.querySelector('.ws8-grid')) return;

  /* ---------- shell ---------- */
  var header = el('div', 'ws8-header');
  var grid = el('div', 'ws8-grid');
  var left = el('div', 'ws8-left'), center = el('div', 'ws8-center'), right = el('div', 'ws8-right');
  grid.appendChild(left); grid.appendChild(center); grid.appendChild(right);

  /* Elke kolom draagt zijn eigen naam met een lijn eronder (ontwerpcontract
     6c.6). Alleen links had er een; midden en rechts waren naamloze stapels
     kaarten naast elkaar, en dan moet je uit de inhoud afleiden waar je bent.
     De koppen komen hier, vóór het herverdelen, zodat ze bovenaan staan
     zonder dat de volgorde van de rest verschuift. */
  center.appendChild(el('div', 'ws8-zone-lbl', 'Werkblad'));
  right.appendChild(el('div', 'ws8-zone-lbl', 'Resultaat'));

  /* ---------- accordion-hulpjes ---------- */
  function makeAcc(title, open) {
    var acc = el('div', 'ws8-acc' + (open ? ' open' : ''));
    var head = el('div', 'ws8-acc-head',
      '<div><div class="ws8-acc-t">' + esc(title) + '</div><div class="ws8-acc-sum"></div></div><span class="ws8-acc-chev">▾</span>');
    var body = el('div', 'ws8-acc-body');
    acc.appendChild(head); acc.appendChild(body);
    head.addEventListener('click', function () { acc.classList.toggle('open'); });
    head.setAttribute('tabindex', '0'); head.setAttribute('role', 'button');
    head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); acc.classList.toggle('open'); } });
    return { acc: acc, body: body, sum: head.querySelector('.ws8-acc-sum') };
  }
  var accBasis = makeAcc('Product & plaatsing', true);
  var accDoel = makeAcc('Doelgroep & funnel', false);

  /* ---------- bestaande knopen herverdelen (IDs en listeners blijven) ----------
     De formulier-secties leven deels in .form-grid en deels als directe
     kinderen van het tabblad; we routeren daarom op inhoud, niet op plek. */
  var kids = Array.prototype.slice.call(formGrid.children);
  kids.forEach(function (node) {
    if (node.classList && (node.classList.contains('field') || node.id === 'bundle-field')) accBasis.body.appendChild(node);
  });
  var order = ['.mode-tabs', '#brain-dump-card', '.iw-launch', '#source-ad-section'];
  order.forEach(function (sel) { var n = gen.querySelector(sel); if (n) center.appendChild(n); });
  function sectionTitle(sec) { var t = sec.querySelector('.form-section-title'); return t ? t.textContent : ''; }
  Array.prototype.slice.call(gen.querySelectorAll('.form-section')).forEach(function (sec) {
    if (accDoel.body.contains(sec) || center.contains(sec)) return;
    var t = sectionTitle(sec);
    if (/doelgroep/i.test(t)) { accDoel.body.appendChild(sec); return; }
    if (/format/i.test(t)) center.appendChild(el('div', 'ws8-step scratch-only', '<b>Stap 2</b><span>Kies het format</span><small>de creatieve opzet, 42 mogelijkheden</small>'));
    if (/invalshoek/i.test(t)) center.appendChild(el('div', 'ws8-step scratch-only', '<b>Stap 3</b><span>Scherp de invalshoek aan</span><small>archetype en concept-richting, of laat Rory het invullen</small>'));
    center.appendChild(sec);
  });
  /* Restanten in .form-grid (copy-opties, iterate-blokken) in bronvolgorde mee */
  Array.prototype.slice.call(formGrid.children).forEach(function (node) { center.appendChild(node); });

  /* Links: basis, doelgroep, API */
  left.appendChild(el('div', 'ws8-zone-lbl', 'Configuratie'));
  left.appendChild(accBasis.acc);
  left.appendChild(accDoel.acc);
  var settings = document.getElementById('settings-panel');
  if (settings) left.appendChild(settings);

  /* Rechts: inspiratie + output */
  /* Losse tabblad-kinderen (waarschuwingen, genereer-rij, iterate-blokken)
     mee naar het midden, in bronvolgorde; shell-elementen slaan we over */
  Array.prototype.slice.call(gen.children).forEach(function (node) {
    if (node === formGrid || node === header || node === grid) return;
    if (node.id === 'results' || node.id === 'settings-panel') return;
    if (node.classList && (node.classList.contains('ws8-header') || node.classList.contains('ws8-grid'))) return;
    center.appendChild(node);
  });

  var inspire = el('div', 'ws8-inspire');
  inspire.innerHTML =
      '<div class="ws8-insp-card" style="margin-bottom:12px;"><div class="ws8-insp-t">Live preview</div>'
    + '<div class="ws8-live-ph"><b>Je variaties landen hier</b><span>Drie concepten per generatie, elk met beeld, headline, copy en hypothese.</span></div></div>'
    + '<div class="ws8-insp-card" style="margin-bottom:12px;"><div class="ws8-insp-t">Product in beeld</div>'
    + '<div class="ws8-prod-img" id="ws8-prod-img"><div class="ph">W</div></div>'
    + '<div class="ws8-prod-cap" id="ws8-prod-cap">Kies links een product; de foto en USP’s verschijnen hier als referentie tijdens het bouwen.</div></div>'
    + '<div class="ws8-insp-card"><div class="ws8-insp-t">Waar Theriot op let</div>'
    + '<div class="ws8-tip"><b>01</b><span>De eerste 0,3 seconde wint: één beeld, één claim, geen drukte.</span></div>'
    + '<div class="ws8-tip"><b>02</b><span>Show, don’t tell — laat het resultaat zien in plaats van het te beweren.</span></div>'
    + '<div class="ws8-tip"><b>03</b><span>Match de sophistication: hoe verzadigder de markt, hoe harder mechanisme en bewijs moeten werken.</span></div></div>';
  right.appendChild(inspire);
  var results = document.getElementById('results');
  if (results) right.appendChild(results);

  /* ---------- werkbalk ---------- */
  header.innerHTML =
      '<span class="ws8-h-title">Statics</span><span class="ws8-h-mode" id="ws8-mode">Nieuw</span>'
    + '<div class="ws8-chips">'
    + '<span class="ws8-chip" data-open="basis">Product<b id="ws8-c-prod">—</b></span>'
    + '<span class="ws8-chip" data-open="fmt">Format<b id="ws8-c-fmt">—</b></span>'
    + '<span class="ws8-chip" data-open="doel">Funnel<b id="ws8-c-fun">—</b></span>'
    + '<span class="ws8-chip" data-open="doel">Persona<b id="ws8-c-per">—</b></span>'
    + '</div>'
    + '<div class="ws8-done"><span id="ws8-done-txt">0/5</span><div class="ws8-done-bar"><i id="ws8-done-bar" style="width:0%"></i></div></div>'
    + '<button class="ws8-h-generate" type="button" onclick="dispatchGenerate()">Genereer</button>';
  gen.insertBefore(header, gen.firstChild);
  gen.appendChild(grid);
  header.querySelectorAll('.ws8-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var t = chip.getAttribute('data-open');
      var target = t === 'basis' ? accBasis.acc : t === 'doel' ? accDoel.acc : sections[0];
      if (t !== 'fmt' && target && !target.classList.contains('open')) target.classList.add('open');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- synchronisatie: chips, samenvattingen, compleetheid ---------- */
  function selText(id) { var s = document.getElementById(id); if (!s || !s.value) return ''; var o = s.options[s.selectedIndex]; return o ? o.text : ''; }
  function radioVal(nm) { var r = document.querySelector('input[name="' + nm + '"]:checked'); return r ? r.value : ''; }
  function setChip(id, v) { var e = document.getElementById(id); if (!e) return; e.textContent = v || 'kies'; e.parentNode.classList.toggle('empty', !v); }
  function sync() {
    var prod = selText('product-select'), per = selText('persona-select');
    var fun = radioVal('funnel'), arch = radioVal('archetype');
    var fmtEl = document.querySelector('.fmt-card.on .fmt-name');
    var fmt = fmtEl ? fmtEl.textContent : '';
    setChip('ws8-c-prod', prod && prod.split(',')[0]);
    setChip('ws8-c-fmt', fmt);
    setChip('ws8-c-fun', fun && fun.toUpperCase());
    setChip('ws8-c-per', per && per.split(',')[0].split('(')[0].trim());
    var mode = (typeof state !== 'undefined' && state.generatorMode) || 'scratch';
    var mEl = document.getElementById('ws8-mode');
    if (mEl) mEl.textContent = mode === 'copy' ? 'Kopieer ad' : mode === 'iterate' ? 'Itereren' : 'Nieuw';
    var parts = [prod, fmt, fun, arch, per], n = parts.filter(Boolean).length;
    var dt = document.getElementById('ws8-done-txt'), db = document.getElementById('ws8-done-bar');
    if (dt) dt.textContent = n + '/5';
    if (db) db.style.width = Math.round(n / 5 * 100) + '%';
    accBasis.sum.textContent = [prod && prod.split(',')[0], selText('placement-select')].filter(Boolean).join(' · ') || 'nog niets gekozen';
    accDoel.sum.textContent = [per && per.split(',')[0].split('(')[0].trim(), fun && fun.toUpperCase()].filter(Boolean).join(' · ') || 'persona, funnel, aantal';
    /* productfoto in het inspiratiepaneel */
    try {
      var sel = document.getElementById('product-select');
      var p = (state.products || []).find(function (x) { return x.id === sel.value || x.name === (sel.options[sel.selectedIndex] || {}).text; });
      var img = document.getElementById('ws8-prod-img'), cap = document.getElementById('ws8-prod-cap');
      if (img && p) {
        var url = (typeof window._wgProdHero === 'function') ? window._wgProdHero(p) : null;
        if (url) { img.style.backgroundImage = "url('" + url + "')"; img.innerHTML = ''; }
        else { img.style.backgroundImage = ''; img.innerHTML = '<div class="ph">' + esc((p.name || 'W').charAt(0)) + '</div>'; }
        if (cap) cap.innerHTML = '<strong>' + esc(p.name) + '</strong>' + (p.usps && p.usps.length ? ' · ' + esc(p.usps.slice(0, 2).join(' · ')) : '') + (url ? '' : ' · nog geen foto');
      }
    } catch (e) {}
  }
  gen.addEventListener('change', function () { setTimeout(sync, 50); });
  gen.addEventListener('click', function () { setTimeout(sync, 120); });
  if (typeof window.setMode === 'function') {
    var prevSetMode = window.setMode;
    window.setMode = function (m) { prevSetMode.apply(this, arguments); try { sync(); } catch (e) {} };
  }
  var t0 = 0, iv = setInterval(function () { t0++; sync(); if (t0 > 8) clearInterval(iv); }, 500);

  /* Preview-placeholder wijkt zodra er echte resultaten staan */
  if (results) {
    try {
      new MutationObserver(function () {
        right.classList.toggle('has-results', results.childElementCount > 0);
      }).observe(results, { childList: true });
    } catch (e) {}
  }
})();
