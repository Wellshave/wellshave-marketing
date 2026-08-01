#!/usr/bin/env bash
# Testlus voor migratie 0019 — het brein en de werkbank.
#
# Twee dingen moeten hier bewezen worden, en het tweede is het lastigste.
#
# 1. Het brein voegt vijf tabellen samen tot één stroom. Wie wil weten wat er
#    met een idee gebeurd is, moet de goedkeuring zien tússen de handeling en
#    het rapport — op tijdsvolgorde, niet in drie lijstjes.
#
# 2. Stilte betekent iets anders per soort overdracht. Een stap die vanzelf
#    door hoort te lopen en een dag stilligt, is stuk. Een stap die op een mens
#    wacht mag dagen wachten; dat is de bedoeling, geen storing. Eén drempel
#    voor allebei zou de werkbank elke ochtend laten schreeuwen over werk dat
#    gewoon op jou ligt — en dan kijkt niemand er na een week nog naar.
#
# De reeks hieronder zet zes werkstukken neer die precies dat verschil raken:
# twee met dezelfde stilte (30 uur) maar een ander soort overdracht, en twee
# met dezelfde stilte (100 uur) waarvan er één wel en één niet over de grens is.
#
#   bash platform/db/test/brein.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/brein-test-$$"
PORT=${PGTESTPORT:-5505}
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

# ── de tabellen, in hun echte vorm ────────────────────────────────────────
# Niet de stand-ins uit ruggengraat.sh: 0019 leest kolommen die daar ontbreken
# (kosten, voorlopig, read_at, status op approvals). Een stand-in die die
# kolommen mist zou de test groen laten worden op iets wat niet bestaat.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
create schema marketing_hq;
create role authenticated login; create role anon login;
grant usage on schema marketing_hq, public to authenticated, anon;
create function marketing_hq.is_team_member() returns boolean
  language sql stable as $$ select coalesce(current_setting('test.teamlid', true), 'nee') = 'ja' $$;

create table marketing_hq.agents (id text primary key, name text not null,
  role text not null default '', phase int not null default 1,
  status text not null default 'idle', current_task text,
  last_run_at timestamptz, created_at timestamptz not null default now());

create table marketing_hq.agent_runs (
  id bigint generated always as identity primary key,
  agent_id text, started_at timestamptz default now(), finished_at timestamptz,
  status text, summary text, output_path text, job_id bigint,
  input_tokens int, output_tokens int, cost_usd numeric, model text);

create table marketing_hq.agent_events (
  id bigint generated always as identity primary key,
  job_id bigint, run_id bigint, agent_id text, level text default 'info',
  message text, data jsonb, created_at timestamptz not null default now());

create table marketing_hq.agent_messages (
  id bigint generated always as identity primary key,
  from_agent text, to_agent text, subject text, body text,
  ref_pipeline_item bigint, created_at timestamptz default now(),
  read_at timestamptz, werkstuk_id bigint);

create table marketing_hq.approvals (
  id bigint generated always as identity primary key,
  requested_by text, action_type text, description text, payload jsonb,
  status text default 'open', decided_by text, decided_at timestamptz,
  created_at timestamptz default now(), werkstuk_id bigint);

create table marketing_hq.reports (
  id bigint generated always as identity primary key,
  report_date date, kind text, title text, author_agent text, vault_path text,
  body_md text, created_at timestamptz default now(), werkstuk_id bigint,
  periode_start date, periode_eind date, voorlopig boolean default false,
  voorlopig_reden text, cijfers jsonb, signalen jsonb, gaten jsonb, account_id text);

-- Wat 0009 verder nodig heeft.
create table marketing_hq.pipeline_items    (id bigint generated always as identity primary key, angle text);
create table marketing_hq.email_drafts      (id bigint generated always as identity primary key, angle text);
create table marketing_hq.meta_publications (id bigint generated always as identity primary key, creative_id bigint);
create table marketing_hq.creative_results  (creative_id bigint, spend numeric, purchase_value numeric,
                                             impressions bigint, clicks bigint, roas numeric, beoordeelbaar boolean);
create table public.creatives (
  id bigint generated always as identity primary key, brand text default 'wellshave',
  ad_name text, product text, persona text, angle_type text,
  status text default 'To Test', created_at timestamptz default now());

insert into marketing_hq.agents (id,name) values
  ('radar','Radar'),('nova','Nova'),('pixel','Pixel'),('quill','Quill'),('bolt','Bolt'),
  ('atlas','Atlas'),('echo','Echo'),('vector','Vector'),('sage','Sage');

-- RLS met een policy op alles wat het brein leest, plus leesrecht. Zonder dit
-- zou een vreemde niets zien omdat het recht ontbreekt in plaats van omdat de
-- policy hem tegenhoudt -- en dan test je de verkeerde muur.
do $do$
declare t text;
begin
  foreach t in array array['agent_runs','agent_events','agent_messages','approvals','reports'] loop
    execute format('alter table marketing_hq.%I enable row level security', t);
    execute format('create policy lezen on marketing_hq.%I for select using (marketing_hq.is_team_member())', t);
    execute format('grant select on marketing_hq.%I to authenticated', t);
  end loop;
end $do$;
grant select on public.creatives, marketing_hq.creative_results to authenticated;

-- Bestaan alleen omdat 0017 ze bij naam noemt.
create table marketing_hq.ad_accounts (account_id text primary key, naam text, merk text);
create table marketing_hq.agent_afspraken (agent_id text, kind text);
create table marketing_hq.meta_publiek (account_id text, van date, tot date, segment text);
SQL

# Zelfde volgorde als productie. 0017 zit ertussen omdat werkstuk_estafette
# uit 0009 ouder is dan de security_invoker-regel; zonder 0017 weigert de
# vangnetcontrole van 0019 terecht af te ronden.
for m in 0009_ruggengraat 0017_views 0019_brein; do
  if ! psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -f "$MIGDIR/$m.sql" >/dev/null 2>&1; then
    echo "  FOUT migratie $m draait niet:"
    psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1 \
      | grep -E '^ERROR|^psql:.*ERROR' | head -3
    exit 1
  fi
done

# ── zes werkstukken die het verschil in stilte raken ──────────────────────
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
insert into marketing_hq.werkstukken (id, titel, product, persona, aanleiding, gestart_door, status, gestopt_reden)
overriding system value values
  (1,'Nekirritatie','Scheerschuim','Man 30-45','Radar zag de hoek opkomen','radar','loopt',null),
  (2,'Reviews-hoek','Scheermes','Man 30-45','Nova',                        'nova','loopt',null),
  (3,'Founder story','Scheermes','Man 45+','Nova',                         'nova','loopt',null),
  (4,'Afgerond idee','Scheermes','Man 30-45','Nova',                       'nova','loopt',null),
  (5,'Gestaakt idee','Scheermes','Man 45+','Nova',                         'nova','gestopt','persona bleek niet te bestaan'),
  (6,'Beeld in de maak','Groom Guard','Mark','Nova',                       'nova','loopt',null);
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 6);

-- 0009 legt bij elk nieuw werkstuk zelf al zes stappen op 'open' aan (trigger
-- werkstuk_stations_trg). Deze fixture werkt die stappen dus BIJ; ze opnieuw
-- invoegen zou botsen op unique(werkstuk_id, station) -- en dat zou stil
-- gebeuren, waarna de test een reeks meet die er niet staat.
create or replace function zet(w bigint, st int, ag text, sta text, ov text, wrm text, af interval)
returns void language sql as $fn$
  update marketing_hq.werkstuk_stappen
     set agent_id = ag, status = sta, overdracht = ov, waarom = wrm,
         afgerond_op = case when af is null then null else now() - af end
   where werkstuk_id = w and station = st;
$fn$;

-- W1: ligt op station 2, overdracht 'vanzelf', 30 uur stil -> over de grens (24)
select zet(1,1,'radar','klaar','vanzelf','signaal opgepikt', interval '40 hours');
select zet(1,2,'nova','bezig','vanzelf', null, null);

-- W2: ligt op station 4, overdracht 'poort', 30 uur stil -> NIET over de grens (72)
select zet(2,1,'radar','klaar','vanzelf','signaal',        interval '80 hours');
select zet(2,2,'nova','klaar','vanzelf','gebrieft',        interval '70 hours');
select zet(2,3,null,'klaar','mens','beeld en tekst af',    interval '50 hours');
select zet(2,4,'bolt','wacht_op_mens','poort', null, null);

-- W3: ligt ook op station 4, 'poort', maar 100 uur stil -> WEL over de grens
select zet(3,1,'radar','klaar','vanzelf','signaal',        interval '200 hours');
select zet(3,2,'nova','klaar','vanzelf','gebrieft',        interval '190 hours');
select zet(3,3,null,'klaar','mens','af',                   interval '180 hours');
select zet(3,4,'bolt','wacht_op_mens','poort', null, null);

-- W4: alle zes af -> toestand 'klaar', nooit te stil
update marketing_hq.werkstuk_stappen
   set status='klaar', waarom='af', afgerond_op = now() - interval '500 hours', agent_id='nova'
 where werkstuk_id = 4;

-- W5: gestopt, ligt nog op station 2, lang stil -> nooit te stil
select zet(5,1,'radar','klaar','vanzelf','signaal',        interval '600 hours');
select zet(5,2,'nova','open','vanzelf', null, null);

-- W6: ligt op station 3, overdracht 'mens', 100 uur stil -> NIET over de grens (168)
select zet(6,1,'radar','klaar','vanzelf','signaal',        interval '150 hours');
select zet(6,2,'nova','klaar','vanzelf','gebrieft',        interval '140 hours');
select zet(6,3,null,'bezig','mens', null, null);

-- ── het spoor: vier soorten aan hetzelfde werkstuk, door elkaar in de tijd ──
insert into marketing_hq.agent_events (agent_id, level, message, data, werkstuk_id, created_at) values
  ('radar','info','db_query','{"input":{"q":"trends"}}',1, now() - interval '40 hours'),
  ('nova','info','write_report','{"input":{"kind":"brief"}}',1, now() - interval '35 hours'),
  ('nova','warn','meta_insights mislukte','{"fout":"429"}',1, now() - interval '30 hours'),
  -- werk dat niet aan één idee hangt: de dagelijkse accountmeting
  ('atlas','info','Atlas is klaar','{"samenvatting":"dagrapport"}',null, now() - interval '5 hours');

insert into marketing_hq.agent_messages (from_agent, to_agent, subject, body, werkstuk_id, created_at, read_at) values
  ('radar','nova','hoek: nekirritatie bij hoge kraag','...',1, now() - interval '39 hours', now() - interval '38 hours'),
  ('nova','bolt','klaar om live te zetten','...',2, now() - interval '30 hours', null);

insert into marketing_hq.reports (report_date, kind, title, author_agent, vault_path, werkstuk_id, created_at, voorlopig, voorlopig_reden) values
  (current_date, 'brief','Briefing nekirritatie','nova','brain/Briefings/x.md',1, now() - interval '34 hours', false, null),
  (current_date, 'daily','Dagrapport','atlas','brain/Reports/Daily/y.md',null, now() - interval '5 hours', true, 'attributie loopt nog na');

-- De statuswaarden zijn Engels; dat is wat de constraint op approvals toestaat.
-- Deze reeks staat hier zo omdat de view ze eerst in het Nederlands verwachtte
-- en drie wachtende goedkeuringen daardoor stil doorvielen naar 'info'.
insert into marketing_hq.approvals (requested_by, action_type, description, status, werkstuk_id, created_at, decided_by, decided_at) values
  ('bolt','budget','GroomGuard-test op 20 euro/dag','pending',2, now() - interval '30 hours', null, null),
  ('nova','publiceren','Nekirritatie v1 live','approved',1, now() - interval '33 hours','dustin', now() - interval '32 hours'),
  -- Deze twee hangen bewust aan géén werkstuk: hangen ze aan W3, dan is dat
  -- werkstuk opeens 18 uur geleden aangeraakt en meet de stiltecontrole
  -- verderop iets anders dan hij bedoelt.
  ('bolt','pauzeren','Verlieslatende ad uitzetten','rejected',null, now() - interval '20 hours','dustin', now() - interval '19 hours'),
  ('bolt','budget','Uitgevoerde poort','executed',null, now() - interval '18 hours','dustin', now() - interval '17 hours');

insert into marketing_hq.agent_runs (agent_id, started_at, finished_at, status, summary, cost_usd, input_tokens, output_tokens, model) values
  ('nova', now() - interval '36 hours', now() - interval '35 hours','klaar','Nova briefte het team', 0.0412, 12000, 900,'claude-opus-5'),
  ('atlas',now() - interval '6 hours',  now() - interval '5 hours', 'klaar','Atlas leverde het dagrapport', 0.0388, 9000, 700,'claude-opus-5');
SQL

# ── 1. één stroom uit vijf tabellen ───────────────────────────────────────
echo "  het brein voegt vijf bronnen samen"
check "alle vijf de bronnen komen erin" "agent_events, agent_messages, agent_runs, approvals, reports" \
  "$(q "select string_agg(distinct bron, ', ' order by bron) from marketing_hq.brein")"
check "zes soorten, niet dertig" "bericht, handeling, poort, rapport, run" \
  "$(q "select string_agg(distinct soort, ', ' order by soort) from marketing_hq.brein")"

# Dit is waarom het één view is en geen drie: het verhaal van één idee loopt
# door de bronnen heen.
echo
echo "  het verhaal van één idee, op tijdsvolgorde"
check "zes gebeurtenissen aan werkstuk 1" 6 \
  "$(q "select count(*) from marketing_hq.brein where werkstuk_id = 1")"
check "en ze staan door elkaar, niet per bron gegroepeerd" \
  "handeling|bericht|handeling|rapport|poort|handeling" \
  "$(q "select string_agg(soort, '|' order by wanneer) from marketing_hq.brein where werkstuk_id = 1")"

# ── 2. de toon draagt betekenis, niet alleen kleur ────────────────────────
echo
echo "  wat aandacht vraagt, zegt dat ook"
check "een ongelezen overdracht is een waarschuwing" "warn" \
  "$(q "select toon from marketing_hq.brein where bron='agent_messages' and werkstuk_id=2")"
check "en zegt erbij dat hij niet is opgepakt" "t" \
  "$(q "select wat like '%nog niet opgepakt%' from marketing_hq.brein where bron='agent_messages' and werkstuk_id=2")"
check "een gelezen overdracht niet" "info" \
  "$(q "select toon from marketing_hq.brein where bron='agent_messages' and werkstuk_id=1")"
check "een wachtende poort is een waarschuwing, geen info" "warn" \
  "$(q "select toon from marketing_hq.brein where bron='approvals' and werkstuk_id=2")"
check "en zegt zichtbaar dat hij wacht" "t" \
  "$(q "select wat like '%wacht op akkoord%' from marketing_hq.brein where bron='approvals' and werkstuk_id=2")"
check "een gegeven akkoord noemt wie" "t" \
  "$(q "select wat like '%akkoord door dustin%' from marketing_hq.brein where bron='approvals' and werkstuk_id=1")"
check "een afwijzing is een fout, want daar strandde werk" "error" \
  "$(q "select toon from marketing_hq.brein where bron='approvals' and wat like '%Verlieslatende%'")"
check "een uitgevoerde poort zegt dat ook" "t" \
  "$(q "select wat like '%uitgevoerd%' from marketing_hq.brein where bron='approvals' and wat like '%Uitgevoerde poort%'")"
# Als iemand later een vijfde status toevoegt, mag die niet stil doorvallen.
check "geen enkele poort valt stil door zonder markering" 0 \
  "$(q "select count(*) from marketing_hq.brein where soort='poort'
        and wat not similar to '%\\((wacht op akkoord|akkoord door|afgewezen door|uitgevoerd|onbekende status)%'")"
check "een voorlopig rapport zegt waarom het voorlopig is" "t" \
  "$(q "select bool_or(wat like '%attributie loopt nog na%') from marketing_hq.brein where bron='reports'")"

# ── 3. geld staat op de run en nergens anders ─────────────────────────────
echo
echo "  wat het kostte"
check "twee runs met kosten" "0.0800" \
  "$(q "select to_char(sum((details->>'kosten_usd')::numeric),'FM0.0000') from marketing_hq.brein where soort='run'")"
check "en geen enkele andere soort draagt kosten" 0 \
  "$(q "select count(*) from marketing_hq.brein where soort <> 'run' and details ? 'kosten_usd'")"

# ── 4. per dag ────────────────────────────────────────────────────────────
echo
echo "  brein_dag"
check "elke gebeurtenis valt op precies één dag" "t" \
  "$(q "select (select sum(gebeurtenissen) from marketing_hq.brein_dag) = (select count(*) from marketing_hq.brein)")"
check "een dag telt zijn eigen fouten en waarschuwingen" "t" \
  "$(q "select bool_and(waarschuwingen >= 0 and fouten >= 0) from marketing_hq.brein_dag")"

# ═══════════════════════════════════════════════════════════════════════════
#  DE REGEL WAAR HET OM DRAAIT
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  stilte betekent iets anders per soort overdracht"
check "W1 loopt vanzelf en ligt 30 uur stil — dat is stuk" "true" \
  "$(q "select te_stil::text from marketing_hq.werkbank where id=1")"
check "W2 wacht op een mens en ligt óók 30 uur stil — dat is normaal" "false" \
  "$(q "select te_stil::text from marketing_hq.werkbank where id=2")"
check "dezelfde stilte, andere grens: 24 tegen 72" "24|72" \
  "$(q "select string_agg(stil_grens_uren::text,'|' order by id) from marketing_hq.werkbank where id in (1,2)")"
check "W3 wacht óók op een mens, maar nu 100 uur — dat is te lang" "true" \
  "$(q "select te_stil::text from marketing_hq.werkbank where id=3")"
check "W6 is creatief werk en mag 100 uur duren" "false" \
  "$(q "select te_stil::text from marketing_hq.werkbank where id=6")"
check "een afgerond werkstuk is nooit te stil" "false" \
  "$(q "select te_stil::text from marketing_hq.werkbank where id=4")"
check "een gestopt werkstuk ook niet" "false" \
  "$(q "select te_stil::text from marketing_hq.werkbank where id=5")"

# ── 5. op wie het wacht, in mensentaal ────────────────────────────────────
echo
echo "  op wie wacht het?"
check "een poort wacht op jou" "jij"  "$(q "select wacht_op from marketing_hq.werkbank where id=2")"
check "creatief werk ook"     "jij"  "$(q "select wacht_op from marketing_hq.werkbank where id=6")"
check "een automatische stap op een agent" "nova" "$(q "select wacht_op from marketing_hq.werkbank where id=1")"
check "een afgerond werkstuk op niemand" "" "$(q "select wacht_op from marketing_hq.werkbank where id=4")"
check "en een gestopt werkstuk ook op niemand" "" "$(q "select wacht_op from marketing_hq.werkbank where id=5")"

echo
echo "  regel 0.4 — er staat altijd een reden"
check "elk werkstuk heeft er een" 0 \
  "$(q "select count(*) from marketing_hq.werkbank where waarom is null or trim(waarom) = ''")"
check "een gestopt werkstuk geeft de reden van stoppen" "persona bleek niet te bestaan" \
  "$(q "select waarom from marketing_hq.werkbank where id=5")"
check "een wachtend werkstuk zegt waar het ligt" "ligt bij jou op station 4 — live" \
  "$(q "select waarom from marketing_hq.werkbank where id=2")"
check "en een lopend werkstuk bij wie" "ligt bij nova op station 2 — briefing" \
  "$(q "select waarom from marketing_hq.werkbank where id=1")"

# ── 6. de stilte komt uit de hele stroom, niet uit één tabel ──────────────
echo
echo "  stilte telt alles mee"
# Werkstuk 2 heeft geen enkel agent_event, alleen een bericht en een poort.
# Zou de werkbank alleen agent_events lezen, dan gold hij als nooit aangeraakt.
check "W2 heeft geen enkele agent_event" 0 \
  "$(q "select count(*) from marketing_hq.agent_events where werkstuk_id = 2")"
check "maar telt toch als 30 uur geleden aangeraakt" "30" \
  "$(q "select stil_uren from marketing_hq.werkbank where id=2")"

# ── 7. wie kijkt, ziet wat ────────────────────────────────────────────────
echo
echo "  0017 blijft gelden"
check "geen view zonder security_invoker" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"
check "een vreemde ziet geen enkele gebeurtenis" 0 "$(alsVreemde 'select count(*) from marketing_hq.brein')"
check "en geen enkel werkstuk"                   0 "$(alsVreemde 'select count(*) from marketing_hq.werkbank')"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
