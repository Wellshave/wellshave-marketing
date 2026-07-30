#!/usr/bin/env bash
# Testlus voor migratie 0009 (de ruggengraat) en 0010 (de bezetting).
#
# Start een wegwerp-Postgres, bouwt een stand-in van het echte schema, draait de
# migratie erop en controleert de regels die er echt toe doen. Raakt de
# productiedatabase niet aan.
#
#   bash platform/db/test/ruggengraat.sh
#
# Vereist een lokale postgres (getest met 16). Draai het niet als root: initdb
# weigert dat, dus het script schakelt zelf naar de postgres-gebruiker.

set -uo pipefail
MIG="$(cd "$(dirname "$0")/../migrations" && pwd)/0009_ruggengraat.sql"
WERK="${TMPDIR:-/tmp}/ruggengraat-test-$$"
PORT=${PGTESTPORT:-5433}
# su zet PATH terug naar een veilige standaard, dus postgres-binaries
# worden hieronder met hun volledige pad aangeroepen.
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
export PATH="$PATH:$BIN"
UID_PG=$(id -un postgres 2>/dev/null || echo "$(id -un)")

fout=0
check() {                    # check <label> <verwacht> <gekregen>
  if [ "$2" = "$3" ]; then printf '  ok   %s\n' "$1"
  else fout=$((fout+1)); printf '  FOUT %s\n       verwacht %s, kreeg %s\n' "$1" "$2" "$3"; fi
}
q() { psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c "$1" 2>/dev/null | tr -d ' '; }
# stderr MOET op stdout komen, want de melding zelf is het antwoord.
qerr() { psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c "$1" 2>&1; }

# Geeft 'ja' als de database dit weigert met een check-constraint.
# Bewust zonder pijp naar grep: psql sluit bij een geweigerde query af met een
# foutcode -- precies wat we willen -- maar met `set -o pipefail` maakt dat de
# hele pijp fout, ook als grep de melding wel vindt. Dan lijkt elke geslaagde
# weigering een mislukking.
weigert() {
  local uit; uit=$(qerr "$1")
  case "$uit" in *"check constraint"*) echo ja ;; *) echo nee ;; esac
}

opruimen() {
  su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -m immediate stop" >/dev/null 2>&1
  rm -rf "$WERK"
}
trap opruimen EXIT

mkdir -p "$WERK"; chown -R "$UID_PG" "$WERK" 2>/dev/null
su "$UID_PG" -c "$BIN/initdb -D $WERK -U postgres -A trust --locale=C -E UTF8" >/dev/null 2>&1 || {
  echo "  initdb mislukt — staat postgres geïnstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

# ── stand-in van het echte schema ─────────────────────────────────────────
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated; create role anon;
create function marketing_hq.is_team_member() returns boolean language sql as $$ select true $$;
create table marketing_hq.agents (id text primary key, name text not null, role text not null default '',
  phase int not null default 1, status text not null default 'idle', current_task text,
  last_run_at timestamptz, created_at timestamptz not null default now());
create table marketing_hq.agent_runs        (id bigint generated always as identity primary key, agent_id text);
create table marketing_hq.approvals         (id bigint generated always as identity primary key, titel text);
create table marketing_hq.reports           (id bigint generated always as identity primary key, author_agent text);
create table marketing_hq.pipeline_items    (id bigint generated always as identity primary key, angle text);
create table marketing_hq.email_drafts      (id bigint generated always as identity primary key, angle text);
create table marketing_hq.meta_publications (id bigint generated always as identity primary key, creative_id bigint);
create table marketing_hq.agent_messages    (id bigint generated always as identity primary key, subject text);
create table marketing_hq.creative_results  (creative_id bigint, spend numeric, purchase_value numeric,
                                             impressions bigint, clicks bigint, roas numeric, beoordeelbaar boolean);
create table public.creatives (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  ad_name text, product text, persona text, angle_type text,
  status text default 'To Test', created_at timestamptz default now());
insert into marketing_hq.agents (id,name) values
  ('radar','Radar'),('nova','Nova'),('pixel','Pixel'),('quill','Quill'),('bolt','Bolt'),
  ('atlas','Atlas'),('echo','Echo'),('vector','Vector'),('sage','Sage');
insert into public.creatives (ad_name, product, persona, angle_type, status) values
  ('Nekirritatie v1','Scheerschuim','Man 30-45','Problem-Solution','Winner'),
  ('Nekirritatie v2','Scheerschuim','Man 30-45','Problem-Solution','Live'),
  ('Nekirritatie v3','Scheerschuim','Man 30-45','Problem-Solution','To Test'),
  ('Reviews A','Scheermes','Man 30-45','Social Proof / Reviews','Live'),
  ('Reviews B','Scheermes','Man 30-45','Social Proof / Reviews','Killed'),
  ('Founder story','Scheermes','Man 45+','Storytelling / Narrative','To Test'),
  -- zoals het er echt in staat: product en persona bekend, hoek leeg. Zes
  -- varianten van dezelfde campagne. Die horen bij ELKAAR, niet elk apart.
  ('Jij googelt het ook','Groom Guard','Mark de Vries',null,'To Test'),
  ('Jij googelt het ook','Groom Guard','Mark de Vries',null,'To Test'),
  ('23:47 Incognito','Groom Guard','Mark de Vries',null,'To Test'),
  -- en het enige geval zonder enige metadata: dan wel elk zijn eigen werkstuk
  ('Zonder alles',null,null,null,'To Test'),
  ('Ook zonder alles',null,null,null,'To Test');
insert into marketing_hq.creative_results (creative_id, spend, purchase_value, beoordeelbaar) values
  (1, 400, 1640, true), (2, 260, 520, true), (4, 300, 900, true);
SQL

# ── de migratie ───────────────────────────────────────────────────────────
if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIG" >/dev/null 2>&1; then
  echo "  FOUT de migratie draait niet:"
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIG" 2>&1 | grep -E '^psql:' | head -3
  exit 1
fi
MIG10="$(dirname "$MIG")/0010_bezetting.sql"
if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIG10" >/dev/null 2>&1; then
  echo "  FOUT migratie 0010 draait niet:"
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIG10" 2>&1 | grep -E '^psql:' | head -3
  exit 1
fi
echo "  (0009 en 0010 draaiden zonder fout)"
echo

# ── wat de backfill moet opleveren ────────────────────────────────────────
# 11 creatives -> 6 werkstukken. Drie Nekirritaties horen samen, twee Reviews
# ook, Founder story staat alleen, en de drie Groom Guard-varianten horen bij
# elkaar op product + persona ondanks een lege hoek. Alleen de twee creatives
# zonder enige metadata krijgen elk hun eigen werkstuk: daar is niets om op te
# groeperen.
check "varianten samengevoegd op wat bekend is" 6 "$(q 'select count(*) from marketing_hq.werkstukken')"
check "elke creative heeft een werkstuk"       0 "$(q 'select count(*) from public.creatives where werkstuk_id is null')"
check "creatives zonder enige metadata blijven apart" 2 \
  "$(q "select count(distinct werkstuk_id) from public.creatives where product is null and persona is null")"
# de kern van de fout die de echte data blootlegde
check "lege hoek splitst een campagne niet op" 1 \
  "$(q "select count(distinct werkstuk_id) from public.creatives
        where product='Groom Guard' and persona='Mark de Vries'")"

# De volledige keten is altijd zichtbaar, ook wat nog moet gebeuren.
check "elk werkstuk heeft alle zes stations" 0 \
  "$(q 'select count(*) from (select werkstuk_id from marketing_hq.werkstuk_stappen
        group by werkstuk_id having count(*) <> 6) x')"

# Geschiedenis die er niet was, wordt niet verzonnen.
check "station 1 en 2 staan op niet_vastgelegd" 12 \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen where station in (1,2) and status='niet_vastgelegd'")"
check "geen enkele stap staat ten onrechte op klaar bij station 1-2" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen where station in (1,2) and status='klaar'")"

# ── de cijfers rollen op over varianten heen ──────────────────────────────
# (1640+520)/(400+260) = 2160/660 = 3.273 — eerst tellers optellen, dan delen.
W=$(q "select id from marketing_hq.werkstukken where angle_type='Problem-Solution'")
check "ROAS gewogen over de varianten" "3.273" "$(q "select roas from marketing_hq.werkstuk_estafette where id=$W")"
check "aantal beoordeelde ads"             2    "$(q "select aantal_ads from marketing_hq.werkstuk_estafette where id=$W")"
check "winnaars geteld"                    1    "$(q "select winnaars from marketing_hq.werkstuk_estafette where id=$W")"
check "staat op station 5 (meting)"        5    "$(q "select station_nu from marketing_hq.werkstuk_estafette where id=$W")"

# ── de regels uit het ontwerpcontract, als constraint ─────────────────────
check "'klaar' zonder waarom wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_stappen (werkstuk_id,station,status) values ($W,6,'klaar')")"
check "ook via de functie geweigerd" "ja" \
  "$(weigert "select marketing_hq.werkstuk_stap($W,6::smallint,'klaar',null)")"
check "'gestopt' zonder reden wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.werkstukken set status='gestopt' where id=$W")"

# ── een stap zetten ───────────────────────────────────────────────────────
q "select marketing_hq.werkstuk_stap($W,5::smallint,'bezig',null,'atlas')" >/dev/null
q "select marketing_hq.werkstuk_stap($W,5::smallint,'klaar','Cijfers opgehaald.','atlas')" >/dev/null
check "twee keer zetten geeft één rij" 1 \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen where werkstuk_id=$W and station=5")"
check "begonnen en afgerond zijn beide gezet" "true|true" \
  "$(q "select (begonnen_op is not null)||'|'||(afgerond_op is not null)
        from marketing_hq.werkstuk_stappen where werkstuk_id=$W and station=5")"

# ── de afgeleide toestand ─────────────────────────────────────────────────
W2=$(q "select id from marketing_hq.werkstukken where angle_type='Storytelling / Narrative'")
q "select marketing_hq.werkstuk_stap($W2,4::smallint,'wacht_op_mens',null,'bolt','poort')" >/dev/null
check "wachten op een mens is zichtbaar" "wacht_op_mens" \
  "$(q "select toestand from marketing_hq.werkstuk_estafette where id=$W2")"
q "select marketing_hq.werkstuk_stap($W2,4::smallint,'mislukt','Meta weigerde de upload.','bolt','poort')" >/dev/null
check "een fout weegt zwaarder dan wachten" "vastgelopen" \
  "$(q "select toestand from marketing_hq.werkstuk_estafette where id=$W2")"

# ── niets bestaands is stukgegaan ─────────────────────────────────────────
check "creatives zijn niet aangeraakt behalve de nieuwe kolom" 11 \
  "$(q 'select count(*) from public.creatives')"
check "de nieuwe kolom is nullable"  "YES" \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -c \
     "select is_nullable from information_schema.columns
      where table_schema='public' and table_name='creatives' and column_name='werkstuk_id'" 2>/dev/null | tr -d ' ')"


# ── de negen agents op hun plek (0010) ────────────────────────────────────
echo
echo "  de bezetting"
check "alle negen agents hebben een regel" 9 \
  "$(q 'select count(distinct id) from marketing_hq.agent_bezetting')"
check "vijf zijn operationeel, vier zijn alleen een profiel" "5|4" \
  "$(q "select count(*) filter (where operationeel)||'|'||count(*) filter (where not operationeel)
        from marketing_hq.agents")"
check "station 3 heeft er twee: beeld en tekst" "pixel,quill" \
  "$(q "select string_agg(agent_id,',' order by agent_id) from marketing_hq.agent_stations where station=3")"
check "station 6 heeft er twee: e-mail en landingspagina" "echo,vector" \
  "$(q "select string_agg(agent_id,',' order by agent_id) from marketing_hq.agent_stations where station=6")"
check "Sage staat bewust in geen enkel station" 0 \
  "$(q "select count(*) from marketing_hq.agent_stations where agent_id='sage'")"
check "elk station heeft precies een primaire agent" 6 \
  "$(q 'select count(*) from marketing_hq.agent_stations where primair')"
# twee primairen op een station moet de database weigeren
check "een tweede primair op hetzelfde station wordt geweigerd" "ja" \
  "$(case "$(qerr "update marketing_hq.agent_stations set primair=true where agent_id='quill'")" in
      *"duplicate key"*|*"unique constraint"*) echo ja ;; *) echo nee ;; esac)"
# Bestaande werkstukken hadden een gat bij station 3: die kolom kon maar een
# agent bevatten en het zijn er daar twee. 0010 dicht dat.
check "bestaande werkstukken hebben nu ook Pixel op station 3" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen
        where station=3 and status='open' and agent_id is null")"
# En de trigger haalt hem voortaan uit agent_stations, niet uit een losse kolom.
NIEUW=$(q "insert into marketing_hq.werkstukken (titel) values ('Triggertest') returning id")
check "een nieuw werkstuk krijgt Pixel op station 3" "pixel" \
  "$(q "select agent_id from marketing_hq.werkstuk_stappen where werkstuk_id=$NIEUW and station=3")"
check "en Echo op station 6" "echo" \
  "$(q "select agent_id from marketing_hq.werkstuk_stappen where werkstuk_id=$NIEUW and station=6")"
check "en Radar op station 1" "radar" \
  "$(q "select agent_id from marketing_hq.werkstuk_stappen where werkstuk_id=$NIEUW and station=1")"
check "de oude dubbele kolom is weg" 0 \
  "$(q "select count(*) from information_schema.columns where table_schema='marketing_hq'
        and table_name='werkstuk_stations' and column_name='standaard_agent'")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
