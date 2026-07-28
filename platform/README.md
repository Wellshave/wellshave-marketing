# Marketing OS — het gedeelde fundament

De laag waarop de Atelier Console en het agentteam samen één systeem worden:
één database, één runtime, agents die uit zichzelf draaien.

De blauwdruk staat in [`docs/ARCHITECTUUR.md`](docs/ARCHITECTUUR.md). Lees die
eerst — hieronder staat alleen hoe je het aanzet.

| Pad | Wat |
|---|---|
| `docs/ARCHITECTUUR.md` | Blauwdruk: waar we vandaan komen, waar we heen gaan, in welke volgorde |
| `db/migrations/0004_agent_runtime.sql` | Planning, wachtrij, live-feed, koppelstatus |
| `db/migrations/0005_modules.sql` | Meta-analyse en e-mail |
| `db/migrations/0006_consolidatie.md` | De twee Supabase-projecten samenvoegen |
| `worker/marketing-os.worker.js` | De runtime — superset van `atelier-proxy` |
| `worker/wrangler.toml` | Deploy + cron |
| `worker/test/smoke.mjs` | Testlus zonder deploy, database of API-kosten |

## Status

| Stap | Status |
|---|---|
| Blauwdruk, schema, runtime in de repo | ✅ dit werk |
| Testlus groen (25 controles) | ✅ `node platform/worker/test/smoke.mjs` |
| Migraties toegepast op Supabase | ⬜ nog niet — zie hieronder |
| Databases samengevoegd | ⬜ nog niet |
| Worker gedeployed met cron | ⬜ nog niet |
| Console-modules (Agents, Analyse, E-mail) | ⬜ volgende ronde |

**Er is nog niets live veranderd.** De bestaande console, de bestaande worker en
beide databases doen exact wat ze deden.

## Aanzetten

### 1. Migraties

Toepassen op project `bequyhghgkvekvibufhw` (Supabase → SQL editor), in deze
volgorde:

```
db/migrations/0004_agent_runtime.sql
db/migrations/0005_modules.sql
```

Beide zijn additief: ze maken nieuwe objecten en raken geen bestaande rijen.
Onderaan elk bestand staan de drops om terug te draaien.

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
| Atlas | ✅ | `daily_report` |
| Bolt | ✅ | `creative_scorecard` |
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

Wat een agent kan lezen staat op een whitelist. Vraagt hij een tabel die er niet
op staat, dan krijgt hij een nette weigering terug met de lijst die wél mag.

## Testen

```
node platform/worker/test/smoke.mjs
```

Draait de echte runtime tegen een nep-Supabase en een nep-Claude: planning →
job → tool-rondes → rapport → afronding, inclusief de Fable 5-valkuil waarbij
een thinking-blok vooraan staat. Geen deploy, geen kosten, geen database.

Wat de test níet dekt: of PostgREST `marketing_hq` echt serveert, en of Meta en
Klaviyo de velden teruggeven die we verwachten. Dat blijkt bij de eerste echte
run.
