#!/usr/bin/env bash
# Testlus voor migratie 0030 — een variant testklaar maken.
#
# De opdracht heeft twee regels die alleen iets waard zijn als ze in de weg
# kunnen zitten: "een afbeelding zonder hypothese is geen test" en "een
# hypothese zonder meetbare testvariabele is niet testklaar". Een regel die
# nergens tegenaan loopt, is een goed voornemen.
#
# Daarom test dit bestand vooral wat er NIET mag:
#
# 1. Een creative kan de conceptfase niet uit zonder hypothese, testvariabele
#    en werkstuk. In de conceptfase mag alles nog rammelen.
#
# 2. Twee keer dezelfde advertentienaam binnen een merk kan niet: dan wijst een
#    verwijzing uit een rapport naar twee dingen.
#
# 3. Het naamvoorstel volgt de merkconventie en telt door binnen dezelfde
#    combinatie, niet over het hele merk.
#
# 4. De testkaart zegt wat er ontbreekt en waar de onderbouwing op rust, en
#    haalt dat uit het denkstuk in plaats van het opnieuw te vragen.
#
#   bash platform/db/test/testklaar.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/testklaar-test-$$"
PORT=${PGTESTPORT:-5517}
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

for m in 0008_terugkoppeling 0009_ruggengraat 0011_tracker 0012_atlas 0013_audit 0017_views \
         0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen 0025_dossier 0026_criticus 0029_blokkade 0030_testklaar; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done
echo "  alle migraties draaien"
echo

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
insert into marketing_hq.werkstukken (id, titel, product, persona, angle_type, gestart_door)
overriding system value values
  (1,'Werkt het tonen van het mechanisme bij Mark?','Groom Guard','Mark de Vries','safety','mens');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 1);

insert into marketing_hq.denkstukken (id, werkstuk_id, status) overriding system value values (1, 1, 'bezig');
-- De reeks meeschuiven, anders botst de eerstvolgende insert op id 1.
select setval(pg_get_serial_sequence('marketing_hq.denkstukken','id'), 1);
insert into marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag, antwoord, zekerheid, door_mens, bron)
select 1, v.vraag, v.antwoord, v.zekerheid, '11111111-1111-1111-1111-111111111111', v.bron
from (values
  (1::smallint,'het mechanisme tonen','aanname',null::text),
  (2::smallint,'angst voor sneetjes','aanname',null),
  (3::smallint,'Mark','aanname',null),
  (4::smallint,'Als we het mechanisme tonen, dan stijgt de CTR, omdat twijfel wegvalt','aanname',null),
  (5::smallint,'static','aanname',null),
  (6::smallint,'of bewijs wint van belofte','onderbouwd','0008 — de drempels'),
  (7::smallint,'geen signaal','open',null)
) v(vraag, antwoord, zekerheid, bron);
SQL
echo "  de zaak staat klaar"
echo

# ── 1. Een afbeelding zonder hypothese is geen test ────────────────────────
echo "  wat er nodig is voordat het een test heet"
check "een concept mag onaf zijn" "1" \
  "$(q "insert into public.creatives (brand, ad_name, product, status)
        values ('wellshave','WS.Groom-Guard.Mark.safety.01','Groom Guard','Concept') returning 1")"
check "maar niet naar review zonder hypothese" "ja" \
  "$(weigert "update public.creatives set status='Klaar voor review' where ad_name like 'WS.%'" \
     "een hypothese")"
check "met hypothese maar zonder testvariabele nog steeds niet" "ja" \
  "$(weigert "update public.creatives set hypothesis='Als we X, dan Y, omdat Z',
              status='Klaar voor review' where ad_name like 'WS.%'" "testvariabele")"
check "en zonder werkstuk ook niet" "ja" \
  "$(weigert "update public.creatives set hypothesis='Als we X, dan Y, omdat Z',
              test_variable='de kop toont het mechanisme', status='Klaar voor review'
              where ad_name like 'WS.%'" "werkstuk")"
check "met alle drie erbij mag het wel" "Klaar voor review" \
  "$(q "update public.creatives set hypothesis='Als we X, dan Y, omdat Z',
        test_variable='de kop toont het mechanisme', werkstuk_id=1, denkstuk_id=1,
        status='Klaar voor review' where ad_name like 'WS.%';
        select status from public.creatives where ad_name like 'WS.%'")"
check "acht van de tien statussen eisen een toetsbare test" "8" \
  "$(q "select count(*) from marketing_hq.creative_statussen where vraagt_test")"

# ── 2. Gestopt mag altijd ──────────────────────────────────────────────────
echo
echo "  stoppen kan altijd"
# Anders zit een half werkstuk vast: niet vooruit en niet weg.
check "een creative zonder iets erbij kan gestopt worden" "Gestopt" \
  "$(q "insert into public.creatives (brand, ad_name, product, status)
        values ('wellshave','WS.Leeg.Niemand.geen.01','X','Concept');
        update public.creatives set status='Gestopt' where ad_name='WS.Leeg.Niemand.geen.01';
        select status from public.creatives where ad_name='WS.Leeg.Niemand.geen.01'")"

# ── 3. De naam ─────────────────────────────────────────────────────────────
echo
echo "  de naamconventie"
check "Wellshave krijgt WS" "WS.Groom-Guard.Mark-de-Vries.safety.01" \
  "$(q "select marketing_hq.ad_naam_voorstel('wellshave','Groom Guard','Mark de Vries','safety')")"
check "Wellshine krijgt WLS" "WLS.Airstyler-Nova.Sanne.comparison.01" \
  "$(q "select marketing_hq.ad_naam_voorstel('wellshine','Airstyler Nova','Sanne','comparison')")"
check "accenten en tekens worden leesbaar" "WS.Cafe-Creme.Jose.safety.01" \
  "$(q "select marketing_hq.ad_naam_voorstel('wellshave','Café & Crème','José','safety')")"
check "een leeg deel heet 'onbekend' en niet niets" "WS.Groom-Guard.onbekend.safety.01" \
  "$(q "select marketing_hq.ad_naam_voorstel('wellshave','Groom Guard',null,'safety')")"
# Het volgnummer telt binnen dezelfde combinatie. Telt hij over het hele merk,
# dan zegt .07 niets over hoeveelste variant van dit idee je kijkt.
# De eerste controle maakte al WS.Groom-Guard.Mark.safety.01, dus het voorstel
# hoort nu vanzelf .02 te zijn -- zonder dat er iets bijgezet hoeft te worden.
check "het volgnummer telt door binnen dezelfde combinatie" "WS.Groom-Guard.Mark.safety.02" \
  "$(q "select marketing_hq.ad_naam_voorstel('wellshave','Groom Guard','Mark','safety')")"
check "en niet over een andere combinatie heen" "WS.Groom-Guard.Sanne.safety.01" \
  "$(q "select marketing_hq.ad_naam_voorstel('wellshave','Groom Guard','Sanne','safety')")"

echo
echo "  twee keer dezelfde naam"
check "kan niet binnen een merk" "ja" \
  "$(weigert "insert into public.creatives (brand, ad_name, product, status)
              values ('wellshave','WS.Groom-Guard.Mark.safety.01','Groom Guard','Concept')" \
     "creatives_naam_uniek_per_merk")"
check "maar wel bij een ander merk" "1" \
  "$(q "insert into public.creatives (brand, ad_name, product, status)
        values ('wellshine','WS.Groom-Guard.Mark.safety.01','Groom Guard','Concept') returning 1")"

# ── 4. De testkaart ────────────────────────────────────────────────────────
echo
echo "  de testkaart"
check "zegt wat er nog ontbreekt" "ja" \
  "$(q "select case when niet_testklaar like 'geen hypothese%' then 'ja' else coalesce(niet_testklaar,'(niets)') end
        from marketing_hq.testkaart where ad_name='WS.Leeg.Niemand.geen.01'")"
check "en zwijgt als er niets ontbreekt" "" \
  "$(q "select coalesce(niet_testklaar,'') from marketing_hq.testkaart
        where ad_name='WS.Groom-Guard.Mark.safety.01' and brand='wellshave' and werkstuk_id is not null")"
check "de onderbouwing komt uit het denkstuk, niet opnieuw ingevuld" "1" \
  "$(q "select onderbouwd from marketing_hq.testkaart where denkstuk_id = 1 limit 1")"
check "aannames worden apart geteld" "5" \
  "$(q "select aanname from marketing_hq.testkaart where denkstuk_id = 1 limit 1")"
check "en wat open bleef ook" "1" \
  "$(q "select open_gelaten from marketing_hq.testkaart where denkstuk_id = 1 limit 1")"
check "met een zin die zegt waar het op rust" "ja" \
  "$(q "select case when onderbouwing like '1 van de 7%' then 'ja' else onderbouwing end
        from marketing_hq.testkaart where denkstuk_id = 1 limit 1")"
check "zonder denkstuk zegt hij dat met zoveel woorden" "geen denkstuk — deze test rust nergens op" \
  "$(q "select onderbouwing from marketing_hq.testkaart where ad_name='WS.Leeg.Niemand.geen.01'")"
check "de status draagt zijn eigen betekenis mee" "ja" \
  "$(q "select case when status_betekenis like 'Bewust stopgezet%' then 'ja' else status_betekenis end
        from marketing_hq.testkaart where ad_name='WS.Leeg.Niemand.geen.01'")"
check "en zijn fase" "oordeel" \
  "$(q "select status_fase from marketing_hq.testkaart where ad_name='WS.Leeg.Niemand.geen.01'")"

# ── 4b. De statussen verschillen echt van elkaar ───────────────────────────
echo
echo "  elke status doet iets anders"
# De lat uit de opdracht: verantwoordelijke, handeling, grendel, betekenis of
# volgende stap moet verschillen. Twee rijen met dezelfde verantwoordelijke én
# dezelfde volgende stap zijn één status met twee namen.
check "geen twee statussen met dezelfde verantwoordelijke en volgende stap" "0" \
  "$(q "select count(*) from (
          select verantwoordelijke, volgende_stap from marketing_hq.creative_statussen
          group by 1,2 having count(*) > 1) x")"
check "elke status zegt wie er aan zet is" "0" \
  "$(q "select count(*) from marketing_hq.creative_statussen
        where verantwoordelijke is null or length(trim(verantwoordelijke)) = 0")"
check "en wat de volgende stap is" "0" \
  "$(q "select count(*) from marketing_hq.creative_statussen
        where volgende_stap is null or length(trim(volgende_stap)) = 0")"
# Deze twee zijn samengevoegd omdat 0008 beoordeelbaarheid al uitrekent uit de
# metingen. Ze als status laten intypen levert twee waarheden op.
check "beoordeelbaarheid is geen status meer" "0" \
  "$(q "select count(*) from marketing_hq.creative_statussen
        where status in ('Beoordeelbaar','Nog niet beoordeelbaar')")"
# Hij bestaat nog, alleen als afgeleid feit in plaats van als status: 0008 zet
# hem op creative_results, 0011 neemt hem mee in creative_kaart.
check "en 0008 rekent hem nog steeds uit" "creative_kaart, creative_results" \
  "$(q "select string_agg(table_name, ', ' order by table_name)
        from information_schema.columns
        where table_schema='marketing_hq' and column_name='beoordeelbaar'")"

# ── 4c. De naamconventie staat als data ────────────────────────────────────
echo
echo "  de naamconventie is voorlopig, dus verplaatsbaar"
check "elk merk heeft zijn eigen voorvoegsel" "WS|WLS" \
  "$(q "select string_agg(voorvoegsel, '|' order by brand) from marketing_hq.naam_conventie")"
check "de functie leest die tabel en heeft hem niet ingebakken" "XX.Groom-Guard.Mark.safety.01" \
  "$(q "insert into marketing_hq.naam_conventie (brand, voorvoegsel, patroon, toelichting)
        values ('proefmerk','XX','{voorvoegsel}.{product}.{persona}.{angle}.{nr}','test');
        select marketing_hq.ad_naam_voorstel('proefmerk','Groom Guard','Mark','safety')")"
check "een onbekend merk blokkeert niets maar krijgt WS" "WS.X.Y.z.01" \
  "$(q "select marketing_hq.ad_naam_voorstel('bestaat-niet','X','Y','z')")"

# ── 4d. Market sophistication ──────────────────────────────────────────────
echo
echo "  market sophistication hoort bij het werkstuk"
check "de vijf niveaus staan vast" "5" \
  "$(q "select count(*) from marketing_hq.sophistication_niveaus")"
check "en dragen wat er op dat niveau werkt" "ja" \
  "$(q "select case when wat_werkt like '%mechanisme%' then 'ja' else wat_werkt end
        from marketing_hq.sophistication_niveaus where niveau = 3")"
# Mét voorsteller, want anders vuurt die constraint eerst en test je de
# verkeerde regel.
check "een niveau zonder redenering kan niet" "ja" \
  "$(weigert "update marketing_hq.werkstukken set sophistication = 3,
              sophistication_door_agent = 'nova' where id = 1" \
     "sophistication_heeft_reden")"
check "en zonder voorsteller ook niet" "ja" \
  "$(weigert "update marketing_hq.werkstukken set sophistication = 3,
              sophistication_reden = 'de markt kent de claim' where id = 1" \
     "sophistication_een_voorsteller")"
check "een voorstel van Nova mag" "3" \
  "$(q "update marketing_hq.werkstukken set sophistication = 3,
        sophistication_reden = 'concurrenten leggen allemaal het mechanisme uit',
        sophistication_door_agent = 'nova' where id = 1;
        select sophistication from marketing_hq.werkstukken where id = 1")"
# Dit is de kern: een agent kan voorstellen, niet vaststellen. Er is geen kolom
# waar hij kan tekenen -- dezelfde grendel als bij het denkstuk in 0023.
check "maar bevestigen kan alleen een mens" "0" \
  "$(q "select count(*) from information_schema.columns
        where table_schema='marketing_hq' and table_name='werkstukken'
          and column_name like 'sophistication_bevestigd%agent%'")"
check "en een mens die tekent staat erbij" "ja" \
  "$(q "update marketing_hq.werkstukken
        set sophistication_bevestigd_door = '11111111-1111-1111-1111-111111111111',
            sophistication_bevestigd_op = now() where id = 1;
        select case when sophistication_bevestigd_door is not null then 'ja' else 'nee' end
        from marketing_hq.werkstukken where id = 1")"
check "de testkaart toont het niveau met zijn naam" "mechanisme" \
  "$(q "select sophistication_naam from marketing_hq.testkaart where werkstuk_id = 1 limit 1")"
check "en of een mens het bevestigde" "t" \
  "$(q "select sophistication_bevestigd from marketing_hq.testkaart where werkstuk_id = 1 limit 1")"

# ── 4e. Klaarzetten voor test, als één gebaar ──────────────────────────────
echo
echo "  klaarzetten voor test"
# auth.uid() bestaat niet in deze test; die stubben we, zodat de functie zelf
# getest wordt en niet de Supabase-omgeving eromheen.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('test.uid', true), '')::uuid $f$;
SQL
check "een onbekende gebruiker komt er niet in" "ja" \
  "$(weigert "set local test.uid='22222222-2222-2222-2222-222222222222';
     select marketing_hq.creative_testklaar_maken('{\"product\":\"X\"}'::jsonb)" \
     "goedgekeurd teamlid")"
check "een teamlid maakt in één keer werkstuk, denkstuk en creative" "ja" \
  "$(q "set local test.uid='11111111-1111-1111-1111-111111111111';
        select case when (r->>'creative_id') is not null and (r->>'werkstuk_id') is not null
                     and (r->>'denkstuk_id') is not null then 'ja' else r::text end
        from (select marketing_hq.creative_testklaar_maken(jsonb_build_object(
          'brand','wellshave','product','Groom Guard','persona','Mark','angle_type','safety',
          'marketing_angle','het mechanisme tonen','kernpijn','angst voor sneetjes',
          'hypothesis','Als we het mechanisme tonen, dan stijgt de CTR, omdat twijfel wegvalt',
          'test_variable','de kop toont het mechanisme','format','Before / After',
          'waarom_nu','concurrenten leggen het uit','headline','Dit is het verschil',
          'rory_reasoning','wantrouwen valt weg bij bewijs',
          'theriot_reasoning','show dont tell: het verschil in beeld',
          'placement','feed','product_refs',jsonb_build_array('groomguard-front.jpg'),
          'mens_ingeving','viel me op in de reviews',
          'rory_interview',jsonb_build_object('kernpijn','angst voor sneetjes',
            'kernbezwaar','weer een abonnement','echte_vijand','de wegwerpmesjes',
            'na_situatie','een gezicht zonder rode plekken'))) as r) x")"
check "en de creative staat meteen op Klaar voor review" "Klaar voor review" \
  "$(q "select status from public.creatives where ad_name='WS.Groom-Guard.Mark.safety.02'")"
check "met een naam volgens de conventie" "WS.Groom-Guard.Mark.safety.02" \
  "$(q "select ad_name from public.creatives where headline='Dit is het verschil'")"
# Geen dubbele invoer: wat het interview al wist staat in het denkstuk zonder
# dat iemand het overtypt.
check "het denkstuk is gevuld uit wat al bekend was" "7" \
  "$(q "select count(*) from marketing_hq.denkstuk_antwoorden a
        join marketing_hq.denkstukken d on d.id=a.denkstuk_id
        where d.werkstuk_id = (select werkstuk_id from public.creatives where headline='Dit is het verschil')")"
check "de hypothese staat op vraag 4" "ja" \
  "$(q "select case when a.antwoord like 'Als we het mechanisme%' then 'ja' else a.antwoord end
        from marketing_hq.denkstuk_antwoorden a
        join marketing_hq.denkstukken d on d.id=a.denkstuk_id
        where a.vraag=4 and d.werkstuk_id=(select werkstuk_id from public.creatives where headline='Dit is het verschil')")"
check "en het denkstuk is nog niet afgetekend — dat blijft een bewust gebaar" "bezig" \
  "$(q "select d.status from marketing_hq.denkstukken d
        where d.werkstuk_id=(select werkstuk_id from public.creatives where headline='Dit is het verschil')")"
check "Rory en Theriot staan opgeslagen" "wantrouwen valt weg bij bewijs" \
  "$(q "select rory_reasoning from public.creatives where headline='Dit is het verschil'")"
# De grendel geldt ook via deze deur: zonder hypothese komt hij niet op
# 'Klaar voor review'.
check "zonder hypothese komt hij deze deur niet door" "ja" \
  "$(weigert "set local test.uid='11111111-1111-1111-1111-111111111111';
     select marketing_hq.creative_testklaar_maken(jsonb_build_object(
       'brand','wellshave','product','Y','persona','Z','angle_type','safety'))" \
     "niet testklaar")"
check "een eigen naam wordt gerespecteerd" "Mijn eigen naam" \
  "$(q "set local test.uid='11111111-1111-1111-1111-111111111111';
        select (marketing_hq.creative_testklaar_maken(jsonb_build_object(
          'brand','wellshave','ad_name','Mijn eigen naam','product','Groom Guard',
          'persona','Mark','angle_type','safety','hypothesis','Als we A, dan B, omdat C',
          'test_variable','iets anders'))->>'ad_name')")"

# ── 5. Wat er niet stuk mocht ──────────────────────────────────────────────
echo
echo "  wat er al was, werkt nog"
check "een onbekende status kan niet meer" "ja" \
  "$(weigert "update public.creatives set status='Zomaar wat' where ad_name='WS.Leeg.Niemand.geen.01'" \
     "creatives_status_bekend")"
check "de werkbank telt de creatives nog steeds" "1" \
  "$(q "select aantal_creatives from marketing_hq.werkbank where id=1")"
check "en hq_testkaart bestaat voor de console" "ja" \
  "$(q "set role authenticated; set local test.teamlid='ja';
        select case when count(*) >= 0 then 'ja' else 'nee' end from public.hq_testkaart")"
check "anon komt er niet bij" "ja" \
  "$(weigert "set role anon; select count(*) from public.hq_testkaart" "permission denied")"

# ── 5b. Het dossier ────────────────────────────────────────────────────────
# Het dossier is een view over acht andere tabellen. Bij security_invoker leest
# hij met de rechten van wie kijkt, dus een ontbrekend grant op één tabel maakt
# het hele dossier onleesbaar -- en dat merk je pas in productie.
echo ""
echo "  het dossier per creative"
check "een teamlid kan het dossier lezen" "ja" \
  "$(q "set role authenticated; set local test.teamlid='ja';
        select case when count(*) > 0 then 'ja' else 'nee' end from public.hq_creative_dossier")"
check "anon komt er niet bij" "ja" \
  "$(weigert "set role anon; select count(*) from public.hq_creative_dossier" "permission denied")"
check "het dossier kent alle zes de onderdelen" "ja" \
  "$(q "select case when count(*) = 8 then 'ja' else 'nee, ' || count(*) end
        from information_schema.columns
        where table_schema='marketing_hq' and table_name='creative_dossier'
          and column_name in ('denkstuk_regels','stappen','overdrachten','oordelen',
                              'discussies','publicatie','meting','learnings')")"
# Een leeg dossier moet leeg zijn en niet stuk: null is een antwoord, een fout
# is dat niet.
check "een creative zonder meting geeft null en geen fout" "" \
  "$(q "select meting from marketing_hq.creative_dossier
        where ad_name = 'WS.Leeg.Niemand.geen.01'")"
# De tijdlijn voegt vier tabellen samen tot één vraag: wie deed wat, wanneer.
# Als "klaargezet voor test" er niet in staat, mist de mens in zijn eigen
# tijdlijn -- en dat is precies het gat dat dit dossier moet dichten.
check "de tijdlijn noemt de mens die het klaarzette" "ja" \
  "$(q "select case when tijdlijn::text like '%klaargezet voor test%'
                     and tijdlijn::text like '%\"door\": \"mens\"%' then 'ja'
                    else 'nee: ' || coalesce(tijdlijn::text,'null') end
        from marketing_hq.creative_dossier where headline='Dit is het verschil'")"
check "het interview staat op het werkstuk en niet op de variant" "angst voor sneetjes" \
  "$(q "select w.rory_interview->>'kernpijn' from marketing_hq.werkstukken w
        where w.id = (select werkstuk_id from public.creatives where headline='Dit is het verschil')")"
check "en de ingeving van de mens erbij" "viel me op in de reviews" \
  "$(q "select w.mens_ingeving from marketing_hq.werkstukken w
        where w.id = (select werkstuk_id from public.creatives where headline='Dit is het verschil')")"
check "plaatsing en productreferenties staan op de variant" "feed" \
  "$(q "select placement from public.creatives where headline='Dit is het verschil'")"

echo ""
echo "  de learning: opschrijven mag, bevestigen pas na de meting"
# Dit is de kern van eis "beoordeelbaarheid blijft afgeleid": een mens mag zijn
# conclusie opschrijven, maar hem als vastgesteld feit neerzetten kan pas als
# 0008 zegt dat er genoeg gemeten is. Zonder deze deur zou een learning zonder
# meting in de analyse landen als ware hij bewezen.
check "een onbekende gebruiker legt niets vast" "ja" \
  "$(weigert "set local test.uid='22222222-2222-2222-2222-222222222222';
     select marketing_hq.creative_learning_vastleggen(jsonb_build_object(
       'creative_id',(select id from public.creatives where headline='Dit is het verschil'),
       'learning_kern','iets'))" "goedgekeurd teamlid")"
check "opschrijven mag altijd" "bewijs in beeld verlaagt de drempel" \
  "$(q "set local test.uid='11111111-1111-1111-1111-111111111111';
        select marketing_hq.creative_learning_vastleggen(jsonb_build_object(
          'creative_id',(select id from public.creatives where headline='Dit is het verschil'),
          'learning_kern','bewijs in beeld verlaagt de drempel',
          'learning_behouden','het mechanisme in de kop',
          'learning_veranderen','de kleur van de knop'));
        select learning_kern from public.creatives where headline='Dit is het verschil'" | tail -1)"
check "en hij staat dan nog niet als bevestigd" "" \
  "$(q "select learning_bevestigd_op from public.creatives where headline='Dit is het verschil'")"
check "maar bevestigen niet zolang er niet genoeg gemeten is" "ja" \
  "$(weigert "set local test.uid='11111111-1111-1111-1111-111111111111';
     select marketing_hq.creative_learning_vastleggen(jsonb_build_object(
       'creative_id',(select id from public.creatives where headline='Dit is het verschil'),
       'learning_kern','te vroeg','bevestigen',true))" "nog niet beoordeelbaar")"
check "en zonder kern kan hij nooit bevestigd staan" "ja" \
  "$(weigert "update public.creatives set learning_kern = null,
       learning_bevestigd_door='11111111-1111-1111-1111-111111111111',
       learning_bevestigd_op=now() where headline='Dit is het verschil'" \
     "creatives_learning_bevestiging")"

echo ""
echo "  het dossier per creative, vervolg"
check "de testkaart zegt wie er aan zet is" "ja" \
  "$(q "select case when count(*) = 3 then 'ja' else 'nee, ' || count(*) end
        from information_schema.columns
        where table_schema='marketing_hq' and table_name='testkaart'
          and column_name in ('verantwoordelijke','volgende_stap','verdict')")"

# ── 6. Nog een keer ────────────────────────────────────────────────────────
echo
echo "  de migratie nog een keer"
uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0030_testklaar.sql" 2>&1)
check "0030 draait twee keer zonder klagen" "" "$(echo "$uit" | grep -o 'ERROR' | head -1)"
check "en er zijn nog steeds tien statussen" "10" \
  "$(q "select count(*) from marketing_hq.creative_statussen")"

echo
if [ "$fout" -eq 0 ]; then echo "  alles klopt"; else echo "  $fout fout(en)"; fi
exit $fout
