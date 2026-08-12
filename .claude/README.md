# Waarom hier een haak staat en geen vinkje

Elke controlevraag aan de database kostte een klik op "Allow". Dat zijn er
tientallen per sessie, en het maakt het werk geen automatisering maar een
wekker: het staat stil tot iemand klikt.

De makkelijke oplossing is `mcp__Supabase__execute_sql` op de allowlist zetten.
Dan is de wrijving weg — en ook de rem. Datzelfde gereedschap kan een tabel
legen, en dat gebeurt dan zonder dat iemand het ziet.

## De regel

**Lezen mag vanzelf. Schrijven vraagt altijd.**

Dat is dezelfde regel die in de agent-runtime zit
(`marketing-hq/agents/GUARDRAILS.md`, punt 2): er bestaat geen weg naar buiten
zonder dat een mens tekent. Hier geldt hij voor de database.

## Hoe dat werkt

`.claude/hooks/alleen-lezen-sql.sh` kijkt vóór elke `execute_sql` naar de query
en geeft `allow` of `ask` terug. Doorlaten mag alleen als allebei waar is:

1. de query begint met `SELECT` of `WITH`
2. er staat nergens een woord in dat iets kan veranderen

De tweede eis is niet overbodig naast de eerste. Deze twee beginnen met select
en veranderen allebei je data:

    select 1; delete from creatives
    with x as (delete from creatives returning *) select * from x

Een filter dat alleen naar het eerste woord kijkt, laat die door. Daarom staat
er ook een woordenlijst, en wordt commentaar eerst weggehaald — anders verstopt
`select 1 /* niets aan de hand */ ; truncate creatives` zich erachter.

Woordgrenzen doen ertoe: `updated_at` bevat 'update' en `created_at` bevat
'create'. Zonder die grenzen zou vrijwel elke query van dit project geweigerd
worden en was de haak binnen een dag uitgezet.

## Bij twijfel vragen

Altijd. Een woord als 'delete' in een tekstwaarde levert een onnodig venster op.
Vervelend, maar de andere kant op is een stille wijziging in de productie-
database. De haak faalt dus richting de vraag, nooit richting doorgang.

## Testen

    bash .claude/hooks/test-alleen-lezen.sh

25 controles, waarvan de helft opdrachten die er van voren uitzien als een
leesvraag. Vier mutaties zijn nagemeten — woordenlijst weg, begincontrole weg,
commentaar niet strippen, woordgrens weg — en alle vier laten de lus falen.

Dat laatste is niet vanzelfsprekend gegaan: de eerste versie van de
commentaar-controle gebruikte "deleten" en "droppen" in de testzin, en die
matchen de woordgrens niet. De test stond groen en bewees niets. Wie hier een
controle bijzet: gebruik het kale woord.

## Wat er verder in `settings.json` staat

`allow` bevat alleen wat ophaalt: Meta-insights en entiteiten,
Supabase-metadata, de git-commando's die het werk nodig heeft, en de testlussen
van dit project.

`deny` bevat wat geld uitgeeft of naar buiten werkt, met naam en toenaam:
campagnes aanmaken of activeren, budgetten wijzigen, een Klaviyo-campagne
versturen, profielen importeren. Ze staan er niet omdat ze nu per ongeluk
toegestaan zouden zijn, maar omdat iemand over een half jaar de allowlist
verruimt en dan tegen een muur hoort te lopen in plaats van tegen een weekend
met een leeggelopen budget.

`deny` wint altijd van `allow`, en van de haak.

## Als er alsnog een venster komt

Dan vraagt hij om iets wat hier niet in staat, of om SQL die iets verandert.
Dat tweede is de bedoeling. Het eerste kun je erbij zetten — lezen op de
allowlist, schrijven niet.

Let op de servernaam in een regel. Die moet exact matchen met hoe de connector
heet (`mcp__Meta_Ads__...`, met liggende streepjes), niet met de weergavenaam in
het dialoogvenster ("Meta-Ads"). Een regel met de verkeerde naam geeft geen
foutmelding — hij doet alleen niets, en dan blijft het vragen zonder dat je
ziet waarom.
