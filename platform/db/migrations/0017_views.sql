-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — De views laten filteren op wie kijkt
--
-- Aan het einde van 0016 bleef dit staan, en het is precies het soort ding dat
-- je niet moet meenemen in een migratie die "de deploy vlot moet trekken".
--
-- Hoe het nu in elkaar zit:
--
--   public.hq_creative_kaart      security_invoker = true,  authenticated mag lezen
--   marketing_hq.creative_kaart   GEWONE view,              authenticated mag NIET lezen
--   public.creatives              RLS aan met policies
--
-- Twee gevolgen, allebei fout:
--
--   1. Het werkt niet. De wrapper draait met de rechten van de aanroeper, en
--      die mag niet bij de view eronder. Elke hq_*-view die de console gebruikt
--      valt om. Vandaag merkt niemand dat, want de console gebruikt ze nergens.
--
--   2. De makkelijke oplossing is erger dan het probleem. `grant select` op
--      marketing_hq.creative_kaart lijkt genoeg, maar die view is een gewone
--      view: hij draait met de rechten van zijn eigenaar (postgres), en die
--      omzeilt RLS. Wie er SELECT op krijgt ziet alles — ook iemand die is
--      ingelogd maar geen goedgekeurd teamlid is. De is_team_member()-policies
--      zouden er niet meer toe doen.
--
-- Het hoort andersom. De views worden security_invoker, ze krijgen leesrecht,
-- en de onderliggende tabellen krijgen leesrecht met hun RLS eroverheen. Dan
-- doet de policy het filteren, precies zoals bedoeld, en is er geen enkele weg
-- omheen.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Eén tabel stond open ────────────────────────────────────────────────
-- `werkstuk_stations` (0009) heeft als enige tabel in dit schema RLS uit staan
-- en geen enkele policy. Het is naslag — de namen van de zes stations — dus er
-- staat niets gevoeligs in, maar dat is een reden om hem te kunnen lezen en
-- geen reden om de regel te laten vallen. Zodra `werkstuk_estafette` straks
-- leesbaar wordt, is dit de enige tabel in de keten zonder slot.
alter table marketing_hq.werkstuk_stations enable row level security;
do $$ begin
  create policy stations_lezen on marketing_hq.werkstuk_stations
    for select using (marketing_hq.is_team_member());
exception when duplicate_object then null; end $$;

-- ── 2. De vier tabellen die nog geen leesrecht hadden ──────────────────────
-- Alle vier hebben RLS aan met een is_team_member()-policy, dus het leesrecht
-- opent niets: de policy blijft ertussen staan.
grant select on
    marketing_hq.ad_accounts,
    marketing_hq.agent_afspraken,
    marketing_hq.meta_publiek,
    marketing_hq.werkstuk_stations
  to authenticated;

-- ── 3. Elke view kijkt voortaan door de ogen van de aanroeper ──────────────
-- Zestien views, in één lus zodat er geen wordt overgeslagen — en zodat een
-- view die er later bij komt zichzelf verraadt in de controle onderaan.
do $$
declare v record;
begin
  for v in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'marketing_hq' and c.relkind = 'v'
  loop
    execute format('alter view marketing_hq.%I set (security_invoker = true)', v.relname);
    execute format('grant select on marketing_hq.%I to authenticated', v.relname);
  end loop;
end $$;

-- ── 4. Controle in de migratie zelf ────────────────────────────────────────
-- Een view die dit mist is onzichtbaar stuk: hij werkt, en toont te veel. Dus
-- weigert de migratie zichzelf af te maken als er één overblijft.
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
-- Wat dit betekent voor wie kijkt
--
--   service_role   ongewijzigd. Die bypast RLS en heeft sinds 0016 zijn eigen
--                  grants; de runtime merkt hier niets van.
--   authenticated  ziet door elke hq_*-view precies de rijen die de policies
--                  toelaten — dus alles als goedgekeurd teamlid, en niets als
--                  je alleen een account hebt.
--   anon           ongewijzigd: geen enkel recht op marketing_hq.
--
-- Terugdraaien
--
--   do $$ declare v record; begin
--     for v in select c.relname from pg_class c join pg_namespace n
--              on n.oid=c.relnamespace where n.nspname='marketing_hq' and c.relkind='v'
--     loop
--       execute format('revoke select on marketing_hq.%I from authenticated', v.relname);
--       execute format('alter view marketing_hq.%I reset (security_invoker)', v.relname);
--     end loop;
--   end $$;
--   revoke select on marketing_hq.ad_accounts, marketing_hq.agent_afspraken,
--     marketing_hq.meta_publiek, marketing_hq.werkstuk_stations from authenticated;
--   drop policy if exists stations_lezen on marketing_hq.werkstuk_stations;
--   alter table marketing_hq.werkstuk_stations disable row level security;
-- ═══════════════════════════════════════════════════════════════════════════
