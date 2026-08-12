# 🔐 Permissie-inventarisatie — op te leveren bij de run van 13 augustus

> **Opdracht van Dustin (12 aug):** noteer bij de eerstvolgende ochtendcyclus
> welke tools om toestemming vragen, zodat die lijst gebruikt kan worden om
> de Routine-instellingen op claude.ai in te vullen.

## Waarom dit nodig is

De `.claude/settings.json` in deze repo wordt door de Routine **niet
gelezen**. Vastgesteld op 12 augustus: `mcp__Klaviyo__get_list` en
`mcp__Trendtrack__get_brandtracker_scaling_ads` staan correct gespeld in de
allowlist (ook in de versie die sinds 7 augustus op `main` stond) en vroegen
tóch om toestemming.

De permissies komen uit `~/.claude/launcher-settings.json` van de
cloudomgeving, die alleen `Skill` toestaat. De knop zit dus in de
Routine-configuratie op claude.ai, niet in git.

## Wat ik wel en niet kan waarnemen

| | |
|---|---|
| ✅ **Wel:** elke tool-identifier die de cyclus aanroept, exact en in volgorde | |
| ❌ **Niet:** of er een prompt is verschenen | Een toegestane en een na-goedkeuring-toegestane aanroep zijn van binnenuit niet te onderscheiden |

Daarom is de oplevering een **volledige inventaris van aangeroepen tools**.
Als het patroon is dat álle MCP-tools vragen — wat het bewijs tot nu toe
suggereert — dan is die inventaris meteen de complete lijst die in de
routine-instellingen moet.

## Op te leveren op 13 augustus

Onderstaande tabel invullen tijdens de run, en het resultaat hier laten
staan zodat het naast de claude.ai-instellingen gelegd kan worden.

| # | Tool-identifier | Server | Waarvoor in de cyclus | Prompt gezien door Dustin? |
|---|---|---|---|---|
| | *(in te vullen)* | | | *(door Dustin aan te vullen)* |

## Verwachting op basis van de laatste cycli

Deze tools gebruikt de ochtendcyclus standaard. Als ze allemaal vragen, is
dit de lijst die geconfigureerd moet worden:

| Tool-identifier | Waarvoor |
|---|---|
| `mcp__Meta-Ads__ads_get_ad_entities` | spend/ROAS per campagne — **de kernaanroep**, meestal 2× per run (één per account) |
| `mcp__Klaviyo__get_list` | omvang Newsletter-lijst |
| `mcp__Klaviyo__get_campaigns` | verzendstatus en drafts |
| `mcp__Trendtrack__get_brandtracker_scaling_ads` | concurrent-ads + freshness-check |
| `mcp__Trendtrack__check_credits` | creditbewaking |
| `mcp__Trendtrack__daily_radar` | marktscan (bij een volledige ronde) |

Bij een bredere Radar-ronde komen daar `analyze_tracked_brand`, `scan_ad` en
`lookup` bij. De volledige lees-set staat in `.claude/settings.json` op
`main` — bruikbaar als kopieerbron, ook al wordt dat bestand zelf niet
gelezen.

## Wat níet in de routine-instellingen hoort

De schrijf-tools. Budgetten wijzigen, campagnes starten of pauzeren,
e-mails versturen, entiteiten aanmaken. Die horen te blijven vragen —
`agents/GUARDRAILS.md` punt 2. De `deny`-lijst op `main` (66 regels, sinds
PR #10 met de juiste servernaam) noemt ze met naam en toenaam.
