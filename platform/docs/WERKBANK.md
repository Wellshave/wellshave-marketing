# Functioneel raamwerk — de Werkbank

Marketing HQ is geen agentsysteem dat losse taken uitvoert. Het is een team
waarin mensen en agents aan hetzelfde werkstuk werken. Dit document beschrijft
hoe dat werkt. Geen code, geen ontwerp — alleen gedrag.

Het centrale object blijft het werkstuk. Niet de agent, niet het teamlid, niet
de taak.

**Status:** voorstel, 1 augustus 2026. Wat er vandaag al staat is gemarkeerd
met ✅; de rest is nieuw.

---

## 0. Wat hier verandert aan wat er staat

Drie dingen in de huidige ruggengraat (0009) passen niet meer bij deze richting.
Ze staan hier vooraan omdat de rest erop leunt.

**Een mens is nu geen naam.** `werkstuk_stappen.agent_id` is leeg als een mens
de stap deed. De estafette kan daardoor wel zeggen "een agent deed dit" maar
niet "Dustin deed dit". Als mensen volwaardige deelnemers zijn, moet elke stap
zeggen wie hem deed — mens of agent, altijd bij naam.

**Een overdracht bestaat niet.** Een afgeronde stap legt vandaag alleen `waarom`
vast. Dat is een toelichting achteraf, geen overdracht. Wat de volgende moet
controleren staat nergens.

**Er is geen weg terug.** Een stap kan `mislukt` worden, maar niet
teruggestuurd. Er is geen manier om te zeggen: dit klopt niet, doe over, en dit
moet anders.

---

## 1. Hoe een handmatig werkstuk start

**Een teamlid levert één ding aan: de aanleiding.** Eén of twee zinnen over wat
hij zag, dacht of hoorde. Niet meer. De zeven vragen van de denkfase worden niet
vooraf ingevuld — dat is precies het werk dat samen gedaan wordt.

Wat het systeem er zelf bij zet:

| | |
|---|---|
| Herkomst | `mens`, met de naam van wie het startte |
| Station ① signaal | `niet_vastgelegd`, met de reden: *"handmatig gestart door Dustin — geen signaal uit de markt"* |
| Station ② briefing | `bezig`, de denkfase begint |

Station ① blijft zichtbaar in de keten, leeg en met een reden. Een lege stap is
informatie ✅ — hier zegt hij: dit idee komt niet uit data, dus het bewijs moet
elders vandaan komen.

**Een handmatig werkstuk kan station ③ niet bereiken zolang ② niet af is.** Dat
is geen procesafspraak maar een harde grens: het is de enige plek waar "niet
direct naar productie" afdwingbaar is.

**Een automatisch werkstuk doorloopt dezelfde denkfase.** Radar levert het
signaal, maar het antwoord op "waarom nu" en "welke hypothese" is niet
automatisch beter omdat er data onder ligt. Het verschil zit in wat er op tafel
ligt bij de start, niet in of de fase overgeslagen mag worden.

---

## 2. Hoe de denkfase werkt

De denkfase levert één object op: **het denkstuk**. Zeven velden, elk met een
antwoord, wie het voorstelde, en hoe zeker het is.

| # | Vraag | Wie stelt normaal voor |
|---|---|---|
| 1 | Wat is de marketingangle? | Nova, of het teamlid |
| 2 | Welk probleem of verlangen ligt eronder? | Nova, uit reviews en klantenservice |
| 3 | Voor welke persona is dit relevant? | Nova, tegen de personabibliotheek |
| 4 | Wat is de hypothese? | samen |
| 5 | Welk format past hierbij? | Pixel |
| 6 | Wat moet getest worden? | Bolt |
| 7 | Waarom is dit nu relevant? | Radar, of het teamlid |

**Vorm van de hypothese ligt vast:** *"als we X, dan Y, omdat Z"*. Zonder Z is
het een voorspelling en geen hypothese, en dan valt er achteraf niets te leren.

**Elk antwoord draagt een zekerheid.** Drie waarden, en ze betekenen iets:

- **onderbouwd** — er is eerder bewijs, en dat wordt erbij genoemd (zie §7)
- **aanname** — plausibel, niet getoetst; dit is wat de test moet uitwijzen
- **open** — we weten het niet, en dat blijft staan

Een denkstuk met alleen *onderbouwd* is verdacht: dan test je niets nieuws. Een
denkstuk met alleen *aanname* is ook verdacht: dan test je alles tegelijk en
leer je niets. Het systeem wijst daar op, maar blokkeert het niet — dat is een
oordeel van het team.

**De poort aan het eind.** Station ② gaat pas op `klaar` als:

1. alle zeven velden een antwoord hebben (*open* telt als antwoord, leeg niet)
2. de hypothese de vorm heeft
3. **een mens het denkstuk bevestigt** — bij naam

Punt 3 is de kern van "een handmatig werkstuk mag nooit direct naar productie".
Agents kunnen het denkstuk volledig invullen; ze kunnen het niet zelf aftekenen.

**Niet doen is een geldige uitkomst.** De denkfase kan eindigen in *stoppen*,
met de reden erbij. Zonder die uitgang wordt elk idee vanzelf een advertentie,
en dan is de denkfase een formaliteit geworden.

---

## 3. Hoe agents elkaar controleren

**Een agent begint zijn stap nooit met de output van de vorige, maar met de
overdracht.** Dat is een apart object met vijf verplichte velden:

| Veld | Wat erin staat |
|---|---|
| `besluit` | Wat de vorige agent heeft besloten. Eén zin. |
| `waarom` | Waarop dat besluit rust — met de bron erbij |
| `controleren` | Wat de volgende expliciet moet nakijken |
| `onzekerheden` | Wat nog openstaat, elk met blokkerend ja/nee |
| `mens_nodig` | Of hier een mens aan te pas moet komen, en waarom |

**Een stap kan niet op `klaar` zonder complete overdracht.** Dat is dezelfde
vorm als de bestaande regel dat een afgeronde stap een `waarom` moet hebben ✅ —
alleen strenger, want nu moet hij ook vooruit kijken.

**De ontvanger heeft drie mogelijke reacties, en stilzwijgend doorgaan is er
geen van:**

1. **aannemen** — hij heeft `controleren` nagelopen en tekent daarvoor
2. **terugsturen** — zie §6
3. **escaleren** — er is een blokkerende onzekerheid; het werkstuk wacht op een mens

**Een blokkerende onzekerheid maakt de overdracht automatisch een poort.** De
agent hoeft niet te besluiten of hij een mens nodig heeft; als hij zegt dat er
iets blokkerends openstaat, ís het een poort.

### De keten van controle

```
Nova     strategie        →  wat is de angle, voor wie, waarom nu
Pixel    beeld            →  controleert: past dit format bij deze persona
Quill    tekst            →  controleert: klopt de boodschap met de angle
Criticus kwaliteit        →  controleert: is dit consistent en goed genoeg
Bolt     inzetbaarheid    →  controleert: is dit testbaar in Meta
Atlas    resultaat        →  controleert achteraf: klopte de hypothese
```

**Over de Criticus.** Hij staat vandaag niet in het team — er zijn negen agents
en hij is er geen van. Ik stel voor hem toe te voegen, maar met een smalle rol,
en dit is waarom:

Elke agent controleert zijn voorganger. Dat werkt overal, behalve op één plek.
Tussen creatie en lancering heeft niemand er belang bij om nee te zeggen: Pixel
en Quill hebben het gemaakt, en Bolt wil testen. Daar is een partij nodig die
alleen maar kan afkeuren en niets te winnen heeft bij doorgaan.

De Criticus is dus geen tiende schakel die overal tussen komt, maar de eigenaar
van precies die ene overdracht. Overal elders is de controle een eigenschap van
de overdracht zelf, niet een aparte agent.

---

## 4. Hoe mensen deelnemen

**Mensen en agents zijn hetzelfde soort deelnemer.** Elke stap, elke overdracht
en elke gebeurtenis draagt een `door` met een naam. Nooit "een mens" in het
algemeen; altijd Dustin, of Nova.

De negen dingen die een teamlid kan, en wat ze in de keten doen:

| Handeling | Effect |
|---|---|
| Werkstuk starten | Nieuw werkstuk, station ① `niet_vastgelegd`, ② begint |
| Angle aanleveren | Antwoord op vraag 1 van het denkstuk, met zekerheid |
| Feedback geven | Gebeurtenis aan het werkstuk; verandert de keten niet |
| Briefing aanpassen | Wijziging op het denkstuk; oude waarde blijft leesbaar |
| Agent terugsturen | Zie §6 |
| Stap overnemen | De stap gaat van agent naar mens; de agent stopt |
| Goedkeuren | De poort gaat open, met naam en tijd |
| Publicatie bevestigen | Station ④ af; de advertentie draait echt |
| Learning vastleggen | Aan het werkstuk én aan de kennis (§7) |

**"Stap overnemen" is een volwaardige uitkomst en geen storing.** Als een mens
station ③ overneemt van Pixel, is dat hoe het vandaag al werkt ✅ — het hoort
zichtbaar te zijn als keuze, niet als het ontbreken van een agent.

**Feedback verandert de keten niet.** Dat is met opzet: anders wordt elke
opmerking een stap terug, en dan durft niemand meer iets te zeggen.

---

## 5. Hoe overdrachten worden vastgelegd

**Eén regel per overdracht, aangevuld en nooit overschreven.** De reeks is het
verslag; er is geen aparte "huidige stand" die kan afwijken van de geschiedenis.

Elke overdracht komt terecht in:

- **de estafette** — als de stap van het ene station naar het volgende
- **het brein** ✅ — als één regel in de stroom, tussen de handelingen en
  goedkeuringen door
- **de werkbank** ✅ — als het antwoord op "waar ligt het en op wie wacht het"

**Wat je op elk moment moet kunnen zien, en waar het vandaan komt:**

| Vraag | Bron |
|---|---|
| Waar kwam dit vandaan? | `aanleiding` + station ① ✅ |
| Wie hebben eraan gewerkt? | `door` op elke stap, mensen en agents door elkaar |
| Welke beslissingen zijn genomen? | `besluit` + `waarom` per overdracht |
| Waar ligt het nu? | station_nu ✅ |
| Waar wacht het op? | `wacht_op` ✅ — een naam of "jij" |
| Wat is de volgende stap? | het volgende station, met `controleren` erbij |
| Wat moet het worden? | het denkstuk: hypothese en wat getest wordt |

De laatste is nieuw en belangrijk. Vandaag kun je zien waar iets ligt, maar niet
waar het heen moet. Zonder dat is de estafette een status en geen route.

---

## 6. Hoe een werkstuk wordt teruggestuurd

**Terugsturen is geen ongedaan maken.** Het is een nieuwe stap die zegt: dit
klopt niet, en dit moet anders.

Wat er verplicht bij hoort:

1. **naar welk station** het teruggaat
2. **wat er mis is** — concreet, niet "voelt niet goed"
3. **wat er moet veranderen** om het wel te laten kloppen
4. **wie het terugstuurt** — mens of agent, bij naam

De keten laat het zien: station ③ was af, is teruggestuurd, staat weer open. De
teller gaat omlaag, de geschiedenis verdwijnt niet. Wie de keten leest ziet dat
dit stuk twee keer langs ③ is gegaan, en waarom.

**Twee keer terug op hetzelfde station en er moet een mens aan te pas komen.**
Zonder die grens kunnen twee agents elkaar eindeloos heen en weer sturen, elk
met een geldige reden, en staat het werkstuk stil terwijl het lijkt te bewegen.
Dezelfde gedachte als de stapelgrens op goedkeuringen ✅.

**Een teruggestuurd werkstuk is niet stil.** De werkbank telt het als lopend, op
het station waar het nu weer ligt — anders zou terugsturen een manier zijn om
werk uit het zicht te laten verdwijnen.

---

## 7. Hoe kennis uit eerdere tests wordt gebruikt

**Niet: de agent onthoudt.** Wel: bij elke stap krijgt de agent een dossier
mee, samengesteld uit wat er al gemeten is. Hij zoekt niet zelf; wat relevant is
wordt hem voorgelegd.

Wat er per station in het dossier zit:

| Station | Wat de agent meekrijgt |
|---|---|
| ② briefing | Wat deze hoek eerder deed bij deze persona ✅, reviews, klantenservice, welke hoeken uitgeput raken |
| ③ creatie | Winnaars en verliezers in dit format, hook rate en hold rate per opening ✅ |
| ④ live | De scorekaart van het account, de accountmediaan, wat er nu draait ✅ |
| ⑤ meting | De hypothese uit het denkstuk — daar wordt tegen gemeten, niet tegen een algemene norm |

**Drie regels die dit bruikbaar houden:**

**Een advies noemt waarop het rust.** Een aanbeveling zonder verwijzing naar een
eerdere test is een mening. Dat is dezelfde regel die het dagbesluit al volgt ✅:
elk oordeel zegt tegen welke mediaan het is afgezet.

**Kennis draagt zijn eigen betrouwbaarheid.** Hetzelfde onderscheid dat de
cijfers al maken ✅: onder drie soortgenoten is er geen oordeel, onder de
drempel is er geen vergelijking. Een dossier dat op één advertentie rust zegt
dat erbij, en de agent hoort dat door te geven als *aanname* en niet als
*onderbouwd*.

**Een learning is een besluit, geen notitie.** Als een test iets uitwijst, wordt
dat vastgelegd aan het werkstuk én aan de hoek — zodat het volgende denkstuk het
meekrijgt. Een learning die alleen in een rapport staat, leest niemand terug.

**De lus is pas rond als ⑤ terugkomt bij ②.** Atlas meet tegen de hypothese uit
het denkstuk; wat daaruit komt is de aanleiding voor het volgende werkstuk. Dat
is het verschil tussen een systeem dat advertenties maakt en een systeem dat
beter wordt in adverteren.

---

## Wat dit betekent voor de volgorde van bouwen

1. **Deelnemers bij naam** — mens of agent op elke stap. Alles hierna leunt erop.
2. **Het denkstuk** — zeven velden, de poort erachter, en "niet doen" als uitgang.
3. **De overdracht** — vijf velden, en een stap die niet af kan zonder.
4. **Terugsturen** — inclusief de grens van twee.
5. **Het dossier** — per station, uit tabellen die er al zijn.
6. **De Criticus** — pas als 3 er staat; zonder overdrachten heeft hij niets om
   op te oordelen.
