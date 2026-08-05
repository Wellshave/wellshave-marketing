/* ============================================================
 * Marketing OS — Cloudflare Worker
 *
 * Superset van atelier-proxy: alle bestaande endpoints doen exact wat ze deden,
 * en daar bovenop draait de agent-runtime. Dit bestand vervangt
 * ad-generator/worker/atelier-proxy.worker.js in de worker `marketing-ads`.
 *
 * Endpoints (ongewijzigd):
 *   GET   /health                 health (open)
 *   POST  /anthropic              Claude          (login vereist)
 *   POST  /openai/<rest>          OpenAI-beeld    (login vereist)
 *   POST  /v1/<rest>              OpenAI (alias)  (login vereist)
 *
 * Endpoints (nieuw, allemaal login vereist):
 *   GET   /agents/status          agents + lopende jobs + laatste events
 *   GET   /agents/jobs            de wachtrij
 *   POST  /agents/run             werk in de rij zetten
 *   POST  /agents/jobs/<id>/cancel
 *   POST  /agents/tick            handmatig een cyclus draaien (om te testen)
 *
 * Cron (wrangler.toml → [triggers] crons):
 *   elke 5 minuten → scheduled() → planning omzetten in jobs + rij afwerken
 *
 * Secrets:
 *   ANTHROPIC_KEY          verplicht — Claude
 *   OPENAI_KEY             verplicht — beeldgeneratie
 *   SUPABASE_SERVICE_KEY   verplicht voor de runtime — schrijft in marketing_hq
 *   META_ACCESS_TOKEN      optioneel — zonder dit werkt meta_insights niet
 *   META_AD_ACCOUNT_ID     optioneel — bv. act_242238038391551
 *   KLAVIYO_API_KEY        optioneel — zonder dit werken de klaviyo-tools niet
 *
 * Guardrail die in de code zit, niet in de prompt: er bestaat geen tool die
 * geld uitgeeft of iets verstuurt. Alles naar buiten loopt via request_approval
 * en wacht op een mens. Een agent kan daar niet omheen praten.
 * ============================================================ */

const SB_URL = 'https://bequyhghgkvekvibufhw.supabase.co';
const SB_ANON = 'sb_publishable_7uZ5nZeep7NAARG1v9F5iA_a7GSALPv';
/* Wie de worker rechtstreeks vanuit de browser mag aanroepen. Staat een
   omgeving hier niet in, dan kan hij alleen via een tussenstap op zijn eigen
   origin — en die kapt lange calls af. Een adres erbij is dus goedkoper dan het
   omzeilen ervan. */
const ORIGINS = ['https://wellshave-adgen.netlify.app', 'https://wellshave-werkbank.netlify.app',
                 'http://localhost:8823', 'http://127.0.0.1:8823'];

const MODEL = 'claude-fable-5';
const FALLBACK_MODEL = 'claude-opus-4-8';
const META_API = 'https://graph.facebook.com/v21.0';

/* De Facebook-pagina waaronder de advertenties hangen. Geverifieerd tegen het
   account: bestaande creatives hebben een object_story_id die hiermee begint. */
const META_PAGE_ID = '100135282880333';
const WINKEL_URL = 'https://wellshave.nl';
const KLAVIYO_API = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2025-07-15';

/* Hoeveel werk één cron-tick doet. Een Worker-invocatie heeft beperkte tijd;
   liever drie jobs per tick dan één tick die halverwege wordt afgekapt. */
const JOBS_PER_TICK = 3;
const MAX_AGENT_STEPS = 12;      // tool-rondes per run
const JOB_TIMEOUT_MIN = 15;      // daarna geldt een job als vastgelopen

/* ============================================================
 * 1. Supabase — server-side, met de service key
 * ============================================================ */

function sbHeaders(env, extra) {
  const key = env.SUPABASE_SERVICE_KEY;
  return Object.assign({
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  }, extra || {});
}

/* PostgREST spreekt alleen public aan; marketing_hq is bereikbaar via de
   hq_*-views uit 0002/0004/0005. Schrijven gaat rechtstreeks op het schema
   met de Accept-Profile/Content-Profile-headers. */
async function sbSelect(env, table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query || ''}`, {
    headers: sbHeaders(env, { 'Accept-Profile': 'marketing_hq' })
  });
  if (!r.ok) throw new Error(`select ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbInsert(env, table, rows, opts) {
  const prefer = ['return=representation'];
  if (opts && opts.onConflict) prefer.push('resolution=merge-duplicates');
  const url = `${SB_URL}/rest/v1/${table}` +
    (opts && opts.onConflict ? `?on_conflict=${opts.onConflict}` : '');
  const r = await fetch(url, {
    method: 'POST',
    headers: sbHeaders(env, { 'Content-Profile': 'marketing_hq', 'Prefer': prefer.join(',') }),
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
  });
  if (!r.ok) throw new Error(`insert ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbUpdate(env, table, query, patch) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: sbHeaders(env, { 'Content-Profile': 'marketing_hq', 'Prefer': 'return=representation' }),
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error(`update ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function sbRpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: sbHeaders(env, { 'Content-Profile': 'marketing_hq' }),
    body: JSON.stringify(args || {})
  });
  if (!r.ok) throw new Error(`rpc ${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* Publieke tabellen van de console (creatives, products, personas, …). */
async function sbPublic(env, table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query || ''}`, { headers: sbHeaders(env) });
  if (!r.ok) throw new Error(`select public.${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

/* ============================================================
 * 2. De agents
 *
 * Identiteit en guardrails staan in marketing-hq/agents/*.md — dat blijft de
 * bron van waarheid voor het team. Hieronder staat de werkinstructie zoals de
 * runtime hem meegeeft: korter, en met wat de agent in deze omgeving mag.
 * ============================================================ */

const HUISREGELS = `
Je werkt voor Wellshave (scheerapparaten, DTC) en het zustermerk Wellshine.
Je bent onderdeel van een team van AI-agents met een gedeelde database.

Vaste regels:
- Analyseren en klaarzetten mag je zelfstandig. Uitvoeren nooit. Budget wijzigen,
  een campagne live zetten of een e-mail versturen loopt altijd via
  request_approval en wacht op een mens.
- Meta-attributie druppelt tot 72 uur na. Cijfers van gisteren zijn voorlopig;
  zeg dat erbij in plaats van ze als definitief te presenteren.
- Schrijf Nederlands, zakelijk en zonder opsmuk. Geen superlatieven.
- Onderbouw met getallen uit de tools. Weet je iets niet, zeg dat dan; verzin
  geen cijfers.
- Rond je run af met precies één samenvatting van maximaal drie zinnen: wat je
  hebt gedaan en wat het betekent.
`.trim();

const AGENTS = {
  atlas: {
    naam: 'Atlas',
    rol: 'Data-analyst',
    tools: ['db_query', 'meta_insights', 'meta_publiek', 'write_report', 'send_message', 'request_approval'],
    prompt: `Je bent Atlas, de data-analist. Jij bepaalt wat er werkelijk gebeurt in de cijfers.

Je bent de eerste in de dagcyclus. Wat jij vaststelt is waar de rest van het
team vandaag op verderwerkt; wat jij mist, mist iedereen.

Bij kind = daily_report:
1. Kijk eerst met db_query in meting_dekking welke dagen er zijn en welke
   ontbreken. Dit gaat vóór het ophalen: je kunt pas zeggen dat er niets
   ontbreekt als je gekeken hebt.
2. Haal met meta_insights de cijfers op van gisteren én de drie dagen daarvoor
   (attributie loopt na, dus corrigeer die dagen).
3. Kijk naar spend, ROAS, CPA, CTR, CPM en frequentie op accountniveau, en
   daarna naar de campagnes die het meest bewegen.
4. Schrijf met write_report een dagrapport: wat is er veranderd, waardoor, en
   wat is het één ding dat vandaag aandacht nodig heeft. Geen opsomming van
   alle getallen — een oordeel, onderbouwd met de getallen die ertoe doen.
   Vul periode_start en periode_eind in, zet in cijfers de getallen waarop je
   oordeelde, in signalen wat opviel, en in gaten de dagen uit stap 1 die
   ontbraken. Rapporteer dát er iets ontbreekt; vul het nooit in.
5. Zie je iets dat om actie vraagt (een campagne die wegloopt, een ad die
   opeens instort), stuur dan send_message naar bolt of nova.

Bij kind = account_audit (wekelijks):
1. Haal met meta_insights de cijfers op campagne- en advertentieniveau over
   30 dagen, en met meta_publiek de uitsplitsing per segment. Die laatste is
   niet optioneel: een frequentie die op accountniveau gezond lijkt kan op één
   segment ver doorgeslagen zijn, en dat zie je nergens anders.
2. Lees daarna met db_query de drie views die het rekenwerk al gedaan hebben:
   trechter, publiek_verzadiging en advertentie_scorekaart. Reken die getallen
   niet zelf na en overschrijf ze niet — ze zijn getest, jouw hoofdrekenen niet.
3. Kijk eerst naar de trechter. Waar lekt het, en is dat lek van deze campagne
   of van het hele account? De kolom zwakste_stap zegt waar deze campagne het
   slechter doet dan zijn soortgenoten, niet waar de meeste mensen afhaken —
   dat laatste is bijna altijd bovenin en zegt niets.
4. Staat er een waarschuwing bij een campagne, behandel die dan vóór het
   oordeel. Een pixel die ViewContent niet vuurt maakt elke conclusie over de
   bovenkant van die trechter waardeloos, en dat moet in je rapport staan als
   gat, niet als bevinding.
5. De scorekaart geeft per advertentie een oordeel of de reden waarom er geen
   is. Neem beide over. 'materiaal werkt, bestemming niet' is een diagnose en
   geen zwak 'stoppen' — een advertentie die doorklikt maar niet omzet vertelt
   je dat het probleem achter de klik zit.
6. Schrijf met write_report een rapport van kind audit: de trechter met de
   afhaakpunten, het publiek per segment, en per advertentie het oordeel. Zet
   in gaten wat je niet hebt kunnen meten. Sluit af met wat er als eerste moet
   gebeuren, met naam en id erbij — niet "pauzeer de onderpresteerders".

Wat je niet kunt zien, verzin je niet. Meta's kwaliteitsrangschikking en de
industriebenchmark komen voor dit account meestal leeg terug; de scorekaart
werkt daarom op twee signalen tegen onze eigen mediaan. Het veld signalen zegt
hoeveel het er waren. Schrijf nooit over drie signalen als het er twee zijn.

Krijg je van write_report voorlopig=true terug, dan is dat geen suggestie maar
een vaststelling: schrijf je samenvatting dan ook zo. Een rapport over de
laatste drie dagen is nooit definitief, en een rapport met gaten evenmin.`
  },

  bolt: {
    naam: 'Bolt',
    rol: 'Performance Marketeer',
    tools: ['db_query', 'meta_insights', 'write_recommendation', 'meta_prepare_ad', 'write_report', 'send_message', 'request_approval'],
    prompt: `Je bent Bolt, de performance marketeer. Jij staat op station 4 van de
estafette: waar een idee een draaiende advertentie wordt, en waar een oordeel
een handeling wordt.

Je zet zelf nooit iets live en je wijzigt zelf nooit een budget. Dat kan je
niet — de sleutel die je hebt mag het niet — en het hoort ook niet. Alles wat
geld kost of naar buiten werkt gaat via request_approval naar een mens.

Bij kind = publish_queue:
1. Zoek met db_query de creatives die klaarstaan om getest te worden
   (status 'To Test', has_image = true) en kijk welke al een publicatie hebben.
2. Zet er per keer hooguit drie klaar met meta_prepare_ad, in de ad set die
   erbij past. Meer tegelijk maakt de test onleesbaar.
3. Elke publicatie heeft een hypothese nodig in de vorm "als we X, dan Y, omdat
   Z". Zonder hypothese weet niemand later waarom deze advertentie bestond;
   zet hem dan niet klaar maar vraag erom via send_message aan nova.
4. meta_prepare_ad maakt zelf de goedkeuring aan. Jij zet niets live.

Bij kind = dagbesluit_opvolgen:
1. Lees met db_query de view hq_dagbesluit. Daar staat per advertentie al een
   oordeel, een handeling en een volgorde. Je velt dat oordeel niet opnieuw:
   het is in SQL berekend en levert bij dezelfde cijfers altijd hetzelfde op.
   Jouw werk is het omzetten in een verzoek dat een mens kan uitvoeren.
2. Neem alleen rijen met een actie ('uitzetten' of 'meer budget'), op volgorde
   van rang. Rijen zonder actie sla je over — daar is het oordeel dat er nog
   niets te besluiten valt.
3. Eén request_approval per advertentie. In de payload horen ad_id, account_id
   en de naam; bij een budgetwijziging ook bedrag_eur als getal. De database
   weigert een verzoek zonder id, en een budgetverzoek zonder bedrag als getal.
   Dat is geen formaliteit: een mens die moet terugzoeken wat je bedoelde, doet
   het niet.
4. Vraag nooit twee keer hetzelfde. De database weigert een tweede open verzoek
   voor dezelfde advertentie en handeling; krijg je die fout, dan staat het er
   al en ben je klaar met die regel.
5. Er mogen hooguit vijf verzoeken van jou tegelijk openstaan. Loop je daar
   tegenaan, dan stop je en meld je dat in je samenvatting — niet opnieuw
   proberen. Een lijst die niemand meer afhandelt is erger dan een korte lijst.
6. Zet in de beschrijving wat het oordeel was en waarop het rust: de ROAS, de
   CTR en de accountmediaan waartegen het is afgezet. Dat is wat iemand nodig
   heeft om binnen tien seconden ja of nee te zeggen.`
  },

  echo: {
    naam: 'Echo',
    rol: 'E-mailmarketeer',
    tools: ['db_query', 'klaviyo_read', 'email_draft', 'write_report', 'send_message', 'request_approval'],
    prompt: `Je bent Echo, de e-mailmarketeer. Jij haalt omzet uit de lijst zonder hem te vermoeien.

Bij kind = flow_audit:
1. Lees met klaviyo_read de flows (welcome, abandoned cart, browse abandon,
   post-purchase, winback) en hun prestaties.
2. Beoordeel per flow: staat er wat er hoort te staan, klopt de timing, en waar
   lekt omzet weg. Vergelijk met de campagnes uit dezelfde periode.
3. Schrijf je bevindingen met write_report, met per flow één concrete
   verbetering en waarom die het meeste oplevert.

Bij kind = campaign_plan:
1. Kijk met db_query naar wat er live staat in de creatie-pipeline en naar
   Atlas' laatste rapport, zodat e-mail en advertenties hetzelfde zeggen.
2. Stel een kalender voor de gevraagde periode voor en leg elke mail vast met
   email_draft: onderwerp, preview, segment, hoek en de hypothese erachter.
3. Bewaak frequentie. Meer dan drie touches per segment per week is een
   waarschuwing, geen plan.

Verzenden doe je nooit. Een concept blijft een concept tot een mens akkoord
geeft; pas daarna zet iemand het in Klaviyo.`
  },

  radar: {
    naam: 'Radar',
    rol: 'Trend- & Concurrentiescout',
    tools: ['db_query', 'write_report', 'send_message'],
    prompt: `Je bent Radar, de trend- en concurrentiescout. Jij ziet wat er buiten gebeurt.

Bij kind = trend_scan: schrijf een briefing over wat er beweegt in de markt
(scheren, grooming, DTC) en wat concurrenten doen. Wees eerlijk over wat je
niet kunt zien: zolang Trendtrack nog niet server-side gekoppeld is, werk je
met wat er in de database staat en met wat het team heeft aangeleverd. Verzin
geen concurrentiedata.`
  },

  nova: {
    naam: 'Nova',
    rol: 'Creative Director & Strategie',
    tools: ['db_query', 'update_pipeline', 'write_report', 'send_message', 'request_approval'],
    prompt: `Je bent Nova, creative director. Jij vertaalt cijfers naar de volgende creatieve zet.

Bij kind = pipeline_sync:
1. Lees Atlas' laatste rapport, de open aanbevelingen van Bolt en de huidige
   pipeline-items.
2. Werk de pipeline bij met update_pipeline: wat is klaar voor de volgende
   stap, wat ligt stil, en wat moet erbij op basis van wat werkt.
3. Formuleer per nieuw item één hypothese in de vorm "als we X, dan Y, omdat Z".
4. Brief het contentteam met send_message: quill voor copy, pixel voor beeld.`
  }
};

/* ============================================================
 * 3. Tools — smal, en per agent beperkt
 * ============================================================ */

/* Wat een agent mag lezen. Alles daarbuiten geeft een nette weigering terug in
   plaats van een fout, zodat de agent het zelf kan oplossen. */
const LEESBAAR_HQ = ['agents', 'agent_runs', 'agent_messages', 'pipeline_items',
  'pipeline_events', 'reports', 'metrics_daily', 'approvals',
  'meta_insights_daily', 'meta_recommendations', 'email_drafts', 'email_performance',
  /* 0012 — wat een agent over zichzelf en over zijn databasis mag weten */
  'meting_dekking', 'agent_afspraken', 'agent_nakoming', 'atlas_dagrapport',
  /* 0013 — het rekenwerk onder de audit, al getest en dus niet zelf natellen */
  'trechter', 'publiek_verzadiging', 'advertentie_scorekaart', 'meta_publiek'];
const LEESBAAR_PUBLIC = ['creatives', 'products', 'personas', 'brand_profile', 'ad_results'];

const TOOLS = {
  db_query: {
    schema: {
      name: 'db_query',
      description: 'Lees rijen uit de database. Alleen lezen. Gebruik dit om te weten wat het team maakt (creatives, products, personas) en wat het systeem eerder concludeerde (reports, meta_recommendations, pipeline_items).',
      input_schema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: `Een van: ${LEESBAAR_HQ.concat(LEESBAAR_PUBLIC).join(', ')}` },
          select: { type: 'string', description: 'Kolommen, komma-gescheiden. Default *' },
          filter: { type: 'string', description: 'PostgREST-filter, bv. "status=eq.live" of "created_at=gte.2026-07-01". Meerdere met &.' },
          order: { type: 'string', description: 'bv. "created_at.desc"' },
          limit: { type: 'integer', description: 'Max 200, default 50' }
        },
        required: ['table']
      }
    },
    async run(env, ctx, input) {
      const t = String(input.table || '').replace(/[^a-z_]/g, '');
      const isHq = LEESBAAR_HQ.includes(t);
      const isPub = LEESBAAR_PUBLIC.includes(t);
      if (!isHq && !isPub) {
        return { error: `tabel "${t}" staat niet op de leeslijst`, toegestaan: LEESBAAR_HQ.concat(LEESBAAR_PUBLIC) };
      }
      const q = [];
      q.push('select=' + encodeURIComponent(input.select || '*'));
      if (input.filter) q.push(input.filter);
      if (input.order) q.push('order=' + encodeURIComponent(input.order));
      q.push('limit=' + Math.min(Number(input.limit) || 50, 200));
      /* Een onbekende kolom is de meest gemaakte fout van een agent: hij kent
         het schema niet en gokt (meta_insights_daily.date bestaat niet, het is
         insight_date). Postgres zegt precies wélke kolom niet bestaat maar niet
         welke er wél zijn — dus dan gokt hij nog een keer, en gaan er twee van
         zijn twaalf tool-rondes op aan raden. Eén lege rij ophalen kost niets
         en levert de echte kolomnamen. */
      try {
        const rows = isHq ? await sbSelect(env, t, q.join('&')) : await sbPublic(env, t, q.join('&'));
        return { rows: rows, aantal: rows.length };
      } catch (e) {
        const fout = String(e && e.message || e);
        if (!/does not exist|42703/.test(fout)) throw e;
        let kolommen = null;
        try {
          const proef = isHq ? await sbSelect(env, t, 'select=*&limit=1')
                             : await sbPublic(env, t, 'select=*&limit=1');
          if (proef && proef[0]) kolommen = Object.keys(proef[0]);
        } catch (e2) { /* dan zonder lijst; de fout zelf is al bruikbaar */ }
        return kolommen
          ? { error: fout, kolommen_in_deze_tabel: kolommen }
          : { error: fout };
      }
    }
  },

  meta_insights: {
    schema: {
      name: 'meta_insights',
      description: 'Haal Meta Ads-cijfers op. Alleen lezen. Schrijft de opgehaalde dagen ook weg naar de database, zodat het team ze in de console ziet.',
      input_schema: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['account', 'campaign', 'adset', 'ad'], description: 'Detailniveau' },
          days: { type: 'integer', description: 'Aantal dagen terug, 1-30. Default 7.' },
          breakdown_by_day: { type: 'boolean', description: 'Per dag uitsplitsen in plaats van één totaal over de periode' },
          account: { type: 'string', description: 'Eén specifiek advertentieaccount. Laat leeg om alle draaiende accounts op te halen — dat is bijna altijd wat je wilt.' }
        },
        required: ['level']
      }
    },
    async run(env, ctx, input) {
      if (!env.META_ACCESS_TOKEN) {
        return { error: 'Meta is niet gekoppeld op deze worker (META_ACCESS_TOKEN ontbreekt). Werk verder met wat er in meta_insights_daily staat.' };
      }
      const days = Math.min(Math.max(Number(input.days) || 7, 1), 30);
      const lijst = await actieveAccounts(env, input.account);
      if (!lijst.length) return { error: 'er staat geen enkel draaiend account in ad_accounts' };

      /* Per account apart ophalen. Eén account dat weigert mag de andere niet
         meenemen: het token hoeft niet elk business te dekken, en dat is een
         gat in de meting en geen storing. */
      const per_account = [], gaten = [];
      let totaal = 0;
      for (const acc of lijst) {
        let rows;
        try {
          rows = await metaInsights(env, input.level, days, !!input.breakdown_by_day, acc.account_id);
        } catch (e) {
          const reden = String(e && e.message || e);
          gaten.push({ account_id: acc.account_id, naam: acc.naam, reden: reden });
          /* Niet "weigerde account": dat leest als een rechtenprobleem, en dan
             ga je bij Meta naar Business Settings zoeken naar iets wat hier
             gebeurde. Wat Meta terugstuurde staat in de melding zelf; de
             samenvatting hoort ernaar te verwijzen, niet erover te oordelen. */
          await logEvent(env, ctx, 'warn',
            `Meta gaf geen cijfers voor ${acc.naam}: ${reden.slice(0, 160)}`, { fout: reden });
          continue;
        }
        if (rows.length) {
          try {
            await sbInsert(env, 'meta_insights_daily', rows, { onConflict: 'insight_date,account_id,level,entity_id' });
          } catch (e) {
            await logEvent(env, ctx, 'warn', 'Meta-cijfers ophalen lukte, wegschrijven niet', { fout: String(e) });
          }
        }
        totaal += rows.length;
        per_account.push({ account_id: acc.account_id, naam: acc.naam, merk: acc.merk,
                           aantal: rows.length, rijen: rows.slice(0, 40) });
      }
      const uit = { periode_dagen: days, niveau: input.level, accounts: per_account.length,
                    aantal: totaal, per_account: per_account };
      if (gaten.length) uit.gaten = gaten;
      if (lijst.some(a => a.noodrem)) {
        uit.waarschuwing = 'ad_accounts was niet leesbaar; teruggevallen op META_AD_ACCOUNT_ID. Dit is één account, mogelijk niet alle.';
      }
      return uit;
    }
  },

  meta_publiek: {
    schema: {
      name: 'meta_publiek',
      description: 'Haal spend en bereik op per publiekssegment (prospecting, engaged, existing). Alleen lezen. Dit is de enige manier om verzadiging per doelgroep te zien: een frequentie die op accountniveau gezond lijkt kan op één segment ver doorgeslagen zijn.',
      input_schema: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: 'Aantal dagen terug, 1-90. Default 30.' },
          account: { type: 'string', description: 'Eén specifiek account. Laat leeg voor alle draaiende accounts.' }
        }
      }
    },
    async run(env, ctx, input) {
      if (!env.META_ACCESS_TOKEN) {
        return { error: 'Meta is niet gekoppeld op deze worker. Werk verder met wat er in meta_publiek staat.' };
      }
      const days = Math.min(Math.max(Number(input.days) || 30, 1), 90);
      const lijst = await actieveAccounts(env, input.account);
      if (!lijst.length) return { error: 'er staat geen enkel draaiend account in ad_accounts' };

      const per_account = [], gaten = [];
      let totaal = 0;
      for (const acc of lijst) {
        let rijen;
        try {
          rijen = await metaPubliek(env, days, acc.account_id);
        } catch (e) {
          /* Deze uitsplitsing is niet op elk account beschikbaar. Dat is een gat
             in de meting, geen storing — de agent moet het kunnen melden in
             plaats van erop vastlopen. */
          gaten.push({ account_id: acc.account_id, naam: acc.naam,
                       gat: 'publiek per segment', reden: String(e && e.message || e) });
          continue;
        }
        if (!rijen.length) {
          gaten.push({ account_id: acc.account_id, naam: acc.naam, gat: 'publiek per segment',
                       reden: 'Meta gaf geen segmentregels terug voor dit venster' });
          continue;
        }
        try {
          await sbInsert(env, 'meta_publiek', rijen, { onConflict: 'account_id,van,tot,segment' });
        } catch (e) {
          await logEvent(env, ctx, 'warn', 'Publiek ophalen lukte, wegschrijven niet', { fout: String(e) });
        }
        totaal += rijen.length;
        per_account.push({ account_id: acc.account_id, naam: acc.naam, aantal: rijen.length, rijen: rijen });
      }
      const uit = { periode_dagen: days, accounts: per_account.length, aantal: totaal, per_account: per_account };
      if (gaten.length) uit.gaten = gaten;
      return uit;
    }
  },

  klaviyo_read: {
    schema: {
      name: 'klaviyo_read',
      description: 'Lees uit Klaviyo. Alleen lezen: flows, campagnes, lijsten, segmenten en hun prestaties.',
      input_schema: {
        type: 'object',
        properties: {
          resource: { type: 'string', enum: ['flows', 'campaigns', 'lists', 'segments', 'metrics'] },
          limit: { type: 'integer', description: 'Max 50, default 20' }
        },
        required: ['resource']
      }
    },
    async run(env, ctx, input) {
      if (!env.KLAVIYO_API_KEY) {
        return { error: 'Klaviyo is niet gekoppeld op deze worker (KLAVIYO_API_KEY ontbreekt).' };
      }
      const limit = Math.min(Number(input.limit) || 20, 50);
      const res = String(input.resource);
      let path = res;
      // Campagnes vereisen een filter op kanaal; zonder dat geeft Klaviyo een 400.
      if (res === 'campaigns') path = `campaigns?filter=equals(messages.channel,'email')&page[size]=${limit}`;
      else path = `${res}?page[size]=${limit}`;
      const r = await fetch(`${KLAVIYO_API}/${path}`, {
        headers: {
          'Authorization': 'Klaviyo-API-Key ' + env.KLAVIYO_API_KEY,
          'revision': KLAVIYO_REVISION,
          'accept': 'application/vnd.api+json'
        }
      });
      const txt = await r.text();
      if (!r.ok) return { error: `Klaviyo ${r.status}`, detail: txt.slice(0, 500) };
      const data = JSON.parse(txt);
      const items = (data.data || []).map(d => ({ id: d.id, type: d.type, ...(d.attributes || {}) }));
      return { resource: res, aantal: items.length, items: items };
    }
  },

  write_report: {
    schema: {
      name: 'write_report',
      description: 'Leg een rapport vast. Dit is hoe je conclusie het team bereikt. Naast het verhaal leg je vast waar het op rust: de periode, de cijfers, en wat er ontbrak.',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['daily', 'audit', 'trend_briefing', 'deep_dive', 'competitor'] },
          title: { type: 'string' },
          body_md: { type: 'string', description: 'Markdown. Begin met de conclusie, daarna de onderbouwing.' },
          report_date: { type: 'string', description: 'JJJJ-MM-DD, default vandaag' },
          periode_start: { type: 'string', description: 'JJJJ-MM-DD — eerste dag waarover dit rapport gaat' },
          periode_eind: { type: 'string', description: 'JJJJ-MM-DD — laatste dag waarover dit rapport gaat' },
          cijfers: { type: 'object', description: 'De getallen waarop je oordeel rust, zoals je ze uit de tools kreeg. Verplicht bij kind=daily.' },
          signalen: { type: 'array', description: 'Wat opviel. Per signaal {naam, richting: op|neer|vlak, waarde, toelichting}.', items: { type: 'object' } },
          gaten: { type: 'array', description: 'Dagen of bronnen waarvoor geen data was. Noem ze; een gat is geen nul.', items: { type: 'string' } },
          voorlopig: { type: 'boolean', description: 'Zet dit zelf op true als je twijfelt. Raakt de periode de laatste 72 uur, dan gebeurt het sowieso.' }
        },
        required: ['kind', 'title', 'body_md']
      }
    },
    async run(env, ctx, input) {
      /* Een dagrapport zonder getallen is een mening met een datum erop. De
         database weigert het ook, maar een nette weigering hier laat de agent
         het herstellen in plaats van vastlopen op een 400. */
      if (input.kind === 'daily' && (!input.cijfers || !Object.keys(input.cijfers).length)) {
        return { error: 'een dagrapport heeft cijfers nodig — de getallen waarop je oordeel rust, uit je tools' };
      }
      const row = {
        report_date: input.report_date || vandaag(),
        kind: input.kind,
        title: input.title,
        author_agent: ctx.agentId,
        body_md: input.body_md,
        periode_start: input.periode_start || null,
        periode_eind: input.periode_eind || null,
        cijfers: input.cijfers || {},
        signalen: Array.isArray(input.signalen) ? input.signalen : [],
        gaten: Array.isArray(input.gaten) ? input.gaten : [],
        voorlopig: !!input.voorlopig
      };
      const out = await sbInsert(env, 'reports', row, { onConflict: 'report_date,kind,title' });
      const opgeslagen = out[0] || {};
      /* Teruggeven wat de database ervan maakte. Zette hij `voorlopig` alsnog
         aan, dan hoort de agent dat te weten voordat hij zijn samenvatting
         schrijft — anders staat er "definitief" in het ene veld en "voorlopig"
         in het andere. */
      return {
        ok: true,
        report_id: opgeslagen.id,
        voorlopig: opgeslagen.voorlopig,
        voorlopig_reden: opgeslagen.voorlopig_reden || null
      };
    }
  },

  write_recommendation: {
    schema: {
      name: 'write_recommendation',
      description: 'Leg je oordeel over één advertentie vast. Eén aanroep per advertentie.',
      input_schema: {
        type: 'object',
        properties: {
          ad_id: { type: 'string' },
          ad_name: { type: 'string' },
          account_id: { type: 'string', description: 'Het account waar deze advertentie in draait. Zonder dit is het oordeel niet terug te vinden zodra er meer dan één account is.' },
          verdict: { type: 'string', enum: ['winner', 'test', 'loser', 'onvoldoende_data'] },
          action: { type: 'string', enum: ['scale', 'iterate', 'copy', 'new', 'pause', 'wait'] },
          confidence: { type: 'number', description: '0 tot 1' },
          reasoning: { type: 'string', description: 'Maximaal twee zinnen, met de cijfers erin.' },
          metrics_snapshot: { type: 'object', description: 'De cijfers waar je op oordeelde' },
          window_days: { type: 'integer' }
        },
        required: ['ad_id', 'verdict', 'action', 'reasoning']
      }
    },
    async run(env, ctx, input) {
      const row = {
        account_id: kaalAccount(input.account_id || env.META_AD_ACCOUNT_ID) || 'onbekend',
        ad_id: String(input.ad_id),
        ad_name: input.ad_name || null,
        verdict: input.verdict,
        action: input.action,
        confidence: input.confidence != null ? Number(input.confidence) : null,
        reasoning: input.reasoning,
        metrics_snapshot: input.metrics_snapshot || null,
        window_days: Number(input.window_days) || 7,
        agent_id: ctx.agentId,
        run_id: ctx.runId
      };
      const out = await sbInsert(env, 'meta_recommendations', row);
      return { ok: true, id: out[0] && out[0].id };
    }
  },

  email_draft: {
    schema: {
      name: 'email_draft',
      description: 'Leg een e-mailconcept vast. Het blijft een concept: dit verstuurt niets en zet niets in Klaviyo.',
      input_schema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['campaign', 'flow_message'] },
          title: { type: 'string', description: 'Interne naam' },
          subject: { type: 'string' },
          preview_text: { type: 'string' },
          body_md: { type: 'string' },
          segment: { type: 'string', description: 'Wie moet dit krijgen, in woorden' },
          planned_for: { type: 'string', description: 'JJJJ-MM-DD' },
          angle: { type: 'string' },
          hypothesis: { type: 'string', description: 'Als we X, dan Y, omdat Z' },
          flow_ref: { type: 'string' }
        },
        required: ['kind', 'title', 'subject']
      }
    },
    async run(env, ctx, input) {
      const row = {
        kind: input.kind,
        title: input.title,
        subject: input.subject,
        preview_text: input.preview_text || null,
        body_md: input.body_md || null,
        segment: input.segment || null,
        planned_for: input.planned_for || null,
        angle: input.angle || null,
        hypothesis: input.hypothesis || null,
        flow_ref: input.flow_ref || null,
        author_agent: ctx.agentId,
        run_id: ctx.runId
      };
      const out = await sbInsert(env, 'email_drafts', row);
      return { ok: true, draft_id: out[0] && out[0].id, status: 'concept' };
    }
  },

  update_pipeline: {
    schema: {
      name: 'update_pipeline',
      description: 'Maak een pipeline-item aan of verplaats er een. Elke statuswijziging wordt gelogd.',
      input_schema: {
        type: 'object',
        properties: {
          item_id: { type: 'integer', description: 'Leeg laten om een nieuw item te maken' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['ugc_video', 'static', 'email', 'landing_page', 'script', 'campaign'] },
          status: { type: 'string', enum: ['idea', 'hypothesis', 'script', 'with_creator', 'filming', 'editing', 'ready_for_launch', 'live', 'analyzed', 'archived'] },
          hypothesis: { type: 'string' },
          angle: { type: 'string' },
          notes: { type: 'string' },
          owner_agent: { type: 'string' }
        }
      }
    },
    async run(env, ctx, input) {
      if (input.item_id) {
        const huidig = await sbSelect(env, 'pipeline_items', `id=eq.${Number(input.item_id)}&select=status`);
        const van = huidig[0] && huidig[0].status;
        const patch = { updated_at: new Date().toISOString() };
        ['title', 'type', 'status', 'hypothesis', 'angle', 'notes', 'owner_agent'].forEach(k => {
          if (input[k] != null) patch[k] = input[k];
        });
        await sbUpdate(env, 'pipeline_items', `id=eq.${Number(input.item_id)}`, patch);
        if (input.status && input.status !== van) {
          await sbInsert(env, 'pipeline_events', {
            item_id: Number(input.item_id), from_status: van, to_status: input.status,
            by_agent: ctx.agentId, note: input.notes || null
          });
        }
        return { ok: true, item_id: Number(input.item_id), van_status: van, naar_status: input.status || van };
      }
      if (!input.title || !input.type) return { error: 'title en type zijn verplicht voor een nieuw item' };
      const out = await sbInsert(env, 'pipeline_items', {
        title: input.title, type: input.type, status: input.status || 'idea',
        owner_agent: input.owner_agent || ctx.agentId,
        hypothesis: input.hypothesis || null, angle: input.angle || null, notes: input.notes || null
      });
      const id = out[0] && out[0].id;
      await sbInsert(env, 'pipeline_events', {
        item_id: id, from_status: null, to_status: input.status || 'idea', by_agent: ctx.agentId
      });
      return { ok: true, item_id: id, aangemaakt: true };
    }
  },

  send_message: {
    schema: {
      name: 'send_message',
      description: 'Stuur een bericht aan een andere agent. Die leest het bij zijn volgende run.',
      input_schema: {
        type: 'object',
        properties: {
          to_agent: { type: 'string', description: 'nova, atlas, radar, quill, pixel, echo, bolt, sage of vector' },
          subject: { type: 'string' },
          body: { type: 'string' },
          ref_pipeline_item: { type: 'integer' }
        },
        required: ['to_agent', 'subject', 'body']
      }
    },
    async run(env, ctx, input) {
      await sbInsert(env, 'agent_messages', {
        from_agent: ctx.agentId,
        to_agent: String(input.to_agent).toLowerCase(),
        subject: input.subject,
        body: input.body,
        ref_pipeline_item: input.ref_pipeline_item || null
      });
      return { ok: true };
    }
  },

  meta_prepare_ad: {
    schema: {
      name: 'meta_prepare_ad',
      description: 'Zet een creative uit de console klaar als advertentie bij Meta: beeld uploaden en de ad-creative aanmaken. Dit maakt GEEN advertentie en geeft dus niets uit — het levert een publicatie op die op goedkeuring wacht. Vraag na deze tool altijd request_approval aan; een mens zet hem live.',
      input_schema: {
        type: 'object',
        properties: {
          creative_id: { type: 'integer', description: 'De id uit de creatives-tabel van de console' },
          adset_id: { type: 'string', description: 'De ad set waar de advertentie in komt' },
          campaign_id: { type: 'string' },
          ad_name: { type: 'string', description: 'Naam van de advertentie in Meta' },
          headline: { type: 'string', description: 'De kop bij het beeld' },
          primary_text: { type: 'string', description: 'De tekst boven het beeld' },
          description: { type: 'string' },
          cta_type: { type: 'string', description: 'SHOP_NOW, ORDER_NOW, LEARN_MORE — het account gebruikt meestal ORDER_NOW' },
          link_url: { type: 'string', description: 'Waar de advertentie heen linkt. De herkomst wordt automatisch toegevoegd.' },
          daily_budget: { type: 'number', description: 'Voorgesteld dagbudget, alleen ter informatie bij de goedkeuring' },
          hypothesis: { type: 'string', description: 'Wat deze advertentie test: als we X, dan Y, omdat Z' }
        },
        required: ['creative_id', 'adset_id']
      }
    },
    async run(env, ctx, input) {
      if (!env.META_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) {
        return { error: 'Meta is niet gekoppeld op deze worker; publiceren kan niet.' };
      }
      return metaPrepare(env, ctx, input);
    }
  },

  request_approval: {
    schema: {
      name: 'request_approval',
      description: 'Zet een actie klaar die naar buiten werkt: budget wijzigen, campagne live zetten, e-mail versturen. Een mens beslist. Dit voert niets uit.',
      input_schema: {
        type: 'object',
        properties: {
          action_type: { type: 'string', description: 'bv. budget_change, campaign_launch, email_send, ad_pause' },
          description: { type: 'string', description: 'Wat, waarom, en wat je verwacht dat het oplevert. Eén alinea.' },
          payload: { type: 'object', description: 'De concrete parameters, zodat een mens het kan uitvoeren zonder terug te zoeken.' }
        },
        required: ['action_type', 'description']
      }
    },
    async run(env, ctx, input) {
      const out = await sbInsert(env, 'approvals', {
        requested_by: ctx.agentId,
        action_type: input.action_type,
        description: input.description,
        payload: input.payload || null
      });
      return { ok: true, approval_id: out[0] && out[0].id, status: 'wacht op een mens' };
    }
  }
};

/* ============================================================
 * 4. Meta Ads
 * ============================================================ */

function metaActie(acties, naam) {
  if (!Array.isArray(acties)) return null;
  const a = acties.find(x => x.action_type === naam);
  return a ? Number(a.value) : null;
}

/* act_ ervoor of niet: Meta accepteert beide op de insights-edge, maar niet
   overal. Intern werken we zonder, en zetten het erop waar het moet. */
function kaalAccount(id) { return String(id || '').replace(/^act_/, ''); }

/* De accounts komen uit ad_accounts (0014), niet uit META_AD_ACCOUNT_ID. Een
   secret is één waarde en kent geen merk, geen valuta en geen "deze ligt stil
   sinds mei" — en je kunt er niet op joinen.

   Valt de database weg, dan blijft het secret als noodrem staan: liever één
   account meten dan nul. Dat wordt wel gemeld, want stilzwijgend terugvallen
   op één account is precies hoe de audit van 30 juli over één account ging
   terwijl er vijf waren. */
async function actieveAccounts(env, alleen) {
  if (alleen) return [{ account_id: kaalAccount(alleen), naam: kaalAccount(alleen), merk: null }];
  try {
    const rijen = await sbSelect(env, 'ad_accounts',
      'actief=is.true&select=account_id,naam,merk,valuta,primair&order=primair.desc,naam.asc');
    if (rijen.length) return rijen.map(r => ({ ...r, account_id: kaalAccount(r.account_id) }));
  } catch (e) { /* hieronder de noodrem */ }
  if (!env.META_AD_ACCOUNT_ID) return [];
  return [{ account_id: kaalAccount(env.META_AD_ACCOUNT_ID), naam: 'uit META_AD_ACCOUNT_ID',
            merk: null, noodrem: true }];
}

/* Welk account hoort bij dit merk. Bij meerdere draaiende accounts op hetzelfde
   merk wint de primaire; staan er twee primair, dan is dat een keuze die een
   mens moet maken en geen gok die een agent mag doen. */
async function accountVoorMerk(env, merk) {
  if (!merk) return null;
  let rijen;
  try {
    rijen = await sbSelect(env, 'ad_accounts',
      `actief=is.true&merk=eq.${encodeURIComponent(String(merk).toLowerCase())}`
      + '&select=account_id,primair&order=primair.desc');
  } catch (e) { return null; }
  if (!rijen.length) return null;
  if (rijen.length > 1 && rijen[0].primair && rijen[1].primair) return null;
  return rijen[0].account_id;
}

/* Meta accepteert maar een handvol date_preset-waarden: last_3d, last_7d,
   last_14d, last_28d, last_30d, last_90d. "last_4d" bestaat niet, en dat is
   precies wat er uit 'last_' + days + 'd' rolde toen Atlas vier dagen vroeg —
   de attributiestaart loopt na, dus vier dagen is een normale vraag. Meta wees
   beide accounts af met een lijst toegestane waarden, en de melding daarboven
   maakte er "Meta weigerde account" van: dat leest als een rechtenprobleem en
   stuurt je naar Business Settings terwijl de fout hier stond.

   Afronden naar de dichtstbijzijnde toegestane waarde is geen oplossing: dan
   vraagt Atlas vier dagen en meet hij er zeven, zonder dat iemand dat ziet.
   time_range met een expliciete begin- en einddatum geeft exact het venster
   dat gevraagd is, voor elk aantal dagen.

   Vandaag telt mee (Meta rekent inclusief), dus het venster loopt van
   days-1 dagen geleden tot en met vandaag — bij days=4 zijn dat vier dagen. */
function metaVenster(days) {
  var n = Math.max(1, Math.min(Number(days) || 7, 365));
  var eind = new Date();
  var start = new Date(eind.getTime() - (n - 1) * 86400000);
  var dag = function (d) { return d.toISOString().slice(0, 10); };
  return JSON.stringify({ since: dag(start), until: dag(eind) });
}

async function metaInsights(env, level, days, perDag, accountId) {
  const account = kaalAccount(accountId || env.META_AD_ACCOUNT_ID);
  const velden = ['spend', 'impressions', 'reach', 'frequency', 'clicks', 'inline_link_clicks',
    'ctr', 'cpc', 'cpm', 'actions', 'action_values', 'purchase_roas',
    'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
    'video_3_sec_watched_actions'];
  if (level !== 'account') velden.push(level + '_id', level + '_name');

  const p = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    level: level,
    fields: velden.join(','),
    time_range: metaVenster(days),
    limit: '200'
  });
  if (perDag) p.set('time_increment', '1');

  const r = await fetch(`${META_API}/act_${account}/insights?${p}`);
  const data = await r.json();
  if (data.error) throw new Error('Meta: ' + (data.error.message || JSON.stringify(data.error)));

  return (data.data || []).map(row => {
    const acties = row.actions || [];
    const waarden = row.action_values || [];
    const aankopen = metaActie(acties, 'purchase') || metaActie(acties, 'omni_purchase');
    const omzet = metaActie(waarden, 'purchase') || metaActie(waarden, 'omni_purchase');
    const spend = Number(row.spend) || 0;
    const roasVeld = Array.isArray(row.purchase_roas) && row.purchase_roas[0]
      ? Number(row.purchase_roas[0].value) : null;
    return {
      insight_date: row.date_start || vandaag(),
      account_id: account,
      level: level,
      entity_id: row[level + '_id'] || account,
      entity_name: row[level + '_name'] || null,
      spend: spend,
      impressions: Number(row.impressions) || 0,
      reach: Number(row.reach) || null,
      frequency: row.frequency != null ? Number(row.frequency) : null,
      clicks: Number(row.clicks) || null,
      link_clicks: Number(row.inline_link_clicks) || null,
      ctr: row.ctr != null ? Number(row.ctr) : null,
      cpc: row.cpc != null ? Number(row.cpc) : null,
      cpm: row.cpm != null ? Number(row.cpm) : null,
      purchases: aankopen,
      purchase_value: omzet,
      roas: roasVeld != null ? roasVeld : (spend > 0 && omzet ? Number((omzet / spend).toFixed(3)) : null),
      add_to_cart: metaActie(acties, 'add_to_cart') || metaActie(acties, 'omni_add_to_cart'),
      initiate_checkout: metaActie(acties, 'initiate_checkout') || metaActie(acties, 'omni_initiated_checkout'),
      landing_page_views: metaActie(acties, 'landing_page_view'),
      /* Twee stappen die de audit van 30 juli miste. ViewContent is de
         belangrijkste: staat die ver onder landing_page_views, dan vuurt de
         pixel op de bestemming niet en is de hele bovenkant van de trechter
         onbruikbaar. Bij één campagne stonden er 37 tegenover 477. */
      view_content: metaActie(acties, 'view_content') || metaActie(acties, 'omni_view_content'),
      add_payment_info: metaActie(acties, 'add_payment_info') || metaActie(acties, 'omni_add_payment_info'),
      video_3s: metaActie(row.video_3_sec_watched_actions, 'video_view'),
      quality_ranking: row.quality_ranking || null,
      engagement_rate_ranking: row.engagement_rate_ranking || null,
      conversion_rate_ranking: row.conversion_rate_ranking || null,
      /* Meta corrigeert tot ~72 uur terug; alles binnen dat venster is voorlopig. */
      is_final: dagenGeleden(row.date_start) > 3
    };
  });
}

/* ============================================================
 * 4b. Publiceren naar Meta
 *
 * De scheiding die dit hele blok draagt: klaarzetten en publiceren zijn twee
 * verschillende dingen, met twee verschillende uitvoerders.
 *
 *   klaarzetten  — een agent mag dit. Beeld uploaden en een adcreative
 *                  aanmaken kost niets en levert niets af: een creative die
 *                  aan geen enkele advertentie hangt, wordt nooit vertoond.
 *   publiceren   — alleen een mens, via POST /agents/publications/<id>/publish,
 *                  en alleen als de bijbehorende approval op 'approved' staat.
 *                  Er bestaat geen agent-tool die deze stap kan zetten.
 *
 * Daarom maakt metaPrepare() wel een creative maar nooit een ad, en zit
 * metaPublish() niet in TOOLS maar achter een endpoint.
 * ============================================================ */

async function metaPost(env, pad, body, isForm) {
  const url = `${META_API}/${pad}`;
  let opties;
  if (isForm) {
    body.append('access_token', env.META_ACCESS_TOKEN);
    opties = { method: 'POST', body: body };
  } else {
    opties = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ access_token: env.META_ACCESS_TOKEN }, body))
    };
  }
  const r = await fetch(url, opties);
  const data = await r.json().catch(() => ({}));
  if (data.error) {
    const e = data.error;
    /* Meta's foutmeldingen zijn onleesbaar zonder de user-velden erbij. */
    throw new Error(`Meta ${e.code || r.status}: ${e.error_user_msg || e.message || 'onbekende fout'}`
      + (e.error_user_title ? ` (${e.error_user_title})` : ''));
  }
  if (!r.ok) throw new Error(`Meta ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

function base64NaarBytes(b64) {
  const schoon = String(b64).replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  const bin = atob(schoon);
  const uit = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) uit[i] = bin.charCodeAt(i);
  return uit;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Beeld naar Meta. Dezelfde bytes leveren dezelfde hash op, dus dit is uit
   zichzelf idempotent: twee keer uploaden geeft twee keer hetzelfde beeld. */
async function metaUploadImage(env, bytes, bestandsnaam, accountId) {
  const form = new FormData();
  form.append('filename', new Blob([bytes], { type: 'image/png' }), bestandsnaam || 'creative.png');
  const data = await metaPost(env, `act_${kaalAccount(accountId || env.META_AD_ACCOUNT_ID)}/adimages`, form, true);
  const images = data.images || {};
  const eerste = Object.keys(images)[0];
  if (!eerste) throw new Error('Meta gaf geen image hash terug');
  return images[eerste].hash;
}

/* De link met de herkomst erin. Dit is de tweede, onafhankelijke koppeling:
   ook als onze database omvalt, staat in de Shopify-order welke publicatie de
   klant heeft binnengebracht. */
function bouwLink(basis, publicationId) {
  const url = new URL(basis);
  url.searchParams.set('utm_source', 'facebook');
  url.searchParams.set('utm_medium', 'paid');
  url.searchParams.set('utm_content', 'wg-' + publicationId);
  return url.toString();
}

/* Zet alles klaar tot en met de adcreative. Maakt géén advertentie aan. */
async function metaPrepare(env, ctx, invoer) {
  /* 1. De creative uit de console ophalen — daar zit het beeld en de herkomst. */
  const rijen = await sbPublic(env, 'creatives', `id=eq.${Number(invoer.creative_id)}&select=*`);
  const c = rijen[0];
  if (!c) return { error: `creative ${invoer.creative_id} bestaat niet` };
  if (!c.image_b64) return { error: `creative ${invoer.creative_id} heeft geen beeld; publiceren kan niet` };

  /* Het account volgt het merk van de creative. Vóór 0014 stond hier één vaste
     waarde uit een secret, en dan was een Wellshine-advertentie in het
     Wellshave-account een kwestie van tijd. Liever weigeren dan gokken: een
     advertentie in het verkeerde account is met geen enkele query terug te
     draaien. */
  const account = kaalAccount(invoer.account_id || await accountVoorMerk(env, c.brand));
  if (!account) {
    return { error: `geen draaiend advertentieaccount voor merk "${c.brand || 'onbekend'}" — `
      + `zet er een in ad_accounts of geef account_id expliciet mee` };
  }

  const bytes = base64NaarBytes(c.image_b64);
  const sha = await sha256Hex(bytes);

  /* 2. Bestaat er al een publicatie voor deze creative in deze ad set?
        Zo ja: teruggeven in plaats van een tweede aanmaken. */
  const idem = `${c.id}:${invoer.adset_id}:${sha.slice(0, 16)}`;
  const bestaand = await sbSelect(env, 'meta_publications',
    `idem_key=eq.${encodeURIComponent(idem)}&select=*`);
  if (bestaand[0] && bestaand[0].status !== 'mislukt') {
    return {
      al_klaargezet: true, publication_id: bestaand[0].id, status: bestaand[0].status,
      opmerking: 'Deze creative staat al klaar voor deze ad set. Er is niets nieuws aangemaakt.'
    };
  }

  /* 3. Publicatierij eerst, want het id gaat mee in de link. */
  const pub = (await sbInsert(env, 'meta_publications', {
    brand: c.brand || 'wellshave',
    creative_id: c.id,
    ad_name: invoer.ad_name || c.ad_name || `Creative ${c.id}`,
    account_id: account,
    adset_id: String(invoer.adset_id),
    campaign_id: invoer.campaign_id || null,
    asset_kind: 'image',
    asset_sha256: sha,
    headline: invoer.headline || c.ad_name || null,
    primary_text: invoer.primary_text || c.hook_short || null,
    description: invoer.description || null,
    cta_type: invoer.cta_type || 'SHOP_NOW',
    link_url: invoer.link_url || WINKEL_URL,
    page_id: META_PAGE_ID,
    hypothesis: invoer.hypothesis || null,
    angle: c.marketing_angle || null,
    persona: c.persona || null,
    awareness_level: c.awareness_level || null,
    proposed_daily_budget: invoer.daily_budget != null ? Number(invoer.daily_budget) : null,
    prepared_by: ctx.agentId,
    run_id: ctx.runId,
    idem_key: idem,
    status: 'concept'
  }, { onConflict: 'idem_key' }))[0];

  try {
    /* 4. Beeld en creative bij Meta. Nog steeds geen advertentie. */
    const hash = await metaUploadImage(env, bytes, `wg-${pub.id}.png`, account);
    const link = bouwLink(invoer.link_url || WINKEL_URL, pub.id);

    const spec = {
      page_id: META_PAGE_ID,
      link_data: {
        image_hash: hash,
        link: link,
        message: invoer.primary_text || c.hook_short || '',
        name: invoer.headline || c.ad_name || '',
        call_to_action: { type: invoer.cta_type || 'SHOP_NOW', value: { link: link } }
      }
    };
    if (invoer.description) spec.link_data.description = invoer.description;

    const creative = await metaPost(env, `act_${account}/adcreatives`, {
      name: `${invoer.ad_name || c.ad_name || 'Creative ' + c.id} · wg-${pub.id}`,
      object_story_spec: spec,
      degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } } }
    });

    /* 5. De goedkeuring hoort bij het klaarzetten, niet bij de goede wil van de
          agent. Door hem hier aan te maken kan een publicatie nooit bestaan
          zonder dat er iets voor een mens klaarligt om over te beslissen. */
    const app = (await sbInsert(env, 'approvals', {
      requested_by: ctx.agentId,
      action_type: 'ad_publish',
      description: [
        `Advertentie live zetten: "${invoer.ad_name || c.ad_name || 'Creative ' + c.id}"`,
        `Ad set ${invoer.adset_id}.`,
        invoer.daily_budget ? `Voorgesteld dagbudget €${Number(invoer.daily_budget).toFixed(2)}.` : '',
        invoer.hypothesis ? `Test: ${invoer.hypothesis}` : '',
        'Beeld en creative staan klaar bij Meta; er is nog geen advertentie aangemaakt.'
      ].filter(Boolean).join(' '),
      payload: {
        publication_id: pub.id,
        creative_id: c.id,
        adset_id: invoer.adset_id,
        meta_creative_id: creative.id,
        link: link,
        daily_budget: invoer.daily_budget || null
      }
    }))[0];

    await sbUpdate(env, 'meta_publications', `id=eq.${pub.id}`, {
      meta_image_hash: hash,
      meta_creative_id: creative.id,
      object_story_spec: spec,
      utm_content: 'wg-' + pub.id,
      link_url: link,
      approval_id: app.id,
      status: 'wacht_op_akkoord',
      prepared_at: new Date().toISOString()
    });

    return {
      publication_id: pub.id,
      meta_creative_id: creative.id,
      approval_id: app.id,
      status: 'wacht_op_akkoord',
      opmerking: 'Beeld en creative staan bij Meta en de goedkeuring is aangemaakt. '
        + 'Er is nog GEEN advertentie; die kan alleen een mens live zetten.'
    };
  } catch (e) {
    await sbUpdate(env, 'meta_publications', `id=eq.${pub.id}`, {
      status: 'mislukt', error: String(e && e.message || e)
    });
    throw e;
  }
}

/* Publiceren. Alleen bereikbaar via het endpoint, alleen na akkoord.
   De advertentie wordt eerst PAUSED aangemaakt en daarna pas aangezet, zodat
   een half mislukte aanroep nooit ongemerkt budget uitgeeft. */
async function metaPublish(env, publicationId, gebruiker, direct_aan) {
  const account = String(env.META_AD_ACCOUNT_ID || '').replace(/^act_/, '');
  const rij = (await sbSelect(env, 'meta_publications', `id=eq.${publicationId}&select=*`))[0];
  if (!rij) return { error: 'publicatie bestaat niet', status: 404 };

  if (rij.meta_ad_id) {
    return { al_live: true, publication_id: rij.id, meta_ad_id: rij.meta_ad_id, status: rij.status };
  }
  if (!rij.meta_creative_id) {
    return { error: 'deze publicatie is niet voorbereid; er is geen creative bij Meta', status: 409 };
  }
  if (!rij.approval_id) {
    return { error: 'er hangt geen goedkeuring aan deze publicatie', status: 409 };
  }

  const app = (await sbSelect(env, 'approvals', `id=eq.${rij.approval_id}&select=status,description`))[0];
  if (!app || app.status !== 'approved') {
    return { error: `goedkeuring staat op "${app ? app.status : 'onbekend'}"; publiceren kan alleen na akkoord`, status: 403 };
  }

  await sbUpdate(env, 'meta_publications', `id=eq.${publicationId}`, {
    status: 'publiceren', attempts: (rij.attempts || 0) + 1
  });

  try {
    const ad = await metaPost(env, `act_${account}/ads`, {
      name: rij.ad_name,
      adset_id: rij.adset_id,
      creative: { creative_id: rij.meta_creative_id },
      status: 'PAUSED'
    });

    if (direct_aan) {
      await metaPost(env, ad.id, { status: 'ACTIVE' });
    }

    const uit = (await sbUpdate(env, 'meta_publications', `id=eq.${publicationId}`, {
      meta_ad_id: ad.id,
      status: direct_aan ? 'live' : 'gepauzeerd',
      published_by: gebruiker,
      published_at: new Date().toISOString(),
      error: null
    }))[0];

    /* De creative in de console weet nu dat hij draait. Vanaf hier kan Atlas
       het cijfer terugleiden naar deze hypothese. */
    if (rij.creative_id) {
      try {
        await fetch(`${SB_URL}/rest/v1/creatives?id=eq.${rij.creative_id}`, {
          method: 'PATCH',
          headers: sbHeaders(env, { 'Prefer': 'return=minimal' }),
          body: JSON.stringify({ status: 'Live', date_live: vandaag() })
        });
      } catch (e) { /* de publicatie is gelukt; dit is bijwerk-comfort */ }
    }

    await sbInsert(env, 'agent_events', {
      agent_id: rij.prepared_by || 'bolt',
      level: 'info',
      message: `Advertentie ${direct_aan ? 'live' : 'aangemaakt (gepauzeerd)'}: ${rij.ad_name}`,
      data: { publication_id: rij.id, meta_ad_id: ad.id, door: gebruiker }
    });

    return { ok: true, publication: uit, meta_ad_id: ad.id };
  } catch (e) {
    const fout = String(e && e.message || e);
    await sbUpdate(env, 'meta_publications', `id=eq.${publicationId}`, { status: 'mislukt', error: fout });
    return { error: fout, status: 502 };
  }
}

/* ============================================================
 * 5. De agent-loop
 * ============================================================ */

/* Fable 5 kan een thinking-blok vooraan zetten; blind content[0].text lezen
   crasht dan. Zelfde aanpak als wgClaudeText() in de console. */
function claudeText(data) {
  const blocks = data && data.content;
  if (Array.isArray(blocks)) {
    for (const b of blocks) if (b && b.type === 'text' && typeof b.text === 'string' && b.text.length) return b.text;
    for (const b of blocks) if (b && typeof b.text === 'string' && b.text.length) return b.text;
  }
  return '';
}

async function claude(env, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-06-01'
    },
    body: JSON.stringify(Object.assign({
      model: MODEL,
      fallbacks: [{ model: FALLBACK_MODEL }]
    }, body))
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(data.error && data.error.message) || JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function logEvent(env, ctx, level, message, data) {
  try {
    await sbInsert(env, 'agent_events', {
      job_id: ctx.jobId || null,
      run_id: ctx.runId || null,
      agent_id: ctx.agentId,
      level: level,
      message: message,
      data: data || null
    });
  } catch (e) {
    console.error('agent_events schrijven mislukt:', e);
  }
}

/* De uitsplitsing naar publiek. Apart van metaInsights omdat de korrel anders
   is: geen dagen maar één venster, want bereik is ontdubbeld binnen de periode
   die je opvraagt en dus niet over dagen op te tellen.

   Meta geeft bij deze uitsplitsing geen conversies terug. Dat hoeft ook niet —
   waar het om gaat is vertoningen gedeeld door bereik, en dat is de maat die
   een accountgemiddelde wegpoetst. */
async function metaPubliek(env, days, accountId) {
  const account = kaalAccount(accountId || env.META_AD_ACCOUNT_ID);
  const p = new URLSearchParams({
    access_token: env.META_ACCESS_TOKEN,
    level: 'account',
    fields: 'spend,impressions,reach',
    breakdowns: 'user_segment_key',
    time_range: metaVenster(days),
    limit: '50'
  });
  const r = await fetch(`${META_API}/act_${account}/insights?${p}`);
  const data = await r.json();
  if (data.error) throw new Error('Meta: ' + (data.error.message || JSON.stringify(data.error)));
  return (data.data || []).map(row => ({
    account_id: account,
    van: row.date_start,
    tot: row.date_stop,
    segment: row.user_segment_key || 'onbekend',
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    reach: Number(row.reach) || null
  }));
}

/* ============================================================
 * 5b. Systeemtaken
 *
 * Niet elk werk verdient een taalmodel. De terugkoppeling is optellen en delen:
 * er is één juist antwoord, en een model kan er alleen iets aan verzinnen.
 * Deze taken lopen door dezelfde wachtrij — met dezelfde logging, retries en
 * zichtbaarheid — maar zonder Claude ertussen.
 * ============================================================ */

const SYSTEEMTAKEN = {
  /* Stap 06: de cijfers per advertentie terug naar de creative waar hij uit
     voortkwam, zodat de generator bij de volgende ronde begint bij wat werkt. */
  async feedback_sync(env, ctx) {
    const uit = await sbRpc(env, 'sync_creative_results', {});
    await logEvent(env, ctx, 'info', 'Cijfers teruggeschreven naar de creatives', uit);

    /* Wat er nu bekend is over hoeken, zodat het in de live-feed zichtbaar is
       en niet alleen in een tabel die niemand opent. */
    let patronen = [];
    try {
      patronen = await sbSelect(env, 'angle_learnings',
        'betrouwbaar=eq.true&select=angle_type,persona,aantal_ads,roas&order=roas.desc&limit=5');
      if (patronen.length) {
        await logEvent(env, ctx, 'info',
          `Beste hoek nu: ${patronen[0].angle_type} (ROAS ${patronen[0].roas} over ${patronen[0].aantal_ads} ads)`,
          { patronen: patronen });
      }
    } catch (e) { /* de terugkoppeling zelf is gelukt; dit is alleen zicht */ }

    return {
      summary: `${uit.cijfers_bijgewerkt} creatives bijgewerkt met cijfers, `
        + `${uit.status_bijgewerkt} van status veranderd`
        + (patronen.length ? `. Sterkste hoek: ${patronen[0].angle_type}.` : '.'),
      ...uit
    };
  }
};

async function runAgent(env, job) {
  /* Systeemtaken eerst: die hebben geen agent-instructie nodig. */
  if (SYSTEEMTAKEN[job.kind]) {
    const ctx = { agentId: job.agent_id, jobId: job.id, runId: null };
    const run = (await sbInsert(env, 'agent_runs', {
      agent_id: job.agent_id, job_id: job.id, status: 'running', model: 'systeem'
    }))[0];
    ctx.runId = run.id;
    await sbUpdate(env, 'agents', `id=eq.${job.agent_id}`, {
      status: 'working', current_task: job.kind, last_run_at: new Date().toISOString()
    });
    try {
      const uit = await SYSTEEMTAKEN[job.kind](env, ctx, job.payload || {});
      await sbUpdate(env, 'agent_runs', `id=eq.${run.id}`, {
        status: 'done', finished_at: new Date().toISOString(),
        summary: uit.summary, input_tokens: 0, output_tokens: 0, cost_usd: 0
      });
      await sbUpdate(env, 'agents', `id=eq.${job.agent_id}`, { status: 'idle', current_task: null });
      return uit;
    } catch (e) {
      await sbUpdate(env, 'agent_runs', `id=eq.${run.id}`, {
        status: 'failed', finished_at: new Date().toISOString(), summary: String(e && e.message || e)
      });
      throw e;
    }
  }

  const agent = AGENTS[job.agent_id];
  if (!agent) throw new Error(`agent "${job.agent_id}" heeft nog geen runtime-instructie`);

  const ctx = { agentId: job.agent_id, jobId: job.id, runId: null };

  const run = (await sbInsert(env, 'agent_runs', {
    agent_id: job.agent_id, job_id: job.id, status: 'running', model: MODEL
  }))[0];
  ctx.runId = run.id;

  await sbUpdate(env, 'agents', `id=eq.${job.agent_id}`, {
    status: 'working', current_task: job.kind, last_run_at: new Date().toISOString()
  });
  await logEvent(env, ctx, 'info', `${agent.naam} begint aan ${job.kind}`, { payload: job.payload });

  const toolSchemas = agent.tools.filter(t => TOOLS[t]).map(t => TOOLS[t].schema);
  const systeem = `${agent.prompt}\n\n${HUISREGELS}\n\nVandaag is ${vandaag()}.`;

  const opdracht = [
    `Opdracht: ${job.kind}`,
    Object.keys(job.payload || {}).length ? `Parameters: ${JSON.stringify(job.payload)}` : '',
    '',
    'Voer deze opdracht nu uit. Gebruik je tools om aan echte data te komen; werk niet op aannames.'
  ].filter(Boolean).join('\n');

  const messages = [{ role: 'user', content: opdracht }];
  let inTokens = 0, outTokens = 0, samenvatting = '', stappen = 0;

  while (stappen < MAX_AGENT_STEPS) {
    stappen++;
    const antwoord = await claude(env, {
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      system: systeem,
      tools: toolSchemas,
      messages: messages
    });

    inTokens += (antwoord.usage && antwoord.usage.input_tokens) || 0;
    outTokens += (antwoord.usage && antwoord.usage.output_tokens) || 0;

    if (antwoord.stop_reason === 'refusal') throw new Error('Claude weigerde de opdracht');

    messages.push({ role: 'assistant', content: antwoord.content });

    const toolCalls = (antwoord.content || []).filter(b => b.type === 'tool_use');
    if (!toolCalls.length) {
      samenvatting = claudeText(antwoord);
      break;
    }

    const resultaten = [];
    for (const call of toolCalls) {
      const tool = TOOLS[call.name];
      let resultaat;
      if (!tool || !agent.tools.includes(call.name)) {
        resultaat = { error: `${agent.naam} heeft geen toegang tot de tool "${call.name}"` };
      } else {
        try {
          resultaat = await tool.run(env, ctx, call.input || {});
          await logEvent(env, ctx, 'info', `${call.name}`, { input: call.input, ok: !resultaat.error });
        } catch (e) {
          resultaat = { error: String(e && e.message || e) };
          await logEvent(env, ctx, 'warn', `${call.name} mislukte`, { fout: resultaat.error });
        }
      }
      resultaten.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify(resultaat).slice(0, 40000),
        is_error: !!resultaat.error
      });
    }
    messages.push({ role: 'user', content: resultaten });
  }

  if (stappen >= MAX_AGENT_STEPS && !samenvatting) {
    samenvatting = `Afgekapt na ${MAX_AGENT_STEPS} tool-rondes zonder afronding.`;
    await logEvent(env, ctx, 'warn', samenvatting, null);
  }

  /* Ruwe schatting, alleen om dagkosten zichtbaar te maken in de console. */
  const kosten = Number(((inTokens / 1e6) * 5 + (outTokens / 1e6) * 25).toFixed(4));

  await sbUpdate(env, 'agent_runs', `id=eq.${run.id}`, {
    status: 'done', finished_at: new Date().toISOString(),
    summary: samenvatting, input_tokens: inTokens, output_tokens: outTokens, cost_usd: kosten
  });
  await sbUpdate(env, 'agents', `id=eq.${job.agent_id}`, { status: 'idle', current_task: null });
  await logEvent(env, ctx, 'info', `${agent.naam} is klaar`, { samenvatting: samenvatting, stappen: stappen, kosten_usd: kosten });

  return { summary: samenvatting, steps: stappen, input_tokens: inTokens, output_tokens: outTokens, cost_usd: kosten };
}

/* ============================================================
 * 6. Planning en wachtrij
 * ============================================================ */

function vandaag() { return new Date().toISOString().slice(0, 10); }

function dagenGeleden(datum) {
  if (!datum) return 0;
  return Math.floor((Date.now() - new Date(datum + 'T00:00:00Z').getTime()) / 86400000);
}

/* Nederland loopt op UTC+1, of UTC+2 in de zomertijd (laatste zondag maart tot
   laatste zondag oktober). De schedules staan in UTC; deze functie zegt of we
   nu in de zomertijd zitten, zodat 07:00 NL het hele jaar 07:00 NL blijft. */
function isZomertijdNL(d) {
  const jaar = d.getUTCFullYear();
  /* Laatste zondag van de maand, om 01:00 UTC — het EU-omschakelmoment. */
  const laatsteZondag = (maand) => {
    const laatsteDag = new Date(Date.UTC(jaar, maand + 1, 0));
    const datum = laatsteDag.getUTCDate() - laatsteDag.getUTCDay();
    return new Date(Date.UTC(jaar, maand, datum, 1, 0, 0));
  };
  return d >= laatsteZondag(2) && d < laatsteZondag(9);   // maart t/m oktober
}

/* Minimale cron-match: minuut uur dag maand weekdag. Ondersteunt sterretje,
   lijstjes met komma's, reeksen met een streepje en stappen (sterretje-slash-n). */
function cronMatch(cron, d) {
  const delen = String(cron).trim().split(/\s+/);
  if (delen.length !== 5) return false;
  const waarden = [d.getUTCMinutes(), d.getUTCHours(), d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCDay()];
  return delen.every((deel, i) => {
    if (deel === '*') return true;
    return deel.split(',').some(stuk => {
      const stap = stuk.match(/^\*\/(\d+)$/);
      if (stap) return waarden[i] % Number(stap[1]) === 0;
      const reeks = stuk.match(/^(\d+)-(\d+)$/);
      if (reeks) return waarden[i] >= Number(reeks[1]) && waarden[i] <= Number(reeks[2]);
      return Number(stuk) === waarden[i];
    });
  });
}

/* Zet wat nu aan de beurt is in de wachtrij. De cron draait elke 5 minuten,
   dus we kijken of het geplande moment in het afgelopen kwartier lag én er
   vandaag nog niet gevuurd is — zo mist een schedule niet als één tick faalt. */
async function planningNaarJobs(env) {
  const nu = new Date();
  const zomer = isZomertijdNL(nu);
  const schedules = await sbSelect(env, 'schedules', 'enabled=eq.true&select=*');
  let gezet = 0;

  for (const s of schedules) {
    const delen = String(s.cron).trim().split(/\s+/);
    if (delen.length === 5 && !zomer && /^\d+$/.test(delen[1])) {
      delen[1] = String((Number(delen[1]) + 1) % 24);   // wintertijd: een uur later in UTC
    }
    const cron = delen.join(' ');

    let raak = false;
    for (let m = 0; m < 15; m++) {
      if (cronMatch(cron, new Date(nu.getTime() - m * 60000))) { raak = true; break; }
    }
    if (!raak) continue;
    if (s.last_fired_at && (nu - new Date(s.last_fired_at)) < 6 * 3600 * 1000) continue;

    await sbInsert(env, 'agent_jobs', {
      agent_id: s.agent_id, kind: s.kind, payload: s.payload || {},
      source: 'cron', schedule_id: s.id, priority: 3
    });
    await sbUpdate(env, 'schedules', `id=eq.${s.id}`, { last_fired_at: nu.toISOString() });
    gezet++;
  }
  return gezet;
}

async function werkRijAf(env, workerId, maxJobs) {
  const gedaan = [];
  for (let i = 0; i < maxJobs; i++) {
    const job = await sbRpc(env, 'claim_job', { p_worker: workerId });
    if (!job || !job.id) break;
    try {
      const resultaat = await runAgent(env, job);
      await sbUpdate(env, 'agent_jobs', `id=eq.${job.id}`, {
        status: 'done', result: resultaat, finished_at: new Date().toISOString(), locked_by: null
      });
      gedaan.push({ id: job.id, agent: job.agent_id, kind: job.kind, status: 'done' });
    } catch (e) {
      const fout = String(e && e.message || e);
      const opnieuw = job.attempts < job.max_attempts;
      await sbUpdate(env, 'agent_jobs', `id=eq.${job.id}`, {
        status: opnieuw ? 'queued' : 'failed',
        error: fout,
        locked_at: null, locked_by: null,
        /* backoff: 5, 20, 45 minuten */
        scheduled_for: new Date(Date.now() + Math.pow(job.attempts, 2) * 5 * 60000).toISOString(),
        finished_at: opnieuw ? null : new Date().toISOString()
      });
      await sbUpdate(env, 'agents', `id=eq.${job.agent_id}`, { status: 'idle', current_task: null });
      await logEvent(env, { agentId: job.agent_id, jobId: job.id }, 'error',
        opnieuw ? 'Run mislukt, wordt opnieuw geprobeerd' : 'Run definitief mislukt', { fout: fout });
      gedaan.push({ id: job.id, agent: job.agent_id, kind: job.kind, status: opnieuw ? 'requeued' : 'failed', error: fout });
    }
  }
  return gedaan;
}

async function tick(env, workerId) {
  const vrijgegeven = await sbRpc(env, 'reap_stuck_jobs', { p_timeout: `${JOB_TIMEOUT_MIN} minutes` });
  const gepland = await planningNaarJobs(env);
  const gedaan = await werkRijAf(env, workerId, JOBS_PER_TICK);
  return { vrijgegeven: vrijgegeven, gepland: gepland, verwerkt: gedaan };
}

/* ============================================================
 * 7. Toegang
 * ============================================================ */

function corsHeaders(request) {
  const o = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, anthropic-version, anthropic-beta',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

const _cache = new Map(); // token -> { exp, ok, email, role }
async function lid(request) {
  const t = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!t) return null;
  const now = Date.now();
  const c = _cache.get(t);
  if (c && c.exp > now) return c.ok ? c : null;
  let uit = { exp: now + 60000, ok: false, email: null, role: null };
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { 'Authorization': 'Bearer ' + t, 'apikey': SB_ANON } });
    if (r.ok) {
      const u = await r.json();
      if (u && u.id) {
        const r2 = await fetch(SB_URL + '/rest/v1/team_members?id=eq.' + u.id + '&select=status,role', {
          headers: { 'Authorization': 'Bearer ' + t, 'apikey': SB_ANON }
        });
        if (r2.ok) {
          const rows = await r2.json();
          if (rows && rows[0] && rows[0].status === 'approved') {
            uit = { exp: now + 60000, ok: true, email: u.email || null, role: rows[0].role || 'member' };
          }
        }
      }
    }
  } catch (e) { }
  _cache.set(t, uit);
  return uit.ok ? uit : null;
}

/* ============================================================
 * 8. Worker
 * ============================================================ */

export default {
  async scheduled(event, env, ctx) {
    if (!env.SUPABASE_SERVICE_KEY) { console.error('SUPABASE_SERVICE_KEY ontbreekt — runtime staat stil'); return; }
    const workerId = 'cron-' + event.scheduledTime;
    ctx.waitUntil(tick(env, workerId).then(
      r => console.log('tick', JSON.stringify(r)),
      e => console.error('tick mislukt', e)
    ));
  },

  async fetch(request, env) {
    const cors = corsHeaders(request);
    const json = (obj, status) => new Response(JSON.stringify(obj), {
      status: status || 200, headers: { 'Content-Type': 'application/json', ...cors }
    });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    /* Open endpoint: geen login. Daarom staat hier alleen of iets aan of uit
       staat, en geen enkel gegeven over het bedrijf erachter — geen
       accountnummers, geen merknamen. En geen databasecall: een open endpoint
       dat bij elke aanroep de database aanraakt is een uitnodiging.
       Welke accounts meetellen staat in /agents/status, achter de login. */
    if (path === '' || path === '/health') {
      return json({
        ok: true,
        service: 'marketing-os',
        runtime: env.SUPABASE_SERVICE_KEY ? 'actief' : 'uit (SUPABASE_SERVICE_KEY ontbreekt)',
        koppelingen: {
          claude: !!env.ANTHROPIC_KEY,
          openai: !!env.OPENAI_KEY,
          meta: !!env.META_ACCESS_TOKEN,
          klaviyo: !!env.KLAVIYO_API_KEY
        },
      });
    }

    const gebruiker = await lid(request);
    if (!gebruiker) return json({ ok: false, error: 'unauthorized', hint: 'Log in in de Atelier Console met een goedgekeurd teamaccount.' }, 401);

    /* ---- Agent-API ---- */
    if (path.startsWith('/agents')) {
      if (!env.SUPABASE_SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_KEY ontbreekt op deze worker' }, 500);

      if (path === '/agents/status' && request.method === 'GET') {
        const [agents, jobs, events, accounts] = await Promise.all([
          sbSelect(env, 'agents', 'select=*&order=phase,name'),
          sbSelect(env, 'agent_jobs', 'status=in.(queued,running)&select=*&order=priority,scheduled_for&limit=50'),
          sbSelect(env, 'agent_events', 'select=*&order=created_at.desc&limit=40'),
          /* Welke accounts er meetellen. Zonder dit is een deploy die stil
             terugvalt op één account niet te onderscheiden van een die er vijf
             ziet — en dat verschil was precies het probleem. */
          actieveAccounts(env)
        ]);
        return json({ agents, jobs, events, accounts });
      }

      if (path === '/agents/jobs' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const q = ['select=*', 'order=created_at.desc', 'limit=' + Math.min(Number(url.searchParams.get('limit')) || 50, 200)];
        if (status) q.push('status=eq.' + status);
        return json({ jobs: await sbSelect(env, 'agent_jobs', q.join('&')) });
      }

      if (path === '/agents/run' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const agentId = String(body.agent_id || '').toLowerCase();
        if (!body.kind) return json({ error: 'kind is verplicht' }, 400);
        if (!AGENTS[agentId] && !SYSTEEMTAKEN[body.kind]) {
          return json({ error: `onbekende agent "${agentId}"`, beschikbaar: Object.keys(AGENTS) }, 400);
        }
        const rij = (await sbInsert(env, 'agent_jobs', {
          agent_id: agentId,
          kind: String(body.kind),
          payload: body.payload || {},
          source: 'console',
          requested_by: gebruiker.email,
          priority: 1                     // wat een mens vraagt gaat voor op cron
        }))[0];
        return json({ ok: true, job: rij });
      }

      /* ---- Publicaties ---- */
      if (path === '/agents/publications' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const q = ['select=*', 'order=created_at.desc',
                   'limit=' + Math.min(Number(url.searchParams.get('limit')) || 50, 200)];
        if (status) q.push('status=eq.' + status);
        return json({ publications: await sbSelect(env, 'meta_publications', q.join('&')) });
      }

      /* Beslissen over een goedkeuring. Dit is de menselijke stap; er is met
         opzet geen agent-tool die een approval op 'approved' kan zetten. */
      const beslis = path.match(/^\/agents\/approvals\/(\d+)\/decide$/);
      if (beslis && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const besluit = String(body.decision || '').toLowerCase();
        if (besluit !== 'approved' && besluit !== 'rejected') {
          return json({ error: 'decision moet "approved" of "rejected" zijn' }, 400);
        }
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin kan goedkeuren of afwijzen' }, 403);
        }
        const bijgewerkt = await sbUpdate(env, 'approvals', `id=eq.${beslis[1]}&status=eq.pending`, {
          status: besluit, decided_by: gebruiker.email, decided_at: new Date().toISOString()
        });
        if (!bijgewerkt.length) {
          return json({ error: 'goedkeuring bestaat niet of is al beslist' }, 409);
        }
        /* Een afgewezen publicatie moet dat ook zelf weten, anders blijft hij
           in de wachtrij staan alsof er nog over nagedacht wordt. */
        if (besluit === 'rejected') {
          await sbUpdate(env, 'meta_publications',
            `approval_id=eq.${beslis[1]}&status=eq.wacht_op_akkoord`, { status: 'afgewezen' });
        } else {
          await sbUpdate(env, 'meta_publications',
            `approval_id=eq.${beslis[1]}`, { approved_at: new Date().toISOString() });
        }
        return json({ ok: true, approval: bijgewerkt[0] });
      }

      /* Live zetten. Het enige punt in het systeem waar geld gaat lopen. */
      const publiceer = path.match(/^\/agents\/publications\/(\d+)\/publish$/);
      if (publiceer && request.method === 'POST') {
        if (gebruiker.role !== 'admin') {
          return json({ error: 'alleen een admin kan een advertentie live zetten' }, 403);
        }
        if (!env.META_ACCESS_TOKEN || !env.META_AD_ACCOUNT_ID) {
          return json({ error: 'Meta is niet gekoppeld op deze worker' }, 500);
        }
        const body = await request.json().catch(() => ({}));
        const uit = await metaPublish(env, Number(publiceer[1]), gebruiker.email, body.activate !== false);
        return json(uit, uit.error ? (uit.status || 400) : 200);
      }

      const cancel = path.match(/^\/agents\/jobs\/(\d+)\/cancel$/);
      if (cancel && request.method === 'POST') {
        const uit = await sbUpdate(env, 'agent_jobs', `id=eq.${cancel[1]}&status=in.(queued,running)`, {
          status: 'cancelled', finished_at: new Date().toISOString(), error: 'geannuleerd door ' + gebruiker.email
        });
        return json({ ok: uit.length > 0, job: uit[0] || null });
      }

      if (path === '/agents/tick' && request.method === 'POST') {
        if (gebruiker.role !== 'admin') return json({ error: 'alleen een admin kan handmatig een cyclus draaien' }, 403);
        return json(await tick(env, 'handmatig-' + gebruiker.email));
      }

      return json({ error: 'onbekend agent-endpoint' }, 404);
    }

    /* ---- Anthropic (ongewijzigd) ---- */
    if (path === '/anthropic' && request.method === 'POST') {
      if (!env.ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_KEY secret ontbreekt op deze worker' }, 500);
      const body = await request.text();
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_KEY,
          'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
          ...(request.headers.get('anthropic-beta') ? { 'anthropic-beta': request.headers.get('anthropic-beta') } : {})
        },
        body
      });
      return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...cors } });
    }

    /* ---- OpenAI (ongewijzigd) ---- */
    let oaPath = null;
    if (path.startsWith('/v1/')) oaPath = path.slice(1);
    else if (path.startsWith('/openai/')) oaPath = path.slice('/openai/'.length);
    if (oaPath !== null) {
      if (!env.OPENAI_KEY) return json({ error: 'OPENAI_KEY secret ontbreekt op deze worker' }, 500);
      const target = oaPath.startsWith('v1/') ? ('https://api.openai.com/' + oaPath) : ('https://api.openai.com/v1/' + oaPath);
      const headers = { 'Authorization': 'Bearer ' + env.OPENAI_KEY };
      const ct = request.headers.get('content-type');
      if (ct) headers['Content-Type'] = ct;
      let body;
      if (request.method !== 'GET' && request.method !== 'HEAD') body = await request.arrayBuffer();
      const r = await fetch(target, { method: request.method, headers, body });
      const out = await r.arrayBuffer();
      return new Response(out, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', ...cors } });
    }

    return json({ error: { message: 'Gebruik /agents/*, POST /anthropic of /openai/… (of GET /health).' } }, 404);
  }
};
