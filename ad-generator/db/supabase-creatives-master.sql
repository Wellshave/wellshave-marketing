-- ============================================================
-- Master Creative Strategy tabel: spiegelt jullie Test Tracker (1 rij per creative/script).
-- Plan -> Live/Performance -> Beslissing, plus de maker en het volledige script.
-- Dit wordt de spil: Scriptwriter/generator schrijven hierin, cijfers worden later ingevuld,
-- dashboard/ranglijsten lezen hieruit, en je kunt filteren/analyseren (winners per angle/persona/format).
-- Plak in Supabase > SQL Editor > New query > Run. Run na de eerdere scripts.
-- ============================================================

create table if not exists creatives (
  id            bigint generated always as identity primary key,
  brand         text default 'wellshave',
  -- maker
  user_id       uuid,
  user_email    text,
  user_name     text,
  -- PLAN
  ad_name         text,
  product         text,
  awareness_level text,
  angle_type      text,
  marketing_angle text,
  desires         text,
  format          text,
  creative_concept text,
  media_type      text,
  hook_short      text,
  channel         text,
  audience        text,
  persona         text,
  -- LIVE & PERFORMANCE
  date_live       date,
  budget          numeric,
  impressions     bigint,
  hook_rate       numeric,
  hold_rate       numeric,
  ctr             numeric,
  cpm             numeric,
  cpc             numeric,
  conversions     integer,
  cvr             numeric,
  cpa             numeric,
  aov             numeric,
  roas            numeric,
  breakeven_roas  numeric,
  target_roas     numeric,
  -- BESLISSING
  score           numeric,
  status          text default 'To Test',
  next_step       text,
  notes           text,
  creatives_link  text,
  -- koppelingen
  script          jsonb,          -- volledige Scriptwriter-JSON indien hier gemaakt
  source_type     text,           -- 'script' | 'static' | 'import'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists creatives_brand_idx on creatives (brand);
create index if not exists creatives_status_idx on creatives (status);
create index if not exists creatives_user_idx on creatives (user_id);

-- updated_at automatisch bijwerken
create or replace function creatives_touch() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists creatives_touch_trg on creatives;
create trigger creatives_touch_trg before update on creatives for each row execute function creatives_touch();

alter table creatives enable row level security;

-- Goedgekeurde leden lezen alles; admin/member schrijven; guest = alleen lezen.
drop policy if exists "creatives_select" on creatives;
create policy "creatives_select" on creatives for select
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );

drop policy if exists "creatives_insert" on creatives;
create policy "creatives_insert" on creatives for insert
  with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) );

drop policy if exists "creatives_update" on creatives;
create policy "creatives_update" on creatives for update
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) )
  with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) );

drop policy if exists "creatives_delete" on creatives;
create policy "creatives_delete" on creatives for delete
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) );

-- Klaar. Volgende stappen (in de app): Scriptwriter schrijft een rij weg, angle/format als plan-velden,
-- de tabelweergave met filters, en de import van de bestaande 624 rijen uit de Creative Strategy Map.
