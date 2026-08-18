-- ═══════════════════════════════════════════════════════════════════════════
-- 0013 — De audit
--
-- Op 30 juli is de Meta-audit één keer met de hand over Wellshave® gedraaid.
-- Wat die opleverde bepaalt wat hier wordt gebouwd — niet andersom.
--
-- De scherpste bevinding was niet zichtbaar in wat Atlas vandaag ophaalt. Op
-- accountniveau stond de frequentie op 2,78. Uitgesplitst naar publiek bleek
-- het `engaged`-segment 53.792 vertoningen te krijgen op 3.164 mensen: een
-- frequentie van 17, voor €410. Eén ontbrekende uitsplitsing was het verschil
-- tussen "niets aan de hand" en de duurste fout in het account.
--
-- De tweede bevinding was een patroon: de advertenties met de hoogste CTR
-- hadden de laagste ROAS. Eén advertentie haalde 3,83% CTR en nul aankopen.
-- Dat is geen advertentie die stukgaat — dat is een advertentie die zijn werk
-- doet terwijl de pagina erachter het niet afmaakt. Een scorekaart die alleen
-- "slecht" zegt, gooit die diagnose weg.
--
-- Vandaar drie dingen:
--   1. De trechter, met de afhaakpunten uitgerekend op de tellers.
--   2. Het publiek per segment, want daar zat het lek dat niemand zag.
--   3. Een scorekaart die twee signalen tegen elkaar legt en die bij
--      tegenspraak niet één oordeel forceert maar de tegenspraak benoemt.
--
-- Additief: twee kolommen, één tabel, drie views.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Twee ontbrekende stappen in de trechter ─────────────────────────────
-- `landing_page_views`, `add_to_cart` en `initiate_checkout` stonden er al.
-- ViewContent en AddPaymentInfo niet, en juist die eerste legde bij één
-- campagne een pixelgat bloot: 37 ViewContents op 477 landingspagina's.
alter table marketing_hq.meta_insights_daily
  add column if not exists view_content     integer,
  add column if not exists add_payment_info integer;

comment on column marketing_hq.meta_insights_daily.view_content is
  'ViewContent. Staat dit ver onder landing_page_views, dan vuurt de pixel niet — geen vraagstuk over de advertentie.';

-- ── 2. Het publiek, uitgesplitst ───────────────────────────────────────────
-- Aparte tabel en geen kolom op meta_insights_daily: de uitsplitsing heeft een
-- andere korrel. Eén dag heeft één accountregel én drie segmentregels, en die
-- zouden elkaar in dezelfde tabel dubbel tellen.
--
-- Per venster en niet per dag, en dat is geen detail. Bereik is ontdubbeld
-- binnen zijn periode: dertig dagbereiken bij elkaar optellen telt dezelfde
-- persoon dertig keer. Wie dat toch doet en er vertoningen op deelt, krijgt
-- een frequentie die er veel te laag uitziet — precies de fout die deze view
-- moet blootleggen. Meta rekent het bereik uit over het venster dat je vraagt,
-- dus slaan we dat venster op zoals het is opgehaald.
--
-- Bij deze uitsplitsing geeft Meta geen conversies terug: alleen spend,
-- vertoningen en bereik. Dat is genoeg, want de maat die ertoe doet is
-- vertoningen gedeeld door bereik.
create table if not exists marketing_hq.meta_publiek (
  account_id   text    not null,
  van          date    not null,
  tot          date    not null,
  segment      text    not null,
  spend        numeric,
  impressions  bigint,
  reach        bigint,
  captured_at  timestamptz not null default now(),
  primary key (account_id, van, tot, segment),
  constraint meta_publiek_venster check (tot >= van)
);

comment on table marketing_hq.meta_publiek is
  'Spend en bereik per publiekssegment, per opgehaald venster. De uitsplitsing waarin de frequentie-17 zichtbaar werd.';
comment on column marketing_hq.meta_publiek.reach is
  'Ontdubbeld binnen het venster. Niet optelbaar over vensters heen.';

alter table marketing_hq.meta_publiek enable row level security;
do $$ begin
  create policy publiek_lezen on marketing_hq.meta_publiek
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

-- ── 3. De trechter ─────────────────────────────────────────────────────────
-- Optellen doe je op de tellers, niet op de ratio's. Een gemiddelde van
-- dertig dagelijkse conversieratio's is niet de conversieratio over dertig
-- dagen, en het verschil loopt op naarmate de spend per dag varieert.
--
-- De twee afwijkingen uit de handmatige audit zijn hier een berekende
-- vaststelling geworden, geen instructie in een prompt:
--
--   IC > ATC   Shopify express checkout (Shop Pay, Apple Pay) slaat de
--              winkelwagen over. De stap ATC→IC meet dan niets; het lek moet
--              je aflezen aan IC→aankoop.
--   VC << LPV  De bestemming vuurt ViewContent niet. Zolang dat zo is
--              optimaliseert Meta op ruis en is elk oordeel over de bovenkant
--              van deze trechter waardeloos.
create or replace view marketing_hq.trechter as
with opgeteld as (
  select
    account_id, level, entity_id,
    max(entity_name)                            as entity_name,
    min(insight_date)                           as van,
    max(insight_date)                           as tot,
    count(*)                                    as dagen,
    sum(spend)                                  as spend,
    sum(impressions)                            as impressions,
    sum(landing_page_views)                     as lpv,
    sum(view_content)                           as view_content,
    sum(add_to_cart)                            as atc,
    sum(initiate_checkout)                      as ic,
    sum(add_payment_info)                       as api,
    sum(purchases)                              as aankopen,
    sum(purchase_value)                         as omzet,
    bool_and(is_final)                          as definitief
  from marketing_hq.meta_insights_daily
  where insight_date >= current_date - 30
  group by account_id, level, entity_id
),
ratios as (
  select o.*,
    case when o.lpv > 0      then round(o.atc::numeric      / o.lpv * 100, 2) end as lpv_naar_atc_pct,
    case when o.atc > 0      then round(o.ic::numeric       / o.atc * 100, 2) end as atc_naar_ic_pct,
    case when o.ic > 0       then round(o.aankopen::numeric / o.ic * 100, 2) end as ic_naar_aankoop_pct,
    case when o.lpv > 0      then round(o.aankopen::numeric / o.lpv * 100, 2) end as lpv_naar_aankoop_pct,
    case when o.spend > 0    then round(o.omzet / o.spend, 3) end                 as roas,
    case when o.aankopen > 0 then round(o.spend / o.aankopen, 2) end              as cpa
  from opgeteld o
),
-- De zwakste stap is niet de stap met het grootste verlies. In vrijwel elke
-- trechter valt de meeste massa weg tussen landingspagina en winkelwagen, dus
-- die uitkomst zou altijd hetzelfde zijn en dus niets zeggen.
--
-- Wat wél iets zegt: waar deze entiteit het slechtst doet ten opzichte van de
-- andere entiteiten op hetzelfde niveau. Mediaan, en geen oordeel onder drie
-- soortgenoten — dezelfde regel als in 0011.
lat as (
  select account_id, level,
         count(*)                                                                   as peers,
         percentile_cont(0.5) within group (order by lpv_naar_atc_pct)::numeric     as m_atc,
         percentile_cont(0.5) within group (order by atc_naar_ic_pct)::numeric      as m_ic,
         percentile_cont(0.5) within group (order by ic_naar_aankoop_pct)::numeric  as m_koop
  from ratios
  where lpv_naar_atc_pct is not null and atc_naar_ic_pct is not null
    and ic_naar_aankoop_pct is not null
  group by account_id, level
)
select
  r.*,
  l.peers                                                 as soortgenoten,
  case
    when l.peers is null or l.peers < 3 then null
    when (r.lpv_naar_atc_pct - l.m_atc) <= (r.atc_naar_ic_pct - l.m_ic)
     and (r.lpv_naar_atc_pct - l.m_atc) <= (r.ic_naar_aankoop_pct - l.m_koop)
      then 'landingspagina naar winkelwagen'
    when (r.atc_naar_ic_pct - l.m_ic) <= (r.ic_naar_aankoop_pct - l.m_koop)
      then 'winkelwagen naar checkout'
    else 'checkout naar aankoop'
  end                                                     as zwakste_stap,
  case when l.peers is null or l.peers < 3
       then 'te weinig soortgenoten om een zwakste stap aan te wijzen' end as beperking,

  nullif(concat_ws('; ',
    case when r.ic > r.atc
      then 'IC hoger dan ATC — waarschijnlijk express checkout die de winkelwagen overslaat; lees het lek af aan IC naar aankoop' end,
    case when r.lpv > 0 and r.view_content is not null and r.view_content < r.lpv / 2
      then 'ViewContent vuurt nauwelijks ('|| r.view_content ||' op '|| r.lpv ||' landingspagina-weergaven) — pixel controleren voordat je hier iets uit afleidt' end
  ), '')                                                  as waarschuwing
from ratios r
left join lat l on l.account_id = r.account_id and l.level = r.level;

comment on view marketing_hq.trechter is
  'De trechter over 30 dagen, per entiteit. Ratio''s op de tellers, en de twee bekende meetfouten benoemd in plaats van meegerekend.';

-- ── 4. Verzadiging per publiek ─────────────────────────────────────────────
-- Frequentie op accountniveau is een gemiddelde over ongelijksoortige groepen,
-- en dat verbergt precies wat je wilt weten. 2,78 op het account, 17,0 op het
-- segment eronder.
-- Alleen het laatst opgehaalde venster per account. Vensters overlappen elkaar
-- en zijn niet samen te voegen, dus is er één geldige stand: de nieuwste.
create or replace view marketing_hq.publiek_verzadiging as
with laatste as (
  select account_id, max(tot) as tot from marketing_hq.meta_publiek group by account_id
),
venster as (
  select p.* from marketing_hq.meta_publiek p
  join laatste l on l.account_id = p.account_id and l.tot = p.tot
)
select
  v.account_id, v.segment, v.van, v.tot,
  (v.tot - v.van) + 1                                 as dagen,
  v.spend, v.impressions, v.reach                     as bereik,
  round(v.spend / nullif(sum(v.spend) over (partition by v.account_id), 0) * 100, 1) as aandeel_spend_pct,
  case when v.reach > 0
       then round(v.impressions::numeric / v.reach, 2) end                          as frequentie,
  case
    when v.reach is null or v.reach = 0 then null
    when v.impressions::numeric / v.reach >= 10 then 'stukgedraaid'
    when v.impressions::numeric / v.reach >= 5  then 'verzadigd'
    when v.impressions::numeric / v.reach >= 3  then 'let op'
    else 'gezond'
  end                                                                               as staat
from venster v;

comment on view marketing_hq.publiek_verzadiging is
  'Frequentie per publiekssegment over 30 dagen. De maat die een accountgemiddelde wegpoetst.';

-- ── 5. De scorekaart ───────────────────────────────────────────────────────
-- Twee signalen, geen één. En bij tegenspraak geen geforceerd oordeel.
--
-- De audit-methode vraagt om drie signalen, waarvan er één de CTR tegen de
-- industriebenchmark is. Meta geeft die voor dit account niet terug — twee
-- keer gevraagd, twee keer leeg. In plaats daarvan de eigen accountmediaan:
-- eerlijker, want hij meet tegen wat wij daadwerkelijk halen, en beschikbaar,
-- wat een benchmark die leeg blijft niet is.
--
-- Mediaan en geen gemiddelde: één uitschieter mag de lat niet verleggen.
-- Dezelfde regel als in 0011.
--
-- Waar de twee signalen elkaar tegenspreken staat er geen oordeel maar een
-- diagnose. Een advertentie met 3,83% CTR en nul aankopen is niet slecht — die
-- levert het verkeer en verliest het daarna. Wie daar 'stoppen' op plakt,
-- gooit de enige aanwijzing weg die hij had.
create or replace view marketing_hq.advertentie_scorekaart as
with per_ad as (
  select
    account_id, entity_id,
    max(entity_name)                as ad_naam,
    count(*)                        as dagen,
    sum(spend)                      as spend,
    sum(impressions)                as impressions,
    sum(clicks)                     as clicks,
    sum(purchases)                  as aankopen,
    sum(purchase_value)             as omzet,
    -- De laatst bekende rangschikking; Meta geeft hem alleen bij genoeg volume.
    (array_remove(array_agg(quality_ranking order by insight_date desc), null))[1] as kwaliteit
  from marketing_hq.meta_insights_daily
  where level = 'ad' and insight_date >= current_date - 30
  group by account_id, entity_id
),
gemeten as (
  select *,
    case when spend > 0        then round(omzet / spend, 3) end                     as roas,
    case when impressions > 0  then round(clicks::numeric / impressions * 100, 3) end as ctr,
    -- Dezelfde ondergrens als `beoordeelbaar` in 0008. Onder deze drempel is
    -- het verschil tussen twee advertenties ruis.
    (spend >= 50 and impressions >= 1000)                                           as beoordeelbaar
  from per_ad
),
lat as (
  select account_id,
         count(*)                                                        as peers,
         percentile_cont(0.5) within group (order by roas)::numeric       as roas_mediaan,
         percentile_cont(0.5) within group (order by ctr)::numeric        as ctr_mediaan
  from gemeten
  where beoordeelbaar and roas is not null and ctr is not null
  group by account_id
)
select
  g.account_id, g.entity_id, g.ad_naam,
  g.dagen, g.spend, g.impressions, g.aankopen, g.omzet,
  g.roas, g.ctr, g.kwaliteit,
  case when g.aankopen > 0 then round(g.spend / g.aankopen, 2) end as cpa,
  l.peers                                             as soortgenoten,
  l.roas_mediaan, l.ctr_mediaan,
  (g.roas > l.roas_mediaan)                           as roas_boven,
  (g.ctr  > l.ctr_mediaan)                            as ctr_boven,
  -- Hoeveel signalen er werkelijk waren. Twee is de norm; drie zodra Meta een
  -- rangschikking teruggeeft. Dit getal staat in de view zodat een lezer nooit
  -- hoeft te raden waar een oordeel op rust.
  (2 + case when g.kwaliteit is not null then 1 else 0 end) as signalen,

  -- Een mediaan splitst zijn eigen set in tweeën: de helft valt er altijd
  -- onder, hoe goed het account ook draait. Op zes advertenties zou een ROAS
  -- van 2,03 daarmee 'stoppen' krijgen omdat hij een haar onder de mediaan van
  -- zes ligt. Dat is winstgevend werk afserveren op een rangorde.
  --
  -- Daarom vraagt 'stoppen' twee dingen tegelijk: onder de mediaan én absoluut
  -- verliesgevend. Onder de mediaan maar boven break-even is geen fout, dat is
  -- de onderste helft — en die heeft elk account.
  case
    when not g.beoordeelbaar                    then null
    when l.peers is null or l.peers < 3         then null
    when g.roas > l.roas_mediaan and g.ctr > l.ctr_mediaan   then 'opschalen'
    when g.roas < 1 and g.ctr <= l.ctr_mediaan               then 'stoppen'
    when g.ctr  > l.ctr_mediaan                              then 'materiaal werkt, bestemming niet'
    when g.roas > l.roas_mediaan                             then 'converteert, bereikt te weinig'
    else 'houden, niet opschalen'
  end                                                 as oordeel,

  case
    when not g.beoordeelbaar
      then 'onder de drempel: minder dan 1.000 vertoningen of 50 euro'
    when l.peers is null or l.peers < 3
      then 'te weinig soortgenoten voor een mediaan'
    when g.roas > l.roas_mediaan and g.ctr > l.ctr_mediaan
      then 'beide signalen boven de accountmediaan'
    when g.roas < 1 and g.ctr <= l.ctr_mediaan
      then 'onder de mediaan op beide signalen én onder break-even'
    when g.ctr > l.ctr_mediaan
      then 'trekt bovengemiddeld door maar zet niet om — kijk naar de pagina en het aanbod, niet naar het materiaal'
    when g.roas > l.roas_mediaan
      then 'zet bovengemiddeld om maar wordt weinig aangeklikt — meer bereik hierop is waarschijnlijk winst'
    else 'onderste helft van het account, maar wel boven break-even'
  end                                                 as waarom
from gemeten g
left join lat l on l.account_id = g.account_id;

comment on view marketing_hq.advertentie_scorekaart is
  'Twee signalen tegen de accountmediaan. Bij tegenspraak een diagnose in plaats van een geforceerd oordeel.';

-- ── Toegang ────────────────────────────────────────────────────────────────
create or replace view public.hq_trechter with (security_invoker = true)
  as select * from marketing_hq.trechter;
create or replace view public.hq_publiek_verzadiging with (security_invoker = true)
  as select * from marketing_hq.publiek_verzadiging;
create or replace view public.hq_advertentie_scorekaart with (security_invoker = true)
  as select * from marketing_hq.advertentie_scorekaart;

revoke all on public.hq_trechter, public.hq_publiek_verzadiging,
              public.hq_advertentie_scorekaart from anon, public;
grant select on public.hq_trechter, public.hq_publiek_verzadiging,
                public.hq_advertentie_scorekaart to authenticated;

-- ── De afspraak erbij ──────────────────────────────────────────────────────
-- Wekelijks en niet dagelijks: een audit op dagritme is ruis. 8 dagen stilte
-- is de grens — één gemiste week valt op, één late ochtend niet.
insert into marketing_hq.agent_afspraken
  (agent_id, kind, soort, cadans, levert, doel_tabel, lat, max_stilte_uren)
values
  ('atlas', 'account_audit', 'model',
   'elke maandag 06:00 UTC',
   'Eén audit per account: trechter met afhaakpunten, publiek per segment, en een scorekaart op twee signalen.',
   'reports',
   'Een rij in reports met kind=audit, het afhaakpunt benoemd, en per advertentie een oordeel of de reden waarom er geen is.',
   192)
on conflict (agent_id, kind) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   delete from marketing_hq.agent_afspraken where agent_id='atlas' and kind='account_audit';
--   drop view if exists public.hq_advertentie_scorekaart;
--   drop view if exists public.hq_publiek_verzadiging;
--   drop view if exists public.hq_trechter;
--   drop view if exists marketing_hq.advertentie_scorekaart;
--   drop view if exists marketing_hq.publiek_verzadiging;
--   drop view if exists marketing_hq.trechter;
--   drop table if exists marketing_hq.meta_segment_daily;
--   alter table marketing_hq.meta_insights_daily
--     drop column if exists view_content, drop column if exists add_payment_info;
-- ═══════════════════════════════════════════════════════════════════════════
