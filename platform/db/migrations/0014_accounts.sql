-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — Vijf accounts in plaats van één
--
-- Tot nu toe stond het advertentieaccount als één waarde in een Worker-secret:
-- `META_AD_ACCOUNT_ID`. Dat werkte zolang er één account was. Er zijn er vijf,
-- en de audit van 30 juli ging daardoor over 76% van één ervan.
--
-- Een secret is de verkeerde plek voor deze gegevens. Een secret is één waarde,
-- kent geen merk, geen valuta en geen "deze ligt stil sinds mei", en je kunt er
-- niet op joinen. Dus wordt het een tabel.
--
-- Wat er op 30 juli werkelijk gemeten is:
--
--   242238038391551  Wellshave®       € 3.425,92 / 30 dagen   draait
--   2776743939329385 Wellshine B.V.   € 1.207,74 / 30 dagen   draait
--   1301619051500441 Wellshine        geen spend / 30 dagen   stil
--   828830209039992  Wellshave Ads    leeg over 90 dagen      stil, geen betaalmethode
--   1681495425341768 (naamloos)       leeg over 90 dagen      stil, geen betaalmethode
--
-- De drie stille accounts worden niet weggelaten maar vastgelegd mét de reden.
-- Een account dat ontbreekt is een vraag ("zijn we er een vergeten?"); een
-- account dat er staat met 'stil sinds' erbij is een antwoord.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De accounts ─────────────────────────────────────────────────────────
-- `merk` is de sleutel die dit aan de rest van het systeem knoopt: creatives,
-- werkstukken en publicaties dragen al een `brand`. Hiermee weet het systeem
-- naar welk account een creative van merk wellshine hoort te gaan.
create table if not exists marketing_hq.ad_accounts (
  account_id     text primary key,
  naam           text not null,
  merk           text not null,
  business_naam  text,
  valuta         text not null default 'EUR',
  actief         boolean not null default true,
  primair        boolean not null default false,
  betaalmethode  boolean not null default true,
  reden          text,
  created_at     timestamptz not null default now(),
  -- Een account dat uitstaat hoort te zeggen waarom. Zonder die regel wordt
  -- 'actief = false' na een maand een raadsel in plaats van een besluit.
  constraint ad_accounts_stil_met_reden
    check (actief or (reden is not null and length(trim(reden)) > 0))
);

comment on table marketing_hq.ad_accounts is
  'De advertentieaccounts, met merk en of ze draaien. Vervangt META_AD_ACCOUNT_ID als bron van waarheid.';
comment on column marketing_hq.ad_accounts.primair is
  'Waar het geld en de aandacht zitten. Bepaalt de volgorde, niet of er gemeten wordt.';
comment on column marketing_hq.ad_accounts.reden is
  'Verplicht zodra actief = false. Waarom staat dit account stil.';

insert into marketing_hq.ad_accounts
  (account_id, naam, merk, business_naam, actief, primair, betaalmethode, reden)
values
  ('242238038391551',  'Wellshave®',     'wellshave', 'Wellshave B.V.', true,  true,  true,  null),
  ('2776743939329385', 'Wellshine B.V.', 'wellshine', 'Wellshine',      true,  true,  true,  null),
  ('1301619051500441', 'Wellshine',      'wellshine', 'Wellshave B.V.', false, false, true,
     'geen spend in de laatste 30 dagen, gemeten 30 juli 2026; account bestaat wel en heeft een betaalmethode'),
  ('828830209039992',  'Wellshave Ads',  'wellshave', 'Wellshave',      false, false, false,
     'leeg over 90 dagen en geen betaalmethode, gemeten 30 juli 2026'),
  ('1681495425341768', 'Naamloos account','wellshave', null,            false, false, false,
     'leeg over 90 dagen, geen naam, geen business en geen betaalmethode, gemeten 30 juli 2026')
on conflict (account_id) do nothing;

alter table marketing_hq.ad_accounts enable row level security;
do $$ begin
  create policy accounts_lezen on marketing_hq.ad_accounts
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

-- ── 2. Een rapport hoort bij een account ───────────────────────────────────
-- Een audit gaat over één account. Zonder dit veld staan twee audits van
-- dezelfde dag naast elkaar zonder dat je ziet welke waarover ging — en de
-- unieke sleutel op reports (report_date, kind, title) zou er zelfs één van
-- overschrijven.
alter table marketing_hq.reports
  add column if not exists account_id text references marketing_hq.ad_accounts(account_id);

comment on column marketing_hq.reports.account_id is
  'Bij een audit verplicht in de praktijk: zonder dit is niet te zien waarover het rapport ging.';

-- ── 3. Dekking per account ─────────────────────────────────────────────────
-- `meting_dekking` uit 0012 ging uit van één account. Met twee draaiende
-- accounts gaf hij één rij per dag per account waar data was, en één rij met
-- een lege account_id waar niets was — waardoor een gat bij Wellshine niet van
-- een gat bij Wellshave te onderscheiden was.
--
-- Nu: elke actieve account maal elke dag. Een ontbrekende dag is daarmee een
-- ontbrekende dag vóór een bepaald account, en dat is de vraag die je stelt.
create or replace view marketing_hq.meting_dekking as
with dagen as (
  select generate_series(current_date - 30, current_date - 1, interval '1 day')::date as dag
),
verwacht as (
  select d.dag, a.account_id
  from dagen d
  cross join marketing_hq.ad_accounts a
  where a.actief
),
gemeten as (
  select insight_date, account_id,
         count(*)           as rijen,
         sum(spend)         as spend,
         bool_and(is_final) as definitief
  from marketing_hq.meta_insights_daily
  where level = 'account'
  group by insight_date, account_id
)
select
  v.dag,
  v.account_id,
  coalesce(g.rijen, 0)                                as rijen,
  g.spend,
  (g.insight_date is not null)                        as gemeten,
  coalesce(g.definitief, false)                       as definitief,
  (v.dag > current_date - 3)                          as loopt_nog_na,
  case
    when g.insight_date is null              then 'ontbreekt'
    when v.dag > current_date - 3            then 'voorlopig'
    when not coalesce(g.definitief, false)   then 'niet afgesloten'
    else 'compleet'
  end                                                 as staat
from verwacht v
left join gemeten g on g.insight_date = v.dag and g.account_id = v.account_id;

comment on view marketing_hq.meting_dekking is
  'Per actief account per dag van de laatste 30: is er gemeten, is het definitief, of ontbreekt het.';

-- ── 4. Het beeld over alle accounts heen ───────────────────────────────────
-- Optellen mag hier alleen op de tellers, en alleen binnen dezelfde valuta.
-- Alle vijf staan in EUR; zodra daar een account bijkomt dat dat niet doet,
-- moet deze view eerst omgerekend worden en niet stilzwijgend doortellen.
create or replace view marketing_hq.accounts_overzicht as
with dertig as (
  select account_id,
         sum(spend)          as spend,
         sum(impressions)    as impressions,
         sum(purchases)      as aankopen,
         sum(purchase_value) as omzet,
         max(insight_date)   as laatste_dag
  from marketing_hq.meta_insights_daily
  where level = 'account' and insight_date >= current_date - 30
  group by account_id
)
select
  a.account_id, a.naam, a.merk, a.valuta,
  a.actief, a.primair, a.betaalmethode, a.reden,
  coalesce(d.spend, 0)                                as spend_30d,
  d.impressions                                       as impressions_30d,
  d.aankopen                                          as aankopen_30d,
  d.omzet                                             as omzet_30d,
  case when d.spend > 0 then round(d.omzet / d.spend, 3) end as roas_30d,
  d.laatste_dag,
  case
    when not a.actief                     then 'staat uit'
    when d.laatste_dag is null            then 'actief, maar nog nooit opgehaald'
    when d.laatste_dag < current_date - 3 then 'actief, maar al ' ||
                                               (current_date - d.laatste_dag) || ' dagen niets opgehaald'
    else 'bijgewerkt'
  end                                                 as staat
from marketing_hq.ad_accounts a
left join dertig d on d.account_id = a.account_id
order by a.primair desc, coalesce(d.spend, 0) desc;

comment on view marketing_hq.accounts_overzicht is
  'Alle accounts naast elkaar, met of ze bijgewerkt zijn. Stilte is hier een uitkomst, geen leegte.';

-- ── Toegang ────────────────────────────────────────────────────────────────
create or replace view public.hq_ad_accounts with (security_invoker = true)
  as select * from marketing_hq.ad_accounts;
create or replace view public.hq_accounts_overzicht with (security_invoker = true)
  as select * from marketing_hq.accounts_overzicht;

revoke all on public.hq_ad_accounts, public.hq_accounts_overzicht from anon, public;
grant select on public.hq_ad_accounts, public.hq_accounts_overzicht to authenticated;

-- ── De afspraak aangepast ──────────────────────────────────────────────────
-- Eén audit per draaiend account, niet één audit.
update marketing_hq.agent_afspraken
   set levert = 'Eén audit per draaiend account: trechter met afhaakpunten, publiek per segment, en een scorekaart op twee signalen.',
       lat    = 'Per actief account een rij in reports met kind=audit en account_id gevuld, het afhaakpunt benoemd, en per advertentie een oordeel of de reden waarom er geen is.'
 where agent_id = 'atlas' and kind = 'account_audit';

-- ═══════════════════════════════════════════════════════════════════════════
-- Terugdraaien
--
--   drop view if exists public.hq_accounts_overzicht;
--   drop view if exists public.hq_ad_accounts;
--   drop view if exists marketing_hq.accounts_overzicht;
--   alter table marketing_hq.reports drop column if exists account_id;
--   drop table if exists marketing_hq.ad_accounts;
--   -- meting_dekking daarna terugzetten uit 0012
-- ═══════════════════════════════════════════════════════════════════════════
