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
  meta = { ad: null, adVorig: null, account: null, creative: null, video: null, creativeGooit: false, fout: null, filterLeeg: false };
  aanroepen = { atria: [], meta: [], vensters: [], gefilterd: 0 };
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
      /* Welk venster er gevraagd is. De vorige periode is een tweede aanroep
         met een ander time_range -- en als de nabootsing daar hetzelfde op
         antwoordt, meet je een trend van precies 1,00 en ziet alles er stabiel
         uit terwijl er niets vergeleken is. */
      let venster = {};
      try { venster = JSON.parse(decodeURIComponent((u.match(/time_range=([^&]+)/) || [])[1] || '{}')); } catch (e) { }
      const vandaag = new Date().toISOString().slice(0, 10);
      const isVorig = venster.until && venster.until !== vandaag;
      if (isVorig) aanroepen.vensters.push(venster);
      else if (venster.since) aanroepen.vensters.push(venster);
      if (niveau === 'account') return { ok: true, json: async () => ({ data: meta.account || [] }) };
      /* Gefilterd op één advertentie, of de hele lijst. Meta's filter op ad.id
         geeft in de praktijk soms een lege set terug waar de ongefilterde
         opvraag hem wél toont -- en dat is precies het geval dat we moeten
         kunnen nabootsen. */
      const gefilterd = /filtering=/.test(u);
      if (gefilterd) aanroepen.gefilterd++;
      if (gefilterd && meta.filterLeeg) return { ok: true, json: async () => ({ data: [] }) };
      return { ok: true, json: async () => ({ data: (isVorig ? meta.adVorig : meta.ad) || [] }) };
    }
    /* Het netwerk dat eruit ligt is iets anders dan een dienst die 'niet
       gevonden' zegt: het eerste gooit, het tweede antwoordt. Zonder allebei
       blijft het ene pad ongetest. */
    if (meta.creativeGooit) throw new Error('getaddrinfo ENOTFOUND graph.facebook.com');
    /* De tweede opvraag: het afspeelbare adres van de video. Die loopt over
       hetzelfde pad maar vraagt om andere velden. */
    if (/fields=source/.test(u)) {
      return { ok: true, json: async () => (meta.video || { error: { message: 'niet gevonden' } }) };
    }
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

console.log('\n  daalt hij? dat is een vergelijking, geen eigenschap');
/* "Dalende prestaties" bestaat niet op één advertentie in één venster. Het is
   dit venster tegen het vorige, en zonder dat vorige venster is elk pijltje
   omlaag verzonnen. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [
  metaAd(),
  metaAd({ ad_id: '120003', ad_name: 'WS - 158 - 4', spend: '512.40',
           action_values: [{ action_type: 'omni_purchase', value: '1076.04' }] }),
  /* Deze bestond vorige periode nog niet. */
  metaAd({ ad_id: '120009', ad_name: 'WS - 170 - nieuw' })
];
meta.adVorig = [
  metaAd({ action_values: [{ action_type: 'omni_purchase', value: '1200.00' }] }),
  metaAd({ ad_id: '120003', ad_name: 'WS - 158 - 4', spend: '512.40',
           action_values: [{ action_type: 'omni_purchase', value: '2152.08' }] })
];
const metTrend = (await roep('/itereren/advertenties?bron=meta&account=act_1&dagen=30&vergelijk=1',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
const perId = {};
metTrend.advertenties.forEach(a => { perId[a.id] = a; });
check('de vergelijking is beschikbaar', metTrend.trend_beschikbaar, true);
check('een advertentie die halveerde staat op 0,5', Math.round(perId['120003'].trend.roas * 100) / 100, 0.5);
check('en eentje die iets steeg staat boven 1', perId['120001'].trend.roas > 1, true);
/* Geen vorige periode is geen vlakke lijn. Een advertentie die vorige week nog
   niet bestond hoort niet als "stabiel" in de lijst en al helemaal niet als
   "dalend": dan wordt een lancering een probleem. */
check('wie vorige periode niet bestond heeft geen trend', perId['120009'].trend, null);
check('en ook geen vorige cijfers', perId['120009'].vorige, null);

/* De twee vensters raken elkaar en overlappen niet. Overlap zou de daling
   deels tegen zichzelf wegstrepen -- dan meet je hem wel, maar te klein. */
const vensters = aanroepen.vensters.filter(v => v.since);
check('er zijn twee vensters bevraagd', vensters.length >= 2, true);
const nu = vensters[0], toen = vensters[1];
check('het tweede venster ligt vóór het eerste', toen.until < nu.since, true);
check('en ze sluiten op elkaar aan',
  Math.round((new Date(nu.since) - new Date(toen.until)) / 86400000), 1);

console.log('\n  zonder de vraag geen tweede aanroep');
/* De vorige periode is een extra aanroep bij Meta. Die hoef je niet te doen om
   een lijst te tonen, dus gebeurt hij alleen als ernaar gevraagd is. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd()];
meta.adVorig = [metaAd()];
const zonder = (await roep('/itereren/advertenties?bron=meta&account=act_1&dagen=30',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
check('één aanroep', aanroepen.meta.filter(u => u.includes('/insights')).length, 1);
check('en geen trendveld', zonder.advertenties[0].trend, undefined);

console.log('\n  een deling door nul wordt geen pijl omhoog');
/* Van niets naar iets is geen percentage. Een vorige ROAS van nul die als
   deler doorgaat levert oneindig op, en oneindig wordt op het scherm een
   advertentie die het spectaculair goed doet. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd()];
meta.adVorig = [metaAd({ action_values: [{ action_type: 'omni_purchase', value: '0' }] })];
const nul = (await roep('/itereren/advertenties?bron=meta&account=act_1&dagen=30&vergelijk=1',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
check('geen trend uit een nul', nul.advertenties[0].trend.roas, null);
check('maar de vorige cijfers staan er wel', nul.advertenties[0].vorige.roas, 0);

console.log('\n  een bron die het niet kan zegt dat, in plaats van niets');
/* Atria kent alleen vaste periodes. Een lijst zonder trend die er hetzelfde
   uitziet als een lijst waarin niets daalt, is precies de geruststelling die
   we niet gemeten hebben. */
await reset();
atria.ads = [atriaAd()];
const viaAtriaTrend = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30&vergelijk=1')).data;
check('geen vergelijking bij Atria', viaAtriaTrend.trend_beschikbaar, false);
check('met de reden erbij', /vaste periodes/.test(viaAtriaTrend.trend_reden || ''), true);
check('en geen verzonnen trend op de advertentie', viaAtriaTrend.advertenties[0].trend, undefined);

console.log('\n  het beeld wordt gevonden waar het staat, niet waar wij het verwachtten');
/* Dit stond letterlijk op het scherm: "geen beeld bij deze advertentie",
   terwijl Atria het adres gewoon meestuurde -- onder een naam die de uitlezer
   niet probeerde. Drie vaste veldnamen zijn geen uitlezer maar een gok. */
await reset();
atria.ads = [atriaAd({ thumbnail_url: null,
  creative: { preview_url: null, resizedImageUrl: 'https://cdn.ergens/ad-9.jpg' } })];
const diep = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30')).data;
check('het beeld komt uit een genest veld', diep.advertenties[0].beeld, 'https://cdn.ergens/ad-9.jpg');

/* En een adres op een host die wij (nog) niet ophalen gaat WEL mee. Hem hier
   wegfilteren zou "de bron gaf geen beeldadres" opleveren terwijl er een adres
   stond -- dan zoek je aan de verkeerde kant. De beeldpoort weigert hem
   verderop en zegt dat; dan weet je welke host erbij moet. */
await reset();
atria.ads = [atriaAd({ thumbnail_url: 'https://een-host-die-wij-niet-kennen.nl/1.jpg' })];
const vreemd = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30')).data;
check('een onbekende host wordt niet stil weggelaten',
  vreemd.advertenties[0].beeld, 'https://een-host-die-wij-niet-kennen.nl/1.jpg');

/* En als laatste redmiddel elk adres in de rij dat op een host staat waar wij
   beelden vandaan halen -- ook onder een naam die we niet kennen. Dit is de
   grofste greep en hij mag alleen grof zijn omdat de hostlijst hem tegenhoudt. */
await reset();
atria.ads = [atriaAd({ thumbnail_url: null,
  snapshot: { een_veld_dat_wij_niet_kennen: 'https://x.fbcdn.net/laatste.jpg' } })];
const laatste = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30')).data;
check('een onbekende naam op een bekende host wordt alsnog gevonden',
  laatste.advertenties[0].beeld, 'https://x.fbcdn.net/laatste.jpg');

/* Een video is geen beeld. Een mp4 in een <img> is een zwart vlak. */
await reset();
atria.ads = [atriaAd({ thumbnail_url: null, video_url: 'https://cdn.ergens/ad-9.mp4' })];
const bewegend = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30')).data;
check('de video staat apart', bewegend.advertenties[0].video, 'https://cdn.ergens/ad-9.mp4');
check('en het beeld blijft leeg', bewegend.advertenties[0].beeld, null);

/* En andersom: een veld dat "media" heet hoeft geen video te bevatten. Wie
   daar niet op de extensie kijkt zet een jpg in een <video> en een still in de
   speler -- en dan is er geen beeld meer waar er wel een was. */
await reset();
atria.ads = [atriaAd({ thumbnail_url: null, mediaUrl: 'https://cdn.ergens/still.jpg' })];
const mediaJpg = (await roep('/itereren/advertenties?bron=atria&account=aaaa1111&dagen=30')).data;
check('een jpg in een mediaveld blijft een beeld',
  mediaJpg.advertenties[0].beeld, 'https://cdn.ergens/still.jpg');
check('en wordt geen video', mediaJpg.advertenties[0].video, null);

console.log('\n  komt er niets uit, dan zegt de rij welke velden hij wel had');
/* "Geen beeld" en "verkeerd gezocht" zien er op het scherm identiek uit en
   vragen om iets heel anders. Alleen de namen gaan mee, nooit de inhoud: een
   advertentietekst hoort niet in een diagnostisch veld. */
await reset();
atria.ad = { platform_ad_id: '120001', name: 'Zonder beeld', status: 'ACTIVE',
  snapshot: { onbekend_veld: 'x' }, metrics: {}, metric_names: {} };
const geenBeeld = (await roep('/itereren/advertentie?bron=atria&account=aaaa1111&id=120001')).data;
check('er kwam geen beeld uit', geenBeeld.advertentie.beeld, null);
check('en de veldnamen staan in het antwoord',
  (geenBeeld.advertentie.velden_zonder_beeld || []).indexOf('snapshot.onbekend_veld') > -1, true);
check('de inhoud niet', JSON.stringify(geenBeeld.advertentie.velden_zonder_beeld || []).indexOf('"x"'), -1);

/* En de tegenproef: komt er wel een beeld uit, dan staat het veld er niet. Een
   diagnostisch veld dat er altijd staat wordt genegeerd. */
await reset();
atria.ad = atriaAd();
const metBeeld = (await roep('/itereren/advertentie?bron=atria&account=aaaa1111&id=120001')).data;
check('met beeld valt er niets te melden', metBeeld.advertentie.velden_zonder_beeld, undefined);

console.log('\n  een leeg filter is geen leeg account');
/* Dit stond letterlijk op het scherm: "Meta gaf geen cijfers voor advertentie
   120241779363400577 in dit venster", direct nadat diezelfde advertentie in de
   lijst eronder stond met € 991,98 en 32 bestellingen. Meta's filter op ad.id
   geeft soms niets terug waar de ongefilterde opvraag hem wél toont. De lijst
   kwam uit hetzelfde venster en hetzelfde account -- dus als hij daar staat,
   staan de cijfers er, en dan is een tweede opvraag het antwoord en geen
   foutmelding. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd()];
meta.filterLeeg = true;
const viaLijst = await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001&dagen=14',
  {}, { META_ACCESS_TOKEN: 'meta-nep' });
check('de advertentie komt er alsnog', viaLijst.status, 200);
check('met haar cijfers', viaLijst.data.advertentie.cijfers.spend, 241.15);
check('en er is wél eerst gefilterd gevraagd', aanroepen.gefilterd > 0, true);

/* En als hij er ook in de brede opvraag niet staat, dan is het wél een fout --
   met het account en het venster erbij, want zonder die twee is "geen cijfers"
   niet na te zoeken. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd({ ad_id: '999' })];
meta.filterLeeg = true;
const echtNiets = await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001&dagen=14',
  {}, { META_ACCESS_TOKEN: 'meta-nep' });
check('dan is het een fout', echtNiets.status, 502);
check('met het account erbij', /account 1\b/.test(echtNiets.data.error || ''), true);
check('en het venster', /laatste 14 dagen/.test(echtNiets.data.error || ''), true);

console.log('\n  bij een video zijn hook en hold de enige cijfers over de creative zelf');
/* Zonder deze twee is een videoadvertentie op precies dezelfde manier te
   beoordelen als een static -- en dan wordt een lek in de eerste drie seconden
   nooit gevonden, want daar meet niets naar. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd({
  impressions: '68000',
  /* Twee regels in één veld: Meta splitst deze lijsten soms per soort. Wie
     alleen de eerste leest telt de helft van de starts en rekent daarmee een
     hook rate uit die te laag is -- en dan lijkt een werkende hook stuk. */
  video_play_actions: [{ action_type: 'video_view', value: '20000' },
                       { action_type: 'video_view_organic', value: '400' }],
  video_thruplay_watched_actions: [{ action_type: 'video_view', value: '6800' }],
  video_p25_watched_actions: [{ action_type: 'video_view', value: '10200' }],
  video_p50_watched_actions: [{ action_type: 'video_view', value: '6120' }],
  video_p75_watched_actions: [{ action_type: 'video_view', value: '3060' }],
  video_p100_watched_actions: [{ action_type: 'video_view', value: '2040' }]
})];
meta.creative = { name: 'WS - 103 - 2 - New Vid', effective_status: 'ARCHIVED', creative: {} };
const vid = (await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001&dagen=30',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
check('de starts zijn opgeteld, niet de eerste regel gepakt',
  vid.advertentie.cijfers.video_plays, 20400);
/* 20.400 van 68.000 vertoningen = 30%. Tegen VERTONINGEN, want dat is de
   noemer waarop hook en hold onderling vergelijkbaar zijn. */
check('hook rate is starts gedeeld door vertoningen', vid.advertentie.cijfers.hook_rate, 30);
check('hold rate is thruplays gedeeld door vertoningen', vid.advertentie.cijfers.hold_rate, 10);
/* En de retentiecurve tegen wie hem STARTTE: 6.120 van 20.400 is 30%. */
check('de helft haalt dertig procent van de starters', vid.doorkijk.p50, 30);
check('en het eind tien', vid.doorkijk.p100, 10);

console.log('\n  en bij een static blijven ze leeg, niet nul');
/* Nul zou zeggen "niemand keek", en de waarheid is dat er niets te kijken viel. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd()];
const stil = (await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001&dagen=30',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
check('geen starts', stil.advertentie.cijfers.video_plays, null);
check('geen hook rate', stil.advertentie.cijfers.hook_rate, null);
check('geen hold rate', stil.advertentie.cijfers.hold_rate, null);
check('en geen retentiecurve', stil.doorkijk, null);

console.log('\n  de video van een Meta-advertentie is af te spelen');
/* Er kwam alleen een thumbnail terug, want de opvraag vroeg er ook alleen om.
   Dan staat er een stilstaand beeld waar beweging hoort -- en Rory leest die
   ene frame alsof dat de advertentie is. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd()];
meta.creative = { name: 'WS - 103 - 2 - New Vid', effective_status: 'ACTIVE',
  creative: { video_id: '99887', thumbnail_url: 'https://x.fbcdn.net/thumb.jpg' } };
meta.video = { source: 'https://video.xx.fbcdn.net/v/echt.mp4', picture: 'https://x.fbcdn.net/poster.jpg' };
const speelbaar = (await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001&dagen=30',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
check('het bestand komt mee', speelbaar.advertentie.video, 'https://video.xx.fbcdn.net/v/echt.mp4');
/* En het is het BESTAND, niet het id. Een id kun je niet afspelen, en een veld
   dat "video" heet en een nummer bevat is een veld dat het scherm stilzwijgend
   negeert. */
check('en niet het id', /^https:/.test(speelbaar.advertentie.video), true);
check('en de thumbnail blijft de poster', speelbaar.advertentie.beeld, 'https://x.fbcdn.net/thumb.jpg');

/* Valt die tweede opvraag om, dan gaat de advertentie door zonder video: geen
   beeld is vervelend, geen cijfers is fataal en die hebben we al. */
await reset();
db.ad_accounts = [{ account_id: 'act_1', naam: 'Wellshave NL', actief: true }];
meta.ad = [metaAd()];
meta.creative = { name: 'x', effective_status: 'ACTIVE',
  creative: { video_id: '99887', thumbnail_url: 'https://x.fbcdn.net/thumb.jpg' } };
meta.video = { error: { message: 'niet gevonden' } };
const zonderBron = (await roep('/itereren/advertentie?bron=meta&account=act_1&id=120001&dagen=30',
  {}, { META_ACCESS_TOKEN: 'meta-nep' })).data;
check('geen bestand', zonderBron.advertentie.video, null);
check('maar de cijfers staan er wel', zonderBron.advertentie.cijfers.spend, 241.15);

console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
process.exit(fout ? 1 : 0);
