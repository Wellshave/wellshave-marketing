-- ═══════════════════════════════════════════════════════════════════════════
-- 0046 — Koppelen op naam, en de C-reeks in de map
--
-- Beslisvraag:
--
--     "De nieuwste creatives hebben geen nummer. Hoe komen die ooit in de
--      map?"
--
-- Wat er aan de hand is
--
--   De map is oud. Hij loopt tot januari 2026 en het werk is doorgegaan: sinds
--   23 juli draait campagne "001 - CBO - GroomGuard - 23-07-26" met een nieuwe
--   naamgeving waarin de angle ín de naam staat en geen nummer meer voorkomt.
--
--     C1 - 4 Reasons Why    5 ads   € 1.414,76   25 aankopen   € 1.504,88
--     C3 - Social Proof     5 ads   €   539,46   11 aankopen   €   535,54
--     C3                    4 ads   €   213,03    3 aankopen   €   182,81
--     C2 - Before/After     5 ads   €   169,06    4 aankopen   €   269,84
--     C1                    4 ads   €   107,74    -            -
--     C2                    3 ads   €    28,26    -            -
--
--   Samen € 2.472,31 — de grootste post van deze periode, en onzichtbaar voor
--   elke analyse over persona of angle.
--
-- Waarom een tweede koppelweg en geen zevende reeks in de regex
--
--   Er valt niets te ontleden: 'C1' bevat geen nummer-variant-paar. Elke poging
--   om er toch een sleutel uit te persen is een aanname. Wat wél werkt is het
--   simpelste denkbare: staat er in de map een rij die exact zo heet, dan horen
--   ze bij elkaar.
--
--   Daarom valt de sleutel terug op de naam zelf als het nummerpatroon niets
--   oplevert. Dat is geen gok maar een identiteit — en het werkt meteen voor
--   elke toekomstige naamgeving die niemand nu kan voorzien, zonder dat er een
--   regex bij hoeft.
--
--   De koppeling zegt voortaan ook wélke van de twee wegen het was. "Gekoppeld"
--   op een nummer is een afleiding; op een naam is het een gelijkstelling. Dat
--   verschil hoort zichtbaar te zijn, niet weggemiddeld in één woord.
--
-- Wat er wél en niet wordt ingevuld
--
--   Ingevuld wat na te meten is: de naam, het merk, het product (de campagne
--   heet GroomGuard), de eerste meetdag, de status, en bij drie van de zes de
--   angle — die staat letterlijk in de naam.
--
--   Leeg gelaten wat een oordeel is: persona, bewustzijnsniveau, desires,
--   hypothese. Ik kan uit een advertentienaam niet afleiden op wie hij mikt of
--   hoeveel iemand al weet. Dat invullen zou de map vullen met iets wat
--   eruitziet als kennis en het niet is — en juist op die velden gaat straks
--   de hele analyse rusten.
--
--   C1 en 'C1 - 4 Reasons Why' worden twee rijen, niet één. Ze zijn
--   waarschijnlijk hetzelfde concept, maar waarschijnlijk is geen grond om twee
--   bedragen bij elkaar op te tellen. Wie het zeker weet kan ze samenvoegen;
--   omgekeerd is lastiger.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── De sleutel valt terug op de naam ───────────────────────────────────────
create or replace function marketing_hq.koppelsleutel(naam text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
           when coalesce(btrim(naam), '') = '' then null
           else coalesce(
                  marketing_hq.meta_naam_sleutel(naam),
                  -- Kleine letters en samengeknepen spaties: 'C1 - 4 Reasons Why'
                  -- en 'C1 -  4 reasons why' zijn dezelfde advertentie.
                  'naam:' || lower(regexp_replace(btrim(naam), '\s+', ' ', 'g'))
                )
         end;
$$;

comment on function marketing_hq.koppelsleutel(text) is
  'De sleutel waarop map en Meta elkaar vinden: het nummerpatroon als dat er is, anders de naam zelf. Zo koppelt ook een creative zonder nummer, zoals de C-reeks.';

revoke all on function marketing_hq.koppelsleutel(text) from public, anon;
grant execute on function marketing_hq.koppelsleutel(text) to authenticated;

-- ── creative_sleutel: nu ook rijen zonder nummer ───────────────────────────
create or replace view marketing_hq.creative_sleutel as
select
  c.id                                            as creative_id,
  c.brand,
  c.ad_name,
  marketing_hq.koppelsleutel(c.ad_name)           as sleutel,
  count(*)    over (partition by c.brand, marketing_hq.koppelsleutel(c.ad_name)) as delers,
  (c.id = min(c.id) over (partition by c.brand, marketing_hq.koppelsleutel(c.ad_name))) as draagt_meting,
  -- Achteraan, want `create or replace view` mag alleen kolommen toevoegen en
  -- niet invoegen. De volgorde uit 0043 blijft dus staan.
  (marketing_hq.meta_naam_sleutel(c.ad_name) is not null) as op_nummer
from public.creatives c
where c.ad_name is not null
  and marketing_hq.koppelsleutel(c.ad_name) is not null;

comment on view marketing_hq.creative_sleutel is
  'Elke creative met zijn sleutel, of die op een nummer of op de naam berust, hoeveel rijen die sleutel delen, en welke van hen de meting krijgt.';

-- ── ad_totals ──────────────────────────────────────────────────────────────
-- Nog steeds exact dezelfde achttien kolommen in dezelfde volgorde.
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
   and marketing_hq.koppelsleutel(i.entity_name) = s.sleutel
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
  'Optellen op de tellers, niet op de ratio''s. Twee wegen naar dezelfde creative: een publicatie die dit systeem zelf deed, of de advertentienaam voor alles van daarvoor. Publicatie wint, want die weet het zeker. Delen meerdere rijen één naam, dan draagt de oudste de meting.';

-- ── De koppeling zegt nu ook op welke weg ──────────────────────────────────
create or replace view marketing_hq.creative_meta_koppeling as
with ads as (
  select
    a.brand,
    marketing_hq.koppelsleutel(i.entity_name)     as sleutel,
    (marketing_hq.meta_naam_sleutel(i.entity_name) is not null) as op_nummer,
    i.entity_id,
    i.entity_name,
    sum(i.spend) as spend
  from marketing_hq.meta_insights_daily i
  join marketing_hq.meta_accounts a
    on a.account_id = i.account_id and a.actief
  where i.level = 'ad' and i.entity_name is not null
  group by 1, 2, 3, 4, 5
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
    when s.creative_id is null then 'geen creative met deze naam of dit nummer'
    when s.delers > 1          then 'gekoppeld, maar ' || s.delers || ' rijen delen deze naam'
    when ads.op_nummer         then 'gekoppeld op nummer'
    else                            'gekoppeld op naam'
  end                                    as toestand
from ads
left join marketing_hq.creative_sleutel s
  on s.brand = ads.brand and s.sleutel = ads.sleutel and s.draagt_meting;

comment on view marketing_hq.creative_meta_koppeling is
  'Elke gemeten Meta-advertentie met de creative waar hij aan hangt, of de reden waarom niet. Gekoppeld op een nummer is een afleiding; op een naam is een gelijkstelling — dat verschil staat erbij.';

-- ── creative_herkomst en map_dekking volgen dezelfde sleutel ───────────────
create or replace view marketing_hq.creative_herkomst as
with gekoppeld as (
  select
    s.creative_id,
    count(distinct i.entity_id)                       as advertenties,
    string_agg(distinct i.entity_name, ' · ' order by i.entity_name) as meta_namen,
    sum(i.spend)                                      as gemeten_spend
  from marketing_hq.creative_sleutel s
  join marketing_hq.meta_accounts a
    on a.brand = s.brand and a.actief
  join marketing_hq.meta_insights_daily i
    on i.level = 'ad'
   and i.account_id = a.account_id
   and marketing_hq.koppelsleutel(i.entity_name) = s.sleutel
  where s.draagt_meting
  group by s.creative_id
)
select
  c.id                                                as creative_id,
  c.brand,
  c.ad_name,
  s.sleutel,
  s.delers,
  s.draagt_meting,
  coalesce(g.advertenties, 0)                         as gekoppelde_advertenties,
  g.meta_namen,
  g.gemeten_spend,
  c.budget                                            as ingetypt_budget,
  c.cijfers_vastgezet,
  case
    when g.gemeten_spend is null or c.budget is null or c.budget = 0 then null
    else round(g.gemeten_spend / c.budget, 1)
  end                                                 as factor_op_ingetypt,
  case
    when s.sleutel is null
      then 'geen sleutel — deze rij heeft geen naam om op te koppelen'
    when not s.draagt_meting
      then 'deelt de naam ' || s.ad_name || ' met ' || (s.delers - 1)
           || ' andere rij(en); de meting staat op de oudste daarvan'
    when s.delers > 1
      then 'draagt de meting voor ' || s.delers || ' rijen met dezelfde naam'
    when coalesce(g.advertenties, 0) = 0
      then 'niet gemeten — geen advertentie met deze naam in het account'
    when c.cijfers_vastgezet
      then 'handmatig vastgezet; de meting van ' || coalesce(g.advertenties, 0)
           || ' advertentie(s) wordt bewust genegeerd'
    when c.budget is not null and c.budget > 0 and g.gemeten_spend > c.budget * 2
      then 'gemeten bedrag is ' || round(g.gemeten_spend / c.budget, 1)
           || '× wat er in de map stond — het sheet kende ' || (g.advertenties - 1)
           || ' van de ' || g.advertenties || ' advertentie(s) niet'
    else null
  end                                                 as randgeval
from public.creatives c
left join marketing_hq.creative_sleutel s on s.creative_id = c.id
left join gekoppeld g                     on g.creative_id = c.id;

comment on view marketing_hq.creative_herkomst is
  'Per creative: op hoeveel Meta-advertenties het cijfer rust, welke, hoe ver het van het ingetypte bedrag afstaat, en in één zin wat eraan mankeert. Null bij randgeval betekent: hier is niets bijzonders aan de hand.';

create or replace view marketing_hq.map_dekking as
with ads as (
  select
    a.brand,
    i.entity_id,
    max(i.entity_name)                                as entity_name,
    sum(i.spend)                                      as spend
  from marketing_hq.meta_insights_daily i
  join marketing_hq.meta_accounts a
    on a.account_id = i.account_id and a.actief
  where i.level = 'ad'
  group by a.brand, i.entity_id
),
geoordeeld as (
  select
    ads.brand,
    ads.spend,
    case when s.creative_id is null then 'buiten de map' else 'gekoppeld' end as toestand
  from ads
  left join marketing_hq.creative_sleutel s
    on s.brand = ads.brand
   and s.sleutel = marketing_hq.koppelsleutel(ads.entity_name)
   and s.draagt_meting
),
merken as (
  select distinct brand from marketing_hq.meta_accounts where actief
)
select
  m.brand,
  count(g.spend)                                                   as advertenties,
  round(coalesce(sum(g.spend), 0), 2)                              as spend_totaal,
  count(*) filter (where g.toestand = 'gekoppeld')                 as gekoppelde_advertenties,
  round(coalesce(sum(g.spend) filter (where g.toestand =  'gekoppeld'), 0), 2) as spend_in_de_map,
  round(coalesce(sum(g.spend) filter (where g.toestand <> 'gekoppeld'), 0), 2) as spend_buiten_de_map,
  case
    when coalesce(sum(g.spend), 0) > 0
      then round(coalesce(sum(g.spend) filter (where g.toestand = 'gekoppeld'), 0)
                 / sum(g.spend) * 100, 1)
  end                                                              as dekking_procent,
  case
    when count(g.spend) = 0 then 'nog niets gemeten op advertentieniveau'
    else 'gemeten'
  end                                                              as toestand
from merken m
left join geoordeeld g on g.brand = m.brand
group by m.brand;

comment on view marketing_hq.map_dekking is
  'Hoeveel van de werkelijke advertentie-uitgaven terugkomt in de Creative Strategy Map, per merk. Hoort geen 100% te zijn — catalogusadvertenties en bundels horen er niet in — maar hoort wel bekend te zijn.';

-- ── De zes rijen zelf ──────────────────────────────────────────────────────
-- bron_bestand vult twee rollen: het zegt eerlijk waar deze rijen vandaan komen
-- (uit het account, niet uit het sheet), en het is de uitzondering die de
-- testklaar-trigger uit 0030/0035 bij een INSERT laat passeren. Deze rijen
-- draaien immers al; ze hoeven niet meer testklaar gemaakt te worden.
insert into public.creatives
  (brand, ad_name, product, angle_type, status, date_live, bron_bestand, bron_status)
values
  ('wellshave', 'C1 - 4 Reasons Why', 'Groom Guard', 'Benefits-Driven',
   'Live', date '2026-07-12', 'meta-account', 'uit het advertentieaccount overgenomen'),
  ('wellshave', 'C2 - Before/After',  'Groom Guard', 'Transformation / Before-After',
   'Live', date '2026-07-12', 'meta-account', 'uit het advertentieaccount overgenomen'),
  ('wellshave', 'C3 - Social Proof',  'Groom Guard', 'Social Proof / Reviews',
   'Live', date '2026-07-12', 'meta-account', 'uit het advertentieaccount overgenomen'),
  -- Zonder achtervoegsel staat er geen angle in de naam, en dan vul ik er ook
  -- geen in. Vermoedelijk dezelfde concepten als hierboven; vermoedelijk is
  -- geen invulling.
  ('wellshave', 'C1', 'Groom Guard', null,
   'Live', date '2026-07-12', 'meta-account', 'uit het advertentieaccount overgenomen; angle onbekend'),
  ('wellshave', 'C2', 'Groom Guard', null,
   'Live', date '2026-07-12', 'meta-account', 'uit het advertentieaccount overgenomen; angle onbekend'),
  ('wellshave', 'C3', 'Groom Guard', null,
   'Live', date '2026-07-12', 'meta-account', 'uit het advertentieaccount overgenomen; angle onbekend')
on conflict do nothing;
