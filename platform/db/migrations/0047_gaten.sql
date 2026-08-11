-- ═══════════════════════════════════════════════════════════════════════════
-- 0047 — Wat er ontbreekt, en wat dat kost
--
-- Beslisvraag:
--
--     "Er staat een creative in de map die geld uitgeeft. Kan het brein er iets
--      mee?"
--
-- Waarom dit geen lijstje van zes rijen is
--
--   De zes C-rijen uit 0046 missen persona en bewustzijnsniveau. Die zou ik
--   kunnen markeren en klaar. Maar dit gaat opnieuw gebeuren: de map liep al
--   een half jaar achter zonder dat iemand het zag, en de volgende naamgeving
--   is er over drie maanden weer. Een lijst van zes is een pleister; een regel
--   is een systeem.
--
--   De regel: een creative die heeft gedraaid en waarvan een beslisveld leeg
--   is, is een gat. Niet omdat de rij onnet is, maar omdat er geld doorheen is
--   gegaan waar niets van te leren valt.
--
-- Waarom een concept géén gat is
--
--   Een creative die nog niet gedraaid heeft mág lege velden hebben — die is
--   nog in de maak. Zou alles wat leeg is een waarschuwing krijgen, dan staat
--   het scherm binnen een week vol en leest niemand ze meer. Alleen wat
--   gedraaid heeft telt, en dan nog: hoe meer geld, hoe zwaarder het gat.
--
-- Wat een beslisveld is
--
--   De assen waarop de Creative Strategy Map antwoord moet geven: persona,
--   bewustzijnsniveau, angle, product, desire. Dat is precies de vraag die het
--   brein straks stelt — welke persona werkt, op welk bewustzijnsniveau, met
--   welke angle. Ontbreekt er één, dan valt die creative uit die hele
--   kruistabel, en niet een beetje: helemaal.
--
--   Format en media_type staan er bewust niet bij. Nuttig om te weten, maar
--   een analyse zonder format is smaller; een analyse zonder persona is leeg.
--
-- Het bedrag erbij
--
--   Zonder bedrag is een gat een schoonmaakklusje en zakt het naar onderen op
--   ieders lijst. Mét bedrag is het een besluit: "€ 2.472 aan uitgaven waar we
--   niets van leren" is een zin waar iemand naar handelt.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view marketing_hq.map_gaten as
with gemeten as (
  select t.creative_id, sum(t.spend) as spend, sum(t.impressions) as impressions
  from marketing_hq.ad_totals t
  where t.creative_id is not null
  group by t.creative_id
)
select
  c.id                                              as creative_id,
  c.brand,
  c.ad_name,
  c.status,
  c.date_live,
  coalesce(g.spend, c.budget)                       as spend,

  array_remove(array[
    case when nullif(btrim(c.persona),         '') is null then 'persona'           end,
    case when nullif(btrim(c.awareness_level), '') is null then 'bewustzijnsniveau' end,
    case when nullif(btrim(c.angle_type),      '') is null then 'angle'             end,
    case when nullif(btrim(c.product),         '') is null then 'product'           end,
    case when nullif(btrim(c.desires),         '') is null then 'desire'            end
  ], null)                                          as ontbreekt,

  /* Alleen wat gedraaid heeft. Een concept in de maak mag lege velden hebben;
     zou alles wat leeg is een waarschuwing krijgen, dan staat het scherm binnen
     een week vol en leest niemand ze meer. */
  (
    (c.date_live is not null or coalesce(g.spend, c.budget, 0) > 0)
    and (
      nullif(btrim(c.persona),         '') is null or
      nullif(btrim(c.awareness_level), '') is null or
      nullif(btrim(c.angle_type),      '') is null or
      nullif(btrim(c.product),         '') is null or
      nullif(btrim(c.desires),         '') is null
    )
  )                                                 as moet_ingevuld
from public.creatives c
left join gemeten g on g.creative_id = c.id;

comment on view marketing_hq.map_gaten is
  'Per creative welke beslisvelden leeg zijn, en of dat er toe doet. Alleen wat gedraaid heeft telt als gat: een concept in de maak mag nog leeg zijn.';

-- ── Wat het in totaal kost ─────────────────────────────────────────────────
-- Eén regel per ontbrekend veld, met het bedrag dat erdoor onbruikbaar is.
-- Zo is te zien wélk veld het meeste geld blind maakt, in plaats van dat er
-- "nog wat velden leeg staan".
create or replace view marketing_hq.map_gaten_totaal as
select
  m.brand,
  veld,
  count(*)                                          as creatives,
  round(coalesce(sum(m.spend), 0), 2)               as spend_zonder_dit_veld
from marketing_hq.map_gaten m
cross join lateral unnest(m.ontbreekt) as veld
where m.moet_ingevuld
group by m.brand, veld;

comment on view marketing_hq.map_gaten_totaal is
  'Per merk en per ontbrekend beslisveld: hoeveel creatives en hoeveel uitgaven daardoor buiten de analyse vallen. Zonder bedrag is een gat een schoonmaakklusje; met bedrag is het een besluit.';

grant select on marketing_hq.map_gaten        to authenticated;
grant select on marketing_hq.map_gaten_totaal to authenticated;

create or replace view public.hq_map_gaten
with (security_invoker = true) as
select * from marketing_hq.map_gaten;

create or replace view public.hq_map_gaten_totaal
with (security_invoker = true) as
select * from marketing_hq.map_gaten_totaal;

grant select on public.hq_map_gaten        to authenticated;
grant select on public.hq_map_gaten_totaal to authenticated;
