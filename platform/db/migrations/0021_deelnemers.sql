-- ═══════════════════════════════════════════════════════════════════════════
-- 0021 — Deelnemers bij naam
--
-- Stap 1 van het raamwerk in docs/WERKBANK.md. Alles wat daarna komt — het
-- denkstuk, de overdracht, terugsturen — leunt hierop, want elk van die dingen
-- moet zeggen wie het deed.
--
-- Vandaag zegt de estafette dat niet. `werkstuk_stappen.agent_id` is leeg als
-- een mens de stap deed, dus de keten kan wel tonen dát er een mens aan te pas
-- kwam maar niet wie. Zolang mensen alleen "niet-agents" zijn, zijn ze geen
-- volwaardige deelnemers maar een gat in de gegevens.
--
-- ── Waarom twee kolommen en niet één ───────────────────────────────────────
--
-- Er zijn twee sleutelruimtes: `marketing_hq.agents.id` is tekst ('nova'), en
-- `public.team_members.id` is een uuid. Eén `door`-kolom zou naar geen van
-- beide een foreign key kunnen leggen, en dan is "Nova" straks een typefout
-- verwijderd van "nova" zonder dat iets het merkt.
--
-- Dus twee kolommen met een constraint eroverheen die zegt: precies één. Dat
-- geeft referentiële integriteit aan beide kanten én maakt "wie deed dit"
-- afdwingbaar in plaats van hoopvol.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Een stap kan door een mens gedaan zijn ──────────────────────────────
alter table marketing_hq.werkstuk_stappen
  add column if not exists mens_id uuid references public.team_members(id);

comment on column marketing_hq.werkstuk_stappen.mens_id is
  'Welk teamlid deze stap deed. Precies één van agent_id / mens_id is gevuld zodra de stap begonnen is.';

create index if not exists werkstuk_stappen_mens_idx
  on marketing_hq.werkstuk_stappen (mens_id) where mens_id is not null;

-- ── 2. Terugwerkend invullen wat uit de gegevens blijkt ────────────────────
-- Eén van de drie afgeronde mensstappen is te herleiden: de creatives onder
-- werkstuk 9 dragen de maker. De andere twee niet.
--
-- Die twee blijven leeg. Ze invullen met "waarschijnlijk Dustin" zou de enige
-- gebruiker van dit systeem een naam geven die niemand ooit heeft ingetypt, en
-- dan staat er straks een verzonnen feit in de geschiedenis. Liever een gat dat
-- zegt dat het een gat is — dat is ook precies waar deze migratie over gaat.
update marketing_hq.werkstuk_stappen s
   set mens_id = h.user_id
  from (
    -- array_agg en niet min(): Postgres kent geen min() voor uuid.
    select c.werkstuk_id, (array_agg(distinct c.user_id))[1] as user_id
    from public.creatives c
    where c.werkstuk_id is not null and c.user_id is not null
    group by c.werkstuk_id
    having count(distinct c.user_id) = 1
  ) h
 where s.werkstuk_id = h.werkstuk_id
   and s.status = 'klaar'
   and s.agent_id is null
   and s.mens_id is null;

-- ── 3. Precies één deelnemer, zodra er iets gebeurd is ─────────────────────
-- Een stap die nog openstaat heeft geen deelnemer, en dat hoort: er is nog
-- niemand aan begonnen. Maar zodra hij bezig, klaar of mislukt is, heeft
-- iemand iets gedaan — en dan hoort daar een naam bij.
--
-- `niet_vastgelegd` valt er bewust buiten. Dat is de status voor werk dat vóór
-- de estafette bestond; daar is per definitie niemand van bekend.
--
-- NOT VALID: de twee stappen uit §2 die niet te herleiden waren zouden anders
-- deze migratie tegenhouden, en dan zou de regel nooit gaan gelden omdat er
-- twee oude rijen niet aan voldoen. Vanaf nu geldt hij.
alter table marketing_hq.werkstuk_stappen
  add constraint werkstuk_stappen_precies_een_deelnemer
  check (
    status in ('open', 'niet_vastgelegd')
    or (agent_id is null) <> (mens_id is null)
  ) not valid;

comment on constraint werkstuk_stappen_precies_een_deelnemer on marketing_hq.werkstuk_stappen is
  'NOT VALID: twee stappen uit juli zijn niet te herleiden en blijven naamloos. Geldt voor alles daarna.';

-- ── 4. Ook het startsein heeft een naam nodig ──────────────────────────────
-- `werkstukken.gestart_door` bevat vandaag een agent-id of het woord 'mens'.
-- Dat tweede is hetzelfde probleem in het klein.
alter table marketing_hq.werkstukken
  add column if not exists gestart_door_mens uuid references public.team_members(id);

comment on column marketing_hq.werkstukken.gestart_door_mens is
  'Welk teamlid dit werkstuk startte. Gevuld als gestart_door = mens.';

-- ── 5. Eén lijst met iedereen die kan meedoen ──────────────────────────────
-- Mensen en agents zijn hetzelfde soort deelnemer, dus er hoort één plek te
-- zijn waar je een id in een naam omzet. Twee lijsten zou betekenen dat elk
-- scherm en elke afdruk zelf moet weten welke van de twee het moet raadplegen,
-- en dan gaat dat ergens mis.
create or replace view marketing_hq.deelnemers as
select
  a.id                                   as id,
  'agent'                                as soort,
  a.name                                 as naam,
  a.role                                 as rol,
  a.operationeel                         as actief
from marketing_hq.agents a
union all
select
  t.id::text,
  'mens',
  -- Niet iedereen heeft zijn volledige naam ingevuld; dan is het e-mailadres
  -- het beste dat we hebben. Een lege naam op het scherm is geen optie.
  coalesce(nullif(trim(t.full_name), ''), t.email),
  t.role,
  (t.status = 'approved')
from public.team_members t;

comment on view marketing_hq.deelnemers is
  'Iedereen die aan een werkstuk kan werken, mens en agent in één lijst. Eén plek waar een id een naam wordt.';

-- ── 6. De estafette noemt voortaan namen ───────────────────────────────────
-- Dezelfde view als in 0009, met twee velden erbij per stap: wie het deed en
-- of dat een mens of een agent was. Het scherm hoeft dan niets meer af te
-- leiden uit "agent_id is leeg".
create or replace view marketing_hq.werkstuk_estafette as
with stappen as (
  select
    w.id,
    count(*) filter (where s.status = 'klaar')                             as stappen_af,
    min(s.station) filter (
      where s.status in ('open','bezig','wacht_op_mens','mislukt')
    )                                                                      as station_nu,
    bool_or(s.status = 'wacht_op_mens')                                    as wacht_op_mens,
    bool_or(s.status = 'mislukt')                                          as heeft_fout,
    jsonb_agg(jsonb_build_object(
      'station',    s.station,
      'naam',       stn.naam,
      'agent',      s.agent_id,
      -- Nieuw: de naam van wie het deed, mens of agent, en welke van de twee.
      'door',       d.naam,
      'door_soort', d.soort,
      'status',     s.status,
      'overdracht', s.overdracht,
      'waarom',     s.waarom,
      'afgerond',   s.afgerond_op
    ) order by s.station)                                                  as stappen
  from marketing_hq.werkstukken w
  left join marketing_hq.werkstuk_stappen s    on s.werkstuk_id = w.id
  left join marketing_hq.werkstuk_stations stn on stn.station = s.station
  left join marketing_hq.deelnemers d
         on d.id = coalesce(s.agent_id, s.mens_id::text)
  group by w.id
),
cijfers as (
  select
    c.werkstuk_id,
    count(*)                                                    as aantal_ads,
    sum(cr.spend)                                               as spend,
    sum(cr.purchase_value)                                      as omzet,
    case when sum(cr.spend) > 0
         then round(sum(cr.purchase_value) / sum(cr.spend), 3) end as roas,
    count(*) filter (where c.status = 'Winner')                 as winnaars
  from public.creatives c
  join marketing_hq.creative_results cr on cr.creative_id = c.id
  where c.werkstuk_id is not null
  group by c.werkstuk_id
)
select
  w.id, w.brand, w.titel, w.product, w.persona, w.angle_type,
  w.aanleiding, w.gestart_door, w.status, w.gestopt_reden,
  coalesce(st.stappen_af, 0)                                  as stappen_af,
  st.station_nu,
  coalesce(st.wacht_op_mens, false)                           as wacht_op_mens,
  coalesce(st.heeft_fout, false)                              as heeft_fout,
  case
    when w.status = 'gestopt'           then 'gestopt'
    when coalesce(st.stappen_af,0) >= 6 then 'klaar'
    when st.heeft_fout                  then 'vastgelopen'
    when st.wacht_op_mens               then 'wacht_op_mens'
    else 'loopt'
  end                                                         as toestand,
  st.stappen,
  c.aantal_ads, c.spend, c.omzet, c.roas, c.winnaars,
  w.created_at, w.updated_at,
  -- Achteraan en niet op zijn logische plek: `create or replace view` mag
  -- kolommen niet herordenen of hernoemen, en deze view heeft afhankelijke
  -- views (werkbank). Hem droppen om hem mooi te krijgen zou die meenemen.
  --
  -- Wie dit werkstuk startte, bij naam. Bij een agent zijn eigen naam, bij een
  -- mens die van het teamlid, en anders eerlijk 'onbekend'.
  coalesce(ds.naam, dg.naam, 'onbekend')                      as gestart_door_naam
from marketing_hq.werkstukken w
left join stappen st on st.id = w.id
left join cijfers c  on c.werkstuk_id = w.id
left join marketing_hq.deelnemers ds on ds.id = w.gestart_door_mens::text
left join marketing_hq.deelnemers dg on dg.id = w.gestart_door;

comment on view marketing_hq.werkstuk_estafette is
  'Eén idee met zijn volledige keten. Elke stap noemt wie hem deed — mens of agent, altijd bij naam.';

-- ── Toegang ────────────────────────────────────────────────────────────────
alter view marketing_hq.deelnemers         set (security_invoker = true);
alter view marketing_hq.werkstuk_estafette set (security_invoker = true);
grant select on marketing_hq.deelnemers to authenticated;

create or replace view public.hq_deelnemers with (security_invoker = true)
  as select * from marketing_hq.deelnemers;
revoke all on public.hq_deelnemers from anon, public;
grant select on public.hq_deelnemers to authenticated;

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
-- Terugdraaien
--
--   drop view if exists public.hq_deelnemers;
--   -- werkstuk_estafette terug naar de versie in 0009_ruggengraat.sql
--   drop view if exists marketing_hq.deelnemers;
--   alter table marketing_hq.werkstukken drop column if exists gestart_door_mens;
--   alter table marketing_hq.werkstuk_stappen
--     drop constraint if exists werkstuk_stappen_precies_een_deelnemer;
--   drop index if exists marketing_hq.werkstuk_stappen_mens_idx;
--   alter table marketing_hq.werkstuk_stappen drop column if exists mens_id;
-- ═══════════════════════════════════════════════════════════════════════════
