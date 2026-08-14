/* ═══════════════════════════════════════════════════════════════════════════
   Het logboek — wat het systeem deed, per dag

   Beslisvraag (opgeschreven vóór deze regel code):

       "Wat heeft het systeem gisteren gedaan, en waar ging het mis?"

   Dit scherm heette het brein en voegde vijf bronnen samen: wat een agent
   deed, wat hij aan een ander doorgaf, wat hij schreef, wat een run kostte en
   wat er op goedkeuring wachtte. Vier van die vijf zijn verdwenen met de
   agents. Wat overblijft is één bron — `systeem_events`, waar de taken hun
   werk in schrijven — en dat is meteen eerlijker: dit is een logboek van
   handelingen, geen weerslag van een gesprek dat niet meer plaatsvindt.

   Wat gebleven is, is de reden dat het scherm bestond:

     De verste regel staat bovenaan, niet als tijdstempel maar als oordeel.
     Een logboek dat niet zegt hoe oud hij is, laat je naar acht dagen oude
     data kijken alsof het van vanmorgen is. Dat is precies wat hier gebeurde:
     de cyclus draait elke vijf minuten, maar sinds 27 juli schreef hij niets
     meer in de database. Zonder die regel bovenaan zie je dat niet — je ziet
     alleen een lijst die er gevuld uitziet.

   Dit bestand rekent zo min mogelijk uit. `toon` en de dagtelling komen uit
   `public.hq_logboek` en `public.hq_logboek_dag` (0051).
   ═══════════════════════════════════════════════════════════════════════════ */

var _log = { stroom: null, dagen: null, fout: null, laden: false, geladen: false,
             open: {}, filter: null };

function lgbEsc(t) { return escapeHtml(t == null ? '' : String(t)); }
function lgbSb() { return (window._sb && window._authProfile && window._authProfile.id) ? window._sb : null; }

/* ── ophalen ────────────────────────────────────────────────────────────── */

function renderLogboek() {
  var sb = lgbSb();
  var mount = document.getElementById('lgb-mount');
  if (!mount) return;
  if (!sb) {
    mount.innerHTML = lgbKop() + lgbLeeg('Log in om het logboek te zien.',
      ['Het logboek leest mee met wie er kijkt. Zonder inloggen is er niets te tonen — '
       + 'niet omdat het verborgen is, maar omdat de database niet weet wie je bent.']) + '</div>';
    return;
  }
  if (_log.geladen) { lgbRender(); return; }
  _log.laden = true;
  lgbRender();

  Promise.all([
    sb.from('hq_logboek').select('wanneer,soort,toon,wat,werkstuk_id,details,bron,bron_id')
      .order('wanneer', { ascending: false }).limit(400),
    sb.from('hq_logboek_dag').select('dag,gebeurtenissen,fouten,waarschuwingen,eerste,laatste')
      .order('dag', { ascending: false }).limit(30)
  ]).then(function (r) {
    _log.laden = false; _log.geladen = true;
    var f = (r[0] && r[0].error) || (r[1] && r[1].error);
    if (f) { _log.fout = f.message; _log.stroom = null; _log.dagen = null; }
    else { _log.stroom = (r[0] && r[0].data) || []; _log.dagen = (r[1] && r[1].data) || []; }
    lgbRender();
  }).catch(function (e) {
    _log.laden = false; _log.geladen = true;
    _log.fout = (e && e.message) || String(e);
    lgbRender();
  });
}

function lgbVernieuw() { _log.geladen = false; _log.fout = null; _log.stroom = null; renderLogboek(); }
function lgbVouw(dag) { _log.open[dag] = !_log.open[dag]; lgbRender(); }
function lgbFilter(soort) { _log.filter = (_log.filter === soort) ? null : soort; lgbRender(); }

/* ── de verstheid ───────────────────────────────────────────────────────── */

/* Het eerste wat je moet weten van een logboek is niet wat erin staat maar
   hoe oud het is. Een lijst die er gevuld uitziet, leest als actueel — ook als
   de laatste regel van vorige week is. */
function lgbDagenGeleden(datumTekst) {
  if (!datumTekst) return null;
  var d = new Date(datumTekst);
  if (isNaN(d)) return null;
  var nu = new Date();
  return Math.floor((nu - d) / 86400000);
}

function lgbVersheid(stroom) {
  if (!stroom || !stroom.length) {
    return { toon: 'stil', kop: 'Het logboek is leeg',
             tekst: 'Er is nog nooit iets vastgelegd. Zodra een taak draait, staat het hier.' };
  }
  var laatste = stroom[0].wanneer;
  var d = lgbDagenGeleden(laatste);

  if (d === null) return { toon: 'stil', kop: 'Onbekend hoe oud dit is', tekst: '' };
  if (d <= 1) {
    return { toon: 'vers', kop: d === 0 ? 'Bijgewerkt vandaag' : 'Bijgewerkt gisteren',
             tekst: 'De laatste regel is van ' + lgbDatum(laatste) + '.' };
  }
  return {
    toon: 'stil',
    kop: 'Al ' + d + ' dagen niets vastgelegd',
    tekst: 'De laatste regel is van ' + lgbDatum(laatste) + '. Draaide de cyclus sindsdien '
         + 'wél, dan schreef hij zijn werk niet naar de database — en dan mist dit logboek '
         + 'precies wat je zoekt. Dat is een storing en geen rustige week.'
  };
}

function lgbDatum(t) {
  var d = new Date(t);
  if (isNaN(d)) return String(t);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
       + ' om ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}
function lgbTijd(t) {
  var d = new Date(t);
  return isNaN(d) ? '' : d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

/* ── één regel ──────────────────────────────────────────────────────────── */

/* Er is nog één soort. De filterrij hieronder blijft staan omdat `soort` in de
   view blijft bestaan: komt er ooit een tweede bron bij, dan verschijnt de knop
   vanzelf in plaats van dat iemand hem moet toevoegen. */
var LGB_SOORT = {
  handeling: { woord: 'deed', uitleg: 'iets wat een taak heeft uitgevoerd' }
};

function lgbRegel(r) {
  var s = LGB_SOORT[r.soort] || { woord: r.soort };
  var d = r.details || {};
  var extra = '';

  // Bij een bericht is de inhoud het punt. Die staat in de details en hoort
  // uitgeklapt te kunnen worden -- een onderwerp alleen zegt te weinig om er
  // een fout in te zien.
  if (r.soort === 'bericht' && d.body) {
    extra = '<div class="lgb-body">' + lgbEsc(d.body) + '</div>';
  }
  if (r.soort === 'run' && (d.kosten_usd || d.model)) {
    extra = '<div class="lgb-meta">'
      + (d.model ? '<span>' + lgbEsc(d.model) + '</span>' : '')
      + (d.kosten_usd ? '<span>$ ' + lgbEsc(d.kosten_usd) + '</span>' : '')
      + '</div>';
  }
  if (r.soort === 'overdracht' && d.controleren) {
    extra = '<div class="lgb-body"><b>Te controleren:</b> ' + lgbEsc(d.controleren) + '</div>';
  }

  return '<div class="lgb-regel lgb-regel--' + lgbEsc(r.toon || 'info') + '">'
    + '<div class="lgb-tijd">' + lgbEsc(lgbTijd(r.wanneer)) + '</div>'
    + '<div class="lgb-wie">' + lgbEsc(r.wie || 'systeem') + '</div>'
    + '<div class="lgb-wat">'
    +   '<span class="lgb-soort">' + lgbEsc(s.woord) + '</span> '
    +   lgbEsc(r.wat)
    +   (r.werkstuk_id ? '<span class="lgb-werkstuk">werkstuk ' + lgbEsc(r.werkstuk_id) + '</span>' : '')
    +   extra
    + '</div>'
    + '</div>';
}

/* ── één dag ────────────────────────────────────────────────────────────── */

function lgbDag(d, regels) {
  var open = !!_log.open[d.dag];
  var datum = new Date(d.dag + 'T12:00:00');
  var kop = isNaN(datum) ? d.dag
    : datum.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });

  // Wat er die dag uitkwam, in woorden en niet als rij statuslampjes. Een dag
  // met twee fouten is een ander bericht dan een dag zonder handelingen.
  var telling = [];
  if (d.gebeurtenissen)  telling.push(d.gebeurtenissen + ' handeling' + (d.gebeurtenissen === 1 ? '' : 'en'));
  if (d.waarschuwingen)  telling.push(d.waarschuwingen + ' waarschuwing' + (d.waarschuwingen === 1 ? '' : 'en'));
  if (d.fouten)          telling.push(d.fouten + ' fout' + (d.fouten === 1 ? '' : 'en'));

  return '<div class="lgb-dag' + (open ? ' lgb-dag--open' : '') + '">'
    + '<button class="lgb-dag-kop" onclick="lgbVouw(\'' + lgbEsc(d.dag) + '\')" '
    +   'aria-expanded="' + (open ? 'true' : 'false') + '">'
    +   '<span class="lgb-dag-datum">' + lgbEsc(kop) + '</span>'
    +   '<span class="lgb-dag-telling">' + lgbEsc(telling.join(' · ') || 'niets vastgelegd') + '</span>'
    +   (d.fouten ? '<span class="lgb-chip lgb-chip--fout">' + d.fouten + ' fout</span>' : '')
    +   '<span class="lgb-chev">' + (open ? '▴' : '▾') + '</span>'
    + '</button>'
    + (open ? '<div class="lgb-dag-body">'
        + (regels.length ? regels.map(lgbRegel).join('')
           : '<div class="lgb-leeg-regel">Geen regels binnen dit filter.</div>')
        + '</div>' : '')
    + '</div>';
}

/* ── tekenen ────────────────────────────────────────────────────────────── */

function lgbKop() {
  return '<div class="lgb">'
    + '<h2 class="lgb-vraag">Wat deed het systeem, en waar ging het mis?</h2>';
}

function lgbLeeg(kop, alineas) {
  var h = '<div class="lgb-leeg"><div class="lgb-leeg-kop">' + lgbEsc(kop) + '</div>';
  (alineas || []).forEach(function (p) { h += '<p>' + p + '</p>'; });
  return h + '</div>';
}

function lgbRender() {
  var mount = document.getElementById('lgb-mount');
  if (!mount) return;

  if (_log.laden) {
    mount.innerHTML = lgbKop() + '<div class="loading-card">Het logboek laden...</div></div>';
    return;
  }
  if (_log.fout) {
    mount.innerHTML = lgbKop() + lgbLeeg('Het logboek kon niet worden geladen.', [
      lgbEsc(_log.fout),
      'Staat migratie <code>0051_zonder_agents.sql</code> al in Supabase? Zonder die views '
      + 'bestaan <code>hq_logboek</code> en <code>hq_logboek_dag</code> niet.'
    ]) + '</div>';
    return;
  }

  var stroom = _log.stroom || [];
  var dagen  = _log.dagen  || [];

  if (!stroom.length) {
    mount.innerHTML = lgbKop() + lgbLeeg('Er is nog niets vastgelegd.', [
      'Het logboek toont wat de taken in de wachtrij hebben gedaan. Zodra er één '
      + 'draait — vanzelf via het rooster of omdat jij hem klaarzet — staat het hier.'
    ]) + '</div>';
    return;
  }

  var vers = lgbVersheid(stroom);
  var h = lgbKop();

  // De verstheid staat bovenaan en niet onderaan. Wie eerst de lijst leest en
  // daarna pas ziet dat hij acht dagen oud is, heeft dan al conclusies
  // getrokken.
  h += '<div class="lgb-vers lgb-vers--' + vers.toon + '">'
    +  '<div class="lgb-vers-kop">' + lgbEsc(vers.kop) + '</div>'
    +  '<div class="lgb-vers-tekst">' + lgbEsc(vers.tekst) + '</div>'
    +  '</div>';

  var soorten = {};
  stroom.forEach(function (r) { soorten[r.soort] = (soorten[r.soort] || 0) + 1; });

  h += '<div class="lgb-filters">';
  h += '<button class="lgb-filter' + (_log.filter === null ? ' lgb-filter--aan' : '') + '" '
    +  'onclick="lgbFilter(null)">alles (' + stroom.length + ')</button>';
  Object.keys(LGB_SOORT).forEach(function (s) {
    if (!soorten[s]) return;
    h += '<button class="lgb-filter' + (_log.filter === s ? ' lgb-filter--aan' : '') + '" '
      +  'onclick="lgbFilter(\'' + s + '\')" title="' + lgbEsc(LGB_SOORT[s].uitleg) + '">'
      +  s + ' (' + soorten[s] + ')</button>';
  });
  h += '</div>';

  var zichtbaar = _log.filter ? stroom.filter(function (r) { return r.soort === _log.filter; }) : stroom;

  h += '<div class="lgb-dagen">';
  dagen.forEach(function (d) {
    var regels = zichtbaar.filter(function (r) {
      return String(r.wanneer).slice(0, 10) === String(d.dag).slice(0, 10);
    });
    if (_log.filter && !regels.length) return;
    h += lgbDag(d, regels);
  });
  h += '</div>';

  h += '<p class="lgb-bron">' + stroom.length + ' regels uit systeem_events · '
    +  '<a href="javascript:void(0)" onclick="lgbVernieuw()">vernieuwen</a></p>';

  mount.innerHTML = h + '</div>';
}
