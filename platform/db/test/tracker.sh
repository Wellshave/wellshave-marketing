#!/usr/bin/env bash
# Testlus voor migratie 0011 — de datalaag onder de test tracker.
#
# Draait 0008 (waar creative_results vandaan komt) en 0011 op een wegwerp-
# Postgres, met een gecontroleerde reeks waarvan de uitkomsten met de hand na
# te rekenen zijn. Raakt de productiedatabase niet aan.
#
#   bash platform/db/test/tracker.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/tracker-test-$$"
PORT=${PGTESTPORT:-5495}
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

opruimen() { su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -m immediate stop" >/dev/null 2>&1; rm -rf "$WERK"; }
trap opruimen EXIT

mkdir -p "$WERK"; chown -R "$UID_PG" "$WERK" 2>/dev/null
su "$UID_PG" -c "$BIN/initdb -D $WERK -U postgres -A trust --locale=C -E UTF8" >/dev/null 2>&1 || {
  echo "  initdb mislukt — staat postgres geïnstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

# ── stand-in van het echte schema ─────────────────────────────────────────
# De echte kolommen, want 0008 en 0011 leunen erop.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated; create role anon;
create function marketing_hq.is_team_member() returns boolean language sql as $$ select true $$;

create table marketing_hq.agents (id text primary key, name text not null);
create table marketing_hq.agent_runs (id bigint generated always as identity primary key,
  agent_id text, job_id bigint);
create table marketing_hq.approvals (id bigint generated always as identity primary key, titel text);
-- 0008 zet onderaan de ochtendcyclus in schedules; zonder die tabel valt hij om
create table marketing_hq.schedules (id text primary key, agent_id text, kind text, cron text,
  payload jsonb, enabled boolean default true, last_fired_at timestamptz,
  next_due_at timestamptz, created_at timestamptz default now());
create table marketing_hq.meta_recommendations (id bigint generated always as identity primary key,
  ad_id text, creative_id bigint, agent_id text, run_id bigint, verdict text, action text,
  created_at timestamptz default now());
create table marketing_hq.meta_publications (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  creative_id bigint, meta_ad_id text, published_at timestamptz, status text);
create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text, entity_name text, parent_id text,
  spend numeric, impressions bigint, reach bigint, frequency numeric, clicks bigint,
  link_clicks bigint, ctr numeric, cpc numeric, cpm numeric, purchases bigint,
  purchase_value numeric, roas numeric, add_to_cart bigint, initiate_checkout bigint,
  landing_page_views bigint, video_3s bigint, video_thruplay bigint,
  quality_ranking text, engagement_rate_ranking text, conversion_rate_ranking text,
  is_final boolean default true, captured_at timestamptz default now());

create table public.creatives (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  ad_name text, product text, persona text, angle_type text, format text, media_type text,
  hook_short text, awareness_level text, marketing_angle text, creative_concept text,
  status text default 'To Test', score numeric, next_step text, notes text,
  date_live date, budget numeric, impressions bigint, hook_rate numeric, hold_rate numeric,
  ctr numeric, cpm numeric, cpc numeric, conversions bigint, cvr numeric, cpa numeric,
  aov numeric, roas numeric, creatives_link text, image_b64 text, has_image boolean,
  werkstuk_id bigint, created_at timestamptz default now(), updated_at timestamptz default now());

-- ── de reeks waar het om draait ──────────────────────────────────────────
-- Een advertentie die zichtbaar inzakt, met WISSELENDE spend per dag. Dat
-- laatste is geen detail maar de hele reden dat deze reeks iets bewijst: bij
-- een constante spend is het gemiddelde van de dagelijkse ROAS-waarden precies
-- gelijk aan de ROAS over de hele periode, en dan kan de test de goede en de
-- foute rekenmethode niet uit elkaar houden.
--
--   dag  spend  omzet   ROAS die dag   lopend (som omzet / som spend)
--    1     10     50        5,000        50/10   = 5,000
--    2     90     90        1,000       140/100  = 1,400
--    3     50     50        1,000       190/150  = 1,267
--    4     25     10        0,400       200/175  = 1,143
--    5     25     10        0,400       210/200  = 1,050
--
-- Het gemiddelde van de dagratio's zou op dag 5 uitkomen op 1,56. De juiste
-- uitkomst is 1,050. Die twee liggen ver uit elkaar, en dat hoort ook.
insert into public.creatives (ad_name, product, persona, angle_type, status, image_b64, has_image)
values ('Zakker','Groom Guard','Mark','Problem-Solution','Live', repeat('x', 4000), true);
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, published_at, status)
values (1, 'ad_zak', '2026-07-01', 'live');
insert into marketing_hq.meta_insights_daily
  (insight_date, level, entity_id, spend, impressions, clicks, link_clicks,
   purchases, purchase_value, video_3s, video_thruplay, is_final)
values
  ('2026-07-01','ad','ad_zak', 10, 5000, 100, 90, 2, 50, 1500, 450, true),
  ('2026-07-02','ad','ad_zak', 90, 5000, 100, 90, 3, 90, 1500, 450, true),
  ('2026-07-03','ad','ad_zak', 50, 5000, 100, 90, 2, 50, 1500, 450, true),
  ('2026-07-04','ad','ad_zak', 25, 5000, 100, 90, 1, 10, 1500, 450, true),
  ('2026-07-05','ad','ad_zak', 25, 5000, 100, 90, 1, 10, 1500, 450, true);

-- Drie soortgenoten bij persona 'Piet' zodat een vergelijking mag; ROAS 1, 2, 3
-- geeft mediaan 2. En één losse bij 'Jan' die er te weinig heeft.
insert into public.creatives (ad_name, product, persona, angle_type, status) values
  ('Peer A','Groom Guard','Piet','Social Proof / Reviews','Live'),
  ('Peer B','Groom Guard','Piet','Social Proof / Reviews','Live'),
  ('Peer C','Groom Guard','Piet','Social Proof / Reviews','Live'),
  ('Eenling','Groom Guard','Jan','Storytelling / Narrative','Live');
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, published_at, status) values
  (2,'ad_a','2026-07-01','live'), (3,'ad_b','2026-07-01','live'),
  (4,'ad_c','2026-07-01','live'), (5,'ad_e','2026-07-01','live');
-- elk 5 dagen x €20 = €100 spend, 25.000 vertoningen: ruim boven de drempel
insert into marketing_hq.meta_insights_daily
  (insight_date, level, entity_id, spend, impressions, clicks, link_clicks,
   purchases, purchase_value, video_3s, video_thruplay, is_final)
select d::date, 'ad', e.id, 20, 5000, 100, 90, 2, e.omzet, 1500, 450, true
from generate_series('2026-07-01'::date, '2026-07-05'::date, '1 day') d,
     (values ('ad_a', 20), ('ad_b', 40), ('ad_c', 60), ('ad_e', 40)) as e(id, omzet);
SQL

for m in 0008_terugkoppeling 0011_tracker; do
  if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/$m.sql" >/dev/null 2>&1; then
    echo "  FOUT migratie $m draait niet:"
    psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1 \
      | grep -E 'ERROR' | head -3
    exit 1
  fi
done
echo "  (0008 en 0011 draaiden zonder fout)"
echo

# ── het verloop ───────────────────────────────────────────────────────────
echo "  het verloop per dag"
check "vijf dagen vastgelegd" 5 "$(q "select count(*) from marketing_hq.creative_verloop where creative_id=1")"
check "de dagelijkse ROAS daalt zoals ingevoerd" "5.000|1.000|1.000|0.400|0.400" \
  "$(q "select string_agg(roas::text,'|' order by dag) from marketing_hq.creative_verloop where creative_id=1")"
# De kern: cumuleren op de tellers, niet het gemiddelde van de dagcijfers
# nemen. Zou de view dat laatste doen, dan stond hier op dag 5 een 1,560.
check "de lopende ROAS klopt met de handberekening" "5.000|1.400|1.267|1.143|1.050" \
  "$(q "select string_agg(roas_tot_nu::text,'|' order by dag) from marketing_hq.creative_verloop where creative_id=1")"
check "dag_nr telt vanaf de publicatie" "0|1|2|3|4" \
  "$(q "select string_agg(dag_nr::text,'|' order by dag) from marketing_hq.creative_verloop where creative_id=1")"
check "het lopend totaal spend eindigt op 200" 200 \
  "$(q "select spend_cum::int from marketing_hq.creative_verloop where creative_id=1 order by dag desc limit 1")"

# ── de lijstrij ───────────────────────────────────────────────────────────
echo
echo "  de lijstrij"
check "image_b64 zit NIET in de view" 0 \
  "$(q "select count(*) from information_schema.columns
        where table_schema='marketing_hq' and table_name='creative_kaart' and column_name='image_b64'")"
check "maar je ziet wel dat er een beeld is" "t" \
  "$(q "select beeld_beschikbaar from marketing_hq.creative_kaart where id=1")"
check "de gemeten ROAS komt uit Meta, niet uit de kolom" "1.050" \
  "$(q "select roas::text from marketing_hq.creative_kaart where id=1")"
check "en de bron staat erbij" "meta" \
  "$(q "select cijfers_bron from marketing_hq.creative_kaart where id=1")"
# Een creative zonder publicatie mag geen 'meta' claimen.
q "insert into public.creatives (ad_name, persona, status, roas) values ('Handmatig','Mark','Live',9.9)" >/dev/null
check "een handmatig getal heet ook handmatig" "handmatig" \
  "$(q "select cijfers_bron from marketing_hq.creative_kaart where ad_name='Handmatig'")"
q "insert into public.creatives (ad_name, persona, status) values ('Leeg','Mark','To Test')" >/dev/null
check "en zonder cijfers staat er geen" "geen" \
  "$(q "select cijfers_bron from marketing_hq.creative_kaart where ad_name='Leeg'")"
check "elke creative krijgt een rij, ook zonder meting" 7 \
  "$(q "select count(*) from marketing_hq.creative_kaart")"

# ── de vergelijking ───────────────────────────────────────────────────────
echo
echo "  de vergelijking"
check "drie soortgenoten bij Piet" 3 \
  "$(q "select soortgenoten from marketing_hq.creative_vergelijking where id=2")"
# ROAS 1, 2 en 3 -> mediaan 2. Peer C zit met 3 daarboven, Peer A met 1 eronder.
check "de mediaan is 2, niet het gemiddelde" "2.000" \
  "$(q "select round(roas_mediaan_persona,3)::text from marketing_hq.creative_vergelijking where id=2")"
check "Peer C zit boven de mediaan" "boven" \
  "$(q "select roas_tov_persona from marketing_hq.creative_vergelijking where id=4")"
check "Peer A zit eronder" "onder" \
  "$(q "select roas_tov_persona from marketing_hq.creative_vergelijking where id=2")"
# Onder drie soortgenoten geen oordeel: dezelfde discipline als betrouwbaar.
check "een eenling krijgt geen oordeel" "" \
  "$(q "select coalesce(roas_tov_persona,'') from marketing_hq.creative_vergelijking where id=5")"
check "maar wel de reden waarom niet" "te weinig soortgenoten voor een vergelijking" \
  "$(q "select waarschuwing from marketing_hq.creative_vergelijking where id=5")"
check "alleen beoordeelbare ads doen mee" 5 \
  "$(q "select count(*) from marketing_hq.creative_vergelijking")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
