# 📜 Activiteitenlog

> Doorlopend logboek: elke agent-run en elk bericht tussen agents krijgt hier
> een regel (nieuwste bovenaan). De volledige historie staat in Supabase
> (`marketing_hq.agent_runs` en `agent_messages`).

- **2026-08-11** · Systeem · **Permissieprobleem opgelost.** De routine
  vroeg bij elke Meta Ads-, Klaviyo- en Trendtrack-aanroep om handmatige
  toestemming, waardoor onbeheerd draaien in de praktijk onmogelijk was.
  Alle **lees**-tools staan nu in `.claude/settings.json` (in de repo, niet
  lokaal, want de container wordt per sessie opnieuw opgezet).
  Schrijf-acties — budgetten, campagnes, e-mails — blijven expliciet
  goedkeuring vragen, conform `agents/GUARDRAILS.md`.
- **2026-08-11** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar; alleen het brein bijgewerkt. Meta-connector viel halverwege
  deze ronde weg → **Wellshine-cijfers 7–10/8 ontbreken**.
- **2026-08-11** · Nova · Voorstel **#10** ingediend (funnelrol van 001
  vaststellen: 58% van het budget draait op ROAS 0,90 over 7 dagen); #3
  gaat daarin op; **#1 juist versterkt** (Advertorial 1,98 over de week,
  beste van het account); #2 herkaderd (e-mailkanaal stopte abrupt na een
  wekelijkse cadans — waaróm?). BALZY-item gecorrigeerd.
- **2026-08-11** · Radar · Minimale scan (9 credits): ✅ **de zesdaagse
  Trendtrack-freeze is voorbij**, freshness-check groen. `reachDelta` maar
  half gerepareerd (4 van 6); BALZY's totale reach daalde van 33,3M naar
  30,5M — onmogelijk bij een cumulatief getal. **BALZY bleek op te ruimen,
  niet op te schalen**: 54 → 31 varianten, overblijvers 17–24 dagen actief.
- **2026-08-11** · Atlas · Ochtendcyclus (inhaalronde 7–10/8, na 2 gemiste
  cycli): **eerste toepassing van het 7-daagse venster** — 001 krijgt 58%
  van het budget voor ROAS 0,90, terwijl Advertorial (1,98) en TOFU (1,60)
  het met minder geld beter doen. Advertorial deed 7,82 op 10/8.
  E-mailkanaal dag 60, lijst +109 naar 4.367. 7/8 en 8/8 definitief.
- **2026-08-09/10** · Systeem · **Geen ochtendcyclus uitgevoerd** — de
  achtergrondprocessen van beide runs zijn verloren gegaan, hetzelfde
  patroon als op 4 en 5 augustus. Vier cycli op deze manier gemist; sinds
  11/8 worden de datapulls daarom direct uitgevoerd in plaats van
  gedelegeerd.
- **2026-08-08** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-08-08** · Nova · Twee voorstellen ingediend over onze **eigen
  meetbetrouwbaarheid**: #8 (dagelijkse campagne-ROAS is bij 3–5
  aankopen/dag geen signaal → 7-daags venster) en #9
  (Trendtrack-datakwaliteit escaleren + Cloud Nine-tracker opschonen).
  Beide prioritaire kansen herbouwd op reach-onafhankelijke onderbouwing;
  Cloud Nine Summer Sale naar observatie. Correctienotitie op de briefing
  van 7/8, waarin ten onrechte stond dat gerichte calls verse data geven.
- **2026-08-08** · Radar · Marktscan (139 credits): 🛑 **hele
  Trendtrack-dataset bevroren sinds 4 augustus** (bewezen via
  `daysRunning`, 10 ads / 5 merken); `reachDelta`-velden aantoonbaar kapot
  (Δ1d > Δ30d — de "+198.808 step-change" van 7/8 was een artefact);
  **Cloud Nine-tracker vervuild** met Channel 4 en twee vakbladen,
  waardoor eerdere volumecijfers deels van een Britse omroep waren.
  Kevin Junior-item opgelost (US-only ads rapporteren niets in EU/UK; dat
  merk is uit onze markten vertrokken). Werkwijze en creditcijfers in
  `agents/radar.md` gecorrigeerd.
- **2026-08-08** · Atlas · Ochtendcyclus: methodologische bevinding — bij
  3–5 aankopen per dag is dagelijkse campagne-ROAS grotendeels ruis en
  rouleert "de beste campagne" willekeurig; weken aan gerapporteerde
  "kantelingen" komen hier vandaan. Wellshine is de uitzondering: zes
  dagen, €352,18, nul aankopen, geen retro-attributie. 4/8 en 5/8
  definitief. Klaviyo dag 57, lijst +20 naar 4.258.
- **2026-08-07** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-08-07** · Nova · **Beide eigen voorstellen van gisteren
  afgehandeld zonder besluit van het team:** #6 (budgetverdeling)
  **ingetrokken** nadat TOFU naar nul viel en 001 juist 3,00 deed; #7
  (creditbudget) **opgelost** doordat gerichte focus-calls het verbruik
  van 192 naar 87 brachten. Cloud Nine Summer Sale gedegradeerd naar
  testwaardig; nieuwe prioritaire kans manscaped gedocumenteerd
  (convergentie met BALZY op dezelfde bundelpropositie); BALZY-item
  versterkt. Correctienotitie op de briefing van 6/8.
- **2026-08-07** · Radar · Marktscan (87 credits): **ontdekt dat
  `daily_radar` gecachete rank-/reachcijfers serveert** — de
  prioriteitenlijst van 6/8 stond op verouderde data; werkwijze aangepast
  in `agents/radar.md`. Cloud Nine Summer Sale gedegradeerd (394 nieuwe
  ads bleek eenmalige dump, vandaag 67); BALZY's echte topperformer
  alsnog gevonden (58 dagen, 371.631 reach, +198.808/1d); manscaped
  geprioriteerd (multi-markt-uitrol, 18/18 identieke copy). Bewust
  overgeslagen en dus nog open: Kevin Junior "Skeleton Pro Detailer" en
  "CLOUD NINE Australia".
- **2026-08-07** · Atlas · Ochtendcyclus: het beeld kantelde binnen één
  dag — TOFU naar nul, 001 naar 3,00 (5 aankopen, volledige accountomzet).
  Wellshave klimt 3 dagen op rij naar 1,68, telkens op een andere
  campagne. Wellshine: vijf volle dagen, €302,58, nul gemeten aankopen;
  Airstyler Nova 12 nuldagen op rij. 3/8 en 4/8 definitief. Klaviyo dag
  56, lijst +15 naar 4.238.
- **2026-08-06** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-08-06** · Nova · **Eerste prioritaire kans gearchiveerd als
  niet-doorgekomen** (Cloud Nine Airshot Pro, 2/8) — inclusief leerpunt
  over signaalsterkte. Nieuwe prioritaire kans toegevoegd (Cloud Nine
  Summer Sale-bundel); BALZY-item 3e keer bevestigd. Voorstellen #6
  (scheve budgetverdeling Wellshave) en #7 (creditbudget Radar)
  aangemaakt; #4 verscherpt naar accountniveau; #1 en #3 aangescherpt;
  watch-item Brothers in Style opgelost.
- **2026-08-06** · Radar · Marktscan: 491 nieuwe ads (hoogste ooit), 394
  van Cloud Nine. Nieuwe prioritaire kans (Cloud Nine Summer Sale),
  BALZY-bundel 3e bevestiging (43→54 varianten). Airshot Pro-kans van 2/8
  niet doorgekomen. Brothers in Style hersteld. Nieuw merk getrackt:
  manscaped.com. **192 credits gebruikt — boven het budget van ~150,
  gemeld conform guardrail** (7.569 resterend).
- **2026-08-06** · Atlas · Ochtendcyclus (inhaalronde 2–5 augustus, na 2
  gemiste cycli): TOFU-campagne deed 5,47 op €25,75 terwijl de 3× duurdere
  hoofdcampagne op 0,70 bleef — scheve budgetverdeling gesignaleerd.
  Wellshine 4 volle dagen zonder gemeten aankoop op €239,94; Airstyler
  Nova 11 nuldagen op rij. 2/8 en 3/8 definitief. Klaviyo dag 55, lijst
  +59 naar 4.223.
- **2026-08-04/05** · Systeem · **Geen ochtendcyclus uitgevoerd** — de
  achtergrondprocessen van beide runs zijn verloren gegaan door een
  technisch probleem. Atlas' cijfers zijn op 6/8 volledig ingehaald (Meta
  levert historie na); **Radars marktscans van deze twee dagen zijn
  definitief verloren** — Trendtrack toont geen historie.
- **2026-08-03** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-08-03** · Nova · Correctienotitie toegevoegd aan het rapport van
  1/8 (campagne-discrepantie tweemaal bevestigd niet gevonden, 31/7
  definitief zonder die campagne). Prioritaire pipeline-items bijgewerkt
  met vervolgonderzoek (BALZY 2e dag bevestigd, Cloud Nine "too early to
  call"-risico toegevoegd). Approvals #1, #3, #4, #5 bijgewerkt na de
  omslag van de piekdag van 1/8.
- **2026-08-03** · Radar · Marktscan: BALZY-bundel en Cloud Nine Airshot
  Pro beide een 2e dag bevestigd als prioritaire kans; Cloud Nine-hook nu
  bekend maar Trendtrack noemt het zelf "too early to call". Brothers in
  Style LP-impressies dalen 2 dagen op rij (-85k), nieuw watch-item. 132
  credits (7.861 resterend).
- **2026-08-03** · Atlas · Ochtendcyclus: "002 – CBO – Advertorials"
  tweemaal grondig gezocht, niet gevonden — 31/7 definitief bevestigd op
  €168,61/ROAS 1,10. Piekdag van 1/8 bleek eenmalig: GroomGuard-test
  terug naar 0,93, Advertorial Pages geen enkele gemeten aankoop.
  Airstyler Nova 8 nuldagen op rij. 30/7 en 31/7 definitief. Klaviyo dag
  52 stil, lijst +15 naar 4.164.
- **2026-08-02** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-08-02** · Nova · Eerste toepassing van de nieuwe
  prioritaire-kans-regel: 2 🔥-items aangemaakt (BALZY-bundel → SkinSafe
  Body Shaver, Cloud Nine Airshot Pro → Wellshine Airstyler/Hairdryer),
  elk met volledige 9-punts-documentatie in `Pipeline/Items/`. Approval
  #5 verzwaard naar "actie vereist" (onopgeloste campagne-discrepantie).
  Approvals #1, #3, #4 bijgewerkt; testimonial-notitie gecorrigeerd
  (Rick Loonen-naamverwarring rechtgezet).
- **2026-08-02** · Radar · Marktscan: eerste toepassing van de
  prioritaire-kans-regel — BALZY-bundel (rankDelta +234) en Cloud Nine
  Airshot Pro (rankDelta +378) geprioriteerd. Kevin Junior-anomalie
  verergert verder + nieuwe aparte trackingfout; Brothers in Style
  LP-impressies daalden ongebruikelijk. 126 credits (8.164 resterend).
- **2026-08-02** · Atlas · Ochtendcyclus: ⚠️ campagne
  "002 – CBO – Advertorials" niet terug te vinden — 31/7 herberekend naar
  €168,61/ROAS≈1,10 i.p.v. €276,48/0,67, vraagt menselijke verificatie.
  Sterkste dag in weken op 1/8 (blended ROAS ≈2,03): Advertorial Pages
  3,15, GroomGuard-test 2,10 (3 dagen herstel). Airstyler Nova 7 nuldagen
  op rij. 29/7 en 30/7 definitief. Klaviyo dag 51 stil, lijst +36 naar
  4.149.
- **2026-08-01** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-08-01** · Nova · Approval #3 gede-escaleerd (GroomGuard-test
  herstelde naar 1,45, tweedaagse daling zette niet door); approval #5
  aangemaakt (nieuwe testcampagne "002 – CBO – Advertorials" ter
  kennisgeving, navraag aanbevolen); approval #4 ongewijzigd; approval #2
  ongewijzigd (4 drafts, dag 50 stil).
- **2026-08-01** · Radar · Marktscan: 61 nieuwe ads (forse terugval).
  Cloud Nine's ad-piek volledig genormaliseerd; BALZY's "Beard Balls
  Bundle" sterkste schaler; Kevin Junior-impressie-anomalie verergert
  (+272k/24u, cijfer voorlopig onbruikbaar); BALZY-partnerships niet
  verifieerbaar deze scan (buiten partner-cap). 126 credits (8.290
  resterend).
- **2026-08-01** · Atlas · Ochtendcyclus: GroomGuard-test herstelt naar
  1,45 op 31/7 (tweedaagse daling doorbroken); nieuwe campagne
  "002 – CBO – Advertorials" gestart (€108,31, nog geen resultaten);
  Wellshave-accountspend piekte naar €276,48; Wellshine: Airstyler Nova
  6 nuldagen op rij; 28/7 en 29/7 definitief; Klaviyo dag 50 stil, lijst
  +29 naar 4.113.
- **2026-07-31** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-07-31** · Nova · Approval #3 verscherpt (GroomGuard-test daalt 2
  dagen op rij na de piek, 0,80→0,58 — cappen aan de orde als het doorzet);
  approval #4 weer verbreed naar heel Wellshine (herstel van Hairdryer
  Briza bleek eenmalig); approval #2 bijgesteld (4 klaarstaande drafts,
  niet 1); approval #1 ongewijzigd. Pipeline-notities versterkt
  (hoofd-scheerapparaat-LP-groei bevestigd reëel, BALZY-partnership
  schaalt op).
- **2026-07-31** · Radar · Marktscan: 210 nieuwe ads; Cloud Nine-ad-piek
  3e dag verhoogd (128, licht dalend); impressie-sprongen Brothers in
  Style/Cloud Nine bevestigd reëel (geen meetartefact); BALZY's Rick
  Loonen-partnership schaalt op (+569% reach); nieuwe Kevin
  Junior-impressie-anomalie ontdekt. 126 credits (8.416 resterend).
- **2026-07-31** · Atlas · Ochtendcyclus: Wellshave® derde daaldag op rij
  sinds de piek van 28/7 (0,35 op 30/7, zwakste tot nu toe); GroomGuard-
  test twee dagen dalend na de piek (0,80→0,58); Wellshine's herstel van
  29/7 bleek eenmalig, Airstyler Nova 5 nuldagen op rij; 27/7 en 28/7
  definitief; Klaviyo: 4 drafts ontdekt (niet 1), dag 49 stil, lijst +16
  naar 4.084.
- **2026-07-30** · Systeem · Supabase-schrijftoegang nog steeds niet
  beschikbaar deze sessie (geen connector gekoppeld) — ook deze ronde
  alleen het brein (`brain/`) bijgewerkt.
- **2026-07-30** · Nova · Approval #4 toegespitst op "Airstyler Nova" (4
  nuldagen op rij) nu "Hairdryer Briza" de nulstreak doorbrak (2,03 op
  29/7); approval #3 bijgewerkt (GroomGuard-test blijft wisselvallig, 0,80
  na 2,34); approval #1 ongewijzigd. Pipeline-notities bijgewerkt met
  nieuwe Trendtrack-bevestiging.
- **2026-07-30** · Radar · Marktscan: 279 nieuwe ads (bijna dubbel
  gisteren); Cloud Nine's ad-piek zet 2 dagen op rij door (geen
  dataglitch); Meridian reactiveert (95 nieuwe ads); MAE voor het eerst
  zichtbaar actief; Brothers in Style hoofd-scheerapparaat-reach blijft
  1,3M+; BALZY-partnerships nog vroege testfase. 128 credits (8.979
  resterend).
- **2026-07-30** · Atlas · Ochtendcyclus: Wellshave® zwakste dag van de
  laatste vier (0,50 op 29/7) — GroomGuard-test terug naar 0,80 na 2,34;
  Wellshine's nulstreak doorbroken door Hairdryer Briza (2,03), Airstyler
  Nova op 4 nuldagen op rij; 26/7 en 27/7 definitief, 28/7 voorlopig;
  Klaviyo dag 48 stil, lijst +15 naar 4.068.
- **2026-07-29** · Systeem · Supabase-schrijftoegang (`marketing_hq.agent_runs`,
  `.metrics_daily`, `.reports`, `.pipeline_items`, `.approvals`) niet
  beschikbaar deze sessie — geen Supabase-connector gekoppeld aan deze
  Claude-sessie. Alleen het brein (`brain/`) is bijgewerkt; Supabase loopt
  hierdoor tijdelijk uit sync met de vault. Volgende sessie met
  Supabase-connector moet dit gat inhalen.
- **2026-07-29** · Nova · Approval #4 aangemaakt (Wellshine
  pauzeren/onderzoeken — 3 nuldagen op rij ondanks spend terug in de
  "goede" zone, spend-disciplinehypothese weerlegd); approval #3
  bijgewerkt (GroomGuard-test boven 2,0-drempel, 2,34 op 28/7); approval #1
  ongewijzigd (advertorial-kanteling niet bevestigd, terug naar 1,00);
  hoofd-scheerapparaat-LP extra bevestigd (Brothers in Style, 1,3M reach).
- **2026-07-29** · Radar · Marktscan: 149 nieuwe ads (grotendeels Cloud
  Nine, mogelijk dataglitch); Brothers in Style hoofd-scheerapparaat-video
  1,3M reach (sterkste signaal tot nu toe); Ace & Taylor curler-hook beste
  rank van de scan; BALZY testimonial-topschaler + 3 nieuwe
  creator-partnerships; Sansbeauté SansStraight ontdekt (261 dagen, langst
  lopende LP). 107 credits (9.107 resterend).
- **2026-07-29** · Atlas · Ochtendcyclus (haalde ontbrekend 28/7-rapport
  in): Wellshave® herstelt naar 2,11 op €159,07 (beste sinds 23/7);
  Wellshine derde nuldag op rij (26/7–28/7) — discipline-hypothese
  weerlegd; GroomGuard-test boven 2,0 (2,34); Advertorial terug naar 1,00;
  25/7 en 26/7 definitief, 27/7 voorlopig; Klaviyo dag 47 stil
  (verzenddatum gecorrigeerd naar 12 juni).
- **2026-07-27** · Nova · Approval #3 gede-escaleerd (GroomGuard-test hersteld
  1,39 → monitoren); advertorial kantelt (3d-gem. 2,12 ↗); hoofd-
  scheerapparaat-LP naar Hypothese.
- **2026-07-27** · Radar · Marktscan: erg rustig (27 nieuwe ads); Brothers in
  Style hoofd-scheerapparaat-LP 173 dagen/128k impressies (grootste LP);
  BALZY-influencer blijft schalen; Meridian koelt af (75 credits, 9.214
  resterend).
- **2026-07-27** · Atlas · Ochtendcyclus: Wellshave® blended 1,89 op €198,18;
  GroomGuard-test hersteld naar 1,39; advertorial 3,57 (beste sinds 17/7,
  3-daags 2,12 ↗); Wellshine liet discipline los (€86,78, geen return); 24/7
  def 1,11; Klaviyo dag 45 stil.
- **2026-07-26** · Nova · **Approval #3 aangemaakt**: GroomGuard-testcampagne
  001 pauzeren/cappen (€106/dag @ 0,56); advertorial-advies ongewijzigd
  (3d-gem. 1,24); Wellshine-discipline-hypothese bevestigd.
- **2026-07-26** · Radar · Marktscan: 88 nieuwe ads (rustiger); Meridian koelde
  af naar 28 + IPL-laser-hoek; BALZY-influencer schaalt dag na dag door
  (VECHTERSBAZEN15 +173); Ace & Taylor mechanisme-hook breed (75 credits,
  9.289 resterend).
- **2026-07-26** · Atlas · Ochtendcyclus: Wellshave® blended 0,61 op €187,97
  door runaway GroomGuard-test (€106 @ 0,56); Wellshine 4,23 op laagste spend;
  advertorial 3-daags 1,24; 22/7 def 2,20, 23/7 def 1,75; Klaviyo dag 44 stil.
- **2026-07-25** · Nova · Advertorial-advies verhard naar **níét uitvoeren**
  (3 dagen dalend, 3d-gem. 1,93); testimonial-static → prioriteit ↑↑ na
  BALZY-topschalers (218k reach).
- **2026-07-25** · Radar · Marktscan: 161 nieuwe ads; Meridian opnieuw 120 in
  1 dag + 2 partners; BALZY-influencer 218k reach topschaler; Cloud Nine July
  Sale +499 (75 credits, 9.251 resterend).
- **2026-07-25** · Atlas · Ochtendcyclus: 24/7 blended 1,12 (spend-effect:
  nieuwe GroomGuard-test €45,77 zonder aankopen); Advertorial 3 dagen dalend
  (0,92, 3-daags 1,93); Wellshine-flip hield 1 dag; 22/7 definitief 2,20;
  Klaviyo dag 43 stil.
- **2026-07-24** · Nova · Advertorial-advies ongewijzigd (te volatiel om te
  scalen); Meridian-explosie versterkt urgentie testimonial-static.
- **2026-07-24** · Radar · Marktscan: 184 nieuwe ads; Meridian dumpte 133 ads
  in 1 dag; BALZY-influencer 461k reach (75 credits, 9.277 resterend).
- **2026-07-24** · Atlas · Ochtendcyclus: 23/7 blended 1,76; Wellshine flipte
  naar 2,25; Advertorial terug op 1,38 (3-daags 2,53, te volatiel); 21/7
  definitief 3,60; Klaviyo dag 42 stil.
- **2026-07-23** · Nova · Advertorial-advies ongewijzigd (afwachten tot
  3d-gemiddelde de 3,0 raakt; nu 2,30 stijgend); Wellshine-spenddaling
  genoteerd.
- **2026-07-23** · Radar · Marktscan: 67 nieuwe ads; BALZY-influencer 455k;
  Cloud Nine July Sale rankDelta 478; Meridian +2 UGC-partners (75 credits,
  9.352 resterend).
- **2026-07-23** · Atlas · Ochtendcyclus: 22/7 blended 2,20; Advertorial
  tweede goede dag (3,42), 3-daags ~2,30; Wellshine-spend daalt; 20/7
  definitief 0,88; Klaviyo dag 41 stil.
- **2026-07-22** · Nova · Advertorial-advies bijgesteld (afwachten i.p.v.
  afwijzen na herstel 3,61); testimonial-hypothese sterker (Meridian rank 6).
- **2026-07-22** · Radar · Marktscan: 80 nieuwe ads; Meridian-testimonial
  rank 6 (4e dag); BALZY-influencer 447k reach (75 credits, 9.427 resterend).
- **2026-07-22** · Atlas · Ochtendcyclus: sterke ommekeer 21/7 (blended
  3,61, alle campagnes mee); advertorial 3-daags ~2,07; Wellshine onder 1,0;
  18/7 definitief 1,54; Klaviyo dag 40 stil.
- **2026-07-21** · Nova · Advies approval #1: afwijzen (3d-gem. 1,24);
  nieuw idee dedicated hoofd-scheerapparaat-LP; Wellshine-analyse
  aangevraagd.
- **2026-07-21** · Radar · Marktscan: 116 nieuwe ads; Meridian-offensief
  (42 ads + 3 UGC-partners); BALZY-influencer 440k reach (75 credits,
  9.502 resterend).
- **2026-07-21** · Atlas · Ochtendcyclus: zwakke dag 20/7 (0,88 / 0,90);
  advertorial 3d-gemiddelde 1,24; Wellshine-spend verdrievoudigd; 17/7
  definitief 4,18; Klaviyo dag 39 stil.
- **2026-07-20** · Nova · Testimonial-statics → Hypothese (2 dagen
  bevestiging); advertorial-caveat aangescherpt: 3d-gemiddelde 2,93 < 3,0.
- **2026-07-20** · Radar · Marktscan: rustige dag (60 nieuwe ads);
  Meridian-testimonial rank 13, BALZY-influencer 192k reach (75 credits,
  9.577 resterend).
- **2026-07-20** · Atlas · Ochtendcyclus: herstel 19/7 (blended 1,96;
  Advertorial 2,72, GroomGuard 2,18); 18/7-advertorial blijft op nul;
  16/7 definitief 0,98; Klaviyo-stilte bevestigd.
- **2026-07-19** · Nova · Bundel-test → Hypothese; nieuw idee
  testimonial-statics; kanttekening van Atlas verwerkt in approval #1.
- **2026-07-19** · Radar · Marktscan: 225 nieuwe ads/24u; BALZY-bundel
  bevestigd (2e dag), Meridian review-statics, Brothers in Style 12×
  barber-fresh (75 credits, 9.652 resterend).
- **2026-07-19** · Atlas · Ochtendcyclus: volatiele dag 18/7 (blended 1,55;
  Advertorial €34,58 zonder gemeten aankopen, GroomGuard 4,51); 17/7
  bevestigd op 4,18; waarschuwing naar Nova over dagbasis-condities.
- **2026-07-18** · Nova · Pipeline gevuld (3 concepten met hypotheses); 2
  approvals klaargezet (advertorial-budget, SGL-mail).
- **2026-07-18** · Radar · Eerste marktscan: 302 nieuwe concurrent-ads/24u;
  briefing met 3 voorstellen gepubliceerd (75 Trendtrack-credits).
- **2026-07-18** · Atlas · Ochtendcyclus: ROAS-dip omgeslagen (17/7: 4,19);
  dagrapport gepubliceerd; e-mailkanaal-signaal afgegeven.
- **2026-07-17** · Atlas · Eerste datapull Meta Ads (3–16 juli, 2 accounts) +
  dagrapport gepubliceerd; ROAS-dip-signaal naar Nova.
- **2026-07-17** · Systeem · Pulse-dashboard v1 gebouwd (Supabase Auth +
  team-RLS); routine-runs van vanochtend leverden geen output — onderzoek loopt.
- **2026-07-17** · Systeem · Marketing HQ opgezet: team gedefinieerd, brein
  geïnitialiseerd, Supabase-schema aangemaakt, dagelijkse ochtendcyclus
  ingepland (07:00 NL).
