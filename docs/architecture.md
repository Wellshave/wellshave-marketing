# Wellshave Marketing HQ — Architectuur

Eén hoofdkwartier voor de volledige marketingoperatie: een team van AI-agents
met een naam, een rol, skills en guardrails, die samenwerken via een gedeeld
brein en dagelijks rapporteren.

## Kernprincipes

1. **Supabase is de motor, Obsidian is het venster.** Alle operationele staat
   (agent-status, runs, berichten, pipeline, metrics, approvals) leeft in het
   `marketing_hq`-schema van Supabase-project "Wellgroup ad generator"
   (`bequyhghgkvekvibufhw`). De markdown-vault in `brain/` wordt door de agents
   bijgewerkt en is leesbaar in Obsidian — inclusief wie er werkt en wat er
   gecommuniceerd wordt.
2. **Analyseren en klaarzetten mag autonoom; uitvoeren vereist akkoord.**
   Agents lezen alle data, schrijven rapporten en concepten, en zetten acties
   klaar in `marketing_hq.approvals` + `brain/Inbox/Approvals.md`. Budget
   wijzigen, campagnes live zetten en e-mails versturen gebeurt pas na
   menselijke goedkeuring. Zie `agents/GUARDRAILS.md`.
3. **Schema- en event-gedreven, niet 24/7 loops.** Agents worden gewekt door
   Routines (cron) en gebeurtenissen. De ochtendcyclus draait dagelijks om
   07:00 (Europe/Amsterdam).
4. **Data-eerlijkheid.** Meta-attributie druppelt tot ~72 uur na. Dagrapporten
   markeren cijfers als voorlopig (`is_final = false`) en corrigeren de drie
   dagen ervoor.

## Het team

| Agent | Rol | Fase | Bronnen |
|---|---|---|---|
| Nova | Creative Director & Strategie | 1 — actief | pipeline, alle rapporten |
| Atlas | Data-analyst | 1 — actief | Meta Ads, Klaviyo, (Shopify, Google Ads later) |
| Radar | Trend- & Concurrentiescout | 1 — actief | Trendtrack, Foreplay |
| Quill | Copywriter | 2 | briefings van Nova/Radar |
| Pixel | Content Creator (statics & UGC-scripts) | 2 | Higgsfield, design-skills |
| Echo | E-mailmarketeer | 2 | Klaviyo |
| Bolt | Performance Marketeer | 2 | Meta Ads (Google Ads later) |
| Sage | SEO-specialist | 3 | website, zoekdata (koppeling nodig) |
| Vector | Webdesigner (landingspagina's) | 3 | design-skills, Netlify/Cloudflare |

Fase 1 is live; fase 2 en 3 staan gedefinieerd maar worden pas geactiveerd als
fase 1 bewezen draait.

## Dagelijkse ochtendcyclus (07:00 NL)

1. **Atlas** haalt gisteren + 3 dagen terug op uit Meta Ads en Klaviyo,
   schrijft `metrics_daily`, en publiceert het dagrapport in
   `brain/Reports/Daily/JJJJ-MM-DD.md` en `marketing_hq.reports`.
2. **Radar** scant Trendtrack/Foreplay op virale trends, scalende ads en
   concurrentiebewegingen per markt → `brain/Briefings/`.
3. **Nova** leest beide, werkt de creative pipeline bij
   (`brain/Pipeline/Board.md`), formuleert hypotheses en briefings voor het
   contentteam, en zet benodigde acties klaar in de Inbox.
4. Elke agent logt zijn run in `agent_runs` en het activiteitenlog
   (`brain/Log/Activity.md`), zodat in Obsidian zichtbaar is wie werkt en wie
   met wie communiceert.

## Creative pipeline

Statussen: `idea → hypothesis → script → with_creator → filming → editing →
ready_for_launch → live → analyzed → archived`. Elke overgang wordt gelogd in
`pipeline_events` en is zichtbaar op het board. Na `live` pakt Atlas het item
op voor analyse; de uitkomst voedt de volgende hypothese-ronde van Nova.

## Connectorstatus (geverifieerd 2026-07-17)

| Koppeling | Status |
|---|---|
| Meta Ads | ✅ werkt — 5 accounts (o.a. Wellshave® `242238038391551`, Wellshine) |
| Klaviyo | ✅ werkt — Wellshave BV |
| Trendtrack | ✅ werkt — Wellgroup, professional |
| Foreplay, Slack, Notion, Gmail, Higgsfield, Netlify, Cloudflare | ✅ verbonden |
| Supabase | ✅ werkt — project "Wellgroup ad generator" |
| Shopify | ✅ aangekoppeld aan de ochtendcyclus-Routine (autorisatie in deze sessie nog open) |
| Google Ads | ❌ geen connector; API-token bij Google aanvragen (doorlooptijd weken) |
| ElevenLabs (spraak) | 📋 fase 3 — bestaande API/MCP gebruiken, geen eigen API bouwen |

## Data-toegang: connectors, API-keys en de browser

**Principe: connectors halen, Supabase serveert, de browser leest.**

1. **Agents (Routines) zijn de enige die naar buiten reiken.** Zij gebruiken de
   claude.ai-connectors (Meta Ads, Klaviyo, Trendtrack, Foreplay, Shopify,
   Slack, Notion) en schrijven alle opgehaalde data naar het
   `marketing_hq`-schema. De Routine "Marketing HQ — Ochtendcyclus" heeft de
   connectors expliciet aangekoppeld via de claude.ai Routines-UI.
2. **Het Pulse-dashboard (in de browser) praat uitsluitend met Supabase** —
   via de publieke anon key + Row Level Security, en Supabase Realtime voor
   live agent-status. Er staan dus nooit Meta/Klaviyo/Trendtrack-keys in
   browsercode; die zouden daar direct te stelen zijn.
3. **Acties vanuit het dashboard** (approvals, opdrachten aan agents) worden
   als rijen in Supabase gezet (`approvals`, `agent_messages`); agents voeren
   ze uit bij hun volgende run, binnen de guardrails.
4. **Eigen API-keys** (Meta system-user token, Klaviyo private key) komen pas
   in beeld als iets búiten Claude-sessies om data moet ophalen. Dan:
   server-side in Supabase Edge Function-secrets — nooit in de repo, nooit in
   de browser.

## Fasering

- **Fase 1 (nu):** fundament + Atlas, Radar, Nova live via dagelijkse Routine.
  Daarna direct: Pulse-dashboard v1 (read-only) met de design-skills.
- **Fase 2:** contentteam (Quill, Pixel, Echo, Bolt), approvals-flow via
  Slack, dashboard met live agent-status.
- **Fase 3:** team-logins (Supabase Auth), acties vanuit het dashboard,
  spraak via ElevenLabs, Google Ads- en SEO-koppeling, Sage & Vector actief.
