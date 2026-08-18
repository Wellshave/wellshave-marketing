(function () {
  'use strict';
  var LBL = { headline: 'Headline', body: 'Body copy', cta: 'CTA' };

  function rowField(row) {
    var n = row.querySelector('.field-name');
    var t = n ? n.textContent.toLowerCase() : '';
    if (/headline/.test(t)) return 'headline';
    if (/body/.test(t)) return 'body';
    if (/^\s*cta/.test(t)) return 'cta';
    if (/visual/.test(t)) return 'visual';
    if (/prompt/.test(t)) return 'prompt';
    if (/hypothese/.test(t)) return 'hypothese';
    if (/reasoning/.test(t)) return 'reasoning';
    return '';
  }
  function autosize(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
  }
  function fold(title, cls, count) {
    var f = document.createElement('div');
    f.className = 'rv-fold ' + (cls || '');
    f.innerHTML = '<div class="rv-fold-head" tabindex="0" role="button" aria-expanded="false">' + title
      + (count ? '<span class="rv-count">' + count + '</span>' : '') + '<span class="rv-chev">▾</span></div>'
      + '<div class="rv-fold-body"></div>';
    var head = f.querySelector('.rv-fold-head');
    function toggle() { var o = f.classList.toggle('open'); head.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    return f;
  }

  function decorate(card) {
    if (!card || card.dataset.rv) return;
    card.dataset.rv = '1';
    /* oudere inklap-knop opruimen; deze laag neemt die rol over */
    var legacy = card.querySelector('.vc-toggle'); if (legacy) legacy.remove();

    var head = card.querySelector('.var-head');
    var headline = card.querySelector('.var-headline');
    var rows = Array.prototype.slice.call(card.querySelectorAll('.var-row'));
    if (!headline || !rows.length) return;

    var byField = {};
    rows.forEach(function (r) { var f = rowField(r); if (f && !byField[f]) byField[f] = r; });

    /* 1. concept */
    var concept = document.createElement('div');
    concept.className = 'rv-concept';
    concept.appendChild(headline);
    /* de headline-invoer hoort bij het concept, maar blijft verborgen tot bewerken */
    if (byField.headline) {
      var hb = document.createElement('div');
      hb.className = 'rv-block'; hb.setAttribute('data-f', 'headline');
      hb.style.display = 'none';
      hb.appendChild(byField.headline);
      concept.appendChild(hb);
    }

    /* 2. copy */
    var copy = document.createElement('div');
    copy.className = 'rv-copy';
    ['body', 'cta'].forEach(function (f) {
      var row = byField[f]; if (!row) return;
      var b = document.createElement('div');
      b.className = 'rv-block'; b.setAttribute('data-f', f);
      var lbl = document.createElement('div'); lbl.className = 'rv-lbl'; lbl.textContent = LBL[f];
      b.appendChild(lbl);
      var cp = row.querySelector('.copy-btn');
      b.appendChild(row);
      if (cp) b.appendChild(cp);
      var input = row.querySelector('.inline-edit-input, .inline-edit-textarea');
      if (input && !String(input.value || '').trim()) b.classList.add('rv-empty');
      copy.appendChild(b);
    });

    /* 3. details */
    var details = fold('Details', 'details');
    var dBody = details.querySelector('.rv-fold-body');
    ['visual', 'prompt'].forEach(function (f) {
      var row = byField[f]; if (!row) return;
      var l = document.createElement('div'); l.className = 'rv-fold-lbl';
      l.textContent = f === 'visual' ? 'Visual' : 'ChatGPT prompt';
      dBody.appendChild(l); dBody.appendChild(row);
    });

    /* 4. AI-reasoning */
    var hasReason = byField.hypothese || byField.reasoning;
    var reason = fold('Waarom deze variatie werkt', 'reasoning');
    var rBody = reason.querySelector('.rv-fold-body');
    ['hypothese', 'reasoning'].forEach(function (f) {
      var row = byField[f]; if (!row) return;
      var l = document.createElement('div'); l.className = 'rv-fold-lbl';
      l.textContent = f === 'hypothese' ? 'Hypothese' : 'Rory’s reasoning';
      rBody.appendChild(l);
      var val = row.querySelector('.field-value');
      rBody.appendChild(val || row);
    });

    /* knoppenbalk */
    var bar = document.createElement('div');
    bar.className = 'rv-bar';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'rv-edit-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Tekst bewerken</span>';
    var hint = document.createElement('span');
    hint.className = 'rv-edit-hint'; hint.textContent = 'Beoordeel eerst; pas aan als er iets moet wijzigen.';
    bar.appendChild(btn); bar.appendChild(hint);

    /* opbouw in vaste volgorde, bestaande secties blijven staan */
    var anchor = card.querySelector('.ogilvy-row') || card.querySelector('.gen-image-section');
    function place(node) { if (anchor) card.insertBefore(node, anchor); else card.appendChild(node); }
    place(concept); place(copy); place(bar);
    place(details);
    if (hasReason) place(reason);
    if (!dBody.children.length) details.remove();

    /* leesmodus: alles readonly, tekstvelden op inhoudshoogte */
    var fields = card.querySelectorAll('.rv-block .inline-edit-input, .rv-block .inline-edit-textarea');
    function setRead(on) {
      fields.forEach(function (el) {
        if (on) el.setAttribute('readonly', 'readonly'); else el.removeAttribute('readonly');
        autosize(el);
      });
    }
    setRead(true);
    fields.forEach(function (el) { el.addEventListener('input', function () { autosize(el); }); });

    btn.addEventListener('click', function () {
      var editing = card.classList.toggle('rv-editing');
      setRead(!editing);
      var hb2 = card.querySelector('.rv-block[data-f="headline"]');
      if (hb2) hb2.style.display = editing ? 'block' : 'none';
      btn.querySelector('span').textContent = editing ? 'Klaar met bewerken' : 'Tekst bewerken';
      hint.textContent = editing ? 'Wijzigingen gaan direct mee in het beeld en bij bewaren.' : 'Beoordeel eerst; pas aan als er iets moet wijzigen.';
      if (editing) {
        var first = card.querySelector('.rv-block[data-f="headline"] .inline-edit-input');
        if (first) { first.focus(); first.select(); }
      }
      /* hoogte pas berekenen als de padding-overgang klaar is */
      requestAnimationFrame(function () { fields.forEach(autosize); });
      setTimeout(function () { fields.forEach(autosize); }, 220);
    });

    /* headline-preview blijft live meelopen met het invoerveld */
    var hIn = card.querySelector('.rv-block[data-f="headline"] .inline-edit-input');
    if (hIn) hIn.addEventListener('input', function () {
      headline.textContent = hIn.value || '(geen headline)';
    });
    setTimeout(function () { fields.forEach(autosize); }, 60);
  }

  function scan() {
    document.querySelectorAll('.variation-card').forEach(decorate);
    /* de werkruimte geeft de review ruimte zodra er output staat */
    var res = document.getElementById('results');
    var grid = document.querySelector('.ws8-grid');
    if (res && grid) grid.classList.toggle('rv-output', res.childElementCount > 0);
  }
  try {
    new MutationObserver(function () { scan(); }).observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
  scan();
})();
