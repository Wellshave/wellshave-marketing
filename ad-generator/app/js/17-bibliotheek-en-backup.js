// ============================================================
// LIBRARY
// ============================================================
function compressB64(b64, srcMime, maxDim, quality) {
  return new Promise(function(resolve, reject) {
    const img = new Image();
    img.onload = function() {
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; } else { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function() { reject(new Error('kon beeld niet laden')); };
    img.src = 'data:' + srcMime + ';base64,' + b64;
  });
}

async function saveToLibraryFromCard(varIndex) {
  if (!state.lastGenerated) return;
  const v = state.lastGenerated.variations[varIndex];
  const metadata = state.lastGenerated.metadata;

  // Pak de huidig zichtbare versie van de afbeelding (indien aanwezig)
  let imageSnapshot = null;
  const imgState = state.generatedImages[varIndex];
  if (imgState && imgState.versions && imgState.versions.length > 0) {
    const current = imgState.versions[imgState.currentIndex];
    imageSnapshot = JSON.parse(JSON.stringify(current));
  }

  // Geen afbeelding gegenereerd? Vraag bevestiging zodat de gebruiker bewust kiest
  if (!imageSnapshot) {
    const ok = confirm(
      'Nog geen afbeelding gegenereerd voor deze variatie.\n\n' +
      'Klik OK om alleen het CONCEPT (tekst) op te slaan zonder afbeelding.\n' +
      'Klik Annuleer om eerst op "Genereer afbeelding" te klikken, dan worden beide samen bewaard.'
    );
    if (!ok) return;
  }

  // Comprimeer het beeld voor opslag (JPEG, max 1024px) zodat het binnen de localStorage-quota past en zichtbaar blijft
  if (imageSnapshot && imageSnapshot.b64) {
    try {
      const durl = await compressB64(imageSnapshot.b64, 'image/png', 1024, 0.82);
      const mm = durl.match(/^data:([^;]+);base64,(.+)$/);
      if (mm) imageSnapshot = { b64: mm[2], mime: mm[1], model: imageSnapshot.model, size: imageSnapshot.size, quality: imageSnapshot.quality, placement: imageSnapshot.placement || null };
    } catch (e) { console.error('compress lib image fail', e); }
  }

  // Check of er al een library-item bestaat voor exact deze variatie (zelfde headline + funnel + product)
  // Zo ja, update dat item in plaats van een duplicaat aan te maken
  const existingIdx = (state.library || []).findIndex(libItem =>
    libItem.variation &&
    libItem.variation.headline_nl === v.headline_nl &&
    libItem.metadata &&
    libItem.metadata.product === metadata.product &&
    libItem.metadata.funnel === metadata.funnel &&
    libItem.metadata.archetype === metadata.archetype
  );

  if (state.lastGenerated && !state.lastGenerated._batch_id) {
    state.lastGenerated._batch_id = 'batch-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    var _mc = (metadata && metadata.concept) ? String(metadata.concept) : '';
    var _t = _mc ? _mc.replace(/^HOEK[^:]*:\s*/i, '').split('\n')[0].slice(0, 90) : ((v && v.headline_nl) ? v.headline_nl : ((metadata && metadata.product) ? (metadata.product + ' , concept') : 'Concept'));
    state.lastGenerated._batch_title = _t;
  }
  const item = {
    id: existingIdx >= 0 ? state.library[existingIdx].id : ('lib-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
    variation: v,
    metadata,
    image: imageSnapshot,
    saved_at: Date.now(),
    batch_id: (state.lastGenerated && state.lastGenerated._batch_id) || null,
    batch_title: (state.lastGenerated && state.lastGenerated._batch_title) || '',
    variant_index: varIndex
  };
  /* Het id terugschrijven op de variatie in het geheugen. Zonder dit weet
     "Klaarzetten voor test" straks niet uit welk bibliotheekitem deze variant
     komt, en dan moet het achteraf op de kop gezocht worden — precies de
     koppeling op naam die we niet willen. */
  try {
    if (state.lastGenerated && state.lastGenerated.variations && varIndex != null
        && state.lastGenerated.variations[varIndex]) {
      state.lastGenerated.variations[varIndex]._libId = item.id;
    }
    if (state.lastGenerated) state.lastGenerated.batch_id = item.batch_id;
  } catch (e) {}

  try { if (typeof pxTagCreative === 'function') pxTagCreative(item); } catch(e){}

  if (existingIdx >= 0) {
    state.library[existingIdx] = item;
  } else {
    state.library.unshift(item);
  }

  // Probeer op te slaan, val terug op zonder-afbeelding als de quota geraakt wordt
  if (!saveLibrary()) {
    if (item.image) {
      item.image = null;
      if (saveLibrary()) {
        renderLibrary();
        toast('Library bijna vol, concept bewaard zonder afbeelding', true);
        return;
      }
    }
    // Zonder afbeelding lukt het ook niet, rol terug
    if (existingIdx >= 0) {
      // Restore is lastig zonder originele snapshot, signaleer alleen
    } else {
      state.library.shift();
    }
    toast('Library is vol, verwijder oudere items en probeer opnieuw', true);
    return;
  }

  renderLibrary();
  const updatedNote = existingIdx >= 0 ? 'Bestaande library-entry bijgewerkt' : 'Bewaard in library';
  toast(imageSnapshot ? `${updatedNote}, concept en afbeelding` : `${updatedNote}, concept zonder afbeelding`);
  try { if (typeof wgCelebrateSave === 'function') wgCelebrateSave(); } catch(e){}
}
function _recipeMaps(){
  return {
    placement: { stories:'Stories 9:16', reels:'Reels 9:16', feed45:'Feed 4:5', feed11:'Feed 1:1' },
    funnel: { tof:'Top of Funnel', mof:'Middle of Funnel', bof:'Bottom of Funnel', retargeting:'Re-targeting', cold:'Cold (oud)', warm:'Warm (oud)' },
    mode: { scratch:'Vanaf nul', copy:'Kopieer van ad', iterate:'Itereren', auto:'Auto' }
  };
}
function buildRecipeHtml(m, v){
  m = m || {}; v = v || {};
  const L = _recipeMaps();
  const rows = [];
  const clean = x => (x !== undefined && x !== null && String(x).trim() !== '' && String(x).toLowerCase() !== 'null');
  const add = (k, val) => { if (clean(val)) rows.push([k, val]); };
  let bundleNames = '';
  if (Array.isArray(m.bundleProductIds) && m.bundleProductIds.length) {
    bundleNames = m.bundleProductIds.map(id => { const p = (state.products||[]).find(x=>x.id===id); return p ? p.name : id; }).join(', ');
  }
  add('Product', m.product);
  if (bundleNames) add('Bundel-producten', bundleNames);
  add('Customer persona', clean(m.personaName) ? m.personaName : 'Geen persona gekozen');
  add('Archetype', m.archetype);
  add('Funnel-fase', L.funnel[m.funnel] || m.funnel);
  add('Plaatsing', L.placement[m.placement] || m.placement);
  add('Market sophistication', m.sophistication);
  add('Customer awareness', m.awareness);
  add('Modus', L.mode[m.mode] || m.mode);
  add('Concept-richting', m.concept);
  add('Offer', m.offer);
  if (clean(v.hook_type) || clean(v.hook_label_nl)) add('Hook', [v.hook_type, v.hook_label_nl].filter(clean).join(' , '));
  if ((m.sourceMode === 'copy' || m.sourceMode === 'iterate') && clean(m.adName)) add('Bron-ad', m.adName);
  const reasoning = v.reasoning_nl || v.reasoning || '';
  let html = '<div class="lib-recipe"><div class="lib-recipe-title">Hoe is deze gemaakt?</div><div class="lib-recipe-grid">';
  html += rows.map(r => `<div class="lib-recipe-row"><span class="lib-recipe-key">${escapeHtml(r[0])}</span><span class="lib-recipe-val">${escapeHtml(String(r[1]))}</span></div>`).join('');
  html += '</div>';
  if (clean(reasoning)) html += `<div class="lib-recipe-reason"><span class="lib-recipe-key">Waarom deze variatie werkt</span><p>${escapeHtml(reasoning)}</p></div>`;
  if (clean(v.hypothese_nl)) html += `<div class="lib-recipe-reason"><span class="lib-recipe-key">Hypothese van deze variant</span><p>${escapeHtml(v.hypothese_nl)}</p></div>`;
  if ((m.sourceMode === 'copy' || m.sourceMode === 'iterate') && clean(m.sourceAdAnalysis)) html += `<div class="lib-recipe-reason"><span class="lib-recipe-key">Analyse bron-ad</span><p>${escapeHtml(m.sourceAdAnalysis)}</p></div>`;
  if (m.sourceMode === 'iterate' && m.iterateAnalysis) {
    const ia = m.iterateAnalysis;
    const iar = (label, val) => clean(val) ? `<div class="lib-recipe-reason"><span class="lib-recipe-key">${escapeHtml(label)}</span><p>${escapeHtml(String(val))}</p></div>` : '';
    const ial = (label, arr) => (Array.isArray(arr) && arr.length) ? `<div class="lib-recipe-reason"><span class="lib-recipe-key">${escapeHtml(label)}</span><ul>${arr.map(x => `<li>${escapeHtml(String(x))}</li>`).join('')}</ul></div>` : '';
    html += `<div class="lib-recipe-reason"><span class="lib-recipe-key">Theriot's iteratieplan, de denkwijze achter deze iteratie</span></div>`;
    html += iar('Cijfer-diagnose', ia.cijfer_diagnose);
    html += iar('Grootste kans', ia.grootste_kans);
    html += iar('Aanpak', ia.aanbevolen_aanpak);
    html += iar('Creatieve richting', ia.creatieve_richting);
    html += ial('Iteratie-hypotheses', ia.iteratie_hypotheses);
    if (Array.isArray(ia.aanbevolen_dimensies) && ia.aanbevolen_dimensies.length) html += iar('Gekozen testdimensies', ia.aanbevolen_dimensies.join(', '));
    html += ial('Vasthouden', ia.vasthouden);
    html += ial('Veilig te testen', ia.veilig_te_testen);
  }
  html += '</div>';
  return html;
}
function buildRecipeChips(m){
  m = m || {}; const L = _recipeMaps(); const chips = [];
  const clean = x => (x && String(x).trim() && String(x).toLowerCase() !== 'null');
  const c = (t) => { if (clean(t)) chips.push(`<span class="lib-chip">${escapeHtml(String(t))}</span>`); };
  if (clean(m.personaName)) c('Persona: ' + m.personaName);
  c(m.archetype);
  c(L.funnel[m.funnel] || m.funnel);
  c(L.mode[m.mode] || m.mode);
  if (clean(m.sophistication)) c('Soph: ' + m.sophistication);
  if (clean(m.awareness)) c('Aware: ' + m.awareness);
  return chips.length ? `<div class="lib-chip-row">${chips.join('')}</div>` : '';
}
/* ===== Rijke Customer Persona's (v5.15): Schwartz-stages + angle-brein + launch + test-hook ===== */
var px = { selectedId:null, stage:'unaware', busy:false, angleStats:{}, statsLoaded:{} };
var PX_STAGES = [['unaware','Onbewust'],['problem','Probleembewust'],['solution','Oplossingsbewust'],['product','Productbewust'],['most','Meest bewust']];
function pxModel(){ var el=document.getElementById('anthropic-model'); return (el&&el.value)||'claude-fable-5'; }
function pxE(t){ return (typeof escapeHtml==='function')?escapeHtml(t==null?'':String(t)):String(t==null?'':t); }
function pxText(data){ var t=''; try{ (data.content||[]).forEach(function(b){ if(b&&b.type==='text') t+=b.text; }); }catch(e){} return t; }
function pxJson(txt){ var a=txt.indexOf('{'),b=txt.lastIndexOf('}'); if(a<0||b<0) throw new Error('geen JSON'); return JSON.parse(txt.substring(a,b+1)); }
function pxBrand(){ return (typeof ACTIVE_BRAND!=='undefined')?ACTIVE_BRAND:'wellshave'; }
function pxSlug(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,32); }

/* ---------- master-detail render (vervangt de oude lijst) ---------- */
function pxRenderTab(){
  var host=document.getElementById('persona-library-list'); if(!host) return;
  var list=(state.personas||[]);
  if(!list.length){ host.innerHTML='<div class="dl-empty-note">Nog geen personas. Klik "Nieuwe persona".</div>'; return; }
  if(!px.selectedId || !list.find(function(p){return p.id===px.selectedId;})) px.selectedId=list[0].id;
  var rows=list.map(function(p){
    var on=p.id===px.selectedId;
    var init=(p.name||'?').trim().charAt(0).toUpperCase();
    var sub=(p.name&&p.name.indexOf(',')>-1)?p.name.split(',').slice(1).join(',').trim():(p.category||'');
    return '<div class="px-row'+(on?' on':'')+'" onclick="pxSelect(\''+p.id+'\')"><div class="px-av">'+pxE(init)+'</div><div class="px-row-txt"><div class="px-row-name">'+pxE((p.name||'').split(',')[0])+'</div><div class="px-row-sub">'+pxE(sub)+'</div></div></div>';
  }).join('');
  host.innerHTML='<div class="px-split"><div class="px-list">'+rows+'</div><div class="px-detail" id="px-detail"></div></div>';
  pxRenderDetail();
}
function pxSelect(id){ px.selectedId=id; px.stage='unaware'; pxRenderDetail(); }

function pxRenderDetail(){
  var el=document.getElementById('px-detail'); if(!el) return;
  var p=(state.personas||[]).find(function(x){return x.id===px.selectedId;}); if(!p){ el.innerHTML=''; return; }
  var enriched=!!(p.stages && Object.keys(p.stages).length);
  var nmeta=p.name||'';
  var arche=(nmeta.indexOf(',')>-1)?nmeta.split(',').slice(1).join(',').trim():'';
  var attr=function(k,v){ return '<div class="px-attr"><div class="px-attr-k">'+pxE(k)+'</div><div class="px-attr-v">'+pxE(v||'—')+'</div></div>'; };
  var listBlock=function(title,arr,cls){ arr=(arr||[]).filter(Boolean); if(!arr.length) return ''; return '<div class="px-lb"><div class="px-lb-t '+(cls||'')+'">'+pxE(title)+'</div><ul>'+arr.map(function(x){return '<li>'+pxE(x)+'</li>';}).join('')+'</ul></div>'; };
  var h='';
  h+='<div class="px-head"><div class="px-av big">'+pxE((p.name||'?').charAt(0).toUpperCase())+'</div><div><div class="px-name">'+pxE((p.name||'').split(',')[0])+(arche?' <span class="px-arche">, '+pxE(arche)+'</span>':'')+'</div><div class="px-role">'+pxE([p.age,p.job].filter(Boolean).join(' · ')||p.category||'')+'</div></div>';
  h+='<button class="btn btn-small btn-ghost" style="margin-left:auto;" onclick="openPersonaModal(); loadPersonaToForm(\''+p.id+'\')">Bewerk</button>';
  h+='<button class="btn btn-small" onclick="pxEnrich(\''+p.id+'\')">'+(enriched?'Opnieuw verrijken':'Verrijk met Rory')+'</button></div>';
  if(p.quote) h+='<div class="px-quote">'+pxE(p.quote)+'</div>';
  if(p.description && !p.quote) h+='<div class="px-quote">'+pxE(p.description)+'</div>';
  // attributen-grid
  h+='<div class="px-attr-grid">'
    + attr('Leeftijd',p.age) + attr('Woonplaats',p.city) + attr('Beroep',p.job||p.category)
    + attr('Categorie',p.category) + attr('Marktaandeel',p.market_share) + attr('Awareness',(Array.isArray(p.recAwareness)?p.recAwareness.map(function(a){return a;}).join(' · '):''))
    + attr('Sophistication',p.sophistication_note || (p.recSoph?('Stadium '+p.recSoph):'')) + attr('Koopmotief',p.buying_motive)
    + '</div>';
  // lijsten
  h+='<div class="px-cols">'
    + '<div>'+listBlock('Wensen',p.desires)+listBlock('Pijnpunten & angsten',p.pains,'red')+listBlock('Bezwaren',p.objections)+'</div>'
    + '<div>'+listBlock('Mislukte alternatieven',p.failed_alternatives)+listBlock('Voordelen voor hem',p.benefits,'green')+'</div>'
    + '</div>';
  // Schwartz-stages
  if(!enriched){
    h+='<div class="px-empty">Deze persona heeft nog geen awareness-stages met angles. Klik <b>Verrijk met Rory</b> hierboven, dan bouwt Rory de 5 Schwartz-stages met marketing-angles op uit de pijnen, wensen, bezwaren en sophistication.</div>';
  } else {
    h+='<div class="px-stages-lbl">5 Schwartz-stages · elk met marketing-angles</div>';
    h+='<div class="px-tabs">'+PX_STAGES.map(function(st){ return '<button class="px-tab'+(px.stage===st[0]?' on':'')+'" onclick="pxSetStage(\''+st[0]+'\')">'+st[1]+'</button>'; }).join('')+'</div>';
    var sd=p.stages[px.stage]||{};
    if(sd.mindset) h+='<div class="px-mindset"><b>Mindset:</b> '+pxE(sd.mindset)+'</div>';
    var angles=sd.angles||[];
    h+='<div class="px-angles">'+angles.map(function(a){ return pxAngleCard(p,px.stage,a); }).join('')+'</div>';
  }
  el.innerHTML=h;
  // teststatus async laden
  if(enriched && !px.statsLoaded[p.id]) pxLoadStatus(p);
}
function pxSetStage(st){ px.stage=st; pxRenderDetail(); }

function pxAngleCard(p,stage,a){
  var stat=px.angleStats[a.id];
  var statHtml = stat===undefined ? '<span class="px-stat load">…</span>'
    : (stat.n>0 ? ('<span class="px-stat '+(stat.winner?'win':'test')+'">'+(stat.winner?'winner':stat.n+'x getest')+(stat.best!=null?(' · ROAS '+stat.best):'')+'</span>') : '<span class="px-stat none">nog niet getest</span>');
  return '<div class="px-angle">'
    + '<div class="px-angle-raakt">RAAKT: '+pxE(a.raakt||'')+'</div>'
    + '<div class="px-angle-title">'+pxE(a.title||'')+'</div>'
    + '<div class="px-angle-desc">'+pxE(a.desc||'')+'</div>'
    + (a.removes?'<div class="px-angle-rem"><b>Neemt bezwaar weg:</b> '+pxE(a.removes)+'</div>':'')
    + '<div class="px-angle-foot">'+statHtml+'<button class="px-angle-cta" onclick="pxNewAd(\''+p.id+'\',\''+stage+'\',\''+a.id+'\')">&rarr; Nieuwe ad</button></div>'
    + '</div>';
}

/* ---------- angle-brein: Rory genereert stages + rijke velden ---------- */
function pxEnrich(id){
  var p=(state.personas||[]).find(function(x){return x.id===id;}); if(!p||px.busy) return;
  px.busy=true;
  var el=document.getElementById('px-detail'); if(el) el.insertAdjacentHTML('afterbegin','<div class="px-loading" id="px-loading">Rory verrijkt '+pxE((p.name||'').split(',')[0])+' met stages en angles...</div>');
  var voc=(typeof brandProfileBlock==='function')?brandProfileBlock():'';
  var sys='Je bent Rory Sutherland. Je bouwt een DIEP customer-persona-profiel voor een direct-response-adverteerder (merk '+(typeof BRAND_NAME_UC!=='undefined'?BRAND_NAME_UC:'Wellshave')+'). Je krijgt de bestaande persona-basis. Vul de rijke identiteit aan EN bouw de 5 Schwartz-awareness-stages, elk met een korte mindset en 3 tot 5 marketing-angles. Elke angle heeft: een titel (de invalshoek), "raakt" (de emotie die hij raakt, kort), "desc" (1 zin wat de angle doet), en "removes" (het concrete bezwaar dat hij wegneemt). Angles moeten aansluiten op de sophistication (bij hoog: mechanisme en bewijs, geen kale claims) en op de echte pijn/taal van de persona. Antwoord met UITSLUITEND strict JSON:\n{"quote":"defining quote in de ik-vorm","age":"","city":"","job":"","market_share":"bv ~25%","buying_motive":"","sophistication_note":"korte uitleg van het sophistication-stadium","failed_alternatives":["..."],"benefits":["..."],"stages":{"unaware":{"mindset":"","angles":[{"title":"","raakt":"","desc":"","removes":""}]},"problem":{"mindset":"","angles":[...]},"solution":{"mindset":"","angles":[...]},"product":{"mindset":"","angles":[...]},"most":{"mindset":"","angles":[...]}}}';
  var usr='PERSONA-BASIS:\nNaam: '+(p.name||'')+'\nCategorie: '+(p.category||'')+'\nBeschrijving: '+(p.description||'')+'\nPijnpunten: '+((p.pains||[]).filter(Boolean).join(' | '))+'\nWensen: '+((p.desires||[]).filter(Boolean).join(' | '))+'\nBezwaren: '+((p.objections||[]).filter(Boolean).join(' | '))+'\nSophistication: '+(p.recSoph||'bepaal zelf, grooming is doorgaans 3-4')+'\n\nGeef het volledige JSON-profiel.';
  fetchJsonWithRetry((PROXY_BASE+'/anthropic'),{
    method:'POST', headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model: pxModel(), max_tokens: 4000, system: sys+voc, messages:[{role:'user',content:usr}] })
  }).then(function(data){
    var o=pxJson(pxText(data));
    var pp=(state.personas||[]).find(function(x){return x.id===id;})||p; /* her-vind: team-sync kan state.personas tussentijds hebben vervangen */
    ['quote','age','city','job','market_share','buying_motive','sophistication_note'].forEach(function(k){ if(o[k]) pp[k]=o[k]; });
    if(Array.isArray(o.failed_alternatives)) pp.failed_alternatives=o.failed_alternatives;
    if(Array.isArray(o.benefits)) pp.benefits=o.benefits;
    // stages + stabiele angle-ids
    var stages={};
    ['unaware','problem','solution','product','most'].forEach(function(sk){
      var sd=(o.stages&&o.stages[sk])||{}; var angles=(sd.angles||[]).map(function(a,i){
        return { id:'ang-'+pp.id+'-'+sk+'-'+(i+1), title:a.title||'', raakt:a.raakt||'', desc:a.desc||'', removes:a.removes||'' };
      });
      stages[sk]={ mindset:sd.mindset||'', angles:angles };
    });
    pp.stages=stages;
    if(px.statsLoaded) delete px.statsLoaded[pp.id];
    if(typeof savePersonas==='function') savePersonas();
    px.busy=false; pxRenderDetail();
    if(typeof toast==='function') toast((p.name||'Persona').split(',')[0]+' verrijkt met stages en angles');
  }).catch(function(err){
    px.busy=false; var l=document.getElementById('px-loading'); if(l) l.textContent='Verrijken mislukt: '+err.message;
    if(typeof toast==='function') toast('Verrijken mislukt: '+err.message,true);
  });
}

/* ---------- teststatus per angle uit creatives ---------- */
function pxLoadStatus(p){
  var sb=window._sb;
  var ids=[]; ['unaware','problem','solution','product','most'].forEach(function(sk){ ((p.stages&&p.stages[sk]&&p.stages[sk].angles)||[]).forEach(function(a){ ids.push(a.id); if(px.angleStats[a.id]===undefined) px.angleStats[a.id]={n:0,best:null,winner:false}; }); });
  if(!sb||!window._authProfile){ px.statsLoaded[p.id]=true; pxRenderStatuses(); return; }
  sb.from('creatives').select('angle_id,roas,status').eq('brand',pxBrand()).in('angle_id',ids).limit(1000)
    .then(function(r){
      ((r&&r.data)||[]).forEach(function(row){ var st=px.angleStats[row.angle_id]; if(!st) return; st.n++; if(row.roas!=null&&(st.best==null||row.roas>st.best)) st.best=row.roas; if(row.status==='Winner') st.winner=true; });
      px.statsLoaded[p.id]=true; pxRenderStatuses();
    }).catch(function(){ px.statsLoaded[p.id]=true; pxRenderStatuses(); });
}
function pxRenderStatuses(){ if(document.getElementById('px-detail')) pxRenderDetail(); }

/* ---------- launch: vraag per keer (snel vs diep) ---------- */
function pxNewAd(personaId,stage,angleId){
  var p=(state.personas||[]).find(function(x){return x.id===personaId;}); if(!p) return;
  var sd=(p.stages&&p.stages[stage])||{}; var a=(sd.angles||[]).find(function(x){return x.id===angleId;}); if(!a) return;
  window._pxAngleContext={ persona_id:personaId, persona_name:(p.name||''), stage:stage, angle_id:angleId, angle_title:a.title, raakt:a.raakt, removes:a.removes };
  var ov=document.createElement('div'); ov.id='px-choice'; ov.className='px-choice-ov';
  ov.innerHTML='<div class="px-choice"><div class="px-choice-t">Ad maken vanuit deze angle</div><div class="px-choice-s">"'+pxE(a.title)+'" voor '+pxE((p.name||'').split(',')[0])+'</div>'
    + '<button class="iw-start" onclick="pxLaunch(\'diep\')">Diep interview met Rory</button>'
    + '<button class="iw-start" style="background:rgba(26, 22, 14, 0.092);color:#856b33;margin-top:8px;" onclick="pxLaunch(\'snel\')">Snelle generator, meteen 3 statics</button>'
    + '<button class="px-choice-x" onclick="var e=document.getElementById(\'px-choice\'); if(e)e.remove();">Annuleren</button></div>';
  document.body.appendChild(ov);
}
function pxLaunch(mode){
  var e=document.getElementById('px-choice'); if(e) e.remove();
  var ctx=window._pxAngleContext; if(!ctx) return;
  var p=(state.personas||[]).find(function(x){return x.id===ctx.persona_id;});
  var awMap={unaware:'unaware',problem:'problem',solution:'solution',product:'product',most:'most'};
  if(mode==='diep'){
    if(typeof iwOpen==='function'){
      iwOpen();
      // pre-seed: persona-ingang + de angle als startcontext
      try{
        iw.entrance='persona';
        setTimeout(function(){
          var pe=document.getElementById('iw-persona'); if(pe){ pe.value=ctx.persona_id; }
          var pr=document.getElementById('iw-product'); // laat op default
          iw.persona=p; iw.angle='Startangle uit persona ('+ctx.stage+'): '+ctx.angle_title+'. Raakt: '+ctx.raakt+'. Weg te nemen bezwaar: '+ctx.removes;
          iw.entrance='persona';
          iwStart();
        },60);
      }catch(err){}
    }
    return;
  }
  // snel: generator prefillen
  if(typeof switchMainTab==='function') switchMainTab('generator');
  setTimeout(function(){
    var pse=document.getElementById('persona-select'); if(pse&&p){ pse.value=p.id; pse.dispatchEvent(new Event('change',{bubbles:true})); }
    var awe=document.getElementById('awareness-select'); if(awe&&awMap[ctx.stage]) awe.value=awMap[ctx.stage];
    var conc=document.getElementById('concept-input'); if(conc){ conc.value='ANGLE (uit persona '+(ctx.persona_name||'').split(',')[0]+', '+ctx.stage+'): '+ctx.angle_title+'\nRAAKT (emotie): '+ctx.raakt+'\nNEEMT BEZWAAR WEG: '+ctx.removes; }
    if(typeof toast==='function') toast('Angle in de generator gezet, pas aan of genereer');
    var g=document.getElementById('main-tab-generator'); if(g) g.scrollIntoView({behavior:'smooth'});
  },80);
}

/* ---------- test-hook: gegenereerde static taggen met angle_id in creatives ---------- */
function pxTagCreative(item){
  var ctx=(state.lastGenerated && state.lastGenerated._pxAngle) || window._pxAngleContext; if(!ctx||!ctx.angle_id) return;
  var sb=window._sb; if(!sb||!window._authProfile||!window._authProfile.id) return;
  if(typeof window._userRole!=='undefined' && window._userRole==='guest') return;
  var v=(item&&item.variation)||{}; var m=(item&&item.metadata)||{};
  /* Alles wat het bibliotheekitem weet gaat mee, inclusief zijn id.

     Hiervoor schreef deze functie alleen de naam en de hoek weg: het beeld en
     de copy bleven achter in de bibliotheek-blob, en de rij in Creative
     Strategy was een stub waar je niet aan kon zien wélke advertentie het was.
     Dat is precies wat er met de drie Google Search-varianten gebeurde.

     De koppeling is het id en niet de kop. Twee varianten uit één generatie
     kunnen dezelfde kop hebben; hun id nooit. */
  var row={ brand:pxBrand(), user_id:window._authProfile.id, user_email:window._authProfile.email||null, user_name:window._authProfile.full_name||window._authProfile.email||null,
    ad_name:v.headline_nl||ctx.angle_title||'Static', product:m.product||null, persona:ctx.persona_name||null,
    marketing_angle:ctx.angle_title||null, awareness_level:ctx.stage||null, angle_id:ctx.angle_id,
    bibliotheek_id:(item&&item.id)||null,
    batch_id:(item&&item.batch_id)||null,
    variant_index:(item&&item.variant_index!=null)?item.variant_index:null,
    headline:v.headline_nl||null, body_copy:v.body_copy_nl||null, cta:v.cta_nl||null,
    visual_concept:v.visual_nl||null, image_prompt:v.image_prompt_en||null,
    creative_concept:v.visual_nl||m.concept||null,
    format:m.format||(item&&item.batch_title)||null,
    image_b64:(item&&item.image)||null,
    media_type:'Static', source_type:'static',
    /* De status komt uit creative_statussen en niet uit een woord hier: sinds
       0030 weigert de database een status die hij niet kent. */
    status: (typeof csStatusBeginwaarde === 'function' ? csStatusBeginwaarde() : null) };
  var doIns=function(r2){ sb.from('creatives').insert(r2).then(function(r){
    if(r&&r.error){ if(/column|schema cache/i.test(r.error.message)&&r2.angle_id!==undefined){ var c=Object.assign({},r2); delete c.angle_id; doIns(c); return; } }
  }).catch(function(){}); };
  doIns(row);
}

function renderPersonaLibrary(){
  if (typeof pxRenderTab === 'function') { pxRenderTab(); return; }
  const el = document.getElementById('persona-library-list');
  if (!el) return;
  const personas = state.personas || [];
  if (!personas.length){ el.innerHTML = '<div class="dl-empty-note">Nog geen personas. Klik "Nieuwe persona" om er een toe te voegen.</div>'; return; }
  const grouped = {};
  personas.forEach(per => { const c = per.category || 'Overig'; (grouped[c] = grouped[c] || []).push(per); });
  let html = '';
  Object.keys(grouped).sort().forEach(cat => {
    html += `<div class="dl-cat">${escapeHtml(cat)} <span>(${grouped[cat].length})</span></div><div class="dl-grid">`;
    grouped[cat].forEach(per => {
      const aware = (Array.isArray(per.recAwareness) ? per.recAwareness : []).map(a => escapeHtml(awarenessLabelNL(a))).join(', ');
      const lists = [['Pijnpunten', per.pains], ['Wensen', per.desires], ['Bezwaren', per.objections]].map(pair => {
        const arr = Array.isArray(pair[1]) ? pair[1].filter(Boolean) : [];
        return `<div class="dl-sub"><div class="dl-sub-t">${pair[0]} (${arr.length})</div>${arr.length ? ('<ul>' + arr.map(x => `<li>${escapeHtml(x)}</li>`).join('') + '</ul>') : '<div class="dl-empty">geen</div>'}</div>`;
      }).join('');
      const chips = [];
      if (per.recSoph) chips.push(`<span class="dl-chip">Sophistication ${escapeHtml(String(per.recSoph))}</span>`);
      if (aware) chips.push(`<span class="dl-chip">Awareness ${aware}</span>`);
      html += `
      <div class="dl-card">
        <div class="dl-card-head">
          <div class="dl-card-name">${escapeHtml(per.name || '(naamloos)')}</div>
          <button class="btn btn-small btn-ghost" onclick="openPersonaModal(); loadPersonaToForm('${escapeAttr(per.id)}')">Bewerk</button>
        </div>
        ${per.description ? `<div class="dl-desc">${escapeHtml(per.description)}</div>` : ''}
        ${chips.length ? `<div class="dl-chips">${chips.join('')}</div>` : ''}
        <div class="dl-cols">${lists}</div>
      </div>`;
    });
    html += '</div>';
  });
  el.innerHTML = html;
}
function renderProductLibrary(){
  const el = document.getElementById('product-library-list');
  if (!el) return;
  const products = state.products || [];
  if (!products.length){ el.innerHTML = '<div class="dl-empty-note">Nog geen producten. Klik "Nieuw product" om er een toe te voegen.</div>'; return; }
  const grouped = {};
  products.forEach(p => { const c = p.category || 'Overig'; (grouped[c] = grouped[c] || []).push(p); });
  let html = '';
  Object.keys(grouped).sort().forEach(cat => {
    html += `<div class="dl-cat">${escapeHtml(cat)} <span>(${grouped[cat].length})</span></div><div class="dl-grid">`;
    grouped[cat].forEach(p => {
      const usps = (p.usps || []).filter(Boolean);
      const kv = [];
      const add = (k, v) => { if (v && String(v).trim()) kv.push(`<div class="dl-kv-row"><span class="dl-kv-k">${k}</span><span class="dl-kv-v">${escapeHtml(String(v))}</span></div>`); };
      add('Prijs', p.price);
      add('Doelgroep', p.target);
      const refs = p.references || {};
      let refHtml = '';
      [['Product', refs.product], ['Lifestyle', refs.lifestyle], ['Packaging', refs.packaging]].forEach(g => {
        const arr = Array.isArray(g[1]) ? g[1].filter(Boolean) : [];
        if (arr.length) refHtml += `<div class="dl-ref-group-t">${g[0]} (${arr.length})</div><div class="dl-refs">` + arr.map(r => `<div class="dl-ref-thumb" style="background-image:url('${escapeAttr(r)}')"></div>`).join('') + '</div>';
      });
      html += `
      <div class="dl-card">
        <div class="dl-card-head">
          <div class="dl-card-name">${escapeHtml(p.name || '(naamloos)')}</div>
          <button class="btn btn-small btn-ghost" onclick="openProductModal(); loadProductToForm('${escapeAttr(p.id)}')">Bewerk</button>
        </div>
        ${kv.length ? `<div class="dl-kv">${kv.join('')}</div>` : ''}
        ${usps.length ? `<div class="dl-sub-t">USP's</div><ul class="dl-usps">${usps.map(u => `<li>${escapeHtml(u)}</li>`).join('')}</ul>` : ''}
        ${p.appearance ? `<div class="dl-sub-t">Uiterlijk</div><div class="dl-desc">${escapeHtml(p.appearance)}</div>` : ''}
        ${p.forbidden ? `<div class="dl-sub-t">Verboden elementen</div><div class="dl-desc">${escapeHtml(p.forbidden)}</div>` : ''}
        ${refHtml ? `<div class="dl-sub-t" style="margin-top:6px;">Referentiefoto's</div>${refHtml}` : ''}
      </div>`;
    });
    html += '</div>';
  });
  el.innerHTML = html;
}
// ============================================================
// BACK-UP / EXPORT per merk (v4.37)
// ============================================================
const BRAND_DISPLAY = { wellshave: 'Wellshave', wellshine: 'Wellshine' };

function brandStorageSnapshot() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(STORAGE_PREFIX) === 0) data[key] = localStorage.getItem(key);
    }
  } catch (e) {}
  return data;
}

function updateExportStats() {
  const label = document.getElementById('export-brand-label');
  if (label) label.textContent = BRAND_DISPLAY[ACTIVE_BRAND] || ACTIVE_BRAND;
  const stats = document.getElementById('export-stats');
  if (!stats) return;
  const lib = (state.library || []).length;
  const prods = (state.products || []).length;
  const pers = (state.personas || []).length;
  stats.textContent = `${prods} producten , ${pers} persona's , ${lib} bewaarde concepten`;
}

function exportBrandData() {
  const snapshot = brandStorageSnapshot();
  const backup = {
    type: 'wellgroup-ad-generator-backup',
    schema: 1,
    brand: ACTIVE_BRAND,
    brand_display: BRAND_DISPLAY[ACTIVE_BRAND] || ACTIVE_BRAND,
    storage_prefix: STORAGE_PREFIX,
    app_version: (typeof CHANGELOG !== 'undefined' && CHANGELOG[0] ? CHANGELOG[0].version : ''),
    exported_at: new Date().toISOString(),
    counts: { producten: (state.products || []).length, personas: (state.personas || []).length, bibliotheek: (state.library || []).length },
    storage: snapshot
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = ACTIVE_BRAND + '-ad-generator-backup-' + stamp + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  toast('Back-up geexporteerd');
}

function importBrandData(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    let backup;
    try { backup = JSON.parse(e.target.result); } catch (err) { toast('Geen geldig back-up bestand', true); return; }
    if (!backup || backup.type !== 'wellgroup-ad-generator-backup' || !backup.storage) { toast('Dit is geen geldige Ad Generator back-up', true); return; }
    const fromBrand = BRAND_DISPLAY[backup.brand] || backup.brand;
    const toBrand = BRAND_DISPLAY[ACTIVE_BRAND] || ACTIVE_BRAND;
    let msg = 'Back-up importeren overschrijft alle huidige data van merk ' + toBrand + ' (bibliotheek, persona\'s, producten, instellingen).';
    if (backup.brand && backup.brand !== ACTIVE_BRAND) {
      msg += '\n\nLET OP: deze back-up komt van merk ' + fromBrand + ', maar je staat nu op ' + toBrand + '. De data wordt naar het huidige merk geschreven. Doorgaan?';
    } else {
      msg += '\n\nDoorgaan?';
    }
    if (!window.confirm(msg)) return;
    try {
      // bestaande merk-keys wissen, dan back-up terugzetten (keys uit de back-up hernoemen naar het huidige prefix)
      const oldPrefix = backup.storage_prefix || STORAGE_PREFIX;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(STORAGE_PREFIX) === 0) toRemove.push(k); }
      toRemove.forEach(function(k){ localStorage.removeItem(k); });
      Object.keys(backup.storage).forEach(function(k){
        const newKey = (oldPrefix && k.indexOf(oldPrefix) === 0) ? (STORAGE_PREFIX + k.slice(oldPrefix.length)) : k;
        localStorage.setItem(newKey, backup.storage[k]);
      });
      toast('Back-up geimporteerd, pagina wordt herladen');
      setTimeout(function(){ location.reload(); }, 900);
    } catch (err) {
      toast('Importeren mislukt: ' + err.message, true);
    }
  };
  reader.readAsText(file);
}

// Filteren in de bibliotheek (v4.38)
function libModeLabel(m) {
  const map = { 'auto': 'Auto', 'direct-response': 'Direct-Response', 'brand-builder': 'Brand-Builder', 'feature-education': 'Feature-Education', 'bundle-showcase': 'Bundle-Showcase', 'lifestyle-placement': 'Lifestyle-Placement', 'advertorial-news': 'Nieuwsartikel' };
  return map[m] || m;
}
function setLibFilter(key, value) {
  if (!state.libFilter) state.libFilter = { funnel: '', product: '', mode: '' };
  state.libFilter[key] = value;
  renderLibrary();
}
function resetLibFilter() {
  state.libFilter = { funnel: '', product: '', mode: '' };
  renderLibrary();
}
function buildLibFilterBar(products, modes, shown, total, f) {
  const funnels = [['', 'Alle'], ['tof', 'TOF'], ['mof', 'MOF'], ['bof', 'BOF'], ['retargeting', 'Re-targeting']];
  let h = '<div class="lib-filter-bar">';
  h += '<div class="lib-filter-group">';
  funnels.forEach(function(fl){ h += '<button type="button" class="lib-filter-pill' + (((f.funnel || '') === fl[0]) ? ' active' : '') + '" onclick="setLibFilter(\'funnel\', \'' + fl[0] + '\')">' + fl[1] + '</button>'; });
  h += '</div>';
  h += '<select class="lib-filter-select" onchange="setLibFilter(\'product\', this.value)"><option value="">Alle producten</option>' + products.map(function(p){ return '<option value="' + escapeAttr(p) + '"' + (f.product === p ? ' selected' : '') + '>' + escapeHtml(p) + '</option>'; }).join('') + '</select>';
  if (modes.length) h += '<select class="lib-filter-select" onchange="setLibFilter(\'mode\', this.value)"><option value="">Alle modes</option>' + modes.map(function(m){ return '<option value="' + escapeAttr(m) + '"' + (f.mode === m ? ' selected' : '') + '>' + escapeHtml(libModeLabel(m)) + '</option>'; }).join('') + '</select>';
  h += '<span class="lib-filter-count">' + shown + ' van ' + total + '</span>';
  if (f.funnel || f.product || f.mode) h += '<button type="button" class="btn btn-small btn-ghost" onclick="resetLibFilter()">Wissen</button>';
  h += '</div>';
  return h;
}

function libExtraHtml(v){
  v = v || {};
  const esc = s => escapeHtml(String(s || ''));
  const parts = [];
  if (v.visual_nl) parts.push(`<div><b>Visual:</b> ${esc(v.visual_nl)}</div>`);
  if (v.hypothese_nl) parts.push(`<div><b>Rory&#39;s hypothese:</b> ${esc(v.hypothese_nl)}</div>`);
  const reasoning = v.reasoning_nl || v.reasoning || '';
  if (reasoning) parts.push(`<div><b>Rory&#39;s reasoning:</b> ${esc(reasoning)}</div>`);
  if (!parts.length) return '';
  return `<details class="lib-extra"><summary>Visual, hypothese &amp; reasoning</summary><div class="lib-extra-body">${parts.join('')}</div></details>`;
}
function libMatrixHtml(id, mat, m){
  mat = mat || {}; m = m || {};
  const va = x => escapeAttr(String(x == null ? '' : x));
  const tx = (field, label, val) => `<label>${label}<textarea data-matrix-id="${id}" data-matrix-field="${field}" rows="2">${escapeHtml(String(val || ''))}</textarea></label>`;
  const inp = (field, label, val) => `<label>${label}<input type="text" data-matrix-id="${id}" data-matrix-field="${field}" value="${va(val)}"></label>`;
  return `<details class="lib-matrix"><summary>Static ad matrix (Theriot-scorecard)</summary><div class="lib-matrix-grid">`
    + tx('hook', 'Hook', mat.hook)
    + tx('proof', 'Proof / bewijs', mat.proof)
    + tx('avatar', 'Avatar / Desire', mat.avatar)
    + tx('purplecow', 'Purple Cow', mat.purplecow)
    + inp('sophistication', 'Market sophistication', mat.sophistication != null && mat.sophistication !== '' ? mat.sophistication : (m.sophistication || ''))
    + inp('awareness', 'Customer awareness', mat.awareness != null && mat.awareness !== '' ? mat.awareness : (m.awareness || ''))
    + inp('score', 'Score (1-5)', mat.score)
    + tx('notes', 'Notities / resultaat', mat.notes)
    + `</div></details>`;
}
function iterateFromLibrary(item){
  if (!item) return;
  if (typeof switchMainTab === 'function') switchMainTab('generator');
  if (typeof setMode === 'function') setMode('iterate');
  if (item.image && item.image.b64){
    state.sourceAd = { b64: item.image.b64, mimeType: item.image.mime || 'image/png', fileName: 'library-' + item.id + '.png', size: 0, uploadedAt: Date.now() };
    if (typeof renderSourceAdPreview === 'function') renderSourceAdPreview();
  }
  const m = item.metadata || {};
  const ps = document.getElementById('product-select');
  if (ps && m.product){
    for (let oi = 0; oi < ps.options.length; oi++){ if (ps.options[oi].textContent.trim() === m.product || ps.options[oi].value === m.product){ ps.value = ps.options[oi].value; break; } }
    if (typeof renderProductPreview === 'function') renderProductPreview();
    if (typeof renderPersonaSelect === 'function') renderPersonaSelect();
  }
  const persSel = document.getElementById('persona-select');
  if (persSel && m.personaName){ for (let pi = 0; pi < persSel.options.length; pi++){ if (persSel.options[pi].textContent.trim() === m.personaName){ persSel.value = persSel.options[pi].value; break; } } }
  const ci = document.getElementById('concept-input');
  if (ci) ci.value = m.concept ? m.concept : '';
  const pl = document.getElementById('placement-select');
  if (pl && m.placement){ pl.value = m.placement; if (typeof renderPlacementPreview === 'function') renderPlacementPreview(); }
  if (typeof toast === 'function') toast('Creative geladen in itereren, vul de cijfers in en analyseer');
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e){}
}
/* ===== Bibliotheek: concept-groepering (v5.11) ===== */
function libCardHtml(item){
  const d = new Date(item.saved_at);
  const dateStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const hasImage = !!(item.image && item.image.b64);
  const imgMime = (item.image && item.image.mime) ? item.image.mime : 'image/png';
  const v = item.variation || {};
  const m = item.metadata || {};
  const mat = item.matrix || {};
  const imgHtml = hasImage
    ? `<img class="lib-card-img" src="data:${imgMime};base64,${item.image.b64}" alt="Bewaarde afbeelding">`
    : `<div class="lib-card-img-empty">Geen afbeelding bewaard</div>`;
  const bodyHtml = v.body_copy_nl ? `<div class="lib-body">${escapeHtml(v.body_copy_nl)}</div>` : '';
  const ctaTxt = v.cta_nl ? ` , CTA: ${escapeHtml(v.cta_nl)}` : '';
  return `
      <div class="library-item">
        <div class="lib-card-image">${imgHtml}</div>
        <div class="lib-card-body">
          <div class="tag-row">
            <span class="var-hook-tag" style="font-size: 10px; padding: 4px 8px;">${escapeHtml(v.hook_type || 'concept')}</span>
            <span>${dateStr}</span>
          </div>
          <div class="lib-title">${escapeHtml(v.headline_nl || '(geen headline)')}</div>
          ${bodyHtml}
          <div class="lib-meta">${escapeHtml(m.product || '')} , ${escapeHtml(String(m.funnel || ''))} , ${escapeHtml(String(m.archetype || ''))}${ctaTxt}</div>
          ${buildRecipeChips(m)}
          ${libExtraHtml(v)}
          ${libMatrixHtml(item.id, mat, m)}
          <div class="lib-actions">
            <button class="btn btn-small" data-action="view" data-id="${item.id}">Bekijk in generator</button>
            <button class="btn btn-small" data-action="iterate" data-id="${item.id}">Itereer op deze</button>
            <button class="btn btn-small btn-ghost" data-action="copy-prompt" data-id="${item.id}">Kopieer prompt</button>
            ${hasImage ? `<button class="btn btn-small btn-ghost" data-action="download" data-id="${item.id}">Download beeld</button>` : ''}
            <button class="btn btn-small btn-ghost btn-danger" data-action="delete" data-id="${item.id}">×</button>
          </div>
        </div>
      </div>
    `;
}

function libGroupKey(item){
  if (item.batch_id) return 'b:' + item.batch_id;
  var m = item.metadata || {};
  if (m.concept && String(m.concept).trim()) return 'c:' + String(m.concept).trim();
  return 'i:' + item.id;
}
function libGroupTitle(item){
  if (item.batch_title) return item.batch_title;
  var m = item.metadata || {};
  if (m.concept && String(m.concept).trim()) return String(m.concept).replace(/^HOEK[^:]*:\s*/i, '').split('\n')[0].slice(0, 90);
  return (m.product ? (m.product + ' , concept') : 'Concept');
}
function libRenderGroups(filtered){
  var order=[], groups={};
  filtered.forEach(function(item){ var bid=libGroupKey(item); if(!groups[bid]){ groups[bid]=[]; order.push(bid); } groups[bid].push(item); });
  return order.map(function(bid){
    var members=groups[bid];
    if(members.length<=1) return libCardHtml(members[0]);
    var title=libGroupTitle(members[0]);
    var thumbs=members.slice(0,3).map(function(it){ return (it.image&&it.image.b64) ? '<img src="data:'+((it.image.mime)||'image/png')+';base64,'+it.image.b64+'">' : '<span class="lib-g-noimg"></span>'; }).join('');
    var d=new Date(members[0].saved_at); var dateStr=d.toLocaleDateString('nl-NL',{day:'numeric',month:'short',year:'numeric'});
    var m0=members[0].metadata||{};
    var chips='<span class="lib-g-chip">'+escapeHtml(m0.product||'')+'</span>'+(m0.funnel?'<span class="lib-g-chip">'+escapeHtml(String(m0.funnel))+'</span>':'');
    return '<div class="lib-group" data-batch="'+escapeHtml(String(bid))+'">'
      + '<div class="lib-group-head" onclick="toggleLibGroup(this)">'
      + '<div class="lib-g-thumbs">'+thumbs+'</div>'
      + '<div class="lib-g-info"><div class="lib-g-title">'+escapeHtml(title)+'</div><div class="lib-g-sub">'+members.length+' varianten &middot; zelfde boodschap &middot; '+dateStr+'</div><div class="lib-g-chips">'+chips+'</div></div>'
      + '<div class="lib-g-chev">&#9662;</div>'
      + '</div>'
      + '<div class="lib-group-body" style="display:none;">'+members.map(libCardHtml).join('')+'</div>'
      + '</div>';
  }).join('');
}

function toggleLibGroup(head){
  var b=head.parentNode.querySelector('.lib-group-body'); if(!b) return;
  var open=b.style.display!=='none';
  b.style.display=open?'none':'';
  head.classList.toggle('open',!open);
}

function renderLibrary() {
  updateExportStats();
  const lib = document.getElementById('library');
  if (state.library.length === 0) {
    lib.innerHTML = '<div class="library-empty">Nog niets bewaard. Klik op "Bewaar concept" bij een variatie om hem hier op te slaan.</div>';
    return;
  }
  if (!state.libFilter) state.libFilter = { funnel: '', product: '', mode: '' };
  const f = state.libFilter;
  const products = []; const modes = [];
  state.library.forEach(function(it){ const m = it.metadata || {}; if (m.product && products.indexOf(m.product) === -1) products.push(m.product); if (m.mode && modes.indexOf(m.mode) === -1) modes.push(m.mode); });
  products.sort(); modes.sort();
  const filtered = state.library.filter(function(it){
    const m = it.metadata || {};
    return (!f.funnel || String(m.funnel || '') === f.funnel) && (!f.product || m.product === f.product) && (!f.mode || String(m.mode || '') === f.mode);
  });
  let html = buildLibFilterBar(products, modes, filtered.length, state.library.length, f);
  if (filtered.length === 0) {
    html += '<div class="library-empty">Geen concepten voor deze filter. <button class="btn btn-small btn-ghost" onclick="resetLibFilter()">Filter wissen</button></div>';
    lib.innerHTML = html;
    return;
  }
  html += '<div class="library-list">' + libRenderGroups(filtered) + '</div>';
  lib.innerHTML = html;

  lib.querySelectorAll('[data-matrix-id]').forEach(el => {
    el.addEventListener('input', () => {
      const it = state.library.find(x => x.id === el.getAttribute('data-matrix-id'));
      if (!it) return;
      it.matrix = it.matrix || {};
      it.matrix[el.getAttribute('data-matrix-field')] = el.value;
      clearTimeout(el._mt); el._mt = setTimeout(() => { try { saveLibrary(); } catch(e){} }, 500);
    });
  });

  lib.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const item = state.library.find(x => x.id === id);
      if (!item) return;
      if (action === 'copy-prompt') {
        navigator.clipboard.writeText(item.variation.image_prompt_en);
        toast('Image prompt gekopieerd');
      } else if (action === 'view') {
        viewLibraryItem(item);
      } else if (action === 'iterate') {
        iterateFromLibrary(item);
      } else if (action === 'download') {
        if (item.image && item.image.b64) {
          const mime = item.image.mime || 'image/png';
          let fname = buildAdFilename(item.metadata || {}, 'lib', '');
          if (mime.indexOf('jpeg') !== -1) fname = fname.replace(/\.png$/, '.jpg');
          const a = document.createElement('a');
          a.href = 'data:' + mime + ';base64,' + item.image.b64;
          a.download = fname;
          document.body.appendChild(a); a.click(); a.remove();
          toast('Beeld gedownload');
        }
      } else if (action === 'delete') {
        if (confirm('Verwijder uit library?')) {
          state.library = state.library.filter(x => x.id !== id);
          saveLibrary();
          renderLibrary();
          toast('Verwijderd uit library');
        }
      }
    });
  });
}
function viewLibraryItem(item) {
  // Bewaar de huidige sessie als backup zodat we terug kunnen springen
  if (state.lastGenerated && state.lastGenerated.variations && state.lastGenerated.variations.length > 0 && !state.lastGenerated.fromLibrary) {
    state.sessionBackup = {
      lastGenerated: JSON.parse(JSON.stringify(state.lastGenerated)),
      generatedImages: JSON.parse(JSON.stringify(state.generatedImages || {}))
    };
  }
  state.lastGenerated = { variations: [item.variation], metadata: item.metadata, fromLibrary: true };
  // Herstel de bewaarde afbeelding als die er is, anders leeg
  if (item.image) {
    state.generatedImages = { 0: { versions: [JSON.parse(JSON.stringify(item.image))], currentIndex: 0 } };
  } else {
    state.generatedImages = {};
  }
  const hasBackup = !!state.sessionBackup;
  const backHtml = hasBackup
    ? `<button class="btn btn-small btn-ghost" onclick="returnToSession()" title="Terug naar de variaties die je net had gegenereerd">← Terug naar huidige sessie</button>`
    : '';
  clearInactiveResults('results');
  document.getElementById('results').innerHTML =
    `<div class="results-header">
      <div>
        <h2 class="results-title">Uit library</h2>
        <div style="font-size: 12px; color: var(--text-faint); margin-top: 4px;">
          ${escapeHtml(item.metadata.product)} , ${item.metadata.funnel} , ${item.metadata.archetype}
        </div>
      </div>
      ${backHtml}
    </div>` +
    buildRecipeHtml(item.metadata, item.variation) +
    renderVariationCard(item.variation, 0, item.metadata);
  attachCopyHandlers();
  // Herstel de afbeelding-weergave als die er was
  if (state.generatedImages[0]) {
    renderGeneratedImage(0);
  }
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

function returnToSession() {
  if (!state.sessionBackup) {
    toast('Geen sessie om terug te keren', true);
    return;
  }
  state.lastGenerated = state.sessionBackup.lastGenerated;
  state.generatedImages = state.sessionBackup.generatedImages || {};
  state.sessionBackup = null;
  renderResults(state.lastGenerated.variations, state.lastGenerated.metadata);
  // Render alle bewaarde afbeeldingen terug
  Object.keys(state.generatedImages).forEach(idx => {
    const i = parseInt(idx);
    if (state.generatedImages[i]) renderGeneratedImage(i);
  });
  toast('Terug bij je huidige sessie');
}
function clearLibrary() {
  if (!confirm('Alle bewaarde variaties verwijderen?')) return;
  state.library = [];
  saveLibrary();
  renderLibrary();
  toast('Library leeggemaakt');
}

