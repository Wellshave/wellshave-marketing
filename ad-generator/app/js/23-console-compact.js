(function(){
  function initCompact(){
    try {
      document.querySelectorAll('#main-tab-generator .form-section').forEach(function(sec){
        var num = sec.querySelector('.form-section-num');
        if (!num) return;
        var n = (num.textContent || '').trim();
        if (n === '2' || n === '3') {
          sec.classList.add('fs-collapsible');
          if (!sec.dataset.fsInit) {
            sec.dataset.fsInit = '1';
            sec.classList.add('fs-collapsed');
            var head = sec.querySelector('.form-section-head');
            if (head) head.addEventListener('click', function(){ sec.classList.toggle('fs-collapsed'); });
          }
        }
      });
      var co = document.getElementById('copy-options');
      if (co && !co.dataset.fsInit) {
        co.dataset.fsInit = '1';
        co.classList.add('fs-collapsed');
        var t = co.querySelector('.copy-options-title');
        if (t) t.addEventListener('click', function(){ co.classList.toggle('fs-collapsed'); });
      }
    } catch(e) { console.warn('compact init', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCompact);
  else initCompact();
})();
