# Atelier Console — Migratieplan, Modularisatie & Roadmap v1

*Vervolg op ATELIER-CONSOLE-BLUEPRINT.md, -DATAMODEL.md en -USER-JOURNEYS.md.*

---

# Deel 1 — Migratieplan

## 1.1 Strategie: strangler fig, geen big-bang rewrite

De 21.000-regels-monoliet wordt niet in één keer vervangen. We bouwen de nieuwe applicatie **naast** de oude, op **dezelfde database**, en verhuizen werkruimte voor werkruimte. De oude app blijft gedurende de hele migratie werkend; per verhuisde werkruimte wordt het oude tab read-only en verwijst hij door. Pas als een werkruimte aantoonbaar volledig is (acceptatiecriteria per fase, deel 3), gaat het oude deel uit.

De volgorde van waarheid: **eerst de data normaliseren, dan de nieuwe leest mee, dan de nieuwe schrijft, dan de oude leest mee (compat-laag), dan de oude uit.**

## 1.2 Welke tabs verdwijnen en waar functionaliteit heen verhuist

| Huidige tab | Lot | Verhuist naar | Bijzonderheden |
|---|---|---|---|
| Dashboard/Cockpit | vervangen | **Vandaag** | Leaderboards en activiteitsring vervallen bewust (geen beslissing); "next best action" wordt de server-side Recommendation-engine |
| Statics | versmelt | **Studio** (ingang: idee/gat) | Kernflow blijft functioneel identiek, wordt testgebonden |
| Kopieer ad | versmelt | **Studio** (ingang: concurrent) | Fidelity-keuze blijft |
| Itereren | splitst | analyse → **Testlab**/De Analist; generatie → **Studio** (ingang: winner) | Handmatige metrics-invoer en screenshot-extractie worden vangnet i.p.v. hoofdpad |
| Ad transformer | versmelt | **Studio** (ingang: foto) | Theriot-score wordt Criticus/Maker-stap |
| Copywriter | versmelt | **Studio** (output-stap copy_set) | |
| Scriptwriter | versmelt | **Studio** (outputtype video/script) | Testplan-wizard gaat op in de strategic-tier-flow; Fable-spar-drawer wordt Strateeg-context |
| Bibliotheek | versmelt | **Archief** | Backup-export blijft tot migratie af is; daarna vervangt DB-export hem |
| Scripts | versmelt | **Archief** (+ Testlab voor lopende) | |
| Creative Strategy | vervangen | **Testlab** | De tabel-UI verdwijnt; de data wordt het Test-model zelf; paste-import blijft tijdens overgang |
| Persona's | versmelt | **Brein** | Angles worden eigen entiteit met trackrecord |
| Producten | versmelt | **Brein** | |
| Merk-instellingen | versmelt | **Brein** (merkbeheer-sectie) | Brandbook-extractie blijft |
| Handboek | vervalt als tab | contextuele hulp per werkruimte | Inhoud wordt opgeknipt en bij de flows geplaatst |
| Wijzigingen | vervalt als tab | klein "wat is nieuw"-signaal | Changelog-data blijft bewaard |
| Admin-overlay | blijft | **Brein** (team & rollen) | Uitgebreid met de vier rollen |
| **Pulse/Marketing HQ (aparte app)** | opgeheven, gefaseerd | rapporten/briefings → **Vandaag** + **Brein**; pipeline → Test-model; agents → specialisten/Recommendation-producenten | Zie 1.5 — pas in de laatste fase, niet destructief |

## 1.3 Datamigratie: wat behouden blijft, wat samengevoegd wordt

Volgorde is belangrijk — elke stap heeft de vorige nodig:

| # | Bron (nu) | Doel (nieuw) | Aard |
|---|---|---|---|
| 1 | hardcoded merkwaarden + `app_state.brand_profile_v1` | **Brand** | normaliseren; eenmalig |
| 2 | `team_members` | **User** + `user_brand_role` | rol-mapping: admin→admin, member→maker, guest→lezer |
| 3 | `AD_FORMATS` JS-constante (42 formats + funnelregels) | **Format** | eenmalige seed |
| 4 | `products` (+ base64-beelden) | **Product** + **Asset** | beelden naar Storage — zie 1.4 |
| 5 | `personas` | **Persona** + **Angle** (stages-JSON uitklappen) | `creatives.angle_id` terugkoppelen voor historische angle-status |
| 6 | `creatives` (Creative Strategy) | **Test** + **Hypothesis** + **Creative** + **Decision** + **TestRelationship** + legacy **PerformanceSnapshot** | de kernsplitsing; rijen zonder context worden tier=quick met gemarkeerde placeholder-hypothese |
| 7 | `library_v2` + IndexedDB-beeldversies | **Creative** + **CreativeVariant** + **Asset** | koppelen aan Tests uit stap 6 op id/naam/datum; wezen krijgen een sandbox-test als container |
| 8 | `script_library_v1` | **Creative** (type script) + iteratie-relaties | |
| 9 | `rory_recommendations` | **Verdict** (+ snapshots uit het 28-velden-blok) | `handled` → Decision waar herleidbaar |
| 10 | `ad_results` | legacy **PerformanceSnapshot** (source=legacy) | leaderboard vervalt; data blijft |
| 11 | HQ: `reports`, `metrics_daily`, `pipeline_items`, brain-vault | **Brein** (foundational learnings, gecureerd), **Recommendation**, Test-model | laatste fase; handmatige curatie i.p.v. blinde import |

**Blijft ongewijzigd:** Supabase Auth, de Cloudflare Worker-proxy (krijgt alleen de AI-gateway-rol erbij), RLS-principes (approved leest, rollen schrijven).

**Wordt bewust niet gemigreerd:** `activity_log` als leaderboard-bron (log blijft bestaan voor audit, de wedstrijd verdwijnt); de legacy-map (`index-OLD.html` e.d.); de zes onmergebare branches uit de README (die worden na dit plan formeel afgesloten — de blueprint vervangt hun bestaansrecht).

## 1.4 De risicovolste datamigratie: assets

293 MB base64-productfoto's in Supabase + IndexedDB-blobs per browser. Aanpak: (1) inventarisatiescript telt en checksumt alles per bron; (2) kopie naar Supabase Storage; (3) verificatierapport (aantallen, checksums, steekproef-viewing); (4) oude bron blijft read-only staan tot twee weken na cutover; (5) pas dan opschonen. **IndexedDB is per-apparaat** — de migratie moet vanuit elke actieve gebruikerssessie kunnen draaien (een "upload je lokale versies"-stap in de oude app), anders raken beeldversies kwijt die alleen op één laptop bestaan.

## 1.5 Compatibiliteitslagen tijdens de overgang

1. **`app_state`-spiegel (tijdelijk, twee richtingen op z'n smalst).** Zolang de oude app schrijft, blijft hij de bron voor zijn eigen blobs; een sync-job projecteert wijzigingen naar de nieuwe tabellen (append/update, nooit delete). Zodra een werkruimte in de nieuwe app live is, draait de richting om: nieuwe tabellen zijn de bron en de blob wordt read-only bijgewerkt zodat de oude app blijft tonen. Per werkruimte, niet alles tegelijk.
2. **De Worker als gedeelde AI-gateway.** Oude en nieuwe app praten tegen dezelfde proxy; de gateway-uitbreiding (learnings-injectie + interactie-logging) is backward-compatible — oude callsites merken er niets van.
3. **Creative Strategy-pariteit.** Tot het Testlab volledig is, blijft de oude tabel-weergave werken op een view over het nieuwe Test-model, zodat het team nooit twee administraties hoeft bij te houden.
4. **HQ blijft volledig draaien** tot fase 6; de enige vroege verbinding is éénrichtings-lezen (rapporten tonen in Vandaag), wat niets aan HQ verandert.

---

# Deel 2 — Modularisatie van de monoliet (de randvoorwaarde)

## 2.1 Wat kan blijven

- **De Cloudflare Worker-proxy** — goed ontwerp (keys server-side, toegang gekoppeld aan goedkeuring). Wordt uitgebouwd, niet vervangen.
- **Supabase-fundament** — auth, RLS, Realtime. Het probleem is het blob-schema, niet het platform.
- **De prompt-inhoud** — de Rory/Theriot/Ogilvy-prompts en de funnelregels zijn gerijpte kennis; ze verhuizen letterlijk, als eerste geïsoleerd (zie 2.2).
- **De beeldbewerkings-flowlogica** — de edit-stack (adjust/layout/strip/add, versies, safe zones) is de meest waardevolle én meest verweven functionaliteit. De *logica* blijft; de *implementatie* wordt als laatste geport (zie 2.4).

## 2.2 Wat eerst geïsoleerd moet worden (voordat er iets vervangen wordt)

In deze volgorde, elk een kleine, toetsbare stap in de bestaande app:

1. **Prompts en AI-callsites** → alle ~25 fetch-constructies achter één client-functie (`wgClaudeText()` bestaat al voor 18 ervan — afmaken), en alle prompt-teksten naar één register met versienummers. Dit is de voorwaarde voor de AI-gateway én voor regressietests op promptgedrag.
2. **De `AD_FORMATS`-constante en andere domeindata** (archetypes, funnelregels) → uit de code, in de database.
3. **De data-toegang** → elke directe `localStorage`/IndexedDB/`app_state`-aanraking achter één datalaagje. Daarna kan de opslag ruilen zonder dat 200 callsites het merken.
4. **De naamconventie & UTM-logica** → één module; die wordt straks gedeeld met de Publication-flow.

## 2.3 Wat vervangen moet worden

- **Het blob-synchronisatiemodel** (`app_state` + localStorage + IndexedDB) → genormaliseerde tabellen + datalaag. Dit is de echte vervanging; al het andere is verhuizen.
- **De negen gestapelde CSS-skins + DOM-verplaatsende scripts** → niet opschonen maar achterlaten: de nieuwe werkruimtes krijgen een schone shell; de oude opmaak gaat mee het graf in met de oude app. Elke poging de skins te ontrafelen is verspilde tijd.
- **`switchMainTab` + monkey-patches** → routing in de nieuwe shell.

## 2.4 De grootste risico's, gerangschikt

1. **De beeldbewerkingsstack** — duizenden regels, verweven met IndexedDB, versienavigatie en de OpenAI-edit-API. *Mitigatie:* als laatste porten; tot die tijd opent de nieuwe Studio voor de bewerkstap de bestaande editor (de oude app in een gerichte modus) — lelijk maar veilig.
2. **De asset-migratie** (1.4) — enig risico op echt dataverlies, vooral de per-apparaat-IndexedDB. *Mitigatie:* checksums, verificatierapport, upload-stap vanuit oude sessies, late opschoning.
3. **De `creatives`-splitsing** (stap 6) — semantische fouten (verkeerde test-reconstructie) zijn erger dan technische. *Mitigatie:* dry-run met een rapport dat het team leest vóór de echte run; placeholder-markeringen in plaats van verzonnen context; oude tabel blijft als view raadpleegbaar.
4. **Realtime-samenwerking** — het huidige "iedereen ziet elkaars wijzigingen" via blob-broadcast is grofmazig maar went. Genormaliseerde tabellen + Realtime is fijnmaziger maar moet per werkruimte opnieuw bewezen worden. *Mitigatie:* conflictregel (eerste Decision wint, zie Flow 1) en per-werkruimte-uitrol.
5. **Promptgedrag-regressie** — zelfde prompt, andere aanroeproute, subtiel ander resultaat. *Mitigatie:* golden set (zie 2.5).

## 2.5 Hoe regressies worden voorkomen

1. **Karakteriseringschecklist per tab** — vóór een tab verhuist, wordt zijn feitelijke gedrag beschreven (de SOP + handboek zijn er al; aanvullen per tab) en na de verhuizing afgevinkt door een teamlid dat de tab dagelijks gebruikt.
2. **Golden prompts** — voor elke specialist een vaste set inputs met vastgelegde referentie-outputs; draait bij elke wijziging aan gateway of promptregister.
3. **Dry-run + rapport bij elke datamigratie** — nooit een migratie zonder vooraf leesbaar verslag van wat er gaat gebeuren (aantallen, voorbeelden, wezen).
4. **Parallel draaien per werkruimte** — nieuwe werkruimte live naast oude tab (read-only) gedurende minimaal één werkweek; pas uit na expliciete akkoord van de dagelijkse gebruikers.
5. **Feature-flags per werkruimte en per merk** — Wellshine kan een fase eerder over dan Wellshave (of andersom), zodat er altijd een werkend vergelijk is.
6. **De JSON-brand-backup blijft werken tot het einde** — het bestaande noodluik wordt pas dichtgezet als de DB-export hem aantoonbaar vervangt.

---

# Deel 3 — Gefaseerde roadmap

## Uitdaging van jouw prioriteitsvolgorde (zoals gevraagd)

Je volgorde is grotendeels juist. Twee onderbouwde wijzigingen:

1. **Punt 2 en 3 zijn niet twee stappen maar één.** "Rory recommendations lezen" en "automatische Meta-metrics" zijn dezelfde bouw: de bestaande daily-check-routine *is al* een Meta-ingest die verdicts schrijft — hij mist alleen een structurele plek om te landen (het datamodel) en een lezer (Vandaag). Ze apart plannen creëert een tussenfase waarin je verdicts toont op basis van een pipeline die je twee weken later toch verbouwt.
2. **"Vandaag" (jouw punt 4) hoort in dezelfde fase als die ingest, niet erna.** Signalen zonder lezer is precies de fout die nu al bestaat (`rory_recommendations` zonder lezer); een lezer zonder signalen is een leeg scherm. Signaal + lezer = één deliverable die waarde bewijst.

Verder blijft jouw volgorde staan: Testlab vóór Studio-consolidatie (de waarheid eerst, dan de fabriek), learnings direct daarna (het afsluitritueel moet bestaan zodra er beslist wordt), publiceren pas als de Studio testgebonden is, Brein en Archief als laatste verbouwing. Eén nuance: het Brein *ontstaat* deels vanzelf eerder — angle-trackrecords en format-winrates vullen zich vanaf fase 2 — fase 5 is de werkruimte eromheen, niet het begin van de data.

## Fase 0 — Fundament (datamodel + isolatie)

- **Productdoel.** Het definitieve datamodel staat in productie, gevuld vanuit de bestaande data; de monoliet is intern voorbereid (prompts, datalaag, formats geïsoleerd). Geen zichtbare verandering voor gebruikers.
- **Gebruikerswaarde.** Nog geen directe — dit is de fase die alle volgende fases kort maakt. Wél meteen: de brand-JSON-backup wordt overbodig gemaakt door echte database-integriteit.
- **Afhankelijkheden.** Migratiestappen 1–8 (deel 1.3); asset-migratie (1.4); isolatiestappen 1–4 (2.2); échte migratie-tooling i.p.v. losse SQL-bestanden.
- **Risico's.** De `creatives`-splitsing en de asset-migratie (zie 2.4); verleiding om "even" UI mee te bouwen — niet doen.
- **Acceptatiecriteria.** Alle bestaande data staat genormaliseerd én de oude app werkt ongewijzigd door (via de compat-spiegel); dry-run-rapporten zijn door het team gelezen en akkoord; golden-prompt-set draait groen; assetverificatie 100%.
- **Bewust nog niet.** Geen nieuwe schermen, geen Meta-schrijfacties, geen HQ-aanraking.

## Fase 1 — De loop leest: Meta-ingest + Verdicts + Vandaag v1

- **Productdoel.** Elke ochtend staan er automatisch cijfers en verdicts klaar, en er is één plek die ze toont en laat beslissen. (Jouw prioriteiten 2+3+4, samengevoegd.)
- **Gebruikerswaarde.** Het einde van cijfers overtikken en screenshots uploaden voor gekoppelde accounts; de eerste ochtend waarop het systeem al gewerkt heeft. Dit is de fase die het "OS-gevoel" voor het eerst bewijst.
- **Afhankelijkheden.** Fase 0; Meta API-toegang per ad account (bestaat al in de routine — productie-waardig maken: tokens, limieten, retries); Publication-koppelflow voor bestaande live ads ("wees-ads" matchen); drempelconfiguratie per merk.
- **Risico's.** API-limieten en tokenbeheer; verkeerde ad↔test-matching vervuilt alles wat volgt (daarom: handmatige bevestiging per match); verdictkwaliteit bij dunne data (drempels conservatief starten).
- **Acceptatiecriteria.** 14 aaneengesloten dagen foutloze nachtelijke ingest voor beide merken; elke live ad gematcht of bewust ongematcht; Flow 1 en Flow 5 werken end-to-end; het team opent Vandaag vaker dan Ads Manager voor de ochtendronde (navraag, geen metriek-theater).
- **Bewust nog niet.** Geen schrijfacties naar Meta; geen gaten-engine (Recommendations komen in fase 2 als de dekking-data er ligt); de oude Cockpit blijft bestaan tot Vandaag hem aantoonbaar vervangt.

## Fase 2 — Testlab + Learnings + gedeeld geheugen

- **Productdoel.** De waarheid krijgt zijn werkruimte: lopende tests met echte cijfers, de besliswachtrij, familiebomen, het afsluitritueel — en de AI-gateway injecteert learnings in elke aanroep. (Jouw prioriteiten 5+6.)
- **Gebruikerswaarde.** Creative Strategy verandert van bijhoudwerk in raadpleegwerk; elke gesloten test maakt het systeem aantoonbaar slimmer; "waarom werkt deze ad" wordt een opzoekbare vraag.
- **Afhankelijkheden.** Fase 1 (zonder echte cijfers is het Testlab de oude spreadsheet met een nieuwe jas); Learning-entiteit + gateway-injectie; Flow 6 en 7.
- **Risico's.** Learning-moeheid (gedachteloos accepteren — meten en rapporteren); dubbele administratie als de oude tabel te lang naast het Testlab leeft (pariteits-view + harde einddatum); learning-vervuiling (mute + herleidbaarheid vanaf dag één).
- **Acceptatiecriteria.** Geen test kan dicht zonder learning of geen-learning-reden; elke AI-output toont zijn geïnjecteerde learnings; de oude Creative Strategy-tab staat read-only; Flow 1→4→6→7 draait als keten op echte tests.
- **Bewust nog niet.** Geen Studio-verbouwing; generatie loopt nog via de oude tabs (die al testgebonden data schrijven via de compat-laag).

## Fase 3 — Studio-consolidatie + sandbox + Criticus

- **Productdoel.** Zes generatie-tabs worden één Studio met vijf ingangen, twee tiers (quick/strategic), drie outputtypes, de sandbox, en de pre-flight van De Criticus. (Jouw prioriteit 7.)
- **Gebruikerswaarde.** Eén maakflow i.p.v. zes; kleine iteraties in minuten (quick tier) zonder dat de administratie lijdt; niets gaat meer "af" zonder pre-flight; 10–20 tests/week wordt comfortabel.
- **Afhankelijkheden.** Fase 2 (de Studio moet ergens in eindigen); de beeldeditor-overbrugging (2.4-risico 1: oude editor blijft de bewerkstap tot hij geport is); Flow 3 (t/m draft_prepared), 8, 9; De Criticus als nieuwe specialist.
- **Risico's.** De beeldbewerkingsport (bewust uitgesteld — de overbrugging moet naadloos genoeg zijn); gewoonteverzet tegen de hypothese-verplichting (de quick tier ís het antwoord — bewaken dat hij echt licht blijft: doel < 2 minuten van winner naar gegenereerde iteratie).
- **Acceptatiecriteria.** Alle zes oude tabs read-only met doorverwijzing; elke nieuwe creative hangt aan een test of is sandbox; quick-tier-iteratie haalbaar binnen 2 minuten tot aan generatie; Criticus-pre-flight op 100% van approved creatives; promotie-flow (Flow 9) werkt.
- **Bewust nog niet.** Publicatie stopt nog bij draft_prepared (download/handwerk als tijdelijk sluitstuk); geen video-productie-statussen (v1-scripts lopen als vandaag, wel testgebonden).

## Fase 4 — Publiceren: Meta-drafts (Publication)

- **Productdoel.** "Klaar" betekent: als draft in de ad account, correct benoemd, met UTM's, na expliciete menselijke bevestiging. (Jouw prioriteit 8; jouw Meta-fase 2.)
- **Gebruikerswaarde.** De laatste kilometer verdwijnt: geen PNG-downloads, geen overtikken, geen naamgevingsfouten; de ad↔test-koppeling ontstaat bij de bron dus wees-ads sterven uit.
- **Afhankelijkheden.** Fase 3 (de Studio moet de aanleverende partij zijn); Meta write-scopes + creative-upload; het rechtenmodel (`can_publish`) actief; transactionele push (alles of niets).
- **Risico's.** Meta-API-wispelturigheid bij creative-upload (retry + duidelijke foutstaten, zie Flow 3); het bevestigingsmoment mag geen bottleneck worden (wachtrij "klaar voor bevestiging" in Vandaag); verleiding tot fase-3-acties (pauzeren/budget) — bewust dicht houden.
- **Acceptatiecriteria.** Flow 3 end-to-end zonder download; elke nieuwe live ad heeft vanaf dag één een Publication; naamconventie 100% consistent in het ad account; nul publicaties zonder geregistreerde menselijke bevestiging.
- **Bewust nog niet.** Geen budget-/statusacties richting Meta (jouw Meta-fase 3 — pas overwegen als het Analist-trackrecord uit fase 2/4 het rechtvaardigt).

## Fase 5 — Brein + video-productieflow

- **Productdoel.** De kennislaag wordt een werkruimte: producten, persona's, angles-met-trackrecord, format-winrates, learnings doorzoekbaar, merkbeheer — plus de video-statusflow (briefed → with_creator → in_edit) en per-hook-publicaties. (Jouw prioriteit 9 + antwoord vraag 6.)
- **Gebruikerswaarde.** Onboarding wordt "lees het Brein"; de dekking-matrix en gaten-engine (Recommendations, Flow 2) draaien op volle data; video valt volledig binnen de loop (Flow 10).
- **Afhankelijkheden.** Fase 2 (learnings bestaan en zijn gevuld), fase 4 (per-hook-publicaties); de gaten-engine server-side; UGC-briefing-generatie.
- **Risico's.** Het Brein wordt een stille bibliotheek als het geen actieve rol krijgt — daarom is de gaten-engine er onderdeel van, niet los; video-status vergt discipline zolang productie extern is (pijplijnsignalen in Vandaag, Flow 10-foutscenario 1).
- **Acceptatiecriteria.** Persona's/Producten/Merk-instellingen-tabs read-only; elke angle toont zijn teststatus automatisch; Flow 2 en Flow 10 end-to-end; een nieuwe collega kan zonder mondelinge overdracht uitleggen waarom de laatste drie winners wonnen (de eerlijkste Brein-test die er is).
- **Bewust nog niet.** Geen AI-video/lip-sync/auto-editing; geen creator-management-module; geen e-mail/landing-kanalen.

## Fase 6 — Archief, HQ-migratie en decommissie

- **Productdoel.** Eén applicatie, één logisch verbonden datalaag, één Brein. Archief live, beeldeditor geport, HQ-waarde gemigreerd (inventarisatie → toewijzing → integratie → pas dan uitzetten, conform je antwoord op vraag 7), oude app en Pulse uit.
- **Gebruikerswaarde.** Geen dubbele systemen meer; de HQ-rapporten en trend-briefings landen in Vandaag; historische HQ-kennis is gecureerd het Brein in gebracht i.p.v. verloren.
- **Afhankelijkheden.** Alles hiervoor; de HQ-inventarisatie (eerste stap van deze fase, niet eerder — het mag de kernloop niet vertragen); de beeldeditor-port (het laatste stuk monoliet).
- **Risico's.** De beeldeditor-port is het grootste technische stuk van deze fase (golden-flow-tests: zelfde bewerkingsreeks, zelfde resultaat); HQ-curatie kost menselijke aandacht (blinde import is sneller en waardeloos); decommissie-verleiding vóór de verificatie af is — de twee-weken-read-only-regel geldt ook hier.
- **Acceptatiecriteria.** De oude app serveert alleen nog een doorverwijzing; Pulse uit; nul verwijzingen naar `app_state`-blobs in productiecode; alle HQ-rapporten/briefings raadpleegbaar in de Console; de agents draaien als Recommendation-/rapport-producenten binnen het ene systeem; het team merkt de uitschakeling niet (want alles was al verhuisd).
- **Bewust nog niet (na deze fase het gesprek waard).** Meta-fase 3 (budgetacties na bevestiging, mét het opgebouwde Analist-trackrecord als onderbouwing); extra kanalen (e-mail, landing pages); extra merken; AI-video.

---

## Samenvattende kaart

```
Fase 0  Fundament          → data genormaliseerd, monoliet geïsoleerd, niets zichtbaar
Fase 1  De loop leest      → Meta-ingest + Verdicts + Vandaag        [prio 2+3+4 samen]
Fase 2  De waarheid        → Testlab + Learnings + gedeeld geheugen  [prio 5+6]
Fase 3  De fabriek         → Studio-consolidatie + sandbox + Criticus [prio 7]
Fase 4  De laatste km      → Meta-drafts publiceren                  [prio 8]
Fase 5  Het geheugen       → Brein + gaten-engine + videoflow        [prio 9]
Fase 6  Eén systeem        → Archief + HQ-migratie + decommissie     [prio 10]
```

Elke fase levert zelfstandig waarde en laat een werkend systeem achter; er is geen moment waarop het team zonder gereedschap zit.
