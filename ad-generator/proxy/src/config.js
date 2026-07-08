// Runtime configuration for the Fable 5 proxy.
// Everything is driven by environment variables so no secret ever lives in the repo.

function firstEnv(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return '';
}

export const CONFIG = {
  // Required: the server-side Anthropic key the proxy injects on every call.
  // Accepts ANTHROPIC_API_KEY or ANTHROPIC_KEY (the name the Cloudflare worker uses).
  // Must have Fable 5 access AND the org must have >= 30 days data retention
  // (Fable 5 does not run under zero-data-retention).
  anthropicApiKey: firstEnv('ANTHROPIC_API_KEY', 'ANTHROPIC_KEY'),

  // Upstream Anthropic API base (override to point at a mock or gateway).
  anthropicBaseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),

  // Defaults used only when the caller does not send these headers itself.
  // The Atelier Console app always sends both; these keep direct curls working.
  defaultAnthropicVersion: process.env.ANTHROPIC_VERSION || '2023-06-01',
  defaultAnthropicBeta: process.env.ANTHROPIC_BETA || 'server-side-fallback-2026-06-01',

  // CORS origin echoed to browser callers. "*" by default; set to the app origin
  // (https://wellshave-adgen.netlify.app) to lock it down.
  corsOrigin: process.env.CORS_ORIGIN || '*',

  serviceName: process.env.SERVICE_NAME || 'fable5-proxy',

  // Standalone server port (ignored on serverless platforms).
  port: parseInt(process.env.PORT || '8787', 10),
};
