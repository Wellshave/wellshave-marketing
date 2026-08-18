/* Static Ad Wizard — de foto waar de ad op gebouwd wordt.
 *
 * De wizard ging tot nu toe altijd uit van het product: hij beschrijft een
 * beeld en de generator tekent dat vanaf nul, met de referentiefoto's als
 * waarheid voor hoe het apparaat eruitziet.
 *
 * Voor een founder-ad klopt dat niet. Daar is het uitgangspunt een bestaande
 * foto -- de oprichter, een klant, een ruimte -- en is het product wat erin
 * gehouden wordt. Het verschil is niet cosmetisch: in het eerste geval bedenkt
 * de generator een mens, in het tweede staat er een mens die echt bestaat, en
 * dat is precies waar dit soort advertenties hun geloofwaardigheid vandaan
 * haalt.
 *
 * De beeldpijplijn kon dit al: state.basePhotos[i] wordt als eerste beeld
 * meegestuurd, met de instructie dat compositie en sfeer daaruit komen en het
 * product uit de referenties. Wat ontbrak was een manier om er in de wizard een
 * te kiezen. Dat is dit bestand.
 *
 * Twee bronnen, en de eerste is de belangrijkste: de foto's die de console al
 * heeft staan bij het product. Een founder-foto uploaden kan ook, maar wat er
 * al is hoort niet opnieuw geüpload te hoeven worden.
 *
 * TAAL: interface Engels, commentaren Nederlands.
 */

/* Alle foto's die de console kent voor dit product, met hun soort erbij. De
   volgorde is die van de bakken: product, gebruik, lifestyle, verpakking. */
function wizBeschikbareFotos() {
  var p = wizProduct();
  if (!p || typeof normalizeRefs !== 'function') return [];
  var n = normalizeRefs(p.references);
  var uit = [];
  [['product', 'Product'], ['usage', 'In use'], ['lifestyle', 'Lifestyle'], ['packaging', 'Packaging']]
    .forEach(function (bak) {
      (n[bak[0]] || []).forEach(function (src, i) {
        uit.push({ src: src, soort: bak[1], key: bak[0] + '-' + i });
      });
    });
  return uit;
}

/* Een referentiefoto als basis kiezen. We bewaren de bron zelf en niet alleen
   een verwijzing: referenties kunnen veranderen, en dan hoort de ad die je aan
   het bouwen bent niet stilletjes van uitgangspunt te wisselen. */
function wizKiesBasisFoto(key) {
  var f = wizBeschikbareFotos().filter(function (x) { return x.key === key; })[0];
  if (!f) return;
  var m = String(f.src).match(/^data:([^;]+);base64,(.+)$/);
  wizState.data.visual.basisFoto = m
    ? { b64: m[2], mimeType: m[1], naam: f.soort + ' reference', bron: 'library' }
    : { url: f.src, naam: f.soort + ' reference', bron: 'library' };
  wizState.source['visual.basisFoto'] = 'user';
  wizSave();
  wizRender();
}

function wizWisBasisFoto() {
  wizState.data.visual.basisFoto = null;
  delete wizState.source['visual.basisFoto'];
  wizSave();
  wizRender();
}

/* Een foto die nog niet in de console staat. Zelfde verwerking als het
   klassieke scherm, zodat er maar een manier is om een foto binnen te halen. */
function wizUploadBasisFoto(e) {
  var file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) { if (typeof toast === 'function') toast('Only images are supported', true); return; }
  if (file.size > 8 * 1024 * 1024) { if (typeof toast === 'function') toast('Photo too large, 8MB max', true); return; }
  if (typeof compressImage !== 'function') return;
  compressImage(file, 1536, 0.9).then(function (dataUrl) {
    var m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('unreadable image');
    wizState.data.visual.basisFoto = { b64: m[2], mimeType: m[1], naam: file.name, bron: 'upload' };
    wizState.source['visual.basisFoto'] = 'user';
    wizSave();
    wizRender();
    if (typeof toast === 'function') toast('This photo is now the foundation for the ad');
  }).catch(function (err) {
    if (typeof toast === 'function') toast('Could not read the photo: ' + err.message, true);
  });
}

/* De gekozen foto klaarzetten voor de beeldgenerator, voor elke variatie die
   gegenereerd gaat worden. Zonder deze stap kiest de wizard wel een foto maar
   gebeurt er niets mee. */
function wizZetBasisFotos(indexen) {
  var bf = wizState.data.visual.basisFoto;
  if (!state.basePhotos || typeof state.basePhotos !== 'object') state.basePhotos = {};
  (indexen || []).forEach(function (i) {
    if (bf && bf.b64) {
      state.basePhotos[i] = { b64: bf.b64, mimeType: bf.mimeType, fileName: bf.naam || 'base photo' };
    } else {
      delete state.basePhotos[i];
    }
  });
}

function wizBasisFotoSrc() {
  var bf = wizState.data.visual.basisFoto;
  if (!bf) return '';
  return bf.b64 ? ('data:' + (bf.mimeType || 'image/png') + ';base64,' + bf.b64) : (bf.url || '');
}

/* Het blok op de visuele stap. */
function wizRenderBasisFoto() {
  var bf = wizState.data.visual.basisFoto;
  var h = '<div class="wiz-veld wiz-basis"><label>Build on an existing photo</label>' +
    '<div class="wiz-basis-uitleg">By default the picture is drawn from nothing, with the ' +
    'product taken from its reference shots. Pick a photo here and the ad is built on that ' +
    'photo instead: its composition, its light, its person. The product still comes from the ' +
    'references. This is what a founder ad needs — a face that actually exists.</div>';

  if (bf) {
    h += '<div class="wiz-basis-gekozen">' +
      '<img class="wiz-basis-beeld" alt="" src="' + wizEsc(wizBasisFotoSrc()) + '">' +
      '<div class="wiz-basis-info"><div class="wiz-basis-naam">' + wizEsc(bf.naam || 'photo') + '</div>' +
      '<div class="wiz-basis-status">The ad will be built on this photo.</div></div>' +
      '<button type="button" class="wiz-btn ghost small" onclick="wizWisBasisFoto()">Build from scratch instead</button>' +
      '</div>';
    return h + '</div>';
  }

  var fotos = wizBeschikbareFotos();
  if (fotos.length) {
    h += '<div class="wiz-basis-raster">' + fotos.slice(0, 12).map(function (f) {
      return '<button type="button" class="wiz-basis-tegel" onclick="wizKiesBasisFoto(\'' + wizEsc(f.key) + '\')">' +
        '<img alt="" src="' + wizEsc(f.src) + '">' +
        '<span class="wiz-basis-soort">' + wizEsc(f.soort) + '</span></button>';
    }).join('') + '</div>';
  } else {
    h += '<div class="wiz-readout-none">This product has no reference photos in the console yet.</div>';
  }

  h += '<div class="wiz-basis-upload">' +
    '<input type="file" id="wiz-basis-in" accept="image/*" style="display:none" onchange="wizUploadBasisFoto(event)">' +
    '<button type="button" class="wiz-linkbtn" onclick="document.getElementById(\'wiz-basis-in\').click()">' +
    'or upload a photo that is not in the console yet</button></div>';
  return h + '</div>';
}

window.wizBeschikbareFotos = wizBeschikbareFotos; window.wizKiesBasisFoto = wizKiesBasisFoto;
window.wizWisBasisFoto = wizWisBasisFoto; window.wizUploadBasisFoto = wizUploadBasisFoto;
window.wizZetBasisFotos = wizZetBasisFotos; window.wizRenderBasisFoto = wizRenderBasisFoto;
window.wizBasisFotoSrc = wizBasisFotoSrc;
