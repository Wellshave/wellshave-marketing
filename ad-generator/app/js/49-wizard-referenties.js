/* Welke referentiebeelden deze ad gebruikt.
 *
 * De generator stuurde altijd al alle referentiefoto's van het product mee,
 * maar je zag er niets van: op stap 1 stond één foto, en welke beelden er
 * werkelijk de prompt in gingen bleef onzichtbaar tot je naar het resultaat
 * keek. Dat is de verkeerde volgorde -- het beeld is het halve werk, en je
 * hoort vóór het genereren te weten waar hij vandaan tekent.
 *
 * Twee dingen zitten hier dus in:
 *
 *   1. ALLES ZIEN EN KUNNEN UITZETTEN. Elke referentie van het product staat
 *      er, per bak, met de mogelijkheid er een uit te zetten. Uitzetten in
 *      plaats van aanzetten: voeg je later een foto aan het product toe, dan
 *      doet die vanzelf mee in plaats van stil te ontbreken.
 *
 *   2. ERBIJ SLEPEN. Een foto van de founder of van een model hoort niet in
 *      het productbestand -- dat gaat over het product. Maar voor deze ene ad
 *      wil je hem wel meesturen. Die foto's leven op de ad, niet op het
 *      product.
 *
 * De volgorde waarin ze de generator in gaan blijft van de generator: die
 * kent de formatmodus en weet dat productshots eerst horen als het product
 * accuraat moet zijn. Hier bepaal je WELKE, niet in welke volgorde.
 */

var WIZ_REF_BAKKEN = [
  { key: 'product',   label: 'Product shots',  hint: 'Waar het product zijn vorm en kleur vandaan haalt.' },
  { key: 'usage',     label: 'In gebruik',     hint: 'Hoe het vastgehouden en toegepast wordt.' },
  { key: 'lifestyle', label: 'Lifestyle',      hint: 'De sfeer en de omgeving.' },
  { key: 'packaging', label: 'Verpakking',     hint: 'Doos en label.' }
];

function wizRefSleutel(bak, i) { return bak + ':' + i; }

/* Alle referenties van het gekozen product, per bak, met of ze meedoen. */
function wizRefLijst() {
  var p = (typeof wizProduct === 'function') ? wizProduct() : null;
  if (!p || typeof normalizeRefs !== 'function') return [];
  var n = normalizeRefs(p.references);
  var uit = wizState.data.visual.refsUit || [];
  var lijst = [];
  WIZ_REF_BAKKEN.forEach(function (b) {
    (n[b.key] || []).forEach(function (src, i) {
      var sleutel = wizRefSleutel(b.key, i);
      lijst.push({ bak: b.key, bakLabel: b.label, index: i, src: src,
                   sleutel: sleutel, aan: uit.indexOf(sleutel) === -1 });
    });
  });
  return lijst;
}

/* Wat er werkelijk meegaat: de aangevinkte productreferenties plus de eigen
   foto's. Dit is de lijst waar de generator op hoort te draaien. */
function wizRefsInGebruik() {
  var uit = wizRefLijst().filter(function (r) { return r.aan; }).map(function (r) { return r.src; });
  return uit.concat(wizState.data.visual.extraRefs || []);
}

function wizRefToggle(sleutel) {
  var uit = (wizState.data.visual.refsUit || []).slice();
  var i = uit.indexOf(sleutel);
  if (i === -1) uit.push(sleutel); else uit.splice(i, 1);
  wizState.data.visual.refsUit = uit;
  wizSave();
  wizRender();
}

/* ── Eigen foto's erbij ─────────────────────────────────────────────────── */

var WIZ_REF_MAX_EXTRA = 6;

function wizRefVoegToe(dataUrls) {
  var huidig = (wizState.data.visual.extraRefs || []).slice();
  var ruimte = WIZ_REF_MAX_EXTRA - huidig.length;
  if (ruimte <= 0) {
    if (typeof toast === 'function') toast('Maximaal ' + WIZ_REF_MAX_EXTRA + ' eigen referenties', true);
    return;
  }
  var nieuw = dataUrls.filter(Boolean).slice(0, ruimte);
  if (!nieuw.length) return;
  wizState.data.visual.extraRefs = huidig.concat(nieuw);
  wizSave();
  wizRender();
  if (typeof toast === 'function') {
    toast(nieuw.length + ' referentie' + (nieuw.length === 1 ? '' : 's') + ' toegevoegd aan deze ad');
  }
}

function wizRefWis(i) {
  var lijst = (wizState.data.visual.extraRefs || []).slice();
  lijst.splice(i, 1);
  wizState.data.visual.extraRefs = lijst;
  wizSave();
  wizRender();
}

/* Bestanden naar data-urls. Geeft een belofte terug zodat een test erop kan
   wachten in plaats van op een timer te gokken. */
function wizRefLees(files) {
  var lijst = [].slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
  return Promise.all(lijst.map(function (f) {
    return new Promise(function (res) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { res(null); };
      r.readAsDataURL(f);
    });
  })).then(function (urls) { wizRefVoegToe(urls); return urls.filter(Boolean).length; });
}

function wizRefDrop(e) {
  e.preventDefault(); e.stopPropagation();
  var el = e.currentTarget; if (el) el.classList.remove('over');
  var dt = e.dataTransfer; if (!dt) return;
  wizRefLees(dt.files);
}
function wizRefOver(e) { e.preventDefault(); if (e.currentTarget) e.currentTarget.classList.add('over'); }
function wizRefUit(e) { if (e.currentTarget) e.currentTarget.classList.remove('over'); }
function wizRefKies(e) { wizRefLees(e.target.files); e.target.value = ''; }

/* ── Het paneel ─────────────────────────────────────────────────────────── */

function wizRenderReferenties() {
  var p = (typeof wizProduct === 'function') ? wizProduct() : null;
  if (!p) return '';
  var lijst = wizRefLijst();
  var extra = wizState.data.visual.extraRefs || [];
  var aan = lijst.filter(function (r) { return r.aan; }).length + extra.length;

  var h = '<div class="wiz-refs">' +
    '<div class="wiz-refs-kop">Reference images' +
    '<span class="wiz-refs-telling">' + aan + ' in use</span></div>' +
    '<p class="wiz-refs-uitleg">These are what the generator draws the product from. ' +
    'Switch one off to keep it out, or drop your own in, for instance the founder or a model.</p>';

  if (lijst.length) {
    WIZ_REF_BAKKEN.forEach(function (b) {
      var inBak = lijst.filter(function (r) { return r.bak === b.key; });
      if (!inBak.length) return;
      h += '<div class="wiz-refs-bak"><div class="wiz-refs-baknaam" title="' + wizEsc(b.hint) + '">' +
        wizEsc(b.label) + '</div><div class="wiz-refs-rij">' +
        inBak.map(function (r) {
          return '<button type="button" class="wiz-ref' + (r.aan ? ' aan' : '') + '" ' +
            'onclick="wizRefToggle(\'' + r.sleutel + '\')" ' +
            'title="' + (r.aan ? 'Laat deze weg' : 'Doe deze weer mee') + '">' +
            '<img src="' + wizEsc(r.src) + '" alt="">' +
            '<span class="wiz-ref-vink">' + (r.aan ? '✓' : '') + '</span></button>';
        }).join('') + '</div></div>';
    });
  } else {
    h += '<p class="wiz-refs-leeg">This product has no reference images yet. ' +
      'Add them in the Products tab, or drop one here for this ad only.</p>';
  }

  h += '<div class="wiz-refs-bak"><div class="wiz-refs-baknaam">Just for this ad</div>' +
    '<div class="wiz-refs-rij">' +
    extra.map(function (src, i) {
      return '<div class="wiz-ref aan eigen"><img src="' + wizEsc(src) + '" alt="">' +
        '<button type="button" class="wiz-ref-weg" onclick="wizRefWis(' + i + ')" ' +
        'aria-label="Verwijderen">×</button></div>';
    }).join('') +
    (extra.length < WIZ_REF_MAX_EXTRA
      ? '<label class="wiz-refdrop" ondrop="wizRefDrop(event)" ondragover="wizRefOver(event)" ' +
        'ondragleave="wizRefUit(event)">' +
        '<input type="file" accept="image/*" multiple onchange="wizRefKies(event)" hidden>' +
        '<span class="wiz-refdrop-plus">+</span>' +
        '<span class="wiz-refdrop-tekst">Drop a photo<br>or click</span></label>'
      : '') +
    '</div></div>';

  return h + '</div>';
}

window.WIZ_REF_BAKKEN = WIZ_REF_BAKKEN; window.wizRefLijst = wizRefLijst;
window.wizRefsInGebruik = wizRefsInGebruik; window.wizRefToggle = wizRefToggle;
window.wizRefVoegToe = wizRefVoegToe; window.wizRefWis = wizRefWis;
window.wizRefLees = wizRefLees; window.wizRefDrop = wizRefDrop;
window.wizRefOver = wizRefOver; window.wizRefUit = wizRefUit; window.wizRefKies = wizRefKies;
window.wizRenderReferenties = wizRenderReferenties; window.WIZ_REF_MAX_EXTRA = WIZ_REF_MAX_EXTRA;
window.wizRefSleutel = wizRefSleutel;
