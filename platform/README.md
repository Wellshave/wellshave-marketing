# Marketing OS — het gedeelde fundament

De laag waarop de Atelier Console en het agentteam samen één systeem worden:
één database, één runtime, agents die uit zichzelf draaien.

De blauwdruk staat in [`docs/ARCHITECTUUR.md`](docs/ARCHITECTUUR.md). Lees die
eerst — hieronder staat alleen hoe je het aanzet.

| Pad | Wat |
|---|---|
| `docs/ARCHITECTUUR.md` | Blauwdruk: waar we vandaan komen, waar we heen gaan, in welke volgorde |
| `docs/PUBLICEREN.md` | Stap 03 — hoe een creative een draaiende advertentie wordt |
| `docs/TERUGKOPPELING.md` | Stap 06 — hoe het cijfer terugkomt bij de creatieve keuze |
| `docs/ONTWERPCONTRACT.md` | Harde, toetsbare regels voor uiterlijk en gedrag — gaat vóór op smaak |
| `db/migrations/0004_agent_runtime.sql` | Planning, wachtrij, live-feed, koppelstatus |
| `db/migrations/0005_modules.sql` | Meta-analyse en e-mail |
| `db/migrations/0006_consolidatie.md` | De twee Supabase-projecten samenvoegen |
| `db/migrations/0007_publiceren.sql` | Publicaties en de view die cijfer aan hypothese koppelt |
| `db/migrations/0008_terugkoppeling.sql` | Cijfers terug naar de creatives, en wat over hoeken bekend is |
| `worker/marketing-os.worker.js` | De runtime — superset van `atelier-proxy` |
| `worker/wrangler.toml` | Deploy + cron |
| `worker/test/smoke.mjs` | Testlus voor de agent-runtime |
| `worker/test/publiceren.mjs` | Testlus voor de publiceerflow en de guardrail eromheen |
| `worker/test/terugkoppeling.mjs` | Testlus voor de systeemtaak: geen model, geen kosten |

## Status

| Stap | Status |
|---|---|
| Blauwdruk, schema, runtime in de repo | ✅ |
| Testlus groen (25 controles) | ✅ `node platform/worker/test/smoke.mjs` |
| Migraties 0004 + 0005 toegepast | ✅ 29 juli |
| Databases samengevoegd | ✅ 29 juli — inhoud geverifieerd via md5 |
| Publiceerflow gebouwd (0007 + runtime) | ✅ 29 juli — 30 controles groen |
| Terugkoppeling gebouwd (0008 + systeemtaak) | ✅ 29 juli — rekenkant tegen echte Postgres gecontroleerd |
| `marketing_hq` in Exposed schemas | ⬜ handmatig, zie stap 2 |
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

Secrets die er nog niet staan:

| Secret | Nodig voor |
|---|---|
| `SUPABASE_SERVICE_KEY` | de runtime — zonder dit blijft hij uit |
| `META_ACCESS_TOKEN` + `META_AD_ACCOUNT_ID` | Atlas en Bolt |
| `KLAVIYO_API_KEY` | Echo |

`ANTHROPIC_KEY` en `OPENAI_KEY` staan er al.

De service key en het Meta-token zijn de eerste eigen sleutels van dit systeem
(tot nu toe liep alles via claude.ai-connectors). Ze staan uitsluitend als
Worker-secret: niet in de repo, niet in de browser, en niet in de database.

### 4. Controleren

```
curl https://marketing-ads.dustin-9ff.workers.dev/health
```

Verwacht `"runtime": "actief"` en per koppeling `true`. Staat er `uit`, dan
ontbreekt `SUPABASE_SERVICE_KEY`.

Daarna één agent handmatig laten draaien, ingelogd als admin:

```
POST /agents/run   {"agent_id":"atlas","kind":"daily_report","payload":{"lookback_days":4}}
POST /agents/tick
GET  /agents/status
```

De eerste echte run is het moment waarop blijkt of Meta de velden teruggeeft
die we verwachten. Kijk in `agent_events` mee; daar staat elke tool-aanroep.

## De agents

Vijf van de negen hebben een runtime-instructie. De rest volgt zodra hun
module er is.

| Agent | Draait | Opdrachten (`kind`) |
|---|---|---|
| Atlas | ✅ | `daily_report`, `feedback_sync` (systeemtaak, geen model) |
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
