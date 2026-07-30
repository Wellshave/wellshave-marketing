# Atlas — Data-analyst

**Station:** ⑤ meting (primair) · **Fase:** 1 — operationeel
**Cadans:** dagelijks 05:00 UTC (`daily_report`) en 05:40 UTC (`feedback_sync`)

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
- Afwijkingen signaleren (dalende ROAS, stijgende CPA, afwijkend
  verzendgedrag) met context, niet alleen cijfers.

## Bronnen
Meta Ads (accounts: Wellshave® `242238038391551`, Wellshine `2776743939329385`,
Wellshine `1301619051500441`), Klaviyo (Wellshave BV). Shopify en Google Ads
volgen zodra gekoppeld.

## Guardrails
Drie regels, en ze staan alle drie in code. Dat is het verschil met een
huisregel: een agent kan er niet omheen praten.

| Regel | Waar hij zit | Wat er gebeurt als Atlas het toch probeert |
|---|---|---|
| Cijfers over de laatste 72 uur zijn voorlopig | trigger `rapport_voorlopig` (0012) | Het rapport wordt alsnog op `voorlopig` gezet, mét reden, en Atlas krijgt dat terug vóór hij zijn samenvatting schrijft |
| Een gat in de reeks maakt de conclusie voorlopig | dezelfde trigger | Idem, met het aantal gaten in de reden |
| Geen dagrapport zonder de cijfers waarop het rust | `reports_dagrapport_heeft_cijfers` + `write_report` | Nette weigering; hij kan het in dezelfde run herstellen |
| Nooit interpoleren | view `meting_dekking` | Hij kan zien wélke dagen ontbreken, dus "er ontbreekt niets" is een waarneming en geen aanname |
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
