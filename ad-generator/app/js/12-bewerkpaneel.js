// ============================================================
// UNIFIED EDIT PANEL (v3.72) — modes, snelkeuzes, stapel, direct uitvoeren
// ============================================================
const EDIT_MODES = [
  { id: 'adjust', label: 'Aanpassen', icon: 'ti-edit' },
  { id: 'layout', label: 'Layout', icon: 'ti-layout-2' },
  { id: 'strip', label: 'Strippen', icon: 'ti-eraser' },
  { id: 'add', label: 'Toevoegen', icon: 'ti-circle-plus' }
];

const EDIT_MODE_PLACEHOLDER = {
  adjust: "Beschrijf de aanpassing, bv 'maak de headline goud' of 'vervang het product door de bijgevoegde foto'",
  layout: "Beschrijf de layout-wijziging, bv 'zet de korting-pill rechtsboven en vergroot het product 20%'",
  strip: "Beschrijf wat weg moet, bv 'verwijder de sterren-rating en de naam uit de UGC-quote'",
  add: "Beschrijf wat erbij moet, bv 'voeg een gouden 2 jaar garantie badge linksonder toe'"
};

const EDIT_PRESETS = {
  adjust: [
    { label: 'Headline goud', text: 'maak de headline goud in plaats van wit' },
    { label: 'CTA-tekst wijzigen', text: "vervang de CTA-tekst door 'Probeer risicovrij'" },
    { label: 'Product uit foto', text: 'vervang het product door de bijgevoegde foto' },
    { label: 'Hand-pose uit referentie', text: 'gebruik de hand-pose uit de bijgevoegde referentie' },
    { label: 'Achtergrond donkerder', text: 'maak de achtergrond donkerder en meer matzwart' }
  ],
  layout: [
    { label: 'Wissel Trustpilot ↔ CTA', text: 'Wissel de positie van Trustpilot en de CTA-knop om' },
    { label: 'Trustpilot → linksonder', text: 'Verplaats de Trustpilot-balk naar linksonder' },
    { label: 'Trustpilot → rechtsonder', text: 'Verplaats de Trustpilot-balk naar rechtsonder' },
    { label: 'Kortingsbadge → rechtsboven', text: 'Verplaats de kortingsbadge naar rechtsboven' },
    { label: 'Kortingsbadge → linksboven', text: 'Verplaats de kortingsbadge naar linksboven' },
    { label: 'Headline groter', text: 'Maak de headline groter en prominenter' },
    { label: 'Headline kleiner', text: 'Verklein de headline zodat er meer ruimte voor het product is' },
    { label: 'Product groter', text: 'Maak het product groter en zet het meer centraal' },
    { label: 'Product kleiner', text: 'Verklein het product en geef meer ruimte aan tekst' },
    { label: 'Product links, tekst rechts', text: 'Verplaats het product naar links, tekst naar rechts' },
    { label: 'Product rechts, tekst links', text: 'Verplaats het product naar rechts, tekst naar links' },
    { label: 'CTA midden onder', text: 'Verplaats de CTA-knop naar het midden onderin' }
  ],
  strip: [
    { label: 'Strip Trustpilot', text: 'Verwijder de Trustpilot-balk volledig uit het beeld, inclusief de sterren-rating en het reviews-aantal. Sluit het gat netjes met de bestaande achtergrond.' },
    { label: 'Strip CTA-knop', text: 'Verwijder de CTA-knop volledig uit het beeld. Sluit het gat met de bestaande achtergrond.' },
    { label: 'Strip kortingsbadge', text: 'Verwijder de kortingsbadge en het % korting label volledig uit het beeld.' },
    { label: 'Strip garantie-strip', text: 'Verwijder de garantie-strip onderaan (100 dagen geld terug garantie) volledig uit het beeld.' },
    { label: 'Strip prijs', text: 'Verwijder de prijs en crossed-out prijs volledig uit het beeld.' },
    { label: 'Strip body-copy', text: 'Verwijder de body-copy tekst onder de headline volledig uit het beeld. Houd alleen headline, product en wordmark.' },
    { label: 'Strip naar minimal', text: 'Verwijder ALLE UI-elementen: Trustpilot-balk, CTA-knop, kortingsbadge, garantie-strip, prijs. Houd alleen: WELLSHAVE wordmark, het product, en de headline. Pure brand-builder look met clean negatieve ruimte.', strong: true }
  ],
  add: [
    { label: '+ Trustpilot', text: 'Voeg een Trustpilot-balk toe in de signature dark-pill stijl met 4,5 van 5 sterren en het opgegeven aantal reviews' },
    { label: '+ CTA-knop', text: 'Voeg een CTA-pill toe onderin binnen de safe zone (dark pill, witte tekst, goud pijltje) met de tekst Shop nu' },
    { label: '+ Kortingsbadge', text: 'Voeg een kortingsbadge toe rechtsboven met de tekst -20%' },
    { label: '+ Garantie-strip', text: 'Voeg een gouden italic garantie-regel toe met de tekst 100 dagen geld-terug garantie' },
    { label: '+ Prijs', text: 'Voeg de prijs toe met een doorgestreepte oude prijs ernaast' },
    { label: '+ USP-vinkjes', text: 'Voeg drie korte USP-bullets toe met gouden vinkjes' },
    { label: '+ Body-tekst', text: 'Voeg een korte body-tekst van 1 zin toe onder de headline' },
    { label: '+ Wordmark', text: 'Voeg het WELLSHAVE wordmark toe in een hoek met goed contrast' }
  ]
};

function getEditMode(varIndex) {
  return (state.editMode && state.editMode[varIndex]) || 'adjust';
}

function setEditMode(varIndex, mode) {
  if (!state.editMode) state.editMode = {};
  state.editMode[varIndex] = mode;
  renderUnifiedModes(varIndex);
  renderUnifiedPresets(varIndex);
  const ta = document.getElementById(`ue-prompt-${varIndex}`);
  if (ta) ta.placeholder = EDIT_MODE_PLACEHOLDER[mode] || 'Beschrijf de wijziging...';
}

function renderUnifiedModes(varIndex) {
  const box = document.getElementById(`ue-modes-${varIndex}`);
  if (!box) return;
  const active = getEditMode(varIndex);
  box.innerHTML = EDIT_MODES.map(m => `
    <button type="button" class="ue-mode-btn ue-mode-${m.id}${m.id === active ? ' active' : ''}" onclick="setEditMode(${varIndex}, '${m.id}')">${m.label}</button>
  `).join('');
}

function renderUnifiedPresets(varIndex) {
  const box = document.getElementById(`ue-presets-${varIndex}`);
  const label = document.getElementById(`ue-mode-label-${varIndex}`);
  const mode = getEditMode(varIndex);
  if (label) { const mi = EDIT_MODES.find(m => m.id === mode); label.textContent = mi ? '· ' + mi.label.toLowerCase() : ''; }
  if (!box) return;
  const presets = EDIT_PRESETS[mode] || [];
  box.className = 'ue-presets ue-presets-' + mode;
  box.innerHTML = presets.map((p, i) => `<button type="button" class="ue-preset-chip${p.strong ? ' ue-preset-chip-strong' : ''}" onclick="setUnifiedPreset(${varIndex}, ${i})">${escapeHtml(p.label)}</button>`).join('');
}

function setUnifiedPreset(varIndex, i) {
  const mode = getEditMode(varIndex);
  const preset = (EDIT_PRESETS[mode] || [])[i];
  if (!preset) return;
  const ta = document.getElementById(`ue-prompt-${varIndex}`);
  if (!ta) return;
  const existing = ta.value.trim();
  ta.value = existing ? existing + '\n' + preset.text : preset.text;
  ta.focus();
  ta.scrollTop = ta.scrollHeight;
  if (typeof event !== 'undefined' && event && event.target) {
    const chip = event.target.closest ? (event.target.closest('.ue-preset-chip') || event.target) : event.target;
    chip.classList.add('just-clicked');
    setTimeout(() => chip.classList.remove('just-clicked'), 400);
  }
}

function addUnifiedStep(varIndex) {
  const ta = document.getElementById(`ue-prompt-${varIndex}`);
  const t = (ta.value || '').trim();
  if (!t) { toast('Typ eerst wat er moet gebeuren, of klik een snelkeuze', true); return; }
  const mode = getEditMode(varIndex);
  if (!state.pendingEdits[varIndex]) state.pendingEdits[varIndex] = [];
  state.pendingEdits[varIndex].push({ type: mode, text: t });
  ta.value = '';
  ta.focus();
  renderEditSteps(varIndex);
  toast('Toegevoegd aan stapel');
}

function buildEditInstruction(mode, promptText, hasRefs, safeZone) {
  let p;
  if (mode === 'layout') {
    p = `Edit the provided advertisement image with this LAYOUT change: ${promptText}.

This is a LAYOUT-ONLY edit. Critical constraints:
- Move, swap, resize, or reposition the EXISTING visual elements as instructed
- Keep ALL text content EXACTLY the same: every headline word, body copy, CTA text, badge text, Trustpilot label, prices, ratings, and any other text in the image must read identically character-for-character
- Keep the product appearance (shape, color, gold accents, all details) identical to the original
- Keep the background, lighting, color palette, and overall premium Wellshave aesthetic (matte black + gold) identical
- Do NOT add new elements, do NOT remove existing elements unless explicitly instructed, do NOT change text wording or redesign elements
- Only change the SPATIAL POSITIONING, SIZE, or ARRANGEMENT of existing elements, keep a balanced premium composition with no text overlapping or clipped`;
  } else if (mode === 'strip') {
    p = `Edit the provided advertisement image by REMOVING the following UI elements: ${promptText}

Critical constraints:
- Remove the specified UI elements COMPLETELY (do not just hide or shrink them)
- Fill the resulting gaps with a natural extension of the existing background, lighting, and color palette so the result looks intentional and clean
- Keep the PRODUCT appearance (shape, color, gold accents, all details) identical to the original
- Keep the headline, body copy (unless explicitly listed for removal), and WELLSHAVE wordmark exactly as they are unless explicitly listed for removal
- Keep the background, lighting, color palette, and overall premium Wellshave aesthetic (matte black + gold) identical
- After removal, rebalance the remaining composition so the ad still looks like a polished, premium DTC creative
- Do NOT add new elements, do NOT change wording of remaining text, do NOT redesign`;
  } else if (mode === 'add') {
    p = `Edit the provided advertisement image by ADDING the following element(s): ${promptText}

This is an ADDITIVE edit. Critical constraints:
- Keep ALL existing elements EXACTLY the same: every existing headline, body copy, CTA, badge, Trustpilot label, price, rating, the product appearance (shape, color, gold accents), the background, lighting and the premium Wellshave aesthetic (matte black plus gold). Existing text must stay identical character-for-character.
- ONLY add the new element(s) described above, integrated naturally and on-brand.
- Render any new text in correct Dutch, exactly as written, no spelling changes, mobile-readable typography in the matte black and gold Wellshave house style.
- Position the new element so it does NOT overlap or clip existing text or the product, keep a balanced premium composition.
- Do NOT remove or restyle existing elements, do NOT change existing wording.${safeZone || ''}`;
  } else {
    p = `Edit the FIRST image (the existing advertisement) with this specific change: ${promptText}.`;
  }
  if (hasRefs) {
    p += `

The ADDITIONAL images provided after the first one are VISUAL REFERENCES showing what the requested change should look like. Use them as the source of truth for the change (for example, if asked to replace the product with a supplied photo, render that photo's product). Reproduce what you see in the reference images, do not invent details.`;
  }
  if (mode === 'adjust') {
    p += `

Critical: preserve everything else in the original advertisement exactly as it is. Keep the original composition, layout, brand identity (Wellshave premium dark/gold aesthetic), all existing text content that is not part of the change, Trustpilot pill style if present, CTA pill style if present, trust anchor text if present, and overall mood. Apply ONLY the specifically requested change above, nothing else.`;
  }
  return p;
}

async function runUnifiedDirect(varIndex) {
  const ta = document.getElementById(`ue-prompt-${varIndex}`);
  const promptText = (ta.value || '').trim();
  if (!promptText) { toast('Beschrijf eerst de wijziging, of klik een snelkeuze', true); return; }

  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) {
    toast('Eerst OpenAI API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }
  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];
  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  const mode = getEditMode(varIndex);
  const editRefs = (state.pendingEditRefs && state.pendingEditRefs[varIndex]) || [];
  const hasRefs = editRefs.length > 0;

  const metadata = (state.lastGenerated && state.lastGenerated.metadata) ? state.lastGenerated.metadata : {};
  const szPlacement = current.placement || metadata.placement || 'feed11';
  const safeZone = (typeof buildSafeZoneInstruction === 'function') ? buildSafeZoneInstruction(szPlacement) : '';
  const fullPrompt = buildEditInstruction(mode, promptText, hasRefs, '') + safeZone;

  const btn = document.getElementById(`ue-direct-btn-${varIndex}`);
  if (btn) { btn.disabled = true; btn.textContent = hasRefs ? `Bezig (${editRefs.length} foto${editRefs.length > 1 ? "'s" : ''})...` : 'Bezig...'; }
  setEditBusy(varIndex, hasRefs ? `Aanpassing wordt toegepast met ${editRefs.length} foto${editRefs.length > 1 ? "'s" : ''}...` : 'Aanpassing wordt toegepast...');

  try {
    const currentDataUrl = `data:${current.mime || 'image/png'};base64,${current.b64}`;
    const blob = await dataUrlToBlob(currentDataUrl);
    const formData = new FormData();
    formData.append('model', current.model);
    formData.append('prompt', fullPrompt);
    formData.append('size', current.size);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');
    for (let i = 0; i < editRefs.length; i++) {
      const refDataUrl = `data:${editRefs[i].mimeType};base64,${editRefs[i].b64}`;
      const refBlob = await dataUrlToBlob(refDataUrl);
      formData.append('image[]', refBlob, `edit-ref-${i + 1}.png`);
    }
    const data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    const newB64 = data.data[0].b64_json;
    imgState.versions.push({
      b64: newB64,
      model: current.model,
      size: current.size,
      quality: current.quality,
      hasRefs: hasRefs,
      editRefsCount: editRefs.length,
      prompt: promptText,
      isEdit: true,
      editMode: mode,
      placement: current.placement,
      ts: Date.now()
    });
    imgState.currentIndex = imgState.versions.length - 1;
    if (hasRefs) state.pendingEditRefs[varIndex] = [];
    renderGeneratedImage(varIndex);
    notifyEditDone(varIndex, 'Aanpassing klaar');
  } catch (err) {
    clearEditBusy(varIndex);
    toast('Wijzigen mislukt: ' + err.message, true);
    console.error(err);
    if (btn) { btn.disabled = false; btn.textContent = 'Voer direct uit'; }
  }
}

const EDIT_STEP_LABELS = { adjust: 'Aanpassen', layout: 'Layout', strip: 'Strippen', add: 'Toevoegen', remove: 'Weghalen' };

function renderEditSteps(varIndex) {
  const steps = (state.pendingEdits && state.pendingEdits[varIndex]) || [];
  const countEl = document.getElementById(`ue-count-${varIndex}`);
  if (countEl) countEl.textContent = steps.length ? `${steps.length} ${steps.length === 1 ? 'wijziging' : 'wijzigingen'}` : '';
  const runBtn = document.getElementById(`combo-btn-${varIndex}`);
  if (runBtn) { runBtn.disabled = steps.length === 0; runBtn.style.display = steps.length === 0 ? 'none' : ''; }
  const box = document.getElementById(`combo-steps-${varIndex}`);
  if (!box) return;
  if (steps.length === 0) {
    box.innerHTML = '<div class="combo-empty">Nog geen wijzigingen gestapeld. Kies hierboven een type, typ of klik een snelkeuze en klik "+ Voeg toe aan stapel". Stapel er net zoveel als je wilt (gemengd) en voer ze daarna samen uit in een AI-ronde.</div>';
    return;
  }
  box.innerHTML = steps.map((s, i) => `
    <div class="combo-step combo-step-${s.type}">
      <span class="combo-step-type">${EDIT_STEP_LABELS[s.type] || s.type}</span>
      <span class="combo-step-text">${escapeHtml(s.text)}</span>
      <button class="combo-step-x" onclick="removeEditStep(${varIndex}, ${i})" title="Verwijder stap">×</button>
    </div>
  `).join('');
}

async function applyCombinedEdits(varIndex) {
  const steps = (state.pendingEdits && state.pendingEdits[varIndex]) || [];
  if (steps.length === 0) { toast('Voeg eerst minstens een stap toe', true); return; }
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) { toast('Vul eerst je OpenAI API-key in', true); return; }
  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];
  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  const removes = steps.filter(s => s.type === 'remove' || s.type === 'strip').map(s => s.text);
  const adds = steps.filter(s => s.type === 'add').map(s => s.text);
  const adjusts = steps.filter(s => s.type === 'adjust').map(s => s.text);
  const layouts = steps.filter(s => s.type === 'layout').map(s => s.text);
  const editRefs = (state.pendingEditRefs && state.pendingEditRefs[varIndex]) || [];
  const hasRefs = editRefs.length > 0;

  let instr = 'Edit the provided advertisement image by applying ALL of the following changes in ONE single pass, producing one final composition:\n';
  if (removes.length) instr += `\nREMOVE these elements completely and fill the gaps with a natural extension of the existing background:\n- ${removes.join('\n- ')}\n`;
  if (adds.length) instr += `\nADD these elements, on-brand (matte black + gold, Wellshave signature dark-pill style where relevant), placed within the safe zone, without disturbing the existing elements:\n- ${adds.join('\n- ')}\n`;
  if (layouts.length) instr += `\nLAYOUT changes, move/swap/resize existing elements only, keep all text wording identical character-for-character:\n- ${layouts.join('\n- ')}\n`;
  if (adjusts.length) instr += `\nADJUST the following, keeping everything else identical:\n- ${adjusts.join('\n- ')}\n`;
  if (hasRefs) instr += `\nThe ADDITIONAL images provided after the first one are VISUAL REFERENCES for the changes above. Where a change refers to a supplied photo (for example "replace the product with this photo"), reproduce what you see in the reference images, do not invent details.\n`;
  instr += `\nCritical constraints:\n- Apply removals, additions, layout changes and adjustments TOGETHER so the result is ONE balanced final creative, not separate passes\n- Keep the PRODUCT appearance (shape, color, gold accents, all details) identical to the original unless a change explicitly changes it\n- Keep all text wording and the WELLSHAVE wordmark exactly as-is unless explicitly listed for removal or adjustment\n- Keep background, lighting, color palette and the premium Wellshave aesthetic (matte black + gold) identical\n- After the changes, rebalance the composition so it stays a polished, premium DTC creative\n- Do NOT introduce unrelated changes`;
  const szPlacementC = current.placement || ((state.lastGenerated && state.lastGenerated.metadata) ? state.lastGenerated.metadata.placement : 'feed11') || 'feed11';
  if (typeof buildSafeZoneInstruction === 'function') instr += buildSafeZoneInstruction(szPlacementC);

  /* Deze knop hoort bij de kaart in het oude resultatenscherm. De wizard roept
     dezelfde bewerkfunctie aan vanuit stap 9, en daar bestaat die knop niet --
     dan viel de hele bewerking om op een null. De bewerking hangt er niet van
     af; het is alleen een knop die zichzelf op bezig zet. */
  const btn = document.getElementById(`combo-btn-${varIndex}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Bezig met alle wijzigingen...'; }
  setEditBusy(varIndex, `${steps.length} wijziging${steps.length === 1 ? '' : 'en'} word${steps.length === 1 ? 't' : 'en'} toegepast...`);
  try {
    const currentDataUrl = `data:${current.mime || 'image/png'};base64,${current.b64}`;
    const blob = await dataUrlToBlob(currentDataUrl);
    const formData = new FormData();
    formData.append('model', current.model);
    formData.append('prompt', instr);
    formData.append('size', current.size);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');
    for (let i = 0; i < editRefs.length; i++) {
      const refDataUrl = `data:${editRefs[i].mimeType};base64,${editRefs[i].b64}`;
      const refBlob = await dataUrlToBlob(refDataUrl);
      formData.append('image[]', refBlob, `combo-ref-${i + 1}.png`);
    }
    const data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    const newB64 = data.data[0].b64_json;
    imgState.versions.push({
      b64: newB64,
      model: current.model,
      size: current.size,
      quality: current.quality,
      hasRefs: false,
      prompt: steps.map(s => s.type + ': ' + s.text).join(' | '),
      isEdit: true,
      isComboEdit: true,
      placement: current.placement,
      ts: Date.now()
    });
    imgState.currentIndex = imgState.versions.length - 1;
    state.pendingEdits[varIndex] = [];
    if (hasRefs) state.pendingEditRefs[varIndex] = [];
    renderGeneratedImage(varIndex);
    notifyEditDone(varIndex, `${steps.length} wijziging${steps.length === 1 ? '' : 'en'} toegepast`);
  } catch (err) {
    clearEditBusy(varIndex);
    toast('Wijzigen mislukt: ' + err.message, true);
    console.error(err);
    if (btn) { btn.disabled = false; btn.textContent = 'Voer alle wijzigingen uit in een AI-ronde'; }
  }
}

async function editImage(varIndex) {
  const editPrompt = document.getElementById(`edit-prompt-${varIndex}`).value.trim();
  if (!editPrompt) {
    toast('Beschrijf eerst wat er moet veranderen', true);
    return;
  }

  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) {
    toast('Eerst OpenAI API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }

  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];

  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  const editBtn = document.getElementById(`edit-btn-${varIndex}`);
  const section = document.getElementById(`gen-image-${varIndex}`);
  editBtn.disabled = true;

  const editRefs = (state.pendingEditRefs && state.pendingEditRefs[varIndex]) || [];
  const hasRefs = editRefs.length > 0;

  editBtn.textContent = hasRefs
    ? `Bezig met aanpassen (${editRefs.length} referentie${editRefs.length > 1 ? 's' : ''})...`
    : 'Bezig met aanpassen...';

  // Wrap the edit prompt with preservation context so the AI does targeted edits
  let fullPrompt = `Edit the FIRST image (the existing advertisement) with this specific change: ${editPrompt}.`;
  if (hasRefs) {
    fullPrompt += `\n\nThe ADDITIONAL images provided after the first one are VISUAL REFERENCES showing what the requested change should look like. Use them as the source of truth for the change. For example, if the user says "replace the device with these photos", the additional images show the device to render in place of the original. If the user says "use this hand pose", the additional images show the pose to copy. Reproduce what you see in the reference images for the requested change, do not invent details.`;
  }
  fullPrompt += `\n\nCritical: preserve everything else in the original advertisement exactly as it is. Keep the original composition, layout, brand identity (Wellshave premium dark/gold aesthetic), all existing text content that is not part of the change, Trustpilot pill style if present, CTA pill style if present, trust anchor text if present, and overall mood. Apply ONLY the specifically requested change above, nothing else.`;

  try {
    const currentDataUrl = `data:image/png;base64,${current.b64}`;
    const blob = await dataUrlToBlob(currentDataUrl);

    const formData = new FormData();
    formData.append('model', current.model);
    formData.append('prompt', fullPrompt);
    formData.append('size', current.size);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');

    // Voeg edit-refs toe als extra image[] entries
    for (let i = 0; i < editRefs.length; i++) {
      const refDataUrl = `data:${editRefs[i].mimeType};base64,${editRefs[i].b64}`;
      const refBlob = await dataUrlToBlob(refDataUrl);
      formData.append('image[]', refBlob, `edit-ref-${i + 1}.png`);
    }

    const data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    const newB64 = data.data[0].b64_json;
    const newVersion = {
      b64: newB64,
      model: current.model,
      size: current.size,
      quality: current.quality,
      hasRefs: hasRefs,
      editRefsCount: editRefs.length,
      prompt: editPrompt,
      isEdit: true,
      ts: Date.now()
    };

    // Always append, never truncate, zo blijven alle eerdere versies behouden
    imgState.versions.push(newVersion);
    imgState.currentIndex = imgState.versions.length - 1;

    // Refs leegmaken na succesvolle edit, zodat de volgende edit fresh begint
    if (hasRefs) {
      state.pendingEditRefs[varIndex] = [];
    }

    renderGeneratedImage(varIndex);
    toast(hasRefs ? `Aanpassing toegepast met ${editRefs.length} referentie${editRefs.length > 1 ? 's' : ''}` : 'Aanpassing toegepast');
  } catch (err) {
    toast('Aanpassen mislukt: ' + err.message, true);
    console.error(err);
    editBtn.disabled = false;
    editBtn.textContent = 'Pas aan';
  }
}

function setLayoutPreset(varIndex, text) {
  const ta = document.getElementById(`layout-prompt-${varIndex}`);
  if (!ta) return;
  // Als er al tekst staat, voeg toe op nieuwe regel, anders zet alleen
  const existing = ta.value.trim();
  ta.value = existing ? existing + '\n' + text : text;
  ta.focus();
  // Optie: scroll naar het einde
  ta.scrollTop = ta.scrollHeight;
  // Visuele feedback op de chip
  if (event && event.target) {
    const chip = event.target;
    chip.classList.add('just-clicked');
    setTimeout(() => chip.classList.remove('just-clicked'), 400);
  }
}

async function editLayout(varIndex) {
  const layoutPrompt = document.getElementById(`layout-prompt-${varIndex}`).value.trim();
  if (!layoutPrompt) {
    toast('Beschrijf eerst de layout-aanpassing of klik een preset', true);
    return;
  }

  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) {
    toast('Eerst OpenAI API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }

  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];

  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  const layoutBtn = document.getElementById(`layout-btn-${varIndex}`);
  layoutBtn.disabled = true;
  layoutBtn.textContent = 'Bezig met layout-wijziging...';

  // Layout-specifieke prompt-wrap: bewaar inhoud, verplaats alleen elementen
  const fullPrompt = `Edit the provided advertisement image with this LAYOUT change: ${layoutPrompt}.

This is a LAYOUT-ONLY edit. Critical constraints:
- Move, swap, resize, or reposition the EXISTING visual elements as instructed
- Keep ALL text content EXACTLY the same: every headline word, body copy, CTA text, badge text, Trustpilot label, prices, ratings, and any other text in the image must read identically character-for-character
- Keep the product appearance (shape, color, gold accents, all details) identical to the original
- Keep the background, lighting, color palette, and overall premium Wellshave aesthetic (matte black + gold) identical
- Do NOT add new elements that were not in the original
- Do NOT remove existing elements unless explicitly instructed
- Do NOT change text wording, do NOT redesign elements
- Only change the SPATIAL POSITIONING, SIZE, or ARRANGEMENT of existing elements

If the instruction is ambiguous, prioritize maintaining a balanced, premium composition consistent with high-end DTC advertising and ensuring no text overlaps or gets clipped.`;

  try {
    const currentDataUrl = `data:image/png;base64,${current.b64}`;
    const blob = await dataUrlToBlob(currentDataUrl);

    const formData = new FormData();
    formData.append('model', current.model);
    formData.append('prompt', fullPrompt);
    formData.append('size', current.size);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');

    const data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    const newB64 = data.data[0].b64_json;
    const newVersion = {
      b64: newB64,
      model: current.model,
      size: current.size,
      quality: current.quality,
      hasRefs: false,
      prompt: layoutPrompt,
      isEdit: true,
      isLayoutEdit: true,
      ts: Date.now()
    };

    imgState.versions.push(newVersion);
    imgState.currentIndex = imgState.versions.length - 1;

    renderGeneratedImage(varIndex);
    toast('Layout aangepast');
  } catch (err) {
    toast('Layout-wijziging mislukt: ' + err.message, true);
    console.error(err);
    layoutBtn.disabled = false;
    layoutBtn.textContent = 'Wijzig layout';
  }
}

function setStripPreset(varIndex, text) {
  const ta = document.getElementById(`strip-prompt-${varIndex}`);
  if (!ta) return;
  const existing = ta.value.trim();
  ta.value = existing ? existing + '\n' + text : text;
  ta.focus();
  ta.scrollTop = ta.scrollHeight;
  if (event && event.target) {
    const chip = event.target;
    chip.classList.add('just-clicked');
    setTimeout(() => chip.classList.remove('just-clicked'), 400);
  }
}

async function editStrip(varIndex) {
  const stripPrompt = document.getElementById(`strip-prompt-${varIndex}`).value.trim();
  if (!stripPrompt) {
    toast('Kies eerst een strip-preset of beschrijf wat weg moet', true);
    return;
  }

  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) {
    toast('Eerst OpenAI API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }

  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];

  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  const stripBtn = document.getElementById(`strip-btn-${varIndex}`);
  stripBtn.disabled = true;
  stripBtn.textContent = 'Bezig met verwijderen...';

  // Strip-specifieke prompt-wrap: WEL elementen verwijderen, achtergrond herstellen, andere elementen behouden
  const fullPrompt = `Edit the provided advertisement image by REMOVING the following UI elements: ${stripPrompt}

Critical constraints:
- Remove the specified UI elements COMPLETELY (do not just hide or shrink them)
- Fill the resulting gaps with a natural extension of the existing background, lighting, and color palette so the result looks intentional and clean
- Keep the PRODUCT appearance (shape, color, gold accents, all details) identical to the original
- Keep the headline, body copy (unless explicitly listed for removal), and WELLSHAVE wordmark exactly as they are unless explicitly listed for removal
- Keep the background, lighting, color palette, and overall premium Wellshave aesthetic (matte black + gold) identical
- After removal, rebalance the remaining elements composition-wise so the ad still looks like a polished, premium DTC creative
- Do NOT add new elements, do NOT change wording of remaining text, do NOT redesign

The goal is a cleaner, more focused composition with fewer UI distractions, suitable for top-of-funnel awareness or brand-builder placement.`;

  try {
    const currentDataUrl = `data:image/png;base64,${current.b64}`;
    const blob = await dataUrlToBlob(currentDataUrl);

    const formData = new FormData();
    formData.append('model', current.model);
    formData.append('prompt', fullPrompt);
    formData.append('size', current.size);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');

    const data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    const newB64 = data.data[0].b64_json;
    const newVersion = {
      b64: newB64,
      model: current.model,
      size: current.size,
      quality: current.quality,
      hasRefs: false,
      prompt: stripPrompt,
      isEdit: true,
      isStripEdit: true,
      ts: Date.now()
    };

    imgState.versions.push(newVersion);
    imgState.currentIndex = imgState.versions.length - 1;

    renderGeneratedImage(varIndex);
    toast('Elementen verwijderd');
  } catch (err) {
    toast('Verwijderen mislukt: ' + err.message, true);
    console.error(err);
    stripBtn.disabled = false;
    stripBtn.textContent = 'Verwijder elementen';
  }
}

function setAddPreset(varIndex, text) {
  const ta = document.getElementById(`add-prompt-${varIndex}`);
  if (!ta) return;
  const existing = ta.value.trim();
  ta.value = existing ? existing + '\n' + text : text;
  ta.focus();
  ta.scrollTop = ta.scrollHeight;
  if (event && event.target) {
    const chip = event.target;
    chip.classList.add('just-clicked');
    setTimeout(() => chip.classList.remove('just-clicked'), 400);
  }
}

async function editAdd(varIndex) {
  const addPrompt = document.getElementById(`add-prompt-${varIndex}`).value.trim();
  if (!addPrompt) {
    toast('Kies eerst een toevoeg-preset of beschrijf wat erbij moet', true);
    return;
  }

  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) {
    toast('Eerst OpenAI API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }

  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];

  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');

  const metadata = (state.lastGenerated && state.lastGenerated.metadata) ? state.lastGenerated.metadata : {};
  const safeZone = (typeof buildSafeZoneInstruction === 'function') ? buildSafeZoneInstruction(metadata.placement) : '';

  const addBtn = document.getElementById(`add-btn-${varIndex}`);
  addBtn.disabled = true;
  addBtn.textContent = 'Bezig met toevoegen...';

  // Add-specifieke prompt-wrap: behoud ALLES, voeg alleen het nieuwe element toe
  const fullPrompt = `Edit the provided advertisement image by ADDING the following element(s): ${addPrompt}

This is an ADDITIVE edit. Critical constraints:
- Keep ALL existing elements EXACTLY the same: every existing headline, body copy, CTA, badge, Trustpilot label, price, rating, the product appearance (shape, color, gold accents), the background, lighting and the premium Wellshave aesthetic (matte black plus gold). Existing text must stay identical character-for-character.
- ONLY add the new element(s) described above, integrated naturally and on-brand.
- Render any new text in correct Dutch, exactly as written, no spelling changes, mobile-readable typography in the matte black and gold Wellshave house style.
- Position the new element so it does NOT overlap or clip existing text or the product, keep a balanced premium composition.
- Do NOT remove or restyle existing elements, do NOT change existing wording.${safeZone}`;

  try {
    const currentDataUrl = `data:image/png;base64,${current.b64}`;
    const blob = await dataUrlToBlob(currentDataUrl);

    const formData = new FormData();
    formData.append('model', current.model);
    formData.append('prompt', fullPrompt);
    formData.append('size', current.size);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');

    const data = await fetchJsonWithRetry(`${proxyUrl}/v1/images/edits`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    const newB64 = data.data[0].b64_json;
    const newVersion = {
      b64: newB64,
      model: current.model,
      size: current.size,
      quality: current.quality,
      hasRefs: false,
      prompt: addPrompt,
      isEdit: true,
      isAddEdit: true,
      ts: Date.now()
    };

    imgState.versions.push(newVersion);
    imgState.currentIndex = imgState.versions.length - 1;

    renderGeneratedImage(varIndex);
    toast('Element toegevoegd');
  } catch (err) {
    toast('Toevoegen mislukt: ' + err.message, true);
    console.error(err);
    addBtn.disabled = false;
    addBtn.textContent = 'Voeg toe';
  }
}

const FORMAT_MODE_INFO = {
  'auto': { title: 'Auto', summary: 'Claude kiest per variatie zelf de best passende format mode op basis van het gedetecteerde archetype en de funnel-fase. Bij meerdere variaties spreidt hij bewust over verschillende modes zodat je niet steeds dezelfde opbouw krijgt.', when: 'Als je niet zeker weet welke vorm past, of juist variatie wilt over een hele batch.', elements: null },
  'direct-response': { title: 'Direct-Response', summary: 'De volledige conversie-stack. Alles wat een kijker nodig heeft om te klikken, in 1 beeld.', when: 'BOF en retargeting, of elke ad die direct moet converteren. Werkt op alle funnels.', elements: ['WELLSHAVE wordmark', 'Hero product', 'Headline', 'Body copy', 'Trustpilot pill (4,5 van 5, het opgegeven aantal reviews)', 'CTA-knop', 'Gouden trust-anker'] },
  'brand-builder': { title: 'Brand-Builder', summary: 'Minimalistisch en sfeervol, gericht op merkherkenning in plaats van directe verkoop. Geen Trustpilot, geen CTA, geen badges.', when: 'Top-of-funnel awareness, premium uitstraling, Founder Story die niet meteen verkoopt.', elements: ['WELLSHAVE wordmark', 'Product hero in mooie setting', 'Optionele korte tagline'] },
  'feature-education': { title: 'Feature-Education', summary: 'Legt uit wat het product kan met gelabelde features of annotaties rond het product.', when: 'MOF, als de kijker het merk kent maar nog twijfelt over functies.', elements: ['WELLSHAVE wordmark', 'Product, vaak uitgelicht', 'Headline', 'Feature-pills met gouden vinkjes', 'Optionele korte body'] },
  'bundle-showcase': { title: 'Bundle-Showcase', summary: 'Toont meerdere producten samen als een voordelige set.', when: 'BOF, cross-sell, Black Friday of cadeau-sets.', elements: ['WELLSHAVE wordmark', 'Meerdere producten samen', 'Headline', 'Bundel-prijs of korting', 'CTA-knop'] },
  'lifestyle-placement': { title: 'Lifestyle-Placement', summary: 'Product in een mooie, echte omgeving met minimale of geen tekst. De sfeer doet het werk.', when: 'Top-of-funnel mood-ads, Seasonal, premium aesthetic.', elements: ['Product in real-world setting', 'Minimale tot geen overlay-tekst', 'Optioneel WELLSHAVE wordmark'] },
  'advertorial-news': { title: 'Nieuwsartikel', summary: 'Oogt als een nieuwsbericht of magazine-artikel, bewust ZONDER merk-huisstijl: licht redactioneel canvas, categorie-tag, journalistieke kop, lead-alinea, candid nieuwsfoto en een "Lees verder"-tekstlink. Elke variatie kiest 2-3 scroll-stoppers: listicle-getal in de kop, gemarkeerde zin, pull-quote, expert-regel, "Bekend van"-persregel, lezersquote, foto-caption of een specifiek getal. De ad verkoopt het artikel, niet het product.', when: 'Cold traffic (TOF/MOF) richting een listicle of advertorial. Bv een artikel over ingegroeide haren, scheerfouten of de grootste afknappers van vrouwen.', elements: ['Categorie-tag (bv GEZONDHEID)', 'Journalistieke kop (evt. met getal)', 'Lead-alinea', 'Candid foto die de emotie van de kop draagt', '2-3 scroll-stoppers (pull-quote, markering, expert, persregel, lezersquote, caption)', 'Tekstlink "Lees verder", geen knop'] }
};
const ARCHETYPE_INFO = {
  'premium': { title: 'Premium', summary: 'Draait om status, kwaliteit en uitstraling. Strak, donker, weinig tekst.', example: 'Voor de man die geen concessies doet.', when: 'TOF, merkbeleving.' },
  'educational': { title: 'Educational', summary: 'Leert de kijker iets en lost een kennisvraag op.', example: 'Waarom je scheermesje je huid irriteert, en wat wel werkt.', when: 'MOF.' },
  'ugc': { title: 'UGC', summary: 'Voelt als content van een echte gebruiker, niet als reclame.', example: 'Ik dacht dat alle trimmers hetzelfde waren. Tot dit.', when: 'TOF en MOF, koud verkeer.' },
  'authority': { title: 'Authority', summary: 'Leunt op expertise, autoriteit of cijfers.', example: 'Getest door 800+ mannen, beoordeeld met 4,5 van 5.', when: 'MOF en BOF.' },
  'offer': { title: 'Offer', summary: 'Zet de aanbieding centraal: korting, bundel of deal.', example: 'Nu 20% korting, alleen dit weekend.', when: 'BOF en retargeting.' },
  'comparison': { title: 'Comparison', summary: 'Zet Wellshave naast het alternatief of de oude manier.', example: 'Wegwerpmesje versus Wellshave. Zie het verschil.', when: 'MOF.' },
  'beforeafter': { title: 'Before / After', summary: 'Toont het resultaat: de situatie voor en na.', example: '3 dagen stoppels versus 3 minuten werk.', when: 'MOF en BOF.' },
  'founder': { title: 'Founder Story', summary: 'Persoonlijk verhaal van de oprichter of het merk.', example: 'Waarom ik Wellshave begon.', when: 'TOF.' },
  'seasonal': { title: 'Seasonal / Themed', summary: 'Haakt in op een seizoen, event of moment.', example: 'Klaar voor de zomer in 3 minuten.', when: 'Afhankelijk van de timing.' },
  'objection': { title: 'Objection Reply', summary: 'Pakt een veelgehoord bezwaar beet en weerlegt het.', example: 'Te duur? Reken eens uit wat mesjes je per jaar kosten.', when: 'MOF en BOF.' },
  'analogie': { title: 'Analogie', summary: 'Legt de waarde uit via een herkenbare vergelijking.', example: 'Een tandenborstel vervang je ook. Je scheerkop net zo.', when: 'TOF en MOF.' },
  'trend': { title: 'Trend', summary: 'Sluit aan op een actuele trend of een format dat nu werkt.', example: 'Afhankelijk van de trend van het moment.', when: 'TOF.' },
  'mix': { title: 'Mix', summary: 'Combineert twee of meer archetypes in 1 ad, bijvoorbeeld Authority plus Offer of UGC plus Before/After.', example: 'Getest door barbiers, deze week met 20% korting.', when: 'Als 1 invalshoek te dun voelt en je meerdere triggers wilt stapelen.' }
};

function buildWireframe(elements) {
  if (!elements || !elements.length) return '<div class="ex-frame ex-frame-empty">Claude kiest de opbouw automatisch per variatie</div>';
  const blocks = elements.map(function(el) {
    const tall = /hero|product|setting/i.test(el);
    return '<div class="ex-block ' + (tall ? 'tall' : '') + '"><span>' + el + '</span></div>';
  }).join('');
  return '<div class="ex-frame">' + blocks + '</div>';
}

const SOPHISTICATION_INFO = {
  'overview': {
    title: 'Market sophistication',
    summary: 'Hoe vaak heeft je markt de beloftes al gehoord. Hoe verzadigder de markt, hoe harder je claim en mechanisme moeten werken. Wellshave zit in een drukke scheer- en trimmer-markt, dus in de praktijk meestal stadium 4 of 5.',
    levels: [
      'Stadium 1, je bent als eerste in de markt, een simpele directe claim volstaat ("Glad geschoren in een haal")',
      'Stadium 2, concurrenten roepen hetzelfde, je moet de claim vergroten of specifieker maken',
      'Stadium 3, kale claims zijn uitgewerkt, je introduceert een uniek mechanisme dat verklaart waarom het werkt',
      'Stadium 4, mechanisme-oorlog, je maakt jouw mechanisme groter, eleganter of geloofwaardiger dan dat van de concurrent',
      'Stadium 5, de markt is moe en sceptisch, je wint op identificatie, beleving en status, niet op een nieuwe claim'
    ],
    when: 'Kies hoger naarmate de doelgroep al veel grooming-ads heeft gezien. Op koud publiek dat de categorie kent zit je vaak op 4 of 5. Laat op auto als je twijfelt, dan kiest de generator op basis van markt en concept.'
  }
};
const AWARENESS_INFO = {
  'overview': {
    title: 'Customer awareness',
    summary: 'Wat de kijker al weet op het moment dat de ad verschijnt. Dit bepaalt waar je opent. Te ver vooruit (meteen prijs bij iemand die het probleem niet kent) of te ver achter (probleem-educatie bij iemand die al wil kopen) verbrandt de ad.',
    levels: [
      'Unaware, kent het probleem nog niet, open met intrige of een herkenbare observatie, nooit meteen product of prijs',
      'Probleembewust, voelt de pijn maar kent de oplossing niet, benoem en agiteer het probleem kort',
      'Oplossingsbewust, kent oplossingstypes maar het merk nog niet, positioneer het merk als de beste in zijn soort',
      'Productbewust, kent het merk al maar twijfelt, leun op bewijs: reviews, garantie, vergelijking',
      'Meest bewust, klaar om te kopen, leid met de aanbieding, urgentie of een directe CTA'
    ],
    when: 'Koud verkeer (TOF) zit meestal links (unaware of probleembewust), retargeting en je e-maillijst zitten rechts (product- of meest bewust). Laat op auto als je het aan de funnel-fase wilt overlaten.'
  }
};

function openExampleModal(event, type, key) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  let info;
  if (type === 'mode') info = FORMAT_MODE_INFO[key];
  else if (type === 'soph') info = SOPHISTICATION_INFO[key];
  else if (type === 'aware') info = AWARENESS_INFO[key];
  else info = ARCHETYPE_INFO[key];
  if (!info) return;
  let modal = document.getElementById('example-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'example-modal';
    modal.className = 'example-modal';
    modal.addEventListener('click', function(e) { if (e.target === modal) closeExampleModal(); });
    document.body.appendChild(modal);
  }
  let body;
  if (type === 'soph' || type === 'aware') {
    body = '<div class="ex-text"><p class="ex-summary">' + info.summary + '</p>'
      + '<div class="ex-sub">De niveaus</div><ul class="ex-list">' + info.levels.map(function(l){return '<li>' + l + '</li>';}).join('') + '</ul>'
      + '<div class="ex-sub">Voor Wellshave</div><p class="ex-when">' + info.when + '</p></div>';
  } else if (type === 'mode') {
    body = '<div class="ex-grid"><div class="ex-visual">' + buildWireframe(info.elements) + '</div><div class="ex-text">'
      + '<p class="ex-summary">' + info.summary + '</p>'
      + (info.elements && info.elements.length ? ('<div class="ex-sub">In beeld</div><ul class="ex-list">' + info.elements.map(function(e){return '<li>' + e + '</li>';}).join('') + '</ul>') : '')
      + '<div class="ex-sub">Wanneer</div><p class="ex-when">' + info.when + '</p>'
      + '</div></div>';
  } else {
    body = '<div class="ex-text">'
      + '<p class="ex-summary">' + info.summary + '</p>'
      + '<div class="ex-sub">Voorbeeld-headline</div><p class="ex-example">' + info.example + '</p>'
      + '<div class="ex-sub">Wanneer</div><p class="ex-when">' + info.when + '</p>'
      + '</div>';
  }
  modal.innerHTML = '<div class="example-modal-card"><div class="example-modal-head"><span class="example-modal-title">' + info.title + '</span><button class="example-modal-close" onclick="closeExampleModal()">&times;</button></div>'
    + body
    + '<div class="example-modal-note">Schematisch voorbeeld ter illustratie, geen echte gegenereerde advertentie.</div></div>';
  modal.classList.add('open');
}

function closeExampleModal() {
  const m = document.getElementById('example-modal');
  if (m) m.classList.remove('open');
}

function safeZonePercents(placement) {
  if (placement === 'stories') return { top: 14, bottom: 20, side: 6 };
  if (placement === 'reels') return { top: 14, bottom: 35, side: 6 };
  if (placement === 'feed45') return { top: 18, bottom: 18, side: 9 };
  return { top: 9, bottom: 9, side: 9 };
}

function toggleSafezone(varIndex) {
  state.safezoneVisible = state.safezoneVisible || {};
  state.safezoneVisible[varIndex] = !state.safezoneVisible[varIndex];
  const ov = document.getElementById(`safezone-overlay-${varIndex}`);
  const btn = document.getElementById(`safezone-toggle-${varIndex}`);
  if (ov) ov.classList.toggle('on', state.safezoneVisible[varIndex]);
  if (btn) btn.classList.toggle('active', state.safezoneVisible[varIndex]);
}

async function checkSafezone(varIndex) {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  const status = document.getElementById(`safezone-status-${varIndex}`);
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];
  const placement = (state.lastGenerated && state.lastGenerated.metadata && state.lastGenerated.metadata.placement) ? state.lastGenerated.metadata.placement : 'feed11';
  const sz = safeZonePercents(placement);
  const placementLabel = placement === 'stories' ? 'Stories 9:16' : placement === 'reels' ? 'Reels 9:16' : placement === 'feed45' ? 'Feed 4:5' : 'Feed 1:1';
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById(`safezone-check-btn-${varIndex}`);
  if (btn) btn.disabled = true;
  if (status) { status.className = 'safezone-status checking'; status.textContent = 'bezig met controleren...'; }
  try {
    const userText = `Dit is een advertentie voor plaatsing ${placementLabel}. De gereserveerde marges waar GEEN tekst, logo, wordmark, CTA-knop, prijs, badge of Trustpilot-element mag staan: boven ${sz.top}%, onder ${sz.bottom}%, links ${sz.side}% en rechts ${sz.side}% van de afbeelding. Het product zelf mag wel in die marges, tekst en UI-elementen niet. Beoordeel of er leesbare tekst of een UI-element binnen een van die marges valt. Antwoord met STRICT JSON, geen markdown: {"verdict":"pass","issues":[],"summary":"1 korte zin"} of {"verdict":"warn","issues":["welk element en in welke marge"],"summary":"1 korte zin"}.`;
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 600, messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: 'image/png', data: current.b64 } }, { type: 'text', text: userText } ] }] })
    });
    const text = wgClaudeText(data);
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('geen JSON');
    const parsed = JSON.parse(text.substring(s, e + 1));
    const pass = parsed.verdict === 'pass';
    if (status) {
      status.className = 'safezone-status ' + (pass ? 'ok' : 'warn');
      status.textContent = pass ? 'Safe zones OK' : ('Let op: ' + (parsed.summary || 'tekst in marge'));
      status.title = (parsed.issues && parsed.issues.length) ? parsed.issues.join(' | ') : (parsed.summary || '');
    }
    if (!pass) {
      state.safezoneVisible = state.safezoneVisible || {};
      state.safezoneVisible[varIndex] = true;
      const ov = document.getElementById(`safezone-overlay-${varIndex}`);
      const tg = document.getElementById(`safezone-toggle-${varIndex}`);
      if (ov) ov.classList.add('on');
      if (tg) tg.classList.add('active');
    }
  } catch (err) {
    if (status) { status.className = 'safezone-status warn'; status.textContent = 'controle mislukt'; status.title = err.message; }
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function reformatImage(varIndex, targetKey) {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('openai-key').value.trim());
  if (!apiKey) { toast('Eerst OpenAI API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];
  const model = current.model;
  const sizeMap = SIZE_MAP[model] || SIZE_MAP['gpt-image-2'];
  const targetSize = sizeMap[targetKey] || '1024x1024';
  const labelMap = { stories: 'Stories/Reels 9:16', feed45: 'Feed 4:5', feed11: 'Vierkant 1:1', wide: 'Liggend 16:9' };
  const ratioLabel = labelMap[targetKey] || targetKey;
  const variation = (state.lastGenerated && state.lastGenerated.variations) ? state.lastGenerated.variations[varIndex] : null;
  const textOverlay = variation ? buildTextOverlayInstruction(variation) : '';
  const safeZone = buildSafeZoneInstruction(targetKey);
  let layoutPriority = 'LAYOUT PRIORITY (read first): every piece of text, the WELLSHAVE wordmark and the CTA button must sit fully inside the safe area, inset from all edges, never flush against the top or bottom edge. ';
  if (targetKey === 'stories') {
    layoutPriority += 'THE TARGET IS A 9:16 VERTICAL FORMAT: when recomposing, MOVE every text and UI element into the central band between 16 and 78 percent of the image height. The top 16 percent and the bottom 22 percent are hard-forbidden for any text, button, link or logo; whatever sat near an edge in the original MUST be repositioned into the band. ';
  }
  const reframePrompt = layoutPriority + 'Re-frame this existing advertisement into a ' + ratioLabel + ' format. This is the SAME ad: keep the exact same product, the same background scene and visual style, the same headline text, the same WELLSHAVE wordmark and the same CTA. Naturally extend or recompose the background so it fills the new ' + ratioLabel + ' canvas without stretching or distorting the product. Reposition the headline, the wordmark, the CTA and any other text so they all sit fully inside the safe area for this format. Do not invent new text, keep all copy identical character for character.' + textOverlay + safeZone;
  const proxyUrl = (PROXY_BASE).replace(/\/$/, '');
  const btn = document.getElementById('reformat-btn-' + varIndex + '-' + targetKey);
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Bezig...'; }
  try {
    const blob = await dataUrlToBlob('data:image/png;base64,' + current.b64);
    const formData = new FormData();
    formData.append('model', model);
    formData.append('prompt', reframePrompt);
    formData.append('size', targetSize);
    formData.append('quality', current.quality);
    formData.append('n', '1');
    formData.append('image[]', blob, 'current-version.png');
    const data = await fetchJsonWithRetry(proxyUrl + '/v1/images/edits', { method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey }, body: formData });
    const newB64 = data.data[0].b64_json;
    imgState.versions.push({ b64: newB64, model: model, size: targetSize, quality: current.quality, hasRefs: false, prompt: 'reformat ' + ratioLabel, isEdit: true, isReformat: true, placement: targetKey, ts: Date.now() });
    imgState.currentIndex = imgState.versions.length - 1;
    renderGeneratedImage(varIndex);
    if (typeof toast === 'function') toast(ratioLabel + ' versie gemaakt');
  } catch (err) {
    console.error(err);
    toast('Reformat mislukt: ' + err.message, true);
    if (btn) { btn.disabled = false; btn.textContent = origText; }
  }
}

function navigateImageVersion(varIndex, delta) {
  const imgState = state.generatedImages[varIndex];
  if (!imgState) return;
  const newIndex = Math.max(0, Math.min(imgState.versions.length - 1, imgState.currentIndex + delta));
  if (newIndex === imgState.currentIndex) return;
  imgState.currentIndex = newIndex;
  renderGeneratedImage(varIndex);
}

function setImageVersion(varIndex, index) {
  const imgState = state.generatedImages[varIndex];
  if (!imgState || index < 0 || index >= imgState.versions.length) return;
  if (index === imgState.currentIndex) return;
  imgState.currentIndex = index;
  renderGeneratedImage(varIndex);
}

function resetImageVersions(varIndex) {
  const imgState = state.generatedImages[varIndex];
  if (!imgState || imgState.versions.length <= 1) return;
  if (!confirm('Alle aanpassingen verwijderen en terug naar het origineel?')) return;
  imgState.versions = imgState.versions.slice(0, 1);
  imgState.currentIndex = 0;
  renderGeneratedImage(varIndex);
  toast('Terug naar origineel');
}

function fnSlug(s) {
  return String(s)
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Afkortingen voor de naming convention. Niet toegepast = 'none'.
function abbrevMode(m) {
  if (!m) return 'none';
  const map = { 'auto': 'AUTO', 'direct-response': 'DR', 'brand-builder': 'BB', 'feature-education': 'FE', 'bundle-showcase': 'BS', 'lifestyle-placement': 'LP' };
  return map[String(m).toLowerCase()] || fnSlug(m).toUpperCase();
}
function abbrevArch(a) {
  if (!a) return 'none';
  const map = { 'premium': 'PREM', 'educational': 'EDU', 'ugc': 'UGC', 'authority': 'AUTH', 'offer': 'OFFER', 'comparison': 'COMP', 'beforeafter': 'BA', 'founder': 'FND', 'seasonal': 'SEAS', 'objection': 'OBJ', 'analogie': 'ANL', 'trend': 'TRND', 'mix': 'MIX' };
  return map[String(a).toLowerCase()] || fnSlug(a).toUpperCase();
}
function abbrevSoph(s) {
  if (!s) return 'none';
  const n = String(s).replace(/[^0-9]/g, '');
  return n ? 'S' + n : 'none';
}
function abbrevAware(a) {
  if (!a) return 'none';
  const map = { 'unaware': 'UNAW', 'problem': 'PROB', 'solution': 'SOLU', 'product': 'PROD', 'most': 'MOST' };
  return map[String(a).toLowerCase()] || fnSlug(a).toUpperCase();
}
function abbrevPersona(name) {
  if (!name) return 'none';
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  let ab = words.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (ab.length < 2) ab = String(name).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  return ab || 'none';
}

// Bouwt de bestandsnaam volgens de afgesproken conventie:
// <product>_FM-<mode>_AR-<archetype>_PE-<persona>_<funnel>_<placement>_<varlabel>[_vX]_<datum>.png
function buildAdFilename(meta, varLabel, versionTag) {
  meta = meta || {};
  const funnelMap = {
    'Top of Funnel': 'TOF', 'Middle of Funnel': 'MOF', 'Bottom of Funnel': 'BOF',
    'Re-targeting': 'Re-targeting', 'Retargeting': 'Re-targeting'
  };
  const product = meta.product ? fnSlug(meta.product) : 'ad';
  const funnel = funnelMap[meta.funnel] || (meta.funnel ? fnSlug(meta.funnel) : 'none');
  const placement = meta.placement ? fnSlug(meta.placement) : 'none';
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parts = [
    product,
    'FM-' + abbrevMode(meta.mode),
    'AR-' + abbrevArch(meta.archetype),
    'AW-' + abbrevAware(meta.awareness),
    'SO-' + abbrevSoph(meta.sophistication),
    'PE-' + abbrevPersona(meta.personaName),
    funnel,
    placement,
    varLabel
  ].filter(Boolean);
  return parts.join('_') + (versionTag || '') + '_' + date + '.png';
}

function buildImageFilename(varIndex, currentIndex, totalVersions) {
  const meta = state.lastGenerated.metadata || {};
  const versionTag = totalVersions > 1 ? `_v${currentIndex + 1}` : '';
  return buildAdFilename(meta, `var${varIndex + 1}`, versionTag);
}

function downloadImage(varIndex) {
  const imgState = state.generatedImages[varIndex];
  if (!imgState || !imgState.versions || imgState.versions.length === 0) return;
  const current = imgState.versions[imgState.currentIndex];
  let filename = buildImageFilename(varIndex, imgState.currentIndex, imgState.versions.length);
  const mime = current.mime || 'image/png';
  if (mime.indexOf('jpeg') !== -1) filename = filename.replace(/\.png$/, '.jpg');
  const a = document.createElement('a');
  a.href = `data:${mime};base64,${current.b64}`;
  a.download = filename;
  a.click();
}

