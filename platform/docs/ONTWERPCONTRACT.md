# Ontwerpcontract — Marketing HQ

Harde regels voor het uiterlijk en het gedrag van het systeem. Geen moodboard:
elke regel hieronder is toetsbaar, en waar dat kan wordt hij ook getoetst.

Dit document gaat vóór op smaak, ook op de mijne. Wijkt een scherm hiervan af,
dan is dat een fout in het scherm, niet in dit document.

Status: **concept, wacht op akkoord.** Er wordt niets gebouwd tot dat er is.

---

## 1. De opdracht in één zin

Het moet voelen als een creatief marketinghoofdkwartier waar negen agents elkaar
werk doorgeven tot er iets af is — niet als een AI-tool die advertenties uitpoept.

Dat "tot er iets af is" is het zwaartepunt. Een systeem waarin agents losse taken
uitvoeren bestaat al overal. Het verschil zit erin dat je kunt zíen hoe een idee
van hand tot hand gaat en ergens uitkomt.

## 2. Wat vastligt

Uit de brief, niet onderhandelbaar:

| | |
|---|---|
| Palet | Daylight — `--paper #f4f1ea`, wit vlak, inkt `#16150f`, amber accent |
| Letters | Fraunces (display), Hanken Grotesk (tekst), JetBrains Mono (cijfers) |
| Taal | Nederlands, ook in code-commentaar en foutmeldingen |
| Logica | ongewijzigd — presentatie mag anders, gedrag niet |

**Eén ding hoort daarbij gezegd.** De `frontend-design`-skill waarschuwt voor drie
looks waar AI-ontwerp standaard in vervalt. De eerste is: warme crème rond
`#F4F1EA`, serif-display met hoog contrast, amber/terracotta accent. Dat is
precies Daylight.

De brief pint dit vast en de brief wint — het is het merk, en er mag niets
verloren gaan. Maar het betekent wel dat de eigenheid niet uit het palet kan
komen. Die moet ergens anders vandaan, en dat is regel 3.

## 3. Het signatuur: de estafette

**De eenheid van de interface is niet de agent. Het is het werkstuk.**

Dit is de enige plek waar het ontwerp uitgesproken mag zijn; overal elders is het
rustig en gedisciplineerd.

Het templateantwoord voor een agent-systeem is een raster van agentkaarten met
statusbolletjes, plus een chronologische feed. Dat toont negen wezens die iets
doen, maar nooit dat ze sámen ergens uitkomen. Precies wat hier het belangrijkst
is, valt dan buiten beeld.

Dus draaien we het om. Het object op het scherm is één stuk werk — een idee, een
advertentie, een campagne — en je ziet aan welke handen het is geweest en waar
het nu ligt:

```
  WERKSTUK  "Scheerirritatie in de nek" · Man 30-45 · Problem-Solution

  ①────────②────────③────────④────────⑤────────⑥
  Radar    Nova     Pixel    Bolt     Atlas    Vector
  trend    brief    beeld    live     meting   landing
  ✓ ma     ✓ ma     ✓ di     ● nu     ○        ○
                             │
                             └─ 3 dagen live · EUR 62 · ROAS 2,1
                                nog niet beoordeelbaar (4 dagen nodig)
```

De genummerde markering mag hier, want de inhoud ís een volgorde: je kunt niet
meten voor je gelanceerd hebt. (Bij een lijst die geen volgorde heeft, is
nummeren decoratie — en dan mag het niet.)

**Wat de referenties hieraan toevoegden**

Twee van de vier referenties (Crextio, NL Corp) bevatten dezelfde kaart: een
onboarding-lijst met vinkjes voor wat af is en grijze bollen voor wat nog komt.
Dat is de estafette, alleen verticaal en zonder de agents erbij — een vorm die
zichzelf al bewezen heeft. De estafette leent daarvan:

- **een afgeronde stap krijgt een vinkje, geen kleurverschil alleen** — dat is
  ook wat regel 4.4 eist
- **de teller staat erbij** ("2/8" bij Crextio). Bij ons: hoeveel stappen van de
  keten af zijn, zodat je in één blik ziet hoe ver iets is
- **wie het deed hoort erbij**, zoals de gezichten bij NL Corp. Bij ons is dat de
  agent

Traxen droeg iets anders bij: op de kaart staat een **route van A naar B**, geen
status op een moment. Dat is precies het verschil dat dit systeem moet maken. Een
werkstuk is onderweg, en die weg is zichtbaar — ook het stuk dat nog komt.

**Harde regels voor de estafette**

1. Elk werkstuk toont zijn volledige keten, ook de stappen die nog niet gebeurd
   zijn. Een lege stap is informatie: het laat zien waar het vastloopt.
2. Elke voltooide stap toont **wie** het deed en **wanneer**, en is aanklikbaar
   naar wat er toen besloten is.
3. De actieve stap toont waaróp gewacht wordt, in mensentaal. Niet "pending"
   maar "nog 1 dag tot beoordeelbaar".
4. Er is altijd een zichtbaar eindpunt. Een keten zonder eindpunt is een feed,
   en dat is precies wat dit niet moet worden.
5. De live-feed (`agent_events`) is de textuur van deze keten, geen eigen scherm.
   Losse gebeurtenissen horen bij het werkstuk waar ze over gaan.

**De negen agents en hun plek.** Ze bestaan alle negen al en dekken de keten
volledig:

| Agent | Rol | In de keten |
|---|---|---|
| Radar | Trend- & concurrentiescout | ① signaal uit de markt |
| Nova | Creative Director & strategie | ② briefing en pipeline |
| Pixel | Content creator (statics & UGC) | ③ beeld |
| Quill | Copywriter | ③ tekst |
| Bolt | Performance marketeer | ④ lancering en oordeel |
| Atlas | Data-analyst | ⑤ meting en terugkoppeling |
| Echo | E-mailmarketeer | ⑥ Klaviyo-campagne |
| Vector | Webdesigner | ⑥ landingspagina |
| Sage | SEO-specialist | ⑥ vindbaarheid |

## 4. Kleur — gemeten, niet aangenomen

Alle waarden hieronder zijn berekend tegen `--paper #f4f1ea`.

**Regel 4.1** Elke tekst haalt minstens **4,5:1**. Grote tekst (≥ 24px, of ≥ 19px
vet) mag op **3:1**. Geen uitzonderingen, ook niet voor "het is maar een hint".

Wat er nu niet aan voldoet en wat het wordt:

| Token | Nu | Ratio | Wordt | Ratio |
|---|---|---:|---|---:|
| `--ink-faint` | `#9a9488` | **2,67** | `#736e62` | 4,50 |
| `--amber-deep` | `#8a6a12` | **4,48** | `#896912` | 4,55 |
| `.wgp-groep` (van mij, gisteren) | `rgba(20,20,20,.45)` | **2,91** | `#6f6e6b` | 4,52 |

Die laatste is een fout die ik zelf heb ingebracht: een groepskop op 10px met
2,91:1. Die gaat mee in de eerste ronde.

**Regel 4.2** Amber (`#f2c53d`) is een **vlak, nooit een letter**. Als tekst op
papier haalt het 1,45:1 — onleesbaar. Als vlak met inkt erop haalt het 11,17:1,
en zo hoort het.

**Regel 4.3** Wit op amber is verboden (1,64:1). Op een amber vlak staat inkt.

**Regel 4.4** Kleur draagt nooit alléén betekenis. Statussen krijgen een woord of
een vorm ernaast. Rood/groen alleen is niet toegestaan — een op de twaalf mannen
ziet dat verschil niet.

**Regel 4.5** Nieuwe kleuren worden aan het tokenblok toegevoegd, niet in een
component gezet. Een rauwe hex in een component is een fout.

## 5. Typografie

**Regel 5.1** Fraunces alleen voor koppen en het ene grote getal dat ergens toe
doet. Niet voor labels, niet voor tabellen. Een display-letter die overal staat,
is geen display-letter meer.

**Regel 5.2** Ondergrens 12px voor alles wat gelezen moet worden. De enige
uitzondering: eyebrow-labels in kapitalen op 11px, met minstens 0,12em spatiëring
én 4,5:1. De console heeft nu labels op 10px op halve dekking; die gaan omhoog.

**Regel 5.3** Regelhoogte minstens 1,5 voor lopende tekst.

**Regel 5.4** Cijfers die vergeleken worden staan in JetBrains Mono met
`font-variant-numeric: tabular-nums`. Een ROAS-kolom die niet uitlijnt is niet te
scannen.

## 6. Ritme en dichtheid

Dit is een werkomgeving, geen landingspagina. Dicht, maar niet benauwd.

**Regel 6.1** Spatiëring uit één schaal: 8 · 12 · 16 · 24 · 32px. Geen tussenmaten.

**Regel 6.2** Eén rasterbreedte per scherm. Kaarten die net niet uitlijnen zijn de
snelste manier om iets amateuristisch te laten voelen.

**Regel 6.3** Progressieve onthulling: een scherm opent met het oordeel, niet met
de onderbouwing. Details staan ingeklapt. (Dit is precies wat `v10-review` op main
al goed doet.)

## 6b. Vakmanschap — het afwerkingsniveau

Uit de referenties overgenomen, want daar zijn ze allemaal goed in. Dit is het
verschil tussen "werkt" en "hier is aandacht aan besteed".

**Regel 6b.1** Hoekradius uit één schaal: 8px (chips, velden), 12px (kaarten),
18px (panelen en pop-ups), 999px (pillen). Geen tussenmaten.

**Regel 6b.2** Schaduw is zacht en dubbel: een haarscherpe rand van 1px plus een
brede, lage schaduw. Nooit één harde slagschaduw. Op papier:
`0 1px 2px rgba(22,21,15,.05), 0 8px 24px rgba(22,21,15,.05)`.

**Regel 6b.3** Een cijfer dat ertoe doet staat groot in Fraunces met een klein
label in kapitalen eronder — niet andersom. Het getal is de kop.

**Regel 6b.4** Een verandering ten opzichte van de vorige periode toont richting
in **vorm én woord**, niet in kleur alleen: `▲ 12% t.o.v. vorige maand`.

**Regel 6b.5** Status is een chip met het woord erin ("Live", "Wacht op akkoord",
"Gestopt"), zoals de referenties het doen. Een bolletje zonder tekst is geen
status.

**Regel 6b.6** De donkere zijbalk tegen het lichte canvas blijft. Dat is de
opbouw die de console al heeft, en die twee van de vier referenties bevestigen.

## 7. Beweging

**Regel 7.1** 150–300ms. Boven 500ms is het in de weg.

**Regel 7.2** Maximaal twee bewegende elementen per scherm.

**Regel 7.3** Beweging betekent iets, of is er niet. In dit systeem is er precies
één plek waar beweging expressief mag zijn: **de overdracht van de ene agent naar
de volgende in de estafette.** Dat is het hart van de opdracht, dus dat mag je
zien gebeuren. Al het andere beweegt functioneel of niet.

**Regel 7.4** `prefers-reduced-motion` wordt gerespecteerd. Wie dat aan heeft
staan, krijgt de overdracht als toestandswissel zonder animatie — niet als niets.

**Regel 7.5** Geen `width`/`height` animeren. `transform` en `opacity`.

## 8. Agents zichtbaar en eerlijk

**Regel 8.1** Wat een agent schreef is gemarkeerd als door een agent geschreven.
Nooit gepresenteerd alsof een mens het typte.

**Regel 8.2** Wachten wordt gestreamd of getoond met voortgang, niet met een
spinner die tien seconden staat. Een agent die denkt, laat zien waar hij is.

**Regel 8.3** Elke naar-buiten-actie (budget, campagne live, e-mail versturen)
verschijnt als een rij die op een mens wacht, en is als zodanig herkenbaar.
Dit is de bestaande guardrail; het ontwerp moet hem tonen, niet verbergen.

**Regel 8.4** Een mislukte run is zichtbaar, met de fout in mensentaal en wat de
volgende poging is. Stil falen is de ergste uitkomst.

**Regel 8.5** Cijfers waar een oordeel op rust, tonen waaróp ze rusten. "ROAS 4,1
over 6 advertenties", niet "ROAS 4,1". Een getal zonder noemer is een mening.

## 9. Eén laag, geen twaalfde

De console draagt nu elf gestapelde skin-lagen. `v6-daylight` alleen heeft 207
`!important` op 563 regels; de basis heeft er 29 op 3.721. Die lagen bestaan niet
om iets te doen, maar om de laag eronder te overstemmen.

**Regel 9.1** Nieuwe UI komt niet als laag twaalf. Er komt één stijllaag die de
elf vervangt.

**Regel 9.2** `!important` is verboden in nieuwe CSS. Komt het toch voor, dan is
dat het bewijs dat er iets onder staat dat weg had gemoeten.

**Regel 9.3** De opruiming gaat scherm voor scherm, niet in één klap. Een scherm
is "om" als het geen enkele regel uit de oude lagen meer nodig heeft.

## 10. Terugwerkende kracht — en hoe "niets verloren" wordt bewezen

De regels gelden ook voor de vijftien bestaande tabbladen. Presentatie mag anders,
**logica blijft identiek**. Dat is geen belofte maar een controle.

Bij het opsplitsen van de console is daar een methode voor gebouwd, en die wordt
hier hergebruikt. Voor elk scherm dat op de schop gaat:

```
node ad-generator/test/console-boot.cjs pad/naar/vorige-versie.html
```

Dat vergelijkt oud en nieuw in een echte browser. Wat **identiek moet blijven**:

- elke element-id (de aangrijpingspunten van alle logica)
- elke functie die de HTML aanroept, aanwezig op `window`
- geen enkele nieuwe JavaScript-fout bij het opstarten

Wat **mag verschillen**: de DOM-structuur, de klassen, de berekende stijlen, de
volgorde op het scherm. Dat is precies de scheidslijn die jij trok.

**Regel 10.1** Een scherm gaat niet naar main zonder dat die vergelijking gedraaid
is en de eerste drie punten gelijk zijn.

**Regel 10.2** Voor gedrag dat niet uit een opstart-vergelijking blijkt (een flow
met kliks) komt er een testlus zoals `test/wizard-angles.cjs`, vóór de verbouwing,
zodat je kunt bewijzen dat hij daarna nog hetzelfde doet.

## 11. Wat dit contract niet regelt

- **Welke schermen er komen.** Dat is de bouwvolgorde, niet het ontwerp.
- **De inhoud van de agentprofielen.** Die staan in `marketing-hq/agents/`.
- **Het donkere thema.** Bestaat nu niet; als het komt, is dat een eigen ronde met
  eigen gemeten contrastwaarden.

## 12. De referenties — wat is overgenomen en wat niet

Vier dashboards aangeleverd: Traxen (vrachtvervoer, donker), Crextio (HR, warm
licht), NL Corp (HR, crème met donkere zijbalk), Shopeers (e-commerce, wit met
blauw).

**Overgenomen**

| Uit | Wat | Waar het landt |
|---|---|---|
| Crextio, NL Corp | de afvinkreeks met stappen, vinkjes en een teller | regel 3, de estafette |
| Traxen | het traject van A naar B in plaats van een status op een moment | regel 3, de estafette |
| alle vier | het afwerkingsniveau: radius, schaduw, chips, groot getal met klein label | regel 6b |
| Crextio, NL Corp | warm palet met geel/amber accent, donkere zijbalk op licht canvas | bevestigt regel 2 |

**Niet overgenomen, met reden**

- **Het donkere thema van Traxen.** Besloten: Daylight blijft licht. Donker zou
  elke gemeten contrastwaarde ongeldig maken en alle vijftien bestaande tabbladen
  raken — en v6 ging juist bewust van donker naar licht.
- **Het acid-groene accent.** Naast dat het botst met amber, is dat de tweede
  look waar de `frontend-design`-skill voor waarschuwt.
- **Het KPI-kaartraster als hoofdindeling.** Alle vier de referenties openen met
  vier tegels met een groot getal. Prachtig gemaakt, maar je ziet er losse cijfers
  en nooit dat er iets van hand tot hand gaat. Dat is precies de eis die dit
  systeem wél moet halen. Losse cijfers mogen bestaan, maar niet als het
  organiserende principe van het beginscherm.
- **De widget-kiezer van Shopeers.** Besloten: niet doen. Pas zinvol als er
  genoeg te kiezen valt, en het verplaatst een ontwerpkeuze naar de gebruiker
  voordat we die keuze zelf goed hebben gemaakt.

**Wat in geen van de vier zat.** Het zijn showcase-beelden: volle, perfecte data.
Geen lege staat, geen fout, geen wachten. Bij een agentsysteem is dat juist een
groot deel van wat er op het scherm staat — een agent die faalt, een keten die
stilligt, een dag zonder data. Die staten zijn hier niet uit af te kijken en
moeten we zelf goed doen. Zie regel 8.4.

## 13. Waarom het gereedschap niet klakkeloos is gevolgd

`ui-ux-pro-max` gaf op de eerste vraag roze (`#EC4899`) met Fredoka — een
letter voor kinder-apps — en parallax-scroll. Dat is niet overgenomen: de zoekterm
"creative" werd te letterlijk gelezen.

Op een betere vraag kwam **Swiss Modernism 2.0**: rastersysteem, editorial, WCAG
AAA, uitstekende prestaties. Dat is wél de richting, en de aanbevolen typografie
(een warme editorial serif naast een grotesk, voor "analytics dashboards,
marketing tools, operations platforms") is exact het archetype dat de console al
heeft met Fraunces + Hanken Grotesk.

Het gegenereerde palet is bewust **niet** opgeslagen als `design-system/MASTER.md`.
Dat zou een tweede waarheid maken die het merk tegenspreekt. Dit document is de
bron.
