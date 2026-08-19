# Wellshave-merklaag — confronterende landingspagina's

Aanvulling op `SKILL.md`. Die bevat de algemene kennis (Arsh, Mark, Priestley). Dit bestand
bevat wat specifiek is voor Wellshave: de merktokens, het paginapatroon en de valkuilen die
tijdens de bouw van de Groom Guard-ballonpagina naar boven kwamen.

Bron: gescrapet van wellshave.com en de Groom Guard-productpagina, plus de bouw van
`landingspaginas/groom-guard-ballon.html` (18-19 augustus 2026).

---

## 1. Merktokens — exact, niet benaderd

Dit is geen interpretatie maar wat er werkelijk op wellshave.com staat.

```css
:root{
  --ink:#111111;              /* koptekst, hoofdtekst */
  --ink-80:rgba(17,17,17,.8); /* lopende tekst */
  --ink-60:rgba(17,17,17,.6); /* bijschriften */
  --ink-40:rgba(17,17,17,.4); /* labels, eyebrows */
  --ink-10:rgba(17,17,17,.10);/* hairlines, randen */
  --paper:#FFFFFF;
  --sand:#F5F1EA;             /* de warme achtergrond, hét Wellshave-signaal */
  --sand-deep:#E8E0D2;        /* tweede laag, kaders */
  --carbon:#191816;           /* donkere secties, niet puur zwart */
  --bronze:#BC813E;           /* accent: CTA's, cijfers, tweede kopregel */
  --gold:#F5D18A;             /* accent op donker */
  --alert:#E61C1C;            /* alleen voor korting/urgentie */
  --rail:1120px;              /* maximale contentbreedte */
  --read:660px;               /* leesbreedte lopende tekst */
}
```

**Typografie:** uitsluitend **Montserrat** (400/500/600/700/800/900). Geen tweede font.
De site gebruikt één familie over het hele merk; een display-serif erbij verzinnen breekt
direct de herkenning.

- Koppen: 800-900, strak gespatieerd (`letter-spacing:-.02em`), hoofdletters voor eyebrows
- Lopende tekst: 400-500, `line-height:1.7`
- Eyebrows/labels: 600, `letter-spacing:.18em`, uppercase, `--ink-40`

**Het merksignaal is de zandkleur, niet het goud.** `#F5F1EA` als achtergrond met zwarte
Montserrat is wat Wellshave herkenbaar maakt. Brons is accent en moet schaars blijven —
zodra alles brons is, ziet het eruit als een AI-template met een gouden gradient.

---

## 2. Het confronterende patroon

De advertenties stellen een vraag die niet klopt met wat de kijker verwacht ("Waarom knapt
deze ballon niet?"). De pagina moet die vraag **overnemen en beantwoorden**, niet vervangen
door een merkslogan. Dat is Arsh' congruentieregel (Deel 0 van `SKILL.md`), maar toegepast
op een specifiek hooktype.

**Structuur die werkte op de Groom Guard-pagina:**

1. **Hero** — de vraag uit de advertentie letterlijk als H1, het antwoord als tweede regel
   in brons ("0,5 millimeter."), daaronder één zin die de spanning vasthoudt. Beeld: het
   bewijs zelf, niet het product op wit.
2. **Advertorial** — lopende tekst op leesbreedte die het probleem uitlegt vóór het product
   genoemd wordt. Ogilvy-register: feitelijk, specifiek, geen uitroeptekens.
3. **Mechanisme visueel** — de dwarsdoorsnede die laat zien waar de huid stopt en het blad
   zit. Dit is het bewijsstuk; zonder tekening is de claim een bewering.
4. **Waarom alles wat je probeerde niet werkte** — tegenoverstelling in twee kolommen,
   donker versus licht. Marktsofisticatie fase 4-5: de lezer heeft al dingen geprobeerd.
5. **Gebruikssituatie** — onder de douche, in beweging, nat.
6. **Specificaties** — pas hier, als de lezer al overtuigd is.
7. **Aanbod** — prijs, garantie, verzending, review-score.
8. **FAQ** — de echte bezwaren, niet de marketingvragen.
9. **Afsluiter** — mini-hero met dezelfde belofte.

**Toon:** droog en fysiek. Geen superlatieven. De kracht zit in het getal (0,5 mm) en het
mechanisme, niet in bijvoeglijke naamwoorden.

---

## 3. Werkwijze van advertentie naar pagina

1. **Lees de creative uit.** Welke vraag stelt hij, welk getal noemt hij, welke belofte doet
   hij? Die gaan letterlijk boven de vouw.
2. **Haal echte content op.** Scrape de productpagina voor specificaties, prijs, garantie,
   verzendbeleid en reviewaantal. Verzin nooit cijfers — een verkeerd getal op een pagina
   die om precisie draait, ondermijnt het hele argument.
3. **Schrijf de copy eerst.** Volledig, van hero tot FAQ, voordat er één regel CSS komt.
4. **Bouw met de tokens hierboven.** Eén HTML-bestand, lokale afbeeldingen ernaast.
5. **Genereer ontbrekend beeldmateriaal** (zie 4).
6. **Verifieer in de browser** op 1440 én 390 breed, en meet de beeldverhoudingen (zie 5).

---

## 4. Beeldgeneratie via Higgsfield

**Model:** `gpt_image_2` op `resolution:"4k"`, `quality:"high"` levert duidelijk
fotografischer resultaat dan `marketing_studio_image`, dat een CGI-look geeft.
Kosten: 12 credits voor twee 4K-varianten tegenover 2 voor de marketingvariant.

**Referentiebeeld meesturen** als `medias:[{value:"<media-id>", role:"image"}]` zodat het
product klopt. Zonder referentie verzint het model een andere trimmer.

**Wat werkt in de prompt:**
- fotografische specificaties: "100mm macro, f/8, één softbox links, amberkleurige striplight rechts"
- materiaalgedrag: "fijne radiale spanningsplooien", "latex wordt dunner en licht doorschijnend waar het uitrekt"
- imperfecties: stof, gietnaad, satijnglans in plaats van spiegelglans
- expliciete negatieven: geen CGI, geen 3D-render, geen plastic oppervlak, geen perfecte
  symmetrie, **geen tekst/typografie/pijlen/diagrammen** (anders bakt het model advertentie-
  opmaak in het beeld)

**Wat niet werkt:** vragen om stof en gietnaden levert ze meestal alsnog niet op. Het
oppervlak blijft schoner dan echt rubber. Voor een pagina die om fysiek bewijs draait is een
echte opname geloofwaardiger dan een gegenereerde.

**Controleer altijd de producttrouw** voordat je een variant kiest: kopvorm, plek van het
monogram, leesrichting van de merknaam. Een dramatischer compositie met een verkeerd
weergegeven product is netto verlies.

---

## 5. Technische valkuilen (echt tegengekomen)

**Uitgerekte afbeeldingen.** Bij `width="700" height="700"` als HTML-attribuut plus
`width:100%` in CSS zonder `height:auto` wint het hoogte-attribuut. Resultaat: beelden
tot ~50% vervormd (346×700 in plaats van 346×346). Voorkom dit met één regel:

```css
img{max-width:100%;height:auto;display:block}
```

Meet het na met een script dat `naturalWidth/naturalHeight` tegen de weergegeven
`getBoundingClientRect()` afzet. Vertrouw niet op het oog — 50% vervorming zag er op een
volledige schermafdruk uit als "wat dun".

**Previewpane.** Bestanden buiten de projectmap renderen als statische momentopname; relatieve
afbeeldingspaden lossen dan niet op en je ziet alt-tekst. Dat is geen fout in de pagina.
Verifieer met `open <bestand>` in de echte browser.

**CSS-specificiteit.** Let op botsende selectors tussen `.section`-achtige klassen en
element-selectors, vooral bij marges tussen secties.

---

## 6. Wat deze laag nog mist

Eerlijk over de gaten, zodat je weet waar je moet aanvullen:

- **Geen echte reviewteksten.** Trustpilot blokkeerde het scrapen met een verificatiescherm.
  De reviewcijfers op de pagina komen van de productpagina; losse citaten ontbreken nog.
- **Eén paginatype getest.** Dit patroon is gebouwd voor één product met één hook. Of het
  houdt bij een ander product of een zachtere hook is niet bewezen.
- **Geen conversiedata.** Alles hierboven is opbouw volgens principe, niet gemeten resultaat.
  Zodra de pagina live staat en Clarity/GA4 data geven, hoort de testvolgorde uit Deel 8 van
  `SKILL.md` hier ingevuld te worden met wat werkelijk won.
