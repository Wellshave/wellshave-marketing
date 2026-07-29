(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- Tellende getallen (dashboard) ---------- */
  function countUp(el) {
    var target = parseInt(el.textContent, 10);
    if (isNaN(target) || target <= 0 || reduce || el._wgCounted) { el._wgCounted = true; return; }
    el._wgCounted = true;
    var start = null, dur = 650;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step); else el.textContent = String(target);
    }
    requestAnimationFrame(step);
  }

  /* ---------- Balken laden naar hun stand ---------- */
  function animateBars(host) {
    if (reduce) return;
    host.querySelectorAll('.ws-progress span, .dash-rank-bar > div').forEach(function (b) {
      if (b._wgAnimated) return; b._wgAnimated = true;
      var w = b.style.width; b.style.width = '0%';
      requestAnimationFrame(function () { requestAnimationFrame(function () { b.style.width = w; }); });
    });
  }

  /* ---------- 14-daagse activiteits-sparkline uit echte saved_at-data ---------- */
  function buildTrend() {
    var lib = (typeof state !== 'undefined' && state.library) ? state.library : [];
    var scripts = (typeof state !== 'undefined' && state.scriptLibrary) ? state.scriptLibrary : [];
    var stamps = lib.concat(scripts).map(function (x) { return x.saved_at || 0; }).filter(Boolean);
    if (stamps.length < 2) return null;
    var DAY = 86400000, now = Date.now(), days = [];
    for (var i = 13; i >= 0; i--) {
      var from = now - (i + 1) * DAY, to = now - i * DAY;
      days.push(stamps.filter(function (t) { return t > from && t <= to; }).length);
    }
    var week = days.slice(7).reduce(function (a, b) { return a + b; }, 0);
    var prev = days.slice(0, 7).reduce(function (a, b) { return a + b; }, 0);
    var max = Math.max.apply(null, days.concat([1]));
    var W = 150, H = 36, stepX = W / 13;
    var pts = days.map(function (v, idx) { return [idx * stepX, H - 3 - (v / max) * (H - 8)]; });
    var line = pts.map(function (p, idx) { return (idx ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var fill = line + ' L' + W + ',' + H + ' L0,' + H + ' Z';
    var deltaTxt = week > prev ? '<span class="up">+' + (week - prev) + '</span> deze week'
      : week < prev ? (week - prev) + ' deze week'
      : week + ' deze week';
    return '<div class="dash-trend" role="img" aria-label="Bewaard-activiteit, laatste 14 dagen">'
      + '<svg width="150" height="36" viewBox="0 0 150 36" aria-hidden="true">'
      + '<defs><linearGradient id="wgTrendFade" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0" stop-color="rgba(242,197,61,0.35)"/><stop offset="1" stop-color="rgba(242,197,61,0)"/></linearGradient></defs>'
      + '<path class="dash-trend-fill" d="' + fill + '"/><path class="dash-trend-line" d="' + line + '"/></svg>'
      + '<div class="dash-trend-meta"><span class="dash-trend-delta">' + deltaTxt + '</span>'
      + '<span class="dash-trend-lbl">bewaard, 14 dagen</span></div></div>';
  }

  function upgradeDashboard() {
    var host = document.getElementById('main-tab-dashboard');
    if (!host || host.style.display === 'none') return;
    var hi = host.querySelector('.dash-hi');
    if (hi && !hi.querySelector('.dash-trend')) {
      var t = buildTrend();
      if (t) hi.insertAdjacentHTML('beforeend', t);
    }
    host.querySelectorAll('.dash-num').forEach(countUp);
    animateBars(host);
    updateNavCounts();
  }
  if (typeof window.wgRenderDashboard === 'function' && !window._wgDashUpgraded) {
    window._wgDashUpgraded = true;
    var origDash = window.wgRenderDashboard;
    window.wgRenderDashboard = function () {
      origDash.apply(this, arguments);
      try { upgradeDashboard(); } catch (e) {}
    };
  }

  /* ---------- Zijbalk-tellers: hoeveel er in elke bibliotheek zit ---------- */
  function setNavCount(btnId, n) {
    var btn = document.getElementById(btnId); if (!btn) return;
    var b = btn.querySelector('.ws-nav-count');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'ws-nav-count'; btn.appendChild(b); }
    if (b.textContent !== String(n)) b.textContent = String(n);
  }
  function updateNavCounts() {
    try {
      if (typeof state === 'undefined') return;
      setNavCount('main-tab-btn-library', (state.library || []).length);
      setNavCount('main-tab-btn-scripts', (state.scriptLibrary || []).length);
      setNavCount('main-tab-btn-personas', (state.personas || []).length);
      setNavCount('main-tab-btn-products', (state.products || []).length);
    } catch (e) {}
  }

  /* ---------- Empty states: uitleg plus de actie die de lijst vult ---------- */
  var EMPTY_ACTIONS = {
    'main-tab-library': { t: 'Nog geen concepten bewaard', s: 'Genereer een ad en klik op Bewaar concept; hij verschijnt hier met beeld, copy en metadata.', btn: 'Nieuwe ad maken', go: function () { switchMainTab('generator'); } },
    'main-tab-scripts': { t: 'Nog geen scripts bewaard', s: 'Schrijf of itereer een video-script in de Scriptwriter en bewaar hem; de hele combinatie van bron, cijfers en resultaat komt hier terecht.', btn: 'Naar de Scriptwriter', go: function () { switchMainTab('scriptwriter'); } },
    'main-tab-creatives': { t: 'Nog geen creatives gevonden', s: 'Bewaar een script in de Scriptwriter, voeg zelf een rij toe, of importeer de bestaande rijen uit de Creative Strategy Map.', btn: 'Naar de Scriptwriter', go: function () { switchMainTab('scriptwriter'); } }
  };
  var EMPTY_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';
  function upgradeEmpties() {
    Object.keys(EMPTY_ACTIONS).forEach(function (tabId) {
      var tab = document.getElementById(tabId); if (!tab) return;
      tab.querySelectorAll('.library-empty, .slib-empty, .dash-empty').forEach(function (el) {
        if (el._wgEmptyDone || el.querySelector('.wg-empty')) return;
        el._wgEmptyDone = true;
        var a = EMPTY_ACTIONS[tabId];
        el.innerHTML = '<div class="wg-empty"><div class="wg-empty-ico">' + EMPTY_ICO + '</div>'
          + '<div class="wg-empty-t">' + esc(a.t) + '</div>'
          + '<div class="wg-empty-s">' + esc(a.s) + '</div>'
          + '<button class="btn btn-small" type="button">' + esc(a.btn) + '</button></div>';
        var btn = el.querySelector('button');
        if (btn) btn.addEventListener('click', function () { try { a.go(); } catch (e) {} });
      });
    });
  }
  /* Toasts melden zich bij de screenreader zonder de focus te stelen */
  function stampToasts() {
    document.querySelectorAll('.toast, .done-toast').forEach(function (t) {
      if (!t.hasAttribute('aria-live')) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); }
    });
  }
  try {
    new MutationObserver(function () { upgradeEmpties(); updateNavCounts(); stampToasts(); })
      .observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
  upgradeEmpties();
  stampToasts();

  /* ---------- Wijzigingen: lange teksten klembaar maken ---------- */
  function upgradeChangelog() {
    var list = document.getElementById('changelog-list'); if (!list) return;
    list.querySelectorAll('.changelog-item').forEach(function (item) {
      if (item._wgClamp) return; item._wgClamp = true;
      var desc = item.querySelector('.changelog-desc'); if (!desc) return;
      if (desc.textContent.length < 420) return;
      item.classList.add('wg-clampable');
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'button');
      item.setAttribute('aria-expanded', 'false');
      var more = document.createElement('span');
      more.className = 'wg-cl-more'; more.innerHTML = '<span class="wg-cl-more-t"></span>';
      desc.after(more);
      function toggle() {
        var open = item.classList.toggle('open');
        item.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      item.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        toggle();
      });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }
  var clList = document.getElementById('changelog-list');
  if (clList) {
    try { new MutationObserver(upgradeChangelog).observe(clList, { childList: true }); } catch (e) {}
    upgradeChangelog();
  }

  /* Eerste stand van de tellers, zodra state er is */
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (typeof state !== 'undefined' || tries > 20) { clearInterval(iv); updateNavCounts(); }
  }, 250);
})();
