#!/usr/bin/env bash
# Testlus voor migratie 0014 — vijf accounts in plaats van één.
#
# De zwaarste controle staat onderaan. Een scorekaart die de mediaan over álle
# accounts vormt, oordeelt een Wellshine-advertentie af tegen het niveau van
# Wellshave. De fixture is zo gebouwd dat precies dat het oordeel omdraait:
# dezelfde advertentie is 'opschalen' binnen zijn eigen account en 'materiaal
# werkt, bestemming niet' zodra de accounts op één hoop gaan.
#
#   bash platform/db/test/accounts.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/accounts-test-$$"
PORT=${PGTESTPORT:-5501}
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
weigert() {
  local uit
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -qtA -c "$2" 2>&1)
  case "$uit" in
    *ERROR*) printf '  ok   %s\n' "$1" ;;
    *) fout=$((fout+1)); printf '  FOUT %s\n       werd geaccepteerd\n' "$1" ;;
  esac
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
create role authenticated; create role anon;
create function marketing_hq.is_team_member() returns boolean language sql as $$ select true $$;

create table marketing_hq.agents (id text primary key, name text not null);
create table marketing_hq.agent_jobs (id bigint generated always as identity primary key,
  agent_id text, kind text);
create table marketing_hq.agent_runs (id bigint generated always as identity primary key,
  agent_id text not null, job_id bigint, status text not null default 'running',
  started_at timestamptz not null default now(), finished_at timestamptz, summary text);
create table marketing_hq.reports (id bigint generated always as identity primary key,
  report_date date not null, kind text not null, title text not null,
  author_agent text, vault_path text, body_md text, werkstuk_id bigint,
  created_at timestamptz not null default now());
create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text, entity_name text,
  spend numeric, impressions bigint, reach bigint, clicks bigint,
  purchases integer, purchase_value numeric,
  add_to_cart integer, initiate_checkout integer, landing_page_views integer,
  quality_ranking text, is_final boolean default true);
insert into marketing_hq.agents values ('atlas','Atlas');
SQL

for m in 0012_atlas 0013_audit 0014_accounts; do
  if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/$m.sql" >/dev/null 2>&1; then
    echo "  FOUT migratie $m draait niet:"
    psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1 \
      | grep -E '^ERROR|^psql:.*ERROR' | head -3
    exit 1
  fi
done
echo "  (0012, 0013 en 0014 draaiden zonder fout)"
echo

# ── De accounts ───────────────────────────────────────────────────────────
echo "  de accounts"
check "alle vijf staan er" 5 "$(q "select count(*) from marketing_hq.ad_accounts")"
check "twee draaien er" 2 "$(q "select count(*) from marketing_hq.ad_accounts where actief")"
check "en dat zijn Wellshave en Wellshine" "Wellshave®|Wellshine B.V." \
  "$(q "select string_agg(naam,'|' order by naam) from marketing_hq.ad_accounts where actief")"
check "de drie stille accounts zijn niet weggelaten" 3 \
  "$(q "select count(*) from marketing_hq.ad_accounts where not actief")"
check "en zeggen alle drie waarom" 3 \
  "$(q "select count(*) from marketing_hq.ad_accounts where not actief and reden is not null")"
check "elk account hangt aan een merk" 0 \
  "$(q "select count(*) from marketing_hq.ad_accounts where merk not in ('wellshave','wellshine')")"
# Een account uitzetten zonder reden is precies hoe je over een half jaar niet
# meer weet waarom er iets stilstaat.
weigert "een account uitzetten zonder reden mag niet" \
  "insert into marketing_hq.ad_accounts (account_id,naam,merk,actief) values ('999','Proef','wellshave',false)"
weigert "en leeggemaakte reden telt niet als reden" \
  "insert into marketing_hq.ad_accounts (account_id,naam,merk,actief,reden) values ('998','Proef','wellshave',false,'   ')"
check "opnieuw draaien verdubbelt niets" 5 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -f "$MIGDIR/0014_accounts.sql" >/dev/null 2>&1;
     q "select count(*) from marketing_hq.ad_accounts")"

# ── Een rapport hoort bij een account ─────────────────────────────────────
echo
echo "  een rapport hoort bij een account"
q "insert into marketing_hq.reports (report_date,kind,title,author_agent,account_id,periode_start,periode_eind,cijfers)
   values (current_date,'audit','Audit','atlas','242238038391551',current_date-30,current_date-4,'{\"spend\":3425.92}')" >/dev/null
check "een audit draagt zijn account" "242238038391551" \
  "$(q "select account_id from marketing_hq.reports where kind='audit'")"
weigert "een onbekend account wordt geweigerd" \
  "insert into marketing_hq.reports (report_date,kind,title,author_agent,account_id,cijfers)
   values (current_date,'audit','Fout','atlas','000000',' {}')"
# Twee audits op dezelfde dag over verschillende accounts moeten naast elkaar
# kunnen bestaan.
q "insert into marketing_hq.reports (report_date,kind,title,author_agent,account_id,periode_start,periode_eind,cijfers)
   values (current_date,'audit','Audit','atlas','2776743939329385',current_date-30,current_date-4,'{\"spend\":1207.74}')" >/dev/null
check "twee audits van dezelfde dag staan naast elkaar" 2 \
  "$(q "select count(*) from marketing_hq.reports where kind='audit'")"

# ── Dekking per account ───────────────────────────────────────────────────
echo
echo "  dekking, per account"
check "dertig dagen maal twee draaiende accounts" 60 \
  "$(q "select count(*) from marketing_hq.meting_dekking")"
check "de stille accounts staan er niet in" 0 \
  "$(q "select count(*) from marketing_hq.meting_dekking where account_id='828830209039992'")"
check "en er is geen enkele rij zonder account" 0 \
  "$(q "select count(*) from marketing_hq.meting_dekking where account_id is null")"

# Eén dag gemeten bij Wellshave, niet bij Wellshine. Vóór 0014 was dat verschil
# niet uit te drukken: er was één rij per dag.
q "insert into marketing_hq.meta_insights_daily
   (insight_date, account_id, level, entity_id, spend, is_final)
   values (current_date-10,'242238038391551','account','242238038391551',120,true)" >/dev/null
check "Wellshave is die dag compleet" "compleet" \
  "$(q "select staat from marketing_hq.meting_dekking
        where dag=current_date-10 and account_id='242238038391551'")"
check "en Wellshine dezelfde dag ontbreekt" "ontbreekt" \
  "$(q "select staat from marketing_hq.meting_dekking
        where dag=current_date-10 and account_id='2776743939329385'")"

# ── Het overzicht ─────────────────────────────────────────────────────────
echo
echo "  het overzicht"
check "alle vijf staan in het overzicht" 5 "$(q "select count(*) from marketing_hq.accounts_overzicht")"
check "de primaire accounts staan bovenaan" "Wellshave®|Wellshine B.V." \
  "$(q "select string_agg(naam,'|') from (select naam from marketing_hq.accounts_overzicht limit 2) t")"
check "een stil account heet 'staat uit'" "staat uit" \
  "$(q "select staat from marketing_hq.accounts_overzicht where account_id='828830209039992'")"
check "een actief account zonder cijfers wordt niet stilzwijgend nul" "actief, maar nog nooit opgehaald" \
  "$(q "select staat from marketing_hq.accounts_overzicht where account_id='2776743939329385'")"
check "en achterlopen wordt benoemd met het aantal dagen" "actief, maar al 10 dagen niets opgehaald" \
  "$(q "select staat from marketing_hq.accounts_overzicht where account_id='242238038391551'")"

# ── De mediaan blijft binnen zijn eigen account ───────────────────────────
echo
echo "  de mediaan blijft binnen zijn eigen account"
# Wellshave draait op een hoger niveau dan Wellshine. Advertentie F hoort bij
# Wellshine en zit daar bovengemiddeld; op één hoop met Wellshave zou hij
# ondergemiddeld lijken en een ander oordeel krijgen.
#
#   Wellshave  ROAS 1,8 / 2,0 / 2,4   mediaan 2,000   CTR 1,0 / 1,5 / 2,0  mediaan 1,500
#   Wellshine  ROAS 0,7 / 0,9 / 1,2   mediaan 0,900   CTR 0,5 / 0,8 / 1,1  mediaan 0,800
#   samen      mediaan ROAS 1,500, mediaan CTR 1,050
#
# F heeft ROAS 1,2 en CTR 1,1: binnen Wellshine boven op beide, samengevoegd
# onder op ROAS en net boven op CTR.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q >/dev/null 2>&1 <<'SQL'
insert into marketing_hq.meta_insights_daily
 (insight_date, account_id, level, entity_id, entity_name, spend, impressions, clicks, purchases, purchase_value)
values
 (current_date-5,'242238038391551','ad','A','WS-A',100,10000,100,5,180),
 (current_date-5,'242238038391551','ad','B','WS-B',100,10000,150,5,200),
 (current_date-5,'242238038391551','ad','C','WS-C',100,10000,200,6,240),
 (current_date-5,'2776743939329385','ad','D','WN-D',100,10000, 50,2, 70),
 (current_date-5,'2776743939329385','ad','E','WN-E',100,10000, 80,3, 90),
 (current_date-5,'2776743939329385','ad','F','WN-F',100,10000,110,4,120);
SQL
check "elke account heeft zijn eigen mediaan" "2.000|0.900" \
  "$(q "select string_agg(m,'|' order by m desc) from
        (select distinct round(roas_mediaan,3)::text as m
         from marketing_hq.advertentie_scorekaart where roas_mediaan is not null) t")"
check "en telt drie soortgenoten, niet zes" "3" \
  "$(q "select distinct soortgenoten::text from marketing_hq.advertentie_scorekaart")"
check "F is bovengemiddeld binnen Wellshine en mag opschalen" "opschalen" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='F'")"
# Zou de mediaan over beide accounts gaan, dan stond hier 'materiaal werkt,
# bestemming niet' — een advertentie afgerekend op het niveau van een ander merk.
check "en zou op één hoop een ander oordeel krijgen" "t" \
  "$(q "select (select percentile_cont(0.5) within group (order by roas)
                from (select sum(purchase_value)/sum(spend) as roas
                      from marketing_hq.meta_insights_daily where level='ad'
                      group by entity_id) t) > 1.2")"
check "D is verliesgevend en wordt gestopt" "stoppen" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='D'")"
check "A blijft staan: onder de mediaan maar boven break-even" "houden, niet opschalen" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='A'")"

# ── De trechter scheidt de accounts ook ───────────────────────────────────
echo
echo "  de trechter scheidt de accounts ook"
check "zes advertentierijen, netjes per account" "3|3" \
  "$(q "select string_agg(n::text,'|' order by n) from
        (select count(*) n from marketing_hq.trechter where level='ad' group by account_id) t")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
