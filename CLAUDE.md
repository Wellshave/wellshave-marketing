# Claude routines — Wellshave

## Projectgeheugen — lees dit eerst (tokenbesparing)

Bij werk aan/vragen over de Atelier Console of deze repo: lees eerst `MEMORY.md`
(index) en `memory/ad-generator-herbouw.md` (volledige status) — niet de hele chat
overlezen. Als er een Graphify-kennisgraaf in `graphify-out/` staat, query die
(`graphify query "<vraag>"`) of lees `graphify-out/GRAPH_REPORT.md`.

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

BESLUIT DUSTIN (11 jul 2026): de ORIGINELE volledige tool ("oude werkwijze",
~7 MB, met Scriptwriter/recipes/wireframe/rollen/logboek/Creative Strategy) is
weer de canonieke app — aangesloten op de eigen worker
`marketing-ads.dustin-9ff.workers.dev` (/anthropic + /v1 OpenAI, team-login
vereist; token-injectie zit in `fetchJsonWithRetry`, patches gemarkeerd met
`[MARKETING-ADS]`). De redesign-versie staat in
`archief/atelier-console-redesign-v2.html` (niet gepubliceerd door Netlify).
- Canoniek (bron van waarheid): `atelier-console/index.html` in deze repo, branch
  `claude/atelier-console-redesign-u07czk`. Commit + push elke wijziging.
- Google Drive-werkmap (door Dustin aangewezen, 11 jul 2026): folderId
  `10wWP0VTtvPvEvWoqmjAgyvuUr3WE_xgO` — hier "werken we in". Inhoud: `index.html`
  (mirror van de live app) + `atelier-proxy.js` (Cloudflare-workercode).
- **VASTE AFSPRAAK (Dustin, 11 jul 2026): na ELKE wijziging aan
  `atelier-console/index.html` automatisch óók het bestand in de Drive-werkmap
  bijwerken** — zodra de Google Drive-connector in de sessie beschikbaar is:
  zoek `index.html` in folder `10wWP0VTtvPvEvWoqmjAgyvuUr3WE_xgO`, VERVANG de
  inhoud van dat bestaande bestand (update op fileId = nieuwe versie; nooit een
  kopie/nieuw bestand ernaast; bestaat het nog niet, maak het dan éénmalig aan
  en leg de fileId hier vast). Is de connector niet gekoppeld: bestand via chat
  naar Dustin sturen (SendUserFile) én melden dat de Drive-sync is overgeslagen.
  Zelfde geldt voor `atelier-proxy.js` bij worker-wijzigingen.
- Live op Netlify: site `wellshave-adgen` → https://wellshave-adgen.netlify.app.
- Volledige deploy-/redeploy-instructies staan in `DEPLOY.md`.
