# Atelier Console — Informatiearchitectuur v1

*Vervolg op BLUEPRINT, DATAMODEL, USER-JOURNEYS en MIGRATIE-EN-ROADMAP.*
*Dit is de laag tussen product en interface: welke informatie staat waar, in welke hiërarchie, met welke navigatiepaden — nog geen visueel design, geen wireframes, geen componenten.*

---

## Deel A — Systeembrede principes

Deze regels gelden in alle vijf de werkruimtes; de werkruimte-hoofdstukken verwijzen ernaar.

### A1. Twee soorten plekken: werkruimtes en objectpagina's

De IA kent maar twee soorten bestemmingen:

1. **Vijf werkruimtes** — Vandaag, Studio, Testlab, Brein, Archief. Dit zijn *werkplekken*: je komt er om een soort werk te doen.
2. **Objectpagina's** — één Test, één Creative, één Persona, één Product, één Learning. Dit zijn *waarheidsplekken*: elke entiteit heeft exact één canonieke pagina, en iedereen die ernaar verwijst linkt dáárheen.

De belangrijkste consequentie: **de Test-detailpagina is de meest bezochte pagina van het systeem en hoort bij geen enkele werkruimte exclusief.** Vandaag, Studio, Testlab en Archief openen allemaal dezelfde testpagina. Er bestaan geen twee weergaven van dezelfde test met verschillende informatie — dat was precies de kwaal van de oude app (Library-item, Creative Strategy-rij en Iterate-scherm toonden drie halve waarheden over hetzelfde ding).

Routeschema (indicatief, voor de mentale kaart):

```
/vandaag                     /studio                    /testlab
/testlab/tests/{id}          ← de canonieke testpagina
/testlab/tests/{id}/creatives/{id}
/brein                       /brein/personas/{id}       /brein/producten/{id}
/brein/angles/{id}           /brein/learnings/{id}      /brein/formats/{id}
/archief                     /archief/assets/{id}
```

### A2. De permanente schil

Altijd zichtbaar, in deze prioriteitsvolgorde (conform blueprint §7):

1. **Merkcontext** — de actieve brand (Wellshave/Wellshine). Merk is een *omgevingsschakelaar*, geen filter: wisselen van merk wisselt álles (tests, brein, cijfers, AI-context). Nooit twee merken door elkaar in één lijst, met één uitzondering: een expliciete "beide merken"-stand in Vandaag voor de eigenaar (A), duidelijk gelabeld per regel.
2. **De vijf werkruimtes** als primaire navigatie, in loopvolgorde: Vandaag · Studio · Testlab · Brein · Archief.
3. **Besliscounter** — het aantal open beslissingen (verdicts + bevestigingswachtrij + gaten met hoge prioriteit), als badge op Vandaag. Dit is de enige notificatie-achtige indicator in de schil.
4. **Datagezondheid** — één stil indicatortje: laatste geslaagde Meta-ingest per gekoppeld account. Groen zegt niets; pas bij veroudering (>24u) wordt het zichtbaar aanwezig. Stale data die er vers uitziet is het gevaarlijkste scherm dat we kunnen bouwen.
5. **Zoeken** — één systeembrede zoekingang (zie A5).

Bewust níét in de schil: omzet, ROAS-totalen, spend. Cijfers zonder beslisvraag zijn decoratie (blueprint §7).

### A3. Waar de AI-specialisten wonen

Specialisten zijn **bewoners van plekken, geen bestemmingen**. Er is geen "AI-pagina", geen los chatscherm, geen specialist-picker. De regel per specialist:

| Specialist | Woont in | Verschijnt als |
|---|---|---|
| De Strateeg | Vandaag; Studio-stap 1–2; Brein (angles) | voorstellen met redenering + "scherp aan"-dialoog |
| De Maker | Studio-stap 3 | gegenereerde concepten/scripts + bijstuur-dialoog |
| De Copywriter | Studio-outputstap | copy-sets per variant |
| De Analist | Testlab; Vandaag (verdicts); testpagina | verdicts, funnel-diagnoses, iteratie- en learningvoorstellen |
| De Criticus | Studio pre-flight; video-briefing-goedkeuring | vlaggenlijst met ernst + redenering |

Twee interactievormen, systeembreed identiek: (1) **het voorstel** — kaart met conclusie, redenering, gebruikte data/learnings ("gebaseerd op…" is altijd uitklapbaar), en de acties overnemen/afwijken/uitstellen; (2) **de dialoog** — een doorvraaggesprek dat altijd aan een object hangt (deze test, deze hypothese, deze angle) en waarvan de uitkomst terug het object in vloeit. Een dialoog zonder object bestaat niet.

### A4. Lege toestanden (systeemregel, per werkruimte ingevuld)

Elke lege plek beantwoordt vijf vragen (uit de oorspronkelijke briefing): wat komt hier, waarom is het belangrijk, wanneer vult het zich, welke actie is nu nodig, en hoe leert de AI ervan. Lege toestanden zijn onderdeel van de IA — ze zijn de onboarding. Per werkruimte hieronder concreet ingevuld.

### A5. Zoeken en filteren

- **Eén systeemzoek** in de schil: zoekt over tests, creatives, personas, producten, learnings, assets — resultaat gegroepeerd per objecttype, altijd naar de canonieke pagina.
- **Filters zijn per werkruimte lokaal** en volgen overal dezelfde as-volgorde: status → product → persona → angle → format → tier → periode. Dezelfde as heet overal hetzelfde (geen "doelgroep" hier en "persona" daar).
- Opgeslagen filtercombinaties zijn persoonlijk, met twee gedeelde uitzonderingen in het Testlab ("besliswachtrij", "deze week live") die het systeem zelf definieert.

### A6. Rollen in de IA

Rollen verbergen geen informatie, ze begrenzen **acties**. Iedereen (behalve gast) ziet dezelfde waarheid; wat verschilt is welke knoppen er staan (M ziet "klaarzetten", niet "bevestigen") en wat Vandaag prioriteert (zie B1). Gast ziet Testlab, Brein en Archief read-only, en geen Vandaag (beslissingen zijn niet van hem).

### A7. Statussen zijn de taal van het systeem

De statuswoorden uit het datamodel (draft/ready/live/deciding/decided/archived; concept/in_review/approved/published; open/accepted/overridden) zijn de énige statuswoorden in de interface. Geen synoniemen, geen UI-eigen tussenstatussen. Elke lijst die objecten toont, toont ze primair gegroepeerd of gelabeld op deze statussen.

---

## Deel B — De werkruimtes

## B1. Vandaag — de beslisruimte

**Vraag die deze ruimte beantwoordt:** *"Wat verdient nú mijn beslissing, en waarom?"*
**Primaire gebruikers:** S, P, A — dagelijks, als eerste. M ziet een lichtere variant (zie rollen).

### Structuur (hiërarchie van boven naar beneden = urgentievolgorde)

1. **Kop: de dagcontext.** Merk(en), datum, datagezondheid, en één systeemzin die de dag samenvat ("3 verdicts, 1 bevestiging, 2 gaten — grootste geldimpact: [test]"). Geen begroetingstheater; de zin ís de inhoudsopgave.
2. **Zone 1 — Verdicts** (De Analist). De wachtrij uit Flow 1, gesorteerd op geldimpact (spend × afwijking), niet op datum. Per verdict-kaart: testnaam → voorstel → de twee of drie cijfers die het voorstel dragen → confidence → acties (overnemen / afwijken / uitstel-met-reden). Uitklappen toont de volledige redenering, snapshotreeks en familieboomcontext; doorklikken opent de canonieke testpagina. **Kill- en scale-voorstellen boven iterate en continue** — geld dat wegloopt gaat vóór kansen.
3. **Zone 2 — Wachtend op mensen.** Alles wat op een collega wacht: publicaties klaar voor bevestiging (Flow 3), video's te lang with_creator (Flow 10), draft-tests ouder dan X dagen (Flow 2, "half werk"), learningvoorstellen die openstaan. Gegroepeerd op *wie* er aan zet is; jouw eigen items eerst.
4. **Zone 3 — Gaten en kansen** (Recommendations). Top-N op verwachte impact, nooit de hele lijst (Flow 2). Per kaart: soort (gat/winner-zonder-iteratie/verwaarloosd persona/trend), rationale in één zin, en de acties accepteren (→ Studio, vooringevuld) / afwijzen-met-reden. HQ-trendbriefings landen hier als kind=trend zodra fase 6 loopt.
5. **Zone 4 — De week** (alleen maandag prominent, anders ingeklapt). Het weekbeeld van De Analist: besliste tests + hun learnings, dekkingsverschuiving, en de vraag "welke tests kiezen we deze week?" — het weekplanningsritueel uit de gebruikersflow (blueprint §6).

### Gedragsregels

- **Leeg = klaar.** Elke zone verdwijnt wanneer hij leeg is; een volledig lege Vandaag toont het klaar-bericht met de eerstvolgende geplande gebeurtenis ("vannacht 02:00 verse cijfers"). Dit is de enige lege toestand in het systeem die *feest* is in plaats van uitleg.
- **Niets blijft hier wonen.** Elke kaart is een beslissing; beslist = weg (naar het object waar de uitkomst leeft). Vandaag heeft geen geschiedenis — die staat in Testlab en Brein.
- **Rolvarianten.** S/P/A zien alles; M ziet alleen Zone 2-items waar hij zelf aan zet is plus zijn eigen draft-tests. De "beide merken"-stand bestaat alleen hier (A2).

### Lege toestand (vóór fase 1 compleet is / nieuw merk)

"Hier verschijnen elke ochtend de verdicts over je live tests en de gaten in je testdekking. Dat kan pas als (1) je Meta-account gekoppeld is [actie + status] en (2) er tests live zijn [→ Studio]. De Analist leert van elke beslissing die je hier neemt: volg je zijn voorstel, dan bouwt dat het vertrouwen op waarmee hij later meer mag."

---

## B2. Studio — de maakruimte

**Vraag:** *"Wat gaan we maken om deze hypothese te toetsen — en is het goed genoeg om geld op te zetten?"*
**Primaire gebruikers:** M, S — de maakblokken van de dag.

### Structuur: één flow met vijf ingangen, twee sporen, drie uitgangen

De Studio is geen scherm maar een **begeleide reeks van vier stappen**, waarvan de invulling per ingang en tier verschilt. De IA-regel: **de gebruiker ziet altijd waar hij is in de reeks** (A2-punt 4: hypothese → context → creatie → klaarzetten) en kan terug zonder werk te verliezen.

**De ingangenhal** (startscherm van de Studio):

1. Vijf ingangen, elk met hun startvraag: **Idee** (braindump-veld, direct beschrijfbaar), **Gat** (de geaccepteerde Recommendations die op uitvoering wachten), **Winner** (winnende tests zonder iteraties), **Concurrent** (upload), **Foto** (upload). Gat en Winner tonen hun wachtende items direct in de hal — de hal is dus ook een klein werkvoorraadje, gevoed door Vandaag.
2. **Doorwerken:** eigen tests in draft (de plek waar je gisteren stopte), eerst.
3. **Sandbox-deur** — bewust apart en kleiner, met het eigen sandboxlijstje en de vervaltermijn zichtbaar (Flow 9).

**Stap 1 — Hypothese** (De Strateeg). Quick tier: één regel + parent-verwijzing, klaar in seconden. Strategic tier: het aanscherpgesprek (de bestaande Rory-interviewflow leeft hier voort), met de learnings en angle-context zichtbaar die De Strateeg gebruikt. De tier-keuze is een expliciete schakelaar met uitleg van het verschil, default quick bij winner-iteratie en gat-met-payload, default strategic bij idee en concurrent.

**Stap 2 — Context.** Product, persona, angle, format, funnelfase, placement, aantal varianten. Vooringevuld waar de ingang dat toelaat (gat-payload, winner-erfenis, Strateeg-analyse); de gebruiker bevestigt of corrigeert. IA-regel: **context tonen als samenhangend geheel, niet als losse velden** — de persona-kaart toont zijn angles-met-status, het format toont zijn recept en winrate, zodat de keuze een geïnformeerde beslissing is en geen dropdown-plicht.

**Stap 3 — Creatie** (De Maker → De Copywriter). Concepten naast elkaar (hook/headline/body/CTA + redenering + hypothese-koppeling per concept), kiezen, beeld genereren, bewerken (de bestaande edit-stack, tot de port via de overbrugging), varianten beheren. Voor outputtype video: script (3×6×3) + shotlist + briefing-opbouw (Flow 10). Voor copy_set: de Copywriter-flow. Het outputtype is een keuze bínnen de stap, geen andere tool.

**Stap 4 — Klaarzetten** (De Criticus → Publication). Pre-flightrapport (vlaggen met ernst; override mogelijk maar gelogd), dan ad account/campagne/adset, naamconventie en UTM's (gegenereerd, controleerbaar), dan **klaarzetten** (M mag dit) en **bevestigen** (alleen `can_publish` — als die er nu niet is, gaat het item naar Vandaag Zone 2 van A/P). Vóór fase 4 eindigt deze stap in "klaar + download/checklist"; de IA is er alvast op gebouwd dat de download verdwijnt.

### Gedragsregels

- **Eén test tegelijk in beeld.** De Studio toont nooit een lijst van andermans werk; werkvoorraad hoort in de hal en in Vandaag, niet in de maakflow.
- **Alles wat de stap verlaat is opgeslagen.** Draft-tests zijn altijd herneembaar vanuit de hal; er bestaat geen "weg bij sluiten browser".
- **De sandbox slaat stap 1–2 over en kan stap 4 nooit bereiken** zonder promotie (Flow 9) — de promotieknop staat ín de sandbox-editor.

### Lege toestand (hal, nieuw merk)

"Hier maak je tests: van hypothese tot advertentie die klaarstaat in je ad account. Je kunt pas sterk starten als het Brein gevuld is — [n] producten en [n] persona's staan er nu in [→ Brein]. Begin met een Idee-ingang of laat De Strateeg de eerste gaten aanwijzen zodra er een product en persona zijn. Elke test die je hier maakt, leert het systeem wat werkt — de eerste tien zijn de leerzaamste."

---

## B3. Testlab — de waarheidsruimte

**Vraag:** *"Wat weten we — wat draait, wat is beslist, en waarom?"*
**Primaire gebruikers:** P, S, A dagelijks; M raadpleegt.

### Structuur: drie aanzichten op dezelfde tests + de canonieke testpagina

**Aanzicht 1 — Live** (default). Alle tests met status live/deciding, gesorteerd: deciding (met open verdict) boven, dan live op spend. Per rij: naam, tier, context-samenvatting (product·persona·angle·format), leeftijd, de kerncijfers van de laatste snapshot (spend, CPA of ROAS, hook rate bij video), verdictstatus. Rijen zijn dicht — dit aanzicht is een monitor, de diepte zit op de testpagina.

**Aanzicht 2 — Pijplijn.** Tests in draft/ready + creatives in review/approved + publicaties in bevestigingswachtrij + video's in productie-statussen: alles wat op weg is naar live, gegroepeerd op wat het nog nodig heeft. Dit vervangt de HQ-pijplijnkolommen voor de Console-scope.

**Aanzicht 3 — Beslist.** Afgeronde tests, default gegroepeerd per uitkomst (winner/kill/inconclusive), filterbaar op alle assen (A5). Elke rij toont zijn learning-éénregel. Dit is waar patroonvragen beantwoord worden ("alle kills op persona X van dit kwartaal").

**De canonieke testpagina** (A1) — de belangrijkste enkele pagina van het systeem, opgebouwd in vaste volgorde:

1. **Identiteit** — naam, status, tier, owner, merken van herkomst (ingang, bron-recommendation).
2. **Hypothese & uitkomst** — het statement, verwachte metric/richting, en (na afloop) confirmed/rejected/inconclusive. Bovenaan omdat het de leesbril voor al het onderstaande is.
3. **Context** — product, persona, angle (met doorklik naar hun canonieke pagina's), format, funnel/awareness/sophistication.
4. **Creatives & varianten** — de uitvoeringen met hun statussen, per variant de gevarieerde dimensie; doorklik naar creative-detail (met edit-historie en publicaties).
5. **Cijfers** — de snapshotreeks als verloop (dag-op-dag), met de funnel-lezing van De Analist (waar in de funnel het wint/lekt). Alleen de metrics die bij het outputtype horen (hook/hold alleen bij video).
6. **Verdicts & beslissingen** — de volledige audittrail: elk verdict, elke decision, wie, wanneer, gevolgd-of-afgeweken.
7. **Familie** — de boom: parent(s), siblings, children, met per knoop uitkomst-kleur en de gevarieerde dimensie op de tak. Van hieruit: "itereer" (→ Studio, winner-ingang).
8. **Learning** — de geoogste zin(nen), doorklikbaar naar het Brein.

Rolgedrag: dezelfde pagina voor iedereen; de actieknoppen (beslis, sluit af, itereer) volgen A6.

### Gedragsregels

- **Het Testlab schrijft nooit cijfers.** Cijfers komen uit de ingest; het handmatige noodluik (Flow 5-vangnet) markeert zijn rijen zichtbaar als source=manual.
- **Deciding is een magneet.** Tests met open verdict staan overal bovenaan tot er beslist is; het Testlab en Vandaag tonen daarin bewust hetzelfde (Vandaag is de wachtrij, het Testlab de context eromheen).
- **De besliswachtrij en "deze week live" zijn systeemfilters** (A5) — identiek voor iedereen, zodat "kijk even naar de wachtrij" altijd hetzelfde betekent.

### Lege toestand

"Hier leeft de waarheid over al je tests: wat draait, wat beslist is, en waarom. De eerste rij verschijnt zodra je in de Studio een test aanmaakt [→ Studio]. Zodra je Meta-account gekoppeld is, stromen de cijfers hier vanzelf binnen — niemand hoeft ooit nog cijfers over te typen. Elke beslissing die hier valt wordt een learning in het Brein: zo wordt het systeem elke week slimmer."

---

## B4. Brein — de kennisruimte

**Vraag:** *"Wat weten we over onze markt, merken, mensen en middelen — en waar zit ruimte?"*
**Primaire gebruikers:** S en A onderhouden; iedereen (incl. AI) raadpleegt. Nieuwe collega's beginnen hier.

### Structuur: vijf kamers + de dekkingskaart als voorportaal

**Voorportaal — de dekkingskaart.** De matrix product × persona (cellen: angle-dekking en teststatus, kleur = untested/testing/proven/disproven-mix), met de gaten-engine-output eroverheen. Dit is de landingsweergave van het Brein: één blik toont waar kennis dik en dun is. Doorklik op een cel → de betrokken angles.

**Kamer 1 — Persona's & Angles.** Master-detail zoals nu (dat werkte), met twee IA-wijzigingen: (1) angles zijn eigen objecten met eigen pagina — de persona-pagina toont ze per awareness-stadium mét status en laatste-test-datum; (2) elke angle-pagina toont zijn testhistorie, learnings en de twee acties "verrijk" (Strateeg-dialoog) en "test dit" (→ Studio, vooringevuld).

**Kamer 2 — Producten.** De catalogus zoals nu, plus per product: dekkingsregel (hoeveel angles/persona's getest), bewezen beste angles (afgeleid uit Decisions, niet handmatig), en de asset-verzameling (product/lifestyle/packaging, uit het Archief gefilterd).

**Kamer 3 — Learnings.** De doorzoekbare learning-verzameling, default gegroepeerd op scope (product/persona/angle/format/algemeen), met strength en evidence-links zichtbaar per learning. Acties: samenvoegen (dedupe), supersede, mute-voor-generatie (Flow 7), en "maak hypothese" (→ Hypothesis-backlog). Bovenaan: de vers-geoogste learnings van deze week — het Brein toont eerst wat net geleerd is.

**Kamer 4 — Formats.** De 42+ formats, per format: recept (zoals nu), funnel-fit, en de aangroeiende winrate met n ("winrate zonder n is een leugen" — n < 5 toont "te weinig data" in plaats van een percentage).

**Kamer 5 — Merk & team.** Merkprofiel (de prompt-brandstof, incl. brandbook-extractie), Meta-accountkoppelingen + ingest-status, team & rollen (de bestaande admin-flow), drempelconfiguratie voor verdicts. Compact — dit is de beheersectie uit je antwoord op vraag 5, geen werkruimte-in-de-werkruimte.

### Gedragsregels

- **Alles in het Brein toont zijn trackrecord of zegt eerlijk dat het er nog niet is.** Geen kennis zonder herkomst: handmatig ingevoerd, AI-verrijkt (gelogd), of test-bewezen — het label staat erbij.
- **Het Brein is de enige plek waar stamdata bewerkt wordt.** De Studio toont productinfo, maar bewerken gebeurt hier (één waarheid, A1).
- **Import/export (Excel/JSON) blijft**, als beheerfunctie in de betreffende kamer, niet als prominente actie.

### Lege toestand (per kamer, samengevat)

Persona's: "Dit wordt het psychologische fundament onder elke advertentie. Voeg je eerste persona toe of importeer je bestaande Excel [actie]. De Strateeg gebruikt elk veld — hoe rijker het profiel, hoe scherper de angles." Learnings: "Hier groeit het geheugen van je marketing. Learnings ontstaan vanzelf: elke test die je afsluit levert er één op [→ Testlab]. Vanaf de eerste learning gaan alle AI-specialisten hem meenemen in hun advies — dit is de plek waar je team slimmer wordt dan zijn geheugen."

---

## B5. Archief — de assetruimte

**Vraag:** *"Waar is dat ene beeld/script/creative — en mag ik het hergebruiken?"*
**Primaire gebruikers:** M vooral; iedereen incidenteel. Bewust de kleinste ruimte (blueprint §4.5).

### Structuur: twee verzamelingen, één zoeklogica

**Verzameling 1 — Creatives.** Alle creatives (statics, scripts, copy-sets, video's) over alle tests heen, als raster met per item: beeld/type, teststatus + uitkomst van zijn test (de context reist altijd mee — een creative zonder zijn testuitkomst tonen is desinformatie), en merk. Filters volgens A5. Doorklik → creative-detail → altijd één klik naar de canonieke testpagina.

**Verzameling 2 — Assets.** De media-bibliotheek: productfoto's, lifestyle, packaging, referenties, brandbooks, aangeleverde video's — op kind gefilterd, met herkomst en gebruik ("gebruikt in n creatives"). Upload gebeurt hier of in-context (Studio/Brein); het komt op dezelfde plek terecht.

### Gedragsregels

- **Het Archief heeft geen eigen acties behalve vinden, hergebruiken en opruimen.** "Hergebruik" = start in de Studio met dit item als ingang (foto-ingang voor assets, winner/variant-erfenis voor creatives). Er wordt hier niets gemaakt of beslist.
- **Verwijderen is archiveren.** Assets die in creatives gebruikt zijn kunnen niet hard weg; opruimen = uit zicht, herleidbaarheid blijft.
- **De sandbox-uitzondering:** sandbox-creatives staan er wel in, gelabeld, en verlopen automatisch (Flow 9) — het Archief toont hun vervaldatum.

### Lege toestand

"Alles wat je maakt en uploadt vind je hier terug — doorzoekbaar op product, persona, format en resultaat. Het vult zich vanzelf vanuit de Studio en het Brein. Tip: upload hier alvast je productfoto's en referentiebeelden [actie]; De Maker gebruikt ze bij elke generatie."

---

## Deel C — De verbindingen (hoe de ruimtes één systeem vormen)

De loop uit de blueprint, nu als concrete navigatiepaden — elk pad draagt zijn context mee (geen enkele overgang begint met een leeg formulier):

| Van | Naar | Draagt mee |
|---|---|---|
| Vandaag: verdict "iterate" overgenomen | Studio, winner-ingang | parent-test, Analist-dimensievoorstel |
| Vandaag: gat geaccepteerd | Studio, gat-ingang | recommendation-payload (context + kandidaat-hypotheses) |
| Vandaag: bevestiging | de Publication in kwestie | het pre-flightrapport erbij |
| Studio: klaargezet | Testlab-pijplijn | — (statusovergang, geen navigatie nodig) |
| Testlab: testpagina "itereer" | Studio, winner-ingang | test + familieboomkennis |
| Testlab: test afgesloten | learningvoorstel (in situ) → Brein | evidence-koppeling automatisch |
| Brein: angle "test dit" | Studio | persona+angle+stadium vooringevuld |
| Brein: learning "maak hypothese" | Hypothesis-backlog → Studio-hal (gat-lijst) | learning als rationale |
| Archief: "hergebruik" | Studio (foto- of variant-ingang) | asset/creative + zijn oorspronkelijke context |
| Overal: elk object-noemsel | de canonieke objectpagina | — |

**De terugkerende cirkelbeweging van een gemiddelde dag:** Vandaag (beslissen) → Studio (2–3 maakblokken) → Testlab (namiddagcheck pijplijn) → terug naar Vandaag morgenochtend. Brein en Archief zijn zijpaden vanuit die cirkel, geen stations erin — precies waarom het er vijf mogen zijn zonder dat de dagelijkse route langer wordt.

---

## Deel D — Wat deze IA bewust niet heeft

1. **Geen dashboardpagina.** Vandaag is een wachtrij, het Testlab een monitor; de vraag "hoe gaat het eigenlijk?" wordt beantwoord door het maandag-weekbeeld (B1 Zone 4) — niet door een permanente cijfermuur.
2. **Geen notificatiecentrum.** De besliscounter (A2) plus de "wachtend op mensen"-zone zijn de complete signaallaag. Een apart berichtenbakje wordt een tweede Vandaag die met de eerste concurreert.
3. **Geen instellingen-werkruimte.** Beheer woont in Brein-kamer 5; er is te weinig beheer om er een bestemming van te maken.
4. **Geen AI-chatpagina.** Elke dialoog hangt aan een object (A3). De verleiding komt terug — het antwoord blijft nee, want een vrije chat produceert uitkomsten die nergens landen, en alles wat nergens landt is verloren werk (de kernles van het oude systeem).
5. **Geen per-gebruiker-configureerbare startpagina's of modulaire widgets.** De urgentievolgorde van Vandaag ís de configuratie, en die is voor iedereen gelijk — beslissingen zijn geen kwestie van smaak.

---

*Volgende stap: per werkruimte de interactieprincipes en informatie-dichtheid vertalen naar wireframes — het eerste moment waarop we over schermen gaan praten. Daarna visueel design (en dan pas de shell-technologie uit migratiefase 0–1).*
