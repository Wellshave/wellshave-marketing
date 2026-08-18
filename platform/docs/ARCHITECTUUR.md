# Wellshave Marketing OS — architectuur

Van ad-generator naar één levend systeem voor het hele marketingteam: creatie,
e-mailmarketing, Meta-analyse en AI-agents die uit zichzelf draaien.

Dit document is de blauwdruk. Het vervangt niet `ad-generator/README.md` of
`marketing-hq/docs/architecture.md` — het beschrijft hoe die twee samen één
systeem worden.

## 1. Waar we vandaan komen

| | Atelier Console | Marketing HQ |
|---|---|---|
| Wat | ad-creatie: 15 tabbladen, dagelijks gebruikt | 9 agentprofielen + read-only Pulse-dashboard |
| Code | `ad-generator/app/index.html`, single-file 7,2 MB | markdown + `marketing-hq/dashboard/` |
| Database | `bequyhghgkvekvibufhw` | `srjpulfodxakbyulwhki` |
| Server | Cloudflare Worker `marketing-ads` | geen — agents draaien als claude.ai-Routine |
| Live | wellshave-adgen.netlify.app | wellshave-pulse.netlify.app |

Twee problemen die alles blokkeren:

1. **De agents leven niet.** Ze bestaan als beschrijving en worden gewekt door
   een claude.ai-Routine. Draait die niet, dan gebeurt er niets. Er is geen
   wachtrij, geen status, geen manier om vanuit de console een agent werk te
   geven.
2. **De data staat gescheiden.** Een agent kan niet zien welke creatives het
   team maakt; de console kan niet zien wat een agent concludeert. Elke
   koppeling tussen creatie en analyse moet nu door een mens heen.

## 2. Waar we heen gaan

Eén console, één database, één runtime.

```
                      ┌──────────────────────────────────────────┐
   browser            │  Atelier Console (één app, één login)    │
                      │                                          │
                      │  Creatie   Analyse   E-mail   Agents     │
                      │  generator dashboard Klaviyo  live-feed  │
                      └───────────────┬──────────────────────────┘
                                      │ Supabase JS (anon key + RLS)
                                      │ Worker API (bearer = sessie)
                      ┌───────────────┴──────────────────────────┐
   Cloudflare         │  Worker `marketing-ads`                  │
                      │                                          │
                      │  /anthropic /openai      (bestaand)      │
                      │  /agents/*               (nieuw: API)    │
                      │  scheduled()             (nieuw: cron)   │
                      │    → schedules → jobs → agent-loop       │
                      └───────────────┬──────────────────────────┘
                                      │ service key (server-side)
                      ┌───────────────┴──────────────────────────┐
   Supabase           │  bequyhghgkvekvibufhw                    │
                      │  public.*       creatives, products, …   │
                      │  marketing_hq.* agents, jobs, reports, … │
                      └──────────────────────────────────────────┘
                                      │
                      Meta Ads · Klaviyo · Shopify · Trendtrack
                      (server-side keys, alleen vanuit de Worker)
```

### Kernprincipes

1. **De Worker is de enige die naar buiten reikt.** Meta-, Klaviyo- en
   Shopify-tokens staan als Worker-secret, nooit in de browser en nooit in de
   repo. De console praat met Supabase (lezen) en met de Worker (agents
   aansturen).
2. **Agents draaien server-side, op cron.** Geen claude.ai-sessie meer nodig.
   Een cron-trigger zet werk in `agent_jobs`, dezelfde Worker werkt de rij af.
   Valt een run om, dan wordt hij opnieuw geprobeerd; dat is zichtbaar in de
   console.
3. **Analyseren en klaarzetten mag autonoom; uitvoeren vereist akkoord.**
   Ongewijzigd overgenomen uit `marketing-hq/agents/GUARDRAILS.md`. Elke
   naar-buiten-actie (budget wijzigen, campagne live, e-mail versturen) wordt
   een rij in `approvals` en wacht op een mens.
4. **Eén database.** Agents lezen creatives, producten en persona's van het
   team; de console leest rapporten, aanbevelingen en agent-status. Dat is de
   hele reden dat het een systeem wordt in plaats van twee tools.
5. **Alles wat een agent doet is terug te lezen.** Elke run schrijft
   `agent_events` — de live-feed in de console is letterlijk die tabel.

## 3. De modules

De console krijgt vier werkgebieden. Creatie is wat er nu is; de andere drie
zijn nieuw.

| Module | Wat het team er doet | Agents | Bronnen |
|---|---|---|---|
| **Creatie** | concepten, varianten, iteraties, scripts, statics, persona's, producten | Nova, Quill, Pixel | Claude, OpenAI-beeld, Higgsfield |
| **Analyse** | Meta-prestaties per campagne/adset/ad, creative-scorecard, anomalieën | Atlas, Bolt | Meta Ads API |
| **E-mail** | campagnekalender, concepten in Klaviyo, flow-analyse, segmentgezondheid | Echo | Klaviyo API |
| **Agents** | live-feed, wachtrij, planning, approvals, opdracht geven | alle | Supabase |

De negen agentprofielen uit `marketing-hq/agents/` blijven de bron van
waarheid voor identiteit en guardrails. De runtime laadt ze als systeemprompt.

## 4. De agent-runtime

Drie tabellen dragen het geheel: `schedules` (wanneer), `agent_jobs` (wat) en
`agent_events` (wat er gebeurde).

```
cron (elke 5 min)
  └─ tick()
      ├─ due schedules  → agent_jobs (status queued)
      └─ drain()
          ├─ claim job  (atomisch: queued → running)
          ├─ run agent  (Claude + tools, max N iteraties)
          │     ├─ leest: creatives, metrics, reports, pipeline
          │     ├─ schrijft: reports, messages, pipeline, recommendations
          │     └─ wil naar buiten? → approvals (wacht op mens)
          ├─ agent_events per stap  → live-feed in de console
          └─ done | failed (+ retry met backoff)
```

**Waarom een wachtrij en niet gewoon een cronjob per agent.** Een Worker-run
heeft beperkte tijd. Met een wachtrij kan een lange analyse over meerdere ticks
lopen, kan het team zelf werk toevoegen ("Atlas, kijk naar deze campagne"), en
is de volgorde zichtbaar in plaats van verstopt in een schema.

**Tools die een agent krijgt.** Bewust smal, en per agent beperkt:

| Tool | Wat | Guardrail |
|---|---|---|
| `db_query` | lezen uit een whitelist van tabellen | alleen select, alleen toegestane tabellen |
| `write_report` | rapport wegschrijven | vrij |
| `send_message` | bericht aan een andere agent | vrij |
| `update_pipeline` | pipeline-item of -status bijwerken | vrij |
| `request_approval` | actie klaarzetten voor een mens | verplicht voor alles naar buiten |
| `meta_insights` | Meta Ads uitlezen | alleen lezen |
| `klaviyo_read` | Klaviyo uitlezen | alleen lezen |
| `klaviyo_draft` | campagne als **concept** aanmaken | versturen kan nooit |

Er is geen tool die geld uitgeeft of iets verstuurt. Dat is een eigenschap van
de runtime, niet van de instructie aan de agent — een agent kán de guardrail
dus niet wegpraten.

## 5. Datamodel

Bestaand blijft bestaan. Wat erbij komt:

| Tabel | Waarvoor |
|---|---|
| `marketing_hq.schedules` | cron per agent, als data — aan/uit zonder deploy |
| `marketing_hq.agent_jobs` | de wachtrij, met retries en prioriteit |
| `marketing_hq.agent_events` | append-only log per run = de live-feed |
| `marketing_hq.integrations` | koppelstatus + laatste sync per bron |
| `marketing_hq.meta_insights_daily` | Meta-cijfers per entiteit per dag |
| `marketing_hq.meta_recommendations` | scale/iterate/pause-advies per ad |
| `marketing_hq.email_drafts` | e-mailconcepten vóór ze in Klaviyo staan |

`agent_runs` krijgt `job_id`, tokengebruik en kosten, zodat zichtbaar is wat
het systeem per dag kost.

`public.rory_recommendations` (0 rijen, prototype) gaat op in
`meta_recommendations`; `public.activity_log` (756 rijen) blijft van de console.

## 6. Migratiepad

De volgorde is zo gekozen dat er nooit een moment is waarop het team niets
heeft. De live console blijft werken tot de nieuwe klaar is.

| Stap | Wat | Status |
|---|---|---|
| 1 | Blauwdruk + schema + runtime in de repo | dit werk |
| 2 | Databases samenvoegen naar `bequyhghgkvekvibufhw` | SQL klaar, wacht op akkoord |
| 3 | Worker-runtime deployen, Atlas als eerste agent live | na stap 2 |
| 4 | Console opsplitsen in modules + buildstap | eigen ronde |
| 5 | Agents-sectie in de console (live-feed, wachtrij, approvals) | na 3+4 |
| 6 | Analyse-module (Meta) — Atlas en Bolt | na 3 |
| 7 | E-mailmodule (Klaviyo) — Echo | na 3 |
| 8 | Pulse uitfaseren, wellshave-pulse doorverwijzen | als 5 draait |

### Stap 2 in detail — de twee databases

`marketing_hq` bestaat in **beide** projecten. De kopie in
`bequyhghgkvekvibufhw` is blijven staan toen het HQ in juli naar een eigen
project verhuisde, en is sindsdien niet meer bijgewerkt.

| | ad-generator (`bequy…`) | HQ (`srjpul…`) |
|---|---|---|
| agents | 9 | 9 |
| agent_runs | 4 | **31** |
| agent_messages | 5 | **25** |
| reports | 3 | **21** |
| metrics_daily | 48 | **101** |
| approvals | 2 | 3 |
| pipeline_items | 3 | 5 |
| dashboard_assets | 4 | — |

De HQ-kopie is leidend. De samenvoeging kopieert die rijen naar het
ad-generator-project en laat de stale rijen die daar toevallig ook bestaan
overschrijven. Zie `db/migrations/0005_consolidatie.md` voor de procedure —
inclusief wat er ná de kopie gecontroleerd moet worden en hoe je terugdraait.

## 7. Wat dit niet is

- **Geen vervanging van de creatietool.** De 15 bestaande tabbladen blijven,
  inclusief de wizard, de iteratiematrix en de Fable 5-integratie.
- **Geen autonoom uitgevend systeem.** Agents bereiden voor; mensen beslissen.
- **Geen big bang.** Elke stap hierboven is los deploybaar en los terug te
  draaien.
