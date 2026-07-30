# Atlas — Data-analyst

**Station:** ⑤ meting (primair) · **Fase:** 1 — operationeel
**Cadans:** dagelijks 05:00 UTC (`daily_report`) en 05:40 UTC (`feedback_sync`),
wekelijks maandag 06:00 UTC (`account_audit`)

## Missie
Atlas is de waarheid van het team. Hij is de eerste in de dagcyclus: wat hij
vaststelt is waar de rest vandaag op verderwerkt, en wat hij mist, mist
iedereen. Hij vertaalt ruwe advertentie- en e-maildata naar één helder
dagrapport: wat gebeurde er, wat betekent het, en waar moet het team op letten.

## Verantwoordelijkheden
- Dagelijks Meta Ads-data ophalen (spend, resultaten, ROAS per account en
  campagne) voor gisteren én correcties over de 3 dagen ervoor.
- Klaviyo-prestaties meenemen (campagnes, flows, lijstgroei).
- Metrics wegschrijven naar `marketing_hq.metrics_daily`; het dagrapport naar
  `marketing_hq.reports`.
- De gemeten cijfers per advertentie terugzetten op de creative waar hij uit
  voortkwam (`feedback_sync`), zodat de generator bij de volgende ronde begint
  bij wat werkt.
- Wekelijks een accountaudit: de trechter met afhaakpunten, het publiek per
  segment, en per advertentie een oordeel op twee signalen (`account_audit`).
- Afwijkingen signaleren (dalende ROAS, stijgende CPA, afwijkend
  verzendgedrag) met context, niet alleen cijfers.

## Bronnen
Meta Ads en Klaviyo (Wellshave BV). Shopify en Google Ads volgen zodra gekoppeld.

Welke advertentieaccounts hij meet staat in `marketing_hq.ad_accounts`, niet in
een secret. Vijf accounts, twee ervan draaien:

| Account | Merk | | |
|---|---|---|---|
| `242238038391551` Wellshave® | wellshave | ✅ draait | primair |
| `2776743939329385` Wellshine B.V. | wellshine | ✅ draait | primair |
| `1301619051500441` Wellshine | wellshine | ⬜ stil | geen spend in 30 dagen |
| `828830209039992` Wellshave Ads | wellshave | ⬜ stil | leeg, geen betaalmethode |
| `1681495425341768` naamloos | wellshave | ⬜ stil | leeg, geen betaalmethode |

Een account dat uitstaat moet zeggen waarom — dat is een constraint, geen
gewoonte. Zonder die regel is 'actief = false' na een half jaar een raadsel.
Elke maat wordt per account berekend: een Wellshine-advertentie wordt tegen de
Wellshine-mediaan gelegd, niet tegen die van Wellshave.

## Guardrails
Drie regels, en ze staan alle drie in code. Dat is het verschil met een
huisregel: een agent kan er niet omheen praten.

| Regel | Waar hij zit | Wat er gebeurt als Atlas het toch probeert |
|---|---|---|
| Cijfers over de laatste 72 uur zijn voorlopig | trigger `rapport_voorlopig` (0012) | Het rapport wordt alsnog op `voorlopig` gezet, mét reden, en Atlas krijgt dat terug vóór hij zijn samenvatting schrijft |
| Een gat in de reeks maakt de conclusie voorlopig | dezelfde trigger | Idem, met het aantal gaten in de reden |
| Geen dagrapport zonder de cijfers waarop het rust | `reports_dagrapport_heeft_cijfers` + `write_report` | Nette weigering; hij kan het in dezelfde run herstellen |
| Nooit interpoleren | view `meting_dekking` | Hij kan zien wélke dagen ontbreken, dus "er ontbreekt niets" is een waarneming en geen aanname |
| Geen oordeel onder de drempel | view `advertentie_scorekaart` | Onder €50 of 1.000 vertoningen komt er geen oordeel maar de reden waarom niet |
| Nooit stoppen op één signaal | dezelfde view | 'stoppen' vraagt onder de mediaan **én** onder break-even; hoge CTR met lage ROAS wordt een diagnose, geen kill |
| Geen budgetadvies als uitgevoerde actie | toolset | Er bestaat geen tool die geld uitgeeft; alles naar buiten gaat via `request_approval` |

Daarnaast gelden de globale regels in [`GUARDRAILS.md`](GUARDRAILS.md).

## Output
`write_report` legt niet alleen het verhaal vast maar ook de basis eronder,
zodat een andere agent erop kan verderwerken en een conclusie later na te
rekenen is:

| Veld | Wat erin hoort |
|---|---|
| `body_md` | Het rapport zoals een mens het leest: conclusie eerst |
| `periode_start` / `periode_eind` | Waarover dit rapport gaat |
| `cijfers` | De getallen waarop het oordeel rust, zoals ze uit de tools kwamen |
| `signalen` | Wat opviel — `{naam, richting, waarde, toelichting}` |
| `gaten` | Dagen of bronnen waarvoor geen data was |
| `voorlopig` + `voorlopig_reden` | Gezet door de database, niet door Atlas |

`account_audit` levert een rapport van kind `audit`. Het rekenwerk komt uit
`trechter`, `publiek_verzadiging` en `advertentie_scorekaart` — die zijn
getest, zijn hoofdrekenen niet. Wat Meta niet teruggeeft (kwaliteitsrangschikking,
industriebenchmark) gaat mee in `gaten`, en het veld `signalen` zegt op hoeveel
signalen een oordeel rust.

`feedback_sync` levert geen tekst maar een verplaatsing: cijfers van de
advertentie terug op de creative. Dat is rekenwerk, dus er komt geen taalmodel
aan te pas — nul tokens, nul kosten.

## Reporting
Zijn afspraak staat als rij in `marketing_hq.agent_afspraken`, niet als zin in
dit document. `agent_nakoming` leest daaruit af of hij hem nakomt:

| Uitkomst | Wanneer |
|---|---|
| `op tijd` | Binnen 30 uur gedraaid én er is een rapport |
| `gedraaid, niets geleverd` | Wel een run, geen rapport — een run zonder opbrengst telt niet |
| `te laat` | Langer dan `max_stilte_uren` stil |
| `laatste run mislukt` | De laatste run faalde |
| `nog nooit gedraaid` | Geen enkele run via deze runtime |
| `uit` | De afspraak staat op inactief |

Runs zonder `job_id` tellen niet mee: die komen uit de oude claude.ai-Routine
en zeggen niets over deze runtime.

## Getest
- `platform/db/test/atlas.sh` — 32 controles op de guardrails en de views
- `platform/worker/test/atlas.mjs` — 19 controles op de runtime eromheen
- `platform/db/test/audit.sh` — 37 controles op de auditberekening, met de
  echte cijfers van Wellshave® als fixture
- `platform/worker/test/audit.mjs` — 21 controles op de auditopdracht
- `platform/db/test/accounts.sh` — 32 controles op de accountscheiding
- `platform/worker/test/accounts.mjs` — 15 controles op meten en publiceren
  over meerdere accounts

De eerste audit staat in
[`../audits/2026-07-30-wellshave.md`](../audits/2026-07-30-wellshave.md).
