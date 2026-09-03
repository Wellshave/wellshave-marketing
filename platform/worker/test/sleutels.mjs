/* Testlus voor het sleutelbeheer in de worker.
 *
 * Aanleiding: de API-sleutels stonden letterlijk in de broncode van de
 * console, achter een wachtwoord dat er drie regels boven ook in stond. Toen
 * de repo gedeeld werd, vonden de scanners van Anthropic en OpenAI ze en
 * trokken ze allebei in. De code is opgeruimd, en dit is wat ervoor in de
 * plaats komt: zetten via een adminmenu, versleuteld in de database.
 *
 * Vier dingen die hier fout kunnen gaan, en alle vier stil:
 *
 *   1. HET WORDT NIET VERSLEUTELD. Dan staat de sleutel gewoon leesbaar in de
 *      database en is er niets gewonnen -- het probleem is dan alleen
 *      verhuisd van de broncode naar een tabel.
 *
 *   2. HET SCHERM KRIJGT DE SLEUTEL TERUG. Een endpoint dat de waarde
 *      teruggeeft "voor het gemak" zet hem weer in een browser, en dan in een
 *      screenshot. Er is geen antwoord van deze endpoints waar een hele
 *      sleutel in hoort te staan, ook niet voor een admin.
 *
 *   3. EEN NIET-ADMIN KOMT ERBIJ. Het menu verbergen is geen beveiliging; de
 *      worker moet weigeren.
 *
 *   4. DE HELFT LOOPT NOG OP DE OUDE SLEUTEL. De console vraagt via
 *      /anthropic, maar de worker doet zelf ook werk. Leest een van de twee
 *      nog rechtstreeks het Worker secret, dan wissel je de sleutel en werkt
 *      het half -- de vervelendste soort storing die er is.
 *
 *   node platform/worker/test/sleutels.mjs
 */

import worker from '../marketing-os.worker.js';

/* De worker houdt een gelezen sleutel zestig seconden vast. Dat is in
   productie precies goed -- het scheelt een databaseronde per aanroep -- maar
   tussen twee testblokken door is het een geheugen dat niet klopt: blok 2 zou
   dan de sleutel van blok 1 gebruiken. Een verse module per blok is eerlijker
   dan de cache van buitenaf leegmaken, want dat laatste zou een luikje in
   productiecode zijn dat alleen de test nodig heeft. */
let versieteller = 0;
async function verseWorker() {
  versieteller++;
  const m = await import('../marketing-os.worker.js?t=' + versieteller);
  return m.default;
}
let actieveWorker = worker;

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

/* Sleutels die nergens van zijn: opgebouwd uit een herhaald teken, dus ze
   hebben nooit bij een dienst gehoord en ze halen geen scanner overhoop. */
const NEP_ANTHROPIC = 'sk-ant-api03-' + 'A'.repeat(40);
const NEP_ANTHROPIC_2 = 'sk-ant-api03-' + 'B'.repeat(40);
const NEP_OPENAI = 'sk-proj-' + 'C'.repeat(40);
const NEP_ATRIA = 'atria-sk_' + 'D'.repeat(32);
const NEP_TT = 'tt' + 'E'.repeat(32);

/* ── De nagebootste wereld ──────────────────────────────────────────────── */

let db, dienstAntwoorden, aanroepen;

async function reset() {
  actieveWorker = await verseWorker();
  db = { systeem_geheimen: [], team_members: [] };
  dienstAntwoorden = { anthropic: { ok: true }, openai: { ok: true }, atria: { ok: true }, trendtrack: { ok: true } };
  aanroepen = { anthropic: [], openai: [], atria: [], trendtrack: [] };
}

const SB = 'https://vwzdxvnqhrqkvvhbxkhr.supabase.co';

globalThis.fetch = async (url, opties) => {
  const u = String(url);
  const m = (opties && opties.method) || 'GET';

  /* Supabase auth: het token is de gebruikersnaam, zo simpel mag het hier. */
  if (u.includes('/auth/v1/user')) {
    const t = (opties.headers.Authorization || '').replace('Bearer ', '');
    if (!t || t === 'geen') return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ id: t, email: t + '@wellshave.com' }) };
  }
  if (u.includes('/rest/v1/team_members')) {
    const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
    const rij = db.team_members.filter(r => r.id === id);
    return { ok: true, json: async () => rij };
  }

  /* De geheimentabel. */
  if (u.includes('/rest/v1/systeem_geheimen')) {
    if (m === 'POST') {
      const rijen = JSON.parse(opties.body);
      rijen.forEach(r => {
        const i = db.systeem_geheimen.findIndex(x => x.naam === r.naam);
        if (i >= 0) db.systeem_geheimen[i] = r; else db.systeem_geheimen.push(r);
      });
      return { ok: true, text: async () => '[]', json: async () => rijen };
    }
    const naam = decodeURIComponent((u.match(/naam=eq\.([^&]+)/) || [])[1] || '');
    const uit = naam ? db.systeem_geheimen.filter(r => r.naam === naam) : db.systeem_geheimen;
    return { ok: true, json: async () => uit };
  }

  /* De diensten zelf. */
  if (u.includes('api.anthropic.com')) {
    aanroepen.anthropic.push(opties.headers['x-api-key']);
    const a = dienstAntwoorden.anthropic;
    return { ok: a.ok, status: a.ok ? 200 : 401,
      text: async () => a.ok ? '{"content":[]}' : JSON.stringify({ error: { message: a.melding || 'invalid x-api-key' } }),
      json: async () => ({ content: [] }) };
  }
  if (u.includes('api.trendtrack.io')) {
    aanroepen.trendtrack.push(opties.headers.Authorization);
    const a = dienstAntwoorden.trendtrack;
    return { ok: a.ok, status: a.ok ? 200 : 401,
      /* De melding draagt de sleutel die net geprobeerd is. Dat doen diensten
         werkelijk, en TrendTrack heeft geen voorvoegsel waar een filter op kan
         aanslaan -- vandaar dat de maskering de waarde zelf moet kennen. */
      text: async () => a.ok ? '{"workspace":"wellshave"}'
        : JSON.stringify({ message: 'Invalid API key ' + NEP_TT }),
      json: async () => ({ workspace: 'wellshave' }) };
  }
  if (u.includes('api.tryatria.com')) {
    aanroepen.atria.push(opties.headers['X-API-Key']);
    const a = dienstAntwoorden.atria;
    return { ok: a.ok, status: a.ok ? 200 : 401,
      text: async () => a.ok ? '{"code":0,"data":{"items":[]}}'
        : JSON.stringify({ error: 'invalid_api_key', message: a.melding || 'The provided API key is invalid' }),
      json: async () => ({ code: 0, data: { items: [] } }) };
  }
  if (u.includes('api.openai.com')) {
    aanroepen.openai.push((opties.headers.Authorization || '').replace('Bearer ', ''));
    const a = dienstAntwoorden.openai;
    return { ok: a.ok, status: a.ok ? 200 : 401,
      text: async () => a.ok ? '{"data":[]}' : JSON.stringify({ error: { message: a.melding || 'Incorrect API key provided: ' + NEP_ANTHROPIC } }),
      json: async () => ({ data: [] }) };
  }

  return { ok: false, status: 404, text: async () => 'onbekend: ' + u, json: async () => ({}) };
};

function env(extra) {
  return Object.assign({
    SUPABASE_SERVICE_KEY: 'service-nep',
    SLEUTEL_MASTER: 'een lange willekeurige hoofdsleutel'
  }, extra || {});
}

function verzoek(pad, opties) {
  const o = Object.assign({ method: 'GET', headers: {} }, opties || {});
  const h = new Headers(o.headers);
  h.set('Origin', 'https://wellshave-adgen.netlify.app');
  return new Request('https://marketing-ads.workers.dev' + pad, { method: o.method, headers: h, body: o.body });
}

async function roep(pad, opties, extraEnv) {
  const r = await actieveWorker.fetch(verzoek(pad, opties), env(extraEnv), { waitUntil() {} });
  let data = null;
  try { data = JSON.parse(await r.text()); } catch (e) { data = {}; }
  return { status: r.status, data: data };
}

function alsAdmin(body) {
  return { method: 'POST', headers: { Authorization: 'Bearer baas', 'Content-Type': 'application/json' },
           body: body ? JSON.stringify(body) : undefined };
}

/* ── De lus ─────────────────────────────────────────────────────────────── */

await reset();
db.team_members = [
  { id: 'baas', status: 'approved', role: 'admin' },
  { id: 'teamlid', status: 'approved', role: 'member' }
];

console.log('\n  alleen een admin komt erbij');
/* Het menu verbergen in de console is netjes maar het is geen slot. Dit is
   het slot. */
const zonder = await roep('/systeem/sleutels', { headers: {} });
check('zonder inloggen: geweigerd', zonder.status, 401);
const lid = await roep('/systeem/sleutels', { headers: { Authorization: 'Bearer teamlid' } });
check('als teamlid: geweigerd', lid.status, 403);
check('met een reden die klopt', /alleen een admin/.test(lid.data.error || ''), true);
const lidZet = await roep('/systeem/sleutels',
  { method: 'POST', headers: { Authorization: 'Bearer teamlid' }, body: JSON.stringify({ naam: 'ANTHROPIC_KEY', waarde: NEP_ANTHROPIC }) });
check('en een teamlid kan er ook niets in zetten', lidZet.status, 403);
check('er staat dan ook niets in de database', db.systeem_geheimen.length, 0);

console.log('\n  de admin zet een sleutel');
const zet = await roep('/systeem/sleutels', alsAdmin({ naam: 'ANTHROPIC_KEY', waarde: NEP_ANTHROPIC }));
check('dat lukt', zet.status, 200);
check('en hij is meteen uitgeprobeerd', zet.data.proef && zet.data.proef.geldig, true);
check('er staat nu één rij', db.systeem_geheimen.length, 1);
check('met wie hem zette', db.systeem_geheimen[0].gezet_door, 'baas@wellshave.com');
check('en de staart om hem te herkennen', db.systeem_geheimen[0].staart, NEP_ANTHROPIC.slice(-4));

console.log('\n  en hij staat versleuteld, niet leesbaar');
/* Dit is de hele reden dat het niet gewoon een tabel met tekst is. Zou dit
   falen, dan is het probleem alleen verhuisd van de broncode naar Supabase. */
const rij = db.systeem_geheimen[0];
const alsTekst = JSON.stringify(rij);
check('de sleutel staat nergens leesbaar in de rij', alsTekst.includes(NEP_ANTHROPIC), false);
check('ook zijn staart-loze begin niet', alsTekst.includes('sk-ant-api03-AAAA'), false);
check('er is een cipher', !!rij.cipher, true);
check('en een eigen nonce', !!rij.nonce, true);

console.log('\n  twee keer dezelfde sleutel levert twee keer iets anders op');
/* Een vaste nonce zou betekenen dat gelijke sleutels gelijke cipher geven, en
   dan lekt de tabel of twee omgevingen dezelfde sleutel gebruiken. */
const eersteCipher = rij.cipher, eersteNonce = rij.nonce;
await roep('/systeem/sleutels', alsAdmin({ naam: 'OPENAI_KEY', waarde: NEP_ANTHROPIC }));
const tweede = db.systeem_geheimen.filter(r => r.naam === 'OPENAI_KEY')[0];
check('een andere nonce', tweede.nonce === eersteNonce, false);
check('en dus een andere cipher', tweede.cipher === eersteCipher, false);

console.log('\n  het scherm krijgt de sleutel nooit terug');
/* Ook niet als admin. Er is geen reden om een sleutel op een scherm te zetten:
   kunnen lezen levert alleen plekken op waar hij terechtkomt. */
const lijst = await roep('/systeem/sleutels', { headers: { Authorization: 'Bearer baas' } });
check('de lijst komt door', lijst.status, 200);
const lijstTekst = JSON.stringify(lijst.data);
check('zonder de sleutel erin', lijstTekst.includes(NEP_ANTHROPIC), false);
check('zonder de cipher erin', lijstTekst.includes(rij.cipher), false);
check('zonder de nonce erin', lijstTekst.includes(rij.nonce), false);
check('wel de staart', (lijst.data.sleutels[0] || {}).staart, NEP_ANTHROPIC.slice(-4));
check('en waar hij vandaan komt', (lijst.data.sleutels[0] || {}).bron, 'database');

console.log('\n  een halve of verkeerde sleutel wordt geweigerd');
/* De meest voorkomende fout is een half gekopieerde sleutel. Die opslaan
   betekent dat je er een dag later achter komt. */
const teKort = await roep('/systeem/sleutels', alsAdmin({ naam: 'ANTHROPIC_KEY', waarde: 'sk-ant-api03-AB' }));
check('te kort: geweigerd', teKort.status, 400);
check('met een bruikbare melding', /hele sleutel/.test(teKort.data.error || ''), true);
const verkeerdeDienst = await roep('/systeem/sleutels', alsAdmin({ naam: 'ANTHROPIC_KEY', waarde: NEP_OPENAI }));
check('een OpenAI-sleutel in het Anthropic-veld: geweigerd', verkeerdeDienst.status, 400);
/* En dezelfde controle voor de derde sleutel. Atria heeft een eigen voorvoegsel
   en zonder deze regels glipt elke tekst erdoor -- inclusief de melding
   "kopieer je sleutel" die iemand per ongeluk meeplakt. */
const atriaHalf = await roep('/systeem/sleutels', alsAdmin({ naam: 'ATRIA_API_KEY', waarde: 'atria-sk_AB' }));
check('een halve Atria-sleutel: geweigerd', atriaHalf.status, 400);
const atriaZonderVoorvoegsel = await roep('/systeem/sleutels', alsAdmin({ naam: 'ATRIA_API_KEY', waarde: 'D'.repeat(40) }));
check('en zonder het voorvoegsel ook', atriaZonderVoorvoegsel.status, 400);
const atriaGoed = await roep('/systeem/sleutels', alsAdmin({ naam: 'ATRIA_API_KEY', waarde: NEP_ATRIA }));
check('een hele Atria-sleutel gaat er wel in', atriaGoed.status, 200);
check('en is meteen uitgeprobeerd bij Atria', atriaGoed.data.proef && atriaGoed.data.proef.geldig, true);
check('met de sleutel die net gezet is', aanroepen.atria[aanroepen.atria.length - 1], NEP_ATRIA);
/* En de vierde. TrendTrack schrijft geen voorvoegsel voor, dus blijft alleen
   de lengte over -- en dat is precies waarom de melding hieronder apart
   gecontroleerd wordt: er is geen patroon waar een filter op kan aanslaan. */
const ttKort = await roep('/systeem/sleutels', alsAdmin({ naam: 'TRENDTRACK_API_KEY', waarde: 'abc123' }));
check('een te korte TrendTrack-sleutel: geweigerd', ttKort.status, 400);
const ttSpatie = await roep('/systeem/sleutels', alsAdmin({ naam: 'TRENDTRACK_API_KEY', waarde: NEP_TT.slice(0, 16) + ' ' + NEP_TT.slice(16) }));
check('en een met een spatie erin ook', ttSpatie.status, 400);
const ttGoed = await roep('/systeem/sleutels', alsAdmin({ naam: 'TRENDTRACK_API_KEY', waarde: NEP_TT }));
check('een hele TrendTrack-sleutel gaat er wel in', ttGoed.status, 200);
check('en is uitgeprobeerd bij TrendTrack', aanroepen.trendtrack[aanroepen.trendtrack.length - 1], 'Bearer ' + NEP_TT);

/* En de melding als hij niet deugt: een sleutel zonder voorvoegsel glipt door
   elk patroonfilter. Dit is een echte fout geweest -- de sleutel stond
   voluit in het antwoord op het scherm. */
dienstAntwoorden.trendtrack = { ok: false };
const ttProef = await roep('/systeem/sleutels/proef', alsAdmin());
check('de proef zegt dat hij niet geldig is', ttProef.data.TRENDTRACK_API_KEY.geldig, false);
check('en de sleutel staat niet in de reden',
  String(ttProef.data.TRENDTRACK_API_KEY.reden).indexOf(NEP_TT), -1);
check('terwijl de dienst hem wel meestuurde',
  JSON.stringify({ message: 'Invalid API key ' + NEP_TT }).indexOf(NEP_TT) > -1, true);

const onbekend = await roep('/systeem/sleutels', alsAdmin({ naam: 'STRIPE_KEY', waarde: NEP_OPENAI }));
check('een onbekende naam: geweigerd', onbekend.status, 400);
check('en de oude sleutel staat er nog', db.systeem_geheimen.filter(r => r.naam === 'ANTHROPIC_KEY')[0].staart, NEP_ANTHROPIC.slice(-4));

console.log('\n  zonder hoofdsleutel wordt er niets opgeslagen');
/* Anders zou de waarde alsnog ergens leesbaar belanden, of half. Weigeren met
   het commando erbij is de enige nuttige uitkomst. */
await reset();
db.team_members = [{ id: 'baas', status: 'approved', role: 'admin' }];
const zonderMaster = await worker.fetch(
  verzoek('/systeem/sleutels', alsAdmin({ naam: 'ANTHROPIC_KEY', waarde: NEP_ANTHROPIC })),
  { SUPABASE_SERVICE_KEY: 'service-nep' }, { waitUntil() {} });
const zmData = JSON.parse(await zonderMaster.text());
check('geweigerd', zonderMaster.status, 500);
check('met het commando erbij', /wrangler secret put SLEUTEL_MASTER/.test(zmData.error || ''), true);
check('en er staat niets in de database', db.systeem_geheimen.length, 0);

console.log('\n  de database wint van het Worker secret');
/* De volgorde is het hele punt: wat je op het scherm zet moet gebruikt
   worden, anders wissel je een sleutel en verandert er niets. */
await reset();
db.team_members = [{ id: 'baas', status: 'approved', role: 'admin' }];
await roep('/systeem/sleutels', alsAdmin({ naam: 'ANTHROPIC_KEY', waarde: NEP_ANTHROPIC_2 }),
  { ANTHROPIC_KEY: NEP_ANTHROPIC });
aanroepen.anthropic = [];
await roep('/anthropic', { method: 'POST', headers: { Authorization: 'Bearer baas' }, body: '{}' },
  { ANTHROPIC_KEY: NEP_ANTHROPIC });
check('de aanroep gebruikt de sleutel van het scherm', aanroepen.anthropic[0], NEP_ANTHROPIC_2);

console.log('\n  en zonder rij in de database valt hij terug op het secret');
/* Zodat een bestaande opzet blijft werken en dit een toevoeging is in plaats
   van een omschakeling met een moment waarop niets het doet. */
await reset();
db.team_members = [{ id: 'baas', status: 'approved', role: 'admin' }];
aanroepen.anthropic = [];
await roep('/anthropic', { method: 'POST', headers: { Authorization: 'Bearer baas' }, body: '{}' },
  { ANTHROPIC_KEY: NEP_ANTHROPIC });
check('de aanroep gebruikt het Worker secret', aanroepen.anthropic[0], NEP_ANTHROPIC);
const bron = await roep('/systeem/sleutels', { headers: { Authorization: 'Bearer baas' } }, { ANTHROPIC_KEY: NEP_ANTHROPIC });
check('en het scherm zegt waar hij vandaan komt',
  (bron.data.sleutels.filter(r => r.naam === 'ANTHROPIC_KEY')[0] || {}).bron, 'worker secret');

console.log('\n  ook het werk dat de worker zelf doet loopt op de nieuwe sleutel');
/* Zou claude() env.ANTHROPIC_KEY blijven lezen, dan wissel je de sleutel en
   werkt de console wel en de nachtelijke lus niet. Dat is de vervelendste
   soort storing: half. */
const bronTekst = await import('node:fs').then(fs =>
  fs.readFileSync(new URL('../marketing-os.worker.js', import.meta.url), 'utf8'));
/* Commentaar eerst weg, met de regelnummers intact. Zonder dat vangt deze
   controle de uitleg waarin staat waarom het niet meer zo hoort -- en dan
   faalt hij op zijn eigen documentatie. */
const zonderCommentaar = bronTekst
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, '');
const rechtstreeks = zonderCommentaar.split('\n')
  .map((r, i) => ({ r, i: i + 1 }))
  .filter(x => /env\.(ANTHROPIC_KEY|OPENAI_KEY)/.test(x.r));
check('geen enkele plek leest het secret nog rechtstreeks',
  rechtstreeks.map(x => x.i), []);

console.log('\n  de proef zegt of hij WERKT, niet of het veld gevuld is');
/* Dit is de les van de vorige ronde: het veld was gevuld, dus alles stond
   groen, terwijl de sleutel al ingetrokken was. */
await reset();
db.team_members = [{ id: 'baas', status: 'approved', role: 'admin' }];
dienstAntwoorden.anthropic = { ok: false, melding: 'invalid x-api-key' };
const proef = await roep('/systeem/sleutels/proef', alsAdmin(), { ANTHROPIC_KEY: NEP_ANTHROPIC, OPENAI_KEY: NEP_OPENAI });
check('de sleutel staat er wel', !!(await roep('/health', {})).data.koppelingen.claude, true);
check('maar de proef zegt: niet geldig', proef.data.ANTHROPIC_KEY.geldig, false);
check('met de reden van de dienst zelf', /invalid x-api-key/.test(proef.data.ANTHROPIC_KEY.reden || ''), true);
check('en de andere is wel geldig', proef.data.OPENAI_KEY.geldig, true);

console.log('\n  en een foutmelding van de dienst draagt nooit een sleutel');
/* Sommige diensten echoen de sleutel die je probeerde terug in hun melding.
   Ongefilterd doorgeven zet hem alsnog op het scherm. */
await reset();
db.team_members = [{ id: 'baas', status: 'approved', role: 'admin' }];
dienstAntwoorden.openai = { ok: false, melding: 'Incorrect API key provided: ' + NEP_ANTHROPIC };
const echo = await roep('/systeem/sleutels/proef', alsAdmin(), { OPENAI_KEY: NEP_OPENAI });
check('de melding komt door', /Incorrect API key/.test(echo.data.OPENAI_KEY.reden || ''), true);
check('maar zonder de sleutel erin', (echo.data.OPENAI_KEY.reden || '').includes(NEP_ANTHROPIC), false);
check('er staat iets neutraals in de plaats', /<sleutel>/.test(echo.data.OPENAI_KEY.reden || ''), true);

console.log('');
console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
process.exit(fout > 0 ? 1 : 0);
