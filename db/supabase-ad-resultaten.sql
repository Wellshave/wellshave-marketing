-- ============================================================
-- Stap B: advertentie-resultaten vastleggen voor de succes-ranglijst.
-- Elke keer dat iemand bij Itereren de cijfers opslaat, komt er een rij bij,
-- gekoppeld aan de ingelogde maker. Het dashboard rangschikt hierop (gem. ROAS).
-- Plak in Supabase > SQL Editor > New query > Run. Run na de eerdere scripts.
-- ============================================================

create table if not exists ad_results (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  user_email  text,
  user_name   text,
  ad_name     text,
  period      text,
  roas        numeric,
  ctr         numeric,
  spend       numeric,
  aov         numeric,
  created_at  timestamptz not null default now()
);
create index if not exists ad_results_user_idx on ad_results (user_id);

alter table ad_results enable row level security;

-- Goedgekeurde leden mogen de resultaten lezen (voor de ranglijst).
drop policy if exists "ar_select_approved" on ad_results;
create policy "ar_select_approved" on ad_results for select
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );

-- Een lid mag alleen zijn EIGEN resultaten toevoegen.
drop policy if exists "ar_insert_self" on ad_results;
create policy "ar_insert_self" on ad_results for insert
  with check ( auth.uid() = user_id and exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );

-- Klaar.
