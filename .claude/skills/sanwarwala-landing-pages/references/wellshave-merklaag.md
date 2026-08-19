> **Spiegel — niet hier bewerken.** De bron staat in Wellshave/design onder
> `.claude/skills/sanwarwala-landing-pages/`. Wijzigingen daar maken en daarna
> `scripts/sync-skill.sh` draaien.

# Wellshave-merklaag

Hoe Wellshave eruitziet en aanvoelt. Geldt voor landingspagina's, productpagina's en de
website — niet voor één campagne.

`SKILL.md` ernaast bevat de algemene conversiekennis (Arsh Sanwarwala, Mark, Priestley).
Dit bestand bevat wat specifiek Wellshave is. Bij tegenspraak wint dit bestand, want dit
gaat over herkenbaarheid.

**Regel bij het uitbreiden:** schrijf hier alleen op wat bij de vólgende pagina ook nog
geldt. Prijzen, bestandsnamen en losse incidenten horen bij het project, niet hier.

---

## 1. Tokens

```css
:root{
  /* inkt */
  --ink:#111111;              /* koppen, hoofdtekst */
  --ink-80:rgba(17,17,17,.8); /* lopende tekst */
  --ink-60:rgba(17,17,17,.6); /* bijschriften */
  --ink-40:rgba(17,17,17,.4); /* labels, eyebrows */
  --ink-10:rgba(17,17,17,.10);/* hairlines, randen */

  /* grond */
  --paper:#FFFFFF;
  --sand:#F5F1EA;             /* hét Wellshave-signaal */
  --sand-deep:#EDE6DA;        /* tweede laag, kaders */
  --carbon:#191816;           /* donkere secties, niet puur zwart */

  /* accent */
  --bronze:#BC813E;           /* accent op licht */
  --gold:#F5D18A;             /* accent op donker */
  --alert:#E61C1C;            /* uitsluitend korting en urgentie */

  /* betekenis-tinten, gedempt zodat ze warm blijven */
  --tint-rose:#F4E3DE;        /* probleem */
  --tint-amber:#F7EBD3;       /* probleem */
  --tint-sage:#E5EBE1;        /* oplossing */

  /* gradienten — wezenlijk voor het merk, niet decoratief */
  --grad-gold:linear-gradient(158deg,#F8DFAB 0%,#E5BC77 42%,#C8913F 100%);
  --grad-dark:linear-gradient(168deg,#242220 0%,#171614 58%,#0E0D0C 100%);
  --grad-sand:linear-gradient(180deg,#FBF8F3 0%,#F1EBE0 100%);
  /* tekstverloop op lichte grond: donkerder, anders onleesbaar (zie deel 3) */
  --grad-gold-tekst:linear-gradient(100deg,#B0742A 0%,#8C5A1A 100%);

  /* vorm — één schaal over alles */
  --r-s:12px;                 /* kleine vlakken, invoervelden */
  --r-m:18px;                 /* kaarten, beelden */
  --r-l:26px;                 /* grote platen, uitgelichte kaarten */

  --rail:1140px;              /* maximale contentbreedte */
  --read:660px;               /* leesbreedte lopende tekst */
}
```

**Zand is het signaal, niet goud.** `#F5F1EA` met zwarte Montserrat is wat Wellshave
herkenbaar maakt. Brons en goud zijn accent en moeten schaars blijven; zodra alles brons is,
oogt het als een sjabloon met een gouden randje.

**Kies je grond bewust.** Wit voor lange leesstukken, zand voor rustige secties, carbon of
`--grad-dark` waar het serieus wordt: mechanisme, aanbod, afsluiter.

---

## 2. Typografie

**Uitsluitend Montserrat** (400/500/600/700/800/900). Eén familie over het hele merk. Een
display-serif erbij verzinnen breekt de herkenning direct.

| Rol | Gewicht | Spatiëring | Kleur |
|---|---|---|---|
| Sectiekop | 900 | `-.025em` | ink / wit |
| Subkop in artikel | 900 | `-.022em` | ink |
| Lopende tekst | 400-500 | normaal, `line-height:1.7` | ink-80 |
| Eyebrow / label | 800 | `.2em`, uppercase, ~10.5px | ink-40 |
| Knoptekst | 800 | normaal | zie deel 4 |

Koppen krijgen `text-wrap:balance`. Lopende tekst blijft binnen `--read`.

---

## 3. Het tweeslags-kopapparaat

De handtekening van het merk. Elke sectiekop bestaat uit twee regels: de eerste stelt vast,
de tweede levert de opluchting in accentkleur.

```html
<h2 class="duo">Eerste regel,<span class="b">tweede regel.</span></h2>
<h2 class="duo on-dark">Op donker<span class="b">wordt hij goud.</span></h2>
```

```css
.duo{font-weight:900;letter-spacing:-.025em;line-height:1.02;
     font-size:clamp(31px,4.6vw,54px);text-wrap:balance}
.duo .b{display:block;color:#B0742A}          /* terugval */
.duo.on-dark{color:#fff}
.duo.on-dark .b{color:var(--gold)}            /* terugval */

@supports ((-webkit-background-clip:text) or (background-clip:text)){
  .duo .b{background-image:var(--grad-gold-tekst);
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;color:transparent}
  .duo.on-dark .b{background-image:var(--grad-gold)}
}
```

**De tweede regel loopt in een verloop, niet in een effen kleur.** Dat is merkeigen. Maar het
verloop verschilt per grond, en dat is geen smaakkwestie:

| Grond | Verloop | Contrast |
|---|---|---|
| Donker | `--grad-gold` (licht goud → brons) | ruim voldoende |
| Licht | `--grad-gold-tekst` (`#B0742A` → `#8C5A1A`) | 3,47 en 5,19 |

Het lichte goud uit de merkgradiënt haalt op zand niet meer dan 1,2:1 en is daar vrijwel
onleesbaar. Zelfs `--bronze` zelf komt op zand niet verder dan 2,94 en blijft daarmee net
onder de norm van 3,0 voor grote tekst. **Reken het contrast na voordat je een accentkleur op
tekst zet**, ook als het een merkkleur is.

Zet altijd een effen terugvalkleur, zodat er zonder `background-clip:text` geen onzichtbare
tekst overblijft.

**Consequent doorvoeren of niet doen.** Eén keer in de hero en daarna laten vallen is de
klassieke fout: het sterkste merkelement verdwijnt dan na de eerste schermhoogte. De lezer
herkent het ritme na de tweede keer en gaat het verwachten.

De tweede regel draagt de emotie, de eerste de feitelijkheid. Zet het voordeel dus achteraan.

---

## 4. Knoppen

Alle knoppen zijn **pillen** (`border-radius:100px`). Nooit rechthoekig, nooit licht
afgerond — dat is het verschil tussen zacht en technisch.

| Soort | Vulling | Tekst | Waar |
|---|---|---|---|
| Primair | `--grad-gold` | `#1A1408` | de hoofdactie, één per schermhoogte |
| Secundair | `--ink` | wit | nav, herhaalde acties |
| Op donker | wit 10% + rand wit 20% | wit | kaarten in donkere secties |
| Op goud vlak | `--carbon` | wit | de uitgelichte kaart |
| Tekstlink | geen | `--ink-60` met onderlijn | de zachte tweede optie |

```css
.knop{display:inline-flex;align-items:center;gap:9px;border-radius:100px;
      padding:16px 30px;font-size:14.5px;font-weight:800;text-decoration:none;
      transition:background .18s ease,transform .18s ease}
.knop:hover{transform:translateY(-1px)}
.knop.goud{background:var(--grad-gold);color:#1A1408}
.knop.goud:hover{filter:brightness(1.04)}
```

**Regels:**

- Eén primaire knop per schermhoogte. Twee gouden knoppen naast elkaar heffen elkaar op.
- Zet het voordeel of de prijs in het label als dat de drempel verlaagt. "Kies jouw pakket"
  slaat beter aan dan "Verzenden".
- Direct onder een koopknop staan de risiconemers: proefperiode, garantie, verzending.
  Nabijheid tot het klikpunt is wat telt, niet dat ze ergens op de pagina staan.
- Zichtbare toetsenbordfocus overal: `3px solid var(--bronze)`, `outline-offset:3px`.

**Koopknoppen leggen direct in de winkelwagen.** Op een landingspagina is de productpagina
een omweg: de bezoeker is daar al overtuigd, en nog een pagina met opnieuw kiezen kost
verkopen. Gebruik een Shopify-permalink:

```
https://wellshave.com/cart/{variant-id}:{aantal}
```

Variant-ID's haal je uit `wellshave.com/products.json?limit=250`. Zet het label op de
handeling plus de prijs — "In de winkelwagen · €59,95" — zodat er geen verrassing volgt.

Dit is het verschil met de gewone webshop: daar mag iemand rondkijken, hier is er één pad.

---

## 5. Kaarten en blokken

De kaart is de bouwsteen. Vaste kenmerken: afronding `--r-m`, ruime binnenmarge van 20 tot
26px, en op lichte gronden een zachte schaduw (`0 14px 34px rgba(17,17,17,.09)`).

**Kleur codeert de inhoud, hij versiert niet.**

- **Drie tintkaarten** voor probleem → probleem → oplossing: roze, amber, salie. De lezer
  ziet de betekenis vóórdat hij de tekst leest. Werkt beter dan een tweekolomstabel.
- **Vier kenmerkkaarten** in wit, carbon, `--grad-gold` en `--sand-deep`. Vier gelijke vakken
  die door hun vulling ritme krijgen in plaats van vier keer hetzelfde vlak.
- **Uitgelichte kaart**: `--grad-gold` als vulling, donkere knop, en een lintje dat over de
  bovenrand valt.

Elke kaart heeft een icoon in een afgerond vierkant of cirkel, een kop van één regel, en
tekst die kort genoeg blijft om te scannen. Iconen zijn dunne lijntekeningen
(`stroke-width:2.1`), geen gevulde vormen en geen emoji.

---

## 6. Sectieritme

Licht en donker wisselen elkaar af. Een bruikbare volgorde:

```
zand → wit → donker → zand → donker → wit → donkere afsluiter
```

De donkere blokken vallen op de plekken waar het serieus wordt: het mechanisme en het
aanbod. Zonder die afwisseling loopt alles in elkaar over en voelt de pagina langer dan hij is.

Een **beeldband over de volle breedte** met tekst eroverheen breekt het kolomritme. Gebruik
er hooguit één per pagina; twee maakt het effect ongedaan. De tekst krijgt een gradiëntsluier
zodat hij leesbaar blijft, ongeacht de foto eronder.

---

## 7. Beweging

Ingehouden. Te veel animatie is precies wat een pagina goedkoop en machinaal maakt.

**Wat we gebruiken:**

- **Onthulling bij het scrollen** — van opacity 0 naar 1 met 16px omhoog, 0.6s, via
  `IntersectionObserver` met `rootMargin:'0px 0px -12% 0px'`. Na één keer `unobserve`, zodat
  het niet blijft herhalen.
- **Hover op knoppen en kaarten** — 1px omhoog plus kleurwissel, 0.18s.
- **Beeldwissel** — het nieuwe beeld eerst in de achtergrond laden, dan pas ruilen, met een
  korte overvloeier. Nooit een lege plek tonen.

**Wat we niet doen:** parallax, tellers die oplopen, elementen die van links en rechts
invliegen, of iets dat bij elke scroll opnieuw afspeelt.

**Altijd afdekken:**

```css
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .reveal{opacity:1;transform:none;transition:none}
}
```

In JavaScript hetzelfde: bij `matchMedia('(prefers-reduced-motion: reduce)').matches` alles
direct zichtbaar zetten en de waarnemer niet starten.

---

## 8. Cijfers en claims

Getallen zijn het sterkste overtuigingsmiddel dat er is, en daarom ook het gevaarlijkste om
los uit de pols in te vullen.

**Nooit een getal opschrijven dat je niet kunt nawijzen.** Niet afronden naar boven, niet
"ongeveer", niet een plausibel klinkend aantal omdat de zin erom vraagt. Een bezoeker die één
cijfer betrapt, gelooft de rest ook niet meer — en op een pagina die om precisie draait, zoals
een halve millimeter, is dat dodelijk.

**Label altijd waar het getal over gaat.** Bestellingen zijn geen klanten, klanten zijn geen
gebruikers van dít product, en een Trustpilot-score over het hele bedrijf is geen score over
één artikel. Schrijf het bereik erbij in plaats van het weg te laten:

- goed: "Ruim 200.000 bestellingen sinds 2021" met daaronder waar dat over gaat
- fout: een productpagina die suggereert dat al die bestellingen dit ene apparaat betroffen

**Betrouwbare bronnen:** `products.json` voor prijzen en voorraad, het Trustpilot-profiel voor
score en aantal beoordelingen, Shopify-analytics voor bestellingen. Weet je het niet, vraag
het dan of laat het weg. Een pagina zonder getal is beter dan een pagina met een verzonnen
getal.

---

## 9. Beeld

**Een blok krijgt nooit een foto die er niet echt bij hoort.** Een beeld dat er ongeveer op
lijkt is erger dan geen beeld: het maakt het blok plat en ongeloofwaardig.

Volgorde:

1. **Eigen merkfotografie eerst.** Die is echt en niemand kan hem namaken. De bibliotheek
   staat in Drive onder `1. WELLSHAVE ★/1. E-commerce/2. Team Wellshave/2. Photo & Video/`,
   met lifestyle, productsets en losse featurebeelden per productlijn.
2. **Genereren als er niets past** (zie deel 10).
3. **Nooit genereren wat bewijs moet zijn.** Dit is de grens. Illustreren mag: een stilleven
   van wat iemand al probeerde, een sfeerbeeld van de gebruikssituatie. Bewijs mag niet: een
   voor-en-na van huid, een resultaat, een gezicht bij een review. Dat is verzonnen bewijs,
   dezelfde categorie als een verzonnen review. Ontbreekt het materiaal, meld dat dan als gat.

**Vormgeving:** afronding `--r-m`, en op donkere secties een plaat van `--grad-dark` met
binnenmarge eromheen. Let op ingebakken achtergronden — productsetfoto's staan vaak op wit of
op zwart en zijn zelden transparant. Controleer dat vóórdat je ze naast elkaar zet, anders
springt de stijl bij het wisselen.

---

## 10. Beeld genereren

Via de Higgsfield-MCP. `gpt_image_2` op `quality:"high"` geeft duidelijk fotografischer
resultaat dan de marketingmodellen, die een CGI-look opleveren. Stuur een referentiebeeld mee
als het product in beeld moet, anders verzint het model een ander apparaat.

**Wat werkt in de prompt:** fotografische specificaties (lens, diafragma, lichtopstelling),
materiaalgedrag (hoe rubber uitrekt, hoe latex doorschijnend wordt bij spanning),
imperfecties (stof, naden, satijnglans in plaats van spiegelglans), en de merktokens als
kleuraanwijzing.

**Altijd expliciet negatief op:** tekst, opschriften, typografie, watermerken, pijlen,
diagrammen en logo's — anders bakt het model advertentie-opmaak in het beeld. Plus geen CGI,
geen 3D-render, geen plastic oppervlak, geen perfecte symmetrie.

**Controleer producttrouw** voordat je kiest: kopvorm, plek van het monogram, leesrichting
van de merknaam. Een dramatischer compositie met een verkeerd weergegeven product is netto
verlies.

---

## 11. Het aanbodblok

Drie opties, nooit meer. Naast elkaar als kaarten, niet onder elkaar als lijst.

Elke kaart bevat: eigen productfoto, naam, één regel wat het is, prijs met doorstreepte
vanaf-prijs, **de besparing in euro's**, een vinkjeslijst van de inhoud, en een eigen knop
naar dat product.

- De **middelste** is de uitgelichte: `--grad-gold`, donkere knop, lintje "meest gekozen".
- Hogere pakketten beginnen hun lijst met "alles uit de vorige" — dat maakt de trap zichtbaar.
- **Toon de besparing bij élke optie**, ook de goedkoopste. Niemand hoort te rekenen.
- Drie kaarten met eigen foto's verslaan één keuzelijst met wisselend beeld: het verschil is
  zichtbaar zonder klikken, er is geen JavaScript nodig, en knoptekst en bestemming kunnen
  niet uit de pas lopen.

**Prijzen altijd uit de echte productfeed** (`wellshave.com/products.json?limit=250`),
inclusief `compare_at_price` voor de doorstreping. Verzin nooit een bundelprijs: bestaat het
pakket niet als los product, dan kan de knop er ook niet heen.

---

## 12. Technische regels

**Beeldverhoudingen.** Zet altijd `height:auto` in de basis, anders wint een HTML
`height`-attribuut van `width:100%` en worden beelden tot de helft uitgerekt:

```css
img{max-width:100%;height:auto;display:block}
```

Meet het na met `naturalWidth/naturalHeight` tegen `getBoundingClientRect()`. Op het oog zie
je 50% vervorming aan voor "wat dun".

**Mobiel is de maat.** Ontwerp en controleer op **390px**. Rasters vallen terug naar één
kolom; kaarten in een schuifstrip worden ongeveer 82% breed zodat de rand van de volgende
zichtbaar blijft — dat is wat mensen laat schuiven.

**Zoek-en-vervang in CSS is gevaarlijk.** Een patroon als `.reviews{...}` komt ook voor in
gedeelde regels als `.grid3,.stats,.reviews{...}`. Vervang gericht en controleer daarna of de
mobiele regels nog staan.

**Geen navigatie op een betaalde pagina.** Elke link is een uitgang; het doel is één actie.

---

## 13. Waar dit woont

- **Bron:** `Wellshave/design` → `.claude/skills/sanwarwala-landing-pages/`
- **Spiegel:** `Wellshave/wellshave-marketing`, alleen om te lezen
- **Globaal:** symlink `~/.claude/skills/sanwarwala-landing-pages` → de design-kloon

Bewerk nooit de spiegel. Wijzig in de design-repo en draai daarna
`~/Documents/GitHub/design/scripts/sync-skill.sh`, en commit in beide repo's. Twee kopieën
die uit elkaar lopen zijn erger dan één kopie op de verkeerde plek.

**Let op de zichtbaarheid:** de design-repo is openbaar, marketing is privé. Zet commerciële
details hier niet neer zonder je af te vragen of ze openbaar mogen staan.

---

## 14. Wat deze laag nog niet weet

- **Geen conversiedata.** Alles hierboven is opbouw volgens principe en één vergelijking met
  een eigen ontwerp, geen gemeten resultaat. Zodra er Clarity- of GA4-cijfers zijn, hoort
  hier te staan wat werkelijk won.
- **Één paginatype getest.** Het systeem is gebouwd op een confronterende advertorial voor
  één product. Of het net zo houdt bij een zachtere hook of een ander productsegment is nog
  niet gebleken.
- **De website zelf is niet doorgelicht.** De tokens komen van wellshave.com, maar of de
  bestaande site dit systeem consequent volgt is nooit gecontroleerd.
