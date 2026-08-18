#!/usr/bin/env bash
# Testlus voor migratie 0017 — views die filteren op wie kijkt.
#
# De controle die ertoe doet staat in het midden: iemand die is ingelogd maar
# géén goedgekeurd teamlid is, hoort door de hq_*-views nul rijen te zien. Dat
# is geen detail van de opmaak — het is het verschil tussen een RLS-policy die
# werkt en een die er alleen staat.
#
# De fixture heeft daarom de vorm van de echte opzet, niet een vereenvoudiging:
# een tabel met RLS, een gewone view erop in marketing_hq, en een hq_*-wrapper
# in public met security_invoker. Precies de keten waarin het gat zat.
#
#   bash platform/db/test/views.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/views-test-$$"
PORT=${PGTESTPORT:-5503}
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

# Als een ingelogde gebruiker, met of zonder teamlidmaatschap.
alsLid()    { q "set session authorization authenticated; set local test.teamlid='ja'; $1"; }
alsVreemde(){ q "set session authorization authenticated; set local test.teamlid='nee'; $1"; }

opruimen() { su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -m immediate stop" >/dev/null 2>&1; rm -rf "$WERK"; }
trap opruimen EXIT

mkdir -p "$WERK"; chown -R "$UID_PG" "$WERK" 2>/dev/null
su "$UID_PG" -c "$BIN/initdb -D $WERK -U postgres -A trust --locale=C -E UTF8" >/dev/null 2>&1 || {
  echo "  initdb mislukt — staat postgres geïnstalleerd?"; exit 1; }
su "$UID_PG" -c "$BIN/pg_ctl -D $WERK -o '-p $PORT -k ${TMPDIR:-/tmp}' -l $WERK/log start" >/dev/null 2>&1
sleep 2
[ "$(q 'select 1')" = "1" ] || { echo "  postgres start niet"; tail -5 "$WERK/log"; exit 1; }

# ── de echte vorm, niet een vereenvoudiging ───────────────────────────────
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated login; create role anon login; create role service_role login;
grant usage on schema marketing_hq, public to authenticated, anon, service_role;

-- Schakelbaar, zodat dezelfde rol beide kanten van de policy kan spelen.
create function marketing_hq.is_team_member() returns boolean
  language sql stable as $$ select coalesce(current_setting('test.teamlid', true), 'nee') = 'ja' $$;

create table public.creatives (id bigint primary key, brand text, ad_name text, roas numeric);
alter table public.creatives enable row level security;
create policy creatives_lezen on public.creatives for select using (marketing_hq.is_team_member());
grant select on public.creatives to authenticated;
insert into public.creatives values (1,'wellshave','WS - 200 - 2', 2.03), (2,'wellshine','WN - F', 1.20);

create table marketing_hq.meta_insights_daily (
  insight_date date, account_id text, level text, entity_id text, entity_name text,
  spend numeric, impressions bigint, clicks bigint, purchases integer, purchase_value numeric,
  landing_page_views integer, add_to_cart integer, initiate_checkout integer,
  view_content integer, add_payment_info integer, quality_ranking text, is_final boolean default true);
alter table marketing_hq.meta_insights_daily enable row level security;
create policy cijfers_lezen on marketing_hq.meta_insights_daily for select using (marketing_hq.is_team_member());
grant select on marketing_hq.meta_insights_daily to authenticated;
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, entity_name, spend, impressions, clicks, purchases, purchase_value)
values (current_date-5,'242238038391551','ad','A','WS-A',100,10000,150,5,200);

-- De vier tabellen die 0017 bij naam noemt.
create table marketing_hq.ad_accounts (account_id text primary key, naam text, merk text, actief boolean default true);
create table marketing_hq.agent_afspraken (agent_id text, kind text, cadans text);
create table marketing_hq.meta_publiek (account_id text, van date, tot date, segment text, spend numeric, impressions bigint, reach bigint);
create table marketing_hq.werkstuk_stations (nr int primary key, naam text);
insert into marketing_hq.ad_accounts values ('242238038391551','Wellshave®','wellshave',true);
insert into marketing_hq.werkstuk_stations values (1,'signaal'), (2,'brief');
alter table marketing_hq.ad_accounts enable row level security;
alter table marketing_hq.agent_afspraken enable row level security;
alter table marketing_hq.meta_publiek enable row level security;
create policy a on marketing_hq.ad_accounts    for select using (marketing_hq.is_team_member());
create policy b on marketing_hq.agent_afspraken for select using (marketing_hq.is_team_member());
create policy c on marketing_hq.meta_publiek    for select using (marketing_hq.is_team_member());

-- De keten waarin het gat zat: gewone view in marketing_hq, invoker-wrapper in public.
create view marketing_hq.creative_kaart as
  select c.id, c.brand, c.ad_name, c.roas from public.creatives c;
create view marketing_hq.advertentie_scorekaart as
  select entity_id, entity_name, sum(spend) as spend, sum(purchase_value)/nullif(sum(spend),0) as roas
  from marketing_hq.meta_insights_daily where level='ad' group by entity_id, entity_name;

create view public.hq_creative_kaart with (security_invoker = true)
  as select * from marketing_hq.creative_kaart;
create view public.hq_advertentie_scorekaart with (security_invoker = true)
  as select * from marketing_hq.advertentie_scorekaart;
revoke all on public.hq_creative_kaart, public.hq_advertentie_scorekaart from anon, public;
grant select on public.hq_creative_kaart, public.hq_advertentie_scorekaart to authenticated;
SQL

# ── vóór 0017: dit is de situatie die gerepareerd moet worden ─────────────
echo "  vóór 0017 — waarom dit een migratie nodig had"
check "de wrapper valt om: geen recht op de view eronder" "" \
  "$(alsLid 'select count(*) from public.hq_creative_kaart')"

if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/0017_views.sql" >/dev/null 2>&1; then
  echo "  FOUT migratie 0017 draait niet:"
  psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0017_views.sql" 2>&1 \
    | grep -E '^ERROR|^psql:.*ERROR' | head -3
  exit 1
fi
echo "  (0017 draaide zonder fout)"
echo

# ── de controle waar het om draait ────────────────────────────────────────
echo "  wie kijkt, bepaalt wat hij ziet"
check "een goedgekeurd teamlid ziet de creatives" 2 \
  "$(alsLid 'select count(*) from public.hq_creative_kaart')"
check "en de scorekaart" 1 \
  "$(alsLid 'select count(*) from public.hq_advertentie_scorekaart')"

# Dit is de regel. Ingelogd zijn is niet hetzelfde als erbij horen.
check "iemand die is ingelogd maar geen teamlid is, ziet NIETS" 0 \
  "$(alsVreemde 'select count(*) from public.hq_creative_kaart')"
check "ook niet via de scorekaart" 0 \
  "$(alsVreemde 'select count(*) from public.hq_advertentie_scorekaart')"
check "en ook niet rechtstreeks op de view in marketing_hq" 0 \
  "$(alsVreemde 'select count(*) from marketing_hq.creative_kaart')"
check "en ook niet rechtstreeks op de tabel" 0 \
  "$(alsVreemde 'select count(*) from public.creatives')"

# ── de views zelf ─────────────────────────────────────────────────────────
echo
echo "  de views"
check "geen enkele view staat nog op de rechten van zijn eigenaar" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"
check "en elke view is leesbaar voor een teamlid" 2 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and has_table_privilege('authenticated', c.oid, 'SELECT')")"

# Een view die er later bij komt hoort door een volgende draai meegenomen te
# worden — anders is elke nieuwe migratie een nieuw gat.
q "create view marketing_hq.nieuwe_view as select 1 as x" >/dev/null
check "een nieuwe view staat eerst open" "f" \
  "$(q "select coalesce(array_to_string(reloptions,','),'') like '%security_invoker=true%'
        from pg_class where relname='nieuwe_view'")"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -f "$MIGDIR/0017_views.sql" >/dev/null 2>&1
check "en wordt door een volgende draai meegenomen" "t" \
  "$(q "select coalesce(array_to_string(reloptions,','),'') like '%security_invoker=true%'
        from pg_class where relname='nieuwe_view'")"

# ── de tabel die openstond ────────────────────────────────────────────────
echo
echo "  werkstuk_stations stond als enige open"
check "RLS staat nu aan" "t" \
  "$(q "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relname='werkstuk_stations'")"
check "een teamlid leest de stations" 2 \
  "$(alsLid 'select count(*) from marketing_hq.werkstuk_stations')"
check "een vreemde niet" 0 \
  "$(alsVreemde 'select count(*) from marketing_hq.werkstuk_stations')"

# ── anon blijft buiten ────────────────────────────────────────────────────
echo
echo "  anon"
check "anon heeft nergens in marketing_hq recht op" 0 \
  "$(q "select count(*) from information_schema.role_table_grants
        where table_schema='marketing_hq' and grantee='anon'")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
