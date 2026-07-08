# Ad generator — "Atelier Console"

The new Wellshave ad generator is a single HTML app, live at
**https://wellshave-adgen.netlify.app**, running on **Claude Fable 5**. It talks
to the model through a proxy (so the Anthropic key never touches the browser).

## Step 1 — Fable 5 proxy ✅ (this repo)

A thin proxy exposing `POST /anthropic` that forwards the app's **native
Anthropic Messages** requests verbatim to `api.anthropic.com`, injecting the
`x-api-key`. Model fallback (Fable 5 → Opus 4.8) is handled **server-side by
Anthropic** via the `fallbacks` body field + `anthropic-beta` header, which the
proxy passes through untouched.

→ Code, docs and tests in [`proxy/`](./proxy/). Zero dependencies; deploys as a
Netlify Function, Cloudflare Worker, Supabase Edge Function, or standalone Node
service. Built to the exact contract the app's `fable5()` function expects.

**To go live:** deploy `proxy/` (or reuse the existing `wellgroup-team-proxy`
Cloudflare Worker, which implements the same contract), set `ANTHROPIC_API_KEY`
(Fable 5 access + ≥30d data retention), then paste the proxy URL into the app at
**Instellingen (⚙) → Team-proxy URL** and hit **Test proxy**. See
[`proxy/README.md`](./proxy/README.md).

## Notes

- The app is native-Anthropic. The OpenAI-compatible `/compat/chat/completions`
  route (Cloudflare AI Gateway) belongs to the **old** tool (OpenAI, for images)
  and is not used here.
