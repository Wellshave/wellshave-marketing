-- Marketing HQ: geïsoleerd schema voor het agent-hoofdkwartier.
-- Toegepast op Supabase-project "Wellgroup ad generator" (bequyhghgkvekvibufhw).
-- Verwijderen kan veilig met: drop schema marketing_hq cascade;

create schema if not exists marketing_hq;

create table marketing_hq.agents (
  id text primary key,
  name text not null,
  role text not null,
  phase int not null default 1,
  status text not null default 'idle' check (status in ('idle','working','waiting_approval','offline')),
  current_task text,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table marketing_hq.agent_runs (
  id bigint generated always as identity primary key,
  agent_id text not null references marketing_hq.agents(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','done','failed')),
  summary text,
  output_path text
);

create table marketing_hq.agent_messages (
  id bigint generated always as identity primary key,
  from_agent text not null references marketing_hq.agents(id),
  to_agent text references marketing_hq.agents(id),
  subject text not null,
  body text not null,
  ref_pipeline_item bigint,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table marketing_hq.pipeline_items (
  id bigint generated always as identity primary key,
  title text not null,
  type text not null check (type in ('ugc_video','static','email','landing_page','script','campaign')),
  status text not null default 'idea' check (status in
    ('idea','hypothesis','script','with_creator','filming','editing','ready_for_launch','live','analyzed','archived')),
  owner_agent text references marketing_hq.agents(id),
  hypothesis text,
  angle text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table marketing_hq.pipeline_events (
  id bigint generated always as identity primary key,
  item_id bigint not null references marketing_hq.pipeline_items(id),
  from_status text,
  to_status text not null,
  by_agent text,
  note text,
  created_at timestamptz not null default now()
);

create table marketing_hq.reports (
  id bigint generated always as identity primary key,
  report_date date not null,
  kind text not null check (kind in ('daily','trend_briefing','deep_dive','competitor')),
  title text not null,
  author_agent text references marketing_hq.agents(id),
  vault_path text,
  body_md text,
  created_at timestamptz not null default now(),
  unique (report_date, kind, title)
);

create table marketing_hq.metrics_daily (
  metric_date date not null,
  source text not null,
  account_id text not null,
  metric text not null,
  value numeric not null,
  is_final boolean not null default false,
  captured_at timestamptz not null default now(),
  primary key (metric_date, source, account_id, metric)
);

create table marketing_hq.approvals (
  id bigint generated always as identity primary key,
  requested_by text not null references marketing_hq.agents(id),
  action_type text not null,
  description text not null,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

insert into marketing_hq.agents (id, name, role, phase) values
  ('nova','Nova','Creative Director & Strategie',1),
  ('atlas','Atlas','Data-analyst',1),
  ('radar','Radar','Trend- & Concurrentiescout',1),
  ('quill','Quill','Copywriter',2),
  ('pixel','Pixel','Content Creator (statics & UGC)',2),
  ('echo','Echo','E-mailmarketeer',2),
  ('bolt','Bolt','Performance Marketeer (Meta/Google)',2),
  ('sage','Sage','SEO-specialist',3),
  ('vector','Vector','Webdesigner (landingspaginas)',3);
