// ============================================================
// SCRIPTWRITER TAB (v4.28) — 3 hooks x 6 beats x 3 CTA's (Rory Script Studio)
// ============================================================
const SW_SCRIPT_SYSTEM_PROMPT = `# ROL
Je bent Nick Theriot, direct-response media buyer en creative strategist. Je schrijft video-ad-scripts (Meta/TikTok/Reels) in het vaste 3x6x3-format van het team. Je denkt vanuit awareness, sophistication, novelty en bewijs, en je toont in plaats van te beweren.

# HET FORMAT (HARD)
- 3 HOOKS: drie verschillende openingen van DEZELFDE core message; alleen de hook of opening verschilt, de body en de belofte blijven (de "1 ad, 10 winnaars"-motor). Drie hooks op drie ongerelateerde beloftes met een body = drie gebroken cheques.
- 1 BODY van ~6 BEATS: EEN doorlopende belief-shift, elke beat is een gesproken zin met een eigen B-roll shot. Klassieke arc: herkenning (het moment/probleem), escalatie (waarom het ertoe doet), mechanisme (het hoe, zichtbaar gemaakt), bewijs/demonstratie, real-why payoff (hoe het voelt), brug naar CTA. 5 of 7 beats mag als het verhaal het eist, maar het blijft een body, een mechanisme, een belief-shift.
- 3 CTA'S: verschillend in register (direct offer / garantie-geleid / curiosity), maar elk moet het opgegeven bezwaar op scherm killen en consistent blijven met het mechanisme van de body. Een price-as-signal body gevolgd door een kortings-CTA is contractbreuk.

# DE HOOK (eerste 1-3 seconden, belangrijkste element)
Elke hook heeft drie dingen: directe duidelijkheid, een call-out van de avatar OF een getoond resultaat, en novelty/curiosity. Toon het gewenste resultaat of het mechanisme letterlijk in beeld; het beeld bewijst de belofte in dezelfde seconde. Botsen helderheid en novelty, kies helderheid.
Hook-patronen (kies er per hook een en benoem hem): big claim, fast claim, authority, before/after, rival compare, no limits, curiosity gap, call-out van de persoon, pijn/negatief, nieuw mechanisme, social proof, specifiek getal, vraag/myth-bust. Genereer breed, kies op bewijs plus novelty plus helderheid, niet op cleverness. Push de hooks van how-to naar mechanisme naar prospect-focused naarmate de markt voller is. Het beeld moet de claim in dezelfde 3 seconden BEWIJZEN; nooit openen met logo of product-op-wit bij koud verkeer (retargeting keert die regel om).

# SCHRIJFREGELS
- Show, don't tell: elke claim krijgt een shot, de B-roll-kolom is de bewijs-kolom. Wat niet getoond kan worden is een bewering.
- Bouw de body vanuit de spine: bouw verlangen, toon het mechanisme zichtbaar, stapel bewijs, ontmantel het bezwaar, brug naar CTA. Vertel met but-and-so (maar = conflict, dus = gevolg) zodat het midden niet inzakt.
- Schrijf voor de mond, niet voor de pagina: gesproken Nederlands, een creator moet elke zin in een take kunnen zeggen. Zin die een adempauze nodig heeft = splitsen.
- Een core message per body; twee ideeen = twee ads. Bescherm de eenvoud, te veel toevoegen is de meest voorkomende fout.
- Mine de klanttaal: hooks in klantwoorden (reviews, comments, DM's) verslaan copywriter-taal. Gebruik de persona-pijnen letterlijk waar het kan.
- Specificiteit verslaat superlatieven: "90 dagen, geld terug" en een exact klantaantal zijn kostbare, controleerbare signalen.
- Awareness stuurt hoe direct je opent: unaware -> symptoom-funnel, nooit met het product openen; probleembewust -> open op het probleem in hun woorden; oplossingsbewust -> open op de uitkomst; productbewust -> waarom-jij/bewijs/vergelijking; meest bewust -> de offer IS de creative.
- Sophistication stuurt de claim: in een stadium 3-4 markt wint het MECHANISME plus demonstratie; grotere kale claims verlagen het geloof.
- Casting is de boodschap, kies het format dat het meeste bewijs oplevert: UGC-peer (relatable, native), expert/authority voor mechanisme en geleende trust, founder voor skin-in-the-game, koppel voor partner-perceptie (lach MET hem, nooit om hem).
- B-roll grammatica: hook-beat = pattern-interrupt die de claim bewijst; mechanisme-beat = macro/demo die het anders-werken toont; trust-beat = verpakking, garantiekaart, review-screenshots; identity-beat = lifestyle-context; CTA-beat = product plus bezwaar-killers als tekst op scherm.
- Doel-metrics als context: hook rate (3s views/impressies) boven 30% is goed, boven 40% elite; hold rate is 3s naar 15s. De hook is woordelijk script, geen improvisatie.

# ZELFCONTROLE VOOR JE ANTWOORDT (10/10-POORT, HARD)
Voordat je de JSON teruggeeft, beoordeel je je eigen script stil tegen deze rubric en herschrijf je elk zwak deel tot alles staat. Lever nooit een script dat hier niet doorheen komt:
1. Verdient elke seconde de volgende? Geen dode beat, geen zin die je zou wegscrollen.
2. Is elke hook in 1-3s direct duidelijk EN nieuw, en BEWIJST het B-roll-shot de claim in diezelfde seconde?
3. Toon je in plaats van te beweren? Elke claim heeft een zichtbaar shot; wat niet toonbaar is, schrap je of zet je om in een demonstratie.
4. Kloppen tekst EN beeld met de awareness- en sophistication-stage (geen kale claim in een verzadigde markt, nooit product-op-wit bij koud verkeer)?
5. Is het mechanisme levendig genoeg dat de kijker ziet hoe het ANDERS werkt dan alternatieven?
6. Staat er echt, controleerbaar bewijs (demo, before/after, exact getal, garantie, review), niet alleen bijvoeglijke naamwoorden?
7. Neemt de CTA-beat het opgegeven bezwaar zichtbaar weg, en blijft alles trouw aan de core message (geen contractbreuk tussen body en CTA)?
8. Eén core message, gesproken Nederlands, elke zin in één take zegbaar?
Zak je op een punt, herschrijf dat deel. Pas als alle acht staan, geef je de JSON. Doe deze controle in stilte; laat er niets van in de output terugkomen behalve een sterker script.

# OUTPUT, STRICT JSON, geen markdown, geen tekst eromheen
{
  "info": {
    "persona": "...", "emotie_desire": "...", "awareness": "...", "pijnpunt": "...", "angle": "...", "messaging": "...",
    "sophistication": "stadium + een regel wat dat betekent voor het claim-niveau",
    "mechanisme_belief_shift": "de ene overtuiging die de ad moet veranderen en het mechanisme dat dat doet",
    "casting": "creator-type + waarom deze boodschapper de boodschap is",
    "objection_cta": "het ene bezwaar dat de CTA-beat op scherm moet wegnemen",
    "test_hypothese": "waarom dit script zou moeten winnen + welke metric het moet bewegen"
  },
  "casting_brief": { "type": "creator-type (UGC-peer, founder, expert, koppel of voice-over)", "geslacht_leeftijd": "M of V en de leeftijdsrange", "uiterlijk": "hoe de persoon eruit moet zien, concreet", "vereisten": "eisen aan de creator: ervaring, energie, geloofwaardigheid, taal", "setting_props": "locatie en props die nodig zijn", "energie": "toon en energie van de presentatie" },
  "hooks": [ {"mechanisme": "naam van de hook-familie", "aroll": "de gesproken openingszin", "broll": "het shot dat de claim bewijst"} ],
  "beats": [ {"nr": 1, "tekst": "een gesproken zin", "broll": "het bijbehorende shot"} ],
  "ctas": [ {"register": "direct offer|garantie|curiosity", "tekst": "de gesproken CTA-zin", "broll": "shot + onzekerheids-killers als tekst op scherm"} ],
  "combinatie_gids": "welke hooks bij welke CTA's passen (alle hooks delen de body) en welke combinatie verboden is en waarom"
}
Precies 3 hooks en 3 CTA's; beats 5-7 stuks (richtlijn 6). Vul casting_brief volledig en concreet in: wie het script moet spelen, hoe die persoon eruitziet en aan welke eisen die voldoet.`;

function renderSwSelects() {
  const ps = document.getElementById('sw-product');
  if (ps) {
    const prev = ps.value;
    let opts = '<option value="">(geen specifiek product)</option>';
    (state.products || []).forEach(function(p){ if (p && p.id && p.name) opts += '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.name) + '</option>'; });
    ps.innerHTML = opts;
    if (prev && (state.products || []).find(function(p){ return p.id === prev; })) ps.value = prev;
  }
  const sel = document.getElementById('sw-persona');
  if (sel) {
    const prev2 = sel.value;
    let opts2 = '<option value="">(geen persona)</option>';
    (state.personas || []).forEach(function(p){ if (p && p.id && p.name) opts2 += '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.name) + (p.category ? (' (' + escapeHtml(p.category) + ')') : '') + '</option>'; });
    sel.innerHTML = opts2;
    if (prev2) sel.value = prev2;
  }
  const ips = document.getElementById('sw-iter-product');
  if (ips) {
    const prev3 = ips.value;
    let opts3 = '<option value="">(geen specifiek product)</option>';
    (state.products || []).forEach(function(p){ if (p && p.id && p.name) opts3 += '<option value="' + escapeAttr(p.id) + '">' + escapeHtml(p.name) + '</option>'; });
    ips.innerHTML = opts3;
    if (prev3 && (state.products || []).find(function(p){ return p.id === prev3; })) ips.value = prev3;
  }
  if (typeof renderSwIterFields === 'function') renderSwIterFields();
}

function setSwMode(m) {
  var np = document.getElementById('sw-new-panel');
  var ip = document.getElementById('sw-iterate-panel');
  var pp = document.getElementById('sw-plan-panel');
  var bn = document.getElementById('sw-mode-new');
  var bi = document.getElementById('sw-mode-iter');
  var bp = document.getElementById('sw-mode-plan');
  var isIter = (m === 'iterate');
  var isPlan = (m === 'plan');
  if (np) np.style.display = (isIter || isPlan) ? 'none' : '';
  if (ip) ip.style.display = isIter ? '' : 'none';
  if (pp) pp.style.display = isPlan ? '' : 'none';
  if (bn) { bn.classList.toggle('active', !isIter && !isPlan); bn.classList.toggle('btn-ghost', isIter || isPlan); }
  if (bi) { bi.classList.toggle('active', isIter); bi.classList.toggle('btn-ghost', !isIter); }
  if (bp) { bp.classList.toggle('active', isPlan); bp.classList.toggle('btn-ghost', !isPlan); }
  var fab = document.getElementById('wgp-fab'); if (fab) fab.style.display = isPlan ? 'flex' : 'none';
  var dr = document.getElementById('wgp-drawer'); if (dr && !isPlan) { dr.classList.remove('open'); if (typeof wgp !== 'undefined') wgp.drawerOpen = false; }
  if (isIter && typeof renderSwIterFields === 'function') renderSwIterFields();
  if (isPlan && typeof wgpRender === 'function') wgpRender();
  var box = document.getElementById('sw-result'); if (box && !isPlan) box.innerHTML = '';
}

const SW_ITER_FIELDS = [
  { group: 'Advertentie', items: [
    { id: 'swm-adname', label: 'Scriptnaam', wide: true },
    { id: 'swm-period', label: 'Periode', wide: true }
  ]},
  { group: 'Performance', items: [
    { id: 'swm-spend', label: 'Spend (EUR)' },
    { id: 'swm-aov', label: 'AOV (EUR)' },
    { id: 'swm-roas', label: 'ROAS' },
    { id: 'swm-impressions', label: 'Impressions' },
    { id: 'swm-cpm', label: 'CPM (EUR)' }
  ]},
  { group: 'Clicks', items: [
    { id: 'swm-linkclicks', label: 'Link clicks' },
    { id: 'swm-clicksoutbound', label: 'Clicks outbound' },
    { id: 'swm-ctrlink', label: 'CTR link click (%)' },
    { id: 'swm-ctroutbound', label: 'CTR outbound (%)' },
    { id: 'swm-cpclink', label: 'CPC link click (EUR)' },
    { id: 'swm-cpcoutbound', label: 'CPC outbound (EUR)' }
  ]},
  { group: 'Engagement', items: [
    { id: 'swm-follows', label: 'Follows of likes' },
    { id: 'swm-followspct', label: '% follows of likes' },
    { id: 'swm-comments', label: 'Comments' },
    { id: 'swm-commentspct', label: '% comments' },
    { id: 'swm-posteng', label: 'Post engagements' },
    { id: 'swm-engpct', label: '% engagements' },
    { id: 'swm-reactions', label: 'Post reactions' },
    { id: 'swm-shares', label: 'Post shares' },
    { id: 'swm-psr', label: 'PSR (%)' },
    { id: 'swm-seemore', label: 'See more rate (%)' }
  ]},
  { group: 'Media (video)', items: [
    { id: 'swm-avgplaytime', label: 'Video avg. play time (s)' },
    { id: 'swm-videoplays', label: 'Video plays' },
    { id: 'swm-plays3s', label: '3s video plays' },
    { id: 'swm-thruplays', label: 'ThruPlays' },
    { id: 'swm-firstframe', label: '1st frame retention (%)' },
    { id: 'swm-thumbstop', label: 'Thumbstop / hook rate (%)' },
    { id: 'swm-holdrate', label: 'Hold rate (%)' },
    { id: 'swm-sustainrate', label: 'Sustain rate (%)' },
    { id: 'swm-ret15s3s', label: '15s/3s video (%)' }
  ]},
  { group: 'Conversion funnel', items: [
    { id: 'swm-clickquality', label: 'Click quality (%)' },
    { id: 'swm-clicktoatc', label: 'Click to ATC (%)' },
    { id: 'swm-clicktoleads', label: 'Click to leads (%)' },
    { id: 'swm-clicktopurchase', label: 'Click to purchase (%)' },
    { id: 'swm-atctopurchase', label: 'ATC to purchase (%)' }
  ]},
  { group: 'Conversions', items: [
    { id: 'swm-purchases', label: 'Purchases' },
    { id: 'swm-purchasevalue', label: 'Purchase value (EUR)' },
    { id: 'swm-cpa', label: 'CPA (EUR)' },
    { id: 'swm-atc', label: 'ATC' },
    { id: 'swm-atcvalue', label: 'ATC value (EUR)' },
    { id: 'swm-lpv', label: 'Landing page views' }
  ]}
];
function renderSwIterFields() {
  const cont = document.getElementById('sw-iter-fields');
  if (!cont) return;
  let html = '';
  SW_ITER_FIELDS.forEach(function(g) {
    html += '<div class="iterate-group"><div class="iterate-group-title">' + g.group + '</div><div class="iterate-grid">';
    g.items.forEach(function(it) {
      const ex = document.getElementById(it.id);
      const val = ex ? ex.value : '';
      html += '<div class="iterate-field' + (it.wide ? ' wide' : '') + '"><label>' + it.label + '</label><input type="text" id="' + it.id + '" value="' + String(val).replace(/"/g, '&quot;') + '"></div>';
    });
    html += '</div></div>';
  });
  cont.innerHTML = html;
}
function collectSwIterData() {
  const lines = [];
  SW_ITER_FIELDS.forEach(function(g) {
    const parts = [];
    g.items.forEach(function(it) { const el = document.getElementById(it.id); const v = el ? el.value.trim() : ''; if (v) parts.push(it.label + ' ' + v); });
    if (parts.length) lines.push(g.group + ': ' + parts.join(' | '));
  });
  return lines.join('\n');
}
function handleSwIterUpload(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Alleen afbeeldingen worden ondersteund', true); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Bestand te groot, max 5MB', true); return; }
  compressImage(file, 1800, 0.92).then(function(dataUrl) {
    const parts = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!parts) { toast('Kon afbeelding niet parsen', true); return; }
    extractSwIterFromImage(parts[2], parts[1]);
  }).catch(function(err) { toast('Kon afbeelding niet verwerken: ' + err.message, true); });
}
async function extractSwIterFromImage(b64, mimeType) {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  const status = document.getElementById('sw-iter-extract-status');
  const btn = document.getElementById('sw-iter-extract-btn');
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const model = document.getElementById('anthropic-model').value;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Theriot leest de cijfers uit...';
  const keyLines = [];
  SW_ITER_FIELDS.forEach(function(g) { g.items.forEach(function(it) { keyLines.push(it.id + ' = ' + it.label); }); });
  const userText = 'Dit is een screenshot van een video-advertentie-analytics dashboard (Atria of Meta Ads Manager). Lees de zichtbare cijfers uit en geef ze terug als STRICT JSON, geen markdown. Gebruik EXACT deze keys. Waarden als kale getallen: geen euroteken, geen procentteken, geen duizendtal-scheidingsteken, en een punt als decimaalteken. Als een waarde niet zichtbaar is, gebruik een lege string "". De velden swm-adname en swm-period zijn vrije tekst.\n\nKeys (key = betekenis):\n' + keyLines.join('\n') + '\n\nAntwoord met alleen het JSON-object.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 1800, messages: [{ role: 'user', content: [ { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } }, { type: 'text', text: userText } ] }] })
    });
    let text = (wgClaudeTextOrNull(data) || '').replace(/```json/gi, '').replace(/```/g, '');
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('geen JSON in respons');
    const parsed = JSON.parse(text.substring(a, b + 1));
    let filled = 0;
    SW_ITER_FIELDS.forEach(function(g) {
      g.items.forEach(function(it) {
        if (parsed[it.id] !== undefined && parsed[it.id] !== null && String(parsed[it.id]).trim() !== '') {
          const el = document.getElementById(it.id);
          if (el) { el.value = String(parsed[it.id]).trim(); filled++; }
        }
      });
    });
    if (status) status.textContent = filled + ' velden ingevuld, controleer ze';
    toast(filled + ' velden ingevuld uit screenshot');
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Uitlezen mislukt: ' + err.message;
    toast('Uitlezen mislukt: ' + err.message, true);
  } finally { if (btn) btn.disabled = false; }
}
async function swIterateScript() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const scriptText = document.getElementById('sw-iter-script').value.trim();
  if (!scriptText) { toast('Plak eerst het script dat je wilt itereren', true); return; }
  const model = document.getElementById('anthropic-model').value;
  const metrics = (typeof collectSwIterData === 'function') ? collectSwIterData() : '';
  const goal = document.getElementById('sw-iter-goal').value.trim();
  const productId = document.getElementById('sw-iter-product') ? document.getElementById('sw-iter-product').value : '';
  const product = productId ? (state.products || []).find(function(p){ return p.id === productId; }) : null;
  const btn = document.getElementById('sw-iter-btn');
  const box = document.getElementById('sw-result');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Theriot diagnosticeert en itereert...'; }
  if (box) box.innerHTML = '<div class="loading-card">Theriot leest het script en de cijfers, diagnosticeert het knelpunt en bouwt een verbeterde versie...</div>';
  let u = '# ITEREER OP EEN GETEST VIDEO-SCRIPT\n\nDit script heeft al gedraaid. Lees de video-funnel uit de cijfers en diagnosticeer waar het knelt: lage thumbstop/hook rate of lage 1st frame retention = de opening stopt de scroll niet, test een nieuwe hook of openingsbeeld; goede hook maar hold rate of sustain rate zakt = de body breekt de belofte of er concurreren twee ideeen, breng het mechanisme eerder en houd een idee aan; gezonde video-retentie maar lage CTR = de CTA neemt de onzekerheid niet weg; hoge CTR maar lage CVR of hoge CPA = ad-naar-landing mismatch, fix de landing niet het script; alles middelmatig = test een contraire variant. Lever daarna een VERBETERDE versie in hetzelfde 3x6x3-format die de winnende delen vasthoudt en gericht test wat nog niet werkt.\n\n';
  u += 'Bestaand script:\n--- begin script ---\n' + scriptText + '\n--- einde script ---\n\n';
  if (metrics) u += 'Prestatiecijfers van de geteste video:\n' + metrics + '\n'; else u += 'Geen cijfers meegegeven; baseer je op het script zelf.\n';
  if (goal) u += 'Doel en context: ' + goal + '\n';
  if (product) { u += 'Product: ' + product.name + (product.category ? (' (' + product.category + ')') : '') + '\n'; if (product.usps && product.usps.length) u += "USP's: " + product.usps.filter(Boolean).join(' | ') + '\n'; }
  u += '\nOutput ALLEEN het JSON-object volgens het format, met EXTRA een veld "diagnose" (2-4 zinnen: wat de cijfers zeggen en wat je daarom verandert) en een volledig ingevuld casting_brief.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 4000, system: SW_SCRIPT_SYSTEM_PROMPT + brandProfileBlock(), messages: [{ role: 'user', content: u }] })
    });
    let text = (wgClaudeTextOrNull(data) || '').replace(/```json/gi, '').replace(/```/g, '');
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('geen JSON in respons');
    const sc = JSON.parse(text.substring(a, b + 1));
    state.lastScript = sc;
    state.lastScriptContext = { type: 'iterate', source: { source_script_text: scriptText, metrics: metrics, goal: goal }, meta: { product: product ? product.name : '' } };
    if (box) box.innerHTML = buildSwScriptHtml(sc);
    toast('Geitereerd script klaar');
  } catch (err) {
    if (box) box.innerHTML = '<div class="loading-card" style="color:#bd0f0f;">Itereren mislukt: ' + escapeHtml(err.message) + '</div>';
    toast('Itereren mislukt: ' + err.message, true);
    console.error(err);
  } finally { if (btn) { btn.disabled = false; btn.textContent = 'Itereer dit script (Theriot)'; } }
}

const SW_PDF_CSS = `*{box-sizing:border-box;} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:0;padding:30px 34px;font-size:13px;line-height:1.55;} h1{font-size:21px;margin:0 0 3px;} .sub{color:#707070;font-size:12px;margin-bottom:16px;} h2{font-size:12.5px;letter-spacing:.10em;text-transform:uppercase;color:#443410;border-bottom:1px solid #e3d9bf;padding-bottom:5px;margin:20px 0 10px;} .grid{display:grid;grid-template-columns:165px 1fr;gap:5px 14px;} .k{color:#707070;font-weight:600;} .card{border:1px solid #e3d9bf;border-radius:8px;padding:9px 12px;margin:8px 0;page-break-inside:avoid;} .badge{display:inline-block;background:#dab043;color:#1a1a1a;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-radius:4px;padding:2px 7px;margin-left:8px;} .num{font-weight:700;color:#443410;} .line{margin:5px 0;} .lab{color:#4e4e4e;font-weight:600;margin-right:6px;font-size:11px;text-transform:uppercase;} .broll{color:#555555;border-left:2px solid #e3d9bf;padding-left:10px;margin-top:4px;} .note{color:#333333;} @media print{ @page{margin:16mm;} }`;

function swScriptToPdfBody(s) {
  const e = function(t){ return escapeHtml(t == null ? '' : String(t)); };
  const info = s.info || {};
  const brand = (typeof BRAND_NAME !== 'undefined') ? BRAND_NAME : 'Wellgroup';
  let h = '<h1>' + e(brand) + ', video-ad-script</h1><div class="sub">' + (info.angle ? e(info.angle) : '') + '</div>';
  if (s.diagnose) h += '<h2>Diagnose</h2><div class="note">' + e(s.diagnose) + '</div>';
  const ir = [['Persona', info.persona], ['Emotie / desire', info.emotie_desire], ['Awareness', info.awareness], ['Sophistication', info.sophistication], ['Pijnpunt', info.pijnpunt], ['Messaging', info.messaging], ['Mechanisme & belief shift', info.mechanisme_belief_shift], ['Bezwaar bij CTA', info.objection_cta], ['Test-hypothese', info.test_hypothese]].filter(function(r){ return r[1]; });
  if (ir.length) h += '<h2>Strategie</h2><div class="grid">' + ir.map(function(r){ return '<div class="k">' + e(r[0]) + '</div><div>' + e(r[1]) + '</div>'; }).join('') + '</div>';
  const cb = s.casting_brief || (info.casting ? { samenvatting: info.casting } : null);
  if (cb) { const cr = [['Type', cb.type], ['Geslacht & leeftijd', cb.geslacht_leeftijd], ['Uiterlijk', cb.uiterlijk], ['Vereisten', cb.vereisten], ['Setting & props', cb.setting_props], ['Energie & toon', cb.energie], ['Samenvatting', cb.samenvatting]].filter(function(r){ return r[1]; }); h += '<h2>Wie speelt dit (casting)</h2><div class="grid">' + cr.map(function(r){ return '<div class="k">' + e(r[0]) + '</div><div>' + e(r[1]) + '</div>'; }).join('') + '</div>'; }
  h += '<h2>Hooks</h2>' + (s.hooks || []).map(function(hk, i){ return '<div class="card"><span class="num">Hook ' + (i + 1) + '</span>' + (hk.mechanisme ? '<span class="badge">' + e(hk.mechanisme) + '</span>' : '') + '<div class="line"><span class="lab">Gesproken</span>' + e(hk.aroll) + '</div><div class="broll"><span class="lab">Beeld</span> ' + e(hk.broll) + '</div></div>'; }).join('');
  h += '<h2>Body</h2>' + (s.beats || []).map(function(b, i){ return '<div class="card"><span class="num">Beat ' + (b.nr || (i + 1)) + '</span><div class="line">' + e(b.tekst) + '</div><div class="broll"><span class="lab">Beeld</span> ' + e(b.broll) + '</div></div>'; }).join('');
  h += '<h2>CTA\'s</h2>' + (s.ctas || []).map(function(c, i){ return '<div class="card"><span class="num">CTA ' + (i + 1) + '</span>' + (c.register ? '<span class="badge">' + e(c.register) + '</span>' : '') + '<div class="line">' + e(c.tekst) + '</div><div class="broll"><span class="lab">Beeld</span> ' + e(c.broll) + '</div></div>'; }).join('');
  if (s.combinatie_gids) h += '<h2>Combinatie-gids</h2><div class="note">' + e(s.combinatie_gids) + '</div>';
  return h;
}

function swDownloadScriptPdf() {
  const s = state.lastScript;
  if (!s) { toast('Genereer eerst een script', true); return; }
  const win = window.open('', '_blank');
  if (!win) { toast('Sta pop-ups toe om de PDF te maken', true); return; }
  const doc = '<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>Wellgroup script</title><style>' + SW_PDF_CSS + '</style></head><body>' + swScriptToPdfBody(s) + '</body></html>';
  win.document.open(); win.document.write(doc); win.document.close();
  win.focus();
  setTimeout(function(){ try { win.print(); } catch (e) {} }, 400);
}

function buildSwScriptHtml(s) {
  const e = function(t){ return escapeHtml(t == null ? '' : String(t)); };
  const info = s.info || {};
  let h = '<div class="sw-doc">';
  h += '<div class="sw-actions" style="display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-image" onclick="swDownloadScriptPdf()">Download als PDF</button><button class="btn btn-small" onclick="saveCurrentScript()">Bewaar in script-bibliotheek</button></div>';
  if (s.diagnose) h += '<div class="sw-sec"><div class="sw-sec-title">Diagnose, waarom dit beter zou moeten presteren</div><div class="sw-note">' + e(s.diagnose) + '</div></div>';
  const infoRows = [['Persona', info.persona], ['Emotie / desire', info.emotie_desire], ['Awareness', info.awareness], ['Market sophistication', info.sophistication], ['Pijnpunt', info.pijnpunt], ['Angle', info.angle], ['Messaging', info.messaging], ['Mechanisme & belief shift', info.mechanisme_belief_shift], ['Bezwaar bij CTA', info.objection_cta], ['Test-hypothese & metric', info.test_hypothese]].filter(function(r){ return r[1]; });
  if (infoRows.length) { h += '<div class="sw-sec"><div class="sw-sec-title">Strategie</div><div class="sw-info-grid">'; infoRows.forEach(function(r){ h += '<div class="sw-info-key">' + e(r[0]) + '</div><div class="sw-info-val">' + e(r[1]) + '</div>'; }); h += '</div></div>'; }
  const cb = s.casting_brief || (info.casting ? { samenvatting: info.casting } : null);
  if (cb) {
    const cbRows = [['Type', cb.type], ['Geslacht & leeftijd', cb.geslacht_leeftijd], ['Uiterlijk', cb.uiterlijk], ['Vereisten', cb.vereisten], ['Setting & props', cb.setting_props], ['Energie & toon', cb.energie], ['Samenvatting', cb.samenvatting]].filter(function(r){ return r[1]; });
    h += '<div class="sw-sec"><div class="sw-sec-title">Wie speelt dit (casting)</div><div class="sw-cast">';
    cbRows.forEach(function(r){ h += '<div class="sw-cast-item"><div class="k">' + e(r[0]) + '</div><div class="v">' + e(r[1]) + '</div></div>'; });
    h += '</div></div>';
  }
  h += '<div class="sw-sec"><div class="sw-sec-title">Hooks, eerste 3 seconden, kies de sterkste om te testen</div>';
  (s.hooks || []).forEach(function(hk, i){ h += '<div class="sw-card"><div class="sw-card-head"><span class="sw-card-num">Hook ' + (i + 1) + '</span>' + (hk.mechanisme ? '<span class="sw-badge">' + e(hk.mechanisme) + '</span>' : '') + '</div><div class="sw-line"><span class="lab">Gesproken</span>' + e(hk.aroll) + '</div><div class="sw-broll"><span class="lab">Beeld</span> ' + e(hk.broll) + '</div></div>'; });
  h += '</div>';
  h += '<div class="sw-sec"><div class="sw-sec-title">Body, ' + ((s.beats || []).length) + ' beats</div>';
  (s.beats || []).forEach(function(b, i){ h += '<div class="sw-card"><div class="sw-card-head"><span class="sw-card-num">Beat ' + (b.nr || (i + 1)) + '</span></div><div class="sw-line">' + e(b.tekst) + '</div><div class="sw-broll"><span class="lab">Beeld</span> ' + e(b.broll) + '</div></div>'; });
  h += '</div>';
  h += '<div class="sw-sec"><div class="sw-sec-title">CTA\'s</div>';
  (s.ctas || []).forEach(function(c, i){ h += '<div class="sw-card"><div class="sw-card-head"><span class="sw-card-num">CTA ' + (i + 1) + '</span>' + (c.register ? '<span class="sw-badge">' + e(c.register) + '</span>' : '') + '</div><div class="sw-line">' + e(c.tekst) + '</div><div class="sw-broll"><span class="lab">Beeld</span> ' + e(c.broll) + '</div></div>'; });
  h += '</div>';
  if (s.combinatie_gids) h += '<div class="sw-sec"><div class="sw-sec-title">Combinatie-gids</div><div class="sw-note">' + e(s.combinatie_gids) + '</div></div>';
  h += '</div>';
  return h;
}

const SW_SETUP_TOOL = {
  name: 'scriptopzet',
  description: 'Bepaal de opzet voor een video-ad-script op basis van het idee.',
  input_schema: {
    type: 'object',
    properties: {
      funnel: { type: 'string', enum: ['tof','mof','bof','retargeting'] },
      awareness: { type: 'string', enum: ['unaware','problem','solution','product','most'] },
      sophistication: { type: 'string', enum: ['1','2','3','4','5'] },
      casting: { type: 'string', enum: ['ugc','founder','expert','koppel','voiceover'] },
      angle: { type: 'string', description: 'de richting/angle in 1-2 NL zinnen, klaar voor het richtingsveld' },
      objection: { type: 'string', description: 'het ene bezwaar dat de CTA moet killen' },
      onderbouwing: { type: 'string', description: 'kort waarom deze opzet past' }
    },
    required: ['funnel','awareness','sophistication','casting','angle']
  }
};
async function swAnalyzeIdea() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const idea = document.getElementById('sw-idea').value.trim();
  if (!idea) { toast('Type eerst je idee', true); return; }
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('sw-idea-btn');
  const status = document.getElementById('sw-idea-status');
  const box = document.getElementById('sw-idea-reasoning');
  const productId = document.getElementById('sw-product').value;
  const product = productId ? (state.products||[]).find(function(p){return p.id===productId;}) : null;
  const personaId = document.getElementById('sw-persona').value;
  const persona = personaId ? (state.personas||[]).find(function(p){return p.id===personaId;}) : null;
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Theriot bepaalt de opzet...';
  let u = 'Idee voor een video-ad-script: ' + idea + '\n';
  if (product) u += 'Product: ' + product.name + (product.category?(' ('+product.category+')'):'') + '\n';
  if (persona) u += 'Persona: ' + persona.name + (persona.description?(', '+persona.description):'') + '\n';
  u += 'Bepaal funnel-fase, awareness-niveau, market sophistication (grooming is doorgaans 3-4), de beste casting en een concrete angle, plus het bezwaar dat de CTA moet killen. Geef het terug via de tool scriptopzet.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 1200, system: SW_SCRIPT_SYSTEM_PROMPT + brandProfileBlock(), tools: [SW_SETUP_TOOL], tool_choice: { type: 'tool', name: 'scriptopzet' }, messages: [{ role: 'user', content: u }] })
    });
    let r = null;
    if (data && Array.isArray(data.content)) { const tu = data.content.find(function(b){return b.type==='tool_use';}); if (tu && tu.input) r = tu.input; }
    if (!r) throw new Error('geen opzet ontvangen van het model');
    setSelectIfValid('sw-funnel', r.funnel);
    setSelectIfValid('sw-awareness', r.awareness);
    setSelectIfValid('sw-sophistication', String(r.sophistication || ''));
    setSelectIfValid('sw-casting', r.casting);
    if (r.angle) { const d = document.getElementById('sw-direction'); if (d && !d.value.trim()) d.value = r.angle; }
    if (r.objection) { const o = document.getElementById('sw-objection'); if (o && !o.value.trim()) o.value = r.objection; }
    if (box) { box.classList.add('visible'); box.innerHTML = '<div class="brain-dump-reasoning-label">Theriot opzet</div><div class="brain-dump-reasoning-text">' + escapeHtml(r.onderbouwing || 'Funnel, awareness, sophistication, casting en angle zijn ingevuld.') + '</div>'; }
    if (status) status.textContent = 'Opzet ingevuld, controleer en schrijf het script';
    toast('Opzet bepaald door Theriot');
  } catch (err) {
    if (status) status.textContent = 'Mislukt: ' + err.message;
    toast('Opzet bepalen mislukt: ' + err.message, true);
    console.error(err);
  } finally { if (btn) btn.disabled = false; }
}
async function swWriteScript() {
  const apiKey = (window.__WG_TEAMSERVER ? 'teamserver' : document.getElementById('anthropic-key').value.trim());
  if (!apiKey) { toast('Eerst je Anthropic API key invullen', true); document.getElementById('settings-panel').classList.add('open'); return; }
  const direction = document.getElementById('sw-direction').value.trim();
  if (!direction) { toast('Geef eerst richting: waar dient het script voor', true); return; }
  const model = document.getElementById('anthropic-model').value;
  const btn = document.getElementById('sw-write-btn');
  const box = document.getElementById('sw-result');
  const productId = document.getElementById('sw-product').value;
  const product = productId ? (state.products || []).find(function(p){ return p.id === productId; }) : null;
  const personaId = document.getElementById('sw-persona').value;
  const persona = personaId ? (state.personas || []).find(function(p){ return p.id === personaId; }) : null;
  const casting = document.getElementById('sw-casting').value;
  const funnel = document.getElementById('sw-funnel').value;
  const awareness = document.getElementById('sw-awareness').value;
  const sophistication = document.getElementById('sw-sophistication') ? document.getElementById('sw-sophistication').value : '';
  const planAngle = document.getElementById('sw-angle') ? document.getElementById('sw-angle').value : '';
  const planFormat = document.getElementById('sw-format') ? document.getElementById('sw-format').value : '';
  const length = document.getElementById('sw-length').value;
  const objection = document.getElementById('sw-objection').value.trim();
  const history = document.getElementById('sw-history').value.trim();
  btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Theriot schrijft het script...';
  if (box) box.innerHTML = '<div class="loading-card">Body eerst, hooks als laatste. Theriot bouwt de belief-shift en de B-roll per beat...</div>';
  const castingLabels = { ugc: 'UGC creator (relatable peer)', founder: 'Founder', expert: 'Expert (barber/dermatoloog-type)', koppel: 'Partner/koppel', voiceover: 'AI voice-over met B-roll' };
  let u = '# SCRIPT-BRIEFING\n';
  u += 'Merk: ' + (typeof BRAND_NAME_UC !== 'undefined' ? BRAND_NAME_UC : 'Wellshave') + '\n';
  u += 'Richting (waar het script voor dient): ' + direction + '\n';
  if (product) {
    u += 'Product: ' + product.name + (product.category ? (' (' + product.category + ')') : '') + '\n';
    if (product.usps && product.usps.length) u += "USP's en feiten (gebruik specifiek): " + product.usps.filter(Boolean).join(' | ') + '\n';
    if (product.price) u += 'Prijs: ' + product.price + '\n';
  }
  if (persona) {
    u += 'Persona: ' + persona.name + (persona.description ? (', ' + persona.description) : '') + '\n';
    if (persona.pains && persona.pains.length) u += 'Pijnpunten (mine deze klanttaal): ' + persona.pains.join(' | ') + '\n';
    if (persona.desires && persona.desires.length) u += 'Wensen: ' + persona.desires.join(' | ') + '\n';
    if (persona.objections && persona.objections.length) u += 'Bezwaren: ' + persona.objections.join(' | ') + '\n';
  }
  u += 'Casting: ' + (castingLabels[casting] || casting) + '\n';
  u += 'Funnel-fase: ' + funnel + '\nAwareness: ' + awareness + '\n';
  u += 'Market sophistication: ' + (sophistication ? ('stadium ' + sophistication) : 'bepaal zelf, grooming is doorgaans stadium 3-4') + '\n';
  if (planAngle) u += 'Angle type (verplicht, bouw het script rond deze angle): ' + planAngle + '\n';
  if (planFormat) u += 'Format (schrijf het script passend bij dit format): ' + planFormat + '\n';
  u += 'Lengte: ' + length + ' seconden\n';
  if (objection) u += 'Bezwaar dat de CTA moet killen: ' + objection + '\n';
  if (history) u += 'Wat al gedraaid heeft (test wat hier NIET in zit): ' + history + '\n';
  u += '\nSchrijf nu het script volgens het 3x6x3-format en de schrijfregels. Output ALLEEN het JSON-object.';
  try {
    const data = await fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: model, max_tokens: 3500, system: SW_SCRIPT_SYSTEM_PROMPT + brandProfileBlock(), messages: [{ role: 'user', content: u }] })
    });
    let text = (wgClaudeTextOrNull(data) || '').replace(/```json/gi, '').replace(/```/g, '');
    const a = text.indexOf('{'); const b = text.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('geen JSON in respons');
    const script = JSON.parse(text.substring(a, b + 1));
    state.lastScript = script;
    state.lastScriptContext = { type: 'new', source: null, meta: { product: product ? product.name : '', persona: persona ? persona.name : '', funnel: funnel, awareness: awareness, sophistication: sophistication, casting: casting, length: length, angle: planAngle, format: planFormat } };
    if (box) box.innerHTML = buildSwScriptHtml(script);
    toast('Script klaar');
  } catch (err) {
    console.error(err);
    if (box) box.innerHTML = '<div class="loading-card" style="color:#bd0f0f;">Script mislukt: ' + escapeHtml(err.message) + '</div>';
    toast('Script mislukt: ' + err.message, true);
  }
  btn.disabled = false; btn.textContent = "Schrijf script (3 hooks, 6 beats, 3 CTA's)";
}

function renderVariationCard(v, i, metadata, prefix = '') {
  const id = `${prefix}var-${i}`;
  const placementSize = SIZE_MAP[document.getElementById('openai-model').value][metadata.placement];
  return `
    <div class="variation-card" id="var-card-${i}">
      <div class="var-head">
        <div>
          <div class="var-number">Variatie ${i + 1}</div>
          <div style="margin-top: 8px;"><span class="var-hook-tag">${escapeHtml(v.hook_type)} , ${escapeHtml(v.hook_label_nl || '')}</span></div>
        </div>
        <div class="var-actions">
          <button class="btn btn-small btn-image" onclick="generateImage(${i})">Genereer afbeelding</button>
          <button class="btn btn-small" onclick='saveToLibraryFromCard(${i})'>Bewaar concept</button>
        </div>
      </div>

      <div class="var-headline" id="var-${i}-headline-preview">${escapeHtml(v.headline_nl)}</div>

      <div class="var-row">
        <div class="field-name">Headline</div>
        <div class="field-value-editable">
          <input type="text" class="inline-edit-input" id="var-${i}-headline" value="${escapeAttr(v.headline_nl)}" oninput="syncCopyField(${i}, 'headline')" data-original="${escapeAttr(v.headline_nl)}">
          <span class="sync-status" id="var-${i}-headline-sync"></span>
        </div>
        <button class="copy-btn" onclick="copyFieldValue(${i}, 'headline', this)" title="Kopieer">${copyIcon()}</button>
      </div>

      <div class="var-row">
        <div class="field-name">Body copy</div>
        <div class="field-value-editable">
          <textarea class="inline-edit-textarea ${!v.body_copy_nl || !v.body_copy_nl.trim() ? 'empty-field' : ''}" id="var-${i}-body" oninput="syncCopyField(${i}, 'body')" data-original="${escapeAttr(v.body_copy_nl || '')}" rows="2" placeholder="(leeg in deze variant, vul in om body-tekst in beeld te tonen)">${escapeHtml(v.body_copy_nl || '')}</textarea>
          <span class="sync-status" id="var-${i}-body-sync"></span>
        </div>
        <button class="copy-btn" onclick="copyFieldValue(${i}, 'body', this)" title="Kopieer">${copyIcon()}</button>
      </div>

      <div class="var-row">
        <div class="field-name">CTA</div>
        <div class="field-value-editable">
          <input type="text" class="inline-edit-input ${!v.cta_nl || !v.cta_nl.trim() ? 'empty-field' : ''}" id="var-${i}-cta" value="${escapeAttr(v.cta_nl || '')}" oninput="syncCopyField(${i}, 'cta')" data-original="${escapeAttr(v.cta_nl || '')}" placeholder="(leeg in deze variant, vul in om CTA-pill in beeld te tonen)">
          <span class="sync-status" id="var-${i}-cta-sync"></span>
        </div>
        <button class="copy-btn" onclick="copyFieldValue(${i}, 'cta', this)" title="Kopieer">${copyIcon()}</button>
      </div>

      ${(v.visual_nl) ? `<div class="var-row">
        <div class="field-name">Visual</div>
        <div class="field-value reasoning">${escapeHtml(v.visual_nl)}</div>
        <span></span>
      </div>` : ''}

      <div class="var-row">
        <div class="field-name">ChatGPT prompt</div>
        <div style="grid-column: 2;">
          <textarea class="field-value mono" id="${id}-prompt" oninput="updatePrompt(${i})" spellcheck="false">${escapeHtml(v.image_prompt_en)}</textarea>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <button class="expand-toggle" onclick="toggleExpand('${id}-prompt')">Vergroot</button>
            <span class="prompt-edit-hint" id="${id}-prompt-status">Aanpasbaar, edits worden gebruikt bij image generation<span class="edited-flag" id="${id}-prompt-flag" style="display:none;">, edited</span></span>
          </div>
        </div>
        <button class="copy-btn" onclick="copyPrompt(${i}, this)" title="Kopieer prompt">${copyIcon()}</button>
      </div>

      ${(v.hypothese_nl) ? `<div class="var-row">
        <div class="field-name">Rory&#39;s hypothese</div>
        <div class="field-value reasoning">${escapeHtml(v.hypothese_nl)}</div>
        <span></span>
      </div>` : ''}

      <div class="var-row">
        <div class="field-name">Rory&#39;s reasoning</div>
        <div class="field-value reasoning">${escapeHtml(v.reasoning_nl || v.reasoning || '')}</div>
        <span></span>
      </div>

      <div class="ogilvy-row">
        <button class="btn btn-small" id="ogilvy-btn-${i}" onclick="generateOgilvyCopy(${i})">Schrijf Meta ad copy (Ogilvy)</button>
        <span class="edit-hint">primary text, headlines en descriptions voor Ads Manager, geschreven bij deze creative</span>
      </div>
      <div class="ogilvy-result" id="ogilvy-copy-${i}">${v.ogilvy_copy ? buildOgilvyBlockHtml(v.ogilvy_copy) : ''}</div>

      <div class="gen-image-section" id="gen-image-${i}">
        <div class="gen-image-empty">
          Klik "Genereer afbeelding" om dit concept direct als beeld te renderen (${placementSize})
        </div>
        <div class="base-photo-section">
          <div class="base-photo-header">
            <span class="base-photo-label">Optioneel, gebruik een eigen foto als basis</span>
            <span class="base-photo-hint">de AI bouwt de ad bovenop deze foto, ipv vanaf scratch te genereren</span>
          </div>
          <div class="base-photo-zone" id="base-photo-zone-${i}"></div>
          <input type="file" id="base-photo-input-${i}" accept="image/*" style="display:none;" onchange="handleBasePhotoUpload(event, ${i})">
        </div>
      </div>
    </div>
  `;
}

function toggleExpand(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('expanded');
}

function updatePrompt(varIndex) {
  if (!state.lastGenerated || !state.lastGenerated.variations[varIndex]) return;
  const id = `var-${varIndex}-prompt`;
  const textarea = document.getElementById(id);
  if (!textarea) return;
  const newValue = textarea.value;
  const original = state.lastGenerated.variations[varIndex]._originalPrompt;
  if (original === undefined) {
    state.lastGenerated.variations[varIndex]._originalPrompt = state.lastGenerated.variations[varIndex].image_prompt_en;
  }
  state.lastGenerated.variations[varIndex].image_prompt_en = newValue;
  const flag = document.getElementById(`${id}-flag`);
  if (flag) {
    const wasEdited = newValue !== (state.lastGenerated.variations[varIndex]._originalPrompt || newValue);
    flag.style.display = wasEdited ? 'inline' : 'none';
  }
}

