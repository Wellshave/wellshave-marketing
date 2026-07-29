-- Marketing OS — publiceren naar Meta (stap 03) en de terugkoppeling (stap 06).
-- Toepassen op bequyhghgkvekvibufhw, schema marketing_hq, ná 0005.
--
-- Additief. Onderaan staan de drops om terug te draaien.
--
-- De kern van dit bestand is één tabel: meta_publications. Die houdt bij welke
-- creative uit de console welke advertentie in Meta is geworden. Zonder die rij
-- is een cijfer uit Meta niet terug te leiden naar de hypothese die het testte,
-- en blijft de lus open.

create table if not exists marketing_hq.meta_publications (
  id bigint generated always as identity primary key,
  brand text not null default 'wellshave',

  -- Waar het vandaan komt. Bewust geen foreign key: een creative kan uit de
  -- console verdwijnen terwijl de advertentie in Meta blijft draaien, en dan
  -- moet de publicatie blijven bestaan als historisch spoor.
  creative_id bigint,
  ad_name text not null,

  -- Waar het heen gaat.
  account_id text not null,
  adset_id text not null,
  campaign_id text,

  -- Wat er precies gepubliceerd wordt.
  asset_kind text not null default 'image' check (asset_kind in ('image','video')),
  asset_sha256 text,                       -- vingerafdruk van de bytes
  headline text,
  primary_text text,
  description text,
  cta_type text not null default 'SHOP_NOW',
  link_url text not null,
  utm_content text,                        -- tweede, onafhankelijke koppeling
  page_id text not null,
  instagram_actor_id text,

  -- Wat Meta ervan gemaakt heeft. Elk id wordt opgeslagen zodra het bestaat,
  -- zodat een herhaalde poging niets dubbel aanmaakt.
  meta_image_hash text,
  meta_video_id text,
  meta_creative_id text,
  meta_ad_id text,
  object_story_spec jsonb,

  -- Waarom deze advertentie bestaat. Dit is wat stap 06 straks beoordeelt.
  hypothesis text,
  angle text,
  persona text,
  awareness_level text,

  status text not null default 'concept' check (status in (
    'concept',            -- rij bestaat, nog niets bij Meta
    'voorbereid',         -- beeld geüpload en creative aangemaakt, nog geen advertentie
    'wacht_op_akkoord',   -- approval staat klaar voor een mens
    'afgewezen',          -- mens zei nee
    'publiceren',         -- bezig met aanmaken van de advertentie
    'live',               -- advertentie bestaat en staat aan
    'gepauzeerd',         -- advertentie bestaat, staat uit
    'mislukt'             -- Meta gaf een fout terug
  )),

  approval_id bigint references marketing_hq.approvals(id),
  prepared_by text references marketing_hq.agents(id),
  run_id bigint references marketing_hq.agent_runs(id),
  published_by text,                       -- e-mail van de mens die akkoord gaf
  proposed_daily_budget numeric(10,2),     -- alleen ter informatie bij de approval

  -- Herhaalde pogingen mogen nooit een tweede advertentie opleveren.
  idem_key text not null unique,
  attempts int not null default 0,
  error text,

  created_at timestamptz not null default now(),
  prepared_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz
);

create index if not exists meta_pub_status_idx on marketing_hq.meta_publications (status, created_at desc);
create index if not exists meta_pub_ad_idx     on marketing_hq.meta_publications (meta_ad_id) where meta_ad_id is not null;
create index if not exists meta_pub_creative_idx on marketing_hq.meta_publications (creative_id);

-- Eén creative mag maar één keer levend in dezelfde ad set staan. Een tweede
-- poging na een mislukking mag wel; vandaar de partiële index op alleen de
-- statussen die daadwerkelijk iets in Meta hebben staan.
create unique index if not exists meta_pub_uniek_levend
  on marketing_hq.meta_publications (creative_id, adset_id)
  where creative_id is not null and status in ('voorbereid','wacht_op_akkoord','publiceren','live','gepauzeerd');

-- ── De terugkoppeling ───────────────────────────────────────────────────────
-- Dit is stap 06 in één view: de cijfers die Atlas per advertentie ophaalt,
-- naast de creatieve keuzes waar die advertentie uit voortkwam. Wat hier
-- uitkomt is waar de generator straks op sorteert.
create or replace view marketing_hq.creative_performance as
select
  p.creative_id,
  p.id                       as publication_id,
  p.brand,
  p.ad_name,
  p.angle,
  p.persona,
  p.awareness_level,
  p.hypothesis,
  p.meta_ad_id,
  p.adset_id,
  p.published_at,
  i.insight_date,
  i.spend,
  i.impressions,
  i.ctr,
  i.cpm,
  i.purchases,
  i.purchase_value,
  i.roas,
  case when i.impressions > 0 then round(i.video_3s::numeric / i.impressions, 4) end as hook_rate,
  i.quality_ranking,
  i.is_final,
  -- Hoeveel dagen de advertentie op deze meetdag draaide. Onder de 4 is een
  -- oordeel niet eerlijk: Meta's attributie loopt tot ~72 uur na.
  (i.insight_date - p.published_at::date) as dagen_live
from marketing_hq.meta_publications p
join marketing_hq.meta_insights_daily i
  on i.level = 'ad' and i.entity_id = p.meta_ad_id
where p.meta_ad_id is not null;

-- ── Toegang ─────────────────────────────────────────────────────────────────
alter table marketing_hq.meta_publications enable row level security;
grant select on marketing_hq.meta_publications to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies
                  where schemaname='marketing_hq' and tablename='meta_publications'
                    and policyname='team_read_meta_publications') then
    create policy team_read_meta_publications on marketing_hq.meta_publications
      for select to authenticated using (marketing_hq.is_team_member());
  end if;
end $$;

create or replace view public.hq_meta_publications with (security_invoker = true)
  as select * from marketing_hq.meta_publications;
create or replace view public.hq_creative_performance with (security_invoker = true)
  as select * from marketing_hq.creative_performance;

revoke all on public.hq_meta_publications, public.hq_creative_performance from anon, public;
grant select on public.hq_meta_publications, public.hq_creative_performance to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table marketing_hq.meta_publications;
  end if;
exception when duplicate_object then null;
end $$;

-- ── Terugdraaien ────────────────────────────────────────────────────────────
-- drop view if exists public.hq_creative_performance, public.hq_meta_publications;
-- drop view if exists marketing_hq.creative_performance;
-- drop table if exists marketing_hq.meta_publications;
