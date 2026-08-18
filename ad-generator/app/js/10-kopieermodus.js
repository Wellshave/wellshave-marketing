// ============================================================
// GENERATE FROM COPY MODE
// ============================================================
async function generateFromCopyMode() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) {
    toast('Eerst je Anthropic API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }
  if (!state.sourceAd) {
    toast('Upload eerst een bron-ad om te kopieren', true);
    return;
  }
  const productId = document.getElementById('product-select').value;
  const product = state.products.find(p => p.id === productId);
  if (!product) { toast('Kies een product', true); return; }

  const placement = document.getElementById('placement-select').value;
  const concept = document.getElementById('concept-input').value.trim();
  const num = parseInt(document.getElementById('num-input').value);
  const offer = document.getElementById('offer-input').value.trim();
  const mode = 'auto'; // copy-modus: format mode wordt altijd uit de bron-ad afgeleid
  const model = document.getElementById('anthropic-model').value;
  const bundleProducts = state.bundleProducts.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  // copy-modus: archetype en funnel worden altijd uit de bron-ad gedetecteerd, geen handmatige override
  const archetypeOverride = null;
  const funnelOverride = null;
  // kopieer-instellingen
  const fidelityEl = document.querySelector('input[name="copy-fidelity"]:checked');
  const fidelity = fidelityEl ? fidelityEl.value : 'mechaniek';
  const keep = Array.from(document.querySelectorAll('input[name="copy-keep"]:checked')).map(e => e.value);
  const personaId = document.getElementById('persona-select') ? document.getElementById('persona-select').value : '';
  const persona = personaId
    ? (state.personas || []).find(p => p.id === personaId)
    : null;

  const userPrompt = buildCopyModeUserPrompt({ product, placement, concept, num, offer, mode, bundleProducts, persona, archetypeOverride, funnelOverride, fidelity, keep });

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Bron-ad analyseren en variaties genereren...';

  clearInactiveResults('results');
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '<div class="loading-card">Claude bekijkt de bron-ad en distilleert de mechaniek...</div>';

  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT + '\n\n' + COPY_MODE_SYSTEM_ADDITIONS + brandProfileBlock(),
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: state.sourceAd.mimeType,
                data: state.sourceAd.b64
              }
            },
            { type: 'text', text: userPrompt }
          ]
        }]
      })
    });

    const text = wgClaudeText(data);
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Geen geldig JSON gevonden in Claude-respons');
    const parsed = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    if (!parsed.variations || !Array.isArray(parsed.variations) || parsed.variations.length === 0) {
      throw new Error('Geen variaties in Claude-respons');
    }

    state.lastGenerated = {
      variations: parsed.variations,
      metadata: {
        product: product.name,
        productId: product.id,
        funnel: funnelOverride || parsed.detected_funnel || 'auto-detected',
        archetype: archetypeOverride || parsed.detected_archetype || 'kopie',
        placement,
        mode,
        concept: concept || '(uit bron-ad)',
        offer,
        bundleProductIds: state.bundleProducts.slice(),
        personaId: persona ? persona.id : null,
        personaName: persona ? persona.name : null,
        sourceMode: 'copy',
        sourceAdAnalysis: parsed.source_ad_analysis || ''
      }
    };
    state.generatedImages = {};

    renderResults(state.lastGenerated.variations, state.lastGenerated.metadata);
    btn.disabled = false;
    btn.textContent = 'Analyseer bron en genereer de variant';
  } catch (err) {
    console.error(err);
    toast('Generatie mislukt: ' + err.message, true);
    resultsEl.innerHTML = `<div class="loading-card" style="color:#bd0f0f;">Fout: ${escapeHtml(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Analyseer bron en genereer de variant';
  }
}

// ============================================================
// COPY MODE SYSTEM PROMPT ADDITIONS
// ============================================================
const COPY_MODE_SYSTEM_ADDITIONS = `
# COPY-FROM-AD MODE (BIJZONDERE INSTRUCTIES)

De gebruiker heeft een **bron-ad** geupload (concurrent, inspiratie of een ad die hard converteert). Je taak is in twee stappen:

## STAP 1: ANALYSEER DE BRON-AD
Bekijk de afbeelding kritisch en extraheer:
- **Archetype**: welk van de 9 Wellshave-archetypes past het beste bij deze ad (Premium, Educational, UGC, Authority, Offer, Comparison, Before/After, Founder Story, Seasonal, Objection Reply, Analogie, Trend)
- **Funnel-fase**: TOF, MOF, BOF of Re-targeting (wat is de intentie van de ad)
- **Hook-mechaniek**: wat is de specifieke trigger die deze ad zo sterk maakt (een visuele contradictie? een vraag in de headline? een ongebruikelijke compositie? een trust-signaal? een prijs-anker? etc)
- **Compositie**: hoe is de visual opgebouwd (split-screen? hero-shot? product in scene? annotaties? in-hand shot? close-up?)
- **Headline-patroon**: welke taal-structuur gebruikt de headline (vraag, statement, getal, contradictie, command, etc)
- **Body-stijl**: hoe is de body-text opgebouwd (bullets, korte zin, getuigenis, social proof, etc)
- **CTA-aanpak**: directe verkoop, soft, weggelaten, urgentie, etc

## STAP 2: BOUW WELLSHAVE-VARIANTEN OP DEZELFDE MECHANIEK

Apply de geextraheerde mechaniek op Wellshave met:
- Het Wellshave product dat de gebruiker heeft geselecteerd
- De Wellshave brand-voice (dark/gold premium, Nederlands, ondergeschikt aan Manscaped/Philips/Braun)
- De geselecteerde persona's pijnpunten, wensen en bezwaren
- Wellshave-trust-signalen (Trustpilot 4,5/5 op basis van het opgegeven aantal reviews) ipv die van de bron
- Nederlandse copy (de bron mag Engels zijn, jouw output is Nederlands)
- Alle bestaande Wellshave-regels uit het hoofdsysteem (product-uiterlijk volgt referentie-foto's, no gold ring, etc)

## KRITIEKE GUARDRAILS

**WAT JE NOOIT DOET:**
- NOOIT logo's, merknamen of trademarks van de bron-ad noemen of laten zien
- NOOIT specifieke gezichten of personen uit de bron-ad reproduceren in de image_prompt_en
- NOOIT dezelfde headline-tekst letterlijk overnemen, herformuleer altijd in Wellshave-voice
- NOOIT de image_prompt_en laten verwijzen naar "the source ad" of "the reference ad", schrijf hem als fresh prompt
- De **mechaniek** kopieren wij, niet de **content**

**WAT JE WEL DOET:**
- Het structuur-patroon overnemen (bv "twee kolommen met pijn vs verlossing")
- De hook-mechaniek overnemen (bv "ongemak benoemen voordat je het product toont")
- De compositie-strategie overnemen (bv "product 70% van het frame, dark moody lighting")
- De headline-vorm overnemen (bv "vraag-formaat dat de pijnpunt aanspreekt"), maar met andere woorden

## OUTPUT FORMAT

Output STRICT JSON met deze structuur, met twee extra top-level velden voor transparantie:

\`\`\`json
{
  "source_ad_analysis": "1-2 zinnen, wat zag je in de bron-ad qua mechaniek (archetype, hook, compositie)",
  "detected_archetype": "premium|educational|ugc|authority|offer|comparison|before_after|founder_story|seasonal|objection_reply|analogie|trend",
  "detected_funnel": "tof|mof|bof|retargeting",
  "variations": [
    {
      "hook_type": "Vondst|Vraag|Getal-claim|Contraire stelling|Persstory|Voor-na|UGC quote",
      "hook_label_nl": "Korte NL beschrijving van de hook, 3-5 woorden",
      "headline_nl": "Headline in NL, max 8 woorden, GEEN em-dashes. ALTIJD verplicht in beeld",
      "body_copy_nl": "Primary text NL, benefit-driven, 1 tot 3 zinnen, GEEN em-dashes. Mag LEEG STRING zijn voor minimal-stack modes. Als gevuld: MOET in image_prompt_en als render-instructie verschijnen",
      "cta_nl": "CTA NL, funnel-passend, werkwoord-gedreven, max 4 woorden. Mag LEEG STRING zijn voor minimal-stack modes. Als gevuld: MOET in image_prompt_en als render-instructie verschijnen",
      "image_prompt_en": "Volledige ChatGPT image prompt in Engels, beschrijf de Wellshave-variant fresh, GEEN verwijzing naar de bron-ad",
      "visual_nl": "1-2 zinnen Nederlands: wat is er op de visual te zien en wat gebeurt er",
      "reasoning": "Waarom deze Wellshave-variant dezelfde mechaniek volgt als de bron. Welk element uit de bron heb je overgenomen en hoe heb je het Wellshave-eigen gemaakt.",
      "hypothese_nl": "1-2 zinnen hypothese: waarom deze variant het origineel of de bron-ad zou moeten verslaan. Benoem het sterke punt, een concreet aandachtspunt, en het onderbouwde idee. Concreet, geen cliche."
    }
  ]
}
\`\`\`

In de \`reasoning\` per variatie: leg expliciet uit welk element uit de bron je hebt overgenomen en hoe je het Wellshave-eigen hebt gemaakt.
`;

// ============================================================
// BUILD COPY-MODE USER PROMPT
// ============================================================
function buildCopyModeUserPrompt({ product, placement, concept, num, offer, mode, bundleProducts, persona, archetypeOverride, funnelOverride, fidelity, keep }) {
  let prompt = `# COPY-FROM-AD VERZOEK\n\n`;
  prompt += `De geuploade afbeelding is een **bron-ad** (concurrent of inspiratie). Analyseer hem en bouw ${num} Wellshave-variant${num > 1 ? 'en' : ''} die dezelfde mechaniek gebruiken maar met onderstaande Wellshave-context.\n\n`;

  prompt += `## ${BRAND_NAME_UC}-CONTEXT\n\n`;
  prompt += `**Product**: ${product.name}\n`;
  if (product.category) prompt += `**Categorie**: ${product.category}\n`;
  if (product.usps && product.usps.length > 0) {
    prompt += `**USPs**:\n`;
    product.usps.forEach((usp, i) => { prompt += `${i + 1}. ${usp}\n`; });
  }
  if (product.price) prompt += `**Prijspunt**: ${product.price}\n`;
  if (product.target) prompt += `**Doelgroep**: ${product.target}\n`;
  if (product.appearance) prompt += `**Uiterlijk-tekst (fallback als geen refs)**: ${product.appearance}\n`;
  if (product.forbidden) prompt += `**Verboden claims**: ${product.forbidden}\n`;

  const hasProductRefs = product.references && product.references.product && product.references.product.length > 0;
  if (hasProductRefs) {
    prompt += `**Referentie-foto's**: ${product.references.product.length} productfoto's beschikbaar, deze gaan naar OpenAI als de gebruiker beelden genereert. Vermeld in image_prompt_en expliciet dat product-appearance EXACT de reference-photos moet volgen.\n`;
  }

  if (persona) {
    prompt += `\n**Geselecteerde Customer Persona**: ${persona.name}\n`;
    if (persona.description) prompt += `Beschrijving: ${persona.description}\n`;
    if (persona.pains && persona.pains.length > 0) prompt += `Pijnpunten: ${persona.pains.join(' | ')}\n`;
    if (persona.desires && persona.desires.length > 0) prompt += `Wensen: ${persona.desires.join(' | ')}\n`;
    if (persona.objections && persona.objections.length > 0) prompt += `Bezwaren: ${persona.objections.join(' | ')}\n`;
  }

  prompt += `\n**Plaatsing**: ${placement === 'stories' ? 'Stories 9:16' : placement === 'reels' ? 'Reels 9:16' : placement === 'feed45' ? 'Feed 4:5' : 'Feed 1:1'}\n`;
  prompt += `**Format-mode voorkeur**: ${mode === 'auto' ? 'AUTO, gebruik wat past bij wat je in de bron-ad ziet' : mode}\n`;
  prompt += `**Aantal variaties**: ${num}\n`;

  if (offer && offer.trim()) {
    prompt += `**Offer-detail (alleen als bron Offer-archetype is)**: ${offer}\n`;
  }

  if (bundleProducts && bundleProducts.length > 0) {
    prompt += `**Bundle-context** (alleen relevant als bron Bundle-Showcase is):\n`;
    bundleProducts.forEach(p => { prompt += `- ${p.name}\n`; });
  }

  // OVERRIDE-INSTRUCTIES (alleen als user expliciet gekozen heeft)
  if (archetypeOverride || funnelOverride) {
    prompt += `\n## USER OVERRIDES (HARDE INSTRUCTIE, deze winnen van auto-detectie)\n\n`;
    if (archetypeOverride) {
      prompt += `**Override-archetype**: ${archetypeOverride}\n`;
      prompt += `De gebruiker wil de bron-ad mechaniek vertalen naar een ${archetypeOverride}-archetype Wellshave-ad. Pak de visuele mechaniek/structuur van de bron, maar herinterpreteer hem volledig in ${archetypeOverride}-stijl. Bv: een Offer-archetype bron-ad kan worden vertaald naar een Persstory-archetype Wellshave-ad door dezelfde compositie te gebruiken maar de Offer-elementen te vervangen door media-validatie. Negeer detected_archetype, gebruik ${archetypeOverride}.\n`;
    }
    if (funnelOverride) {
      const funnelLabel = funnelOverride === 'tof' ? 'Top of Funnel' : funnelOverride === 'mof' ? 'Middle of Funnel' : funnelOverride === 'bof' ? 'Bottom of Funnel' : 'Re-targeting';
      prompt += `**Override-funnel**: ${funnelLabel}\n`;
      prompt += `De ad is voor de ${funnelLabel}-fase. Pas de element-intensiteit aan volgens de funnel-regels: TOF = brand-bouwen met max 1 DR-element, MOF = 2-3 DR-elementen, BOF = volle DR-stack, Re-targeting = aggressieve closing. Negeer detected_funnel, gebruik ${funnelLabel}.\n`;
    }
  }

  if (concept && concept.trim()) {
    prompt += `\n## EXTRA WENSEN VAN DE GEBRUIKER\n\n${concept}\n`;
    prompt += `\nVerwerk deze wensen IN de mechaniek-overdracht. De gebruiker wil de structuur van de bron-ad behouden maar deze accenten toevoegen.\n`;
  }

  const fidelityMap = {
    letterlijk: 'LETTERLIJKE KOPIE. Neem de structuur, compositie, layout en het hook-mechaniek van de bron-ad zo getrouw mogelijk over. Vervang alleen het merk, het product en de claims door Wellshave. Houd dezelfde plaatsing van elementen, dezelfde headline-structuur en dezelfde visuele opbouw aan.',
    mechaniek: 'MECHANIEK LENEN. Neem de onderliggende hook, het psychologische mechaniek en de globale opbouw van de bron-ad over, maar werk hem volledig opnieuw uit in Wellshave-stijl. De variant hoeft niet visueel identiek te zijn aan de bron, wel even sterk in dezelfde richting.',
    idee: 'ALLEEN HET IDEE. Gebruik alleen het kernconcept of de invalshoek van de bron-ad als inspiratie en maak een frisse Wellshave-ad. Je bent vrij in compositie, headline en opbouw zolang het kernidee herkenbaar terugkomt.'
  };
  prompt += `\n## KOPIEER-AANPAK\n\n`;
  prompt += `**Getrouwheid**: ${fidelityMap[fidelity] || fidelityMap.mechaniek}\n`;
  if (keep && keep.length > 0) {
    const keepMap = { hook:'de hook en het headline-patroon', compositie:'de compositie en layout', body:'de body-structuur en opbouw', cta:'de CTA-aanpak', sfeer:'het kleurgebruik en de sfeer', social:'het social-proof en trust-mechaniek', emotie:'de emotie en tone of voice' };
    const labels = keep.map(k => keepMap[k] || k);
    prompt += `**Moet vooral doorkomen uit de bron**: ${labels.join(', ')}. Behoud deze aspecten herkenbaar in de Wellshave-variant.\n`;
  } else {
    prompt += `**Moet vooral doorkomen uit de bron**: niets specifieks aangevinkt, bepaal zelf wat de ad sterk maakt en behoud dat.\n`;
  }
  prompt += `**Vertaal naar Wellshave**: het product komt EXACT uit de meegestuurde referentiefotos, alle tekst in correct Nederlands, de mat-zwart-met-goud huisstijl blijft, en de Clarity Test geldt (een koude scroller moet de kern in 1,5 seconde snappen zonder puzzel).\n`;
  prompt += `**Nooit overnemen**: concurrent-merknamen of logos uit de bron, claims die niet voor Wellshave kloppen, en herkenbare gezichten of personen uit de bron-ad.\n`;

  prompt += `\n## OUTPUT\n\n`;
  prompt += `Geef ${num} variatie${num > 1 ? 's' : ''} die dezelfde mechaniek volgen. Output STRICT JSON volgens het format in het system-prompt (met source_ad_analysis, detected_archetype, detected_funnel en variations array).\n`;
  prompt += `\nGeen markdown, geen code-fences, alleen het JSON-object.`;

  return prompt;
}

async function generate() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) {
    toast('Eerst je Anthropic API key invullen', true);
    document.getElementById('settings-panel').classList.add('open');
    return;
  }
  const productId = document.getElementById('product-select').value;
  const product = state.products.find(p => p.id === productId);
  if (!product) { toast('Kies een product', true); return; }

  const funnel = document.querySelector('input[name=funnel]:checked').value;
  const archetype = document.querySelector('input[name=archetype]:checked').value;
  const placement = document.getElementById('placement-select').value;
  const concept = document.getElementById('concept-input').value.trim();
  const num = parseInt(document.getElementById('num-input').value);
  const offer = document.getElementById('offer-input').value.trim();
  const mode = document.querySelector('input[name=mode]:checked').value;
  const sophistication = document.getElementById('sophistication-select') ? document.getElementById('sophistication-select').value : '';
  const awareness = document.getElementById('awareness-select') ? document.getElementById('awareness-select').value : '';
  const model = document.getElementById('anthropic-model').value;
  const bundleProducts = state.bundleProducts.map(id => state.products.find(p => p.id === id)).filter(Boolean);
  const personaId = document.getElementById('persona-select') ? document.getElementById('persona-select').value : '';
  const persona = personaId
    ? (state.personas || []).find(p => p.id === personaId)
    : null;

  // Test-kader: waarschuw als de testdata ontbreekt terwijl we juist persona-gericht willen testen
  const personasForCat = (state.personas || []).filter(pp => product && pp.category === product.category);
  const missingTest = [];
  if (personasForCat.length > 0 && !personaId) missingTest.push('een customer persona');
  if (!sophistication) missingTest.push('market sophistication');
  if (!awareness) missingTest.push('customer awareness');
  if (missingTest.length > 0) {
    const okGen = confirm('Je staat op het punt te genereren zonder ' + missingTest.join(', ') + '.\n\nVoor het gericht testen van de customer personas wil je deze juist invullen, zodat de advertentie strikt op die data wordt gebouwd in plaats van generiek.\n\nKlik OK om toch generiek door te gaan, of Annuleer om eerst in te vullen.');
    if (!okGen) return;
  }

  const userPrompt = buildUserPrompt({ product, funnel, archetype, placement, concept, num, offer, mode, bundleProducts, persona, sophistication, awareness });

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.textContent = 'Bezig met genereren...';
  showLoading();

  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT + brandProfileBlock(),
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const text = data.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```\s*$/, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Output was geen valide JSON: ' + cleaned.substring(0, 200));
    }
    const metadata = {
      product: product.name,
      productId: product.id,
      funnel,
      archetype,
      placement,
      concept,
      offer,
      mode,
      sophistication: sophistication || null,
      awareness: awareness || null,
      timestamp: Date.now(),
      bundleProductIds: state.bundleProducts.slice(),
      personaId: persona ? persona.id : null,
      personaName: persona ? persona.name : null
    };
    state.lastGenerated = { variations: parsed.variations, metadata };
    state.lastGenerated._pxAngle = window._pxAngleContext || null; window._pxAngleContext = null;
    state.generatedImages = {};
    renderResults(parsed.variations, metadata);
  } catch (err) {
    renderError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Genereer variaties';
  }
}

function buildUserPrompt({ product, funnel, archetype, placement, concept, num, offer, mode, bundleProducts, persona, sophistication, awareness }) {
  const placementMap = {
    stories: 'Stories 9:16 (top 14% en bottom 20% safe zone, sides 6%)',
    reels: 'Reels 9:16 (top 14% en bottom 35% safe zone, sides 6%)',
    feed45: 'Feed 4:5 (top en bottom 250px, sides 100px)',
    feed11: 'Feed 1:1 (100px aan alle kanten)'
  };
  const funnelMap = {
    tof: 'Top of Funnel (TOF, awareness-fase, doelgroep kent het merk nog niet, geen directe verkoop-CTA, focus op intrige en brand-introductie)',
    mof: 'Middle of Funnel (MOF, consideration-fase, doelgroep weegt af, CTA curiosity- of trial-based, "100 dagen op proef" goed)',
    bof: 'Bottom of Funnel (BOF, decision-fase, doelgroep klaar om te kopen, CTA mag direct "Shop nu" of "Bestel nu", prijsanker of bundel werkt)',
    retargeting: 'Re-targeting (bezocht site of cart abandoned, urgency mag, "Bestel nu" + "Voor 23.59 besteld, morgen in huis")'
  };
  const archetypeMap = {
    premium: 'Premium (aesthetic-driven, product als luxe object, in de huisstijl van het merk)',
    educational: 'Educational (probleem-oplossing met checkmarks, features, social proof)',
    ugc: 'UGC (echte mensen, real settings, testimonial-stijl)',
    authority: 'Authority (pers-validatie, founder story, expert endorsement)',
    offer: 'Offer (korting/aanbieding/bundel centraal)',
    comparison: 'Comparison (head-to-head met concurrent of alternatief, 3-5 vergelijkingspunten max, het merk wint helder, NOOIT concurrent-logos of merknamen letterlijk gebruiken)',
    beforeafter: 'Before/After (split-screen pijn links vs oplossing rechts, de probleemstaat tegenover het eindresultaat, product zichtbaar op rechter-helft, geen extreme/disturbing imagery)',
    founder: 'Founder Story (persoonlijk verhaal van de oprichter, authentic en intiem, eerste persoon, founder gezicht zichtbaar, NIET corporate of polished)',
    seasonal: 'Seasonal/Themed (gebouwd rondom seizoen, feestdag of cultureel moment, theme-specifieke visuals en theme-relevante headline, vaak gekoppeld met offer)',
    objection: 'Objection Reply (comment-stijl: WITTE comment-card met ZWARTE tekst en BLAUW verified-badge naast naam, daaronder gouden counter-claim bar (NOOIT oranje), UGC iPhone of strakke product-hero shot, 2-3 donkere feature-pills met gouden icons en witte tekst. Blijf in de huisstijl van het merk, neem geen concurrent-kleuren over. Less is more bij 9:16. Als geen objection in concept-richting genoemd, verzin er een relevant voor product en doelgroep)',
    mix: 'Mix, kies zelf het sterkste archetype per variatie en varieer'
  };
  const modeMap = {
    'auto': 'Auto, kies zelf de beste format-mode per variatie op basis van archetype + funnel + concept (zie AD-FORMAT MODES sectie). Mag varieren tussen variaties.',
    'direct-response': 'Direct-Response (FORCE: alle variaties gebruiken volledige Trustpilot dark-pill + CTA dark-pill + gouden trust-anker)',
    'brand-builder': 'Brand-Builder (FORCE: alle variaties zonder Trustpilot, zonder CTA-pill, zonder trust-anker, zonder feature-pills. Alleen WELLSHAVE wordmark + product hero + optionele korte tagline)',
    'feature-education': 'Feature-Education (FORCE: alle variaties met annotated product diagram, 4-6 feature-callouts in goud, productnaam als headline, GEEN CTA-pill. Trustpilot klein onderaan mag)',
    'bundle-showcase': 'Bundle-Showcase (FORCE: alle variaties met meerdere producten naast elkaar, bundle-naam als headline, savings-badge en prijs met crossed-out original, GEEN CTA-pill. Trustpilot klein onderaan mag)',
    'lifestyle-placement': 'Lifestyle-Placement (FORCE: alle variaties als pure product placement in beautiful setting, GEEN Trustpilot, GEEN CTA, GEEN feature-pills, minimaal of geen overlay-tekst. Alleen kleine WELLSHAVE wordmark)',
    'advertorial-news': 'Nieuwsartikel (FORCE: alle variaties ogen als een redactioneel nieuwsbericht of magazine-artikel, BEWUST ZONDER merk-huisstijl: GEEN wordmark, GEEN Trustpilot, GEEN CTA-pill, GEEN badge of prijs, GEEN dark/gold. Licht redactioneel canvas, categorie-tag, journalistieke kop, lead-alinea, nieuwsbeeld-foto, tekstlink "Lees verder". De copy verkoopt het ARTIKEL, de ad leidt naar een listicle of advertorial, niet naar de productpagina)'
  };

  const sophisticationMap = {
    '1': 'Stadium 1 (markt is nieuw, een simpele directe claim volstaat)',
    '2': 'Stadium 2 (claim moet groter of specifieker dan de concurrent)',
    '3': 'Stadium 3 (kale claims zijn uitgewerkt, introduceer een UNIEK MECHANISME dat verklaart WAAROM het werkt)',
    '4': 'Stadium 4 (mechanisme-oorlog, maak het mechanisme groter, eleganter of geloofwaardiger dan dat van concurrenten)',
    '5': 'Stadium 5 (markt is moe en sceptisch, win NIET op claim of mechanisme maar op identificatie, beleving, status en wie de klant wordt)'
  };
  const awarenessMap = {
    'unaware': 'Unaware (kent het probleem nog niet, open met een herkenbare observatie of intrige, NOOIT direct product of prijs)',
    'problem': 'Probleembewust (voelt de pijn, kent de oplossing niet, benoem het probleem scherp en agiteer kort voor je de richting wijst)',
    'solution': 'Oplossingsbewust (kent oplossingstypes maar het merk nog niet, positioneer het merk als de beste oplossing in zijn categorie)',
    'product': 'Productbewust (kent het merk al, nog niet overtuigd, leun op bewijs: reviews, garantie, vergelijking, twijfel wegnemen)',
    'most': 'Meest bewust (klaar om te kopen, wacht op het juiste duwtje, leid met de aanbieding, urgentie of een directe CTA)'
  };

  let prompt = `Genereer ${num} variatie${num > 1 ? 's' : ''} voor de volgende input.\n\n`;
  prompt += `PRIMAIR PRODUCT: ${product.name} (${product.category})\n`;
  prompt += `USPs:\n${(product.usps || []).map(u => ` - ${u}`).join('\n')}\n`;
  if (product.target) prompt += `Doelgroep: ${product.target}\n`;
  if (product.price) prompt += `Prijspunt: ${product.price}\n`;
  prompt += `Uiterlijk-fallback: ${product.appearance}\n`;
  const pbd = refBreakdown(product.references);
  if (pbd.total > 0) {
    const parts = [];
    if (pbd.product > 0) parts.push(`${pbd.product} productfoto${pbd.product > 1 ? "'s" : ''}`);
    if (pbd.lifestyle > 0) parts.push(`${pbd.lifestyle} lifestylefoto${pbd.lifestyle > 1 ? "'s" : ''}`);
    if (pbd.usage > 0) parts.push(`${pbd.usage} gebruiksfoto${pbd.usage > 1 ? "'s" : ''}`);
    if (pbd.packaging > 0) parts.push(`${pbd.packaging} verpakkingsfoto${pbd.packaging > 1 ? "'s" : ''}`);
    prompt += `Referenties beschikbaar: ${parts.join(', ')} worden meegestuurd naar ChatGPT. Bij Lifestyle-Placement mode leun op de lifestylefoto's voor scene-context. Bij Bundle-Showcase of Offer kun je verpakkingsfoto's gebruiken om bundel-presentatie te tonen. Bij overige modes prioriteer de productfoto's voor accurate matte-black rendering.\n`;
    if (pbd.usage > 0) prompt += `GEBRUIKSFOTO'S aanwezig: het product MOET in image_prompt_en op exact dezelfde, correcte manier worden vastgehouden, bediend en toegepast als op die gebruiksfoto's. Verzin NOOIT een onmogelijke, onlogische of foutieve toepassing (verkeerde kant, verkeerde lichaamszone, verkeerde greep). Twijfel je over het gebruik, volg dan letterlijk de gebruiksfoto.\n`;
  }
  if (product.forbidden) prompt += `Verboden claims: ${product.forbidden}\n`;

  if (bundleProducts && bundleProducts.length > 0 && mode !== 'advertorial-news') {
    prompt += `\nEXTRA BUNDLE PRODUCTEN (${bundleProducts.length} stuk${bundleProducts.length > 1 ? 's' : ''}, voor Bundle-Showcase mode of als bundel-toevoeging):\n`;
    bundleProducts.forEach((bp, i) => {
      prompt += `\n${i + 1}. ${bp.name} (${bp.category})\n`;
      prompt += `   USPs: ${bp.usps.filter(u=>u).join(', ')}\n`;
      if (bp.price) prompt += `   Prijspunt: ${bp.price}\n`;
      const bbd = refBreakdown(bp.references);
      if (bbd.total > 0) {
        const bparts = [];
        if (bbd.product > 0) bparts.push(`${bbd.product}P`);
        if (bbd.lifestyle > 0) bparts.push(`${bbd.lifestyle}L`);
        if (bbd.packaging > 0) bparts.push(`${bbd.packaging}V`);
        prompt += `   Referenties: ${bparts.join('/')} (product/lifestyle/verpakking) worden ook meegestuurd.\n`;
      }
    });
    prompt += `\nBij Bundle-Showcase mode: combineer al deze producten in de visual. Headline benoemt de bundle (bv "De Complete Set", "Beard & Body Bundel"). Savings-badge + prijs met crossed-out original vervangt de CTA-pill. Bij andere modes: bundle-producten zijn optioneel mee te nemen, maar primair product staat centraal.\n`;
  }

  prompt += `\nFUNNEL-FASE: ${funnelMap[funnel] || funnel}\n`;
  prompt += `ARCHETYPE: ${isNewsFormat(mode) ? 'n.v.t. voor de Nieuwsartikel-mode; de redactionele nieuwsuitvoering vervangt het archetype, negeer archetype-conventies volledig' : archetypeMap[archetype]}\n`;
  if (window._roryHypothese) prompt += `OVERKOEPELENDE HYPOTHESE (laat elke variant hierop aansluiten): ${window._roryHypothese}\n`;
  prompt += `FORMAT-MODE: ${AD_FORMAT_DIRECTIVE[mode] || modeMap[mode] || mode}\n`;
  prompt += `PLAATSING: ${placementMap[placement]}\n`;
  if (sophistication) prompt += `MARKET SOPHISTICATION: ${sophisticationMap[sophistication] || sophistication}\n`;
  if (awareness) prompt += `CUSTOMER AWARENESS: ${awarenessMap[awareness] || awareness}\n`;
  if (sophistication || awareness) {
    prompt += `\n## STRATEGIE-KADER (HARDE EIS, GEEN SUGGESTIE)\n`;
    if (awareness) prompt += `- AWARENESS: open exact op dit niveau. De headline pakt de kijker op waar die mentaal zit. Een unaware-opening met prijs, of een meest-bewust-opening met probleem-educatie, is FOUT en mag niet voorkomen.\n`;
    if (sophistication) prompt += `- SOPHISTICATION: stem claim en mechanisme hier strikt op af. Stadium 3 en 4 vragen een herkenbaar uniek mechanisme in de hook. Bij stadium 4 richting 5 en stadium 5 is een grotere of getrademarkte claim DOOD, win in plaats daarvan op bewijs, eerlijkheid en transparantie (toon de belofte, claim hem niet) en op een dimensie die concurrenten niet kunnen claimen. Geen kale generieke claim zoals scheert glad.\n`;
  }

  if (persona) {
    prompt += `\nCUSTOMER PERSONA: ${persona.name}\n`;
    if (persona.description) prompt += `Beschrijving: ${persona.description}\n`;
    if (persona.pains && persona.pains.length > 0) prompt += `Pijnpunten: ${persona.pains.join(' , ')}\n`;
    if (persona.desires && persona.desires.length > 0) prompt += `Wensen: ${persona.desires.join(' , ')}\n`;
    if (persona.objections && persona.objections.length > 0) prompt += `Bezwaren: ${persona.objections.join(' , ')}\n`;
    prompt += `BELANGRIJK: alle variaties moeten deze specifieke persona aanspreken. Headlines pakken een pijnpunt of wens uit deze lijst (niet generiek), body-text reageert op een bezwaar als het past, visuele setting matcht de levensfase en context van deze persona. Geen generieke "voor alle mannen" framing, maak het herkenbaar voor exact dit profiel.\n`;
  }

  if (persona) {
    prompt += `\nHARDE EIS PERSONA: elke variatie is gebouwd voor exact deze persona, niemand anders. Hook en headline komen uit een pijnpunt of wens hierboven, in de taal van deze persona. De body reageert op een van de bezwaren. De visuele setting matcht de context van dit profiel. Geen generieke voor-alle-mannen-framing en geen pijn, wens of bezwaar dat niet bij dit profiel hoort.\n`;
  }
  if (persona && sophistication && awareness) {
    prompt += `\n## STRIKT TESTKADER\nDit is een gerichte test van een specifieke koper. Persona, awareness en sophistication zijn bewust vastgezet. Blijf er VOLLEDIG binnen: elke variatie is herkenbaar gebouwd voor deze persona, opent op dit awareness-niveau en hanteert dit sophistication-stadium. Wijk niet uit naar een generieke doelgroep, een ander awareness-niveau of een generieke claim, ook niet voor de afwisseling tussen variaties. De variaties mogen onderling verschillen in hook, compositie en uitvoering, maar NOOIT in wie ze aanspreken of op welk niveau ze instappen.\n`;
  }

  if (concept && mode !== 'advertorial-news') {
    prompt += `\nCONCEPT-RICHTING (HARDE VISUELE DRIVER, geen losse copy-hint): ${concept}\n`;
    prompt += `Deze concept-richting is LEIDEND voor de visuele compositie, niet alleen voor de copy. Bevat de richting een concreet visueel idee (een transformatie, een before/after, een split-frame, een scene, een personage, een situatie, een contrast, OF een analogie/metafoor zoals "het product als de bumper van een auto"), dan MOET image_prompt_en dat idee letterlijk in beeld brengen. Bij een analogie of metafoor: vertaal het beeldspraak-idee naar een concreet, herkenbaar beeld (toon het vergelijkingsobject zelf of een visuele samensmelting van product en metafoor), zet het NOOIT alleen als woord in de copy. De concept-richting gaat VOOR op de standaardlook van de gekozen format-mode: de mode buigt mee zodat het concept zichtbaar wordt, ook bij een strak format zoals Feature-Education of een product-diagram (verwerk de analogie of scene in of rondom het diagram). Val NIET terug op een generieke product-op-sokkel hero als het concept om iets anders vraagt. Elke variatie realiseert de KERN van dit concept op zijn EIGEN manier, via de eigen hook en sub-stack van die variatie (ander moment, andere compositie, andere insteek), zodat het beeld resoneert met de hook EN trouw blijft aan het concept; concept en hook van een variatie vallen visueel samen, ze staan nooit los van elkaar. Bij een transformatie of before/after: bouw een echte split-frame of duidelijk zichtbaar contrast (bv links ruig en onverzorgd, rechts strak en verzorgd), nooit een subtiele hint. Vertaal video-achtige of sequentie-taal naar EEN enkel statisch frame dat dezelfde transformatie vangt. Blijf binnen de huisstijl van het merk en de safe zones.\n`;
  }
  if (offer && archetype === 'offer' && mode !== 'advertorial-news') prompt += `\nOFFER-DETAIL: ${offer}\n`;
  if (isNewsFormat(mode)) {
    const newsTopicEl = document.getElementById('news-article-topic');
    const newsDestEl = document.getElementById('news-article-dest');
    const newsTopic = newsTopicEl ? newsTopicEl.value.trim() : '';
    const newsDest = (newsDestEl && newsDestEl.value) || 'listicle';
    prompt += `\nNIEUWSARTIKEL-BRIEFING (HARDE DRIVER voor deze mode):\n`;
    prompt += newsTopic
      ? `- Onderwerp van het artikel: ${newsTopic}\n`
      : `- Onderwerp: niet opgegeven, kies zelf een sterk redactioneel onderwerp dat past bij product en persona (een herkenbaar probleem of curiosity-angle, bv ingegroeide haren of de grootste afknappers).\n`;
    prompt += `- Bestemming: een ${newsDest === 'advertorial' ? 'ADVERTORIAL, een verhalend artikel dat het probleem uitlegt en richting de oplossing schrijft; de kop is een nieuwskop zonder getal' : 'LISTICLE, een opsommingsartikel (bv "7 dingen die..."); de kop mag een getal bevatten en de lead teast een item zonder het weg te geven'}.\n`;
    prompt += `- De journalistieke kop (headline_nl), de lead-alinea (body_copy_nl), het nieuwsbeeld in image_prompt_en en de hook gaan ALLEMAAL over dit onderwerp. De copy teast het artikel en verkoopt NIET het product.\n`;
  }
  prompt += `\nGenereer nu ${num} variatie${num > 1 ? 's, elk met een ANDER hook-framework' : ''}. Output: alleen het JSON-object.`;
  return prompt;
}

