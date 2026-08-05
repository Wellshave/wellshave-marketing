# Netlify — wat er live staat, en hoe het daar komt

## De regel

**Beide productie-URL's draaien dezelfde commit.** Ze zijn allebei aan dezelfde
repository en dezelfde branch gekoppeld, dus dat gaat vanzelf: één push rolt
naar allebei uit.

Die regel is er omdat het een keer niet zo was. Op 5 augustus stond de database
al op het nieuwe statusvocabulaire terwijl één van de twee consoles nog een
handmatige upload van vier dagen eerder draaide. Wie op dat adres werkte, kon
niets opslaan — de database weigerde elk woord dat die console kende. Twee
adressen met verschillende versies van dezelfde console is geen ongemak maar
een storing die zich verstopt, want de ene helft van het team ziet hem niet.

## De twee sites

| site | site-id | rol |
|---|---|---|
| `wellshave-werkbank` | `3d1af8b8-635c-4be4-8520-275cbf3c3ca6` | console |
| `wellshave-adgen` | `4e18bda6-a21e-4442-be99-dbf7e8a30ecb` | console, ouder adres |

Ze serveren hetzelfde. `wellshave-adgen` is het adres van vóór de naamswijziging
en staat waarschijnlijk nog in bladwijzers; daarom blijft het bestaan en draait
het mee in plaats van dat het is uitgezet.

## Instellingen — voor beide sites gelijk

| veld | waarde |
|---|---|
| Repository | `Wellshave/wellshave-marketing` |
| Branch | `claude/marketing-system-ai-agents-devt2c` |
| Base directory | *leeg* (de repo-wortel) |
| Build command | *leeg* — het is een statische map |
| Publish directory | `ad-generator/app` |
| Functions directory | *leeg* |
| Environment variables | *geen* |

Base directory moet leeg blijven: `netlify.toml` staat in de wortel en zet
`publish = "ad-generator/app"`. Die regel is er niet voor de netheid maar om te
voorkomen dat de repo-wortel gepubliceerd wordt — met de migraties, de
worker-broncode en de agentbeschrijvingen op een openbaar adres.

Er zijn geen environment variables, op geen van beide sites. Alle sleutels
zitten in de Cloudflare Worker; de console kent er geen enkele. Bij een
herconfiguratie kan er dus niets aan geheimen verloren gaan.

## Redirects

Vijf regels, uit `ad-generator/app/_redirects`, naast de app zelf zodat ze
meegaan met elke publicatie van die map:

    /anthropic   → marketing-ads.dustin-9ff.workers.dev/anthropic     200
    /v1/*        → .../v1/:splat                                      200
    /openai/*    → .../openai/:splat                                  200
    /agents/*    → .../agents/:splat                                  200
    /health      → .../health                                         200

Status 200 en geen 301: het is een proxy, geen omleiding die de browser ziet.
Zo is er geen CORS in het spel — de browser praat met de site, Netlify praat
met de worker, en de Authorization-header gaat mee. Raken deze regels kwijt,
dan werkt geen enkele AI-aanroep meer.

Te controleren zonder in te loggen: `/health` hoort 200 te geven en
`/anthropic` een 401. Die 401 is goed nieuws — hij betekent dat de worker
bereikt is en netjes om een token vraagt.

## Nalopen of ze werkelijk gelijk lopen

De deploy-informatie zegt welke commit Netlify dácht uit te rollen. Wat er
werkelijk staat, is een andere vraag. Beide bundels ophalen en vergelijken:

    for s in werkbank adgen; do
      curl -s https://wellshave-$s.netlify.app/js/35-strategie.js | sha256sum
    done

Twee gelijke controlesommen, en de sites lopen gelijk. Verschillen ze, dan is
er één opnieuw uitgerold en de ander niet.

## Stand op 5 augustus 2026

Beide sites op commit `2e1d388`, branch `claude/marketing-system-ai-agents-devt2c`,
allebei via de Git-koppeling en niet via een upload. De hele bundel — 54
bestanden — is byte voor byte gelijk.
