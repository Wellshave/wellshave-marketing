// ============================================================
// PRODUCT IMPORT / EXPORT
// ============================================================
function ensureXLSXLoaded() {
  if (typeof XLSX !== 'undefined') return Promise.resolve(true);
  // Fallback: try alternative CDN if primary failed
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    setTimeout(() => resolve(typeof XLSX !== 'undefined'), 6000);
  });
}

function exportProductsJSON() {
  if (state.products.length === 0) {
    toast('Geen producten om te exporteren', true);
    return;
  }
  const data = {
    format: 'wellshave-products',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    productCount: state.products.length,
    products: state.products
  };
  const json = JSON.stringify(data, null, 2);
  const sizeKb = Math.round(json.length / 1024);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  a.download = `wellshave-products-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${state.products.length} producten geexporteerd als JSON (${sizeKb} KB)`);
}

async function exportProductsExcel() {
  const loaded = await ensureXLSXLoaded();
  if (!loaded || typeof XLSX === 'undefined') {
    toast('Excel-library kon niet geladen worden, controleer internetverbinding', true);
    return;
  }
  if (state.products.length === 0) {
    toast('Geen producten om te exporteren', true);
    return;
  }
  const rows = state.products.map(p => {
    const bd = refBreakdown(p.references);
    return {
      'ID (niet wijzigen)': p.id,
      'Naam': p.name,
      'Categorie': p.category || '',
      'USP 1': p.usps[0] || '',
      'USP 2': p.usps[1] || '',
      'USP 3': p.usps[2] || '',
      'Prijs': p.price || '',
      'Doelgroep': p.target || '',
      'Uiterlijk': p.appearance || '',
      'Verboden claims': p.forbidden || '',
      'Ref-foto\'s (info)': bd.total > 0
        ? `${bd.product}P / ${bd.lifestyle}L / ${bd.packaging}V`
        : 'geen'
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 24 }, { wch: 14 },
    { wch: 38 }, { wch: 38 }, { wch: 38 },
    { wch: 14 }, { wch: 30 }, { wch: 42 },
    { wch: 30 }, { wch: 18 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Producten');

  // Add a small instructions sheet
  const instructions = [
    { 'Veld': 'ID (niet wijzigen)', 'Uitleg': 'Unieke identifier, koppelt updates aan bestaande producten en bewaart ref-foto\'s. NIET aanpassen of leegmaken.' },
    { 'Veld': 'Naam', 'Uitleg': 'Productnaam, verplicht.' },
    { 'Veld': 'Categorie', 'Uitleg': 'Bv Shaver, Beard, Skin, Accessory.' },
    { 'Veld': 'USP 1/2/3', 'Uitleg': 'Drie verkoop-argumenten, alle drie verplicht.' },
    { 'Veld': 'Prijs', 'Uitleg': 'Optioneel, bv "€89".' },
    { 'Veld': 'Doelgroep', 'Uitleg': 'Optioneel, korte beschrijving van wie het product gebruikt.' },
    { 'Veld': 'Uiterlijk', 'Uitleg': 'Fallback-beschrijving van hoe het product eruit ziet, gebruikt als geen ref-foto\'s aanwezig zijn.' },
    { 'Veld': 'Verboden claims', 'Uitleg': 'Optioneel, claims die de AI niet mag maken.' },
    { 'Veld': 'Ref-foto\'s (info)', 'Uitleg': 'Read-only kolom die toont hoeveel product/lifestyle/verpakking-foto\'s er gekoppeld zijn. Foto\'s zelf zitten NIET in Excel, alleen in JSON-export.' },
    { 'Veld': '', 'Uitleg': '' },
    { 'Veld': 'Importeren', 'Uitleg': 'Open de tool, klik Beheer, klik Importeer en kies dit Excel-bestand. Bestaande producten worden gematcht op ID, ref-foto\'s blijven bewaard.' }
  ];
  const ws2 = XLSX.utils.json_to_sheet(instructions);
  ws2['!cols'] = [{ wch: 22 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructies');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `wellshave-products-${dateStr}.xlsx`);
  toast(`${state.products.length} producten geexporteerd als Excel`);
}

async function downloadTemplate() {
  const loaded = await ensureXLSXLoaded();
  if (!loaded || typeof XLSX === 'undefined') {
    toast('Excel-library kon niet geladen worden, controleer internetverbinding', true);
    return;
  }

  const sampleRow = {
    'ID (niet wijzigen)': 'p-flex-guard-3in1',
    'Naam': 'Wellshave Flex Guard 3-in-1',
    'Categorie': 'Shaver',
    'USP 1': 'SkinSafe keramische bladen, trim zonder snijwondjes ook op gevoelige zones',
    'USP 2': '3-in-1 design, body trimmer plus neustrimmer plus foil shaver in een apparaat',
    'USP 3': '8000 RPM krachtige motor, 90 min draadloos gebruik, IPX7 waterdicht',
    'Prijs': '€54,95 (van €85,65, 36% korting)',
    'Doelgroep': 'Mannen 25-50 die hun bodygrooming zelf onderhouden, voorkeur voor een tool ipv meerdere',
    'Uiterlijk': '',
    'Verboden claims': 'Medische claims, permanente haarverwijdering, vervangt professionele behandelingen',
    "Ref-foto's (info)": 'geen, upload na import via product-modal'
  };
  // Two empty rows as visual cue to keep filling
  const emptyRow = {
    'ID (niet wijzigen)': '', 'Naam': '', 'Categorie': '',
    'USP 1': '', 'USP 2': '', 'USP 3': '',
    'Prijs': '', 'Doelgroep': '', 'Uiterlijk': '',
    'Verboden claims': '', "Ref-foto's (info)": ''
  };
  const rows = [sampleRow, emptyRow, emptyRow];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 }, { wch: 28 }, { wch: 14 },
    { wch: 50 }, { wch: 50 }, { wch: 50 },
    { wch: 32 }, { wch: 50 }, { wch: 70 },
    { wch: 50 }, { wch: 30 }
  ];

  const instructions = [
    { 'Veld': 'Hoe gebruik je deze template', 'Uitleg': 'Rij 1 in tab Producten bevat de Wellshave Flex Guard als voorbeeld. Voeg eronder meer producten toe door rijen in te vullen. Sla op als .xlsx. Open de Ad Generator, klik Beheer, klik Importeer en kies dit bestand.' },
    { 'Veld': '', 'Uitleg': '' },
    { 'Veld': 'ID (niet wijzigen)', 'Uitleg': 'Unieke identifier die updates aan bestaande producten koppelt en ref-foto\'s bewaart. NIET aanpassen of leegmaken. Bij nieuwe producten: laat leeg of gebruik een eigen pattern zoals p-beardmate-pro.' },
    { 'Veld': 'Naam', 'Uitleg': 'Productnaam, verplicht. Bv "Wellshave Blade Baron" of "Wellshave Beardmate".' },
    { 'Veld': 'Categorie', 'Uitleg': 'Kies uit Shaver, Beard, Skin, Accessory. Bepaalt welke dropdown-optie in de tool is geselecteerd.' },
    { 'Veld': 'USP 1 / 2 / 3', 'Uitleg': 'Drie verkoop-argumenten, alle drie verplicht. Houd ze kort en concreet, deze gaan letterlijk naar de AI voor ad-copy. Voorbeelden: "SkinSafe technology", "100 dagen geld-terug", "Voor 23:59 besteld, morgen in huis".' },
    { 'Veld': 'Prijs', 'Uitleg': 'Optioneel. Bv "€54,95" of met korting-context zoals "€54,95 (van €85,65, 36% korting)".' },
    { 'Veld': 'Doelgroep', 'Uitleg': 'Optioneel, korte beschrijving van wie het product gebruikt. Helpt Claude bij het toonzetten.' },
    { 'Veld': 'Uiterlijk', 'Uitleg': 'Mag leeg blijven als je referentie-foto\'s gaat uploaden voor dit product, foto\'s zijn altijd preciezer dan tekst. Alleen invullen als je geen foto\'s hebt, beschrijf dan kort wat er te zien is: matte black body, gold S logo bovenaan, verticale WELLSHAVE wordmark.' },
    { 'Veld': 'Verboden claims', 'Uitleg': 'Optioneel, claims die de AI NIET mag maken. Bv "medische claims, permanente haarverwijdering, vervangt professionele behandelingen".' },
    { 'Veld': "Ref-foto's (info)", 'Uitleg': 'Read-only kolom, toont hoeveel product / lifestyle / verpakking foto\'s er gekoppeld zijn (P / L / V). Foto\'s zitten NIET in Excel, alleen in JSON-export. Upload foto\'s in de tool zelf via Beheer.' },
    { 'Veld': '', 'Uitleg': '' },
    { 'Veld': 'Na de import', 'Uitleg': 'Open de Ad Generator, klik Beheer, klik op een product, en upload foto\'s in de drie categorieen (productfoto\'s, lifestylefoto\'s, verpakkingsfoto\'s). Zonder foto\'s werkt image generation ook, maar minder voorspelbaar.' },
    { 'Veld': 'Foto\'s delen met team', 'Uitleg': 'Zodra je producten met foto\'s hebt: gebruik JSON (volledig) export voor een complete backup inclusief alle foto\'s als base64. Excel-export bevat alleen metadata, geen foto\'s.' },
  ];
  const ws2 = XLSX.utils.json_to_sheet(instructions);
  ws2['!cols'] = [{ wch: 24 }, { wch: 110 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Producten');
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructies');

  XLSX.writeFile(wb, 'wellshave-products-template.xlsx');
  toast('Template gedownload met Flex Guard als voorbeeld en uitleg-tab');
}

function triggerImportProducts() {
  document.getElementById('import-products-input').click();
}

// ============================================================
// PERSONA IMPORT / EXPORT
// ============================================================
const PIPE_SEP = ' | ';

function splitPipe(value) {
  if (!value) return [];
  return String(value).split(/\s*\|\s*/).map(s => s.trim()).filter(Boolean);
}

async function exportPersonasExcel() {
  const loaded = await ensureXLSXLoaded();
  if (!loaded || typeof XLSX === 'undefined') {
    toast('Excel-library kon niet geladen worden, controleer internetverbinding', true);
    return;
  }
  if (!state.personas || state.personas.length === 0) {
    toast('Nog geen personas om te exporteren, klik "Template" voor een leeg startbestand', true);
    return;
  }
  const rows = state.personas.map(p => ({
    'Categorie': p.category || '',
    'Persona-naam': p.name || '',
    'Beschrijving': p.description || '',
    'Pijnpunten (pipe-separated)': (p.pains || []).join(PIPE_SEP),
    'Wensen (pipe-separated)': (p.desires || []).join(PIPE_SEP),
    'Bezwaren (pipe-separated)': (p.objections || []).join(PIPE_SEP)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 40 }, { wch: 60 }, { wch: 60 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personas');
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `wellshave-personas-${dateStr}.xlsx`);
  toast(`${state.personas.length} personas geexporteerd`);
}

async function downloadPersonaTemplate() {
  const loaded = await ensureXLSXLoaded();
  if (!loaded || typeof XLSX === 'undefined') {
    toast('Excel-library kon niet geladen worden, controleer internetverbinding', true);
    return;
  }

  const examples = [
    {
      'Categorie': 'Shaver',
      'Persona-naam': 'De Voorzichtige Beginner',
      'Beschrijving': 'Man 25-32, eerste keer aan body-grooming, geen ervaring, bang voor irritatie of snijwondjes op gevoelige zones',
      'Pijnpunten (pipe-separated)': 'Heeft snijwondjes bij eerdere pogingen | Bang dat het pijnlijk gaat zijn | Weet niet welke richting hij moet trimmen | Geirriteerde huid de volgende dag',
      'Wensen (pipe-separated)': 'Pijnloze eerste ervaring | Een tool die hem niet kan beschadigen | Snel klaar zijn zonder na te denken | Voelt zich verzorgd, niet gehavend',
      'Bezwaren (pipe-separated)': 'Werkt het echt zonder wondjes ook op gevoelige zones | Is het niet duur voor iemand die het maar 1x per maand doet | Wat als ik het verkeerd gebruik'
    },
    {
      'Categorie': 'Shaver',
      'Persona-naam': 'De Premium-Liefhebber',
      'Beschrijving': 'Man 35-50, hoge inkomensgroep, koopt graag de beste versie van alles, waardeert design en bouwkwaliteit boven prijs',
      'Pijnpunten (pipe-separated)': 'Goedkope trimmers voelen plastic en wegwerp | Stoort zich aan rommelige badkamer-aanrechten | Wil geen tools die afgekeken zijn van Aliexpress',
      'Wensen (pipe-separated)': 'Tools die er net zo goed uitzien als de Bang en Olufsen op zijn nachtkastje | Een grooming-ervaring die voelt als premium | Iets om trots op te zijn',
      'Bezwaren (pipe-separated)': 'Is de bouwkwaliteit echt premium of marketing-praat | Doet hij hetzelfde als een Philips OneBlade voor 2x de prijs | Hoe voelt het in de hand'
    },
    {
      'Categorie': 'Bodygroomer',
      'Persona-naam': 'Bv. Bodygroomer-persona 1',
      'Beschrijving': 'Vul hier de beschrijving uit jullie research in',
      'Pijnpunten (pipe-separated)': 'pijnpunt 1 | pijnpunt 2 | pijnpunt 3',
      'Wensen (pipe-separated)': 'wens 1 | wens 2',
      'Bezwaren (pipe-separated)': 'bezwaar 1 | bezwaar 2'
    }
  ];
  const emptyRow = {
    'Categorie': '',
    'Persona-naam': '',
    'Beschrijving': '',
    'Pijnpunten (pipe-separated)': '',
    'Wensen (pipe-separated)': '',
    'Bezwaren (pipe-separated)': ''
  };
  const rows = [...examples, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow, emptyRow];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 40 }, { wch: 60 }, { wch: 60 }, { wch: 60 }];

  const instructions = [
    { 'Veld': 'Hoe gebruik je deze template', 'Uitleg': 'De Personas-tab bevat 3 voorbeelden om de structuur te tonen. Vul daaronder jouw eigen personas in, sla op als .xlsx, en upload het bestand in de Ad Generator via Beheer > Importeer.' },
    { 'Veld': '', 'Uitleg': '' },
    { 'Veld': 'NIEUW: per categorie', 'Uitleg': 'Personas zijn gekoppeld aan een productcategorie, niet aan een individueel product. Alle Bodygroomer-producten delen dezelfde Bodygroomer-personas, alle Shaver-producten delen dezelfde Shaver-personas.' },
    { 'Veld': '', 'Uitleg': '' },
    { 'Veld': 'Categorie', 'Uitleg': 'Een van: Shaver, Trimmer, Bodygroomer, Multistyler, Skincare, Accessoire, Bundel, Anders. Moet exact zo gespeld zijn (hoofdletter-gevoelig).' },
    { 'Veld': 'Persona-naam', 'Uitleg': 'Korte herkenbare naam waar het team mee kan werken. Bv: De Voorzichtige Beginner, De Premium-Liefhebber, De Tijd-Bespaarder.' },
    { 'Veld': 'Beschrijving', 'Uitleg': 'Een zin die de persona schetst. Bv: Man 25-32, eerste keer aan bodygrooming, bang voor irritatie.' },
    { 'Veld': 'Pijnpunten', 'Uitleg': 'Wat frustreert deze persona, waar lopen ze tegenaan. Pipe-separated: meerdere items scheid je met het pipe-teken (|). Spaties eromheen voor leesbaarheid is handig.' },
    { 'Veld': 'Wensen', 'Uitleg': 'Wat wil deze persona bereiken, hoe ziet hun ideale situatie eruit. Pipe-separated.' },
    { 'Veld': 'Bezwaren', 'Uitleg': 'Welke twijfels of weerstand heeft de persona voordat ze kopen. Pipe-separated.' },
    { 'Veld': '', 'Uitleg': '' },
    { 'Veld': 'TIPS', 'Uitleg': '' },
    { 'Veld': 'Per categorie meerdere', 'Uitleg': 'Wij raden aan om voor elke productcategorie 3 tot 5 verschillende personas te definieren met variatie in pijnpunten en bezwaren. Zo kun je per ad-generatie testen welke insteek het hardste raakt.' },
    { 'Veld': 'Bodygroomer voorbeeld', 'Uitleg': 'Voor jullie Bodygroomer-research met 5 personas: vul die 5 allemaal in onder Categorie "Bodygroomer". Alle Bodygroomer-producten in de tool kunnen die personas gebruiken.' },
    { 'Veld': 'Pipe-trick', 'Uitleg': 'Het pipe-teken | scheidt items binnen een cel. Voor leesbaarheid handig om er spaties omheen te zetten: item1 | item2 | item3. Geen pipe nodig als je maar 1 item hebt.' },
    { 'Veld': 'Updaten', 'Uitleg': 'Als je een bestaande persona wilt aanpassen na import, kan dat in de tool zelf via Beheer > klik op de persona-rij in de lijst.' }
  ];
  const ws2 = XLSX.utils.json_to_sheet(instructions);
  ws2['!cols'] = [{ wch: 26 }, { wch: 100 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Personas');
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructies');

  XLSX.writeFile(wb, 'wellshave-personas-template.xlsx');
  toast('Persona-template gedownload met voorbeelden en uitleg');
}

function triggerImportPersonas() {
  document.getElementById('import-personas-input').click();
}

async function handleImportPersonas(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const loaded = await ensureXLSXLoaded();
  if (!loaded || typeof XLSX === 'undefined') {
    toast('Excel-library kon niet geladen worden, controleer internetverbinding', true);
    return;
  }
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    // Zoek de Personas-sheet, fallback op eerste sheet die geen Instructies is
    let rows = [];
    let sheetUsed = '';
    for (const name of wb.SheetNames) {
      if (name.toLowerCase() === 'instructies') continue;
      const ws = wb.Sheets[name];
      const sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (sheetRows.length > 0) {
        // Check of het een personas-sheet lijkt (heeft Persona-naam of Categorie kolom)
        const firstRow = sheetRows[0];
        const hasPersonaCol = Object.keys(firstRow).some(k => /persona[\-\s]?naam|persona[\-\s]?name/i.test(k));
        const hasCategoryCol = Object.keys(firstRow).some(k => /^categorie$|^category$/i.test(k));
        if (hasPersonaCol && hasCategoryCol) {
          rows = sheetRows;
          sheetUsed = name;
          break;
        }
      }
    }
    if (rows.length === 0) {
      toast('Geen Personas-sheet gevonden, controleer dat het bestand een Personas-tab heeft met de juiste kolommen', true);
      return;
    }

    const getKey = (row, ...patterns) => {
      for (const p of patterns) {
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().trim().startsWith(p.toLowerCase().trim())) {
            return String(row[key] || '').trim();
          }
        }
      }
      return '';
    };

    const validCategories = ['shaver', 'trimmer', 'bodygroomer', 'multistyler', 'skincare', 'accessoire', 'bundel', 'anders'];
    const normalizeCategory = (raw) => {
      const lower = raw.toLowerCase();
      const match = validCategories.find(c => c === lower);
      if (match) return match.charAt(0).toUpperCase() + match.slice(1);
      return raw; // Behoud zoals ingegeven indien geen match, voor flexibiliteit
    };

    const newPersonas = [];
    const skipped = [];
    rows.forEach((r, idx) => {
      const name = getKey(r, 'persona-naam', 'persona naam', 'persona', 'naam', 'name');
      const category = getKey(r, 'categorie', 'category');
      if (!name) {
        if (category || getKey(r, 'beschrijving', 'description')) skipped.push(idx + 2);
        return;
      }
      if (!category) {
        skipped.push(idx + 2);
        return;
      }
      newPersonas.push({
        id: 'per-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '-' + idx,
        name,
        category: normalizeCategory(category),
        description: getKey(r, 'beschrijving', 'description'),
        pains: splitPipe(getKey(r, 'pijnpunten', 'pains')),
        desires: splitPipe(getKey(r, 'wensen', 'desires')),
        objections: splitPipe(getKey(r, 'bezwaren', 'objections'))
      });
    });

    if (newPersonas.length === 0) {
      toast('Geen geldige personas gevonden, elke rij heeft minimaal een Categorie en Persona-naam nodig', true);
      return;
    }

    state.pendingPersonaImport = newPersonas;
    showPersonaImportConfirm(newPersonas.length, skipped.length, file.name);
  } catch (err) {
    toast('Import mislukt: ' + err.message, true);
    console.error(err);
  }
}

function showPersonaImportConfirm(validCount, skippedCount, fileName) {
  const box = document.getElementById('persona-import-confirm');
  const existingCount = (state.personas || []).length;
  const skippedNote = skippedCount > 0 ? `<div style="font-size:11px;color:var(--text-faint);margin-top:6px;">${skippedCount} rij${skippedCount > 1 ? 'en' : ''} overgeslagen, ontbrekende Categorie of Persona-naam</div>` : '';
  box.innerHTML = `
    <div class="import-confirm-card">
      <div class="import-confirm-title">${escapeHtml(fileName)}</div>
      <div class="import-confirm-meta">${validCount} persona${validCount > 1 ? 's' : ''} klaar voor import, je hebt nu ${existingCount} in de database</div>
      ${skippedNote}
      <div class="import-confirm-actions">
        <button class="btn btn-small btn-ghost" onclick="cancelPersonaImport()">Annuleer</button>
        <button class="btn btn-small" onclick="confirmPersonaImport('merge')">Toevoegen (${existingCount + validCount} totaal)</button>
        <button class="btn btn-small btn-danger" onclick="confirmPersonaImport('replace')">Alles vervangen (${validCount} totaal)</button>
      </div>
    </div>
  `;
  box.classList.add('show');
}

function cancelPersonaImport() {
  state.pendingPersonaImport = null;
  document.getElementById('persona-import-confirm').classList.remove('show');
  document.getElementById('persona-import-confirm').innerHTML = '';
}

function confirmPersonaImport(mode) {
  if (!state.pendingPersonaImport) return;
  if (mode === 'replace') {
    state.personas = [...state.pendingPersonaImport];
  } else {
    // Merge: dedupe op (name + category), nieuwe vervangen bestaande met dezelfde sleutel
    const existing = state.personas || [];
    const incoming = state.pendingPersonaImport;
    const merged = [...existing];
    incoming.forEach(p => {
      const idx = merged.findIndex(e => e.name === p.name && e.category === p.category);
      if (idx >= 0) merged[idx] = { ...p, id: merged[idx].id };
      else merged.push(p);
    });
    state.personas = merged;
  }
  savePersonas();
  state.pendingPersonaImport = null;
  document.getElementById('persona-import-confirm').classList.remove('show');
  document.getElementById('persona-import-confirm').innerHTML = '';
  syncPersonaViews();
  toast(`${mode === 'replace' ? 'Vervangen' : 'Toegevoegd'}, ${state.personas.length} personas in database`);
}

async function handleImportProducts(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;

  const nameLower = file.name.toLowerCase();
  if (nameLower.endsWith('.json')) {
    await importFromJSON(file);
  } else if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
    await importFromExcel(file);
  } else {
    toast('Alleen .json, .xlsx of .xls bestanden worden ondersteund', true);
  }
}

async function importFromJSON(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.products)) {
      toast('Onbekend bestandsformaat, mist "products" array', true);
      return;
    }
    const result = validateAndNormalize(data.products);
    if (result.valid.length === 0) {
      toast('Geen geldige producten gevonden in bestand', true);
      return;
    }
    state.pendingImport = result.valid;
    showImportConfirm(result.valid.length, result.skipped.length, data.exportedAt, file.name, 'JSON');
  } catch (err) {
    toast('Import mislukt: ' + err.message, true);
    console.error(err);
  }
}

async function importFromExcel(file) {
  const loaded = await ensureXLSXLoaded();
  if (!loaded || typeof XLSX === 'undefined') {
    toast('Excel-library kon niet geladen worden, controleer internetverbinding', true);
    return;
  }
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    // Use the first sheet that has product-like data, or just the first sheet
    let rows = [];
    for (const name of wb.SheetNames) {
      if (name.toLowerCase() === 'instructies') continue;
      const ws = wb.Sheets[name];
      const sheetRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (sheetRows.length > 0 && sheetRows[0]) {
        const firstRow = sheetRows[0];
        const hasNameCol = Object.keys(firstRow).some(k => /^naam$|^name$/i.test(k));
        if (hasNameCol) { rows = sheetRows; break; }
      }
    }
    if (rows.length === 0) {
      // Fallback: try the first sheet anyway
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    }
    if (rows.length === 0) {
      toast('Excel bevat geen rijen', true);
      return;
    }

    const normalized = rows.map(r => {
      const get = (...keys) => {
        for (const k of keys) {
          for (const actualKey of Object.keys(r)) {
            if (actualKey.toLowerCase().trim().startsWith(k.toLowerCase().trim())) {
              return String(r[actualKey] || '').trim();
            }
          }
        }
        return '';
      };
      return {
        id: get('id (niet', 'id'),
        name: get('naam', 'name'),
        category: get('categorie', 'category'),
        usps: [get('usp 1', 'usp1'), get('usp 2', 'usp2'), get('usp 3', 'usp3')],
        price: get('prijs', 'price'),
        target: get('doelgroep', 'target'),
        appearance: get('uiterlijk', 'appearance'),
        forbidden: get('verboden', 'forbidden')
      };
    });

    const result = validateAndNormalize(normalized, true); // true = preserve existing refs by ID
    if (result.valid.length === 0) {
      toast('Geen geldige producten gevonden in Excel', true);
      return;
    }
    state.pendingImport = result.valid;
    showImportConfirm(result.valid.length, result.skipped.length, null, file.name, 'Excel');
  } catch (err) {
    toast('Excel import mislukt: ' + err.message, true);
    console.error(err);
  }
}

function validateAndNormalize(rawProducts, preserveExistingRefs = false) {
  const valid = [];
  const skipped = [];
  rawProducts.forEach((p, i) => {
    if (!p.name || typeof p.name !== 'string' || !p.name.trim()) {
      skipped.push(`Rij ${i + 1}: geen geldige naam`);
      return;
    }
    if (!Array.isArray(p.usps) || p.usps.filter(u => u && String(u).trim()).length < 3) {
      skipped.push(`${p.name}: mist 3 USPs`);
      return;
    }
    const id = (p.id && String(p.id).trim()) || ('p-' + Date.now() + '-' + i);
    const existing = preserveExistingRefs ? state.products.find(x => x.id === id) : null;
    valid.push({
      id,
      name: String(p.name).trim(),
      category: String(p.category || 'Shaver').trim(),
      usps: [String(p.usps[0] || '').trim(), String(p.usps[1] || '').trim(), String(p.usps[2] || '').trim()],
      price: String(p.price || '').trim(),
      target: String(p.target || '').trim(),
      appearance: String(p.appearance || '').trim() || DEFAULT_PRODUCT.appearance,
      forbidden: String(p.forbidden || '').trim(),
      references: existing ? existing.references : normalizeRefs(p.references)
    });
  });
  if (skipped.length > 0) console.warn('Import: overgeslagen items:', skipped);
  return { valid, skipped };
}

function showImportConfirm(count, skippedCount, exportDate, filename, sourceType) {
  const dateStr = exportDate ? new Date(exportDate).toLocaleDateString('nl-NL', { dateStyle: 'medium' }) : null;
  const skipNote = skippedCount > 0 ? ` (${skippedCount} ongeldig, zie console)` : '';
  const overlap = state.pendingImport.filter(np => state.products.find(p => p.id === np.id)).length;
  const overlapNote = overlap > 0 ? `, waarvan ${overlap} met bestaand ID` : '';
  const dateNote = dateStr ? ` (geexporteerd op ${dateStr})` : '';
  const excelNote = sourceType === 'Excel'
    ? '<br><span style="color:var(--text-faint); font-size:12px;">Excel-import: ref-foto\'s blijven gekoppeld via ID-match aan bestaande producten.</span>'
    : '';
  const banner = document.getElementById('import-confirm');
  banner.innerHTML = `
    <div class="import-summary">
      <strong>${count} producten gevonden</strong> in <em style="color:var(--text);font-style:normal;">${escapeHtml(filename)}</em>${dateNote}${skipNote}${overlapNote}. Hoe wil je ze toevoegen?${excelNote}
    </div>
    <div class="import-actions">
      <button class="btn btn-small btn-ghost" onclick="cancelImport()">Annuleren</button>
      <button class="btn btn-small" onclick="confirmImport('merge')">Toevoegen aan bestaande</button>
      <button class="btn btn-small btn-primary" onclick="confirmImport('replace')">Vervang alles</button>
    </div>
  `;
  banner.classList.add('show');
}

function cancelImport() {
  state.pendingImport = null;
  document.getElementById('import-confirm').classList.remove('show');
}

function confirmImport(mode) {
  if (!state.pendingImport) return;
  const incoming = state.pendingImport;
  if (mode === 'replace') {
    state.products = incoming;
  } else {
    incoming.forEach(np => {
      const idx = state.products.findIndex(p => p.id === np.id);
      if (idx >= 0) state.products[idx] = np;
      else state.products.push(np);
    });
  }
  saveProducts();
  syncProductViews();
  state.pendingImport = null;
  document.getElementById('import-confirm').classList.remove('show');
  toast(`${incoming.length} producten geimporteerd`);
}

// ============================================================
// REFERENCE IMAGE UPLOAD (per category)
// ============================================================
const MAX_REFS_PER_CATEGORY = { product: 6, lifestyle: 4, usage: 4, packaging: 4 };

function handleRefUpload(e, category) {
  const files = Array.from(e.target.files);
  e.target.value = '';
  const current = state.pendingRefs[category] || [];
  const max = MAX_REFS_PER_CATEGORY[category] || 4;
  if (current.length + files.length > max) {
    toast(`Max ${max} foto's in ${category}-categorie`, true);
    return;
  }
  files.forEach(async (file) => {
    if (!file.type.startsWith('image/')) return;
    try {
      const compressed = await compressImage(file, 1024, 0.85);
      state.pendingRefs[category].push(compressed);
      renderRefGrid(category);
    } catch (err) {
      toast('Kon foto niet verwerken: ' + err.message, true);
    }
  });
}

function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Read failed'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image load failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round(width * maxSize / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function moveRef(fromCat, fromIndex, toCat, toIndex) {
  const src = state.pendingRefs[fromCat];
  if (!src || fromIndex < 0 || fromIndex >= src.length) return;
  if (!state.pendingRefs[toCat]) state.pendingRefs[toCat] = [];
  const item = src.splice(fromIndex, 1)[0];
  let insertAt = toIndex;
  if (fromCat === toCat && fromIndex < insertAt) insertAt -= 1;
  const dst = state.pendingRefs[toCat];
  if (insertAt < 0) insertAt = 0;
  if (insertAt > dst.length) insertAt = dst.length;
  dst.splice(insertAt, 0, item);
  renderRefGrid(fromCat);
  if (toCat !== fromCat) renderRefGrid(toCat);
}

function renderRefGrid(category) {
  const grid = document.getElementById('ref-grid-' + category);
  if (!grid) return;
  grid.innerHTML = '';
  (state.pendingRefs[category] || []).forEach((ref, i) => {
    const tile = document.createElement('div');
    tile.className = 'ref-tile';
    tile.style.backgroundImage = `url("${ref}")`;
    tile.setAttribute('draggable', 'true');
    tile.addEventListener('dragstart', (e) => {
      state._dragRef = { cat: category, index: i };
      tile.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'ref'); } catch (_) {}
    });
    tile.addEventListener('dragend', () => {
      tile.classList.remove('dragging');
      document.querySelectorAll('.ref-tile.drop-target').forEach(t => t.classList.remove('drop-target'));
      document.querySelectorAll('.ref-grid.drop-zone-active').forEach(g => g.classList.remove('drop-zone-active'));
      state._dragRef = null;
    });
    tile.addEventListener('dragover', (e) => { if (state._dragRef) { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (_) {} tile.classList.add('drop-target'); } });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
    tile.addEventListener('drop', (e) => {
      if (!state._dragRef) return;
      e.preventDefault(); e.stopPropagation();
      tile.classList.remove('drop-target');
      const d = state._dragRef; state._dragRef = null;
      moveRef(d.cat, d.index, category, i);
    });
    const badge = document.createElement('div');
    badge.className = 'ref-order-badge';
    badge.textContent = String(i + 1);
    tile.appendChild(badge);
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '×';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.pendingRefs[category].splice(i, 1);
      renderRefGrid(category);
    });
    tile.appendChild(btn);
    grid.appendChild(tile);
  });
  // Grid-niveau drop (slepen tussen categorieen of naar het einde), eenmalig binden per grid
  if (!grid.dataset.dndInit) {
    grid.dataset.dndInit = '1';
    grid.addEventListener('dragover', (e) => { if (state._dragRef) { e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (_) {} grid.classList.add('drop-zone-active'); } });
    grid.addEventListener('dragleave', (e) => { if (e.target === grid) grid.classList.remove('drop-zone-active'); });
    grid.addEventListener('drop', (e) => {
      if (!state._dragRef) return;
      e.preventDefault();
      grid.classList.remove('drop-zone-active');
      const d = state._dragRef; state._dragRef = null;
      moveRef(d.cat, d.index, category, (state.pendingRefs[category] || []).length);
    });
  }
}

// Drag and drop for refs per category
REF_CATEGORIES.forEach(cat => {
  const dz = document.getElementById('ref-dropzone-' + cat);
  if (!dz) return;
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    handleRefUpload({ target: { files, value: '' } }, cat);
  });
});

