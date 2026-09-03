// ============================================================
// HELPERS
// ============================================================
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, '&#10;');
}
function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  const safe = String(msg).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  t.innerHTML = '<span class="toast-ico">' + (isError ? '!' : '✓') + '</span><span>' + safe + '</span>';
  t.style.borderColor = isError ? 'var(--red)' : 'var(--gold)';
  t.style.color = isError ? 'var(--red)' : 'var(--gold-bright)';
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(t._wgTimer); t._wgTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ============================================================
// EDIT LOADING OVERLAY + DONE NOTIFICATION (v3.74)
// ============================================================
function setEditBusy(varIndex, label) {
  const sec = document.getElementById(`gen-image-${varIndex}`);
  if (!sec) return;
  const frame = sec.querySelector('.gen-image-frame');
  if (!frame) return;
  let ov = frame.querySelector('.edit-busy-overlay');
  if (!ov) { ov = document.createElement('div'); ov.className = 'edit-busy-overlay'; frame.appendChild(ov); }
  ov.innerHTML = `<div class="edit-busy-bar"></div><div class="spinner"></div><div class="edit-busy-label">${escapeHtml(label || 'Bezig met aanpassen...')}</div>`;
}

function clearEditBusy(varIndex) {
  const sec = document.getElementById(`gen-image-${varIndex}`);
  if (!sec) return;
  const ov = sec.querySelector('.edit-busy-overlay');
  if (ov) ov.remove();
}

function scrollToVariation(varIndex) {
  const sec = document.getElementById(`gen-image-${varIndex}`) || document.getElementById(`var-card-${varIndex}`);
  if (!sec) return;
  sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const frame = sec.querySelector('.gen-image-frame');
  if (frame) {
    frame.classList.remove('gen-image-flash');
    void frame.offsetWidth;
    frame.classList.add('gen-image-flash');
    setTimeout(() => frame.classList.remove('gen-image-flash'), 1700);
  }
}

let _doneToastTimer = null;
function notifyEditDone(varIndex, title) {
  let el = document.getElementById('done-toast');
  if (!el) { el = document.createElement('div'); el.id = 'done-toast'; el.className = 'done-toast'; document.body.appendChild(el); }
  el.innerHTML = `<div class="done-check">&#10003;</div><div class="done-body"><span class="done-title">${escapeHtml(title || 'Klaar')}</span><span class="done-cta">Klik om naar het resultaat te gaan</span></div><span class="done-x" title="Sluiten">&times;</span>`;
  el.onclick = (e) => {
    if (e && e.target && e.target.classList.contains('done-x')) { el.classList.remove('show'); if (_doneToastTimer) clearTimeout(_doneToastTimer); e.stopPropagation(); return; }
    scrollToVariation(varIndex);
    el.classList.remove('show');
    if (_doneToastTimer) clearTimeout(_doneToastTimer);
  };
  el.classList.add('show');
  if (_doneToastTimer) clearTimeout(_doneToastTimer);
  _doneToastTimer = setTimeout(() => el.classList.remove('show'), 9000);
}

document.getElementById('product-modal').addEventListener('click', (e) => {
  if (e.target.id === 'product-modal') closeProductModal();
});

document.getElementById('persona-modal').addEventListener('click', (e) => {
  if (e.target.id === 'persona-modal') closePersonaModal();
});

// ============================================================
// COMBO WARNINGS
// ============================================================
const combinationRules = [
  // MODE + FUNNEL mismatches
  {
    when: { mode: 'brand-builder', funnel: ['bof', 'retargeting'] },
    title: 'Brand-Builder zonder CTA in conversie-fase',
    why: 'Brand-Builder heeft geen Trustpilot en geen CTA-pill. BOF en Re-targeting draaien juist om conversie, dus je laat momentum liggen.',
    suggest: 'Voor deze funnel-fase werkt Direct-Response of Bundle-Showcase sterker. Brand-Builder hoort thuis in TOF.'
  },
  {
    when: { mode: 'bundle-showcase', funnel: 'tof' },
    title: 'Bundle-Showcase in awareness-fase',
    why: 'Bundle-Showcase toont meerdere producten met savings-badge en prijs. Dat is te commercieel voor publiek dat Wellshave nog niet kent.',
    suggest: 'Verplaats Bundle-Showcase naar BOF of Re-targeting. Voor TOF werkt Brand-Builder of Lifestyle-Placement.'
  },
  {
    when: { mode: 'lifestyle-placement', funnel: ['bof', 'retargeting'] },
    title: 'Lifestyle-Placement in conversie-fase',
    why: 'Lifestyle-Placement heeft geen tekst, geen CTA, geen Trustpilot. Je publiek is klaar om te kopen maar krijgt geen koop-prikkel.',
    suggest: 'Direct-Response met sterke CTA past beter. Lifestyle hoort in TOF voor brand-building.'
  },

  // FUNNEL + ARCHETYPE mismatches
  {
    when: { archetype: 'offer', funnel: 'tof' },
    title: 'Offer-archetype zonder brand-context',
    why: 'Offer leunt op korting of bundel, maar een TOF-publiek kent Wellshave nog niet. Een aanbieding heeft pas waarde als het merk vertrouwd is.',
    suggest: 'Voor TOF werken Premium, Founder Story, UGC of Seasonal. Bewaar Offer voor BOF en Re-targeting.'
  },
  {
    when: { archetype: 'objection', funnel: 'tof' },
    title: 'Objection Reply zonder bekendheid',
    why: 'Objection Reply pareert een specifieke twijfel. Een TOF-publiek heeft die twijfel nog niet, want ze kennen het merk nog niet.',
    suggest: 'Verplaats naar MOF of Re-targeting waar twijfel realistisch is.'
  },
  {
    when: { archetype: 'comparison', funnel: 'tof' },
    title: 'Comparison zonder consideration-context',
    why: 'Comparison veronderstelt dat je publiek tussen alternatieven kiest. In TOF zijn ze nog niet actief op zoek.',
    suggest: 'Werkt sterker in MOF en BOF, waar de aankoop dichterbij is.'
  },
  {
    when: { archetype: 'beforeafter', funnel: 'tof' },
    title: 'Before/After in awareness-fase',
    why: 'Before/After verkoopt een specifieke uitkomst. TOF is voor brand-introductie, niet voor directe sell.',
    suggest: 'MOF of BOF werken beter, daar is de doelgroep ontvankelijk voor concrete benefits.'
  },
  {
    when: { archetype: 'founder', funnel: 'retargeting' },
    title: 'Founder Story bij cart abandoners',
    why: 'Re-targeting-publiek heeft al engagement getoond. Een founder-introductie voelt vertragend, ze willen een reden om af te ronden.',
    suggest: 'Authority, Offer of Objection Reply geven sterkere conversie-prikkels in deze fase.'
  },

  // MODE + ARCHETYPE contradicties
  {
    when: { mode: 'brand-builder', archetype: 'offer' },
    title: 'Brand-Builder + Offer botsen',
    why: 'Brand-Builder is minimaal zonder CTA, terwijl Offer juist de korting en pricing voorop zet. Twee tegenstrijdige formats.',
    suggest: 'Voor Offer: kies Direct-Response of Bundle-Showcase. Voor Brand-Builder: kies een softer archetype zoals Premium of Founder Story.'
  },
  {
    when: { mode: 'brand-builder', archetype: 'objection' },
    title: 'Brand-Builder + Objection Reply botsen',
    why: 'Objection Reply heeft een witte comment-card, gouden counter-bar en feature-pills nodig. Brand-Builder is minimaal en heeft geen ruimte voor die elementen.',
    suggest: 'Direct-Response of Feature-Education past bij Objection Reply.'
  },
  {
    when: { mode: 'lifestyle-placement', archetype: ['educational', 'comparison', 'objection', 'beforeafter'] },
    title: 'Lifestyle-Placement mist visuele structuur',
    why: 'Lifestyle-Placement is pure aesthetic zonder tekst. Dit archetype heeft visuele structuur nodig (checkmarks, split-view, comment-card) die in Lifestyle niet bestaat.',
    suggest: 'Direct-Response of Feature-Education geeft de visuele basis die je nodig hebt.'
  },
  {
    when: { mode: 'bundle-showcase', archetype: ['founder', 'ugc'] },
    title: 'Bundle-Showcase + persoonlijk archetype concurreren',
    why: 'Bundle-Showcase zet meerdere producten centraal. Founder of UGC draait om een persoon, die concurreert visueel met de bundel-shot.',
    suggest: 'Kies Direct-Response als je een persoon of testimonial wil tonen, met optie om de bundle in een aparte ad te verwerken.'
  },
  {
    when: { mode: 'feature-education', archetype: ['founder', 'ugc'] },
    title: 'Feature-Education + persoonlijk archetype botsen',
    why: 'Feature-Education is een product-diagram met annotated callouts. Een founder-portret of UGC-quote concurreert met die feature-anatomie.',
    suggest: 'Direct-Response werkt beter voor persoon-gedreven archetypes.'
  },

  // ANALOGIE specifieke combinaties
  {
    when: { archetype: 'analogie', funnel: ['bof', 'retargeting'] },
    title: 'Analogie in conversie-fase',
    why: 'Analogie is een vondst-driven concept-archetype dat memorabel is voor awareness, maar mist directe conversie-prikkel. BOF en Re-targeting publiek wil een reden om af te rekenen, niet een creatieve sprong.',
    suggest: 'Verplaats Analogie naar TOF of MOF waar het concept de kracht heeft. Voor BOF en Re-targeting werken Offer, Objection Reply of Comparison sterker.'
  },
  {
    when: { archetype: 'analogie', mode: ['feature-education', 'bundle-showcase'] },
    title: 'Analogie botst met feature- of bundle-formats',
    why: 'Analogie draait om één centrale vondst die alles bij elkaar houdt, met minimale tekst en een sterke achtergrond. Feature-Education vraagt om annotaties en callouts, Bundle-Showcase om meerdere producten en savings-badges. Beide ondermijnen de concept-kracht.',
    suggest: 'Voor Analogie: kies Brand-Builder (beste fit) of Lifestyle-Placement. Voor feature- of bundle-content: kies een archetype dat daarop is ontworpen.'
  },
  {
    when: { archetype: 'analogie', mode: 'direct-response' },
    title: 'Analogie met volledige Direct-Response stack',
    why: 'Direct-Response stapelt Trustpilot-pill, body-text en CTA-pill, dat is veel tekst voor een archetype dat juist op een minimale headline-vondst leeft. Het kan werken maar er ontstaat visuele spanning.',
    suggest: 'Brand-Builder geeft het concept de ruimte die het verdient. Als je echt conversie wilt, hou de body-text dan kort en de CTA klein zodat de analogie domineert.'
  },

  // TREND specifieke combinaties
  {
    when: { archetype: 'trend', funnel: ['bof', 'retargeting'] },
    title: 'Trend in conversie-fase',
    why: 'Trend leeft op cultureel herkennen en mee-stromen, vooral voor jong TOF-publiek. BOF en Re-targeting publiek wil een koop-prikkel, niet hype-content die de drempel verlaagt.',
    suggest: 'Verplaats Trend naar TOF of MOF waar de cultuur-herkenning werkt. Voor BOF werkt Offer of Objection Reply, voor Re-targeting werkt Offer met urgency.'
  },
  {
    when: { archetype: 'trend', mode: ['feature-education', 'bundle-showcase'] },
    title: 'Trend botst met feature- of bundle-formats',
    why: 'Trend-content is mono-thematisch en draait om visuele immersie in de trend-codes. Feature-callouts of bundle-shots breken die immersie en voelen als reclame-onderbreking.',
    suggest: 'Voor Trend: kies Brand-Builder (beste fit) of Lifestyle-Placement. Voor feature- of bundle-content: kies een archetype dat daarop is ontworpen.'
  }
];

function getCurrentSelection() {
  const funnelEl = document.querySelector('input[name=funnel]:checked');
  const modeEl = document.querySelector('input[name=mode]:checked');
  const archetypeEl = document.querySelector('input[name=archetype]:checked');
  return {
    funnel: funnelEl ? funnelEl.value : null,
    mode: modeEl ? modeEl.value : null,
    archetype: archetypeEl ? archetypeEl.value : null
  };
}

function ruleMatches(when, sel) {
  // Skip when archetype is 'mix' and rule involves archetype, since Claude decides
  if ('archetype' in when && sel.archetype === 'mix') return false;
  // Skip when mode is 'auto' and rule involves mode, since Claude decides
  if ('mode' in when && sel.mode === 'auto') return false;

  for (const key of Object.keys(when)) {
    const expected = when[key];
    const actual = sel[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

function checkWarnings() {
  const sel = getCurrentSelection();
  if (!sel.funnel || !sel.mode || !sel.archetype) return;
  if (isNewsFormat(sel.mode)) { renderWarnings([]); return; }
  const triggered = combinationRules.filter(rule => ruleMatches(rule.when, sel));
  renderWarnings(triggered);
}

function renderWarnings(warnings) {
  const container = document.getElementById('combo-warnings');
  if (!container) return;
  if (warnings.length === 0) {
    container.innerHTML = '';
    return;
  }
  const iconSvg = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  container.innerHTML = warnings.map(w => `
    <div class="warning-card">
      <div class="warning-icon">${iconSvg}</div>
      <div class="warning-content">
        <div class="warning-title">${escapeHtml(w.title)}</div>
        <div class="warning-why">${escapeHtml(w.why)}</div>
        <div class="warning-suggest">${escapeHtml(w.suggest)}</div>
      </div>
    </div>
  `).join('');
}

// Wire up listeners on all funnel, mode, and archetype radios
document.querySelectorAll('input[name=funnel], input[name=mode], input[name=archetype]').forEach(r => {
  r.addEventListener('change', checkWarnings);
});

// Concept-richting veld past zich aan op basis van archetype
const CONCEPT_FIELD_CONFIG = {
  analogie: {
    label: 'Analogie-vondst',
    hint: 'belangrijk voor dit archetype',
    contextText: '<strong>Hoe specifieker, hoe sterker</strong>Beschrijf welke wereld je gebruikt, wat de parallel is en hoe het concreet eruit ziet. Zonder dit vult Claude zelf een analogie in.',
    placeholder: "Bv: Max Verstappen staat P2 en Hamilton P1, geef Max de Wellshave Groom Card en stuur hem naar P1. Headline iets met Hollandse precisie op de baan en in de badkamer. Of: sushi-chef met perfect uitgelijnde messen, Wellshave-trimmer als één van de gereedschappen, headline over millimeter-precisie."
  },
  trend: {
    label: 'Trend-invulling',
    hint: 'belangrijk voor dit archetype',
    contextText: '<strong>Welke trend en hoe vertaald</strong>Benoem expliciet welke actuele trend je oppakt en hoe Wellshave erin past. Trends verschuiven snel dus vul ze altijd zelf in, Claude weet niet wat deze week viraal is.',
    placeholder: "Bv: Labubu-popje houdt een GroomGuard vast in kawaii-pastelroze setting, headline 'Scheer je boeboe kaa'. Of: Looksmaxing glow-up protocol, clinical light met sharp shadows, Wellshave als stap 3, headline 'Het protocol begint onder de douche'. Of: Quiet Luxury beige marble bathroom, geen logos, product achteloos op marmer."
  },
  default: {
    label: 'Concept-richting',
    hint: 'optioneel',
    contextText: null,
    placeholder: "Bijvoorbeeld: voor mannen met gevoelige huid, of Black Friday bundel met urgentie, of een founder-story met persvermelding"
  }
};

function updateConceptFieldContext() {
  const sel = document.querySelector('input[name=archetype]:checked');
  if (!sel) return;
  const archetype = sel.value;
  const config = CONCEPT_FIELD_CONFIG[archetype] || CONCEPT_FIELD_CONFIG.default;

  const field = document.getElementById('concept-field');
  const label = document.getElementById('concept-label');
  const hint = document.getElementById('concept-label-hint');
  const contextHint = document.getElementById('concept-context-hint');
  const textarea = document.getElementById('concept-input');

  label.textContent = config.label;
  hint.textContent = config.hint;
  textarea.placeholder = config.placeholder;

  if (config.contextText) {
    contextHint.innerHTML = config.contextText;
    contextHint.style.display = 'block';
    field.classList.add('is-highlighted');
  } else {
    contextHint.style.display = 'none';
    field.classList.remove('is-highlighted');
  }
}

document.querySelectorAll('input[name=archetype]').forEach(r => {
  r.addEventListener('change', updateConceptFieldContext);
});
updateConceptFieldContext();

// ============================================================
// CONCEPT SUGGESTER
// ============================================================
async function generateConceptSuggestions() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) {
    toast('Eerst Anthropic API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }

  const productId = document.getElementById('product-select').value;
  const product = state.products.find(p => p.id === productId);
  if (!product) {
    toast('Selecteer eerst een product', true);
    return;
  }

  const funnel = document.querySelector('input[name=funnel]:checked').value;
  const mode = document.querySelector('input[name=mode]:checked').value;
  const archetype = document.querySelector('input[name=archetype]:checked').value;
  const sophistication = document.getElementById('sophistication-select') ? document.getElementById('sophistication-select').value : '';
  const awareness = document.getElementById('awareness-select') ? document.getElementById('awareness-select').value : '';
  const placement = document.getElementById('placement-select').value;
  const bundleProducts = state.bundleProducts.map(id => state.products.find(p => p.id === id)).filter(Boolean);

  const funnelMap = {
    tof: 'Top of Funnel (awareness, doelgroep kent merk nog niet, geen aggressive CTA)',
    mof: 'Middle of Funnel (consideration, weegt af tegen alternatieven, "100 dagen op proef" werkt)',
    bof: 'Bottom of Funnel (decision, klaar om te kopen, "Shop nu" mag direct)',
    retargeting: 'Re-targeting (cart abandoned of recent bezoek, urgency mag, "Voor 23:59 besteld morgen in huis")'
  };
  const archetypeMap = {
    premium: 'Premium (aesthetic, dark/gold, product als luxe object)',
    educational: 'Educational (probleem-oplossing met checkmarks en features)',
    ugc: 'UGC (echte mensen, testimonial-stijl, casual settings)',
    authority: 'Authority (pers-validatie, expert endorsement, "als gezien in")',
    offer: 'Offer (korting, bundel, prijs-anker)',
    comparison: 'Comparison (head-to-head met alternatief, het merk wint helder)',
    beforeafter: 'Before/After (split-screen pijn vs oplossing)',
    founder: 'Founder Story (persoonlijk verhaal van de oprichter, authentic)',
    seasonal: 'Seasonal/Themed (rondom seizoen of feestdag)',
    objection: 'Objection Reply (comment-stijl, witte comment-card + verified badge + gouden counter)',
    analogie: 'Analogie (cross-domain vondst, onverwachte parallel uit sport/ambacht/techniek, achtergrond uit analogie-wereld, headline benoemt parallel expliciet, zoals F1-Verstappen "net zo serieus als z\'n velgen", sushi-chef-precisie, horlogemaker-vakmanschap)',
    trend: 'Trend (springt in op actueel cultureel moment dat al leeft bij doelgroep, visuele codes en taal van de trend overnemen, bv Labubu-popje met product, Looksmaxing glow-up, Quiet Luxury, Old Money, Brat-stijl)',
    mix: 'Mix (varieert tussen archetypes)'
  };
  const modeMap = {
    'auto': 'Auto (AI kiest mode per variatie)',
    'direct-response': 'Direct-Response (Trustpilot + CTA + trust-anker stack)',
    'brand-builder': 'Brand-Builder (alleen wordmark + product, geen text/CTA)',
    'feature-education': 'Feature-Education (annotated diagram met callouts)',
    'bundle-showcase': 'Bundle-Showcase (meerdere producten + savings + prijs)',
    'lifestyle-placement': 'Lifestyle-Placement (pure aesthetic, product in scene)',
    'advertorial-news': 'Nieuwsartikel (redactionele advertorial-stijl zonder merk-huisstijl, leidt naar listicle/artikel)'
  };
  const placementMap = {
    stories: 'Stories 9:16',
    reels: 'Reels 9:16',
    feed45: 'Feed 4:5',
    feed11: 'Feed 1:1 vierkant'
  };

  let userPrompt = `Genereer 3 verschillende concept-richtingen voor een advertentie van het merk op basis van deze input.\n\n`;
  userPrompt += `PRIMAIR PRODUCT: ${product.name} (${product.category})\n`;
  userPrompt += `USPs:\n${(product.usps || []).map(u => ` - ${u}`).join('\n')}\n`;
  if (product.target) userPrompt += `Doelgroep: ${product.target}\n`;
  if (product.price) userPrompt += `Prijs: ${product.price}\n`;
  userPrompt += `\nFUNNEL-FASE: ${funnelMap[funnel]}\n`;
  userPrompt += `ARCHETYPE: ${archetypeMap[archetype]}\n`;
  userPrompt += `FORMAT-MODE: ${modeMap[mode]}\n`;
  if (mode === 'advertorial-news') {
    const _nt = document.getElementById('news-article-topic');
    const _nd = document.getElementById('news-article-dest');
    const _topic = _nt ? _nt.value.trim() : '';
    if (_topic) userPrompt += `NIEUWSARTIKEL-ONDERWERP: ${_topic} (bestemming: ${(_nd && _nd.value) === 'advertorial' ? 'advertorial' : 'listicle'}; elke concept-richting draait om dit artikel-onderwerp, niet om het product)\n`;
  }
  userPrompt += `PLAATSING: ${placementMap[placement]}\n`;
  if (sophistication) userPrompt += `MARKET SOPHISTICATION-STADIUM: ${sophistication} (1=simpele claim, 3=uniek mechanisme, 5=identificatie en beleving)\n`;
  if (awareness) userPrompt += `CUSTOMER AWARENESS: ${awareness} (bepaalt waar de concept-richting opent)\n`;

  // Customer Persona indien geselecteerd
  const personaId = document.getElementById('persona-select') ? document.getElementById('persona-select').value : '';
  const persona = personaId
    ? (state.personas || []).find(p => p.id === personaId)
    : null;
  if (persona) {
    userPrompt += `\nCUSTOMER PERSONA: ${persona.name}\n`;
    if (persona.description) userPrompt += `Beschrijving: ${persona.description}\n`;
    if (persona.pains && persona.pains.length > 0) userPrompt += `Pijnpunten: ${persona.pains.join(' , ')}\n`;
    if (persona.desires && persona.desires.length > 0) userPrompt += `Wensen: ${persona.desires.join(' , ')}\n`;
    if (persona.objections && persona.objections.length > 0) userPrompt += `Bezwaren: ${persona.objections.join(' , ')}\n`;
    userPrompt += `BELANGRIJK: elke concept-richting moet deze specifieke persona aanspreken, geen generieke "voor alle mannen" insteek. Hook of insight pakt een pijnpunt, wens of bezwaar uit de lijst.\n`;
  }

  if (bundleProducts.length > 0) {
    userPrompt += `\nEXTRA BUNDLE PRODUCTEN: ${bundleProducts.map(bp => bp.name).join(', ')}\n`;
  }

  // Lees bestaande briefing uit het concept-veld en zet het centraal als startpunt
  const existingBriefing = (document.getElementById('concept-input').value || '').trim();
  if (existingBriefing) {
    userPrompt += `\nBESTAANDE BRIEFING VAN DE GEBRUIKER (zeer belangrijk, dit is wat ze willen): "${existingBriefing}"\n`;
    userPrompt += `BELANGRIJK: gebruik deze briefing als STARTPUNT en bouw 3 verschillende uitvoeringen op de briefing, niet 3 willekeurige andere richtingen. Varieer in compositie, headline-woordspel, lighting of secundaire elementen, maar respecteer de kern van wat de gebruiker heeft beschreven.\n`;
  }

  // Archetype-specifieke instructies waar de standaard regel niet volstaat
  if (archetype === 'analogie') {
    userPrompt += `\nVOOR ANALOGIE ARCHETYPE: elke richting MOET een specifieke cross-domain analogie-wereld benoemen (bv Formule 1, sushi-chef, horlogemaker, architectuur, Michelin-chef, bonsai-meester, klassieke barbier, audio-mastering, freeclimbing, tattoo-artist) en de parallel naar Wellshave-grooming concreet maken. Geef per richting (a) welke analogie-wereld, (b) welke parallel-eigenschap, (c) hoe de headline de brug expliciet legt. Geen generieke product-shots, geen losse esthetiek zonder vondst.\n`;
  } else if (archetype === 'trend') {
    userPrompt += `\nVOOR TREND ARCHETYPE: elke richting MOET een specifieke actuele culturele trend benoemen (bv Labubu/kawaii-collectibles, Looksmaxing, Quiet Luxury, Old Money, Brat-stijl, Mob Wife, Clean Boy, Coquette) en concreet beschrijven hoe Wellshave erin past. Geef per richting (a) welke trend, (b) welke visuele codes overgenomen worden, (c) welke headline-taal of woordspeling de trend triggert. Geen generieke product-shots, geen losse esthetiek zonder culturele aansluiting. Als de gebruiker al een specifieke trend in de briefing heeft genoemd, varieer dan in uitvoering van DIE trend in plaats van een nieuwe te kiezen.\n`;
  }

  userPrompt += `\nElke concept-richting moet:\n`;
  userPrompt += `- VOOR EEN STATIC IMAGE zijn, niet voor video. Beschrijf één bevroren moment, geen actie-sequentie, geen dialoog, geen "praat over", geen "loopt naar", geen "voor en na in twee shots". Een ad is één frame.\n`;
  userPrompt += `- Direct passen bij de funnel-fase, archetype en format-mode (niet generiek)\n`;
  userPrompt += `- Een duidelijke hook, insight of invalshoek bevatten\n`;
  userPrompt += `- 2-3 zinnen lang zijn, concreet maar niet uitgeschreven als headlines\n`;
  userPrompt += `- Onderling duidelijk verschillen in tone, hook of angle (geen variaties op hetzelfde)\n`;
  userPrompt += `- Bruikbaar zijn als briefing voor de visuele ad-generator\n`;
  userPrompt += `\nWAT NIET TE DOEN (alleen video-concepten, niet bruikbaar voor static):\n`;
  userPrompt += `- "Praat over X" of "vertelt over Y" (dialoog, dat is video)\n`;
  userPrompt += `- "Loopt naar de spiegel" of "stapt onder de douche" (beweging, dat is video)\n`;
  userPrompt += `- "Splitscreen voor en na" of "twee momenten in een frame" (kan wel als ECHTE splitscreen-compositie in static, maar nooit als "voor het ene, dan het andere")\n`;
  userPrompt += `- "Voice-over zegt..." of "tekst-overlay verschijnt..." (dat is motion graphics)\n`;
  userPrompt += `\nWAT WEL TE DOEN:\n`;
  userPrompt += `- Beschrijf de COMPOSITIE: wat zien we, waar staat het product, welke achtergrond, welke lighting\n`;
  userPrompt += `- Beschrijf de HEADLINE en eventuele body-text die in het frame staat\n`;
  userPrompt += `- Beschrijf de SFEER: stilte, focus, snelheid, intimiteit, etc, maar als visuele eigenschap van het frame\n`;
  userPrompt += `- Bij UGC-stijl: beschrijf een ENKELE iPhone-snapshot, een gefotografeerd moment dat een persoon HEEFT genomen, niet een video die hij maakt\n`;
  userPrompt += `\nOutput ALLEEN dit JSON-object, geen andere tekst of code-fences:\n`;
  userPrompt += `{\n  "concepts": [\n    "concept-richting 1 in 2-3 zinnen",\n    "concept-richting 2 in 2-3 zinnen",\n    "concept-richting 3 in 2-3 zinnen"\n  ]\n}`;

  const systemPrompt = 'Je bent een senior creatief copywriter en strateeg voor het merk (huisstijl en tone-of-voice zoals vastgelegd in het systeem). Je werkt UITSLUITEND aan STATIC IMAGE ads (een enkel bevroren frame, geen video, geen motion, geen dialoog, geen sequentie). Elke concept-richting moet beschrijven wat er in EEN STATISCHE AFBEELDING te zien is, niet wat er gebeurt of wordt verteld. Geen video-taal zoals "praat over", "loopt naar", "vertelt", "voice-over", maar pure compositie-beschrijvingen. Schrijf altijd in Nederlands. Houd het concreet, slim en distinctief, vermijd marketing-cliches zoals "ontdek de kracht" of "verover de dag".' + '\n\n' + CREATIVE_STRATEGIST_SKILL;

  const container = document.getElementById('concept-suggestions');
  container.innerHTML = `<div class="concept-loading"><div class="spinner-small"></div><span style="margin-left: 14px;">Rory broedt op concept-ideeen...</span></div>`;
  container.classList.add('show');

  try {
    const model = document.getElementById('anthropic-model').value;
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt + brandProfileBlock(),
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    let text = wgClaudeText(data).trim();
    // Robust JSON extraction: handle code-fences or extra prose
    const jsonMatch = text.match(/\{[\s\S]*"concepts"[\s\S]*?\]\s*\}/);
    if (jsonMatch) text = jsonMatch[0];
    else text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text);

    if (!parsed.concepts || !Array.isArray(parsed.concepts) || parsed.concepts.length === 0) {
      throw new Error('Onverwacht antwoord-formaat van AI');
    }

    renderConceptSuggestions(parsed.concepts);
  } catch (err) {
    container.innerHTML = `<div class="error" style="margin: 0;">Concept-generatie mislukt: ${escapeHtml(err.message)}. Probeer opnieuw of pas een veld aan.</div>`;
    console.error(err);
  }
}

function renderConceptSuggestions(concepts) {
  const container = document.getElementById('concept-suggestions');
  const cardsHtml = concepts.map((c, i) => `
    <div class="concept-card" data-idx="${i}" data-concept="${escapeAttr(c)}">
      <div class="concept-card-text">${escapeHtml(c)}</div>
      <div class="concept-card-hint">Klik om te gebruiken</div>
    </div>
  `).join('');
  container.innerHTML = `
    <div class="concept-cards-grid">${cardsHtml}</div>
    <div class="concept-suggester-actions">
      <button class="btn btn-small btn-ghost" onclick="generateConceptSuggestions()">Rory, geef 3 nieuwe ideeen</button>
    </div>
  `;
  container.querySelectorAll('.concept-card').forEach(card => {
    card.addEventListener('click', () => useConceptSuggestion(card.getAttribute('data-concept')));
  });
}

function useConceptSuggestion(conceptText) {
  if (!conceptText) return;
  const input = document.getElementById('concept-input');
  input.value = conceptText;
  document.getElementById('concept-suggestions').classList.remove('show');
  toast('Concept overgenomen in textarea');
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


/* ── Een foutmelding leesbaar maken ──────────────────────────────────────
   Dit is de vijfde keer dat hetzelfde patroon toeslaat: er komt een object
   binnen waar tekst verwacht werd, String() maakt er "[object Object]" van,
   en dat komt zo op het scherm. Geen foutmelding, geen waarschuwing -- alleen
   een zin die niets zegt op de plek waar hoorde te staan wat er mis is.

   Eerder was het het Score-veld in het dossier; nu de foutmelding van de
   worker, die bij een onbekende route {error: {message: "..."}} teruggeeft
   terwijl hij bij een geweigerde login {error: "unauthorized"} geeft. Twee
   vormen, en de ene sloopt het scherm.

   Deze functie geeft NOOIT "[object Object]" terug. Vindt hij geen bruikbare
   tekst, dan zegt hij dat er iets misging en welke status erbij hoorde -- dat
   is minder, maar het is waar en je kunt ermee verder. */
function wgFoutTekst(data, status) {
  var uit = wgFoutUitpakken(data);
  if (uit) return uit;
  if (status) return 'de server antwoordde met ' + status + ' zonder uitleg';
  return 'er ging iets mis, zonder verdere uitleg';
}

function wgFoutUitpakken(w, diepte) {
  var d = diepte || 0;
  if (w === null || w === undefined) return '';
  /* Drie lagen diep is ruim: {error:{error:{message}}} bestaat, dieper niet.
     Zonder grens is een kringverwijzing een vastloper. */
  if (d > 3) return '';
  if (typeof w === 'string') {
    var t = w.trim();
    return (t && t !== '[object Object]') ? t : '';
  }
  if (typeof w === 'number' || typeof w === 'boolean') return String(w);
  if (Array.isArray(w)) {
    var stukken = w.map(function (x) { return wgFoutUitpakken(x, d + 1); }).filter(Boolean);
    return stukken.join(' , ');
  }
  if (typeof w === 'object') {
    /* De volgorde is de volgorde waarin diensten hun melding zetten. message
       eerst: dat is bijna altijd de zin die voor een mens bedoeld is. */
    var sleutels = ['message', 'error', 'melding', 'detail', 'description', 'hint', 'reason', 'type'];
    for (var i = 0; i < sleutels.length; i++) {
      if (w[sleutels[i]] !== undefined) {
        var g = wgFoutUitpakken(w[sleutels[i]], d + 1);
        if (g) return g;
      }
    }
  }
  return '';
}

/* En de melding die hoort bij de fout die je nu het vaakst krijgt: de console
   is uitgerold en de worker nog niet. Dan bestaat de route wel in de browser
   en niet op de server, en antwoordt de worker met zijn algemene 404 -- een
   zin over /systeem en /anthropic waar de lezer niets aan heeft.

   Dit vertaalt dat naar wat er werkelijk moet gebeuren. */
function wgWorkerTeOud(status, tekst, wat) {
  if (status !== 404) return null;
  if (!/Gebruik \/systeem|onbekend .*endpoint/i.test(String(tekst || ''))) return null;
  return 'De worker kent ' + (wat || 'deze route') + ' nog niet. De console is bijgewerkt en de ' +
    'worker nog niet: rol hem uit met  npx wrangler deploy --config platform/worker/wrangler.toml  ' +
    'en controleer daarna op /health of er versie 20 of hoger staat.';
}

window.wgFoutTekst = wgFoutTekst;
window.wgFoutUitpakken = wgFoutUitpakken;
window.wgWorkerTeOud = wgWorkerTeOud;

/* ═══════════════════════════════════════════════════════════════════════════
   Het gezicht bij een naam

   Rory had een portret, Nick een letter in een cirkel. Dat leest als twee
   soorten deelnemers: een met een gezicht en een die het systeem zelf is --
   terwijl Nick precies dezelfde rol heeft, alleen aan de andere kant van de
   beslissing (Rory bepaalt wat er gemaakt wordt, Nick of het geld gaat
   opnemen).

   Eén functie voor allebei, zodat er nooit meer een plek is waar de een wel
   en de ander geen gezicht heeft. De letter blijft eronder liggen: mist het
   bestand, dan haalt onerror de foto weg en staat de letter er weer. Zo is een
   ontbrekend portret een gaatje in de vormgeving en geen kapot scherm. */
var TEAM_PORTRET = {
  rory: { bestand: 'img/rory.jpg', letter: 'R', naam: 'Rory' },
  nick: { bestand: 'img/nick.jpg', letter: 'N', naam: 'Nick Theriot' }
};

function teamPortret(wie, klasse) {
  var p = TEAM_PORTRET[String(wie || '').toLowerCase()];
  /* Geen bekende naam betekent geen portret. Een verzonnen letter zou een
     deelnemer suggereren die niet bestaat. */
  if (!p) return '';
  return '<span class="' + (klasse || 'team-portret') + '" aria-hidden="true">' +
    '<img src="' + p.bestand + '" alt="" onerror="this.remove()"><i>' + p.letter + '</i></span>';
}

window.TEAM_PORTRET = TEAM_PORTRET;
window.teamPortret = teamPortret;
