#!/usr/bin/env bash
# Testlus voor 0031 — één statusvocabulaire.
#
# Wat hier bewezen moet worden is niet dat de nieuwe woorden er staan, maar dat
# de OUDE er niet meer uit kunnen komen. Een vertaling die je alleen op de
# gelukkige gevallen test, ziet er altijd goed uit.
#
# De volgorde van deze lus is de volgorde waarin het op productie moet:
#
#   1. 0008 draait met zijn oude vertaling  → schrijft 'Iterate' en 'Killed'
#   2. 0031 corrigeert de vertaling         → schrijft 'Itereren' en 'Gestopt'
#   3. 0030 zet de grendel erop             → onbekende status wordt geweigerd
#   4. de ochtendcyclus draait opnieuw      → en valt niet om
#
# Stap 1 staat er met opzet in. Zonder te laten zien dat de oude versie
# werkelijk 'Iterate' schrijft, bewijst stap 2 niets: dan test je een vertaling
# die misschien nooit aan de beurt kwam.
#
#   bash platform/db/test/statusvocabulaire.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/statusvoc-test-$$"
PORT=${PGTESTPORT:-5519}
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
  account_id text, ad_id text, ad_name text, creative_id bigint, agent_id text, run_id bigint,
  verdict text, action text, reasoning text, confidence numeric(3,2),
  metrics_snapshot jsonb, window_days int default 7, status text default 'open',
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

# 0030 staat er met opzet NIET bij: die komt pas in stap 3, nadat 0031 de
# vertaling heeft gecorrigeerd. Dat is ook de volgorde op productie.
for m in 0008_terugkoppeling 0009_ruggengraat 0011_tracker 0012_atlas 0013_audit 0017_views \
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus 0029_blokkade; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  alle migraties tot 0029 draaien"

# Wat deze lus er bovenop nodig heeft: drie advertenties met een oordeel. Geen
# vaste id's -- die zijn van de fixture -- maar herkenbare namen, zodat de
# controles hieronder precies deze drie rijen aanwijzen en niet per ongeluk een
# rij van de fixture meetellen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
-- Alleen kolommen die vóór 0030 al bestaan: hypothesis en test_variable komen
-- pas met die migratie, en hier zijn we nog bij stap 1.
insert into public.creatives (brand, ad_name, status, angle_type, persona) values
  ('wellshave','VOC.winnaar',  'To Test','safety','Mark'),
  ('wellshave','VOC.verliezer','To Test','humor', 'Mark'),
  ('wellshave','VOC.iteratie', 'To Test','ritual','Eva'),
  -- Een rij zonder publicatie en zonder oordeel: hij hoort de hele lus door op
  -- 'To Test' te blijven staan. Dit is de rij zoals hij op productie staat, en
  -- de enige manier om te meten dat 0030 hem met rust laat.
  ('wellshave','VOC.oud',      'To Test','ritual','Eva');

-- published_at hoort erbij: ad_totals slaat een publicatie zonder die datum
-- over, en dan is er niets te meten en dus niets te vertalen.
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, account_id, published_at)
select id, 'voc_' || id, 'act_voc', now() - interval '7 days'
from public.creatives where ad_name like 'VOC.%' and ad_name <> 'VOC.oud';

-- Zes dagen boven alle drempels van 0008: vier dagen, vijftig euro, duizend
-- vertoningen. Anders geeft creative_results beoordeelbaar = false en slaat de
-- vertaling de rij over -- dan test je niets.
insert into marketing_hq.meta_insights_daily
  (insight_date, account_id, level, entity_id, spend, impressions, clicks,
   purchases, purchase_value, is_final)
select d::date, 'act_voc', 'ad', p.meta_ad_id, 90, 4000, 70, 3, 300, true
from generate_series(current_date - 6, current_date - 1, interval '1 day') d,
     marketing_hq.meta_publications p
where p.account_id = 'act_voc';

insert into marketing_hq.meta_recommendations (account_id, ad_id, verdict, action, reasoning)
select 'act_voc', p.meta_ad_id,
       case c.ad_name when 'VOC.winnaar' then 'winner'
                      when 'VOC.verliezer' then 'loser' else 'test' end,
       case c.ad_name when 'VOC.winnaar' then 'scale'
                      when 'VOC.verliezer' then 'pause' else 'iterate' end,
       'testoordeel'
from marketing_hq.meta_publications p
join public.creatives c on c.id = p.creative_id
where p.account_id = 'act_voc';
SQL

echo ""
echo "  1. de oude vertaling, zoals hij vandaag op productie draait"

# 0008 draait hier zoals hij op productie staat: niet nagebouwd maar de
# migratie zelf, want een nagebouwde versie bewijst niets over wat er draait.
q "select marketing_hq.sync_creative_results()" >/dev/null

# Zonder deze twee regels bewijst de rest niets: dan kan de vertaling stilletjes
# nooit aan de beurt zijn geweest.
check "de oude versie schrijft werkelijk 'Iterate'" "Iterate" \
  "$(q "select status from public.creatives where ad_name='VOC.iteratie'")"
check "en werkelijk 'Killed'" "Killed" \
  "$(q "select status from public.creatives where ad_name='VOC.verliezer'")"

# Terug naar de uitgangspositie voor de echte test.
q "update public.creatives set status='To Test' where ad_name like 'VOC.%'" >/dev/null

echo ""
echo "  2. na 0031: alleen nog het nieuwe vocabulaire"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0031_statusvocabulaire.sql" 2>&1)
if [ $? -ne 0 ]; then echo "  FOUT 0031 draait niet:"; echo "$uit" | tail -3; exit 1; fi
q "select marketing_hq.sync_creative_results()" >/dev/null

check "Atlas schrijft geen 'Iterate' meer" "0" \
  "$(q "select count(*) from public.creatives where status='Iterate'")"
check "Atlas schrijft geen 'Killed' meer" "0" \
  "$(q "select count(*) from public.creatives where status='Killed'")"
check "een verliezer wordt 'Gestopt'"  "Gestopt" \
  "$(q "select status from public.creatives where ad_name='VOC.verliezer'")"
check "een iteratie wordt 'Itereren'"  "Itereren" \
  "$(q "select status from public.creatives where ad_name='VOC.iteratie'")"
check "een winnaar blijft 'Winner'"    "Winner" \
  "$(q "select status from public.creatives where ad_name='VOC.winnaar'")"

echo ""
echo "  3. de grendel van 0030 erop"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0030_testklaar.sql" 2>&1)
if echo "$uit" | grep -qi '^psql.*ERROR'; then
  echo "  FOUT 0030 draait niet:"; echo "$uit" | grep -i error | tail -3; exit 1; fi

# Dit is de controle waar het om begonnen was: elke status die de vertaling kan
# opleveren moet in creative_statussen staan. Niet met de hand nagelopen maar
# uitgelezen uit de functie zelf, zodat een nieuwe tak in de case hier opvalt.
check "elke status uit de vertaling bestaat in creative_statussen" "" \
  "$(q "with woorden as (
          select unnest(regexp_matches(pg_get_functiondef(p.oid), 'then ''([A-Z][^'']*)''', 'g')) as w
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='marketing_hq' and p.proname='sync_creative_results')
        select string_agg(distinct w, ', ') from woorden
         where w not in (select status from marketing_hq.creative_statussen)")"
check "en dat zijn er vier"  "Gestopt, Itereren, Live, Winner" \
  "$(q "with woorden as (
          select unnest(regexp_matches(pg_get_functiondef(p.oid), 'then ''([A-Z][^'']*)''', 'g')) as w
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname='marketing_hq' and p.proname='sync_creative_results')
        select string_agg(distinct w, ', ' order by w) from woorden")"
check "er zijn tien statussen" "10" "$(q "select count(*) from marketing_hq.creative_statussen")"
# De belofte "geen automatische migratie van To Test" wordt hier gemeten en
# niet aangenomen: deze rij stond er vóór 0030 en moet er daarna onveranderd
# staan. 'To Test' betekende zowel Concept als Klaar voor review; welke van de
# twee het is weet alleen de mens die hem maakte.
check "0030 laat een bestaande 'To Test'-rij ongemoeid" "To Test" \
  "$(q "select status from public.creatives where ad_name='VOC.oud'")"

# Nu 0030 er is, kunnen de drie rijen ook testklaar gemaakt worden. Dat is nodig
# voor de statussen met vraagt_test: zonder hypothese en testvariabele houdt de
# grendel uit 0030 ze tegen, en dan meet je die grendel in plaats van de
# vertaling.
q "insert into marketing_hq.werkstukken (brand, titel, gestart_door)
   values ('wellshave','Statusvocabulaire','mens')" >/dev/null
q "update public.creatives set
     hypothesis = 'Als we A, dan B, omdat C',
     test_variable = 'de kop',
     werkstuk_id = (select max(id) from marketing_hq.werkstukken)
   where ad_name like 'VOC.%' and ad_name <> 'VOC.oud'" >/dev/null
check "de console kan de lijst lezen" "10" \
  "$(q "set role authenticated; select count(*) from public.hq_creative_statussen")"

echo ""
echo "  4. de ochtendcyclus faalt niet op de foreign key"
# De echte vraag: draait de cyclus nog nadat de grendel erop zit? Een fout hier
# is precies wat er morgenochtend om 05:40 zou gebeuren.
q "update public.creatives set status='To Test' where ad_name like 'VOC.%'" >/dev/null
check "de cyclus draait door" "ja" \
  "$(case "$(qerr "select marketing_hq.sync_creative_results()")" in
       *ERROR*) echo "nee: $(qerr "select marketing_hq.sync_creative_results()")" ;; *) echo ja ;; esac)"
check "en heeft de drie gemeten rijen bijgewerkt" "Gestopt|Itereren|Winner" \
  "$(q "select string_agg(distinct status, '|' order by status) from public.creatives
        where ad_name like 'VOC.%' and ad_name <> 'VOC.oud'")"
check "en de rij zonder meting met rust gelaten" "To Test" \
  "$(q "select status from public.creatives where ad_name='VOC.oud'")"

echo ""
echo "  5. wat er niet meer in mag"
check "een nieuwe rij met 'To Test' wordt geweigerd" "ja" \
  "$(weigert "insert into public.creatives (ad_name, status) values ('WS.D','To Test')" \
     "creatives_status_bekend")"
check "een status naar 'Killed' zetten wordt geweigerd" "ja" \
  "$(weigert "update public.creatives set status='Killed' where ad_name='VOC.winnaar'" \
     "creatives_status_bekend")"
check "een geldige status mag wel" "ja" \
  "$(case "$(qerr "update public.creatives set status='Middelmatig' where ad_name='VOC.winnaar'")" in
       *ERROR*) echo nee ;; *) echo ja ;; esac)"
# Wat een mens bewust heeft stopgezet, mag de ochtendcyclus niet terugdraaien —
# ook niet als het oordeel van Meta 'winner' zegt. Zonder deze regel overschrijft
# de cyclus elke ochtend een beslissing die iemand met opzet nam.
q "update public.creatives set status='Gestopt' where ad_name='VOC.winnaar'" >/dev/null
q "select marketing_hq.sync_creative_results()" >/dev/null
check "wat bewust is stopgezet blijft stopgezet" "Gestopt" \
  "$(q "select status from public.creatives where ad_name='VOC.winnaar'")"

echo ""
echo "  6. bestaande rijen blijven met rust"
# NOT VALID betekent: oude rijen worden niet gecontroleerd. Dat is precies waar
# de belofte "geen automatische migratie van To Test" op rust, dus het staat
# hier als meting en niet als aanname.
# VOC.oud stond er al vóór 0030 en is sindsdien niet aangeraakt. Dat is precies
# het geval dat NOT VALID moet dekken.
check "een bestaande 'To Test'-rij blijft staan" "To Test" \
  "$(q "select status from public.creatives where ad_name='VOC.oud'")"
check "en is te openen zonder fout" "VOC.oud" \
  "$(q "select ad_name from marketing_hq.testkaart where ad_name='VOC.oud'")"
check "cijfers bijwerken op zo'n rij mag" "ja" \
  "$(case "$(qerr "update public.creatives set roas=1.4 where ad_name='VOC.oud'")" in
       *ERROR*) echo nee ;; *) echo ja ;; esac)"
check "maar de status wordt niet vanzelf iets anders" "To Test" \
  "$(q "select status from public.creatives where ad_name='VOC.oud'")"
check "een mens die een geldige status kiest, kan opslaan" "ja" \
  "$(case "$(qerr "update public.creatives set status='Concept' where ad_name='VOC.oud'")" in
       *ERROR*) echo nee ;; *) echo ja ;; esac)"

echo ""
echo "  7. beoordeelbaarheid blijft afgeleid"
# Geen van de tien statussen mag 'beoordeelbaar' heten: dat is een uitkomst van
# de meting en geen keuze in een menu.
check "geen status heet beoordeelbaar" "0" \
  "$(q "select count(*) from marketing_hq.creative_statussen where status ilike '%beoordeelbaar%'")"
check "de vertaling kent het woord ook niet" "0" \
  "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='marketing_hq' and p.proname='sync_creative_results'
          and pg_get_functiondef(p.oid) ilike '%''Beoordeelbaar''%'")"

echo ""
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $((fout > 0))
