#!/usr/bin/env bash
# Testlus voor migratie 0012 — Atlas.
#
# Wat hier bewezen moet worden is niet dat de views draaien, maar dat de
# guardrail bijt. De regel "cijfers jonger dan 72 uur zijn voorlopig" staat nu
# in een prompt; de vraag is of een agent er nog omheen kan als hij het
# tegenovergestelde beweert. Elke controle hieronder doet daarom eerst iets
# wat niet mag, en kijkt dan wat de database ervan maakt.
#
# Draait op een wegwerp-Postgres. Raakt de productiedatabase niet aan.
#
#   bash platform/db/test/atlas.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/atlas-test-$$"
PORT=${PGTESTPORT:-5497}
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

# Een geweigerde insert is hier een geslaagde controle. psql geeft dan een
# exitcode terug die niet nul is, dus het antwoord wordt opgevangen in plaats
# van doorgesluisd — anders zou pipefail elke goede afloop als fout tellen.
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

# ── stand-in van het echte schema ─────────────────────────────────────────
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated; create role anon;
create function marketing_hq.is_team_member() returns boolean language sql as $$ select true $$;

create table marketing_hq.agents (id text primary key, name text not null,
  role text not null default 'x', operationeel boolean not null default false);
create table marketing_hq.agent_jobs (id bigint generated always as identity primary key,
  agent_id text, kind text, status text default 'done');
create table marketing_hq.agent_runs (id bigint generated always as identity primary key,
  agent_id text not null, job_id bigint, status text not null default 'running',
  started_at timestamptz not null default now(), finished_at timestamptz, summary text);
create table marketing_hq.reports (id bigint generated always as identity primary key,
  report_date date not null, kind text not null, title text not null,
  author_agent text, vault_path text, body_md text, werkstuk_id bigint,
  created_at timestamptz not null default now());
create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text,
  spend numeric, is_final boolean default true);

insert into marketing_hq.agents (id, name, role, operationeel) values
  ('atlas','Atlas','Data-analyst', true);

-- ── de reeks waar het om draait ──────────────────────────────────────────
-- Vier soorten dag naast elkaar, want `meting_dekking` moet ze uit elkaar
-- houden. De data staat bewust relatief aan vandaag: de 72-uursgrens schuift
-- mee met de kalender, en een test met vaste datums zou over drie dagen iets
-- anders meten dan vandaag.
--
--   gisteren        gemeten, maar binnen de 72 uur   -> voorlopig
--   10 dagen terug  gemeten en afgesloten            -> compleet
--   11 dagen terug  gemeten, is_final = false        -> niet afgesloten
--   12 dagen terug  geen enkele rij                  -> ontbreekt
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, spend, is_final) values
  (current_date - 1,  'act_1','account','act_1', 100, false),
  (current_date - 10, 'act_1','account','act_1', 120, true),
  (current_date - 11, 'act_1','account','act_1',  90, false);
SQL

if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/0012_atlas.sql" >/dev/null 2>&1; then
  echo "  FOUT migratie 0012 draait niet:"
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0012_atlas.sql" 2>&1 \
    | grep -E '^ERROR|^psql:.*ERROR' | head -3
  exit 1
fi
echo "  (0012 draaide zonder fout)"
echo

# ── de afspraak ───────────────────────────────────────────────────────────
echo "  de afspraak"
check "Atlas heeft twee opdrachten vastgelegd" 2 \
  "$(q "select count(*) from marketing_hq.agent_afspraken where agent_id='atlas'")"
check "de terugkoppeling is een systeemtaak, geen model" "systeem" \
  "$(q "select soort from marketing_hq.agent_afspraken where agent_id='atlas' and kind='feedback_sync'")"
check "opnieuw draaien verdubbelt niets" 2 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -f "$MIGDIR/0012_atlas.sql" >/dev/null 2>&1;
     q "select count(*) from marketing_hq.agent_afspraken where agent_id='atlas'")"
weigert "een afspraak zonder stiltegrens mag niet" \
  "insert into marketing_hq.agent_afspraken (agent_id,kind,cadans,levert,doel_tabel,lat,max_stilte_uren)
   values ('atlas','proef','x','y','reports','z',0)"

# ── de guardrail ──────────────────────────────────────────────────────────
echo
echo "  de guardrail: wie over verse cijfers schrijft, schrijft voorlopig"
# Precies wat een gehaaste agent zou doen: een rapport over gisteren, expliciet
# als definitief weggeschreven. De database corrigeert dat, en zegt waarom.
q "insert into marketing_hq.reports (report_date,kind,title,author_agent,periode_start,periode_eind,voorlopig,cijfers)
   values (current_date,'daily','Gisteren','atlas',current_date-1,current_date-1,false,'{\"spend\":100}')" >/dev/null
check "een rapport over gisteren wordt voorlopig, ook al zei de agent van niet" "t" \
  "$(q "select voorlopig from marketing_hq.reports where title='Gisteren'")"
check "en de reden staat erbij" "t" \
  "$(q "select voorlopig_reden like 'attributie loopt nog na%' from marketing_hq.reports where title='Gisteren'")"

q "insert into marketing_hq.reports (report_date,kind,title,author_agent,periode_start,periode_eind,voorlopig,cijfers)
   values (current_date,'daily','Vorige week','atlas',current_date-14,current_date-8,false,'{\"spend\":700}')" >/dev/null
check "een afgesloten periode blijft definitief" "f" \
  "$(q "select voorlopig from marketing_hq.reports where title='Vorige week'")"
check "en krijgt geen verzonnen reden" "" \
  "$(q "select coalesce(voorlopig_reden,'') from marketing_hq.reports where title='Vorige week'")"

# Tweede grond voor voorlopig: een gat in de reeks. Een conclusie op een
# onvolledige basis is niet definitief, hoe oud de dagen ook zijn.
q "insert into marketing_hq.reports (report_date,kind,title,author_agent,periode_start,periode_eind,voorlopig,cijfers,gaten)
   values (current_date,'daily','Met gaten','atlas',current_date-14,current_date-8,false,'{\"spend\":400}',
           '[\"2026-07-12\",\"2026-07-13\"]')" >/dev/null
check "een gat maakt het rapport voorlopig" "t" \
  "$(q "select voorlopig from marketing_hq.reports where title='Met gaten'")"
check "en het gat wordt bij naam genoemd" "2 gat(en) in de reeks" \
  "$(q "select voorlopig_reden from marketing_hq.reports where title='Met gaten'")"

# De agent mag strenger zijn dan de regel — maar niet zwijgend.
q "insert into marketing_hq.reports (report_date,kind,title,author_agent,periode_start,periode_eind,voorlopig,cijfers)
   values (current_date,'daily','Zelf twijfel','atlas',current_date-14,current_date-8,true,'{\"spend\":700}')" >/dev/null
check "eigen twijfel mag, maar krijgt wel een reden" "als voorlopig gemarkeerd door de auteur" \
  "$(q "select voorlopig_reden from marketing_hq.reports where title='Zelf twijfel'")"

# De trigger hoort ook bij een wijziging te lopen: anders schrijf je eerst een
# oude periode weg en verzet je hem daarna.
q "update marketing_hq.reports set periode_eind = current_date - 1 where title='Vorige week'" >/dev/null
check "achteraf de periode verzetten helpt ook niet" "t" \
  "$(q "select voorlopig from marketing_hq.reports where title='Vorige week'")"

echo
echo "  de guardrail: geen dagrapport zonder cijfers"
weigert "een dagrapport zonder cijfers wordt geweigerd" \
  "insert into marketing_hq.reports (report_date,kind,title,author_agent)
   values (current_date,'daily','Alleen proza','atlas')"
q "insert into marketing_hq.reports (report_date,kind,title,author_agent)
   values (current_date,'deep_dive','Een verhaal','atlas')" >/dev/null
check "een ander soort rapport mag wel zonder" 1 \
  "$(q "select count(*) from marketing_hq.reports where title='Een verhaal'")"
weigert "een periode die achteruit loopt wordt geweigerd" \
  "insert into marketing_hq.reports (report_date,kind,title,author_agent,periode_start,periode_eind,cijfers)
   values (current_date,'daily','Omgekeerd','atlas',current_date-1,current_date-9,'{\"spend\":1}')"

# ── wat ontbreekt ─────────────────────────────────────────────────────────
echo
echo "  wat ontbreekt, als feit"
check "dertig dagen in beeld" 30 "$(q "select count(*) from marketing_hq.meting_dekking")"
check "een dag zonder rijen heet ontbreekt" "ontbreekt" \
  "$(q "select staat from marketing_hq.meting_dekking where dag = current_date - 12")"
check "en telt niet als nul spend" "" \
  "$(q "select coalesce(spend::text,'') from marketing_hq.meting_dekking where dag = current_date - 12")"
check "gisteren is gemeten maar voorlopig" "voorlopig" \
  "$(q "select staat from marketing_hq.meting_dekking where dag = current_date - 1")"
check "een oude afgesloten dag is compleet" "compleet" \
  "$(q "select staat from marketing_hq.meting_dekking where dag = current_date - 10")"
check "een oude open dag is niet afgesloten" "niet afgesloten" \
  "$(q "select staat from marketing_hq.meting_dekking where dag = current_date - 11")"
check "drie van de dertig dagen zijn gemeten" 3 \
  "$(q "select count(*) from marketing_hq.meting_dekking where gemeten")"

# ── nakoming ──────────────────────────────────────────────────────────────
echo
echo "  nakoming"
check "zonder run heet dat nog nooit gedraaid" "nog nooit gedraaid|nog nooit gedraaid" \
  "$(q "select string_agg(oordeel,'|' order by kind) from marketing_hq.agent_nakoming where agent_id='atlas'")"

q "insert into marketing_hq.agent_jobs (id, agent_id, kind) overriding system value values (1,'atlas','daily_report')" >/dev/null
q "insert into marketing_hq.agent_runs (agent_id, job_id, status, started_at)
   values ('atlas', 1, 'done', now() - interval '40 hours')" >/dev/null
check "veertig uur stilte bij een grens van dertig heet te laat" "te laat" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas' and kind='daily_report'")"

q "update marketing_hq.agent_runs set started_at = now() - interval '2 hours' where job_id = 1" >/dev/null
q "delete from marketing_hq.reports where author_agent='atlas'" >/dev/null
check "op tijd gedraaid maar niets geleverd is niet goed genoeg" "gedraaid, niets geleverd" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas' and kind='daily_report'")"

q "insert into marketing_hq.reports (report_date,kind,title,author_agent,periode_start,periode_eind,cijfers)
   values (current_date,'daily','Vandaag','atlas',current_date-7,current_date-4,'{\"spend\":300}')" >/dev/null
check "met een rapport erbij is het op tijd" "op tijd" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas' and kind='daily_report'")"

# Een run zonder job komt uit de oude claude.ai-Routine. Die mag het beeld niet
# opfleuren — dezelfde grens als in 0010.
q "update marketing_hq.agent_runs set started_at = now() - interval '40 hours' where job_id = 1" >/dev/null
q "insert into marketing_hq.agent_runs (agent_id, job_id, status) values ('atlas', null, 'done')" >/dev/null
check "een run zonder job telt niet mee" "te laat" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas' and kind='daily_report'")"

q "insert into marketing_hq.agent_jobs (id, agent_id, kind) overriding system value values (2,'atlas','daily_report')" >/dev/null
q "insert into marketing_hq.agent_runs (agent_id, job_id, status) values ('atlas', 2, 'failed')" >/dev/null
check "een mislukte laatste run overschaduwt de rest" "laatste run mislukt" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas' and kind='daily_report'")"

q "update marketing_hq.agent_afspraken set actief=false where agent_id='atlas' and kind='daily_report'" >/dev/null
check "een uitgezette afspraak klaagt niet" "uit" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas' and kind='daily_report'")"

# ── het dagrapport ────────────────────────────────────────────────────────
echo
echo "  het dagrapport"
check "alleen dagrapporten staan erin" 1 \
  "$(q "select count(*) from marketing_hq.atlas_dagrapport")"
check "de periode telt inclusief de laatste dag" 4 \
  "$(q "select periode_dagen from marketing_hq.atlas_dagrapport where title='Vandaag'")"
check "het beeld blijft leesbaar zonder gaten" 0 \
  "$(q "select aantal_gaten from marketing_hq.atlas_dagrapport where title='Vandaag'")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
