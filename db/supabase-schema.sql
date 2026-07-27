-- ============================================================
-- Wellgroup Static Image Generator , Supabase schema
-- Plak dit in Supabase > SQL Editor > New query > Run.
-- ============================================================

-- 1) Eén tabel die de per-merk data van de app bewaart.
--    De app sloeg alles op als JSON-blobs in localStorage per sleutel
--    (products_v2, personas_v1, library_v2, script_library_v1,
--     brand_profile_v1, iterate_data, ...). We spiegelen dat 1-op-1,
--     met merk als extra kolom, zodat de migratie minimaal en veilig is.
create table if not exists app_state (
  brand       text not null,                 -- 'wellshave' of 'wellshine'
  key         text not null,                 -- bv 'products_v2', 'script_library_v1'
  value       jsonb,                          -- de data (zelfde vorm als nu in de browser)
  updated_at  timestamptz not null default now(),
  updated_by  text,                           -- optioneel: wie als laatste schreef
  primary key (brand, key)
);

-- 2) updated_at automatisch bijwerken bij elke update.
create or replace function app_state_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_state_touch_trg on app_state;
create trigger app_state_touch_trg
  before update on app_state
  for each row execute function app_state_touch();

-- 3) Realtime aanzetten, zodat wijzigingen van teamleden live
--    bij iedereen binnenkomen.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'app_state'
  ) then
    alter publication supabase_realtime add table app_state;
  end if;
end $$;

-- 4) Row Level Security.
--    START-OPZET (intern team, niet-publieke URL): de anon-sleutel mag
--    lezen en schrijven. Dit is bewust simpel om snel live te zijn.
--    ZIE de gids voor het AANRADEN van een echte login (Supabase Auth)
--    met een e-mail-allowlist zodra dit serieus gebruikt wordt.
alter table app_state enable row level security;

drop policy if exists "team_select" on app_state;
drop policy if exists "team_insert" on app_state;
drop policy if exists "team_update" on app_state;
drop policy if exists "team_delete" on app_state;

create policy "team_select" on app_state for select using (true);
create policy "team_insert" on app_state for insert with check (true);
create policy "team_update" on app_state for update using (true) with check (true);
create policy "team_delete" on app_state for delete using (true);

-- Klaar. Kopieer hierna je Project URL en je anon public key
-- (Supabase > Project Settings > API) en geef die aan Claude.
