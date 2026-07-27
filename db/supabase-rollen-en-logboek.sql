-- ============================================================
-- Rollen (admin / member / guest) + activiteitenlog (v4.80)
-- Run dit NA supabase-teamtoegang.sql, in Supabase > SQL Editor.
--
-- Rollen:
--   admin  = volledige toegang + teamleden beheren
--   member = volledige toegang (generator + bibliotheek), mag opslaan
--   guest  = alleen bibliotheek bekijken, GEEN generator, kan niets opslaan
--
-- Activiteitenlog: elke wijziging in de gedeelde data (bibliotheek, scripts,
--   producten, persona's, merk-instellingen) wordt automatisch vastgelegd
--   met wie, wat en wanneer. Alleen admins kunnen het log lezen.
-- ============================================================

-- 1) role-kolom toevoegen + bestaande admins op 'admin' zetten
alter table team_members add column if not exists role text not null default 'member';
update team_members set role = 'admin' where is_admin = true and role <> 'admin';

-- 2) trigger bijwerken zodat nieuwe gebruikers ook een role krijgen
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into team_members (id, email, full_name, status, is_admin, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    case when new.email = 'dustin@wellshave.com' then 'approved' else 'pending' end,
    case when new.email = 'dustin@wellshave.com' then true else false end,
    case when new.email = 'dustin@wellshave.com' then 'admin' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- 3) admin-check zonder RLS-recursie (security definer leest de tabel buiten RLS om)
create or replace function is_admin_user() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from team_members
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

-- 4) team_members policies: zelf je rij lezen; admins lezen/wijzigen alles
drop policy if exists "tm_select_self_or_admin" on team_members;
create policy "tm_select_self_or_admin" on team_members for select
  using ( id = auth.uid() or is_admin_user() or (auth.jwt() ->> 'email') = 'dustin@wellshave.com' );

drop policy if exists "tm_update_admin" on team_members;
create policy "tm_update_admin" on team_members for update
  using ( is_admin_user() or (auth.jwt() ->> 'email') = 'dustin@wellshave.com' )
  with check ( is_admin_user() or (auth.jwt() ->> 'email') = 'dustin@wellshave.com' );

-- 5) app_state: approved mag LEZEN; alleen admin/member mag SCHRIJVEN (guest = read-only)
drop policy if exists "approved_select" on app_state;
drop policy if exists "approved_insert" on app_state;
drop policy if exists "approved_update" on app_state;
drop policy if exists "approved_delete" on app_state;
drop policy if exists "rw_insert" on app_state;
drop policy if exists "rw_update" on app_state;
drop policy if exists "rw_delete" on app_state;
-- ook eventuele oude/open policies opruimen (uit eerdere scripts)
drop policy if exists "team_select" on app_state;
drop policy if exists "team_insert" on app_state;
drop policy if exists "team_update" on app_state;
drop policy if exists "team_delete" on app_state;
drop policy if exists "auth_select" on app_state;
drop policy if exists "auth_insert" on app_state;
drop policy if exists "auth_update" on app_state;
drop policy if exists "auth_delete" on app_state;

create policy "approved_select" on app_state for select
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );
create policy "rw_insert" on app_state for insert
  with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) );
create policy "rw_update" on app_state for update
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) )
  with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) );
create policy "rw_delete" on app_state for delete
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) );

-- 6) Activiteitenlog
create table if not exists activity_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  user_email  text,
  user_name   text,
  brand       text,
  item_key    text,
  action      text,        -- insert / update / delete
  created_at  timestamptz not null default now()
);
create index if not exists activity_log_created_idx on activity_log (created_at desc);

alter table activity_log enable row level security;

drop policy if exists "log_select_admin" on activity_log;
create policy "log_select_admin" on activity_log for select
  using ( is_admin_user() or (auth.jwt() ->> 'email') = 'dustin@wellshave.com' );
-- geen insert/update/delete-policy: alleen de trigger (security definer) schrijft.

create or replace function log_app_state_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; act text; nm text; br text;
begin
  if (tg_op = 'DELETE') then k := old.key; br := old.brand; act := 'delete';
  else k := new.key; br := new.brand; act := lower(tg_op); end if;
  begin
    select full_name into nm from team_members where id = auth.uid();
  exception when others then nm := null; end;
  begin
    insert into activity_log (user_id, user_email, user_name, brand, item_key, action)
    values (auth.uid(), auth.jwt() ->> 'email', nm, br, k, act);
  exception when others then null;  -- loggen mag nooit een opslag-actie blokkeren
  end;
  return null;
end; $$;

drop trigger if exists app_state_audit on app_state;
create trigger app_state_audit
  after insert or update or delete on app_state
  for each row execute function log_app_state_change();

-- Klaar.
