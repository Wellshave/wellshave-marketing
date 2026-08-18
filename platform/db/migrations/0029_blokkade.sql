-- ═══════════════════════════════════════════════════════════════════════════
-- 0029 — De blokkade zichtbaar maken
--
-- De werkbank beantwoordt sinds 0019 één vraag: welk werk ligt stil, en op wie
-- wacht het? Vandaag zegt hij van werkstuk 11 "ligt bij jou op station 4 —
-- live". Dat is waar en het is onbruikbaar: het werkstuk ligt daar niet omdat
-- jij moet publiceren, maar omdat de Criticus er nog geen oordeel over velde en
-- 0026 aannemen weigert zonder dat oordeel.
--
-- Twee grendels bepalen vandaag of een werkstuk van ③ naar ④ komt, en geen van
-- beide is op dit scherm te zien:
--
--   1. Het oordeel van de Criticus (0026). Zonder oordeel geen aannemen; bij
--      'niet door' ook niet.
--   2. Een blokkerende onzekerheid in de overdracht (0022). Die zet mens_nodig
--      aan, en zolang daar iets in staat is de volgende stap niet aan een agent
--      over te laten.
--
-- Een grendel die niemand ziet wordt niet omzeild maar vergeten. Dat is precies
-- wat er op 29 juli gebeurde: drie werkstukken stonden op 'klaar' zonder
-- overdracht, en dat viel pas op toen iemand er expliciet naar zocht.
--
-- Deze migratie voegt geen regel toe. Hij maakt de regels die er al zijn
-- zichtbaar op de plek waar iemand kijkt. Additief: 0019 en 0026 blijven zoals
-- ze zijn, er komen alleen kolommen bij de view.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Wat een werkstuk tegenhoudt ─────────────────────────────────────────
-- Als functie en niet inline in de view, om drie redenen: hij is apart te
-- testen, hij is herbruikbaar voor het dossier van ⑤ en voor de Criticus zelf,
-- en de view blijft leesbaar.
--
-- De volgorde in de case is niet willekeurig. Een afgekeurd werkstuk is een
-- ander soort stil dan een werkstuk dat nog op een oordeel wacht: het eerste
-- vraagt om terugsturen, het tweede om lezen. Wie ze samenvat tot "geblokkeerd"
-- maakt van twee besluiten één statuslampje.
create or replace function marketing_hq.werkstuk_blokkade(p_werkstuk_id bigint)
returns table (soort text, reden text)
language sql stable as $$
  with open_overdracht as (
    -- De overdracht die nu open staat. Alleen die telt: een aangenomen of
    -- teruggestuurde overdracht is afgehandeld en houdt niets meer tegen.
    select o.id, o.van_station, o.mens_nodig, o.mens_nodig_reden
    from marketing_hq.werkstuk_overdrachten o
    where o.werkstuk_id = p_werkstuk_id
      and o.status = 'open'
    order by o.van_station desc
    limit 1
  ),
  oordeel as (
    select k.oordeel, k.reden
    from open_overdracht o
    join marketing_hq.criticus_oordelen k on k.overdracht_id = o.id
  )
  select * from (
    -- 1. Afgekeurd. Zwaarder dan al het andere: dit gaat niet vooruit tot
    --    iemand het terugstuurt, en dat is een besluit en geen wachttijd.
    select 'afgekeurd'::text as soort,
           ('de Criticus liet dit niet door: ' || o.reden)::text as reden
    from oordeel o where o.oordeel = 'niet door'

    union all

    -- 2. Wacht op een oordeel. Alleen bij de overdracht uit ③ — daar gaat de
    --    Criticus over (0026 §3), en elders zou 'wacht op de Criticus' een
    --    grendel suggereren die er niet is.
    select 'oordeel'::text,
           'de Criticus heeft hier nog geen oordeel over geveld'::text
    from open_overdracht ov
    where ov.van_station = 3
      and not exists (select 1 from oordeel)

    union all

    -- 3. Een blokkerende onzekerheid. Staat onderaan omdat hij het zwakst is:
    --    hij houdt de database niet tegen, hij zegt dat er een mens bij moet.
    --    Maar hij is wél opgeschreven door iemand die het werk kende, en dat
    --    maakt hem het lezen waard.
    select 'onzekerheid'::text, ov.mens_nodig_reden::text
    from open_overdracht ov
    where ov.mens_nodig
      and ov.mens_nodig_reden is not null
      and not exists (select 1 from oordeel where oordeel = 'niet door')
  ) alles
  limit 1
$$;

comment on function marketing_hq.werkstuk_blokkade(bigint) is
  'Wat dit werkstuk nu tegenhoudt, en van welke soort. Leeg als er niets tegenhoudt — stil zonder blokkade is een andere toestand dan geblokkeerd.';

-- ── 2. De werkbank, met de blokkade en het echte aantal creatives ──────────
-- Twee toevoegingen, en de tweede is een correctie.
--
-- `aantal_creatives` telt wat er werkelijk onder het werkstuk hangt. Tot nu toe
-- stond het aantal alleen in de toelichting op stap ③, als tekst die op 29 juli
-- is ingetypt: "6 varianten" bij werkstuk 9 en "2 varianten" bij 11. Het zijn er
-- vandaag drie en drie. Zo'n getal hoort niet twee keer te bestaan; het hoort
-- geteld te worden op het moment dat je kijkt.
--
-- `aantal_ads` blijft ernaast staan en betekent iets anders: dat zijn de
-- advertenties die daadwerkelijk gedraaid hebben. Het verschil tussen die twee
-- is precies de vraag "is er al iets mee gedaan".
create or replace view marketing_hq.werkbank as
with uit_brein as (
  select werkstuk_id, max(wanneer) as laatst
  from marketing_hq.brein
  where werkstuk_id is not null
  group by werkstuk_id
),
uit_stappen as (
  select werkstuk_id, max(afgerond_op) as laatst
  from marketing_hq.werkstuk_stappen
  where afgerond_op is not null
  group by werkstuk_id
),
laatste as (
  select w.id as werkstuk_id,
         coalesce(greatest(b.laatst, s.laatst), w.created_at) as laatst
  from marketing_hq.werkstukken w
  left join uit_brein   b on b.werkstuk_id = w.id
  left join uit_stappen s on s.werkstuk_id = w.id
),
huidig as (
  select s.werkstuk_id, s.station, s.agent_id, s.status, s.overdracht, stn.naam as station_naam
  from marketing_hq.werkstuk_stappen s
  join marketing_hq.werkstuk_stations stn on stn.station = s.station
),
creatives as (
  select c.werkstuk_id, count(*)::int as aantal
  from public.creatives c
  where c.werkstuk_id is not null
  group by c.werkstuk_id
)
select
  w.id, w.brand, w.titel, w.product, w.persona, w.angle_type,
  w.toestand, w.stappen_af, w.station_nu, w.stappen,
  w.aantal_ads, w.spend, w.omzet, w.roas, w.winnaars,

  h.station_naam,
  h.overdracht,
  case
    when w.toestand = 'gestopt'                    then null
    when w.toestand = 'klaar'                      then null
    when h.overdracht in ('poort','mens')          then 'jij'
    else h.agent_id
  end                                                       as wacht_op,

  coalesce(l.laatst, w.created_at)                          as laatst_iets_gebeurd,
  round(extract(epoch from (now() - coalesce(l.laatst, w.created_at))) / 3600)::int as stil_uren,

  case h.overdracht
    when 'vanzelf' then 24
    when 'poort'   then 72
    when 'mens'    then 168
    else 72
  end                                                       as stil_grens_uren,

  case
    when w.toestand in ('gestopt','klaar') then false
    else extract(epoch from (now() - coalesce(l.laatst, w.created_at))) / 3600
         > case h.overdracht when 'vanzelf' then 24 when 'poort' then 72 when 'mens' then 168 else 72 end
  end                                                       as te_stil,

  case
    when w.toestand = 'gestopt'      then coalesce(w.gestopt_reden, 'gestopt zonder reden erbij')
    when w.toestand = 'klaar'        then 'alle zes de stations af'
    when w.toestand = 'vastgelopen'  then 'een stap is mislukt en niemand heeft hem opgepakt'
    when h.overdracht in ('poort','mens')
      then 'ligt bij jou op station ' || h.station || ' — ' || h.station_naam
    else 'ligt bij ' || coalesce(h.agent_id, 'niemand') || ' op station ' || h.station || ' — ' || h.station_naam
  end                                                       as waarom,

  w.created_at,

  -- Nieuwe kolommen horen achteraan: `create or replace view` mag een bestaande
  -- kolom niet van plek of naam veranderen, en de view laten vallen zou elke
  -- view die erop leunt meesleuren.
  --
  -- De blokkade staat náást `waarom` en niet erin. `waarom` zegt waar het ligt;
  -- dit zegt waarom het daar niet weg kan. Een afgerond of gestopt werkstuk
  -- kent geen blokkade — daar is niets meer tegen te houden.
  case when w.toestand in ('klaar','gestopt') then null else b.soort end as blokkade_soort,
  case when w.toestand in ('klaar','gestopt') then null else b.reden end as blokkade,
  coalesce(cr.aantal, 0)                                    as aantal_creatives
from marketing_hq.werkstuk_estafette w
left join laatste   l  on l.werkstuk_id = w.id
left join huidig    h  on h.werkstuk_id = w.id and h.station = w.station_nu
left join creatives cr on cr.werkstuk_id = w.id
left join lateral marketing_hq.werkstuk_blokkade(w.id) b on true;

comment on view marketing_hq.werkbank is
  'Welk werk ligt stil, en op wie wacht het? Stiltegrens per soort overdracht, want wachten op een mens is geen storing. Met de blokkade erbij: waar het ligt is iets anders dan waarom het daar niet weg kan.';
comment on column marketing_hq.werkbank.te_stil is
  'Stilte die betekenis heeft: langer dan wat bij dit soort overdracht normaal is. Niet zomaar "lang geleden".';
comment on column marketing_hq.werkbank.blokkade is
  'Wat dit werkstuk nu tegenhoudt. Leeg betekent: niets houdt het tegen, het is gewoon niemands beurt geweest.';
comment on column marketing_hq.werkbank.aantal_creatives is
  'Geteld op het moment van kijken. Stond eerder als tekst in de toelichting op stap ③ en liep daar achter.';

-- ── 3. De twee toelichtingen die een getal bevatten ────────────────────────
-- Ze zijn niet fout opgeschreven; ze zijn ingehaald. Het aantal stond erin op
-- de dag dat de stap werd aangemaakt en is sindsdien twee keer veranderd — bij
-- het opruimen van de duplicaten (0027) en bij de creative van 3 augustus.
--
-- De oplossing is niet het getal bijwerken maar het weghalen: het staat nu in
-- `aantal_creatives` en wordt daar geteld. Een feit dat op twee plekken staat,
-- loopt op één ervan uiteindelijk achter.
--
-- Alleen exact deze twee teksten, en alleen als ze er nog staan. Heeft iemand
-- de toelichting intussen zelf herschreven, dan blijft die staan.
--
-- En alleen op stappen waar een naam bij staat. Dat is geen willekeurige extra
-- voorwaarde: `werkstuk_stappen_precies_een_deelnemer` uit 0021 staat NOT VALID
-- omdat twee stappen uit juli niet te herleiden zijn. NOT VALID betekent dat de
-- regel geldt vanaf het moment dat je een rij aanraakt — dus een onschuldige
-- tekstwijziging op zo'n rij laat de constraint alsnog vuren, en dan valt deze
-- migratie om op iets wat er niets mee te maken heeft.
--
-- Die naamloze stappen mogen ook niet stiekem een naam krijgen om het probleem
-- weg te nemen: dan zou er staan dat iemand iets deed wat hij misschien niet
-- deed. Ze blijven zoals ze zijn. Het getal dat er in hun toelichting staat is
-- dan wel achterhaald, maar het staat in een tooltip, en het getal dat je op de
-- kaart léést komt uit `aantal_creatives` en klopt wel.
update marketing_hq.werkstuk_stappen
   set waarom = 'Creative gemaakt in de Atelier Console.'
 where station = 3
   and waarom in ('Creative gemaakt in de Atelier Console (6 varianten).',
                  'Creative gemaakt in de Atelier Console (2 varianten).')
   and (agent_id is not null or mens_id is not null);

-- ── 4. Toegang ─────────────────────────────────────────────────────────────
alter view marketing_hq.werkbank set (security_invoker = true);
grant select on marketing_hq.werkbank to authenticated;

-- select * pikt nieuwe kolommen niet vanzelf op: de view moet opnieuw gemaakt.
drop view if exists public.hq_werkbank;
create view public.hq_werkbank with (security_invoker = true)
  as select * from marketing_hq.werkbank;
revoke all on public.hq_werkbank from anon, public;
grant select on public.hq_werkbank to authenticated;

-- De functie draait als de aanroeper (geen security definer), dus hij ziet
-- precies wat die persoon mag zien. Zonder RLS-doorbraak, zoals de rest.
grant execute on function marketing_hq.werkstuk_blokkade(bigint) to authenticated;

-- ── Terugdraaien ───────────────────────────────────────────────────────────
-- Voer 0019 §werkbank opnieuw uit en daarna:
--   drop view if exists public.hq_werkbank;
--   create view public.hq_werkbank with (security_invoker = true)
--     as select * from marketing_hq.werkbank;
--   drop function if exists marketing_hq.werkstuk_blokkade(bigint);
-- De bijgewerkte toelichtingen zijn niet terug te draaien; het weggehaalde
-- getal staat in `aantal_creatives`.
