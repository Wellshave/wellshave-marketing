# Fable 5 proxy

**Ad generator — step 1.** A tiny, zero-dependency proxy that lets the new ad
generator (**"Atelier Console"**, live at https://wellshave-adgen.netlify.app —
one HTML file) reach **Claude Fable 5** from the browser without exposing the
Anthropic key.

The app calls the proxy via its `fable5()` function using the **native Anthropic
Messages API** format. Model fallback (Fable 5 → Opus 4.8) is handled
**server-side by Anthropic** via the `fallbacks` field in the body plus the
`anthropic-beta: server-side-fallback-2026-06-01` header — the proxy just
forwards everything verbatim.

## The contract

`POST /anthropic` — forward the body **byte-for-byte** to
`https://api.anthropic.com/v1/messages`, injecting `x-api-key` and passing
`anthropic-version` + `anthropic-beta` through unchanged. Return the Anthropic
JSON response **unchanged**.

```
POST <proxy>/anthropic
  content-type: application/json
  anthropic-version: 2023-06-01
  anthropic-beta: server-side-fallback-2026-06-01
  body: { model:"claude-fable-5", max_tokens, output_config?, fallbacks:[…], system, messages }
→ relays Anthropic's { stop_reason, content:[{type:"text",text}], usage, … }
```

| Method | Path         | Purpose                                            |
| ------ | ------------ | -------------------------------------------------- |
| POST   | `/anthropic` | verbatim passthrough to Anthropic Messages         |
| GET    | `/health`    | `{ ok: true, service }` — the app's "Test proxy" button |
| GET    | `/`          | same as `/health`                                  |
| OPTIONS| any          | CORS preflight → 204                                |

CORS: `Access-Control-Allow-Origin: *`, allow-headers include `Content-Type,
anthropic-version, anthropic-beta`.

The proxy does **not** parse, translate or rewrite the body — `output_config`,
`fallbacks`, `system`, `messages` all reach Anthropic exactly as sent. It does
**not** do its own fallback (that's server-side). The OpenAI-compatible
`/compat/chat/completions` route of the Cloudflare AI Gateway is the **old** tool
(OpenAI, for images) and is intentionally not used here.

## Requirements

- `ANTHROPIC_API_KEY` (or `ANTHROPIC_KEY`) with **Fable 5 access**.
- The org must have **≥ 30 days data retention** — Fable 5 does not run under
  zero-data-retention.

## Quickstart (local)

```bash
cd ad-generator/proxy
cp .env.example .env        # paste the Anthropic key
node --env-file=.env server.js   # Node >= 20.6; or export the vars and `npm start`

curl localhost:8787/health
curl localhost:8787/anthropic -H 'content-type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -H 'anthropic-beta: server-side-fallback-2026-06-01' \
  -d '{"model":"claude-fable-5","max_tokens":100,"messages":[{"role":"user","content":"hi"}]}'
```

## Configuration

| Variable             | Default                              | Notes                                            |
| -------------------- | ------------------------------------ | ------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | — (also reads `ANTHROPIC_KEY`)       | **Required.** Fable 5 access + ≥30d retention.   |
| `CORS_ORIGIN`        | `*`                                  | Set to `https://wellshave-adgen.netlify.app` to lock down. |
| `ANTHROPIC_VERSION`  | `2023-06-01`                         | Only used if the caller omits the header.        |
| `ANTHROPIC_BETA`     | `server-side-fallback-2026-06-01`    | Only used if the caller omits the header.        |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com`          | Point at a mock/gateway for testing.             |
| `PORT`               | `8787`                               | Standalone server only.                          |

## Deploy

**Netlify (recommended — the app already lives on Netlify).** Deploy this as its
own site so the proxy URL is separate from the app:
1. New site from this repo; **Base directory** = `ad-generator/proxy`.
2. Add env var `ANTHROPIC_API_KEY`.
3. Deploy. `netlify/functions/proxy.js` serves `/anthropic`, `/health`, `/`.

The core is a Web-standard `handleRequest(request): Response`, so it also drops
into a **Cloudflare Worker** (`export default { fetch: handleRequest }`), a
**Supabase Edge Function** (`Deno.serve(handleRequest)`), or any Node box
(`node server.js`).

> Already have the `wellgroup-team-proxy` Cloudflare Worker live with Fable 5
> access? It implements this same `/anthropic` contract — just use its URL and
> skip deploying this one. This repo copy is for a version-controlled Netlify
> deploy.

## Wire it into the app

In the app: **Instellingen (⚙) → Team-proxy URL** = your deploy URL **without
`/anthropic`** (the app appends it). Click **Test proxy** (pings `/health`).

## Tests

```bash
npm test   # node test/smoke.mjs (routing/CORS) && node test/integration.mjs (mock upstream)
```
