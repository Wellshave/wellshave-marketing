# Atelier Console — deploy

De **Atelier Console** (Wellgroup ad-generator, single-file HTML-app) staat live op
Netlify. Dit document beschrijft wat er gedeployed is en hoe je het opnieuw doet.

## Live
- **URL:** https://wellshave-adgen.netlify.app
- **Netlify-site:** `wellshave-adgen` (site-id `4e18bda6-a21e-4442-be99-dbf7e8a30ecb`)
- **Publish-dir:** `atelier-console/` (zie `netlify.toml`) — puur statisch, geen build.
  Alleen deze map is publiek; de rest van de repo wordt niet gepubliceerd.

## Bron van waarheid
De canonieke app leeft in **Google Drive**, niet in deze repo:
- Bestand: `atelier-console-v0.1.html`
- Drive fileId: `1J0ytUcbjBfuvR96o-2Vj1mQhrZuAIdkc`

`atelier-console/index.html` in deze repo is een **snapshot** van die Drive-versie op
het moment van deployen (byte-identiek). Bewerk in Drive; ververs de snapshot vóór een
redeploy. Snapshot sha256 (233.035 bytes):
`ee8a5dbc7db8e3e5dbef757bdba419278b773c62ca329453a56965aea1b45c8d`

## Opnieuw deployen
1. Download de nieuwste versie uit Drive → overschrijf `atelier-console/index.html`.
   (Via de Google Drive MCP `download_file_content`; decode de base64 op schijf met
   `jq -r '.content' <result> | base64 -d > atelier-console/index.html`.)
2. Statische check: haakjesbalans + dat alle `onclick`-handlers resolven.
3. Deploy via de Netlify MCP (`deploy-site`, siteId hierboven) — die geeft een
   `npx @netlify/mcp … --site-id … --proxy-path …`-commando terug; draai dat in de
   repo-root. Netlify respecteert `netlify.toml` en publiceert alleen `atelier-console/`.
4. Verifieer: `curl` de URL → HTTP 200, ~233 KB, titel "Atelier Console"; en check dat
   `/CLAUDE.md`, `/netlify.toml` e.d. **404** geven (niets gelekt).

## Supabase — auth (handmatige eenmalige stap)
De app logt in via Supabase Google-OAuth met
`redirectTo: location.origin + location.pathname`. Op de live site is dat
`https://wellshave-adgen.netlify.app/`. Zet daarom in
**Supabase Dashboard → Authentication → URL Configuration** (project `bequyhghgkvekvibufhw`):
- **Site URL:** `https://wellshave-adgen.netlify.app`
- **Redirect URLs (allow-list):** voeg toe `https://wellshave-adgen.netlify.app/**`

De Google-provider-callback (`https://bequyhghgkvekvibufhw.supabase.co/auth/v1/callback`)
staat al goed in Google Cloud en verandert niet door de Netlify-URL.

Supabase-project `bequyhghgkvekvibufhw`; de publishable key in de app is publiek-veilig.
