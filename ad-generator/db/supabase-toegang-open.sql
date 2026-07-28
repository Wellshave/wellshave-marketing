-- ============================================================
-- Database weer OPEN zetten voor de app-sleutel (anon).
-- Nodig sinds v4.75: de app gebruikt geen Supabase-login meer,
-- maar één gedeeld wachtwoord-scherm (UI-slot). De database moet
-- daarom weer benaderbaar zijn met de publishable/anon-key.
--
-- Plak dit in Supabase > SQL Editor > New query > Run.
-- Dit draait de vergrendeling uit supabase-login-vergrendelen.sql terug.
-- ============================================================

-- De login-only policies weg
drop policy if exists "auth_select" on app_state;
drop policy if exists "auth_insert" on app_state;
drop policy if exists "auth_update" on app_state;
drop policy if exists "auth_delete" on app_state;

-- Voor de zekerheid ook eventuele oude open policies opnieuw zetten
drop policy if exists "team_select" on app_state;
drop policy if exists "team_insert" on app_state;
drop policy if exists "team_update" on app_state;
drop policy if exists "team_delete" on app_state;

-- RLS blijft aan, maar de policies staan weer open (anon mag lezen/schrijven)
alter table app_state enable row level security;

create policy "team_select" on app_state for select using (true);
create policy "team_insert" on app_state for insert with check (true);
create policy "team_update" on app_state for update using (true) with check (true);
create policy "team_delete" on app_state for delete using (true);

-- Klaar. De app kan nu zonder Supabase-login lezen/schrijven; de
-- toegang wordt afgeschermd door het gedeelde wachtwoord in de app.
