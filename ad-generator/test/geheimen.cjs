/* Er staat geen sleutel in deze repo.
 *
 * Aanleiding, en het is geen hypothetisch geval: in
 * app/js/04-instellingen-en-proxy.js stond een "kluis" met de OpenAI- en de
 * Anthropic-sleutel letterlijk in de broncode, achter een wachtwoord dat er
 * drie regels boven ook in stond. Dat bestand wordt naar elke browser gestuurd
 * die de console opent, dus het wachtwoord beschermde niets.
 *
 * Toen de repo met een tweede bedrijf gedeeld werd, vonden de scanners van
 * Anthropic en OpenAI ze en trokken ze allebei automatisch in. De console
 * meldde daarna "API key is invalid" terwijl de statusbalk groen bleef, en het
 * heeft een halve dag gekost om te vinden dat het niet de worker was maar de
 * broncode.
 *
 * Deze lus draait daarom niet op een browser en niet op de app -- hij leest
 * platte tekst en is opzettelijk saai:
 *
 *   1. geen sleutelpatroon in de bestanden die verstuurd worden;
 *   2. de kluis is echt weg en komt niet terug via een kopie;
 *   3. de plek waar de sleutels WEL horen (Worker secrets) staat beschreven,
 *      want een verbod zonder alternatief levert alleen een volgende kluis op.
 *
 * Wat hier bewust NIET in staat: de sleutels zelf, ook niet als voorbeeld.
 * Een test die een echte sleutel bevat om te controleren dat er geen echte
 * sleutel is, is zijn eigen lek.
 *
 *   node ad-generator/test/geheimen.cjs
 */
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

/* De patronen van de diensten die dit project gebruikt. Elk is een prefix die
   de dienst zelf uitgeeft, dus een treffer is nooit toeval.

   De patronen staan hier in stukjes aan elkaar geplakt. Niet uit
   voorzichtigheid tegen mensen -- het gaat om de scanners: een bestand met
   'sk-ant-api03-' erin voluit kan zelf een melding opleveren, en dan faalt de
   test op zijn eigen bestaan. */
const PATRONEN = [
  { naam: 'Anthropic', re: new RegExp('sk-' + 'ant-api[0-9]{2}-[A-Za-z0-9_-]{20,}') },
  { naam: 'OpenAI (project)', re: new RegExp('sk-' + 'proj-[A-Za-z0-9_-]{20,}') },
  { naam: 'OpenAI (klassiek)', re: new RegExp('\\bsk-[A-Za-z0-9]{32,}\\b') },
  { naam: 'Meta', re: new RegExp('\\bEAA[A-Za-z0-9]{80,}\\b') },
  { naam: 'GitHub', re: new RegExp('\\bgh[pousr]_[A-Za-z0-9]{30,}\\b') },
  { naam: 'Slack', re: new RegExp('\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b') },
  { naam: 'Stripe', re: new RegExp('\\b[sr]k_live_[A-Za-z0-9]{20,}\\b') },
  /* Een JWT met service_role erin is de Supabase-sleutel die alles mag. De
     losse term service_role telt niet: die staat in elke grant in de
     migraties en is geen geheim. */
  { naam: 'Supabase service-role JWT', re: /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{60,}\.[A-Za-z0-9_-]{20,}/ }
];

/* Wat overgeslagen wordt, en waarom -- want een uitzondering die niemand kan
   navertellen is een gat.
     node_modules  : niet van ons, niet verstuurd
     .git          : de historie is een apart gesprek (dode sleutels erin
                     herschrijf je niet zomaar; dat raakt iedereen met een kloon)
     design/       : ontwerpbestanden met base64-beelden erin. Base64 levert
                     eindeloos vals alarm en er staat geen code in.
     test/         : dit bestand zelf en zijn buren
     *.png/jpg/... : binair */
const OVERSLAAN = new Set(['node_modules', '.git', '.netlify', 'design', 'test']);
const BINAIR = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|mov|pdf|zip)$/i;

/* Ingebedde beelden eruit voordat er gezocht wordt. Een base64-blob is een
   lange rij letters en cijfers, dus daar zit vroeg of laat elk prefix
   toevallig in -- de eerste versie van deze test sloeg alarm op een 'EAA'
   middenin een productfoto. Dat soort vals alarm is erger dan geen test: het
   went, en dan kijk je over het echte geval heen. */
function zonderBase64(t) {
  return t.replace(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=\s]+/gi, 'data:<beeld>');
}

/* Commentaar weg, regelaantal intact. Een controle die naar code zoekt hoort
   niet te struikelen over een zin die uitlegt waarom die code er niet staat. */
function zonderCommentaar(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
          .replace(/\/\/[^\n]*/g, '');
}

function bestanden(dir, uit) {
  uit = uit || [];
  let namen;
  try { namen = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return uit; }
  namen.forEach(function (d) {
    if (OVERSLAAN.has(d.name)) return;
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return bestanden(p, uit);
    if (!d.isFile() || BINAIR.test(d.name)) return;
    uit.push(p);
  });
  return uit;
}

console.log('\n  de zoeker vindt zelf wel iets');
/* Een mutatie liet zien dat dit nodig is: zet zonderBase64 op "geef altijd
   leeg terug" en de hele lus wordt groen terwijl er een echte sleutel in de
   app staat. Een filter dat te veel wegveegt is onzichtbaar -- alle vinkjes
   blijven staan, want er valt niets meer te vinden.
   Dus eerst een geplante sleutel door dezelfde zeef. Hij is nadrukkelijk nep:
   opgebouwd uit een herhaald teken, dus hij is nooit van een dienst geweest. */
const NEP = 'sk-' + 'ant-api03-' + 'A'.repeat(40);
const NEP_IN_ZIN = 'const k = "' + NEP + '"; // niet echt';
check('een geplante sleutel wordt herkend',
  PATRONEN[0].re.test(zonderBase64(NEP_IN_ZIN)), true);
/* En de zeef moet wel doen waarvoor hij er is: beelddata eruit, code intact. */
const MET_BEELD = 'data:image/png;base64,' + 'EAA' + 'Q'.repeat(200) + '\n' + NEP_IN_ZIN;
check('een ingebed beeld wordt weggeveegd',
  /base64,EAA/.test(zonderBase64(MET_BEELD)), false);
check('maar de code eromheen blijft staan',
  PATRONEN[0].re.test(zonderBase64(MET_BEELD)), true);

console.log('\n  geen sleutel in de bestanden die de deur uit gaan');
const alle = bestanden(WORTEL);
check('er is werkelijk iets doorzocht', alle.length > 200, true);

/* Per patroon melden welk bestand het is, niet wat erin staat. Een testrapport
   dat de sleutel afdrukt heeft het lek alleen verplaatst naar je terminal en
   je CI-logboek. */
PATRONEN.forEach(function (pat) {
  const raak = [];
  alle.forEach(function (p) {
    let t;
    try { t = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
    if (pat.re.test(zonderBase64(t))) raak.push(path.relative(WORTEL, p));
  });
  check('geen ' + pat.naam + '-sleutel', raak, []);
});

console.log('\n  en de kluis is echt weg');
/* Het blok verwijderen is niet genoeg: hij stond twee keer (de app en het
   legacy-bestand), dus een controle op één plek was hem eerder ook al
   misgelopen. Deze kijkt naar de hele boom. */
const kluisSporen = [];
alle.forEach(function (p) {
  let t;
  try { t = fs.readFileSync(p, 'utf8'); } catch (e) { return; }
  if (/VAULT_KEYS|VAULT_PASSWORD|function unlockVault|copyVaultKey|useVaultKeys/.test(t)) {
    kluisSporen.push(path.relative(WORTEL, p));
  }
});
check('geen kluis met sleutels in de code', kluisSporen, []);

const html = fs.readFileSync(path.join(WORTEL, 'ad-generator', 'app', 'index.html'), 'utf8');
check('en geen kluispaneel in de interface', /id="vault-(pw|open|locked|openai|anthropic)"/.test(html), false);
/* Het instellingenpaneel zelf moet wel blijven staan: daar kies je het model
   en de kwaliteit. Alleen de sleutels zijn eruit. */
check('het instellingenpaneel staat er nog wel',
  /id="settings-panel"/.test(html) && /Anthropic \(concept-generatie\)/.test(html), true);

console.log('\n  en het nieuwe sleutelmenu slaat niets op in de browser');
/* Het adminmenu vervangt de kluis, en de verleiding is dezelfde: even
   onthouden wat er getypt is, "voor het gemak". Dat is precies hoe de vorige
   kluis ontstond. Dus: geen opslag, geen globale variabele, geen dataset. */
const menu = fs.readFileSync(
  path.join(WORTEL, 'ad-generator', 'app', 'js', '53-sleutelbeheer.js'), 'utf8');
/* Naar de code kijken en niet naar de uitleg erboven. Zonder dit valt deze
   controle over de zin waarin staat dat er niets naar localStorage gaat --
   rood op je eigen documentatie is de snelste manier om een test te leren
   negeren. */
const menuCode = zonderCommentaar(menu);
check('geen localStorage of sessionStorage',
  /(local|session)Storage/.test(menuCode), false);
/* De waarde mag alleen in de body van de POST staan en nergens anders heen. */
check('de waarde gaat alleen naar de worker',
  (menu.match(/waarde/g) || []).length > 0 && /body: JSON\.stringify\(\{ naam: naam, waarde: waarde \}\)/.test(menu), true);
/* En het veld wordt leeggemaakt, in beide takken -- ook als het misging. */
check('het invoerveld wordt na verzending leeggemaakt',
  (menu.match(/invoer\.value = '';/g) || []).length >= 2, true);
/* De worker mag de waarde nooit terugsturen, dus het scherm hoort er ook
   nergens een te verwachten. Een veld met die naam in het antwoord zou
   betekenen dat iemand het aan die kant heeft toegevoegd. */
check('het scherm leest geen waarde uit het antwoord',
  /uit\.waarde|data\.waarde|\.sleutel\b/.test(menu), false);

const werker = fs.readFileSync(
  path.join(WORTEL, 'platform', 'worker', 'marketing-os.worker.js'), 'utf8');
/* Het overzicht bouwt op met vaste velden. Zou daar ooit cipher of nonce bij
   komen "om te debuggen", dan staat de versleutelde sleutel in een browser en
   is de helft van de bescherming weg. */
const overzicht = (werker.match(/async function sleutelOverzicht[\s\S]*?\n}/) || [''])[0];
check('het overzicht geeft geen cipher of nonce terug',
  /cipher|nonce/.test(overzicht), false);

console.log('\n  en er staat waar ze dan WEL horen');
/* Een verbod zonder alternatief levert over een half jaar gewoon een nieuwe
   kluis op. Dus moet er ergens staan hoe het wel moet, met het commando
   erbij dat je nodig hebt. */
const wrangler = fs.readFileSync(path.join(WORTEL, 'platform', 'worker', 'wrangler.toml'), 'utf8');
check('wrangler.toml noemt de secrets en het commando',
  /wrangler secret put ANTHROPIC_KEY/.test(wrangler) && /wrangler secret put OPENAI_KEY/.test(wrangler), true);
const proxyJs = fs.readFileSync(path.join(WORTEL, 'ad-generator', 'app', 'js', '04-instellingen-en-proxy.js'), 'utf8');
check('en op de plek waar de kluis stond staat waarom hij weg is',
  /wrangler secret put/.test(proxyJs), true);

console.log('');
console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
process.exit(fout > 0 ? 1 : 0);
