#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * Het brein afdrukken als Obsidian-vault
 *
 * Leest `marketing_hq.brein`, `brein_dag` en `werkbank` en schrijft ze als
 * markdown weg, zodat je in Obsidian kunt teruglezen wat de agents deden.
 *
 * ── De regel die dit script bij elkaar houdt ───────────────────────────────
 *
 * Alles onder `brain/Live/` is een AFDRUK. Het wordt bij elke draai
 * overschreven en je hoort er nooit iets in te typen. Alles daarbuiten is met
 * de hand of door een agent geschreven en wordt NOOIT aangeraakt.
 *
 * Dat is geen netheid maar noodzaak. Op 1 augustus stond in de database van
 * het dagrapport van 27 juli 876 tekens; het bestand op schijf had er 2417.
 * De vault bevat dus meer dan de database weet. Een generator die "de vault
 * bijwerkt" zou dat verschil in één keer weggooien.
 *
 * De controle daarop staat in `veiligPad()` en wordt getest. Zet die niet uit.
 *
 * ── Draaien ────────────────────────────────────────────────────────────────
 *
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=... \
 *   node marketing-hq/brain/genereer.mjs
 *
 * De sleutel komt uit de omgeving en staat nergens in dit bestand of in de
 * repo. Zonder sleutel weigert het script te draaien in plaats van een lege
 * vault te schrijven — een leeg logboek leest als "er is niets gebeurd", en
 * dat is een gevaarlijker uitkomst dan een foutmelding.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const LIVE = resolve(HIER, 'Live');

/* ── de grens ──────────────────────────────────────────────────────────────
 * Elk pad dat dit script schrijft gaat hier eerst langs. Buiten Live/ schrijft
 * hij niet, ook niet als iemand later een pad meegeeft dat eruit klimt. */
export function veiligPad(pad) {
  const vol = resolve(LIVE, pad);
  const erbinnen = relative(LIVE, vol);
  // Leeg = Live/ zelf, '..' = eruit geklommen, absoluut = een pad dat resolve()
  // niet aan LIVE heeft geplakt omdat het al bij de wortel begon.
  if (erbinnen === '' || erbinnen.startsWith('..') || isAbsolute(erbinnen)) {
    throw new Error(`weigert te schrijven buiten brain/Live/: ${pad}`);
  }
  return vol;
}

async function schrijf(pad, inhoud) {
  const vol = veiligPad(pad);
  await mkdir(dirname(vol), { recursive: true });
  await writeFile(vol, inhoud.trimStart(), 'utf8');
  return relative(resolve(HIER, '..', '..'), vol);
}

/* ── lezen ───────────────────────────────────────────────────────────────
 * Twee bronnen. Normaal de database; met BREIN_JSON een bestand met dezelfde
 * drie arrays erin. Dat tweede is er niet voor de test maar voor de praktijk:
 * de service key staat alleen als Cloudflare-secret, dus wie hem niet heeft
 * kan de vault anders nooit opnieuw afdrukken. En een afdruk die alleen de
 * sleutelhouder kan maken, wordt geen afdruk maar een privébezit. */
async function uitBestand() {
  const { readFile } = await import('node:fs/promises');
  const d = JSON.parse(await readFile(process.env.BREIN_JSON, 'utf8'));
  for (const k of ['brein', 'brein_dag', 'werkbank']) {
    if (!Array.isArray(d[k])) throw new Error(`BREIN_JSON mist de array "${k}"`);
  }
  return [d.brein, d.brein_dag, d.werkbank];
}

async function haal(view, query = '') {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${view}${query ? '?' + query : ''}`;
  const r = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': 'marketing_hq'
    }
  });
  if (!r.ok) throw new Error(`${view}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

/* ── opmaak ────────────────────────────────────────────────────────────── */
const DAGEN = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const MND = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];

export function datumNL(iso) {
  const d = new Date(iso);
  return `${DAGEN[d.getUTCDay()]} ${d.getUTCDate()} ${MND[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function tijd(iso) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

/* Zes soorten, zes tekens. In Obsidian lees je een lange lijst op vorm voor je
 * hem op woorden leest — maar het woord staat er altijd naast, want vorm
 * alleen draagt geen betekenis (regel 4.4 van het ontwerpcontract). */
const MERK = { handeling: '·', bericht: '→', rapport: '▣', poort: '⚑', run: '⏱' };

export function regel(g) {
  const let_op = g.toon === 'error' ? ' **[fout]**' : g.toon === 'warn' ? ' *[let op]*' : '';
  const stuk = g.werkstuk_id ? ` ^[[Werkstukken#${g.werkstuk_id}|werkstuk ${g.werkstuk_id}]]` : '';
  return `- \`${tijd(g.wanneer)}\` ${MERK[g.soort] || '·'} **${g.wie || 'onbekend'}** — ${g.wat}${let_op}${stuk}`;
}

/* ── de vier afdrukken ─────────────────────────────────────────────────── */

/* 1. Wat er nu ligt. Dit is het enige bestand dat een vraag beantwoordt in
 *    plaats van een verslag te zijn, en daarom staat het vooraan. */
export function vandaagMd(werkbank, nu) {
  const stil = werkbank.filter(w => w.te_stil);
  const loopt = werkbank.filter(w => !w.te_stil && !['klaar','gestopt'].includes(w.toestand));
  const af = werkbank.filter(w => ['klaar','gestopt'].includes(w.toestand));

  const rij = w =>
    `| [[Werkstukken#${w.id}\\|${w.titel}]] | ${w.station_nu ?? '—'} ${w.station_naam ?? ''} `
    + `| ${w.wacht_op ?? '—'} | ${w.stil_uren} u | ${w.waarom} |`;

  const tabel = (lijst, leeg) => lijst.length
    ? ['| werkstuk | station | wacht op | stil | waarom |','|---|---|---|---|---|', ...lijst.map(rij)].join('\n')
    : `*${leeg}*`;

  return `
# Welk werk ligt stil, en op wie wacht het?

> Afdruk van \`marketing_hq.werkbank\` — ${datumNL(nu)} ${tijd(nu)} UTC.
> Niet bewerken: dit bestand wordt bij elke draai overschreven.

## Te lang stil (${stil.length})

Stilte telt per soort overdracht. Een stap die vanzelf door hoort te lopen mag
een dag stil zijn, een poort drie dagen, creatief werk een week. Wat hier staat
is er dus overheen — niet zomaar "lang geleden".

${tabel(stil, 'Niets ligt te lang stil.')}

## Loopt (${loopt.length})

${tabel(loopt, 'Er loopt op dit moment niets.')}

## Af of gestopt (${af.length})

${tabel(af, 'Nog niets afgerond of gestopt.')}
`;
}

/* 2. De ideeën zelf. Dit bestand bestaat omdat elke regel in het logboek en
 *    elke rij in Vandaag.md ernaar verwijst; zonder dit zijn dat losse links,
 *    en een vault vol losse links wordt niet gelezen. Per idee de hele keten,
 *    inclusief de stations die nog moeten gebeuren — dat lege stuk is de
 *    informatie (regel 1 van de estafette in het ontwerpcontract). */
export function werkstukkenMd(werkbank, stroom, nu) {
  const blok = (w) => {
    const stappen = (w.stappen || []).map(s =>
      `| ${s.station} | ${s.naam} | ${s.agent || '—'} | ${s.status} | ${s.overdracht} | ${s.waarom || ''} |`);
    const spoor = stroom.filter(g => g.werkstuk_id === w.id).slice(0, 25);
    return `
## ${w.id}

**${w.titel}**

${w.product || '—'} · ${w.persona || '—'} · ${w.angle_type || 'hoek nog open'}

| | |
|---|---|
| Toestand | ${w.toestand} |
| Stappen af | ${w.stappen_af} van 6 |
| Wacht op | ${w.wacht_op ?? '—'} |
| Stil | ${w.stil_uren} uur (grens ${w.stil_grens_uren}) ${w.te_stil ? '— **te lang**' : ''} |
| Waarom | ${w.waarom} |
${w.aantal_ads ? `| Advertenties | ${w.aantal_ads} · € ${w.spend} · ROAS ${w.roas ?? '—'} |` : ''}

### De keten

| # | station | agent | status | overdracht | waarom |
|---|---|---|---|---|---|
${stappen.join('\n') || '| — | — | — | — | — | *geen stappen vastgelegd* |'}

### Wat eraan gedaan is

${spoor.map(regel).join('\n') || '*nog niets vastgelegd voor dit werkstuk*'}
`;
  };

  return `
# Werkstukken

> Afdruk van \`marketing_hq.werkbank\` — ${datumNL(nu)} ${tijd(nu)} UTC.
> Niet bewerken: dit bestand wordt bij elke draai overschreven.

Elk idee met zijn volledige keten, ook de stations die nog niet gebeurd zijn.
Een lege stap is informatie: daar ligt het werk stil.

${werkbank.map(blok).join('\n---\n') || '*Er zijn nog geen werkstukken.*'}
`;
}

/* 3. Het logboek. Nieuwste bovenaan, want je opent het om te zien wat er net
 *    gebeurd is en niet om bij het begin te beginnen. */
export function logboekMd(stroom, nu, max = 400) {
  const perDag = new Map();
  for (const g of stroom.slice(0, max)) {
    const d = String(g.wanneer).slice(0, 10);
    if (!perDag.has(d)) perDag.set(d, []);
    perDag.get(d).push(g);
  }
  const blokken = [...perDag.entries()].map(([d, gs]) =>
    `## ${datumNL(d)}\n\n${gs.map(regel).join('\n')}`);

  return `
# Logboek

> Afdruk van \`marketing_hq.brein\` — ${datumNL(nu)} ${tijd(nu)} UTC.
> De ${max} nieuwste gebeurtenissen. De volledige historie staat in de database.
> Niet bewerken: dit bestand wordt bij elke draai overschreven.

Vijf bronnen in één stroom: \`·\` handeling · \`→\` bericht · \`▣\` rapport ·
\`⚑\` poort · \`⏱\` run.

${blokken.join('\n\n') || '*Nog geen enkele gebeurtenis. De runtime heeft nooit gedraaid.*'}
`;
}

/* 4. Eén bestand per dag. Dit is wat je aan iemand vertelt die een week weg
 *    was. */
export function dagMd(d, stroom) {
  const gs = stroom.filter(g => String(g.wanneer).slice(0, 10) === d.dag);
  return `
# ${datumNL(d.dag)}

> Afdruk van \`marketing_hq.brein_dag\`. Niet bewerken.

| | |
|---|---|
| Agents actief | ${d.agents_actief} — ${d.wie || '—'} |
| Gebeurtenissen | ${d.gebeurtenissen} |
| Rapporten | ${d.rapporten} |
| Berichten | ${d.berichten} |
| Poorten | ${d.poorten} |
| Waarschuwingen | ${d.waarschuwingen} |
| Fouten | ${d.fouten} |
| Kosten | $ ${Number(d.kosten_usd || 0).toFixed(4)} |

## Wat er gebeurde

${gs.map(regel).join('\n') || '*niets vastgelegd*'}
`;
}

/* 5. Eén bestand per agent: wat hij deed, wanneer hij voor het laatst werkte,
 *    en wat hij kostte. */
export function agentMd(agent, stroom, nu) {
  const gs = stroom.filter(g => g.wie === agent);
  const runs = gs.filter(g => g.soort === 'run');
  const kosten = runs.reduce((s, r) => s + Number(r.details?.kosten_usd || 0), 0);
  const laatst = gs[0]?.wanneer;
  const stilUren = laatst ? Math.round((new Date(nu) - new Date(laatst)) / 36e5) : null;

  return `
# ${agent[0].toUpperCase()}${agent.slice(1)}

> Afdruk van \`marketing_hq.brein\`. Niet bewerken — de identiteit en de
> guardrails van deze agent staan in [[../../agents/${agent}|agents/${agent}.md]].

| | |
|---|---|
| Gebeurtenissen | ${gs.length} |
| Runs | ${runs.length} |
| Rapporten | ${gs.filter(g => g.soort === 'rapport').length} |
| Kosten totaal | $ ${kosten.toFixed(4)} |
| Laatst actief | ${laatst ? `${datumNL(laatst)} ${tijd(laatst)} — ${stilUren} uur geleden` : '**nooit**'} |

## Laatste 60

${gs.slice(0, 60).map(regel).join('\n') || '*deze agent heeft nog nooit iets gedaan*'}
`;
}

/* ── uitvoeren ─────────────────────────────────────────────────────────── */
async function main() {
  if (!process.env.BREIN_JSON && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)) {
    console.error('SUPABASE_URL en SUPABASE_SERVICE_KEY moeten in de omgeving staan,');
    console.error('of BREIN_JSON moet naar een bestand met de drie arrays wijzen.');
    console.error('Zonder sleutel schrijft dit script niets — een lege vault leest als');
    console.error('"er is niets gebeurd", en dat is misleidender dan deze melding.');
    process.exit(1);
  }
  const nu = new Date().toISOString();

  const [stroom, dagen, werkbank] = process.env.BREIN_JSON
    ? await uitBestand()
    : await Promise.all([
        haal('brein', 'select=*&order=wanneer.desc&limit=2000'),
        haal('brein_dag', 'select=*&order=dag.desc&limit=60'),
        haal('werkbank', 'select=*&order=te_stil.desc,stil_uren.desc')
      ]);

  // Oude afdrukken weg, zodat een dag die uit de reeks valt niet blijft staan
  // als spookbestand. Alleen binnen Live/ — daarbuiten raakt dit script niets.
  if (existsSync(LIVE)) {
    for (const naam of await readdir(LIVE)) await rm(join(LIVE, naam), { recursive: true, force: true });
  }

  const geschreven = [];
  geschreven.push(await schrijf('Vandaag.md', vandaagMd(werkbank, nu)));
  geschreven.push(await schrijf('Werkstukken.md', werkstukkenMd(werkbank, stroom, nu)));
  geschreven.push(await schrijf('Logboek.md', logboekMd(stroom, nu)));
  for (const d of dagen) geschreven.push(await schrijf(`Dagen/${d.dag}.md`, dagMd(d, stroom)));
  for (const a of [...new Set(stroom.map(g => g.wie).filter(Boolean))].sort())
    geschreven.push(await schrijf(`Agents/${a}.md`, agentMd(a, stroom, nu)));

  console.log(`${geschreven.length} bestanden geschreven onder marketing-hq/brain/Live/`);
  console.log(`  ${stroom.length} gebeurtenissen · ${dagen.length} dagen · ${werkbank.length} werkstukken`);
  const stil = werkbank.filter(w => w.te_stil).length;
  console.log(stil ? `  ${stil} werkstuk(ken) liggen te lang stil — zie Live/Vandaag.md` : '  niets ligt te lang stil');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
