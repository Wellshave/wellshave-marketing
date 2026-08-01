#!/usr/bin/env bash
# Testlus voor migratie 0023 — het denkstuk.
#
# Eén regel moet hier bewezen worden, en wel door hem te overtreden: een
# werkstuk komt station ② niet uit zonder dat een MENS het denkstuk heeft
# afgetekend. Dat is de enige plek waar "een handmatig werkstuk gaat nooit
# direct naar productie" afdwingbaar is; alles eromheen is vorm.
#
# De tweede regel die hier telt is minder zichtbaar: "niet doen" moet een
# uitgang zijn en geen doodlopende weg. Een denkfase zonder die uitgang maakt
# van elk idee vanzelf een advertentie.
#
#   bash platform/db/test/denkstuk.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/denkstuk-test-$$"
PORT=${PGTESTPORT:-5509}
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

for m in 0009_ruggengraat 0017_views 0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done

DUSTIN="11111111-1111-1111-1111-111111111111"

psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
-- Werkstuk 1: handmatig gestart. Station 1 blijft leeg met een reden -- dat is
-- precies het geval uit WERKBANK.md §1.
insert into marketing_hq.werkstukken (id, titel, aanleiding, gestart_door)
overriding system value values
  (1,'Nekirritatie bij hoge kraag','Dustin hoorde het twee keer in de klantenservice','mens'),
  (2,'Reisformaat','Radar zag het','radar');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 2);

update marketing_hq.werkstuk_stappen
   set status='niet_vastgelegd',
       waarom='handmatig gestart door Dustin -- geen signaal uit de markt'
 where station=1 and werkstuk_id=1;

insert into marketing_hq.denkstukken (werkstuk_id) values (1), (2);
SQL

# ═══════════════════════════════════════════════════════════════════════════
#  1. DE ZEVEN VRAGEN
# ═══════════════════════════════════════════════════════════════════════════
echo "  de zeven vragen staan als data, niet in code"
check "er zijn er zeven" 7 "$(q "select count(*) from marketing_hq.denkstuk_vragen")"
check "de hypothese is nummer 4" "Wat is de hypothese?" \
  "$(q "select tekst from marketing_hq.denkstuk_vragen where vraag=4")"
check "een onbeantwoorde vraag staat toch in de lijst" 7 \
  "$(q "select count(*) from marketing_hq.denkstuk_regels where werkstuk_id=1")"
check "en zegt dat hij nog leeg is" "nog niet beantwoord" \
  "$(q "select distinct stand from marketing_hq.denkstuk_regels where werkstuk_id=1")"

# ── de zekerheid ──────────────────────────────────────────────────────────
echo
echo "  elk antwoord draagt een zekerheid, en die betekent iets"
check "onderbouwd zonder bron wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
              values (1,1,'Irritatie bij scheren','onderbouwd','nova')" "check constraint")"
check "met bron mag het" "onderbouwd" \
  "$(q "insert into marketing_hq.denkstuk_antwoorden
          (denkstuk_id, vraag, antwoord, zekerheid, door_agent, bron)
        values (1,1,'De hoge kraag schuurt over pas geschoren huid','onderbouwd','nova',
                'WS-14, 4 reviews, mei 2026')
        returning zekerheid")"
check "een vierde zekerheid bestaat niet" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
              values (1,2,'iets','waarschijnlijk','nova')" "check constraint")"
check "aanname mag zonder bron: dat is wat de test moet uitwijzen" "aanname" \
  "$(q "insert into marketing_hq.denkstuk_antwoorden
          (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
        values (1,2,'Mensen willen geen zichtbare rode plekken op werkdagen','aanname','nova')
        returning zekerheid")"
check "en open ook: we weten het niet, en dat blijft staan" "open" \
  "$(q "insert into marketing_hq.denkstuk_antwoorden
          (denkstuk_id, vraag, antwoord, zekerheid, door_mens)
        values (1,3,'Onduidelijk of dit de kantoorpersona of de sporter is','open',
                '11111111-1111-1111-1111-111111111111')
        returning zekerheid")"
check "een antwoord zonder voorsteller wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid)
              values (1,5,'video','aanname')" "check constraint")"
check "twee voorstellers ook" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent, door_mens)
              values (1,5,'video','aanname','pixel','$DUSTIN')" "check constraint")"
check "mensen en agents staan naast elkaar in de lijst" "agent, mens" \
  "$(q "select string_agg(distinct voorgesteld_door_soort, ', ' order by voorgesteld_door_soort)
        from marketing_hq.denkstuk_regels where werkstuk_id=1 and antwoord is not null")"

# ── de hypothese heeft een vorm ───────────────────────────────────────────
echo
echo "  zonder 'omdat' is het een voorspelling en geen hypothese"
check "'als we X, dan Y' zonder Z wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
              values (1,4,'Als we de kraag noemen, dan stijgt de CTR','aanname','nova')" "hypothese_vorm")"
check "losse woorden in de verkeerde volgorde ook" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
              values (1,4,'Omdat het schuurt, dan werkt het, als we het zeggen','aanname','nova')" "hypothese_vorm")"
check "en een gewone zin helemaal" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
              values (1,4,'De kraag is het probleem','aanname','nova')" "hypothese_vorm")"
check "de volledige vorm mag" "aanname" \
  "$(q "insert into marketing_hq.denkstuk_antwoorden
          (denkstuk_id, vraag, antwoord, zekerheid, door_mens)
        values (1,4,
          'Als we de kraagirritatie in de eerste drie seconden noemen, dan stijgt de doorklik, omdat de kijker het herkent voordat hij het product ziet',
          'aanname','$DUSTIN')
        returning zekerheid")"
check "de vormeis geldt alleen voor vraag 4" "aanname" \
  "$(q "insert into marketing_hq.denkstuk_antwoorden
          (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
        values (1,5,'Video van 9 seconden, verticaal','aanname','pixel')
        returning zekerheid")"

# ═══════════════════════════════════════════════════════════════════════════
#  2. DE POORT: EEN MENS TEKENT, EEN AGENT NIET
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  de poort aan het eind van de denkfase"
check "aftekenen met twee vragen open wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.denkstukken
              set status='bevestigd', bevestigd_door='$DUSTIN', bevestigd_op=now()
              where werkstuk_id=1" "kan nog niet afgetekend")"
check "en de melding noemt welke vragen ontbreken" "ja" \
  "$(weigert "update marketing_hq.denkstukken
              set status='bevestigd', bevestigd_door='$DUSTIN', bevestigd_op=now()
              where werkstuk_id=1" "Wat moet getest worden?")"

q "insert into marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag, antwoord, zekerheid, door_agent, bron) values
     (1,6,'Of de herkenning in de hook de doorklik draagt, los van het aanbod','aanname','bolt',null),
     (1,7,'Concurrenten draaien sinds vorige week op dezelfde hoek','onderbouwd','radar','Trendtrack, week 30')" >/dev/null

check "compleet, maar zonder mens erbij: geweigerd" "ja" \
  "$(weigert "update marketing_hq.denkstukken set status='bevestigd'
              where werkstuk_id=1" "check constraint")"
# Dit is de kern van de hele migratie. Er is geen kolom waar een agent in past,
# dus er is geen manier om dit met een slimmer bericht alsnog voor elkaar te
# krijgen.
check "er bestaat geen kolom waarin een agent kan tekenen" 0 \
  "$(q "select count(*) from information_schema.columns
        where table_schema='marketing_hq' and table_name='denkstukken'
          and column_name like 'bevestigd%agent%'")"
check "een mens tekent wél" "bevestigd" \
  "$(q "update marketing_hq.denkstukken
          set status='bevestigd', bevestigd_door='$DUSTIN'
        where werkstuk_id=1 returning status")"
check "en het tijdstip wordt erbij gezet zonder erom te vragen" "t" \
  "$(q "select bevestigd_op is not null from marketing_hq.denkstukken where werkstuk_id=1")"
check "de stand noemt wie tekende" "afgetekend door Dustin Gibson" \
  "$(q "select stand from marketing_hq.denkstukken_stand where werkstuk_id=1")"

# ── bevroren ──────────────────────────────────────────────────────────────
echo
echo "  een afgetekend denkstuk is het verslag van een besluit"
check "een antwoord aanpassen wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.denkstuk_antwoorden set antwoord='iets anders'
              where denkstuk_id=1 and vraag=1" "afgetekend")"
check "een antwoord toevoegen ook" "ja" \
  "$(weigert "insert into marketing_hq.denkstuk_antwoorden
              (denkstuk_id, vraag, antwoord, zekerheid, door_agent)
              values (1,1,'nog iets','aanname','nova')" "afgetekend")"
check "en weghalen ook" "ja" \
  "$(weigert "delete from marketing_hq.denkstuk_antwoorden where denkstuk_id=1 and vraag=1" "afgetekend")"

# ═══════════════════════════════════════════════════════════════════════════
#  3. STATION ② KOMT ER NIET UIT ZONDER AFGETEKEND DENKSTUK
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  de briefing is niet af zolang er niet getekend is"
q "insert into marketing_hq.werkstukken (id, titel, gestart_door)
   overriding system value values (3,'Zonder denkstuk','mens');
   select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 3)" >/dev/null
q "insert into marketing_hq.werkstuk_overdrachten
     (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
   values (3,2,3,'nova','Hoek uitgewerkt','Uit het signaal','Of het format past')" >/dev/null

check "een werkstuk zonder denkstuk komt station 2 niet uit" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen set status='klaar', agent_id='nova', waarom='af'
              where werkstuk_id=3 and station=2" "heeft geen denkstuk")"
q "insert into marketing_hq.denkstukken (werkstuk_id) values (3)" >/dev/null
check "met een denkstuk dat nog niet getekend is ook niet" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen set status='klaar', agent_id='nova', waarom='af'
              where werkstuk_id=3 and station=2" "nog niet afgetekend")"
check "en de melding zegt dat er een mens aan te pas moet komen" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen set status='klaar', agent_id='nova', waarom='af'
              where werkstuk_id=3 and station=2" "Een mens moet ervoor tekenen")"
check "de creatie kan niet beginnen zolang de briefing loopt" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen set status='bezig', agent_id='pixel'
              where werkstuk_id=3 and station=3" "creatie van werkstuk 3 kan niet beginnen")"

q "insert into marketing_hq.werkstuk_overdrachten
     (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
   values (1,2,3,'nova','Hoek uitgewerkt tot briefing','Denkstuk afgetekend door Dustin',
           'Of het format bij de persona past')" >/dev/null
check "met een afgetekend denkstuk mag het wel" "klaar" \
  "$(q "update marketing_hq.werkstuk_stappen set status='klaar', agent_id='nova', waarom='briefing af'
          where werkstuk_id=1 and station=2;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=2")"
check "en dan mag de creatie beginnen" "bezig" \
  "$(q "update marketing_hq.werkstuk_stappen set status='bezig', agent_id='pixel'
          where werkstuk_id=1 and station=3;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=3")"

# ═══════════════════════════════════════════════════════════════════════════
#  4. NIET DOEN IS EEN GELDIGE UITKOMST
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  niet doen is een uitgang, geen doodlopende weg"
check "stoppen zonder reden wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.denkstukken set status='gestopt' where werkstuk_id=2" "check constraint")"
check "met reden mag het" "gestopt" \
  "$(q "update marketing_hq.denkstukken
          set status='gestopt', gestopt_reden='Dezelfde hoek draait al onder WS-9'
        where werkstuk_id=2 returning status")"
check "en het werkstuk stopt mee" "gestopt" \
  "$(q "select status from marketing_hq.werkstukken where id=2")"
check "met de reden erbij, want over een half jaar is dat een echte vraag" "denkfase gestopt: Dezelfde hoek draait al onder WS-9" \
  "$(q "select gestopt_reden from marketing_hq.werkstukken where id=2")"
check "de openstaande stations blijven niet halfopen staan" 5 \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen
        where werkstuk_id=2 and status='niet_vastgelegd' and station>=2")"
check "station 1 blijft staan zoals het was" "open" \
  "$(q "select status from marketing_hq.werkstuk_stappen where werkstuk_id=2 and station=1")"

# ═══════════════════════════════════════════════════════════════════════════
#  5. HET OORDEEL OVER DE BALANS — WIJZEN, NIET BLOKKEREN
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  regel 0.4 — elk denkstuk zegt waar het staat"
check "geen enkel denkstuk zonder stand" 0 \
  "$(q "select count(*) from marketing_hq.denkstukken_stand where stand is null or trim(stand)=''")"
check "en geen enkel zonder oordeel over de balans" 0 \
  "$(q "select count(*) from marketing_hq.denkstukken_stand where balans is null or trim(balans)=''")"
check "een half denkstuk zegt hoeveel er nog te gaan is" "nog 7 van de 7 vragen te gaan" \
  "$(q "select stand from marketing_hq.denkstukken_stand where werkstuk_id=3")"
check "en houdt zijn oordeel nog even in" "nog te vroeg voor een oordeel" \
  "$(q "select balans from marketing_hq.denkstukken_stand where werkstuk_id=3")"
check "een gemengd denkstuk is in balans" "t" \
  "$(q "select balans like 'in balans:%' from marketing_hq.denkstukken_stand where werkstuk_id=1")"
check "met de telling erbij" "in balans: 2 onderbouwd, 4 aanname, 1 open" \
  "$(q "select balans from marketing_hq.denkstukken_stand where werkstuk_id=1")"

# Een denkstuk dat overal 'onderbouwd' zegt test niets nieuws. Het systeem
# zegt dat hardop en houdt het niet tegen -- dat is een oordeel van het team.
q "insert into marketing_hq.werkstukken (id, titel, gestart_door)
   overriding system value values (4,'Alles al bekend','nova');
   select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 4);
   insert into marketing_hq.denkstukken (werkstuk_id) values (4);
   insert into marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag, antwoord, zekerheid, door_agent, bron)
   select (select id from marketing_hq.denkstukken where werkstuk_id=4), v.vraag,
          case v.vraag when 4 then 'Als we niets veranderen, dan blijft het gelijk, omdat we het al weten'
                       else 'Dat weten we al' end,
          'onderbouwd','nova','WS-9'
   from marketing_hq.denkstuk_vragen v" >/dev/null
check "alles onderbouwd wordt hardop gezegd" "alles onderbouwd — dan test dit werkstuk niets nieuws" \
  "$(q "select balans from marketing_hq.denkstukken_stand where werkstuk_id=4")"
check "maar niet tegengehouden" "bevestigd" \
  "$(q "update marketing_hq.denkstukken set status='bevestigd', bevestigd_door='$DUSTIN'
        where werkstuk_id=4 returning status")"

# ── wie kijkt, ziet wat ───────────────────────────────────────────────────
echo
echo "  0017 blijft gelden"
check "geen view zonder security_invoker" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"
check "RLS staat aan op alle drie de nieuwe tabellen" 3 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relrowsecurity
          and c.relname in ('denkstukken','denkstuk_antwoorden','denkstuk_vragen')")"
check "een vreemde ziet geen enkel denkstuk" 0 \
  "$(q "set session authorization authenticated; set local test.teamlid='nee';
        select count(*) from marketing_hq.denkstukken_stand")"
check "en geen enkel antwoord" 0 \
  "$(q "set session authorization authenticated; set local test.teamlid='nee';
        select count(*) from marketing_hq.denkstuk_regels")"
check "een teamlid ziet ze wel" "t" \
  "$(q "set session authorization authenticated; set local test.teamlid='ja';
        select count(*) > 0 from marketing_hq.denkstukken_stand")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
