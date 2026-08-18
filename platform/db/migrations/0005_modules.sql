-- Marketing OS — modules Analyse (Meta) en E-mail (Klaviyo).
-- Toepassen op project bequyhghgkvekvibufhw, schema marketing_hq, ná 0004.
--
-- Additief. Wat hier binnenkomt wordt geschreven door de Worker (service key)
-- en gelezen door de console.

-- ── Analyse: Meta Ads ───────────────────────────────────────────────────────
-- marketing_hq.metrics_daily blijft de brede, bron-agnostische tabel voor
-- dagtotalen (source/account/metric/value). Deze tabel is het niveau eronder:
-- per campagne, adset en ad, met de velden waar de iteratiematrix op stuurt.
create table if not exists marketing_hq.meta_insights_daily (
  insight_date date not null,
  account_id text not null,                  -- act_242238038391551 (Wellshave®)
  level text not null check (level in ('account','campaign','adset','ad')),
  entity_id text not null,
  entity_name text,
  parent_id text,                            -- adset → campagne, ad → adset
  spend numeric(12,2),
  impressions bigint,
  reach bigint,
  frequency numeric(8,3),
  clicks bigint,
  link_clicks bigint,
  ctr numeric(8,4),
  cpc numeric(10,4),
  cpm numeric(10,4),
  purchases int,
  purchase_value numeric(12,2),
  roas numeric(8,3),
  add_to_cart int,
  initiate_checkout int,
  landing_page_views int,
  video_3s int,                              -- hook rate = video_3s / impressions
  video_thruplay int,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  is_final boolean not null default false,   -- Meta-attributie druppelt ~72u na
  captured_at timestamptz not null default now(),
  primary key (insight_date, account_id, level, entity_id)
);
create index if not exists meta_insights_entity_idx
  on marketing_hq.meta_insights_daily (entity_id, insight_date desc);
create index if not exists meta_insights_recent_idx
  on marketing_hq.meta_insights_daily (account_id, level, insight_date desc);

-- Het oordeel per ad. Vervangt public.rory_recommendations (prototype, 0 rijen):
-- zelfde idee, maar gekoppeld aan een agent-run en aan de creative uit de
-- console, zodat "welke advertentie is dit ook alweer" beantwoordbaar is.
create table if not exists marketing_hq.meta_recommendations (
  id bigint generated always as identity primary key,
  account_id text not null,
  ad_id text not null,
  ad_name text,
  creative_id bigint,                        -- public.creatives — bewust geen FK:
                                             -- lang niet elke ad komt uit de console
  verdict text not null check (verdict in ('winner','test','loser','onvoldoende_data')),
  action text not null check (action in ('scale','iterate','copy','new','pause','wait')),
  confidence numeric(3,2),
  reasoning text not null,
  metrics_snapshot jsonb,                    -- waar het oordeel op gebaseerd was
  window_days int not null default 7,
  agent_id text references marketing_hq.agents(id),
  run_id bigint references marketing_hq.agent_runs(id),
  status text not null default 'open'
    check (status in ('open','opgepakt','afgewezen','verlopen')),
  created_at timestamptz not null default now()
);
create index if not exists meta_reco_open_idx
  on marketing_hq.meta_recommendations (created_at desc) where status = 'open';
create index if not exists meta_reco_ad_idx
  on marketing_hq.meta_recommendations (ad_id, created_at desc);

-- ── E-mail: Klaviyo ─────────────────────────────────────────────────────────
-- Een concept leeft eerst hier, en pas na goedkeuring als concept in Klaviyo.
-- Versturen gebeurt nooit vanuit dit systeem; zie agents/GUARDRAILS.md.
create table if not exists marketing_hq.email_drafts (
  id bigint generated always as identity primary key,
  brand text not null default 'wellshave',
  kind text not null check (kind in ('campaign','flow_message')),
  title text not null,
  subject text,
  preview_text text,
  body_md text,
  body_html text,
  segment text,                              -- bedoelde ontvangers, in woorden
  segment_id text,                           -- Klaviyo-segment als die bekend is
  flow_ref text,                             -- welke flow, bij kind = flow_message
  planned_for date,
  angle text,
  hypothesis text,
  status text not null default 'concept'
    check (status in ('concept','ter_review','goedgekeurd','in_klaviyo','verzonden','afgewezen')),
  klaviyo_campaign_id text,                  -- gevuld zodra het in Klaviyo staat
  klaviyo_template_id text,
  author_agent text references marketing_hq.agents(id),
  run_id bigint references marketing_hq.agent_runs(id),
  approval_id bigint references marketing_hq.approvals(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_drafts_status_idx
  on marketing_hq.email_drafts (status, planned_for);

-- Prestaties per verzonden campagne, zodat Echo van zijn eigen werk kan leren.
create table if not exists marketing_hq.email_performance (
  klaviyo_campaign_id text primary key,
  draft_id bigint references marketing_hq.email_drafts(id),
  name text,
  sent_at timestamptz,
  recipients int,
  opens int,
  clicks int,
  unsubscribes int,
  spam_complaints int,
  orders int,
  revenue numeric(12,2),
  open_rate numeric(6,4),
  click_rate numeric(6,4),
  captured_at timestamptz not null default now()
);

-- ── Toegang ─────────────────────────────────────────────────────────────────
alter table marketing_hq.meta_insights_daily   enable row level security;
alter table marketing_hq.meta_recommendations  enable row level security;
alter table marketing_hq.email_drafts          enable row level security;
alter table marketing_hq.email_performance     enable row level security;

grant select on marketing_hq.meta_insights_daily, marketing_hq.meta_recommendations,
                marketing_hq.email_drafts, marketing_hq.email_performance to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['meta_insights_daily','meta_recommendations','email_drafts','email_performance']
  loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'marketing_hq' and tablename = t and policyname = 'team_read_' || t
    ) then
      execute format(
        'create policy %I on marketing_hq.%I for select to authenticated using (marketing_hq.is_team_member())',
        'team_read_' || t, t);
    end if;
  end loop;
end $$;

create or replace view public.hq_meta_insights_daily  with (security_invoker = true) as select * from marketing_hq.meta_insights_daily;
create or replace view public.hq_meta_recommendations with (security_invoker = true) as select * from marketing_hq.meta_recommendations;
create or replace view public.hq_email_drafts         with (security_invoker = true) as select * from marketing_hq.email_drafts;
create or replace view public.hq_email_performance    with (security_invoker = true) as select * from marketing_hq.email_performance;

revoke all on public.hq_meta_insights_daily, public.hq_meta_recommendations,
                public.hq_email_drafts, public.hq_email_performance from anon, public;
grant select on public.hq_meta_insights_daily, public.hq_meta_recommendations,
                public.hq_email_drafts, public.hq_email_performance to authenticated;

-- ── Terugdraaien ────────────────────────────────────────────────────────────
-- drop view if exists public.hq_meta_insights_daily, public.hq_meta_recommendations,
--   public.hq_email_drafts, public.hq_email_performance;
-- drop table if exists marketing_hq.email_performance, marketing_hq.email_drafts,
--   marketing_hq.meta_recommendations, marketing_hq.meta_insights_daily;
