-- Hosting van het Pulse-dashboard (toegepast op 2026-07-18).
-- De statische bestanden uit dashboard/ staan als rijen in deze tabel en
-- worden geserveerd door de edge-functie "pulse"
-- (supabase/functions/pulse/index.ts). Updaten = upsert op deze tabel met
-- de actuele inhoud van dashboard/*; de gehoste index.html gebruikt een
-- CDN-script voor supabase-js i.p.v. dashboard/vendor/supabase.js.
create table if not exists marketing_hq.dashboard_assets (
  path text primary key,
  mime text not null,
  body text not null,
  updated_at timestamptz not null default now()
);
alter table marketing_hq.dashboard_assets enable row level security;

create or replace view public.pulse_assets
  with (security_invoker = false) as
  select path, mime, body from marketing_hq.dashboard_assets;
revoke all on public.pulse_assets from anon, authenticated, public;
grant select on public.pulse_assets to service_role;

-- Inhoud van /index.html, /styles.css, /app.js en /config.js is via
-- aparte inserts geladen (zie dashboard/ voor de bronbestanden).
