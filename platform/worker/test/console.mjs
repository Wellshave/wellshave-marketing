/* Testlus voor de console-kant van de worker — de deploy-veiligheid.
 *
 * `npx wrangler deploy` vervangt de code van de bestaande worker
 * `marketing-ads`. Die worker bedient op dit moment de live Atelier Console:
 * elke keer dat iemand van het team copy of een beeld genereert, gaat dat via
 * /anthropic of /openai. Gaat daar iets stuk, dan staat het team stil, en dan
 * is de oorzaak een deploy die over agents ging.
 *
 * Deze lus vergelijkt het gedrag met de oude atelier-proxy zoals die nu draait.
 * De verwachtingen hieronder zijn afgelezen uit de daadwerkelijk gedeployde
 * code (opgehaald 30 juli 2026), niet uit het geheugen.
 *
 *   node platform/worker/test/console.mjs
 */

import worker from '../marketing-os.worker.js';

const doorgegeven = [];

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const ok = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) {
    const t = (opts.headers || {})['Authorization'] || '';
    if (t.includes('goed')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });
    return new Response('{}', { status: 401 });
  }
  if (url.includes('/rest/v1/team_members')) {
    return ok(url.includes('u1') ? [{ status: 'approved' }] : []);
  }
  if (url.includes('api.anthropic.com')) {
    doorgegeven.push({ dienst: 'anthropic', headers: opts.headers, body: opts.body });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'hoi' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('api.openai.com')) {
    doorgegeven.push({ dienst: 'openai', url, method: opts.method, headers: opts.headers });
    return new Response(new Uint8Array([137, 80, 78, 71]),
      { status: 200, headers: { 'Content-Type': 'image/png' } });
  }
  throw new Error('onverwachte fetch: ' + url);
};

const env = { ANTHROPIC_KEY: 'sk-ant-test', OPENAI_KEY: 'sk-test' };

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

/* ── CORS ────────────────────────────────────────────────────────────────── */
console.log('\n  CORS — de console draait op Netlify en lokaal');
for (const origin of ['https://wellshave-adgen.netlify.app', 'http://localhost:8823', 'http://127.0.0.1:8823']) {
  const r = await worker.fetch(new Request('https://w/health', { headers: { Origin: origin } }), env);
  check(`${origin} mag erbij`, r.headers.get('Access-Control-Allow-Origin'), origin);
}
const vreemd = await worker.fetch(new Request('https://w/health', { headers: { Origin: 'https://kwaad.example' } }), env);
check('een vreemde origin krijgt niet zijn eigen origin terug',
  vreemd.headers.get('Access-Control-Allow-Origin'), 'https://wellshave-adgen.netlify.app');

const pre = await worker.fetch(new Request('https://w/anthropic', {
  method: 'OPTIONS', headers: { Origin: 'https://wellshave-adgen.netlify.app' }
}), env);
check('preflight geeft 204', pre.status, 204);
check('en laat de anthropic-headers door',
  pre.headers.get('Access-Control-Allow-Headers'),
  'Content-Type, Authorization, anthropic-version, anthropic-beta');

/* ── Health blijft open ──────────────────────────────────────────────────── */
console.log('\n  health blijft open en zegt niets vertrouwelijks');
const gezond = await worker.fetch(new Request('https://w/health'), env);
check('geen login nodig', gezond.status, 200);
const gz = await gezond.json();
check('en ok', gz.ok, true);
check('geen accountnummers', JSON.stringify(gz).includes('242238038391551'), false);
check('geen sleutels', /sk-ant|sk-test|sb_secret|service_role/.test(JSON.stringify(gz)), false);

/* ── De grens: alleen goedgekeurde leden ─────────────────────────────────── */
console.log('\n  alleen goedgekeurde leden mogen genereren');
const zonder = await worker.fetch(new Request('https://w/anthropic', { method: 'POST', body: '{}' }), env);
check('zonder token: 401', zonder.status, 401);
const fout = await worker.fetch(new Request('https://w/anthropic', {
  method: 'POST', headers: { Authorization: 'Bearer slecht' }, body: '{}'
}), env);
check('met een ongeldig token: 401', fout.status, 401);

/* ── /anthropic ──────────────────────────────────────────────────────────── */
console.log('\n  /anthropic — waar de console zijn copy vandaan haalt');
doorgegeven.length = 0;
const claude = await worker.fetch(new Request('https://w/anthropic', {
  method: 'POST',
  headers: { Authorization: 'Bearer goed', 'Content-Type': 'application/json',
             'anthropic-version': '2023-06-01', 'anthropic-beta': 'iets-nieuws' },
  body: JSON.stringify({ model: 'claude-opus-5', messages: [] })
}), env);
check('gaat door', claude.status, 200);
const a = doorgegeven.find(d => d.dienst === 'anthropic');
check('met de sleutel van de worker, niet van de browser', a.headers['x-api-key'], 'sk-ant-test');
check('de anthropic-version wordt doorgegeven', a.headers['anthropic-version'], '2023-06-01');
/* De console gebruikt anthropic-beta voor nieuwere modelfuncties. Viel dat weg,
   dan zouden aanroepen stilletjes anders gaan werken in plaats van falen. */
check('en anthropic-beta ook', a.headers['anthropic-beta'], 'iets-nieuws');
check('het verzoek gaat ongewijzigd door',
  JSON.parse(a.body).model, 'claude-opus-5');

const zonderVersie = await worker.fetch(new Request('https://w/anthropic', {
  method: 'POST', headers: { Authorization: 'Bearer goed' }, body: '{}'
}), env);
check('zonder anthropic-version valt hij terug op de standaard',
  doorgegeven[doorgegeven.length - 1].headers['anthropic-version'], '2023-06-01');
check('en zonder anthropic-beta stuurt hij die header niet mee',
  'anthropic-beta' in doorgegeven[doorgegeven.length - 1].headers, false);

/* ── /openai en /v1 ──────────────────────────────────────────────────────── */
console.log('\n  /openai en /v1 — waar de beelden vandaan komen');
doorgegeven.length = 0;
const beeld = await worker.fetch(new Request('https://w/openai/images/generations', {
  method: 'POST', headers: { Authorization: 'Bearer goed', 'Content-Type': 'application/json' },
  body: '{"prompt":"x"}'
}), env);
check('gaat door', beeld.status, 200);
check('naar het juiste pad', doorgegeven[0].url, 'https://api.openai.com/v1/images/generations');
check('met de sleutel van de worker', doorgegeven[0].headers['Authorization'], 'Bearer sk-test');
check('en het beeld komt terug als beeld, niet als JSON',
  beeld.headers.get('Content-Type'), 'image/png');

doorgegeven.length = 0;
await worker.fetch(new Request('https://w/v1/images/generations', {
  method: 'POST', headers: { Authorization: 'Bearer goed' }, body: '{}'
}), env);
check('het /v1-alias komt op hetzelfde uit',
  doorgegeven[0].url, 'https://api.openai.com/v1/images/generations');

/* ── Onbekend pad ────────────────────────────────────────────────────────── */
console.log('\n  de rest');
const nergens = await worker.fetch(new Request('https://w/bestaatniet', {
  headers: { Authorization: 'Bearer goed' }
}), env);
check('een onbekend pad geeft 404', nergens.status, 404);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
