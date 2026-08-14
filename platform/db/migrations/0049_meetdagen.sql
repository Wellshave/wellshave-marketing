-- ═══════════════════════════════════════════════════════════════════════════
-- 0049 — Een dag die je niet kunt narekenen, is een dag die je niet hebt
--
-- Beslisvraag:
--
--     "De tracker toont cijfers. Zijn dat álle cijfers?"
--
-- Wat er misging, en waarom niemand het zag
--
--   Een export uit het advertentieaccount over de laatste 365 dagen telde
--   € 96.839. De database kende er € 33.702 van — 35%. Niet doordat er iets
--   fout gerekend werd: advertenties die volledig binnen een gemeten periode
--   liepen kwamen tot op de cent overeen (WS - 193 - 1 op € 613,15, WS - 208 - 3
--   op € 151,94, twee andere exact gelijk). De koppeling uit 0042 t/m 0046 doet
--   precies wat hij belooft.
--
--   Het probleem zat vóór de berekening: 177 van de 366 dagen waren nooit
--   opgehaald. En niet verspreid — in blokken. Eén aaneengesloten gat van
--   6 oktober 2025 tot 2 februari 2026, 120 dagen, met Black Friday, december
--   en januari erin. Een tweede van 49 dagen.
--
--   Dat is de gevaarlijkste storing die dit systeem kan hebben, en 0044 heeft
--   hem bijna gevangen: "een dekkingspercentage van 100% dat is bereikt door de
--   noemer te verkleinen is een leugen die zichzelf bevestigt." Klopt — maar
--   map_dekking bewaakte alleen het wegfilteren ná binnenkomst. De noemer zelf
--   was óók te klein, en daar keek niets naar. 86% dekking van een derde van
--   het geld leest precies zoals 86% van alles.
--
-- De controle die er niet was, en wel kon
--
--   Meta levert dezelfde dag op vier niveaus. Op accountniveau is één dag één
--   rij; op advertentieniveau tientallen. Die twee horen op te tellen tot
--   hetzelfde bedrag. Dat is geen aanname maar een boekhoudkundige identiteit:
--   elke euro die het account uitgeeft, geeft een advertentie uit.
--
--   Nagemeten op de dagen waar we allebei hebben: negen van de elf sluiten tot
--   op de cent. De andere twee wijken af, en dat is precies wat je wilt zien.
--
--   Daarmee is er eindelijk een noemer die niet van onszelf komt. Een dag zonder
--   accountrij is een dag die nooit is opgehaald; een dag waarvan de twee kanten
--   niet sluiten is een dag die je niet mag optellen.
--
-- Waarom de dagen en niet het bedrag
--
--   Er is geen manier om uit de database af te leiden hoeveel er in oktober is
--   uitgegeven als oktober er niet in staat. Wat wél kan is tellen hoeveel dagen
--   ontbreken, en waar ze liggen. "177 van de 366 dagen ontbreken, het grootste
--   gat loopt van 6 oktober tot 2 februari" is een zin waar iemand naar handelt;
--   "de dekking is 86%" is dat niet.
--
-- De tweede fout: een periodetotaal in de dagtabel
--
--   Op 12 juli 2026 stond € 2.180,10 over 96 advertenties, elf keer een normale
--   dag. Die rijen kwamen uit een run van 10 augustus 06:31 terwijl alle
--   omliggende dagen van 11 augustus 18:22 waren. Oorzaak: `breakdown_by_day`
--   stond standaard uit, en zonder time_increment geeft Meta één rij per
--   entiteit voor de hele periode met date_start op de eerste dag. Die rij ging
--   gewoon de dagtabel in.
--
--   Dat is gerepareerd in de worker (versie 14: per dag is de standaard, en
--   zonder uitsplitsing wordt er niets weggeschreven) en de rijen zijn
--   verplaatst naar marketing_hq.meta_insights_periodetotalen_20260812.
--
--   Maar een reparatie in de worker is een belofte, en dit bestand maakt er een
--   controle van: een periodetotaal valt in meta_meetdag op als een dag waarvan
--   de kanten niet sluiten. Ook als het over drie maanden opnieuw gebeurt, met
--   een andere oorzaak.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Sluit deze dag ──────────────────────────────────────────────────────
-- De twee kanten van dezelfde dag naast elkaar. Meta corrigeert tot ongeveer
-- 72 uur terug, dus een verse dag mag afwijken zonder dat er iets mis is --
-- die krijgt 'nog voorlopig' en geen oordeel. Zou je hem wel beoordelen, dan
-- staat er elke ochtend een waarschuwing die niets betekent, en dan leest
-- niemand de waarschuwing die wél iets betekent.
create or replace view marketing_hq.meta_meetdag as
with ad as (
  select account_id, insight_date,
         sum(spend)              as spend,
         count(distinct entity_id) as advertenties,
         max(captured_at)        as opgehaald
  from marketing_hq.meta_insights_daily
  where level = 'ad'
  group by account_id, insight_date
),
acc as (
  select account_id, insight_date,
         sum(spend)       as spend,
         max(captured_at) as opgehaald
  from marketing_hq.meta_insights_daily
  where level = 'account'
  group by account_id, insight_date
),
samen as (
  select
    coalesce(ad.account_id, acc.account_id)     as account_id,
    coalesce(ad.insight_date, acc.insight_date) as insight_date,
    acc.spend                                   as spend_account,
    ad.spend                                    as spend_advertenties,
    coalesce(ad.advertenties, 0)                as advertenties,
    greatest(ad.opgehaald, acc.opgehaald)       as opgehaald
  from ad
  full outer join acc
    on acc.account_id = ad.account_id and acc.insight_date = ad.insight_date
)
select
  s.account_id,
  a.brand,
  s.insight_date,
  round(s.spend_account, 2)                     as spend_account,
  round(s.spend_advertenties, 2)                as spend_advertenties,
  s.advertenties,
  round(s.spend_advertenties - s.spend_account, 2) as verschil,
  s.opgehaald,

  /* Eén procent van het accountbedrag, met een bodem van een euro. Kleiner en
     je vangt afrondingsruis; groter en een halve dag verdwijnt in de marge. */
  case
    when s.insight_date > current_date - 3 then 'nog voorlopig'
    when s.spend_account is null           then 'geen accountcijfer'
    when s.spend_advertenties is null      then 'geen advertentiecijfers'
    when abs(s.spend_advertenties - s.spend_account)
         <= greatest(1, s.spend_account * 0.01) then 'sluit'
    else 'wijkt af'
  end                                           as toestand,

  case
    when s.insight_date > current_date - 3
      then 'Meta corrigeert nog tot ongeveer 72 uur terug'
    when s.spend_account is null
      then 'er is geen accountcijfer voor deze dag, dus de som van de advertenties is nergens tegen te houden'
    when s.spend_advertenties is null
      then 'het account gaf deze dag geld uit maar er staat geen enkele advertentie bij'
    when abs(s.spend_advertenties - s.spend_account)
         > greatest(1, s.spend_account * 0.01)
      then 'de advertenties tellen op tot ' || round(s.spend_advertenties, 2)
           || ' terwijl het account ' || round(s.spend_account, 2)
           || ' zegt — deze dag is onvolledig of bevat een periodetotaal'
  end                                           as toelichting
from samen s
left join marketing_hq.meta_accounts a on a.account_id = s.account_id;

comment on view marketing_hq.meta_meetdag is
  'Per account en per dag: wat het account zegt tegenover de som van de advertenties. Elke euro die een account uitgeeft geeft een advertentie uit, dus die twee horen gelijk te zijn. Een dag die niet sluit is een dag die je niet mag optellen.';

-- ── 2. Welke dagen ontbreken, en waar ze liggen ────────────────────────────
-- Losse ontbrekende dagen zijn onleesbaar: 177 regels zegt niets. Aaneengesloten
-- blokken wél, want dat is precies de vorm waarin je ze opnieuw ophaalt.
--
-- Het venster loopt van de eerste dag die ooit gemeten is tot gisteren. Verder
-- terug kan niet: over een periode waarin nooit iets is opgehaald weet dit
-- systeem niet of er niets was of niets is gevraagd, en dat verschil verzinnen
-- zou de hele view waardeloos maken.
create or replace view marketing_hq.meta_meetgaten as
with grenzen as (
  select a.account_id, a.brand,
         min(i.insight_date) as eerste,
         current_date - 1    as laatste
  from marketing_hq.meta_accounts a
  join marketing_hq.meta_insights_daily i
    on i.account_id = a.account_id and i.level = 'ad'
  where a.actief
  group by a.account_id, a.brand
),
kalender as (
  select g.account_id, g.brand,
         generate_series(g.eerste, g.laatste, interval '1 day')::date as dag
  from grenzen g
),
gemeten as (
  select distinct account_id, insight_date from marketing_hq.meta_insights_daily where level = 'ad'
),
leeg as (
  select k.account_id, k.brand, k.dag
  from kalender k
  left join gemeten m on m.account_id = k.account_id and m.insight_date = k.dag
  where m.insight_date is null
),
blok as (
  select account_id, brand, dag,
         dag - (row_number() over (partition by account_id order by dag))::int as bucket
  from leeg
)
select
  account_id,
  brand,
  min(dag)   as van,
  max(dag)   as tot,
  count(*)::int as dagen
from blok
group by account_id, brand, bucket;

comment on view marketing_hq.meta_meetgaten is
  'Aaneengesloten reeksen dagen zonder enige meting op advertentieniveau, per account. In blokken en niet per dag, want een blok is de vorm waarin je het opnieuw ophaalt.';

-- ── 3. Eén regel per merk: hoe compleet is de meting ───────────────────────
create or replace view marketing_hq.meta_meetdekking as
with grenzen as (
  select a.brand,
         min(i.insight_date) as eerste,
         current_date - 1    as laatste
  from marketing_hq.meta_accounts a
  join marketing_hq.meta_insights_daily i
    on i.account_id = a.account_id and i.level = 'ad'
  where a.actief
  group by a.brand
),
dagen as (
  select g.brand,
         (g.laatste - g.eerste + 1)                                   as in_venster,
         (select count(distinct i.insight_date)
            from marketing_hq.meta_insights_daily i
            join marketing_hq.meta_accounts a2
              on a2.account_id = i.account_id and a2.brand = g.brand and a2.actief
           where i.level = 'ad'
             and i.insight_date between g.eerste and g.laatste)::int   as gemeten,
         g.eerste, g.laatste
  from grenzen g
),
sluiting as (
  select brand,
         count(*) filter (where toestand = 'sluit')                    as dagen_sluitend,
         count(*) filter (where toestand = 'wijkt af')                 as dagen_afwijkend,
         count(*) filter (where toestand = 'geen accountcijfer')       as dagen_onverifieerbaar
  from marketing_hq.meta_meetdag
  group by brand
),
grootste as (
  select brand, max(dagen) as grootste_gat
  from marketing_hq.meta_meetgaten group by brand
),
merken as (select distinct brand from marketing_hq.meta_accounts where actief)
select
  m.brand,
  d.eerste                                        as vanaf,
  d.laatste                                       as tot,
  d.in_venster::int                               as dagen_in_venster,
  coalesce(d.gemeten, 0)                          as dagen_gemeten,
  (d.in_venster - coalesce(d.gemeten, 0))::int    as dagen_ontbreken,
  coalesce(g.grootste_gat, 0)                     as grootste_gat_dagen,
  coalesce(s.dagen_sluitend, 0)                   as dagen_sluitend,
  coalesce(s.dagen_afwijkend, 0)                  as dagen_afwijkend,
  coalesce(s.dagen_onverifieerbaar, 0)            as dagen_onverifieerbaar,
  case when d.in_venster > 0
       then round(coalesce(d.gemeten, 0)::numeric / d.in_venster * 100, 1) end as dagen_procent,
  case
    when d.in_venster is null                       then 'nog nooit iets gemeten'
    when d.in_venster - coalesce(d.gemeten, 0) = 0  then 'elke dag in het venster is gemeten'
    else (d.in_venster - coalesce(d.gemeten, 0))
         || ' van de ' || d.in_venster || ' dagen ontbreken; grootste gat '
         || coalesce(g.grootste_gat, 0) || ' dagen'
  end                                             as toestand
from merken m
left join dagen d    on d.brand = m.brand
left join sluiting s on s.brand = m.brand
left join grootste g on g.brand = m.brand;

comment on view marketing_hq.meta_meetdekking is
  'Per merk hoe compleet de meting is, in dagen. Dagen en niet euros: wat er in een niet-opgehaalde maand is uitgegeven staat nergens, maar dát hij ontbreekt is exact te tellen.';

-- ── 4. map_dekking zegt er voortaan bij waar hij op rust ───────────────────
-- De bestaande kolommen blijven staan en betekenen hetzelfde, want de console
-- en de testlus hangen eraan. Wat erbij komt is de waarschuwing die ontbrak:
-- dit percentage gaat over de dagen die we hébben.
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
  end                                                              as toestand,

  /* Nieuw in 0049. Zonder deze twee leest 86% van een derde van het geld
     precies zoals 86% van alles. */
  d.dagen_ontbreken,
  case
    when d.dagen_ontbreken is null or d.dagen_ontbreken = 0
      then 'dekking over een volledig gemeten periode'
    else 'let op: ' || d.dagen_ontbreken || ' van de ' || d.dagen_in_venster
         || ' dagen zijn nooit opgehaald — dit percentage gaat alleen over de dagen die er zijn'
  end                                                              as volledigheid
from merken m
left join geoordeeld g on g.brand = m.brand
left join marketing_hq.meta_meetdekking d on d.brand = m.brand
group by m.brand, d.dagen_ontbreken, d.dagen_in_venster;

comment on view marketing_hq.map_dekking is
  'Hoeveel van de gemeten advertentie-uitgaven terugkomt in de Creative Strategy Map, per merk. Let op de kolom volledigheid: het percentage gaat over de dagen die zijn opgehaald, niet over de hele periode.';

-- ── Rechten ────────────────────────────────────────────────────────────────
grant select on marketing_hq.meta_meetdag      to authenticated;
grant select on marketing_hq.meta_meetgaten    to authenticated;
grant select on marketing_hq.meta_meetdekking  to authenticated;

create or replace view public.hq_meta_meetdag
with (security_invoker = true) as
select * from marketing_hq.meta_meetdag;

create or replace view public.hq_meta_meetgaten
with (security_invoker = true) as
select * from marketing_hq.meta_meetgaten;

create or replace view public.hq_meta_meetdekking
with (security_invoker = true) as
select * from marketing_hq.meta_meetdekking;

grant select on public.hq_meta_meetdag     to authenticated;
grant select on public.hq_meta_meetgaten   to authenticated;
grant select on public.hq_meta_meetdekking to authenticated;

/* hq_map_dekking legt zijn kolomlijst vast op het moment dat hij gemaakt wordt.
   Zonder deze regel bestaan `dagen_ontbreken` en `volledigheid` wél in
   marketing_hq en niet in de view waar de console uit leest -- en dan staat de
   waarschuwing precies op de plek waar niemand kijkt. */
create or replace view public.hq_map_dekking
with (security_invoker = true) as
select * from marketing_hq.map_dekking;

grant select on public.hq_map_dekking to authenticated;

-- ── Terugdraaien ──────────────────────────────────────────────────────────
-- drop view if exists public.hq_meta_meetdekking, public.hq_meta_meetgaten,
--   public.hq_meta_meetdag;
-- drop view if exists marketing_hq.meta_meetdekking, marketing_hq.meta_meetgaten,
--   marketing_hq.meta_meetdag;
-- map_dekking terug naar de versie uit 0046 (de twee kolommen achteraan vervallen).
