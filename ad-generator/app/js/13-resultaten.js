// ============================================================
// RENDER RESULTS
// ============================================================
// Voorkomt dat twee resultaten-contexten (de gedeelde #results van Generator/Kopieer/Itereren
// en de aparte #transformer-results) tegelijk live zijn. Ze delen state.generatedImages,
// dus dubbele kaarten met dezelfde index zouden elkaars download/versie pakken. Bij elke
// nieuwe generatie legen we daarom de andere container.
function clearInactiveResults(active) {
  const otherId = active === 'transformer' ? 'results' : 'transformer-results';
  const el = document.getElementById(otherId);
  if (el) el.innerHTML = '';
}

function showLoading() {
  clearInactiveResults('results');
  document.getElementById('results').innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div class="loading-text">Variaties worden gegenereerd</div>
      <div class="loading-sub">Claude bouwt nu de concepten, headlines en image prompts...</div>
    </div>
  `;
}
function renderError(msg) {
  document.getElementById('results').innerHTML = `<div class="error"><strong>Fout:</strong> ${escapeHtml(msg)}</div>`;
}

function renderResults(variations, metadata) {
  const placementLabels = {
    stories: 'Stories 9:16', reels: 'Reels 9:16',
    feed45: 'Feed 4:5', feed11: 'Feed 1:1'
  };
  const funnelLabels = {
    tof: 'Top of Funnel', mof: 'Middle of Funnel', bof: 'Bottom of Funnel', retargeting: 'Re-targeting',
    cold: 'Cold (oud)', warm: 'Warm (oud)'
  };
  const d = new Date(metadata.timestamp);
  const timeStr = d.toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
  const product = state.products.find(p => p.id === metadata.productId);
  const hasRefs = product && refBreakdown(product.references).total > 0;

  let html = `
    <div class="results-header">
      <div>
        <h2 class="results-title">${variations.length} variatie${variations.length > 1 ? 's' : ''} gegenereerd</h2>
        <div style="font-size: 12px; color: var(--text-faint); margin-top: 4px;">
          ${escapeHtml(metadata.product)} , ${funnelLabels[metadata.funnel] || metadata.funnel} , ${metadata.archetype} , ${placementLabels[metadata.placement]}
        </div>
      </div>
      <div class="results-meta">${timeStr}</div>
    </div>
  `;

  if (!hasRefs) {
    html += `<div class="warning-banner">Geen productreferenties voor "${escapeHtml(metadata.product)}". Image generation werkt wel, maar resultaat is minder voorspelbaar (kans op gold/chrome trimmer). Voeg foto's toe via "Beheer" voor beter resultaat.</div>`;
  }

  // Bron-ad analyse-card alleen in copy-mode
  if (metadata.sourceMode === 'copy' && metadata.sourceAdAnalysis && state.sourceAd) {
    const dataUrl = `data:${state.sourceAd.mimeType};base64,${state.sourceAd.b64}`;
    html += `
      <div class="source-ad-analysis-card">
        <div class="source-ad-analysis-img"><img src="${dataUrl}" alt="bron-ad"></div>
        <div class="source-ad-analysis-body">
          <div class="source-ad-analysis-label">Mechaniek uit bron-ad gedistilleerd</div>
          <div class="source-ad-analysis-text">${escapeHtml(metadata.sourceAdAnalysis)}</div>
          <div class="source-ad-analysis-meta">Gedetecteerd: <strong>${escapeHtml(metadata.archetype)}</strong> archetype, <strong>${escapeHtml(metadata.funnel)}</strong> funnel-fase</div>
        </div>
      </div>
    `;
  }

  variations.forEach((v, i) => {
    html += renderVariationCard(v, i, metadata);
  });

  document.getElementById('results').innerHTML = html;
  attachCopyHandlers();
  // Render base-photo zones (empty by default, gets populated when user uploads)
  variations.forEach((v, i) => {
    renderBasePhotoZone(i);
  });
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

