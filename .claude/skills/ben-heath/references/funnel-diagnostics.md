# Funnel-diagnostiek voor landingspagina-tests

Veel ad sets in het Wellshave-account zijn testcellen voor landingspagina's, geen zelfstandige
winst-eenheden. Beoordeel ze daarom per funnel-stap en niet alleen op ROAS. Zie de memory
`adset-beoordeling-testcellen`.

## De vier poorten

Elke stap isoleert één ding. Zakt een cel op één poort maar niet op de andere, dan weet je precies
waar het probleem zit.

| Poort | Metric | Meet | Baseline Wellshave (30d, aug 2026) |
|---|---|---|---|
| 1. Advertentie | CTR / outbound CTR | Trekt de ad aandacht? | ~1,8% CTR |
| 2. Aankomst | LPV ÷ outbound clicks | Laadt de pagina? | **70%** |
| 3. Pagina | **ATC ÷ LPV** | Overtuigt de pagina? | **8,0%** |
| 4. Checkout | aankopen ÷ ATC | Rekent men af? | **29%** |

Kosten per landing page view: **€0,95** accountbreed (WS - 200 is met €0,56 het efficiëntst).

Ververs deze baselines bij elke meting; het zijn accountgemiddelden, geen externe benchmarks.

## Wanneer mag je oordelen: de LPV-drempel

ATC/LPV is een percentage rond de 8%, en dat schommelt hevig bij lage aantallen. Benodigde
steekproef per cel om een verschil betrouwbaar te zien (95% zekerheid, 80% power):

| Verschil dat je wilt kunnen zien | LPV per cel | Kosten per cel |
|---|---|---|
| **2x** (bv 8% vs 16%) | **~265** | ~€250 |
| 1,5x | ~900 | ~€860 |
| 1,25x | ~3.270 | ~€3.120 |

**Werkdrempel: 300 LPV per cel.** Daaronder is elk oordeel over de pagina giswerk.

- **< 100 LPV**: geen uitspraak doen, ook niet "ziet er goed uit"
- **100 tot 300 LPV**: alleen richtinggevend, en alleen bij extreme verschillen
- **300+ LPV**: 2x-verschillen zijn betrouwbaar
- **900+ LPV**: ook 1,5x-verschillen

Consequentie die je expliciet moet benoemen: subtiele pagina-verschillen zijn bij deze budgetten
**niet** te meten. Test daarom grove varianten (andere structuur, andere hoek), geen knopkleuren.

## Diagnosepatronen

Vergelijk de cel altijd met de accountbaseline hierboven, niet met een absolute norm.

**Goede ad, zwakke pagina**: CTR boven baseline, ATC/LPV onder baseline.
→ De pagina is het knelpunt. Ad laten staan, pagina herbouwen.

**Zwakke ad, sterke pagina**: CTR onder baseline, ATC/LPV boven baseline.
→ Zonde van een goede pagina. Zet er een bewezen creative voor.

**Cart-lek**: ATC/LPV boven baseline, aankopen/ATC onder baseline.
→ Niet de pagina maar de checkout, verzendkosten of prijs. Dit los je niet op met ads.

**Aankomstlek**: LPV/outbound clicks ver onder 70%.
→ Laadsnelheid of een kapotte link. Onder de 50% is het een storing, geen optimalisatiekwestie.

**Duur volume**: veel LPV bij lage ATC/LPV.
→ De duurste manier om te bewijzen dat een pagina niet werkt. Snel afkappen.

## Werkwijze bij elke meting

1. Haal per ad set op: `ctr`, `outbound_clicks_ctr`, `landing_page_view`, `omni_add_to_cart`,
   `results`, `purchase_roas`, `amount_spent`, `impressions`.
2. Bereken de vier poorten en het accountgemiddelde opnieuw.
3. Markeer per cel of hij de 300 LPV-drempel haalt. Zo niet, doe geen pagina-uitspraak.
4. Wijs per cel het patroon aan uit de lijst hierboven.
5. Geef pas daarna het economische oordeel (ROAS tegen breakeven), en alleen voor cellen die klaar zijn.

Let op: ATC en LPV kennen verschillende attributievensters, dus een percentage boven ongeveer 40%
is vrijwel altijd een meetartefact en geen prestatie.

Voor het daadwerkelijk herbouwen van een pagina: gebruik de skill `sanwarwala-landing-pages`.
