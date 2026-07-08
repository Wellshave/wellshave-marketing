// Netlify Function (v2) wrapper. Netlify v2 functions already speak the Web
// Fetch API (Request -> Response), so this is a thin pass-through to the shared
// handler. The `path` config routes every proxy endpoint to this function.
//
// Deploy: set the Netlify "base directory" to `ad-generator/proxy` and add the
// ANTHROPIC_API_KEY (Fable 5 + >=30d retention) as a site environment variable.

import { handleRequest } from '../../src/handler.js';

export default async (request) => handleRequest(request);

export const config = {
  path: ['/', '/health', '/anthropic'],
};
