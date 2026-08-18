#!/usr/bin/env bash
# Testlus voor migratie 0025 — het dossier per station.
#
# Wat hier bewezen moet worden is niet dat de view draait, maar dat hij niet
# kan liegen.
#
# 1. Geen enkele regel zonder herkomst en zonder zekerheid. Een dossierregel
#    die niet zegt waarop hij rust, is een mening met een databron eronder.
#
# 2. Eén advertentie levert 'aanname' op en geen 'onderbouwd'. Dat is de regel
#    die het verschil maakt tussen een dossier en een aanmoediging.
#
# 3. Een gat noemt zichzelf. Een dossier dat zwijgt over reviews leest als een
#    dossier waarin reviews niets zeiden.
#
# 4. De lus komt rond: wat ⑤ oplevert staat in het dossier van ② van het
#    volgende werkstuk op dezelfde hoek.
#
#   bash platform/db/test/dossier.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/dossier-test-$$"
PORT=${PGTESTPORT:-5511}
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
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  alle migraties draaien"
echo

# ── De zaak ────────────────────────────────────────────────────────────────
# Eén hoek die drie keer getest is en dus iets betekent, één hoek die één keer
# getest is en dus niets betekent, en één hoek die nooit getest is. Dat zijn de
# drie toestanden waarin een dossier kan verkeren, en het verschil ertussen is
# precies wat deze migratie moet vasthouden.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into marketing_hq.werkstukken (id, titel, product, persona, angle_type, gestart_door)
overriding system value values
  (1,'Nekirritatie bij hoge kraag','Groom Guard','Mark','Problem-Solution','mens'),
  (2,'Tweede ronde op dezelfde hoek','Groom Guard','Mark','Problem-Solution','nova'),
  (3,'Onbetreden hoek','Groom Guard','Wim','Storytelling / Narrative','radar');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 3);

-- Drie advertenties op Problem-Solution/Mark, samen ruim €300: betrouwbaar.
insert into public.creatives (ad_name, product, persona, angle_type, format, hook_short, status) values
  ('PS-A','Groom Guard','Mark','Problem-Solution','UGC','Kraag schuurt','Winner'),
  ('PS-B','Groom Guard','Mark','Problem-Solution','UGC','Kraag schuurt','Live'),
  ('PS-C','Groom Guard','Mark','Problem-Solution','UGC','Kraag schuurt','Live'),
  -- Eén advertentie op een andere hoek bij dezelfde persona: te weinig.
  ('EEN','Groom Guard','Mark','Social Proof / Reviews','Static','Vier sterren','Live');
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, published_at, status) values
  (1,'ad_a',current_date-8,'live'), (2,'ad_b',current_date-8,'live'),
  (3,'ad_c',current_date-8,'live'), (4,'ad_d',current_date-8,'live');
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, clicks,
   link_clicks, purchases, purchase_value, video_3s, video_thruplay, is_final)
select d::date, '2422', 'ad', e.id, e.id, 30, 6000, 120, 100, 3, e.omzet, 1800, 540, true
from generate_series(current_date-8, current_date-4, '1 day') d,
     (values ('ad_a', 90), ('ad_b', 60), ('ad_c', 45), ('ad_d', 30)) as e(id, omzet);
SQL
echo "  de zaak staat klaar"
echo

# ── 1. Elke regel noemt waarop hij rust ────────────────────────────────────
echo "  het dossier — geen regel zonder herkomst"
check "geen enkele regel zonder waarop" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where waarop is null or length(trim(waarop)) = 0")"
check "geen enkele regel zonder zekerheid" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier where zekerheid is null")"
check "en geen andere woorden dan die van het denkstuk" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where zekerheid not in ('onderbouwd','aanname','open')")"

# ── 2. De drempel bepaalt het woord, niet de schrijver ─────────────────────
echo
echo "  zekerheid — drie advertenties is een patroon, één is een anekdote"
check "drie advertenties boven €300 heet onderbouwd" "onderbouwd" \
  "$(q "select zekerheid from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='hoek eerder getest'")"
check "en de regel noemt het bedrag waarop dat rust" "ja" \
  "$(q "select case when waarop like '%450%' then 'ja' else waarop end
        from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='hoek eerder getest'")"
# Dezelfde persona, één advertentie: het format bestaat maar draagt niets.
check "één advertentie in een format heet aanname" "aanname" \
  "$(q "select zekerheid from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='format' and wat like '%Static%'")"
check "drie advertenties in één format heet onderbouwd" "onderbouwd" \
  "$(q "select zekerheid from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='format' and wat like '%UGC%'")"
check "een hoek die nooit getest is heet open" "open" \
  "$(q "select zekerheid from marketing_hq.werkstuk_dossier
        where werkstuk_id=3 and onderwerp='hoek eerder getest'")"
check "en zegt dat met zoveel woorden" "ja" \
  "$(q "select case when wat like '%nog niet eerder getest%' then 'ja' else wat end
        from marketing_hq.werkstuk_dossier
        where werkstuk_id=3 and onderwerp='hoek eerder getest'")"

# Een handmatig ingetypt getal is geen meting. Het mag in het dossier staan,
# maar het mag de zekerheid niet omhoog trekken -- anders is 'onderbouwd' een
# woord voor 'iemand heeft dit ooit ingevuld'.
q "insert into public.creatives (ad_name, product, persona, angle_type, format, status, roas)
   values ('MET-DE-HAND','Groom Guard','Mark','Problem-Solution','Carousel','Live', 9.9),
          ('MET-DE-HAND-2','Groom Guard','Mark','Problem-Solution','Carousel','Live', 8.8),
          ('MET-DE-HAND-3','Groom Guard','Mark','Problem-Solution','Carousel','Live', 7.7)" >/dev/null
check "drie zelf ingevulde cijfers zijn nog steeds geen bewijs" "aanname" \
  "$(q "select zekerheid from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='format' and wat like '%Carousel%'")"
check "en de regel zegt hoeveel er wel gemeten zijn" "ja" \
  "$(q "select case when waarop like '%waarvan 0 met cijfers uit Meta%' then 'ja' else waarop end
        from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='format' and wat like '%Carousel%'")"

# ── 3. Een gat noemt zichzelf ──────────────────────────────────────────────
echo
echo "  de gaten — zwijgen leest als niets gevonden"
check "elk werkstuk krijgt de ontbrekende bron te zien" 3 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where onderwerp='reviews en klantenservice'")"
check "en die regel is open, niet leeg" "open" \
  "$(q "select distinct zekerheid from marketing_hq.werkstuk_dossier
        where onderwerp='reviews en klantenservice'")"
check "met de reden erbij" "ja" \
  "$(q "select distinct case when waarop like '%geen bron aangesloten%' then 'ja' else waarop end
        from marketing_hq.werkstuk_dossier where onderwerp='reviews en klantenservice'")"

# ── 4. De learning is een besluit ──────────────────────────────────────────
echo
echo "  de learning — geen notitie zonder hypothese"
check "zonder denkstuk gaat er geen learning in" "ja" \
  "$(weigert "insert into marketing_hq.learnings
     (werkstuk_id, angle_type, persona, wat_we_leerden, hypothese, zekerheid, waarop, door_agent)
     values (1,'Problem-Solution','Mark','Pijn werkt beter dan bewijs','verzonnen','onderbouwd','drie ads','bolt')" \
   "geen hypothese")"

q "insert into marketing_hq.denkstukken (werkstuk_id) values (1)" >/dev/null
q "insert into marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag, antwoord, zekerheid, door_agent, bron)
   values ((select id from marketing_hq.denkstukken where werkstuk_id=1), 4,
           'Als we de kraagirritatie letterlijk tonen, dan stijgt de hook rate omdat de kijker zichzelf herkent',
           'aanname','nova',null)" >/dev/null

check "met denkstuk mag het wel" "" \
  "$(qerr "insert into marketing_hq.learnings
     (werkstuk_id, angle_type, persona, wat_we_leerden, hypothese, zekerheid, waarop, door_agent)
     values (1,'Problem-Solution','Mark','Het tonen van de irritatie hield de hook rate gelijk',
             'wordt overschreven','onderbouwd','drie advertenties, €450 besteed','bolt')" | grep -o 'ERROR' )"
check "en de hypothese komt uit het denkstuk, niet van de schrijver" "ja" \
  "$(q "select case when hypothese like 'Als we de kraagirritatie%herkent' then 'ja' else hypothese end
        from marketing_hq.learnings where werkstuk_id=1")"
check "onderbouwd zonder bewijs wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.learnings
     (werkstuk_id, angle_type, persona, wat_we_leerden, hypothese, zekerheid, door_agent)
     values (1,'Problem-Solution','Mark','Zomaar iets','x','onderbouwd','bolt')" "check constraint")"
check "en niemand als schrijver ook" "ja" \
  "$(weigert "insert into marketing_hq.learnings
     (werkstuk_id, angle_type, persona, wat_we_leerden, hypothese, zekerheid, waarop)
     values (1,'Problem-Solution','Mark','Zomaar iets','x','aanname','iets')" "check constraint")"

# ── 5. De lus ──────────────────────────────────────────────────────────────
echo
echo "  de lus — wat ⑤ oplevert komt terug bij ②"
check "het volgende werkstuk op deze hoek krijgt de learning voorgelegd" 1 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where werkstuk_id=2 and onderwerp='eerder geleerd'")"
check "met de hypothese die getoetst werd erbij" "ja" \
  "$(q "select case when wat like '%hypothese: Als we de kraagirritatie%' then 'ja' else wat end
        from marketing_hq.werkstuk_dossier where werkstuk_id=2 and onderwerp='eerder geleerd'")"
check "het werkstuk krijgt zijn eigen learning niet terug" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and onderwerp='eerder geleerd'")"
check "een andere hoek krijgt hem ook niet" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where werkstuk_id=3 and onderwerp='eerder geleerd'")"
check "een hoek die nog niets opleverde staat als niet-rond" "één werkstuk, nog niets uit geleerd — de lus is nog niet rond" \
  "$(q "select stand from marketing_hq.lus_per_hoek where angle_type='Storytelling / Narrative'")"
check "testen zonder terugkoppelen staat er als zodanig" "1 van de 2 werkstukken leverden een learning op" \
  "$(q "select stand from marketing_hq.lus_per_hoek where angle_type='Problem-Solution'")"

# ── 6. Het dossier over zichzelf ───────────────────────────────────────────
echo
echo "  de stand — een leeg dossier is een bevinding"
check "de stationsnaam staat erbij, niet alleen het nummer" "briefing" \
  "$(q "select station_naam from marketing_hq.dossier_per_station where werkstuk_id=1 and station=2")"
check "een werkstuk zonder enige meting krijgt dat te horen" "ja" \
  "$(q "select case when stand like '%niets onderbouwd%' or stand like '%leeg dossier%'
             then 'ja' else stand end
        from marketing_hq.dossier_per_station where werkstuk_id=3 and station=2")"
check "en de tellingen sluiten op het aantal regels" 0 \
  "$(q "select count(*) from marketing_hq.dossier_per_station
        where regels <> onderbouwd + aanname + open_gelaten")"

# ── 7. Het denkstuk van ⑤ ──────────────────────────────────────────────────
echo
echo "  waartegen gemeten wordt"
check "de hypothese staat in het dossier van ⑤" 1 \
  "$(q "select count(*) from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and station=5 and onderwerp='de hypothese'")"
check "maar zolang het denkstuk niet is afgetekend staat hij open" "open" \
  "$(q "select zekerheid from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and station=5 and onderwerp='de hypothese'")"
check "en het dossier zegt waarom" "ja" \
  "$(q "select case when waarop like '%nog niet afgetekend%' then 'ja' else waarop end
        from marketing_hq.werkstuk_dossier
        where werkstuk_id=1 and station=5 and onderwerp='de hypothese'")"

# ── 8. Wie het mag lezen ───────────────────────────────────────────────────
echo
echo "  toegang"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -c \
  "grant select on all tables in schema marketing_hq to authenticated" >/dev/null 2>&1
check "een buitenstaander leest het dossier niet" 0 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U authenticated -d postgres -qtA \
     -c "set test.teamlid='nee'" -c "select count(*) from marketing_hq.learnings" 2>/dev/null | tail -1)"
check "een teamlid wel" 1 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U authenticated -d postgres -qtA \
     -c "set test.teamlid='ja'" -c "select count(*) from marketing_hq.learnings" 2>/dev/null | tail -1)"

# ── 9. Nog een keer ────────────────────────────────────────────────────────
echo
echo "  de migratie nog een keer"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0025_dossier.sql" 2>&1)
check "0025 draait twee keer zonder klagen" "" "$(echo "$uit" | grep -o 'ERROR' | head -1)"
check "en de learning staat er nog" 1 "$(q "select count(*) from marketing_hq.learnings")"

echo
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $fout
