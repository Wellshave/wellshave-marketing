#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Laat een SELECT vanzelf door. Laat al het andere vragen.
#
# Waarom dit bestaat
#
#   `mcp__Supabase__execute_sql` kan lezen én schrijven. Op de allowlist zetten
#   maakt het werk vloeiend maar zet ook de deur open voor een DELETE die
#   niemand ziet. Eraf laten betekent dat elke controlevraag -- en dat zijn er
#   tientallen per sessie -- een klik kost. Dat is geen automatisering maar een
#   wekker.
#
#   Deze haak splitst dat: wat alleen kijkt gaat door, wat iets verandert komt
#   nog steeds in het goedkeuringsvenster.
#
# De regel, en waarom hij zo streng is
#
#   Doorlaten mag alleen als BEIDE waar zijn:
#
#     1. de query begint met SELECT of WITH
#     2. er staat nergens een woord in dat iets kan veranderen
#
#   Punt 2 is niet overbodig naast punt 1. `select 1; delete from creatives`
#   begint met select. En `with x as (delete from creatives returning *) select
#   * from x` ook -- een schrijvende CTE ziet er van voren uit als een leesvraag.
#   Alleen op het eerste woord afgaan is precies de fout die dit soort filters
#   waardeloos maakt.
#
# Waarom woordgrenzen
#
#   `updated_at` bevat 'update' en `created_at` bevat 'create'. Zonder \b zou
#   vrijwel elke query van dit project geweigerd worden en was de haak binnen
#   een dag uitgezet. Met \b matcht 'update' niet op 'updated_at', want er komt
#   een letter achteraan.
#
# Wat er gebeurt bij twijfel
#
#   Vragen. Altijd. Een woord als 'delete' in een tekstwaarde is een valse
#   treffer en levert een onnodig venster op -- vervelend, maar de andere kant
#   op is een stille wijziging in de productiedatabase. Bij twijfel wint de
#   vraag, nooit de doorgang.
# ═══════════════════════════════════════════════════════════════════════════
set -uo pipefail

vraagt() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}
laat_door() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"alleen lezen: %s"}}\n' "$1"
  exit 0
}

invoer=$(cat 2>/dev/null || true)
query=$(printf '%s' "$invoer" | jq -r '.tool_input.query // empty' 2>/dev/null || true)

[ -n "$query" ] || vraagt "geen query in het verzoek gevonden"

# Commentaar eruit voordat er iets beoordeeld wordt: /* ... */ en -- tot
# regeleinde. Anders verstopt `select 1 /* */ ; delete from x` zich erachter.
schoon=$(printf '%s\n' "$query" \
  | sed -e 's,/\*[^*]*\**\([^/*][^*]*\**\)*/, ,g' \
        -e 's,--.*$, ,' \
  | tr '\n\t' '  ' \
  | tr '[:upper:]' '[:lower:]')

# 1. Begint hij met een leesopdracht?
printf '%s' "$schoon" | grep -Eq '^[[:space:]]*(select|with)[[:space:](]' \
  || vraagt "begint niet met SELECT of WITH"

# 2. Staat er nergens een woord dat iets kan veranderen? Ook binnen een CTE,
#    ook achter een puntkomma.
VERANDERT='(insert|update|delete|drop|alter|truncate|create|grant|revoke|refresh|vacuum|reindex|cluster|call|copy|merge|comment|begin|commit|rollback|savepoint|lock|listen|notify|discard|prepare|execute|reset|into|nextval|setval|pg_terminate_backend|pg_cancel_backend|dblink|pg_read_file|pg_write|lo_import|lo_export)'
if printf '%s' "$schoon" | grep -Eqw "$VERANDERT"; then
  gevonden=$(printf '%s' "$schoon" | grep -Eow "$VERANDERT" | head -1)
  vraagt "bevat '$gevonden' -- dit kan meer dan lezen"
fi
# `set` apart: `set local role` verandert wel iets, maar `offset` en
# `setting` mogen niet meeliften. grep -w regelt dat, maar de melding erbij
# hoort te kloppen, dus hij staat los.
if printf '%s' "$schoon" | grep -Eqw 'set'; then
  vraagt "bevat 'set' -- dit kan meer dan lezen"
fi

laat_door "$(printf '%s' "$schoon" | cut -c1-60)"
