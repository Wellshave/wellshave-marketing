# Marketing OS — het gedeelde fundament

De laag waarop de Atelier Console en het agentteam samen één systeem worden:
één database, één runtime, agents die uit zichzelf draaien.

De blauwdruk staat in [`docs/ARCHITECTUUR.md`](docs/ARCHITECTUUR.md). Lees die
eerst — hieronder staat alleen hoe je het aanzet.

| Pad | Wat |
|---|---|
| `docs/SYSTEEM.md` | Het hele systeem van voor naar achter: elke tab, elke agent, de werkwijze, en wat er nu werkelijk staat |
| `docs/ARCHITECTUUR.md` | Blauwdruk: waar we vandaan komen, waar we heen gaan, in welke volgorde |
| `docs/PUBLICEREN.md` | Stap 03 — hoe een creative een draaiende advertentie wordt |
| `docs/TERUGKOPPELING.md` | Stap 06 — hoe het cijfer terugkomt bij de creatieve keuze |
| `docs/ONTWERPCONTRACT.md` | Harde, toetsbare regels voor uiterlijk en gedrag — gaat vóór op smaak |
| `docs/WERKBANK.md` | Functioneel raamwerk: hoe mensen en agents samen aan één werkstuk werken |
| `docs/TEAM.md` | Functioneel raamwerk: profielen, discussies, reputatie en agentgeheugen |
| `docs/BATCHES.md` | Plan van aanpak voor de eerste batches — batchgrootte volgt uit de drempels |
| `db/migrations/0004_agent_runtime.sql` | Planning, wachtrij, live-feed, koppelstatus |
| `db/migrations/0005_modules.sql` | Meta-analyse en e-mail |
| `db/migrations/0006_consolidatie.md` | De twee Supabase-projecten samenvoegen |
| `db/migrations/0007_publiceren.sql` | Publicaties en de view die cijfer aan hypothese koppelt |
| `db/migrations/0008_terugkoppeling.sql` | Cijfers terug naar de creatives, en wat over hoeken bekend is |
| `db/migrations/0009_ruggengraat.sql` | Werkstukken: één idee dat langs zes stations reist |
| `db/migrations/0010_bezetting.sql` | De negen agents op hun plek in die keten |
| `db/migrations/0011_tracker.sql` | Datalaag onder de test tracker: verloop, lijstrij, vergelijking |
| `db/migrations/0012_atlas.sql` | Atlas: zijn afspraak, zijn guardrails als trigger, zijn output en nakoming |
| `db/test/ruggengraat.sh` | Testlus voor 0009 + 0010 — 34 controles |
| `db/test/tracker.sh` | Testlus voor 0011 — 19 controles op een gecontroleerde reeks |
| `db/migrations/0013_audit.sql` | Trechter, publiek per segment, scorekaart op twee signalen |
| `db/test/atlas.sh` | Testlus voor 0012 — 32 controles, elk begint met iets wat niet mag |
| `db/migrations/0014_accounts.sql` | Vijf advertentieaccounts in plaats van één secret |
| `db/migrations/0015_auditplanning.sql` | De audit in `schedules`, zodat de afspraak ook draait |
| `db/migrations/0016_rechten.sql` | De runtime toegang geven tot zijn eigen schema |
| `db/migrations/0017_views.sql` | De views laten filteren op wie kijkt in plaats van op wie ze bezit |
| `db/migrations/0018_dagbesluit.sql` | Het oordeel uit 0013 met naam, handeling en volgorde erbij |
| `db/migrations/0019_brein.sql` | Het brein: één stroom uit vijf tabellen, plus de werkbank |
| `db/migrations/0020_bolt.sql` | Bolt: zijn twee afspraken, zijn guardrails als constraints, en nakoming die ook voor hem werkt |
| `db/migrations/0021_deelnemers.sql` | Deelnemers bij naam — stap 1 van het Werkbank-raamwerk |
| `db/migrations/0025_dossier.sql` | Het dossier per station — stap 5 van het Werkbank-raamwerk |
| `db/migrations/0029_blokkade.sql` | Wat een werkstuk tegenhoudt, zichtbaar in de werkbank |
| `db/migrations/0026_criticus.sql` | De Criticus — stap 6, de grendel tussen creatie en lancering |
| `db/migrations/0022_overdracht.sql` | De overdracht: vijf velden, een poort die dichtgaat bij een blokkade, en een stap die niet af kan zonder |
| `db/migrations/0023_denkstuk.sql` | Het denkstuk: zeven vragen met een zekerheid, een mens die tekent, en "niet doen" als uitgang |
| `db/migrations/0024_terugsturen.sql` | Terugsturen: de keten gaat weer open, de grens van twee, en het bevroren denkstuk erbij |
| `db/test/audit.sh` | Testlus voor 0013 — 37 controles tegen de echte cijfers van Wellshave® |
| `db/test/accounts.sh` | Testlus voor 0014 — 32 controles, waaronder de mediaan per account |
| `db/test/views.sh` | Testlus voor 0017 — 16 controles; de kern is dat een ingelogde niet-teamlid niets ziet |
| `db/test/dagbesluit.sh` | Testlus voor 0018 — 33 controles; alle vijf de oordelen, de volgorde en de dubbele publicatie |
| `db/test/brein.sh` | Testlus voor 0019 — 35 controles; de kern is dat stilte per soort overdracht iets anders betekent |
| `db/test/bolt.sh` | Testlus voor 0020 — 37 controles, elk begint met iets wat niet mag |
| `db/test/deelnemers.sh` | Testlus voor 0021 — 29 controles; de kern is dat er niet gegokt wordt wie iets deed |
| `db/test/overdracht.sh` | Testlus voor 0022 — 39 controles; de kern is dat een stap niet af kan zonder overdracht |
| `db/test/denkstuk.sh` | Testlus voor 0023 — 52 controles; de kern is dat geen agent het denkstuk kan aftekenen |
| `db/test/terugsturen.sh` | Testlus voor 0024 — 44 controles; de kern is dat twee agents elkaar niet eindeloos heen en weer sturen |
| `worker/marketing-os.worker.js` | De runtime — superset van `atelier-proxy` |
| `worker/wrangler.toml` | Deploy + cron |
| `worker/test/smoke.mjs` | Testlus voor de agent-runtime |
| `worker/test/publiceren.mjs` | Testlus voor de publiceerflow en de guardrail eromheen |
| `worker/test/terugkoppeling.mjs` | Testlus voor de systeemtaak: geen model, geen kosten |
| `worker/test/atlas.mjs` | Testlus voor Atlas' kant in de runtime — 19 controles |
| `worker/test/audit.mjs` | Testlus voor de auditopdracht — 21 controles |
| `worker/test/accounts.mjs` | Testlus voor meerdere accounts — 21 controles |
| `worker/test/console.mjs` | Deploy-veiligheid: breekt de nieuwe worker de live console — 26 controles |
| `worker/test/bolt.mjs` | Testlus voor Bolt in de runtime — 31 controles; de kern is dat er geen weg naar buiten is |
| `../ad-generator/app/js/29-dagbesluit.js` | Het dagbesluit bovenaan de Creative Strategy-tab |
| `../ad-generator/test/dagbesluit.cjs` | Testlus voor dat scherm — 30 controles, incl. contrast en de vier lege toestanden |
| `../ad-generator/app/js/30-werkbank.js` | De werkbank: de estafette per werkstuk, als tabblad in de console |
| `../ad-generator/app/js/33-logboek.js` | Het logboek: wat het team deed per dag, uit vijf bronnen |
| `../ad-generator/test/logboek.cjs` | Testlus voor dat scherm — 38 controles, incl. contrast en de vier lege toestanden |
| `../ad-generator/test/teamserver.cjs` | Krijgt de juiste call de team-login mee, en de verkeerde niet — 15 controles |
| `../ad-generator/test/werkbank.cjs` | Testlus voor de werkbank — 42 controles, incl. contrast en de vier lege toestanden |
| `../marketing-hq/brain/genereer.mjs` | Het brein afdrukken als Obsidian-vault onder `brain/Live/` |
| `../marketing-hq/brain/test/genereer.mjs` | Testlus voor die afdruk — 47 controles, waarvan 11 over de schrijfgrens |

## Status

| Stap | Status |
|---|---|
| Blauwdruk, schema, runtime in de repo | ✅ |
| Testlus groen (25 controles) | ✅ `node platform/worker/test/smoke.mjs` |
| Migraties 0004 + 0005 toegepast | ✅ 29 juli |
| Databases samengevoegd | ✅ 29 juli — inhoud geverifieerd via md5 |
| Publiceerflow gebouwd (0007 + runtime) | ✅ 29 juli — 30 controles groen |
| Terugkoppeling gebouwd (0008 + systeemtaak) | ✅ 29 juli — rekenkant tegen echte Postgres gecontroleerd |
| Ruggengraat + bezetting (0009, 0010) | ✅ 29 juli — 34 controles, toegepast op productie |
| Datalaag test tracker (0011) | ✅ 29 juli — 19 controles, toegepast op productie |
| Atlas uitgewerkt (0012 + runtime) | ✅ 30 juli — 51 controles, toegepast op productie |
| Auditopdracht (0013 + runtime) | ✅ 30 juli — 57 controles, toegepast op productie |
| Vijf accounts (0014 + runtime) | ✅ 30 juli — 47 controles, toegepast op productie |
| Auditplanning (0015) | ✅ 30 juli — afspraak en planning lopen weer gelijk |
| Deploy-controle console-endpoints | ✅ 30 juli — 26 controles tegen de live code |
| `marketing_hq` in Exposed schemas | ✅ 30 juli |
| Rechten voor de runtime (0016) | ✅ 30 juli — 0 grants → 164, geverifieerd op productie |
| Views filteren op wie kijkt (0017) | ✅ 31 juli — 16 controles, mutatietest vangt de makkelijke foute oplossing |
| Dagbesluit (0018) | ✅ 31 juli — 33 controles, vijf mutaties gevangen, toegepast op productie |
| Trackerscherm — het dagbesluit | ✅ 31 juli — 30 controles in de echte console |
| Brein + werkbank (0019) | ✅ 1 augustus — 35 controles, vier mutaties gevangen, toegepast op productie |
| Brein als Obsidian-vault | ✅ 1 augustus — 47 controles, gedraaid op de echte 80 gebeurtenissen |
| Werkruimte in de console | ✅ 1 augustus — 42 controles; de estafette per werkstuk, niet negen agentkaarten |
| Bolt uitgewerkt (0020 + runtime) | ✅ 1 augustus — 68 controles, zes mutaties gevangen, toegepast op productie |
| Raamwerk Werkbank vastgelegd | ✅ 1 augustus — `docs/WERKBANK.md`, akkoord op de Criticus |
| Raamwerk Team vastgelegd | ✅ 1 augustus — `docs/TEAM.md`; hangt aan de overdracht uit ③ |
| ① Deelnemers bij naam (0021) | ✅ 1 augustus — 29 + 42 controles, vier mutaties gevangen, toegepast op productie |
| ② Het denkstuk (0023) | ✅ 1 augustus — 52 controles, toegepast op productie; alleen een mens tekent af, en "niet doen" stopt het werkstuk |
| ③ De overdracht (0022) | ✅ 1 augustus — 39 controles, vijf mutaties gevangen, toegepast op productie |
| ④ Terugsturen (0024) | ✅ 2 augustus — 44 controles, toegepast op productie; de derde ronde vraagt een mens, en ② kan niet meer overgeslagen worden |
| ⑤ Het dossier per station (0025) | ✅ 2 augustus — 35 controles, toegepast op productie; geen dossierregel zonder herkomst, en de lus komt rond bij de volgende hoek |
| ⑥ De Criticus (0026) | ✅ 2 augustus — 32 controles, toegepast op productie; creatie komt niet langs zonder oordeel, en 'niet door' sluit aannemen uit |
| Fase 0: opruimen (0027) | ✅ 2 augustus — 29 controles, toegepast op productie; 9 → 6 creatives, 3 gereed, 3 werkstukken klem |
| Werkstukken herschikt (0028) | ✅ 2 augustus — 28 controles, toegepast op productie; drie koppen werden vragen, `premium` werd `safety` |
| Fase 1: proefrit werkstuk 11 | ✅ 3 augustus — denkstuk 1 afgetekend, 2 overdrachten, derde creative; vier bevindingen in `docs/BATCHES.md` §6 |
| Tweede omgeving live | ✅ 3 augustus — `wellshave-werkbank.netlify.app`, calls via `_redirects` naar de worker |
| De blokkade zichtbaar (0029) | ✅ 4 augustus — 32 + 4 controles, vier mutaties gevangen, toegepast op productie; de Criticus staat nu op de kaart |
| Logboek in de console | ✅ 4 augustus — 38 controles, twee mutaties gevangen; het brein is nu een scherm en niet alleen een view |
| Login op de tweede omgeving hersteld | ✅ 4 augustus — 15 controles; de teamserver werd aan zijn hostnaam herkend en dat hield op bij omgeving twee |
| Post bezorgen bij de agents | ⬜ `send_message` belooft dat de ontvanger leest; de runtime maakt dat niet waar |
| Fase 2: batch 1 live | ⬜ wacht op beeld voor creative 11, een oordeel van de Criticus, en de Meta-secrets |
| Worker gedeployed met cron | ⬜ wacht op de secrets |
| Console-modules (Agents, Analyse, E-mail) | ⬜ volgende ronde |

De database is klaar. De console en de worker draaien nog ongewijzigd: er is niets
aan de live werkomgeving van het team veranderd.

## Aanzetten

### 1. Migraties — gedaan

Toegepast op `bequyhghgkvekvibufhw` op 29 juli:

```
db/migrations/0004_agent_runtime.sql   → schedules, agent_jobs, agent_events, integrations
db/migrations/0005_modules.sql         → meta_insights_daily, meta_recommendations, email_drafts, email_performance
```

Beide additief. Onderaan elk bestand staan de drops om terug te draaien. De
consolidatie (0006) is uitgevoerd; details in dat bestand.

Terugdraaien van de samenvoeging kan uit
`marketing_hq_backup_20260728` — dat schema bevat de stale rijen zoals ze vóór
de migratie in het doelproject stonden. Laat het minstens een maand staan.

### 2. PostgREST het schema laten zien

De runtime schrijft rechtstreeks in `marketing_hq`, via de headers
`Accept-Profile` / `Content-Profile`. Dat werkt alleen als het schema is
vrijgegeven:

**Supabase → Project Settings → API → Exposed schemas** → `marketing_hq`
toevoegen naast `public`.

Zonder deze stap geeft elke runtime-call een 404 op PostgREST. De console zelf
merkt er niets van: die leest via de `public.hq_*`-views, en die blijven werken.

### 3. Worker

```
npx wrangler deploy --config platform/worker/wrangler.toml
```

Dit vervangt de code van de bestaande worker `marketing-ads`. De endpoints
`/anthropic` en `/openai/*` zijn ongewijzigd overgenomen, dus de live console
blijft werken. Wat erbij komt is `/agents/*` en de cron.

Dat "blijft werken" is niet op goed vertrouwen: `worker/test/console.mjs`
vergelijkt het gedrag van beide endpoints, de CORS-origins, de header-doorgifte
en de toegangsgrens met de code die op 30 juli daadwerkelijk gedeployed stond.
Draai die lus vóór elke deploy — als het team stilvalt, valt het stil op deze
twee endpoints.

De bundel is 69 KiB (gzip 20 KiB) en heeft geen bindings nodig. Te controleren
zonder credentials:

```
npx wrangler deploy --config platform/worker/wrangler.toml --dry-run
```

Secrets die er nog niet staan:

| Secret | Nodig voor |
|---|---|
| `SUPABASE_SERVICE_KEY` | de runtime — zonder dit blijft hij uit |
| `META_ACCESS_TOKEN` | Atlas en Bolt — welke accounts staat in `ad_accounts`, niet in een secret |
| `KLAVIYO_API_KEY` | Echo |

`ANTHROPIC_KEY` en `OPENAI_KEY` staan er al.

`META_AD_ACCOUNT_ID` hoeft niet meer. Sinds 0014 staan de accounts in
`marketing_hq.ad_accounts`; het secret werkt nog als noodrem wanneer die tabel
onleesbaar is, en `/agents/status` meldt het als hij daarop terugvalt.

De service key en het Meta-token zijn de eerste eigen sleutels van dit systeem
(tot nu toe liep alles via claude.ai-connectors). Ze staan uitsluitend als
Worker-secret: niet in de repo, niet in de browser, en niet in de database.

### 4. Controleren

```
curl https://marketing-ads.dustin-9ff.workers.dev/health
```

Verwacht `"runtime": "actief"` en per koppeling `true`. Staat er `uit`, dan
ontbreekt `SUPABASE_SERVICE_KEY`. `/health` is open en zegt daarom niets over
de accounts — die staan in `/agents/status`, achter de login.

Daarna, ingelogd als admin:

```
GET  /agents/status
```

Verwacht twee accounts (Wellshave® en Wellshine B.V.) en `noodrem: false`. Staat
er één account met `noodrem: true`, dan is `ad_accounts` niet leesbaar en meet
de runtime maar de helft — dan is stap 2 niet gelukt.

Dan één agent handmatig laten draaien:

```
POST /agents/run   {"agent_id":"atlas","kind":"daily_report","payload":{"lookback_days":4}}
POST /agents/tick
```

De eerste echte run is het moment waarop blijkt of Meta de velden teruggeeft
die we verwachten, en of het token bij béide businesses kan — Wellshine B.V.
hangt onder een andere business dan Wellshave. Kan het er niet bij, dan komt
dat terug als een gat met naam en reden, niet als een storing.

Kijk in `agent_events` mee; daar staat elke tool-aanroep. En daarna in
`agent_nakoming`: die zegt per afspraak of er ook echt iets geleverd is.

### 5. Wat er vanzelf gaat draaien

| Wanneer (UTC) | Wie | Wat |
|---|---|---|
| dagelijks 05:00 | Atlas | `daily_report` |
| dagelijks 05:15 | Radar | `trend_scan` |
| dagelijks 05:20 | Bolt | `creative_scorecard` |
| dagelijks 05:40 | Atlas | `feedback_sync` — systeemtaak, geen model |
| dagelijks 06:00 | Nova | `pipeline_sync` |
| maandag 06:30 | Atlas | `account_audit` — per draaiend account |

De planner kijkt of het geplande moment in het afgelopen kwartier lag, dus een
deploy zet niet meteen alles tegelijk in de rij. De eerste run is de eerstvolgende
keer dat de klok langs een van deze tijden komt.

## De agents

Vijf van de negen hebben een runtime-instructie. De rest volgt zodra hun
module er is.

| Agent | Draait | Opdrachten (`kind`) |
|---|---|---|
| Atlas | ✅ uitgewerkt | `daily_report`, `feedback_sync` (systeemtaak, geen model), `account_audit` |
| Bolt | ✅ | `creative_scorecard`, `publish_queue` |
| Echo | ✅ | `flow_audit`, `campaign_plan` |
| Radar | ✅ | `trend_scan` — beperkt, Trendtrack is nog niet server-side gekoppeld |
| Nova | ✅ | `pipeline_sync` |
| Quill, Pixel, Sage, Vector | ⬜ | fase 2/3 |

Identiteit en guardrails blijven in
[`../marketing-hq/agents/`](../marketing-hq/agents/) staan; de runtime-prompt in
de worker is de werkinstructie, geen vervanging.

## Guardrails

Er bestaat geen tool die geld uitgeeft, een campagne start of een e-mail
verstuurt. Alles wat naar buiten werkt gaat via `request_approval` en wordt een
rij in `approvals` die op een mens wacht. Dat zit in de code, niet in de prompt:
een agent kan er niet omheen praten.

Publiceren naar Meta volgt dezelfde regel, maar preciezer: een agent mag het
beeld uploaden en de ad-creative aanmaken (kost niets, wordt nooit vertoond), en
alléén een mens kan er via `POST /agents/publications/<id>/publish` een
draaiende advertentie van maken. Zie [`docs/PUBLICEREN.md`](docs/PUBLICEREN.md).

Wat een agent kan lezen staat op een whitelist. Vraagt hij een tabel die er niet
op staat, dan krijgt hij een nette weigering terug met de lijst die wél mag.

## Testen

```
node platform/worker/test/smoke.mjs           # agent-runtime — 25 controles
node platform/worker/test/publiceren.mjs      # publiceerflow — 30 controles
node platform/worker/test/terugkoppeling.mjs  # systeemtaak — 17 controles
node platform/worker/test/atlas.mjs           # Atlas in de runtime — 19 controles
bash platform/db/test/atlas.sh                # Atlas tegen echte Postgres — 32 controles
node platform/worker/test/audit.mjs           # de auditopdracht — 20 controles
bash platform/db/test/audit.sh                # de auditberekening — 37 controles
node platform/worker/test/console.mjs         # de live console-endpoints — 26 controles
node platform/worker/test/accounts.mjs        # meerdere accounts — 21 controles
bash platform/db/test/accounts.sh             # accounts en merkscheiding — 32 controles
bash platform/db/test/views.sh                # wie kijkt, ziet wat — 16 controles
bash platform/db/test/dagbesluit.sh           # uitzetten of opschalen — 33 controles
bash platform/db/test/brein.sh                # het brein en de werkbank — 35 controles
bash platform/db/test/bolt.sh                 # Bolts guardrails — 37 controles
bash platform/db/test/deelnemers.sh           # wie deed wat — 29 controles
bash platform/db/test/overdracht.sh           # wat de een aan de ander doorgeeft — 39 controles
bash platform/db/test/denkstuk.sh              # de zeven vragen en de poort erachter — 52 controles
bash platform/db/test/terugsturen.sh           # een stap terug, en de grens van twee — 44 controles
bash platform/db/test/dossier.sh               # wat een agent bij een stap meekrijgt — 35 controles
bash platform/db/test/criticus.sh              # de grendel tussen creatie en lancering — 32 controles
bash platform/db/test/opruimen.sh              # fase 0: wat weg mag en vooral wat niet — 29 controles
bash platform/db/test/herschikt.sh             # van kop naar vraag — 28 controles
bash platform/db/test/blokkade.sh              # wat een werkstuk tegenhoudt — 32 controles
node platform/worker/test/bolt.mjs            # Bolt in de runtime — 31 controles
```

Beide draaien de echte runtime tegen een nep-Supabase, nep-Claude en nep-Meta.
Geen deploy, geen kosten, geen database.

De eerste dekt de lus: planning → job → tool-rondes → rapport → afronding,
inclusief de Fable 5-valkuil waarbij een thinking-blok vooraan staat.

De tweede dekt de grens rond geld: dat klaarzetten wél een creative en géén
advertentie maakt, dat publiceren zonder akkoord wordt geweigerd, dat een
tweede poging niets dubbels oplevert, en dat de toolset van Bolt geen enkele
naam bevat die met publiceren of budget te maken heeft.

Wat de tests níet dekken: of PostgREST `marketing_hq` echt serveert, en of Meta
en Klaviyo zich gedragen zoals verwacht. De vorm van de Meta-aanroepen is wel
geverifieerd tegen het echte account — pagina, `object_story_spec` en ad sets
komen overeen met wat er nu live staat.
