-- ═══════════════════════════════════════════════════════════════════════════
-- 0048 — Creative Deconstruction: wat maakt deze advertentie tot wat hij is
--
-- Beslisvraag:
--
--     "Ik wil deze advertentie verbeteren. Wat mag ik veranderen zonder het
--      idee kapot te maken?"
--
-- Waarom dit vóór het genereren komt
--
--   Itereren is iets anders dan nieuw maken. Bij nieuw maken is alles vrij; bij
--   itereren is dat juist niet zo, en het verschil is niet cosmetisch. Een
--   Founder Story die tijdens een iteratie een willekeurig model als
--   hoofdpersoon krijgt, is geen iteratie meer maar een andere advertentie met
--   dezelfde naam. De cijfers die er daarna uit komen gaan over iets anders dan
--   wat er getest werd.
--
--   Daarom eerst lezen, dan pas schrijven. De AI bepaalt welke elementen het
--   concept dragen (invariants) en welke vrij zijn (flexible), en dat oordeel
--   staat vast vóór er één woord gegenereerd wordt.
--
-- Waarom dit náást public.creatives staat en niet erin
--
--   creatives.persona is wat een mens heeft genoteerd. Deze tabel is wat de AI
--   in de advertentie zelf leest. Die twee kunnen verschillen, en dat verschil
--   is informatie: staat er 'De Gevoelige Scheerder' in de map terwijl de
--   creative een founder aan het woord laat, dan klopt er iets niet — in de
--   map, in de creative, of in de lezing. Overschrijven zou die vraag
--   wegpoetsen.
--
--   Het is dezelfde scheiding die 0038 maakte tussen gemeten en ingetypt: twee
--   bronnen naast elkaar, met zichtbaar welke je ziet.
--
-- Waarom een tabel met geschiedenis en geen kolommen
--
--   Een creative kan opnieuw gelezen worden — met een beter model, met de
--   afbeelding erbij in plaats van alleen de tekst, of nadat iemand de vorige
--   lezing afkeurde. Elke lezing blijft staan; `laatste_deconstructie` toont de
--   nieuwste. Zo is achteraf te zien dat het oordeel veranderd is, in plaats
--   van dat het stilletjes anders werd.
--
-- Waarom de kolomnamen Engels zijn en de commentaren Nederlands
--
--   De veldnamen komen letterlijk uit de opdracht en verschijnen één op één in
--   het scherm, dat Engelstalig wordt. Ze vertalen zou betekenen dat er twee
--   woordenboeken ontstaan voor hetzelfde begrip. De toelichting hier is voor
--   wie de code onderhoudt, en die is in dit project Nederlands.
--
-- Wat er bewust NIET in zit
--
--   Geen performance, geen diagnose, geen aanbeveling. Dit bestand beschrijft
--   alleen wat de creative ís. Wat hij oplevert en wat je eraan zou moeten
--   veranderen zijn de volgende twee stappen, en die horen op deze laag te
--   rusten in plaats van ermee vermengd te raken.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists marketing_hq.creative_deconstructions (
  id                    bigint generated always as identity primary key,
  creative_id           bigint not null references public.creatives(id) on delete cascade,

  -- ── Wat voor advertentie is dit ──────────────────────────────────────────
  creative_type         text not null,
  core_concept          text not null,

  -- ── Op wie mikt hij ──────────────────────────────────────────────────────
  target_persona        text,
  awareness_level       text,
  marketing_angle       text,

  -- ── Hoe zegt hij het ─────────────────────────────────────────────────────
  core_messaging        text,
  hook                  text,
  narrative_perspective text,
  primary_character     text,
  visual_role           text,
  proof_mechanism       text,

  -- ── Wat vraagt hij ───────────────────────────────────────────────────────
  offer                 text,
  cta                   text,
  emotional_driver      text,

  /* Elk element is {"element": "...", "why": "..."}. De reden staat erbij en
     is niet optioneel: "Founder" zonder uitleg is een regel, "Founder — de
     hele geloofwaardigheid hangt aan een echt persoon" is een argument. Het
     scherm toont het eerste, een mens die het wil weerleggen heeft het tweede
     nodig. */
  invariants            jsonb not null default '[]'::jsonb,
  flexible              jsonb not null default '[]'::jsonb,

  -- ── Waar deze lezing op rust ─────────────────────────────────────────────
  /* Een lezing op alleen de tekst is iets anders dan een lezing mét het beeld.
     Bij een Founder Story zit de helft van het bewijs in het gezicht. Dat moet
     zichtbaar zijn, anders lijkt een halve lezing net zo stellig als een hele. */
  source                text not null default 'copy'
                        check (source in ('copy', 'image', 'copy+image')),
  confidence            text check (confidence in ('low', 'medium', 'high')),
  model                 text,
  analysed_at           timestamptz not null default now(),
  analysed_by           uuid references public.team_members(id),

  /* Een mens kan een lezing afkeuren. Dan blijft hij staan -- weggooien maakt
     onzichtbaar dát de AI ernaast zat -- maar hij telt niet meer mee. */
  rejected_at           timestamptz,
  rejected_reason       text,

  constraint deconstructie_afkeuring_heeft_reden
    check (rejected_at is null or nullif(btrim(rejected_reason), '') is not null),
  /* Vorm afdwingen op de database en niet alleen in de prompt: een model dat
     een string teruggeeft in plaats van een lijst hoort te stuiten, niet stil
     een leeg scherm op te leveren. */
  constraint deconstructie_invariants_is_lijst check (jsonb_typeof(invariants) = 'array'),
  constraint deconstructie_flexible_is_lijst   check (jsonb_typeof(flexible)   = 'array')
);

comment on table marketing_hq.creative_deconstructions is
  'Wat de AI in een bestaande advertentie leest, vóór er iets gegenereerd wordt. Staat naast public.creatives, niet erin: dat is wat een mens noteerde, dit is wat er in de creative zelf zit.';
comment on column marketing_hq.creative_deconstructions.invariants is
  'De elementen die het concept dragen. Een iteratie raakt deze niet aan.';
comment on column marketing_hq.creative_deconstructions.flexible is
  'De elementen die vrij zijn om te variëren.';
comment on column marketing_hq.creative_deconstructions.source is
  'Waar de lezing op rust. Een lezing zonder beeld is smaller dan een met beeld, en bij een Founder Story scheelt dat de helft.';

create index if not exists deconstructies_per_creative
  on marketing_hq.creative_deconstructions (creative_id, analysed_at desc);

-- ── De geldende lezing ─────────────────────────────────────────────────────
-- De nieuwste die niet is afgekeurd. Afgekeurde lezingen blijven bestaan maar
-- tellen niet mee.
create or replace view marketing_hq.laatste_deconstructie as
select distinct on (d.creative_id) d.*
from marketing_hq.creative_deconstructions d
where d.rejected_at is null
order by d.creative_id, d.analysed_at desc;

comment on view marketing_hq.laatste_deconstructie is
  'Per creative de nieuwste lezing die niet is afgekeurd. Eén rij per creative.';

-- ── Wat het scherm nodig heeft ─────────────────────────────────────────────
-- Bewust smal. De opdracht is expliciet: de volledige deconstructie mag in de
-- backend bestaan, maar het scherm toont alleen wat iemand nodig heeft om te
-- snappen wat er begrepen is. Alle zestien velden tonen is precies het soort
-- interface dat dit scherm moest vervangen.
create or replace view marketing_hq.iteration_understanding as
select
  c.id                                            as creative_id,
  c.brand,
  c.ad_name,
  d.id                                            as deconstruction_id,
  d.creative_type,
  d.core_concept,
  d.source,
  d.confidence,
  d.analysed_at,

  -- Alleen de namen voor het scherm; de reden zit in `invariants` zelf.
  coalesce(
    (select array_agg(e ->> 'element' order by ord)
       from jsonb_array_elements(d.invariants) with ordinality t(e, ord)
      where nullif(btrim(e ->> 'element'), '') is not null),
    array[]::text[])                              as keep,
  coalesce(
    (select array_agg(e ->> 'element' order by ord)
       from jsonb_array_elements(d.flexible) with ordinality t(e, ord)
      where nullif(btrim(e ->> 'element'), '') is not null),
    array[]::text[])                              as flexible,

  d.invariants                                    as keep_detail,
  d.flexible                                      as flexible_detail,

  /* Geen invariants betekent dat een iteratie álles mag veranderen. Dat is
     zelden waar en nooit iets om stil te laten: dan verdwijnt precies de
     bescherming waarvoor deze hele laag bestaat. */
  (jsonb_array_length(d.invariants) = 0)          as nothing_protected
from public.creatives c
join marketing_hq.laatste_deconstructie d on d.creative_id = c.id;

comment on view marketing_hq.iteration_understanding is
  'Wat het iteratiescherm toont: het type, het concept in één zin, en de twee lijsten. De rest van de deconstructie blijft in de backend.';

-- ── Rechten ────────────────────────────────────────────────────────────────
alter table marketing_hq.creative_deconstructions enable row level security;

drop policy if exists team_read_deconstructies on marketing_hq.creative_deconstructions;
create policy team_read_deconstructies on marketing_hq.creative_deconstructions
  for select using (marketing_hq.is_team_member());

grant select on marketing_hq.creative_deconstructions to authenticated;
grant select on marketing_hq.laatste_deconstructie    to authenticated;
grant select on marketing_hq.iteration_understanding  to authenticated;

create or replace view public.hq_iteration_understanding
with (security_invoker = true) as
select * from marketing_hq.iteration_understanding;

grant select on public.hq_iteration_understanding to authenticated;
