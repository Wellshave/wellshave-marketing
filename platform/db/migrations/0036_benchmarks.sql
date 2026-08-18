-- ═══════════════════════════════════════════════════════════════════════════
-- 0036 — Banden om de cijfers, en invullen wat een opzoeking is
--
-- Beslisvraag:
--
--     "Is 0,34 goed?"
--
-- Zonder antwoord daarop is de tracker een tabel met getallen. Het tabblad
-- '📏 Benchmarks' uit de Creative Strategy Map heeft dat antwoord al — het
-- stond alleen in een spreadsheet en niet in het systeem.
--
-- ── 1. De banden ────────────────────────────────────────────────────────────
--
--   Letterlijk overgenomen, inclusief de kalibratie die erbij staat: "Gecali-
--   breerd op accountdata: jullie mediaan hook rate is ~25%, winners zitten op
--   30%+." Dat is geen algemene branchenorm maar een meting aan dit account, en
--   dat verschil hoort mee te reizen — daarom staat de herkomst per regel in
--   de tabel en niet in een commentaarregel die niemand meer terugvindt.
--
--   In verhoudingen en niet in procenten, want zo staan ze in de database
--   (0008: round(video_3s / impressions, 4)) en zo stonden ze ook al in de
--   sheet. Twee eenheden voor hetzelfde getal is precies hoe een import er 100
--   naast gaat zitten zonder dat het opvalt.
--
--   Eén afwijking van de sheet, met opzet. De sheet kleurt een hook rate van
--   1233% donkergroen en merkt daar zelf over op: "Sommige oude rijen bevatten
--   invoerfouten (bijv. hook rate 1233%), die kleuren donkergroen en kun je het
--   beste even corrigeren." Een oordeelfunctie die 'uitstekend' zegt over een
--   onmogelijke waarde is erger dan geen oordeel: hij zet zo'n rij bovenaan
--   elke ranglijst. Boven de 100% heet het hier 'onmogelijk'. Er staan tien
--   van die rijen in.
--
-- ── 2. Wat wel en niet ingevuld wordt ───────────────────────────────────────
--
--   breakeven_roas en target_roas zijn eigenschappen van een product, niet van
--   een advertentie: alle 238 ingevulde Groom Guard-rijen zeggen 1,90 en 2,38.
--   Waar dat getal bij een advertentie ontbreekt is het geen onbekende maar een
--   niet-ingevuld vakje, en dat is op te zoeken.
--
--   De regel is daarom eng: alleen als er voor dat product precies één waarde
--   bekend is. Dat levert:
--
--     55 rijen invulbaar        Groom Guard (1,90), Scheerapparaat Elite
--                               (1,84), Blade Baron (2,15) en kleinere
--     3 rijen dubbelzinnig      Groom Guard PRO kent 1,65 én 1,78 én 1,87 —
--                               daar is het geen opzoeking maar een keuze,
--                               en die maakt iemand die weet waarom er drie
--                               zijn
--     12 rijen zonder bron      'Alle producten' en 'Essential Bundel' hebben
--                               nergens een waarde staan
--
--   Die 15 blijven leeg. Ze staan in de tracker als een gat, want dat zijn ze.
--
--   Verder wordt er niets ingevuld. Score, Next Step, Impressions en
--   Conversions zijn bij geen van de 624 rijen ingevuld en blijven dat: een
--   score afleiden uit de status zou een oordeel verzinnen dat niemand geveld
--   heeft, en daarna is niet meer te zien wat een mens vond en wat een formule
--   deed. Vanaf de nieuwe creatives geldt de nieuwe werkwijze; de historie
--   blijft de historie.
--
-- ── 3. De nieuwe werkwijze geldt vanaf nu ───────────────────────────────────
--
--   Dat is geen voornemen maar staat er al: 0030 laat een creative de maakfase
--   niet uit zonder hypothese, testvariabele en werkstuk, en de uitzondering
--   uit 0035 geldt uitsluitend bij INSERT van een rij met bron_bestand. Een
--   nieuwe creative valt daar niet onder en loopt dus gewoon tegen de eis aan.
--   platform/db/test/import-tracker.sh controleert precies dat.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. de banden ────────────────────────────────────────────────────────────

create table if not exists marketing_hq.benchmarks (
  metric      text    not null,
  band        text    not null,
  vanaf       numeric,          -- inclusief; null = geen ondergrens
  tot         numeric,          -- exclusief; null = geen bovengrens
  volgorde    smallint not null,
  toelichting text,
  bron        text    not null,
  primary key (metric, band)
);

comment on table marketing_hq.benchmarks is
  'Wanneer is een getal goed. Overgenomen uit het tabblad Benchmarks van de Creative Strategy Map.';

delete from marketing_hq.benchmarks where bron = 'Creative Strategy Map, tabblad Benchmarks';
insert into marketing_hq.benchmarks (metric, band, vanaf, tot, volgorde, bron) values
  ('hook_rate', 'matig',      null,  0.20,  1, 'Creative Strategy Map, tabblad Benchmarks'),
  ('hook_rate', 'prima',      0.20,  0.30,  2, 'Creative Strategy Map, tabblad Benchmarks'),
  ('hook_rate', 'goed',       0.30,  0.40,  3, 'Creative Strategy Map, tabblad Benchmarks'),
  ('hook_rate', 'uitstekend', 0.40,  null,  4, 'Creative Strategy Map, tabblad Benchmarks'),

  ('hold_rate', 'matig',      null,  0.08,  1, 'Creative Strategy Map, tabblad Benchmarks'),
  ('hold_rate', 'prima',      0.08,  0.15,  2, 'Creative Strategy Map, tabblad Benchmarks'),
  ('hold_rate', 'goed',       0.15,  0.20,  3, 'Creative Strategy Map, tabblad Benchmarks'),
  ('hold_rate', 'uitstekend', 0.20,  null,  4, 'Creative Strategy Map, tabblad Benchmarks'),

  ('ctr',       'matig',      null,  0.008, 1, 'Creative Strategy Map, tabblad Benchmarks'),
  ('ctr',       'prima',      0.008, 0.015, 2, 'Creative Strategy Map, tabblad Benchmarks'),
  ('ctr',       'goed',       0.015, 0.02,  3, 'Creative Strategy Map, tabblad Benchmarks'),
  ('ctr',       'uitstekend', 0.02,  null,  4, 'Creative Strategy Map, tabblad Benchmarks'),

  ('cvr',       'matig',      null,  0.015, 1, 'Creative Strategy Map, tabblad Benchmarks'),
  ('cvr',       'prima',      0.015, 0.03,  2, 'Creative Strategy Map, tabblad Benchmarks'),
  ('cvr',       'goed',       0.03,  0.05,  3, 'Creative Strategy Map, tabblad Benchmarks'),
  ('cvr',       'uitstekend', 0.05,  null,  4, 'Creative Strategy Map, tabblad Benchmarks');

-- Wat de banden niet zeggen. Uit dezelfde bron, en het verandert hoe je ernaar
-- kijkt: niet elke groene kolom is even veel waard.
update marketing_hq.benchmarks set toelichting =
  'De creative-metric: stopt dit de scroll. Winners in dit account zitten boven 30%.'
  where metric = 'hook_rate';
update marketing_hq.benchmarks set toelichting =
  'Houdt de advertentie vast wie hij gestopt heeft.'
  where metric = 'hold_rate';
update marketing_hq.benchmarks set toelichting =
  'Onderscheidt in dit account winners nauwelijks van losers. Niet blind op optimaliseren.'
  where metric = 'ctr';
update marketing_hq.benchmarks set toelichting =
  'De waarheid-metric: hier blijkt of de klik iets waard was.'
  where metric = 'cvr';

-- ── 2. het oordeel ──────────────────────────────────────────────────────────

-- Geeft null terug waar de sheet geen kleur geeft: bij niets en bij nul. Een
-- nul is in deze tabel geen meting maar een leeg vakje dat als getal is
-- opgeslagen — 546 rijen hebben een ROAS en het merendeel staat op 0,00 zonder
-- impressions eronder.
create or replace function marketing_hq.benchmark_band(p_metric text, p_waarde numeric)
returns text language sql stable as $$
  select case
    when p_waarde is null or p_waarde = 0 then null
    -- Een verhouding boven de 1 is geen uitschieter maar een invoerfout.
    when p_waarde > 1 then 'onmogelijk'
    else (select b.band from marketing_hq.benchmarks b
          where b.metric = p_metric
            and (b.vanaf is null or p_waarde >= b.vanaf)
            and (b.tot   is null or p_waarde <  b.tot)
          order by b.volgorde limit 1)
  end
$$;

comment on function marketing_hq.benchmark_band(text, numeric) is
  'Welke band hoort bij deze waarde. Null bij leeg en bij nul, net als in de sheet.';

create or replace view public.hq_benchmarks
with (security_invoker = true) as
select metric, band, vanaf, tot, volgorde, toelichting, bron
from marketing_hq.benchmarks;

grant select on public.hq_benchmarks to authenticated;
grant execute on function marketing_hq.benchmark_band(text, numeric) to authenticated;

-- ── 3. invullen wat een opzoeking is ────────────────────────────────────────

-- Alleen waar het product precies één bekende waarde heeft. Waar er twee of
-- meer zijn, of nul, blijft het leeg. `having count(distinct ...) = 1` is de
-- hele voorwaarde: minder streng en het wordt raden.
with eenduidig as (
  select product,
         min(breakeven_roas) as be,
         min(target_roas)    as tg
  from public.creatives
  where product is not null
  group by product
  having count(distinct breakeven_roas) = 1
     and count(distinct target_roas)    = 1
)
update public.creatives c
   set breakeven_roas = coalesce(c.breakeven_roas, e.be),
       target_roas    = coalesce(c.target_roas,    e.tg)
  from eenduidig e
 where c.product = e.product
   and (c.breakeven_roas is null or c.target_roas is null);
