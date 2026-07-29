# De console opgesplitst

`app/index.html` was 20.969 regels. Nu is het er 2.009, met de rest in 12 css- en
28 js-bestanden ernaast. Er is geen regel code gewijzigd — alleen verplaatst.

## Wat er in die 21.000 regels zat

| | regels | |
|---|---:|---|
| CSS | 5.638 | in 16 blokken |
| JavaScript | 13.486 | in 10 blokken, waarvan één van 11.894 |
| markup | 1.845 | de eigenlijke HTML |

De markup was 9% van een "HTML-bestand". En het was ook geen bestand van 21.000
regels: het was één programma met tien lagen eroverheen gestapeld — `console-skin`,
`console-skin-2`, `-3`, `wg-delight`, `v6-daylight`, `v61-relief`, `v7-cockpit`,
`v8-studio`, `v9-intelligence`. Elke laag zoekt na het laden bestaande elementen op
en verbouwt ze.

Dat is ook te zien aan de `!important`-dichtheid. De basis-CSS heeft er 29 op 3.721
regels; `v6-daylight` heeft er 207 op 563. Die lagen bestaan niet om iets te doen,
maar om de laag eronder met brute kracht te overstemmen.

## Waarom losse `<script src>` en geen ES-modules

Dit was de enige beslissing die er echt toe deed.

De HTML roept 258 keer een functie aan via `onclick=` en soortgelijke attributen —
85 verschillende functies in de statische markup, meer in HTML die JavaScript zelf
genereert. Die attributen zoeken hun functie op `window`.

ES-modules krijgen hun eigen scope. Elke functie zou uit `window` verdwijnen en alle
258 handlers zouden stilvallen — niet met een foutmelding, maar met een knop die
niets doet. Om modules te kunnen gebruiken zou je eerst alle 258 handlers moeten
omschrijven naar `addEventListener`. Dat is een andere klus, met een ander risico.

Gewone `<script src>` zonder `defer` voert uit op zijn plek in het document, precies
zoals een inline-blok. Zelfde volgorde, zelfde scope, zelfde gedrag. Vandaar dat de
bestanden genummerd zijn: **de volgorde ís de architectuur**, en er is geen bundler
die dat voor je bewaakt.

## Waar de snijlijnen liggen

Het hoofdscript van 11.894 regels is gesneden op zijn eigen sectiekoppen — die
`// ====`-blokken stonden er al. Voor de zekerheid is dat niet aangenomen maar
gecontroleerd, op twee manieren:

- Alle 38 secties parseren los via `node --check`. De snijlijnen liggen dus op
  echte statement-grenzen.
- Van de 11.894 regels draaien er bij het laden maar **24 statements**; de rest
  zijn 403 functiedeclaraties die pas bij een klik iets doen. Functies hoisten
  binnen een bestand, maar niet ertussen — dus alleen die 24 konden breken. Een
  AST-analyse vond precies één vooruitverwijzing (`r9322` gebruikt
  `updateApiStatus` van `r9373`), en die valt binnen dezelfde sectie, dus binnen
  hetzelfde bestand.

## Wat er bewust is blijven staan

**Vier `<style>`-blokken midden in de body** (regel 4394, 5411, 5593, 18718 in de
oude nummering). Die staan binnen een element; naar de `<head>` verplaatsen zou hun
plek in de cascade veranderen en dus het uiterlijk.

**De id's.** `<style id="atelier-v6-daylight">` werd `<link id="atelier-v6-daylight">`.
Niets zoekt ze vandaag op — dat is gecontroleerd — maar ze weggooien maakt een
verschil dat later stil kan bijten.

**De lagen zelf.** Die 207 `!important` opruimen is verleidelijk nu alles openligt,
maar dat verandert wél wat je ziet. Deze opsplitsing is bewijsbaar gedragsneutraal;
dat wil je niet vermengen met een verbouwing die dat niet is. Aparte ronde.

## Hoe het bewezen is

Twee onafhankelijke controles, allebei groen.

**1. Byte-vergelijking.** Alle CSS aan elkaar geplakt in laadvolgorde, alle JS in
laadvolgorde, en de markup met alle blokken eruit gestript — alle drie identiek aan
het origineel (5.638, 13.486 en 1.793 regels). De browser krijgt exact dezelfde
bytes in exact dezelfde volgorde.

**2. Opstarten in een echte browser.** Beide versies naast elkaar in Chromium:

```
node ad-generator/test/console-boot.cjs pad/naar/oude-index.html
```

Gelijk bevonden: 2.765 DOM-elementen, alle element-id's, alle zichtbare tekst, de
berekende stijlen van 16 sleutelelementen, alle 85 onclick-functies op `window`, en
dezelfde opstartfouten (vier geblokkeerde CDN-verzoeken, in beide versies gelijk).

Zonder referentiebestand draait dezelfde test als gewone opstarttest:

```
npm run test:console
```

Die controleert dat de pagina zonder JavaScript-fouten start, dat alle 85 handlers
bestaan, dat de markup is opgebouwd, dat de stijlen zijn toegepast en dat alle 40
bestanden geladen zijn. Draai hem na elke wijziging aan de console — een verkeerd
volgnummer of een vergeten bestand is precies het soort fout dat je pas in productie
zou merken.

**Wat deze test niet dekt:** handlers in HTML die JavaScript zelf genereert. Die
bestaan pas na een klik. De 85 uit de statische markup zijn wel gedekt.

## Deploy verandert

Voorheen sleepte je `app/index.html` naar Netlify. Dat werkt niet meer — het bestand
verwijst nu naar `css/` en `js/` ernaast.

**Sleep voortaan de map `app/`.** Netlify accepteert een map net zo goed als een
bestand. Er is nog steeds geen bouwstap: wat in de repo staat is exact wat draait.

## Wat dit oplevert

De aanleiding was stap 06: de wizard toont winnaars op ROAS maar sorteert de
hoekkaarten zelf nog niet op wat werkt. Die aanpassing zit in
`js/08-generator.js` — 837 regels, met een naam die zegt wat erin zit.

En breder: een fout in de scriptwriter zoek je nu in een bestand van 591 regels in
plaats van in regel 15.450 van 20.969.
