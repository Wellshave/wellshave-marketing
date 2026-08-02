-- ═══════════════════════════════════════════════════════════════════════════
-- 0024 — Terugsturen
--
-- Stap ④ van het Werkbank-raamwerk (docs/WERKBANK.md §6). Terugsturen is geen
-- ongedaan maken: het is een nieuwe stap die zegt dat iets niet klopt en wat
-- er moet veranderen. De geschiedenis verdwijnt niet, de teller gaat omlaag.
--
-- Twee dingen maken dit meer dan een statusveld.
--
-- De grens van twee. Twee agents kunnen elkaar eindeloos heen en weer sturen,
-- elk met een geldige reden, en dan staat het werkstuk stil terwijl het lijkt
-- te bewegen. Na twee keer terug op hetzelfde station moet een mens het doen.
-- Zelfde gedachte als de stapelgrens op goedkeuringen in 0020.
--
-- En het sluitstuk van 0023. Daar staat dat een afgetekend denkstuk bevroren
-- is en dat wie erop terugkomt het werkstuk terugstuurt. Dat terugsturen
-- bestond nog niet, dus die zin wees naar niets. Nu wel: terug naar ② zet het
-- denkstuk weer open, en de handtekening eraf.
--
-- Additief. 0009, 0022 en 0023 blijven zoals ze zijn.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De tabel ────────────────────────────────────────────────────────────
create table if not exists marketing_hq.werkstuk_terugzendingen (
  id            bigint generated always as identity primary key,
  werkstuk_id   bigint      not null references marketing_hq.werkstukken(id) on delete cascade,

  -- Vanaf waar teruggestuurd wordt, en waarheen. Terug is altijd naar een
  -- eerder station: "terugsturen" naar voren is gewoon doorgeven, en daar is
  -- de overdracht uit 0022 voor.
  van_station   smallint    not null check (van_station between 1 and 6),
  naar_station  smallint    not null check (naar_station between 1 and 6),
  check (naar_station < van_station),

  -- ── de vier delen (§6) ───────────────────────────────────────────────────
  -- 'naar welk station' staat hierboven; deze twee zijn de inhoud.
  wat_is_mis      text      not null,
  wat_moet_anders text      not null,
  check (length(trim(wat_is_mis))      > 0),
  check (length(trim(wat_moet_anders)) > 0),

  -- Wie het terugstuurt, bij naam. Precies één, zelfde patroon als 0021.
  door_agent    text        references marketing_hq.agents(id),
  door_mens     uuid        references public.team_members(id),
  check ((door_agent is null) <> (door_mens is null)),

  -- De hoeveelste keer dat dit station teruggestuurd is. Afgeleid bij insert
  -- en opgeslagen, zodat de geschiedenis te lezen is zonder window-functie —
  -- en zodat "dit stuk is drie keer langs ③ gegaan" een veld is en geen som.
  ronde         smallint    not null default 1 check (ronde >= 1),

  created_at    timestamptz not null default now()
);

comment on table marketing_hq.werkstuk_terugzendingen is
  'Een stap terug in de estafette, met wat er mis is en wat er moet veranderen. Geen ongedaan maken: de geschiedenis blijft staan.';
comment on column marketing_hq.werkstuk_terugzendingen.ronde is
  'Hoeveelste keer terug naar dit station. Vanaf de derde moet een mens het doen.';

create index if not exists terugzendingen_werkstuk_idx
  on marketing_hq.werkstuk_terugzendingen (werkstuk_id, naar_station);

-- ── 2. De grens van twee ───────────────────────────────────────────────────
-- Niet "na twee keer mag het niet meer", maar "na twee keer moet een mens het
-- doen". Het verschil telt: een harde stop laat het werkstuk klemzitten, en
-- dan wordt de grens omzeild in plaats van gerespecteerd.
--
-- De ronde wordt hier gezet en niet door de aanroeper meegegeven, om dezelfde
-- reden als `mens_nodig` in 0022: wie zijn eigen teller mag bijhouden, telt
-- verkeerd precies wanneer het uitkomt.
create or replace function marketing_hq.terugzending_grens()
returns trigger language plpgsql as $$
declare eerder int;
begin
  select count(*) into eerder
  from marketing_hq.werkstuk_terugzendingen t
  where t.werkstuk_id = new.werkstuk_id
    and t.naar_station = new.naar_station;

  new.ronde := eerder + 1;

  if new.ronde > 2 and new.door_agent is not null then
    raise exception
      'Station % van werkstuk % is al twee keer teruggestuurd. De derde keer moet een mens doen — twee agents die elkaar heen en weer sturen laten het werk stilstaan terwijl het lijkt te bewegen.',
      new.naar_station, new.werkstuk_id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists terugzending_grens_trg on marketing_hq.werkstuk_terugzendingen;
create trigger terugzending_grens_trg
  before insert on marketing_hq.werkstuk_terugzendingen
  for each row execute function marketing_hq.terugzending_grens();

-- ── 3. Wat terugsturen met de keten doet ───────────────────────────────────
-- De stations vanaf `naar_station` tot en met `van_station` gaan weer open.
-- Niet alleen het doelstation: als ⑤ terugstuurt naar ③, dan klopt ④ ook niet
-- meer — daar staat een advertentie live op een creatie die herzien wordt.
-- Een keten die dat laat staan liegt over waar het werk is.
--
-- `afgerond_op` gaat leeg mee. Anders zou de werkbank de stilte meten vanaf
-- een afronding die is ingetrokken, en dan lijkt een net teruggestuurd
-- werkstuk dagen stil te liggen.
create or replace function marketing_hq.terugzending_opent_keten()
returns trigger language plpgsql as $$
declare wie text;
begin
  select coalesce(d.naam, 'onbekend') into wie
  from marketing_hq.deelnemers d
  where d.id = coalesce(new.door_agent, new.door_mens::text);

  update marketing_hq.werkstuk_stappen s
     set status      = 'open',
         afgerond_op = null,
         waarom      = 'teruggestuurd door ' || coalesce(wie, 'onbekend')
                       || ' (ronde ' || new.ronde || '): ' || new.wat_is_mis
   where s.werkstuk_id = new.werkstuk_id
     and s.station between new.naar_station and new.van_station
     and s.status in ('klaar','bezig','wacht_op_mens','mislukt');

  -- Het sluitstuk van 0023. Een afgetekend denkstuk is bevroren; terug naar ②
  -- is de enige manier om er weer aan te werken. De handtekening gaat eraf,
  -- want die hoorde bij wat er toen stond.
  if new.naar_station <= 2 then
    update marketing_hq.denkstukken
       set status         = 'bezig',
           bevestigd_door = null,
           bevestigd_op   = null,
           updated_at     = now()
     where werkstuk_id = new.werkstuk_id
       and status = 'bevestigd';
  end if;

  return new;
end $$;

drop trigger if exists terugzending_opent on marketing_hq.werkstuk_terugzendingen;
create trigger terugzending_opent
  after insert on marketing_hq.werkstuk_terugzendingen
  for each row execute function marketing_hq.terugzending_opent_keten();

-- Terugsturen naar een station dat nog nooit af was, is geen terugsturen maar
-- een tikfout. De keten zou er niets van merken en de teller wel.
create or replace function marketing_hq.terugzending_heeft_grond()
returns trigger language plpgsql as $$
begin
  -- Een terugzending naar voren wordt door de CHECK op de tabel geweigerd.
  -- Een trigger vuurt vóór de constraint, dus zonder deze regel zou dit geval
  -- de verkeerde melding krijgen: "er valt niets terug te sturen" in plaats
  -- van "dit is geen terugsturen".
  if new.naar_station >= new.van_station then
    return new;
  end if;

  if not exists (
    select 1 from marketing_hq.werkstuk_stappen s
    where s.werkstuk_id = new.werkstuk_id
      and s.station between new.naar_station and new.van_station
      and s.status in ('klaar','bezig','wacht_op_mens','mislukt')
  ) then
    raise exception
      'Er valt niets terug te sturen: station % tot en met % van werkstuk % is nog nergens aan begonnen.',
      new.naar_station, new.van_station, new.werkstuk_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists terugzending_grond on marketing_hq.werkstuk_terugzendingen;
create trigger terugzending_grond
  before insert on marketing_hq.werkstuk_terugzendingen
  for each row execute function marketing_hq.terugzending_heeft_grond();

-- ── 4. Het gat in 0023 dichttimmeren ───────────────────────────────────────
-- 0023 laat station ③ beginnen zolang station ② op 'klaar' óf
-- 'niet_vastgelegd' staat. Die tweede was nodig om de werkstukken die er in
-- juli al lagen niet klem te zetten, maar hij is ook een omweg: wie ② op
-- 'niet_vastgelegd' zet, loopt de denkfase voorbij en de poort merkt niets.
--
-- Voor station ① is 'niet vastgelegd' een echte toestand — een handmatig
-- gestart werkstuk hád geen signaal uit de markt. Voor ② is het dat niet: "we
-- hebben er niet over nagedacht" is precies wat de denkfase moet voorkomen.
-- De enige geldige reden om ② over te slaan is dat het team besloten heeft
-- het niet te doen, en dan staat dat in het denkstuk.
--
-- De grendel zit op de overgang en niet op de bestaande rijen: werkstuk 9, 10
-- en 11 staan vandaag met ② op 'niet_vastgelegd' en blijven staan. Ze kunnen
-- alleen niet nog eens zo gezet worden, en nieuwe kunnen het niet worden.
create or replace function marketing_hq.stap_twee_niet_overslaan()
returns trigger language plpgsql as $$
declare stand text;
begin
  if new.station = 2
     and new.status = 'niet_vastgelegd'
     and (tg_op = 'INSERT' or old.status is distinct from 'niet_vastgelegd')
  then
    select d.status into stand
    from marketing_hq.denkstukken d where d.werkstuk_id = new.werkstuk_id;

    if stand is distinct from 'gestopt' then
      raise exception
        'De briefing van werkstuk % kan niet op ''niet_vastgelegd''. Denken is geen optionele stap: sluit het denkstuk af, of stop het met een reden.',
        new.werkstuk_id using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists stap_twee_overslaan on marketing_hq.werkstuk_stappen;
create trigger stap_twee_overslaan
  before insert or update on marketing_hq.werkstuk_stappen
  for each row execute function marketing_hq.stap_twee_niet_overslaan();

-- ── 5. Om te lezen ─────────────────────────────────────────────────────────
create or replace view marketing_hq.terugzendingen as
select
  t.id,
  t.werkstuk_id,
  w.titel                                       as werkstuk,
  t.van_station,
  vs.naam                                       as van_station_naam,
  t.naar_station,
  ns.naam                                       as naar_station_naam,
  t.wat_is_mis,
  t.wat_moet_anders,
  coalesce(dd.naam, 'onbekend')                 as door,
  dd.soort                                      as door_soort,
  t.ronde,
  t.created_at,
  -- Regel 0.4: er staat altijd iets, ook als er niets bijzonders is.
  case
    when t.ronde >= 3 then 'ronde ' || t.ronde || ' — hier moest een mens aan te pas komen'
    when t.ronde = 2  then 'ronde 2 — nog één keer, daarna moet een mens het doen'
    else 'eerste keer terug naar ' || ns.naam
  end                                           as stand
from marketing_hq.werkstuk_terugzendingen t
join marketing_hq.werkstukken w        on w.id = t.werkstuk_id
join marketing_hq.werkstuk_stations vs on vs.station = t.van_station
join marketing_hq.werkstuk_stations ns on ns.station = t.naar_station
left join marketing_hq.deelnemers dd
       on dd.id = coalesce(t.door_agent, t.door_mens::text);

comment on view marketing_hq.terugzendingen is
  'Elke stap terug, met wie hem zette en de hoeveelste keer het was.';

-- Per werkstuk: hoe vaak het heen en weer ging, en waar het blijft hangen.
-- Een werkstuk dat drie keer op hetzelfde station terugkomt heeft geen
-- uitvoeringsprobleem maar een denkprobleem, en dat is hier af te lezen.
create or replace view marketing_hq.terugzendingen_per_werkstuk as
select
  w.id                                          as werkstuk_id,
  w.titel                                       as werkstuk,
  count(t.id)                                   as keer_terug,
  max(t.ronde)                                  as hoogste_ronde,
  (array_agg(ns.naam order by t.ronde desc, t.created_at desc))[1] as blijft_hangen_op,
  max(t.created_at)                             as laatst_terug,
  case
    when count(t.id) = 0      then 'nog nooit teruggestuurd'
    when max(t.ronde) >= 3    then 'blijft hangen op ' ||
         (array_agg(ns.naam order by t.ronde desc, t.created_at desc))[1] ||
         ' — dat is geen uitvoeringsprobleem meer'
    when count(t.id) = 1      then 'één keer terug, dat hoort erbij'
    else count(t.id) || ' keer terug'
  end                                           as stand
from marketing_hq.werkstukken w
left join marketing_hq.werkstuk_terugzendingen t on t.werkstuk_id = w.id
left join marketing_hq.werkstuk_stations ns      on ns.station = t.naar_station
group by w.id, w.titel;

comment on view marketing_hq.terugzendingen_per_werkstuk is
  'Hoe vaak een werkstuk terugging en waar het blijft hangen. Nul is ook een antwoord.';

-- ── 6. Toegang ─────────────────────────────────────────────────────────────
alter table marketing_hq.werkstuk_terugzendingen enable row level security;

do $$ begin
  create policy terugzendingen_lezen on marketing_hq.werkstuk_terugzendingen
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

grant select on marketing_hq.werkstuk_terugzendingen to authenticated;

alter view marketing_hq.terugzendingen             set (security_invoker = true);
alter view marketing_hq.terugzendingen_per_werkstuk set (security_invoker = true);
grant select on marketing_hq.terugzendingen, marketing_hq.terugzendingen_per_werkstuk
  to authenticated;

create or replace view public.hq_terugzendingen with (security_invoker = true)
  as select * from marketing_hq.terugzendingen;
revoke all on public.hq_terugzendingen from anon, public;
grant select on public.hq_terugzendingen to authenticated;

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
-- Geen harde stop na twee keer. Een werkstuk dat niet meer terug kán, zit
-- klem, en dan wordt de grens omzeild in plaats van gerespecteerd. Wat er wel
-- gebeurt is dat de derde keer een mens vraagt — dezelfde vorm als de poort
-- in 0023: het systeem verlegt de beslissing, het blokkeert hem niet.
--
-- Geen automatisch terugsturen bij een afgekeurde overdracht. `status =
-- 'teruggestuurd'` op een overdracht (0022) is een oordeel over die ene
-- overdracht; een terugzending grijpt in de keten in. Wie beide tegelijk wil,
-- schrijft ze allebei op — dan staat er ook waarom.
--
-- Geen herstel van 'niet_vastgelegd' op station ② voor de werkstukken die er
-- al stonden. Terugkijkend rechtzetten wat toen is opgeschreven, is precies
-- wat 0023 verbiedt voor het denkstuk. De grendel geldt vooruit.
-- ═══════════════════════════════════════════════════════════════════════════
