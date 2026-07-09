# MEMORY — Wellshave / claude-routines

Persistente context zodat sessies dit lezen/query'en i.p.v. lange chats over te
lezen (tokenbesparing).

## Lees dit eerst
- **Atelier Console (ad generator):** volledige status in
  [`memory/ad-generator-herbouw.md`](memory/ad-generator-herbouw.md).
- **Werkafspraken + Slack-bot + canoniek HTML-bestand:** `CLAUDE.md`.
- **Deploy (Netlify/Supabase/Drive):** `DEPLOY.md`.

## Kennisgraaf (Graphify)
Er staat een Graphify-kennisgraaf van deze repo in `graphify-out/`
(`graph.json`, `GRAPH_REPORT.md`, `graph.html`). Bij een vraag over de codebase/
architectuur: query de graaf eerst met `graphify query "<vraag>"` (of lees
`GRAPH_REPORT.md`) i.p.v. de hele chat/repo te herlezen. Herbouwen na grote
wijzigingen: `graphify . --update`.

## Snelle feiten
- Atelier Console = single-file `atelier-console/index.html`, branch
  `claude/atelier-console-redesign-u07czk`. Altijd ditzelfde bestand bewerken.
- Live: https://wellshave-adgen.netlify.app (Netlify `wellshave-adgen`).
- Supabase project `bequyhghgkvekvibufhw`. Fable 5 via team-proxy (nu niet gekoppeld → mock).
