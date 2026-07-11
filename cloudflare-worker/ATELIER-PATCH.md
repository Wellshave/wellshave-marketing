# Atelier Console → team-proxy: 2 hand-edits (NIETS vervangen)

De worker `wellgroup-team-proxy.dustin-9ff.workers.dev` is een gedeeld
productiesysteem (bol OS, notify-relay, nightly, OpenAI). **Plak er dus nooit
een heel bestand overheen.** De Atelier Console heeft precies twee kleine
toevoegingen nodig in de bestaande code — nul regels verwijderen.

Werkwijze: Cloudflare → Workers & Pages → `wellgroup-team-proxy` → Edit code.
(Vooraf gerust: onder **Deployments** kun je met één klik terug naar de vorige
versie als er iets geks gebeurt.)

---

## Edit 1 — origin van de ad-generator toestaan (1 regel aanvullen)

Zoek bovenin de regel met `const ALLOWED_ORIGINS = [...]` en voeg deze entries
**toe aan de bestaande array** (niets weghalen):

```js
'https://wellshave-adgen.netlify.app', 'http://localhost:8823', 'http://127.0.0.1:8823'
```

Resultaat (als je array nu de standaard drie had):

```js
const ALLOWED_ORIGINS = ['https://bol-os.netlify.app', 'https://wellshave-adgen.netlify.app', 'http://localhost:8123', 'http://127.0.0.1:8123', 'http://localhost:8823', 'http://127.0.0.1:8823'];
```

Zonder deze edit blokkeert de browser (CORS) alle antwoorden richting de
Atelier Console — ook al is alles verder goed.

## Edit 2 — logins van het Atelier-Supabase-project accepteren (blok invoegen)

De Atelier Console logt in op zijn éigen Supabase-project
(`bequyhghgkvekvibufhw`), niet op het bol-OS-project. Zoek in de functie
`verifyTeam` deze twee regels:

```js
  } catch (e) { ok = false; }
  _teamCache.set(t, { exp: now + 60000, ok });
```

en voeg **tussen** die twee regels dit blok in:

```js
  /* [ATELIER] óók logins van het Atelier Console-Supabase-project accepteren
     (zelfde e-maildomein-check; de ad-generator heeft een eigen project) */
  if (!ok) {
    try {
      const r2 = await fetch('https://bequyhghgkvekvibufhw.supabase.co/auth/v1/user', {
        headers: { 'Authorization': 'Bearer ' + t, 'apikey': 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv' }
      });
      if (r2.ok) {
        const u2 = await r2.json();
        const e2 = ((u2 && u2.email) || '').toLowerCase();
        ok = ALLOWED_DOMAINS.some(d => e2.endsWith('@' + d));
      }
    } catch (e2) { }
  }
```

De beveiliging blijft identiek: alleen een geldige, ingelogde sessie met een
e-mailadres op `ALLOWED_DOMAINS` komt erdoor. Er verandert niets aan
X-Service-Token, notify, bol, OpenAI of nightly.

---

## Daarna: Deploy + smoke-test (2 min)

1. **Deploy** in de worker-editor.
2. `https://wellgroup-team-proxy.dustin-9ff.workers.dev/health` openen →
   `{"ok":true,...}`.
3. **bol OS** openen → laadt en werkt zoals altijd (er is niets aan die routes
   veranderd).
4. **Atelier Console** (nieuwste index.html, ingelogd met @wellshave.com):
   ⚙ Instellingen → key-veld leeg, proxy-URL ingevuld → **Test AI-verbinding**
   → "✓ Verbonden via team-proxy — Fable 5 antwoordde: OK".
5. Iets mis? Workers → **Deployments** → vorige versie → Rollback.

## Over de bestanden in deze map

- `ATELIER-PATCH.md` (dit bestand) = de canonieke instructie: hand-edits, geen
  vervanging.
- `wellgroup-team-proxy.js` = referentie-mirror van de worker-code zoals Dustin
  die op 11 jul 2026 deelde, mét de twee patches al verwerkt. Alleen gebruiken
  om te diffen/nalezen — **niet blind over de live code heen plakken**, want de
  live worker kan nieuwer/uitgebreider zijn dan deze mirror.
- Een eerder gedeeld kort proxy-script (~60 regels) is **achterhaald** en
  vervangen door deze aanpak.
