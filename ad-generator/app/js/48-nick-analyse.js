/* De statische-ad-matrix vooraf invullen, en Nick laten kijken naar wat er
 * dan nog mist.
 *
 * De matrix stond leeg terwijl het systeem het meeste al wist. Dat is niet
 * alleen onhandig, het is de verkeerde volgorde: een scorekaart die je
 * achteraf met de hand moet overtypen uit je eigen briefing wordt niet
 * ingevuld, en dan staat er een leeg testlog terwijl de beslissingen wel
 * genomen zijn.
 *
 * Twee lagen, en het verschil ertussen is belangrijk:
 *
 *   1. AFLEIDEN. Hook, bewijs, avatar/verlangen en het anders-zijn staan al
 *      in de brief van deze creative. Die worden overgenomen, niet verzonnen.
 *      Een afgeleide waarde is grijs zolang niemand hem heeft aangeraakt, en
 *      wordt gewoon tekst zodra je hem zelf bijstelt.
 *
 *   2. OORDELEN. Het cijfer is geen veld dat ergens staat: dat is een oordeel
 *      tegen de acht eigenschappen van ads die spenden. Daar is de knop voor.
 *
 * En één veld blijft met opzet leeg: "notities / resultaat". Dat is wat er NA
 * de test gebeurde. Daar iets in schrijven zou een uitkomst verzinnen die er
 * nog niet is, en dat is precies het soort veld waar het systeem vanaf moet
 * blijven.
 */

/* Welke velden de matrix kent, en waar de afgeleide waarde vandaan komt.
   nietAfleiden = dit veld verzint het systeem nooit. */
var NICK_MATRIX = [
  { key: 'hook',           label: 'Hook' },
  { key: 'proof',          label: 'Proof / bewijs' },
  { key: 'avatar',         label: 'Avatar / Desire' },
  { key: 'purplecow',      label: 'Purple Cow' },
  { key: 'sophistication', label: 'Market sophistication' },
  { key: 'awareness',      label: 'Customer awareness' },
  { key: 'score',          label: 'Score (1-5)' },
  { key: 'notes',          label: 'Notities / resultaat', nietAfleiden: true }
];

/* Wat er uit de brief van deze creative te halen valt, zonder één woord te
   verzinnen. Geeft alleen sleutels terug waar werkelijk iets voor is. */
function nickAfgeleid(item) {
  item = item || {};
  var m = item.metadata || {}, v = item.variation || {};
  var b = m.wizardBrief || {};
  var strat = b.strategy || {}, pub = b.audience || {}, copy = b.copy || {};
  var uit = {};

  /* De hook van een static is de kop plus het beeld samen. De kop is wat er
     staat; het soort hook staat erbij als het bekend is. */
  var kop = v.headline_nl || copy.headline || '';
  if (kop) uit.hook = kop + (v.hook_label_nl ? ' (' + v.hook_label_nl + ')' : '');

  if (strat.proof) uit.proof = strat.proof;

  /* Avatar en verlangen horen in één vak: tegen wie praat je, en waar wil die
     persoon heen. Het uiteindelijke verlangen erbij, want daar zit de reden
     onder de reden. */
  var avatar = [];
  if (m.personaName) avatar.push(m.personaName);
  if (strat.desire) avatar.push(strat.desire);
  if (strat.ultimateDesire && strat.ultimateDesire !== strat.desire) {
    avatar.push('→ ' + strat.ultimateDesire);
  }
  if (avatar.length) uit.avatar = avatar.join(' · ');

  /* Purple Cow is de vraag waarom iemand JOU kiest en niet de ad ernaast.
     Dat is precies waar het differentiatieveld voor is; het mechanisme
     erachter maakt het controleerbaar in plaats van een compliment. */
  var anders = [];
  if (strat.differentiation && typeof wizDossierLabel === 'function') {
    anders.push(wizDossierLabel({ opts: 'WIZ_DIFFERENTIATION' }, strat.differentiation));
  }
  if (strat.mechanism) anders.push(strat.mechanism);
  if (anders.length) uit.purplecow = anders.join(' · ');

  var sof = pub.sophistication || m.sophistication;
  if (sof) uit.sophistication = String(sof);
  var aw = pub.awareness || m.awareness;
  if (aw) uit.awareness = String(aw);

  return uit;
}

/* De waarde die in het veld hoort te staan: wat de mens typte wint, anders
   het afgeleide, anders leeg. En of het afgeleid is, want dat mag je zien. */
function nickVeld(item, key) {
  var mat = (item && item.matrix) || {};
  if (mat[key] != null && String(mat[key]).trim() !== '') {
    return { waarde: String(mat[key]), afgeleid: false };
  }
  var af = nickAfgeleid(item);
  if (af[key]) return { waarde: af[key], afgeleid: true };
  return { waarde: '', afgeleid: false };
}

/* Wat er na het afleiden nog leeg is, en dus alleen met een oordeel te vullen.
   Het cijfer zit hier altijd bij zolang het leeg is: dat valt nergens uit af
   te leiden, het is een oordeel tegen de acht eigenschappen. Een cijfer dat
   iemand zelf gaf blijft staan.

   Het notitieveld telt niet mee: dat hoort leeg te blijven tot er een
   resultaat is. */
function nickGaten(item) {
  return NICK_MATRIX.filter(function (r) {
    if (r.nietAfleiden) return false;
    return !nickVeld(item, r.key).waarde;
  }).map(function (r) { return r.key; });
}

/* ── Nick laten kijken ──────────────────────────────────────────────────── */

var nickBezig = {};

function nickAnalyseer(id) {
  var item = ((typeof state !== 'undefined' && state.library) || []).filter(function (x) { return x.id === id; })[0];
  if (!item || nickBezig[id]) return Promise.resolve();
  if (typeof wizSleutelAanwezig === 'function' && !wizSleutelAanwezig()) {
    if (typeof toast === 'function') toast('Fill in your Anthropic API key first', true);
    return Promise.resolve();
  }
  nickBezig[id] = true;
  nickHertekenPaneel(id);

  var v = item.variation || {}, m = item.metadata || {};
  var af = nickAfgeleid(item);

  var sys = 'You are Nick Theriot, a direct-response media buyer who spends roughly $4M a month ' +
    'on Meta. You are filling in the scorecard for ONE static that already exists.\n' +
    'Two lines govern everything: it is almost never the media buying, it is the creative; and ' +
    'the secret to scaling is being different, because next to this ad sit the competitor ads, ' +
    'and if everyone says the same thing the buyer picks at random.\n' +
    '\nFill only the fields asked for, and keep each to one or two lines:\n' +
    '- hook: what actually stops the scroll here, text and image together.\n' +
    '- proof: what a sceptic can SEE in frame. If nothing is visible, say so plainly rather ' +
    'than describing an adjective as proof.\n' +
    '- avatar: the tribe being called out, and the desire being sold, functional then ultimate.\n' +
    '- purplecow: what makes this different from the other ads selling something similar. Name ' +
    'which lever: new mechanism, exaggerated execution, different avatar, different desire, or ' +
    'different creative style. If you cannot name one, say that: an ad that is not different ' +
    'is the recurring reason ads fail to spend.\n' +
    '- score: 1 to 5 against the eight traits of ads that spend (visual hook, large audience, ' +
    'intention behind every word, built to close alone, explains simply, it is different, ' +
    'relevant right now, not boring). Be honest; a flattering score helps nobody.\n' +
    '\nNever invent a result or a performance number: you are judging the creative, not ' +
    'reporting on a test that has not run.\n' +
    'Answer with strict JSON containing ONLY the keys you were asked to fill.';

  var opdracht = 'THE STATIC\n' +
    'Headline: ' + (v.headline_nl || '') + '\n' +
    (v.body_copy_nl ? 'Body: ' + v.body_copy_nl + '\n' : '') +
    (v.cta_nl ? 'CTA: ' + v.cta_nl + '\n' : '') +
    (v.visual_nl ? 'What the picture shows: ' + v.visual_nl + '\n' : '') +
    '\nWHAT IS ALREADY KNOWN (do not contradict this)\n' +
    (m.product ? 'Product: ' + m.product + '\n' : '') +
    (af.avatar ? 'Avatar and desire: ' + af.avatar + '\n' : '') +
    (af.proof ? 'Proof available: ' + af.proof + '\n' : '') +
    (af.purplecow ? 'Differentiation: ' + af.purplecow + '\n' : '') +
    (af.awareness ? 'Awareness stage: ' + af.awareness + '\n' : '') +
    (af.sophistication ? 'Sophistication stage: ' + af.sophistication + '\n' : '') +
    '\nFILL THESE KEYS: ' + nickGaten(item).join(', ') + '\n';

  return wizCall(sys, [{ role: 'user', content: opdracht }], 1400)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      item.matrix = item.matrix || {};
      var gezet = 0;
      nickGaten(item).forEach(function (k) {
        var w = o[k];
        if (w == null || String(w).trim() === '') return;
        item.matrix[k] = String(w).trim();
        gezet++;
      });
      /* Vastleggen dat dit Nicks oordeel was en niet iemands aantekening.
         Zonder dat onderscheid staat er over een maand een cijfer waarvan
         niemand meer weet of een mens ernaar gekeken heeft. */
      if (gezet) item.matrix._door = 'nick';
      try { saveLibrary(); } catch (e) {}
      if (typeof toast === 'function') {
        toast(gezet ? ('Nick vulde ' + gezet + ' veld' + (gezet === 1 ? '' : 'en') + ' in') : 'Nick had niets toe te voegen');
      }
    })
    .catch(function (err) {
      if (typeof toast === 'function') toast('Nick kon niet kijken: ' + err.message, true);
    })
    .finally(function () {
      nickBezig[id] = false;
      nickHertekenPaneel(id);
    });
}

/* Het paneel opnieuw tekenen zonder het te sluiten. De bibliotheekkaart
   hertekenen zou het paneel wegvagen; dit vervangt alleen de matrix erin. */
function nickHertekenPaneel(id) {
  var paneel = document.querySelector('.wg-drill-panel');
  if (!paneel) return;
  var oud = paneel.querySelector('.lib-matrix.open');
  if (!oud) return;
  var item = ((typeof state !== 'undefined' && state.library) || []).filter(function (x) { return x.id === id; })[0];
  if (!item) return;
  var houder = document.createElement('div');
  houder.innerHTML = libMatrixHtml(item.id, item.matrix || {}, item.metadata || {}, true);
  var nieuw = houder.firstChild;
  oud.parentNode.replaceChild(nieuw, oud);
  if (typeof libKoppelMatrix === 'function') libKoppelMatrix(nieuw);
}

window.NICK_MATRIX = NICK_MATRIX; window.nickAfgeleid = nickAfgeleid;
window.nickVeld = nickVeld; window.nickGaten = nickGaten;
window.nickAnalyseer = nickAnalyseer;
window.nickBezig = nickBezig; window.nickHertekenPaneel = nickHertekenPaneel;
