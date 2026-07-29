// ============================================================
// INLINE EDIT VAN HEADLINE/BODY/CTA MET PROMPT-SYNC
// ============================================================
function syncCopyField(varIndex, fieldKind) {
  if (!state.lastGenerated || !state.lastGenerated.variations[varIndex]) return;
  const fieldMap = {
    headline: { stateKey: 'headline_nl', inputId: `var-${varIndex}-headline`, syncId: `var-${varIndex}-headline-sync` },
    body: { stateKey: 'body_copy_nl', inputId: `var-${varIndex}-body`, syncId: `var-${varIndex}-body-sync` },
    cta: { stateKey: 'cta_nl', inputId: `var-${varIndex}-cta`, syncId: `var-${varIndex}-cta-sync` }
  };
  const cfg = fieldMap[fieldKind];
  if (!cfg) return;

  const input = document.getElementById(cfg.inputId);
  if (!input) return;
  const newValue = input.value;
  const oldValue = input.dataset.original || state.lastGenerated.variations[varIndex][cfg.stateKey];

  // Update state
  state.lastGenerated.variations[varIndex][cfg.stateKey] = newValue;

  // Headline-preview (de grote tekst bovenaan de kaart) bijwerken
  if (fieldKind === 'headline') {
    const preview = document.getElementById(`var-${varIndex}-headline-preview`);
    if (preview) preview.textContent = newValue;
  }

  // Sync naar OpenAI prompt textarea, debounced via debounce-id op input
  clearTimeout(input._syncTimer);
  const syncStatus = document.getElementById(cfg.syncId);
  if (syncStatus) {
    syncStatus.textContent = 'wijziging gedetecteerd, sync wacht...';
    syncStatus.className = 'sync-status edited';
  }
  input._syncTimer = setTimeout(() => {
    propagateToPrompt(varIndex, oldValue, newValue, fieldKind, syncStatus);
    // Reset data-original zodat volgende edit weer relatief is aan huidige waarde
    input.dataset.original = newValue;
  }, 600);
}

function propagateToPrompt(varIndex, oldValue, newValue, fieldKind, syncStatus) {
  const promptTextarea = document.getElementById(`var-${varIndex}-prompt`);
  if (!promptTextarea) return;
  const currentPrompt = promptTextarea.value;

  const oldTrim = (oldValue || '').trim();
  const newTrim = (newValue || '').trim();

  if (oldTrim === newTrim) {
    if (syncStatus) {
      syncStatus.textContent = '';
      syncStatus.className = 'sync-status';
    }
    return;
  }

  // SCENARIO 1: oude tekst was leeg en nieuwe is gevuld, voeg render-instructie toe aan prompt
  if (!oldTrim && newTrim) {
    let renderInstruction = '';
    if (fieldKind === 'body') {
      renderInstruction = ` Below the headline, render body text reading: "${newValue}" in clean white sans-serif, smaller than the headline, properly spaced with sufficient contrast against the background, within safe zone.`;
    } else if (fieldKind === 'cta') {
      renderInstruction = ` Include a CTA pill at the bottom center with text reading: "${newValue}" in a dark pill with white text and a small gold arrow icon, within safe zone, properly aligned with the rest of the composition.`;
    }
    // Voor headline kan dit nooit gebeuren, headline is altijd gevuld
    if (renderInstruction) {
      const updated = currentPrompt.trimEnd() + renderInstruction;
      promptTextarea.value = updated;
      state.lastGenerated.variations[varIndex].image_prompt_en = updated;
      // Update empty-field klasse
      const input = document.getElementById(`var-${varIndex}-${fieldKind}`);
      if (input) { input.classList.remove('empty-field'); input.dataset.original = newValue; }
      if (syncStatus) {
        syncStatus.textContent = `render-instructie toegevoegd aan OpenAI prompt`;
        syncStatus.className = 'sync-status synced';
        setTimeout(() => {
          if (syncStatus.className === 'sync-status synced') {
            syncStatus.textContent = '';
            syncStatus.className = 'sync-status';
          }
        }, 3000);
      }
      return;
    }
  }

  // SCENARIO 2: oude tekst was gevuld en nieuwe is leeg, verwijder render-instructie uit prompt
  if (oldTrim && !newTrim) {
    let updated = currentPrompt;
    // Probeer hele zin met oude tekst te verwijderen
    const variants = [`"${oldTrim}"`, `'${oldTrim}'`, oldTrim];
    let removedSomething = false;
    for (const variant of variants) {
      if (updated.includes(variant)) {
        // Vind zin die deze variant bevat, verwijder hele zin
        const sentenceRegex = new RegExp(`[^.]*${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*\\.`, 'g');
        const newUpdated = updated.replace(sentenceRegex, '').replace(/\s+/g, ' ').trim();
        if (newUpdated !== updated) {
          updated = newUpdated;
          removedSomething = true;
          break;
        }
      }
    }
    promptTextarea.value = updated;
    state.lastGenerated.variations[varIndex].image_prompt_en = updated;
    const input = document.getElementById(`var-${varIndex}-${fieldKind}`) || document.getElementById(`var-${varIndex}-body`);
    if (input) { input.classList.add('empty-field'); input.dataset.original = ''; }
    if (syncStatus) {
      syncStatus.textContent = removedSomething ? `verwijderd, wordt niet meer in het beeld getoond` : `opgeslagen, wordt niet meer in het beeld getoond`;
      syncStatus.className = 'sync-status synced';
      setTimeout(() => {
        if (syncStatus.className === 'sync-status synced') {
          syncStatus.textContent = '';
          syncStatus.className = 'sync-status';
        }
      }, 3000);
    }
    return;
  }

  // SCENARIO 3: tekst is gewijzigd, vervang in de prompt (ook als de prompt hoofdletters gebruikt)
  function _applyReplace(txt){
    promptTextarea.value = txt;
    state.lastGenerated.variations[varIndex].image_prompt_en = txt;
    const inp = document.getElementById(`var-${varIndex}-${fieldKind}`);
    if (inp) inp.dataset.original = newValue; // volgende edit vergelijkt met de huidige prompt-tekst
    if (syncStatus) {
      syncStatus.textContent = `gesynchroniseerd met ChatGPT-prompt`;
      syncStatus.className = 'sync-status synced';
      setTimeout(() => { if (syncStatus.className === 'sync-status synced') { syncStatus.textContent = ''; syncStatus.className = 'sync-status'; } }, 2500);
    }
  }
  // vervang met behoud van het hoofdletter-patroon van de gevonden tekst (headlines staan vaak in UPPERCASE in de prompt)
  function _ciReplace(haystack, needle, replacement){
    if (!needle) return null;
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let hit = false;
    const out = haystack.replace(new RegExp(esc, 'gi'), function(match){
      hit = true;
      if (match === match.toUpperCase() && match !== match.toLowerCase()) return replacement.toUpperCase();
      if (match === match.toLowerCase() && match !== match.toUpperCase()) return replacement.toLowerCase();
      return replacement;
    });
    return hit ? out : null;
  }
  const stripPunct = str => (str || '').replace(/[.,!?;:]+$/, '').trim();
  const oldStripped = stripPunct(oldValue);
  let res = null;
  if (currentPrompt.includes(oldValue)) {
    res = currentPrompt.split(oldValue).join(newValue);
  } else if (oldStripped && currentPrompt.includes(oldStripped)) {
    res = currentPrompt.split(oldStripped).join(stripPunct(newValue));
  } else {
    res = _ciReplace(currentPrompt, oldValue, newValue);
    if (res === null && oldStripped) res = _ciReplace(currentPrompt, oldStripped, stripPunct(newValue));
  }
  if (res !== null) {
    _applyReplace(res);
  } else if (syncStatus) {
    syncStatus.textContent = `wijziging opgeslagen, wordt bij het genereren toegepast`;
    syncStatus.className = 'sync-status synced';
    setTimeout(() => { if (syncStatus.className === 'sync-status synced') { syncStatus.textContent = ''; syncStatus.className = 'sync-status'; } }, 3000);
  }
}

function copyFieldValue(varIndex, fieldKind, btn) {
  const fieldMap = {
    headline: `var-${varIndex}-headline`,
    body: `var-${varIndex}-body`,
    cta: `var-${varIndex}-cta`
  };
  const inputId = fieldMap[fieldKind];
  if (!inputId) return;
  const el = document.getElementById(inputId);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = checkIcon();
    toast('Gekopieerd naar clipboard');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = copyIcon();
    }, 1800);
  });
}

function copyPrompt(varIndex, btn) {
  const id = `var-${varIndex}-prompt`;
  const textarea = document.getElementById(id);
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = checkIcon();
    toast('Gekopieerd naar clipboard');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = copyIcon();
    }, 1800);
  });
}

function copyIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
}
function checkIcon() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
}

function attachCopyHandlers() {
  document.querySelectorAll('.copy-btn[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(txt).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = checkIcon();
        toast('Gekopieerd naar clipboard');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = copyIcon();
        }, 1800);
      });
    });
  });
}

