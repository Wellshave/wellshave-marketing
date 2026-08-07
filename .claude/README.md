# Waarom `settings.json` zo smal is

De ochtendcyclus draait om 07:00 als Routine, zonder dat er iemand bij zit.
Zolang elke tool om goedkeuring vraagt, is dat geen automatisering maar een
wekker: de run staat stil tot iemand op "Allow once" klikt, en tot dat moment is
er niets gemeten.

`permissions.allow` lost dat op. De vraag is alleen: waarvoor.

## De regel

**Lezen mag vanzelf. Uitgeven, versturen en publiceren nooit.**

Dat is dezelfde regel die in de agent-runtime zit (`marketing-hq/agents/GUARDRAILS.md`,
punt 2): er bestaat geen tool die geld uitgeeft of iets verstuurt zonder dat een
mens tekent. Die regel is daar afgedwongen in code. Hier hoort hij ook te
gelden, want een Routine die 's ochtends alleen draait heeft geen mens om aan te
tikken — en "hij vroeg het toch niet" is geen verdediging als er een campagne
live gaat.

## Wat er in `allow` staat

Alleen tools die iets ophalen: Meta-insights en entiteiten, Klaviyo-rapportage,
Trendtrack-scans, Supabase-metadata, en de git-commando's die de cyclus nodig
heeft om zijn rapport weg te schrijven.

## Wat er in `deny` staat

De tools die geld uitgeven of naar buiten werken, met naam en toenaam:
campagnes aanmaken of activeren, budgetten en entiteiten wijzigen, een
Klaviyo-campagne versturen, profielen importeren of uitschrijven, migraties
toepassen, edge functions deployen.

`deny` wint altijd van `allow`. Ze staan er expliciet in — niet omdat ze nu per
ongeluk toegestaan zouden zijn, maar omdat iemand over een half jaar de
allowlist verruimt en dan tegen een muur hoort te lopen in plaats van tegen een
weekend met een leeggelopen budget.

## Wat er bewust in geen van beide lijsten staat

`mcp__Supabase__execute_sql` en `mcp__Supabase__execute_sql`-achtige tools die
zowel kunnen lezen als schrijven. Die blijven vragen. Eén SQL-statement kan een
tabel legen, en dat is niets voor een run om 07:00 waar niemand naar kijkt.
Heeft de cyclus dat echt nodig, dan hoort daar een aparte, smallere ingang voor
te komen — geen vinkje hier.

## Als de run alsnog blijft staan

Dan vraagt hij om een tool die hier niet in staat. Kijk in de Runs-weergave
welke het is en beslis per geval: lezen erbij op de allowlist, schrijven niet.

Let op de servernaam in de regel. Die moet exact matchen met hoe de connector
heet (`mcp__Meta_Ads__...`, met liggende streepjes), niet met de weergavenaam in
het dialoogvenster ("Meta-Ads"). Een regel met de verkeerde naam geeft geen
foutmelding — hij doet alleen niets, en dan blijft de run vragen zonder dat je
ziet waarom.
