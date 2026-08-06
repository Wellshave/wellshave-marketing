#!/usr/bin/env bash
# Testlus voor migratie 0035 en de import van de Creative Strategy Map.
# (0011 heeft zijn eigen lus in tracker.sh — die gaat over de datalaag eronder.)
#
# Er zijn drie dingen die hier stuk kunnen, en ze zijn alle drie stil:
#
# 1. De deur. `creatives_public_read` liet iedereen met de publieke sleutel de
#    hele tabel lezen. Dat is nagemeten voordat 0035 werd geschreven en het gaf
#    alle rijen terug. Een test die alleen kijkt of de policy weg is, dekt dat
#    niet: het gaat erom dat anon niets meer ziet en een goedgekeurd teamlid
#    alles nog wel. Beide staan hieronder.
#
# 2. De vertaling. De sheet kent To Test/Killed/Iterate, de database kent sinds
#    0031 tien Nederlandse statussen met een foreign key erop. Een fout in die
#    map levert geen verkeerde data op maar een geweigerde insert -- behalve bij
#    'Killed', want 'Verliezer' bestaat en 'Gestopt' ook, en allebei gaan er
#    doorheen. Daarom staat de verwachte verdeling per status hier uitgeschreven.
#
# 3. Het tellen. De breakdown in de sheet telt tegen een vaste lijst en laat
#    vallen wat er niet op staat: Per Persona staat op nul terwijl er 624 rijen
#    met een persona zijn. De test eist daarom dat de som van een dimensie
#    gelijk is aan het aantal rijen -- de enige controle die dat soort stil
#    verlies vangt.
#
#   bash platform/db/test/import-tracker.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
IMPDIR="$(cd "$(dirname "$0")/../import" && pwd)"
WERK="${TMPDIR:-/tmp}/import-tracker-test-$$"
PORT=${PGTESTPORT:-5523}
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
export PATH="$PATH:$BIN"
UID_PG=$(id -un postgres 2>/dev/null || echo "$(id -un)")

fout=0
check() {
  if [ "$2" = "$3" ]; then printf '  ok   %s\n' "$1"
  else fout=$((fout+1)); printf '  FOUT %s\n       verwacht %s\n       kreeg    %s\n' "$1" "$2" "$3"; fi
}
q() { psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c "$1" 2>/dev/null \
      | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'; }

opruimen() { su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -m immediate stop" >/dev/null 2>&1; rm -rf "$WERK"; }
trap opruimen EXIT

mkdir -p "$WERK"; chown -R "$UID_PG" "$WERK" 2>/dev/null
su "$UID_PG" -c "$BIN/initdb -D $WERK -U postgres -A trust --locale=C -E UTF8" >/dev/null 2>&1 || {
  echo "  initdb mislukt -- staat postgres geinstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

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
  account_id text, ad_id text, ad_name text, creative_id bigint, agent_id text, run_id bigint,
  verdict text, action text, reasoning text, confidence numeric(3,2),
  metrics_snapshot jsonb, window_days int default 7, status text default 'open',
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

# De productiestand nabouwen vóór de migratie draait. `creatives_public_read`
# staat in geen enkele migratie -- hij is ooit met de hand aangemaakt, net als
# hq_reports vóór 0034. Zonder deze regels test 0035 het weghalen van iets dat
# er niet is, en dan is de test groen om de verkeerde reden.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null
create schema if not exists auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
alter table public.creatives enable row level security;
create policy creatives_public_read on public.creatives for select using (true);
create policy creatives_select on public.creatives for select using (exists (
  select 1 from public.team_members m where m.id = auth.uid() and m.status = 'approved'));
grant select, insert, update, delete on public.creatives to anon, authenticated;
SQL

for m in 0008_terugkoppeling 0009_ruggengraat 0011_tracker 0012_atlas 0013_audit 0017_views \
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus 0029_blokkade 0030_testklaar 0031_statusvocabulaire 0033_bibliotheekkoppeling 0035_tracker; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  alle migraties draaien (t/m 0035)"

echo
echo "  de deur die openstond"
check "de publieke leespolicy is weg" "0" \
  "$(q "select count(*) from pg_policy where polrelid='public.creatives'::regclass and polname='creatives_public_read'")"
check "anon heeft geen enkel recht meer op creatives" "0" \
  "$(q "select count(*) from information_schema.role_table_grants
        where table_schema='public' and table_name='creatives' and grantee='anon'")"
check "anon kan de tabel niet lezen" "f" \
  "$(q "select has_table_privilege('anon','public.creatives','select')")"
check "een goedgekeurd teamlid nog wel" "t" \
  "$(q "select has_table_privilege('authenticated','public.creatives','select')")"
check "creatives_select staat er nog" "1" \
  "$(q "select count(*) from pg_policy where polrelid='public.creatives'::regclass and polname='creatives_select'")"

echo
echo "  de import"
python3 "$IMPDIR/naar-sql.py" > "$WERK/import.sql" 2>/dev/null
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$WERK/import.sql" 2>&1)
check "de import draait zonder fout" "0" "$?"
[ $fout -eq 0 ] || echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3
check "624 rijen binnen" "624" "$(q "select count(*) from public.creatives where bron_bestand is not null")"

# De foreign key uit 0030/0032 keurt elke status. Een verkeerde vertaling komt
# er dus niet als foute data doorheen maar als geweigerde insert -- behalve waar
# twee bestaande woorden allebei passen. Vandaar de verdeling, uitgeschreven.
check "Verliezer (was Killed)"   "203" "$(q "select count(*) from public.creatives where status='Verliezer'")"
check "Live"                      "58" "$(q "select count(*) from public.creatives where status='Live'")"
check "Winner"                    "10" "$(q "select count(*) from public.creatives where status='Winner'")"
check "Itereren (was Iterate)"    "55" "$(q "select count(*) from public.creatives where status='Itereren'")"
check "Concept (To Test + leeg)" "298" "$(q "select count(*) from public.creatives where status='Concept' and bron_bestand is not null")"

echo
echo "  wat er niet mag verdwijnen"
check "het oorspronkelijke statuswoord blijft bewaard" "296" \
  "$(q "select count(*) from public.creatives where bron_status='To Test'")"
check "en een rij zonder status is terug te vinden" "2" \
  "$(q "select count(*) from public.creatives where bron_bestand is not null and bron_status is null")"
# De tekstuitdraai van Drive sloopte elk accentteken: 'één' werd ' n'. Dat kwam
# pas boven water door te tellen, niet door te kijken. Daarom staat het hier.
check "accenttekens staan er nog in" "t" \
  "$(q "select desires like '%één%' from public.creatives where ad_name='001-1' limit 1")"
check "hook rate is een verhouding en geen procent" "0.25" \
  "$(q "select hook_rate from public.creatives where ad_name='001-1' limit 1")"
check "de tien onmogelijke hook rates gaan mee zoals ze zijn" "10" \
  "$(q "select count(*) from public.creatives where hook_rate > 1.5")"
# 0030 laat geen twee advertenties met dezelfde naam binnen één merk toe. De
# sheet heeft drie rijen die '144-1' heten; de import hernoemt de tweede en
# derde met hun bronregel erachter in plaats van ze te laten vallen.
check "de dubbele naam is opgelost, niet weggegooid" "3" \
  "$(q "select count(*) from public.creatives where ad_name like '144-1%'")"
check "en het origineel staat er nog bij" "1" \
  "$(q "select count(*) from public.creatives where ad_name = '144-1'")"
# Het analyseblok onder de advertenties heeft ook rijen met tekst in de
# naamkolom. Komt dat mee, dan staan er kopregels als advertentie in de tracker.
check "geen kopregel uit het analyseblok geimporteerd" "0" \
  "$(q "select count(*) from public.creatives where ad_name in ('Item','Multiple','Per Persona')")"

echo
echo "  het tellen"
# Dit is de controle die de sheet niet had. Valt er ergens iets stil weg, dan
# telt de dimensie niet meer op tot het aantal rijen.
for d in product awareness_level media_type format persona angle_type; do
  check "dimensie $d telt op tot alle rijen" \
    "$(q "select count(*) from public.creatives")" \
    "$(q "select coalesce(sum(aantal),0) from marketing_hq.tracker_breakdown where dimensie='$d'")"
done
check "wat niet ingevuld is krijgt een eigen regel" "t" \
  "$(q "select exists (select 1 from marketing_hq.tracker_breakdown where waarde='— niet ingevuld')")"
check "geen enkele rij heeft een score" "0" \
  "$(q "select coalesce(sum(met_score),0) from marketing_hq.tracker_breakdown where dimensie='product'")"
check "en de tracker zegt dat er niets gemeten is" "0" \
  "$(q "select coalesce(sum(met_meting),0) from marketing_hq.tracker_breakdown where dimensie='product'")"

echo
echo "  nog een keer draaien verdubbelt niets"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$WERK/import.sql" >/dev/null 2>&1
check "nog steeds 624 rijen" "624" "$(q "select count(*) from public.creatives where bron_bestand is not null")"
check "de terugweg werkt" "0" \
  "$(q "delete from public.creatives where bron_bestand is not null; select count(*) from public.creatives where bron_bestand is not null")"

echo
[ $fout -eq 0 ] && echo "Alles klopt" || echo "$fout controle(s) mislukt"
exit $((fout > 0))
