# 🔄 Overdracht — Wellshave® advertentieaccount

*Laatst bijgewerkt: maandag 24 augustus 2026, 09:40 UTC · account `242238038391551`*

> **Lees dit eerst als je een nieuwe sessie start op dit advertentieaccount.**
> Het volledige auditrapport staat in
> [[2026-08-23-wellshave-advertentieaccount|de audit van 23 augustus]].
> Dit document is de actuele stand plus de openstaande acties.

---

## 🔴 Direct uitzoeken: ASC+ GroomGuard is verdwenen uit de API

Campagne `120236714475060577` (`⚫️ ASC+ - Scale Campaign - GroomGuard`) kwam
op 24 augustus rond 08:00 UTC nog gewoon terug met €438 spend over 7 dagen op
**ROAS 2,88**. Dustin heeft die dag het dagbudget naar €100 gezet.

Rond 09:30 UTC komt de campagne **niet meer terug** uit `ads_get_ad_entities`,
ook niet met een filter direct op het campagne-ID, en op adset-niveau met
`campaign_id` filter komt een lege lijst terug. Het activiteitenlogboek voor
dat object geeft eveneens niets.

**Voorbehoud:** afwezigheid in de API is geen bewijs van verwijdering. Meta
verbergt objecten met status DELETED of ARCHIVED voor deze reads, en
`ads_get_ad_entities` geeft sowieso een gelimiteerde subset terug. Het kan ook
een archivering of een tijdelijke API-hapering zijn.

**Actie:** controleer in Ads Manager of deze campagne nog bestaat. Dit was de
best presterende actieve campagne van het account. Als hij echt weg is, is er
ongeveer €100 per dag op de hoogste ROAS uit het account verdwenen.

---

## Stand van zaken

### Live, laatste 7 dagen (24 aug)

| Campagne | ID | Spend | ROAS | Aank. | CPA | Freq |
|---|---|---|---|---|---|---|
| Advertorial Pages | `120250501609280577` | €559 | **2,33** | 20 | €27,96 | 2,56 |
| 001 · CBO · GroomGuard MIJU | `120252205202730577` | €279 | 1,54 | 8 | €34,84 | 3,24 |
| 002 · CBO · BUNDLE SHAVE PACKAGE | `120253002360820577` | €239 | **0,85** | 2 | €119,40 | 2,15 |
| CBO · Test · GroomGuard NL-BE | `120249635909880577` | €107 | **0,38** | 1 | €107,44 | 2,11 |
| ⚫️ ASC+ · Scale · GroomGuard | `120236714475060577` | — | — | — | — | ⚠️ zie boven |

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
- ASC+ GroomGuard is op 24 augustus door Dustin naar **€100 per dag** gezet.
  Volgens de scaling-methode uit de `ben-heath` skill: **7 dagen laten staan**
  voordat je opnieuw verhoogt. Eerste beoordeelmoment **31 augustus**: staat de
  deliverystatus nog op `active` en zit de ROAS boven 1,82.
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

## Wat de vorige sessie niet kon

De Meta-koppeling verschilt per sessie. In de sessie van 23 en 24 augustus was
de toolset **read-only voor campagnes, adsets en advertenties**. Beschikbaar
waren wel: creatives uploaden naar de mediabibliotheek
(`ads_creative_upload_media`), catalogus-, pixel- en A/B-testtools.

**Niet** beschikbaar: `ads_create_campaign`, `ads_create_ad_set`,
`ads_create_ad`, `ads_create_creative`, `ads_update_entity`,
`ads_activate_entity`.

Controleer dus aan het begin van een nieuwe sessie met ToolSearch of die
schrijftools er wél zijn voordat je toezegt iets uit te voeren. De regels voor
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
