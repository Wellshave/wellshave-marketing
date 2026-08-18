# Analytics & Launch — audit en plan

Oplevering vóór de bouw, zoals gevraagd: eerst weten wat er is, dan pas
schermen. Peildatum **6 augustus 2026**, gemeten op productie
(`bequyhghgkvekvibufhw`), niet op een lokale kopie.

---

## 1. Data-audit

### 1.1 De hoofdconclusie

De opdracht beschrijft een regiecentrum dat draait op prestatiedata per
creative. **Die data bestaat vandaag niet.** Niet gedeeltelijk, niet verouderd —
nul rijen.

```
meta_insights_daily      0 rijen      ← hier hoort alles in te staan
meta_publications        0 rijen
meta_recommendations     0 rijen
ad_results               0 rijen
learnings                0 rijen
criticus_oordelen        0 rijen
```

`meta_insights_daily` is de enige tabel in het systeem met `ctr`, `cpc`, `cpm`,
`purchases`, `purchase_value`, `roas`, `reach`, `frequency`, video-cijfers en
Meta's kwaliteitsrankings — en met een `level`-kolom die account, campagne,
adset en ad uit elkaar houdt. Elke view die de opdracht nodig heeft, hangt
eraan. Vandaar:

```
dagbesluit                0      creative_performance     0
ad_totals                 0      creative_results         0
advertentie_scorekaart    0      creative_vergelijking    0
trechter                  0      creative_verloop         0
publicatie_per_ad         0      hoek_scheef              0
angle_learnings           0
```

Dat zijn precies de blokken Winners, High Potential, Underperformers, Top Spend,
Top Performing en Breakdowns. Ze bestaan als code en zijn leeg als data.

### 1.2 De oorzaak: twee fouten in de draaiende worker

De worker `marketing-ads` (Cloudflare, laatst gewijzigd 4 augustus) haalt de
cijfers op. Ik heb de **gepubliceerde** code opgehaald en vergeleken met de
broncode in deze repo. Er zitten twee fouten in, en ze zijn niet dezelfde fout.

**Fout 1 — `date_preset` in plaats van `time_range`.**
De live worker bouwt het venster als `'last_' + days + 'd'`. Meta accepteert
maar zes vaste waarden (`last_3d`, `last_7d`, `last_14d`, `last_28d`,
`last_30d`, `last_90d`). Vraagt Atlas vier dagen — normaal, want de attributie
loopt na — dan wordt dat `last_4d` en weigert Meta het verzoek.
*In de broncode is dit al opgelost* (`metaVenster()` → `time_range` met
expliciete `since`/`until`), maar **die versie is nooit uitgerold.**

**Fout 2 — een veld dat niet meer bestaat.**
De veldenlijst bevat `video_3_sec_watched_actions`. Dat veld is uit de Graph API
verwijderd; de worker praat met **v21.0**. Eén ongeldig veld laat het hele
insights-verzoek stuklopen — ook bij `last_7d`, dus ook wanneer fout 1 niet
speelt. **Deze fout staat nog in de broncode**, op regel 887 en 938 van
`platform/worker/marketing-os.worker.js`.

Dit is belangrijk voor de volgorde: alleen de worker uitrollen lost het níet op.
Fout 2 moet eerst weg, anders blijft de teller op nul staan en lijkt het alsof
de deploy niets deed.

Atlas heeft dit zelf correct gediagnosticeerd. Uit zijn rapport van vanochtend:

> Fields-fout (video_3_sec_watched_actions) en date_preset-fout ongewijzigd
> sinds 5/8. Connectorfout, geen accountprobleem.

### 1.3 Het meetgat

`meting_dekking` geeft 60 rijen — 30 dagen × 2 accounts — en **alle 60 staan op
`ontbreekt`**. Laatste gemeten dag: **26 juli**. Dat is elf dagen geleden.
Atlas schat de ongemeten spend op €1.700–2.800 en zegt er expliciet bij dat dat
een extrapolatie is en geen meting.

### 1.4 Wat er wél is

**`metrics_daily` — 101 rijen, maar smal.** Alleen op accountniveau, en alleen:

| metric | dekking |
|---|---|
| `spend` | 2 accounts, 3 jul – 26 jul |
| `roas` | 2 accounts, 3 jul – 26 jul |
| `spend_advertorial`, `roas_advertorial`, `roas_3d_advertorial`, `roas_groomguard_cbo`, `roas_groomguard_new` | 1 account, losse dagen |
| `emails_sent` | 3 dagen, allemaal waarde 0 |

Geen revenue, geen CPA, geen CTR, CPC, CPM, purchases, conversion rate. Van de
negen kernmetrics uit de opdracht zijn er dus **twee** te vullen, en die zijn elf
dagen oud. Bovendien schrijven twee bronnen (`meta` en `meta_ads`) overlappend
in dezelfde tabel — dat moet eerst ontdubbeld worden, anders telt 23 juli dubbel.

**`creatives` — 7 rijen, geen enkele met cijfers.**

| gevuld | leeg |
|---|---|
| persona 7/7, product 7/7, angle_type 7/7, marketing_angle 7/7, awareness_level 7/7, media_type 7/7 | budget, impressions, roas, cpa, ctr, cpc, cpm, conversions, cvr, hook_rate, hold_rate, date_live — **alle 0/7** |
| format 4/7, creative_concept 4/7, hook_short 1/7 | desires, channel, audience, funnel_stage, placement, hypothesis, test_variable, score, target_roas, breakeven_roas — **alle 0/7** |

Alle zeven staan op `To Test`. Er is dus geen enkele creative live, en zonder
`date_live` is "aantal dagen live" niet af te leiden.

**Wat wél gevuld is en direct bruikbaar:**

```
reports                27 rijen   met cijfers/signalen/gaten als jsonb
agent_events          289 rijen
agent_runs             51 rijen
atlas_dagrapport       15 rijen
brein_dag              15 rijen
bolt_voorstellen        3 rijen
criticus_werkvoorraad   1 rij
publiek_verzadiging     4 rijen
lus_per_hoek            3 rijen
meting_dekking         60 rijen   (allemaal 'ontbreekt' — dat is de boodschap)
werkbank                3 rijen
testkaart               7 rijen
creative_dossier        7 rijen
accounts_overzicht      5 rijen
products               16 · personas 8 · team_members 2
```

`reports.cijfers`, `reports.signalen` en `reports.gaten` zijn gestructureerde
jsonb, geen losse tekst. Signalen hebben `naam`, `waarde`, `richting`
(op/neer/vlak) en `toelichting`. **Dat is de echte bron voor de
agentinterpretatie uit hoofdstuk 8 van de opdracht** — geen los AI-antwoord, maar
opgeslagen conclusies met onderbouwing en een expliciete gatenlijst.

**Agents.** Operationeel: Atlas, Nova, Radar, Bolt, Echo — alle vier de eersten
draaiden vanochtend nog. Niet operationeel: **De Criticus**, Pixel, Quill, Sage,
Vector. De opdracht vraagt om een Criticus-oordeel bij de best presterende
creative; die agent draait niet en `criticus_oordelen` is leeg.

### 1.5 Wat dit betekent per hoofdstuk van de opdracht

| Hoofdstuk | Kan nu | Waarom |
|---|---|---|
| 1 Vraagbalk | **deels** | Atlas kan antwoorden over meting en werkstukken, niet over performance |
| 2 Kernmetrics | **2 van 9** | alleen spend en roas, accountniveau, 11 dagen oud |
| 3 Creative Decisions | **nee** | 0 creatives met cijfers, geen `date_live` |
| 4 Creative Diversity | **ja, op aantal** | tags zijn gevuld; wegen op spend/ROAS kan niet |
| 5 Top Creative Tags | **deels** | tags bestaan, de metrics om op te wisselen niet |
| 6 Breakdowns | **nee** | leeftijd/geslacht/platform/placement/land worden niet eens opgehaald |
| 7 Top Spend / Top Performing | **nee** | 0 rijen |
| 8 Agentinterpretatie | **ja** | `reports` is gevuld en gestructureerd |
| 9 Launch | **deels** | creatives, testkaart, approvals en pipeline wel; publicatiestatussen niet |
| 10 Dagbesluit | **ja, eerlijk** | vandaag luidt het besluit: er is niets te besluiten |
| 11 Drill-down | **ja** | dossier, werkstuk en testkaart bestaan al |

### 1.6 Wat ik niet ga doen

Voorbeelddata plaatsen zodat de schermen vol lijken. Een regiecentrum dat
verzonnen winnaars toont is erger dan geen regiecentrum: het nodigt uit tot
budgetbeslissingen op fictie. Waar data ontbreekt komt een expliciete lege staat
met de reden, de bron en de eerstvolgende handeling — conform regel 0.4 van het
ontwerpcontract.

---

## 2. Informatiearchitectuur

Eén werkruimte **Analytics & Launch**, twee hoofdweergaven, elk met één
beslisvraag (ontwerpcontract regel 0.1).

```
Analytics & Launch
├── Analytics      Beslisvraag: wat moet er vandaag met het geld gebeuren?
│   ├── Dagbesluit          wat vandaag telt, in vijf regels
│   ├── Meetstaat           kan ik hier überhaupt op sturen?
│   ├── Vraagbalk           vraag het Atlas
│   ├── Kernmetrics         hoe staan we ervoor
│   ├── Creative Decisions  winnaars · potentie · verliezers
│   ├── Diversiteit         maken we steeds dezelfde advertentie?
│   ├── Tags                waar zit het geld en wat levert het op
│   ├── Breakdowns          waar zit het verschil
│   └── Top Spend / Top Performing
└── Launch         Beslisvraag: wat gaat er vandaag de deur uit, en wat houdt dat tegen?
    ├── Wacht op mij        menselijke goedkeuring
    ├── Klaar voor publicatie
    ├── Gepland · Live
    └── Geblokkeerd · Gestopt · Publicatiefouten
```

**Meetstaat staat bewust hoog.** Niet als foutmelding, maar als
betrouwbaarheidsstempel op alles eronder. Zolang het meetgat elf dagen is, moet
dat de eerste zin zijn die iemand leest — anders leest hij de cijfers eronder als
waarheid van vandaag.

**Volgorde van de lagen:** besluit → betrouwbaarheid → vraag → cijfer → creative
→ verdieping. Nooit andersom. De opdracht vraagt begrip binnen tien seconden;
dat haal je alleen als het besluit bovenaan staat en het bewijs eronder.

**Regel voor het hele scherm:** één bron van waarheid. Alles leest uitsluitend
`public.hq_*`-views. Geen enkele component rekent zelf een ROAS uit, want dan
staat er straks een ander getal in Analytics dan in het dossier.

---

## 3. Wireframebeschrijving

Desktop 1440px+. Donkere zijbalk blijft; alles hieronder is het werkvlak.

### 3.1 Dagbesluitbalk — vol, boven alles

Eén band over de volle breedte, hoogte ~96px. Links de datum en de auteur
(`Atlas · 6 augustus · voorlopig`). Rechts vier tot zes telbare besluiten als
klikbare chips:

```
2 winnaars verdienen opschaling · 4 wachten op data · 3 moeten stoppen
1 angle verdient iteratie · 2 publicaties wachten op akkoord
```

Elke chip is een filter op het scherm eronder, geen decoratie. Is een teller nul,
dan verdwijnt de chip — geen rij nullen.

**Vandaag** toont die balk: *"Geen besluit mogelijk — de meting staat elf dagen
stil"*, met één knop: naar de meetstaat. Dat is de eerlijke uitkomst, en hij is
uitvoerbaar.

### 3.2 Meetstaat — smalle strook eronder

Een horizontale strook van 30 dagvakjes per account. Gemeten = gevuld,
definitief = gevuld met randje, ontbreekt = leeg met diagonale arcering (vorm,
niet alleen kleur). Rechts in woorden: *"Laatste meting 26 juli · 10 dagen zonder
data · beide accounts"*. Klik → de gatenlijst van Atlas met de reden per gat.

### 3.3 Vraagbalk

Compact invoerveld, één regel hoog, met zes voorgestelde vragen als chips
eronder. Het antwoord verschijnt in een kaart met vier vaste kopjes:
**Conclusie · Bewijs · Onzekerheid · Aanbevolen actie.** Nooit een lopende
tekst. Onder Bewijs staan klikbare verwijzingen naar de onderliggende rijen.
Ontbreekt de data, dan is Onzekerheid het langste blok — en dat is een correct
antwoord.

### 3.4 Kernmetrics

Rij van kaarten, horizontaal scrollend, ~200px breed. Per kaart:

```
┌──────────────────────┐
│ Spend                │  label klein
│ €2.463               │  JetBrains Mono, groot
│ ▲ 12% t.o.v. vorige  │  richting in vorm én woord
│ ╱╲╱‾╲╱               │  sparkline, 14 dagen
│ hoger dan vorige week│  status in gewone taal
└──────────────────────┘
```

Metrics zonder bron krijgen geen kaart met een streepje, maar staan verzameld in
één grijze kaart aan het eind: *"CPA, CTR, CPC, CPM, purchases en conversion rate
wachten op de Meta-koppeling"* met een link naar de meetstaat. Dat scheelt zes
lege kaarten en zegt precies hetzelfde.

### 3.5 Creative Decisions — het zwaartepunt

Drie kolommen naast elkaar op 1440px, onder elkaar daaronder. Elke kolom heeft
een kop met telling en een korte regel die de drempel noemt.

```
WINNAARS (2)                 POTENTIE (4)                 VERLIEZERS (3)
boven doel, betrouwbaar      sterk signaal, nog te vroeg  onder doel

┌───────────────────────┐
│ ▣ beeld  WSDG-179-2   │   ← preview links, 88px, altijd zichtbaar
│ Groom Guard · Mark    │
│ safety · static 4:5   │
│ ─────────────────────  │
│ ROAS 3,11   CPA €18   │   ← mono, uitgelijnd
│ €54,94      9 dagen   │
│ ─────────────────────  │
│ ● zeker (4 dagen,     │   ← confidence in woorden
│   €300, 3 ads)        │
│ → Opschalen naar €75  │   ← één primaire actie
│   Bolt · bekijk waarom│
└───────────────────────┘
```

Bij **Potentie** vervangt een voortgangsregel het verdict: *"mist nog €212 spend
en 2 dagen"* met een balkje. Het woord "winnaar" komt in die kolom niet voor.

Bij **Verliezers** staat de schuldige metric bovenaan met de vermoedelijke
oorzaak in één woordgroep: *"CTR 0,41% — hook"*, *"CVR 0,3% — landingspagina"*.
Daaronder de keuze stoppen óf itereren, met de reden waarom die kant op.

**Vandaag zijn alle drie de kolommen leeg.** De lege staat is geen witruimte maar
een kaart per kolom: wat de drempel is, hoeveel creatives eraan toe zouden zijn,
en wat er moet gebeuren om het te weten.

### 3.6 Diversiteit

Links een cirkelmeter met één getal en een woordoordeel. Rechts tien dimensies
als balkjes, elk verdeeld in segmenten per waarde. Onder elke dimensie één woord:
*oververtegenwoordigd · ondervertegenwoordigd · goed verspreid · niet getest*.
Klik op een segment → de creatives erachter.

Onder de meter een zin van Nova, opgebouwd uit de werkelijke telling:
*"5 van de 7 creatives gebruiken dezelfde problem-aware angle. Social proof is
nog niet getest."*

Zolang er geen spend is, weegt deze sectie op **aantal**, en dat staat er
letterlijk bij: *"geteld op aantal creatives, niet op spend"*.

### 3.7 Tags, Breakdowns, Top Spend, Top Performing

Alle vier hetzelfde patroon: een keuzeknop voor de maat (Spend · Revenue · ROAS ·
CPA · Winrate · Aantal tests), een compacte visualisatie, en klikbare elementen
die naar de creativegroep leiden. Geen enkele van deze vier krijgt een grafiek
zolang de onderliggende maat ontbreekt — dan staat er de lege staat met de reden.

### 3.8 Agentinterpretatie

Onder elk belangrijk blok een strook met de agentnaam, één conclusie, en een
ingeklapte onderbouwing. Vast stramien:

```
Atlas · zeker van 3 van de 5 signalen
De ROAS-daling komt door drie nieuwe creatives met spend en zonder conversies.
[bekijk onderbouwing]  → Aanbevolen: pauzeer WS-201-2 tot morgen
```

Uitgeklapt: bewijsregels met bron, de gatenlijst, en eventueel het tegenargument
van een andere agent. Die tegenargumenten bestaan al als `agent_messages`.

### 3.9 Launch

Tabel die op smalle schermen kaarten wordt, gegroepeerd op status in de volgorde
van de opdracht. Meest linkse kolom is altijd de preview. Groepsacties alleen op
interne stappen (toewijzen, naar werkbank sturen, naming toepassen). Publiceren
en budget wijzigen blijven per stuk en achter menselijke goedkeuring — die grendel
zit al in de database en gaat er niet uit.

---

## 4. Componentstructuur

Zelfde patroon als de bestaande modules: genummerde bestanden, functies met een
vast voorvoegsel, geen bundler.

```
ad-generator/app/js/36-analytics.js      voorvoegsel  an
ad-generator/app/js/37-launch.js         voorvoegsel  la
ad-generator/app/css/19-analytics.css
```

**Datalaag (`anBron`)** — één plek die leest, alles via `public.hq_*`:

| functie | leest | levert |
|---|---|---|
| `anDagbesluit()` | `hq_reports` (laatste `daily`) | besluit, tellers, auteur, voorlopig-vlag |
| `anMeetstaat()` | `hq_meting_dekking` | 30 dagen × account, gat in dagen |
| `anMetrics(dagen)` | `hq_metrics_daily` | per metric: waarde, vorige periode, reeks |
| `anCreatives()` | `hq_testkaart` | 25 velden per creative, inclusief koppeling |
| `anVerdicts()` | `hq_advertentie_scorekaart` | oordeel per ad met drempels |
| `anDiversiteit()` | `hq_testkaart` | telling per dimensie |
| `anAgentzicht(blok)` | `hq_reports`, `hq_agent_messages` | conclusie, bewijs, gaten, tegenargument |
| `laItems()` | `hq_meta_publications`, `hq_approvals`, `hq_pipeline_items` | per status |

Elke functie geeft óf rijen, óf een `leeg`-object met `reden`, `bron` en
`volgende_stap`. De UI kent daardoor maar één lege staat en verzint er nooit één.

**Weergavelaag** — kleine, testbare functies:

```
anKaart(metric)          anBeslisKolom(soort, rijen)   anCreativeKaart(r)
anSparkline(reeks)       anVoortgang(nu, doel)         anDiversiteitsBalk(dim)
anLeeg(reden, stap)      anAgentStrook(blok)           anChip(tekst, filter)
anDrill(soort, id)       anRichting(nu, vorig)         anMaatKiezer(maten)
```

`anRichting()` levert altijd een drieluik terug — teken (`▲`/`▼`/`▬`), woord
("hoger dan"), en klasse — zodat richting nooit alleen kleur is. Dat is één
functie en dus één plek om te toetsen.

**Sparkline** in inline SVG, geen bibliotheek. Balken en verdelingen ook. Dat
past bij de rest van de console en houdt de bundel klein.

**Tests** in het bestaande patroon:
`ad-generator/test/analytics.cjs` (Playwright: contrast ≥ 4.5:1, geen losse hex,
lege staten aanwezig, richting altijd met woord, geen `[object Object]`) en
`platform/db/test/analytics.sh` voor nieuwe views. Mutatietoets verplicht: elke
test moet rood worden als ik de bijbehorende regel sloop.

---

## 5. Implementatievolgorde

**Stap 0 — de meting repareren. Vóór alle schermwerk.**

1. `video_3_sec_watched_actions` uit de veldenlijst (regel 887 en 938).
2. De worker uitrollen zodat `time_range` live komt.
3. Atlas één keer handmatig laten ophalen, `level=ad`, `breakdown_by_day=true`.
4. Controleren dat `meta_insights_daily` rijen krijgt en `meting_dekking`
   omslaat naar `gemeten`.

Zonder deze stap bouw ik een regiecentrum boven een lege tabel. Met deze stap
vullen zes van de zeven lege blokken zichzelf, want de views bestaan al.

**Stap 1 — Analytics-casco.** Weergavewissel Analytics/Launch, dagbesluitbalk,
meetstaat, agentstrook, lege staten. Werkt met de data van vandaag.

**Stap 2 — Kernmetrics + vraagbalk.** Eerst met spend en roas; de rest schuift
erin zodra stap 0 landt, zonder dat de component verandert.

**Stap 3 — Creative Decisions.** Het zwaartepunt. Drempels uit `0008` blijven
leidend: beoordeelbaar bij ≥4 dagen, ≥€50 en ≥1000 impressies; betrouwbaar bij
≥3 ads en ≥€300.

**Stap 4 — Diversiteit** (op aantal, direct te bouwen) **en Tags** (wacht op de
maat).

**Stap 5 — Breakdowns.** Vraagt eerst uitbreiding van de worker met Meta's
`breakdowns`-parameter; die wordt nu helemaal niet meegestuurd.

**Stap 6 — Launch.** Kan deels nu, wordt compleet zodra er gepubliceerd wordt.

**Stap 7 — De Criticus operationeel maken.** Acceptatiecriterium 4 vraagt een
agentinterpretatie bij elke visualisatie; de Criticus is de enige die er niet is.

---

## 6. Wat direct gebouwd kan worden

Met de data van vandaag, zonder één verzonnen waarde:

- **Dagbesluitbalk** — uit `reports`, inclusief de voorlopig-vlag en de reden.
- **Meetstaat** — uit `meting_dekking`, 60 rijen, vandaag volledig rood en
  daarmee het belangrijkste bericht op het scherm.
- **Vraagbalk** — Atlas kan vandaag antwoorden over meting, werkstukken,
  diversiteit en voorraad; over performance zegt hij eerlijk dat hij het niet weet.
- **Kernmetrics, twee kaarten** — spend en roas, met de datum erbij en de
  ouderdom als waarschuwing. Plus één kaart die de zeven ontbrekende benoemt.
- **Creative Diversity** — tien dimensies, geteld op de zeven creatives, met de
  telmaat er expliciet bij.
- **Agentinterpretatie** — vier operationele agents, 27 rapporten met
  gestructureerde cijfers, signalen en gaten.
- **Launch, drie statussen** — klaar voor publicatie, wacht op goedkeuring,
  geblokkeerd, uit `creatives`, `testkaart`, `approvals` en `pipeline_items`.
- **Drill-down** — dossier en werkstuk bestaan al en zijn al gekoppeld.
- **Lege staten** voor alles wat hieronder staat.

## 7. Wat wacht op nieuwe data

| Onderdeel | Wacht op | Beschikbaar na |
|---|---|---|
| Winners / High Potential / Underperformers | prestatiecijfers per creative | stap 0 + eerste live creative |
| CPA · CTR · CPC · CPM · purchases · conversion rate · revenue | `meta_insights_daily` | stap 0 |
| Top Spend · Top Performing | idem | stap 0 |
| Top Creative Tags (wegen op een maat) | idem | stap 0 |
| Breakdowns leeftijd · geslacht · platform · placement · land | worker moet `breakdowns` meesturen | stap 5 |
| "Aantal dagen live" | `date_live` wordt nergens gevuld | eerste publicatie |
| Winrate per tag | meerdere afgeronde tests | later |
| Criticus-oordeel bij de beste creative | Criticus draait niet | stap 7 |
| Landingspagina-tab in Top Performing | Vector draait niet, geen LP-data | later |
| E-mailprestaties | `email_performance` leeg, `emails_sent` staat op 0 | Echo koppelen |
| Publicatiefouten in Launch | `meta_publications` leeg | eerste publicatie |

---

## 8. Toets aan de acceptatiecriteria

Criteria 1, 2, 5, 6 en 7 zijn vandaag niet haalbaar op inhoud — niet door het
ontwerp, maar doordat de meting stilstaat. Wat wél haalbaar is: het scherm zegt
binnen tien seconden **dat** het niet kan oordelen, waarom, en wat de
eerstvolgende handeling is. Dat is criterium 6 (geen definitief oordeel zonder
voldoende data) in zijn strengste vorm, en het is de enige eerlijke invulling van
criterium 1 zolang stap 0 niet gedraaid is.

Criteria 3, 4, 8, 9 en 10 zijn wel direct haalbaar en zitten in stap 1 tot 3.
