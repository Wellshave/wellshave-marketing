-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 — Het brein
--
-- Beslisvraag van de werkruimte erboven (regel 0.1, opgeschreven vóór deze
-- regel SQL):
--
--     "Welk werk ligt stil, en op wie wacht het?"
--
-- Wat er al is, en dat is meer dan het lijkt: de runtime logt elke handeling.
-- `logEvent` schrijft bij het begin van een run, bij élke gereedschapsaanroep
-- (met invoer en of het lukte), bij elke waarschuwing, en bij het einde met de
-- kosten erbij. Er is geen tweede logboek nodig.
--
-- Wat er niet is, en dat is het echte gat. Drie dingen:
--
--   1. `agent_events` is de enige tabel in dit schema die niet aan een werkstuk
--      hangt. agent_messages, approvals en reports hebben allemaal een
--      werkstuk_id; het fijnmazigste verslag van wat een agent werkelijk deed
--      heeft het niet. Je kunt dus wel vragen "wat deed Atlas om 05:03", maar
--      nooit "wat is er allemaal met het scheerirritatie-idee gebeurd". En dat
--      tweede is precies wat een brein moet kunnen beantwoorden.
--
--   2. Er is niets dat het logboek tot een verhaal maakt. Vijf tabellen houden
--      elk een stuk van de waarheid vast — gebeurtenissen, berichten tussen
--      agents, rapporten, goedkeuringen, stappen in de estafette — en niemand
--      leest vijf tabellen naast elkaar.
--
--   3. Er is geen maat voor stilte. "Ligt stil" is de kern van de beslisvraag,
--      en dat getal bestaat nergens.
--
-- Wat hier NIET in zit: een nieuwe logtabel. De vault in `marketing-hq/brain/`
-- is met de hand geschreven en staat stil sinds 27 juli; die wordt straks een
-- afdruk van deze views, niet een tweede plek waar dingen worden bijgehouden.
-- Twee plekken die hetzelfde bijhouden lopen uit elkaar, en dan is geen van
-- beide meer te vertrouwen.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Het logboek aan het werkstuk hangen ─────────────────────────────────
-- Bewust geen foreign key met `on delete cascade`. Een werkstuk kan worden
-- opgeruimd terwijl het spoor van wat eraan gedaan is moet blijven bestaan —
-- dezelfde afweging als bij `meta_publications.creative_id` in 0007.
alter table marketing_hq.agent_events
  add column if not exists werkstuk_id bigint;

do $$ begin
  alter table marketing_hq.agent_events
    add constraint agent_events_werkstuk_fk
    foreign key (werkstuk_id) references marketing_hq.werkstukken(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists agent_events_werkstuk_idx
  on marketing_hq.agent_events (werkstuk_id, created_at desc);

-- De vraag "wat gebeurde er vandaag" is de meest gestelde en stond nergens
-- op een index.
create index if not exists agent_events_tijd_idx
  on marketing_hq.agent_events (created_at desc);

comment on column marketing_hq.agent_events.werkstuk_id is
  'Aan welk werkstuk deze handeling raakt. Leeg bij werk dat niet aan één idee hangt, zoals de dagelijkse accountmeting.';

-- ── 2. Eén stroom uit vijf tabellen ────────────────────────────────────────
-- Dit is wat het een brein maakt in plaats van een logtabel. De vijf soorten
-- staan bewust naast elkaar en niet in aparte views: wie wil weten wat er met
-- een idee gebeurd is, wil de goedkeuring zien tússen de gereedschapsaanroep
-- en het rapport, op tijdsvolgorde, niet in drie lijsten.
--
-- `soort` is grof met opzet. Zes waarden die je in één blik uit elkaar houdt,
-- niet dertig die je moet opzoeken.
create or replace view marketing_hq.brein as

-- Wat een agent deed. De runtime schrijft hier per gereedschapsaanroep een rij.
select
  e.created_at                                  as wanneer,
  'handeling'                                   as soort,
  e.agent_id                                    as wie,
  e.level                                       as toon,
  e.message                                     as wat,
  e.werkstuk_id,
  e.data                                        as details,
  'agent_events'                                as bron,
  e.id                                          as bron_id
from marketing_hq.agent_events e

union all

-- Wat een agent aan een ander doorgaf. Dit is de estafette in woorden.
select
  m.created_at,
  'bericht',
  m.from_agent,
  case when m.read_at is null then 'warn' else 'info' end,
  -- Ongelezen is geen detail: dat betekent dat de overdracht niet is opgepakt.
  m.from_agent || ' → ' || m.to_agent || ': ' || m.subject
    || case when m.read_at is null then '  (nog niet opgepakt)' else '' end,
  m.werkstuk_id,
  jsonb_build_object('aan', m.to_agent, 'body', m.body, 'gelezen', m.read_at),
  'agent_messages',
  m.id
from marketing_hq.agent_messages m

union all

-- Wat een agent opleverde.
select
  r.created_at,
  'rapport',
  r.author_agent,
  case when r.voorlopig then 'warn' else 'info' end,
  r.title || case when r.voorlopig then '  (voorlopig: ' || coalesce(r.voorlopig_reden, '') || ')' else '' end,
  r.werkstuk_id,
  jsonb_build_object('kind', r.kind, 'vault_path', r.vault_path,
                     'periode', r.periode_start || ' t/m ' || r.periode_eind,
                     'gaten', r.gaten),
  'reports',
  r.id
from marketing_hq.reports r

union all

-- Waar een mens aan te pas moest komen. Dit zijn de poorten uit de estafette.
--
-- De statuswaarden zijn Engels en dat is geen slordigheid maar de constraint op
-- approvals: pending / approved / rejected / executed. Bij het schrijven van
-- deze view nam ik de Nederlandse woorden aan die de rest van dit schema
-- gebruikt, en toen viel alles stil door naar `else`: drie goedkeuringen die op
-- een mens wachtten stonden in het brein als gewone informatie, zonder één
-- teken dat er iemand op zat te wachten. Precies wat dit brein moet opvangen.
--
-- Daarom staat er onderaan geen stille `else ''` meer. Een status die hier niet
-- bij staat wordt zichtbaar gemeld in plaats van weggemoffeld — op een poort
-- die geld kost is een onbekende toestand geen detail.
select
  a.created_at,
  'poort',
  a.requested_by,
  case a.status
    when 'pending'  then 'warn'
    when 'rejected' then 'error'
    when 'approved' then 'info'
    when 'executed' then 'info'
    else 'warn'
  end,
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
  'approvals',
  a.id
from marketing_hq.approvals a

union all

-- Wat een run kostte. Apart van 'handeling' omdat dit de enige rij is waar
-- geld in staat, en geld hoort niet weggestopt tussen de gereedschapsaanroepen.
select
  coalesce(rn.finished_at, rn.started_at),
  'run',
  rn.agent_id,
  case rn.status when 'mislukt' then 'error' when 'klaar' then 'info' else 'warn' end,
  coalesce(rn.summary, rn.status),
  null::bigint,
  jsonb_build_object('status', rn.status, 'model', rn.model, 'kosten_usd', rn.cost_usd,
                     'tokens_in', rn.input_tokens, 'tokens_uit', rn.output_tokens,
                     'duur_sec', extract(epoch from (rn.finished_at - rn.started_at))::int),
  'agent_runs',
  rn.id
from marketing_hq.agent_runs rn;

comment on view marketing_hq.brein is
  'Alles wat de agents deden, in één stroom op tijd. Vijf bronnen, zes soorten, geen tweede logboek.';

-- ── 3. Per dag ─────────────────────────────────────────────────────────────
-- Wat er op een dag gebeurde, in de vorm waarin je het aan iemand vertelt:
-- wie er werkte, wat eruit kwam, wat misging, en wat het kostte.
create or replace view marketing_hq.brein_dag as
select
  b.wanneer::date                                                   as dag,
  count(*)                                                          as gebeurtenissen,
  count(distinct b.wie)                                             as agents_actief,
  string_agg(distinct b.wie, ', ' order by b.wie)                   as wie,
  count(*) filter (where b.soort = 'rapport')                       as rapporten,
  count(*) filter (where b.soort = 'bericht')                       as berichten,
  count(*) filter (where b.soort = 'poort')                         as poorten,
  count(*) filter (where b.toon = 'error')                          as fouten,
  count(*) filter (where b.toon = 'warn')                           as waarschuwingen,
  -- Kosten staan alleen op runs; de coalesce houdt een dag zonder run op 0
  -- in plaats van leeg, want "niets gedraaid" is een ander bericht dan "geen
  -- idee".
  coalesce(round(sum((b.details->>'kosten_usd')::numeric) filter (where b.soort = 'run'), 4), 0) as kosten_usd,
  min(b.wanneer)                                                    as eerste,
  max(b.wanneer)                                                    as laatste
from marketing_hq.brein b
group by b.wanneer::date;

comment on view marketing_hq.brein_dag is
  'Eén regel per dag: wie er werkte, wat eruit kwam, wat misging, wat het kostte.';

-- ── 4. De werkbank ─────────────────────────────────────────────────────────
-- Het antwoord op de beslisvraag. Per werkstuk: waar het ligt, op wie het
-- wacht, en hoe lang er niets is gebeurd.
--
-- De maat voor stilte hangt af van het soort overdracht, en dat is geen detail.
-- Een stap die vanzelf door hoort te lopen en al een dag stilligt, is stuk. Een
-- stap die op een mens wacht mag dagen wachten — dat is geen storing maar de
-- bedoeling. Eén drempel voor allebei zou de werkbank elke ochtend laten
-- schreeuwen over werk dat gewoon op jou ligt te wachten, en dan kijkt niemand
-- er na een week meer naar.
create or replace view marketing_hq.werkbank as
with uit_brein as (
  -- Wanneer er voor het laatst íéts met dit werkstuk gebeurde. Uit de brein-
  -- stroom, zodat een bericht of een goedkeuring net zo goed meetelt als een
  -- gereedschapsaanroep.
  select werkstuk_id, max(wanneer) as laatst
  from marketing_hq.brein
  where werkstuk_id is not null
  group by werkstuk_id
),
uit_stappen as (
  -- En uit de estafette zelf. Dit is geen dubbelop maar de belangrijkste bron
  -- van de twee: `agent_events` staat vandaag op nul, want de runtime heeft
  -- nog nooit gedraaid. Zou stilte alleen uit de logstroom komen, dan meldde
  -- de werkbank vanmorgen dat élk werkstuk nul uur stilligt — precies op het
  -- moment dat je hem nodig hebt.
  select werkstuk_id, max(afgerond_op) as laatst
  from marketing_hq.werkstuk_stappen
  where afgerond_op is not null
  group by werkstuk_id
),
laatste as (
  -- greatest() slaat NULL over, dus dit levert de laatste van de twee die
  -- bestaat. De coalesce staat er ómheen en niet erin: binnenin zou
  -- created_at (nu) altijd winnen van een stap die 180 uur geleden af was,
  -- en dan meet je de leeftijd van de rij in plaats van de stilte.
  select w.id as werkstuk_id,
         coalesce(greatest(b.laatst, s.laatst), w.created_at) as laatst
  from marketing_hq.werkstukken w
  left join uit_brein   b on b.werkstuk_id = w.id
  left join uit_stappen s on s.werkstuk_id = w.id
),
huidig as (
  -- Het station waar het nu ligt, met het soort overdracht erbij.
  --
  -- De koppeling loopt via `station_nu` uit de estafette en niet via "elke stap
  -- die niet af is". 0009 legt bij elk nieuw werkstuk meteen alle zes de
  -- stappen aan, dus dat tweede geeft er vijf tegelijk terug en waaiert de
  -- werkbank uit tot vijf regels voor hetzelfde idee. Bovendien zou het een
  -- tweede definitie van "waar ligt het nu" opleveren naast die van 0009, en
  -- twee definities lopen vroeg of laat uit elkaar.
  select s.werkstuk_id, s.station, s.agent_id, s.status, s.overdracht, stn.naam as station_naam
  from marketing_hq.werkstuk_stappen s
  join marketing_hq.werkstuk_stations stn on stn.station = s.station
)
select
  w.id, w.brand, w.titel, w.product, w.persona, w.angle_type,
  w.toestand, w.stappen_af, w.station_nu, w.stappen,
  w.aantal_ads, w.spend, w.omzet, w.roas, w.winnaars,

  h.station_naam,
  h.overdracht,
  -- Op wie het wacht, in mensentaal. Een naam of het woord 'jij' — nooit een
  -- statuscode, want daar kun je niets mee (regel 0.3).
  case
    when w.toestand = 'gestopt'                    then null
    when w.toestand = 'klaar'                      then null
    when h.overdracht in ('poort','mens')          then 'jij'
    else h.agent_id
  end                                                       as wacht_op,

  coalesce(l.laatst, w.created_at)                          as laatst_iets_gebeurd,
  round(extract(epoch from (now() - coalesce(l.laatst, w.created_at))) / 3600)::int as stil_uren,

  -- De grens waarboven stilte betekenis krijgt, per soort overdracht.
  case h.overdracht
    when 'vanzelf' then 24     -- hoort binnen een dagcyclus door te lopen
    when 'poort'   then 72     -- een mens mag er een weekend over doen
    when 'mens'    then 168    -- creatief werk is geen dagtaak
    else 72
  end                                                       as stil_grens_uren,

  case
    when w.toestand in ('gestopt','klaar') then false
    else extract(epoch from (now() - coalesce(l.laatst, w.created_at))) / 3600
         > case h.overdracht when 'vanzelf' then 24 when 'poort' then 72 when 'mens' then 168 else 72 end
  end                                                       as te_stil,

  -- Waarom het stilligt, of waarom niet. Er staat er altijd één (regel 0.4).
  case
    when w.toestand = 'gestopt'      then coalesce(w.gestopt_reden, 'gestopt zonder reden erbij')
    when w.toestand = 'klaar'        then 'alle zes de stations af'
    when w.toestand = 'vastgelopen'  then 'een stap is mislukt en niemand heeft hem opgepakt'
    when h.overdracht in ('poort','mens')
      then 'ligt bij jou op station ' || h.station || ' — ' || h.station_naam
    else 'ligt bij ' || coalesce(h.agent_id, 'niemand') || ' op station ' || h.station || ' — ' || h.station_naam
  end                                                       as waarom,

  w.created_at
from marketing_hq.werkstuk_estafette w
left join laatste l on l.werkstuk_id = w.id
left join huidig  h on h.werkstuk_id = w.id and h.station = w.station_nu;

comment on view marketing_hq.werkbank is
  'Welk werk ligt stil, en op wie wacht het? Stiltegrens per soort overdracht, want wachten op een mens is geen storing.';
comment on column marketing_hq.werkbank.te_stil is
  'Stilte die betekenis heeft: langer dan wat bij dit soort overdracht normaal is. Niet zomaar "lang geleden".';

-- ── Toegang ────────────────────────────────────────────────────────────────
alter view marketing_hq.brein      set (security_invoker = true);
alter view marketing_hq.brein_dag  set (security_invoker = true);
alter view marketing_hq.werkbank   set (security_invoker = true);
grant select on marketing_hq.brein, marketing_hq.brein_dag, marketing_hq.werkbank
  to authenticated;

create or replace view public.hq_brein      with (security_invoker = true) as select * from marketing_hq.brein;
create or replace view public.hq_brein_dag  with (security_invoker = true) as select * from marketing_hq.brein_dag;
create or replace view public.hq_werkbank   with (security_invoker = true) as select * from marketing_hq.werkbank;
revoke all on public.hq_brein, public.hq_brein_dag, public.hq_werkbank from anon, public;
grant select on public.hq_brein, public.hq_brein_dag, public.hq_werkbank to authenticated;

-- Dezelfde vangnetcontrole als 0017 en 0018.
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
--   drop view if exists public.hq_werkbank, public.hq_brein_dag, public.hq_brein;
--   drop view if exists marketing_hq.werkbank;
--   drop view if exists marketing_hq.brein_dag;
--   drop view if exists marketing_hq.brein;
--   drop index if exists marketing_hq.agent_events_tijd_idx;
--   drop index if exists marketing_hq.agent_events_werkstuk_idx;
--   alter table marketing_hq.agent_events drop constraint if exists agent_events_werkstuk_fk;
--   alter table marketing_hq.agent_events drop column if exists werkstuk_id;
-- ═══════════════════════════════════════════════════════════════════════════
