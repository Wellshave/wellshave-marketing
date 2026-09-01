/* ============================================================
 * Marketing OS — Cloudflare Worker
 *
 * Superset van atelier-proxy: alle bestaande endpoints doen exact wat ze deden,
 * en daar bovenop draait de takenwachtrij. Dit bestand vervangt
 * ad-generator/worker/atelier-proxy.worker.js in de worker `marketing-ads`.
 *
 * Endpoints (ongewijzigd):
 *   GET   /health                 health (open)
 *   POST  /anthropic              Claude          (login vereist)
 *   POST  /openai/<rest>          OpenAI-beeld    (login vereist)
 *   POST  /v1/<rest>              OpenAI (alias)  (login vereist)
 *
 * Endpoints (nieuw, allemaal login vereist):
 *   GET   /systeem/status         lopende taken + laatste events + accounts
 *   GET   /systeem/taken          de wachtrij
 *   POST  /systeem/taken          werk in de rij zetten
 *   POST  /systeem/taken/<id>/annuleer
 *   POST  /systeem/tick           handmatig een cyclus draaien (om te testen)
 *   POST  /systeem/publicaties/klaarzetten
 *   POST  /systeem/publicaties/<id>/publish
 *   POST  /systeem/approvals/<id>/decide
 *
 * Cron (wrangler.toml → [triggers] crons):
 *   elke 5 minuten → scheduled() → planning omzetten in taken + rij afwerken
 *
 * Secrets:
 *   ANTHROPIC_KEY          verplicht — Claude
 *   OPENAI_KEY             verplicht — beeldgeneratie
 *   SUPABASE_SERVICE_KEY   verplicht voor de runtime — schrijft in marketing_hq
 *   META_ACCESS_TOKEN      optioneel — zonder dit werkt meta_insights niet
 *   META_AD_ACCOUNT_ID     optioneel — bv. act_242238038391551
 *   KLAVIYO_API_KEY        optioneel — zonder dit werken de klaviyo-tools niet
 *
 * Guardrail die in de code zit: er bestaat geen pad waarlangs dit systeem uit
 * zichzelf geld uitgeeft of iets verstuurt. Publiceren vraagt een admin, en de
 * goedkeuring wordt aangemaakt bij het klaarzetten, niet bij de goede wil van
 * de aanvrager. Sinds versie 16 is er ook geen model meer dat een opdracht
 * anders kan uitleggen dan hij bedoeld was: wat het systeem niet in code kent,
 * doet het niet.
 * ============================================================ */

/* Welke versie hier draait. Handmatig bijhouden, en dat is precies de bedoeling:
   dit nummer verandert alleen als iemand het bewust ophoogt, dus als /health een
   ouder nummer teruggeeft dan wat er in Git staat, is de deploy niet gebeurd.

   Dat is twee keer misgegaan en beide keren op dezelfde manier. Een reparatie
   stond in Git, niemand deployde hem, en het systeem gedroeg zich dagenlang
   alsof de reparatie er niet was -- terwijl elke controle in de repository groen
   stond. Er was geen enkele manier om van buitenaf te zien welke code er draaide.
   Nu wel: één curl naar /health en je weet het.

   Ophogen bij elke deploy die gedrag verandert. VERSIE_DATUM is de datum van de
   wijziging, niet van de deploy -- staat die ver in het verleden terwijl er net
   iets is aangepast, dan draait er oude code. */
/* Twee takken kwamen allebei op 14 uit en dat is precies wat dit nummer moet
   voorkomen: vanmiddag stond er twee keer achter elkaar "versie 14" op /health
   terwijl er andere code draaide, en toen was aan het nummer niet te zien wat
   er live stond. De samenvoeging is een derde ding en krijgt dus een eigen
   nummer. */
const VERSIE = 28;
const VERSIE_DATUM = '2026-09-01';
const VERSIE_WAT = 'de merken een voor een in plaats van allemaal tegelijk (TrendTrack knijpt af), de naam van de adverteerder wint van het domein in de tracker, rangschikken op de advertentiepositie waar bereik ontbreekt, en een rij waar geen beeld uit komt meldt zijn eigen veldnamen zodat de volgende reparatie geen gokwerk is';

const SB_URL = 'https://bequyhghgkvekvibufhw.supabase.co';
const SB_ANON = 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv';
/* Wie de worker rechtstreeks vanuit de browser mag aanroepen. Staat een
   omgeving hier niet in, dan kan hij alleen via een tussenstap op zijn eigen
   origin — en die kapt lange calls af. Een adres erbij is dus goedkoper dan het
   omzeilen ervan. */
const ORIGINS = ['https://wellshave-adgen.netlify.app', 'https://wellshave-werkbank.netlify.app',
                 'http://localhost:8823', 'http://127.0.0.1:8823'];
/* De deploy previews van diezelfde twee sites draaien dezelfde console en dus
   dezelfde lange calls; via de tussenstap sneuvelt het uitwerken van drie
   concepten op de dertig seconden. Alleen previews van deze twee sites, en
   toegang blijft hoe dan ook een ingelogd en goedgekeurd teamaccount. */
const ORIGIN_PATROON = /^https:\/\/deploy-preview-\d+--wellshave-(adgen|werkbank)\.netlify\.app$/;
const originMag = (o) => ORIGINS.includes(o) || ORIGIN_PATROON.test(o);

const MODEL = 'claude-opus-5';
const FALLBACK_MODEL = 'claude-fable-5';
const META_API = 'https://graph.facebook.com/v21.0';
const ATRIA_API = 'https://api.tryatria.com';
const TRENDTRACK_API = 'https://api.trendtrack.io';

/* De Facebook-pagina waaronder de advertenties hangen. Geverifieerd tegen het
   account: bestaande creatives hebben een object_story_id die hiermee begint. */
const META_PAGE_ID = '100135282880333';
const WINKEL_URL = 'https://wellshave.nl';
const KLAVIYO_API = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2025-07-15';

/* Hoeveel werk één cron-tick doet. Een Worker-invocatie heeft beperkte tijd;
   liever drie jobs per tick dan één tick die halverwege wordt afgekapt. */
const JOBS_PER_TICK = 3;
const JOB_TIMEOUT_MIN = 15;      // daarna geldt een job als vastgelopen

/* ============================================================
 * 1. Supabase — server-side, met de service key
 * ============================================================ */

function sbHeaders(env, extra) {
  const key = env.SUPABASE_SERVICE_KEY;
  return Object.assign({
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  }, extra || {});
}

/* PostgREST spreekt alleen public aan; marketing_hq is bereikbaar via de
   hq_*-views uit 0002/0004/0005. Schrijven gaat rechtstreeks op het schema
   met de Accept-Profile/Content-Profile-headers. */
async function sbSelect(env, table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query || ''}`, {
    headers: sbHeaders(env, { 'Accept-Profile': 'marketing_hq' })
  });
  if (!r.ok) throw new Error(`select ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbInsert(env, table, rows, opts) {
  const prefer = ['return=representation'];
  if (opts && opts.onConflict) prefer.push('resolution=merge-duplicates');
  const url = `${SB_URL}/rest/v1/${table}` +
    (opts && opts.onConflict ? `?on_conflict=${opts.onConflict}` : '');
  const r = await fetch(url, {
    method: 'POST',
    headers: sbHeaders(env, { 'Content-Profile': 'marketing_hq', 'Prefer': prefer.join(',') }),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  if (!r.ok) throw new Error(`insert ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbUpdate(env, table, query, patch) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: sbHeaders(env, { 'Content-Profile': 'marketing_hq', 'Prefer': 'return=representation' }),
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error(`update ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbRpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: sbHeaders(env, { 'Content-Profile': 'marketing_hq' }),
    body: JSON.stringify(args || {})
  });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* Publieke tabellen van de console (creatives, products, personas, …). */
async function sbPublic(env, table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query || ''}`, { headers: sbHeaders(env) });
  if (!r.ok) throw new Error(`select public.${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

/* ============================================================
 * 3. Sleutelbeheer — de API-sleutels, versleuteld in de database
 * ============================================================
 *
 * Waarom dit bestaat: een sleutel wisselen vroeg een terminal met wrangler
 * erin, en dat heeft niet iedereen die het wel mag beslissen. Nu kan het via
 * het adminmenu in de console.
 *
 * Waarom het niet gewoon een tabel met tekst is: dan verplaatst het probleem
 * zich van de broncode naar de database, en leest iedereen met een dump of
 * een gelekte Supabase-sleutel je API-sleutels mee. Dus staat de waarde
 * versleuteld met AES-GCM, en staat de hoofdsleutel waarmee dat gebeurt als
 * Worker secret (SLEUTEL_MASTER). Twee dingen op twee plekken; je hebt ze
 * allebei nodig.
 *
 * De leesvolgorde is expres deze:
 *   1. de database, want dat is wat je via het scherm zet;
 *   2. het Worker secret, als daar niets staat.
 * Zo blijft een bestaande opzet werken en is dit een toevoeging in plaats van
 * een omschakeling met een moment waarop niets het doet.
 */

/* De waarde kort bijhouden. De worker leeft per aanroep, maar binnen een
   aanroep kan dezelfde sleutel meerdere keren gevraagd worden en dan is een
   tweede databaseronde weggegooid werk. Zestig seconden is lang genoeg om dat
   te schelen en kort genoeg dat een wissel meteen aankomt. */
const _sleutelCache = new Map(); // naam -> { exp, waarde, bron }

function b64naarBytes(b64) {
  const bin = atob(b64);
  const uit = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) uit[i] = bin.charCodeAt(i);
  return uit;
}
function bytesNaarB64(bytes) {
  let bin = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}

/* De hoofdsleutel als AES-GCM-sleutel. SLEUTEL_MASTER is willekeurige tekst;
   die wordt gehasht naar precies 256 bits, zodat elke lengte werkt en niemand
   een wachtwoord van exact 32 tekens hoeft te verzinnen. */
async function masterSleutel(env) {
  if (!env.SLEUTEL_MASTER) return null;
  const ruw = new TextEncoder().encode(env.SLEUTEL_MASTER);
  const hash = await crypto.subtle.digest('SHA-256', ruw);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function versleutel(env, tekst) {
  const k = await masterSleutel(env);
  if (!k) throw new Error('SLEUTEL_MASTER ontbreekt op deze worker');
  /* Een nieuwe nonce per keer. Twee keer dezelfde nonce met dezelfde sleutel
     is de ene fout die AES-GCM echt breekt, dus hij wordt nooit hergebruikt
     en nooit afgeleid van de inhoud. */
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, k, new TextEncoder().encode(tekst));
  return { cipher: bytesNaarB64(cipher), nonce: bytesNaarB64(nonce) };
}

async function ontsleutel(env, cipherB64, nonceB64) {
  const k = await masterSleutel(env);
  if (!k) return null;
  try {
    const plat = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64naarBytes(nonceB64) }, k, b64naarBytes(cipherB64));
    return new TextDecoder().decode(plat);
  } catch (e) {
    /* Mislukt ontsleutelen betekent bijna altijd: SLEUTEL_MASTER is gewisseld
       nadat deze rij geschreven werd. De rij is dan niet stuk maar onleesbaar,
       en de sleutel moet opnieuw gezet worden. Null teruggeven en laten
       terugvallen op het Worker secret -- een uitzondering hier zou de hele
       console platleggen om iets wat op te lossen is. */
    return null;
  }
}

/* De sleutel die de worker werkelijk moet gebruiken. */
async function sleutelVan(env, naam) {
  const nu = Date.now();
  const c = _sleutelCache.get(naam);
  if (c && c.exp > nu) return c.waarde;

  let waarde = null, bron = null;
  if (env.SUPABASE_SERVICE_KEY && env.SLEUTEL_MASTER) {
    try {
      const rijen = await sbSelect(env, 'systeem_geheimen',
        'naam=eq.' + encodeURIComponent(naam) + '&select=cipher,nonce');
      if (rijen && rijen[0]) {
        waarde = await ontsleutel(env, rijen[0].cipher, rijen[0].nonce);
        if (waarde) bron = 'database';
      }
    } catch (e) { /* database onbereikbaar: dan het secret, niet niets */ }
  }
  if (!waarde && env[naam]) { waarde = env[naam]; bron = 'worker secret'; }

  _sleutelCache.set(naam, { exp: nu + 60000, waarde: waarde, bron: bron });
  return waarde;
}

/* Waar een sleutel vandaan komt, zonder hem te lezen. Voor het scherm. */
async function sleutelHerkomst(env, naam) {
  await sleutelVan(env, naam); // vult de cache, inclusief bron
  const c = _sleutelCache.get(naam);
  return (c && c.bron) || 'ontbreekt';
}

/* Ziet dit eruit als een sleutel van deze dienst? Niet om slim te zijn, maar
   omdat de meest voorkomende fout een meegeplakte spatie of een half
   gekopieerde sleutel is. Die sla je liever niet op om er een dag later
   achter te komen dat de console "invalid" zegt. */
function sleutelVormKlopt(naam, waarde) {
  const w = String(waarde || '').trim();
  if (naam === 'ANTHROPIC_KEY') return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(w);
  if (naam === 'OPENAI_KEY') return /^sk-[A-Za-z0-9_-]{20,}$/.test(w);
  if (naam === 'ATRIA_API_KEY') return /^atria-sk_[A-Za-z0-9_-]{16,}$/.test(w);
  /* TrendTrack schrijft geen voorvoegsel voor. Dan blijft alleen de vorm over
     die elke sleutel heeft: lang genoeg, en zonder spaties of regeleindes --
     precies wat er misgaat bij plakken uit een e-mail of een chatvenster. */
  if (naam === 'TRENDTRACK_API_KEY') return /^[A-Za-z0-9._-]{24,}$/.test(w);
  return false;
}

/* De sleutels die dit systeem kent. Eén lijst, want drie plekken die elk hun
   eigen lijstje bijhouden lopen uit elkaar: dan staat er een sleutel in het
   menu die de worker weigert op te slaan, of andersom. */
const SLEUTELNAMEN = ['ANTHROPIC_KEY', 'OPENAI_KEY', 'ATRIA_API_KEY', 'TRENDTRACK_API_KEY'];

/* De foutmelding van de dienst inkorten tot iets bruikbaars. Voluit
   doorgeven kan de sleutel bevatten die je net probeerde: sommige diensten
   echoen hem terug in hun melding, en dan staat hij alsnog in beeld. */
function kortDeFout(tekst, status, sleutel) {
  let bericht = '';
  try { const o = JSON.parse(tekst); bericht = (o.error && (o.error.message || o.error.type)) || ''; } catch (e) { }
  if (!bericht) { try { const o = JSON.parse(tekst); bericht = o.message || o.error || ''; } catch (e) { } }
  /* En de details erbij. "Request validation failed" zonder te zeggen WELK veld
     faalde kostte een halve ochtend zoeken -- de dienst stuurt dat wel mee, in
     een veld dat we niet lazen. Elke vorm die diensten hiervoor gebruiken staat
     hieronder; wat er niet is wordt overgeslagen. */
  try {
    const o = JSON.parse(tekst);
    const details = o.errors || o.details || o.detail || o.issues || (o.error && (o.error.errors || o.error.details));
    const stukken = [];
    (Array.isArray(details) ? details : (details ? [details] : [])).forEach(function (d) {
      if (typeof d === 'string') { stukken.push(d); return; }
      if (d && typeof d === 'object') {
        const waar = d.path || d.field || d.param || d.loc || '';
        const wat = d.message || d.msg || d.reason || d.code || '';
        const zin = [Array.isArray(waar) ? waar.join('.') : waar, wat].filter(Boolean).join(': ');
        if (zin) stukken.push(zin);
      }
    });
    if (stukken.length) bericht = (bericht ? bericht + ' — ' : '') + stukken.join('; ');
    if (!bericht && o.errorMessage) bericht = String(o.errorMessage);
  } catch (e) { }
  bericht = String(bericht);
  /* De sleutel die we net gebruikt hebben letterlijk wegstrepen. De patronen
     hieronder dekken alleen diensten met een herkenbaar voorvoegsel, en dat is
     precies waar dit misging: een TrendTrack-sleutel heeft er geen, dus die
     kwam gewoon mee in de melding op het scherm. De waarde die we in de hand
     hebben is de enige maskering die altijd klopt. */
  if (sleutel && String(sleutel).length > 7) {
    bericht = bericht.split(String(sleutel)).join('<sleutel>');
  }
  bericht = bericht
    .replace(/atria-sk_[A-Za-z0-9_-]{8,}/g, '<sleutel>')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '<sleutel>')
    .slice(0, 140);
  return bericht || ('de dienst antwoordde met ' + status);
}

/* Werkt hij ook echt? Dit is de vraag die /health niet beantwoordde, en dat
   heeft een halve dag gekost: het veld was gevuld, dus alles stond groen,
   terwijl de sleutel al ingetrokken was. Een zo klein mogelijke aanroep. */
async function sleutelWerkt(env, naam) {
  const sleutel = await sleutelVan(env, naam);
  if (!sleutel) return { geldig: false, reden: 'er staat geen sleutel' };
  try {
    if (naam === 'ANTHROPIC_KEY') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': sleutel, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'x' }] })
      });
      if (r.ok) return { geldig: true, reden: null };
      return { geldig: false, reden: kortDeFout(await r.text(), r.status, sleutel) };
    }
    if (naam === 'TRENDTRACK_API_KEY') {
      /* /v1/me is bij TrendTrack met opzet ongemeten: hij kost geen credits en
         zegt precies wat je wilt weten -- op welke werkruimte deze sleutel
         uitkomt. Een zoekopdracht als proef zou credits verbranden. */
      const r = await fetch(TRENDTRACK_API + '/v1/me', { headers: { 'Authorization': 'Bearer ' + sleutel } });
      if (r.ok) return { geldig: true, reden: null };
      return { geldig: false, reden: kortDeFout(await r.text(), r.status, sleutel) };
    }
    if (naam === 'ATRIA_API_KEY') {
      /* De goedkoopste vraag die Atria kent: welke advertentieaccounts hangen
         aan deze werkruimte. Geen paginering, geen credits. */
      const r = await fetch(ATRIA_API + '/open/v1/ad-accounts', { headers: { 'X-API-Key': sleutel } });
      if (r.ok) return { geldig: true, reden: null };
      return { geldig: false, reden: kortDeFout(await r.text(), r.status, sleutel) };
    }
    const r = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': 'Bearer ' + sleutel } });
    if (r.ok) return { geldig: true, reden: null };
    return { geldig: false, reden: kortDeFout(await r.text(), r.status, sleutel) };
  } catch (e) {
    return { geldig: false, reden: 'de dienst was niet bereikbaar' };
  }
}

/* Zetten. Geeft terug wat het scherm mag weten -- nooit de waarde zelf. */
async function sleutelZet(env, naam, waarde, wie) {
  const w = String(waarde || '').trim();
  if (!sleutelVormKlopt(naam, w)) {
    return { error: 'dat ziet er niet uit als een ' + naam + '. Controleer of de hele sleutel geplakt is.', status: 400 };
  }
  if (!env.SLEUTEL_MASTER) {
    return { error: 'SLEUTEL_MASTER ontbreekt op deze worker. Zet hem eenmalig met: npx wrangler secret put SLEUTEL_MASTER', status: 500 };
  }
  const enc = await versleutel(env, w);
  await sbInsert(env, 'systeem_geheimen', [{
    naam: naam, cipher: enc.cipher, nonce: enc.nonce,
    staart: w.slice(-4), gezet_door: wie, gezet_op: new Date().toISOString()
  }], { onConflict: 'naam' });
  /* De cache meteen leeg, anders blijft de oude sleutel nog een minuut in
     gebruik en denkt de beheerder dat het niet gewerkt heeft. */
  _sleutelCache.delete(naam);
  return { ok: true, naam: naam, staart: w.slice(-4) };
}

/* Wat er over de sleutels te vertellen valt zonder er iets van prijs te
   geven: waar hij vandaan komt, aan welke staart je hem herkent, wie hem
   wanneer heeft gezet. */
async function sleutelOverzicht(env) {
  let rijen = [];
  try {
    rijen = await sbSelect(env, 'systeem_geheimen', 'select=naam,staart,gezet_door,gezet_op');
  } catch (e) { rijen = []; }
  const perNaam = {};
  rijen.forEach(function (r) { perNaam[r.naam] = r; });
  const uit = [];
  for (const naam of SLEUTELNAMEN) {
    const r = perNaam[naam] || {};
    uit.push({
      naam: naam,
      bron: await sleutelHerkomst(env, naam),
      staart: r.staart || null,
      gezet_door: r.gezet_door || null,
      gezet_op: r.gezet_op || null
    });
  }
  return { sleutels: uit, master: !!env.SLEUTEL_MASTER };
}

/* ============================================================
 * 4. Meta Ads
 * ============================================================ */

function metaActie(acties, naam) {
  if (!Array.isArray(acties)) return null;
  const a = acties.find(x => x.action_type === naam);
  return a ? Number(a.value) : null;
}

/* act_ ervoor of niet: Meta accepteert beide op de insights-edge, maar niet
   overal. Intern werken we zonder, en zetten het erop waar het moet. */
function kaalAccount(id) { return String(id || '').replace(/^act_/, ''); }

/* De accounts komen uit ad_accounts (0014), niet uit META_AD_ACCOUNT_ID. Een
   secret is één waarde en kent geen merk, geen valuta en geen "deze ligt stil
   sinds mei" — en je kunt er niet op joinen.

   Valt de database weg, dan blijft het secret als noodrem staan: liever één
   account meten dan nul. Dat wordt wel gemeld, want stilzwijgend terugvallen
   op één account is precies hoe de audit van 30 juli over één account ging
   terwijl er vijf waren. */
async function actieveAccounts(env, alleen) {
  if (alleen) return [{ account_id: kaalAccount(alleen), naam: kaalAccount(alleen), merk: null }];
  try {
    const rijen = await sbSelect(env, 'ad_accounts',
      'actief=is.true&select=account_id,naam,merk,valuta,primair&order=primair.desc,naam.asc');
    if (rijen.length) return rijen.map(r => ({ ...r, account_id: kaalAccount(r.account_id) }));
  } catch (e) { /* hieronder de noodrem */ }
  if (!env.META_AD_ACCOUNT_ID) return [];
  return [{ account_id: kaalAccount(env.META_AD_ACCOUNT_ID), naam: 'uit META_AD_ACCOUNT_ID',
            merk: null, noodrem: true }];
}

/* Welk account hoort bij dit merk. Bij meerdere draaiende accounts op hetzelfde
   merk wint de primaire; staan er twee primair, dan is dat een keuze die een
   mens moet maken en geen gok die een agent mag doen. */
async function accountVoorMerk(env, merk) {
  if (!merk) return null;
  let rijen;
  try {
    rijen = await sbSelect(env, 'ad_accounts',
      `actief=is.true&merk=eq.${encodeURIComponent(String(merk).toLowerCase())}`
      + '&select=account_id,primair&order=primair.desc');
  } catch (e) { return null; }
  if (!rijen.length) return null;
  if (rijen.length > 1 && rijen[0].primair && rijen[1].primair) return null;
  return rijen[0].account_id;
}

/* Meta accepteert maar een handvol date_preset-waarden: last_3d, last_7d,
   last_14d, last_28d, last_30d, last_90d. "last_4d" bestaat niet, en dat is
   precies wat er uit 'last_' + days + 'd' rolde toen Atlas vier dagen vroeg —
   de attributiestaart loopt na, dus vier dagen is een normale vraag. Meta wees
   beide accounts af met een lijst toegestane waarden, en de melding daarboven
   maakte er "Meta weigerde account" van: dat leest als een rechtenprobleem en
   stuurt je naar Business Settings terwijl de fout hier stond.

   Afronden naar de dichtstbijzijnde toegestane waarde is geen oplossing: dan
   vraagt Atlas vier dagen en meet hij er zeven, zonder dat iemand dat ziet.
   time_range met een expliciete begin- en einddatum geeft exact het venster
   dat gevraagd is, voor elk aantal dagen.

   Vandaag telt mee (Meta rekent inclusief), dus het venster loopt van
   days-1 dagen geleden tot en met vandaag — bij days=4 zijn dat vier dagen. */
/* Tot 400 dagen en niet 365: de Creative Strategy Map begint op 4 augustus
   2025, en dat is net over een jaar. Op 365 blijft de eerste week van de map
   onbereikbaar -- precies de rijen waar het inhaalslagje om begonnen was. */
function metaVenster(days, verschuif) {
  var n = Math.max(1, Math.min(Number(days) || 7, 400));
  /* Een venster dat een heel venster terug ligt. Nodig om "daalt hij" te
     kunnen beantwoorden: dat is geen eigenschap van een advertentie maar een
     vergelijking tussen twee periodes, en zonder de tweede periode is het een
     gok met een pijltje erbij. De twee vensters raken elkaar en overlappen
     niet -- overlap zou de daling deels tegen zichzelf wegstrepen. */
  var v = Math.max(0, Number(verschuif) || 0);
  var eind = new Date(Date.now() - v * 86400000);
  var start = new Date(eind.getTime() - (n - 1) * 86400000);
  var dag = function (d) { return d.toISOString().slice(0, 10); };
  return JSON.stringify({ since: dag(start), until: dag(eind) });
}

/* Meta weigert een verzoek dat te veel data omvat, en dat is geen randgeval:
   400 dagen × per dag × advertentieniveau leverde letterlijk "Please reduce
   the amount of data you're asking for". Niet paginatie -- daar komt hij niet
   eens aan toe, hij weigert het verzoek zelf.

   Paginatie lost het halen van véél rijen op; dit lost het vrágen om een groot
   venster op. Twee verschillende grenzen, allebei nodig voor de inhaalslag.

   Alleen knippen als het nodig is: bij per-dag-uitsplitsing over meer dan 45
   dagen. De dagelijkse run van zeven dagen houdt dus exact één verzoek, precies
   zoals hij had -- een reparatie die het normale geval verandert, repareert
   niet maar verplaatst. */
function vensterStukken(days, expliciet) {
  var dag = function (d) { return d.toISOString().slice(0, 10); };

  /* Een expliciet venster is voor de inhaalslag: die haalt precies één gat op
     dat ergens in het verleden ligt, en niet "de laatste N dagen tot vandaag".
     Zonder dit zou een gat van 120 dagen in oktober alleen te vullen zijn door
     alles sinds oktober opnieuw op te halen -- dat werkt (de upsert is
     idempotent) maar het duurt tien keer zo lang en het is niet na te rekenen
     welk stuk nu eigenlijk aan de beurt was. */
  if (expliciet && expliciet.since && expliciet.until) {
    var s = new Date(expliciet.since + 'T00:00:00Z');
    var e = new Date(expliciet.until + 'T00:00:00Z');
    var uit = [];
    var c = new Date(s.getTime());
    while (c <= e && uit.length < 30) {
      var t = new Date(Math.min(c.getTime() + 29 * 86400000, e.getTime()));
      uit.push(JSON.stringify({ since: dag(c), until: dag(t) }));
      c = new Date(t.getTime() + 86400000);
    }
    return uit;
  }

  var n = Math.max(1, Math.min(Number(days) || 7, 400));
  if (n <= 45) return [metaVenster(n)];

  var eind = new Date();
  var start = new Date(eind.getTime() - (n - 1) * 86400000);
  var stukken = [];
  var cursor = new Date(start.getTime());
  /* De grens van 30 stukken is een noodrem, geen verwachting: 400 dagen in
     stukken van 30 zijn er veertien. Hij staat er omdat een lus die zichzelf
     niet opschuift in een Worker niet crasht maar hángt, en een hangende cron
     om 07:00 is stiller dan een fout. Dit is nagemeten: één teken weg uit de
     regel hieronder (de + 86400000) liet de testlus oneindig doorlopen in
     plaats van falen -- en dat is precies het gedrag dat je in productie niet
     wilt ontdekken. */
  while (cursor <= eind && stukken.length < 30) {
    var tot = new Date(Math.min(cursor.getTime() + 29 * 86400000, eind.getTime()));
    stukken.push(JSON.stringify({ since: dag(cursor), until: dag(tot) }));
    cursor = new Date(tot.getTime() + 86400000);
  }
  return stukken;
}

async function metaInsights(env, level, days, accountId, ctx, venster) {
  const account = kaalAccount(accountId || env.META_AD_ACCOUNT_ID);
  const velden = ['spend', 'impressions', 'reach', 'frequency', 'clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm', 'actions', 'action_values', 'purchase_roas',
    'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
    /* Niet video_3_sec_watched_actions: dat veld is uit de Graph API
       verwijderd en wij praten met v21.0. Meta keurt een verzoek per veld,
       niet per verzoek — één onbekende naam laat de hele call stuklopen, ook
       bij een venster dat wél klopt. Dat is de reden dat meta_insights_daily
       tien dagen leeg bleef terwijl de accounts gewoon geld uitgaven, en het
       is ook waarom alleen de time_range-correctie uitrollen niets had
       opgelost: dan blijft deze fout over en lijkt de deploy mislukt.

       video_play_actions telt hoe vaak de video start (zonder herhalingen) en
       is wat Meta zelf in de plaats stelde. De verhouding blijft dus dezelfde:
       gestart gedeeld door vertoond is de hook rate. */
    'video_play_actions', 'video_thruplay_watched_actions'];
  if (level !== 'account') velden.push(level + '_id', level + '_name');

  const bouw = (lijst, venster) => {
    const p = new URLSearchParams({
      access_token: env.META_ACCESS_TOKEN,
      level: level,
      fields: lijst.join(','),
      time_range: venster,
      limit: '500',
      /* Vast, niet instelbaar. Zonder time_increment geeft Meta één rij voor
         de hele periode, met date_start op de eerste dag van het venster — en
         die rij ging vroeger gewoon meta_insights_daily in. Dat was de fout van
         0049. Sinds versie 16 is er geen aanroeper meer die hier iets anders
         van kan maken: de mogelijkheid is weg, niet de standaard veranderd. */
      time_increment: '1'
    });
    return p;
  };

  /* Meta keurt een verzoek per veld en weigert het geheel bij één onbekende
     naam. Dat is twee keer gebeurd met hetzelfde veld: eerst tien dagen, daarna
     nog twee omdat de reparatie wel in Git stond en niet op de worker. Beide
     keren gaven de accounts gewoon geld uit en stond meet-Nederland stil om één
     woord in een lijst van twintig.

     Het patroon is het probleem, niet dat ene veld: Meta schrapt periodiek
     velden, en dan valt de hele sync om in plaats van één kolom. Daarom wordt
     de naam die Meta noemt uit de lijst gehaald en gaat het verzoek opnieuw.
     Wat eruit viel komt mee terug, zodat het zichtbaar is in plaats van stil
     minder te gaan meten -- een sync die stilletjes één kolom minder ophaalt is
     erger dan een die klaagt.

     Een grens van vijf: bij meer dan vijf onbruikbare velden is er iets anders
     aan de hand (een verlopen token, een nieuwe API-versie) en is doorgaan met
     een uitgeklede lijst geen meting meer maar een gok. */
  let lijst = velden.slice();
  const gesneuveld = [];
  const rijen = [];
  const stukken = vensterStukken(days, venster);
  const mislukt = [];

  /* Een geweigerd venster wordt gehalveerd en opnieuw geprobeerd.
   *
   * Meta keurt een verzoek niet alleen af op inhoud maar ook op omvang. Op
   * accountniveau is een venster van dertig dagen dertig rijen; op
   * advertentieniveau met time_increment=1 zijn het er duizenden, en dan komt
   * er "An unknown error occurred" terug -- een generieke fout die niets zegt
   * over wat er mis is. Dat is precies wat er gebeurde: accountniveau vulde
   * netjes door terwijl advertentieniveau maandenlang niets opleverde, en de
   * dekking zag er daardoor half uit zonder dat iets "kapot" was.
   *
   * Een vast kleiner venster was de andere optie. Dat lost het vandaag op en
   * breekt weer zodra het aantal advertenties groeit. Halveren past zich aan:
   * een blok dat te zwaar is valt uiteen tot het licht genoeg is, en een blok
   * dat in één keer kan blijft één verzoek.
   *
   * De bodem ligt op één dag. Weigert Meta een enkele dag, dan is het niet de
   * omvang en heeft verder knippen geen zin. */
  const werk = stukken.slice();
  let gesplitst = 0;
  /* Tellen hoeveel vensters écht iets opleverden. Vergelijken op aantallen
     (mislukt tegenover stukken) kan niet meer zodra er gesplitst wordt: één
     geweigerd venster van dertig dagen wordt dan vijf mislukkingen terwijl
     `stukken` er nog steeds één telt. Die vergelijking gaf géén fout bij nul
     rijen, en dat is precies de stille storing waar dit bestand tegen gebouwd
     is. Dus turven we het enige wat telt: is er ooit iets binnengekomen. */
  let gelukt = 0;
  const GRENS_SPLITSEN = 200;

  const halveer = (v) => {
    let o;
    try { o = JSON.parse(v); } catch (e) { return null; }
    const van = new Date(o.since + 'T00:00:00Z');
    const tot = new Date(o.until + 'T00:00:00Z');
    const dagen = Math.round((tot - van) / 86400000) + 1;
    if (dagen < 2) return null;
    const helft = Math.floor(dagen / 2);
    const midden = new Date(van.getTime() + (helft - 1) * 86400000);
    const dag = (d) => d.toISOString().slice(0, 10);
    return [
      JSON.stringify({ since: dag(van), until: dag(midden) }),
      JSON.stringify({ since: dag(new Date(midden.getTime() + 86400000)), until: dag(tot) })
    ];
  };

  while (werk.length) {
  const venster = werk.shift();
  let data = null;
  for (let poging = 0; poging <= 5; poging++) {
    const r = await fetch(`${META_API}/act_${account}/insights?${bouw(lijst, venster)}`);
    data = await r.json();
    if (!data.error) break;

    const bericht = data.error.message || JSON.stringify(data.error);
    /* Meta noemt het onbruikbare veld in twee verschillende formuleringen,
       afhankelijk van waar de afkeuring vandaan komt. De eerste is wat er in
       productie stond toen dit misging; de tweede gebruikt Meta elders. Op
       maar één van de twee matchen betekent dat de reparatie de helft van de
       gevallen niet ziet. */
    const m = /\(#100\)\s+([a-z0-9_]+)\s+is not valid for fields param/i.exec(bericht)
           || /nonexisting field \(([a-z0-9_]+)\)/i.exec(bericht);
    const weg = m && lijst.indexOf(m[1]) > -1 ? m[1] : null;
    /* Eén stuk dat weigert mag de andere dertien niet meenemen. */
    if (!weg) {
      /* Eerst kleiner proberen: dit is meestal geen inhoudelijke afkeuring
         maar een venster dat te zwaar is. */
      const helften = gesplitst < GRENS_SPLITSEN ? halveer(venster) : null;
      if (helften) {
        gesplitst++;
        werk.unshift(helften[0], helften[1]);
        data = null;
        break;
      }
      if (stukken.length === 1 && !gesplitst) throw new Error('Meta: ' + bericht);
      mislukt.push({ venster: venster, reden: bericht.slice(0, 160) });
      data = null;
      break;
    }

    lijst = lijst.filter(v => v !== weg);
    gesneuveld.push(weg);
    data = null;
  }
  if (!data || data.error) {
    if (stukken.length === 1 && !gesplitst) {
      throw new Error('Meta: te veel onbruikbare velden (' + gesneuveld.join(', ')
        + ') — controleer de API-versie ' + META_API.split('/').pop() + ' en het token');
    }
    continue;
  }

  /* Meta geeft één pagina en een verwijzing naar de volgende. Die verwijzing
     werd nooit gevolgd. Op accountniveau over zeven dagen valt dat niet op --
     dat zijn zeven rijen -- maar op advertentieniveau over een half jaar zijn
     het er duizenden, en dan stopte het bij de eerste 500 zonder dat er iets
     misging. Een sync die stilletjes de helft laat liggen ziet er precies zo
     uit als een die klopt, en dat is het gevaarlijkste wat een meting kan doen.

     De grens van veertig pagina's is een noodrem, geen verwachting: bij 500
     per pagina zijn dat 20.000 rijen. Wordt hij geraakt, dan is dat te zien in
     plaats van te raden. */
  gelukt++;
  rijen.push(...(data.data || []));
  let volgende = data.paging && data.paging.next;
  let paginas = 1;
  let gebroken = false;
  while (volgende && paginas < 40) {
    const r = await fetch(volgende);
    const p = await r.json();
    if (p.error) {
      await logEvent(env, ctx || {}, 'warn',
        `Meta brak af na ${paginas} pagina('s) voor ${account}: ${String(p.error.message || '').slice(0, 160)}`,
        { fout: p.error, paginas: paginas, level: level });
      gebroken = true;
      break;
    }
    rijen.push(...(p.data || []));
    volgende = p.paging && p.paging.next;
    paginas++;
  }
  /* Alleen als de noodrem het einde was. Brak Meta zelf af, dan staat dat er
     al bij, en zou dit erbovenop beweren dat er veertig pagina's waren -- een
     verkeerd getal is erger dan geen getal, want daar gaat iemand naar zoeken. */
  if (volgende && !gebroken) {
    await logEvent(env, ctx || {}, 'warn',
      `Meta had na 40 pagina's nog meer voor ${account} op ${level}-niveau; de rest is niet opgehaald`,
      { paginas: paginas, rijen: rijen.length, level: level, account: account });
  }
  } /* volgend stuk */

  if (gesplitst) {
    await logEvent(env, ctx || {}, 'info',
      `Meta weigerde ${gesplitst} venster(s) voor ${account} op ${level}-niveau; opgeknipt en alsnog opgehaald`,
      { gesplitst: gesplitst, level: level, account: account, rijen: rijen.length });
  }

  if (gesneuveld.length) {
    /* Geen throw: er zijn wél cijfers, ze zijn alleen smaller. Wel luid, want
       dit is de enige plek waar zichtbaar wordt dat Meta iets heeft geschrapt. */
    await logEvent(env, ctx || {}, 'warn', 'Meta kent deze velden niet meer; zonder verder gemeten',
      { velden: gesneuveld, api: META_API.split('/').pop(), account: account });
  }
  /* Een gat in een inhaalslag is erger dan een mislukte inhaalslag: bij het
     eerste ziet de map er compleet uit terwijl er maanden ontbreken. Daarom
     luid, met de vensters erbij zodat je weet wélke maanden. */
  if (mislukt.length) {
    if (!gelukt) {
      throw new Error('Meta: geen enkel venster gelukt (' + mislukt.length + ' geprobeerd) — '
        + mislukt[0].reden);
    }
    await logEvent(env, ctx || {}, 'warn',
      `Meta gaf ${mislukt.length} venster(s) niet voor ${account} op ${level}-niveau; die periodes ontbreken`,
      { mislukt: mislukt, level: level, account: account, gelukt: gelukt });
  }

  return rijen.map(row => {
    const acties = row.actions || [];
    const waarden = row.action_values || [];
    const aankopen = metaActie(acties, 'purchase') || metaActie(acties, 'omni_purchase');
    const omzet = metaActie(waarden, 'purchase') || metaActie(waarden, 'omni_purchase');
    const spend = Number(row.spend) || 0;
    const roasVeld = Array.isArray(row.purchase_roas) && row.purchase_roas[0]
      ? Number(row.purchase_roas[0].value) : null;
    return {
      insight_date: row.date_start || vandaag(),
      account_id: account,
      level: level,
      entity_id: row[level + '_id'] || account,
      entity_name: row[level + '_name'] || null,
      spend: spend,
      impressions: Number(row.impressions) || 0,
      reach: Number(row.reach) || null,
      frequency: row.frequency != null ? Number(row.frequency) : null,
      clicks: Number(row.clicks) || null,
      link_clicks: Number(row.inline_link_clicks) || null,
      ctr: row.ctr != null ? Number(row.ctr) : null,
      cpc: row.cpc != null ? Number(row.cpc) : null,
      cpm: row.cpm != null ? Number(row.cpm) : null,
      purchases: aankopen,
      purchase_value: omzet,
      roas: roasVeld != null ? roasVeld : (spend > 0 && omzet ? Number((omzet / spend).toFixed(3)) : null),
      add_to_cart: metaActie(acties, 'add_to_cart') || metaActie(acties, 'omni_add_to_cart'),
      initiate_checkout: metaActie(acties, 'initiate_checkout') || metaActie(acties, 'omni_initiated_checkout'),
      landing_page_views: metaActie(acties, 'landing_page_view'),
      /* Twee stappen die de audit van 30 juli miste. ViewContent is de
         belangrijkste: staat die ver onder landing_page_views, dan vuurt de
         pixel op de bestemming niet en is de hele bovenkant van de trechter
         onbruikbaar. Bij één campagne stonden er 37 tegenover 477. */
      view_content: metaActie(acties, 'view_content') || metaActie(acties, 'omni_view_content'),
      add_payment_info: metaActie(acties, 'add_payment_info') || metaActie(acties, 'omni_add_payment_info'),
      video_3s: metaActie(row.video_play_actions, 'video_view'),
      /* video_thruplay stond sinds 0005 in het schema en werd nooit gevuld.
         Daardoor was hold_rate (thruplay gedeeld door starts) altijd leeg —
         niet omdat er geen video draaide, maar omdat de helft van de breuk
         nooit werd opgehaald. */
      video_thruplay: metaActie(row.video_thruplay_watched_actions, 'video_view'),
      quality_ranking: row.quality_ranking || null,
      engagement_rate_ranking: row.engagement_rate_ranking || null,
      conversion_rate_ranking: row.conversion_rate_ranking || null,
      /* Meta corrigeert tot ~72 uur terug; alles binnen dat venster is voorlopig. */
      is_final: dagenGeleden(row.date_start) > 3
    };
  });
}

/* ============================================================
 * 4b. Publiceren naar Meta
 *
 * De scheiding die dit hele blok draagt: klaarzetten en publiceren zijn twee
 * verschillende dingen, met twee verschillende uitvoerders.
 *
 *   klaarzetten  — een agent mag dit. Beeld uploaden en een adcreative
 *                  aanmaken kost niets en levert niets af: een creative die
 *                  aan geen enkele advertentie hangt, wordt nooit vertoond.
 *   publiceren   — alleen een admin, via POST /systeem/publicaties/<id>/publish,
 *                  en alleen als de bijbehorende approval op 'approved' staat.
 *                  Er bestaat geen agent-tool die deze stap kan zetten.
 *
 * Daarom maakt metaPrepare() wel een creative maar nooit een ad, en zit
 * metaPublish() niet in TOOLS maar achter een endpoint.
 * ============================================================ */

async function metaPost(env, pad, body, isForm) {
  const url = `${META_API}/${pad}`;
  let opties;
  if (isForm) {
    body.append('access_token', env.META_ACCESS_TOKEN);
    opties = { method: 'POST', body: body };
  } else {
    opties = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ access_token: env.META_ACCESS_TOKEN }, body))
    };
  }
  const r = await fetch(url, opties);
  const data = await r.json().catch(() => ({}));
  if (data.error) {
    const e = data.error;
    /* Meta's foutmeldingen zijn onleesbaar zonder de user-velden erbij. */
    throw new Error(`Meta ${e.code || r.status}: ${e.error_user_msg || e.message || 'onbekende fout'}`
      + (e.error_user_title ? ` (${e.error_user_title})` : ''));
  }
  if (!r.ok) throw new Error(`Meta ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

function base64NaarBytes(b64) {
  const schoon = String(b64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const bin = atob(schoon);
  const uit = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) uit[i] = bin.charCodeAt(i);
  return uit;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Beeld naar Meta. Dezelfde bytes leveren dezelfde hash op, dus dit is uit
   zichzelf idempotent: twee keer uploaden geeft twee keer hetzelfde beeld. */
async function metaUploadImage(env, bytes, bestandsnaam, accountId) {
  const form = new FormData();
  form.append('filename', new Blob([bytes], { type: 'image/png' }), bestandsnaam || 'creative.png');
  const data = await metaPost(env, `act_${kaalAccount(accountId || env.META_AD_ACCOUNT_ID)}/adimages`, form, true);
  const images = data.images || {};
  const eerste = Object.keys(images)[0];
  if (!eerste) throw new Error('Meta gaf geen image hash terug');
  return images[eerste].hash;
}

/* De link met de herkomst erin. Dit is de tweede, onafhankelijke koppeling:
   ook als onze database omvalt, staat in de Shopify-order welke publicatie de
   klant heeft binnengebracht. */
function bouwLink(basis, publicationId) {
  const url = new URL(basis);
  url.searchParams.set('utm_source', 'facebook');
  url.searchParams.set('utm_medium', 'paid');
  url.searchParams.set('utm_content', 'wg-' + publicationId);
  return url.toString();
}

/* Zet alles klaar tot en met de adcreative. Maakt géén advertentie aan. */
async function metaPrepare(env, gebruiker, invoer) {
  /* 1. De creative uit de console ophalen — daar zit het beeld en de herkomst. */
  const rijen = await sbPublic(env, 'creatives', `id=eq.${Number(invoer.creative_id)}&select=*`);
  const c = rijen[0];
  if (!c) return { error: `creative ${invoer.creative_id} bestaat niet` };
  if (!c.image_b64) return { error: `creative ${invoer.creative_id} heeft geen beeld; publiceren kan niet` };

  /* Het account volgt het merk van de creative. Vóór 0014 stond hier één vaste
     waarde uit een secret, en dan was een Wellshine-advertentie in het
     Wellshave-account een kwestie van tijd. Liever weigeren dan gokken: een
     advertentie in het verkeerde account is met geen enkele query terug te
     draaien. */
  const account = kaalAccount(invoer.account_id || await accountVoorMerk(env, c.brand));
  if (!account) {
    return { error: `geen draaiend advertentieaccount voor merk "${c.brand || 'onbekend'}" — `
      + `zet er een in ad_accounts of geef account_id expliciet mee` };
  }

  const bytes = base64NaarBytes(c.image_b64);
  const sha = await sha256Hex(bytes);

  /* 2. Bestaat er al een publicatie voor deze creative in deze ad set?
        Zo ja: teruggeven in plaats van een tweede aanmaken. */
  const idem = `${c.id}:${invoer.adset_id}:${sha.slice(0, 16)}`;
  const bestaand = await sbSelect(env, 'meta_publications',
    `idem_key=eq.${encodeURIComponent(idem)}&select=*`);
  if (bestaand[0] && bestaand[0].status !== 'mislukt') {
    return {
      al_klaargezet: true, publication_id: bestaand[0].id, status: bestaand[0].status,
      opmerking: 'Deze creative staat al klaar voor deze ad set. Er is niets nieuws aangemaakt.'
    };
  }

  /* 3. Publicatierij eerst, want het id gaat mee in de link. */
  const pub = (await sbInsert(env, 'meta_publications', {
    brand: c.brand || 'wellshave',
    creative_id: c.id,
    ad_name: invoer.ad_name || c.ad_name || `Creative ${c.id}`,
    account_id: account,
    adset_id: String(invoer.adset_id),
    campaign_id: invoer.campaign_id || null,
    asset_kind: 'image',
    asset_sha256: sha,
    headline: invoer.headline || c.ad_name || null,
    primary_text: invoer.primary_text || c.hook_short || null,
    description: invoer.description || null,
    cta_type: invoer.cta_type || 'SHOP_NOW',
    link_url: invoer.link_url || WINKEL_URL,
    page_id: META_PAGE_ID,
    hypothesis: invoer.hypothesis || null,
    angle: c.marketing_angle || null,
    persona: c.persona || null,
    awareness_level: c.awareness_level || null,
    proposed_daily_budget: invoer.daily_budget != null ? Number(invoer.daily_budget) : null,
    prepared_by: gebruiker,
    run_id: null,
    idem_key: idem,
    status: 'concept'
  }, { onConflict: 'idem_key' }))[0];

  try {
    /* 4. Beeld en creative bij Meta. Nog steeds geen advertentie. */
    const hash = await metaUploadImage(env, bytes, `wg-${pub.id}.png`, account);
    const link = bouwLink(invoer.link_url || WINKEL_URL, pub.id);

    const spec = {
      page_id: META_PAGE_ID,
      link_data: {
        image_hash: hash,
        link: link,
        message: invoer.primary_text || c.hook_short || '',
        name: invoer.headline || c.ad_name || '',
        call_to_action: { type: invoer.cta_type || 'SHOP_NOW', value: { link: link } }
      }
    };
    if (invoer.description) spec.link_data.description = invoer.description;

    const creative = await metaPost(env, `act_${account}/adcreatives`, {
      name: `${invoer.ad_name || c.ad_name || 'Creative ' + c.id} · wg-${pub.id}`,
      object_story_spec: spec,
      degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } } }
    });

    /* 5. De goedkeuring hoort bij het klaarzetten, niet bij de goede wil van de
          aanvrager. Door hem hier aan te maken kan een publicatie nooit bestaan
          zonder dat er iets voor een mens klaarligt om over te beslissen. */
    const app = (await sbInsert(env, 'approvals', {
      requested_by: gebruiker,
      action_type: 'ad_publish',
      description: [
        `Advertentie live zetten: "${invoer.ad_name || c.ad_name || 'Creative ' + c.id}"`,
        `Ad set ${invoer.adset_id}.`,
        invoer.daily_budget ? `Voorgesteld dagbudget €${Number(invoer.daily_budget).toFixed(2)}.` : '',
        invoer.hypothesis ? `Test: ${invoer.hypothesis}` : '',
        'Beeld en creative staan klaar bij Meta; er is nog geen advertentie aangemaakt.'
      ].filter(Boolean).join(' '),
      payload: {
        publication_id: pub.id,
        creative_id: c.id,
        adset_id: invoer.adset_id,
        meta_creative_id: creative.id,
        link: link,
        daily_budget: invoer.daily_budget || null
      }
    }))[0];

    await sbUpdate(env, 'meta_publications', `id=eq.${pub.id}`, {
      meta_image_hash: hash,
      meta_creative_id: creative.id,
      object_story_spec: spec,
      utm_content: 'wg-' + pub.id,
      link_url: link,
      approval_id: app.id,
      status: 'wacht_op_akkoord',
      prepared_at: new Date().toISOString()
    });

    return {
      publication_id: pub.id,
      meta_creative_id: creative.id,
      approval_id: app.id,
      status: 'wacht_op_akkoord',
      opmerking: 'Beeld en creative staan bij Meta en de goedkeuring is aangemaakt. '
        + 'Er is nog GEEN advertentie; die kan alleen een mens live zetten.'
    };
  } catch (e) {
    await sbUpdate(env, 'meta_publications', `id=eq.${pub.id}`, {
      status: 'mislukt', error: String(e && e.message || e)
    });
    throw e;
  }
}

/* Publiceren. Alleen bereikbaar via het endpoint, alleen na akkoord.
   De advertentie wordt eerst PAUSED aangemaakt en daarna pas aangezet, zodat
   een half mislukte aanroep nooit ongemerkt budget uitgeeft. */
async function metaPublish(env, publicationId, gebruiker, direct_aan) {
  const account = String(env.META_AD_ACCOUNT_ID || '').replace(/^act_/, '');
  const rij = (await sbSelect(env, 'meta_publications', `id=eq.${publicationId}&select=*`))[0];
  if (!rij) return { error: 'publicatie bestaat niet', status: 404 };

  if (rij.meta_ad_id) {
    return { al_live: true, publication_id: rij.id, meta_ad_id: rij.meta_ad_id, status: rij.status };
  }
  if (!rij.meta_creative_id) {
    return { error: 'deze publicatie is niet voorbereid; er is geen creative bij Meta', status: 409 };
  }
  if (!rij.approval_id) {
    return { error: 'er hangt geen goedkeuring aan deze publicatie', status: 409 };
  }

  const app = (await sbSelect(env, 'approvals', `id=eq.${rij.approval_id}&select=status,description`))[0];
  if (!app || app.status !== 'approved') {
    return { error: `goedkeuring staat op "${app ? app.status : 'onbekend'}"; publiceren kan alleen na akkoord`, status: 403 };
  }

  await sbUpdate(env, 'meta_publications', `id=eq.${publicationId}`, {
    status: 'publiceren', attempts: (rij.attempts || 0) + 1
  });

  try {
    const ad = await metaPost(env, `act_${account}/ads`, {
      name: rij.ad_name,
      adset_id: rij.adset_id,
      creative: { creative_id: rij.meta_creative_id },
      status: 'PAUSED'
    });

    if (direct_aan) {
      await metaPost(env, ad.id, { status: 'ACTIVE' });
    }

    const uit = (await sbUpdate(env, 'meta_publications', `id=eq.${publicationId}`, {
      meta_ad_id: ad.id,
      status: direct_aan ? 'live' : 'gepauzeerd',
      published_by: gebruiker,
      published_at: new Date().toISOString(),
      error: null
    }))[0];

    /* De creative in de console weet nu dat hij draait. Vanaf hier kan Atlas
       het cijfer terugleiden naar deze hypothese. */
    if (rij.creative_id) {
      try {
        await fetch(`${SB_URL}/rest/v1/creatives?id=eq.${rij.creative_id}`, {
          method: 'PATCH',
          headers: sbHeaders(env, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ status: 'Live', date_live: vandaag() })
        });
      } catch (e) { /* de publicatie is gelukt; dit is bijwerk-comfort */ }
    }

    await sbInsert(env, 'systeem_events', {
      level: 'info',
      message: `Advertentie ${direct_aan ? 'live' : 'aangemaakt (gepauzeerd)'}: ${rij.ad_name}`,
      data: { publication_id: rij.id, meta_ad_id: ad.id, door: gebruiker }
    });

    return { ok: true, publication: uit, meta_ad_id: ad.id };
  } catch (e) {
    const fout = String(e && e.message || e);
    await sbUpdate(env, 'meta_publications', `id=eq.${publicationId}`, { status: 'mislukt', error: fout });
    return { error: fout, status: 502 };
  }
}


/* ============================================================
 * 4c. Itereren: de advertentie waarop je voortbouwt
 *
 * Itereren begon met een formulier van dertig velden die je met de hand
 * overtikte uit Ads Manager, of uit een screenshot liet uitlezen. Dat is niet
 * alleen werk, het is ook de plek waar cijfers stilletjes verkeerd worden: een
 * komma waar een punt hoort, een percentage dat als getal binnenkomt, een
 * venster van 30 dagen in het ene veld en 7 in het andere.
 *
 * Hier komen ze uit de bron. Twee bronnen, een vorm:
 *
 *   ATRIA levert in een aanroep de advertenties van je eigen account,
 *   gerangschikt op een KPI, met thumbnail, en bij de drill-down ook de copy
 *   en de CTA. Dat is precies de vraag die de itereerwizard stelt.
 *
 *   META GRAPH is de bron waar Atria zelf ook uit put. Hij kost meer aanroepen
 *   -- cijfers, dan de advertentie, dan de creative -- maar hij werkt zonder
 *   Atria-abonnement en het token staat er al.
 *
 * DRIE REGELS DIE HIER OVERAL GELDEN:
 *
 *   1. ONBEKEND IS NULL, NOOIT NUL. Een maat die de bron niet gaf mag niet als
 *      gemeten nul in beeld komen. Dan lijkt "we weten het niet" op "het is nul
 *      keer gebeurd", en daar wordt een verkeerde iteratie op gebouwd.
 *
 *   2. DE NORM KOMT UIT HET ACCOUNT ZELF. Er staat in dit bestand geen enkele
 *      grens voor wat een goede CTR of een goede ROAS is. Elke stap wordt
 *      vergeleken met hetzelfde account over hetzelfde venster. Een vaste grens
 *      veroudert stil; het account veroudert mee.
 *
 *   3. TE WEINIG DATA IS EEN UITSLAG. Een conversiepercentage op zeven klikken
 *      is ruis, en ruis die eruitziet als een oordeel is erger dan geen
 *      oordeel.
 * ============================================================ */

function adGetal(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/* Delen dat weigert te doen alsof. Geen teller, geen noemer of een noemer van
   nul: dan is de uitkomst niet nul maar onbekend. */
function adDeel(teller, noemer) {
  const t = adGetal(teller), n = adGetal(noemer);
  if (t === null || n === null || n === 0) return null;
  return t / n;
}

/* Wat je kunt uitrekenen als de bron het niet gaf. Uitsluitend uit maten die
   er wel staan -- een afgeleide van een gok is een gok. */
function adAfgeleid(c) {
  const u = Object.assign({}, c);
  if (u.roas == null) u.roas = adDeel(u.omzet, u.spend);
  if (u.aov == null) u.aov = adDeel(u.omzet, u.aankopen);
  if (u.cpa == null) u.cpa = adDeel(u.spend, u.aankopen);
  if (u.cpc == null) u.cpc = adDeel(u.spend, u.klikken);
  if (u.cpm == null) { const s = adGetal(u.spend); u.cpm = s === null ? null : adDeel(s * 1000, u.impressions); }
  if (u.ctr == null) { const v = adDeel(u.klikken, u.impressions); u.ctr = v === null ? null : v * 100; }
  if (u.frequency == null) u.frequency = adDeel(u.impressions, u.reach);
  return u;
}

/* ---- Atria ------------------------------------------------------------- */

const ATRIA_PERIODES = { 7: 'last_7d', 14: 'last_14d', 30: 'last_30d', 90: 'last_90d' };
function atriaPeriode(dagen) { return ATRIA_PERIODES[Number(dagen)] || 'last_30d'; }

/* Atria noemt zijn maten met een id en geeft in metric_names de naam die de
   gebruiker eraan gaf. Namen zijn te wijzigen en kunnen botsen, dus eerst het
   id; pas als dat niets oplevert de naam. Staat een maat er niet, dan blijft
   hij null -- er wordt niets overgenomen uit iets wat er toevallig op lijkt. */
const ATRIA_MAAT = {
  spend:       { ids: ['spend', 'cost'], naam: /^(spend|amount spent|cost)$/i },
  impressions: { ids: ['impressions'], naam: /^impressions$/i },
  reach:       { ids: ['reach'], naam: /^reach$/i },
  frequency:   { ids: ['frequency'], naam: /^frequency$/i },
  klikken:     { ids: ['link_clicks', 'inline_link_clicks', 'outbound_clicks', 'clicks'], naam: /^(link |outbound )?clicks$/i },
  ctr:         { ids: ['link_ctr', 'ctr', 'outbound_ctr'], naam: /^(link |outbound )?ctr$/i },
  cpm:         { ids: ['cpm'], naam: /^cpm$/i },
  cpc:         { ids: ['cost_per_link_click', 'cpc'], naam: /^(cpc|cost per (link )?click)$/i },
  lpv:         { ids: ['landing_page_views', 'landing_page_view', 'lpv'], naam: /^landing page views?$/i },
  atc:         { ids: ['add_to_cart', 'adds_to_cart', 'omni_add_to_cart'], naam: /^adds? to cart$/i },
  aankopen:    { ids: ['purchases', 'purchase', 'omni_purchase', 'website_purchase'], naam: /^purchases?$/i },
  omzet:       { ids: ['purchase_value', 'purchase_conversion_value', 'omni_purchase_value', 'revenue'], naam: /^(purchase (value|conversion value)|revenue)$/i },
  roas:        { ids: ['roas', 'purchase_roas', 'website_purchase_roas'], naam: /^(website )?(purchase )?roas$/i },
  aov:         { ids: ['aov', 'average_order_value'], naam: /^(aov|average order value)$/i },
  cpa:         { ids: ['cpa', 'cost_per_purchase'], naam: /^(cpa|cost per purchase)$/i }
};

function atriaMaten(metrics, namen) {
  const m = metrics || {}, n = namen || {}, uit = {};
  Object.keys(ATRIA_MAAT).forEach(function (veld) {
    const spec = ATRIA_MAAT[veld];
    let w = null;
    for (const id of spec.ids) {
      if (m[id] !== undefined && m[id] !== null) { w = m[id]; break; }
    }
    if (w === null) {
      const sleutel = Object.keys(n).find(function (id) {
        return m[id] !== undefined && m[id] !== null && spec.naam.test(String(n[id] || ''));
      });
      if (sleutel !== undefined) w = m[sleutel];
    }
    uit[veld] = adGetal(w);
  });
  return uit;
}

async function atriaHaal(env, pad, params) {
  const sleutel = await sleutelVan(env, 'ATRIA_API_KEY');
  if (!sleutel) throw new Error('er staat geen ATRIA_API_KEY. Zet hem in het adminmenu of als Worker secret.');
  const q = params ? ('?' + new URLSearchParams(params)) : '';
  const r = await fetch(ATRIA_API + pad + q, { headers: { 'X-API-Key': sleutel } });
  const tekst = await r.text();
  /* Atria heeft twee foutvormen: de gateway antwoordt plat bij 401, 429 en 5xx,
     en de dienst zelf pakt alles in een envelop met een code die niet nul is.
     Alleen naar de HTTP-status kijken laat de tweede soort erdoorheen als
     succes, en dan krijgt het scherm een lege lijst zonder uitleg. */
  if (!r.ok) throw new Error('Atria: ' + kortDeFout(tekst, r.status, sleutel));
  let data;
  try { data = JSON.parse(tekst); } catch (e) { throw new Error('Atria gaf geen JSON terug'); }
  if (data && data.code !== undefined && data.code !== 0) {
    throw new Error('Atria: ' + String(data.message || ('code ' + data.code)).slice(0, 140));
  }
  return (data && data.data !== undefined) ? data.data : data;
}

async function atriaAccounts(env) {
  const d = await atriaHaal(env, '/open/v1/ad-accounts');
  return (d.items || []).map(function (a) {
    return {
      id: a.id, account_id: a.ad_account_id || null, naam: a.name || a.id,
      platform: a.platform || null, valuta: a.currency || null, staat: a.status || null
    };
  });
}

/* Het beeld en de video uit een rij, waar ze ook staan. Dezelfde aanpak als
   bij TrendTrack, en om dezelfde reden: drie vaste veldnamen leverden bij Atria
   een lege kaart op ("geen beeld bij deze advertentie") terwijl het adres
   gewoon in het antwoord stond -- onder een naam of op een plek die wij niet
   probeerden. Eerst de paden die we kennen, dan de naam waar hij ook staat, en
   als laatste elk adres op een host waar wij beelden vandaan halen. */
function adIsAdres(u) { return typeof u === 'string' && /^https?:\/\//i.test(u); }

/* Hier NIET op host filteren, anders dan bij het onderzoek. Een advertentie
   uit ons eigen account mag op een host staan die wij nog niet kennen -- en
   die dan stilzwijgend weglaten levert "de bron gaf geen beeldadres" op
   terwijl er een adres stond. Dan zoek je aan de verkeerde kant. Het adres
   gaat mee; weigert de beeldpoort hem, dan zegt het scherm dát, en dan weet je
   welke host erbij moet. Alleen de blinde eindzoektocht blijft aan de
   hostlijst gebonden: die grijpt te grof om zonder rem te mogen. */
function adBeeldUit(rij) {
  return ttVeld(rij,
    ['thumbnail_url', 'thumbnail', 'image_url', 'creative.thumbnail_url',
     'creative.image_url', 'assets.0.url', 'images.0.url'],
    ['thumbnailUrl', 'thumbnail', 'imageUrl', 'image', 'previewUrl', 'snapshotUrl',
     'creativeUrl', 'resizedImageUrl', 'originalImageUrl', 'mediaUrl'],
    function (w) { return adIsAdres(w) && !ttIsVideoAdres(w); }) || ttDiepAdres(rij, ttBeeldMag);
}

function adVideoUit(rij) {
  return ttVeld(rij,
    ['video_url', 'creative.video_url', 'assets.0.video_url'],
    ['videoUrl', 'videoHdUrl', 'videoSdUrl', 'mediaUrl', 'video'],
    function (w) { return adIsAdres(w) && ttIsVideoAdres(w); }) || ttDiepAdres(rij, ttVideoMag);
}

/* Welke velden er dan wél in de rij stonden. Alleen de namen, nooit de inhoud.
   Zonder dit is "geen beeld" niet te onderscheiden van "verkeerd gezocht", en
   dat verschil kost een ronde per gok. */
function adVeldnamen(rij) {
  const uit = [];
  if (!rij || typeof rij !== 'object') return uit;
  Object.keys(rij).forEach(function (k) {
    uit.push(k);
    const w = rij[k];
    if (w && typeof w === 'object' && !Array.isArray(w)) {
      Object.keys(w).forEach(function (k2) { uit.push(k + '.' + k2); });
    }
  });
  return uit;
}

function atriaNaarAdvertentie(rij) {
  return {
    bron: 'atria',
    id: rij.platform_ad_id || rij.ad_id || rij.id || null,
    naam: rij.name || rij.ad_name || '(zonder naam)',
    staat: rij.status || rij.effective_status || null,
    beeld: adBeeldUit(rij),
    video: adVideoUit(rij),
    cijfers: adAfgeleid(atriaMaten(rij.metrics, rij.metric_names))
  };
}

async function atriaAdvertenties(env, account, dagen, sorteer, limiet) {
  const d = await atriaHaal(env, '/open/v1/ad-accounts/' + encodeURIComponent(account) + '/ads', {
    period: atriaPeriode(dagen),
    sort_by: sorteer || 'spend',
    sort_order: 'desc',
    limit: String(Math.max(1, Math.min(Number(limiet) || 25, 50)))
  });
  return (d.items || []).map(atriaNaarAdvertentie);
}

async function atriaAdvertentie(env, account, adId, dagen) {
  const d = await atriaHaal(env,
    '/open/v1/ad-accounts/' + encodeURIComponent(account) + '/ads/' + encodeURIComponent(adId),
    { period: atriaPeriode(dagen) });
  const rij = d.item || d.ad || d;
  const ad = atriaNaarAdvertentie(rij);
  ad.copy = {
    kop: rij.title || rij.headline || null,
    tekst: rij.body || rij.primary_text || rij.text || null,
    cta: rij.cta || rij.call_to_action || null
  };
  /* Komt er niets uit, dan gaan de veldnamen mee terug. Het scherm kan dan
     zeggen wat er wél stond in plaats van "geen beeld", en dan is de volgende
     ronde een aflezing en geen gok. */
  if (!ad.beeld && !ad.video) ad.velden_zonder_beeld = adVeldnamen(rij);
  return ad;
}

async function atriaNorm(env, account, dagen) {
  const d = await atriaHaal(env, '/open/v1/ad-accounts/' + encodeURIComponent(account) + '/summary',
    { period: atriaPeriode(dagen) });
  return adAfgeleid(atriaMaten(d.metrics, d.metric_names));
}

/* ---- Meta Graph -------------------------------------------------------- */

/* Dezelfde velden als de dagelijkse sync, maar zonder time_increment: hier
   wil je een rij per advertentie over het hele venster, niet een rij per dag.
   Optellen over dagen zou hier ook niet mogen -- bereik is ontdubbeld binnen
   de periode die je opvraagt en telt dus niet op. */
const META_ITEREER_VELDEN = ['spend', 'impressions', 'reach', 'frequency', 'clicks',
  'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'actions', 'action_values',
  'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking'];

function metaNaarCijfers(rij) {
  const acties = rij.actions, waarden = rij.action_values;
  const eerste = function (bron, namen) {
    for (const n of namen) { const v = metaActie(bron, n); if (v !== null && v !== undefined) return v; }
    return null;
  };
  return adAfgeleid({
    spend: adGetal(rij.spend),
    impressions: adGetal(rij.impressions),
    reach: adGetal(rij.reach),
    frequency: adGetal(rij.frequency),
    klikken: adGetal(rij.inline_link_clicks) !== null ? adGetal(rij.inline_link_clicks) : adGetal(rij.clicks),
    ctr: adGetal(rij.ctr),
    cpc: adGetal(rij.cpc),
    cpm: adGetal(rij.cpm),
    lpv: eerste(acties, ['landing_page_view', 'omni_landing_page_view']),
    atc: eerste(acties, ['omni_add_to_cart', 'add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart']),
    aankopen: eerste(acties, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']),
    omzet: eerste(waarden, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase']),
    roas: null, aov: null, cpa: null
  });
}

async function metaItereerRijen(env, account, dagen, niveau, adId, verschuif) {
  const p = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    level: niveau,
    fields: META_ITEREER_VELDEN.concat(niveau === 'ad' ? ['ad_id', 'ad_name'] : []).join(','),
    time_range: metaVenster(dagen, verschuif),
    limit: '200'
  });
  if (adId) p.set('filtering', JSON.stringify([{ field: 'ad.id', operator: 'IN', value: [String(adId)] }]));
  const r = await fetch(`${META_API}/act_${kaalAccount(account)}/insights?${p}`);
  const data = await r.json();
  if (data.error) throw new Error('Meta: ' + (data.error.message || JSON.stringify(data.error)));
  return data.data || [];
}

/* De creative erbij. Meta zet de cijfers en het beeld in twee verschillende
   edges, dus dit is onvermijdelijk een tweede aanroep. Mislukt hij, dan gaat de
   advertentie zonder beeld door: geen beeld is vervelend, geen cijfers is fataal
   en die hebben we al. */
async function metaCreative(env, adId) {
  try {
    const p = new URLSearchParams({
      access_token: env.META_ACCESS_TOKEN,
      fields: 'name,effective_status,creative{thumbnail_url,image_url,body,title,call_to_action_type}'
    });
    const r = await fetch(`${META_API}/${encodeURIComponent(adId)}?${p}`);
    const d = await r.json();
    if (d.error) return null;
    const c = d.creative || {};
    return {
      naam: d.name || null,
      staat: d.effective_status || null,
      beeld: adBeeldUit(c),
      video: adVideoUit(c),
      velden: adVeldnamen(c),
      copy: { kop: c.title || null, tekst: c.body || null, cta: c.call_to_action_type || null }
    };
  } catch (e) { return null; }
}

/* De verandering tussen twee vensters, als verhouding. Null zodra een van de
   twee ontbreekt of nul is: "van niets naar iets" is geen percentage, en een
   deling door nul die als oneindig doorgaat wordt op het scherm een pijl
   omhoog waar niets gemeten is. */
function adTrend(nu, toen) {
  const a = adGetal(nu), b = adGetal(toen);
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

async function metaAdvertenties(env, account, dagen, limiet, vergelijk) {
  /* De vorige periode erbij, maar alleen als ernaar gevraagd is: het is een
     tweede aanroep bij Meta en die hoef je niet te doen om een lijst te tonen. */
  const [rijen, vorige] = await Promise.all([
    metaItereerRijen(env, account, dagen, 'ad', null),
    vergelijk ? metaItereerRijen(env, account, dagen, 'ad', null, dagen).catch(function () { return null; })
              : Promise.resolve(null)
  ]);
  const toen = {};
  if (vorige) vorige.forEach(function (r) { if (r.ad_id) toen[r.ad_id] = metaNaarCijfers(r); });
  const uit = rijen.map(function (rij) {
    /* beeld en video staan er leeg bij: de lijst haalt geen creatives op, dat
       is een tweede aanroep per advertentie. Ze horen wél in de vorm, want een
       advertentie uit Atria en een uit Meta moeten dezelfde velden hebben --
       anders leest het scherm bij de ene bron iets uit dat bij de andere niet
       bestaat. */
    const ad = { bron: 'meta', id: rij.ad_id || null, naam: rij.ad_name || '(zonder naam)',
                 staat: null, beeld: null, video: null, cijfers: metaNaarCijfers(rij) };
    if (vergelijk) {
      /* Geen vorige periode is niet hetzelfde als een vlakke lijn. Een
         advertentie die vorige week nog niet bestond hoort niet als "stabiel"
         in de lijst te staan, en al helemaal niet als "dalend". */
      const v = ad.id ? toen[ad.id] : null;
      ad.vorige = v || null;
      ad.trend = v ? { roas: adTrend(ad.cijfers.roas, v.roas),
                       spend: adTrend(ad.cijfers.spend, v.spend) } : null;
    }
    return ad;
  });
  /* Op spend, want dat is waar de vraag over gaat: waar is geld aan uitgegeven
     en wat leverde het op. Een advertentie zonder spend heeft geen iteratie
     nodig maar een lancering. */
  uit.sort(function (a, b) { return (b.cijfers.spend || 0) - (a.cijfers.spend || 0); });
  return uit.slice(0, Math.max(1, Math.min(Number(limiet) || 25, 50)));
}

async function metaAdvertentie(env, account, adId, dagen) {
  const rijen = await metaItereerRijen(env, account, dagen, 'ad', adId);
  const rij = rijen[0];
  if (!rij) throw new Error('Meta gaf geen cijfers voor advertentie ' + adId + ' in dit venster');
  const ad = { bron: 'meta', id: rij.ad_id || String(adId), naam: rij.ad_name || '(zonder naam)',
               staat: null, beeld: null, video: null, copy: null, cijfers: metaNaarCijfers(rij) };
  const cr = await metaCreative(env, ad.id);
  if (cr) {
    if (cr.naam) ad.naam = cr.naam;
    ad.staat = cr.staat;
    ad.beeld = cr.beeld;
    ad.video = cr.video || null;
    ad.copy = cr.copy;
    if (!ad.beeld && !ad.video) ad.velden_zonder_beeld = cr.velden || [];
  }
  return ad;
}

async function metaNorm(env, account, dagen) {
  const rijen = await metaItereerRijen(env, account, dagen, 'account', null);
  if (!rijen.length) return null;
  return metaNaarCijfers(rijen[0]);
}

/* ---- De trap, en waar hij lekt ---------------------------------------- */

/* Vier stappen tussen geld en een bestelling, plus twee prijzen. Elke stap
   heeft een noemer, en die noemer bepaalt of de stap iets te zeggen heeft.
   `hoger_is_beter` staat er expliciet bij omdat CPM de enige is waar het
   andersom werkt en dat is precies het soort ding dat je een keer omdraait. */
const AD_TRAP = [
  { sleutel: 'aandacht', label: 'Vertoning naar klik',
    teller: 'klikken', noemer: 'impressions', drempel: 1000, hoger_is_beter: true,
    zit: 'in de advertentie', ligt_aan: 'de hook, de kop en het openingsbeeld' },
  { sleutel: 'klikkwaliteit', label: 'Klik naar landingspagina',
    teller: 'lpv', noemer: 'klikken', drempel: 100, hoger_is_beter: true,
    zit: 'tussen advertentie en pagina', ligt_aan: 'laadtijd, of klikken die per ongeluk gebeuren' },
  { sleutel: 'pagina', label: 'Landingspagina naar winkelwagen',
    teller: 'atc', noemer: 'lpv', drempel: 100, hoger_is_beter: true,
    zit: 'op de pagina', ligt_aan: 'de belofte die de advertentie deed en de pagina niet waarmaakt' },
  { sleutel: 'afrekenen', label: 'Winkelwagen naar bestelling',
    teller: 'aankopen', noemer: 'atc', drempel: 25, hoger_is_beter: true,
    zit: 'bij het afrekenen', ligt_aan: 'verzendkosten, betaalmogelijkheden of het aanbod zelf' },
  { sleutel: 'inkoop', label: 'Prijs per duizend vertoningen',
    maat: 'cpm', noemer: 'impressions', drempel: 1000, hoger_is_beter: false,
    zit: 'in de veiling', ligt_aan: 'verzadiging van het publiek of een format dat duur inkoopt' },
  { sleutel: 'orderwaarde', label: 'Gemiddelde orderwaarde',
    maat: 'aov', noemer: 'aankopen', drempel: 25, hoger_is_beter: true,
    zit: 'in het aanbod', ligt_aan: 'de bundel, de upsell of welk product de advertentie voorop zet' }
];

/* Wat er te testen valt als deze stap het knelpunt is. De eerste twee zijn een
   creative-opdracht; de rest is dat nadrukkelijk NIET, en dat is de reden dat
   dit veld bestaat. Een nieuwe hook maken terwijl het lek op de productpagina
   zit levert drie nieuwe advertenties op die precies even hard lekken. */
const AD_WAT_TESTEN = {
  aandacht: { creative: true, varieer: ['hook', 'headline', 'opening'],
    zeg: 'De advertentie wordt gezien maar niet aangeklikt. Test de hook, de kop en het openingsbeeld; laat het mechanisme en het aanbod staan.' },
  klikkwaliteit: { creative: true, varieer: ['headline', 'cta'],
    zeg: 'Er wordt geklikt maar de pagina wordt niet gehaald. Vaak laadtijd of een klik die per ongeluk gebeurt. Kijk eerst naar de snelheid van de pagina voordat je de creative verandert.' },
  pagina: { creative: false, varieer: [],
    zeg: 'Het lek zit na de klik: mensen komen op de pagina en leggen niets in de wagen. Een nieuwe creative lost dit niet op. Bouw eerst een landingspagina die de belofte van deze advertentie waarmaakt.' },
  afrekenen: { creative: false, varieer: [],
    zeg: 'Er wordt in de wagen gelegd maar niet afgerekend. Dat is een aanbod- of afrekenprobleem, geen creative-probleem. Kijk naar verzendkosten, betaalmethodes en het moment waarop de prijs zichtbaar wordt.' },
  inkoop: { creative: true, varieer: ['opening', 'sfeer', 'format'],
    zeg: 'De vertoningen zijn duur ingekocht. Meestal verzadiging: hetzelfde publiek ziet hetzelfde beeld te vaak. Test een ander format en een andere visuele wereld, niet een andere boodschap.' },
  orderwaarde: { creative: false, varieer: [],
    zeg: 'De orders zijn kleiner dan gemiddeld. Dat zit in het aanbod, niet in de advertentie: welk product staat vooraan, en is er een bundel.' }
};

function adStapWaarde(cijfers, stap) {
  if (stap.maat) return adGetal(cijfers[stap.maat]);
  return adDeel(cijfers[stap.teller], cijfers[stap.noemer]);
}

/* De diagnose. Optellen en delen, geen model: er is hier een juist antwoord en
   een model kan er alleen iets aan verzinnen.

   Wat dit expliciet NIET doet: een oordeel geven zonder norm. Kent het account
   deze stap niet, dan krijgt de stap geen verhouding en telt hij niet mee in de
   keuze van het knelpunt. Een advertentie afrekenen op een norm die je niet
   hebt is precies hoe je een gezonde advertentie weggooit. */
function adDiagnose(cijfers, norm) {
  const c = cijfers || {}, n = norm || {};
  const stappen = AD_TRAP.map(function (stap) {
    const waarde = adStapWaarde(c, stap);
    const normwaarde = adStapWaarde(n, stap);
    const noemer = adGetal(c[stap.noemer]);
    const genoeg = noemer !== null && noemer >= stap.drempel;
    let verhouding = null;
    if (waarde !== null && normwaarde !== null && normwaarde !== 0) {
      verhouding = stap.hoger_is_beter ? (waarde / normwaarde) : (normwaarde / waarde);
      if (!Number.isFinite(verhouding)) verhouding = null;
    }
    return {
      sleutel: stap.sleutel, label: stap.label, zit: stap.zit, ligt_aan: stap.ligt_aan,
      waarde: waarde, norm: normwaarde, verhouding: verhouding,
      noemer: noemer, drempel: stap.drempel, genoeg_data: genoeg,
      /* Zonder norm of zonder genoeg data: geen oordeel. Niet 'gemiddeld' --
         dat is een oordeel, en we hebben er geen. */
      oordeel: (verhouding === null || !genoeg) ? null
        : (verhouding < 0.8 ? 'zwak' : (verhouding > 1.2 ? 'sterk' : 'gemiddeld'))
    };
  });

  const meetbaar = stappen.filter(function (s) { return s.verhouding !== null && s.genoeg_data; });
  meetbaar.sort(function (a, b) { return a.verhouding - b.verhouding; });
  const zwakste = meetbaar[0] || null;
  /* Alleen een knelpunt als de stap ook echt onder de norm zit. Is de zwakste
     stap nog steeds beter dan het account, dan is er geen lek en is de eerlijke
     uitslag: deze advertentie werkt, schaal hem op. */
  const knelpunt = (zwakste && zwakste.verhouding < 1) ? zwakste.sleutel : null;
  return {
    stappen: stappen,
    knelpunt: knelpunt,
    meetbaar: meetbaar.length,
    wat_testen: knelpunt ? AD_WAT_TESTEN[knelpunt] : null,
    /* Waarom er geen knelpunt is, want dat zijn twee heel verschillende
       situaties en ze zien er op een scherm hetzelfde uit. */
    reden: knelpunt ? null : (meetbaar.length === 0
      ? 'te weinig data of geen norm om tegen te meten'
      : 'geen enkele stap zit onder het accountgemiddelde')
  };
}

/* ---- Een bron kiezen --------------------------------------------------- */

async function itereerBronnen(env) {
  const uit = [];
  const atriaSleutel = await sleutelVan(env, 'ATRIA_API_KEY');
  let atria = { bron: 'atria', naam: 'Atria', bruikbaar: false, reden: 'er staat geen ATRIA_API_KEY', accounts: [] };
  if (atriaSleutel) {
    try { atria = { bron: 'atria', naam: 'Atria', bruikbaar: true, reden: null, accounts: await atriaAccounts(env) }; }
    catch (e) { atria.reden = String((e && e.message) || e).slice(0, 160); }
  }
  uit.push(atria);

  let meta = { bron: 'meta', naam: 'Meta Ads', bruikbaar: false, reden: 'er staat geen META_ACCESS_TOKEN', accounts: [] };
  if (env.META_ACCESS_TOKEN) {
    const accounts = await actieveAccounts(env);
    meta = {
      bron: 'meta', naam: 'Meta Ads',
      bruikbaar: accounts.length > 0,
      reden: accounts.length ? null : 'er staan geen actieve advertentieaccounts',
      accounts: accounts.map(function (a) {
        return { id: a.account_id, account_id: a.account_id, naam: a.naam || a.account_id,
                 platform: 'facebook', valuta: a.valuta || null, staat: null };
      })
    };
  }
  uit.push(meta);
  return uit;
}


/* ============================================================
 * 4d. Creative research: wat er in de markt draait
 *
 * De vraag is niet "wat vinden wij mooi" maar "wat draait er al maanden bij
 * iemand anders". Een advertentie die na negentig dagen nog loopt is niet
 * blijven staan uit sentiment: er zit een budget achter dat elke dag opnieuw
 * verlengd wordt. Dat is het sterkste openbare signaal dat er bestaat.
 *
 * TWEE RANGSCHIKKINGEN DIE VERSCHILLENDE VRAGEN BEANTWOORDEN, en ze door
 * elkaar halen is de fout die dit hele scherm nutteloos maakt:
 *
 *   LOOPTIJD zegt: dit werkt al lang. Het is de betrouwbaarste maat en de
 *   traagste -- wat hier bovenaan staat is inmiddels ook door iedereen gezien.
 *
 *   BEREIKGROEI zegt: hier wordt nu geld op bijgezet. Dat is het vroegste
 *   signaal en het onbetrouwbaarste: een advertentie kan drie dagen opschalen
 *   en daarna stilvallen.
 *
 * WAT DIT UITDRUKKELIJK NIET IS: bewijs. Lang draaien is een signaal. Er is
 * geen enkele advertentie in deze lijst waarvan wij de ROAS kennen, en het
 * enige wat we van de adverteerder weten is dat hij hem niet heeft uitgezet.
 * Dat staat in het antwoord, want een lijst met cijfers erbij ziet eruit als
 * bewijs ook als er nergens staat dat het dat is.
 *
 * EN WAT ER OVERGENOMEN WORDT: de structuur en de hoek, nooit het beeld, de
 * copy of de claim. Dat is niet alleen de nette lezing -- het is ook de enige
 * bruikbare: de foto van een ander merk in jouw advertentie werkt niet, en hun
 * claim is hun claim om waar te maken. De bronlaag levert daarom het materiaal
 * en de cijfers, en laat het overnemen aan de stap die er een eigen creative
 * van maakt.
 * ============================================================ */

const TT_VENSTERS = { 1: 'last24h', 7: 'last7d', 14: 'last30d', 30: 'last30d' };
/* TrendTrack kent geen venster van veertien dagen voor bereik; last30d is het
   eerstvolgende dat bestaat. Dat verschil verzwijgen zou de lijst laten
   doorgaan voor iets wat hij niet is, dus het venster dat werkelijk gebruikt
   is gaat mee terug in het antwoord. */
function ttVenster(dagen) { return TT_VENSTERS[Number(dagen)] || 'last30d'; }

const TT_SORTERING = {
  looptijd: { sortBy: 'longestRunning', zegt: 'draait het langst' },
  bereik: { sortBy: 'reach', zegt: 'heeft het grootste bereik' },
  groei: { sortBy: 'reachDelta7d', zegt: 'schaalt op dit moment op' }
};

async function ttHaal(env, pad, params, body) {
  const sleutel = await sleutelVan(env, 'TRENDTRACK_API_KEY');
  if (!sleutel) throw new Error('er staat geen TRENDTRACK_API_KEY. Zet hem in het adminmenu of als Worker secret.');
  const q = params ? ('?' + new URLSearchParams(params)) : '';
  const opties = { headers: { 'Authorization': 'Bearer ' + sleutel } };
  if (body) {
    opties.method = 'POST';
    opties.headers['Content-Type'] = 'application/json';
    opties.body = JSON.stringify(body);
  }
  const r = await fetch(TRENDTRACK_API + pad + q, opties);
  const tekst = await r.text();
  if (!r.ok) throw new Error('TrendTrack: ' + kortDeFout(tekst, r.status, sleutel));
  try { return JSON.parse(tekst); } catch (e) { throw new Error('TrendTrack gaf geen JSON terug'); }
}

/* Het eerste veld dat er werkelijk staat. TrendTrack levert per advertentie
   niet altijd dezelfde sleutels -- een oudere rij heeft `thumbnail`, een
   nieuwere `media.thumbnailUrl` -- en een vaste keuze levert dan stil een leeg
   veld op in plaats van een fout. */
function ttEerste(obj, paden) {
  for (const pad of paden) {
    let w = obj;
    for (const stuk of pad.split('.')) { w = (w && typeof w === 'object') ? w[stuk] : undefined; }
    if (w !== undefined && w !== null && w !== '') return w;
  }
  return null;
}

/* De vorm die TrendTrack werkelijk teruggeeft, geverifieerd op een echt
   antwoord en niet op de documentatie. Bijna alles zit genest onder media,
   content, metrics en audience -- ik had het plat verwacht, en daardoor bleven
   de kop, de tekst, de CTA, het domein en het land leeg terwijl het antwoord ze
   gewoon bevatte. Een leeg veld dat er leeg uitziet is precies de fout die je
   niet ziet gebeuren.

   De oudere, platte namen staan er nog achter: ze kosten niets en een dienst
   die zijn vorm wijzigt is geen theoretisch geval. */
/* De vorm van het antwoord is niet overal dezelfde. Op de gewone zoekopdracht
   zit alles genest onder media, content en metrics; op de route van een
   gevolgd merk zag ik dezelfde velden op een andere plek terug. Ik heb daar
   een ronde lang naar geraden, en raden kost een ronde per poging.

   Dit zoekt op NAAM in plaats van op plek: breedte eerst, zodat een veld dat
   ondiep staat wint van eentje diep in een bijlage. De naam wordt eerst
   gelijkgetrokken (kleine letters, geen streepjes), zodat `days_running`,
   `daysRunning` en `DaysRunning` hetzelfde zijn -- maar `reachDelta7d` is
   daarmee nog steeds niet `reach`, en dat is precies de bedoeling: een
   groeicijfer dat als bereik binnenkomt is erger dan een leeg veld.

   Het loopt niet oneindig door: zes lagen diep en vierhonderd knopen. Een
   antwoord dat daar niet in past is geen antwoord dat wij aankunnen. */
function ttNormNaam(naam) {
  return String(naam).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function ttDiepVeld(wortel, namen, keur) {
  const wil = namen.map(ttNormNaam);
  const rij = [{ w: wortel, d: 0 }];
  let gezien = 0;
  while (rij.length) {
    const knoop = rij.shift();
    if (!knoop.w || typeof knoop.w !== 'object') continue;
    if (knoop.d > 6 || ++gezien > 400) continue;
    for (const sleutel of Object.keys(knoop.w)) {
      const w = knoop.w[sleutel];
      if (w === undefined || w === null || w === '') continue;
      if (typeof w === 'object') { rij.push({ w: w, d: knoop.d + 1 }); continue; }
      if (wil.indexOf(ttNormNaam(sleutel)) === -1) continue;
      if (keur && !keur(w)) continue;
      return w;
    }
  }
  return null;
}

/* Eerst de plekken die we kennen, dan de naam waar hij ook staat. In die
   volgorde, want een bekend pad is een zekerheid en een naamzoektocht is een
   gok die meestal klopt. Keurt de keurmeester de gevonden waarde af, dan gaat
   het zoeken door -- een beeld op een host die wij niet ophalen is voor het
   scherm hetzelfde als geen beeld, en dan is doorzoeken beter dan opgeven. */
function ttVeld(r, paden, namen, keur) {
  const w = ttEerste(r, paden);
  if (w !== null && (!keur || keur(w))) return w;
  return ttDiepVeld(r, namen, keur);
}

/* Het laatste redmiddel voor het beeld: elke string in het antwoord die een
   adres is op een host waar wij beelden vandaan halen. Dat is een grove greep,
   en hij mag alleen grof zijn omdat de hostlijst hem tegenhoudt -- hij kan
   niets opleveren dat de beeldproxy daarna zou weigeren. Zonder dit staat er
   een lege kaart terwijl het beeld gewoon in het antwoord zit, onder een naam
   die ik niet kende. */
function ttDiepAdres(wortel, keur) {
  const rij = [{ w: wortel, d: 0 }];
  let gezien = 0;
  while (rij.length) {
    const knoop = rij.shift();
    if (!knoop.w || typeof knoop.w !== 'object') continue;
    if (knoop.d > 6 || ++gezien > 400) continue;
    for (const sleutel of Object.keys(knoop.w)) {
      const w = knoop.w[sleutel];
      if (w === undefined || w === null || w === '') continue;
      if (typeof w === 'object') { rij.push({ w: w, d: knoop.d + 1 }); continue; }
      /* Een logo of profielfoto is wel een adres op de goede host, maar het
         is de advertentie niet. Dat als creatie tonen is een leugen met een
         plaatje erbij. */
      if (/logo|avatar|profile|icon|favicon/.test(ttNormNaam(sleutel))) continue;
      if (typeof w === 'string' && (keur || beeldHostMag)(w)) return w;
    }
  }
  return null;
}

/* Een advertentie met bewegend beeld heeft twee adressen: het bestand zelf en
   een stilstaand voorbeeld. TrendTrack zet ze allebei onder `media`, en de
   uitlezer pakte het eerste dat hij zag -- bij een video was dat de mp4. Die
   in een <img> zetten levert een zwart vlak op: geen fout, geen melding, alleen
   een kaart die leeg lijkt terwijl er een advertentie achter zit.

   Vandaar deze scheiding. Een adres is een video of het is een beeld, nooit
   allebei, en de uitlezer zoekt ze apart. */
function ttIsVideoAdres(u) {
  return typeof u === 'string' && /\.(mp4|m4v|mov|webm|m3u8)(\?|#|$)/i.test(u);
}

function ttBeeldMag(u) { return beeldHostMag(u) && !ttIsVideoAdres(u); }
function ttVideoMag(u) { return beeldHostMag(u) && ttIsVideoAdres(u); }

function ttNaarAdvertentie(rij) {
  const r = rij || {};
  return {
    id: String(ttVeld(r, ['collationId', 'id', 'collation_id', 'adId', 'ad_id'],
                       ['collationId', 'adId', 'adArchiveId', 'id']) || ''),
    merk: ttVeld(r, ['advertiser.name', 'brand', 'pageName', 'page_name', 'advertiserName'],
                    ['advertiserName', 'pageName', 'brandName', 'brand', 'advertiser']),
    domein: ttVeld(r, ['content.landingPageDomain', 'domain', 'website.domain', 'shop.domain'],
                      ['landingPageDomain', 'domain', 'website']),
    beeld: ttVeld(r, ['media.mediaUrl', 'media.thumbnailUrl', 'mediaUrl', 'media_url',
                      'media.url', 'thumbnailUrl', 'thumbnail_url', 'thumbnail'],
                     ['mediaUrl', 'thumbnailUrl', 'thumbnail', 'imageUrl', 'image',
                      'snapshotUrl', 'previewUrl', 'creativeUrl', 'videoPreviewImageUrl',
                      'originalImageUrl', 'resizedImageUrl'],
                     ttBeeldMag) || ttDiepAdres(r, ttBeeldMag),
    /* Het bestand zelf, als het er is. Zonder dit is een videoadvertentie een
       zwart vlak met een kop eronder, en dat is precies de advertentie die je
       wilt zien: hij draait al negentig dagen bij een concurrent. */
    video: ttVeld(r, ['media.videoUrl', 'media.mediaUrl', 'videoUrl', 'video_url'],
                     ['videoUrl', 'videoHdUrl', 'videoSdUrl', 'mediaUrl', 'video'],
                     ttVideoMag) || ttDiepAdres(r, ttVideoMag),
    soort: ttVeld(r, ['media.type', 'mediaType', 'media_type'], ['mediaType', 'creativeType']),
    copy: {
      kop: ttVeld(r, ['content.title', 'title', 'headline', 'creative.title'],
                     ['title', 'headline', 'linkTitle']),
      tekst: ttVeld(r, ['content.body', 'body', 'description', 'adCopy', 'ad_copy', 'creative.body'],
                       ['body', 'adCopy', 'primaryText', 'description', 'caption']),
      cta: ttVeld(r, ['content.callToAction', 'cta', 'ctaType', 'callToAction', 'creative.cta'],
                     ['callToAction', 'ctaType', 'ctaText', 'cta'])
    },
    /* Onbekend blijft null. Bereik komt uit de transparantierapportage van Meta
       en die bestaat alleen voor de EU en het VK -- buiten dat gebied is er
       niets, en een nul zou daar een meting suggereren die er niet is. */
    bereik: adGetal(ttVeld(r, ['metrics.reach', 'reach', 'impressions'],
                              ['reach', 'totalReach', 'impressions'])),
    dagen_actief: adGetal(ttVeld(r, ['daysRunning', 'days_running', 'activeDays'],
                                    ['daysRunning', 'activeDays', 'daysActive', 'runningDays'])),
    /* firstSeenAt en createdAt zijn twee verschillende dingen: wanneer de
       advertentie voor het eerst gezien is, en wanneer TrendTrack hem opnam.
       Die door elkaar halen maakt van een advertentie uit 2022 er een van
       vorige maand. */
    eerst_gezien: ttVeld(r, ['firstSeenAt', 'firstSeen', 'first_seen'],
                            ['firstSeenAt', 'firstSeen', 'startDate']),
    laatst_gezien: ttVeld(r, ['lastSeenAt', 'lastSeen', 'last_seen'],
                             ['lastSeenAt', 'lastSeen', 'endDate']),
    varianten: adGetal(ttVeld(r, ['metrics.duplicates', 'duplicates', 'duplicateCount', 'variations'],
                                 ['duplicates', 'duplicateCount', 'variations'])),
    /* Een schatting, en hij heet ook zo. TrendTrack rekent hem uit met een
       aangenomen CPM -- het is geen bedrag dat iemand betaald heeft. */
    uitgave_schatting: adGetal(ttVeld(r, ['metrics.estimatedSpend', 'estimatedSpend'],
                                         ['estimatedSpend', 'spendEstimate'])),
    groei_7d: adGetal(ttVeld(r, ['metrics.reachDelta7d', 'reachDelta7d'], ['reachDelta7d'])),
    /* De positie van de advertentie binnen de pagina van dat merk. Bij een
       gevolgd merk is dit het enige prestatiesignaal dat TrendTrack geeft --
       bereik en uitgave komen daar leeg terug. Lager is beter: rang 1 is de
       advertentie waar dat merk het meest op inzet. */
    rang: adGetal(ttVeld(r, ['rank.currentRank', 'currentRank'], ['currentRank', 'rank'])),
    rang_delta: adGetal(ttVeld(r, ['rank.rankDelta', 'rankDelta'], ['rankDelta'])),
    land: ttVeld(r, ['audience.mainCountry', 'mainCountry', 'main_country', 'audience.targetedCountries.0'],
                    ['mainCountry', 'country']),
    taal: ttEerste(r, ['language', 'ad_language']),
    actief: ttEerste(r, ['status', 'isActive', 'active'])
  };
}

/* ---- De Brand Tracker ---------------------------------------------------
 *
 * "Wat draait er in de markt" en "wat draait er bij onze concurrenten" zijn
 * twee verschillende vragen, en de tweede is de vraag die je stelt. De hele
 * markt levert een Duitse kinderopvang op; de Brand Tracker levert Manscaped,
 * BALZY en Brothers in Style.
 *
 * Let op: `spender=brandtracker` op de gewone zoekopdracht doet dit NIET. Dat
 * verbreedde de lijst juist -- van vierhonderdduizend naar bijna acht miljoen.
 * De enige route die werkelijk op de gevolgde merken filtert loopt per merk.
 * ------------------------------------------------------------------------ */

/* Een afknijper is geen fout maar een verzoek om te wachten. Eén keer wachten
   en opnieuw proberen; blijft het misgaan, dan is het wel een fout en gaat hij
   naar boven. Zonder dit valt een merk uit om een reden die vanzelf overgaat. */
async function ttMetGeduld(env, pad, params) {
  try {
    return await ttHaal(env, pad, params);
  } catch (e) {
    const bericht = String((e && e.message) || e);
    if (!/concurrent|rate limit|too many|429/i.test(bericht)) throw e;
    await new Promise(function (r) { setTimeout(r, 900); });
    return await ttHaal(env, pad, params);
  }
}

async function ttMerken(env) {
  const d = await ttHaal(env, '/v1/brandtrackers');
  const rijen = d.data || d.items || d.results || [];
  return rijen.map(function (m) {
    return {
      id: ttEerste(m, ['id', 'brandtrackerId', 'brandtracker_id']),
      naam: ttEerste(m, ['name', 'brand', 'naam']),
      domein: ttEerste(m, ['domain', 'website']),
      actieve_ads: adGetal(ttEerste(m, ['counts.activeAds', 'activeAds', 'active_ads'])),
      nieuw_7d: adGetal(ttEerste(m, ['counts.newAdsLast7Days', 'newAdsLast7Days'])),
      adverteert: ttEerste(m, ['status.advertising', 'advertising'])
    };
  }).filter(function (m) { return m.id; });
}

/* Welke sortering de top-ads-endpoint zelf kent. longestRunning zit er NIET
   bij -- dat is precies het soort verschil dat je stil verkeerd invult.

   En belangrijker: op deze route komen bereik, uitgave en varianten LEEG terug.
   Dat is geen fout van ons; TrendTrack levert ze per gevolgd merk niet. Wat er
   wel is, is de positie van de advertentie binnen de pagina van dat merk, en
   hoeveel die positie verschoven is. Daarop sorteren is het enige eerlijke
   alternatief -- op een leeg veld sorteren levert een willekeurige volgorde die
   eruitziet als een ranglijst. */
const TT_MERK_SORTERING = { looptijd: 'currentRank', bereik: 'currentRank', groei: 'rankDelta7d' };

/* Waarop wij daarna rangschikken, en in welke richting. Rang is de enige waar
   laag beter is. */
const TT_MERK_SLEUTEL = {
  looptijd: { veld: 'dagen_actief', hoog_is_beter: true },
  bereik:   { veld: 'rang', hoog_is_beter: false },
  groei:    { veld: 'rang_delta', hoog_is_beter: true }
};

async function ttToplijstMerken(env, o) {
  const alle = await ttMerken(env);
  const gekozen = o.merk ? alle.filter(function (m) { return m.id === o.merk; }) : alle;
  if (!gekozen.length) {
    return { merken: alle, advertenties: [], gebruikt: [] };
  }
  /* Per merk een handvol, niet per merk een lijst. Dertien merken maal twintig
     is tweehonderdzestig advertenties en evenzoveel credits, voor een scherm
     waar er tien op passen. */
  const perMerk = Math.max(1, Math.min(Number(o.per_merk) || 6, 20));
  const sortBy = TT_MERK_SORTERING[o.sorteer] || 'reach';
  const uit = [];
  const gelukt = [];
  const mislukt = [];
  /* De veldnamen van rijen waar we geen beeld uit kregen. Namen, geen waarden. */
  const sleutels = [];
  /* Niet dertien tegelijk. TrendTrack weigert gelijktijdige aanroepen met "Too
     many concurrent public API requests are already in flight" -- elf van de
     dertien merken vielen daardoor weg, en het scherm liet twee concurrenten
     zien alsof dat de hele Brand Tracker was. Een voor een is trager en het is
     het enige wat werkt.

     Twee tegelijk zou sneller zijn, maar de grens is niet gedocumenteerd en een
     lijst die half aankomt is erger dan een lijst die tien seconden duurt. */
  const lijst = gekozen.slice(0, 20);
  for (let i = 0; i < lijst.length; i++) {
    const m = lijst[i];
    try {
      const d = await ttMetGeduld(env, '/v1/brandtrackers/' + encodeURIComponent(m.id) + '/top-ads', {
        sortBy: sortBy, order: 'desc', limit: String(perMerk), status: 'active'
      });
      const rijen = d.data || d.items || d.results || [];
      rijen.forEach(function (r) {
        const ad = ttNaarAdvertentie(r);
        /* Levert de uitlezer geen beeld op, dan onthouden we WELKE velden er
           dan wel stonden -- alleen de namen, nooit de inhoud. De vorm die wij
           kennen komt uit een gereedschap dat het antwoord normaliseert, en de
           ruwe route kan andere namen gebruiken. Zonder dit is de volgende
           ronde weer raden; hiermee staat het in het antwoord. */
        if (!ad.beeld && !ad.video) {
          Object.keys(r || {}).forEach(function (k) {
            if (sleutels.indexOf(k) === -1) sleutels.push(k);
          });
          if (r && r.media && typeof r.media === 'object') {
            Object.keys(r.media).forEach(function (k) {
              if (sleutels.indexOf('media.' + k) === -1) sleutels.push('media.' + k);
            });
          }
        }
        /* De naam van de adverteerder wint van die van de Brand Tracker. Ik had
           het andersom, en dat leverde "manscaped.com" op waar de advertentie
           gewoon "MANSCAPED" zei: in de Brand Tracker staat vaak het domein als
           naam, en een domein is geen merknaam. Staat er bij de advertentie
           niets, dan is de tracker de terugval. */
        ad.merk = ad.merk || m.naam;
        ad.merk_id = m.id;
        uit.push(ad);
      });
      gelukt.push(m.naam || m.id);
    } catch (e) {
      /* Eén merk dat weigert is geen reden om de andere twaalf te laten
         vallen. Wel om te zeggen welke ontbreekt: een lijst die stil korter is
         dan hij hoort te zijn leest als "die concurrent doet niets". */
      mislukt.push((m.naam || m.id) + ': ' + String((e && e.message) || e).slice(0, 80));
    }
  }
  return { merken: alle, advertenties: uit, gebruikt: gelukt, mislukt: mislukt,
           per_merk: perMerk, sortBy: sortBy, sleutels_zonder_beeld: sleutels };
}

async function ttToplijst(env, opties) {
  const o = opties || {};
  const sortering = TT_SORTERING[o.sorteer] || TT_SORTERING.looptijd;
  const dagen = Number(o.dagen) || 14;

  /* De Brand Tracker is de standaard, want dat is de vraag die je stelt: wat
     draait er bij ONZE concurrenten. De hele markt blijft bereikbaar, maar je
     kiest hem bewust. */
  if (o.bereik !== 'markt') {
    const m = await ttToplijstMerken(env, o);
    const spec = TT_MERK_SLEUTEL[o.sorteer] || TT_MERK_SLEUTEL.looptijd;
    const sleutel = spec.veld;
    const lijst = m.advertenties.slice();
    /* Rangschikken over alles wat we opgehaald hebben. Wat er niet gemeten is
       zakt naar onderen -- niet naar boven, want een onbekende waarde is geen
       nul en zeker geen hoogste, en bij rang zou nul juist de eerste plek zijn. */
    lijst.sort(function (a, b) {
      const x = a[sleutel], y = b[sleutel];
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return spec.hoog_is_beter ? (y - x) : (x - y);
    });
    return {
      bereik: 'brandtracker',
      sorteer: o.sorteer || 'looptijd',
      sorteert_op: sortering.zegt,
      venster: null,
      dagen_gevraagd: dagen,
      merken: m.merken,
      merken_gebruikt: m.gebruikt,
      merken_mislukt: m.mislukt,
      voorbehoud: 'Lang draaien en veel bereik zijn signalen, geen bewijs. Van geen enkele advertentie hier kennen we de omzet; het enige wat we weten is dat de adverteerder hem niet heeft uitgezet.',
      /* Eerlijk over wat deze rangschikking is. TrendTrack kent bij een gevolgd
         merk geen sortering op looptijd, dus we halen per merk de best lopende
         advertenties op en rangschikken die aan onze kant. Dat is "de langst
         draaiende van de topadvertenties van je concurrenten" en niet "de
         langst draaiende die zij ooit hadden". */
      hoe_gerangschikt: 'Per gevolgd merk zijn de ' + m.per_merk + ' best presterende advertenties opgehaald ' +
        '(' + m.gebruikt.length + ' van de ' + m.merken.length + ' merken), en die zijn hier samen gerangschikt. ' +
        'Het is dus de beste van hun topadvertenties, niet van alles wat zij ooit draaiden.' +
        (o.sorteer === 'bereik'
          ? ' TrendTrack geeft per gevolgd merk geen bereikcijfers; er is daarom gerangschikt op de positie die de advertentie inneemt binnen de advertenties van dat merk.'
          : ''),
      /* Wat er op deze route domweg niet is. Kolommen met streepjes zonder
         uitleg lezen als "niet gemeten bij deze advertentie" terwijl het
         "bestaat niet op deze route" is -- twee heel verschillende dingen. */
      geen_cijfers_voor: ['bereik', 'uitgave_schatting', 'varianten'],
      /* Alleen als er werkelijk beelden ontbreken. Een diagnostisch veld dat er
         altijd staat wordt genegeerd, en dan is het er niet als je het nodig
         hebt. */
      velden_zonder_beeld: m.sleutels_zonder_beeld.length ? m.sleutels_zonder_beeld : undefined,
      advertenties: lijst.slice(0, Math.max(1, Math.min(Number(o.limiet) || 10, 50)))
    };
  }

  /* POST /v1/ads/query met een JSON-body, niet GET /v1/ads met parameters.
     Twee redenen, en de eerste is met schade geleerd: de filters die wij nodig
     hebben zijn lijsten (landen, platforms), en een lijst in een querystring is
     bij elke API weer anders gecodeerd. GET /v1/ads weigerde `countries=NL` met
     niets anders dan "Request validation failed" -- het veld heet mainCountries
     en het is een array. In een JSON-body bestaat die dubbelzinnigheid niet.
     De tweede: /v1/ads/query is bij TrendTrack de endpoint die voor filteren
     bedoeld is. */
  const body = {
    sortBy: sortering.sortBy,
    order: 'desc',
    status: 'active',
    page: 1,
    /* Twintig is de bovengrens die de dienst zelf aanhoudt. Meer vragen levert
       geen fout op maar stilletjes minder, en dat is de vervelendste vorm. */
    limit: Math.max(1, Math.min(Number(o.limiet) || 10, 20)),
    platforms: ['facebook']
  };
  /* Alleen meesturen wat er werkelijk gekozen is. Een leeg filter meesturen is
     hoe je een lijst inperkt zonder dat iemand daarom vroeg -- en bij een
     dienst die streng valideert is het ook gewoon een 400. */
  if (o.zoek) body.search = String(o.zoek).slice(0, 200);
  if (o.land) body.mainCountries = [String(o.land).toUpperCase().slice(0, 2)];
  if (o.taal) body.adLanguages = [String(o.taal).slice(0, 8)];
  if (o.soort === 'image' || o.soort === 'video') body.mediaType = o.soort;
  /* Bij bereik en groei hoort een venster; bij looptijd niet. Een venster
     meesturen op looptijd zou de lijst inperken tot wat er in dat venster
     begon -- en dat is precies het omgekeerde van wat je vraagt als je zoekt
     naar wat er het langst draait. */
  if (o.sorteer === 'bereik' || o.sorteer === 'groei') {
    body.reachPeriod = ttVenster(dagen);
    body.minReach = 1;
  }
  if (o.min_dagen) body.minDaysRunning = Math.max(0, Number(o.min_dagen) || 0);

  const data = await ttHaal(env, '/v1/ads/query', null, body);
  const rijen = data.data || data.items || data.results || [];
  return {
    bereik: 'markt',
    sorteer: o.sorteer || 'looptijd',
    sorteert_op: sortering.zegt,
    venster: body.reachPeriod || null,
    /* Wat er gevraagd is en wat er werkelijk gebruikt is, allebei. Veertien
       dagen bestaat niet bij deze bron en dan zie je hier dat er dertig is
       gemeten in plaats van dat je het aanneemt. */
    dagen_gevraagd: dagen,
    /* Eén zin die voorkomt dat deze lijst voor bewijs doorgaat. Hij hoort bij
       de data en niet bij het scherm: elk scherm dat deze lijst toont hoort
       hem mee te tonen, ook een scherm dat later gebouwd wordt. */
    voorbehoud: 'Lang draaien en veel bereik zijn signalen, geen bewijs. Van geen enkele advertentie hier kennen we de omzet; het enige wat we weten is dat de adverteerder hem niet heeft uitgezet.',
    advertenties: rijen.map(ttNaarAdvertentie)
  };
}

/* ---- De beeldproxy ----------------------------------------------------- */

/* De console kan het beeld van een concurrent niet rechtstreeks ophalen: die
   servers staan geen vreemde herkomst toe, en later moet Claude het beeld ook
   kunnen lezen. Dus haalt de worker het op.
 *
 * Dat maakt van deze route een gerichte aanvalsmogelijkheid als hij alles
 * doorlaat: een worker die elke URL ophaalt is een manier om via ons bij
 * adressen te komen die alleen wij kunnen bereiken. Vandaar een lijst van
 * hosts die er werkelijk toe doen, en verder niets -- niet een lijst van wat
 * verboden is, want die is altijd incompleet. */
const BEELD_HOSTS = [
  'fbcdn.net', 'cdninstagram.com', 'facebook.com', 'trendtrack.io',
  'tryatria.com', 'atria-cdn.com'
];

function beeldHostMag(u) {
  let host;
  try {
    const url = new URL(u);
    if (url.protocol !== 'https:') return false;
    host = url.hostname.toLowerCase();
  } catch (e) { return false; }
  return BEELD_HOSTS.some(function (h) { return host === h || host.endsWith('.' + h); });
}

/* ============================================================
 * 5. Taalmodel — alleen nog voor Creative Deconstruction
 *
 * Dit was de agent-loop: een model met tools dat zelf besloot wat het deed.
 * Wat ervan over is, is één vraag met één antwoord — lezen wat een advertentie
 * is. Geen tools, geen vervolgstappen, geen eigen initiatief.
 * ============================================================ */

/* Fable 5 kan een thinking-blok vooraan zetten; blind content[0].text lezen
   crasht dan. Zelfde aanpak als wgClaudeText() in de console. */
function claudeText(data) {
  const blocks = data && data.content;
  if (Array.isArray(blocks)) {
    for (const b of blocks) if (b && b.type === 'text' && typeof b.text === 'string' && b.text.length) return b.text;
    for (const b of blocks) if (b && typeof b.text === 'string' && b.text.length) return b.text;
  }
  return '';
}

async function claude(env, body) {
  /* Ook het werk dat de worker zelf doet loopt via de beheerde sleutel. Zou
     deze env.ANTHROPIC_KEY blijven lezen, dan wisselt het adminmenu wel de
     sleutel van de console maar niet die van de nachtelijke lus -- en dan
     werkt de helft. */
  const sleutel = await sleutelVan(env, 'ANTHROPIC_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': sleutel,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-06-01'
    },
    body: JSON.stringify(Object.assign({
      model: MODEL,
      fallbacks: [{ model: FALLBACK_MODEL }]
    }, body))
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(data.error && data.error.message) || JSON.stringify(data).slice(0, 300)}`);
  return data;
}

/* ── Creative Deconstruction ────────────────────────────────────────────────
   Wat maakt deze advertentie tot wat hij is, en wat mag een iteratie niet
   aanraken.

   De opdracht aan het model is bewust smal: alleen lezen, niet oordelen. Geen
   "dit zou beter kunnen", geen aanbeveling, geen cijfers. Zodra een lezing ook
   een mening bevat, gaat de volgende stap op die mening bouwen in plaats van
   op wat er staat.

   De invariants zijn het punt van deze hele laag. Een Founder Story die tijdens
   een iteratie een willekeurig model krijgt, is geen iteratie meer -- het is een
   andere advertentie met dezelfde naam, en de cijfers die eruit komen gaan over
   iets anders dan wat er getest werd. */
const DECONSTRUCT_SCHEMA = {
  name: 'creative_deconstruction',
  description: 'Vastleggen wat er in een bestaande advertentie zit. Alleen beschrijven wat er is; niet beoordelen, niet verbeteren.',
  input_schema: {
    type: 'object',
    properties: {
      creative_type: { type: 'string', description: 'Het soort advertentie in twee of drie woorden, bijvoorbeeld "Founder Story", "Product Demo", "Customer Testimonial".' },
      core_concept: { type: 'string', description: 'Het idee in één zin, zoals je het aan een collega zou uitleggen. Geen marketingtaal.' },
      target_persona: { type: 'string' },
      awareness_level: { type: 'string' },
      marketing_angle: { type: 'string' },
      core_messaging: { type: 'string' },
      hook: { type: 'string' },
      narrative_perspective: { type: 'string', description: 'Bijvoorbeeld first person, third person, direct address.' },
      primary_character: { type: 'string', description: 'Wie er aan het woord is of te zien is. "Niemand" als er geen persoon in zit.' },
      visual_role: { type: 'string', description: 'Wat het beeld doet: bewijzen, tonen, sfeer zetten.' },
      proof_mechanism: { type: 'string' },
      offer: { type: 'string' },
      cta: { type: 'string' },
      emotional_driver: { type: 'string' },
      invariants: {
        type: 'array',
        description: 'De elementen die het concept dragen. Verander je er één, dan is het een ander concept. Wees streng: hoe langer deze lijst, hoe minder ruimte een iteratie heeft.',
        items: {
          type: 'object',
          properties: {
            element: { type: 'string', description: 'Kort, twee of drie woorden.' },
            why: { type: 'string', description: 'Waarom het concept hierop staat of valt. Eén zin.' }
          },
          required: ['element', 'why']
        }
      },
      flexible: {
        type: 'array',
        description: 'De elementen die vrij zijn om te variëren zonder het concept te raken.',
        items: {
          type: 'object',
          properties: {
            element: { type: 'string' },
            why: { type: 'string' }
          },
          required: ['element', 'why']
        }
      },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Hoe zeker deze lezing is gegeven wat je te zien kreeg.' }
    },
    required: ['creative_type', 'core_concept', 'invariants', 'flexible', 'confidence']
  }
};

async function deconstrueer(env, c, gebruiker) {
  /* Wat er te lezen valt. Een lezing op alleen tekst is smaller dan een met
     beeld, en bij een Founder Story zit de helft van het bewijs in het gezicht.
     Dat verschil wordt vastgelegd zodat een halve lezing niet net zo stellig
     oogt als een hele. */
  const heeftBeeld = !!(c.image_b64 || c.has_image);
  const bron = heeftBeeld ? 'copy+image' : 'copy';

  /* De naam en het product zijn context, geen inhoud. Een creative die alleen
     "WS - 200 - 2" heet valt niets aan af te lezen, en een model dat er tóch
     een concept bij verzint is erger dan een weigering: het levert een lezing
     op die eruitziet als een lezing. Daarom tellen ze wel mee in de prompt,
     maar niet als bewijs dat er iets te lezen valt. */
  const inhoudsvelden = [c.hook_short, c.primary_text, c.headline, c.description, c.notes, c.marketing_angle]
    .filter(v => typeof v === 'string' && v.trim());

  const tekst = [
    c.ad_name        ? `Ad name: ${c.ad_name}` : '',
    c.product        ? `Product: ${c.product}` : '',
    c.hook_short     ? `Hook: ${c.hook_short}` : '',
    c.marketing_angle? `Angle: ${c.marketing_angle}` : '',
    c.primary_text   ? `Primary text: ${c.primary_text}` : '',
    c.headline       ? `Headline: ${c.headline}` : '',
    c.description    ? `Description: ${c.description}` : '',
    c.notes          ? `Notes: ${c.notes}` : ''
  ].filter(Boolean).join('\n');

  if (!inhoudsvelden.length && !heeftBeeld) {
    return { error: 'deze creative heeft geen tekst en geen beeld om te lezen' };
  }

  const inhoud = [{ type: 'text', text: tekst || '(geen tekst beschikbaar)' }];
  if (c.image_b64) {
    inhoud.unshift({
      type: 'image',
      source: { type: 'base64', media_type: c.image_mime || 'image/png', data: c.image_b64 }
    });
  }

  const systeem = `Je leest bestaande advertenties en legt vast wat erin zit.

Je beschrijft, je beoordeelt niet. Geen "dit zou sterker kunnen", geen advies,
geen cijfers. Alleen: wat is dit voor advertentie, en waar staat of valt het
idee mee.

Over invariants: dat zijn de elementen die het concept dragen. Bij een Founder
Story zijn dat bijvoorbeeld de founder zelf, zijn beeld, en het eerste-persoons
perspectief -- vervang de founder door een model en het is geen founder story
meer. Wees streng en kort: hoe langer die lijst, hoe minder ruimte er overblijft
om te itereren. Noem alleen wat werkelijk breekt als je het weghaalt.

Kun je iets niet vaststellen, laat het veld dan leeg in plaats van te gokken.
Zet je zekerheid op 'low' als je alleen tekst kreeg en het concept om beeld
draait.`;

  let antwoord;
  try {
    antwoord = await claude(env, {
      max_tokens: 2000,
      system: systeem,
      tools: [DECONSTRUCT_SCHEMA],
      tool_choice: { type: 'tool', name: 'creative_deconstruction' },
      messages: [{ role: 'user', content: inhoud }]
    });
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }

  const blok = (antwoord.content || []).find(b => b.type === 'tool_use');
  if (!blok || !blok.input) return { error: 'het model gaf geen bruikbare lezing terug' };
  const d = blok.input;

  /* Vorm nakijken vóór opslaan. Het schema vraagt om lijsten, maar een model
     dat er een string van maakt hoort hier te stuiten en niet pas op de
     database-constraint -- daar is de melding onleesbaar. */
  if (!Array.isArray(d.invariants) || !Array.isArray(d.flexible)) {
    return { error: 'het model gaf invariants of flexible niet als lijst terug' };
  }
  const schoon = (lijst) => lijst
    .filter(e => e && typeof e.element === 'string' && e.element.trim())
    .map(e => ({ element: String(e.element).trim(), why: String(e.why || '').trim() }));

  const rij = {
    creative_id: c.id,
    creative_type: d.creative_type,
    core_concept: d.core_concept,
    target_persona: d.target_persona || null,
    awareness_level: d.awareness_level || null,
    marketing_angle: d.marketing_angle || null,
    core_messaging: d.core_messaging || null,
    hook: d.hook || null,
    narrative_perspective: d.narrative_perspective || null,
    primary_character: d.primary_character || null,
    visual_role: d.visual_role || null,
    proof_mechanism: d.proof_mechanism || null,
    offer: d.offer || null,
    cta: d.cta || null,
    emotional_driver: d.emotional_driver || null,
    invariants: schoon(d.invariants),
    flexible: schoon(d.flexible),
    source: bron,
    confidence: ['low', 'medium', 'high'].includes(d.confidence) ? d.confidence : null,
    model: (antwoord.model || MODEL),
    analysed_by: (gebruiker && gebruiker.id) || null
  };

  const bewaard = await sbInsert(env, 'creative_deconstructions', [rij]);
  const opgeslagen = (bewaard && bewaard[0]) || rij;

  return {
    ok: true,
    deconstruction_id: opgeslagen.id || null,
    creative_id: c.id,
    creative_type: rij.creative_type,
    core_concept: rij.core_concept,
    source: rij.source,
    confidence: rij.confidence,
    keep: rij.invariants.map(e => e.element),
    flexible: rij.flexible.map(e => e.element),
    keep_detail: rij.invariants,
    flexible_detail: rij.flexible,
    /* Geen invariants betekent dat een iteratie alles mag veranderen. Dat is
       zelden waar en nooit iets om stil te laten. */
    nothing_protected: rij.invariants.length === 0
  };
}

async function logEvent(env, ctx, level, message, data) {
  try {
    await sbInsert(env, 'systeem_events', {
      job_id: ctx.jobId || null,
      run_id: ctx.runId || null,
      level: level,
      message: message,
      data: data || null
    });
  } catch (e) {
    console.error('systeem_events schrijven mislukt:', e);
  }
}

/* De uitsplitsing naar publiek. Apart van metaInsights omdat de korrel anders
   is: geen dagen maar één venster, want bereik is ontdubbeld binnen de periode
   die je opvraagt en dus niet over dagen op te tellen.

   Meta geeft bij deze uitsplitsing geen conversies terug. Dat hoeft ook niet —
   waar het om gaat is vertoningen gedeeld door bereik, en dat is de maat die
   een accountgemiddelde wegpoetst. */
async function metaPubliek(env, days, accountId) {
  const account = kaalAccount(accountId || env.META_AD_ACCOUNT_ID);
  const p = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    level: 'account',
    fields: 'spend,impressions,reach',
    breakdowns: 'user_segment_key',
    time_range: metaVenster(days),
    limit: '50'
  });
  const r = await fetch(`${META_API}/act_${account}/insights?${p}`);
  const data = await r.json();
  if (data.error) throw new Error('Meta: ' + (data.error.message || JSON.stringify(data.error)));
  return (data.data || []).map(row => ({
    account_id: account,
    van: row.date_start,
    tot: row.date_stop,
    segment: row.user_segment_key || 'onbekend',
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    reach: Number(row.reach) || null
  }));
}

/* ============================================================
 * 5b. Systeemtaken
 *
 * Niet elk werk verdient een taalmodel. De terugkoppeling is optellen en delen:
 * er is één juist antwoord, en een model kan er alleen iets aan verzinnen.
 * Deze taken lopen door dezelfde wachtrij — met dezelfde logging, retries en
 * zichtbaarheid — maar zonder Claude ertussen.
 * ============================================================ */

const SYSTEEMTAKEN = {
  /* Stap 06: de cijfers per advertentie terug naar de creative waar hij uit
     voortkwam, zodat de generator bij de volgende ronde begint bij wat werkt. */
  async feedback_sync(env, ctx) {
    const uit = await sbRpc(env, 'sync_creative_results', {});
    await logEvent(env, ctx, 'info', 'Cijfers teruggeschreven naar de creatives', uit);

    /* Wat er nu bekend is over hoeken, zodat het in de live-feed zichtbaar is
       en niet alleen in een tabel die niemand opent. */
    let patronen = [];
    try {
      patronen = await sbSelect(env, 'angle_learnings',
        'betrouwbaar=eq.true&select=angle_type,persona,aantal_ads,roas&order=roas.desc&limit=5');
      if (patronen.length) {
        await logEvent(env, ctx, 'info',
          `Beste hoek nu: ${patronen[0].angle_type} (ROAS ${patronen[0].roas} over ${patronen[0].aantal_ads} ads)`,
          { patronen: patronen });
      }
    } catch (e) { /* de terugkoppeling zelf is gelukt; dit is alleen zicht */ }

    return {
      summary: `${uit.cijfers_bijgewerkt} creatives bijgewerkt met cijfers, `
        + `${uit.status_bijgewerkt} van status veranderd`
        + (patronen.length ? `. Sterkste hoek: ${patronen[0].angle_type}.` : '.'),
      ...uit
    };
  },

  /* De inhaalslag: ontbrekende dagen alsnog ophalen.
   *
   * Waarom dit een systeemtaak is en geen opdracht aan Atlas
   *
   *   Atlas' instructie zegt "gisteren én de drie dagen daarvoor". Wie 177
   *   dagen wil inhalen moet dus hopen dat het model de payload zwaarder weegt
   *   dan zijn eigen instructie. Dat is geen manier om een gat van vier
   *   maanden te vullen -- en als het misgaat, gaat het stil mis.
   *
   *   Er valt hier ook niets te oordelen. Welke dagen ontbreken staat in
   *   meta_meetgaten; wat er opgehaald moet worden volgt daaruit. Mechaniek
   *   hoort in code, niet in een prompt.
   *
   * Waarom één blok per run
   *
   *   Een Worker-run heeft beperkte tijd, en 177 dagen × twee niveaus ×
   *   honderden advertenties past daar niet in. De wachtrij is precies
   *   daarvoor gemaakt: deze taak doet één aaneengesloten gat en zet zichzelf
   *   terug in de rij als er meer zijn. Valt hij halverwege om, dan is wat
   *   binnen is binnen en pakt de volgende tick de rest.
   *
   * Waarom ook accountniveau
   *
   *   Zonder accountcijfer per dag kan meta_meetdag (0049) niet narekenen of
   *   een dag compleet is -- dan is er weer geen noemer die niet van onszelf
   *   komt. Het is één rij per dag; dat kost bijna niets en het is het enige
   *   wat achteraf bewijst dat de inhaalslag klopt.
   */
  async meta_inhaalslag(env, ctx, payload) {
    if (!env.META_ACCESS_TOKEN) {
      return { summary: 'Meta is niet gekoppeld op deze worker; er is niets opgehaald.' };
    }

    /* Het gat komt uit de database en niet uit de payload. Een handmatig
       venster mag, maar dan expliciet -- anders haalt iemand ooit "de laatste
       30 dagen" op en denkt dat de historie klaar is. */
    let blok = null;
    if (payload.van && payload.tot) {
      blok = { account_id: payload.account || null, van: payload.van, tot: payload.tot };
    } else {
      const gaten = await sbSelect(env, 'meta_meetgaten',
        'select=account_id,brand,van,tot,dagen&order=dagen.desc,van.asc&limit=1');
      if (!gaten.length) {
        return { summary: 'Geen ontbrekende dagen meer; de inhaalslag is klaar.', klaar: true };
      }
      blok = gaten[0];
    }

    /* De stand vóór deze ronde, zodat achteraf te zien is of er iets is
       opgeschoten. Zonder dit ijkpunt kan de taak niet weten of hij zichzelf
       nog een keer mag inschieten. */
    const voorMeting = await sbSelect(env, 'meta_meetdekking', 'select=brand,dagen_ontbreken');
    const voor = voorMeting.reduce((n, r) => n + (Number(r.dagen_ontbreken) || 0), 0);

    const lijst = await actieveAccounts(env, blok.account_id || payload.account);
    const venster = { since: blok.van, until: blok.tot };
    const per_account = [];
    let totaal = 0;

    for (const acc of lijst) {
      for (const niveau of ['ad', 'account']) {
        let rows;
        try {
          rows = await metaInsights(env, niveau, 0, acc.account_id, ctx, venster);
        } catch (e) {
          await logEvent(env, ctx, 'warn',
            `Inhaalslag ${niveau} mislukt voor ${acc.naam} (${blok.van} t/m ${blok.tot})`,
            { fout: String(e && e.message || e) });
          continue;
        }
        if (rows.length) {
          await sbInsert(env, 'meta_insights_daily', rows,
            { onConflict: 'insight_date,account_id,level,entity_id' });
        }
        totaal += rows.length;
        per_account.push({ account: acc.naam, niveau: niveau, rijen: rows.length });
      }
    }

    /* Meteen nakijken. Een inhaalslag die zegt "klaar" terwijl de helft
       ontbreekt is precies de storing die dit hele bestand moest wegnemen. */
    const na = await sbSelect(env, 'meta_meetdekking',
      'select=brand,dagen_ontbreken,grootste_gat_dagen,toestand');
    const restant = na.reduce((n, r) => n + (Number(r.dagen_ontbreken) || 0), 0);
    const opgeschoten = (voor - restant);

    /* Zichzelf terugzetten mag alleen als er iets is opgeschoten.
     *
     * Dit ontbrak, en het is één nacht lang goed misgegaan. De taak keek
     * alleen of er nog dagen ontbraken, niet of deze ronde er iets van had
     * weggewerkt. Toen advertentieniveau op één blok bleef weigeren, haalde
     * elke ronde hetzelfde blok op, faalde op hetzelfde punt, zag "nog 101
     * dagen" en zette zichzelf opnieuw in de rij -- elke dertig seconden,
     * tweehonderd keer, zonder ooit een rij op te leveren.
     *
     * Een taak die zichzelf voedt heeft een voorwaarde nodig die hij zelf niet
     * kan waarmaken door te falen. Vooruitgang is die voorwaarde. Staat hij
     * stil, dan stopt de keten hier en probeert de dagelijkse planning het
     * morgen opnieuw -- dat is de goede frequentie voor iets wat aan de
     * overkant vastzit, niet twee keer per minuut. */
    if (restant > 0 && opgeschoten > 0) {
      await sbInsert(env, 'taken', {
        kind: 'meta_inhaalslag', payload: {},
        source: 'systeem', priority: 7,
        scheduled_for: new Date(Date.now() + 60000).toISOString()
      });
    }

    if (restant > 0 && opgeschoten <= 0) {
      await logEvent(env, ctx, 'warn',
        `Inhaalslag kwam niet verder op ${blok.van} t/m ${blok.tot}; keten gestopt, `
        + `de dagelijkse planning probeert het opnieuw`,
        { blok: blok, restant: restant, per_account: per_account });
    }

    await logEvent(env, ctx, 'info',
      `Inhaalslag ${blok.van} t/m ${blok.tot}: ${totaal} rijen; nog ${restant} dagen te gaan`,
      { blok: blok, per_account: per_account, restant: restant, opgeschoten: opgeschoten });

    return {
      summary: `${blok.van} t/m ${blok.tot} opgehaald (${totaal} rijen). `
        + (restant > 0
            ? `Nog ${restant} dag(en) ontbreken; volgende blok staat in de rij.`
            : 'Geen ontbrekende dagen meer.'),
      blok: blok, rijen: totaal, per_account: per_account,
      dagen_nog_ontbrekend: restant, klaar: restant === 0
    };
  }
};

async function voerTaakUit(env, job) {
  /* Er is nog maar één soort werk: een systeemtaak. Wat een taak doet staat in
     code, niet in een instructie aan een model — dus is `kind` genoeg om hem
     te vinden, en is er niets om op te zoeken over wie hem uitvoert.

     Een onbekende `kind` is hier met opzet een harde fout en geen stilzwijgend
     overslaan. Toen de agents er nog waren viel een onbekende opdracht terug op
     het model, dat er dan iets van maakte; dat is precies wat we niet meer
     willen. Wat het systeem niet kent, doet het niet. */
  const taak = SYSTEEMTAKEN[job.kind];
  if (!taak) {
    throw new Error(`onbekende taak "${job.kind}". Bekend: ${Object.keys(SYSTEEMTAKEN).join(', ')}`);
  }

  const ctx = { jobId: job.id, runId: null };
  const run = (await sbInsert(env, 'taak_runs', {
    job_id: job.id, status: 'running', model: 'systeem'
  }))[0];
  ctx.runId = run.id;

  try {
    const uit = await taak(env, ctx, job.payload || {});
    await sbUpdate(env, 'taak_runs', `id=eq.${run.id}`, {
      status: 'done', finished_at: new Date().toISOString(),
      summary: uit.summary, input_tokens: 0, output_tokens: 0, cost_usd: 0
    });
    return uit;
  } catch (e) {
    await sbUpdate(env, 'taak_runs', `id=eq.${run.id}`, {
      status: 'failed', finished_at: new Date().toISOString(), summary: String(e && e.message || e)
    });
    throw e;
  }
}

/* ============================================================
 * 6. Planning en wachtrij
 * ============================================================ */

function vandaag() { return new Date().toISOString().slice(0, 10); }

function dagenGeleden(datum) {
  if (!datum) return 0;
  return Math.floor((Date.now() - new Date(datum + 'T00:00:00Z').getTime()) / 86400000);
}

/* Nederland loopt op UTC+1, of UTC+2 in de zomertijd (laatste zondag maart tot
   laatste zondag oktober). De schedules staan in UTC; deze functie zegt of we
   nu in de zomertijd zitten, zodat 07:00 NL het hele jaar 07:00 NL blijft. */
function isZomertijdNL(d) {
  const jaar = d.getUTCFullYear();
  /* Laatste zondag van de maand, om 01:00 UTC — het EU-omschakelmoment. */
  const laatsteZondag = (maand) => {
    const laatsteDag = new Date(Date.UTC(jaar, maand + 1, 0));
    const datum = laatsteDag.getUTCDate() - laatsteDag.getUTCDay();
    return new Date(Date.UTC(jaar, maand, datum, 1, 0, 0));
  };
  return d >= laatsteZondag(2) && d < laatsteZondag(9);   // maart t/m oktober
}

/* Minimale cron-match: minuut uur dag maand weekdag. Ondersteunt sterretje,
   lijstjes met komma's, reeksen met een streepje en stappen (sterretje-slash-n). */
function cronMatch(cron, d) {
  const delen = String(cron).trim().split(/\s+/);
  if (delen.length !== 5) return false;
  const waarden = [d.getUTCMinutes(), d.getUTCHours(), d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCDay()];
  return delen.every((deel, i) => {
    if (deel === '*') return true;
    return deel.split(',').some(stuk => {
      const stap = stuk.match(/^\*\/(\d+)$/);
      if (stap) return waarden[i] % Number(stap[1]) === 0;
      const reeks = stuk.match(/^(\d+)-(\d+)$/);
      if (reeks) return waarden[i] >= Number(reeks[1]) && waarden[i] <= Number(reeks[2]);
      return Number(stuk) === waarden[i];
    });
  });
}

/* Zet wat nu aan de beurt is in de wachtrij. De cron draait elke 5 minuten,
   dus we kijken of het geplande moment in het afgelopen kwartier lag én er
   vandaag nog niet gevuurd is — zo mist een schedule niet als één tick faalt. */
async function planningNaarTaken(env) {
  const nu = new Date();
  const zomer = isZomertijdNL(nu);
  const schedules = await sbSelect(env, 'schedules', 'enabled=eq.true&select=*');
  let gezet = 0;

  for (const s of schedules) {
    const delen = String(s.cron).trim().split(/\s+/);
    if (delen.length === 5 && !zomer && /^\d+$/.test(delen[1])) {
      delen[1] = String((Number(delen[1]) + 1) % 24);   // wintertijd: een uur later in UTC
    }
    const cron = delen.join(' ');

    let raak = false;
    for (let m = 0; m < 15; m++) {
      if (cronMatch(cron, new Date(nu.getTime() - m * 60000))) { raak = true; break; }
    }
    if (!raak) continue;
    if (s.last_fired_at && (nu - new Date(s.last_fired_at)) < 6 * 3600 * 1000) continue;

    await sbInsert(env, 'taken', {
      kind: s.kind, payload: s.payload || {},
      source: 'cron', schedule_id: s.id, priority: 3
    });
    await sbUpdate(env, 'schedules', `id=eq.${s.id}`, { last_fired_at: nu.toISOString() });
    gezet++;
  }
  return gezet;
}

async function werkRijAf(env, workerId, maxTaken) {
  const gedaan = [];
  for (let i = 0; i < maxTaken; i++) {
    const job = await sbRpc(env, 'claim_taak', { p_worker: workerId });
    if (!job || !job.id) break;
    try {
      const resultaat = await voerTaakUit(env, job);
      await sbUpdate(env, 'taken', `id=eq.${job.id}`, {
        status: 'done', result: resultaat, finished_at: new Date().toISOString(), locked_by: null
      });
      gedaan.push({ id: job.id, kind: job.kind, status: 'done' });
    } catch (e) {
      const fout = String(e && e.message || e);
      const opnieuw = job.attempts < job.max_attempts;
      await sbUpdate(env, 'taken', `id=eq.${job.id}`, {
        status: opnieuw ? 'queued' : 'failed',
        error: fout,
        locked_at: null, locked_by: null,
        /* backoff: 5, 20, 45 minuten */
        scheduled_for: new Date(Date.now() + Math.pow(job.attempts, 2) * 5 * 60000).toISOString(),
        finished_at: opnieuw ? null : new Date().toISOString()
      });
      await logEvent(env, { jobId: job.id }, 'error',
        opnieuw ? 'Taak mislukt, wordt opnieuw geprobeerd' : 'Taak definitief mislukt', { fout: fout });
      gedaan.push({ id: job.id, kind: job.kind, status: opnieuw ? 'requeued' : 'failed', error: fout });
    }
  }
  return gedaan;
}

async function tick(env, workerId) {
  const vrijgegeven = await sbRpc(env, 'maak_vastgelopen_taken_vrij', { p_timeout: `${JOB_TIMEOUT_MIN} minutes` });
  const gepland = await planningNaarTaken(env);
  const gedaan = await werkRijAf(env, workerId, JOBS_PER_TICK);
  return { vrijgegeven: vrijgegeven, gepland: gepland, verwerkt: gedaan };
}

/* ============================================================
 * 7. Toegang
 * ============================================================ */

function corsHeaders(request) {
  const o = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': originMag(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, anthropic-beta',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

const _cache = new Map(); // token -> { exp, ok, email, role }
async function lid(request) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!t) return null;
  const now = Date.now();
  const c = _cache.get(t);
  if (c && c.exp > now) return c.ok ? c : null;
  let uit = { exp: now + 60000, ok: false, email: null, role: null };
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': SB_ANON } });
    if (r.ok) {
      const u = await r.json();
      if (u && u.id) {
        const r2 = await fetch(SB_URL + '/rest/v1/team_members?id=eq.' + u.id + '&select=status,role', {
          headers: { 'Authorization': 'Bearer ' + t, 'apikey': SB_ANON }
        });
        if (r2.ok) {
          const rows = await r2.json();
          if (rows && rows[0] && rows[0].status === 'approved') {
            /* id erbij: wie een lezing opvraagt hoort vastgelegd te worden.
               Alleen toegevoegd, nooit verwijderd -- elke bestaande lezer van
               dit object blijft werken. */
            uit = { exp: now + 60000, ok: true, id: u.id, email: u.email || null, role: rows[0].role || 'member' };
          }
        }
      }
    }
  } catch (e) { }
  _cache.set(t, uit);
  return uit.ok ? uit : null;
}

/* ============================================================
 * 8. Worker
 * ============================================================ */

export default {
  async scheduled(event, env, ctx) {
    if (!env.SUPABASE_SERVICE_KEY) { console.error('SUPABASE_SERVICE_KEY ontbreekt — runtime staat stil'); return; }
    const workerId = 'cron-' + event.scheduledTime;
    ctx.waitUntil(tick(env, workerId).then(
      r => console.log('tick', JSON.stringify(r)),
      e => console.error('tick mislukt', e)
    ));
  },

  async fetch(request, env) {
    const cors = corsHeaders(request);
    const json = (obj, status) => new Response(JSON.stringify(obj), {
      status: status || 200, headers: { 'Content-Type': 'application/json', ...cors }
    });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    /* Open endpoint: geen login. Daarom staat hier alleen of iets aan of uit
       staat, en geen enkel gegeven over het bedrijf erachter — geen
       accountnummers, geen merknamen. En geen databasecall: een open endpoint
       dat bij elke aanroep de database aanraakt is een uitnodiging.
       Welke accounts meetellen staat in /systeem/status, achter de login. */
    if (path === '' || path === '/health') {
      return json({
        ok: true,
        service: 'marketing-os',
        /* Bewust ook op de open route: dit lekt niets over het bedrijf en het
           is precies de vraag die je wilt kunnen stellen zonder eerst in te
           loggen -- draait er wat ik denk dat er draait. */
        versie: VERSIE,
        versie_datum: VERSIE_DATUM,
        versie_wat: VERSIE_WAT,
        runtime: env.SUPABASE_SERVICE_KEY ? 'actief' : 'uit (SUPABASE_SERVICE_KEY ontbreekt)',
        /* Let op wat dit wel en niet zegt: of er EEN sleutel is, niet of hij
           nog geldig is. Dat onderscheid heeft een halve dag gekost -- het
           veld was gevuld, dus alles stond groen, terwijl de sleutel al
           ingetrokken was. Geldigheid vraag je op met /systeem/sleutels/proef,
           en dat is met opzet admin-only: het kost een echte aanroep bij de
           dienst, en dat is niets wat een openbaar endpoint hoort te doen. */
        koppelingen: {
          claude: !!(await sleutelVan(env, 'ANTHROPIC_KEY')),
          openai: !!(await sleutelVan(env, 'OPENAI_KEY')),
          meta: !!env.META_ACCESS_TOKEN,
          atria: !!(await sleutelVan(env, 'ATRIA_API_KEY')),
          trendtrack: !!(await sleutelVan(env, 'TRENDTRACK_API_KEY')),
          klaviyo: !!env.KLAVIYO_API_KEY
        },
      });
    }

    const gebruiker = await lid(request);
    if (!gebruiker) return json({ ok: false, error: 'unauthorized', hint: 'Log in in de Atelier Console met een goedgekeurd teamaccount.' }, 401);

    /* ---- Creative Deconstruction ----
       Lezen wat een bestaande advertentie ís, vóór er iets gegenereerd wordt.

       Waarom dit in de worker zit en niet in de console: de sleutel blijft hier.
       De console vraagt het aan met zijn login, de worker praat met Claude.

       Waarom een eigen route en geen taak in de wachtrij: dit is een synchrone vraag van
       een mens die op een scherm wacht, geen geplande taak. Een job in de
       wachtrij zou tot vijf minuten duren en dan is het scherm allang gesloten.

       Deze route schrijft alleen in creative_deconstructions. Hij raakt
       public.creatives niet aan -- dat is wat het team noteerde, dit is wat de
       AI leest, en die twee horen naast elkaar te staan. */
    if (path === '/creative/deconstruct' && request.method === 'POST') {
      if (!env.SUPABASE_SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_KEY ontbreekt op deze worker' }, 500);
      if (!(await sleutelVan(env, 'ANTHROPIC_KEY'))) {
        return json({ error: 'er staat geen ANTHROPIC_KEY. Zet hem in het adminmenu of als Worker secret.' }, 500);
      }

      const body = await request.json().catch(() => ({}));
      const creativeId = Number(body.creative_id);
      if (!creativeId) return json({ error: 'creative_id ontbreekt' }, 400);

      const rijen = await sbSelect(env, 'creatives', `id=eq.${creativeId}&select=*`);
      const c = rijen && rijen[0];
      if (!c) return json({ error: `creative ${creativeId} bestaat niet` }, 404);

      /* Een model kan elke vorm teruggeven. De vangnetten in deconstrueer()
         dekken de vormen die we kennen; deze vangt de rest. Zonder dit valt de
         route om op een onverwachte structuur en krijgt het scherm een kale 500
         zonder uitleg -- en dan lijkt het alsof de worker stuk is in plaats van
         dat het model iets raars zei. */
      let uit;
      try {
        uit = await deconstrueer(env, c, gebruiker);
      } catch (e) {
        uit = { error: 'de lezing liep vast: ' + String((e && e.message) || e).slice(0, 200) };
      }
      return json(uit, uit.error ? 502 : 200);
    }

    /* ---- Itereren: de bron van de advertentie waarop je voortbouwt ----
       Achter de login, want dit gaat over het eigen advertentieaccount: welke
       advertenties er draaien, wat ze kosten en wat ze opleveren. Dat is geen
       gegeven dat op een open endpoint hoort.

       De console kiest de bron, niet de worker. Draaien beide, dan zijn de
       cijfers niet altijd tot op de cent gelijk -- Atria en Meta tellen
       attributievensters net anders -- en dat is een keuze van degene die
       kijkt, niet iets om stil voor hem in te vullen. */
    if (path.startsWith('/itereren')) {
      const bron = url.searchParams.get('bron') || 'atria';
      const account = url.searchParams.get('account') || '';
      const dagen = Number(url.searchParams.get('dagen')) || 30;
      if (bron !== 'atria' && bron !== 'meta') return json({ error: "bron moet 'atria' of 'meta' zijn" }, 400);

      try {
        if (path === '/itereren/bronnen' && request.method === 'GET') {
          return json({ bronnen: await itereerBronnen(env) });
        }

        /* De matencatalogus van Atria, onvertaald. Onze eigen namen komen uit
           een vertaaltabel en die kan misgrijpen als het account maten anders
           noemt. Dan wil je kunnen kijken wat er werkelijk staat in plaats van
           te raden waarom een veld leeg blijft. */
        if (path === '/itereren/maten' && request.method === 'GET') {
          if (bron !== 'atria') return json({ error: 'de matencatalogus bestaat alleen bij Atria' }, 400);
          if (!account) return json({ error: 'account ontbreekt' }, 400);
          const d = await atriaHaal(env, '/open/v1/ad-accounts/' + encodeURIComponent(account) + '/metrics');
          return json({ maten: d.items || [] });
        }

        if (path === '/itereren/advertenties' && request.method === 'GET') {
          if (!account) return json({ error: 'account ontbreekt' }, 400);
          const limiet = url.searchParams.get('limiet');
          const vergelijk = url.searchParams.get('vergelijk') === '1';
          const lijst = bron === 'atria'
            ? await atriaAdvertenties(env, account, dagen, url.searchParams.get('sorteer'), limiet)
            : await metaAdvertenties(env, account, dagen, limiet, vergelijk);
          /* Of "daalt hij" te beantwoorden is, en zo niet: waarom niet. Een
             filter dat stil niets teruggeeft leest als "geen enkele advertentie
             daalt" -- en dat is een geruststelling die wij niet gemeten hebben.
             Atria kent alleen vaste periodes (last_7d en zo), dus daar is geen
             vorige periode op te vragen. */
          const uit = { bron: bron, dagen: dagen, advertenties: lijst,
                        trend_beschikbaar: bron !== 'atria' };
          if (bron === 'atria') {
            uit.trend_reden = 'Atria levert alleen vaste periodes, geen vorige periode om tegen te vergelijken.';
          }
          return json(uit);
        }

        if (path === '/itereren/advertentie' && request.method === 'GET') {
          if (!account) return json({ error: 'account ontbreekt' }, 400);
          const id = url.searchParams.get('id');
          if (!id) return json({ error: 'id ontbreekt' }, 400);
          /* De advertentie en de norm naast elkaar opvragen. De norm is het
             account zelf over hetzelfde venster -- vandaar hetzelfde aantal
             dagen, en niet een apart in te stellen periode. Twee vensters
             vergelijken is geen vergelijking. */
          const [advertentie, norm] = await Promise.all([
            bron === 'atria' ? atriaAdvertentie(env, account, id, dagen) : metaAdvertentie(env, account, id, dagen),
            (bron === 'atria' ? atriaNorm(env, account, dagen) : metaNorm(env, account, dagen)).catch(function () { return null; })
          ]);
          return json({
            bron: bron, dagen: dagen,
            advertentie: advertentie,
            norm: norm,
            diagnose: adDiagnose(advertentie.cijfers, norm)
          });
        }
      } catch (e) {
        /* De bron is stuk, niet de worker. Dat onderscheid hoort in het
           antwoord te staan, anders zoekt iemand het bij ons. */
        return json({ error: String((e && e.message) || e).slice(0, 200), bron: bron }, 502);
      }

      return json({ error: 'onbekend itereer-endpoint' }, 404);
    }

    /* ---- Creative Research: wat er in de markt draait ----
       Achter de login. Niet omdat de gegevens geheim zijn -- ze komen uit een
       openbare advertentiebibliotheek -- maar omdat elke aanroep credits kost
       bij TrendTrack, en een open endpoint dat credits verbrandt is een
       rekening die iemand anders voor je opmaakt. */
    if (path.startsWith('/onderzoek')) {
      try {
        if (path === '/onderzoek/toplijst' && request.method === 'GET') {
          return json(await ttToplijst(env, {
            sorteer: url.searchParams.get('sorteer'),
            dagen: url.searchParams.get('dagen'),
            limiet: url.searchParams.get('limiet'),
            zoek: url.searchParams.get('zoek'),
            land: url.searchParams.get('land'),
            taal: url.searchParams.get('taal'),
            soort: url.searchParams.get('soort'),
            min_dagen: url.searchParams.get('min_dagen'),
            bereik: url.searchParams.get('bereik'),
            merk: url.searchParams.get('merk'),
            per_merk: url.searchParams.get('per_merk')
          }));
        }

        /* De gevolgde merken apart, zodat het scherm ze kan tonen zonder eerst
           een hele analyse te draaien. */
        if (path === '/onderzoek/merken' && request.method === 'GET') {
          return json({ merken: await ttMerken(env) });
        }

        /* Het beeld van een concurrent, opgehaald door de worker omdat de
           browser dat niet mag en Claude het straks moet kunnen lezen. Alleen
           van hosts die er werkelijk toe doen: zonder die grens is dit een
           manier om via ons bij adressen te komen die alleen wij bereiken. */
        if (path === '/onderzoek/beeld' && request.method === 'GET') {
          const bron = url.searchParams.get('u') || '';
          if (!beeldHostMag(bron)) return json({ error: 'dit adres wordt niet doorgelaten' }, 400);
          const r = await fetch(bron);
          if (!r.ok) return json({ error: 'het beeld was niet op te halen (' + r.status + ')' }, 502);
          const type = r.headers.get('content-type') || '';
          /* En wat er terugkomt moet ook echt een beeld zijn. Een host op de
             lijst die iets anders teruggeeft is geen reden om het door te
             zetten alsof het een plaatje is. */
          if (!/^image\//.test(type)) return json({ error: 'dat adres gaf geen afbeelding terug' }, 400);
          return new Response(await r.arrayBuffer(), {
            status: 200,
            headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600', ...cors }
          });
        }

        /* Hetzelfde, maar dan voor bewegend beeld. Een aparte ingang en geen
           extra soort op /onderzoek/beeld: die weigert alles wat geen plaatje
           is, en dat is precies de grens die je niet even oprekt omdat er nu
           ook een video langskomt.

           Het lichaam wordt doorgegeven, niet ingelezen: een advertentie van
           dertig seconden past niet in het geheugen van een worker, en hoeft
           dat ook niet. Een Range-verzoek gaat mee zodat de speler kan
           doorspoelen; zonder dat kun je alleen van voren af aan kijken. */
        if (path === '/onderzoek/video' && request.method === 'GET') {
          const bron = url.searchParams.get('u') || '';
          if (!beeldHostMag(bron)) return json({ error: 'dit adres wordt niet doorgelaten' }, 400);
          const door = {};
          const range = request.headers.get('range');
          if (range) door['Range'] = range;
          const r = await fetch(bron, { headers: door });
          if (!r.ok && r.status !== 206) return json({ error: 'de video was niet op te halen (' + r.status + ')' }, 502);
          const type = r.headers.get('content-type') || '';
          if (!/^video\//.test(type)) return json({ error: 'dat adres gaf geen video terug' }, 400);
          const uit = { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600', 'Accept-Ranges': 'bytes', ...cors };
          ['content-length', 'content-range'].forEach(function (h) {
            const w = r.headers.get(h);
            if (w) uit[h] = w;
          });
          return new Response(r.body, { status: r.status, headers: uit });
        }
      } catch (e) {
        return json({ error: String((e && e.message) || e).slice(0, 200), bron: 'trendtrack' }, 502);
      }

      return json({ error: 'onbekend onderzoek-endpoint' }, 404);
    }

    /* ---- Systeem-API ----
       Was /agents/*. De naam klopte niet meer zodra er geen agents meer waren:
       wat hierachter zit is een takenwachtrij en een publicatieketen, en beide
       draaien zonder model. */
    if (path.startsWith('/systeem')) {
      if (!env.SUPABASE_SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_KEY ontbreekt op deze worker' }, 500);

      if (path === '/systeem/status' && request.method === 'GET') {
        const [taken, events, accounts] = await Promise.all([
          sbSelect(env, 'taken', 'status=in.(queued,running)&select=*&order=priority,scheduled_for&limit=50'),
          sbSelect(env, 'systeem_events', 'select=*&order=created_at.desc&limit=40'),
          /* Welke accounts er meetellen. Zonder dit is een deploy die stil
             terugvalt op één account niet te onderscheiden van een die er vijf
             ziet — en dat verschil was precies het probleem. */
          actieveAccounts(env)
        ]);
        /* Wat het systeem kán doen staat in de code, dus kan het ook eerlijk
           opgesomd worden. Bij de agents kon dat niet: daar hing het ervan af
           wat het model van een opdracht maakte. */
        return json({ taken, events, accounts, soorten: Object.keys(SYSTEEMTAKEN) });
      }

      if (path === '/systeem/taken' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const q = ['select=*', 'order=created_at.desc', 'limit=' + Math.min(Number(url.searchParams.get('limit')) || 50, 200)];
        if (status) q.push('status=eq.' + status);
        return json({ taken: await sbSelect(env, 'taken', q.join('&')) });
      }

      if (path === '/systeem/taken' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const kind = String(body.kind || '');
        if (!kind) return json({ error: 'kind is verplicht' }, 400);
        /* Vóór het wegschrijven, niet pas bij het uitvoeren. Anders zet iemand
           een taak klaar die pas een minuut later stilletjes omvalt, en dan
           zoek je de reden in de logs in plaats van hem meteen te lezen. */
        if (!SYSTEEMTAKEN[kind]) {
          return json({ error: `onbekende taak "${kind}"`, beschikbaar: Object.keys(SYSTEEMTAKEN) }, 400);
        }
        const rij = (await sbInsert(env, 'taken', {
          kind: kind,
          payload: body.payload || {},
          source: 'console',
          requested_by: gebruiker.email,
          priority: 1                     // wat een mens vraagt gaat voor op cron
        }))[0];
        return json({ ok: true, taak: rij });
      }

      const annuleer = path.match(/^\/systeem\/taken\/(\d+)\/annuleer$/);
      if (annuleer && request.method === 'POST') {
        const uit = await sbUpdate(env, 'taken', `id=eq.${annuleer[1]}&status=in.(queued,running)`, {
          status: 'cancelled', finished_at: new Date().toISOString(), error: 'geannuleerd door ' + gebruiker.email
        });
        return json({ ok: uit.length > 0, taak: uit[0] || null });
      }

      /* ---- Publicaties ---- */
      if (path === '/systeem/publicaties' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const q = ['select=*', 'order=created_at.desc',
                   'limit=' + Math.min(Number(url.searchParams.get('limit')) || 50, 200)];
        if (status) q.push('status=eq.' + status);
        return json({ publications: await sbSelect(env, 'meta_publications', q.join('&')) });
      }

      /* Klaarzetten was een tool van Bolt. Zonder agents zou de hele
         publicatieketen bij de eerste stap doodlopen, dus staat hij nu waar hij
         thuishoort: achter een endpoint, met een mens als aanvrager. De ad zelf
         wordt hier nog steeds niet aangemaakt — dat blijft de aparte stap
         hieronder, want daar gaat geld lopen. */
      if (path === '/systeem/publicaties/klaarzetten' && request.method === 'POST') {
        if (!env.META_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) {
          return json({ error: 'Meta is niet gekoppeld op deze worker' }, 500);
        }
        const body = await request.json().catch(() => ({}));
        const uit = await metaPrepare(env, gebruiker.email, body);
        return json(uit, uit.error ? (uit.status || 400) : 200);
      }

      /* Beslissen over een goedkeuring. Dit was al de menselijke stap en dat
         verandert niet; er is alleen niets meer dat hem namens jou kon zetten. */
      const beslis = path.match(/^\/systeem\/approvals\/(\d+)\/decide$/);
      if (beslis && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const besluit = String(body.decision || '').toLowerCase();
        if (besluit !== 'approved' && besluit !== 'rejected') {
          return json({ error: 'decision moet "approved" of "rejected" zijn' }, 400);
        }
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin kan goedkeuren of afwijzen' }, 403);
        }
        const bijgewerkt = await sbUpdate(env, 'approvals', `id=eq.${beslis[1]}&status=eq.pending`, {
          status: besluit, decided_by: gebruiker.email, decided_at: new Date().toISOString()
        });
        if (!bijgewerkt.length) {
          return json({ error: 'goedkeuring bestaat niet of is al beslist' }, 409);
        }
        /* Een afgewezen publicatie moet dat ook zelf weten, anders blijft hij
           in de wachtrij staan alsof er nog over nagedacht wordt. */
        if (besluit === 'rejected') {
          await sbUpdate(env, 'meta_publications',
            `approval_id=eq.${beslis[1]}&status=eq.wacht_op_akkoord`, { status: 'afgewezen' });
        } else {
          await sbUpdate(env, 'meta_publications',
            `approval_id=eq.${beslis[1]}`, { approved_at: new Date().toISOString() });
        }
        return json({ ok: true, approval: bijgewerkt[0] });
      }

      /* Live zetten. Het enige punt in het systeem waar geld gaat lopen. */
      const publiceer = path.match(/^\/systeem\/publicaties\/(\d+)\/publish$/);
      if (publiceer && request.method === 'POST') {
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin kan een advertentie live zetten' }, 403);
        }
        if (!env.META_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) {
          return json({ error: 'Meta is niet gekoppeld op deze worker' }, 500);
        }
        const body = await request.json().catch(() => ({}));
        const uit = await metaPublish(env, Number(publiceer[1]), gebruiker.email, body.activate !== false);
        return json(uit, uit.error ? (uit.status || 400) : 200);
      }

      if (path === '/systeem/tick' && request.method === 'POST') {
        if (gebruiker.role !== 'admin') return json({ error: 'alleen een admin kan handmatig een cyclus draaien' }, 403);
        return json(await tick(env, 'handmatig-' + gebruiker.email));
      }

      /* ---- Sleutelbeheer, alleen admin ----
         Lezen geeft NOOIT een waarde terug, ook niet aan een admin. Er is geen
         reden om een sleutel op een scherm te zetten: je zet hem, of je
         vervangt hem. Kunnen lezen levert alleen maar plekken op waar hij
         terechtkomt -- een screenshot, een logboek, een gesprek. */
      if (path === '/systeem/sleutels' && request.method === 'GET') {
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin mag de sleutels beheren' }, 403);
        }
        return json(await sleutelOverzicht(env));
      }

      if (path === '/systeem/sleutels' && request.method === 'POST') {
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin mag de sleutels beheren' }, 403);
        }
        const body = await request.json().catch(() => ({}));
        const naam = String(body.naam || '');
        if (SLEUTELNAMEN.indexOf(naam) === -1) {
          return json({ error: 'naam moet een van ' + SLEUTELNAMEN.join(', ') + ' zijn' }, 400);
        }
        const uit = await sleutelZet(env, naam, body.waarde, gebruiker.email);
        if (uit.error) return json({ error: uit.error }, uit.status || 400);
        /* Meteen uitproberen. Een sleutel die opgeslagen is maar niet werkt,
           merk je anders pas als iemand midden in zijn werk vastloopt -- en
           dan zoekt hij het bij de worker in plaats van bij de sleutel. */
        const proef = await sleutelWerkt(env, naam);
        return json(Object.assign(uit, { proef: proef }));
      }

      if (path === '/systeem/sleutels/proef' && request.method === 'POST') {
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin mag de sleutels beheren' }, 403);
        }
        const proeven = {};
        for (const naam of SLEUTELNAMEN) proeven[naam] = await sleutelWerkt(env, naam);
        return json(proeven);
      }

      return json({ error: 'onbekend systeem-endpoint' }, 404);
    }

    /* ---- Anthropic (ongewijzigd) ---- */
    if (path === '/anthropic' && request.method === 'POST') {
      /* Niet meer rechtstreeks env.ANTHROPIC_KEY: sleutelVan kijkt eerst in de
         database (wat je via het adminmenu zet) en valt daarna terug op het
         Worker secret. */
      const anthropicSleutel = await sleutelVan(env, 'ANTHROPIC_KEY');
      if (!anthropicSleutel) return json({ error: 'er staat geen ANTHROPIC_KEY. Zet hem in het adminmenu of als Worker secret.' }, 500);
      const body = await request.text();
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicSleutel,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
          ...(request.headers.get('anthropic-beta') ? { 'anthropic-beta': request.headers.get('anthropic-beta') } : {})
        },
        body
      });
      return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    /* ---- OpenAI (ongewijzigd) ---- */
    let oaPath = null;
    if (path.startsWith('/v1/')) oaPath = path.slice(1);
    else if (path.startsWith('/openai/')) oaPath = path.slice('/openai/'.length);
    if (oaPath !== null) {
      const openaiSleutel = await sleutelVan(env, 'OPENAI_KEY');
      if (!openaiSleutel) return json({ error: 'er staat geen OPENAI_KEY. Zet hem in het adminmenu of als Worker secret.' }, 500);
      const target = oaPath.startsWith('v1/') ? ('https://api.openai.com/' + oaPath) : ('https://api.openai.com/v1/' + oaPath);
      const headers = { 'Authorization': 'Bearer ' + openaiSleutel };
      const ct = request.headers.get('content-type');
      if (ct) headers['Content-Type'] = ct;
      let body;
      if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.arrayBuffer();
      const r = await fetch(target, { method: request.method, headers, body });
      const out = await r.arrayBuffer();
      return new Response(out, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', ...cors } });
    }

    return json({ error: { message: 'Gebruik /systeem/*, POST /anthropic of /openai/… (of GET /health).' } }, 404);
  }
};
