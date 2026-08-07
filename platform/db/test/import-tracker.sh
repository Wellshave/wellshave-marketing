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
[ $fout -eq 0 ] && echo "Alles klopt" || echo "$fout controle(s) mislukt"
exit $((fout > 0))
