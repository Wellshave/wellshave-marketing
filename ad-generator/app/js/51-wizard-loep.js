/* Een beeld op ware grootte bekijken.
 *
 * De kaarten in de wizard zijn een paar honderd pixels breed, en daarop is
 * niet te beoordelen wat je moet beoordelen: staat de tekst binnen de veilige
 * marge, klopt het gezicht, is het bewijs werkelijk zichtbaar. Je zag pas iets
 * mis nadat de ad al ergens stond.
 *
 * Dus: klik op een beeld en het gaat open op schermgrootte. Niets meer dan
 * dat -- geen zoom, geen slepen, geen galerij. Wie een detail wil, downloadt
 * het beeld; dit is om te KIJKEN voordat je verder klikt.
 */

function wizLoepOpen(src, bijschrift) {
  if (!src) return;
  wizLoepDicht();
  var ov = document.createElement('div');
  ov.className = 'wiz-loep';
  ov.id = 'wiz-loep';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', bijschrift || 'Image at full size');
  ov.innerHTML = '<button type="button" class="wiz-loep-sluit" aria-label="Close">&times;</button>' +
    '<img src="' + String(src).replace(/"/g, '&quot;') + '" alt="">' +
    (bijschrift ? '<div class="wiz-loep-bij">' + wizEsc(bijschrift) + '</div>' : '');
  document.body.appendChild(ov);
  /* Klikken naast het beeld sluit. Op het beeld zelf niet: dan sluit je hem
     per ongeluk terwijl je juist aan het kijken bent. */
  ov.addEventListener('click', function (e) {
    if (e.target === ov || e.target.classList.contains('wiz-loep-sluit')) wizLoepDicht();
  });
  document.addEventListener('keydown', wizLoepToets);
  requestAnimationFrame(function () { ov.classList.add('open'); });
}

function wizLoepToets(e) { if (e.key === 'Escape') wizLoepDicht(); }

function wizLoepDicht() {
  var ov = document.getElementById('wiz-loep');
  if (ov) ov.remove();
  document.removeEventListener('keydown', wizLoepToets);
}

/* Uit een beeldvak de bron halen en openen. Werkt op elk vak dat een <img>
   bevat, dus zowel de conceptkaarten als de drie variaties. */
function wizLoepVanVak(vakId, bijschrift) {
  var vak = document.getElementById(vakId);
  var img = vak && vak.querySelector('img');
  if (!img || !img.src) return;
  wizLoepOpen(img.src, bijschrift);
}

/* Eén luisteraar op de wizard in plaats van een handler per beeld: de kaarten
   worden bij elke herteken opnieuw opgebouwd, en een vastgeklikte handler zit
   dan op een element dat er niet meer is. */
(function () {
  document.addEventListener('click', function (e) {
    var vak = e.target.closest && e.target.closest('.wiz-concept-preview, .wiz-final-preview');
    if (!vak) return;
    var img = vak.querySelector('img');
    if (!img) return;
    /* De conceptkaart is zelf een knop die het concept kiest. Op het beeld
       klikken hoort te vergroten, niet te kiezen -- anders kun je niet kijken
       zonder iets te veranderen. */
    e.preventDefault();
    e.stopPropagation();
    var kaart = vak.closest('.wiz-concept, .wiz-take');
    var kop = kaart && kaart.querySelector('.wiz-concept-h, .wiz-take-h');
    wizLoepOpen(img.src, kop ? kop.textContent.trim() : '');
  }, true);
})();

window.wizLoepOpen = wizLoepOpen; window.wizLoepDicht = wizLoepDicht;
window.wizLoepVanVak = wizLoepVanVak;
