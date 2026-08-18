/* Static Ad Wizard — Rory.
 *
 * Rory is in deze wizard geen chatbot naast het formulier maar de partij die
 * de voorzet geeft. Per stap doet hij drie dingen:
 *
 *   1. hij leest wat het systeem al weet (product, USP's, persona, eerdere
 *      creatives, funnel) en beslist zelf,
 *   2. hij legt in één alinea uit waarom, met de bronnen erbij,
 *   3. hij stelt een vraag, maar alleen als het antwoord de beslissing echt
 *      verandert.
 *
 * Het derde punt is de rem. Een wizard die bij elke stap iets vraagt is een
 * vragenlijst, en dat is precies wat dit moest vervangen. Vandaar dat de
 * systeemprompt hieronder expliciet zegt: geen vraag als de data volstaat.
 *
 * Alles wat Rory tegen de gebruiker zegt is Engels. Wat hij citeert uit
 * productdata, persona's of klantonderzoek blijft in de oorspronkelijke taal —
 * dat is bronmateriaal, geen interface.
 */

/* ── Model en kanaal ────────────────────────────────────────────────────── */

function wizModel() {
  var el = document.getElementById('anthropic-model');
  return (el && el.value) || 'claude-opus-5';
}

function wizTextOf(data) {
  var t = '';
  try { (data.content || []).forEach(function (b) { if (b && b.type === 'text') t += b.text; }); } catch (e) {}
  return t;
}

function wizParseJson(txt) {
  var schoon = String(txt || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  var a = schoon.indexOf('{'), b = schoon.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Rory did not return JSON');
  return JSON.parse(schoon.substring(a, b + 1));
}

function wizCall(system, messages, maxTokens) {
  return fetchJsonWithRetry((PROXY_BASE + '/anthropic'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: wizModel(),
      max_tokens: maxTokens || 2000,
      system: system + (typeof brandProfileBlock === 'function' ? brandProfileBlock() : ''),
      messages: messages
    })
  });
}

/* ── Wat weet het systeem al ────────────────────────────────────────────────
 *
 * Dit levert twee dingen tegelijk: de tekst die naar het model gaat, en een
 * leesbare lijst bronnen voor in het scherm. Die lijst is geen sier — de
 * gebruiker moet kunnen zien waar een advies op rust, anders is "Rory raadt
 * dit aan" niet te controleren. */

function wizProduct() {
  var id = wizState.data.product.productId;
  return (state.products || []).find(function (p) { return p.id === id; }) || null;
}
function wizPersona() {
  var id = wizState.data.audience.personaId;
  return (state.personas || []).find(function (p) { return p.id === id; }) || null;
}
function wizFormat() {
  var id = wizState.data.format.formatId;
  if (typeof AD_FORMATS === 'undefined') return null;
  return AD_FORMATS.find(function (f) { return f.id === id; }) || null;
}

function wizContext() {
  var bronnen = [], c = '';
  var merk = (typeof BRAND_NAME_UC !== 'undefined') ? BRAND_NAME_UC : 'Wellshave';
  c += '# BRAND\n' + merk + '\n';

  var p = wizProduct();
  if (p) {
    c += '\n# PRODUCT\n' + p.name + (p.category ? (' (' + p.category + ')') : '') + '\n';
    if (p.usps && p.usps.filter(Boolean).length) {
      c += "USPs: " + p.usps.filter(Boolean).join(' | ') + '\n';
      bronnen.push(p.usps.filter(Boolean).length + " USPs on " + p.name);
    }
    if (p.target) { c += 'Stated target: ' + p.target + '\n'; bronnen.push('Product target description'); }
    if (p.price) c += 'Price point: ' + p.price + '\n';
    if (p.forbidden) { c += 'Forbidden claims: ' + p.forbidden + '\n'; bronnen.push('Forbidden-claims list'); }
    var bd = (typeof refBreakdown === 'function') ? refBreakdown(p.references) : null;
    if (bd && bd.total > 0) {
      c += 'Reference images: ' + bd.product + ' product, ' + bd.lifestyle + ' lifestyle, ' +
           bd.usage + ' usage, ' + bd.packaging + ' packaging\n';
      bronnen.push(bd.total + ' reference images');
      if (bd.usage > 0) c += 'Usage photos exist: the product must be held and applied exactly as shown there.\n';
    }
    bronnen.unshift('Product data for ' + p.name);
  }

  var pers = wizPersona();
  if (pers) {
    c += '\n# PERSONA: ' + pers.name + '\n' + (pers.description || '') + '\n';
    if (pers.pains && pers.pains.length) c += 'Pains: ' + pers.pains.filter(Boolean).join(' | ') + '\n';
    if (pers.desires && pers.desires.length) c += 'Desires: ' + pers.desires.filter(Boolean).join(' | ') + '\n';
    if (pers.objections && pers.objections.length) c += 'Objections: ' + pers.objections.filter(Boolean).join(' | ') + '\n';
    bronnen.push('Customer research on ' + pers.name);
  } else if ((state.personas || []).length) {
    var kandidaten = (state.personas || []).filter(function (x) { return !p || !x.category || x.category === p.category; });
    if (kandidaten.length) {
      c += '\n# AVAILABLE PERSONAS (pick the strongest, use the id)\n';
      kandidaten.forEach(function (x) {
        c += '- id=' + x.id + ' | ' + x.name + ' | ' + (x.description || '') + '\n';
        if (x.pains && x.pains.length) c += '  pains: ' + x.pains.filter(Boolean).slice(0, 4).join(' | ') + '\n';
      });
      bronnen.push(kandidaten.length + ' researched personas');
    }
  }

  var d = wizState.data;
  if (d.product.funnel) c += '\n# CAMPAIGN GOAL\n' + d.product.funnel + '\n';
  if (d.product.placement) c += 'Placement: ' + d.product.placement + '\n';
  if (d.audience.awareness) c += 'Awareness level: ' + d.audience.awareness + '\n';
  /* De twee assen horen altijd samen in de context. Awareness zonder
     sophistication levert een boodschap die op het goede moment het verkeerde
     soort claim maakt. */
  if (d.audience.sophistication) {
    c += 'Market sophistication: ' + d.audience.sophistication +
      ' (' + (typeof wizSofistLabel === 'function' ? wizSofistLabel(d.audience.sophistication) : '') + ')\n';
  }
  if (d.audience.market) c += 'Market: ' + d.audience.market + '\n';

  if (d.strategy.marketingAngle) {
    c += '\n# APPROVED STRATEGY (do not drift from this)\n';
    c += 'Angle type: ' + d.strategy.angleType + '\n';
    c += 'Marketing angle: ' + d.strategy.marketingAngle + '\n';
    c += 'Core messaging: ' + d.strategy.messaging + '\n';
    if (d.strategy.differentiation) c += 'Differentiation lever: ' + d.strategy.differentiation + '\n';
    if (d.strategy.mechanism) c += 'Mechanism: ' + d.strategy.mechanism + '\n';
    if (d.strategy.desire) c += 'Primary desire: ' + d.strategy.desire + '\n';
    if (d.strategy.ultimateDesire) c += 'Ultimate desire: ' + d.strategy.ultimateDesire + '\n';
    if (d.strategy.timing) c += 'Why now: ' + d.strategy.timing + '\n';
    if (d.strategy.pain) c += 'Primary pain: ' + d.strategy.pain + '\n';
    if (d.strategy.proof) c += 'Proof mechanism: ' + d.strategy.proof + '\n';
    if (d.strategy.objection) c += 'Main objection: ' + d.strategy.objection + '\n';
  }
  var f = wizFormat();
  if (f) c += '\n# FORMAT\n' + f.id + ' — ' + f.name + ': ' + f.desc + '\n';
  if (d.visual.composition) {
    c += '\n# VISUAL DIRECTION\n';
    Object.keys(d.visual).forEach(function (k) { if (d.visual[k]) c += '- ' + k + ': ' + d.visual[k] + '\n'; });
  }
  if (d.copy.headline) {
    c += '\n# COPY\nHeadline: ' + d.copy.headline + '\n';
    if (d.copy.supporting) c += 'Supporting: ' + d.copy.supporting + '\n';
    if (d.copy.body) c += 'Body: ' + d.copy.body + '\n';
    if (d.copy.proof) c += 'Proof: ' + d.copy.proof + '\n';
    if (d.copy.cta) c += 'CTA: ' + d.copy.cta + '\n';
  }

  if (wizState.hist && Object.keys(wizState.hist).length) {
    c += '\n# WHAT WE ALREADY TESTED (angle: runs, best ROAS, winner?)\n';
    Object.keys(wizState.hist).forEach(function (k) {
      var x = wizState.hist[k];
      c += '- ' + k + ': ' + x.n + ' ads' + (x.best != null ? (', best ROAS ' + x.best) : '') + (x.winner ? ', HAS WINNER' : '') + '\n';
    });
    c += 'Prefer an unoccupied or proven angle where the argument allows it.\n';
    bronnen.push('Performance history across ' + Object.keys(wizState.hist).length + ' angle types');
  }

  /* Handmatig vastgezette keuzes zijn geen suggestie. Ze staan expliciet in de
     context zodat Rory ze niet stilletjes wegadviseert. */
  var vast = [];
  Object.keys(wizState.source).forEach(function (k) {
    if (wizState.source[k] !== 'user') return;
    var deel = k.split('.'), vak = wizState.data[deel[0]];
    if (vak && vak[deel[1]]) vast.push(k + ' = ' + vak[deel[1]]);
  });
  if (vast.length) {
    c += '\n# LOCKED BY THE USER (never silently override; challenge in words if you disagree)\n' + vast.join('\n') + '\n';
  }

  return { text: c, sources: bronnen };
}

/* Testhistorie ophalen. Faalt dit, dan gaat de wizard gewoon door zonder —
   een ontbrekende dashboardverbinding mag geen advertentie tegenhouden. */
function wizLoadHistory(cb) {
  var pers = wizPersona();
  var sb = window._sb;
  if (!sb || !window._authProfile || !pers) { wizState.hist = wizState.hist || {}; cb && cb(); return; }
  var merk = (typeof ACTIVE_BRAND !== 'undefined') ? ACTIVE_BRAND : 'wellshave';
  sb.from('creatives').select('angle_type,roas,status').eq('brand', merk)
    .ilike('persona', '%' + String(pers.name).replace(/[%,()]/g, '') + '%').limit(500)
    .then(function (r) {
      var h = {};
      ((r && r.data) || []).forEach(function (row) {
        if (!row.angle_type) return;
        if (!h[row.angle_type]) h[row.angle_type] = { n: 0, best: null, winner: false };
        h[row.angle_type].n++;
        if (row.roas != null && (h[row.angle_type].best == null || row.roas > h[row.angle_type].best)) h[row.angle_type].best = row.roas;
        if (row.status === 'Winner') h[row.angle_type].winner = true;
      });
      wizState.hist = h; cb && cb();
    }).catch(function () { wizState.hist = {}; cb && cb(); });
}

/* ── Wat Rory per stap moet opleveren ───────────────────────────────────── */

var WIZ_ADVICE_SPEC = {
  product: {
    velden: '"funnel":"tof|mof|bof|retargeting","placement":"feed11|feed45|stories|reels"',
    opdracht: 'Read the product and recommend the campaign goal and the placement that fit it best. Also summarise in one or two sentences what is most relevant about this product for an advertiser — the thing a strategist would notice first.'
  },
  audience: {
    velden: '"personaId":"exact id from the persona list","awareness":"unaware|problem|solution|product|most","sophistication":"s1|s2|s3|s4|s5","market":"short label or empty"',
    opdracht: 'Recommend the single strongest persona for this product and campaign goal, using the customer research. Then set the awareness level that persona actually enters at, and the sophistication stage of the niche: how many times has this market heard this claim already? Write the bare product claim in your head, ask how many competitors are making it, and stay exactly one stage ahead of them. Never behind (you sound like everyone) and never needlessly complex (if a direct claim still works, use it). Also sanity-check the audience size: a call-out aimed at a few hundred people cannot spend, whatever else it does. Never invent a persona that is not in the list.'
  },
  strategy: {
    velden: '"angleType":"short angle-type label","differentiation":"mechanism|exaggeration|avatar|desire|style","mechanism":"the how, one line, empty if there is genuinely none","marketingAngle":"the argument in one sentence","messaging":"the core message in one sentence","desire":"the functional outcome","ultimateDesire":"what that outcome really buys them","timing":"why this desire is intense right now, or empty","pain":"","proof":"","objection":""',
    opdracht: 'Build the strategic foundation. The angle must be specific to this persona and product, grounded in a real pain or desire from the research — not a generic category claim. Name which of the five ways of being different this angle uses: a new mechanism, exaggerated execution, a different avatar, a different desire, or a different creative style. From sophistication stage 3 the mechanism is not optional: a market that stopped believing bare claims needs a how. The proof mechanism must be something this product can actually show. Desire has two levels: the functional outcome and what that outcome really buys them. And say why this desire is intense right now if it is — season, weather, occasion — because a desire at its trough makes an identical ad underperform and get blamed for it.'
  },
  format: {
    velden: '"formatId":"exact id from the format list","runnersUp":["id","id"]',
    opdracht: 'Recommend the format that executes this angle and awareness level most directly, plus two runners-up. Explain the fit in terms of the angle, not the format description.'
  },
  visual: {
    velden: '"composition":"","humanPresence":"","scene":"","framing":"","mood":"","productVisibility":"","background":"","productUsage":"","textPlacement":"","referenceUsage":""',
    opdracht: 'Recommend the visual direction. Use only values from the option lists given below. If usage photos exist, the product usage must match them.'
  },
  copy: {
    velden: '"headline":"","supporting":"","body":"","proof":"","cta":"","removed":"what you deliberately left off the image, and why, one line"',
    opdracht: 'Write the copy in the language of the brand and its customer research (Dutch for Wellshave), carrying the approved angle. The headline picks up a real pain or desire from the persona. Keep the main headline short — nobody reads a long one on an image — and split a longer message into the supporting line. Specific beats superlative: a precise number is the cheapest proof available. Leave "body" empty if the format does not carry body copy. Always fill "removed": naming what you left off makes addition a decision rather than a reflex.'
  }
};

var WIZ_RORY_SYSTEM =
  'You are Rory Sutherland, creative strategist, working inside a static ad wizard. ' +
  'You lead: you look at the data the system already has and you decide, rather than asking the user to configure things. ' +
  'You are concrete and you never pad. ' +
  '\n\nRules that matter:\n' +
  '- Recommend one clear direction. Explain it in at most 45 words, in terms of the customer, not the mechanics.\n' +
  '- Only ask a question when the answer would genuinely change your recommendation. If the existing data is sufficient, ask nothing and set "question" to null. A wizard that asks something at every step is a questionnaire, and that is exactly what this replaced.\n' +
  '- Challenge a weak or conflicting choice in words. Never silently override something the user locked.\n' +
  '- Ground the recommendation in the supplied research. If you have no evidence for something, say so instead of inventing it. An empty field is better than a made-up one.\n' +
  '- Awareness decides how directly you may speak; sophistication decides what kind of claim is still believed. Name both before you recommend anything, and keep copy and image on the same two stages.\n' +
  '- One idea per static. The failure mode is addition, never subtraction: if an element does not serve the one idea, it is not neutral.\n' +
  '- Proof has to be visible, not claimed. A static cannot argue, so it demonstrates.\n' +
  '- Say what makes this different from the ads this person is already scrolling past. If you cannot answer that, the direction is not ready.\n' +
  '- Generate from the mechanism and check against what currently works, never the reverse: working from what already works produces the category average.\n' +
  '- Write every word you address to the user in English. Do NOT translate advertisement copy, customer research, product content or anything the user typed — quote those in their original language.\n' +
  '\nAlways answer with strict JSON, no markdown fences:\n' +
  '{"recommendation":{...},"why":"why this direction, max 45 words","evidence":["what you leaned on","..."],' +
  '"alternatives":[{"label":"short name","summary":"one line","values":{...}}],"question":null or "one question that would change the recommendation"}';

/* ── Advies ophalen ─────────────────────────────────────────────────────── */

function wizAdvise(stepKey, extra) {
  var spec = WIZ_ADVICE_SPEC[stepKey];
  if (!spec) return Promise.resolve(null);
  if (wizState.busy) return Promise.resolve(null);
  wizState.busy = true;
  wizRenderRory();

  var ctx = wizContext();
  var vraag = 'STEP: ' + stepKey + '\n\n' + spec.opdracht +
    '\n\nReturn "recommendation" with exactly these keys: {' + spec.velden + '}\n' +
    (extra ? ('\nExtra instruction from the user: ' + extra + '\n') : '') +
    (stepKey === 'format' && typeof AD_FORMATS !== 'undefined'
      ? ('\n\n# FORMATS (use an exact id)\n' + AD_FORMATS.map(function (f) { return f.id + ' — ' + f.name + ': ' + f.desc; }).join('\n'))
      : '') +
    (stepKey === 'visual' ? ('\n\n# VISUAL OPTIONS (use exact values)\n' + wizVisualOptionsText()) : '') +
    '\n\n' + ctx.text;

  return wizCall(WIZ_RORY_SYSTEM, [{ role: 'user', content: vraag }], 2500)
    .then(function (data) {
      var obj = wizParseJson(wizTextOf(data));
      wizState.advice[stepKey] = {
        recommendation: obj.recommendation || {},
        why: obj.why || '',
        evidence: (obj.evidence && obj.evidence.length ? obj.evidence : ctx.sources).slice(0, 6),
        alternatives: obj.alternatives || [],
        question: obj.question || null,
        at: Date.now()
      };
      delete wizState.stale[stepKey];
      wizSave();
      return wizState.advice[stepKey];
    })
    .catch(function (err) {
      wizState.advice[stepKey] = {
        recommendation: {}, why: '', evidence: [], alternatives: [], question: null,
        error: 'Rory could not be reached (' + err.message + '). You can still decide this step yourself.'
      };
      return wizState.advice[stepKey];
    })
    .finally(function () {
      wizState.busy = false;
      wizRender();
    });
}

/* Advies overnemen in de wizard-toestand. Alles wat de gebruiker zelf heeft
   vastgezet blijft staan — daar gaat een verversing niet overheen. */
function wizApplyAdvice(stepKey, waarden, forceer) {
  var rec = waarden || (wizState.advice[stepKey] || {}).recommendation || {};
  var vak = wizState.data[stepKey];
  if (!vak) return;
  Object.keys(rec).forEach(function (f) {
    if (!(f in vak)) return;
    if (!forceer && wizSourceOf(stepKey, f) === 'user' && vak[f]) return;
    var v = rec[f];
    if (v == null) return;
    vak[f] = Array.isArray(v) ? v.join(', ') : String(v);
    wizState.source[stepKey + '.' + f] = 'rory';
  });
  wizInvalidate(stepKey);
  wizSave();
}

/* Knop "Ask Rory to reconsider" op een verlopen stap. */
function wizRefreshStep() {
  var k = wizState.current;
  wizAdvise(k).then(function () { wizApplyAdvice(k); wizRender(); });
}

/* ── Het Rory-paneel ────────────────────────────────────────────────────── */

function wizRenderRory() {
  var el = document.getElementById('wiz-rory');
  if (!el) return;
  var stap = wizState.current;
  var adv = wizState.advice[stap] || null;
  var h = '';

  h += '<div class="wiz-rory-head"><span class="wiz-rory-avatar">R</span>' +
       '<div><div class="wiz-rory-name">Rory</div><div class="wiz-rory-role">Creative strategist</div></div></div>';

  if (wizState.busy) {
    h += '<div class="wiz-rory-thinking">Rory is thinking…</div>';
  } else if (adv && adv.error) {
    h += '<div class="wiz-rory-error">' + wizEsc(adv.error) + '</div>';
  } else if (adv) {
    if (adv.why) h += '<div class="wiz-rory-why"><div class="wiz-rory-lbl">Why this direction</div><p>' + wizEsc(adv.why) + '</p></div>';
    if (adv.evidence && adv.evidence.length) {
      h += '<div class="wiz-rory-ev"><div class="wiz-rory-lbl">What Rory is using</div><ul>' +
           adv.evidence.map(function (e) { return '<li>' + wizEsc(e) + '</li>'; }).join('') + '</ul></div>';
    }
    if (adv.question && !wizState.asked[stap]) {
      h += '<div class="wiz-rory-q"><div class="wiz-rory-lbl">Rory has a question</div><p>' + wizEsc(adv.question) + '</p>' +
           '<button type="button" class="wiz-btn small" onclick="wizAnswerQuestion()">Answer this</button>' +
           '<button type="button" class="wiz-btn small ghost" onclick="wizDismissQuestion()">Skip</button></div>';
    }
  } else {
    h += '<div class="wiz-rory-idle">Rory has not looked at this step yet.</div>';
  }

  h += '<div class="wiz-rory-actions">' +
       '<button type="button" class="wiz-chip" onclick="wizChatQuick(\'why\')">Why do you recommend this?</button>' +
       '<button type="button" class="wiz-chip" onclick="wizChatQuick(\'alternatives\')">Show alternatives</button>' +
       '<button type="button" class="wiz-chip" onclick="wizChatQuick(\'decide\')">You decide</button>' +
       '</div>';

  h += '<div class="wiz-chat" id="wiz-chat">' + wizChatHtml() + '</div>';
  h += '<div class="wiz-chat-input">' +
       '<textarea id="wiz-chat-in" placeholder="Ask Rory, or tell him what you are trying to achieve…" ' +
       'onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();wizChatSend();}"></textarea>' +
       '<button type="button" class="wiz-btn small primary" onclick="wizChatSend()">Send</button>' +
       '</div>';

  el.innerHTML = h;
  var c = document.getElementById('wiz-chat');
  if (c) c.scrollTop = c.scrollHeight;
}

function wizChatHtml() {
  if (!wizState.chat.length) return '<div class="wiz-chat-empty">Ask anything about this step. Rory keeps the whole wizard in mind.</div>';
  return wizState.chat.map(function (m) {
    return '<div class="wiz-msg ' + (m.role === 'assistant' ? 'rory' : 'user') + '">' +
      (m.role === 'assistant' ? '<span class="wiz-msg-who">Rory</span>' : '') +
      wizEsc(m.content) + '</div>';
  }).join('');
}

function wizDismissQuestion() { wizState.asked[wizState.current] = true; wizSave(); wizRenderRory(); }

function wizAnswerQuestion() {
  var adv = wizState.advice[wizState.current] || {};
  if (adv.question) {
    wizState.chat.push({ role: 'assistant', content: adv.question });
    wizState.asked[wizState.current] = true;
    wizSave(); wizRenderRory();
    var el = document.getElementById('wiz-chat-in');
    if (el) el.focus();
  }
}

var WIZ_QUICK = {
  why: 'Why do you recommend this for this step? Be specific about the customer, not the mechanics.',
  alternatives: 'Give me two genuinely different alternative directions for this step, and say what each one trades away.',
  decide: 'Make the call for this step yourself and set it. Tell me in one sentence what you chose and why.'
};

function wizChatQuick(soort) { wizChatSend(WIZ_QUICK[soort] || soort); }

var WIZ_CHAT_SYSTEM =
  'You are Rory Sutherland inside a static ad wizard, sparring with the user about the step they are on. ' +
  'Answer in English, in at most 90 words, concrete and without padding. Never translate advertisement copy, customer research or product content — quote it as it is. ' +
  'You may disagree with the user and say so plainly. ' +
  'If the user asks you to decide, or your answer should change a field on this step, return the new values so the wizard can apply them. ' +
  '\nAlways answer with strict JSON, no markdown fences:\n' +
  '{"reply":"your message to the user","apply":null or {"field":"value"} for the CURRENT step only}';

function wizChatSend(vast) {
  var el = document.getElementById('wiz-chat-in');
  var tekst = vast || (el ? el.value.trim() : '');
  if (!tekst || wizState.busy) return;
  if (el && !vast) el.value = '';
  wizState.chat.push({ role: 'user', content: tekst });
  wizState.busy = true;
  wizRenderRory();

  var stap = wizState.current;
  var ctx = wizContext();
  var geschiedenis = wizState.chat.filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
    .slice(-10).map(function (m) { return { role: m.role, content: m.content }; });
  geschiedenis[geschiedenis.length - 1] = {
    role: 'user',
    content: tekst + '\n\nCURRENT STEP: ' + stap +
      '\nFields you may set on this step: ' + Object.keys(wizState.data[stap] || {}).join(', ') +
      (stap === 'format' && typeof AD_FORMATS !== 'undefined'
        ? ('\nValid formatId values: ' + AD_FORMATS.map(function (f) { return f.id; }).join(', ')) : '') +
      (stap === 'visual' ? ('\n\n# VISUAL OPTIONS (use exact values)\n' + wizVisualOptionsText()) : '') +
      '\n\n' + ctx.text
  };

  wizCall(WIZ_CHAT_SYSTEM, geschiedenis, 1200)
    .then(function (data) {
      var obj;
      try { obj = wizParseJson(wizTextOf(data)); }
      catch (e) { obj = { reply: wizTextOf(data) || 'No answer came back.', apply: null }; }
      wizState.chat.push({ role: 'assistant', content: obj.reply || '(no message)' });
      if (obj.apply && typeof obj.apply === 'object') {
        wizApplyAdvice(stap, obj.apply, true);
      }
    })
    .catch(function (err) {
      wizState.chat.push({ role: 'assistant', content: 'I could not reach the server (' + err.message + '). Try again in a moment.' });
    })
    .finally(function () {
      wizState.busy = false;
      wizSave();
      wizRender();
    });
}

window.wizAdvise = wizAdvise; window.wizApplyAdvice = wizApplyAdvice;
window.wizRefreshStep = wizRefreshStep; window.wizRenderRory = wizRenderRory;
window.wizChatSend = wizChatSend; window.wizChatQuick = wizChatQuick;
window.wizAnswerQuestion = wizAnswerQuestion; window.wizDismissQuestion = wizDismissQuestion;
window.wizContext = wizContext; window.wizProduct = wizProduct; window.wizPersona = wizPersona;
window.wizFormat = wizFormat; window.wizLoadHistory = wizLoadHistory;
window.wizCall = wizCall; window.wizParseJson = wizParseJson; window.wizTextOf = wizTextOf;
window.wizModel = wizModel;
