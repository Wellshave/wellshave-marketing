-- ═══════════════════════════════════════════════════════════════════════════
-- 0033 — De creative en zijn bibliotheekvariant zijn hetzelfde ding
--
-- Wat er misging, uitgezocht op productie en niet geraden.
--
-- De drie Google Search-varianten staan in de bibliotheek als drie items met
-- een eigen id:
--
--   lib-1784834120046-kg8e4  batch-1784834120046-sxor  variant 0
--     "Jij googelt het ook."
--   lib-1784834128071-nve50  batch-1784834120046-sxor  variant 1
--     "23:47. Incognito. Wij weten wat je zoekt."
--   lib-1784834130995-v7g40  batch-1784834120046-sxor  variant 2
--     "184.000+ mannen googelden dit ook."
--
-- Elk met een gegenereerde afbeelding, headline, body copy, CTA en de hele
-- generation metadata. Ze staan in app_state.library_v2 — een jsonb-blob per
-- merk, want de bibliotheek is nooit een tabel geweest.
--
-- In public.creatives staan ze óók, als de rijen 5, 6 en 7. Drie afzonderlijke
-- rijen, alle drie aan werkstuk 9 — ze zijn dus niet samengevoegd. Maar het
-- zijn stubs: ad_name gevuld met de headline, en verder niets. Geen beeld,
-- geen copy, geen verwijzing naar het bibliotheekitem waar ze uit komen.
--
-- De oorzaak staat in pxTagCreative() in 17-bibliotheek-en-backup.js. Die
-- functie heet "tag" en dat is precies wat hij doet: hij noteert dát er een
-- static bij een angle is gemaakt. Hij is nooit bedoeld geweest als de plek
-- waar de creative zelf landt, maar hij is wel wat de Creative Strategy-tabel
-- vult. Het beeld en de copy bleven achter in de blob.
--
-- Wat deze migratie doet: één stabiele verwijzing toevoegen. Niet de
-- advertentienaam, niet de headline, niet de hoek — die kunnen alle drie
-- veranderen en zijn alle drie niet uniek. Wel het id dat de bibliotheek bij
-- het opslaan al uitdeelt en dat nooit meer verandert.
--
-- Er wordt geen bibliotheek naar de database verhuisd. De blob blijft waar hij
-- is; alleen de verwijzing komt erbij, zodat het beeld terug te vinden is.
--
-- Additief. Bestaande rijen blijven ongemoeid: de drie stubs krijgen hier geen
-- waarde. Welk bibliotheekitem bij welke creative hoort, is een vraag die de
-- database niet mag beantwoorden op grond van een gelijke titel — dat is
-- precies de koppeling op naam die we niet willen. Dat blijft een mens.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.creatives
  add column if not exists bibliotheek_id text,
  add column if not exists batch_id       text,
  add column if not exists variant_index  smallint;

comment on column public.creatives.bibliotheek_id is
  'Het id van het bibliotheekitem waar deze creative uit komt (lib-…). De enige koppelsleutel: naam, headline en hoek zijn geen van drieën uniek en veranderen.';
comment on column public.creatives.batch_id is
  'De generatie waar deze variant uit kwam. Drie varianten uit één generatie delen dit id en houden hun eigen bibliotheek_id.';
comment on column public.creatives.variant_index is
  'Welke van de varianten uit die generatie dit is, geteld vanaf 0. Zo blijft "variant 2 van 3" leesbaar zonder de blob erbij te halen.';

-- Eén bibliotheekitem kan maar bij één creative horen. Zonder deze regel kan
-- dezelfde variant twee keer in de tabel belanden, en dan wijst een verwijzing
-- uit een rapport naar twee dingen.
create unique index if not exists creatives_bibliotheek_uniek
  on public.creatives (brand, bibliotheek_id)
  where bibliotheek_id is not null;

-- Een variantnummer zonder batch zegt niets: "variant 2" van wat?
alter table public.creatives drop constraint if exists creatives_variant_heeft_batch;
alter table public.creatives
  add constraint creatives_variant_heeft_batch
  check (variant_index is null or batch_id is not null)
  not valid;

-- De testkaart en het dossier geven de koppeling door, zodat de console het
-- beeld uit de bibliotheek kan halen zonder zelf te hoeven raden welk item het
-- is. Beide views worden hier opnieuw gemaakt met dezelfde vorm als in 0030,
-- plus deze drie kolommen.
-- create or replace kan geen kolom tussenvoegen, dus de views gaan er eerst af
-- en komen daarna terug. In deze volgorde: eerst wie leest, dan wat gelezen
-- wordt, anders klaagt Postgres over afhankelijkheden.
drop view if exists public.hq_creative_dossier;
drop view if exists marketing_hq.creative_dossier;
drop view if exists public.hq_testkaart;
drop view if exists marketing_hq.testkaart;

create view marketing_hq.testkaart as
select
  c.id                                   as creative_id,
  c.brand, c.ad_name, c.product, c.persona,
  c.angle_type, c.marketing_angle,
  c.awareness_level, c.funnel_stage,
  c.format, c.media_type, c.channel,
  c.headline, c.body_copy, c.cta, c.visual_concept, c.image_prompt,
  (c.image_b64 is not null)              as heeft_beeld,
  c.bibliotheek_id, c.batch_id, c.variant_index,
  c.hypothesis, c.test_variable,
  c.rory_reasoning, c.theriot_reasoning, c.bronnen,
  c.placement, c.product_refs,
  c.learning_kern, c.learning_behouden, c.learning_veranderen,
  c.iteratie_voorstel, c.vervolgtests, c.learning_door_agent,
  (c.learning_bevestigd_door is not null) as learning_bevestigd,
  lb.full_name                           as learning_bevestigd_door,
  c.learning_bevestigd_op,
  c.status,
  s.fase                                 as status_fase,
  s.betekenis                            as status_betekenis,
  s.volgorde                             as status_volgorde,
  s.verantwoordelijke,
  s.volgende_stap,
  s.vraagt_test,
  c.parent_id, c.werkstuk_id, c.denkstuk_id,
  c.user_name                            as gemaakt_door,
  tm.full_name                           as klaargezet_door,
  c.klaargezet_op, c.created_at, c.date_live,
  c.roas, c.ctr, c.hook_rate, c.conversions, c.budget, c.score, c.next_step,

  w.titel                                as werkstuk,
  w.status                               as werkstuk_status,
  w.rory_interview, w.mens_ingeving,
  w.sophistication,
  sn.naam                                as sophistication_naam,
  sn.wat_werkt                           as sophistication_wat_werkt,
  w.sophistication_reden,
  (w.sophistication_bevestigd_door is not null) as sophistication_bevestigd,

  d.status                               as denkstuk_status,
  coalesce(a.onderbouwd, 0)              as onderbouwd,
  coalesce(a.aanname, 0)                 as aanname,
  coalesce(a.open_gelaten, 0)            as open_gelaten,
  case
    when d.id is null                    then 'geen denkstuk — deze test rust nergens op'
    when coalesce(a.onderbouwd, 0) = 0   then 'niets is gemeten; alles rust op aannames'
    else coalesce(a.onderbouwd, 0) || ' van de ' || coalesce(a.totaal, 0) || ' antwoorden zijn onderbouwd'
  end                                    as onderbouwing,

  case
    when c.hypothesis is null or length(trim(c.hypothesis)) = 0
      then 'geen hypothese — een afbeelding zonder hypothese is geen test'
    when c.test_variable is null or length(trim(c.test_variable)) = 0
      then 'geen testvariabele — dan is achteraf niet te zeggen wát het deed'
    when c.werkstuk_id is null
      then 'niet aan een werkstuk gekoppeld'
    else null
  end                                    as niet_testklaar,

  -- Waarom er geen beeld is. Zonder dit onderscheid lijkt een creative die
  -- zijn koppeling mist hetzelfde als een creative die nog gemaakt moet
  -- worden, en dat is het verschil tussen een fout en geduld.
  case
    when c.image_b64 is not null   then null
    when c.bibliotheek_id is not null
      then 'het beeld staat in de bibliotheek, niet in de database'
    else 'niet gekoppeld aan een bibliotheekvariant — beeld en copy zijn niet terug te vinden'
  end                                    as beeld_herkomst,

  v.verdict, v.verdict_actie, v.verdict_reden, v.verdict_op
from public.creatives c
left join marketing_hq.creative_statussen s on s.status = c.status
left join marketing_hq.werkstukken w        on w.id = c.werkstuk_id
left join marketing_hq.denkstukken d        on d.id = c.denkstuk_id
left join public.team_members tm            on tm.id = c.klaargezet_door
left join public.team_members lb            on lb.id = c.learning_bevestigd_door
left join marketing_hq.sophistication_niveaus sn on sn.niveau = w.sophistication
left join lateral (
  select count(*) as totaal,
         count(*) filter (where zekerheid = 'onderbouwd')  as onderbouwd,
         count(*) filter (where zekerheid = 'aanname')     as aanname,
         count(*) filter (where zekerheid = 'open')        as open_gelaten
  from marketing_hq.denkstuk_antwoorden x where x.denkstuk_id = d.id
) a on true
left join lateral (
  select mr.verdict, mr.action as verdict_actie, mr.reasoning as verdict_reden,
         mr.created_at as verdict_op
  from marketing_hq.meta_recommendations mr
  where mr.creative_id = c.id
  order by mr.created_at desc limit 1
) v on true;

alter view marketing_hq.testkaart set (security_invoker = true);
grant select on marketing_hq.testkaart to authenticated;

create view public.hq_testkaart with (security_invoker = true)
  as select * from marketing_hq.testkaart;
revoke all on public.hq_testkaart from anon, public;
grant select on public.hq_testkaart to authenticated;

-- Het dossier erft alles uit de testkaart en krijgt de zusjes erbij.
create view marketing_hq.creative_dossier as
select
  t.*,
  (select jsonb_agg(jsonb_build_object(
            'vraag', v.vraag, 'tekst', v.tekst,
            'antwoord', a.antwoord, 'zekerheid', a.zekerheid, 'bron', a.bron)
          order by v.vraag)
     from marketing_hq.denkstuk_vragen v
     left join marketing_hq.denkstuk_antwoorden a
            on a.denkstuk_id = t.denkstuk_id and a.vraag = v.vraag
  )                                               as denkstuk_regels,
  (select jsonb_agg(jsonb_build_object(
            'station', s.station, 'naam', st.naam, 'status', s.status,
            'wie', coalesce(tm.full_name, ag.name, 'naamloos'),
            'soort', case when s.mens_id is not null then 'mens'
                          when s.agent_id is not null then 'agent' else 'onbekend' end,
            'waarom', s.waarom, 'afgerond', s.afgerond_op)
          order by s.station)
     from marketing_hq.werkstuk_stappen s
     join marketing_hq.werkstuk_stations st on st.station = s.station
     left join public.team_members tm on tm.id = s.mens_id
     left join marketing_hq.agents ag on ag.id = s.agent_id
    where s.werkstuk_id = t.werkstuk_id)          as stappen,
  (select jsonb_agg(jsonb_build_object(
            'van_station', o.van_station, 'naar_station', o.naar_station,
            'besluit', o.besluit, 'waarom', o.waarom, 'controleren', o.controleren,
            'onzekerheden', o.onzekerheden, 'mens_nodig', o.mens_nodig,
            'status', o.status, 'wanneer', o.created_at)
          order by o.created_at)
     from marketing_hq.werkstuk_overdrachten o
    where o.werkstuk_id = t.werkstuk_id)          as overdrachten,
  (select jsonb_agg(jsonb_build_object(
            'oordeel', k.oordeel, 'reden', k.reden, 'wanneer', k.created_at,
            'door', coalesce(tm.full_name, k.door_agent))
          order by k.created_at)
     from marketing_hq.criticus_oordelen k
     join marketing_hq.werkstuk_overdrachten o on o.id = k.overdracht_id
     left join public.team_members tm on tm.id = k.door_mens
    where o.werkstuk_id = t.werkstuk_id)          as oordelen,
  (select jsonb_agg(jsonb_build_object(
            'van', m.from_agent, 'aan', m.to_agent, 'onderwerp', m.subject,
            'body', m.body, 'wanneer', m.created_at, 'gelezen', m.read_at)
          order by m.created_at)
     from marketing_hq.agent_messages m
    where m.werkstuk_id = t.werkstuk_id)          as discussies,
  (select jsonb_build_object(
            'account_id', p.account_id, 'status', p.status,
            'meta_ad_id', p.meta_ad_id, 'gepubliceerd_op', p.published_at,
            'door', p.published_by)
     from marketing_hq.meta_publications p
    where p.creative_id = t.creative_id
    order by p.created_at desc limit 1)           as publicatie,
  (select jsonb_build_object(
            'spend', r.spend, 'impressions', r.impressions, 'clicks', r.clicks,
            'ctr', r.ctr, 'cpa', r.cpa, 'roas', r.roas, 'purchases', r.purchases,
            'omzet', r.purchase_value, 'hook_rate', r.hook_rate,
            'dagen_live', r.dagen_live, 'meetdagen', r.meetdagen,
            'alles_definitief', r.alles_definitief, 'beoordeelbaar', r.beoordeelbaar)
     from marketing_hq.creative_results r
    where r.creative_id = t.creative_id)          as meting,
  (select jsonb_agg(jsonb_build_object(
            'hoek', l.angle_type, 'persona', l.persona,
            'advertenties', l.aantal_ads, 'spend', l.spend, 'roas', l.roas,
            'winnaars', l.winnaars, 'betrouwbaar', l.betrouwbaar)
          order by l.angle_type)
     from marketing_hq.angle_learnings l
    where l.angle_type = t.angle_type
      and (t.persona is null or l.persona = t.persona)) as learnings,

  -- De andere varianten uit dezelfde generatie. Zo is "variant 2 van 3"
  -- zichtbaar en blijven de drie afzonderlijk aanklikbaar in plaats van dat
  -- ze als één gedachte samenvallen.
  (select jsonb_agg(jsonb_build_object(
            'creative_id', z.id, 'ad_name', z.ad_name,
            'variant_index', z.variant_index, 'heeft_beeld', z.image_b64 is not null)
          order by z.variant_index, z.id)
     from public.creatives z
    where t.batch_id is not null and z.batch_id = t.batch_id
      and z.brand = t.brand)                      as zusjes,

  (select jsonb_agg(x order by x->>'wanneer')
     from (
       select jsonb_build_object(
                'wanneer', s.afgerond_op, 'soort', 'stap',
                'wie', coalesce(tm.full_name, ag.name, 'naamloos'),
                'door', case when s.mens_id is not null then 'mens'
                             when s.agent_id is not null then 'agent' else 'onbekend' end,
                'wat', st.naam || ' ' || s.status,
                'waarom', s.waarom) as x
         from marketing_hq.werkstuk_stappen s
         join marketing_hq.werkstuk_stations st on st.station = s.station
         left join public.team_members tm on tm.id = s.mens_id
         left join marketing_hq.agents ag on ag.id = s.agent_id
        where s.werkstuk_id = t.werkstuk_id and s.afgerond_op is not null
       union all
       select jsonb_build_object(
                'wanneer', o.created_at, 'soort', 'overdracht',
                'wie', coalesce(tm.full_name, ag.name, 'naamloos'),
                'door', case when o.door_mens is not null then 'mens' else 'agent' end,
                'wat', o.van_station || ' → ' || coalesce(o.naar_station::text, '?'),
                'waarom', o.besluit)
         from marketing_hq.werkstuk_overdrachten o
         left join public.team_members tm on tm.id = o.door_mens
         left join marketing_hq.agents ag on ag.id = o.door_agent
        where o.werkstuk_id = t.werkstuk_id
       union all
       select jsonb_build_object(
                'wanneer', k.created_at, 'soort', 'oordeel',
                'wie', coalesce(tm.full_name, k.door_agent, 'de Criticus'),
                'door', case when k.door_mens is not null then 'mens' else 'agent' end,
                'wat', 'oordeel: ' || k.oordeel, 'waarom', k.reden)
         from marketing_hq.criticus_oordelen k
         join marketing_hq.werkstuk_overdrachten o2 on o2.id = k.overdracht_id
         left join public.team_members tm on tm.id = k.door_mens
        where o2.werkstuk_id = t.werkstuk_id
       union all
       select jsonb_build_object(
                'wanneer', t.klaargezet_op, 'soort', 'klaargezet',
                'wie', coalesce(t.klaargezet_door, 'een teamlid'), 'door', 'mens',
                'wat', 'klaargezet voor test', 'waarom', t.hypothesis)
        where t.klaargezet_op is not null
     ) tl)                                          as tijdlijn
from marketing_hq.testkaart t;

alter view marketing_hq.creative_dossier set (security_invoker = true);
grant select on marketing_hq.creative_dossier to authenticated;

create view public.hq_creative_dossier with (security_invoker = true)
  as select * from marketing_hq.creative_dossier;
revoke all on public.hq_creative_dossier from anon, public;
grant select on public.hq_creative_dossier to authenticated;

-- ── De koppeling leggen, als één gecontroleerde handeling ──────────────────
-- Alleen een mens, en alleen als het bibliotheekitem nog nergens anders aan
-- hangt. De console mag public.creatives schrijven, maar niet dit: een
-- koppeling die via een los scherm binnenkomt kan dezelfde variant aan twee
-- creatives hangen, en dan is de keten stuk zonder dat iemand het ziet.
create or replace function marketing_hq.creative_koppelen(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public, marketing_hq
as $$
declare
  v_mens     uuid := auth.uid();
  v_creative bigint := nullif(p->>'creative_id','')::bigint;
  v_lib      text   := nullif(trim(coalesce(p->>'bibliotheek_id','')), '');
  v_brand    text;
  v_bezet    bigint;
begin
  if v_mens is null or not exists (
       select 1 from public.team_members t where t.id = v_mens and t.status = 'approved') then
    raise exception 'Alleen een goedgekeurd teamlid kan een creative koppelen.';
  end if;
  if v_creative is null or v_lib is null then
    raise exception 'Zowel de creative als het bibliotheekitem moeten genoemd worden.';
  end if;

  select c.brand into v_brand from public.creatives c where c.id = v_creative;
  if v_brand is null then
    raise exception 'Creative % bestaat niet.', v_creative;
  end if;

  select c.id into v_bezet from public.creatives c
   where c.brand = v_brand and c.bibliotheek_id = v_lib and c.id <> v_creative;
  if v_bezet is not null then
    raise exception
      'Bibliotheekvariant % hangt al aan creative %. Eén variant hoort bij één creative.',
      v_lib, v_bezet;
  end if;

  update public.creatives c set
    bibliotheek_id = v_lib,
    batch_id       = coalesce(nullif(trim(coalesce(p->>'batch_id','')), ''), c.batch_id),
    variant_index  = coalesce(nullif(p->>'variant_index','')::smallint, c.variant_index),
    -- Wat de bibliotheek weet en de rij niet, wordt hier overgenomen. Nooit
    -- andersom: staat het al in de rij, dan is dat wat er staat.
    headline       = coalesce(c.headline,       nullif(trim(coalesce(p->>'headline','')), '')),
    body_copy      = coalesce(c.body_copy,      nullif(trim(coalesce(p->>'body_copy','')), '')),
    cta            = coalesce(c.cta,            nullif(trim(coalesce(p->>'cta','')), '')),
    visual_concept = coalesce(c.visual_concept, nullif(trim(coalesce(p->>'visual_concept','')), '')),
    image_prompt   = coalesce(c.image_prompt,   nullif(trim(coalesce(p->>'image_prompt','')), '')),
    format         = coalesce(c.format,         nullif(trim(coalesce(p->>'format','')), '')),
    image_b64      = coalesce(c.image_b64,      nullif(coalesce(p->>'image_b64',''), '')),
    updated_at     = now()
  where c.id = v_creative;

  return jsonb_build_object('creative_id', v_creative, 'bibliotheek_id', v_lib);
end $$;

comment on function marketing_hq.creative_koppelen(jsonb) is
  'Verbindt een creative met zijn bibliotheekvariant. Weigert een variant die al aan een andere creative hangt; vult alleen velden die nog leeg zijn.';

revoke all on function marketing_hq.creative_koppelen(jsonb) from public, anon;
grant execute on function marketing_hq.creative_koppelen(jsonb) to authenticated;

create or replace function public.hq_creative_koppelen(p jsonb)
returns jsonb language sql security definer set search_path = public, marketing_hq
as $$ select marketing_hq.creative_koppelen(p) $$;
revoke all on function public.hq_creative_koppelen(jsonb) from public, anon;
grant execute on function public.hq_creative_koppelen(jsonb) to authenticated;

-- ── De testklaar-deur geeft de koppeling door ──────────────────────────────
-- Zonder deze drie velden zou de nieuwe flow dezelfde stub opleveren als de
-- oude: een rij die niet weet uit welke bibliotheekvariant hij komt. Dan is
-- dit geen legacy-probleem meer maar een terugkerend probleem.
create or replace function marketing_hq.creative_testklaar_maken(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mens      uuid;
  v_werkstuk  bigint;
  v_denkstuk  bigint;
  v_creative  bigint;
  v_naam      text;
  v_brand     text := lower(coalesce(p->>'brand', 'wellshave'));
begin
  select tm.id into v_mens
  from public.team_members tm
  where tm.id = auth.uid() and tm.status = 'approved';
  if v_mens is null then
    raise exception 'Alleen een goedgekeurd teamlid kan een variant testklaar maken.'
      using errcode = 'insufficient_privilege';
  end if;

  v_naam := nullif(trim(coalesce(p->>'ad_name', '')), '');
  if v_naam is null then
    v_naam := marketing_hq.ad_naam_voorstel(v_brand, p->>'product', p->>'persona', p->>'angle_type');
  end if;

  v_werkstuk := nullif(p->>'werkstuk_id', '')::bigint;
  if v_werkstuk is null then
    insert into marketing_hq.werkstukken
      (brand, titel, product, persona, angle_type, aanleiding, gestart_door, gestart_door_mens)
    values (v_brand,
            coalesce(nullif(trim(coalesce(p->>'werkstuk_titel','')), ''),
                     'Werkt ' || coalesce(p->>'angle_type','deze hoek') ||
                     ' bij ' || coalesce(p->>'persona','deze persona') || '?'),
            p->>'product', p->>'persona', p->>'angle_type',
            coalesce(nullif(trim(coalesce(p->>'aanleiding','')), ''),
                     'Ontstaan in de Static Ad Generator op ' || to_char(now(), 'DD-MM-YYYY') || '.'),
            'mens', v_mens)
    returning id into v_werkstuk;
  end if;

  update marketing_hq.werkstukken w
     set rory_interview = coalesce(p->'rory_interview', '{}'::jsonb),
         mens_ingeving  = nullif(trim(coalesce(p->>'mens_ingeving','')), '')
   where w.id = v_werkstuk
     and w.rory_interview = '{}'::jsonb
     and coalesce(p->'rory_interview', '{}'::jsonb) <> '{}'::jsonb;

  if (p->>'sophistication') is not null then
    update marketing_hq.werkstukken w
       set sophistication = (p->>'sophistication')::smallint,
           sophistication_reden = nullif(trim(coalesce(p->>'sophistication_reden','')), ''),
           sophistication_door_mens = v_mens,
           sophistication_bevestigd_door = v_mens,
           sophistication_bevestigd_op = now()
     where w.id = v_werkstuk and w.sophistication is null
       and nullif(trim(coalesce(p->>'sophistication_reden','')), '') is not null;
  end if;

  select d.id into v_denkstuk from marketing_hq.denkstukken d where d.werkstuk_id = v_werkstuk;
  if v_denkstuk is null then
    insert into marketing_hq.denkstukken (werkstuk_id, status) values (v_werkstuk, 'bezig')
    returning id into v_denkstuk;

    insert into marketing_hq.denkstuk_antwoorden
      (denkstuk_id, vraag, antwoord, zekerheid, door_mens)
    select v_denkstuk, x.vraag, x.antwoord, 'aanname', v_mens
    from (values
      (1::smallint, nullif(trim(coalesce(p->>'marketing_angle','')), '')),
      (2::smallint, nullif(trim(coalesce(p->>'kernpijn','')), '')),
      (3::smallint, nullif(trim(coalesce(p->>'persona','')), '')),
      (4::smallint, nullif(trim(coalesce(p->>'hypothesis','')), '')),
      (5::smallint, nullif(trim(coalesce(p->>'format','')), '')),
      (6::smallint, nullif(trim(coalesce(p->>'test_variable','')), '')),
      (7::smallint, nullif(trim(coalesce(p->>'waarom_nu','')), ''))
    ) x(vraag, antwoord)
    where x.antwoord is not null;
  end if;

  v_creative := nullif(p->>'creative_id', '')::bigint;

  if v_creative is null then
    insert into public.creatives (
      brand, user_id, user_email, user_name, ad_name, product, persona,
      awareness_level, angle_type, marketing_angle, format, media_type, channel,
      creative_concept, hook_short, image_b64, source_type,
      hypothesis, test_variable, funnel_stage, headline, body_copy, cta,
      visual_concept, image_prompt, rory_reasoning, theriot_reasoning, bronnen,
      placement, product_refs,
      bibliotheek_id, batch_id, variant_index,
      werkstuk_id, denkstuk_id, parent_id, klaargezet_door, klaargezet_op, status
    ) values (
      v_brand, v_mens, p->>'user_email', p->>'user_name', v_naam,
      p->>'product', p->>'persona', p->>'awareness_level', p->>'angle_type',
      p->>'marketing_angle', p->>'format', coalesce(p->>'media_type','Static'), p->>'channel',
      p->>'creative_concept', left(coalesce(p->>'headline',''), 300), p->>'image_b64',
      coalesce(p->>'source_type','static'),
      p->>'hypothesis', p->>'test_variable', p->>'funnel_stage',
      p->>'headline', p->>'body_copy', p->>'cta',
      p->>'visual_concept', p->>'image_prompt',
      p->>'rory_reasoning', p->>'theriot_reasoning',
      coalesce(p->'bronnen', '[]'::jsonb),
      p->>'placement', coalesce(p->'product_refs', '[]'::jsonb),
      nullif(trim(coalesce(p->>'bibliotheek_id','')), ''),
      nullif(trim(coalesce(p->>'batch_id','')), ''),
      nullif(p->>'variant_index','')::smallint,
      v_werkstuk, v_denkstuk, nullif(p->>'parent_id','')::bigint,
      v_mens, now(), 'Klaar voor review'
    ) returning id into v_creative;
  else
    update public.creatives c set
      ad_name = v_naam, hypothesis = p->>'hypothesis', test_variable = p->>'test_variable',
      werkstuk_id = v_werkstuk, denkstuk_id = v_denkstuk,
      headline = coalesce(p->>'headline', c.headline),
      body_copy = coalesce(p->>'body_copy', c.body_copy),
      cta = coalesce(p->>'cta', c.cta),
      visual_concept = coalesce(p->>'visual_concept', c.visual_concept),
      image_prompt = coalesce(p->>'image_prompt', c.image_prompt),
      rory_reasoning = coalesce(p->>'rory_reasoning', c.rory_reasoning),
      theriot_reasoning = coalesce(p->>'theriot_reasoning', c.theriot_reasoning),
      bronnen = coalesce(p->'bronnen', c.bronnen),
      placement = coalesce(p->>'placement', c.placement),
      product_refs = coalesce(p->'product_refs', c.product_refs),
      image_b64 = coalesce(c.image_b64, p->>'image_b64'),
      bibliotheek_id = coalesce(c.bibliotheek_id, nullif(trim(coalesce(p->>'bibliotheek_id','')), '')),
      batch_id = coalesce(c.batch_id, nullif(trim(coalesce(p->>'batch_id','')), '')),
      variant_index = coalesce(c.variant_index, nullif(p->>'variant_index','')::smallint),
      klaargezet_door = v_mens, klaargezet_op = now(),
      status = 'Klaar voor review'
    where c.id = v_creative;
  end if;

  return jsonb_build_object(
    'creative_id', v_creative, 'werkstuk_id', v_werkstuk,
    'denkstuk_id', v_denkstuk, 'ad_name', v_naam);
end $$;

revoke all on function marketing_hq.creative_testklaar_maken(jsonb) from public, anon;
grant execute on function marketing_hq.creative_testklaar_maken(jsonb) to authenticated;
