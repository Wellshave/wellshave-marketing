/* Smoke-test voor de agent-runtime.
 *
 * Draait de echte Worker-code tegen een nep-Supabase en een nep-Claude, zodat
 * de lus (planning → job → tool-rondes → rapport → afronding) te controleren is
 * zonder een deploy, zonder API-kosten en zonder één rij aan te raken.
 *
 *   node platform/worker/test/smoke.mjs
 *
 * Wat dit NIET dekt: of PostgREST het schema marketing_hq daadwerkelijk
 * serveert, en of Meta/Klaviyo de velden teruggeven die we verwachten. Dat
 * blijkt pas bij de eerste echte run.
 */

import worker from '../marketing-os.worker.js';

/* ── Nepdatabase ────────────────────────────────────────────────────────── */

const db = {
  agents: [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
  schedules: [{ id: 'atlas_daily', agent_id: 'atlas', kind: 'daily_report', cron: '* * * * *', payload: { lookback_days: 4 }, enabled: true, last_fired_at: null }],
  agent_jobs: [],
  agent_runs: [],
  agent_events: [],
  reports: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }]
};
let volgendeId = 1;
const claudeAanroepen = [];

function tabelUit(url) {
  const m = url.match(/\/rest\/v1\/([a-z_]+)/);
  return m ? m[1] : null;
}

/* Postgres vult kolomdefaults in bij een insert; PostgREST geeft de volledige
   rij terug. De nepdatabase moet dat nadoen, anders komt een job zonder
   status binnen en vindt claim_job niets. Spiegelt 0004_agent_runtime.sql. */
function defaults(tabel) {
  if (tabel === 'agent_jobs') {
    return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  }
  if (tabel === 'agent_runs') return { status: 'running' };
  if (tabel === 'agent_events') return { level: 'info' };
  return {};
}

/* Genoeg PostgREST om de runtime te laten geloven dat hij een database heeft:
   select met filter/limit, insert met return, patch op id, en de twee rpc's. */
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });

  if (url.includes('/rest/v1/rpc/claim_job')) {
    /* Spiegelt claim_job uit 0004, inclusief scheduled_for: zonder dat pakt
       één tick een teruggezette job meteen weer op. */
    const j = db.agent_jobs.find(x => x.status === 'queued' && new Date(x.scheduled_for) <= new Date());
    if (!j) return ok(null);
    j.status = 'running'; j.attempts++; j.locked_at = new Date().toISOString();
    return ok(j);
  }
  if (url.includes('/rest/v1/rpc/reap_stuck_jobs')) return ok(0);

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

  /* Nep-Claude: eerst een tool-ronde (meta_insights), dan write_report, dan af. */
  if (url.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    claudeAanroepen.push(body);
    /* Per run opnieuw tellen: één bericht in de lijst betekent een nieuwe run.
       Anders zou de tweede job al bij zijn eerste beurt op end_turn uitkomen. */
    const beurt = Math.floor(body.messages.length / 2) + 1;
    const usage = { input_tokens: 1200, output_tokens: 300 };
    if (beurt === 1) {
      return ok({
        stop_reason: 'tool_use', usage,
        content: [
          { type: 'thinking', thinking: 'even kijken naar de cijfers' },   // Fable 5 zet dit vooraan
          { type: 'tool_use', id: 't1', name: 'meta_insights', input: { level: 'account', days: 4 } }
        ]
      });
    }
    if (beurt === 2) {
      return ok({
        stop_reason: 'tool_use', usage,
        content: [{ type: 'tool_use', id: 't2', name: 'write_report', input: { kind: 'daily', title: 'Dagrapport', body_md: '# Test' } }]
      });
    }
    return ok({
      stop_reason: 'end_turn', usage,
      content: [{ type: 'thinking', thinking: '...' }, { type: 'text', text: 'Rapport geschreven. Spend vlak, ROAS licht omhoog.' }]
    });
  }

  /* Nep-Meta */
  if (url.includes('graph.facebook.com')) {
    return ok({ data: [{ date_start: '2026-07-27', spend: '412.50', impressions: '88000', clicks: '1400', ctr: '1.59', cpc: '0.29', cpm: '4.69', actions: [{ action_type: 'purchase', value: '31' }], action_values: [{ action_type: 'purchase', value: '1655.20' }] }] });
  }

  throw new Error('onverwachte fetch in test: ' + url);
};

/* ── Uitvoeren ──────────────────────────────────────────────────────────── */

const env = {
  ANTHROPIC_KEY: 'test', OPENAI_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

const gezondheid = await (await worker.fetch(new Request('https://w/health'), env)).json();
check('health meldt de runtime actief', gezondheid.runtime, 'actief');
check('health ziet Meta gekoppeld', gezondheid.koppelingen.meta, true);

const zonderLogin = await worker.fetch(new Request('https://w/agents/status'), env);
check('zonder login geen toegang tot de agents', zonderLogin.status, 401);

const onbekend = await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'sage', kind: 'test' }) }), env);
check('een agent zonder runtime-instructie wordt geweigerd', onbekend.status, 400);

const gevraagd = await (await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'atlas', kind: 'daily_report' }) }), env)).json();
check('werk vanuit de console komt in de rij', gevraagd.job.status, 'queued');
check('en gaat voor op cron-werk', gevraagd.job.priority, 1);
check('met de aanvrager erbij', gevraagd.job.requested_by, 'dustin@wellshave.com');

/* De cron-cyclus: planning omzetten in werk, en de rij afwerken. */
await worker.scheduled({ scheduledTime: Date.now() }, env, { waitUntil: p => p });
await new Promise(r => setTimeout(r, 50));

check('de planning heeft een job bijgezet', db.agent_jobs.length, 2);
check('beide jobs zijn afgerond', db.agent_jobs.filter(j => j.status === 'done').length, 2);
check('elke run is vastgelegd', db.agent_runs.length, 2);
check('runs staan op done', db.agent_runs.every(r => r.status === 'done'), true);
check('de agent staat weer op idle', db.agents[0].status, 'idle');

const run = db.agent_runs[0];
check('de samenvatting komt uit het echte text-blok, niet uit het thinking-blok',
  run.summary, 'Rapport geschreven. Spend vlak, ROAS licht omhoog.');
check('tokens zijn geteld over alle rondes', run.input_tokens, 3600);
check('kosten zijn berekend', run.cost_usd > 0, true);

check('het rapport is weggeschreven', db.reports.length, 2);
check('Atlas staat als auteur', db.reports[0].author_agent, 'atlas');

const metaRijen = db.meta_insights_daily || [];
check('Meta-cijfers zijn opgeslagen', metaRijen.length > 0, true);
check('ROAS is berekend uit omzet en spend', metaRijen[0].roas, 4.013);
check('en gemarkeerd als definitief (ouder dan 3 dagen)', metaRijen[0].is_final, dagenTerug('2026-07-27') > 3);

check('de live-feed heeft events', db.agent_events.length > 0, true);
check('de tools zijn als event gelogd', db.agent_events.some(e => e.message === 'meta_insights'), true);

/* Guardrail: een agent mag alleen zijn eigen tools zien. */
const atlasTools = claudeAanroepen[0].tools.map(t => t.name);
check('Atlas krijgt zijn eigen toolset', atlasTools.sort(), ['db_query', 'meta_insights', 'request_approval', 'send_message', 'write_report']);
check('en géén tool die iets naar buiten stuurt', atlasTools.some(n => /send_email|update_budget|launch/.test(n)), false);

function dagenTerug(d) { return Math.floor((Date.now() - new Date(d + 'T00:00:00Z')) / 86400000); }

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
