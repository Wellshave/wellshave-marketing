# Atelier Console → team-proxy: plak-klare versie (gebaseerd op Dustins upload)

`wellgroup-team-proxy.js` in deze map is **Dustins eigen live worker-code**
(upload `wellgroupteamproxy.worker.js`, 11 jul 2026) waarop machinaal exact
twee toevoegingen zijn gezet — geverifieerd met een diff: al het overige is
byte-voor-byte identiek. Deze versie is dus veilig om integraal over de live
worker te plakken. bol OS, notify-relay, nightly en OpenAI zijn onaangeraakt.

## De twee toevoegingen (gemarkeerd met `[ATELIER]`)

1. **Regel `ALLOWED_ORIGINS`** — `https://wellshave-adgen.netlify.app` (en de
   lokale dev-poort 8823) toegevoegd aan de bestaande array. Zonder dit
   blokkeert de browser (CORS) alle antwoorden richting de Atelier Console.
2. **`verifyTeam`** — accepteert na de bestaande bol-OS-check óók logins van
   het Atelier-Supabase-project (`bequyhghgkvekvibufhw`). Omdat dáár
   zelf-registratie aan staat, is deze route bewust STRENGER dan de
   bol-OS-check: alleen accounts met `team_members.status = 'approved'`
   (door een admin goedgekeurd) krijgen toegang. Sluit aan op het huidige
   live beleid (bol-OS: bestaand account volstaat, want alleen de beheerder
   maakt daar accounts aan).

## Live zetten (2 min)

1. Cloudflare → Workers & Pages → `wellgroup-team-proxy` → Edit code →
   volledige inhoud vervangen door `wellgroup-team-proxy.js` → Deploy.
   (Vangnet: tab **Deployments** → vorige versie → Rollback, één klik.)
2. Smoke-test:
   - `https://wellgroup-team-proxy.dustin-9ff.workers.dev/health` → `{"ok":true,…}`
   - bol OS openen → werkt zoals altijd.
   - Atelier Console (nieuwste index.html, **ingelogd** met een goedgekeurd
     teamaccount): ⚙ Instellingen → key-veld leeg, proxy-URL ingevuld →
     **Test AI-verbinding** → "✓ Verbonden via team-proxy".

## Secrets

Geen nieuwe secrets nodig — `ANTHROPIC_KEY` staat al op de worker (de
nightly/brain gebruikt hem).

## Als de live code ooit nieuwer is dan deze mirror

Niet plakken maar hand-editen: voeg de origin-entries toe aan
`ALLOWED_ORIGINS` en zet het `[ATELIER]`-blok uit `verifyTeam` (zie de
gemarkeerde regels in `wellgroup-team-proxy.js`) vlak vóór
`_teamCache.set(t, …)`. Nul regels verwijderen.
