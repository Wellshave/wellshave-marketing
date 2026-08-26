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
const VERSIE = 19;
const VERSIE_DATUM = '2026-08-17';
const VERSIE_WAT = 'het standaardmodel is Opus 5; Fable 5 wordt de terugval. De console stuurt zelf een model mee, dus dit geldt voor alles wat de worker op eigen houtje doet';

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
  return false;
}

/* De foutmelding van de dienst inkorten tot iets bruikbaars. Voluit
   doorgeven kan de sleutel bevatten die je net probeerde: sommige diensten
   echoen hem terug in hun melding, en dan staat hij alsnog in beeld. */
function kortDeFout(tekst, status) {
  let bericht = '';
  try { const o = JSON.parse(tekst); bericht = (o.error && (o.error.message || o.error.type)) || ''; } catch (e) { }
  bericht = String(bericht).replace(/sk-[A-Za-z0-9_-]{8,}/g, '<sleutel>').slice(0, 140);
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
      return { geldig: false, reden: kortDeFout(await r.text(), r.status) };
    }
    const r = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': 'Bearer ' + sleutel } });
    if (r.ok) return { geldig: true, reden: null };
    return { geldig: false, reden: kortDeFout(await r.text(), r.status) };
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
  for (const naam of ['ANTHROPIC_KEY', 'OPENAI_KEY']) {
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
function metaVenster(days) {
  var n = Math.max(1, Math.min(Number(days) || 7, 400));
  var eind = new Date();
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
        if (naam !== 'ANTHROPIC_KEY' && naam !== 'OPENAI_KEY') {
          return json({ error: 'naam moet ANTHROPIC_KEY of OPENAI_KEY zijn' }, 400);
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
        return json({
          ANTHROPIC_KEY: await sleutelWerkt(env, 'ANTHROPIC_KEY'),
          OPENAI_KEY: await sleutelWerkt(env, 'OPENAI_KEY')
        });
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
