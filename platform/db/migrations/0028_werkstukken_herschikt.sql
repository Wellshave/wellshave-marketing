-- ═══════════════════════════════════════════════════════════════════════════
-- 0028 — De drie werkstukken herschikt: van kop naar vraag
--
-- De drie werkstukken op productie zijn nooit als werkstuk geschreven. Ze zijn
-- op 29 juli met terugwerkende kracht om bestaande advertenties heen gelegd —
-- dat staat er zelf ook: "Bestond al voordat de estafette er was". Hun titel is
-- daarom de kop van een advertentie, en bij nummer 11 zelfs een opdracht aan
-- een ontwerper.
--
-- Dat is geen cosmetisch probleem.
--
-- **Een werkstuk met een kop als titel kan niet fout gaan.** Er valt niets aan
-- te weerleggen: "184.000+ mannen googelden dit ook" is waar of niet waar, maar
-- het is geen bewering over ons werk. Een werkstuk met een vraag als titel kan
-- met nee beantwoord worden, en dat is het enige soort werk waar iets uit te
-- leren valt. De hele keten hangt daarop: het denkstuk vraagt om een hypothese,
-- ⑤ meet ertegen, en de learning legt vast wat eruit kwam. Op een kop is geen
-- van die drie te doen.
--
-- ── Wat hier gebeurt ───────────────────────────────────────────────────────
--
-- Drie titels worden vragen, en twee hoeken worden gecorrigeerd. De indeling
-- zelf klopte al: de drie zoek-advertenties zijn drie varianten op één
-- gedachte, en de twee sneetjes-advertenties ook. Er verhuist dus geen enkele
-- creative; wat verandert is hoe het werk heet en waaronder het geleerd wordt.
--
-- De hoek is daarbij het belangrijkste veld, want `angle_type` is de sleutel
-- waarop `angle_learnings` (0008) en het dossier van ② (0025) samenvoegen. Een
-- verkeerde hoek splitst de geschiedenis van een idee stilletjes in tweeën, en
-- dat merk je pas als je je afvraagt waarom er nooit genoeg advertenties onder
-- één hoek staan om `betrouwbaar` te halen.
--
-- Op twee creatives stond `premium`, overgenomen uit `marketing_angle` waar
-- hetzelfde woord stond. Maar wat die twee advertenties doen is niet duur
-- lijken: ze nemen de angst voor sneetjes weg door te laten zien hoe de kop
-- eruitziet. Dat is `safety`, en dat is ook wat er getest wordt.
--
-- Wat níét gebeurt: er wordt geen hypothese verzonnen en geen denkstuk
-- ingevuld. Dat is ② en daar tekent een mens (0023).
-- ═══════════════════════════════════════════════════════════════════════════

-- Het archief van 0027 gaat ook over overschreven waarden. Wie een titel
-- verandert die iemand anders heeft ingetypt, hoort te kunnen laten zien wat
-- er stond.
comment on table marketing_hq.opgeruimd is
  'Wat er is weggehaald of overschreven, met de reden en de rij zoals hij was. Opruimen zonder spoor is niet opruimen maar kwijtraken.';

-- ── 1. Bewaren wat er stond ────────────────────────────────────────────────
insert into marketing_hq.opgeruimd (herkomst, herkomst_id, reden, rij, door)
select 'marketing_hq.werkstukken', w.id,
       'titel was een advertentiekop, geen vraag; herschikt zodat er iets te weerleggen valt',
       to_jsonb(w), 'migratie 0028'
from marketing_hq.werkstukken w
where w.id in (9, 10, 11)
on conflict (herkomst, herkomst_id) do nothing;

-- ── 2. De drie vragen ──────────────────────────────────────────────────────
-- Elke update noemt de oude waarde in zijn `where`. Dat maakt hem herhaalbaar
-- zonder gevolgen: draait hij twee keer, dan vindt de tweede niets meer. En
-- draait hij op een database waar iemand de titel intussen zelf heeft
-- aangepast, dan laat hij dat met rust in plaats van het te overschrijven.

-- ⑨ Drie advertenties, één gedachte: je bent niet de enige die dit stiekem
--   opzoekt. De hoek is sociaal bewijs op een schaamtevolle zoekvraag.
update marketing_hq.werkstukken
   set titel      = 'Werkt sociaal bewijs op een schaamtevolle zoekvraag bij Mark?',
       angle_type = 'social-proof',
       aanleiding = aanleiding
         || ' De drie advertenties eronder zijn drie varianten op één gedachte:'
         || ' je bent niet de enige die dit ''s nachts opzoekt.',
       updated_at = now()
 where id = 9
   and titel = '184.000+ mannen googelden dit ook.';

-- ⑩ Andere persona, ander product: dit stond al goed ingedeeld, alleen de
--   titel was de naam van de advertentie.
update marketing_hq.werkstukken
   set titel      = 'Werkt de directe vergelijking met Dyson bij Sanne?',
       aanleiding = aanleiding
         || ' De vergelijking is de hele hoek: als die niet werkt, werkt de'
         || ' advertentie niet.',
       updated_at = now()
 where id = 10
   and titel = 'Dyson airstyler vs Airstyler Nova';

-- ⑪ De titel was letterlijk de opdracht aan een ontwerper. Wat er getest wordt
--   is niet 'één static maken' maar of het tonen van het mechanisme de angst
--   wegneemt.
update marketing_hq.werkstukken
   set titel      = 'Werkt het tonen van het mechanisme tegen de angst voor sneetjes bij Mark?',
       angle_type = 'safety',
       aanleiding = aanleiding
         || ' De twee advertenties eronder pakken dezelfde angst aan vanaf twee'
         || ' kanten: de oorzaak tonen, en de kop van dichtbij laten zien.',
       updated_at = now()
 where id = 11
   and titel like 'Eén static die de angst voor sneetjes%';

-- ── 3. De hoek onder de advertenties ───────────────────────────────────────
-- Zelfde hoek als het werkstuk, anders vindt het dossier van ② ze niet terug.
-- Alleen waar hij leeg is of aantoonbaar verkeerd: een hoek overschrijven die
-- iemand bewust heeft gekozen, is precies wat deze migratie niet moet doen.
update public.creatives
   set angle_type      = 'social-proof',
       marketing_angle = coalesce(nullif(trim(marketing_angle), ''),
                                  'Je bent niet de enige die dit opzoekt'),
       updated_at      = now()
 where werkstuk_id = 9
   and angle_type is null;

update public.creatives
   set angle_type      = 'safety',
       marketing_angle = 'Veilig scheren daar beneden — te zien aan de kop',
       updated_at      = now()
 where werkstuk_id = 11
   and angle_type = 'premium';

-- ── 4. Wat er nu klopt ─────────────────────────────────────────────────────
-- Een werkstuk en zijn advertenties horen onder dezelfde hoek te vallen. Staan
-- ze uit elkaar, dan telt `angle_learnings` de advertentie mee onder een hoek
-- waar het werkstuk niets van weet, en dan klopt het dossier van het volgende
-- werkstuk niet meer. Dit is niet af te dwingen met een constraint — een
-- creative mag aan geen enkel werkstuk hangen — maar het hoort wel op te
-- vallen.
create or replace view marketing_hq.hoek_scheef as
select
  c.id                                          as creative_id,
  c.ad_name,
  c.werkstuk_id,
  w.titel                                       as werkstuk,
  w.angle_type                                  as hoek_werkstuk,
  c.angle_type                                  as hoek_creative,
  case
    when c.angle_type is null and w.angle_type is null
      then 'geen van beide heeft een hoek — dit werk leert niets, hoe goed het ook draait'
    when c.angle_type is null
      then 'de advertentie heeft geen hoek, het werkstuk wel (' || w.angle_type || ')'
    when w.angle_type is null
      then 'het werkstuk heeft geen hoek, de advertentie wel (' || c.angle_type || ')'
    else 'werkstuk staat onder ' || w.angle_type || ', advertentie onder ' || c.angle_type
         || ' — de geschiedenis van dit idee valt in tweeën uiteen'
  end                                           as waarom
from public.creatives c
join marketing_hq.werkstukken w on w.id = c.werkstuk_id
where c.angle_type is distinct from w.angle_type;

comment on view marketing_hq.hoek_scheef is
  'Advertenties die onder een andere hoek staan dan hun werkstuk. Niet verboden, wel bijna altijd een vergissing.';

alter view marketing_hq.hoek_scheef set (security_invoker = true);
grant select on marketing_hq.hoek_scheef to authenticated;

do $$
declare open_views text;
begin
  select string_agg(c.relname, ', ') into open_views
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
-- Geen hypothese en geen denkstuk. De titel is nu een vraag; het antwoord dat
-- getoetst wordt hoort in ② te staan, en daar tekent een mens voor. Een
-- migratie die alvast invult wat iemand had moeten bedenken, maakt van het
-- denkstuk een formulier.
--
-- Geen verhuizing van creatives. De indeling klopte: drie varianten op de
-- zoekhoek, twee op de angst voor sneetjes, één vergelijking. Alleen de namen
-- deugden niet.
--
-- Geen ingevuld `format` op de drie zoek-advertenties. Dat is nog steeds niet
-- af te leiden, en het staat in `creatie_gereed` waar het hoort.
--
-- Geen constraint die een scheve hoek verbiedt. Een creative mag los van een
-- werkstuk bestaan, en tijdens het herschrijven van een hoek staan ze even uit
-- elkaar. `hoek_scheef` maakt het zichtbaar; dat is genoeg voor iets wat een
-- vergissing is en geen fout.
--
-- ── Terugdraaien ───────────────────────────────────────────────────────────
-- De drie werkstukken staan met hun oude rij in marketing_hq.opgeruimd:
--   update marketing_hq.werkstukken w set titel = o.rij->>'titel',
--          angle_type = o.rij->>'angle_type', aanleiding = o.rij->>'aanleiding'
--     from marketing_hq.opgeruimd o
--    where o.herkomst = 'marketing_hq.werkstukken' and o.herkomst_id = w.id;
-- drop view if exists marketing_hq.hoek_scheef;
-- ═══════════════════════════════════════════════════════════════════════════
