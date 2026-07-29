(function(){
  var css = document.createElement('style');
  css.textContent = '.variation-card:not(.vc-open) .vc-heavy{display:none !important;}' +
    '.vc-toggle{display:block;width:100%;text-align:left;background:none;border:none;border-top:1px solid var(--hairline, rgba(26, 22, 14, 0.081));padding:10px 0;margin:6px 0;color:var(--text-dim, #36332a);font-family:var(--ui-mono, monospace);font-size:10.5px;letter-spacing:0.12em;text-transform:uppercase;cursor:pointer;}' +
    '.vc-toggle:hover{color:var(--gold, #624c1b);}';
  document.head.appendChild(css);

  function compactCards(){
    document.querySelectorAll('.variation-card').forEach(function(card){
      if (card.dataset.vcInit) return;
      var heavy = [];
      card.querySelectorAll(':scope > .var-row').forEach(function(row){
        var fn = row.querySelector('.field-name');
        if (!fn) return;
        var t = (fn.textContent || '').trim().toLowerCase();
        if (t === 'visual' || t.indexOf('chatgpt') === 0 || t.indexOf('rory') === 0) heavy.push(row);
      });
      var og = card.querySelector(':scope > .ogilvy-row');
      var ogr = card.querySelector(':scope > .ogilvy-result');
      if (og) heavy.push(og);
      if (ogr) heavy.push(ogr);
      if (!heavy.length) return;
      card.dataset.vcInit = '1';
      heavy.forEach(function(el){ el.classList.add('vc-heavy'); });
      var btn = document.createElement('button');
      btn.className = 'vc-toggle';
      btn.type = 'button';
      btn.textContent = 'Concept-details (visual · prompt · reasoning · Meta copy) ▾';
      btn.addEventListener('click', function(){
        var open = card.classList.toggle('vc-open');
        btn.textContent = open ? 'Concept-details verbergen ▴' : 'Concept-details (visual · prompt · reasoning · Meta copy) ▾';
      });
      heavy[0].parentNode.insertBefore(btn, heavy[0]);
    });
  }
  var mo = new MutationObserver(function(muts){
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].addedNodes && muts[i].addedNodes.length) { compactCards(); return; }
    }
  });
  function start(){
    compactCards();
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
