#!/usr/bin/env bash
# Testlus voor migratie 0022 — de overdracht.
#
# Twee regels moeten hier bewezen worden, en beide door ze te overtreden.
#
# 1. Een stap kan niet af zonder overdracht. Zonder die constraint is de hele
#    overdracht een goed voornemen: agents slaan hem over precies wanneer het
#    druk is, en dat is wanneer je hem nodig hebt.
#
# 2. Wie een blokkerende onzekerheid opschrijft, maakt daarmee een poort — ook
#    als hij zelf zegt dat er geen mens nodig is. Een agent die dat zelf mag
#    bepalen zegt nee, niet uit onwil maar omdat doorgaan altijd de weg van de
#    minste weerstand is.
#
#   bash platform/db/test/overdracht.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/overdracht-test-$$"
PORT=${PGTESTPORT:-5508}
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

-- Alles wat 0009, 0017, 0019 en 0021 aanraken.
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
create table marketing_hq.creative_results (creative_id bigint, spend numeric,
  purchase_value numeric, impressions bigint, clicks bigint, roas numeric, beoordeelbaar boolean);
create table marketing_hq.pipeline_items    (id bigint generated always as identity primary key, angle text);
create table marketing_hq.email_drafts      (id bigint generated always as identity primary key, angle text);
create table marketing_hq.meta_publications (id bigint generated always as identity primary key, creative_id bigint);
create table marketing_hq.ad_accounts (account_id text primary key, naam text, merk text);
create table marketing_hq.agent_afspraken (agent_id text, kind text);
create table marketing_hq.meta_publiek (account_id text, van date, tot date, segment text);
create table public.creatives (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  ad_name text, product text, persona text, angle_type text, status text default 'To Test',
  werkstuk_id bigint, user_id uuid, user_name text,
  created_at timestamptz default now(), updated_at timestamptz default now());

-- RLS met een policy op alles wat het brein leest. Zonder dit zou een vreemde
-- niets zien omdat het recht ontbreekt in plaats van omdat de policy hem
-- tegenhoudt -- en dan test je de verkeerde muur.
-- Ook agents en team_members: op productie staat daar RLS met leesrecht op, en
-- `deelnemers` is security_invoker, dus zonder dit valt die view om voor een
-- ingelogde gebruiker. Deze fixture week hier af van het echte schema -- dezelfde
-- soort fout als bij schedules.id in 0020, en hij verstopt zich even goed.
do $do$
declare t text;
begin
  foreach t in array array['agent_runs','agent_events','agent_messages','approvals','reports','agents'] loop
    execute format('alter table marketing_hq.%I enable row level security', t);
    execute format('create policy lezen on marketing_hq.%I for select using (marketing_hq.is_team_member())', t);
    execute format('grant select on marketing_hq.%I to authenticated', t);
  end loop;
end $do$;
grant select on public.creatives, marketing_hq.creative_results to authenticated;
alter table public.team_members enable row level security;
create policy lezen on public.team_members for select using (marketing_hq.is_team_member());
grant select on public.team_members to authenticated;
SQL

for m in 0009_ruggengraat 0017_views 0019_brein 0021_deelnemers 0022_overdracht; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
insert into marketing_hq.werkstukken (id, titel, aanleiding, gestart_door)
overriding system value values (1,'Nekirritatie','Radar zag het','radar');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 1);

-- Eén rij per bestaande bron, zodat de controle verderop dat de zes bronnen
-- samenkomen ook echt iets meet in plaats van alleen de nieuwe.
insert into marketing_hq.agent_events (agent_id, message, werkstuk_id) values ('radar','db_query',1);
insert into marketing_hq.agent_messages (from_agent, to_agent, subject, werkstuk_id)
  values ('radar','nova','hoek gevonden',1);
insert into marketing_hq.reports (title, author_agent, werkstuk_id) values ('Trendbriefing','radar',1);
insert into marketing_hq.approvals (requested_by, action_type, description, werkstuk_id)
  values ('bolt','ad_launch','Zet WS-1 live',1);
insert into marketing_hq.agent_runs (agent_id, status, summary) values ('radar','klaar','Marktscan');
SQL

# ═══════════════════════════════════════════════════════════════════════════
#  1. EEN STAP KAN NIET AF ZONDER OVERDRACHT
# ═══════════════════════════════════════════════════════════════════════════
echo "  een stap kan niet af zonder overdracht"
check "afronden zonder overdracht wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen
              set status='klaar', agent_id='radar', waarom='signaal opgepikt'
              where werkstuk_id=1 and station=1" "kan niet af zonder overdracht")"
# De melding moet zeggen wat er moet gebeuren, niet alleen dat het niet mag.
check "en de melding zegt wat er moet komen" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen
              set status='klaar', agent_id='radar', waarom='x'
              where werkstuk_id=1 and station=1" "wat de volgende moet controleren")"

check "met overdracht mag het wel" "klaar" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
        values (1,1,2,'radar',
          'Hoek nekirritatie bij hoge kraag oppakken',
          'Drie concurrenten draaien er sinds vorige week op, en de zoekvolumes stijgen',
          'Of deze hoek niet al eerder is getest bij deze persona');
        update marketing_hq.werkstuk_stappen
          set status='klaar', agent_id='radar', waarom='signaal opgepikt'
          where werkstuk_id=1 and station=1;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=1")"

# Station 6 heeft niemand om aan over te dragen.
check "station 6 mag zonder, want daar is geen volgende" "klaar" \
  "$(q "update marketing_hq.werkstuk_stappen set status='klaar', agent_id='echo', waarom='afgerond'
        where werkstuk_id=1 and station=6;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=6")"

# ── de vijf delen ─────────────────────────────────────────────────────────
echo
echo "  de vijf delen zijn verplicht"
for veld in besluit waarom controleren; do
  check "zonder $veld wordt hij geweigerd" "ja" \
    "$(weigert "insert into marketing_hq.werkstuk_overdrachten
                (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
                values (1,2,3,'nova',
                  $( [ $veld = besluit ]     && echo "''" || echo "'iets'" ),
                  $( [ $veld = waarom ]      && echo "''" || echo "'iets'" ),
                  $( [ $veld = controleren ] && echo "''" || echo "'iets'" ))" "check constraint")"
done
check "en zonder afzender ook" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_overdrachten
              (werkstuk_id, van_station, naar_station, besluit, waarom, controleren)
              values (1,2,3,'a','b','c')" "check constraint")"
check "een overdracht met twee afzenders ook" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_overdrachten
              (werkstuk_id, van_station, naar_station, van_agent, van_mens, besluit, waarom, controleren)
              values (1,2,3,'nova','11111111-1111-1111-1111-111111111111','a','b','c')" "check constraint")"
# Een mens draagt net zo goed over als een agent.
check "een mens mag overdragen" "Dustin Gibson" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_mens, besluit, waarom, controleren)
        values (1,3,4,'11111111-1111-1111-1111-111111111111',
          'Drie statics af', 'Beeld gemaakt in de console', 'Of de kop bij de persona past');
        select van from marketing_hq.overdrachten where van_station=3")"

# ── onzekerheden hebben een vorm ──────────────────────────────────────────
echo
echo "  onzekerheden hebben een vorm, anders werkt de poort niet"
check "een tekst in plaats van een lijst wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_overdrachten
              (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
              values (1,2,3,'nova','a','b','c','\"weet ik niet\"')" "onzekerheden_vorm")"
check "een onzekerheid zonder 'blokkerend' ook" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_overdrachten
              (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
              values (1,2,3,'nova','a','b','c','[{\"wat\":\"geen idee\"}]')" "onzekerheden_vorm")"
check "en een lege beschrijving ook" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_overdrachten
              (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
              values (1,2,3,'nova','a','b','c','[{\"wat\":\"  \",\"blokkerend\":true}]')" "onzekerheden_vorm")"
check "een lege lijst mag: er staat dan niets open" "0" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
        values (1,4,5,'bolt','Live gezet','Goedgekeurd door Dustin','Of de meting binnenkomt')
        returning jsonb_array_length(onzekerheden)")"

# ═══════════════════════════════════════════════════════════════════════════
#  2. WIE EEN BLOKKADE OPSCHRIJFT, MAAKT EEN POORT
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  een blokkerende onzekerheid maakt er vanzelf een poort van"
check "niet-blokkerend laat de overdracht doorlopen" "false" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
        values (1,5,6,'atlas','Cijfers binnen','Zeven dagen gemeten','Of de hypothese klopte',
          '[{\"wat\":\"nog een dag attributie te gaan\",\"blokkerend\":false}]')
        returning mens_nodig::text")"
check "blokkerend wél" "true" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
        values (1,2,3,'nova','Hoek uitwerken','Radar leverde het signaal','Of het format past',
          '[{\"wat\":\"budget onbekend\",\"blokkerend\":true}]')
        returning mens_nodig::text")"
check "en de reden staat erbij" "budget onbekend" \
  "$(q "select mens_nodig_reden from marketing_hq.werkstuk_overdrachten
        where van_station=2 and mens_nodig")"
check "meerdere blokkades worden allemaal genoemd" "geen beeld; geen budget" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden)
        values (1,3,4,'pixel','Klaar','Gemaakt','Kijk na',
          '[{\"wat\":\"geen beeld\",\"blokkerend\":true},{\"wat\":\"geen budget\",\"blokkerend\":true}]')
        returning mens_nodig_reden")"

# Dit is de kern: de agent mag het niet zelf bepalen.
check "een agent die zegt dat er geen mens nodig is, wordt overruled" "true" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, onzekerheden, mens_nodig)
        values (1,4,5,'bolt','Gewoon doorzetten','Het lijkt me prima','Niets bijzonders',
          '[{\"wat\":\"we weten niet wat het kost\",\"blokkerend\":true}]', false)
        returning mens_nodig::text")"
check "en andersom net zo: zonder blokkade geen poort" "false" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren, mens_nodig)
        values (1,1,2,'radar','Signaal','Gezien','Kijk na', true)
        returning mens_nodig::text")"

# ── wat de ontvanger ermee deed ───────────────────────────────────────────
echo
echo "  stilzwijgend doorgaan bestaat niet"
check "vier uitkomsten, meer niet" "ja" \
  "$(weigert "update marketing_hq.werkstuk_overdrachten set status='genegeerd'
              where van_station=1 and status='open'" "check constraint")"
check "aannemen zonder te zeggen wie, wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.werkstuk_overdrachten set status='aangenomen'
              where van_station=1 and status='open'" "check constraint")"
check "terugsturen zonder reden ook" "ja" \
  "$(weigert "update marketing_hq.werkstuk_overdrachten
              set status='teruggestuurd', door_agent='nova'
              where van_station=1 and status='open'" "check constraint")"
check "met reden mag het" "teruggestuurd" \
  "$(q "update marketing_hq.werkstuk_overdrachten
          set status='teruggestuurd', door_agent='nova', besloten_op=now(),
              terug_reden='De hoek is vorige maand al getest bij deze persona'
        where id = (select min(id) from marketing_hq.werkstuk_overdrachten where van_station=1 and status='open');
        select status from marketing_hq.werkstuk_overdrachten
        where van_station=1 and status='teruggestuurd'")"

# ── de stand, in mensentaal ───────────────────────────────────────────────
echo
echo "  regel 0.4 — elke overdracht zegt waar hij staat"
check "geen enkele zonder stand" 0 \
  "$(q "select count(*) from marketing_hq.overdrachten where stand is null or trim(stand)=''")"
check "een open overdracht met blokkade wacht op een mens" "t" \
  "$(q "select bool_or(stand like 'wacht op een mens%') from marketing_hq.overdrachten
        where status='open' and mens_nodig")"
check "een teruggestuurde noemt wie en waarom" "t" \
  "$(q "select bool_or(stand like 'teruggestuurd door Nova: De hoek is vorige maand%')
        from marketing_hq.overdrachten where status='teruggestuurd'")"
# Een overdracht vanaf station 6 gaat naar niemand. Dat mag, en dan hoort er
# 'einde' te staan in plaats van een lege plek.
check "een overdracht zonder ontvanger zegt 'einde'" "t" \
  "$(q "insert into marketing_hq.werkstuk_overdrachten
          (werkstuk_id, van_station, van_agent, besluit, waarom, controleren)
        values (1,6,'echo','Campagne afgerond','Alles gemeten','Niets meer');
        select bool_or(wat like '%→ einde%') from marketing_hq.brein where soort='overdracht'")"

# ── het brein ─────────────────────────────────────────────────────────────
echo
echo "  het brein kent een zesde bron"
check "overdrachten komen in de stroom" "t" \
  "$(q "select count(*) > 0 from marketing_hq.brein where soort='overdracht'")"
check "met het besluit erin" "t" \
  "$(q "select bool_or(wat like '%Hoek nekirritatie bij hoge kraag oppakken%')
        from marketing_hq.brein where soort='overdracht'")"
check "en het station-naar-station erbij" "t" \
  "$(q "select bool_or(wat like 'station 1 → briefing%') from marketing_hq.brein where soort='overdracht'")"
check "een teruggestuurde overdracht is een fout in de stroom" "error" \
  "$(q "select distinct toon from marketing_hq.brein
        where soort='overdracht' and wat like '%teruggestuurd%'")"
check "een wachtende poort is een waarschuwing" "warn" \
  "$(q "select distinct toon from marketing_hq.brein
        where soort='overdracht' and wat like '%wacht op een mens%'")"
check "alle zes de bronnen zitten erin" 6 \
  "$(q "select count(distinct bron) from marketing_hq.brein")"
check "en het spoor hangt aan het werkstuk" "t" \
  "$(q "select count(*) > 5 from marketing_hq.brein where werkstuk_id = 1 and soort='overdracht'")"

# ── wie kijkt, ziet wat ───────────────────────────────────────────────────
echo
echo "  0017 blijft gelden"
check "geen view zonder security_invoker" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"
check "RLS staat aan op de nieuwe tabel" "t" \
  "$(q "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relname='werkstuk_overdrachten'")"
check "een vreemde ziet geen enkele overdracht" 0 \
  "$(q "set session authorization authenticated; set local test.teamlid='nee';
        select count(*) from marketing_hq.overdrachten")"
check "en geen enkele gebeurtenis in het brein" 0 \
  "$(q "set session authorization authenticated; set local test.teamlid='nee';
        select count(*) from marketing_hq.brein")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
