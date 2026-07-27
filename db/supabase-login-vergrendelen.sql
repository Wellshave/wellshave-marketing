-- ============================================================
-- Database vergrendelen op ingelogde teamleden.
-- Plak dit in Supabase > SQL Editor > New query > Run.
-- Hierna kan ALLEEN een ingelogde gebruiker de data lezen/schrijven.
-- ============================================================

-- Oude open policies weg
drop policy if exists "team_select" on app_state;
drop policy if exists "team_insert" on app_state;
drop policy if exists "team_update" on app_state;
drop policy if exists "team_delete" on app_state;

-- Nieuwe policies: alleen ingelogde (authenticated) gebruikers
create policy "auth_select" on app_state for select using (auth.role() = 'authenticated');
create policy "auth_insert" on app_state for insert with check (auth.role() = 'authenticated');
create policy "auth_update" on app_state for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_delete" on app_state for delete using (auth.role() = 'authenticated');
