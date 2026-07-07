// Runtime configuration for the Fable 5 proxy.
// Everything is driven by environment variables so no secret ever lives in the repo.

function bool(v, dflt = false) {
  if (v == null || v === '') return dflt;
  return /^(1|true|yes|on)$/i.test(String(v));
}

export const CONFIG = {
  // Upstream Anthropic API (the proxy calls this on the server side).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicBaseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),
  anthropicVersion: process.env.ANTHROPIC_VERSION || '2023-06-01',

  // Model routing: force Fable 5, fall back to Opus 4.8 when Fable 5 is unavailable.
  primaryModel: process.env.PRIMARY_MODEL || 'claude-fable-5',
  fallbackModel: process.env.FALLBACK_MODEL || 'claude-opus-4-8',

  // When true, honour a client-supplied `claude-*` model instead of forcing the primary.
  // The fallback model is still used if that model turns out to be unavailable.
  allowModelOverride: bool(process.env.ALLOW_MODEL_OVERRIDE, false),

  // Optional shared secret. If set, callers must present it as
  // `Authorization: Bearer <key>` or `x-api-key: <key>`. If empty, the proxy is open
  // (fine for local dev; set it for any public deployment).
  proxyApiKey: process.env.PROXY_API_KEY || '',

  // CORS origin echoed back for browser callers. "*" by default.
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Default max_tokens when the caller does not specify one (Anthropic requires it).
  defaultMaxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS || '4096', 10),

  // Standalone server port (ignored on serverless platforms).
  port: parseInt(process.env.PORT || '8787', 10),
};

export function missingKeyResponseNeeded() {
  return !CONFIG.anthropicApiKey;
}
