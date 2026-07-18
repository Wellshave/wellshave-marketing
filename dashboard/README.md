# Pulse — het Wellshave Marketing HQ dashboard

Read-only mission control voor het agent-team: kerncijfers, agent-status,
spend/ROAS-grafieken, creative pipeline, rapporten, teamcommunicatie en
approvals. Ververst zichzelf elke 30 seconden.

## Openen

**Live (voor het team):** https://wellshave-pulse.netlify.app — deployen
gaat door de inhoud van deze map (zonder README) als zip/map in het
Netlify-project `wellshave-pulse` te slepen (Deploys-tab).

Let op: hosten via Supabase Edge Functions op het gedeelde supabase.co-domein
werkt NIET voor de HTML zelf — de Supabase-gateway herschrijft text/html
bewust naar text/plain (anti-phishing). De edge-functie `pulse` en de
assets-tabel (`db/migrations/0003`) blijven bestaan voor het geval er later
een eigen domein aan het Supabase-project hangt.

Lokaal: `npx serve dashboard` (ES-modules werken niet via `file://`).

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
