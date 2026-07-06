#!/usr/bin/env bash
# Post a Slack message as Dustin 2.0 (bot token), instead of Dustin's user account.
#
# Usage:
#   ./send.sh <channel-or-user-id> <message text>            # plain mrkdwn message
#   ./send.sh <channel-or-user-id> --blocks <blocks.json>    # Block Kit payload (file)
#
# Channel ID for #productivity: C0A3AG516MP
# For DMs, pass the Slack user ID (e.g. U06SNFERCPN) — the bot opens the IM itself.
#
# Requires: SLACK_BOT_TOKEN env var (xoxb-...), set in the Claude environment config.

set -euo pipefail

if [[ -z "${SLACK_BOT_TOKEN:-}" ]]; then
  echo "error: SLACK_BOT_TOKEN is not set" >&2
  exit 1
fi

TARGET="${1:?usage: send.sh <channel-or-user-id> <message | --blocks blocks.json>}"
shift

# If target is a user ID (U.../W...), open a DM first to get the IM channel ID.
CHANNEL="$TARGET"
if [[ "$TARGET" =~ ^[UW] ]]; then
  CHANNEL=$(curl -sS -X POST https://slack.com/api/conversations.open \
    -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"users\":\"$TARGET\"}" | python3 -c '
import sys, json
r = json.load(sys.stdin)
if not r.get("ok"):
    sys.exit("conversations.open failed: %s" % r.get("error"))
print(r["channel"]["id"])')
fi

if [[ "${1:-}" == "--blocks" ]]; then
  BLOCKS_FILE="${2:?usage: send.sh <target> --blocks blocks.json}"
  PAYLOAD=$(python3 - "$CHANNEL" "$BLOCKS_FILE" <<'PY'
import json, sys
channel, path = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
# Accept either a bare blocks array or {"text": ..., "blocks": [...]}
if isinstance(data, list):
    data = {"blocks": data}
data.setdefault("text", "Production Lab digest")
data["channel"] = channel
print(json.dumps(data))
PY
)
else
  TEXT="${1:?message text required}"
  PAYLOAD=$(python3 - "$CHANNEL" "$TEXT" <<'PY'
import json, sys
print(json.dumps({"channel": sys.argv[1], "text": sys.argv[2], "unfurl_links": False}))
PY
)
fi

RESPONSE=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "$RESPONSE" | python3 -c '
import sys, json
r = json.load(sys.stdin)
if r.get("ok"):
    print("sent: channel=%s ts=%s" % (r["channel"], r["ts"]))
else:
    sys.exit("chat.postMessage failed: %s" % r.get("error"))'
