// ============================================================
// INIT
// ============================================================
// Global error catcher (zichtbaar voor debug)
window.addEventListener('error', (e) => {
  console.error('Caught error:', e);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:#f5e5e5;border:2px solid #ff6b6b;color:#bd0f0f;padding:14px 18px;border-radius:8px;font-family:monospace;font-size:12px;z-index:99999;max-height:40vh;overflow:auto;white-space:pre-wrap;line-height:1.5;';
  banner.innerHTML = `<strong>JS Error gedetecteerd</strong><br><br>Bericht: ${e.message}<br>Bestand: ${e.filename}<br>Regel: ${e.lineno}:${e.colno}<br><br>Stack:<br>${(e.error && e.error.stack) || '(geen stack)'}<br><br><button onclick="this.parentNode.remove()" style="padding:6px 12px;background:#ff6b6b;color:#141414;border:none;border-radius:4px;cursor:pointer;">Sluit</button>`;
  document.body.appendChild(banner);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Caught promise rejection:', e);
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:#f5e5e5;border:2px solid #ff6b6b;color:#bd0f0f;padding:14px 18px;border-radius:8px;font-family:monospace;font-size:12px;z-index:99999;max-height:40vh;overflow:auto;white-space:pre-wrap;line-height:1.5;';
  banner.innerHTML = `<strong>Unhandled promise rejection</strong><br><br>${e.reason && e.reason.stack ? e.reason.stack : e.reason}<br><br><button onclick="this.parentNode.remove()" style="padding:6px 12px;background:#ff6b6b;color:#141414;border:none;border-radius:4px;cursor:pointer;">Sluit</button>`;
  document.body.appendChild(banner);
});

// Init met try/catch per stap, zodat een falende stap de rest niet blokkeert
const initSteps = [
  ['loadState', loadState],
  ['renderProductSelect', renderProductSelect],
  ['renderPersonaSelect', renderPersonaSelect],
  ['renderBundleBuilder', renderBundleBuilder],
  ['renderLibrary', renderLibrary],
  ['checkWarnings', checkWarnings],
  ['checkProxyStatus', checkProxyStatus],
  ['setupSourceAdDragDrop', setupSourceAdDragDrop],
  ['renderIterateFields', renderIterateFields],
  ['updateChangelogToggleMeta', updateChangelogToggleMeta]
];
for (const [name, fn] of initSteps) {
  try {
    fn();
  } catch (err) {
    console.error(`Init step "${name}" failed:`, err);
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:#f6f1e1;border:2px solid #f7d37b;color:#a37614;padding:14px 18px;border-radius:8px;font-family:monospace;font-size:12px;z-index:99999;max-height:40vh;overflow:auto;white-space:pre-wrap;line-height:1.5;';
    banner.innerHTML = `<strong>Init-stap "${name}" gefaald</strong><br><br>${err.message}<br><br>${err.stack || '(geen stack)'}<br><br><button onclick="this.parentNode.remove()" style="padding:6px 12px;background:#f7d37b;color:#000000;border:none;border-radius:4px;cursor:pointer;">Sluit</button>`;
    document.body.appendChild(banner);
  }
}

// State-diagnose toon na init (kortstondig, 6 seconden)
setTimeout(() => {
  const productCount = (state.products || []).length;
  const personaCount = (state.personas || []).length;
  const libraryCount = (state.library || []).length;
  const productNames = (state.products || []).slice(0, 5).map(p => p && p.name ? p.name : '?').join(', ');
  const diag = document.createElement('div');
  diag.style.cssText = 'position:fixed;bottom:14px;left:266px;background:rgba(84, 72, 48, 0.468);border:1px solid #eaeae8;color:#2e2e2e;padding:10px 14px;border-radius:8px;font-family:monospace;font-size:11px;z-index:99998;max-width:380px;line-height:1.5;';
  diag.innerHTML = `<strong style="color:#1f1f1f">DEBUG state na init</strong><br>Producten: ${productCount} (${escapeHtml(productNames)})<br>Personas: ${personaCount}<br>Library: ${libraryCount}<br><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;"><button onclick="resetAllLocalStorage()" style="padding:5px 10px;background:#ff6b6b;color:#141414;border:none;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;">Reset alle localStorage</button><button onclick="this.parentNode.parentNode.remove()" style="padding:5px 10px;background:#d2d1cf;color:#141414;border:none;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px;">Sluit</button></div>`;
  /* debug overlay uit (v4.61) */ void 0;
  setTimeout(() => { if (diag.parentNode) diag.remove(); }, 10000);
}, 300);

function resetAllLocalStorage() {
  if (!confirm('Weet je het zeker? Dit verwijdert ALLE Wellshave generator data uit localStorage (producten, personas, library, API keys). Daarna moet je opnieuw inloggen en je producten weer importeren.')) return;
  const keys = Object.keys(localStorage).filter(k => (k.startsWith('ws_')||k.startsWith('wsh_')||k.startsWith('shared_')||k.startsWith('mb_')));
  keys.forEach(k => localStorage.removeItem(k));
  alert(`${keys.length} keys gewist. Pagina wordt nu herladen.`);
  location.reload();
}

// Persona-preview updaten bij wisselen van persona
const personaSelectEl = document.getElementById('persona-select');
if (personaSelectEl) {
  personaSelectEl.addEventListener('change', onPersonaChange);
}

try{ applyBrandChrome(); }catch(e){ console.error(e); }
function initTileExplains(){
  [['archetype','.archetype-grid','.archetype-title','.archetype-desc'],['mode','.mode-grid','.mode-title','.mode-desc']].forEach(function(cfg){
    var name=cfg[0], grid=document.querySelector(cfg[1]);
    if(!grid) return;
    if(!document.getElementById(name+'-explain')) grid.insertAdjacentHTML('afterend','<div class="tile-explain" id="'+name+'-explain"></div>');
    function upd(){
      var inp=document.querySelector('input[name='+name+']:checked'); if(!inp) return;
      var body=inp.nextElementSibling; if(!body) return;
      var titleEl=body.querySelector(cfg[2]); var descEl=body.querySelector(cfg[3]);
      var title=titleEl&&titleEl.childNodes.length?titleEl.childNodes[0].textContent.trim():inp.value;
      var desc=descEl?descEl.textContent.trim():'';
      var box=document.getElementById(name+'-explain'); if(!box) return;
      box.innerHTML='<b>'+title+'</b>'+(desc?(' \u00b7 '+desc):'');
      var link=titleEl?titleEl.querySelector('.example-link'):null;
      if(link){ var a=link.cloneNode(true); a.textContent='bekijk voorbeeld'; box.appendChild(document.createTextNode(' ')); box.appendChild(a); }
    }
    document.querySelectorAll('input[name='+name+']').forEach(function(i){ i.addEventListener('change', upd); });
    upd();
  });
}
try{ initTileExplains(); }catch(e){ console.error(e); }
