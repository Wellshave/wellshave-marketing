# De worker uitrollen

Er zijn twee workers met dezelfde code:

| | adres | wie praat ermee | wanneer |
|---|---|---|---|
| **live** | `marketing-ads.dustin-9ff.workers.dev` | de console op wellshave-adgen en wellshave-werkbank | bij het samenvoegen, met de hand |
| **preview** | `marketing-ads-preview.dustin-9ff.workers.dev` | de deploy-previews van diezelfde twee sites | automatisch, bij elke push naar een werkbranch |

`/health` zegt welke van de twee je te pakken hebt (`"rol": "live"` of
`"rol": "preview"`) en welke versie er draait.

## Waarom twee

Er was er één, en de console praatte er altijd mee -- ook vanaf een
deploy-preview. Elke workerwijziging was daarmee meteen live voor iedereen, of
hij moest met de hand in het dashboard geplakt worden. Zonder dat plakken werkte
de preview met oude workercode terwijl de nieuwe console er al stond, en dat
verklaart de helft van de fouten in de rebuild van september: een scherm dat
niets liet zien omdat de andere helft nog niet uitgerold was.

## De previewworker: eenmalig klaarzetten

1. In Cloudflare een API-token maken met alleen **Edit Cloudflare Workers** voor
   dit account. Niet de globale sleutel.
2. In GitHub onder **Settings → Secrets and variables → Actions** twee secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. Twee secrets op de worker zelf. Meer heeft hij niet nodig: de rest
   (Anthropic, OpenAI, Meta, Atria, TrendTrack) leest hij versleuteld uit
   dezelfde database als de echte worker.

   ```
   npx wrangler secret put SLEUTEL_MASTER       --config platform/worker/wrangler.preview.toml
   npx wrangler secret put SUPABASE_SERVICE_KEY --config platform/worker/wrangler.preview.toml
   ```

4. In `ad-generator/app/js/01-fable-en-changelog.js` `WORKER_PREVIEW_AAN` op
   `true` zetten. Tot dat moment praten de deploy-previews met de echte worker
   -- dat is met opzet: de vlag aanzetten voordat de previewworker er staat,
   wijst de console naar een adres dat niets teruggeeft.

Daarna rolt `.github/workflows/worker-preview.yml` bij elke push naar een
werkbranch uit. Hij draait eerst de testlus, kijkt daarna op `/health` of er
werkelijk staat wat er gestuurd is, en zegt het als het token ontbreekt in
plaats van stil over te slaan.

## De echte worker uitrollen

Met de hand, en dat blijft zo: dit is de worker waar het team op draait.

```
npx wrangler deploy --config platform/worker/wrangler.toml
```

Kan ook via het dashboard: de code plakken in `marketing-ads` en op Deploy
drukken. Controleer daarna `/health` -- versie en rol.

`VERSIE` en `VERSIE_DATUM` ophogen bij elke deploy die gedrag verandert. Staat
de datum ver in het verleden terwijl er net iets is aangepast, dan draait er
oude code.

## Wat de previewworker NIET doet

De geplande lus. Twee workers die elke vijf minuten dezelfde wachtrij afwerken
publiceren alles twee keer, en dat zie je pas als een klant twee keer dezelfde
mail heeft. `wrangler.preview.toml` zet daarom geen cron, en de code weigert
daarnaast te draaien zodra `ROL` op `preview` staat. Twee sloten op één deur,
want de fout is onomkeerbaar.
