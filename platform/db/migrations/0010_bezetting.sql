-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — De negen agents op hun plek
--
-- De agents-tabel weet vandaag wie ze zijn, maar niet wáár ze staan en niet of
-- ze überhaupt kunnen werken. Alle negen staan op status 'idle', wat leest als
-- "klaar voor werk" — terwijl vier van de negen geen enkele werkinstructie
-- hebben en dus niets kunnen. Dat is een onwaarheid in de data.
--
-- Deze migratie geeft elke agent een positie in de estafette en een eerlijk
-- antwoord op drie vragen: waar sta je, kun je draaien, en wat lever je op.
--
-- Namen, guardrails en rapportage komen per agent later. Hier worden alleen de
-- plekken gezet, zodat er iets is om ze in te hangen.
--
-- Volledig additief, met één uitzondering die hieronder wordt toegelicht.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Wie staat waar ─────────────────────────────────────────────────────────
-- Een station kan meer dan één agent hebben: bij ③ maakt Pixel het beeld en
-- Quill de tekst, bij ⑥ doet Echo de e-mail en Vector de landingspagina. Dat
-- paste niet in de ene kolom `standaard_agent` die 0009 gebruikte.
create table if not exists marketing_hq.agent_stations (
  agent_id text     not null references marketing_hq.agents(id) on delete cascade,
  station  smallint not null references marketing_hq.werkstuk_stations(station),
  -- Wat deze agent hier doet. Twee agents op één station doen niet hetzelfde.
  rol      text     not null,
  -- Wie de stap krijgt toegewezen als er niets anders bekend is. Precies één
  -- per station, afgedwongen met een partiële unieke index hieronder.
  primair  boolean  not null default false,
  primary key (agent_id, station)
);

create unique index if not exists agent_stations_een_primair
  on marketing_hq.agent_stations (station) where primair;

insert into marketing_hq.agent_stations (agent_id, station, rol, primair) values
  ('radar',  1, 'leest de markt en signaleert',                true),
  ('nova',   2, 'maakt van een signaal een testbaar plan',     true),
  ('pixel',  3, 'beeld',                                       true),
  ('quill',  3, 'tekst',                                       false),
  ('bolt',   4, 'zet de advertentie klaar bij Meta',           true),
  ('atlas',  5, 'meet en schrijft de cijfers terug',           true),
  ('echo',   6, 'e-mailcampagne in Klaviyo',                   true),
  ('vector', 6, 'landingspagina bij een winnende advertentie', false)
on conflict (agent_id, station) do nothing;

-- Sage staat bewust in geen enkel station. Vindbaarheid is een doorlopende
-- taak over alles heen, geen stap in een keten. Dat hij hier ontbreekt is
-- informatie, geen omissie.

-- ── Kan deze agent eigenlijk draaien ───────────────────────────────────────
-- `status` is van de runtime: idle → working → idle, of error. Dat veld zegt
-- niets over of er überhaupt een werkinstructie bestaat. Vandaar een eigen
-- kolom, zodat de console het verschil kan tonen tussen "staat stil" en
-- "bestaat alleen op papier".
alter table marketing_hq.agents add column if not exists operationeel boolean not null default false;
alter table marketing_hq.agents add column if not exists levert       text;
alter table marketing_hq.agents add column if not exists rapporteert_in text;

comment on column marketing_hq.agents.operationeel is
  'Heeft een werkinstructie in de runtime. Zonder dit kan de agent niets, hoe idle hij er ook uitziet.';
comment on column marketing_hq.agents.levert is
  'Wat deze agent oplevert, in één regel. Leeg zolang dat niet is uitgewerkt.';

-- Vijf van de negen hebben een werkinstructie in marketing-os.worker.js.
update marketing_hq.agents set operationeel = true,
  levert = 'dagrapport op accountniveau, en de cijfers terug naar de creatives',
  rapporteert_in = 'reports, creatives'                 where id = 'atlas';
update marketing_hq.agents set operationeel = true,
  levert = 'scorecard per advertentie met een oordeel, en advertenties klaargezet bij Meta',
  rapporteert_in = 'meta_recommendations, meta_publications' where id = 'bolt';
update marketing_hq.agents set operationeel = true,
  levert = 'flow-audit en campagneconcepten voor Klaviyo',
  rapporteert_in = 'email_drafts'                       where id = 'echo';
update marketing_hq.agents set operationeel = true,
  levert = 'trendrapport uit de markt',
  rapporteert_in = 'reports'                            where id = 'radar';
update marketing_hq.agents set operationeel = true,
  levert = 'pipeline bijgewerkt en het team gebrieft',
  rapporteert_in = 'pipeline_items, reports'            where id = 'nova';

-- De andere vier krijgen bewust géén `levert`. Wat ze opleveren is nog niet
-- uitgewerkt, en het hier invullen zou een belofte zijn die nergens op rust.
update marketing_hq.agents set operationeel = false
  where id in ('pixel', 'quill', 'sage', 'vector');

-- ── Eén bron voor wie een station bemant ───────────────────────────────────
-- 0009 zette de standaard-agent in werkstuk_stations. Nu agent_stations dat
-- vollediger vastlegt, zou die kolom een tweede waarheid worden die uit de pas
-- kan lopen. De trigger leest voortaan uit agent_stations.
create or replace function marketing_hq.werkstuk_stations_aanmaken()
returns trigger language plpgsql security definer
set search_path = marketing_hq, public as $$
begin
  insert into marketing_hq.werkstuk_stappen
    (werkstuk_id, station, agent_id, status, overdracht)
  select new.id, st.station,
         (select a.agent_id from marketing_hq.agent_stations a
           where a.station = st.station and a.primair limit 1),
         'open', st.standaard_overdracht
  from marketing_hq.werkstuk_stations st
  on conflict (werkstuk_id, station) do nothing;
  return new;
end $$;

alter table marketing_hq.werkstuk_stations drop column if exists standaard_agent;

-- Werkstukken die vóór deze migratie zijn aangemaakt hebben bij station ③ geen
-- agent: die kolom stond toen leeg omdat er maar één agent per station in paste
-- en het er daar twee zijn. Dat gat wordt hier gedicht.
--
-- Alleen bij stappen die nog open staan. Een stap die al is gedaan, bewaart wie
-- hem gedaan heeft; daar met terugwerkende kracht een naam in zetten zou de
-- geschiedenis herschrijven.
update marketing_hq.werkstuk_stappen s
   set agent_id = (select a.agent_id from marketing_hq.agent_stations a
                    where a.station = s.station and a.primair limit 1)
 where s.agent_id is null
   and s.status = 'open';

-- ── De bezetting in één blik ───────────────────────────────────────────────
create or replace view marketing_hq.agent_bezetting as
select
  a.id, a.name, a.role,
  s.station,
  st.naam                                   as station_naam,
  s.rol                                     as rol_hier,
  s.primair,
  a.operationeel,
  a.levert,
  a.rapporteert_in,
  a.status                                  as runtime_status,
  a.last_run_at,
  -- Twee soorten runs, en het verschil is belangrijk. De oude runs komen uit de
  -- claude.ai-Routine van vóór 27 juli en hebben geen job: die is meeverhuisd
  -- bij de samenvoeging. De nieuwe runtime maakt altijd eerst een job.
  -- Ze op één hoop gooien laat agents "draaien" die in werkelijkheid stilstaan.
  (select count(*) from marketing_hq.agent_runs r
    where r.agent_id = a.id and r.job_id is not null)  as runs,
  (select count(*) from marketing_hq.agent_runs r
    where r.agent_id = a.id and r.job_id is null)      as runs_historisch,
  case
    when not a.operationeel then 'alleen een profiel'
    when exists (select 1 from marketing_hq.agent_runs r
                  where r.agent_id = a.id and r.job_id is not null) then 'draait'
    else 'nog nooit gedraaid'
  end                                       as bezetting
from marketing_hq.agents a
left join marketing_hq.agent_stations s   on s.agent_id = a.id
left join marketing_hq.werkstuk_stations st on st.station = s.station;

-- ── Toegang ────────────────────────────────────────────────────────────────
alter table marketing_hq.agent_stations enable row level security;
grant select on marketing_hq.agent_stations to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='marketing_hq'
                   and tablename='agent_stations' and policyname='team_read_agent_stations') then
    create policy team_read_agent_stations on marketing_hq.agent_stations
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
end $$;

create or replace view public.hq_agent_bezetting with (security_invoker = true)
  as select * from marketing_hq.agent_bezetting;

revoke all on public.hq_agent_bezetting from anon, public;
grant select on public.hq_agent_bezetting to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   alter table marketing_hq.werkstuk_stations add column standaard_agent text
--     references marketing_hq.agents(id);
--   drop view if exists public.hq_agent_bezetting;
--   drop view if exists marketing_hq.agent_bezetting;
--   drop table if exists marketing_hq.agent_stations;
--   alter table marketing_hq.agents drop column if exists operationeel;
--   alter table marketing_hq.agents drop column if exists levert;
--   alter table marketing_hq.agents drop column if exists rapporteert_in;
--   (en de trigger-functie uit 0009 terugzetten)
-- ═══════════════════════════════════════════════════════════════════════════
