/* Testlus voor Bolt in de runtime.
 *
 * Bolt is de enige agent die aan geld kan komen, en de controle die ertoe doet
 * is dus niet of hij goede voorstellen schrijft maar of hij er langs kan. Elke
 * weg naar buiten hoort via `approvals` en een mens te lopen.
 *
 * De lus draait de echte agent-loop tegen een nep-Supabase, nep-Claude en
 * nep-Meta. Geen deploy, geen kosten, geen database.
 *
 *   node platform/worker/test/bolt.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const BRON = readFileSync(join(HIER, '..', 'marketing-os.worker.js'), 'utf8');

let fout = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fout++;
  console.log(`  ${goed ? 'ok  ' : 'FOUT'} ${label}`);
  if (!goed) {
    console.log(`       verwacht ${JSON.stringify(verwacht)}`);
    console.log(`       kreeg    ${JSON.stringify(echt)}`);
  }
};
const bevat = (label, tekst, stuk) => check(label, String(tekst).includes(stuk), true);

/* Bolts blok uit de bron, zodat we over zijn eigen tekst praten en niet over
   die van een andere agent. */
const boltBlok = BRON.slice(BRON.indexOf('  bolt: {'), BRON.indexOf('  atlas: {') > BRON.indexOf('  bolt: {')
  ? BRON.indexOf('  atlas: {') : BRON.length);

/* ── 1. wat Bolt in handen heeft ───────────────────────────────────────── */
console.log('\n  het gereedschap');
const tools = (boltBlok.match(/tools:\s*\[([^\]]+)\]/) || [])[1] || '';
const lijst = tools.split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean);
check('Bolt heeft zeven stuks gereedschap', lijst.length, 7);
check('request_approval zit erbij', lijst.includes('request_approval'), true);

/* Dit is de kern. Er bestaat in de hele runtime geen tool die bij Meta iets
   aan of uit zet; als er ooit een bijkomt, hoort deze controle om te vallen. */
console.log('\n  er is geen weg naar buiten die om een mens heen gaat');
const uitvoerTools = ['meta_update_ad', 'meta_set_budget', 'meta_pause_ad',
                      'meta_activate', 'meta_execute', 'meta_apply'];
uitvoerTools.forEach(t =>
  check(`de runtime kent geen ${t}`, BRON.includes(`${t}:`), false));
check('en Bolt heeft er ook geen enkele van',
  lijst.filter(t => uitvoerTools.includes(t)), []);

/* meta_prepare_ad is de enige tool die Meta aanraakt. Hij mag alleen
   klaarzetten, en dat moet in zijn eigen beschrijving staan — dat is wat het
   taalmodel leest. */
console.log('\n  meta_prepare_ad zet klaar, meer niet');
const prepareBlok = BRON.slice(BRON.indexOf('  meta_prepare_ad: {'),
                               BRON.indexOf('  request_approval: {'));
bevat('de beschrijving zegt dat het niets uitgeeft', prepareBlok, 'geeft dus niets uit');
bevat('en dat een mens hem live zet', prepareBlok, 'een mens zet hem live');
bevat('en verwijst naar request_approval', prepareBlok, 'request_approval');

/* ── 2. de twee opdrachten ─────────────────────────────────────────────── */
console.log('\n  de twee opdrachten');
bevat('publiceren staat erin', boltBlok, 'kind = publish_queue');
bevat('en het opvolgen van het dagbesluit', boltBlok, 'kind = dagbesluit_opvolgen');
check('de scorecard is eruit — die doet 0013 nu in SQL',
  boltBlok.includes('creative_scorecard'), false);
check('en de hele runtime kent hem niet meer',
  BRON.includes('creative_scorecard'), false);

/* ── 3. Bolt velt het oordeel niet opnieuw ─────────────────────────────── */
/* Twee plekken die hetzelfde beoordelen kunnen het oneens worden, en dan is er
   geen oordeel meer maar een discussie. */
console.log('\n  het oordeel komt uit de database, niet uit het model');
bevat('hij leest hq_dagbesluit', boltBlok, 'hq_dagbesluit');
bevat('en krijgt te horen dat hij het niet overdoet', boltBlok, 'velt dat oordeel niet opnieuw');
bevat('met de reden erbij', boltBlok, 'altijd hetzelfde op');

/* ── 4. de constraints staan ook in zijn instructie ────────────────────── */
/* De database weigert het sowieso. Maar een agent die tegen een muur loopt die
   hij niet zag aankomen, verspilt een run en levert niets. */
console.log('\n  hij weet van de guardrails vóór hij ertegenaan loopt');
bevat('payload heeft ad_id en account_id nodig', boltBlok, 'ad_id, account_id');
bevat('een bedrag hoort een getal te zijn',      boltBlok, 'bedrag_eur als getal');
bevat('niet twee keer hetzelfde vragen',         boltBlok, 'nooit twee keer hetzelfde');
bevat('hooguit vijf tegelijk',                   boltBlok, 'hooguit vijf verzoeken');
bevat('en bij de grens stoppen, niet opnieuw proberen', boltBlok, 'niet opnieuw');

/* ── 5. request_approval voert nog steeds niets uit ────────────────────── */
console.log('\n  request_approval blijft een verzoek');
const approvalBlok = BRON.slice(BRON.indexOf('  request_approval: {'));
bevat('de beschrijving zegt dat het niets uitvoert', approvalBlok, 'Dit voert niets uit');
bevat('en dat een mens beslist',                    approvalBlok, 'Een mens beslist');
bevat('de rij komt binnen als wachtend',            approvalBlok, "status: 'wacht op een mens'");
check('er wordt niets anders geschreven dan de aanvraag zelf',
  (approvalBlok.slice(0, approvalBlok.indexOf('\n  }')).match(/sbInsert|sbUpdate/g) || []).length, 1);

console.log('');
console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
process.exit(fout > 0 ? 1 : 0);
