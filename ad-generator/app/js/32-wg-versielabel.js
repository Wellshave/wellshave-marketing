/* Het versielabel in de zijbalk stond hardcoded en liep achter op de
   changelog. Het leest nu de bovenste changelog-versie, zodat het
   automatisch klopt bij elke volgende release. */
(function () {
  'use strict';
  function apply() {
    var el = document.getElementById('ws-version-label');
    if (!el) return false;
    var v = '';
    try { if (typeof CHANGELOG !== 'undefined' && CHANGELOG[0]) v = CHANGELOG[0].version; } catch (e) {}
    if (!v) return false;
    el.textContent = 'ATELIER CONSOLE · WELLGROUP V' + v;
    return true;
  }
  if (!apply()) {
    var n = 0, iv = setInterval(function () { n++; if (apply() || n > 20) clearInterval(iv); }, 200);
  }
})();
