// ============================================================
// SETTINGS
// ============================================================
function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('open');
}
function toggleProxyHelp() {
  document.querySelector('.proxy-help').classList.toggle('open');
}
async function copyProxyCmd(elId, btn) {
  const text = document.getElementById(elId).textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    // Fallback voor oudere browsers of file:// context
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }
  const original = btn.textContent;
  btn.textContent = 'Gekopieerd';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('copied');
  }, 1800);
}
['anthropic-key', 'anthropic-model', 'openai-key', 'openai-proxy', 'openai-model', 'openai-quality'].forEach(id => {
  document.getElementById(id).addEventListener('input', (e) => {
    const map = {
      'anthropic-key': 'shared_anthropic_key',
      'anthropic-model': 'shared_anthropic_model',
      'openai-key': 'shared_openai_key',
      'openai-proxy': 'shared_openai_proxy',
      'openai-model': 'shared_openai_model',
      'openai-quality': 'shared_openai_quality'
    };
    localStorage.setItem(map[id], e.target.value);
    updateApiStatus();
  });
});

const VAULT_PASSWORD = 'WellgroupADS';
const VAULT_KEYS = { openai: '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', anthropic: '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' };
function toggleVaultPw(btn){
  const i = document.getElementById('vault-pw'); if (!i) return;
  const show = i.type === 'password';
  i.type = show ? 'text' : 'password';
  if (btn) btn.classList.toggle('on', show);
  i.focus();
}
function unlockVault(){
  const pw = (document.getElementById('vault-pw').value || '');
  if (pw !== VAULT_PASSWORD) { toast('Onjuist wachtwoord', true); return; }
  document.getElementById('vault-openai').textContent = VAULT_KEYS.openai;
  document.getElementById('vault-anthropic').textContent = VAULT_KEYS.anthropic;
  document.getElementById('vault-locked').style.display = 'none';
  document.getElementById('vault-open').style.display = 'block';
  document.getElementById('vault-pw').value = '';
}
function lockVault(){
  document.getElementById('vault-open').style.display = 'none';
  document.getElementById('vault-locked').style.display = 'block';
  document.getElementById('vault-openai').textContent = '';
  document.getElementById('vault-anthropic').textContent = '';
}
function copyVaultKey(which, btn){
  navigator.clipboard.writeText(VAULT_KEYS[which]);
  if (btn){ const o = btn.textContent; btn.textContent = 'Gekopieerd'; setTimeout(function(){ btn.textContent = o; }, 1500); }
}
function useVaultKeys(){
  [['anthropic-key', VAULT_KEYS.anthropic], ['openai-key', VAULT_KEYS.openai]].forEach(function(pair){
    const el = document.getElementById(pair[0]);
    if (el){ el.value = pair[1]; el.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  toast('API-keys ingevuld en bewaard');
}

function updateApiStatus() {
  // Teamserver-modus: de sleutels staan op de proxy (Cloudflare Worker), niet in
  // de browser. Dit stond hier als tweede exemplaar van dezelfde test, met een
  // eigen kopie van de voorwaarde -- en die liep uit de pas zodra de eerste
  // veranderde. Eén waarheid, in js/01.
  var _teamServer = !!window.__WG_TEAMSERVER;
  if (_teamServer) {
    var _aS = document.getElementById('anthropic-status'), _aT = document.getElementById('anthropic-status-text');
    var _oS = document.getElementById('openai-status'), _oT = document.getElementById('openai-status-text');
    if (_aS) { _aS.classList.add('active'); _aS.classList.remove('warning'); }
    if (_aT) _aT.textContent = 'Anthropic via teamserver';
    if (_oS) { _oS.classList.add('active'); _oS.classList.remove('warning'); }
    if (_oT) _oT.textContent = 'OpenAI via teamserver';
    return;
  }
  const aKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  const oKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());

  const aDot = document.getElementById('anthropic-status');
  const aText = document.getElementById('anthropic-status-text');
  if (aKey && aKey.startsWith('sk-ant-')) {
    aDot.classList.add('active');
    aDot.classList.remove('warning');
    aText.textContent = 'Anthropic verbonden';
  } else {
    aDot.classList.remove('active', 'warning');
    aText.textContent = 'Anthropic niet ingesteld';
  }

  const oDot = document.getElementById('openai-status');
  const oText = document.getElementById('openai-status-text');
  if (oKey && (oKey.startsWith('sk-') || oKey.startsWith('sk-proj-'))) {
    oDot.classList.add('active');
    oDot.classList.remove('warning');
    oText.textContent = 'OpenAI verbonden';
  } else {
    oDot.classList.remove('active', 'warning');
    oText.textContent = 'OpenAI niet ingesteld';
  }
}

// ============================================================
// RETRY HELPER & PROXY STATUS
// ============================================================
/* Gaat deze call naar de teamserver, en moet de login er dus bij?
 *
 * Dit stond als één test op de hostnaam: begint de url met
 * https://marketing-ads., dan hoort de Authorization-header erbij. Dat klopte
 * zolang er maar één omgeving was.
 *
 * Sinds er een tweede omgeving is, lopen de calls daar over de eigen origin
 * (zie _redirects). De url is dan https://<die-site>/anthropic, de test faalde
 * stil, en de worker kreeg een verzoek zonder token terug — 401, en dus geen
 * generatie en geen sparren. De fout zat niet in de proxy maar hier: een
 * hostnaam als voorwaarde voor "dit is onze server" houdt maar één huis over.
 *
 * Daarom nu twee vragen: gaat het naar de worker zelf, of naar een van de paden
 * die door de eigen origin naar de worker worden doorgezet. Dat laatste is
 * begrensd tot precies die paden — anders zou elke fetch naar de eigen site het
 * teamtoken meesturen, en dat is een sleutel die je niet uitdeelt aan een
 * plaatje.
 */
var _WORKER_PADEN = /^\/(anthropic|v1\/|openai\/|systeem\/|health)/;

function _naarDeWorker(url) {
  var u = String(url || '');
  if (/^https:\/\/marketing-ads\./i.test(u)) return true;
  try {
    var abs = new URL(u, location.href);
    var basis = new URL(PROXY_BASE, location.href);
    return abs.origin === basis.origin && _WORKER_PADEN.test(abs.pathname);
  } catch (e) {
    return false;
  }
}

async function fetchJsonWithRetry(url, options, maxRetries = 2, delayMs = 3000) {
  /* [MARKETING-ADS] de worker vereist een team-login (Supabase-token van een
     goedgekeurd lid). Zet/overschrijf de Authorization-header voor alle calls
     naar de worker — ook beeld-calls (de OpenAI-key staat server-side). */
  try {
    if (_naarDeWorker(url)) {
      options = options || {};
      if (options.headers instanceof Headers) {
        if (window.__WG_TOKEN) options.headers.set('Authorization', 'Bearer ' + window.__WG_TOKEN);
      } else {
        options.headers = Object.assign({}, options.headers || {});
        if (window.__WG_TOKEN) options.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
      }
    }
  } catch (e) {}
  /* Gaat deze call over de eigen origin naar de worker, of rechtstreeks? Dat
     verschil bepaalt hoeveel tijd hij krijgt, en dus hoeveel denkwerk erin past. */
  var _viaTussenstap = _naarDeWorker(url) && !/^https:\/\/marketing-ads\./i.test(String(url));

  /* [FABLE 5] adaptief denken verbruikt output-tokens; til de max_tokens-cap op
     zodat structured JSON niet halverwege afkapt (onparseerbaar antwoord). */
  try {
    if (/\/anthropic(\b|\?|$)/.test(String(url)) && options && typeof options.body === 'string') {
      var _bpp = JSON.parse(options.body);
      if (_bpp && typeof _bpp === 'object' && _bpp.messages) {
        var _need = (typeof _bpp.max_tokens === 'number') ? _bpp.max_tokens : 1024;
        var _chg = false;
        if (_need < 16000) { _bpp.max_tokens = 16000; _chg = true; }
        /* [FABLE 5 EFFORT] Zware generaties op vol denk-vermogen duren >100s en geven
           een Cloudflare 524. Begrens het denken op zware calls (>=6000 tokens gevraagd)
           tot 'low' zodat ze ruim onder de 100s blijven. Kleine strategische calls
           (interview, spar, kleine JSON) laten we op adaptief voor de kwaliteit. */
        /* Achter de eigen origin ligt de grens veel lager. De worker mag van
           Cloudflare tegen de honderd seconden aan; de tussenstap die daar
           doorheen zet kapt af rond de dertig, en dan krijg je een 504 op een
           call die het gewoon nog aan het doen was. Op die route wordt dus élke
           call begrensd, niet alleen de zware — anders is het verschil tussen
           "duurt lang" en "stuk" niet te zien.

           Dit verdwijnt zodra de worker de tweede omgeving in zijn CORS-lijst
           heeft: dan gaan de calls daar rechtstreeks en geldt de ruime grens
           weer. */
        if (_need >= 6000 || _viaTussenstap) {
          if (!_bpp.thinking) _bpp.thinking = { type: 'adaptive' };
          if (!_bpp.output_config || typeof _bpp.output_config !== 'object') _bpp.output_config = {};
          if (typeof _bpp.output_config.effort === 'undefined') _bpp.output_config.effort = 'low';
          _chg = true;
        }
        if (_chg) options.body = JSON.stringify(_bpp);
      }
    }
  } catch (e) {}
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        try {
          if (data && Array.isArray(data.content) && data.content.length && data.content[0] && data.content[0].type !== 'text') {
            var _txt = data.content.filter(function (c) { return c && c.type === 'text' && typeof c.text === 'string'; });
            if (_txt.length) data.content = _txt.concat(data.content.filter(function (c) { return !(c && c.type === 'text'); }));
          }
        } catch (e) {}
        return data;
      }

      /* Een 502/504 zegt alleen dát er iets afkapte, niet wát. En dat is precies
         de vraag: kapte de tussenstap op de eigen origin af (rond 30 seconden),
         of hield Cloudflare de worker tegen (rond 100)? Dat zijn twee heel
         verschillende problemen met twee verschillende oplossingen, en zonder
         de route erbij is er geen manier om ze uit elkaar te houden — dan sta
         je te raden welke van de twee je aan het oplossen bent. */
      var _afgekapt = (response.status === 504 || response.status === 502 || response.status === 524);
      const msg = (data.error && data.error.message)
        || (_afgekapt
            ? (_viaTussenstap
                ? 'De tussenstap op deze omgeving kapte af (rond 30 seconden) terwijl de server nog bezig was. '
                  + 'Deze omgeving hoort rechtstreeks met de worker te praten — ververs de pagina hard (Cmd+Shift+R); '
                  + 'blijft dit staan, dan mist deze host in de lijst van de worker.'
                : 'De verbinding met de worker kapte af na ongeveer honderd seconden (' + response.status + '), '
                  + 'terwijl het model nog aan het nadenken was. Dit is een te zware generatie, geen storing.')
            : `API fout (status ${response.status})`);
      const lower = msg.toLowerCase();
      const retryable = (response.status >= 500 && response.status < 600) ||
                        response.status === 429 ||
                        response.status === 529 ||
                        lower.includes('overload') ||
                        lower.includes('temporarily unavailable') ||
                        lower.includes('rate limit');

      if (retryable && attempt < maxRetries) {
        console.warn(`[retry ${attempt + 1}/${maxRetries}] HTTP ${response.status}: ${msg}`);
        lastErr = new Error(msg);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }

      const err = new Error(msg);
      err.status = response.status;
      err.data = data;
      throw err;
    } catch (err) {
      // Network-level errors (proxy down, DNS, CORS, etc) are sometimes transient
      const isNetwork = err.message === 'Failed to fetch' ||
                        (err.message && err.message.includes('NetworkError'));
      if (isNetwork && attempt < maxRetries) {
        console.warn(`[retry ${attempt + 1}/${maxRetries}] network: ${err.message}`);
        lastErr = err;
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Retry-pogingen uitgeput');
}

let proxyCheckInFlight = false;
async function checkProxyStatus() {
  if (proxyCheckInFlight) return;
  proxyCheckInFlight = true;
  const dot = document.getElementById('proxy-status');
  const text = document.getElementById('proxy-status-text');
  if (!dot || !text) { proxyCheckInFlight = false; return; }

  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  // Detect mixed-content scenario: HTTPS page cannot fetch HTTP localhost
  const pageIsHttps = location.protocol === 'https:';
  const proxyIsHttp = /^http:\/\//i.test(proxyUrl);
  const proxyIsLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(proxyUrl);

  if (pageIsHttps && proxyIsHttp && proxyIsLocalhost) {
    dot.classList.remove('checking', 'active', 'error');
    text.textContent = 'Proxy alleen lokaal bereikbaar, open bestand vanaf disk';
    text.title = 'Browser-security (mixed content) blokkeert HTTP-localhost vanuit deze HTTPS-context. Open de HTML lokaal voor image-generation.';
    proxyCheckInFlight = false;
    return;
  }

  dot.classList.remove('active', 'error');
  dot.classList.add('checking');
  text.textContent = 'Proxy checken...';
  text.title = '';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(proxyUrl + '/', { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    // Any response means the server is running, even 404
    dot.classList.remove('checking', 'error');
    dot.classList.add('active');
    text.textContent = 'Proxy actief';
  } catch (err) {
    dot.classList.remove('checking', 'active');
    dot.classList.add('error');
    text.textContent = 'Proxy offline';
  } finally {
    proxyCheckInFlight = false;
  }
}

// Re-check proxy when user changes the proxy URL in settings
const proxyUrlInput = document.getElementById('openai-proxy');
if (proxyUrlInput) {
  let proxyDebounce;
  proxyUrlInput.addEventListener('input', () => {
    clearTimeout(proxyDebounce);
    proxyDebounce = setTimeout(checkProxyStatus, 500);
  });
}

// Periodic re-check every 30 seconds in case proxy was started/stopped
setInterval(checkProxyStatus, 30000);

