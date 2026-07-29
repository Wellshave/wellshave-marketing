# De terugkoppeling — stap 06

Hoe het cijfer van een advertentie terugkomt bij de creatieve keuze die hem
heeft voortgebracht, en de volgende ronde stuurt.

## De vondst die dit klein maakt

De console consumeert deze terugkoppeling **al**. Op drie plekken:

| Waar | Leest | Toont |
|---|---|---|
| `wgpLoadWinners()` | `creatives` met `status in ('Winner','Iterate')`, op `roas` aflopend | "Begin bij een winnaar" in de wizard |
| `wgpLoadAngleHist()` | `angle_type` + `roas` van creatives bij de gekozen persona | Per hoek: hoe vaak geprobeerd, wat de beste was |
| `px.angleStats` | idem, plus `status = 'Winner'` | Hoekstatistiek bij beeldgeneratie |

Alle drie hangen aan dezelfde twee kolommen: **`creatives.roas`** en
**`creatives.status`**. Die worden vandaag met de hand ingevuld en staan bij
alle negen creatives leeg — dus de wizard begint elke keer bij niets.

Stap 06 is daarom geen nieuw scherm. Het is die twee kolommen met de
werkelijkheid vullen; de bestaande schermen doen de rest vanzelf.

## Waarom dit in SQL zit en niet in een agent

Optellen en delen heeft één juist antwoord. Een taalmodel kan daar niets aan
toevoegen en er wel iets aan verzinnen. De hele berekening is daarom een
databasefunctie, en de agent-runtime roept hem alleen aan.

Dat maakte een klein nieuw begrip in de runtime nodig: **systeemtaken**. Die
lopen door dezelfde wachtrij, met dezelfde logging, retries en zichtbaarheid,
maar zonder Claude ertussen. `feedback_sync` is de eerste. Kosten: nul tokens,
nul euro. De testlus controleert expliciet dat er geen enkele API-aanroep naar
het model gaat.

## Optellen doe je op de tellers

Het gemiddelde van drie ROAS-waarden is niet de ROAS over drie dagen. Een dag
met €5 spend en een dag met €500 spend wegen niet gelijk. De view `ad_totals`
telt daarom eerst de tellers op — spend, omzet, vertoningen, kliks — en
`creative_results` deelt daar pas overheen:

| | |
|---|---|
| `roas` | som(omzet) / som(spend) |
| `ctr` | som(kliks) / som(vertoningen) × 100 |
| `cpm` | som(spend) / som(vertoningen) × 1000 |
| `cpa` | som(spend) / som(aankopen) |
| `aov` | som(omzet) / som(aankopen) |
| `cvr` | som(aankopen) / som(link-kliks) |
| `hook_rate` | som(3-seconden views) / som(vertoningen) |
| `hold_rate` | som(thruplays) / som(3-seconden views) |

Gecontroleerd tegen echte Postgres met een gecontroleerde reeks: 5 dagen à €20
spend, 5.000 vertoningen, 100 kliks, 2 aankopen van €30. Uitkomst ROAS 3,000 ·
CTR 2,0000 · CPM 4,0000 · CPC 0,2000 · CPA 10,00 · AOV 30,00 · CVR 0,0250 ·
hook rate 0,3000 — alle acht gelijk aan de handberekening.

## Wanneer een oordeel telt

Een advertentie is `beoordeelbaar` als alle drie waar zijn:

- **≥ 4 dagen live** — Meta's attributie loopt tot ongeveer 72 uur na
- **≥ €50 besteed**
- **≥ 1.000 vertoningen**

Onder die drempels worden de cijfers wél weggeschreven (je mag zien wat er
gebeurt) maar verandert de **status niet**. Zo kan een advertentie die na één
dag toevallig ROAS 5 haalt niet als winnaar in de wizard belanden.

Dat is in de praktijk gecontroleerd: een testadvertentie van één dag met een
`winner`-oordeel kreeg zijn cijfers en behield `To Test`, terwijl een
advertentie van vijf dagen wél naar `Winner` ging.

## Van oordeel naar status

De status volgt het advies van Bolt, niet het cijfer alleen — `Iterate` zegt
iets anders dan `Winner`, ook bij dezelfde ROAS.

| Oordeel / actie | Status in de console |
|---|---|
| `verdict = winner` | `Winner` |
| `action = iterate` | `Iterate` |
| `action = pause` | `Killed` |
| te weinig data | `Live` (blijft draaien, geen oordeel) |

Twee dingen die niet gebeuren:

- **`Killed` blijft `Killed`.** Wat een mens heeft weggezet wordt niet door een
  agent teruggehaald.
- **Niets wordt overschreven waar geen meting van is.** Alleen creatives met een
  gepubliceerde advertentie én cijfers komen in aanmerking.

## Voorbij de losse advertentie

Eén advertentie zegt weinig — die kan geluk hebben gehad. `angle_learnings` telt
op per hoek en persona: hoeveel advertenties, hoeveel besteed, welke ROAS,
hoeveel winnaars. Met een `betrouwbaar`-vlag die pas aan gaat bij minstens drie
advertenties en €300 spend. Daaronder is het een anekdote.

Dat is de laag waarop de vraag "welke hoek werkt bij deze doelgroep" een echt
antwoord krijgt in plaats van een gevoel. De sterkste hoek wordt bij elke run in
de live-feed genoemd, zodat het opvalt zonder dat iemand een tabel opent.

## De ochtendcyclus is nu een cyclus

De volgorde is gaan tellen. Meten, oordelen, terugschrijven, en pas daarna
briefen — zodat Nova de uitkomst van gisteren ziet en niet die van eergisteren.

| Tijd (UTC) | Wie | Wat |
|---|---|---|
| 05:00 | Atlas | dagrapport op accountniveau |
| 05:20 | Bolt | scorecard per advertentie, oordeel per ad |
| 05:40 | systeem | cijfers terug naar de creatives |
| 06:00 | Nova | pipeline bijwerken en het team briefen |

De tijden staan als data in `schedules`, dus verschuiven kan zonder deploy. De
runtime corrigeert zelf voor zomer- en wintertijd.

## Wat er nog niet is

- **Uitgeputte hooks markeren.** Een hoek die drie keer achtereen zakt zou een
  waarschuwing moeten geven vóór iemand er een vierde variant op maakt. De data
  ligt er; het signaal nog niet.
- **Shopify naast Meta.** `utm_content=wg-<id>` staat in elke gepubliceerde link
  en komt terug in de bestelling. Daarmee kan de echte omzet per creative naast
  Meta's eigen attributie worden gelegd. Aparte ronde, eigen koppeling.
