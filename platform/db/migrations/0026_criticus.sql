-- ═══════════════════════════════════════════════════════════════════════════
-- 0026 — De Criticus
--
-- Stap ⑥ en de laatste open post uit het raamwerk (docs/WERKBANK.md §3).
--
-- Elke agent controleert zijn voorganger; dat is sinds 0022 de vorm van de
-- overdracht en het werkt overal. Behalve op één plek. Tussen creatie en
-- lancering heeft niemand er belang bij om nee te zeggen: Pixel en Quill hebben
-- het gemaakt, en Bolt wil testen. Daar is een partij nodig die alleen kan
-- afkeuren en niets te winnen heeft bij doorgaan.
--
-- De Criticus is dus geen tiende schakel die overal tussen komt. Hij is de
-- eigenaar van precies één overdracht: die van ③ creatie naar ④ lancering.
-- Overal elders blijft de controle een eigenschap van de overdracht zelf.
--
-- ── Wat hier wordt afgedwongen ─────────────────────────────────────────────
--
-- Eén: een overdracht uit ③ kan niet aangenomen worden zonder oordeel. Zonder
-- die grendel is de Criticus een advies, en een advies wordt overgeslagen
-- precies wanneer het druk is — hetzelfde argument als bij de overdracht zelf.
--
-- Twee: 'niet door' sluit aannemen uit. Een afkeuring die je naast je neer kunt
-- leggen is geen afkeuring maar een kanttekening.
--
-- Drie: wie het gemaakt heeft, keurt het niet goed. Dat is de enige vorm van
-- onpartijdigheid die een database kan afdwingen — 'geen belang bij doorgaan'
-- is geen kolom. Wat wél kan: de maker uitsluiten, en het oordeel apart
-- opschrijven zodat het terug te lezen is.
--
-- Additief. Leest uit 0022 en 0025; verandert daar niets aan.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De tiende agent ─────────────────────────────────────────────────────
-- Nog niet operationeel: er draait geen runtime voor hem. Tot die er is velt
-- een mens het oordeel — zie de keuze hieronder bij `door_mens`.
insert into marketing_hq.agents (id, name, role, phase, operationeel, levert, rapporteert_in)
values ('criticus', 'De Criticus', 'Kwaliteitsbewaking', 2, false,
        'één oordeel per overdracht uit ③: door of niet door, met de reden erbij',
        'criticus_oordelen')
on conflict (id) do nothing;

-- ── 2. Het oordeel ─────────────────────────────────────────────────────────
create table if not exists marketing_hq.criticus_oordelen (
  id            bigint generated always as identity primary key,

  -- Aan de overdracht en niet aan het werkstuk. Een oordeel gaat over wat er
  -- op dat moment werd doorgegeven; verandert het werk, dan komt er een nieuwe
  -- overdracht en dus een nieuw oordeel. Eén per overdracht: een tweede
  -- oordeel over hetzelfde stuk werk is een herziening, en die hoort niet
  -- stilzwijgend naast de eerste te komen staan.
  overdracht_id bigint      not null unique
                references marketing_hq.werkstuk_overdrachten(id) on delete cascade,

  -- Twee uitkomsten. Er is geen derde: 'met opmerkingen' is doorlaten met een
  -- schuldgevoel, en dat leest de ontvanger als doorlaten.
  oordeel       text        not null check (oordeel in ('door','niet door')),

  -- Ook bij 'door'. Een goedkeuring zonder reden is een stempel, en een stempel
  -- is niet na te lopen als achteraf blijkt dat het werk niet deugde.
  reden         text        not null check (length(trim(reden)) > 0),

  -- Precies één, zelfde patroon als 0021, 0022 en 0023. De Criticus of een
  -- mens — geen andere agent, want dan keurt de maker zijn eigen werk goed.
  -- Dat een mens het mag doen is met opzet: de grens verlegt en blokkeert niet
  -- (zelfde keuze als de grens van twee in 0024). Ligt de Criticus stil, dan
  -- staat het werk niet vast; wat niet kan, is dat Pixel, Quill of Bolt tekent.
  door_agent    text        references marketing_hq.agents(id)
                check (door_agent is null or door_agent = 'criticus'),
  door_mens     uuid        references public.team_members(id),
  check ((door_agent is null) <> (door_mens is null)),

  created_at    timestamptz not null default now()
);

comment on table marketing_hq.criticus_oordelen is
  'Het oordeel over de overdracht van creatie naar lancering. Door of niet door, met de reden — en niets ertussenin.';
comment on column marketing_hq.criticus_oordelen.reden is
  'Ook verplicht bij ''door''. Een goedkeuring zonder reden is niet na te lopen als het werk later niet blijkt te deugen.';
comment on column marketing_hq.criticus_oordelen.door_agent is
  'Alleen de Criticus. Een andere agent die hier tekent, keurt zijn eigen werk goed.';

create index if not exists criticus_oordelen_overdracht_idx
  on marketing_hq.criticus_oordelen (overdracht_id);

-- ── 3. Waar hij over gaat, en waar niet ────────────────────────────────────
-- Een oordeel op een andere overdracht dan die uit ③ is betekenisloos: daar
-- controleert de ontvanger al, en een tweede keurmeester maakt van de Criticus
-- alsnog een schakel die overal tussen komt.
--
-- En de maker tekent niet voor zijn eigen werk. Bij een agent kan dat al niet
-- (alleen 'criticus' mag hier staan), maar een mens die zijn eigen overdracht
-- schreef zou zichzelf wél kunnen goedkeuren, en dat is precies het gat dat §3
-- beschrijft.
create or replace function marketing_hq.oordeel_hoort_hier()
returns trigger language plpgsql as $$
declare o record; welk bigint;
begin
  if tg_op = 'DELETE' then welk := old.overdracht_id; else welk := new.overdracht_id; end if;

  select van_station, van_agent, van_mens, status
    into o
  from marketing_hq.werkstuk_overdrachten
  where id = welk;

  -- Een afgehandelde overdracht ligt vast, en daarmee ook het oordeel erover.
  -- Ook tegen weghalen: een goedkeuring die achteraf verdwijnt laat werk in
  -- productie achter waarvan niemand meer kan zien wie het doorliet.
  if o.status <> 'open' then
    raise exception
      'Deze overdracht is al afgehandeld (%). Stuur het werkstuk terug als het oordeel niet meer klopt.',
      o.status using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if o.van_station <> 3 then
    raise exception
      'De Criticus gaat over de overdracht van ③ creatie naar ④ lancering, niet over die uit station %. Daar controleert de ontvanger zelf.',
      o.van_station using errcode = 'check_violation';
  end if;

  if new.door_mens is not null and new.door_mens = o.van_mens then
    raise exception
      'Wie de overdracht schreef, velt er niet het oordeel over. Laat een ander tekenen.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists oordeel_hoort_hier_trg on marketing_hq.criticus_oordelen;
create trigger oordeel_hoort_hier_trg
  before insert or update or delete on marketing_hq.criticus_oordelen
  for each row execute function marketing_hq.oordeel_hoort_hier();

-- ── 4. De grendel ──────────────────────────────────────────────────────────
-- Dit is waar de migratie om draait. Zonder deze trigger is de Criticus een
-- goed voornemen, en een goed voornemen wordt overgeslagen precies wanneer er
-- haast is — hetzelfde argument als bij `stap_vraagt_overdracht` in 0022.
--
-- Hij vuurt alleen bij de overgang náár 'aangenomen'. Overdrachten die al
-- aangenomen zijn blijven staan zoals ze zijn: werk dat allang gelanceerd is
-- terugwerkend afkeuren breekt de estafette voor niets.
--
-- Terugsturen en escaleren blijven vrij. De Criticus houdt tegen, hij houdt
-- niet vast: een werkstuk dat niet vooruit mag moet wél terug kunnen, anders
-- wordt de grendel omzeild in plaats van gerespecteerd.
create or replace function marketing_hq.overdracht_vraagt_oordeel()
returns trigger language plpgsql as $$
declare oordeel record;
begin
  if new.status = 'aangenomen'
     and (tg_op = 'INSERT' or old.status is distinct from 'aangenomen')
     and new.van_station = 3
  then
    select o.oordeel, o.reden into oordeel
    from marketing_hq.criticus_oordelen o
    where o.overdracht_id = new.id;

    if oordeel is null then
      raise exception
        'Deze overdracht gaat van creatie naar lancering en kan niet aangenomen worden zonder het oordeel van de Criticus.'
        using errcode = 'check_violation';
    end if;

    if oordeel.oordeel = 'niet door' then
      raise exception
        'De Criticus keurde dit af: %. Stuur het werkstuk terug — aannemen kan niet.',
        oordeel.reden using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists overdracht_oordeel on marketing_hq.werkstuk_overdrachten;
create trigger overdracht_oordeel
  before insert or update on marketing_hq.werkstuk_overdrachten
  for each row execute function marketing_hq.overdracht_vraagt_oordeel();

-- ── 5. Wat er op zijn bureau ligt ──────────────────────────────────────────
-- Met erbij waar het werk op rust. De Criticus die alleen het werk ziet, kan
-- niet meer dan smaak uitspreken; die het dossier van ③ ernaast heeft, kan
-- zeggen dat een besluit nergens op stoelt. Dat is het verschil tussen
-- afkeuren en zeuren, en het is precies waar 0025 voor gebouwd is.
create or replace view marketing_hq.criticus_werkvoorraad as
select
  o.id                                          as overdracht_id,
  o.werkstuk_id,
  w.titel                                       as werkstuk,
  dv.naam                                       as van,
  o.besluit,
  o.waarom,
  o.controleren,
  o.mens_nodig,
  o.mens_nodig_reden,
  round(extract(epoch from (now() - o.created_at)) / 3600)::int as uren_open,
  coalesce(d.regels, 0)                         as dossierregels,
  coalesce(d.onderbouwd, 0)                     as onderbouwd,
  case
    when coalesce(d.onderbouwd, 0) = 0
      then 'niets in het dossier van ③ is gemeten — dit besluit rust op smaak'
    else d.onderbouwd || ' van de ' || d.regels || ' dossierregels zijn gemeten'
  end                                           as grond,
  k.oordeel,
  k.reden                                       as oordeel_reden,
  case
    when k.oordeel is null then 'wacht op oordeel'
    when k.oordeel = 'door' then 'door: ' || k.reden
    else 'afgekeurd: ' || k.reden
  end                                           as stand
from marketing_hq.werkstuk_overdrachten o
join marketing_hq.werkstukken w on w.id = o.werkstuk_id
left join marketing_hq.deelnemers dv on dv.id = coalesce(o.van_agent, o.van_mens::text)
left join marketing_hq.dossier_per_station d
       on d.werkstuk_id = o.werkstuk_id and d.station = 3
left join marketing_hq.criticus_oordelen k on k.overdracht_id = o.id
where o.van_station = 3 and o.status = 'open';

comment on view marketing_hq.criticus_werkvoorraad is
  'De overdrachten uit ③ die nog op een oordeel wachten, met het dossier van ③ ernaast: waar het werk op rust.';

-- ── 6. Wat hij tegenhield ──────────────────────────────────────────────────
-- Een criticus die alles doorlaat is geen criticus, en dat is niet aan te
-- voelen — dat moet af te lezen zijn. Deze view is dus net zo goed een
-- controle op de Criticus als op het werk.
create or replace view marketing_hq.criticus_staat as
select
  count(*)                                                as oordelen,
  count(*) filter (where oordeel = 'niet door')           as afgekeurd,
  count(*) filter (where oordeel = 'door')                as doorgelaten,
  max(created_at)                                         as laatste,
  case
    when count(*) = 0
      then 'nog geen oordeel geveld'
    when count(*) filter (where oordeel = 'niet door') = 0 and count(*) >= 5
      then count(*) || ' keer geoordeeld en nog nooit iets tegengehouden — een criticus die alles doorlaat is een stempel'
    else count(*) filter (where oordeel = 'niet door') || ' van de ' || count(*) || ' tegengehouden'
  end                                                     as stand
from marketing_hq.criticus_oordelen;

comment on view marketing_hq.criticus_staat is
  'Hoe vaak de Criticus nee zei. Een criticus die alles doorlaat hoort op te vallen.';

-- ── 7. Toegang ─────────────────────────────────────────────────────────────
alter table marketing_hq.criticus_oordelen enable row level security;

do $$ begin
  create policy oordelen_lezen on marketing_hq.criticus_oordelen
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

grant select on marketing_hq.criticus_oordelen to authenticated;

alter view marketing_hq.criticus_werkvoorraad set (security_invoker = true);
alter view marketing_hq.criticus_staat        set (security_invoker = true);
grant select on marketing_hq.criticus_werkvoorraad, marketing_hq.criticus_staat to authenticated;

create or replace view public.hq_criticus_werkvoorraad with (security_invoker = true)
  as select * from marketing_hq.criticus_werkvoorraad;
revoke all on public.hq_criticus_werkvoorraad from anon, public;
grant select on public.hq_criticus_werkvoorraad to authenticated;

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
-- Geen veld voor advies of suggesties. Een criticus die mag meedenken wordt
-- medeauteur, en dan keurt hij bij de volgende ronde zijn eigen inbreng goed.
-- Zijn hele nut zit erin dat hij niets te winnen heeft bij doorgaan; één
-- suggestieveld is genoeg om dat weg te nemen. Wat er moet veranderen zegt de
-- terugzending (0024), en die schrijft de ontvanger.
--
-- Geen derde uitkomst. 'Door met opmerkingen' is doorlaten, en zo wordt het
-- ook gelezen — met als verschil dat er achteraf iemand kan zeggen dat hij het
-- toch had aangekaart.
--
-- Geen Criticus op elke overdracht. Overal elders controleert de ontvanger, en
-- die heeft de context; een tweede keurmeester zou dat verzwakken in plaats van
-- versterken. §3 is daar expliciet in en dit volgt het.
--
-- Geen automatische afkeuring op een leeg dossier. Een werkstuk op een nieuwe
-- hoek heeft niets om op te staan, en dat is geen fout maar het begin. Het
-- staat wel in `criticus_werkvoorraad`, zodat de Criticus het ziet en er iets
-- van moet vinden.
-- ═══════════════════════════════════════════════════════════════════════════
