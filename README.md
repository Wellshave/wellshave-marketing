# Wellshave Ad Generator — Atelier Console

Single-file ad-creatie tool voor Wellshave/Wellshine: concepten, varianten, iteraties,
persona's en productdata, aangedreven door Claude Fable 5.

**Live:** https://wellshave-adgen.netlify.app
**Database:** Supabase-project `bequyhghgkvekvibufhw` (eigen project, los van Bol OS)

## Structuur

| Pad | Wat |
|---|---|
| `app/index.html` | De tool zelf — single-file, geen build. Dit is exact wat live staat. |
| `worker/atelier-proxy.worker.js` | Cloudflare Worker: `/anthropic` (Claude) + `/openai/*` (beeld). **Let op: gedeployed onder de naam `marketing-ads`**, niet `atelier-proxy`. |
| `db/` | Supabase-schema en migraties (creatives, personas, products, rollen, RLS) |
| `scripts/rory-daily-check.routine.js` | Dagelijkse Meta-check → `rory_recommendations` |
| `design/` | Design handoff + eerdere ontwerpversies |
| `docs/` | SOP, iteratie-framework, proxy- en team-server-setup |
| `legacy/` | Oude versies en de vervangen OpenAI-proxy — referentie, niet gebruiken |

## Deploy

- **App:** kopieer `app/index.html` naar de Netlify-deploymap en sleep die naar het
  `wellshave-adgen`-project (siteId `4e18bda6-a21e-4442-be99-dbf7e8a30ecb`).
- **Worker:** plak `worker/atelier-proxy.worker.js` in de Cloudflare-worker **`marketing-ads`**.
  Secrets: `ANTHROPIC_KEY`, `OPENAI_KEY`.

## ⚠️ Openstaande bugfix op branch `atelier-console-redesign`

Die branch (30 commits, 21-22 juli, oorspronkelijk kwijtgeraakt in `claude-routines`)
bevat een fix die **nog niet in de live versie zit**.

**Het probleem:** `app/index.html` leest Claude's antwoord op **18 plekken** uit als
`data.content[0].text.trim()`. Fable 5 zet een *thinking*-blok vooraan, dus `content[0]`
is dan geen tekst → `Cannot read properties of undefined (reading trim)`.

**De fix op de branch:** `wgClaudeText()` / `wgClaudeTextOrNull()` scannen naar het eerste
échte text-block. Daar staan 0 blinde `content[0].text`-leesacties meer.

**Waarom niet gewoon mergen:** het zijn uit elkaar gegroeide takken, geen oud-vs-nieuw.

| | branch (22 jul) | main / live (23 jul) |
|---|---|---|
| omvang | 6,98 MB | 7,07 MB |
| Fable 5-fix | ✅ | ❌ |
| nieuwer werk | ❌ | ✅ (~90 KB) |

Mergen overschrijft dus werk, welke kant je ook op gaat. De juiste aanpak is de fix
**gericht overzetten**: de 18 plekken in `app/index.html` vervangen door de veilige
uitleesfunctie van de branch.

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
