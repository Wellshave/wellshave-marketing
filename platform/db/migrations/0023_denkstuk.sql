-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 — Het denkstuk
--
-- Stap ② van het Werkbank-raamwerk (docs/WERKBANK.md §2). De denkfase levert
-- één object op: zeven vragen, elk met een antwoord, wie het voorstelde, en
-- hoe zeker het is.
--
-- Waar deze migratie om draait is de poort aan het eind. Een werkstuk kan
-- station ② niet verlaten zonder dat een MENS het denkstuk heeft afgetekend.
-- Dat is de enige plek in het hele systeem waar "een handmatig werkstuk gaat
-- nooit direct naar productie" afdwingbaar is. Agents mogen alle zeven velden
-- invullen; ze kunnen niet zelf tekenen. Dat is niet met een rolcontrole
-- geregeld maar met de vorm van de tabel: er is geen kolom waar een agent in
-- past.
--
-- Additief. 0009 en 0022 blijven zoals ze zijn.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De zeven vragen, als data ───────────────────────────────────────────
-- In een tabel en niet in code, om dezelfde reden als `werkstuk_stations`:
-- de vraagstelling is inhoud, geen implementatie. Wie een vraag wil
-- herformuleren hoeft daar geen deploy voor te doen.
create table if not exists marketing_hq.denkstuk_vragen (
  vraag          smallint primary key check (vraag between 1 and 7),
  tekst          text not null,
  -- Wie hem normaal voorstelt. 'samen' als het niet één agent is. Dit is een
  -- verwachting en geen toewijzing: iedereen mag elk veld invullen.
  normaal_door   text not null,
  toelichting    text not null
);

insert into marketing_hq.denkstuk_vragen (vraag, tekst, normaal_door, toelichting) values
  (1, 'Wat is de marketingangle?',                'nova',  'De hoek waaronder we dit vertellen'),
  (2, 'Welk probleem of verlangen ligt eronder?', 'nova',  'Uit reviews en klantenservice, niet uit de onderbuik'),
  (3, 'Voor welke persona is dit relevant?',      'nova',  'Getoetst aan de personabibliotheek'),
  (4, 'Wat is de hypothese?',                     'samen', 'Vorm ligt vast: als we X, dan Y, omdat Z'),
  (5, 'Welk format past hierbij?',                'pixel', 'Beeld, video, carrousel — en waarom dat'),
  (6, 'Wat moet getest worden?',                  'bolt',  'Wat de test moet uitwijzen, niet wat we hopen'),
  (7, 'Waarom is dit nu relevant?',               'radar', 'Wat er vandaag anders is dan vorige maand')
on conflict (vraag) do nothing;

-- ── 2. Het denkstuk ────────────────────────────────────────────────────────
-- Eén per werkstuk. Niet meer: als de denkfase opnieuw moet, is dat hetzelfde
-- denkstuk dat terugkomt en niet een tweede versie ernaast — anders is er geen
-- antwoord op de vraag "wat dachten we toen we dit besloten".
create table if not exists marketing_hq.denkstukken (
  id            bigint generated always as identity primary key,
  werkstuk_id   bigint      not null unique
                references marketing_hq.werkstukken(id) on delete cascade,

  status        text        not null default 'bezig'
                check (status in ('bezig','bevestigd','gestopt')),

  -- Aftekenen kan alleen een mens. Er is met opzet geen `bevestigd_door_agent`
  -- naast deze kolom: wat er niet is, kan geen agent invullen.
  bevestigd_door uuid       references public.team_members(id),
  bevestigd_op  timestamptz,
  check (status <> 'bevestigd' or (bevestigd_door is not null and bevestigd_op is not null)),

  -- "Niet doen" is een geldige uitkomst. Zonder deze uitgang wordt elk idee
  -- vanzelf een advertentie, en dan is de denkfase een formaliteit.
  gestopt_reden text,
  check (status <> 'gestopt' or (gestopt_reden is not null and length(trim(gestopt_reden)) > 0)),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table marketing_hq.denkstukken is
  'De denkfase van één werkstuk. Gaat pas dicht als een mens hem aftekent — of als het team besluit het niet te doen.';
comment on column marketing_hq.denkstukken.bevestigd_door is
  'Een teamlid. Er bestaat geen agent-variant van deze kolom, en dat is de hele grendel.';

-- ── 3. De antwoorden ───────────────────────────────────────────────────────
create table if not exists marketing_hq.denkstuk_antwoorden (
  id            bigint generated always as identity primary key,
  denkstuk_id   bigint      not null references marketing_hq.denkstukken(id) on delete cascade,
  vraag         smallint    not null references marketing_hq.denkstuk_vragen(vraag),

  antwoord      text        not null check (length(trim(antwoord)) > 0),

  -- Drie waarden, en ze betekenen iets:
  --   onderbouwd — er is eerder bewijs, en dat wordt erbij genoemd
  --   aanname    — plausibel, niet getoetst; dit is wat de test moet uitwijzen
  --   open       — we weten het niet, en dat blijft staan
  zekerheid     text        not null
                check (zekerheid in ('onderbouwd','aanname','open')),

  -- Wie het voorstelde. Precies één, zelfde patroon als 0021 en 0022.
  door_agent    text        references marketing_hq.agents(id),
  door_mens     uuid        references public.team_members(id),
  check ((door_agent is null) <> (door_mens is null)),

  -- 'onderbouwd' zonder bron is een aanname met een beter woord ervoor.
  bron          text,
  check (zekerheid <> 'onderbouwd' or (bron is not null and length(trim(bron)) > 0)),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (denkstuk_id, vraag)
);

comment on column marketing_hq.denkstuk_antwoorden.zekerheid is
  'Wat dit antwoord waard is. Een denkstuk dat overal onderbouwd zegt, test niets nieuws.';
comment on column marketing_hq.denkstuk_antwoorden.bron is
  'Verplicht bij onderbouwd. Zonder bron is "onderbouwd" een woord en geen bewijs.';

create index if not exists denkstuk_antwoorden_idx
  on marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag);

-- ── 4. De hypothese heeft een vorm ─────────────────────────────────────────
-- "als we X, dan Y, omdat Z". Zonder Z is het een voorspelling en geen
-- hypothese, en dan valt er achteraf niets te leren — de meting kan dan wel
-- zeggen dát het werkte, maar niet of de reden klopte.
--
-- Immutable functie en geen inline expressie, zelfde reden als
-- `onzekerheden_kloppen` in 0022: leesbaar, apart te testen, herbruikbaar.
--
-- De volgorde wordt getoetst en niet alleen de aanwezigheid van de drie
-- woorden. "Het werkte omdat we dan als we opschalen" bevat alle drie en is
-- geen hypothese.
create or replace function marketing_hq.hypothese_heeft_vorm(p text)
returns boolean language sql immutable as $$
  select p is not null
     and p ~* '(^|\W)als\s+we\s+\S'      -- "als we <iets>"
     and p ~* ',\s*dan\s+\S'             -- ", dan <iets>"
     and p ~* '\momdat\s+\S'             -- "omdat <iets>"
     and strpos(lower(p), 'als we') < strpos(lower(p), ', dan')
     and strpos(lower(p), ', dan')  < strpos(lower(p), 'omdat')
$$;

alter table marketing_hq.denkstuk_antwoorden
  drop constraint if exists denkstuk_hypothese_vorm;
alter table marketing_hq.denkstuk_antwoorden
  add constraint denkstuk_hypothese_vorm
  check (vraag <> 4 or marketing_hq.hypothese_heeft_vorm(antwoord));

-- ── 5. De poort aan het eind ───────────────────────────────────────────────
-- Een denkstuk gaat pas op 'bevestigd' als alle zeven vragen een antwoord
-- hebben. 'open' telt als antwoord — dat is een genomen besluit. Leeg niet.
create or replace function marketing_hq.denkstuk_poort()
returns trigger language plpgsql as $$
declare gegeven int; ontbreekt text;
begin
  if new.status <> 'bevestigd' then
    new.updated_at := now();
    return new;
  end if;

  select count(*) into gegeven
  from marketing_hq.denkstuk_antwoorden a
  where a.denkstuk_id = new.id;

  if gegeven < 7 then
    select string_agg(v.vraag || '. ' || v.tekst, ' | ' order by v.vraag) into ontbreekt
    from marketing_hq.denkstuk_vragen v
    where not exists (select 1 from marketing_hq.denkstuk_antwoorden a
                      where a.denkstuk_id = new.id and a.vraag = v.vraag);
    raise exception
      'Dit denkstuk kan nog niet afgetekend worden. Onbeantwoord: %', ontbreekt
      using errcode = 'check_violation';
  end if;

  if new.bevestigd_op is null then
    new.bevestigd_op := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists denkstuk_poort_trg on marketing_hq.denkstukken;
create trigger denkstuk_poort_trg
  before insert or update on marketing_hq.denkstukken
  for each row execute function marketing_hq.denkstuk_poort();

-- Een afgetekend denkstuk staat vast. Wie erop terugkomt, zet het werkstuk
-- terug — hij herschrijft niet wat er stond toen er besloten werd.
create or replace function marketing_hq.denkstuk_bevroren()
returns trigger language plpgsql as $$
declare stand text; welk bigint;
begin
  if tg_op = 'DELETE' then welk := old.denkstuk_id; else welk := new.denkstuk_id; end if;

  select d.status into stand
  from marketing_hq.denkstukken d where d.id = welk;

  if stand = 'bevestigd' then
    raise exception
      'Dit denkstuk is afgetekend en daarmee het verslag van een besluit. Stuur het werkstuk terug als het niet meer klopt.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists denkstuk_antwoord_bevroren on marketing_hq.denkstuk_antwoorden;
create trigger denkstuk_antwoord_bevroren
  before insert or update or delete on marketing_hq.denkstuk_antwoorden
  for each row execute function marketing_hq.denkstuk_bevroren();

-- ── 6. "Niet doen" stopt het werkstuk ──────────────────────────────────────
-- Een gestopt denkstuk laat het werkstuk niet halfopen achter. De reden reist
-- mee: over een half jaar is "waarom deden we dit niet" een echte vraag.
create or replace function marketing_hq.denkstuk_stopt_werkstuk()
returns trigger language plpgsql as $$
begin
  if new.status = 'gestopt' and old.status is distinct from 'gestopt' then
    update marketing_hq.werkstukken
       set status = 'gestopt',
           gestopt_reden = 'denkfase gestopt: ' || new.gestopt_reden,
           updated_at = now()
     where id = new.werkstuk_id and status <> 'gestopt';

    update marketing_hq.werkstuk_stappen
       set status = 'niet_vastgelegd',
           waarom = 'denkfase eindigde in niet doen'
     where werkstuk_id = new.werkstuk_id
       and station >= 2
       and status in ('open','bezig');
  end if;
  return new;
end $$;

drop trigger if exists denkstuk_stopt on marketing_hq.denkstukken;
create trigger denkstuk_stopt
  after update on marketing_hq.denkstukken
  for each row execute function marketing_hq.denkstuk_stopt_werkstuk();

-- ── 7. Station ② kan niet af zonder afgetekend denkstuk ────────────────────
-- En station ③ kan niet beginnen zolang ② niet af is. Dat tweede is geen
-- procesafspraak maar de hele reden dat de denkfase bestaat: zonder deze regel
-- kan een handmatig werkstuk de creatie in terwijl niemand heeft opgeschreven
-- wat er getest wordt.
--
-- Zoals in 0022 vuurt dit alleen bij de overgang. Wat in juli al afgerond
-- werd, blijft staan.
create or replace function marketing_hq.stap_vraagt_denkstuk()
returns trigger language plpgsql as $$
declare stand text;
begin
  if new.station = 2
     and new.status = 'klaar'
     and (tg_op = 'INSERT' or old.status is distinct from 'klaar')
  then
    select d.status into stand
    from marketing_hq.denkstukken d where d.werkstuk_id = new.werkstuk_id;

    if stand is null then
      raise exception
        'Werkstuk % heeft geen denkstuk. De briefing is niet af zolang de zeven vragen niet beantwoord zijn.',
        new.werkstuk_id using errcode = 'check_violation';
    elsif stand <> 'bevestigd' then
      raise exception
        'Het denkstuk van werkstuk % is nog niet afgetekend (%). Een mens moet ervoor tekenen voordat dit werkstuk verder mag.',
        new.werkstuk_id, stand using errcode = 'check_violation';
    end if;
  end if;

  if new.station = 3
     and new.status in ('bezig','klaar')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and exists (select 1 from marketing_hq.werkstuk_stappen s
                 where s.werkstuk_id = new.werkstuk_id
                   and s.station = 2
                   and s.status not in ('klaar','niet_vastgelegd'))
  then
    raise exception
      'De creatie van werkstuk % kan niet beginnen: de briefing is nog niet af.',
      new.werkstuk_id using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists stap_denkstuk on marketing_hq.werkstuk_stappen;
create trigger stap_denkstuk
  before insert or update on marketing_hq.werkstuk_stappen
  for each row execute function marketing_hq.stap_vraagt_denkstuk();

-- ── 8. Het denkstuk om te lezen ────────────────────────────────────────────
create or replace view marketing_hq.denkstuk_regels as
select
  d.id                                          as denkstuk_id,
  d.werkstuk_id,
  w.titel                                       as werkstuk,
  v.vraag,
  v.tekst                                       as vraagtekst,
  v.normaal_door,
  a.antwoord,
  a.zekerheid,
  a.bron,
  coalesce(dd.naam, 'nog niemand')              as voorgesteld_door,
  dd.soort                                      as voorgesteld_door_soort,
  a.updated_at,
  -- Er staat altijd iets, ook bij een onbeantwoorde vraag (regel 0.4).
  case
    when a.id is null                then 'nog niet beantwoord'
    when a.zekerheid = 'onderbouwd'  then 'onderbouwd: ' || coalesce(a.bron, '')
    when a.zekerheid = 'aanname'     then 'aanname — dit moet de test uitwijzen'
    when a.zekerheid = 'open'        then 'open — we weten het niet, en dat blijft staan'
    else 'onbekende zekerheid: ' || coalesce(a.zekerheid, 'leeg')
  end                                           as stand
from marketing_hq.denkstukken d
join marketing_hq.werkstukken w on w.id = d.werkstuk_id
cross join marketing_hq.denkstuk_vragen v
left join marketing_hq.denkstuk_antwoorden a
       on a.denkstuk_id = d.id and a.vraag = v.vraag
left join marketing_hq.deelnemers dd
       on dd.id = coalesce(a.door_agent, a.door_mens::text);

comment on view marketing_hq.denkstuk_regels is
  'Alle zeven vragen van elk denkstuk, ook de onbeantwoorde. Een lege regel is informatie.';

-- ── 9. De stand van het denkstuk ───────────────────────────────────────────
-- Hier staat het oordeel over de balans. Het systeem wijst erop en blokkeert
-- niet: of een denkstuk te veel aannames bevat is een oordeel van het team,
-- niet van een constraint.
create or replace view marketing_hq.denkstukken_stand as
with tel as (
  select a.denkstuk_id,
         count(*)                                                 as beantwoord,
         count(*) filter (where a.zekerheid = 'onderbouwd')        as onderbouwd,
         count(*) filter (where a.zekerheid = 'aanname')           as aanname,
         count(*) filter (where a.zekerheid = 'open')              as open_gelaten,
         max(a.updated_at)                                         as laatst
  from marketing_hq.denkstuk_antwoorden a
  group by a.denkstuk_id
)
select
  d.id                                          as denkstuk_id,
  d.werkstuk_id,
  w.titel                                       as werkstuk,
  d.status,
  coalesce(t.beantwoord, 0)                     as beantwoord,
  7 - coalesce(t.beantwoord, 0)                 as ontbreekt,
  coalesce(t.onderbouwd, 0)                     as onderbouwd,
  coalesce(t.aanname, 0)                        as aanname,
  coalesce(t.open_gelaten, 0)                   as open_gelaten,
  tm.full_name                                       as afgetekend_door,
  d.bevestigd_op,
  d.gestopt_reden,
  coalesce(t.laatst, d.created_at)              as laatst_gewerkt,
  round(extract(epoch from (now() - coalesce(t.laatst, d.created_at))) / 3600)::int
                                                as uren_stil,
  -- Wat er nu van dit denkstuk verwacht wordt.
  case d.status
    when 'gestopt'   then 'niet doen: ' || coalesce(d.gestopt_reden, 'reden niet vastgelegd')
    when 'bevestigd' then 'afgetekend door ' || coalesce(tm.full_name, 'onbekend')
    when 'bezig'     then case
                            when coalesce(t.beantwoord, 0) < 7
                              then 'nog ' || (7 - coalesce(t.beantwoord, 0)) || ' van de 7 vragen te gaan'
                            else 'compleet — wacht op een mens om af te tekenen'
                          end
    else 'onbekende status: ' || coalesce(d.status, 'leeg')
  end                                           as stand,
  -- Het oordeel over de balans. Altijd gevuld, ook als er niets aan de hand is.
  case
    when coalesce(t.beantwoord, 0) < 7                then 'nog te vroeg voor een oordeel'
    when coalesce(t.aanname, 0) = 0
     and coalesce(t.open_gelaten, 0) = 0              then 'alles onderbouwd — dan test dit werkstuk niets nieuws'
    when coalesce(t.onderbouwd, 0) = 0                then 'alles aanname of open — dan test dit alles tegelijk en leer je niets'
    else 'in balans: ' || coalesce(t.onderbouwd, 0) || ' onderbouwd, '
         || coalesce(t.aanname, 0) || ' aanname, ' || coalesce(t.open_gelaten, 0) || ' open'
  end                                           as balans
from marketing_hq.denkstukken d
join marketing_hq.werkstukken w on w.id = d.werkstuk_id
left join tel t on t.denkstuk_id = d.id
left join public.team_members tm on tm.id = d.bevestigd_door;

comment on view marketing_hq.denkstukken_stand is
  'Per denkstuk: hoe ver, hoe zeker, en wat er nu moet gebeuren.';

-- ── 10. Toegang ────────────────────────────────────────────────────────────
alter table marketing_hq.denkstukken          enable row level security;
alter table marketing_hq.denkstuk_antwoorden  enable row level security;
alter table marketing_hq.denkstuk_vragen      enable row level security;

do $$ begin
  create policy denkstukken_lezen on marketing_hq.denkstukken
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy denkstuk_antwoorden_lezen on marketing_hq.denkstuk_antwoorden
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy denkstuk_vragen_lezen on marketing_hq.denkstuk_vragen
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

grant select on marketing_hq.denkstukken         to authenticated;
grant select on marketing_hq.denkstuk_antwoorden to authenticated;
grant select on marketing_hq.denkstuk_vragen     to authenticated;

alter view marketing_hq.denkstuk_regels     set (security_invoker = true);
alter view marketing_hq.denkstukken_stand   set (security_invoker = true);
grant select on marketing_hq.denkstuk_regels   to authenticated;
grant select on marketing_hq.denkstukken_stand to authenticated;

create or replace view public.hq_denkstukken with (security_invoker = true)
  as select * from marketing_hq.denkstukken_stand;
create or replace view public.hq_denkstuk_regels with (security_invoker = true)
  as select * from marketing_hq.denkstuk_regels;
revoke all on public.hq_denkstukken, public.hq_denkstuk_regels from anon, public;
grant select on public.hq_denkstukken, public.hq_denkstuk_regels to authenticated;

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
-- Geen blokkade op een denkstuk dat overal 'aanname' zegt. Dat is een oordeel
-- over de inhoud van het denken, en dat hoort bij het team te liggen. De view
-- zegt het hardop; verder niets.
--
-- Geen versiegeschiedenis van antwoorden. Een afgetekend denkstuk is bevroren
-- (§5) en dat is voldoende: wie er anders over denkt, stuurt het werkstuk
-- terug — dat mechanisme komt in ④.
--
-- Geen automatisch ingevulde velden. Nova mag alle zeven vragen beantwoorden,
-- maar dan staat Nova erbij als voorsteller. Een veld dat "het systeem" heeft
-- ingevuld bestaat niet.
-- ═══════════════════════════════════════════════════════════════════════════
