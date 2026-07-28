-- Dashboard-toegang: RLS + team-only leesbeleid + public views voor PostgREST.
-- Toegepast op project bequyhghgkvekvibufhw op 2026-07-17.
-- Alleen ingelogde gebruikers met een @wellshave.com / @wellshave.nl e-mail
-- kunnen lezen; de anon-rol krijgt nergens toegang.

create or replace function marketing_hq.is_team_member()
returns boolean language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt()->>'email','') ~* '@wellshave\.(com|nl)$'
$$;

alter table marketing_hq.agents enable row level security;
alter table marketing_hq.agent_runs enable row level security;
alter table marketing_hq.agent_messages enable row level security;
alter table marketing_hq.pipeline_items enable row level security;
alter table marketing_hq.pipeline_events enable row level security;
alter table marketing_hq.reports enable row level security;
alter table marketing_hq.metrics_daily enable row level security;
alter table marketing_hq.approvals enable row level security;

grant usage on schema marketing_hq to authenticated;
grant select on all tables in schema marketing_hq to authenticated;

create policy team_read_agents on marketing_hq.agents for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_agent_runs on marketing_hq.agent_runs for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_agent_messages on marketing_hq.agent_messages for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_pipeline_items on marketing_hq.pipeline_items for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_pipeline_events on marketing_hq.pipeline_events for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_reports on marketing_hq.reports for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_metrics_daily on marketing_hq.metrics_daily for select to authenticated using (marketing_hq.is_team_member());
create policy team_read_approvals on marketing_hq.approvals for select to authenticated using (marketing_hq.is_team_member());

create view public.hq_agents with (security_invoker = true) as select * from marketing_hq.agents;
create view public.hq_agent_runs with (security_invoker = true) as select * from marketing_hq.agent_runs;
create view public.hq_agent_messages with (security_invoker = true) as select * from marketing_hq.agent_messages;
create view public.hq_pipeline_items with (security_invoker = true) as select * from marketing_hq.pipeline_items;
create view public.hq_pipeline_events with (security_invoker = true) as select * from marketing_hq.pipeline_events;
create view public.hq_reports with (security_invoker = true) as select * from marketing_hq.reports;
create view public.hq_metrics_daily with (security_invoker = true) as select * from marketing_hq.metrics_daily;
create view public.hq_approvals with (security_invoker = true) as select * from marketing_hq.approvals;

revoke all on public.hq_agents, public.hq_agent_runs, public.hq_agent_messages,
  public.hq_pipeline_items, public.hq_pipeline_events, public.hq_reports,
  public.hq_metrics_daily, public.hq_approvals from anon, public;
grant select on public.hq_agents, public.hq_agent_runs, public.hq_agent_messages,
  public.hq_pipeline_items, public.hq_pipeline_events, public.hq_reports,
  public.hq_metrics_daily, public.hq_approvals to authenticated;
