-- ═══════════════════════════════════════════════════════════════════════════
-- 0038 — Handmatig blijft kunnen, en de sync zegt of hij het nog doet
--
-- Beslisvraag:
--
--     "Welk getal geloof ik, en waarom staat het er niet?"
--
-- ── 1. Meta wint, behalve als een mens iets beters weet ─────────────────────
--
--   0011 laat gemeten cijfers winnen van ingetypte: `coalesce(r.roas, c.roas)`.
--   Dat is de juiste standaard — een meting is beter dan een overtikte cel, en
--   zonder die regel heb je twee waarheden.
--
--   Maar hij kent geen uitzondering, en die is er wel. Meta meet niet altijd
--   goed: attributievensters verschuiven, de pixel mist een stap, een
--   conversie komt dubbel binnen. Vandaag is dat zichtbaar in de data zelf —
--   bij één campagne stonden 37 ViewContent tegenover 477 landingspaginaweer-
--   gaven. Zodra de sync draait, overschrijft zo'n meting stilzwijgend het
--   getal dat iemand met de hand had rechtgezet, en dan is de correctie weg
--   zonder dat iemand het ziet.
--
--   Vandaar `cijfers_vastgezet`: een mens zegt "deze cijfers kloppen, laat ze
--   staan". Dan wint de handmatige kolom, ook als Meta iets anders zegt. Drie
--   dingen maken dat het geen achterdeur wordt:
--
--     · het is per advertentie en niet per account of globaal
--     · wie het deed en wanneer staat erbij, want een getal dat afwijkt van de
--       meting zonder dat je weet wie dat besloot is erger dan geen getal
--     · `cijfers_bron` wordt 'handmatig-vast', dus het scherm kan het tonen.
--       Een vastgezet cijfer dat eruitziet als een meting is precies de tweede
--       waarheid die dit hele systeem probeert te vermijden
--
--   Wat er níét komt: een manier om dit voor alles tegelijk aan te zetten. Dan
--   is het geen correctie meer maar een tweede administratie.
--
-- ── 2. Waarom er niets gemeten is ───────────────────────────────────────────
--
--   meta_insights_daily is leeg, en dat lag niet aan een ontbrekende koppeling.
--   De worker draait, het token werkt, de agents draaien elke ochtend. Meta
--   weigerde elk verzoek om één veld dat niet meer bestaat
--   (video_3_sec_watched_actions), en dat is sinds 4 augustus elke dag opnieuw
--   gebeurd. Het stond in agent_events als `warn` en verder nergens.
--
--   Dat is de eigenlijke fout: niet dat het misging, maar dat het twee dagen
--   kon misgaan zonder dat iemand het zag. Een lege tracker zei "geen cijfers"
--   en niet "de sync ligt eruit", en dat is het verschil tussen wachten en
--   ingrijpen.
--
--   Deze view maakt er een antwoord van. Hij leest de events en zegt wanneer er
--   voor het laatst iets binnenkwam, wat de laatste klacht was, en hoe lang dat
--   al duurt.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. vastzetten ───────────────────────────────────────────────────────────

alter table public.creatives add column if not exists cijfers_vastgezet      boolean not null default false;
alter table public.creatives add column if not exists cijfers_vastgezet_door uuid references public.team_members(id);
alter table public.creatives add column if not exists cijfers_vastgezet_op   timestamptz;

comment on column public.creatives.cijfers_vastgezet is
  'Een mens heeft deze cijfers rechtgezet; ze blijven staan ook als Meta iets anders meet.';
comment on column public.creatives.cijfers_vastgezet_door is
  'Wie dat besloot. Een afwijking van de meting zonder naam is niet te beoordelen.';

-- Vastzetten zonder te zeggen wie, kan niet. Zonder deze regel is het over een
-- half jaar een getal waarvan niemand meer weet waarom het afwijkt.
alter table public.creatives drop constraint if exists creatives_vastzetten_heeft_naam;
alter table public.creatives
  add constraint creatives_vastzetten_heeft_naam
  check (not cijfers_vastgezet or (cijfers_vastgezet_door is not null and cijfers_vastgezet_op is not null))
  not valid;

create or replace view marketing_hq.creative_kaart as
select
  c.id, c.brand, c.werkstuk_id,
  c.ad_name, c.product, c.persona, c.angle_type, c.format, c.media_type,
  c.hook_short, c.awareness_level, c.marketing_angle, c.creative_concept,
  c.status, c.score, c.next_step, c.date_live, c.notes,
  c.has_image,
  (c.image_b64 is not null)                           as beeld_beschikbaar,
  c.creatives_link,

  -- `vast` keert de voorrang om, en alleen voor deze rij. De volgorde is verder
  -- ongewijzigd: zonder vastzetten wint de meting, zoals in 0011.
  case when c.cijfers_vastgezet then c.roas      else coalesce(r.roas,      c.roas)      end as roas,
  case when c.cijfers_vastgezet then c.ctr       else coalesce(r.ctr,       c.ctr)       end as ctr,
  case when c.cijfers_vastgezet then c.cpm       else coalesce(r.cpm,       c.cpm)       end as cpm,
  case when c.cijfers_vastgezet then c.cpc       else coalesce(r.cpc,       c.cpc)       end as cpc,
  case when c.cijfers_vastgezet then c.cpa       else coalesce(r.cpa,       c.cpa)       end as cpa,
  case when c.cijfers_vastgezet then c.aov       else coalesce(r.aov,       c.aov)       end as aov,
  case when c.cijfers_vastgezet then c.cvr       else coalesce(r.cvr,       c.cvr)       end as cvr,
  case when c.cijfers_vastgezet then c.hook_rate else coalesce(r.hook_rate, c.hook_rate) end as hook_rate,
  case when c.cijfers_vastgezet then c.hold_rate else coalesce(r.hold_rate, c.hold_rate) end as hold_rate,
  case when c.cijfers_vastgezet then c.impressions else coalesce(r.impressions, c.impressions) end as impressions,

  r.spend, r.purchases, r.dagen_live, r.meetdagen, r.beoordeelbaar,
  case
    when c.cijfers_vastgezet                       then 'handmatig-vast'
    when r.creative_id is not null                 then 'meta'
    when c.roas is not null or c.ctr is not null   then 'handmatig'
    else 'geen'
  end                                                 as cijfers_bron,
  c.created_at, c.updated_at,
  c.desires, c.channel, c.audience, c.budget,
  case when c.cijfers_vastgezet then c.conversions else coalesce(r.purchases, c.conversions) end as conversions,
  c.breakeven_roas, c.target_roas, c.hypothesis, c.test_variable,
  c.bron_bestand, c.bron_status, c.bron_rij,

  marketing_hq.benchmark_band('hook_rate',
    case when c.cijfers_vastgezet then c.hook_rate else coalesce(r.hook_rate, c.hook_rate) end) as hook_band,
  marketing_hq.benchmark_band('hold_rate',
    case when c.cijfers_vastgezet then c.hold_rate else coalesce(r.hold_rate, c.hold_rate) end) as hold_band,
  marketing_hq.benchmark_band('ctr',
    case when c.cijfers_vastgezet then c.ctr else coalesce(r.ctr, c.ctr) end)                   as ctr_band,
  marketing_hq.benchmark_band('cvr',
    case when c.cijfers_vastgezet then c.cvr else coalesce(r.cvr, c.cvr) end)                   as cvr_band,

  case
    when c.breakeven_roas is null then null
    when (case when c.cijfers_vastgezet then c.roas else coalesce(r.roas, c.roas) end) is null
      or (case when c.cijfers_vastgezet then c.roas else coalesce(r.roas, c.roas) end) = 0 then null
    else (case when c.cijfers_vastgezet then c.roas else coalesce(r.roas, c.roas) end) >= c.breakeven_roas
  end                                                 as boven_breakeven,

  -- Vanaf hier nieuw in 0038.
  c.cijfers_vastgezet,
  c.cijfers_vastgezet_op,
  tm.full_name                                        as cijfers_vastgezet_naam,
  -- Wat de meting zei toen een mens hem overschreef. Zonder dit is niet te zien
  -- hoe groot de afwijking is, en dan is 'vastgezet' een vrijbrief in plaats
  -- van een correctie die iemand kan nakijken.
  r.roas                                              as gemeten_roas
from public.creatives c
left join marketing_hq.creative_results r on r.creative_id = c.id
left join public.team_members tm on tm.id = c.cijfers_vastgezet_door;

comment on view marketing_hq.creative_kaart is
  'Een rij in de test tracker. Bewust zonder image_b64: dat is 52 kB per rij.';

create or replace view public.hq_creative_kaart
with (security_invoker = true) as
select * from marketing_hq.creative_kaart;

grant select on public.hq_creative_kaart to authenticated;

-- ── 2. doet de sync het nog ─────────────────────────────────────────────────

create or replace view marketing_hq.meta_sync_status as
with laatste_meting as (
  select max(captured_at) as op, count(*) as rijen from marketing_hq.meta_insights_daily
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
  end                                                 as toestand
from laatste_meting m
cross join pogingen p
left join laatste_klacht k on true;

comment on view marketing_hq.meta_sync_status is
  'Doet de Meta-koppeling het nog. Een lege tracker die "geen cijfers" zegt in plaats van "de sync ligt eruit", laat een storing dagen doorlopen.';

create or replace view public.hq_meta_sync_status
with (security_invoker = true) as
select * from marketing_hq.meta_sync_status;

grant select on public.hq_meta_sync_status to authenticated;
