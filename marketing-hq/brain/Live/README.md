# Live — het afgedrukte brein

Alles in deze map is een **afdruk** van de database. Het wordt bij elke draai
van `../genereer.mjs` volledig overschreven, dus typ er niets in: dat is bij de
eerstvolgende draai weg.

| Bestand | Wat |
|---|---|
| `Vandaag.md` | Welk werk ligt stil, en op wie wacht het? Begin hier. |
| `Werkstukken.md` | Elk idee met zijn volledige keten en alles wat eraan gedaan is |
| `Logboek.md` | Alles wat de agents deden, nieuwste bovenaan |
| `Dagen/` | Eén bestand per dag: wie er werkte, wat eruit kwam, wat het kostte |
| `Agents/` | Eén bestand per agent |

De rest van `brain/` is met de hand geschreven en wordt door de generator
**nooit** aangeraakt. Dat is geen afspraak maar een controle in de code
(`veiligPad`), met een test eromheen: de vault bevat inhoud die niet in de
database staat, en die mag niet verdwijnen omdat iemand "de vault bijwerkt".

## Draaien

```
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node marketing-hq/brain/genereer.mjs
```

Of zonder sleutel, uit een uitdraai van de drie views:

```
BREIN_JSON=brein.json node marketing-hq/brain/genereer.mjs
```
