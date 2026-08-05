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
-- status erbij is inhoud, geen implementatie.
--
-- Elke status moet minstens één ding anders doen dan zijn buren: een andere
-- verantwoordelijke, een andere toegestane handeling, een andere grendel, een
-- andere betekenis, of een andere volgende stap. Daarom staan verantwoordelijke
-- en volgende stap hier als kolom en niet in iemands hoofd — dan is het verschil
-- na te lopen in plaats van te geloven.
--
-- Twee zijn er langs die lat gesneuveld. "Nog niet beoordeelbaar" en
-- "Beoordeelbaar" hadden dezelfde verantwoordelijke (Atlas meet), dezelfde
-- handeling (geen), dezelfde grendel en dezelfde volgende stap (wachten tot de
-- drempel gehaald is). Ze verschilden alleen in een feit dat 0008 al UITREKENT
-- uit de metingen: vier dagen, vijftig euro, duizend vertoningen. Dat als status
-- laten intypen levert twee waarheden op die uit elkaar lopen zodra iemand
-- vergeet bij te werken. Ze zijn samengevoegd tot 'Live'; of een advertentie
-- beoordeelbaar is, blijft afgeleid en staat in creative_performance.
create table if not exists marketing_hq.creative_statussen (
  status            text primary key,
  volgorde          smallint not null,
  fase              text not null check (fase in ('maken','beoordelen','draaien','oordeel')),
  betekenis         text not null,
  verantwoordelijke text not null,
  volgende_stap     text not null,
  -- Vanaf welke status er een toetsbare test onder moet liggen. Alles in de
  -- fase 'maken' mag nog rammelen; daarna niet meer.
  vraagt_test       boolean not null default false
);

insert into marketing_hq.creative_statussen
  (status, volgorde, fase, betekenis, verantwoordelijke, volgende_stap, vraagt_test) values
  ('Concept',               10, 'maken',      'Gemaakt, nog niet ingediend. Mag onaf zijn.',
      'de maker',       'indienen voor review, of laten liggen',                    false),
  ('Klaar voor review',     20, 'beoordelen', 'Ingediend, wacht op een oordeel.',
      'de Criticus',    'een oordeel: door of niet door, met de reden',             true),
  ('Goedgekeurd voor test', 30, 'beoordelen', 'Doorgelaten. Mag klaargezet worden bij Meta.',
      'Bolt',           'beeld uploaden en de ad-creative aanmaken',                true),
  ('Klaar voor publicatie', 40, 'draaien',    'Klaargezet bij Meta. Kost nog niets, wordt niet vertoond.',
      'jij',            'live zetten — dit is de poort waar geld begint te lopen',  true),
  ('Live',                  50, 'draaien',    'Draait en geeft geld uit. Of hij al beoordeelbaar is, rekent 0008 uit.',
      'Atlas',          'meten tot de drempel gehaald is, dan oordelen',            true),
  ('Winner',                60, 'oordeel',    'Beter dan zijn soortgenoten.',
      'jij',            'opschalen, en de learning vastleggen op de hoek',          true),
  ('Middelmatig',           61, 'oordeel',    'Niet slecht, niet goed. Levert geen learning op.',
      'jij',            'laten lopen of vervangen — hier valt niets uit te leren',  true),
  ('Verliezer',             62, 'oordeel',    'Onder de mediaan van zijn soortgenoten.',
      'jij',            'uitzetten, en vastleggen wat niet werkte',                 true),
  ('Itereren',              63, 'oordeel',    'Iets werkte; er gaat een variant op door.',
      'de maker',       'een variant maken met parent_id naar deze',                true),
  ('Gestopt',               90, 'oordeel',    'Bewust stopgezet, met een reden.',
      'niemand',        'niets — dit is een eindpunt',                              false)
on conflict (status) do update set
  volgorde = excluded.volgorde, fase = excluded.fase, betekenis = excluded.betekenis,
  verantwoordelijke = excluded.verantwoordelijke, volgende_stap = excluded.volgende_stap,
  vraagt_test = excluded.vraagt_test;

-- Mocht een eerdere versie van deze migratie de twee afgeleide statussen al
-- gezet hebben: ze worden 'Live', want dat is wat ze betekenden.
update public.creatives set status = 'Live'
 where status in ('Nog niet beoordeelbaar', 'Beoordeelbaar');
delete from marketing_hq.creative_statussen
 where status in ('Nog niet beoordeelbaar', 'Beoordeelbaar');

comment on table marketing_hq.creative_statussen is
  'De levensloop van een creative. Elke status verschilt van zijn buren in verantwoordelijke, handeling, grendel, betekenis of volgende stap — anders hoort hij er niet te staan.';
comment on column marketing_hq.creative_statussen.vraagt_test is
  'Vanaf hier moet er een toetsbare test onder liggen: hypothese, testvariabele en een werkstuk.';
comment on column marketing_hq.creative_statussen.verantwoordelijke is
  'Wie er aan zet is. Twee statussen met dezelfde verantwoordelijke, handeling en volgende stap zijn één status.';

-- De console moet de lijst kunnen lezen: zonder deze view zou hij zijn eigen
-- statuslijst moeten bijhouden, en dan is er weer een tweede waarheid.
drop view if exists public.hq_creative_statussen;
create view public.hq_creative_statussen with (security_invoker = true)
  as select * from marketing_hq.creative_statussen;
grant select on public.hq_creative_statussen to authenticated, anon;

alter table marketing_hq.creative_statussen enable row level security;
do $$ begin
  create policy statussen_lezen on marketing_hq.creative_statussen for select using (true);
exception when duplicate_object then null; end $$;
grant select on marketing_hq.creative_statussen to authenticated, anon;

-- Hier stond een automatische omzetting van 'To Test' naar 'Concept'. Die is
-- eruit gehaald, en dat is een inhoudelijk besluit en geen voorzichtigheid:
--
--   'To Test' betekende in het oude vocabulaire zowel "gemaakt, ligt te
--   wachten" (Concept) als "ingediend, wacht op een oordeel" (Klaar voor
--   review). Welke van de twee het is, staat nergens in de rij — dat weet
--   alleen de mens die hem maakte.
--
-- Een migratie die dan tóch kiest, verzint een feit en zet het als waarheid in
-- de database. De zeven bestaande rijen blijven daarom op 'To Test' staan. De
-- foreign key hieronder is NOT VALID, dus dat mag; de console toont ze als
-- verouderd en vraagt om een bewuste keuze bij de eerstvolgende bewerking.

-- ── 2. De testcontext op de creative ───────────────────────────────────────
-- Alleen wat per variant verschilt. Wat de batch deelt staat op het werkstuk.
alter table public.creatives
  add column if not exists hypothesis            text,
  add column if not exists test_variable         text,
  add column if not exists parent_id             bigint references public.creatives(id) on delete set null,
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

-- ── 2b. Market sophistication, op het werkstuk ─────────────────────────────
-- Zes vragen die eerst beantwoord moesten worden, want een los tekstveld erbij
-- zetten maakt het een invulveld en geen oordeel:
--
--   Waar hoort het?   Op het WERKSTUK. Sophistication is een eigenschap van de
--                     markt en de belofte, niet van variant 3. Vier varianten
--                     op dezelfde hoek delen hem per definitie; op de creative
--                     zou je hem vier keer intypen en drie keer verkeerd.
--   Welke waarden?    De vijf van Schwartz, als data hieronder. Niet vrij, want
--                     een schaal waar iedereen zijn eigen woord voor kiest is
--                     geen schaal en kun je niet groeperen in een analyse.
--   Wie stelt voor?   Nova. Zij doet station ② en heeft de markt al bekeken;
--                     Radar levert haar het materiaal.
--   Welke bron?       De redenering is verplicht bij een voorstel. Zonder is
--                     het een getal dat niemand kan wegen.
--   Mens verplicht?   Ja. Een agent mag voorstellen, een mens bevestigt — en
--                     dat staat hier in de vorm van de tabel, net als bij het
--                     denkstuk: er is geen kolom waar een agent kan tekenen.
--   Later in analyse? Als groepering naast hoek en persona. Twee advertenties
--                     op niveau 2 en niveau 4 vergelijken zegt niets; binnen
--                     hetzelfde niveau wel.
create table if not exists marketing_hq.sophistication_niveaus (
  niveau      smallint primary key check (niveau between 1 and 5),
  naam        text not null,
  betekenis   text not null,
  wat_werkt   text not null
);

insert into marketing_hq.sophistication_niveaus (niveau, naam, betekenis, wat_werkt) values
  (1, 'nieuw',        'De markt kent het probleem of de oplossing nog niet.',
      'De simpele claim. Noem gewoon wat het doet.'),
  (2, 'claim-race',   'Concurrenten roepen hetzelfde; wie hardst roept wint even.',
      'Dezelfde claim, maar groter of specifieker. Een getal.'),
  (3, 'mechanisme',   'De markt gelooft de claims niet meer.',
      'Uitleggen HOE het werkt. Een nieuw mechanisme maakt een oude claim weer geloofwaardig.'),
  (4, 'mechanisme+',  'Ook de mechanismes zijn uitgekauwd.',
      'Het mechanisme beter, sneller of makkelijker maken. Bewijs erbij.'),
  (5, 'identificatie','De markt is alles zat en luistert alleen nog naar wie op hen lijkt.',
      'Wie je bent in plaats van wat je doet. Persona, verhaal, sociaal bewijs.')
on conflict (niveau) do nothing;

comment on table marketing_hq.sophistication_niveaus is
  'De vijf niveaus van Schwartz, met wat er op elk niveau werkt. Als data omdat een schaal waar iedereen zijn eigen woord voor kiest geen schaal is.';

grant select on marketing_hq.sophistication_niveaus to authenticated;

alter table marketing_hq.werkstukken
  add column if not exists sophistication            smallint
    references marketing_hq.sophistication_niveaus(niveau),
  add column if not exists sophistication_reden      text,
  add column if not exists sophistication_door_agent text references marketing_hq.agents(id),
  add column if not exists sophistication_door_mens  uuid references public.team_members(id),
  add column if not exists sophistication_bevestigd_door uuid references public.team_members(id),
  add column if not exists sophistication_bevestigd_op   timestamptz;

-- Een voorstel zonder redenering is een getal dat niemand kan wegen.
alter table marketing_hq.werkstukken drop constraint if exists sophistication_heeft_reden;
alter table marketing_hq.werkstukken
  add constraint sophistication_heeft_reden
  check (sophistication is null
         or (sophistication_reden is not null and length(trim(sophistication_reden)) > 0));

-- Precies één voorsteller, zelfde patroon als 0021, 0022 en 0023.
alter table marketing_hq.werkstukken drop constraint if exists sophistication_een_voorsteller;
alter table marketing_hq.werkstukken
  add constraint sophistication_een_voorsteller
  check (sophistication is null
         or (sophistication_door_agent is null) <> (sophistication_door_mens is null));

-- Bevestigen kan alleen een mens, en alleen als er iets te bevestigen is.
alter table marketing_hq.werkstukken drop constraint if exists sophistication_bevestiging;
alter table marketing_hq.werkstukken
  add constraint sophistication_bevestiging
  check (sophistication_bevestigd_door is null
         or (sophistication is not null and sophistication_bevestigd_op is not null));

comment on column marketing_hq.werkstukken.sophistication is
  'Hoeveel van deze belofte de markt al gehoord heeft. Een voorstel van Nova telt niet als vastgesteld tot een mens tekent.';
comment on column marketing_hq.werkstukken.sophistication_bevestigd_door is
  'Een teamlid. Er is met opzet geen agent-variant van deze kolom.';

-- ── 2c. Het Rory-interview en de ingeving die eraan voorafging ─────────────
-- Het interview verdween tot nu toe met de modal. Het hoort op het werkstuk en
-- niet op de creative: kernpijn en kernbezwaar zijn van het idee, en vier
-- varianten op dezelfde hoek delen ze.
--
-- Als één jsonb-kolom en niet als vijf tekstkolommen, om één reden: het
-- interview is ruw materiaal. Het denkstuk is de gewogen versie ervan, met een
-- zekerheid per antwoord. Kernpijn als kolom náást denkstuk-antwoord 2 zou
-- twee waarheden opleveren die uit elkaar lopen zodra iemand er één bijwerkt.
-- Zo staat het er één keer als bron en één keer als oordeel — dat is geen
-- duplicatie maar het verschil tussen wat er gezegd is en wat wij ervan vinden.
alter table marketing_hq.werkstukken
  add column if not exists rory_interview jsonb not null default '{}'::jsonb,
  add column if not exists mens_ingeving  text;

comment on column marketing_hq.werkstukken.rory_interview is
  'Het ruwe interview: kernpijn, echte vijand, kernbezwaar, gewenste na-situatie, en wat er verder uit kwam. Bron, geen oordeel — het gewogen antwoord staat in het denkstuk.';
comment on column marketing_hq.werkstukken.mens_ingeving is
  'Waar het mee begon, in de woorden van de mens die het bedacht. Zonder dit is achteraf niet te zien of een agent een idee opving of zelf verzon.';

-- ── 2d. Plaatsing en productreferenties, per variant ───────────────────────
-- Wél op de creative: een 4:5 voor de feed en een 9:16 voor Stories zijn twee
-- varianten van hetzelfde idee, en welke productfoto's erin gingen verschilt
-- per beeld.
alter table public.creatives
  add column if not exists placement    text,
  add column if not exists product_refs jsonb not null default '[]'::jsonb;

comment on column public.creatives.placement is
  'Waar deze advertentie getoond wordt: feed, stories, reels. Leeg betekent: niet vastgelegd, niet "overal".';
comment on column public.creatives.product_refs is
  'De productbeelden die als referentie in de generatie gingen. Zo is achteraf te zien wat het model gezien heeft.';

-- ── 2e. De learning, ná het oordeel ────────────────────────────────────────
-- Deze velden staan bewust leeg tot er een verdict ligt. Ze invullen vóór de
-- meting is precies de fout die deze hele migratie probeert te voorkomen: een
-- conclusie die op een verwachting rust in plaats van op een uitkomst.
--
-- Bevestigen kan alleen een mens, zelfde vorm als het denkstuk en
-- sophistication: er is geen kolom waar een agent kan tekenen.
alter table public.creatives
  add column if not exists learning_kern         text,
  add column if not exists learning_behouden     text,
  add column if not exists learning_veranderen   text,
  add column if not exists iteratie_voorstel     text,
  add column if not exists vervolgtests          text,
  add column if not exists learning_door_agent   text references marketing_hq.agents(id),
  add column if not exists learning_bevestigd_door uuid references public.team_members(id),
  add column if not exists learning_bevestigd_op   timestamptz;

alter table public.creatives drop constraint if exists creatives_learning_bevestiging;
alter table public.creatives
  add constraint creatives_learning_bevestiging
  check (learning_bevestigd_door is null
         or (learning_bevestigd_op is not null
             and learning_kern is not null and length(trim(learning_kern)) > 0))
  not valid;

comment on column public.creatives.learning_kern is
  'Wat we hieruit geleerd hebben. Pas in te vullen als er gemeten is; een learning zonder meting is een mening.';
comment on column public.creatives.learning_bevestigd_door is
  'Een teamlid. Een agent mag een learning voorstellen; vastgesteld is hij pas als een mens tekent.';

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
    ontbreekt := array_append(ontbreekt, 'een hypothese (als we X, dan Y, omdat Z)');
  end if;
  if new.test_variable is null or length(trim(new.test_variable)) = 0 then
    ontbreekt := array_append(ontbreekt, 'een testvariabele: wat is er precies anders aan deze variant');
  end if;
  if new.werkstuk_id is null then
    ontbreekt := array_append(ontbreekt, 'een werkstuk om aan te hangen — een creative gaat niet los van zijn context');
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
-- De vorm staat als data per merk en niet in de functie. Niet omdat er vandaag
-- twee vormen nodig zijn — er is er één — maar omdat "voorlopig" in de opdracht
-- staat, en een voorlopige afspraak die je in code giet is over een half jaar
-- een deploy waard. Zo is het een rij.
create table if not exists marketing_hq.naam_conventie (
  brand        text primary key,
  voorvoegsel  text not null,
  patroon      text not null,
  toelichting  text not null
);

insert into marketing_hq.naam_conventie (brand, voorvoegsel, patroon, toelichting) values
  ('wellshave', 'WS',  '{voorvoegsel}.{product}.{persona}.{angle}.{nr}',
     'Voorlopige afspraak van 4 augustus. Het volgnummer telt binnen dezelfde combinatie.'),
  ('wellshine', 'WLS', '{voorvoegsel}.{product}.{persona}.{angle}.{nr}',
     'Zelfde vorm, ander voorvoegsel.')
on conflict (brand) do nothing;

grant select on marketing_hq.naam_conventie to authenticated;
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
  select n.voorvoegsel into voorvoegsel
  from marketing_hq.naam_conventie n where n.brand = lower(coalesce(p_brand, ''));
  -- Een onbekend merk krijgt WS in plaats van een fout: een naamvoorstel hoort
  -- nooit de reden te zijn dat iemand niet verder kan.
  voorvoegsel := coalesce(voorvoegsel, 'WS');
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
  c.awareness_level, c.funnel_stage,
  c.format, c.media_type, c.channel,
  c.headline, c.body_copy, c.cta, c.visual_concept, c.image_prompt,
  (c.image_b64 is not null)              as heeft_beeld,
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
  -- Wie er nu aan zet is en wat het volgende is, komt uit de statustabel en
  -- nergens anders: één waarheid over status, ook over wat hij betekent.
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
  end                                    as niet_testklaar,

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
-- Het laatste oordeel van de agents over deze advertentie. Staat er als kolom
-- omdat het in de tabel scanbaar moet zijn; de redenering hoort in het dossier.
left join lateral (
  select mr.verdict, mr.action as verdict_actie, mr.reasoning as verdict_reden,
         mr.created_at as verdict_op
  from marketing_hq.meta_recommendations mr
  where mr.creative_id = c.id
  order by mr.created_at desc limit 1
) v on true;

comment on view marketing_hq.testkaart is
  'Alles wat een variant testklaar maakt, op één plek: de context, de onderbouwing uit het denkstuk, en wat er nog ontbreekt.';

alter view marketing_hq.testkaart set (security_invoker = true);
-- Een security_invoker-view leest met de rechten van wie kijkt. Elke tabel die
-- de testkaart en het dossier aanraken heeft dus zelf een leesrecht nodig,
-- anders krijgt een teamlid "permission denied" op een view die er wél is.
-- Dat is precies de fout die je pas in productie ziet, dus staat hij hier.
grant select on marketing_hq.meta_recommendations to authenticated;
grant select on marketing_hq.meta_publications    to authenticated;
grant select on marketing_hq.creative_results     to authenticated;
grant select on marketing_hq.angle_learnings      to authenticated;
grant select on marketing_hq.agent_messages       to authenticated;
grant select on marketing_hq.werkstuk_stappen     to authenticated;
grant select on marketing_hq.werkstuk_stations    to authenticated;
grant select on marketing_hq.werkstuk_overdrachten to authenticated;
grant select on marketing_hq.werkstukken          to authenticated;

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

-- ── 6. Klaarzetten voor test, als één handeling ────────────────────────────
-- De console mag marketing_hq alleen lezen. Dat blijft zo: er komt geen
-- schrijfrecht op werkstukken bij, want dan kan elke tab in elke browser de
-- estafette aanpassen. In plaats daarvan één functie die het hele gebaar doet
-- en de regels bewaakt.
--
-- Dat is ook inhoudelijk beter. "Klaarzetten voor test" is één besluit, geen
-- vier inserts die elk half kunnen slagen: zonder werkstuk geen creative,
-- zonder denkstuk geen context, en een naam die dubbel blijkt hoort de hele
-- handeling te stoppen in plaats van er een tweede rij naast te zetten.
--
-- security definer, en daarom expliciet: de aanroeper moet een goedgekeurd
-- teamlid zijn. Zonder die regel kan iedereen met een inlog schrijven in het
-- schema dat de agents aansturen.
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
  -- 1. Wie ben je, en mag je dit.
  select tm.id into v_mens
  from public.team_members tm
  where tm.id = auth.uid() and tm.status = 'approved';
  if v_mens is null then
    raise exception 'Alleen een goedgekeurd teamlid kan een variant testklaar maken.'
      using errcode = 'insufficient_privilege';
  end if;

  -- 2. De naam. Voorgesteld door het systeem, maar wat hier binnenkomt is wat
  --    de gebruiker heeft laten staan of aangepast — de bevestiging zit in de
  --    aanroep. Leeg betekent: doe maar een voorstel.
  v_naam := nullif(trim(coalesce(p->>'ad_name', '')), '');
  if v_naam is null then
    v_naam := marketing_hq.ad_naam_voorstel(v_brand, p->>'product', p->>'persona', p->>'angle_type');
  end if;

  -- 3. Het werkstuk. Bestaat er al een, dan hangen we eraan; anders maken we er
  --    een. Dit is wat "nooit los van zijn testcontext" afdwingbaar maakt.
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

  -- 3b. Het interview hoort bij het werkstuk. Alleen invullen als het er nog
  --     niet staat: een tweede variant uit dezelfde generatie mag het interview
  --     van de eerste niet overschrijven met een uitgeklede versie.
  update marketing_hq.werkstukken w
     set rory_interview = coalesce(p->'rory_interview', '{}'::jsonb),
         mens_ingeving  = nullif(trim(coalesce(p->>'mens_ingeving','')), '')
   where w.id = v_werkstuk
     and w.rory_interview = '{}'::jsonb
     and coalesce(p->'rory_interview', '{}'::jsonb) <> '{}'::jsonb;

  -- 4. Market sophistication hoort bij het werkstuk (correctie van 5 augustus).
  --    Alleen invullen als het er nog niet staat: een tweede variant mag het
  --    oordeel van de eerste niet overschrijven.
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

  -- 5. Het denkstuk. Wat het interview en de generatie al weten, wordt hier
  --    ingevuld — de gebruiker heeft het net beantwoord en typt het niet
  --    nog een keer. Aftekenen gebeurt niet hier: dat blijft een mens die
  --    bewust tekent, in de werkbank (0023).
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

  -- 6. De creative zelf. Bestaat hij al (opgeslagen in de bibliotheek), dan
  --    werken we hem bij in plaats van een tweede rij te maken.
  v_creative := nullif(p->>'creative_id', '')::bigint;

  if v_creative is null then
    insert into public.creatives (
      brand, user_id, user_email, user_name, ad_name, product, persona,
      awareness_level, angle_type, marketing_angle, format, media_type, channel,
      creative_concept, hook_short, image_b64, source_type,
      hypothesis, test_variable, funnel_stage, headline, body_copy, cta,
      visual_concept, image_prompt, rory_reasoning, theriot_reasoning, bronnen,
      placement, product_refs,
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
      klaargezet_door = v_mens, klaargezet_op = now(),
      status = 'Klaar voor review'
    where c.id = v_creative;
  end if;

  return jsonb_build_object(
    'creative_id', v_creative, 'werkstuk_id', v_werkstuk,
    'denkstuk_id', v_denkstuk, 'ad_name', v_naam);
end $$;

comment on function marketing_hq.creative_testklaar_maken(jsonb) is
  'Eén gebaar: werkstuk, denkstuk en creative in één keer, of niets. De console mag marketing_hq niet schrijven; dit is de enige deur, en hij vraagt om een goedgekeurd teamlid.';

-- De console praat met het public-schema; daar staat de deur.
create or replace function public.hq_creative_testklaar(p jsonb)
returns jsonb language sql security invoker as $$
  select marketing_hq.creative_testklaar_maken(p)
$$;

revoke all on function marketing_hq.creative_testklaar_maken(jsonb) from public, anon;
revoke all on function public.hq_creative_testklaar(jsonb) from public, anon;
grant execute on function marketing_hq.creative_testklaar_maken(jsonb) to authenticated;
grant execute on function public.hq_creative_testklaar(jsonb) to authenticated;

-- De console moet een naamvoorstel kunnen vragen zonder zelf de conventie te
-- kennen. Anders staat de vorm op twee plekken en lopen ze uit elkaar.
create or replace function public.hq_ad_naam_voorstel(
  p_brand text, p_product text, p_persona text, p_angle text
) returns text language sql security definer set search_path = '' as $$
  select marketing_hq.ad_naam_voorstel(p_brand, p_product, p_persona, p_angle)
$$;
revoke all on function public.hq_ad_naam_voorstel(text, text, text, text) from public, anon;
grant execute on function public.hq_ad_naam_voorstel(text, text, text, text) to authenticated;

-- ── 6b. De learning vastleggen, ná het oordeel ─────────────────────────────
-- De console mag public.creatives schrijven, maar niet dit: een learning die
-- via een los scherm binnenkomt, kan er staan zonder dat er ooit gemeten is.
-- Daarom één deur, met de twee voorwaarden erin gebakken die er anders niet
-- zouden zijn.
create or replace function marketing_hq.creative_learning_vastleggen(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public, marketing_hq
as $$
declare
  v_mens     uuid := auth.uid();
  v_creative bigint := nullif(p->>'creative_id','')::bigint;
  v_status   text;
  v_gemeten  boolean;
begin
  if v_mens is null or not exists (
       select 1 from public.team_members t
        where t.id = v_mens and t.status = 'approved') then
    raise exception 'Alleen een goedgekeurd teamlid kan een learning vastleggen.';
  end if;
  if v_creative is null then
    raise exception 'Zonder creative_id is er niets om een learning aan te hangen.';
  end if;

  select c.status into v_status from public.creatives c where c.id = v_creative;
  if v_status is null then
    raise exception 'Creative % bestaat niet.', v_creative;
  end if;

  -- Een learning zonder meting is een mening. Hij mag opgeschreven worden,
  -- maar niet bevestigd: dan zou hij als vastgesteld feit in de analyse landen.
  select coalesce(r.beoordeelbaar, false) into v_gemeten
    from marketing_hq.creative_results r where r.creative_id = v_creative;

  if coalesce((p->>'bevestigen')::boolean, false) and not coalesce(v_gemeten, false) then
    raise exception
      'Deze creative is nog niet beoordeelbaar (0008: vier dagen, vijftig euro, duizend vertoningen). Opschrijven mag, bevestigen nog niet.';
  end if;

  update public.creatives c set
    learning_kern       = nullif(trim(coalesce(p->>'learning_kern','')), ''),
    learning_behouden   = nullif(trim(coalesce(p->>'learning_behouden','')), ''),
    learning_veranderen = nullif(trim(coalesce(p->>'learning_veranderen','')), ''),
    iteratie_voorstel   = nullif(trim(coalesce(p->>'iteratie_voorstel','')), ''),
    vervolgtests        = nullif(trim(coalesce(p->>'vervolgtests','')), ''),
    next_step           = coalesce(nullif(trim(coalesce(p->>'next_step','')), ''), c.next_step),
    learning_door_agent = nullif(p->>'door_agent',''),
    learning_bevestigd_door =
      case when coalesce((p->>'bevestigen')::boolean, false) then v_mens else null end,
    learning_bevestigd_op =
      case when coalesce((p->>'bevestigen')::boolean, false) then now() else null end
  where c.id = v_creative;

  return jsonb_build_object('creative_id', v_creative,
    'bevestigd', coalesce((p->>'bevestigen')::boolean, false));
end $$;

comment on function marketing_hq.creative_learning_vastleggen(jsonb) is
  'De enige deur naar de learningvelden. Opschrijven mag altijd; bevestigen pas als 0008 zegt dat er genoeg gemeten is.';

revoke all on function marketing_hq.creative_learning_vastleggen(jsonb) from public, anon;
grant execute on function marketing_hq.creative_learning_vastleggen(jsonb) to authenticated;

create or replace function public.hq_creative_learning(p jsonb)
returns jsonb language sql security definer set search_path = public, marketing_hq
as $$ select marketing_hq.creative_learning_vastleggen(p) $$;
revoke all on function public.hq_creative_learning(jsonb) from public, anon;
grant execute on function public.hq_creative_learning(jsonb) to authenticated;

-- ── 7. Het dossier ─────────────────────────────────────────────────────────
-- Zes secties uit zes plekken, maar één rij per creative. Niet omdat dat
-- sneller is: als het scherm zes queries doet en er komt er één niet terug, dan
-- toont hij een dossier waarin een sectie ontbreekt zonder te zeggen dat hij
-- iets mist. Eén rij is er of is er niet.
--
-- Alles hier is samengesteld uit wat er al staat. Er wordt niets gedupliceerd:
-- de creative levert de uitvoering, het werkstuk de estafette, het denkstuk de
-- onderbouwing, criticus_oordelen het oordeel, agent_messages de discussies en
-- creative_results de meting.
create or replace view marketing_hq.creative_dossier as
select
  t.*,                                            -- alles uit de testkaart (A, B, deels C)

  -- C. Strategische herkomst — het denkstuk, vraag voor vraag met zijn zekerheid
  (select jsonb_agg(jsonb_build_object(
            'vraag', v.vraag, 'tekst', v.tekst,
            'antwoord', a.antwoord, 'zekerheid', a.zekerheid, 'bron', a.bron)
          order by v.vraag)
     from marketing_hq.denkstuk_vragen v
     left join marketing_hq.denkstuk_antwoorden a
            on a.denkstuk_id = t.denkstuk_id and a.vraag = v.vraag
  )                                               as denkstuk_regels,

  -- D. Werkstuk en agents
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

  -- Discussies en meningsverschillen: wat agents elkaar over dit werkstuk
  -- schreven. Ongelezen post staat er ook in — juist die.
  (select jsonb_agg(jsonb_build_object(
            'van', m.from_agent, 'aan', m.to_agent, 'onderwerp', m.subject,
            'body', m.body, 'wanneer', m.created_at, 'gelezen', m.read_at)
          order by m.created_at)
     from marketing_hq.agent_messages m
    where m.werkstuk_id = t.werkstuk_id)          as discussies,

  -- E. Publicatie en performance — alleen wat gemeten is, nooit ingevuld
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

  -- F. Learning — uit angle_learnings, want een learning hoort bij de hoek en
  -- niet bij één advertentie. Dat is waar 0008 hem al bijhoudt.
  (select jsonb_agg(jsonb_build_object(
            'hoek', l.angle_type, 'persona', l.persona,
            'advertenties', l.aantal_ads, 'spend', l.spend, 'roas', l.roas,
            'winnaars', l.winnaars,
            'betrouwbaar', l.betrouwbaar)
          order by l.angle_type)
     from marketing_hq.angle_learnings l
    where l.angle_type = t.angle_type
      and (t.persona is null or l.persona = t.persona)) as learnings,

  -- Tijdlijn: wie deed wat, op volgorde, met mens en agent uit elkaar
  -- gehouden. Vier bronnen door elkaar, want "wie besloot dit" is één vraag en
  -- geen vier — en het antwoord staat nu in vier tabellen.
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

comment on view marketing_hq.creative_dossier is
  'Eén rij per creative met het hele verhaal eromheen. Samengesteld uit wat er al staat — niets wordt hier gedupliceerd.';

alter view marketing_hq.creative_dossier set (security_invoker = true);
grant select on marketing_hq.creative_dossier to authenticated;

drop view if exists public.hq_creative_dossier;
create view public.hq_creative_dossier with (security_invoker = true)
  as select * from marketing_hq.creative_dossier;
revoke all on public.hq_creative_dossier from anon, public;
grant select on public.hq_creative_dossier to authenticated;
