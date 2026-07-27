-- ============================================================
-- Uitbreiding creatives-tabel voor "Plan een test" (v5.03):
-- hypothese, geteste variabele en parent-koppeling per creative.
-- Plak in Supabase > SQL Editor > Run. Run NA supabase-creatives-master.sql.
-- ============================================================

alter table creatives add column if not exists hypothesis text;
alter table creatives add column if not exists test_variable text;
alter table creatives add column if not exists parent_id bigint references creatives(id) on delete set null;

create index if not exists creatives_parent_idx on creatives (parent_id);

-- Klaar. De app werkt ook zonder dit script (hij laat de drie velden dan weg),
-- maar met dit script kun je per rij zien welke variabele getest werd en
-- vanuit welke winner een variatie komt, en daar later op groeperen.
