-- ═══════════════════════════════════════════════════════════════════════════
-- 0051 — Het schema zonder AI-agents
--
-- Beslisvraag:
--
--     "Wat blijft er over als er 's nachts geen model meer iets besluit?"
--
-- Deze migratie hoort bij worker v16. Ze kunnen niet los: v16 schrijft naar
-- `taken`, `taak_runs` en `systeem_events` en die bestaan hiervóór niet, en
-- de agenttabellen kunnen niet weg zolang v14 draait want die bevraagt
-- `agents` bij elke job. Toepassen en deployen horen in hetzelfde venster, in
-- die volgorde. Tussendoor faalt de cron een paar minuten; dat is acceptabel,
-- de systeemtaken zijn niet tijdkritisch en de wachtrij pikt het op.
--
-- Wat hier weggaat, en waarom
--
--   Er stonden negen agents in de database. Vijf hadden een instructie in de
--   worker (atlas, bolt, echo, radar, nova); vier (pixel, quill, sage, vector)
--   stonden er wel maar hebben nooit gedraaid. Ze gaan alle negen weg.
--
--   Het risico van zo'n opruiming is dat er méér meegaat dan de bedoeling is,
--   want "agent" zat in dit schema op drie verschillende manieren:
--
--     1. Dingen die alleen bestaan omdat er een model draaide.
--        agents, agent_messages, agent_afspraken, agent_stations, reports,
--        pipeline_items, pipeline_events, email_drafts. Die gaan weg.
--
--     2. Dingen die "agent" heten maar geen model aanraken.
--        agent_jobs is een takenwachtrij. agent_runs is de uitvoerlog.
--        agent_events is het systeemlogboek — daar schrijft feedback_sync in,
--        en meta_sync_status op de trackerpagina leest eruit. Die blijven, en
--        krijgen een naam die klopt: taken, taak_runs, systeem_events.
--
--     3. Kolommen die vastlegden wíé een stap deed, met een agent- én een
--        menskant naast elkaar (door_agent / door_mens). Daar valt alleen de
--        agentkant af. De werkbank blijft heel; hij wordt een werkbank voor
--        mensen.
--
--   Het onderscheid tussen 1 en 2 is de hele migratie. Wie "alles met agent in
--   de naam" had gedropt, had de wachtrij meegenomen — en daarmee
--   feedback_sync en meta_inhaalslag, de twee taken die de meting kloppend
--   houden. Die draaien juist zónder model.
--
-- Wat expliciet BLIJFT, tegen de eerste ingeving in
--
--   `approvals`. Dat leest als agentmachinerie omdat er `request_approval` in
--   de tools zat, maar het is de menselijke poort vóór publiceren. Sinds v16
--   maakt het klaarzet-endpoint de goedkeuring aan met een mens als aanvrager.
--   Weghalen zou de enige rem op geld uitgeven weghalen.
--
--   `criticus_oordelen` en `learnings`. Allebei hadden ze een door_agent naast
--   een door_mens. De Criticus was altijd al een mens; een learning is pas
--   vastgesteld als iemand tekent. Alleen de agentkant vervalt.
--
--   `meta_recommendations`. De rijen die er staan blijven leesbaar op de
--   strategiepagina. Er komt alleen niets meer bij.
--
-- Wat NIET terugkomt
--
--   `brein`, `brein_dag` en `werkbank`. Die voedden twee schermen die met de
--   agents zijn verdwenen. Er is bewust geen vervangende view: een view zonder
--   scherm is een tabel die niemand opent, en de systeemlog is al zichtbaar
--   via /systeem/status.
--
-- Geprobeerd voordat hij hier stond
--
--   Deze migratie is twee keer in een transactie tegen productie gedraaid en
--   allebei de keren teruggedraaid: eerst de sloop, daarna de opbouw. Dat was
--   nodig omdat de testlus in db/test/ de vroege schema's nastubt en pas
--   migraties vanaf 0035 draait -- alles wat hier uit 0009 t/m 0033 gesloopt
--   wordt, dekt geen enkele test.
--
--   Die proef vond drie fouten die anders op productie waren gebeurd:
--
--     1. public.hq_werkstukken leest uit werkstuk_estafette en stond niet in
--        de sloopllijst.
--     2. De sloopvolgorde klopte niet: `brein` leest uit `overdrachten`, dus
--        `overdrachten` kon er niet als eerste uit.
--     3. public.hq_team leest agent_runs.agent_id en moest dus vóór de
--        kolomdrops weg -- en kan niet met `create or replace` terugkomen,
--        want zijn kolomlijst gaat van twaalf naar zes.
--
--   Wat de proef daarna bevestigde: 0 agentkolommen over, 66 taken bewaard,
--   884 systeemevents bewaard, 10 approvals bewaard, en na de opbouw 637 rijen
--   in testkaart en creative_dossier, 3 deelnemers, meta_sync_status op
--   'werkt'.
--
-- Terugdraaien
--
--   Kan niet met een migratie. De rijen in agents (10), agent_messages (94),
--   reports (49), pipeline_items (12) en pipeline_events (18) zijn hierna weg.
--   De code staat in git; de inhoud niet. Dat is bewust: een half weggehaalde
--   agentlaag is erger dan geen, want dan staat er een schakelaar die aan
--   niets vastzit.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. De publieke spiegels ────────────────────────────────────────────────
-- Eerst, want ze hangen aan alles eronder.

drop view if exists public.hq_agent_bezetting;
drop view if exists public.hq_agent_nakoming;
drop view if exists public.hq_agents;
drop view if exists public.hq_agent_messages;
drop view if exists public.hq_agent_events;
drop view if exists public.hq_agent_jobs;
drop view if exists public.hq_agent_runs;
drop view if exists public.hq_atlas_dagrapport;
drop view if exists public.hq_bolt_voorstellen;
drop view if exists public.hq_brein;
drop view if exists public.hq_brein_dag;
drop view if exists public.hq_deelnemers;
drop view if exists public.hq_reports;
drop view if exists public.hq_pipeline_items;
drop view if exists public.hq_pipeline_events;
drop view if exists public.hq_email_drafts;
drop view if exists public.hq_werkbank;
drop view if exists public.hq_schedules;
drop view if exists public.hq_creative_dossier;
drop view if exists public.hq_testkaart;
drop view if exists public.hq_meta_sync_status;
drop view if exists public.hq_meta_recommendations;
drop view if exists public.hq_criticus_werkvoorraad;
drop view if exists public.hq_overdrachten;
drop view if exists public.hq_terugzendingen;
drop view if exists public.hq_denkstuk_regels;
drop view if exists public.hq_werkstuk_estafette;
-- hq_werkstukken leest uit werkstuk_estafette en stond niet in de eerste versie
-- van deze lijst. De proefdraai vond hem: "cannot drop view
-- marketing_hq.werkstuk_estafette because other objects depend on it". Precies
-- waarvoor die proef bedoeld was -- geen enkele test in de repo dekt de views
-- van vóór 0035.
drop view if exists public.hq_werkstukken;
-- hq_team telde per agent hoe vaak hij gedraaid had en hoeveel vaste momenten
-- hij had; hij leest dus agent_runs.agent_id en schedules.agent_id. Daarom moet
-- hij hier weg en niet verderop met `create or replace`: die kan de kolomlijst
-- niet veranderen, en de nieuwe versie heeft er zes in plaats van twaalf.
drop view if exists public.hq_team;

-- ── 2. De views in marketing_hq ────────────────────────────────────────────
-- In afhankelijkheidsvolgorde: wie leest gaat vóór wie gelezen wordt.

-- De volgorde is niet willekeurig en niet te raden. `werkbank` leest uit
-- `brein` én uit `werkstuk_estafette`; `brein` leest op zijn beurt uit
-- `overdrachten`. Wie van boven naar beneden sloopt loopt vast op
-- "cannot drop view ... because other objects depend on it". Dat is hier twee
-- keer gebeurd tijdens de proefdraai; deze volgorde is de uitkomst daarvan.
drop view if exists marketing_hq.werkbank;
drop view if exists marketing_hq.brein_dag;
drop view if exists marketing_hq.brein;
drop view if exists marketing_hq.werkstuk_estafette;
drop view if exists marketing_hq.overdrachten;
drop view if exists marketing_hq.terugzendingen;
drop view if exists marketing_hq.denkstuk_regels;
drop view if exists marketing_hq.criticus_werkvoorraad;
drop view if exists marketing_hq.criticus_staat;
drop view if exists marketing_hq.deelnemers;
drop view if exists marketing_hq.creative_dossier;
drop view if exists marketing_hq.testkaart;
drop view if exists marketing_hq.meta_sync_status;
drop view if exists marketing_hq.agent_bezetting;
drop view if exists marketing_hq.agent_nakoming;
drop view if exists marketing_hq.atlas_dagrapport;
drop view if exists marketing_hq.bolt_voorstellen;

-- ── 3. De functies die een agent in hun handtekening of body hadden ────────

-- werkstuk_stap: p_agent vervalt. Het retourtype verwijst naar de tabel en de
-- handtekening verandert, dus droppen en opnieuw schrijven.
drop function if exists marketing_hq.werkstuk_stap(bigint, smallint, text, text, text, text, bigint, bigint);

-- ── 4. De agentkant uit de tabellen die blijven ────────────────────────────
-- Elk van deze legde vast wie iets deed, met een agent- en een menskant. De
-- check "precies één van de twee" wordt daarmee "de menskant".

alter table marketing_hq.learnings              drop constraint if exists learnings_check;
alter table marketing_hq.learnings              drop column if exists door_agent;
alter table marketing_hq.learnings              alter column door_mens set not null;

alter table marketing_hq.criticus_oordelen      drop constraint if exists criticus_oordelen_check;
alter table marketing_hq.criticus_oordelen      drop column if exists door_agent;
alter table marketing_hq.criticus_oordelen      alter column door_mens set not null;

alter table marketing_hq.denkstuk_antwoorden    drop constraint if exists denkstuk_antwoorden_check;
alter table marketing_hq.denkstuk_antwoorden    drop column if exists door_agent;

alter table marketing_hq.werkstuk_terugzendingen drop constraint if exists werkstuk_terugzendingen_check;
alter table marketing_hq.werkstuk_terugzendingen drop column if exists door_agent;

alter table marketing_hq.werkstuk_overdrachten  drop constraint if exists werkstuk_overdrachten_check;
alter table marketing_hq.werkstuk_overdrachten  drop column if exists door_agent;
alter table marketing_hq.werkstuk_overdrachten  drop column if exists van_agent;

alter table marketing_hq.werkstuk_stappen       drop column if exists agent_id;

alter table marketing_hq.werkstukken            drop column if exists sophistication_door_agent;

alter table marketing_hq.meta_recommendations   drop column if exists agent_id;

alter table public.creatives                    drop column if exists learning_door_agent;

-- ── 5. De tabellen die alleen bestonden omdat er een model draaide ─────────

drop table if exists marketing_hq.agent_messages   cascade;
drop table if exists marketing_hq.agent_afspraken  cascade;
drop table if exists marketing_hq.agent_stations   cascade;
drop table if exists marketing_hq.reports          cascade;
drop table if exists marketing_hq.pipeline_events  cascade;
drop table if exists marketing_hq.pipeline_items   cascade;
drop table if exists marketing_hq.email_drafts     cascade;

-- ── 6. De wachtrij: dezelfde machine, een eerlijke naam ────────────────────
-- De agent_id-kolom vervalt: wat een taak ís staat in `kind`, en dat is sinds
-- de systeemtaken ook het enige wat de worker nog opzoekt.

alter table marketing_hq.agent_events drop constraint if exists agent_events_agent_id_fkey;
alter table marketing_hq.agent_jobs   drop constraint if exists agent_jobs_agent_id_fkey;
alter table marketing_hq.agent_runs   drop constraint if exists agent_runs_agent_id_fkey;
alter table marketing_hq.schedules    drop constraint if exists schedules_agent_id_fkey;

drop index if exists marketing_hq.agent_jobs_agent_created_idx;

alter table marketing_hq.agent_events drop column if exists agent_id;
alter table marketing_hq.agent_jobs   drop column if exists agent_id;
alter table marketing_hq.agent_runs   drop column if exists agent_id;
alter table marketing_hq.schedules    drop column if exists agent_id;

alter table marketing_hq.agent_jobs   rename to taken;
alter table marketing_hq.agent_runs   rename to taak_runs;
alter table marketing_hq.agent_events rename to systeem_events;

comment on table marketing_hq.taken is
  'De takenwachtrij. Elke rij is één stuk deterministisch werk, herkend aan `kind`. Hier komt geen model aan te pas.';
comment on table marketing_hq.taak_runs is
  'Eén rij per uitvoering van een taak: begin, eind, uitkomst.';
comment on table marketing_hq.systeem_events is
  'Het systeemlogboek. Append-only, en de bron van de live-feed in de console.';

-- Nu pas de agenttabel zelf: alles wat ernaar wees is hierboven losgekoppeld.
drop table if exists marketing_hq.agents cascade;

-- ── 7. De twee functies die de wachtrij bedienen ───────────────────────────
-- Zelfde logica als 0004, op de nieuwe naam. Opnieuw geschreven en niet
-- hernoemd, want het retourtype verwijst naar de tabel en dat volgt een
-- rename niet.

drop function if exists marketing_hq.claim_job(text);
create function marketing_hq.claim_taak(p_worker text)
returns marketing_hq.taken
language plpgsql
security definer
set search_path = ''
as $$
declare
  t marketing_hq.taken;
begin
  select * into t
  from marketing_hq.taken
  where status = 'queued'
    and scheduled_for <= now()
  order by priority, scheduled_for
  limit 1
  for update skip locked;

  if not found then
    return null;
  end if;

  update marketing_hq.taken
     set status = 'running',
         attempts = attempts + 1,
         locked_at = now(),
         locked_by = p_worker,
         started_at = coalesce(started_at, now())
   where id = t.id
  returning * into t;

  return t;
end;
$$;

drop function if exists marketing_hq.reap_stuck_jobs(interval);
create function marketing_hq.maak_vastgelopen_taken_vrij(p_timeout interval default '15 minutes')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  with vrijgegeven as (
    update marketing_hq.taken
       set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
           error = case when attempts >= max_attempts
                        then 'vastgelopen: geen afronding binnen ' || p_timeout::text
                        else error end,
           locked_at = null,
           locked_by = null,
           finished_at = case when attempts >= max_attempts then now() else null end
     where status = 'running'
       and locked_at < now() - p_timeout
    returning 1
  )
  select count(*) into n from vrijgegeven;
  return n;
end;
$$;

-- ── 8. De triggerfuncties die door de agentkolommen lazen ──────────────────

-- De stations van een nieuw werkstuk. Er wordt geen uitvoerder meer
-- voorgevuld: agent_stations bepaalde welke agent standaard op welk station
-- stond, en die tabel is weg. Een station zonder stap wacht op een mens, en
-- dat invullen met een gokje zou zeggen dat er iemand mee bezig is.
create or replace function marketing_hq.werkstuk_stations_aanmaken()
returns trigger
language plpgsql
security definer
set search_path to 'marketing_hq', 'public'
as $function$
begin
  insert into marketing_hq.werkstuk_stappen
    (werkstuk_id, station, status, overdracht)
  select new.id, st.station, 'open', st.standaard_overdracht
  from marketing_hq.werkstuk_stations st
  on conflict (werkstuk_id, station) do nothing;
  return new;
end $function$;

create function marketing_hq.werkstuk_stap(
  p_werkstuk bigint, p_station smallint, p_status text,
  p_waarom text default null, p_overdracht text default 'vanzelf',
  p_run bigint default null, p_approval bigint default null,
  p_mens uuid default null)
returns marketing_hq.werkstuk_stappen
language plpgsql
security definer
set search_path to 'marketing_hq', 'public'
as $function$
declare
  r marketing_hq.werkstuk_stappen;
begin
  insert into marketing_hq.werkstuk_stappen
    (werkstuk_id, station, mens_id, status, overdracht, waarom, run_id, approval_id,
     begonnen_op, afgerond_op)
  values
    (p_werkstuk, p_station, p_mens, p_status, p_overdracht, p_waarom, p_run, p_approval,
     case when p_status in ('bezig','klaar') then now() end,
     case when p_status = 'klaar'            then now() end)
  on conflict (werkstuk_id, station) do update set
    mens_id     = coalesce(excluded.mens_id,     werkstuk_stappen.mens_id),
    status      = excluded.status,
    overdracht  = excluded.overdracht,
    waarom      = coalesce(excluded.waarom,      werkstuk_stappen.waarom),
    run_id      = coalesce(excluded.run_id,      werkstuk_stappen.run_id),
    approval_id = coalesce(excluded.approval_id, werkstuk_stappen.approval_id),
    begonnen_op = coalesce(werkstuk_stappen.begonnen_op,
                           case when excluded.status in ('bezig','klaar') then now() end),
    afgerond_op = case when excluded.status = 'klaar'
                       then coalesce(werkstuk_stappen.afgerond_op, now()) end
  returning * into r;

  update marketing_hq.werkstukken set updated_at = now() where id = p_werkstuk;
  return r;
end $function$;

-- Het oordeel van de Criticus. Leest niet langer van_agent mee; de regel die
-- telt blijft staan: wie de overdracht schreef, velt er niet het oordeel over.
create or replace function marketing_hq.oordeel_hoort_hier()
returns trigger
language plpgsql
as $function$
declare o record; welk bigint;
begin
  if tg_op = 'DELETE' then welk := old.overdracht_id; else welk := new.overdracht_id; end if;

  select van_station, van_mens, status
    into o
  from marketing_hq.werkstuk_overdrachten
  where id = welk;

  -- Een afgehandelde overdracht ligt vast, en daarmee ook het oordeel erover.
  -- Ook tegen weghalen: een goedkeuring die achteraf verdwijnt laat werk in
  -- productie achter waarvan niemand meer kan zien wie het doorliet.
  if o.status <> 'open' then
    raise exception
      'Deze overdracht is al afgehandeld (%). Stuur het werkstuk terug als het oordeel niet meer klopt.',
      o.status using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if o.van_station <> 3 then
    raise exception
      'De Criticus gaat over de overdracht van ③ creatie naar ④ lancering, niet over die uit station %. Daar controleert de ontvanger zelf.',
      o.van_station using errcode = 'check_violation';
  end if;

  if new.door_mens is not null and new.door_mens = o.van_mens then
    raise exception
      'Wie de overdracht schreef, velt er niet het oordeel over. Laat een ander tekenen.'
      using errcode = 'check_violation';
  end if;

  return new;
end $function$;

-- De rondes blijven geteld, de uitzondering vervalt.
--
-- De regel was: vanaf de derde terugzending moet een mens het doen, want twee
-- agents die elkaar heen en weer sturen laten het werk stilstaan terwijl het
-- lijkt te bewegen. Die voorwaarde keek naar door_agent, en die kolom bestaat
-- niet meer — iedereen is nu een mens, dus de uitzondering kan niet meer
-- vuren. Hem laten staan zou een dode regel zijn die suggereert dat er nog
-- iets bewaakt wordt. Het tellen blijft: `ronde` is wat zichtbaar maakt dat
-- een station voor de derde keer terugkomt.
create or replace function marketing_hq.terugzending_grens()
returns trigger
language plpgsql
as $function$
declare eerder int;
begin
  select count(*) into eerder
  from marketing_hq.werkstuk_terugzendingen t
  where t.werkstuk_id = new.werkstuk_id
    and t.naar_station = new.naar_station;

  new.ronde := eerder + 1;
  return new;
end $function$;

create or replace function marketing_hq.terugzending_opent_keten()
returns trigger
language plpgsql
as $function$
declare wie text;
begin
  select coalesce(d.naam, 'onbekend') into wie
  from marketing_hq.deelnemers d
  where d.id = new.door_mens::text;

  update marketing_hq.werkstuk_stappen s
     set status      = 'open',
         afgerond_op = null,
         waarom      = 'teruggestuurd door ' || coalesce(wie, 'onbekend')
                       || ' (ronde ' || new.ronde || '): ' || new.wat_is_mis
   where s.werkstuk_id = new.werkstuk_id
     and s.station between new.naar_station and new.van_station
     and s.status in ('klaar','bezig','wacht_op_mens','mislukt');

  if new.naar_station <= 2 then
    update marketing_hq.denkstukken
       set status         = 'bezig',
           bevestigd_door = null,
           bevestigd_op   = null,
           updated_at     = now()
     where werkstuk_id = new.werkstuk_id
       and status = 'bevestigd';
  end if;

  return new;
end $function$;

-- De learning: geen agent meer die hem kan voorstellen.
create or replace function marketing_hq.creative_learning_vastleggen(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'marketing_hq'
as $function$
declare
  v_mens     uuid := auth.uid();
  v_creative bigint := nullif(p->>'creative_id','')::bigint;
  v_status   text;
  v_gemeten  boolean;
begin
  if v_mens is null or not exists (
       select 1 from public.team_members t
        where t.id = v_mens and t.status = 'approved') then
    raise exception 'Alleen een goedgekeurd teamlid kan een learning vastleggen.';
  end if;
  if v_creative is null then
    raise exception 'Zonder creative_id is er niets om een learning aan te hangen.';
  end if;

  select c.status into v_status from public.creatives c where c.id = v_creative;
  if v_status is null then
    raise exception 'Creative % bestaat niet.', v_creative;
  end if;

  select coalesce(r.beoordeelbaar, false) into v_gemeten
    from marketing_hq.creative_results r where r.creative_id = v_creative;

  if coalesce((p->>'bevestigen')::boolean, false) and not coalesce(v_gemeten, false) then
    raise exception
      'Deze creative is nog niet beoordeelbaar (0008: vier dagen, vijftig euro, duizend vertoningen). Opschrijven mag, bevestigen nog niet.';
  end if;

  update public.creatives c set
    learning_kern       = nullif(trim(coalesce(p->>'learning_kern','')), ''),
    learning_behouden   = nullif(trim(coalesce(p->>'learning_behouden','')), ''),
    learning_veranderen = nullif(trim(coalesce(p->>'learning_veranderen','')), ''),
    iteratie_voorstel   = nullif(trim(coalesce(p->>'iteratie_voorstel','')), ''),
    vervolgtests        = nullif(trim(coalesce(p->>'vervolgtests','')), ''),
    next_step           = coalesce(nullif(trim(coalesce(p->>'next_step','')), ''), c.next_step),
    learning_bevestigd_door =
      case when coalesce((p->>'bevestigen')::boolean, false) then v_mens else null end,
    learning_bevestigd_op =
      case when coalesce((p->>'bevestigen')::boolean, false) then now() else null end
  where c.id = v_creative;

  return jsonb_build_object('creative_id', v_creative,
    'bevestigd', coalesce((p->>'bevestigen')::boolean, false));
end $function$;

-- ── 9. De views terug ──────────────────────────────────────────────────────

-- Wie er meedoet. Was agents ∪ team_members; nu alleen mensen. De vorm blijft
-- gelijk (id, soort, naam, rol, actief) zodat alles wat erop joint blijft
-- werken -- `soort` staat er nog omdat vier views hem uitlezen.
create view marketing_hq.deelnemers as
select
  t.id::text                                                as id,
  'mens'::text                                              as soort,
  coalesce(nullif(trim(t.full_name), ''), t.email)          as naam,
  t.role                                                    as rol,
  (t.status = 'approved')                                   as actief
from public.team_members t;

alter view marketing_hq.deelnemers set (security_invoker = true);
grant select on marketing_hq.deelnemers to authenticated;

create view marketing_hq.overdrachten as
select
  o.id,
  o.werkstuk_id,
  w.titel                                                   as werkstuk,
  o.van_station,
  vs.naam                                                   as van_station_naam,
  o.naar_station,
  ns.naam                                                   as naar_station_naam,
  dv.naam                                                   as van,
  dv.soort                                                  as van_soort,
  o.besluit,
  o.waarom,
  o.controleren,
  o.onzekerheden,
  jsonb_array_length(o.onzekerheden)                        as aantal_onzekerheden,
  o.mens_nodig,
  o.mens_nodig_reden,
  o.status,
  dd.naam                                                   as afgehandeld_door,
  o.besloten_op,
  o.terug_reden,
  o.created_at,
  round(extract(epoch from now() - o.created_at) / 3600::numeric)::integer as uren_open,
  case o.status
    when 'aangenomen'    then 'aangenomen door ' || coalesce(dd.naam, 'onbekend')
    when 'teruggestuurd' then 'teruggestuurd door ' || coalesce(dd.naam, 'onbekend')
                              || ': ' || coalesce(o.terug_reden, '')
    when 'geescaleerd'   then 'ligt bij een mens: ' || coalesce(o.mens_nodig_reden, 'reden niet vastgelegd')
    when 'open'          then
      case when o.mens_nodig then 'wacht op een mens: ' || coalesce(o.mens_nodig_reden, '')
           else 'wacht op ' || coalesce(ns.naam, 'de volgende stap') end
    else 'onbekende status: ' || coalesce(o.status, 'leeg')
  end                                                       as stand
from marketing_hq.werkstuk_overdrachten o
join marketing_hq.werkstukken w on w.id = o.werkstuk_id
left join marketing_hq.werkstuk_stations vs on vs.station = o.van_station
left join marketing_hq.werkstuk_stations ns on ns.station = o.naar_station
left join marketing_hq.deelnemers dv on dv.id = o.van_mens::text
left join marketing_hq.deelnemers dd on dd.id = o.door_mens::text;

alter view marketing_hq.overdrachten set (security_invoker = true);
grant select on marketing_hq.overdrachten to authenticated;

create view marketing_hq.terugzendingen as
select
  t.id,
  t.werkstuk_id,
  w.titel                                                   as werkstuk,
  t.van_station,
  vs.naam                                                   as van_station_naam,
  t.naar_station,
  ns.naam                                                   as naar_station_naam,
  t.wat_is_mis,
  t.wat_moet_anders,
  coalesce(dd.naam, 'onbekend')                             as door,
  dd.soort                                                  as door_soort,
  t.ronde,
  t.created_at,
  case
    when t.ronde >= 3 then 'ronde ' || t.ronde || ' — dit blijft heen en weer gaan'
    when t.ronde = 2  then 'ronde 2 — tweede keer terug naar ' || ns.naam
    else 'eerste keer terug naar ' || ns.naam
  end                                                       as stand
from marketing_hq.werkstuk_terugzendingen t
join marketing_hq.werkstukken w on w.id = t.werkstuk_id
join marketing_hq.werkstuk_stations vs on vs.station = t.van_station
join marketing_hq.werkstuk_stations ns on ns.station = t.naar_station
left join marketing_hq.deelnemers dd on dd.id = t.door_mens::text;

alter view marketing_hq.terugzendingen set (security_invoker = true);
grant select on marketing_hq.terugzendingen to authenticated;

create view marketing_hq.denkstuk_regels as
select
  d.id                                                      as denkstuk_id,
  d.werkstuk_id,
  w.titel                                                   as werkstuk,
  v.vraag,
  v.tekst                                                   as vraagtekst,
  v.normaal_door,
  a.antwoord,
  a.zekerheid,
  a.bron,
  coalesce(dd.naam, 'nog niemand')                          as voorgesteld_door,
  dd.soort                                                  as voorgesteld_door_soort,
  a.updated_at,
  case
    when a.id is null                then 'nog niet beantwoord'
    when a.zekerheid = 'onderbouwd'  then 'onderbouwd: ' || coalesce(a.bron, '')
    when a.zekerheid = 'aanname'     then 'aanname — dit moet de test uitwijzen'
    when a.zekerheid = 'open'        then 'open — we weten het niet, en dat blijft staan'
    else 'onbekende zekerheid: ' || coalesce(a.zekerheid, 'leeg')
  end                                                       as stand
from marketing_hq.denkstukken d
join marketing_hq.werkstukken w on w.id = d.werkstuk_id
cross join marketing_hq.denkstuk_vragen v
left join marketing_hq.denkstuk_antwoorden a on a.denkstuk_id = d.id and a.vraag = v.vraag
left join marketing_hq.deelnemers dd on dd.id = a.door_mens::text;

alter view marketing_hq.denkstuk_regels set (security_invoker = true);
grant select on marketing_hq.denkstuk_regels to authenticated;

create view marketing_hq.werkstuk_estafette as
with stappen as (
  select w_1.id,
    count(*) filter (where s.status = 'klaar')                                    as stappen_af,
    min(s.station) filter (where s.status = any (array['open','bezig','wacht_op_mens','mislukt'])) as station_nu,
    bool_or(s.status = 'wacht_op_mens')                                           as wacht_op_mens,
    bool_or(s.status = 'mislukt')                                                 as heeft_fout,
    jsonb_agg(jsonb_build_object(
      'station', s.station, 'naam', stn.naam, 'door', d.naam,
      'door_soort', d.soort, 'status', s.status, 'overdracht', s.overdracht,
      'waarom', s.waarom, 'afgerond', s.afgerond_op) order by s.station)          as stappen
  from marketing_hq.werkstukken w_1
  left join marketing_hq.werkstuk_stappen s on s.werkstuk_id = w_1.id
  left join marketing_hq.werkstuk_stations stn on stn.station = s.station
  left join marketing_hq.deelnemers d on d.id = s.mens_id::text
  group by w_1.id
), cijfers as (
  select c_1.werkstuk_id,
    count(*)                                                 as aantal_ads,
    sum(cr.spend)                                            as spend,
    sum(cr.purchase_value)                                   as omzet,
    case when sum(cr.spend) > 0::numeric
         then round(sum(cr.purchase_value) / sum(cr.spend), 3) end as roas,
    count(*) filter (where c_1.status = 'Winner')            as winnaars
  from public.creatives c_1
  join marketing_hq.creative_results cr on cr.creative_id = c_1.id
  where c_1.werkstuk_id is not null
  group by c_1.werkstuk_id
)
select
  w.id, w.brand, w.titel, w.product, w.persona, w.angle_type, w.aanleiding,
  w.gestart_door, w.status, w.gestopt_reden,
  coalesce(st.stappen_af, 0::bigint)                         as stappen_af,
  st.station_nu,
  coalesce(st.wacht_op_mens, false)                          as wacht_op_mens,
  coalesce(st.heeft_fout, false)                             as heeft_fout,
  case
    when w.status = 'gestopt'                     then 'gestopt'
    when coalesce(st.stappen_af, 0::bigint) >= 6  then 'klaar'
    when st.heeft_fout                            then 'vastgelopen'
    when st.wacht_op_mens                         then 'wacht_op_mens'
    else 'loopt'
  end                                                        as toestand,
  st.stappen,
  c.aantal_ads, c.spend, c.omzet, c.roas, c.winnaars,
  w.created_at, w.updated_at,
  coalesce(ds.naam, 'onbekend')                              as gestart_door_naam
from marketing_hq.werkstukken w
left join stappen st on st.id = w.id
left join cijfers c on c.werkstuk_id = w.id
left join marketing_hq.deelnemers ds on ds.id = w.gestart_door_mens::text;

alter view marketing_hq.werkstuk_estafette set (security_invoker = true);
grant select on marketing_hq.werkstuk_estafette to authenticated;

-- De Criticus blijft bestaan als menselijke stap.
create view marketing_hq.criticus_staat as
select
  count(*)                                                   as oordelen,
  count(*) filter (where oordeel = 'niet door')              as afgekeurd,
  count(*) filter (where oordeel = 'door')                   as doorgelaten,
  max(created_at)                                            as laatste,
  case
    when count(*) = 0 then 'nog geen oordeel geveld'
    when count(*) filter (where oordeel = 'niet door') = 0 and count(*) >= 5
      then count(*)::text || ' oordelen, geen enkele afwijzing — dat is een stempel, geen oordeel'
    else count(*)::text || ' oordelen, waarvan '
         || count(*) filter (where oordeel = 'niet door')::text || ' afgewezen'
  end                                                        as toestand
from marketing_hq.criticus_oordelen;

alter view marketing_hq.criticus_staat set (security_invoker = true);
grant select on marketing_hq.criticus_staat to authenticated;

create view marketing_hq.criticus_werkvoorraad as
select
  o.id                                                       as overdracht_id,
  o.werkstuk_id,
  w.titel                                                    as werkstuk,
  coalesce(dv.naam, 'onbekend')                              as van,
  o.besluit,
  o.waarom,
  o.controleren,
  o.mens_nodig,
  o.mens_nodig_reden,
  round(extract(epoch from now() - o.created_at) / 3600::numeric)::integer as uren_open
from marketing_hq.werkstuk_overdrachten o
join marketing_hq.werkstukken w on w.id = o.werkstuk_id
left join marketing_hq.deelnemers dv on dv.id = o.van_mens::text
where o.status = 'open' and o.van_station = 3;

alter view marketing_hq.criticus_werkvoorraad set (security_invoker = true);
grant select on marketing_hq.criticus_werkvoorraad to authenticated;

-- ── 10. De stand van de meting ─────────────────────────────────────────────
-- Zelfde vorm als 0041 -- de tracker leest hier zes velden uit en die mogen
-- niet verschuiven. Twee dingen veranderen: de bron heet systeem_events, en de
-- patronen kloppen weer. "Meta gaf geen cijfers" kwam uit de tool-wrapper van
-- de agent en wordt sinds v16 nooit meer geschreven; wat er nu staat als er
-- iets misgaat is "Inhaalslag ... mislukt" of "Meta gaf N van de M vensters
-- niet". Zonder deze aanpassing zou de tracker een kapotte koppeling als
-- 'stil' tonen -- precies de storing die 0041 moest vangen.
create view marketing_hq.meta_sync_status as
with laatste_meting as (
  select max(captured_at) as op, count(*) as rijen
    from marketing_hq.meta_insights_daily
), dekking as (
  select count(*) filter (where level = 'ad') as op_advertentieniveau,
         string_agg(distinct level, ', ' order by level) as niveaus
    from marketing_hq.meta_insights_daily
), koppeling as (
  select count(*) as gekoppeld
    from marketing_hq.meta_publications
   where meta_ad_id is not null and published_at is not null
), laatste_klacht as (
  select created_at, message, data
    from marketing_hq.systeem_events
   where level = 'warn'
     and (message ilike 'Inhaalslag%mislukt%'
       or message ilike 'Meta gaf%vensters niet%'
       or message ilike 'Meta weigerde%'
       or message ilike 'Meta kent deze velden%')
   order by created_at desc
   limit 1
), pogingen as (
  select count(*) as sinds_gisteren
    from marketing_hq.systeem_events
   where level = 'warn'
     and created_at > (now() - '36:00:00'::interval)
     and (message ilike 'Inhaalslag%mislukt%'
       or message ilike 'Meta gaf%vensters niet%'
       or message ilike 'Meta weigerde%')
)
select
  m.rijen                                                    as gemeten_rijen,
  m.op                                                       as laatst_gemeten,
  k.created_at                                               as laatste_klacht_op,
  k.message                                                  as laatste_klacht,
  k.data ->> 'fout'                                          as laatste_fout,
  p.sinds_gisteren                                           as mislukte_pogingen_36u,
  case
    when m.rijen > 0 and m.op > (now() - '36:00:00'::interval) then 'werkt'
    when p.sinds_gisteren > 0                                  then 'kapot'
    when m.rijen = 0                                           then 'nooit gedraaid'
    else 'stil'
  end                                                        as toestand,
  d.op_advertentieniveau                                     as metingen_advertentieniveau,
  coalesce(d.niveaus, '—')                                   as gemeten_niveaus,
  ko.gekoppeld                                               as gekoppelde_advertenties
from laatste_meting m
cross join dekking d
cross join koppeling ko
cross join pogingen p
left join laatste_klacht k on true;

alter view marketing_hq.meta_sync_status set (security_invoker = true);
grant select on marketing_hq.meta_sync_status to authenticated;

-- ── 11. De testkaart en het dossier ────────────────────────────────────────
-- Twee grote views die alleen langs de agentkant geraakt worden. Ze staan hier
-- integraal opnieuw omdat een view geen ALTER kent; inhoudelijk is er precies
-- één ding weg per view.

-- testkaart: `learning_door_agent` vervalt. Wie de learning bevestigde blijft
-- staan (learning_bevestigd_door), en dat was altijd al een mens.
create view marketing_hq.testkaart as
select
  c.id as creative_id, c.brand, c.ad_name, c.product, c.persona, c.angle_type,
  c.marketing_angle, c.awareness_level, c.funnel_stage, c.format, c.media_type,
  c.channel, c.headline, c.body_copy, c.cta, c.visual_concept, c.image_prompt,
  c.image_b64 is not null as heeft_beeld,
  c.bibliotheek_id, c.batch_id, c.variant_index, c.hypothesis, c.test_variable,
  c.rory_reasoning, c.theriot_reasoning, c.bronnen, c.placement, c.product_refs,
  c.learning_kern, c.learning_behouden, c.learning_veranderen,
  c.iteratie_voorstel, c.vervolgtests,
  c.learning_bevestigd_door is not null as learning_bevestigd,
  lb.full_name as learning_bevestigd_door,
  c.learning_bevestigd_op,
  c.status,
  s.fase as status_fase, s.betekenis as status_betekenis, s.volgorde as status_volgorde,
  s.verantwoordelijke, s.volgende_stap, s.vraagt_test,
  c.parent_id, c.werkstuk_id, c.denkstuk_id,
  c.user_name as gemaakt_door,
  tm.full_name as klaargezet_door,
  c.klaargezet_op, c.created_at, c.date_live,
  c.roas, c.ctr, c.hook_rate, c.conversions, c.budget, c.score, c.next_step,
  w.titel as werkstuk, w.status as werkstuk_status, w.rory_interview, w.mens_ingeving,
  w.sophistication, sn.naam as sophistication_naam, sn.wat_werkt as sophistication_wat_werkt,
  w.sophistication_reden,
  w.sophistication_bevestigd_door is not null as sophistication_bevestigd,
  d.status as denkstuk_status,
  coalesce(a.onderbouwd, 0::bigint)   as onderbouwd,
  coalesce(a.aanname, 0::bigint)      as aanname,
  coalesce(a.open_gelaten, 0::bigint) as open_gelaten,
  case
    when d.id is null then 'geen denkstuk — deze test rust nergens op'
    when coalesce(a.onderbouwd, 0::bigint) = 0 then 'niets is gemeten; alles rust op aannames'
    else (coalesce(a.onderbouwd, 0::bigint) || ' van de ' || coalesce(a.totaal, 0::bigint))
         || ' antwoorden zijn onderbouwd'
  end as onderbouwing,
  case
    when c.hypothesis is null or length(btrim(c.hypothesis)) = 0
      then 'geen hypothese — een afbeelding zonder hypothese is geen test'
    when c.test_variable is null or length(btrim(c.test_variable)) = 0
      then 'geen testvariabele — dan is achteraf niet te zeggen wát het deed'
    when c.werkstuk_id is null then 'niet aan een werkstuk gekoppeld'
    else null::text
  end as niet_testklaar,
  case
    when c.image_b64 is not null then null::text
    when c.bibliotheek_id is not null then 'het beeld staat in de bibliotheek, niet in de database'
    else 'niet gekoppeld aan een bibliotheekvariant — beeld en copy zijn niet terug te vinden'
  end as beeld_herkomst,
  v.verdict, v.verdict_actie, v.verdict_reden, v.verdict_op
from public.creatives c
left join marketing_hq.creative_statussen s on s.status = c.status
left join marketing_hq.werkstukken w on w.id = c.werkstuk_id
left join marketing_hq.denkstukken d on d.id = c.denkstuk_id
left join public.team_members tm on tm.id = c.klaargezet_door
left join public.team_members lb on lb.id = c.learning_bevestigd_door
left join marketing_hq.sophistication_niveaus sn on sn.niveau = w.sophistication
left join lateral (
  select count(*) as totaal,
         count(*) filter (where x.zekerheid = 'onderbouwd') as onderbouwd,
         count(*) filter (where x.zekerheid = 'aanname')    as aanname,
         count(*) filter (where x.zekerheid = 'open')       as open_gelaten
  from marketing_hq.denkstuk_antwoorden x where x.denkstuk_id = d.id) a on true
left join lateral (
  select mr.verdict, mr.action as verdict_actie, mr.reasoning as verdict_reden,
         mr.created_at as verdict_op
  from marketing_hq.meta_recommendations mr
  where mr.creative_id = c.id
  order by mr.created_at desc limit 1) v on true;

alter view marketing_hq.testkaart set (security_invoker = true);
grant select on marketing_hq.testkaart to authenticated;

-- creative_dossier: het blok `discussies` vervalt -- dat waren de berichten die
-- agents elkaar stuurden, uit agent_messages. Het blok `oordelen` blijft, want
-- de Criticus was altijd al een mens. In de tijdlijn vervallen de agenttakken.
create view marketing_hq.creative_dossier as
select
  t.*,
  (select jsonb_agg(jsonb_build_object(
            'vraag', v.vraag, 'tekst', v.tekst,
            'antwoord', a.antwoord, 'zekerheid', a.zekerheid, 'bron', a.bron)
          order by v.vraag)
     from marketing_hq.denkstuk_vragen v
     left join marketing_hq.denkstuk_antwoorden a
            on a.denkstuk_id = t.denkstuk_id and a.vraag = v.vraag
  )                                               as denkstuk_regels,
  (select jsonb_agg(jsonb_build_object(
            'station', s.station, 'naam', st.naam, 'status', s.status,
            'wie', coalesce(tm.full_name, 'naamloos'),
            'soort', case when s.mens_id is not null then 'mens' else 'onbekend' end,
            'waarom', s.waarom, 'afgerond', s.afgerond_op)
          order by s.station)
     from marketing_hq.werkstuk_stappen s
     join marketing_hq.werkstuk_stations st on st.station = s.station
     left join public.team_members tm on tm.id = s.mens_id
    where s.werkstuk_id = t.werkstuk_id)          as stappen,
  (select jsonb_agg(jsonb_build_object(
            'van_station', o.van_station, 'naar_station', o.naar_station,
            'besluit', o.besluit, 'waarom', o.waarom, 'controleren', o.controleren,
            'onzekerheden', o.onzekerheden, 'mens_nodig', o.mens_nodig,
            'status', o.status, 'wanneer', o.created_at)
          order by o.created_at)
     from marketing_hq.werkstuk_overdrachten o
    where o.werkstuk_id = t.werkstuk_id)          as overdrachten,
  (select jsonb_agg(jsonb_build_object(
            'oordeel', k.oordeel, 'reden', k.reden, 'wanneer', k.created_at,
            'door', coalesce(tm.full_name, 'de Criticus'))
          order by k.created_at)
     from marketing_hq.criticus_oordelen k
     join marketing_hq.werkstuk_overdrachten o on o.id = k.overdracht_id
     left join public.team_members tm on tm.id = k.door_mens
    where o.werkstuk_id = t.werkstuk_id)          as oordelen,
  (select jsonb_build_object(
            'account_id', p.account_id, 'status', p.status,
            'meta_ad_id', p.meta_ad_id, 'gepubliceerd_op', p.published_at,
            'door', p.published_by)
     from marketing_hq.meta_publications p
    where p.creative_id = t.creative_id
    order by p.created_at desc limit 1)           as publicatie,
  (select jsonb_build_object(
            'spend', r.spend, 'impressions', r.impressions, 'clicks', r.clicks,
            'ctr', r.ctr, 'cpa', r.cpa, 'roas', r.roas, 'purchases', r.purchases,
            'omzet', r.purchase_value, 'hook_rate', r.hook_rate,
            'dagen_live', r.dagen_live, 'meetdagen', r.meetdagen,
            'alles_definitief', r.alles_definitief, 'beoordeelbaar', r.beoordeelbaar)
     from marketing_hq.creative_results r
    where r.creative_id = t.creative_id)          as meting,
  (select jsonb_agg(jsonb_build_object(
            'hoek', l.angle_type, 'persona', l.persona,
            'advertenties', l.aantal_ads, 'spend', l.spend, 'roas', l.roas,
            'winnaars', l.winnaars, 'betrouwbaar', l.betrouwbaar)
          order by l.angle_type)
     from marketing_hq.angle_learnings l
    where l.angle_type = t.angle_type
      and (t.persona is null or l.persona = t.persona)) as learnings,

  -- De andere varianten uit dezelfde generatie. Zo is "variant 2 van 3"
  -- zichtbaar en blijven de drie afzonderlijk aanklikbaar in plaats van dat
  -- ze als één gedachte samenvallen.
  (select jsonb_agg(jsonb_build_object(
            'creative_id', z.id, 'ad_name', z.ad_name,
            'variant_index', z.variant_index, 'heeft_beeld', z.image_b64 is not null)
          order by z.variant_index, z.id)
     from public.creatives z
    where t.batch_id is not null and z.batch_id = t.batch_id
      and z.brand = t.brand)                      as zusjes,

  (select jsonb_agg(x order by x->>'wanneer')
     from (
       select jsonb_build_object(
                'wanneer', s.afgerond_op, 'soort', 'stap',
                'wie', coalesce(tm.full_name, 'naamloos'),
                'door', case when s.mens_id is not null then 'mens' else 'onbekend' end,
                'wat', st.naam || ' ' || s.status,
                'waarom', s.waarom) as x
         from marketing_hq.werkstuk_stappen s
         join marketing_hq.werkstuk_stations st on st.station = s.station
         left join public.team_members tm on tm.id = s.mens_id
        where s.werkstuk_id = t.werkstuk_id and s.afgerond_op is not null
       union all
       select jsonb_build_object(
                'wanneer', o.created_at, 'soort', 'overdracht',
                'wie', coalesce(tm.full_name, 'naamloos'),
                'door', case when o.door_mens is not null then 'mens' else 'onbekend' end,
                'wat', o.van_station || ' → ' || coalesce(o.naar_station::text, '?'),
                'waarom', o.besluit)
         from marketing_hq.werkstuk_overdrachten o
         left join public.team_members tm on tm.id = o.door_mens
        where o.werkstuk_id = t.werkstuk_id
       union all
       select jsonb_build_object(
                'wanneer', k.created_at, 'soort', 'oordeel',
                'wie', coalesce(tm.full_name, 'de Criticus'),
                'door', 'mens',
                'wat', 'oordeel: ' || k.oordeel, 'waarom', k.reden)
         from marketing_hq.criticus_oordelen k
         join marketing_hq.werkstuk_overdrachten o2 on o2.id = k.overdracht_id
         left join public.team_members tm on tm.id = k.door_mens
        where o2.werkstuk_id = t.werkstuk_id
       union all
       select jsonb_build_object(
                'wanneer', t.klaargezet_op, 'soort', 'klaargezet',
                'wie', coalesce(t.klaargezet_door, 'een teamlid'), 'door', 'mens',
                'wat', 'klaargezet voor test', 'waarom', t.hypothesis)
        where t.klaargezet_op is not null
     ) tl)                                          as tijdlijn
from marketing_hq.testkaart t;

alter view marketing_hq.creative_dossier set (security_invoker = true);
grant select on marketing_hq.creative_dossier to authenticated;

-- ── 12. De teampagina: alleen mensen ───────────────────────────────────────

create view public.hq_team as
select
  'mens'::text                                                as soort,
  m.id::text                                                  as id,
  coalesce(nullif(btrim(m.full_name), ''), '(naam nog niet ingevuld)') as naam,
  coalesce(m.rol_titel,
           case when m.role = 'admin' then 'Beheerder' else 'Teamlid' end) as rol,
  m.voorstellen,
  m.rol_titel
from public.team_members m
where m.status = 'approved'
  and exists (
    select 1 from public.team_members me
    where me.id = auth.uid() and me.status = 'approved'
  );

revoke all on public.hq_team from anon, public;
grant select on public.hq_team to authenticated;

-- ── 13. De publieke spiegels van wat blijft ────────────────────────────────
-- Alleen de spiegels die er al waren. hq_deelnemers, hq_email_drafts,
-- hq_schedules en hq_werkbank komen niet terug: die hoorden bij schermen of
-- tabellen die er niet meer zijn.

create view public.hq_testkaart with (security_invoker = true)
  as select * from marketing_hq.testkaart;
revoke all on public.hq_testkaart from anon, public;
grant select on public.hq_testkaart to authenticated;

create view public.hq_creative_dossier with (security_invoker = true)
  as select * from marketing_hq.creative_dossier;
revoke all on public.hq_creative_dossier from anon, public;
grant select on public.hq_creative_dossier to authenticated;

create view public.hq_overdrachten with (security_invoker = true)
  as select * from marketing_hq.overdrachten;
revoke all on public.hq_overdrachten from anon, public;
grant select on public.hq_overdrachten to authenticated;

create view public.hq_terugzendingen with (security_invoker = true)
  as select * from marketing_hq.terugzendingen;
revoke all on public.hq_terugzendingen from anon, public;
grant select on public.hq_terugzendingen to authenticated;

create view public.hq_denkstuk_regels with (security_invoker = true)
  as select * from marketing_hq.denkstuk_regels;
revoke all on public.hq_denkstuk_regels from anon, public;
grant select on public.hq_denkstuk_regels to authenticated;

create view public.hq_criticus_werkvoorraad with (security_invoker = true)
  as select * from marketing_hq.criticus_werkvoorraad;
revoke all on public.hq_criticus_werkvoorraad from anon, public;
grant select on public.hq_criticus_werkvoorraad to authenticated;

create view public.hq_meta_sync_status with (security_invoker = true)
  as select * from marketing_hq.meta_sync_status;
revoke all on public.hq_meta_sync_status from anon, public;
grant select on public.hq_meta_sync_status to authenticated;

create view public.hq_meta_recommendations with (security_invoker = true)
  as select * from marketing_hq.meta_recommendations;
revoke all on public.hq_meta_recommendations from anon, public;
grant select on public.hq_meta_recommendations to authenticated;

-- Zelfde kolommen als vóór deze migratie: de agentkolommen zaten er niet in,
-- dus hier verandert niets behalve dat hij opnieuw gezet moet worden.
create view public.hq_werkstukken with (security_invoker = true) as
select id, brand, titel, product, persona, angle_type, aanleiding, gestart_door,
       status, gestopt_reden, stappen_af, station_nu, wacht_op_mens, heeft_fout,
       toestand, stappen, aantal_ads, spend, omzet, roas, winnaars,
       created_at, updated_at
from marketing_hq.werkstuk_estafette;
revoke all on public.hq_werkstukken from anon, public;
grant select on public.hq_werkstukken to authenticated;

-- De wachtrij onder zijn nieuwe naam, voor wie in de console wil zien wat er
-- klaarstaat zonder de worker te bevragen.
create view public.hq_taken with (security_invoker = true)
  as select * from marketing_hq.taken;
revoke all on public.hq_taken from anon, public;
grant select on public.hq_taken to authenticated;

create view public.hq_systeem_events with (security_invoker = true)
  as select * from marketing_hq.systeem_events;
revoke all on public.hq_systeem_events from anon, public;
grant select on public.hq_systeem_events to authenticated;

commit;
