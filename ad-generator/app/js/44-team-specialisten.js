/* ═══════════════════════════════════════════════════════════════════════════
   De twee specialisten op de teampagina

   Beslisvraag:

       "Wie beslist hier eigenlijk hoe een ad eruitziet, en waar houdt dat op?"

   Op de teampagina stonden ooit mensen en agents naast elkaar. Die agents zijn
   eruit, en terecht: het waren modellen die 's nachts iets deden en zich
   voordeden als een collega. Dit is niet dat.

   Rory en Nick zijn geen accounts en doen niets uit zichzelf. Ze zijn de twee
   werkwijzen waar dit systeem op draait: de een bepaalt wat er gemaakt wordt,
   de ander of het geld gaat opnemen. Ze staan op de teampagina omdat wie hier
   werkt moet kunnen zien wiens oordeel er in een scherm zit -- en waar dat
   oordeel ophoudt.

   Twee dingen houden deze pagina eerlijk:

   1. Wat hier staat is geen mening over zichzelf maar een verwijzing. Elke
      specialist noemt de velden die hij werkelijk stuurt, met het pad zoals de
      wizard het kent. Verdwijnt zo'n veld, dan valt de test om in plaats van
      dat deze pagina iets blijft beweren wat niet meer bestaat.

   2. Bij allebei staan de guardrails, en dat zijn de echte: wat ze niet doen,
      niet mogen beweren, en wanneer je de ander moet hebben. Een profiel
      zonder grenzen is reclame.
   ═══════════════════════════════════════════════════════════════════════════ */

var TEAM_SPECIALISTEN = [
  {
    id: 'rory',
    naam: 'Rory Sutherland',
    rol: 'Creatief atelier — diagnose, hoeken, afgewerkte creative',
    kern: 'Bepaalt WAT er gemaakt wordt. Stelt eerst de vraag opnieuw, dan pas '
        + 'het antwoord: is het product werkelijk tekort, of voelt het alleen zo? '
        + 'Dat tweede is een ander probleem en veel goedkoper op te lossen.',
    werkwijze: [
      'Diagnose vóór recept. Nooit een volledig antwoord op de eerste vraag: eerst '
      + 'wat er al geprobeerd is, wat de hele categorie al probeert, en wat de '
      + 'onuitgesproken reden is dat iemand dit koopt.',
      'Ideeën als testbare hypotheses, met het mechanisme erbij. Niet "verhoog de '
      + 'prijs" maar waaróm dat werkt, zodat je er slimmer van wordt in plaats van '
      + 'alleen geïnstrueerd.',
      'Altijd één tegendraadse optie erbij, juist omdat niemand anders die test.'
    ],
    /* Waar hij in dit systeem daadwerkelijk aan zit. De paden zijn die van de
       wizard; de test controleert dat ze echt bestaan. */
    stuurt: [
      { waar: 'Elke stap in de wizard', wat: 'Zijn aanbeveling met de redenering en de bronnen ernaast' },
      { waar: 'Stap 3 — Strategy', wat: 'De hoek, de kernboodschap en het mechanisme',
        velden: ['strategy.marketingAngle', 'strategy.messaging', 'strategy.mechanism'] },
      { waar: 'Stap 3 — Strategy', wat: 'Het verlangen op twee niveaus, en waarom het nú speelt',
        velden: ['strategy.desire', 'strategy.ultimateDesire', 'strategy.timing'] },
      { waar: 'Stap 6 — Copy', wat: 'De headline, en de regel die zegt wat er bewust níét op staat',
        velden: ['copy.headline', 'copy.removed'] },
      { waar: 'Het interview', wat: 'Het gesprek zelf en de blueprint aan het eind' }
    ],
    guardrails: [
      'Hypothesegenerator, geen orakel. Verwacht dat de meeste ideeën sneuvelen in de '
      + 'test, en zeg dat erbij in plaats van effecten te beloven.',
      'Een leeg veld is beter dan een verzonnen veld. Zonder bewijs uit het onderzoek '
      + 'vult hij een oordeelsveld niet in.',
      'Nooit nepschaarste, dark patterns of moeilijk opzegbare abonnementen. Vertrouwen '
      + 'groeit langzaam en valt in één keer om.',
      'Nooit moraliseren tegen de eigen klant.',
      'Niet reflexmatig tegen korting, wel tegen korting als vervanging van diagnose. '
      + 'Een goede aanbieding heeft een reden die de klant kan navertellen.',
      'Geen productieafdeling. Hij bedenkt de static, hij rendert hem niet.'
    ],
    wanneerDeAnder: 'Gaat de vraag over een advertentieaccount — waarom iets niet '
      + 'spendt, budgetten, schalen, platformmechaniek — dan is dat Nick.'
  },
  {
    id: 'nick',
    naam: 'Nick Theriot',
    rol: 'Media-inkoop en diagnose — spendt dit, en waarom niet',
    kern: 'Bepaalt of het geld gaat opnemen. Zijn uitgangspunt: het ligt bijna '
        + 'nooit aan de media-inkoop, het ligt aan de creative. De klant ziet de '
        + 'ad, niet het advertentieaccount.',
    werkwijze: [
      'Anders zijn is het hele spel. Staat jouw ad naast die van de concurrent en '
      + 'zegt iedereen hetzelfde, dan kiest de klant willekeurig, en een muntworp '
      + 'win je niet op schaal.',
      'Vastgelopen? Dan is de hoogste hefboom bijna nooit een nieuwe hook op dezelfde '
      + 'boodschap, maar een andere avatar, een ander verlangen, een ander mechanisme '
      + 'of een andere stijl.',
      'Laten in plaats van beweren. Een zichtbare demonstratie verslaat elk bijvoeglijk '
      + 'naamwoord.'
    ],
    stuurt: [
      { waar: 'Stap 2 — Audience', wat: 'Het sophistication-stadium: welk soort claim deze markt nog gelooft',
        velden: ['audience.sophistication'] },
      { waar: 'Stap 3 — Strategy', wat: 'Welke van de vijf manieren van anders-zijn deze hoek gebruikt',
        velden: ['strategy.differentiation'] },
      { waar: 'Stap 8 — Concepts', wat: 'De harde controles vóór je een generatie betaalt, en de acht eigenschappen van ads die spenden' },
      { waar: 'Stap 9 — Final', wat: 'Welke pass je draait: de visuele test of de hoekpass',
        velden: ['generate.pass'] },
      { waar: 'De headline-richtingen', wat: 'De achttien hookpatronen die op dit moment geld opnemen, gefilterd op bewustzijnsniveau' }
    ],
    guardrails: [
      'Overdrijven mag in het beeld, de framing en de specificiteit. Nooit in de claim '
      + 'over wat het product doet: dat is een rechtszaak die omzet terugvordert, geen winst.',
      'Nooit een directe concurrent structureel kopiëren. Structuren lenen uit andere '
      + 'branches mag; de concurrent nadoen garandeert dat je onder hem blijft.',
      'Niching down is de hefboom, te ver niching down doodt de schaal. Een prachtige '
      + 'hook voor vierhonderd mensen kan niet spenden.',
      'Nooit genereren uit de lijst met werkende patronen. Die lijst is om aan te toetsen; '
      + 'eruit putten levert precies het categoriegemiddelde.',
      'Als het geen advertentieprobleem is — geen uniek mechanisme, een kapotte site, een '
      + 'onhaalbare ROAS — dan zegt hij dat, in plaats van betere creative te beloven.'
    ],
    wanneerDeAnder: 'Moet er iets gemaakt of opnieuw bedacht worden voor Wellshave, dan '
      + 'is dat Rory. Zijn lens is een filter, en een filter draaien voordat er iets '
      + 'bedacht is levert het categoriegemiddelde op.'
  }
];

/* Welke kaart openstaat. Eén tegelijk: twee opengeklapte profielen naast elkaar
   lezen niemand, en dan is het weer een muur tekst. */
var _spec = { open: null };

function specToggle(id) {
  _spec.open = (_spec.open === id) ? null : id;
  teamTeken();
}

function specKaart(s) {
  var open = (_spec.open === s.id);
  var h = '<article class="team-kaart team-kaart--spec' + (open ? ' team-kaart--open' : '') + '">';

  h += '<header class="team-kop">'
    + '<div class="team-avatar team-avatar--spec">' + teamEsc(s.naam.charAt(0)) + '</div>'
    + '<div><h3 class="team-naam">' + teamEsc(s.naam) + '</h3>'
    + '<p class="team-rol">' + teamEsc(s.rol) + '</p></div></header>';

  h += '<p class="team-voorstellen">' + teamEsc(s.kern) + '</p>';

  if (!open) {
    h += '<button class="str-knop team-bewerk" onclick="specToggle(\'' + s.id + '\')">'
      + 'Werkwijze en grenzen</button>';
    return h + '</article>';
  }

  h += '<div class="spec-blok"><h4 class="spec-h">Hoe hij werkt</h4><ul class="spec-lijst">'
    + s.werkwijze.map(function (w) { return '<li>' + teamEsc(w) + '</li>'; }).join('')
    + '</ul></div>';

  h += '<div class="spec-blok"><h4 class="spec-h">Waar hij in dit systeem aan zit</h4>'
    + '<ul class="spec-lijst spec-stuurt">'
    + s.stuurt.map(function (p) {
        return '<li><span class="spec-waar">' + teamEsc(p.waar) + '</span>'
          + '<span class="spec-wat">' + teamEsc(p.wat) + '</span>'
          + ((p.velden || []).length
              ? '<span class="spec-velden">' + p.velden.map(teamEsc).join(' · ') + '</span>'
              : '')
          + '</li>';
      }).join('')
    + '</ul></div>';

  /* De grenzen staan onder de werkwijze en niet erboven: eerst wat hij doet,
     dan waar het ophoudt. Andersom lees je een waarschuwingsbord. */
  h += '<div class="spec-blok"><h4 class="spec-h">Guardrails</h4><ul class="spec-lijst spec-grens">'
    + s.guardrails.map(function (g) { return '<li>' + teamEsc(g) + '</li>'; }).join('')
    + '</ul></div>';

  h += '<p class="spec-ander">' + teamEsc(s.wanneerDeAnder) + '</p>';
  h += '<button class="str-knop team-bewerk" onclick="specToggle(\'' + s.id + '\')">Inklappen</button>';
  return h + '</article>';
}

function specSectie() {
  return '<section class="team-sectie team-sectie--spec">'
    + '<h2 class="team-h2">De twee die het vak bepalen</h2>'
    + '<p class="team-sectie-uitleg">Geen accounts en geen agents: ze doen niets uit '
    + 'zichzelf. Dit zijn de twee werkwijzen waar de ad-generator op draait. '
    + '<strong>Rory bepaalt wat er gemaakt wordt, Nick of het geld gaat opnemen.</strong> '
    + 'Die volgorde is niet vrijblijvend: een filter draaien voordat er iets bedacht is '
    + 'levert het categoriegemiddelde op.</p>'
    + '<div class="team-raster">'
    + TEAM_SPECIALISTEN.map(specKaart).join('')
    + '</div></section>';
}

window.TEAM_SPECIALISTEN = TEAM_SPECIALISTEN;
window.specToggle = specToggle; window.specSectie = specSectie; window.specKaart = specKaart;
