#!/usr/bin/env bash
# Testlus voor migratie 0034 — de onderbouwing van een agent doorlaten.
#
# Er zit één echt risico in deze migratie, en het is niet of de nieuwe kolommen
# doorkomen. Het is of de oude op hun plek blijven staan. `create or replace
# view` accepteert kolommen erbij, maar weigert een kolom verplaatsen of van
# type veranderen — en die weigering komt pas op productie als iemand de
# volgorde per ongeluk netter maakt. Daarom staat de volledige verwachte
# kolomvolgorde hieronder uitgeschreven en niet alleen "bevat cijfers".
#
# Het tweede risico is stiller: `create or replace view` legt de rechten
# opnieuw aan als de view nieuw is. Een view die niemand mag lezen ziet er
# vanaf hier precies zo uit als een view zonder rijen.
#
#   bash platform/db/test/agentzicht.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/agentzicht-test-$$"
PORT=${PGTESTPORT:-5522}
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
  echo "  initdb mislukt — staat postgres geïnstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

# Kolomlijst gelijk aan productie. Wijkt de fixture af, dan test je een andere
# tabel dan er draait en merk je dat pas als het misgaat.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated login; create role anon login;
grant usage on schema marketing_hq, public to authenticated, anon;
create table marketing_hq.reports (
  id bigint generated always as identity primary key, report_date date, kind text,
  title text, author_agent text, vault_path text, body_md text,
  created_at timestamptz default now(), werkstuk_id bigint, periode_start date,
  periode_eind date, voorlopig boolean default false, voorlopig_reden text,
  cijfers jsonb, signalen jsonb, gaten jsonb, account_id text);

-- De view zoals hij op productie stond vóór 0034: acht kolommen, meer niet.
-- Zonder deze regel test de migratie een lege database en niet de vervanging
-- van een bestaande view — precies het geval waarin hij kan weigeren.
create view public.hq_reports with (security_invoker = true) as
select id, report_date, kind, title, author_agent, vault_path, body_md, created_at
from marketing_hq.reports;
grant select on public.hq_reports to authenticated;

insert into marketing_hq.reports
  (report_date, kind, title, author_agent, body_md, account_id,
   periode_start, periode_eind, voorlopig, voorlopig_reden, cijfers, signalen, gaten)
values
  ('2026-08-06','daily','Dagrapport','atlas','# Geen oordeel mogelijk','242238038391551',
   '2026-07-27','2026-08-06', true, 'attributie loopt nog na; 3 gat(en) in de reeks',
   '{"spend": 198.18, "roas": 1.89}'::jsonb,
   '[{"naam":"Meta-koppeling defect","richting":"neer","waarde":"0 rijen"}]'::jsonb,
   '["2026-07-27 t/m 2026-08-05: geen enkele meting"]'::jsonb);
SQL

echo
echo "  de migratie draait op een bestaande view"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0034_agentzicht.sql" 2>&1)
check "0034 draait zonder fout" "0" "$?"
[ $fout -eq 0 ] || { echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; }

echo
echo "  de bestaande kolommen zijn niet verschoven"
# Uitgeschreven en niet geteld: een test die alleen het aantal kolommen
# controleert, slaapt door een omgewisseld paar heen.
check "de eerste acht staan in dezelfde volgorde" \
  "id,report_date,kind,title,author_agent,vault_path,body_md,created_at" \
  "$(q "select string_agg(column_name, ',' order by ordinal_position)
        from information_schema.columns
        where table_schema='public' and table_name='hq_reports' and ordinal_position <= 8")"

echo
echo "  de onderbouwing komt door"
check "alle acht nieuwe kolommen staan erachter" \
  "account_id,periode_start,periode_eind,voorlopig,voorlopig_reden,cijfers,signalen,gaten,werkstuk_id" \
  "$(q "select string_agg(column_name, ',' order by ordinal_position)
        from information_schema.columns
        where table_schema='public' and table_name='hq_reports' and ordinal_position > 8")"
check "voorlopig komt door als waarde en niet als tekst" "t" \
  "$(q "select voorlopig from public.hq_reports limit 1")"
check "met de reden erbij" "attributie loopt nog na; 3 gat(en) in de reeks" \
  "$(q "select voorlopig_reden from public.hq_reports limit 1")"
check "cijfers blijft jsonb en wordt geen string" "1.89" \
  "$(q "select cijfers->>'roas' from public.hq_reports limit 1")"
check "een signaal houdt zijn richting" "neer" \
  "$(q "select signalen->0->>'richting' from public.hq_reports limit 1")"
check "een gat blijft bij naam genoemd" "1" \
  "$(q "select jsonb_array_length(gaten) from public.hq_reports limit 1")"

echo
echo "  de grens eromheen"
check "security_invoker staat nog aan" "t" \
  "$(q "select 'security_invoker=true' = any(reloptions) from pg_class where oid='public.hq_reports'::regclass")"
check "authenticated mag lezen" "t" \
  "$(q "select has_table_privilege('authenticated','public.hq_reports','select')")"
# anon niet: het scherm hangt achter een login en een dagrapport noemt
# accountnummers en bedragen.
check "anon niet" "f" \
  "$(q "select has_table_privilege('anon','public.hq_reports','select')")"

echo
echo "  en op een database die de view nog niet had"
# Dit is het geval waarin de grant er echt toe doet. Vervangt de migratie een
# bestaande view, dan houdt Postgres de rechten vast en lijkt de grant
# overbodig — een test die alleen dat pad loopt, keurt het weglaten goed. Bouwt
# iemand de database op uit deze map, dan is de view splinternieuw en heeft
# alleen postgres toegang. Dan staat het scherm leeg voor het hele team,
# zonder foutmelding, want geen rechten en geen rijen zien er hetzelfde uit.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -c 'drop view public.hq_reports' >/dev/null 2>&1
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 -f "$MIGDIR/0034_agentzicht.sql" >/dev/null 2>&1
check "de migratie legt de view zelf aan" "t" \
  "$(q "select to_regclass('public.hq_reports') is not null")"
check "en het team mag hem lezen" "t" \
  "$(q "select has_table_privilege('authenticated','public.hq_reports','select')")"

echo
[ $fout -eq 0 ] && echo "Alles klopt" || echo "$fout controle(s) mislukt"
exit $((fout > 0))
