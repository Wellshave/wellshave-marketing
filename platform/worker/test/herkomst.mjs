/* Testlus voor de vraag "wie mag de worker rechtstreeks bellen?".
 *
 * Dit bestaat omdat het fout ging, en stil. De console draait ook op de deploy
 * previews van Netlify. Stond zo'n adres niet in de lijst van de worker, dan
 * blokkeerde de browser de rechtstreekse call en viel de app terug op de
 * tussenstap op zijn eigen origin. Die stap kapt af rond de dertig seconden.
 * Korte vragen aan Rory overleefden dat; drie concepten uitwerken niet. Het
 * scherm zei alleen "geen concepten" -- er was niets kapot te zien.
 *
 * Deze lus roept de echte worker-code aan, want de lijst en het patroon staan
 * daar en nergens anders.
 *
 *   node platform/worker/test/herkomst.mjs
 */

import worker from '../marketing-os.worker.js';

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

/* Een preflight is precies wat de browser stuurt voordat hij de echte call
   toestaat. Wat de worker hier terugstuurt bepaalt of de call doorgaat. */
async function magHet(origin) {
  const r = await worker.fetch(
    new Request('https://marketing-ads.dustin-9ff.workers.dev/anthropic',
      { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } }),
    {}, { waitUntil() {} });
  return r.headers.get('Access-Control-Allow-Origin') === origin;
}

console.log('\n  de vaste adressen');
check('de console zelf mag erbij',
  await magHet('https://wellshave-adgen.netlify.app'), true);
check('de werkbank ook',
  await magHet('https://wellshave-werkbank.netlify.app'), true);

console.log('\n  de deploy previews van diezelfde twee sites');
check('een preview van adgen mag erbij',
  await magHet('https://deploy-preview-14--wellshave-adgen.netlify.app'), true);
check('een preview van de werkbank ook',
  await magHet('https://deploy-preview-3--wellshave-werkbank.netlify.app'), true);

console.log('\n  en verder niemand');
/* Het patroon moet aan beide kanten vastzitten. Zonder anker aan het eind kan
   iemand er zijn eigen domein achter plakken en alsnog binnenkomen -- de
   worker houdt de sleutels, dus dat is niet vrijblijvend. */
check('een adres met ons adres erin maar een ander domein erachter niet',
  await magHet('https://deploy-preview-14--wellshave-adgen.netlify.app.kwaad.nl'), false);
check('een preview van een site die niet van ons is niet',
  await magHet('https://deploy-preview-14--iemand-anders.netlify.app'), false);
check('een branch-preview zonder nummer niet',
  await magHet('https://boos--wellshave-adgen.netlify.app'), false);
check('en een willekeurige site al helemaal niet',
  await magHet('https://voorbeeld.nl'), false);

console.log('');
console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
process.exit(fout > 0 ? 1 : 0);
