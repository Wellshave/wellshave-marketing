/* Testlus voor Atlas — de runtimekant van migratie 0012.
 *
 * De databasekant is bewezen in platform/db/test/atlas.sh: dat een rapport
 * over verse dagen voorlopig wórdt, wat de agent ook beweert. Hier gaat het om
 * de andere helft: gedraagt de runtime zich goed als die correctie terugkomt,
 * en kan een agent zich herstellen als hij een dagrapport zonder cijfers
 * probeert weg te schrijven.
 *
 *   node platform/worker/test/atlas.mjs
 *
 * Geen deploy, geen kosten, geen database.
 */

import worker from '../marketing-os.worker.js';

const db = {
  agents: [{ id: 'atlas', name: 'Atlas', status: 'idle' }],
  schedules: [],
  agent_jobs: [], agent_runs: [], agent_events: [], reports: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }],
  /* Wat meting_dekking zou teruggeven: één gat, midden in de reeks. */
  meting_dekking: [
    { dag: '2026-07-26', gemeten: true, staat: 'compleet' },
    { dag: '2026-07-27', gemeten: false, staat: 'ontbreekt' },
    { dag: '2026-07-28', gemeten: true, staat: 'compleet' },
    { dag: '2026-07-29', gemeten: true, staat: 'voorlopig' }
  ]
};
let volgendeId = 1;
const claudeAanroepen = [];
const toolUitkomsten = [];

function tabelUit(url) { const m = url.match(/\/rest\/v1\/([a-z_]+)/); return m ? m[1] : null; }
function defaults(tabel) {
  if (tabel === 'agent_jobs') return { status: 'queued', priority: 5, attempts: 0, max_attempts: 3, source: 'cron', scheduled_for: new Date().toISOString() };
  if (tabel === 'agent_runs') return { status: 'running' };
  if (tabel === 'agent_events') return { level: 'info' };
  return {};
}

/* De trigger uit 0012, nagedaan. Niet om de trigger te testen — dat doet
   atlas.sh tegen een echte Postgres — maar omdat de runtime moet omgaan met
   een insert die anders terugkomt dan hij werd verstuurd. */
function triggerVoorlopig(rij) {
  const redenen = [];
  const grens = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
  if (rij.periode_eind && rij.periode_eind > grens) redenen.push('attributie loopt nog na');
  if (Array.isArray(rij.gaten) && rij.gaten.length) redenen.push(`${rij.gaten.length} gat(en) in de reeks`);
  if (redenen.length) { rij.voorlopig = true; rij.voorlopig_reden = redenen.join('; '); }
  else if (!rij.voorlopig) rij.voorlopig_reden = null;
  return rij;
}

const metaAanroepen = [];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });
  if (url.includes('/rest/v1/rpc/claim_job')) {
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
      let rijen = JSON.parse(opts.body).map(r => ({ id: volgendeId++, created_at: new Date().toISOString(), ...defaults(tabel), ...r }));
      if (tabel === 'reports') {
        /* Postgres weigert een dagrapport zonder cijfers (0012). Als de
           runtime dat vóór de insert al afvangt, komen we hier nooit met een
           leeg cijfersveld — en dat is precies wat deze test wil weten. */
        for (const r of rijen) {
          if (r.kind === 'daily' && (!r.cijfers || !Object.keys(r.cijfers).length)) {
            return new Response('ERROR: reports_dagrapport_heeft_cijfers', { status: 400 });
          }
        }
        rijen = rijen.map(triggerVoorlopig);
      }
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

  /* Nep-Atlas. Doet eerst wat een gehaaste agent doet: een dagrapport zonder
     cijfers, en zonder eerst naar de dekking te kijken. Daarna herstelt hij. */
  if (url.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body);
    claudeAanroepen.push(body);
    const beurt = Math.floor(body.messages.length / 2) + 1;
    const usage = { input_tokens: 1000, output_tokens: 200 };
    const roep = (id, name, input) => ok({ stop_reason: 'tool_use', usage, content: [{ type: 'tool_use', id, name, input }] });

    if (beurt === 1) return roep('t1', 'db_query', { table: 'meting_dekking', order: 'dag.asc' });
    if (beurt === 2) return roep('t2', 'meta_insights', { level: 'account', days: 4 });
    if (beurt === 3) return roep('t3', 'write_report', { kind: 'daily', title: 'Dagrapport', body_md: '# Zonder cijfers' });
    if (beurt === 4) {
      return roep('t4', 'write_report', {
        kind: 'daily', title: 'Dagrapport', body_md: '# Met onderbouwing',
        periode_start: '2026-07-26', periode_eind: '2026-07-29',
        cijfers: { spend: 412.5, roas: 4.013 },
        signalen: [{ naam: 'roas', richting: 'op', waarde: 4.013 }],
        gaten: ['2026-07-27'],
        voorlopig: false
      });
    }
    /* Een agent die een tabel probeert die niet op de leeslijst staat. */
    if (beurt === 5) return roep('t5', 'db_query', { table: 'team_members' });
    return ok({ stop_reason: 'end_turn', usage, content: [{ type: 'text', text: 'Dagrapport geschreven, voorlopig: één dag ontbreekt.' }] });
  }

  if (url.includes('graph.facebook.com')) {
    metaAanroepen.push(new URL(url));
    /* Meta accepteert maar zes date_preset-waarden, en 'last_4d' hoort daar
       niet bij. Op 4 augustus vroeg Atlas vier dagen (de attributiestaart loopt
       na) en werden beide accounts afgewezen. De nep-Meta hier gaf altijd
       netjes antwoord en merkte dus niets -- vandaar dat hij nu weigert wat de
       echte ook weigert. */
    const preset = new URL(url).searchParams.get('date_preset');
    if (preset && !['today','yesterday','this_month','last_month','this_quarter','maximum',
                    'data_maximum','last_3d','last_7d','last_14d','last_28d','last_30d',
                    'last_90d','last_week_mon_sun','last_week_sun_sat','last_quarter',
                    'last_year','this_week_mon_today','this_week_sun_today','this_year'].includes(preset)) {
      return ok({ error: { message: `(#100) For field 'insights': date_preset must be one of the following values: ...` } });
    }
    /* Dezelfde nalatigheid zat in de veldenlijst: de nep-Meta slikte elke naam,
       dus ook video_3_sec_watched_actions, dat uit de Graph API verdwenen is.
       De echte weigert het hele verzoek om één onbekend veld — niet alleen dat
       veld — en daarom bleef meta_insights_daily tien dagen leeg terwijl de
       date_preset-fout allang was opgelost in de broncode. Een nep-Meta die
       alles goedkeurt kan dat soort fouten per definitie niet vinden. */
    const bekend = new Set(['spend', 'impressions', 'reach', 'frequency', 'clicks',
      'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'actions', 'action_values',
      'purchase_roas', 'quality_ranking', 'engagement_rate_ranking',
      'conversion_rate_ranking', 'video_play_actions', 'video_thruplay_watched_actions',
      'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name']);
    const gevraagd = (new URL(url).searchParams.get('fields') || '').split(',').filter(Boolean);
    const onbekend = gevraagd.filter(v => !bekend.has(v));
    if (onbekend.length) {
      return ok({ error: { message: `(#100) Tried accessing nonexisting field (${onbekend[0]}) on node type 'AdsInsights'` } });
    }
    return ok({ data: [{ date_start: '2026-07-28', spend: '412.50', impressions: '88000', clicks: '1400',
      actions: [{ action_type: 'purchase', value: '31' }], action_values: [{ action_type: 'purchase', value: '1655.20' }],
      video_play_actions: [{ action_type: 'video_view', value: '22000' }],
      video_thruplay_watched_actions: [{ action_type: 'video_view', value: '5500' }] }] });
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

const env = {
  ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

await worker.fetch(new Request('https://w/agents/run', { method: 'POST', ...auth, body: JSON.stringify({ agent_id: 'atlas', kind: 'daily_report' }) }), env);
await worker.fetch(new Request('https://w/agents/tick', { method: 'POST', ...auth }), env);
await new Promise(r => setTimeout(r, 50));

/* ── Wat Atlas mag zien ─────────────────────────────────────────────────── */
console.log('\n  wat Atlas mag zien');
check('hij kijkt eerst naar de dekking', db.agent_events.some(e => e.message === 'db_query'), true);
check('en de lus is er niet op stukgelopen', db.agent_jobs[0].status, 'done');

/* ── De guardrail in de runtime ─────────────────────────────────────────── */
console.log('\n  geen dagrapport zonder cijfers');
check('er is precies één rapport weggeschreven', db.reports.length, 1);
check('en dat is de tweede poging, met onderbouwing', db.reports[0].body_md, '# Met onderbouwing');
check('de weigering ging terug naar de agent, niet naar de logs',
  JSON.stringify(claudeAanroepen[3]).includes('een dagrapport heeft cijfers nodig'), true);
check('de agent kon zich herstellen zonder de run te verliezen', db.agent_runs[0].status, 'done');

/* ── Wat de database ervan maakte ───────────────────────────────────────── */
console.log('\n  de correctie komt terug bij de agent');
check('het rapport staat voorlopig, ook al zei de agent van niet', db.reports[0].voorlopig, true);
check('met de reden erbij', db.reports[0].voorlopig_reden.includes('gat(en)'), true);
/* De uitkomst van een tool komt als JSON-tekst terug in het volgende bericht.
   Die tekst hier weer uitpakken in plaats van er met een substring naar zoeken:
   anders zou de controle slagen op een toevallige match. */
const uitkomstVan = (aanroep, id) => {
  for (const bericht of aanroep.messages) {
    if (!Array.isArray(bericht.content)) continue;
    const r = bericht.content.find(c => c.type === 'tool_result' && c.tool_use_id === id);
    if (r) return JSON.parse(r.content);
  }
  return null;
};
check('en de agent kreeg dat te horen vóór zijn samenvatting',
  uitkomstVan(claudeAanroepen[4], 't4').voorlopig, true);
check('met dezelfde reden als in de database',
  uitkomstVan(claudeAanroepen[4], 't4').voorlopig_reden, db.reports[0].voorlopig_reden);
check('de samenvatting zegt het ook', db.agent_runs[0].summary.includes('voorlopig'), true);

console.log('\n  de onderbouwing is bewaard');
check('de periode staat vast', [db.reports[0].periode_start, db.reports[0].periode_eind], ['2026-07-26', '2026-07-29']);
check('de cijfers waarop hij oordeelde zijn bewaard', db.reports[0].cijfers.roas, 4.013);
check('het gat is bij naam genoemd', db.reports[0].gaten, ['2026-07-27']);
check('en niet ingevuld met een nul', db.reports[0].cijfers['2026-07-27'], undefined);

/* ── De grens eromheen ──────────────────────────────────────────────────── */
console.log('\n  de grens eromheen');
const geweigerd = uitkomstVan(claudeAanroepen[5], 't5');
check('team_members staat niet op de leeslijst', !!geweigerd.error, true);
check('en de weigering noemt de tabellen die wél mogen',
  geweigerd.toegestaan.includes('meting_dekking'), true);
check('meting_dekking wel', uitkomstVan(claudeAanroepen[1], 't1').aantal, 4);
/* ── Het venster dat aan Meta gevraagd wordt ────────────────────────────── */
console.log('\n  het venster naar Meta');
const meta = metaAanroepen[0];
check('er is een aanroep naar Meta gedaan', !!meta, true);
// De kern: geen date_preset meer, want daar bestaan maar zes waarden van en
// "vier dagen" is er geen van. Afronden naar zeven zou betekenen dat Atlas om
// vier dagen vraagt en er zeven meet, zonder dat iemand dat ziet.
check('er wordt geen date_preset meegestuurd', meta.searchParams.get('date_preset'), null);
const venster = JSON.parse(meta.searchParams.get('time_range') || '{}');
check('maar een expliciet venster met begin en eind',
  [typeof venster.since, typeof venster.until], ['string', 'string']);
const dagen = Math.round((Date.parse(venster.until) - Date.parse(venster.since)) / 86400000) + 1;
check('en dat venster is precies zo lang als gevraagd (4 dagen)', dagen, 4);
check('einddatum is vandaag', venster.until, new Date().toISOString().slice(0, 10));

/* ── De velden die aan Meta gevraagd worden ─────────────────────────────── */
console.log('\n  de velden naar Meta');
const gevraagdeVelden = (meta.searchParams.get('fields') || '').split(',');
check('video_3_sec_watched_actions wordt niet meer gevraagd',
  gevraagdeVelden.includes('video_3_sec_watched_actions'), false);
check('video_play_actions wel', gevraagdeVelden.includes('video_play_actions'), true);
/* Het bewijs dat het niet bij vragen blijft: Meta gaf antwoord en de cijfers
   staan in de rij die weggeschreven wordt. Zonder deze twee is hook rate
   (starts gedeeld door vertoningen) en hold rate (thruplay gedeeld door
   starts) niet te berekenen, en dat zijn precies de twee getallen waarop een
   video-creative beoordeeld wordt. */
const metaUitkomst = uitkomstVan(claudeAanroepen[2], 't2');
check('Meta weigerde het verzoek niet', metaUitkomst.error, undefined);
const rij = metaUitkomst.accounts && metaUitkomst.per_account[0].rijen[0];
check('het aantal videostarts is bewaard', rij && rij.video_3s, 22000);
check('en de thruplays ook, die kolom bleef tot nu toe leeg', rij && rij.video_thruplay, 5500);

const tools = claudeAanroepen[0].tools.map(t => t.name).sort();
check('Atlas houdt zijn eigen toolset', tools, ['db_query', 'meta_insights', 'meta_publiek', 'request_approval', 'send_message', 'write_report']);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
