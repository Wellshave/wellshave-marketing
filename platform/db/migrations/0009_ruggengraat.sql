-- ═══════════════════════════════════════════════════════════════════════════
-- 0009 — De ruggengraat van de estafette
--
-- Alle koppelingen in marketing_hq wijzen vandaag naar agents, runs, jobs of
-- approvals. Geen enkele wijst naar een stuk werk. Het model kan beantwoorden
-- welke agent wat deed en wanneer; het kan niet beantwoorden wat er met één
-- idee is gebeurd. Deze migratie voegt dat ontbrekende begrip toe.
--
-- Een WERKSTUK is één idee dat getest wordt: een product, een persona, een
-- hoek. Het reist langs zes stations, van signaal tot oogst, en kan onderweg
-- meerdere creatives opleveren (varianten van dezelfde hypothese).
--
--   ① signaal   Radar          een observatie uit de markt
--   ② briefing  Nova           het idee, testbaar gemaakt
--   ③ creatie   Pixel/Quill    beeld en tekst — vandaag een mens in de wizard
--   ④ live      Bolt           klaarzetten bij Meta, dan een poort
--   ⑤ meting    Atlas          cijfers terug naar de creative
--   ⑥ oogst     Echo/Vector    e-mailcampagne en landingspagina
--
-- Volledig additief. Bestaande tabellen krijgen alleen nullable kolommen; er
-- wordt niets hernoemd, verplaatst of verwijderd. Onderaan staan de drops.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── De keten zelf, als data ────────────────────────────────────────────────
-- De zes stations staan in een tabel en niet in code, zodat de volgorde en de
-- soort overdracht te lezen en te wijzigen zijn zonder deploy — net als de
-- tijden in `schedules`.
create table if not exists marketing_hq.werkstuk_stations (
  station              smallint primary key check (station between 1 and 6),
  naam                 text not null,
  omschrijving         text not null,
  standaard_agent      text references marketing_hq.agents(id),
  standaard_overdracht text not null check (standaard_overdracht in ('vanzelf','poort','mens'))
);

insert into marketing_hq.werkstuk_stations
  (station, naam, omschrijving, standaard_agent, standaard_overdracht)
values
  (1, 'signaal',  'een observatie uit de markt',           'radar', 'vanzelf'),
  (2, 'briefing', 'het idee, testbaar gemaakt',            'nova',  'vanzelf'),
  (3, 'creatie',  'beeld en tekst',                        null,    'mens'),
  (4, 'live',     'klaarzetten bij Meta, dan een poort',   'bolt',  'poort'),
  (5, 'meting',   'cijfers terug naar de creative',        'atlas', 'vanzelf'),
  (6, 'oogst',    'e-mailcampagne en landingspagina',      'echo',  'poort')
on conflict (station) do nothing;

-- Station ③ heeft bewust geen standaard-agent: daar staat vandaag een mens in
-- de wizard, en Pixel en Quill worden zijn gereedschap. Bij ⑥ staat Echo als
-- standaard omdat Vector nog niet draait.

-- ── Het werkstuk ───────────────────────────────────────────────────────────
-- Bewust géén kolom voor "waar staat het nu". Dat is af te leiden uit de
-- stappen, en een opgeslagen kopie loopt vroeg of laat uit de pas met de
-- werkelijkheid. De view onderaan leidt het af.
create table if not exists marketing_hq.werkstukken (
  id            bigint generated always as identity primary key,
  brand         text        not null default 'wellshave',
  titel         text        not null,
  product       text,
  persona       text,
  angle_type    text,
  -- Waarom dit werkstuk bestaat. Bij Radar de observatie, bij een mens zijn
  -- ingeving. Dit is wat de keten later leesbaar maakt.
  aanleiding    text,
  gestart_door  text        not null default 'mens',   -- agent_id of 'mens'
  -- Alleen de levensloop-beslissing. 'klaar' is af te leiden en staat hier
  -- daarom niet: dat is station ⑥ afgerond.
  status        text        not null default 'loopt'
                check (status in ('loopt', 'gestopt')),
  gestopt_reden text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (status <> 'gestopt' or (gestopt_reden is not null and length(trim(gestopt_reden)) > 0))
);

comment on table marketing_hq.werkstukken is
  'Eén idee dat door de estafette reist. Kan meerdere creatives opleveren.';

create index if not exists werkstukken_brand_idx  on marketing_hq.werkstukken (brand, status);
create index if not exists werkstukken_angle_idx  on marketing_hq.werkstukken (brand, persona, angle_type);

-- ── De stappen ─────────────────────────────────────────────────────────────
-- Eén rij per station per werkstuk. Dat maakt de estafette in één query
-- uitleesbaar en voorkomt dat dezelfde stap twee keer bestaat.
create table if not exists marketing_hq.werkstuk_stappen (
  id           bigint generated always as identity primary key,
  werkstuk_id  bigint      not null references marketing_hq.werkstukken(id) on delete cascade,
  station      smallint    not null check (station between 1 and 6),
  agent_id     text        references marketing_hq.agents(id),   -- null = een mens
  status       text        not null default 'open'
               check (status in ('open','bezig','wacht_op_mens','klaar','mislukt','niet_vastgelegd')),
  -- Welke soort overdracht dit is. Zie het ontwerpcontract: 'vanzelf' kost
  -- niets en werkt niet naar buiten, 'poort' wacht op een mens omdat er geld
  -- of een externe actie in het spel is, 'mens' is creatief werk.
  overdracht   text        not null default 'vanzelf'
               check (overdracht in ('vanzelf','poort','mens')),
  -- Regel 3b.2 uit het ontwerpcontract: elke stap legt vast WAAROM hij deed
  -- wat hij deed. Dat is hier een constraint en geen goede voornemen: een
  -- afgeronde stap zonder toelichting wordt geweigerd.
  waarom       text,
  run_id       bigint      references marketing_hq.agent_runs(id) on delete set null,
  approval_id  bigint      references marketing_hq.approvals(id)  on delete set null,
  begonnen_op  timestamptz,
  afgerond_op  timestamptz,
  created_at   timestamptz not null default now(),
  unique (werkstuk_id, station),
  check (status <> 'klaar' or (waarom is not null and length(trim(waarom)) > 0))
);

comment on column marketing_hq.werkstuk_stappen.waarom is
  'Verplicht zodra de stap klaar is. Zonder dit is de keten een reeks tijdstempels.';

create index if not exists werkstuk_stappen_werkstuk_idx on marketing_hq.werkstuk_stappen (werkstuk_id, station);
create index if not exists werkstuk_stappen_open_idx     on marketing_hq.werkstuk_stappen (status)
  where status in ('bezig','wacht_op_mens','mislukt');

-- Een werkstuk krijgt bij aanmaak meteen zijn zes stations, allemaal 'open'.
-- Dat is geen gemak maar een eis uit het ontwerpcontract: de volledige keten
-- is altijd zichtbaar, ook het deel dat nog moet gebeuren. Een lege stap laat
-- zien waar het vastloopt. Als de aanroeper dit zelf moest doen, zou hij het
-- vroeg of laat vergeten en dan mist de keten stilzwijgend zijn staart.
create or replace function marketing_hq.werkstuk_stations_aanmaken()
returns trigger language plpgsql security definer
set search_path = marketing_hq, public as $$
begin
  insert into marketing_hq.werkstuk_stappen
    (werkstuk_id, station, agent_id, status, overdracht)
  select new.id, st.station, st.standaard_agent, 'open', st.standaard_overdracht
  from marketing_hq.werkstuk_stations st
  on conflict (werkstuk_id, station) do nothing;
  return new;
end $$;

drop trigger if exists werkstuk_stations_trg on marketing_hq.werkstukken;
create trigger werkstuk_stations_trg
  after insert on marketing_hq.werkstukken
  for each row execute function marketing_hq.werkstuk_stations_aanmaken();

-- ── De verwijzingen vanuit wat er al is ────────────────────────────────────
-- Allemaal nullable: bestaande rijen en bestaande code merken hier niets van.
alter table public.creatives                  add column if not exists werkstuk_id bigint;
alter table marketing_hq.reports              add column if not exists werkstuk_id bigint;
alter table marketing_hq.pipeline_items       add column if not exists werkstuk_id bigint;
alter table marketing_hq.email_drafts         add column if not exists werkstuk_id bigint;
alter table marketing_hq.meta_publications    add column if not exists werkstuk_id bigint;
alter table marketing_hq.agent_messages       add column if not exists werkstuk_id bigint;
alter table marketing_hq.approvals            add column if not exists werkstuk_id bigint;

-- meta_recommendations krijgt er bewust géén: die heeft al creative_id, en
-- via de creative is het werkstuk te vinden. Een tweede pad naar hetzelfde
-- antwoord is een tweede plek waar het fout kan gaan.

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('marketing_hq','reports'),          ('marketing_hq','pipeline_items'),
      ('marketing_hq','email_drafts'),     ('marketing_hq','meta_publications'),
      ('marketing_hq','agent_messages'),   ('marketing_hq','approvals'),
      ('public','creatives')
    ) as v(sch, tab)
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = t.tab || '_werkstuk_fk'
        and conrelid = (t.sch || '.' || t.tab)::regclass
    ) then
      execute format(
        'alter table %I.%I add constraint %I foreign key (werkstuk_id)
           references marketing_hq.werkstukken(id) on delete set null',
        t.sch, t.tab, t.tab || '_werkstuk_fk');
    end if;
  end loop;
end $$;

create index if not exists creatives_werkstuk_idx on public.creatives (werkstuk_id);

-- ── Een stap zetten ────────────────────────────────────────────────────────
-- De runtime hoeft de regels niet te kennen: die staan hier. Upsert per
-- station, zodat 'bezig' later 'klaar' wordt zonder dubbele rij.
create or replace function marketing_hq.werkstuk_stap(
  p_werkstuk   bigint,
  p_station    smallint,
  p_status     text,
  p_waarom     text    default null,
  p_agent      text    default null,
  p_overdracht text    default 'vanzelf',
  p_run        bigint  default null,
  p_approval   bigint  default null
) returns marketing_hq.werkstuk_stappen
language plpgsql
security definer
set search_path = marketing_hq, public
as $$
declare
  r marketing_hq.werkstuk_stappen;
begin
  insert into marketing_hq.werkstuk_stappen
    (werkstuk_id, station, agent_id, status, overdracht, waarom, run_id, approval_id,
     begonnen_op, afgerond_op)
  values
    (p_werkstuk, p_station, p_agent, p_status, p_overdracht, p_waarom, p_run, p_approval,
     case when p_status in ('bezig','klaar') then now() end,
     case when p_status = 'klaar'            then now() end)
  on conflict (werkstuk_id, station) do update set
    agent_id    = coalesce(excluded.agent_id,    werkstuk_stappen.agent_id),
    status      = excluded.status,
    overdracht  = excluded.overdracht,
    waarom      = coalesce(excluded.waarom,      werkstuk_stappen.waarom),
    run_id      = coalesce(excluded.run_id,      werkstuk_stappen.run_id),
    approval_id = coalesce(excluded.approval_id, werkstuk_stappen.approval_id),
    begonnen_op = coalesce(werkstuk_stappen.begonnen_op,
                           case when excluded.status in ('bezig','klaar') then now() end),
    afgerond_op = case when excluded.status = 'klaar'
                       then coalesce(werkstuk_stappen.afgerond_op, now()) end
  returning * into r;

  update marketing_hq.werkstukken set updated_at = now() where id = p_werkstuk;
  return r;
end $$;

revoke all on function marketing_hq.werkstuk_stap(bigint, smallint, text, text, text, text, bigint, bigint)
  from public, anon, authenticated;

-- ── De estafette, in één query uitleesbaar ─────────────────────────────────
-- Dit is wat de console leest om een werkstuk te tonen. Positie en voortgang
-- worden hier afgeleid, niet bewaard.
create or replace view marketing_hq.werkstuk_estafette as
with stappen as (
  select
    w.id,
    count(*) filter (where s.status = 'klaar')                             as stappen_af,
    -- Waar het nu ligt: het eerste station dat niet af is. Ook een station dat
    -- nog niet begonnen is telt mee — daar ligt het werk immers stil. Alleen
    -- filteren op 'bezig' laat een vastgelopen keten zonder positie achter.
    min(s.station) filter (
      where s.status in ('open','bezig','wacht_op_mens','mislukt')
    )                                                                      as station_nu,
    bool_or(s.status = 'wacht_op_mens')                                    as wacht_op_mens,
    bool_or(s.status = 'mislukt')                                          as heeft_fout,
    -- De hele keten in één veld, op volgorde. Dit is precies wat de estafette
    -- op het scherm tekent, inclusief de stations die nog moeten gebeuren.
    jsonb_agg(jsonb_build_object(
      'station',    s.station,
      'naam',       stn.naam,
      'agent',      s.agent_id,
      'status',     s.status,
      'overdracht', s.overdracht,
      'waarom',     s.waarom,
      'afgerond',   s.afgerond_op
    ) order by s.station)                                                  as stappen
  from marketing_hq.werkstukken w
  left join marketing_hq.werkstuk_stappen s   on s.werkstuk_id = w.id
  left join marketing_hq.werkstuk_stations stn on stn.station = s.station
  group by w.id
),
cijfers as (
  -- Optellen over alle creatives van het werkstuk: eerst de tellers, dan pas
  -- delen. Zelfde regel als in 0008.
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
  -- afgeleide toestand, zodat er geen tweede waarheid ontstaat
  case
    when w.status = 'gestopt'        then 'gestopt'
    when coalesce(st.stappen_af,0) >= 6 then 'klaar'
    when st.heeft_fout               then 'vastgelopen'
    when st.wacht_op_mens            then 'wacht_op_mens'
    else 'loopt'
  end                                                         as toestand,
  st.stappen,
  coalesce(cf.aantal_ads, 0)                                  as aantal_ads,
  cf.spend, cf.omzet, cf.roas, coalesce(cf.winnaars, 0)       as winnaars,
  w.created_at, w.updated_at
from marketing_hq.werkstukken w
left join stappen st on st.id = w.id
left join cijfers cf on cf.werkstuk_id = w.id;

-- ── Toegang ────────────────────────────────────────────────────────────────
alter table marketing_hq.werkstukken      enable row level security;
alter table marketing_hq.werkstuk_stappen enable row level security;
grant select on marketing_hq.werkstukken, marketing_hq.werkstuk_stappen to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='marketing_hq'
                   and tablename='werkstukken' and policyname='team_read_werkstukken') then
    create policy team_read_werkstukken on marketing_hq.werkstukken
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
  if not exists (select 1 from pg_policies where schemaname='marketing_hq'
                   and tablename='werkstuk_stappen' and policyname='team_read_werkstuk_stappen') then
    create policy team_read_werkstuk_stappen on marketing_hq.werkstuk_stappen
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
end $$;

create or replace view public.hq_werkstukken with (security_invoker = true)
  as select * from marketing_hq.werkstuk_estafette;

revoke all on public.hq_werkstukken from anon, public;
grant select on public.hq_werkstukken to authenticated;

-- ── Wat er al was, een werkstuk geven ──────────────────────────────────────
-- De negen bestaande creatives zijn gemaakt vóór dit begrip bestond. Ze worden
-- gegroepeerd op product + persona + hoek, want varianten van dezelfde
-- hypothese horen bij hetzelfde werkstuk.
--
-- Station ① en ② krijgen bewust status 'niet_vastgelegd' in plaats van
-- 'klaar'. Er ís geen signaal en geen briefing geweest die we kunnen tonen;
-- die stappen alsnog afvinken zou geschiedenis verzinnen.
do $$
declare
  g record;
  nieuw_id bigint;
begin
  for g in
    -- Groeperen op product + persona + hoek: varianten van dezelfde hypothese
    -- horen bij hetzelfde werkstuk. Maar alléén als die drie er ook zijn —
    -- anders zou "geen hoek bekend" zelf een groepeersleutel worden en zouden
    -- ongerelateerde creatives op één hoop belanden. Zonder metadata krijgt
    -- elke creative zijn eigen werkstuk.
    select brand, product, persona, angle_type,
           array_agg(id)                             as ids,
           min(coalesce(ad_name, 'Creative ' || id)) as titel,
           bool_or(status in ('Live','Winner','Iterate','Killed')) as ooit_live
    from public.creatives
    where werkstuk_id is null
    group by brand, product, persona, angle_type,
             case when product is null or persona is null or angle_type is null
                  then id end
  loop
    insert into marketing_hq.werkstukken (brand, titel, product, persona, angle_type,
                                          aanleiding, gestart_door)
    values (g.brand, g.titel, g.product, g.persona, g.angle_type,
            'Bestond al voordat de estafette er was; met terugwerkende kracht gekoppeld.',
            'mens')
    returning id into nieuw_id;

    update public.creatives set werkstuk_id = nieuw_id where id = any(g.ids);

    -- De trigger heeft alle zes stations al op 'open' gezet; hier wordt alleen
    -- bijgewerkt wat we werkelijk weten.

    -- ① en ② zijn nooit vastgelegd. Niet afvinken, wel benoemen — die stappen
    -- alsnog op 'klaar' zetten zou geschiedenis verzinnen die er niet is.
    perform marketing_hq.werkstuk_stap(nieuw_id, 1::smallint, 'niet_vastgelegd',
      'Geen signaal vastgelegd: dit werkstuk bestond vóór de estafette.');
    perform marketing_hq.werkstuk_stap(nieuw_id, 2::smallint, 'niet_vastgelegd',
      'Geen briefing vastgelegd: dit werkstuk bestond vóór de estafette.');

    -- ③ is wél gebeurd: de creative bestaat.
    perform marketing_hq.werkstuk_stap(nieuw_id, 3::smallint, 'klaar',
      'Creative gemaakt in de Atelier Console' ||
      case when array_length(g.ids,1) > 1
           then ' (' || array_length(g.ids,1) || ' varianten)' else '' end || '.',
      null, 'mens');

    if g.ooit_live then
      perform marketing_hq.werkstuk_stap(nieuw_id, 4::smallint, 'klaar',
        'Heeft gedraaid bij Meta.', 'bolt', 'poort');
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   alter table public.creatives               drop column if exists werkstuk_id;
--   alter table marketing_hq.reports           drop column if exists werkstuk_id;
--   alter table marketing_hq.pipeline_items    drop column if exists werkstuk_id;
--   alter table marketing_hq.email_drafts      drop column if exists werkstuk_id;
--   alter table marketing_hq.meta_publications drop column if exists werkstuk_id;
--   alter table marketing_hq.agent_messages    drop column if exists werkstuk_id;
--   alter table marketing_hq.approvals         drop column if exists werkstuk_id;
--   drop view if exists public.hq_werkstukken;
--   drop view if exists marketing_hq.werkstuk_estafette;
--   drop function if exists marketing_hq.werkstuk_stap(bigint, smallint, text, text, text, text, bigint, bigint);
--   drop table if exists marketing_hq.werkstuk_stappen;
--   drop table if exists marketing_hq.werkstukken;
-- ═══════════════════════════════════════════════════════════════════════════
