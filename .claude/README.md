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

---

# De haak: lezen mag vanzelf, schrijven vraagt altijd

Hierboven staat waarom `mcp__Supabase__execute_sql` in geen van beide lijsten
staat: één SQL-statement kan een tabel legen. Dat klopt nog steeds — maar het
gevolg was dat élke controlevraag aan de database een klik kostte. Tientallen
per sessie. Dat is geen automatisering meer maar een wekker.

`.claude/hooks/alleen-lezen-sql.sh` splitst het. Vóór elke `execute_sql` kijkt
hij naar de query en geeft `allow` of `ask` terug. Doorlaten mag alleen als
allebei waar is:

1. de query begint met `SELECT` of `WITH`
2. er staat nergens een woord in dat iets kan veranderen

De tweede eis is niet overbodig naast de eerste. Deze twee beginnen met select
en veranderen allebei je data:

    select 1; delete from creatives
    with x as (delete from creatives returning *) select * from x

Commentaar gaat er eerst uit, anders verstopt
`select 1 /* niets aan de hand */ ; truncate creatives` zich erachter.

Woordgrenzen doen ertoe: `updated_at` bevat 'update' en `created_at` bevat
'create'. Zonder die grenzen zou vrijwel elke query van dit project geweigerd
worden en was de haak binnen een dag uitgezet.

Bij twijfel wint de vraag, nooit de doorgang. Een 'delete' als tekstwaarde
levert een overbodig venster op; dat is de goede kant om fout te gaan.

    bash .claude/hooks/test-alleen-lezen.sh

25 controles, waarvan de helft opdrachten die er van voren uitzien als een
leesvraag. Vier mutaties nagemeten — woordenlijst weg, begincontrole weg,
commentaar niet strippen, woordgrens weg — en alle vier laten de lus falen.

Dat laatste kostte twee pogingen. De eerste versie van die controle gebruikte
"deleten" en "droppen" in de testzin: Nederlandse vervoegingen die de
woordgrens niet raken. De test stond groen en bewees niets. Wie hier een
controle bijzet: gebruik het kale woord.

## Meta stond er met het verkeerde streepje

De waarschuwing hierboven over servernamen was profetisch. Alle Meta-regels
stonden als `mcp__Meta-Ads__` (liggend streepje), terwijl de connector
`mcp__Meta_Ads__` heet (lage streep). Die regels deden dus niets — geen
foutmelding, alleen stilte, precies zoals hierboven beschreven.

Voor de deny-lijst was dat al gerepareerd (#10); de allow-lijst stond nog
volledig op het liggende streepje. Beide schrijfwijzen staan er nu in, zonder
dubbelingen. Dat is geen weifeling: de naam kan per omgeving verschillen, en
een regel te veel op een leesrecht kost niets terwijl een regel die niets doet
je een half jaar op het verkeerde been zet.
