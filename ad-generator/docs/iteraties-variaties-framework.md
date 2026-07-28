# Iteraties en variaties, post-Andromeda

Bron: YouTube-transcript (https://www.youtube.com/watch?v=FVBOYnHL6SA). Een mediabuyer die ~10 ad-accounts beheert en >1 mln dollar/maand op Facebook draait, legt uit hoe hij iteraties en variaties aanpakt sinds Meta's Andromeda-update. Context die ertoe doet: Andromeda straft bijna-identieke creatives af (Meta labelt ze als "creative similar"), dus iteraties en variaties moeten echt onderscheidend zijn, anders test je effectief steeds hetzelfde.

Dit document doet twee dingen: (1) het transcript netjes uitgeschreven, (2) het bruikbare framework eruit gedestilleerd plus concrete aanbevelingen om de Generator (Itereren) en Kopieer ad te hardcoden.

---

## 1. Kernonderscheid

**Iteratie = je verandert ÉÉN variabele.** De kern blijft volledig staan: dezelfde desire, awareness, sophistication en persona. Je verandert precies één ding.

**Variatie = je verandert MEERDERE dingen,** maar het kernidee en de boodschap die je wilt overbrengen blijven hetzelfde. Je gaat nog steeds achter dezelfde desire, awareness, sophistication en persona aan, alleen de invalshoek (hoe je de boodschap brengt) is net anders.

Volgorde: **eerst iteraties, dan variaties.** In het begin doe je vooral iteraties. Pas als die op zijn, ga je naar variaties.

---

## 2. Iteraties, één variabele tegelijk

De twee hoofdvariabelen voor iteratie (in de video UGC-video, maar het principe vertaalt 1-op-1 naar statics):

**a) Nieuwe locatie / setting.** Zelfde script, andere omgeving, maar visueel duidelijk anders genoeg. Voorbeeld: winnende UGC opgenomen in de badkamer, daarna in de auto, de woonkamer, bij het zwembad. Belangrijke regel: als de badkamer een effen witte muur was en de woonkamer is ook gewoon een effen witte muur, dan is het niet visueel verschillend genoeg. De locaties moeten echt anders ogen.

**b) Nieuwe persoon.** Zelfde script, zelfde locatie, andere persoon, maar binnen dezelfde doelgroep. Voorbeeld: doelgroep 23-jarige vrouwen. Je zoekt andere 23-jarigen, maar met verschil in etniciteit, lichaamsbouw, vorm, maat. Doel: verschillende subgroepen binnen die markt aanspreken (de ene kijker swipet eerder op een wat steviger type, de ander op een brunette, enzovoort).

Twee guardrails bij "nieuwe persoon":
- **Niet te micro.** Een blonde vrouw met blauwe ogen vervangen door een blonde vrouw met groene ogen is te klein verschil, dat doet niets.
- **Niet de hele persona omgooien.** Ga je van een 23-jarige naar een 50-jarige met overgangsklachten, dan verander je de hele persona. Dat is geen iteratie meer, dat is een nieuw concept.

**Het Instagram-voorbeeld (kerngedachte van iteratie).** Iemand met één concept: "dag X dat ik een willekeurige volger uitdaag tot een gevecht tot ik knock-out ga." Letterlijk één idee, tientallen keren uitgevoerd. Begon klein in het park met willekeurige mensen, daarna escaleren: nieuwe locaties, daarna nieuwe mensen, daarna kleine outfit-wisselingen, uiteindelijk zelfs bekende namen. Elke aflevering bijna identiek gefilmd, maar steeds iets dat het concept beter maakt: coolere locaties, coolere mensen. Zo bereik en spreek je steeds meer mensen aan. Les: een bewezen concept verder uitbouwen door te blijven investeren in dat ene concept, niet steeds iets compleet nieuws verzinnen.

---

## 3. Variaties, meerdere dingen tegelijk (kern blijft)

Drie variatie-assen:

**a) Scriptlengte / copylengte.** Short-form versus long-form. Niet de bestaande video knippen, maar bewust een kortere én bewust een langere versie schrijven. Voor statics: bewust een korte body versus een lange long-form primary text schrijven.

**b) Andere creative-stijl.** Doe je nu alles UGC, test dan een professioneel gepolijste versie. Of organic image met long-form primary text. Of de "notes app"-stijl versus een professionele productshot. Belangrijk: pas de boodschap aan zodat hij bij die creative-stijl past, plak niet zomaar dezelfde tekst eronder.

**c) Nieuw hook-patroon dat het script genoeg verandert.** Voorbeelden:
- Listicle: "Hoe schaal je Facebook ads" versus "3 manieren om Facebook ads te schalen."
- Authority-angle: "Dokter onthult de snelste manier om af te vallen."
- Metafoor: "Dit product geeft je energie door de brandstofleidingen in je lichaam te resetten" (knijp je de brandstofleiding van een motor dicht, dan vertraagt hij; idem in je lichaam; supplement opent ze weer).

**De allerbelangrijkste regel bij hooks:** als je een nieuwe hook maakt, gaat de rest van het script OVER die hook. De grootste fout die mensen maken: een nieuwe hook bedenken ("3 manieren om...") en daar de originele body onder plakken die helemaal niet over die 3 manieren gaat. Dan werkt het niet en labelt Meta het als "creative similar". Je test dan effectief steeds hetzelfde.

---

## 4. Twee overkoepelende principes

**Hypothese verplicht.** Elke iteratie of variatie moet een hypothese hebben over waaróm hij beter zou presteren dan het origineel. Niet itereren om het itereren. Voorbeeld-hypothese: "Onze winnende ad ziet er nu uit als een ad door de professionele productie. Ik wil 'm beter camoufleren zodat hij minder als ad oogt en minder mensen wegswipen. Een organic image + long-form tekst doet dat, en onze doelgroep van 50-60 jaar consumeert dat formaat sowieso natuurlijker." De hypothese benoemt: het sterke punt van de winnaar, een concreet probleem ermee, en een onderbouwd idee gebaseerd op wat de doelgroep al natuurlijk consumeert. De kern (awareness, desire, persona, angle) blijft gelijk, alleen het script wordt aangepast aan de nieuwe creative-stijl.

**Weet wanneer je moet stoppen.** Doe alle locaties en personen die logisch zijn en een reden hebben. Doe alle variaties die logisch zijn en een reden hebben. Maar als je door je zinnige ideeën heen bent, ga dan niet krampachtig nieuwe forceren. Dan ga je terug naar nieuwe concepten. Veel mensen blijven 6 maanden itereren op één winnaar en vinden nul nieuwe winnaars.

---

## 5. Vertaling naar onze Static Ad Generator

Onze tool maakt statics, geen video, maar het framework vertaalt direct. Mapping van de video-begrippen naar statics:

- "Nieuwe locatie" -> nieuwe achtergrond / setting / scene van de static.
- "Nieuwe persoon" -> ander model / andere demografie in een lifestyle- of UGC-static, binnen dezelfde persona-doelgroep.
- "Creative-stijl" -> onze format modes en archetypes (UGC, feature-grid, lifestyle, professionele productshot, notes-app-stijl, organic image + long copy).
- "Hook-patroon" -> onze hook-frameworks (listicle, authority, metafoor, before/after, social proof, enzovoort).

### Concrete hardcode-aanbevelingen

**A. Itereren-modus strikt op ÉÉN variabele.**
Maak van Itereren expliciet een single-variable-modus. De gebruiker (of de tool) kiest precies één knop om te veranderen, en alles daaromheen wordt hard vergrendeld:
- Te variëren: nieuwe setting/achtergrond, OF nieuw model/demografie, OF één los element (kleur headline, CTA-tekst, badge).
- Vergrendeld: hook, headline-boodschap, offer, awareness, sophistication, desire, persona.
- Guardrail "visueel verschillend genoeg": bij setting/model expliciet eisen dat de nieuwe versie duidelijk anders oogt dan het origineel (niet effen witte muur -> effen witte muur, niet blond/blauw -> blond/groen). Dit voorkomt "creative similar".

**B. Variatie-generatie spreiden over de drie assen, niet willekeurig.**
Laat de tool variaties bewust spreiden over: (1) copylengte (kort vs long-form), (2) creative-stijl/format mode, (3) hook-patroon. Houd per variatie de kern (awareness, desire, sophistication, persona, angle) identiek. Dit sluit aan op wat de generator nu al doet met sub-stacks, maar maak de drie assen expliciet de leidraad.

**C. Hook-body-coherentie afdwingen (belangrijkste anti-"creative similar"-regel).**
Hardcode de regel: zodra de hook verandert, MOET de body volledig herschreven worden zodat hij die hook waarmaakt. Verbied expliciet het hergebruiken van de oude body onder een nieuwe hook. In de prompt: "De volledige body en copy gaan OVER de nieuwe hook; neem nooit de body van het origineel over als de hook is veranderd."

**D. Hypothese-veld per iteratie/variatie.**
Voeg aan de output-JSON een veld toe zoals `hypothese_nl`: één tot twee zinnen die benoemen waarom deze versie het origineel zou moeten verslaan (sterk punt van de winnaar + probleem ermee + onderbouwd idee op basis van de doelgroep). Toon dit op de kaart. Dit dwingt intentie af in plaats van variatie-om-de-variatie.

**E. "Weet wanneer je stopt"-signaal.**
Optioneel: laat de tool, als de logische iteraties/variaties op zijn voor een concept, adviseren om terug te gaan naar een nieuw concept in plaats van te blijven forceren.

### Voor Kopieer ad specifiek
Kopieer ad neemt het mechaniek van een referentie-ad over. Combineer dat met bovenstaande: laat de gekopieerde ad de kern (mechaniek, awareness, angle) vasthouden en bied daarna de iteratie-as (nieuwe setting/model, één variabele) en de variatie-assen (copylengte, creative-stijl, hook-patroon) aan, elk met een hypothese. Zo wordt Kopieer ad geen losse kopie maar een vertrekpunt voor gestructureerd itereren en variëren.
