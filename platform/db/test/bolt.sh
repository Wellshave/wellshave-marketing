#!/usr/bin/env bash
# Testlus voor migratie 0020 — Bolt.
#
# Atlas kan hooguit iets verkeerds opschrijven; Bolt kan geld uitgeven. Zijn
# guardrails staan daarom niet in een promptregel maar in constraints, en een
# constraint bewijs je door hem te overtreden. Elke controle hieronder begint
# dus met iets wat niet mag.
#
# De vier die ertoe doen:
#   - een goedkeuring zonder uitvoerbare parameters wordt geweigerd
#   - hetzelfde verzoek twee keer openzetten wordt geweigerd
#   - meer dan vijf openstaande verzoeken wordt geweigerd
#   - nakoming werkt ook voor een agent die geen rapporten schrijft
#
#   bash platform/db/test/bolt.sh

set -uo pipefail
MIGDIR="$(cd "$(dirname "$0")/../migrations" && pwd)"
WERK="${TMPDIR:-/tmp}/bolt-test-$$"
PORT=${PGTESTPORT:-5506}
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

# Weigert de database dit? Zo ja: welke regel greep in.
weigert() {
  local uit; uit=$(qerr "$1")
  case "$uit" in
    *"$2"*) echo ja ;;
    *ERROR*) echo "andere fout: $uit" ;;
    *)      echo nee ;;
  esac
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

create table marketing_hq.agents (id text primary key, name text not null);
insert into marketing_hq.agents values
  ('radar','Radar'),('nova','Nova'),('bolt','Bolt'),('atlas','Atlas'),('echo','Echo');

create table marketing_hq.agent_afspraken (
  agent_id text not null references marketing_hq.agents(id), kind text not null,
  soort text not null default 'model', cadans text not null, levert text not null,
  doel_tabel text not null, lat text not null, max_stilte_uren integer not null,
  actief boolean not null default true, created_at timestamptz default now(),
  primary key (agent_id, kind));

-- Zoals hij op productie staat: `id` is een leesbare tekstsleutel en geen
-- oplopend nummer. Deze fixture had eerst een identity-kolom, waardoor de
-- testlus groen stond op een schema dat niet bestaat -- de migratie viel pas om
-- bij het toepassen op productie.
create table marketing_hq.schedules (
  id text primary key,
  agent_id text not null, kind text not null, cron text not null,
  payload jsonb not null default '{}'::jsonb, enabled boolean not null default true,
  last_fired_at timestamptz, next_due_at timestamptz,
  created_at timestamptz not null default now());

create table marketing_hq.agent_jobs (
  id bigint generated always as identity primary key, agent_id text, kind text);
create table marketing_hq.agent_runs (
  id bigint generated always as identity primary key,
  agent_id text, started_at timestamptz default now(), status text, job_id bigint);

create table marketing_hq.approvals (
  id bigint generated always as identity primary key,
  requested_by text not null references marketing_hq.agents(id),
  action_type text not null, description text not null, payload jsonb,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','executed')),
  decided_by text, decided_at timestamptz,
  created_at timestamptz not null default now(), werkstuk_id bigint);

create table marketing_hq.reports (
  id bigint generated always as identity primary key,
  author_agent text, created_at timestamptz default now(), title text);

create table marketing_hq.meta_publications (
  id bigint generated always as identity primary key,
  prepared_by text, status text default 'klaargezet', created_at timestamptz default now());

create table public.creatives (
  id bigint generated always as identity primary key,
  ad_name text, updated_at timestamptz default now());

-- De drie verzoeken uit juli, precies zoals ze op productie staan: met hun
-- bedrag in de beschrijving en niet in de payload. Ze moeten deze migratie
-- overleven, want ze wachten nog steeds op een besluit.
insert into marketing_hq.approvals (requested_by, action_type, description, payload, status, created_at) values
  ('nova','budget_change','Budget Advertorial Pages verhogen (+20%/dag zolang ROAS >= 3)',
   '{"proposal":"+20%","account_id":"act_242238038391551","campaign_id":"120250501609280577"}', 'pending', now() - interval '5 days'),
  ('nova','send_email','1 van de 5 klaarliggende SGL-drafts inplannen',
   '{"klaviyo_campaign_id":"01H2X"}', 'pending', now() - interval '5 days'),
  ('nova','pause_campaign','Testcampagne 001 monitoren of cappen',
   '{"proposal":"cap","account_id":"act_242238038391551","campaign_id":"120251234"}', 'pending', now() - interval '5 days');

-- Zoals op productie: een planning die er al stond zonder afspraak ernaast.
insert into marketing_hq.schedules (id, agent_id, kind, cron)
values ('bolt_scorecard','bolt','creative_scorecard','20 5 * * *');
SQL

# Eén keer draaien en de uitvoer bewaren. Hem bij een fout nog eens draaien om
# de melding te laten zien is misleidend: de tweede poging struikelt over wat de
# eerste al had aangelegd, en dan lees je de verkeerde fout.
mig_uit=$(psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -f "$MIGDIR/0020_bolt.sql" 2>&1)
if [ $? -ne 0 ]; then
  echo "  FOUT migratie 0020 draait niet:"
  echo "$mig_uit" | grep -E '^ERROR|^psql:.*ERROR' | head -3
  exit 1
fi

# ── 0. de bestaande verzoeken overleven de migratie ───────────────────────
echo "  wat er stond blijft staan"
check "de drie verzoeken uit juli staan er nog" 3 \
  "$(q "select count(*) from marketing_hq.approvals where status='pending'")"
check "ook die met zijn bedrag in de tekst in plaats van de payload" 1 \
  "$(q "select count(*) from marketing_hq.approvals
        where action_type='budget_change' and not (payload ? 'bedrag_eur')")"

# ── 1. de afspraak ────────────────────────────────────────────────────────
echo
echo "  de afspraak"
check "twee afspraken voor Bolt" "dagbesluit_opvolgen, publish_queue" \
  "$(q "select string_agg(kind, ', ' order by kind) from marketing_hq.agent_afspraken where agent_id='bolt'")"
check "beide met een stiltegrens, geen voornemen" 0 \
  "$(q "select count(*) from marketing_hq.agent_afspraken where agent_id='bolt' and max_stilte_uren is null")"
# Een afspraak zonder planning is een afspraak die nooit afgaat -- dat was de
# fout die 0015 moest herstellen voor Atlas' audit.
check "en beide ook echt ingepland" 2 \
  "$(q "select count(*) from marketing_hq.schedules s join marketing_hq.agent_afspraken a
        on a.agent_id=s.agent_id and a.kind=s.kind where s.agent_id='bolt'")"
check "opvolgen draait ná Atlas, niet ervoor" "45 6 * * *" \
  "$(q "select cron from marketing_hq.schedules where agent_id='bolt' and kind='dagbesluit_opvolgen'")"

# Op productie stond een planning zonder afspraak: het spiegelbeeld van de fout
# die 0015 herstelde. Die hoort uit te gaan, met de reden erbij.
check "een planning zonder afspraak staat uit" "false" \
  "$(q "select enabled::text from marketing_hq.schedules where id='bolt_scorecard'")"
check "en zegt waarom" "t" \
  "$(q "select payload ? 'uit_reden' from marketing_hq.schedules where id='bolt_scorecard'")"
check "geen enkele actieve planning zonder afspraak" 0 \
  "$(q "select count(*) from marketing_hq.schedules s
        where s.enabled and not exists (
          select 1 from marketing_hq.agent_afspraken a
           where a.agent_id = s.agent_id and a.kind = s.kind)")"

# ═══════════════════════════════════════════════════════════════════════════
#  DE GUARDRAILS
# ═══════════════════════════════════════════════════════════════════════════
echo
echo "  een verzoek dat je niet kunt uitvoeren, komt er niet in"
# Alle drie de vormen lopen op dezelfde regel stuk, en dat is de bedoeling:
# geen payload, een lege payload en een payload zonder id zijn alle drie
# "ik kan niet zien waar dit over gaat".
check "zonder payload wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description)
              values ('bolt','ad_pause','Pauzeer de onderpresteerders')" "approvals_noemt_een_id")"
check "met een lege payload ook" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','ad_pause','Pauzeer de onderpresteerders','{}')" "approvals_noemt_een_id")"
# Dit is regel 0.3 als constraint: mooie woorden zonder id zijn geen aanbeveling.
check "met wel tekst maar geen enkel id ook" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','ad_pause','Pauzeer de onderpresteerders','{\"reden\":\"lage roas\",\"aantal\":3}')" "approvals_noemt_een_id")"
check "mét een id mag het wel" "1" \
  "$(q "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','ad_pause','Zet WS-200 uit','{\"ad_id\":\"120252206202030577\",\"account_id\":\"act_1\"}')
        returning 1")"

echo
echo "  kost het geld, dan staat het bedrag erbij"
check "een budgetwijziging zonder bedrag wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','budget_change','Meer budget op WS-118','{\"ad_id\":\"A1\"}')" "approvals_geld_noemt_bedrag")"
check "een bedrag als tekst telt niet als bedrag" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','budget_change','Meer budget op WS-118','{\"ad_id\":\"A1\",\"bedrag_eur\":\"twintig\"}')" "approvals_geld_noemt_bedrag")"
check "met een getal mag het" "1" \
  "$(q "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','budget_change','Meer budget op WS-118','{\"ad_id\":\"A1\",\"bedrag_eur\":20}')
        returning 1")"
# Een verzoek dat niets kost hoeft geen bedrag te noemen.
check "een verzoek zonder geldgevolg hoeft geen bedrag" "1" \
  "$(q "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','ad_launch','Zet WS-210 live','{\"ad_id\":\"A9\"}') returning 1")"

echo
echo "  niet elke ochtend hetzelfde opnieuw vragen"
check "hetzelfde verzoek tweemaal open wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','ad_pause','Zet WS-200 uit (nogmaals)','{\"ad_id\":\"120252206202030577\",\"account_id\":\"act_1\"}')" "approvals_geen_dubbel_open")"
check "een ander soort handeling op dezelfde ad mag wel" "1" \
  "$(q "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','ad_note','Notitie bij WS-200','{\"ad_id\":\"120252206202030577\"}') returning 1")"
# Zodra het besluit genomen is, mag het opnieuw gevraagd worden -- anders kun je
# een advertentie die je vorige maand liet staan nooit meer uitzetten.
check "en na een besluit mag dezelfde vraag opnieuw" "1" \
  "$(q "update marketing_hq.approvals set status='rejected', decided_by='dustin', decided_at=now()
        where action_type='ad_pause' and payload->>'ad_id'='120252206202030577';
        insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','ad_pause','Zet WS-200 alsnog uit','{\"ad_id\":\"120252206202030577\",\"account_id\":\"act_1\"}')
        returning 1")"

echo
echo "  een lijst die je nog kunt overzien"
# Bolt heeft er nu 4 open. De vijfde mag nog, de zesde niet.
check "Bolt heeft er vier open" 4 \
  "$(q "select count(*) from marketing_hq.approvals where requested_by='bolt' and status='pending'")"
check "de vijfde mag nog" "1" \
  "$(q "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','ad_pause','Zet WS-999 uit','{\"ad_id\":\"999\"}') returning 1")"
check "de zesde wordt geweigerd" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','ad_pause','Zet WS-888 uit','{\"ad_id\":\"888\"}')" "op een besluit te wachten")"
# De melding moet zeggen wat er moet gebeuren, niet alleen dat het niet mag.
check "en de melding zegt wat hij moet doen" "ja" \
  "$(weigert "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
              values ('bolt','ad_pause','Zet WS-888 uit','{\"ad_id\":\"888\"}')" "Handel die eerst af")"
# De grens geldt per agent: Nova's stapel blokkeert Bolt niet en andersom.
check "de grens geldt per agent, niet over het hele team" "1" \
  "$(q "insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('atlas','ad_note','Notitie van Atlas','{\"ad_id\":\"777\"}') returning 1")"
check "en zodra er één is afgehandeld, mag er weer één bij" "1" \
  "$(q "update marketing_hq.approvals set status='approved', decided_by='dustin', decided_at=now()
        where requested_by='bolt' and payload->>'ad_id'='999';
        insert into marketing_hq.approvals (requested_by, action_type, description, payload)
        values ('bolt','ad_pause','Zet WS-888 uit','{\"ad_id\":\"888\"}') returning 1")"

# ── 5. nakoming ───────────────────────────────────────────────────────────
echo
echo "  nakoming werkt ook voor wie geen rapporten schrijft"
psql -h "${TMPDIR:-/tmp}" -p "$PORT" -U postgres -q <<'SQL' >/dev/null 2>&1
insert into marketing_hq.agent_afspraken (agent_id, kind, soort, cadans, levert, doel_tabel, lat, max_stilte_uren)
values ('atlas','daily_report','model','elke dag 05:00','rapport','reports','een rij in reports',30);
insert into marketing_hq.agent_jobs (agent_id, kind) values
  ('bolt','dagbesluit_opvolgen'), ('bolt','publish_queue'), ('atlas','daily_report');
insert into marketing_hq.agent_runs (agent_id, started_at, status, job_id)
select 'bolt', now() - interval '1 hour', 'ok', id from marketing_hq.agent_jobs where kind='dagbesluit_opvolgen';
insert into marketing_hq.agent_runs (agent_id, started_at, status, job_id)
select 'bolt', now() - interval '1 hour', 'ok', id from marketing_hq.agent_jobs where kind='publish_queue';
insert into marketing_hq.agent_runs (agent_id, started_at, status, job_id)
select 'atlas', now() - interval '1 hour', 'ok', id from marketing_hq.agent_jobs where kind='daily_report';
SQL
# Bolt heeft gedraaid én goedkeuringen aangemaakt -> op tijd.
check "Bolt levert goedkeuringen en telt dus als op tijd" "op tijd" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='bolt' and kind='dagbesluit_opvolgen'")"
# Voor publish_queue is er wél gedraaid maar niets gepubliceerd.
check "maar publiceren deed hij niet: gedraaid, niets geleverd" "gedraaid, niets geleverd" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='bolt' and kind='publish_queue'")"
check "en zodra hij wel publiceert, klopt het weer" "op tijd" \
  "$(q "insert into marketing_hq.meta_publications (prepared_by) values ('bolt');
        select oordeel from marketing_hq.agent_nakoming where agent_id='bolt' and kind='publish_queue'")"
# En de bestaande tak voor rapporten mag daar niet door omvallen.
check "Atlas' rapporten worden nog steeds geteld" "gedraaid, niets geleverd" \
  "$(q "select oordeel from marketing_hq.agent_nakoming where agent_id='atlas'")"
check "en zodra hij een rapport schrijft ook" "op tijd" \
  "$(q "insert into marketing_hq.reports (author_agent, title) values ('atlas','Dagrapport');
        select oordeel from marketing_hq.agent_nakoming where agent_id='atlas'")"

# ── 6. de voorstellen ─────────────────────────────────────────────────────
echo
echo "  wat er op een besluit wacht"
check "het bedrag komt als getal terug" "20" \
  "$(q "select bedrag_eur::int from marketing_hq.bolt_voorstellen where action_type='budget_change' and requested_by='bolt'")"
check "het doel-id staat erbij" "A1" \
  "$(q "select doel_id from marketing_hq.bolt_voorstellen where action_type='budget_change' and requested_by='bolt'")"
check "en elke rij zegt waar hij staat" 0 \
  "$(q "select count(*) from marketing_hq.bolt_voorstellen where stand is null or trim(stand)=''")"
check "een wachtend verzoek zegt dat het op jou wacht" "wacht op een besluit van jou" \
  "$(q "select distinct stand from marketing_hq.bolt_voorstellen where status='pending' limit 1")"
check "en een afgewezen verzoek noemt wie" "afgewezen door dustin" \
  "$(q "select distinct stand from marketing_hq.bolt_voorstellen where status='rejected' limit 1")"

# ── 7. wie kijkt, ziet wat ────────────────────────────────────────────────
echo
echo "  0017 blijft gelden"
check "geen view zonder security_invoker" 0 \
  "$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='marketing_hq' and c.relkind='v'
          and coalesce(array_to_string(c.reloptions,','),'') not like '%security_invoker=true%'")"

echo
if [ "$fout" -eq 0 ]; then echo "  Alle controles geslaagd"; else echo "  $fout controle(s) mislukt"; fi
exit $((fout > 0))
