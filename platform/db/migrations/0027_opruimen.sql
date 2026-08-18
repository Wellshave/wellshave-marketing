-- ═══════════════════════════════════════════════════════════════════════════
-- 0027 — Fase 0: opruimen, en de rest bij naam noemen
--
-- Uit docs/BATCHES.md §2. Batch 1 begint anders met een vervuild dossier, en
-- 0025 rekent netjes door wat erin zit — ook de rommel.
--
-- Twee soorten werk, en het verschil ertussen is het hele punt van deze
-- migratie:
--
--   Wat af te leiden is, wordt hier opgelost. Drie creatives zijn byte voor
--   byte gelijk aan een oudere; dat is geen oordeel maar een vergelijking.
--
--   Wat niet af te leiden is, wordt hier zichtbaar gemaakt en niet ingevuld.
--   Zes creatives hebben geen `angle_type`, en die is nergens uit op te maken —
--   niet uit de naam, niet uit het werkstuk (dat er zelf ook geen heeft). Er
--   staat straks dus geen verzonnen hoek in de database, maar een view die zegt
--   welke er ontbreken. Een gat dat zichzelf noemt, zelfde keuze als in 0025.
--
-- Wat hier níét gebeurt is stilzwijgend weggooien. De drie duplicaten gaan naar
-- een archief met de reden erbij voordat ze uit `creatives` verdwijnen. Rijen
-- laten verdampen die iemand gisteren nog in zijn console zag, is precies het
-- soort verrassing waar dit systeem niet van moet houden.
--
-- Additief op alles behalve `public.creatives`, waar drie rijen verhuizen.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Waar opgeruimd werk heen gaat ───────────────────────────────────────
create table if not exists marketing_hq.opgeruimd (
  id            bigint generated always as identity primary key,
  herkomst      text        not null,          -- welke tabel
  herkomst_id   bigint      not null,          -- welke rij
  reden         text        not null check (length(trim(reden)) > 0),
  rij           jsonb       not null,          -- de hele rij, zoals hij was
  door          text        not null default 'migratie 0027',
  created_at    timestamptz not null default now(),
  unique (herkomst, herkomst_id)
);

comment on table marketing_hq.opgeruimd is
  'Wat er is weggehaald, met de reden en de hele rij erbij. Opruimen zonder spoor is niet opruimen maar kwijtraken.';

alter table marketing_hq.opgeruimd enable row level security;
do $$ begin
  create policy opgeruimd_lezen on marketing_hq.opgeruimd
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;
grant select on marketing_hq.opgeruimd to authenticated;

-- ── 2. De duplicaten ───────────────────────────────────────────────────────
-- Alleen wat byte voor byte gelijk is aan een oudere rij. Niet 'lijkt erg op':
-- twee varianten met dezelfde kop zijn juist wat een batch hoort te bevatten,
-- en die mogen hier niet sneuvelen.
--
-- En alleen wat nooit iets heeft gedaan. Een advertentie die gepubliceerd of
-- gemeten is, is geen duplicaat meer maar geschiedenis — ook als hij ooit als
-- kopie begon.
with dubbel as (
  select c.id, c.ad_name, ouder.id as origineel
  from public.creatives c
  join public.creatives ouder
    on ouder.id < c.id
   and ouder.brand           is not distinct from c.brand
   and ouder.ad_name         is not distinct from c.ad_name
   and ouder.product         is not distinct from c.product
   and ouder.persona         is not distinct from c.persona
   and ouder.angle_type      is not distinct from c.angle_type
   and ouder.marketing_angle is not distinct from c.marketing_angle
   and ouder.format          is not distinct from c.format
   and ouder.hook_short      is not distinct from c.hook_short
   and ouder.image_b64       is not distinct from c.image_b64
   and ouder.script          is not distinct from c.script
   and ouder.werkstuk_id     is not distinct from c.werkstuk_id
  where c.status = 'To Test'
    and c.roas is null and c.impressions is null and c.conversions is null
    and not exists (select 1 from marketing_hq.meta_publications p where p.creative_id = c.id)
)
insert into marketing_hq.opgeruimd (herkomst, herkomst_id, reden, rij)
select 'public.creatives', d.id,
       'byte voor byte gelijk aan creative ' || d.origineel
         || ', nooit gepubliceerd en nooit gemeten',
       to_jsonb(c) - 'image_b64'      -- het beeld staat in het origineel
from dubbel d join public.creatives c on c.id = d.id
on conflict (herkomst, herkomst_id) do nothing;

delete from public.creatives c
where exists (
  select 1 from marketing_hq.opgeruimd o
  where o.herkomst = 'public.creatives' and o.herkomst_id = c.id
);

-- ── 3. Wat wél af te leiden was ────────────────────────────────────────────
-- 'Static' en 'static' zijn hetzelfde format met twee schrijfwijzen, en elke
-- groepering die erop leunt telt ze apart. Dit is de enige vulling in deze
-- migratie waar geen oordeel bij komt kijken.
update public.creatives
   set media_type = lower(trim(media_type))
 where media_type is not null
   and media_type <> lower(trim(media_type));

-- ── 4. Wat een creative nog mist ───────────────────────────────────────────
-- Niet invullen maar opnoemen. Elk ontbrekend deel met de reden waarom het
-- ertoe doet, want 'veld leeg' zegt niet waarom dat erg is.
create or replace view marketing_hq.creatie_gereed as
select
  c.id,
  c.ad_name,
  c.werkstuk_id,
  c.product,
  c.persona,
  c.angle_type,
  c.format,
  c.status,
  nullif(concat_ws('; ',
    case when c.werkstuk_id is null
      then 'hangt aan geen enkel werkstuk — staat buiten de keten' end,
    case when c.angle_type is null
      then 'geen hoek — valt buiten angle_learnings en leert dus niets, ook niet als hij goed draait' end,
    case when c.persona is null
      then 'geen persona — het dossier van ② kan er niets mee vergelijken' end,
    case when c.format is null
      then 'geen format — het dossier van ③ kan er geen patroon uit halen' end,
    case when not coalesce(c.has_image, false) and c.image_b64 is null
      then 'geen beeld' end
  ), '')                                                as ontbreekt,
  (c.werkstuk_id is not null
   and c.angle_type is not null
   and c.persona is not null
   and c.format is not null
   and (coalesce(c.has_image, false) or c.image_b64 is not null))  as gereed
from public.creatives c;

comment on view marketing_hq.creatie_gereed is
  'Wat er per creative nog ontbreekt voordat hij live kan, met de reden waarom het ertoe doet.';

-- ── 5. Hoe ver een batch is ────────────────────────────────────────────────
-- Tegen de drempel uit BATCHES.md §1, die zelf uit 0008 komt: onder drie
-- advertenties op één hoek bij één persona zet `betrouwbaar` op false, en dan
-- levert de hele batch een 'aanname' op. Dat is geen streefgetal maar de
-- ondergrens waaronder testen niets uitwijst.
create or replace view marketing_hq.batch_stand as
select
  w.id                                              as werkstuk_id,
  w.titel                                           as werkstuk,
  w.persona,
  w.angle_type,
  count(c.id)                                       as creatives,
  count(c.id) filter (where g.gereed)               as gereed,
  case
    when count(c.id) = 0
      then 'geen creatives — hier valt nog niets te lanceren'
    when count(c.id) filter (where g.gereed) >= 3
      then count(c.id) filter (where g.gereed) || ' gereed — genoeg voor een batch die iets kan uitwijzen'
    else count(c.id) filter (where g.gereed) || ' van de ' || count(c.id)
         || ' gereed, en er zijn er drie nodig: onder drie zet angle_learnings ''betrouwbaar'' op false '
         || 'en levert de hele batch een aanname op'
  end                                               as stand
from marketing_hq.werkstukken w
left join public.creatives c          on c.werkstuk_id = w.id
left join marketing_hq.creatie_gereed g on g.id = c.id
where w.status = 'loopt'
group by w.id, w.titel, w.persona, w.angle_type;

comment on view marketing_hq.batch_stand is
  'Per lopend werkstuk: hoeveel creatives er klaar zijn tegenover de drie die een uitspraak vragen.';

-- ── 6. Wat er klem staat ───────────────────────────────────────────────────
-- Drie werkstukken hebben station ③ op 'klaar' zonder overdracht. Dat kon
-- omdat 0022 alleen op de overgang vuurt: ze stonden al zo. Nieuw werk kan er
-- niet meer in belanden, maar wat er staat gaat niet vanzelf weg — en een
-- werkstuk dat nergens op wacht en toch niet vooruit kan, is precies het soort
-- stilte waar niemand van wakker wordt.
create or replace view marketing_hq.werkstuk_klem as
select
  s.werkstuk_id,
  w.titel                                           as werkstuk,
  s.station,
  stn.naam                                          as station_naam,
  s.afgerond_op,
  'station ' || s.station || ' staat op klaar, maar er is niets doorgegeven — '
    || 'de volgende stap weet niet wat hij moet controleren'  as waarom,
  'schrijf de overdracht alsnog, of stop het werkstuk met een reden' as wat_nu
from marketing_hq.werkstuk_stappen s
join marketing_hq.werkstukken w         on w.id = s.werkstuk_id
join marketing_hq.werkstuk_stations stn on stn.station = s.station
where s.status = 'klaar'
  and s.station < 6
  and w.status = 'loopt'
  and not exists (
    select 1 from marketing_hq.werkstuk_overdrachten o
    where o.werkstuk_id = s.werkstuk_id and o.van_station = s.station
  );

comment on view marketing_hq.werkstuk_klem is
  'Stappen die op klaar staan zonder overdracht. Sinds 0022 niet meer te maken, maar wat er stond staat er nog.';

-- ── 7. Toegang ─────────────────────────────────────────────────────────────
alter view marketing_hq.creatie_gereed set (security_invoker = true);
alter view marketing_hq.batch_stand    set (security_invoker = true);
alter view marketing_hq.werkstuk_klem  set (security_invoker = true);
grant select on marketing_hq.creatie_gereed, marketing_hq.batch_stand,
                marketing_hq.werkstuk_klem to authenticated;

create or replace view public.hq_creatie_gereed with (security_invoker = true)
  as select * from marketing_hq.creatie_gereed;
create or replace view public.hq_batch_stand with (security_invoker = true)
  as select * from marketing_hq.batch_stand;
revoke all on public.hq_creatie_gereed, public.hq_batch_stand from anon, public;
grant select on public.hq_creatie_gereed, public.hq_batch_stand to authenticated;

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
-- Geen ingevulde `angle_type`. Zes creatives missen er een, en hij is nergens
-- uit af te leiden: niet uit de advertentienaam, en niet uit het werkstuk, dat
-- er zelf ook geen heeft. Een hoek verzinnen die achteraf klopt met de uitkomst
-- is de ene fout die dit hele systeem probeert te voorkomen. Ze staan nu in
-- `creatie_gereed` met de reden erbij, en wie ze invult doet dat met zijn naam
-- eronder.
--
-- Geen besluit over de klemzittende werkstukken. Doorzetten of stoppen is een
-- keuze over werk, en die hoort niet in een migratie thuis. `werkstuk_klem`
-- legt ze op tafel; §4 van BATCHES.md vraagt er een oordeel over.
--
-- Geen unieke index op creatives om nieuwe duplicaten te weren. De twee
-- kopieën ontstonden vier dagen na elkaar met identieke inhoud — dat wijst op
-- een knop die twee keer is ingedrukt, niet op een ontbrekende constraint. Een
-- index hierop zou ook echte varianten blokkeren zodra iemand twee keer
-- dezelfde kop test, en dat is juist geldig werk.
--
-- ── Terugdraaien ───────────────────────────────────────────────────────────
-- De drie creatives staan met hun hele rij in marketing_hq.opgeruimd:
--   insert into public.creatives (…) select … from marketing_hq.opgeruimd
--     where herkomst = 'public.creatives';
--   (het beeld hangt aan het origineel; deze kopieën hadden er geen eigen)
-- drop view if exists public.hq_batch_stand, public.hq_creatie_gereed;
-- drop view if exists marketing_hq.werkstuk_klem, marketing_hq.batch_stand,
--                     marketing_hq.creatie_gereed;
-- ═══════════════════════════════════════════════════════════════════════════
