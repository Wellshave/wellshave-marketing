(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.wgPlayReveal = function(section, fresh){
    if(reduce || !section) return;
    var frame = section.querySelector('.gen-image-frame'); if(!frame) return;
    var img = frame.querySelector('img');
    frame.classList.remove('wg-frame-sweep'); void frame.offsetWidth; frame.classList.add('wg-frame-sweep');
    if(img){ img.classList.remove('wg-reveal-img'); void img.offsetWidth; img.classList.add('wg-reveal-img'); }
    setTimeout(function(){ frame.classList.remove('wg-frame-sweep'); if(img) img.classList.remove('wg-reveal-img'); }, 1000);
    if(fresh) wgSparks(frame);
  };
  window.wgSparks = function(anchor){
    if(reduce || !anchor) return;
    var r = anchor.getBoundingClientRect(); var cx = r.left + r.width/2, cy = r.top + r.height/2;
    for(var i=0;i<16;i++){ (function(){
      var s=document.createElement('div'); s.className='wg-spark';
      s.style.left=cx+'px'; s.style.top=cy+'px'; document.body.appendChild(s);
      var ang=Math.random()*Math.PI*2, dist=60+Math.random()*90;
      var dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist;
      try{ s.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) scale(0)',opacity:0}],{duration:750+Math.random()*350,easing:'cubic-bezier(.2,.7,.3,1)'}); }catch(e){}
      setTimeout(function(){ s.remove(); }, 1150);
    })(); }
  };
  window.wgLoadingRotate = function(varIndex){
    if(reduce) return;
    var lines=['Theriot kiest de hook...','Persona en awareness matchen...','Compositie opbouwen...','Het beeld wordt gerenderd...','Laatste gouden details...'];
    var i=0;
    var iv=setInterval(function(){
      var sec=document.getElementById('gen-image-'+varIndex);
      var el=sec && sec.querySelector('.loading-text');
      if(!el){ clearInterval(iv); return; }
      i=(i+1)%lines.length; el.textContent=lines[i];
    }, 1500);
  };
  window.wgCelebrateSave = function(){
    var b=document.getElementById('main-tab-btn-library');
    if(b){ b.classList.remove('wg-bump'); void b.offsetWidth; b.classList.add('wg-bump'); setTimeout(function(){ b.classList.remove('wg-bump'); }, 650); }
  };

  // ===== Fase 2a: pagina-overgangen bij tabwissel =====
  if (typeof switchMainTab === 'function' && !window._wgSwitchWrapped) {
    window._wgSwitchWrapped = true;
    var _wgOrigSwitch = switchMainTab;
    window.switchMainTab = function(tab){
      _wgOrigSwitch.apply(this, arguments);
      try {
        var _dv=document.getElementById('main-tab-dashboard'), _db=document.getElementById('main-tab-btn-dashboard');
        if(tab==='dashboard'){
          ['generator','library','sop','brand','changelog','personas','products','scripts','transformer','copywriter','scriptwriter','copy','iterate','proxy'].forEach(function(k){ var v=document.getElementById('main-tab-'+k); if(v) v.style.display='none'; var bt=document.getElementById('main-tab-btn-'+k); if(bt) bt.classList.remove('active'); });
          if(_dv) _dv.style.display='block'; if(_db) _db.classList.add('active');
          try{ wgRenderDashboard(); }catch(e){}
        }
        else { if(_dv) _dv.style.display='none'; if(_db) _db.classList.remove('active'); }
      } catch(e){}
      if (reduce) return;
      try {
        ['main-tab-dashboard','main-tab-generator','main-tab-library','main-tab-sop','main-tab-brand','main-tab-changelog','main-tab-personas','main-tab-products','main-tab-scripts','main-tab-transformer','main-tab-copywriter','main-tab-scriptwriter'].forEach(function(id){
          var el=document.getElementById(id);
          if(el && el.style.display!=='none'){ el.classList.remove('wg-page-in'); void el.offsetWidth; el.classList.add('wg-page-in'); }
        });
      } catch(e){}
    };
  }

  // ===== Fase 2a: bibliotheek-drill-in =====
  /* Een afgeleide waarde vastleggen als beslissing.
     De waarde stond er al -- hij kwam uit de brief van deze creative -- maar
     hij bewoog mee: verandert de brief, dan verandert hij. Bevestigen schrijft
     hem weg in de matrix, en vanaf dat moment is het een besluit van een mens
     en niet meer een gok van het systeem. Zonder dat onderscheid weet je over
     een maand niet meer wat er nagekeken is. */
  function wgBevestigVeld(ov, item, veld) {
    if (!veld || typeof nickVeld !== 'function') return;
    var r = nickVeld(item, veld);
    if (!r.waarde) return;
    item.matrix = item.matrix || {};
    item.matrix[veld] = r.waarde;
    try { if (typeof saveLibrary === 'function') saveLibrary(); } catch (e) {}
    /* Alleen dit blok bijwerken, niet het paneel opnieuw tekenen: hertekenen
       zou je scrollpositie en het open tabblad wegvagen voor een verandering
       van twee woorden. */
    var blok = ov.querySelector('.dos-veld[data-veld="' + veld + '"]');
    if (!blok) return;
    blok.classList.remove('af');
    var merk = blok.querySelector('.dos-merk');
    if (merk) { merk.textContent = 'Bevestigd'; merk.classList.add('vast'); }
    var knop = blok.querySelector('.dos-bevestig');
    if (knop) knop.remove();
  }

  /* De bewerkbare blokken in de matrix. Ze zijn contenteditable in plaats van
     een textarea, want een textarea van drie regels met een schuifbalk is
     precies wat er misging: je scrolde binnen een vakje om een zin te lezen.
     Opslaan gaat met een korte vertraging, zodat er niet bij elke aanslag
     naar de opslag geschreven wordt. */
  window.wgKoppelBlokken = function wgKoppelBlokken(ov) {
    ov.querySelectorAll('p[data-matrix-id]').forEach(function (el) {
      if (el._dosAan) return;
      el._dosAan = true;
      el.addEventListener('input', function () {
        var lib = (typeof state !== 'undefined' && state.library) ? state.library : [];
        var it = lib.filter(function (x) { return x.id === el.getAttribute('data-matrix-id'); })[0];
        if (!it) return;
        it.matrix = it.matrix || {};
        it.matrix[el.getAttribute('data-matrix-field')] = el.textContent.trim();
        clearTimeout(el._dosT);
        el._dosT = setTimeout(function () {
          try { if (typeof saveLibrary === 'function') saveLibrary(); } catch (e) {}
        }, 500);
      });
      /* Een leeg blok toont een uitnodiging. Die hoort weg te zijn zodra je
         begint te typen, anders typ je erdoorheen. */
      el.addEventListener('focus', function () {
        var blok = el.closest('.dos-veld');
        if (blok && blok.classList.contains('leeg')) {
          blok.classList.remove('leeg');
          el.textContent = '';
        }
      });
    });
  };

  function wgEsc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  window.wgOpenLibraryItem = function(id){
    var lib = (typeof state!=='undefined' && state.library) ? state.library : [];
    var item = lib.find(function(x){ return x.id===id; });
    if(!item) return;
    var v=item.variation||{}, m=item.metadata||{};
    var hasImg = !!(item.image && item.image.b64);
    var imgHtml = hasImg ? '<img class="wg-drill-img" src="data:'+((item.image.mime)||'image/png')+';base64,'+item.image.b64+'" alt="">' : '<div class="wg-drill-geenbeeld">Geen afbeelding bewaard</div>';
    /* Een eventueel openstaand paneel eerst weg. Zonder dit stapelen ze op:
       het id wg-drill komt dan twee keer voor, en alles wat het paneel
       opzoekt (de matrixvelden, de kopieerknop) landt op het OUDSTE exemplaar
       terwijl je naar het nieuwste kijkt. */
    var _oud=document.getElementById('wg-drill'); if(_oud) _oud.remove();
    var ov=document.createElement('div'); ov.id='wg-drill';
    /* Het dossier staat in het midden en niet meer als lade aan de zijkant.
       Een zijpaneel is 560 pixels breed, en daar geperst werden de drie
       kaarten van het overzicht kolommen van een woord breed. Het dossier is
       ook geen bijzaak naast de lijst: als je erop klikt is het het enige
       waar je naar kijkt. */
    ov.className = 'wg-drill-overlay' + ((typeof dosPaneelHtml === 'function') ? ' dos-modal' : '');
    /* De inhoud komt uit js/55: kop, beeld met zijn variaties, Nicks oordeel
       per as, kerninformatie, en drie tabbladen waaronder de landingsbrief.
       Wat hier stond was het beeld met de kop en daaronder het hele dossier
       plus de matrix onder elkaar geplakt -- acht velden met precies hetzelfde
       gewicht, elk in een tekstvakje van drie regels met zijn eigen
       schuifbalk. */
    ov.innerHTML = '<div class="wg-drill-panel dos-panel">'
      + '<div class="wg-drill-top">'
      +   '<div id="wg-drill-close" class="wg-drill-sluit" aria-label="Sluiten">&times;</div>'
      + '</div>'
      + '<div class="dos-inhoud">'
      +   ((typeof dosPaneelHtml === 'function') ? dosPaneelHtml(item)
           : ((typeof libVolledigHtml === 'function') ? libVolledigHtml(item) : ''))
      + '</div>'
      + '<div class="wg-drill-acties">'
      +   '<button class="btn btn-small" data-proxy="view">Open in generator</button>'
      +   '<button class="btn btn-small" data-proxy="iterate">Itereer op deze</button>'
      +   (hasImg?'<button class="btn btn-small btn-ghost" data-proxy="download">Download beeld</button>':'')
      +   '<button class="btn btn-small btn-ghost btn-danger" data-proxy="delete">Verwijder</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(ov);
    /* De matrixvelden in dit paneel moeten net zo goed opslaan als die op de
       kaart deden. Zonder deze regel typ je een notitie in het paneel en is
       hij weg zodra je het sluit. */
    if (typeof libKoppelMatrix === 'function') libKoppelMatrix(ov);
    wgKoppelBlokken(ov);
    /* De knoppen die alleen in dit paneel bestaan en dus geen tegenhanger op
       de kaart hebben om naar door te sturen. Via delegatie op het paneel,
       niet met een handler per knop: het matrixblok wordt na een analyse
       opnieuw getekend, en dan zou een vastgeklikte handler op een element
       zitten dat er niet meer is. */
    ov.addEventListener('click', function(e){
      var knop = e.target.closest('button[data-action]');
      if (!knop || !ov.contains(knop)) return;
      var act = knop.getAttribute('data-action');
      if (act === 'copy-name') {
        try { navigator.clipboard.writeText(libAdNaam(item)); } catch(err){}
        if (typeof toast === 'function') toast('Ad name gekopieerd, plak hem in Meta');
      } else if (act === 'nick-analyse') {
        if (typeof nickAnalyseer === 'function') nickAnalyseer(item.id);
      } else if (act === 'tab') {
        /* Van tabblad wisselen zonder het paneel opnieuw op te bouwen: dan
           zou je scrollpositie terugspringen naar boven, en dat is precies
           wat je niet wilt als je net iets aan het lezen was. */
        var welk = knop.getAttribute('data-tab');
        ov.querySelectorAll('.dos-tabs button').forEach(function (t) {
          t.setAttribute('aria-selected', String(t === knop));
        });
        ov.querySelectorAll('[data-paneel]').forEach(function (p) {
          p.hidden = p.getAttribute('data-paneel') !== welk;
        });
      } else if (act === 'wissel') {
        /* Naar een andere variatie uit dezelfde ad set. Het paneel opnieuw
           tekenen met dat item; de scrollpositie mag hier wel terug, want je
           kijkt naar iets anders. */
        var ander = knop.getAttribute('data-id');
        if (ander && ander !== item.id) { close(); window.wgOpenLibraryItem(ander); }
      } else if (act === 'bevestig') {
        /* Een afgeleide waarde vastleggen als beslissing. Hij stond er al --
           dit schrijft hem weg zodat hij niet meer met de brief meebeweegt. */
        wgBevestigVeld(ov, item, knop.getAttribute('data-veld'));
      } else if (act === 'kopieer-lp') {
        try { navigator.clipboard.writeText(lpPrompt(item)); } catch (err) {}
        knop.textContent = 'Gekopieerd';
        setTimeout(function () { knop.textContent = 'Kopieer prompt'; }, 1600);
      } else if (act === 'itereer') {
        var it = document.querySelector('#library button[data-action="iterate"][data-id="' + item.id + '"]');
        close(); if (it) it.click();
      }
    });
    requestAnimationFrame(function(){ ov.classList.add('show'); });
    /* Een functie-declaratie, geen const: hij wordt hierboven in de
       klikdelegatie al aangeroepen en die draait pas na dit punt, maar de
       hijsing maakt de volgorde onafhankelijk van waar hij staat. */
    function close(){ ov.classList.remove('show'); setTimeout(function(){ if(ov.parentNode) ov.remove(); }, 320); }
    ov.querySelector('#wg-drill-close').onclick=close;
    ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
    ov.querySelectorAll('button[data-proxy]').forEach(function(b){
      b.onclick=function(){
        var act=b.getAttribute('data-proxy');
        var orig=document.querySelector('#library button[data-action="'+act+'"][data-id="'+id+'"]');
        if(act==='view'||act==='iterate'){ close(); if(orig) orig.click(); }
        else if(act==='delete'){ if(orig) orig.click(); close(); }
        else { if(orig) orig.click(); }
      };
    });
  };
  var _wgLibEl = document.getElementById('library');
  if (_wgLibEl && !_wgLibEl._wgDrill) {
    _wgLibEl._wgDrill = true;
    _wgLibEl.addEventListener('click', function(e){
      if (e.target.closest('button')) return;
      if (e.target.closest('input, textarea, select, a')) return;
      if (e.target.closest('[data-matrix-id]')) return;
      if (e.target.closest('.lib-filter-bar')) return;
      var card = e.target.closest('.library-item'); if(!card) return;
      var idBtn = card.querySelector('button[data-id]'); if(!idBtn) return;
      window.wgOpenLibraryItem(idBtn.getAttribute('data-id'));
    });
  }

  // ===== Verfijnde dropdowns: native selects in de generator omzetten naar een cinematic paneel =====
  function wgSelEsc(s){ return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function wgSelCloseAll(except){ document.querySelectorAll('.wgsel.open').forEach(function(w){ if(w!==except) w.classList.remove('open'); }); }
  function wgSelUpdateField(wrap, sel){
    var valEl=wrap.querySelector('.wgsel-val'); if(!valEl) return;
    var opt=sel.options[sel.selectedIndex];
    if(!opt || opt.value===''){ valEl.textContent=(opt&&opt.text)||'Kies...'; valEl.classList.add('placeholder'); }
    else { valEl.textContent=opt.text; valEl.classList.remove('placeholder'); }
  }
  function wgSelBuildPanel(wrap, sel){
    var panel=wrap.querySelector('.wgsel-panel'); if(!panel) return; panel.innerHTML='';
    Array.prototype.forEach.call(sel.options, function(o){
      var row=document.createElement('div'); row.className='wgsel-opt'+(o.selected?' sel':'');
      row.innerHTML='<span>'+wgSelEsc(o.text)+'</span>'+(o.selected?'<span class="wgsel-ck">✓</span>':'');
      row.addEventListener('click', function(e){ e.stopPropagation(); if(sel.value!==o.value){ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); } wrap.classList.remove('open'); });
      panel.appendChild(row);
    });
  }
  function wgEnhanceSelect(sel){
    if(!sel || sel._wgEnhanced || sel.multiple) return; sel._wgEnhanced=true;
    var wrap=document.createElement('div'); wrap.className='wgsel';
    var field=document.createElement('div'); field.className='wgsel-field';
    field.innerHTML='<span class="wgsel-bar"></span><span class="wgsel-val"></span><svg class="wgsel-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    var panel=document.createElement('div'); panel.className='wgsel-panel';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(field); wrap.appendChild(panel); wrap.appendChild(sel);
    field.addEventListener('click', function(e){ e.stopPropagation(); var willOpen=!wrap.classList.contains('open'); wgSelCloseAll(wrap); if(willOpen){ wgSelBuildPanel(wrap,sel); wrap.classList.add('open'); } else { wrap.classList.remove('open'); } });
    sel.addEventListener('change', function(){ wgSelUpdateField(wrap,sel); });
    try{ var mo=new MutationObserver(function(){ wgSelUpdateField(wrap,sel); if(wrap.classList.contains('open')) wgSelBuildPanel(wrap,sel); }); mo.observe(sel,{childList:true}); }catch(e){}
    wgSelUpdateField(wrap,sel);
  }
  function wgEnhanceAllSelects(){
    var gv=document.getElementById('main-tab-generator'); if(!gv) return;
    gv.querySelectorAll('select').forEach(function(s){ wgEnhanceSelect(s); });
  }
  document.addEventListener('click', function(){ wgSelCloseAll(null); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') wgSelCloseAll(null); });
  (function(){
    var gv=document.getElementById('main-tab-generator');
    if(gv){ var t; try{ new MutationObserver(function(){ clearTimeout(t); t=setTimeout(wgEnhanceAllSelects, 150); }).observe(gv,{childList:true,subtree:true}); }catch(e){} }
    wgEnhanceAllSelects();
  })();

  // ===== Welkomstdashboard =====
  function wgRenderDashboard(){
    var host=document.getElementById('main-tab-dashboard');
    if(!host || host.style.display==='none') return;
    var esc=wgSelEsc;
    var prof=(window._authProfile)||{};
    var name = prof.full_name ? String(prof.full_name).split(' ')[0] : (prof.email ? String(prof.email).split('@')[0] : '');
    var brand = (typeof ACTIVE_BRAND!=='undefined' && ACTIVE_BRAND==='wellshine') ? 'Wellshine' : 'Wellshave';
    var lib = (typeof state!=='undefined' && state.library) ? state.library : [];
    var prods = (typeof state!=='undefined' && state.products) ? state.products : [];
    var pers = (typeof state!=='undefined' && state.personas) ? state.personas : [];
    var scripts = (typeof state!=='undefined' && state.scriptLibrary) ? state.scriptLibrary : [];
    var dateStr=''; try{ dateStr=new Date().toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'}); }catch(e){}
    function countBy(arr, fn){ var m={}; arr.forEach(function(x){ var k=fn(x); if(k==null||k==='') return; k=String(k); m[k]=(m[k]||0)+1; }); return m; }
    function topN(map, n){ return Object.keys(map).map(function(k){ return {k:k,c:map[k]}; }).sort(function(a,b){ return b.c-a.c; }).slice(0,n); }
    var topProd=topN(countBy(lib,function(it){ return it.metadata&&it.metadata.product; }),5);
    var topArch=topN(countBy(lib,function(it){ return it.metadata&&it.metadata.archetype; }),5);
    var topMode=topN(countBy(lib,function(it){ return it.metadata&&it.metadata.mode; }),1);
    var topFun=topN(countBy(lib,function(it){ return it.metadata&&it.metadata.funnel; }),1);
    var maxP=topProd.length?topProd[0].c:1, maxA=topArch.length?topArch[0].c:1;
    function statTile(total, label, subLabel, part, whole, mod){
      var pct = whole ? Math.round(part/whole*100) : 0;
      return '<div class="dash-stat'+(mod?(' '+mod):'')+'">'
        +'<div class="dash-num">'+total+'</div><div class="dash-lbl">'+esc(label)+'</div>'
        +'<div class="dash-stat-meter"><div class="ws-progress"><span style="width:'+pct+'%"></span></div>'
        +'<div class="dash-stat-sub">'+part+' '+esc(subLabel)+'</div></div></div>';
    }
    function rankList(items,max){ if(!items.length) return '<div class="dash-empty">Nog niets bewaard om te ranken.</div>'; return items.map(function(r,i){ return '<div class="dash-rank"><span class="dash-rank-n">'+(i+1)+'</span><div class="dash-rank-main"><div class="dash-rank-name">'+esc(r.k)+'</div><div class="dash-rank-bar"><div style="width:'+Math.round(r.c/max*100)+'%"></div></div></div><span class="dash-rank-c">'+r.c+'</span></div>'; }).join(''); }
    var recent = lib.slice().sort(function(a,b){ return (b.saved_at||0)-(a.saved_at||0); }).slice(0,3);
    var recentHtml = recent.length ? recent.map(function(it){ var v=it.variation||{}, m=it.metadata||{}; return '<div class="dash-rec" data-libid="'+esc(it.id)+'"><div class="dash-rec-img">'+esc((m.product||'').toUpperCase())+'</div><div class="dash-rec-t">'+esc(v.headline_nl||'(geen headline)')+'</div><div class="dash-rec-s">'+esc(m.product||'')+'</div></div>'; }).join('') : '<div class="dash-empty">Nog geen bewaarde concepten.</div>';
    var chips=''; if(topMode.length) chips+='<span class="dash-chip">Meest gebruikt format: '+esc(topMode[0].k)+'</span>'; if(topFun.length) chips+='<span class="dash-chip">Meest gebruikte funnel: '+esc(String(topFun[0].k).toUpperCase())+'</span>';
    var nv='',nt=''; try{ if(typeof CHANGELOG!=='undefined' && CHANGELOG[0]){ nv=CHANGELOG[0].version; nt=CHANGELOG[0].title; } }catch(e){}
    var isAdmin = prof && (prof.is_admin || prof.role==='admin' || prof.email==='dustin@wellshave.com');
    var IN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/></svg>';
    var IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    var IT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    var IL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
    host.innerHTML='<div class="dash-wrap">'
      +'<div class="dash-hi"><div><div class="dash-hello">Welkom terug'+(name?(', '+esc(name)):'')+'</div><div class="dash-sub">'+brand+' &middot; <span style="color:#428a4e;">teamserver verbonden</span>'+(dateStr?(' &middot; '+esc(dateStr)):'')+'</div></div></div>'
      +'<div><div class="dash-sec">Snel starten</div><div class="dash-acts">'
      +'<div class="dash-act primary" data-go="new">'+IN+'<div class="dash-act-t">Nieuwe ad</div><div class="dash-act-s">vanaf nul</div></div>'
      +'<div class="dash-act" data-go="copy">'+IC+'<div class="dash-act-t">Kopieer ad</div><div class="dash-act-s">van voorbeeld</div></div>'
      +'<div class="dash-act" data-go="iterate">'+IT+'<div class="dash-act-t">Itereren</div><div class="dash-act-s">op een winner</div></div>'
      +'<div class="dash-act" data-go="library">'+IL+'<div class="dash-act-t">Bibliotheek</div><div class="dash-act-s">'+lib.length+' bewaard</div></div>'
      +'</div></div>'
      +'<div class="dash-stats">'
      +statTile(prods.length,   'Producten',  'met foto en USPs',      prods.filter(function(p){ return p.images && p.images.length; }).length, prods.length, 'accent')
      +statTile(pers.length,    'Persona\'s', 'met uitgewerkte angles', pers.filter(function(p){ return p.angles && p.angles.length; }).length, pers.length, '')
      +statTile(lib.length,     'Concepten',  'met beeld',              lib.filter(function(it){ return it.image && it.image.b64; }).length, lib.length, '')
      +statTile(scripts.length, 'Scripts',    'bewaard deze maand',     scripts.filter(function(s){ return (Date.now()-(s.saved_at||0)) < 2592000000; }).length, scripts.length, '')
      +'</div>'
      +'<div class="dash-cols">'
      +'<div class="dash-card"><div class="dash-sec">Top producten &middot; meeste ads</div>'+rankList(topProd,maxP)+'</div>'
      +'<div class="dash-card"><div class="dash-sec">Top invalshoeken &middot; archetype</div>'+rankList(topArch,maxA)+(chips?('<div class="dash-chips" style="margin-top:14px;">'+chips+'</div>'):'')+'</div>'
      +'</div>'
      +'<div class="dash-cols">'
      +'<div><div class="dash-sec">Leaderboard &middot; meest actief</div><div class="dash-card"><div id="dash-lb" class="dash-empty">Ranglijst laden...</div></div></div>'
      +'<div><div class="dash-sec">Leaderboard &middot; meeste succes</div><div class="dash-card dark"><div id="dash-lb-succes" class="dash-empty">Ranglijst laden...</div></div></div>'
      +'</div>'
      +'<div><div class="dash-sec">Recent bewaard</div><div class="dash-recent">'+recentHtml+'</div></div>'
      +'<div class="dash-strips">'
      +(isAdmin?'<div class="dash-strip" data-go="admin"><div><div class="dash-strip-lbl">Teamleden</div><div class="dash-strip-main" id="dash-pending">Beheren</div></div><span class="dash-go">Openen →</span></div>':'')
      +(nv?('<div class="dash-strip" data-go="changelog"><div><div class="dash-strip-lbl">Wat is nieuw &middot; v'+esc(nv)+'</div><div class="dash-strip-main">'+esc(nt)+'</div></div><span class="dash-go">Bekijk →</span></div>'):'')
      +'</div>'
      +'</div>';
    recent.forEach(function(it,idx){ if(it.image&&it.image.b64){ var el=host.querySelectorAll('.dash-rec-img')[idx]; if(el){ el.style.backgroundImage="url('data:"+((it.image.mime)||'image/png')+";base64,"+it.image.b64+"')"; el.textContent=''; } } });
    (function(){
      var lbEl=host.querySelector('#dash-lb'); if(!lbEl) return;
      if(!window._sb){ lbEl.textContent='Ranglijst is beschikbaar zodra je bent ingelogd op de live tool.'; return; }
      try{
        window._sb.from('activity_log').select('user_email,user_name,item_key').order('created_at',{ascending:false}).limit(3000).then(function(r){
          if(!r || r.error){ lbEl.textContent='Kon de ranglijst niet laden.'; return; }
          var rows=r.data||[]; var m={};
          rows.forEach(function(a){ if(a.item_key==='seed_version') return; var k=a.user_name||a.user_email||'onbekend'; if(!m[k]) m[k]={total:0,ads:0}; m[k].total++; if(a.item_key==='library_v2') m[k].ads++; });
          var arr=Object.keys(m).map(function(k){ return {name:k,total:m[k].total,ads:m[k].ads}; }).sort(function(a,b){ return b.total-a.total; }).slice(0,5);
          if(!arr.length){ lbEl.textContent='Nog geen activiteit vastgelegd.'; return; }
          var max=arr[0].total||1;
          lbEl.innerHTML=arr.map(function(p,i){ return '<div class="dash-rank"><span class="dash-rank-n">'+(i+1)+'</span><div class="dash-rank-main"><div class="dash-rank-name">'+esc(p.name)+'</div><div class="dash-rank-bar"><div style="width:'+Math.round(p.total/max*100)+'%"></div></div></div><span class="dash-rank-c">'+p.total+' acties &middot; '+p.ads+' ads</span></div>'; }).join('');
        });
      }catch(e){ lbEl.textContent='Kon de ranglijst niet laden.'; }
    })();
    (function(){
      var sEl=host.querySelector('#dash-lb-succes'); if(!sEl) return;
      if(!window._sb){ sEl.textContent='Beschikbaar zodra je bent ingelogd op de live tool.'; return; }
      try{
        window._sb.from('ad_results').select('user_email,user_name,roas').limit(3000).then(function(r){
          if(!r || r.error){ sEl.textContent='Nog geen advertentiecijfers vastgelegd.'; return; }
          var rows=r.data||[]; var m={};
          rows.forEach(function(a){ var v=parseFloat(a.roas); if(isNaN(v)) return; var k=a.user_name||a.user_email||'onbekend'; if(!m[k]) m[k]={sum:0,n:0}; m[k].sum+=v; m[k].n++; });
          var arr=Object.keys(m).map(function(k){ return {name:k, avg:m[k].sum/m[k].n, n:m[k].n}; }).sort(function(a,b){ return b.avg-a.avg; }).slice(0,5);
          if(!arr.length){ sEl.textContent='Nog geen advertentiecijfers vastgelegd. Vul ze in bij Itereren en sla op.'; return; }
          var max=arr[0].avg||1;
          sEl.innerHTML=arr.map(function(p,i){ return '<div class="dash-rank"><span class="dash-rank-n">'+(i+1)+'</span><div class="dash-rank-main"><div class="dash-rank-name">'+esc(p.name)+'</div><div class="dash-rank-bar"><div style="width:'+Math.round(p.avg/max*100)+'%"></div></div></div><span class="dash-rank-c">gem. ROAS '+p.avg.toFixed(2)+' &middot; '+p.n+' ads</span></div>'; }).join('');
        });
      }catch(e){ sEl.textContent='Kon de ranglijst niet laden.'; }
    })();
    host.querySelectorAll('[data-go]').forEach(function(el){ el.addEventListener('click', function(){ var g=el.getAttribute('data-go');
      if(g==='new'){ switchMainTab('generator'); try{ setMode('scratch'); }catch(e){} }
      else if(g==='copy'){ switchMainTab('generator'); try{ setMode('copy'); }catch(e){} }
      else if(g==='iterate'){ switchMainTab('generator'); try{ setMode('iterate'); }catch(e){} }
      else if(g==='library'){ switchMainTab('library'); }
      else if(g==='changelog'){ switchMainTab('changelog'); }
      else if(g==='admin'){ try{ if(window.openAdminPanel) window.openAdminPanel(); }catch(e){} }
    }); });
    host.querySelectorAll('.dash-rec[data-libid]').forEach(function(el){ el.addEventListener('click', function(){ try{ wgOpenLibraryItem(el.getAttribute('data-libid')); }catch(e){} }); });
    if(isAdmin && window._sb){ try{ window._sb.from('team_members').select('id',{count:'exact',head:true}).eq('status','pending').then(function(r){ var n=(r&&typeof r.count==='number')?r.count:0; var pe=document.getElementById('dash-pending'); if(pe) pe.textContent = n>0?(n+' wachten op goedkeuring'):'Geen wachtenden'; }); }catch(e){} }
  }
  window.wgRenderDashboard=wgRenderDashboard;
  try { if (typeof switchMainTab==='function') switchMainTab('dashboard'); } catch(e){}

})();
