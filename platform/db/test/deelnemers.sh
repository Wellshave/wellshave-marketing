#!/usr/bin/env bash
# Testlus voor migratie 0021 — deelnemers bij naam.
#
# De regel die hier bewezen moet worden: zodra er aan een stap gewerkt is, staat
# er een naam bij. Precies één — een stap die zowel een agent als een mens
# noemt is net zo onbruikbaar als een stap die er geen noemt, want dan weet je
# nog steeds niet wie je moet aanspreken.
#
# En de tweede: de twee stappen uit juli die niet te herleiden waren blijven
# naamloos. Ze invullen met een gok zou een verzonnen feit in de geschiedenis
# zetten, en dat is erger dan een zichtbaar gat.
#
#   bash platform/db/test/deelnemers.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/deelnemers-test-$$"
PORT=${PGTESTPORT:-5507}
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
  ('pixel','Pixel','Content creator'),('quill','Quill','Copywriter'),
  ('bolt','Bolt','Performance'),('atlas','Atlas','Data-analist'),
  ('echo','Echo','E-mail'),('vector','Vector','Web'),('sage','Sage','SEO');

-- Zoals op productie: drie teamleden, met verschillende statussen, en één
-- zonder ingevulde naam.
create table public.team_members (
  id uuid primary key, email text not null, full_name text,
  status text not null default 'pending', is_admin boolean default false,
  created_at timestamptz default now(), role text default 'member');
insert into public.team_members (id, email, full_name, status, role) values
  ('11111111-1111-1111-1111-111111111111','dustin@wellshave.com','Dustin Gibson','approved','admin'),
  ('22222222-2222-2222-2222-222222222222','oud@wellshave.com','Oud Lid','rejected','member'),
  ('33333333-3333-3333-3333-333333333333','yvonne@wellshave.com','','pending','member');

create table marketing_hq.creative_results (creative_id bigint, spend numeric,
  purchase_value numeric, impressions bigint, clicks bigint, roas numeric, beoordeelbaar boolean);
create table marketing_hq.pipeline_items    (id bigint generated always as identity primary key, angle text);
create table marketing_hq.email_drafts      (id bigint generated always as identity primary key, angle text);
create table marketing_hq.meta_publications (id bigint generated always as identity primary key, creative_id bigint);
create table marketing_hq.agent_messages    (id bigint generated always as identity primary key, subject text);
create table marketing_hq.agent_runs (id bigint generated always as identity primary key, agent_id text, job_id bigint);
create table marketing_hq.approvals  (id bigint generated always as identity primary key, titel text);
create table marketing_hq.reports    (id bigint generated always as identity primary key, author_agent text);
-- Bestaan alleen omdat 0017 ze bij naam noemt.
create table marketing_hq.ad_accounts (account_id text primary key, naam text, merk text);
create table marketing_hq.agent_afspraken (agent_id text, kind text);
create table marketing_hq.meta_publiek (account_id text, van date, tot date, segment text);

create table public.creatives (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  ad_name text, product text, persona text, angle_type text,
  status text default 'To Test', werkstuk_id bigint,
  user_id uuid, user_name text, created_at timestamptz default now());
SQL

for m in 0009_ruggengraat 0017_views 0021_deelnemers; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
  # 0009 draait vóór de creatives-kolommen bestaan die 0021 nodig heeft; de
  # werkstukken zetten we ertussen neer.
  if [ "$m" = "0017_views" ]; then
    psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
insert into marketing_hq.werkstukken (id, titel, aanleiding, gestart_door)
overriding system value values
  (1,'Uit de markt','Radar zag het','radar'),
  (2,'Met de hand','Dustin bedacht het','mens'),
  (3,'Van vóór de estafette','Bestond al','mens'),
  (4,'Door twee mensen gemaakt','Samen opgepakt','mens');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 4);

-- Werkstuk 1: agent deed station 1.
update marketing_hq.werkstuk_stappen set status='klaar', agent_id='radar',
  waarom='signaal opgepikt', afgerond_op=now() - interval '3 hours'
 where werkstuk_id=1 and station=1;

-- Werkstuk 2: een mens deed station 3, en de creative eronder zegt wie.
insert into public.creatives (ad_name, werkstuk_id, user_id, user_name)
values ('WS - 200', 2, '11111111-1111-1111-1111-111111111111', 'Dustin Gibson');
update marketing_hq.werkstuk_stappen set status='klaar', agent_id=null,
  overdracht='mens', waarom='beeld gemaakt in de console', afgerond_op=now() - interval '2 hours'
 where werkstuk_id=2 and station=3;

-- Werkstuk 4: twee verschillende mensen maakten de creatives eronder. Dan is
-- niet te zeggen wie de stap deed, en gokken is geen optie. Zonder dit geval
-- kan de bewaking op "precies één maker" er stilletjes uit.
insert into public.creatives (ad_name, werkstuk_id, user_id, user_name) values
  ('WS - 301', 4, '11111111-1111-1111-1111-111111111111', 'Dustin Gibson'),
  ('WS - 302', 4, '22222222-2222-2222-2222-222222222222', 'Oud Lid');
update marketing_hq.werkstuk_stappen set status='klaar', agent_id=null,
  overdracht='mens', waarom='samen gemaakt', afgerond_op=now() - interval '2 hours'
 where werkstuk_id=4 and station=3;

-- Werkstuk 3: een mens deed station 3, maar er is niets dat zegt wie. Dit is
-- het geval dat naamloos moet blijven.
update marketing_hq.werkstuk_stappen set status='klaar', agent_id=null,
  overdracht='mens', waarom='bestond al vóór de estafette', afgerond_op=now() - interval '400 hours'
 where werkstuk_id=3 and station=3;
SQL
  fi
done

# ── 1. één lijst met iedereen ─────────────────────────────────────────────
echo "  mensen en agents in één lijst"
check "negen agents en drie teamleden" 12 "$(q "select count(*) from marketing_hq.deelnemers")"
check "een agent heet zoals hij heet" "Nova" \
  "$(q "select naam from marketing_hq.deelnemers where id='nova'")"
check "een teamlid ook" "Dustin Gibson" \
  "$(q "select naam from marketing_hq.deelnemers where id='11111111-1111-1111-1111-111111111111'")"
# Een leeg naamveld mag nooit als lege naam op het scherm komen.
check "zonder ingevulde naam valt hij terug op het e-mailadres" "yvonne@wellshave.com" \
  "$(q "select naam from marketing_hq.deelnemers where id='33333333-3333-3333-3333-333333333333'")"
check "niemand in de lijst heeft een lege naam" 0 \
  "$(q "select count(*) from marketing_hq.deelnemers where naam is null or trim(naam)=''")"
check "en het soort staat erbij" "agent|mens" \
  "$(q "select string_agg(distinct soort,'|' order by soort) from marketing_hq.deelnemers")"
check "een afgewezen teamlid staat er wel in maar niet als actief" "false" \
  "$(q "select actief::text from marketing_hq.deelnemers where id='22222222-2222-2222-2222-222222222222'")"

# ── 2. terugwerkend invullen wat blijkt, en niet meer dan dat ─────────────
echo
echo "  wat uit de gegevens blijkt, en alleen dat"
check "de stap met een herleidbare maker kreeg een naam" "Dustin Gibson" \
  "$(q "select d.naam from marketing_hq.werkstuk_stappen s
        join marketing_hq.deelnemers d on d.id = s.mens_id::text
        where s.werkstuk_id=2 and s.station=3")"
check "de stap zonder herleidbare maker bleef leeg" "" \
  "$(q "select mens_id::text from marketing_hq.werkstuk_stappen where werkstuk_id=3 and station=3")"
# Dit is de kern: niet gokken. Zou hier een naam staan, dan stond er een
# verzonnen feit in de geschiedenis.
# Twee makers onder één werkstuk: dan valt niet te zeggen wie de stap deed.
check "bij twee verschillende makers blijft de stap naamloos" "" \
  "$(q "select mens_id::text from marketing_hq.werkstuk_stappen where werkstuk_id=4 and station=3")"
check "er is niemand ingevuld die dat niet verdiende" 1 \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen where mens_id is not null")"

# ── 3. de regel zelf ──────────────────────────────────────────────────────
echo
echo "  zodra er gewerkt is, staat er een naam bij"
check "een afgeronde stap zonder deelnemer wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen set status='klaar', waarom='x', agent_id=null, mens_id=null
              where werkstuk_id=1 and station=2" "precies_een_deelnemer")"
check "een stap die er twee noemt ook" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen
              set status='bezig', agent_id='nova', mens_id='11111111-1111-1111-1111-111111111111'
              where werkstuk_id=1 and station=2" "precies_een_deelnemer")"
# Niet de psql-melding controleren maar wat er daarna staat: dat is wat telt,
# en het leest ook als de zin die de regel beschrijft.
check "met een agent mag het" "nova" \
  "$(q "update marketing_hq.werkstuk_stappen set status='bezig', agent_id='nova', mens_id=null
        where werkstuk_id=1 and station=2;
        select agent_id from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=2")"
check "met een mens ook" "Dustin Gibson" \
  "$(q "update marketing_hq.werkstuk_stappen
        set status='bezig', agent_id=null, mens_id='11111111-1111-1111-1111-111111111111'
        where werkstuk_id=1 and station=3;
        select d.naam from marketing_hq.werkstuk_stappen s
        join marketing_hq.deelnemers d on d.id = s.mens_id::text
        where s.werkstuk_id=1 and s.station=3")"
# Een stap waar nog niemand aan begonnen is, hoort geen naam te hebben.
check "een open stap mag naamloos blijven" "open" \
  "$(q "update marketing_hq.werkstuk_stappen set status='open', agent_id=null, mens_id=null
        where werkstuk_id=1 and station=5;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=5")"
check "een onbekend teamlid bestaat niet" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen
              set status='bezig', agent_id=null, mens_id='99999999-9999-9999-9999-999999999999'
              where werkstuk_id=1 and station=4" "foreign key")"

# ── 4. de estafette noemt namen ───────────────────────────────────────────
echo
echo "  de keten laat zien wie wat deed"
check "een agentstap noemt de agent" "Radar" \
  "$(q "select s->>'door' from marketing_hq.werkstuk_estafette w,
        jsonb_array_elements(w.stappen) s where w.id=1 and (s->>'station')::int=1")"
check "en zegt dat het een agent was" "agent" \
  "$(q "select s->>'door_soort' from marketing_hq.werkstuk_estafette w,
        jsonb_array_elements(w.stappen) s where w.id=1 and (s->>'station')::int=1")"
check "een mensstap noemt het teamlid" "Dustin Gibson" \
  "$(q "select s->>'door' from marketing_hq.werkstuk_estafette w,
        jsonb_array_elements(w.stappen) s where w.id=2 and (s->>'station')::int=3")"
check "en zegt dat het een mens was" "mens" \
  "$(q "select s->>'door_soort' from marketing_hq.werkstuk_estafette w,
        jsonb_array_elements(w.stappen) s where w.id=2 and (s->>'station')::int=3")"
check "de naamloze stap uit juli zegt eerlijk niets" "" \
  "$(q "select coalesce(s->>'door','') from marketing_hq.werkstuk_estafette w,
        jsonb_array_elements(w.stappen) s where w.id=3 and (s->>'station')::int=3")"
check "de keten blijft zes stations lang" 6 \
  "$(q "select jsonb_array_length(stappen) from marketing_hq.werkstuk_estafette where id=1")"

echo
echo "  ook het startsein heeft een naam"
check "gestart door een agent" "Radar" \
  "$(q "select gestart_door_naam from marketing_hq.werkstuk_estafette where id=1")"
check "gestart door een mens, zolang niemand het invulde: onbekend" "onbekend" \
  "$(q "select gestart_door_naam from marketing_hq.werkstuk_estafette where id=2")"
check "en met een naam erbij wél" "Dustin Gibson" \
  "$(q "update marketing_hq.werkstukken set gestart_door_mens='11111111-1111-1111-1111-111111111111' where id=2;
        select gestart_door_naam from marketing_hq.werkstuk_estafette where id=2")"

# ── 5. wat er al stond blijft werken ──────────────────────────────────────
echo
echo "  0009 en 0017 blijven gelden"
check "de toestand wordt nog steeds afgeleid" "loopt" \
  "$(q "select toestand from marketing_hq.werkstuk_estafette where id=1")"
check "geen view zonder security_invoker" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
