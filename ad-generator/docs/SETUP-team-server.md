# Team-server opzetten , Wellgroup Static Image Generator

Doel: het hele team werkt in dezelfde app op één URL, niemand vult nog API-keys of een lokale proxy in, en alle data (producten, personas, bibliotheek, scripts, merkinstellingen) wordt automatisch centraal opgeslagen en is voor iedereen synchroon.

Je doet dit één keer. Reken op 30 tot 45 minuten. Alles hieronder zit op gratis tiers.

De opzet bestaat uit drie bouwstenen:

1. **Supabase** , de gedeelde database (auto-opslag + sync).
2. **Cloudflare Worker** , de proxy met de API-keys erin (zodat niemand keys hoeft in te vullen).
3. **Netlify** , host de app op één URL voor het team.

Aan het einde stuur je mij **drie waarden**, dan bouw ik de app om zodat hij de server gebruikt. Daarna opent iedereen gewoon de Netlify-URL.

---

## Stap 1 , Supabase (database)

1. Ga naar supabase.com en maak een gratis account. Klik **New project**. Kies een naam (bv `wellgroup`), een sterk database-wachtwoord en een regio in Europa (bv Frankfurt). Wacht tot het project klaar is.
2. Open links **SQL Editor** > **New query**. Open het bestand `supabase-schema.sql` uit deze map, kopieer de volledige inhoud, plak die in de editor en klik **Run**. Je hoort "Success" te zien.
3. Ga naar **Project Settings** (tandwiel) > **API**. Noteer twee dingen:
   - **Project URL** (iets als `https://abcdxyz.supabase.co`)
   - **anon public** key (een lange sleutel onder "Project API keys")

   Let op: dit is de *anon public* key, niet de *service_role* key. De anon-key hoort in de browser; de service_role-key deel je nooit.

---

## Stap 2 , Cloudflare Worker (proxy met de keys)

1. Ga naar dash.cloudflare.com en maak een gratis account. Ga naar **Workers & Pages** > **Create application** > **Create Worker**. Geef hem een naam (bv `wellgroup-team-proxy`) en klik **Deploy** (de standaard-code maakt niet uit).
2. Klik **Edit code**. Verwijder alles, plak de inhoud van `wellgroup-team-proxy.worker.js` uit deze map, en klik **Deploy**.
3. Zet de twee API-keys als secret. Ga naar de Worker > **Settings** > **Variables and Secrets** > **Add**:
   - Naam `ANTHROPIC_KEY`, waarde = jouw Anthropic API-key. Vink **Encrypt** / Secret aan.
   - Naam `OPENAI_KEY`, waarde = jouw OpenAI API-key. Idem secret.
   Klik **Deploy** / Save.
4. Noteer de **Worker-URL** (iets als `https://wellgroup-team-proxy.<jouw-subdomein>.workers.dev`).
5. Test: open `<Worker-URL>/health` in je browser. Je hoort `{"ok":true,...}` te zien. Werkt dat, dan staat de proxy.

---

## Stap 3 , Netlify (de app hosten)

1. Ga naar app.netlify.com (je hebt hier al een account). Maak een nieuwe site via **Add new site** > **Deploy manually** en sleep het bestand `index.html` (de nieuwste versie die ik je geef) erin.
2. Je krijgt een URL (bv `https://wellgroup.netlify.app`). Dit is de link die je met het team deelt.
3. Optioneel maar aangeraden: zet in de Worker `ALLOW_ORIGIN` op exact deze Netlify-URL in plaats van `*`, en deploy de Worker opnieuw. Dan kan alleen jouw app de proxy gebruiken.

---

## Stap 4 , Stuur mij drie waarden

Zodra stap 1 tot 3 staan, stuur me:

1. **Supabase Project URL**
2. **Supabase anon public key**
3. **Worker-URL**

Dan bak ik die in de app en bouw ik de datalaag om: localStorage eruit, Supabase erin (auto-opslag + live sync), en alle Claude- en OpenAI-calls lopen via de Worker. Daarna vult niemand nog keys of een proxy in, en zijn jullie synchroon.

---

## Stap 5 , Je huidige data overzetten (geen verlies)

Je bestaande producten, personas, bibliotheek en scripts staan nu in je browser. We raken ze niet kwijt:

- In de huidige app: ga naar Bibliotheek en gebruik **Exporteer** (per merk) om een back-up-JSON te downloaden. Doe dit voor Wellshave en, als je dat gebruikt, voor Wellshine.
- In de nieuwe (server-)versie bouw ik een eenmalige **Importeer naar server**-knop: je laadt die JSON's, en ze worden naar Supabase geschreven. Vanaf dan werkt iedereen op die gedeelde data.

---

## Beveiliging , lees dit even

De start-opzet laat iedereen met de app-URL en de anon-key data lezen en schrijven. Voor een interne tool op een niet-publieke Netlify-URL is dat een prima begin. Wil je het echt dichttimmeren (aanbevolen zodra meer mensen meekijken):

- Zet **Supabase Auth** aan met een **e-mail-allowlist**, zodat alleen jullie teamleden kunnen inloggen, en scherp de RLS-policies aan op ingelogde gebruikers. Ik kan dit toevoegen.
- Beperk `ALLOW_ORIGIN` in de Worker tot je Netlify-domein (stap 3.3).

Zeg het maar als je deze hardening er meteen bij wilt; anders begin ik met de simpele opzet en zetten we de login er later op.

---

## Wat verandert er voor het team

Nu: ieder een lokale proxy + eigen keys + eigen losse data, niet synchroon.

Straks: iedereen opent één Netlify-URL, niemand stelt iets in, en producten, personas, bibliotheek en scripts zijn gedeeld en slaan automatisch op. Precies wat je wilde.
