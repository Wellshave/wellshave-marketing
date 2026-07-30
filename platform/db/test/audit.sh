#!/usr/bin/env bash
# Testlus voor migratie 0013 — de datalaag onder de audit.
#
# De fixture is geen verzinsel. Het zijn de werkelijke cijfers van Wellshave®
# over 30 juni t/m 29 juli 2026, zoals de handmatige audit op 30 juli ze uit
# Meta haalde. Dat is bewust: bij die audit gaf Meta per campagne ook zelf een
# `cost_per_result` terug (€27,17 / €31,91 / €53,56), en die getallen staan
# hieronder als verwachting. Als onze CPA-berekening met alle drie overeenkomt,
# rekent de view hetzelfde als Meta — en dat is een controle die een verzonnen
# reeks niet kan geven.
#
#   bash platform/db/test/audit.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/audit-test-$$"
PORT=${PGTESTPORT:-5499}
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

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated; create role anon;
create function marketing_hq.is_team_member() returns boolean language sql as $$ select true $$;

create table marketing_hq.agents (id text primary key, name text not null);
create table marketing_hq.agent_afspraken (
  agent_id text not null references marketing_hq.agents(id), kind text not null,
  soort text not null default 'model', cadans text not null, levert text not null,
  doel_tabel text not null, lat text not null, max_stilte_uren integer not null,
  actief boolean not null default true, created_at timestamptz default now(),
  primary key (agent_id, kind));
insert into marketing_hq.agents values ('atlas','Atlas');

create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text, entity_name text,
  spend numeric, impressions bigint, reach bigint, clicks bigint,
  purchases integer, purchase_value numeric,
  add_to_cart integer, initiate_checkout integer, landing_page_views integer,
  quality_ranking text, is_final boolean default true);

SQL

if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/0013_audit.sql" >/dev/null 2>&1; then
  echo "  FOUT migratie 0013 draait niet:"
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0013_audit.sql" 2>&1 \
    | grep -E '^ERROR|^psql:.*ERROR' | head -3
  exit 1
fi

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
-- ── De echte campagnes ────────────────────────────────────────────────────
-- Alles op één dag binnen het venster van 30 dagen. De view telt over dat
-- venster op, dus één rij per entiteit met de periodetotalen geeft precies
-- dezelfde som als dertig dagrijen — en het houdt de verwachtingen leesbaar.
insert into marketing_hq.meta_insights_daily
 (insight_date, account_id, level, entity_id, entity_name, spend, impressions,
  landing_page_views, view_content, add_to_cart, initiate_checkout, purchases, purchase_value)
values
 (current_date-5,'242238038391551','campaign','120250501609280577','Advertorial Pages',
   1168.41, 209568, 1526, 1801, 133, 50, 43, 2464.32),
 (current_date-5,'242238038391551','campaign','120249635909880577','TOFU - CBO - GroomGuard',
    893.42, 126530,  703,  937,  80, 33, 28, 1500.66),
 (current_date-5,'242238038391551','campaign','120252205202730577','001 - CBO - GroomGuard',
    535.55,  53905,  477,   37,  20, 18, 10,  554.97);

-- ── De echte advertenties ─────────────────────────────────────────────────
-- clicks is teruggerekend uit de CTR die Meta gaf; daarom wijkt de derde
-- decimaal soms af van het afgeronde percentage in Ads Manager.
insert into marketing_hq.meta_insights_daily
 (insight_date, account_id, level, entity_id, entity_name, spend, impressions, clicks,
  purchases, purchase_value)
values
 (current_date-5,'242238038391551','ad','120250502134950577','WS - 200 - 2',    961.92, 177862, 2508, 35, 1954.55),
 (current_date-5,'242238038391551','ad','120252206157180577','C1 - 4 Reasons Why', 400.85, 38904,  918,  5,  311.78),
 (current_date-5,'242238038391551','ad','120249635910050577','WS - 102 - 1 - Copy',305.12, 44876, 1310, 12,  678.94),
 (current_date-5,'242238038391551','ad','120250414946820577','WS169IT - 2',       191.57, 25294,  354,  8,  410.63),
 (current_date-5,'242238038391551','ad','120250502348380577','WS - 201 - 2',      189.32, 30125,  319,  8,  509.77),
 (current_date-5,'242238038391551','ad','120249911164450577','WSLP - 182 - 2',     62.08, 11189,  307,  1,   53.96),
 -- Onder de drempel: 44,22 euro. Bij de handmatige audit kreeg deze het oordeel
 -- "stoppen"; volgens onze eigen ondergrens hoort daar geen oordeel op.
 (current_date-5,'242238038391551','ad','120252206202030577','C3 - Social Proof',   44.22,  5408,   50,  1,   35.96),
 -- Verzonnen, en als enige. Zonder deze regel raakt de tak 'stoppen' nooit
 -- aangeraakt, want geen enkele echte advertentie in dit account verdient hem.
 (current_date-5,'242238038391551','ad','999999999999999999','Verzonnen - slecht', 120.00, 20000,  100,  1,   60.00);

-- ── Het echte publiek ─────────────────────────────────────────────────────
insert into marketing_hq.meta_publiek (account_id, van, tot, segment, spend, impressions, reach) values
 ('242238038391551', current_date-31, current_date-1, 'prospecting', 3014.75, 459568, 185682),
 ('242238038391551', current_date-31, current_date-1, 'engaged',      410.49,  53792,   3164),
 ('242238038391551', current_date-31, current_date-1, 'unknown',        0.68,     99,     95);
SQL

echo "  (0013 draaide zonder fout)"
echo

# ── De trechter ───────────────────────────────────────────────────────────
echo "  de trechter — nagerekend tegen Meta's eigen cost_per_result"
check "Advertorial: CPA komt overeen met Meta (27,17)" "27.17" \
  "$(q "select cpa::text from marketing_hq.trechter where entity_id='120250501609280577'")"
check "TOFU: CPA komt overeen met Meta (31,91)" "31.91" \
  "$(q "select cpa::text from marketing_hq.trechter where entity_id='120249635909880577'")"
check "001-CBO: CPA komt overeen met Meta (53,56)" "53.56" \
  "$(q "select cpa::text from marketing_hq.trechter where entity_id='120252205202730577'")"
check "de ROAS per campagne" "2.109|1.680|1.036" \
  "$(q "select string_agg(roas::text,'|' order by spend desc) from marketing_hq.trechter where level='campaign'")"

check "Advertorial: elke stap uitgerekend" "8.72|37.59|86.00|2.82" \
  "$(q "select lpv_naar_atc_pct||'|'||atc_naar_ic_pct||'|'||ic_naar_aankoop_pct||'|'||lpv_naar_aankoop_pct
        from marketing_hq.trechter where entity_id='120250501609280577'")"
check "TOFU: elke stap uitgerekend" "11.38|41.25|84.85|3.98" \
  "$(q "select lpv_naar_atc_pct||'|'||atc_naar_ic_pct||'|'||ic_naar_aankoop_pct||'|'||lpv_naar_aankoop_pct
        from marketing_hq.trechter where entity_id='120249635909880577'")"

# Optellen op de tellers. Zou de view de drie campagneratio's middelen, dan
# stond hier 8,43 in plaats van 8,61 — dicht bij elkaar, en toch fout.
check "de trechter over het account telt op de tellers" "8.61" \
  "$(q "select round(sum(atc)::numeric / sum(lpv) * 100, 2)::text
        from marketing_hq.trechter where level='campaign'")"

# ── De zwakste stap ───────────────────────────────────────────────────────
echo
echo "  de zwakste stap — relatief, niet absoluut"
# Het grootste absolute verlies zit bij alle drie tussen landingspagina en
# winkelwagen. Zou de view dat aanwijzen, dan gaf hij drie keer hetzelfde
# antwoord en dus geen informatie.
check "001-CBO struikelt bij de afronding, niet bovenin" "checkout naar aankoop" \
  "$(q "select zwakste_stap from marketing_hq.trechter where entity_id='120252205202730577'")"
check "Advertorial struikelt bij de winkelwagen" "winkelwagen naar checkout" \
  "$(q "select zwakste_stap from marketing_hq.trechter where entity_id='120250501609280577'")"
check "en niet alle drie hetzelfde" 2 \
  "$(q "select count(distinct zwakste_stap) from marketing_hq.trechter where level='campaign'")"

# ── De meetfouten ─────────────────────────────────────────────────────────
echo
echo "  de twee bekende meetfouten"
check "het pixelgat bij 001-CBO wordt gezien" "t" \
  "$(q "select waarschuwing like 'ViewContent vuurt nauwelijks%'
        from marketing_hq.trechter where entity_id='120252205202730577'")"
check "en genoemd met de getallen erbij" "t" \
  "$(q "select waarschuwing like '%(37 op 477 %'
        from marketing_hq.trechter where entity_id='120252205202730577'")"
check "de gezonde campagnes krijgen geen waarschuwing" 2 \
  "$(q "select count(*) from marketing_hq.trechter where level='campaign' and waarschuwing is null")"
# Express checkout: IC boven ATC. Komt in deze reeks niet voor, dus apart gezet.
q "insert into marketing_hq.meta_insights_daily
   (insight_date, account_id, level, entity_id, entity_name, spend, impressions,
    landing_page_views, view_content, add_to_cart, initiate_checkout, purchases, purchase_value)
   values (current_date-5,'242238038391551','campaign','shoppay','Shop Pay',
           100, 10000, 500, 480, 20, 60, 25, 300)" >/dev/null
check "IC boven ATC wordt herkend als express checkout" "t" \
  "$(q "select waarschuwing like 'IC hoger dan ATC%' from marketing_hq.trechter where entity_id='shoppay'")"
q "delete from marketing_hq.meta_insights_daily where entity_id='shoppay'" >/dev/null

# ── Het publiek ───────────────────────────────────────────────────────────
echo
echo "  het publiek — de bevinding die het accountgemiddelde verborg"
check "engaged draait op frequentie 17" "17.00" \
  "$(q "select frequentie::text from marketing_hq.publiek_verzadiging where segment='engaged'")"
check "en heet stukgedraaid" "stukgedraaid" \
  "$(q "select staat from marketing_hq.publiek_verzadiging where segment='engaged'")"
check "terwijl prospecting gezond is" "2.48|gezond" \
  "$(q "select frequentie||'|'||staat from marketing_hq.publiek_verzadiging where segment='prospecting'")"
check "het aandeel spend klopt met het account" "88.0|12.0|0.0" \
  "$(q "select string_agg(aandeel_spend_pct::text,'|' order by spend desc) from marketing_hq.publiek_verzadiging")"
check "de som is het accounttotaal van 3.425,92" "3425.92" \
  "$(q "select sum(spend)::text from marketing_hq.publiek_verzadiging")"
# Twee vensters over elkaar mogen niet opgeteld worden: bereik is ontdubbeld
# binnen zijn eigen periode.
q "insert into marketing_hq.meta_publiek (account_id, van, tot, segment, spend, impressions, reach)
   values ('242238038391551', current_date-8, current_date, 'engaged', 100, 10000, 2000)" >/dev/null
check "een nieuwer venster vervangt het oude, telt er niet bij op" "5.00" \
  "$(q "select frequentie::text from marketing_hq.publiek_verzadiging where segment='engaged'")"
check "en alleen dat venster staat er nog" 1 \
  "$(q "select count(*) from marketing_hq.publiek_verzadiging")"
q "delete from marketing_hq.meta_publiek where tot = current_date" >/dev/null

# ── De scorekaart ─────────────────────────────────────────────────────────
echo
echo "  de scorekaart — twee signalen, en geen oordeel zonder grond"
check "de mediaan wordt over zeven advertenties gevormd" 7 \
  "$(q "select distinct soortgenoten from marketing_hq.advertentie_scorekaart where soortgenoten is not null")"
check "de ROAS-mediaan is 2,032" "2.032" \
  "$(q "select distinct roas_mediaan::text from marketing_hq.advertentie_scorekaart where roas_mediaan is not null")"

# Onder de drempel geen oordeel — ook al leek het bij de handmatige audit een
# duidelijke kill. 44,22 euro is te weinig om iets van te vinden.
check "C3 valt onder de drempel en krijgt geen oordeel" "" \
  "$(q "select coalesce(oordeel,'') from marketing_hq.advertentie_scorekaart where entity_id='120252206202030577'")"
check "maar wel de reden waarom niet" "onder de drempel: minder dan 1.000 vertoningen of 50 euro" \
  "$(q "select waarom from marketing_hq.advertentie_scorekaart where entity_id='120252206202030577'")"

check "WS-102 staat op beide signalen boven en mag opschalen" "opschalen" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='120249635910050577'")"
# De kern van de hele scorekaart: hoge CTR, lage ROAS is geen slechte
# advertentie maar een diagnose. Wie hier 'stoppen' neerzet, gooit de enige
# aanwijzing weg die hij had.
check "C1 trekt door maar zet niet om — geen kill" "materiaal werkt, bestemming niet" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='120252206157180577'")"
check "WSLP-182-2 idem" "materiaal werkt, bestemming niet" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='120249911164450577'")"
check "WS-201-2 zet om maar bereikt te weinig" "converteert, bereikt te weinig" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='120250502348380577'")"

# De reden dat 'stoppen' twee voorwaarden heeft: WS-200-2 is met 961 euro de
# grootste post in het account en draait ROAS 2,03. Hij ligt een haar onder de
# mediaan. Zonder de break-even-eis zou de view hem laten stoppen.
check "de grootste post blijft staan, ook al ligt hij onder de mediaan" "houden, niet opschalen" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='120250502134950577'")"
check "met een uitleg die dat toegeeft" "onderste helft van het account, maar wel boven break-even" \
  "$(q "select waarom from marketing_hq.advertentie_scorekaart where entity_id='120250502134950577'")"
check "alleen de verliesgevende krijgt stoppen" "stoppen" \
  "$(q "select oordeel from marketing_hq.advertentie_scorekaart where entity_id='999999999999999999'")"
check "en dat is er precies één" 1 \
  "$(q "select count(*) from marketing_hq.advertentie_scorekaart where oordeel='stoppen'")"

# Geen enkele échte advertentie in dit account verdient een stop. Dat is de
# uitkomst, en hij corrigeert de handmatige audit.
check "geen enkele echte advertentie wordt gestopt" 0 \
  "$(q "select count(*) from marketing_hq.advertentie_scorekaart
        where oordeel='stoppen' and entity_id <> '999999999999999999'")"

check "het aantal signalen staat erbij" 2 \
  "$(q "select distinct signalen from marketing_hq.advertentie_scorekaart")"

# ── De afspraak ───────────────────────────────────────────────────────────
echo
echo "  de afspraak"
check "de audit is wekelijks, niet dagelijks" "192" \
  "$(q "select max_stilte_uren::text from marketing_hq.agent_afspraken where kind='account_audit'")"
check "opnieuw draaien verdubbelt niets" 1 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -qtA -f "$MIGDIR/0013_audit.sql" >/dev/null 2>&1;
     q "select count(*) from marketing_hq.agent_afspraken where kind='account_audit'")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
