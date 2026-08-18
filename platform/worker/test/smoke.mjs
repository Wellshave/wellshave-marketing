/* Smoke-test voor de runtime zonder agents.
 *
 * Draait de echte Worker-code tegen een nep-Supabase, zodat de lus
 * (planning → taak → systeemtaak → afronding) te controleren is zonder een
 * deploy, zonder API-kosten en zonder één rij aan te raken.
 *
 *   node platform/worker/test/smoke.mjs
 *
 * Wat hier vóór versie 16 stond, was een smoke-test van de agent-lus: een
 * nep-Claude die tool-rondes teruggaf, en controles op toolsets en tokens. Dat
 * is niet aangepast maar vervangen, want de lus die het testte bestaat niet
 * meer. De belangrijkste controle is daarom omgedraaid: er hoort géén enkele
 * aanroep naar een taalmodel te gebeuren tijdens een cyclus.
 *
 * Wat dit NIET dekt: of PostgREST het schema marketing_hq daadwerkelijk
 * serveert, en of Meta de velden teruggeeft die we verwachten. Dat blijkt pas
 * bij de eerste echte run.
 */

import worker from '../marketing-os.worker.js';

/* ── Nepdatabase ────────────────────────────────────────────────────────── */

const db = {
  schedules: [{ id: 'terugkoppeling', kind: 'feedback_sync', cron: '* * * * *', payload: {}, enabled: true, last_fired_at: null }],
  taken: [],
  taak_runs: [],
  systeem_events: [],
  angle_learnings: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }]
};
let volgendeId = 1;
const modelAanroepen = [];

function tabelUit(url) {
  const m = url.match(/\/rest\/v1\/([a-z_]+)/);
  return m ? m[1] : null;
}

/* Postgres vult kolomdefaults in bij een insert; PostgREST geeft de volledige
   rij terug. De nepdatabase moet dat nadoen, anders komt een taak zonder
   status binnen en vindt claim_taak niets. Spiegelt 0004_agent_runtime.sql. */
function defaults(tabel) {
  if (tabel === 'taken') {
    return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  }
  if (tabel === 'taak_runs') return { status: 'running' };
  if (tabel === 'systeem_events') return { level: 'info' };
  return {};
}

/* Genoeg PostgREST om de runtime te laten geloven dat hij een database heeft:
   select met filter/limit, insert met return, patch op id, en de rpc's. */
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });

  if (url.includes('/rest/v1/rpc/claim_taak')) {
    /* Spiegelt claim_taak uit 0051, inclusief scheduled_for: zonder dat pakt
       één tick een teruggezette taak meteen weer op. */
    const t = db.taken.find(x => x.status === 'queued' && new Date(x.scheduled_for) <= new Date());
    if (!t) return ok(null);
    t.status = 'running'; t.attempts++; t.locked_at = new Date().toISOString();
    return ok(t);
  }
  if (url.includes('/rest/v1/rpc/maak_vastgelopen_taken_vrij')) return ok(0);
  if (url.includes('/rest/v1/rpc/sync_creative_results')) {
    return ok({ cijfers_bijgewerkt: 7, status_bijgewerkt: 2 });
  }

  if (url.includes('/rest/v1/')) {
    const tabel = tabelUit(url);
    if (!db[tabel]) db[tabel] = [];

    if (methode === 'POST') {
      const rijen = JSON.parse(opts.body).map(r => ({
        id: volgendeId++, created_at: new Date().toISOString(), ...defaults(tabel), ...r
      }));
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
    const statusM = url.match(/status=eq\.([^&]+)/);
    if (statusM) rijen = rijen.filter(r => r.status === statusM[1]);
    const limM = url.match(/limit=(\d+)/);
    if (limM) rijen = rijen.slice(0, Number(limM[1]));
    return ok(rijen);
  }

  /* Elke aanroep naar een taalmodel wordt geteld in plaats van beantwoord.
     Dat is de kern van deze test geworden: een cyclus hoort er nul te doen. */
  if (url.includes('api.anthropic.com') || url.includes('api.openai.com')) {
    modelAanroepen.push(url);
    return ok({ content: [{ type: 'text', text: 'zou niet gevraagd moeten worden' }] });
  }

  throw new Error('onverwachte fetch in test: ' + url);
};

/* ── Controles ──────────────────────────────────────────────────────────── */

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (goed) { console.log('ok  ', label); return; }
  fouten++;
  console.log('FOUT', label, '\n     verwacht', JSON.stringify(verwacht), '\n     kreeg   ', JSON.stringify(echt));
};

const env = {
  ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

const gezondheid = await (await worker.fetch(new Request('https://w/health'), env)).json();
check('health antwoordt', gezondheid.ok, true);
check('health meldt de runtime actief', gezondheid.runtime, 'actief');
check('health ziet Meta gekoppeld', gezondheid.koppelingen.meta, true);
/* Het versienummer is de enige manier om van buitenaf te zien welke code er
   draait. Valt deze controle om na een wijziging, dan is hij vergeten op te
   hogen -- en dan is een gelukte deploy achteraf niet te onderscheiden van
   geen deploy. Dat is twee keer gebeurd. */
check('health noemt versie 16 of hoger',
  typeof gezondheid.versie === 'number' && gezondheid.versie >= 16, true);

const zonderLogin = await worker.fetch(new Request('https://w/systeem/status'), env);
check('zonder login geen toegang tot het systeem', zonderLogin.status, 401);

/* De belangrijkste weigering van deze versie. Toen de agents er nog waren viel
   een onbekende opdracht terug op het model, dat er dan iets van maakte. */
const onbekend = await (await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
  body: JSON.stringify({ kind: 'daily_report' }) }), env)).json();
check('een taak die niet in code staat wordt geweigerd',
  /onbekende taak/.test(onbekend.error || ''), true);
check('en het antwoord noemt wat er wél bestaat',
  Array.isArray(onbekend.beschikbaar) && onbekend.beschikbaar.includes('feedback_sync'), true);

const gevraagd = await (await worker.fetch(new Request('https://w/systeem/taken', { method: 'POST', ...auth,
  body: JSON.stringify({ kind: 'feedback_sync' }) }), env)).json();
check('werk vanuit de console komt in de rij', gevraagd.taak.status, 'queued');
check('en gaat voor op cron-werk', gevraagd.taak.priority, 1);
check('met de aanvrager erbij', gevraagd.taak.requested_by, 'dustin@wellshave.com');

/* De cron-cyclus: planning omzetten in werk, en de rij afwerken. */
await worker.scheduled({ scheduledTime: Date.now() }, env, { waitUntil: p => p });
await new Promise(r => setTimeout(r, 50));

check('de planning heeft een taak bijgezet', db.taken.length, 2);
check('beide taken zijn afgerond', db.taken.filter(t => t.status === 'done').length, 2);
check('elke run is vastgelegd', db.taak_runs.length, 2);
check('runs staan op done', db.taak_runs.every(r => r.status === 'done'), true);
check('de run noemt wat er gebeurd is',
  /7 creatives bijgewerkt/.test(db.taak_runs[0].summary || ''), true);
/* Nul tokens is geen cosmetisch detail: het is het bewijs dat deze cyclus geen
   model heeft aangeraakt. */
check('en kostte niets, want er kwam geen model aan te pas',
  db.taak_runs.every(r => r.input_tokens === 0 && r.cost_usd === 0), true);

check('de live-feed heeft events', db.systeem_events.length > 0, true);
check('events dragen geen agent meer',
  db.systeem_events.every(e => !('agent_id' in e)), true);

/* De harde controle. Een volledige cyclus -- planning, twee taken, logging --
   zonder één aanroep naar een taalmodel. Dit is wat "zonder AI-agents"
   feitelijk betekent, en het is het enige wat het echt bewijst. */
check('er is geen enkele keer een taalmodel aangeroepen', modelAanroepen.length, 0);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlles klopt');
process.exit(fouten ? 1 : 0);
