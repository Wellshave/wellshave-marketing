# Atelier Console — Product Blueprint v1

*Head of Product / Principal UX Architect — juli 2026*
*Geen code. Geen wireframes. Eerst het product.*

---

## 0. Hoe dit document tot stand kwam

Voordat ik ook maar één woord visie schreef, heb ik de volledige huidige applicatie geïnventariseerd: alle 15 tabs van de Console, de datamodellen in Supabase, alle ~25 AI-aanroepen, de Marketing HQ/Pulse-kant, de designhandoff, de 188 changelog-entries en de gedocumenteerde teruggedraaide experimenten. Dit document is dus geen abstracte theorie — elke keuze hieronder is onderbouwd met wat er vandaag wél en níét werkt.

---

## 1. De diagnose: waarom iedere UI-iteratie een plafond raakte

Je briefing zegt: "De UI was nooit het echte probleem." Dat klopt, en ik kan nu precies aanwijzen waaróm.

**Atelier Console is vandaag een productietool, geen besturingssysteem.** De kernloop van de gebruiker is: invoer → genereren → beeld bewerken → PNG downloaden → klaar. Dat deel werkt goed. Maar een Creative Operating System is geen productielijn — het is een **beslisloop**: signaal → beslissing → creatie → publicatie → meting → learning → volgend signaal.

Die loop is in de huidige applicatie aan **beide uiteinden doorgeknipt**:

1. **Niets verlaat de tool.** Er is geen publicatiepad naar Meta. De output is een gedownloade PNG en copy op het klembord. De laatste kilometer is handwerk buiten het systeem.
2. **Niets komt automatisch terug.** Alle performance-data wordt met de hand ingetypt of uit screenshots geëxtraheerd. Het enige geautomatiseerde bruggetje dat bestaat — de dagelijkse Rory Meta-check die verdicts naar `rory_recommendations` schrijft — heeft in de app **geen enkele lezer**. De AI-collega bestaat al, maar hij praat tegen een tabel die niemand opent.
3. **De twee systemen praten niet met elkaar.** Marketing HQ produceert hypotheses, pipeline-items en rapporten; de Console produceert creatives en testresultaten. Er loopt geen enkele draad tussen die twee Supabase-projecten.
4. **De Creative Strategy-tabel — het potentiële hart — is manual-in, manual-out.** Alles na "To Test" is handwerk: live zetten, cijfers invullen, Winner/Killed markeren.

Zolang dit zo is, kán geen enkele pagina als "intelligente werkruimte" voelen. Een werkruimte voelt intelligent wanneer hij dingen wéét die jij nog niet wist. Een formulier zonder inkomende data blijft een formulier, hoe mooi je het ook maakt. **De UI-plafonds van de afgelopen weken waren een symptoom van een dataloop-probleem.**

Dit is meteen mijn belangrijkste afwijking van je briefing: de eerste ontwerpvraag is niet "welke workspaces bestaan er?", maar **"hoe sluiten we de loop?"** De workspaces volgen daaruit.

---

## 2. Visie

### Wat Atelier Console is

> **Atelier Console is het systeem waarin het team beslist wat de volgende test is — en dat zelf steeds beter wordt in dat advies.**

Eén zin, drie lagen:

1. **Beslist** — de eenheid van werk is niet "een advertentie maken" maar "een test draaien". Elke creative is een hypothese met een verwachte uitkomst en een gemeten uitkomst.
2. **De volgende test** — het systeem staat altijd in de tegenwoordige tijd: wat draait er, wat zegt de data, wat is de logische volgende zet. Niet een archief, maar een cockpit.
3. **Zelf steeds beter** — elke afgeronde test produceert een learning die het systeem daarna daadwerkelijk gebruikt: in prompts, in adviezen, in de volgorde waarin het kansen toont. Het geheugen van het team wordt een asset die rente oplevert.

### Het gevoel

Je opent Atelier Console 's ochtends en het systeem heeft al gewerkt: het heeft vannacht de Meta-cijfers opgehaald, de verdicts klaargezet, en zegt: *"Scheerolie-ad 'Vader & Zoon' is na 4 dagen een winner (ROAS 3.1). De hook draagt hem — ik stel drie iteraties voor op achtergrond en persona. De 'Trustpilot-strip' voor Wellshine bloedt (CPA €41) — killen? En: het Sensitive Skin-persona heeft al 3 weken geen nieuwe test."*

Jij beslist. Het systeem produceert, publiceert, meet en onthoudt.

### Wat het niet is (bevestigd én aangescherpt)

Geen advertentiegenerator, geen formulierenverzameling, geen chat, geen dashboard — eens. Maar ik voeg toe: **ook geen verzameling AI-features.** De maatstaf voor elke module is niet "gebruikt het AI?" maar "welke beslissing versnelt of verbetert het?" En het is **geen archief**: alles wat ouder is dan de huidige beslissing is alleen waardevol als gecomprimeerde learning, niet als stapel oude kaarten.

---

## 3. Het kernobject: de Test

Voordat de workspaces: het belangrijkste architectuurbesluit is welk object centraal staat. Vandaag is dat impliciet "de ad" (een library-item met een plaatje). Ik stel voor: **de Test**.

```
TEST
├── Hypothese        "Angst-hook op scheerirritatie verslaat de huidige
│                     benefit-hook bij het Sensitive Skin-persona"
├── Context          product · persona · angle · funnel · format · kanaal
├── Creatives        1–n statics/scripts/video's (de uitvoering van de hypothese)
├── Status           concept → klaar → live → beslist
├── Resultaat        automatisch opgehaalde Meta-metrics per creative
├── Beslissing       winner / iterate / kill — door een mens, voorgesteld door AI
├── Learning         één zin die het team blijvend rijker maakt
└── Afstamming       parent-test, kinderen (iteraties) — de familieboom
```

Alles in het systeem hangt hieraan. De generator maakt geen "plaatjes" maar voert tests uit. De bibliotheek is geen fotoalbum maar de creatives-van-tests. Het dashboard toont geen KPI's maar tests-die-een-beslissing-nodig-hebben. De bestaande `creatives`-tabel (Creative Strategy) is hier al een embryo van — inclusief `hypothesis`, `parent_id` en `angle_id` — maar hij is nu een *administratie naast het werk* in plaats van *het werk zelf*.

**Waarom dit het verschil maakt:** met de Test als kernobject is er nooit meer een wees. Geen script zonder plan, geen live ad zonder hypothese, geen resultaat zonder learning. En de familieboom (welke winner leidde tot welke iteraties) wordt vanzelf de waardevolste dataset die het bedrijf bezit.

---

## 4. Productarchitectuur: vijf werkruimtes, niet elf

Je briefing noemt elf mogelijke workspaces. Ik breng het terug naar **vijf**. Niet omdat minder altijd beter is, maar omdat elf namen in een zijbalk hetzelfde probleem terugbrengen dat we nu hebben: 15 tabs waarvan de gebruiker er dagelijks 4 gebruikt. Elke workspace hieronder overleeft de toets *"mist de gebruiker hem echt als ik hem verwijder?"* — de elf van jou doen dat niet allemaal (onderbouwing in §8).

De vijf volgen de beslisloop:

```
        ┌──────────────────────────────────────────────────┐
        │                                                  │
        ▼                                                  │
   1. VANDAAG ──beslis──▶ 2. STUDIO ──publiceer──▶ [Meta] ─┘
   (signalen,             (creatie)                 meting komt
    beslissingen)                                   automatisch terug
        ▲                                                  
        │                                                  
   4. BREIN ◀──learnings── 3. TESTLAB                      
   (kennis)                (lopende & besliste tests)      
                                                           
   5. ARCHIEF (assets & creatives — ondersteunend, geen bestemming)
```

### 4.1 Vandaag — de beslisruimte

*Vervangt: het huidige Dashboard/Cockpit.*

Geen dashboard maar een **werkvoorraad van beslissingen**. Elke ochtend staat hier wat het systeem 's nachts heeft geconstateerd, gerangschikt op impact:

- **Verdicts** — de Rory daily check (bestaat al!) eindelijk met een gezicht: per live ad een voorstel (schalen / itereren / killen) met de cijfers en de redenering erbij. Eén klik = beslist, en bij "itereren" sta je direct in de Studio met alles vooringevuld.
- **Gaten** — persona's zonder recente test, producten met te weinig creatives, awareness-stadia die nooit geraakt worden, winners zonder iteraties. Het systeem kent de matrix (product × persona × angle × funnel) en ziet wat leeg is.
- **Pijplijn** — wat is klaar om live te gaan, wat wacht op review, wat draait.

De maatstaf voor deze ruimte: **een lege "Vandaag" is het doel.** Elke tegel is een beslissing; als je ze allemaal genomen hebt, ben je klaar. De huidige leaderboards en decoratieve ringen verdwijnen (welke beslissing ondersteunt "wie was het actiefst deze week"? Geen — dus weg).

### 4.2 Studio — de maakruimte

*Vervangt en versmelt: Statics, Kopieer ad, Itereren, Ad Transformer, Copywriter, Scriptwriter — zes tabs worden één werkruimte.*

De belangrijkste sanering van het hele ontwerp. De zes generatie-tabs zijn vandaag zes ingangen naar wat eigenlijk één vraag is: *"wat is het startpunt van deze creatie?"*

- start vanuit een **idee** (braindump → Rory scherpt aan)
- start vanuit een **winner** (iteratie — vooringevuld vanuit het Testlab)
- start vanuit een **concurrent-ad** (mechaniek lenen)
- start vanuit een **foto** (transformeren)
- start vanuit een **gat** (de Vandaag-ruimte stuurde je hierheen met een kant-en-klare hypothese)

Daarna is de flow identiek: hypothese scherpstellen → context (product, persona, angle, format) → uitvoeren als **static, script of copy** — dat is een output-keuze achterin, geen aparte tool voorin. De uitstekende beeldbewerking die er al is blijft het sluitstuk.

Twee principiële veranderingen:

1. **De Studio begint altijd met een hypothese en eindigt altijd in het Testlab.** "Los even iets genereren" bestaat niet meer als hoofdpad — dat is precies de bron van de wezen in de huidige library. (Een snelle sandbox-modus mag bestaan, maar gemarkeerd als oefening, buiten de testadministratie.)
2. **Publiceren hoort bij afmaken.** Klaar = als draft in de Meta ad account gezet (via de Meta API die er al ligt), met naamconventie, UTM's en koppeling aan de test. Niet meer: PNG downloaden en in Ads Manager overtikken.

### 4.3 Testlab — de waarheidsruimte

*Vervangt en versmelt: Creative Strategy + het Itereren-gedeelte dat eigenlijk analyse is + de ongelezen `rory_recommendations`.*

Dit is het hart van het product en de upgrade van de huidige Creative Strategy-tabel van "spreadsheet die we bijhouden" naar "plek waar de waarheid leeft":

- **Live tests** — met automatisch binnenstromende Meta-metrics (spend, hook rate, hold rate, CTR, CPA, ROAS). Handmatig cijfers overtikken en screenshots uploaden verdwijnt volledig zodra de ad-account-koppeling er is.
- **Besliswachtrij** — tests die genoeg data hebben voor een verdict, met het AI-voorstel ernaast. De mens beslist; het systeem legt vast.
- **Familiebomen** — van elk winnend concept de hele afstammingslijn: originele hypothese → winner → iteraties → wat elke variatie deed. Dit beantwoordt de vraag die nu onbeantwoordbaar is: *"wáárom werkt deze ad?"*
- **Afsluitritueel** — een test mag pas dicht als er een learning is geformuleerd (één zin, AI stelt hem voor, mens redigeert). Die learning verhuist naar het Brein.

### 4.4 Brein — de kennisruimte

*Versmelt: Producten, Persona's, Merk-instellingen, het format-catalogus-van-42, en de nieuwe learnings — plus de kennis die nu in de Obsidian-vault van Marketing HQ gevangen zit.*

Vandaag zijn producten, persona's en merkprofiel drie losse tabs met stamdata. In het nieuwe model is het Brein één samenhangende kennislaag met een cruciaal verschil: **alles in het Brein heeft een trackrecord.** 

- Een persona is niet langer een statisch document maar toont per angle: getest? resultaat? learning? De angle-bibliotheek per awareness-stadium (die nu al bestaat en goed is!) wordt de kaart waarop het systeem gaten en kansen aanwijst.
- Een product toont zijn creative-dekking en zijn beste bewezen angles.
- Het format-catalogus (42 formats) krijgt per format een winrate — waarna hij zichzelf gaat sorteren.
- **Learnings** worden een eigen entiteit: doorzoekbaar, gekoppeld aan product/persona/angle, en — essentieel — **geïnjecteerd in elke relevante AI-prompt**. Dit is het vliegwiel: het systeem van volgend kwartaal is slimmer dan dat van vandaag, niet omdat het model beter werd, maar omdat het Brein groeide.

### 4.5 Archief — de assetruimte

*Versmelt: Bibliotheek + Scripts. Degradeert bewust.*

Alle creatives, beelden, referentiefoto's en scripts, doorzoekbaar op alles (product, persona, format, status, prestatie). Maar eerlijk is eerlijk: in dit ontwerp is het Archief een **ondersteunende ruimte, geen bestemming**. Je komt er om iets terug te vinden of te hergebruiken; je werkt er niet. De huidige Bibliotheek-tab doet alsof hij een hoofdruimte is — dat is hij niet, en dat hoeft hij niet te zijn.

### Wat geen workspace wordt (en waarom)

- **Handboek** → wordt contextuele hulp binnen elke ruimte plus onboarding; een SOP-tab die niemand opent is dode kennis.
- **Wijzigingen/changelog** → een klein "wat is nieuw"-signaal, geen tab.
- **Workflow Center** (uit je lijst) → de workflow ís het product; een aparte ruimte ervoor is een teken dat de hoofdstructuur faalt.
- **Campaign Workspace, Audience Intelligence, Product Intelligence, Hook Intelligence, Creative Review, Performance Learnings, Knowledge Base** (uit je lijst) → dit zijn in mijn ontwerp geen ruimtes maar **lenzen op het Brein en het Testlab**. Audience Intelligence = het persona-deel van het Brein. Performance Learnings = de learnings-laag. Creative Review = de besliswachtrij in het Testlab. Elf deuren naar dezelfde data creëert precies de versnippering die je wilt ontvluchten.
- **Pulse/Marketing HQ als apart product** → opheffen als los systeem. De agents en rapporten zijn waardevol, maar ze horen ín de Console (de rapporten landen in Vandaag en het Brein), niet op een tweede URL met een tweede database. Eén brein, niet twee.

---

## 5. Het AI-team: vijf specialisten, gebonden aan beslissingen

Je vraagt om een team van specialisten in plaats van één chatbot — eens. Maar ik daag de lijst van twaalf uit. Twaalf namen is theater: de gebruiker kan niet onthouden wie wat doet, en in de praktijk zijn "Hook Expert", "Copy Strategist" en "Positioning Expert" dezelfde aanroep met een andere openingszin. **Een AI-specialist verdient bestaansrecht per beslissing die hij versnelt, niet per marketingdiscipline die er bestaat.**

De huidige app heeft er al vier (Rory, Theriot, Ogilvy, Fable) en dat werkt — mensen práten over "wat Rory zei". Ik bouw daarop voort en kom op vijf, elk gebonden aan één plek in de loop:

| Specialist | Beslissing die hij ondersteunt | Leeft in | Bestaat al? |
|---|---|---|---|
| **De Strateeg** (Rory) | *Wat testen we, en waarom?* Signalen duiden, gaten aanwijzen, hypotheses scherpen, de interview-flow | Vandaag + start van Studio | Ja — incl. daily check |
| **De Maker** (Theriot) | *Hoe voeren we het uit?* Concepten, scripts, format-fit, foto-beoordeling | Studio | Ja |
| **De Copywriter** (Ogilvy) | *Welke woorden?* Meta-copy, hooks, headlines | Studio (output-stap) | Ja |
| **De Analist** (nieuw) | *Wat zegt de data — en wat is de volgende zet?* Verdicts, funnel-diagnoses, learning-voorstellen, familieboom-inzichten | Testlab + Vandaag | Half — versnipperd over de daily check en het itereren-scherm |
| **De Criticus** (nieuw) | *Is dit goed genoeg om geld op te zetten?* Pre-flight review: leesbaarheid, safe zones, merkconsistentie, beleid, voorspelde zwaktes | Studio (vóór publicatie) | Nee |

Drie regels die belangrijker zijn dan de namen:

1. **Contextueel, nooit een losse chat-tab.** De specialist verschijnt op het moment dat zijn beslissing voorligt, met de context al geladen. (De huidige app doet dit eigenlijk al goed — dat behouden we.)
2. **Eén gedeeld geheugen.** Alle vijf lezen hetzelfde Brein en dezelfde testhistorie. De Maker weet wat de Analist vorige week concludeerde. Vandaag heeft elke AI-aanroep alleen het merkprofiel als context — dat wordt: merkprofiel + relevante learnings + testhistorie van dit product/persona.
3. **Specialisten stellen voor, mensen beslissen.** Elke AI-output die geld raakt (publiceren, killen, schalen) is een voorstel met een redenering, nooit een autonome actie. Het vertrouwen dat dit kweekt is de voorwaarde om later méér te mogen automatiseren.

De overige rollen uit je lijst (Trend Analyst, Market Research, Offer Specialist, Persona Expert…) worden **vaardigheden van deze vijf**, geen extra gezichten. De trend-briefings die Marketing HQ al maakt, worden bijvoorbeeld input voor De Strateeg in Vandaag.

---

## 6. De gebruikersflow: een dag en een week

**De ochtend (10 min):** open Vandaag → drie verdicts: één winner (→ één klik: De Strateeg zet drie iteratie-hypotheses klaar), één kill (→ bevestigen, learning wordt voorgesteld: "prijs-hook werkt niet bij koud publiek voor bundels"), één doorlopen. Eén gat: "Sensitive Skin al 3 weken zonder test" → klik → Studio, hypothese vooringevuld.

**De middag (de maakblokken):** Studio: de drie iteratie-hypotheses uitvoeren — De Maker genereert, jij stuurt bij, De Criticus doet de pre-flight, klaar-voor-publicatie → drafts staan in de ad account, test staat in het Testlab op "klaar".

**De week:** maandag toont Vandaag het weekbeeld van De Analist: welke tests beslist zijn, wat de learnings waren, waar de dekking-matrix nog leeg is. Het team kiest de tests van deze week — dat is de hele weekplanning, in het systeem zelf.

**De nieuwe collega:** krijgt geen handboek-tab maar een Brein dat zich laat lezen: de persona's mét trackrecord, de learnings, de familiebomen van winners. Het inwerktraject ís het product.

---

## 7. Wat altijd zichtbaar is

Minimaal, want permanente informatie is duur (het betaalt huur in elke pixel en elke seconde aandacht):

1. **Merk-context** (Wellshave/Wellshine) — alles is merk-gebonden, verwisseling is het duurste foutje.
2. **Besliscounter** — hoeveel beslissingen wachten (de badge op Vandaag). Dit is de enige "notificatie" die het systeem nodig heeft.
3. **Live-status** — hoeveel tests draaien nu, en is de dataverbinding met Meta gezond (stale data is gevaarlijker dan geen data).
4. **Waar-ben-ik in de loop** — binnen een test altijd zichtbaar: hypothese → creatie → live → beslist.

Niet permanent zichtbaar: omzet, ROAS-totalen, spend-grafieken. Niet omdat ze onbelangrijk zijn, maar omdat ze zonder beslissingsvraag decoratie zijn — ze leven in Vandaag en het Testlab op het moment dat er iets te beslissen valt.

---

## 8. Wat verdwijnt, versmelt of opnieuw ontworpen wordt

| Huidig (15 tabs + 2e app) | Wordt | Waarom |
|---|---|---|
| Dashboard/Cockpit | **Vandaag** (herontwerp) | Leaderboards en ringen ondersteunen geen beslissing; verdicts en gaten wel |
| Statics, Kopieer ad, Itereren, Transformer, Copywriter, Scriptwriter | **Studio** (versmelting) | Zes tabs zijn vijf startpunten + drie outputvormen van één flow |
| Creative Strategy | **Testlab** (herontwerp) | Van handmatige spreadsheet naar automatisch gevoede waarheid |
| Bibliotheek, Scripts | **Archief** (versmelting, gedegradeerd) | Ondersteunend, geen bestemming |
| Producten, Persona's, Merk-instellingen | **Brein** (versmelting + learnings erbij) | Stamdata wordt kennis-met-trackrecord |
| Handboek | Contextuele hulp | Een SOP-tab is dode kennis |
| Wijzigingen | "Wat is nieuw"-signaal | Geen tab waard |
| `rory_recommendations` (ongelezen tabel) | De motor van Vandaag | De grootste quick win van het hele ontwerp |
| Marketing HQ + Pulse (aparte app/database) | Opgeheven als los product; rapporten en agents landen in Vandaag/Brein | Eén brein, niet twee |
| Handmatige metrics-invoer & screenshot-extractie | Vervalt zodra de ad-account live gekoppeld is | Dit was altijd een noodverband |

Netto: **van 15 tabs + een tweede applicatie naar 5 werkruimtes.** Minder deuren, meer systeem.

---

## 9. De belangrijkste keuzes en afwegingen (expliciet)

1. **Loop vóór workspaces.** De hoogste-prioriteit investering is niet visueel maar infrastructureel: Meta-metrics automatisch binnenhalen (lezen) en creatives als draft publiceren (schrijven). Zonder dit blijft elke werkruimte een formulier. Mét dit wordt zelfs de huidige UI al dramatisch beter. De verbindingen bestaan grotendeels al (de daily-check-routine, de Meta-connectors van Marketing HQ) — ze zijn alleen nooit de app in getrokken.
2. **De Test als kernobject, niet de ad.** Dit is de structurele keuze waar alle andere uit volgen. Afweging: het maakt "even snel iets genereren" een tikje zwaarder (er hoort een hypothese bij). Dat is een feature, geen bug — maar er komt een sandbox-uitgang voor speelwerk.
3. **Vijf werkruimtes, geen elf.** Minder identiteiten, meer samenhang. Afweging: sommige "Intelligence"-concepten uit je briefing worden lenzen in plaats van ruimtes; als de praktijk uitwijst dat bijv. de persona-laag een eigen ruimte verdient, kan dat later alsnog — splitsen is makkelijker dan samenvoegen.
4. **Vijf AI-specialisten, geen twaalf.** Gebonden aan beslissingen, met gedeeld geheugen. Afweging: minder "wow, een heel team", meer daadwerkelijk vertrouwen per specialist.
5. **Mens beslist, AI stelt voor.** Voorlopig geen autonome publicatie of kills. Afweging: minder automatisering op korte termijn, maar het bouwt het track-record op dat latere automatisering rechtvaardigt ("De Analist had de afgelopen 40 kills in 90% gelijk — wil je auto-kill aanzetten onder €X spend?").
6. **Eén systeem, één brein.** Marketing HQ versmelt met de Console. Afweging: migratie-inspanning en het loslaten van een werkend los dashboard — maar twee geheugens die elkaar niet kennen is precies het tegenovergestelde van een Operating System.
7. **Learnings als eersteklas entiteit.** Elke gesloten test produceert er één; ze worden in prompts geïnjecteerd. Dit is het verschil tussen een tool die AI gebruikt en een systeem dat leert.

**Eén eerlijke technische kanttekening** (geen code-gesprek, wel een productrandvoorwaarde): dit product kan niet gedragen worden door één HTML-bestand van 21.000 regels met negen CSS-lagen over elkaar. De designhandoff in de repo concludeerde dat al. Wanneer we het hierover eens zijn, is de volgorde: eerst dit blueprint bevriezen, dan het datamodel (de Test, het Brein), dan pas interface en techniek.

---

## 10. Vragen aan jou — vóór er één scherm ontworpen wordt

1. **Team & rollen.** Wie werken er straks dagelijks in? Hoeveel mensen, en is er een rolverdeling (strateeg vs. maker vs. media buyer), of doet iedereen alles? Dit bepaalt of het Testlab een review-/goedkeuringsstap nodig heeft of dat iedereen mag publiceren.
2. **Scope: alleen paid social, of alle creatie?** Marketing HQ's pijplijn kent ook e-mail, landingspagina's en UGC-video. Is Atelier Console het OS voor *al* het creatieve werk, of bewust alleen Meta-ads (statics + scripts)? Mijn advies: start smal (Meta), maar het antwoord bepaalt het datamodel.
3. **Meta-koppeling: hoe ver mag die gaan?** (a) Alleen lezen (metrics automatisch binnen) is de kleinste stap met het grootste effect. (b) Ook schrijven (drafts klaarzetten in de ad account)? (c) Op termijn budgetacties (pauzeren/schalen) na menselijke klik? Waar ligt jouw comfortgrens, en zijn er compliance-redenen om onder (b) te blijven?
4. **Volume-ambitie.** Hoeveel tests per week draaien jullie nu werkelijk, en waar wil je heen? (5/week vraagt om diepgang per test; 30/week vraagt om lopende-band-ergonomie — dat zijn verschillende Studios.)
5. **Multi-merk.** Wellshave en Wellshine vandaag — blijft het bij twee eigen merken, of is er een scenario (meer merken, agency-model) waarin merken-beheer zelf een werkruimte moet zijn?
6. **Video.** Scripts worden nu geschreven maar productie gebeurt buiten het systeem. Moet videoproductie (UGC-briefings, creator-flow, of AI-video) op de roadmap van het OS, of blijft video "script eruit, rest elders"?
7. **De Obsidian-brain & agents van Marketing HQ.** Ben je bereid Pulse als los product op te heffen en de agents/rapporten de Console in te trekken — of is er een reden (andere gebruikers? ander ritme?) waarom die twee werelden gescheiden moeten blijven?

---

*Volgende stap na jouw antwoorden: het datamodel van de Test en het Brein definitief maken, en per werkruimte de belangrijkste user journeys uitschrijven. Daarna — pas daarna — UI.*
