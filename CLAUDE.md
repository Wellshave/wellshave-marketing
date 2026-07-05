# Claude routines — Wellshave

## Slack: altijd posten als de bot (Wellshave Operator / Dustin 2.0)

Elke routine die iets naar Slack stuurt (digests, aankondigingen, task-nudges,
DM check-ins) MOET posten via de bot-identiteit, NIET via Dustin's persoonlijke
account (Slack MCP `slack_send_message` verstuurt als Dustin — niet gebruiken
voor uitgaande routineberichten).

Zo post je als bot:

```bash
# Kanaalbericht (mrkdwn):
./dustin-bot/send.sh <CHANNEL_ID> "*bericht*"

# Digest met Block Kit (schrijf blocks-JSON naar een bestand in de scratchpad):
./dustin-bot/send.sh C0A3AG516MP --blocks /pad/naar/blocks.json

# DM naar teamlid (Slack user ID, bot opent zelf de IM):
./dustin-bot/send.sh <SLACK_USER_ID> "bericht"
```

- Vereist `SLACK_BOT_TOKEN` in de environment (staat in de Claude
  environment-settings). Ontbreekt de variabele: niet terugvallen op de Slack
  MCP, maar de run afbreken en Dustin notificeren.
- De bot zit in alle publieke kanalen. Nieuw publiek kanaal of `not_in_channel`
  fout? Draai `./dustin-bot/join-all-channels.sh`. Privé-kanalen vereisen een
  handmatige `/invite @dustin_20`.
- Slack mrkdwn: `*vet*`, `<url|label>`, `•` bullets, geen `**` of `#` headers.
- Berichten van de bot zijn zakelijk en actiegericht. Gevoelige onderwerpen
  (performance-escalaties, strategie) verstuurt de bot nooit — die blijven bij
  Dustin persoonlijk; leg zo'n concept dan alleen in de sessie-output vast.

Lezen uit Slack (kanalen/threads lezen, users zoeken) mag gewoon via de Slack
MCP tools — alleen uitgaande berichten lopen via de bot.

Kanaal-IDs: #productivity = C0A3AG516MP. Slack user IDs: Willem = U06SNFERCPN,
Jhelarie = U0AEAUF1QLS, Dustin = U03JNJZA3ED.
