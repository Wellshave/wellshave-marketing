-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 — Het dossier per station
--
-- Stap ⑤ van het Werkbank-raamwerk (docs/WERKBANK.md §7). Niet: de agent
-- onthoudt. Wel: bij elke stap krijgt hij een dossier voorgelegd, samengesteld
-- uit wat er al gemeten is. Hij zoekt niet zelf — wat relevant is wordt hem
-- aangereikt.
--
-- Dat verschil is de hele migratie. Een agent die zelf mag zoeken vindt wat
-- zijn conclusie steunt; een agent die een dossier krijgt moet zich verhouden
-- tot wat er staat, ook als het hem niet uitkomt.
--
-- Drie regels uit §7, en alle drie zitten ze in de vorm en niet in een
-- werkinstructie:
--
--   Een advies noemt waarop het rust. `waarop` is not null in de view; er is
--   geen regel zonder herkomst. Een aanbeveling zonder verwijzing naar een
--   eerdere test is een mening.
--
--   Kennis draagt zijn eigen betrouwbaarheid. Elke regel heeft een
--   `zekerheid` in dezelfde drie woorden als het denkstuk, afgeleid uit de
--   drempels die er al staan (`betrouwbaar` in 0008, `beoordeelbaar` in 0011
--   en 0013). Een dossierregel is daarmee rechtstreeks over te nemen in een
--   denkstukantwoord, mét zijn zekerheid — en niet als 'onderbouwd' wanneer
--   hij op één advertentie rust.
--
--   Een learning is een besluit, geen notitie. Daarom een tabel met
--   constraints en niet een tekstveld: hij hangt aan het werkstuk én aan de
--   hoek, en hij noemt de hypothese die hij toetste.
--
-- En de lus: wat ⑤ oplevert komt terug in het dossier van ② van het volgende
-- werkstuk met dezelfde hoek. Dat is het verschil tussen een systeem dat
-- advertenties maakt en een systeem dat beter wordt in adverteren.
--
-- Additief. Leest uit 0008, 0011, 0013 en 0023; verandert daar niets aan.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De learning ─────────────────────────────────────────────────────────
create table if not exists marketing_hq.learnings (
  id            bigint generated always as identity primary key,

  -- Aan het werkstuk én aan de hoek (§7). Allebei verplicht: een learning die
  -- alleen aan het werkstuk hangt vindt het volgende werkstuk nooit, en een
  -- die alleen aan de hoek hangt is niet meer terug te voeren op een test.
  werkstuk_id   bigint      not null references marketing_hq.werkstukken(id) on delete cascade,
  brand         text        not null default 'wellshave',
  angle_type    text        not null,
  persona       text        not null,

  wat_we_leerden text       not null check (length(trim(wat_we_leerden)) > 0),

  -- De hypothese die dit toetste, overgeschreven uit het denkstuk op het
  -- moment van vastleggen. Een kopie en geen verwijzing: het denkstuk kan
  -- later teruggestuurd en herschreven worden (0024), en dan hoort deze
  -- learning nog steeds bij wat er tóén beweerd werd.
  hypothese     text        not null check (length(trim(hypothese)) > 0),

  -- Waarop het rust. Zelfde eis als in het denkstuk: 'onderbouwd' zonder bron
  -- is een aanname met een beter woord ervoor.
  zekerheid     text        not null check (zekerheid in ('onderbouwd','aanname','open')),
  waarop        text,
  check (zekerheid <> 'onderbouwd' or (waarop is not null and length(trim(waarop)) > 0)),

  door_agent    text        references marketing_hq.agents(id),
  door_mens     uuid        references public.team_members(id),
  check ((door_agent is null) <> (door_mens is null)),

  created_at    timestamptz not null default now()
);

comment on table marketing_hq.learnings is
  'Wat een test uitwees, vastgelegd aan het werkstuk én aan de hoek. Een learning die alleen in een rapport staat, leest niemand terug.';
comment on column marketing_hq.learnings.hypothese is
  'Overgeschreven uit het denkstuk, niet ernaar verwezen: het denkstuk kan later herschreven worden, deze learning hoort bij wat er toen stond.';

create index if not exists learnings_hoek_idx
  on marketing_hq.learnings (brand, angle_type, persona);

-- Een learning zonder hypothese is een notitie. De hypothese wordt hier uit
-- het denkstuk gehaald en niet door de schrijver meegegeven — anders staat er
-- achteraf een hypothese die past bij de uitkomst.
create or replace function marketing_hq.learning_kent_hypothese()
returns trigger language plpgsql as $$
declare uit_denkstuk text;
begin
  select a.antwoord into uit_denkstuk
  from marketing_hq.denkstuk_antwoorden a
  join marketing_hq.denkstukken d on d.id = a.denkstuk_id
  where d.werkstuk_id = new.werkstuk_id and a.vraag = 4;

  if uit_denkstuk is null then
    raise exception
      'Werkstuk % heeft geen hypothese in zijn denkstuk. Een learning zonder hypothese is een notitie: er valt niet te zeggen wat er is uitgekomen.',
      new.werkstuk_id using errcode = 'check_violation';
  end if;

  new.hypothese := uit_denkstuk;

  -- De hoek komt van het werkstuk als hij niet is meegegeven, zodat een
  -- learning niet per ongeluk aan een andere hoek gaat hangen dan hij toetste.
  if new.angle_type is null or new.persona is null then
    select coalesce(new.angle_type, w.angle_type), coalesce(new.persona, w.persona)
      into new.angle_type, new.persona
    from marketing_hq.werkstukken w where w.id = new.werkstuk_id;
  end if;

  return new;
end $$;

drop trigger if exists learning_hypothese on marketing_hq.learnings;
create trigger learning_hypothese
  before insert on marketing_hq.learnings
  for each row execute function marketing_hq.learning_kent_hypothese();

-- ── 2. Waar een dossierregel op rust ───────────────────────────────────────
-- Eén plek waar de drempels tot woorden worden, zodat ② en ③ hetzelfde
-- bedoelen met 'onderbouwd'. De drempels zelf staan al in 0008, 0011 en 0013
-- en worden hier niet overgedaan — alleen vertaald.
create or replace function marketing_hq.zekerheid_uit(betrouwbaar boolean, n bigint)
returns text language sql immutable as $$
  select case
    when n is null or n = 0 then 'open'
    when betrouwbaar        then 'onderbouwd'
    else 'aanname'
  end
$$;

comment on function marketing_hq.zekerheid_uit(boolean, bigint) is
  'Vertaalt een drempel naar de drie woorden van het denkstuk. Nul waarnemingen is open, niet aanname.';

-- ── 3. Het dossier ─────────────────────────────────────────────────────────
-- Eén rij per feit dat een agent bij deze stap meekrijgt. Geen enkele regel
-- zonder `waarop` en `zekerheid` — dat is regel 1 en 2 van §7, afgedwongen
-- door de vorm in plaats van door een afspraak.
--
-- Ook de gaten staan erin. Een dossier dat zwijgt over reviews leest als een
-- dossier waarin reviews niets zeiden; een regel die zegt dat de bron niet is
-- aangesloten leest als wat het is.
create or replace view marketing_hq.werkstuk_dossier as

-- ② briefing — wat deze hoek eerder deed bij deze persona
select
  w.id                                            as werkstuk_id,
  2                                               as station,
  'hoek eerder getest'                            as onderwerp,
  case
    when al.aantal_ads is null
      then 'Deze hoek is nog niet eerder getest bij deze persona.'
    else 'Deze hoek deed ROAS ' || coalesce(al.roas::text, 'onbekend')
         || ' over ' || al.aantal_ads || ' advertenties'
         || case when al.winnaars > 0 then ', waarvan ' || al.winnaars || ' winnaar' else '' end || '.'
  end                                             as wat,
  case
    when al.aantal_ads is null then 'geen eerdere advertenties met deze hoek en persona'
    else al.aantal_ads || ' advertenties, €' || round(coalesce(al.spend,0)) || ' besteed'
  end                                             as waarop,
  marketing_hq.zekerheid_uit(coalesce(al.betrouwbaar, false), al.aantal_ads) as zekerheid,
  1                                               as volgorde
from marketing_hq.werkstukken w
left join marketing_hq.angle_learnings al
       on al.brand = w.brand and al.angle_type = w.angle_type and al.persona = w.persona

union all

-- ② briefing — welke hoeken uitgeput raken
select
  w.id, 2, 'hoek raakt uitgeput',
  'De hoek ' || u.angle_type || ' draait al ' || u.aantal_ads
    || ' advertenties bij deze persona' ||
    case when u.roas is not null then ' op ROAS ' || u.roas else '' end || '.',
  u.aantal_ads || ' advertenties op dezelfde hoek',
  marketing_hq.zekerheid_uit(u.betrouwbaar, u.aantal_ads),
  2
from marketing_hq.werkstukken w
join marketing_hq.angle_learnings u
  on u.brand = w.brand and u.persona = w.persona and u.aantal_ads >= 6

union all

-- ② briefing — wat eerdere tests op deze hoek uitwezen. Dit is de lus: wat ⑤
-- oplevert komt hier terug bij het volgende werkstuk met dezelfde hoek.
select
  w.id, 2, 'eerder geleerd',
  l.wat_we_leerden || ' (uit werkstuk ' || l.werkstuk_id || ', hypothese: ' || l.hypothese || ')',
  coalesce(l.waarop, 'geen bewijs vastgelegd bij deze learning'),
  l.zekerheid,
  3
from marketing_hq.werkstukken w
join marketing_hq.learnings l
  on l.brand = w.brand and l.angle_type = w.angle_type and l.persona = w.persona
 and l.werkstuk_id <> w.id

union all

-- ② briefing — de bronnen die §7 noemt maar die nog niet bestaan. Een gat dat
-- zichzelf noemt is bruikbaar; een gat dat zwijgt leest als een leeg resultaat.
select
  w.id, 2, 'reviews en klantenservice',
  'Niet beschikbaar: er is geen bron met reviews of klantenservice aangesloten.',
  'geen bron aangesloten — wat hierover in een briefing staat is een aanname',
  'open',
  4
from marketing_hq.werkstukken w

union all

-- ③ creatie — winnaars en verliezers in dit format
--
-- Handmatig ingevulde cijfers tellen mee maar dragen niet: ze staan in de
-- regel, en `gemeten` bepaalt of het 'onderbouwd' mag heten. Ze weglaten zou
-- het dossier over de hele tracker laten zwijgen; ze meetellen als bewijs zou
-- een zelf ingetypt getal gelijkstellen aan een gemeten getal.
select
  w.id, 3, 'format',
  'In het format ' || f.format || ': ' || f.winnaars || ' van ' || f.aantal
    || ' advertenties werd winnaar' ||
    case when f.roas_mediaan is not null then ', mediaan ROAS ' || f.roas_mediaan else '' end || '.',
  f.aantal || ' advertenties in dit format, waarvan ' || f.gemeten
    || ' met cijfers uit Meta',
  marketing_hq.zekerheid_uit(f.gemeten >= 3, f.aantal),
  1
from marketing_hq.werkstukken w
join (
  select c.brand, c.persona, c.format,
         count(*)                                                  as aantal,
         count(*) filter (where coalesce(k.beoordeelbaar, false))  as gemeten,
         count(*) filter (where c.status = 'Winner')               as winnaars,
         percentile_cont(0.5) within group (order by k.roas)::numeric(10,3) as roas_mediaan
  from public.creatives c
  join marketing_hq.creative_kaart k on k.id = c.id
  where c.format is not null
  group by c.brand, c.persona, c.format
) f on f.brand = w.brand and f.persona = w.persona

union all

-- ③ creatie — hook rate en hold rate per opening
select
  w.id, 3, 'opening',
  'De opening "' || h.hook_short || '" haalde hook rate ' || coalesce(h.hook_rate::text,'onbekend')
    || ' en hold rate ' || coalesce(h.hold_rate::text,'onbekend') || '.',
  h.aantal || ' advertenties met deze opening, waarvan ' || h.gemeten
    || ' met cijfers uit Meta',
  marketing_hq.zekerheid_uit(h.gemeten >= 3, h.aantal),
  2
from marketing_hq.werkstukken w
join (
  select c.brand, c.persona, c.hook_short,
         count(*)                                                  as aantal,
         count(*) filter (where coalesce(k.beoordeelbaar, false))  as gemeten,
         round(avg(k.hook_rate), 4)                                as hook_rate,
         round(avg(k.hold_rate), 4)                                as hold_rate
  from public.creatives c
  join marketing_hq.creative_kaart k on k.id = c.id
  where c.hook_short is not null
    and (k.hook_rate is not null or k.hold_rate is not null)
  group by c.brand, c.persona, c.hook_short
) h on h.brand = w.brand and h.persona = w.persona

union all

-- ④ live — de scorekaart en de mediaan van het account
select
  w.id, 4, 'accountmediaan',
  'Account ' || s.account_id || ': mediaan ROAS ' || coalesce(s.roas_mediaan::text,'onbekend')
    || ' over ' || s.soortgenoten || ' beoordeelbare advertenties, '
    || s.draait_nu || ' draaien er nu.',
  s.soortgenoten || ' beoordeelbare advertenties in de laatste 30 dagen',
  -- Onder drie soortgenoten geeft 0011 en 0013 geen oordeel; dan is de
  -- mediaan een getal en geen lat.
  marketing_hq.zekerheid_uit(coalesce(s.soortgenoten, 0) >= 3, s.draait_nu),
  1
from marketing_hq.werkstukken w
join (
  select account_id,
         max(soortgenoten)                                  as soortgenoten,
         max(roas_mediaan)::numeric(10,3)                   as roas_mediaan,
         count(*)                                           as draait_nu
  from marketing_hq.advertentie_scorekaart
  group by account_id
) s on true

union all

-- ⑤ meting — waartegen gemeten wordt. Niet tegen een algemene norm maar tegen
-- de hypothese uit het denkstuk; anders meet je of het goed ging in plaats van
-- of de gedachte klopte.
select
  w.id, 5,
  case a.vraag when 4 then 'de hypothese' else 'wat getest wordt' end,
  a.antwoord,
  case
    when d.status = 'bevestigd' then 'het denkstuk, afgetekend op ' || to_char(d.bevestigd_op, 'DD-MM-YYYY')
    else 'het denkstuk, nog niet afgetekend — dit kan nog veranderen'
  end,
  case when d.status = 'bevestigd' then a.zekerheid else 'open' end,
  case a.vraag when 4 then 1 else 2 end
from marketing_hq.werkstukken w
join marketing_hq.denkstukken d          on d.werkstuk_id = w.id
join marketing_hq.denkstuk_antwoorden a  on a.denkstuk_id = d.id and a.vraag in (4,6);

comment on view marketing_hq.werkstuk_dossier is
  'Wat een agent bij een stap meekrijgt. Elke regel noemt waarop hij rust en hoe zeker hij is — ook de regels die zeggen dat er niets is.';

-- ── 4. Het dossier om te lezen ─────────────────────────────────────────────
-- Met de stationsnaam erbij en een oordeel over het dossier als geheel. Dat
-- laatste is het spiegelbeeld van de balans in 0023: een dossier waarin alles
-- 'open' staat is geen dossier, en dat hoort er te staan.
create or replace view marketing_hq.dossier_per_station as
with tel as (
  select werkstuk_id, station,
         count(*)                                            as regels,
         count(*) filter (where zekerheid = 'onderbouwd')     as onderbouwd,
         count(*) filter (where zekerheid = 'aanname')        as aanname,
         count(*) filter (where zekerheid = 'open')           as open_gelaten
  from marketing_hq.werkstuk_dossier
  group by werkstuk_id, station
)
select
  t.werkstuk_id,
  w.titel                                       as werkstuk,
  t.station,
  stn.naam                                      as station_naam,
  t.regels,
  t.onderbouwd,
  t.aanname,
  t.open_gelaten,
  case
    when t.onderbouwd = 0 and t.aanname = 0
      then 'leeg dossier — deze stap begint zonder dat er iets bekend is'
    when t.onderbouwd = 0
      then 'niets onderbouwd: ' || t.aanname || ' aanname'
           || case when t.aanname = 1 then '' else 's' end
           || ' — wat hier besloten wordt rust op niets gemetens'
    else t.onderbouwd || ' van de ' || t.regels || ' regels zijn onderbouwd'
  end                                           as stand
from tel t
join marketing_hq.werkstukken w        on w.id = t.werkstuk_id
join marketing_hq.werkstuk_stations stn on stn.station = t.station;

comment on view marketing_hq.dossier_per_station is
  'Per station: hoeveel het dossier bevat en hoeveel daarvan gemeten is. Een leeg dossier is een bevinding.';

-- ── 5. De lus ──────────────────────────────────────────────────────────────
-- §7 sluit af met: de lus is pas rond als ⑤ terugkomt bij ②. Deze view maakt
-- dat af te lezen in plaats van te hopen — per hoek: hoeveel werkstukken er
-- langsgingen, hoeveel er iets uit geleerd is, en wat het volgende werkstuk
-- op die hoek meekrijgt.
create or replace view marketing_hq.lus_per_hoek as
select
  w.brand,
  w.angle_type,
  w.persona,
  count(distinct w.id)                                   as werkstukken,
  count(distinct l.id)                                   as learnings,
  count(distinct l.werkstuk_id)                          as werkstukken_met_learning,
  max(l.created_at)                                      as laatst_geleerd,
  case
    when count(distinct l.id) = 0 and count(distinct w.id) = 1
      then 'één werkstuk, nog niets uit geleerd — de lus is nog niet rond'
    when count(distinct l.id) = 0
      then count(distinct w.id) || ' werkstukken op deze hoek en geen enkele learning — hier wordt getest zonder terug te koppelen'
    when count(distinct l.werkstuk_id) < count(distinct w.id)
      then count(distinct l.werkstuk_id) || ' van de ' || count(distinct w.id)
           || ' werkstukken leverden een learning op'
    else 'elk werkstuk op deze hoek leverde een learning op'
  end                                                    as stand
from marketing_hq.werkstukken w
left join marketing_hq.learnings l
       on l.brand = w.brand and l.angle_type = w.angle_type and l.persona = w.persona
where w.angle_type is not null and w.persona is not null
group by w.brand, w.angle_type, w.persona;

comment on view marketing_hq.lus_per_hoek is
  'Of ⑤ terugkomt bij ②. Testen zonder terugkoppelen is hier af te lezen, niet aan te voelen.';

-- ── 6. Toegang ─────────────────────────────────────────────────────────────
alter table marketing_hq.learnings enable row level security;

do $$ begin
  create policy learnings_lezen on marketing_hq.learnings
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

grant select on marketing_hq.learnings to authenticated;

alter view marketing_hq.werkstuk_dossier    set (security_invoker = true);
alter view marketing_hq.dossier_per_station set (security_invoker = true);
alter view marketing_hq.lus_per_hoek        set (security_invoker = true);
grant select on marketing_hq.werkstuk_dossier, marketing_hq.dossier_per_station,
                marketing_hq.lus_per_hoek to authenticated;

create or replace view public.hq_werkstuk_dossier with (security_invoker = true)
  as select * from marketing_hq.werkstuk_dossier;
create or replace view public.hq_lus_per_hoek with (security_invoker = true)
  as select * from marketing_hq.lus_per_hoek;
revoke all on public.hq_werkstuk_dossier, public.hq_lus_per_hoek from anon, public;
grant select on public.hq_werkstuk_dossier, public.hq_lus_per_hoek to authenticated;

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
-- Geen tabel waarin het dossier wordt opgeslagen. Het dossier is een view en
-- geen kopie: een opgeslagen dossier loopt uit de pas met de cijfers waarop
-- het rust, en dan krijgt de agent gisteren voorgelegd als vandaag. Zelfde
-- reden dat 0009 geen `station_nu`-kolom heeft.
--
-- Geen relevantiescore of rangschikking. Wat de agent meekrijgt is alles wat
-- over zijn stap bekend is, op volgorde van soort. Een filter dat kiest wat
-- relevant is, is precies het zoeken dat §7 wil vermijden — dan bepaalt een
-- heuristiek wat de agent niet te zien krijgt.
--
-- Geen blokkade op een leeg dossier. Een stap mag beginnen zonder dat er iets
-- bekend is; dat is bij een nieuwe hoek de normale toestand. Wat er wél
-- gebeurt is dat het dossier het zegt, en dat een agent die daarop een
-- 'onderbouwd' antwoord bouwt door het denkstuk wordt tegengehouden.
-- ═══════════════════════════════════════════════════════════════════════════
