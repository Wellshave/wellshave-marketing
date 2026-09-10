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
  tt = { rijen: [], fout: null, merken: [], mappen: [], mappenStuk: false, merkAds: {}, merkFout: {},
         eenmaligAfknijpen: {}, gelijktijdig: 0, maxGelijktijdig: 0 };
  beeld = { type: 'image/jpeg', ok: true, body: 'JPEGDATA' };
  aanroepen = { tt: [], extern: [], range: [] };
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
    if (/\/brandtracker-folders$/.test(u.split('?')[0]) || /\/brandtrackers\/folders$/.test(u.split('?')[0])) {
      if (tt.mappenStuk) return { ok: false, status: 404, text: async () => '{"message":"not found"}' };
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: tt.mappen || [] }) };
    }
    if (/\/v1\/brandtrackers$/.test(u.split('?')[0])) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: tt.merken }) };
    }
    const perMerk = u.match(/\/v1\/brandtrackers\/([^/]+)\/top-ads/);
    if (perMerk) {
      const id = decodeURIComponent(perMerk[1]);
      /* Meten hoeveel er tegelijk onderweg zijn. Dit is de enige manier om te
         zien dat de fan-out weg is: het resultaat is bij beide hetzelfde. */
      tt.gelijktijdig = (tt.gelijktijdig || 0) + 1;
      tt.maxGelijktijdig = Math.max(tt.maxGelijktijdig || 0, tt.gelijktijdig);
      await new Promise(r => setTimeout(r, 5));
      tt.gelijktijdig--;
      if (tt.merkFout && tt.merkFout[id]) {
        return { ok: false, status: 500, text: async () => JSON.stringify({ message: 'die is stuk' }) };
      }
      if (tt.eenmaligAfknijpen && tt.eenmaligAfknijpen[id]) {
        tt.eenmaligAfknijpen[id] = false;
        return { ok: false, status: 429,
          text: async () => JSON.stringify({ message: 'Too many concurrent public API requests are already in flight' }) };
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: (tt.merkAds && tt.merkAds[id]) || [] }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: tt.rijen }) };
  }

  /* Alles wat de beeldproxy probeert op te halen. Dit is met opzet de
     vangnetregel: elke host die hier binnenkomt was er een die doorgelaten is. */
  aanroepen.extern.push(u);
  aanroepen.range.push((opties && opties.headers && opties.headers.Range) || null);
  const kop = { 'content-type': beeld.type };
  if (beeld.extra) Object.assign(kop, beeld.extra);
  return {
    ok: beeld.ok, status: beeld.status || (beeld.ok ? 200 : 404),
    headers: { get: (h) => (kop[h.toLowerCase()] !== undefined ? kop[h.toLowerCase()] : null) },
    body: beeld.body,
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
const dicht = await roep('/onderzoek/toplijst?bereik=markt', { headers: {} });
check('zonder inloggen: geweigerd', dicht.status, 401);
check('en er is niets naar TrendTrack gegaan', aanroepen.tt.length, 0);

console.log('\n  de toplijst komt binnen in onze eigen vorm');
await reset();
tt.rijen = [ttRij(), ttRij({ collationId: 'c-901', brand: 'Ander merk', daysRunning: 41 })];
const topAntwoord = await roep('/onderzoek/toplijst?bereik=markt&sorteer=looptijd&dagen=14&limiet=10');
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
const venster = (await roep('/onderzoek/toplijst?bereik=markt&sorteer=bereik&dagen=14')).data;
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
const opLooptijd = (await roep('/onderzoek/toplijst?bereik=markt&sorteer=looptijd&dagen=14')).data;
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
const leeg = (await roep('/onderzoek/toplijst?bereik=markt')).data.advertenties[0];
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
const oud = (await roep('/onderzoek/toplijst?bereik=markt')).data.advertenties[0];
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
await roep('/onderzoek/toplijst?bereik=markt&sorteer=bereik&dagen=30&land=nl&taal=nl&soort=image&zoek=scheren&min_dagen=45');
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
await roep('/onderzoek/toplijst?bereik=markt&limiet=500');
check('ook niet als er meer gevraagd wordt', aanroepen.tt[0].body.limit, 20);

console.log('\n  en wat er NIET gekozen is wordt niet meegestuurd');
/* Een leeg filter meesturen is hoe je een lijst inperkt zonder dat iemand
   daarom vroeg -- en bij een dienst die streng valideert is het ook gewoon
   een 400. */
await reset();
tt.rijen = [ttRij()];
await roep('/onderzoek/toplijst?bereik=markt&sorteer=looptijd');
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
const validatie = await roep('/onderzoek/toplijst?bereik=markt');
check('de melding komt door', /Request validation failed/.test(validatie.data.error), true);
check('met het veld erbij', /body\.countries/.test(validatie.data.error), true);
check('en waarom', /Unrecognized key/.test(validatie.data.error), true);

/* En de andere vormen die diensten hiervoor gebruiken. */
await reset();
tt.fout = { ok: false, status: 400, text: async () => JSON.stringify({
  errorMessage: 'query.limit - must be <= 20' }) };
const andereVorm = await roep('/onderzoek/toplijst?bereik=markt');
check('ook een platte errorMessage komt door', /must be <= 20/.test(andereVorm.data.error), true);

console.log('\n  standaard kijken we naar de Brand Tracker, niet naar de hele markt');
/* "Wat draait er in de markt" en "wat draait er bij onze concurrenten" zijn
   twee verschillende vragen. De hele markt leverde een Duitse kinderopvang op;
   de Brand Tracker levert de merken waar we tegen vechten.

   En let op: spender=brandtracker op de gewone zoekopdracht doet dit NIET --
   dat verbreedde de lijst van vierhonderdduizend naar bijna acht miljoen. De
   enige route die werkelijk filtert loopt per merk. */
await reset();
/* Let op de naam: in de Brand Tracker staat vaak het DOMEIN als naam
   ("manscaped.com"), terwijl de advertentie zelf gewoon "MANSCAPED" zegt. Ik
   had de trackernaam laten winnen en dat leverde domeinen op de kaarten op. */
tt.merken = [
  { id: 'm1', name: 'manscaped.com', domain: 'manscaped.com', counts: { activeAds: 155, newAdsLast7Days: 33 } },
  { id: 'm2', name: 'BALZY', domain: 'balzy.nl', counts: { activeAds: 428, newAdsLast7Days: 33 } }
];
tt.merkAds = {
  m1: [ttRij({ collationId: 'a1', daysRunning: 40, advertiser: { name: 'MANSCAPED' },
               metrics: { reach: 90000, duplicates: 2, reachDelta7d: 500 } }),
       /* Eentje zonder gemeten looptijd. Die hoort ONDERAAN te zakken: een
          onbekende waarde is geen nul en zeker geen hoogste, en hem bovenaan
          zetten maakt van "wij weten het niet" de winnaar van de lijst. */
       ttRij({ collationId: 'a2', daysRunning: null, advertiser: {},
               metrics: { reach: 70000, reachDelta7d: 300 } })],
  m2: [ttRij({ collationId: 'b1', daysRunning: 300, metrics: { reach: 10000, duplicates: 1, reachDelta7d: 9000 } }),
       ttRij({ collationId: 'b2', daysRunning: 120, metrics: { reach: 50000, duplicates: 3, reachDelta7d: 100 } })]
};
const bt = (await roep('/onderzoek/toplijst?sorteer=looptijd')).data;
check('zonder bereik is het de Brand Tracker', bt.bereik, 'brandtracker');
check('de gevolgde merken staan erbij', bt.merken.map(m => m.naam), ['manscaped.com', 'BALZY']);
check('van beide merken zijn advertenties opgehaald', bt.merken_gebruikt.sort(), ['BALZY', 'manscaped.com']);
check('vier advertenties samen', bt.advertenties.length, 4);
/* Gerangschikt op looptijd, over alle merken heen. */
check('de langst draaiende staat bovenaan', bt.advertenties[0].dagen_actief, 300);
check('daarna de volgende', bt.advertenties[1].dagen_actief, 120);
check('en wat niet gemeten is zakt naar onderen',
  bt.advertenties[bt.advertenties.length - 1].dagen_actief, null);
/* De naam van de adverteerder wint van die van de Brand Tracker. Daar staat
   vaak het domein, en een domein is geen merknaam. */
const vanManscaped = bt.advertenties.filter(a => a.merk_id === 'm1')[0];
check('de merknaam komt van de adverteerder', vanManscaped.merk, 'MANSCAPED');
/* En de terugval: zegt de advertentie niets, dan is de tracker beter dan niets. */
const zonderNaam = bt.advertenties.filter(a => a.merk_id === 'm1' && a.dagen_actief === null)[0];
check('zonder naam bij de advertentie valt hij terug op de tracker',
  zonderNaam ? zonderNaam.merk : null, 'manscaped.com');

console.log('\n  je kiest zelf welke merken meedoen');
/* Het was een merk OF alle merken. Daartussen zit de vraag die je stelt: de
   concurrenten van Wellshine, zonder die van Wellshave erbij. */
const alleenBalzy = (await roep('/onderzoek/toplijst?sorteer=looptijd&merken=m2')).data;
check('met een merk komt alleen dat merk terug',
  alleenBalzy.merken_gebruikt, ['BALZY']);
check('en alleen zijn advertenties', alleenBalzy.advertenties.every(a => a.merk_id === 'm2'), true);
const tweeMerken = (await roep('/onderzoek/toplijst?sorteer=looptijd&merken=m1,m2')).data;
check('met twee merken komen ze allebei', tweeMerken.merken_gebruikt.sort(), ['BALZY', 'manscaped.com']);
/* Een id dat niet bestaat levert geen stille hele lijst op. Dat is het gevaar
   bij een filter dat leegvalt: je vraagt om een merk en krijgt de markt. */
const nietBestaand = (await roep('/onderzoek/toplijst?sorteer=looptijd&merken=bestaat-niet')).data;
check('een onbekend merk levert niets, niet alles', nietBestaand.advertenties.length, 0);
/* En het is een lege lijst, geen foutmelding: de laag erboven telde velden die
   op dit pad ontbraken. Zolang je alleen "alles" kon kiezen was dat pad
   onbereikbaar; met een eigen selectie is het gewoon een merk dat niet meer
   gevolgd wordt. */
check('en dat is een lege lijst, geen fout', nietBestaand.error, undefined);
check('met de merken er nog bij', nietBestaand.merken.length, 2);
/* En de oude parameter blijft werken: een console die nog merk= stuurt hoort
   niet stil de hele Brand Tracker terug te krijgen. */
const oudeParam = (await roep('/onderzoek/toplijst?sorteer=looptijd&merk=m2')).data;
check('de oude merk-parameter werkt nog', oudeParam.merken_gebruikt, ['BALZY']);

console.log('\n  de mappen van de Brand Tracker komen mee');
/* Wellshave en Wellshine hebben elk hun eigen concurrenten. Zonder die
   indeling analyseer je twee markten tegelijk, en dus geen van beide. */
tt.mappen = [
  { id: 13318, name: 'Wellshave', brandtrackerCount: 7 },
  { id: 14127, name: 'Wellshine', brandtrackerCount: 4 },
  /* Een map zonder naam is geen map: als knop zou hij leeg zijn, en een lege
     knop die stilletjes je hele selectie omgooit is erger dan geen knop. */
  { id: 99999, brandtrackerCount: 1 },
  { name: 'Zonder id', brandtrackerCount: 2 }
];
const metMappen = (await roep('/onderzoek/merken')).data;
check('de mappen staan in het antwoord', metMappen.mappen.map(m => m.naam), ['Wellshave', 'Wellshine']);
check('met hun id', metMappen.mappen[0].id, 13318);
check('en een map zonder naam of id telt niet mee', metMappen.mappen.length, 2);
check('en de merken staan er nog steeds', metMappen.merken.length, 2);
/* Levert de bron geen mappen, dan zijn er geen mappen -- en verder niets aan de
   hand. Een verzonnen indeling zou erger zijn dan geen indeling, en een fout
   hier zou de hele merkenlijst meenemen. */
tt.mappenStuk = true;
const zonderMappen = (await roep('/onderzoek/merken')).data;
check('geen mappen is geen fout', zonderMappen.mappen, []);
check('en de merken komen gewoon', zonderMappen.merken.length, 2);
tt.mappenStuk = false;
/* De domeinen komen mee: het scherm kiest daaruit het domein dat bij de naam
   hoort. Het eerste domein is vaak de landingsplek en niet het merk. */
tt.merken = [
  { id: 'm1', name: 'manscaped.com', domain: 'amazon.co.uk',
    domains: ['amazon.co.uk', 'manscaped.com'], folderId: 13318, counts: { activeAds: 155 } },
  { id: 'm2', name: 'BALZY', domain: 'balzy.nl', domains: ['balzy.nl'], folderId: 13318, counts: { activeAds: 428 } }
];
const metDomeinen = (await roep('/onderzoek/merken')).data;
check('alle domeinen komen mee', metDomeinen.merken[0].domeinen, ['amazon.co.uk', 'manscaped.com']);
check('en de map van het merk', metDomeinen.merken[0].map_id, 13318);

console.log('\n  en het zegt eerlijk wat voor rangschikking dit is');
/* TrendTrack kent bij een gevolgd merk geen sortering op looptijd. We halen per
   merk de best presterende advertenties op en rangschikken die aan onze kant --
   dat is iets anders dan "de langst draaiende die zij ooit hadden", en dat
   verschil hoort in het antwoord te staan. */
check('er staat hoe er gerangschikt is', typeof bt.hoe_gerangschikt, 'string');
check('met hoeveel merken er meededen', /2 van de 2 merken/.test(bt.hoe_gerangschikt), true);
check('en wat het niet is', /niet van alles wat zij ooit draaiden/.test(bt.hoe_gerangschikt), true);

console.log('\n  bij een gevolgd merk bestaat bereik niet, en dat wordt niet verzwegen');
/* Dit is wat TrendTrack werkelijk teruggeeft op de per-merk-route: bereik,
   uitgave en varianten zijn leeg. Wat er wel is, is de positie van de
   advertentie binnen de pagina van dat merk. Op een leeg veld sorteren levert
   een willekeurige volgorde die eruitziet als een ranglijst. */
function merkRij(over) {
  return ttRij(Object.assign({
    metrics: { reach: null, estimatedSpend: null, duplicates: null, reachDelta7d: 0 }
  }, over || {}));
}
await reset();
tt.merken = [{ id: 'm2', name: 'BALZY' }];
tt.merkAds = { m2: [
  merkRij({ collationId: 'b1', daysRunning: 300, rank: { currentRank: 40, rankDelta: 2 } }),
  merkRij({ collationId: 'b2', daysRunning: 120, rank: { currentRank: 3, rankDelta: 33 } })
] };
const opBereik = (await roep('/onderzoek/toplijst?sorteer=bereik')).data;
check('het bereik is inderdaad leeg', opBereik.advertenties[0].bereik, null);
/* Rang: lager is beter. Rang 3 is de advertentie waar dat merk het meest op
   inzet, en die hoort bovenaan -- niet onderaan. */
check('er wordt op rang gerangschikt, laag eerst', opBereik.advertenties[0].rang, 3);
check('en het scherm krijgt te horen dat bereik hier niet bestaat',
  /geen bereikcijfers/.test(opBereik.hoe_gerangschikt), true);
check('met welke velden er leeg blijven', opBereik.geen_cijfers_voor, ['bereik', 'uitgave_schatting', 'varianten']);

await reset();
tt.merken = [{ id: 'm2', name: 'BALZY' }];
tt.merkAds = { m2: [
  merkRij({ collationId: 'b1', daysRunning: 300, rank: { currentRank: 40, rankDelta: 2 } }),
  merkRij({ collationId: 'b2', daysRunning: 120, rank: { currentRank: 3, rankDelta: 33 } })
] };
const opGroei = (await roep('/onderzoek/toplijst?sorteer=groei')).data;
check('op groei de hardst gestegen advertentie', opGroei.advertenties[0].rang_delta, 33);
check('en de aanroep vroeg om die sortering',
  /sortBy=rankDelta7d/.test(aanroepen.tt.filter(a => /top-ads/.test(a.url))[0].url), true);

console.log('\n  een rij zonder beeld verraadt zijn eigen veldnamen');
/* De vorm die wij kennen komt uit een gereedschap dat het antwoord
   normaliseert; de ruwe route kan andere namen gebruiken. Zonder dit is de
   volgende ronde weer raden -- met dit staat in het antwoord welke velden er
   dan wel waren. Alleen de namen, nooit de inhoud: een advertentietekst hoort
   niet in een diagnostisch veld. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'x', daysRunning: 5,
  /* Een vorm die wij niet kennen: het beeld heet hier anders. */
  creative: { imageUri: 'https://ergens/beeld.jpg' }, snapshot: { url: 'x' } }] };
const onbekend = (await roep('/onderzoek/toplijst')).data;
check('er kwam geen beeld uit', onbekend.advertenties[0].beeld, null);
check('en de veldnamen staan in het antwoord',
  (onbekend.velden_zonder_beeld || []).sort(), ['creative', 'daysRunning', 'id', 'snapshot']);

/* En de tegenproef: komt er wel een beeld uit, dan staat het veld er niet.
   Een diagnostisch veld dat er altijd staat wordt genegeerd, en dan is het er
   niet als je het nodig hebt. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [ttRij()] };
const metBeeld = (await roep('/onderzoek/toplijst')).data;
check('met beeld is er niets te melden', metBeeld.velden_zonder_beeld, undefined);
check('en het beeld is er ook echt', metBeeld.advertenties[0].beeld !== null, true);

console.log('\n  een veld wordt op naam gevonden, niet alleen op plek');
/* Ik heb een ronde verspild met raden waar de velden op de merkroute stonden,
   en dat raden kost elke keer een deploy. De namen bleken hetzelfde, de plek
   niet. Zoek dus op naam: dan maakt het niet uit of TrendTrack morgen een laag
   toevoegt of weghaalt. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{
  adArchiveId: 'z-1',
  /* Elk veld staat op een plek die wij niet kennen -- maar wel onder de naam
     die de dienst overal gebruikt. */
  snapshot: {
    creatives: [{ resizedImageUrl: 'https://x.fbcdn.net/diep.jpg' }],
    advertiserName: 'Diep BV',
    body: { text: null, adCopy: 'De tekst stond drie lagen diep.' },
    title: 'De kop stond er ook',
    ctaText: 'SHOP_NOW'
  },
  /* En met een onderstreping, want dezelfde dienst schrijft hem op twee
     manieren. De namen worden daarom eerst gelijkgetrokken. */
  stats: { reach: 88000, days_running: 41 }
}] };
const diep = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('het id', diep.id, 'z-1');
check('het merk', diep.merk, 'Diep BV');
check('het beeld', diep.beeld, 'https://x.fbcdn.net/diep.jpg');
check('de kop', diep.copy.kop, 'De kop stond er ook');
check('de tekst', diep.copy.tekst, 'De tekst stond drie lagen diep.');
check('de cta', diep.copy.cta, 'SHOP_NOW');
check('het bereik', diep.bereik, 88000);
check('de looptijd', diep.dagen_actief, 41);
check('en er valt niets te melden over ontbrekende velden',
  (await roep('/onderzoek/toplijst')).data.velden_zonder_beeld, undefined);

console.log('\n  een groeicijfer is geen bereik');
/* De naamvergelijking trekt hoofdletters en streepjes glad, en dat mag niet
   doorslaan naar "lijkt erop". reachDelta7d is de verandering van het bereik,
   niet het bereik: die als bereik aflezen zet een advertentie met duizend
   groei boven eentje met vierhonderdduizend bereik. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'g1', stats: { reachDelta7d: 1200 },
                      media: { mediaUrl: 'https://x.fbcdn.net/g.jpg' } }] };
const groei = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('bereik blijft leeg', groei.bereik, null);
check('en de groei staat waar hij hoort', groei.groei_7d, 1200);

console.log('\n  een beeld dat wij niet kunnen ophalen telt niet als beeld');
/* De beeldproxy haalt alleen op van hosts die wij kennen. Een uitlezer die
   een adres op een andere host kiest levert een kaart met een gebroken plaatje
   op, terwijl het bruikbare adres er gewoon naast stond. Doorzoeken dus. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'h1',
  media: { mediaUrl: 'http://onveilig.example/nee.jpg' },
  snapshot: { thumbnailUrl: 'https://x.fbcdn.net/wel.jpg' } }] };
const host = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('het bruikbare adres wint', host.beeld, 'https://x.fbcdn.net/wel.jpg');

console.log('\n  en anders elk adres in het antwoord, behalve het logo');
/* Het laatste redmiddel: staat er geen veld met een naam die wij kennen, dan
   nemen we het eerste adres dat op een toegelaten host staat. Grof, en het mag
   grof zijn omdat de hostlijst hem tegenhoudt. Maar het logo van de
   adverteerder is de advertentie niet -- dat tonen is een leugen met een
   plaatje erbij. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'l1',
  advertiser: { logoUrl: 'https://medias.trendtrack.io/p/253.jpg' },
  bijlage: { onbekendVeld: 'https://x.fbcdn.net/echt.jpg' } }] };
const laatste = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('het logo wordt overgeslagen', laatste.beeld, 'https://x.fbcdn.net/echt.jpg');

await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'l2',
  advertiser: { logoUrl: 'https://medias.trendtrack.io/p/253.jpg' } }] };
const alleenLogo = (await roep('/onderzoek/toplijst')).data;
check('en staat er alleen een logo, dan is er geen beeld',
  alleenLogo.advertenties[0].beeld, null);
check('waarna de veldnamen alsnog gemeld worden',
  (alleenLogo.velden_zonder_beeld || []).indexOf('advertiser') > -1, true);

console.log('\n  ondiep wint van diep, en leeg wint van niets');
/* Twee valkuilen in dezelfde zoektocht. De eerste: wie diep begint vindt de
   ondertitel uit een bijlage in plaats van de kop van de advertentie -- beide
   heten `title`, en alleen de plek zegt welke de echte is. Breedte eerst dus:
   wat dicht bij de wortel staat is de hoofdzaak.
   De tweede: een veld dat er staat maar leeg is, is geen waarde. Stopt de
   zoektocht daarop, dan levert een lege `title` een naamloze kaart op terwijl
   de kop er verderop gewoon staat. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'o1',
  media: { mediaUrl: 'https://x.fbcdn.net/o.jpg' },
  card: { title: '' },
  snapshot: { title: 'De kop van de advertentie' },
  extra: { laag: { title: 'Een ondertitel, diep weggestopt' } } }] };
const ondiep = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('de kop komt van dichtbij, niet van diep', ondiep.copy.kop, 'De kop van de advertentie');

console.log('\n  een video is geen beeld, en een beeld is geen video');
/* Dit ging stil mis en zag eruit als niets: bij een videoadvertentie stond de
   mp4 in `media.mediaUrl`, de uitlezer pakte hem als beeld, en het scherm zette
   hem in een <img>. Dat levert een zwart vlak op -- geen fout, geen melding,
   alleen een kaart die leeg lijkt terwijl er een advertentie achter zit die al
   maanden draait. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'v1', media: {
  type: 'video',
  mediaUrl: 'https://medias.trendtrack.io/facebook/video/abc.mp4',
  thumbnailUrl: 'https://medias.trendtrack.io/facebook/image/abc.jpg' } }] };
const vid = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('het bestand staat apart', vid.video, 'https://medias.trendtrack.io/facebook/video/abc.mp4');
check('en het stilstaande voorbeeld is het beeld', vid.beeld, 'https://medias.trendtrack.io/facebook/image/abc.jpg');

/* En andersom: een gewone advertentie krijgt geen video die er niet is. Een
   speelknop op een still is een belofte die niet ingelost wordt. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [ttRij()] };
const stil = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('een still heeft geen video', stil.video, null);
check('en het beeld staat er gewoon', stil.beeld, 'https://medias.trendtrack.io/facebook/image/abc.jpg');

/* Het gaat om waar het adres op EINDIGT, niet om wat er ergens in staat. Een
   voorvertoning van een video staat in een map die "video" heet en heeft "mp4"
   in de naam, maar het is een jpg. Wie op "komt het woord voor" toetst gooit
   precies de stills weg die bij de videoadvertenties horen. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 's2', media: {
  thumbnailUrl: 'https://medias.trendtrack.io/facebook/video/mp4-poster/abc.jpg' } }] };
const poster = (await roep('/onderzoek/toplijst')).data.advertenties[0];
check('een poster uit de videomap blijft een beeld',
  poster.beeld, 'https://medias.trendtrack.io/facebook/video/mp4-poster/abc.jpg');
check('en is geen video', poster.video, null);

/* Staat er alleen een video en geen enkele still, dan is er geen beeld -- maar
   dan valt er ook niets te melden over ontbrekende velden: we hebben de
   advertentie gevonden, alleen niet als plaatje. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [{ id: 'v2', media: { mediaUrl: 'https://x.fbcdn.net/v.mp4' } }] };
const alleenVideo = (await roep('/onderzoek/toplijst')).data;
check('geen beeld', alleenVideo.advertenties[0].beeld, null);
check('wel de video', alleenVideo.advertenties[0].video, 'https://x.fbcdn.net/v.mp4');
check('en geen klacht over ontbrekende velden', alleenVideo.velden_zonder_beeld, undefined);

console.log('\n  de video komt langs dezelfde poort, met dezelfde grens');
await reset();
beeld = { ok: true, type: 'video/mp4', body: 'MP4DATA' };
const speel = await roep('/onderzoek/video?u=' + encodeURIComponent('https://x.fbcdn.net/v.mp4'));
check('een video van Meta gaat erdoor', speel.status, 200);
check('en komt terug als video', speel.type, 'video/mp4');

/* Dezelfde adressen die de beeldproxy weigert. Een tweede ingang die iets
   ruimer is dan de eerste is geen tweede ingang maar een gat. */
await reset();
beeld = { ok: true, type: 'video/mp4', body: 'MP4DATA' };
const kwaadaardig = [
  'https://kwaadaardig.nl/film.mp4',
  'https://fbcdn.net.kwaadaardig.nl/film.mp4',
  'http://scontent.xx.fbcdn.net/film.mp4',
  'https://192.168.1.1/film.mp4',
  'file:///etc/passwd'
];
for (const kwaad of kwaadaardig) {
  const uit = await roep('/onderzoek/video?u=' + encodeURIComponent(kwaad));
  check('  geweigerd: ' + kwaad, uit.status, 400);
}
check('  en niets opgehaald', aanroepen.extern.length, 0);

/* En wat een toegelaten host teruggeeft moet ook een video zijn. Een host op de
   lijst die HTML teruggeeft is geen reden om dat als film door te zetten. */
await reset();
beeld = { ok: true, type: 'text/html', body: '<html>' };
const geenVideo = await roep('/onderzoek/video?u=' + encodeURIComponent('https://x.fbcdn.net/v.mp4'));
check('geen video: geweigerd', geenVideo.status, 400);

/* Doorspoelen. Zonder dat de Range meegaat kun je alleen van voren af aan
   kijken, en dan is een advertentie van dertig seconden dertig seconden werk. */
await reset();
beeld = { ok: true, status: 206, type: 'video/mp4', body: 'BROK',
          extra: { 'content-range': 'bytes 100-199/5000' } };
const brok = await roep('/onderzoek/video?u=' + encodeURIComponent('https://x.fbcdn.net/v.mp4'),
  { headers: { Authorization: 'Bearer baas', Range: 'bytes=100-199' } });
check('de Range ging mee naar de bron', aanroepen.range[0], 'bytes=100-199');
check('en het antwoord blijft een deelantwoord', brok.status, 206);

console.log('\n  de merken worden een voor een bevraagd, niet allemaal tegelijk');
/* TrendTrack weigert gelijktijdige aanroepen met "Too many concurrent public
   API requests are already in flight". Elf van de dertien merken vielen
   daardoor weg, en het scherm liet twee concurrenten zien alsof dat de hele
   Brand Tracker was. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B' }, { id: 'm3', name: 'C' }];
tt.merkAds = { m1: [ttRij()], m2: [ttRij()], m3: [ttRij()] };
tt.gelijktijdig = 0; tt.maxGelijktijdig = 0;
const volgorde = (await roep('/onderzoek/toplijst')).data;
check('alle drie de merken zijn opgehaald', volgorde.merken_gebruikt.length, 3);
check('en er was er nooit meer dan een tegelijk onderweg', tt.maxGelijktijdig, 1);

console.log('\n  en een afknijper wordt uitgezeten, niet doorgegeven');
/* Een afknijper is geen fout maar een verzoek om te wachten. Eén keer wachten
   en opnieuw; blijft het misgaan, dan is het wel een fout. */
await reset();
tt.merken = [{ id: 'm1', name: 'A' }];
tt.merkAds = { m1: [ttRij()] };
tt.eenmaligAfknijpen = { m1: true };
const naGeduld = (await roep('/onderzoek/toplijst')).data;
check('het merk komt alsnog binnen', naGeduld.merken_gebruikt, ['A']);
check('er is een tweede poging gedaan',
  aanroepen.tt.filter(a => /top-ads/.test(a.url)).length, 2);
check('en er staat niets bij de mislukte merken', naGeduld.merken_mislukt, []);

console.log('\n  een merk dat weigert laat de rest staan');
/* Eén merk dat stuk is mag de andere twaalf niet meenemen. Wel moet erbij staan
   welke ontbreekt: een lijst die stil korter is leest als "die concurrent doet
   niets". */
await reset();
tt.merken = [{ id: 'm1', name: 'Manscaped' }, { id: 'm2', name: 'BALZY' }];
tt.merkAds = { m2: [ttRij({ collationId: 'b1' })] };
tt.merkFout = { m1: true };
const halfStukAntwoord = await roep('/onderzoek/toplijst');
/* Eerst of het endpoint überhaupt antwoordde. Zonder deze regel loopt de test
   vast op een lege body en meldt hij alleen dát hij vastliep. */
check('het endpoint antwoordt nog steeds', halfStukAntwoord.status, 200);
const halfStuk = halfStukAntwoord.data;
check('de rest komt gewoon door', (halfStuk.advertenties || []).length, 1);
check('en er staat welk merk ontbrak', /Manscaped/.test((halfStuk.merken_mislukt || []).join(' ')), true);

console.log('\n  je kunt op een enkel merk inzoomen');
await reset();
tt.merken = [{ id: 'm1', name: 'Manscaped' }, { id: 'm2', name: 'BALZY' }];
tt.merkAds = { m1: [ttRij({ collationId: 'a1' })], m2: [ttRij({ collationId: 'b1' })] };
const eenMerk = (await roep('/onderzoek/toplijst?merk=m2')).data;
check('alleen dat merk is bevraagd', aanroepen.tt.filter(a => /top-ads/.test(a.url)).length, 1);
check('en het is de goede', /m2/.test(aanroepen.tt.filter(a => /top-ads/.test(a.url))[0].url), true);

console.log('\n  de merkenlijst is los op te vragen');
await reset();
tt.merken = [{ id: 'm1', name: 'Manscaped', domain: 'manscaped.com', counts: { activeAds: 155 } }];
const merken = (await roep('/onderzoek/merken')).data;
check('met naam en domein', [merken.merken[0].naam, merken.merken[0].domein], ['Manscaped', 'manscaped.com']);
check('en hoeveel er draaien', merken.merken[0].actieve_ads, 155);

console.log('\n  een fout van TrendTrack is een fout van TrendTrack');
await reset();
tt.fout = { ok: false, status: 401, text: async () => JSON.stringify({ message: 'Invalid API key ' + NEP_TT }) };
const stuk = await roep('/onderzoek/toplijst?bereik=markt');
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
await roep('/onderzoek/toplijst?bereik=markt');
check('de aanroep droeg de sleutel', aanroepen.tt[0].auth, 'Bearer ' + NEP_TT);
await reset();
await roep('/onderzoek/beeld?u=' + encodeURIComponent('https://scontent.xx.fbcdn.net/v/b.jpg'));
check('en het ophalen van een beeld draagt hem niet', aanroepen.tt.length, 0);

console.log('\n' + (fout ? '  ' + fout + ' controle(s) mislukt' : '  Alle controles geslaagd'));
process.exit(fout ? 1 : 0);
