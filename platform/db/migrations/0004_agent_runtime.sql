-- Marketing OS — agent-runtime.
-- Doel: agents draaien server-side op cron in plaats van via een claude.ai-Routine.
-- Toepassen op project bequyhghgkvekvibufhw (ad-generator), schema marketing_hq.
--
-- Additief: dit script maakt alleen nieuwe objecten aan en raakt geen bestaande
-- rijen. Terugdraaien kan met de drops onderaan dit bestand (uitgecommentarieerd).
--
-- Volgorde: dit is stap 1. De samenvoeging van de twee projecten (stap 2) staat
-- in 0006_consolidatie.md en kan hierna, of hiervoor — ze raken elkaar niet.

-- ── Planning ────────────────────────────────────────────────────────────────
-- Wanneer een agent moet draaien staat als data in de database, niet in code.
-- Aan/uit zetten of een tijd verschuiven vergt dus geen deploy van de Worker.
create table if not exists marketing_hq.schedules (
  id text primary key,
  agent_id text not null references marketing_hq.agents(id),
  kind text not null,                       -- welk werk: 'daily_report', 'trend_scan', …
  cron text not null,                       -- 5-veld cron, in UTC (zie opmerking hieronder)
  payload jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  last_fired_at timestamptz,
  next_due_at timestamptz,
  created_at timestamptz not null default now()
);
comment on column marketing_hq.schedules.cron is
  'UTC. De ochtendcyclus draait 07:00 Europe/Amsterdam = 05:00 UTC in de zomer, 06:00 UTC in de winter. De Worker rekent de zone om; zie worker/marketing-os.worker.js.';

-- ── De wachtrij ─────────────────────────────────────────────────────────────
-- Alles wat een agent moet doen wordt een job. Zowel cron als het team (via de
-- console → Worker) zetten er werk in. De Worker werkt de rij af per tick.
create table if not exists marketing_hq.agent_jobs (
  id bigint generated always as identity primary key,
  agent_id text not null references marketing_hq.agents(id),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','done','failed','cancelled')),
  priority int not null default 5,          -- lager = eerder aan de beurt
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 3,
  locked_at timestamptz,
  locked_by text,                           -- welke Worker-invocatie de job heeft
  source text not null default 'cron'
    check (source in ('cron','console','agent','manual')),
  requested_by text,                        -- e-mail van de teamgenoot, of agent-id
  schedule_id text references marketing_hq.schedules(id),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

-- De index die de wachtrij snel houdt: alleen wat nog te doen is.
create index if not exists agent_jobs_queue_idx
  on marketing_hq.agent_jobs (priority, scheduled_for)
  where status = 'queued';
create index if not exists agent_jobs_agent_idx
  on marketing_hq.agent_jobs (agent_id, created_at desc);

-- Eén job tegelijk claimen, zonder dat twee Worker-invocaties dezelfde pakken.
-- skip locked doet het werk: wie er als tweede is slaat de vergrendelde rij over.
create or replace function marketing_hq.claim_job(p_worker text)
returns marketing_hq.agent_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  j marketing_hq.agent_jobs;
begin
  select * into j
  from marketing_hq.agent_jobs
  where status = 'queued'
    and scheduled_for <= now()
  order by priority, scheduled_for
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update marketing_hq.agent_jobs
     set status = 'running',
         attempts = attempts + 1,
         locked_at = now(),
         locked_by = p_worker,
         started_at = coalesce(started_at, now())
   where id = j.id
  returning * into j;

  return j;
end;
$$;

-- Jobs die blijven hangen (Worker omgevallen midden in een run) weer vrijgeven.
-- De Worker roept dit aan bij elke tick, vóór het claimen.
create or replace function marketing_hq.reap_stuck_jobs(p_timeout interval default '15 minutes')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with vrijgegeven as (
    update marketing_hq.agent_jobs
       set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
           error = case when attempts >= max_attempts
                        then 'vastgelopen: geen afronding binnen ' || p_timeout::text
                        else error end,
           locked_at = null,
           locked_by = null,
           finished_at = case when attempts >= max_attempts then now() else null end
     where status = 'running'
       and locked_at < now() - p_timeout
    returning 1
  )
  select count(*) into n from vrijgegeven;
  return n;
end;
$$;

-- ── De live-feed ────────────────────────────────────────────────────────────
-- Append-only. Wat de console als "wat doet het systeem nu" toont is letterlijk
-- deze tabel, via Supabase Realtime.
create table if not exists marketing_hq.agent_events (
  id bigint generated always as identity primary key,
  job_id bigint references marketing_hq.agent_jobs(id) on delete cascade,
  run_id bigint references marketing_hq.agent_runs(id) on delete cascade,
  agent_id text not null references marketing_hq.agents(id),
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_events_recent_idx
  on marketing_hq.agent_events (created_at desc);
create index if not exists agent_events_job_idx
  on marketing_hq.agent_events (job_id, id);

-- ── Runs: kosten en herkomst erbij ──────────────────────────────────────────
alter table marketing_hq.agent_runs add column if not exists job_id bigint references marketing_hq.agent_jobs(id);
alter table marketing_hq.agent_runs add column if not exists input_tokens int;
alter table marketing_hq.agent_runs add column if not exists output_tokens int;
alter table marketing_hq.agent_runs add column if not exists cost_usd numeric(10,4);
alter table marketing_hq.agent_runs add column if not exists model text;

-- ── Koppelingen ─────────────────────────────────────────────────────────────
-- Geen secrets: die staan als Worker-secret. Hier alleen of iets werkt en
-- wanneer het voor het laatst data opleverde, zodat de console het kan tonen.
create table if not exists marketing_hq.integrations (
  id text primary key,                      -- 'meta_ads', 'klaviyo', 'shopify', …
  label text not null,
  status text not null default 'unknown'
    check (status in ('ok','degraded','error','unconfigured','unknown')),
  account_ref text,                          -- act_123… / Klaviyo-account, geen key
  last_ok_at timestamptz,
  last_error text,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

insert into marketing_hq.integrations (id, label, status) values
  ('meta_ads',   'Meta Ads',   'unconfigured'),
  ('klaviyo',    'Klaviyo',    'unconfigured'),
  ('shopify',    'Shopify',    'unconfigured'),
  ('trendtrack', 'Trendtrack', 'unconfigured'),
  ('anthropic',  'Claude',     'ok')
on conflict (id) do nothing;

-- ── Toegang ─────────────────────────────────────────────────────────────────
-- Zelfde model als 0002_dashboard_access.sql: de browser leest, meer niet.
-- Schrijven gebeurt uitsluitend server-side door de Worker met de service key
-- (die RLS omzeilt). Een teamlid dat een agent werk wil geven gaat dus via de
-- Worker-API, niet rechtstreeks naar de tabel — dat houdt de guardrails op
-- één plek.
alter table marketing_hq.schedules    enable row level security;
alter table marketing_hq.agent_jobs   enable row level security;
alter table marketing_hq.agent_events enable row level security;
alter table marketing_hq.integrations enable row level security;

grant select on marketing_hq.schedules, marketing_hq.agent_jobs,
                marketing_hq.agent_events, marketing_hq.integrations to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='marketing_hq' and tablename='schedules' and policyname='team_read_schedules') then
    create policy team_read_schedules on marketing_hq.schedules
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname='marketing_hq' and tablename='agent_jobs' and policyname='team_read_agent_jobs') then
    create policy team_read_agent_jobs on marketing_hq.agent_jobs
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname='marketing_hq' and tablename='agent_events' and policyname='team_read_agent_events') then
    create policy team_read_agent_events on marketing_hq.agent_events
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname='marketing_hq' and tablename='integrations' and policyname='team_read_integrations') then
    create policy team_read_integrations on marketing_hq.integrations
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
end $$;

-- PostgREST kijkt alleen in public; vandaar dezelfde view-laag als in 0002.
create or replace view public.hq_schedules    with (security_invoker = true) as select * from marketing_hq.schedules;
create or replace view public.hq_agent_jobs   with (security_invoker = true) as select * from marketing_hq.agent_jobs;
create or replace view public.hq_agent_events with (security_invoker = true) as select * from marketing_hq.agent_events;
create or replace view public.hq_integrations with (security_invoker = true) as select * from marketing_hq.integrations;

revoke all on public.hq_schedules, public.hq_agent_jobs,
                public.hq_agent_events, public.hq_integrations from anon, public;
grant select on public.hq_schedules, public.hq_agent_jobs,
                public.hq_agent_events, public.hq_integrations to authenticated;

-- De live-feed via Realtime. Zonder dit blijft de console pollen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table marketing_hq.agent_events;
    alter publication supabase_realtime add table marketing_hq.agent_jobs;
  end if;
exception when duplicate_object then
  null;  -- al toegevoegd
end $$;

-- ── De ochtendcyclus als data ───────────────────────────────────────────────
-- Tijden in UTC. 05:00 UTC = 07:00 NL in de zomertijd; de Worker corrigeert
-- naar 06:00 UTC zodra Nederland op wintertijd staat.
insert into marketing_hq.schedules (id, agent_id, kind, cron, payload) values
  ('atlas_daily',  'atlas', 'daily_report', '0 5 * * *',  '{"lookback_days":4}'::jsonb),
  ('radar_daily',  'radar', 'trend_scan',   '15 5 * * *', '{}'::jsonb),
  ('nova_daily',   'nova',  'pipeline_sync','30 5 * * *', '{}'::jsonb)
on conflict (id) do nothing;

-- ── Terugdraaien ────────────────────────────────────────────────────────────
-- drop view if exists public.hq_schedules, public.hq_agent_jobs, public.hq_agent_events, public.hq_integrations;
-- drop function if exists marketing_hq.claim_job(text), marketing_hq.reap_stuck_jobs(interval);
-- drop table if exists marketing_hq.agent_events, marketing_hq.agent_jobs, marketing_hq.schedules, marketing_hq.integrations;
-- alter table marketing_hq.agent_runs drop column if exists job_id, drop column if exists input_tokens,
--   drop column if exists output_tokens, drop column if exists cost_usd, drop column if exists model;
