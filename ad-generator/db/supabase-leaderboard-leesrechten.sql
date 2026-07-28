-- ============================================================
-- Leaderboard: activiteitenlog leesbaar maken voor ALLE goedgekeurde leden
-- (nodig voor de "meest actief"-ranglijst op het dashboard, zichtbaar voor iedereen).
-- Plak dit in Supabase > SQL Editor > New query > Run. Run na supabase-rollen-en-logboek.sql.
--
-- Let op: hierna kan elk goedgekeurd teamlid het activiteitenlog lezen
-- (dat is bewust, zodat iedereen de ranglijst ziet). De admin-only policy
-- blijft ook bestaan; permissieve policies werken samen (OR).
-- ============================================================

drop policy if exists "log_select_approved" on activity_log;
create policy "log_select_approved" on activity_log for select
  using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') );

-- Klaar.
