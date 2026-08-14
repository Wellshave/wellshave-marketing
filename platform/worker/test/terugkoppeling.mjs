/* Testlus voor stap 06 — de terugkoppeling.
 *
 * De rekenkant zit in SQL en is apart tegen echte Postgres gecontroleerd. Wat
 * hier bewezen wordt is het gedrag eromheen:
 *
 *   - een systeemtaak loopt door de wachtrij zonder Claude aan te roepen
 *   - hij kost dus nul tokens en nul euro
 *   - de uitkomst komt in de live-feed terecht
 *   - een mislukking gedraagt zich als elke andere: retry, niet stil verdwijnen
 *
 *   node platform/worker/test/terugkoppeling.mjs
 */

import worker from '../marketing-os.worker.js';

const db = {
  agents: [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
  taken: [],
  taak_runs: [],
  systeem_events: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }]
};
let volgendeId = 1;
let anthropicAanroepen = 0;
let rpcAanroepen = [];
let rpcFaalt = false;

function defaults(tabel) {
  if (tabel === 'taken') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  if (tabel === 'taak_runs') return { status: 'running' };
  if (tabel === 'systeem_events') return { level: 'info' };
  return {};
}

function filter(rijen, url) {
  const paren = [...url.matchAll(/(?:\?|&)([a-z_]+)=(eq|in)\.([^&]+)/g)];
  return rijen.filter(r => paren.every(([, kol, op, waarde]) => {
    if (['select', 'order', 'limit', 'on_conflict'].includes(kol)) return true;
    const v = decodeURIComponent(waarde);
    if (op === 'in') return v.replace(/[()]/g, '').split(',').includes(String(r[kol]));
    return String(r[kol]) === v;
  }));
}

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('api.anthropic.com')) {
    anthropicAanroepen++;
    return ok({ stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: 'zou hier niet moeten komen' }] });
  }
  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });

  if (url.includes('/rest/v1/rpc/claim_taak')) {
    /* Spiegelt claim_job uit 0004: alleen wat nu aan de beurt is. Zonder die
       voorwaarde pakt één tick dezelfde mislukte job meteen opnieuw op en
       verbrandt hij al zijn pogingen in een paar milliseconden. */
    const j = db.taken.find(x => x.status === 'queued' && new Date(x.scheduled_for) <= new Date());
    if (!j) return ok(null);
    j.status = 'running'; j.attempts++;
    return ok(j);
  }
  if (url.includes('/rest/v1/rpc/maak_vastgelopen_taken_vrij')) return ok(0);

  if (url.includes('/rest/v1/rpc/sync_creative_results')) {
    rpcAanroepen.push('sync_creative_results');
    if (rpcFaalt) return new Response(JSON.stringify({ message: 'kolom bestaat niet' }), { status: 400 });
    return ok({ cijfers_bijgewerkt: 7, status_bijgewerkt: 2 });
  }

  if (url.includes('/rest/v1/angle_learnings')) {
    return ok([
      { angle_type: 'Problem-Solution', persona: 'Man 30-45', aantal_ads: 5, roas: 3.4 },
      { angle_type: 'Social Proof / Reviews', persona: 'Man 30-45', aantal_ads: 4, roas: 2.1 }
    ]);
  }

  if (url.includes('/rest/v1/')) {
    const tabel = (url.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
    if (!db[tabel]) db[tabel] = [];
    if (methode === 'POST') {
      const rijen = JSON.parse(opts.body).map(r => ({ id: volgendeId++, created_at: new Date().toISOString(), ...defaults(tabel), ...r }));
      db[tabel].push(...rijen);
      return ok(rijen);
    }
    if (methode === 'PATCH') {
      const doelen = filter(db[tabel], url);
      const patch = JSON.parse(opts.body);
      doelen.forEach(r => Object.assign(r, patch));
      return ok(doelen);
    }
    return ok(filter(db[tabel], url));
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

const env = { ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test' };
const auth = { headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' } };

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

/* ---- De gelukkige route ---- */
const gevraagd = await (await worker.fetch(new Request('https://w/systeem/taken', {
  method: 'POST', ...auth, body: JSON.stringify({ kind: 'feedback_sync' })
}), env)).json();
check('de terugkoppeling kan als opdracht in de rij', gevraagd.taak.kind, 'feedback_sync');

await worker.scheduled({ scheduledTime: Date.now() }, env, { waitUntil: p => p });
await new Promise(r => setTimeout(r, 50));

check('de job is afgerond', db.taken[0].status, 'done');
check('de terugschrijving is aangeroepen', rpcAanroepen, ['sync_creative_results']);
check('er is GEEN taalmodel gebruikt', anthropicAanroepen, 0);

const run = db.taak_runs[0];
check('de run is vastgelegd', run.status, 'done');
check('als systeemtaak, niet als model', run.model, 'systeem');
check('en kost niets', run.cost_usd, 0);
check('nul tokens', [run.input_tokens, run.output_tokens], [0, 0]);
check('met een leesbare samenvatting',
  run.summary, '7 creatives bijgewerkt met cijfers, 2 van status veranderd. Sterkste hoek: Problem-Solution.');

check('de uitkomst staat in de live-feed',
  db.systeem_events.some(e => e.message === 'Cijfers teruggeschreven naar de creatives'), true);
check('het patroon is benoemd',
  db.systeem_events.some(e => (e.message || '').startsWith('Beste hoek nu: Problem-Solution')), true);
check('de agent staat weer op idle', db.agents[0].status, 'idle');

/* ---- Als het misgaat ---- */
rpcFaalt = true;
rpcAanroepen = [];
db.taken.length = 0;
db.taak_runs.length = 0;

await worker.fetch(new Request('https://w/systeem/taken', {
  method: 'POST', ...auth, body: JSON.stringify({ kind: 'feedback_sync' })
}), env);
await worker.scheduled({ scheduledTime: Date.now() }, env, { waitUntil: p => p });
await new Promise(r => setTimeout(r, 50));

check('een mislukking komt terug in de rij', db.taken[0].status, 'queued');
check('de fout is bewaard', /sync_creative_results/.test(db.taken[0].error || ''), true);
check('de run staat op mislukt', db.taak_runs[0].status, 'failed');
check('en de agent hangt niet op working', db.agents[0].status, 'idle');
check('er staat een foutmelding in de feed',
  db.systeem_events.some(e => e.level === 'error'), true);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
