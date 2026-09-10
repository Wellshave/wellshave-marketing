/* De landingsbrief — wat er achter de klik hoort te staan, en de prompt om
 * die pagina te laten bouwen.
 *
 * Waarom dit bestaat: de bibliotheek bewaarde de advertentie en niets over de
 * pagina waar hij heen wijst. Dat is de helft van het resultaat. Het platform
 * leest de advertentie EN de pagina en beslist op allebei aan wie hij hem
 * laat zien; een krantenkop die op een packshot uitkomt is een tegenstrijdig
 * signaal, en dat kost bereik voordat het conversie kost.
 *
 * Wat deze laag doet, in drie stappen die uit elkaar te houden zijn:
 *
 *   1. HET SOORT PAGINA. Dat is geen smaak maar volgt uit awareness: hoe
 *      minder de lezer weet, hoe meer pagina er nodig is voordat een product
 *      logisch wordt. De bestemming staat al in de brief van de creative;
 *      staat hij er niet, dan wordt hij afgeleid uit awareness -- en is dat
 *      er ook niet, dan blijft het leeg. Een verzonnen bestemming is erger
 *      dan geen.
 *
 *   2. WAT ER OP MOET. Per soort een vaste ruggengraat, aangevuld met wat
 *      DEZE creative eist: zijn kop hoort er letterlijk terug te staan, zijn
 *      mechanisme moet uitgelegd, en het punt waarop Nick hem zwak vond hoort
 *      hier gerepareerd te worden. Dat laatste is het scharnier -- zonder dat
 *      is een beoordeling een rapportcijfer in plaats van een opdracht.
 *
 *   3. DE PROMPT. Alles daarvan in een tekst die je in Claude plakt. Niet een
 *      samenvatting van de brief maar de brief zelf, want een prompt die je
 *      nog moet aanvullen wordt niet gebruikt.
 *
 * TAAL: de brief die naar Claude gaat is Nederlands, want de pagina wordt
 * Nederlands. De labels in de interface zijn Engels noch Nederlands maar
 * volgen het paneel waarin ze staan -- de bibliotheek is Nederlands.
 */

/* ── Wat een soort pagina is ────────────────────────────────────────────── */

/* De ruggengraat per bestemming. WIZ_BESTEMMINGEN zegt WANNEER je hem kiest;
   dit zegt WAT erop komt. Twee lijsten omdat het twee vragen zijn, en omdat
   de wizard de eerste al gebruikt op een moment dat de tweede niet bestaat. */
var LP_SOORTEN = {
  advertorial: {
    label: 'Advertorial',
    kern: 'Leest als een artikel: wat ze probeerden, waarom dat niet werkte, en dan het mechanisme.',
    waarom: 'Deze lezer kent het probleem nog niet, of kent het maar geen oplossing. Hij heeft de ' +
            'diagnose nodig voordat een product iets betekent; een productpagina slaat dan de helft ' +
            'van het verhaal over.',
    ruggengraat: [
      'Artikelkop: exact de kop van de advertentie. Niet herschrijven -- de lezer moet zien dat hij goed geklikt heeft.',
      'Auteursregel met een echte naam en een datum, daaronder een dunne lijn.',
      'Open met het probleem zoals de lezer het zelf zou omschrijven, niet met het product.',
      'Wat ze eerder probeerden en waarom dat niet hielp. Dit is het deel dat vertrouwen wint.',
      'Dan pas het mechanisme: waarom dit wel werkt. Het product komt hier in beeld, niet eerder.',
      'Sluit af met de garantie en een enkele call to action.'
    ]
  },
  listicle: {
    label: 'Listicle',
    kern: '"N redenen waarom". Jij bepaalt welke punten landen voordat de productpagina komt.',
    waarom: 'Deze lezer kent de soorten oplossingen maar jou nog niet. Hier kun je de USP\'s en de ' +
            'vergelijking met de rest in de volgorde zetten die je zelf wilt, en dat is precies wat ' +
            'hij nog nodig heeft.',
    ruggengraat: [
      'Kop met een getal erin, en dat getal klopt met het aantal punten eronder.',
      'Een korte inleiding van twee zinnen: voor wie dit is en waarom nu.',
      'Elk punt een eigen tussenkop, in de volgorde waarin ze overtuigen -- niet in de volgorde waarin ze bij je opkwamen.',
      'Het sterkste punt op drie, niet op een: nummer een wordt gescand, nummer drie wordt gelezen.',
      'Een us-versus-them vergelijking waar de lezer die zelf zou maken.',
      'Een call to action na het laatste punt, en een halverwege voor wie al overtuigd is.'
    ]
  },
  quiz: {
    label: 'Quiz funnel',
    kern: 'De lezer diagnosticeert zichzelf. Het product beantwoordt zijn eigen conclusie.',
    waarom: 'De advertentie plant het probleem, de quiz laat hem het in zijn eigen woorden ' +
            'bevestigen, en het product landt als antwoord op een diagnose die hij zojuist zelf ' +
            'heeft gesteld.',
    ruggengraat: [
      'Openingsvraag die het probleem bevestigt zonder het te noemen.',
      'Drie tot vijf vragen, elk met antwoorden in de woorden van de lezer.',
      'Geen vraag die alleen gegevens verzamelt: elke vraag moet iets voor hem betekenen.',
      'De uitslag benoemt zijn situatie voordat er een product in beeld komt.',
      'Het product landt als antwoord op de diagnose die hij zojuist zelf gaf.',
      'E-mailadres pas na de uitslag, niet ervoor.'
    ]
  },
  pdp: {
    label: 'Productpagina',
    kern: 'Rechtstreeks het product. Voor verkeer dat al verkocht is.',
    waarom: 'Wie het merk kent en op een reden zit te wachten, heeft geen artikel meer in de weg ' +
            'nodig. Elke tussenstap is hier een afslag waar hij af kan.',
    ruggengraat: [
      'Bovenaan hetzelfde beeld en dezelfde belofte als in de advertentie.',
      'De prijs en het aanbod boven de vouw. Wie hier komt is er klaar voor.',
      'Drie koopredenen, elk met bewijs in plaats van een bijvoeglijk naamwoord.',
      'Het belangrijkste bezwaar direct beantwoord, niet onderaan in een FAQ.',
      'Reviews met een naam en een detail, geen sterrengemiddelde.',
      'Een call to action, herhaald, altijd dezelfde woorden.'
    ]
  }
};

/* ── Welk soort pagina hoort hierbij ────────────────────────────────────── */

/* Eerst wat er bij het bewaren is vastgelegd, dan wat uit awareness volgt.
   Geeft null als er geen van beide is: leeg is een geldige uitkomst en een
   verzonnen bestemming is er geen. */
function lpSoort(item) {
  item = item || {};
  var m = item.metadata || {}, b = m.wizardBrief || {};
  var gekozen = (b.strategy && b.strategy.destination) || m.destination || '';
  if (gekozen && LP_SOORTEN[gekozen]) return { soort: gekozen, afgeleid: false };

  var aw = (b.audience && b.audience.awareness) || m.awareness || '';
  if (!aw) return null;
  if (typeof WIZ_BESTEMMINGEN === 'undefined') return null;
  var passend = WIZ_BESTEMMINGEN.filter(function (x) { return x.past.indexOf(aw) !== -1; })[0];
  if (!passend || !LP_SOORTEN[passend.value]) return null;
  return { soort: passend.value, afgeleid: true };
}

/* Waarom die pagina bij dit publiek hoort.
   Dit staat hier in het Nederlands en niet in WIZ_BESTEMMINGEN, en dat is een
   taalgrens en geen dubbeling: de wizard spreekt Engels tegen de gebruiker
   (dat is de afspraak voor het nieuwe systeem), maar deze tekst gaat als
   onderdeel van een Nederlandse brief naar een model dat een Nederlandse
   pagina moet bouwen. Een Engelse alinea middenin die brief is precies het
   soort naad dat in de uitvoer terugkomt.
   De redenering moet wel dezelfde zijn; de test bewaakt dat elk van de vier
   bestemmingen er hier een heeft. */
function lpWaarom(item) {
  var s = lpSoort(item);
  if (!s) return '';
  var soort = LP_SOORTEN[s.soort];
  return (soort && soort.waarom) || '';
}

/* ── Wat er op deze pagina moet staan ───────────────────────────────────── */

/* De ruggengraat van het soort, plus wat DEZE creative eist. Elke regel weet
   of hij een gat dicht: dat is wat een beoordeling van een rapportcijfer een
   opdracht maakt. */
function lpEisen(item) {
  item = item || {};
  var s = lpSoort(item);
  if (!s) return [];
  var v = item.variation || {}, m = item.metadata || {}, b = m.wizardBrief || {};
  var strat = b.strategy || {};
  var uit = [];

  /* De kop eerst en apart: die is van deze advertentie en niet van het soort.
     Een lezer die zijn eigen kop niet terugziet denkt dat hij verkeerd
     geklikt heeft, en dat is de duurste seconde in de hele keten. */
  var kop = v.headline_nl || (b.copy && b.copy.headline) || '';
  if (kop) {
    uit.push({ tekst: 'De kop van de advertentie letterlijk terug: "' + kop +
      '". Anders denkt de lezer dat hij verkeerd geklikt heeft.', gat: false });
  }

  LP_SOORTEN[s.soort].ruggengraat.forEach(function (r) {
    /* De artikelkop staat al hierboven, met de echte kop erin. */
    if (/Artikelkop|hetzelfde beeld en dezelfde belofte/.test(r)) return;
    uit.push({ tekst: r, gat: false });
  });

  if (strat.mechanism) {
    uit.push({ tekst: 'Het mechanisme uitgelegd: ' + strat.mechanism +
      '. Vanaf sophistication 3 is dat het enige wat een uitgekeken markt nog gelooft.', gat: false });
  }
  if (strat.objection) {
    uit.push({ tekst: 'Het bezwaar dat je wegneemt: ' + strat.objection + '.', gat: false });
  }

  /* En het gat. Dit is het scharnier tussen de beoordeling en de pagina: het
     punt waarop deze creative zwak scoorde hoort hier gerepareerd te worden,
     niet nog eens genoteerd. */
  var zwak = (typeof nickZwakstePunt === 'function') ? nickZwakstePunt(item) : null;
  if (zwak) uit.push({ tekst: zwak.eis, gat: true });

  uit.push({ tekst: 'Afzender: het merk onder eigen naam, op het eigen domein. ' +
    'Geen verzonnen magazine, keurmerk of testpanel.', gat: false });
  return uit;
}

/* ── De prompt ──────────────────────────────────────────────────────────── */

/* Alles bij elkaar in een tekst die je plakt en verstuurt. Geen samenvatting:
   een prompt die je nog moet aanvullen wordt niet gebruikt, en dan vult
   iemand hem aan uit zijn hoofd en staat er iets anders op de pagina dan in
   de advertentie. */
function lpPrompt(item) {
  item = item || {};
  var s = lpSoort(item);
  if (!s) return '';
  var v = item.variation || {}, m = item.metadata || {}, b = m.wizardBrief || {};
  var strat = b.strategy || {}, pub = b.audience || {};
  var soort = LP_SOORTEN[s.soort];
  var merk = m.brand || 'Wellshave';
  var r = [];

  r.push('Bouw een ' + soort.label.toLowerCase() + '-landingspagina voor ' + merk + '.');
  r.push('');
  r.push('DE ADVERTENTIE DIE HIERHEEN LEIDT');
  if (v.headline_nl) r.push('Kop: "' + v.headline_nl + '"');
  if (v.body_copy_nl) r.push('Body: ' + v.body_copy_nl);
  if (v.cta_nl) r.push('Knop: ' + v.cta_nl);
  if (v.visual_nl) r.push('Beeld: ' + v.visual_nl);
  if (m.product) r.push('Product: ' + m.product);
  if (m.funnel) r.push('Funnel: ' + m.funnel);
  if (pub.awareness || m.awareness) r.push('Awareness: ' + (pub.awareness || m.awareness));
  if (pub.sophistication || m.sophistication) r.push('Sophistication: ' + (pub.sophistication || m.sophistication));
  if (strat.marketingAngle) r.push('Marketing angle: ' + strat.marketingAngle);
  if (strat.messaging) r.push('Kernboodschap: ' + strat.messaging);
  if (strat.desire) r.push('Verlangen: ' + strat.desire);
  if (strat.pain) r.push('Pijn: ' + strat.pain);

  var waarom = lpWaarom(item);
  if (waarom) {
    r.push('');
    r.push('WAAROM DIT SOORT PAGINA EN GEEN ANDER');
    r.push(waarom);
    r.push('Het platform leest de advertentie en de pagina samen en beslist op ' +
           'allebei aan wie hij hem laat zien. Een pagina die een ander verhaal ' +
           'vertelt dan de advertentie kost bereik voordat het conversie kost.');
  }

  r.push('');
  r.push('DE PAGINA');
  var eisen = lpEisen(item), gaten = [];
  var n = 0;
  eisen.forEach(function (e) {
    if (e.gat) { gaten.push(e.tekst); return; }
    n++;
    r.push(n + '. ' + e.tekst);
  });

  if (gaten.length) {
    r.push('');
    r.push('HET GAT DAT DEZE PAGINA MOET DICHTEN');
    gaten.forEach(function (g) { r.push(g); });
  }

  r.push('');
  r.push('WAT ER NIET OP MAG');
  r.push('- Een verzonnen magazine, keurmerk of testpanel. Afzender is ' + merk +
         ', onder eigen naam, op het eigen domein.');
  r.push('- Superlatieven waar een specifiek getal kan staan.');
  r.push('- Een getal of claim die je niet kunt onderbouwen. De bewijslast ligt bij de adverteerder.');
  r.push('- Meer dan een call to action boven de vouw.');
  if (b.product && b.product.forbidden) r.push('- ' + b.product.forbidden);

  r.push('');
  r.push('TOON');
  r.push('Nederlands, zoals het merk zelf praat. Korte zinnen. Geen marketingtaal.');
  r.push('');
  r.push('TECHNISCH');
  r.push('Een HTML-bestand, mobiel eerst, geen externe afhankelijkheden.');
  return r.join('\n');
}

window.LP_SOORTEN = LP_SOORTEN;
window.lpSoort = lpSoort; window.lpWaarom = lpWaarom;
window.lpEisen = lpEisen; window.lpPrompt = lpPrompt;
