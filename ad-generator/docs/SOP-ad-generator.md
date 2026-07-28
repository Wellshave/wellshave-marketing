# SOP , Wellgroup Ad Generator

Voor iedereen die met de Ad Generator gaat werken en de tool nog niet kent. Dit document beschrijft de vaste werkwijze van A tot Z: eenmalige setup, de zes werk-flows, het bewerken van beelden, de kwaliteitsregels die de tool afdwingt, en troubleshooting.

**Wat is dit voor tool?** Eén HTML-bestand dat in de browser draait en vier dingen maakt voor twee merken (Wellshave en Wellshine): statische Meta-advertenties, advertenties op basis van eigen foto's, Meta ad copy (Ogilvy) en video-scripts (3 hooks, 6 beats, 3 CTA's). Claude (Anthropic) bedenkt de concepten en copy, OpenAI rendert de beelden.

---

## 1. Eenmalige setup (10-15 minuten)

1. **Open het bestand.** Ga in Google Drive naar `4. CLAUDE / Ad generator` en open het bestand `ad-generator-wellgroup-vX.XX.html` met het **hoogste versienummer**, altijd via dubbelklikken/openen in de browser (Chrome). Oudere versies zijn back-ups, gebruik die niet.
2. **Vul de API-keys in.** Klik bovenin op het paneel "API keys & modellen" en vul de Anthropic-key en de OpenAI-key in (vraag deze aan Dustin). De statussen rechtsboven horen groen te worden ("Anthropic verbonden", "OpenAI verbonden").
3. **Regel de proxy (alleen nodig voor beeldgeneratie).** Concepten en copy werken direct; alleen het renderen van beelden loopt via een proxy. Twee opties:
   - **Laptop, lokaal:** volg de stappen in de tab **Proxy uitleg** (Terminal openen, Python checken, naar de map navigeren met de sleep-methode, `python3 openai-proxy.py` starten). Laat het Terminal-venster openstaan zolang je werkt.
   - **Zonder gedoe / telefoon / nieuwe laptop:** plak de **Cloudflare Worker-URL** in het veld "OpenAI proxy URL" bij Instellingen. Dan hoeft er niets geïnstalleerd te worden. (Setup van de Worker zelf: zie `mobiel-proxy-cloudflare-setup.md` in deze map, eenmalig.)
4. **Kies het merk.** Linksboven in de topbar wissel je tussen Wellshave en Wellshine. Alles (huisstijl, prompts, producten, persona's) schakelt mee.

---

## 2. De vaste werkwijze: nieuwe statics maken (Generator-tab)

Dit is de hoofdflow. Werk het formulier **van boven naar beneden** af; de volgorde is bewust.

1. **Brain dump (optioneel maar aangeraden).** Typ vrij wat je in je hoofd hebt (een vondst, seizoen, doelgroep, irritatie, deal) en klik "Laat Rory analyseren". Rory vult funnel, archetype, mode en persona alvast in; je kunt alles daarna nog overrulen.
2. **Product + plaatsing.** Kies het product en het formaat (Feed 1:1, 4:5, Stories/Reels 9:16).
3. **Format mode , dit bepaalt de richting.** Welke elementen komen in de ad:
   - *Auto*: Claude kiest en spreidt over variaties.
   - *Direct-Response*: volledige conversie-stack (alleen relevante elementen per sub-stack).
   - *Brand-Builder / Lifestyle-Placement*: minimaal, sfeer, TOF.
   - *Feature-Education / Bundle-Showcase*: features of bundels centraal.
   - *Nieuwsartikel*: oogt als redactioneel artikel, bewust ZONDER merk-elementen, leidt naar een listicle of advertorial (zie hoofdstuk 3).
   Bij elke kaart zit een "bekijk voorbeeld"-link met uitleg.
4. **Persona.** Kies de customer persona; de pijnen, wensen en bezwaren sturen hooks en copy. Geen passende persona? Voeg er een toe via Beheer (of de Persona's-tab).
5. **Funnel-fase, market sophistication en customer awareness.** Deze drie bepalen hoe hard de claim mag zijn en waar de ad "opent". Twijfel je: TOF + probleembewust is de veilige start voor koud verkeer.
6. **Aantal variaties.** Standaard 3. Elke variatie krijgt verplicht een ander hook-type en een eigen compositie (de tool bewaakt dit).
7. **Concept-richting (optioneel).** Beschrijf het idee; dit is een harde visuele driver. Bevat je richting een transformatie of before/after, dan komt die ook echt in beeld. Gebruik "Vraag Rory om concept-ideeën" als je inspiratie wilt.
8. **Genereer variaties.** Per variatie zie je: hook-type, headline, body, CTA, de ChatGPT image-prompt (aanpasbaar), **Rory's hypothese** (waarom deze variant zou moeten winnen) en reasoning. Lees de hypothese altijd even, dat is je testlogica.
9. **Genereer de afbeelding** per variatie. Duurt 20-90 seconden; je ziet een laadbalk en krijgt een klikbare melding als hij klaar is.
10. **Beoordeel, bewerk (hoofdstuk 4), maak de Meta-copy (hoofdstuk 5), download de PNG en bewaar het concept in de Bibliotheek.** Bewaren = later exact kunnen reproduceren, inclusief alle instellingen.

---

## 3. Nieuwsartikel / advertorial-flow (cold traffic naar een artikel)

Speciale mode voor ads die niet naar de productpagina linken maar naar een listicle of advertorial.

1. Kies format mode **Nieuwsartikel**. Het formulier verbergt automatisch wat niet relevant is (archetype, concept-richting, offer, bundels) en toont de **Nieuwsartikel-briefing**.
2. **Vul de briefing in:** waar gaat het artikel over (bv "ingegroeide haren na het scheren", "de grootste afknappers van vrouwen") en kies de bestemming: **Listicle** (opsomming, kop mag een getal bevatten) of **Advertorial** (verhalend artikel).
3. Genereer. Elke variatie kiest automatisch 2-3 **scroll-stoppers** (gemarkeerde zin, pull-quote, expert-regel, listicle-getal, lezersquote, foto-caption, persregel) en gebruikt candid foto's waarvan de emotie de kop draagt. In de reasoning staat welke stoppers gekozen zijn.
4. **Regels die hier gelden:** geen wordmark, geen Trustpilot, geen CTA-knop (alleen een tekstlink "Lees verder"), geen prijs, en NOOIT een echt mediamerk nadoen. De copy verkoopt het artikel, niet het product.

---

## 4. Beelden bewerken (het Bewerken-paneel)

Onder elke gegenereerde afbeelding zit één paneel "Bewerken":

1. **Kies het type wijziging:** Aanpassen, Layout, Strippen of Toevoegen. Snelkeuzes per type wisselen mee.
2. **Typ of klik** de wijziging, voeg eventueel referentiefoto's toe (bv "vervang het product door deze foto").
3. **Eén wijziging?** Klik "Voer direct uit". **Meerdere?** Stapel ze ("+ Voeg toe aan stapel", gemengde types mag) en voer alles in één AI-ronde uit, dat scheelt kosten en houdt de compositie consistent.
4. **Versies:** elke bewerking wordt een nieuwe versie; onderaan kun je terug naar elke eerdere versie. "Ook in ander formaat" maakt dezelfde ad in 9:16, 4:5, 1:1 of 16:9.
5. **Safe zones gaan automatisch mee**, ook bij bewerkingen en herformatteren. Bij 9:16 geldt: alle tekst en UI verplicht in de centrale band (Stories: 16-78% van de hoogte; Reels: 16-62%). Check het eindresultaat desondanks altijd even met de safe-zone-overlay.

---

## 5. Meta ad copy en de andere tabs

- **Ogilvy ad copy bij een variatie:** klik op de kaart op "Schrijf Meta ad copy (Ogilvy)". Je krijgt 3 primary texts (kort/middel/lang), 5 headlines, 2 descriptions, een CTA-knop-advies en een annotatie waarom. Elke regel heeft een kopieer-knop; plak direct in Ads Manager.
- **Copywriter-tab:** voor een ad die al bestaat (upload een beeld). Claude analyseert doel, funnel, belofte en doelgroep; daarna schrijft Ogilvy de copy. Klopt de analyse niet helemaal, zet je correctie in "Extra context" en analyseer opnieuw.
- **Kopieer ad-tab:** upload een concurrent-ad; de tool distilleert het mechaniek (hook, compositie, headline-vorm) en bouwt er merk-eigen varianten mee. Merkneutrale elementen worden overgenomen, nooit letterlijke teksten of gezichten.
- **Itereren-tab:** voor een eigen ad die bewezen presteert. Upload de winnaar, vul prestatiecijfers in (ROAS, CTR, hook rate), kies wat er getest mag worden. **Gouden regel: een iteratie verandert precies één variabele** (setting, model of één element); de winnende hook en boodschap zijn heilig. De nieuwe versie moet visueel duidelijk genoeg verschillen.
- **Ad transformer-tab:** eigen foto als hero, de tool bouwt er een ad omheen zonder de foto te wijzigen. Kies aantal variaties (1-4) en gebruik de snelkeuzes voor de richting.
- **Scriptwriter-tab:** video-scripts in het vaste 3x6x3-format. Vul de briefing in (product, persona, casting, funnel, awareness, lengte, de ene claim, het bezwaar voor de CTA, en wat al gedraaid heeft) en je krijgt 3 hooks + 6 beats + 3 CTA's, elk met B-roll per regel, plus een combinatie-gids.

---

## 6. Kwaliteitsregels (door de tool afgedwongen, maar ken ze)

1. **Eén hook, één belofte per ad.** Nooit prijs + social proof + tijd in dezelfde creative.
2. **Hook-body-coherentie:** verandert de hook, dan wordt de hele uitwerking herschreven. Nooit een oude body onder een nieuwe hook (Meta straft dit af als "creative similar").
3. **Elke variant heeft een hypothese.** Geen variatie-om-de-variatie; je test altijd iets.
4. **Iteratie ≠ variatie.** Iteratie = één variabele, kern vergrendeld. Variatie = meerdere dingen anders, kern gelijk.
5. **De wordmark is optioneel.** Bij koud verkeer standaard weglaten; bij ruimtegebrek sneuvelt het logo als eerste.
6. **Feiten boven adjectieven.** Specifieke getallen en claims komen uit de productdata, nooit verzonnen.
7. **9:16 safe zones zijn heilig.** Tekst en knoppen nooit in de boven- en onderzones.

## 7. Checklist vóór publicatie

- [ ] Safe-zone-overlay gecheckt (zeker bij 9:16): niets textueel in de rode zones
- [ ] Claims kloppen (reviews-aantal, klantenaantal, garantie) en zijn actueel
- [ ] Bij Nieuwsartikel: geen merk-elementen in beeld, geen echt mediamerk nagebootst, bestemming (listicle/advertorial) staat live
- [ ] Headline-tekst in het beeld is exact gelijk aan het headline-veld (geen AI-spelfouten)
- [ ] Meta-copy uit het Ogilvy-blok gekopieerd (primary + headline + description + CTA-knop)
- [ ] Concept bewaard in de Bibliotheek
- [ ] PNG gedownload in het juiste formaat

## 8. Troubleshooting

| Probleem | Oplossing |
|---|---|
| "Proxy alleen lokaal bereikbaar" of beeldgeneratie faalt | Proxy draait niet: zie tab Proxy uitleg, of gebruik de Cloudflare Worker-URL in het proxy-veld |
| `cd`-stap faalt met "No such file or directory" | Pad verschilt per laptop: typ `cd ` en sleep de map "Ad generator" vanuit Finder de Terminal in |
| Geen Python op de laptop | Download via python.org/downloads, installeer, Terminal opnieuw openen |
| Download pakt de verkeerde afbeelding | Werk in één generator-tab tegelijk; bij elke nieuwe generatie wordt de andere automatisch geleegd |
| Tekst of knop in de dead zone beland | Bewerken-paneel → Layout → "verplaats X tot binnen de veilige zone" (safe zones gaan automatisch mee) |
| Variaties lijken te veel op elkaar | Check of een concept-richting alle variaties dwingt; verhoog variatie of pas de richting aan |
| Telefoon: beeldgeneratie werkt niet | localhost werkt daar niet: gebruik de Cloudflare Worker-URL (zie `mobiel-proxy-cloudflare-setup.md`) |

## 9. Versiebeheer-afspraken

- De nieuwste versie = het **hoogste versienummer** in de map; oudere versies zijn back-ups.
- Wijzigingen aan de tool lopen via Dustin (en Claude); elke wijziging krijgt een nieuw versienummer en een regel in de **Wijzigingen-tab** in de app. Lees die tab na elke update.
- De Bibliotheek staat lokaal in je eigen browser (per laptop, per browser). Belangrijke winnaars dus ook als PNG + instellingen documenteren.
- Voor andere merken bestaat een kale template: `ad-generator-template-blank-v1.0.html` (zie het README-blok bovenin dat bestand).
