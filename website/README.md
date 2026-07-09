# Wellshave — homepage redesign

Een nieuw homepage-ontwerp voor wellshave.com, gebaseerd op de principes uit het
*Redesign & Branding Rapport* (juli 2026). Eén zelfstandig, zelf-bevattend bestand:
`index.html` (system fonts, inline SVG, geen externe requests — werkt offline en snel).

## Designrichting: "De Standaard" — rustige premium

Het rapport stelt vast dat beide directe concurrenten (BALZY, Brothers in Style)
*competent maar luidruchtig-promotioneel* zijn, en dat niemand de **rustige premium**
ruimte claimt. Dat is de positionering waar dit ontwerp op mikt: kalm, zelfverzekerd,
editorial — nooit korting-eerst.

**Eigen visuele handtekening** (het rapport waarschuwt dat zwart+goud alleen te
generiek-mannelijk is): één ingetogen brass-tint, een terugkerend **goud-boogmotief**
(de veeg van een mesje / de curve van de kaaklijn) in eyebrows en dividers, een
serif-display + sans koppeling (à la Achaté), en producten als **goud-lijnillustraties
op grafiet-blokken** — waardoor het ontbreken van echte fotografie een bewuste huisstijl
wordt in plaats van een gat.

## Hoe de rapport-lekken zijn opgelost

| Lek uit het rapport | Oplossing in dit ontwerp |
|---|---|
| **Hero verkoopt korting, geen merk** | Hero opent met belofte + resultaat ("Scherp verzorgd, van top tot teen") en social proof onder de CTA. Sale is verplaatst naar een subtiele announcement-strip. |
| **Tegenstrijdige review-cijfers** (700+/800+/180.000+) | Eén bron van waarheid, overal identiek: **4,5/5**, **8.400+ reviews**, **180.000+ mannen** (drie duidelijk gescheiden, consistente metrieken). |
| **EN/NL taal-mix** | Alles consequent Nederlands, één zelfverzekerde toon met een vleugje droogte. |
| **Geen merkwereld / motief** | Grafiet + brass kleurwereld, boogmotief, serif+sans, consistente productillustraties. |
| **Geen merkverhaal / missie** | "Over Wellshave"-blok: oorsprong Helmond, de standaard (SkinSafe™, garantie), 180.000 mannen. |
| **Geen autoriteit** | "Gezien in"-persbalk + award-badge in de hero-compositie. |
| **Techniek / trage hero** | Zelf-bevattend, geen externe fonts of scripts; snelle statische hero; géén scroll-jacking (rapport-waarschuwing). |
| **Geen abonnement / AOV** | Mesjes-abonnement-blok (LTV) + "De Complete Set" bundel (AOV). |
| **Tech als merkeigendom** | "De Wellshave-standaard": SkinSafe™, IPX7, 7.200 RPM, USB-C — material storytelling met mono-cijfers. |

## Techniek

- **Beide thema's** (licht/donker) via CSS-tokens; respecteert `prefers-color-scheme`
  en een expliciete toggle in de nav.
- **Responsive**, mobile-first; geen horizontale overflow.
- **Toegankelijk**: zichtbare focus-states, `prefers-reduced-motion`, aria-labels.
- **Motion**: ingetogen scroll-reveal + hover; geen gimmicks.

Openen: dubbelklik `index.html` in een browser. Alle content is placeholder-tekst en
illustratie op productieniveau, klaar om met echte fotografie en Shopify-data te vullen.
