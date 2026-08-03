#!/usr/bin/env bash
# Testlus voor migratie 0028 — de drie werkstukken herschikt.
#
# Een migratie die rijen overschrijft die een mens heeft ingetypt, moet twee
# dingen tegelijk kunnen: het werk doen, en het níét doen zodra de aanname
# eronder niet meer klopt.
#
# 1. De titels worden vragen en de hoeken kloppen met hun advertenties.
#
# 2. Wat er stond blijft bewaard, anders is een verkeerde herschikking niet
#    terug te draaien.
#
# 3. Draait hij twee keer, dan doet de tweede niets. En heeft iemand de titel
#    intussen zelf aangepast, dan blijft die staan — de migratie kent zijn
#    eigen aanname en overschrijft niet blind.
#
# 4. hoek_scheef ziet het wanneer een advertentie onder een andere hoek staat
#    dan zijn werkstuk.
#
#   bash platform/db/test/herschikt.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/herschikt-test-$$"
PORT=${PGTESTPORT:-5514}
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
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus 0027_opruimen; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  0008 t/m 0027 draaien"
echo

# ── De zaak, zoals hij op productie stond ──────────────────────────────────
# Drie werkstukken die op 29 juli met terugwerkende kracht om bestaande
# advertenties heen zijn gelegd. Hun titel is de kop van een advertentie, en bij
# nummer 11 de opdracht aan een ontwerper.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into marketing_hq.werkstukken (id, titel, product, persona, angle_type, aanleiding, gestart_door)
overriding system value values
  (9,'184.000+ mannen googelden dit ook.','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     null,'Bestond al voordat de estafette er was; met terugwerkende kracht gekoppeld.','mens'),
  (10,'Dyson airstyler vs Airstyler Nova','Airstyler Nova PRO','Sanne, de Dyson-bewuste besparter',
     'comparison','Bestond al voordat de estafette er was; met terugwerkende kracht gekoppeld.','mens'),
  (11,'Eén static die de angst voor sneetjes ''daar beneden'' frontaal wegneemt: kop SCHEER VEILIG,',
     'Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     'premium','Bestond al voordat de estafette er was; met terugwerkende kracht gekoppeld.','mens'),
  -- En één werkstuk dat hier niets mee te maken heeft: als 0028 daaraan komt,
  -- is hij te gulzig.
  (12,'Werkt de reisverpakking bij Mark?','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     'convenience','Dustin zag het drie keer terug bij concurrenten.','mens');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 12);

insert into public.creatives (id, ad_name, product, persona, angle_type, marketing_angle,
                              format, media_type, status, werkstuk_id, has_image)
overriding system value values
  (2,'Toon de echte boosdoener','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     'premium','premium','feature-education · feed11','static','To Test',11,true),
  (3,'Eén static die de angst wegneemt','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     'premium','premium','direct-response · feed11','static','To Test',11,true),
  (4,'Dyson airstyler vs Airstyler Nova','Airstyler Nova PRO','Sanne, de Dyson-bewuste besparter',
     'comparison','comparison','auto · feed11','static','To Test',10,true),
  (5,'Jij googelt het ook.','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     null,'Wat wordt er eigenlijk van je verwacht?',null,'static','To Test',9,false),
  (6,'23:47. Incognito.','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     null,'Wat wordt er eigenlijk van je verwacht?',null,'static','To Test',9,false),
  (7,'184.000+ mannen googelden dit ook.','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     null,'Wat wordt er eigenlijk van je verwacht?',null,'static','To Test',9,false),
  -- Een advertentie waar iemand bewust een hoek voor koos. Die blijft.
  (8,'Reisetui','Groom Guard','Mark de Vries, de Relatie-Pragmaticus',
     'convenience','Past in je toilettas','static · feed11','static','To Test',12,true);
select setval(pg_get_serial_sequence('public.creatives','id'), 8);
SQL
echo "  de zaak staat klaar — drie koppen en één echte vraag"
echo

uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0028_werkstukken_herschikt.sql" 2>&1)
if echo "$uit" | grep -q ERROR; then
  echo "  FOUT 0028 draait niet:"; echo "$uit" | grep -E 'ERROR' | head -3; exit 1
fi

# ── 1. Van kop naar vraag ──────────────────────────────────────────────────
echo "  de titels — een werkstuk waar je nee op kunt zeggen"
check "de zoekhoek heet nu een vraag" "Werkt sociaal bewijs op een schaamtevolle zoekvraag bij Mark?" \
  "$(q "select titel from marketing_hq.werkstukken where id=9")"
check "de vergelijking ook" "Werkt de directe vergelijking met Dyson bij Sanne?" \
  "$(q "select titel from marketing_hq.werkstukken where id=10")"
check "en de ontwerpopdracht is een vraag geworden" \
  "Werkt het tonen van het mechanisme tegen de angst voor sneetjes bij Mark?" \
  "$(q "select titel from marketing_hq.werkstukken where id=11")"
check "alle drie eindigen op een vraagteken" 3 \
  "$(q "select count(*) from marketing_hq.werkstukken where id in (9,10,11) and titel like '%?'")"
check "de aanleiding zegt er nu bij wat eronder ligt" "ja" \
  "$(q "select case when aanleiding like '%drie varianten op één gedachte%' then 'ja' else aanleiding end
        from marketing_hq.werkstukken where id=9")"

# ── 2. De hoek, de sleutel van de hele lus ─────────────────────────────────
echo
echo "  de hoek — waarop angle_learnings en het dossier samenvoegen"
check "de zoekhoek heeft er nu een" "social-proof" \
  "$(q "select angle_type from marketing_hq.werkstukken where id=9")"
check "en zijn drie advertenties staan eronder" 3 \
  "$(q "select count(*) from public.creatives where werkstuk_id=9 and angle_type='social-proof'")"
check "'premium' was niet wat die twee doen: het is veiligheid" "safety" \
  "$(q "select angle_type from marketing_hq.werkstukken where id=11")"
check "ook onder de advertenties" 2 \
  "$(q "select count(*) from public.creatives where werkstuk_id=11 and angle_type='safety'")"
check "en de hoek staat er in mensentaal bij, niet als één woord" "ja" \
  "$(q "select case when marketing_angle like 'Veilig scheren daar beneden%' then 'ja' else marketing_angle end
        from public.creatives where id=2")"
check "een bestaande omschrijving wordt niet overschreven" "Wat wordt er eigenlijk van je verwacht?" \
  "$(q "select distinct marketing_angle from public.creatives where werkstuk_id=9")"
check "geen enkele hoek staat meer scheef" 0 \
  "$(q "select count(*) from marketing_hq.hoek_scheef")"

# ── 3. Wat er níét is aangeraakt ───────────────────────────────────────────
echo
echo "  de grenzen — een migratie die te gulzig is, is erger dan geen"
check "een werkstuk dat al een vraag was, blijft" "Werkt de reisverpakking bij Mark?" \
  "$(q "select titel from marketing_hq.werkstukken where id=12")"
check "en zijn hoek blijft ook" "convenience" \
  "$(q "select angle_type from marketing_hq.werkstukken where id=12")"
check "een bewust gekozen hoek op een advertentie blijft" "convenience" \
  "$(q "select angle_type from public.creatives where id=8")"
check "er is geen hypothese verzonnen" 0 \
  "$(q "select count(*) from marketing_hq.denkstukken")"
check "en geen format ingevuld dat niet af te leiden was" 3 \
  "$(q "select count(*) from public.creatives where werkstuk_id=9 and format is null")"

# ── 4. Wat er bewaard is ───────────────────────────────────────────────────
echo
echo "  het spoor — wie een titel overschrijft, laat zien wat er stond"
check "alle drie de oude rijen staan in het archief" 3 \
  "$(q "select count(*) from marketing_hq.opgeruimd where herkomst='marketing_hq.werkstukken'")"
check "met de oude titel er letterlijk in" "184.000+ mannen googelden dit ook." \
  "$(q "select rij->>'titel' from marketing_hq.opgeruimd where herkomst_id=9")"
check "en de oude hoek ook, zodat de correctie terug te draaien is" "premium" \
  "$(q "select rij->>'angle_type' from marketing_hq.opgeruimd where herkomst_id=11")"
check "het vierde werkstuk staat er niet in" 0 \
  "$(q "select count(*) from marketing_hq.opgeruimd where herkomst_id=12")"

# ── 5. Scheve hoeken ───────────────────────────────────────────────────────
echo
echo "  hoek_scheef — een vergissing die zichzelf niet meldt, blijft jaren staan"
q "update public.creatives set angle_type='premium' where id=2" >/dev/null
check "een advertentie onder een andere hoek dan zijn werkstuk valt op" 1 \
  "$(q "select count(*) from marketing_hq.hoek_scheef where creative_id=2")"
check "met de reden erbij, niet alleen een vlag" "ja" \
  "$(q "select case when waarom like '%valt in tweeën uiteen%' then 'ja' else waarom end
        from marketing_hq.hoek_scheef where creative_id=2")"
q "update public.creatives set angle_type=null where id=2" >/dev/null
check "en een advertentie zonder hoek onder een werkstuk mét hoek ook" "ja" \
  "$(q "select case when waarom like '%advertentie heeft geen hoek%' then 'ja' else waarom end
        from marketing_hq.hoek_scheef where creative_id=2")"
q "update public.creatives set angle_type='safety' where id=2" >/dev/null

# ── 6. Nog een keer, en op een veranderde database ─────────────────────────
echo
echo "  herhaalbaar — en hij kent zijn eigen aanname"
q "update marketing_hq.werkstukken set titel='Werkt sociaal bewijs bij Mark? (herschreven door Dustin)'
   where id=9" >/dev/null
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0028_werkstukken_herschikt.sql" 2>&1)
check "0028 draait twee keer zonder klagen" "" "$(echo "$uit" | grep -o 'ERROR' | head -1)"
check "een titel die iemand zelf heeft aangepast blijft staan" \
  "Werkt sociaal bewijs bij Mark? (herschreven door Dustin)" \
  "$(q "select titel from marketing_hq.werkstukken where id=9")"
check "en de aanleiding is niet nog een keer aangevuld" 1 \
  "$(q "select (length(aanleiding) - length(replace(aanleiding,'drie varianten',''))) / length('drie varianten')
        from marketing_hq.werkstukken where id=9")"
check "het archief blijft drie rijen" 3 \
  "$(q "select count(*) from marketing_hq.opgeruimd where herkomst='marketing_hq.werkstukken'")"

echo
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $fout
