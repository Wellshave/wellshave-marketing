// Standalone Node server for local dev or self-hosting.
// Adapts Node's http req/res to the Web Fetch API so it shares one handler with
// the serverless deployment. Run with: `node server.js` (or `npm start`).

import http from 'node:http';
import { Readable } from 'node:stream';
import { handleRequest } from './src/handler.js';
import { CONFIG } from './src/config.js';

const server = http.createServer(async (req, res) => {
  try {
    const request = await toWebRequest(req);
    const response = await handleRequest(request);

    const headers = {};
    for (const [k, v] of response.headers) headers[k] = v;
    res.writeHead(response.status, headers);

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message, type: 'proxy_error' } }));
  }
});

server.listen(CONFIG.port, () => {
  const keyState = CONFIG.anthropicApiKey ? 'set' : 'MISSING (set ANTHROPIC_API_KEY)';
  console.log(`${CONFIG.serviceName} listening on http://localhost:${CONFIG.port}`);
  console.log(`  POST /anthropic -> ${CONFIG.anthropicBaseUrl}/v1/messages   anthropic key=${keyState}`);
});

async function toWebRequest(req) {
  const url = 'http://localhost' + req.url;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v != null) headers.set(k, v);
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = Buffer.concat(chunks);
  }

  return new Request(url, { method: req.method, headers, body });
}
