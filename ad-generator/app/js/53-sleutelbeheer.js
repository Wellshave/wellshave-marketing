/* Sleutelbeheer — het adminmenu waarin de API-sleutels gezet worden.
 *
 * Waarom dit er is: de sleutels stonden letterlijk in de broncode, achter een
 * wachtwoord dat er drie regels boven ook in stond. Toen de repo gedeeld werd
 * vonden de scanners van Anthropic en OpenAI ze en trokken ze allebei in. De
 * code is opgeruimd en de sleutels staan sindsdien op de proxy -- veilig, maar
 * elke wissel vroeg een terminal met wrangler erin, en dat heeft niet iedereen
 * die het wél mag beslissen.
 *
 * Dit scherm lost dat op ZONDER terug te vallen in de oude fout. Drie regels
 * die het verschil maken met de kluis:
 *
 *   1. De sleutel gaat één kant op. Je kunt hem zetten en vervangen, en je
 *      kunt hem nooit terugzien -- ook niet als admin. Er is geen reden om een
 *      sleutel op een scherm te tonen: kunnen lezen levert alleen maar plekken
 *      op waar hij terechtkomt (een screenshot, een logboek, een gesprek).
 *      Wat je wél ziet is de staart: de laatste vier tekens, genoeg om te
 *      herkennen welke er staat, te weinig om er iets mee te doen.
 *
 *   2. Hij komt hier nooit in de browser terecht. Het veld stuurt de waarde
 *      rechtstreeks naar de worker, die hem versleutelt en wegschrijft. Niets
 *      gaat naar localStorage, niets blijft in de pagina staan; het invoerveld
 *      wordt na verzending leeggemaakt.
 *
 *   3. Na het zetten wordt hij meteen uitgeprobeerd. Dat is de les van de
 *      vorige ronde: de statusbalk stond groen omdat het VELD gevuld was,
 *      terwijl de sleutel al ingetrokken was, en dat heeft een halve dag
 *      zoeken in de verkeerde hoek gekost. Gevuld en geldig zijn twee dingen.
 *
 * Alles hier draait op de admin-endpoints van de worker; die weigeren een
 * niet-admin op hun beurt ook zelf. Dit scherm verbergen is netjes, maar het
 * is niet wat de beveiliging doet -- de worker is dat.
 *
 * TAAL: dit paneel is Nederlands, net als de rest van het adminpaneel waarin
 * het hangt.
 */

var SLEUTEL_VELDEN = [
  { naam: 'ANTHROPIC_KEY', label: 'Claude (Anthropic)',
    waar: 'Concepten, copy en Rory.',
    vandaan: 'console.anthropic.com , Settings , API keys' },
  { naam: 'OPENAI_KEY', label: 'ChatGPT (OpenAI)',
    waar: 'De beelden.',
    vandaan: 'platform.openai.com , API keys' },
  { naam: 'ATRIA_API_KEY', label: 'Atria',
    waar: 'De cijfers van een draaiende advertentie bij het itereren.',
    vandaan: 'Atria , avatar linksboven , Settings & members , API Keys' }
];

function sleutelEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* Een aanroep naar de worker, met het teamtoken erbij. Zonder dat token
   antwoordt de worker met 'unauthorized' en dat is geen fout van het scherm
   maar precies de bedoeling. */
async function sleutelVraag(pad, opties) {
  var basis = (typeof PROXY_BASE === 'string' ? PROXY_BASE : '').replace(/\/$/, '');
  var o = Object.assign({ headers: {} }, opties || {});
  o.headers['Content-Type'] = 'application/json';
  if (window.__WG_TOKEN) o.headers['Authorization'] = 'Bearer ' + window.__WG_TOKEN;
  var r = await fetch(basis + pad, o);
  var data = null;
  try { data = await r.json(); } catch (e) { data = {}; }
  if (!r.ok) throw new Error((data && data.error) || ('de worker antwoordde met ' + r.status));
  return data;
}

/* Wanneer een sleutel voor het laatst gezet is, in gewone taal. Een tijdstip
   op de seconde nauwkeurig zegt niets; "vandaag" en "3 maanden geleden" zijn
   wat je wilt weten als je je afvraagt of dit nog de goede is. */
function sleutelWanneer(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d)) return '';
  var dagen = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dagen <= 0) return 'vandaag';
  if (dagen === 1) return 'gisteren';
  if (dagen < 31) return dagen + ' dagen geleden';
  var maanden = Math.round(dagen / 30);
  return maanden === 1 ? 'een maand geleden' : (maanden + ' maanden geleden');
}

/* Een sleutel die uit het Worker secret komt is niet fout -- hij werkt -- maar
   je kunt hem hier niet wisselen. Dat hoort het scherm te zeggen in plaats van
   te doen alsof alles hetzelfde is. */
function sleutelBronTekst(bron) {
  if (bron === 'database') return 'beheerd op dit scherm';
  if (bron === 'worker secret') return 'staat als Worker secret , te wisselen met wrangler, of zet hier een nieuwe';
  return 'er staat geen sleutel';
}

function sleutelRegelHtml(veld, rij) {
  var bron = (rij && rij.bron) || 'ontbreekt';
  var staat = bron !== 'ontbreekt';
  var kleur = staat ? '#2E6B4F' : '#ac4620';
  return '<div class="sl-regel" data-naam="' + veld.naam + '" ' +
    'style="border:1px solid rgba(215,179,89,.2);border-radius:10px;padding:13px 14px;margin-bottom:11px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;">' +
      '<div style="font-weight:700;color:#3f3729;">' + sleutelEsc(veld.label) + '</div>' +
      '<div class="sl-status" style="font-size:11.5px;color:' + kleur + ';">' +
        (staat ? '&#9679; ' : '&#9675; ') + sleutelEsc(sleutelBronTekst(bron)) + '</div>' +
    '</div>' +
    '<div style="font-size:11.5px;color:#8a8069;margin-top:3px;">' + sleutelEsc(veld.waar) +
      ' Ophalen bij: ' + sleutelEsc(veld.vandaan) + '</div>' +
    (rij && rij.staart
      ? ('<div style="font-size:11.5px;color:#8a8069;margin-top:5px;">Eindigt op <code>&hellip;' +
         sleutelEsc(rij.staart) + '</code>' +
         (rij.gezet_door ? (' , gezet door ' + sleutelEsc(rij.gezet_door)) : '') +
         (rij.gezet_op ? (' , ' + sleutelEsc(sleutelWanneer(rij.gezet_op))) : '') + '</div>')
      : '') +
    '<div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap;">' +
      '<input type="password" class="sl-invoer" autocomplete="off" spellcheck="false" ' +
        'placeholder="Plak hier een nieuwe sleutel" ' +
        'style="flex:1;min-width:200px;background:#fbfaf6;border:1px solid rgba(215,179,89,.3);' +
        'border-radius:7px;padding:7px 9px;font-size:12px;font-family:ui-monospace,Menlo,monospace;color:#3f3729;">' +
      '<button type="button" class="sl-bewaar btn btn-small">Bewaren</button>' +
    '</div>' +
    '<div class="sl-melding" style="font-size:11.5px;margin-top:7px;min-height:1px;"></div>' +
    '</div>';
}

function sleutelMeld(regel, tekst, soort) {
  var el = regel.querySelector('.sl-melding');
  if (!el) return;
  el.style.color = soort === 'fout' ? '#ac4620' : (soort === 'goed' ? '#2E6B4F' : '#8a8069');
  el.textContent = tekst || '';
}

async function sleutelBewaar(regel) {
  var naam = regel.getAttribute('data-naam');
  var invoer = regel.querySelector('.sl-invoer');
  var knop = regel.querySelector('.sl-bewaar');
  var waarde = (invoer.value || '').trim();
  if (!waarde) { sleutelMeld(regel, 'Er staat nog niets in het veld.', 'fout'); return; }

  knop.disabled = true;
  sleutelMeld(regel, 'Bewaren en uitproberen', '');
  try {
    var uit = await sleutelVraag('/systeem/sleutels', {
      method: 'POST', body: JSON.stringify({ naam: naam, waarde: waarde })
    });
    /* Het veld meteen leeg, ongeacht de uitkomst. Een sleutel die in een
       invoerveld blijft staan komt in de volgende screenshot terecht. */
    invoer.value = '';
    /* Eerst hertekenen, dan pas de melding. Andersom is de melding meteen
       weer weg: het hertekenen bouwt de regels opnieuw op, inclusief het
       meldingsvak dat er net was ingezet. Je zou dan een sleutel bewaren en
       niets terugkrijgen -- precies het soort stilte waarin je het nog een
       keer probeert. */
    var paneel = document.getElementById('ws-admin-body');
    await sleutelPaneel(paneel, true);
    var vers = paneel ? paneel.querySelector('.sl-regel[data-naam="' + naam + '"]') : null;
    if (!vers) vers = regel;
    if (uit.proef && uit.proef.geldig) {
      sleutelMeld(vers, 'Bewaard en werkt. Eindigt op ' + uit.staart + '.', 'goed');
    } else {
      /* Opgeslagen maar niet geldig is een echte uitkomst en geen half
         succes: hij staat er, en hij doet het niet. Dat moet er staan, want
         anders zoekt de volgende persoon het weer bij de worker. */
      sleutelMeld(vers, 'Bewaard, maar hij werkt niet: ' +
        ((uit.proef && uit.proef.reden) || 'onbekende reden') +
        '. Controleer of je de juiste sleutel geplakt hebt.', 'fout');
    }
  } catch (e) {
    invoer.value = '';
    sleutelMeld(regel, String(e.message || e), 'fout');
  }
  knop.disabled = false;
}

async function sleutelProef(el) {
  var knop = el.querySelector('.sl-proef');
  if (knop) { knop.disabled = true; knop.textContent = 'Bezig'; }
  try {
    var uit = await sleutelVraag('/systeem/sleutels/proef', { method: 'POST' });
    SLEUTEL_VELDEN.forEach(function (v) {
      var regel = el.querySelector('.sl-regel[data-naam="' + v.naam + '"]');
      if (!regel) return;
      var r = uit[v.naam] || {};
      sleutelMeld(regel, r.geldig ? 'Werkt.' : ('Werkt niet: ' + (r.reden || 'onbekende reden')),
        r.geldig ? 'goed' : 'fout');
    });
  } catch (e) {
    var kop = el.querySelector('.sl-kopmelding');
    if (kop) { kop.style.color = '#ac4620'; kop.textContent = String(e.message || e); }
  }
  if (knop) { knop.disabled = false; knop.textContent = 'Alles uitproberen'; }
}

/* Het paneel tekenen. `stil` is voor het hertekenen na een wissel: dan hoeft
   er geen "Laden..." overheen, want je zat net te kijken. */
async function sleutelPaneel(el, stil) {
  if (!el) return;
  if (!stil) el.innerHTML = 'Laden...';
  var data;
  try {
    data = await sleutelVraag('/systeem/sleutels', { method: 'GET' });
  } catch (e) {
    el.innerHTML = '<div style="color:#ac4620;">Kon de sleutels niet ophalen. ' +
      sleutelEsc(e.message || e) + '</div>';
    return;
  }
  var perNaam = {};
  (data.sleutels || []).forEach(function (r) { perNaam[r.naam] = r; });

  var h = '';
  /* Zonder hoofdsleutel kan er niets versleuteld worden, en dan is het veld
     eronder een knop die niet werkt. Dat hoort bovenaan te staan, met het
     commando erbij -- eenmalig, en daarna nooit meer. */
  if (!data.master) {
    h += '<div style="background:#fbf6e7;border:1px solid rgba(138,106,10,.28);border-left:3px solid #8A6A0A;' +
      'border-radius:0 9px 9px 0;padding:11px 13px;margin-bottom:13px;font-size:12px;line-height:1.55;color:#6b5514;">' +
      '<strong>Er is nog geen hoofdsleutel.</strong> Zonder die sleutel kan een API-sleutel niet ' +
      'versleuteld opgeslagen worden, en weigert dit scherm hem te bewaren. Zet hem eenmalig:' +
      '<div style="font-family:ui-monospace,Menlo,monospace;background:#fff;border-radius:6px;' +
      'padding:6px 8px;margin-top:6px;">npx wrangler secret put SLEUTEL_MASTER</div>' +
      'De waarde is een lange willekeurige tekst die je zelf verzint. Bewaar hem in je wachtwoordkluis: ' +
      'raakt hij kwijt, dan zijn de opgeslagen sleutels onleesbaar en zet je ze hier gewoon opnieuw.</div>';
  }

  h += '<div style="font-size:12px;color:#8a8069;line-height:1.55;margin-bottom:12px;">' +
    'Een sleutel gaat hier één kant op: je kunt hem zetten en vervangen, en nooit terugzien. ' +
    'Wat je ziet is de staart, genoeg om te herkennen welke er staat. Na het bewaren wordt hij ' +
    'meteen uitgeprobeerd, want gevuld en geldig zijn twee verschillende dingen.</div>';

  h += SLEUTEL_VELDEN.map(function (v) { return sleutelRegelHtml(v, perNaam[v.naam]); }).join('');
  h += '<div class="sl-kopmelding" style="font-size:11.5px;color:#8a8069;margin-top:4px;"></div>' +
    '<button type="button" class="sl-proef btn btn-small btn-ghost" style="margin-top:8px;">Alles uitproberen</button>';

  el.innerHTML = h;
  [].slice.call(el.querySelectorAll('.sl-bewaar')).forEach(function (b) {
    b.onclick = function () { sleutelBewaar(b.closest('.sl-regel')); };
  });
  [].slice.call(el.querySelectorAll('.sl-invoer')).forEach(function (i) {
    i.onkeydown = function (e) { if (e.key === 'Enter') sleutelBewaar(i.closest('.sl-regel')); };
  });
  var pb = el.querySelector('.sl-proef');
  if (pb) pb.onclick = function () { sleutelProef(el); };
}

window.SLEUTEL_VELDEN = SLEUTEL_VELDEN;
window.sleutelPaneel = sleutelPaneel;
window.sleutelBewaar = sleutelBewaar;
window.sleutelProef = sleutelProef;
window.sleutelWanneer = sleutelWanneer;
window.sleutelBronTekst = sleutelBronTekst;
window.sleutelRegelHtml = sleutelRegelHtml;
