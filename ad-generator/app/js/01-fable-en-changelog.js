
/* [FABLE5-FIX] Haal veilig de tekst uit een Claude-antwoord.
   Fable 5 zet soms een 'thinking'-block vooraan; blind content[0].text lezen
   geeft dan 'Cannot read properties of undefined (reading trim)' of stilzwijgend
   een lege tekst. Deze helpers pakken het eerste ECHTE text-block. */
function wgClaudeTextOrNull(data){
  var blocks = data && data.content;
  if (Array.isArray(blocks)){
    for (var i=0;i<blocks.length;i++){ var b=blocks[i]; if (b && b.type==='text' && typeof b.text==='string' && b.text.length) return b.text; }
    for (var j=0;j<blocks.length;j++){ var c=blocks[j]; if (c && typeof c.text==='string' && c.text.length) return c.text; }
  }
  return null;
}
function wgClaudeText(data){
  var t = wgClaudeTextOrNull(data);
  if (t != null) return t;
  var e = '';
  if (data){
    if (data.error) e = (typeof data.error === 'string') ? data.error : (data.error.message || '');
    if (!e && data.hint) e = data.hint;
    if (!e && data.message) e = data.message;
  }
  if (e) throw new Error('AI-fout: ' + e);
  throw new Error('Leeg antwoord van de teamserver. Ben je ingelogd als goedgekeurd teamlid, en heeft de worker de ANTHROPIC_KEY-secret?');
}

// ============================================================
// CHANGELOG (nieuwste bovenaan, voeg toe bij elke versie-bump)
// ============================================================
// ===== TEAM-SERVER CONFIG (gedeelde proxy + database) =====
// Fase 1: alle AI-calls lopen via deze Worker (keys staan op de server).
const WORKER_URL = 'https://marketing-ads.dustin-9ff.workers.dev'; /* [MARKETING-ADS] eigen ad-generator-worker: /anthropic + /v1 (OpenAI), team-login vereist */
/* De worker staat maar één herkomst toe in zijn CORS-lijst: wellshave-adgen.
   Een tweede omgeving kan hem daardoor niet rechtstreeks aanroepen. In plaats
   van die lijst te verruimen (dat vraagt een worker-deploy, en die raakt de
   console waar het team vandaag in werkt) lopen de calls daar via _redirects
   over de eigen origin: de browser praat same-origin, Netlify praat met de
   worker. De Authorization-header gaat mee, en die is de echte grens — de
   worker weigert op de login, niet op de herkomst.
   Bekende hosts houden de directe route, zodat daar niets verandert. */
const PROXY_BASE = (function () {
  var h = location.hostname;
  if (h === 'wellshave-adgen.netlify.app') return WORKER_URL;
  if (/^(localhost|127\.0\.0\.1)$/.test(h))  return WORKER_URL;
  if (location.protocol === 'file:')          return WORKER_URL;
  return location.origin;
})();
window.__WG_TEAMSERVER = /^https:\/\//i.test(PROXY_BASE) && !/(localhost|127\.0\.0\.1)/i.test(PROXY_BASE); /* [MARKETING-ADS] sleutels staan server-side op de worker -> key-veld niet vereist */
// Fase 2 (Supabase data-sync) gebruikt deze twee:
const SUPABASE_URL = 'https://bequyhghgkvekvibufhw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv';
const CHANGELOG = [
  {
    version: '7.3',
    date: '2026-07-28',
    title: 'Review: de gegenereerde output als beoordeel-werkruimte',
    desc: 'De variaties die uit een generatie komen zagen eruit als een formulier: elk onderdeel een invoerveld, allemaal even zwaar. Nu lees je eerst wat Claude bedacht heeft. De headline staat groot bovenaan in Fraunces, body copy leest als tekst en de CTA als een pill — geen kaders, geen invoervakken. Wil je iets wijzigen, dan klik je op "Tekst bewerken" en krijgen de velden hun kader terug; het headline-veld verschijnt dan pas, en de grote headline loopt live mee terwijl je typt. De kaart is opgedeeld in vier lagen: concept (de headline), copy (body en CTA), Details (visual en de ChatGPT-prompt) en "Waarom deze variatie werkt" (hypothese en Rory\'s reasoning als citaten) — die laatste twee staan ingeklapt, zodat de beoordeling voorop staat. Lege velden blijven verborgen tot je gaat bewerken. Zodra er variaties zijn, verbreedt de werkruimte zich naar de output en wijkt het inspiratiepaneel. Alle velden, IDs, sync-logica en knoppen zijn ongewijzigd — alleen de presentatie is anders. De oudere concept-details-inklapknop is vervangen door deze indeling.'
  },
  {
    version: '7.2',
    date: '2026-07-28',
    title: 'Intelligence: AI voelbaar door de hele workspace',
    desc: 'Tweede iteratie op de studio. Rechtsboven denkt een donker adviespaneel live mee: een Theriot-regel bij je gekozen funnel-fase, patronen uit je eigen bibliotheek (meest bewaarde format-archetype-combinatie) en de angle-stand van je gekozen persona — elk advies draagt zijn bron als badge. Het previewvak is een echte platform-mockup geworden: avatar, Gesponsord-label, je productfoto in beeld, en de verhouding springt live mee met je plaatsing (Feed 1:1, 4:5 of Story 9:16); ook de CTA verandert per funnel-fase. De 42 format-kaarten dragen nu funnel-fit (T/M/B volgens de Theriot-regels), bewijs- en CTA-eigenschappen, hoe vaak jij ze gebruikte, en een AANBEVOLEN-badge zodra een format bij je gekozen fase past. De productkaart links is een command center: foto-, ads- en USP-tellers, USP-chips en snel wisselen tussen producten. De Theriot-paragrafen zijn een visuele checklist geworden, en zodra alle vijf keuzes staan verandert de werkbalk-knop in "Klaar — genereer". Nergens verzonnen cijfers: alles komt uit je eigen data of uit benoemde kennisregels.'
  },
  {
    version: '7.1',
    date: '2026-07-28',
    title: 'Studio: het Statics-werkscherm als creative workspace',
    desc: 'Het werkscherm van Statics (en dus ook Kopieer ad en Itereren, die in hetzelfde scherm draaien) is omgebouwd van een lang formulier naar een studio met drie zones. Links staat alleen nog configuratie in accordions: product en plaatsing (met de productkaart), doelgroep en funnel, en de API-instellingen — dichtgeklapt met een samenvatting van je keuze, zodat je nooit alle instellingen tegelijk ziet. Het midden is het creatieve hart: de brain dump van Rory als donker AI-paneel bovenaan, het interview, en daaronder de format-kiezer met grotere, rustigere kaarten en de invalshoek. De genereer-knop plakt onderaan in beeld. Rechts is de lege ruimte een inspiratiepaneel geworden: een live-previewvak waar de variaties landen, het gekozen product groot in beeld met zijn USP\'s, en de drie checkpoints van Theriot. Bovenaan plakt een werkbalk met je keuzes als klikbare chips, een compleetheidsmeter en een directe genereer-knop. Alle velden, IDs en logica zijn onaangeraakt — de bestaande onderdelen zijn alleen herschikt. De productfoto\'s uit Producten worden nu ook op het dashboard correct herkend.'
  },
  {
    version: '7.0',
    date: '2026-07-28',
    title: 'Cockpit: het dashboard als bento-werkruimte',
    desc: 'Het dashboard is opnieuw opgebouwd als een volledig gevulde creative cockpit. Eén dominant grafietpaneel voert de boventoon: begroeting, het weekcijfer in een voortgangsring tegenover vorige week, de totalen en een 14-daagse activiteitsgrafiek. Daarnaast een amber actiemodule die uit je eigen data berekent wat de logische volgende stap is. Daaronder een fotografische product-spotlight (het product met de meeste ads, met grote foto of ontworpen placeholder), de creative pipeline met klikbare fasen, een donker prioriteitenpaneel met berekende taken, een mozaïek van recente creatives met één groot beeld, de twee leaderboards, concepten die klaarstaan voor iteratie en het weekritme. Elke module stuurt ergens heen en alles draait op bestaande data — niets is verzonnen. Statics en Kopieer ad volgen in dezelfde taal.'
  },
  {
    version: '6.1',
    date: '2026-07-28',
    title: 'Relief: diepte, hiërarchie en leven in de console',
    desc: 'Het dashboard kreeg een echte hiërarchie: Concepten is nu de grote hoofdstatistiek met een amber kaart, de andere tellers staan er compact naast, de getallen tellen op bij binnenkomst en de voortgangsbalken laden vloeiend naar hun stand. Zodra er bewaard werk is, verschijnt naast de begroeting een 14-daagse activiteitslijn met het verschil ten opzichte van vorige week, berekend uit je eigen bewaarmomenten. De zijbalk toont voortaan hoeveel er in Bibliotheek, Scripts, Persona\'s en Producten zit. Wijzigingen is een tijdlijn geworden met versie-knopen en inklapbare lange teksten. Lege lijsten leggen nu uit hoe je ze vult en hebben daar een knop voor. De drie soorten dropzones spreken dezelfde taal (rustig vlak, amber bij hover en slepen), de gele gloed rechtsonder is vervangen door een lichtinval linksboven, elke knop heeft een voelbare klik en toetsenbord-navigatie heeft overal een zichtbare focusring. Beweging respecteert de reduced-motion-instelling van je systeem.'
  },
  {
    version: '6.0',
    date: '2026-07-28',
    title: 'Daylight: volledige UI- en UX-herziening van de console',
    desc: 'De console gaat van donker-goud naar een lichte, warme werkomgeving met een zachte gradient-canvas. De zijbalk is een zwevend antracietpaneel met een amber-markering op het actieve item en een directe "Nieuwe ad"-knop; de topbar is doorzichtig met een waas, zodat wegscrollende inhoud er netjes onder verdwijnt in plaats van er doorheen. Kaarten zijn wit met een haarlijn en een zachte schaduw, knoppen en chips zijn pills (geel voor de hoofdactie, antraciet voor een actieve keuze), formuliervelden hebben een gele focusring, en tabellen, pop-ups en sleepzones volgen dezelfde taal. Het dashboard toont per statistiek een voortgangsbalk met context, en het succes-leaderboard staat als donker contrastpaneel tussen de lichte kaarten. Verder: de statusbolletjes botsten met de foutmelding-stijl en werden rode blokken (opgelost), elk tabblad heeft nu dezelfde goot, en het werkscherm geeft het formulier meer breedte zodat de 42 formats op drie kolommen passen. Wellshine draait dezelfde console met een koelere champagne-gloed, zodat je meteen ziet in welk merk je werkt.'
  },
  {
    version: '5.18',
    date: '2026-07-22',
    title: 'Fix: variaties genereren geeft geen 524-timeout meer',
    desc: 'Zware generaties dachten op vol vermogen soms langer dan 100 seconden na, waardoor Cloudflare de call afbrak met een 524-fout. Het denk-vermogen op die zware calls is nu begrensd (Fable 5 effort low), zodat een volledige generatie in seconden terugkomt in plaats van af te breken. De kleine strategische calls (interview, sparren) blijven op vol vermogen voor de kwaliteit.'
  },
  {
    version: '5.17',
    date: '2026-07-22',
    title: 'Fix: Bewerk/verwijder bij persona werkt weer (her-render-lus gestopt)',
    desc: 'De teststatus-lader van de persona-detail triggerde telkens een nieuwe render, waardoor knoppen als Bewerk constant werden herbouwd en je klik niet aankwam. De status laadt nu 1x per persona, zodat Bewerken, verwijderen en aanpassen weer soepel werken.'
  },
  {
    version: '5.16',
    date: '2026-07-22',
    title: 'Fix: verrijkte persona blijft betrouwbaar bewaard',
    desc: 'Verrijk met Rory pakt de persona nu vlak voor opslaan opnieuw bij id, zodat de gegenereerde stages en angles altijd blijven staan, ook als de team-sync tussentijds ververst.'
  },
  {
    version: '5.15',
    date: '2026-07-22',
    title: 'Rijke Customer Persona\'s: Schwartz-stages, angles per stage, direct een ad maken',
    desc: 'Persona\'s zijn nu een echt fundament. Klik een persona en je ziet zijn volledige identiteit: quote, marktaandeel, koopmotief, mislukte alternatieven, voordelen, plus de 5 Schwartz-awareness-stages met per stage een mindset en meerdere marketing-angles. Elke angle benoemt de emotie die hij raakt en het bezwaar dat hij wegneemt, en heeft een knop Nieuwe ad (kies zelf: diep interview of snelle generator, met persona/stage/angle al ingevuld). Rory bouwt de stages en angles met een klik (Verrijk met Rory) uit de pijnen, wensen, bezwaren en sophistication. Elke angle heeft een vast id, zodat de teststatus (getest / winner / ROAS) per angle vanzelf gaat vullen zodra je gaat testen (run supabase-creatives-angle.sql).'
  },
  {
    version: '5.14',
    date: '2026-07-22',
    title: 'Concept openklappen toont de varianten compact naast elkaar',
    desc: 'Als je een concept in de bibliotheek openklapt, staan de varianten nu in een raster naast elkaar in plaats van groot onder elkaar, zodat je alle varianten in een oogopslag overziet.'
  },
  {
    version: '5.13',
    date: '2026-07-22',
    title: 'Bestaande varianten worden ook als 1 concept gegroepeerd',
    desc: 'De concept-groepering in de bibliotheek werkt nu ook met terugwerkende kracht: varianten die dezelfde vaste hoek/boodschap delen (zoals 3 statics uit hetzelfde interview) worden als 1 concept-kaart getoond, ook als ze zijn gemaakt voor de groepering-update. Losse concepten met een eigen boodschap blijven aparte kaarten.'
  },
  {
    version: '5.12',
    date: '2026-07-22',
    title: 'Fix: concept-groepskaart correct weergegeven',
    desc: 'De nieuwe concept-groepskaart in de bibliotheek staat nu op volle breedte met thumbnails, titel en uitklap-pijl (de stijl belandde eerder per ongeluk alleen in de mobiele weergave).'
  },
  {
    version: '5.11',
    date: '2026-07-22',
    title: 'Bibliotheek groepeert varianten van dezelfde generatie als 1 concept',
    desc: 'Genereer je meerdere statics in 1 run (bijvoorbeeld 3 varianten op dezelfde boodschap uit het interview), dan worden ze nu als 1 concept-kaart in de bibliotheek gezet, met de thumbnails naast elkaar en de gedeelde boodschap als titel. Klik de kaart open en de losse varianten rollen eruit met al hun acties. Losse, oude concepten blijven gewoon als enkele kaart staan.'
  },
  {
    version: '5.10',
    date: '2026-07-22',
    title: 'Interview: klikbare voorbeeld-antwoorden onder de vraag',
    desc: 'In het Rory-interview verschijnen nu bij elke vraag 2 tot 4 korte voorbeeld-antwoorden als klikbare chips boven je typbalk. Klik er een en het antwoord springt in de balk, waar je het nog kunt aanpassen, of je typt gewoon zelf. Zo hoef je niet elk antwoord uit te typen.'
  },
  {
    version: '5.09',
    date: '2026-07-22',
    title: 'Interview-mode (wizard) voor statics: Rory vraagt door, Theriot scherpt, 3 statics',
    desc: 'Nieuw bij Nieuwe ad: een diep interview met Rory. Je start vanuit een persona (Rory laadt pijn, wensen, bezwaren en de testhistorie uit de creatives-tabel) of vanuit een losse angle. Rory stelt 1 vraag tegelijk, daagt je aanname uit en graaft naar de wortel, met een zichtbare checklist en een wat-we-weten-paneel dat live meebouwt. Als de hoek scherp is scherpt Theriot het visuele concept aan, en je krijgt een bewerkbare eindbriefing. Daarmee genereer je 3 statics op exact dezelfde boodschap (alleen de uitvoering varieert) via de bestaande GPT Image 2-pipeline.'
  },
  {
    version: '5.08',
    date: '2026-07-22',
    title: 'Analyse denkt in de 42 formats + 1 hypothese bij de werkwijze',
    desc: 'De brain-dump-analyse (Laat Rory analyseren) kiest voortaan een van de 42 formats in plaats van de oude 6 modes, en de werkwijze-kaart toont dat format, zodat kaart, picker en generatie gelijk lopen. Daarnaast geeft de analyse nu 1 heldere, toetsbare hypothese (Als we ... dan ... omdat ...) die bovenaan de werkwijze verschijnt en als overkoepelende hypothese aan de generatie wordt meegegeven, naast de bestaande hypothese-per-variant.'
  },
  {
    version: '5.07',
    date: '2026-07-22',
    title: '42-format systeem in Nieuwe ad (geport uit Atelier Console)',
    desc: 'De format-keuze bij Nieuwe ad is vervangen door 42 creatieve formats in 5 categorieen (Product-led, Social proof, Vergelijking & educatie, Native & lo-fi, Editorial & advertorial) met een filterbare picker. Elk format stuurt de generatie via eigen instructies plus stille anatomie-vlaggen (merkloos/branded, CTA hard-zacht-geen, Trustpilot ja/nee, bestemming PDP of advertorial), zodat de beeldkwaliteit behouden blijft. Kopieer en Ad transformer zijn ongewijzigd.'
  },
  {
    version: '5.06',
    date: '2026-07-22',
    title: 'Fix: afgekapte JSON bij genereren (Fable 5 adaptief denken)',
    desc: 'Fable 5 denkt adaptief na voordat het antwoordt, en dat denken verbruikt mee van de output-limiet. Daardoor werd bij het genereren van statics de JSON soms halverwege afgekapt (fout: Output was geen valide JSON). De tool geeft AI-calls nu ruim voldoende output-ruimte, zodat het denken en het volledige antwoord altijd passen. Uitzetten van het denken kan niet bij dit model.'
  },
  {
    version: '5.05',
    date: '2026-07-22',
    title: 'Fix: Spar met Fable-knop verscheen niet in Plan een test',
    desc: 'Twee fixes. (1) De gouden Spar met Fable-knop rechtsonder werd door een render-reset telkens verborgen; hij staat nu zichtbaar op elke stap in Plan een test. (2) Belangrijker: sinds Fable 5 het standaardmodel werd, gaf het model soms een thinking-blok als eerste content terug, waardoor de tool dacht dat het antwoord leeg was (leeg antwoord bij scripts, braindump, copywriter en de spar). De tool pakt nu altijd het echte tekst-blok, ongeacht thinking-blokken.'
  },
  {
    version: '5.04',
    date: '2026-07-04',
    title: 'Atelier Console-design samengevoegd met alle nieuwe features',
    desc: 'Het nieuwe Atelier Console-design (via Claude Design) is nu de basis van de tool, met daarin alles van v5.01 tot en met v5.03: het Creative Strategy-tabblad met de master-tabel, de plan-velden Angle en Format in de Scriptwriter, Fable 5 als standaard AI-model, de 10/10-poort voor de Copywriter, en de nieuwe Plan een test-modus met Fable als sparringpartner per stap.'
  },
  {
    version: '5.03',
    date: '2026-07-04',
    title: 'Plan een test: begeleide script-flow met Fable als sparringpartner per stap',
    desc: 'De Scriptwriter heeft een derde modus: Plan een test. Drie ingangen: gooi je eigen idee erin en Fable vertaalt het naar een plan (product, persona, angle, format, opening-scene), loop de stappen zelf langs met eigen-invoer op elke stap, of varieer op een winner uit de Creative Strategy-tabel waarbij je precies een variabele verandert. De volgorde is vrij: via de stappenbalk spring je overal heen. Op elke stap zit een spar-knop rechtsonder waarmee je met Fable overlegt; hij kent je keuzes, de persona-details en de testhistorie per angle, en eindigt met een concreet advies dat je kunt overnemen. Het plan eindigt met een bewerkbare hypothese, primaire metric en een ad-naam die de combinatie encodeert. Daarna vult het plan het formulier en schrijft Theriot; bij het bewaren landt alles als rij in de Creative Strategy-tabel, inclusief hypothese, geteste variabele en parent (run eenmalig supabase-creatives-uitbreiding.sql). Een plan zonder script bewaren kan ook, met status Not yet.'
  },
  {
    version: '5.02',
    date: '2026-07-04',
    title: 'Fable 5 als standaard AI-model + 10/10-poort voor de Copywriter',
    desc: 'De tool gebruikt nu standaard Claude Fable 5, het nieuwste en slimste Anthropic-model, voor alle tekst-taken: Scriptwriter, Copywriter, Ad transformer, analyses en Rory. Heb je eerder zelf een model gekozen, dan onthoudt de tool die keuze; zet hem in de instellingen op Fable 5 voor de beste output. Daarnaast heeft de Ogilvy-copywriter nu dezelfde harde 10/10-zelfcontrole als de Scriptwriter: acht controlepunten (stopt de headline een koude scroller, een belofte, feiten in plaats van adjectieven, opening zonder merknaam, funnel-match, geen contractbreuk met de creative, spreektaal, elke zin verdient zijn plek) waar de copy doorheen moet voordat je hem te zien krijgt.'
  },
  {
    version: '5.01',
    date: '2026-07-04',
    title: 'Creative Strategy master-tabel live in de tool + plan-velden in de Scriptwriter',
    desc: 'Nieuw tabblad Creative Strategy: de gedeelde master-tabel die jullie Test Tracker spiegelt, rechtstreeks op de teamserver. Elke rij toont plan (angle, format, persona, hook), cijfers (hook rate, CTR, ROAS en meer) en beslissing (status, score, next step), met filters op status, angle, format, product en persona, zoeken en paginering. Klik een rij aan om alles te bewerken of het gekoppelde script terug te lezen. Bewaar je een script in de Scriptwriter, dan landt het automatisch als rij met status To Test, inclusief de nieuwe plan-velden Angle type en Format die je nu vooraf kiest (Theriot bouwt het script er dan omheen). Bestaande rijen uit de Creative Strategy Map zet je over via Importeren: kopieer de rijen met kopregel uit de sheet en plak ze in het importpaneel.'
  },
  {
    version: '5.00',
    date: '2026-06-24',
    title: 'Scriptwriter 10/10-poort + fundament master Creative Strategy-tabel',
    desc: 'De Scriptwriter beoordeelt zijn eigen script nu eerst tegen een harde 8-punts rubric (verdient elke seconde de volgende, hook duidelijk en nieuw, show-dont-tell, awareness/sophistication-match, levendig mechanisme, echt bewijs, CTA neemt bezwaar weg, een core message) en herschrijft zwakke delen voor je het ziet, zodat de output consistenter 10/10 is. Daarnaast is het fundament gelegd voor het master Creative Strategy-bestand: een creatives-tabel (Team server/supabase-creatives-master.sql) die jullie Test Tracker spiegelt, waar scripts en creatives straks als rij in landen met plan, cijfers en beslissing.'
  },
  {
    version: '4.99',
    date: '2026-06-24',
    title: 'Succes-ranglijst: top makers op basis van ingevoerde advertentiecijfers',
    desc: 'Wanneer je bij Itereren de prestatiecijfers invult en opslaat, wordt het resultaat (ROAS, CTR, spend, AOV) nu vastgelegd gekoppeld aan jou als maker. Op het dashboard staat naast de meest-actief ranglijst nu ook een meeste-succes ranglijst: de top 5 makers op gemiddelde ROAS. Hiervoor moet eenmalig Team server/supabase-ad-resultaten.sql worden uitgevoerd.'
  },
  {
    version: '4.98',
    date: '2026-06-24',
    title: 'Leaderboard: top 5 meest actieve teamleden op het dashboard',
    desc: 'Op het dashboard staat nu een ranglijst van de vijf meest actieve teamleden, berekend uit het activiteitenlog (aantal acties plus aantal bewaarde ads per persoon), zichtbaar voor alle teamleden. Hiervoor moet eenmalig Team server/supabase-leaderboard-leesrechten.sql worden uitgevoerd. De succes-ranglijst (op basis van ingevoerde advertentiecijfers per maker) volgt als losse stap, want daarvoor moeten die cijfers eerst per ad worden vastgelegd.'
  },
  {
    version: '4.97',
    date: '2026-06-24',
    title: 'Fix: dashboard bleef leeg (scope-fout)',
    desc: 'Het dashboard verwees naar interne variabelen uit een ander script-blok, wat een stille fout gaf waardoor er niets werd getoond. Het leest die waarden nu veilig uit, zodat het dashboard zijn inhoud (welkomst, snelkoppelingen, cijfers, top-lijsten, recent) gewoon laat zien.'
  },
  {
    version: '4.96',
    date: '2026-06-24',
    title: 'Fix: dashboard toonde ook de generator eronder',
    desc: 'Bij het openen van het dashboard verscheen de Static Image Generator er ook bij, omdat de tab-wissel voor een onbekende tab terugviel op de generator als standaard. Het dashboard verbergt nu expliciet alle andere schermen, zodat alleen het dashboard zichtbaar is.'
  },
  {
    version: '4.95',
    date: '2026-06-24',
    title: 'Welkomstdashboard als startscherm',
    desc: 'De tool opent nu op een dashboard met persoonlijke welkomst, snelkoppelingen (nieuwe ad, kopieer, itereren, bibliotheek), je systeem-cijfers (producten, persona-s, concepten, scripts), recent bewaarde concepten om direct verder te pakken, en voor admins het aantal teamleden dat op goedkeuring wacht plus wat-is-nieuw. Nieuw: een Top producten en Top invalshoeken (berekend uit je bibliotheek) zodat je ziet waar jullie het meest op inzetten. Bereikbaar via Dashboard in de zijbalk.'
  },
  {
    version: '4.94',
    date: '2026-06-24',
    title: 'Generator-blokken opener en overzichtelijker (meer ruimte)',
    desc: 'De blokken voelden rommelig en dicht op elkaar. De tegelrasters (format mode, archetype) stonden op auto-fill met krappe gaten, wat rafelige rijen gaf; die staan nu op een gelijkmatig 4-koloms raster met ruimere tussenruimte en luchtigere tegels. De secties zijn niet langer losse kaders maar staan open, gescheiden door een dunne gouden lijn, met flink meer ruimte tussen de blokken. Rustiger en overzichtelijker.'
  },
  {
    version: '4.93',
    date: '2026-06-24',
    title: 'Koppen in geextrudeerd goud (typografie)',
    desc: 'De sectie-koppen in de generator (Format & bestemming, Doelgroep & funnel, Creatieve invalshoek) staan nu in Bebas Neue met echte 3D-diepte in goud, in lijn met de cinematic productnaam. Geen platte erop-gedrukte tekst meer. Derde stap van de restyling.'
  },
  {
    version: '4.92',
    date: '2026-06-24',
    title: 'Verfijnde dropdowns in de generator (cinematic stijl)',
    desc: 'De systeem-achtige keuze-velden zijn vervangen door een verfijnd, donker paneel met gouden accent-streep, een chevron die draait, en opties die in goud oplichten met een vinkje bij de gekozene. De onderliggende keuzes en logica blijven exact hetzelfde; alleen de presentatie is vernieuwd. Tweede stap van de generator-restyling.'
  },
  {
    version: '4.91',
    date: '2026-06-24',
    title: 'Productweergave vernieuwd (cinematic)',
    desc: 'De saaie productfoto-met-naam is vervangen door een cinematic weergave: de productnaam groot als achtergrond-laag achter het product, het product met diepteschaduw dat licht oplicht bij hover, zwevende gouden stipjes, en de naam ervoor in geextrudeerde 3D-letters in plaats van plat erop gedrukt. Eerste stap van de generator-restyling, per element.'
  },
  {
    version: '4.90',
    date: '2026-06-24',
    title: 'Begeleide reis (Begeleid maken) er weer uit gehaald',
    desc: 'De begeleide stap-voor-stap reis is op verzoek volledig verwijderd (knop, scherm en code). De generator werkt weer puur via het gewone formulier. De rest blijft: de reveal-animatie en micro-interacties, de schuif-overgangen tussen secties, de bibliotheek-drill-in en de data-fix voor productwijzigingen.'
  },
  {
    version: '4.89',
    date: '2026-06-24',
    title: 'Fix: productwijzigingen (fotovolgorde, toegevoegde fotos) sprongen terug na herladen',
    desc: 'Sinds de fotos in IndexedDB zitten, las de app bij het opstarten de opgeslagen productwijzigingen te vroeg, namelijk voordat die opslag geladen was. Daardoor zette hij de standaardproducten terug naar hun originele staat en sloeg dat ook nog op, over je eigen wijzigingen heen. Nu slaat de app niets op zolang de opslag nog niet geladen is, en worden je wijzigingen (fotovolgorde, toegevoegde lifestylefotos, eigen producten) netjes behouden. Je data stond altijd nog veilig op de teamserver; dit voorkomt dat de lokale standaard eroverheen schreef.'
  },
  {
    version: '4.88',
    date: '2026-06-24',
    title: 'Begeleide reis: pagina voor pagina een ad opzetten (naast het formulier)',
    desc: 'Bovenaan de generator staat nu een knop Begeleid maken. Die opent een rustige, volledig-scherm reis: eerst de keuze om Rory alles te laten opzetten of zelf stap voor stap te gaan. Bij zelf kies je per pagina een ding (product, format, persona, funnel, archetype, invalshoek) en elke keuze schuift je automatisch en horizontaal door naar de volgende, met een voortgangsbalk en kruimelpad, eindigend op een overzicht met de genereer-knop. Rory vult dezelfde keuzes in een keer in en zet je meteen op het overzicht. Onder water bestuurt de reis gewoon het bestaande formulier, dat blijft ook los bruikbaar.'
  },
  {
    version: '4.87',
    date: '2026-06-24',
    title: 'Genereer-wizard teruggedraaid (voelde te veel als opgeknipt formulier)',
    desc: 'De begeleide stap-voor-stap wizard uit v4.86 is er weer uit. Het gewone generatie-formulier is terug zoals het was. De delight-laag (reveal, micro-interacties, toasts) en de diepte uit fase 2a (schuif-overgangen tussen secties en de bibliotheek-drill-in) blijven gewoon staan. We herontwerpen de begeleide reis opnieuw.'
  },
  {
    version: '4.86',
    date: '2026-06-24',
    title: 'Genereer-wizard: stap voor stap door de creatieve keuzes, met snelle modus',
    desc: 'Het genereren is nu een begeleide reis. In plaats van het hele formulier in een keer, loop je stap voor stap door de drie secties (Format & bestemming, Doelgroep & funnel, Creatieve invalshoek) met een kruimelpad, een voortgangsbalk en Vorige/Volgende. De genereer-knop verschijnt op de laatste stap. Heb je haast of werk je veel, klik dan rechtsboven op Snelle modus: dan staat alles weer op een scherm zoals voorheen. De keuze wordt onthouden. Werkt alleen in de gewone generator (niet in Kopieer/Itereren) en de velden en logica zijn ongewijzigd.'
  },
  {
    version: '4.85',
    date: '2026-06-24',
    title: 'Pagina-overgang duidelijker zichtbaar gemaakt',
    desc: 'De schuif-overgang bij het wisselen van secties was te subtiel. De nieuwe sectie schuift nu zichtbaar van rechts in beeld met een vleugje schaal, in plaats van een klein omhoog-schuifje.'
  },
  {
    version: '4.84',
    date: '2026-06-24',
    title: 'Diepte: schuif-overgangen tussen secties + bibliotheek-drill-in',
    desc: 'Eerste deel van fase 2. Bij het wisselen tussen secties schuift de nieuwe pagina nu zacht in beeld in plaats van hard te wisselen, zodat het voelt alsof je ergens "in" gaat. En in de Bibliotheek kun je nu op een bewaard concept klikken: het zoomt open naar een eigen detaillaag (groot beeld, headline, body, details) met dezelfde acties (bekijk in generator, itereer, kopieer prompt, download, verwijder). Klik op de kruis of naast de laag om terug te gaan. Respecteert verminderde beweging.'
  },
  {
    version: '4.83',
    date: '2026-06-24',
    title: 'Delight-laag: reveal-animatie, levende wachtstaat en fijnere interacties',
    desc: 'Eerste stap in een speelser, belonender gevoel. Bij het genereren van een beeld zie je nu een levende wachtstaat die meevertelt wat er gebeurt (Theriot kiest de hook, beeld wordt gerenderd, ...), en als het beeld klaar is komt het binnen met een gouden veeg, een zachte inschiet-animatie en een korte vonken-celebratie. Knoppen en navigatie hebben nu een subtiel hover- en indruk-gevoel, de meldingen (toasts) hebben een icoon en schuiven netjes in, en bij Bewaar concept pulseert de Bibliotheek-knop kort. Alles respecteert de systeeminstelling voor verminderde beweging.'
  },
  {
    version: '4.82',
    date: '2026-06-24',
    title: 'Proxy-uitleg tab verwijderd (overbodig door teamserver)',
    desc: 'De tab "Proxy uitleg" onder Instellingen is verwijderd. Sinds alle AI-calls via de gedeelde teamserver lopen, hoeft niemand nog een eigen proxy of API-sleutels in te stellen, dus de uitleg was overbodig. De handleiding-stap die ernaar verwees is bijgewerkt naar de teamserver-situatie.'
  },
  {
    version: '4.81',
    date: '2026-06-24',
    title: 'Grote opslag: zware foto-data nu in IndexedDB i.p.v. de kleine browseropslag',
    desc: 'De zware data (producten, bibliotheek en scripts, inclusief alle foto\u0027s) werd in de kleine browseropslag (~5 MB) bewaard, die kon vollopen waardoor foto\u0027s soms verdwenen. Die data staat nu in IndexedDB, een veel ruimere lokale opslag (honderden MB), met een geheugenlaag ertussen zodat de app verder onveranderd werkt. Bestaande foto\u0027s worden bij het eerste openen automatisch eenmalig verplaatst. De teamserver (Supabase) blijft de bron en blijft synchroniseren, dus je data is dubbel veilig.'
  },
  {
    version: '4.80',
    date: '2026-06-19',
    title: 'Rollen (admin/member/guest) en een activiteitenlogboek',
    desc: 'Teamleden hebben nu een rol. Admin en member hebben volledige toegang (generator en bibliotheek) en mogen opslaan; een guest ziet alleen de bibliotheek, niet de generator, en kan niets opslaan. De rol stel je per persoon in onder Teamleden beheren. Daarnaast wordt elke wijziging in de gedeelde data (bibliotheek, scripts, producten, persona\u0027s, merk-instellingen) automatisch vastgelegd: wie, wat en wanneer. Dat log bekijk je in het nieuwe tabblad Logboek in datzelfde beheerpaneel. Het loggen en de rolbeperking worden ook in de database afgedwongen (Team server/supabase-rollen-en-logboek.sql eenmalig uitvoeren).'
  },
  {
    version: '4.79',
    date: '2026-06-19',
    title: 'Teller wachtende aanmeldingen ververst nu ook bij terugkeren op het tabblad',
    desc: 'De knop "Teamleden beheren" toont het aantal teamleden dat op goedkeuring wacht. Die teller werd al bijgewerkt bij het openen en na elke goed/afkeuring; nu ook zodra je terugkomt op het tabblad, zodat je nieuwe aanmeldingen ziet zonder de pagina te herladen.'
  },
  {
    version: '4.78',
    date: '2026-06-19',
    title: 'Inloggen/aanmelden met Google, Facebook of Apple',
    desc: 'Naast e-mail en wachtwoord kunnen teamleden zich nu ook aanmelden met hun Google-, Facebook- of Apple-account. Ook deze aanmeldingen komen in de goedkeuringswachtrij, dus je houdt de controle. De social-knoppen werken pas zodra de betreffende provider is aangezet in Supabase (Authentication > Sign In / Providers) met de juiste sleutels uit Google/Facebook/Apple.'
  },
  {
    version: '4.77',
    date: '2026-06-19',
    title: 'Echt inlogsysteem met zelf aanmelden en goedkeuringswachtrij',
    desc: 'Het gedeelde wachtwoord is vervangen door een volwaardig inlogsysteem (Supabase Auth). Teamleden maken zelf een account aan met naam, e-mail en eigen wachtwoord. Na aanmelden komen ze in een wachtstand en zien ze de melding dat hun account op goedkeuring wacht. De beheerder krijgt onderaan de zijbalk de knop "Teamleden beheren" (met een teller van het aantal wachtenden) en kan daar per persoon Goedkeuren of Afwijzen. Pas na goedkeuring krijgt iemand toegang tot de data. Hiervoor moet eenmalig het script Team server/supabase-teamtoegang.sql in Supabase worden uitgevoerd.'
  },
  {
    version: '4.76',
    date: '2026-06-19',
    title: 'Wellshave-logo in de zijbalk',
    desc: 'Het Wellshave-logo bovenaan de zijbalk is vervangen door de offici\u00eble merk-versie (het aangeleverde logobestand).'
  },
  {
    version: '4.75',
    date: '2026-06-19',
    title: 'Inloggen vervangen door één gedeeld teamwachtwoord (geen e-mail meer)',
    desc: 'Het inlogscherm vroeg eerst om e-mail plus wachtwoord (Supabase Auth). Dat is nu vervangen door één simpel toegangsscherm met alleen een gedeeld teamwachtwoord, geen e-mail en geen accounts meer. Wie het wachtwoord weet, is meteen binnen en blijft binnen tot hij op "Vergrendelen" klikt (onderaan de zijbalk). Let op: dit is een toegangsslot op het scherm; de gedeelde database staat hiervoor weer open voor de app-sleutel. Het wachtwoord pas je aan in de code (GATE_PASSWORD) en de bijbehorende database-instelling staat in supabase-toegang-open.sql.'
  },
  {
    version: '4.74',
    date: '2026-06-09',
    title: 'Statusbadges tonen teamserver + volle browseropslag verliest geen data meer',
    desc: 'Rechtsboven stond Anthropic en OpenAI op "niet ingesteld", terwijl de sleutels juist veilig op de teamserver (de proxy) staan en niet in de browser horen. Dat toont nu correct "via teamserver" zodra de proxy actief is. Daarnaast: de browser heeft maar een beperkte lokale opslag, en die kan vollopen door alle foto\'s (producten en bewaarde concepten). Eerder gaf dat een rode foutmelding en kon je een net opgeslagen wijziging kwijtraken. Nu wordt elke wijziging hoe dan ook naar de teamserver geschreven, ook als de lokale opslag vol is, en maakt de app lokaal automatisch ruimte vrij in plaats van een fout te geven. Je data blijft dus veilig op de server, ook als je browser vol zit.'
  },
  {
    version: '4.73',
    date: '2026-06-09',
    title: 'Gebruiksfoto\'s per product + kiezen welke referenties het beeldmodel volgt',
    desc: 'Bij een product kun je nu naast product-, lifestyle- en verpakkingsfoto\'s ook Gebruiksfoto\'s toevoegen: het product in actie, zodat de AI ziet hoe het correct wordt vastgehouden en gebruikt. Bij het genereren staat er een nieuwe keuze Beeld-referenties waarmee je vooraf instelt of het beeldmodel de lifestylefoto\'s, de gebruiksfoto\'s, allebei of alleen de productshots als visuele referentie meekrijgt. Zijn er gebruiksfoto\'s, dan krijgt het model de harde instructie het product op exact dezelfde correcte manier weer te geven en nooit een verkeerde of onmogelijke toepassing te verzinnen.'
  },
  {
    version: '4.72',
    date: '2026-06-09',
    title: 'Opgeslagen lifestyle/productfoto\'s verdwijnen niet meer na opslaan',
    desc: 'Productreferenties (lifestyle-, product- en verpakkingsfoto\'s) worden gedeeld via de teamserver. De app haalde bij elke vensterfocus en herlaad de cloud-versie op en zette die over je lokale data heen. Sloeg je net een zware foto op terwijl de upload naar de cloud nog liep (of even faalde), dan kon de oudere cloud-versie je nieuwe foto meteen weer overschrijven, vandaar dat ze telkens verdwenen. Vanaf nu wordt een net opgeslagen wijziging beschermd: hij wordt pas door de cloud-versie vervangen nadat hij daar bevestigd is opgeslagen, en mislukt het uploaden even, dan probeert de app het automatisch opnieuw in plaats van je foto kwijt te raken.'
  },
  {
    version: '4.71',
    date: '2026-06-09',
    title: 'Visual-veld, Rory in de bibliotheek, Theriot-matrix, itereer-knop en sterkere conceptrichting',
    desc: 'Elke variatie heeft nu een apart Visual-veld dat in gewone taal beschrijft wat je op het beeld te zien krijgt, los van de technische ChatGPT-prompt. In de bibliotheek staan onder elk bewaard concept nu de visual-beschrijving plus Rory\'s hypothese en reasoning, en kun je per creative een Static ad matrix (Theriot-scorecard: hook, proof, avatar/desire, purple cow, sophistication, awareness, score, notities) invullen die automatisch wordt opgeslagen. Met de knop Itereer op deze laad je de creative (beeld, product, persona, concept) direct in het itereren-scherm, waarna je alleen nog de cijfers invult. Tot slot reageert de generator nu veel sterker op je conceptrichting: ook een analogie of metafoor (zoals het product als de bumper van een auto) wordt nu letterlijk in beeld vertaald, en de conceptrichting gaat voor op de standaardlook van de gekozen format-mode, zodat het idee ook in een strak format zoals Feature-Education zichtbaar wordt.'
  },
  {
    version: '4.70',
    date: '2026-06-09',
    title: 'Genummerde secties (zoals Format & bestemming) lopen nu over de volle breedte',
    desc: 'De sectie Format & bestemming stond in een halve kolom van het formulier, waardoor de rechterkant in het midden eindigde in plaats van gelijk met het Plaatsing-veld. De genummerde stap-secties spannen nu de volledige breedte, dus de tegels liggen horizontaal over de hele lengte van het blok en de rechterrand loopt gelijk met die van Plaatsing.'
  },
  {
    version: '4.69',
    date: '2026-06-09',
    title: 'Format mode-tegels liggen horizontaler (meer per rij)',
    desc: 'De keuzetegels onder Format & bestemming pasten zich te traag aan de breedte aan, waardoor er meestal maar 2 naast elkaar stonden en het blok onnodig hoog werd. Ze passen nu vanaf een smallere breedte al met 3 (of meer) naast elkaar, gelijk aan de archetype-tegels eronder, dus het blok ligt platter en overzichtelijker.'
  },
  {
    version: '4.68',
    date: '2026-06-09',
    title: 'Ingelogd blijven na verversen',
    desc: 'Wie eenmaal is ingelogd, blijft nu ingelogd, ook als je de pagina ververst of de tab/browser sluit en later terugkomt. De sessie wordt veilig in je browser bewaard en het toegangstoken wordt automatisch op de achtergrond ververst, dus je hoeft niet telkens opnieuw je e-mail en wachtwoord in te vullen. Je blijft ingelogd tot je zelf op Uitloggen klikt (onderaan de zijbalk). Wil je een harde tijdslimiet (bijvoorbeeld na 7 dagen opnieuw inloggen), dan kan dat ingesteld worden in Supabase onder Authentication.'
  },
  {
    version: '4.67',
    date: '2026-06-09',
    title: 'Headline/body/CTA synchroniseren nu echt live met de ChatGPT-prompt + concept-richting stuurt de scene',
    desc: 'Als je een headline, body of CTA aanpast, verandert de ChatGPT-prompt nu mee, ook als die de tekst in HOOFDLETTERS bevat (dat was de reden dat het eerder vaak niet pakte) en ook bij een tweede of derde aanpassing achter elkaar. Je hoeft de oude tekst niet meer handmatig uit de prompt te halen. Daarnaast weegt de concept-richting die je opgeeft nu veel zwaarder: beschrijf je een scene of gevoel (bijvoorbeeld iemand die het cadeau aan zijn vader geeft en een zichtbaar blije ontvanger), dan moet het gegenereerde beeld die situatie en emotie ook echt tonen, niet alleen de overlay-tekst.'
  },
  {
    version: '4.66',
    date: '2026-06-08',
    title: 'Trustpilot aantal reviews volgt nu de merkinstelling (niet meer hardcoded 800+)',
    desc: 'Het aantal Trustpilot-reviews stond op meerdere plekken nog vast op 800+ in de prompts, waardoor de beeldgeneratie dat letterlijke getal in de Trustpilot-badge zette, ook als je in Merk-instellingen iets anders had ingesteld (bijvoorbeeld 817+). Die hardcoded aantallen in de ad-instructies verwijzen nu naar het aantal uit de merkgegevens, dus de badge toont voortaan exact wat je bij Merk-instellingen invult. De Trustpilot-score, het klantaantal en de garantie staan in de prompts nog wel vast; die kan dezelfde behandeling krijgen als je dat wilt.'
  },
  {
    version: '4.65',
    date: '2026-06-08',
    title: 'Login op het platform (Supabase Auth) en database vergrendeld',
    desc: 'Bij het openen van de tool kom je nu op een inlogscherm: alleen teamleden met een account (e-mail plus wachtwoord) kunnen erin. De synchronisatie start pas na het inloggen, en de database is zo afgeschermd dat alleen ingelogde gebruikers de data kunnen lezen of aanpassen, dus dit beschermt ook de gegevens zelf, niet alleen het scherm. Je blijft ingelogd tot je op Uitloggen klikt (onderaan de zijbalk). Accounts beheer je in Supabase onder Authentication.'
  },
  {
    version: '4.64',
    date: '2026-06-08',
    title: 'Copywriter vereenvoudigd: een copy, drie headlines, een CTA',
    desc: 'De Meta ad copy gaf eerder drie lengte-varianten van de primary text (kort, middel, lang) plus vijf headlines en twee descriptions, wat onnodig en verwarrend was voor een enkele ad. Nu levert de Copywriter precies wat je voor een ad gebruikt: EEN primary text waarvan de lengte automatisch is afgestemd op de funnel-fase en awareness (kort en punchy bij koud verkeer, langer en verhalend bij retargeting), drie headlines om uit te kiezen, en de aanbevolen CTA-knop. De link-descriptions zijn eruit, want die zijn optioneel en worden vaak niet eens getoond.'
  },
  {
    version: '4.63',
    date: '2026-06-08',
    title: 'Wellshave-restyle: Cognac-thema (warm bruin-zwart met brons-goud)',
    desc: 'De Wellshave-kant heeft een nieuwe, luxere look gekregen, richting Cognac: een warm bruin-zwart als basis met brons- en cognac-gouden accenten in plaats van het koele goud. De koppen, knoppen, actieve menu-items, kaarten en de achtergrond zijn warmer en mannelijker. Technisch via een nieuw thema-blok op body.brand-wellshave en een themeable goud-variabele, zodat alles netjes meekleurt; Wellshine blijft ongemoeid op zijn eigen look. De ad-output zelf (het echte merkgoud in de advertenties) verandert niet, dit is puur de interface.'
  },
  {
    version: '4.62',
    date: '2026-06-08',
    title: 'Sync sneller: bij elke refresh meteen de nieuwste teamdata',
    desc: 'In 4.61 haalde de app de cloud maar een keer per sessie op, waardoor een collega na een refresh soms 1 tot 2 minuten op de live-update moest wachten. Nu haalt de app bij elke pagina-load (en zodra het tabblad weer focus krijgt) direct de nieuwste teamdata op en ververst de schermen meteen, zonder herlaad-truc. Een refresh laat dus altijd binnen een seconde de actuele producten, personas, bibliotheek en scripts zien.'
  },
  {
    version: '4.61',
    date: '2026-06-08',
    title: 'Fase 2 team-server: alles wordt online opgeslagen en live gesynchroniseerd',
    desc: 'De data zit niet meer alleen lokaal in je browser, maar centraal in de gedeelde database (Supabase). Producten, personas, de bibliotheek, de script-bibliotheek en de merkinstellingen worden automatisch online opgeslagen zodra je iets toevoegt, aanpast of verwijdert, en wijzigingen van teamleden komen live binnen. Bij het openen haalt de app de nieuwste teamdata op; je browser houdt alleen een werkkopie, de cloud is de bron. Per merk gescheiden (Wellshave en Wellshine). Daarnaast is de oude debug-overlay verwijderd.'
  },
  {
    version: '4.60',
    date: '2026-06-08',
    title: 'Fase 1 team-server: alle AI-calls via de gedeelde proxy, geen losse keys of lokale proxy meer',
    desc: 'De app praat nu met een gedeelde Cloudflare Worker waarop de Anthropic- en OpenAI-sleutels als secret staan. Alle Claude-calls gaan via de Worker (de x-api-key zit niet meer in de browser) en alle OpenAI-beeldcalls lopen via dezelfde Worker in plaats van een lokale proxy op localhost. Niemand hoeft nog een API-key in te vullen of een Python-proxy te draaien; iedereen opent gewoon de gehoste app. Dit is fase 1; de gedeelde database met automatische opslag en live sync tussen teamleden (Supabase) komt in fase 2.'
  },
  {
    version: '4.59',
    date: '2026-06-07',
    title: 'Script-bibliotheek toegevoegd, en de tool heet nu Static Image Generator',
    desc: 'Twee dingen. (1) Er is een aparte Script-bibliotheek (nav onder Bibliotheek, naast de gewone bibliotheek). Onder elk script in de Scriptwriter staat nu Bewaar in script-bibliotheek. Bij een nieuw script bewaren we het script plus de opzet; bij een iteratie bewaren we de HELE combinatie: het bronscript, de ingevulde cijfers en het resulterende script, zodat je later precies terugziet vanuit welke advertentie en welke performance dit is gelanceerd. In de tab open je elk bewaard script, zie je bij iteraties de bron en cijfers, en kun je het als PDF downloaden of verwijderen. Lokaal per merk en dus mee in de back-up. (2) De tool heet nu Static Image Generator in plaats van Static Ad Generator.'
  },
  {
    version: '4.58',
    date: '2026-06-07',
    title: 'Scriptwriter-iteratie: volledige video-metrics plus screenshot-upload',
    desc: 'De modus Itereer een bestaand script werkt nu met de volledige video-metrics in plaats van vier losse velden. Je vult Performance, Clicks, Engagement, de Media-groep (video avg. play time, video plays, 3s plays, ThruPlays, 1st frame retention, thumbstop/hook rate, hold rate, sustain rate, 15s/3s), de Conversion funnel en Conversions in. Net als bij de ad-iteratie kun je een screenshot van je dashboard (Atria of Meta) uploaden; de AI leest de cijfers uit en vult de velden vanzelf in. Theriot leest vervolgens de hele video-funnel (stopt de hook, houdt de body vast, neemt de CTA de onzekerheid weg, of zit het knelpunt na de klik) en levert een gerichte iteratie van het script.'
  },
  {
    version: '4.57',
    date: '2026-06-07',
    title: 'Scriptwriter: overzichtelijke output, casting-brief, PDF-download en script-iteratie',
    desc: 'Vier verbeteringen aan de Scriptwriter. (1) De output stond eerder als platte tekst op elkaar gestapeld; nu is het opgemaakt in duidelijke secties (strategie, casting, hooks, body, CTA\'s) met grotere tekst, losse kaarten per hook, beat en CTA, en het beeld apart van de gesproken tekst. (2) Er is een casting-brief toegevoegd: wie het script moet spelen, hoe die persoon eruit moet zien en aan welke eisen die voldoet (type, geslacht en leeftijd, uiterlijk, vereisten, setting en energie). (3) Onderaan kun je het script als nette PDF downloaden in een schone, printbare opmaak. (4) Nieuwe modus Itereer een bestaand script: plak een script dat al gedraaid heeft plus de cijfers (hook rate, hold rate, CTR, CVR/CPA), en Theriot diagnosticeert waar het knelt en levert een verbeterde versie in hetzelfde format die de winnende delen vasthoudt. Boven de Scriptwriter schakel je tussen Nieuw script en Itereren.'
  },
  {
    version: '4.56',
    date: '2026-06-07',
    title: 'Braindump vult nu ook sophistication en awareness, en de Scriptwriter krijgt de generator-flow',
    desc: 'Twee dingen. (1) De braindump in de Generator liet market sophistication en customer awareness op auto staan; nu bepaalt hij die ook (op basis van de richting, en anders vanuit de aanbeveling van de gekozen persona) en vult hij de velden in. (2) De Scriptwriter is opgewaardeerd naar dezelfde werkwijze als de Generator: bovenaan kun je nu je idee droppen en op Laat Theriot de opzet bepalen klikken. Theriot kiest dan de funnel-fase, awareness, sophistication, casting en de angle en vult de velden in, met een korte onderbouwing. Er is ook een Market sophistication-veld toegevoegd dat meegaat in het script. Zo ga je net als bij de Generator van een idee naar een volledige opzet, en krijg je een rijker, scherper script in plaats van een dunne briefing. De Theriot-labels in de Scriptwriter zijn meteen rechtgezet.'
  },
  {
    version: '4.55',
    date: '2026-06-07',
    title: 'SOP herschreven tot leidend handboek: overzichtelijk per onderwerp, stap voor stap',
    desc: 'De SOP-tab is omgebouwd tot het leidende document voor iedereen die met de tool werkt. Bovenaan staat een inhoudsopgave met snelkoppelingen, daaronder een aparte sectie per onderwerp, elk met genummerde stappen: eenmalige setup (API-keys, proxy, merk kiezen), de twee breinen, je data klaarzetten (producten, personas, merkinstellingen), de drie generatie-manieren (vanaf nul, kopieren, itereren), de Ad transformer met foto-scorecard, de Copywriter, de Scriptwriter, een beeld bijsturen, de Bibliotheek, back-up en overdragen, en een sectie snelle probleemoplossing. Zo kan iedereen in het team elke stap snappen, doen en begrijpen.'
  },
  {
    version: '4.54',
    date: '2026-06-07',
    title: 'SOP uitgebreid: uitleg over de twee breinen en hoe je ze gebruikt',
    desc: 'In de SOP-tab staat nu een sectie die de twee creatieve breinen uitlegt. Wat ze zijn (Theriot het uitvoeringsbrein voor ad-generatie, Scriptwriter, cijfer-diagnose en de foto-scorecard; Rory het ideevormingsbrein voor de concept- en angle-suggesties en de braindump; Ogilvy als aparte copywriter), wanneer elk brein automatisch actief is, en een stap-voor-stap werkwijze: eerst met Rory de angle bepalen, dan met Theriot bouwen, bij Itereren laat je Theriot op de cijfers beslissen, en een losse hero-foto scoor je eerst voor je rendert. Zo werkt iedereen in het team met dezelfde logica.'
  },
  {
    version: '4.53',
    date: '2026-06-07',
    title: 'Twee breinen, automatisch gerouteerd: Theriot voert uit, Rory bedenkt de angle',
    desc: 'De generator gebruikt nu twee creatieve breinen en kiest zelf welk brein bij welke taak past, je hoeft nergens te schakelen. Nick Theriot (direct-response media buyer) is het uitvoeringsbrein: hij stuurt de ad-generatie (Generator, Kopieer ad, Itereren), de Scriptwriter, de cijfer-diagnose bij itereren, en de foto-beoordeling, die nu een echte scorecard is (cijfer 0-10, wat de scroll stopt, grootste zwakte). Zijn systeem (awareness x sophistication, de 13 hook-patronen, show-don\'t-tell, but-and-so, bewijs) zit in de prompts gebakken. Rory Sutherland blijft het ideevormingsbrein voor de concept- en angle-suggesties en de braindump-intake, waar zijn contraire reframe het sterkst is. De Copywriter blijft Ogilvy. Zo krijg je de strateeg vooraf en de uitvoerder bij het bouwen, zonder zelf te kiezen.'
  },
  {
    version: '4.52',
    date: '2026-06-07',
    title: 'Rory\'s denkwijze blijft bewaard bij opgeslagen iteraties',
    desc: 'Als je een gegenereerde iteratie opslaat in de bibliotheek, wordt nu het volledige iteratieplan van Rory mee bewaard: de cijfer-diagnose, de grootste kans, de aanpak, de creatieve richting, de gekozen testdimensies, de iteratie-hypotheses en wat vastgehouden of veilig getest mocht worden, plus de specifieke hypothese van die ene variant. Het verschijnt onder Hoe is deze gemaakt, zowel meteen bij de resultaten als later in de bibliotheek. Zo kun je altijd terugkijken wat de gedachtegang achter een iteratie was en gaat die kennis niet verloren. De data zit in de metadata van het bewaarde item en dus ook in de per-merk back-up.'
  },
  {
    version: '4.51',
    date: '2026-06-07',
    title: 'Rory bepaalt meteen de creatieve richting en vult die in voor de iteraties',
    desc: 'De analyse en de generatie sluiten nu volledig op elkaar aan. Naast de diagnose, de aanpak, de hypotheses en de gekozen testdimensies bepaalt Rory nu ook de creatieve richting: een concrete brief voor de iteraties die rechtstreeks uit de cijfer-diagnose volgt. Die richting verschijnt in het iteratieplan en wordt automatisch ingevuld in het veld Extra richting voor de iteraties (alleen als je dat veld nog leeg hebt gelaten, zodat je eigen invoer nooit wordt overschreven). Klik je daarna op Analyseer en genereer iteraties, dan staat alles, testdimensies en creatieve richting, al klaar en op elkaar afgestemd. De richting gaat ook mee in de generatie-prompt.'
  },
  {
    version: '4.50',
    date: '2026-06-07',
    title: 'Itereer-analyse crash-proof: arrayvelden worden genormaliseerd',
    desc: 'De analyse kwam goed terug en koos al de testdimensies, maar het tonen ervan kon stuk gaan met "arr.map is not a function" als het model een lijst-veld als losse tekst i.p.v. een array teruggaf. Opgelost: zodra de analyse binnenkomt worden alle lijst-velden (iteratie-hypotheses, waarom-werkt-dit, vasthouden, veilig-te-testen en de gekozen dimensies) genormaliseerd naar echte arrays, en de weergave en de generatie-prompt controleren nu expliciet op een array voordat ze die doorlopen. De analyse kan hierdoor niet meer crashen op een afwijkend antwoord-formaat.'
  },
  {
    version: '4.49',
    date: '2026-06-07',
    title: 'Itereer-analyse model-onafhankelijk gemaakt (tool use i.p.v. prefill)',
    desc: 'De JSON-afdwinging via assistant-prefill uit 4.48 werkte niet op elk model (sommige modellen weigeren een voorgevulde assistant-respons). Vervangen door tool use: de analyse-stap roept nu een vast gedefinieerde tool aan met een strikt schema, wat op alle Claude-modellen betrouwbaar gestructureerde output geeft. Rory levert zo gegarandeerd de diagnose, de aanpak, de iteratie-hypotheses en de gekozen testdimensies terug, met een tekst-fallback voor het onwaarschijnlijke geval dat er toch geen tool-respons komt. Functioneel verandert er niets aan het iteratieplan zelf.'
  },
  {
    version: '4.48',
    date: '2026-06-07',
    title: 'Itereren: Rory bekijkt de foto en de cijfers en trekt zelf een iteratieplan (plus JSON-bug gefixt)',
    desc: 'De analyse-stap in Itereren faalde soms met "geen JSON in respons": de uitgebreidere analyse-prompt liet het model af en toe in proza antwoorden of liep tegen de token-limiet aan. Opgelost door het antwoord af te dwingen als JSON (de assistant-respons wordt voorgevuld met een accolade, ruimere token-limiet, en een robuustere parser die ook code-fences negeert). Tegelijk is de stap uitgebreid: Rory bekijkt nu expliciet de advertentiefoto EN leest de cijfers als funnel, en trekt vervolgens zijn eigen iteratieplan: een aanpak in 1 a 2 zinnen, concrete geprioriteerde iteratie-hypotheses, en hij kiest zelf de testdimensies (hook, headline, opening, achtergrond, cta, sfeer, persona, format). Die gekozen dimensies worden meteen voor je aangevinkt onder Wat varieren we, en het hele plan stuurt daarna de generatie aan. Je ziet het plan bovenaan het analyse-vak onder Rory\'s iteratieplan en kunt het nog aanpassen voor je genereert.'
  },
  {
    version: '4.47',
    date: '2026-06-07',
    title: 'Cijfer-gedreven itereren, volledige persona overal, en merkinstellingen alleen waar het merk getoond wordt',
    desc: 'Vier verbeteringen. (1) Itereren leest nu de cijfers echt. De analyse-stap leest de funnel uit de ingevoerde of uit een screenshot uitgelezen cijfers (impressies en CPM, CTR en hold, klik-naar-ATC, ATC-naar-purchase), benoemt de grootste bottleneck en levert geprioriteerde iteratie-hypotheses met de getallen erbij. Die diagnose is vervolgens leidend voor de iteraties, dus de tool wisselt niet blind de hook als het knelpunt na de klik zit, en andersom. (2) Het itereer-pad gebruikt nu de volledige persona: beschrijving, pijnpunten, wensen EN bezwaren, met dezelfde harde persona-eis als bij genereren vanaf nul (eerder vielen bezwaren en beschrijving weg). (3) De Ad transformer, Copywriter en Scriptwriter kapten de persona af op de eerste 4 a 5 punten; nu gaat elke pijn, wens en bezwaar volledig mee. (4) Merkinstellingen worden nu conditioneel toegepast: de merk-identiteit (fonts, kleuren, wordmark, trust-badges) wordt alleen afgedwongen wanneer de ad het merk toont. Bij bewust merkloze of product-only formats (Nieuwsartikel, Lifestyle-Placement, of alleen het product uitlichten) blijft de ad merkloos en zijn de merkwaarden alleen nog een feiten-referentie, nooit een verzonnen review- of klantaantal.'
  },
  {
    version: '4.46',
    date: '2026-06-07',
    title: 'Productcategorieen rechtgezet: de keuze sluit nu aan op je echte categorieen en is vrij aanpasbaar',
    desc: 'Het categorie-veld bij producten en personas was een vaste keuzelijst (Shaver, Trimmer, ...), terwijl de filterbalk eronder de categorieen toonde die echt in je producten voorkomen (zoals Beard Trimmer en Hair Clipper). Daardoor kwamen ze niet overeen en kon je bij het bewerken de echte categorie niet kiezen. Het categorie-veld is nu een combobox: je kiest uit de suggesties of typt een eigen categorie. De suggesties zijn de optelsom van de standaardcategorieen plus elke categorie die al in je producten en personas voorkomt, zodat de keuzelijst, de filterbalk en de persona-filter altijd dezelfde categorieen tonen. Een product bewerken verandert dus nooit meer ongemerkt de categorie, en je kunt nu zonder code een nieuwe categorie toevoegen door hem te typen.'
  },
  {
    version: '4.45',
    date: '2026-06-07',
    title: 'Merk-instellingen: alle merkgegevens bewerkbaar plus brandbook-upload die Rory uitleest',
    desc: 'Nieuwe tab Merk-instellingen (onder Instellingen). Alles wat eerder hardcoded in de prompts zat, merknaam, kleuren, fonts, Trustpilot- en Google-scores, klantaantal en sinds-jaar, garantie, bezorgbelofte, persvermeldingen, tone of voice, kernclaims en verboden, is nu per merk bewerkbaar in de UI. Wat je opslaat wordt als blok ACTUELE MERKGEGEVENS met hoogste prioriteit achter alle twaalf system-prompts geplakt (Generator, Kopieer ad, Itereren, Ad transformer, foto-beoordeling, Copywriter, Scriptwriter, concept-suggesties en de braindump), zodat het de oude hardcoded waarden overschrijft. Zolang je niets opslaat verandert er niets en blijven de standaardwaarden gelden. Bovenin kun je je brandbook uploaden (PDF of afbeelding); Rory leest het uit en vult de velden vanzelf in, jij controleert en slaat op. Het profiel zit per merk in de back-up (export/import), dus het bestand is nu zonder code aan te raken overdraagbaar naar een ander merk. Daarnaast hebben de velden in de drie genummerde secties meer verticale ademruimte gekregen.'
  },
  {
    version: '4.44',
    date: '2026-06-05',
    title: 'Generator-formulier opnieuw ingedeeld in drie genummerde secties',
    desc: 'Het instellingen-blok zat te veel op een hoop. Het is nu opgedeeld in drie duidelijke, genummerde panelen: 1 Format & bestemming (de format mode en, bij Nieuwsartikel, de briefing), 2 Doelgroep & funnel (persona, funnel-fase, market sophistication, customer awareness en het aantal variaties), en 3 Creatieve invalshoek (archetype, concept-richting en offer). Zo zie je in een oogopslag wat waar staat. Daarnaast zijn de bundel-producten verhuisd naar direct onder de productkeuze, de meest logische plek, en ze verschijnen nu alleen nog als je de Bundle-Showcase mode kiest. In Kopieer ad en Itereren blijven alleen de relevante velden zichtbaar.'
  },
  {
    version: '4.43',
    date: '2026-06-05',
    title: 'Grotere hero-foto bij de productkeuze',
    desc: 'De hero-foto onder de productkeuze in de Generator is flink groter gemaakt (van 64 naar 124 pixels), met iets grotere naam en wat meer ruimte ernaast. Op smalle schermen schaalt hij terug naar 96 pixels zodat het netjes blijft.'
  },
  {
    version: '4.42',
    date: '2026-06-05',
    title: 'Generator-formulier: hero-foto bij product en visuele feed-preview',
    desc: 'Twee visuele verbeteringen bovenin de Generator. (1) Onder de productkeuze stond een rijtje van vier mini-fotootjes; dat is nu een nette hero-kaart met een grote eerste productfoto, de productnaam ernaast en het aantal foto\'s. (2) Onder Plaatsing verschijnt nu een klein voorbeeld van de feed-verhouding: een vorm op schaal (vierkant voor 1:1, staand voor 4:5, hoog voor Stories/Reels) met de safe-zone als stippellijn erin getekend, plus een korte uitleg per formaat. Zo zie je in een oogopslag hoe de plaatsing eruitkomt en waar de veilige zone zit.'
  },
  {
    version: '4.41',
    date: '2026-06-05',
    title: 'Productfoto\'s slepen: volgorde aanpassen en tussen categorieen verplaatsen',
    desc: 'In het bewerk-formulier van een product kun je de foto\'s nu verslepen. Binnen een categorie pas je de volgorde aan (handig, want de eerste productfoto is de hero op de productkaart en wordt als eerste meegestuurd naar de beeldgeneratie), en je kunt een foto ook naar een andere categorie slepen, bijvoorbeeld een shot van productfoto naar lifestyle of verpakking. Elke foto toont nu een volgnummer linksboven zodat je ziet welke nummer 1 is. Slepen op een foto plaatst hem op die positie, slepen in de lege ruimte zet hem achteraan. Het uploaden via klikken of een bestand erin slepen werkt gewoon zoals het was.'
  },
  {
    version: '4.40',
    date: '2026-06-05',
    title: 'Product-beheer: filteren op categorie en scrollen naar het bewerk-formulier',
    desc: 'Twee verbeteringen aan de product-beheer-grid. (1) Boven de grid staat nu een categorie-filterbalk met tabs (Alle, plus elke categorie die in je producten voorkomt, zoals Bodygroomer en Shaver), met een teller die toont hoeveel van het totaal je ziet. Eén klik en je hebt alleen die categorie in beeld. (2) Klik je op Bewerk bij een product, dan springt het bewerk-formulier nu automatisch in beeld, je hoeft niet meer zelf naar boven te scrollen.'
  },
  {
    version: '4.39',
    date: '2026-06-05',
    title: 'Strakker product-beheer: een grid in plaats van een tekstlijst',
    desc: 'De productbeheer-portal toonde per product een lange regel met alle USP-bodyteksten, wat onoverzichtelijk werd. Het is nu een nette grid van kaarten: per product de eerste productfoto groot bovenaan, daaronder de naam, een klein categorie-label, het aantal foto\'s en een Bewerk-knop. De volledige details (USPs, prijs, referentiefoto\'s) blijven gewoon bewerkbaar zodra je op Bewerk klikt, ze staan alleen niet meer als ruis in het overzicht. De kaarten schalen netjes mee op smallere schermen.'
  },
  {
    version: '4.38',
    date: '2026-06-05',
    title: 'Filteren in de Bibliotheek op funnel, product en mode',
    desc: 'Boven de bewaarde concepten staat nu een filterbalk. Met de funnel-tabs (Alle, TOF, MOF, BOF, Re-targeting) zie je in een klik alleen de concepten van die funnel-fase. Daarnaast een product-dropdown (alleen producten die echt in je bibliotheek zitten) en een mode-dropdown (Direct-Response, Brand-Builder, Nieuwsartikel, enzovoort). De filters combineren, dus bijvoorbeeld alleen de TOF-concepten voor de Groom Guard. Een teller laat zien hoeveel van het totaal er getoond worden, en met Wissen reset je alles. Handig om snel te zien wat je al hebt per product of funnel, en waar nog gaten zitten.'
  },
  {
    version: '4.37',
    date: '2026-06-05',
    title: 'Back-up & export per merk, met import',
    desc: 'In de Bibliotheek-tab staat nu een Back-up & export-blok. Met een klik exporteer je ALLE data van het actieve merk (Wellshave of Wellshine) als een JSON-back-up: de hele bibliotheek inclusief de afbeeldingen, alle persona\'s, alle producten en de opgeslagen instellingen. Het bestand heet bijvoorbeeld wellshave-ad-generator-backup-2026-06-05.json. Met de knop Importeer back-up zet je zo\'n bestand later weer terug (handig bij een nieuwe laptop of browser, want de data staat lokaal per browser). Importeren overschrijft de huidige data van het merk, dus er staat een bevestiging op, en als de back-up van een ander merk komt wordt dat gemeld. De API-keys zitten bewust niet in de back-up (veiligheid), en de SOP staat al als los bestand in je map. Het blok toont ook live hoeveel producten, persona\'s en concepten er in de back-up gaan.'
  },
  {
    version: '4.36',
    date: '2026-06-05',
    title: 'Bugfix: Nieuwsartikel-briefing verschijnt niet meer in Kopieer ad en Itereren',
    desc: 'Het veld Nieuwsartikel-briefing (met de keuze listicle of advertorial) lekte door naar de Kopieer ad- en Itereren-modus, terwijl het daar niet hoort: die modi gebruiken geen format mode. Oorzaak: de veld-logica keek alleen naar de gekozen format mode en niet naar in welke modus je werkte. Nu is de logica modus-bewust: het briefing-veld verschijnt alleen nog in de Generator (vanaf nul), en bij het wisselen naar Kopieer ad of Itereren wordt het netjes verborgen.'
  },
  {
    version: '4.35',
    date: '2026-06-05',
    title: 'Ad transformer: Laat Rory de foto beoordelen',
    desc: 'Zodra je een foto uploadt in de Ad transformer verschijnt een nieuwe knop: Laat Rory de foto beoordelen. Rory leest de foto, geeft een kort eerlijk oordeel (wat hij ziet, hoe sterk de foto is als ad-hero en wat je er het sterkst mee naar voren brengt) en vult daarna automatisch de sturingvelden in: funnel-fase, archetype, format mode, plaatsing en een concrete concept-richting die bij die foto past. Hij matcht de keuzes aan wat de foto is (een rauwe selfie wordt UGC, een kalme premium productfoto wordt lifestyle/brand-builder) en de plaatsing aan de beeldverhouding. Het enige wat jij daarna nog hoeft te doen is het product kiezen en eventueel iets bijstellen, en op Maak advertentie van deze foto klikken.'
  },
  {
    version: '4.34',
    date: '2026-06-05',
    title: 'Bugfix: ook bewerkingen respecteren nu de safe zones',
    desc: 'Gevonden via een advertorial waarvan de Lees verder-knop na een bewerking in de onderste dead zone belandde. Oorzaak: de safe-zone-regels (incl. de harde 9:16-banden uit v4.30) werden wel meegestuurd bij verse generaties en bij de herformatteer-knoppen, maar niet bij het Bewerken-paneel. Een aanpassing, layout-wijziging of stapel-uitvoer kon elementen dus ongestraft de verboden marges in schuiven. Vanaf nu krijgen alle edit-flows (Voer direct uit en Voer alle wijzigingen uit in een AI-ronde) automatisch de volledige safe-zone-instructie mee, op basis van het formaat van de versie die bewerkt wordt, inclusief de zelf-check dat tekst of UI in de verboden marge een mislukte output is.'
  },
  {
    version: '4.33',
    date: '2026-06-05',
    title: 'Proxy-uitleg: Python-downloadoptie en vaste pad-snelkoppeling',
    desc: 'Twee aanvullingen op de Proxy-uitleg. (1) Bij stap 2 (Check of Python er is) staat nu een downloadoptie voor laptops zonder Python: link naar de officiele macOS-installer op python.org/downloads, met de instructie om na installatie de Terminal opnieuw te openen, plus de noot dat de macOS-popup over command line developer tools ook volstaat. (2) Bij stap 3 staat naast de universele sleep-methode weer de vaste pad-snelkoppeling voor Dustin\'s laptop als apart kopieer-commando, duidelijk gelabeld dat die alleen daar geldig is, zodat je op je eigen machine niet elke keer hoeft te slepen.'
  },
  {
    version: '4.32',
    date: '2026-06-05',
    title: 'Proxy-uitleg werkt nu op elke laptop',
    desc: 'De stap "Naar de juiste map gaan" in de Proxy-uitleg bevatte een hardcoded pad van een specifieke laptop (met gebruikersnaam en Google-account erin). Op elke andere computer bestaat dat pad niet en faalde de uitleg met "No such file or directory". De stap is nu machine-onafhankelijk: typ cd met een spatie en sleep de map "Ad generator" vanuit Finder de Terminal in, dan vult het juiste pad zichzelf in. Plus een voorwaarden-noot (Google Drive voor desktop met toegang tot de map moet draaien), een referentie-voorbeeld van hoe het pad eruitziet, en twee alternatieven voor laptops zonder Drive: mail jezelf openai-proxy.py en gebruik cd Downloads, of sla de lokale proxy helemaal over door de Cloudflare Worker-URL in het proxy-veld te plakken (geen installatie nodig). Beide uitleg-plekken zijn aangepast (de Proxy-tab en het snelle hulp-blok in de topbar).'
  },
  {
    version: '4.31',
    date: '2026-06-05',
    title: 'Wordmark is niet langer verplicht in elke ad',
    desc: 'De wordmark stond tot nu toe in vrijwel elke gegenereerde ad en kreeg zelfs voorrang in de safe-zone-compositie, terwijl niemand in een koud feed koopt om een logo. Nieuwe overschrijvende regel in beide merk-prompts: de wordmark is optioneel. Alleen toevoegen waar hij de creative echt dient (Brand-Builder, re-targeting, productbewust publiek); bij koud verkeer standaard weglaten of hooguit heel klein in een hoek. Overal waar een sub-stack of mode de wordmark als verplicht element noemde geldt nu: lees als optioneel. In de safe-zone-instructie is de wordmark teruggezet naar het minst belangrijke element: is er ruimtegebrek in de veilige band, dan sneuvelt de wordmark als eerste en wint de boodschap. Dit sluit aan op de bestaande Ogilvy- en Rory-regels (nooit openen met de merknaam bij koud verkeer).'
  },
  {
    version: '4.30',
    date: '2026-06-05',
    title: 'Keiharde 9:16 safe zones: alle tekst verplicht in de centrale band',
    desc: 'Bij Stories en Reels (9:16) belandden koppen bovenin en de Lees verder-knop onderin precies in de zones waar Meta zijn eigen interface overheen tekent. De safe-zone-instructie is daarom omgebouwd van richtlijn naar hard verbod, met expliciete banden: bij Stories moet ALLE tekst en UI volledig tussen 16 en 78 procent van de beeldhoogte zitten (boven 16 en onder 22 procent is verboden terrein), bij Reels tussen 16 en 62 procent (de hele onderste 38 procent is verboden, daar zitten likes, comments en caption). De compositie moet eerst voor de centrale band ontworpen worden, de randen zijn puur scene. Daarbovenop een verplichte zelf-check aan het einde van elke prompt: kruist ook maar een letter, knop of logo de verboden marge, dan is de output mislukt en moet alles naar binnen. Dit geldt op drie plekken: bij het genereren (alle tabs), en bij de Ook in ander formaat herformatteer-knoppen, waar expliciet staat dat elementen die in het origineel bij een rand stonden naar de band verplaatst MOETEN worden.'
  },
  {
    version: '4.29',
    date: '2026-06-05',
    title: 'Nieuwsartikel-ads: scroll-stoppers en strengere foto-regels',
    desc: 'De eerste advertorial-ads waren trouw aan het format maar te kaal en te kalm: grote kop, body, redactie-look en verder niets. Op basis van native-advertising onderzoek kiest elke Nieuwsartikel-variatie nu 2 a 3 scroll-stoppers, met per variatie een andere set: een listicle-getal in de kop (getal-koppen halen aantoonbaar hogere CTR), een gemarkeerde sleutelzin met highlighter-effect, een pull-quote, een expert-regel (functietitel plus generieke voornaam, nooit echte personen), een kleine "Bekend van"-persregel met de bestaande vermeldingen, een anonieme lezersquote als blockquote (zonder verzonnen engagement-cijfers), een curiosity-caption onder de foto, of een specifiek echt getal. Daarnaast strengere foto-regels: candid en echt in plaats van stock-glimlach, het gezicht draagt de emotie van de kop, een onderwerp, rustige achtergrond, geen tekst op de foto. De gekozen stoppers worden per variatie benoemd in de reasoning, en de sets verschillen bewust per variatie tegen creative-similar binnen je eigen batch.'
  },
  {
    version: '4.28',
    date: '2026-06-05',
    title: 'Nieuwe tab: Scriptwriter (3 hooks, 6 beats, 3 CTA\'s)',
    desc: 'Video-scripts schrijven kan nu in de tool zelf, in het vaste 3x6x3-format van het team: drie hooks (drie expressies van dezelfde belofte, elk met een benoemd psychologisch mechanisme), een body van ~6 beats als een doorlopende belief-shift waarbij elke gesproken zin zijn eigen B-roll shot krijgt, en drie CTA\'s in verschillend register die elk het opgegeven bezwaar op scherm killen. Eerst geef je richting: product, persona, casting (UGC, founder, expert, koppel of voice-over), funnel-fase, awareness, lengte, het onderwerp/de ene claim, het bezwaar voor de CTA, en wat er al gedraaid heeft zodat het script test wat nog niet getest is. De schrijfregels komen uit Rory\'s Script Studio (body eerst hooks laatst, schrijf voor de mond, elke claim krijgt een shot, klanttaal boven copywriter-taal, een belief-shift per body) aangevuld met actueel onderzoek: hook rate boven 30% is goed en boven 40% elite, beweging in frame een verhoogt de hook rate, en de hook is woordelijk script. Inclusief info-blok, combinatie-gids en kopieer-knoppen per onderdeel.'
  },
  {
    version: '4.27',
    date: '2026-06-05',
    title: 'Nieuwe tab: Copywriter (upload een ad, Claude analyseert, Ogilvy schrijft)',
    desc: 'Eigen copywriting-flow als tab in de zijbalk. Stap 1: upload een advertentie (een eigen static of welk ad-beeld dan ook) en kies optioneel een customer persona, funnel-fase (of laat Claude die uit de ad lezen) en de bestemming (productpagina, listicle of advertorial). Stap 2: Claude analyseert het beeld en toont wat de ad laat zien, waarvoor hij dient, het doel, de funnel-inschatting, de kernbelofte, het hook-mechaniek en de vermoedelijke doelgroep. Stap 3: een klik op Schrijf Meta ad copy en Ogilvy schrijft op basis van die analyse de volledige Ads Manager copy (drie primary texts, vijf headlines, twee descriptions, CTA-knop en annotatie), met kopieer-knoppen per regel. Herkent hij een artikel-ad, dan schakelt de copy automatisch naar artikel-teasen zonder merknaam of prijs. Klopt de analyse ergens niet, dan zet je je correctie in Extra context en analyseer je opnieuw.'
  },
  {
    version: '4.26',
    date: '2026-06-05',
    title: 'Ogilvy schrijft je Meta ad copy bij elke variatie',
    desc: 'Onder elke variatie-kaart zit nu de knop "Schrijf Meta ad copy (Ogilvy)". Een direct-response copywriter op basis van David Ogilvy\'s principes (een belofte per ad, feiten boven adjectieven, headline is alles, nooit openen met de merknaam in een koud feed) schrijft dan de complete copy voor Ads Manager bij die creative: drie primary texts (kort, middel, lang met dezelfde belofte), vijf link-headlines van maximaal 40 tekens, twee link-descriptions, een CTA-knop-advies passend bij de funnel-fase, en een korte annotatie waarom deze keuzes. De copy kent de hele context: product-USP\'s, persona (pijnen, wensen, bezwaren), funnel-fase, format mode en de creative zelf, en spreekt het beeld nooit tegen. Bij de Nieuwsartikel-mode teast de copy het artikel met curiosity, zonder merknaam of prijs, met een softe CTA. Elke regel heeft een eigen kopieer-knop, en de copy blijft op de kaart staan (en gaat mee de Bibliotheek in als je het concept bewaart). Werkt in de Generator, Kopieer ad, Itereren en de Ad transformer.'
  },
  {
    version: '4.25',
    date: '2026-06-05',
    title: 'Format mode staat nu bovenaan het formulier',
    desc: 'De Format mode-keuze is verplaatst naar boven in het formulier: direct na product en plaatsing, voor de persona. Zo bepaal je eerst welke richting de ad op gaat (Direct-Response, Brand-Builder, Nieuwsartikel, enzovoort) en past de rest van het formulier zich daaronder meteen aan, zoals het verbergen van archetype en concept-richting bij de Nieuwsartikel-mode uit v4.24. De oude volgorde voelde omgekeerd: je vulde eerst alles in en zag pas daarna de keuze die bepaalt welke velden uberhaupt relevant zijn.'
  },
  {
    version: '4.24',
    date: '2026-06-05',
    title: 'Slimmer formulier: irrelevante velden verdwijnen per mode',
    desc: 'Kies je de Nieuwsartikel-mode, dan verdwijnen nu automatisch de velden die daar niet relevant zijn: Archetype (de redactionele uitvoering vervangt het), Concept-richting (de Nieuwsartikel-briefing vervangt het), Offer-detail en Bundle-producten. Persona, funnel, awareness en sophistication blijven staan, want die sturen juist welk artikel-onderwerp en welke insteek werken. Ook in de prompt zelf worden archetype-conventies, concept-richting, offer en bundle bij deze mode genegeerd, zodat oude invoer niet stiekem doorlekt, en de combinatie-waarschuwingen slaan deze mode over. Algemene verbetering daarbovenop: het Offer-detail-veld toont nu alleen nog als het Offer-archetype is gekozen (de hint zei dat al, nu doet het formulier het ook). Rory\'s brain dump past de veldlogica direct toe als hij een mode kiest.'
  },
  {
    version: '4.23',
    date: '2026-06-05',
    title: 'Apart briefing-veld voor de Nieuwsartikel-mode',
    desc: 'Kies je de Nieuwsartikel-mode, dan verschijnt nu automatisch een eigen invoerveld: de Nieuwsartikel-briefing. Daarin beschrijf je waar het artikel precies over gaat (bv ingegroeide haren na het scheren, of de grootste afknappers van vrouwen) en kies je de bestemming: een listicle (opsommingsartikel, de kop mag een getal bevatten) of een advertorial (verhalend artikel). De kop, de lead-alinea, het nieuwsbeeld en de hook volgen dan allemaal dit onderwerp, en ook de Rory concept-suggesties draaien om het artikel-onderwerp in plaats van het product. Laat je het veld leeg, dan kiest de tool zelf een sterk redactioneel onderwerp passend bij product en persona. Bij andere modes blijft het veld verborgen.'
  },
  {
    version: '4.22',
    date: '2026-06-05',
    title: 'Nieuwe format mode: Nieuwsartikel (advertorial, bewust merk-los)',
    desc: 'Nieuwe mode voor cold traffic die naar een listicle of advertorial leidt in plaats van de productpagina. De ad oogt als een redactioneel nieuwsbericht of magazine-artikel en laat als enige mode de merk-huisstijl volledig los: geen wordmark, geen Trustpilot, geen CTA-knop, geen badge of prijs, geen dark/gold. In plaats daarvan een licht redactioneel canvas met categorie-tag (bv GEZONDHEID), een journalistieke curiosity-kop (bv "Huidexperts waarschuwen voor deze scheerfout die ingegroeide haren veroorzaakt"), een korte lead-alinea, een foto in nieuwsbeeld-stijl en hooguit een tekstlink "Lees verder". Het product komt niet of terloops in beeld; de copy verkoopt het artikel. Echte mediamerken nabootsen is expliciet verboden, het blijft een generieke redactionele look. Beschikbaar als mode-kaart in de Generator en in de Ad transformer, voor beide merken.'
  },
  {
    version: '4.21',
    date: '2026-06-03',
    title: 'Archetype- en format-tegels: vaste hoogte en een uitlegregel',
    desc: 'De archetype- en format-mode-tegels zijn herontworpen volgens het gekozen variant-1 design. Elke tegel is nu een vaste, lage rij met het icoon naast de titel in een goed leesbaar lettertype, zonder loze ruimte. De uitleg staat niet meer in de kaarten maar in een gedeelde uitlegregel direct onder elk grid: die toont altijd de gekozen optie met haar beschrijving en de bekijk-voorbeeld-link, en verandert mee zodra je een andere tegel kiest. Geen verspringende kaarthoogtes meer en alle informatie blijft beschikbaar.'
  },
  {
    version: '4.20',
    date: '2026-06-03',
    title: 'Compactere indeling van de Generator, zelfde flow',
    desc: 'De opzet en volgorde van de Generator zijn ongewijzigd, maar de pagina is flink ingekort en rustiger gemaakt. De dertien archetype-kaarten en zes format-mode-kaarten zijn nu compacte tegels: alleen titel plus voorbeeld-link, en de uitleg verschijnt alleen bij de optie die je aanklikt (de voorbeeld-popup blijft voor de rest). De wireframe-thumbnails bij format modes zijn weg. Market sophistication en customer awareness staan nu naast elkaar in plaats van onder elkaar, en de Brain Dump-kaart heeft een zachter accent. Alles is puur styling, geen functionaliteit gewijzigd.'
  },
  {
    version: '4.19',
    date: '2026-06-03',
    title: 'Rory bepaalt de concept-richting en praat tegen je in de tool',
    desc: 'De Brain Dump heet nu Laat Rory analyseren en de werkwijze voorstellen: Rory bepaalt de concept-richting (zijn sterkste herframe wordt het concept) en legt in zijn eigen stem uit welk mechanisme erachter zit. Ook de concept-ideeen komen van Rory, en op elke variant-kaart zijn de reasoning en de hypothese voortaan in Rory zijn eerste persoon geschreven, alsof je echt met hem overlegt, erudiet, speels, met het mechanisme erbij. Harde grens: de advertentie zelf (headline, body, CTA en alles wat in beeld komt) blijft volledig in de merk-stem; Rory praat over de ad, nooit in de ad.'
  },
  {
    version: '4.18',
    date: '2026-06-03',
    title: 'Creatieve strategie-laag (Rory Sutherland) als leidende skill',
    desc: 'Er zit nu een vaste creatieve strategie-laag in alle generatie-paden (Generator, Kopieer, Itereer, Ad transformer, Brain Dump en de concept-suggester), gebouwd op het denkwerk van Rory Sutherland en de Rules of Alchemy. Elke variatie moet voortaan een echte herframing zijn met een benoemd psychologisch mechanisme (onzekerheidsreductie, costly signalling, social proof, frame-shift), minimaal een variatie per batch is counterintuitief, de visual maakt de herframe letterlijk zichtbaar inclusief een klein gratuit detail, en korting mag alleen met een navertelbaar verhaal en echte tijdslimiet. De laag werkt bovenop de merk-huisstijl van Wellshave en Wellshine en sluit aan op de bestaande hypothese-per-variant uit v4.14.'
  },
  {
    version: '4.17',
    date: '2026-06-03',
    title: 'Beeldgeneratie op de telefoon via een gehoste proxy (Cloudflare Worker)',
    desc: 'De lokale proxy draait op localhost en werkt daardoor alleen op je laptop. Op de telefoon werkte het concept- en copywerk (Anthropic) al, maar de beeldstap (OpenAI) niet. Nu kun je eenmalig een gratis Cloudflare Worker opzetten die de OpenAI-calls doorzet; je plakt de Worker-URL in het OpenAI proxy-veld in de Instellingen en daarna werkt beeldgeneratie ook op je telefoon, zonder dat je laptop aanstaat. In de Proxy-tab staat nu een korte uitleg bovenaan, en in je Ad generator-map staan twee nieuwe bestanden: wellgroup-openai-proxy.worker.js (de code om te plakken) en mobiel-proxy-cloudflare-setup.md (de stap-voor-stap gids). Een Cloudflare Worker is gekozen omdat die lang mag wachten op de trage beeldcall (20-90s), terwijl een Netlify-functie na 26s zou afkappen.'
  },
  {
    version: '4.16',
    date: '2026-06-03',
    title: 'Mobiel-vriendelijk: hamburger-menu en passende layout op de telefoon',
    desc: 'De tool is nu bruikbaar op een telefoon. De zijbalk staat op kleine schermen niet meer als een lange lijst bovenaan, maar schuift in via een hamburger-knop linksboven, met een donkere achtergrond eroverheen; tik op een menu-item of naast het menu om het te sluiten. De topbar blijft vast bovenaan en past zich aan (de verbindings-statussen en de paginatitel worden op smalle schermen verborgen om ruimte te houden). De extra vergroting (zoom) die sommige tabs op desktop gebruiken is op mobiel uitgezet, want die veroorzaakte horizontaal scrollen. Verder klappen de resterende kolommen en de Ad transformer netjes naar een enkele kolom met kleinere marges. Op desktop verandert er niets.'
  },
  {
    version: '4.15',
    date: '2026-06-03',
    title: 'Bugfix: Ad transformer en de andere generators haalden downloads door elkaar',
    desc: 'Als je tegelijk in de Ad transformer en in een van de andere generators (Generator, Kopieer ad, Itereren of de Bibliotheek) resultaten had staan, kon een download of versie-keuze de verkeerde afbeelding pakken. Oorzaak: de Ad transformer heeft een eigen resultaten-blok maar deelde de interne afbeeldingsstaat (op index 0, 1, ...) met de andere generators, die hun resultaten in een gedeeld blok tonen. Een oude kaart die nog in beeld stond, pakte daardoor de afbeelding die intussen door de andere generator op dezelfde index was gezet. Vanaf nu wordt bij elke nieuwe generatie het andere resultaten-blok automatisch leeggemaakt, zodat er nooit twee sets kaarten tegelijk om dezelfde staat vechten. Je werkt dus in een generator tegelijk; de laatste die je gebruikt, toont de actieve resultaten.'
  },
  {
    version: '4.14',
    date: '2026-06-03',
    title: 'Iteraties en variaties post-Andromeda: hook-body-coherentie en hypothese per variant',
    desc: 'Twee harde regels ingebouwd in de systeem-prompts (Wellshave en Wellshine), zodat ze gelden voor Generator, Itereren, Kopieer ad en Ad transformer. (1) Hook-body-coherentie: zodra de hook verandert, gaat de VOLLEDIGE copy en de visuele invalshoek over die hook. Het overnemen van een oude body onder een nieuwe hook is verboden, want Meta straft dat sinds Andromeda af als "creative similar". Plus een expliciet onderscheid: een iteratie verandert precies een variabele (setting, model of een los element) met de kern vergrendeld en moet visueel duidelijk genoeg verschillen; een variatie verandert meerdere dingen (copylengte, creative-stijl of hook-patroon) maar houdt de kern gelijk. (2) Elke variant levert nu een hypothese (hypothese_nl): waarom precies deze uitwerking het origineel zou moeten verslaan. Die hypothese verschijnt als eigen regel op de variant-kaart. Gebaseerd op het iteraties-variaties-framework dat in dezelfde map staat.'
  },
  {
    version: '4.13',
    date: '2026-06-03',
    title: 'Ad transformer: rustiger layout, concept-snelkeuzes en meerdere variaties',
    desc: 'Drie verbeteringen aan de Ad transformer. (1) De inhoud plakte tegen de schermranden; die is nu ingekort tot een gecentreerde kolom met marge aan de zijkanten, een stuk overzichtelijker. (2) Onder het concept-richting-veld staan nu snelkeuzes (Premium en rustig, Feature-grid, Before/after, Social proof, Offer/korting, Seizoen/feest, Probleem-oplossing, Lifestyle-moment). Klik er een aan om de richting in te vullen, combineren mag. (3) Nieuwe keuze Aantal variaties (1 tot 4, standaard 3): de tool maakt nu meerdere concepten over dezelfde hero-foto, elk met een andere hook. Per kaart pas je aan en klik je Genereer afbeelding; je foto blijft in elke variatie de hero.'
  },
  {
    version: '4.12',
    date: '2026-06-03',
    title: 'Ad transformer: meer sturing vooraf en eerst aanpassen',
    desc: 'De Ad transformer heeft nu net als de Generator meer sturing vooraf: naast concept-richting, product en plaatsing kun je ook funnel-fase, archetype, format mode en een customer persona kiezen. Die gaan mee naar Claude zodat de ad jouw richting volgt. Belangrijker: de tool genereert niet langer meteen het beeld. Eerst verschijnt de variatie (headline, body, CTA en de ChatGPT-prompt) die je kunt aanpassen, en pas als je op Genereer afbeelding klikt wordt het beeld op je foto gemaakt. Zo houd je controle voor het renderen.'
  },
  {
    version: '4.11',
    date: '2026-06-03',
    title: 'Wellshine: eigen CTA-knopstijl (glanzend bruin met bronzen rand)',
    desc: 'Voor Wellshine rendert de beeldgenerator de CTA-knop nu in de nieuwe huisstijl: een glanzende donkerbruine rounded knop met een gepolijste bronzen/rose-gold rand, een zachte lichtreflectie en witte vette tekst. Dit zit in de leidende tekst-overlay-instructie die de beeldgeneratie aanstuurt, dus elke gegenereerde Wellshine-ad gebruikt deze knopstijl. Wellshave behoudt zijn eigen pill-stijl.'
  },
  {
    version: '4.10',
    date: '2026-06-03',
    title: 'Oogje om het wachtwoord te tonen',
    desc: 'Het wachtwoordveld van het Team API-keys blok heeft nu een oog-icoon om te wisselen tussen verbergen en tonen van wat je typt, zodat je kunt controleren of je het wachtwoord goed invoert.'
  },
  {
    version: '4.9',
    date: '2026-06-03',
    title: 'Beveiligd Team API-keys blok in Instellingen',
    desc: 'Bovenin Instellingen staat nu een blok Team API-keys dat met een wachtwoord is afgeschermd. Vul het wachtwoord in en je ziet de OpenAI- en Anthropic-key die we voor de ad generator gebruiken, met een kopieer-knop per key en een knop Vul deze keys in en bewaar die ze meteen in de juiste velden zet. Met Vergrendel zet je het blok weer dicht. Let op: dit is een lichte drempel tegen meekijken, geen echte beveiliging, want het bestand draait lokaal.'
  },
  {
    version: '4.8',
    date: '2026-06-03',
    title: 'Nieuwe tab: Ad transformer (advertentie van je eigen foto)',
    desc: 'Er is een nieuwe hoofdtab Ad transformer. Upload een bestaande foto, geef optioneel een concept-richting en kies een product en plaatsing. Claude analyseert de foto en ontwerpt er een advertentie omheen: de foto blijft exact de hero en alleen de ad-elementen (headline, body, CTA, wordmark, eventuele badge) worden er overheen gelegd, binnen de safe zones en in de huisstijl van het actieve merk. Onder water gebruikt dit het bestaande basis-foto-pad, zodat je foto behouden blijft. Resultaat kun je net als elders bewerken, downloaden en in de Bibliotheek bewaren. Ideaal voor de vele fotos waar nog geen ad van is.'
  },
  {
    version: '4.7',
    date: '2026-06-03',
    title: 'Concept-richting werkt nu zuiver per merk (merk-bleed weggehaald)',
    desc: 'De gedeelde generatie-logica (funnel-, archetype- en awareness-context, de concept-richting-instructie en de concept-suggester) bevatte nog letterlijk Wellshave-termen zoals dark/gold, Trustpilot, Dustin Gibson en mannen-grooming. Die gingen ook mee bij Wellshine-generaties en duwden de output richting de Wellshave-stijl, waardoor je concept-richting (bijvoorbeeld de Dyson-vergelijking) niet goed doorkwam. Die teksten zijn nu merk-neutraal; de juiste merknaam, huisstijl en tone-of-voice komen per merk uit de SYSTEM_PROMPT. Concurrent-merknamen worden bewust generiek gehouden (legal-veilig), dus een vergelijking komt via de boodschap, niet via de merknaam in beeld.'
  },
  {
    version: '4.6',
    date: '2026-06-03',
    title: 'Groter en breder werkdashboard voor betere leesbaarheid',
    desc: 'Het werkgebied vult nu de volle paginabreedte (de content-kolom liep eerst vast op 1680px met veel lege ruimte rechts), met een gelijke marge links en rechts ten opzichte van de zijbalk. Daarnaast is het hele dashboard 15% groter geschaald, zodat de teksten, kaarten en knoppen duidelijker leesbaar zijn. De zijbalk en topbar blijven op normale grootte. Geldt voor beide merken.'
  },
  {
    version: '4.5',
    date: '2026-06-03',
    title: 'Merkfonts in de interface per merk',
    desc: 'De tool-interface gebruikt nu per merk de eigen lettertypes. Op Wellshave staan de koppen in Bebas Neue en de bodytekst in Montserrat; op Wellshine de koppen in Cormorant Garamond en de body in Jost. Samen met de donkerbruine Wellshine-achtergrond en het eigen logo voelt elke tab nu volledig on-brand. Technisch via CSS-variabelen die meeschakelen met de actieve merk-class.'
  },
  {
    version: '4.4',
    date: '2026-06-03',
    title: 'Wellgroup-naam plus eigen donkerbruine Wellshine-look',
    desc: 'De gecombineerde tool heet nu Wellgroup (vat Wellshave en Wellshine samen) in plaats van multibrand. Wellshine heeft nu ook een eigen visuele identiteit: zodra je naar Wellshine wisselt kleurt de hele achtergrond, zijbalk en topbar donkerbruin met een warme gouden gloed, en staat het echte Wellshine-logo (gouden vlam met woordmerk) in de zijbalk. Wellshave behoudt zijn donkere zwart-gouden look. Zo zie je direct in welk merk je werkt bij het wisselen van tab.'
  },
  {
    version: '4.3',
    date: '2026-06-03',
    title: 'Wellshine: lifestyle-fotos toegevoegd voor Briza en Nova PRO',
    desc: 'Naast de productshots hebben de Hairdryer Briza en de Airstyler Nova PRO nu elk vier lifestyle-referentiefotos uit de echte Wellshine-shoots (model met product in gebruik, plus een badkamer-flatlay voor Nova). Die helpen vooral bij Lifestyle-Placement ads. De fotos komen uit de Wellshine Drive (Photo & Video, 1. Products).'
  },
  {
    version: '4.2',
    date: '2026-06-03',
    title: 'Wellshine: productfotos hardcoded voor Briza en Nova PRO',
    desc: 'De Hairdryer Briza en de Airstyler Nova PRO hebben nu vaste referentiefotos ingebouwd: per product zes schone productshots (verschillende hoeken en opzetstukken) plus de verpakking, als verkleinde JPEG in de seed. Daardoor reproduceert de beeldgeneratie het juiste product (matzwart met goud) zonder dat je eerst fotos hoeft te importeren. De fotos komen uit de Wellshine Drive (Photo & Video, 1. Products).'
  },
  {
    version: '4.1',
    date: '2026-06-03',
    title: 'Wellshine: 4 Airstyler-personas hardcoded',
    desc: 'In het Wellshine-merk zijn vier custom personas voor de Airstyler ingebouwd, uit het creative-research-dossier: Sanne (de Dyson-bewuste besparter), Fatima (dik haar, gefrustreerd), Linda (fijn en futloos haar) en Marjan (de cadeaukoper). Elke persona heeft vijf pijnpunten, vijf wensen en vijf bezwaren in klanttaal, plus een aanbevolen market sophistication en customer awareness. Ze staan in de categorie Airstylers, dus zodra je in Wellshine de Airstyler Nova PRO kiest verschijnen ze in de persona-dropdown en sturen ze hooks, copy en bezwaarweerlegging. De Wellshine-categorielijst is uitgebreid met Airstylers en Hair Dryers.'
  },
  {
    version: '4.0',
    date: '2026-06-03',
    title: 'Multibrand: Wellshave en Wellshine in een bestand',
    desc: 'De generator bevat nu beide merken in een bestand, met een Brand-switcher in de topbar. Wisselen herlaadt de tool in het gekozen merk: eigen SYSTEM_PROMPT, producten, personas, categorieen, logo en titel per merk. Producten, personas en library worden per merk apart bewaard (Wellshave onder ws_, Wellshine onder wsh_), maar je API-keys en proxy zijn gedeeld zodat je ze maar een keer invult. Je laatst gekozen merk wordt onthouden. Dit bestand is vanaf nu de enige bron voor beide merken.'
  },
  {
    version: '3.77',
    date: '2026-06-03',
    title: 'Bibliotheek en dropdowns lopen nu live gelijk',
    desc: 'Wijzig je een persona of product, of voeg je er een toe, verwijder je er een of importeer je een lijst, dan worden voortaan in een keer alle plekken bijgewerkt: de product- en persona-dropdown op de Generator en Kopieer ad, de beheer-lijsten in de pop-ups, en de nieuwe bibliotheekpagina\'s Persona\'s en Producten. Daarvoor liep de bibliotheekpagina soms achter tot je van tab wisselde. De huidige selectie in de dropdown blijft behouden als het gekozen item nog bestaat, en bundel-items die naar een verwijderd product wezen worden netjes opgeschoond. Onder water gaat dit via twee centrale sync-functies, zodat geen enkel scherm meer uit de pas loopt.'
  },
  {
    version: '3.76',
    date: '2026-06-03',
    title: 'Aparte bibliotheken voor persona\'s en producten',
    desc: 'Twee nieuwe pagina\'s in de zijbalk onder Bibliotheek. Persona\'s toont alle custom personas, gegroepeerd per categorie, met beschrijving, aanbevolen market sophistication en customer awareness, en de volledige lijsten pijnpunten, wensen en bezwaren. Producten toont alle producten met categorie, prijs, doelgroep, USP\'s, uiterlijk-beschrijving, verboden elementen en de referentiefoto\'s (product, lifestyle, packaging). Beide pagina\'s hebben bovenaan knoppen voor Nieuw, Importeren en Exporteren, en per kaart een Bewerk-knop, die de bestaande beheer-pop-ups hergebruiken. Zo zie je in een oogopslag alle data achter je personas en producten zonder een pop-up te hoeven openen.'
  },
  {
    version: '3.75',
    date: '2026-06-03',
    title: 'Nieuw WellShave-logo en favicon',
    desc: 'De zijbalk toont nu het volledige WellShave Advertentiegenerator-logo in plaats van de oude W-tegel met tekst: het gouden venster-met-stijgende-grafiek icoon, het WellShave-woordmerk (gold "Well", zilver "Shave") en de gespatieerde subtitel met gouden lijntjes. Het is opgebouwd als scherpe vector (SVG), dus het blijft haarscherp op elk scherm. De favicon in het browsertabblad is vervangen door het losse gouden icoon, ook als vector.'
  },
  {
    version: '3.74',
    date: '2026-06-02',
    title: 'Zichtbare loading bij aanpassen, plus klikbare klaar-melding',
    desc: 'Twee verbeteringen aan de bewerk-flow. (1) Als je een static aanpast (los uitvoeren of de hele stapel) verschijnt nu een duidelijke loading-overlay over het beeld: een gouden spinner met een lopende voortgangsbalk bovenin en de tekst wat er gebeurt. Voorheen veranderde alleen de knoptekst, wat nauwelijks opviel. (2) Zodra de aanpassing klaar is verschijnt rechtsonder een klikbare melding met een groen vinkje. Klik erop en je scrolt direct naar het bijgewerkte beeld, dat kort gouden oplicht zodat je ziet welke variatie veranderd is. De melding verschijnt ook bij een verse generatie. Sluiten kan met het kruisje, anders verdwijnt hij vanzelf.'
  },
  {
    version: '3.73',
    date: '2026-06-02',
    title: 'Concept-richting stuurt nu echt het beeld, plus brandbook-regels ingebouwd',
    desc: 'Drie verbeteringen op basis van het brandbook v2.5. (1) Concept-richting is opgewaardeerd van een losse copy-hint naar een harde visuele driver. Bevat je richting een concreet visueel idee (een transformatie, before/after, split-frame, scene of contrast), dan moet het beeld dat nu letterlijk tonen in plaats van terug te vallen op een generieke product-hero. Elke variatie realiseert de kern van je concept op zijn eigen manier via de eigen hook, zodat beeld en hook samenvallen. (2) Ad-anatomie uit sectie 5.6 toegevoegd aan de systeem-prompt: headline in Bebas Neue met precies één gouden regel, body in Montserrat, pretitle in kleine gouden all-caps met ruime letterspacing, CTA als gouden pill, product rechts met radial glow, en maximaal één hook per ad. (3) Fotografie-richtlijnen uit sectie 3.9: echte mannen in echte badkamers, accessible-luxury, matzwart en warme neutralen, kalme zelfverzekerdheid, met een duidelijke niet-doen-lijst (geen cheesy poses, geen schuimige mid-shave-scenes, geen nicks of roodheid, geen prop-clutter). Het champagne-goud en zwart van de generator blijven ongewijzigd. Klantenaantal bijgewerkt naar 184.000+.'
  },
  {
    version: '3.72',
    date: '2026-06-02',
    title: 'Bewerken na het genereren: alles in een compact paneel',
    desc: 'De vijf losse uitklapmenus onder elke afbeelding (Pas aan, Layout aanpassen, Strip elementen, Element toevoegen en Meerdere wijzigingen) zijn vervangen door een enkel paneel Bewerken. Daarin kies je per wijziging een type (Aanpassen, Layout, Strippen of Toevoegen), klik je een snelkeuze of typ je zelf, en voeg je eventueel fotos toe. Elke wijziging kun je los direct uitvoeren, of stapelen: je stapelt net zoveel gemengde stappen als je wilt en voert ze daarna samen uit in een AI-ronde, wat dubbel genereren bespaart. De snelkeuzes per type zijn behouden maar netjes gegroepeerd, en het geheel neemt veel minder ruimte in dan eerst. Ook hardcoded: Trustpilot toont nu 800+ reviews en de claim 184.000+ klanten sinds 2021.'
  },
  {
    version: '3.71',
    date: '2026-06-02',
    title: 'Bibliotheek toont nu het volledige recept per concept',
    desc: 'Bij elk bewaard concept in de Bibliotheek zie je nu precies hoe het is gemaakt. Naast de afbeelding en de copy staat een blok Hoe is deze gemaakt? met alle gebruikte instellingen: product (plus bundel-producten), de getargete customer persona, het archetype, de funnel-fase, de plaatsing, market sophistication, customer awareness, de modus (vanaf nul, kopieer of itereer), de concept-richting en een eventuele offer. Per variatie zie je ook het hook-type en de reasoning waarom de variant werkt. Dit geldt direct ook voor alle eerder bewaarde concepten, want die data werd altijd al opgeslagen, hij werd alleen niet getoond. Zo kun je een winnaar later exact reproduceren of als basis voor een nieuwe test gebruiken.'
  },
  {
    version: '3.70',
    date: '2026-06-02',
    title: 'Wijzigingen als eigen tab in de zijbalk',
    desc: 'Het changelog-uitklapmenu is terug en heeft nu een eigen pagina onder Instellingen, via de nieuwe nav-knop Wijzigingen in de zijbalk. Bij de workspace-herbouw (v3.68) was het zichtbare changelog-blok per ongeluk uit de pagina verdwenen, terwijl de versiehistorie er nog wel was. Nu open je hem weer in een klik en zie je alle versies, nieuwste bovenaan, met een telling van de nieuwe updates van deze week.'
  },
  {
    version: '3.69',
    date: '2026-06-02',
    title: 'SOP-sectie in de zijbalk',
    desc: 'Nieuwe sectie Handleiding in de zijbalk met de pagina SOPs. Die legt het hele systeem uit: hoe de twee AI-stappen werken (Claude voor concept en copy, OpenAI voor het beeld), plus de vaste stap-voor-stap werkwijze voor Genereren vanaf nul, Kopieren van een bestaande ad, en Itereren op een winnende ad. Ook staat er uitleg over bijsturen op een los beeld en over bewaren en delen via de Bibliotheek. Bedoeld zodat iedereen in het team op dezelfde manier met de tool werkt.'
  },
  {
    version: '3.68',
    date: '2026-06-02',
    title: 'Nieuwe workspace-layout: sidebar en topbar',
    desc: 'De hele tool heeft de Wellshave Workspace-look gekregen. De horizontale tabbalk is vervangen door een vaste linker sidebar met de navigatie (Generator, Kopieer ad, Itereren, Bibliotheek, Proxy uitleg), gegroepeerd per sectie. Bovenin staat nu een vaste topbar met de paginatitel en de live status van Anthropic, OpenAI en de proxy. De typografie is omgezet naar Fraunces voor de koppen en Hanken Grotesk voor de tekst, in lijn met de workspace. Alle functionaliteit is identiek gebleven, alleen de schil eromheen is vernieuwd. Dit maakt de generator visueel een met de toekomstige Wellshave Workspace.'
  },
  {
    version: '3.67',
    date: '2026-06-02',
    title: 'Persona vult sophistication en awareness automatisch in',
    desc: 'Kies je een customer persona, dan worden de market sophistication en het awareness-niveau nu automatisch op de aanbevolen waarde gezet, op basis van de strategische mapping per persona. Bij een sophistication-bereik wordt de bovenkant gekozen omdat de markt verzadigd is, bij awareness het primaire instapniveau. Je houdt volledige controle: de twee velden blijven gewoon bewerkbaar, dus je kunt de automatische keuze altijd overrulen. De knop bij de persona heet nu Herstel aanbevolen, waarmee je na een handmatige aanpassing in een klik terug bent op de aanbeveling. Het automatisch invullen gebeurt alleen als je zelf een persona kiest, niet bij het wisselen van product, zodat je instellingen niet ongevraagd veranderen.'
  },
  {
    version: '3.66',
    date: '2026-06-02',
    title: 'Strikt testkader voor persona, sophistication en awareness',
    desc: 'Gericht op het zuiver testen van de customer personas. Twee dingen. Ten eerste kijkt de generator nu streng naar de ingevulde strategie: een gekozen persona is een harde eis, elke variatie wordt gebouwd voor exact dat profiel, met hook en headline uit de pijnpunten en wensen en een body die op de bezwaren reageert, geen generieke voor-alle-mannen-framing. Awareness bepaalt strikt waar de ad opent en sophistication strikt hoe claim en mechanisme werken, bij hoge sophistication leunend op bewijs en eerlijkheid in plaats van een grotere claim. Staan persona, sophistication en awareness alle drie aan, dan geldt een strikt testkader: de variaties mogen verschillen in hook en uitvoering, maar nooit in wie ze aanspreken of op welk niveau ze instappen. Ten tweede krijg je een waarschuwing vlak voor genereren als je een van die drie leeg laat terwijl er personas voor de categorie beschikbaar zijn, zodat je niet per ongeluk generiek genereert. Je kunt bewust doorgaan, maar het is een bewuste keuze geworden in plaats van standaard.'
  },
  {
    version: '3.65',
    date: '2026-06-02',
    title: 'Persona-dropdown met categorie en aanbevolen strategie',
    desc: 'De persona-keuze is uitgebreid op drie punten. Ten eerste staan de personas nu gegroepeerd onder een categorie-kop in de dropdown (bijvoorbeeld Bodygroomer), zodat meteen duidelijk is bij welke categorie ze horen, ook als je later andere categorieen aansluit. Ten tweede toont elke persona zijn meest relevante market sophistication en awareness, compact in de dropdown zelf (zoals S3-4 en prob/sol) en volledig uitgeschreven in de preview eronder. Voor de vier bodygroomer-personas komt dit uit de strategische analyse: Mark probleem- tot oplossingsbewust en stadium 3-4, Sven product- tot meest bewust en stadium 5, Lotte probleembewust en stadium 2-3, Joris probleem- tot oplossingsbewust en stadium 3-4. Ten derde is er een knop Gebruik deze die de aanbevolen awareness en sophistication meteen in de strategie-velden zet, zodat je niet handmatig hoeft over te typen. Bij een sophistication-bereik wordt de bovenkant gekozen omdat de markt verzadigd is, en bij awareness het primaire instapniveau.'
  },
  {
    version: '3.64',
    date: '2026-06-02',
    title: 'Bodygroomer-personas hardcoded',
    desc: 'Vier vaste customer personas voor de bodygroomers ingebouwd, rechtstreeks uit het persona-dossier: Mark de Vries (de Relatie-Pragmaticus, ~30%), Sven Janssen (de Sceptische Veteraan, ~18%), Lotte van der Berg (de Cadeau-Koper, ~12%) en Joris Coolen (de Atletische Presteerder, ~18%). Elke persona heeft vijf pijnpunten, vijf wensen en vijf bezwaren in de taal van de doelgroep. Ze staan in de categorie Bodygroomer, dus zodra je een bodygroomer-product kiest verschijnen ze in de persona-dropdown en sturen ze de hooks, body-copy en bezwaarweerlegging in de gegenereerde ads. Ze zijn altijd aanwezig en komen terug als je ze verwijdert, maar als je een persona bewerkt blijft jouw bewerkte versie staan. Beheren kan via Beheer naast de persona-keuze.'
  },
  {
    version: '3.63',
    date: '2026-06-01',
    title: 'Market sophistication + customer awareness',
    desc: 'Twee strategische velden toegevoegd in de generator, naast funnel en archetype. Market sophistication (stadium 1 tot 5, van simpele claim naar uniek mechanisme naar identificatie en beleving) bepaalt hoe hard claim en mechanisme moeten werken in een verzadigde markt. Customer awareness (unaware, probleembewust, oplossingsbewust, productbewust, meest bewust) bepaalt waar de ad moet openen. Beide hebben een uitleg-popup met de niveaus en Wellshave-context. De keuze gaat mee in de prompt naar Claude met expliciete instructies hoe opening, claim en mechanisme zich moeten aanpassen, en het komt in de bestandsnaam terecht als AW- en SO-. Niet ingevuld betekent dat de generator zelf kiest op basis van funnel, markt en concept, en dan staat er none in de naam. De velden horen bij from-scratch genereren, in Kopieer ad en Itereren komt de strategie uit de bron-ad zelf.'
  },
  {
    version: '3.62',
    date: '2026-06-01',
    title: 'Meerdere wijzigingen in een keer + naming convention',
    desc: 'Twee dingen. Ten eerste een nieuw bewerkpaneel Meerdere wijzigingen in een keer: je stapelt stappen (Weghalen, Toevoegen, Aanpassen), elk met een eigen instructie, en voert ze daarna met een knop in EEN AI-ronde uit. Zo komt er een eindversie uit in plaats van twee aparte generaties wanneer je tegelijk iets wilt strippen en toevoegen. De stappen verschijnen als lijstje dat je kunt aanvullen of verwijderen voor je uitvoert. Ten tweede een duidelijke bestandsnaam-conventie bij Download, met afkortingen: product, FM- (format mode), AR- (archetype), PE- (persona), funnel en placement, gevolgd door variatie, eventueel versie, en datum. Niet toegepast wordt none, bijvoorbeeld PE-none als er geen persona is gekozen. Format mode: AUTO, DR, BB, FE, BS, LP. Archetype: PREM, EDU, UGC, AUTH, OFFER, COMP, BA, FND, SEAS, OBJ, ANL, TRND, MIX. Dezelfde conventie geldt nu ook voor downloads vanuit de Bibliotheek.'
  },
  {
    version: '3.61',
    date: '2026-06-01',
    title: 'Bibliotheek als eigen tab, met afbeelding',
    desc: 'De bewaarde concepten hebben nu een eigen hoofdtab Bibliotheek, naast Generator, Kopieer ad, Itereren en Proxy uitleg. Elk bewaard item toont nu de gegenereerde afbeelding groot, samen met de headline, body, hook en details (product, funnel, archetype, CTA). Belangrijkste fix: het beeld werd voorheen vaak niet bewaard omdat een volledige PNG de lokale opslag-limiet snel vulde, waarna alleen het concept overbleef. Nu wordt het beeld bij opslaan gecomprimeerd (JPEG, max 1024px), zodat het binnen de limiet past en betrouwbaar zichtbaar blijft. Per item kun je nu Bekijk in generator, Kopieer prompt, Download beeld en Verwijder. Bewaren doe je nog steeds met Bewaar concept onder een gegenereerde variatie, het beste nadat de afbeelding is gegenereerd zodat beeld en concept samen worden opgeslagen.'
  },
  {
    version: '3.60',
    date: '2026-06-01',
    title: 'Datavelden automatisch invullen uit een screenshot',
    desc: 'In de Itereren-tab staat nu een knop Lees uit screenshot. Upload een screenshot van je Atria- of Meta-dashboard en Claude leest de zichtbare cijfers uit (spend, ROAS, CTR, CPA, purchases, enzovoort) en vult de losse datavelden automatisch in, zonder euro- of procenttekens en met een punt als decimaalteken. Niet gevonden waarden blijven leeg. Daarna controleer je de ingevulde velden, past eventueel iets aan en klikt Opslaan. Zo hoef je de cijfers niet meer met de hand over te typen. De screenshot gaat alleen naar Claude voor uitlezen.'
  },
  {
    version: '3.59',
    date: '2026-06-01',
    title: 'Itereer-tab opgeschoond met losse data-velden',
    desc: 'Drie verbeteringen aan de Itereren-tab. (1) De brain dump verdwijnt nu in itereer- en kopieer-modus, die hoort alleen bij vanaf-nul genereren. (2) Het ene grote tekstvak voor cijfers is vervangen door losse, individueel invulbare velden, netjes gegroepeerd zoals in Atria: Advertentie (naam en periode), Performance (spend, AOV, ROAS, impressies, CPM), Clicks, Engagement, Conversion funnel en Conversions. Je vult per metric in wat je hebt. (3) Een Opslaan-knop bewaart de ingevulde data lokaal zodat hij blijft staan, en er is nu een advertentienaam-veld zodat je de ad later kunt terugvinden. De data uit een echte winnende ad (WS-160-1, The Gentleman Shaver Elite) staat als voorbeeld alvast ingevuld. Bij analyseren en itereren leest het systeem deze velden uit in plaats van een vrij tekstveld.'
  },
  {
    version: '3.58',
    date: '2026-05-29',
    title: 'Nieuwe tab Itereren, leer van je winnaars',
    desc: 'Naast Generator, Kopieer ad en Proxy uitleg is er nu een vierde hoofdtab: Itereren. Hiermee bouw je voort op ads die al bewezen werken. Upload je winnende Wellshave-ad en plak de prestatiecijfers (ROAS, CTR, CPA, hook rate, spend, looptijd). Klik Analyseer deze ad en Claude leest uit wat voor ad het is: archetype, format, funnel, hook-mechaniek, compositie, headline-patroon en CTA, plus waarom hij werkt, wat je moet vasthouden en wat veilig te testen is. Daarna kies je met vinkjes wat je wilt varieren (hook, headline, openingsbeeld, achtergrond, CTA, kleur en sfeer, persona, format) en genereer je iteraties. Elke iteratie houdt het winnende mechaniek en de kernboodschap vast en test alleen de aangevinkte elementen, zodat het echte A/B-testen worden en geen willekeurige nieuwe ads. De winnende ad gaat alleen naar Claude voor analyse, niet naar OpenAI. Net als bij kopieer-modus worden format mode, funnel en archetype hier door Claude afgeleid.'
  },
  {
    version: '3.57',
    date: '2026-05-29',
    title: 'Claude Opus 4.8 toegevoegd',
    desc: 'Opus 4.8 is nu beschikbaar en toegevoegd aan de modelkeuze in Instellingen, als nieuwe default. Dit is het nieuwste en sterkste Claude-model en schrijft dus de ad-concepten, copy en de safe-zone analyse. De lijst staat nu nieuwste eerst: Opus 4.8, Opus 4.7, Opus 4.6, en Sonnet 4.6 als snellere en goedkopere optie. Let op: Opus is krachtiger maar trager en duurder per concept dan Sonnet, dus voor snelle bulk-batches kun je bewust terugschakelen naar Sonnet 4.6. Wie al een model had opgeslagen behoudt die keuze, schakel handmatig naar Opus 4.8 om hem te gebruiken.'
  },
  {
    version: '3.56',
    date: '2026-05-29',
    title: 'Safe zone alleen waar nodig, plus 1-klik omzetten naar ander formaat',
    desc: 'Twee dingen. (1) De safe-zone overlay en de Controleer-knop verschijnen nu alleen nog bij 9:16 (Stories en Reels), want daar legt Meta zijn interface over je beeld. Bij Feed 1:1 en 4:5 plakt Meta niets over de foto, dus daar gaf de rode overlay een vertekend beeld en is hij weg. De safe-zone instructie in de generatie-prompt blijft wel voor alle formaten actief, want die helpt ook tegen tekst die tegen de rand plakt. (2) Onder elke afbeelding staat nu een balk Ook in ander formaat met knoppen 9:16, 4:5, 1:1 en 16:9 (de huidige verhouding valt weg). 1 klik en dezelfde ad wordt opnieuw gerenderd op de juiste doel-afmeting met dezelfde tekst, product en stijl, en met de strenge safe zones voor dat formaat. Zo maak je van een goede vierkante ad in 1 stap een Stories- of liggende variant. Elke omzetting wordt als aparte versie bewaard, dus je origineel blijft staan.'
  },
  {
    version: '3.55',
    date: '2026-05-29',
    title: 'Safe zones aangescherpt, geen tekst meer tegen de rand',
    desc: 'Bij vrijwel elke generatie plakte gpt-image de WELLSHAVE wordmark tegen de bovenrand en de CTA tegen de onderrand, precies in de dead zones. Oorzaak was een conflict in de prompt: de huisstijl zegt wordmark bovenaan of in de hoek en CTA onderaan, en het model nam dat letterlijk als de fysieke beeldrand. Opgelost door de safe-zone instructie tot hoogste prioriteit te maken en dat conflict expliciet te benoemen: bovenaan, onderaan of in de hoek betekent voortaan aan de rand van de VEILIGE ZONE, ingesprongen vanaf de beeldrand, nooit er tegenaan. De achtergrond en het product mogen nog wel tot de rand doorlopen, alleen tekst en UI niet. Deze regel staat nu zowel vooraan in de prompt (modellen wegen het begin zwaarder) als achteraan, plus de concept-prompt is op hetzelfde punt aangescherpt. Dit vermindert het probleem sterk. De safe-zone overlay en de Controleer-knop blijven als check achteraf.'
  },
  {
    version: '3.54',
    date: '2026-05-29',
    title: 'Voorbeeld-popups bij format modes en archetypes',
    desc: 'Bij elke format mode (6) en elk archetype (13) staat nu een klein bekijk-voorbeeld linkje. Klik erop en er opent een pop-up. Voor format modes toont die een schematische voorbeeld-layout (een wireframe met gelabelde elementen zoals wordmark, headline, body, Trustpilot, CTA, trust-anker) plus een korte uitleg wat de mode inhoudt en wanneer je hem gebruikt. Voor archetypes toont de pop-up de invalshoek, een voorbeeld-headline en wanneer je het inzet. De wireframes zijn schematische illustraties, geen echte gegenereerde ads, zo zie je in 1 oogopslag het verschil tussen bijvoorbeeld Direct-Response (volle stack) en Brand-Builder (alleen wordmark en hero). Het linkje selecteert de optie niet, het opent alleen de uitleg.'
  },
  {
    version: '3.53',
    date: '2026-05-29',
    title: 'Safe zone controle, overlay plus AI-check',
    desc: 'Onder elke gegenereerde afbeelding staat nu een slanke safe-zone balk met twee controls. (1) Toggle Safe zones legt de deadzones als rode overlay over je beeld, met de juiste marges per placement (Stories onder 20%, Reels onder 35%, Feed 4:5 ongeveer 18% boven en onder, Feed 1:1 ongeveer 9% rondom) plus een gestippeld kader dat de veilige zone aangeeft. Deterministisch, geen API, snel aan en uit. (2) Knop Controleer safe zone stuurt het beeld naar Claude die beoordeelt of er tekst, logo, CTA, prijs, badge of Trustpilot binnen een gereserveerde marge valt. Resultaat verschijnt als Safe zones OK (groen) of Let op met een korte uitleg (amber), en bij Let op springt de overlay automatisch aan zodat je meteen ziet waar het misgaat. Zo is de safe zone niet langer alleen een instructie vooraf maar ook een controle achteraf.'
  },
  {
    version: '3.52',
    date: '2026-05-29',
    title: 'Kopieer-modus opgeschoond met kopieer-specifieke opties',
    desc: 'In de kopieer-modus zijn archetype, funnel-fase en format mode weggehaald uit beeld. Die hoef je niet meer te kiezen, Claude leidt ze af uit de bron-ad (in scratch-modus blijven ze gewoon zichtbaar). Daarvoor in de plaats kwam een Kopieer-instellingen blok dat alleen in copy-modus verschijnt. (1) Hoe getrouw kopieren: Letterlijk, Mechaniek lenen of Alleen het idee. (2) Wat moet vooral doorkomen uit de bron, aanvinkbaar: hook en headline-patroon, compositie en layout, body-structuur, CTA-aanpak, kleur en sfeer, social proof en emotie. Die keuzes gaan mee in de prompt naar Claude. Plus een vaste regel met wat sowieso wordt toegepast (product uit referentiefotos, Nederlands, huisstijl, Clarity Test) en wat nooit wordt overgenomen (concurrent-merknamen, niet-kloppende claims, gezichten uit de bron).'
  },
  {
    version: '3.51',
    date: '2026-05-29',
    title: 'Kopieer ad als eigen hoofdtab',
    desc: 'De kopieer-modus zat eerst verstopt als een mode-toggle binnen de generator. Nu is er een derde hoofdtab bovenaan: Generator, Kopieer ad en Proxy uitleg. De tab Kopieer ad opent dezelfde werkomgeving maar in kopieer-modus, met de bron-ad upload zichtbaar. Upload een ad-screenshot (bv Manscaped, Philips of Braun), Claude analyseert de mechaniek en bouwt er een Wellshave-variant van met jouw product en persona. De bron-ad gaat alleen naar Claude voor analyse, niet naar OpenAI. De oude inline mode-switcher is verborgen omdat de tabs die rol nu overnemen, de onderliggende logica is ongewijzigd.'
  },
  {
    version: '3.50',
    date: '2026-05-29',
    title: 'Nieuw, Element toevoegen aan een gegenereerde afbeelding',
    desc: 'Naast Pas aan, Layout aanpassen en Strip elementen is er nu een vierde inklapbaar paneel: Element toevoegen (groen). Hiermee voeg je gericht elementen toe aan een bestaande afbeelding zonder de rest te wijzigen. Preset-chips: Trustpilot-balk (4,5 van 5 sterren, het opgegeven aantal reviews), CTA-knop, kortingsbadge, garantie-strip, prijs, USP-vinkjes, body-tekst en wordmark, plus een vrij tekstveld voor je eigen toevoeging. De afbeelding gaat terug naar OpenAI met een additieve instructie die alle bestaande elementen exact behoudt en alleen het nieuwe element on-brand en binnen de safe zone toevoegt. Stapelbaar, klik meerdere chips voor meerdere toevoegingen in een keer, en elke toevoeging wordt als nieuwe versie bewaard zodat je terug kunt.'
  },
  {
    version: '3.49',
    date: '2026-05-29',
    title: 'Body/CTA auto in beeld plus opgeruimde edit-UI',
    desc: 'Twee verbeteringen. (1) De invulvelden headline, body en CTA zijn nu de bron van waarheid bij het genereren. Bij elke generatie wordt een autoritatief tekst-overlay blok uit de huidige veldwaarden opgebouwd dat de vrije image-prompt overschrijft. Vul je body of CTA in (of pas ze aan) en genereer opnieuw, dan komen ze gewoon automatisch in het beeld, ook als de oude tekst niet letterlijk in de prompt stond. De fragiele zoek-en-vervang sync gaf eerder de melding oude tekst niet gevonden, die waarschuwing is weg, wijzigingen worden nu gewoon opgeslagen en bij genereren toegepast. Een leeg body- of CTA-veld betekent expliciet niet in beeld renderen. (2) De drie edit-secties onder elke afbeelding (Pas aan, Layout aanpassen, Strip elementen) zijn nu nette inklapbare panelen, standaard dichtgeklapt. Klik een paneel open om die tool te gebruiken. Veel rustiger beeld, alle functies blijven identiek.'
  },
  {
    version: '3.48',
    date: '2026-05-29',
    title: 'Safe zones als harde regel per placement',
    desc: 'Meta UI overlays (knoppen, profielicoon, likes, comments, captions) bedekken vaak je tekst en CTA. Vanaf nu wordt per placement automatisch een safe-zone instructie aan elke image-prompt geplakt, in beide generatie-paden (met en zonder referentie-fotos). Stories 9:16: bovenste 14% en onderste 20% en 6% zijkanten vrij. Reels 9:16: bovenste 14% en onderste 35% en 6% zijkanten vrij, de onderkant is bijna dubbel zo groot als bij Stories want daar stapelen likes, comments, share en caption, dit is de meest gemaakte fout. Feed 4:5: ongeveer 18% boven en onder, 9% zijkanten. Feed 1:1: ongeveer 9% van elke rand. CTA staat bij Stories en Reels nooit meer onderaan maar in het midden of net erboven. Het product mag in de marges lopen, tekst en logo nooit. Daarnaast is de concept-prompt (regel 10) aangescherpt zodat image_prompt_en al safe-zone-bewust wordt geschreven met de exacte cijfers en het Stories vs Reels verschil.'
  },
  {
    version: '3.47',
    date: '2026-05-29',
    title: 'Alle 14 producten plus fotos hardcoded via in-memory seed',
    desc: 'De volledige Wellshave catalogus (14 producten met naam, categorie, USPs, prijs, doelgroep) plus 80 productfotos zitten nu vast ingebouwd als SEEDED_PRODUCTS. Teamleden hoeven niets meer via Excel te importeren, alles staat meteen in de dropdown. De seeds worden bij elke load in-memory samengevoegd met je eigen delta data en bewust NIET naar localStorage geschreven om quota problemen te voorkomen, de base64 fotos leven in de HTML zelf. localStorage bevat alleen user-toegevoegde producten en bewerkingen aan seeds. Een canoniek product verwijderen verbergt het voor de sessie, bij herladen komt het terug, geen tombstones. Definitief verwijderen of wijzigen doe je in SEEDED_PRODUCTS in de code plus PRODUCT_SEED_VERSION bumpen, dan worden seeds ververst en verwijderde producten teruggezet, user-toegevoegde producten blijven altijd behouden.'
  },
  {
    version: '3.46',
    date: '2026-05-22',
    title: 'Brain Dump intake plus Proxy uitleg als tab',
    desc: 'Twee toevoegingen. (1) Nieuwe Brain Dump sectie bovenaan. Type vrije Nederlandse tekst over je idee, klik Analyseer, en Claude leest mee volgens een vaste denkvolgorde: tijd-context, funnel-fase, hook en archetype, format mode, persona, conflict-detectie, concept-richting. De keuzes worden direct in de velden gezet plus een gold-card reasoning panel verschijnt met uitleg waarom. (2) Hoofdtab-navigatie toegevoegd bovenaan met Generator en Proxy uitleg. De proxy-gids zit nu ingebouwd als aparte tab met kopieer-knoppen per commando en troubleshooting, zodat je niet meer hoeft te zoeken hoe je de proxy start.'
  },
  {
    version: '3.45',
    date: '2026-05-22',
    title: 'KRITIEKE FIX, template literal interpolation crash',
    desc: 'In v3.42 was de body/CTA enforcement toegevoegd aan de system prompt met letterlijke voorbeeld-tekst die ${body_copy_nl} en ${cta_nl} bevatte. Maar de hele SYSTEM_PROMPT is zelf een JavaScript template literal, dus JavaScript probeerde die placeholders te interpoleren bij script-load. De variabelen body_copy_nl en cta_nl bestaan niet in scope, dus crash: "Uncaught ReferenceError: body_copy_nl is not defined". Daardoor werd state nooit geinit, daarom dropdown leeg, knoppen reageerden niet, alles brak. Fix: ${...} placeholders vervangen door letterlijke tekst tussen vierkante haakjes, geen JavaScript interpolation meer. v3.42 features (body/CTA enforcement, basis-foto upload, smart sync, Natuurlijkheids-check) werken nu weer correct.'
  },
  {
    version: '3.44',
    date: '2026-05-22',
    title: 'Robuuste loadState + DEBUG state-overzicht',
    desc: 'Productdropdown was leeg na v3.42/v3.43 sessie, vermoedelijk door corrupt localStorage data. Fix: loadState filtert nu defensief op geldige product-objects (moeten id en name hebben), gooit corrupt data weg, gebruikt DEFAULT_PRODUCT als fallback. Plus renderProductSelect is null-safe. Plus een DEBUG-blokje verschijnt linksonder na init met aantal producten/personas/library-items, met "Reset alle localStorage" knop voor noodgevallen.'
  },
  {
    version: '3.43',
    date: '2026-05-22',
    title: 'Diagnostische versie met error-catcher',
    desc: 'v3.42 ging stuk bij init (statusbolletjes bleven op "niet ingesteld", changelog hangt op "laden..."). Deze versie heeft een globale error-catcher die elke JS-error in een rood banner bovenaan toont, plus elke init-stap is gewikkeld in try/catch zodat een falende stap de rest niet blokkeert. Hierdoor zien we exact welke functie crasht en kunnen we gericht fixen.'
  },
  {
    version: '3.42',
    date: '2026-05-22',
    title: 'Consistentie tussen form en beeld + basis-foto upload',
    desc: 'Twee features. (1) Body en CTA moeten nu OF leeg zijn in de variant OF in het beeld worden gerenderd. Geen halverwege meer. Claude krijgt strikte regels: lege body/CTA voor Brand-Builder en Lifestyle-Placement modes, anders verplicht in image_prompt_en met letterlijke render-instructie. UI: lege body/CTA velden tonen gouden dashed-border met placeholder "(leeg in deze variant, vul in om in beeld te tonen)". Smart sync: als je een leeg veld invult, wordt automatisch een render-instructie aan de OpenAI prompt toegevoegd, geen handmatig zoeken nodig. (2) Nieuwe basis-foto sectie per variatie onder de "Genereer afbeelding" zone. Upload een eigen foto die als visuele basis-compositie wordt gebruikt, OpenAI bouwt de Wellshave ad bovenop deze foto in plaats van vanaf scratch. Product-references blijven werken voor product-appearance, basis-foto bepaalt de scene en sfeer.'
  },
  {
    version: '3.41',
    date: '2026-05-22',
    title: 'Inline-editable headline/body/CTA met auto-sync, plus AI-cliche-detectie',
    desc: 'Twee features. (1) Headline, body-copy en CTA zijn nu direct bewerkbaar als input-velden in elke variant-kaart. Bij wijziging wordt na 600ms automatisch de bijbehorende tekst in de OpenAI prompt textarea gevonden en vervangen. Visuele feedback: "gesynchroniseerd" (groen) of "let op, oude tekst niet gevonden" (geel) als de exact-match niet kon worden gemaakt. (2) Nieuwe Natuurlijkheids-check toegevoegd aan de Clarity-Eis met 10 specifieke AI-cliche-patronen die Claude moet herkennen en vermijden, plus 7 goede vs 7 slechte NL DTC-voorbeelden. Plus een 5e zelfcheck-vraag: zou een 32-jarige Nederlandse man dit zo tegen een vriend zeggen? Plus verbod op herhaalde cliche-patronen tussen variaties in dezelfde batch (geen 2x staccato-opsomming).'
  },
  {
    version: '3.40',
    date: '2026-05-22',
    title: 'Archetype + funnel-fase als override in Kopieer van ad',
    desc: 'Voorheen waren archetype en funnel-fase verborgen in copy-mode omdat Claude ze auto-detecteerde uit de bron-ad. Nu zijn ze zichtbaar als optionele override. Default in copy-mode: geen selectie, Claude detecteert. Klik een archetype of funnel om Claude\'s detectie te overrulen, bv om een UGC-bron-ad te kopiëren maar er een Persstory-versie van te maken, of om een Bottom-of-Funnel ad om te vormen naar een TOF awareness-versie. De gekozen override gaat als harde instructie naar Claude die de detectie negeert.'
  },
  {
    version: '3.39',
    date: '2026-05-22',
    title: 'Kritieke bugfix in Kopieer van ad modus',
    desc: 'Bug: in copy-mode werd de metadata zonder productId opgeslagen. Daardoor zag de "geen productreferenties" check het product niet (warning verscheen onterecht), EN kreeg de image-generator geen referentiefoto\'s mee. Resultaat: OpenAI genereerde een random "premium product" (vaak een witte cosmetica-tube of gold-chrome trimmer) ipv de echte Wellshave-productvariant. Fix: productId + bundleProductIds + personaId worden nu correct doorgegeven, zoals in de scratch-mode al gebeurde. Test door dezelfde brief opnieuw te genereren via Kopieer van ad, je krijgt nu het juiste product in beeld.'
  },
  {
    version: '3.38',
    date: '2026-05-22',
    title: 'Echte differentiatie tussen variaties (sub-stacks met VERBODEN ELEMENTEN + Strip-UI)',
    desc: 'Probleem: ondanks v3.37 sub-stacks bleven alle variaties op elkaar lijken omdat OpenAI Trustpilot + CTA + garantie reflexief overal in plakte. Twee fixes gecombineerd. (1) Sub-stacks hebben nu expliciete VERBODEN ELEMENTEN per stack: Offer-heavy = GEEN Trustpilot/garantie, Authority-heavy = GEEN Trustpilot/korting, Risk-reversal-heavy = GEEN Trustpilot/korting, etc. Plus image_prompt_en moet letterlijk "DO NOT include" lijn bevatten. (2) Nieuwe rood-getinte "Strip elementen" UI-sectie onder Layout: 7 chips om post-hoc UI-elementen volledig te verwijderen (Strip Trustpilot, Strip CTA-knop, Strip kortingsbadge, Strip garantie, Strip prijs, Strip body-copy, Strip naar minimal). Plus Auto-mode forceert minimaal 1 element-light variant bij 3+ variaties (max 2 UI-elementen, geen Trustpilot/CTA/badge).'
  },
  {
    version: '3.37',
    date: '2026-05-22',
    title: 'Variatie-Spread als harde gate, 6 Direct-Response sub-stacks',
    desc: 'Probleem: drie variaties hadden dezelfde Direct-Response stack (Trustpilot + gouden CTA + korting + garantie), alleen headline en CTA-tekst verschilden. Geen echte variatie maar herhaling met andere woorden. Fix: Direct-Response heeft nu 6 sub-stacks (Offer-heavy, Social-proof-heavy, Authority-heavy, Feature-heavy, Urgency-heavy, Risk-reversal-heavy) en bij 2+ variaties MOET Claude over verschillende sub-stacks spreiden. In Auto-mode wordt verplicht over verschillende Format Modes gespreid. Plus: Claude moet per variant in de reasoning loggen welke stack hij koos en hoe deze verschilt van de andere varianten.'
  },
  {
    version: '3.36',
    date: '2026-05-21',
    title: 'Layout aanpassen per variatie',
    desc: 'Nieuwe sectie onder elke gegenereerde afbeelding, naast "Pas aan". Bevat 12 quick-preset chips (Wissel Trustpilot ↔ CTA, Trustpilot naar linksonder/rechtsonder, Kortingsbadge naar links/rechtsboven, Headline groter/kleiner, Product groter/kleiner, Product links/rechts met tekst, CTA midden onder) plus een vrije textarea voor eigen layout-instructies. Chips zijn stapelbaar, voeg er meerdere toe en verstuur in één call. Prompt-wrap garandeert dat teksten character-for-character behouden blijven en alleen positionering, formaat en arrangement van bestaande elementen verandert.'
  },
  {
    version: '3.35',
    date: '2026-05-21',
    title: 'Proxy-start-instructies ingebouwd in API keys sectie',
    desc: 'Uitklapbaar "Hoe start ik de proxy?" blok onder het Proxy URL veld. Bevat de exacte cd-commando met het Google Drive pad en het python3 start-commando, allebei met een copy-knop. Plus troubleshooting voor de 4 meest voorkomende fouten (No such file or directory, Address already in use, python3 not found, Failed to fetch). Zo hoef je niet meer in de chat te vragen hoe je de proxy moet starten.'
  },
  {
    version: '3.34',
    date: '2026-05-14',
    title: 'Feed 1:1 als default plaatsing',
    desc: 'Standaard plaatsing was Stories 9:16, nu Feed 1:1. Volgorde van de dropdown is ook aangepast (Feed 1:1, Feed 4:5, Stories 9:16, Reels 9:16) zodat de meest gebruikte formaten bovenaan staan.'
  },
  {
    version: '3.33',
    date: '2026-05-14',
    title: 'Referent-check tegen pronoun-mismatches',
    desc: 'Aanleiding: v3.32 genereerde headline "Je bent klaar voor de wedstrijd. Ben jij dat ook?" Dit faalt omdat "je" en "jij" dezelfde persoon zijn, de vergelijking heeft geen betekenis. De zin werkt alleen als de eerste zin een derde partij benoemt ("Oranje is klaar voor de wedstrijd. Ben jij dat ook?"). Toegevoegd: 7e verbod in de Clarity-Eis, plus een vierde zelfcheck-vraag die test of vergelijking-vragen een expliciete derde partij hebben.'
  },
  {
    version: '3.32',
    date: '2026-05-14',
    title: 'Clarity-Eis voor headlines (harde gate)',
    desc: 'Aanleiding: WK-creative met headline "Manen in 3 minuten. Oranje in 1." was zelfs voor de founder niet direct te begrijpen. "Manen" betekent in NL lang hoofdhaar, niet baard. "Oranje in 1" is grammaticaal onaf. Vanaf nu MOET elke headline de cold-scroller-test doorstaan: een Nederlander die Wellshave niet kent, moet de boodschap in 1,5 sec begrijpen zonder mentale puzzel. Verboden: weggelaten woorden, woordspelingen met ambigue kernwoord, verwijzingen die 2+ culturele associatie-stappen vereisen, parallelle structuren die acties beloven die de visual niet toont. Drie zelfcheck-vragen die Claude verplicht moet beantwoorden in zijn reasoning per variant.'
  },
  {
    version: '3.31',
    date: '2026-05-14',
    title: 'Image-prompt mag het product NIET meer beschrijven',
    desc: 'Probleem: image-models volgen tekst-beschrijvingen sterker dan referentie-foto\'s. Als de prompt zei "matte black plastic with gold accents", negeerde de AI de echte refs en renderde zijn eigen interpretatie. Nu absoluut verbod: image_prompt_en mag het product niet beschrijven, alleen scene, compositie, lighting, text-overlays en annotaties. Product komt 100% uit de meegestuurde referentie-foto\'s.'
  },
  {
    version: '3.30',
    date: '2026-05-14',
    title: 'Fix voor platgedrukte logo',
    desc: 'Het Wellshave-logo werd door de flex-container van .brand horizontaal uitgerekt waardoor het er verticaal samengedrukt uitzag. Logo heeft nu een vaste breedte van 220px met behoud van aspect ratio via align-self.'
  },
  {
    version: '3.29',
    date: '2026-05-14',
    title: 'Wellshave logo bovenaan',
    desc: 'Het officiele Wellshave logo (gouden S met witte WELLSHAVE-letters) staat nu prominent in de header. Geeft de tool een duidelijke brand-identiteit en sluit aan op de dark/gold huisstijl.'
  },
  {
    version: '3.28',
    date: '2026-05-14',
    title: 'Changelog-dropdown bovenaan',
    desc: 'Klik "Wat is er nieuw?" voor een overzicht van recente updates. Versies van de afgelopen 7 dagen krijgen een NIEUW-badge. Standaard tonen we de laatste 5, klik "Toon alle versies" voor de volledige historie.'
  },
  {
    version: '3.27',
    date: '2026-05-14',
    title: 'Referentiefoto\'s bij "Pas aan"',
    desc: 'Bij elke gegenereerde afbeelding kun je nu 1-4 ref-foto\'s uploaden naast je tekst-instructie. Handig voor bv "vervang het apparaat door deze foto" + foto van het echte product, of "gebruik deze hand-pose" + pose-referentie.'
  },
  {
    version: '3.26',
    date: '2026-05-14',
    title: 'Goud-regel neutraal, fix voor Elite-producten',
    desc: 'De product-uiterlijk regel was te streng "geen goud op de body". Daardoor verdwenen de gouden zij-flanken van bv de Elite. Nu is de regel neutraal: referentie-foto\'s bepalen waar goud wel of niet zit, de AI voegt geen goud toe en haalt geen goud weg.'
  },
  {
    version: '3.25',
    date: '2026-05-14',
    title: 'Nieuwe modus: Kopieer van ad',
    desc: 'Upload een sterke bron-ad (Manscaped, Philips, Braun, etc) en Claude analyseert de mechaniek (archetype, hook, compositie) om er een Wellshave-variant op te bouwen met jouw product, persona en brand-voice. De bron-ad gaat alleen naar Claude, niet naar OpenAI.'
  },
  {
    version: '3.24',
    date: '2026-05-14',
    title: 'Static-only concept-suggester',
    desc: 'De concept-suggester produceerde soms video-script-taal ("praat over", "loopt naar"). Drie lagen instructies toegevoegd zodat alle output expliciet static-image-compositie beschrijft, een enkel bevroren frame.'
  },
  {
    version: '3.23',
    date: '2026-05-14',
    title: 'Referentie-foto\'s zijn leidend + max 6 productfoto\'s',
    desc: 'Foto\'s zijn altijd preciezer dan tekst. Uiterlijk-beschrijving mag nu leeg blijven als je refs hebt geupload. Plus: max 6 productfoto\'s per product ipv 4, hoe meer hoeken hoe nauwkeuriger de AI rendert.'
  },
  {
    version: '3.22',
    date: '2026-05-14',
    title: 'Geen fictieve gouden ring meer rond power-knop',
    desc: 'De system prompt vroeg actief om een gouden ring rond de centrale knop. Die instructie is verwijderd en vervangen door expliciete negatie, de knop blijft nu vlak en donker zoals op het echte product.'
  },
  {
    version: '3.21',
    date: '2026-05-14',
    title: 'Library: terug-knop + confirm bij opslaan zonder afbeelding',
    desc: 'Bij Bekijk op een library-item krijg je nu een "Terug naar huidige sessie" knop. Plus: opslaan zonder afbeelding gegenereerd vraagt om bevestiging, en als je later toch een afbeelding genereert en opnieuw opslaat, wordt de bestaande entry bijgewerkt ipv een duplicaat aangemaakt.'
  },
  {
    version: '3.20',
    date: '2026-05-14',
    title: 'Persona-template download + Excel-import',
    desc: 'In de Customer Personas beheer-modal staan nu Excel, Template en Importeer-knoppen. Download een lege template, vul in met je research, deel met team, importeer terug. Merge of replace bij import.'
  },
  {
    version: '3.19',
    date: '2026-05-14',
    title: 'Customer Personas naar aparte database per categorie',
    desc: 'Personas zijn niet meer aan een individueel product gekoppeld, maar aan een categorie (Shaver, Bodygroomer, etc). Zo delen alle Bodygroomer-producten dezelfde personas, wat aansluit bij hoe research per categorie wordt gedaan. Auto-migratie van v3.18 personas.'
  },
  {
    version: '3.18',
    date: '2026-05-13',
    title: 'Dynamische USPs + Customer Personas',
    desc: 'Geen vast aantal van 3 USPs meer, voeg er zoveel toe als je wil per product. Plus: Customer Personas met pijnpunten, wensen en bezwaren, selecteerbaar bij elke generatie zodat de copy zich op die persona richt.'
  },
  {
    version: '3.17',
    date: '2026-05-13',
    title: 'Concept-suggester fix voor Trend-archetype',
    desc: 'Suggester produceerde generieke product-shots in plaats van trend-concepten. Drie root causes: trend ontbrak in archetypeMap, bestaande user-briefing werd genegeerd, en geen archetype-specifieke instructies. Alle drie gefixt.'
  },
  {
    version: '3.16',
    date: '2026-05-13',
    title: 'Trend-archetype toegevoegd',
    desc: 'Naast Analogie nu ook Trend (Labubu, Looksmaxing, Quiet Luxury, Old Money, Brat-stijl, Mob Wife, Clean Boy, Coquette). Contextueel concept-veld dat zich aanpast op het archetype. Safety rails: geen copyrighted characters, looksmaxing alleen glow-up niet manosphere.'
  },
  {
    version: '3.0 - 3.15',
    date: '2026-05-12',
    title: 'Initial build van de Wellshave Static Ad Generator',
    desc: 'Anthropic concepts + OpenAI gpt-image-2 generation via lokale proxy. Product database met referentie-foto\'s in drie categorieen, 9 archetypes, 5 format-modes, library voor opslaan, image-editing met preserve-context, Excel-import voor productdata, en bundle-builder voor Bundle-Showcase ads.'
  }
];

const SHOW_INITIAL = 5;

function isRecentChangelog(dateStr) {
  const itemDate = new Date(dateStr);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return itemDate >= sevenDaysAgo;
}

function countRecentChangelog() {
  return CHANGELOG.filter(item => isRecentChangelog(item.date)).length;
}

function formatChangelogDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function renderChangelog(showAll = false) {
  const list = document.getElementById('changelog-list');
  const actions = document.getElementById('changelog-actions');
  const items = showAll ? CHANGELOG : CHANGELOG.slice(0, SHOW_INITIAL);
  list.innerHTML = items.map(item => {
    const isNew = isRecentChangelog(item.date);
    const newBadge = isNew ? '<span class="changelog-new-badge">Nieuw</span>' : '';
    return `
      <div class="changelog-item">
        <div class="changelog-item-meta">
          <span class="changelog-version">v${item.version}</span>
          <span class="changelog-date">${formatChangelogDate(item.date)}</span>
          ${newBadge}
        </div>
        <div class="changelog-item-body">
          <div class="changelog-title">${escapeHtml(item.title)}</div>
          <div class="changelog-desc">${escapeHtml(item.desc)}</div>
        </div>
      </div>
    `;
  }).join('');
  if (showAll) {
    actions.innerHTML = `<button class="changelog-show-all-btn" onclick="renderChangelog(false)">Toon minder</button>`;
  } else if (CHANGELOG.length > SHOW_INITIAL) {
    actions.innerHTML = `<button class="changelog-show-all-btn" onclick="renderChangelog(true)">Toon alle ${CHANGELOG.length} versies</button>`;
  } else {
    actions.innerHTML = '';
  }
}

function updateChangelogToggleMeta() {
  const meta = document.getElementById('changelog-toggle-meta');
  if (!meta) return;
  const newCount = countRecentChangelog();
  if (newCount > 0) {
    meta.innerHTML = `<span class="changelog-new-badge-count">${newCount}</span> ${newCount === 1 ? 'nieuwe update' : 'nieuwe updates'} deze week`;
  } else {
    meta.textContent = `${CHANGELOG.length} versies`;
  }
}

function toggleChangelog() {
  const toggle = document.getElementById('changelog-toggle');
  const panel = document.getElementById('changelog-panel');
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    toggle.classList.remove('open');
  } else {
    panel.classList.add('open');
    toggle.classList.add('open');
    renderChangelog(false);
  }
}

