# Wellshave Marketing

Alles wat met marketing te maken heeft onder één dak: de ad-creatietool, het
agent-team met zijn brein en dashboard, en de bijbehorende skills.

## Structuur

| Map | Wat |
|---|---|
| [`ad-generator/`](ad-generator/README.md) | **Atelier Console** — ad-creatie met Claude Fable 5. Live op wellshave-adgen.netlify.app, eigen Supabase (`bequyhghgkvekvibufhw`), eigen Worker (`marketing-ads`). |
| [`marketing-hq/`](marketing-hq/README.md) | **Marketing HQ** — 9 AI-agents, Obsidian-brein, Pulse-dashboard. Live op wellshave-pulse.netlify.app, eigen Supabase (`srjpulfodxakbyulwhki`). |
| `.claude/skills/` | Design- en UI-skills die de agents gebruiken. Moet op de root staan om te werken. |

Beide systemen houden hun eigen Supabase-project en eigen deploy — samenvoegen ging
over de **code**, niet over de infrastructuur. Er is dus niets aan live omgevingen veranderd.

## Branches — nog niet verwerkt werk

Deze branches bevatten werk dat nergens anders bestaat. Ze zijn bewust níet gemerged,
omdat dat bestaand werk zou overschrijven.

| Branch | Wat erin zit |
|---|---|
| `atelier-console-redesign` | **30 commits met een openstaande Fable 5-bugfix** — zie hieronder |
| `from-routines/wellshave-website-design` | Homepage-redesign "De Standaard", v2 licht-editorial, incl. fotografie |
| `from-routines/ad-generator-step-1` | Eerste opzet Fable 5-proxy volgens het Atelier Console-contract |
| `from-routines/weekly-meta-audit` | `meta-account-audit`-skill + Slack-routing via de bot-DM |
| `from-routines/skill-download` | `frontend-design`- en UI/UX Pro Max-skillbundel |
| `from-routines/ui-ux-pro-max-setup` | `ui-ux-pro-max`-skill voor Claude Code |

De `from-routines/`-branches komen uit `claude-routines`, waar ze per ongeluk waren
beland doordat die repo aan de standaard cloud-omgeving hing.

## ✅ Fable 5-bugfix doorgevoerd (28 juli)

`ad-generator/app/index.html` las Claude's antwoord op **18 plekken** uit als
`data.content[0].text`. Fable 5 zet soms een *thinking*-blok vooraan → crash
(`Cannot read properties of undefined (reading 'trim')`) of stilzwijgend lege tekst.

Alle 18 plekken gebruiken nu `wgClaudeText()` / `wgClaudeTextOrNull()`, die naar het
eerste échte text-block scannen. Foutmeldingen van de teamserver komen nu leesbaar door.

Geverifieerd in de browser met een thinking-block-payload: vóór de fix crash, erna de
juiste tekst. Normale antwoorden werken ongewijzigd.

**Deploy:** `ad-generator/app/index.html` naar de Netlify-deploymap kopiëren als
`index.html` en die map naar het `wellshave-adgen`-project slepen.

De branch `atelier-console-redesign` blijft staan: daar zit nog ánder werk uit die
periode dat níet in main zit. Nog steeds niet mergen — de takken zijn uiteengegroeid.
