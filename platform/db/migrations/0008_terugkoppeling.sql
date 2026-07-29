-- Marketing OS — de terugkoppeling (stap 06).
-- Toepassen op bequyhghgkvekvibufhw, ná 0007.
--
-- Wat dit doet: de cijfers die per advertentie uit Meta komen terugschrijven
-- naar public.creatives, zodat de generator ze gebruikt.
--
-- Waarom dat genoeg is: de console consumeert deze terugkoppeling al op drie
-- plekken, en alle drie hangen aan dezelfde twee kolommen.
--
--   wgpLoadWinners()   status in ('Winner','Iterate'), gesorteerd op roas
--   wgpLoadAngleHist() angle_type + roas, per persona
--   px.angleStats      idem, plus status = 'Winner'
--
-- Er is dus geen nieuw scherm nodig. Vul roas en status met de werkelijkheid en
-- de wizard begint uit zichzelf bij wat werkt in plaats van bij niets.
--
-- Bewust in SQL en niet in een agent: dit is rekenwerk met één juist antwoord.
-- Een taalmodel voegt hier niets toe en kan er alleen iets aan verzinnen.

-- ── Optellen doe je op de tellers, niet op de ratio's ───────────────────────
-- Het gemiddelde van drie ROAS-waarden is niet de ROAS over drie dagen. Deze
-- view telt eerst spend en omzet op en deelt daarna pas.
create or replace view marketing_hq.ad_totals as
select
  p.creative_id,
  p.id                              as publication_id,
  p.brand,
  p.meta_ad_id,
  p.published_at,
  min(i.insight_date)               as eerste_dag,
  max(i.insight_date)               as laatste_dag,
  max(i.insight_date) - p.published_at::date as dagen_live,
  count(*)                          as meetdagen,
  bool_and(i.is_final)              as alles_definitief,
  sum(i.spend)                      as spend,
  sum(i.impressions)                as impressions,
  sum(i.clicks)                     as clicks,
  sum(i.link_clicks)                as link_clicks,
  sum(i.purchases)                  as purchases,
  sum(i.purchase_value)             as purchase_value,
  sum(i.video_3s)                   as video_3s,
  sum(i.video_thruplay)             as video_thruplay
from marketing_hq.meta_publications p
join marketing_hq.meta_insights_daily i
  on i.level = 'ad' and i.entity_id = p.meta_ad_id
where p.meta_ad_id is not null and p.published_at is not null
group by p.creative_id, p.id, p.brand, p.meta_ad_id, p.published_at;

-- ── Wat een advertentie heeft opgeleverd ───────────────────────────────────
create or replace view marketing_hq.creative_results as
select
  t.*,
  case when t.spend > 0        then round(t.purchase_value / t.spend, 3) end            as roas,
  case when t.impressions > 0  then round(t.clicks::numeric / t.impressions * 100, 4) end as ctr,
  case when t.impressions > 0  then round(t.spend / t.impressions * 1000, 4) end        as cpm,
  case when t.clicks > 0       then round(t.spend / t.clicks, 4) end                    as cpc,
  case when t.purchases > 0    then round(t.spend / t.purchases, 2) end                 as cpa,
  case when t.purchases > 0    then round(t.purchase_value / t.purchases, 2) end        as aov,
  case when t.link_clicks > 0  then round(t.purchases::numeric / t.link_clicks, 4) end  as cvr,
  case when t.impressions > 0  then round(t.video_3s::numeric / t.impressions, 4) end   as hook_rate,
  case when t.video_3s > 0     then round(t.video_thruplay::numeric / t.video_3s, 4) end as hold_rate,
  -- Een advertentie is pas te beoordelen als de attributiestaart voorbij is
  -- (~72 uur) én er genoeg volume onder zit om iets te betekenen.
  (t.dagen_live >= 4 and t.spend >= 50 and t.impressions >= 1000)                       as beoordeelbaar
from marketing_hq.ad_totals t;

-- ── Terugschrijven naar de console ─────────────────────────────────────────
-- Vult de kolommen die de generator leest. Alleen advertenties die daadwerkelijk
-- gemeten zijn; nooit een creative overschrijven waar niets van bekend is.
--
-- De status volgt het advies van Bolt, niet het cijfer alleen: 'Iterate' zegt
-- iets anders dan 'Winner', ook als de ROAS hetzelfde is.
create or replace function marketing_hq.sync_creative_results()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_cijfers int := 0;
  n_status  int := 0;
begin
  -- 1. De cijfers.
  with r as (
    select * from marketing_hq.creative_results where creative_id is not null
  )
  update public.creatives c
     set impressions = r.impressions,
         roas        = r.roas,
         ctr         = r.ctr,
         cpm         = r.cpm,
         cpc         = r.cpc,
         cpa         = r.cpa,
         aov         = r.aov,
         cvr         = r.cvr,
         conversions = r.purchases,
         hook_rate   = r.hook_rate,
         hold_rate   = r.hold_rate,
         budget      = r.spend,
         date_live   = coalesce(c.date_live, r.published_at::date),
         updated_at  = now()
    from r
   where c.id = r.creative_id;
  get diagnostics n_cijfers = row_count;

  -- 2. De status, uit het meest recente oordeel per advertentie.
  with laatste as (
    select distinct on (rec.ad_id)
           rec.ad_id, rec.verdict, rec.action
      from marketing_hq.meta_recommendations rec
     order by rec.ad_id, rec.created_at desc
  ),
  vertaald as (
    select p.creative_id,
           case
             when l.verdict = 'winner'            then 'Winner'
             when l.action  = 'iterate'           then 'Iterate'
             when l.action  = 'pause'             then 'Killed'
             when l.verdict = 'onvoldoende_data'  then 'Live'
             else 'Live'
           end as nieuwe_status
      from laatste l
      join marketing_hq.meta_publications p on p.meta_ad_id = l.ad_id
      join marketing_hq.creative_results  cr on cr.creative_id = p.creative_id
     where p.creative_id is not null
       and cr.beoordeelbaar          -- onder de drempels geen oordeel opdringen
  )
  update public.creatives c
     set status = v.nieuwe_status,
         updated_at = now()
    from vertaald v
   where c.id = v.creative_id
     and c.status is distinct from v.nieuwe_status
     -- Wat een mens handmatig heeft weggezet blijft weg.
     and c.status <> 'Killed';
  get diagnostics n_status = row_count;

  return json_build_object('cijfers_bijgewerkt', n_cijfers, 'status_bijgewerkt', n_status);
end $$;

revoke all on function marketing_hq.sync_creative_results() from public, anon, authenticated;

-- ── Wat werkt er, over advertenties heen ───────────────────────────────────
-- Eén advertentie zegt weinig. Deze view telt op per hoek en persona, zodat
-- zichtbaar wordt welk patroon werkt in plaats van welke advertentie geluk had.
create or replace view marketing_hq.angle_learnings as
select
  c.brand,
  c.angle_type,
  c.persona,
  count(*)                                            as aantal_ads,
  sum(cr.spend)                                       as spend,
  sum(cr.purchase_value)                              as omzet,
  case when sum(cr.spend) > 0
       then round(sum(cr.purchase_value) / sum(cr.spend), 3) end as roas,
  case when sum(cr.impressions) > 0
       then round(sum(cr.clicks)::numeric / sum(cr.impressions) * 100, 4) end as ctr,
  max(cr.roas)                                        as beste_ad_roas,
  count(*) filter (where c.status = 'Winner')         as winnaars,
  -- Onder drie advertenties of €300 is dit een anekdote, geen patroon.
  (count(*) >= 3 and sum(cr.spend) >= 300)            as betrouwbaar
from marketing_hq.creative_results cr
join public.creatives c on c.id = cr.creative_id
where cr.beoordeelbaar and c.angle_type is not null
group by c.brand, c.angle_type, c.persona;

-- ── Toegang ─────────────────────────────────────────────────────────────────
create or replace view public.hq_creative_results with (security_invoker = true)
  as select * from marketing_hq.creative_results;
create or replace view public.hq_angle_learnings with (security_invoker = true)
  as select * from marketing_hq.angle_learnings;

revoke all on public.hq_creative_results, public.hq_angle_learnings from anon, public;
grant select on public.hq_creative_results, public.hq_angle_learnings to authenticated;

-- ── De ochtendcyclus wordt een cyclus ──────────────────────────────────────
-- De volgorde is nu belangrijk: eerst meten, dan oordelen, dan terugschrijven,
-- en pas daarna briefen. Nova ziet dan de uitkomst van gisteren in plaats van
-- die van eergisteren.
--
--   05:00 UTC  Atlas   dagrapport op accountniveau
--   05:20 UTC  Bolt    scorecard per advertentie + oordelen
--   05:40 UTC  systeem cijfers terug naar de creatives
--   06:00 UTC  Nova    pipeline bijwerken en briefen
insert into marketing_hq.schedules (id, agent_id, kind, cron, payload) values
  ('bolt_scorecard',  'bolt',  'creative_scorecard', '20 5 * * *', '{"window_days":7}'::jsonb),
  ('atlas_feedback',  'atlas', 'feedback_sync',      '40 5 * * *', '{}'::jsonb)
on conflict (id) do nothing;

update marketing_hq.schedules set cron = '0 6 * * *' where id = 'nova_daily';

-- ── Terugdraaien ────────────────────────────────────────────────────────────
-- delete from marketing_hq.schedules where id in ('bolt_scorecard','atlas_feedback');
-- update marketing_hq.schedules set cron = '30 5 * * *' where id = 'nova_daily';
-- drop view if exists public.hq_angle_learnings, public.hq_creative_results;
-- drop function if exists marketing_hq.sync_creative_results();
-- drop view if exists marketing_hq.angle_learnings, marketing_hq.creative_results, marketing_hq.ad_totals;
