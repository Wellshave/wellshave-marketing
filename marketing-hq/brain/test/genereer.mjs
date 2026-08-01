/* Testlus voor de breinafdruk.
 *
 * De belangrijkste controle staat onderaan en gaat niet over opmaak maar over
 * schade: het script mag NIETS buiten `brain/Live/` schrijven. De vault bevat
 * met de hand geschreven inhoud die niet in de database staat — op 1 augustus
 * had het dagrapport van 27 juli 2417 tekens op schijf tegen 876 in de
 * database. Eén generator die "de vault bijwerkt" gooit dat verschil in één
 * keer weg, en dat is niet terug te draaien met een migratie.
 *
 *   node marketing-hq/brain/test/genereer.mjs
 */
import { veiligPad, vandaagMd, werkstukkenMd, logboekMd, dagMd, agentMd, regel, datumNL, tijd }
  from '../genereer.mjs';

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

const NU = '2026-08-01T09:15:00Z';

/* De echte stand van zaken op productie, zoals de werkbank hem teruggaf. */
const WERKBANK = [
  { id: 9,  titel: '184.000+ mannen googelden dit ook.', toestand: 'loopt', station_nu: 4,
    station_naam: 'live', overdracht: 'poort', wacht_op: 'jij', stil_uren: 77,
    stil_grens_uren: 72, te_stil: true, waarom: 'ligt bij jou op station 4 — live' },
  { id: 10, titel: 'Dyson airstyler vs Airstyler Nova', toestand: 'loopt', station_nu: 4,
    station_naam: 'live', overdracht: 'poort', wacht_op: 'jij', stil_uren: 77,
    stil_grens_uren: 72, te_stil: true, waarom: 'ligt bij jou op station 4 — live' },
  { id: 12, titel: 'Nekirritatie', toestand: 'loopt', station_nu: 2, station_naam: 'briefing',
    overdracht: 'vanzelf', wacht_op: 'nova', stil_uren: 3, stil_grens_uren: 24,
    te_stil: false, waarom: 'ligt bij nova op station 2 — briefing' },
  { id: 13, titel: 'Afgerond idee', toestand: 'klaar', station_nu: null, station_naam: null,
    overdracht: null, wacht_op: null, stil_uren: 400, stil_grens_uren: 72,
    te_stil: false, waarom: 'alle zes de stations af' },
];

const STROOM = [
  { wanneer: '2026-08-01T05:03:00Z', soort: 'handeling', wie: 'atlas', toon: 'info',
    wat: 'meta_insights', werkstuk_id: null, details: {} },
  { wanneer: '2026-08-01T05:01:00Z', soort: 'run', wie: 'atlas', toon: 'info',
    wat: 'Atlas leverde het dagrapport', werkstuk_id: null, details: { kosten_usd: 0.0388 } },
  { wanneer: '2026-07-31T14:00:00Z', soort: 'poort', wie: 'bolt', toon: 'warn',
    wat: 'budget: GroomGuard op 20 euro/dag  (wacht op akkoord)', werkstuk_id: 9, details: {} },
  { wanneer: '2026-07-31T09:00:00Z', soort: 'bericht', wie: 'nova', toon: 'warn',
    wat: 'nova → bolt: klaar om live te zetten  (nog niet opgepakt)', werkstuk_id: 9, details: {} },
  { wanneer: '2026-07-30T11:00:00Z', soort: 'rapport', wie: 'radar', toon: 'error',
    wat: 'Marktscan mislukt', werkstuk_id: null, details: {} },
];

const DAG = { dag: '2026-08-01', gebeurtenissen: 2, agents_actief: 1, wie: 'atlas',
              rapporten: 0, berichten: 0, poorten: 0, fouten: 0, waarschuwingen: 0,
              kosten_usd: 0.0388 };

/* ── 1. de regel ────────────────────────────────────────────────────────── */
console.log('\n  één regel in het logboek');
bevat('draagt de tijd',       regel(STROOM[0]), '`05:03`');
bevat('en wie het deed',      regel(STROOM[0]), '**atlas**');
bevat('een fout zegt "fout" en niet alleen een kleur', regel(STROOM[4]), '**[fout]**');
bevat('een waarschuwing ook', regel(STROOM[3]), '*[let op]*');
bevat('en wat aan een idee hangt, verwijst ernaar', regel(STROOM[2]), 'werkstuk 9');
check('wat nergens aan hangt, verwijst nergens heen',
  regel(STROOM[0]).includes('werkstuk'), false);

/* ── 2. Vandaag.md — de beslisvraag ─────────────────────────────────────── */
console.log('\n  Vandaag.md draagt de vraag, niet een verslag');
const v = vandaagMd(WERKBANK, NU);
bevat('de vraag staat bovenaan', v, '# Welk werk ligt stil, en op wie wacht het?');
bevat('twee werkstukken liggen te lang stil', v, '## Te lang stil (2)');
bevat('één loopt nog',                        v, '## Loopt (1)');
bevat('en één is af',                         v, '## Af of gestopt (1)');
bevat('op wie het wacht staat erin',          v, '| jij |');
bevat('met de reden erachter',                v, 'ligt bij jou op station 4 — live');
bevat('en het waarschuwt tegen bewerken',     v, 'Niet bewerken');
// Een werkstuk dat níét te lang stil is hoort niet in de eerste tabel.
check('het lopende werkstuk staat niet onder "te lang stil"',
  v.split('## Loopt')[0].includes('Nekirritatie'), false);

console.log('\n  regel 0.4 — ook leeg zegt iets');
const leeg = vandaagMd([], NU);
bevat('geen stil werk is een zin, geen leeg vlak', leeg, '*Niets ligt te lang stil.*');
bevat('en geen lopend werk ook',                   leeg, '*Er loopt op dit moment niets.*');

/* ── 2b. Werkstukken.md — waar de links heen wijzen ─────────────────────── */
console.log('\n  Werkstukken.md, zodat de links ergens heen gaan');
const wk = werkstukkenMd(
  [{ ...WERKBANK[0], stappen: [
      { station: 1, naam: 'signaal', agent: 'radar', status: 'klaar', overdracht: 'vanzelf', waarom: 'opgepikt' },
      { station: 4, naam: 'live', agent: 'bolt', status: 'wacht_op_mens', overdracht: 'poort', waarom: null },
      { station: 6, naam: 'oogst', agent: 'echo', status: 'open', overdracht: 'poort', waarom: null }] }],
  STROOM, NU);
bevat('elk werkstuk krijgt een kop waar de link op landt', wk, '## 9');
bevat('met de titel erbij',                 wk, '184.000+ mannen googelden dit ook.');
bevat('de hele keten staat erin',           wk, '| 1 | signaal | radar | klaar |');
bevat('ook de stations die nog moeten',     wk, '| 6 | oogst | echo | open |');
bevat('te lange stilte staat er als woord', wk, '**te lang**');
bevat('en het spoor van dit ene idee',      wk, 'wacht op akkoord');
check('maar niet het spoor van een ander idee', wk.includes('meta_insights'), false);
bevat('zonder werkstukken zegt het dat',    werkstukkenMd([], [], NU), '*Er zijn nog geen werkstukken.*');

/* ── 3. Logboek.md ──────────────────────────────────────────────────────── */
console.log('\n  Logboek.md');
const l = logboekMd(STROOM, NU);
bevat('nieuwste dag bovenaan', l.split('##')[1], 'zaterdag 1 augustus 2026');
check('drie dagen, drie koppen', (l.match(/\n## /g) || []).length, 3);
bevat('de legenda staat erbij', l, '`⚑` poort');
bevat('een lege stroom zegt waarom hij leeg is',
  logboekMd([], NU), 'De runtime heeft nooit gedraaid');

/* ── 4. per dag en per agent ────────────────────────────────────────────── */
console.log('\n  Dagen/ en Agents/');
const d = dagMd(DAG, STROOM);
bevat('de dag noemt de kosten', d, '$ 0.0388');
bevat('en alleen de gebeurtenissen van die dag', d, 'Atlas leverde het dagrapport');
check('niet die van gisteren', d.includes('Marktscan mislukt'), false);

const a = agentMd('atlas', STROOM, NU);
bevat('een agent telt zijn eigen runs', a, '| Runs | 1 |');
bevat('en zijn eigen kosten',           a, '$ 0.0388');
bevat('en wanneer hij voor het laatst werkte', a, '4 uur geleden');
bevat('en verwijst naar zijn guardrails', a, 'agents/atlas');
bevat('een agent die nooit iets deed, zegt dat',
  agentMd('sage', STROOM, NU), '**nooit**');

/* ═══════════════════════════════════════════════════════════════════════════
 *  DE CONTROLE DIE ERTOE DOET
 *
 *  Alles hierboven gaat over opmaak. Dit gaat over of er iets kapotgaat.
 * ═══════════════════════════════════════════════════════════════════════════ */
console.log('\n  het script komt Live/ niet uit');
const weigert = (pad) => {
  try { veiligPad(pad); return false; } catch (e) { return /buiten brain\/Live/.test(e.message); }
};
check('een gewoon pad mag',            weigert('Dagen/2026-08-01.md'), false);
check('Live/ zelf overschrijven niet', weigert('.'), true);
check('een stap omhoog niet',          weigert('../Log/Activity.md'), true);
check('twee stappen omhoog niet',      weigert('../../agents/atlas.md'), true);
check('diep verstopt omhoog niet',     weigert('Dagen/../../Team/Atlas.md'), true);
check('een absoluut pad niet',         weigert('/etc/passwd'), true);
check('en een pad naar de repo-wortel niet', weigert('/home/user/wellshave-marketing/README.md'), true);

// Het handgeschreven deel van de vault is precies wat beschermd moet worden.
check('Log/Activity.md is onbereikbaar',   weigert('../Log/Activity.md'), true);
check('Team/ is onbereikbaar',             weigert('../Team/Atlas.md'), true);
check('Reports/Daily/ is onbereikbaar',    weigert('../Reports/Daily/2026-07-27.md'), true);
check('Briefings/ is onbereikbaar',        weigert('../Briefings/2026-07-27.md'), true);

console.log('');
console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
process.exit(fout > 0 ? 1 : 0);
