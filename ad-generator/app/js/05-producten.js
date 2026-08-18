// ============================================================
// PRODUCT MANAGEMENT
// ============================================================
function syncProductViews(){
  if (typeof renderProductSelect === 'function') renderProductSelect();
  if (typeof renderProductList === 'function') renderProductList();
  if (typeof renderProductLibrary === 'function') renderProductLibrary();
}
function syncPersonaViews(){
  if (typeof renderPersonaSelect === 'function') renderPersonaSelect();
  if (typeof renderPersonaDbList === 'function') renderPersonaDbList();
  if (typeof renderPersonaCategoryFilter === 'function') renderPersonaCategoryFilter();
  if (typeof renderPersonaLibrary === 'function') renderPersonaLibrary();
}
function renderProductSelect() {
  const sel = document.getElementById('product-select');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';
  if (!Array.isArray(state.products) || state.products.length === 0) {
    state.products = [DEFAULT_PRODUCT];
  }
  state.products.forEach(p => {
    if (!p || !p.id || !p.name) return;
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + ' (' + (p.category || 'Onbekend') + ')';
    sel.appendChild(opt);
  });
  if (prev && state.products.find(p => p.id === prev)) sel.value = prev;
  renderProductPreview();
  if (typeof renderPlacementPreview === 'function') renderPlacementPreview();
  // Drop bundle entries that are no longer valid (deleted products or same as primary)
  state.bundleProducts = (state.bundleProducts || []).filter(id =>
    id !== sel.value && state.products.find(p => p.id === id)
  );
  renderBundleBuilder();
}

function renderBundleBuilder() {
  const tagsEl = document.getElementById('bundle-tags');
  const addEl = document.getElementById('bundle-add');
  if (!tagsEl || !addEl) return;

  tagsEl.innerHTML = '';
  state.bundleProducts.forEach(id => {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const tag = document.createElement('span');
    tag.className = 'bundle-tag';
    tag.innerHTML = `${escapeHtml(p.name)}<button class="bundle-tag-remove" data-id="${p.id}" title="Verwijder uit bundle">×</button>`;
    tag.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      removeBundleProduct(p.id);
    });
    tagsEl.appendChild(tag);
  });

  // Repopulate the add-dropdown, excluding primary product and already-added bundle products
  const primaryId = document.getElementById('product-select').value;
  const available = state.products.filter(p => p.id !== primaryId && !state.bundleProducts.includes(p.id));
  addEl.innerHTML = '<option value="">+ Voeg product toe aan bundle...</option>';
  available.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + ' (' + p.category + ')';
    addEl.appendChild(opt);
  });
  if (available.length === 0) {
    addEl.innerHTML = '<option value="">Geen extra producten beschikbaar</option>';
    addEl.disabled = true;
  } else {
    addEl.disabled = false;
  }
}

function addBundleProduct(productId) {
  if (!productId) return;
  if (state.bundleProducts.includes(productId)) return;
  const primaryId = document.getElementById('product-select').value;
  if (productId === primaryId) {
    toast('Dit is al het primaire product', true);
    return;
  }
  state.bundleProducts.push(productId);
  renderBundleBuilder();
}

function removeBundleProduct(productId) {
  state.bundleProducts = state.bundleProducts.filter(id => id !== productId);
  renderBundleBuilder();
}

function renderProductPreview() {
  const sel = document.getElementById('product-select');
  const product = state.products.find(p => p.id === sel.value);
  const preview = document.getElementById('product-preview');
  if (!preview) return;
  if (!product) { preview.innerHTML = ''; return; }
  const n = normalizeRefs(product.references);
  const hero = (n.product && n.product[0]) || (n.lifestyle && n.lifestyle[0]) || (n.packaging && n.packaging[0]) || '';
  const bd = refBreakdown(product.references);
  const total = (bd.product || 0) + (bd.lifestyle || 0) + (bd.packaging || 0);
  const meta = product.category ? escapeHtml(product.category) : '';
  const refsTxt = total > 0 ? (total + (total === 1 ? ' foto' : ' foto\'s')) : 'geen foto, klik Beheer';
  const heroStyle = hero ? ` style="background-image:url('${escapeAttr(hero)}')"` : '';
  const nameUp = escapeHtml((product.name || '').toUpperCase());
  preview.innerHTML = `
    <div class="pc-hero">
      <div class="pc-bgname" aria-hidden="true">${nameUp}</div>
      <span class="pc-dot pc-dot1"></span><span class="pc-dot pc-dot2"></span>
      <div class="pc-prod${hero ? '' : ' empty'}"${heroStyle}>${hero ? '' : 'Geen foto'}</div>
      <div class="pc-info">
        <div class="pc-name">${escapeHtml(product.name)}</div>
        <div class="pc-meta">${meta}${meta ? ' &middot; ' : ''}${refsTxt}</div>
      </div>
    </div>`;
}

function renderPlacementPreview() {
  const sel = document.getElementById('placement-select');
  const box = document.getElementById('placement-preview');
  if (!sel || !box) return;
  const v = sel.value || 'feed11';
  const info = {
    feed11: { label: 'Feed 1:1', sub: 'Vierkant, de standaard in de feed. Tekst en knoppen ruim binnen de randen.' },
    feed45: { label: 'Feed 4:5', sub: 'Staand, neemt meer hoogte in de feed in dan 1:1, sterk voor mobiel.' },
    stories: { label: 'Stories 9:16', sub: 'Volledig scherm. Alle tekst in de centrale band, boven 16% en onder 22% blijft vrij.' },
    reels: { label: 'Reels 9:16', sub: 'Volledig scherm. De hele onderste 38% is gereserveerd voor likes, comments en caption.' }
  }[v] || { label: v, sub: '' };
  box.innerHTML = '<div class="ratio-box r-' + v + '"><div class="ratio-safe"></div></div>'
    + '<div class="placement-preview-info"><div class="placement-preview-label">' + escapeHtml(info.label) + '</div><div class="placement-preview-sub">' + escapeHtml(info.sub) + '</div></div>';
}

function awarenessLabelNL(c) { return ({ unaware:'Unaware', problem:'Probleembewust', solution:'Oplossingsbewust', product:'Productbewust', most:'Meest bewust' })[c] || c; }
function awarenessShort(c) { return ({ unaware:'unaw', problem:'prob', solution:'sol', product:'prod', most:'most' })[c] || c; }
function applyPersonaStrategy(personaId, isAuto) {
  const per = (state.personas || []).find(p => p.id === personaId);
  if (!per) return;
  const sEl = document.getElementById('sophistication-select');
  const aEl = document.getElementById('awareness-select');
  if (!sEl || !aEl) { if (!isAuto) toast('Strategie-velden niet gevonden', true); return; }
  let soph = '';
  if (per.recSoph) { const parts = String(per.recSoph).split('-'); soph = parts[parts.length - 1].trim(); }
  let aware = (Array.isArray(per.recAwareness) && per.recAwareness.length) ? per.recAwareness[0] : '';
  if (soph) sEl.value = soph;
  if (aware) aEl.value = aware;
  const hidden = !sEl.offsetParent;
  if (isAuto) {
    toast(hidden ? 'Sophistication en awareness ingesteld vanuit persona, zichtbaar bij genereren vanaf nul' : 'Sophistication en awareness automatisch ingevuld vanuit persona, je kunt ze overrulen');
  } else {
    toast(hidden ? 'Strategie ingesteld, zichtbaar bij genereren vanaf nul' : 'Strategie ingevuld vanuit de persona');
  }
}

// Wordt aangeroepen als de gebruiker actief een persona kiest (niet bij een productwissel)
function onPersonaChange() {
  renderPersonaPreview();
  const personaId = document.getElementById('persona-select').value;
  if (!personaId) return;
  const per = (state.personas || []).find(p => p.id === personaId);
  if (!per) return;
  if (per.recSoph || (Array.isArray(per.recAwareness) && per.recAwareness.length)) {
    applyPersonaStrategy(personaId, true);
  }
}

function renderPersonaSelect() {
  const productId = document.getElementById('product-select').value;
  const product = state.products.find(p => p.id === productId);
  const select = document.getElementById('persona-select');
  const labelHint = document.getElementById('persona-label-hint');
  if (!select) return;
  const previouslySelected = select.value;
  const allPersonas = state.personas || [];
  const matching = product
    ? allPersonas.filter(per => per.category === product.category)
    : [];

  if (labelHint) {
    if (!product) {
      labelHint.textContent = 'kies eerst een product';
    } else if (matching.length === 0) {
      labelHint.textContent = `geen personas voor categorie ${product.category}, klik Beheer om er toe te voegen`;
    } else {
      labelHint.textContent = `${matching.length} persona${matching.length > 1 ? 's' : ''} beschikbaar voor categorie ${product.category}`;
    }
  }

  select.innerHTML = '<option value="">Geen specifieke persona, generieke doelgroep</option>';
  const byCat = {};
  matching.forEach(per => { const c = per.category || 'Overig'; (byCat[c] = byCat[c] || []).push(per); });
  Object.keys(byCat).forEach(cat => {
    const og = document.createElement('optgroup');
    og.label = cat;
    byCat[cat].forEach(per => {
      const opt = document.createElement('option');
      opt.value = per.id;
      let tag = '';
      if (per.recSoph || (per.recAwareness && per.recAwareness.length)) {
        const bits = [];
        if (per.recSoph) bits.push('S' + per.recSoph);
        if (per.recAwareness && per.recAwareness.length) bits.push(per.recAwareness.map(awarenessShort).join('/'));
        tag = '  ·  ' + bits.join(' · ');
      } else if (per.description) {
        tag = ` , ${per.description.substring(0, 40)}${per.description.length > 40 ? '...' : ''}`;
      }
      opt.textContent = per.name + tag;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
  if (previouslySelected && matching.some(p => p.id === previouslySelected)) {
    select.value = previouslySelected;
  }
  renderPersonaPreview();
}

function renderPersonaPreview() {
  const personaId = document.getElementById('persona-select').value;
  const preview = document.getElementById('persona-preview');
  if (!preview) return;
  if (!personaId) {
    preview.classList.remove('show');
    preview.innerHTML = '';
    return;
  }
  const per = (state.personas || []).find(p => p.id === personaId);
  if (!per) {
    preview.classList.remove('show');
    return;
  }
  let html = '';
  if (per.recSoph || (per.recAwareness && per.recAwareness.length)) {
    const awText = (per.recAwareness || []).map(awarenessLabelNL).join(' tot ');
    const parts = [];
    if (awText) parts.push('awareness ' + awText);
    if (per.recSoph) parts.push('sophistication stadium ' + per.recSoph);
    const applyBtn = `<button type="button" onclick="applyPersonaStrategy('${per.id}')" style="margin-left:8px;font-size:11px;padding:2px 9px;border-radius:6px;border:1px solid var(--gold-line);background:rgba(218, 174, 63, 0.12);color:var(--gold-bright);cursor:pointer;font-family:inherit;">Herstel aanbevolen</button>`;
    html += `<div class="persona-preview-row"><span class="persona-preview-label">Aanbevolen</span><span class="persona-preview-value">${escapeHtml(parts.join(' , '))}${applyBtn}</span></div>`;
  }
  if (per.description) {
    html += `<div class="persona-preview-row"><span class="persona-preview-label">Wie</span><span class="persona-preview-value">${escapeHtml(per.description)}</span></div>`;
  }
  if (per.pains && per.pains.length > 0) {
    html += `<div class="persona-preview-row"><span class="persona-preview-label">Pijn</span><span class="persona-preview-value">${escapeHtml(per.pains.join(' , '))}</span></div>`;
  }
  if (per.desires && per.desires.length > 0) {
    html += `<div class="persona-preview-row"><span class="persona-preview-label">Wens</span><span class="persona-preview-value">${escapeHtml(per.desires.join(' , '))}</span></div>`;
  }
  if (per.objections && per.objections.length > 0) {
    html += `<div class="persona-preview-row"><span class="persona-preview-label">Bezwaar</span><span class="persona-preview-value">${escapeHtml(per.objections.join(' , '))}</span></div>`;
  }
  preview.innerHTML = html;
  preview.classList.add('show');
}

function allCategories() {
  var set = [];
  var push = function(c){ c=(c||'').trim(); if(c && set.indexOf(c)===-1) set.push(c); };
  (typeof PRODUCT_CATEGORIES!=='undefined'?PRODUCT_CATEGORIES:[]).forEach(push);
  (state.products||[]).forEach(function(p){ push(p.category); });
  (state.personas||[]).forEach(function(p){ push(p.category); });
  return set;
}
function refreshCategoryDatalist() {
  var dl = document.getElementById('cat-datalist');
  if (!dl) return;
  dl.innerHTML = allCategories().map(function(c){ return '<option value="' + escapeAttr(c) + '"></option>'; }).join('');
}
function setProductCatFilter(value) {
  state.productCatFilter = value;
  renderProductList();
}
function renderProductList() {
  if (typeof refreshCategoryDatalist==='function') refreshCategoryDatalist();
  const list = document.getElementById('product-list');
  if (!list) return;
  if (!state.products || state.products.length === 0) {
    list.innerHTML = '<div class="library-empty" style="padding:28px 0;">Nog geen producten. Klik op "Nieuw product" of importeer een bestand.</div>';
    return;
  }
  // Categorie-filterbalk
  const cats = [];
  state.products.forEach(function(p){ const cat = (p.category || '').trim(); if (cat && cats.indexOf(cat) === -1) cats.push(cat); });
  cats.sort();
  const active = state.productCatFilter || '';
  const visible = active ? state.products.filter(function(p){ return (p.category || '').trim() === active; }) : state.products;
  let barHtml = '<div class="lib-filter-bar" style="margin-top:16px;"><div class="lib-filter-group">';
  barHtml += '<button type="button" class="lib-filter-pill' + (active === '' ? ' active' : '') + '" onclick="setProductCatFilter(\'\')">Alle</button>';
  cats.forEach(function(cat){ barHtml += '<button type="button" class="lib-filter-pill' + (active === cat ? ' active' : '') + '" onclick="setProductCatFilter(\'' + cat.replace(/'/g, "\\'") + '\')">' + escapeHtml(cat) + '</button>'; });
  barHtml += '</div><span class="lib-filter-count">' + visible.length + ' van ' + state.products.length + '</span></div>';
  list.innerHTML = barHtml;

  const grid = document.createElement('div');
  grid.className = 'product-grid';
  visible.forEach(p => {
    const n = normalizeRefs(p.references);
    const hero = (n.product && n.product[0]) || (n.lifestyle && n.lifestyle[0]) || (n.packaging && n.packaging[0]) || '';
    const bd = refBreakdown(p.references);
    const totalRefs = (bd.product || 0) + (bd.lifestyle || 0) + (bd.packaging || 0);
    const refsLabel = totalRefs > 0 ? (totalRefs + (totalRefs === 1 ? ' foto' : ' foto\'s')) : 'geen foto';
    const imgHtml = hero
      ? `<div class="product-card-img" style="background-image: url('${escapeAttr(hero)}')"></div>`
      : `<div class="product-card-img empty">Geen foto</div>`;
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      ${imgHtml}
      <div class="product-card-info">
        <div class="product-card-name">${escapeHtml(p.name)}</div>
        <div class="product-card-cat">${escapeHtml(p.category || '')}</div>
        <div class="product-card-refs">${refsLabel}</div>
        <button class="product-card-edit" data-id="${escapeAttr(p.id)}">Bewerk</button>
      </div>
    `;
    card.querySelector('.product-card-edit').addEventListener('click', () => loadProductToForm(p.id));
    grid.appendChild(card);
  });
  list.appendChild(grid);
}

function openProductModal() {
  clearProductForm();
  renderProductList();
  document.getElementById('product-modal').classList.add('open');
}
function closeProductModal() {
  document.getElementById('product-modal').classList.remove('open');
}
function clearProductForm() {
  state.editingProductId = null;
  state.pendingRefs = { product: [], lifestyle: [], usage: [], packaging: [] };
  document.getElementById('modal-title').textContent = 'Nieuw product';
  document.getElementById('p-name').value = '';
  if (typeof refreshCategoryDatalist==='function') refreshCategoryDatalist();
  document.getElementById('p-category').value = (PRODUCT_CATEGORIES[0]||'Algemeen');
  document.getElementById('p-price').value = '';
  document.getElementById('p-target').value = '';
  document.getElementById('p-appearance').value = '';
  document.getElementById('p-forbidden').value = '';
  document.getElementById('modal-delete-btn').style.display = 'none';
  renderUspList(['', '', '']);
  REF_CATEGORIES.forEach(cat => renderRefGrid(cat));
}
function loadProductToForm(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  state.editingProductId = id;
  const normalized = normalizeRefs(p.references);
  state.pendingRefs = {
    product: [...normalized.product],
    lifestyle: [...normalized.lifestyle],
    usage: [...(normalized.usage||[])],
    packaging: [...normalized.packaging]
  };
  document.getElementById('modal-title').textContent = 'Bewerk: ' + p.name;
  document.getElementById('p-name').value = p.name;
  if (typeof refreshCategoryDatalist==='function') refreshCategoryDatalist();
  document.getElementById('p-category').value = p.category;
  document.getElementById('p-price').value = p.price || '';
  document.getElementById('p-target').value = p.target || '';
  document.getElementById('p-appearance').value = p.appearance || '';
  document.getElementById('p-forbidden').value = p.forbidden || '';
  document.getElementById('modal-delete-btn').style.display = 'inline-flex';
  renderUspList((p.usps && p.usps.length > 0) ? p.usps : ['']);
  REF_CATEGORIES.forEach(cat => renderRefGrid(cat));
  // Scroll het bewerk-formulier in beeld (anders moet de gebruiker zelf omhoog scrollen)
  const anchor = document.getElementById('modal-title') || document.getElementById('p-name');
  if (anchor && anchor.scrollIntoView) {
    setTimeout(function(){ anchor.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }
}
function renderUspList(values) {
  const container = document.getElementById('p-usps-list');
  if (!container) return;
  const items = (values && values.length > 0) ? values : [''];
  container.innerHTML = items.map((v, i) => `
    <div class="dynamic-list-item">
      <input type="text" class="p-usp-input" data-index="${i}" value="${escapeHtml(v)}" placeholder="${i === 0 ? 'Bijvoorbeeld: 4 precisiebladen' : (i === 1 ? 'Bijvoorbeeld: 8000 RPM zonder trekken' : 'Nog een USP...')}">
      ${items.length > 1 ? `<button type="button" class="dynamic-remove-btn" onclick="removeUspField(${i})" title="Verwijder USP">×</button>` : '<div style="width:36px;"></div>'}
    </div>
  `).join('');
}
function gatherUsps() {
  return Array.from(document.querySelectorAll('.p-usp-input'))
    .map(el => el.value.trim())
    .filter(v => v.length > 0);
}
function addUspField() {
  const current = Array.from(document.querySelectorAll('.p-usp-input')).map(el => el.value);
  current.push('');
  renderUspList(current);
  // Focus de nieuwe input
  const inputs = document.querySelectorAll('.p-usp-input');
  if (inputs.length > 0) inputs[inputs.length - 1].focus();
}
function removeUspField(index) {
  const current = Array.from(document.querySelectorAll('.p-usp-input')).map(el => el.value);
  if (current.length <= 1) return;
  current.splice(index, 1);
  renderUspList(current);
}

