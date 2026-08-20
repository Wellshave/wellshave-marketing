// ============================================================
// IMAGE GENERATION (OpenAI)
// ============================================================
const TRANSFORMER_SYSTEM_ADDITIONS = `
# AD TRANSFORMER MODUS (BIJZONDERE INSTRUCTIES)
De gebruiker levert een ECHTE, BESTAANDE foto aan die ONGEWIJZIGD de hero van de advertentie wordt. Je verandert de foto, de scene, het product en de compositie NIET en verzint ze NIET opnieuw. Je ontwerpt EEN statische advertentie ROND deze foto in de huisstijl en tone-of-voice van het merk.
image_prompt_en beschrijft UITSLUITEND de advertentie-ELEMENTEN die OVER of NAAST de bestaande foto worden gelegd (headline-tekst, eventuele body, CTA-pill, merk-wordmark, optionele badge of social-proof), met hun positie binnen de safe zones. Beschrijf NOOIT de foto-inhoud, achtergrond of het product opnieuw. Begin image_prompt_en letterlijk met: "Keep the provided photo exactly as the hero background, do not alter or regenerate it. Overlay only the following advertisement elements:" gevolgd door de elementen en hun posities.
`;

const TF_DIRECTION_PRESETS = [
  { label: 'Premium & rustig', text: 'Premium en rustig: focus op de zachte glans en kwaliteit van het product, minimale tekst, veel negatieve ruimte, accessible-luxury sfeer.' },
  { label: 'Feature-grid', text: 'Feature-grid: het product centraal met 3 tot 4 feature-callouts in cirkels eromheen, elk met een USP-icoon en korte label.' },
  { label: 'Before / after', text: 'Before/after transformatie: toon het contrast van voor en na het gebruik (links ruig en onverzorgd, rechts strak en verzorgd) in een split-frame.' },
  { label: 'Social proof', text: 'Social-proof insteek: Trustpilot 4,5/5 met het opgegeven aantal reviews of een UGC-quote prominent in beeld.' },
  { label: 'Offer / korting', text: 'Offer-insteek: prominente prijs met doorgestreepte oude prijs en een kortingsbadge, lichte urgentie.' },
  { label: 'Seizoen / feest', text: 'Feestelijke seizoens-insteek (bijvoorbeeld Vaderdag of kerst) met passende sfeer en een cadeau-frame.' },
  { label: 'Probleem -> oplossing', text: 'Probleem-oplossing: open op een herkenbare irritatie en positioneer het product als de directe oplossing.' },
  { label: 'Lifestyle moment', text: 'Lifestyle-moment: het product in een echt, rustig gebruiksmoment, kalme zelfverzekerdheid, geen drama.' }
];

function renderTfDirectionPresets(){
  const box = document.getElementById('tf-direction-presets');
  if (!box) return;
  box.innerHTML = TF_DIRECTION_PRESETS.map(function(p, i){
    return '<button type="button" class="tf-preset-chip" onclick="setTfDirectionPreset(' + i + ')">' + escapeHtml(p.label) + '</button>';
  }).join('');
}

function setTfDirectionPreset(i){
  const preset = TF_DIRECTION_PRESETS[i];
  if (!preset) return;
  const ta = document.getElementById('tf-direction');
  if (!ta) return;
  const existing = ta.value.trim();
  ta.value = existing ? (existing + '\n' + preset.text) : preset.text;
  ta.focus();
  ta.scrollTop = ta.scrollHeight;
  if (typeof event !== 'undefined' && event && event.target) {
    const chip = event.target;
    chip.classList.add('just-clicked');
    setTimeout(function(){ chip.classList.remove('just-clicked'); }, 400);
  }
}

function renderTransformerProductSelect(){
  const sel = document.getElementById('tf-product'); if (!sel) return;
  const prev = sel.value;
  var opts = '<option value="">(geen product, alleen foto)</option>';
  (state.products||[]).forEach(function(p){ if(p&&p.id&&p.name) opts += '<option value="'+escapeAttr(p.id)+'">'+escapeHtml(p.name)+'</option>'; });
  sel.innerHTML = opts;
  if (prev && (state.products||[]).find(function(p){return p.id===prev;})) sel.value = prev;
}

function renderTransformerPhotoZone(){
  const zone = document.getElementById('tf-photo-zone'); if (!zone) return;
  const ph = state.transformerPhoto;
  if (ph) {
    zone.innerHTML = '<img src="data:'+ph.mimeType+';base64,'+ph.b64+'" alt="foto">';
  } else {
    zone.innerHTML = '<div class="tf-photo-empty">Klik of sleep een foto hierheen<br><span class="label-hint">JPG of PNG, max 8MB</span></div>';
  }
  const row = document.getElementById('tf-assess-row');
  if (row) row.style.display = ph ? 'flex' : 'none';
  if (!ph) { const as = document.getElementById('tf-assessment'); if (as) as.innerHTML = ''; }
}

async function handleTransformerPhoto(event){
  const file = event.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Alleen afbeeldingen worden ondersteund', true); return; }
  if (file.size > 8*1024*1024) { toast('Foto te groot, max 8MB', true); return; }
  try {
    const dataUrl = await compressImage(file, 1536, 0.9);
    const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) throw new Error('Onverwerkbare afbeelding');
    state.transformerPhoto = { b64: parts[2], mimeType: parts[1], fileName: file.name, size: file.size };
    renderTransformerPhotoZone();
    toast('Foto toegevoegd');
  } catch (err) { toast('Kon foto niet verwerken: ' + err.message, true); }
}
function handleTransformerDrop(e){
  e.preventDefault(); e.currentTarget.classList.remove('dragging');
  const file = e.dataTransfer.files[0]; if (!file) return;
  handleTransformerPhoto({ target: { files: [file], value: '' } });
}

function renderTransformerPersonaSelect(){
  const sel = document.getElementById('tf-persona'); if (!sel) return;
  const prev = sel.value;
  var opts = '<option value="">(geen persona)</option>';
  (state.personas||[]).forEach(function(p){ if (p && p.id && p.name) opts += '<option value="'+escapeAttr(p.id)+'">'+escapeHtml(p.name)+(p.category?(' ('+escapeHtml(p.category)+')'):'')+'</option>'; });
  sel.innerHTML = opts;
  if (prev) sel.value = prev;
}

const TF_ASSESS_SYSTEM_PROMPT = `# ROL
Je bent Nick Theriot, direct-response creative strategist. Je krijgt EEN foto die de gebruiker als hero van een Meta-advertentie wil gebruiken. Scoor de foto eerlijk op zijn kracht om de scroll te stoppen (een big idea, zichtbaar bewijs, novelty) en bepaal daarna de beste advertentie-aanpak. Als iets niet uit de foto blijkt, gok niet, zeg het.

# WAT JE TERUGGEEFT
1. Een scorecard: een cijfer van 0-10 voor de foto als scroll-stoppende ad-hero, wat de scroll stopt (sterkste punt), de grootste zwakte of het verbeterpunt, en wat je er het sterkst mee naar voren brengt.
2. Een ingevuld concept: kies de funnel-fase, het archetype, de format mode, de plaatsing en schrijf een concrete concept-richting die bij DEZE foto past. De gebruiker hoeft daarna alleen nog het product te kiezen.

# KEUZE-OPTIES (gebruik exact deze waarden)
- funnel: tof | mof | bof | retargeting
- archetype: premium | educational | ugc | authority | offer | comparison | beforeafter | founder | seasonal | objection | analogie | trend | mix
- mode: auto | direct-response | brand-builder | feature-education | bundle-showcase | lifestyle-placement | advertorial-news
- placement: feed11 | feed45 | stories | reels
Kies op basis van wat de foto IS: een rauwe selfie-achtige foto leidt naar ugc; een kalme premium productfoto naar lifestyle-placement of brand-builder; een redactioneel ogende lifestyle-foto kan advertorial-news worden. Match de plaatsing aan de beeldverhouding van de foto (staand = stories, vierkant = feed11, enzovoort).

# OUTPUT, STRICT JSON, geen markdown, geen tekst eromheen
{
  "score": "cijfer 0-10 voor de foto als scroll-stoppende ad-hero",
  "beoordeling": "2-4 zinnen: wat je ziet en hoe sterk de foto is als ad-hero",
  "sterk": "1 zin: wat de scroll stopt aan deze foto",
  "zwak": "1 zin: de grootste zwakte of het verbeterpunt",
  "naar_voren_brengen": "1-2 zinnen: wat je met deze foto het sterkst naar voren brengt (de emotie of hoek)",
  "funnel": "tof|mof|bof|retargeting",
  "archetype": "een van de archetype-waarden",
  "mode": "een van de mode-waarden",
  "placement": "feed11|feed45|stories|reels",
  "concept_richting": "een concrete concept-richting in 1-2 NL zinnen die bij deze foto past, direct bruikbaar",
  "waarom": "1-2 zinnen: waarom deze funnel/archetype/mode-combinatie bij deze foto past"
}`;

function renderTfAssessment(a) {
  const box = document.getElementById('tf-assessment'); if (!box) return;
  function row(label, text) {
    return '<div class="ogilvy-item"><div class="ogilvy-item-head"><span class="ogilvy-item-label">' + escapeHtml(label) + '</span></div><div class="ogilvy-item-text">' + escapeHtml(text || '') + '</div></div>';
  }
  const fmap = { tof: 'Top of Funnel', mof: 'Middle of Funnel', bof: 'Bottom of Funnel', retargeting: 'Re-targeting' };
  let h = '<div class="ogilvy-block">';
  h += '<div class="ogilvy-title">Theriot scoort de foto</div>';
  if (a.score) h += row('Score (0-10)', String(a.score));
  h += row('Beoordeling', a.beoordeling);
  if (a.sterk) h += row('Wat de scroll stopt', a.sterk);
  if (a.zwak) h += row('Grootste zwakte', a.zwak);
  h += row('Wat we naar voren brengen', a.naar_voren_brengen);
  h += row('Ingevuld', 'Funnel: ' + (fmap[a.funnel] || a.funnel || '') + '  |  Archetype: ' + (a.archetype || '') + '  |  Mode: ' + (a.mode || '') + '  |  Plaatsing: ' + (a.placement || ''));
  if (a.waarom) h += '<div class="ogilvy-annot">' + escapeHtml(a.waarom) + '</div>';
  h += '<div class="ogilvy-annot">De velden hiernaast zijn ingevuld. Kies nog je product en pas eventueel iets aan, daarna op Maak advertentie van deze foto.</div>';
  h += '</div>';
  box.innerHTML = h;
}

function setSelectIfValid(id, value) {
  const sel = document.getElementById(id);
  if (!sel || !value) return;
  const ok = Array.prototype.some.call(sel.options, function(o){ return o.value === value; });
  if (ok) sel.value = value;
}

async function tfAssessPhoto() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  if (!state.transformerPhoto) { toast('Upload eerst een foto', true); return; }
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('tf-assess-btn');
  const box = document.getElementById('tf-assessment');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Theriot bekijkt de foto...'; }
  if (box) box.innerHTML = '<div class="loading-card">Theriot scoort de foto en bepaalt de beste aanpak...</div>';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 1200, system: TF_ASSESS_SYSTEM_PROMPT + brandProfileBlock(), messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: state.transformerPhoto.mimeType, data: state.transformerPhoto.b64 } }, { type: 'text', text: 'Beoordeel deze foto en vul het concept in volgens het output-format.' } ] }] })
    });
    const text = wgClaudeText(data);
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('geen JSON in respons');
    const res = JSON.parse(text.substring(a, b + 1));
    setSelectIfValid('tf-funnel', res.funnel);
    setSelectIfValid('tf-archetype', res.archetype);
    setSelectIfValid('tf-mode', res.mode);
    setSelectIfValid('tf-placement', res.placement);
    if (res.concept_richting) { const dir = document.getElementById('tf-direction'); if (dir) dir.value = res.concept_richting; }
    renderTfAssessment(res);
    toast('Foto beoordeeld, velden ingevuld');
  } catch (err) {
    console.error(err);
    if (box) box.innerHTML = '<div class="loading-card" style="color:#bd0f0f;">Beoordeling mislukt: ' + escapeHtml(err.message) + '</div>';
    toast('Beoordeling mislukt: ' + err.message, true);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Laat Theriot de foto scoren'; }
}

async function adTransformerRun(){
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  if (!state.transformerPhoto) { toast('Upload eerst een foto', true); return; }
  const direction = document.getElementById('tf-direction').value.trim();
  const placement = document.getElementById('tf-placement').value || 'feed11';
  const funnel = document.getElementById('tf-funnel').value || 'mof';
  const archetype = document.getElementById('tf-archetype').value || 'mix';
  const mode = document.getElementById('tf-mode').value || 'auto';
  const tfPersonaId = document.getElementById('tf-persona').value;
  const tfPersona = tfPersonaId ? (state.personas||[]).find(function(p){return p.id===tfPersonaId;}) : null;
  const productId = document.getElementById('tf-product').value;
  const product = productId ? (state.products||[]).find(function(p){return p.id===productId;}) : null;
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('tf-generate-btn');
  const resEl = document.getElementById('transformer-results');
  clearInactiveResults('transformer');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Claude analyseert de foto en ontwerpt de ad...';
  resEl.innerHTML = '<div class="loading-card">Claude bekijkt je foto en bouwt er een advertentie omheen...</div>';
  try {
    var sturing = [];
    sturing.push('Funnel-fase: ' + funnel + '.');
    sturing.push((archetype && archetype !== 'mix') ? ('Archetype: ' + archetype + ' (volg de definitie uit het systeem).') : 'Archetype: kies zelf het sterkste dat bij de foto en richting past.');
    sturing.push((mode && mode !== 'auto') ? ('Format mode: ' + mode + '.') : 'Format mode: kies zelf de passende mode.');
    if (tfPersona) { sturing.push('Customer persona: ' + tfPersona.name + (tfPersona.description ? (' - ' + tfPersona.description) : '') + '. Pijnpunten: ' + (tfPersona.pains||[]).join('; ') + '. Wensen: ' + (tfPersona.desires||[]).join('; ') + '. Bezwaren: ' + (tfPersona.objections||[]).join('; ') + '. De headline, copy en eventuele bezwaarweerlegging moeten deze persona aanspreken.'); }
    if (product) { sturing.push('Productcontext: ' + product.name + (product.usps && product.usps.length ? (' (USPs: ' + product.usps.filter(Boolean).join(', ') + ')') : '') + '.'); }
    sturing.push('Plaatsing: ' + placement + '.');
    const countSel = document.getElementById('tf-count');
    const count = Math.max(1, Math.min(4, parseInt((countSel && countSel.value) || '1', 10) || 1));
    var ctx = 'Concept-richting van de gebruiker: ' + (direction || '(vrij, kies zelf een sterke invalshoek die past bij de foto)') + '.\n'
      + (direction ? 'LEIDEND: deze concept-richting bepaalt de scene. Verwerk de beschreven situatie, emotie, setting en wie er in beeld is LETTERLIJK in image_prompt_en (onderwerp, omgeving, gezichtsuitdrukking, handeling, relatie tussen personen), niet alleen in de overlay-tekst. Beschrijft de richting een gevoel of mensen (bijvoorbeeld iemand die het cadeau geeft en een zichtbaar blije ontvanger), dan MOET het beeld dat tonen, met het product herkenbaar volgens de referentie. Headline, body en compositie ondersteunen diezelfde richting.\n' : '')
      + sturing.join('\n');
    var userText = 'Dit is de foto die ONGEWIJZIGD de hero van de advertentie wordt.\n' + ctx + '\n\nOntwerp ' + count + ' verschillende advertentie-variatie' + (count > 1 ? 's' : '') + ' rond deze foto. Dezelfde foto blijft in ELKE variatie de ongewijzigde hero. ' + (count > 1 ? 'Geef elke variatie een ANDERE hook/invalshoek (verschillend hook_type), zodat ze onderling duidelijk verschillen in boodschap en compositie van de overlay-elementen. ' : '') + 'Output ALLEEN strict JSON, geen markdown, exact dit formaat:\n{"variations":[{"hook_type":"...","hook_label_nl":"...","headline_nl":"...","body_copy_nl":"...","cta_nl":"...","image_prompt_en":"...","visual_nl":"1-2 zinnen NL: wat zie je op de visual en wat gebeurt er","reasoning_nl":"...","hypothese_nl":"1-2 zinnen: waarom deze variatie het sterkst werkt voor deze foto, persona en awareness, en wat je verwacht dat hem laat winnen"}]}\nLever precies ' + count + ' item' + (count > 1 ? 's' : '') + ' in de array.';
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: Math.min(8000, 1800 + count * 1600), system: SYSTEM_PROMPT + '\n\n' + TRANSFORMER_SYSTEM_ADDITIONS + brandProfileBlock(), messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: state.transformerPhoto.mimeType, data: state.transformerPhoto.b64 } }, { type: 'text', text: userText } ] }] })
    });
    const text = wgClaudeText(data);
    const a2 = text.indexOf('{'); const b2 = text.lastIndexOf('}');
    if (a2 === -1 || b2 === -1) throw new Error('geen JSON in respons');
    const parsed = JSON.parse(text.substring(a2, b2 + 1));
    let variations = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.variations) ? parsed.variations : (parsed.headline_nl ? [parsed] : []));
    if (!variations.length) throw new Error('geen variaties in respons');
    variations = variations.slice(0, count);
    const metadata = { product: product ? product.name : 'Eigen foto', productId: null, funnel: funnel, archetype: (archetype === 'mix' ? 'mix' : archetype), placement: placement, mode: mode, concept: direction || '(vrij)', offer: '', bundleProductIds: [], personaId: tfPersonaId || null, personaName: tfPersona ? tfPersona.name : null, sourceMode: 'transform', timestamp: Date.now() };
    state.lastGenerated = { variations: variations, metadata: metadata, fromTransformer: true };
    state.generatedImages = {};
    state.basePhotos = {};
    const heroPhoto = { b64: state.transformerPhoto.b64, mimeType: state.transformerPhoto.mimeType, fileName: state.transformerPhoto.fileName };
    var cardsHtml = '';
    variations.forEach(function(vv, idx){ state.basePhotos[idx] = heroPhoto; cardsHtml += renderVariationCard(vv, idx, metadata); });
    resEl.innerHTML = '<div class="tf-review-hint">' + variations.length + ' concept' + (variations.length > 1 ? 'en' : '') + ' klaar. Pas per kaart de headline, body, CTA of de ChatGPT-prompt aan waar nodig, en klik daarna op <b>Genereer afbeelding</b>. Je foto blijft in elke variatie de hero.</div>' + cardsHtml;
    if (typeof attachCopyHandlers === 'function') attachCopyHandlers();
    variations.forEach(function(vv, idx){ if (typeof renderBasePhotoZone === 'function') renderBasePhotoZone(idx); });
    btn.disabled = false; btn.textContent = 'Maak advertentie van deze foto';
    toast(variations.length > 1 ? (variations.length + ' concepten klaar, pas aan en genereer per kaart') : 'Concept klaar, pas aan en klik Genereer afbeelding');
  } catch (err) {
    console.error(err);
    resEl.innerHTML = '<div class="loading-card" style="color:#bd0f0f;">Mislukt: ' + escapeHtml(err.message) + '</div>';
    btn.disabled = false; btn.textContent = 'Maak advertentie van deze foto';
  }
}

async function generateImage(varIndex) {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) {
    toast('Eerst OpenAI API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }
  if (!state.lastGenerated) return;
  const variation = state.lastGenerated.variations[varIndex];
  const metadata = state.lastGenerated.metadata;
  const product = state.products.find(p => p.id === metadata.productId);

  const model = document.getElementById('openai-model').value;
  const quality = document.getElementById('openai-quality').value;
  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');
  const size = SIZE_MAP[model][metadata.placement];
  const safeZone = buildSafeZoneInstruction(metadata.placement);
  const textOverlay = buildTextOverlayInstruction(variation);
  let layoutPriority = 'LAYOUT PRIORITY (read first): every piece of text, the WELLSHAVE wordmark and the CTA button must sit fully inside the safe area, inset from all edges, never flush against the top or bottom edge. See SAFE ZONE REQUIREMENTS below. ';
  if (metadata.placement === 'stories') {
    layoutPriority += 'THIS IS A 9:16 STORIES PLACEMENT: every text and UI element sits ENTIRELY between 16 and 78 percent of the image height. The top 16 percent and the bottom 22 percent are hard-forbidden for any text, button, link or logo. ';
  } else if (metadata.placement === 'reels') {
    layoutPriority += 'THIS IS A 9:16 REELS PLACEMENT: every text and UI element sits ENTIRELY between 16 and 62 percent of the image height. The top 16 percent and the entire bottom 38 percent are hard-forbidden for any text, button, link or logo. ';
  }

  // Show loading state
  const cardId = `var-card-${varIndex}`;
  const imageSection = document.getElementById(`gen-image-${varIndex}`);
  imageSection.innerHTML = `
    <div class="gen-image-loading">
      <div class="spinner"></div>
      <div class="loading-text">Beeld wordt gegenereerd</div>
      <div class="loading-sub">Model: ${model}, Quality: ${quality}, Size: ${size}, dit kan 20-90 sec duren</div>
    </div>
  `;
  try { if (typeof wgLoadingRotate === 'function') wgLoadingRotate(varIndex); } catch(e){}

  try {
    let data;
    const bundleProductsFull = (metadata.bundleProductIds || [])
      .map(id => state.products.find(p => p.id === id))
      .filter(Boolean);

    // Build prioritized ref list based on format mode
    // Lifestyle-Placement: lifestyle first, then product
    // Bundle-Showcase / Offer-heavy: packaging first, then product, then lifestyle
    // Default: product first, then lifestyle, then packaging
    /* Welke referenties van het HOOFDproduct uitgezet zijn, als
       bak -> set van indexen. Op positie en niet op waarde: twee identieke
       foto's in verschillende bakken zijn twee referenties, en uitsluiten op
       de data-url zou ze allebei weghalen terwijl je er een aanwees. */
    const refUitPerBak = {};
    if (metadata.refKeuze && (metadata.refKeuze.uit || []).length) {
      metadata.refKeuze.uit.forEach(k => {
        const deel = String(k).split(':');
        if (deel.length !== 2) return;
        (refUitPerBak[deel[0]] = refUitPerBak[deel[0]] || new Set()).add(+deel[1]);
      });
    }
    function zonderUitgezette(lijst, bak, isHoofdproduct) {
      if (!isHoofdproduct || !refUitPerBak[bak]) return lijst;
      return lijst.filter((_, i) => !refUitPerBak[bak].has(i));
    }

    function orderedRefsForProduct(p, isHoofdproduct) {
      const rauw = normalizeRefs(p.references);
      const n = {
        product: zonderUitgezette(rauw.product, 'product', isHoofdproduct),
        usage: zonderUitgezette(rauw.usage, 'usage', isHoofdproduct),
        lifestyle: zonderUitgezette(rauw.lifestyle, 'lifestyle', isHoofdproduct),
        packaging: zonderUitgezette(rauw.packaging, 'packaging', isHoofdproduct)
      };
      const pref = (typeof getRefScenePref === 'function') ? getRefScenePref() : 'both';
      const life = (pref === 'both' || pref === 'lifestyle') ? n.lifestyle : [];
      const use = (pref === 'both' || pref === 'usage') ? n.usage : [];
      if (metadata.mode === 'lifestyle-placement') {
        return [...life, ...use, ...n.product, ...n.packaging];
      }
      if (isBundleFormat(metadata.mode)) {
        return [...n.packaging, ...n.product, ...use, ...life];
      }
      // standaard: eerst de productshots (accuraat product), dan gebruiksfoto's (correct gebruik), dan lifestyle
      return [...n.product, ...use, ...life, ...n.packaging];
    }
    const collectedRefs = [];
    if (product) collectedRefs.push(...orderedRefsForProduct(product, true));
    bundleProductsFull.forEach(bp => { collectedRefs.push(...orderedRefsForProduct(bp, false)); });

    /* De foto's die je voor DEZE ad erbij sleepte (de founder, een model)
       gaan vooraan: een beeld dat je bewust koos weegt zwaarder dan het
       zoveelste productshot, en de lijst wordt op 16 afgekapt.

       Andere modi (Kopieer ad, Itereren) dragen geen refKeuze en merken hier
       niets van. */
    if (metadata.refKeuze && (metadata.refKeuze.extra || []).length) {
      collectedRefs.unshift(...metadata.refKeuze.extra);
    }
    // OpenAI /images/edits accepts up to 16 reference images
    const refs = collectedRefs.slice(0, 16);
    const hasRefs = refs.length > 0;

    // Basis-foto (optioneel): wordt als EERSTE image meegestuurd, plus prompt-wrap
    const basePhoto = state.basePhotos[varIndex];
    const useBasePhoto = !!basePhoto;

    if (useBasePhoto || hasRefs) {
      const formData = new FormData();
      formData.append('model', model);

      // Build prompt: als basis-foto, wrap met edit-instructie
      let finalPrompt = variation.image_prompt_en;
      if (useBasePhoto) {
        finalPrompt = `Take the FIRST provided image as the visual foundation for this advertisement for the brand. Preserve its composition, lighting, setting, atmosphere, and key visual elements. Transform it into a polished Wellshave creative by applying these instructions on top: ${variation.image_prompt_en}${hasRefs ? ' Important: the Wellshave product appearance must come from the ADDITIONAL reference images (the 2nd onward), not from the base image. If the base image already shows a product, replace it with the Wellshave product as shown in the references.' : ''}`;
      }
      finalPrompt = layoutPriority + finalPrompt + textOverlay + safeZone;
      formData.append('prompt', finalPrompt);
      formData.append('size', size);
      formData.append('quality', quality);
      formData.append('n', '1');

      // Eerst basis-foto (als aanwezig), dan product refs
      if (useBasePhoto) {
        const baseDataUrl = `data:${basePhoto.mimeType};base64,${basePhoto.b64}`;
        const baseBlob = await dataUrlToBlob(baseDataUrl);
        formData.append('image[]', baseBlob, 'base.png');
      }
      // Refs aanvullen, met budget van 16 totaal incl basis-foto
      const refBudget = useBasePhoto ? 15 : 16;
      const refsToSend = refs.slice(0, refBudget);
      for (let i = 0; i < refsToSend.length; i++) {
        const blob = await dataUrlToBlob(refsToSend[i]);
        formData.append('image[]', blob, `ref-${i}.jpg`);
      }
      data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });
    } else {
      data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt: layoutPriority + variation.image_prompt_en + textOverlay + safeZone,
          size,
          quality,
          n: 1
        })
      });
    }

    const b64 = data.data[0].b64_json;
    const newVersion = {
      b64, model, size, quality, hasRefs,
      hasBasePhoto: useBasePhoto,
      prompt: variation.image_prompt_en,
      isEdit: false,
      ts: Date.now()
    };
    state.generatedImages[varIndex] = { versions: [newVersion], currentIndex: 0 };
    window._wgFresh = true;
    renderGeneratedImage(varIndex);
    notifyEditDone(varIndex, useBasePhoto ? 'Beeld klaar (op basis van eigen foto)' : 'Beeld klaar');
  } catch (err) {
    let msg = err.message;
    let hint = '';
    if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
      hint = `<div style="margin-top: 12px; font-size: 12px; color: var(--text-dim); line-height: 1.6;">
        <strong>Proxy is niet bereikbaar.</strong> Open een terminal en run:<br>
        <code style="display: inline-block; background: var(--surface-3); padding: 4px 8px; border-radius: 4px; margin-top: 6px; font-family: 'JetBrains Mono', monospace;">python3 openai-proxy.py</code><br>
        <span style="color: var(--text-faint);">in de map waar openai-proxy.py staat. Daarna probeer opnieuw.</span>
      </div>`;
    } else if (msg.includes('verification') || msg.includes('verify')) {
      hint = `<div style="margin-top: 12px; font-size: 12px; color: var(--text-dim);">Verifieer je OpenAI organisatie op platform.openai.com voordat je gpt-image-* gebruikt.</div>`;
    }
    imageSection.innerHTML = `<div class="error"><strong>Image generation fout:</strong> ${escapeHtml(msg)}</div>
      ${hint}
      <div style="text-align: center; margin-top: 12px;">
        <button class="btn btn-small" onclick="generateImage(${varIndex})">Probeer opnieuw</button>
      </div>`;
  }
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function renderGeneratedImage(varIndex) {
  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];
  const section = document.getElementById(`gen-image-${varIndex}`);
  const total = imgState.versions.length;
  const hasMultiple = total > 1;
  const szPlacement = current.placement || ((state.lastGenerated && state.lastGenerated.metadata && state.lastGenerated.metadata.placement) ? state.lastGenerated.metadata.placement : 'feed11');
  const needsSafezone = (szPlacement === 'stories' || szPlacement === 'reels');
  const szP = safeZonePercents(szPlacement);
  const szOn = !!(state.safezoneVisible && state.safezoneVisible[varIndex]);
  const szBands = `
        <div class="sz-band" style="top:0;left:0;right:0;height:${szP.top}%"></div>
        <div class="sz-band" style="bottom:0;left:0;right:0;height:${szP.bottom}%"></div>
        <div class="sz-band" style="top:0;bottom:0;left:0;width:${szP.side}%"></div>
        <div class="sz-band" style="top:0;bottom:0;right:0;width:${szP.side}%"></div>
        <div class="sz-inner" style="top:${szP.top}%;bottom:${szP.bottom}%;left:${szP.side}%;right:${szP.side}%"><span class="sz-inner-label">veilige zone</span></div>`;
  const overlayHtml = needsSafezone ? `<div class="safezone-overlay ${szOn ? 'on' : ''}" id="safezone-overlay-${varIndex}">${szBands}</div>` : '';
  const szBarHtml = needsSafezone ? `
      <div class="safezone-bar">
        <button class="safezone-toggle ${szOn ? 'active' : ''}" id="safezone-toggle-${varIndex}" type="button" onclick="toggleSafezone(${varIndex})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Safe zones
        </button>
        <button class="safezone-check-btn" id="safezone-check-btn-${varIndex}" type="button" onclick="checkSafezone(${varIndex})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Controleer safe zone
        </button>
        <span class="safezone-status" id="safezone-status-${varIndex}"></span>
      </div>` : '';
  const reformatKeys = [['stories','9:16'],['feed45','4:5'],['feed11','1:1'],['wide','16:9']];
  const reformatBtns = reformatKeys.filter(function(k){ return k[0] !== szPlacement; }).map(function(k){
    return `<button class="reformat-btn" id="reformat-btn-${varIndex}-${k[0]}" type="button" onclick="reformatImage(${varIndex}, '${k[0]}')">${k[1]}</button>`;
  }).join('');
  const reformatBarHtml = `
      <div class="reformat-bar">
        <span class="reformat-label">Ook in ander formaat</span>
        ${reformatBtns}
        <span class="reformat-hint">opnieuw gerenderd, met safe zones waar nodig</span>
      </div>`;

  const metaInfo = current.isEdit
    ? `Model: ${current.model} , ${current.size} , aanpassing van vorige versie`
    : `Model: ${current.model} , ${current.size} , quality ${current.quality}${current.hasRefs ? ' , met referenties' : ' , zonder referenties'}`;

  const thumbsHtml = hasMultiple ? `
    <div class="version-thumbs">
      <span class="version-thumbs-label">Versies</span>
      ${imgState.versions.map((v, i) => {
        const tag = v.isEdit ? 'v' + (i + 1) : 'Origineel';
        const tooltip = v.isEdit
          ? `Bewerking v${i + 1}: ${(v.prompt || '').substring(0, 140)}`
          : 'Originele generatie';
        return `<button class="version-thumb ${i === imgState.currentIndex ? 'active' : ''}" onclick="setImageVersion(${varIndex}, ${i})" title="${tooltip.replace(/"/g, '&quot;')}">
          <img src="data:image/png;base64,${v.b64}" alt="Versie ${i + 1}">
          <span class="version-thumb-tag">${tag}</span>
        </button>`;
      }).join('')}
    </div>
  ` : '';

  const resetBtn = hasMultiple
    ? `<button class="btn btn-small btn-ghost" onclick="resetImageVersions(${varIndex})">Reset edits</button>`
    : '';

  section.innerHTML = `
    <div class="gen-image-display">
      <div class="gen-image-frame">
        <img src="data:${current.mime || 'image/png'};base64,${current.b64}" alt="Gegenereerd beeld variatie ${varIndex + 1}">
        ${overlayHtml}
      </div>
      <div class="gen-image-meta">${metaInfo}${hasMultiple ? ` , versie ${imgState.currentIndex + 1} van ${total}` : ''}</div>
      ${szBarHtml}${reformatBarHtml}
      ${thumbsHtml}
      <div class="edit-tools">
      <details class="edit-tool edit-tool-unified">
        <summary>Bewerken <span class="edit-hint">alles voor deze afbeelding op een plek: aanpassen, layout, strippen of toevoegen, los of gestapeld</span></summary>
        <div class="edit-tool-body ue-body">

          <div class="ue-step-label"><span class="ue-step-num">1</span> Voeg een wijziging toe</div>
          <div class="ue-modes" id="ue-modes-${varIndex}"></div>

          <div class="ue-presets-row" id="ue-presets-row-${varIndex}">
            <div class="ue-presets-head" onclick="document.getElementById('ue-presets-row-${varIndex}').classList.toggle('collapsed')">
              <span class="ue-presets-chev">&#9662;</span>
              <span>Snelkeuzes <span class="ue-mode-label" id="ue-mode-label-${varIndex}"></span></span>
            </div>
            <div class="ue-presets" id="ue-presets-${varIndex}"></div>
          </div>

          <textarea id="ue-prompt-${varIndex}" class="edit-prompt-input ue-prompt" placeholder="Beschrijf de wijziging, of klik hierboven een snelkeuze..."></textarea>

          <div class="edit-refs-block">
            <div class="edit-refs-header">
              <span class="edit-refs-label">Foto's bij deze wijziging <span class="edit-hint">optioneel, max 4, bv "vervang het product door deze foto"</span></span>
              <button class="btn btn-small btn-ghost edit-refs-add-btn" onclick="document.getElementById('edit-ref-input-${varIndex}').click()">+ Foto toevoegen</button>
              <input type="file" id="edit-ref-input-${varIndex}" accept="image/*" multiple style="display:none;" onchange="handleEditRefUpload(event, ${varIndex})">
            </div>
            <div class="edit-refs-grid" id="edit-refs-grid-${varIndex}"></div>
          </div>

          <div class="ue-step-actions">
            <button class="btn btn-small ue-add-step-btn" id="ue-add-btn-${varIndex}" onclick="addUnifiedStep(${varIndex})">+ Voeg toe aan stapel</button>
            <button class="btn btn-image ue-direct-btn" id="ue-direct-btn-${varIndex}" onclick="runUnifiedDirect(${varIndex})">Voer direct uit</button>
          </div>

          <div class="ue-stack">
            <div class="ue-step-label ue-stack-head"><span class="ue-step-num">2</span> Stapel <span class="ue-stack-count" id="ue-count-${varIndex}"></span></div>
            <div class="combo-steps" id="combo-steps-${varIndex}"></div>
            <button class="btn btn-image ue-run-all" id="combo-btn-${varIndex}" onclick="applyCombinedEdits(${varIndex})">Voer alle wijzigingen uit in een AI-ronde</button>
          </div>

        </div>
      </details>
      </div>
      <div class="gen-image-actions">
        <button class="btn btn-small" onclick="downloadImage(${varIndex})">Download PNG</button>
        ${resetBtn}
        <button class="btn btn-small btn-ghost" onclick="generateImage(${varIndex})">Genereer opnieuw vanaf nul</button>
      </div>
    </div>
  `;
  renderUnifiedModes(varIndex);
  renderUnifiedPresets(varIndex);
  renderEditRefsGrid(varIndex);
  renderEditSteps(varIndex);
  try { if (typeof wgPlayReveal === 'function') wgPlayReveal(section, window._wgFresh); } catch(e){}
  window._wgFresh = false;
}

function renderEditRefsGrid(varIndex) {
  const grid = document.getElementById(`edit-refs-grid-${varIndex}`);
  if (!grid) return;
  const refs = (state.pendingEditRefs && state.pendingEditRefs[varIndex]) || [];
  if (refs.length === 0) {
    grid.innerHTML = '<div class="edit-refs-empty">Nog geen foto\'s toegevoegd. Klik "Foto toevoegen" als je een visuele referentie wilt meesturen.</div>';
    return;
  }
  grid.innerHTML = refs.map((ref, i) => `
    <div class="edit-ref-tile">
      <img src="data:${ref.mimeType};base64,${ref.b64}" alt="ref ${i + 1}">
      <button class="edit-ref-remove-btn" onclick="removeEditRef(${varIndex}, ${i})" title="Verwijder">×</button>
      <div class="edit-ref-name">${escapeHtml(ref.fileName)}</div>
    </div>
  `).join('');
}

function handleEditRefUpload(e, varIndex) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!state.pendingEditRefs[varIndex]) state.pendingEditRefs[varIndex] = [];
  const current = state.pendingEditRefs[varIndex];
  if (current.length + files.length > 4) {
    toast('Max 4 referentiefoto\'s per aanpassing', true);
    return;
  }
  files.forEach(async (file) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast(`${file.name} te groot, max 5MB`, true);
      return;
    }
    try {
      const dataUrl = await compressImage(file, 1280, 0.88);
      const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!parts) return;
      state.pendingEditRefs[varIndex].push({
        b64: parts[2],
        mimeType: parts[1],
        fileName: file.name,
        size: file.size
      });
      renderEditRefsGrid(varIndex);
    } catch (err) {
      toast('Kon foto niet verwerken: ' + err.message, true);
    }
  });
}

function removeEditRef(varIndex, refIndex) {
  if (!state.pendingEditRefs[varIndex]) return;
  state.pendingEditRefs[varIndex].splice(refIndex, 1);
  renderEditRefsGrid(varIndex);
}

// ============================================================
// BASE PHOTO (optioneel basis-foto voor eerste generatie)
// ============================================================
function renderBasePhotoZone(varIndex) {
  const zone = document.getElementById(`base-photo-zone-${varIndex}`);
  if (!zone) return;
  const bp = state.basePhotos[varIndex];
  if (!bp) {
    zone.innerHTML = `
      <div class="base-photo-empty" onclick="document.getElementById('base-photo-input-${varIndex}').click()" ondragover="event.preventDefault(); this.classList.add('dragging');" ondragleave="this.classList.remove('dragging');" ondrop="handleBasePhotoDrop(event, ${varIndex})">
        <svg class="base-photo-empty-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span class="base-photo-empty-text">Sleep een foto hierheen of klik om te kiezen</span>
      </div>
    `;
  } else {
    const dataUrl = `data:${bp.mimeType};base64,${bp.b64}`;
    zone.innerHTML = `
      <div class="base-photo-preview">
        <img src="${dataUrl}" alt="basis foto" class="base-photo-preview-thumb">
        <div class="base-photo-preview-info">
          <div class="base-photo-preview-name">${escapeHtml(bp.fileName || 'basis-foto')}</div>
          <div class="base-photo-preview-status">basis-foto actief, wordt gebruikt bij Genereer afbeelding</div>
        </div>
        <button class="base-photo-remove-btn" onclick="removeBasePhoto(${varIndex})">Verwijderen</button>
      </div>
    `;
  }
}

async function handleBasePhotoUpload(e, varIndex) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Alleen afbeeldingen worden ondersteund', true);
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast('Foto te groot, max 8MB', true);
    return;
  }
  try {
    const dataUrl = await compressImage(file, 1536, 0.9);
    const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) throw new Error('Onverwerkbare afbeelding');
    state.basePhotos[varIndex] = {
      b64: parts[2],
      mimeType: parts[1],
      fileName: file.name,
      size: file.size
    };
    renderBasePhotoZone(varIndex);
    toast('Basis-foto toegevoegd, klik Genereer afbeelding om hem te gebruiken');
  } catch (err) {
    toast('Kon foto niet verwerken: ' + err.message, true);
  }
}

function handleBasePhotoDrop(e, varIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  // Simuleer file input upload
  const fakeEvent = { target: { files: [file], value: '' } };
  handleBasePhotoUpload(fakeEvent, varIndex);
}

function removeBasePhoto(varIndex) {
  delete state.basePhotos[varIndex];
  renderBasePhotoZone(varIndex);
  toast('Basis-foto verwijderd');
}

function addEditStep(varIndex) {
  const typeSel = document.getElementById(`combo-type-${varIndex}`);
  const txt = document.getElementById(`combo-text-${varIndex}`);
  const t = txt.value.trim();
  if (!t) { toast('Typ eerst wat er moet gebeuren', true); return; }
  if (!state.pendingEdits[varIndex]) state.pendingEdits[varIndex] = [];
  state.pendingEdits[varIndex].push({ type: typeSel.value, text: t });
  txt.value = '';
  txt.focus();
  renderEditSteps(varIndex);
}

function removeEditStep(varIndex, i) {
  if (!state.pendingEdits[varIndex]) return;
  state.pendingEdits[varIndex].splice(i, 1);
  renderEditSteps(varIndex);
}

