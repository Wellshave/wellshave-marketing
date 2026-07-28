-- ============================================================
-- Team-toegang: zelf aanmelden + goedkeuren (v4.77)
-- Plak dit in Supabase > SQL Editor > New query > Run.
--
-- Dit vervangt de eerdere open opzet (supabase-toegang-open.sql) EN de
-- login-only opzet (supabase-login-vergrendelen.sql). Run alleen DIT script.
--
-- Werking:
--  - Iedereen kan zich aanmelden (Supabase Auth, eigen wachtwoord).
--  - Nieuwe aanmeldingen komen automatisch op status 'pending' (wachtrij).
--  - De beheerder (dustin@wellshave.com) is meteen 'approved' + admin.
--  - Alleen GOEDGEKEURDE leden kunnen de app-data lezen/schrijven.
--  - De admin kan de status van leden wijzigen (goedkeuren/afwijzen).
-- ============================================================

-- 1) Tabel met teamleden + status
create table if not exists team_members (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  status      text not null default 'pending',   -- pending / approved / rejected
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table team_members enable row level security;

-- 2) Bij elke nieuwe auth-gebruiker automatisch een teamlid-rij maken.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_members (id, email, full_name, status, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    case when new.email = 'dustin@wellshave.com' then 'approved' else 'pending' end,
    case when new.email = 'dustin@wellshave.com' then true else false end
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 3) RLS op team_members: zelf je eigen rij lezen; admin leest/wijzigt alles.
drop policy if exists "tm_select_self_or_admin" on team_members;
create policy "tm_select_self_or_admin" on team_members for select
  using ( id = auth.uid() or (auth.jwt() ->> 'email') = 'dustin@wellshave.com' );

drop policy if exists "tm_update_admin" on team_members;
create policy "tm_update_admin" on team_members for update
  using ( (auth.jwt() ->> 'email') = 'dustin@wellshave.com' )
  with check ( (auth.jwt() ->> 'email') = 'dustin@wellshave.com' );
-- (Geen public insert-policy nodig: de trigger draait als security definer.)

-- 4) app_state: alleen GOEDGEKEURDE teamleden mogen lezen/schrijven.
drop policy if exists "team_select" on app_state;
drop policy if exists "team_insert" on app_state;
drop policy if exists "team_update" on app_state;
drop policy if exists "team_delete" on app_state;
drop policy if exists "auth_select" on app_state;
drop policy if exists "auth_insert" on app_state;
drop policy if exists "auth_update" on app_state;
drop policy if exists "auth_delete" on app_state;

alter table app_state enable row level security;

create policy "approved_select" on app_state for select
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );
create policy "approved_insert" on app_state for insert
  with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );
create policy "approved_update" on app_state for update
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') )
  with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );
create policy "approved_delete" on app_state for delete
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );

-- 5) Bestaande auth-gebruikers die nog geen teamlid-rij hebben, alsnog toevoegen.
insert into team_members (id, email, full_name, status, is_admin)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''),
       case when u.email = 'dustin@wellshave.com' then 'approved' else 'pending' end,
       case when u.email = 'dustin@wellshave.com' then true else false end
from auth.users u
on conflict (id) do nothing;

-- Klaar.
-- LET OP in Supabase > Authentication > Providers/Settings:
--   - "Allow new users to sign up" moet AAN staan (anders kan niemand zich aanmelden).
--   - "Confirm email" mag uit voor een soepele wachtrij; staat hij aan, dan moet
--     een nieuw lid eerst zijn e-mail bevestigen en daarna nog worden goedgekeurd.
