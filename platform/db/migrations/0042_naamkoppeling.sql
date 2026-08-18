-- ═══════════════════════════════════════════════════════════════════════════
-- 0042 — De map aan Meta knopen op naam
--
-- Beslisvraag:
--
--     "Er staat 474 keer een ROAS van 0,00 in de map. Zijn dat mislukkingen,
--      of cijfers die nooit zijn opgehaald?"
--
-- Het antwoord, nagemeten
--
--   Grotendeels het tweede. De map telt € 13.981 aan budget over 624 rijen.
--   Alleen de top 25 campagnes in het Wellshave-account draaiden in diezelfde
--   periode ruim € 58.000. 367 rijen hebben helemaal geen budget.
--
--   De naamgeving in Meta bleek te matchen tot op de eurocent:
--
--     map 034-1  budget 255,28   Meta `WS-034 - 1`      € 255,28
--     map 061-3  budget 567,29   Meta `WS-061 - 3`      € 567,29
--     map 058-3  budget 394,02   Meta `WS - 058 - 3`    € 394,02
--     map 027-2  budget 316,98   Meta `027 - 2`         € 316,98
--     map 083-1  budget 281,53   Meta `WS-083 - 1`      € 281,53
--     map 066-1  budget 197,01   Meta `WS - 066 - 1`    € 197,01
--
--   Zes exacte treffers is geen toeval. Maar juist doordat ze kloppen, is te
--   zien wát er ontbreekt: het sheet nam alleen de basisadvertentie mee.
--   Creative 061-3 draaide óók als `WS-061 - 3 - ASC+`, en daar ging
--   € 9.473,42 doorheen — de grootste post van het account. De map kende 6%
--   van die creative.
--
-- Waarom dit een naamkoppeling wordt en geen publicatiekoppeling
--
--   ad_totals hangt sinds 0008 aan meta_publications.meta_ad_id. Dat werkt
--   voor advertenties die dit systeem zelf publiceert. Er staan er nul. Alle
--   624 historische rijen zijn met de hand in Meta gezet, lang voor dit
--   systeem bestond, en de enige draad die ze aan de map bindt is hun naam.
--
--   Deze migratie legt die draad. Dezelfde functie ontleedt beide kanten:
--   `WS - 103 - 2 - Copy 2` en `103-2` komen allebei uit op de sleutel '103:2'.
--
-- Wat er per creative opgeteld wordt
--
--   Alles wat op dezelfde sleutel uitkomt. Een creative die als losse ad, als
--   ASC+, als ABO en als twee kopieën draaide, telt als één regel met de som
--   van de vijf. Dat is de vraag die een strategy map hoort te beantwoorden:
--   werkt deze persona, deze angle, dit bewustzijnsniveau — niet: werkte deze
--   ene plaatsing.
--
-- De valkuil die is afgevangen
--
--   Meta heeft naast de gewone reeks een BFCM- en een C-reeks met eigen
--   nummering die botst met de map. `WS - BFCM - 002 - 2` is niet map-rij
--   002-2: die ging live op 6 augustus met € 18, de BFCM-advertentie is
--   aangemaakt op 13 november met € 691. De reeks zit daarom ín de sleutel
--   ('BFCM:2:2' ≠ '2:2'), zodat ze elkaar nooit kunnen raken. De map kent geen
--   reeksmarkering en matcht dus alleen op de gewone reeks.
--
--   Namen waar geen creative bij hoort blijven gewoon onopgelost. Dat is
--   zichtbaar in creative_meta_koppeling in plaats van stil weggelaten.
--
-- En één bug die op scherp stond
--
--   sync_creative_results() overschrijft budget, roas en de rest rechtstreeks
--   in public.creatives — zonder naar cijfers_vastgezet te kijken. Zolang er
--   geen ad-niveau data was, viel dat niemand op. Vanaf het moment dat die
--   data binnenkomt zou die functie precies de cijfers wissen die een mens in
--   0038 heeft vastgezet om een meetfout te corrigeren. Dat is de garantie die
--   0038 gaf. Hij wordt hier hersteld.
--
-- Wat deze migratie NIET doet
--
--   Niets overschrijven. De ingetypte cijfers uit het sheet blijven staan in
--   public.creatives. creative_kaart kiest sinds 0038 al gemeten boven
--   ingetypt, en vastgezet boven allebei. Zodra er ad-rijen binnenkomen licht
--   de map dus vanzelf op, en blijft het handwerk van het team bewaard.
--
--   ad_totals houdt exact dezelfde achttien kolommen in dezelfde volgorde.
--   Alleen de inhoud groeit. Daardoor hoeft creative_results — en alles wat
--   daaraan hangt, van creative_kaart tot de tracker — niet aangeraakt te
--   worden.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Welk account hoort bij welk merk ───────────────────────────────────────
-- De map heeft een brand-kolom en de tabs in de tracker volgen die. Zonder
-- deze tabel zou een Wellshine-advertentie met nummer 034 kunnen aanschuiven
-- bij Wellshave's creative 034 — precies dezelfde botsing als BFCM, maar dan
-- tussen twee merken.
create table if not exists marketing_hq.meta_accounts (
  account_id text primary key,
  brand      text not null,
  naam       text,
  actief     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table marketing_hq.meta_accounts is
  'Welk Meta ad-account bij welk merk hoort. Bepaalt in welke tab van de tracker de cijfers landen, en voorkomt dat gelijke nummers uit twee merken elkaar raken.';

insert into marketing_hq.meta_accounts (account_id, brand, naam) values
  ('242238038391551',  'wellshave', 'Wellshave®'),
  ('2776743939329385', 'wellshine', 'Wellshine B.V.'),
  ('1301619051500441', 'wellshine', 'Wellshine')
on conflict (account_id) do nothing;

-- ── De vertaler ────────────────────────────────────────────────────────────
-- Eén functie voor beide kanten. Wat er in Meta staat en wat er in de map
-- staat moet op dezelfde sleutel uitkomen, anders koppelt er niets — en dan
-- is één functie de enige manier om te weten dat ze het eens zijn.
--
-- Vorm van de sleutel: 'nummer:variant', met de reeks ervoor als die er is.
--   `WS-061 - 3 - ASC+`      → '61:3'
--   `061-3`                  → '61:3'
--   `WS - BFCM  - 034 - 1`   → 'BFCM:34:1'
--
-- Wat bewust géén sleutel krijgt:
--   `@WS052 -> FLEX (4 Videos) Herfst`   een bundel van vier video's, geen
--                                        losse creative
--   `WS - BFCM - 045 & 046 - FLEX`       twee nummers in één advertentie
--   `@WS046 -> 3`                        de pijl betekent hier iets anders dan
--                                        een variantnummer; liever niets dan
--                                        een gok
--   `Catalog Ads -> 2`                   geen creative uit de map
create or replace function marketing_hq.meta_naam_sleutel(naam text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
           when m is null then null
           else concat_ws(':', nullif(upper(coalesce(m[1], '')), ''), m[2]::int::text, m[3])
         end
  from (
    select regexp_match(
             -- Halve kastlijn en kastlijn komen allebei voor in de accountnamen.
             translate(coalesce(naam, ''), '–—', '--'),
             '^\s*@?\s*(?:WS)?\s*-?\s*(?:(BFCM|C)\s*-\s*)?([0-9]{1,3})\s*-\s*([0-9])(?![0-9])',
             'i'
           ) as m
  ) s;
$$;

comment on function marketing_hq.meta_naam_sleutel(text) is
  'Brengt een Meta-advertentienaam en een ad_name uit de map terug tot dezelfde sleutel. Geeft null bij bundels, dubbele nummers en alles wat geen losse creative is.';

revoke all on function marketing_hq.meta_naam_sleutel(text) from public, anon;
grant execute on function marketing_hq.meta_naam_sleutel(text) to authenticated;

-- ── Wat er gekoppeld is, en wat niet ───────────────────────────────────────
-- Een koppeling die stil mislukt is erger dan geen koppeling: de map ziet er
-- dan compleet uit terwijl er advertenties buiten hangen. Deze view laat
-- allebei de kanten zien.
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
),
kaarten as (
  select c.id, c.brand, c.ad_name,
         marketing_hq.meta_naam_sleutel(c.ad_name) as sleutel
  from public.creatives c
  where c.ad_name is not null
)
select
  ads.brand,
  ads.sleutel,
  ads.entity_id                          as meta_ad_id,
  ads.entity_name                        as meta_naam,
  ads.spend,
  k.id                                   as creative_id,
  k.ad_name,
  case
    when ads.sleutel is null then 'naam niet te ontleden'
    when k.id is null        then 'geen creative met deze sleutel'
    else 'gekoppeld'
  end                                    as toestand
from ads
left join kaarten k
  on k.brand = ads.brand and k.sleutel = ads.sleutel;

comment on view marketing_hq.creative_meta_koppeling is
  'Elke gemeten Meta-advertentie met de creative waar hij aan hangt, of de reden waarom niet. Bedoeld om te zien wat er buiten de map valt.';

-- ── ad_totals: nu ook via de naam ──────────────────────────────────────────
-- Exact dezelfde achttien kolommen in dezelfde volgorde als in 0008. Dat is
-- geen netheid maar noodzaak: creative_results doet `select t.*` en zou bij
-- een andere volgorde niet meer te vervangen zijn — en daar hangt de halve
-- console aan.
--
-- Een creative die zowel een publicatie als een naamtreffer heeft, telt één
-- keer, via de publicatie. Die weet immers zeker welke advertentie het is; de
-- naam leidt het af.
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
    k.id                              as creative_id,
    null::bigint                      as publication_id,
    k.brand,
    -- Meerdere advertenties onder één creative: er is geen enkele die het
    -- geheel vertegenwoordigt, dus geen enkele die hier mag staan.
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
  from public.creatives k
  join marketing_hq.meta_accounts a
    on a.brand = k.brand and a.actief
  join marketing_hq.meta_insights_daily i
    on i.level = 'ad'
   and i.account_id = a.account_id
   and marketing_hq.meta_naam_sleutel(i.entity_name)
       = marketing_hq.meta_naam_sleutel(k.ad_name)
  where k.ad_name is not null
    and marketing_hq.meta_naam_sleutel(k.ad_name) is not null
  group by k.id, k.brand
)
select * from pub
union all
select * from naam n
where not exists (
  select 1 from pub p where p.creative_id = n.creative_id
);

comment on view marketing_hq.ad_totals is
  'Optellen op de tellers, niet op de ratio''s. Twee wegen naar dezelfde creative: een publicatie die dit systeem zelf deed, of de advertentienaam voor alles van daarvoor. Publicatie wint, want die weet het zeker.';

-- ── De vastgezette cijfers beschermen ──────────────────────────────────────
-- 0038 beloofde: wat een mens vastzet blijft staan. creative_kaart hield zich
-- daaraan, deze functie niet — die schrijft rechtstreeks in public.creatives.
-- Dat viel niet op omdat er nooit ad-niveau data was om mee te schrijven.
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
   where c.id = r.creative_id
     -- Wat een mens heeft vastgezet blijft staan. Zie 0038.
     and not c.cijfers_vastgezet;
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
       and cr.beoordeelbaar
  )
  update public.creatives c
     set status = v.nieuwe_status,
         updated_at = now()
    from vertaald v
   where c.id = v.creative_id
     and c.status is distinct from v.nieuwe_status
     and c.status <> 'Killed';
  get diagnostics n_status = row_count;

  return json_build_object('cijfers_bijgewerkt', n_cijfers, 'status_bijgewerkt', n_status);
end $$;

revoke all on function marketing_hq.sync_creative_results() from public, anon, authenticated;

-- ── Rechten ────────────────────────────────────────────────────────────────
-- security_invoker-views lezen met de rechten van wie ze aanroept. Zonder
-- deze grants staat er "permission denied" op het scherm en groen in de test,
-- precies zoals bij 0039.
alter table marketing_hq.meta_accounts enable row level security;

drop policy if exists team_read_meta_accounts on marketing_hq.meta_accounts;
create policy team_read_meta_accounts on marketing_hq.meta_accounts
  for select using (marketing_hq.is_team_member());

grant select on marketing_hq.meta_accounts          to authenticated;
grant select on marketing_hq.creative_meta_koppeling to authenticated;

create or replace view public.hq_creative_meta_koppeling
with (security_invoker = true) as
select * from marketing_hq.creative_meta_koppeling;

grant select on public.hq_creative_meta_koppeling to authenticated;
