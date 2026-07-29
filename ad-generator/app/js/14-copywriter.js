// ============================================================
// OGILVY META AD COPY (v4.26) — copywriter naast de creative
// ============================================================
const OGILVY_COPY_SYSTEM_PROMPT = `# ROL
Je bent een direct-response copywriter geschoold in de methode van David Ogilvy. Je schrijft Meta (Facebook/Instagram) ad copy bij een bestaande statische advertentie. De creative staat al vast; jij schrijft de tekst eromheen voor Ads Manager: EEN primary text (de copy), drie link-headlines om uit te kiezen, en de CTA-knop.

# OGILVY-PRINCIPES (NIET ONDERHANDELBAAR)
1. De headline is alles. Bedenk er tien, lever de drie beste.
2. EEN belofte per ad, niet drie benefits.
3. Feiten, geen adjectieven. "90 minuten op een lading" verkoopt; "premium kwaliteit" niet. Gebruik de meegegeven productfeiten en USP's letterlijk waar relevant.
4. Verkoop de droom, niet het product: hoe ziet het leven van de klant eruit NA de aankoop.
5. Open in een koud feed nooit met de merknaam; open met het probleem, een specifiek feit of een scene uit het leven van de klant.
6. Sterke social proof of een testimonial hoort bovenaan, niet onderaan.
7. Helder wint van slim. Geen woordgrappen die niet verkopen, geen Cannes-copy.
8. Match de boodschap aan de funnel-fase:
   - TOF (koud): interrupt en educate. Geen harde sell, geen prijs. Soft CTA zoals "Meer informatie" of "Lees meer".
   - MOF (warm): conviction. Benoem de angst of het bezwaar expliciet en sloop het met een specifiek feit of garantie. CTA zoals "Ontdek de set".
   - BOF en re-targeting (heet): risico wegnemen en sluiten. Open met garantie of risk-reversal. Harde CTA zoals "Bestel nu".
9. Structuur van de primary text: hook (1-2 zinnen die de emotionele staat spiegelen of de vijand benoemen), brug naar de oplossing, mechanisme (1 zin waarom het werkt), bewijs (1-2 specifieke feiten), CTA-zin.
10. Natuurlijk Nederlands, geen em-dashes, geen uitroepteken-spam, geen ALL CAPS (hooguit 1 woord), geen emoji tenzij de funnel-fase TOF is en het past (max 2).
11. De copy mag de creative niet tegenspreken: zelfde belofte, zelfde toon, zelfde hoek als de headline in het beeld.

# SPECIAAL GEVAL: NIEUWSARTIKEL / ADVERTORIAL (format mode advertorial-news)
De ad leidt dan naar een ARTIKEL (listicle of advertorial), niet naar de productpagina. De copy teast het artikel met curiosity, noemt GEEN merknaam, GEEN prijs en verkoopt het product niet. De link-headline is een redactionele kop. Soft CTA: "Meer informatie" of "Lees meer". Bij een listicle mag de primary text een item teasen zonder het weg te geven.

# ZELFCONTROLE VOOR JE ANTWOORDT (10/10-POORT, HARD)
Voordat je de JSON teruggeeft, beoordeel je je eigen copy stil tegen deze rubric en herschrijf je elk zwak deel tot alles staat. Lever nooit copy die hier niet doorheen komt:
1. Zou je beste headline een koude scroller echt stoppen? Zo niet: schrijf tien nieuwe en kies opnieuw de drie beste.
2. Staat er precies EEN belofte in de primary text? Elke tweede belofte of extra benefit schrap je.
3. Is elke bewering een concreet feit of getal uit de briefing? Elk bijvoeglijk naamwoord zonder bewijs vervang je door een feit, of je schrapt het.
4. Openen de eerste twee zinnen zonder merknaam, met een probleem, een specifiek feit of een scene uit het leven van de klant?
5. Passen toon, belofte en CTA exact bij de funnel-fase (TOF educate en soft, MOF bezwaar slopen, BOF risico wegnemen en sluiten)?
6. Spreekt de copy de creative nergens tegen: zelfde belofte, zelfde hoek, zelfde toon als het beeld?
7. Klinkt elke zin als natuurlijk gesproken Nederlands wanneer je hem hardop leest? Schrijverij, jargon en lange bijzinnen herschrijf je.
8. Is er een zin die je kunt schrappen zonder dat de copy zwakker wordt? Schrap hem. Herhaal tot elke zin zijn plek verdient.
Zak je op een punt, herschrijf dat deel. Pas als alle acht staan, geef je de JSON. Doe deze controle in stilte; er komt niets van terug in de output behalve sterkere copy.

# OUTPUT, STRICT JSON, geen markdown, geen tekst eromheen
{
  "primary_text": "EEN primary text. Kies de lengte op basis van de funnel-fase en awareness: TOF/koud = kort en punchy (2-4 zinnen, scroll-stopper); MOF/warm = middel (4-7 zinnen); BOF/retargeting = mag langer en verhalend (tot circa 10 zinnen). Structuur altijd hook-brug-mechanisme-bewijs-CTA.",
  "headlines": ["precies 3 link-headlines, elk maximaal 40 tekens"],
  "cta_button": "Meta CTA-knop passend bij de funnel-fase, bv Meer informatie of Shop nu",
  "annotatie_nl": "2-4 zinnen: waarom deze hook, welk feit draagt het bewijs, en waarom deze CTA bij deze funnel-fase"
}
Lever precies EEN primary text (geen lengte-varianten) en drie headlines om uit te kiezen. Geen descriptions.`;

function buildOgilvyBlockHtml(copy) {
  function item(label, text) {
    return '<div class="ogilvy-item"><div class="ogilvy-item-head"><span class="ogilvy-item-label">' + escapeHtml(label) + '</span><button class="btn btn-small btn-ghost" onclick="copyOgilvyText(this)">Kopieer</button></div><div class="ogilvy-item-text">' + escapeHtml(text) + '</div></div>';
  }
  let h = '<div class="ogilvy-block">';
  h += '<div class="ogilvy-title">Meta ad copy (Ogilvy)</div>';
  if (copy.primary_text) h += item('Primary text', copy.primary_text);
  else if (copy.primary_texts && copy.primary_texts.length) h += item('Primary text', (copy.primary_texts[1] || copy.primary_texts[0]).text || '');
  if (copy.headlines && copy.headlines.length) h += item('Headlines (kies er een, max 40 tekens)', copy.headlines.join('\n'));
  if (copy.cta_button) h += item('CTA-knop', copy.cta_button);
  if (copy.annotatie_nl) h += '<div class="ogilvy-annot">' + escapeHtml(copy.annotatie_nl) + '</div>';
  h += '</div>';
  return h;
}

function copyOgilvyText(btn) {
  const itemEl = btn.closest('.ogilvy-item');
  const txt = itemEl ? itemEl.querySelector('.ogilvy-item-text').textContent : '';
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(function(){ toast('Gekopieerd naar klembord'); }).catch(function(){ toast('Kopieren mislukt', true); });
}

async function generateOgilvyCopy(varIndex) {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  if (!state.lastGenerated || !state.lastGenerated.variations[varIndex]) return;
  const v = state.lastGenerated.variations[varIndex];
  const md = state.lastGenerated.metadata || {};
  const product = (state.products || []).find(function(p){ return p.id === md.productId; });
  const persona = md.personaId ? (state.personas || []).find(function(p){ return p.id === md.personaId; }) : null;
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('ogilvy-btn-' + varIndex);
  const box = document.getElementById('ogilvy-copy-' + varIndex);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Ogilvy schrijft...'; }
  let u = '# CONTEXT VAN DE GEMAAKTE AD\n';
  u += 'Merk: ' + (typeof BRAND_NAME_UC !== 'undefined' ? BRAND_NAME_UC : 'Wellshave') + '\n';
  u += 'Product: ' + (md.product || (product ? product.name : 'onbekend')) + '\n';
  if (product && product.usps && product.usps.length) u += "USP's en feiten: " + product.usps.filter(Boolean).join(' | ') + '\n';
  if (product && product.price) u += 'Prijs: ' + product.price + '\n';
  u += 'Funnel-fase: ' + (md.funnel || 'tof') + '\nFormat mode: ' + (md.mode || 'auto') + '\nArchetype: ' + (md.archetype || '') + '\n';
  if (persona) {
    u += 'Persona: ' + persona.name + (persona.description ? (', ' + persona.description) : '') + '\n';
    if (persona.pains && persona.pains.length) u += 'Pijnpunten: ' + persona.pains.join(' | ') + '\n';
    if (persona.desires && persona.desires.length) u += 'Wensen: ' + persona.desires.join(' | ') + '\n';
    if (persona.objections && persona.objections.length) u += 'Bezwaren: ' + persona.objections.join(' | ') + '\n';
  }
  if (md.concept && md.concept !== '(vrij)') u += 'Concept-richting: ' + md.concept + '\n';
  u += '\n# DE CREATIVE (staat al vast; jouw copy sluit hierop aan en spreekt hem niet tegen)\n';
  u += 'Hook-type: ' + (v.hook_type || '') + (v.hook_label_nl ? (' (' + v.hook_label_nl + ')') : '') + '\n';
  u += 'Headline in beeld: ' + (v.headline_nl || '') + '\n';
  u += 'Body in beeld: ' + (v.body_copy_nl || '(geen)') + '\n';
  u += 'CTA in beeld: ' + (v.cta_nl || '(geen)') + '\n';
  if (v.hypothese_nl) u += 'Hypothese van deze variant: ' + v.hypothese_nl + '\n';
  u += '\nSchrijf nu de Meta ad copy volgens de principes en het output-format. Output ALLEEN het JSON-object.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 2500, system: OGILVY_COPY_SYSTEM_PROMPT + brandProfileBlock(), messages: [{ role: 'user', content: u }] })
    });
    const text = wgClaudeText(data);
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('geen JSON in respons');
    const copy = JSON.parse(text.substring(a, b + 1));
    v.ogilvy_copy = copy;
    if (box) box.innerHTML = buildOgilvyBlockHtml(copy);
    toast('Meta ad copy klaar');
  } catch (err) {
    console.error(err);
    if (box) box.innerHTML = '<div class="combo-empty" style="color:#bd0f0f;">Ogilvy copy mislukt: ' + escapeHtml(err.message) + '</div>';
    toast('Ogilvy copy mislukt: ' + err.message, true);
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Schrijf Meta ad copy (Ogilvy)'; }
}

// ============================================================
// COPYWRITER TAB (v4.27) — upload ad, Claude analyseert, Ogilvy schrijft
// ============================================================
const CW_ANALYSE_SYSTEM_PROMPT = `# ROL
Je bent een senior Meta-ads strateeg. Je krijgt een advertentie-afbeelding en leest daaruit waarvoor de ad dient en wat het doel is. Wees concreet en eerlijk; als iets niet uit het beeld blijkt, zeg dat dan in plaats van te gokken.

# OUTPUT, STRICT JSON, geen markdown, geen tekst eromheen
{
  "wat_toont_de_ad": "2-3 zinnen: wat er letterlijk te zien is (product, setting, tekstelementen, stijl)",
  "doel": "1-2 zinnen: waarvoor dient deze ad en wat moet de kijker doen",
  "funnel_inschatting": "tof|mof|bof|retargeting",
  "belofte": "de ene kernbelofte van de ad in 1 zin",
  "hook_mechaniek": "welk mechaniek de aandacht pakt (bv vraag, getal-claim, social proof, offer, curiosity)",
  "doelgroep_inschatting": "wie deze ad aanspreekt, zo specifiek mogelijk",
  "is_artikel_ad": true of false (true als de ad eruitziet als nieuwsbericht/advertorial die naar een artikel leidt),
  "opvallend": "1-2 zinnen: wat opvalt of ontbreekt (bv geen prijs, sterke social proof, onduidelijke CTA)"
}`;

function renderCwPersonaSelect() {
  const sel = document.getElementById('cw-persona'); if (!sel) return;
  const prev = sel.value;
  let opts = '<option value="">(geen persona, Claude leest de doelgroep uit de ad)</option>';
  (state.personas || []).forEach(function(p){ if (p && p.id && p.name) opts += '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.name) + (p.category ? (' (' + escapeHtml(p.category) + ')') : '') + '</option>'; });
  sel.innerHTML = opts;
  if (prev) sel.value = prev;
}

function renderCwPhotoZone() {
  const zone = document.getElementById('cw-photo-zone'); if (!zone) return;
  const ph = state.cwPhoto;
  zone.innerHTML = ph
    ? '<img src="data:' + ph.mimeType + ';base64,' + ph.b64 + '" alt="advertentie">'
    : '<div class="tf-photo-empty">Klik of sleep een advertentie hierheen<br><span class="label-hint">JPG of PNG, max 8MB</span></div>';
}

async function handleCwPhoto(event) {
  const file = event.target.files[0]; if (!file) return;
  event.target.value = '';
  if (!file.type.startsWith('image/')) { toast('Alleen afbeeldingen worden ondersteund', true); return; }
  if (file.size > 8 * 1024 * 1024) { toast('Afbeelding te groot, max 8MB', true); return; }
  try {
    const dataUrl = await compressImage(file, 1536, 0.9);
    const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) throw new Error('Onverwerkbare afbeelding');
    state.cwPhoto = { b64: parts[2], mimeType: parts[1], fileName: file.name };
    state.cwAnalysis = null;
    renderCwPhotoZone();
    const an = document.getElementById('cw-analysis'); if (an) an.innerHTML = '';
    const res = document.getElementById('cw-copy-result'); if (res) res.innerHTML = '';
    const wb = document.getElementById('cw-write-btn'); if (wb) wb.style.display = 'none';
    toast('Advertentie toegevoegd, klik Analyseer advertentie');
  } catch (err) { toast('Kon afbeelding niet verwerken: ' + err.message, true); }
}

function handleCwDrop(e) {
  e.preventDefault(); e.currentTarget.classList.remove('dragging');
  const file = e.dataTransfer.files[0]; if (!file) return;
  handleCwPhoto({ target: { files: [file], value: '' } });
}

function cwReset() {
  state.cwPhoto = null; state.cwAnalysis = null;
  renderCwPhotoZone();
  const an = document.getElementById('cw-analysis'); if (an) an.innerHTML = '';
  const res = document.getElementById('cw-copy-result'); if (res) res.innerHTML = '';
  const wb = document.getElementById('cw-write-btn'); if (wb) wb.style.display = 'none';
}

function renderCwAnalysis(a) {
  const box = document.getElementById('cw-analysis'); if (!box) return;
  function row(label, text) {
    return '<div class="ogilvy-item"><div class="ogilvy-item-head"><span class="ogilvy-item-label">' + escapeHtml(label) + '</span></div><div class="ogilvy-item-text">' + escapeHtml(text || '') + '</div></div>';
  }
  const funnelLabels = { tof: 'Top of Funnel (koud)', mof: 'Middle of Funnel (warm)', bof: 'Bottom of Funnel (heet)', retargeting: 'Re-targeting' };
  let h = '<div class="ogilvy-block">';
  h += '<div class="ogilvy-title">Analyse van de advertentie</div>';
  h += row('Wat toont de ad', a.wat_toont_de_ad);
  h += row('Doel', a.doel);
  h += row('Funnel-inschatting', funnelLabels[a.funnel_inschatting] || a.funnel_inschatting || '');
  h += row('Kernbelofte', a.belofte);
  h += row('Hook-mechaniek', a.hook_mechaniek);
  h += row('Doelgroep-inschatting', a.doelgroep_inschatting);
  if (a.is_artikel_ad) h += row('Type', 'Artikel-ad (nieuwsbericht/advertorial-stijl), copy moet het artikel teasen');
  h += row('Opvallend', a.opvallend);
  h += '<div class="ogilvy-annot">Klopt iets niet? Zet je correctie in het veld Extra context en klik opnieuw op Analyseer, of ga direct door naar de copy.</div>';
  h += '</div>';
  box.innerHTML = h;
}

async function cwAnalyze() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  if (!state.cwPhoto) { toast('Upload eerst een advertentie', true); return; }
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('cw-analyze-btn');
  const box = document.getElementById('cw-analysis');
  const ctx = (document.getElementById('cw-context') ? document.getElementById('cw-context').value.trim() : '');
  btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Claude analyseert de ad...';
  if (box) box.innerHTML = '<div class="loading-card">Claude bekijkt de advertentie en leest doel, funnel en belofte uit...</div>';
  try {
    let u = 'Analyseer deze advertentie volgens het output-format.';
    if (ctx) u += '\nExtra context van de gebruiker (weegt mee in je analyse): ' + ctx;
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 1200, system: CW_ANALYSE_SYSTEM_PROMPT + brandProfileBlock(), messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: state.cwPhoto.mimeType, data: state.cwPhoto.b64 } }, { type: 'text', text: u } ] }] })
    });
    const text = wgClaudeText(data);
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('geen JSON in respons');
    state.cwAnalysis = JSON.parse(text.substring(a, b + 1));
    renderCwAnalysis(state.cwAnalysis);
    const wb = document.getElementById('cw-write-btn'); if (wb) wb.style.display = '';
    toast('Analyse klaar, klik Schrijf Meta ad copy');
  } catch (err) {
    console.error(err);
    if (box) box.innerHTML = '<div class="loading-card" style="color:#bd0f0f;">Analyse mislukt: ' + escapeHtml(err.message) + '</div>';
    toast('Analyse mislukt: ' + err.message, true);
  }
  btn.disabled = false; btn.textContent = 'Analyseer advertentie';
}

async function cwWriteCopy() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); return; }
  if (!state.cwPhoto || !state.cwAnalysis) { toast('Analyseer eerst de advertentie', true); return; }
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('cw-write-btn');
  const box = document.getElementById('cw-copy-result');
  const a = state.cwAnalysis;
  const funnelSel = document.getElementById('cw-funnel').value;
  const funnel = (funnelSel === 'auto') ? (a.funnel_inschatting || 'tof') : funnelSel;
  const dest = document.getElementById('cw-dest').value;
  const personaId = document.getElementById('cw-persona').value;
  const persona = personaId ? (state.personas || []).find(function(p){ return p.id === personaId; }) : null;
  const ctx = (document.getElementById('cw-context') ? document.getElementById('cw-context').value.trim() : '');
  btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Ogilvy schrijft...';
  if (box) box.innerHTML = '<div class="loading-card">Ogilvy schrijft de primary texts, headlines en descriptions...</div>';
  let u = '# ANALYSE VAN DE GEUPLOADE AD (door een strateeg, gebruik als waarheid)\n' + JSON.stringify(a, null, 2) + '\n\n';
  u += '# STURING\n';
  u += 'Funnel-fase: ' + funnel + '\n';
  u += 'Bestemming: ' + (dest === 'product' ? 'productpagina' : dest === 'listicle' ? 'listicle/artikel (behandel als advertorial-news: tease het artikel, geen merknaam, geen prijs, softe CTA)' : 'advertorial (behandel als advertorial-news: tease het artikel, geen merknaam, geen prijs, softe CTA)') + '\n';
  if (a.is_artikel_ad) u += 'De ad is een artikel-ad: behandel als advertorial-news ook als de bestemming productpagina zegt.\n';
  if (persona) {
    u += 'Persona: ' + persona.name + (persona.description ? (', ' + persona.description) : '') + '\n';
    if (persona.pains && persona.pains.length) u += 'Pijnpunten: ' + persona.pains.join(' | ') + '\n';
    if (persona.desires && persona.desires.length) u += 'Wensen: ' + persona.desires.join(' | ') + '\n';
    if (persona.objections && persona.objections.length) u += 'Bezwaren: ' + persona.objections.join(' | ') + '\n';
  }
  if (ctx) u += 'Extra context: ' + ctx + '\n';
  u += '\nDe afbeelding is bijgevoegd; je copy mag de creative niet tegenspreken. Schrijf nu de Meta ad copy volgens het output-format. Output ALLEEN het JSON-object.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 2500, system: OGILVY_COPY_SYSTEM_PROMPT + brandProfileBlock(), messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: state.cwPhoto.mimeType, data: state.cwPhoto.b64 } }, { type: 'text', text: u } ] }] })
    });
    const text = wgClaudeText(data);
    const s2 = text.indexOf('{'); const e2 = text.lastIndexOf('}');
    if (s2 === -1 || e2 === -1) throw new Error('geen JSON in respons');
    const copy = JSON.parse(text.substring(s2, e2 + 1));
    if (box) box.innerHTML = buildOgilvyBlockHtml(copy);
    toast('Meta ad copy klaar');
  } catch (err) {
    console.error(err);
    if (box) box.innerHTML = '<div class="loading-card" style="color:#bd0f0f;">Ogilvy copy mislukt: ' + escapeHtml(err.message) + '</div>';
    toast('Ogilvy copy mislukt: ' + err.message, true);
  }
  btn.disabled = false; btn.textContent = 'Schrijf Meta ad copy (Ogilvy)';
}

