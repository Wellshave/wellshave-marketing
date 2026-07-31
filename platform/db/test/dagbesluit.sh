#!/usr/bin/env bash
# Testlus voor migratie 0018 — het dagbesluit.
#
# Het scherm erboven draagt één beslisvraag: "Welke advertentie zet ik vandaag
# uit, en welke geef ik meer budget?" Deze testlus controleert dat de view die
# vraag ook echt beantwoordt, en niet alleen de cijfers doorgeeft.
#
# De reeks is verzonnen, en dat is hier de bedoeling. 0013 is al getoetst tegen
# de echte cijfers van Wellshave®; wat hier bewezen moet worden is dat alle vijf
# de oordelen op de juiste handeling uitkomen, en dat de volgorde klopt. Daar
# heb je een reeks voor nodig die alle vijf de takken raakt, en die bestaat in
# één echt account niet.
#
# De medianen liggen vast: met zeven beoordeelbare advertenties is de mediaan de
# vierde waarde. ROAS-mediaan 1,2 en CTR-mediaan 1,0 — elk verwacht oordeel
# hieronder is daartegen met de hand nagerekend.
#
#   bash platform/db/test/dagbesluit.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/dagbesluit-test-$$"
PORT=${PGTESTPORT:-5504}
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
alsVreemde(){ q "set session authorization authenticated; set local test.teamlid='nee'; $1"; }

opruimen() { su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -m immediate stop" >/dev/null 2>&1; rm -rf "$WERK"; }
trap opruimen EXIT

mkdir -p "$WERK"; chown -R "$UID_PG" "$WERK" 2>/dev/null
su "$UID_PG" -c "$BIN/initdb -D $WERK -U postgres -A trust --locale=C -E UTF8" >/dev/null 2>&1 || {
  echo "  initdb mislukt — staat postgres geïnstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

# ── de tabellen waar 0013, 0017 en 0018 op staan ──────────────────────────
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated login; create role anon login;
grant usage on schema marketing_hq, public to authenticated, anon;

-- Schakelbaar, zodat dezelfde rol beide kanten van de policy kan spelen.
create function marketing_hq.is_team_member() returns boolean
  language sql stable as $$ select coalesce(current_setting('test.teamlid', true), 'nee') = 'ja' $$;

create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text, entity_name text,
  spend numeric, impressions bigint, reach bigint, clicks bigint,
  purchases integer, purchase_value numeric,
  add_to_cart integer, initiate_checkout integer, landing_page_views integer,
  view_content integer, add_payment_info integer,
  quality_ranking text, is_final boolean default true);
alter table marketing_hq.meta_insights_daily enable row level security;
create policy p1 on marketing_hq.meta_insights_daily for select using (marketing_hq.is_team_member());
grant select on marketing_hq.meta_insights_daily to authenticated;

create table marketing_hq.ad_accounts (
  account_id text primary key, naam text not null, merk text not null,
  actief boolean not null default true);
alter table marketing_hq.ad_accounts enable row level security;
create policy p2 on marketing_hq.ad_accounts for select using (marketing_hq.is_team_member());

create table marketing_hq.meta_publications (
  id bigint generated always as identity primary key,
  brand text not null default 'wellshave', creative_id bigint, ad_name text not null,
  account_id text not null, meta_ad_id text, published_at timestamptz);
alter table marketing_hq.meta_publications enable row level security;
create policy p3 on marketing_hq.meta_publications for select using (marketing_hq.is_team_member());
grant select on marketing_hq.meta_publications to authenticated;

create table public.creatives (
  id bigint primary key, brand text, ad_name text, status text,
  persona text, angle_type text, format text);
alter table public.creatives enable row level security;
create policy p4 on public.creatives for select using (marketing_hq.is_team_member());
grant select on public.creatives to authenticated;

-- Bestaan alleen omdat 0017 ze bij naam noemt. `meta_publiek` staat er niet
-- bij: die maakt 0013 zelf aan, en een halve versie hier zou die migratie
-- laten omvallen.
create table marketing_hq.agent_afspraken (
  agent_id text not null, kind text not null, soort text not null default 'model',
  cadans text not null, levert text not null, doel_tabel text not null,
  lat text not null, max_stilte_uren integer not null,
  primary key (agent_id, kind));
create table marketing_hq.werkstuk_stations (nr int primary key, naam text);
SQL

for m in 0013_audit 0017_views 0018_dagbesluit; do
  if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/$m.sql" >/dev/null 2>&1; then
    echo "  FOUT migratie $m draait niet:"
    psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1 \
      | grep -E '^ERROR|^psql:.*ERROR' | head -3
    exit 1
  fi
done

# ── de reeks ──────────────────────────────────────────────────────────────
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
insert into marketing_hq.ad_accounts values
  ('acc_a','Wellshave®','wellshave',true),
  ('acc_b','Wellshine','wellshine',true);

-- Account A. Zeven beoordeelbare advertenties, zo gekozen dat alle vijf de
-- oordelen uit 0013 precies één keer voorkomen.
--   mediaan ROAS = 1,2   mediaan CTR = 1,0   (de vierde van zeven)
insert into marketing_hq.meta_insights_daily
 (insight_date, account_id, level, entity_id, entity_name,
  spend, impressions, clicks, purchases, purchase_value)
values
 -- roas 4,0 / ctr 3,0  -> beide boven  -> opschalen        -> +1200
 (current_date-5,'acc_a','ad','A1','Meta-naam A1',  400, 100000, 3000, 40, 1600),
 -- roas 3,0 / ctr 2,5  -> beide boven  -> opschalen        ->  +600
 (current_date-5,'acc_a','ad','A2','Meta-naam A2',  300, 100000, 2500, 30,  900),
 -- roas 0,4 / ctr 1,0  -> beide onder + verlies -> stoppen ->  -300
 -- in twee dagen, zodat de optelling onder de nieuwe view ook wordt geraakt
 (current_date-5,'acc_a','ad','A3','Meta-naam A3',  200,  40000,  400, 10,   80),
 (current_date-4,'acc_a','ad','A3','Meta-naam A3',  300,  60000,  600, 15,  120),
 -- roas 0,2 / ctr 0,5  -> beide onder + verlies -> stoppen ->   -80
 (current_date-5,'acc_a','ad','A4','Meta-naam A4',  100, 100000,  500,  2,   20),
 -- roas 0,8 / ctr 2,8  -> ctr boven, roas onder -> materiaal werkt, bestemming niet
 (current_date-5,'acc_a','ad','A5','Meta-naam A5',  200, 100000, 2800, 20,  160),
 -- roas 2,5 / ctr 0,6  -> roas boven, ctr onder -> converteert, bereikt te weinig
 (current_date-5,'acc_a','ad','A6','Meta-naam A6',  250, 100000,  600, 25,  625),
 -- roas 1,2 / ctr 0,9  -> gelijk aan de mediaan -> houden, niet opschalen
 (current_date-5,'acc_a','ad','A7','Meta-naam A7',  150, 100000,  900, 15,  180),
 -- onder de drempel: telt niet mee voor de mediaan en krijgt geen oordeel
 (current_date-5,'acc_a','ad','A8','Meta-naam A8',   20,    500,   10,  1,   40),

 -- Account B. Eigen mediaan, eigen volgorde.
 --   mediaan ROAS = 1,5   mediaan CTR = 1,5
 (current_date-5,'acc_b','ad','B1','Meta-naam B1',  200, 100000,  500,  5,  100),
 (current_date-5,'acc_b','ad','B2','Meta-naam B2',  100, 100000, 2000, 10,  200),
 (current_date-5,'acc_b','ad','B3','Meta-naam B3',  100, 100000, 1500, 10,  150),

 -- Een account dat niet in ad_accounts staat.
 (current_date-5,'acc_x','ad','X1','Meta-naam X1',  500, 100000, 2000, 50, 1500),
 (current_date-5,'acc_x','ad','X2','Meta-naam X2',  500, 100000, 2000, 50, 1500),
 (current_date-5,'acc_x','ad','X3','Meta-naam X3',  500, 100000, 2000, 50, 1500);

insert into public.creatives values
  (101,'wellshave','WS - 200 - Social Proof v2','Live','Vroege Grijze','Social Proof / Reviews','UGC Talking Head Testimonial');

insert into marketing_hq.meta_publications (creative_id, ad_name, account_id, meta_ad_id, published_at) values
  -- A1 hangt aan een rij in de tracker
  (101,'publicatienaam A1','acc_a','A1', now() - interval '20 days'),
  -- A3 is gepubliceerd maar de creative is uit de console verdwenen
  (null,'publicatienaam A3 (eerste)','acc_a','A3', now() - interval '20 days'),
  -- en dezelfde Meta-ad heeft een tweede publicatierij: een mislukte poging
  (null,'publicatienaam A3 (tweede)','acc_a','A3', now() - interval '2 days');
  -- A4 is nooit via de console gepubliceerd
SQL

# ── 1. de vraag: wat zet ik uit ───────────────────────────────────────────
echo "  \"welke zet ik vandaag uit?\""
check "twee advertenties in account A, grootste verlies eerst" "A3|A4" \
  "$(q "select string_agg(entity_id,'|' order by rang) from marketing_hq.dagbesluit
        where account_id='acc_a' and actie='uitzetten'")"
check "en dat is niet de volgorde van de ROAS" "A3" \
  "$(q "select entity_id from marketing_hq.dagbesluit
        where account_id='acc_a' and actie='uitzetten' and rang=1")"
check "A3 kostte 300 euro meer dan hij opbracht" "-300.00" \
  "$(q "select omzet_min_spend from marketing_hq.dagbesluit where entity_id='A3'")"
check "over twee dagen opgeteld" "500" \
  "$(q "select spend::int from marketing_hq.dagbesluit where entity_id='A3'")"

# ── 2. de vraag: wat geef ik meer budget ──────────────────────────────────
echo
echo "  \"en welke geef ik meer budget?\""
check "drie, grootste opbrengst eerst" "A1|A2|A6" \
  "$(q "select string_agg(entity_id,'|' order by rang) from marketing_hq.dagbesluit
        where account_id='acc_a' and actie='meer budget'")"
check "de twee zekere gevallen zijn eensgezind" "true|true" \
  "$(q "select string_agg(eensgezind::text,'|' order by rang) from marketing_hq.dagbesluit
        where account_id='acc_a' and actie='meer budget' and rang<=2")"
check "de derde rust op één signaal" "false" \
  "$(q "select eensgezind::text from marketing_hq.dagbesluit where entity_id='A6'")"

# ── 3. vijf oordelen, vier handelingen, geen diagnose kwijt ───────────────
echo
echo "  elk oordeel komt op één handeling uit"
check "opschalen"                          "meer budget" "$(q "select actie from marketing_hq.dagbesluit where entity_id='A1'")"
check "stoppen"                             "uitzetten"  "$(q "select actie from marketing_hq.dagbesluit where entity_id='A3'")"
check "materiaal werkt, bestemming niet"    "onderzoeken" "$(q "select actie from marketing_hq.dagbesluit where entity_id='A5'")"
check "converteert, bereikt te weinig"      "meer budget" "$(q "select actie from marketing_hq.dagbesluit where entity_id='A6'")"
check "houden, niet opschalen"              "laten staan" "$(q "select actie from marketing_hq.dagbesluit where entity_id='A7'")"
check "en het oordeel zelf blijft leesbaar" "materiaal werkt, bestemming niet" \
  "$(q "select oordeel from marketing_hq.dagbesluit where entity_id='A5'")"
check "met de diagnose erbij" "t" \
  "$(q "select waarom like '%kijk naar de pagina%' from marketing_hq.dagbesluit where entity_id='A5'")"

# ── 4. waar niets te besluiten valt, staat de reden ───────────────────────
echo
echo "  regel 0.4 — geen leeg vlak, wel de reden"
check "A8 staat er wel"                 "1" "$(q "select count(*) from marketing_hq.dagbesluit where entity_id='A8'")"
check "zonder handeling"                ""  "$(q "select actie from marketing_hq.dagbesluit where entity_id='A8'")"
check "zonder rang, dus niet in de rij" ""  "$(q "select rang from marketing_hq.dagbesluit where entity_id='A8'")"
check "maar met de reden waarom niet"   "onder de drempel: minder dan 1.000 vertoningen of 50 euro" \
  "$(q "select waarom from marketing_hq.dagbesluit where entity_id='A8'")"
check "elke rij heeft een reden, ook zonder oordeel" "0" \
  "$(q "select count(*) from marketing_hq.dagbesluit where waarom is null")"

# ── 5. de naam die het team kent ──────────────────────────────────────────
echo
echo "  regel 0.3 — naam én id"
check "A1 heet zoals in de tracker" "WS - 200 - Social Proof v2" \
  "$(q "select naam from marketing_hq.dagbesluit where entity_id='A1'")"
check "met de tracker-rij eraan"    "101" \
  "$(q "select creative_id from marketing_hq.dagbesluit where entity_id='A1'")"
check "A3 valt terug op de publicatienaam" "publicatienaam A3 (eerste)" \
  "$(q "select naam from marketing_hq.dagbesluit where entity_id='A3'")"
check "A4 valt terug op de naam in Meta"   "Meta-naam A4" \
  "$(q "select naam from marketing_hq.dagbesluit where entity_id='A4'")"
check "en zegt eerlijk dat hij niet gekoppeld is" "false" \
  "$(q "select gekoppeld::text from marketing_hq.dagbesluit where entity_id='A4'")"
check "de Meta-naam blijft altijd staan"   "Meta-naam A1" \
  "$(q "select ad_naam from marketing_hq.dagbesluit where entity_id='A1'")"

# ── 6. de fout die het duurst zou zijn ────────────────────────────────────
echo
echo "  twee publicaties voor dezelfde advertentie"
check "A3 staat één keer in de lijst, niet twee" "1" \
  "$(q "select count(*) from marketing_hq.dagbesluit where entity_id='A3'")"
check "het verlies wordt dus niet dubbel geteld" "-300.00" \
  "$(q "select sum(omzet_min_spend) from marketing_hq.dagbesluit where entity_id='A3'")"
check "en geen enkele advertentie staat er dubbel" "0" \
  "$(q "select count(*) from (select account_id, entity_id from marketing_hq.dagbesluit
        group by 1,2 having count(*) > 1) d")"

# ── 7. per account, niet over de hele stapel ──────────────────────────────
echo
echo "  elk account zijn eigen mediaan en zijn eigen volgorde"
check "B1 is nummer 1 om uit te zetten in zijn eigen account" "1" \
  "$(q "select rang from marketing_hq.dagbesluit where entity_id='B1'")"
check "ook al is zijn verlies kleiner dan dat van A3" "-100.00" \
  "$(q "select omzet_min_spend from marketing_hq.dagbesluit where entity_id='B1'")"
check "B2 heeft een andere mediaan dan account A" "1.5" \
  "$(q "select roas_mediaan from marketing_hq.dagbesluit where entity_id='B2'")"
check "en account A die van zichzelf" "1.2" \
  "$(q "select roas_mediaan from marketing_hq.dagbesluit where entity_id='A1'")"
check "het merk staat erbij, zodat het scherm kan splitsen" "wellshine" \
  "$(q "select merk from marketing_hq.dagbesluit where entity_id='B1'")"
check "een account dat niet in ad_accounts staat, telt niet mee" "0" \
  "$(q "select count(*) from marketing_hq.dagbesluit where account_id='acc_x'")"

# ── 8. wie kijkt, ziet wat ────────────────────────────────────────────────
echo
echo "  0017 blijft gelden"
check "de twee nieuwe views draaien op de rechten van de aanroeper" "0" \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"
check "iemand die geen teamlid is, ziet geen enkel besluit" 0 \
  "$(alsVreemde 'select count(*) from marketing_hq.dagbesluit')"
check "ook niet via de public-wrapper" 0 \
  "$(alsVreemde 'select count(*) from public.hq_dagbesluit')"
check "anon heeft nergens recht op" 0 \
  "$(q "select count(*) from information_schema.role_table_grants
        where grantee='anon' and table_name in ('dagbesluit','hq_dagbesluit','publicatie_per_ad')")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
