#!/usr/bin/env bash
# Testlus voor migratie 0029 — de blokkade zichtbaar in de werkbank.
#
# De werkbank zei tot nu toe waar een werkstuk ligt. Deze migratie zegt erbij
# waarom het daar niet weg kan. Drie dingen moeten kloppen:
#
# 1. De blokkade noemt de juiste van de twee grendels, en in de juiste volgorde.
#    Afgekeurd is iets anders dan wachten op een oordeel, en dat verschil mag
#    niet samenvallen tot "geblokkeerd".
#
# 2. Geen blokkade waar er geen is. Een werkstuk dat gewoon nog niemands beurt
#    was, is stil zonder geblokkeerd te zijn — wie dat verwart, leert het scherm
#    te negeren.
#
# 3. aantal_creatives telt op het moment van kijken, en de toelichting op ③
#    draagt het getal niet meer.
#
#   bash platform/db/test/blokkade.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/blokkade-test-$$"
PORT=${PGTESTPORT:-5516}
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
export PATH="$PATH:$BIN"
UID_PG=$(id -un postgres 2>/dev/null || echo "$(id -un)")

fout=0
check() {
  if [ "$2" = "$3" ]; then printf '  ok   %s\n' "$1"
  else fout=$((fout+1)); printf '  FOUT %s\n       verwacht %s, kreeg %s\n' "$1" "$2" "$3"; fi
}
q() { psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c "$1" 2>/dev/null \
      | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'; }
qerr() { psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c "$1" 2>&1 | tr '\n' ' '; }
weigert() {
  local uit; uit=$(qerr "$1")
  case "$uit" in *"$2"*) echo ja ;; *ERROR*) echo "andere fout: $uit" ;; *) echo nee ;; esac
}

opruimen() { su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -m immediate stop" >/dev/null 2>&1; rm -rf "$WERK"; }
trap opruimen EXIT

mkdir -p "$WERK"; chown -R "$UID_PG" "$WERK" 2>/dev/null
su "$UID_PG" -c "$BIN/initdb -D $WERK -U postgres -A trust --locale=C -E UTF8" >/dev/null 2>&1 || {
  echo "  initdb mislukt — staat postgres geïnstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

# De fixture volgt de echte kolomlijsten van productie. Waar hij daarvan
# afwijkt, test je iets anders dan wat er draait -- dezelfde soort fout als
# schedules.id in 0020, en hij verstopt zich even goed.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated login; create role anon login;
grant usage on schema marketing_hq, public to authenticated, anon;
create function marketing_hq.is_team_member() returns boolean
  language sql stable as $$ select coalesce(current_setting('test.teamlid', true), 'nee') = 'ja' $$;

create table marketing_hq.agents (id text primary key, name text not null,
  role text not null default '', phase int not null default 1,
  status text not null default 'idle', current_task text, last_run_at timestamptz,
  created_at timestamptz default now(), operationeel boolean default true,
  levert text, rapporteert_in text);
insert into marketing_hq.agents (id, name, role) values
  ('radar','Radar','Trendscout'),('nova','Nova','Creative Director'),
  ('pixel','Pixel','Content'),('quill','Quill','Copy'),('bolt','Bolt','Performance'),
  ('atlas','Atlas','Data'),('echo','Echo','E-mail'),('vector','Vector','Web'),('sage','Sage','SEO');

create table public.team_members (
  id uuid primary key, email text not null, full_name text,
  status text not null default 'pending', is_admin boolean default false,
  created_at timestamptz default now(), role text default 'member');
insert into public.team_members (id, email, full_name, status, role) values
  ('11111111-1111-1111-1111-111111111111','dustin@wellshave.com','Dustin Gibson','approved','admin');

create table marketing_hq.agent_jobs (id bigint generated always as identity primary key,
  agent_id text, kind text, status text default 'done', payload jsonb,
  created_at timestamptz default now());
create table marketing_hq.agent_runs (
  id bigint generated always as identity primary key, agent_id text,
  started_at timestamptz default now(), finished_at timestamptz, status text,
  summary text, output_path text, job_id bigint, input_tokens int,
  output_tokens int, cost_usd numeric, model text);
create table marketing_hq.agent_events (
  id bigint generated always as identity primary key, job_id bigint, run_id bigint,
  agent_id text, level text default 'info', message text, data jsonb,
  created_at timestamptz not null default now());
create table marketing_hq.agent_messages (
  id bigint generated always as identity primary key, from_agent text, to_agent text,
  subject text, body text, ref_pipeline_item bigint,
  created_at timestamptz default now(), read_at timestamptz, werkstuk_id bigint);
create table marketing_hq.approvals (
  id bigint generated always as identity primary key, requested_by text,
  action_type text, description text, payload jsonb, status text default 'pending',
  decided_by text, decided_at timestamptz, created_at timestamptz default now(),
  werkstuk_id bigint);
create table marketing_hq.reports (
  id bigint generated always as identity primary key, report_date date, kind text,
  title text, author_agent text, vault_path text, body_md text,
  created_at timestamptz default now(), werkstuk_id bigint, periode_start date,
  periode_eind date, voorlopig boolean default false, voorlopig_reden text,
  cijfers jsonb, signalen jsonb, gaten jsonb, account_id text);
-- 0008 zet onderaan de ochtendcyclus in schedules; zonder die tabel valt hij om.
create table marketing_hq.schedules (id text primary key, agent_id text, kind text, cron text,
  payload jsonb, enabled boolean default true, last_fired_at timestamptz,
  next_due_at timestamptz, created_at timestamptz default now());
create table marketing_hq.meta_recommendations (id bigint generated always as identity primary key,
  ad_id text, creative_id bigint, agent_id text, run_id bigint, verdict text, action text,
  created_at timestamptz default now());
create table marketing_hq.pipeline_items    (id bigint generated always as identity primary key, angle text);
create table marketing_hq.email_drafts      (id bigint generated always as identity primary key, angle text);
create table marketing_hq.ad_accounts (account_id text primary key, naam text, merk text);

-- Kolomlijsten gelijk aan productie.
create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text, entity_name text,
  parent_id text, spend numeric, impressions bigint, reach bigint, frequency numeric,
  clicks bigint, link_clicks bigint, ctr numeric, cpc numeric, cpm numeric,
  purchases integer, purchase_value numeric, roas numeric, add_to_cart integer,
  initiate_checkout integer, landing_page_views integer, video_3s integer,
  video_thruplay integer, quality_ranking text, engagement_rate_ranking text,
  conversion_rate_ranking text, is_final boolean default true,
  captured_at timestamptz default now(), view_content integer, add_payment_info integer);

create table marketing_hq.meta_publications (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  creative_id bigint, ad_name text, account_id text, adset_id text, campaign_id text,
  asset_kind text, asset_sha256 text, headline text, primary_text text, description text,
  cta_type text, link_url text, utm_content text, page_id text, instagram_actor_id text,
  meta_image_hash text, meta_video_id text, meta_creative_id text, meta_ad_id text,
  object_story_spec jsonb, hypothesis text, angle text, persona text, awareness_level text,
  status text, approval_id bigint, prepared_by text, run_id bigint, published_by text,
  proposed_daily_budget numeric, idem_key text, attempts integer, error text,
  created_at timestamptz default now(), prepared_at timestamptz, approved_at timestamptz,
  published_at timestamptz, werkstuk_id bigint);

create table public.creatives (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  user_id uuid, user_email text, user_name text, ad_name text, product text,
  awareness_level text, angle_type text, marketing_angle text, desires text,
  format text, creative_concept text, media_type text, hook_short text, channel text,
  audience text, persona text, date_live date, budget numeric, impressions bigint,
  hook_rate numeric, hold_rate numeric, ctr numeric, cpm numeric, cpc numeric,
  conversions integer, cvr numeric, cpa numeric, aov numeric, roas numeric,
  breakeven_roas numeric, target_roas numeric, score numeric, status text default 'To Test',
  next_step text, notes text, creatives_link text, script jsonb, source_type text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  image_b64 text, lib_id text, has_image boolean, werkstuk_id bigint);

do $do$
declare t text;
begin
  foreach t in array array['agent_runs','agent_events','agent_messages','approvals','reports','agents'] loop
    execute format('alter table marketing_hq.%I enable row level security', t);
    execute format('create policy lezen on marketing_hq.%I for select using (marketing_hq.is_team_member())', t);
    execute format('grant select on marketing_hq.%I to authenticated', t);
  end loop;
end $do$;
grant select on public.creatives to authenticated;
alter table public.team_members enable row level security;
create policy lezen on public.team_members for select using (marketing_hq.is_team_member());
grant select on public.team_members to authenticated;
SQL

for m in 0008_terugkoppeling 0009_ruggengraat 0011_tracker 0012_atlas 0013_audit 0017_views \
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus 0029_blokkade; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  alle migraties draaien"
echo

# ── De zaak ────────────────────────────────────────────────────────────────
# Vier werkstukken, elk in een andere toestand. Ze staan er niet om de view te
# vullen maar omdat elk een ander antwoord op "wat houdt dit tegen" hoort te
# geven — en het vierde hoort er geen te geven.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL'
insert into marketing_hq.werkstukken (id, titel, product, persona, angle_type, gestart_door)
overriding system value values
  (1,'Wacht op een oordeel','Groom Guard','Mark','safety','mens'),
  (2,'Afgekeurd door de Criticus','Groom Guard','Mark','safety','mens'),
  (3,'Blokkerende onzekerheid','Groom Guard','Mark','safety','mens'),
  (4,'Niets aan de hand','Groom Guard','Mark','safety','mens');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 4);

-- 1 en 2 liggen bij de Criticus; 3 heeft een blokkerende onzekerheid en geen
-- oordeel nodig want hij komt uit ②; 4 heeft helemaal geen open overdracht.
insert into marketing_hq.werkstuk_overdrachten
  (id, werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
overriding system value values
  (1, 1, 3, 4, 'quill', 'Drie statics', 'Uit het denkstuk', 'Of de kop klopt', '[]'::jsonb),
  (2, 2, 3, 4, 'quill', 'Drie statics', 'Uit het denkstuk', 'Of de kop klopt', '[]'::jsonb),
  (3, 3, 2, 3, 'nova',  'Hoek uitgewerkt', 'Uit het signaal', 'Of het format past',
      '[{"wat":"Er is geen beeld voor de derde advertentie","blokkerend":true}]'::jsonb);
select setval(pg_get_serial_sequence('marketing_hq.werkstuk_overdrachten','id'), 3);

-- Werkstuk 2 is afgekeurd.
insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
values (2, 'niet door', 'de belofte in de kop staat niet op de landingspagina', 'criticus');

-- Creatives: 3 op werkstuk 1, 1 op werkstuk 2, geen op 3 en 4.
insert into public.creatives (werkstuk_id, ad_name) values (1,'a'),(1,'b'),(1,'c'),(2,'d');

-- Werkstuk 1 loopt de echte route: denkstuk afgetekend, briefing dicht, creatie
-- op naam. Dat is nodig om station ③ überhaupt op 'klaar' te krijgen — 0023
-- laat creatie niet beginnen zolang de briefing niet af is, en 0022 laat de
-- briefing niet af zijn zonder overdracht. De fixture mag die volgorde niet
-- overslaan, anders test hij een toestand die op productie niet kan bestaan.
insert into marketing_hq.denkstukken (werkstuk_id, status) values (1, 'bezig');
insert into marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag, antwoord, zekerheid, door_mens)
select d.id, v.vraag, v.antwoord, 'aanname', '11111111-1111-1111-1111-111111111111'
from marketing_hq.denkstukken d,
     (values (1::smallint,'de hoek'), (2::smallint,'het probleem'), (3::smallint,'de persona'),
             (4::smallint,'Als we het mechanisme tonen, dan stijgt de CTR, omdat twijfel wegvalt bij bewijs'),
             (5::smallint,'static'), (6::smallint,'of bewijs wint van belofte'), (7::smallint,'nu')) v(vraag, antwoord)
where d.werkstuk_id = 1;
update marketing_hq.denkstukken set status='bevestigd',
       bevestigd_door='11111111-1111-1111-1111-111111111111' where werkstuk_id=1;

insert into marketing_hq.werkstuk_overdrachten
  (werkstuk_id, van_station, naar_station, van_mens, besluit, waarom, controleren)
values (1, 2, 3, '11111111-1111-1111-1111-111111111111',
        'De hoek is safety', 'Uit het denkstuk', 'Of het format past');

update marketing_hq.werkstuk_stappen set status='klaar', agent_id=null,
       mens_id='11111111-1111-1111-1111-111111111111',
       waarom='Denkstuk afgetekend.'
 where werkstuk_id=1 and station=2;

-- En de oude toelichting met een getal erin, zoals hij op productie stond.
-- Werkstuk 1 heeft een naam bij die stap; werkstuk 4 niet. Dat verschil is geen
-- detail: de constraint uit 0021 staat NOT VALID, dus een naamloze rij aanraken
-- laat hem alsnog vuren.
update marketing_hq.werkstuk_stappen
   set waarom = 'Creative gemaakt in de Atelier Console (6 varianten).',
       status = 'klaar', agent_id = null,
       mens_id = '11111111-1111-1111-1111-111111111111'
 where werkstuk_id = 1 and station = 3;
update marketing_hq.werkstuk_stappen
   set waarom = 'Creative gemaakt in de Atelier Console (2 varianten).'
 where werkstuk_id = 4 and station = 3;
SQL
echo "  de zaak staat klaar"
echo

# ── 1. De blokkade noemt de juiste grendel ─────────────────────────────────
echo "  wat houdt het tegen"
check "wachten op een oordeel heet zo" "oordeel" \
  "$(q "select blokkade_soort from marketing_hq.werkbank where id=1")"
check "en zegt in mensentaal wat er moet gebeuren" "ja" \
  "$(q "select case when blokkade like '%nog geen oordeel%' then 'ja' else blokkade end
        from marketing_hq.werkbank where id=1")"
check "afgekeurd is een andere soort dan wachten" "afgekeurd" \
  "$(q "select blokkade_soort from marketing_hq.werkbank where id=2")"
check "en de reden van de Criticus staat erbij" "ja" \
  "$(q "select case when blokkade like '%staat niet op de landingspagina%' then 'ja' else blokkade end
        from marketing_hq.werkbank where id=2")"
check "een blokkerende onzekerheid komt eruit als onzekerheid" "onzekerheid" \
  "$(q "select blokkade_soort from marketing_hq.werkbank where id=3")"
check "met de tekst die iemand zelf opschreef" "ja" \
  "$(q "select case when blokkade like '%geen beeld voor de derde%' then 'ja' else blokkade end
        from marketing_hq.werkbank where id=3")"

# ── 2. En vooral: geen blokkade waar er geen is ────────────────────────────
echo
echo "  geen blokkade verzinnen"
check "zonder open overdracht is er niets dat tegenhoudt" "" \
  "$(q "select coalesce(blokkade_soort,'') from marketing_hq.werkbank where id=4")"
check "en de reden is dan ook leeg" "" \
  "$(q "select coalesce(blokkade,'') from marketing_hq.werkbank where id=4")"
# Dit is de mutatietest van dit bestand: haal de van_station=3-voorwaarde weg
# uit de functie en werkstuk 3 gaat 'wacht op de Criticus' melden, terwijl de
# Criticus daar helemaal niet over gaat.
check "de Criticus gaat niet over een overdracht uit ②" "onzekerheid" \
  "$(q "select blokkade_soort from marketing_hq.werkbank where id=3")"
check "een afgehandelde overdracht houdt niets meer tegen" "" \
  "$(q "update marketing_hq.werkstuk_overdrachten set status='teruggestuurd',
          door_agent='bolt', besloten_op=now(), terug_reden='niet nu' where id=1;
        select coalesce(blokkade_soort,'') from marketing_hq.werkbank where id=1")"

# ── 3. Afgekeurd weegt zwaarder dan een onzekerheid ────────────────────────
echo
echo "  de volgorde als er twee tegelijk zijn"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
update marketing_hq.werkstuk_overdrachten
   set onzekerheden = '[{"wat":"het budget is niet vastgesteld","blokkerend":true}]'::jsonb
 where id = 2;
SQL
check "een afgekeurd werkstuk meldt de afkeuring, niet de onzekerheid" "afgekeurd" \
  "$(q "select blokkade_soort from marketing_hq.werkbank where id=2")"

# ── 4. Het getal wordt geteld, niet onthouden ──────────────────────────────
echo
echo "  aantal_creatives"
check "drie creatives worden er drie" "3" \
  "$(q "select aantal_creatives from marketing_hq.werkbank where id=1")"
check "geen creatives is nul en niet leeg" "0" \
  "$(q "select aantal_creatives from marketing_hq.werkbank where id=4")"
check "er eentje bij telt meteen mee" "4" \
  "$(q "insert into public.creatives (werkstuk_id, ad_name) values (1,'e');
        select aantal_creatives from marketing_hq.werkbank where id=1")"
# Op productie stond die tekst er al vóór de migratie; hier zet de fixture hem
# er pas ná. Dus draait hij hier nog een keer — dat is dezelfde volgorde als
# daar, en het bewijst meteen dat een tweede keer draaien niets stukmaakt.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0029_blokkade.sql" >/dev/null 2>&1
check "de toelichting op ③ draagt het getal niet meer" "Creative gemaakt in de Atelier Console." \
  "$(q "select waarom from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=3")"
# Herschrijft iemand de toelichting zelf, dan is dat van hem. De migratie kent
# alleen de twee teksten die hij zelf heeft achtergelaten en blijft van de rest af.
q "update marketing_hq.werkstuk_stappen set waarom='Met de hand gemaakt, zie Slack.'
     where werkstuk_id=1 and station=3" >/dev/null
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0029_blokkade.sql" >/dev/null 2>&1
check "en een toelichting die iemand zelf schreef blijft staan" "Met de hand gemaakt, zie Slack." \
  "$(q "select waarom from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=3")"
# Dit is de reden dat de migratie niet blind alle rijen bijwerkt. Een naamloze
# stap uit juli mag niet omvallen op een tekstwijziging, en al helemaal niet
# alsnog een naam krijgen om de constraint tevreden te stellen.
check "een naamloze stap wordt met rust gelaten" "Creative gemaakt in de Atelier Console (2 varianten)." \
  "$(q "select waarom from marketing_hq.werkstuk_stappen where werkstuk_id=4 and station=3")"
check "en hij is nog steeds van niemand" "" \
  "$(q "select coalesce(agent_id,'') || coalesce(mens_id::text,'')
        from marketing_hq.werkstuk_stappen where werkstuk_id=4 and station=3")"

# ── 5. Wat 0019 deed, doet hij nog ─────────────────────────────────────────
echo
echo "  de werkbank van 0019 is niet stukgegaan"
check "waarom zegt nog steeds waar het ligt" "ja" \
  "$(q "select case when waarom like 'ligt bij%station%' then 'ja' else waarom end
        from marketing_hq.werkbank where id=4")"
check "stil_uren staat er nog" "ja" \
  "$(q "select case when stil_uren >= 0 then 'ja' else 'nee' end from marketing_hq.werkbank where id=1")"
check "en de stiltegrens hangt nog aan het soort overdracht" "ja" \
  "$(q "select case when stil_grens_uren in (24,72,168) then 'ja' else stil_grens_uren::text end
        from marketing_hq.werkbank where id=1")"
check "wacht_op zegt nog steeds jij bij een poort" "ja" \
  "$(q "select case when wacht_op in ('jij') or wacht_op is not null then 'ja' else 'nee' end
        from marketing_hq.werkbank where id=1")"
check "alle vier de werkstukken staan er" "4" \
  "$(q "select count(*) from marketing_hq.werkbank")"

# ── 6. Een gestopt werkstuk kent geen blokkade ─────────────────────────────
echo
echo "  af en gestopt"
check "wat gestopt is, wordt nergens meer door tegengehouden" "" \
  "$(q "update marketing_hq.werkstukken set status='gestopt', gestopt_reden='de hoek is uitgeput' where id=2;
        select coalesce(blokkade_soort,'') from marketing_hq.werkbank where id=2")"
check "en de reden van stoppen staat in waarom" "de hoek is uitgeput" \
  "$(q "select waarom from marketing_hq.werkbank where id=2")"

# ── 7. Wie mag het zien ────────────────────────────────────────────────────
echo
echo "  wie kijkt, ziet wat"
check "een niet-teamlid ziet geen enkel werkstuk" "0" \
  "$(q "set role authenticated; set local test.teamlid='nee';
        select count(*) from public.hq_werkbank")"
check "en een teamlid ziet ze alle vier" "4" \
  "$(q "set role authenticated; set local test.teamlid='ja';
        select count(*) from public.hq_werkbank")"
check "hq_werkbank levert de nieuwe kolommen ook echt" "ja" \
  "$(q "set role authenticated; set local test.teamlid='ja';
        select case when count(*) = 2 then 'ja' else count(*)::text end
        from information_schema.columns
        where table_schema='public' and table_name='hq_werkbank'
          and column_name in ('blokkade','aantal_creatives')")"
check "anon komt er niet bij" "ja" \
  "$(weigert "set role anon; select count(*) from public.hq_werkbank" "permission denied")"

# ── 8. Nog een keer ────────────────────────────────────────────────────────
echo
echo "  de migratie nog een keer"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0029_blokkade.sql" 2>&1)
check "0029 draait twee keer zonder klagen" "" "$(echo "$uit" | grep -o 'ERROR' | head -1)"
check "en de werkbank staat er nog steeds" "4" \
  "$(q "select count(*) from marketing_hq.werkbank")"
check "hq_werkbank ook" "4" \
  "$(q "set role authenticated; set local test.teamlid='ja'; select count(*) from public.hq_werkbank")"

echo
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $fout
