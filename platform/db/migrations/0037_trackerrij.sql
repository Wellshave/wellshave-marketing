-- ═══════════════════════════════════════════════════════════════════════════
-- 0037 — De trackerrij compleet, met het oordeel erin
--
-- Beslisvraag:
--
--     "Wat moet er met deze advertentie gebeuren?"
--
-- creative_kaart uit 0011 had de helft van de Test Tracker: wel roas en ctr,
-- geen budget, geen conversies, geen break-even, geen kanaal of doelgroep, en
-- niet waar de rij vandaan komt. Voor een lijstje was dat genoeg, voor de
-- tracker niet — je kunt niet zien of een advertentie boven zijn break-even
-- zat als break-even er niet in staat.
--
-- ── Het oordeel hoort hier en niet in de browser ────────────────────────────
--
--   De vier bandkolommen (hook_band, hold_band, ctr_band, cvr_band) rekenen
--   0,34 om naar 'goed' met de grenzen uit 0036. Dat had ook in JavaScript
--   gekund, en dan had het scherm zijn eigen kopie van die grenzen gehad.
--   Twee plekken die moeten weten wanneer 0,30 begint is één plek te veel: de
--   dag dat iemand de banden herijkt op nieuwe accountdata verandert de
--   database wel en het scherm niet, en dan kleurt de tracker maanden een
--   oordeel dat nergens meer op slaat.
--
--   Dezelfde reden waarom `boven_breakeven` hier staat en niet daar. Het is
--   één vergelijking, maar het is wel de vergelijking waar een stopbesluit op
--   rust, en die hoort bij de cijfers te staan.
--
-- ── Wat er bewust níét in zit ───────────────────────────────────────────────
--
--   Geen samengesteld eindoordeel, geen "deze moet je stoppen". De banden
--   zeggen wat de cijfers doen; wat dat betekent hangt af van hoe lang hij
--   draait, hoeveel er is uitgegeven en wat het doel was. 0008 heeft daar
--   `beoordeelbaar` voor en die zit er al in. Een kolom die 'stoppen' zegt
--   terwijl er drie dagen data onder ligt, wordt gevolgd en niet gecontroleerd.
--
-- De kolomvolgorde vooraan blijft ongemoeid, om dezelfde reden als in 0034:
-- alles wat nu `select *` doet rekent erop.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view marketing_hq.creative_kaart as
select
  c.id, c.brand, c.werkstuk_id,
  c.ad_name, c.product, c.persona, c.angle_type, c.format, c.media_type,
  c.hook_short, c.awareness_level, c.marketing_angle, c.creative_concept,
  c.status, c.score, c.next_step, c.date_live, c.notes,

  c.has_image,
  (c.image_b64 is not null)                           as beeld_beschikbaar,
  c.creatives_link,

  coalesce(r.roas,      c.roas)                       as roas,
  coalesce(r.ctr,       c.ctr)                        as ctr,
  coalesce(r.cpm,       c.cpm)                        as cpm,
  coalesce(r.cpc,       c.cpc)                        as cpc,
  coalesce(r.cpa,       c.cpa)                        as cpa,
  coalesce(r.aov,       c.aov)                        as aov,
  coalesce(r.cvr,       c.cvr)                        as cvr,
  coalesce(r.hook_rate, c.hook_rate)                  as hook_rate,
  coalesce(r.hold_rate, c.hold_rate)                  as hold_rate,
  coalesce(r.impressions, c.impressions)              as impressions,
  r.spend,
  r.purchases,
  r.dagen_live,
  r.meetdagen,
  r.beoordeelbaar,
  case
    when r.creative_id is not null then 'meta'
    when c.roas is not null or c.ctr is not null then 'handmatig'
    else 'geen'
  end                                                 as cijfers_bron,

  c.created_at, c.updated_at,

  -- Vanaf hier nieuw in 0037.
  c.desires,
  c.channel,
  c.audience,
  c.budget,
  coalesce(r.purchases, c.conversions)                as conversions,
  c.breakeven_roas,
  c.target_roas,
  c.hypothesis,
  c.test_variable,
  c.bron_bestand,
  c.bron_status,
  c.bron_rij,

  marketing_hq.benchmark_band('hook_rate', coalesce(r.hook_rate, c.hook_rate)) as hook_band,
  marketing_hq.benchmark_band('hold_rate', coalesce(r.hold_rate, c.hold_rate)) as hold_band,
  marketing_hq.benchmark_band('ctr',       coalesce(r.ctr,       c.ctr))       as ctr_band,
  marketing_hq.benchmark_band('cvr',       coalesce(r.cvr,       c.cvr))       as cvr_band,

  -- Null zolang een van de twee ontbreekt, en null bij een ROAS van nul: die
  -- nul is in deze data meestal een leeg vakje dat als getal is opgeslagen, en
  -- 'onder break-even' antwoorden op een niet-meting is een oordeel verzinnen.
  case
    when c.breakeven_roas is null then null
    when coalesce(r.roas, c.roas) is null or coalesce(r.roas, c.roas) = 0 then null
    else coalesce(r.roas, c.roas) >= c.breakeven_roas
  end                                                 as boven_breakeven
from public.creatives c
left join marketing_hq.creative_results r on r.creative_id = c.id;

comment on view marketing_hq.creative_kaart is
  'Een rij in de test tracker. Bewust zonder image_b64: dat is 52 kB per rij.';

-- De publieke view heeft de sterretjes bij zijn aanmaak uitgeschreven, dus
-- zonder deze regel ziet het scherm de nieuwe kolommen niet.
create or replace view public.hq_creative_kaart
with (security_invoker = true) as
select * from marketing_hq.creative_kaart;

grant select on public.hq_creative_kaart to authenticated;
