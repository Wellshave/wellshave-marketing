#!/usr/bin/env bash
# Join every public channel in the workspace as the bot.
# Private channels cannot be joined via API — invite manually with /invite.
#
# Requires: SLACK_BOT_TOKEN with channels:read + channels:join scopes.
# Usage: ./join-all-channels.sh [--dry-run]

set -euo pipefail

if [[ -z "${SLACK_BOT_TOKEN:-}" ]]; then
  echo "error: SLACK_BOT_TOKEN is not set" >&2
  exit 1
fi

DRY_RUN="${1:-}"
CURSOR=""
JOINED=0
SKIPPED=0
FAILED=0

while :; do
  RESP=$(curl -sS -G https://slack.com/api/conversations.list \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    --data-urlencode "types=public_channel" \
    --data-urlencode "exclude_archived=true" \
    --data-urlencode "limit=200" \
    ${CURSOR:+--data-urlencode "cursor=$CURSOR"})

  if ! echo "$RESP" | python3 -c 'import sys,json; sys.exit(0 if json.load(sys.stdin).get("ok") else 1)'; then
    echo "conversations.list failed: $(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("error"))')" >&2
    exit 1
  fi

  while IFS=$'\t' read -r ID NAME IS_MEMBER; do
    [[ -z "$ID" ]] && continue
    if [[ "$IS_MEMBER" == "True" ]]; then
      SKIPPED=$((SKIPPED+1))
      continue
    fi
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
      echo "would join: #$NAME ($ID)"
      JOINED=$((JOINED+1))
      continue
    fi
    JR=$(curl -sS -X POST https://slack.com/api/conversations.join \
      -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"channel\":\"$ID\"}")
    if echo "$JR" | python3 -c 'import sys,json; sys.exit(0 if json.load(sys.stdin).get("ok") else 1)'; then
      echo "joined: #$NAME ($ID)"
      JOINED=$((JOINED+1))
    else
      echo "failed: #$NAME ($ID) -> $(echo "$JR" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("error"))')" >&2
      FAILED=$((FAILED+1))
    fi
    sleep 1  # stay under Slack rate limits
  done < <(echo "$RESP" | python3 -c '
import sys, json
for c in json.load(sys.stdin).get("channels", []):
    print("%s\t%s\t%s" % (c["id"], c["name"], c.get("is_member", False)))')

  CURSOR=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("response_metadata",{}).get("next_cursor",""))')
  [[ -z "$CURSOR" ]] && break
done

echo "---"
echo "joined: $JOINED, already member: $SKIPPED, failed: $FAILED"
