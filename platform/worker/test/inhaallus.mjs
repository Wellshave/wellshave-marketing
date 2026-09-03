/* Testlus voor het zelf-vervolgen van meta_inhaalslag.
 *
 *   node platform/worker/test/inhaallus.mjs
 *
 * Waarom dit een eigen bestand is
 *
 *   De inhaalslag zet zichzelf terug in de wachtrij zolang er dagen ontbreken.
 *   Dat is de bedoeling: 178 dagen passen niet in één Worker-run, dus doet hij
 *   één gat per keer en schiet zichzelf opnieuw in.
 *
 *   Op 15 augustus liep dat één nacht lang mis. Advertentieniveau bleef op één
 *   blok weigeren, accountniveau lukte wel, en de taak keek alleen of er nog
 *   dagen ontbraken -- niet of díé ronde er iets van had weggewerkt. Dus:
 *   hetzelfde blok ophalen, op hetzelfde punt falen, "nog 101 dagen te gaan"
 *   zien, zichzelf opnieuw inschieten. Elke dertig seconden, tweehonderd keer,
 *   zonder ooit een rij op te leveren.
 *
 *   Een taak die zichzelf voedt heeft een voorwaarde nodig die hij niet kan
 *   waarmaken dóór te falen. Vooruitgang is die voorwaarde. Dit bestand legt
 *   precies dat vast, want het is niet te zien in de code van de taak zelf:
 *   daar staat één if, en die zag er redelijk uit.
 */

import worker from '../marketing-os.worker.js';

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}` +
    (goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`));
};

/* Wat de meting deze ronde teruggeeft. De eerste waarde geldt vóór de run, de
   tweede erna -- zo is "opgeschoten" en "stilgestaan" na te bootsen zonder de
   hele dekkingsview na te maken. */
let dekking = [];
let dekkingBeurt = 0;

let volgendeId = 1;
const db = {
  schedules: [], taken: [], taak_runs: [], systeem_events: [],
  meta_insights_daily: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }],
  ad_accounts: [
    { account_id: '242238038391551', naam: 'Wellshave®', merk: 'wellshave', actief: true, primair: true }
  ],
  meta_meetgaten: [{ account_id: '242238038391551', brand: 'wellshave',
                     van: '2025-10-09', tot: '2025-11-07', dagen: 30 }]
};

function tabelUit(url) { const m = url.match(/\/rest\/v1\/([a-z_]+)/); return m ? m[1] : null; }
function defaults(t) {
  if (t === 'taken') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3,
                              source: 'cron', scheduled_for: new Date().toISOString() };
  if (t === 'taak_runs') return { status: 'running' };
  if (t === 'systeem_events') return { level: 'info' };
  return {};
}

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });

  if (url.includes('graph.facebook.com')) {
    /* Meta weigert alles. Dat is het geval waarin de lus ontstond. */
    return ok({ error: { message: 'An unknown error occurred', code: 1 } });
  }

  if (url.includes('/rest/v1/rpc/claim_taak')) {
    const t = db.taken.find(x => x.status === 'queued' && new Date(x.scheduled_for) <= new Date());
    if (!t) return ok(null);
    t.status = 'running'; t.attempts++; t.locked_at = new Date().toISOString();
    return ok(t);
  }
  if (url.includes('/rest/v1/rpc/maak_vastgelopen_taken_vrij')) return ok(0);

  if (url.includes('/rest/v1/')) {
    const tabel = tabelUit(url);
    if (tabel === 'meta_meetdekking') {
      const rij = dekking[Math.min(dekkingBeurt, dekking.length - 1)];
      dekkingBeurt++;
      return ok([{ brand: 'wellshave', dagen_ontbreken: rij, grootste_gat_dagen: rij, toestand: 'x' }]);
    }
    if (!db[tabel]) db[tabel] = [];
    if (methode === 'POST') {
      const rijen = JSON.parse(opts.body).map(r => ({
        id: volgendeId++, created_at: new Date().toISOString(), ...defaults(tabel), ...r }));
      db[tabel].push(...rijen);
      return ok(rijen);
    }
    if (methode === 'PATCH') {
      const patch = JSON.parse(opts.body);
      const idM = url.match(/id=eq\.([^&]+)/);
      const doelen = idM ? db[tabel].filter(r => String(r.id) === idM[1]) : db[tabel];
      doelen.forEach(r => Object.assign(r, patch));
      return ok(doelen);
    }
    let rijen = db[tabel];
    if (/actief=is\.true/.test(url)) rijen = rijen.filter(r => r.actief);
    return ok(rijen);
  }
  throw new Error('onverwachte fetch: ' + url);
};

const env = {
  ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

const draai = async (voor, na) => {
  dekking = [voor, na]; dekkingBeurt = 0;
  db.taken = []; db.taak_runs = []; db.systeem_events = [];
  await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
    body: JSON.stringify({ kind: 'meta_inhaalslag' }) }), env);
  await worker.fetch(new Request('https://w/systeem/tick', { method: 'POST', ...auth }), env);
  await new Promise(r => setTimeout(r, 120));
  return {
    /* Alles wat de taak zelf heeft ingeschoten, dus niet de aanvraag hierboven. */
    vervolg: db.taken.filter(t => t.source === 'systeem').length,
    waarschuwingen: db.systeem_events.filter(e => e.level === 'warn').map(e => e.message)
  };
};

console.log('\n  staat de meting stil, dan stopt de keten');
/* 101 dagen ontbraken, en na de ronde nog steeds 101: niets opgeschoten. */
let r = await draai(101, 101);
check('hij zet zichzelf niet opnieuw in de rij', r.vervolg, 0);
check('en zegt waarom hij stopt',
  r.waarschuwingen.some(m => /kwam niet verder/.test(m)), true);
check('met de melding dat de dagelijkse planning het overneemt',
  r.waarschuwingen.some(m => /dagelijkse planning/.test(m)), true);

console.log('\n  schiet hij wel op, dan gaat hij door');
r = await draai(101, 71);
check('hij zet het volgende blok klaar', r.vervolg, 1);

console.log('\n  is alles binnen, dan houdt hij ook op');
r = await draai(30, 0);
check('geen vervolg meer als er niets ontbreekt', r.vervolg, 0);
check('en geen klacht, want dit is gewoon klaar',
  r.waarschuwingen.some(m => /kwam niet verder/.test(m)), false);

console.log('');
if (fouten) { console.log(`${fouten} controle(s) mislukt`); process.exit(1); }
console.log('Alles klopt');
