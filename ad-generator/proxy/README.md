# Fable 5 proxy

**Ad generator — step 1.** A small, zero-dependency proxy that puts **Claude
Fable 5** (`claude-fable-5`) behind the API the ad generator already speaks, with
**automatic fallback to Opus 4.8** (`claude-opus-4-8`) whenever Fable 5 is
unavailable (per the Notion note: *"toegang tot Fable 5 was eerder tijdelijk
beperkt — als het niet beschikbaar is, kan Opus 4.8 als fallback dienen"*).

The ad generator currently runs on the OpenAI Chat Completions format. Point it
at this proxy and its "brain" becomes Fable 5 — **no other code change needed**.

## What it does

- Accepts **OpenAI Chat Completions** requests (`POST /v1/chat/completions`) and
  translates them to the Anthropic Messages API, then translates the answer
  back. Streaming and non-streaming both supported.
- Forces the model to Fable 5 and **falls back to Opus 4.8** on model-unavailable
  errors (404 / 403 / 529 / model-not-found 400s). Real request errors are *not*
  masked — they pass straight through.
- Also offers an **Anthropic-native passthrough** (`POST /v1/messages`) that
  keeps the native shape but still applies the model forcing + fallback + auth,
  so the existing "Ad generator Claude" key path can route through Fable 5 too.
- The Anthropic key lives only in an env var. **No secret is ever committed.**

## Endpoints

| Method | Path                    | Purpose                                   |
| ------ | ----------------------- | ----------------------------------------- |
| POST   | `/v1/chat/completions`  | OpenAI-compatible (primary use)           |
| POST   | `/v1/messages`          | Anthropic-native passthrough              |
| GET    | `/v1/models`            | Lists the primary + fallback model        |
| GET    | `/health`               | Health + effective config                 |

## Quickstart (local)

```bash
cd ad-generator/proxy
cp .env.example .env          # then paste the Anthropic key into .env
node --env-file=.env server.js   # Node >= 20.6; or: export the vars and `npm start`
```

Smoke test it:

```bash
curl -s localhost:8787/v1/chat/completions \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer <PROXY_API_KEY>' \
  -d '{"messages":[{"role":"user","content":"Write a punchy Wellshave headline."}]}'
```

## Configuration

All via environment variables (see `.env.example`):

| Variable               | Default                | Notes                                                            |
| ---------------------- | ---------------------- | ---------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | —                      | **Required.** Use the "API Ad generator Claude" key.             |
| `PROXY_API_KEY`        | *(empty = open)*       | Shared secret callers must send. **Set it for any public deploy.** |
| `PRIMARY_MODEL`        | `claude-fable-5`       | The model the proxy forces.                                      |
| `FALLBACK_MODEL`       | `claude-opus-4-8`      | Used when the primary is unavailable.                            |
| `ALLOW_MODEL_OVERRIDE` | `false`                | Let callers pick a different `claude-*` model.                   |
| `DEFAULT_MAX_TOKENS`   | `4096`                 | Used when the caller omits `max_tokens` (Anthropic requires it). |
| `ANTHROPIC_BASE_URL`   | `https://api.anthropic.com` | Point at a gateway (e.g. Cloudflare AI Gateway) if desired.  |
| `CORS_ORIGIN`          | `*`                    | Echoed to browser callers.                                       |
| `PORT`                 | `8787`                 | Standalone server only.                                          |

## Deploy

**Netlify Functions (recommended — you already deploy here).**
1. New site from this repo; set **Base directory** to `ad-generator/proxy`.
2. Add env vars `ANTHROPIC_API_KEY` and `PROXY_API_KEY` (and any overrides).
3. Deploy. The function in `netlify/functions/proxy.js` serves every route via
   the Web-standard `Request → Response` handler in `src/handler.js`.

**Other targets.** The core is a plain `handleRequest(request: Request):
Promise<Response>` in `src/handler.js`, so it drops into any Web-Fetch runtime:
- **Supabase Edge Function (Deno):** `Deno.serve((req) => handleRequest(req))`.
- **Cloudflare Worker:** `export default { fetch: handleRequest }`.
- **Self-host / any Node box:** `node server.js`.

## Point the ad generator at it

Change the ad generator's OpenAI base URL to the proxy and use the
`PROXY_API_KEY` as the API key:

- Base URL: `https://<your-deploy>/v1`
- API key: your `PROXY_API_KEY`

It will keep sending OpenAI-format requests; it now gets Fable 5 answers.

## Tests

```bash
node test/smoke.mjs         # offline unit tests (translation, streaming, fallback rules)
node test/integration.mjs   # end-to-end through a mock Anthropic upstream
```

## Notes / limits

- Translation covers what an ad generator uses: system prompts, multi-turn text,
  image inputs, `temperature`/`top_p`/`max_tokens`/`stop`, `response_format`
  JSON hinting, streaming, and function/tool calls.
- `response_format: json_object` is enforced by a system-prompt instruction
  (Anthropic has no dedicated parameter), not by a hard schema.
- Fallback is intentionally conservative so genuine 400/422 request bugs surface
  instead of being retried on the fallback model.
