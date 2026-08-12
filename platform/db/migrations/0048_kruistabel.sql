-- ═══════════════════════════════════════════════════════════════════════════
-- 0048 — De analysekaart: persona × angle × bewustzijnsniveau × product
--
-- Beslisvraag:
--
--     "Welke persona werkt, op welk bewustzijnsniveau, met welke angle, voor
--      welk product?"
--
-- Dit is de kruistabel waar 0035 t/m 0047 naartoe werkten. Alles daarvoor ging
-- over de vraag óf een cijfer ergens op rust; dit bestand gaat over wat je er
-- dan mee mag zeggen.
--
-- ── 1. Het gemiddelde draait de rangorde om ─────────────────────────────────
--
--   Nagemeten op de 637 rijen zoals ze nu staan:
--
--     angle                      creatives  gemeten     spend   gewogen   gem.
--     FOMO / Scarcity                   41        0    €    0        —    2,38
--     Benefits-Driven                  144       83    € 5.194     1,17   0,95
--     Negative / Pain Agitation         59       37    €10.128     2,06   1,49
--
--   Het ongewogen gemiddelde zet FOMO bovenaan met 2,38. Van die 41 creatives
--   is er nul gemeten: die 2,38 komt uit overgetikte cellen in het oude sheet
--   en er is geen euro die hem draagt. Het geld staat bij Negative / Pain
--   Agitation, en dat is ook waar de gewogen ROAS het hoogst is.
--
--   Een gemiddelde van ratio's geeft elke rij evenveel stem, ongeacht of er
--   € 3 of € 10.000 doorheen ging. Daarom rekent deze kaart uitsluitend op de
--   tellers: som(omzet) / som(spend). Dat is dezelfde regel als in 0008 —
--   "optellen op de tellers, niet op de ratio's" — nu ook op vakniveau.
--
--   Het ongewogen getal staat er wél bij, onder de naam
--   `roas_ongewogen_ingetypt`. Niet om te gebruiken maar om te kunnen zien
--   waar een eerdere conclusie vandaan kwam. Weglaten zou de vraag
--   "maar vorige week stond er 2,38" onbeantwoordbaar maken.
--
-- ── 2. Een leeg vak is een uitkomst, geen storing ────────────────────────────
--
--   153 vakken zijn gevuld met minstens één creative. Daarvan:
--
--     65 vakken   geen enkele gemeten creative
--     61 vakken   wel gemeten, maar onder een drempel
--     27 vakken   halen alle drie de drempels — en daar zit 80,7% van het geld
--
--   Die 27 zijn de kaart. De andere 126 zijn geen fout: het is het eerlijke
--   antwoord dat we het niet weten. Een vak dat op twee rijen rust en toch een
--   ROAS afdrukt, is gevaarlijker dan een leeg vak, want een leeg vak wordt
--   niet geciteerd.
--
--   Daarom geeft `roas` null zodra een vak onder een drempel zit, en zegt
--   `oordeel` welke drempel het was, met het getal erbij. De feiten — spend,
--   aankopen, omzet, aantal creatives — staan er altijd, want dat zijn
--   metingen en geen conclusies.
--
-- ── 3. Waar de drempels vandaan komen ───────────────────────────────────────
--
--   Niet uit een gevoel. Nagemeten wat elke keuze kost:
--
--     min. aankopen   min. creatives   vakken   aandeel van de spend
--                 1                2       32                  82,8%
--                 1                3       31                  82,3%
--                 3                3       27                  80,7%
--                 5                3       23                  77,4%
--
--   Van 1 naar 3 aankopen kost vier vakken en 1,6 procentpunt, en haalt de
--   vakken weg waar één bestelling de hele ROAS draagt. Dat is goedkoop.
--   Van 3 naar 5 kost er nog eens vier en 3,3 procentpunt; dat is het niet.
--
--   De drempels staan in een tabel en niet in de view, om dezelfde reden als
--   de benchmarks in 0036: een grens die iemand kan verschuiven zonder
--   migratie is een grens waar het team achter staat. Wie hem verschuift ziet
--   meteen wat het aan vakken kost.
--
-- ── 4. Twee vocabulaires op dezelfde as ─────────────────────────────────────
--
--   Het sheet schrijft '2. Problem Aware'; de generator schrijft 'problem'.
--   Allebei staan in de tabel, en zonder ingreep worden dat twee kolommen in
--   de kruistabel: één met 253 rijen en één met 1, die elkaar nooit zien.
--
--   Dat is precies het stille verlies uit 0043. Daarom een synoniementabel —
--   data, geen code, want de volgende schrijfwijze komt er over drie maanden
--   weer en die hoort geen migratie te kosten.
--
--   Wat er wél in gaat: schrijfwijzen van hetzelfde ('problem' → '2. Problem
--   Aware', 'All products' → 'Alle producten'). Wat er niet in gaat:
--
--     'safety'                                  geen enkele angle in de lijst
--                                               heet zo; wat het is weet ik
--                                               niet, dus blijft het staan als
--                                               eigen waarde met 3 rijen
--     'Mark de Vries, de Relatie-Pragmaticus'   waarschijnlijk dezelfde als
--                                               'Mark'. Waarschijnlijk is geen
--                                               grond om twee vakken samen te
--                                               voegen — dezelfde afweging als
--                                               bij WLS/WSL in 0045
--
--   `map_as_schrijfwijzen` laat per as zien welke ruwe waarden op welke
--   uitkomen. Een vouwing die niemand kan zien is een aanname die niemand kan
--   corrigeren.
--
-- ── 5. 'Geen specifieke customer Persona' is geen persona ───────────────────
--
--   109 rijen staan zo in de map, in twee schrijfwijzen. Dat is geen leeg veld
--   — iemand heeft opgeschreven dat er bewust niet op een persona gemikt is —
--   maar het is ook geen persona. Zonder onderscheid komt hij als grootste
--   "persona" bovenaan elke ranglijst te staan.
--
--   Hij blijft daarom een gewone waarde op de as, met één kolom ernaast:
--   `persona_gekozen`. Wie een ranglijst van persona's maakt filtert daarop.
--   Weggooien zou 109 rijen aan uitgaven onzichtbaar maken; meetellen zou een
--   niet-keuze tot winnaar maken.
--
-- ── 6. sophistication: de as die al bestond, op de verkeerde vraag ──────────
--
--   Er is geen kolom `sophistication_level` op `creatives`, en die komt er ook
--   niet. 0030 heeft die vraag al beantwoord en beter dan ik hem zou stellen:
--
--       "Waar hoort het? Op het WERKSTUK. Sophistication is een eigenschap van
--        de markt en de belofte, niet van variant 3. Vier varianten op dezelfde
--        hoek delen hem per definitie; op de creative zou je hem vier keer
--        intypen en drie keer verkeerd."
--
--   Daar staat hij dus al: `werkstukken.sophistication`, met de vijf niveaus
--   van Schwartz als tabel, een verplichte redenering bij een voorstel, en een
--   handtekening van een mens om het vast te stellen. Er een tweede kolom naast
--   zetten zou precies de tweede waarheid maken die dit systeem overal
--   vermijdt.
--
--   De as van deze kaart loopt daarom over `creatives.werkstuk_id`. Wat dat nu
--   oplevert, nagemeten:
--
--     637 creatives, waarvan 7 aan een werkstuk hangen
--       3 werkstukken, waarvan 0 met een sophistication
--       0 bevestigd door een mens
--
--   De as is dus leeg — maar hij is leeg om een andere reden dan "de kolom
--   ontbreekt", en dat verschil bepaalt wat eraan te doen valt. Er hoeft geen
--   veld bij; er moeten 630 creatives aan een werkstuk, en daarna moet iemand
--   tekenen.
--
--   Een voorstel van een agent telt niet mee: `sophistication` blijft null tot
--   `sophistication_bevestigd_op` gevuld is. Dat is de regel uit 0030 en niet
--   een nieuwe. Het voorstel zelf blijft wel zichtbaar in
--   `sophistication_voorstel`, anders is niet te zien dat er iets op een
--   handtekening ligt te wachten.
--
--   En hij doet bewust niet mee als beslisveld in `map_gaten` (0047). Zou hij
--   dat wel, dan staan er morgen 637 gaten op het scherm en leest niemand er
--   nog één. Een waarschuwing die overal staat, staat nergens. Zodra het
--   koppelen begint hoort hij erbij; dat is één regel in 0047 en een besluit
--   dat iemand neemt, niet een bijwerking van dit bestand.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Twee schrijfwijzen, één as ──────────────────────────────────────────

create table if not exists marketing_hq.map_as_synoniemen (
  -- sophistication staat er niet bij: die as komt uit een gesloten vocabulaire
  -- (0030) en niet uit een vrij tekstveld, dus er valt niets te spellen.
  as_naam text not null check (as_naam in
    ('persona', 'bewustzijnsniveau', 'angle', 'product')),
  ruw     text not null,
  naar    text not null,
  reden   text not null,
  primary key (as_naam, ruw)
);

comment on table marketing_hq.map_as_synoniemen is
  'Schrijfwijzen die op dezelfde aswaarde uitkomen. Alleen spelling en hoofdletters horen hier; een betekenis die geraden moet worden hoort er niet in.';

insert into marketing_hq.map_as_synoniemen (as_naam, ruw, naar, reden) values
  -- Het sheet nummert de vijf niveaus, de generator schrijft ze uit. Zelfde
  -- schaal, zelfde volgorde, andere pen.
  ('bewustzijnsniveau', 'unaware',  '1. Unaware',        'de generator schrijft de schaal zonder nummer'),
  ('bewustzijnsniveau', 'problem',  '2. Problem Aware',  'de generator schrijft de schaal zonder nummer'),
  ('bewustzijnsniveau', 'solution', '3. Solution Aware', 'de generator schrijft de schaal zonder nummer'),
  ('bewustzijnsniveau', 'product',  '4. Product Aware',  'de generator schrijft de schaal zonder nummer'),
  ('bewustzijnsniveau', 'most',     '5. Most Aware',     'de generator schrijft de schaal zonder nummer'),

  ('angle', 'social-proof', 'Social Proof / Reviews', 'zelfde angle, koppelteken in plaats van spatie'),
  ('angle', 'comparison',   'Comparison / Anti-X',    'zelfde angle, afgekorte schrijfwijze'),

  ('product', 'All products', 'Alle producten', 'zelfde verzameling, Engelse schrijfwijze'),

  -- Twee schrijfwijzen van dezelfde niet-keuze. Zie kop §5: hij blijft een
  -- waarde op de as, maar `persona_gekozen` zet hem apart.
  ('persona', 'Geen specifieke customer Persona',
              'Geen specifieke persona', 'zelfde niet-keuze, kortere schrijfwijze'),
  ('persona', 'Geen specifieke customer Persona (omdat deze nog niet ready zijn)',
              'Geen specifieke persona', 'zelfde niet-keuze, met reden erachter')
on conflict (as_naam, ruw) do nothing;

-- security definer, met opzet. Zonder dat leest deze functie de synoniementabel
-- met de rechten van wie kijkt, en dan vouwt de kaart voor de een wél en voor
-- de ander niet -- zonder foutmelding, met andere getallen. Er staat niets
-- geheims in: het is een spellingslijst.
create or replace function marketing_hq.map_as(p_as text, p_waarde text)
returns text
language sql
stable
parallel safe
security definer
set search_path = ''
as $$
  select coalesce(
           (select s.naar
              from marketing_hq.map_as_synoniemen s
             where s.as_naam = p_as
               and lower(s.ruw) = lower(btrim(coalesce(p_waarde, '')))),
           nullif(btrim(coalesce(p_waarde, '')), '')
         );
$$;

comment on function marketing_hq.map_as(text, text) is
  'De waarde zoals hij op de as hoort te staan: het synoniem als dat er is, anders de waarde zelf. Leeg blijft null, want een leeg vak is een uitkomst.';

revoke all on function marketing_hq.map_as(text, text) from public, anon;
grant execute on function marketing_hq.map_as(text, text) to authenticated;

-- ── 2. De drempels ────────────────────────────────────────────────────────

create table if not exists marketing_hq.map_drempels (
  naam        text primary key,
  waarde      numeric not null,
  eenheid     text    not null,
  toelichting text    not null,
  bron        text    not null
);

comment on table marketing_hq.map_drempels is
  'Wanneer een vak in de analysekaart een getal mag afgeven. In een tabel en niet in de view: wie de grens verschuift hoort meteen te zien wat het aan vakken kost.';

insert into marketing_hq.map_drempels (naam, waarde, eenheid, toelichting, bron) values
  ('min_spend',     100, 'euro',
   'Onder de honderd euro is een ROAS een toevalstreffer. Sluit 44 van de 153 vakken uit.',
   'nagemeten op de 637 rijen, augustus 2026'),
  ('min_creatives',   3, 'creatives',
   'Een vak dat op twee gemeten rijen rust is één rij verwijderd van één rij.',
   'nagemeten: van 2 naar 3 kost één vak en 0,6 procentpunt van de spend'),
  ('min_aankopen',    3, 'aankopen',
   'Bij één bestelling draagt die ene bestelling de hele ROAS.',
   'nagemeten: van 1 naar 3 kost vier vakken en 1,6 procentpunt van de spend')
on conflict (naam) do nothing;

-- Twee functies in plaats van dezelfde CASE in drie views. Ze lezen de
-- drempeltabel, dus verschuiven werkt overal tegelijk -- inclusief de kruis-
-- tabel, die anders zijn eigen grens zou hebben.
create or replace function marketing_hq.map_toestand(
  p_creatives int, p_gemeten int, p_spend numeric, p_aankopen numeric)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when coalesce(p_gemeten, 0) = 0 then 'niet gemeten'
           when coalesce(p_spend,    0) < (select d.waarde from marketing_hq.map_drempels d where d.naam = 'min_spend')
             or coalesce(p_gemeten,  0) < (select d.waarde from marketing_hq.map_drempels d where d.naam = 'min_creatives')
             or coalesce(p_aankopen, 0) < (select d.waarde from marketing_hq.map_drempels d where d.naam = 'min_aankopen')
             then 'te weinig data'
           else 'beoordeelbaar'
         end;
$$;

comment on function marketing_hq.map_toestand(int, int, numeric, numeric) is
  'Mag dit vak een getal afgeven: beoordeelbaar, te weinig data, of niet gemeten. Drie woorden zodat een scherm erop kan filteren.';

create or replace function marketing_hq.map_oordeel(
  p_creatives int, p_gemeten int, p_spend numeric, p_aankopen numeric)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case marketing_hq.map_toestand(p_creatives, p_gemeten, p_spend, p_aankopen)
           when 'niet gemeten' then
             'niet gemeten — geen van de ' || coalesce(p_creatives, 0)
             || ' creative(s) in dit vak heeft cijfers'
           when 'beoordeelbaar' then
             'beoordeelbaar'
           else
             -- Met het getal erbij, allebei de kanten. "te weinig data" zonder
             -- afstand tot de grens is niet te handelen naar: dan weet niemand
             -- of er één creative bij moet of tien.
             'te weinig data — ' || array_to_string(array_remove(array[
               case when coalesce(p_spend, 0) < (select d.waarde from marketing_hq.map_drempels d where d.naam = 'min_spend')
                    then '€ ' || round(coalesce(p_spend, 0)) || ' van € '
                         || (select round(d.waarde) from marketing_hq.map_drempels d where d.naam = 'min_spend') end,
               case when coalesce(p_gemeten, 0) < (select d.waarde from marketing_hq.map_drempels d where d.naam = 'min_creatives')
                    then coalesce(p_gemeten, 0) || ' van '
                         || (select round(d.waarde) from marketing_hq.map_drempels d where d.naam = 'min_creatives')
                         || ' gemeten creatives' end,
               case when coalesce(p_aankopen, 0) < (select d.waarde from marketing_hq.map_drempels d where d.naam = 'min_aankopen')
                    then round(coalesce(p_aankopen, 0)) || ' van '
                         || (select round(d.waarde) from marketing_hq.map_drempels d where d.naam = 'min_aankopen')
                         || ' aankopen' end
             ], null), '; ')
         end;
$$;

comment on function marketing_hq.map_oordeel(int, int, numeric, numeric) is
  'Dezelfde uitkomst als map_toestand, maar als zin met de afstand tot elke drempel erin. Zonder die afstand weet niemand of er één creative bij moet of tien.';

revoke all on function marketing_hq.map_toestand(int, int, numeric, numeric) from public, anon;
revoke all on function marketing_hq.map_oordeel(int, int, numeric, numeric)  from public, anon;
grant execute on function marketing_hq.map_toestand(int, int, numeric, numeric) to authenticated;
grant execute on function marketing_hq.map_oordeel(int, int, numeric, numeric)  to authenticated;

-- ── 3. Elke creative op zijn assen, met zijn tellers ───────────────────────
-- De laag waar alles hierna op rust. Apart, omdat drie views hem nodig hebben
-- en omdat een fout in de voorrangsregel dan op één plek te vinden is.
create or replace view marketing_hq.map_creative_as as
with gemeten as (
  select
    t.creative_id,
    sum(t.spend)                  as spend,
    sum(t.impressions)::numeric   as impressies,
    sum(t.clicks)::numeric        as clicks,
    sum(t.purchases)::numeric     as aankopen,
    sum(t.purchase_value)         as omzet
  from marketing_hq.ad_totals t
  where t.creative_id is not null
  group by t.creative_id
)
select
  c.id                                                            as creative_id,
  c.brand,
  c.ad_name,
  marketing_hq.map_as('product',           c.product)             as product,
  marketing_hq.map_as('persona',           c.persona)             as persona,
  marketing_hq.map_as('bewustzijnsniveau', c.awareness_level)     as bewustzijnsniveau,
  marketing_hq.map_as('angle',             c.angle_type)          as angle,

  /* Over het werkstuk, niet over een eigen kolom — zie kop §6. En alleen als
     een mens getekend heeft: 0030 zegt met zoveel woorden dat een voorstel van
     Nova niet als vastgesteld telt, en een kaart die op voorstellen groepeert
     zou dat stilzwijgend omkeren. */
  case
    when w.sophistication is null                then null
    when w.sophistication_bevestigd_op is null   then null
    else w.sophistication::text || '. ' || sn.naam
  end                                                             as sophistication,
  /* Het voorstel blijft wel zichtbaar, anders is niet te zien dat er iets op
     een handtekening ligt te wachten. */
  case
    when w.sophistication is null then null
    else w.sophistication::text || '. ' || sn.naam
  end                                                             as sophistication_voorstel,

  c.cijfers_vastgezet,
  c.roas                                                          as ingetypte_roas,

  /* De voorrang uit 0011 en 0038, nu op tellers in plaats van op ratio's:
     gemeten wint van ingetypt, vastgezet wint van allebei. Bij een vastgezette
     rij bestaat er geen gemeten omzet om op te tellen, dus wordt hij terug-
     gerekend uit het cijfer dat een mens heeft neergezet — roas × budget. Dat
     is een reconstructie en geen meting, en daarom telt `vastgezette_creatives`
     verderop mee: een vak dat op vastgezette cijfers rust hoort dat te zeggen. */
  case when c.cijfers_vastgezet then c.budget           else g.spend      end as spend,
  case when c.cijfers_vastgezet then c.impressions::numeric else g.impressies end as impressies,
  case when c.cijfers_vastgezet then null::numeric      else g.clicks     end as clicks,
  case when c.cijfers_vastgezet then c.conversions::numeric else g.aankopen end as aankopen,
  case when c.cijfers_vastgezet then round(c.roas * c.budget, 2) else g.omzet end as omzet,

  /* Telt deze rij mee in het gewogen cijfer. Een ingetypte ROAS zonder meting
     doet dat níét -- dat is de hele valkuil uit de kop. */
  case
    when c.cijfers_vastgezet
      then (c.roas is not null and c.budget is not null and c.budget > 0)
    else g.creative_id is not null
  end                                                             as telt_mee
from public.creatives c
left join gemeten g                            on g.creative_id = c.id
left join marketing_hq.werkstukken w           on w.id = c.werkstuk_id
left join marketing_hq.sophistication_niveaus sn on sn.niveau = w.sophistication;

comment on view marketing_hq.map_creative_as is
  'Elke creative met zijn vijf aswaarden en zijn tellers, na de voorrangsregel. Sophistication komt over het werkstuk en telt pas als een mens getekend heeft. Een rij met alleen een ingetypte ROAS telt niet mee in het gewogen cijfer.';

-- ── 4. De kaart ───────────────────────────────────────────────────────────
create or replace view marketing_hq.map_analyse as
with cel as (
  select
    m.brand,
    m.product,
    m.persona,
    m.bewustzijnsniveau,
    m.angle,
    m.sophistication,
    count(*)::int                                              as creatives,
    count(*) filter (where m.telt_mee)::int                    as gemeten_creatives,
    count(*) filter (where m.cijfers_vastgezet)::int           as vastgezette_creatives,
    coalesce(sum(m.spend)      filter (where m.telt_mee), 0)   as spend,
    coalesce(sum(m.impressies) filter (where m.telt_mee), 0)   as impressies,
    coalesce(sum(m.clicks)     filter (where m.telt_mee), 0)   as clicks,
    coalesce(sum(m.aankopen)   filter (where m.telt_mee), 0)   as aankopen,
    coalesce(sum(m.omzet)      filter (where m.telt_mee), 0)   as omzet,
    avg(m.ingetypte_roas)                                      as roas_ongewogen_ingetypt
  from marketing_hq.map_creative_as m
  group by m.brand, m.product, m.persona, m.bewustzijnsniveau, m.angle, m.sophistication
)
select
  c.brand,
  c.product,
  c.persona,
  -- Zie kop §5. Een niet-keuze mag niet als winnaar uit een ranglijst komen.
  (c.persona is not null and c.persona <> 'Geen specifieke persona')  as persona_gekozen,
  c.bewustzijnsniveau,
  c.angle,
  c.sophistication,

  c.creatives,
  c.gemeten_creatives,
  c.vastgezette_creatives,
  round(c.spend, 2)                                                   as spend,
  c.impressies::bigint                                                as impressies,
  c.clicks::bigint                                                    as clicks,
  c.aankopen::bigint                                                  as aankopen,
  round(c.omzet, 2)                                                   as omzet,

  /* Het getal waar het om gaat: som(omzet) / som(spend), en null zodra het vak
     onder een drempel zit. Null en niet 0 -- een 0 leest als "werkt niet" en
     dat is iets anders dan "we weten het niet". */
  case
    when marketing_hq.map_toestand(c.creatives, c.gemeten_creatives, c.spend, c.aankopen) = 'beoordeelbaar'
     and c.spend > 0
      then round(c.omzet / c.spend, 2)
  end                                                                 as roas,

  /* Staat er alleen om te kunnen zien waar een eerdere conclusie vandaan kwam.
     Bij FOMO / Scarcity staat hier 2,38 en bij roas null -- dat verschil ís de
     boodschap. */
  round(c.roas_ongewogen_ingetypt, 2)                                 as roas_ongewogen_ingetypt,

  case when c.impressies > 0 then round(c.clicks / c.impressies, 4) end as ctr,
  case when c.aankopen  > 0 then round(c.spend  / c.aankopen,  2) end   as cpa,

  round(c.spend / nullif(sum(c.spend) over (partition by c.brand), 0) * 100, 1)
                                                                      as aandeel_spend,

  marketing_hq.map_toestand(c.creatives, c.gemeten_creatives, c.spend, c.aankopen) as toestand,
  marketing_hq.map_oordeel (c.creatives, c.gemeten_creatives, c.spend, c.aankopen) as oordeel
from cel c;

comment on view marketing_hq.map_analyse is
  'De analysekaart: persona × angle × bewustzijnsniveau × product × sophistication, gewogen naar spend. roas is null zodra een vak onder een drempel zit; oordeel zegt welke.';

-- ── 5. Per aswaarde, over alle vakken heen ────────────────────────────────
-- De view die de valkuil uit de kop direct beantwoordt: hier is te zien dat
-- FOMO / Scarcity 41 creatives heeft, nul metingen en toch een ingetypt
-- gemiddelde van 2,38.
create or replace view marketing_hq.map_as_totaal as
with lang as (
  select brand, 'product' as as_naam, product as waarde,
         spend, aankopen, omzet, telt_mee, ingetypte_roas
    from marketing_hq.map_creative_as
  union all
  select brand, 'bewustzijnsniveau', bewustzijnsniveau,
         spend, aankopen, omzet, telt_mee, ingetypte_roas
    from marketing_hq.map_creative_as
  union all
  select brand, 'persona', persona,
         spend, aankopen, omzet, telt_mee, ingetypte_roas
    from marketing_hq.map_creative_as
  union all
  select brand, 'angle', angle,
         spend, aankopen, omzet, telt_mee, ingetypte_roas
    from marketing_hq.map_creative_as
  union all
  select brand, 'sophistication', sophistication,
         spend, aankopen, omzet, telt_mee, ingetypte_roas
    from marketing_hq.map_creative_as
),
per_waarde as (
  select
    l.brand,
    l.as_naam,
    l.waarde,
    count(*)::int                                              as creatives,
    count(*) filter (where l.telt_mee)::int                    as gemeten_creatives,
    coalesce(sum(l.spend)    filter (where l.telt_mee), 0)     as spend,
    coalesce(sum(l.aankopen) filter (where l.telt_mee), 0)     as aankopen,
    coalesce(sum(l.omzet)    filter (where l.telt_mee), 0)     as omzet,
    avg(l.ingetypte_roas)                                      as roas_ongewogen_ingetypt
  from lang l
  group by l.brand, l.as_naam, l.waarde
)
select
  p.brand,
  p.as_naam,
  p.waarde,
  p.creatives,
  p.gemeten_creatives,
  round(p.spend, 2)                                            as spend,
  p.aankopen::bigint                                           as aankopen,
  round(p.omzet, 2)                                            as omzet,
  case
    when marketing_hq.map_toestand(p.creatives, p.gemeten_creatives, p.spend, p.aankopen) = 'beoordeelbaar'
     and p.spend > 0
      then round(p.omzet / p.spend, 2)
  end                                                          as roas,
  round(p.roas_ongewogen_ingetypt, 2)                          as roas_ongewogen_ingetypt,
  round(p.spend / nullif(sum(p.spend) over (partition by p.brand, p.as_naam), 0) * 100, 1)
                                                               as aandeel_spend,
  marketing_hq.map_toestand(p.creatives, p.gemeten_creatives, p.spend, p.aankopen) as toestand,
  marketing_hq.map_oordeel (p.creatives, p.gemeten_creatives, p.spend, p.aankopen) as oordeel
from per_waarde p;

comment on view marketing_hq.map_as_totaal is
  'Per as en per waarde: hoeveel creatives, hoeveel daarvan gemeten, en het gewogen cijfer naast het ongewogen ingetypte. Waar die twee ver uit elkaar liggen, rust een eerdere conclusie op overgetikte cellen.';

-- ── 6. Wat de kaart in het geheel waard is ────────────────────────────────
-- Een merk zonder creatives staat hier ook, met zoveel woorden. Zelfde reden
-- als in 0041 en 0044: nul rijen ziet eruit als een kapotte view.
create or replace view marketing_hq.map_analyse_samenvatting as
with merken as (
  select distinct brand from marketing_hq.meta_accounts where actief
  union
  select distinct brand from public.creatives where brand is not null
)
select
  m.brand,
  count(a.brand)::int                                                        as vakken,
  count(*) filter (where a.toestand = 'beoordeelbaar')::int                  as vakken_beoordeelbaar,
  count(*) filter (where a.toestand = 'te weinig data')::int                 as vakken_te_dun,
  count(*) filter (where a.toestand = 'niet gemeten')::int                   as vakken_ongemeten,
  coalesce(sum(a.creatives), 0)::int                                         as creatives,
  round(coalesce(sum(a.spend), 0), 2)                                        as spend,
  round(coalesce(sum(a.spend) filter (where a.toestand = 'beoordeelbaar'), 0), 2) as spend_beoordeelbaar,
  case
    when coalesce(sum(a.spend), 0) > 0
      then round(coalesce(sum(a.spend) filter (where a.toestand = 'beoordeelbaar'), 0)
                 / sum(a.spend) * 100, 1)
  end                                                                        as aandeel_spend_beoordeelbaar,
  case
    when count(a.brand) = 0 then 'geen creatives in de map voor dit merk'
    when count(*) filter (where a.toestand = 'beoordeelbaar') = 0
      then 'creatives wel, maar geen enkel vak haalt de drempels'
    else 'kaart bruikbaar'
  end                                                                        as toestand
from merken m
left join marketing_hq.map_analyse a on a.brand = m.brand
group by m.brand;

comment on view marketing_hq.map_analyse_samenvatting is
  'Hoeveel van de analysekaart daadwerkelijk iets zegt, per merk. Een merk zonder creatives zegt dat met zoveel woorden in plaats van te ontbreken.';

-- ── 7. Welke vouwingen er zijn toegepast ──────────────────────────────────
create or replace view marketing_hq.map_as_schrijfwijzen as
with ruw as (
  select brand, 'product'           as as_naam, btrim(product)     as ruw from public.creatives
  union all select brand, 'persona',              btrim(persona)         from public.creatives
  union all select brand, 'bewustzijnsniveau',    btrim(awareness_level) from public.creatives
  union all select brand, 'angle',                btrim(angle_type)      from public.creatives
)
select
  r.brand,
  r.as_naam,
  r.ruw                                        as ruwe_waarde,
  marketing_hq.map_as(r.as_naam, r.ruw)        as op_de_as,
  (marketing_hq.map_as(r.as_naam, r.ruw) is distinct from nullif(r.ruw, ''))
                                               as gevouwen,
  count(*)::int                                as creatives
from ruw r
where nullif(r.ruw, '') is not null
group by r.brand, r.as_naam, r.ruw;

comment on view marketing_hq.map_as_schrijfwijzen is
  'Welke ruwe waarden op welke aswaarde uitkomen, en of er gevouwen is. Een vouwing die niemand kan zien is een aanname die niemand kan corrigeren.';

-- ── 8. De kruistabel met de lege vakken erin ──────────────────────────────
-- Een functie en geen view, met opzet. Vier assen volledig uitkruisen geeft
-- ~75.000 rijen waarvan 153 gevuld zijn; dat is geen eerlijkheid maar ruis.
-- Per product persona × angle is wél te overzien, en dat is ook de vraag die
-- iemand stelt: "voor dit product, welke combinaties hebben we nooit
-- geprobeerd."
create or replace function marketing_hq.map_kruistabel(p_brand text, p_product text)
returns table (
  persona           text,
  persona_gekozen   boolean,
  angle             text,
  creatives         int,
  gemeten_creatives int,
  spend             numeric,
  aankopen          bigint,
  omzet             numeric,
  roas              numeric,
  toestand          text,
  oordeel           text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with personas as (
    select distinct m.persona from marketing_hq.map_creative_as m
     where m.brand = p_brand and m.persona is not null
  ),
  angles as (
    select distinct m.angle from marketing_hq.map_creative_as m
     where m.brand = p_brand and m.angle is not null
  ),
  gevuld as (
    select
      m.persona,
      m.angle,
      count(*)::int                                            as creatives,
      count(*) filter (where m.telt_mee)::int                  as gemeten_creatives,
      coalesce(sum(m.spend)    filter (where m.telt_mee), 0)   as spend,
      coalesce(sum(m.aankopen) filter (where m.telt_mee), 0)   as aankopen,
      coalesce(sum(m.omzet)    filter (where m.telt_mee), 0)   as omzet
    from marketing_hq.map_creative_as m
    where m.brand = p_brand
      and m.product is not distinct from p_product
    group by m.persona, m.angle
  )
  select
    p.persona,
    (p.persona <> 'Geen specifieke persona'),
    a.angle,
    coalesce(g.creatives, 0),
    coalesce(g.gemeten_creatives, 0),
    round(coalesce(g.spend, 0), 2),
    coalesce(g.aankopen, 0)::bigint,
    round(coalesce(g.omzet, 0), 2),
    case
      when marketing_hq.map_toestand(g.creatives, g.gemeten_creatives, g.spend, g.aankopen) = 'beoordeelbaar'
       and g.spend > 0
        then round(g.omzet / g.spend, 2)
    end,
    /* Het lege vak dat de kruistabel bestaansrecht geeft: niet "niet gemeten"
       (dat zou suggereren dat er iets draaide) maar "nooit geprobeerd". */
    case
      when g.persona is null then 'nooit geprobeerd'
      else marketing_hq.map_toestand(g.creatives, g.gemeten_creatives, g.spend, g.aankopen)
    end,
    case
      when g.persona is null then 'nooit geprobeerd — geen creative met deze combinatie voor dit product'
      else marketing_hq.map_oordeel(g.creatives, g.gemeten_creatives, g.spend, g.aankopen)
    end
  from personas p
  cross join angles a
  left join gevuld g on g.persona = p.persona and g.angle = a.angle;
$$;

comment on function marketing_hq.map_kruistabel(text, text) is
  'Persona × angle voor één product, inclusief de combinaties die nooit geprobeerd zijn. Een functie en geen view: vier assen volledig uitkruisen geeft 75.000 rijen ruis.';

revoke all on function marketing_hq.map_kruistabel(text, text) from public, anon;
grant execute on function marketing_hq.map_kruistabel(text, text) to authenticated;

-- ── 9. Rechten ────────────────────────────────────────────────────────────
-- security_invoker-views lezen met de rechten van wie ze aanroept. Zonder deze
-- grants staat er "permission denied" op het scherm en groen in de test --
-- precies zoals bij 0039 en 0042.
alter table marketing_hq.map_as_synoniemen enable row level security;
alter table marketing_hq.map_drempels      enable row level security;

drop policy if exists team_read_synoniemen on marketing_hq.map_as_synoniemen;
create policy team_read_synoniemen on marketing_hq.map_as_synoniemen
  for select using (marketing_hq.is_team_member());

drop policy if exists team_read_drempels on marketing_hq.map_drempels;
create policy team_read_drempels on marketing_hq.map_drempels
  for select using (marketing_hq.is_team_member());

grant select on marketing_hq.map_as_synoniemen         to authenticated;
grant select on marketing_hq.map_drempels              to authenticated;
grant select on marketing_hq.map_creative_as           to authenticated;
grant select on marketing_hq.map_analyse               to authenticated;
grant select on marketing_hq.map_as_totaal             to authenticated;
grant select on marketing_hq.map_analyse_samenvatting  to authenticated;
grant select on marketing_hq.map_as_schrijfwijzen      to authenticated;

create or replace view public.hq_map_analyse
with (security_invoker = true) as
select * from marketing_hq.map_analyse;

create or replace view public.hq_map_as_totaal
with (security_invoker = true) as
select * from marketing_hq.map_as_totaal;

create or replace view public.hq_map_analyse_samenvatting
with (security_invoker = true) as
select * from marketing_hq.map_analyse_samenvatting;

create or replace view public.hq_map_as_schrijfwijzen
with (security_invoker = true) as
select * from marketing_hq.map_as_schrijfwijzen;

create or replace view public.hq_map_drempels
with (security_invoker = true) as
select * from marketing_hq.map_drempels;

grant select on public.hq_map_analyse              to authenticated;
grant select on public.hq_map_as_totaal            to authenticated;
grant select on public.hq_map_analyse_samenvatting to authenticated;
grant select on public.hq_map_as_schrijfwijzen     to authenticated;
grant select on public.hq_map_drempels             to authenticated;

-- ── Terugdraaien ──────────────────────────────────────────────────────────
-- drop view if exists public.hq_map_drempels, public.hq_map_as_schrijfwijzen,
--   public.hq_map_analyse_samenvatting, public.hq_map_as_totaal, public.hq_map_analyse;
-- drop function if exists marketing_hq.map_kruistabel(text, text);
-- drop view if exists marketing_hq.map_as_schrijfwijzen, marketing_hq.map_analyse_samenvatting,
--   marketing_hq.map_as_totaal, marketing_hq.map_analyse, marketing_hq.map_creative_as;
-- drop function if exists marketing_hq.map_oordeel(int, int, numeric, numeric);
-- drop function if exists marketing_hq.map_toestand(int, int, numeric, numeric);
-- drop function if exists marketing_hq.map_as(text, text);
-- drop table if exists marketing_hq.map_drempels, marketing_hq.map_as_synoniemen;
--
-- sophistication_niveaus en werkstukken.sophistication blijven staan: die zijn
-- van 0030 en niet van dit bestand.
