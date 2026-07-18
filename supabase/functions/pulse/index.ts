// Pulse — serveert het Wellshave Marketing HQ dashboard.
// Live: https://bequyhghgkvekvibufhw.supabase.co/functions/v1/pulse/
// Assets staan in marketing_hq.dashboard_assets (view public.pulse_assets,
// alleen leesbaar voor service_role). Dashboard updaten = de rijen in die
// tabel updaten vanuit dashboard/ (geen redeploy nodig; cache is 60s).
// verify_jwt staat uit: dit is een publieke loginpagina; alle data zit
// achter Supabase Auth + RLS (migratie 0002).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

let cache: Map<string, { body: string; mime: string }> | null = null;
let cachedAt = 0;

async function loadAssets(): Promise<Map<string, { body: string; mime: string }>> {
  const now = Date.now();
  if (cache && now - cachedAt < 60_000) return cache;
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${base}/rest/v1/pulse_assets?select=path,mime,body`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`assets load failed: ${res.status} ${await res.text()}`);
  const rows: { path: string; mime: string; body: string }[] = await res.json();
  const m = new Map<string, { body: string; mime: string }>();
  for (const r of rows) m.set(r.path, { body: r.body, mime: r.mime });
  cache = m;
  cachedAt = now;
  return m;
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const idx = url.pathname.indexOf("/pulse");
    let path = idx >= 0 ? url.pathname.slice(idx + 6) : url.pathname;
    if (path === "") {
      // extern is de functie bereikbaar onder /functions/v1/pulse/
      return new Response(null, { status: 301, headers: { Location: "/functions/v1/pulse/" } });
    }
    if (path === "/") path = "/index.html";
    const assets = await loadAssets();
    const file = assets.get(path);
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(file.body, {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "no-cache",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    return new Response("Error: " + (err as Error).message, { status: 500 });
  }
});
