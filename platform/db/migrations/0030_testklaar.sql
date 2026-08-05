-- ═══════════════════════════════════════════════════════════════════════════
-- 0030 — Een variant testklaar maken
--
-- Wat er vandaag gebeurt na een generatie: de variant staat in het geheugen,
-- gaat naar de bibliotheek als blob in localStorage, en daarmee houdt het op.
-- De Creative Strategy-tabel (public.creatives) krijgt alleen rijen uit de
-- Scriptwriter — statics komen daar nooit.
--
-- Wat er daarbij verloren gaat, geteld en niet geschat:
--
--   * Het hele Rory-interview. Kernpijn, echte vijand, kernbezwaar, gewenste
--     na-situatie: dat wordt in de modal opgebouwd en verdwijnt als hij dicht
--     gaat. Nergens opgeslagen, in geen enkele vorm.
--   * hypothese_nl en reasoning_nl per variatie. Het model schrijft ze, ze
--     staan in de bibliotheek-blob, en ze zijn niet te doorzoeken.
--   * image_prompt_en, visual_nl, de Theriot-aanscherping.
--   * Market sophistication. Die wordt nergens vastgelegd — niet in de console,
--     niet in de database. Dit is het enige veld uit de opdracht dat werkelijk
--     nieuw is.
--   * hypothesis, test_variable en parent_id: de Scriptwriter schrijft ze al
--     mee en public.creatives heeft die kolommen niet. De code vangt dat op,
--     gooit de drie velden weg en probeert het opnieuw — dus het lukt, zonder
--     hypothese, zonder melding. Dat draait al weken zo.
--
-- Wat er hergebruikt wordt en dus NIET opnieuw gebouwd:
--
--   * public.creatives is de Creative Strategy-tabel. Die blijft dat.
--   * marketing_hq.werkstukken + denkstukken beantwoorden zeven vragen die
--     grotendeels de testcontext ál zijn: hoek, probleem, persona, hypothese,
--     format, wat getest moet worden, waarom nu. Inclusief een zekerheid per
--     antwoord (onderbouwd / aanname / open) — precies de eisen 27, 28 en 29.
--   * creatives.werkstuk_id bestaat al sinds 0009.
--   * werkstuk_stappen, overdrachten en criticus_oordelen zijn de besluiten;
--     agent_messages zijn de discussies; creative_results en angle_learnings
--     zijn de uitkomst.
--
-- De verdeling die daaruit volgt, en die de rest van deze migratie stuurt:
-- wat per variant verschilt hoort op de creative, wat de hele batch deelt
-- hoort op het werkstuk. Kernpijn en kernbezwaar zijn van het idee, niet van
-- variant 3. Headline en image prompt zijn van variant 3, niet van het idee.
--
-- Daarom maakt "klaarzetten voor test" ook een werkstuk aan als er nog geen is:
-- dat is wat eis 4 ("nooit los van zijn testcontext") afdwingbaar maakt, en het
-- voorkomt een tweede systeem naast de werkbank.
--
-- Additief. Bestaande rijen en views blijven werken.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De statussen, als data ──────────────────────────────────────────────
-- In een tabel en niet als CHECK, om dezelfde reden als werkstuk_stations: een
-- status erbij is inhoud, geen implementatie. Bovendien heeft elke status hier
-- een betekenis en een fase, en die horen op één plek te staan in plaats van
-- verspreid over een dropdown, een view en iemands hoofd.
create table if not exists marketing_hq.creative_statussen (
  status     text primary key,
  volgorde   smallint not null,
  fase       text not null check (fase in ('maken','beoordelen','draaien','oordeel')),
  betekenis  text not null,
  -- Vanaf welke status er een toetsbare test onder moet liggen. Alles in de
  -- fase 'maken' mag nog rammelen; daarna niet meer.
  vraagt_test boolean not null default false
);

insert into marketing_hq.creative_statussen (status, volgorde, fase, betekenis, vraagt_test) values
  ('Concept',                10, 'maken',      'Gemaakt, nog niet ingediend. Mag onaf zijn.',                         false),
  ('Klaar voor review',      20, 'beoordelen', 'Ingediend door de maker, wacht op een oordeel.',                      true),
  ('Goedgekeurd voor test',  30, 'beoordelen', 'Doorgelaten. Mag klaargezet worden bij het advertentieplatform.',     true),
  ('Klaar voor publicatie',  40, 'draaien',    'Klaargezet bij Meta, wacht op een mens die hem live zet.',            true),
  ('Live',                   50, 'draaien',    'Draait en geeft geld uit.',                                           true),
  ('Nog niet beoordeelbaar', 60, 'draaien',    'Draait, maar onder de drempel van 0008: te kort, te weinig besteed.', true),
  ('Beoordeelbaar',          70, 'oordeel',    'Genoeg data om iets te mogen zeggen.',                                true),
  ('Winner',                 80, 'oordeel',    'Beter dan zijn soortgenoten. Kandidaat om op te schalen.',            true),
  ('Middelmatig',            81, 'oordeel',    'Doet het niet slecht en niet goed. Levert geen learning op.',         true),
  ('Verliezer',              82, 'oordeel',    'Onder de mediaan van zijn soortgenoten.',                             true),
  ('Itereren',               83, 'oordeel',    'Iets werkte; er gaat een variant op door.',                           true),
  ('Gestopt',                90, 'oordeel',    'Bewust stopgezet, met een reden.',                                    false)
on conflict (status) do nothing;

comment on table marketing_hq.creative_statussen is
  'De levensloop van een creative, van concept tot oordeel. Als data, want een status erbij is inhoud en geen deploy.';
comment on column marketing_hq.creative_statussen.vraagt_test is
  'Vanaf hier moet er een toetsbare test onder liggen: hypothese, testvariabele en een werkstuk.';

alter table marketing_hq.creative_statussen enable row level security;
do $$ begin
  create policy statussen_lezen on marketing_hq.creative_statussen for select using (true);
exception when duplicate_object then null; end $$;
grant select on marketing_hq.creative_statussen to authenticated, anon;

-- De bestaande waarde 'To Test' hoort bij het oude vocabulaire. Alle zeven
-- rijen op productie staan erop, en ze zijn allemaal nooit gedraaid: dat is
-- 'Concept' in de nieuwe woorden.
update public.creatives set status = 'Concept' where status = 'To Test';
update public.creatives set status = 'Concept' where status is null;

-- ── 2. De testcontext op de creative ───────────────────────────────────────
-- Alleen wat per variant verschilt. Wat de batch deelt staat op het werkstuk.
alter table public.creatives
  add column if not exists hypothesis            text,
  add column if not exists test_variable         text,
  add column if not exists parent_id             bigint references public.creatives(id) on delete set null,
  add column if not exists market_sophistication text,
  add column if not exists funnel_stage          text,
  add column if not exists headline              text,
  add column if not exists body_copy             text,
  add column if not exists cta                   text,
  add column if not exists visual_concept        text,
  add column if not exists image_prompt          text,
  add column if not exists rory_reasoning        text,
  add column if not exists theriot_reasoning     text,
  add column if not exists bronnen               jsonb not null default '[]'::jsonb,
  add column if not exists denkstuk_id           bigint references marketing_hq.denkstukken(id) on delete set null,
  add column if not exists klaargezet_door       uuid references public.team_members(id),
  add column if not exists klaargezet_op         timestamptz;

comment on column public.creatives.hypothesis is
  'Als we X, dan Y, omdat Z. Zonder dit is een afbeelding geen test.';
comment on column public.creatives.test_variable is
  'Wat er precies anders is aan deze variant, en dus wat de meting moet uitwijzen. Een hypothese zonder dit is niet toetsbaar.';
comment on column public.creatives.market_sophistication is
  'Hoeveel van deze belofte de markt al gehoord heeft (1-5). Het enige veld uit de opdracht dat nergens bestond.';
comment on column public.creatives.bronnen is
  'Waar de onderbouwing op rust: eerdere learnings, reviews, een trendscan. Leeg betekent: dit rust op smaak.';
comment on column public.creatives.parent_id is
  'De creative waar deze uit voortkwam bij een iteratie. Zo is een reeks terug te lezen.';

-- Het oude vocabulaire hield status vrij. Nu moet hij bestaan.
alter table public.creatives drop constraint if exists creatives_status_bekend;
alter table public.creatives
  add constraint creatives_status_bekend
  foreign key (status) references marketing_hq.creative_statussen(status)
  on update cascade not valid;

-- ── 3. Een afbeelding zonder hypothese is geen test ────────────────────────
-- Eis 5 en 6 uit de opdracht, en ze zijn alleen iets waard als ze in de weg
-- kunnen zitten. Daarom als trigger op de overgang: zolang je in de fase
-- 'maken' zit mag alles onaf zijn, daarna niet meer.
--
-- Op de overgang en niet op de rij, om dezelfde reden als in 0022: bestaande
-- rijen terugwerkend afkeuren breekt werk dat er al ligt.
create or replace function marketing_hq.creative_testklaar()
returns trigger language plpgsql as $$
declare eist boolean; ontbreekt text[];
begin
  select vraagt_test into eist
  from marketing_hq.creative_statussen where status = new.status;

  if not coalesce(eist, false) then return new; end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;

  ontbreekt := array[]::text[];
  if new.hypothesis is null or length(trim(new.hypothesis)) = 0 then
    ontbreekt := ontbreekt || 'een hypothese (als we X, dan Y, omdat Z)';
  end if;
  if new.test_variable is null or length(trim(new.test_variable)) = 0 then
    ontbreekt := ontbreekt || 'een testvariabele: wat is er precies anders aan deze variant';
  end if;
  if new.werkstuk_id is null then
    ontbreekt := ontbreekt || 'een werkstuk om aan te hangen — een creative gaat niet los van zijn context';
  end if;

  if array_length(ontbreekt, 1) > 0 then
    raise exception 'Deze creative is niet testklaar. Er ontbreekt: %', array_to_string(ontbreekt, '; ')
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists creative_testklaar_trg on public.creatives;
create trigger creative_testklaar_trg
  before insert or update on public.creatives
  for each row execute function marketing_hq.creative_testklaar();

-- ── 4. De naam ─────────────────────────────────────────────────────────────
-- WS.Product.Persona.Angle.01 — een voorstel, geen dwang. De gebruiker mag hem
-- veranderen voordat hij bevestigt; wat hier staat is alleen wat het systeem
-- aanbiedt als hij niets doet.
--
-- Het volgnummer telt binnen merk + product + persona + hoek, want dat is waar
-- "de tweede van deze soort" iets betekent. Telt hij over het hele merk, dan
-- zegt .07 niets.
-- Twee hulpfuncties eerst: accenten eruit, dan alles wat geen letter of cijfer
-- is naar een streepje. Een naam die je niet kunt overtypen is geen naam.
-- unaccent is een extensie die er niet altijd is; dit doet genoeg voor NL.
create or replace function marketing_hq.unaccent_of(p text)
returns text language sql immutable as $$
  select translate(coalesce(p, ''),
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
    'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYNC')
$$;

create or replace function marketing_hq.naam_deel(p text)
returns text language sql immutable as $$
  select coalesce(nullif(
    regexp_replace(
      regexp_replace(marketing_hq.unaccent_of(coalesce(p, '')), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'),
    ''), 'onbekend')
$$;

create or replace function marketing_hq.ad_naam_voorstel(
  p_brand text, p_product text, p_persona text, p_angle text
) returns text language plpgsql stable as $$
declare voorvoegsel text; basis text; n int;
begin
  voorvoegsel := case lower(coalesce(p_brand, '')) when 'wellshine' then 'WLS' else 'WS' end;
  basis := voorvoegsel
        || '.' || marketing_hq.naam_deel(p_product)
        || '.' || marketing_hq.naam_deel(p_persona)
        || '.' || marketing_hq.naam_deel(p_angle);

  select count(*) + 1 into n
  from public.creatives c
  where c.brand = p_brand and c.ad_name like basis || '.%';

  return basis || '.' || lpad(n::text, 2, '0');
end $$;

comment on function marketing_hq.ad_naam_voorstel(text, text, text, text) is
  'Een voorstel volgens de merkconventie. De gebruiker houdt de eindnaam in eigen hand; dit is wat er staat als hij niets verandert.';

-- Twee keer dezelfde naam binnen een merk is geen detail: dan wijst een
-- verwijzing uit een rapport naar twee dingen. Alleen waar een naam staat.
create unique index if not exists creatives_naam_uniek_per_merk
  on public.creatives (brand, ad_name)
  where ad_name is not null and length(trim(ad_name)) > 0;

-- ── 5. De testkaart ────────────────────────────────────────────────────────
-- Wat de controle vóór verzending toont, en later het dossier. Eén view, want
-- twee schermen die hetzelfde tonen uit twee queries lopen uit elkaar.
--
-- De onderbouwing komt uit het denkstuk en wordt niet opnieuw ingevuld: daar
-- staat per vraag al of het antwoord onderbouwd, een aanname of open is.
create or replace view marketing_hq.testkaart as
select
  c.id                                   as creative_id,
  c.brand, c.ad_name, c.product, c.persona,
  c.angle_type, c.marketing_angle,
  c.awareness_level, c.market_sophistication, c.funnel_stage,
  c.format, c.media_type, c.channel,
  c.headline, c.body_copy, c.cta, c.visual_concept, c.image_prompt,
  (c.image_b64 is not null)              as heeft_beeld,
  c.hypothesis, c.test_variable,
  c.rory_reasoning, c.theriot_reasoning, c.bronnen,
  c.status,
  s.fase                                 as status_fase,
  s.betekenis                            as status_betekenis,
  s.volgorde                             as status_volgorde,
  c.parent_id, c.werkstuk_id, c.denkstuk_id,
  c.user_name                            as gemaakt_door,
  tm.full_name                           as klaargezet_door,
  c.klaargezet_op, c.created_at, c.date_live,
  c.roas, c.ctr, c.hook_rate, c.conversions, c.budget, c.score, c.next_step,

  w.titel                                as werkstuk,
  w.status                               as werkstuk_status,

  -- Waar de onderbouwing op staat, geteld uit het denkstuk zelf.
  d.status                               as denkstuk_status,
  coalesce(a.onderbouwd, 0)              as onderbouwd,
  coalesce(a.aanname, 0)                 as aanname,
  coalesce(a.open_gelaten, 0)            as open_gelaten,
  case
    when d.id is null                    then 'geen denkstuk — deze test rust nergens op'
    when coalesce(a.onderbouwd, 0) = 0   then 'niets is gemeten; alles rust op aannames'
    else coalesce(a.onderbouwd, 0) || ' van de ' || coalesce(a.totaal, 0) || ' antwoorden zijn onderbouwd'
  end                                    as onderbouwing,

  -- Wat deze creative tegenhoudt, in dezelfde woorden als de werkbank.
  case
    when c.hypothesis is null or length(trim(c.hypothesis)) = 0
      then 'geen hypothese — een afbeelding zonder hypothese is geen test'
    when c.test_variable is null or length(trim(c.test_variable)) = 0
      then 'geen testvariabele — dan is achteraf niet te zeggen wát het deed'
    when c.werkstuk_id is null
      then 'niet aan een werkstuk gekoppeld'
    else null
  end                                    as niet_testklaar
from public.creatives c
left join marketing_hq.creative_statussen s on s.status = c.status
left join marketing_hq.werkstukken w        on w.id = c.werkstuk_id
left join marketing_hq.denkstukken d        on d.id = c.denkstuk_id
left join public.team_members tm            on tm.id = c.klaargezet_door
left join lateral (
  select count(*) as totaal,
         count(*) filter (where zekerheid = 'onderbouwd')  as onderbouwd,
         count(*) filter (where zekerheid = 'aanname')     as aanname,
         count(*) filter (where zekerheid = 'open')        as open_gelaten
  from marketing_hq.denkstuk_antwoorden x where x.denkstuk_id = d.id
) a on true;

comment on view marketing_hq.testkaart is
  'Alles wat een variant testklaar maakt, op één plek: de context, de onderbouwing uit het denkstuk, en wat er nog ontbreekt.';

alter view marketing_hq.testkaart set (security_invoker = true);
grant select on marketing_hq.testkaart to authenticated;

drop view if exists public.hq_testkaart;
create view public.hq_testkaart with (security_invoker = true)
  as select * from marketing_hq.testkaart;
revoke all on public.hq_testkaart from anon, public;
grant select on public.hq_testkaart to authenticated;

grant execute on function marketing_hq.ad_naam_voorstel(text, text, text, text) to authenticated;
grant execute on function marketing_hq.naam_deel(text)   to authenticated;
grant execute on function marketing_hq.unaccent_of(text) to authenticated;

-- ── Terugdraaien ───────────────────────────────────────────────────────────
--   drop view if exists public.hq_testkaart, marketing_hq.testkaart;
--   drop trigger if exists creative_testklaar_trg on public.creatives;
--   alter table public.creatives drop constraint if exists creatives_status_bekend;
--   drop index if exists creatives_naam_uniek_per_merk;
--   update public.creatives set status = 'To Test' where status = 'Concept';
-- De kolommen laten staan: ze bevatten dan al werk dat nergens anders staat.
