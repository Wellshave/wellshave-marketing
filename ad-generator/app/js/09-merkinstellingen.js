// ============================================================
// MERK-INSTELLINGEN (brand profile, bewerkbaar i.p.v. hardcoded)
// ============================================================
function defaultBrandProfile(brand) {
  if (brand === 'wellshine') {
    return {
      brand_name: 'Wellshine', website: 'wellshine.nl', location: '',
      positioning: 'Premium haarstyling, editorial luxury in warm bruin en champagne-goud',
      gold: '#C49C79', gold_light: '#E8C9A0', dark: '#2B1D14', grey: '#6B5B4E',
      color_ratio: '80% warm bruin / 15% neutraal / 5% champagne-goud',
      font_display: 'Cormorant Garamond', font_body: 'Jost',
      trustpilot_score: '', trustpilot_count: '', google_score: '', google_count: '',
      customer_count: '', since_year: '',
      guarantee: '', delivery: 'Voor 23.59 besteld, morgen in huis',
      media: '', tone: 'Vrouwelijk, warm, premium, editorial. Nederlands.',
      claims: '', forbidden: ''
    };
  }
  return {
    brand_name: 'Wellshave', website: 'wellshave.com', location: 'Helmond',
    positioning: 'Premium grooming voor mannen, mat zwart met goud',
    gold: '#C9A961', gold_light: '#E6CD92', dark: '#0C0C0C', grey: '#414042',
    color_ratio: '80% zwart / 15% cool grey / 5% goud',
    font_display: 'Bebas Neue', font_body: 'Montserrat',
    trustpilot_score: '4,5/5', trustpilot_count: '800+', google_score: '', google_count: '',
    customer_count: '184.000+', since_year: '2021',
    guarantee: '100 dagen geld-terug garantie', delivery: 'Voor 23.59 besteld, morgen in huis',
    media: 'AD, BN DeStem, ED, RTL Boulevard',
    tone: 'Mannelijk, premium, zelfverzekerd, direct. Nederlands.',
    claims: 'Premium scheerervaring; huidvriendelijk; 184.000+ tevreden klanten sinds 2021.',
    forbidden: ''
  };
}
function getBrandProfile() {
  try { var r = localStorage.getItem(STORAGE_PREFIX + 'brand_profile_v1'); return r ? JSON.parse(r) : null; }
  catch (e) { return null; }
}
function getBrandProfileMerged() {
  return Object.assign({}, defaultBrandProfile(ACTIVE_BRAND), getBrandProfile() || {});
}
function brandProfileBlock() {
  var b = getBrandProfile();
  if (!b) return '';
  var L = [];
  var add = function(label, v) { if (v && String(v).trim()) L.push('- ' + label + ': ' + String(v).trim()); };
  add('Merknaam', b.brand_name);
  add('Website', b.website);
  add('Plaats', b.location);
  add('Positionering', b.positioning);
  add('Hoofd-/accentkleur', b.gold);
  add('Licht accent', b.gold_light);
  add('Donker/achtergrond', b.dark);
  add('Neutraal/grijs', b.grey);
  add('Kleurverhouding', b.color_ratio);
  add('Display-font (koppen)', b.font_display);
  add('Body-font', b.font_body);
  add('Trustpilot', [b.trustpilot_score, b.trustpilot_count].filter(Boolean).join(' op '));
  add('Google reviews', [b.google_score, b.google_count].filter(Boolean).join(' op '));
  add('Aantal klanten', b.customer_count);
  add('Klant sinds', b.since_year);
  add('Garantie', b.guarantee);
  add('Bezorgbelofte', b.delivery);
  add('Persvermeldingen', b.media);
  add('Tone of voice', b.tone);
  add('Kernclaims/USPs', b.claims);
  add('Verboden (nooit gebruiken)', b.forbidden);
  if (!L.length) return '';
  return '\n\n# MERKGEGEVENS (door de gebruiker ingesteld, hoogste prioriteit waar het merk wordt getoond)\n'
    + 'Dit zijn de actuele merkwaarden. Regels:\n'
    + '1. Toont een variatie het merk of een merkelement (wordmark/logo, huisstijl-kleuren, fonts, trust-badge, een claim, een review- of klantaantal, een garantie of bezorgbelofte), gebruik dan UITSLUITEND de waarden hieronder en overschrijf elke andere merknaam, kleur, font, claim of getal die elders in deze prompt staat.\n'
    + '2. Is een variatie BEWUST merkloos of product-only (bijvoorbeeld de Nieuwsartikel/advertorial-mode, Lifestyle-Placement, of wanneer de opdracht alleen het product uitlicht zonder huisstijl), forceer dan GEEN merk-fonts, merk-kleuren, wordmark of trust-badges. Laat de ad dan merkloos; de waarden hieronder zijn op dat moment alleen een feiten-referentie, geen verplichting om te branden.\n'
    + '3. Verzin nooit een review-aantal, klantaantal, garantie of belofte die hier niet staat, ook niet in een merkloze variatie.\n'
    + L.join('\n') + '\n';
}
function bpSyncColor(key){ var p=document.getElementById('bp-'+key+'-pick'); var t=document.getElementById('bp-'+key); if(p&&t) t.value=p.value; }
function bpSyncPick(key){ var p=document.getElementById('bp-'+key+'-pick'); var t=document.getElementById('bp-'+key); if(p&&t){ var v=(t.value||'').trim(); if(/^#[0-9a-fA-F]{6}$/.test(v)) p.value=v; } }
function fillBrandForm(b) {
  var set = function(id, v){ var el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); };
  set('bp-brand-name', b.brand_name); set('bp-website', b.website); set('bp-location', b.location); set('bp-positioning', b.positioning);
  set('bp-gold', b.gold); set('bp-gold-light', b.gold_light); set('bp-dark', b.dark); set('bp-grey', b.grey); set('bp-color-ratio', b.color_ratio);
  set('bp-font-display', b.font_display); set('bp-font-body', b.font_body);
  set('bp-trustpilot-score', b.trustpilot_score); set('bp-trustpilot-count', b.trustpilot_count);
  set('bp-google-score', b.google_score); set('bp-google-count', b.google_count);
  set('bp-customer-count', b.customer_count); set('bp-since-year', b.since_year);
  set('bp-guarantee', b.guarantee); set('bp-delivery', b.delivery); set('bp-media', b.media);
  set('bp-tone', b.tone); set('bp-claims', b.claims); set('bp-forbidden', b.forbidden);
  ['gold','gold-light','dark','grey'].forEach(function(k){ bpSyncPick(k); });
}
function renderBrandSettings() {
  fillBrandForm(getBrandProfileMerged());
  var st = document.getElementById('bp-save-status');
  if (st) st.textContent = getBrandProfile() ? 'Opgeslagen profiel actief, stuurt alle generaties aan' : 'Standaardwaarden (nog niet opgeslagen)';
}
function collectBrandSettings() {
  var g = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  return {
    brand_name: g('bp-brand-name'), website: g('bp-website'), location: g('bp-location'), positioning: g('bp-positioning'),
    gold: g('bp-gold'), gold_light: g('bp-gold-light'), dark: g('bp-dark'), grey: g('bp-grey'), color_ratio: g('bp-color-ratio'),
    font_display: g('bp-font-display'), font_body: g('bp-font-body'),
    trustpilot_score: g('bp-trustpilot-score'), trustpilot_count: g('bp-trustpilot-count'),
    google_score: g('bp-google-score'), google_count: g('bp-google-count'),
    customer_count: g('bp-customer-count'), since_year: g('bp-since-year'),
    guarantee: g('bp-guarantee'), delivery: g('bp-delivery'), media: g('bp-media'),
    tone: g('bp-tone'), claims: g('bp-claims'), forbidden: g('bp-forbidden')
  };
}
function saveBrandSettings() {
  var data = collectBrandSettings();
  try { localStorage.setItem(STORAGE_PREFIX + 'brand_profile_v1', JSON.stringify(data)); }
  catch (e) { if (typeof toast === 'function') toast('Opslaan mislukt: ' + e.message, true); return; }
  var st = document.getElementById('bp-save-status'); if (st) st.textContent = 'Opgeslagen, deze waarden sturen nu alle generaties aan';
  if (typeof toast === 'function') toast('Merk-instellingen opgeslagen voor ' + (data.brand_name || ACTIVE_BRAND));
}
function resetBrandSettings() {
  if (!confirm('Terug naar de standaardwaarden voor dit merk? Je opgeslagen profiel wordt verwijderd.')) return;
  try { localStorage.removeItem(STORAGE_PREFIX + 'brand_profile_v1'); } catch (e) {}
  renderBrandSettings();
  if (typeof toast === 'function') toast('Standaardwaarden hersteld');
}
function handleBrandbookFile(event) {
  var file = event.target.files && event.target.files[0];
  if (file) ingestBrandbook(file);
}
function handleBrandbookDrop(event) {
  event.preventDefault();
  var zone = document.getElementById('bp-upload-zone'); if (zone) zone.classList.remove('dragging');
  var file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) ingestBrandbook(file);
}
function ingestBrandbook(file) {
  var isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  var isImg = /^image\//.test(file.type);
  if (!isPdf && !isImg) { if (typeof toast === 'function') toast('Alleen PDF of afbeelding', true); return; }
  if (file.size > 25 * 1024 * 1024) { if (typeof toast === 'function') toast('Bestand te groot (max 25MB)', true); return; }
  var reader = new FileReader();
  reader.onload = function() {
    var b64 = String(reader.result).split(',')[1];
    state._brandbook = { b64: b64, mimeType: isPdf ? 'application/pdf' : file.type, isPdf: isPdf, name: file.name };
    var empty = document.getElementById('bp-upload-empty');
    if (empty) empty.innerHTML = '<span class="bp-up-file">' + escapeHtml(file.name) + '</span><br><span class="label-hint">klaar om uit te lezen</span>';
    var btn = document.getElementById('bp-extract-btn'); if (btn) btn.style.display = '';
  };
  reader.readAsDataURL(file);
}
var BRAND_EXTRACT_SYSTEM_PROMPT = 'Je bent Rory, een merkstrateeg. Je leest een brandbook (PDF of afbeelding) en haalt de merkgegevens eruit. Geef UITSLUITEND een JSON-object terug, geen uitleg, geen code-fences. Onbekende velden laat je als lege string. Gebruik exact deze sleutels: brand_name, website, location, positioning, gold, gold_light, dark, grey, color_ratio, font_display, font_body, trustpilot_score, trustpilot_count, google_score, google_count, customer_count, since_year, guarantee, delivery, media, tone, claims, forbidden. Kleuren als hex (#RRGGBB). trustpilot_score als bijvoorbeeld "4,5/5". Aantallen in korte notatie zoals "800+" of "184.000+". media als komma-gescheiden lijst. tone, claims en forbidden als korte Nederlandse tekst.';
async function autofillFromBrandbook() {
  var apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { if (typeof toast === 'function') toast('Stel eerst je Anthropic API-key in', true); return; }
  if (!state._brandbook) { if (typeof toast === 'function') toast('Upload eerst een brandbook', true); return; }
  var status = document.getElementById('bp-extract-status');
  var btn = document.getElementById('bp-extract-btn');
  if (status) status.textContent = 'Rory leest je brandbook...';
  if (btn) btn.disabled = true;
  try {
    var model = document.getElementById('anthropic-model').value;
    var bb = state._brandbook;
    var docBlock = bb.isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bb.b64 } }
      : { type: 'image', source: { type: 'base64', media_type: bb.mimeType, data: bb.b64 } };
    var headers = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
    if (bb.isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';
    var data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST', headers: headers,
      body: JSON.stringify({ model: model, max_tokens: 1500, system: BRAND_EXTRACT_SYSTEM_PROMPT, messages: [{ role: 'user', content: [ docBlock, { type: 'text', text: 'Lees dit brandbook en geef het JSON-object met de merkgegevens.' } ] }] })
    });
    var text = (wgClaudeTextOrNull(data) || '').trim();
    var m = text.match(/\{[\s\S]*\}/); if (m) text = m[0];
    var parsed = JSON.parse(text);
    var merged = Object.assign({}, getBrandProfileMerged());
    Object.keys(parsed).forEach(function(k){ if (parsed[k] != null && String(parsed[k]).trim()) merged[k] = String(parsed[k]).trim(); });
    fillBrandForm(merged);
    if (status) status.textContent = 'Ingevuld door Rory. Controleer en klik op Opslaan.';
    if (typeof toast === 'function') toast('Brandbook uitgelezen, controleer de velden');
  } catch (err) {
    if (status) status.textContent = 'Uitlezen mislukt: ' + err.message;
    if (typeof toast === 'function') toast('Uitlezen mislukt: ' + err.message, true);
    console.error(err);
  } finally { if (btn) btn.disabled = false; }
}
function toggleMobileNav() { document.body.classList.toggle('nav-open'); }
function closeMobileNav() { document.body.classList.remove('nav-open'); }

function switchMainTab(tab) {
  if (window._userRole === 'guest' && ['generator','copy','iterate','transformer','copywriter','scriptwriter','brand','proxy'].indexOf(tab) !== -1) { tab = 'library'; }
  closeMobileNav();
  const genView = document.getElementById('main-tab-generator');
  const proxyView = document.getElementById('main-tab-proxy');
  const libView = document.getElementById('main-tab-library');
  const sopView = document.getElementById('main-tab-sop');
  const genBtn = document.getElementById('main-tab-btn-generator');
  const copyBtn = document.getElementById('main-tab-btn-copy');
  const iterBtn = document.getElementById('main-tab-btn-iterate');
  const libBtn = document.getElementById('main-tab-btn-library');
  const proxyBtn = document.getElementById('main-tab-btn-proxy');
  const sopBtn = document.getElementById('main-tab-btn-sop');
  const brandView = document.getElementById('main-tab-brand');
  const brandBtn = document.getElementById('main-tab-btn-brand');
  const changeView = document.getElementById('main-tab-changelog');
  const changeBtn = document.getElementById('main-tab-btn-changelog');
  const personaLibView = document.getElementById('main-tab-personas');
  const productLibView = document.getElementById('main-tab-products');
  const personaLibBtn = document.getElementById('main-tab-btn-personas');
  const productLibBtn = document.getElementById('main-tab-btn-products');
  const scriptsView = document.getElementById('main-tab-scripts');
  const scriptsBtn = document.getElementById('main-tab-btn-scripts');
  const creativesView = document.getElementById('main-tab-creatives');
  const creativesBtn = document.getElementById('main-tab-btn-creatives');
  const transformerView = document.getElementById('main-tab-transformer');
  const transformerBtn = document.getElementById('main-tab-btn-transformer');
  const copywriterView = document.getElementById('main-tab-copywriter');
  const copywriterBtn = document.getElementById('main-tab-btn-copywriter');
  const scriptwriterView = document.getElementById('main-tab-scriptwriter');
  const scriptwriterBtn = document.getElementById('main-tab-btn-scriptwriter');
  const teamView = document.getElementById('main-tab-team');
  const teamBtn = document.getElementById('main-tab-btn-team');
  [genBtn, copyBtn, iterBtn, libBtn, proxyBtn, sopBtn, changeBtn, personaLibBtn, productLibBtn, transformerBtn, copywriterBtn, scriptwriterBtn, brandBtn, scriptsBtn, creativesBtn, teamBtn].forEach(b => { if (b) b.classList.remove('active'); });
  if (genView) genView.style.display = 'none';
  if (proxyView) proxyView.style.display = 'none';
  if (libView) libView.style.display = 'none';
  if (sopView) sopView.style.display = 'none';
  if (changeView) changeView.style.display = 'none';
  if (personaLibView) personaLibView.style.display = 'none';
  if (productLibView) productLibView.style.display = 'none';
  if (transformerView) transformerView.style.display = 'none';
  if (copywriterView) copywriterView.style.display = 'none';
  if (scriptwriterView) scriptwriterView.style.display = 'none';
  if (brandView) brandView.style.display = 'none';
  if (scriptsView) scriptsView.style.display = 'none';
  if (creativesView) creativesView.style.display = 'none';
  if (teamView) teamView.style.display = 'none';
  if (tab === 'library') {
    if (libView) libView.style.display = 'block';
    if (libBtn) libBtn.classList.add('active');
    if (typeof renderLibrary === 'function') renderLibrary();
  } else if (tab === 'copy') {
    if (genView) genView.style.display = 'block';
    if (copyBtn) copyBtn.classList.add('active');
    if (typeof setMode === 'function') setMode('copy');
  } else if (tab === 'iterate') {
    if (genView) genView.style.display = 'block';
    if (iterBtn) iterBtn.classList.add('active');
    if (typeof setMode === 'function') setMode('iterate');
  } else if (tab === 'team') {
    if (teamView) teamView.style.display = 'block';
    if (teamBtn) teamBtn.classList.add('active');
    if (typeof renderTeam === 'function') renderTeam();
  } else if (tab === 'sop') {
    if (sopView) sopView.style.display = 'block';
    if (sopBtn) sopBtn.classList.add('active');
  } else if (tab === 'changelog') {
    if (changeView) changeView.style.display = 'block';
    if (changeBtn) changeBtn.classList.add('active');
    if (typeof renderChangelog === 'function') renderChangelog(false);
    if (typeof updateChangelogToggleMeta === 'function') updateChangelogToggleMeta();
    const cp = document.getElementById('changelog-panel');
    const ct = document.getElementById('changelog-toggle');
    if (cp) cp.classList.add('open');
    if (ct) ct.classList.add('open');
  } else if (tab === 'personas') {
    if (personaLibView) personaLibView.style.display = 'block';
    if (personaLibBtn) personaLibBtn.classList.add('active');
    if (typeof renderPersonaLibrary === 'function') renderPersonaLibrary();
  } else if (tab === 'products') {
    if (productLibView) productLibView.style.display = 'block';
    if (productLibBtn) productLibBtn.classList.add('active');
    if (typeof renderProductLibrary === 'function') renderProductLibrary();
  } else if (tab === 'transformer') {
    if (transformerView) transformerView.style.display = 'block';
    if (transformerBtn) transformerBtn.classList.add('active');
    if (typeof renderTransformerProductSelect === 'function') renderTransformerProductSelect();
    if (typeof renderTransformerPersonaSelect === 'function') renderTransformerPersonaSelect();
    if (typeof renderTfDirectionPresets === 'function') renderTfDirectionPresets();
  } else if (tab === 'copywriter') {
    if (copywriterView) copywriterView.style.display = 'block';
    if (copywriterBtn) copywriterBtn.classList.add('active');
    if (typeof renderCwPersonaSelect === 'function') renderCwPersonaSelect();
  } else if (tab === 'scriptwriter') {
    if (scriptwriterView) scriptwriterView.style.display = 'block';
    if (scriptwriterBtn) scriptwriterBtn.classList.add('active');
    if (typeof renderSwSelects === 'function') renderSwSelects();
  } else if (tab === 'brand') {
    if (brandView) brandView.style.display = 'block';
    if (brandBtn) brandBtn.classList.add('active');
    if (typeof renderBrandSettings === 'function') renderBrandSettings();
  } else if (tab === 'scripts') {
    if (scriptsView) scriptsView.style.display = 'block';
    if (scriptsBtn) scriptsBtn.classList.add('active');
    if (typeof renderScriptLibrary === 'function') renderScriptLibrary();
  } else if (tab === 'creatives') {
    if (creativesView) creativesView.style.display = 'block';
    if (creativesBtn) creativesBtn.classList.add('active');
    if (typeof renderCreatives === 'function') renderCreatives();
    if (typeof strWisselTeken === 'function') strWisselTeken();
  } else {
    if (genView) genView.style.display = 'block';
    if (genBtn) genBtn.classList.add('active');
    if (typeof setMode === 'function') setMode('scratch');
  }
  const titleMap = { dashboard: 'Dashboard', generator: 'Statics', copy: 'Kopieer ad', iterate: 'Itereren', library: 'Bibliotheek', proxy: 'Proxy uitleg', sop: 'Handboek', changelog: 'Wijzigingen', personas: "Persona's", products: 'Producten', transformer: 'Ad transformer', copywriter: 'Copywriter', scriptwriter: 'Scriptwriter', brand: 'Merk-instellingen', scripts: 'Scripts', creatives: 'Creative Strategy', team: 'Team' };
  const tEl = document.getElementById('ws-page-title');
  if (tEl) tEl.textContent = titleMap[tab] || 'Generator';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function copyProxyCmd(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.classList.add('copied');
    btn.textContent = 'Gekopieerd';
    if (typeof toast === 'function') toast('Commando gekopieerd');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.textContent = orig;
    }, 1600);
  });
}

const ITERATE_MODE_SYSTEM_ADDITIONS_WS = `
# ITEREER-MODE (BIJZONDERE INSTRUCTIES)

De geuploade afbeelding is een EIGEN Wellshave-advertentie die BEWEZEN goed presteert. De gebruiker levert vaak prestatiecijfers mee (ROAS, CTR, CPA, hook rate, thumbstop, spend, looptijd).

## STAP 1: ANALYSEER WAAROM DEZE WINT
Lees de ad en de cijfers en bepaal: archetype, format mode, funnel-fase, het hook-mechaniek en de kernboodschap die de prestatie waarschijnlijk veroorzaken, de compositie, het headline-patroon en de CTA-aanpak. Bepaal expliciet WAT je absoluut moet vasthouden (de winnende elementen) en WAT veilig te testen is.

## STAP 2: ITEREER, NIET HERONTWERPEN
Maak nieuwe variaties die de WINNAAR respecteren:
- Behoud altijd het winnende mechaniek en de kernboodschap
- Varieer ALLEEN de dimensies die de gebruiker aangeeft (bv hook, headline, openingsbeeld, achtergrond, CTA, kleur/sfeer, persona, format)
- Elke variatie is een DUIDELIJK TE TESTEN HYPOTHESE, geen willekeurige nieuwe ad. Houd alle andere elementen zo dicht mogelijk bij de winnaar
- Het blijft Wellshave: Nederlandse copy, mat-zwart-met-goud, product EXACT volgens referentiefotos, Trustpilot 4,5/5 op het opgegeven aantal reviews, Clarity Test geldt

## GUARDRAILS
- Verander NOOIT de kernboodschap of het winnende mechaniek, ook niet als je denkt het te kunnen verbeteren: de winnaar is heilig, je test eromheen
- Geen nieuwe productclaims die niet kloppen
- image_prompt_en is een verse, zelfstandige prompt (verwijst niet naar "the original ad")
`;
const ITERATE_MODE_SYSTEM_ADDITIONS_WSH = `
# ITEREER-MODE (BIJZONDERE INSTRUCTIES)

De geuploade afbeelding is een EIGEN Wellshine-advertentie die BEWEZEN goed presteert. De gebruiker levert vaak prestatiecijfers mee (ROAS, CTR, CPA, hook rate, thumbstop, spend, looptijd).

## STAP 1: ANALYSEER WAAROM DEZE WINT
Lees de ad en de cijfers en bepaal: archetype, format mode, funnel-fase, het hook-mechaniek en de kernboodschap die de prestatie waarschijnlijk veroorzaken, de compositie, het headline-patroon en de CTA-aanpak. Bepaal expliciet WAT je absoluut moet vasthouden (de winnende elementen) en WAT veilig te testen is.

## STAP 2: ITEREER, NIET HERONTWERPEN
Maak nieuwe variaties die de WINNAAR respecteren:
- Behoud altijd het winnende mechaniek en de kernboodschap
- Varieer ALLEEN de dimensies die de gebruiker aangeeft (bv hook, headline, openingsbeeld, achtergrond, CTA, kleur/sfeer, persona, format)
- Elke variatie is een DUIDELIJK TE TESTEN HYPOTHESE, geen willekeurige nieuwe ad. Houd alle andere elementen zo dicht mogelijk bij de winnaar
- Het blijft Wellshine: Nederlandse copy, editorial luxury, warm brown en champagne gold, product EXACT volgens referentiefotos, meer dan 200 vrouwen gingen je voor, Clarity Test geldt

## GUARDRAILS
- Verander NOOIT de kernboodschap of het winnende mechaniek, ook niet als je denkt het te kunnen verbeteren: de winnaar is heilig, je test eromheen
- Geen nieuwe productclaims die niet kloppen
- image_prompt_en is een verse, zelfstandige prompt (verwijst niet naar "the original ad")
`;
const ITERATE_MODE_SYSTEM_ADDITIONS = (ACTIVE_BRAND==='wellshine') ? ITERATE_MODE_SYSTEM_ADDITIONS_WSH : ITERATE_MODE_SYSTEM_ADDITIONS_WS;

function buildIterateModeUserPrompt({ product, placement, concept, num, offer, persona, perfData, vary, analysis }) {
  let p = `# ITEREER-VERZOEK\n\n`;
  p += `De geuploade afbeelding is een bewezen winnende Wellshave-ad. Maak ${num} iteratie${num > 1 ? 's' : ''} die de winnaar respecteren en gericht testen.\n\n`;
  p += `## ${BRAND_NAME_UC}-CONTEXT\n\n**Product**: ${product.name}\n`;
  if (product.category) p += `**Categorie**: ${product.category}\n`;
  if (product.usps && product.usps.length > 0) { p += `**USPs**:\n`; product.usps.forEach((u, i) => { p += `${i + 1}. ${u}\n`; }); }
  if (product.price) p += `**Prijspunt**: ${product.price}\n`;
  const hasRefs = product.references && product.references.product && product.references.product.length > 0;
  if (hasRefs) p += `**Referentie-foto's**: ${product.references.product.length} beschikbaar, image_prompt_en moet product-appearance EXACT laten volgen.\n`;
  if (persona) {
    p += `\n**Persona**: ${persona.name}\n`;
    if (persona.description) p += `Beschrijving: ${persona.description}\n`;
    if (persona.pains && persona.pains.length > 0) p += `Pijnpunten: ${persona.pains.join(' | ')}\n`;
    if (persona.desires && persona.desires.length > 0) p += `Wensen: ${persona.desires.join(' | ')}\n`;
    if (persona.objections && persona.objections.length > 0) p += `Bezwaren: ${persona.objections.join(' | ')}\n`;
    p += `HARDE EIS PERSONA: elke iteratie blijft gebouwd voor exact deze persona. Hook of headline komt uit een pijnpunt of wens hierboven, in de taal van deze persona, en de copy mag een van de bezwaren weerleggen. Geen generieke voor-iedereen-framing.\n`;
  }
  p += `\n**Plaatsing**: ${placement === 'stories' ? 'Stories 9:16' : placement === 'reels' ? 'Reels 9:16' : placement === 'feed45' ? 'Feed 4:5' : 'Feed 1:1'}\n`;
  p += `**Aantal iteraties**: ${num}\n`;
  if (offer && offer.trim()) p += `**Offer-detail**: ${offer}\n`;
  if (perfData && perfData.trim()) p += `\n## PRESTATIECIJFERS EN CONTEXT\n\n${perfData}\n`;
  if (analysis) {
    p += `\n## AL UITGEVOERDE ANALYSE (gebruik als basis)\n\n`;
    if (analysis.archetype) p += `Archetype: ${analysis.archetype}\n`;
    if (analysis.format_mode) p += `Format: ${analysis.format_mode}\n`;
    if (analysis.funnel) p += `Funnel: ${analysis.funnel}\n`;
    if (analysis.hook_mechaniek) p += `Hook-mechaniek: ${analysis.hook_mechaniek}\n`;
    if (Array.isArray(analysis.vasthouden) && analysis.vasthouden.length) p += `Vasthouden: ${analysis.vasthouden.join(' | ')}\n`;
    if (Array.isArray(analysis.veilig_te_testen) && analysis.veilig_te_testen.length) p += `Veilig te testen: ${analysis.veilig_te_testen.join(' | ')}\n`;
    if (analysis.cijfer_diagnose) p += `Cijfer-diagnose: ${analysis.cijfer_diagnose}\n`;
    if (analysis.grootste_kans) p += `Grootste kans: ${analysis.grootste_kans}\n`;
    if (analysis.aanbevolen_aanpak) p += `Rory's aanpak: ${analysis.aanbevolen_aanpak}\n`;
    if (analysis.creatieve_richting) p += `Creatieve richting: ${analysis.creatieve_richting}\n`;
    if (analysis.iteratie_hypotheses && Array.isArray(analysis.iteratie_hypotheses) && analysis.iteratie_hypotheses.length) p += `Iteratie-hypotheses (laat deze de iteraties leiden):\n${analysis.iteratie_hypotheses.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n`;
    p += `\nDE CIJFER-DIAGNOSE IS LEIDEND: kies per iteratie de dimensie die het knelpunt uit de funnel aanpakt. Wissel niet blind de hook als de cijfers tonen dat het probleem na de klik zit, en andersom. Blijf binnen de aangevinkte testdimensies waar de gebruiker die heeft gezet.\n`;
  }
  const varyMap = { hook: 'de hook', headline: 'de headline', opening: 'het openingsbeeld of de eerste frame', achtergrond: 'de achtergrond of setting', cta: 'de CTA', sfeer: 'kleur en sfeer', persona: 'de aangesproken persona', format: 'de format mode of compositie' };
  const varyLabels = (vary && vary.length) ? vary.map(v => varyMap[v] || v) : ['de hook', 'de headline'];
  p += `\n## WAT TESTEN WE\n\n`;
  p += `Behoud het winnende mechaniek en de kernboodschap. Varieer per iteratie ALLEEN: ${varyLabels.join(', ')}. Elke iteratie is een aparte, duidelijk te testen hypothese, niet een willekeurige nieuwe ad. Houd al het andere zo dicht mogelijk bij de winnaar.\n`;
  if (concept && concept.trim()) p += `\n## EXTRA RICHTING VAN DE GEBRUIKER\n\n${concept}\n`;
  p += `\n## OUTPUT\n\n`;
  p += `Geef ${num} iteratie${num > 1 ? 's' : ''}. Output STRICT JSON volgens het format in het system-prompt (met source_ad_analysis, detected_archetype, detected_funnel en variations array). Geen markdown, geen code-fences, alleen het JSON-object.`;
  return p;
}

const ITERATE_FIELDS = [
  { group: 'Advertentie', items: [
    { id: 'iterate-adname', label: 'Advertentienaam', def: 'WS - 160 - 1', wide: true },
    { id: 'iterate-period', label: 'Periode', def: 'Laatste 30 dagen (2-31 mei 2026)', wide: true }
  ]},
  { group: 'Performance', items: [
    { id: 'iterate-spend', label: 'Spend (EUR)', def: '241.15' },
    { id: 'iterate-aov', label: 'AOV (EUR)', def: '60.98' },
    { id: 'iterate-roas', label: 'ROAS', def: '5.56' },
    { id: 'iterate-impressions', label: 'Impressies', def: '40270' },
    { id: 'iterate-cpm', label: 'CPM (EUR)', def: '5.99' }
  ]},
  { group: 'Clicks', items: [
    { id: 'iterate-linkclicks', label: 'Link clicks', def: '542' },
    { id: 'iterate-clicksoutbound', label: 'Clicks outbound', def: '535' },
    { id: 'iterate-ctrlink', label: 'CTR link (%)', def: '1.35' },
    { id: 'iterate-ctroutbound', label: 'CTR outbound (%)', def: '1.33' },
    { id: 'iterate-cpclink', label: 'CPC link (EUR)', def: '0.44' },
    { id: 'iterate-cpcoutbound', label: 'CPC outbound (EUR)', def: '0.45' }
  ]},
  { group: 'Engagement', items: [
    { id: 'iterate-follows', label: 'Follows of likes', def: '2' },
    { id: 'iterate-comments', label: 'Comments', def: '0' },
    { id: 'iterate-posteng', label: 'Post engagements', def: '567' },
    { id: 'iterate-engpct', label: 'Engagements (%)', def: '1.41' },
    { id: 'iterate-reactions', label: 'Post reactions', def: '14' },
    { id: 'iterate-shares', label: 'Post shares', def: '1' },
    { id: 'iterate-seemore', label: 'See more rate (%)', def: '0.17' }
  ]},
  { group: 'Conversion funnel', items: [
    { id: 'iterate-clickquality', label: 'Click quality (%)', def: '71.78' },
    { id: 'iterate-clicktoatc', label: 'Click to ATC (%)', def: '7.56' },
    { id: 'iterate-clicktopurchase', label: 'Click to purchase (%)', def: '4.06' },
    { id: 'iterate-atctopurchase', label: 'ATC to purchase (%)', def: '53.66' }
  ]},
  { group: 'Conversions', items: [
    { id: 'iterate-purchases', label: 'Purchases', def: '22' },
    { id: 'iterate-purchasevalue', label: 'Purchase value (EUR)', def: '1341.56' },
    { id: 'iterate-cpa', label: 'CPA (EUR)', def: '10.96' },
    { id: 'iterate-atc', label: 'ATC', def: '41' },
    { id: 'iterate-atcvalue', label: 'ATC value (EUR)', def: '2354.5' },
    { id: 'iterate-lpv', label: 'Landing page views', def: '384' }
  ]}
];

function handleIterateDataUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Alleen afbeeldingen worden ondersteund', true); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Bestand te groot, max 5MB', true); return; }
  compressImage(file, 1800, 0.92).then(function(dataUrl) {
    const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) { toast('Kon afbeelding niet parsen', true); return; }
    extractIterateDataFromImage(parts[2], parts[1]);
  }).catch(function(err) { toast('Kon afbeelding niet verwerken: ' + err.message, true); });
}

async function extractIterateDataFromImage(b64, mimeType) {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  const status = document.getElementById('iterate-extract-status');
  const btn = document.getElementById('iterate-extract-btn');
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const model = document.getElementById('anthropic-model').value;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Bezig met uitlezen...';
  const keyLines = [];
  ITERATE_FIELDS.forEach(function(g) { g.items.forEach(function(it) { keyLines.push(it.id + ' = ' + it.label); }); });
  const userText = 'Dit is een screenshot van een advertentie-analytics dashboard (Atria of Meta Ads Manager). Lees de zichtbare cijfers uit en geef ze terug als STRICT JSON, geen markdown. Gebruik EXACT deze keys. Waarden als kale getallen: geen euroteken, geen procentteken, geen duizendtal-scheidingsteken, en een punt als decimaalteken. Als een waarde niet zichtbaar is, gebruik een lege string "". De velden iterate-adname en iterate-period zijn vrije tekst.\n\nKeys (key = betekenis):\n' + keyLines.join('\n') + '\n\nAntwoord met alleen het JSON-object.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } }, { type: 'text', text: userText } ] }] })
    });
    const text = wgClaudeText(data);
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('geen JSON in respons');
    const parsed = JSON.parse(text.substring(s, e + 1));
    let filled = 0;
    ITERATE_FIELDS.forEach(function(g) {
      g.items.forEach(function(it) {
        if (parsed[it.id] !== undefined && parsed[it.id] !== null && String(parsed[it.id]).trim() !== '') {
          const el = document.getElementById(it.id);
          if (el) { el.value = String(parsed[it.id]).trim(); filled++; }
        }
      });
    });
    if (status) status.textContent = filled + ' velden ingevuld, controleer en klik Opslaan';
    toast(filled + ' velden ingevuld uit screenshot');
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Uitlezen mislukt: ' + err.message;
    toast('Uitlezen mislukt: ' + err.message, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderIterateFields() {
  const cont = document.getElementById('iterate-fields');
  if (!cont) return;
  let saved = {};
  try { const s = localStorage.getItem((STORAGE_PREFIX+'iterate_data')); if (s) saved = JSON.parse(s) || {}; } catch (e) {}
  let html = '';
  ITERATE_FIELDS.forEach(function(g) {
    html += '<div class="iterate-group"><div class="iterate-group-title">' + g.group + '</div><div class="iterate-grid">';
    g.items.forEach(function(it) {
      const val = (saved && saved[it.id] !== undefined) ? saved[it.id] : it.def;
      html += '<div class="iterate-field' + (it.wide ? ' wide' : '') + '"><label>' + it.label + '</label><input type="text" id="' + it.id + '" value="' + String(val).replace(/"/g, '&quot;') + '"></div>';
    });
    html += '</div></div>';
  });
  cont.innerHTML = html;
}

function collectIterateData() {
  let adName = '';
  let period = '';
  const lines = [];
  ITERATE_FIELDS.forEach(function(g) {
    if (g.group === 'Advertentie') {
      g.items.forEach(function(it) {
        const el = document.getElementById(it.id);
        const v = el ? el.value.trim() : '';
        if (it.id === 'iterate-adname') adName = v;
        else if (it.id === 'iterate-period') period = v;
      });
      return;
    }
    const parts = [];
    g.items.forEach(function(it) {
      const el = document.getElementById(it.id);
      const v = el ? el.value.trim() : '';
      if (v) parts.push(it.label + ' ' + v);
    });
    if (parts.length) lines.push(g.group + ': ' + parts.join(' | '));
  });
  let text = '';
  if (adName) text += 'Advertentie: ' + adName + '\n';
  if (period) text += 'Periode: ' + period + '\n';
  if (lines.length) text += '\n' + lines.join('\n');
  return { adName: adName, period: period, text: text.trim() };
}

function saveIterateData() {
  const obj = {};
  ITERATE_FIELDS.forEach(function(g) { g.items.forEach(function(it) { const el = document.getElementById(it.id); if (el) obj[it.id] = el.value; }); });
  try {
    localStorage.setItem((STORAGE_PREFIX+'iterate_data'), JSON.stringify(obj));
    toast('Advertentiedata opgeslagen');
  } catch (e) {
    toast('Opslaan mislukt: ' + e.message, true);
  }
  // Resultaat vastleggen voor de succes-ranglijst (gekoppeld aan de ingelogde maker)
  try {
    var _num = function(id){ var el=document.getElementById(id); if(!el) return null; var v=parseFloat(String(el.value||'').replace(',','.')); return isNaN(v)?null:v; };
    var _txt = function(id){ var el=document.getElementById(id); return el?(el.value||null):null; };
    var _roas = _num('iterate-roas');
    if (window._sb && window._authProfile && window._authProfile.id && _roas!==null) {
      window._sb.from('ad_results').insert({
        user_id: window._authProfile.id,
        user_email: window._authProfile.email || null,
        user_name: window._authProfile.full_name || null,
        ad_name: _txt('iterate-adname'),
        period: _txt('iterate-period'),
        roas: _roas,
        ctr: _num('iterate-ctrlink'),
        spend: _num('iterate-spend'),
        aov: _num('iterate-aov')
      }).then(function(r){ if (r && r.error) console.warn('ad_results insert', r.error.message); else if (typeof toast==='function') toast('Resultaat toegevoegd aan de succes-ranglijst'); });
    }
  } catch (e) { console.warn('ad_results', e); }
}

function restoreIterateData() {
  renderIterateFields();
}

const ITERATE_ANALYSIS_TOOL = {
  name: 'iteratieplan',
  description: 'Lever de analyse van de advertentie en het iteratieplan gestructureerd terug.',
  input_schema: {
    type: 'object',
    properties: {
      archetype: { type: 'string' },
      format_mode: { type: 'string' },
      funnel: { type: 'string' },
      hook_mechaniek: { type: 'string' },
      compositie: { type: 'string' },
      headline_patroon: { type: 'string' },
      cta_aanpak: { type: 'string' },
      cijfer_diagnose: { type: 'string', description: 'funnel-analyse in 2 tot 4 zinnen met de concrete getallen erbij' },
      grootste_kans: { type: 'string' },
      creatieve_richting: { type: 'string', description: 'een concrete creatieve brief voor de iteraties die naadloos op de diagnose aansluit, klaar om in het richtingsveld te zetten' },
      aanbevolen_aanpak: { type: 'string', description: 'het iteratieplan in 1 tot 2 zinnen' },
      aanbevolen_dimensies: { type: 'array', items: { type: 'string', enum: ['hook','headline','opening','achtergrond','cta','sfeer','persona','format'] } },
      iteratie_hypotheses: { type: 'array', items: { type: 'string' } },
      waarom_werkt_dit: { type: 'array', items: { type: 'string' } },
      vasthouden: { type: 'array', items: { type: 'string' } },
      veilig_te_testen: { type: 'array', items: { type: 'string' } }
    },
    required: ['cijfer_diagnose','aanbevolen_aanpak','creatieve_richting','aanbevolen_dimensies','iteratie_hypotheses']
  }
};
function applyRoryPlan(parsed) {
  var ci = document.getElementById('concept-input');
  if (ci && parsed && parsed.creatieve_richting && !ci.value.trim()) ci.value = String(parsed.creatieve_richting);
  var dims = (parsed && Array.isArray(parsed.aanbevolen_dimensies)) ? parsed.aanbevolen_dimensies : [];
  var valid = ['hook','headline','opening','achtergrond','cta','sfeer','persona','format'];
  var chosen = dims.map(function(d){ return String(d).toLowerCase().trim(); }).filter(function(d){ return valid.indexOf(d) !== -1; });
  if (!chosen.length) return;
  document.querySelectorAll('input[name="iterate-vary"]').forEach(function(cb){ cb.checked = chosen.indexOf(cb.value) !== -1; });
  if (typeof toast === 'function') toast('Theriot koos de testdimensies: ' + chosen.join(', '));
}
async function analyzeWinningAd() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  if (!state.sourceAd) { toast('Upload eerst je winnende ad', true); return; }
  const collected = collectIterateData(); const perfData = collected.text;
  const model = document.getElementById('anthropic-model').value;
  const box = document.getElementById('iterate-analysis');
  const btn = document.getElementById('iterate-analyze-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Bezig met analyseren...'; }
  if (box) { box.style.display = 'block'; box.innerHTML = '<div style="color:var(--text-faint);font-size:12px;">Theriot leest de ad en de cijfers...</div>'; }
  try {
    const userText = 'Je bekijkt de bijgevoegde advertentie-afbeelding van een Wellshave-ad EN de cijfers eronder, en je trekt zelf een plan om deze ad te itereren. ' + (perfData ? ('Prestatiecijfers uit de advertentiebeheerder (Atria of Meta):\n' + perfData + '\n\n') : 'Er zijn geen cijfers meegegeven; baseer je dan op wat je in de ad ziet.\n\n') + 'Doe DRIE dingen.\n(1) BEKIJK DE FOTO: wat zien we, welke hook, headline, compositie, CTA en sfeer.\n(2) LEES DE CIJFERS ALS EEN FUNNEL en bepaal met de concrete getallen erbij waar het knelpunt zit: levering (impressies, CPM), hook en creatief (CTR, see-more of hold rate), klik-naar-ATC (landingspagina en offer-match), ATC-naar-purchase (checkout, prijs, vertrouwen). Voorbeeld-logica: hoge CTR maar lage klik-naar-ATC betekent dat het creatief werkt en je NIET de hook moet wisselen maar de pre-sell of landing-belofte; lage hold of see-more rate betekent dat de eerste frame of headline niet vasthoudt; een gezonde funnel met krappe CPA-marge vraagt om schaalbare variatie, niet om een nieuw mechaniek.\n(3) TREK JE EIGEN ITERATIEPLAN: bepaal welke dimensies je zou testen (kies UITSLUITEND uit deze lijst: hook, headline, opening, achtergrond, cta, sfeer, persona, format) en welke concrete iteraties je zou maken, elk gekoppeld aan de funnel-diagnose. Bepaal ook de creatieve richting: een concrete brief voor de iteraties die naadloos aansluit op de diagnose, klaar om in het richtingsveld te zetten.\nGeef je volledige analyse en plan terug via de tool iteratieplan. Vul alle relevante velden in; kies de testdimensies UITSLUITEND uit de toegestane lijst.';
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 3000, system: SYSTEM_PROMPT + '\n\n' + ITERATE_MODE_SYSTEM_ADDITIONS + brandProfileBlock(), tools: [ITERATE_ANALYSIS_TOOL], tool_choice: { type: 'tool', name: 'iteratieplan' }, messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: state.sourceAd.mimeType, data: state.sourceAd.b64 } }, { type: 'text', text: userText } ] }] })
    });
    let parsed = null;
    if (data && Array.isArray(data.content)) {
      const tu = data.content.find(function(b){ return b.type === 'tool_use'; });
      if (tu && tu.input) parsed = tu.input;
      if (!parsed) {
        const tb = data.content.find(function(b){ return b.type === 'text'; });
        const t = tb ? (tb.text || '') : '';
        const si = t.indexOf('{'); const ei = t.lastIndexOf('}');
        if (si !== -1 && ei !== -1) { try { parsed = JSON.parse(t.substring(si, ei + 1)); } catch (e2) {} }
      }
    }
    if (!parsed) throw new Error('geen analyse ontvangen van het model');
    parsed.aanbevolen_dimensies = Array.isArray(parsed.aanbevolen_dimensies) ? parsed.aanbevolen_dimensies : (typeof parsed.aanbevolen_dimensies === 'string' ? parsed.aanbevolen_dimensies.split(/[,;]/) : []);
    ['iteratie_hypotheses','waarom_werkt_dit','vasthouden','veilig_te_testen'].forEach(function(k){ parsed[k] = (parsed[k] == null) ? [] : (Array.isArray(parsed[k]) ? parsed[k] : [String(parsed[k])]); });
    state.iterateAnalysis = parsed;
    applyRoryPlan(parsed);
    const row = (label, val) => val ? `<div class="ia-row"><b>${escapeHtml(label)}:</b> ${escapeHtml(String(val))}</div>` : '';
    const list = (label, arr) => (Array.isArray(arr) && arr.length) ? `<div class="ia-row"><b>${escapeHtml(label)}:</b></div><ul>${arr.map(x => `<li>${escapeHtml(String(x))}</li>`).join('')}</ul>` : '';
    let h = '<h5>Theriot\'s iteratieplan</h5>';
    h += row('Diagnose', parsed.cijfer_diagnose);
    h += row('Grootste kans', parsed.grootste_kans);
    h += row('Aanpak', parsed.aanbevolen_aanpak);
    h += row('Creatieve richting', parsed.creatieve_richting);
    h += list('Iteratie-hypotheses', parsed.iteratie_hypotheses);
    if (Array.isArray(parsed.aanbevolen_dimensies) && parsed.aanbevolen_dimensies.length) h += row('Gekozen testdimensies', parsed.aanbevolen_dimensies.join(', '));
    h += '<h5>Wat voor ad is dit</h5>';
    h += row('Archetype', parsed.archetype);
    h += row('Format', parsed.format_mode);
    h += row('Funnel', parsed.funnel);
    h += row('Hook-mechaniek', parsed.hook_mechaniek);
    h += row('Compositie', parsed.compositie);
    h += row('Headline-patroon', parsed.headline_patroon);
    h += row('CTA-aanpak', parsed.cta_aanpak);
    h += list('Waarom dit werkt', parsed.waarom_werkt_dit);
    h += list('Vasthouden', parsed.vasthouden);
    h += list('Veilig te testen', parsed.veilig_te_testen);
    if (box) box.innerHTML = h;
    if (btn) { btn.disabled = false; btn.textContent = 'Analyseer opnieuw'; }
  } catch (err) {
    console.error(err);
    if (box) box.innerHTML = '<div style="color:#bd0f0f;font-size:12px;">Analyse mislukt: ' + escapeHtml(err.message) + '</div>';
    if (btn) { btn.disabled = false; btn.textContent = 'Analyseer deze ad'; }
  }
}

async function generateFromIterateMode() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  if (!state.sourceAd) { toast('Upload eerst je winnende ad', true); return; }
  const productId = document.getElementById('product-select').value;
  const product = state.products.find(p => p.id === productId);
  if (!product) { toast('Kies een product', true); return; }
  const placement = document.getElementById('placement-select').value;
  const concept = document.getElementById('concept-input').value.trim();
  const num = parseInt(document.getElementById('num-input').value);
  const offer = document.getElementById('offer-input').value.trim();
  const model = document.getElementById('anthropic-model').value;
  const collected = collectIterateData(); const perfData = collected.text;
  const vary = Array.from(document.querySelectorAll('input[name="iterate-vary"]:checked')).map(e => e.value);
  const analysis = state.iterateAnalysis || null;
  const personaId = document.getElementById('persona-select') ? document.getElementById('persona-select').value : '';
  const persona = personaId ? (state.personas || []).find(p => p.id === personaId) : null;
  const userPrompt = buildIterateModeUserPrompt({ product, placement, concept, num, offer, persona, perfData, vary, analysis });

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Winnende ad analyseren en iteraties genereren...';
  clearInactiveResults('results');
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '<div class="loading-card">Claude bekijkt de winnaar en bouwt testbare iteraties...</div>';

  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 8000,
        system: SYSTEM_PROMPT + '\n\n' + ITERATE_MODE_SYSTEM_ADDITIONS + brandProfileBlock(),
        messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: state.sourceAd.mimeType, data: state.sourceAd.b64 } }, { type: 'text', text: userPrompt } ] }]
      })
    });
    const text = wgClaudeText(data);
    const jsonStart = text.indexOf('{'); const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Geen geldig JSON gevonden in Claude-respons');
    const parsed = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    if (!parsed.variations || !Array.isArray(parsed.variations) || parsed.variations.length === 0) throw new Error('Geen iteraties in Claude-respons');
    state.lastGenerated = {
      variations: parsed.variations,
      metadata: {
        product: product.name,
        productId: product.id,
        funnel: (analysis && analysis.funnel) || parsed.detected_funnel || 'auto-detected',
        archetype: (analysis && analysis.archetype) || parsed.detected_archetype || 'iteratie',
        placement, mode: 'auto',
        concept: concept || '(iteratie van winnaar)',
        offer,
        bundleProductIds: state.bundleProducts.slice(),
        personaId: persona ? persona.id : null,
        personaName: persona ? persona.name : null,
        adName: collected.adName || '',
        sourceMode: 'iterate',
        sourceAdAnalysis: parsed.source_ad_analysis || '',
        iterateAnalysis: analysis || null
      }
    };
    erfStrategieVanBron(state.lastGenerated.metadata, state.iterateBron);
    state.generatedImages = {};
    renderResults(state.lastGenerated.variations, state.lastGenerated.metadata);
    btn.disabled = false;
    btn.textContent = 'Analyseer en genereer iteraties';
  } catch (err) {
    console.error(err);
    toast('Iteratie mislukt: ' + err.message, true);
    resultsEl.innerHTML = `<div class="loading-card" style="color:#bd0f0f;">Fout: ${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Analyseer en genereer iteraties';
  }
}

function dispatchGenerate() {
  if (state.generatorMode === 'copy') {
    generateFromCopyMode();
  } else if (state.generatorMode === 'iterate') {
    generateFromIterateMode();
  } else {
    generate();
  }
}

/* De strategie van de creative waarop we itereren meenemen naar de iteratie.
   Zonder dit begint elke iteratie met een leeg dossier: geen awareness, geen
   sophistication, geen hoek -- en dus ook geen landingspagina-advies, want dat
   hangt aan awareness. Terwijl de hele reden om te itereren is dat de
   strategie blijft staan en alleen de uitvoering verandert.
   Alleen overnemen wat er werkelijk is, en nooit een leeg veld met iets
   vullen: erf_van laat zien dat het geerfd is en niet hier besloten. */
function erfStrategieVanBron(meta, bron) {
  if (!meta || !bron || !bron.id) return meta;
  if (bron.brief) meta.wizardBrief = bron.brief;
  if (bron.awareness) meta.awareness = bron.awareness;
  if (bron.sophistication) meta.sophistication = bron.sophistication;
  if (bron.destination) meta.destination = bron.destination;
  if (!meta.personaName && bron.personaName) meta.personaName = bron.personaName;
  if (!meta.personaId && bron.personaId) meta.personaId = bron.personaId;
  meta.erf_van = bron.id;
  return meta;
}
window.erfStrategieVanBron = erfStrategieVanBron;
