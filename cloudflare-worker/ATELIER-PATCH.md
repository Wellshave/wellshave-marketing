# Atelier Console → team-proxy: 2 hand-edits in de LIVE editor

⚠️ De live worker is nieuwer dan elke lokale kopie (o.a. `brandOf()`/X-Brand,
`verifyTeam` die een **object** `{ ok, email, exp }` teruggeeft, en een
`user_permissions.can_write`-systeem). **Plak dus nooit een bestand integraal
over de live code** — doe uitsluitend deze twee toevoegingen in de
Cloudflare-editor (dash.cloudflare.com → Workers → `wellgroup-team-proxy`).
`wellgroup-team-proxy.js` in deze map is een verouderde referentie-mirror.

## Edit 1 — `ALLOWED_ORIGINS` (1 regel aanvullen)

Voeg toe aan de bestaande array (niets weghalen):

```js
'https://wellshave-adgen.netlify.app',
```

## Edit 2 — `verifyTeam`: Atelier-logins (object-vorm)

Zoek in `verifyTeam` de regel `_teamCache.set(t, out);` en plak er direct
bóven:

```js
  /* [ATELIER] logins van de ad-generator (eigen Supabase-project) accepteren.
     Daar staat zelf-registratie AAN, dus alleen door een admin goedgekeurde
     leden (team_members.status = 'approved'). */
  if (!out.ok) {
    try {
      const AT_URL = 'https://bequyhghgkvekvibufhw.supabase.co';
      const AT_KEY = 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv';
      const r2 = await fetch(AT_URL + '/auth/v1/user', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': AT_KEY } });
      if (r2.ok) {
        const u2 = await r2.json();
        if (u2 && u2.id) {
          const r3 = await fetch(AT_URL + '/rest/v1/team_members?id=eq.' + u2.id + '&select=status', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': AT_KEY } });
          if (r3.ok) {
            const rows = await r3.json();
            if (rows && rows[0] && rows[0].status === 'approved') out = { ok: true, email: (u2.email || '').toLowerCase(), exp: now + 60000 };
          }
        }
      }
    } catch (e2) { }
  }
```

Behoudt de object-vorm (incl. `email` voor `user_permissions`); raakt
`brandOf`, bol, notify en nightly niet aan. Strenger dan de bol-OS-regel:
niet-goedgekeurde zelf-registraties komen er niet door.

## Daarna

1. **Deploy** (rechtsboven). Vangnet: Deployments → vorige versie → Rollback.
2. Atelier Console (ingelogd, key-veld leeg) → ⚙ → **Test AI-verbinding** →
   "✓ Verbonden via team-proxy".
3. Verificatie op afstand: Claude kan de worker proben (preflight-origin +
   /anthropic-status) — vraag om een "check".

## Historie

- 11 jul 2026: 404 op /anthropic bleek een oude deploy; latere live versie
  had /anthropic + 401-gate maar nog geen Atelier-origins/-logins.
- Preflight-probe bewees: live bevat `X-Brand` die niet in Dustins upload zat
  → integraal vervangen definitief afgekeurd; hand-edits zijn de enige route.
