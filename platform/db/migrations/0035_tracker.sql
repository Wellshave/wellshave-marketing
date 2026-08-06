-- ═══════════════════════════════════════════════════════════════════════════
-- 0035 — De tracker: herkomst, een dichte deur, en tellen dat klopt
--
-- Beslisvraag:
--
--     "Welke test heeft iets opgeleverd, en wat hebben we ervan geleerd?"
--
-- Aanleiding is '1. Creative Strategy Map.xlsx', het bestand waar het team
-- 564 advertenties in bijhoudt. Die rijen komen hierheen. Deze migratie legt
-- neer wat daarvoor eerst moet staan.
--
-- ── 1. De deur die openstond ────────────────────────────────────────────────
--
--   public.creatives had een policy `creatives_public_read` met USING (true)
--   voor PUBLIC, en anon heeft SELECT op de tabel. Met de publieke sleutel uit
--   de frontend las dus iedereen de hele tabel zonder in te loggen. Nagemeten,
--   niet afgeleid: een curl met de publishable key gaf alle zeven rijen terug,
--   inclusief ad_name en status.
--
--   Vandaag zijn dat zeven testrijen. Na de import zijn het 571 advertenties
--   met hooks, budgetten, ROAS en links naar de Drive-mappen met het bronbeeld
--   — de complete creatieve strategie en advertentieperformance van het merk.
--   De import maakt een bestaand lek tachtig keer groter, dus hij gaat niet
--   door voordat het dicht is.
--
--   Er hangt niets aan. Elke leesactie op creatives in de app zit achter
--   `window._authProfile` (21-supabase-sync.js), en de opmerking daar zegt het
--   al sinds het begin: "alleen 'approved' mag data". De policy sprak dat
--   tegen. `creatives_select` blijft staan en dekt wat de app werkelijk doet:
--   een goedgekeurd teamlid leest.
--
--   De grants van anon gaan er ook af. De policy weghalen is genoeg om het te
--   sluiten, maar een tabel waar anon rechten op houdt is één vergeten policy
--   verwijderd van hetzelfde lek.
--
-- ── 2. Herkomst ─────────────────────────────────────────────────────────────
--
--   Drie kolommen, zodat een geïmporteerde rij zichzelf kan verantwoorden:
--
--     bron_bestand  waar hij vandaan komt. Ook de terugweg: één delete op
--                   deze kolom maakt de import ongedaan.
--     bron_status   het statuswoord zoals het in de sheet stond.
--     bron_rij      de plek in de sheet, zodat je het kunt naslaan.
--
--   bron_status is er omdat de vertaling niet omkeerbaar is. De sheet kent
--   'To Test', 'Killed', 'Live', 'Winner', 'Iterate'; de database kent sinds
--   0031 tien Nederlandse statussen met een foreign key erop. 'Killed' wordt
--   'Verliezer' en 'To Test' wordt 'Concept' — maar 'To Test' betekende in de
--   sheet zowel "plan staat, nog niet gemaakt" als "gemaakt, wacht op
--   lancering", en dat verschil is weg zodra je het overschrijft. Met
--   bron_status erbij is de vertaling een afgeleide en geen vervanging.
--
-- ── 3. Tellen dat klopt ─────────────────────────────────────────────────────
--
--   De sheet heeft onderaan 'Breakdown Analyses': aantal, winners, killed en
--   gemiddelde score per product, media type, awareness level, format en
--   persona. Die tellingen kloppen niet, en het is leerzaam waaróm:
--
--     · Per Persona staat volledig op nul. De formule telt de vijf archetypen
--       uit de Personas-tab (Mark, Joris, Sven, Tim, Lotte), maar in de rijen
--       staat Alex (191×), Luca (113×), Jasper, Daan, Jason, Sophie, en 34×
--       "Geen specifieke customer Persona (omdat deze nog niet ready zijn)".
--     · Per Product telt alleen Groom Guard (240) van de 564 rijen, want de
--       kolom heeft 25 vrije varianten.
--     · De dashboardkaarten zeggen 624 tests en 436 to-test; er staan 564
--       rijen en 238 to-test.
--
--   Eén fout, drie keer: er wordt geteld tegen een lijst in plaats van tegen
--   wat er staat, en wat niet op de lijst voorkomt valt stil weg. Een leeg
--   vakje zegt dan "nul" terwijl het "niet gemeten" betekent, en dat is het
--   verschil tussen een format dat niet werkt en een format dat niemand heeft
--   geprobeerd.
--
--   Deze view telt daarom tegen de rijen zelf. Wat niet ingevuld is krijgt een
--   eigen regel ('— niet ingevuld') in plaats van te verdwijnen, en naast elk
--   aantal staat hoeveel rijen er een score en gemeten cijfers bij hebben. Bij
--   de import is dat overal nul: de sheet heeft Score, Next Step, Impressions
--   en Conversions bij geen enkele van de 564 rijen ingevuld. Dat hoort te
--   prikken, dus het staat in de kolom en niet in een voetnoot.
--
--   Geen mapping van persona's of producten naar een nette lijst. Alex en Luca
--   zijn niet te herleiden tot de vijf archetypen, en "All products" versus
--   "All products/ scheerapparaat Elite" samenvoegen is een keuze van een mens
--   over zijn eigen data. De view laat zien wat er staat, inclusief de
--   dubbelingen; dan kan iemand besluiten in plaats van dat ik het gok.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. de deur ──────────────────────────────────────────────────────────────

drop policy if exists creatives_public_read on public.creatives;
revoke all on public.creatives from anon;

-- ── 2. herkomst ─────────────────────────────────────────────────────────────

alter table public.creatives add column if not exists bron_bestand text;
alter table public.creatives add column if not exists bron_status  text;
alter table public.creatives add column if not exists bron_rij      integer;

comment on column public.creatives.bron_bestand is
  'Bestand waar deze rij uit geïmporteerd is. Leeg = in dit systeem gemaakt.';
comment on column public.creatives.bron_status is
  'Het statuswoord zoals het in de bron stond, vóór vertaling naar creative_statussen.';
comment on column public.creatives.bron_rij is
  'Volgnummer in de bron, zodat een rij naslaanbaar blijft.';

create index if not exists creatives_bron_idx on public.creatives (bron_bestand);

-- ── 3. de grendel van 0030 en historie van daarvoor ─────────────────────────
--
--   De import liep vast op `creative_testklaar_trg`, en terecht: 0030 eist een
--   hypothese, een testvariabele en een werkstuk zodra een creative de
--   maakfase uit gaat, en de 326 advertenties die in de sheet hebben gedraaid
--   hebben geen van drieën. Ze komen uit een tijd waarin die regel niet
--   bestond.
--
--   Drie uitwegen, en twee ervan zijn slecht. Alles als 'Concept' importeren
--   gooit de uitkomst weg — welke 203 gestopt zijn en welke 10 wonnen is
--   precies waarvoor je een tracker hebt. De trigger tijdelijk uitzetten is de
--   noodmaatregel uit 0032, en die werd de nieuwe toestand tot iemand hem
--   terugdraaide.
--
--   Dit is de derde: de eis geldt niet voor een rij die bij het invoegen al
--   zegt dat hij uit een bestand komt. Alleen bij INSERT. Zodra een mens een
--   geïmporteerde rij bijwerkt, is het een gewone update en gelden de drie
--   eisen onverkort — de grendel is dus niet los, hij slaat één keer over voor
--   materiaal dat ouder is dan hijzelf.
--
--   De functie wordt hier opnieuw gedefinieerd. Wie 0030 leest ziet de oude
--   versie; dit is de versie die draait.

create or replace function marketing_hq.creative_testklaar()
returns trigger language plpgsql as $$
declare eist boolean; ontbreekt text[];
begin
  -- Historie van vóór 0030. Zie de toelichting in 0035.
  if tg_op = 'INSERT' and new.bron_bestand is not null then return new; end if;

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

-- ── 4. de breakdown ─────────────────────────────────────────────────────────

-- Deze view rust op creative_kaart en niet op public.creatives. Dat is geen
-- omweg: 0011 laat daar gemeten cijfers winnen van ingetypte en zet
-- `cijfers_bron` ernaast. Rechtstreeks op de tabel tellen zou de handmatige
-- kolom nemen ook waar Meta iets beters heeft — precies de tweede waarheid die
-- 0011 al had opgeruimd.
create or replace view marketing_hq.tracker_breakdown as
with basis as (
  select
    k.brand, k.status, k.score, k.roas, k.date_live, k.cijfers_bron,
    k.product, k.awareness_level, k.media_type, k.format, k.persona, k.angle_type
  from marketing_hq.creative_kaart k
),
lang as (
  select brand, 'product' as dimensie, product as waarde,
         status, score, roas, date_live, cijfers_bron from basis
  union all select brand, 'awareness_level', awareness_level, status, score, roas, date_live, cijfers_bron from basis
  union all select brand, 'media_type',      media_type,      status, score, roas, date_live, cijfers_bron from basis
  union all select brand, 'format',          format,          status, score, roas, date_live, cijfers_bron from basis
  union all select brand, 'persona',         persona,         status, score, roas, date_live, cijfers_bron from basis
  union all select brand, 'angle_type',      angle_type,      status, score, roas, date_live, cijfers_bron from basis
)
select
  brand,
  dimensie,
  coalesce(nullif(btrim(waarde), ''), '— niet ingevuld')      as waarde,
  count(*)                                                    as aantal,
  count(*) filter (where status = 'Winner')                   as winners,
  count(*) filter (where status = 'Verliezer')                as verliezers,
  count(*) filter (where status = 'Itereren')                 as itereren,
  count(*) filter (where status = 'Live')                     as live,
  count(*) filter (where date_live is not null)               as ooit_gedraaid,

  -- Waar de cijfers op deze regel vandaan komen. Een gemiddelde zonder deze
  -- drie kolommen leest hetzelfde of het nu op tweehonderd Meta-metingen rust
  -- of op drie met de hand ingetypte getallen.
  count(*) filter (where cijfers_bron = 'meta')               as met_meting,
  count(*) filter (where cijfers_bron = 'handmatig')          as met_handmatig,
  count(*) filter (where cijfers_bron = 'geen')               as zonder_cijfers,
  count(*) filter (where score is not null)                   as met_score,

  -- roas_nul staat er apart omdat het gemiddelde anders liegt. In de sheet
  -- heeft 546 van de 564 rijen een ROAS en staat het merendeel op 0.00, zonder
  -- impressions of conversions ernaast. Of dat "niets verdiend" betekent of
  -- "nooit ingevuld" is uit de data niet op te maken, en dat verzin ik hier
  -- niet: het aantal nullen staat erbij, dan ziet de lezer waar het op rust.
  count(*) filter (where roas = 0)                            as roas_nul,
  round(avg(score) filter (where score is not null), 1)       as gem_score,
  round(avg(roas)  filter (where roas is not null), 2)        as gem_roas
from lang
group by brand, dimensie, coalesce(nullif(btrim(waarde), ''), '— niet ingevuld');

comment on view marketing_hq.tracker_breakdown is
  'Telt per dimensie tegen de rijen zelf, inclusief een regel voor wat niet ingevuld is.';

create or replace view public.hq_tracker_breakdown
with (security_invoker = true) as
select * from marketing_hq.tracker_breakdown;

grant select on public.hq_tracker_breakdown to authenticated;
