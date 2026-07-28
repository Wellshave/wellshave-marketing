# De Ad Generator op je telefoon: proxy via Cloudflare Worker

Hiermee werkt ook de **beeldgeneratie** (OpenAI) op je telefoon, zonder dat je laptop aan hoeft te staan. Het concept- en copywerk (Anthropic) werkt sowieso al direct in de browser; alleen de stap "Genereer afbeelding" had de proxy nodig.

Je hoeft geen command line te gebruiken; alles gaat via het Cloudflare-dashboard. Eenmalige setup, daarna werkt het overal.

## Waarom een Worker en geen Netlify-functie

OpenAI staat geen directe browser-calls toe (CORS), dus er moet iets tussen zitten dat de call doorstuurt. Een Netlify-functie kapt synchroon af na maximaal 26 seconden, terwijl beeldgeneratie 20 tot 90 seconden duurt, dus die zou bij de meeste beelden falen. Een Cloudflare Worker mag wel lang wachten op de OpenAI-call en handelt dit betrouwbaar af. Beide zijn serverless en gratis.

## Stap voor stap (eenmalig, ongeveer 10 minuten)

1. **Maak een gratis Cloudflare-account** op https://dash.cloudflare.com/sign-up (geen creditcard nodig voor de gratis Workers).

2. In het dashboard, ga links naar **Compute (Workers)** of **Workers & Pages**.

3. Klik **Create application** (of **Create**), kies **Create Worker** (een los script, geen Pages).

4. Geef het een naam, bijvoorbeeld `wellgroup-openai-proxy`. Klik **Deploy** om de standaard hello-world te plaatsen.

5. Klik daarna **Edit code** (of **Quick edit**). Verwijder alle voorbeeldcode in de editor.

6. Open het bestand **`wellgroup-openai-proxy.worker.js`** (staat in deze map), kopieer de volledige inhoud en plak die in de editor.

7. Klik **Deploy** (rechtsboven). 

8. Je Worker heeft nu een URL, iets als:
   `https://wellgroup-openai-proxy.JOUW-NAAM.workers.dev`
   Kopieer die URL. Tip: open hem even in je browser; je hoort de tekst te zien dat de proxy draait.

## In de app instellen

1. Open de Ad Generator (op je telefoon of laptop maakt niet uit).
2. Ga naar **Instellingen** (API keys & modellen) en zoek het veld voor de **OpenAI proxy URL**. Standaard staat daar `http://localhost:8787`.
3. Vervang dat door je **Worker-URL** uit stap 8 hierboven (de volledige `https://...workers.dev`).
4. Vul je OpenAI API key in (als dat nog niet is gebeurd) en je Anthropic key.
5. Genereer een concept en klik **Genereer afbeelding**. Nu loopt de beeldcall via de Worker en werkt het ook op de telefoon.

Let op: het proxy-veld onthoudt de waarde per apparaat/browser. Zet de Worker-URL dus zowel op je telefoon als op je laptop als je op beide wilt werken. Op de laptop kun je nog steeds de lokale `localhost:8787`-proxy gebruiken als je dat liever doet.

## Is dit veilig?

Je OpenAI API key gaat van je browser, via jouw eigen Worker (op jouw eigen Cloudflare-account), direct door naar OpenAI. De Worker bewaart of logt de key niet, hij stuurt 'm alleen door. Dit is hetzelfde vertrouwensmodel als de lokale proxy, alleen gehost in plaats van op je laptop.

Wil je het extra dichtzetten, dan kun je later in de Worker de toegestane herkomst (`Access-Control-Allow-Origin`) beperken tot alleen het adres van je app in plaats van `*`. Vraag dat gerust, dan pas ik het aan.

## Problemen oplossen

- **"Kon OpenAI niet bereiken" of een 401/403:** check of je OpenAI key klopt en of je de volledige Worker-URL hebt geplakt (met `https://` en zonder spatie erachter).
- **Niets gebeurt bij Genereer afbeelding:** open de Worker-URL in je browser; zie je de "draait"-tekst niet, dan is de deploy niet gelukt; plak de code opnieuw en deploy nog eens.
- **Werkt op laptop maar niet op telefoon:** je hebt de Worker-URL waarschijnlijk alleen op de laptop ingevuld. Zet hem ook in het proxy-veld op de telefoon.
