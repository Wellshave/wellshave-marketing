/* Testlus voor de skills die in de repo staan (.claude/skills).
 *
 * Een skill is geen code die omvalt als er iets mist -- hij wordt stil
 * overgeslagen of leest halverwege een leeg bestand, en dan werkt Claude
 * gewoon door met minder kennis dan de bedoeling was. Dat is precies het
 * soort fout dat je pas maanden later merkt, aan output die net wat
 * slechter is.
 *
 * Vandaar deze vier controles per skill:
 *
 *   1. er is een SKILL.md met frontmatter die een name en een description
 *      draagt (zonder description wordt hij nooit vanzelf gekozen);
 *   2. de name in de frontmatter is gelijk aan de mapnaam -- lopen die
 *      uiteen, dan is de skill niet aan te roepen onder de naam die je ziet;
 *   3. elk references/-bestand dat de SKILL.md noemt bestaat ook echt;
 *   4. elke skill die de SKILL.md bij naam doorverwijst ("gebruik hiervoor
 *      de X skill") staat er ook. Rory en Nick verwijzen naar elkaar voor
 *      het werk dat de ander beter doet; verdwijnt er een, dan stuurt de
 *      overgeblevene je naar een deur die er niet is.
 *
 *   node ad-generator/test/vaardigheden.cjs
 */
const fs = require('fs');
const path = require('path');

const SKILLS = path.join(__dirname, '..', '..', '.claude', 'skills');

/* De skills die deze repo zelf meebrengt en die dus moeten blijven staan.
   Een skill die per ongeluk uit een commit valt, is anders onzichtbaar weg. */
const VERWACHT = ['rory-sutherland', 'nick-theriot'];

let fout = 0;
function check(naam, kreeg, wilde) {
  const ok = JSON.stringify(kreeg) === JSON.stringify(wilde);
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + (ok ? '' : `  (kreeg ${JSON.stringify(kreeg)}, wilde ${JSON.stringify(wilde)})`));
  if (!ok) fout++;
}

/* Genoeg frontmatter-parser voor dit doel: de blokken zijn YAML met alleen
   platte sleutels, waarvan description een gevouwen blok (>-) kan zijn. */
function frontmatter(tekst) {
  const m = tekst.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const uit = {};
  let sleutel = null;
  m[1].split(/\r?\n/).forEach(function (regel) {
    const kop = regel.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (kop) {
      sleutel = kop[1];
      const waarde = kop[2].trim();
      uit[sleutel] = (waarde === '>-' || waarde === '>' || waarde === '|') ? '' : waarde;
    } else if (sleutel && /^\s+\S/.test(regel)) {
      uit[sleutel] = (uit[sleutel] ? uit[sleutel] + ' ' : '') + regel.trim();
    }
  });
  return uit;
}

function mappen() {
  return fs.readdirSync(SKILLS).filter(function (n) {
    // symlinks naar .agents/skills horen bij een andere bron; die beheert de repo niet
    let st; try { st = fs.lstatSync(path.join(SKILLS, n)); } catch (e) { return false; }
    return st.isDirectory() && !st.isSymbolicLink();
  }).sort();
}

console.log('\n  de skills die deze repo meebrengt staan er');
const aanwezig = mappen();
check('geen enkele verwachte skill is verdwenen',
  VERWACHT.filter(function (n) { return aanwezig.indexOf(n) === -1; }), []);

console.log('\n  elke skill is compleet');
const namen = {};
aanwezig.forEach(function (map) {
  const pad = path.join(SKILLS, map, 'SKILL.md');
  if (!fs.existsSync(pad)) { check(map + ' heeft een SKILL.md', false, true); return; }
  const tekst = fs.readFileSync(pad, 'utf8');
  const fm = frontmatter(tekst);
  if (!fm) { check(map + ' heeft leesbare frontmatter', false, true); return; }

  check(map + ': de naam in de frontmatter is de mapnaam', fm.name, map);
  /* Zonder omschrijving kiest Claude de skill nooit vanzelf: hij staat er dan
     wel, maar hij gaat alleen af als je hem met /naam aanroept. */
  check(map + ': er staat een omschrijving die hem laat afgaan',
    !!(fm.description && fm.description.length > 40), true);
  namen[fm.name || map] = true;

  /* Alleen de eigen referenties tellen. Een SKILL.md mag ook naar het
     referentiebestand van een andere skill wijzen ("see `ai-artist`
     references/x.md"); dat bestand hoort hier niet te staan en is dus geen
     gat. Herkenbaar aan de skill-naam die er op dezelfde regel vlak voor
     staat. */
  const verwezen = [];
  tekst.split(/\r?\n/).forEach(function (regel) {
    (regel.match(/references\/[a-z0-9._-]+\.md/gi) || []).forEach(function (ref) {
      const ervoor = regel.slice(0, regel.indexOf(ref));
      if (/`[a-z][a-z0-9-]*`\s*$|\b[a-z][a-z0-9-]*\s+skill[^.]*$/i.test(ervoor)) return; // van een andere skill
      if (verwezen.indexOf(ref) === -1) verwezen.push(ref);
    });
  });
  const missend = verwezen.filter(function (rel) { return !fs.existsSync(path.join(SKILLS, map, rel)); });
  check(map + ': alle ' + verwezen.length + ' eigen referenties bestaan', missend, []);
});

console.log('\n  en een doorverwijzing komt ergens uit');
/* "For Wellshave creative production use the rory-sutherland skill instead."
   Zulke zinnen zijn navigatie, geen proza: als de genoemde skill weg is,
   stuurt de tekst je naar een deur die er niet is.

   Dit geldt alleen voor de skills die deze repo zelf meebrengt. De ingekochte
   skills (design, banner-design) verwijzen naar een hele familie skills die
   hier niet staat; dat is hun zaak, en die lus hier rood laten staan voor
   iets wat niemand in deze repo kan repareren maakt de test waardeloos. */
function alsSkillGenoemd(tekst, map) {
  const namenIn = new Set();
  // vorm 1: "the rory-sutherland skill", "de nick-theriot skill"
  (tekst.match(/(?:the\s+)?([a-z][a-z0-9]*-[a-z0-9-]+)\s+skill\b/gi) || []).forEach(function (s) {
    namenIn.add(s.replace(/^the\s+/i, '').replace(/\s+skill$/i, '').toLowerCase());
  });
  // vorm 2: "companion skill (`nick-theriot`)" -- het woord skill staat vlak ervoor
  (tekst.match(/skill[^`\n]{0,20}`([a-z][a-z0-9]*-[a-z0-9-]+)`/gi) || []).forEach(function (s) {
    namenIn.add(s.replace(/^[\s\S]*`([^`]+)`$/, '$1').toLowerCase());
  });
  namenIn.delete(map); // een zelfverwijzing is geen navigatie
  return [...namenIn];
}
/* Ook de symlinks tellen als bestaande skill: de repo beheert hun inhoud niet,
   maar ze zijn er wel, dus een verwijzing ernaartoe komt gewoon uit. */
const alleSkills = new Set(fs.readdirSync(SKILLS).concat(Object.keys(namen)));
VERWACHT.forEach(function (map) {
  const pad = path.join(SKILLS, map, 'SKILL.md');
  if (!fs.existsSync(pad)) return;
  const doorverwijzingen = alsSkillGenoemd(fs.readFileSync(pad, 'utf8'), map);
  const kapot = doorverwijzingen.filter(function (n) { return !alleSkills.has(n); });
  check(map + ' verwijst naar ' + (doorverwijzingen.join(', ') || '(niets)') + ' en die staat er', kapot, []);
});

console.log('');
console.log(fout === 0 ? '  Alle controles geslaagd' : `  ${fout} controle(s) mislukt`);
process.exit(fout > 0 ? 1 : 0);
