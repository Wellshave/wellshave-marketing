-- ============================================================
-- Angle-koppeling voor de rijke persona's (v5.15):
-- elke gegenereerde ad wordt getagd met het angle_id, zodat de
-- teststatus per angle (getest / winner / ROAS) op de persona-kaart
-- vanzelf vult zodra je cijfers invult.
-- Plak in Supabase > SQL Editor > Run. Na supabase-creatives-master.sql.
-- ============================================================

alter table creatives add column if not exists angle_id text;
create index if not exists creatives_angle_idx on creatives (angle_id);

-- Klaar. De tool werkt ook zonder dit script (dan blijft de teststatus
-- op "nog niet getest"), maar met dit script rolt de test-data per angle binnen.
