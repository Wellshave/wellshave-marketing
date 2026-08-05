# Netlify — wat er live staat, en hoe het daar komt

Opgeschreven op 5 augustus 2026, nadat bleek dat de database vooruit was gezet
op een console die er nog niet was.

## Het probleem in één zin

Geen van beide sites is aan de repository gekoppeld. Wat er live staat, is een
map die iemand ooit heeft geüpload — niet een commit. Daardoor is "staat mijn
wijziging live" geen vraag die je kunt beantwoorden zonder de bestanden op te
halen en te vergelijken.

## Stand op 5 augustus 2026

| site | live sinds | bron | commit |
|---|---|---|---|
| `wellshave-werkbank` | 4 aug 13:10 | `api` — "Deploy triggered by upload" | geen |
| `wellshave-adgen` | 1 aug 20:43 | `drop` — handmatige upload | geen |

Site-id van werkbank: `3d1af8b8-635c-4be4-8520-275cbf3c3ca6`.
Site-id van adgen: `4e18bda6-a21e-4442-be99-dbf7e8a30ecb`.

## Momentopname van de configuratie, vóór de koppeling

Uitgelezen via de Netlify-API, niet overgeschreven uit het geheugen:

- **Environment variables:** geen. De lijst is leeg voor beide sites. Alle
  sleutels zitten in de Cloudflare Worker; de console kent er geen enkele.
  Er kan bij een koppeling dus niets aan geheimen verloren gaan.
- **Redirects:** 5 regels, uit `ad-generator/app/_redirects`. De deploy-summary
  van de live site meldt "5 redirect rules processed" — hetzelfde aantal, dus
  wat live staat komt uit dat bestand.
- **Functions:** geen. Ook geen edge functions.
- **Toegang:** geen wachtwoord, geen SSO-verplichting.
- **Build:** geen buildstap; het is een statische map.

De redirects zijn de reden dat dit bestand ertoe doet: ze sturen `/anthropic`,
`/v1/*`, `/openai/*`, `/agents/*` en `/health` als proxy (status 200) door naar
de worker. Raken ze kwijt bij een herconfiguratie, dan werkt geen enkele
AI-aanroep meer en ziet de gebruiker alleen een foutmelding.

## Instellingen voor de Git-koppeling

| veld | waarde |
|---|---|
| Repository | `Wellshave/wellshave-marketing` |
| Branch | `claude/marketing-system-ai-agents-devt2c` |
| Base directory | *leeg* (de repo-wortel) |
| Build command | *leeg* |
| Publish directory | `ad-generator/app` |
| Functions directory | *leeg* |

Base directory moet leeg blijven: `netlify.toml` staat in de wortel en zet
`publish = "ad-generator/app"`. Die regel is er niet voor de netheid maar om te
voorkomen dat de repo-wortel gepubliceerd wordt — met de migraties, de
worker-broncode en de agentbeschrijvingen op een openbaar adres.

De koppeling zelf kan alleen in het Netlify-dashboard: hij vraagt om
autorisatie van de GitHub-app, en dat is een stap die een mens moet zetten.
Via de API of een agent lukt het niet.

## Na het koppelen: drie dingen nalopen

1. `https://wellshave-werkbank.netlify.app/js/35-strategie.js` geeft 200
2. De bundel bevat geen `CS_STATUSES` meer
3. De deploy noemt een commit in plaats van "upload"

Pas als die drie kloppen, mag `0032_statusgrendel_terug.sql` erop.
