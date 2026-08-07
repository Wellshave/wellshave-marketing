-- ═══════════════════════════════════════════════════════════════════════════
-- 0043 — Twee gaten die pas zichtbaar werden tegen de echte 631 rijen
--
-- 0042 is toegepast en daarna nagemeten op productie. 621 van de 631 rijen
-- kregen een sleutel, maar er waren er 619 uniek. Dat verschil is dit bestand.
--
-- Gat 1: een variant van twee cijfers viel eruit
--
--   De sleutelregex eindigde op ([0-9])(?![0-9]) — precies één cijfer, en
--   niets erachter. Dat was bedoeld om `WS - 103 - 22` niet stilletjes als
--   variant 2 te lezen. Het effect was dat rij `165-10` helemaal geen sleutel
--   kreeg en dus nooit gemeten zou worden.
--
--   Eén rij van de 624. Precies het soort verlies dat niemand opmerkt: geen
--   fout, geen waarschuwing, alleen een creative die er voor de analyse nooit
--   is geweest. Varianten lopen in de map van 1 tot en met 10, dus twee cijfers
--   hoort gewoon te kunnen.
--
-- Gat 2: drie creatives met dezelfde sleutel
--
--   Bij de import bleken er drie rijen `144-1` te heten. Die kregen toen
--   `(bron 404)` en `(bron 405)` achter hun naam om de uniciteitseis te halen.
--   Voor de sleutel maakt dat niet uit: alle drie komen uit op '144:1'.
--
--   ad_totals groepeert per creative, dus alle drie zouden hetzelfde bedrag
--   toegewezen krijgen. Wat één advertentie uitgaf, telt dan drie keer mee in
--   elke telling per persona, per angle, per bewustzijnsniveau. Dat is erger
--   dan een gat: een gat ziet eruit als iets wat ontbreekt, dit ziet eruit als
--   bewijs.
--
--   De meting gaat daarom naar de oudste van de drie, en de andere twee
--   blijven ongemeten. Niet omdat die keuze inhoudelijk klopt — welke van de
--   drie het werkelijk was, weet dit systeem niet — maar omdat één keer tellen
--   dichter bij de waarheid ligt dan drie keer. Wie het wél weet, ziet de
--   dubbelen staan in creative_meta_koppeling en kan ze uit elkaar halen.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── De variant mag twee cijfers hebben ─────────────────────────────────────
-- {1,2} in plaats van één, met dezelfde bewaking erachter: na de variant mag
-- geen cijfer meer komen, anders leest `WS - 103 - 223` als variant 22.
create or replace function marketing_hq.meta_naam_sleutel(naam text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
           when m is null then null
           else concat_ws(':', nullif(upper(coalesce(m[1], '')), ''), m[2]::int::text, m[3]::int::text)
         end
  from (
    select regexp_match(
             translate(coalesce(naam, ''), '–—', '--'),
             '^\s*@?\s*(?:WS)?\s*-?\s*(?:(BFCM|C)\s*-\s*)?([0-9]{1,3})\s*-\s*([0-9]{1,2})(?![0-9])',
             'i'
           ) as m
  ) s;
$$;

comment on function marketing_hq.meta_naam_sleutel(text) is
  'Brengt een Meta-advertentienaam en een ad_name uit de map terug tot dezelfde sleutel. Varianten van één of twee cijfers. Geeft null bij bundels, dubbele nummers en alles wat geen losse creative is.';

-- ── Wie draagt de meting als meerdere creatives dezelfde sleutel hebben ────
-- De oudste. Zie de kop: dit is een keuze tegen dubbeltellen, geen bewering
-- over welke rij het werkelijk was.
create or replace view marketing_hq.creative_sleutel as
select
  c.id                                            as creative_id,
  c.brand,
  c.ad_name,
  marketing_hq.meta_naam_sleutel(c.ad_name)       as sleutel,
  count(*)    over (partition by c.brand, marketing_hq.meta_naam_sleutel(c.ad_name)) as delers,
  (c.id = min(c.id) over (partition by c.brand, marketing_hq.meta_naam_sleutel(c.ad_name))) as draagt_meting
from public.creatives c
where c.ad_name is not null
  and marketing_hq.meta_naam_sleutel(c.ad_name) is not null;

comment on view marketing_hq.creative_sleutel is
  'Elke creative met zijn sleutel, hoeveel rijen die sleutel delen, en welke van hen de meting krijgt. Delers boven 1 betekent dat de map twee keer dezelfde advertentienaam gebruikt.';

-- ── ad_totals: één drager per sleutel ──────────────────────────────────────
-- Opnieuw exact dezelfde achttien kolommen in dezelfde volgorde. creative_
-- results doet `select t.*` en daar hangt de halve console aan.
create or replace view marketing_hq.ad_totals as
with pub as (
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
  group by p.creative_id, p.id, p.brand, p.meta_ad_id, p.published_at
),
naam as (
  select
    s.creative_id,
    null::bigint                      as publication_id,
    s.brand,
    null::text                        as meta_ad_id,
    min(i.insight_date)::timestamptz  as published_at,
    min(i.insight_date)               as eerste_dag,
    max(i.insight_date)               as laatste_dag,
    max(i.insight_date) - min(i.insight_date) as dagen_live,
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
  from marketing_hq.creative_sleutel s
  join marketing_hq.meta_accounts a
    on a.brand = s.brand and a.actief
  join marketing_hq.meta_insights_daily i
    on i.level = 'ad'
   and i.account_id = a.account_id
   and marketing_hq.meta_naam_sleutel(i.entity_name) = s.sleutel
  where s.draagt_meting
  group by s.creative_id, s.brand
)
select * from pub
union all
select * from naam n
where not exists (
  select 1 from pub p where p.creative_id = n.creative_id
);

comment on view marketing_hq.ad_totals is
  'Optellen op de tellers, niet op de ratio''s. Twee wegen naar dezelfde creative: een publicatie die dit systeem zelf deed, of de advertentienaam voor alles van daarvoor. Publicatie wint, want die weet het zeker. Delen meerdere rijen één naam, dan draagt de oudste de meting en tellen de andere niet mee.';

-- ── De dubbelen zichtbaar maken ────────────────────────────────────────────
-- Een keuze die niemand kan zien is een aanname die niemand kan corrigeren.
create or replace view marketing_hq.creative_meta_koppeling as
with ads as (
  select
    a.brand,
    marketing_hq.meta_naam_sleutel(i.entity_name) as sleutel,
    i.entity_id,
    i.entity_name,
    sum(i.spend) as spend
  from marketing_hq.meta_insights_daily i
  join marketing_hq.meta_accounts a
    on a.account_id = i.account_id and a.actief
  where i.level = 'ad' and i.entity_name is not null
  group by 1, 2, 3, 4
)
select
  ads.brand,
  ads.sleutel,
  ads.entity_id                          as meta_ad_id,
  ads.entity_name                        as meta_naam,
  ads.spend,
  s.creative_id,
  s.ad_name,
  case
    when ads.sleutel is null      then 'naam niet te ontleden'
    when s.creative_id is null    then 'geen creative met deze sleutel'
    when s.delers > 1             then 'gekoppeld, maar ' || s.delers || ' rijen delen deze naam'
    else 'gekoppeld'
  end                                    as toestand
from ads
left join marketing_hq.creative_sleutel s
  on s.brand = ads.brand and s.sleutel = ads.sleutel and s.draagt_meting;

comment on view marketing_hq.creative_meta_koppeling is
  'Elke gemeten Meta-advertentie met de creative waar hij aan hangt, of de reden waarom niet. Bedoeld om te zien wat er buiten de map valt.';

grant select on marketing_hq.creative_sleutel to authenticated;
