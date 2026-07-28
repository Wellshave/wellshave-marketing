-- ============================================================
-- Atelier Console — extra tabellen voor het nieuwe design.
-- Bouwt voort op de bestaande tabellen: team_members, creatives
-- (= Bibliotheek), ad_results (= leaderboard), app_state.
-- Nieuw hier: products, personas, rory_recommendations.
-- Plak in Supabase > SQL Editor > New query > Run. Run NA de eerdere
-- scripts (team_members moet al bestaan voor de RLS-policies).
-- ============================================================

-- ---------- PRODUCTEN (broncatalogus) ----------
create table if not exists products (
  id           bigint generated always as identity primary key,
  brand        text default 'wellshave',
  slug         text,                    -- 'p1' etc. (stabiele referentie in de app)
  tag          text,                    -- korte code voor het beeld-placeholder, bv 'GROOM'
  name         text not null,
  niche        text,                    -- 'Body Groomer' | 'Skincare' | 'Baardverzorging' | 'Scheren'
  price        text,
  hero         boolean default false,   -- ★ HELD-badge
  rating       text,
  reviews      text,
  sell         text,                    -- one-liner
  usps         jsonb default '[]'::jsonb,   -- ["...","..."]
  features     jsonb default '[]'::jsonb,   -- [{icon,name,desc}]
  vs_us        jsonb default '[]'::jsonb,   -- ["..."]
  vs_them      jsonb default '[]'::jsonb,   -- ["..."]
  persona_ids  jsonb default '[]'::jsonb,   -- [1,2]  (verwijst naar personas.id of slug)
  proof        jsonb default '[]'::jsonb,   -- [{icon,text}]
  images       jsonb default '{}'::jsonb,   -- { packshot_wit:[urls], packshot_sfeer:[urls], lifestyle:[urls] }
  best_ad_ids  jsonb default '[]'::jsonb,   -- verwijzingen naar creatives
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists products_brand_idx on products (brand);
create index if not exists products_niche_idx on products (niche);

-- ---------- PERSONA'S (het fundament) ----------
create table if not exists personas (
  id           bigint generated always as identity primary key,
  brand        text default 'wellshave',
  slug         text,                    -- stabiele referentie
  name         text not null,
  alias        text,
  initial      text,
  age          integer,
  role         text,
  niche        text,                    -- 'body' | 'baard' | 'scheer' | 'skincare' ...
  driver       text,
  quote        text,
  demo         jsonb default '[]'::jsonb,   -- [["Leeftijd","26"],...]
  wants        jsonb default '[]'::jsonb,
  fears        jsonb default '[]'::jsonb,
  objections   jsonb default '[]'::jsonb,
  failed_alts  jsonb default '[]'::jsonb,
  benefits     jsonb default '[]'::jsonb,
  -- 5 Schwartz-stages met per stage de angles:
  -- [{ label, mindset, angles:[[naam, pitch, emotie, bezwaar], ...] }, ...]
  stages       jsonb default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists personas_brand_idx on personas (brand);
create index if not exists personas_niche_idx on personas (niche);

-- ---------- RORY'S DAGELIJKSE CHECK (Meta-agent, taak 7) ----------
create table if not exists rory_recommendations (
  id             bigint generated always as identity primary key,
  brand          text default 'wellshave',
  run_date       date not null default current_date,
  meta_ad_id     text,                  -- Meta Ads ad-id
  ad_name        text,
  creative_id    bigint,                -- optioneel: koppeling naar creatives.id
  roas           numeric,
  ctr            numeric,
  cpa            numeric,
  spend          numeric,
  verdict        text,                  -- 'Winner' | 'Test' | 'Loser'
  action         text,                  -- 'iterate' | 'copy' | 'new' | 'scale' | 'pause'
  reasoning      text,                  -- Rory's onderbouwing (Fable 5)
  metrics        jsonb default '{}'::jsonb,  -- volledige metric-snapshot (28 velden)
  handled        boolean default false, -- of het team de aanbeveling al oppakte
  created_at     timestamptz not null default now()
);
create index if not exists rory_rec_date_idx on rory_recommendations (run_date desc);
create index if not exists rory_rec_brand_idx on rory_recommendations (brand);

-- ---------- updated_at-triggers ----------
create or replace function atelier_touch() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists products_touch_trg on products;
create trigger products_touch_trg before update on products for each row execute function atelier_touch();
drop trigger if exists personas_touch_trg on personas;
create trigger personas_touch_trg before update on personas for each row execute function atelier_touch();

-- ---------- RLS: zelfde patroon als creatives ----------
alter table products enable row level security;
alter table personas enable row level security;
alter table rory_recommendations enable row level security;

-- Goedgekeurde leden lezen; admin/member schrijven.
do $$
declare t text;
begin
  foreach t in array array['products','personas','rory_recommendations'] loop
    execute format('drop policy if exists "%1$s_select" on %1$s', t);
    execute format($p$create policy "%1$s_select" on %1$s for select
      using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved') )$p$, t);

    execute format('drop policy if exists "%1$s_insert" on %1$s', t);
    execute format($p$create policy "%1$s_insert" on %1$s for insert
      with check ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) )$p$, t);

    execute format('drop policy if exists "%1$s_update" on %1$s', t);
    execute format($p$create policy "%1$s_update" on %1$s for update
      using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) )$p$, t);

    execute format('drop policy if exists "%1$s_delete" on %1$s', t);
    execute format($p$create policy "%1$s_delete" on %1$s for delete
      using ( exists (select 1 from team_members m where m.id = auth.uid() and m.status = 'approved' and m.role in ('admin','member')) )$p$, t);
  end loop;
end $$;

-- ============================================================
-- Klaar. Vervolgstappen (buiten dit script):
--  1. Reële data importeren: de producten, persona's en merkdata uit
--     de oude tool (index.html) wegschrijven naar products/personas.
--     De bibliotheek zit al in `creatives`; ad-resultaten in `ad_results`.
--  2. De Meta-agent (rory-daily-check.routine.js) vult elke ochtend
--     rory_recommendations; het Bibliotheek-scherm leest die.
-- ============================================================
