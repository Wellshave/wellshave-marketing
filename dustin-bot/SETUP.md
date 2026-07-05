# Dustin 2.0 — Slack bot setup

Dustin 2.0 posts the Production Lab daily digest and task nudges as its own
bot identity, instead of sending from Dustin's personal account.

## One-time setup (Dustin, ~10 min, browser required)

1. **Create the app** — go to <https://api.slack.com/apps> → *Create New App* →
   *From a manifest* → pick the **Wellshave** workspace → paste the contents of
   [`manifest.yaml`](./manifest.yaml) → *Create*.
2. **Set the avatar** — in *Basic Information → Display Information*, upload an
   icon (a robot-styled photo of Dustin works great).
3. **Install to workspace** — *Install App* → *Install to Wellshave* → allow.
4. **Copy the bot token** — *OAuth & Permissions → Bot User OAuth Token*
   (starts with `xoxb-`). Treat it like a password.
5. **Add the token to the Claude environment** — in the Claude Code environment
   settings for this routine, add an environment variable:
   `SLACK_BOT_TOKEN=xoxb-...`
   (Do NOT commit the token to this repo.)
6. **Invite the bot to #productivity** — in Slack, type
   `/invite @Dustin 2.0` in the channel. DMs need no invite.

## How the routine uses it

- Digest to #productivity:
  `./dustin-bot/send.sh C0A3AG516MP --blocks digest-blocks.json`
- DM nudge to a team member (Slack user ID):
  `./dustin-bot/send.sh U06SNFERCPN "Hey Willem — quick check-in ..."`

Messages use Slack **mrkdwn** (`*bold*`, `<url|label>`, `•` bullets), not
GitHub markdown.

## Voice & escalation policy

Dustin 2.0 may send on its own:
- The daily Production Lab digest
- Neutral task nudges: overdue reminders, "no due date set", stale
  in-progress check-ins, blocked-task follow-ups

Still comes from Dustin personally (never the bot):
- Performance escalations or anything resembling a warning
- Strategy, priorities changes, anything sensitive

Nudge tone: brief, factual, actionable. Always link the Notion task, always
end with a concrete ask (status, due date, or close/reassign).

## Verify it works

```bash
SLACK_BOT_TOKEN=xoxb-... ./dustin-bot/send.sh C0A3AG516MP ":wave: Dustin 2.0 online — I'll be posting the daily Production Lab digest here."
```
