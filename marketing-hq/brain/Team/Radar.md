# Radar — Trend- & Concurrentiescout

**Status:** 🟢 actief — **databron is hersteld** (freeze voorbij per 11/8)
**Laatste run:** 2026-08-11 · minimale gerichte scan (9 credits)
**Huidige taak:** verse baseline opbouwen nu de data weer meebeweegt.
**Nog open:** `daily_radar` (nieuwe ads per merk), manscaped-baseline,
Cloud Nine, "CLOUD NINE Australia" — bewust overgeslagen deze ronde

> Identiteit, skills en guardrails: [`agents/radar.md`](../../agents/radar.md).

## Laatste activiteit
- **2026-08-11** · [[../Briefings/2026-08-11|Trendbriefing]]: ✅ **de
  zesdaagse datafreeze is voorbij** — freshness-check groen op vier ads.
  Maar de `reachDelta`-velden zijn **half gerepareerd** (4 van 6 consistent)
  en BALZY's *totale* reach daalde van 33,3M naar 30,5M, wat bij een
  cumulatief getal niet kan. 🔥 Belangrijkste inhoudelijke correctie:
  **BALZY heeft opgeruimd, niet opgeschaald** — varianten van 54 naar 31,
  met de overblijvers 17–24 dagen actief. Dat is een sterker signaal dan
  de groei die wij op bevroren data meenden te zien. 9 credits gebruikt.
- **2026-08-08** · [[../Briefings/2026-08-08|Trendbriefing]]: 🛑 **de hele
  Trendtrack-dataset staat stil sinds 4 augustus** (bewezen via
  `daysRunning` over 10 ads en 5 merken) — dit corrigeert de conclusie van
  7/8 dat gerichte calls "vers" zouden zijn. Daarnaast: `reachDelta`-velden
  aantoonbaar kapot (Δ1d > Δ30d; de "+198.808" was een artefact) en de
  **Cloud Nine-tracker vervuild met Channel 4** en twee vakbladen.
  Voorstel #9 ingediend. Beide prioritaire kansen gehandhaafd op
  reach-onafhankelijke gronden; Cloud Nine naar observatie. Kevin
  Junior-item opgelost (US-only ads rapporteren niets in EU/UK) — dat merk
  is uit onze markten vertrokken. Werkwijze in `agents/radar.md`
  gecorrigeerd, inclusief de creditcijfers (`costUnits` ≈ 1,5×).
- **2026-08-07** · [[../Briefings/2026-08-07|Trendbriefing]]: ⚠️ ontdekt dat
  **`daily_radar` gecachete rank-/reachcijfers serveert** — de
  prioriteitenlijst van 6/8 stond op verouderde data. Werkwijze
  aangepast in `agents/radar.md`. Gevolgen: Cloud Nine Summer Sale
  **gedegradeerd** (394 nieuwe ads bleek eenmalige dump, vandaag 67), en
  BALZY's echte topperformer alsnog gevonden (58 dagen, 371.631 reach,
  +198.808/1d). Nieuwe prioritaire kans: **manscaped** multi-markt-uitrol.
  Creditbudget opgelost via gerichte focus-calls: **87 i.p.v. 192**.
- **2026-08-06** · [[../Briefings/2026-08-06|Trendbriefing]]: **491 nieuwe
  ads — hoogste ooit gemeten**, waarvan 394 van Cloud Nine alleen. Twee
  prioritaire kansen: een **nieuwe** Cloud Nine Summer Sale-bundel en
  BALZY's bundel (3e bevestiging, 43→54 varianten). ❌ De Airshot
  Pro-kans van 2/8 is **niet doorgekomen** — geen breakout, dalende rank;
  gearchiveerd. ✅ Brothers in Style-watch-item opgelost (impressies
  herstelden). Nieuw getrackt merk: manscaped.com. ⚠️ Creditbudget
  overschreden: 192 vs ~150 — gemeld als voorstel #7. Scans van 4 en 5/8
  zijn definitief verloren (geen historie beschikbaar).
- **2026-08-03** · [[../Briefings/2026-08-03|Trendbriefing]]: beide
  prioritaire kansen een 2e dag bevestigd — BALZY-bundel schaalt door (43
  varianten), Cloud Nine Airshot Pro's hook nu bekend (technologie/
  prijsactie) maar Trendtrack zelf noemt het "too early to call" (6 dagen
  actief). Brothers in Style's LP-impressies dalen 2 dagen op rij (-85k
  sinds 1/8) — watch-item, vermoedelijk trackinganomalie. 132 credits
  (7.861 resterend).
- **2026-08-02** · [[../Briefings/2026-08-02|Trendbriefing]]: **eerste
  toepassing van de nieuwe prioritaire-kans-regel** — 2 kansen
  geprioriteerd: BALZY's bundelactie (rankDelta +234, 4/6 signalen) en
  Cloud Nine's Airshot Pro (grootste rankdelta van de scan, +378).
  Correctie: "Rick Loonen"-partnership bleek naamverwarring
  (rickdekkernl, zwak signaal). Kevin Junior-anomalie verergert verder
  (1,41M impr.) + nieuwe aparte trackingfout ontdekt. Brothers in Style
  LP-impressies daalden ongebruikelijk (-44k). 126 credits (8.164
  resterend).
- **2026-08-01** · [[../Briefings/2026-08-01|Trendbriefing]]: 61 nieuwe
  ads (forse terugval na de piekdagen). Cloud Nine's ad-piek volledig
  genormaliseerd (8, was 147). BALZY's "Beard Balls Bundle" sterkste
  schaler van de dag (+231 rankDelta). Kevin Junior-impressie-anomalie
  verergert (+272k in 24u) — cijfer voorlopig niet bruikbaar. 126 credits
  (8.290 resterend).
- **2026-07-31** · [[../Briefings/2026-07-31|Trendbriefing]]: 210 nieuwe
  ads. Cloud Nine's ad-piek zakt licht (128) maar blijft 3e dag verhoogd
  (4,3× normaal). Impressie-sprongen van gisteren bij Brothers in Style en
  Cloud Nine hairdryer-collectie **bevestigd reëel**, geen meetartefact.
  BALZY's Rick Loonen-partnership schaalt aantoonbaar op (+569% reach).
  Nieuwe anomalie ontdekt bij Kevin Junior (impressies +627% zonder
  dagen-verandering, vermoedelijk trackingissue). 126 credits (8.416
  resterend).
- **2026-07-30** · [[../Briefings/2026-07-30|Trendbriefing]]: 279 nieuwe
  ads (bijna dubbel zoveel als gisteren) — Cloud Nine's ad-piek zet 2
  dagen op rij door (146, geen dataglitch); Meridian reactiveert (95
  nieuwe ads); MAE voor het eerst zichtbaar actief (36). Brothers in
  Style's hoofd-scheerapparaat-reach blijft 1,3M+. Kanttekening: sterke
  impressie-sprongen bij enkele LP's wijzen op een meetmethode-verschil,
  niet per se echte 24u-groei. 128 credits (8.979 resterend).
- **2026-07-29** ·
- **2026-07-29** · [[../Briefings/2026-07-29|Trendbriefing]]: 149 nieuwe ads
  (grotendeels Cloud Nine, mogelijk dataglitch); **Brothers in Style
  hoofd-scheerapparaat-video haalt 1,3M reach** (sterkste signaal tot nu
  toe); Ace & Taylor curler-hook beste rank van de scan; BALZY blijft
  testimonial-topschaler + 3 nieuwe creator-partnerships. Sansbeauté
  SansStraight ontdekt als langst lopende LP (261 dagen). 107 credits
  (9.107 resterend).
- **2026-07-27** · [[../Briefings/2026-07-27|Trendbriefing]]: erg rustig (27
  nieuwe ads); **Brothers in Style hoofd-scheerapparaat-LP = 173 dagen / 128k
  impressies** (grootste LP) → hoofd-scheerapparaat-LP naar hypothese;
  BALZY-influencer blijft schalen; Meridian koelt af. 75 credits (9.214
  resterend).
- **2026-07-26** · [[../Briefings/2026-07-26|Trendbriefing]]: rustiger (88
  nieuwe ads); Meridian koelde af naar 28 + test nieuwe IPL-laser-hoek;
  **BALZY-influencer schaalt dag na dag door** (VECHTERSBAZEN15 +173) →
  testimonial-static blijft #1; Ace & Taylor mechanisme-hook schaalt breed.
  75 credits (9.289 resterend).
- **2026-07-25** · [[../Briefings/2026-07-25|Trendbriefing]]: 161 nieuwe ads;
  **Meridian opnieuw 120 ads in 1 dag** + 2 nieuwe partners;
  **BALZY-influencer (Rick Dekker) 218k reach** is topschaler → testimonial-
  static-signaal; Cloud Nine July Sale +499. 75 credits (9.251 resterend).
- **2026-07-24** · [[../Briefings/2026-07-24|Trendbriefing]]: 184 nieuwe ads;
  **Meridian dumpte 133 ads in 1 dag** (creative-explosie); BALZY-influencer
  461k reach; Cloud Nine July Sale 107k. 75 credits (9.277 resterend).
- **2026-07-23** · [[../Briefings/2026-07-23|Trendbriefing]]: 67 nieuwe ads;
  BALZY-influencer 455k reach; Cloud Nine July Sale rankDelta 478 (83k);
  Meridian +2 UGC-partners, testimonial-static rank 10. 75 credits (9.352
  resterend).
- **2026-07-22** · [[../Briefings/2026-07-22|Trendbriefing]]: 80 nieuwe ads;
  Meridian-testimonial-static naar **rank 6** (4e dag stijgend);
  BALZY-influencer 447k+199k; Brothers in Style LP 46 ads/168 dagen.
  Creditgebruik: 75 (9.427 resterend).
- **2026-07-21** · [[../Briefings/2026-07-21|Trendbriefing]]: 116 nieuwe
  ads; Meridian-offensief (42 ads + 3 UGC-partners); BALZY-influencer
  440k+196k reach; Brothers in Style LP-patroon (167 dagen) → nieuw idee.
  Creditgebruik: 75 (9.502 resterend).
- **2026-07-20** · [[../Briefings/2026-07-20|Trendbriefing]]: rustige dag
  (60 nieuwe ads); Meridian-testimonial klimt naar rank 13 (2e dag),
  BALZY-influencer 192k reach, Brothers in Style gladde kop 56k.
  Creditgebruik: 75 (9.577 resterend).
- **2026-07-19** · [[../Briefings/2026-07-19|Trendbriefing]]: 225 nieuwe
  ads/24u; BALZY-bundel schaalt door (61k+33k), Meridian testimonial-statics,
  Brothers in Style 12× barber-fresh. Creditgebruik: 75 (9.652 resterend).
- **2026-07-18** · [[../Briefings/2026-07-18|Trendbriefing]]: 302 nieuwe
  concurrent-ads/24u; patronen: bundels (BALZY), UGC-creators (alle
  concurrenten), advertorial-funnels. 3 voorstellen naar [[Nova]].
  Creditgebruik: 75 (9.727 resterend).
