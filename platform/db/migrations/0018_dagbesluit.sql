-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — Het dagbesluit
--
-- De beslisvraag van het trackerscherm, opgeschreven vóór deze regel code
-- (regel 0.1 van het ontwerpcontract):
--
--     "Welke advertentie zet ik vandaag uit, en welke geef ik meer budget?"
--
-- 0013 gaf het oordeel al. Wat eraan ontbreekt is niet het oordeel maar alles
-- eromheen dat nodig is om er vanmorgen naar te handelen:
--
--   1. Geen volgorde. Zes advertenties met 'stoppen' zijn niet even erg. Een
--      die 30 dagen lang 412 euro verbrandde staat vóór een die 55 euro kostte,
--      en de scorekaart zegt daar niets over.
--   2. Geen naam die het team kent. De scorekaart draait op `entity_id` en de
--      naam die in Meta staat. In de tracker heet datzelfde ding anders. Regel
--      0.3 vraagt om naam én id; dan moeten ze allebei in de rij staan.
--   3. Geen handeling. 'materiaal werkt, bestemming niet' is een diagnose, geen
--      knop. Vijf oordelen moeten op vier handelingen uitkomen zonder dat de
--      diagnose onderweg verdwijnt.
--
-- Alleen een view. Geen tabel, geen kolom, niets dat bestaande data raakt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── De publicatie die bij een Meta-ad hoort ────────────────────────────────
-- `meta_publications` heeft geen unieke sleutel op `meta_ad_id`, en dat is met
-- opzet: een mislukte poging kan een tweede rij achterlaten. Voor dit scherm
-- is dat gevaarlijk. Zou de join uitwaaieren, dan stond dezelfde advertentie
-- twee keer in de lijst "vandaag uitzetten" — en dan telt iemand zijn verlies
-- dubbel, of hij zet er één uit en denkt dat hij klaar is.
--
-- Vandaar `distinct on`: precies één publicatie per Meta-ad, de eerste, want
-- die draagt de naam waaronder het is bedacht.
create or replace view marketing_hq.publicatie_per_ad as
select distinct on (p.meta_ad_id)
  p.meta_ad_id,
  p.creative_id,
  p.ad_name          as publicatie_naam,
  p.brand,
  p.published_at
from marketing_hq.meta_publications p
where p.meta_ad_id is not null
order by p.meta_ad_id, p.published_at asc nulls last, p.id asc;

comment on view marketing_hq.publicatie_per_ad is
  'Eén publicatie per Meta-ad, zodat een join op meta_ad_id nooit uitwaaiert.';

-- ── Het dagbesluit ─────────────────────────────────────────────────────────
create or replace view marketing_hq.dagbesluit as
with met_naam as (
  select
    s.*,
    a.naam                                      as account_naam,
    a.merk,
    a.actief                                    as account_actief,
    pub.creative_id,
    -- De naam die het team kent gaat vóór de naam die in Meta staat; ontbreekt
    -- de koppeling, dan is de Meta-naam het beste dat we hebben.
    coalesce(c.ad_name, pub.publicatie_naam, s.ad_naam) as naam,
    (pub.meta_ad_id is not null)                as gekoppeld,
    c.status                                    as tracker_status,
    c.persona, c.angle_type, c.format,

    -- Wat de advertentie over 30 dagen opleverde min wat hij kostte. Bewust de
    -- kale aftreksom en niet spend × (roas − 1): hetzelfde getal, maar zo kan
    -- niemand zich afvragen waar het vandaan komt.
    --
    -- Dit is géén winst. Het is toegeschreven omzet min advertentiekosten —
    -- inkoop, verzending en retouren zitten er niet in. Het is de juiste
    -- maatstaf om twee advertenties naast elkaar te leggen, en de verkeerde om
    -- te bepalen of het bedrijf geld verdient.
    round(coalesce(s.omzet, 0) - coalesce(s.spend, 0), 2) as omzet_min_spend,

    -- Wijzen beide signalen dezelfde kant op? Bij 'opschalen' en 'stoppen' wel,
    -- bij de twee diagnoses niet. Het scherm mag daarop sorteren; wat het niet
    -- mag is de diagnose weglaten omdat de signalen het oneens zijn.
    case
      when s.roas_boven is null or s.ctr_boven is null then null
      else s.roas_boven = s.ctr_boven
    end                                         as eensgezind
  from marketing_hq.advertentie_scorekaart s
  join marketing_hq.ad_accounts a on a.account_id = s.account_id
  left join marketing_hq.publicatie_per_ad pub on pub.meta_ad_id = s.entity_id
  left join public.creatives c on c.id = pub.creative_id
),
met_actie as (
  select m.*,
    -- Vijf oordelen, vier handelingen. 'converteert, bereikt te weinig' komt
    -- op dezelfde knop uit als 'opschalen' — de scorekaart zegt er zelf van
    -- dat meer bereik waarschijnlijk winst is — maar `eensgezind` blijft false,
    -- zodat het scherm het onder de zekere gevallen kan zetten in plaats van
    -- ertussen.
    case m.oordeel
      when 'stoppen'                             then 'uitzetten'
      when 'opschalen'                           then 'meer budget'
      when 'converteert, bereikt te weinig'      then 'meer budget'
      when 'materiaal werkt, bestemming niet'    then 'onderzoeken'
      when 'houden, niet opschalen'              then 'laten staan'
      else null
    end as actie
  from met_naam m
)
select
  account_id, account_naam, merk, account_actief,
  entity_id, naam, ad_naam, creative_id, gekoppeld,
  tracker_status, persona, angle_type, format,

  dagen, spend, impressions, aankopen, omzet, cpa,
  roas, ctr, kwaliteit,
  roas_mediaan, ctr_mediaan, roas_boven, ctr_boven,
  soortgenoten, signalen, eensgezind,
  omzet_min_spend,

  oordeel, actie,
  -- `waarom` komt ongewijzigd uit 0013 mee. Er staat er altijd één, ook als er
  -- geen oordeel is — dat is regel 0.4: geen leeg vlak, wel de reden.
  waarom,

  -- De volgorde waarin je ze afhandelt. Binnen één account en één handeling:
  -- het grootste bedrag eerst, want daar zit het verschil. Advertenties zonder
  -- handeling krijgen geen rang; die hoeven vandaag niet langs.
  case when actie is not null then
    row_number() over (
      partition by account_id, actie
      order by abs(omzet_min_spend) desc nulls last, spend desc, entity_id
    )
  end as rang
from met_actie;

comment on view marketing_hq.dagbesluit is
  'Welke advertentie zet ik vandaag uit, en welke geef ik meer budget? Oordeel uit 0013, met naam, handeling en volgorde erbij.';

comment on column marketing_hq.dagbesluit.omzet_min_spend is
  'Toegeschreven omzet min advertentiekosten over 30 dagen. Geen winst: inkoop, verzending en retouren zitten er niet in.';
comment on column marketing_hq.dagbesluit.rang is
  'Volgorde van afhandelen binnen account en handeling, grootste bedrag eerst. Leeg als er vandaag niets te doen is.';

-- ── Toegang ────────────────────────────────────────────────────────────────
-- Sinds 0017 draaien de views in dit schema op de rechten van de aanroeper, en
-- dat moet zo blijven. Twee nieuwe views die dat missen zouden precies het gat
-- terugzetten dat 0017 dichtmaakte.
alter view marketing_hq.publicatie_per_ad set (security_invoker = true);
alter view marketing_hq.dagbesluit        set (security_invoker = true);
grant select on marketing_hq.publicatie_per_ad, marketing_hq.dagbesluit to authenticated;

create or replace view public.hq_dagbesluit with (security_invoker = true)
  as select * from marketing_hq.dagbesluit;
revoke all on public.hq_dagbesluit from anon, public;
grant select on public.hq_dagbesluit to authenticated;

-- Dezelfde vangnetcontrole als in 0017, hier herhaald omdat deze migratie zelf
-- views toevoegt. Een view die dit mist is onzichtbaar stuk: hij werkt, en
-- toont te veel.
do $$
declare open_views text;
begin
  select string_agg(c.relname, ', ')
    into open_views
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'marketing_hq' and c.relkind = 'v'
    and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%';

  if open_views is not null then
    raise exception 'views zonder security_invoker: %', open_views;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Wat hier bewust NIET in zit
--
-- Een knop die het budget verhoogt of de advertentie uitzet. Het scherm laat
-- zien wat er moet gebeuren en wie het moet doen; het uitvoeren loopt via
-- `request_approval`, net als al het andere dat geld kost. Een lijst die
-- rechtstreeks in Meta ingrijpt is precies het soort ding dat je op een
-- maandagochtend per ongeluk aanklikt.
--
-- Terugdraaien
--
--   drop view if exists public.hq_dagbesluit;
--   drop view if exists marketing_hq.dagbesluit;
--   drop view if exists marketing_hq.publicatie_per_ad;
-- ═══════════════════════════════════════════════════════════════════════════
