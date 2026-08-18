#!/usr/bin/env bash
# Testlus voor migratie 0024 — terugsturen.
#
# Drie dingen moeten hier bewezen worden.
#
# 1. De grens van twee. Twee agents kunnen elkaar eindeloos heen en weer
#    sturen, elk met een geldige reden, en dan staat het werkstuk stil terwijl
#    het lijkt te bewegen. De derde keer moet een mens doen — en de grens moet
#    verleggen, niet blokkeren, anders wordt hij omzeild.
#
# 2. Terugsturen grijpt echt in de keten. Een terugzending die alleen zichzelf
#    opschrijft is een notitie; de stations moeten weer opengaan en de teller
#    moet omlaag.
#
# 3. Het sluitstuk van 0023. Daar staat dat een bevroren denkstuk opengaat als
#    het werkstuk teruggestuurd wordt. Die zin wees tot nu toe naar niets.
#
#   bash platform/db/test/terugsturen.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/terugsturen-test-$$"
PORT=${PGTESTPORT:-5510}
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

for m in 0009_ruggengraat 0017_views 0019_brein 0021_deelnemers 0022_overdracht 0023_denkstuk 0024_terugsturen; do
  uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/$m.sql" 2>&1)
  if [ $? -ne 0 ]; then
    echo "  FOUT migratie $m draait niet:"; echo "$uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3; exit 1
  fi
done

DUSTIN="11111111-1111-1111-1111-111111111111"

# Werkstuk 1 rijdt de hele keten door tot ⑤, met een afgetekend denkstuk.
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<SQL >/dev/null 2>&1
insert into marketing_hq.werkstukken (id, titel, aanleiding, gestart_door)
overriding system value values
  (1,'Nekirritatie bij hoge kraag','Twee keer gehoord in de klantenservice','mens'),
  (2,'Reisformaat','Radar zag het','radar');
select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 2);

insert into marketing_hq.denkstukken (werkstuk_id) values (1), (2);

insert into marketing_hq.denkstuk_antwoorden (denkstuk_id, vraag, antwoord, zekerheid, door_agent, bron)
select (select id from marketing_hq.denkstukken where werkstuk_id=1), v.vraag,
       case v.vraag when 4 then 'Als we de kraagirritatie eerst noemen, dan stijgt de doorklik, omdat de kijker het herkent'
                    else 'Antwoord op vraag ' || v.vraag end,
       'aanname','nova',null
from marketing_hq.denkstuk_vragen v;

update marketing_hq.denkstukken set status='bevestigd', bevestigd_door='$DUSTIN' where werkstuk_id=1;

-- Vier overdrachten, zodat de stappen 1 t/m 4 af mogen (0022).
insert into marketing_hq.werkstuk_overdrachten
  (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren) values
  (1,1,2,'radar','Signaal opgepikt','Zoekvolume stijgt','Of de hoek nieuw is'),
  (1,2,3,'nova','Briefing af','Denkstuk afgetekend','Of het format past'),
  (1,3,4,'pixel','Drie statics af','Beeld gemaakt','Of de kop klopt'),
  (1,4,5,'bolt','Live gezet','Goedgekeurd','Of de meting binnenkomt');

update marketing_hq.werkstuk_stappen set status='klaar', agent_id='radar', waarom='signaal', afgerond_op=now()-interval '5 days' where werkstuk_id=1 and station=1;
update marketing_hq.werkstuk_stappen set status='klaar', agent_id='nova',  waarom='briefing', afgerond_op=now()-interval '4 days' where werkstuk_id=1 and station=2;
update marketing_hq.werkstuk_stappen set status='klaar', agent_id='pixel', waarom='creatie',  afgerond_op=now()-interval '3 days' where werkstuk_id=1 and station=3;
update marketing_hq.werkstuk_stappen set status='klaar', agent_id='bolt',  waarom='live',     afgerond_op=now()-interval '2 days' where werkstuk_id=1 and station=4;
update marketing_hq.werkstuk_stappen set status='bezig', agent_id='atlas' where werkstuk_id=1 and station=5;
SQL

check "de keten staat klaar tot ⑤" "4" \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen where werkstuk_id=1 and status='klaar'")"
check "en het denkstuk is afgetekend" "bevestigd" \
  "$(q "select status from marketing_hq.denkstukken where werkstuk_id=1")"

# ═══════════════════════════════════════════════════════════════════════════
#  1. DE VIER DELEN
# ═══════════════════════════════════════════════════════════════════════════
echo "  een terugzending zegt wat er mis is en wat er moet veranderen"
for veld in wat_is_mis wat_moet_anders; do
  check "zonder $veld wordt hij geweigerd" "ja" \
    "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
                (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
                values (1,5,3,'atlas',
                  $( [ $veld = wat_is_mis ]      && echo "''" || echo "'iets'" ),
                  $( [ $veld = wat_moet_anders ] && echo "''" || echo "'iets'" ))" "check constraint")"
done
check "zonder afzender ook" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
              (werkstuk_id, van_station, naar_station, wat_is_mis, wat_moet_anders)
              values (1,5,3,'a','b')" "check constraint")"
check "met twee afzenders ook" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
              (werkstuk_id, van_station, naar_station, door_agent, door_mens, wat_is_mis, wat_moet_anders)
              values (1,5,3,'atlas','$DUSTIN','a','b')" "check constraint")"
# Terugsturen naar voren is gewoon doorgeven, en daar is 0022 voor.
check "'terug' naar een later station bestaat niet" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
              (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
              values (1,3,5,'pixel','a','b')" "check constraint")"
check "en terugsturen naar een station dat nooit af was ook niet" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
              (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
              values (2,3,1,'pixel','a','b')" "valt niets terug te sturen")"

# ═══════════════════════════════════════════════════════════════════════════
#  2. TERUGSTUREN GRIJPT IN DE KETEN
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  de stations gaan weer open en de teller gaat omlaag"
check "de eerste terugzending is ronde 1" "1" \
  "$(q "insert into marketing_hq.werkstuk_terugzendingen
          (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
        values (1,5,3,'atlas',
          'De hook noemt de kraag pas na zeven seconden',
          'Kraag in de eerste drie seconden, anders meet ik iets anders dan de hypothese')
        returning ronde")"
check "station ③ staat weer open" "open" \
  "$(q "select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=3")"
# ④ hoort mee terug: daar staat een advertentie live op een creatie die herzien wordt.
check "en ④ ook, want die stond op de oude creatie" "open" \
  "$(q "select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=4")"
check "② blijft staan, daar ging het niet over" "klaar" \
  "$(q "select status from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=2")"
check "de teller ging omlaag" "2" \
  "$(q "select count(*) from marketing_hq.werkstuk_stappen where werkstuk_id=1 and status='klaar'")"
check "het werkstuk ligt nu weer op ③" "3" \
  "$(q "select station_nu from marketing_hq.werkstuk_estafette where id=1")"
# Anders meet de werkbank de stilte vanaf een afronding die is ingetrokken.
check "afgerond_op ging leeg mee" "t" \
  "$(q "select afgerond_op is null from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=3")"
check "en de reden staat in de stap" "t" \
  "$(q "select waarom like 'teruggestuurd door Atlas (ronde 1): De hook noemt de kraag%'
        from marketing_hq.werkstuk_stappen where werkstuk_id=1 and station=3")"
# §6: een teruggestuurd werkstuk is niet stil — het telt als lopend.
check "het werkstuk is niet stil, het loopt" "loopt" \
  "$(q "select toestand from marketing_hq.werkstuk_estafette where id=1")"

# ═══════════════════════════════════════════════════════════════════════════
#  3. DE GRENS VAN TWEE
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  twee agents kunnen elkaar niet eindeloos heen en weer sturen"
q "update marketing_hq.werkstuk_stappen set status='klaar', waarom='opnieuw gemaakt' where werkstuk_id=1 and station=3;
   update marketing_hq.werkstuk_stappen set status='bezig' where werkstuk_id=1 and station=4" >/dev/null
check "de tweede keer terug naar ③ is ronde 2" "2" \
  "$(q "insert into marketing_hq.werkstuk_terugzendingen
          (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
        values (1,4,3,'bolt','De kop past niet in het 9:16-kader','Kop korter, maximaal vier woorden')
        returning ronde")"
q "update marketing_hq.werkstuk_stappen set status='klaar', waarom='nogmaals' where werkstuk_id=1 and station=3" >/dev/null
# Dit is de kern.
check "de derde keer wordt een agent geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
              (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
              values (1,4,3,'bolt','Nog steeds niet goed','Anders')" "moet een mens doen")"
check "en de melding zegt waaróm dat zo is" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_terugzendingen
              (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
              values (1,4,3,'bolt','x','y')" "lijkt te bewegen")"
# De grens verlegt, hij blokkeert niet. Een werkstuk dat niet meer terug kan,
# zit klem, en dan wordt de grens omzeild in plaats van gerespecteerd.
check "een mens mag het wel, en dat is ronde 3" "3" \
  "$(q "insert into marketing_hq.werkstuk_terugzendingen
          (werkstuk_id, van_station, naar_station, door_mens, wat_is_mis, wat_moet_anders)
        values (1,4,3,'$DUSTIN','Dit is de derde ronde op hetzelfde station','Terug naar de briefing, niet naar de creatie')
        returning ronde")"
check "de grens telt per station, niet per werkstuk" "1" \
  "$(q "update marketing_hq.werkstuk_stappen set status='klaar', waarom='af' where werkstuk_id=1 and station=3;
        insert into marketing_hq.werkstuk_terugzendingen
          (werkstuk_id, van_station, naar_station, door_agent, wat_is_mis, wat_moet_anders)
        values (1,3,2,'pixel','De briefing noemt twee persona''s tegelijk','Kies er één, anders meet ik twee dingen')
        returning ronde")"

# ═══════════════════════════════════════════════════════════════════════════
#  4. HET SLUITSTUK VAN 0023
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  terug naar ② opent het bevroren denkstuk"
check "het denkstuk staat weer open" "bezig" \
  "$(q "select status from marketing_hq.denkstukken where werkstuk_id=1")"
check "en de handtekening is eraf" "t" \
  "$(q "select bevestigd_door is null and bevestigd_op is null
        from marketing_hq.denkstukken where werkstuk_id=1")"
# Dit is waar 0023 naar wees toen hij zei 'stuur het werkstuk terug'.
check "en nu mag er weer aan gewerkt worden" "onderbouwd" \
  "$(q "update marketing_hq.denkstuk_antwoorden
          set antwoord='De hoge kraag schuurt over pas geschoren huid',
              zekerheid='onderbouwd', bron='WS-14, vier reviews'
        where denkstuk_id=(select id from marketing_hq.denkstukken where werkstuk_id=1) and vraag=1
        returning zekerheid")"
check "de briefing kan niet af zonder opnieuw te tekenen" "ja" \
  "$(weigert "insert into marketing_hq.werkstuk_overdrachten
                (werkstuk_id, van_station, naar_station, van_agent, besluit, waarom, controleren)
              values (1,2,3,'nova','Opnieuw af','Herzien','Kijk na');
              update marketing_hq.werkstuk_stappen set status='klaar', waarom='opnieuw af'
              where werkstuk_id=1 and station=2" "nog niet afgetekend")"

# ═══════════════════════════════════════════════════════════════════════════
#  5. HET GAT IN 0023 IS DICHT
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  denken is geen optionele stap"
check "② op 'niet_vastgelegd' zetten wordt geweigerd" "ja" \
  "$(weigert "update marketing_hq.werkstuk_stappen set status='niet_vastgelegd'
              where werkstuk_id=2 and station=2" "Denken is geen optionele stap")"
check "ook bij een nieuw werkstuk zonder denkstuk" "ja" \
  "$(q "insert into marketing_hq.werkstukken (id, titel, gestart_door)
          overriding system value values (3,'Handmatig erin','mens');
        select setval(pg_get_serial_sequence('marketing_hq.werkstukken','id'), 3)" >/dev/null;
      weigert "update marketing_hq.werkstuk_stappen set status='niet_vastgelegd'
               where werkstuk_id=3 and station=2" "Denken is geen optionele stap")"
# De enige geldige reden om ② over te slaan is dat het team besloot het niet
# te doen — en dan staat dat in het denkstuk.
check "tenzij het denkstuk gestopt is: dan mag het wel" "niet_vastgelegd" \
  "$(q "update marketing_hq.denkstukken
          set status='gestopt', gestopt_reden='Dezelfde hoek draait al onder WS-9'
        where werkstuk_id=2;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=2 and station=2")"
check "station ① mag het nog steeds wel, daar is het een echte toestand" "niet_vastgelegd" \
  "$(q "update marketing_hq.werkstuk_stappen
          set status='niet_vastgelegd', waarom='handmatig gestart, geen signaal'
        where werkstuk_id=3 and station=1;
        select status from marketing_hq.werkstuk_stappen where werkstuk_id=3 and station=1")"

# ═══════════════════════════════════════════════════════════════════════════
#  6. OM TE LEZEN
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  regel 0.4 — elke terugzending zegt waar hij staat"
check "geen enkele zonder stand" 0 \
  "$(q "select count(*) from marketing_hq.terugzendingen where stand is null or trim(stand)=''")"
check "ronde 3 zegt dat er een mens aan te pas moest komen" "t" \
  "$(q "select bool_or(stand like '%hier moest een mens aan te pas komen%')
        from marketing_hq.terugzendingen where ronde=3")"
check "ronde 2 waarschuwt vooruit" "t" \
  "$(q "select bool_or(stand like '%daarna moet een mens het doen%')
        from marketing_hq.terugzendingen where ronde=2")"
check "de namen staan erbij, niet de id's" "Dustin Gibson" \
  "$(q "select door from marketing_hq.terugzendingen where ronde=3")"
check "mensen en agents staan naast elkaar" "agent, mens" \
  "$(q "select string_agg(distinct door_soort, ', ' order by door_soort) from marketing_hq.terugzendingen")"
check "en de stations bij naam" "live → creatie" \
  "$(q "select van_station_naam || ' → ' || naar_station_naam
        from marketing_hq.terugzendingen where ronde=3")"

echo
echo "  waar een werkstuk blijft hangen"
check "nul terugzendingen is ook een antwoord" "nog nooit teruggestuurd" \
  "$(q "select stand from marketing_hq.terugzendingen_per_werkstuk where werkstuk_id=3")"
check "en elk werkstuk staat erin, ook het ongeroerde" 3 \
  "$(q "select count(*) from marketing_hq.terugzendingen_per_werkstuk")"
check "vier keer terug wordt geteld" "4" \
  "$(q "select keer_terug from marketing_hq.terugzendingen_per_werkstuk where werkstuk_id=1")"
check "en het zegt dat dit geen uitvoeringsprobleem meer is" "t" \
  "$(q "select stand like 'blijft hangen op creatie — dat is geen uitvoeringsprobleem meer'
        from marketing_hq.terugzendingen_per_werkstuk where werkstuk_id=1")"

# ── wie kijkt, ziet wat ───────────────────────────────────────────────────
echo
echo "  0017 blijft gelden"
check "geen view zonder security_invoker" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"
check "RLS staat aan op de nieuwe tabel" "t" \
  "$(q "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relname='werkstuk_terugzendingen'")"
check "een vreemde ziet geen enkele terugzending" 0 \
  "$(q "set session authorization authenticated; set local test.teamlid='nee';
        select count(*) from marketing_hq.terugzendingen")"
check "een teamlid wel" "t" \
  "$(q "set session authorization authenticated; set local test.teamlid='ja';
        select count(*) > 0 from marketing_hq.terugzendingen")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
