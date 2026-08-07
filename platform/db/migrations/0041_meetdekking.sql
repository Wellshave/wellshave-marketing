-- ═══════════════════════════════════════════════════════════════════════════
-- 0041 — "De sync werkt" is niet hetzelfde als "de tracker meet"
--
-- Beslisvraag:
--
--     "Er komt data binnen. Waarom staat er dan nog niets bij mijn
--      advertenties?"
--
-- Wat de eerste geslaagde run liet zien
--
--   Op 7 augustus 10:06 haalde Atlas voor het eerst sinds 4 augustus cijfers
--   op: 19 metingen over 2 accounts en 7 dagen, €2.283 spend, 273.284
--   vertoningen, 22.611 videostarts en 2.128 thruplays. Geen enkele
--   waarschuwing. meta_sync_status sprong van 'kapot' naar 'werkt'.
--
--   En in de tracker veranderde er niets. Nul advertenties met een meting.
--
--   Dat is geen fout maar een niveauverschil, en precies daar zat het scherm
--   fout. Atlas meet op account- en campagneniveau — dat is wat een dagrapport
--   nodig heeft. creative_results heeft advertentieniveau nodig, én een
--   publicatie die een creative aan een meta_ad_id knoopt. Er staan nul
--   ad-rijen en nul publicaties, dus er is niets om aan te koppelen.
--
--   De tracker zei intussen: "Zodra de Meta-koppeling draait, winnen gemeten
--   cijfers automatisch van ingetypte." Dat was waar toen de koppeling stuk
--   was en is nu misleidend: hij draait, en er verandert niets. Wie dat leest
--   gaat wachten op iets wat al gebeurd is.
--
-- Wat deze migratie toevoegt
--
--   Drie tellingen bij meta_sync_status, zodat het scherm het verschil kan
--   zeggen in plaats van het te verzwijgen:
--
--     metingen_advertentieniveau   de rijen waar creative_results uit kan
--                                  putten
--     gekoppelde_advertenties      publicaties met een meta_ad_id: zonder die
--                                  koppeling is een ad-meting een getal zonder
--                                  eigenaar
--     gemeten_niveaus              wat er werkelijk binnenkomt, in woorden
--
--   Geen nieuwe toestand erbij. 'werkt' blijft 'werkt' — er komt data binnen,
--   dat is waar. De vraag "meet de tracker ook" is een andere vraag, en die
--   hoort een eigen antwoord te hebben in plaats van de eerste te vertroebelen.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view marketing_hq.meta_sync_status as
with laatste_meting as (
  select max(captured_at) as op, count(*) as rijen from marketing_hq.meta_insights_daily
),
dekking as (
  select
    count(*) filter (where level = 'ad')                     as op_advertentieniveau,
    string_agg(distinct level, ', ' order by level)          as niveaus
  from marketing_hq.meta_insights_daily
),
koppeling as (
  select count(*) as gekoppeld
  from marketing_hq.meta_publications
  where meta_ad_id is not null and published_at is not null
),
laatste_klacht as (
  select created_at, message, data
  from marketing_hq.agent_events
  where level = 'warn'
    and (message ilike 'Meta gaf geen cijfers%' or message ilike 'Meta weigerde%'
         or message ilike 'Meta kent deze velden%')
  order by created_at desc
  limit 1
),
pogingen as (
  select count(*) as sinds_gisteren
  from marketing_hq.agent_events
  where level = 'warn' and created_at > now() - interval '36 hours'
    and (message ilike 'Meta gaf geen cijfers%' or message ilike 'Meta weigerde%')
)
select
  m.rijen                                             as gemeten_rijen,
  m.op                                                as laatst_gemeten,
  k.created_at                                        as laatste_klacht_op,
  k.message                                           as laatste_klacht,
  k.data ->> 'fout'                                   as laatste_fout,
  p.sinds_gisteren                                    as mislukte_pogingen_36u,
  case
    when m.rijen > 0 and m.op > now() - interval '36 hours' then 'werkt'
    when p.sinds_gisteren > 0                               then 'kapot'
    when m.rijen = 0                                        then 'nooit gedraaid'
    else 'stil'
  end                                                 as toestand,

  -- Vanaf hier nieuw in 0041.
  d.op_advertentieniveau                              as metingen_advertentieniveau,
  coalesce(d.niveaus, '—')                            as gemeten_niveaus,
  ko.gekoppeld                                        as gekoppelde_advertenties
from laatste_meting m
cross join dekking d
cross join koppeling ko
cross join pogingen p
left join laatste_klacht k on true;

comment on view marketing_hq.meta_sync_status is
  'Doet de Meta-koppeling het nog, en tot waar reikt hij. "Werkt" gaat over binnenkomende data; of de tracker meet is een andere vraag en staat in de dekkingskolommen.';

create or replace view public.hq_meta_sync_status
with (security_invoker = true) as
select * from marketing_hq.meta_sync_status;

grant select on public.hq_meta_sync_status to authenticated;
grant select on marketing_hq.meta_sync_status to authenticated;
