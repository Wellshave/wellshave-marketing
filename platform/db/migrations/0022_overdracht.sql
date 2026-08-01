-- ═══════════════════════════════════════════════════════════════════════════
-- 0022 — De overdracht
--
-- Stap 3 van het raamwerk in docs/WERKBANK.md, naar voren gehaald omdat er
-- twee dingen op wachten: het denkstuk (WERKBANK ②) heeft hem nodig om de
-- denkfase te kunnen afsluiten, en het hele teamraamwerk (docs/TEAM.md) hangt
-- eraan — een discussie is wat er gebeurt als een overdracht niet wordt
-- aangenomen.
--
-- Vandaag legt een afgeronde stap alleen `waarom` vast ✅. Dat is een
-- toelichting achteraf. Wat de volgende moet controleren staat nergens, dus
-- een agent begint aan zijn stap met de output van de vorige en niet met diens
-- redenering. Daarmee volgen agents elkaar op zonder inhoudelijke controle,
-- en dat is precies wat dit systeem niet moet doen.
--
-- ── Wat een overdracht is ──────────────────────────────────────────────────
--
-- Vijf verplichte delen: wat er besloten is, waarop dat rust, wat de volgende
-- moet nakijken, wat er nog openstaat, en of er een mens aan te pas moet komen.
--
-- Dat laatste wordt niet geclaimd maar afgeleid. Een agent die zelf mag zeggen
-- of hij een mens nodig heeft, zegt nee — niet uit onwil maar omdat doorgaan
-- altijd de weg van de minste weerstand is. Dus: wie een blokkerende
-- onzekerheid opschrijft, heeft daarmee een poort gemaakt. Zelfde vorm als de
-- voorlopig-trigger van Atlas ✅: de data bepaalt, niet de auteur.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De tabel ────────────────────────────────────────────────────────────
create table if not exists marketing_hq.werkstuk_overdrachten (
  id            bigint generated always as identity primary key,
  werkstuk_id   bigint      not null references marketing_hq.werkstukken(id) on delete cascade,

  -- Van welk station naar welk. `naar_station` is leeg bij station ⑥: daar is
  -- niemand meer om aan over te dragen.
  van_station   smallint    not null check (van_station between 1 and 6),
  naar_station  smallint    check (naar_station between 1 and 6),
  check (naar_station is null or naar_station > van_station),

  -- Wie hem schreef. Precies één, zelfde patroon als 0021: mensen en agents
  -- dragen allebei over, en allebei bij naam.
  van_agent     text        references marketing_hq.agents(id),
  van_mens      uuid        references public.team_members(id),
  check ((van_agent is null) <> (van_mens is null)),

  -- ── de vijf delen ────────────────────────────────────────────────────────
  besluit       text        not null,
  waarom        text        not null,
  controleren   text        not null,
  check (length(trim(besluit))     > 0),
  check (length(trim(waarom))      > 0),
  check (length(trim(controleren)) > 0),

  -- Een lijst van {wat, blokkerend}. Leeg mag: dan staat er niets open. Wat
  -- niet mag is een vormloze tekst, want dan is "blokkerend" niet af te lezen
  -- en werkt de poort hieronder niet.
  onzekerheden  jsonb       not null default '[]'::jsonb,

  -- Afgeleid, niet geclaimd. Zie de trigger onderaan.
  mens_nodig    boolean     not null default false,
  mens_nodig_reden text,

  -- ── wat de ontvanger ermee deed ──────────────────────────────────────────
  -- Stilzwijgend doorgaan is geen optie: er is geen status die dat uitdrukt.
  status        text        not null default 'open'
                check (status in ('open','aangenomen','teruggestuurd','geescaleerd')),
  door_agent    text        references marketing_hq.agents(id),
  door_mens     uuid        references public.team_members(id),
  besloten_op   timestamptz,
  -- Terugsturen zonder te zeggen wat er mis is, is een deur dichtslaan.
  terug_reden   text,
  check (status <> 'teruggestuurd' or (terug_reden is not null and length(trim(terug_reden)) > 0)),
  -- Een afgehandelde overdracht noemt wie hem afhandelde.
  check (status = 'open' or (door_agent is null) <> (door_mens is null)),

  created_at    timestamptz not null default now(),

  -- Eén open overdracht per station per werkstuk. Twee tegelijk zou betekenen
  -- dat er twee verschillende verhalen zijn over dezelfde stap.
  unique (werkstuk_id, van_station, created_at)
);

comment on table marketing_hq.werkstuk_overdrachten is
  'Wat de ene stap aan de volgende doorgeeft: besluit, onderbouwing, wat te controleren, wat openstaat.';
comment on column marketing_hq.werkstuk_overdrachten.controleren is
  'Wat de ontvanger expliciet moet nakijken. Dit is het verschil tussen opvolgen en controleren.';
comment on column marketing_hq.werkstuk_overdrachten.mens_nodig is
  'Afgeleid uit de onzekerheden. Niet zelf in te vullen: een agent die dat mag, zegt nee.';

create index if not exists overdrachten_werkstuk_idx
  on marketing_hq.werkstuk_overdrachten (werkstuk_id, van_station);
create index if not exists overdrachten_open_idx
  on marketing_hq.werkstuk_overdrachten (status) where status = 'open';

-- ── 2. Onzekerheden hebben een vorm ────────────────────────────────────────
-- Als functie en niet als subquery: een CHECK mag geen subquery bevatten.
-- Zelfde reden als bij `jsonb_noemt_een_id` in 0020.
create or replace function marketing_hq.onzekerheden_kloppen(p jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(p) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(p) e
       where jsonb_typeof(e) <> 'object'
          or not (e ? 'wat')
          or not (e ? 'blokkerend')
          or jsonb_typeof(e->'blokkerend') <> 'boolean'
          or length(trim(coalesce(e->>'wat',''))) = 0
     )
$$;

alter table marketing_hq.werkstuk_overdrachten
  add constraint overdracht_onzekerheden_vorm
  check (marketing_hq.onzekerheden_kloppen(onzekerheden));

-- ── 3. Wie een blokkade opschrijft, maakt een poort ────────────────────────
-- De agent vult `mens_nodig` niet in; wat hij ook meestuurt wordt overschreven.
-- Dat is met opzet: de enige manier om te voorkomen dat er een mens bij moet
-- komen, is geen blokkerende onzekerheid opschrijven — en dan heb je die ook
-- niet gezien.
create or replace function marketing_hq.overdracht_poort_bepalen()
returns trigger language plpgsql as $$
declare blokkades text;
begin
  -- Eerst kijken of het wel een lijst is. Deze trigger vuurt vóór de
  -- constraint, dus zonder deze regel klapt hij op "cannot extract elements
  -- from a scalar" en krijgt de agent een Postgres-interne fout te zien in
  -- plaats van de melding die zegt wat er mis is. De constraint weigert de rij
  -- daarna alsnog, met de juiste naam erbij.
  if jsonb_typeof(new.onzekerheden) <> 'array' then
    return new;
  end if;

  select string_agg(e->>'wat', '; ')
    into blokkades
  from jsonb_array_elements(new.onzekerheden) e
  where (e->>'blokkerend')::boolean;

  if blokkades is not null then
    new.mens_nodig := true;
    new.mens_nodig_reden := blokkades;
  else
    new.mens_nodig := false;
    new.mens_nodig_reden := null;
  end if;
  return new;
end $$;

drop trigger if exists overdracht_poort on marketing_hq.werkstuk_overdrachten;
create trigger overdracht_poort
  before insert or update on marketing_hq.werkstuk_overdrachten
  for each row execute function marketing_hq.overdracht_poort_bepalen();

-- ── 4. Een stap kan niet af zonder overdracht ──────────────────────────────
-- Dit is de regel waar alles om draait. Zonder deze constraint is de overdracht
-- een goed voornemen: agents zouden hem kunnen overslaan precies wanneer het
-- druk is, en dat is precies wanneer je hem nodig hebt.
--
-- Station ⑥ is uitgezonderd. Daar is niemand meer om aan over te dragen; wat
-- daar besloten is staat in `waarom` op de stap zelf ✅.
--
-- De trigger vuurt alleen bij de overgang náár 'klaar'. Bestaande afgeronde
-- stappen uit juli blijven dus staan zoals ze zijn — ze terugwerkend afkeuren
-- zou de estafette breken voor werk dat allang gedaan is.
create or replace function marketing_hq.stap_vraagt_overdracht()
returns trigger language plpgsql as $$
begin
  if new.status = 'klaar'
     and (tg_op = 'INSERT' or old.status is distinct from 'klaar')
     and new.station < 6
     and not exists (
       select 1 from marketing_hq.werkstuk_overdrachten o
       where o.werkstuk_id = new.werkstuk_id
         and o.van_station = new.station
     )
  then
    raise exception
      'Station % van werkstuk % kan niet af zonder overdracht. Leg vast wat je besloot, waarop dat rust, en wat de volgende moet controleren.',
      new.station, new.werkstuk_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists stap_overdracht on marketing_hq.werkstuk_stappen;
create trigger stap_overdracht
  before insert or update on marketing_hq.werkstuk_stappen
  for each row execute function marketing_hq.stap_vraagt_overdracht();

-- ── 5. De overdrachten, met namen erbij ────────────────────────────────────
create or replace view marketing_hq.overdrachten as
select
  o.id, o.werkstuk_id, w.titel                          as werkstuk,
  o.van_station, vs.naam                                as van_station_naam,
  o.naar_station, ns.naam                               as naar_station_naam,
  dv.naam                                               as van,
  dv.soort                                              as van_soort,
  o.besluit, o.waarom, o.controleren,
  o.onzekerheden,
  jsonb_array_length(o.onzekerheden)                    as aantal_onzekerheden,
  o.mens_nodig, o.mens_nodig_reden,
  o.status,
  dd.naam                                               as afgehandeld_door,
  o.besloten_op, o.terug_reden, o.created_at,
  round(extract(epoch from (now() - o.created_at)) / 3600)::int as uren_open,
  -- Wat er nu van deze overdracht verwacht wordt. Er staat er altijd één
  -- (regel 0.4).
  case o.status
    when 'aangenomen'    then 'aangenomen door ' || coalesce(dd.naam, 'onbekend')
    when 'teruggestuurd' then 'teruggestuurd door ' || coalesce(dd.naam, 'onbekend') || ': ' || coalesce(o.terug_reden, '')
    when 'geescaleerd'   then 'ligt bij een mens: ' || coalesce(o.mens_nodig_reden, 'reden niet vastgelegd')
    when 'open'          then case when o.mens_nodig
                                   then 'wacht op een mens: ' || coalesce(o.mens_nodig_reden, '')
                                   else 'wacht op ' || coalesce(ns.naam, 'de volgende stap') end
    else 'onbekende status: ' || coalesce(o.status, 'leeg')
  end                                                   as stand
from marketing_hq.werkstuk_overdrachten o
join marketing_hq.werkstukken w on w.id = o.werkstuk_id
left join marketing_hq.werkstuk_stations vs on vs.station = o.van_station
left join marketing_hq.werkstuk_stations ns on ns.station = o.naar_station
left join marketing_hq.deelnemers dv on dv.id = coalesce(o.van_agent, o.van_mens::text)
left join marketing_hq.deelnemers dd on dd.id = coalesce(o.door_agent, o.door_mens::text);

comment on view marketing_hq.overdrachten is
  'Elke overdracht met namen, stand en wat er nog openstaat.';

-- ── 6. Het brein kent een zesde bron ───────────────────────────────────────
-- Een overdracht is precies het soort gebeurtenis waar het brein voor bestaat:
-- het moment waarop werk van hand tot hand gaat.
create or replace view marketing_hq.brein as
select
  e.created_at as wanneer, 'handeling' as soort, e.agent_id as wie, e.level as toon,
  e.message as wat, e.werkstuk_id, e.data as details, 'agent_events' as bron, e.id as bron_id
from marketing_hq.agent_events e
union all
select
  m.created_at, 'bericht', m.from_agent,
  case when m.read_at is null then 'warn' else 'info' end,
  m.from_agent || ' → ' || m.to_agent || ': ' || m.subject
    || case when m.read_at is null then '  (nog niet opgepakt)' else '' end,
  m.werkstuk_id,
  jsonb_build_object('aan', m.to_agent, 'body', m.body, 'gelezen', m.read_at),
  'agent_messages', m.id
from marketing_hq.agent_messages m
union all
select
  r.created_at, 'rapport', r.author_agent,
  case when r.voorlopig then 'warn' else 'info' end,
  r.title || case when r.voorlopig then '  (voorlopig: ' || coalesce(r.voorlopig_reden, '') || ')' else '' end,
  r.werkstuk_id,
  jsonb_build_object('kind', r.kind, 'vault_path', r.vault_path,
                     'periode', r.periode_start || ' t/m ' || r.periode_eind, 'gaten', r.gaten),
  'reports', r.id
from marketing_hq.reports r
union all
select
  a.created_at, 'poort', a.requested_by,
  case a.status
    when 'pending' then 'warn' when 'rejected' then 'error'
    when 'approved' then 'info' when 'executed' then 'info' else 'warn' end,
  a.action_type || ': ' || a.description
    || case a.status
         when 'pending'  then '  (wacht op akkoord)'
         when 'approved' then '  (akkoord door ' || coalesce(a.decided_by, 'onbekend') || ')'
         when 'rejected' then '  (afgewezen door ' || coalesce(a.decided_by, 'onbekend') || ')'
         when 'executed' then '  (uitgevoerd)'
         else '  (onbekende status: ' || coalesce(a.status, 'leeg') || ')'
       end,
  a.werkstuk_id,
  jsonb_build_object('status', a.status, 'payload', a.payload, 'besloten_op', a.decided_at),
  'approvals', a.id
from marketing_hq.approvals a
union all
select
  coalesce(rn.finished_at, rn.started_at), 'run', rn.agent_id,
  case rn.status when 'mislukt' then 'error' when 'klaar' then 'info' else 'warn' end,
  coalesce(rn.summary, rn.status),
  null::bigint,
  jsonb_build_object('status', rn.status, 'model', rn.model, 'kosten_usd', rn.cost_usd,
                     'tokens_in', rn.input_tokens, 'tokens_uit', rn.output_tokens,
                     'duur_sec', extract(epoch from (rn.finished_at - rn.started_at))::int),
  'agent_runs', rn.id
from marketing_hq.agent_runs rn
union all
-- Zesde bron: de overdracht zelf.
select
  o.created_at, 'overdracht', coalesce(o.van, 'onbekend'),
  case
    when o.status = 'teruggestuurd' then 'error'
    when o.mens_nodig               then 'warn'
    when o.status = 'open'          then 'warn'
    else 'info'
  end,
  'station ' || o.van_station || ' → ' || coalesce(o.naar_station_naam, 'einde')
    || ': ' || o.besluit || '  (' || o.stand || ')',
  o.werkstuk_id,
  jsonb_build_object('waarom', o.waarom, 'controleren', o.controleren,
                     'onzekerheden', o.onzekerheden, 'mens_nodig', o.mens_nodig),
  'werkstuk_overdrachten', o.id
from marketing_hq.overdrachten o;

comment on view marketing_hq.brein is
  'Alles wat er gebeurde, in één stroom op tijd. Zes bronnen, zeven soorten, geen tweede logboek.';

-- ── Toegang ────────────────────────────────────────────────────────────────
alter table marketing_hq.werkstuk_overdrachten enable row level security;
do $$ begin
  create policy overdrachten_lezen on marketing_hq.werkstuk_overdrachten
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;
grant select on marketing_hq.werkstuk_overdrachten to authenticated;

-- Expliciet, niet in de hoop dat `create or replace view` de optie behoudt —
-- dat doet hij niet, en dat kostte 0020 een halve deploy om te ontdekken.
alter view marketing_hq.overdrachten set (security_invoker = true);
alter view marketing_hq.brein        set (security_invoker = true);
grant select on marketing_hq.overdrachten to authenticated;

create or replace view public.hq_overdrachten with (security_invoker = true)
  as select * from marketing_hq.overdrachten;
revoke all on public.hq_overdrachten from anon, public;
grant select on public.hq_overdrachten to authenticated;

do $$
declare open_views text;
begin
  select string_agg(c.relname, ', ') into open_views
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'marketing_hq' and c.relkind = 'v'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%';
  if open_views is not null then
    raise exception 'views zonder security_invoker: %', open_views;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Wat hier bewust NIET in zit
--
-- Terugsturen werkt half: de status bestaat en vraagt een reden, maar het
-- werkstuk gaat er nog niet van terug naar het vorige station en de grens van
-- twee bestaat nog niet. Dat is WERKBANK ④ en krijgt zijn eigen migratie met
-- zijn eigen test — een stap terugzetten raakt de estafette, en dat is te veel
-- om mee te laten liften.
--
-- Terugdraaien
--
--   drop view if exists public.hq_overdrachten;
--   -- brein terug naar de versie in 0019/0020
--   drop view if exists marketing_hq.overdrachten;
--   drop trigger if exists stap_overdracht on marketing_hq.werkstuk_stappen;
--   drop function if exists marketing_hq.stap_vraagt_overdracht();
--   drop trigger if exists overdracht_poort on marketing_hq.werkstuk_overdrachten;
--   drop function if exists marketing_hq.overdracht_poort_bepalen();
--   drop table if exists marketing_hq.werkstuk_overdrachten;
--   drop function if exists marketing_hq.onzekerheden_kloppen(jsonb);
-- ═══════════════════════════════════════════════════════════════════════════
