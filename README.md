# Wellshave Marketing HQ

Eén hoofdkwartier voor de volledige marketingoperatie van Wellshave: een team
van negen AI-agents met eigen identiteiten, skills en guardrails, een gedeeld
brein en dagelijkse rapportages.

## Structuur

| Map | Inhoud |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Systeemarchitectuur, fasering, connectorstatus |
| [`agents/`](agents/README.md) | Het team: identiteit + guardrails per agent |
| [`brain/`](brain/Home.md) | Het brein — open als Obsidian-vault |
| [`dashboard/`](dashboard/README.md) | **Pulse** — het read-only mission-control dashboard (live op wellshave-pulse.netlify.app) |
| [`db/migrations/`](db/migrations/) | Supabase-schema (`marketing_hq`) |
| [`supabase/functions/pulse/`](supabase/functions/pulse/) | Edge-functie voor Pulse (niet in gebruik voor de HTML zelf — zie dashboard-README) |
| `.claude/skills/` | Design- en UI-skills die de agents gebruiken |

## Hoe het werkt

- **Ochtendcyclus, dagelijks 07:00 NL:** Atlas (dagrapport uit Meta Ads +
  Klaviyo) en Radar (trend- en concurrentiescan) rapporteren; Nova werkt de
  creative pipeline bij en brieft het team.
- **Guardrails:** agents analyseren en zetten klaar; uitvoeren (budgetten,
  campagnes, e-mails) gebeurt pas na menselijk akkoord via de
  [Approvals-inbox](brain/Inbox/Approvals.md).
- **Brein:** operationele staat in Supabase, leesbaar verhaal in
  [`brain/`](brain/Home.md) — wie werkt, wie communiceert, wat er speelt.
