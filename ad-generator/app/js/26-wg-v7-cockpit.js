(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function imgUrl(im) {
    if (!im) return null;
    if (typeof im === 'string') return im.indexOf('data:') === 0 ? im : null;
    if (im.b64) return 'data:' + (im.mime || 'image/png') + ';base64,' + im.b64;
    if (im.dataUrl) return im.dataUrl;
    return null;
  }
  /* Productfoto's leven in product.references (product/lifestyle/packaging) */
  function prodHero(p) {
    if (!p) return null;
    try {
      var n = (typeof normalizeRefs === 'function') ? normalizeRefs(p.references) : (p.references || {});
      var hero = (n.product && n.product[0]) || (n.lifestyle && n.lifestyle[0]) || (n.packaging && n.packaging[0]);
      if (hero) return imgUrl(hero);
    } catch (e) {}
    return imgUrl(p.images && p.images[0]);
  }
  window._wgProdHero = prodHero;
  var DAY = 86400000;

  function renderCockpit() {
    var host = document.getElementById('main-tab-dashboard');
    if (!host || host.style.display === 'none') return;
    var prof = window._authProfile || {};
    var name = prof.full_name ? String(prof.full_name).split(' ')[0] : (prof.email ? String(prof.email).split('@')[0] : '');
    var brand = (typeof ACTIVE_BRAND !== 'undefined' && ACTIVE_BRAND === 'wellshine') ? 'Wellshine' : 'Wellshave';
    var lib = (typeof state !== 'undefined' && state.library) ? state.library : [];
    var prods = (typeof state !== 'undefined' && state.products) ? state.products : [];
    var pers = (typeof state !== 'undefined' && state.personas) ? state.personas : [];
    var scripts = (typeof state !== 'undefined' && state.scriptLibrary) ? state.scriptLibrary : [];
    var now = Date.now();
    var dateStr = ''; try { dateStr = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) {}

    /* -- weekritme uit echte saved_at-data -- */
    var stamps = lib.concat(scripts).map(function (x) { return x.saved_at || 0; }).filter(Boolean);
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var from = now - (i + 1) * DAY, to = now - i * DAY;
      days.push(stamps.filter(function (t) { return t > from && t <= to; }).length);
    }
    var week = days.slice(7).reduce(function (a, b) { return a + b; }, 0);
    var prev = days.slice(0, 7).reduce(function (a, b) { return a + b; }, 0);
    var ringRef = Math.max(prev, week, 1);
    var ringPct = Math.min(1, week / ringRef);
    var maxDay = Math.max.apply(null, days.concat([1]));
    function barsHtml() {
      return days.map(function (v, idx) {
        var h = Math.max(6, Math.round(v / maxDay * 100));
        return '<i style="height:' + (v ? h : 6) + '%" class="' + (idx >= 7 && v ? 'hot' : '') + '" title="' + v + '"></i>';
      }).join('');
    }
    var weekLine = week > prev ? 'Sterker dan vorige week — houd het ritme vast.'
      : week < prev ? 'Vorige week lag hoger; er staat werk klaar hieronder.'
      : week > 0 ? 'Gelijk aan vorige week.' : 'Nog geen output deze week. De cockpit staat klaar.';

    /* -- volgende actie, berekend -- */
    var noPhoto = prods.filter(function (p) { return !prodHero(p); }).length;
    var noAngles = pers.filter(function (p) { return !(p.angles && p.angles.length); }).length;
    var noImg = lib.filter(function (it) { return !(it.image && it.image.b64); }).length;
    var next;
    if (!lib.length) next = { t: 'Genereer je eerste statics', s: 'Er staan ' + prods.length + ' producten en ' + pers.length + ' persona’s klaar. Eén gerichte sessie en de bibliotheek, de pipeline en het mozaïek hieronder komen tot leven.', btn: 'Start een sessie', go: 'generator', badge: '01' }
    else if (noPhoto > Math.max(2, prods.length / 2)) next = { t: 'Geef producten een gezicht', s: noPhoto + ' producten hebben nog geen foto. Met beeld erbij worden de spotlight-module en de gegenereerde ads direct sterker.', btn: 'Naar producten', go: 'products', badge: '02' }
    else if (noImg > 0) next = { t: 'Maak concepten af', s: noImg + ' bewaarde concepten hebben nog geen beeld. Genereer de visual en ze zijn klaar voor iteratie.', btn: 'Open bibliotheek', go: 'library', badge: '03' }
    else next = { t: 'Itereer op een winner', s: 'De basis staat. Pak het best presterende concept en bouw er varianten op — daar zit de volgende sprong.', btn: 'Naar itereren', go: 'iterate', badge: '04' };

    /* -- spotlight: product met de meeste ads, anders eerste met foto -- */
    var byProd = {};
    lib.forEach(function (it) { var k = it.metadata && it.metadata.product; if (k) byProd[k] = (byProd[k] || 0) + 1; });
    var spot = null, spotAds = 0;
    prods.forEach(function (p) {
      var n = byProd[p.name] || 0;
      if (!spot || n > spotAds || (n === spotAds && !prodHero(spot) && prodHero(p))) { spot = p; spotAds = n; }
    });
    var spotImg = prodHero(spot);

    /* -- pipeline -- */
    var withImg = lib.length - noImg;
    var maxStage = Math.max(lib.length, scripts.length, 1);
    function stage(nm, n, go, on) {
      return '<div class="ws7-stage ' + (n ? 'on' : '') + '" data-go="' + go + '"><div class="ws7-stage-name"><span class="ws7-stage-dot"></span>' + nm + '</div>'
        + '<div class="ws7-stage-bar"><i data-w="' + Math.round(n / maxStage * 100) + '"></i></div>'
        + '<div class="ws7-stage-n">' + n + '</div></div>';
    }

    /* -- prioriteiten -- */
    var scriptsMonth = scripts.filter(function (s) { return now - (s.saved_at || 0) < 30 * DAY; }).length;
    function task(n, t, sub, go) {
      var done = n === 0;
      return '<div class="ws7-task' + (done ? ' done' : '') + '" data-go="' + go + '"><span class="ws7-task-n">' + (done ? '✓' : n) + '</span><div class="ws7-task-t">' + t + '<small>' + sub + '</small></div></div>';
    }

    /* -- mozaïek: laatste 8, eerste groot -- */
    var recent = lib.slice().sort(function (a, b) { return (b.saved_at || 0) - (a.saved_at || 0); });
    var tiles = '';
    var shown = recent.filter(function (it) { return it.image && it.image.b64; }).slice(0, 9);
    if (shown.length) {
      tiles = shown.map(function (it, idx) {
        var v = it.variation || {}, m = it.metadata || {};
        return '<div class="ws7-tile' + (idx === 0 ? ' big' : '') + '" data-libid="' + esc(it.id) + '" style="background-image:url(\'data:' + (it.image.mime || 'image/png') + ';base64,' + it.image.b64 + '\')">'
          + '<div class="ws7-tile-cap">' + esc(v.headline_nl || m.product || '') + '</div></div>';
      }).join('');
      for (var f = shown.length; f < 9; f++) tiles += '<div class="ws7-tile ph"><span>volgende creative</span></div>';
    } else {
      tiles = '<div class="ws7-tile big ph"><span>Je eerste gegenereerde static verschijnt hier, groot en met headline</span></div>'
        + '<div class="ws7-tile ph"><span>variant 2</span></div><div class="ws7-tile ph"><span>variant 3</span></div>'
        + '<div class="ws7-tile ph"><span>variant 4</span></div><div class="ws7-tile ph"><span>variant 5</span></div>'
        + '<div class="ws7-tile ph"><span>iteratie</span></div><div class="ws7-tile ph"><span>iteratie</span></div>'
        + '<div class="ws7-tile ph"><span>iteratie</span></div>';
    }

    /* -- iteratiekandidaten -- */
    var iterRows = recent.filter(function (it) { return it.image && it.image.b64; }).slice(0, 4).map(function (it) {
      var v = it.variation || {}, m = it.metadata || {};
      return '<div class="ws7-iter-row" data-libid="' + esc(it.id) + '">'
        + '<div class="ws7-iter-thumb" style="background-image:url(\'data:' + (it.image.mime || 'image/png') + ';base64,' + it.image.b64 + '\')"></div>'
        + '<div style="min-width:0;"><div class="ws7-iter-h">' + esc(v.headline_nl || '(geen headline)') + '</div>'
        + '<div class="ws7-iter-m">' + esc(m.product || '') + ' · ' + esc(String(m.funnel || '').toUpperCase()) + '</div></div>'
        + '<span class="ws7-iter-go">Itereer →</span></div>';
    }).join('') || '<div class="ws7-empty-line">Zodra een concept een beeld heeft, staat hij hier klaar om op door te bouwen. Genereer eerst een static.</div>';

    var nv = '', nt = '', nd = '';
    try { if (typeof CHANGELOG !== 'undefined' && CHANGELOG[0]) { nv = CHANGELOG[0].version; nt = CHANGELOG[0].title; nd = CHANGELOG[0].date; } } catch (e) {}

    host.innerHTML = '<div class="ws7">'
      /* rij 1 */
      + '<section class="ws7-panel ws7-dark ws7-hero">'
      +   '<div class="ws7-hero-top"><div><div class="ws7-hello">Welkom terug' + (name ? ', ' + esc(name) : '') + '</div>'
      +   '<div class="ws7-hero-sub">' + brand + ' · ' + esc(dateStr) + '</div></div>'
      +   '<div class="ws7-cta-row"><button class="ws7-btn ws7-btn-amber" data-go="new">Nieuwe ad</button>'
      +   '<button class="ws7-btn ws7-btn-ghost" data-go="iterate">Itereren</button></div></div>'
      +   '<div class="ws7-hero-mid">'
      +     '<div class="ws7-week"><div class="ws7-ring"><svg width="116" height="116"><circle class="ws7-ring-bg" cx="58" cy="58" r="50"/>'
      +     '<circle class="ws7-ring-val" cx="58" cy="58" r="50" stroke-dasharray="314.16" stroke-dashoffset="314.16" data-off="' + (314.16 * (1 - ringPct)).toFixed(1) + '"/></svg>'
      +     '<div class="ws7-ring-num"><div class="ws7-huge" data-count="' + week + '">' + week + '</div><span>deze week</span></div></div>'
      +     '<div class="ws7-week-copy"><div class="ws7-huge">' + weekLine + '</div>'
      +     '<div class="ws7-meta">' + prev + ' bewaard vorige week · concepten en scripts samen</div></div></div>'
      +     '<div class="ws7-hero-stats">'
      +       '<div class="ws7-hstat"><div class="ws7-huge" data-count="' + lib.length + '">' + lib.length + '</div><div>concepten</div></div>'
      +       '<div class="ws7-hstat"><div class="ws7-huge" data-count="' + scripts.length + '">' + scripts.length + '</div><div>scripts</div></div>'
      +       '<div class="ws7-hstat"><div class="ws7-huge" data-count="' + prods.length + '">' + prods.length + '</div><div>producten</div></div>'
      +     '</div></div>'
      +   '<div class="ws7-hero-foot"><div class="ws7-bars">' + barsHtml() + '</div>'
      +   '<div class="ws7-meta" style="color:rgba(243,239,230,0.45);">activiteit, laatste 14 dagen</div></div>'
      + '</section>'
      + '<section class="ws7-panel ws7-amber ws7-next" data-go="' + next.go + '">'
      +   '<span class="ws7-next-badge">' + next.badge + '</span>'
      +   '<div class="ws7-kicker">Aanbevolen volgende actie</div>'
      +   '<div class="ws7-next-t">' + next.t + '</div><div class="ws7-next-s">' + next.s + '</div>'
      +   '<button class="ws7-btn ws7-btn-dark">' + next.btn + '</button>'
      + '</section>'
      /* rij 2 */
      + '<section class="ws7-panel ws7-photo ws7-spot" data-go="new">'
      +   (spotImg ? '<div class="ws7-spot-img" style="background-image:url(\'' + spotImg + '\')"></div>'
                   : '<div class="ws7-spot-ph"><b>' + esc((spot && spot.name || 'W').charAt(0)) + '</b></div>')
      +   '<div class="ws7-spot-scrim"></div>'
      +   '<div class="ws7-spot-body"><div class="ws7-kicker" style="color:rgba(243,239,230,0.65);">Product-spotlight</div>'
      +   '<div class="ws7-spot-name">' + esc(spot ? spot.name : 'Nog geen product') + '</div>'
      +   '<div class="ws7-spot-meta">' + (spot ? spotAds + ' ads gemaakt · ' + ((spot.usps || []).length) + ' USP’s' + (spotImg ? '' : ' · nog geen foto') : '') + '</div>'
      +   '<button class="ws7-btn ws7-btn-amber">Maak ad met dit product</button></div>'
      + '</section>'
      + '<section class="ws7-panel ws7-light ws7-pipe"><div class="ws7-sec">Creative pipeline</div>'
      +   '<div class="ws7-pipe-rows">'
      +   stage('Concepten bewaard', lib.length, 'library')
      +   stage('Met gegenereerd beeld', withImg, 'library')
      +   stage('Scripts geschreven', scripts.length, 'scripts')
      +   stage('Klaar voor iteratie', withImg, 'iterate')
      +   '</div><div class="ws7-pipe-foot">Klik een fase om de lijst te openen.</div>'
      + '</section>'
      + '<section class="ws7-panel ws7-dark ws7-tasks"><div class="ws7-kicker">Prioriteit</div>'
      +   task(noPhoto, 'Producten zonder foto', 'spotlight en ads worden sterker met beeld', 'products')
      +   task(noAngles, 'Persona’s zonder angles', 'angles sturen de invalshoek van elke ad', 'personas')
      +   task(noImg, 'Concepten zonder beeld', 'genereer de visual en ze zijn compleet', 'library')
      +   task(scriptsMonth === 0 ? 1 : 0, scriptsMonth === 0 ? 'Nog geen script deze maand' : 'Scriptritme loopt', scriptsMonth === 0 ? 'de scriptwriter staat klaar' : scriptsMonth + ' geschreven in 30 dagen', 'scriptwriter')
      + '</section>'
      /* rij 3 */
      + '<section class="ws7-panel ws7-light ws7-mosaic"><div class="ws7-sec">Recente creatives</div>'
      +   '<div class="ws7-mosaic-grid">' + tiles + '</div></section>'
      + '<section class="ws7-panel ws7-light ws7-lb"><div class="ws7-sec">Leaderboard · meest actief</div>'
      +   '<div id="dash-lb" class="dash-empty">Ranglijst laden...</div></section>'
      + '<section class="ws7-panel ws7-dark ws7-lb-dark"><div class="ws7-kicker">Leaderboard · meeste succes</div>'
      +   '<div id="dash-lb-succes" class="dash-empty">Ranglijst laden...</div></section>'
      /* rij 4 */
      + '<section class="ws7-panel ws7-light ws7-iter"><div class="ws7-sec">Klaar voor iteratie</div>' + iterRows + '</section>'
      + '<section class="ws7-panel ws7-light ws7-rhythm"><div class="ws7-sec">Ritme</div>'
      +   '<div class="ws7-rhythm-delta">' + (week >= prev ? '<em>+' + (week - prev) + '</em>' : (week - prev)) + ' <span style="font-size:14px;font-family:\'Hanken Grotesk\',sans-serif;font-weight:500;color:var(--ink-soft);">t.o.v. vorige week</span></div>'
      +   '<div class="ws7-bars">' + barsHtml() + '</div></section>'
      + '<section class="ws7-panel ws7-inset ws7-new" data-go="changelog"><div class="ws7-kicker" style="color:var(--ink-soft);">Wat is nieuw</div>'
      +   '<div class="ws7-new-v">v' + esc(nv) + '</div><div class="ws7-new-t">' + esc(nt) + '</div>'
      +   '<div class="ws7-new-s">Bekijk alle wijzigingen →</div></section>'
      + '</div>';

    /* -- interactie -- */
    host.querySelectorAll('[data-go]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-libid]')) return;
        var g = el.getAttribute('data-go');
        if (g === 'new') { switchMainTab('generator'); try { setMode('scratch'); } catch (err) {} }
        else if (g === 'iterate' && el.classList.contains('ws7-stage') === false && el.tagName === 'BUTTON') { switchMainTab('generator'); try { setMode('iterate'); } catch (err) {} }
        else if (g === 'iterate') { switchMainTab('generator'); try { setMode('iterate'); } catch (err) {} }
        else switchMainTab(g);
      });
    });
    host.querySelectorAll('[data-libid]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); try { wgOpenLibraryItem(el.getAttribute('data-libid')); } catch (err) {} });
    });

    /* -- animaties (reduced motion: alles staat direct op eindstand) -- */
    if (!reduce) {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        host.querySelectorAll('.ws7-ring-val').forEach(function (r) { r.style.strokeDashoffset = r.getAttribute('data-off'); });
        host.querySelectorAll('.ws7-stage-bar i').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
      }); });
      host.querySelectorAll('[data-count]').forEach(function (el) {
        var target = parseInt(el.getAttribute('data-count'), 10);
        if (!target) return;
        var start = null, dur = 700;
        function step(ts) { if (!start) start = ts; var p = Math.min(1, (ts - start) / dur);
          el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); }
        requestAnimationFrame(step);
      });
    } else {
      host.querySelectorAll('.ws7-ring-val').forEach(function (r) { r.style.strokeDashoffset = r.getAttribute('data-off'); });
      host.querySelectorAll('.ws7-stage-bar i').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
    }

    /* -- leaderboards: zelfde bron en element-ID's als voorheen -- */
    (function () {
      var lbEl = host.querySelector('#dash-lb'); if (!lbEl) return;
      if (!window._sb) { lbEl.textContent = 'Ranglijst is beschikbaar zodra je bent ingelogd op de live tool.'; return; }
      try {
        window._sb.from('activity_log').select('user_email,user_name,item_key').order('created_at', { ascending: false }).limit(3000).then(function (r) {
          if (!r || r.error) { lbEl.textContent = 'Kon de ranglijst niet laden.'; return; }
          var m = {};
          (r.data || []).forEach(function (a) { if (a.item_key === 'seed_version') return; var k = a.user_name || a.user_email || 'onbekend'; if (!m[k]) m[k] = { total: 0, ads: 0 }; m[k].total++; if (a.item_key === 'library_v2') m[k].ads++; });
          var arr = Object.keys(m).map(function (k) { return { name: k, total: m[k].total, ads: m[k].ads }; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 5);
          if (!arr.length) { lbEl.textContent = 'Nog geen activiteit vastgelegd.'; return; }
          var max = arr[0].total || 1;
          lbEl.classList.remove('dash-empty');
          lbEl.innerHTML = arr.map(function (p, i) { return '<div class="dash-rank"><span class="dash-rank-n">' + (i + 1) + '</span><div class="dash-rank-main"><div class="dash-rank-name">' + esc(p.name) + '</div><div class="dash-rank-bar"><div style="width:' + Math.round(p.total / max * 100) + '%"></div></div></div><span class="dash-rank-c">' + p.total + ' acties · ' + p.ads + ' ads</span></div>'; }).join('');
        });
      } catch (e) { lbEl.textContent = 'Kon de ranglijst niet laden.'; }
    })();
    (function () {
      var sEl = host.querySelector('#dash-lb-succes'); if (!sEl) return;
      if (!window._sb) { sEl.textContent = 'Beschikbaar zodra je bent ingelogd op de live tool.'; return; }
      try {
        window._sb.from('ad_results').select('user_email,user_name,roas').limit(3000).then(function (r) {
          if (!r || r.error) { sEl.textContent = 'Nog geen advertentiecijfers vastgelegd.'; return; }
          var m = {};
          (r.data || []).forEach(function (a) { var v = parseFloat(a.roas); if (isNaN(v)) return; var k = a.user_name || a.user_email || 'onbekend'; if (!m[k]) m[k] = { sum: 0, n: 0 }; m[k].sum += v; m[k].n++; });
          var arr = Object.keys(m).map(function (k) { return { name: k, avg: m[k].sum / m[k].n, n: m[k].n }; }).sort(function (a, b) { return b.avg - a.avg; }).slice(0, 5);
          if (!arr.length) { sEl.textContent = 'Nog geen advertentiecijfers vastgelegd. Vul ze in bij Itereren en sla op.'; return; }
          var max = arr[0].avg || 1;
          sEl.classList.remove('dash-empty');
          sEl.innerHTML = arr.map(function (p, i) { return '<div class="dash-rank"><span class="dash-rank-n">' + (i + 1) + '</span><div class="dash-rank-main"><div class="dash-rank-name">' + esc(p.name) + '</div><div class="dash-rank-bar"><div style="width:' + Math.round(p.avg / max * 100) + '%"></div></div></div><span class="dash-rank-c">gem. ROAS ' + p.avg.toFixed(2) + ' · ' + p.n + ' ads</span></div>'; }).join('');
        });
      } catch (e) { sEl.textContent = 'Kon de ranglijst niet laden.'; }
    })();
  }

  /* De cockpit vervangt de vorige dashboard-render volledig. De oudere
     tabwissel-wrapper roept zijn eigen closure-lokale renderer aan, dus
     we haken ook op de tabwissel in zodat de cockpit als laatste wint. */
  window._ws7RenderCockpit = renderCockpit;
  window.wgRenderDashboard = renderCockpit;
  if (typeof window.switchMainTab === 'function' && !window._wgV7Wrapped) {
    window._wgV7Wrapped = true;
    var prevSwitch = window.switchMainTab;
    window.switchMainTab = function (tab) {
      prevSwitch.apply(this, arguments);
      if (tab === 'dashboard') { try { renderCockpit(); } catch (e) {} }
    };
  }
  try { var dv = document.getElementById('main-tab-dashboard'); if (dv && dv.style.display !== 'none') renderCockpit(); } catch (e) {}
})();
