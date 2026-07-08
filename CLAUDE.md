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

## Atelier Console (ad generator) — één canoniek HTML-bestand

De ad-generator "Atelier Console" is één single-file HTML-app. Bewerk bij elke
wijziging ALTIJD hetzelfde bestand in-place — nooit nieuwe of versienummer-kopieën
maken.
- Canoniek (bron van waarheid): `atelier-console/index.html` in deze repo, branch
  `claude/atelier-console-redesign-u07czk`. Commit + push elke wijziging.
- Google Drive-mirror: `atelier-console-v0.1.html` in map
  `4. CLAUDE / Ad generator / Nieuw design` (fileId
  `1J0ytUcbjBfuvR96o-2Vj1mQhrZuAIdkc`). Na elke grote wijziging bijwerken zodat
  repo en Drive gelijklopen (zelfde bestand, geen nieuwe versie).
- Live op Netlify: site `wellshave-adgen` → https://wellshave-adgen.netlify.app.
- Volledige deploy-/redeploy-instructies staan in `DEPLOY.md`.
