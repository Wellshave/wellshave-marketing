#!/usr/bin/env bash
# Testlus voor migratie 0027 — fase 0: opruimen.
#
# Een opruimmigratie is gevaarlijker dan een die iets toevoegt: hij haalt weg,
# en wat hij per ongeluk meeneemt komt niet terug. De helft van deze controles
# gaat daarom over wat er blijft staan.
#
# 1. Alleen byte voor byte gelijke kopieën gaan weg. Twee varianten met dezelfde
#    kop zijn juist wat een batch hoort te bevatten.
#
# 2. Wat ooit gepubliceerd of gemeten is, blijft — ook als het als kopie begon.
#    Dat is geen duplicaat meer maar geschiedenis.
#
# 3. Niets verdwijnt zonder spoor: de hele rij gaat met de reden naar het
#    archief voordat hij uit creatives verdwijnt.
#
# 4. En wat niet af te leiden is, wordt niet ingevuld maar opgenoemd.
#
#   bash platform/db/test/opruimen.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/opruimen-test-$$"
PORT=${PGTESTPORT:-5513}
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
  ad_id text, creative_id bigint, agent_id text, run_id bigint, verdict text, action text,
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

for m in 0008_terugkoppeling 0009_ruggengraat 0011_tracker 0012_atlas 0013_audit 0017_views \
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  0008 t/m 0026 draaien"
echo

# ── De zaak, zoals hij op productie stond ──────────────────────────────────
# Drie kopieën die vier dagen later nog een keer zijn opgeslagen, en drie
# gevallen die er op lijken maar het niet zijn. Als 0027 die laatste meeneemt,
# is de migratie erger dan de rommel.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into marketing_hq.werkstukken (id, titel, product, persona, angle_type, gestart_door)
overriding system value values
  (1,'De zoekhoek','Groom Guard','Mark',null,'mens'),
  (2,'Klaar voor lancering','Groom Guard','Mark','Problem-Solution','nova'),
  (3,'Klem sinds juli','Groom Guard','Wim','Storytelling / Narrative','nova');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 3);

-- Het origineel en zijn letterlijke kopie, vier dagen later.
insert into public.creatives (id, ad_name, product, persona, media_type, status, werkstuk_id, created_at)
overriding system value values
  (1,'Jij googelt het ook.','Groom Guard','Mark','Static','To Test',1,'2026-07-23'),
  (2,'Jij googelt het ook.','Groom Guard','Mark','Static','To Test',1,'2026-07-27');

-- Lijkt op een kopie, is het niet: zelfde kop, ander beeld. Dit is een variant,
-- en varianten zijn precies waar een batch uit bestaat.
insert into public.creatives (id, ad_name, product, persona, media_type, status, werkstuk_id, image_b64)
overriding system value values
  (3,'Jij googelt het ook.','Groom Guard','Mark','static','To Test',1, repeat('a',100)),
  (4,'Jij googelt het ook.','Groom Guard','Mark','static','To Test',1, repeat('b',100));

-- Een letterlijke kopie die wél gepubliceerd is, en een die gemeten is.
insert into public.creatives (id, ad_name, product, persona, media_type, status, werkstuk_id)
overriding system value values
  (5,'23:47. Incognito.','Groom Guard','Mark','static','To Test',1),
  (6,'23:47. Incognito.','Groom Guard','Mark','static','To Test',1),
  (7,'184.000+ mannen','Groom Guard','Mark','static','To Test',1),
  (8,'184.000+ mannen','Groom Guard','Mark','static','To Test',1);
insert into marketing_hq.meta_publications (creative_id, meta_ad_id, published_at, status)
values (6, 'ad_zes', current_date - 10, 'live');
update public.creatives set roas = 2.4 where id = 8;

-- Drie die compleet zijn: hier moet batch_stand tevreden over zijn.
insert into public.creatives
  (id, ad_name, product, persona, angle_type, format, media_type, status, werkstuk_id, has_image)
overriding system value values
  (10,'Kraag A','Groom Guard','Mark','Problem-Solution','UGC','static','To Test',2,true),
  (11,'Kraag B','Groom Guard','Mark','Problem-Solution','UGC','static','To Test',2,true),
  (12,'Kraag C','Groom Guard','Mark','Problem-Solution','UGC','static','To Test',2,true);
select setval(pg_get_serial_sequence('public.creatives','id'), 12);

-- En de toestand die sinds 0022 niet meer te maken is: ③ op klaar, niets
-- doorgegeven. We zetten hem hier neer zoals hij op productie ontstond --
-- rechtstreeks, buiten alle poorten om: die bestonden toen nog niet.
alter table marketing_hq.werkstuk_stappen disable trigger user;
update marketing_hq.werkstuk_stappen set status='klaar', afgerond_op = now() - interval '20 days',
       waarom = 'Stond al zo', agent_id = 'quill'
 where werkstuk_id = 3 and station = 3;
alter table marketing_hq.werkstuk_stappen enable trigger user;
SQL
echo "  de zaak staat klaar — 11 creatives, waarvan 3 letterlijke kopieën"
echo

vooraf=$(q "select count(*) from public.creatives")

uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0027_opruimen.sql" 2>&1)
if echo "$uit" | grep -q ERROR; then
  echo "  FOUT 0027 draait niet:"; echo "$uit" | grep -E 'ERROR' | head -3; exit 1
fi

# ── 1. Wat er weggaat ──────────────────────────────────────────────────────
echo "  de duplicaten — alleen wat byte voor byte gelijk is"
check "de letterlijke kopie is weg" 0 "$(q "select count(*) from public.creatives where id=2")"
check "het origineel staat er nog" 1 "$(q "select count(*) from public.creatives where id=1")"
check "er is er precies één opgeruimd" 1 "$(q "select count(*) from marketing_hq.opgeruimd")"
check "met de reden erbij" "ja" \
  "$(q "select case when reden like 'byte voor byte gelijk aan creative 1%' then 'ja' else reden end
        from marketing_hq.opgeruimd")"
check "en met de hele rij, zodat het terug kan" "Jij googelt het ook." \
  "$(q "select rij->>'ad_name' from marketing_hq.opgeruimd")"

# ── 2. Wat er blijft ───────────────────────────────────────────────────────
echo
echo "  en wat er blijft staan — dit is waar een opruimmigratie fout gaat"
check "twee varianten met dezelfde kop blijven allebei" 2 \
  "$(q "select count(*) from public.creatives where id in (3,4)")"
check "een kopie die gepubliceerd is, blijft" 2 \
  "$(q "select count(*) from public.creatives where id in (5,6)")"
check "een kopie met cijfers eronder, blijft" 2 \
  "$(q "select count(*) from public.creatives where id in (7,8)")"
check "in totaal is er één rij minder, niet meer" "$((vooraf-1))" \
  "$(q "select count(*) from public.creatives")"

# ── 3. Wat er wel af te leiden was ─────────────────────────────────────────
echo
echo "  de schrijfwijze — 'Static' en 'static' zijn hetzelfde format"
check "er is nog maar één schrijfwijze over" 1 \
  "$(q "select count(distinct media_type) from public.creatives where media_type is not null")"
check "en dat is de kleine letter" "static" \
  "$(q "select distinct media_type from public.creatives where media_type is not null")"

# ── 4. Wat er niet is ingevuld ─────────────────────────────────────────────
echo
echo "  de gaten — opgenoemd, niet verzonnen"
check "geen enkele hoek is er stiekem bij verzonnen" 0 \
  "$(q "select count(*) from public.creatives where werkstuk_id=1 and angle_type is not null")"
check "en de view zegt per stuk wat er mist" "ja" \
  "$(q "select case when ontbreekt like '%geen hoek%angle_learnings%' then 'ja' else ontbreekt end
        from marketing_hq.creatie_gereed where id=1")"
check "met de reden waarom dat erg is, niet alleen 'leeg'" "ja" \
  "$(q "select case when ontbreekt like '%leert dus niets%' then 'ja' else 'nee' end
        from marketing_hq.creatie_gereed where id=1")"
check "wie compleet is, heet gereed" "true" \
  "$(q "select gereed::text from marketing_hq.creatie_gereed where id=10")"
check "en heeft niets te melden" "" \
  "$(q "select coalesce(ontbreekt,'') from marketing_hq.creatie_gereed where id=10")"

# ── 5. De batch tegen de drempel ───────────────────────────────────────────
echo
echo "  de batchstand — drie is geen streefgetal maar een ondergrens"
check "drie gereed heet genoeg" "ja" \
  "$(q "select case when stand like '3 gereed — genoeg%' then 'ja' else stand end
        from marketing_hq.batch_stand where werkstuk_id=2")"
q "update public.creatives set has_image=false where id=12" >/dev/null
check "twee van de drie niet" "ja" \
  "$(q "select case when stand like '2 van de 3 gereed%aanname%' then 'ja' else stand end
        from marketing_hq.batch_stand where werkstuk_id=2")"
check "en de reden staat erbij, niet alleen het getal" "ja" \
  "$(q "select case when stand like '%betrouwbaar%false%' then 'ja' else 'nee' end
        from marketing_hq.batch_stand where werkstuk_id=2")"
check "een werkstuk zonder creatives zegt dat ook" "geen creatives — hier valt nog niets te lanceren" \
  "$(q "select stand from marketing_hq.batch_stand where werkstuk_id=3")"

# ── 6. Wat er klem staat ───────────────────────────────────────────────────
echo
echo "  het klemzittende werk — stilte waar niemand van wakker wordt"
check "de stap op klaar zonder overdracht staat op de lijst" 1 \
  "$(q "select count(*) from marketing_hq.werkstuk_klem where werkstuk_id=3")"
check "met wat er nu moet gebeuren" "schrijf de overdracht alsnog, of stop het werkstuk met een reden" \
  "$(q "select wat_nu from marketing_hq.werkstuk_klem where werkstuk_id=3")"
q "insert into marketing_hq.werkstuk_overdrachten
     (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
   values (3,3,4,'quill','Alsnog vastgelegd','Uit wat er lag','Of het nog klopt')" >/dev/null
check "zodra de overdracht er is, is hij van de lijst" 0 \
  "$(q "select count(*) from marketing_hq.werkstuk_klem where werkstuk_id=3")"
check "een gestopt werkstuk staat er ook niet op" 0 \
  "$(q "update marketing_hq.werkstukken set status='gestopt', gestopt_reden='Niet meer actueel' where id=3;
        select count(*) from marketing_hq.werkstuk_klem where werkstuk_id=3")"

# ── 7. Toegang ─────────────────────────────────────────────────────────────
echo
echo "  toegang"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -c \
  "grant select on all tables in schema marketing_hq to authenticated" >/dev/null 2>&1
check "een buitenstaander leest het archief niet" 0 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U authenticated -d postgres -qtA \
     -c "set test.teamlid='nee'" -c "select count(*) from marketing_hq.opgeruimd" 2>/dev/null | tail -1)"
check "een teamlid wel" 1 \
  "$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U authenticated -d postgres -qtA \
     -c "set test.teamlid='ja'" -c "select count(*) from marketing_hq.opgeruimd" 2>/dev/null | tail -1)"

# ── 8. Nog een keer ────────────────────────────────────────────────────────
echo
echo "  de migratie nog een keer — een opruimer mag niet dóórruimen"
na=$(q "select count(*) from public.creatives")
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0027_opruimen.sql" 2>&1)
check "0027 draait twee keer zonder klagen" "" "$(echo "$uit" | grep -o 'ERROR' | head -1)"
check "en haalt de tweede keer niets meer weg" "$na" \
  "$(q "select count(*) from public.creatives")"
check "het archief blijft één rij" 1 "$(q "select count(*) from marketing_hq.opgeruimd")"

echo
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $fout
