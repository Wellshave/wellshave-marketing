> **Spiegel — niet hier bewerken.** De bron staat in Wellshave/design onder
> `.claude/skills/sanwarwala-landing-pages/`. Wijzigingen daar maken en daarna
> `scripts/sync-skill.sh` draaien.

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

  /* betekenis-tinten: gedempt, zodat ze in de warme merkwereld blijven */
  --tint-rose:#F4E3DE;        /* probleem */
  --tint-amber:#F7EBD3;       /* probleem */
  --tint-sage:#E5EBE1;        /* oplossing */

  /* gradienten — wezenlijk voor het merk, niet decoratief */
  --grad-gold:linear-gradient(158deg,#F8DFAB 0%,#E5BC77 42%,#C8913F 100%);
  --grad-dark:linear-gradient(168deg,#242220 0%,#171614 58%,#0E0D0C 100%);
  --grad-sand:linear-gradient(180deg,#FBF8F3 0%,#F1EBE0 100%);

  /* vorm: één afrondingsschaal over de hele pagina */
  --r-s:12px;
  --r-m:18px;                 /* kaarten, beelden */
  --r-l:26px;                 /* grote platen, pakketkaarten */

  --rail:1140px;              /* maximale contentbreedte */
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

---

## 7. Beeld hoort bij het blok, of het wordt gemaakt

**Regel (Dustin, 19 augustus 2026): een blok krijgt nooit een foto die er niet echt bij hoort.**
Een beeld dat "er ongeveer op lijkt" is erger dan geen beeld — het maakt het blok plat en
ongeloofwaardig. Bestaat er geen passende opname, dan genereer je er een via de
Higgsfield-MCP (zie 4) in plaats van iets naderbij te slepen.

Volgorde bij het vullen van een blok:

1. **Eigen fotografie eerst.** De Drive-map met merkfotografie is de eerste bron; die beelden
   zijn echt en niemand kan ze namaken. Zoek daar voordat je iets genereert.
2. **Genereren als er niets past.** Dezelfde promptregels als in deel 4: fotografische
   specificaties, materiaalgedrag, expliciet negatief op tekst/typografie/CGI. Houd de
   merktokens aan — zand `#F5F1EA`, zwart, brons — anders valt het beeld buiten de pagina.
3. **Nooit genereren wat bewijs moet zijn.** Dit is de grens. Illustratie mag: een stilleven
   van wat iemand al geprobeerd heeft, een sfeerbeeld van de gebruikssituatie. Bewijs mag
   niet: een voor-en-na van huid, een resultaat, een testimonial-gezicht. Dat is verzonnen
   bewijs, dezelfde categorie als een verzonnen review. Ontbreekt het bewijsmateriaal, meld
   dat dan als gat in plaats van het te maken.

### Waar de eigen fotografie staat

`Mijn Drive/1. WELLSHAVE ★/1. E-commerce/2. Team Wellshave/2. Photo & Video/`

- `1. Products/Bodygroomers /Groom Guard Content/` — 117 bestanden: lifestyle met echte
  mensen in de badkamer, waterspat-opnames, de gouden-bollenfoto (visueel hetzelfde argument
  als de ballonadvertentie, in merkkleuren), losse featurebeelden
- `1. Products/Packages/Shave Package Ultimate/` — 13 setfoto's van het pakket
- `3. Ai Fotos   Photoshoot/Ultimate bundle/` — 39 editorial renders

**Let op bij setfoto's:** achtergronden verschillen. Groom Guard en PRO hebben wit ingebakken,
de Ultimate-setfoto bijna zwart (#030303), en geen van drieën is transparant — op pixelniveau
gecontroleerd. Wisselende productbeelden krijgen daarom elk een plaat in hun eigen
achtergrondkleur. Een setfoto van het Ultimate-pakket op wit ontbreekt en zou dit oplossen.


---

## 8. Het ontwerpsysteem

Vastgesteld op 19 augustus 2026, nadat Dustin een eigen ontwerp aanleverde dat aantoonbaar
beter werkte dan wat er stond. Het verschil zat niet in losse details maar hierin: **een
systeem in plaats van een verzameling secties.** Vier onderdelen, en ze horen bij elkaar.

### 8.1 De tweeslags kop — de handtekening

Elke sectiekop bestaat uit twee regels. De eerste stelt vast in zwart, de tweede levert de
opluchting in brons. Op donkere secties wordt die tweede regel goud.

```html
<h2 class="duo">Waar je huid stopt,<span class="b">begint de buffer.</span></h2>
<h2 class="duo on-dark">Maak je zaakjes<span class="b">compleet.</span></h2>
```

```css
.duo{font-weight:900;letter-spacing:-.025em;line-height:1.02;
     font-size:clamp(31px,4.6vw,54px);text-wrap:balance}
.duo .b{display:block;color:var(--bronze)}
.duo.on-dark{color:#fff}
.duo.on-dark .b{color:var(--gold)}
```

**Dit is het krachtigste element dat er is en het moet consequent terugkomen.** Eén keer in
de hero en daarna laten vallen is precies de fout die de vorige versie maakte. De lezer
herkent het ritme na de tweede keer en gaat het verwachten. Voorbeelden die werkten:
"Alles wat je nodig hebt. / Niets wat je huid haat." en "Nat mag. / Nat werkt zelfs beter."

### 8.2 Kleur die betekent

Kleur codeert de inhoud; hij versiert niet.

- **Drie tintkaarten** naast elkaar voor probleem-probleem-oplossing: roze, amber, salie.
  De lezer ziet de betekenis vóórdat hij de tekst leest. Dit vervangt de tweekolomstabel
  "wat je deed / wat werkt" en leest sneller.
- **Vier kenmerkkaarten** in wit, zwart, goudgradiënt en crème. Vier gelijke vakken die
  door hun vulling ritme krijgen in plaats van vier keer hetzelfde vlak.

### 8.3 Licht en donker om de beurt

Volgorde die werkte: zand → wit → **zwart** → zand → **zwart** → wit → donkere afsluiter.

De donkere blokken vallen op de twee plekken waar het serieus wordt: het mechanisme
(doorsnede met vinkjes) en het aanbod. Zonder die afwisseling loopt alles in elkaar over en
voelt de pagina langer dan hij is.

### 8.4 Rondingen, overal dezelfde

Eén schaal (12/18/26) over kaarten, beelden, platen en knoppen; knoppen blijven pillen op
100px. **Scherpe hoeken lezen als technisch en goedkoop.** Bij een product dat over huid
gaat werkt dat tegen je — vandaar dat de vorige, hoekige versie kil aanvoelde.

---

## 9. Het aanbodblok: drie pakketkaarten

Vervangt de rij radioknoppen. Drie kaarten naast elkaar, elk met:

1. **Eigen productfoto** in een plaat die bij de achtergrond van díe foto past (zie deel 5)
2. **Naam en één regel** wat het is
3. **Prijs, doorstreepte vanaf-prijs, besparing in euro's** — bij élke optie, ook de goedkoopste
4. **Vinkjeslijst** van wat erin zit, waarbij hogere pakketten beginnen met "alles uit de vorige"
5. **Eigen knop** naar het echte product

De middelste kaart is de uitgelichte: `--grad-gold` als vulling, donkere knop, en een lintje
"meest gekozen" dat over de bovenrand valt.

**Waarom dit beter is dan één keuzelijst met wisselend beeld:** elke kaart toont zijn eigen
pakket, dus het verschil is zichtbaar zonder te klikken. Er is geen JavaScript nodig en er
kan niets meer misgaan tussen knoptekst en bestemming — een bug die de keuzelijstversie wél
had.

**Alle prijzen uit de echte productfeed** (`wellshave.com/products.json?limit=250`), inclusief
`compare_at_price` voor de doorstreping. Nooit een bundelprijs verzinnen: bestaat het pakket
niet als los product, dan kan de knop er ook niet heen.

Actuele ladder: Groom Guard €44,95 → Groom Guard PRO €59,95 (uitgelicht) → Shave Package
Ultimate €89,95. Drie is het maximum; vier opties kost conversie.

---

## 10. Wat je overneemt en wat niet

Uit het aangeleverde ontwerp bleken twee onderdelen zwakker dan wat er al stond, en die zijn
bewust níet overgenomen: het reviewblok was klein en gedrongen, en de FAQ was een kale lijst
terwijl de rest verzorgd was. **Beoordeel een referentieontwerp per onderdeel, niet als
geheel.**

---

## 11. Waar deze skill woont, en hoe je hem bijwerkt

**De design-repo is de bron. Punt.**

- Canoniek: `Wellshave/design` → `.claude/skills/sanwarwala-landing-pages/`
- Spiegel: `Wellshave/wellshave-marketing` → zelfde pad, alleen om te lezen
- Globaal beschikbaar via een symlink: `~/.claude/skills/sanwarwala-landing-pages`
  → de design-kloon

**Bewerk nooit de kopie in wellshave-marketing.** Die wordt overschreven. Wijzigingen gaan
altijd in de design-repo, en daarna spiegel je ze:

```bash
~/Documents/GitHub/design/scripts/sync-skill.sh
```

Dat script kopieert `SKILL.md` en `references/` naar de marketing-kloon en zet er een
kopregel boven die zegt dat het een spiegel is. Daarna in beide repo's committen.

**Verandert er iets aan de skill of aan deze merklaag, dan hoort de spiegel in dezelfde
beurt mee.** Twee kopieën die uit elkaar lopen zijn erger dan één kopie op de verkeerde plek,
want dan weet niemand meer welke klopt.

### Let op de zichtbaarheid

`Wellshave/design` is **openbaar**, `wellshave-marketing` is privé. Dit bestand bevat
prijsopbouw, marges, interne aantekeningen over wat nog niet geverifieerd is, en paden naar
de Drive. Zet nieuwe commerciële details er niet in zonder je af te vragen of ze openbaar
mogen staan.
