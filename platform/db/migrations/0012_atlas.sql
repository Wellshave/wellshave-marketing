-- ═══════════════════════════════════════════════════════════════════════════
-- 0012 — Atlas
--
-- De eerste van de negen die volledig wordt uitgewerkt. Vier dingen moeten
-- vastliggen voordat een agent af is: wie hij is, wat hij niet mag, wat hij
-- oplevert, en waaraan je ziet of hij het gedaan heeft.
--
-- Zijn identiteit staat al vast (0010: station ⑤ meting, primair). Wat hier
-- bij komt is de andere drie, en dan zo dat het bijt:
--
--   1. Zijn afspraak wordt een rij, geen zin in een document. Wat hij levert,
--      hoe vaak, en na hoeveel stilte je hem mist.
--   2. Zijn eigen guardrail — "cijfers jonger dan 72 uur zijn voorlopig" —
--      wordt een trigger. Nu staat die regel in zijn prompt, en een prompt is
--      een verzoek. Een agent die een dagrapport definitief noemt terwijl de
--      attributie nog naloopt, wordt gecorrigeerd door de database.
--   3. Zijn rapport krijgt een machineleesbare kant. Een dagrapport dat alleen
--      proza is, kan door Bolt of Echo niet gelezen worden en door het scherm
--      niet getoond. De cijfers waarop hij oordeelde gaan mee als data.
--   4. Ontbrekende dagen worden een feit in plaats van een oordeel. Atlas mag
--      niet interpoleren; daarvoor moet hij eerst kunnen zien wát er ontbreekt.
--
-- Additief: één nieuwe tabel, zes kolommen op `reports`, drie views, één
-- trigger. Bestaande rapporten blijven staan en blijven leesbaar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De afspraak ─────────────────────────────────────────────────────────
-- Tot nu toe stond per agent in `agents.levert` één zin over wat hij oplevert.
-- Dat is genoeg om te lezen, te weinig om op te controleren: een agent heeft
-- meerdere opdrachten (`kind`) en die hebben elk hun eigen ritme en lat.
--
-- `max_stilte_uren` is de kern. Zonder dat getal is "Atlas draait dagelijks"
-- een voornemen; mét dat getal is stilte een meetbare afwijking en kan het
-- scherm zelf zeggen dat er iets mis is.
create table if not exists marketing_hq.agent_afspraken (
  agent_id        text not null references marketing_hq.agents(id) on delete cascade,
  kind            text not null,
  soort           text not null default 'model' check (soort in ('model','systeem')),
  cadans          text not null,
  levert          text not null,
  doel_tabel      text not null,
  lat             text not null,
  max_stilte_uren integer not null check (max_stilte_uren > 0),
  actief          boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (agent_id, kind)
);

comment on table marketing_hq.agent_afspraken is
  'Wat een agent per opdracht belooft: ritme, opbrengst, lat, en na hoeveel stilte hij gemist wordt.';
comment on column marketing_hq.agent_afspraken.soort is
  'model = er komt een taalmodel aan te pas. systeem = rekenwerk, geen model, geen kosten.';
comment on column marketing_hq.agent_afspraken.lat is
  'Waaraan je afleest dat de opdracht echt is uitgevoerd en niet half.';

insert into marketing_hq.agent_afspraken
  (agent_id, kind, soort, cadans, levert, doel_tabel, lat, max_stilte_uren)
values
  ('atlas', 'daily_report', 'model',
   'elke dag 05:00 UTC',
   'Eén dagrapport: wat er veranderde, waardoor, en het ene ding dat vandaag aandacht nodig heeft.',
   'reports',
   'Een rij in reports met kind=daily, gevulde cijfers, en de meetdagen benoemd — inclusief de dagen die ontbreken.',
   30),
  ('atlas', 'feedback_sync', 'systeem',
   'elke dag 05:40 UTC',
   'De gemeten cijfers per advertentie terug op de creative waar hij uit voortkwam.',
   'creatives',
   'Een geslaagde run zonder taalmodel: nul tokens, nul kosten, en creative_results dat meebeweegt.',
   30)
on conflict (agent_id, kind) do nothing;

-- ── 2. Het rapport krijgt een machineleesbare kant ─────────────────────────
-- `body_md` blijft wat het was: het rapport zoals een mens het leest. Wat
-- eromheen komt is de basis waarop dat rapport rust — de periode, de cijfers,
-- de signalen, en wat er ontbrak. Zonder die basis kan niemand later nagaan
-- of een conclusie klopte, en kan geen andere agent erop verderwerken.
alter table marketing_hq.reports
  add column if not exists periode_start   date,
  add column if not exists periode_eind    date,
  add column if not exists voorlopig       boolean not null default false,
  add column if not exists voorlopig_reden text,
  add column if not exists cijfers         jsonb not null default '{}'::jsonb,
  add column if not exists signalen        jsonb not null default '[]'::jsonb,
  add column if not exists gaten           jsonb not null default '[]'::jsonb;

comment on column marketing_hq.reports.cijfers is
  'De getallen waarop het oordeel rust. Een dagrapport zonder cijfers is een mening.';
comment on column marketing_hq.reports.signalen is
  'Wat opviel, elk met een naam en een richting, zodat een andere agent erop kan handelen.';
comment on column marketing_hq.reports.gaten is
  'Dagen of bronnen waarvoor geen data was. Expliciet, want een gat is geen nul.';

do $$ begin
  alter table marketing_hq.reports
    add constraint reports_periode_op_volgorde
    check (periode_eind is null or periode_start is null or periode_eind >= periode_start);
exception when duplicate_object then null; end $$;

-- Een dagrapport zónder getallen is een mening met een datum erop. Alleen voor
-- kind='daily', en alleen vooruit: bestaande rijen worden niet gecontroleerd,
-- anders zou de migratie stukloopen op rapporten van vóór deze regel.
do $$ begin
  alter table marketing_hq.reports
    add constraint reports_dagrapport_heeft_cijfers
    check (kind <> 'daily' or cijfers <> '{}'::jsonb) not valid;
exception when duplicate_object then null; end $$;

-- ── 3. De guardrail die bijt ───────────────────────────────────────────────
-- Meta-attributie druppelt tot 72 uur na. Die regel staat nu in Atlas' prompt,
-- en een prompt is een verzoek: een model dat haast heeft schrijft "de cijfers
-- van gisteren laten zien dat…" en niemand ziet het.
--
-- Hier wordt het een correctie in plaats van een verzoek. Wie een rapport
-- wegschrijft over een periode die nog naloopt, krijgt `voorlopig = true`
-- terug, of hij dat nu had ingevuld of niet. Hetzelfde geldt bij gaten: een
-- conclusie op een onvolledige reeks is per definitie voorlopig.
--
-- Geen exception maar een overschrijving, met bewust twee redenen: een fout
-- had de agent nog kunnen omzeilen door het veld weg te laten, een correctie
-- niet.
create or replace function marketing_hq.rapport_voorlopig_bewaken()
returns trigger language plpgsql as $$
declare
  redenen text[] := array[]::text[];
begin
  if new.periode_eind is not null and new.periode_eind > current_date - 3 then
    redenen := redenen || format('attributie loopt nog na tot %s', new.periode_eind + 3);
  end if;

  if jsonb_typeof(new.gaten) = 'array' and jsonb_array_length(new.gaten) > 0 then
    redenen := redenen || format('%s gat(en) in de reeks', jsonb_array_length(new.gaten));
  end if;

  if array_length(redenen, 1) > 0 then
    new.voorlopig := true;
    new.voorlopig_reden := array_to_string(redenen, '; ');
  elsif new.voorlopig then
    -- De agent mag zelf strenger zijn dan de regel, maar dan wel met een reden.
    new.voorlopig_reden := coalesce(nullif(trim(new.voorlopig_reden), ''),
                                    'als voorlopig gemarkeerd door de auteur');
  else
    new.voorlopig_reden := null;
  end if;

  return new;
end $$;

drop trigger if exists rapport_voorlopig on marketing_hq.reports;
create trigger rapport_voorlopig
  before insert or update on marketing_hq.reports
  for each row execute function marketing_hq.rapport_voorlopig_bewaken();

-- ── 4. Wat ontbreekt, als feit ─────────────────────────────────────────────
-- Atlas mag niet interpoleren. Om die regel te kunnen naleven moet hij eerst
-- kunnen zien wélke dagen ontbreken — anders is "er ontbreekt niets" een
-- aanname en geen waarneming.
--
-- De reeks komt uit generate_series en niet uit de tabel zelf: een dag zonder
-- rijen bestaat niet in `meta_insights_daily`, en juist die dag wil je zien.
create or replace view marketing_hq.meting_dekking as
with dagen as (
  select generate_series(current_date - 30, current_date - 1, interval '1 day')::date as dag
),
gemeten as (
  select insight_date, account_id,
         count(*)      as rijen,
         sum(spend)    as spend,
         bool_and(is_final) as definitief
  from marketing_hq.meta_insights_daily
  where level = 'account'
  group by insight_date, account_id
)
select
  d.dag,
  g.account_id,
  coalesce(g.rijen, 0)                                as rijen,
  g.spend,
  (g.insight_date is not null)                        as gemeten,
  coalesce(g.definitief, false)                       as definitief,
  (d.dag > current_date - 3)                          as loopt_nog_na,
  case
    when g.insight_date is null              then 'ontbreekt'
    when d.dag > current_date - 3            then 'voorlopig'
    when not coalesce(g.definitief, false)   then 'niet afgesloten'
    else 'compleet'
  end                                                 as staat
from dagen d
left join gemeten g on g.insight_date = d.dag;

comment on view marketing_hq.meting_dekking is
  'Per dag van de laatste 30: is er gemeten, is het definitief, of ontbreekt het. Een gat is geen nul.';

-- ── 5. Het dagrapport zoals het scherm het leest ───────────────────────────
create or replace view marketing_hq.atlas_dagrapport as
select
  r.id, r.report_date, r.title, r.author_agent,
  r.periode_start, r.periode_eind,
  r.voorlopig, r.voorlopig_reden,
  r.cijfers, r.signalen, r.gaten,
  jsonb_array_length(r.gaten)                         as aantal_gaten,
  jsonb_array_length(r.signalen)                      as aantal_signalen,
  case
    when r.periode_start is null or r.periode_eind is null then null
    else (r.periode_eind - r.periode_start) + 1
  end                                                 as periode_dagen,
  r.body_md,
  r.werkstuk_id,
  r.created_at
from marketing_hq.reports r
where r.kind = 'daily'
order by r.report_date desc, r.created_at desc;

comment on view marketing_hq.atlas_dagrapport is
  'Het dagrapport met zijn onderbouwing ernaast: periode, cijfers, signalen, gaten.';

-- ── 6. Nakoming ────────────────────────────────────────────────────────────
-- De vierde kant: waaraan zie je of een agent zijn afspraak nakomt. Niet "hoe
-- vaak heeft hij gedraaid" — dat zegt niets over of er iets uitkwam — maar of
-- er binnen de afgesproken stilte een geslaagde run én een levering was.
--
-- Alleen runs met een job_id tellen mee. Dat is dezelfde grens als in 0010:
-- runs zonder job komen uit de oude claude.ai-Routine en zeggen niets over
-- deze runtime.
create or replace view marketing_hq.agent_nakoming as
select
  a.agent_id,
  ag.name                                             as agent,
  a.kind,
  a.soort,
  a.cadans,
  a.levert,
  a.lat,
  a.max_stilte_uren,
  a.actief,
  lr.started_at                                       as laatste_run,
  lr.status                                           as laatste_status,
  ll.moment                                           as laatste_levering,
  case when lr.started_at is not null
       then round(extract(epoch from (now() - lr.started_at)) / 3600.0, 1) end as uren_stil,
  case
    when not a.actief                                        then 'uit'
    when lr.started_at is null                               then 'nog nooit gedraaid'
    when lr.status = 'failed'                                then 'laatste run mislukt'
    when now() - lr.started_at > (a.max_stilte_uren || ' hours')::interval
                                                             then 'te laat'
    when ll.moment is null                                   then 'gedraaid, niets geleverd'
    else 'op tijd'
  end                                                 as oordeel
from marketing_hq.agent_afspraken a
join marketing_hq.agents ag on ag.id = a.agent_id
left join lateral (
  select r.started_at, r.status
  from marketing_hq.agent_runs r
  join marketing_hq.agent_jobs j on j.id = r.job_id
  where r.agent_id = a.agent_id and j.kind = a.kind
  order by r.started_at desc
  limit 1
) lr on true
left join lateral (
  select max(rep.created_at) as moment
  from marketing_hq.reports rep
  where a.doel_tabel = 'reports'
    and rep.author_agent = a.agent_id
    and rep.created_at > now() - (a.max_stilte_uren || ' hours')::interval
) ll on true;

comment on view marketing_hq.agent_nakoming is
  'Per afspraak: draaide hij op tijd, en kwam er iets uit. Stilte is hier een uitkomst, geen leegte.';

-- ── Toegang ────────────────────────────────────────────────────────────────
create or replace view public.hq_meting_dekking with (security_invoker = true)
  as select * from marketing_hq.meting_dekking;
create or replace view public.hq_atlas_dagrapport with (security_invoker = true)
  as select * from marketing_hq.atlas_dagrapport;
create or replace view public.hq_agent_nakoming with (security_invoker = true)
  as select * from marketing_hq.agent_nakoming;

revoke all on public.hq_meting_dekking, public.hq_atlas_dagrapport,
              public.hq_agent_nakoming from anon, public;
grant select on public.hq_meting_dekking, public.hq_atlas_dagrapport,
                public.hq_agent_nakoming to authenticated;

alter table marketing_hq.agent_afspraken enable row level security;
do $$ begin
  create policy afspraken_lezen on marketing_hq.agent_afspraken
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   drop view if exists public.hq_agent_nakoming;
--   drop view if exists public.hq_atlas_dagrapport;
--   drop view if exists public.hq_meting_dekking;
--   drop view if exists marketing_hq.agent_nakoming;
--   drop view if exists marketing_hq.atlas_dagrapport;
--   drop view if exists marketing_hq.meting_dekking;
--   drop trigger if exists rapport_voorlopig on marketing_hq.reports;
--   drop function if exists marketing_hq.rapport_voorlopig_bewaken();
--   alter table marketing_hq.reports
--     drop constraint if exists reports_dagrapport_heeft_cijfers,
--     drop constraint if exists reports_periode_op_volgorde,
--     drop column if exists periode_start, drop column if exists periode_eind,
--     drop column if exists voorlopig,     drop column if exists voorlopig_reden,
--     drop column if exists cijfers,       drop column if exists signalen,
--     drop column if exists gaten;
--   drop table if exists marketing_hq.agent_afspraken;
-- ═══════════════════════════════════════════════════════════════════════════
