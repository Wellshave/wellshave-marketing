# De angle-kaarten op volgorde van resultaat

In de testwizard (stap "angle") stonden de tien angles in de vaste volgorde van
`CS_ANGLES` — dezelfde lijst, elke keer, ongeacht wat ze hadden opgeleverd. Nu
staan ze op wat ze bij díe persona daadwerkelijk deden.

Dit is de laatste schakel van de lus uit stap 06: de cijfers schrijven zich terug
naar de creatives, en hier sturen ze de volgende creatieve keuze.

## Waarom drie groepen en niet één lijst

Eén lijst op ROAS sorteren klinkt simpeler, maar breekt op twee plekken.

**Een angle zonder data heeft geen ROAS.** Die zou je bovenaan, onderaan of op nul
moeten zetten — alle drie een leugen. Onderaan verdwijnen ze, en dan test je alleen
nog wat je al weet. Dat is precies de lus die je níet wilt: het systeem zou zijn
eigen geschiedenis bevestigen in plaats van iets nieuws leren.

**Een hoge ROAS op één advertentie is geen resultaat.** Zonder onderscheid komt een
angle die één keer toevallig 9,9 haalde boven een angle die over zes advertenties
stabiel 4,1 doet. Dan stuurt toeval de creatieve keuze.

Vandaar drie groepen, elk met een eigen kop:

| Groep | Wanneer | Gesorteerd op |
|---|---|---|
| **Werkt bij deze persona** | ≥ 3 advertenties én ≥ €300 besteed | gewogen ROAS, hoogste eerst |
| **Geprobeerd, nog geen oordeel** | wel getest, te weinig data | beste losse advertentie |
| **Nog niet geprobeerd** | geen historie bij deze persona | eigen volgorde van `CS_ANGLES` |

De drempel is dezelfde `betrouwbaar`-vlag als in `angle_learnings` — één regel,
één plek, geen tweede definitie die uit de pas kan gaan lopen.

## Twee bronnen, twee vragen

`wgpLoadAngleHist` bevraagt er nu twee, omdat het twee verschillende dingen zijn:

- **`hq_angle_learnings`** — wat een angle heeft *opgeleverd*. ROAS gewogen over
  advertenties heen (eerst spend en omzet optellen, dan pas delen), en of dat op
  genoeg data rust. Alleen beoordeelbare advertenties tellen mee.
- **`creatives`** — hoe vaak je hem *geprobeerd* hebt, ook zonder oordeel. Zonder
  deze ziet een angle die je gisteren nog getest hebt er onaangeroerd uit.

De eerste bepaalt de volgorde, de tweede vult hem aan.

`hq_angle_learnings` is de publieke doorgeefview uit migratie 0008. Die bestaat
juist omdat `marketing_hq` niet aan PostgREST is blootgesteld; de browser kan er zo
toch bij, met `security_invoker` zodat RLS blijft gelden.

## Fable ziet hetzelfde

De spar-drawer kreeg tot nu toe `- Problem-Solution: 6x, beste ROAS 5.2`. Dat is de
uitschieter, niet het patroon — Fable adviseerde dus op een ander getal dan het
scherm liet zien. Nu krijgt hij dezelfde regel als de kaart, inclusief het
onderscheid tussen een gewogen oordeel en een losse piek, en of het te dun is.

## Wat er bewust niet is gesorteerd

De angle-kaarten in de Persona Explorer (`px.angleStats`). Dat zijn er drie tot vijf
per awareness-stage, door Rory gegenereerd in een doordachte volgorde, met id's die
niet in de `CS_ANGLES`-taxonomie zitten — `angle_learnings` weet dus niets van ze.
Vier kaarten herschikken op een losse ROAS levert weinig op en gooit Rory's ordening
weg. Als daar toch behoefte aan is, is dat een eigen afweging.

## Getest

```
npm run test:angles
```

Draait de echte console in Chromium met een nep-Supabase eronder, zodat de
werkelijke `wgpLoadAngleHist` en `wgpScreen` draaien — geen nagebouwde kopie.

De fixture is zo gekozen dat de valkuil zichtbaar wordt: `Benefits-Driven` heeft met
9,9 de hoogste ROAS van allemaal, maar staat op één advertentie. Komt die bovenaan,
dan doet de drempel niets. De test controleert dat hij in de tweede groep landt.

Ook gedekt, want dat is vandaag de werkelijkheid:

- **Leeg account.** Alle tien angles in "nog niet geprobeerd", niets breekt.
- **`hq_angle_learnings` bestaat nog niet.** Migratie 0008 hoeft niet op de live
  database te staan; PostgREST geeft dan een fout in plaats van rijen. De wizard
  valt terug op de ruwe telling uit `creatives` in plaats van leeg te lopen.
