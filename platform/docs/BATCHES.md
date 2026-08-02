# De eerste batches

Plan van aanpak, 2 augustus 2026. De werkbank staat compleet in de database
(`WERKBANK.md` ①–⑥, migraties 0021–0026). Wat er niet staat is werk dat er
doorheen loopt. Dit document zegt hoe de eerste batches eruitzien, waarom ze zo
groot zijn en niet anders, en in welke volgorde ze gemaakt worden.

---

## 0. Wat er nu werkelijk staat

Niet uit het hoofd maar uit de database, want de rest van dit plan hangt eraan.

| | Stand op 2 augustus |
|---|---|
| Creatives | 9, **allemaal `To Test`** — er heeft er nog nooit één gedraaid |
| Waarvan met beeld | 3 (id 2, 3, 4) |
| Waarvan met `angle_type` | 3 — de andere 6 vallen buiten `angle_learnings` en dus buiten de lus |
| Dubbelingen | id 8, 9, 10 zijn kopieën van 5, 6, 7 (23 juli → 27 juli) |
| Werkstukken | 3, alle drie `loopt`, alle drie ③ op `klaar` |
| Denkstukken | **0** — station ② staat overal op `niet_vastgelegd` |
| Overdrachten | **0** — ③ staat op klaar maar er is niets doorgegeven |
| `meta_publications` | 0 |
| `meta_insights_daily` | 0 rijen, geen enkele dag |
| Meta Ads-integratie | `unconfigured` |

Twee dingen springen eruit.

**De drie werkstukken zitten klem.** Station ③ staat op `klaar`, maar er is geen
overdracht. Dat kon omdat die stappen op klaar zijn gezet vóórdat 0022 bestond —
de grendel vuurt alleen op de overgang. Ze staan dus in een toestand die de
werkbank vandaag niet meer toelaat: af zonder dat er iets is doorgegeven. Ze
kunnen niet vooruit, en niemand ziet waarom.

**Er is nooit iets gemeten.** Geen enkele advertentie is live geweest, dus
`creative_results`, `angle_learnings`, `advertentie_scorekaart` en het hele
dossier van 0025 hebben niets om uit te putten. Dat is precies wat het dossier
nu zegt: elf regels, allemaal `open` of `aanname`. Het systeem liegt niet — het
heeft alleen nog niets gezien.

---

## 1. Hoe groot een batch is, en waarom dat niet te kiezen valt

De batchgrootte volgt uit drempels die al in de database staan. Ze zijn er niet
bij bedacht voor dit plan; ze bepalen sinds 0008 en 0011 of een cijfer meetelt.

| Drempel | Waar | Wat hij eist |
|---|---|---|
| `beoordeelbaar` | 0008, per advertentie | ≥ 4 dagen live, ≥ €50 besteed, ≥ 1.000 vertoningen |
| `betrouwbaar` | 0008, per hoek × persona | ≥ 3 advertenties **én** ≥ €300 besteed |
| `soortgenoten ≥ 3` | 0011 en 0013, per account | anders geen oordeel tegenover de mediaan |

Daaruit volgt de kleinst mogelijke batch die iets kan opleveren:

> **Drie advertenties, op één hoek bij één persona, elk minimaal zeven dagen live
> op ongeveer €15 per dag.**
>
> 3 × 7 × €15 = **€315** — net boven de €300 die `betrouwbaar` vraagt.

Kleiner mag, maar dan is de uitkomst per definitie een `aanname`. Dat is geen
mening van mij: `angle_learnings` zet `betrouwbaar` dan op false, het dossier
van ② zegt 'aanname', en het denkstuk van het volgende werkstuk weigert het als
onderbouwing. Wie met twee advertenties test, test om te testen.

Twee dingen die hierbij horen en makkelijk vergeten worden:

- **De drie advertenties moeten verschillen op één as.** Drie varianten van
  dezelfde opening meten ruis. Verschil in hook, of in format, of in belofte —
  maar één ervan tegelijk, anders is achteraf niet te zeggen wát het deed.
- **De drie moeten tegelijk lopen.** `soortgenoten` telt binnen hetzelfde
  account over dezelfde 30 dagen. Na elkaar zetten betekent dat ze elkaars
  vergelijkingsmateriaal niet zijn, en dan komt er nooit een oordeel.

---

## 2. De volgorde

### Fase 0 — opruimen. Nu, en het kan zonder secrets.

Batch 1 begint anders met een vervuild dossier, en 0025 rekent netjes door wat
erin zit — ook de rommel.

1. **De drie duplicaten weg** (creatives 8, 9, 10). Ze verdubbelen straks elk
   getal per hoek.
2. **`angle_type`, `format` en `hook_short` invullen** op de zes creatives waar
   ze leeg zijn. Zonder `angle_type` valt een advertentie buiten
   `angle_learnings` — hij draait dan wel, maar leert niets, en niemand ziet dat
   hij ontbreekt.
3. **De drie klemzittende werkstukken afhandelen.** Per stuk één keuze: alsnog
   een denkstuk en een overdracht erbij schrijven, of stoppen met een reden.
   Beide zijn goed; ze half laten staan is het enige wat niet kan, want dan
   telt de werkbank ze mee als lopend werk dat nergens op wacht.

Resultaat: een schone nul. Het dossier zegt dan nog steeds dat er niets gemeten
is, maar het telt geen spoken mee.

### Fase 1 — de proefrit. Eén werkstuk, met de hand, van ① tot ⑥.

Doel is niet de advertentie. Doel is uitvinden of de vorm werkbaar is voordat er
negen agents op losgelaten worden. Alles met de hand, in de console of met SQL:

- ① aanleiding vastleggen — waarom dit, waarom nu
- ② denkstuk: zeven vragen, en een mens tekent af
- ③ drie creatives maken, overdracht schrijven met `controleren` erin
- ⑥ de Criticus velt zijn oordeel (voorlopig een mens; er draait nog geen agent)
- ④ Bolt neemt aan en zet live
- ⑤ na zeven dagen: meten tegen de hypothese uit ②, en een learning vastleggen

Wat deze rit moet opleveren is niet alleen een batch, maar een antwoord op:
waar wringt de vorm? Welke vraag uit het denkstuk is in de praktijk niet te
beantwoorden? Vraagt de overdracht dingen die niemand weet? Dát zijn de
bevindingen die 0027 waard zijn.

**Het werkstuk waarmee:** de kraaghoek bij Mark (Groom Guard) — daar liggen twee
creatives mét beeld, en de persona is de enige met genoeg materiaal om een derde
naast te zetten.

### Fase 2 — batch 1 live. **Hangt op de Meta-secrets.**

Zonder werkende Meta-koppeling kan alles behalve dit. `meta_ads` staat op
`unconfigured`; zolang dat zo is komen er geen publicaties uit en geen cijfers
terug. Publiceren kan desnoods met de hand in Meta zelf, maar dan moet
`meta_publications` alsnog gevuld worden, anders vindt de terugkoppeling van
0008 de advertentie niet — die koppelt op `meta_ad_id`.

Budget en looptijd zoals in §1: drie advertenties, zeven dagen, ~€15/dag.
Rekening houden met de attributiestaart: `beoordeelbaar` vraagt vier dagen, dus
vóór dag vier zegt elk oordeel niets. Niet eerder kijken. Of wel kijken, maar
niet besluiten.

**Nog te kiezen:** welk van de vijf ad accounts. `242238038391551` (Wellshave®)
is het account waar de rest van het systeem al van uitgaat. De mediaan wordt per
account gevormd, dus batches verdelen over accounts betekent dat geen van beide
genoeg soortgenoten heeft.

### Fase 3 — meten en de lus sluiten.

Na zeven dagen loopt de ochtendcyclus van 0008 (Bolt → terugschrijven → Nova).
Wat er dan moet gebeuren is het enige wat niet automatisch gaat:

- **De learning vastleggen** aan het werkstuk én aan de hoek. 0026 dwingt de
  hypothese af — hij wordt uit het denkstuk gehaald, dus die moet er staan.
- **Controleren of de lus rond is** in `lus_per_hoek`. Als daar 'geen enkele
  learning' staat na een afgeronde batch, is de batch niet af.

### Fase 4 — batch 2, op wat batch 1 uitwees.

Pas hier heeft het dossier van ② iets te zeggen. Batch 2 kiest zijn hoek niet
opnieuw uit het niets, maar uit `werkstuk_dossier`: wat deed deze hoek, welke
raakt uitgeput, wat leerde de vorige ronde. Dat is het verschil tussen twee
batches en een systeem.

---

## 3. Wat waarvan afhangt

```
Fase 0 opruimen ──► Fase 1 proefrit ──► Fase 2 live ──► Fase 3 meten ──► Fase 4
     (nu)              (nu)              ▲                 (+7 dagen)
                                         │
                                  Meta-secrets
```

Alleen fase 2 wacht op iets buiten de database. Fase 0 en 1 kunnen vandaag, en
ze zijn het meeste waard: ze leggen bloot of de vorm klopt, en dat kost geen
advertentiebudget.

## 4. Wat er van jou nodig is

1. **De Meta-secrets** — anders staat fase 2 stil en blijft de lus theorie.
2. **De keuze van het ad account** voor alle eerste batches (voorstel:
   Wellshave®, `242238038391551`).
3. **Aftekenen op het denkstuk van de proefrit.** Dat kan niet gedelegeerd
   worden: 0023 eist een mens, en dat was met opzet.
4. **Een oordeel over de drie klemzittende werkstukken** — doorzetten of
   stoppen, per stuk.

## 5. Wat ik bouw zodra dit vaststaat

- Fase 0 als migratie: opruimen, en de ontbrekende velden invullen waar ze af te
  leiden zijn. Wat niet af te leiden is, komt op een lijst in plaats van dat ik
  het verzin.
- De console-kant van ⑥ en van het dossier. `criticus_werkvoorraad` en
  `werkstuk_dossier` bestaan, maar er kijkt nog niemand naar — en een grendel
  die niemand ziet, wordt niet omzeild maar vergeten.
- Een `batch`-begrip in de database, als de proefrit uitwijst dat het nodig is.
  Nu is een batch nog een afspraak in dit document, en dat is genoeg zolang er
  één tegelijk loopt.
