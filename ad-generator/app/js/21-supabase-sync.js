/* ============================================================
 * FASE 2 , online opslag + live sync via Supabase.
 * Alle data-sleutels (producten, personas, bibliotheek, scripts,
 * merkprofiel) worden centraal opgeslagen en gesynchroniseerd.
 * De browser houdt een lokale werkkopie; de cloud is de bron.
 * ============================================================ */
(function(){
  try {
    if (!window.supabase || typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_KEY === 'undefined') {
      console.warn('Supabase niet geladen, app draait lokaal'); return;
    }
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,      // sessie bewaren in de browser
        autoRefreshToken: true,    // token automatisch verversen, dus je blijft ingelogd
        storage: window.localStorage,
        storageKey: 'wellgroup-auth',
        detectSessionInUrl: true
      }
    });
    window._sb = sb;
    var BRAND = (typeof ACTIVE_BRAND !== 'undefined') ? ACTIVE_BRAND : 'wellshave';
    var PREFIX = (BRAND === 'wellshine') ? 'wsh_' : 'ws_';
    var SYNC_KEYS = ['products_v2','personas_v1','library_v2','script_library_v1','brand_profile_v1','seed_version'];
    var clientId = (function(){ try { var c = localStorage.getItem('cloud_client_id'); if (!c) { c = Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem('cloud_client_id', c); } return c; } catch(e){ return 'c' + Date.now(); } })();
    var pendingKeys = {}; // sleutels met een lokale wijziging die nog niet bevestigd in de cloud staat; deze mogen NIET door hydrate worden overschreven
    var _origSet = localStorage.setItem.bind(localStorage);
    var _origRemove = localStorage.removeItem.bind(localStorage);
    var applying = false;

    // ===== Zware data (foto-blobs) in IndexedDB i.p.v. localStorage (ruime opslag, honderden MB) =====
    var HEAVY_KEYS = ['products_v2','library_v2','script_library_v1'];
    var bigCache = {};   // PREFIX+key -> stringwaarde, in het geheugen
    var _origGet = localStorage.getItem.bind(localStorage);
    function isHeavy(prefixedKey){ if (typeof prefixedKey !== 'string' || prefixedKey.indexOf(PREFIX) !== 0) return null; var k = prefixedKey.slice(PREFIX.length); return HEAVY_KEYS.indexOf(k) !== -1 ? k : null; }
    var IDB_NAME='wellgroup_store', IDB_STORE='kv', _idbP=null;
    function idbOpen(){ if(_idbP) return _idbP; _idbP=new Promise(function(res,rej){ try{ var rq=indexedDB.open(IDB_NAME,1); rq.onupgradeneeded=function(){ try{ rq.result.createObjectStore(IDB_STORE); }catch(e){} }; rq.onsuccess=function(){ res(rq.result); }; rq.onerror=function(){ rej(rq.error); }; }catch(e){ rej(e); } }); return _idbP; }
    function idbSet(key,val){ return idbOpen().then(function(db){ return new Promise(function(res,rej){ var t=db.transaction(IDB_STORE,'readwrite'); t.objectStore(IDB_STORE).put(val,key); t.oncomplete=function(){res();}; t.onerror=function(){rej(t.error);}; }); }); }
    function idbGet(key){ return idbOpen().then(function(db){ return new Promise(function(res,rej){ var t=db.transaction(IDB_STORE,'readonly'); var rq=t.objectStore(IDB_STORE).get(key); rq.onsuccess=function(){res(rq.result);}; rq.onerror=function(){rej(rq.error);}; }); }); }
    function idbDel(key){ return idbOpen().then(function(db){ return new Promise(function(res,rej){ var t=db.transaction(IDB_STORE,'readwrite'); t.objectStore(IDB_STORE).delete(key); t.oncomplete=function(){res();}; t.onerror=function(){rej(t.error);}; }); }); }
    // getItem-override: zware keys uit het geheugen, de rest normaal uit localStorage
    localStorage.getItem = function(key){ var hk=isHeavy(key); if(hk){ return (bigCache[key]!==undefined && bigCache[key]!==null) ? bigCache[key] : null; } return _origGet(key); };
    // Eenmalige migratie van bestaande zware data uit localStorage + laden uit IndexedDB
    var _heavyReady=false;
    function bootHeavy(){
      try {
        HEAVY_KEYS.forEach(function(k){ var pk=PREFIX+k; var v=null; try{ v=_origGet(pk); }catch(e){} if(v!=null){ bigCache[pk]=v; idbSet(pk,v).catch(function(){}); try{ _origRemove(pk); }catch(e){} } });
      } catch(e){}
      var pend=[];
      HEAVY_KEYS.forEach(function(k){ var pk=PREFIX+k; if(bigCache[pk]===undefined){ pend.push(idbGet(pk).then(function(val){ if(val!=null) bigCache[pk]=val; }).catch(function(){})); } });
      Promise.all(pend).then(function(){ _heavyReady=true; window._wgHeavyLoaded=true; try{ softRefresh(); }catch(e){} });
    }

    function shortKey(prefixedKey){ if (typeof prefixedKey !== 'string' || prefixedKey.indexOf(PREFIX) !== 0) return null; var k = prefixedKey.slice(PREFIX.length); return SYNC_KEYS.indexOf(k) !== -1 ? k : null; }

    // Schrijf-mirror: elke wijziging gaat naar de cloud, met retry; tot het gelukt is blijft de sleutel 'pending' en beschermd tegen overschrijven door hydrate
    function pushToCloud(k, parsed, attempt){
      pendingKeys[k] = Date.now();
      sb.from('app_state').upsert({ brand: BRAND, key: k, value: parsed, updated_by: clientId }, { onConflict: 'brand,key' }).then(function(r){
        if (r && r.error) {
          console.warn('cloud upsert ' + k, r.error.message);
          if (attempt < 4) { setTimeout(function(){ pushToCloud(k, parsed, attempt + 1); }, 1500 * (attempt + 1)); }
          else { if (typeof toast === 'function') toast('Kon ' + k + ' niet online opslaan, lokaal bewaard gebleven', true); }
          return; // sleutel blijft pending -> hydrate overschrijft de lokale versie niet
        }
        if (pendingKeys[k] && (Date.now() - pendingKeys[k]) < 1500 * 6) delete pendingKeys[k]; // gelukt en geen nieuwere lokale wijziging in de tussentijd
      }).catch(function(){ if (attempt < 4) setTimeout(function(){ pushToCloud(k, parsed, attempt + 1); }, 1500 * (attempt + 1)); });
    }
    localStorage.setItem = function(key, val){
      var hk = isHeavy(key);
      if (hk) {
        // zware foto-data: in het geheugen + IndexedDB (ruim), NIET in de kleine localStorage
        bigCache[key] = val;
        idbSet(key, val).catch(function(){ if (typeof toast === 'function') toast('Kon ' + hk + ' niet lokaal bewaren, staat wel op de teamserver', true); });
      } else {
        try {
          _origSet(key, val);
        } catch (e) {
          // Lokale opslag vol: ruim eventuele restjes zware blobs lokaal op zodat kleine writes blijven werken.
          try {
            HEAVY_KEYS.forEach(function(h){ if ((PREFIX + h) !== key) { try { _origRemove(PREFIX + h); } catch(_){} } });
            _origSet(key, val);
          } catch (e2) { /* nog steeds vol: data leeft in de cloud */ }
        }
      }
      if (applying) return;
      var k = shortKey(key); if (!k) return;
      var parsed; try { parsed = JSON.parse(val); } catch(e){ parsed = val; }
      pushToCloud(k, parsed, 0); // de wijziging gaat naar de teamserver
    };
    localStorage.removeItem = function(key){
      var hk = isHeavy(key);
      if (hk) { delete bigCache[key]; idbDel(key).catch(function(){}); }
      else { _origRemove(key); }
      if (applying) return;
      var k = shortKey(key); if (!k) return;
      sb.from('app_state').delete().eq('brand', BRAND).eq('key', k).then(function(r){ if (r && r.error) console.warn('cloud delete ' + k, r.error.message); });
    };

    /* Geeft terug of er werkelijk iets veranderde. Dat onderscheid is niet
       cosmetisch: op elke venster-focus draait hydrate, en die eindigde
       altijd in softRefresh -- de hele bibliotheek en alle menu's opnieuw
       getekend terwijl je er middenin zat te lezen. Alles klapte dicht om
       een "wijziging" die er niet was. Gelijke data = niets aanraken. */
    function applyRows(rows){
      var veranderd = false;
      applying = true;
      try { rows.forEach(function(row){
        if (!row || SYNC_KEYS.indexOf(row.key) === -1) return;
        if (pendingKeys[row.key]) return; /* lokale wijziging nog niet bevestigd: niet overschrijven */
        var pk = PREFIX + row.key; var str; try { str = JSON.stringify(row.value); } catch(e){ str = null; }
        if (str == null) return;
        var huidig = (HEAVY_KEYS.indexOf(row.key) !== -1) ? bigCache[pk] : _origGet(pk);
        if (huidig === str) return;
        veranderd = true;
        if (HEAVY_KEYS.indexOf(row.key) !== -1) { bigCache[pk] = str; idbSet(pk, str).catch(function(){}); }
        else { try { _origSet(pk, str); } catch(e){} }
      }); }
      finally { applying = false; }
      return veranderd;
    }
    /* Testhaakje: applyRows zit in deze closure en het "gelijke data = niets
       aanraken"-gedrag moet van buitenaf te bewijzen zijn. */
    window._wgSync = { applyRows: applyRows };
    function softRefresh(){
      try { if (typeof loadState === 'function') loadState(); } catch(e){}
      ['renderProductSelect','renderProductPreview','renderBundleBuilder','renderPersonaSelect','renderPersonaPreview','renderLibrary','renderScriptLibrary','renderProductList','renderProductLibrary','renderPersonaLibrary','renderPersonaDbList','renderBrandSettings','renderSwSelects','wgRenderDashboard'].forEach(function(fn){ if (typeof window[fn] === 'function') { try { window[fn](); } catch(e){} } });
    }

    // Live sync: wijzigingen van teamleden binnenhalen
    function subscribe(){
      try {
        sb.channel('app_state_' + BRAND)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'brand=eq.' + BRAND }, function(payload){
            try {
              var row = payload.new || payload.old; if (!row) return;
              if (payload.new && payload.new.updated_by === clientId) return; // eigen wijziging negeren
              if (SYNC_KEYS.indexOf(row.key) === -1) return;
              if (payload.eventType === 'DELETE') { applying = true; try { if (HEAVY_KEYS.indexOf(row.key) !== -1) { delete bigCache[PREFIX + row.key]; idbDel(PREFIX + row.key).catch(function(){}); } else { _origRemove(PREFIX + row.key); } } finally { applying = false; } }
              else if (payload.new) {
                /* Kwam er werkelijk iets nieuws binnen? Realtime stuurt ook
                   berichten die lokaal al bekend zijn (eigen andere tab,
                   dubbele levering). Daarop hertekenen sloopt de leespositie
                   van wie er middenin zit -- dus dan: niets doen. */
                if (!applyRows([payload.new])) return;
              }
              softRefresh();
              if (typeof toast === 'function') toast('Teamdata bijgewerkt');
            } catch(e){ console.warn('realtime handler', e); }
          })
          .subscribe();
      } catch(e){ console.warn('realtime subscribe', e); }
    }

    function hydrate(){
      sb.from('app_state').select('key,value').eq('brand', BRAND).then(function(res){
        if (res && res.error) { console.warn('cloud fetch', res.error.message); return; }
        var rows = (res && res.data) ? res.data : [];
        if (rows.length === 0) {
          // Cloud nog leeg voor dit merk: lokale data is de bron, push naar cloud
          SYNC_KEYS.forEach(function(k){
            var v = null; try { v = localStorage.getItem(PREFIX + k); } catch(e){}
            if (v != null) { var p; try { p = JSON.parse(v); } catch(e){ p = v; } sb.from('app_state').upsert({ brand: BRAND, key: k, value: p, updated_by: clientId }, { onConflict: 'brand,key' }).then(function(r){ if (r && r.error) console.warn('seed push ' + k, r.error.message); }); }
          });
        } else {
          // Cloud heeft data: lokaal bijwerken, en alleen verversen als er
          // ook echt iets nieuws in zat -- hydrate draait op elke focus.
          if (applyRows(rows)) softRefresh();
        }
      });
    }
    var _syncStarted = false;
    function startSync(){
      if (_syncStarted) return; _syncStarted = true;
      subscribe();
      hydrate();
      try { window.addEventListener('focus', function(){ hydrate(); }); } catch(e){}
    }
    bootHeavy(); // zware data uit localStorage migreren + uit IndexedDB in het geheugen laden (los van login)
    // ====== TOEGANG: Supabase Auth (zelf aanmelden) + goedkeuringswachtrij ======
    // DB-policies staan in Team server/supabase-teamtoegang.sql (alleen 'approved' mag data).
    var ADMIN_EMAIL = 'dustin@wellshave.com';
    var _authProfile = null;
    var IST = 'width:100%;box-sizing:border-box;margin-bottom:10px;padding:12px 14px;background:#f4f2ed;border:1px solid rgba(26, 22, 14, 0.115);border-radius:9px;color:#8f6f29;font-size:13px;font-family:inherit;outline:none;';
    var BTN = 'width:100%;padding:13px;background:linear-gradient(135deg,#f1d58e,#d7b359);color:#050402;border:none;border-radius:10px;font-family:inherit;font-weight:800;letter-spacing:.08em;font-size:13px;cursor:pointer;box-shadow:0 8px 30px rgba(215, 179, 89, .2);';
    var SOC = 'width:100%;padding:11px;margin-bottom:8px;background:#f4f2ed;border:1px solid rgba(26, 22, 14, 0.115);border-radius:9px;color:#36332a;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;';
    function _rm(id){ var o=document.getElementById(id); if(o) o.remove(); }
    function hideLogin(){ _rm('ws-login'); _rm('ws-pending'); }
    function _overlay(id){
      var o=document.createElement('div'); o.id=id;
      o.style.cssText='position:fixed;inset:0;z-index:999999;background:#f4f2ee;display:flex;align-items:flex-start;justify-content:center;font-family:Hanken Grotesk,system-ui,sans-serif;padding:18px;overflow:auto;';
      return o;
    }
    function _card(inner){
      return '<div style="width:352px;max-width:90vw;margin:auto;background:#f3f1ec;border:1px solid rgba(26, 22, 14, 0.092);border-radius:14px;padding:28px 26px;box-shadow:0 30px 80px rgba(84, 72, 48, 0.303);">'
        + '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:22px;">'
        + '<div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#f1d58e,#988043);display:flex;align-items:center;justify-content:center;font-family:Fraunces,Georgia,serif;font-weight:700;font-size:22px;color:#050402;">A</div>'
        + '<div style="font-family:Fraunces,Georgia,serif;font-weight:600;font-size:22px;color:#8f6f29;letter-spacing:.01em;">Atelier</div>'
        + '<div style="font-family:JetBrains Mono,monospace;font-size:9.5px;color:#3d331d;letter-spacing:.22em;">WELLGROUP \u00b7 CONSOLE</div>'
        + '</div>'
        + inner + '</div>';
    }
    function _err(msg){ var e=document.getElementById('au-err'); if(e) e.textContent=msg||''; }
    function showLogin(mode){
      _rm('ws-pending'); _rm('ws-login');
      mode = mode || 'login';
      var o=_overlay('ws-login');
      var tab=function(a){ return 'flex:1;padding:8px;text-align:center;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.02em;border-radius:7px;'+(a?'background:rgba(215, 179, 89, .16);color:#886416;':'color:#36332a;'); };
      var login = '<input id="au-email" type="email" placeholder="E-mail" autocomplete="username" style="'+IST+'">'
        + '<input id="au-pass" type="password" placeholder="Wachtwoord" autocomplete="current-password" style="'+IST+'margin-bottom:14px;">'
        + '<button id="au-login-btn" style="'+BTN+'">INLOGGEN</button>';
      var signup = '<input id="au-name" type="text" placeholder="Naam" autocomplete="name" style="'+IST+'">'
        + '<input id="au-email" type="email" placeholder="E-mail" autocomplete="username" style="'+IST+'">'
        + '<input id="au-pass" type="password" placeholder="Wachtwoord (min. 6 tekens)" autocomplete="new-password" style="'+IST+'margin-bottom:14px;">'
        + '<button id="au-signup-btn" style="'+BTN+'">AANMELDEN</button>';
      var inner = '<div style="display:flex;gap:6px;background:#f4f2ed;border:1px solid rgba(26, 22, 14, 0.092);border-radius:9px;padding:4px;margin-bottom:18px;">'
        + '<div id="au-tab-login" style="'+tab(mode==='login')+'">Inloggen</div>'
        + '<div id="au-tab-signup" style="'+tab(mode==='signup')+'">Aanmelden</div></div>'
        + (mode==='login'?login:signup)
        + '<div style="display:flex;align-items:center;gap:8px;margin:16px 0 12px;color:#7d7664;font-size:11px;"><div style="flex:1;height:1px;background:rgba(215, 179, 89, .18);"></div>of ga verder met<div style="flex:1;height:1px;background:rgba(215, 179, 89, .18);"></div></div>'
        + '<button data-oauth="google" style="'+SOC+'">Google</button>'
        + '<button data-oauth="facebook" style="'+SOC+'">Facebook</button>'
        + '<button data-oauth="apple" style="'+SOC+'margin-bottom:0;">Apple</button>'
        + '<div id="au-err" style="color:#ac4620;font-size:12px;margin-top:11px;min-height:14px;text-align:center;"></div>';
      o.innerHTML=_card(inner);
      document.body.appendChild(o);
      document.getElementById('au-tab-login').onclick=function(){ showLogin('login'); };
      document.getElementById('au-tab-signup').onclick=function(){ showLogin('signup'); };
      Array.prototype.forEach.call(o.querySelectorAll('button[data-oauth]'),function(b){ b.onclick=function(){ oauth(b.getAttribute('data-oauth')); }; });
      if(mode==='login'){
        document.getElementById('au-login-btn').onclick=doLogin;
        document.getElementById('au-pass').addEventListener('keydown',function(e){ if(e.key==='Enter') doLogin(); });
      } else {
        document.getElementById('au-signup-btn').onclick=doSignup;
        document.getElementById('au-pass').addEventListener('keydown',function(e){ if(e.key==='Enter') doSignup(); });
      }
      setTimeout(function(){ try{ document.getElementById(mode==='signup'?'au-name':'au-email').focus(); }catch(e){} },60);
    }
    async function doLogin(){
      var email=((document.getElementById('au-email')||{}).value||'').trim();
      var pass=(document.getElementById('au-pass')||{}).value||'';
      _err('');
      if(!email||!pass){ _err('Vul e-mail en wachtwoord in'); return; }
      var btn=document.getElementById('au-login-btn'); if(btn){ btn.disabled=true; btn.textContent='BEZIG...'; }
      try{
        var res=await sb.auth.signInWithPassword({ email:email, password:pass });
        if(res&&res.error){ _err('Inloggen mislukt, controleer e-mail en wachtwoord'); if(btn){ btn.disabled=false; btn.textContent='INLOGGEN'; } return; }
        routeUser();
      }catch(e){ _err('Fout bij inloggen'); if(btn){ btn.disabled=false; btn.textContent='INLOGGEN'; } }
    }
    async function doSignup(){
      var name=((document.getElementById('au-name')||{}).value||'').trim();
      var email=((document.getElementById('au-email')||{}).value||'').trim();
      var pass=(document.getElementById('au-pass')||{}).value||'';
      _err('');
      if(!name||!email||!pass){ _err('Vul naam, e-mail en wachtwoord in'); return; }
      if(pass.length<6){ _err('Wachtwoord moet minstens 6 tekens zijn'); return; }
      var btn=document.getElementById('au-signup-btn'); if(btn){ btn.disabled=true; btn.textContent='BEZIG...'; }
      try{
        var res=await sb.auth.signUp({ email:email, password:pass, options:{ data:{ full_name:name } } });
        if(res&&res.error){ _err(res.error.message||'Aanmelden mislukt'); if(btn){ btn.disabled=false; btn.textContent='AANMELDEN'; } return; }
        if(res&&res.data&&res.data.session){ routeUser(); }
        else { showPending({ needConfirm:true }); }
      }catch(e){ _err('Fout bij aanmelden'); if(btn){ btn.disabled=false; btn.textContent='AANMELDEN'; } }
    }
    async function oauth(provider){
      _err('');
      try{
        var res=await sb.auth.signInWithOAuth({ provider:provider, options:{ redirectTo: window.location.origin + window.location.pathname } });
        if(res&&res.error){ _err(res.error.message||('Inloggen met '+provider+' lukt niet. Is deze provider aangezet in Supabase?')); }
      }catch(e){ _err('Kon niet doorsturen naar '+provider); }
    }
    function showPending(opts){
      _rm('ws-login'); if(document.getElementById('ws-pending')) return;
      opts=opts||{};
      var msg = opts.rejected
        ? 'Je aanmelding is helaas afgewezen. Neem contact op met je beheerder.'
        : (opts.needConfirm
            ? 'Bevestig eerst je e-mail via de link die we je stuurden. Daarna staat je account in de wachtrij voor goedkeuring.'
            : 'Bedankt voor je aanmelding. Je account wacht op goedkeuring door de beheerder. Je krijgt toegang zodra je bent goedgekeurd.');
      var inner = '<div style="font-size:13px;color:#63583e;line-height:1.55;text-align:center;margin-bottom:18px;">'+msg+'</div>'
        + '<button id="au-refresh" style="'+BTN+'margin-bottom:9px;">OPNIEUW CONTROLEREN</button>'
        + '<button id="au-logout2" style="width:100%;padding:9px;background:transparent;border:1px solid rgba(215, 179, 89, .3);color:#504b3f;border-radius:8px;font-size:12px;cursor:pointer;">Uitloggen</button>';
      var o=_overlay('ws-pending'); o.innerHTML=_card(inner); document.body.appendChild(o);
      document.getElementById('au-refresh').onclick=function(){ routeUser(); };
      document.getElementById('au-logout2').onclick=function(){ window.wsLogout(); };
    }
    async function fetchProfile(uid){
      try{ var r=await sb.from('team_members').select('id,email,full_name,status,is_admin,role').eq('id',uid).maybeSingle();
        if(r&&!r.error) return r.data; }catch(e){}
      return null;
    }
    function applyRoleRestrictions(role){
      try{
        var restricted = (role==='guest');
        ['generator','copy','iterate','transformer','copywriter','scriptwriter','brand','proxy'].forEach(function(t){
          var b=document.getElementById('main-tab-btn-'+t); if(b) b.style.display = restricted?'none':'';
        });
        Array.prototype.forEach.call(document.querySelectorAll('.ws-nav-section'),function(el){
          var t=(el.textContent||'').trim();
          if(t==='Genereren' || t==='Instellingen'){ el.style.display = restricted?'none':''; }
        });
        if(restricted){ try{ switchMainTab('library'); }catch(e){} }
      }catch(e){}
    }
    async function routeUser(){
      var sess=null; try{ var r=await sb.auth.getSession(); sess=r&&r.data?r.data.session:null; }catch(e){}
      window.__WG_TOKEN = (sess && sess.access_token) ? sess.access_token : null; /* [MARKETING-ADS] */
      if(!sess){ _authProfile=null; showLogin('login'); return; }
      var prof=await fetchProfile(sess.user.id); _authProfile=prof; window._authProfile=prof;
      try{ window.openAdminPanel=openAdminPanel; }catch(e){}
      var status=prof?prof.status:'pending';
      if(status==='approved'){
        window._userRole=(prof&&prof.role)?prof.role:'member';
        hideLogin(); startSync(); ensureSessionUI(prof); applyRoleRestrictions(window._userRole);
      }
      else if(status==='rejected'){ showPending({ rejected:true }); }
      else { showPending({}); }
    }
    window.wsLogout=async function(){ try{ await sb.auth.signOut(); }catch(e){} location.reload(); };
    function _footBtn(id,label){
      var b=document.createElement('button'); b.id=id; b.textContent=label;
      b.style.cssText='margin-top:9px;display:block;width:100%;padding:6px;background:transparent;border:1px solid var(--gold-line);color:var(--text-soft);border-radius:7px;font-size:11px;cursor:pointer;font-family:Montserrat,system-ui,sans-serif;';
      return b;
    }
    function ensureSessionUI(prof){
      try{
        var foot=document.querySelector('.ws-sidebar-foot'); if(!foot) return;
        if(!document.getElementById('ws-logout-btn')){
          var lb=_footBtn('ws-logout-btn','Uitloggen');
          lb.addEventListener('click',function(){ window.wsLogout(); });
          foot.appendChild(lb);
        }
        var isAdmin = prof && (prof.is_admin || prof.role==='admin' || prof.email===ADMIN_EMAIL);
        if(isAdmin && !document.getElementById('ws-admin-btn')){
          var ab=_footBtn('ws-admin-btn','Teamleden beheren');
          ab.addEventListener('click',openAdminPanel);
          foot.insertBefore(ab, document.getElementById('ws-logout-btn'));
          refreshAdminBadge();
          if(!window._adminBadgeFocus){ window._adminBadgeFocus=true; try{ window.addEventListener('focus',function(){ refreshAdminBadge(); }); }catch(e){} }
        }
      }catch(e){}
    }
    async function refreshAdminBadge(){
      try{ var r=await sb.from('team_members').select('id',{ count:'exact', head:true }).eq('status','pending');
        var n=r&&typeof r.count==='number'?r.count:0;
        var ab=document.getElementById('ws-admin-btn'); if(ab) ab.textContent='Teamleden beheren'+(n>0?' ('+n+')':'');
      }catch(e){}
    }
    function openAdminPanel(){
      _rm('ws-admin');
      var o=_overlay('ws-admin');
      o.innerHTML='<div style="width:640px;max-width:95vw;margin:40px auto;background:#f3f1ea;border:1px solid rgba(215, 179, 89, .26);border-radius:14px;padding:22px 22px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
        + '<div style="display:flex;gap:6px;background:#f4f2eb;border:1px solid rgba(215, 179, 89, .18);border-radius:9px;padding:4px;">'
        + '<div id="adm-tab-members" style="padding:7px 14px;cursor:pointer;font-size:12px;border-radius:7px;">Teamleden</div>'
        + '<div id="adm-tab-log" style="padding:7px 14px;cursor:pointer;font-size:12px;border-radius:7px;">Logboek</div>'
        + '<div id="adm-tab-sleutels" style="padding:7px 14px;cursor:pointer;font-size:12px;border-radius:7px;">Sleutels</div></div>'
        + '<div id="ws-admin-close" style="cursor:pointer;color:#504b3f;font-size:22px;line-height:1;padding:2px 6px;">&times;</div></div>'
        + '<div id="ws-admin-body" style="font-size:13px;color:#63583e;max-height:62vh;overflow:auto;">Laden...</div></div>';
      document.body.appendChild(o);
      document.getElementById('ws-admin-close').onclick=function(){ _rm('ws-admin'); };
      o.addEventListener('click',function(e){ if(e.target===o) _rm('ws-admin'); });
      var tm=document.getElementById('adm-tab-members'), tl=document.getElementById('adm-tab-log');
      var ts=document.getElementById('adm-tab-sleutels');
      function setTab(which){
        [[tm,'members'],[tl,'log'],[ts,'sleutels']].forEach(function(paar){
          if(!paar[0]) return;
          var aan = which===paar[1];
          paar[0].style.background = aan?'#c08a4a':'transparent';
          paar[0].style.color = aan?'#1c1109':'#9a9283';
        });
        if(which==='members') renderAdminList();
        else if(which==='log') renderActivityLog();
        /* De sleutels staan in js/53. Bestaat dat bestand om wat voor reden
           dan ook niet, dan hoort er een zin te staan in plaats van een leeg
           vak dat eruitziet alsof hij nog laadt. */
        else if(typeof window.sleutelPaneel==='function') window.sleutelPaneel(document.getElementById('ws-admin-body'));
        else document.getElementById('ws-admin-body').textContent='Sleutelbeheer is niet geladen.';
      }
      tm.onclick=function(){ setTab('members'); };
      tl.onclick=function(){ setTab('log'); };
      if(ts) ts.onclick=function(){ setTab('sleutels'); };
      setTab('members');
    }
    function _escAdm(s){ return (s||'').replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    async function renderAdminList(){
      var el=document.getElementById('ws-admin-body'); if(!el) return; el.innerHTML='Laden...';
      var r=null; try{ r=await sb.from('team_members').select('id,email,full_name,status,role,created_at').order('created_at',{ ascending:false }); }catch(e){}
      if(!r||r.error){ el.innerHTML='<div style="color:#ac4620;">Kon teamleden niet laden.'+((r&&r.error&&r.error.message)?(' '+r.error.message):'')+'</div>'; return; }
      var rows=r.data||[];
      if(!rows.length){ el.innerHTML='Nog geen aanmeldingen.'; return; }
      var order={ pending:0, approved:1, rejected:2 };
      rows.sort(function(a,b){ return (order[a.status]||9)-(order[b.status]||9); });
      var html='';
      rows.forEach(function(m){
        var badge = m.status==='approved'?'<span style="color:#428a4e;">Goedgekeurd</span>'
          : m.status==='rejected'?'<span style="color:#ac4620;">Afgewezen</span>'
          : '<span style="color:#886416;">Wacht op goedkeuring</span>';
        var roleSel='<select data-role-id="'+m.id+'" title="Rol" style="background:#f4f2eb;color:#856b33;border:1px solid rgba(215, 179, 89, .3);border-radius:6px;font-size:11px;padding:4px 6px;margin-left:6px;">'
          +'<option value="admin"'+(m.role==='admin'?' selected':'')+'>Admin</option>'
          +'<option value="member"'+((m.role==='member'||!m.role)?' selected':'')+'>Member</option>'
          +'<option value="guest"'+(m.role==='guest'?' selected':'')+'>Guest</option></select>';
        var actions='';
        if(m.status!=='approved') actions+='<button data-act="approve" data-id="'+m.id+'" style="padding:5px 10px;margin-left:6px;background:#e2ede4;color:#0fbd41;border:none;border-radius:6px;font-size:11px;cursor:pointer;">Goedkeuren</button>';
        if(m.status!=='rejected') actions+='<button data-act="reject" data-id="'+m.id+'" style="padding:5px 10px;margin-left:6px;background:transparent;border:1px solid rgba(224, 138, 106, .5);color:#ac4620;border-radius:6px;font-size:11px;cursor:pointer;">Afwijzen</button>';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(215, 179, 89, .12);">'
          +'<div style="min-width:0;"><div style="color:#856b33;font-weight:600;overflow:hidden;text-overflow:ellipsis;">'+_escAdm(m.full_name||'(geen naam)')+'</div>'
          +'<div style="font-size:11px;color:#504b3f;">'+_escAdm(m.email||'')+' &middot; '+badge+'</div></div>'
          +'<div style="white-space:nowrap;display:flex;align-items:center;">'+roleSel+actions+'</div></div>';
      });
      el.innerHTML=html;
      Array.prototype.forEach.call(el.querySelectorAll('button[data-act]'),function(b){
        b.onclick=async function(){
          var id=b.getAttribute('data-id'), act=b.getAttribute('data-act');
          b.disabled=true; b.textContent='...';
          var st=act==='approve'?'approved':'rejected';
          try{ var up=await sb.from('team_members').update({ status:st }).eq('id',id);
            if(up&&up.error){ alert('Mislukt: '+up.error.message); } }catch(e){ alert('Mislukt'); }
          renderAdminList(); refreshAdminBadge();
        };
      });
      Array.prototype.forEach.call(el.querySelectorAll('select[data-role-id]'),function(s){
        s.onchange=async function(){
          var id=s.getAttribute('data-role-id');
          try{ var up=await sb.from('team_members').update({ role:s.value }).eq('id',id);
            if(up&&up.error){ alert('Rol wijzigen mislukt: '+up.error.message); } }catch(e){ alert('Rol wijzigen mislukt'); }
        };
      });
    }
    async function renderActivityLog(){
      var el=document.getElementById('ws-admin-body'); if(!el) return; el.innerHTML='Laden...';
      var r=null; try{ r=await sb.from('activity_log').select('created_at,user_email,user_name,item_key,action,brand').order('created_at',{ ascending:false }).limit(100); }catch(e){}
      if(!r||r.error){ el.innerHTML='<div style="color:#ac4620;">Kon logboek niet laden.'+((r&&r.error&&r.error.message)?(' '+r.error.message):'')+'</div>'; return; }
      var rows=r.data||[];
      if(!rows.length){ el.innerHTML='Nog geen activiteit vastgelegd.'; return; }
      var area={ library_v2:'Bibliotheek', script_library_v1:'Scripts', products_v2:'Producten', personas_v1:"Persona's", brand_profile_v1:'Merk-instellingen', seed_version:'Initialisatie' };
      var actl={ insert:'opgeslagen', update:'aangepast', delete:'verwijderd' };
      var html='';
      rows.forEach(function(a){
        var ws=''; try{ ws=new Date(a.created_at).toLocaleString('nl-NL'); }catch(e){ ws=a.created_at||''; }
        var who=_escAdm(a.user_name||a.user_email||'onbekend');
        var ar=_escAdm(area[a.item_key]||a.item_key||'');
        var ac=_escAdm(actl[a.action]||a.action||'');
        var br=a.brand?(' <span style="color:#504b3f;">('+_escAdm(a.brand)+')</span>'):'';
        html+='<div style="padding:9px 0;border-bottom:1px solid rgba(215, 179, 89, .1);">'
          +'<span style="color:#856b33;">'+who+'</span> <span style="color:#504b3f;">heeft</span> <span style="color:#886416;">'+ar+'</span>'+br+' <span style="color:#504b3f;">'+ac+'</span>'
          +'<div style="font-size:11px;color:#7d7664;margin-top:2px;">'+_escAdm(ws)+'</div></div>';
      });
      el.innerHTML=html;
    }
    sb.auth.onAuthStateChange(function(evt, session){ routeUser(); });
    routeUser();
  } catch (e) { console.warn('cloud-sync init', e); }
})();
