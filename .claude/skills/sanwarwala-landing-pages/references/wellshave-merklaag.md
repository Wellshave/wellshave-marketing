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

## 1. De werkwijze

Van creative tot gepubliceerde pagina. Houd deze volgorde aan; hij is zo gebouwd dat elke stap
het werk van de volgende vastlegt.

### 1. Lees de creative uit

Noteer letterlijk: de belofte, de hook, het getal dat genoemd wordt, en de visuele taal.
Die belofte komt woordelijk boven de vouw. Niet parafraseren naar iets algemeners — dat is de
meest gemaakte fout en hij kost het grootste deel van de klikwaarde.

### 2. Haal de harde gegevens op

Uit `wellshave.com/products.json?limit=250`: welke varianten en pakketten bestaan, hun prijs,
`compare_at_price`, voorraad en variant-ID. Uit het Trustpilot-profiel: score en aantal.
**Cijfers die je niet kunt nawijzen, gebruik je niet** (deel 11).

Bestaat er geen tweede of derde pakket, forceer er dan geen.

### 3. Schrijf de copy, alles, voordat je opmaakt

Van kop tot FAQ. Pas als de tekst staat, bepaal je de vorm — de opmaak volgt het argument, niet
andersom.

### 4. Bouw vanaf het startbestand

Kies eerst het type (deel 2), pak dan het bijbehorende skelet:
`references/startbestand-advertorial.html` of `references/startbestand-listicle.html`. Allebei
dragen ze het volledige tokenblok en alle component-CSS, met tijdelijke inhoud tussen
blokhaken. **Begin daar, niet bij nul.** Elke sectie die
je niet nodig hebt verwijder je; wat je houdt is dan gegarandeerd consistent met de rest.

Vervang alleen wat tussen blokhaken staat. Raak de CSS niet aan tenzij je iets toevoegt dat er
echt niet in zit — en zet dat dan ook in deze merklaag.

### 5. Vul het beeld

Eerst de eigen fotografie, dan pas genereren (deel 13 en 14). Controleer per blok of het beeld
er werkelijk bij hoort.

### 6. Controleer voor het publiceren

- Beeldverhoudingen: `naturalWidth/naturalHeight` tegen de weergegeven maat
- 390px: alle rasters naar een kolom, geen horizontale overloop
- Elke knop: gaat hij waarheen de tekst belooft
- Div-balans: evenveel openende als sluitende tags

### 7. Publiceer en lees terug

Volg deel 16. Publiceren is niet af zonder de controle achteraf.

---

## 2. Welk paginatype, en wat dat betekent voor de opbouw

**Kies het type voordat je iets ontwerpt.** Type bepaalt de ruggengraat, en de ruggengraat
bepaalt welke secties er zijn en in welke volgorde. De tokens, knoppen, kaarten en het
kopapparaat zijn voor allebei identiek; het verschil zit in de opbouw.

### De keuze

| | Advertorial | Listicle |
|---|---|---|
| Ruggengraat | Een doorlopend argument | Losse genummerde punten |
| Past bij | Unaware en problem-aware | Solution-aware en product-aware |
| Kies dit als | De lezer zijn probleem verkeerd diagnosticeert en je dat moet omdraaien | De lezer het probleem kent en wil weten waarom jij beter bent dan het identiek ogende alternatief |
| Kies dit NIET als | Het product simpel en voor de hand liggend is, er valt dan niks te diagnosticeren | De punten alleen in deze volgorde kloppen, dan heb je een betoog |
| Startbestand | `references/startbestand-advertorial.html` | `references/startbestand-listicle.html` |

De praktische toets: **kun je de punten omwisselen zonder dat het betoog omvalt?** Kan dat, dan
is het een listicle. Kan dat niet, dan is het een advertorial en moet je hem ook zo bouwen.

De hook van de creative geeft meestal de doorslag. Een creative die een vraag stelt of een
mechanisme demonstreert, levert nieuwsgierig verkeer op dat nog gediagnosticeerd moet worden:
advertorial. Een creative die een voordeel claimt of een aanbod toont, levert verkeer op dat
al weet wat het wil: listicle.

### Advertorial: de opbouw

```
hero -> geruststrook -> artikel (scene, probleem, oorzaak) -> mechaniekblok (donker)
-> drie tintkaarten -> artikel (waarom het andere faalde) -> beeldband
-> vier kenmerkkaarten -> galerij -> specificaties -> aanbod -> bewijs -> faq -> afsluiter
```

Eigen aan dit type, komt niet in een listicle voor:

- **Het artikel met lopende tekst.** Byline met leestijd, een scene in de tweede persoon, een
  callout met de oorzaak, een uitgelicht citaat. Dit is waar de diagnose gebeurt.
- **Het donkere mechaniekblok** met tekening en vinkjes: het bewijs van de ene claim waar de
  hele pagina op rust.
- **De drie tintkaarten** in probleem-probleem-oplossing. Die volgorde is inhoudelijk; ze zijn
  niet omwisselbaar.

### Listicle: de opbouw

```
hero (met het getal in de kop) -> geruststrook -> korte intro (max twee alinea's)
-> de genummerde lijst -> vergelijkingstabel -> beeldband -> aanbod -> bewijs -> faq -> afsluiter
```

Eigen aan dit type, komt niet in een advertorial voor:

- **Genummerde items.** Grote cijfers in het goudverloop, kop met tweeslags-vorm, twee tot vier
  zinnen, en beeld dat per even punt van kant wisselt. Vijf tot acht punten werkt: onder de vijf
  voelt het mager, boven de acht haakt de lezer af voordat hij het aanbod ziet.
- **De vergelijkingstabel** (wij versus zij). Dit is het natuurlijke thuis van dat argument, en
  hij weegt zwaarder naarmate de markt verzadigder is.
- **Een korte intro in plaats van een verhaal.** Zodra je een scene gaat schrijven, ben je een
  advertorial aan het bouwen.

Nummering is hier geoorloofd omdat de volgorde inhoud draagt: de lezer weet hoeveel er nog komt.
Op een advertorial zijn genummerde markeringen decoratie, en dan horen ze er niet.

### Wat allebei hetzelfde is

Hero, geruststrook, beeldband, aanbodblok, bewijs, FAQ en afsluiter zijn identiek. Ook alle
tokens, knoppen, kaartvormen, het kopapparaat en de bewegingsregels. Bouw je een nieuw component
voor een van de twee, zet het dan in de gedeelde CSS zodat het andere type het ook kan gebruiken.

---

## 3. Tokens

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
  /* tekstverloop op lichte grond: donkerder, anders onleesbaar (zie deel 5) */
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

## 4. Typografie

**Uitsluitend Montserrat** (400/500/600/700/800/900). Eén familie over het hele merk. Een
display-serif erbij verzinnen breekt de herkenning direct.

| Rol | Gewicht | Spatiëring | Kleur |
|---|---|---|---|
| Sectiekop | 900 | `-.025em` | ink / wit |
| Subkop in artikel | 900 | `-.022em` | ink |
| Lopende tekst | 400-500 | normaal, `line-height:1.7` | ink-80 |
| Eyebrow / label | 800 | `.2em`, uppercase, ~10.5px | ink-40 |
| Knoptekst | 800 | normaal | zie deel 6 |

Koppen krijgen `text-wrap:balance`. Lopende tekst blijft binnen `--read`.

---

## 5. Het tweeslags-kopapparaat

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

## 6. Knoppen

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

## 7. Kaarten en blokken

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

## 8. De vaste componenten

Een pagina wordt uit deze onderdelen opgebouwd. Ze liggen vast in vorm, niet in inhoud.

### Hero

Van boven naar beneden: eyebrow, tweeslags kop, een lede van hooguit 44 tekens breed, dan de
acties, dan de geruststellers, dan een bewijsregel. Rechts het beeld op een donkere plaat
(`--grad-dark`, `--r-l`, ruime binnenmarge, zachte slagschaduw) met het beeld zelf op `--r-m`.

De acties zijn er twee en ongelijk van gewicht: een primaire pilknop, en ernaast een tekstlink
met onderlijn die naar het bewijsblok springt. Twee even zware knoppen naast elkaar heffen
elkaar op.

De geruststellers staan als korte opsomming met een bronzen stip ervoor, niet als vinkjes.
Vinkjes zijn voorbehouden aan de kaarten.

### Geruststrook

Direct onder de hero, op wit, met een hairline boven en onder. Vier items naast elkaar,
gescheiden door verticale hairlines. Per item een rond icoonvlak in `--sand`, een vette regel
en een lichtere onderregel. Valt terug naar twee kolommen onder 980px en een onder 520px,
waarbij de verticale scheidingen horizontaal worden.

### Beeldband

Volle breedte binnen de rail, `--r-l`, beeld met `object-fit:cover` en een vaste hoogte via
`clamp()`. De tekst staat linksonder op een gradientsluier die van donker naar transparant
loopt, zodat hij leesbaar blijft ongeacht de foto. Een zin, hooguit 19 tekens breed.

Hooguit een band per pagina.

### Iconen

Dunne lijntekeningen, `stroke-width:2.1`, `fill:none`, afgeronde uiteinden. Geen gevulde
vormen, geen emoji, geen kleurige icoonsets. Vinkjes in kaartlijsten zijn omcirkeld en iets
zwaarder (`2.4`), zodat ze als bevestiging lezen en niet als versiering.

### Advertentie-echo

Wanneer de advertentie zelf een herkenbaar beeld heeft dat geen foto is &mdash; een zoekbalk, een
chatvenster, een schermafdruk &mdash; bouw dat beeld na in HTML op de donkere plaat in de hero, in
plaats van de statische advertentie als afbeelding te plakken. Het is scherp op elk scherm, het
schaalt mee, en de tekst erin blijft doorzoekbaar en aanpasbaar per variant.

Regels die het bruikbaar houden:

- **Woordelijk overnemen.** De regels in de echo zijn dezelfde regels als in de advertentie, in
  dezelfde volgorde. Een parafrase breekt precies de herkenning waarvoor je het bouwt.
- **Geen echte merkinterface namaken.** Geen Google-logo, geen exacte kopie van een bestaande
  zoekmachine of app. Bouw de vorm, niet het merk, en zet in de kleine lettertjes dat het een
  weergave is en geen schermafdruk.
- **Laat het beeld doorlopen naar het product.** Onderaan de echo hoort de stap die de bezoeker
  zoekt: bij een zoekbalk is dat een resultaatkaart met productnaam en prijs. Zo staat het aanbod
  al boven de vouw zonder dat het de sfeer breekt.
- **Op mobiel direct onder de kop.** Zet de hero met `display:contents` op `.hero-copy` in een
  kolomvolgorde, zodat de echo v&oacute;&oacute;r de knoppen valt en binnen de eerste schermhoogte
  zichtbaar is. Zakt hij daaronder, dan is de herkenning weg op het apparaat waar de meeste
  klikken vandaan komen.
- Dezelfde regel als losse pil (`.vraagrij`) boven elk antwoord verderop op de pagina houdt het
  motief vast, net als de tweeslags kop.

### Meldbalk en navigatie

Een standalone pagina krijgt een smalle meldbalk in `--carbon` met `--gold` tekst, en daaronder
een sticky navigatiebalk met alleen het woordmerk en een knop. **Draait de pagina binnen een
thema, dan vervallen die allebei** — het thema levert ze al, en dubbel is erger dan geen.

---

## 9. Sectieritme

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

## 10. Beweging

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

## 11. Cijfers en claims

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

**Betrouwbare bronnen:** `products.json` voor prijzen en voorraad, het Trustpilot-profiel van
wellshave.nl voor score en aantal beoordelingen, de bol.com-verkooppagina's voor het aantal
beoordelingen daar, en Shopify-analytics voor bestellingen. Weet je het niet, vraag het dan of
laat het weg. Een pagina zonder getal is beter dan een pagina met een verzonnen getal.

**Twee onafhankelijke platforms verslaan één platform met meer cijfers.** Trustpilot naast
bol.com zegt meer dan Trustpilot alleen, omdat de bezoeker ze los van elkaar kan nagaan.
Zet ze naast elkaar met een haarlijn ertussen en label per bron wat het meet — een score is
iets anders dan een aantal.

---

## 12. Toon: pijn zonder schaamte

Het VoC-dossier van Wellshave (`4. CLAUDE/wellshave_voc_dossier_v4.html`, 120+ citaten uit
Trustpilot, bol.com, Amazon.de en Reddit) noemt vier dingen die bij deze doelgroep
a&aacute;ntoonbaar averechts werken. Ze gelden voor elke pagina, niet voor &eacute;&eacute;n campagne:

- **Geen insecurity-marketing.** "Zoveel procent vindt je vies" verkoopt hier niet, het
  duwt weg. Schrijf de pijn als kosten &mdash; uitstellen, haast, aandacht die ergens anders
  heen ging &mdash; niet als een gebrek aan de lezer.
- **Geen partner-shaming** en geen patroniserende toon ("je wist niet hoe"). Zet er
  desnoods letterlijk bij dat er niets mis is met hem en dat het gereedschap het probleem is.
- **Geen kaal-belofte.** De meerderheid wil kort, geen biljartbal. 3 tot 5 mm is het
  midden waar de markt om vraagt; "kaal als glas" spreekt een minderheid aan.
- **Trademark-scepsis.** Getrademarkte techtermen zonder uitleg wekken wantrouwen. Leg het
  mechanisme uit in gewone woorden; het merkteken mag erbij staan, maar draagt het argument niet.

Twee dingen die volgens hetzelfde dossier w&eacute;l werken en te weinig worden gebruikt:
"vergevend" in plaats van "veilig" (klanten weten dat ze zelf niet nauwkeurig zijn), en
eerlijke prijsvergelijking op vervangmesjes, omdat verborgen kosten bij de concurrentie een
terugkerende dealbreaker zijn.

---

## 13. Beeld

**Een blok krijgt nooit een foto die er niet echt bij hoort.** Een beeld dat er ongeveer op
lijkt is erger dan geen beeld: het maakt het blok plat en ongeloofwaardig.

Volgorde:

1. **Eigen merkfotografie eerst.** Die is echt en niemand kan hem namaken. De bibliotheek
   staat in Drive onder `1. WELLSHAVE ★/1. E-commerce/2. Team Wellshave/2. Photo & Video/`,
   met lifestyle, productsets en losse featurebeelden per productlijn.
2. **Genereren als er niets past** (zie deel 14).
3. **Nooit genereren wat bewijs moet zijn.** Dit is de grens. Illustreren mag: een stilleven
   van wat iemand al probeerde, een sfeerbeeld van de gebruikssituatie. Bewijs mag niet: een
   voor-en-na van huid, een resultaat, een gezicht bij een review. Dat is verzonnen bewijs,
   dezelfde categorie als een verzonnen review. Ontbreekt het materiaal, meld dat dan als gat.

**Vormgeving:** afronding `--r-m`, en op donkere secties een plaat van `--grad-dark` met
binnenmarge eromheen. Let op ingebakken achtergronden — productsetfoto's staan vaak op wit of
op zwart en zijn zelden transparant. Controleer dat vóórdat je ze naast elkaar zet, anders
springt de stijl bij het wisselen.

---

## 14. Beeld genereren

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

## 15. Het aanbodblok

Hier valt de aankoop, en hier zit de ruimte om de orderwaarde te verhogen. Drie opties naast
elkaar als kaarten, nooit onder elkaar als lijst en nooit meer dan drie.

### 11.1 Eerst kijken wat er is

**Ontwerp de ladder pas nadat je hebt gecontroleerd wat er werkelijk bestaat.** Niet elk
product heeft een PRO-versie, een pakket of iets om cadeau te doen. Haal op uit
`wellshave.com/products.json?limit=250`:

- welke varianten en pakketten er zijn voor dit product
- de prijs én `compare_at_price` van elk daarvan
- of ze op voorraad staan (`available`)
- de variant-ID's, want die heb je nodig voor de knoppen

Bestaat er geen pakket, forceer er dan geen. Twee eerlijke opties verslaan drie waarvan er
één verzonnen is. En verzin nooit een bundelprijs: bestaat het pakket niet als los product,
dan kan de knop er ook niet heen.

### 11.2 De drie behandelingen

Alle kaarten staan op donkere grond en zijn even hoog. Het verschil zit in de behandeling,
en die codeert de rol van de kaart:

| Rol | Kaart | Lint | Knop |
|---|---|---|---|
| Instap | donker, subtiele rand | geen | goud omlijnd |
| Uitgelicht | `--grad-gold` met gloed | "meest gekozen", donker pilletje | donker gevuld |
| Beste waarde | donker met gouden rand, gloed achter de foto, gouden hoekband | "beste waarde", omlijnd pilletje | goud gevuld |

Per kaart: eigen productfoto op donkere plaat, naam in kapitalen, de prijs groot en
gecentreerd met de doorstreepte vanaf-prijs ernaast, een gouden eyebrow die de kaart typeert
("de essentials", "glad en veilig in één"), een vinkjeslijst met omcirkelde vinkicoontjes, en
een eigen knop.

- Hogere pakketten beginnen hun lijst met "alles uit de vorige" — dat maakt de trap zichtbaar.
- **Toon de besparing bij élke optie**, ook de goedkoopste. Niemand hoort te rekenen.
- Drie kaarten met eigen foto's verslaan één keuzelijst met wisselend beeld: het verschil is
  zichtbaar zonder klikken, er is geen JavaScript nodig, en knoptekst en bestemming kunnen
  niet uit de pas lopen.

### 11.3 Een gratis extra op de bovenste kaart

Het sterkste middel om de orderwaarde te verhogen: geef bij het duurste pakket iets weg dat
de routine compleet maakt. De kaart krijgt dan een **cadeaubalk** — een omlijnde pil in goud
met een cadeau-icoon en de tekst "Gratis [product] t.w.v. €X" — plus de gouden hoekband.

Kies een extra dat een bezwaar wegneemt of de klant sneller bij het resultaat brengt. Iets
willekeurigs erbij gooien voegt niets toe.

### 11.4 Hoe het cadeau technisch werkt

**Wellshave heeft verborgen cadeauvarianten van €0,00.** Dat is de eenvoudigste route en
vrijwel altijd de juiste: de knop legt het cadeau er gewoon bij, want het artikel kost niets.
Geen kortingsregel, niets dat kan verlopen, niets dat met andere regels botst.

```
/cart/{pakket-variant}:1,{cadeau-variant}:1
```

**Die cadeauvarianten staan NIET in `products.json`.** Ze zijn `UNLISTED` en de openbare feed
laat verborgen producten weg. Zoek ze via de Admin API, bijvoorbeeld op handle (`gift-…`) of
op `product_type: "Gift"`. Concludeer nooit uit een lege feed dat een cadeauvariant niet
bestaat — dat is precies de fout die hier één keer is gemaakt.

**Controleer altijd live.** Open de permalink en lees `wellshave.com/cart.js`. Wat je wilt
zien: het juiste aantal artikelen, het cadeau op `price: 0`, en `total_discount: 0`. Laad
daarna een gewone winkelpagina en lees `cart.js` opnieuw, zodat het thema en de cadeaubalk
hebben gedraaid. Blijft het cadeau staan, dan is het bestand.

**Blijf van de drempels van de cadeaubalk af.** Wellshave heeft een eigen cadeaumechaniek met
stappen (verzending, washbag, neustrimmer) die op meerdere plekken in de winkel wordt getoond.
Die drempels verlagen om één landingspagina te laten kloppen, laat de winkel en de balk uit
elkaar lopen. De permalink-route raakt dat systeem niet: cadeaubalken voegen toe bij het halen
van een drempel, maar verwijderen niet wat er langs een andere weg in ligt. Getest en bevestigd.

**Let op de voorraad van de cadeauvariant.** Staat die op `DENY` en raakt hij leeg, dan kan het
artikel niet meer worden toegevoegd en belooft de pagina iets wat de winkelwagen niet levert.

**Alleen als er géén €0-variant bestaat** is een automatische korting het alternatief: Kortingen
→ Koop X, krijg Y, type automatisch, 100% korting, maximaal één per bestelling. Nadeel: hij kan
botsen met andere automatische kortingen, en hij is een extra ding dat stuk kan. Voordeel: hij
is niet te manipuleren, terwijl iemand een €0-variant ook los via een permalink kan toevoegen.

**Controleer wat het pakket al bevat.** Zit er al een variant van het cadeau in, dan is "gratis
X erbij" verwarrend en kun je het beter als upgrade framen.

---

## 16. Publiceren binnen een Shopify-thema

Een landingspagina hoort op het eigen domein: dat houdt attributie en analytics schoon. In de
praktijk draait hij dan binnen het themasjabloon, met de themaheader en -footer eromheen. Dat
stelt vijf eisen aan hoe je hem bouwt.

### Alles afschermen in een laag

Wikkel de pagina in `<div class="gg-lp">` en scoop elke elementselector daarbinnen. Een
ongeschermde reset als `*{margin:0}` of `img{display:block}` slaat dwars door de themaheader
en -footer heen en sloopt de rest van de winkel op die pagina.

```css
.gg-lp *{box-sizing:border-box;margin:0;padding:0}
.gg-lp{ /* wat anders op body zou staan */ }
.gg-lp img{max-width:100%;height:auto;display:block}
.gg-lp a{color:inherit}
.gg-lp :focus-visible{outline:3px solid var(--bronze);outline-offset:3px}
```

### Beelden en stylesheet naar de CDN

Nooit base64 in de pagina: dat maakt hem loodzwaar en oncachebaar. Upload naar Shopify Files en
verwijs met de CDN-URL. De route is `stagedUploadsCreate` voor een uploadadres, het bestand er
met `curl` naartoe POSTen, dan `fileCreate`. Zo gaan de bytes rechtstreeks en hoeft niemand ze
over te typen.

De stylesheet gaat als los `.css`-bestand mee. **Wijzigt de opmaak, upload dan onder een nieuwe
naam** (`-2`, `-3`) en pas de verwijzing aan; een bestaande naam overschrijven levert cachegedoe op.

### Alleen geldige HTML

De editor schoont ongeldige markup stil op en herschrijft hem, en in de bewerker ziet dat er
normaal uit. Een voorbeeld dat is voorgekomen: `li` binnen een `dl` mag niet, dus werd de lijst
vroegtijdig gesloten, vielen alle regels erbuiten en verdween de opmaak. Gebruik `dt`/`dd` in
een `dl` en `li` in `ul`/`ol`, en niets anders.

### Alle niet-ASCII als entiteit

Bij het plakken van een grote lap HTML kunnen tekensets omvallen: letterlijke accenten komen er
als onzin uit terwijl entiteiten heel blijven. Zet elk teken buiten het basisalfabet om naar
`&#nnn;` voordat je plakt.

### Achteraf teruglezen

Publiceren is niet af zonder controle. Lees de opgeslagen inhoud terug via de API en tel wat je
erin stopte: secties, beelden, knoppen, kaarten. Beide fouten hierboven zijn zo gevonden, en
geen van tweeen was zichtbaar in de bewerker.

### Wat de themaroute kost

De themaheader bevat navigatielinks, en dat zijn uitgangen op een pagina die om een actie draait.
Wil je die weg, dan is een eigen kale layout plus paginasjabloon nodig — twee themabestanden,
waarvoor iemand toegang tot de code-editor moet hebben. Voor een eerste versie is de themaroute
prima; weeg het opnieuw zodra de pagina volume draait.

---

## 17. Technische regels

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

## 18. Waar dit woont

- **Bron:** `Wellshave/design` → `.claude/skills/sanwarwala-landing-pages/`
- **Spiegel:** `Wellshave/wellshave-marketing`, alleen om te lezen
- **Globaal:** symlink `~/.claude/skills/sanwarwala-landing-pages` → de design-kloon

Bewerk nooit de spiegel. Wijzig in de design-repo en draai daarna
`~/Documents/GitHub/design/scripts/sync-skill.sh`, en commit in beide repo's. Twee kopieën
die uit elkaar lopen zijn erger dan één kopie op de verkeerde plek.

**Let op de zichtbaarheid:** de design-repo is openbaar, marketing is privé. Zet commerciële
details hier niet neer zonder je af te vragen of ze openbaar mogen staan.

---

## 19. Wat deze laag nog niet weet

- **Geen conversiedata.** Alles hierboven is opbouw volgens principe en één vergelijking met
  een eigen ontwerp, geen gemeten resultaat. Zodra er Clarity- of GA4-cijfers zijn, hoort
  hier te staan wat werkelijk won.
- **Één paginatype getest.** Het systeem is gebouwd op een confronterende advertorial voor
  één product. Of het net zo houdt bij een zachtere hook of een ander productsegment is nog
  niet gebleken.
- **De website zelf is niet doorgelicht.** De tokens komen van wellshave.com, maar of de
  bestaande site dit systeem consequent volgt is nooit gecontroleerd.
