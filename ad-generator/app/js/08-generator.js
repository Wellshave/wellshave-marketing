// ============================================================
// NUM SLIDER
// ============================================================
document.getElementById('num-input').addEventListener('input', (e) => {
  document.getElementById('num-display').textContent = e.target.value;
});

// Persist mode selection across radio buttons
const savedMode = localStorage.getItem((STORAGE_PREFIX+'mode'));
if (savedMode) {
  const modeRadio = document.querySelector(`input[name=mode][value="${savedMode}"]`);
  if (modeRadio) modeRadio.checked = true;
}
// Veld-logica per mode: irrelevante velden verbergen zodat het formulier klopt met de keuze.
// Nieuwsartikel (advertorial-news) is merk-los en artikel-gedreven: archetype, concept-richting,
// offer-detail en bundle zijn daar niet relevant; de Nieuwsartikel-briefing vervangt ze.
// Offer-detail is sowieso alleen relevant bij het Offer-archetype.

/* ===== Interview-mode (Wizard) voor Statics (v5.09): adaptief Rory-interview -> Theriot scherpt -> 3 statics ===== */
var iw = { open:false, phase:'entrance', entrance:'persona', product:'', persona:null, angle:'', chat:[], known:{}, checklist:{}, hist:null, briefing:null, busy:false, suggest:[] };

function iwModel(){ var el=document.getElementById('anthropic-model'); return (el&&el.value)||'claude-opus-5'; }
function iwEsc(t){ return (typeof escapeHtml==='function')?escapeHtml(t==null?'':String(t)):String(t==null?'':t); }
function iwText(data){ var t=''; try{ (data.content||[]).forEach(function(b){ if(b&&b.type==='text') t+=b.text; }); }catch(e){} return t; }
function iwJson(txt){ var a=txt.indexOf('{'), b=txt.lastIndexOf('}'); if(a<0||b<0) throw new Error('geen JSON'); return JSON.parse(txt.substring(a,b+1)); }
function iwBrand(){ return (typeof ACTIVE_BRAND!=='undefined')?ACTIVE_BRAND:'wellshave'; }

/* ---------- openen / entrance ---------- */
function iwOpen(){
  iw.open=true; iw.phase='entrance'; iw.chat=[]; iw.known={}; iw.checklist={}; iw.hist=null; iw.briefing=null; iw.persona=null; iw.angle='';
  var ov=document.getElementById('iw-overlay'); if(ov){ ov.style.display='flex'; }
  iwRenderEntrance();
}
function iwClose(){ iw.open=false; var ov=document.getElementById('iw-overlay'); if(ov) ov.style.display='none'; }

function iwRenderEntrance(){
  var body=document.getElementById('iw-body'); if(!body) return;
  var prods=(state.products||[]).filter(function(p){ return !p.brand || p.brand===iwBrand() || !p.niche; });
  var prodOpts=(state.products||[]).map(function(p){ return '<option value="'+iwEsc(p.id)+'">'+iwEsc(p.name)+'</option>'; }).join('');
  var persOpts='<option value="">Kies een persona...</option>'+(state.personas||[]).map(function(p){ return '<option value="'+iwEsc(p.id)+'">'+iwEsc(p.name)+'</option>'; }).join('');
  body.innerHTML=''
    + '<div class="iw-entrance">'
    + '<div class="iw-kicker">Interview met Rory</div>'
    + '<h2>Waar beginnen we?</h2>'
    + '<p class="iw-lede">Rory stelt je gericht vragen, daagt je aannames uit en graaft door tot de hoek scherp is. Daarna scherpt Theriot het visuele concept aan en genereren we 3 statics op dezelfde boodschap.</p>'
    + '<div class="iw-field"><label>Product</label><select id="iw-product">'+prodOpts+'</select></div>'
    + '<div class="iw-tabs"><button class="iw-tab '+(iw.entrance==='persona'?'on':'')+'" onclick="iwSetEntrance(\'persona\')">Vanuit een persona</button><button class="iw-tab '+(iw.entrance==='angle'?'on':'')+'" onclick="iwSetEntrance(\'angle\')">Vanuit een losse angle</button></div>'
    + (iw.entrance==='persona'
        ? '<div class="iw-field"><label>Customer persona</label><select id="iw-persona">'+persOpts+'</select><div class="iw-hint">Rory laadt zijn pijn, wensen en bezwaren, plus wat er al getest is, en kiest samen met jou de hoek.</div></div>'
        : '<div class="iw-field"><label>Marketing angle / invalshoek</label><textarea id="iw-angle" placeholder="Bv: het gevoel dat je nooit echt glad wordt met een gewoon mesje"></textarea></div>')
    + '<button class="iw-start" onclick="iwStart()">Start het interview met Rory</button>'
    + '</div>';
}
function iwSetEntrance(m){ iw.entrance=m; iwRenderEntrance(); }

function iwStart(){
  var prodEl=document.getElementById('iw-product'); iw.product = prodEl?prodEl.value:'';
  if(iw.entrance==='persona'){
    var pel=document.getElementById('iw-persona'); var pid=pel?pel.value:'';
    if(!pid){ if(typeof toast==='function') toast('Kies eerst een persona',true); return; }
    iw.persona=(state.personas||[]).find(function(p){ return p.id===pid; })||null;
    if(!iw.persona){ toast('Persona niet gevonden',true); return; }
    iw.phase='interview'; iwRenderInterview();
    iwLoadHistory(iw.persona.name, function(){ iwKickoff(); });
  } else {
    var ael=document.getElementById('iw-angle'); iw.angle=ael?ael.value.trim():'';
    if(!iw.angle){ toast('Beschrijf eerst je angle',true); return; }
    iw.phase='interview'; iwRenderInterview(); iwKickoff();
  }
}

/* ---------- testhistorie uit creatives ---------- */
function iwLoadHistory(personaName, cb){
  iw.hist=null;
  var sb=window._sb;
  if(!sb||!window._authProfile||!personaName){ iw.hist={}; cb&&cb(); return; }
  sb.from('creatives').select('angle_type,roas,status').eq('brand',iwBrand())
    .ilike('persona','%'+personaName.replace(/[%,()]/g,'')+'%').limit(500)
    .then(function(r){
      var h={};
      ((r&&r.data)||[]).forEach(function(row){
        if(!row.angle_type) return;
        if(!h[row.angle_type]) h[row.angle_type]={n:0,best:null,winner:false};
        h[row.angle_type].n++;
        if(row.roas!=null&&(h[row.angle_type].best==null||row.roas>h[row.angle_type].best)) h[row.angle_type].best=row.roas;
        if(row.status==='Winner') h[row.angle_type].winner=true;
      });
      iw.hist=h; iwRenderKnown(); cb&&cb();
    }).catch(function(){ iw.hist={}; cb&&cb(); });
}

/* ---------- interview-render ---------- */
function iwRenderInterview(){
  var body=document.getElementById('iw-body'); if(!body) return;
  body.innerHTML=''
    + '<div class="iw-split">'
    + '  <div class="iw-chatcol"><div class="iw-msgs" id="iw-msgs"></div>'
    + '    <div id="iw-suggest" class="iw-suggest"></div>'
    + '    <div class="iw-inputrow"><textarea id="iw-in" placeholder="Typ je antwoord..." onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();iwSend();}"></textarea><button class="iw-send" id="iw-send" onclick="iwSend()">Stuur</button></div>'
    + '  </div>'
    + '  <div class="iw-sidecol"><div class="iw-side-title">Wat we tot nu toe weten</div><div id="iw-known"></div><div class="iw-side-title" style="margin-top:16px;">Checklist</div><div id="iw-check"></div>'
    + '    <button class="iw-converge" id="iw-converge-btn" onclick="iwForceConverge()">Genoeg, maak de briefing</button>'
    + '  </div>'
    + '</div>';
  iwRenderChat(); iwRenderKnown();
}
function iwRenderChat(){
  var el=document.getElementById('iw-msgs'); if(!el) return;
  el.innerHTML=iw.chat.map(function(m){
    if(m.role==='think') return '<div class="iw-msg think">'+iwEsc(m.content)+'</div>';
    return '<div class="iw-msg '+(m.role==='assistant'?'rory':'user')+'">'+(m.role==='assistant'?'<span class="iw-who">Rory</span>':'')+iwEsc(m.content)+'</div>';
  }).join('');
  el.scrollTop=el.scrollHeight;
}
function iwRenderSuggest(){
  var el=document.getElementById('iw-suggest'); if(!el) return;
  var list=iw.suggest||[];
  el.innerHTML = list.length ? ('<span class="iw-suggest-lbl">Snel antwoord</span>' + list.map(function(sug){ return '<button class="iw-sugg" data-s="'+iwEsc(sug)+'" onclick="iwPickSuggestion(this.getAttribute(\'data-s\'))">'+iwEsc(sug)+'</button>'; }).join('')) : '';
}
function iwPickSuggestion(txt){ var el=document.getElementById('iw-in'); if(el){ el.value=txt; el.focus(); try{ el.setSelectionRange(el.value.length,el.value.length); }catch(e){} } }
function iwRenderKnown(){
  var el=document.getElementById('iw-known'); if(el){
    var rows=[['Kern-pijn','pijn'],['Echte vijand / hoek','hoek'],['Kern-bezwaar','bezwaar'],['Gewenste na-situatie','na_situatie'],['Visueel concept','concept']];
    el.innerHTML=rows.map(function(r){ var v=iw.known[r[1]]; return '<div class="iw-known-row"><span class="k">'+r[0]+'</span><span class="v">'+(v?iwEsc(v):'<em>nog open</em>')+'</span></div>'; }).join('');
  }
  var ce=document.getElementById('iw-check'); if(ce){
    var items=[['pijn','Kern-pijn'],['hoek','Hoek'],['bezwaar','Bezwaar'],['na_situatie','Na-situatie'],['concept','Concept']];
    ce.innerHTML=items.map(function(it){ var on=!!iw.checklist[it[0]]; return '<div class="iw-check-row '+(on?'on':'')+'"><span class="dot">'+(on?'✓':'○')+'</span>'+it[1]+'</div>'; }).join('');
  }
  // testhistorie tonen bij persona
  var kn=document.getElementById('iw-known');
  if(kn && iw.hist && Object.keys(iw.hist).length){
    var h='<div class="iw-hist"><div class="iw-hist-t">Testhistorie ('+iwEsc(iw.persona?iw.persona.name:'')+')</div>';
    Object.keys(iw.hist).forEach(function(k){ var x=iw.hist[k]; h+='<div class="iw-hist-row">'+iwEsc(k)+': '+x.n+'x'+(x.best!=null?(' · beste ROAS '+x.best):'')+(x.winner?' · <b style="color:#25a758;">winner</b>':'')+'</div>'; });
    h+='</div>'; kn.insertAdjacentHTML('beforeend', h);
  }
}

/* ---------- Rory-call ---------- */
var IW_RORY_SYSTEM = 'Je bent Rory Sutherland, creative strategist, en je voert een DIEP interview om tot een heel specifieke static-ad-briefing te komen. Je STUURT: je stelt precies EEN vraag per beurt, je kiest je volgende vraag op basis van het vorige antwoord, en je daagt minstens een keer de aanname van de gebruiker uit en graaft naar de echte wortel (niet het oppervlakkige probleem). Je bent scherp, nieuwsgierig en concreet, nooit oppervlakkig. Werk in je hoofd naar een checklist toe die VOL moet zijn voor je concludeert: (1) de scherpe kern-pijn, (2) de echte vijand/hoek (de contraire, onbezette invalshoek), (3) het kern-bezwaar dat de ad moet wegnemen, (4) de gewenste na-situatie, (5) een concreet visueel concept. Gebruik de testhistorie: stuur naar onbezette of bewezen hoeken. Antwoord ALTIJD met strict JSON, geen markdown:\n{"type":"question"|"converge","message":"jouw bericht aan de gebruiker in het Nederlands, kort (max ~60 woorden), 1 vraag of 1 uitdaging, of bij converge een korte samenvatting","known":{"pijn":"","hoek":"","bezwaar":"","na_situatie":"","concept":""},"checklist":{"pijn":true/false,"hoek":true/false,"bezwaar":true/false,"na_situatie":true/false,"concept":true/false},"suggesties":["kort voorbeeld-antwoord in de ik-vorm","..."],"briefing":{}}\nBij type "question" geef je 2 tot 4 KORTE, concrete voorbeeld-antwoorden in "suggesties", in de ik-vorm van de gebruiker, zodat hij met 1 klik kan antwoorden (hij mag ook nog zelf typen of aanpassen). Bij "converge" laat je "suggesties" leeg. Vul "known" progressief met wat je al zeker weet (laat leeg wat nog open is). Zet type op "converge" pas als minstens 4 van de 5 checklist-items waar zijn. Bij "converge" vul je "briefing" volledig: {"product":"","persona":"","angle_type":"een van de 10 angle-types","marketing_angle":"de scherpe boodschap in 1 zin","format":"1 format-id uit de FORMATS-lijst","awareness":"unaware|problem|solution|product|most","funnel":"tof|mof|bof|retargeting","sophistication":"1-5","objection":"","desired_outcome":"","visual_concept":"concreet, wat zie je in beeld","headline_direction":"richting voor de headline","hypothese":"Als we ... dan ... omdat ..."}.';

function iwContext(){
  var c='# CONTEXT\nMerk: '+(typeof BRAND_NAME_UC!=='undefined'?BRAND_NAME_UC:'Wellshave')+'\n';
  var p=(state.products||[]).find(function(x){ return x.id===iw.product; });
  if(p){ c+='Product: '+p.name+(p.category?(' ('+p.category+')'):'')+'\n'; if(p.usps&&p.usps.length) c+="USP's: "+p.usps.filter(Boolean).join(' | ')+'\n'; }
  if(iw.persona){
    c+='\n# PERSONA: '+iw.persona.name+'\n'+(iw.persona.description||'')+'\n';
    if(iw.persona.pains&&iw.persona.pains.length) c+='Pijnpunten: '+iw.persona.pains.join(' | ')+'\n';
    if(iw.persona.desires&&iw.persona.desires.length) c+='Wensen: '+iw.persona.desires.join(' | ')+'\n';
    if(iw.persona.objections&&iw.persona.objections.length) c+='Bezwaren: '+iw.persona.objections.join(' | ')+'\n';
  }
  if(iw.angle) c+='\n# START-ANGLE VAN DE GEBRUIKER\n'+iw.angle+'\n';
  if(iw.hist&&Object.keys(iw.hist).length){ c+='\n# TESTHISTORIE (angle: keer getest, beste ROAS, winner?)\n'; Object.keys(iw.hist).forEach(function(k){ var x=iw.hist[k]; c+='- '+k+': '+x.n+'x, beste ROAS '+x.best+(x.winner?', WINNER':'')+'\n'; }); c+='Stuur naar een onbezette of bewezen hoek waar dat kan.\n'; }
  if(typeof AD_FORMATS!=='undefined'){ c+='\n# FORMATS (kies format = een id):\n'+AD_FORMATS.map(function(f){ return f.id+' — '+f.name; }).join(', ')+'\n'; }
  return c;
}

function iwKickoff(){ iwAsk('Start het interview. Kijk naar de context, kies waar je begint en stel je eerste scherpe vraag (of daag meteen een aanname uit).', true); }
function iwSend(){ var el=document.getElementById('iw-in'); var t=el?el.value.trim():''; if(!t||iw.busy) return; el.value=''; iw.chat.push({role:'user',content:t}); iwRenderChat(); iwAsk(t,false); }
function iwForceConverge(){ if(iw.busy) return; iwAsk('Ik heb genoeg input gegeven. Rond nu af: zet type op "converge" en lever de volledige briefing op basis van wat we hebben.', false); }

function iwAsk(userText, isKickoff){
  if(iw.busy) return; iw.busy=true;
  var sb=document.getElementById('iw-send'); if(sb) sb.disabled=true;
  iw.chat.push({role:'think',content:'Rory denkt na...'}); iw.suggest=[]; iwRenderChat(); iwRenderSuggest();
  var msgs=iw.chat.filter(function(m){ return m.role==='user'||m.role==='assistant'; }).map(function(m){ return {role:m.role,content:m.content}; });
  msgs.push({role:'user',content:userText+'\n\n'+iwContext()});
  fetchJsonWithRetry((PROXY_BASE+'/anthropic'),{
    method:'POST', headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model: iwModel(), max_tokens: 1500, system: IW_RORY_SYSTEM + (typeof brandProfileBlock==='function'?brandProfileBlock():''), messages: msgs })
  }).then(function(data){
    iw.chat=iw.chat.filter(function(m){ return m.role!=='think'; });
    var obj=iwJson(iwText(data));
    if(obj.known) iw.known=Object.assign(iw.known, obj.known);
    if(obj.checklist) iw.checklist=obj.checklist;
    iw.chat.push({role:'assistant',content:obj.message||'(geen bericht)'});
    iwRenderChat(); iwRenderKnown();
    iw.suggest = (obj.type==='question' && Array.isArray(obj.suggesties)) ? obj.suggesties.slice(0,4) : []; iwRenderSuggest();
    if(obj.type==='converge' && obj.briefing){ iwConverge(obj.briefing); }
  }).catch(function(err){
    iw.chat=iw.chat.filter(function(m){ return m.role!=='think'; });
    iw.chat.push({role:'assistant',content:'Kon de server niet bereiken ('+err.message+'). Probeer het zo nog eens.'}); iwRenderChat();
  }).finally(function(){ iw.busy=false; var s2=document.getElementById('iw-send'); if(s2) s2.disabled=false; });
}

/* ---------- Theriot scherpt het concept ---------- */
var IW_THERIOT_SYSTEM = 'Je bent Nick Theriot, direct-response creative strategist. Je krijgt een static-ad-briefing van Rory. Scherp het visuele concept en de uitvoering aan volgens show-dont-tell: maak "visual_concept" concreet en filmisch (wat zie je letterlijk in beeld, welk bewijs is zichtbaar), en "headline_direction" scherper. Verander de strategische kern (persona, angle, boodschap) NIET. Antwoord met strict JSON: hetzelfde briefing-object terug, met aangescherpte visual_concept en headline_direction, plus een veld "theriot_note": 1 zin wat je scherper maakte.';
function iwConverge(briefing){
  iw.briefing=briefing; iw.phase='theriot';
  var body=document.getElementById('iw-body');
  if(body) body.innerHTML='<div class="iw-loading">Rory heeft de hoek. Theriot scherpt nu het visuele concept aan...</div>';
  fetchJsonWithRetry((PROXY_BASE+'/anthropic'),{
    method:'POST', headers:{'Content-Type':'application/json','anthropic-version':'2023-06-01'},
    body: JSON.stringify({ model: iwModel(), max_tokens: 1500, system: IW_THERIOT_SYSTEM + (typeof brandProfileBlock==='function'?brandProfileBlock():''), messages:[{role:'user',content:'BRIEFING:\n'+JSON.stringify(briefing)}] })
  }).then(function(data){
    try{ var refined=iwJson(iwText(data)); iw.briefing=Object.assign({}, briefing, refined); }catch(e){}
    iwRenderBriefing();
  }).catch(function(){ iwRenderBriefing(); });
}

/* ---------- eindbriefing ---------- */
function iwRenderBriefing(){
  var b=iw.briefing||{}; var body=document.getElementById('iw-body'); if(!body) return;
  var fmtName=(typeof AD_FORMATS!=='undefined'?(AD_FORMATS.find(function(x){return x.id===b.format;})||{}).name:'')||b.format||'';
  var row=function(label,key,val,ta){ return '<div class="iw-bf'+(ta?' wide':'')+'"><label>'+label+'</label>'+(ta?'<textarea id="iwb-'+key+'">'+iwEsc(val||'')+'</textarea>':'<input id="iwb-'+key+'" value="'+iwEsc(val||'')+'">')+'</div>'; };
  body.innerHTML=''
    + '<div class="iw-brief">'
    + '<div class="iw-kicker">Eindbriefing</div><h2>Dit gaan we maken</h2>'
    + (b.theriot_note?'<div class="iw-theriot">Theriot scherpte aan: '+iwEsc(b.theriot_note)+'</div>':'')
    + '<div class="iw-bf-grid">'
    + row('Marketing-angle (de boodschap)','marketing_angle',b.marketing_angle,true)
    + row('Angle-type','angle_type',b.angle_type)
    + '<div class="iw-bf"><label>Format</label><input id="iwb-format" value="'+iwEsc(b.format||'')+'"><div class="iw-hint">'+iwEsc(fmtName)+'</div></div>'
    + row('Awareness','awareness',b.awareness)
    + row('Funnel','funnel',b.funnel)
    + row('Kern-bezwaar','objection',b.objection,true)
    + row('Gewenste na-situatie','desired_outcome',b.desired_outcome,true)
    + row('Visueel concept','visual_concept',b.visual_concept,true)
    + row('Headline-richting','headline_direction',b.headline_direction,true)
    + row('Hypothese','hypothese',b.hypothese,true)
    + '</div>'
    + '<div class="iw-brief-actions"><button class="iw-start" onclick="iwGenerate()">Genereer 3 statics met GPT Image 2</button><button class="iw-ghost" onclick="iwRenderInterview();iwRenderChat();iwRenderKnown();">← Terug naar het gesprek</button></div>'
    + '</div>';
}
function iwReadBriefing(){
  var g=function(k){ var el=document.getElementById('iwb-'+k); return el?el.value.trim():''; };
  return { marketing_angle:g('marketing_angle'), angle_type:g('angle_type'), format:g('format'), awareness:g('awareness'), funnel:g('funnel'), objection:g('objection'), desired_outcome:g('desired_outcome'), visual_concept:g('visual_concept'), headline_direction:g('headline_direction'), hypothese:g('hypothese') };
}

/* ---------- koppelen aan de generatie ---------- */
function iwGenerate(){
  var b=iwReadBriefing();
  var awMap={unaware:'unaware',problem:'problem',solution:'solution',product:'product',most:'most'};
  // product
  var pe=document.getElementById('product-select'); if(pe&&iw.product){ pe.value=iw.product; if(typeof onProductChange==='function'){ try{onProductChange();}catch(e){} } pe.dispatchEvent(new Event('change',{bubbles:true})); }
  // persona
  if(iw.persona){ var pse=document.getElementById('persona-select'); if(pse&&(state.personas||[]).find(function(x){return x.id===iw.persona.id;})){ pse.value=iw.persona.id; pse.dispatchEvent(new Event('change',{bubbles:true})); } }
  // format
  if(typeof pickFormat==='function'&&b.format&&(b.format==='auto'||(typeof AD_FORMAT_DIRECTIVE!=='undefined'&&AD_FORMAT_DIRECTIVE[b.format]))) pickFormat(b.format);
  // funnel radio
  if(b.funnel){ var fr=document.querySelector('input[name="funnel"][value="'+b.funnel+'"]'); if(fr){ fr.checked=true; fr.dispatchEvent(new Event('change',{bubbles:true})); } }
  // awareness + sophistication
  var awe=document.getElementById('awareness-select'); if(awe&&b.awareness&&awMap[b.awareness]) awe.value=awMap[b.awareness];
  var sfe=document.getElementById('sophistication-select'); if(sfe&&b.sophistication) sfe.value=String(b.sophistication);
  // concept-veld: de vastgezette boodschap + concept, met lock-instructie
  var concept=document.getElementById('concept-input');
  if(concept){
    concept.value='HOEK (VAST, houd identiek over alle 3): '+b.marketing_angle
      + (b.visual_concept?('\nVISUEEL CONCEPT: '+b.visual_concept):'')
      + (b.headline_direction?('\nHEADLINE-RICHTING: '+b.headline_direction):'')
      + (b.objection?('\nWEG TE NEMEN BEZWAAR: '+b.objection):'')
      + (b.desired_outcome?('\nGEWENSTE NA-SITUATIE: '+b.desired_outcome):'')
      + '\nBELANGRIJK: alle 3 de varianten dragen DEZELFDE kernboodschap en hoek; varieer alleen de visuele uitvoering (compositie, headline-formulering, layout).';
  }
  // aantal = 3
  var num=document.getElementById('num-input'); if(num){ num.value='3'; num.dispatchEvent(new Event('input',{bubbles:true})); num.dispatchEvent(new Event('change',{bubbles:true})); }
  // overkoepelende hypothese
  window._roryHypothese = b.hypothese || '';
  iwClose();
  if(typeof toast==='function') toast('Briefing naar de generator gezet, 3 statics worden gemaakt');
  try{ var g=document.getElementById('main-tab-generator'); if(g) g.scrollIntoView({behavior:'smooth'}); }catch(e){}
  if(typeof dispatchGenerate==='function') setTimeout(function(){ dispatchGenerate(); }, 400);
}

/* ===== 42-format systeem (v5.07, geport uit Atelier Console) ===== */
/* ===== 42-format systeem (geport uit Atelier Console, v5.07) ===== */
var AD_FORMAT_CATS = [{"key": "A", "label": "A · Product-led"}, {"key": "B", "label": "B · Social proof"}, {"key": "C", "label": "C · Vergelijking & educatie"}, {"key": "D", "label": "D · Native & lo-fi"}, {"key": "E", "label": "E · Editorial & advertorial"}];
var AD_FORMATS = [{"id": "product-hero", "cat": "A", "catLabel": "A · Product-led", "name": "Product Hero", "tags": ["Packshot", "Headline", "Witruimte"], "desc": "Simpel maar alleen sterk met een scherpe boodschap. Voor merken met sterk design of premium positionering.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "feature-callout", "cat": "A", "catLabel": "A · Product-led", "name": "Feature Callout", "tags": ["Product", "4–6 pijlen", "Feature-labels"], "desc": "Voor product aware publiek dat vergelijkt. Maakt specificaties in 1 oogopslag duidelijk.", "brandless": false, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "benefit-stack", "cat": "A", "catLabel": "A · Product-led", "name": "Benefit Stack", "tags": ["Product", "3–5 checkmarks", "Knop"], "desc": "Een van de sterkste retargeting-formats. Vat de hele pitch samen voor wie al keek.", "brandless": false, "cta": "hard", "proof": true, "dest": "pdp"}, {"id": "what-s-in-the-box", "cat": "A", "catLabel": "A · Product-led", "name": "What's in the box", "tags": ["Flat lay", "Onderdelen", "Labels"], "desc": "Communiceert waarde en compleetheid in 1 beeld. Sterk bij bundels en producten met accessoires.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "exploded-view", "cat": "A", "catLabel": "A · Product-led", "name": "Exploded view", "tags": ["Zwevende onderdelen", "Tech-claim"], "desc": "Onderbouwt een kwaliteits- of technologieclaim visueel. Geeft een goedkoop ogend product meer waarde.", "brandless": false, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "offer-bundle-stack", "cat": "A", "catLabel": "A · Product-led", "name": "Offer / Bundle Stack", "tags": ["Bundel", "Waardeanker", "Streepprijs"], "desc": "Voor most aware publiek en promo-momenten. Waarde-stapeling verhoogt de gepercipieerde deal.", "brandless": false, "cta": "hard", "proof": true, "dest": "pdp"}, {"id": "grid-collage", "cat": "A", "catLabel": "A · Product-led", "name": "Grid / Collage", "tags": ["4–6 vakken", "Product", "Gebruik", "Resultaat"], "desc": "Vertelt een mini-verhaal in 1 beeld. Handig als 1 foto het product niet kan dragen.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "prijsanker-deal", "cat": "A", "catLabel": "A · Product-led", "name": "Prijsanker / Deal", "tags": ["Grote prijs", "Korting"], "desc": "Alleen voor sale-momenten, anders train je het publiek op korting wachten.", "brandless": false, "cta": "hard", "proof": false, "dest": "pdp"}, {"id": "gift-guide", "cat": "A", "catLabel": "A · Product-led", "name": "Gift Guide", "tags": ["Product-als-cadeau", "Doelgroep/moment"], "desc": "Rond feestdagen richt je op de gever i.p.v. de gebruiker — een compleet nieuw publiek.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "testimonial-pull-quote", "cat": "B", "catLabel": "B · Social proof", "name": "Testimonial pull-quote", "tags": ["Grote quote", "Klein product"], "desc": "Specifieke quotes (getal, tijdsbestek, before-state) verslaan generieke lof.", "brandless": false, "cta": "soft", "proof": true, "dest": "pdp"}, {"id": "review-wall", "cat": "B", "catLabel": "B · Social proof", "name": "Review wall", "tags": ["3–5 reviews", "Sterren"], "desc": "Massa-bewijs in 1 beeld. Werkt als het aantal reviews zelf het argument is.", "brandless": false, "cta": "soft", "proof": true, "dest": "pdp"}, {"id": "5-sterren-cards", "cat": "B", "catLabel": "B · Social proof", "name": "5-sterren cards", "tags": ["Klantfoto", "Rating", "1-zin review"], "desc": "Voelt als een sociale feed. Laat verschillende klanttypes zien zodat meerdere avatars zich herkennen.", "brandless": false, "cta": "soft", "proof": true, "dest": "pdp"}, {"id": "review-screenshot", "cat": "B", "catLabel": "B · Social proof", "name": "Review screenshot", "tags": ["Native screenshot", "UI-elementen", "Sterren"], "desc": "Voelt niet als ad, dus hoge geloofwaardigheid. UI zichtbaar laten maakt het echt.", "brandless": true, "cta": "none", "proof": true, "dest": "pdp"}, {"id": "whatsapp-chat", "cat": "B", "catLabel": "B · Social proof", "name": "WhatsApp / chat", "tags": ["Chatgesprek", "Aanbeveling"], "desc": "Zeer native in NL. Simuleert de sterkste vorm van marketing: een aanbeveling van een vriend.", "brandless": true, "cta": "none", "proof": true, "dest": "pdp"}, {"id": "tweet-reddit-screenshot", "cat": "B", "catLabel": "B · Social proof", "name": "Tweet / Reddit screenshot", "tags": ["Post-screenshot", "One-liner"], "desc": "Lo-fi en scroll-stoppend. Goed voertuig voor een gewaagde of grappige claim.", "brandless": true, "cta": "none", "proof": true, "dest": "pdp"}, {"id": "ig-comment-section", "cat": "B", "catLabel": "B · Social proof", "name": "IG comment section", "tags": ["Product", "Nagebootste comments"], "desc": "Simuleert hype en sociale discussie. Comments kunnen ook bezwaren beantwoorden.", "brandless": true, "cta": "none", "proof": true, "dest": "pdp"}, {"id": "tiktok-made-me-buy-it", "cat": "B", "catLabel": "B · Social proof", "name": "TikTok-made-me-buy-it", "tags": ["UGC-still", "Caption-balk"], "desc": "Werkt op nieuwsgierigheid en FOMO. Sterk voor producten met een visueel wow-moment.", "brandless": true, "cta": "none", "proof": true, "dest": "pdp"}, {"id": "stat-data-callout", "cat": "B", "catLabel": "B · Social proof", "name": "Stat / Data Callout", "tags": ["1 groot getal", "Bron"], "desc": "Cijfers stoppen de scroll en maken claims concreet. Hoe specifieker het getal, hoe geloofwaardiger.", "brandless": false, "cta": "soft", "proof": true, "dest": "pdp"}, {"id": "ugc-still-klantfoto", "cat": "B", "catLabel": "B · Social proof", "name": "UGC-still / klantfoto", "tags": ["Echte klantfoto", "Ruwe kwaliteit"], "desc": "Authenticiteit boven polish. Werkt top-of-funnel omdat het niet als advertentie oogt.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "us-vs-them-tabel", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Us vs Them tabel", "tags": ["Split-screen", "Vinkjes", "Kruisjes"], "desc": "Topformat voor solution aware publiek dat al opties vergelijkt. Jij vult hun lijstje alvast in.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "before-after", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Before / After", "tags": ["Probleem", "Resultaat"], "desc": "De sterkste vorm van show don’t tell. Let op Meta-policies: realistisch en niet misleidend.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "3-redenen-waarom", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "3 redenen waarom", "tags": ["Genummerde lijst", "3 argumenten"], "desc": "Structuur maakt de ad snel scanbaar. Elk argument kort bewijzen, niet alleen claimen.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "checklist-herkenbaar", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Checklist / Herkenbaar?", "tags": ["Pijnpunt-checklist", "Oplossing"], "desc": "Kwalificeert de juiste doelgroep en bouwt herkenning op voordat het product komt. Problem aware.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "how-it-works", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "How it works", "tags": ["3 stappen", "Mechanisme"], "desc": "Nodig in een claim-moe markt: een nieuw mechanisme maakt een oude claim weer geloofwaardig.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "faq-objection", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "FAQ / Objection", "tags": ["Koopbezwaar", "Headline-antwoord"], "desc": "Voor product aware publiek dat twijfelt. Maak een versie per hoofdbezwaar.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "mythe-vs-feit", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Mythe vs Feit", "tags": ["Mythe", "Feit"], "desc": "Positioneert het merk als expert en creëert een aha-moment. Goede opstap naar een nieuw mechanisme.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "kostenvergelijking", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Kostenvergelijking", "tags": ["Jaarkosten", "Vergelijking"], "desc": "Rationeel en zeer deelbaar. Sterk wanneer het alternatief terugkerende kosten heeft.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "persona-callout", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Persona callout", "tags": ["“Voor mensen die…”", "Sub-identiteit"], "desc": "Kleiner publiek, veel hogere relevantie. Sub-identiteiten die niemand aanspreekt zijn de open ruimte.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "probleem-agitatie", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Probleem-agitatie", "tags": ["Uitvergroot pijnpunt", "Kleine oplossing"], "desc": "Voor problem aware koud publiek. De ad bewijst eerst dat je het probleem snapt.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "wist-je-dat", "cat": "C", "catLabel": "C · Vergelijking & educatie", "name": "Wist-je-dat", "tags": ["Insight", "Hook"], "desc": "Werkt voor unaware publiek: je verkoopt eerst het probleem, dan pas het product.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "ugly-ad", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Ugly ad", "tags": ["Systeemfont", "Felle kleuren"], "desc": "Ziet er niet uit als een ad en scoort daardoor vaak op CTR. Vooral top-of-funnel; bewaak de merkwaarde.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "meme-format", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Meme-format", "tags": ["Meme-structuur", "Categorie-humor"], "desc": "Goedkoop, snel en deelbaar. Alleen voor koud publiek en merken waar humor past.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "whiteboard-notitie", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Whiteboard / notitie", "tags": ["Handgeschreven pitch", "Notitie-app"], "desc": "Voelt als advies van een vriend of een insider-tip in plaats van een advertentie.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "search-bar-ad", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Search bar ad", "tags": ["Zoekbalk", "Suggesties"], "desc": "Speelt in op bestaand zoekgedrag en de intentie die daar al zit.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "reminder-ad", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Reminder ad", "tags": ["Kale tekst", "Persoonlijke toon"], "desc": "Sterk in retargeting: laag geproduceerd, hoog persoonlijk.", "brandless": true, "cta": "soft", "proof": false, "dest": "pdp"}, {"id": "notification-screenshot", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Notification screenshot", "tags": ["Telefoon-notificatie"], "desc": "Patroon-onderbreker: iedereen kijkt reflexmatig naar notificaties.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "post-it-handgeschreven", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Post-it / handgeschreven", "tags": ["Briefje", "Echte omgeving"], "desc": "Persoonlijk, goedkoop te maken en volledig anders dan de rest van de feed.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "photo-dump-casual", "cat": "D", "catLabel": "D · Native & lo-fi", "name": "Photo dump / casual", "tags": ["Telefoonfoto", "Ongepolijst"], "desc": "Maximale authenticiteit. Werkt goed als eerste kennismaking met een merk.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "news-headline-advertorial", "cat": "E", "catLabel": "E · Editorial & advertorial", "name": "News headline / advertorial", "tags": ["Kop", "Intro", "Artikel-opmaak"], "desc": "Leent geloofwaardigheid van nieuwsmedia. Linkt idealiter door naar een advertorial-landingspagina.", "brandless": true, "cta": "soft", "proof": false, "dest": "advertorial"}, {"id": "magazine-cover", "cat": "E", "catLabel": "E · Editorial & advertorial", "name": "Magazine cover", "tags": ["Covermodel", "Coverlines"], "desc": "Premium uitstraling en compleet anders dan de feed. Coverlines zijn feitelijk 3 gratis extra headlines.", "brandless": true, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "founder-note", "cat": "E", "catLabel": "E · Editorial & advertorial", "name": "Founder note", "tags": ["Oprichtersbrief", "Persoonlijk"], "desc": "Bouwt merk en vertrouwen. Sterk voor kleinere merken tegenover grote anonieme spelers.", "brandless": false, "cta": "none", "proof": false, "dest": "pdp"}, {"id": "seizoensmoment-editorial", "cat": "E", "catLabel": "E · Editorial & advertorial", "name": "Seizoensmoment editorial", "tags": ["Seizoensbeeld", "Moment-claim"], "desc": "Actualiteit geeft een bestaande message een nieuwe reden om nu te kopen.", "brandless": false, "cta": "soft", "proof": false, "dest": "pdp"}];
var AD_FORMAT_DIRECTIVE = {"product-hero": "Product Hero — Eén grote productfoto op een rustige achtergrond met één korte headline. Geen lijstjes — het product en één boodschap zijn de hele ad. Inzet: Inzetten als het product er zelf goed uitziet en je één scherpe belofte hebt. Test verschillende koppen op hetzelfde beeld. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "feature-callout": "Feature Callout — Het product centraal met 4–6 pijlen naar buiten, elk met een korte featurelabel. Oogt als een technische productposter. Inzet: Voor mensen die al vergelijken — alle koopargumenten in één oogopslag, zonder doorklikken. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "benefit-stack": "Benefit Stack — Productfoto met 3–5 checkmarks met voordelen, sterren, reviewscore en een knop. Lijkt op een mini-productpagina in de feed. Inzet: Sterk retargeting-format: de hele pitch voor wie de site al bezocht. Zet de drie belangrijkste koopredenen erin. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; duidelijke gouden CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "what-s-in-the-box": "What's in the box — Alle onderdelen recht van boven gefotografeerd. De kijker ziet in één beeld alles wat hij krijgt. Inzet: Sterk bij bundels en producten met accessoires. Headline die de totaalwaarde of het gemak benadrukt. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "exploded-view": "Exploded view — Het product zwevend uit elkaar getrokken, als een technische tekening. Oogt premium en doordacht. Inzet: Bewijst een kwaliteits- of technologieclaim visueel. Vooral effectief als je duurder bent. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "offer-bundle-stack": "Offer / Bundle Stack — Meerdere producten op een stapel met per item de waarde en onderaan een doorgestreepte totaalprijs. Inzet: Bij promo-momenten en warm publiek. Waarde-stapeling maakt de deal voelbaar groter dan een kaal kortingspercentage. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; duidelijke gouden CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "grid-collage": "Grid / Collage — Eén beeld in 4–6 vakken: product, gebruik, resultaat, review-quote. Samen een mini-verhaal. Inzet: Handig als één foto het product niet kan dragen. Elk vak moet op zichzelf te snappen zijn; max 6 vakken. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "prijsanker-deal": "Prijsanker / Deal — De prijs of korting is het grootste element, groter dan het product. Vaak met doorgestreepte oude prijs. Inzet: Alleen tijdens echte sale-momenten, anders leer je je publiek op korting wachten. Werkt best op retargeting. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; duidelijke gouden CTA-pill; geen Trustpilot-pill nodig.]", "gift-guide": "Gift Guide — Het product als cadeau voor een specifiek persoon of moment, met cadeau-styling en een kop als “het cadeau voor [persoon]”. Inzet: Richt je op de gever i.p.v. de gebruiker — een nieuw publiek. In de weken voor feestdagen; combineer met een bundel. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "testimonial-pull-quote": "Testimonial pull-quote — Eén klantquote groot in beeld als een poster, met daaronder klein de naam. De quote is de held. Inzet: Kies een quote die specifiek is (getal, tijdsbestek) en het grootste koopbezwaar wegneemt. Test meerdere quotes. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "review-wall": "Review wall — Drie tot vijf reviews met sterren gestapeld, vaak met de totaalscore bovenaan. Een muur van bewijs. Inzet: Als de hoeveelheid bewijs zelf het argument is. Sterk op twijfelaars in retargeting. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "5-sterren-cards": "5-sterren cards — Losse kaartjes met klantfoto, vijf sterren en één zin review. Voelt als een sociale feed vol tevreden klanten. Inzet: Laat verschillende klanttypes zien zodat meerdere doelgroepen zich herkennen. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "review-screenshot": "Review screenshot — Letterlijke screenshot van een echte review (Trustpilot, Bol, Google), inclusief interface-elementen. Inzet: Die zichtbare UI maakt het geloofwaardig — het voelt als bewijs. Gebruik echte reviews, zo onbewerkt mogelijk. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "whatsapp-chat": "WhatsApp / chat — Nagebootst chatgesprek tussen twee vrienden waarin de één het product aanraadt, als een echte WhatsApp-conversatie. Inzet: Simuleert een aanbeveling van een vriend. Kort en spreektaal; het product komt pas in het tweede bericht. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "tweet-reddit-screenshot": "Tweet / Reddit screenshot — Screenshot van een opgemaakte social post met een sterke one-liner over het product of het probleem. Inzet: Voertuig voor een gewaagde of grappige uitspraak die je als merk niet rechtstreeks zou doen. Top-of-funnel. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "ig-comment-section": "IG comment section — Productbeeld met daaronder een nagebootste reeks Instagram-comments van enthousiaste klanten. Inzet: Simuleert hype en discussie. Laat één comment een bezwaar stellen en beantwoord die in de reply. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "tiktok-made-me-buy-it": "TikTok-made-me-buy-it — Een still uit een UGC-video met de bekende caption-balk erover, verwijzend naar de virale status. Inzet: Speelt op nieuwsgierigheid en FOMO. Sterk voor producten met een visueel wow-moment. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "stat-data-callout": "Stat / Data Callout — Eén groot getal domineert: reviewscore, aantal verkocht of onderzoeksresultaat. De rest is minimaal. Inzet: Cijfers stoppen de scroll en maken een vage claim concreet. Hoe specifieker, hoe geloofwaardiger. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; Trustpilot/social-proof zichtbaar (4,5/5 + reviewaantal).]", "ugc-still-klantfoto": "UGC-still / klantfoto — Echte, ongepolijste foto die een klant zelf maakte van het product in gebruik, bewust niet opgepoetst. Inzet: Top-of-funnel omdat het niet als advertentie oogt. Vraag klanten actief om foto’s. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "us-vs-them-tabel": "Us vs Them tabel — Gesplitst beeld: links jouw product, rechts “de rest”, met vinkjes bij jou en kruisjes bij hen. Inzet: Topformat voor wie al vergelijkt — jij vult hun lijstje in. Vergelijk met een categorie, niet met een merknaam. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "before-after": "Before / After — Twee beelden: links het probleem, rechts het resultaat met jouw product. Het contrast is de boodschap. Inzet: Sterkste vorm van show don’t tell. Houd het realistisch, anders keurt Meta hem af. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "3-redenen-waarom": "3 redenen waarom — Genummerde lijst met drie argumenten als kern van het beeld, met per reden één regel uitleg. Inzet: De structuur maakt de ad snel scanbaar. Bewijs elk argument kort in plaats van alleen te claimen. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "checklist-herkenbaar": "Checklist / Herkenbaar? — Een checklist van pijnpunten waar de kijker zich in herkent, met vinkjes en pas onderaan de oplossing. Inzet: De kijker kwalificeert zichzelf als doelgroep vóór het product genoemd is. Sterk op koud publiek dat de pijn voelt. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "how-it-works": "How it works — Visual of drie stappen die uitleggen waarom het product anders werkt: het principe erachter. Inzet: Onmisbaar in een markt vol beloftes. Gebruik als de kijker al meerdere producten probeerde die niet werkten. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "faq-objection": "FAQ / Objection — De headline is de meest gestelde twijfelvraag, met daaronder kort het antwoord plus bewijs. Inzet: Voor warm publiek dat op één bezwaar blijft hangen. Maak per hoofdbezwaar een aparte versie. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "mythe-vs-feit": "Mythe vs Feit — Bovenaan een hardnekkig geloof met “MYTHE”, daaronder de werkelijkheid met “FEIT”. Inzet: Positioneert het merk als expert en geeft een aha-moment. Goede opstap naar je mechanisme. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "kostenvergelijking": "Kostenvergelijking — Simpele rekensom: wat het alternatief per maand/jaar kost, naast de prijs van jouw product. Inzet: Rationeel en deelbaar, zeker als het alternatief terugkerende kosten heeft. Reken conservatief. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "persona-callout": "Persona callout — De ad spreekt één groep rechtstreeks aan: “Voor [type] die [situatie]”. Beeld en toon volledig afgestemd. Inzet: Kleiner bereik, totale herkenning. Zoek de sub-identiteit die concurrenten niet benoemen. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "probleem-agitatie": "Probleem-agitatie — Het pijnpunt zelf staat groot en uitvergroot in beeld, met de oplossing slechts klein onderaan. Inzet: Voor koud publiek dat de pijn dagelijks voelt. De ad bewijst eerst dat je het probleem snapt. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "wist-je-dat": "Wist-je-dat — Een verrassend feitje uit de categorie als grote kop, met het product pas als voetnoot. Inzet: Voor publiek dat nog niet weet dat het een probleem heeft. Het feitje moet echt kloppen en verrassen. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "ugly-ad": "Ugly ad — Bewust lelijke ad: felle vlakken, systeemlettertype, geen design, alsof een amateur hem maakte. Inzet: Valt juist op tussen gepolijste ads en scoort hoog op CTR. Alleen top-of-funnel; bewaak je merk. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "meme-format": "Meme-format — Bekende meme-structuur met humor uit jouw categorie. De grap staat centraal, het product is de punchline. Inzet: Goedkoop, snel en deelbaar. Alleen voor koud publiek en merken waar humor past. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "whiteboard-notitie": "Whiteboard / notitie — Foto van een whiteboard of notitie-app waarin de pitch handgeschreven staat, alsof iemand het snel opschreef. Inzet: Voelt als een insider-tip. Sterk voor het uitleggen van een simpele rekensom of lijstje. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "search-bar-ad": "Search bar ad — Nagemaakte zoekbalk (Google-stijl) met een herkenbare zoekopdracht plus de suggestie-dropdown. Inzet: De kijker herkent zijn eigen zoekgedrag. Gebruik de letterlijke zoektermen die klanten intypen. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "reminder-ad": "Reminder ad — Vrijwel kale tekst-ad die leest als een persoonlijke herinnering: “Reminder: je wilde nog...”. Inzet: Sterk in retargeting op site-bezoekers. De lage productie is de kracht: het voelt als een berichtje. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]", "notification-screenshot": "Notification screenshot — Nagebootste telefoon-notificatie als beeld, met tekst die inhaakt op het product of gebruiksmoment. Inzet: Iedereen kijkt reflexmatig naar notificaties. Koppel aan een concreet moment waarop het product nodig is. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "post-it-handgeschreven": "Post-it / handgeschreven — Handgeschreven briefje gefotografeerd in een echte omgeving: op de spiegel, de koelkast of verpakking. Inzet: Persoonlijk en goedkoop. Werkt goed met een boodschap van een ander personage (partner, huisgenoot). [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "photo-dump-casual": "Photo dump / casual — Ongepolijste telefoonfoto van het product in het echte leven, alsof een vriend hem stuurde. Inzet: Maximale authenticiteit voor een eerste kennismaking. Het gebrek aan opmaak is het format. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "news-headline-advertorial": "News headline / advertorial — Opgemaakt als nieuwsartikel: krantenkop, subkop, intro-alinea, eventueel auteur en datum. Inzet: Leent geloofwaardigheid van journalistiek. Laat doorlinken naar een advertorial-landingspagina. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig; de ad leidt naar een redactioneel artikel/advertorial, niet direct naar de PDP; niet hard verkopen, teasen met nieuwsgierigheid, geen prijs/merknaam.]", "magazine-cover": "Magazine cover — Het product of een klant als covermodel van een fictief magazine, met logo, coverlines en barcode. Inzet: Coverlines zijn feitelijk gratis extra headlines. Premium uitstraling die boven de feed uitkomt. [ANATOMIE, HARD: BEWUST MERKLOOS: geen wordmark, native/organische uitstraling alsof het geen advertentie is; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "founder-note": "Founder note — Korte persoonlijke brief van de oprichter met naam en handtekening: waarom het merk bestaat. Inzet: Bouwt vertrouwen tegenover grote anonieme spelers. Eerlijkheid werkt hier beter dan perfectie. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; GEEN CTA-pill; geen Trustpilot-pill nodig.]", "seizoensmoment-editorial": "Seizoensmoment editorial — Editorial beeld dat een moment claimt: feestdag of seizoenswissel, met het product in die context. Inzet: Actualiteit geeft een reden om nú te kopen. Plan vooruit; vervang alleen de context, niet de kernboodschap. [ANATOMIE, HARD: WELLSHAVE wordmark subtiel aanwezig; hooguit een zachte CTA of kleine knop; geen Trustpilot-pill nodig.]"};

AD_FORMAT_DIRECTIVE['auto'] = 'Auto: kies zelf per variatie het sterkste format uit de 42 (categorieen: Product-led, Social proof, Vergelijking & educatie, Native & lo-fi, Editorial & advertorial) op basis van funnel, awareness en angle. Bij 2+ variaties spreid je bewust over verschillende formats/categorieen zodat de batch varieert.';
function brainDumpFormatBlock(){
  try {
    var lines = AD_FORMATS.map(function(f){ return f.id + ' — ' + f.name + ' (' + String(f.catLabel).replace(/^[A-E] . /,'') + '): ' + f.desc; }).join('\n');
    return '\n\n# FORMAT-KEUZE (OVERSCHRIJFT elke eerdere format-mode-lijst)\n'
      + 'Negeer de oude 6 format-modes volledig. Kies voor "suggested_mode" EXACT een van deze 42 format-ids hieronder (of "auto"). Kies het format dat de gekozen invalshoek en awareness het sterkst uitvoert.\n'
      + lines
      + '\n\n# HYPOTHESE\nGeef ook "suggested_hypothese": een heldere, toetsbare hypothese in 1 Nederlandse zin in de vorm "Als we [doelgroep] met [invalshoek] in [format] aanspreken, dan [verwacht effect], omdat [reden]". Dit is wat we met deze ad willen bewijzen.';
  } catch(e){ return ''; }
}
function isNewsFormat(m){ return m==='news-headline-advertorial' || m==='advertorial-news'; }
function isBundleFormat(m){ return m==='offer-en-bundle-stack' || m==='offer-bundle-stack' || m==='bundle-showcase'; }
var OLD_MODE_TO_FMT = { 'direct-response':'benefit-stack','brand-builder':'product-hero','feature-education':'feature-callout','bundle-showcase':'offer-bundle-stack','lifestyle-placement':'photo-dump-casual','advertorial-news':'news-headline-advertorial','auto':'auto' };
var fmtFilter = 'all';
function fmtSelected(){ var r=document.getElementById('fmt-radio'); return r ? r.value : 'auto'; }
function pickFormat(id){ var r=document.getElementById('fmt-radio'); if(!r) return; r.value=id; r.checked=true; try{ localStorage.setItem((STORAGE_PREFIX+'mode'), id); }catch(e){} renderFmtPicker(); if(typeof applyModeFieldLogic==='function') applyModeFieldLogic(); }
function fmtSetFilter(k){ fmtFilter=k; renderFmtPicker(); }
function fmtCard(f, sel){
  var on=(sel===f.id);
  var tags=(f.tags||[]).map(function(t){return '<span class="fmt-tag">'+escapeHtml(t)+'</span>';}).join('');
  var flags='';
  if(f.brandless) flags+='<span class="fmt-flag">native</span>';
  if(f.dest==='advertorial') flags+='<span class="fmt-flag">advertorial</span>';
  return '<div class="fmt-card'+(on?' on':'')+'" onclick="pickFormat(\''+f.id+'\')"><div class="fmt-card-h"><span class="fmt-name">'+escapeHtml(f.name)+'</span>'+flags+'</div><div class="fmt-tags">'+tags+'</div><div class="fmt-desc">'+escapeHtml(f.desc)+'</div></div>';
}
function renderFmtPicker(){
  var grid=document.getElementById('fmt-grid'); var chips=document.getElementById('fmt-chips'); if(!grid||!chips) return;
  var sel=fmtSelected();
  var cats=[{key:'all',label:'Alle 42'}].concat(AD_FORMAT_CATS);
  chips.innerHTML=cats.map(function(c){ var lab=c.label.replace(/^[A-E] . /,''); return '<div class="fmt-chip'+(fmtFilter===c.key?' on':'')+'" onclick="fmtSetFilter(\''+c.key+'\')">'+escapeHtml(lab)+'</div>'; }).join('');
  var cards='';
  if(fmtFilter==='all'){ cards+=fmtCard({id:'auto',name:'Auto',tags:['Claude kiest'],desc:'Claude kiest per variatie het sterkste format en spreidt over categorieen bij een batch.',brandless:false,dest:'pdp'}, sel); }
  AD_FORMATS.forEach(function(f){ if(fmtFilter==='all'||f.cat===fmtFilter) cards+=fmtCard(f, sel); });
  grid.innerHTML=cards;
}
try {
  var _fmtBoot=function(){ try{ var sm=localStorage.getItem(STORAGE_PREFIX+'mode'); var r=document.getElementById('fmt-radio'); if(r && sm && (sm==='auto'||AD_FORMAT_DIRECTIVE[sm])) r.value=sm; }catch(e){} renderFmtPicker(); };
  if(document.readyState!=='loading') _fmtBoot(); else document.addEventListener('DOMContentLoaded', _fmtBoot);
} catch(e){}

function applyModeFieldLogic() {
  const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };
  // De Nieuwsartikel-mode (en het briefing-veld) horen ALLEEN bij de Generator (scratch).
  // In Kopieer ad en Itereren laten we de veld-zichtbaarheid aan de mode-CSS over.
  const isScratch = (!state.generatorMode || state.generatorMode === 'scratch');
  if (!isScratch) {
    show('news-article-field', false);
    show('bundle-field', false);
    ['archetype-field', 'concept-field', 'offer-field'].forEach(function(id){ const el = document.getElementById(id); if (el) el.style.display = ''; });
    return;
  }
  const checkedMode = document.querySelector('input[name=mode]:checked');
  const mode = checkedMode ? checkedMode.value : 'auto';
  const isNews = isNewsFormat(mode);
  show('news-article-field', isNews);
  show('archetype-field', !isNews);
  show('concept-field', !isNews);
  // Bundel-producten alleen tonen bij Bundle-Showcase mode (staat nu onder de productkeuze)
  show('bundle-field', isBundleFormat(mode));
  const arch = document.querySelector('input[name="archetype"]:checked');
  show('offer-field', !isNews && !!arch && arch.value === 'offer');
}
const toggleNewsArticleField = applyModeFieldLogic; // backwards-compat alias
document.querySelectorAll('input[name=mode]').forEach(r => {
  r.addEventListener('change', (e) => {
    if (e.target.checked) localStorage.setItem((STORAGE_PREFIX+'mode'), e.target.value);
    applyModeFieldLogic();
  });
});
document.querySelectorAll('input[name="archetype"]').forEach(r => {
  r.addEventListener('change', applyModeFieldLogic);
});
applyModeFieldLogic();

// ============================================================
// GENERATE (Anthropic, concepts)
// ============================================================
// ============================================================
// COPY-FROM-AD MODE
// ============================================================
function setMode(mode) {
  state.generatorMode = mode;
  const special = (mode === 'copy' || mode === 'iterate');
  document.getElementById('mode-tab-scratch').classList.toggle('active', mode === 'scratch');
  document.getElementById('mode-tab-copy').classList.toggle('active', mode === 'copy');
  document.getElementById('source-ad-section').classList.toggle('active', special);

  document.body.classList.toggle('copy-mode-active', mode === 'copy');
  document.body.classList.toggle('iterate-mode-active', mode === 'iterate');
  /* De itereerwizard tekent zichzelf zodra de modus aangaat. Zonder dit staat
     hij leeg als je via de modusknop binnenkomt in plaats van via het menu --
     twee ingangen naar hetzelfde scherm en maar een ervan tekent, is precies
     het soort verschil dat je pas ziet als iemand het meldt. */
  if (mode === 'iterate' && typeof renderItereerWizard === 'function') renderItereerWizard();

  // scratch-only elementen (format mode, funnel, archetype, concept-suggester) verbergen in copy en iterate
  document.querySelectorAll('.scratch-only').forEach(el => {
    el.classList.toggle('copy-mode-hidden', special);
  });

  if (special) {
    document.querySelectorAll('input[name="archetype"]').forEach(r => { r.checked = false; });
    document.querySelectorAll('input[name="funnel"]').forEach(r => { r.checked = false; });
  } else {
    const hasArchetype = document.querySelector('input[name="archetype"]:checked');
    if (!hasArchetype) {
      const def = document.querySelector('input[name="archetype"][value="premium"]');
      if (def) def.checked = true;
    }
    const hasFunnel = document.querySelector('input[name="funnel"]:checked');
    if (!hasFunnel) {
      const def = document.querySelector('input[name="funnel"][value="tof"]');
      if (def) def.checked = true;
    }
  }

  const conceptLabel = document.getElementById('concept-label');
  const conceptHint = document.getElementById('concept-label-hint');
  const conceptInput = document.getElementById('concept-input');
  const generateBtn = document.getElementById('generate-btn');
  const generateMeta = document.getElementById('generate-meta');
  const srcLabel = document.getElementById('source-ad-label');
  const srcTitle = document.getElementById('source-ad-dropzone-title');
  const srcHint = document.getElementById('source-ad-dropzone-hint');
  if (mode === 'copy') {
    if (conceptLabel) conceptLabel.textContent = 'Extra wensen bij de kopie';
    if (conceptHint) conceptHint.textContent = 'optioneel, bv "make it about WK" of "focus op gevoelige zones in plaats van algemeen"';
    if (conceptInput) conceptInput.placeholder = 'Optionele aanpassingen bovenop wat Claude uit de bron-ad haalt. Bv: vertaal de mechaniek naar Bodygroomer in plaats van Shaver, of leg de focus op pijnloos scheren.';
    if (generateBtn) generateBtn.textContent = 'Analyseer bron en genereer de variant';
    if (generateMeta) generateMeta.textContent = 'Stap 1: Claude analyseert de bron-ad mechaniek, stap 2: Claude genereert de variant met jouw product en persona, stap 3: per variatie image generation (OpenAI). Productreferenties van het merk worden gebruikt, bron-ad gaat NIET naar OpenAI.';
    if (srcLabel) srcLabel.innerHTML = 'Bron-ad <span class="label-hint">screenshot of export van de ad die je wilt kopieren, Claude analyseert de mechaniek</span>';
    if (srcTitle) srcTitle.textContent = 'Sleep een ad-screenshot hierheen of klik om te kiezen';
    if (srcHint) srcHint.textContent = 'PNG of JPG, maximaal 5MB. Bv een Manscaped, Philips of Braun ad die hard converteert. De bron-ad gaat alleen naar Claude voor analyse, niet naar OpenAI.';
  } else if (mode === 'iterate') {
    if (conceptLabel) conceptLabel.textContent = 'Extra richting voor de iteraties';
    if (conceptHint) conceptHint.textContent = 'optioneel';
    if (conceptInput) conceptInput.placeholder = 'Optioneel, bv "test ook een hardere prijs-CTA" of "probeer een variant zonder model in beeld".';
    if (generateBtn) generateBtn.textContent = 'Analyseer en genereer iteraties';
    if (generateMeta) generateMeta.textContent = 'Stap 1: Rory leest je winnende ad plus de cijfers, stap 2: testbare iteraties die de winnaar vasthouden, stap 3: per iteratie image generation (OpenAI). De winnende ad gaat alleen naar Claude.';
    if (srcLabel) srcLabel.innerHTML = 'Winnende ad <span class="label-hint">je eigen ad die goed presteert, Claude analyseert waarom hij werkt</span>';
    if (srcTitle) srcTitle.textContent = 'Sleep je winnende ad hierheen of klik om te kiezen';
    if (srcHint) srcHint.textContent = 'De ad die goed presteert. PNG of JPG, maximaal 5MB. Gaat alleen naar Claude voor analyse, niet naar OpenAI.';
  } else {
    if (conceptLabel) conceptLabel.textContent = 'Concept-richting';
    if (conceptHint) conceptHint.textContent = 'optioneel';
    if (conceptInput) conceptInput.placeholder = 'Bijvoorbeeld: voor mannen met gevoelige huid, of Black Friday bundel met urgentie, of een founder-story met persvermelding';
    if (generateBtn) generateBtn.textContent = 'Genereer variaties';
    if (generateMeta) generateMeta.textContent = 'Stap 1: concepts (Anthropic), stap 2: per variatie image generation (OpenAI). Productreferenties worden meegestuurd.';
  }
  if (typeof applyModeFieldLogic === 'function') applyModeFieldLogic();
}

function handleSourceAdUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Alleen afbeeldingen worden ondersteund', true);
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast('Bestand te groot, max 5MB', true);
    return;
  }
  compressImage(file, 1280, 0.88).then(dataUrl => {
    const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) {
      toast('Kon afbeelding niet parsen', true);
      return;
    }
    state.sourceAd = {
      b64: parts[2],
      mimeType: parts[1],
      fileName: file.name,
      size: file.size,
      uploadedAt: Date.now()
    };
    renderSourceAdPreview();
  }).catch(err => {
    toast('Kon afbeelding niet verwerken: ' + err.message, true);
  });
}

function renderSourceAdPreview() {
  const dropzone = document.getElementById('source-ad-dropzone');
  const preview = document.getElementById('source-ad-preview');
  if (!state.sourceAd) {
    dropzone.style.display = '';
    preview.style.display = 'none';
    preview.innerHTML = '';
    return;
  }
  dropzone.style.display = 'none';
  preview.style.display = 'flex';
  const dataUrl = `data:${state.sourceAd.mimeType};base64,${state.sourceAd.b64}`;
  const sizeKb = Math.round(state.sourceAd.size / 1024);
  preview.innerHTML = `
    <div class="source-ad-preview-image"><img src="${dataUrl}" alt="bron-ad"></div>
    <div class="source-ad-preview-info">
      <div>
        <div class="source-ad-preview-name">${escapeHtml(state.sourceAd.fileName)}</div>
        <div class="source-ad-preview-meta">${sizeKb} KB, geupload zojuist</div>
        <div class="source-ad-preview-desc">Deze ad wordt alleen naar Claude gestuurd voor mechaniek-analyse. Het product en persona vullen we apart in. De bron-ad gaat NOOIT naar OpenAI.</div>
      </div>
      <button class="source-ad-remove-btn" onclick="removeSourceAd()">Verwijder en upload een andere</button>
    </div>
  `;
}

function removeSourceAd() {
  state.sourceAd = null;
  renderSourceAdPreview();
}

// Drag-and-drop op de dropzone
function setupSourceAdDragDrop() {
  const dropzone = document.getElementById('source-ad-dropzone');
  if (!dropzone) return;
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragging');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleSourceAdUpload({ target: { files: [files[0]], value: '' } });
    }
  });
}

// ============================================================
// DISPATCH GENERATE: kiest scratch- of copy-mode
// ============================================================
// ============================================================
// BRAIN DUMP: snelle start intake
// ============================================================
const BRAIN_DUMP_SYSTEM_PROMPT_WS = `Je bent een Wellshave creative-strategist die snelle intakes doet voor Meta-ad concepten. De gebruiker (Dustin, founder van Wellshave) geeft je een vrije brain dump in het Nederlands en jij stelt voor:
1) funnel-fase (tof/mof/bof/retargeting)
2) archetype
3) format mode
4) concept-richting in NL
5) eventueel persona-match uit zijn library
6) market sophistication (1-5) en customer awareness (waar de doelgroep mentaal staat)

# JE BESLISSINGSPROCES (volg deze volgorde)

**STAP 1, TIJD-CONTEXT lezen**
Noemt de tekst een seizoen, event, deadline (WK, Black Friday, Vaderdag, Kerst, lente, morgen leveren)? Dat bepaalt vaak of het Seasonal archetype is en welke funnel-fase past (events met opbouw = TOF, deadlines = BOF/Re-targeting).

**STAP 2, FUNNEL-FASE bepalen**
Hoe ver staat de doelgroep in de customer journey?
- Brand-introductie, nieuwe lancering, "audience kent ons nog niet", awareness, intro = TOF
- Audience kent product, weegt af tegen concurrent, vergelijking, twijfel, "anders dan Philips" = MOF
- Audience is klaar om te kopen, deal, closing, bundle, kortingstrigger = BOF
- Cart-abandoners, herinneren, "ze waren bijna over", warm publiek = Re-targeting

**STAP 3, HOOK + ARCHETYPE bepalen**
Welke insteek past bij wat de gebruiker eigenlijk wil zeggen?
- Pain, frustratie, irritatie, klanten klagen = Persstory of Contraire stelling
- Vergelijking met concurrent of vroegere oplossing = Comparison of Before-after
- Sociaal bewijs, getallen, reviews = UGC, Authority of Getal-claim
- Inzicht delivery, "wist je dat", educatief = Educational
- Identiteit, lifestyle, premium gevoel, exclusiviteit = Premium
- Vondst, aha-moment, verrassing = Vondst hook
- Founder, oprichter, Dustin, verhaal achter het merk = Founder-story
- Trend, viral, TikTok, seizoen = Trend of Seasonal
- Klacht of bezwaar wegnemen = Objection-reply
- Analogie, metafoor, "alsof X" = Analogie

**STAP 4, FORMAT MODE volgt uit funnel + archetype**
- TOF + Premium/Persstory = Brand-Builder (minimal, geen Trustpilot, geen CTA, focus op aesthetic)
- TOF + lifestyle-foto centraal = Lifestyle-Placement (product subtiel in een setting)
- MOF + Educational/Comparison = Feature-Education (uitleg, vergelijking, demo)
- MOF/BOF + Offer/UGC/Authority = Direct-Response (volle stack met Trustpilot, CTA-pill, trust-anker)
- BOF + meerdere producten samen = Bundle-Showcase (prijs + savings, geen CTA-pill)

**STAP 5, PERSONA-MATCH**
Noemt de tekst een specifieke groep (jonge vaders, sporters, kantoormedewerkers, expats)? Match met de meegegeven persona-library als die past. Anders: laat persona_id leeg.

**STAP 6, CONFLICT-DETECTIE**
Zitten er tegenstrijdige signalen in de brain dump? Bv "premium gevoel" + "70% korting", of "TOF awareness" + "bestel nu". Flag dat in conflicts en suggereer een resolutie. Vaak: framings combineren door één dominant te maken en de andere subtiel te integreren.

**STAP 7, CONCEPT-RICHTING**
Maak een concrete concept-richting in 1-2 NL zinnen die de gebruiker direct in het concept-veld kan gebruiken. Niet abstract, maar concreet genoeg dat een copywriter ermee kan starten.

# OUTPUT FORMAT

Strict JSON, alleen het object, geen markdown of code-fences:

{
  "suggested_funnel": "tof|mof|bof|retargeting",
  "suggested_archetype": "premium|educational|ugc|authority|offer|comparison|before_after|founder_story|seasonal|objection_reply|analogie|trend",
  "suggested_mode": "een format-id uit de FORMAT-KEUZE-lijst hieronder, of auto",
  "suggested_hypothese": "1 toetsbare hypothese-zin: Als we ... dan ... omdat ...",
  "suggested_concept": "Concrete concept-richting in 1-2 NL zinnen, direct bruikbaar in het concept-veld",
  "suggested_persona_id": "persona-id uit de library of leeg string als geen match",
  "suggested_sophistication": "1|2|3|4|5 of leeg, het market-sophistication-stadium dat bij deze richting past (grooming is doorgaans 3-4)",
  "suggested_awareness": "unaware|problem|solution|product|most of leeg, het awareness-niveau waarop de ad moet openen",
  "summary_nl": "1 zin samenvatting van wat de ad moet doen, wat is de centrale insight?",
  "reasoning_nl": "3-5 zinnen waarom DEZE funnel/archetype/mode-combinatie past bij de brain dump. Verwijs naar specifieke signalen uit de input. Wees concreet, niet generiek.",
  "conflicts": "Lege string als geen conflict. Anders: 1-2 zinnen die het conflict benoemen en een resolutie voorstellen."
}

Geen extra text, alleen het JSON-object. GEEN em-dashes anywhere.
`;
const BRAIN_DUMP_SYSTEM_PROMPT_WSH = `Je bent een Wellshine creative-strategist die snelle intakes doet voor Meta-ad concepten. De gebruiker (Dustin, founder van Wellshine) geeft je een vrije brain dump in het Nederlands en jij stelt voor:
1) funnel-fase (tof/mof/bof/retargeting)
2) archetype
3) format mode
4) concept-richting in NL
5) eventueel persona-match uit zijn library
6) market sophistication (1-5) en customer awareness (waar de doelgroep mentaal staat)

# JE BESLISSINGSPROCES (volg deze volgorde)

**STAP 1, TIJD-CONTEXT lezen**
Noemt de tekst een seizoen, event, deadline (WK, Black Friday, Vaderdag, Kerst, lente, morgen leveren)? Dat bepaalt vaak of het Seasonal archetype is en welke funnel-fase past (events met opbouw = TOF, deadlines = BOF/Re-targeting).

**STAP 2, FUNNEL-FASE bepalen**
Hoe ver staat de doelgroep in de customer journey?
- Brand-introductie, nieuwe lancering, "audience kent ons nog niet", awareness, intro = TOF
- Audience kent product, weegt af tegen concurrent, vergelijking, twijfel, "anders dan een concurrent" = MOF
- Audience is klaar om te kopen, deal, closing, bundle, kortingstrigger = BOF
- Cart-abandoners, herinneren, "ze waren bijna over", warm publiek = Re-targeting

**STAP 3, HOOK + ARCHETYPE bepalen**
Welke insteek past bij wat de gebruiker eigenlijk wil zeggen?
- Pain, frustratie, irritatie, klanten klagen = Persstory of Contraire stelling
- Vergelijking met concurrent of vroegere oplossing = Comparison of Before-after
- Sociaal bewijs, getallen, reviews = UGC, Authority of Getal-claim
- Inzicht delivery, "wist je dat", educatief = Educational
- Identiteit, lifestyle, premium gevoel, exclusiviteit = Premium
- Vondst, aha-moment, verrassing = Vondst hook
- Founder, oprichter, verhaal achter het merk = Founder-story
- Trend, viral, TikTok, seizoen = Trend of Seasonal
- Klacht of bezwaar wegnemen = Objection-reply
- Analogie, metafoor, "alsof X" = Analogie

**STAP 4, FORMAT MODE volgt uit funnel + archetype**
- TOF + Premium/Persstory = Brand-Builder (minimal, geen meer dan 200 vrouwen gingen je voor, geen CTA, focus op aesthetic)
- TOF + lifestyle-foto centraal = Lifestyle-Placement (product subtiel in een setting)
- MOF + Educational/Comparison = Feature-Education (uitleg, vergelijking, demo)
- MOF/BOF + Offer/UGC/Authority = Direct-Response (volle stack met meer dan 200 vrouwen gingen je voor, CTA-pill, trust-anker)
- BOF + meerdere producten samen = Bundle-Showcase (prijs + savings, geen CTA-pill)

**STAP 5, PERSONA-MATCH**
Noemt de tekst een specifieke groep (jonge vaders, sporters, kantoormedewerkers, expats)? Match met de meegegeven persona-library als die past. Anders: laat persona_id leeg.

**STAP 6, CONFLICT-DETECTIE**
Zitten er tegenstrijdige signalen in de brain dump? Bv "premium gevoel" + "70% korting", of "TOF awareness" + "bestel nu". Flag dat in conflicts en suggereer een resolutie. Vaak: framings combineren door één dominant te maken en de andere subtiel te integreren.

**STAP 7, CONCEPT-RICHTING**
Maak een concrete concept-richting in 1-2 NL zinnen die de gebruiker direct in het concept-veld kan gebruiken. Niet abstract, maar concreet genoeg dat een copywriter ermee kan starten.

# OUTPUT FORMAT

Strict JSON, alleen het object, geen markdown of code-fences:

{
  "suggested_funnel": "tof|mof|bof|retargeting",
  "suggested_archetype": "premium|educational|ugc|authority|offer|comparison|before_after|founder_story|seasonal|objection_reply|analogie|trend",
  "suggested_mode": "een format-id uit de FORMAT-KEUZE-lijst hieronder, of auto",
  "suggested_hypothese": "1 toetsbare hypothese-zin: Als we ... dan ... omdat ...",
  "suggested_concept": "Concrete concept-richting in 1-2 NL zinnen, direct bruikbaar in het concept-veld",
  "suggested_persona_id": "persona-id uit de library of leeg string als geen match",
  "suggested_sophistication": "1|2|3|4|5 of leeg, het market-sophistication-stadium dat bij deze richting past (grooming is doorgaans 3-4)",
  "suggested_awareness": "unaware|problem|solution|product|most of leeg, het awareness-niveau waarop de ad moet openen",
  "summary_nl": "1 zin samenvatting van wat de ad moet doen, wat is de centrale insight?",
  "reasoning_nl": "3-5 zinnen waarom DEZE funnel/archetype/mode-combinatie past bij de brain dump. Verwijs naar specifieke signalen uit de input. Wees concreet, niet generiek.",
  "conflicts": "Lege string als geen conflict. Anders: 1-2 zinnen die het conflict benoemen en een resolutie voorstellen."
}

Geen extra text, alleen het JSON-object. GEEN em-dashes anywhere.
`;
const BRAIN_DUMP_SYSTEM_PROMPT = (ACTIVE_BRAND==='wellshine') ? BRAIN_DUMP_SYSTEM_PROMPT_WSH : BRAIN_DUMP_SYSTEM_PROMPT_WS;

async function analyzeBrainDump() {
  const input = document.getElementById('brain-dump-input').value.trim();
  if (!input) {
    toast('Type eerst een brain dump', true);
    return;
  }
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) {
    toast('Eerst Anthropic API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('brain-dump-analyze-btn');
  const meta = document.getElementById('brain-dump-meta');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> Rory denkt na...';
  if (meta) meta.textContent = 'Rory leest je brain dump en bepaalt de richting...';

  // Build user prompt with available personas as context
  const personasList = (state.personas || []).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description || ''
  }));
  const userPrompt = `# BRAIN DUMP VAN DE GEBRUIKER\n\n${input}\n\n# BESCHIKBARE PERSONAS\n\n${personasList.length > 0 ? JSON.stringify(personasList, null, 2) : '(geen personas in library)'}\n\nGeef je analyse als strict JSON volgens het format in het system prompt.`;

  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1500,
        system: BRAIN_DUMP_SYSTEM_PROMPT + '\n\n' + CREATIVE_STRATEGIST_SKILL + brandProfileBlock() + brainDumpFormatBlock(),
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const text = wgClaudeText(data).trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Geen JSON gevonden in Claude response');
    const parsed = JSON.parse(jsonMatch[0]);

    applyBrainDumpSuggestions(parsed);
    renderBrainDumpReasoning(parsed, input);
    toast('Werkwijze ingesteld, scroll naar beneden voor de velden');
  } catch (err) {
    console.error('Brain dump analyse error:', err);
    toast('Analyse mislukt: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    if (meta) meta.textContent = 'Rory leest je tekst, bepaalt het concept en kiest funnel, archetype, mode en persona';
  }
}

function applyBrainDumpSuggestions(s) {
  // Zorg dat we in scratch-mode zijn (anders krijgen archetype/funnel andere semantiek)
  if (state.generatorMode === 'copy') {
    setMode('scratch');
  }

  // Funnel-fase
  if (s.suggested_funnel) {
    const funnelRadio = document.querySelector(`input[name="funnel"][value="${s.suggested_funnel}"]`);
    if (funnelRadio) funnelRadio.checked = true;
  }

  // Format (42-format systeem; val terug op oude mode-map indien nodig)
  if (s.suggested_mode) {
    var _fid = (typeof AD_FORMAT_DIRECTIVE !== 'undefined' && (s.suggested_mode === 'auto' || AD_FORMAT_DIRECTIVE[s.suggested_mode])) ? s.suggested_mode : (OLD_MODE_TO_FMT[s.suggested_mode] || s.suggested_mode);
    if (typeof pickFormat === 'function' && (_fid === 'auto' || AD_FORMAT_DIRECTIVE[_fid])) pickFormat(_fid);
  }
  window._roryHypothese = (s.suggested_hypothese || '').trim();

  // Archetype
  if (s.suggested_archetype) {
    const archetypeRadio = document.querySelector(`input[name="archetype"][value="${s.suggested_archetype}"]`);
    if (archetypeRadio) archetypeRadio.checked = true;
  }
  if (typeof applyModeFieldLogic === 'function') applyModeFieldLogic();

  // Persona
  if (s.suggested_persona_id) {
    const personaSelect = document.getElementById('persona-select');
    if (personaSelect && (state.personas || []).find(p => p.id === s.suggested_persona_id)) {
      personaSelect.value = s.suggested_persona_id;
      if (typeof renderPersonaPreview === 'function') renderPersonaPreview();
    }
  }

  // Market sophistication + customer awareness (brein-keuze wint, anders de aanbeveling van de gekozen persona)
  var bdSoph = s.suggested_sophistication ? String(s.suggested_sophistication).trim() : '';
  var bdAware = s.suggested_awareness ? String(s.suggested_awareness).trim() : '';
  if (!bdSoph || !bdAware) {
    var bdPer = (state.personas || []).find(function(p){ return p.id === s.suggested_persona_id; });
    if (bdPer) {
      if (!bdSoph && bdPer.recSoph) { var bdpp = String(bdPer.recSoph).split('-'); bdSoph = bdpp[bdpp.length - 1].trim(); }
      if (!bdAware && Array.isArray(bdPer.recAwareness) && bdPer.recAwareness.length) bdAware = bdPer.recAwareness[0];
    }
  }
  if (bdSoph && typeof setSelectIfValid === 'function') setSelectIfValid('sophistication-select', bdSoph);
  if (bdAware && typeof setSelectIfValid === 'function') setSelectIfValid('awareness-select', bdAware);

  // Concept-richting
  if (s.suggested_concept) {
    const conceptInput = document.getElementById('concept-input');
    if (conceptInput) conceptInput.value = s.suggested_concept;
  }

  // Trigger warning-checks na alle wijzigingen
  if (typeof checkWarnings === 'function') checkWarnings();
  // Trigger concept-suggester refresh als die bestaat
  if (typeof refreshConceptSuggester === 'function') refreshConceptSuggester();
}

function renderBrainDumpReasoning(s, originalInput) {
  const container = document.getElementById('brain-dump-reasoning');
  if (!container) return;
  const funnelLabel = { tof: 'Top of Funnel', mof: 'Middle of Funnel', bof: 'Bottom of Funnel', retargeting: 'Re-targeting' }[s.suggested_funnel] || s.suggested_funnel;
  const _bdF = (typeof AD_FORMATS !== 'undefined') ? AD_FORMATS.find(function(x){ return x.id === s.suggested_mode; }) : null;
  const modeLabel = _bdF ? _bdF.name : ({
    'direct-response': 'Direct-Response',
    'brand-builder': 'Brand-Builder',
    'feature-education': 'Feature-Education',
    'bundle-showcase': 'Bundle-Showcase',
    'lifestyle-placement': 'Lifestyle-Placement',
    'auto': 'Auto'
  }[s.suggested_mode] || s.suggested_mode);
  const archetypeMap = {
    premium: 'Premium', educational: 'Educational', ugc: 'UGC', authority: 'Authority',
    offer: 'Offer', comparison: 'Comparison', before_after: 'Voor-na', founder_story: 'Founder-story',
    seasonal: 'Seasonal', objection_reply: 'Objection-reply', analogie: 'Analogie', trend: 'Trend'
  };
  const archetypeLabel = archetypeMap[s.suggested_archetype] || s.suggested_archetype;
  const persona = s.suggested_persona_id ? (state.personas || []).find(p => p.id === s.suggested_persona_id) : null;
  const personaLabel = persona ? persona.name : 'Geen specifieke persona';

  let html = `
    <div class="brain-dump-reasoning-label">Werkwijze ingesteld door Claude</div>
    ${s.summary_nl ? `<div class="brain-dump-reasoning-summary">${escapeHtml(s.summary_nl)}</div>` : ''}
    ${s.suggested_hypothese ? `<div class="brain-dump-reasoning-summary" style="border-left:2px solid rgba(215, 179, 89, .55); padding-left:11px; margin-top:6px;"><strong style="color:#886416;">Hypothese &middot; dit gaan we bewijzen:</strong> ${escapeHtml(s.suggested_hypothese)}</div>` : ''}
    <div class="brain-dump-reasoning-grid">
      <div class="brain-dump-reasoning-pick">
        <span class="brain-dump-reasoning-pick-label">Funnel</span>
        <span class="brain-dump-reasoning-pick-value">${escapeHtml(funnelLabel)}</span>
      </div>
      <div class="brain-dump-reasoning-pick">
        <span class="brain-dump-reasoning-pick-label">Archetype</span>
        <span class="brain-dump-reasoning-pick-value">${escapeHtml(archetypeLabel)}</span>
      </div>
      <div class="brain-dump-reasoning-pick">
        <span class="brain-dump-reasoning-pick-label">Format</span>
        <span class="brain-dump-reasoning-pick-value">${escapeHtml(modeLabel)}</span>
      </div>
      <div class="brain-dump-reasoning-pick">
        <span class="brain-dump-reasoning-pick-label">Persona</span>
        <span class="brain-dump-reasoning-pick-value">${escapeHtml(personaLabel)}</span>
      </div>
    </div>
    <div class="brain-dump-reasoning-text">${escapeHtml(s.reasoning_nl || '')}</div>
  `;
  if (s.conflicts && s.conflicts.trim()) {
    html += `<div class="brain-dump-conflicts"><strong>Let op, conflict gedetecteerd:</strong> ${escapeHtml(s.conflicts)}</div>`;
  }
  container.innerHTML = html;
  container.classList.add('visible');
}

function toggleBrainDumpHelp() {
  const help = document.getElementById('brain-dump-help');
  const toggle = document.getElementById('brain-dump-help-toggle');
  if (!help || !toggle) return;
  help.classList.toggle('open');
  toggle.classList.toggle('active');
}

// ============================================================
// HOOFDTABS: Generator vs Proxy uitleg
// ============================================================
