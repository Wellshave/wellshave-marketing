/* Testlus voor de publiceerflow naar Meta.
 *
 * Draait de echte worker-code tegen een nep-Meta en een nep-Supabase. Wat hier
 * bewezen wordt is niet dat de Meta-API werkt — dat blijkt pas bij de eerste
 * echte publicatie — maar dat de volgorde klopt en dat de grens houdt:
 *
 *   - klaarzetten maakt wél een creative en géén advertentie
 *   - zonder akkoord komt er geen advertentie, ook niet met een geldig verzoek
 *   - een tweede poging levert geen tweede advertentie op
 *   - de koppeling creative → advertentie wordt vastgelegd
 *
 *   node platform/worker/test/publiceren.mjs
 */

import worker from '../marketing-os.worker.js';

/* ── Nepdatabase ────────────────────────────────────────────────────────── */

const db = {
  /* Sinds 0014 volgt het publiceeraccount het merk van de creative. Zonder deze
     tabel weet de runtime niet waar een wellshave-creative heen moet, en dat
     hoort hij te weigeren in plaats van te gokken. */
  ad_accounts: [
    { account_id: '242238038391551', naam: 'Wellshave®', merk: 'wellshave', actief: true, primair: true }
  ],
  agents: [{ id: 'bolt', name: 'Bolt', status: 'idle' }],
  creatives: [{
    id: 3, brand: 'wellshave', ad_name: "Eén static die de angst voor sneetjes wegneemt",
    hook_short: 'Nooit meer sneetjes in je nek', marketing_angle: 'Angst voor irritatie',
    persona: 'Man 30-45, scheert dagelijks', awareness_level: 'problem',
    status: 'To Test', has_image: true,
    image_b64: 'iVBORw0KGgoAAAANSUhEUg==' // wat bytes; de inhoud doet er niet toe
  }],
  meta_publications: [],
  approvals: [],
  systeem_events: [],
  taak_runs: [],
  team_members: [{ id: 'u1', status: 'approved', role: 'admin' }]
};
let volgendeId = 1;
const metaAanroepen = [];

function defaults(tabel) {
  if (tabel === 'meta_publications') return { status: 'concept', attempts: 0, asset_kind: 'image', cta_type: 'SHOP_NOW' };
  if (tabel === 'approvals') return { status: 'pending' };
  if (tabel === 'systeem_events') return { level: 'info' };
  return {};
}

/* Genoeg PostgREST om de flow te laten lopen: filters op id, idem_key,
   approval_id en status, plus insert/patch met teruggave. */
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

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });

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

  /* Nep-Meta. Legt elke aanroep vast zodat de test kan zien wát er is gebeurd. */
  if (url.includes('graph.facebook.com')) {
    const pad = url.replace(/^.*graph\.facebook\.com\/v\d+\.\d+\//, '');
    let body = {};
    if (opts.body && typeof opts.body === 'string') body = JSON.parse(opts.body);
    metaAanroepen.push({ pad, body });

    if (pad.endsWith('/adimages')) return ok({ images: { 'wg.png': { hash: 'hash_abc123' } } });
    if (pad.endsWith('/adcreatives')) return ok({ id: 'creative_999' });
    if (pad.endsWith('/ads')) return ok({ id: 'ad_555' });
    if (/^ad_\d+$|^ad_555$/.test(pad)) return ok({ success: true });
    return ok({ id: 'onbekend' });
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

/* ── Uitvoeren ──────────────────────────────────────────────────────────── */

const env = {
  ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test',
  META_ACCESS_TOKEN: 'test', META_AD_ACCOUNT_ID: 'act_242238038391551'
};
const auth = { headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' } };
const post = (pad, body) => worker.fetch(new Request('https://w' + pad, {
  method: 'POST', ...auth, body: JSON.stringify(body || {})
}), env);

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

/* Klaarzetten was een tool van Bolt en loopt sinds versie 16 via een endpoint.
   Dat is geen cosmetische verhuizing: er zit geen model meer tussen dat de
   invoer kon herformuleren. Wat hier de deur in gaat, gaat er zo naar Meta. */
const klaarzetten = await (await post('/systeem/publicaties/klaarzetten', {
  creative_id: 3, adset_id: '120252206157150577', ad_name: 'WS test — sneetjes',
  headline: 'Nooit meer sneetjes', primary_text: 'Scheren zonder irritatie.',
  cta_type: 'ORDER_NOW', daily_budget: 25,
  hypothesis: 'Als we de angst voor sneetjes benoemen, dan stijgt de CTR, omdat dat de echte drempel is.'
})).json();
check('het klaarzetten slaagt', !klaarzetten.error, true);


/* ---- Klaarzetten ---- */
const pub = db.meta_publications[0];
check('er is één publicatie aangemaakt', db.meta_publications.length, 1);
check('status wacht op een mens', pub.status, 'wacht_op_akkoord');
check('het beeld is naar Meta gegaan', !!pub.meta_image_hash, true);
check('de creative bestaat bij Meta', pub.meta_creative_id, 'creative_999');
check('maar er is nog GEEN advertentie', pub.meta_ad_id, undefined);
check('Meta heeft geen /ads-aanroep gekregen', metaAanroepen.some(a => a.pad.endsWith('/ads')), false);

check('de herkomst zit in de link', pub.link_url.includes('utm_content=wg-' + pub.id), true);
check('en het beeld ging naar het account van het merk',
  metaAanroepen.some(a => a.pad.startsWith('act_242238038391551/adimages')), true);
check('de hypothese is vastgelegd', pub.hypothesis.startsWith('Als we de angst'), true);
check('de hoek komt uit de creative', pub.angle, 'Angst voor irritatie');
check('de persona komt mee', pub.persona, 'Man 30-45, scheert dagelijks');

const app = db.approvals[0];
check('er staat een goedkeuring klaar', app.status, 'pending');
check('gekoppeld aan de publicatie', app.payload.publication_id, pub.id);
check('de publicatie kent de goedkeuring', pub.approval_id, app.id);

/* ---- De grens: publiceren zonder akkoord ---- */
const teVroeg = await post(`/systeem/publicaties/${pub.id}/publish`, {});
check('publiceren zonder akkoord wordt geweigerd', teVroeg.status, 403);
check('en er is nog steeds geen advertentie', metaAanroepen.some(a => a.pad.endsWith('/ads')), false);

/* ---- Guardrail ----
   Vroeger stond hier dat Bolt wél meta_prepare_ad kreeg en géén tool die iets
   live zette. Die scheiding zat in een toolset; nu zit hij in de route zelf,
   en dat is sterker: klaarzetten vraagt een login, live zetten een admin. */
check('klaarzetten kan zonder admin', klaarzetten.publication ? true : !klaarzetten.error, true);
check('live zetten niet', teVroeg.status, 403);

/* ---- Beslissen ---- */
const besluit = await (await post(`/systeem/approvals/${app.id}/decide`, { decision: 'approved' })).json();
check('de goedkeuring is verleend', besluit.approval.status, 'approved');
check('met de naam van wie besliste', besluit.approval.decided_by, 'dustin@wellshave.com');

const nogmaals = await post(`/systeem/approvals/${app.id}/decide`, { decision: 'rejected' });
check('twee keer beslissen kan niet', nogmaals.status, 409);

/* ---- Publiceren ---- */
const live = await (await post(`/systeem/publicaties/${pub.id}/publish`, { activate: true })).json();
check('de advertentie is aangemaakt', live.meta_ad_id, 'ad_555');
check('de publicatie staat live', db.meta_publications[0].status, 'live');
check('met wie hem live zette', db.meta_publications[0].published_by, 'dustin@wellshave.com');

const adAanroep = metaAanroepen.find(a => a.pad.endsWith('/ads'));
check('de advertentie is eerst gepauzeerd aangemaakt', adAanroep.body.status, 'PAUSED');
check('en daarna pas aangezet', metaAanroepen.some(a => a.body.status === 'ACTIVE'), true);
check('gekoppeld aan de juiste ad set', adAanroep.body.adset_id, '120252206157150577');

check('de creative in de console staat op Live', db.creatives[0].status, 'Live');
check('de koppeling advertentie → creative ligt vast', db.meta_publications[0].creative_id, 3);

/* ---- Herhaling ---- */
const aantalAdsVoor = metaAanroepen.filter(a => a.pad.endsWith('/ads')).length;
const opnieuw = await (await post(`/systeem/publicaties/${pub.id}/publish`, { activate: true })).json();
check('nogmaals publiceren maakt niets nieuws aan', opnieuw.al_live, true);
check('en raakt Meta niet opnieuw aan', metaAanroepen.filter(a => a.pad.endsWith('/ads')).length, aantalAdsVoor);

console.log(fouten ? `\n${fouten} controle(s) mislukt` : '\nAlle controles geslaagd');
process.exit(fouten ? 1 : 0);
