/* Team-server init: niemand hoeft nog API-keys of een proxy in te vullen. */
(function(){
  try {
    var ak = document.getElementById('anthropic-key'); if (ak && !ak.value.trim()) ak.value = 'via-team-server';
    var ok = document.getElementById('openai-key'); if (ok && !ok.value.trim()) ok.value = 'via-team-server';
    var px = document.getElementById('openai-proxy'); if (px) px.value = 'https://wellgroup-team-proxy.dustin-9ff.workers.dev';
    ['anthropic-key','openai-key','openai-proxy'].forEach(function(id){ var el = document.getElementById(id); if (el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } });
    if (typeof checkProxyStatus === 'function') setTimeout(function(){ try { checkProxyStatus(); } catch(e){} }, 500);
  } catch (e) { console.warn('team-server init', e); }
})();
