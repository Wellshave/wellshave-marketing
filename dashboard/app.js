// Wellshave Marketing HQ — Pulse (v1, read-only)
// Data: uitsluitend Supabase (RLS: alleen team). Ververst elke 30s.
// supabase-js is gevendored (vendor/supabase.js, UMD) zodat het dashboard
// geen runtime-afhankelijkheid van een CDN heeft.
import { SUPABASE_URL, SUPABASE_KEY, REFRESH_MS } from './config.js';
const { createClient } = window.supabase;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const fmtEur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });
const TZ = 'Europe/Amsterdam';

const AGENT_COLORS = { nova:'#3987e5', atlas:'#199e70', radar:'#d55181', quill:'#c98500',
  pixel:'#9085e9', echo:'#d95926', bolt:'#3987e5', sage:'#199e70', vector:'#d55181' };
const STATUS_LABEL = { idle:'stand-by', working:'aan het werk', waiting_approval:'wacht op akkoord', offline:'offline' };
const PIPE_COLS = [['idea','Idee'],['hypothesis','Hypothese'],['script','Script'],['with_creator','Bij creator'],
  ['filming','Opname'],['editing','Edit'],['ready_for_launch','Klaar voor launch'],['live','Live'],['analyzed','Geanalyseerd']];

/* ---------- auth ---------- */
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  session ? showApp(session) : showAuth();
  sb.auth.onAuthStateChange((_e, s) => { s ? showApp(s) : showAuth(); });
}

function showAuth() {
  $('auth').hidden = false; $('app').hidden = true;
  const form = $('auth-form'), msg = $('auth-msg');
  form.onsubmit = (e) => { e.preventDefault(); act('signin'); };
  form.querySelectorAll('button[data-action]').forEach(b => {
    if (b.dataset.action !== 'signin') b.onclick = () => act(b.dataset.action);
  });
  async function act(action) {
    const email = $('auth-email').value.trim(), password = $('auth-pass').value;
    if (!email) { msg.textContent = 'Vul eerst je e-mailadres in.'; return; }
    if (action !== 'magic' && !password) { msg.textContent = 'Vul ook een wachtwoord in (minimaal 6 tekens).'; return; }
    msg.textContent = 'Bezig…';
    try {
      if (action === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (action === 'signup') {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        msg.textContent = 'Account aangemaakt — check je mail om te bevestigen.';
        return;
      } else {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
        if (error) throw error;
        msg.textContent = 'Magic link verstuurd — check je mail.';
        return;
      }
      msg.textContent = '';
    } catch (err) { msg.textContent = err.message || String(err); }
  }
}

let timer = null;
function showApp(session) {
  $('auth').hidden = true; $('app').hidden = false;
  $('user-chip').textContent = session.user.email;
  $('logout').onclick = () => sb.auth.signOut();
  const team = /@wellshave\.(com|nl)$/i.test(session.user.email || '');
  $('access-note').hidden = team;
  tickClock(); setInterval(tickClock, 1000);
  refresh();
  clearInterval(timer); timer = setInterval(refresh, REFRESH_MS);
  addEventListener('resize', debounce(() => render(lastData), 250));
}

function tickClock() {
  $('clock').textContent = new Intl.DateTimeFormat('nl-NL',
    { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone: TZ }).format(new Date());
}

/* ---------- data ---------- */
let lastData = null;
async function refresh() {
  const [agents, runs, messages, pipeline, reports, metrics, approvals] = await Promise.all([
    sb.from('hq_agents').select('*').order('phase').order('name'),
    sb.from('hq_agent_runs').select('*').order('started_at', { ascending: false }).limit(25),
    sb.from('hq_agent_messages').select('*').order('created_at', { ascending: false }).limit(25),
    sb.from('hq_pipeline_items').select('*').neq('status', 'archived').order('updated_at', { ascending: false }),
    sb.from('hq_reports').select('id,report_date,kind,title,author_agent,vault_path,created_at').order('created_at', { ascending: false }).limit(15),
    sb.from('hq_metrics_daily').select('*').gte('metric_date', isoDaysAgo(15)),
    sb.from('hq_approvals').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  lastData = { agents: agents.data ?? [], runs: runs.data ?? [], messages: messages.data ?? [],
    pipeline: pipeline.data ?? [], reports: reports.data ?? [], metrics: metrics.data ?? [],
    approvals: approvals.data ?? [] };
  render(lastData);
  $('updated').textContent = 'bijgewerkt ' + new Intl.DateTimeFormat('nl-NL',
    { hour:'2-digit', minute:'2-digit', timeZone: TZ }).format(new Date());
  const dot = $('live-dot'); dot.classList.add('flash'); setTimeout(() => dot.classList.remove('flash'), 600);
}

function isoDaysAgo(n) { const d = new Date(Date.now() - n * 864e5); return d.toISOString().slice(0, 10); }

/* ---------- render ---------- */
function render(d) {
  if (!d) return;
  renderTiles(d); renderTeam(d.agents); renderCharts(d.metrics);
  renderPipeline(d.pipeline); renderFeeds(d); renderApprovals(d.approvals);
}

function dayMetrics(metrics, date) {
  const rows = metrics.filter(m => m.metric_date === date);
  const spend = sum(rows.filter(r => r.metric === 'spend').map(r => +r.value));
  const revenue = sum(rows.filter(r => r.metric === 'revenue').map(r => +r.value));
  const roas = revenue && spend ? revenue / spend
    : wavg(rows.filter(r => r.metric === 'roas'), rows.filter(r => r.metric === 'spend'));
  const provisional = rows.some(r => !r.is_final);
  return { spend, roas, provisional };
}
const sum = (a) => a.reduce((x, y) => x + y, 0);
function wavg(roasRows, spendRows) {
  if (!roasRows.length) return null;
  const bySpend = Object.fromEntries(spendRows.map(r => [r.account_id, +r.value]));
  let num = 0, den = 0;
  for (const r of roasRows) { const w = bySpend[r.account_id] ?? 1; num += +r.value * w; den += w; }
  return den ? num / den : null;
}

function renderTiles(d) {
  const y = isoDaysAgo(1), y2 = isoDaysAgo(2);
  const cur = dayMetrics(d.metrics, y), prev = dayMetrics(d.metrics, y2);
  countUp($('t-spend'), cur.spend, v => fmtEur.format(v));
  $('t-spend-sub').innerHTML = deltaText(cur.spend, prev.spend, null) + (cur.provisional ? ' <span class="badge">voorlopig</span>' : '');
  $('t-roas').textContent = cur.roas ? fmtNum.format(cur.roas) : '—';
  $('t-roas-sub').innerHTML = (cur.roas && prev.roas ? deltaText(cur.roas, prev.roas, true) : 'nog geen vergelijking')
    + (cur.provisional ? ' <span class="badge">voorlopig</span>' : '');
  const working = d.agents.filter(a => a.status === 'working');
  $('t-working').textContent = String(working.length);
  $('t-working-sub').textContent = working.length ? working.map(a => a.name).join(', ')
    : d.agents.length ? 'iedereen stand-by' : '';
  const open = d.approvals.filter(a => a.status === 'pending');
  $('t-approvals').textContent = String(open.length);
  $('t-approvals-sub').textContent = open.length ? 'wachten op jullie akkoord' : 'niets te beoordelen';
}

function deltaText(cur, prev, upIsGood) {
  if (!prev || !cur) return 'nog geen vergelijking';
  const pct = ((cur - prev) / prev) * 100, up = pct >= 0;
  const cls = upIsGood === null ? '' : (up === upIsGood ? 'delta-up' : 'delta-down');
  return `<span class="${cls}">${up ? '▲' : '▼'} ${fmtNum.format(Math.abs(pct))}%</span> t.o.v. eergisteren`;
}

function countUp(el, target, fmt) {
  if (!target) { el.textContent = fmt(0); return; }
  const start = performance.now(), dur = 650, from = 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(target); return; }
  (function step(t) {
    const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (target - from) * e);
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

function renderTeam(agents) {
  $('team-grid').innerHTML = agents.map(a => `
    <div class="agent phase${a.phase}">
      <div class="agent-head">
        <span class="avatar" style="background:${AGENT_COLORS[a.id] || '#898781'}">${esc(a.name[0])}</span>
        <div><div class="agent-name">${esc(a.name)}</div><div class="agent-role">${esc(a.role)}</div></div>
        ${a.phase > 1 ? `<span class="phase-tag">fase ${a.phase}</span>` : ''}
      </div>
      <div class="agent-status"><span class="status-dot ${esc(a.status)}"></span> ${STATUS_LABEL[a.status] ?? esc(a.status)}</div>
      <p class="agent-task">${a.current_task ? esc(a.current_task) : ''}</p>
      <p class="agent-last">${a.last_run_at ? 'laatste run ' + rel(a.last_run_at) : 'nog geen runs'}</p>
    </div>`).join('');
}

/* ---------- charts (SVG, hand-rolled volgens dataviz-specs) ---------- */
function renderCharts(metrics) {
  const days = [...Array(14)].map((_, i) => isoDaysAgo(14 - i));
  const series = days.map(dt => ({ date: dt, ...dayMetrics(metrics, dt) }));
  drawBars($('chart-spend'), series, 'spend', '#3987e5');
  drawLine($('chart-roas'), series, 'roas', '#199e70');
}

function chartFrame(el, pad) {
  const w = el.clientWidth || 500, h = 240;
  return { w, h, pad, iw: w - pad.l - pad.r, ih: h - pad.t - pad.b };
}
const short = (iso) => new Intl.DateTimeFormat('nl-NL', { day:'numeric', month:'short' }).format(new Date(iso + 'T12:00'));

function gridLines(f, max, fmt) {
  const steps = 4; let s = '';
  for (let i = 0; i <= steps; i++) {
    const v = (max / steps) * i, y = f.pad.t + f.ih - (v / max) * f.ih;
    s += `<line x1="${f.pad.l}" x2="${f.w - f.pad.r}" y1="${y}" y2="${y}" stroke="#2c2c2a" stroke-width="1"/>
          <text x="${f.pad.l - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#898781" style="font-variant-numeric:tabular-nums">${fmt(v)}</text>`;
  }
  return s;
}

function drawBars(el, series, key, color) {
  const vals = series.map(s => s[key] || 0);
  if (!vals.some(v => v > 0)) { el.innerHTML = '<p class="empty">Nog geen spend-data — verschijnt na de eerste ochtendcyclus.</p>'; return; }
  const f = chartFrame(el, { l: 52, r: 10, t: 12, b: 26 });
  const max = niceMax(Math.max(...vals));
  const bw = Math.max(6, f.iw / series.length - 2);
  let bars = '', labels = '';
  series.forEach((s, i) => {
    const v = s[key] || 0, x = f.pad.l + i * (f.iw / series.length) + 1;
    const h = (v / max) * f.ih, y = f.pad.t + f.ih - h;
    const fill = s.provisional ? 'url(#hatch)' : color;
    bars += `<path d="M${x},${f.pad.t + f.ih} v${-Math.max(0, h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(0, h - 4)} z"
      fill="${fill}" data-i="${i}" class="bar"/>`;
    if (i % 2 === 0) labels += `<text x="${x + bw / 2}" y="${f.h - 8}" text-anchor="middle" font-size="10.5" fill="#898781">${short(s.date)}</text>`;
    if (i === series.length - 1 && v > 0)
      labels += `<text x="${x + bw / 2}" y="${y - 7}" text-anchor="middle" font-size="11" font-weight="600" fill="#c3c2b7">${fmtEur.format(v)}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="Ad spend per dag">
    <defs><pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${color}" opacity="0.45"/><line x1="0" y1="0" x2="0" y2="6" stroke="${color}" stroke-width="2.5"/></pattern></defs>
    ${gridLines(f, max, v => '€' + Math.round(v))}
    <line x1="${f.pad.l}" x2="${f.w - f.pad.r}" y1="${f.pad.t + f.ih}" y2="${f.pad.t + f.ih}" stroke="#383835" stroke-width="1"/>
    ${bars}${labels}</svg>`;
  hover(el, series, (s) => `<strong>${fmtEur.format(s[key] || 0)}</strong><small>${short(s.date)}${s.provisional ? ' · voorlopig' : ''}</small>`);
}

function drawLine(el, series, key, color) {
  const pts = series.map((s, i) => ({ i, v: s[key] })).filter(p => p.v != null && isFinite(p.v));
  if (pts.length < 2) { el.innerHTML = '<p class="empty">Nog geen ROAS-reeks — verschijnt na de eerste ochtendcyclus.</p>'; return; }
  const f = chartFrame(el, { l: 44, r: 14, t: 12, b: 26 });
  const max = niceMax(Math.max(...pts.map(p => p.v)));
  const X = (i) => f.pad.l + (i / (series.length - 1)) * f.iw;
  const Y = (v) => f.pad.t + f.ih - (v / max) * f.ih;
  const path = pts.map((p, j) => `${j ? 'L' : 'M'}${X(p.i)},${Y(p.v)}`).join(' ');
  const last = pts[pts.length - 1];
  let labels = '';
  series.forEach((s, i) => { if (i % 2 === 0)
    labels += `<text x="${X(i)}" y="${f.h - 8}" text-anchor="middle" font-size="10.5" fill="#898781">${short(s.date)}</text>`; });
  el.innerHTML = `<svg viewBox="0 0 ${f.w} ${f.h}" role="img" aria-label="ROAS per dag">
    ${gridLines(f, max, v => fmtNum.format(v))}
    <line x1="${f.pad.l}" x2="${f.w - f.pad.r}" y1="${f.pad.t + f.ih}" y2="${f.pad.t + f.ih}" stroke="#383835" stroke-width="1"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${pts.map(p => `<circle cx="${X(p.i)}" cy="${Y(p.v)}" r="${p.i === last.i ? 4.5 : 3}" fill="${color}" stroke="#1a1a19" stroke-width="2"/>`).join('')}
    <text x="${X(last.i)}" y="${Y(last.v) - 10}" text-anchor="middle" font-size="11" font-weight="600" fill="#c3c2b7">${fmtNum.format(last.v)}</text>
    ${labels}</svg>`;
  hover(el, series, (s) => s[key] != null
    ? `<strong>ROAS ${fmtNum.format(s[key])}</strong><small>${short(s.date)}${s.provisional ? ' · voorlopig' : ''}</small>` : null);
}

function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p * 2) / 2 * p; }

function hover(el, series, html) {
  const tip = $('tooltip'), svg = el.querySelector('svg');
  if (!svg) return;
  svg.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.min(series.length - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * (series.length - 1))));
    const content = html(series[i]);
    if (!content) { tip.hidden = true; return; }
    tip.innerHTML = content; tip.hidden = false;
    tip.style.left = Math.min(innerWidth - 150, e.clientX + 14) + 'px';
    tip.style.top = (e.clientY - 14) + 'px';
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
}

/* ---------- pipeline, feeds, approvals ---------- */
function renderPipeline(items) {
  $('pipeline').innerHTML = PIPE_COLS.map(([key, label]) => {
    const col = items.filter(i => i.status === key);
    return `<div class="pipe-col"><h4>${label} <span class="pipe-count">${col.length}</span></h4>
      ${col.slice(0, 6).map(i => `<div class="pipe-item">${esc(i.title)}<span class="who">${esc(i.type)}${i.owner_agent ? ' · ' + esc(cap(i.owner_agent)) : ''}</span></div>`).join('')}
    </div>`;
  }).join('');
}

function renderFeeds(d) {
  $('feed-reports').innerHTML = d.reports.length ? d.reports.map(r =>
    `<li class="kind-${esc(r.kind)}"><span class="t">${r.report_date}</span><div class="s">${esc(r.title)}</div>
     <div class="b">${esc(cap(r.author_agent || ''))} · ${esc(r.kind)}</div></li>`).join('')
    : emptyLi('Nog geen rapporten — de eerste verschijnt na de ochtendcyclus van 07:00.');
  $('feed-messages').innerHTML = d.messages.length ? d.messages.map(m =>
    `<li><span class="t">${rel(m.created_at)}</span>
     <div class="s">${esc(cap(m.from_agent))} → ${m.to_agent ? esc(cap(m.to_agent)) : 'team'}</div>
     <div class="b">${esc(m.subject)}</div></li>`).join('')
    : emptyLi('Nog geen onderlinge berichten.');
  $('feed-runs').innerHTML = d.runs.length ? d.runs.map(r =>
    `<li><span class="t">${rel(r.started_at)}</span>
     <div class="s">${esc(cap(r.agent_id))} <span class="run-${esc(r.status)}">· ${esc(r.status)}</span></div>
     <div class="b">${esc(r.summary || '')}</div></li>`).join('')
    : emptyLi('Nog geen agent-runs gelogd.');
}
const emptyLi = (t) => `<li><div class="b">${t}</div></li>`;

function renderApprovals(list) {
  const tb = $('approvals-table').querySelector('tbody');
  tb.innerHTML = list.length ? list.map(a => `<tr>
      <td>${new Intl.DateTimeFormat('nl-NL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', timeZone: TZ }).format(new Date(a.created_at))}</td>
      <td>${esc(cap(a.requested_by))}</td><td>${esc(a.action_type)}</td><td>${esc(a.description)}</td>
      <td><span class="pill ${esc(a.status)}">${esc(a.status)}</span></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty-state">Geen openstaande acties — de agents hebben niets klaargezet.</td></tr>';
}

/* ---------- utils ---------- */
function rel(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 90) return 'zojuist';
  if (s < 3600) return Math.round(s / 60) + ' min geleden';
  if (s < 86400) return Math.round(s / 3600) + ' uur geleden';
  return Math.round(s / 86400) + ' dgn geleden';
}
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

init();
