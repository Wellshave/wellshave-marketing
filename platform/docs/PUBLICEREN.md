# Publiceren naar Meta — stap 03

Hoe een creative uit de console een draaiende advertentie wordt, zonder dat het
systeem zelf geld kan uitgeven.

Dit is de schakel die de lus voor het eerst laat lopen. Niet omdat handmatig
uploaden traag is, maar omdat het de herkomst wegvaagt: zodra iemand een beeld
downloadt en in Ads Manager opnieuw uploadt, weet niemand later meer welke hoek,
persona of hypothese dat cijfer heeft opgeleverd.

## De scheiding waar alles op rust

Klaarzetten en publiceren zijn twee verschillende handelingen met twee
verschillende uitvoerders.

| | Klaarzetten | Publiceren |
|---|---|---|
| Wie | een agent | alleen een mens |
| Hoe | tool `meta_prepare_ad` | `POST /agents/publications/<id>/publish` |
| Wat er bij Meta gebeurt | beeld geüpload, ad-creative aangemaakt | advertentie aangemaakt en aangezet |
| Kost het geld | nee | ja |

Een ad-creative die aan geen enkele advertentie hangt wordt nooit vertoond. Dat
is precies waarom een agent hem wél mag maken: alle voorbereiding is gratis en
omkeerbaar, en de enige onomkeerbare handeling blijft bij een mens.

**Er bestaat geen agent-tool die publiceert.** Niet omdat het de agent verboden
is, maar omdat de tool niet bestaat. Dat is een verschil dat telt: een instructie
kan weggepraat worden, een ontbrekende tool niet. De testlus controleert dit
expliciet — Bolt's toolset mag geen enkele naam bevatten die met publiceren,
activeren of budget te maken heeft.

## De volgorde

```
1  Bolt zoekt creatives met status 'To Test' en een beeld
2  meta_prepare_ad
     → publicatierij aanmaken (status concept)
     → beeld naar Meta            → image hash
     → ad-creative bij Meta       → creative id
     → goedkeuring aanmaken       → status wacht_op_akkoord
3  Mens beslist in de console     → approved of rejected
4  POST .../publish
     → advertentie aanmaken als PAUSED
     → daarna pas ACTIVE
     → creative in de console op 'Live'
5  Atlas haalt vanaf dag 1 de cijfers op per ad-id
6  De view creative_performance koppelt cijfer aan hypothese
```

De goedkeuring wordt aangemaakt door `meta_prepare_ad` zelf, niet door de agent
in een aparte stap. Anders kan er een publicatie bestaan waar niemand over hoeft
te beslissen — precies het gat waar dit soort systemen doorheen lekt.

## Waarom eerst PAUSED en dan pas ACTIVE

De advertentie wordt in twee stappen aangezet. Als het aanmaken lukt maar het
activeren niet, staat er een gepauzeerde advertentie klaar en is er niets
uitgegeven. Andersom — direct ACTIVE aanmaken en dan halverwege een netwerkfout —
levert een draaiende advertentie op waarvan onze database niet weet dat hij
bestaat. Dat is de dure kant van de fout, dus die kant sluiten we af.

`{"activate": false}` in de body slaat het aanzetten over. Handig om een batch
klaar te zetten en er later in Ads Manager naar te kijken voordat er budget loopt.

## De koppeling, twee keer gelegd

De hele winst van deze stap is dat een cijfer terug te leiden is naar een
creatieve keuze. Die koppeling ligt op twee onafhankelijke plekken:

1. **`meta_publications`** — de rij die `creative_id` aan `meta_ad_id` knoopt,
   met de hypothese, hoek, persona en awareness level erbij zoals ze op het
   moment van publiceren waren.
2. **`utm_content=wg-<publication_id>`** in de link. Die reist mee naar de
   website en komt terug in de Shopify-order. Ook als onze database omvalt,
   staat in de bestelling welke advertentie de klant binnenbracht.

**Niet** via de naam. Het account gebruikt nu namen als
`Waarom krijg je steeds rode bultjes? 2026-07-24-87ce0c7b...` — leesbaar en
uniek, maar namen worden hernoemd, gekopieerd en hergebruikt. Een naam is geen
sleutel.

## Wat een herhaalde poging doet

Niets dubbels. Op drie plekken:

- **`idem_key`** = `creative_id : adset_id : eerste 16 tekens van de bytes-hash`,
  uniek in de database. Dezelfde creative twee keer klaarzetten voor dezelfde ad
  set geeft de bestaande publicatie terug.
- **Het beeld** is uit zichzelf idempotent: Meta geeft voor dezelfde bytes
  dezelfde hash terug.
- **Publiceren** kijkt eerst of `meta_ad_id` al gevuld is. Zo ja, dan gebeurt er
  niets en komt de bestaande advertentie terug.

Een mislukte publicatie mag wél opnieuw: alleen de statussen die daadwerkelijk
iets bij Meta hebben staan tellen mee in de uniciteitsregel.

## Wat er terugkomt — stap 06

`marketing_hq.creative_performance` is een view die de dagcijfers per advertentie
naast de creatieve keuzes zet:

```sql
select ad_name, angle, persona, dagen_live, spend, roas, hook_rate, is_final
from marketing_hq.creative_performance
where dagen_live >= 4          -- eerder is het oordeel niet eerlijk
order by roas desc nulls last;
```

`dagen_live` is het verschil tussen de meetdag en de publicatiedatum. Onder de
vier dagen staat het oordeel uit: Meta's attributie loopt tot ongeveer 72 uur na,
en de eerste dagen zijn vooral leerfase.

De console heeft in `creatives` al kolommen voor `impressions`, `ctr`, `roas` en
`hook_rate` — die worden nu met de hand ingevuld en staan bij alle negen huidige
creatives leeg. Zodra deze view draait, kunnen die vanzelf gevuld worden. Dat is
het moment waarop de lus sluit.

## Wat er nodig is voordat dit kan draaien

| | |
|---|---|
| `META_ACCESS_TOKEN` | met **schrijfrechten** (`ads_management`), niet alleen `ads_read` |
| `META_AD_ACCOUNT_ID` | `242238038391551` voor Wellshave® |
| Migratie 0007 | toegepast |
| `marketing_hq` in Exposed schemas | nodig voor alle runtime-schrijfacties |

Let op het verschil met analyse: Atlas heeft genoeg aan leesrechten, publiceren
niet. Dat is een aparte, zwaardere toestemming — de moeite waard om apart te
overwegen in plaats van er één token voor alles van te maken.

## Geverifieerd tegen het echte account

De opzet is niet uit de documentatie overgenomen maar gecontroleerd tegen
Wellshave® (`242238038391551`):

- **Pagina `100135282880333`** — bevestigd via de pagina-lijst én via de
  `object_story_id` van bestaande live creatives, die met dit id begint.
- **`object_story_spec` met `link_data`** — dat is de vorm die de bestaande
  creatives in dit account hebben (`object_type: SHARE`, met `image_hash`,
  `title`, `body` en een `call_to_action`).
- **`ORDER_NOW`** is de call-to-action die het account nu gebruikt; `SHOP_NOW`
  is de default in de code en kan per publicatie worden overschreven.
- **413 ad sets**, met optimalisatie op `RETURN_ON_AD_SPEND` en
  `OFFSITE_CONVERSIONS`. De ad set wordt dus altijd meegegeven, nooit geraden.

## Wat hier bewust niet in zit

- **Video.** Het schema ondersteunt `asset_kind = 'video'`, de code nog niet.
  Video gaat via `/advideos` en moet worden gepolld tot Meta hem verwerkt heeft —
  een asynchrone stap die de flow anders maakt. Aparte ronde.
- **Campagnes en ad sets aanmaken.** Publiceren gebeurt altijd in een bestaande
  ad set. Een nieuwe ad set aanmaken betekent targeting en budget kiezen, en dat
  is een beslissing van een mens, niet een bijproduct van publiceren.
- **Carrousels en dynamische advertenties.** Eén beeld, één link. Het patroon
  waar het team nu op draait.
- **Automatisch pauzeren van verliezers.** Bolt kan het voorstellen via
  `request_approval`; uitvoeren zou een tweede onomkeerbare handeling zijn, en
  die verdient dezelfde behandeling als publiceren.
