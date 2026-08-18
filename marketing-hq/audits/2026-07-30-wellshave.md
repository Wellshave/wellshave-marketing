# Meta Account Audit — Wellshave®

**Account** `242238038391551` · **Periode** 30 juni – 29 juli 2026 · **Valuta** EUR
**Gedraaid** 30 juli 2026, met de hand via de Meta Ads MCP
**Opportunity Score** 54/100

Dit is de eerste audit, en hij is met de hand gedraaid om te zien wát er
uitkomt voordat er code van werd gemaakt. Migratie `0013_audit.sql` is op deze
uitkomsten gebouwd; de cijfers hieronder staan als fixture in
`platform/db/test/audit.sh`.

---

## Samenvatting

€3.425,92 in 30 dagen, ROAS **1,74** over de actieve campagnes. Winstgevend
maar niet ruim, en het gemiddelde verbergt twee dingen.

**Het `engaged`-publiek draait op frequentie 17.** 53.792 vertoningen op 3.164
mensen, voor €410. Op accountniveau staat de frequentie op 2,78 en lijkt er
niets aan de hand.

**Het lek zit niet in de advertenties.** De trechter verliest 57% tussen
winkelwagen en checkout, en de advertenties met de hoogste CTR hebben de
laagste ROAS. Meer materiaal lost dat niet op.

## Vitals

| | 30 dagen |
|---|---|
| Uitgegeven | € 3.425,92 |
| Vertoningen | 513.459 |
| Bereik | 184.989 |
| Frequentie | 2,78 |
| CPM | € 6,67 |
| CPP | € 18,52 |

Van dat bedrag zit €2.597,38 in de drie actieve campagnes. De overige
**€828,54 (24%)** staat in campagnes die uit staan, en daarvoor gaf deze pull
geen omzet terug. Een accountbrede ROAS is dus niet eerlijk te berekenen.

## Trechter

| Campagne | LPV | ATC | IC | Aankopen | LPV→ATC | ATC→IC | IC→Aankoop |
|---|---|---|---|---|---|---|---|
| Advertorial Pages | 1.526 | 133 | 50 | 43 | 8,7% | 37,6% | 86,0% |
| TOFU-CBO-GroomGuard | 703 | 80 | 33 | 28 | 11,4% | 41,3% | 84,8% |
| 001-CBO-GroomGuard | 477 | 20 | 18 | 10 | 4,2% | 90,0% | 55,6% |
| **Totaal** | **2.706** | **233** | **101** | **81** | **8,6%** | **43,3%** | **80,2%** |

Twee meetfouten, benoemd in plaats van gladgestreken:

- **001-CBO meldt 37 ViewContents op 477 landingspagina-weergaven.** De
  bestemming vuurt het event niet. Zolang dat zo is optimaliseert Meta op ruis.
- **Diezelfde campagne heeft 90% ATC→IC maar 56% IC→Aankoop**, omgekeerd aan de
  andere twee. Bij 20 ATC kan dat toeval zijn.

## Publiek

| Segment | Uitgegeven | Aandeel | Vertoningen | Bereik | Frequentie |
|---|---|---|---|---|---|
| prospecting | € 3.014,75 | 88,0% | 459.568 | 185.682 | 2,47 |
| **engaged** | **€ 410,49** | **12,0%** | **53.792** | **3.164** | **17,0** |
| unknown | € 0,68 | 0,0% | 99 | 95 | 1,04 |

## Campagnes

| Campagne | Spend | Aankopen | Omzet | CPA | ROAS | Freq | CTR |
|---|---|---|---|---|---|---|---|
| Advertorial Pages | € 1.168,41 | 43 | € 2.464,32 | € 27,17 | 2,11 | 4,01 | 1,38% |
| TOFU-CBO-GroomGuard-05.06 | € 893,42 | 28 | € 1.500,66 | € 31,91 | 1,68 | 1,83 | 2,30% |
| 001-CBO-GroomGuard-23-07 | € 535,55 | 10 | € 554,97 | € 53,56 | 1,04 | 1,90 | 2,02% |

## Advertenties

Accountmediaan: ROAS 2,03 · CTR 1,41%. Twee signalen, niet drie — zie
"Wat niet te zien was".

| Advertentie | Spend | ROAS | CTR | Oordeel |
|---|---|---|---|---|
| WS - 200 - 2 | € 961,92 | 2,03 | 1,41% | rond de mediaan op beide |
| C1 - 4 Reasons Why | € 400,85 | 0,78 | 2,36% | ↑CTR ↓ROAS — niet stoppen |
| WS - 102 - 1 - Copy | € 305,12 | 2,23 | 2,92% | ↑ beide — opschalen |
| WS169IT - 2 | € 191,57 | 2,14 | 1,40% | boven op ROAS |
| WS - 201 - 2 | € 189,32 | 2,69 | 1,06% | ↑ROAS ↓CTR |
| WSLP - 182 - 2 | € 62,08 | 0,87 | 2,74% | ↑CTR ↓ROAS |
| C3 - Social Proof | € 44,22 | 0,81 | 0,92% | onder de drempel |
| C1 - 4 Reasons Why *(ander ad set)* | € 34,97 | 4,21 | 1,25% | zelfde creative, 5× de ROAS |
| WSLP - 184 - 2 | € 30,89 | 0,00 | 3,83% | hoogste CTR, nul aankopen |

Twee patronen:

**Dezelfde creative in twee ad sets, ROAS 0,78 tegen 4,21.** Dat is geen
creative-probleem maar de fragmentatie die Meta zelf ook flagt.

**Hoge CTR gaat samen met lage ROAS.** Het materiaal levert het verkeer; wat
daarna gebeurt is het probleem. Dat sluit aan op de trechter.

## Leveringsproblemen

| Soort | Aantal |
|---|---|
| "This ad is not delivering" (advertenties) | 37 |
| "This ad is not delivering" (ad sets) | 6 |
| Paused on High Invalidation Rate | 4 |
| No Valid Formats | 1 |
| Ad Processing Error | 1 |
| Invalid media | 1 |

Lijst afgekapt op 50 — er kunnen er meer zijn.

**Veiligheidscheck schoon.** Geen "Pause ads for compromised account", geen
"Custom audience not available".

## Meta's aanbevelingen — 54/100

| Punten | Wat | Waar |
|---|---|---|
| 8 | 4 ad sets, zelfde opzet en doelgroep, ander materiaal | `120252205202740577`, `120252206157130577`, `120252206157140577`, `120252206157150577` |
| 3 | Nog eens 4 ad sets, zelfde probleem | `120250501609270577`, `120250501864910577`, `120250502050930577`, `120250502197840577` |
| 3 | Automatisch muziek toevoegen | 42 advertenties |
| 3 | A+ Standard Enhancements | 10 advertenties |
| 2 | Budget-gelimiteerd | 3 ad sets |

## Wat te doen

**Nu**
1. `engaged`-segment stilzetten of begrenzen — frequentie 17 voor €410.
2. De vier ad sets `…202740577 / …157130577 / …157140577 / …157150577` samenvoegen.
3. ViewContent repareren op de bestemming van 001-CBO.

**Deze week**
4. WS-102-1-Copy opschalen — het enige creatieve dat op beide signalen boven de mediaan zit.
5. De winkelwagen→checkout-stap onderzoeken; 57% verlies daar is meer waard dan nieuw materiaal.
6. De vier "High Invalidation Rate"-advertenties opruimen.

**Later**
7. Frequentie op Advertorial Pages (4,01) volgen.
8. A+ Standard Enhancements en muziek aanzetten — 6 punten voor weinig werk.
9. De 24% spend in inactieve campagnes uitzoeken.

## Wat niet te zien was

| Ontbrak | Waarom |
|---|---|
| Kwaliteits-, engagement- en conversierangschikking | `ads_insights_auction_ranking_benchmarks` gaf geen data — twee keer geprobeerd |
| CTR tegen de industriebenchmark | `ads_insights_industry_benchmark` gaf geen data |
| Hook rate en hold rate | niet via deze weg beschikbaar |
| Pixel/EMQ-gezondheid | niet opgevraagd |
| Advertentieteksten | niet opgehaald; de hoekanalyse leunt op namen |
| ROAS per publiekssegment | Meta geeft conversies niet terug bij een segment-breakdown |
| De overige vier accounts | alleen Wellshave® gedraaid |

## Correctie achteraf

Deze audit adviseerde **C3 - Social Proof** te stoppen op ROAS 0,81 en CTR
0,92%. Dat advies rustte op €44,22 spend, onder de eigen ondergrens van €50 en
1.000 vertoningen die sinds 0008 voor elk oordeel geldt. De scorekaart in 0013
geeft die advertentie daarom géén oordeel, maar de reden waarom niet.

Volgens de regels die nu in de database staan verdient **geen enkele
advertentie in dit account een stop**. Dat is een strengere uitkomst dan de
handmatige audit gaf, en het is de juiste.
