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

# Lezen zoals de console het doet: als `authenticated`, met een goedgekeurd
# teamlid in auth.uid(). Alle andere controles hier draaien als `postgres`, en
# die is superuser -- die gaat langs elke grant en elke policy heen. Precies
# daardoor kon de tracker groen zijn in de test en leeg op productie met
# "permission denied for table benchmarks".
alsTeamlid() {
  # In een transactie, anders klaagt `set local` en verdrinkt de uitkomst in
  # waarschuwingen.
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA 2>&1 <<SQL | tr '\n' ' '
begin;
set local role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
set local test.teamlid = 'ja';
$1
rollback;
SQL
}

# Dezelfde rol, maar met commit. `alsTeamlid` rolt met opzet terug zodat een
# leescontrole niets achterlaat; een schrijfcontrole heeft juist nodig dat het
# blijft staan, anders test je of een functie 1 teruggeeft en niet of er iets
# gebeurt.
alsTeamlidSchrijf() {
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA 2>&1 <<SQL | tr '\n' ' '
begin;
set local role authenticated;
set local test.uid = '$2';
set local test.teamlid = 'ja';
$1
commit;
SQL
}

weigert() {
  local uit; uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c "$1" 2>&1 | tr '\n' ' ')
  case "$uit" in *"$2"*) echo ja ;; *ERROR*) echo "andere fout: $uit" ;; *) echo nee ;; esac
}

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
-- Productie geeft authenticated leesrecht op deze twee (0016/0017). De fixture
-- deed dat niet, en daardoor kon een view die eroverheen ligt hier groen zijn
-- en op productie "permission denied" geven -- precies wat er met de tracker
-- gebeurde. Een fixture die ruimer of krapper is dan productie test iets anders.
grant select on marketing_hq.meta_insights_daily, marketing_hq.meta_publications to authenticated;
alter table marketing_hq.meta_insights_daily enable row level security;
alter table marketing_hq.meta_publications   enable row level security;
create policy lezen on marketing_hq.meta_insights_daily for select using (marketing_hq.is_team_member());
create policy lezen on marketing_hq.meta_publications   for select using (marketing_hq.is_team_member());
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

# De controle hierboven heeft de tabel leeggehaald. Alles wat hierna komt gaat
# over de geimporteerde rijen, dus die moeten er weer in -- anders slagen de
# tellingen hieronder op een lege tabel, en dat is geen bewijs maar een leegte.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$WERK/import.sql" >/dev/null 2>&1
check "de rijen staan er weer in" "624" \
  "$(q "select count(*) from public.creatives where bron_bestand is not null")"

echo
echo "  de nieuwe werkwijze geldt vanaf de nieuwe creatives"
# Dit is de kern van de uitzondering uit 0035, en het is de regressie die je
# niet ziet: als hij te ruim staat, glipt voortaan elke nieuwe creative langs
# de eis uit 0030 en merk je dat pas als er niets meer wordt vastgelegd.
check "een nieuwe creative kan niet live zonder hypothese" "ja" \
  "$(weigert "insert into public.creatives (brand, ad_name, product, status)
              values ('wellshave','proef-nieuw','Groom Guard','Live')" 'niet testklaar')"
check "ook niet met alleen een hypothese" "ja" \
  "$(weigert "insert into public.creatives (brand, ad_name, product, status, hypothesis)
              values ('wellshave','proef-nieuw-2','Groom Guard','Live','als we X, dan Y, omdat Z')" 'werkstuk')"
check "een geimporteerde rij mag er wel in" "ja" \
  "$(q "insert into public.creatives (brand, ad_name, product, status, bron_bestand)
        values ('wellshave','proef-bron','Groom Guard','Live','1. Creative Strategy Map.xlsx')
        returning 'ja'")"
# en zodra iemand zo'n rij verder helpt, geldt de eis alsnog
check "maar hem daarna verplaatsen kan niet zomaar" "ja" \
  "$(weigert "update public.creatives set status='Winner' where ad_name='proef-bron'" 'niet testklaar')"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -c "delete from public.creatives where ad_name like 'proef-%'" >/dev/null 2>&1

echo
echo "  0036: de banden en het invullen"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0036_benchmarks.sql" 2>&1)
check "0036 draait zonder fout" "0" "$?"
[ $fout -eq 0 ] || echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3

check "0,25 is prima"                    "prima"      "$(q "select marketing_hq.benchmark_band('hook_rate', 0.25)")"
check "0,34 is goed"                     "goed"       "$(q "select marketing_hq.benchmark_band('hook_rate', 0.34)")"
check "0,42 is uitstekend"               "uitstekend" "$(q "select marketing_hq.benchmark_band('hook_rate', 0.42)")"
check "0,19 is matig"                    "matig"      "$(q "select marketing_hq.benchmark_band('hook_rate', 0.19)")"
# De sheet kleurt 1233% donkergroen. Dat is de fout die deze functie niet maakt.
check "12,33 is onmogelijk, niet uitstekend" "onmogelijk" "$(q "select marketing_hq.benchmark_band('hook_rate', 12.33)")"
check "nul krijgt geen oordeel"          ""           "$(q "select marketing_hq.benchmark_band('hook_rate', 0)")"
check "leeg krijgt geen oordeel"         ""           "$(q "select marketing_hq.benchmark_band('hook_rate', null)")"
check "de grens hoort bij de bovenste band" "goed"    "$(q "select marketing_hq.benchmark_band('hook_rate', 0.30)")"
check "ctr heeft eigen grenzen"          "prima"      "$(q "select marketing_hq.benchmark_band('ctr', 0.01)")"

# Invullen mag alleen waar het een opzoeking is. Deze drie tellingen zijn de
# hele afspraak: eenduidig wel, dubbelzinnig niet, geen bron niet.
check "er zijn Groom Guard-rijen om over te oordelen" "275" \
  "$(q "select count(*) from public.creatives where product='Groom Guard'")"
check "Groom Guard heeft nergens meer een gat" "0" \
  "$(q "select count(*) from public.creatives where product='Groom Guard' and breakeven_roas is null")"
check "Groom Guard PRO blijft leeg waar het dubbelzinnig is" "3" \
  "$(q "select count(*) from public.creatives where product='Groom Guard PRO' and breakeven_roas is null")"
check "een product zonder enige waarde blijft leeg" "9" \
  "$(q "select count(*) from public.creatives where product='Alle producten' and breakeven_roas is null")"
check "en er is nog steeds geen enkele score verzonnen" "0" \
  "$(q "select count(*) from public.creatives where score is not null")"

echo
echo "  0037: de trackerrij"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0037_trackerrij.sql" 2>&1)
check "0037 draait zonder fout" "0" "$?"
[ $fout -eq 0 ] || echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3

# De oude kolommen mogen niet verschuiven: alles wat nu select * doet rekent
# op de volgorde uit 0011.
check "de eerste achttien kolommen staan nog op hun plek" \
  "id,brand,werkstuk_id,ad_name,product,persona,angle_type,format,media_type,hook_short,awareness_level,marketing_angle,creative_concept,status,score,next_step,date_live,notes" \
  "$(q "select string_agg(column_name, ',' order by ordinal_position)
        from information_schema.columns
        where table_schema='public' and table_name='hq_creative_kaart' and ordinal_position <= 18")"
check "de nieuwe kolommen zijn er ook in de publieke view" "t" \
  "$(q "select count(*) = 12 from information_schema.columns
        where table_schema='public' and table_name='hq_creative_kaart'
          and column_name in ('desires','channel','audience','budget','conversions','breakeven_roas',
                              'target_roas','hook_band','hold_band','ctr_band','cvr_band','boven_breakeven')")"

# Het oordeel komt uit de database en niet uit het scherm. Zonder deze twee
# kan een browser zijn eigen grenzen gaan bijhouden.
check "een hook rate van 0,3422 heet goed"  "goed"       \
  "$(q "select hook_band from marketing_hq.creative_kaart where ad_name='003-1'")"
check "en 0,25 heet prima"                  "prima"      \
  "$(q "select hook_band from marketing_hq.creative_kaart where ad_name='001-1'")"
check "de tien invoerfouten heten onmogelijk" "10"       \
  "$(q "select count(*) from marketing_hq.creative_kaart where hook_band='onmogelijk'")"

# 003-1 heeft ROAS 1,82 bij een break-even van 1,90: net eronder. Dat is de
# rij waar een verkeerde vergelijkingsrichting zich zou verstoppen.
check "1,82 bij break-even 1,90 is eronder" "f" \
  "$(q "select boven_breakeven from marketing_hq.creative_kaart where ad_name='003-1'")"
check "een ROAS van nul krijgt geen oordeel" "" \
  "$(q "select boven_breakeven from marketing_hq.creative_kaart where ad_name='001-1'")"
check "zonder break-even ook niet" "0" \
  "$(q "select count(*) from marketing_hq.creative_kaart
        where breakeven_roas is null and boven_breakeven is not null")"

echo
echo "  0038: handmatig blijft kunnen"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0038_handmatig.sql" 2>&1)
check "0038 draait zonder fout" "0" "$?"
[ $fout -eq 0 ] || echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3

# Een gemeten rij naast een handmatige, zodat de voorrang te zien is.
# creative_results is een view over ad_totals, niet een tabel: een meting
# ontstaat uit een publicatie plus dagcijfers. Rechtstreeks in de view prikken
# lukt niet en zou ook niet meten wat er in productie gebeurt.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
update public.creatives set roas = 1.10, hook_rate = 0.10 where ad_name = '003-1';
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, account_id, published_at)
select id, 'ad-003-1', '242238038391551', now() - interval '10 days'
  from public.creatives where ad_name = '003-1';
-- spend 100 met 999 omzet geeft roas 9,99; 9000 starts op 10000 vertoningen
-- geeft hook rate 0,90. Ronde getallen, zodat een afwijking een fout is en
-- geen afrondingsverschil.
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, spend, impressions, clicks,
   link_clicks, purchases, purchase_value, video_3s, video_thruplay, is_final)
values
  (current_date - 5, '242238038391551', 'ad', 'ad-003-1', 100, 10000, 200,
   180, 10, 999, 9000, 4500, true);
SQL
check "zonder vastzetten wint de meting" "9.990" \
  "$(q "select roas from marketing_hq.creative_kaart where ad_name='003-1'")"
check "en dat staat er ook bij" "meta" \
  "$(q "select cijfers_bron from marketing_hq.creative_kaart where ad_name='003-1'")"

# Nu zet een mens het cijfer vast, omdat de meting niet klopt.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
update public.creatives
   set cijfers_vastgezet = true,
       cijfers_vastgezet_door = '11111111-1111-1111-1111-111111111111',
       cijfers_vastgezet_op = now()
 where ad_name = '003-1';
SQL
check "vastgezet wint de handmatige waarde" "1.10" \
  "$(q "select roas from marketing_hq.creative_kaart where ad_name='003-1'")"
check "de bron zegt dat het vastgezet is" "handmatig-vast" \
  "$(q "select cijfers_bron from marketing_hq.creative_kaart where ad_name='003-1'")"
check "met de naam van wie dat deed" "Dustin Gibson" \
  "$(q "select cijfers_vastgezet_naam from marketing_hq.creative_kaart where ad_name='003-1'")"
# Zonder dit is niet te zien hoe ver de correctie van de meting af staat, en
# dan is vastzetten een vrijbrief in plaats van iets wat iemand kan nakijken.
check "en de meting blijft zichtbaar naast de correctie" "9.990" \
  "$(q "select gemeten_roas from marketing_hq.creative_kaart where ad_name='003-1'")"
# Het oordeel volgt de vastgezette waarde, niet de meting: anders staat er een
# groen bandje bij een getal dat er niet meer staat.
check "de band volgt het vastgezette cijfer" "matig" \
  "$(q "select hook_band from marketing_hq.creative_kaart where ad_name='003-1'")"

check "vastzetten zonder naam kan niet" "ja" \
  "$(weigert "update public.creatives set cijfers_vastgezet = true
              where ad_name = '001-1'" 'creatives_vastzetten_heeft_naam')"

echo
echo "  0038: doet de sync het nog"
# Drie toestanden, en het verschil ertussen is de hele reden dat deze view
# bestaat. Er staat nu een verse meting van de fixture hierboven.
check "met een verse meting: werkt" "werkt" \
  "$(q "select toestand from marketing_hq.meta_sync_status")"

# Dit is het geval dat twee dagen onzichtbaar bleef: de worker draait, het
# token werkt, en er komt niets binnen. "geen cijfers" en "de sync ligt eruit"
# zijn verschillende dingen, en alleen het tweede vraagt om ingrijpen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
insert into marketing_hq.agent_events (agent_id, level, message, data)
values ('atlas','warn','Meta gaf geen cijfers voor Wellshave®: (#100) veld_x is not valid',
        '{"fout":"(#100) veld_x is not valid for fields param"}'::jsonb);
SQL
check "niets binnen maar wel klachten: kapot" "kapot" \
  "$(q "select toestand from marketing_hq.meta_sync_status")"
check "en de fout staat er leesbaar bij, niet alleen dat het misging" "t" \
  "$(q "select laatste_fout like '%not valid for fields param%' from marketing_hq.meta_sync_status")"
check "met een teller hoe vaak het vandaag misging" "1" \
  "$(q "select mislukte_pogingen_36u from marketing_hq.meta_sync_status")"

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 \
  -c "delete from marketing_hq.agent_events where message like 'Meta gaf geen cijfers%'"
check "niets binnen en geen klacht: nooit gedraaid" "nooit gedraaid" \
  "$(q "select toestand from marketing_hq.meta_sync_status")"

echo
echo "  0039: kan het team het scherm ook echt lezen"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0039_rechten.sql" >/dev/null 2>&1
check "0039 draait zonder fout" "0" "$?"

# Dit is de controle die ontbrak. Niet has_table_privilege -- dat is een vraag
# over rechten -- maar echt een rij ophalen als de rol die het scherm gebruikt.
# Elke hq_*-view apart, want ze hangen aan verschillende tabellen en falen dus
# ook apart.
for v in hq_creative_kaart hq_tracker_breakdown hq_benchmarks hq_meta_sync_status; do
  uit=$(alsTeamlid "select 1 from public.$v limit 1;")
  case "$uit" in
    *ERROR*|*"permission denied"*)
      fout=$((fout+1))
      printf '  FOUT %s is niet leesbaar voor een teamlid\n       %s\n' "$v" "$(echo "$uit" | head -c 150)" ;;
    *) printf '  ok   %s is leesbaar voor een teamlid\n' "$v" ;;
  esac
done

# En de tabel vier lagen diep waar het op stukliep: benchmark_band() leest hem,
# creative_kaart roept die functie aan, en de view eromheen draait op de
# rechten van wie kijkt.
uit=$(alsTeamlid "select marketing_hq.benchmark_band('hook_rate', 0.34);")
case "$uit" in
  *goed*) echo "  ok   het oordeel werkt ook onder de rechten van een teamlid" ;;
  *) fout=$((fout+1)); printf '  FOUT benchmark_band mislukt als teamlid\n       %s\n' "$(echo "$uit" | head -c 150)" ;;
esac

# De andere kant: wie geen teamlid is, ziet nog steeds niets.
geenLid=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA 2>&1 <<'SQL' | tr -d '\n '
begin;
set local role authenticated;
set local test.teamlid = 'nee';
select count(*) from marketing_hq.benchmarks;
rollback;
SQL
)
check "een ingelogde niet-teamlid ziet geen benchmarks" "0" "$geenLid"

echo
echo "  0040: de teampagina"
# auth.uid() is in de fixture een stub die test.uid leest; de view gebruikt hem
# om te bepalen wie er kijkt.
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0040_teampagina.sql" 2>&1)
check "0040 draait zonder fout" "0" "$?"
[ $fout -eq 0 ] || echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into public.team_members (id, email, full_name, status, role) values
  ('22222222-2222-2222-2222-222222222222','willem@wellshave.com','Willem de Groot','approved','member'),
  ('33333333-3333-3333-3333-333333333333','nieuw@wellshave.com','Nog Niet Goedgekeurd','pending','member');
SQL

check "mensen en agents staan in dezelfde lijst" "10 2" \
  "$(alsTeamlid "select count(*) filter (where soort='agent') || ' ' ||
                        count(*) filter (where soort='mens') from public.hq_team;" | tr -s ' ' | sed 's/ *$//')"
# Dit was het hele probleem: de tabelpolicy laat een teamlid alleen zichzelf
# zien, dus zonder de view zou Willem hier alleen Willem vinden.
check "een teamlid ziet zijn collega ook" "1" \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA 2>&1 <<'SQL' | tr -d '\n '
begin;
set local role authenticated;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) from public.hq_team where naam = 'Dustin Gibson';
rollback;
SQL
)"
check "wie nog op goedkeuring wacht staat er niet in" "0" \
  "$(alsTeamlid "select count(*) from public.hq_team where naam like 'Nog Niet%';" | tr -d ' ')"

# Een definer-view laat zonder deze controle iedereen alles zien.
geenLid=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA 2>&1 <<'SQL' | tr -d '\n '
begin;
set local role authenticated;
set local test.uid = '99999999-9999-9999-9999-999999999999';
select count(*) from public.hq_team;
rollback;
SQL
)
check "wie geen teamlid is ziet niemand" "0" "$geenLid"

# Wat er niet doorheen mag komen: het is een directory, geen ledenadministratie.
check "geen e-mailadres in de view" "0" \
  "$(q "select count(*) from information_schema.columns
        where table_schema='public' and table_name='hq_team'
          and column_name in ('email','status','is_admin')")"

echo
echo "  0040: jezelf voorstellen"
check "een teamlid kan zichzelf voorstellen" "true" \
  "$(alsTeamlidSchrijf "select public.hq_stel_jezelf_voor('{\"voorstellen\":\"Ik doe de merkkant.\",\"rol_titel\":\"Merkstrateeg\"}'::jsonb)->>'ok';" '11111111-1111-1111-1111-111111111111' | tr -d ' ')"
check "en het staat er ook echt" "Ik doe de merkkant." \
  "$(q "select voorstellen from public.team_members where id='11111111-1111-1111-1111-111111111111'")"
check "de roltitel komt in de lijst terecht" "Merkstrateeg" \
  "$(alsTeamlid "select rol from public.hq_team where naam='Dustin Gibson';" | sed 's/^ *//; s/ *$//')"

# De valkuil waar een policy in getrapt zou zijn: RLS werkt per rij, niet per
# kolom. Wie zijn eigen introductie mag schrijven, mag daarmee niet ook zijn
# eigen rechten opschroeven.
check "maar niet zijn eigen rechten opschroeven" "f" \
  "$(alsTeamlidSchrijf "select public.hq_stel_jezelf_voor('{\"voorstellen\":\"x\",\"is_admin\":true,\"status\":\"approved\",\"role\":\"admin\"}'::jsonb);" '22222222-2222-2222-2222-222222222222' >/dev/null 2>&1; q "select coalesce(is_admin,false) from public.team_members where id='22222222-2222-2222-2222-222222222222'")"
# Twee mensen hebben nu zichzelf voorgesteld, elk hun eigen rij: de functie
# schrijft altijd in de rij van wie hem aanroept en nergens anders.
check "ieder schrijft alleen in zijn eigen rij" "Ik doe de merkkant.|x" \
  "$(q "select string_agg(voorstellen, '|' order by id) from public.team_members where voorstellen is not null")"

# De introductie van een agent mag geen cadans of status noemen: die staan in
# de data ernaast en veranderen zonder dat de tekst meeverandert.
check "geen agent noemt een tijdstip in zijn introductie" "0" \
  "$(q "select count(*) from marketing_hq.agents
        where voorstellen ~ '[0-9]{1,2}:[0-9]{2}'")"
check "alle tien stellen zich voor" "10" \
  "$(q "select count(*) from marketing_hq.agents where voorstellen is not null")"
check "Echo zegt zelf dat hij uitstaat" "t" \
  "$(q "select voorstellen like '%sta ik uit%' from marketing_hq.agents where id='echo'")"

echo
echo "  0041: werkt is niet hetzelfde als meet"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0041_meetdekking.sql" >/dev/null 2>&1
check "0041 draait zonder fout" "0" "$?"

# De situatie van 7 augustus, nagespeeld: data op account- en campagneniveau,
# niets op advertentieniveau, geen publicatie om aan te koppelen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
delete from marketing_hq.meta_publications;
delete from marketing_hq.agent_events where message like 'Meta gaf geen cijfers%';
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, spend, impressions, video_3s, video_thruplay)
values (current_date - 1, '242238038391551', 'account',  '242238038391551', 200, 20000, 9000, 2000),
       (current_date - 1, '242238038391551', 'campaign', 'c-1',              120, 12000, 5000, 1200);
SQL
check "de koppeling heet werkend"            "werkt" \
  "$(q "select toestand from marketing_hq.meta_sync_status")"
# En precies dat is de valkuil: 'werkt' terwijl de tracker niets ziet.
check "maar er is niets op advertentieniveau" "0" \
  "$(q "select metingen_advertentieniveau from marketing_hq.meta_sync_status")"
check "en niets om aan te koppelen"           "0" \
  "$(q "select gekoppelde_advertenties from marketing_hq.meta_sync_status")"
check "de niveaus staan er in woorden bij"    "account, campaign" \
  "$(q "select gemeten_niveaus from marketing_hq.meta_sync_status")"

# Zodra er wel op advertentieniveau gemeten wordt en er een publicatie is,
# telt de dekking mee.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, spend, impressions)
values (current_date - 1, '242238038391551', 'ad', 'ad-1', 60, 6000);
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, account_id, published_at)
select id, 'ad-1', '242238038391551', now() - interval '5 days'
  from public.creatives where ad_name = '001-1';
SQL
check "met een ad-meting telt de dekking mee" "1" \
  "$(q "select metingen_advertentieniveau from marketing_hq.meta_sync_status")"
check "en de koppeling ook"                   "1" \
  "$(q "select gekoppelde_advertenties from marketing_hq.meta_sync_status")"
# Een publicatie zonder meta_ad_id is geen koppeling: dan is een ad-meting een
# getal zonder eigenaar.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 \
  -c "update marketing_hq.meta_publications set meta_ad_id = null where meta_ad_id = 'ad-1'"
check "zonder meta_ad_id telt hij niet mee"   "0" \
  "$(q "select gekoppelde_advertenties from marketing_hq.meta_sync_status")"

echo
echo "  0042: de map aan Meta knopen op naam"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0042_naamkoppeling.sql" >/dev/null 2>&1
check "0042 draait zonder fout" "0" "$?"

# De vertaler, tegen namen die letterlijk zo in het Wellshave-account staan.
# Verzonnen voorbeelden zouden hier niets bewijzen: het gaat er juist om dat
# vier verschillende schrijfwijzen van hetzelfde nummer op één sleutel uitkomen.
sleutel() { q "select coalesce(marketing_hq.meta_naam_sleutel(\$\$$1\$\$), '—')"; }

check "WS-061 - 3 - ASC+ wordt 61:3"          "61:3"     "$(sleutel 'WS-061 - 3 - ASC+')"
check "WS - 110 - 2 wordt 110:2"              "110:2"    "$(sleutel 'WS - 110 - 2')"
check "005 - 3 wordt 5:3"                     "5:3"      "$(sleutel '005 - 3')"
check "@WS-037 - 3 wordt 37:3"                "37:3"     "$(sleutel '@WS-037 - 3')"
check "@WS038 -1 wordt 38:1"                  "38:1"     "$(sleutel '@WS038 -1')"
check "WS - 103 - 2 - Copy 2 wordt 103:2"     "103:2"    "$(sleutel 'WS - 103 - 2 - Copy 2')"
# De halve kastlijn komt echt voor in het account en ziet er identiek uit.
check "een kastlijn telt als streepje"        "34:2"     "$(sleutel 'WS-034 - 2 – Copy 2')"
# En de map-kant moet op exact dezelfde sleutel uitkomen, anders koppelt er niets.
check "de map schrijft 061-3 en bedoelt 61:3" "61:3"     "$(sleutel '061-3')"

# De reeksen zitten ín de sleutel. Zonder dat zou € 691 aan BFCM-spend op een
# map-rij van € 18 belanden.
check "BFCM houdt zijn eigen reeks"           "BFCM:2:2" "$(sleutel 'WS - BFCM - 002 - 2')"
check "ook met een dubbele spatie"            "BFCM:34:1" "$(sleutel 'WS - BFCM  - 034 - 1')"
check "de C-reeks ook"                        "C:36:1"   "$(sleutel 'WS - C - 036 - 1')"
check "en BFCM raakt de gewone reeks niet"    "f" \
  "$(q "select marketing_hq.meta_naam_sleutel('WS - BFCM - 002 - 2')
             = marketing_hq.meta_naam_sleutel('002-2')")"

# Liever niets dan een gok. Deze vier zijn geen losse creative.
check "een FLEX-bundel krijgt geen sleutel"   "—" "$(sleutel '@WS052 -> FLEX (4 Videos) Herfst')"
check "twee nummers in één ad ook niet"       "—" "$(sleutel 'WS - BFCM - 045 & 046 - FLEX')"
check "een pijl is geen variantnummer"        "—" "$(sleutel '@WS046 -> 3')"
check "en Catalog Ads hoort niet in de map"   "—" "$(sleutel 'Catalog Ads -> 2')"

# Nu de koppeling zelf. Creative 061-3 draaide onder vier namen; de map kende
# alleen de eerste. Opgeteld is het viervoud, en dat is de hele reden voor 0042.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
delete from marketing_hq.meta_publications;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, purchases, purchase_value, is_final)
values
  (current_date - 6, '242238038391551', 'ad', 'a1', 'WS-061 - 3',              567.29,  94334, 10, 1661.16, true),
  (current_date - 5, '242238038391551', 'ad', 'a2', 'WS-061 - 3 - ASC+',      9473.42, 1498744, 200, 28000.00, true),
  (current_date - 4, '242238038391551', 'ad', 'a3', 'WS-061 - 3 - ASC+ - Copy', 310.32,  80981,  5,  700.00, true),
  (current_date - 3, '242238038391551', 'ad', 'a4', 'WS - BFCM - 061 - 3',     999.99,  50000, 30, 5000.00, true),
  (current_date - 3, '242238038391551', 'ad', 'a5', 'Catalog Ads -> 2',        192.96,  20851,  4,  600.00, true);
SQL

check "de vier varianten tellen als één creative" "1" \
  "$(q "select count(*) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = '061-3'")"
# 567,29 + 9473,42 + 310,32 = 10351,03. De map stond op 567,29: 5,5% van de waarheid.
check "en tellen op tot het volle bedrag"      "10351.03" \
  "$(q "select sum(spend)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = '061-3'")"
# De BFCM-advertentie met hetzelfde nummer mag daar niet bij zitten.
check "BFCM blijft er buiten"                  "0" \
  "$(q "select count(*) from marketing_hq.creative_meta_koppeling
         where meta_naam = 'WS - BFCM - 061 - 3' and creative_id is not null")"
check "en heet ook zo in de koppeling"         "geen creative met deze sleutel" \
  "$(q "select toestand from marketing_hq.creative_meta_koppeling
         where meta_naam = 'WS - BFCM - 061 - 3'")"
check "een onontleedbare naam valt op"         "naam niet te ontleden" \
  "$(q "select toestand from marketing_hq.creative_meta_koppeling
         where meta_naam = 'Catalog Ads -> 2'")"

# Een publicatie weet zeker welke advertentie het is; de naam leidt het af.
# Staan ze allebei op dezelfde creative, dan telt hij één keer -- anders zou
# elke join eronder verdubbelen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, account_id, published_at)
select id, 'a1', '242238038391551', now() - interval '7 days'
  from public.creatives where ad_name = '061-3';
SQL
check "publicatie en naam geven samen één rij" "1" \
  "$(q "select count(*) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = '061-3'")"
check "en de publicatie wint"                  "567.29" \
  "$(q "select sum(spend)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = '061-3'")"

# Een ander merk met hetzelfde nummer mag niet aanschuiven.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_publications;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values (current_date - 2, '1301619051500441', 'ad', 'b1', 'WS-061 - 3', 5000, 100000, true);
SQL
check "Wellshine telt niet mee bij Wellshave"  "10351.03" \
  "$(q "select sum(spend)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = '061-3'")"

# 0038 beloofde dat vastgezette cijfers blijven staan. sync_creative_results
# schreef daar dwars doorheen; zolang er geen ad-data was viel dat niet op.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
update public.creatives
   set roas = 9.99, budget = 42, cijfers_vastgezet = true,
       cijfers_vastgezet_door = '11111111-1111-1111-1111-111111111111',
       cijfers_vastgezet_op = now()
 where ad_name = '061-3';
select marketing_hq.sync_creative_results();
SQL
check "een vastgezet cijfer overleeft de sync" "9.99" \
  "$(q "select roas::numeric(10,2) from public.creatives where ad_name = '061-3'")"
check "en het vastgezette budget ook"          "42.00" \
  "$(q "select budget::numeric(10,2) from public.creatives where ad_name = '061-3'")"

# En het scherm moet er ook bij kunnen.
check "hq_creative_meta_koppeling is leesbaar voor een teamlid" "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_creative_meta_koppeling limit 1;" | grep -o 'ok' | head -1)"

echo
echo "  0043: twee gaten die de echte data liet zien"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0043_sleutelgaten.sql" >/dev/null 2>&1
check "0043 draait zonder fout" "0" "$?"

# Varianten lopen in de map van 1 tot en met 10. Op één cijfer viel 165-10
# eruit: geen fout, geen waarschuwing, alleen een creative die voor de analyse
# nooit bestaan heeft.
check "een variant van twee cijfers krijgt een sleutel" "165:10" \
  "$(q "select marketing_hq.meta_naam_sleutel('165-10')")"
check "en matcht met de Meta-kant"                      "165:10" \
  "$(q "select marketing_hq.meta_naam_sleutel('WS - 165 - 10 - Copy')")"
# De bewaking erachter moet blijven staan, anders leest 223 als variant 22.
check "drie cijfers blijft geweigerd"                   "—" \
  "$(q "select coalesce(marketing_hq.meta_naam_sleutel('WS - 103 - 223'), '—')")"
check "en 61:3 verandert niet"                          "61:3" \
  "$(q "select marketing_hq.meta_naam_sleutel('WS-061 - 3 - ASC+')")"

# Drie rijen heten 144-1. Zonder drager zouden ze alle drie hetzelfde bedrag
# krijgen, en telt één advertentie drie keer mee in elke telling per persona.
check "drie rijen delen de sleutel 144:1" "3" \
  "$(q "select delers from marketing_hq.creative_sleutel
         where sleutel = '144:1' and draagt_meting")"
check "maar één van hen draagt de meting" "1" \
  "$(q "select count(*) from marketing_hq.creative_sleutel
         where sleutel = '144:1' and draagt_meting")"
check "en dat is de oudste"               "t" \
  "$(q "select creative_id = (select min(id) from public.creatives where ad_name like '144-1%')
         from marketing_hq.creative_sleutel where sleutel = '144:1' and draagt_meting")"

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
delete from marketing_hq.meta_publications;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values (current_date - 3, '242238038391551', 'ad', 'd1', 'WS - 144 - 1', 300, 30000, true);
SQL
check "de € 300 telt één keer, niet drie keer" "300.00" \
  "$(q "select coalesce(sum(t.spend),0)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name like '144-1%'")"
check "en maar één van de drie is gemeten"     "1" \
  "$(q "select count(*) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name like '144-1%'")"
check "de koppeling zegt dat er rijen delen"   "gekoppeld, maar 3 rijen delen deze naam" \
  "$(q "select toestand from marketing_hq.creative_meta_koppeling where meta_naam = 'WS - 144 - 1'")"

echo
echo "  0044: waar rust dit cijfer op"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0044_herkomst.sql" >/dev/null 2>&1
check "0044 draait zonder fout" "0" "$?"

# De situatie van 061-3, nagespeeld: vier advertenties in Meta, waarvan het
# sheet er één kende. Dat is de kern van wat 0042 blootlegde.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
delete from marketing_hq.meta_publications;
update public.creatives set cijfers_vastgezet = false, cijfers_vastgezet_door = null,
       cijfers_vastgezet_op = null, budget = 567.29 where ad_name = '061-3';
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values
  (current_date - 6, '242238038391551', 'ad', 'a1', 'WS-061 - 3',               567.29,   94334, true),
  (current_date - 5, '242238038391551', 'ad', 'a2', 'WS-061 - 3 - ASC+',       9473.42, 1498744, true),
  (current_date - 4, '242238038391551', 'ad', 'a3', 'WS-061 - 3 - ASC+ - Copy', 310.32,   80981, true),
  (current_date - 3, '242238038391551', 'ad', 'a4', 'Catalog Ads -> 2',         192.96,   20851, true);
SQL

check "061-3 hangt aan drie advertenties" "3" \
  "$(q "select gekoppelde_advertenties from marketing_hq.creative_herkomst where ad_name = '061-3'")"
check "en hun namen staan erbij"          "t" \
  "$(q "select meta_namen like '%ASC+%' from marketing_hq.creative_herkomst where ad_name = '061-3'")"
# 10351,03 / 567,29 = 18,2. Dat is de hele reden dat de map onbruikbaar was.
check "het gemeten bedrag is 18,2x het ingetypte" "18.2" \
  "$(q "select factor_op_ingetypt from marketing_hq.creative_herkomst where ad_name = '061-3'")"
check "en dat wordt met zoveel woorden gezegd" "t" \
  "$(q "select randgeval like '%18.2× wat er in de map stond%'
        from marketing_hq.creative_herkomst where ad_name = '061-3'")"

# Een rij zonder advertentie in Meta moet dat zeggen, niet zwijgen.
check "een ongemeten rij noemt zichzelf ongemeten" "t" \
  "$(q "select randgeval like 'niet gemeten%' from marketing_hq.creative_herkomst
         where ad_name = '005-1'")"
# En een rij waar niets bijzonders aan is, hoort géén melding te krijgen --
# anders staat het scherm vol waarschuwingen en leest niemand ze meer. Eén
# advertentie, één rij, gemeten bedrag gelijk aan het ingetypte: schoon.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
update public.creatives set budget = 39.20 where ad_name = '005-2';
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values (current_date - 5, '242238038391551', 'ad', 'z1', 'WS - 005 - 2', 39.20, 4000, true);
SQL
check "een schone rij krijgt geen randgeval" "LEEG" \
  "$(q "select coalesce(randgeval,'LEEG') from marketing_hq.creative_herkomst
         where ad_name = '005-2'")"
check "maar wel gewoon een meting"           "1" \
  "$(q "select gekoppelde_advertenties from marketing_hq.creative_herkomst
         where ad_name = '005-2'")"

# Wie de meting niet draagt hoort te weten waar hij dan wel staat.
check "een deler weet dat de meting elders staat" "t" \
  "$(q "select randgeval like 'deelt de naam%met 2 andere rij(en)%'
        from marketing_hq.creative_herkomst
        where ad_name like '144-1 (bron%' limit 1")"
# En hij mag de advertenties van de drager niet als de zijne opvoeren: dan
# staat er bij alle drie hetzelfde aantal en lijkt het drie keer bewezen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values (current_date - 2, '242238038391551', 'ad', 'y1', 'WS - 144 - 1', 100, 10000, true);
SQL
check "de drager telt de advertentie"        "1" \
  "$(q "select gekoppelde_advertenties from marketing_hq.creative_herkomst
         where ad_name = '144-1'")"
check "en de twee delers tellen er nul"      "0 0" \
  "$(q "select string_agg(gekoppelde_advertenties::text, ' ' order by creative_id)
         from marketing_hq.creative_herkomst where ad_name like '144-1 (bron%'")"

# De dekking: € 10.351,03 van de € 10.543,99 komt terug in de map. De
# catalogusadvertentie hoort er niet in, en dat mag geen 100% opleveren.
# Niet tegen een vast bedrag: dat verschuift bij elke fixture die erbij komt en
# dan vervangt iemand het getal in plaats van de vraag te stellen. De eis is de
# invariant -- de noemer is álle ad-spend, en die valt uiteen in binnen en
# buiten de map zonder dat er iets weglekt.
check "de noemer is alle ad-spend, niet alleen wat koppelt" "t" \
  "$(q "select d.spend_totaal = (select round(sum(spend),2) from marketing_hq.meta_insights_daily
                                  where level = 'ad' and account_id = '242238038391551')
        from marketing_hq.map_dekking d where d.brand = 'wellshave'")"
check "binnen plus buiten is het totaal"                    "t" \
  "$(q "select spend_in_de_map + spend_buiten_de_map = spend_totaal
        from marketing_hq.map_dekking where brand = 'wellshave'")"
# De catalogusadvertentie is geen creative uit de map en hoort er dus buiten te
# vallen -- 100% dekking zou hier betekenen dat de noemer is opgeschoond.
check "de catalogusadvertentie valt erbuiten"               "192.96" \
  "$(q "select spend_buiten_de_map from marketing_hq.map_dekking where brand = 'wellshave'")"
check "dus geen 100 procent"                                "t" \
  "$(q "select dekking_procent > 90 and dekking_procent < 100
        from marketing_hq.map_dekking where brand = 'wellshave'")"

# Een merk waar niets van gemeten is hoort een rij te krijgen die dat zegt.
# Nul rijen leest als een kapotte view, en dan gaat iemand de verkeerde fout
# zoeken -- exact wat 0041 bij de sync wegnam.
check "een merk zonder metingen staat er wel in" "nog niets gemeten op advertentieniveau" \
  "$(q "select toestand from marketing_hq.map_dekking where brand = 'wellshine'")"
check "met nul euro en niet met null"            "0.00" \
  "$(q "select spend_totaal from marketing_hq.map_dekking where brand = 'wellshine'")"
check "en wellshave zegt dat er wel gemeten is"  "gemeten" \
  "$(q "select toestand from marketing_hq.map_dekking where brand = 'wellshave'")"

check "hq_creative_herkomst is leesbaar voor een teamlid" "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_creative_herkomst limit 1;" | grep -o 'ok' | head -1)"
check "hq_map_dekking ook"                                "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_dekking limit 1;" | grep -o 'ok' | head -1)"

echo
echo "  0045: voorvoegsels zijn eigen reeksen"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0045_reeksen.sql" >/dev/null 2>&1
check "0045 draait zonder fout" "0" "$?"

# Alle namen hieronder staan letterlijk in het Wellshave- of Wellshine-account.
# Verzonnen voorbeelden bewijzen hier niets: het gaat er juist om dat vier
# voorvoegsels op vier verschillende plekken in de naam allemaal herkend worden.
check "WSLP wordt een LP-reeks"        "LP:180:1"   "$(sleutel 'WSLP - 180 - 1')"
check "WSDG wordt een DG-reeks"        "DG:179:2"   "$(sleutel 'WSDG - 179 - 2')"
check "een landcode achter het nummer" "IT:169:2"   "$(sleutel 'WS169IT - 2')"
check "Wellshine's WLS"                "WLS:8:1"    "$(sleutel 'WLS - 008 - 1')"
check "en zijn tweede spelling WSL"    "WSL:1:1"    "$(sleutel 'WSL - 001 - 1')"

# De kern van de keuze: een voorvoegsel mag de gewone map-rij nooit raken.
check "LP raakt de gewone reeks niet"  "f" \
  "$(q "select marketing_hq.meta_naam_sleutel('WSLP - 180 - 1')
             = marketing_hq.meta_naam_sleutel('180-1')")"
check "IT raakt de gewone reeks niet"  "f" \
  "$(q "select marketing_hq.meta_naam_sleutel('WS169IT - 2')
             = marketing_hq.meta_naam_sleutel('169-2')")"
# En twee spellingen van Wellshine blijven uit elkaar: als er twee in omloop
# zijn hoort dat zichtbaar te blijven.
check "WLS en WSL blijven gescheiden"  "f" \
  "$(q "select marketing_hq.meta_naam_sleutel('WLS - 008 - 1')
             = marketing_hq.meta_naam_sleutel('WSL - 008 - 1')")"

# Alles wat in 0042 t/m 0044 al werkte moet blijven werken -- dit is een
# ingewikkelder regex geworden en dat is precies waar iets stil omvalt.
check "de gewone reeks blijft 61:3"    "61:3"       "$(sleutel 'WS-061 - 3 - ASC+')"
check "de map-kant blijft 61:3"        "61:3"       "$(sleutel '061-3')"
check "005 - 3 blijft 5:3"             "5:3"        "$(sleutel '005 - 3')"
check "@WS038 -1 blijft 38:1"          "38:1"       "$(sleutel '@WS038 -1')"
check "BFCM blijft BFCM"               "BFCM:2:2"   "$(sleutel 'WS - BFCM - 002 - 2')"
check "de C-reeks met nummer blijft"   "C:36:1"     "$(sleutel 'WS - C - 036 - 1')"
check "variant 10 blijft 165:10"       "165:10"     "$(sleutel '165-10')"
check "Copy 2 blijft 103:2"            "103:2"      "$(sleutel 'WS - 103 - 2 - Copy 2')"

# C1 heeft geen nummer en hoort dus geen sleutel te krijgen. Er valt niets aan
# te koppelen omdat die rij niet in de map bestaat; een sleutel verzinnen zou
# dat verbergen.
check "C1 krijgt geen sleutel"                 "—" "$(sleutel 'C1 - 4 Reasons Why')"
check "C2 ook niet"                            "—" "$(sleutel 'C2 - Before/After')"
check "en Catalog Ads nog steeds niet"         "—" "$(sleutel 'Catalog Ads -> 2')"
check "een FLEX-bundel nog steeds niet"        "—" "$(sleutel '@WS052 -> FLEX (4 Videos) Herfst - Copy 2')"
check "en een naam zonder nummer al helemaal"  "—" "$(sleutel 'French Video')"

# En de koppeling in de praktijk: een LP-advertentie hangt aan niets, ook niet
# aan de rij met hetzelfde nummer.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values
  (current_date - 2, '242238038391551', 'ad', 'p1', 'WSLP - 180 - 1', 113.04, 9000, true),
  (current_date - 2, '242238038391551', 'ad', 'p2', 'WS - 180 - 1',    50.00, 5000, true);
SQL
check "de LP-advertentie koppelt aan niets" "geen creative met deze sleutel" \
  "$(q "select toestand from marketing_hq.creative_meta_koppeling where meta_naam = 'WSLP - 180 - 1'")"
check "en de gewone wel aan 180-1"          "180-1" \
  "$(q "select ad_name from marketing_hq.creative_meta_koppeling where meta_naam = 'WS - 180 - 1'")"
check "180-1 telt alleen de gewone mee"     "50.00" \
  "$(q "select coalesce(sum(t.spend),0)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = '180-1'")"

echo
echo "  0046: koppelen op naam, en de C-reeks in de map"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0046_ckoppeling.sql" >/dev/null 2>&1
check "0046 draait zonder fout" "0" "$?"

# Een naam zonder nummer krijgt nu een sleutel uit de naam zelf.
check "C1 krijgt een naamsleutel"        "naam:c1"                  "$(q "select marketing_hq.koppelsleutel('C1')")"
check "hoofdletters doen er niet toe"    "t" \
  "$(q "select marketing_hq.koppelsleutel('C1 - 4 Reasons Why')
             = marketing_hq.koppelsleutel('c1 -  4 REASONS why')")"
# Maar het nummerpatroon gaat voor: anders zou 061-3 ineens op zijn naam koppelen
# en niet meer op zijn nummer, en dan valt WS-061 - 3 - ASC+ erbuiten.
check "een nummer wint van de naam"      "61:3"                     "$(q "select marketing_hq.koppelsleutel('WS-061 - 3 - ASC+')")"
check "en de map-kant ook"               "61:3"                     "$(q "select marketing_hq.koppelsleutel('061-3')")"
check "een lege naam geeft niets"        "LEEG"                     "$(q "select coalesce(marketing_hq.koppelsleutel('   '), 'LEEG')")"

# De zes rijen staan er, met alleen wat na te meten is.
check "de zes C-rijen staan in de map"   "6" \
  "$(q "select count(*) from public.creatives where brand='wellshave' and ad_name ~ '^C[0-9]'")"
check "met de angle uit de naam"         "Social Proof / Reviews" \
  "$(q "select angle_type from public.creatives where ad_name = 'C3 - Social Proof'")"
# Zonder achtervoegsel staat er geen angle in de naam, dus hoort er ook geen in
# de map te staan. Een verzonnen angle is erger dan een lege.
check "en zonder angle waar die ontbreekt" "LEEG" \
  "$(q "select coalesce(angle_type,'LEEG') from public.creatives where ad_name = 'C3'")"
check "persona blijft leeg, dat is een oordeel" "LEEG" \
  "$(q "select coalesce(persona,'LEEG') from public.creatives where ad_name = 'C1 - 4 Reasons Why'")"
check "bewustzijnsniveau ook"            "LEEG" \
  "$(q "select coalesce(awareness_level,'LEEG') from public.creatives where ad_name = 'C1 - 4 Reasons Why'")"

# En nu het punt van de hele migratie: koppelen ze ook echt.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
delete from marketing_hq.meta_publications;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, purchases, purchase_value, is_final)
values
  (current_date - 6, '242238038391551', 'ad', 'c1a', 'C1 - 4 Reasons Why', 1000.00, 100000, 20, 1200.00, true),
  (current_date - 5, '242238038391551', 'ad', 'c1b', 'C1 - 4 Reasons Why',  414.76,  45033,  5,  304.88, true),
  (current_date - 4, '242238038391551', 'ad', 'c1c', 'C1',                  107.74,  10956,  0,    0.00, true),
  (current_date - 3, '242238038391551', 'ad', 'x1',  'Catalog Ads -> 2',    192.96,  20851,  4,  600.00, true);
SQL
check "C1 - 4 Reasons Why telt beide advertenties" "1414.76" \
  "$(q "select sum(t.spend)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = 'C1 - 4 Reasons Why'")"
# C1 en 'C1 - 4 Reasons Why' zijn twee rijen en horen niet op te tellen: ze zijn
# waarschijnlijk hetzelfde concept, en waarschijnlijk is geen grond om te sommeren.
check "C1 blijft daar los van"                     "107.74" \
  "$(q "select sum(t.spend)::numeric(10,2) from marketing_hq.ad_totals t
         join public.creatives c on c.id = t.creative_id where c.ad_name = 'C1'")"
check "en de koppeling zegt dat het op naam ging"  "gekoppeld op naam" \
  "$(q "select distinct toestand from marketing_hq.creative_meta_koppeling where meta_naam = 'C1 - 4 Reasons Why'")"
# Catalog Ads krijgt nu wel een sleutel, maar er is geen creative die zo heet --
# dus hij hoort nog steeds buiten de map te vallen.
check "Catalog Ads valt nog steeds buiten"         "geen creative met deze naam of dit nummer" \
  "$(q "select toestand from marketing_hq.creative_meta_koppeling where meta_naam = 'Catalog Ads -> 2'")"
check "en telt niet mee in de dekking"             "192.96" \
  "$(q "select spend_buiten_de_map from marketing_hq.map_dekking where brand='wellshave'")"

echo
echo "  0047: wat er ontbreekt, en wat dat kost"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0047_gaten.sql" >/dev/null 2>&1
check "0047 draait zonder fout" "0" "$?"

# De zes C-rijen uit 0046 draaien en missen persona en bewustzijnsniveau.
check "C1 - 4 Reasons Why moet ingevuld worden" "t" \
  "$(q "select moet_ingevuld from marketing_hq.map_gaten where ad_name = 'C1 - 4 Reasons Why'")"
check "en er staat bij welke velden"            "{persona,bewustzijnsniveau,desire}" \
  "$(q "select ontbreekt::text from marketing_hq.map_gaten where ad_name = 'C1 - 4 Reasons Why'")"
# Bij C3 ontbreekt de angle ook, want die stond niet in de naam.
check "bij C3 ontbreekt de angle er ook"        "t" \
  "$(q "select 'angle' = any(ontbreekt) from marketing_hq.map_gaten where ad_name = 'C3'")"

# Een rij die compleet is, hoeft niets.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
update public.creatives
   set persona = 'De Gevoelige Scheerder', awareness_level = '2. Problem Aware',
       angle_type = 'Problem-Solution', product = 'Groom Guard', desires = 'Geen irritatie'
 where ad_name = 'C2 - Before/After';
SQL
check "een complete rij hoeft niets"            "f" \
  "$(q "select moet_ingevuld from marketing_hq.map_gaten where ad_name = 'C2 - Before/After'")"
check "en heeft geen ontbrekende velden"        "{}" \
  "$(q "select ontbreekt::text from marketing_hq.map_gaten where ad_name = 'C2 - Before/After'")"

# Een concept dat nog niet gedraaid heeft mag leeg zijn -- anders staat het
# scherm binnen een week vol waarschuwingen en leest niemand ze meer.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into public.creatives (brand, ad_name, status, bron_bestand)
values ('wellshave', 'Nog niet gedraaid', 'Concept', 'test');
SQL
check "een concept in de maak is geen gat"      "f" \
  "$(q "select moet_ingevuld from marketing_hq.map_gaten where ad_name = 'Nog niet gedraaid'")"
check "ook al staat alles leeg"                 "5" \
  "$(q "select cardinality(ontbreekt) from marketing_hq.map_gaten where ad_name = 'Nog niet gedraaid'")"

# Het bedrag erbij: zonder bedrag zakt een gat naar onderen op ieders lijst.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values (current_date - 3, '242238038391551', 'ad', 'g1', 'C1 - 4 Reasons Why', 1414.76, 145033, true);
SQL
# Per creative is het bedrag eenduidig; het totaal telt terecht ook de andere
# onvolledige rijen mee, dus daar is geen los getal op te toetsen.
check "het gemeten bedrag hangt aan de creative" "1414.76" \
  "$(q "select spend::numeric(10,2) from marketing_hq.map_gaten where ad_name = 'C1 - 4 Reasons Why'")"
# En het totaal moet minstens dat bedrag zijn -- anders telt de meting niet mee.
check "en telt mee in het totaal voor persona"   "t" \
  "$(q "select spend_zonder_dit_veld >= 1414.76 from marketing_hq.map_gaten_totaal
         where brand='wellshave' and veld='persona'")"
check "persona is een eigen regel in het totaal" "t" \
  "$(q "select count(*) > 0 from marketing_hq.map_gaten_totaal where veld = 'persona'")"

check "hq_map_gaten is leesbaar voor een teamlid" "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_gaten limit 1;" | grep -o 'ok' | head -1)"
check "hq_map_gaten_totaal ook"                   "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_gaten_totaal limit 1;" | grep -o 'ok' | head -1)"

# ═══════════════════════════════════════════════════════════════════════════
# 0050 — de analysekaart
#
# Deze reeks draait op een eigen, gecontroleerde set rijen (bron_bestand
# 'kaarttest'). De geïmporteerde sheetrijen staan er nog, maar elke controle
# hieronder wijst een vak aan bij naam, dus ze kunnen elkaar niet raken.
#
# Vak A is met opzet zo gebouwd dat het ongewogen gemiddelde de rangorde
# omdraait: één rij met € 10 en ROAS 10, twee rijen met € 70 en ROAS 0,5.
# Gemiddeld 3,67, gewogen 1,13. Dat is dezelfde vorm als FOMO / Scarcity op
# productie, alleen klein genoeg om met de hand na te rekenen.
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  0050: de analysekaart"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0050_kruistabel.sql" >/dev/null 2>&1
check "0050 draait zonder fout" "0" "$?"

# De testrijen zijn de hele reeks hieronder. Landen ze niet, dan staat elke
# controle daarna op een leeg vak en dat leest als "de view geeft niets" in
# plaats van "de fixture is stuk".

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;

insert into public.creatives
  (brand, ad_name, product, persona, awareness_level, angle_type,
   status, date_live, budget, roas, conversions, bron_bestand)
values
  -- Vak A: gemeten, en het gemiddelde liegt
  ('wellshave','KT-A1','Groom Guard','Alex','2. Problem Aware','Benefits-Driven',
   'Live', date '2026-07-01',  10, 10.00, null, 'kaarttest'),
  ('wellshave','KT-A2','Groom Guard','Alex','2. Problem Aware','Benefits-Driven',
   'Live', date '2026-07-01',  70,  0.50, null, 'kaarttest'),
  ('wellshave','KT-A3','Groom Guard','Alex','2. Problem Aware','Benefits-Driven',
   'Live', date '2026-07-01',  70,  0.50, null, 'kaarttest'),
  -- Vak A, vierde rij: andere schrijfwijze van hetzelfde bewustzijnsniveau, en
  -- nooit gemeten. Hoort in hetzelfde vak te vallen en niet mee te tellen.
  ('wellshave','KT-D1','Groom Guard','Alex','problem','Benefits-Driven',
   'Live', date '2026-07-01', null, null, null, 'kaarttest'),
  -- Vak B: gemeten, maar onder alle drie de drempels tegelijk
  ('wellshave','KT-B1','Groom Guard','Alex','2. Problem Aware','Curiosity / Intrigue',
   'Live', date '2026-07-01',  20,  3.00, null, 'kaarttest'),
  -- Vak C: nooit gemeten, wel een ingetypte ROAS van 9 -- de valkuil in het klein
  ('wellshave','KT-C1','Groom Guard','Alex','2. Problem Aware','FOMO / Scarcity',
   'Concept', null, null, 9.00, null, 'kaarttest'),
  ('wellshave','KT-C2','Groom Guard','Alex','2. Problem Aware','FOMO / Scarcity',
   'Concept', null, null, 9.00, null, 'kaarttest'),
  -- Vak E: een aswaarde die niet gevouwen wordt, en een persona die er geen is
  ('wellshave','KT-E1','Groom Guard','Geen specifieke customer Persona','2. Problem Aware','safety',
   'Live', date '2026-07-01', null, null, null, 'kaarttest'),
  -- Vak F: nooit gemeten, straks handmatig vastgezet
  ('wellshave','KT-F1','Flex Guard','Luca','3. Solution Aware','Bundle Offer',
   'Live', date '2026-07-01', 200,  2.00,    5, 'kaarttest');

insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name,
   spend, impressions, clicks, purchases, purchase_value, is_final)
values
  (current_date - 5, '242238038391551', 'ad', 'kt-a1', 'KT-A1', 10, 1000, 20, 1, 100, true),
  (current_date - 5, '242238038391551', 'ad', 'kt-a2', 'KT-A2', 70, 7000, 70, 1,  35, true),
  (current_date - 5, '242238038391551', 'ad', 'kt-a3', 'KT-A3', 70, 7000, 70, 1,  35, true),
  (current_date - 5, '242238038391551', 'ad', 'kt-b1', 'KT-B1', 20, 2000, 10, 1,  60, true);
SQL

check "de negen testrijen staan er" "9" \
  "$(q "select count(*) from public.creatives where bron_bestand='kaarttest'")"

vakA="from marketing_hq.map_analyse where product='Groom Guard' and persona='Alex'
      and bewustzijnsniveau='2. Problem Aware' and angle='Benefits-Driven'"
vakB="from marketing_hq.map_analyse where product='Groom Guard' and persona='Alex'
      and bewustzijnsniveau='2. Problem Aware' and angle='Curiosity / Intrigue'"
vakC="from marketing_hq.map_analyse where product='Groom Guard' and persona='Alex'
      and bewustzijnsniveau='2. Problem Aware' and angle='FOMO / Scarcity'"

echo
echo "  0050: sophistication komt over het werkstuk"
# 0030 zette deze as al neer, op het werkstuk en niet op de creative. Er een
# tweede kolom naast leggen zou de tweede waarheid maken die dit systeem overal
# vermijdt -- dus deze controle bewaakt dat hij er níét komt.
check "er is geen tweede kolom op creatives"     "0" \
  "$(q "select count(*) from information_schema.columns
         where table_schema='public' and table_name='creatives' and column_name='sophistication_level'")"
check "de vijf niveaus van 0030 staan er nog"    "5" \
  "$(q "select count(*) from marketing_hq.sophistication_niveaus")"
# Een voorstel van een agent is geen vaststelling. Mutatietest: haal de
# bevestigd_op-voorwaarde uit map_creative_as en de eerste van deze twee wordt
# '3. mechanisme' -- dan groepeert de kaart op iets wat niemand getekend heeft.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.werkstukken (titel, sophistication, sophistication_reden,
                                      sophistication_door_agent)
values ('Kaarttest werkstuk', 3, 'de markt gelooft de claims niet meer', 'nova');
update public.creatives
   set werkstuk_id = (select id from marketing_hq.werkstukken where titel = 'Kaarttest werkstuk')
 where ad_name = 'KT-A1';
SQL
check "een onbevestigd voorstel telt niet als as" "" \
  "$(q "select coalesce(sophistication,'') from marketing_hq.map_creative_as where ad_name='KT-A1'")"
check "maar het voorstel blijft wel zichtbaar"    "3. mechanisme" \
  "$(q "select sophistication_voorstel from marketing_hq.map_creative_as where ad_name='KT-A1'")"
check "na een handtekening telt hij wel mee"      "3. mechanisme" \
  "$(q "update marketing_hq.werkstukken
           set sophistication_bevestigd_door='11111111-1111-1111-1111-111111111111',
               sophistication_bevestigd_op=now()
         where titel='Kaarttest werkstuk';
        select coalesce(sophistication,'') from marketing_hq.map_creative_as where ad_name='KT-A1'")"
# En dan splitst het vak vanzelf: KT-A1 zit nu op een ander niveau dan A2/A3.
check "en dan splitst het vak op die as"          "2" \
  "$(q "select count(*) from marketing_hq.map_analyse
         where product='Groom Guard' and persona='Alex'
           and bewustzijnsniveau='2. Problem Aware' and angle='Benefits-Driven'")"
check "terugdraaien geeft één vak terug"          "1" \
  "$(q "update public.creatives set werkstuk_id=null where ad_name='KT-A1';
        select count(*) from marketing_hq.map_analyse
         where product='Groom Guard' and persona='Alex'
           and bewustzijnsniveau='2. Problem Aware' and angle='Benefits-Driven'")"
# Zou sophistication wél als beslisveld meetellen in 0047, dan staat er morgen
# bij alle 637 rijen een gat en leest niemand er nog één. Mutatietest: zet
# 'sophistication' in de array van 0047 en deze twee vallen om.
check "sophistication telt niet mee als gat"     "{persona,bewustzijnsniveau,desire}" \
  "$(q "select ontbreekt::text from marketing_hq.map_gaten where ad_name='C1 - 4 Reasons Why'")"
check "en verandert het aantal gaten niet"       "5" \
  "$(q "select cardinality(ontbreekt) from marketing_hq.map_gaten where ad_name='Nog niet gedraaid'")"

echo
echo "  0050: het gewogen cijfer tegen het gemiddelde"
check "vak A is beoordeelbaar"                   "beoordeelbaar" "$(q "select toestand $vakA")"
# 170 / 150. Mutatietest: vervang de deling door avg(roas) en dit wordt 3.67.
check "de gewogen ROAS is 1,13"                  "1.13"          "$(q "select roas $vakA")"
check "het ongewogen gemiddelde is 3,67"         "3.67"          "$(q "select roas_ongewogen_ingetypt $vakA")"
check "en die twee zijn niet hetzelfde getal"    "t"             "$(q "select roas <> roas_ongewogen_ingetypt $vakA")"
check "de spend is 150 en niet meer"             "150.00"        "$(q "select spend $vakA")"
check "vier creatives in het vak"                "4"             "$(q "select creatives $vakA")"
# De ongemeten rij staat er wel bij maar telt niet mee -- dat is de hele regel.
check "waarvan drie gemeten"                     "3"             "$(q "select gemeten_creatives $vakA")"
check "de aankopen tellen op tot drie"           "3"             "$(q "select aankopen $vakA")"

echo
echo "  0050: te weinig data zegt hoeveel te weinig"
check "vak B is te dun"                          "te weinig data" "$(q "select toestand $vakB")"
# Mutatietest: laat de view het getal ook onder de drempel afdrukken en dit
# wordt 3.00 -- precies het getal waar iemand een besluit op zou nemen.
check "en geeft dus geen ROAS af"                ""               "$(q "select coalesce(roas::text,'') $vakB")"
check "het oordeel noemt het bedrag"             "t"  "$(q "select oordeel like '%€ 20 van € 100%' $vakB")"
check "het oordeel noemt de creatives"           "t"  "$(q "select oordeel like '%1 van 3 gemeten creatives%' $vakB")"
check "het oordeel noemt de aankopen"            "t"  "$(q "select oordeel like '%1 van 3 aankopen%' $vakB")"

echo
echo "  0050: niet gemeten is iets anders dan nul"
check "vak C is niet gemeten"                    "niet gemeten"   "$(q "select toestand $vakC")"
check "en geeft geen ROAS af"                    ""               "$(q "select coalesce(roas::text,'') $vakC")"
# Het ingetypte gemiddelde blijft zichtbaar, anders is niet meer na te gaan
# waar een eerdere conclusie vandaan kwam.
check "het ingetypte gemiddelde staat er wel"    "9.00"           "$(q "select roas_ongewogen_ingetypt $vakC")"
check "het oordeel noemt het aantal creatives"   "t"  "$(q "select oordeel like '%geen van de 2 creative(s)%' $vakC")"

echo
echo "  0050: twee schrijfwijzen, één as"
# Zonder de vouwing wordt 'problem' een eigen kolom met één rij, naast een
# kolom met drie. Mutatietest: haal de regel uit map_as_synoniemen en
# 'vier creatives in het vak' hierboven wordt 3.
check "'problem' valt op 2. Problem Aware"       "2. Problem Aware" \
  "$(q "select marketing_hq.map_as('bewustzijnsniveau','problem')")"
check "en de vouwing is zichtbaar"               "t" \
  "$(q "select gevouwen from marketing_hq.map_as_schrijfwijzen
         where as_naam='bewustzijnsniveau' and ruwe_waarde='problem' and brand='wellshave'")"
# 'safety' hoort bij geen enkele angle uit de lijst. Raden zou een vak vullen
# met iets wat niemand heeft opgeschreven.
check "'safety' wordt niet gevouwen"             "f" \
  "$(q "select gevouwen from marketing_hq.map_as_schrijfwijzen
         where as_naam='angle' and ruwe_waarde='safety' and brand='wellshave'")"
check "en blijft een eigen waarde op de as"      "1" \
  "$(q "select count(*) from marketing_hq.map_analyse where angle='safety'")"

echo
echo "  0050: een niet-keuze is geen persona"
check "de twee schrijfwijzen worden er één"      "Geen specifieke persona" \
  "$(q "select marketing_hq.map_as('persona','Geen specifieke customer Persona (omdat deze nog niet ready zijn)')")"
# Mutatietest: laat persona_gekozen altijd true zijn en de niet-keuze komt
# bovenaan elke ranglijst te staan -- hij heeft 109 rijen op productie.
check "en tellen niet als gekozen persona"       "f" \
  "$(q "select bool_or(persona_gekozen) from marketing_hq.map_analyse
         where persona='Geen specifieke persona'")"
check "Alex is wél een gekozen persona"          "t" \
  "$(q "select bool_and(persona_gekozen) from marketing_hq.map_analyse where persona='Alex'")"

echo
echo "  0050: de drempels zitten in een tabel en niet in de view"
check "min_spend op 1000 maakt vak A te dun"     "te weinig data" \
  "$(q "update marketing_hq.map_drempels set waarde=1000 where naam='min_spend';
        select toestand $vakA")"
check "en de ROAS verdwijnt mee"                 "" \
  "$(q "select coalesce(roas::text,'') $vakA")"
check "de kruistabel volgt dezelfde grens"       "te weinig data" \
  "$(q "select toestand from marketing_hq.map_kruistabel('wellshave','Groom Guard')
         where persona='Alex' and angle='Benefits-Driven'")"
check "terugzetten geeft het oordeel terug"      "beoordeelbaar" \
  "$(q "update marketing_hq.map_drempels set waarde=100 where naam='min_spend';
        select toestand $vakA")"

echo
echo "  0050: per aswaarde over alle vakken heen"
asFOMO="from marketing_hq.map_as_totaal where brand='wellshave' and as_naam='angle' and waarde='FOMO / Scarcity'"
check "FOMO heeft geen enkele gemeten creative"  "0"    "$(q "select gemeten_creatives $asFOMO")"
check "en dus geen ROAS"                         ""     "$(q "select coalesce(roas::text,'') $asFOMO")"
check "maar wel een ingetypt gemiddelde"         "t"    "$(q "select roas_ongewogen_ingetypt > 0 $asFOMO")"
check "Benefits-Driven heeft er wel een"         "1.13" \
  "$(q "select roas from marketing_hq.map_as_totaal
         where brand='wellshave' and as_naam='angle' and waarde='Benefits-Driven'")"
# Dit ís de valkuil, in één regel: het gemiddelde zet FOMO boven Benefits-Driven
# terwijl er geen euro achter FOMO zit en alleen Benefits-Driven een oordeel
# aankan. Mutatietest: laat roas het gewogen getal ook onder de drempel afgeven,
# of laat hem terugvallen op het ongewogen gemiddelde, en deze valt om.
check "het gemiddelde keert de rangorde om"      "t" \
  "$(q "select f.roas_ongewogen_ingetypt > b.roas_ongewogen_ingetypt
           and f.roas is null and b.roas is not null
         from marketing_hq.map_as_totaal f, marketing_hq.map_as_totaal b
        where f.brand='wellshave' and f.as_naam='angle' and f.waarde='FOMO / Scarcity'
          and b.brand='wellshave' and b.as_naam='angle' and b.waarde='Benefits-Driven'")"

echo
echo "  0050: vastgezet wint van gemeten en van ingetypt"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
update public.creatives
   set cijfers_vastgezet = true,
       cijfers_vastgezet_door = '11111111-1111-1111-1111-111111111111',
       cijfers_vastgezet_op = now()
 where ad_name = 'KT-F1';
SQL
vakF="from marketing_hq.map_analyse where product='Flex Guard' and persona='Luca' and angle='Bundle Offer'"
# Er is geen gemeten omzet, dus die wordt teruggerekend uit roas × budget.
# Mutatietest: laat telt_mee bij een vastgezette rij op false staan en de
# spend hieronder wordt 0,00.
check "een vastgezette rij telt mee"             "1"      "$(q "select gemeten_creatives $vakF")"
check "met het ingetypte budget als spend"       "200.00" "$(q "select spend $vakF")"
check "en de omzet teruggerekend uit de ROAS"    "400.00" "$(q "select omzet $vakF")"
# Zonder deze kolom is niet te zien dat het vak op een reconstructie rust.
check "het vak zegt dat het vastgezet is"        "1"      "$(q "select vastgezette_creatives $vakF")"

echo
echo "  0050: de kruistabel met de lege vakken erin"
check "een nooit geprobeerde combinatie staat erin" "nooit geprobeerd" \
  "$(q "select toestand from marketing_hq.map_kruistabel('wellshave','Groom Guard')
         where persona='Luca' and angle='Bundle Offer'")"
check "met nul creatives"                           "0" \
  "$(q "select creatives from marketing_hq.map_kruistabel('wellshave','Groom Guard')
         where persona='Luca' and angle='Bundle Offer'")"
check "en 'nooit geprobeerd' is niet 'niet gemeten'" "t" \
  "$(q "select oordeel like 'nooit geprobeerd%' from marketing_hq.map_kruistabel('wellshave','Groom Guard')
         where persona='Luca' and angle='Bundle Offer'")"
check "een gevulde combinatie staat er ook"          "beoordeelbaar" \
  "$(q "select toestand from marketing_hq.map_kruistabel('wellshave','Groom Guard')
         where persona='Alex' and angle='Benefits-Driven'")"

echo
echo "  0050: wat de kaart in het geheel waard is"
# Zelfde regel als in 0041 en 0044: een merk zonder rijen zegt dat met zoveel
# woorden. Mutatietest: maak er een gewone group by van en wellshine verdwijnt.
check "wellshine staat er, en zegt dat het leeg is" "geen creatives in de map voor dit merk" \
  "$(q "select toestand from marketing_hq.map_analyse_samenvatting where brand='wellshine'")"
check "wellshave heeft beoordeelbare vakken"        "t" \
  "$(q "select vakken_beoordeelbaar > 0 from marketing_hq.map_analyse_samenvatting where brand='wellshave'")"
check "en die dekken een deel van de spend"         "t" \
  "$(q "select aandeel_spend_beoordeelbaar between 0 and 100
         from marketing_hq.map_analyse_samenvatting where brand='wellshave'")"
check "de vakken tellen op tot het totaal"          "t" \
  "$(q "select vakken = vakken_beoordeelbaar + vakken_te_dun + vakken_ongemeten
         from marketing_hq.map_analyse_samenvatting where brand='wellshave'")"

echo
echo "  0050: kan het team de kaart ook echt lezen"
check "hq_map_analyse is leesbaar voor een teamlid" "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_analyse limit 1;" | grep -o 'ok' | head -1)"
check "hq_map_as_totaal ook"                        "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_as_totaal limit 1;" | grep -o 'ok' | head -1)"
check "hq_map_analyse_samenvatting ook"             "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_analyse_samenvatting limit 1;" | grep -o 'ok' | head -1)"
check "hq_map_as_schrijfwijzen ook"                 "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_as_schrijfwijzen limit 1;" | grep -o 'ok' | head -1)"
check "hq_map_drempels ook"                         "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_map_drempels limit 1;" | grep -o 'ok' | head -1)"
check "en de kruistabel mag hij ook aanroepen"      "ok" \
  "$(alsTeamlid "select 'ok' from marketing_hq.map_kruistabel('wellshave','Groom Guard') limit 1;" | grep -o 'ok' | head -1)"

# ═══════════════════════════════════════════════════════════════════════════
# 0049 — een dag die je niet kunt narekenen, is een dag die je niet hebt
#
# De echte fout die dit vangt: 177 van de 366 dagen waren nooit opgehaald, in
# blokken van 120 en 49 dagen, en de database zag er precies zo uit als een
# database die klopt. Plus één dag (12 juli 2026) die een periodetotaal droeg:
# € 2.180,10 over 96 advertenties, elf keer een normale dag.
#
# De fixture hieronder bouwt allebei die situaties na, klein genoeg om met de
# hand na te rekenen: vier dagen met accountcijfer, waarvan één met een gat
# ernaast en één met een periodetotaal erin.
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  0049: sluit deze dag"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0049_meetdagen.sql" >/dev/null 2>&1
check "0049 draait zonder fout" "0" "$?"

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily;

-- Vier meetdagen, ruim buiten het voorlopige venster van 72 uur.
-- dag -20  sluit: account 100, twee advertenties van 50
-- dag -19  ONTBREEKT op advertentieniveau (account zegt wel 100)
-- dag -18  wijkt af: account 100, advertenties samen 400 -- een periodetotaal
-- dag -17  sluit binnen de marge: account 100, advertenties 100,50
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values
  (current_date - 20, '242238038391551', 'account', 'act', null, 100.00, 0, true),
  (current_date - 19, '242238038391551', 'account', 'act', null, 100.00, 0, true),
  (current_date - 18, '242238038391551', 'account', 'act', null, 100.00, 0, true),
  (current_date - 17, '242238038391551', 'account', 'act', null, 100.00, 0, true),

  (current_date - 20, '242238038391551', 'ad', 'a1', 'WS - 900 - 1', 50.00, 5000, true),
  (current_date - 20, '242238038391551', 'ad', 'a2', 'WS - 900 - 2', 50.00, 5000, true),
  (current_date - 18, '242238038391551', 'ad', 'a1', 'WS - 900 - 1', 200.00, 5000, true),
  (current_date - 18, '242238038391551', 'ad', 'a2', 'WS - 900 - 2', 200.00, 5000, true),
  (current_date - 17, '242238038391551', 'ad', 'a1', 'WS - 900 - 1', 100.50, 5000, true);
SQL

md="from marketing_hq.meta_meetdag where account_id='242238038391551'"
check "een dag die sluit heet ook zo"          "sluit" \
  "$(q "select toestand $md and insight_date = current_date - 20")"
check "en heeft geen toelichting nodig"        "" \
  "$(q "select coalesce(toelichting,'') $md and insight_date = current_date - 20")"
# Dit is het gat van 120 dagen, in het klein: het account gaf geld uit en er
# staat geen enkele advertentie bij. Mutatietest: maak van de full outer join
# een gewone join en deze rij verdwijnt -- precies zoals de 177 dagen deden.
check "een dag zonder advertenties valt op"    "geen advertentiecijfers" \
  "$(q "select toestand $md and insight_date = current_date - 19")"
check "en de rij bestaat überhaupt"            "1" \
  "$(q "select count(*) $md and insight_date = current_date - 19")"
# Dit is 12 juli 2026, in het klein.
check "een periodetotaal wijkt af"             "wijkt af" \
  "$(q "select toestand $md and insight_date = current_date - 18")"
check "met beide bedragen in de toelichting"   "t" \
  "$(q "select toelichting like '%400.00%' and toelichting like '%100.00%'
         $md and insight_date = current_date - 18")"
check "het verschil staat er als getal bij"    "300.00" \
  "$(q "select verschil $md and insight_date = current_date - 18")"
# Een halve euro op honderd is afrondingsruis en geen storing; zou de marge
# nul zijn, dan staat er elke dag een waarschuwing die niets betekent.
check "een halve euro verschil is geen storing" "sluit" \
  "$(q "select toestand $md and insight_date = current_date - 17")"
# Meta corrigeert tot ~72 uur terug. Een verse dag krijgt daarom geen oordeel.
check "een verse dag krijgt geen oordeel"      "nog voorlopig" \
  "$(q "insert into marketing_hq.meta_insights_daily
          (insight_date, account_id, level, entity_id, spend, impressions, is_final)
        values (current_date, '242238038391551', 'account', 'act', 100, 0, false),
               (current_date, '242238038391551', 'ad', 'a1', 999, 10, false);
        select toestand $md and insight_date = current_date")"

echo
echo "  0049: waar de gaten liggen"
# Losse dagen zijn onleesbaar; een blok is de vorm waarin je opnieuw ophaalt.
check "het gat is één blok van één dag"        "1" \
  "$(q "select dagen from marketing_hq.meta_meetgaten
         where account_id='242238038391551' and van = current_date - 19")"
# Twee blokken: het gaatje op -19 en de staart van -16 tot gisteren. Dat de
# staart erbij staat is geen bijvangst -- dat is precies hoe een sync die
# stilviel eruitziet.
check "en de staart naar vandaag staat er ook" "2" \
  "$(q "select count(*) from marketing_hq.meta_meetgaten where account_id='242238038391551'")"
check "de staart loopt door tot gisteren"      "t" \
  "$(q "select bool_or(tot = current_date - 1) from marketing_hq.meta_meetgaten
         where account_id='242238038391551'")"
# Aaneengesloten dagen horen één regel te zijn en geen drie: -19 was al leeg,
# -18 erbij maakt er één blok van twee.
check "twee dagen op rij worden één blok"      "2" \
  "$(q "delete from marketing_hq.meta_insights_daily
         where level='ad' and insight_date = current_date - 18;
        select dagen from marketing_hq.meta_meetgaten
         where account_id='242238038391551' and van = current_date - 19")"
check "en dat blok loopt van -19 tot -18"      "t" \
  "$(q "select tot = current_date - 18 from marketing_hq.meta_meetgaten
         where account_id='242238038391551' and van = current_date - 19")"

echo
echo "  0049: hoe compleet is de meting"
# Niet voortbouwen op wat de vorige controles hebben achtergelaten: een
# fixture die van drie eerdere stappen afhangt, faalt straks om de verkeerde
# reden. Hier staat exact wat erin zit -- drie gemeten dagen in een venster
# van twintig.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
delete from marketing_hq.meta_insights_daily where level = 'ad';
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, is_final)
values
  (current_date - 20, '242238038391551', 'ad', 'a1', 'WS - 900 - 1',  50.00, 5000, true),
  (current_date - 18, '242238038391551', 'ad', 'a1', 'WS - 900 - 1', 200.00, 5000, true),
  (current_date - 17, '242238038391551', 'ad', 'a1', 'WS - 900 - 1', 100.50, 5000, true);
SQL
mdek="from marketing_hq.meta_meetdekking where brand='wellshave'"
# Venster loopt van de eerste gemeten dag (-20) tot gisteren: 20 dagen.
check "het venster loopt tot gisteren"         "20"  "$(q "select dagen_in_venster $mdek")"
check "drie dagen zijn gemeten"                "3"   "$(q "select dagen_gemeten $mdek")"
check "zeventien ontbreken er"                 "17"  "$(q "select dagen_ontbreken $mdek")"
check "en de toestand zegt het in woorden"     "t" \
  "$(q "select toestand like '17 van de 20 dagen ontbreken%' $mdek")"
check "met het grootste gat erbij"             "t" \
  "$(q "select toestand like '%grootste gat%' $mdek")"
# Zonder metingen hoort een merk dat te zeggen in plaats van te ontbreken --
# zelfde regel als in 0041, 0044 en 0048.
check "een merk zonder metingen zegt dat"      "nog nooit iets gemeten" \
  "$(q "select toestand from marketing_hq.meta_meetdekking where brand='wellshine'")"

echo
echo "  0049: map_dekking zegt waar hij op rust"
# Dit is de kern van de hele migratie: 86% dekking van een derde van het geld
# leest precies zoals 86% van alles. Mutatietest: haal de kolom weg en het
# percentage staat er weer alleen.
check "map_dekking noemt de ontbrekende dagen" "17" \
  "$(q "select dagen_ontbreken from marketing_hq.map_dekking where brand='wellshave'")"
check "met een waarschuwing in woorden"        "t" \
  "$(q "select volledigheid like 'let op:%nooit opgehaald%'
         from marketing_hq.map_dekking where brand='wellshave'")"
check "de oude kolommen staan er nog"          "t" \
  "$(q "select dekking_procent is not null and spend_in_de_map is not null
         from marketing_hq.map_dekking where brand='wellshave'")"
# De console leest uit public, niet uit marketing_hq. Zonder het opnieuw
# aanmaken van hq_map_dekking staat de waarschuwing op de plek waar niemand kijkt.
check "en de console ziet de nieuwe kolom ook" "17" \
  "$(q "select dagen_ontbreken from public.hq_map_dekking where brand='wellshave'")"

echo
echo "  0049: kan het team het lezen"
check "hq_meta_meetdag is leesbaar voor een teamlid" "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_meta_meetdag limit 1;" | grep -o 'ok' | head -1)"
check "hq_meta_meetgaten ook"                        "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_meta_meetgaten limit 1;" | grep -o 'ok' | head -1)"
check "hq_meta_meetdekking ook"                      "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_meta_meetdekking limit 1;" | grep -o 'ok' | head -1)"

echo
echo "  0048: wat maakt deze advertentie tot wat hij is"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0048_deconstructie.sql" >/dev/null 2>&1
check "0048 draait zonder fout" "0" "$?"

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.creative_deconstructions
  (creative_id, creative_type, core_concept, primary_character, source, confidence,
   invariants, flexible)
select id, 'Founder Story',
  'The founder explains why he created Wellshave after being dissatisfied with existing grooming products.',
  'Dustin Gibson (founder)', 'copy+image', 'high',
  '[{"element":"Founder","why":"de geloofwaardigheid hangt aan een echt persoon"},
    {"element":"First person narrative","why":"derde persoon maakt er een testimonial van"},
    {"element":"Founder imagery","why":"een model breekt de belofte van echtheid"}]'::jsonb,
  '[{"element":"Headline","why":"vrij"},{"element":"CTA","why":"vrij"},{"element":"Layout","why":"vrij"}]'::jsonb
from public.creatives where ad_name = '061-3';
SQL

check "de lezing staat er"                    "Founder Story" \
  "$(q "select creative_type from marketing_hq.iteration_understanding where ad_name = '061-3'")"
# Het scherm krijgt platte namen; de reden blijft in de backend beschikbaar.
check "Keep is een lijst met namen"           "{Founder,\"First person narrative\",\"Founder imagery\"}" \
  "$(q "select keep::text from marketing_hq.iteration_understanding where ad_name = '061-3'")"
check "Flexible ook"                          "{Headline,CTA,Layout}" \
  "$(q "select flexible::text from marketing_hq.iteration_understanding where ad_name = '061-3'")"
check "en de reden blijft beschikbaar"        "t" \
  "$(q "select keep_detail::text like '%echt persoon%' from marketing_hq.iteration_understanding where ad_name = '061-3'")"
check "er is iets beschermd"                  "f" \
  "$(q "select nothing_protected from marketing_hq.iteration_understanding where ad_name = '061-3'")"
# Waar de lezing op rust hoort zichtbaar te zijn: zonder beeld is een Founder
# Story maar half gelezen.
check "de bron staat erbij"                   "copy+image" \
  "$(q "select source from marketing_hq.iteration_understanding where ad_name = '061-3'")"

# Een lezing zonder invariants laat een iteratie alles veranderen. Dat mag niet
# stil blijven -- dan verdwijnt precies de bescherming waarvoor deze laag bestaat.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.creative_deconstructions
  (creative_id, creative_type, core_concept, invariants)
select id, 'Product Demo', 'Laat het product zien', '[]'::jsonb
from public.creatives where ad_name = '058-3';
SQL
check "niets beschermd valt op"               "t" \
  "$(q "select nothing_protected from marketing_hq.iteration_understanding where ad_name = '058-3'")"

# Een nieuwe lezing vervangt de oude in beeld, maar de oude blijft bestaan --
# anders is niet te zien dat het oordeel veranderd is.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.creative_deconstructions
  (creative_id, creative_type, core_concept, source, analysed_at, invariants)
select id, 'Founder Story', 'Herzien met het beeld erbij', 'copy+image', now() + interval '1 hour',
  '[{"element":"Founder","why":"bevestigd op het beeld"}]'::jsonb
from public.creatives where ad_name = '061-3';
SQL
check "de nieuwste lezing telt"               "Herzien met het beeld erbij" \
  "$(q "select core_concept from marketing_hq.iteration_understanding where ad_name = '061-3'")"
check "en de oude blijft bewaard"             "2" \
  "$(q "select count(*) from marketing_hq.creative_deconstructions d
         join public.creatives c on c.id = d.creative_id where c.ad_name = '061-3'")"
check "één rij per creative in het scherm"    "1" \
  "$(q "select count(*) from marketing_hq.iteration_understanding where ad_name = '061-3'")"

# Afkeuren haalt een lezing uit beeld zonder hem te wissen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
update marketing_hq.creative_deconstructions
   set rejected_at = now(), rejected_reason = 'de AI zag een founder waar een model staat'
 where core_concept = 'Herzien met het beeld erbij';
SQL
check "een afgekeurde lezing telt niet meer"  "Founder Story" \
  "$(q "select creative_type from marketing_hq.iteration_understanding where ad_name = '061-3'")"
check "maar valt terug op de vorige"          "t" \
  "$(q "select core_concept like 'The founder explains%' from marketing_hq.iteration_understanding where ad_name = '061-3'")"
check "en blijft in de tabel staan"           "2" \
  "$(q "select count(*) from marketing_hq.creative_deconstructions d
         join public.creatives c on c.id = d.creative_id where c.ad_name = '061-3'")"

# Vorm afdwingen op de database: een model dat een string teruggeeft in plaats
# van een lijst hoort te stuiten, niet stil een leeg scherm op te leveren.
check "invariants moet een lijst zijn" "ja" \
  "$(weigert "insert into marketing_hq.creative_deconstructions (creative_id, creative_type, core_concept, invariants)
              select id, 'X', 'Y', '\"Founder\"'::jsonb from public.creatives where ad_name='058-3'" \
             "deconstructie_invariants_is_lijst")"
check "afkeuren zonder reden mag niet" "ja" \
  "$(weigert "update marketing_hq.creative_deconstructions set rejected_at = now() where core_concept = 'Laat het product zien'" \
             "deconstructie_afkeuring_heeft_reden")"
# De deconstructie is de lezing van de AI, niet die van het team. Hij mag
# public.creatives dus niet aanraken.
check "creatives.persona blijft ongemoeid" "LEEG" \
  "$(q "select coalesce(persona,'LEEG') from public.creatives where ad_name = 'C1 - 4 Reasons Why'")"

check "hq_iteration_understanding is leesbaar voor een teamlid" "ok" \
  "$(alsTeamlid "select 'ok' from public.hq_iteration_understanding limit 1;" | grep -o 'ok' | head -1)"

echo
[ $fout -eq 0 ] && echo "Alles klopt" || echo "$fout controle(s) mislukt"
exit $((fout > 0))
