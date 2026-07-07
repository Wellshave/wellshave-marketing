// Calls the Anthropic Messages API, forcing the primary model (Fable 5) and
// automatically retrying on the fallback model (Opus 4.8) when the primary is
// unavailable — matching the note in Notion that Fable 5 access can be limited.

import { CONFIG } from './config.js';

// Which upstream failures mean "this model isn't available, try the next one".
// Deliberately conservative: real request bugs (422, most 400s) must NOT be
// masked by silently switching models.
export function isModelUnavailable(status, errJson) {
  if (status === 404 || status === 403) return true;   // not found / no access
  if (status === 529) return true;                      // overloaded / temporarily unavailable
  if (status === 400 && errJson && errJson.error) {
    const msg = String(errJson.error.message || '').toLowerCase();
    const type = String(errJson.error.type || '').toLowerCase();
    if (type.includes('not_found')) return true;
    if (msg.includes('model') &&
        /(not found|not exist|does not exist|unknown|permission|access|not allowed|invalid)/.test(msg)) {
      return true;
    }
  }
  return false;
}

// Returns { res, model, usedFallback } on success (res is the live fetch Response,
// possibly a stream), or { error } on failure where error = { status, text, errJson, model }.
export async function callAnthropic(anthropicReq, { stream = false, overrideModel = null } = {}) {
  if (!CONFIG.anthropicApiKey) {
    return { error: { status: 500, text: 'ANTHROPIC_API_KEY is not set on the proxy', errJson: null, model: null } };
  }

  const models = [];
  if (overrideModel && CONFIG.allowModelOverride) models.push(overrideModel);
  else models.push(CONFIG.primaryModel);
  if (CONFIG.fallbackModel && !models.includes(CONFIG.fallbackModel)) models.push(CONFIG.fallbackModel);

  let lastError = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    let res;
    try {
      res = await fetch(CONFIG.anthropicBaseUrl + '/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': CONFIG.anthropicApiKey,
          'anthropic-version': CONFIG.anthropicVersion,
        },
        body: JSON.stringify({ ...anthropicReq, model, stream }),
      });
    } catch (e) {
      lastError = { status: 502, text: 'Upstream request failed: ' + e.message, errJson: null, model };
      // Network error — try the next model if there is one.
      continue;
    }

    if (res.ok) return { res, model, usedFallback: i > 0 };

    // Non-2xx: read the body so we can decide whether to fall back.
    const text = await res.text();
    let errJson = null;
    try { errJson = JSON.parse(text); } catch { /* leave null */ }
    lastError = { status: res.status, text, errJson, model };

    const hasNext = i < models.length - 1;
    if (!(hasNext && isModelUnavailable(res.status, errJson))) {
      return { error: lastError };
    }
    // Otherwise fall through to the next (fallback) model.
  }

  return { error: lastError };
}
