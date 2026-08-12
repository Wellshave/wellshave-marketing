#!/usr/bin/env bash
# Testlus voor de SQL-haak.
#
# Waarom dit een eigen lus heeft:
#
#   Deze haak beslist of een SQL-opdracht zonder tussenkomst van een mens de
#   productiedatabase raakt. Faalt hij de verkeerde kant op, dan is er geen
#   tweede rem. Dat is precies het soort code dat je niet met de hand test.
#
#   De lus staat vooral vol met opdrachten die er van voren uitzien als een
#   leesvraag: een schrijvende CTE, een tweede opdracht achter een puntkomma,
#   een DROP verstopt achter commentaar. Dat is waar een naïef filter breekt.
#
#   bash .claude/hooks/test-alleen-lezen.sh

set -uo pipefail
HAAK="$(cd "$(dirname "$0")" && pwd)/alleen-lezen-sql.sh"
fout=0

oordeel() {
  printf '%s' "$1" | jq -Rs '{tool_name:"mcp__Supabase__execute_sql",tool_input:{query:.}}' \
    | bash "$HAAK" | jq -r '.hookSpecificOutput.permissionDecision'
}
check() {
  local wat="$1" verwacht="$2" query="$3"
  local kreeg; kreeg=$(oordeel "$query")
  if [ "$kreeg" = "$verwacht" ]; then printf '  ok   %s\n' "$wat"
  else fout=$((fout+1)); printf '  FOUT %s\n       verwacht %s, kreeg %s\n' "$wat" "$verwacht" "$kreeg"; fi
}

echo
echo "  lezen gaat door"
check "een gewone select"              allow "select * from marketing_hq.map_dekking"
check "hoofdletters"                   allow "SELECT brand FROM public.creatives"
check "een CTE die alleen leest"       allow "with a as (select 1) select * from a"
check "updated_at is geen update"      allow "select updated_at, created_at from public.creatives"
check "offset is geen set"             allow "select * from creatives offset 10 limit 5"
check "een union over twee tellingen"  allow "select 'a' as d, count(*) from creatives group by 1 union all select 'b', count(*) from creatives group by 1"
check "de systeemcatalogus"            allow "select column_name from information_schema.columns where table_name='creatives'"

echo
echo "  schrijven blijft vragen"
check "een kale delete"                ask "delete from public.creatives"
check "een update"                     ask "update public.creatives set roas = 1"
check "een drop"                       ask "drop view marketing_hq.map_gaten"
check "een insert"                     ask "insert into marketing_hq.agent_jobs (agent_id) values ('atlas')"
check "een truncate"                   ask "truncate public.creatives"
check "grant"                          ask "grant select on public.creatives to anon"

echo
echo "  wat eruitziet als lezen maar het niet is"
# Hier breekt een filter dat alleen naar het eerste woord kijkt.
check "tweede opdracht achter een puntkomma" ask "select 1; delete from public.creatives"
check "een schrijvende CTE"                  ask "with x as (delete from creatives returning *) select * from x"
check "een CTE die bijwerkt"                 ask "with x as (update creatives set roas=0 returning id) select * from x"
check "verstopt achter blokcommentaar"       ask "select 1 /* niets aan de hand */ ; truncate creatives"
check "verstopt achter regelcommentaar"      ask $'select 1 -- niets aan de hand\n; drop table creatives'
check "select into maakt een tabel"          ask "select * into nieuwe_tabel from creatives"
check "een functie die iets afbreekt"        ask "select pg_terminate_backend(123)"
check "een sequence opschuiven"              ask "select nextval('creatives_id_seq')"

echo
echo "  commentaar telt niet mee"
# Zonder het strippen van commentaar zou elke query met het woord 'delete' in
# een toelichting geweigerd worden. Dat is geen veiligheid maar ruis, en ruis
# is precies waarom zo'n filter binnen een week wordt uitgezet.
check "een woord in regelcommentaar"   allow "select * from creatives -- hier nooit delete gebruiken"
check "een woord in blokcommentaar"    allow "select * from creatives /* drop deze view niet */ where id = 1"

echo
echo "  bij twijfel vragen"
check "een lege query"                 ask ""
check "onzin"                          ask "dit is geen sql"
check "een losse puntkomma"            ask ";"
# Een valse treffer is vervelend maar de goede kant op: liever een venster te
# veel dan een stille wijziging.
check "delete als tekstwaarde"         ask "select * from creatives where notes = 'delete'"

echo
[ $fout -eq 0 ] && echo "Alles klopt" || echo "$fout controle(s) mislukt"
exit $((fout > 0))
