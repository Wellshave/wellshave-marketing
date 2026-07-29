# Wellshave Ad Generator — Atelier Console

Ad-creatie tool voor Wellshave/Wellshine: concepten, varianten, iteraties, persona's
en productdata, aangedreven door Claude Fable 5. Statische bestanden, geen bouwstap.

**Live:** https://wellshave-adgen.netlify.app
**Database:** Supabase-project `bequyhghgkvekvibufhw` (eigen project, los van Bol OS)

## Designsysteem — "Daylight" (v6.0)

De console draaide op een donker goud-thema. Sinds v6.0 is dat een lichte, warme
werkomgeving: gradient-canvas, zwevende antraciet zijbalk, witte kaarten met
haarlijn, amber als accent, en pills voor knoppen en chips.

De omzetting zit in twee lagen (sinds de opsplitsing in `app/css/`):

1. **Kleuren.** Alle vaste kleuren in de bestaande CSS en in de door JavaScript
   gegenereerde inline-stijlen zijn per rol omgezet: `background`/`border` gingen
   van donker naar licht, `color` ging van licht naar inkt, en goud werd amber —
   donker genoeg om op een lichte ondergrond te lezen. Tekst die op een
   accentvlak staat (zwart op geel) is bewust donker gebleven.
2. **`css/08-atelier-v6-daylight.css`**. Daar staan de tokens, de shell (zijbalk,
   topbar, canvas) en de componenten (kaarten, knoppen, velden, pills, tabellen,
   pop-ups, voortgangsbalken). Omdat het laat in de laadvolgorde staat wint het van
   de eerdere skins; er is niets in de oude CSS verwijderd. Daarna komen nog
   `09` t/m `12` (Relief, Cockpit, Studio, Intelligence), die op hun beurt hierover
   heen gaan — het volgnummer bepaalt wie wint.

Wellshave en Wellshine draaien dezelfde console; Wellshine heeft een koelere
champagne-gloed op het canvas, zodat zichtbaar is in welk merk je werkt.

## Structuur

| Pad | Wat |
|---|---|
| `app/index.html` | De tool zelf: markup en de laadvolgorde. Geen build — dit is exact wat live staat. |
| `app/css/` | 12 stijlbestanden, genummerd op laadvolgorde |
| `app/js/` | 28 scriptbestanden, genummerd op laadvolgorde |
| `test/console-boot.cjs` | Opstarttest: start de console in Chromium en kijkt of hij heel is |
| `worker/atelier-proxy.worker.js` | Cloudflare Worker: `/anthropic` (Claude) + `/openai/*` (beeld). **Let op: gedeployed onder de naam `marketing-ads`**, niet `atelier-proxy`. |
| `db/` | Supabase-schema en migraties (creatives, personas, products, rollen, RLS) |
| `scripts/rory-daily-check.routine.js` | Dagelijkse Meta-check → `rory_recommendations` |
| `design/` | Design handoff + eerdere ontwerpversies |
| `docs/` | SOP, iteratie-framework, proxy- en team-server-setup, console-opsplitsing |
| `legacy/` | Oude versies en de vervangen OpenAI-proxy — referentie, niet gebruiken |

## Deploy

- **App:** sleep de **map** `app/` naar het `wellshave-adgen`-project
  (siteId `4e18bda6-a21e-4442-be99-dbf7e8a30ecb`). Let op: dit was voorheen het losse
  bestand `app/index.html`. Sinds de opsplitsing verwijst dat bestand naar `css/` en
  `js/` ernaast, dus het bestand alleen slepen levert een lege pagina op.
- **Worker:** plak `worker/atelier-proxy.worker.js` in de Cloudflare-worker **`marketing-ads`**.
  Secrets: `ANTHROPIC_KEY`, `OPENAI_KEY`.

Voor je deployt:

```
npm run test:console
```

Start de console in een echte browser en controleert of hij zonder fouten opkomt,
of alle 85 onclick-functies bestaan en of alle 40 css- en js-bestanden laden. Zie
`docs/CONSOLE-OPSPLITSING.md`.

## Fable 5-fix: zit erin

`app/index.html` las Claude's antwoord op 18 plekken uit als `data.content[0].text`.
Fable 5 zet een *thinking*-blok vooraan, dus `content[0]` is dan geen tekst →
`Cannot read properties of undefined (reading trim)`.

Opgelost in commit `d378f84`: `wgClaudeText()` / `wgClaudeTextOrNull()` pakken het
eerste échte text-block. In de repo staan nul blinde `content[0].text`-leesacties meer.

**Of live hem heeft, hangt aan de deploy.** Die gaat met de hand; de repo kan
vooruitlopen. Bij twijfel: opnieuw slepen.

## Productfoto's staan hier NIET in

De 80 originele productfoto's (293 MB, tot 18 MB per bestand) zijn bewust buiten git
gehouden — het zijn fotografiebronbestanden, en binaire bestanden van die omvang blijven
permanent in de git-geschiedenis staan.

Ze staan op twee plekken: in Drive onder `1. Files & Systems/Ad generator/Product images (renamed)/`,
en als base64 in Supabase (`products.images`), waar de app ze uit leest.

## De Bol OS-proxy hoort hier niet

In Drive staat onder `Team server/` ook een kopie van `wellgroup-team-proxy.worker.js`.
Die is **bewust niet meegenomen**: het is een verouderde momentopname (5 juli, 9,7 KB)
van een Worker die inmiddels 69 KB is. Plak je die kopie in Cloudflare, dan verdwijnt
alles wat er sindsdien bij is gekomen — de nachtelijke run, brain-export, merk-routing.

De echte bron staat in [`bol-os-dashboard/worker/`](https://github.com/Wellshave/bol-os-dashboard/tree/main/worker).
Deze tool heeft die Worker niet nodig: hij draait op zijn eigen `marketing-ads`-proxy.
