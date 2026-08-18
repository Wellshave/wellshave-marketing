-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 — Bolt
--
-- Station ④ van de estafette, en het enige station waar de keten vandaag
-- fysiek stukloopt. Drie werkstukken liggen erop, alle drie 77 uur stil, alle
-- drie wachtend op een mens. `meta_publications` staat op nul: negen creatives
-- gemaakt, nul ooit via het systeem live gezet.
--
-- Bolt heeft twee taken, en de tweede is nieuw sinds het dagbesluit bestaat:
--
--   publiceren        een creative uit de console wordt een advertentie bij
--                     Meta. Het gereedschap bestaat al (`meta_prepare_ad`,
--                     0007) en is nog nooit gebruikt.
--
--   opvolgen          uitvoeren wat het dagbesluit zegt: uitzetten en budget
--                     ophogen. Op het trackerscherm staat nu nog "uitvoeren
--                     doe je in Meta". Dat is een tijdelijke tekst; dit is de
--                     agent die hem overneemt.
--
-- ── Waarom Bolts guardrails zwaarder wegen dan die van Atlas ────────────────
--
-- Atlas kan hooguit iets verkeerds opschrijven. Bolt kan geld uitgeven. Dat
-- verschil hoort niet in een promptregel te staan, want een prompt is een
-- verzoek. Wat hieronder staat zijn constraints: ze gelden ook als het
-- taalmodel iets anders besluit, als iemand de prompt herschrijft, en als een
-- toekomstige agent dezelfde tabel gebruikt.
--
-- Wat NIET in deze migratie zit: enige mogelijkheid voor Bolt om zelf iets bij
-- Meta te veranderen. Elk pad naar buiten loopt via `approvals` en een mens.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. De afspraak ─────────────────────────────────────────────────────────
-- Zonder een getal bij `max_stilte_uren` is "Bolt draait dagelijks" een
-- voornemen. Bij Bolt staat dat getal lager dan bij Atlas: een advertentie die
-- een dag te laat live gaat is een dag verloren testtijd, en een verlieslatende
-- ad die een dag langer doorloopt kost echt geld.
insert into marketing_hq.agent_afspraken
  (agent_id, kind, soort, cadans, levert, doel_tabel, lat, max_stilte_uren)
values
  ('bolt', 'publish_queue', 'model',
   'elke dag 06:30 UTC',
   'Hooguit drie creatives per keer klaargezet als advertentie, elk met een hypothese en een goedkeuring ernaast.',
   'meta_publications',
   'Een rij in meta_publications met status=klaargezet en een bijbehorende approval — nooit iets dat al draait.',
   30),
  ('bolt', 'dagbesluit_opvolgen', 'model',
   'elke dag 06:45 UTC',
   'Per regel uit het dagbesluit één goedkeuringsverzoek: welke advertentie uit, welke meer budget, met het bedrag erbij.',
   'approvals',
   'Een rij in approvals per handeling uit het dagbesluit die er nog geen heeft, met account en advertentie bij naam en id.',
   30)
on conflict (agent_id, kind) do nothing;

-- 06:45 is bewust ná Atlas. Het dagbesluit rust op de cijfers die Atlas om
-- 05:00 ophaalt; draait Bolt ervoor, dan handelt hij op de stand van gisteren.
-- `schedules.id` is een leesbare tekstsleutel en geen oplopend nummer, net als
-- bij 'atlas_audit' in 0015. Dat is prettig bij het lezen van de planning en
-- het maakt `on conflict (id) do nothing` betekenisvol.
insert into marketing_hq.schedules (id, agent_id, kind, cron, payload, enabled)
values
  ('bolt_publiceren', 'bolt', 'publish_queue',       '30 6 * * *', '{}'::jsonb, true),
  ('bolt_opvolgen',   'bolt', 'dagbesluit_opvolgen', '45 6 * * *', '{}'::jsonb, true)
on conflict (id) do nothing;

-- ── 1b. De planning die geen afspraak had ──────────────────────────────────
-- `bolt_scorecard` stond al ingepland (elke dag 05:20) zonder bijbehorende
-- afspraak: het spiegelbeeld van de fout die 0015 herstelde. Daar draaide een
-- afspraak zonder planning, hier een planning zonder afspraak — en dus zonder
-- iets dat controleert of hij levert.
--
-- Hij wordt niet van een afspraak voorzien maar uitgezet, want zijn werk
-- bestaat al twee keer. `advertentie_scorekaart` (0013) beoordeelt elke
-- advertentie op twee signalen tegen de accountmediaan, in SQL, met dezelfde
-- uitkomst bij dezelfde cijfers. Datzelfde oordeel nog eens door een taalmodel
-- laten vellen levert een tweede mening op die van de eerste kan afwijken, en
-- dan is er geen oordeel meer maar een discussie.
update marketing_hq.schedules
   set enabled = false,
       payload = payload || jsonb_build_object(
         'uit_reden', 'vervangen door advertentie_scorekaart (0013) en dagbesluit (0018)')
 where id = 'bolt_scorecard';

-- ── 2. Een goedkeuring die je niet kunt uitvoeren, is geen goedkeuring ──────
-- De tool belooft aan de agent: "de concrete parameters, zodat een mens het
-- kan uitvoeren zonder terug te zoeken". Dat was een belofte in een tekst.
-- Hier wordt het een eis.
--
-- Regel 0.3 van het ontwerpcontract zegt hetzelfde: een aanbeveling noemt de
-- eerstvolgende handeling met naam en id. "Pauzeer de onderpresteerders" is
-- geen aanbeveling.
-- Eén constraint, geen twee. Er stond hier eerst ook een aparte controle op
-- "payload niet leeg", tot de testlus liet zien dat die nooit als eerste vuurt:
-- een lege payload noemt per definitie geen id, dus de regel hieronder weigert
-- hem al. Twee constraints die elkaar overlappen geven twee namen voor dezelfde
-- fout, en dan leest de agent de verkeerde.
--
-- Minstens één identificatie. Zonder id weet een mens wel wát er moet gebeuren
-- maar niet waarmee, en dan begint het zoekwerk dat deze rij moest voorkomen.
--
-- Als functie en niet als subquery: een CHECK mag geen subquery bevatten, en
-- `exists (select ... from jsonb_object_keys(...))` wordt geweigerd. De functie
-- is IMMUTABLE omdat hij alleen naar zijn eigen argument kijkt; dat is de
-- voorwaarde om hem in een constraint te mogen gebruiken.
create or replace function marketing_hq.jsonb_noemt_een_id(p jsonb)
returns boolean language sql immutable as $$
  select coalesce(bool_or(k like '%\_id' escape '\'), false)
  from jsonb_object_keys(coalesce(p, '{}'::jsonb)) k
$$;

alter table marketing_hq.approvals
  add constraint approvals_noemt_een_id
  check (marketing_hq.jsonb_noemt_een_id(payload));

-- Kost het geld, dan hoort het bedrag erbij. Hoeveel is de eerste vraag die een
-- mens stelt, en een verzoek dat die vraag niet beantwoordt wordt niet
-- goedgekeurd maar uitgesteld.
--
-- NOT VALID, en dat is een bewuste keuze. De drie openstaande verzoeken komen
-- uit de claude.ai-periode en dragen hun bedrag in de beschrijving in plaats
-- van in de payload. Ze terugwerkend afkeuren zou betekenen dat ze uit de lijst
-- verdwijnen terwijl ze nog steeds op een besluit wachten — dat is precies het
-- soort stilzwijgende schade waar 0019 over gaat. De regel geldt vanaf nu.
alter table marketing_hq.approvals
  add constraint approvals_geld_noemt_bedrag
  check (
    action_type not in ('budget_change', 'budget_increase', 'budget_decrease')
    or (payload ? 'bedrag_eur' and jsonb_typeof(payload->'bedrag_eur') = 'number')
  ) not valid;

comment on constraint approvals_geld_noemt_bedrag on marketing_hq.approvals is
  'NOT VALID: geldt voor nieuwe rijen. De drie verzoeken uit juli dragen hun bedrag in de tekst.';

-- ── 3. Niet twee keer hetzelfde vragen ─────────────────────────────────────
-- Bolt draait elke ochtend. Zonder deze index vraagt hij morgen opnieuw om
-- dezelfde advertentie uit te zetten, en overmorgen weer. Na een week staan er
-- zeven identieke verzoeken en kijkt niemand de lijst nog na — wat hetzelfde
-- effect heeft als geen lijst hebben.
create unique index if not exists approvals_geen_dubbel_open
  on marketing_hq.approvals (
    requested_by,
    action_type,
    coalesce(payload->>'ad_id', payload->>'entity_id', payload->>'adset_id',
             payload->>'campaign_id', payload->>'klaviyo_campaign_id', '')
  )
  where status = 'pending';

-- ── 4. Een lijst die je nog kunt overzien ──────────────────────────────────
-- Vijf. Niet omdat vijf een mooi getal is, maar omdat een goedkeuringslijst
-- iets is wat je 's ochtends in één zitting afhandelt. Bij tien scroll je, bij
-- twintig sla je hem over, en een overgeslagen lijst is een systeem dat stil
-- staat terwijl het lijkt te werken.
--
-- De agent krijgt een foutmelding die zegt wat hij moet doen, niet alleen dat
-- het niet mag. Hij hoort het te melden en te stoppen, niet opnieuw te proberen.
create or replace function marketing_hq.approvals_stapel_bewaken()
returns trigger language plpgsql as $$
declare open_nu integer;
begin
  select count(*) into open_nu
  from marketing_hq.approvals
  where requested_by = new.requested_by and status = 'pending';

  if open_nu >= 5 then
    raise exception
      'Er staan al % verzoeken van % op een besluit te wachten. Handel die eerst af; meld dit en stop.',
      open_nu, new.requested_by
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists approvals_stapel on marketing_hq.approvals;
create trigger approvals_stapel
  before insert on marketing_hq.approvals
  for each row execute function marketing_hq.approvals_stapel_bewaken();

-- ── 5. Nakoming werkt nu ook voor wie geen rapporten schrijft ──────────────
-- `agent_nakoming` uit 0012 keek alleen naar `reports`. Atlas levert rapporten,
-- dus daar viel het niet op. Bolt levert publicaties en goedkeuringen: zijn
-- oordeel zou permanent op 'gedraaid, niets geleverd' staan, en een controle
-- die altijd hetzelfde zegt is geen controle.
create or replace view marketing_hq.agent_nakoming as
select
  a.agent_id,
  ag.name                                             as agent,
  a.kind, a.soort, a.cadans, a.levert, a.lat,
  a.max_stilte_uren, a.actief,
  lr.started_at                                       as laatste_run,
  lr.status                                           as laatste_status,
  ll.moment                                           as laatste_levering,
  case when lr.started_at is not null
       then round(extract(epoch from (now() - lr.started_at)) / 3600.0, 1) end as uren_stil,
  case
    when not a.actief                                        then 'uit'
    when lr.started_at is null                               then 'nog nooit gedraaid'
    when lr.status = 'failed'                                then 'laatste run mislukt'
    when now() - lr.started_at > (a.max_stilte_uren || ' hours')::interval
                                                             then 'te laat'
    when ll.moment is null                                   then 'gedraaid, niets geleverd'
    else 'op tijd'
  end                                                 as oordeel
from marketing_hq.agent_afspraken a
join marketing_hq.agents ag on ag.id = a.agent_id
left join lateral (
  select r.started_at, r.status
  from marketing_hq.agent_runs r
  join marketing_hq.agent_jobs j on j.id = r.job_id
  where r.agent_id = a.agent_id and j.kind = a.kind
  order by r.started_at desc
  limit 1
) lr on true
left join lateral (
  -- Eén venster, vier doeltabellen. Elke tak kijkt naar wat die agent volgens
  -- zijn eigen afspraak hoort achter te laten — niet naar "is er iets
  -- gebeurd", want dan zou het werk van een ander meetellen.
  select max(moment) as moment from (
    select rep.created_at as moment
      from marketing_hq.reports rep
     where a.doel_tabel = 'reports'
       and rep.author_agent = a.agent_id
       and rep.created_at > now() - (a.max_stilte_uren || ' hours')::interval
    union all
    select ap.created_at
      from marketing_hq.approvals ap
     where a.doel_tabel = 'approvals'
       and ap.requested_by = a.agent_id
       and ap.created_at > now() - (a.max_stilte_uren || ' hours')::interval
    union all
    select pub.created_at
      from marketing_hq.meta_publications pub
     where a.doel_tabel = 'meta_publications'
       and pub.prepared_by = a.agent_id
       and pub.created_at > now() - (a.max_stilte_uren || ' hours')::interval
    union all
    -- De systeemtaak van Atlas schrijft de gemeten cijfers terug op de
    -- creatives zelf. `creative_results` is een view en draagt geen tijdstempel;
    -- de tabel eronder wel.
    select c.updated_at
      from public.creatives c
     where a.doel_tabel = 'creatives'
       and c.updated_at > now() - (a.max_stilte_uren || ' hours')::interval
  ) alles
) ll on true;

comment on view marketing_hq.agent_nakoming is
  'Houdt elke agent aan zijn eigen afspraak: gedraaid is niet hetzelfde als geleverd, en geleverd betekent per agent iets anders.';

-- Expliciet, en niet in de hoop dat `create or replace view` de optie behoudt.
-- Deze view bestond al sinds 0012 en kreeg zijn security_invoker pas in 0017;
-- hem hier vervangen zonder dit zou dat werk in stilte ongedaan kunnen maken.
-- De vangnetcontrole onderaan ving dit tijdens het bouwen, en dat is precies
-- waarvoor hij er staat.
alter view marketing_hq.agent_nakoming set (security_invoker = true);

-- ── 6. Wat Bolt heeft klaargezet ───────────────────────────────────────────
-- De uitvoerkant van het dagbesluit: wat wacht er op een besluit, hoeveel geld
-- hangt eraan, en hoe lang staat het er al.
create or replace view marketing_hq.bolt_voorstellen as
select
  a.id, a.requested_by, a.action_type, a.description, a.status,
  a.payload->>'account_id'                                  as account_id,
  coalesce(a.payload->>'ad_id', a.payload->>'entity_id',
           a.payload->>'adset_id', a.payload->>'campaign_id')  as doel_id,
  a.payload->>'naam'                                        as doel_naam,
  case when jsonb_typeof(a.payload->'bedrag_eur') = 'number'
       then (a.payload->>'bedrag_eur')::numeric end         as bedrag_eur,
  a.werkstuk_id,
  a.created_at,
  round(extract(epoch from (now() - a.created_at)) / 3600)::int as uren_open,
  a.decided_by, a.decided_at,
  -- Waarom dit er nog staat, of waarom niet meer. Er staat er altijd één.
  case a.status
    when 'pending'  then 'wacht op een besluit van jou'
    when 'approved' then 'goedgekeurd door ' || coalesce(a.decided_by, 'onbekend') || ', nog niet uitgevoerd'
    when 'executed' then 'uitgevoerd'
    when 'rejected' then 'afgewezen door ' || coalesce(a.decided_by, 'onbekend')
    else 'onbekende status: ' || coalesce(a.status, 'leeg')
  end                                                       as stand
from marketing_hq.approvals a;

comment on view marketing_hq.bolt_voorstellen is
  'Wat er op een besluit wacht, met het bedrag en het doel erbij. Uitvoeren gebeurt in Meta, niet hier.';

-- ── Toegang ────────────────────────────────────────────────────────────────
alter view marketing_hq.bolt_voorstellen set (security_invoker = true);
grant select on marketing_hq.bolt_voorstellen to authenticated;

create or replace view public.hq_bolt_voorstellen with (security_invoker = true)
  as select * from marketing_hq.bolt_voorstellen;
revoke all on public.hq_bolt_voorstellen from anon, public;
grant select on public.hq_bolt_voorstellen to authenticated;

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
-- Terugdraaien
--
--   drop view if exists public.hq_bolt_voorstellen;
--   drop view if exists marketing_hq.bolt_voorstellen;
--   drop trigger if exists approvals_stapel on marketing_hq.approvals;
--   drop function if exists marketing_hq.approvals_stapel_bewaken();
--   drop index if exists marketing_hq.approvals_geen_dubbel_open;
--   drop function if exists marketing_hq.jsonb_noemt_een_id(jsonb);
--   alter table marketing_hq.approvals
--     drop constraint if exists approvals_geld_noemt_bedrag,
--     drop constraint if exists approvals_noemt_een_id;
--   delete from marketing_hq.schedules where agent_id='bolt';
--   delete from marketing_hq.agent_afspraken where agent_id='bolt';
--   -- agent_nakoming terug naar de versie in 0012_atlas.sql
-- ═══════════════════════════════════════════════════════════════════════════
