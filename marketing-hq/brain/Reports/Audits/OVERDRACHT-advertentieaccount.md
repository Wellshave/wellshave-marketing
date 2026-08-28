# 🔄 Overdracht — Wellshave® advertentieaccount

*Laatst bijgewerkt: vrijdag 28 augustus 2026 · account `242238038391551`*

> **Lees dit eerst als je een nieuwe sessie start op dit advertentieaccount.**
> Het volledige auditrapport staat in
> [[2026-08-23-wellshave-advertentieaccount|de audit van 23 augustus]].
> Dit document is de actuele stand plus de openstaande acties.

---

## ✅ Opgelost: ASC+ GroomGuard bestaat nog, maar is gearchiveerd

*Gecontroleerd 28 augustus 2026.*

Campagne `120236714475060577` (`⚫️ ASC+ - Scale Campaign - GroomGuard`) **bestaat
nog steeds**. Status: `ARCHIVED`, zowel `status` als `effective_status`. Alle
historische data is intact: **€19.948,58 totale spend op ROAS 2,15** over de
looptijd.

**Wat er werkelijk is gebeurd.** Uit het activiteitenlogboek:

> Dustin Gibson, **26 augustus 08:16**, via Power Editor.
> Campagnestatus `Active` → `Deleted` (`run_status` 1 → 3).

De campagne is niet op 24 augustus verdwenen. Hij liep gewoon door, kreeg op
24 augustus om 11:43 nog een budgetverhoging, en is pas **twee dagen later**
uitgezet. De waarneming van 24 augustus was een leesartefact, geen gebeurtenis.

**Vermoedelijk per ongeluk meegenomen.** Tussen 08:16 en 08:17 op 26 augustus
zijn in één handeling **tien campagnes** op Deleted gezet. Negen daarvan stonden
al op `Inactive`. ASC+ GroomGuard was **de enige actieve campagne in die selectie**.
Dat patroon past bij een opruimactie waarbij een lopende campagne mee is
geselecteerd, niet bij een bewust besluit. Dit is het eerst te verifiëren punt
bij Dustin: was dit bedoeld?

**Waarom de API hem leek te verbergen.** `ads_get_ad_entities` sluit gearchiveerde
en verwijderde objecten standaard uit, en het `object_id`-filter op het
activiteitenlogboek geeft niets terug voor een gearchiveerd object. Beide leken
daardoor te bevestigen dat de campagne weg was. Hij komt wél terug met een
expliciet statusfilter:

```
filtering = [{"field": "campaign.effective_status",
              "operator": "IN", "value": ["DELETED", "ARCHIVED"]}]
```

**Gebruik dit filter voortaan altijd voordat je concludeert dat een object weg is.**

### Wat er stillag, laatste 30 dagen

| | |
|---|---|
| Spend | €798,60 |
| ROAS | **2,45** (break-even 1,82) |
| Aankopen | 31 |
| CPA | **€25,76** (account ≈ €31,9) |
| CPM | €8,08 |
| CTR | 2,40% |
| Frequentie | 1,41 |

Op adsetniveau, laatste 30 dagen:

| Adset | ID | Spend | ROAS | Aank. | CPA |
|---|---|---|---|---|---|
| Winning Videos TOFU - New Vids | `120241779363390577` | €555,35 | **2,93** | 25 | €22,21 |
| Winning Videos TOFU - Old Vids | `120236714475070577` | €103,13 | **0,52** | 1 | €103,13 |
| Video Creatives - MOFU | `120241781506980577` | €78,14 | 2,62 | 4 | €19,54 |
| Video Creatives - MOFU - Copy | `120247010758170577` | €56,44 | 1,27 | 1 | €56,44 |

Eén adset draagt de campagne. "Old Vids" op 0,52 was de enige echte lek.

### De budgetladder, en wat die laat zien

| Datum | Budget | Spend | ROAS |
|---|---|---|---|
| 16 t/m 22 aug | €60 | €419,38 | **3,13** |
| 23 aug 09:01 → €80 | €80 | €73,16 | 1,97 |
| 24 aug 11:43 → €100 | €100 | €95,09 | 3,23 |
| 25 aug | €100 | €96,75 | 1,56 |
| 26 aug (afgebroken 08:16) | €100 | €12,63 | — |

Op €60 per dag draaide de campagne **3,13**, boven de schaalgrens van 2,92. Op
€80 tot €100 zakte hij naar ongeveer **2,2**, nog steeds ruim boven break-even
maar onder de schaalgrens. Dat is precies de decay-curve waarmee je de
schaalgrens vindt.

**Voorbehoud, en het is een belangrijk voorbehoud:** dit zijn drie dagen. Elke
budgetverhoging zet de campagne opnieuw in de leerfase, en de twee stappen
(60 → 80 → 100) zaten **27 uur uit elkaar** waar de methode 5 tot 10 dagen
voorschrijft. De dagelijkse ROAS springt bovendien van 0,40 naar 4,46 op
vergelijkbare spend, want bij 3 tot 4 aankopen per dag is één dag ruis. De
campagne is afgebroken vóór het beoordeelmoment van 31 augustus. De daling is
dus **suggestief, niet bewezen**.

### Eén advertentie draagt de hele campagne

Laatste 30 dagen, op advertentieniveau:

| Advertentie | ID | Spend | ROAS | Aank. | CPA | CTR |
|---|---|---|---|---|---|---|
| **WS - 103 - 2 - New Vid** | `120241779363400577` | €509,50 | **2,91** | **23** | €22,15 | 2,52% |
| WS - 138 - 2 - Copy | `120244205448260577` | €74,87 | 2,74 | 4 | €18,72 | 1,88% |
| WS - 138 - 2 - Copy (dubbel) | `120247010758200577` | €38,09 | 1,89 | 1 | €38,09 | 1,78% |
| WS-034 - 3 - ASC+ | `120236718822480577` | €90,06 | **0,00** | 0 | — | 2,08% |

`WS - 103 - 2 - New Vid` levert **23 van de 31 aankopen**, oftewel 74%, en 64% van
de spend. Dat is het bezit dat hier op het spel staat, niet de campagnehuls.
`WS-034 - 3 - ASC+` deed €90 zonder één aankoop.

### Advies bij heractiveren

De campagne is gearchiveerd, niet vernietigd. Alles staat er nog: vijf adsets,
ruim dertig advertenties, de volledige historie. Aanpak:

1. **Vraag Dustin eerst of het opzet was.** Als er een reden was (voorraad,
   marge, retouren) weegt die zwaarder dan deze cijfers.
2. **Herstart op €70 per dag, niet op €100.** €60 was bewezen op 3,13, €100 is
   niet eerlijk getest. €70 is één stap terug in het bewezen gebied en laat
   ruimte om volgens de methode te verhogen.
3. **Zet "Winning Videos TOFU - Old Vids" (`120236714475070577`) niet mee aan.**
   €103 spend, 1 aankoop, ROAS 0,52. Dat is de enige adset die geld kostte.
4. **Let op de einddatum.** `stop_time` staat op **26 augustus 08:24**. Die
   ligt in het verleden, dus zolang die blijft staan levert de campagne
   niets, ook niet als hij op actief staat. Haal de einddatum weg of zet hem
   vooruit. Dit is de meest waarschijnlijke reden dat een heractivering
   "lukt" maar er toch niets gebeurt.
5. **Daarna 7 dagen niet aanraken**, dan pas de volgende stap. Reken op een paar
   dagen wobbel, want na twee dagen stilstand gaat de campagne opnieuw de
   leerfase in. Twee dagen uit is wel veel milder dan het FlexGuard-geval.

**Als dearchiveren niet lukt.** Het activiteitenlogboek noemt de actie "Deleted"
terwijl het object zelf op `ARCHIVED` staat. Verschijnt de campagne in Ads
Manager alleen onder het filter "Verwijderd" en niet onder "Gearchiveerd", dan
is heractiveren niet mogelijk en moet je opnieuw opbouwen. Bouw dan **rond
`WS - 103 - 2 - New Vid` (`120241779363400577`)**, want daar zit de prestatie in.
De campagnehuls is vervangbaar, die ene video niet.

**Kosten van het stilstaan:** ongeveer €100 per dag aan spend op ROAS ~2,4, dus
grofweg €240 omzet per dag die niet gemaakt wordt. Sinds 26 augustus loopt dat op.

**Deze sessie kan dit niet uitvoeren.** De schrijftools zijn opnieuw afwezig,
zie "Wat de vorige sessie niet kon" onderaan. Heractiveren moet handmatig in
Ads Manager: filter op gearchiveerde campagnes, dearchiveer, zet het budget en
activeer.

---

## Stand van zaken

### Live, laatste 7 dagen (24 aug)

| Campagne | ID | Spend | ROAS | Aank. | CPA | Freq |
|---|---|---|---|---|---|---|
| Advertorial Pages | `120250501609280577` | €559 | **2,33** | 20 | €27,96 | 2,56 |
| 001 · CBO · GroomGuard MIJU | `120252205202730577` | €279 | 1,54 | 8 | €34,84 | 3,24 |
| 002 · CBO · BUNDLE SHAVE PACKAGE | `120253002360820577` | €239 | **0,85** | 2 | €119,40 | 2,15 |
| CBO · Test · GroomGuard NL-BE | `120249635909880577` | €107 | **0,38** | 1 | €107,44 | 2,11 |
| ⚫️ ASC+ · Scale · GroomGuard | `120236714475060577` | €799 | **2,45** | 31 | €25,76 | 🗄️ gearchiveerd 26 aug, zie boven |

### Belangrijkste gepauzeerde campagnes

| Campagne | ID | Spend totaal | ROAS | Aank. | CPA |
|---|---|---|---|---|---|
| ⚫️ ASC+ · Scale · FlexGuard | `120244545251850577` | €4.693 | **2,32** | 172 | €27,29 |
| 🟢 CBO · Head Shaver Deluxe · Test | `120245139347290577` | €1.050 | 0,83 | 16 | €65,65 |
| 🟢 CBO · Dual Groomer · Test | `120245139119230577` | €678 | 0,98 | 12 | €56,53 |
| TOFU · CBO · BladeBaroon | `120250425276860577` | €596 | 0,77 | 9 | €66,20 |

FlexGuard staat op dagbudget €70.

## Economie (bevestigd)

Uit de Profit Calculator, niet aangenomen:

- **Groom Guard: break-even ROAS 1,82, schaalgrens 2,92**
- Kill-drempel die het team hanteert: **onder 1,27**
- Spreiding per product loopt van **1,82 tot 2,91**, dus elk product zijn eigen grens
- Head Shaver Deluxe: de test-tracker zet **2,03 break-even / 2,71 target** op de
  Head Shaver-regels. **Nog te bevestigen tegen de Profit Calculator.**
- Head Shaver AOV ≈ €54,25, dus doel-CPA ≈ **€26,72** (was €65,65)

Account-CPA ligt rond €31,9. Beslisregel per advertentie: **uit bij €64 zonder
aankoop, uit bij €96 met ROAS onder break-even.**

## Drie structurele bevindingen (MIJU-diagnose, 24 aug)

Deze verklaren het grootste deel van het verschil tussen winnaars en verliezers
in dit account.

1. **Alle zeven MIJU-adsets staan op `learning_exit_unsuccessfully`.** Dat is
   Meta's eigen label voor de leerfase verlaten zonder genoeg conversies. Elke
   adset die geld verdient in dit account staat op `active`. Perfecte scheiding.
   MIJU maakt 47 aankopen per maand en verdeelt die over zeven adsets; Meta
   heeft er 50 per adset per week nodig.
2. **MIJU draait op `VALUE`-optimalisatie, alle winnaars op
   `OFFSITE_CONVERSIONS`.** Waardeoptimalisatie vraagt méér conversiedata, niet
   minder. Gebruik `OFFSITE_CONVERSIONS` voor alles wat nieuw wordt opgezet.
3. **MIJU meet op `1d_view_7d_click`, de winnaars op
   `1d_view_7d_click_1d_ev`.** Zonder engaged view krijgt MIJU structureel
   minder conversies toegewezen. Zet dit gelijk bij nieuwe campagnes, anders
   vergelijk je met verschillende meetlatten.

Ter vergelijking, de vergelijking die alles zegt: WS-200 doet 48 aankopen in
**één** adset op ROAS 2,08 met CPM €5,41. MIJU doet 47 aankopen over **zeven**
adsets op 1,06 met CPM tot €16,66.

## Afspraken met Dustin

- **MIJU niet aanraken.** Die campagne ligt bij het bureau. Analyseren mag,
  wijzigen niet. Dit is expliciet afgesproken op 24 augustus.
- ASC+ GroomGuard is op 24 augustus door Dustin naar **€100 per dag** gezet en
  op **26 augustus gearchiveerd**, vermoedelijk per ongeluk. Het beoordeelmoment
  van 31 augustus is daarmee vervallen. Zie de sectie bovenaan: eerst bij Dustin
  verifiëren of dit opzet was, daarna heractiveren op €70.
- De WS-218-adset (`120252919944590577`) is uitgezet.

## Openstaande acties

### 1. FlexGuard ASC+ heractiveren, selectief

Campagne `120244545251850577` weer aan, maar **alleen deze twee adsets**:

| Adset | ID | Spend | ROAS | Aank. | CTR | Actie |
|---|---|---|---|---|---|---|
| FlexGuard Winning Videos | `120244545397650577` | €4.088 | **2,43** | 158 | 1,67% | **AAN** |
| WS-LP-106 - Kopie - Copy | `120247010574810577` | €149 | **2,74** | 5 | **4,69%** | **AAN** |
| WS-LP-134 - Copy | `120247010574780577` | €236 | 1,60 | 6 | 1,24% | uit laten |
| WSDG-165 | `120247890704770577` | €188 | **0,82** | 2 | 0,71% | uit laten |
| 6 restjes onder €12 | — | €32 | — | 1 | — | uit laten |

Eén adset draagt 87% van de spend en 92% van de aankopen. WS-LP-106 heeft de
hoogste CTR van het hele account maar kreeg nooit budget.

Aandachtspunten: de campagne staat sinds ongeveer eind mei uit, dus de adset
**gaat opnieuw de leerfase in**; reken op een week wobbel. Start op het
historische dagbudget van €70, niet hoger. Check of FlexGuard nog dezelfde
prijs en voorraad heeft, want die 2,43 is berekend op een AOV van ongeveer €63.

**Open vraag: waarom stond deze campagne uit?** Als daar een reden voor was
(voorraad, marge, retouren) weegt die zwaarder dan deze cijfers.

### 2. Head Shaver Deluxe lanceren, WS-219 t/m WS-228

**Let op: WS-218 hoort er niet bij.** Dat is Groom Guard, al gelanceerd, met
eigen landingspagina `wellshave.com/pages/groom-guard-ballon`, gedraaid op
ROAS 0,32. Nooit eerlijk getest, want hij liep in een adset die nooit uit de
leerfase kwam. Hoort thuis in de Groom Guard-structuur, niet in deze batch.

WS-219 t/m WS-228 zijn tien statics voor **Head Shaver Deluxe**, status
"Ready for launch", **landingspagina-kolom leeg**.

Awareness-indeling zoals Dustin die heeft gemaakt:

| Ad | Awareness | Bestemming (Nick Theriot) |
|---|---|---|
| 219, 220, 222 | Problem-aware | Advertorial |
| 221, 223, 224, 226 | Solution-aware | Listicle |
| 227 | Product-aware | Listicle of PDP |
| 225, 228 | Most-aware | PDP |

**Voorstel: golf 1 met vier advertenties, niet tien.**

```
Campagne  003 - CBO - TEST - Head Shaver Deluxe - <datum>
Doel      OUTCOME_SALES
Budget    €40/dag, CBO
Adset     HSD-problemaware-advertorial
Optimal.  OFFSITE_CONVERSIONS   (niet VALUE)
Attrib.   1d_view_7d_click_1d_ev
Targeting Breed NL/BE, geen interesses
Ads       219, 220, 222 (problem-aware) + 221 (solution-aware)
```

Vier advertenties op €40 krijgen elk €10 per dag en zijn binnen acht dagen te
beoordelen. Bij tien wordt dat €4 per dag per advertentie en duurt het drie
weken. Beslisregel hier: uit bij €55 zonder aankoop, uit bij €80 met ROAS
onder 2,03.

**Achterhouden:** 223, 224, 226 voor golf 2. En 225, 227, 228 zolang dit
product geen warm publiek heeft, want most-aware creative werkt niet voor een
product met 16 kopers in zijn hele bestaan.

**Blokkerend: er is geen landingspagina.** Met een lege URL-kolom gaan alle
tien naar de PDP, en voor problem-aware verkeer is dat precies de mismatch
waar Nick voor waarschuwt. Meta scant één niveau diep en gebruikt de pagina om
te bepalen aan wie het toont. Er moet één Head Shaver-advertorial liggen
voordat golf 1 aan kan.

**Eerlijke verwachting:** van CPA €65,65 naar €26,72 is een factor 2,5. Nieuwe
statics alleen halen dat waarschijnlijk niet. Reken op creative plus pagina
plus vermoedelijk een aanbod- of bundelwijziging.

### 3. Budgetvraag die eerst beantwoord moet worden

Het account draait op ongeveer €214 per dag. FlexGuard terug (€70) plus de
Head Shaver-test (€40) is **+€110 per dag, ruim 50% erbij**.

De twee campagnes die nu onder break-even draaien zijn MIJU (niet aanraken) en
**BUNDLE op ROAS 0,85 met een CPA van €119,40**. Dat is de logische donor, of
er moet vers budget bij.

Prioriteit als er gekozen moet worden: **FlexGuard vóór Head Shaver.**
FlexGuard is bewezen op 158 aankopen, Head Shaver moet zich nog bewijzen.

### 4. Kleiner, maar blijft staan

- **Naamconventie invoeren:** `[concept]-[hook]-[format]-[versie]`, bijv.
  `ADV-loodgieter-static-v3`. Er zijn nu vier advertenties die
  "C1 - 4 Reasons Why" heten met resultaten van 0,00 tot 2,43.
- **Checkout-lek:** winkelwagen naar aankoop staat op 27,6% tegen een norm van
  35 tot 45%. Geschat €3.000 tot €3.500 omzet per maand, kost geen
  advertentiebudget.
- **Wellshine B.V.** (`2776743939329385`) gaf 30 dagen lang €1.874 uit op
  **ROAS 0,58**. Valt buiten deze audit, maar loopt wel.
- **Twee nieuwe testcampagnes** gezien op 28 augustus, nog niet geanalyseerd:
  `🟢 CBO | Test | Gentleman Shaver Elite | NL-BE | 2026-08` (`120252797570090577`)
  en `🟢 CBO | Test | Tondeuse Elegant | NL-BE | 2026-08` (`120252797567680577`).
  Controleer of ze op `OFFSITE_CONVERSIONS` en `1d_view_7d_click_1d_ev` staan,
  want dat zijn de twee instellingen waarop MIJU structureel achterloopt.
- **Grote opruiming op 26 augustus:** tien campagnes in één handeling
  gearchiveerd. Negen stonden al stil, ASC+ GroomGuard niet. Als er vaker
  bulkacties via Power Editor gebeuren, is het de moeite waard om vooraf op
  status te filteren.

## Wat de vorige sessie niet kon

De Meta-koppeling verschilt per sessie. In de sessie van 23 en 24 augustus was
de toolset **read-only voor campagnes, adsets en advertenties**. Beschikbaar
waren wel: creatives uploaden naar de mediabibliotheek
(`ads_creative_upload_media`), catalogus-, pixel- en A/B-testtools.

**Niet** beschikbaar: `ads_create_campaign`, `ads_create_ad_set`,
`ads_create_ad`, `ads_create_creative`, `ads_update_entity`,
`ads_activate_entity`.

**Gecontroleerd op 28 augustus: de schrijftools zijn er nog steeds niet.**
ToolSearch op `ads_update_entity`, `ads_activate_entity`, `ads_create_campaign`,
`ads_create_ad_set` en `ads_create_ad` geeft "No matching deferred tools found".
Reads werken volledig, inclusief het activiteitenlogboek. Ga er dus van uit dat
alles wat je adviseert door Dustin handmatig in Ads Manager wordt uitgevoerd,
tenzij een volgende sessie aantoont dat de tools terug zijn.

Controleer dit aan het begin van elke nieuwe sessie met ToolSearch voordat je
toezegt iets uit te voeren. De regels voor
schrijven staan in `.claude/skills/ben-heath/references/account-actions.md`:
elke schrijfactie wordt eerst voorgesteld en pas uitgevoerd na expliciet
akkoord per actie.

Twee valkuilen uit diezelfde referentie die hier gaan bijten: **nieuwe adsets
worden gepauzeerd aangemaakt** en moeten apart geactiveerd worden, en
**creatives zijn onveranderlijk**, dus tekst of media wijzigen betekent een
nieuwe creative en een nieuwe advertentie.

## Bronnen

- Auditrapport: [[2026-08-23-wellshave-advertentieaccount]]
- Interactieve versie: https://claude.ai/code/artifact/900fc272-9285-4dad-8278-2dca9d8dac3c
- Test tracker (219 t/m 228): Google Sheets `1jzd0qX8gtbCDNpDqVpygA5LszOlyAodL`
- Skills: `.claude/skills/ben-heath/` (structuur, scaling, diagnose) en
  `nick-theriot` (awareness, sophistication, landingspagina's)
