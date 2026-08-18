-- ═══════════════════════════════════════════════════════════════════════════
-- 0044 — De rand van de meting, per creative en over het geheel
--
-- Beslisvraag:
--
--     "Dit getal staat op mijn scherm. Waar rust het op, en wat weet dit
--      systeem níét?"
--
-- Waarom dit een eigen laag is
--
--   0038 gaf al `cijfers_bron`: handmatig-vast, meta, handmatig of geen. Dat
--   zegt wáár een cijfer vandaan komt. Het zegt niet waar het op rust, en dat
--   is bij een naamkoppeling een ander verhaal dan bij een publicatie.
--
--   Een creative kan aan vier Meta-advertenties hangen of aan één. Hij kan
--   zijn naam delen met twee andere rijen. Hij kan helemaal geen advertentie
--   in Meta hebben. En het gemeten bedrag kan een veelvoud zijn van wat er
--   ooit is ingetypt — bij 061-3 achttien keer zoveel. Dat zijn vier heel
--   verschillende situaties die er op het scherm allemaal hetzelfde uitzien:
--   een getal.
--
--   Zolang dat zo is, is elke conclusie over persona's en angles een gok met
--   een decimaal erachter.
--
-- De twee kanten van de rand
--
--   creative_herkomst kijkt vanuit de map naar buiten: wat weet ik van deze
--   rij, en wat mankeert eraan.
--
--   map_dekking kijkt van buiten naar de map: hoeveel van het geld dat Meta
--   werkelijk heeft uitgegeven, komt terug in de map. Dat getal hoort niet
--   100% te zijn — er draaien catalogusadvertenties en FLEX-bundels die geen
--   creative uit de map zijn — maar het hoort wél bekend te zijn. Een map die
--   80% van de uitgaven dekt is bruikbaar; eentje die 20% dekt beschrijft een
--   ander bedrijf dan waar het geld heen ging, en dat mag niet stil blijven.
--
-- Waarom "onbekend" hier een uitkomst is en geen fout
--
--   De verleiding is om alles wat niet koppelt weg te filteren. Dan ziet de
--   map er compleet uit. Maar de rijen die niet koppelen zijn precies de rijen
--   waar iemand naar moet kijken, en een dekkingspercentage van 100% dat is
--   bereikt door de noemer te verkleinen is een leugen die zichzelf bevestigt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Per creative: waar rust dit cijfer op ──────────────────────────────────
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
   and marketing_hq.meta_naam_sleutel(i.entity_name) = s.sleutel
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

  -- Hoe ver het gemeten bedrag afstaat van wat er ooit is ingetypt. Bij 061-3
  -- is dit 18: de map kende één van de vier advertenties.
  case
    when g.gemeten_spend is null or c.budget is null or c.budget = 0 then null
    else round(g.gemeten_spend / c.budget, 1)
  end                                                 as factor_op_ingetypt,

  /* Eén regel die zegt wat er aan de hand is, of niets als er niets aan de
     hand is. Volgorde is bewust: het ergste eerst, want er kan meer dan één
     ding tegelijk spelen en dan is het bovenste wat je moet weten. */
  case
    when s.sleutel is null
      then 'geen sleutel — deze naam is niet te herleiden tot een advertentie'
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

-- ── Over het geheel: hoeveel van het geld komt terug in de map ─────────────
-- De noemer is álle ad-spend in het account, niet alleen wat toevallig
-- koppelt. Anders meet je je eigen filter.
--
-- Er staat een merk in deze lijst ook als er níéts van gemeten is. Een `group
-- by` over nul rijen geeft nul rijen, en een scherm dat nul rijen krijgt toont
-- niets -- wat er precies zo uitziet als een kapotte view. Het verschil tussen
-- "er is niets gemeten" en "er is iets mis" hoort in de data te zitten en niet
-- in de aanname van degene die kijkt. Dat is dezelfde fout als in 0041, waar
-- 'werkt' niet hetzelfde bleek als 'meet'.
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
    case
      when marketing_hq.meta_naam_sleutel(ads.entity_name) is null
        then 'naam niet te ontleden'
      when s.creative_id is null
        then 'geen creative met deze sleutel'
      else 'gekoppeld'
    end as toestand
  from ads
  left join marketing_hq.creative_sleutel s
    on s.brand = ads.brand
   and s.sleutel = marketing_hq.meta_naam_sleutel(ads.entity_name)
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
  /* Zonder dit veld moet het scherm uit "0 advertenties" afleiden wat er aan de
     hand is, en dat is precies de gok die 0041 wegnam. */
  case
    when count(g.spend) = 0 then 'nog niets gemeten op advertentieniveau'
    else 'gemeten'
  end                                                              as toestand
from merken m
left join geoordeeld g on g.brand = m.brand
group by m.brand;

comment on view marketing_hq.map_dekking is
  'Hoeveel van de werkelijke advertentie-uitgaven terugkomt in de Creative Strategy Map, per merk. Hoort geen 100% te zijn — catalogusadvertenties en bundels horen er niet in — maar hoort wel bekend te zijn.';

-- ── Rechten ────────────────────────────────────────────────────────────────
grant select on marketing_hq.creative_herkomst to authenticated;
grant select on marketing_hq.map_dekking       to authenticated;

create or replace view public.hq_creative_herkomst
with (security_invoker = true) as
select * from marketing_hq.creative_herkomst;

create or replace view public.hq_map_dekking
with (security_invoker = true) as
select * from marketing_hq.map_dekking;

grant select on public.hq_creative_herkomst to authenticated;
grant select on public.hq_map_dekking       to authenticated;
