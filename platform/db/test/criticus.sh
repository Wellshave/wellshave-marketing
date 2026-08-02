#!/usr/bin/env bash
# Testlus voor migratie 0026 — de Criticus.
#
# De vraag is niet of de tabel bestaat, maar of hij tanden heeft.
#
# 1. Een overdracht uit ③ komt niet langs zonder oordeel. Zonder die grendel is
#    de Criticus een advies, en een advies wordt overgeslagen precies wanneer
#    het druk is.
#
# 2. 'Niet door' sluit aannemen uit. Een afkeuring die je naast je neer kunt
#    leggen is een kanttekening.
#
# 3. Maar hij houdt niet vast: terugsturen blijft vrij, anders wordt de grendel
#    omzeild in plaats van gerespecteerd.
#
# 4. De maker tekent niet voor zijn eigen werk, en geen andere agent tekent in
#    zijn plaats.
#
#   bash platform/db/test/criticus.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/criticus-test-$$"
PORT=${PGTESTPORT:-5512}
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
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  alle migraties draaien"
echo

# ── De zaak ────────────────────────────────────────────────────────────────
# Twee werkstukken die klaar zijn met creatie en door willen naar lancering, en
# één overdracht uit een ander station om te laten zien dat de Criticus daar
# niet over gaat.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into marketing_hq.werkstukken (id, titel, product, persona, angle_type, gestart_door)
overriding system value values
  (1,'Nekirritatie bij hoge kraag','Groom Guard','Mark','Problem-Solution','mens'),
  (2,'Reisformaat','Groom Guard','Mark','Problem-Solution','nova'),
  (3,'Al gelanceerd in juli','Groom Guard','Wim','Storytelling / Narrative','nova');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 3);

-- De overdracht van creatie naar lancering: hier gaat de Criticus over.
insert into marketing_hq.werkstuk_overdrachten
  (id, werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
overriding system value values
  (1, 1, 3, 4, 'quill', 'Drie varianten op de kraaghoek',
      'De hoek deed eerder ROAS 2,4 over vijf advertenties',
      'Of de belofte in de kop klopt met wat de landingspagina zegt'),
  (2, 2, 3, 4, 'pixel', 'Eén static voor het reisformaat',
      'Radar zag het formaat drie keer terug bij concurrenten',
      'Of het formaat past bij deze persona'),
  -- En één uit ② om te laten zien waar hij niet over gaat.
  (3, 1, 2, 3, 'nova', 'Hoek uitgewerkt', 'Uit het signaal', 'Of het format past');
select setval(pg_get_serial_sequence('marketing_hq.werkstuk_overdrachten','id'), 3);
SQL
echo "  de zaak staat klaar"
echo

# ── 1. De grendel ──────────────────────────────────────────────────────────
echo "  de grendel — creatie komt niet langs zonder oordeel"
check "aannemen zonder oordeel gaat niet" "ja" \
  "$(weigert "update marketing_hq.werkstuk_overdrachten
     set status='aangenomen', door_agent='bolt', besloten_op=now() where id=1" \
   "zonder het oordeel van de Criticus")"
check "en terugsturen mag wél, want anders zit het werkstuk klem" "ja" \
  "$(qerr "update marketing_hq.werkstuk_overdrachten
     set status='teruggestuurd', door_agent='bolt', besloten_op=now(),
         terug_reden='De kop belooft iets anders dan de pagina' where id=1;
     update marketing_hq.werkstuk_overdrachten set status='open', door_agent=null,
         besloten_op=null, terug_reden=null where id=1;
     select 'ja'" | tr -d ' ')"

q "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
   values (1,'door','Kop en pagina beloven hetzelfde; de drie varianten verschillen genoeg','criticus')" >/dev/null
check "met een oordeel 'door' kan het wel" "" \
  "$(qerr "update marketing_hq.werkstuk_overdrachten
     set status='aangenomen', door_agent='bolt', besloten_op=now() where id=1" | grep -o 'ERROR')"

# ── 2. Een afkeuring is geen kanttekening ──────────────────────────────────
echo
echo "  de afkeuring — niet naast je neer te leggen"
q "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
   values (2,'niet door','Het formaat is nooit bij deze persona getest en het dossier zegt dat ook','criticus')" >/dev/null
check "afgekeurd werk kan niet alsnog aangenomen worden" "ja" \
  "$(weigert "update marketing_hq.werkstuk_overdrachten
     set status='aangenomen', door_agent='bolt', besloten_op=now() where id=2" \
   "De Criticus keurde dit af")"
check "en de reden staat in de melding, niet alleen 'geweigerd'" "ja" \
  "$(weigert "update marketing_hq.werkstuk_overdrachten
     set status='aangenomen', door_agent='bolt', besloten_op=now() where id=2" \
   "nooit bij deze persona getest")"
check "terugsturen na een afkeuring gaat gewoon" "" \
  "$(qerr "update marketing_hq.werkstuk_overdrachten
     set status='teruggestuurd', door_agent='bolt', besloten_op=now(),
         terug_reden='Criticus hield het tegen: formaat ongetest' where id=2" | grep -o 'ERROR')"

# ── 3. Waar hij over gaat ──────────────────────────────────────────────────
echo
echo "  zijn bereik — één overdracht, niet alle"
check "een oordeel over een overdracht uit ② wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (3,'door','Ziet er goed uit','criticus')" \
   "gaat over de overdracht van ③")"
check "en de overdracht uit ② komt gewoon langs zonder hem" "" \
  "$(qerr "update marketing_hq.werkstuk_overdrachten
     set status='aangenomen', door_agent='pixel', besloten_op=now() where id=3" | grep -o 'ERROR')"

# ── 4. Wie er tekent ───────────────────────────────────────────────────────
echo
echo "  de handtekening — de maker keurt niet zijn eigen werk"
q "insert into marketing_hq.werkstuk_overdrachten
     (id, werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
   overriding system value
   values (4, 2, 3, 4, 'pixel', 'Tweede poging op het reisformaat',
           'Nu met een format dat wel getest is', 'Of de belofte klopt');
   select setval(pg_get_serial_sequence('marketing_hq.werkstuk_overdrachten','id'), 4)" >/dev/null
check "Bolt kan zichzelf niet doorlaten" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (4,'door','Lijkt me prima','bolt')" "check constraint")"
check "Pixel evenmin" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (4,'door','Mijn eigen werk is goed','pixel')" "check constraint")"
check "en niemand tekenen kan ook niet" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden)
     values (4,'door','Zomaar')" "check constraint")"
# Een mens mag wel tekenen -- de grens verlegt, hij blokkeert niet. Maar niet
# de mens die de overdracht zelf schreef.
q "insert into marketing_hq.werkstuk_overdrachten
     (id, werkstuk_id, van_station, naar_station, van_mens, besluit, waarom, controleren)
   overriding system value
   values (5, 1, 3, 4, '11111111-1111-1111-1111-111111111111',
           'Met de hand gemaakt', 'Omdat het sneller kon', 'Of de kop klopt');
   select setval(pg_get_serial_sequence('marketing_hq.werkstuk_overdrachten','id'), 5)" >/dev/null
check "wie de overdracht schreef, oordeelt er niet over" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_mens)
     values (5,'door','Ik vind het goed','11111111-1111-1111-1111-111111111111')" \
   "velt er niet het oordeel over")"

# ── 5. De vorm van het oordeel ─────────────────────────────────────────────
echo
echo "  de vorm — twee uitkomsten, en allebei met een reden"
check "een goedkeuring zonder reden is een stempel" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (4,'door','   ','criticus')" "check constraint")"
check "en een derde uitkomst bestaat niet" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (4,'door met opmerkingen','Een paar dingetjes','criticus')" "check constraint")"
q "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
   values (4,'door','Het format is nu getest bij deze persona','criticus')" >/dev/null
check "twee oordelen over hetzelfde werk gaat niet" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (4,'niet door','Toch maar niet','criticus')" "unique")"
check "en een oordeel op een afgehandelde overdracht ook niet" "ja" \
  "$(weigert "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
     values (2,'door','Alsnog','criticus')" "al afgehandeld")"

# ── 6. Wat er op zijn bureau ligt ──────────────────────────────────────────
echo
echo "  de werkvoorraad — met de grond eronder erbij"
check "alleen open overdrachten uit ③ staan erop" 2 \
  "$(q "select count(*) from marketing_hq.criticus_werkvoorraad")"
check "een al beoordeelde maar nog niet aangenomen overdracht toont zijn oordeel" "ja" \
  "$(q "select case when stand like 'door: Het format is nu getest%' then 'ja' else stand end
        from marketing_hq.criticus_werkvoorraad where overdracht_id=4")"
check "en dat is de handgemaakte, die nog geen oordeel heeft" "wacht op oordeel" \
  "$(q "select stand from marketing_hq.criticus_werkvoorraad where overdracht_id=5")"
check "met wat er nagekeken moet worden erbij" "Of de kop klopt" \
  "$(q "select controleren from marketing_hq.criticus_werkvoorraad where overdracht_id=5")"
check "en met wat het dossier van ③ waard is" "ja" \
  "$(q "select case when grond like '%rust op smaak%' or grond like '%gemeten%'
             then 'ja' else grond end
        from marketing_hq.criticus_werkvoorraad where overdracht_id=5")"

# ── 7. De Criticus zelf ────────────────────────────────────────────────────
echo
echo "  de controle op de controleur"
check "hij staat in het team" "De Criticus" \
  "$(q "select name from marketing_hq.agents where id='criticus'")"
check "drie oordelen, waarvan één tegengehouden" "1 van de 3 tegengehouden" \
  "$(q "select stand from marketing_hq.criticus_staat")"
# We draaien de zaak even terug om de andere tak te zien: zonder afkeuringen
# hoort de view op te vallen in plaats van netjes te tellen. De afkeuring zat
# op een overdracht die inmiddels is teruggestuurd, en een oordeel weghalen kan
# dan niet meer -- dus eerst weer open.
check "een oordeel weghalen bij een afgehandelde overdracht kan niet" "ja" \
  "$(weigert "delete from marketing_hq.criticus_oordelen where oordeel='niet door'" "al afgehandeld")"
q "update marketing_hq.werkstuk_overdrachten set status='open', door_agent=null,
     besloten_op=null, terug_reden=null where id=2" >/dev/null
q "delete from marketing_hq.criticus_oordelen where oordeel='niet door'" >/dev/null
# Elke overdracht apart: 0022 staat er maar één per station per moment toe, en
# drie in één statement delen dezelfde created_at.
for n in 1 2 3; do
  q "insert into marketing_hq.werkstuk_overdrachten
       (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
     values (1, 3, 4, 'quill', 'Variant $n', 'Omdat het kon', 'Of het klopt')" >/dev/null
done
q "insert into marketing_hq.criticus_oordelen (overdracht_id, oordeel, reden, door_agent)
   select id, 'door', 'Ziet er goed uit', 'criticus'
   from marketing_hq.werkstuk_overdrachten where besluit like 'Variant%'" >/dev/null
check "een criticus die alles doorlaat valt op" "ja" \
  "$(q "select case when stand like '%nog nooit iets tegengehouden%' then 'ja' else stand end
        from marketing_hq.criticus_staat")"

# ── 8. Alleen bij de overgang ──────────────────────────────────────────────
echo
echo "  het verleden — wat al gelanceerd is blijft staan"
# De grendel vuurt op de overgang náár 'aangenomen', niet op elke aanraking van
# een aangenomen rij. Anders zou werk uit juli terugwerkend afgekeurd worden,
# en dat breekt de estafette voor iets wat allang draait.
check "een aangenomen overdracht mag nog bijgewerkt worden" "" \
  "$(qerr "update marketing_hq.werkstuk_overdrachten
     set waarom = waarom || ' (aangevuld)' where id=1 and status='aangenomen'" | grep -o 'ERROR')"
check "en hij blijft aangenomen" "aangenomen" \
  "$(q "select status from marketing_hq.werkstuk_overdrachten where id=1")"
check "hij komt niet op het bureau van de Criticus terecht" 0 \
  "$(q "select count(*) from marketing_hq.criticus_werkvoorraad where overdracht_id=1")"

# ── 9. Toegang ─────────────────────────────────────────────────────────────
echo
echo "  toegang"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -c \
  "grant select on all tables in schema marketing_hq to authenticated" >/dev/null 2>&1
check "een buitenstaander leest de oordelen niet" 0 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U authenticated -d postgres -qtA \
     -c "set test.teamlid='nee'" -c "select count(*) from marketing_hq.criticus_oordelen" 2>/dev/null | tail -1)"
check "een teamlid wel" "$(q "select count(*) from marketing_hq.criticus_oordelen")" \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U authenticated -d postgres -qtA \
     -c "set test.teamlid='ja'" -c "select count(*) from marketing_hq.criticus_oordelen" 2>/dev/null | tail -1)"

# ── 10. Nog een keer ───────────────────────────────────────────────────────
echo
echo "  de migratie nog een keer"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0026_criticus.sql" 2>&1)
check "0026 draait twee keer zonder klagen" "" "$(echo "$uit" | grep -o 'ERROR' | head -1)"
check "en er is nog steeds één Criticus" 1 \
  "$(q "select count(*) from marketing_hq.agents where id='criticus'")"

echo
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $fout
