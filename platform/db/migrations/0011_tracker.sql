-- ═══════════════════════════════════════════════════════════════════════════
-- 0011 — De datalaag onder de test tracker
--
-- De tracker (tabblad Creative Strategy) toont elke advertentie als rij en
-- werkt. Wat eraan ontbreekt is niet de tabel maar wat eronder ligt:
--
--   1. Het verloop per dag. `meta_insights_daily` heeft het, maar niets
--      serveert het per creative uit. Je ziet nu alleen een eindstand, dus je
--      ziet een advertentie niet inzakken.
--   2. Een lijstrij zonder het beeld. De tracker doet vandaag `select *`, en
--      dat trekt `image_b64` mee: 469 kB over negen rijen, gemiddeld 52 kB per
--      rij. Bij 25 rijen per pagina zijn dat megabytes, en dat groeit lineair.
--   3. Een maatstaf. Een ROAS van 3,1 zegt niets zonder te weten wat de rest
--      bij dezelfde persona doet.
--
-- Alleen views. Geen tabel, geen kolom, niets dat bestaande data raakt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Het verloop per dag ─────────────────────────────────────────────────
-- Zelfde koppeling als `ad_totals` uit 0008: de publicatie kent het Meta-ad-id,
-- en daarop hangen de dagcijfers.
--
-- Twee soorten getallen naast elkaar, en het verschil is belangrijk. De
-- dagwaarde vertelt hoe die ene dag liep; het lopend totaal vertelt waar de
-- advertentie op dat moment stond. Een ad kan een slechte dag hebben zonder
-- dat het oordeel kantelt — daarvoor kijk je naar de lopende lijn.
create or replace view marketing_hq.creative_verloop as
select
  p.creative_id,
  p.brand,
  i.insight_date                                      as dag,
  (i.insight_date - p.published_at::date)             as dag_nr,

  -- wat er die dag gebeurde
  i.spend, i.impressions, i.clicks, i.link_clicks,
  i.purchases, i.purchase_value,
  case when i.spend > 0
       then round(i.purchase_value / i.spend, 3) end                       as roas,
  case when i.impressions > 0
       then round(i.clicks::numeric / i.impressions * 100, 4) end          as ctr,
  case when i.impressions > 0
       then round(i.video_3s::numeric / i.impressions, 4) end              as hook_rate,
  case when i.video_3s > 0
       then round(i.video_thruplay::numeric / i.video_3s, 4) end           as hold_rate,

  -- waar de advertentie op dat moment stond. Cumuleren op de tellers, dan pas
  -- delen — dezelfde regel als in 0008, want een gemiddelde van dagelijkse
  -- ROAS-waarden is niet de ROAS tot dan toe.
  sum(i.spend)          over w                        as spend_cum,
  sum(i.purchase_value) over w                        as omzet_cum,
  sum(i.impressions)    over w                        as impressions_cum,
  case when sum(i.spend) over w > 0
       then round(sum(i.purchase_value) over w / sum(i.spend) over w, 3) end as roas_tot_nu,
  case when sum(i.impressions) over w > 0
       then round(sum(i.clicks) over w::numeric / sum(i.impressions) over w * 100, 4) end as ctr_tot_nu,

  i.is_final
from marketing_hq.meta_publications p
join marketing_hq.meta_insights_daily i
  on i.level = 'ad' and i.entity_id = p.meta_ad_id
where p.meta_ad_id is not null and p.published_at is not null
window w as (partition by p.creative_id order by i.insight_date
             rows between unbounded preceding and current row);

comment on view marketing_hq.creative_verloop is
  'Per creative per dag: wat die dag deed, en waar de advertentie op dat moment stond.';

-- ── 2. De lijstrij, zonder het beeld ───────────────────────────────────────
-- Alles wat een rij in de tracker nodig heeft, en `image_b64` expliciet niet.
-- `beeld_beschikbaar` vertelt of er iets op te halen valt, zodat het scherm het
-- beeld pas laadt als je een rij openklapt.
--
-- Waar gemeten cijfers bestaan winnen die van wat er met de hand is ingetypt.
-- `cijfers_bron` maakt zichtbaar welke van de twee je ziet: een getal waarvan
-- je niet weet waar het vandaan komt, is geen getal om een besluit op te nemen.
create or replace view marketing_hq.creative_kaart as
select
  c.id, c.brand, c.werkstuk_id,
  c.ad_name, c.product, c.persona, c.angle_type, c.format, c.media_type,
  c.hook_short, c.awareness_level, c.marketing_angle, c.creative_concept,
  c.status, c.score, c.next_step, c.date_live, c.notes,

  c.has_image,
  (c.image_b64 is not null)                           as beeld_beschikbaar,
  c.creatives_link,

  coalesce(r.roas,      c.roas)                       as roas,
  coalesce(r.ctr,       c.ctr)                        as ctr,
  coalesce(r.cpm,       c.cpm)                        as cpm,
  coalesce(r.cpc,       c.cpc)                        as cpc,
  coalesce(r.cpa,       c.cpa)                        as cpa,
  coalesce(r.aov,       c.aov)                        as aov,
  coalesce(r.cvr,       c.cvr)                        as cvr,
  coalesce(r.hook_rate, c.hook_rate)                  as hook_rate,
  coalesce(r.hold_rate, c.hold_rate)                  as hold_rate,
  coalesce(r.impressions, c.impressions)              as impressions,
  r.spend,
  r.purchases,
  r.dagen_live,
  r.meetdagen,
  r.beoordeelbaar,
  case
    when r.creative_id is not null then 'meta'
    when c.roas is not null or c.ctr is not null then 'handmatig'
    else 'geen'
  end                                                 as cijfers_bron,

  c.created_at, c.updated_at
from public.creatives c
left join marketing_hq.creative_results r on r.creative_id = c.id;

comment on view marketing_hq.creative_kaart is
  'Een rij in de test tracker. Bewust zonder image_b64: dat is 52 kB per rij.';

-- ── 3. Hoe verhoudt dit zich tot de rest ───────────────────────────────────
-- Een ROAS van 3,1 is pas informatie als je weet wat de rest bij dezelfde
-- persona doet. Vandaar de mediaan en niet het gemiddelde: één uitschieter mag
-- de lat niet verleggen.
--
-- Onder drie soortgenoten wordt er geen oordeel gegeven. Dezelfde discipline
-- als `betrouwbaar` in 0008: met twee advertenties is "boven gemiddeld"
-- betekenisloos.
create or replace view marketing_hq.creative_vergelijking as
with gemeten as (
  select c.id, c.brand, c.persona, c.product, c.angle_type,
         r.roas, r.ctr, r.hook_rate, r.spend
  from public.creatives c
  join marketing_hq.creative_results r on r.creative_id = c.id
  where r.beoordeelbaar
),
per_persona as (
  -- percentile_cont geeft double precision terug. Terugcasten naar numeric
  -- houdt de cijfers in dezelfde soort als de rest en voorkomt dat er straks
  -- 2.0000000000000004 op het scherm staat.
  select brand, persona,
         count(*)                                                       as ads,
         percentile_cont(0.5) within group (order by roas)::numeric      as roas_mediaan,
         percentile_cont(0.5) within group (order by ctr)::numeric       as ctr_mediaan,
         percentile_cont(0.5) within group (order by hook_rate)::numeric as hook_mediaan
  from gemeten where persona is not null and roas is not null
  group by brand, persona
),
per_merk as (
  select brand,
         count(*)                                                       as ads,
         percentile_cont(0.5) within group (order by roas)::numeric     as roas_mediaan
  from gemeten where roas is not null
  group by brand
)
select
  g.id, g.brand, g.persona, g.product, g.angle_type,
  g.roas, g.ctr, g.hook_rate,
  pp.ads                                              as soortgenoten,
  pp.roas_mediaan                                     as roas_mediaan_persona,
  pp.ctr_mediaan                                      as ctr_mediaan_persona,
  pp.hook_mediaan                                     as hook_mediaan_persona,
  pm.roas_mediaan                                     as roas_mediaan_merk,
  case
    when pp.ads is null or pp.ads < 3 then null
    when g.roas > pp.roas_mediaan then 'boven'
    when g.roas < pp.roas_mediaan then 'onder'
    else 'gelijk'
  end                                                 as roas_tov_persona,
  case
    when pp.ads is null or pp.ads < 3
      then 'te weinig soortgenoten voor een vergelijking'
    else null
  end                                                 as waarschuwing
from gemeten g
left join per_persona pp on pp.brand = g.brand and pp.persona = g.persona
left join per_merk    pm on pm.brand = g.brand;

comment on view marketing_hq.creative_vergelijking is
  'Hoe een advertentie zich verhoudt tot soortgenoten. Mediaan, niet gemiddelde, en geen oordeel onder drie.';

-- ── Toegang ────────────────────────────────────────────────────────────────
create or replace view public.hq_creative_verloop with (security_invoker = true)
  as select * from marketing_hq.creative_verloop;
create or replace view public.hq_creative_kaart with (security_invoker = true)
  as select * from marketing_hq.creative_kaart;
create or replace view public.hq_creative_vergelijking with (security_invoker = true)
  as select * from marketing_hq.creative_vergelijking;

revoke all on public.hq_creative_verloop, public.hq_creative_kaart,
              public.hq_creative_vergelijking from anon, public;
grant select on public.hq_creative_verloop, public.hq_creative_kaart,
                public.hq_creative_vergelijking to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   drop view if exists public.hq_creative_verloop;
--   drop view if exists public.hq_creative_kaart;
--   drop view if exists public.hq_creative_vergelijking;
--   drop view if exists marketing_hq.creative_verloop;
--   drop view if exists marketing_hq.creative_kaart;
--   drop view if exists marketing_hq.creative_vergelijking;
-- ═══════════════════════════════════════════════════════════════════════════
