// ============================================================
// PERSONA DATABASE (categorie-based, niet product-bound)
// ============================================================
const PRODUCT_CATEGORIES_WS = ['Shaver', 'Trimmer', 'Bodygroomer', 'Multistyler', 'Skincare', 'Accessoire', 'Bundel', 'Anders'];
const PRODUCT_CATEGORIES_WSH = ['Airstylers', 'Hair Dryers', 'Bundel', 'Accessoire', 'Algemeen', 'Anders'];
const PRODUCT_CATEGORIES = (ACTIVE_BRAND==='wellshine') ? PRODUCT_CATEGORIES_WSH : PRODUCT_CATEGORIES_WS;

const SEED_PERSONAS_WS = [
  {
    id: "persona-bg-mark",
    name: "Mark de Vries, de Relatie-Pragmaticus",
    category: "Bodygroomer",
    description: "32 jaar, IT-consultant, koopt op basis van partner-feedback en niet uit eigen comfort, veiligheid op gevoelige zones is doorslaggevend (~30% van de markt)",
    recAwareness: ["problem", "solution"],
    recSoph: "3-4",
    pains: [
      "Bloedbad op de gevoelige zones bij de eerste keer, die ervaring bepaalt of hij ooit terugkomt",
      "Ingegroeide haren en irritatie die pas dagen na het scheren opkomen",
      "De afweging glad versus veilig, kiezen tussen biljartbal-glad en geen risico",
      "Te snel opnieuw scheren geeft cuts en bumps, timing-onzekerheid",
      "Stoppels die botsen met een partner die zelf scheert"
    ],
    desires: [
      "Een resultaat dicht bij nat scheren, zonder de risico's",
      "Trimmen niet kaal, lengte behouden, niemand wil er kinderlijk uitzien",
      "Zich schoner en comfortabeler voelen, het gevoel telt meer dan perfectie",
      "Het goed doen voor zijn partner en rekening houden met haar voorkeur",
      "Een veilige vaste routine van vijf minuten"
    ],
    objections: [
      "Ik heb al een Philips, waarom zou ik dit kopen, de switching-cost",
      "Niets elektrisch bij mijn edele delen, dat is onvoorspelbaar",
      "Het lijkt te mooi om waar te zijn, scepsis bij een nieuw merk",
      "Het scheert misschien niet zo glad als beloofd, de verwachtingskloof",
      "Ad-moeheid, constant gebombardeerd met ads van concurrenten"
    ]
  },
  {
    id: "persona-bg-sven",
    name: "Sven Janssen, de Sceptische Veteraan",
    category: "Bodygroomer",
    description: "47 jaar, senior projectmanager bouw, wantrouwt marketing, rekent in totale kosten over jaren en eist functioneel bewijs, duurzaamheid weegt zwaarder dan gemak (~18% van de markt)",
    recAwareness: ["product", "most"],
    recSoph: "5",
    pains: [
      "Accu dood binnen een jaar, precies bij garantie-einde, voelt bewust ingebouwd",
      "Verborgen kosten van mesjes, het rekensommetje van honderden euro's over jaren",
      "Motor verzwakt en apparaat faalt na een jaar bij normaal gebruik",
      "Goedkoop plastic binnenwerk achter een premium buitenkant",
      "Geen onderdelen of laders beschikbaar, niet te repareren dus wegwerp"
    ],
    desires: [
      "Tien-plus jaar meegaan, build-to-last, zijn ijkpunt is een 15 jaar oude Braun",
      "Vervangbare onderdelen tegen een redelijke prijs, geen koop-opnieuw-strategie",
      "Transparante herkomst met bewijs, geen vlaggetjes maar certificaten en namen",
      "Een betrouwbaar full-body apparaat, functioneel en niet romantisch",
      "Eindelijk geen verwondingen meer, maar pas geloven als het bewezen is"
    ],
    objections: [
      "Een tien-euro-trimmer voor tien keer de prijs, premium prijs zonder premium mechanisme",
      "Een goedkope machine van de Lidl doet het ook, eerst functioneel bewijs",
      "Een plastic kapje dat ze skin safe technology noemen en zelfs trademarken",
      "Ongevraagd ingeschreven voor een mesjes-abonnement",
      "Marketing 10/10 en product 4/10, laat het product de marketing overtreffen"
    ]
  },
  {
    id: "persona-bg-lotte",
    name: "Lotte van der Berg, de Cadeau-Koper",
    category: "Bodygroomer",
    description: "34 jaar, HR-manager, zij is de koper en hij de gebruiker, haar beslissing draait om bewijs dat hij het echt blijft gebruiken na de eerste keer (~12% van de markt)",
    recAwareness: ["problem"],
    recSoph: "2-3",
    pains: [
      "Hij neemt zelf geen initiatief, klaagt wel maar handelt niet",
      "Een cadeau dat binnen een jaar kapotgaat, haar exacte nachtmerrie",
      "Eerdere cadeau-tools bleven ongebruikt in de kast liggen",
      "Ze weet niet welke de juiste voor hem is, een kennis-gat",
      "Het risico dat hij het als kritiek opvat"
    ],
    desires: [
      "Een cadeau dat hij echt blijft gebruiken, volgehouden gebruik is haar succesmetric",
      "Premium gepresenteerd en mooi verpakt, het voelt als een echt cadeau",
      "Makkelijk in gebruik met een lage drempel zodat het niet ongebruikt blijft",
      "Iets voor jullie allebei, geen kritiek maar een investering in samen",
      "Verzorgingsproducten als leuke verrassing, een bundel met extra's"
    ],
    objections: [
      "Wat als hij het als kritiek opvat, haar grootste emotionele blocker",
      "Gaat hij het wel echt gebruiken of belandt het in de kast",
      "Welke is de juiste voor hem, het kennis-gat",
      "Cadeaus gaan toch snel kapot, ze heeft de horrorverhalen gezien",
      "Is het de prijs waard als hij het misschien niet gebruikt"
    ]
  },
  {
    id: "persona-bg-joris",
    name: "Joris Coolen, de Atletische Presteerder",
    category: "Bodygroomer",
    description: "28 jaar, marketing manager en fanatiek sporter, grooming is performance en hygiene en geen ijdelheid, wil minder wrijving en een routine die in zijn trainingsschema past (~18% van de markt)",
    recAwareness: ["problem", "solution"],
    recSoph: "3-4",
    pains: [
      "Schuren en wrijving tijdens lange training, prestatieverlies en geen cosmetisch detail",
      "Kaalscheren de avond voor een rit geeft zadelpijn",
      "Ingegroeide haren door kaalscheren",
      "Stoppel-jeuk tijdens meerdaagse events, precies in zijn wedstrijdperiode",
      "Te veel scheren geeft meer irritatie dan het oplost"
    ],
    desires: [
      "Minder wrijving en betere prestatie, de marginal-gains-mentaliteit",
      "Trimmen niet kaal om regrowth en irritatie te managen, instelbare lengtes",
      "Strategisch scheren rond zijn trainingsschema, een snelle betrouwbare routine",
      "Volledige lichaamsverzorging in een tool, meerdere zones en een apparaat",
      "Een snelle efficiente routine, klaar zijn en trainen in plaats van in de badkamer staan"
    ],
    objections: [
      "Het is geen ijdelheid maar praktisch, hij wil het prestatie-frame als excuus",
      "Gaat dit mee bij intensief en frequent gebruik, duurzaamheid onder zware belasting",
      "Niets elektrisch bij de edele delen, de veiligheid moet bewezen zijn",
      "Houdt de accu het bij dagelijks gebruik, laadtijd en runtime tellen",
      "Kaal wil ik niet, ik moet de lengte kunnen regelen met instelbare opzetstukken"
    ]
  }
];
const SEED_PERSONAS_WSH = [
  {
    "id": "wsh-persona-sanne",
    "name": "Sanne, de Dyson-bewuste besparter",
    "category": "Airstylers",
    "description": "32 jaar, 25-39, vrouw, NL/BE. Slimme shopper die het Dyson-resultaat wil zonder de Dyson-prijs. Vergelijkt actief dupes (MAE, Sansbeaute, Ace & Taylor) en wil bewijs dat het bij haar werkt voor ze koopt.",
    "recAwareness": [
      "solution",
      "product"
    ],
    "recSoph": "4-5",
    "pains": [
      "Keuzestress tussen bijna identieke dupes, door de bomen het bos niet meer zien",
      "Bang om opnieuw geld te verspillen aan een tool die niet werkt",
      "De Dyson Airwrap is met 500 euro veel te duur",
      "Krullen en blowouts uit gewone tools zakken snel uit",
      "Stylen met fohn en ronde borstel is te tijdrovend en houdt niet"
    ],
    "desires": [
      "Een Dyson-waardige blowout of krul voor een fractie van de prijs",
      "Eruitzien alsof ze net van de kapper komt, zonder de moeite",
      "Mooi haar zonder zich te laten uitkleden door dure merken",
      "Complimenten krijgen zonder dat iemand weet dat het geen Dyson is",
      "De ochtend terugwinnen en tijd besparen"
    ],
    "objections": [
      "Sceptisch dat een goedkope dupe de Dyson echt evenaart",
      "Bang dat de krul of style bij haar niet blijft zitten",
      "Twijfel of het apparaat snel kapotgaat of doorbrandt",
      "150 euro voor een krulborstel voelt nog steeds als veel geld",
      "Onzeker of het werkt voor haar specifieke haartype"
    ]
  },
  {
    "id": "wsh-persona-fatima",
    "name": "Fatima, de gefrustreerde met dik haar",
    "category": "Airstylers",
    "description": "34 jaar, 25-45, vrouw, NL/BE. Heeft veel, dik haar en gelooft dat geen enkele tool het aankan. Druk leven met werk en kinderen, weinig tijd, sceptisch na veel teleurstellingen.",
    "recAwareness": [
      "problem",
      "solution"
    ],
    "recSoph": "3-4",
    "pains": [
      "Stylen duurt eindeloos, eerst stijlen dan krullen, dat kost te veel tijd",
      "Krullen en volume zakken halverwege de dag in bij zwaar haar",
      "Tools zijn fysiek vermoeiend, ze gaat ervan zweten alsof ze weer moet douchen",
      "Te weinig tijd door werk en kinderen",
      "Het gevoel dat niets haar dikke bos echt aankan"
    ],
    "desires": [
      "Dik haar merkbaar sneller drogen en stylen dan haar oude routine",
      "Een blowout die een hele werkdag of dienst overleeft",
      "Gezien worden als moeiteloos gestyled",
      "Eindelijk een tool die haar haartype echt aankan",
      "Geen angst meer voor wasdag"
    ],
    "objections": [
      "De Dyson voelde niet heet genoeg en kon niet genoeg haar aan",
      "Auto-wrap tools vragen stiekem om kleine secties en techniek waar ze geen tijd voor heeft",
      "Bang dat de krul ook hier niet blijft zitten bij dik haar",
      "Eerdere dupes waren te zwak voor haar dichtheid",
      "Twijfel of een enkel apparaat haar volume aankan"
    ]
  },
  {
    "id": "wsh-persona-linda",
    "name": "Linda, fijn en futloos haar",
    "category": "Airstylers",
    "description": "47 jaar, 20-55 inclusief het 50-59 fijn/slap-haar-segment, vrouw, NL/BE. Hoopvol maar vaak teleurgesteld; haar haar houdt geen stijl en wordt snel plat en statisch.",
    "recAwareness": [
      "solution"
    ],
    "recSoph": "4",
    "pains": [
      "Haar wordt halverwege de dag plat, het volume verdwijnt",
      "Statisch en vliegharen, het oogt snel vet",
      "De stijl zakt binnen een half uur uit",
      "Aan de lucht drogen geeft een verzopen-kat-look",
      "Angst om weer een tool te kopen die niet houdt"
    ],
    "desires": [
      "Betrouwbaar dagelijks volume bij de aanzet",
      "Een gladde, statisch-vrije finish die voorbij de lunch houdt",
      "Haar dat voller en gezonder oogt, alsof je meer haar hebt",
      "Stoppen met verbergen achter clip-ins, extensions of staartjes",
      "Volume zonder zware producten te hoeven gebruiken"
    ],
    "objections": [
      "Opzetstukken zijn vaak te lomp voor fijn of kort haar",
      "Bang dat haar fijne haar geen stijl vasthoudt",
      "Shark Glam of FlexStyle voelde als oplichterij, plat en statisch resultaat",
      "Verdeelde meningen of het wel houdt op fijn haar",
      "Onzeker of het werkt op korter haar"
    ]
  },
  {
    "id": "wsh-persona-marjan",
    "name": "Marjan, de cadeaukoper",
    "category": "Airstylers",
    "description": "49 jaar, 35-55. Koopt vaak voor een dochter van 14-25, partner of zichzelf. NL/BE en internationaal. Zoekt een premium-ogend cadeau dat indruk maakt op een verstandig budget.",
    "recAwareness": [
      "product",
      "most"
    ],
    "recSoph": "4-5",
    "pains": [
      "Drukke tienerochtenden waarop iedereen snel de deur uit moet",
      "De oude gezinsfohn volstaat niet meer voor een stylende tienerdochter",
      "Bang voor een koperskater op een cadeau",
      "Goedkope cadeaus voelden goedkoop aan of gingen kapot",
      "Wil niet voor schut staan als het cadeau tegenvalt"
    ],
    "desires": [
      "Een cadeau dat eruitziet als het dure merk, op cadeau-budget",
      "De ouder of partner zijn die het wow-cadeau gaf",
      "Een blije dochter of partner die het dagelijks gebruikt",
      "Geld besparen ten opzichte van het premium merk",
      "Luxe unboxing en veel opzetstukken die premium ogen"
    ],
    "objections": [
      "Lijkt het niet alsof ik bezuinigd heb?",
      "Wat als ze het niet leuk vindt of het gaat kapot?",
      "Twijfel over duurzaamheid en service na verkoop",
      "Onzeker of het past bij het haartype van de ontvanger",
      "Is de prijs-kwaliteit echt goed of toch marketingpraat?"
    ]
  }
];
const SEED_PERSONAS = (ACTIVE_BRAND==='wellshine') ? SEED_PERSONAS_WSH : SEED_PERSONAS_WS;

function savePersonas() {
  try {
    localStorage.setItem((STORAGE_PREFIX+'personas_v1'), JSON.stringify(state.personas || []));
    return true;
  } catch (e) {
    toast('Persona-opslag mislukt', true);
    return false;
  }
}

function openPersonaModal() {
  clearPersonaForm();
  renderPersonaCategoryFilter();
  renderPersonaDbList();
  document.getElementById('persona-modal').classList.add('open');
}
function closePersonaModal() {
  document.getElementById('persona-modal').classList.remove('open');
}
function clearPersonaForm() {
  state.editingPersonaId = null;
  state.pendingPersonaItems = { pains: [''], desires: [''], objections: [''] };
  document.getElementById('persona-modal-title').textContent = 'Customer Personas beheer';
  document.getElementById('pp-name').value = '';
  if (typeof refreshCategoryDatalist==='function') refreshCategoryDatalist();
  document.getElementById('pp-category').value = (PRODUCT_CATEGORIES[0]||'Algemeen');
  document.getElementById('pp-description').value = '';
  document.getElementById('persona-modal-delete-btn').style.display = 'none';
  renderPersonaItemList('pains');
  renderPersonaItemList('desires');
  renderPersonaItemList('objections');
}
function loadPersonaToForm(id) {
  const per = (state.personas || []).find(p => p.id === id);
  if (!per) return;
  state.editingPersonaId = id;
  state.pendingPersonaItems = {
    pains: (per.pains && per.pains.length > 0) ? [...per.pains] : [''],
    desires: (per.desires && per.desires.length > 0) ? [...per.desires] : [''],
    objections: (per.objections && per.objections.length > 0) ? [...per.objections] : ['']
  };
  document.getElementById('persona-modal-title').textContent = 'Bewerk: ' + per.name;
  document.getElementById('pp-name').value = per.name || '';
  if (typeof refreshCategoryDatalist==='function') refreshCategoryDatalist();
  document.getElementById('pp-category').value = per.category || (PRODUCT_CATEGORIES[0]||'Algemeen');
  document.getElementById('pp-description').value = per.description || '';
  document.getElementById('persona-modal-delete-btn').style.display = 'inline-flex';
  renderPersonaItemList('pains');
  renderPersonaItemList('desires');
  renderPersonaItemList('objections');
}

function renderPersonaItemList(field) {
  const container = document.getElementById('pp-' + field + '-list');
  if (!container) return;
  if (!state.pendingPersonaItems) state.pendingPersonaItems = { pains: [''], desires: [''], objections: [''] };
  if (!Array.isArray(state.pendingPersonaItems[field])) state.pendingPersonaItems[field] = [''];
  const items = state.pendingPersonaItems[field];
  const placeholderMap = {
    pains: 'Bv: snijwondjes bij eerdere pogingen',
    desires: 'Bv: pijnloze eerste ervaring',
    objections: 'Bv: werkt het echt zonder wondjes'
  };
  container.innerHTML = items.map((v, i) => `
    <div class="dynamic-list-item">
      <input type="text" class="pp-item-input" data-field="${field}" data-i="${i}" value="${escapeHtml(v)}" placeholder="${escapeHtml(placeholderMap[field])}">
      ${items.length > 1 ? `<button type="button" class="dynamic-remove-btn" onclick="removePersonaItemField('${field}', ${i})" title="Verwijder">×</button>` : '<div style="width:36px;"></div>'}
    </div>
  `).join('');
  // Live bind input naar state
  container.querySelectorAll('.pp-item-input').forEach(el => {
    el.addEventListener('input', e => {
      const f = e.target.dataset.field;
      const i = parseInt(e.target.dataset.i);
      if (state.pendingPersonaItems[f]) state.pendingPersonaItems[f][i] = e.target.value;
    });
  });
}
function addPersonaItemField(field) {
  if (!state.pendingPersonaItems) state.pendingPersonaItems = { pains: [''], desires: [''], objections: [''] };
  if (!Array.isArray(state.pendingPersonaItems[field])) state.pendingPersonaItems[field] = [];
  // Sync current inputs eerst
  document.querySelectorAll(`.pp-item-input[data-field="${field}"]`).forEach((el, i) => {
    state.pendingPersonaItems[field][i] = el.value;
  });
  state.pendingPersonaItems[field].push('');
  renderPersonaItemList(field);
}
function removePersonaItemField(field, idx) {
  if (!state.pendingPersonaItems[field] || state.pendingPersonaItems[field].length <= 1) return;
  // Sync current eerst
  document.querySelectorAll(`.pp-item-input[data-field="${field}"]`).forEach((el, i) => {
    state.pendingPersonaItems[field][i] = el.value;
  });
  state.pendingPersonaItems[field].splice(idx, 1);
  renderPersonaItemList(field);
}

function savePersonaToDb() {
  const name = document.getElementById('pp-name').value.trim();
  const category = document.getElementById('pp-category').value;
  const description = document.getElementById('pp-description').value.trim();
  if (!name) {
    toast('Persona-naam is verplicht', true);
    return;
  }
  // Sync alle inputs naar state eerst
  ['pains', 'desires', 'objections'].forEach(field => {
    document.querySelectorAll(`.pp-item-input[data-field="${field}"]`).forEach((el, i) => {
      if (!state.pendingPersonaItems[field]) state.pendingPersonaItems[field] = [];
      state.pendingPersonaItems[field][i] = el.value;
    });
  });
  const persona = {
    id: state.editingPersonaId || ('per-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
    name,
    category,
    description,
    pains: (state.pendingPersonaItems.pains || []).map(s => s.trim()).filter(Boolean),
    desires: (state.pendingPersonaItems.desires || []).map(s => s.trim()).filter(Boolean),
    objections: (state.pendingPersonaItems.objections || []).map(s => s.trim()).filter(Boolean)
  };
  if (!state.personas) state.personas = [];
  if (state.editingPersonaId) {
    const i = state.personas.findIndex(p => p.id === state.editingPersonaId);
    if (i >= 0) state.personas[i] = persona;
    else state.personas.push(persona);
  } else {
    state.personas.push(persona);
  }
  savePersonas();
  syncPersonaViews();
  clearPersonaForm();
  toast('Persona opgeslagen');
}
function deleteCurrentPersona() {
  if (!state.editingPersonaId) return;
  if (!confirm('Deze persona verwijderen?')) return;
  state.personas = (state.personas || []).filter(p => p.id !== state.editingPersonaId);
  savePersonas();
  syncPersonaViews();
  clearPersonaForm();
  toast('Persona verwijderd');
}
function renderPersonaCategoryFilter() {
  const sel = document.getElementById('persona-category-filter');
  if (!sel) return;
  const usedCategories = Array.from(new Set((state.personas || []).map(p => p.category).filter(Boolean)));
  const previousValue = sel.value;
  var pcats = [];
  var pushp = function(c){ c=(c||'').trim(); if(c && pcats.indexOf(c)===-1) pcats.push(c); };
  (typeof PRODUCT_CATEGORIES!=='undefined'?PRODUCT_CATEGORIES:[]).forEach(pushp);
  (state.personas || []).forEach(function(p){ pushp(p.category); });
  sel.innerHTML = '<option value="">Alle categorieen</option>' +
    pcats.map(function(c){
      var count = (state.personas || []).filter(function(p){ return p.category === c; }).length;
      return '<option value="' + escapeAttr(c) + '">' + escapeHtml(c) + ' (' + count + ')</option>';
    }).join('');
  if (previousValue) sel.value = previousValue;
}
function renderPersonaDbList() {
  const container = document.getElementById('persona-db-list');
  if (!container) return;
  const filter = document.getElementById('persona-category-filter');
  const filterVal = filter ? filter.value : '';
  let personas = state.personas || [];
  if (filterVal) personas = personas.filter(p => p.category === filterVal);

  if (personas.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:13px;font-style:italic;">Nog geen personas. Klik "Nieuwe persona" om er een toe te voegen.</div>';
    return;
  }
  // Groepeer per categorie
  const grouped = {};
  personas.forEach(per => {
    if (!grouped[per.category]) grouped[per.category] = [];
    grouped[per.category].push(per);
  });
  let html = '';
  Object.keys(grouped).sort().forEach(cat => {
    html += `<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);font-weight:700;padding:14px 4px 8px;">${escapeHtml(cat)} (${grouped[cat].length})</div>`;
    grouped[cat].forEach(per => {
      const summary = [
        per.pains.length > 0 ? `${per.pains.length} pijn` : '',
        per.desires.length > 0 ? `${per.desires.length} wens` : '',
        per.objections.length > 0 ? `${per.objections.length} bezwaar` : ''
      ].filter(Boolean).join(' , ');
      html += `
        <div class="product-item" onclick="loadPersonaToForm('${escapeAttr(per.id)}')">
          <div class="product-item-info">
            <div class="product-item-name">${escapeHtml(per.name)}</div>
            <div class="meta">${escapeHtml(per.description || '(geen beschrijving)')} ${summary ? ' , ' + summary : ''}</div>
          </div>
        </div>
      `;
    });
  });
  container.innerHTML = html;
}

function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const usps = gatherUsps();
  if (!name) {
    toast('Naam is verplicht', true);
    return;
  }
  if (usps.length === 0) {
    toast('Voeg minimaal 1 USP toe', true);
    return;
  }
  const p = {
    id: state.editingProductId || ('p-' + Date.now()),
    name,
    category: document.getElementById('p-category').value,
    usps,
    price: document.getElementById('p-price').value.trim(),
    target: document.getElementById('p-target').value.trim(),
    appearance: document.getElementById('p-appearance').value.trim() || DEFAULT_PRODUCT.appearance,
    forbidden: document.getElementById('p-forbidden').value.trim(),
    references: {
      product: [...state.pendingRefs.product],
      lifestyle: [...state.pendingRefs.lifestyle],
      usage: [...(state.pendingRefs.usage||[])],
      packaging: [...state.pendingRefs.packaging]
    }
  };
  if (state.editingProductId) {
    const i = state.products.findIndex(x => x.id === state.editingProductId);
    state.products[i] = p;
  } else {
    state.products.push(p);
  }
  saveProducts();
  syncProductViews();
  clearProductForm();
  toast('Product opgeslagen');
}
function deleteCurrentProduct() {
  if (!state.editingProductId) return;
  if (!confirm('Dit product verwijderen?')) return;
  state.products = state.products.filter(p => p.id !== state.editingProductId);
  if (state.products.length === 0) state.products = [DEFAULT_PRODUCT];
  saveProducts();
  syncProductViews();
  clearProductForm();
  toast('Product verwijderd');
}

