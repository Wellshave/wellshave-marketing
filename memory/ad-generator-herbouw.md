# Atelier Console — projectgeheugen (ad generator herbouw)

> Doel van dit bestand: de volledige, gedistilleerde context van de Atelier
> Console zodat een sessie dit leest/query't i.p.v. de hele chat over te lezen
> (tokenbesparing). Er staat ook een Graphify-kennisgraaf in `graphify-out/`.

## Wat is het
"Atelier Console" = de complete redesign van de Wellgroup ad-generator (merken
**Wellshave** = grooming/scheren, **Wellshine** = haar-styling). Eén **single-file
HTML-app** (inline CSS + JS, geen build), gebruikt door het team om Meta-ads te
maken met Rory (Fable 5) als AI-motor.

## Canoniek bestand + werkwijze (BELANGRIJK)
- **Bron van waarheid:** `atelier-console/index.html` in deze repo, branch
  `claude/atelier-console-redesign-u07czk`. ALTIJD ditzelfde bestand in-place
  bewerken — nooit een nieuwe/versienummer-kopie. Commit + push elke wijziging.
- **Google Drive-werkmap:** folderId `10wWP0VTtvPvEvWoqmjAgyvuUr3WE_xgO`
  (door Dustin aangewezen op 11 jul 2026: "we gaan hierin werken"). Daarin:
  `index.html` (mirror van de live app; bijwerken via Versies beheren → Nieuwe
  versie, nooit een kopie) + `atelier-proxy.js` (workercode). FileId's van de
  bestanden nog vastleggen zodra de Drive-connector geautoriseerd is.
- **Deliver-flow nu:** Netlify- en Drive-connectoren zijn deze periode vaak
  offline. Werkwijze: wijziging in de repo → verifiëren → commit/push → het
  bestand via chat naar Dustin sturen; hij zet het op Netlify (drag-drop) en Drive
  (Versies beheren → nieuwe versie). Dustin draait het lokaal (Downloads/index.html).
- **Verifiëren:** altijd `node --check` op het `<script>`-blok + haakjes/onclick-
  handler-check (python), daarna Playwright headless (chromium in
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `playwright-core` in de
  scratchpad-node_modules; lokale server `python3 -m http.server 8823 --directory
  atelier-console`).

## Live infrastructuur
- **Netlify:** site `wellshave-adgen` (site-id `4e18bda6-a21e-4442-be99-dbf7e8a30ecb`),
  URL https://wellshave-adgen.netlify.app. Publish-dir `atelier-console/` via
  `netlify.toml` (puur statisch, alleen die map publiek). Deploy via Netlify-MCP
  (`deploy-site` geeft een `npx @netlify/mcp … --proxy-path …`-commando terug, in
  repo-root draaien). Zie `DEPLOY.md`.
- **Supabase:** project "Wellgroup ad generator", id `bequyhghgkvekvibufhw`,
  url https://bequyhghgkvekvibufhw.supabase.co. Publishable key
  `sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv` (publiek-veilig, hardcoded in de
  app). Tabellen: `products` (16, incl. `images`-jsonb), `personas` (8 = 4 Wellshave
  + 4 Wellshine), `creatives` (bewaarde ads, `image_b64`), `rory_recommendations`
  (leeg), `brand_profile` (1 rij, `data`-jsonb), `app_state` (key-value historie:
  brand_profile_v1, products_v2, personas_v1, library_v2, cs_*), + team_members/
  activity_log/ad_results. RLS: publiek-lezen op products/personas; creatives +
  schrijven vereisen een ingelogde *approved* member (admin/member).
- **Auth:** supabase-js (CDN) — "Inloggen met Google" + e-mail/wachtwoord,
  token-refresh. OAuth `redirectTo: location.origin + location.pathname` →
  op live is dat `https://wellshave-adgen.netlify.app/`. Die URL moet in Supabase
  Auth → URL Configuration (Site URL + Redirect allow-list `…/**`). Nog te bevestigen.

## AI-motor (Fable 5) — v2 (jul 2026, volledige herbouw generatie-engine)
- `fable5(opts)` v2: werkt via **Anthropic API-key direct** (`AI.apiKey`, header
  `anthropic-dangerous-direct-browser-access`, key in localStorage) ÓF via de
  **gedeelde team-proxy** `wellgroup-team-proxy.dustin-9ff.workers.dev`
  (`AI.proxyUrl`; `https://` en `/anthropic` worden automatisch aangevuld).
  Key wint als beide gezet. `AI.ready = !!(apiKey || proxyUrl)`.
  **LET OP: die worker is een gedeeld productiesysteem** (bol OS, notify-relay,
  nightly, OpenAI) — nooit vervangen; repo-kopie met `[ATELIER-PATCH]`-markers
  in `cloudflare-worker/wellgroup-team-proxy.js`. De proxy vereist een
  ingelogd teamlid (e-maildomein-check); de app stuurt het Supabase-token
  automatisch mee (`aiEndpoint`), en de worker accepteert tokens van zowel het
  bol-OS- als het Atelier-Supabase-project. `ANTHROPIC_KEY` staat al als
  secret in de worker (nightly gebruikt hem).
- Compat-eerst request-body (alleen model/max_tokens/system/messages — geen
  output_config/fallbacks/beta-headers). JSON-schema via system-prompt +
  `extractJson()` (robuust: fences/substring). Refusal → één retry op
  `claude-opus-4-8`. **Vision**: `opts.image` (dataURL) → base64 content-block.
- Foutafhandeling is leesbaar NL: HTML-antwoord wordt herkend ("De … gaf een
  webpagina (HTML) terug…" — dat was Dustins bug: proxy-URL wees naar een
  website → `Unexpected token '<'`). 401/403 → hint naar Instellingen.
  **Instellingen → "Test AI-verbinding"** doet een echte mini-call met de
  ingevulde (nog niet opgeslagen) waarden en rapporteert exact wat er misgaat.
- **Geen stille mock meer**: AI gekoppeld + fout → rode foutkaart
  (`aiErrorCard`) met "Probeer opnieuw"; AI niet gekoppeld → demo-output met
  DEMO-banner (`demoBanner`), zonder nep-cijfers.
- Experts: `EXPERTS.rory/ogilvy/theriot`. `brandText()` (merk-DNA actieve merk)
  gaat in ALLE flows mee, plus `productBrief()` (usps/features/vsUs/vsThem/
  proof/forbidden/appearance), `personaBrief()` (incl. Schwartz-stage passend
  bij awareness), `genSettingsBrief()` (format+detail, plaatsing/ratio,
  beeld-referentie, funnel/awareness/angle/sophistication, brief) en
  `checksBrief()` (kwaliteits-checkboxen). UI toont na generatie een
  "🔍 Wat Rory meekreeg"-checklist (`buildGenContext`).
- **Beeldgeneratie (jul 2026):** knop "🖼 Beeld" per variant → `genVariantImage(i)`
  POST `<proxy>/openai/images/generations` (gpt-image-1, size 1024x1024 of
  1024x1536 o.b.v. plaatsing, login-token mee). Resultaat komt als data-URL in
  de preview (`v._img`) en gaat bij Bewaar mee als `image_b64`+`has_image`.
  Vereist de OpenAI-route op de proxy (zit in de gedeelde worker én in
  `cloudflare-worker/atelier-proxy.js`) + `OPENAI_KEY`-secret. Dustin koos
  optie B: een EIGEN losse worker `atelier-proxy` (volledige isolatie van de
  gedeelde bol-OS-worker; die blijft onaangeraakt op versie 340b397a).
- Output-schema per variant: hook/head/sub/primary/cta/visual/imgPrompt(EN)/hyp
  — GEEN verzonnen ROAS/CTR meer. Kaarten (`variantsGrid`/`variantCard`):
  ratio-preview (1:1/4:5/9:16, echte productfoto indien geladen, wordmark- en
  safe-zone-opties), kopieerknoppen per veld, image-prompt-blok, hypothese,
  Bewaar/Itereer. Echte beeld-GENERATIE zit er niet in (geen image-model in de
  Anthropic API) — wel productie-klare image-prompts + HTML-comp-preview.
- Flows nu allemaal echt: **Nieuwe ad** (analyse + 4 varianten), **Kopieer**
  (screenshot-upload → vision-ontleding → productkeuze → varianten),
  **Itereren-scherm** (winner-upload + metrics-matrix zonder sample-waarden +
  3 stappen → iteraties), **iteratie-paneel** (vanuit Bibliotheek/kaarten:
  richting-chips → 4 iteraties ín het paneel, bron-ad context), **Transformer**
  (foto-upload → echte vision-lezing + advies + 3 richtingen → handoff),
  **Scripts-scherm** (echte lijst uit libScripts i.p.v. stub). Generator/
  Kopieer/Itereren/Transformer gebruiken live producten/persona's per merk
  (`genProducts()`/`genPersonas()`/`genSyncDefaults()`) — sample-lijsten weg.

## Datamodel
- **Merk-switch:** `activeBrand` ('wellshave'|'wellshine', in localStorage
  `atelier-brand`). `brandOfNiche(n)`: niche in `['hair','airstyler']` → wellshine,
  anders wellshave. `brandOfProduct(name)` via prodData-lookup. `setBrand()` reset
  filters + re-rendert. Sidebar-toggle `renderBrandSwitch()`. Filtert producten,
  persona's, bibliotheek én dashboard-tellingen per merk.
- **Merk-DNA:** `brandProfiles = { wellshave:{…}, wellshine:{…} }`, geladen uit
  `brand_profile.data` (per-merk, met back-compat: oude flat data = wellshave),
  localStorage-fallback `atelier-brandprofiles`. Editor = getabde modal
  (`renderBrandDnaModal`, 7 secties/`brandDnaTab`): merk-kern, doelgroep, tone of
  voice, do's&don'ts, visueel (kleuren/fonts/beeldstijl), bewijs, aanbod (~40 velden).
  Opslaan → `saveBrandProfilesToSupabase` (PATCH `brand_profile` op `id`, `data`-jsonb;
  geen schemawijziging nodig) + localStorage.
- **Producten:** `prodData` (velden id/slug, dbId, tag, name, niche, price, rating,
  reviews, sell, usps[], features[{icon,name,desc}], vsUs[], vsThem[], personaIdx[],
  proof[{icon,text}], target, forbidden, appearance). Editor via `renderProdEditModal`
  → `prodEditSave` → `saveProductToSupabase` (PATCH `products` op dbId).
- **Bibliotheek/creatives:** `mapCreative` — let op: `headline` = het lange
  `creative_concept` (paragraaf), niet een korte kop. Daarom overal clampen.

## Wat is gebouwd (deze herbouw)
Alle 8 originele schermen + kruislinks. Daarna team-feedback verwerkt:
- Modal-sluitknop (X) gefixt (z-index + pointer-events op tekst-overlay).
- Lange koppen clampen (`.clamp2/.clamp3`) in kaarten en modals; kaarthoogtes vast.
- ALLE sample/illustratie-data weg: dashboard-hero + team-podium data-gedreven met
  lege staten; Rory's dagelijkse check lege staat; sample-arrays starten leeg;
  ads zonder ROAS tonen "Geen data" i.p.v. "Loser".
- Merk-switch Wellshave/Wellshine (globaal, filtert alles).
- Merk-DNA-editor → uitgebreid tot volledig merk-book (7 tabs, ~40 factoren),
  incl. visuele identiteit (kleuren/fonts/beeldstijl). Voedt de AI via brandText().
- Product-editor (✎ Bewerk): USP's, features, alle velden bewerkbaar → Supabase.
- Foto-overlap opgelost: badges/kop uit de foto, in een strook eronder/erboven.
- Bewerken (✎ Bewerk + Merk-DNA-ingang) alleen zichtbaar als je bent INGELOGD
  (`session`); `renderAuthStatus` togglet `#merkDnaNav`; openProdEdit/openBrandDna →
  openLogin() als niet ingelogd. Feature-icoon = simpele bullet `•`.

## Openstaande punten
1. **Fable 5 koppelen door Dustin** — simpelste route: Instellingen (⚙) →
   Anthropic API-key (console.anthropic.com) → "Test AI-verbinding" → Opslaan.
   De oude proxy-URL die hij had ingevuld gaf HTML terug (verkeerde URL); de
   test-knop diagnosticeert dat nu zelf.
2. **Genereren strenger op merk-DNA** (aangeboden, wacht op go): (a) hard niet-
   onderhandelbaar-blok in de prompt (verboden woorden/claims, aanspreekvorm),
   (b) na-controle/"merkrechter" die output scant/laat herschrijven, (c) brandText
   ook in Itereren + Ad transformer injecteren.
3. **Supabase-writes valideren** — product- en merk-DNA-opslag (PATCH) zijn defensief
   gebouwd op `id`+`data`/kolommen maar nog niet end-to-end getest met een ingelogd
   *approved* account (Supabase-connector lag eruit). Check bij eerste opslag of het
   blijft staan; controleer of Dustin approved admin is in members.
4. **Supabase Auth redirect-URL** toevoegen (zie boven).
5. **Drive-fileId verversen** van de nieuwe `index.html` zodra de Drive-connector terug is.
6. **Deploy** naar Netlify wachtte op herstel van de Netlify deploy-service (500's);
   Dustin uploadt zelf tot dan.
7. Optioneel: merkkleuren/fonts ook echt de app-styling laten aansturen (nu voeden
   ze alleen de AI). Mogelijke grote verbouwing: single-file → componenten (breekt
   de "geen build, in Drive bewerken"-workflow — eerst met Dustin bespreken).

## Git
Branch `claude/atelier-console-redesign-u07czk`. Kerncommits o.a.: deploy-setup,
modal/layout/sample-data, merk-switch, merk-DNA, product-editor + foto-overlap +
visuele identiteit, login-gating + bullet, merk-DNA getabd (volledig merk-book).
Repo is nu de canonieke bron (Drive/Netlify lopen soms achter).
