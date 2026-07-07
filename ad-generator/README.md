# Ad generator

Rebuild / upgrade of the Wellshave ad generator, on top of **Claude Fable 5**.

## Step 1 — Fable 5 proxy ✅ (this commit)

Put Fable 5 behind the API the ad generator already speaks (OpenAI Chat
Completions), with automatic fallback to Opus 4.8. Pointing the existing
generator at this proxy swaps its brain to Fable 5 with no other code change.

→ Code, docs and tests in [`proxy/`](./proxy/). It runs as a Netlify Function
or a standalone Node service, is zero-dependency, and keeps the Anthropic key
in an env var (never in the repo).

**To go live:** deploy `proxy/` (Netlify base dir `ad-generator/proxy`), set
`ANTHROPIC_API_KEY` + `PROXY_API_KEY`, then repoint the ad generator's OpenAI
base URL at the proxy. See [`proxy/README.md`](./proxy/README.md).

## Candidate next steps (to confirm with Dustin)

Pulled from the Wellshave OS "Claude systemen" notes — **not yet specced**, listed
here so step 1 has a home and the direction is visible:

- **Meta data in the generator** — "Claude meta acc laten ophalen en laten
  displayen in ad generator": pull the Meta ad account performance data and
  surface it inside the generator.
- **Wizard mode** — "Wizard mode modus op ad generator. Spar met Rory": an
  interactive back-and-forth where the model asks clarifying questions before
  producing a master output.
- **Headline quality guardrails** — no puzzle-like / confusing headlines (from
  the "Brief ad generator" task).

Each of these becomes its own step once scoped.
