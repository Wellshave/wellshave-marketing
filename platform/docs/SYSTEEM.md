# Het systeem, van voor naar achter

Stand van 4 augustus 2026, laat in de middag. Alles hieronder komt uit de code
en de database zoals die nu draaien — niet uit het plan en niet uit het geheugen.
Waar iets nog niet werkt, staat dat erbij.

---

## 0. In vier zinnen

Er is één webconsole waar mensen advertenties bedenken en maken. Er is één
database waar alles in staat wat het team en de agents weten. Er is één server
(een Cloudflare Worker) die de sleutels bewaart en de agents laat draaien. En er
is een team van tien AI-agents dat werk oppakt op vaste momenten, met een mens
op de plekken waar geld of oordeel in het spel is.

Wat die vier bij elkaar houdt is het **werkstuk**: één idee dat langs zes
stations reist, van signaal uit de markt tot geleerde les. Dat is de kern van het
hele systeem, en al het andere hangt eraan.

---

## 1. De onderdelen

### De console

Twee omgevingen, dezelfde code, dezelfde database:

| | |
|---|---|
| `wellshave-adgen.netlify.app` | waar het team vandaag werkt |
| `wellshave-werkbank.netlify.app` | de nieuwe, met Werkbank en Logboek erbij |

Inloggen gaat met een teamaccount (e-mail + wachtwoord of Google). Je moet
goedgekeurd zijn: een nieuwe aanmelding komt in een wachtrij tot een beheerder
hem doorlaat.

### De worker

`marketing-ads.dustin-9ff.workers.dev` — sinds vandaag draait hier de nieuwe
runtime. Hij doet drie dingen:

1. **Sleutelbewaarder.** De console heeft zelf geen API-sleutels; alle
   AI-verkeer loopt hierlangs. Dat is waarom niemand een key hoeft in te tikken.
2. **Poortwachter.** Elke aanroep moet een geldig teamtoken meesturen. Zonder
   goedgekeurd account: 401.
3. **Uitvoerder.** Elke vijf minuten kijkt hij of er gepland werk klaarstaat en
   werkt hij de wachtrij af.

### De database

Supabase (Postgres). Twee schema's die er hier toe doen: `public` voor de
console (producten, persona's, creatives, bibliotheek) en `marketing_hq` voor het
agentsysteem (werkstukken, overdrachten, rapporten, metingen).

De regels van het systeem zitten in die tabellen en niet in de teksten die de
agents meekrijgen. Een agent kan om een prompt heen praten; om een constraint niet.

---

## 2. De console, tab voor tab

### Overzicht

**Dashboard** — de startpagina met de stand van zaken.

**Werkbank** — *"Welk werk ligt stil, en op wie wacht het?"* Per werkstuk de hele
keten van zes stations, inclusief de stations die nog niet gebeurd zijn — die
lege plekken zijn de informatie. Er staat bij hoe lang het stilligt en of dat te
lang is, en dat verschilt per soort overdracht: iets dat vanzelf door hoort te
lopen mag een dag stil zijn, een poort drie dagen, creatief werk een week.

Sinds vandaag staat er ook **wat het tegenhoudt**: wacht het op de Criticus, is
het afgekeurd, of moet er een mens bij vanwege een onzekerheid die iemand
opschreef. Waar het ligt en waarom het daar niet weg kan zijn twee verschillende
dingen.

**Logboek** *(nieuw, vandaag)* — *"Wat deed het team, en wat gaven ze aan elkaar
door?"* Vijf bronnen samengevoegd tot één stroom: handelingen van agents,
berichten onderling, rapporten, runs met hun kosten, en wat op goedkeuring
wacht. Per dag inklapbaar, filterbaar per soort.

Bovenaan staat hoe oud het logboek is. Dat is geen sierlijkheid: een gevulde
lijst leest als actueel, ook als de laatste regel van vorige week is.

### Genereren

**Statics** — de hoofdmoot. Zie hoofdstuk 3.

**Kopieer ad** — je uploadt een advertentie die het goed doet (van jezelf of van
een ander), en het systeem haalt de *mechaniek* eruit: waarom werkt dit. Daarna
maakt het diezelfde mechaniek met jouw product en persona. De bron-advertentie
gaat alleen naar Claude voor analyse, nooit naar de beeldgenerator.

**Itereren** — je hebt een winnaar en wilt varianten die de winnaar vasthouden.
Je geeft de advertentie plus de cijfers, en krijgt testbare iteraties terug: wat
blijft hetzelfde, wat verandert er, en waarom zou dat beter zijn.

**Ad transformer** — een bestaande foto of advertentie omzetten naar een ander
format of een andere plaatsing.

**Copywriter** — drie stappen. Je uploadt een advertentie; Claude leest wat er te
zien is, waar hij voor dient, welke funnel-fase, wat de kernbelofte en het
hook-mechaniek zijn. Daarna schrijft hij de volledige Meta Ads Manager-copy: drie
primary texts, vijf headlines, twee descriptions, CTA-knop, met annotatie erbij.
Klopt de analyse niet, dan corrigeer je en analyseer je opnieuw.

**Scriptwriter** — hetzelfde idee voor video: scripts met hooks, body, CTA's,
B-roll-aanwijzingen en casting.

### Bibliotheek

**Bibliotheek** — alles wat gegenereerd is, met filters.
**Scripts** — de videoscripts apart.
**Creative Strategy** — bovenaan staat het **dagbesluit**: wat vandaag uit moet,
wat meer budget verdient, in volgorde van urgentie.
**Persona's** — vijf klantprofielen. Ze zijn geen versiering: elk werkstuk kiest
er één, en de meting rekent per hoek × persona.
**Producten** — veertien producten met hun USP's en beeldreferenties.

### Handleiding & instellingen

**Handboek** — de werkwijze in tekst.
**Merk-instellingen** — merkprofiel, tone of voice, kleuren, lettertypen. Dit
wordt bij elke generatie meegestuurd.
**Wijzigingen** — de changelog, nu op v7.3.

Linksboven staat de merkschakelaar **Wellshave ⇄ Wellshine**. Die wisselt de
hele dataset; beide merken hebben hun eigen producten en persona's.

---

## 3. Een static ad maken, stap voor stap

Dit is het pad dat je het vaakst loopt.

### Stap 0 — de brain dump (optioneel, en het meest waard)

Bovenaan staat een tekstvak: *"Type vrij wat je in gedachten hebt."* Een vondst,
een seizoen, een irritatie, een deal. Je hoeft niets te structureren.

**Rory leest het** — Rory Sutherland, de gedragspsycholoog van Ogilvy, als
denkpartner. Hij bepaalt de conceptrichting, kiest funnel-fase, archetype, format
en persona, en vult de velden hieronder voor je in. Elke keuze kun je daarna
overrulen.

**Of: het interview.** In plaats van één keer lezen gaat Rory stap voor stap door
tot de hoek scherp is. Hij vraagt door op wat je zegt — niet naar het symptoom
maar naar de oorzaak, niet naar wat jij mooi vindt maar naar wie de klant de
schuld geeft. Rechts vult zich een checklist: kernpijn, hoek, kernbezwaar,
gewenste na-situatie, visueel concept. Staat die vol, dan maakt hij de briefing.

Daarna scherpt **Theriot** (Nick Theriot, direct-response strateeg) het visuele
concept aan volgens *show don't tell*: wat zie je letterlijk in beeld, welk
bewijs is zichtbaar. Hij verandert de strategische kern niet.

### Stap 1 — configuratie

Links: **product** (met zijn foto's en USP's), **plaatsing** (Feed 1:1, Story
9:16, enzovoort) en welke beeldreferenties het model mag gebruiken zodat het
product klopt.

Rechts: **doelgroep & funnel** — persona, funnel-fase (TOF/MOF/BOF) en
awareness-niveau (unaware → most aware).

### Stap 2 — het format

**42 formats**, in vijf categorieën:

| | |
|---|---|
| **A · Product-led** | Product Hero, Feature Callout, Benefit Stack, What's in the box, Exploded view, Offer/Bundle, Grid, Prijsanker, Gift Guide |
| **B · Social proof** | Testimonial pull-quote, Review wall, 5-sterren cards, Review screenshot, WhatsApp-chat, Tweet/Reddit, IG comments, Stat callout, UGC-still |
| **C · Vergelijking & educatie** | Us vs Them, Before/After, 3 redenen, Checklist, How it works, FAQ/Objection, Mythe vs Feit, Kostenvergelijking, Persona callout, Probleem-agitatie, Wist-je-dat |
| **D · Native & lo-fi** | Ugly ad, Meme, Whiteboard, Search bar, Reminder, Notification, Post-it, Photo dump |
| **E · Editorial & advertorial** | News headline, Magazine cover, Founder note, Seizoensmoment |

Elk format heeft een omschrijving die zegt wanneer het werkt en waarom, plus
labels: is het merkloos (voelt niet als advertentie), hoe hard is de CTA, zit er
bewijs in, en waar linkt het heen. **Auto** laat Claude per variatie het sterkste
format kiezen en spreidt over categorieën.

### Stap 3 — genereren

Twee fasen:

1. **Concepten** via Claude — per variatie een headline, body, CTA, visueel
   concept, hypothese en de redenering waarom deze variatie zou werken.
2. **Beeld** via OpenAI — per variatie een afbeelding, met de productreferenties
   meegestuurd zodat het product klopt.

De uitkomst is sinds v7.3 geen formulier meer maar een **beoordeel-werkruimte**:
je leest eerst wat Claude bedacht heeft — headline groot bovenaan, body als
tekst, CTA als pill. Wil je iets wijzigen, dan klik je op "Tekst bewerken" en
krijgen de velden hun kader terug. Details en "Waarom deze variatie werkt" staan
ingeklapt, zodat de beoordeling voorop staat.

### Stap 4 — de Theriot-checklist

Rechts staat per variatie een controle op zes punten: hook in 0,3 seconden,
bewijs in plaats van claim, mechanisme uitgelegd, emotie zichtbaar,
sophistication-match, één duidelijke CTA.

### Wat er daarna gebeurt

De creative gaat naar de bibliotheek met status `To Test`. Vanaf hier neemt het
agentsysteem het over — en dat is het volgende hoofdstuk.

---

## 4. Het agentteam

Tien agents. Elk hoort bij een station in de keten.

| Agent | Rol | Station | Draait |
|---|---|---|---|
| **Radar** | Trend- & concurrentiescout | ① signaal | ✅ |
| **Nova** | Creative Director & strategie | ② briefing | ✅ |
| **Pixel** | Content (statics & UGC) | ③ creatie | ⬜ |
| **Quill** | Copywriter | ③ creatie | ⬜ |
| **De Criticus** | Kwaliteitsbewaking | tussen ③ en ④ | ⬜ |
| **Bolt** | Performance marketeer | ④ live | ✅ |
| **Atlas** | Data-analist | ⑤ meting | ✅ |
| **Echo** | E-mailmarketeer | ⑥ oogst | ✅ |
| **Vector** | Webdesigner (landingspagina's) | ⑥ oogst | ⬜ |
| **Sage** | SEO-specialist | — | ⬜ |

"Draait" betekent: heeft een werkinstructie in de runtime. De rest bestaat als
profiel maar kan nog geen werk uitvoeren.

### Wat ze doen

**Radar** leest de markt: welke advertenties schalen bij concurrenten, welke
hooks komen op, welke landingspagina's draaien lang. Hij levert een trendrapport
en tipt Nova.

**Nova** maakt van een signaal een testbaar plan: hoek, persona, wat de test moet
uitwijzen. Zij briefte het contentteam.

**Bolt** zet creatives klaar als advertentie bij Meta — beeld uploaden, ad-creative
aanmaken — en schrijft per advertentie een scorecard met een oordeel. Hij mag
**niets live zetten**; dat is een aparte handeling die alleen een mens doet.

**Atlas** haalt elke ochtend de cijfers op, schrijft een dagrapport, en zet de
gemeten cijfers terug op de creative waar ze uit voortkwamen. Dat laatste
(`feedback_sync`) is een systeemtaak zonder model: puur rekenwerk.

**Echo** doet de e-mailkant: flow-audit in Klaviyo en campagneconcepten.

**De Criticus** velt één oordeel per overdracht van creatie naar lancering: door
of niet door, met de reden. Ook bij "door" — een goedkeuring zonder reden is een
stempel, en die is achteraf niet na te lopen.

### Hoe ze met elkaar praten

Vier kanalen:

| Kanaal | Wat | Waar |
|---|---|---|
| **Bericht** | agent tipt agent | `agent_messages` |
| **Overdracht** | het werk gaat over, met besluit en controlepunt | `werkstuk_overdrachten` |
| **Handeling** | elke gereedschapsaanroep | `agent_events` |
| **Poort** | iets dat naar buiten werkt en op een mens wacht | `approvals` |

Alle vier komen samen in het Logboek.

> **Let op — een bekend gat.** Het gereedschap `send_message` belooft de
> verzender dat de ontvanger het bij zijn volgende run leest. De runtime zet die
> post niet klaar. Van de 25 berichten is er **nul** gelezen. De echte
> communicatie loopt dus via de overdracht, die wél afgedwongen wordt.

---

## 5. De werkwijze: van signaal tot learning

### De zes stations

| | Station | Wie | Overdracht |
|---|---|---|---|
| ① | **signaal** — een observatie uit de markt | Radar | vanzelf |
| ② | **briefing** — het idee, testbaar gemaakt | Nova | vanzelf |
| ③ | **creatie** — beeld en tekst | jij, Pixel, Quill | mens |
| ④ | **live** — klaarzetten bij Meta, dan een poort | Bolt | poort |
| ⑤ | **meting** — cijfers terug naar de creative | Atlas | vanzelf |
| ⑥ | **oogst** — e-mailcampagne en landingspagina | Echo, Vector | poort |

### De zes regels van de werkbank

Dit is wat een werkstuk onderweg afdwingt. Ze zitten in de database.

**① Deelnemers bij naam.** Elke stap noemt precies één uitvoerder: een agent of
een mens. Er wordt niet gegokt. Twee stappen uit juli zijn niet te herleiden en
blijven "naamloos" — die krijgen niet alsnog een naam, want dan zou er staan dat
iemand iets deed wat hij misschien niet deed.

**② Het denkstuk.** Zeven vragen voordat er iets gemaakt wordt:

1. Wat is de marketingangle?
2. Welk probleem of verlangen ligt eronder?
3. Voor welke persona is dit relevant?
4. Wat is de hypothese? — vorm ligt vast: *als we X, dan Y, omdat Z*
5. Welk format past hierbij?
6. Wat moet getest worden? — wat de test moet uitwijzen, niet wat we hopen
7. Waarom is dit nu relevant?

Elk antwoord krijgt een zekerheid: `onderbouwd` (met bron), `aanname` of `open`.
"Onderbouwd" zonder bron wordt geweigerd — dat is een aanname met een beter woord
ervoor.

**Alleen een mens tekent af.** Niet via een rolcontrole maar via de vorm van de
tabel: er is geen kolom waar een agent in past. Dit is de enige plek waar
"een handmatig werkstuk gaat nooit direct naar productie" afdwingbaar is. En
"niet doen" is een geldige uitkomst — zonder die uitgang wordt elk idee vanzelf
een advertentie.

**③ De overdracht.** Wie een stap afrondt legt vast: wat is besloten, waar rust
dat op, en wat moet de volgende controleren. Plus onzekerheden, elk met de vraag
of ze blokkerend zijn. Zet je er één op blokkerend, dan gaat er automatisch een
poort dicht — dat veld kun je niet zelf invullen, het wordt afgeleid. De enige
manier om te voorkomen dat er een mens bij moet, is geen blokkade opschrijven —
en dan heb je hem ook niet gezien.

**Een stap kan niet af zonder overdracht.** Geen goed voornemen maar een
constraint, want een goed voornemen wordt overgeslagen precies wanneer het druk
is.

**④ Terugsturen.** Klopt er iets niet, dan gaat het werkstuk terug met een reden.
Na twee rondes heen en weer moet er een mens bij: twee agents die elkaar eindeloos
corrigeren kost geld en levert niets op.

**⑤ Het dossier.** Bij elke stap krijgt de uitvoerder mee wat er over dit idee
bekend is — met herkomst erbij. Geen advies zonder bron. Staat er niets gemeten
in, dan zegt het dossier dat met zoveel woorden: *"niets in het dossier is
gemeten — dit besluit rust op smaak."*

**⑥ De Criticus.** De grendel tussen creatie en lancering. Zonder oordeel kan de
overdracht niet aangenomen worden; bij "niet door" ook niet. En wie de overdracht
schreef, velt er niet het oordeel over.

### Hoe groot een batch is, en waarom dat niet te kiezen valt

Drie drempels bepalen of een cijfer meetelt:

| Drempel | Eis |
|---|---|
| `beoordeelbaar` (per advertentie) | ≥ 4 dagen live, ≥ €50 besteed, ≥ 1.000 vertoningen |
| `betrouwbaar` (per hoek × persona) | ≥ 3 advertenties **én** ≥ €300 besteed |
| `soortgenoten` (per account) | ≥ 3, anders geen oordeel tegenover de mediaan |

Daaruit volgt de kleinst mogelijke batch die iets kan opleveren:

> **Drie advertenties, op één hoek bij één persona, elk zeven dagen live op
> ongeveer €15 per dag.** 3 × 7 × €15 = €315.

Kleiner mag, maar dan is de uitkomst per definitie een aanname — en het denkstuk
van het volgende werkstuk weigert een aanname als onderbouwing. Ze moeten
bovendien **tegelijk** lopen en op **hetzelfde account**, anders zijn ze elkaars
vergelijkingsmateriaal niet.

---

## 6. De dagcyclus

De worker kijkt elke vijf minuten of er gepland werk klaarstaat.

| Tijd (UTC) | Wie | Wat |
|---|---|---|
| 05:00 | Atlas | dagrapport |
| 05:15 | Radar | trendscan |
| 05:20 | Bolt | creative scorecard *(uit — er is nog nooit iets gemeten)* |
| 05:40 | Atlas | cijfers terugschrijven naar de creatives *(geen model)* |
| 06:00 | Nova | pipeline bijwerken |
| 06:30 | Bolt | publiceerwachtrij — hooguit drie creatives per keer |
| 06:30 ma | Atlas | account-audit per draaiend account |
| 06:45 | Bolt | dagbesluit opvolgen |

Bij elke afspraak hoort een maximale stilte. Levert een agent te lang niets, dan
is dat zichtbaar — een agent die niets doet ziet er anders uit dan een agent die
niets te doen heeft.

---

## 7. De grendels

Wat een agent **niet** kan, en niet omdat het hem gevraagd is:

- **Er bestaat geen gereedschap dat geld uitgeeft**, een campagne start of een
  e-mail verstuurt. Alles wat naar buiten werkt gaat via `request_approval` en
  wordt een rij die op een mens wacht.
- **Publiceren is gesplitst.** Een agent mag beeld uploaden en de ad-creative
  aanmaken — dat kost niets en wordt nooit vertoond. Alleen een mens maakt daar
  een draaiende advertentie van.
- **Lezen gaat via een whitelist.** Vraagt een agent een tabel die er niet op
  staat, dan krijgt hij een nette weigering met de lijst die wél mag.
- **Alleen een mens tekent een denkstuk af.**
- **Wie iets maakte, keurt het niet zelf goed.**

De sleutels (Supabase service key, Meta-token) staan uitsluitend als
Worker-secret: niet in de repo, niet in de browser, niet in de database.

---

## 8. Wat er nu werkelijk staat — 4 augustus

| | |
|---|---|
| Creatives | 7 — **allemaal `To Test`**, er heeft er nog nooit één gedraaid |
| Werkstukken | 3, alle drie lopend |
| Denkstukken | 1 (werkstuk 11, vandaag afgetekend) |
| Overdrachten | 2 |
| Oordelen van de Criticus | 0 |
| Publicaties bij Meta | 0 |
| Gemeten dagen | 0 |
| Learnings per hoek | 0 |
| Agent-handelingen | 37 (allemaal van vandaag) |
| Berichten tussen agents | 25, waarvan **0 gelezen** |
| Rapporten | 21 (t/m 27 juli) |
| Open goedkeuringen | 3 |
| Actieve advertentieaccounts | 2 |

Koppelingen: Claude ✅ · OpenAI ✅ · Meta ✅ (token staat op de worker) ·
Klaviyo ⬜ · Shopify ⬜ · Trendtrack ⬜

### De drie werkstukken

| # | Vraag | Hoek | Creatives |
|---|---|---|---|
| 9 | Werkt sociaal bewijs op een schaamtevolle zoekvraag bij Mark? | `social-proof` | 3 |
| 10 | Werkt de directe vergelijking met Dyson bij Sanne? | `comparison` | 1 |
| 11 | Werkt het tonen van het mechanisme tegen de angst voor sneetjes bij Mark? | `safety` | 3 |

Werkstuk 11 is het verst: denkstuk afgetekend, overdracht geschreven, drie
creatives. Het wacht op het oordeel van de Criticus.

---

## 9. Wat er nog niet is

**Blokkerend voor de eerste batch:**

1. **Creative 11 heeft geen beeld.** Met twee advertenties haalt de batch de
   drempel `betrouwbaar` niet.
2. **De Criticus kan niet tekenen.** Hij heeft geen werkinstructie in de runtime,
   en een mens kan het niet doen omdat de schrijver van de overdracht er niet
   zelf over mag oordelen. Er is dus een tweede mens nodig, of de Criticus moet
   gebouwd worden.

**Bekende fouten, gevonden bij de eerste echte run vandaag:**

3. **`date_preset: last_4d` bestaat niet bij Meta.** De code maakt van "vier
   dagen terug" een waarde die Meta niet kent (alleen 3, 7, 14, 28, 30, 90 zijn
   toegestaan). Beide accounts werden daardoor geweigerd. Het is geen
   rechtenprobleem — de foutmelding zegt alleen ten onrechte "Meta weigerde
   account", wat je het verkeerde bos in stuurt.
4. **Atlas kent het databaseschema niet** en gokt kolomnamen. Twee van zijn
   twaalf tool-rondes gingen daaraan op.
5. **De post wordt niet bezorgd** (zie hoofdstuk 4).

**Nog niet gebouwd:**

- Pixel, Quill, Vector, Sage en de Criticus als draaiende agents
- Console-schermen voor de Criticus-werkvoorraad en het dossier
- De Klaviyo-koppeling (Echo kan pas daarna)
- Trendtrack server-side (Radar is nu beperkt)

---

## 10. Waar je wat vindt

| Wat | Waar |
|---|---|
| Blauwdruk | `platform/docs/ARCHITECTUUR.md` |
| De werkbank ①–⑥ | `platform/docs/WERKBANK.md` |
| Profielen en reputatie | `platform/docs/TEAM.md` |
| Batchplan en drempels | `platform/docs/BATCHES.md` |
| Regels voor uiterlijk en gedrag | `platform/docs/ONTWERPCONTRACT.md` |
| Publiceren naar Meta | `platform/docs/PUBLICEREN.md` |
| Hoe cijfers terugkomen | `platform/docs/TERUGKOPPELING.md` |
| Agentprofielen | `marketing-hq/agents/*.md` |
| Het brein als Obsidian-vault | `node marketing-hq/brain/genereer.mjs` |

Elke migratie in `platform/db/migrations/` heeft een testlus in
`platform/db/test/`. Die lussen draaien de migratie tegen een echte Postgres en
proberen expliciet wat er níét mag. Een deel bevat mutatietests: ze draaien de
migratie opzettelijk fout en eisen dat de test dan rood wordt.
