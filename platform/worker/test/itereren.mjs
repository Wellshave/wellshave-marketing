/* Testlus voor de bronlaag van het itereren.
 *
 * Aanleiding: itereren begon met een formulier van dertig velden die je met de
 * hand overtikte uit Ads Manager. Nu komen de cijfers uit de bron -- Atria of
 * Meta -- en dat verplaatst het risico. Niet meer "iemand tikt een komma
 * verkeerd", maar vijf fouten die alle vijf stil zijn:
 *
 *   1. ONBEKEND WORDT NUL. De bron gaf de maat niet, en in beeld staat 0. Dan
 *      lijkt "we weten het niet" op "het is nul keer gebeurd" -- en op dat
 *      laatste bouw je een iteratie die het verkeerde probleem oplost.
 *
 *   2. DE TWEE BRONNEN LEVEREN VERSCHILLENDE VORMEN. Dan werkt de wizard bij
 *      Atria wel en bij Meta half, en je merkt het pas op het scherm.
 *
 *   3. ER WORDT GEOORDEELD ZONDER NORM. Een advertentie afrekenen op een norm
 *      die je niet hebt is precies hoe je een gezonde advertentie weggooit.
 *
 *   4. RUIS ZIET ERUIT ALS EEN OORDEEL. Een conversiepercentage op zeven
 *      klikken is geen conversiepercentage.
 *
 *   5. HET LEK ZIT NA DE KLIK EN ER WORDT TOCH EEN CREATIVE GEMAAKT. Drie
 *      nieuwe advertenties die precies even hard lekken. Dit is de duurste van
 *      de vijf en de enige die er productief uitziet terwijl hij gebeurt.
 *
 *   node platform/worker/test/itereren.mjs
 */

let versieteller = 0;
async function verseWorker() {
  versieteller++;
  const m = await import('../marketing-os.worker.js?i=' + versieteller);
  return m.default;
}
let actieveWorker = null;

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

/* Een sleutel die nergens van is: opgebouwd uit een herhaald teken. */
const NEP_ATRIA = 'atria-sk_' + 'A'.repeat(32);

/* ── De nagebootste wereld ──────────────────────────────────────────────── */

let db, atria, meta, aanroepen;

async function reset() {
  actieveWorker = await verseWorker();
  db = { systeem_geheimen: [], team_members: [{ id: 'baas', status: 'approved', role: 'admin' }], ad_accounts: [] };
  atria = { accounts: null, ads: null, ad: null, summary: null, metrics: null, fout: null };
  meta = { ad: null, account: null, creative: null, creativeGooit: false, fout: null };
  aanroepen = { atria: [], meta: [] };
}

globalThis.fetch = async (url, opties) => {
  const u = String(url);
  const m = (opties && opties.method) || 'GET';

  if (u.includes('/auth/v1/user')) {
    const t = (opties.headers.Authorization || '').replace('Bearer ', '');
    if (!t || t === 'geen') return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ id: t, email: t + '@wellshave.com' }) };
  }
  if (u.includes('/rest/v1/team_members')) {
    const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
    return { ok: true, json: async () => db.team_members.filter(r => r.id === id) };
  }
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
    return { ok: true, json: async () => (naam ? db.systeem_geheimen.filter(r => r.naam === naam) : db.systeem_geheimen) };
  }
  if (u.includes('/rest/v1/ad_accounts')) {
    return { ok: true, json: async () => db.ad_accounts };
  }

  /* Atria. */
  if (u.includes('api.tryatria.com')) {
    aanroepen.atria.push({ url: u, sleutel: opties.headers['X-API-Key'] });
    if (atria.fout) return atria.fout;
    const envelop = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ code: 0, message: 'ok', data }) });
    if (/\/ad-accounts$/.test(u.split('?')[0])) return envelop({ items: atria.accounts || [] });
    if (/\/metrics$/.test(u.split('?')[0])) return envelop({ items: atria.metrics || [] });
    if (/\/summary$/.test(u.split('?')[0])) return envelop(atria.summary || {});
    if (/\/ads\/[^/?]+$/.test(u.split('?')[0])) return envelop(atria.ad || {});
    if (/\/ads$/.test(u.split('?')[0])) return envelop({ items: atria.ads || [] });
    return { ok: false, status: 404, text: async () => '{}' };
  }

  /* Meta. */
  if (u.includes('graph.facebook.com')) {
    aanroepen.meta.push(u);
    if (meta.fout) return meta.fout;
    if (u.includes('/insights')) {
      const niveau = (u.match(/level=([a-z]+)/) || [])[1];
      return { ok: true, json: async () => ({ data: niveau === 'account' ? (meta.account || []) : (meta.ad || []) }) };
    }
    /* Het netwerk dat eruit ligt is iets anders dan een dienst die 'niet
       gevonden' zegt: het eerste gooit, het tweede antwoordt. Zonder allebei
       blijft het ene pad ongetest. */
    if (meta.creativeGooit) throw new Error('getaddrinfo ENOTFOUND graph.facebook.com');
    return { ok: true, json: async () => (meta.creative || { error: { message: 'niet gevonden' } }) };
  }

  return { ok: false, status: 404, text: async () => 'onbekend: ' + u, json: async () => ({}) };
};

function env(extra) {
  return Object.assign({
    SUPABASE_SERVICE_KEY: 'service-nep',
    SLEUTEL_MASTER: 'een lange willekeurige hoofdsleutel',
    ATRIA_API_KEY: NEP_ATRIA
  }, extra || {});
}

async function roep(pad, opties, extraEnv) {
  const o = Object.assign({ method: 'GET', headers: { Authorization: 'Bearer baas' } }, opties || {});
  const h = new Headers(o.headers);
  h.set('Origin', 'https://wellshave-adgen.netlify.app');
  const req = new Request('https://marketing-ads.workers.dev' + pad, { method: o.method, headers: h, body: o.body });
  const r = await actieveWorker.fetch(req, env(extraEnv), { waitUntil() { } });
  let data = null;
  try { data = JSON.parse(await r.text()); } catch (e) { data = {}; }
  return { status: r.status, data: data };
}

/* Een advertentie zoals Atria hem geeft: maten met een id, plus de namen. */
function atriaAd(over) {
  return Object.assign({
    platform_ad_id: '120001', name: 'WS - 160 - 1', status: 'ACTIVE',
    thumbnail_url: 'https://beeld/1.jpg',
    metrics: {
      spend: 241.15, impressions: 40270, reach: 28000, link_clicks: 542,
      landing_page_views: 384, add_to_cart: 41, purchases: 22,
      purchase_value: 1341.56, cpm: 5.99
    },
    metric_names: {
      spend: 'Spend', impressions: 'Impressions', reach: 'Reach', link_clicks: 'Link Clicks',
      landing_page_views: 'Landing Page Views', add_to_cart: 'Adds to Cart',
      purchases: 'Purchases', purchase_value: 'Purchase Value', cpm: 'CPM'
    }
  }, over || {});
}

/* En zoals Meta hem geeft: platte velden plus acties in een lijst. */
function metaAd(over) {
  return Object.assign({
    ad_id: '120001', ad_name: 'WS - 160 - 1',
    spend: '241.15', impressions: '40270', reach: '28000',
    /* Twee soorten klik, en het verschil is groot: `clicks` telt alles mee wat
       aanklikbaar is -- likes, de profielnaam, "meer weergeven" -- en
       `inline_link_clicks` alleen de klik die naar de site gaat. Wie de eerste
       gebruikt krijgt een CTR die er ruim twee keer zo goed uitziet als hij is,
       en dan wijst de diagnose het verkeerde lek aan. */
    clicks: '1204', inline_link_clicks: '542',
    ctr: '1.35', cpc: '0.44', cpm: '5.99',
    actions: [
      { action_type: 'landing_page_view', value: '384' },
      { action_type: 'omni_add_to_cart', value: '41' },
      { action_type: 'omni_purchase', value: '22' }
    ],
    action_values: [{ action_type: 'omni_purchase', value: '1341.56' }]
  }, over || {});
}

/* ── De lus ─────────────────────────────────────────────────────────────── */

await reset();

console.log('\n  de bron zit achter de login');
/* Welke advertenties er draaien en wat ze kosten is een gegeven over het
   bedrijf. Dat hoort niet op een open endpoint. */
const dicht = await roep('/itereren/bronnen', { headers: {} });
check('zonder inloggen: geweigerd', dicht.status, 401);

console.log('\n  welke bronnen bruikbaar zijn, en waarom niet');
atria.accounts = [{ id: 'aaaa1111', ad_account_id: 'act_242238038391551', name: 'Wellshave NL', platform: 'facebook', currency: 'EUR', status: 'active' }];
db.ad_accounts = [{ account_id: 'act_242238038391551', naam: 'Wellshave NL', merk: 'wellshave', actief: true }];
const bronnen = (await roep('/itereren/bronnen', {}, { META_ACCESS_TOKEN: 'meta-nep' })).data.bronnen;
check('er zijn twee bronnen', bronnen.map(b => b.bron), ['atria', 'meta']);
check('Atria is bruikbaar', bronnen[0].bruikbaar, true);
check('met het account erbij', bronnen[0].accounts[0].naam, 'Wellshave NL');
check('Meta ook', bronnen[1].bruikbaar, true);

await reset();
atria.accounts = [];
const zonderSleutel = (await roep('/itereren/bronnen', {}, { ATRIA_API_KEY: null })).data.bronnen;
/* Een bron die niet werkt hoort te zeggen waarom. "Niet bruikbaar" zonder
   reden stuurt iemand de verkeerde kant op -- naar de worker in plaats van
   naar de sleutel. */
check('zonder sleutel is Atria niet bruikbaar', zonderSleutel[0].bruikbaar, false);
check('en de reden staat erbij', /ATRIA_API_KEY/.test(zonderSleutel[0].reden || ''), true);
check('zonder token is Meta niet bruikbaar', zonderSleutel[1].bruikbaar, false);
check('ook met een reden', /META_ACCESS_TOKEN/.test(zonderSleutel[1].reden || ''), true);

console.log('\n  twee bronnen, een vorm');
await reset();
atria.ads = [atriaAd()];
meta.ad = [metaAd()];
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
const viaAtria = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30')).data;
const viaMeta = (await roep('/itereren/advertenties?bron=meta&account=act_1&dagen=30', {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
const aA = viaAtria.advertenties[0], aM = viaMeta.advertenties[0];
check('allebei een advertentie', [viaAtria.advertenties.length, viaMeta.advertenties.length], [1, 1]);
check('dezelfde buitenste velden', Object.keys(aA).sort(), Object.keys(aM).sort());
check('dezelfde maten', Object.keys(aA.cijfers).sort(), Object.keys(aM.cijfers).sort());
check('dezelfde naam', [aA.naam, aM.naam], ['WS - 160 - 1', 'WS - 160 - 1']);
/* En de cijfers komen ook echt op hetzelfde uit. Dit is de controle die
   ontdekt dat een van de twee een veld verkeerd leest: de vormen kunnen gelijk
   zijn terwijl de inhoud dat niet is. */
check('en dezelfde uitgave', [aA.cijfers.spend, aM.cijfers.spend], [241.15, 241.15]);
check('dezelfde aankopen', [aA.cijfers.aankopen, aM.cijfers.aankopen], [22, 22]);
check('dezelfde omzet', [aA.cijfers.omzet, aM.cijfers.omzet], [1341.56, 1341.56]);
check('en dezelfde ROAS, uitgerekend uit die twee',
  [Math.round(aA.cijfers.roas * 100), Math.round(aM.cijfers.roas * 100)], [556, 556]);
/* En de klik: Meta geeft er twee soorten en alleen de linkklik telt. Deze
   advertentie heeft 1204 kliks totaal en 542 naar de site. */
check('allebei de linkklik, niet alle kliks', [aA.cijfers.klikken, aM.cijfers.klikken], [542, 542]);

console.log('\n  onbekend is null, nooit nul');
/* Dit is de fout die er het onschuldigst uitziet. Een 0 in een cijferveld is
   een meting; een lege maat is dat niet. Wie ze door elkaar haalt gaat het
   verkeerde lek dichten. */
await reset();
atria.ads = [atriaAd({ metrics: { spend: 100, impressions: 5000 }, metric_names: { spend: 'Spend', impressions: 'Impressions' } })];
const kaal = (await roep('/itereren/advertenties?bron=atria&account=a1')).data.advertenties[0];
check('geen aankopen gemeten, dus null', kaal.cijfers.aankopen, null);
check('geen omzet, dus null', kaal.cijfers.omzet, null);
check('en dan ook geen ROAS', kaal.cijfers.roas, null);
check('en geen orderwaarde', kaal.cijfers.aov, null);
check('geen klikken, dus geen CTR', kaal.cijfers.ctr, null);
/* Wat er wel is wordt wel uitgerekend: CPM uit uitgave en vertoningen. */
check('maar CPM kan wel uit wat er staat', kaal.cijfers.cpm, 20);

console.log('\n  een maat die anders heet wordt op naam gevonden');
/* Atria laat gebruikers maten hernoemen en accounts hebben eigen conversies.
   Het id is de betrouwbare sleutel, maar als dat afwijkt is de naam de laatste
   kans -- beter dan een leeg veld waar een cijfer hoort. */
await reset();
atria.ads = [atriaAd({
  metrics: { spend: 100, impressions: 10000, fb_cc_9912: 25, vreemd_id: 500 },
  metric_names: { spend: 'Spend', impressions: 'Impressions', fb_cc_9912: 'Purchases', vreemd_id: 'Link Clicks' }
})];
const opNaam = (await roep('/itereren/advertenties?bron=atria&account=a1')).data.advertenties[0];
check('de aankopen zijn gevonden op naam', opNaam.cijfers.aankopen, 25);
check('de klikken ook', opNaam.cijfers.klikken, 500);
/* En de grens: een maat die er onder geen enkele naam is blijft leeg. Er wordt
   niets overgenomen uit iets wat er toevallig op lijkt. */
check('een maat die er niet is blijft null', opNaam.cijfers.atc, null);

console.log('\n  de diagnose wijst het lek aan');
await reset();
atria.ad = atriaAd();
/* De norm: het account over hetzelfde venster. Deze advertentie klikt beter
   dan gemiddeld en rekent beter af, maar op de pagina blijft hij achter. */
atria.summary = {
  metrics: { spend: 5000, impressions: 800000, link_clicks: 8000, landing_page_views: 7000, add_to_cart: 1400, purchases: 700, purchase_value: 42000, cpm: 6.25 },
  metric_names: { spend: 'Spend', impressions: 'Impressions', link_clicks: 'Link Clicks', landing_page_views: 'Landing Page Views', add_to_cart: 'Adds to Cart', purchases: 'Purchases', purchase_value: 'Purchase Value', cpm: 'CPM' }
};
const diag = (await roep('/itereren/advertentie?bron=atria&account=a1&id=120001&dagen=30')).data;
check('de advertentie komt mee', diag.advertentie.naam, 'WS - 160 - 1');
check('en de copy erbij', diag.advertentie.copy !== null, true);
check('er is een norm', diag.norm !== null, true);
check('het knelpunt is de pagina', diag.diagnose.knelpunt, 'pagina');
const stap = diag.diagnose.stappen.filter(s => s.sleutel === 'pagina')[0];
check('die stap heet wat hij is', stap.label, 'Landingspagina naar winkelwagen');
check('en staat op zwak', stap.oordeel, 'zwak');
check('de aandacht juist op sterk', diag.diagnose.stappen.filter(s => s.sleutel === 'aandacht')[0].oordeel, 'sterk');

console.log('\n  en zegt eerlijk of een creative het oplost');
/* De duurste fout van de vijf: het lek zit op de pagina, er worden drie nieuwe
   hooks gemaakt, en die lekken alle drie even hard. */
check('bij een lek op de pagina: geen creative-opdracht', diag.diagnose.wat_testen.creative, false);
check('en dat staat er met zoveel woorden',
  /lost dit niet op/.test(diag.diagnose.wat_testen.zeg), true);
check('er wordt dus ook niets voorgesteld om te varieren', diag.diagnose.wat_testen.varieer, []);

console.log('\n  zonder norm geen oordeel');
/* Een advertentie afrekenen op een norm die je niet hebt is precies hoe je een
   gezonde advertentie weggooit. */
await reset();
atria.ad = atriaAd();
atria.fout = null;
atria.summary = { metrics: {}, metric_names: {} };
const zonderNorm = (await roep('/itereren/advertentie?bron=atria&account=a1&id=120001')).data;
check('geen knelpunt', zonderNorm.diagnose.knelpunt, null);
check('geen enkele stap krijgt een oordeel',
  zonderNorm.diagnose.stappen.filter(s => s.oordeel !== null).length, 0);
check('en de reden zegt dat er niets te meten viel',
  /te weinig data of geen norm/.test(zonderNorm.diagnose.reden), true);

console.log('\n  te weinig data is een uitslag, geen oordeel');
await reset();
/* Dezelfde verhoudingen als hierboven, maar op een honderdste van het volume.
   Een conversiepercentage op zeven klikken is geen conversiepercentage. */
atria.ad = atriaAd({ metrics: { spend: 2.41, impressions: 402, link_clicks: 5, landing_page_views: 4, add_to_cart: 1, purchases: 0, purchase_value: 0, cpm: 5.99 },
  metric_names: { spend: 'Spend', impressions: 'Impressions', link_clicks: 'Link Clicks', landing_page_views: 'Landing Page Views', add_to_cart: 'Adds to Cart', purchases: 'Purchases', purchase_value: 'Purchase Value', cpm: 'CPM' } });
atria.summary = {
  metrics: { spend: 5000, impressions: 800000, link_clicks: 8000, landing_page_views: 7000, add_to_cart: 1400, purchases: 700, purchase_value: 42000, cpm: 6.25 },
  metric_names: { spend: 'Spend', impressions: 'Impressions', link_clicks: 'Link Clicks', landing_page_views: 'Landing Page Views', add_to_cart: 'Adds to Cart', purchases: 'Purchases', purchase_value: 'Purchase Value', cpm: 'CPM' }
};
const dun = (await roep('/itereren/advertentie?bron=atria&account=a1&id=120001')).data;
const paginaDun = dun.diagnose.stappen.filter(s => s.sleutel === 'pagina')[0];
check('de stap heeft wel een waarde', paginaDun.waarde !== null, true);
check('maar te weinig eronder', paginaDun.genoeg_data, false);
check('dus geen oordeel', paginaDun.oordeel, null);
check('en hij wordt geen knelpunt', dun.diagnose.knelpunt, null);

console.log('\n  een advertentie die nergens onder de norm zit heeft geen lek');
await reset();
atria.ad = atriaAd();
atria.summary = {
  metrics: { spend: 5000, impressions: 800000, link_clicks: 4000, landing_page_views: 2000, add_to_cart: 100, purchases: 20, purchase_value: 1000, cpm: 12 },
  metric_names: { spend: 'Spend', impressions: 'Impressions', link_clicks: 'Link Clicks', landing_page_views: 'Landing Page Views', add_to_cart: 'Adds to Cart', purchases: 'Purchases', purchase_value: 'Purchase Value', cpm: 'CPM' }
};
const winnaar = (await roep('/itereren/advertentie?bron=atria&account=a1&id=120001')).data;
check('geen knelpunt', winnaar.diagnose.knelpunt, null);
/* En dat is iets anders dan "we konden niets meten". Op een scherm zien die
   twee er hetzelfde uit als de reden ontbreekt. */
check('maar er is wel degelijk gemeten', winnaar.diagnose.meetbaar > 0, true);
check('en de reden is dat hij het gewoon goed doet',
  /geen enkele stap zit onder het accountgemiddelde/.test(winnaar.diagnose.reden), true);

console.log('\n  CPM telt andersom');
/* De enige maat waar laag beter is. Dit is precies het soort ding dat je een
   keer omdraait en dan wijst de diagnose de goedkoopste advertentie aan als
   probleem. */
const inkoop = winnaar.diagnose.stappen.filter(s => s.sleutel === 'inkoop')[0];
check('deze advertentie koopt goedkoper in dan het account', inkoop.waarde < inkoop.norm, true);
check('en dat heet sterk, niet zwak', inkoop.oordeel, 'sterk');

console.log('\n  een fout van de bron is een fout van de bron');
await reset();
atria.fout = { ok: false, status: 401, text: async () => JSON.stringify({ error: 'invalid_api_key', message: 'The provided API key is invalid' }) };
const stuk = await roep('/itereren/advertenties?bron=atria&account=a1');
check('het antwoord is 502, niet 200 met een lege lijst', stuk.status, 502);
check('en zegt welke bron het was', stuk.data.bron, 'atria');
check('met de melding van de dienst erbij', /invalid/i.test(stuk.data.error), true);

console.log('\n  een envelop met een foutcode is geen succes');
/* Atria pakt fouten in dezelfde 200 als successen. Alleen naar de HTTP-status
   kijken laat die erdoorheen, en dan krijgt het scherm een lege lijst zonder
   uitleg -- de vervelendste vorm, want alles ziet er goed uit. */
await reset();
atria.fout = { ok: true, status: 200, text: async () => JSON.stringify({ code: 40401, message: 'account not found', data: null }) };
const envelop = await roep('/itereren/advertenties?bron=atria&account=onbekend');
check('ook dit is een fout', envelop.status, 502);
check('met de melding uit de envelop', /account not found/.test(envelop.data.error), true);

console.log('\n  de sleutel komt nergens in beeld');
/* Sommige diensten echoen de sleutel terug in hun foutmelding. Doorgeven wat
   de dienst zei zet hem dan alsnog op een scherm, in een logboek en in een
   screenshot. */
await reset();
atria.fout = { ok: false, status: 401, text: async () => JSON.stringify({ error: 'invalid_api_key', message: 'The provided API key ' + NEP_ATRIA + ' is invalid' }) };
const lek = await roep('/itereren/advertenties?bron=atria&account=a1');
check('de sleutel staat niet in de melding', lek.data.error.indexOf(NEP_ATRIA), -1);
check('er staat wel dat er iets met de sleutel is', /<sleutel>|invalid/i.test(lek.data.error), true);
/* En de zelfcontrole: staat de sleutel er wel in als je hem niet maskeert?
   Zonder dit blijft dit blok ook groen als de melding leeg is. */
check('de nepsleutel zat werkelijk in het antwoord van de dienst',
  (await atria.fout.text()).indexOf(NEP_ATRIA) > -1, true);

console.log('\n  de bron wordt gecontroleerd, niet doorgegeven');
await reset();
const rare = await roep('/itereren/advertenties?bron=stiekem&account=a1');
check('een onbekende bron wordt geweigerd', rare.status, 400);
check('er is niets naar buiten gegaan', aanroepen.atria.length + aanroepen.meta.length, 0);

console.log('\n  de norm komt uit hetzelfde venster als de advertentie');
/* Twee vensters vergelijken is geen vergelijking: dan meet je het verschil
   tussen juli en augustus en noemt het een oordeel over de creative. */
await reset();
atria.ad = atriaAd();
atria.summary = { metrics: { spend: 1 }, metric_names: { spend: 'Spend' } };
await roep('/itereren/advertentie?bron=atria&account=a1&id=120001&dagen=7');
const periodes = aanroepen.atria.map(a => (a.url.match(/period=([a-z0-9_]+)/) || [])[1]);
check('twee aanroepen, allebei hetzelfde venster', periodes, ['last_7d', 'last_7d']);

console.log('\n  Meta valt niet om als de creative niet op te halen is');
/* Geen beeld is vervelend. Geen cijfers is fataal, en die hebben we al. */
await reset();
meta.ad = [metaAd()];
meta.creative = { error: { message: 'niet gevonden' } };
db.ad_accounts = [{ account_id: 'act_1', naam: 'x', actief: true }];
const zonderBeeld = await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001', {}, { META_ACCESS_TOKEN: 'meta-nep' });
check('de advertentie komt gewoon door', zonderBeeld.status, 200);
check('met zijn cijfers', zonderBeeld.data.advertentie.cijfers.spend, 241.15);
check('maar zonder beeld', zonderBeeld.data.advertentie.beeld, null);

/* En hetzelfde als het netwerk er halverwege uit ligt. Dit is een ander pad
   door dezelfde functie: 'niet gevonden' is een antwoord, een netwerkfout is
   er geen. Zonder deze controle kan het vangnet eruit zonder dat iets rood
   wordt. */
await reset();
meta.ad = [metaAd()];
meta.creativeGooit = true;
db.ad_accounts = [{ account_id: 'act_1', naam: 'x', actief: true }];
const netwerkWeg = await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001', {}, { META_ACCESS_TOKEN: 'meta-nep' });
check('ook bij een netwerkfout komt de advertentie door', netwerkWeg.status, 200);
check('nog steeds met zijn cijfers', netwerkWeg.data.advertentie.cijfers.aankopen, 22);
check('en de diagnose is er ook', netwerkWeg.data.diagnose !== undefined, true);

console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
process.exit(fout ? 1 : 0);
