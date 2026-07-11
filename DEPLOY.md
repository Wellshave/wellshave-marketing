# Atelier Console — deploy

De **Atelier Console** (Wellgroup ad-generator, single-file HTML-app) draait op
Netlify. Dit document beschrijft wat er live staat en hoe je het opnieuw deployt.

## Live
- **URL:** https://wellshave-adgen.netlify.app
- **Netlify-site:** `wellshave-adgen` (site-id `4e18bda6-a21e-4442-be99-dbf7e8a30ecb`)
- **Publish-dir:** `atelier-console/` (zie `netlify.toml`) — puur statisch, geen build.
  Alleen deze map is publiek; de rest van de repo wordt niet gepubliceerd.

## Bron van waarheid
De canonieke app is nu **deze git-repo** (`atelier-console/index.html` op branch
`claude/atelier-console-redesign-u07czk`) — daar gebeuren de wijzigingen en
verificatie. De Google Drive-versie (`atelier-console-v0.1.html`, fileId
`1J0ytUcbjBfuvR96o-2Vj1mQhrZuAIdkc`) is nu een **mirror die achterloopt** en moet
uit de repo worden bijgewerkt.

Actuele snapshot sha256 (252.055 bytes):
`44f95c1f37e5413886e52f468c8356270cb67c8cab81eea96812bc459c12ba6d`

## Opnieuw deployen
1. Zorg dat `atelier-console/index.html` de laatste versie is (git).
2. Statische check: `node --check` op het `<script>`-blok + haakjes/onclick-handlers.
3. Deploy via de Netlify MCP (`deploy-site`, siteId hierboven) — die geeft een
   `npx @netlify/mcp … --site-id … --proxy-path …`-commando terug; draai dat in de
   repo-root. Netlify respecteert `netlify.toml` en publiceert alleen `atelier-console/`.
4. Verifieer: `curl` de URL → HTTP 200, ~252 KB, titel "Atelier Console"; en check dat
   `/CLAUDE.md`, `/netlify.toml` e.d. **404** geven (niets gelekt).

## Wijzigingen t.o.v. de eerste deploy (team-feedback, 8 punten)
- **Modal-sluitknop (X)** gefixt: de lange kop-overlay lag over de knop (z-index +
  pointer-events op de tekst-overlay).
- **Layouts** opgeschoond: lange creative-koppen worden geclampt (`.clamp2/3`) in
  kaarten en modals; kaarthoogte gefixt.
- **Alle sample-data weg**: dashboard-hero (geen NACHT meer) + team-podium zijn
  data-gedreven met lege staten; Rory's check toont een lege staat; sample-arrays
  starten leeg. Ads zonder ROAS tonen "Geen data" i.p.v. "Loser".
- **Merk-switch Wellshave/Wellshine** (sidebar): filtert producten, persona's,
  bibliotheek en dashboard per merk (afgeleid van niche; blijft bewaard).
- **Merk-DNA-editor** (sidebar → Merk-DNA) per merk: positionering, tone of voice,
  doelgroep, USP's, do's/don'ts, tagline, garantie, social proof. Voedt `brandText()`
  dat in elke Fable 5-flow als systeemprompt meegaat.

## Fable 5 koppelen (AI-motor) — twee routes
De app haalt NOOIT automatisch een key op; er zijn twee expliciete routes
(⚙ Instellingen, "Test AI-verbinding" vertelt exact wat er misgaat):

1. **Anthropic API-key direct (simpelst, per apparaat):** key aanmaken op
   console.anthropic.com → API keys (begint met `sk-ant-`, ±100 tekens; vereist
   account met tegoed) → plakken in het key-veld → Test → Opslaan. De key staat
   alleen in localStorage van die browser.
2. **Team-proxy (Cloudflare Worker, key server-side — aanrader voor het team):**
   deploy `cloudflare-worker/wellgroup-team-proxy.js` (instructies staan bovenin
   dat bestand): Worker aanmaken → code plakken → secret `ANTHROPIC_KEY` zetten
   (zelfde sk-ant-key) → in de app alléén de worker-URL invullen, key-veld leeg.
   De app plakt zelf `/anthropic` achter de URL en vult `https://` aan.
   Bestaande worker van Dustin: `wellgroup-team-proxy.dustin-9ff.workers.dev`.

Als beide zijn ingevuld wint de API-key. Foutdiagnoses in de app: HTML-antwoord
= URL wijst niet naar een API; 404 = endpoint bestaat daar niet; `invalid
x-api-key` = de geplakte key is geen geldige Anthropic-key.

## Supabase — auth (handmatige eenmalige stap)
De app logt in via Supabase Google-OAuth met `redirectTo: location.origin +
location.pathname` → op de live site `https://wellshave-adgen.netlify.app/`. Zet in
**Supabase Dashboard → Authentication → URL Configuration** (project `bequyhghgkvekvibufhw`):
- **Site URL:** `https://wellshave-adgen.netlify.app`
- **Redirect URLs (allow-list):** `https://wellshave-adgen.netlify.app/**`

## Supabase — merk-DNA (nog te valideren)
De Merk-DNA-editor schrijft naar tabel `brand_profile`, kolom `data` (JSONB), per
merk: `data = { wellshave:{…}, wellshine:{…} }`. Schrijven vereist een ingelogde
approved member (RLS). De schrijf-actie (PATCH op `id`, anders POST) is defensief
gebouwd op het `id`+`data`-schema maar nog niet end-to-end geverifieerd met een
ingelogd account — controleer bij de eerste opslag of de rij correct wordt bijgewerkt.
Zolang niet ingelogd/opgeslagen valt de app terug op `BRAND_DEFAULTS` + localStorage.
