/* Testlus voor Creative Research -- de bronlaag op TrendTrack.
 *
 * Wat hier misgaat gaat stil mis, en in vier vormen:
 *
 *   1. DE LIJST GAAT DOOR VOOR BEWIJS. Tien advertenties met bereikcijfers
 *      ernaast zien eruit als een ranglijst van winnaars. Wij kennen van geen
 *      enkele de omzet. Het enige wat we weten is dat de adverteerder hem niet
 *      heeft uitgezet -- een signaal, en een goed signaal, maar geen bewijs.
 *      Het voorbehoud hoort bij de data, niet bij het scherm: een scherm dat
 *      later gebouwd wordt vergeet het anders.
 *
 *   2. HET VENSTER IS EEN ANDER VENSTER. Je vraagt om veertien dagen, de bron
 *      kent dat niet en meet dertig. Als dat niet in het antwoord staat lees
 *      je een maand af als twee weken.
 *
 *   3. EEN LEEG VELD WORDT NUL. Bereik bestaat alleen in de EU-rapportage van
 *      Meta. Buiten dat gebied is er niets, en een 0 zou daar een meting
 *      suggereren die er niet is -- waarna de sortering op bereik precies de
 *      verkeerde kant op werkt.
 *
 *   4. DE BEELDPROXY HAALT ALLES OP. Een worker die elke URL ophaalt is een
 *      manier om via ons bij adressen te komen die alleen wij bereiken. Dit is
 *      de enige fout in deze lijst die niet alleen ons eigen scherm schaadt.
 *
 *   node platform/worker/test/onderzoek.mjs
 */

let versieteller = 0;
async function verseWorker() {
  versieteller++;
  const m = await import('../marketing-os.worker.js?o=' + versieteller);
  return m.default;
}
let actieveWorker = null;

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

const NEP_TT = 'tt_' + 'E'.repeat(32);

let db, tt, beeld, aanroepen;

async function reset() {
  actieveWorker = await verseWorker();
  db = { systeem_geheimen: [], team_members: [{ id: 'baas', status: 'approved', role: 'admin' }] };
  tt = { rijen: [], fout: null };
  beeld = { type: 'image/jpeg', ok: true, body: 'JPEGDATA' };
  aanroepen = { tt: [], extern: [] };
}

globalThis.fetch = async (url, opties) => {
  const u = String(url);

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
    const naam = decodeURIComponent((u.match(/naam=eq\.([^&]+)/) || [])[1] || '');
    return { ok: true, json: async () => db.systeem_geheimen.filter(r => r.naam === naam) };
  }

  if (u.includes('api.trendtrack.io')) {
    aanroepen.tt.push({ url: u, auth: opties.headers.Authorization,
      methode: (opties && opties.method) || 'GET',
      body: (opties && opties.body) ? JSON.parse(opties.body) : null });
    if (tt.fout) return tt.fout;
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: tt.rijen }) };
  }

  /* Alles wat de beeldproxy probeert op te halen. Dit is met opzet de
     vangnetregel: elke host die hier binnenkomt was er een die doorgelaten is. */
  aanroepen.extern.push(u);
  return {
    ok: beeld.ok, status: beeld.ok ? 200 : 404,
    headers: { get: (h) => (h.toLowerCase() === 'content-type' ? beeld.type : null) },
    arrayBuffer: async () => new TextEncoder().encode(beeld.body).buffer,
    text: async () => beeld.body, json: async () => ({})
  };
};

function env(extra) {
  return Object.assign({
    SUPABASE_SERVICE_KEY: 'service-nep',
    SLEUTEL_MASTER: 'een lange willekeurige hoofdsleutel',
    TRENDTRACK_API_KEY: NEP_TT
  }, extra || {});
}

async function roep(pad, opties, extraEnv) {
  const o = Object.assign({ method: 'GET', headers: { Authorization: 'Bearer baas' } }, opties || {});
  const h = new Headers(o.headers);
  h.set('Origin', 'https://wellshave-adgen.netlify.app');
  const req = new Request('https://marketing-ads.workers.dev' + pad, { method: o.method, headers: h });
  const r = await actieveWorker.fetch(req, env(extraEnv), { waitUntil() { } });
  const type = r.headers.get('content-type') || '';
  const ruw = await r.text();
  let data = null;
  if (type.includes('json')) { try { data = JSON.parse(ruw); } catch (e) { data = {}; } }
  return { status: r.status, data: data, type: type, ruw: ruw };
}

/* Een advertentie zoals TrendTrack hem geeft. De velden heten per rij net
   anders -- dat is geen verzinsel maar precies waarom de uitlezer meerdere
   namen probeert. */
/* De vorm die TrendTrack WERKELIJK teruggeeft. Overgenomen van een echt
   antwoord, niet uit de documentatie: bijna alles zit genest onder media,
   content, metrics en audience. Mijn eerste uitlezer verwachtte het plat en
   liet daardoor de kop, de tekst, de CTA, het domein en het land leeg -- terwijl
   het antwoord ze gewoon bevatte. Een fixture die de vorm raadt zou dat niet
   hebben gevonden; die had precies dezelfde aanname bevestigd. */
function ttRij(over) {
  return Object.assign({
    id: 'facebook_1127870081380657', collationId: 'c-900', platform: 'facebook',
    status: 'active', createdAt: '2025-12-11T07:00:45.133Z',
    firstSeenAt: '2022-01-26T08:00:00.000Z', lastSeenAt: null, daysRunning: 96,
    media: { type: 'image', thumbnailUrl: null, mediaUrl: 'https://medias.trendtrack.io/facebook/image/abc.jpg' },
    advertiser: { id: '253', name: 'Concurrent BV', logoUrl: 'https://medias.trendtrack.io/p/253.jpg' },
    content: { title: 'Waarom mannen overstappen', body: 'Drie maanden getest.',
               callToAction: 'SHOP_NOW', landingPageDomain: 'concurrent.nl' },
    metrics: { reach: 412000, estimatedSpend: 275, duplicates: 4, reachDelta7d: 1200 },
    audience: { targetedCountries: ['NL'], mainCountry: 'NL' }
  }, over || {});
}

/* ── De lus ─────────────────────────────────────────────────────────────── */

await reset();

console.log('\n  het onderzoek zit achter de login');
/* Niet omdat de gegevens geheim zijn, maar omdat elke aanroep credits kost bij
   TrendTrack. Een open endpoint dat credits verbrandt is een rekening die
   iemand anders voor je opmaakt. */
const dicht = await roep('/onderzoek/toplijst', { headers: {} });
check('zonder inloggen: geweigerd', dicht.status, 401);
check('en er is niets naar TrendTrack gegaan', aanroepen.tt.length, 0);

console.log('\n  de toplijst komt binnen in onze eigen vorm');
await reset();
tt.rijen = [ttRij(), ttRij({ collationId: 'c-901', brand: 'Ander merk', daysRunning: 41 })];
const topAntwoord = await roep('/onderzoek/toplijst?sorteer=looptijd&dagen=14&limiet=10');
/* Eerst of de route er is. Zonder deze regel loopt de test vast op een lege
   body in plaats van te melden dat het endpoint verdwenen is -- en een test die
   vastloopt meldt niets bruikbaars. */
check('het endpoint antwoordt', topAntwoord.status, 200);
const top = topAntwoord.data;
check('twee advertenties', (top.advertenties || []).length, 2);
const a = top.advertenties[0];
check('met het merk', a.merk, 'Concurrent BV');
check('het beeld', a.beeld, 'https://medias.trendtrack.io/facebook/image/abc.jpg');
check('de copy', [a.copy.kop, a.copy.cta], ['Waarom mannen overstappen', 'SHOP_NOW']);
check('en de tekst', a.copy.tekst, 'Drie maanden getest.');
check('het domein van de landingspagina', a.domein, 'concurrent.nl');
check('hoe lang hij al draait', a.dagen_actief, 96);
check('en hoeveel varianten ervan lopen', a.varianten, 4);
check('het bereik', a.bereik, 412000);
check('de geschatte uitgave', a.uitgave_schatting, 275);
check('het land', a.land, 'NL');
/* firstSeenAt en createdAt zijn twee verschillende dingen: wanneer de
   advertentie voor het eerst gezien is, en wanneer TrendTrack hem opnam. Die
   door elkaar halen maakt van een advertentie uit 2022 er een van vorige
   maand -- en dan klopt "draait het langst" niet meer. */
check('eerst gezien is wanneer hij begon, niet wanneer TrendTrack hem zag',
  String(a.eerst_gezien).slice(0, 4), '2022');

console.log('\n  de lijst zegt zelf dat hij geen bewijs is');
/* Tien advertenties met bereikcijfers ernaast zien eruit als een ranglijst van
   winnaars. Dit voorbehoud hoort bij de data en niet bij het scherm: een
   scherm dat later gebouwd wordt vergeet het anders. */
check('er staat een voorbehoud bij', typeof top.voorbehoud, 'string');
check('en het zegt het met zoveel woorden', /signalen, geen bewijs/.test(top.voorbehoud), true);
check('inclusief wat we werkelijk weten',
  /niet heeft uitgezet/.test(top.voorbehoud), true);
check('en waarop gesorteerd is, in gewone taal', top.sorteert_op, 'draait het langst');

console.log('\n  een venster dat niet bestaat wordt niet stilzwijgend iets anders');
/* Veertien dagen kent deze bron niet voor bereik. Dertig meten en veertien
   opschrijven is de fout waarbij je een maand afleest als twee weken. */
await reset();
tt.rijen = [ttRij()];
const venster = (await roep('/onderzoek/toplijst?sorteer=bereik&dagen=14')).data;
check('er is om veertien dagen gevraagd', venster.dagen_gevraagd, 14);
check('en er is dertig gemeten', venster.venster, 'last30d');
/* Niet meer in de querystring maar in de body: de filters zijn lijsten, en een
   lijst in een querystring is bij elke API weer anders gecodeerd. Dit is de
   controle die de fout ving -- GET met countries=NL werd geweigerd. */
check('de aanroep is een POST', aanroepen.tt[0].methode, 'POST');
check('naar de query-endpoint', /\/v1\/ads\/query$/.test(aanroepen.tt[0].url.split('?')[0]), true);
check('dat is ook wat de bron te horen kreeg', aanroepen.tt[0].body.reachPeriod, 'last30d');

console.log('\n  looptijd krijgt geen venster mee');
/* Een venster op looptijd perkt de lijst in tot wat er in dat venster begon --
   precies het omgekeerde van de vraag "wat draait er het langst". */
await reset();
tt.rijen = [ttRij()];
const opLooptijd = (await roep('/onderzoek/toplijst?sorteer=looptijd&dagen=14')).data;
check('geen venster in het antwoord', opLooptijd.venster, null);
check('en geen reachPeriod in de aanroep', aanroepen.tt[0].body.reachPeriod, undefined);
check('wel gesorteerd op looptijd', aanroepen.tt[0].body.sortBy, 'longestRunning');
/* Het land als lijst, want dat is wat de dienst verwacht. Als string werd het
   geweigerd met niets anders dan "Request validation failed". */
check('en het land gaat als lijst mee', aanroepen.tt[0].body.mainCountries, undefined);

console.log('\n  onbekend blijft leeg');
/* Bereik bestaat alleen in de EU-rapportage van Meta. Buiten dat gebied is er
   niets, en een 0 zou daar een meting suggereren die er niet is -- waarna
   sorteren op bereik precies de verkeerde kant op werkt. */
await reset();
/* De lege maten op de plek waar ze werkelijk staan: onder metrics. Ze op het
   oude, platte niveau leegmaken zou niets bewijzen -- daar kijkt de uitlezer
   niet meer, en dan blijft dit blok groen terwijl hij nog steeds nullen kan
   maken. */
tt.rijen = [ttRij({ metrics: { reach: null, duplicates: '' }, daysRunning: undefined })];
const leeg = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('geen bereik gemeten, dus null', leeg.bereik, null);
check('geen looptijd, dus null', leeg.dagen_actief, null);
check('geen varianten, dus null', leeg.varianten, null);
/* En wat er wel staat blijft staan. */
check('maar het merk is er nog', leeg.merk, 'Concurrent BV');

console.log('\n  een veld dat anders heet wordt alsnog gevonden');
/* TrendTrack levert per rij niet dezelfde sleutels: een oudere rij heeft
   thumbnail, een nieuwere media.thumbnailUrl. Een vaste keuze levert dan een
   leeg veld op in plaats van een fout. */
await reset();
tt.rijen = [{
  ad_id: 'a-77',
  /* Let op de lege brand: die staat er wel, maar er staat niets in. Doorgaan
     naar het volgende veld hoort dan gewoon te gebeuren -- een leeg veld is
     geen waarde, en een uitlezer die daarop stopt levert een naamloze rij. */
  brand: '', pageName: 'Oud formaat',
  media: { thumbnailUrl: 'https://x.fbcdn.net/t.jpg', type: 'video' },
  title: '', headline: 'De kop',
  ad_copy: 'De tekst', days_running: 12, impressions: 5000
}];
const oud = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('het merk uit een ander veld', oud.merk, 'Oud formaat');
check('en een lege kop wordt overgeslagen', oud.copy.kop, 'De kop');
check('het beeld uit een genest veld', oud.beeld, 'https://x.fbcdn.net/t.jpg');
check('de tekst', oud.copy.tekst, 'De tekst');
check('de looptijd', oud.dagen_actief, 12);
check('en bereik uit impressies', oud.bereik, 5000);
check('het id valt terug op wat er is', oud.id, 'a-77');

console.log('\n  de beeldproxy laat alleen door wat erbij hoort');
/* Dit is de enige fout in deze lus die niet alleen ons eigen scherm schaadt:
   een worker die elke URL ophaalt is een manier om via ons bij adressen te
   komen die alleen wij bereiken. */
await reset();
const goed = await roep('/onderzoek/beeld?u=' + encodeURIComponent('https://scontent.xx.fbcdn.net/v/b.jpg'));
check('een beeld van Meta gaat erdoor', goed.status, 200);
check('en komt terug als beeld', goed.type, 'image/jpeg');

for (const kwaad of [
  'http://169.254.169.254/latest/meta-data/',
  'https://169.254.169.254/latest/meta-data/',
  'https://localhost/admin',
  'https://marketing-ads.workers.dev/systeem/sleutels',
  'https://kwaadaardig.nl/beeld.jpg',
  'https://fbcdn.net.kwaadaardig.nl/beeld.jpg',
  'http://scontent.xx.fbcdn.net/v/b.jpg',
  'file:///etc/passwd',
  ''
]) {
  await reset();
  const uit = await roep('/onderzoek/beeld?u=' + encodeURIComponent(kwaad));
  check('geweigerd: ' + (kwaad || '(leeg)'), uit.status, 400);
  check('  en niet opgehaald', aanroepen.extern.length, 0);
}

console.log('\n  en wat een toegelaten host teruggeeft moet ook een beeld zijn');
/* Een host op de lijst die iets anders teruggeeft is geen reden om het door te
   zetten alsof het een plaatje is. */
await reset();
beeld.type = 'text/html';
const geenBeeld = await roep('/onderzoek/beeld?u=' + encodeURIComponent('https://scontent.xx.fbcdn.net/v/b.jpg'));
check('geen afbeelding: geweigerd', geenBeeld.status, 400);
check('en de inhoud wordt niet doorgegeven', geenBeeld.ruw.indexOf('JPEGDATA'), -1);

console.log('\n  de filters gaan mee in de vorm die de dienst verwacht');
/* Dit is de fout die het scherm plat legde. Ik stuurde `countries=NL` als los
   woord in de querystring; het veld heet mainCountries en het is een lijst.
   TrendTrack antwoordde met "Request validation failed" en verder niets, en aan
   die zin kon niemand zien welk veld het was. */
await reset();
tt.rijen = [ttRij()];
await roep('/onderzoek/toplijst?sorteer=bereik&dagen=30&land=nl&taal=nl&soort=image&zoek=scheren&min_dagen=45');
const verstuurd = aanroepen.tt[0].body;
check('het land is een lijst', verstuurd.mainCountries, ['NL']);
check('en in hoofdletters', verstuurd.mainCountries[0], 'NL');
check('de taal ook', verstuurd.adLanguages, ['nl']);
check('het platform staat erbij', verstuurd.platforms, ['facebook']);
check('het soort creative', verstuurd.mediaType, 'image');
check('het zoekwoord', verstuurd.search, 'scheren');
check('de ondergrens voor looptijd', verstuurd.minDaysRunning, 45);
/* En de bovengrens die de dienst zelf aanhoudt. Meer vragen levert geen fout op
   maar stilletjes minder, en dat is de vervelendste vorm. */
check('nooit meer dan twintig', verstuurd.limit, 10);
await reset(); tt.rijen = [ttRij()];
await roep('/onderzoek/toplijst?limiet=500');
check('ook niet als er meer gevraagd wordt', aanroepen.tt[0].body.limit, 20);

console.log('\n  en wat er NIET gekozen is wordt niet meegestuurd');
/* Een leeg filter meesturen is hoe je een lijst inperkt zonder dat iemand
   daarom vroeg -- en bij een dienst die streng valideert is het ook gewoon
   een 400. */
await reset();
tt.rijen = [ttRij()];
await roep('/onderzoek/toplijst?sorteer=looptijd');
const kaalVerstuurd = aanroepen.tt[0].body;
check('geen land', 'mainCountries' in kaalVerstuurd, false);
check('geen taal', 'adLanguages' in kaalVerstuurd, false);
check('geen soort', 'mediaType' in kaalVerstuurd, false);
check('geen zoekwoord', 'search' in kaalVerstuurd, false);
check('geen venster', 'reachPeriod' in kaalVerstuurd, false);

console.log('\n  een validatiefout zegt WELK veld faalde');
/* "Request validation failed" zonder te zeggen welk veld kostte een halve
   ochtend. De dienst stuurt dat wel mee, in een veld dat we niet lazen. */
await reset();
tt.fout = { ok: false, status: 400, text: async () => JSON.stringify({
  message: 'Request validation failed',
  errors: [{ path: ['body', 'countries'], message: 'Unrecognized key' }]
}) };
const validatie = await roep('/onderzoek/toplijst');
check('de melding komt door', /Request validation failed/.test(validatie.data.error), true);
check('met het veld erbij', /body\.countries/.test(validatie.data.error), true);
check('en waarom', /Unrecognized key/.test(validatie.data.error), true);

/* En de andere vormen die diensten hiervoor gebruiken. */
await reset();
tt.fout = { ok: false, status: 400, text: async () => JSON.stringify({
  errorMessage: 'query.limit - must be <= 20' }) };
const andereVorm = await roep('/onderzoek/toplijst');
check('ook een platte errorMessage komt door', /must be <= 20/.test(andereVorm.data.error), true);

console.log('\n  een fout van TrendTrack is een fout van TrendTrack');
await reset();
tt.fout = { ok: false, status: 401, text: async () => JSON.stringify({ message: 'Invalid API key ' + NEP_TT }) };
const stuk = await roep('/onderzoek/toplijst');
check('502, niet een lege lijst', stuk.status, 502);
check('met de bron erbij', stuk.data.bron, 'trendtrack');
check('en de sleutel staat er niet in', stuk.data.error.indexOf(NEP_TT), -1);
check('de nepsleutel zat werkelijk in het antwoord van de dienst',
  (await tt.fout.text()).indexOf(NEP_TT) > -1, true);

console.log('\n  zonder sleutel wordt er niet gegokt');
await reset();
const zonder = await roep('/onderzoek/toplijst', {}, { TRENDTRACK_API_KEY: null });
check('het zegt welke sleutel ontbreekt', /TRENDTRACK_API_KEY/.test(zonder.data.error || ''), true);
check('en er is niets naar buiten gegaan', aanroepen.tt.length, 0);

console.log('\n  de sleutel gaat als Bearer mee, en alleen naar TrendTrack');
await reset();
tt.rijen = [ttRij()];
await roep('/onderzoek/toplijst');
check('de aanroep droeg de sleutel', aanroepen.tt[0].auth, 'Bearer ' + NEP_TT);
await reset();
await roep('/onderzoek/beeld?u=' + encodeURIComponent('https://scontent.xx.fbcdn.net/v/b.jpg'));
check('en het ophalen van een beeld draagt hem niet', aanroepen.tt.length, 0);

console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
process.exit(fout ? 1 : 0);
