/**
 * Wellgroup OpenAI proxy , Cloudflare Worker
 * =========================================
 * Vervangt de lokale openai-proxy.py zodat de Ad Generator OOK op de telefoon
 * (of overal) beeldgeneratie kan doen, zonder dat je laptop aan hoeft te staan.
 *
 * Waarom: OpenAI's API staat geen directe browser-calls toe (CORS). Deze Worker
 * zet de juiste CORS-headers en stuurt de call door naar OpenAI. Omdat een
 * Cloudflare Worker lang mag wachten op een externe call, handelt hij de trage
 * beeldgeneratie (20-90s) betrouwbaar af, anders dan een Netlify-functie die na
 * maximaal 26s afkapt.
 *
 * De OpenAI API key gaat van je browser, via deze Worker (jouw eigen account),
 * direct door naar OpenAI. De Worker bewaart of logt de key niet.
 *
 * Deploy: zie mobiel-proxy-cloudflare-setup.md (via het Cloudflare-dashboard,
 * code plakken en deployen, geen command line nodig).
 */

const TARGET = "https://api.openai.com";
const ALLOWED_PATHS = [
  "/v1/images/generations",
  "/v1/images/edits",
  "/v1/images/variations",
  "/v1/responses",
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, OpenAI-Organization, OpenAI-Beta",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health check (handig om in de browser te openen)
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response(
        "Wellgroup OpenAI proxy (Cloudflare Worker) draait. Zet deze URL in het proxy-veld van de app.",
        { status: 200, headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    if (request.method !== "POST") {
      return json({ error: { message: "Methode niet toegestaan" } }, 405);
    }

    // Alleen de OpenAI image-endpoints doorlaten
    if (!ALLOWED_PATHS.some((p) => url.pathname.startsWith(p))) {
      return json({ error: { message: "Path niet toegestaan: " + url.pathname } }, 403);
    }

    const auth = request.headers.get("Authorization");
    if (!auth) {
      return json(
        { error: { message: "Geen Authorization header. Vul je OpenAI key in de app in." } },
        401
      );
    }

    // Headers die we doorsturen (Content-Type bevat de multipart boundary, belangrijk voor /edits)
    const fwd = new Headers();
    fwd.set("Authorization", auth);
    const ct = request.headers.get("Content-Type");
    if (ct) fwd.set("Content-Type", ct);
    for (const h of ["OpenAI-Organization", "OpenAI-Beta"]) {
      const v = request.headers.get(h);
      if (v) fwd.set(h, v);
    }

    // Body volledig inlezen en doorsturen (werkt voor JSON en multipart met afbeeldingen)
    const body = await request.arrayBuffer();

    let upstream;
    try {
      upstream = await fetch(TARGET + url.pathname + url.search, {
        method: "POST",
        headers: fwd,
        body: body,
      });
    } catch (e) {
      return json(
        { error: { message: "Kon OpenAI niet bereiken: " + (e && e.message ? e.message : String(e)) } },
        502
      );
    }

    // Antwoord teruggeven met CORS-headers
    const respHeaders = new Headers(corsHeaders());
    const upCt = upstream.headers.get("Content-Type");
    if (upCt) respHeaders.set("Content-Type", upCt);
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  },
};
