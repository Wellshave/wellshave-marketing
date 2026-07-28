# Atelier Console — User Journeys v1

*Vervolg op ATELIER-CONSOLE-BLUEPRINT.md en -DATAMODEL.md. Tien flows, elk beschreven als: startpunt → beslissingen → menselijke acties → AI-ondersteuning → benodigde data → statusovergangen → foutscenario's → eindresultaat.*

Rollen: **A**dmin, **S**trategist, **M**aker, **P**erformance.

---

## Flow 1 — Van performance-signaal naar beslissing

**Startpunt.** De nachtelijke ingest heeft PerformanceSnapshots geschreven; De Analist heeft Verdicts geproduceerd. De gebruiker (S/P/A) opent **Vandaag** en ziet de verdictwachtrij, gesorteerd op geldimpact (spend × afwijking).

**Beslissingen.** Per verdict één vraag: volg ik het voorstel (scale/iterate/kill/continue), wijk ik af, of stel ik uit (met reden)?

**Menselijke acties.** Verdict openen → cijfers + redenering + familieboom-context bekijken → klik: overnemen of afwijken (afwijken vraagt een korte reden). Bij "iterate": doorstuurknop naar Flow 4. Bij "kill": bevestiging; de eigenlijke pauzering in Meta is in v1 nog handwerk (fase 3 van de Meta-koppeling), dus het systeem toont een checklist-item "pauzeer in Ads Manager" tot de Publication-status is bijgewerkt.

**AI-ondersteuning.** De Analist: verdict + redenering + confidence. Bij twijfel van de gebruiker: doorvraagbaar ("waarom kill en niet meer budget?") in de context van het verdict — geen losse chat.

**Benodigde data.** PerformanceSnapshots (≥ door merk ingestelde minimum-spend/dagen), Test-context, breakeven/target-ROAS per merk, eerdere Decisions op verwante tests.

**Statusovergangen.** Verdict: open → accepted/overridden. Test: live → deciding → decided (bij kill/winner) of blijft live (bij continue). Decision aangemaakt met `followed_verdict`.

**Foutscenario's.** (1) Stale data — ingest ouder dan 24u: verdictwachtrij toont een datawaarschuwing en De Analist weigert nieuwe verdicts op oude cijfers. (2) Te weinig data: geen verdict, wel een "nog te vroeg"-regel met de drempel. (3) Twee gebruikers beslissen tegelijk: eerste Decision wint, tweede krijgt een conflictmelding.

**Eindresultaat.** Elke openstaande verdict heeft een menselijk besluit met audittrail; kills en winners stromen door naar Flow 6 (learning); "Vandaag" is leeg = klaar.

---

## Flow 2 — Van gat in de dekking naar nieuwe test

**Startpunt.** De coverage-engine (server-side, draait na elke ingest) vergelijkt de matrix product × persona × angle × funnel met de test-historie en schrijft Recommendations (kind=coverage_gap/stale_persona). Gebruiker (S/A) ziet ze in **Vandaag** onder "Gaten".

**Beslissingen.** Is dit gat het testen waard (versus bewust onbezet)? Welke prioriteit? Quick of strategic tier?

**Menselijke acties.** Recommendation openen → accepteren (→ Studio opent met vooringevulde context uit de payload) of afwijzen mét reden ("dit persona is bewust gepauzeerd") — die reden voorkomt dat hetzelfde gat blijft terugkomen.

**AI-ondersteuning.** De Strateeg formuleert bij acceptatie direct 1–3 kandidaat-hypotheses voor het gat, gevoed door de learnings en angle-data van aangrenzende cellen ("bij dit persona werkte angst-framing in stadium 2 — probeer dat hier").

**Benodigde data.** Volledige testhistorie per matrixcel, angle-statussen, learnings, Recommendation-payload.

**Statusovergangen.** Recommendation: open → accepted/dismissed. Hypothesis: backlog → attached. Test: → draft.

**Foutscenario's.** (1) Gaten-spam — te veel cellen leeg: engine toont top-N op verwachte impact, nooit de hele lijst. (2) Gat geaccepteerd maar test nooit afgemaakt: draft-tests ouder dan X dagen verschijnen terug in Vandaag als "half werk".

**Eindresultaat.** Een Test in draft met hypothese, context en herkomst (`source=gap`) — naadloos door naar Flow 3.

---

## Flow 3 — Van idee naar gepubliceerde Meta-draft

**Startpunt.** De **Studio**, via één van de vijf ingangen: idee/braindump, geaccepteerd gat (Flow 2), winner-iteratie (Flow 4), concurrent-ad (Flow 8), of foto-transformatie. Rol: M/S/A.

**Beslissingen.** Tier (quick/strategic)? Context: product, persona, angle, format, funnel? Outputtype? Hoeveel varianten? Welke variant(en) gaan door naar publicatie?

**Menselijke acties.** (1) Startpunt kiezen → braindump of vooringevulde context. (2) Hypothese bevestigen/aanscherpen (strategic: verplicht scherp; quick: één regel). (3) Concepten laten genereren, kiezen, beelden genereren en bewerken (de bestaande edit-stack). (4) Pre-flight review doorlopen. (5) "Klaarzetten voor Meta" — kiest ad account + campagne/adset, controleert naam + UTM's. (6) **Expliciete bevestigingsklik door iemand met `can_publish`** (M kan alles voorbereiden, maar niet bevestigen).

**AI-ondersteuning.** De Strateeg (braindump → context + hypothese), De Maker (concepten: hook/headline/body/CTA/image prompt + hypothese-koppeling), De Copywriter (definitieve Meta-copy per gekozen variant), De Criticus (pre-flight: safe zones, leesbaarheid, merkconsistentie, Meta-beleidsrisico's, voorspelde zwaktes — blokkeert niet, maar een genegeerde rode vlag wordt gelogd).

**Benodigde data.** Brand-profiel, Product (incl. assets), Persona+Angle, Format-recept, relevante Learnings (geïnjecteerd), ad-account-structuur uit Meta (accounts/campagnes/adsets lezen).

**Statusovergangen.** Test: draft → ready. Creative: concept → in_review → approved. Publication: (nieuw) → draft_prepared → pushed_as_draft. Test: ready → live zodra de ad in Meta actief wordt (gedetecteerd door de ingest, niet door de gebruiker).

**Foutscenario's.** (1) Meta-API-fout bij push: Publication blijft draft_prepared met foutdetail; retry-knop; nooit halve pushes (creative + copy + naam in één transactie of niets). (2) Criticus vindt beleidsrisico: gebruiker beslist, override wordt gelogd. (3) Geen `can_publish`-gebruiker beschikbaar: Publication wacht in "klaar voor bevestiging"-rij, zichtbaar in Vandaag van A/P. (4) Image-generatie faalt: variant blijft in draft, rest van de flow niet geblokkeerd.

**Eindresultaat.** Een draft-ad in de Meta ad account, correct benoemd en getagd, gekoppeld aan een Test die vanaf activering automatisch gemeten wordt. Geen PNG-download, geen overtikken.

---

## Flow 4 — Van winner naar iteraties

**Startpunt.** Een Decision `winner` (uit Flow 1) of de knop "itereer" op een winnende test in het **Testlab**.

**Beslissingen.** Wélke dimensie variëren we (en houden we de rest vast)? Hoeveel iteraties tegelijk? Quick tier (default) of strategic (als de iteratie eigenlijk een nieuw concept is)?

**Menselijke acties.** Iteratievoorstel van De Analist bekijken → dimensies aanvinken (hook/achtergrond/persona/…) → per dimensie genereert de Studio een child-test met geërfde context → verder als Flow 3 vanaf stap 3.

**AI-ondersteuning.** De Analist onderbouwt *welke* dimensie het meest belooft op basis van de funnel-cijfers (sterke hook rate + zwakke CTR → varieer niet de hook maar de belofte/CTA — de bestaande funnel-diagnose-logica, nu gevoed door echte data i.p.v. overgetikte cijfers). De Maker houdt bij generatie alle niet-gekozen dimensies aantoonbaar constant.

**Benodigde data.** Parent-test met creatives + snapshots, familieboom (eerdere iteraties en hun uitkomst — niet nogmaals testen wat al faalde), learnings.

**Statusovergangen.** Nieuwe Tests: draft → … (Flow 3), elk met TestRelationship `iteration_of` + `varied_dimension`. Parent-test: decided → archived zodra de iteratiegeneratie live is.

**Foutscenario's.** (1) Iteratie op een al eerder geteste dimensie: systeem waarschuwt met het eerdere resultaat. (2) Winner te vroeg uitgeroepen (weinig data): De Analist markeert de confidence laag; de gebruiker mag door, maar het staat erbij.

**Eindresultaat.** 1–n child-tests live, elk één dimensie verschillend, met complete afstamming — de familieboom groeit met interpreteerbare takken.

---

## Flow 5 — Van live test naar verdict

**Startpunt.** Automatisch, geen gebruiker: de nachtelijke ingest (upgrade van de bestaande daily-check-routine) haalt per gekoppelde ad account de metrics op en schrijft PerformanceSnapshots.

**Beslissingen.** (Door het systeem, volgens door mensen ingestelde regels:) heeft deze test genoeg data voor een verdict? Drempels per merk instelbaar: minimum spend, minimum dagen, minimum impressies.

**Menselijke acties.** Geen — dat is het punt. Uitzondering: P/A kan een verdict on-demand forceren ("beoordeel nu") en kan drempels bijstellen.

**AI-ondersteuning.** De Analist draait per test-boven-drempel: snapshotreeks + testcontext + breakeven-doelen + familieboomhistorie → Verdict (proposal, reasoning, confidence). Batchgewijs, één keer per nacht + on-demand.

**Benodigde data.** Meta Insights per ad (spend, impressions, reach, CPM, CTR, CPC, ATC, purchases, CPA, ROAS, hook/hold rate waar beschikbaar), Publication-koppeling ad↔creative↔test, merkdoelen.

**Statusovergangen.** Test: live → deciding zodra er een open verdict ligt. Verdict: → open (en → expired als er dagenlang niet beslist wordt — dan opnieuw beoordeeld met verse data).

**Foutscenario's.** (1) API-limiet/storing: ingest markeert de run onvolledig; Vandaag toont de datagezondheid; geen verdicts op halve data. (2) Ad handmatig in Ads Manager aangepast (budget/status): ingest detecteert de afwijking en logt hem bij de Publication — het systeem blijft de waarheid volgen i.p.v. zijn eigen aannames. (3) Niet-gekoppelde ad ontdekt in het account: verschijnt als "wees-ad" met een koppel-voorstel (match op naamconventie).

**Eindresultaat.** Elke live test heeft actuele cijfers en — zodra hij rijp is — een beargumenteerd verdict in de wachtrij van Flow 1. Handmatig cijfers overtikken bestaat niet meer.

---

## Flow 6 — Van verdict naar learning

**Startpunt.** Een Decision `winner` of `kill` (Flow 1). Het afsluitritueel start automatisch.

**Beslissingen.** Is de voorgestelde learning wáár (of was de uitkomst toeval/verstoord)? Op welk niveau geldt hij (angle? persona? format? algemeen)? Is hij een bevestiging van een bestaande learning (→ strength verhogen) of nieuw?

**Menselijke acties.** S/P leest het learningvoorstel → redigeert de zin (of verwerpt hem: "test was vervuild, geen learning") → bevestigt scope. Bewust een verplichte stap: een test kan niet naar archived zonder learning óf expliciete geen-learning-reden.

**AI-ondersteuning.** De Analist stelt de learning voor: één zin, met scope-suggestie en verwijzing naar bestaande verwante learnings ("dit is de derde keer dat prijs-hooks falen bij koud publiek — samenvoegen tot strength=repeated?").

**Benodigde data.** Test + hypothese + uitkomst, bestaande learnings (voor dedupe/versterking), familieboom.

**Statusovergangen.** Learning: → active (of bestaande learning: strength verhoogd, evidence uitgebreid). Test: decided → archived. Hypothesis: → confirmed/rejected/inconclusive.

**Foutscenario's.** (1) Learning-moeheid — gebruikers klikken gedachteloos door: het systeem detecteert ongewijzigd-geaccepteerde voorstellen en rapporteert dat percentage aan A (kwaliteitssignaal). (2) Tegenstrijdige learnings: nieuwe learning die een actieve tegenspreekt → beide getoond, mens kiest: supersede of naast elkaar (met context-voorwaarde).

**Eindresultaat.** Het Brein groeit met één geverifieerde, herleidbare zin; de hypothese-uitkomst is vastgelegd; de test is netjes dicht.

---

## Flow 7 — Van learning naar toekomstige AI-context

**Startpunt.** Automatisch, bij elke AI-aanroep: de AI-gateway stelt de context samen.

**Beslissingen.** (Systeemregels, door mensen instelbaar:) welke learnings zijn relevant voor déze aanroep? Selectie op scope-match (zelfde product/persona/angle/format), strength en recentheid — top-N, niet alles (contextdiscipline).

**Menselijke acties.** Geen tijdens de flow. Wel zichtbaar: elke AI-output toont *welke* learnings zijn meegegeven ("gebaseerd op 4 learnings — bekijk"). S/A kan een learning muten voor generatie ("waar maar niet meer relevant").

**AI-ondersteuning.** Dit ís de ondersteuning van de ondersteuning: De Maker die geen prijs-hooks meer voorstelt voor koud publiek omdat de learning dat verbiedt — zonder dat iemand het hoefde te zeggen.

**Benodigde data.** Learnings met scope-refs, de context van de aanroep (test/product/persona), AISpecialistInteraction-log (welke learnings werden geïnjecteerd — voor evaluatie achteraf).

**Statusovergangen.** Geen; wel logging: `injected_learning_ids` per interactie.

**Foutscenario's.** (1) Learning-vervuiling — een foute learning stuurt alles scheef: daarom herleidbaarheid (elke output toont zijn learnings) en het mute-mechanisme. (2) Contextoverflow bij veel learnings: harde top-N + samenvattende compressie van oudere learnings per scope.

**Eindresultaat.** Het systeem van volgend kwartaal geeft aantoonbaar ander (beter) advies dan dat van vandaag, en je kunt precies aanwijzen door welke learnings dat komt.

---

## Flow 8 — Van concurrent-ad naar eigen test

**Startpunt.** Studio-ingang "concurrent": upload/screenshot van een concurrent-ad (de bestaande Kopieer-ad-flow, nu testgebonden). Rol: M/S.

**Beslissingen.** Wat lenen we — letterlijk, de mechaniek, of alleen het idee (de bestaande fidelity-keuze)? Voor welk product/persona vertalen we het? Is dit een quick of strategic test?

**Menselijke acties.** Upload → analyse bekijken → fidelity + te behouden elementen kiezen → context kiezen → verder als Flow 3. De hypothese wordt hier deels vóórgeschreven: "de [mechaniek X] van [concurrent] werkt ook voor [ons product] bij [persona]".

**AI-ondersteuning.** De Maker analyseert de mechaniek (bestaande capability); De Strateeg toetst: *hebben we deze mechaniek al eens getest?* (familieboom + learnings-check — voorkomt het heruitvinden van eigen mislukkingen); De Criticus let extra op onbedoeld kopiëren (merkverwarring, claims die wij niet kunnen waarmaken).

**Benodigde data.** Het geüploade beeld (Asset, kind=reference), testhistorie op mechaniek/format, learnings.

**Statusovergangen.** Als Flow 3; TestRelationship `competitor_derived` met het referentie-asset als bron.

**Foutscenario's.** (1) Mechaniek al getest en gefaald: hard signaal met het eerdere resultaat vóór er iets gegenereerd wordt. (2) Claim-risico gedetecteerd: Criticus-vlag, override gelogd.

**Eindresultaat.** Een eigen test met eerlijke herkomst-administratie — en concurrent-inspiratie die systematisch wordt getoetst in plaats van impulsief gekopieerd.

---

## Flow 9 — Van losse sandbox-creative naar officiële test

**Startpunt.** De sandbox-modus van de Studio: spelen zonder hypothese-verplichting (`is_sandbox=true`). Iemand (M) heeft iets gemaakt dat beter is dan verwacht en wil het echt testen.

**Beslissingen.** Verdient dit een test? Zo ja: welke context (product/persona/angle) en — achteraf geformuleerd maar eerlijk — welke hypothese toetst het eigenlijk?

**Menselijke acties.** Knop "promoveer naar test" → de Studio vraagt de ontbrekende verplichte context alsnog uit (het formulier dat de sandbox oversloeg) → hypothese formuleren (De Strateeg stelt er één voor op basis van wat het beeld doet) → daarna Flow 3 vanaf de pre-flight.

**AI-ondersteuning.** De Strateeg reverse-engineert de hypothese ("dit beeld zet sociale bewijskracht boven productdemonstratie — wil je dát testen?"); De Criticus draait de volledige pre-flight die de sandbox oversloeg.

**Benodigde data.** Het sandbox-creative + zijn generatie-instellingen (die zijn er altijd, ook in sandbox), Brein-context.

**Statusovergangen.** Test: is_sandbox=true → false via promotie; TestRelationship `promoted_from_sandbox`. Creative-statussen lopen daarna regulier.

**Foutscenario's.** (1) Sandbox als sluiproute — alles eerst sandbox, dan promoveren om het hypothese-denken te omzeilen: de promotie eist dezelfde velden als een gewone test, dus er valt niets te winnen; het promotiepercentage per gebruiker is zichtbaar voor A. (2) Sandbox-rommel hoopt op: auto-opruiming na X dagen (met waarschuwing).

**Eindresultaat.** Speelruimte blijft bestaan (creativiteit heeft die nodig) zonder dat er ongeadministreerd geld live gaat; het goede speelwerk stroomt het systeem in, de rest verdampt netjes.

---

## Flow 10 — Van videoscript naar gekoppelde live video-ad

**Startpunt.** Studio, outputtype video: idee/winner/gat → De Maker schrijft het 3×6×3-script (bestaande capability) binnen een Test.

**Beslissingen.** Welke hookvarianten gaan mee (3 hooks = straks 3 CreativeVariants)? Zelf produceren of creator? Welke referentiebeelden en B-roll-instructies? Goedkeuring van de briefing vóór verzending?

**Menselijke acties.** Script redigeren → shotlist + creator-instructies + referentie-assets samenstellen (De Maker genereert het skelet) → S/A keurt de briefing goed → status handmatig bijhouden terwijl productie extern loopt (briefed → with_creator → in_edit) → geleverde video uploaden als Asset → approved → publicatieflow (Flow 3, stap 5–6) → na livegang koppelt de ingest de video-metrics (hook rate, hold rate, ThruPlays) aan dezelfde test.

**AI-ondersteuning.** De Maker: script, shotlist, B-roll- en creator-instructies, hookvarianten. De Criticus: briefing-check (haalbaarheid, merkfit, rechten-valkuilen). De Analist: na livegang de video-funnel-diagnose (de bestaande script-iteratielogica, nu met automatische cijfers) → iteratievoorstel per hook.

**Benodigde data.** Test-context, script-content (Creative type=script → type=video), referentie-Assets, creator-gegevens (vrij veld in v1 — geen creator-management-module), video-metrics uit de ingest.

**Statusovergangen.** Creative(video): concept → briefed → with_creator → in_edit → approved → published. Test: draft → ready → live → … regulier. De HQ-pipelinestatussen (idea→…→live) worden hiermee vervangen voor video.

**Foutscenario's.** (1) Productie duurt lang/stokt: with_creator ouder dan X dagen verschijnt in Vandaag als pijplijnsignaal. (2) Geleverde video wijkt af van script: goedkeuringsstap vangt dit; afwijking wordt genoteerd zodat de learning straks het júiste toetst. (3) Hook rate per variant vergt aparte ads in Meta: elke hookvariant wordt een eigen Publication onder dezelfde test — zo blijft per-hook-meting mogelijk.

**Eindresultaat.** Video zit volledig in het datamodel — van script tot gemeten live ad met per-hook-resultaten — terwijl de daadwerkelijke productie buiten de tool mag blijven. Geen video valt meer buiten de loop.

---

## Rode draden door alle flows

1. **Elke flow eindigt in het datamodel**, nooit in een download of een klembord.
2. **Elke AI-tussenkomst is een voorstel met herleidbare context** (welke learnings, welke cijfers) en wordt gelogd.
3. **Elke menselijke afwijking van een AI-voorstel is waardevolle data** (`followed_verdict`, dismissed-met-reden, genegeerde pre-flight-vlaggen) — dit bouwt het trackrecord dat fase-3-automatisering rechtvaardigt.
4. **Statussen bewegen alleen vooruit door acties**, nooit door aannames; waar het systeem de buitenwereld niet kan sturen (Meta-acties in v1, videoproductie) volgt het de werkelijkheid en toont het de kloof.
