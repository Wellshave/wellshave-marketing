# Pulse — het Wellshave Marketing HQ dashboard

Read-only mission control voor het agent-team: kerncijfers, agent-status,
spend/ROAS-grafieken, creative pipeline, rapporten, teamcommunicatie en
approvals. Ververst zichzelf elke 30 seconden.

## Openen

Statische site, geen build-stap. Lokaal: `npx serve dashboard` (of open
`index.html` via een webserver; ES-modules werken niet via `file://`).

## Toegang & beveiliging

- Inloggen met e-mail + wachtwoord of magic link (Supabase Auth).
- Row Level Security: alleen accounts op **@wellshave.com / @wellshave.nl**
  kunnen data lezen. Andere accounts kunnen inloggen maar zien niets.
- De `config.js`-sleutel is een *publishable* key en is bedoeld om publiek te
  zijn; er staan geen geheime keys in deze map. Zie
  `db/migrations/0002_dashboard_access.sql`.

## v1-scope

Read-only. Approvals goedkeuren en agents aansturen vanuit het dashboard is
fase 2/3 (schrijf-RLS + audit-log komen dan mee).
