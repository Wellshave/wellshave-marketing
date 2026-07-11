# Wellshave — homepage redesign (v2)

Een nieuw homepage-ontwerp voor wellshave.com, gebaseerd op de principes uit het
*Redesign & Branding Rapport* (juli 2026). Eén bestand (`index.html`) + lokale
geoptimaliseerde beelden (`assets/`) — system fonts, geen externe requests.

**v2 gebruikt de echte catalogus**: productnamen, prijzen en fotografie zijn live
opgehaald van wellshave.com (`/products.json`, Shopify CDN) en geoptimaliseerd
(canvas-recompressie, 464 KB totaal voor 12 beelden).

## Designrichting: "De Standaard" — rustige premium, licht-editorial

Het rapport stelt vast dat beide directe concurrenten (BALZY, Brothers in Style)
*competent maar luidruchtig-promotioneel* zijn, en dat niemand de **rustige premium**
ruimte claimt. v2 gaat daar vol op zitten — en draait de merkwereld naar **licht**:
de eigen productfotografie staat op warm-grijze studioachtergronden, dus een warme
linnen ground laat die foto's naadloos vallen terwijl de zwart+goud producten eruit
springen. Bonus: BALZY, Brothers in Style én Manscaped zijn allemaal donker —
licht-editorial is de onbezette ruimte in de categorie.

**Eigen visuele handtekening**: één ingetogen brass-tint, een terugkerend
**goud-boogmotief** (de veeg van een mesje / de curve van de kaaklijn), een
serif-display + sans koppeling (à la Achaté), grafiet accentbanden, en in dark mode
blijven de fotoplaten licht als **galerij-passe-partouts**.

## Hoe de rapport-lekken zijn opgelost

| Lek uit het rapport | Oplossing in dit ontwerp |
|---|---|
| **Hero verkoopt korting, geen merk** | Hero opent met belofte + resultaat ("Scherp verzorgd, van top tot teen"), flagship-foto met floating proof-chips. Levering/proefperiode in een rustige announcement-strip. |
| **Tegenstrijdige review-cijfers** (700+/800+/180.000+) | Eén bron van waarheid, overal identiek: **4,5/5**, **8.400+ reviews**, **180.000+ mannen** (drie duidelijk gescheiden, consistente metrieken). |
| **EN/NL taal-mix** | Alles consequent Nederlands, één zelfverzekerde toon met een vleugje droogte. |
| **Geen merkwereld / motief** | Linnen + grafiet + brass kleurwereld, boogmotief, serif+sans, echte fotografie in een consistent platensysteem. |
| **Wisselende fotografie** | Eigen catalogusfotografie geselecteerd op samenhang: studioshots op warm greige voor producten, warme lifestyle voor de banden (kraan-spoelshot = IPX6-verhaal, doucheshot = Over-blok). |
| **Geen merkverhaal / missie** | "Over Wellshave"-blok: oorsprong Helmond, de standaard (SkinSafe™, garantie), 180.000 mannen. |
| **Geen autoriteit** | "Gezien in"-persbalk + bestseller-chip in de hero-compositie. |
| **Techniek / trage hero** | Geen externe fonts of scripts, beelden lokaal geoptimaliseerd (≤78 KB p/st), lazy-loading onder de vouw; géén scroll-jacking (rapport-waarschuwing). |
| **Geen abonnement / AOV** | Mesjes-abonnement (echte Trio Pack, €19,95 met 20% abonneekorting) + drie echte bundels met bespaar-chips (Barber Bundel, Flex-line, Shave Package Ultimate™). |
| **Tech als merkeigendom** | "De Wellshave-standaard": SkinSafe™, IPX6, zelfslijpende RVS-mesjes, USB-C — specs uit hun eigen productcommunicatie, als material storytelling met mono-cijfers. |

## Echte data (live opgehaald, juli 2026)

Alle kaarten gebruiken actuele catalogusprijzen: Flex Guard™ 3-in-1 €54,95 ·
Groom Guard™ PRO €59,95 · The Gentleman Shaver™ €49,95 · Men Shaper Supreme™ 6-in-1
€39,95 · Head Shaver Deluxe €59,95 · Groom Guard™ €44,95 · Barber Bundel 1.0 €99,95 ·
Flex-line Bundel €89,95 · Shave Package Ultimate™ €89,95 · Trio Pack mesjes €24,95.

## Techniek

- **Beide thema's** (licht/donker) via CSS-tokens; respecteert `prefers-color-scheme`
  en een expliciete toggle in de nav.
- **Responsive**, mobile-first; geen horizontale overflow.
- **Toegankelijk**: zichtbare focus-states, `prefers-reduced-motion`, aria-labels.
- **Motion**: ingetogen scroll-reveal + hover; geen gimmicks.

Openen: dubbelklik `index.html` in een browser. Alle content is placeholder-tekst en
illustratie op productieniveau, klaar om met echte fotografie en Shopify-data te vullen.
