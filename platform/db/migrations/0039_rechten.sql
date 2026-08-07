-- ═══════════════════════════════════════════════════════════════════════════
-- 0039 — De rechten die ik in 0035 t/m 0038 vergat
--
-- Wat er misging
--
--   De tracker gaf op productie meteen een lege pagina met:
--
--       permission denied for table benchmarks
--
--   Drie nieuwe objecten waren voor het team niet leesbaar:
--   marketing_hq.benchmarks, marketing_hq.tracker_breakdown en
--   marketing_hq.meta_sync_status. De hq_*-views eromheen hadden wél een
--   grant, maar dat helpt niet: ze staan op `security_invoker = true`, en dan
--   gelden de rechten van wie kijkt op alles eronder. Een grant op de view is
--   dus alleen het laatste hekje van een reeks.
--
--   Bij benchmarks kwam er nog iets bij. marketing_hq.benchmark_band() leest
--   die tabel en is een gewone functie, geen SECURITY DEFINER — dus liep ook
--   creative_kaart erop stuk, terwijl die tabel zelf nergens op het scherm
--   staat. Eén ontbrekende grant vier lagen diep, en het hele scherm is leeg.
--
-- Waarom mijn testlus dit niet ving
--
--   platform/db/test/import-tracker.sh draait alles als `postgres`. Die rol
--   is superuser: hij gaat overal langs RLS en langs elke grant heen. Elke
--   controle die ik schreef was dus waar voor de enige gebruiker die het
--   nooit stuk kan zien. De testlus vroeg wel `has_table_privilege(...)` voor
--   creatives — een vraag óver rechten — maar las nooit één rij als
--   `authenticated`.
--
--   Dat is hier de eigenlijke les, en 0039 repareert hem in de test en niet
--   alleen in het schema: er wordt nu per hq_*-view echt gelezen met `set role
--   authenticated`. Een vraag over rechten stellen is niet hetzelfde als ze
--   gebruiken.
--
-- Wat dit doet
--
--   Het patroon van 0017, nu ook voor de drie nieuwe objecten: een grant voor
--   `authenticated`, en op de tabel bovendien RLS met dezelfde teamcheck als
--   overal. benchmarks bevat geen gegevens over een klant of een merk — het
--   zijn grenswaarden — maar het staat achter dezelfde deur als de rest, zodat
--   er niet één tabel is waarvoor een andere regel geldt en niemand meer weet
--   waarom.
--
--   Views kennen geen RLS; die erven hem van de tabellen eronder. Voor
--   tracker_breakdown en meta_sync_status is een grant daarom genoeg: wat zij
--   tonen is al gefilterd door de policies op creatives, agent_events en
--   meta_insights_daily.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── de tabel ────────────────────────────────────────────────────────────────

alter table marketing_hq.benchmarks enable row level security;

drop policy if exists team_read_benchmarks on marketing_hq.benchmarks;
create policy team_read_benchmarks on marketing_hq.benchmarks
  for select using (marketing_hq.is_team_member());

grant select on marketing_hq.benchmarks to authenticated;

-- ── de views ────────────────────────────────────────────────────────────────

grant select on marketing_hq.tracker_breakdown to authenticated;
grant select on marketing_hq.meta_sync_status  to authenticated;
