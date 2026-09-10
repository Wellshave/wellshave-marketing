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

/* De vier assen waarop Nick een static beoordeelt.
 *
 * Waarom vier en niet één cijfer: een enkel cijfer verbergt juist welke as
 * zwak is, en dat is het enige wat je eraan hebt. "Een 4" zegt niets over wat
 * je in de volgende ronde moet repareren; "bewijskracht gemiddeld, de rest
 * sterk" zegt precies waar je moet zijn. Het cijfer blijft bestaan als
 * optelsom, want dat is waarop je sorteert.
 *
 * De volgorde is niet willekeurig: strategie eerst, want een ad die op de
 * verkeerde as zit redt geen enkele uitvoering. */
var NICK_ASSEN = [
  { key: 'as_strategie', label: 'Strategie fit',
    vraag: 'Zit deze ad op de goede awareness en sophistication, en spreekt hij een publiek aan dat groot genoeg is om in te spenden?' },
  { key: 'as_executie', label: 'Creatieve executie',
    vraag: 'Breekt het beeld de scroll, en doet elk woord werk? Of is het netjes en daarmee onzichtbaar?' },
  { key: 'as_bewijs', label: 'Bewijskracht',
    vraag: 'Is het bewijs te ZIEN, of wordt het alleen beweerd? Een claim is gratis en leest als gratis.' },
  { key: 'as_test', label: 'Testpotentieel',
    vraag: 'Valt hier een batch omheen te bouwen, en leer je iets als hij wint of verliest?' }
];

/* De drie standen. Meer standen suggereren een precisie die er niet is. */
var NICK_STANDEN = ['zwak', 'gemiddeld', 'sterk'];

/* Een as normaliseren naar een van de drie. Een model dat "Sterk" of "high"
   antwoordt bedoelt hetzelfde; een model dat een heel verhaal antwoordt heeft
   de vraag niet begrepen en levert niets op. */
function nickStand(waarde) {
  var w = String(waarde == null ? '' : waarde).trim().toLowerCase();
  if (!w) return '';
  if (/^(sterk|strong|hoog|high|goed|good)\b/.test(w)) return 'sterk';
  if (/^(zwak|weak|laag|low|slecht|poor)\b/.test(w)) return 'zwak';
  if (/^(gemiddeld|medium|matig|average|redelijk|ok)\b/.test(w)) return 'gemiddeld';
  return '';
}

/* De as die er het slechtst voor staat, met de eis die daaruit volgt voor de
   landingspagina. Dit is het scharnier tussen het oordeel en de brief: zonder
   dit is een beoordeling een rapportcijfer, met dit is het een opdracht.
   Geeft null als er niets zwak is -- dan is er ook geen gat te dichten. */
var NICK_GAT_EIS = {
  as_bewijs: 'Het bewijs dat in de advertentie alleen beweerd wordt, hoort op deze pagina ' +
             'te ZIEN te zijn: de bron bij het getal, het resultaat in beeld, de review met ' +
             'een naam erbij. Dit is het punt waarop de creative zwak scoorde.',
  as_strategie: 'De advertentie zit op een andere trede dan zijn publiek. Deze pagina moet ' +
                'de tussenstap maken die de advertentie oversloeg, voordat er een product in beeld komt.',
  as_executie: 'De advertentie leunt op de pagina om af te maken wat het beeld niet zegt. ' +
               'Zet de belofte hier voluit, in de eerste twee zinnen.',
  as_test: 'Er valt weinig van deze creative te leren. Zet op deze pagina een meetpunt ' +
           'waar je een volgende ronde op kunt sturen.'
};

/* Een antwoord van het model omzetten naar iets dat in een veld past.
 *
 * Dit stond er niet, en het gevolg stond in de matrix: bij "Score (1-5)"
 * verscheen letterlijk [object Object]. Het model antwoordde met
 * {"waarde": 4, "reden": "..."} in plaats van met 4, en String() op een
 * object levert die tekst op. Geen fout, geen melding -- gewoon een veld met
 * onzin erin, dat er bovendien uitziet alsof er iets ingevuld is.
 *
 * Dus: een object wordt uitgepakt in plaats van platgeslagen, en het cijfer
 * moet een cijfer van 1 tot 5 zijn. Alles wat dat niet is wordt geweigerd --
 * leeg is zichtbaar, onzin ziet eruit als een oordeel en is het niet. */
function nickSchoon(sleutel, waarde) {
  var w = waarde;
  /* Een object: pak de meest voor de hand liggende sleutel eruit. Levert dat
     niets op, dan is het geen antwoord en wordt het niets. */
  if (w && typeof w === 'object' && !Array.isArray(w)) {
    w = w.waarde != null ? w.waarde
      : (w.value != null ? w.value
      : (w.score != null ? w.score
      : (w.text != null ? w.text : null)));
    if (w && typeof w === 'object') return '';
  }
  if (Array.isArray(w)) w = w.filter(Boolean).join(' , ');
  if (w == null) return '';
  var t = String(w).trim();
  if (!t || t === '[object Object]') return '';

  if (sleutel === 'score') {
    /* Uit "4/5" of "score: 4" wil je de 4. Uit "vier" wil je niets, want dan
       is er niet geantwoord op de vraag die gesteld is. */
    var m = t.match(/[1-5]/);
    return m ? m[0] : '';
  }
  return t;
}

function nickZwakstePunt(item) {
  item = item || {};
  var mat = item.matrix || {};
  var raak = null;
  NICK_ASSEN.forEach(function (a) {
    if (raak) return;
    var st = nickStand(mat[a.key]);
    if (st === 'zwak' || st === 'gemiddeld') raak = { as: a.key, label: a.label, stand: st };
  });
  if (!raak) return null;
  return { as: raak.as, label: raak.label, stand: raak.stand, eis: NICK_GAT_EIS[raak.as] };
}

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
    '\nFILL THESE KEYS: ' + nickGaten(item).join(', ') + '\n' +
    /* En de vier assen, altijd. Ze staan niet in de gaten omdat ze elke ronde
       opnieuw geveld worden: een creative die is aangepast verdient een nieuw
       oordeel en niet het oude. */
    'ALSO JUDGE THESE FOUR AXES. Answer each with exactly one word: zwak, ' +
    'gemiddeld or sterk. Nothing else -- not a sentence, not an object.\n' +
    NICK_ASSEN.map(function (a) { return '- ' + a.key + ' (' + a.label + '): ' + a.vraag; }).join('\n') + '\n' +
    'Be honest. Four times "sterk" helps nobody: name the weakest one even ' +
    'when the creative is good, because that is what the next round works on.\n';

  return wizCall(sys, [{ role: 'user', content: opdracht }], 1400)
    .then(function (data) {
      var o = wizParseJson(wizTextOf(data));
      item.matrix = item.matrix || {};
      var gezet = 0;
      nickGaten(item).forEach(function (k) {
        var w = nickSchoon(k, o[k]);
        if (w === '') return;
        item.matrix[k] = w;
        gezet++;
      });
      /* De assen staan los van de gaten: die worden elke ronde opnieuw
         geveld, ook als er al een oordeel stond. Een creative die je hebt
         aangepast verdient een nieuw oordeel en niet het oude. */
      NICK_ASSEN.forEach(function (a) {
        var st = nickStand(o[a.key]);
        if (!st) return;
        item.matrix[a.key] = st;
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
  var item = ((typeof state !== 'undefined' && state.library) || []).filter(function (x) { return x.id === id; })[0];
  if (!item) return;

  /* Het dossier: alles opnieuw, want Nick raakt meer dan de matrix. Hij velt
     ook de vier assen, en die staan bovenin naast de kerninformatie -- alleen
     het matrixblok vervangen zou het oordeel op het oude laten staan.
     Het open tabblad blijft staan: je stond ergens te kijken toen je op de
     knop drukte, en daar wil je weer uitkomen. */
  var inhoud = paneel.querySelector('.dos-inhoud');
  if (inhoud && typeof dosPaneelHtml === 'function') {
    var actief = (paneel.querySelector('.dos-tabs button[aria-selected="true"]') || {})
      .getAttribute ? paneel.querySelector('.dos-tabs button[aria-selected="true"]').getAttribute('data-tab') : 'overzicht';
    inhoud.innerHTML = dosPaneelHtml(item, actief || 'overzicht');
    if (typeof libKoppelMatrix === 'function') libKoppelMatrix(inhoud);
    if (typeof wgKoppelBlokken === 'function') wgKoppelBlokken(paneel);
    return;
  }

  /* En het oude paneel, voor het geval het dossier niet geladen is. */
  var oud = paneel.querySelector('.lib-matrix.open');
  if (!oud) return;
  var houder = document.createElement('div');
  houder.innerHTML = libMatrixHtml(item.id, item.matrix || {}, item.metadata || {}, true);
  var nw = houder.firstChild;
  oud.parentNode.replaceChild(nw, oud);
  if (typeof libKoppelMatrix === 'function') libKoppelMatrix(nw);
}

window.NICK_MATRIX = NICK_MATRIX; window.NICK_ASSEN = NICK_ASSEN;
window.NICK_STANDEN = NICK_STANDEN; window.nickStand = nickStand;
window.nickZwakstePunt = nickZwakstePunt; window.nickSchoon = nickSchoon; window.nickAfgeleid = nickAfgeleid;
window.nickVeld = nickVeld; window.nickGaten = nickGaten;
window.nickAnalyseer = nickAnalyseer;
window.nickBezig = nickBezig; window.nickHertekenPaneel = nickHertekenPaneel;
