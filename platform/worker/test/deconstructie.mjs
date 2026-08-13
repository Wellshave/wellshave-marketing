/* Testlus voor Creative Deconstruction in de worker.
 *
 * Waarom dit een eigen lus heeft:
 *
 *   Deze route bepaalt welke elementen een iteratie NIET mag aanraken. Faalt
 *   hij stil -- geen invariants, of een lezing die eruitziet als een lezing maar
 *   het niet is -- dan mag de volgende stap alles veranderen, en dan is een
 *   Founder Story na één iteratie een advertentie met een willekeurig model.
 *   Dat is precies wat deze laag moet voorkomen.
 *
 *   De nagemaakte Claude geeft hier ook fout terug: een string waar een lijst
 *   hoort, een antwoord zonder tool_use, lege elementen. Een stub die alleen
 *   het goede geval nadoet bewijst niets over de vangnetten.
 *
 *   node platform/worker/test/deconstructie.mjs
 */

import worker from '../marketing-os.worker.js';

let fouten = 0;
const check = (label, echt, verwacht) => {
  const goed = JSON.stringify(echt) === JSON.stringify(verwacht);
  if (!goed) fouten++;
  console.log(`${goed ? 'ok  ' : 'FOUT'} ${label}${goed ? '' : `\n       verwacht ${JSON.stringify(verwacht)}, kreeg ${JSON.stringify(echt)}`}`);
};

/* Wat de nagemaakte Claude deze ronde teruggeeft. */
let antwoordSoort = 'goed';
let bewaard = [];
let volgendeId = 1;

const CREATIVES = [
  { id: 11, brand: 'wellshave', ad_name: 'WS - 200 - 2',
    hook_short: 'Geen reclamebudget. Wel 800 reviews.',
    primary_text: 'Ik begon Wellshave omdat ik zelf nergens een scheerapparaat kon vinden dat...',
    product: 'Groom Guard', has_image: true, image_b64: 'AAAA', image_mime: 'image/png' },
  { id: 12, brand: 'wellshave', ad_name: 'Alleen tekst',
    primary_text: 'Een advertentie zonder beeld.' },
  { id: 13, brand: 'wellshave', ad_name: 'WS - 999 - 1', product: 'Groom Guard' }
];

const GOEDE_LEZING = {
  creative_type: 'Founder Story',
  core_concept: 'The founder explains why he created Wellshave after being dissatisfied with existing grooming products.',
  target_persona: 'Men 25-45 who shave daily',
  awareness_level: '2. Problem Aware',
  narrative_perspective: 'first person',
  primary_character: 'the founder',
  visual_role: 'proof of a real person',
  cta: 'Lees verder',
  emotional_driver: 'trust',
  confidence: 'high',
  invariants: [
    { element: 'Founder', why: 'de geloofwaardigheid hangt aan een echt persoon' },
    { element: 'First person narrative', why: 'derde persoon maakt er een testimonial van' },
    { element: 'Founder imagery', why: 'een model breekt de belofte van echtheid' }
  ],
  flexible: [
    { element: 'Headline', why: 'vrij' },
    { element: 'CTA', why: 'vrij' },
    { element: 'Layout', why: 'vrij' }
  ]
};

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const methode = opts.method || 'GET';
  const ok = (d) => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });

  if (url.includes('/auth/v1/user')) return ok({ id: 'u1', email: 'dustin@wellshave.com' });

  if (url.includes('/rest/v1/')) {
    const m = url.match(/\/rest\/v1\/([a-z_]+)/);
    const tabel = m ? m[1] : null;
    if (tabel === 'team_members') return ok([{ id: 'u1', status: 'approved', role: 'admin' }]);
    if (tabel === 'creatives' && methode === 'GET') {
      const idM = url.match(/id=eq\.(\d+)/);
      return ok(idM ? CREATIVES.filter(c => c.id === Number(idM[1])) : CREATIVES);
    }
    if (tabel === 'creative_deconstructions' && methode === 'POST' && antwoordSoort === 'db_stuk') {
      return new Response('kapot', { status: 500 });
    }
    if (tabel === 'creative_deconstructions' && methode === 'POST') {
      const rijen = JSON.parse(opts.body).map(r => ({ id: volgendeId++, ...r }));
      bewaard.push(...rijen);
      return ok(rijen);
    }
    return ok([]);
  }

  if (url.includes('api.anthropic.com')) {
    /* De vangnetten testen betekent dat de stub ze moet kunnen raken. Een
       nagemaakt model dat altijd netjes antwoordt, bewijst alleen dat het
       goede geval werkt. */
    if (antwoordSoort === 'geen_tool') {
      return ok({ model: 'claude-test', content: [{ type: 'text', text: 'Ik denk dat dit een founder story is.' }] });
    }
    if (antwoordSoort === 'string_ipv_lijst') {
      return ok({ model: 'claude-test', content: [{ type: 'tool_use', name: 'creative_deconstruction',
        input: { ...GOEDE_LEZING, invariants: 'Founder' } }] });
    }
    if (antwoordSoort === 'lege_elementen') {
      return ok({ model: 'claude-test', content: [{ type: 'tool_use', name: 'creative_deconstruction',
        input: { ...GOEDE_LEZING, invariants: [{ element: '  ', why: 'niets' }, { element: 'Founder', why: 'wel iets' }] } }] });
    }
    if (antwoordSoort === 'niets_beschermd') {
      return ok({ model: 'claude-test', content: [{ type: 'tool_use', name: 'creative_deconstruction',
        input: { ...GOEDE_LEZING, invariants: [] } }] });
    }
    if (antwoordSoort === 'onzin_vorm') {
      return ok({ model: 'claude-test', content: [{ type: 'tool_use', name: 'creative_deconstruction',
        input: { creative_type: 'X', core_concept: 'Y', invariants: [], flexible: { nope: true } } }] });
    }
    if (antwoordSoort === 'stuk') {
      return new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 529, headers: { 'Content-Type': 'application/json' } });
    }
    return ok({ model: 'claude-test', content: [{ type: 'tool_use', name: 'creative_deconstruction', input: GOEDE_LEZING }] });
  }
  throw new Error('onverwachte fetch in test: ' + url);
};

const env = { ANTHROPIC_KEY: 'test', SUPABASE_SERVICE_KEY: 'test' };
const auth = { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' } };

const lees = async (creative_id, soort) => {
  antwoordSoort = soort || 'goed';
  bewaard = [];
  const r = await worker.fetch(new Request('https://w/creative/deconstruct', {
    method: 'POST', ...auth, body: JSON.stringify({ creative_id })
  }), env);
  return { status: r.status, body: await r.json() };
};

console.log('\n  een gewone lezing');
let r = await lees(11);
check('de route antwoordt',                  r.status, 200);
check('met het type',                        r.body.creative_type, 'Founder Story');
check('en het concept in één zin',           /founder explains why/.test(r.body.core_concept), true);
/* Het scherm krijgt platte namen; de reden blijft eronder beschikbaar. */
check('Keep is een lijst namen',             r.body.keep, ['Founder', 'First person narrative', 'Founder imagery']);
check('Flexible ook',                        r.body.flexible, ['Headline', 'CTA', 'Layout']);
check('de reden gaat mee',                   /echt persoon/.test(JSON.stringify(r.body.keep_detail)), true);
check('er is iets beschermd',                r.body.nothing_protected, false);
/* Met beeld is een Founder Story heel gelezen; zonder beeld half. Dat verschil
   hoort vastgelegd te worden, niet weggelaten. */
check('de bron zegt dat het beeld meedeed',  r.body.source, 'copy+image');
check('de lezing is opgeslagen',             bewaard.length, 1);
check('op de juiste creative',               bewaard[0].creative_id, 11);
check('met wie hem opvroeg',                 bewaard[0].analysed_by, 'u1');

console.log('\n  wat de AI leest raakt niet aan wat het team noteerde');
/* De deconstructie staat naast public.creatives. Zou hij die tabel bijwerken,
   dan overschrijft een lezing stilletjes wat een mens heeft vastgelegd. */
check('er wordt niets in creatives geschreven',
  bewaard.every(b => b.creative_id !== undefined && b.persona === undefined), true);

console.log('\n  zonder beeld is de lezing smaller');
r = await lees(12);
check('dat staat er ook',                    r.body.source, 'copy');

console.log('\n  een creative met alleen een naam en een product');
r = await lees(13);
check('wordt geweigerd',                     r.status, 502);
check('met de reden erbij',                  /geen tekst en geen beeld/.test(r.body.error), true);
check('en er wordt niets opgeslagen',        bewaard.length, 0);

console.log('\n  wat er misgaat bij het model');
r = await lees(11, 'geen_tool');
check('een antwoord zonder lezing stuit',    /geen bruikbare lezing/.test(r.body.error), true);
check('en slaat niets op',                   bewaard.length, 0);

r = await lees(11, 'string_ipv_lijst');
/* Dit is de gevaarlijke: een model dat "Founder" teruggeeft in plaats van een
   lijst. Zonder deze controle belandt dat op de database-constraint, en daar is
   de melding onleesbaar. */
check('een string waar een lijst hoort stuit', /niet als lijst/.test(r.body.error), true);
check('en slaat niets op',                     bewaard.length, 0);

r = await lees(11, 'lege_elementen');
check('lege elementen vallen weg',           r.body.keep, ['Founder']);
check('maar de rest blijft staan',           r.body.nothing_protected, false);

r = await lees(11, 'niets_beschermd');
/* Geen invariants betekent dat een iteratie alles mag veranderen. Dat mag niet
   stil blijven -- dan verdwijnt precies de bescherming waarvoor deze laag er is. */
check('niets beschermd wordt gemeld',        r.body.nothing_protected, true);
check('maar de lezing wordt wel bewaard',    bewaard.length, 1);

/* Een vorm die geen enkel vangnet voorziet. De route hoort een nette fout te
   geven en niet om te vallen: een kale 500 leest als "de worker is stuk" in
   plaats van "het model zei iets raars". */
r = await lees(11, 'onzin_vorm');
check('een onbekende vorm laat de route niet omvallen', r.status, 502);
check('en zegt dat de lezing vastliep',                 /vastgelopen|vastliep|niet als lijst|geen bruikbare/.test(r.body.error), true);

/* Het model antwoordt netjes maar het opslaan mislukt. Dat komt langs alle
   vormcontroles heen en is precies waar het buitenste vangnet voor is: zonder
   dat valt de route om en krijgt het scherm een kale 500. */
r = await lees(11, 'db_stuk');
check('een mislukte opslag laat de route niet omvallen', r.status, 502);
check('en zegt dat de lezing vastliep',                  /vast/.test(r.body.error), true);

r = await lees(11, 'stuk');
check('een model dat omvalt geeft een fout', r.status, 502);
check('met de melding van Claude erin',      /529|overloaded/.test(r.body.error), true);
check('en slaat niets op',                   bewaard.length, 0);

console.log('\n  wie er niet bij mag');
const zonderLogin = await worker.fetch(new Request('https://w/creative/deconstruct', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creative_id: 11 })
}), env);
check('zonder login geen lezing',            zonderLogin.status, 401);

const zonderId = await worker.fetch(new Request('https://w/creative/deconstruct', {
  method: 'POST', ...auth, body: JSON.stringify({}) }), env);
check('zonder creative_id een nette fout',   zonderId.status, 400);

const bestaatNiet = await worker.fetch(new Request('https://w/creative/deconstruct', {
  method: 'POST', ...auth, body: JSON.stringify({ creative_id: 999 }) }), env);
check('een onbekende creative geeft 404',    bestaatNiet.status, 404);

console.log('');
if (fouten) { console.log(`${fouten} controle(s) mislukt`); process.exit(1); }
console.log('Alles klopt');
