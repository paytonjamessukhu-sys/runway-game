/* FRONTIER control room: the dashboard. Owns the clock, draws every panel, routes every input to the engine. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG, WORLD = window.FRONTIER_WORLD, CORPUS = window.FRONTIER_CORPUS, AU = window.FrontierAudio;
  var $ = function (id) { return document.getElementById(id); };
  var root = $('fx');
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqPhone = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function phone() { return !!(mqPhone && mqPhone.matches); }
  function store(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function log10(x) { return Math.log(x) / Math.LN10; }

  /* ---------- colours from the tokens on :root ---------- */
  var cs = getComputedStyle(document.documentElement);
  function tok(n, d) { var v = (cs.getPropertyValue(n) || '').trim(); return v || d; }
  var COL = { bg: tok('--bg', '#04060a'), text: tok('--text', '#e6edf4'), muted: tok('--muted', '#8b97a7'), dim: tok('--dim', '#5b6676'), faint: tok('--faint', '#2a3441'), edge: tok('--edge', '#18202b'), edge2: tok('--edge-2', '#222d3b'),
    accent: tok('--accent', '#3ff5c6'), accent2: tok('--accent-2', '#20c79c'), danger: tok('--danger', '#ff4d6a'), white: tok('--white', '#f5f8fb'), ra: tok('--rival-a', '#b4bcc8'), rb: tok('--rival-b', '#8a94a3'), rc: tok('--rival-c', '#6a7483'), panel3: tok('--panel-3', '#131a24') };
  function hexA(h, a) { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return 'rgba(' + parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16) + ',' + a + ')'; }
  var FONT = { ui: tok('--f-ui', 'system-ui, sans-serif'), num: tok('--f-num', 'monospace') };
  var RIVCOL = { halcyon: COL.ra, kestrel: COL.rb, northwind: COL.rc };

  /* ---------- minimal DOM morph: patch in place so buttons survive re-renders ---------- */
  function morph(el, html) {
    if (el.__html === html) return; el.__html = html;
    var t = document.createElement('template'); t.innerHTML = html; patch(el, t.content);
  }
  function patch(a, b) {
    var bc = Array.prototype.slice.call(b.childNodes), i;
    for (i = 0; i < bc.length; i++) {
      var an = a.childNodes[i], bn = bc[i];
      if (!an) { a.appendChild(bn.cloneNode(true)); continue; }
      if (an.nodeType !== bn.nodeType || an.nodeName !== bn.nodeName || (an.nodeType === 1 && an.getAttribute('data-k') !== bn.getAttribute('data-k'))) { a.replaceChild(bn.cloneNode(true), an); continue; }
      if (an.nodeType !== 1) { if (an.nodeValue !== bn.nodeValue) an.nodeValue = bn.nodeValue; continue; }
      var aa = an.attributes, ba = bn.attributes, j;
      for (j = aa.length - 1; j >= 0; j--) if (!bn.hasAttribute(aa[j].name)) an.removeAttribute(aa[j].name);
      for (j = 0; j < ba.length; j++) if (an.getAttribute(ba[j].name) !== ba[j].value) an.setAttribute(ba[j].name, ba[j].value);
      if (an.nodeName === 'BUTTON') an.disabled = bn.hasAttribute('disabled');
      if (an.nodeName === 'DETAILS') continue;
      patch(an, bn);
    }
    while (a.childNodes.length > bc.length) a.removeChild(a.lastChild);
  }

  /* ---------- game ---------- */
  var G = null, S = null, speed = 1, paused = true, botMult = 1, peek = false, sheetItem = null, started = false;
  var lastBarH = 0, dirty = true, lastPanels = 0, flash = null, sample = null, typing = null, openPanels = {}, armed = {};
  var design = { params: 0, tokens: 0, pool: 'office', gpus: 8, recipe: true, touched: false };
  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }
  function newGame(seed) {
    if (seed == null) seed = seedFromHash();
    G = window.FrontierEngine.create(CFG, WORLD, CORPUS, seed, onEvent); S = G.S;
    setTarget(1e19); design.pool = 'office'; design.gpus = 8; design.touched = false;
    sample = null; typing = null; flash = null; sheetItem = null; peek = false; armed = {};
    newsSeen = 0; rollers.cash.v = S.bank; rollers.cash.t = S.bank;
    $('end').hidden = true; closeSheet(); $('waiting').hidden = true;
    root.classList.remove('is-over'); root.classList.add('is-intro');
    $('ro-text').textContent = 'No model yet. Launch a run, then tap a checkpoint on the chart to read what it says.'; $('ro-text').className = 'ro-text'; $('ro-head').textContent = 'MODEL OUTPUT';
    dirty = true; render(true);
  }
  function startGame() {
    AU.unlock(); AU.setMuted(muted);
    if (S.phase === 'intro') G.act('start');
    $('intro').hidden = true; root.classList.remove('is-intro');
    setSpeed(1); started = true; dirty = true;
  }

  /* ---------- engine events ---------- */
  var newsSeen = 0;
  function onEvent(type, d) {
    dirty = true;
    switch (type) {
      case 'news': if (d.kind === 'world') { AU.news(); if (d.fx === 'gpt3') showFlash('GPT-3 · 3.14e23 FLOPs', true, 4); if (d.fx === 'crash') showFlash('MARKET CRASH · TERM SHEETS CLOSED', false, 4); } if (d.bad) AU.bad(); break;
      case 'decision': AU.decision(); AU.vibrate(20); setTimeout(openNextDecision, 30); break;
      case 'launch': AU.launch(); sample = null; setReadout(null); break;
      case 'land': AU.land(); AU.vibrate(30); showFlash(d.run.clean ? 'LANDED · ' + d.run.loss.toFixed(3) + ' NATS' : 'LANDED PAST THE WALL', d.run.clean, 3); showSample(d.sample, true); break;
      case 'hang': AU.hang(); AU.vibrate([60, 40, 60]); showFlash('HANG ' + d.hang.at + ' · ' + (d.hang.infra ? 'restart in hours' : 'dark until morning'), false, Math.max(2, CFG.hangMinRealSec + 0.5)); break;
      case 'resume': showFlash('RESTARTED FROM CHECKPOINT', true, 1.4); break;
      case 'nan': AU.nan(); showFlash('NaN · ROLLED BACK TO CHECKPOINT', false, 2.2); break;
      case 'sample': showSample(d, false); break;
      case 'payroll': AU.payroll(); flashCash(false); break;
      case 'raise': AU.cash(true); flashCash(true); break;
      case 'cash': AU.cash(true); flashCash(true); break;
      case 'hire': case 'arrive': case 'filterDone': AU.good(); break;
      case 'walk': AU.bad(); break;
      case 'end': setTimeout(showEnd, 350); break;
    }
  }
  function showFlash(text, good, sec) { flash = { text: text, good: good, until: performance.now() + sec * 1000 }; var f = $('chart-flash'); f.textContent = text; f.className = 'chart-flash on' + (good ? ' good' : ''); }
  function flashCash(up) { var el = document.querySelector('.st-cash'); if (!el) return; el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth; el.classList.add(up ? 'flash-up' : 'flash-down'); setTimeout(function () { el.classList.remove('flash-up', 'flash-down'); }, 900); }

  /* ---------- clock ---------- */
  function setSpeed(x) {
    if (x === 0) { paused = true; }
    else { paused = false; speed = x; if (G && G.blocked()) { openNextDecision(); } }
    root.classList.toggle('is-paused', paused);
    Array.prototype.forEach.call(document.querySelectorAll('.speed button'), function (b) { var s = +b.dataset.speed; b.setAttribute('aria-pressed', String(paused ? s === 0 : s === speed)); });
    dirty = true;
  }
  var lastT = performance.now(), lastHum = 0;
  function frame(now) {
    var dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (G && S.phase === 'play' && !paused && !G.blocked()) {
      var days = dt * speed * CFG.daysPerSec * botMult;
      if (S.run && S.run.hang) days = Math.min(days, dt * speed * botMult * Math.min(1, S.run.hang.len / CFG.hangMinRealSec));
      if (days > 0) { G.advance(days); dirty = true; }
    }
    if (flash && now > flash.until) { flash = null; $('chart-flash').className = 'chart-flash'; }
    stepRollers(dt);
    stepTyping(dt);
    drawChart(now);
    if (dirty && now - lastPanels > (phone() ? 180 : 120)) { lastPanels = now; render(false); }
    if (now - lastHum > 300) { lastHum = now; if (G) AU.hum(G.utilisation(), S.phase === 'play' && !paused && !G.blocked() && !!S.run && !S.run.hang); }
    requestAnimationFrame(frame);
  }

  /* ---------- rolling numbers ---------- */
  var rollers = { cash: { v: 0, t: 0, el: 'v-cash' } };
  function stepRollers(dt) {
    if (!S) return;
    var r = rollers.cash; r.t = S.bank;
    var diff = r.t - r.v;
    if (reduced() || Math.abs(diff) < 1) r.v = r.t;
    else { var k = 1 - Math.exp(-dt * 7); r.v += diff * k; if (Math.abs(diff) > 20000 && Math.random() < 0.5) AU.tick(); }
    var el = $(r.el), txt = G.money(r.v); if (el.textContent !== txt) el.textContent = txt;
  }

  /* ---------- the model's words ---------- */
  var TIER = ['static', 'words', 'grammar', 'sentences', 'paragraphs'];
  function showSample(s, landing) {
    if (!s) return;
    sample = s; setReadout(s, landing);
  }
  function setReadout(s, landing) {
    var head = $('ro-head'), txt = $('ro-text');
    if (!s) { head.textContent = S && S.run ? 'MODEL OUTPUT · waiting for the first checkpoint' : 'MODEL OUTPUT'; txt.textContent = S && S.run ? 'Tap the chart or press Sample to read the latest checkpoint.' : 'No model yet. Launch a run, then tap a checkpoint on the chart to read what it says.'; txt.className = 'ro-text'; typing = null; return; }
    var run = S.runs.find(function (r) { return r.id === s.runId; }) || (S.run && S.run.id === s.runId ? S.run : null);
    head.innerHTML = '<span>' + (landing || s.q >= 1 ? 'LANDED' : 'CHECKPOINT ' + Math.round(s.q * 100) + '%') + '</span><span>loss ' + s.loss.toFixed(3) + '</span><span class="tier">' + TIER[s.tier] + (s.cap ? ' · ' + s.cap : '') + '</span>' + (run ? '<span>' + G.sci(run.C) + ' · ' + G.sizeWord(run.N) + '</span>' : '');
    txt.className = 'ro-text' + (s.cap === 'code' ? ' code' : '');
    typing = { text: s.text, shown: reduced() ? s.text.length : 0 };
    renderTyping();
  }
  function stepTyping(dt) {
    if (!typing || typing.shown >= typing.text.length) return;
    var before = Math.floor(typing.shown);
    typing.shown = Math.min(typing.text.length, typing.shown + dt * (typing.text.length > 140 ? 110 : 70));
    if (Math.floor(typing.shown) !== before) { renderTyping(); if (Math.random() < 0.3) AU.click(); }
  }
  function renderTyping() { var t = $('ro-text'); var n = Math.floor(typing.shown); t.innerHTML = esc(typing.text.slice(0, n)) + (n < typing.text.length ? '<span class="cur"></span>' : ''); }

  /* ---------- design state ---------- */
  var PMIN = 7, PMAX = 12.3, TMIN = 8, TMAX = 12.7;
  function recipeDForN(N) { var e = CFG.tokExp; return Math.pow(CFG.tokGPT3 * Math.pow(6 * N / CFG.gpt3C, e), 1 / (1 - e)); }
  function setTarget(C) { var sp = G.recipeSplit(C); design.params = sp.N; design.tokens = sp.D; design.recipe = true; syncSliders(); dirty = true; }
  function syncSliders() {
    var p = $('d-params'), t = $('d-tokens');
    p.value = Math.round((log10(design.params) - PMIN) / (PMAX - PMIN) * 1000);
    t.value = Math.round((log10(design.tokens) - TMIN) / (TMAX - TMIN) * 1000);
    fillRange(p); fillRange(t);
  }
  function fillRange(el) { var mn = +el.min, mx = +el.max, v = +el.value; el.style.setProperty('--fill', ((v - mn) / Math.max(1, mx - mn) * 100) + '%'); }
  function currentDesign() { return G.design({ params: design.params, tokens: design.tokens, pool: design.pool, gpus: design.gpus }); }

  /* ---------- chart ---------- */
  var cv = $('chart'), cx = cv.getContext('2d'), CW = 0, CH = 0, DPR = 1, chartPts = [];
  function sizeChart() {
    var r = cv.getBoundingClientRect(); DPR = Math.min(2.5, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(r.width * DPR)), h = Math.max(1, Math.round(r.height * DPR));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    CW = r.width; CH = r.height;
  }
  var PAD = { l: 44, r: 14, t: 30, b: 28 };
  function XM() { return phone() ? { l: 17.5, r: 24.6 } : { l: 17, r: 25 }; }
  function px(lc) { var xm = XM(); return PAD.l + (lc - xm.l) / (xm.r - xm.l) * (CW - PAD.l - PAD.r); }
  var YT = Math.log(CFG.plot.yMax), YB = Math.log(CFG.plot.yMin);
  function py(L) { return PAD.t + (YT - Math.log(L)) / (YT - YB) * (CH - PAD.t - PAD.b); }
  function C_of_tokens(D) { return CFG.gpt3C * Math.pow(D / CFG.tokGPT3, 1 / CFG.tokExp); }
  function C_of_params(N) { var e = CFG.tokExp; return Math.pow(6 * N * CFG.tokGPT3 / Math.pow(CFG.gpt3C, e), 1 / (1 - e)); }
  function drawChart(now) {
    if (!G) return;
    sizeChart(); if (CW < 10) return;
    var c = cx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, CW, CH);
    var xm = XM(), L = PAD.l, R = CW - PAD.r, T = PAD.t, B = CH - PAD.b, small = CW < 520;
    chartPts = []; occ = [];
    var F9 = '600 ' + (small ? 9 : 10) + 'px ' + FONT.num;
    // grid
    c.lineWidth = 1; c.font = '500 ' + (small ? 9 : 10) + 'px ' + FONT.num; c.textBaseline = 'middle';
    for (var e = Math.ceil(xm.l); e <= Math.floor(xm.r); e++) {
      var x = Math.round(px(e)) + 0.5; c.strokeStyle = hexA(COL.text, 0.05); c.beginPath(); c.moveTo(x, T); c.lineTo(x, B); c.stroke();
      if (!small || e % 1 === 0) { c.fillStyle = COL.dim; c.textAlign = 'center'; c.fillText('1e' + e, x, B + 12); }
    }
    [2, 3, 4, 6, 10].forEach(function (lv) { var y = Math.round(py(lv)) + 0.5; c.strokeStyle = hexA(COL.text, 0.05); c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); c.fillStyle = COL.dim; c.textAlign = 'right'; c.fillText(String(lv), L - 6, y); });
    c.fillStyle = COL.muted; c.textAlign = 'right'; c.fillText('compute (FLOPs) →', R, B + 23 > CH - 2 ? CH - 4 : B + 23);
    c.save(); c.translate(11, (T + B) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText('loss (nats)', 0, 0); c.restore();
    c.save(); c.beginPath(); c.rect(L, T - 6, R - L, B - T + 6); c.clip();
    // data wall band (where the recipe's tokens pass the clean-data wall)
    var wall = G.wallEstimate(), wlo = log10(C_of_tokens(wall.lo)), whi = log10(C_of_tokens(wall.hi));
    var x0 = px(wlo), x1 = px(whi);
    if (x0 < R) {
      c.fillStyle = hexA(COL.danger, 0.05); c.fillRect(x0, T, Math.max(0, R - x0), B - T);
      c.save(); c.beginPath(); c.rect(x0, T, Math.max(0, Math.min(x1, R) - x0), B - T); c.clip(); c.strokeStyle = hexA(COL.danger, 0.13); c.lineWidth = 1;
      for (var hx = x0 - (B - T); hx < Math.min(x1, R); hx += 7) { c.beginPath(); c.moveTo(hx, B); c.lineTo(hx + (B - T), T); c.stroke(); } c.restore();
      c.fillStyle = hexA(COL.danger, 0.10); if (x1 < R) c.fillRect(x1, T, R - x1, B - T);
      label(c, 'DATA WALL ~' + G.sizeWord(wall.mid) + ' tok', x0 > R - 110 ? R : Math.max(L + 2, x0), B - 9, hexA(COL.danger, 0.9), F9, x0 > R - 110 ? [[-4, 0], [-4, -14]] : [[4, 0], [4, -14]], false);
    }
    // memory limit
    var mx = px(log10(C_of_params(G.memLimit())));
    if (mx > L && mx < R) { c.strokeStyle = hexA(COL.text, 0.25); c.setLineDash([2, 4]); c.beginPath(); c.moveTo(mx, T); c.lineTo(mx, B); c.stroke(); c.setLineDash([]); vlabel(c, 'size limit ' + G.sizeWord(G.memLimit()), mx, COL.muted, '500 ' + (small ? 9 : 10) + 'px ' + FONT.num); occ.push({ x: mx, y: T, w: 14, h: 90 }); }
    // horizon
    var hzx = px(log10(G.horizon()));
    if (hzx > L && hzx < R && !G.hasScaling()) { c.strokeStyle = hexA(COL.accent, 0.18); c.setLineDash([1, 5]); c.beginPath(); c.moveTo(hzx, T + 16); c.lineTo(hzx, B); c.stroke(); c.setLineDash([]); vlabel(c, 'measured horizon', hzx, hexA(COL.accent, 0.6), '500 ' + (small ? 9 : 10) + 'px ' + FONT.num); occ.push({ x: hzx, y: T, w: 14, h: 100 }); }
    // the law
    if (S.line) {
      c.strokeStyle = hexA(COL.text, 0.42); c.lineWidth = 1.2; c.setLineDash([6, 5]); c.beginPath();
      for (var lc = xm.l; lc <= xm.r + 0.01; lc += 0.1) { var yy = py(G.Lline(Math.pow(10, lc))); if (lc === xm.l) c.moveTo(px(lc), yy); else c.lineTo(px(lc), yy); }
      c.stroke(); c.setLineDash([]);
      var lx = xm.l + 0.35; label(c, 'scaling law · Kaplan 2020', px(lx), py(G.Lline(Math.pow(10, lx))), COL.muted, 'italic 500 ' + (small ? 9 : 10) + 'px ' + FONT.num, [[0, -12], [0, 12], [0, -26]], true);
    }
    // finished curves (the family whose envelope is the law)
    var fin = S.runs.slice(-14);
    fin.forEach(function (r) { if (!r.pts || r.pts.length < 2) return; c.strokeStyle = r.clean ? hexA(COL.accent, 0.16) : hexA(COL.danger, 0.16); c.lineWidth = 1; c.beginPath(); r.pts.forEach(function (p, i) { var X = px(log10(p[0] * r.C)), Y = py(p[1]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke(); });
    // rivals
    S.rivals.forEach(function (rv) {
      var col = RIVCOL[rv.key] || COL.rb, pts = rv.pubs.map(function (p) { return [px(log10(p.C)), py(p.L)]; });
      c.strokeStyle = hexA(col, 0.35); c.setLineDash([2, 3]); c.lineWidth = 1; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]);
      pts.forEach(function (p, i) { marker(c, rv.key, p[0], p[1], i === pts.length - 1 ? 4 : 2.6, col); occ.push({ x: p[0] - 4, y: p[1] - 4, w: 8, h: 8 }); });
    });
    // GPT-3
    var gx = px(log10(CFG.gpt3C)), gy = py(CFG.gpt3Loss);
    c.lineWidth = 1.6; c.strokeStyle = COL.white;
    if (S.gpt3) { c.fillStyle = COL.white; c.beginPath(); c.arc(gx, gy, 5, 0, 6.283); c.fill(); c.beginPath(); c.arc(gx, gy, 10, 0, 6.283); c.globalAlpha = 0.4; c.stroke(); c.globalAlpha = 1; }
    else { c.setLineDash([3, 3]); c.beginPath(); c.arc(gx, gy, 9, 0, 6.283); c.stroke(); c.setLineDash([]); }
    occ.push({ x: gx - 10, y: gy - 10, w: 20, h: 20 });
    // your dots
    var best = G.bestClean();
    S.runs.forEach(function (r) {
      var X = px(log10(r.C)), Y = py(r.loss);
      chartPts.push({ x: X, y: Y, run: r, q: 1 }); occ.push({ x: X - 5, y: Y - 5, w: 10, h: 10 });
      if (r.clean) { c.shadowColor = COL.accent; c.shadowBlur = 8; c.fillStyle = COL.accent; c.beginPath(); c.arc(X, Y, r === best ? 5.5 : 4, 0, 6.283); c.fill(); c.shadowBlur = 0; if (r.status === 'published' || r.status === 'shipped') { c.strokeStyle = COL.accent; c.lineWidth = 1; c.beginPath(); c.arc(X, Y, 8, 0, 6.283); c.stroke(); } }
      else { c.strokeStyle = COL.danger; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, 4.5, 0, 6.283); c.stroke(); }
    });
    label(c, 'GPT-3 ' + (S.gpt3 ? '· 28 MAY' : '· the target'), gx, gy, COL.white, F9, [[0, -18], [-14, 0], [0, 18], [14, 0]], false);
    if (best) label(c, G.sci(best.C) + ' · ' + best.loss.toFixed(2), px(log10(best.C)), py(best.loss), COL.accent, F9, [[9, 13], [9, -13], [-9, 13], [-9, -13], [0, 24]], true);
    S.rivals.forEach(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; label(c, rv.name, px(log10(lp.C)), py(lp.L), RIVCOL[rv.key] || COL.rb, '600 ' + (small ? 9 : 10) + 'px ' + FONT.ui, [[-7, -9], [7, -9], [-7, 10], [7, 10], [0, -18], [0, 20]], true); });
    // ghost of the design
    var d = currentDesign();
    if (isFinite(d.C) && d.C > 0) {
      var DX = px(log10(d.C)), DY = py(d.proj), e1 = py(d.proj * (1 + d.err)), e0 = py(d.proj * (1 - d.err));
      c.strokeStyle = hexA(COL.white, S.run ? 0.25 : 0.7); c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(DX, T); c.lineTo(DX, B); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(DX, e1); c.lineTo(DX, e0); c.moveTo(DX - 5, e1); c.lineTo(DX + 5, e1); c.moveTo(DX - 5, e0); c.lineTo(DX + 5, e0); c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.arc(DX, DY, 4, 0, 6.283); c.stroke();
      if (!S.run) label(c, 'next: ' + G.sci(d.C), DX, T + 8, COL.white, F9, [[6, 0], [-6, 0], [6, 16], [-6, 16], [6, 32]], true);
    }
    // the live run
    var run = S.run;
    if (run) {
      var hung = !!run.hang, pts = run.pts;
      c.strokeStyle = hexA(COL.accent, 0.25); c.setLineDash([4, 4]); c.lineWidth = 1;
      var TX = px(log10(run.C)), TY = py(run.proj); c.beginPath(); c.moveTo(TX - 8, TY); c.lineTo(TX + 8, TY); c.moveTo(TX, TY - 8); c.lineTo(TX, TY + 8); c.stroke(); c.setLineDash([]);
      c.lineWidth = 2.2; c.strokeStyle = hung ? COL.danger : COL.accent; c.shadowColor = hung ? COL.danger : COL.accent; c.shadowBlur = reduced() ? 0 : 10;
      c.beginPath(); pts.forEach(function (p, i) { var X = px(log10(p[0] * run.C)), Y = py(p[1]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke(); c.shadowBlur = 0;
      var hp = pts[pts.length - 1], HX = px(log10(Math.max(hp[0], 1e-6) * run.C)), HY = py(hp[1]);
      var pulse = reduced() ? 0 : (Math.sin(now / 180) + 1) * 2;
      c.fillStyle = hung ? COL.danger : COL.white; c.beginPath(); c.arc(HX, HY, 3.5 + pulse * 0.4, 0, 6.283); c.fill();
      c.strokeStyle = hexA(hung ? COL.danger : COL.accent, 0.5); c.beginPath(); c.arc(HX, HY, 7 + pulse * 2, 0, 6.283); c.stroke();
      run.cps.forEach(function (cp) { var X = px(log10(cp.q * run.C)), Y = py(cp.L); c.fillStyle = COL.bg; c.strokeStyle = COL.accent; c.lineWidth = 1.4; c.beginPath(); c.arc(X, Y, 3.2, 0, 6.283); c.fill(); c.stroke(); chartPts.push({ x: X, y: Y, run: run, q: cp.q }); });
      run.spikes.forEach(function (sp) { var X = px(log10(sp.q * run.C)); c.strokeStyle = COL.danger; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X, py(sp.L)); c.lineTo(X, py(sp.L / 1.6)); c.stroke(); });
    }
    c.restore();
    // legend
    var lg = $('chart-legend'), lh = '<span><i style="background:' + COL.accent + '"></i>your runs</span><span><i style="background:' + COL.rb + '"></i>rivals</span><span><i style="border:1.5px solid ' + COL.white + '"></i>GPT-3</span>' + (S.line ? '<span><i style="background:transparent;border-top:1.5px dashed ' + COL.muted + ';border-radius:0;height:0;width:12px"></i>law</span>' : '');
    if (lg.__h !== lh) { lg.__h = lh; lg.innerHTML = lh; }
  }
  var occ = [];
  function hit(b) { for (var i = 0; i < occ.length; i++) { var o = occ[i]; if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) return true; } return false; }
  // draw a label at the first candidate offset that collides with nothing already on the chart; optional labels may be skipped
  function label(c, text, x, y, color, font, cands, optional) {
    c.font = font; var w = c.measureText(text).width, h = 11;
    for (var i = 0; i < cands.length; i++) {
      var dx = cands[i][0], dy = cands[i][1], lx = dx < 0 ? x + dx - w : dx === 0 ? x - w / 2 : x + dx, ly = y + dy;
      var bx = { x: lx - 2, y: ly - h / 2 - 1, w: w + 4, h: h + 2 };
      if (bx.x < PAD.l - 2 || bx.x + bx.w > CW - 2 || bx.y < 2 || bx.y + bx.h > CH - PAD.b + 4) continue;
      if (!hit(bx)) { occ.push(bx); c.fillStyle = color; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, lx, ly); return true; }
    }
    if (!optional) { var d0 = cands[0]; var lx0 = d0[0] < 0 ? x + d0[0] - w : x + d0[0]; c.fillStyle = color; c.textAlign = 'left'; c.fillText(text, lx0, y + d0[1]); }
    return false;
  }
  function vlabel(c, text, x, color, font) { c.save(); c.font = font; c.fillStyle = color; c.translate(x + 4, PAD.t + 4); c.rotate(Math.PI / 2); c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(text, 0, 0); c.restore(); }
  function marker(c, key, x, y, r, col) {
    c.fillStyle = col;
    c.beginPath();
    if (key === 'halcyon') c.rect(x - r, y - r, r * 2, r * 2);
    else if (key === 'kestrel') { c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 1.1, y + r * 0.8); c.lineTo(x - r * 1.1, y + r * 0.8); c.closePath(); }
    else { c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 1.2, y); c.lineTo(x, y + r * 1.2); c.lineTo(x - r * 1.2, y); c.closePath(); }
    c.fill();
  }
  cv.addEventListener('pointerdown', function (e) {
    if (!G || S.phase !== 'play') return;
    var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = e.pointerType === 'touch' ? 28 : 18;
    chartPts.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } });
    if (best) {
      if (best.q >= 1) showSample(best.run.landSample || best.run.lastSample, true);
      else { var res = G.act('sample', { q: best.q }); }
    } else if (S.run && S.run.cps.length) G.act('sample', {});
    dirty = true;
  });

  /* ---------- cluster canvas ---------- */
  var ccv = $('cluster'), ccx = ccv.getContext('2d');
  function clusterCells() {
    var cells = [], k, run = S.run, busyPool = run && !run.hang ? run.pool : null, busyN = run ? G.effGpus(run) : 0, hungPool = run && run.hang ? run.pool : null;
    var serve = S.serving || { n: 0, pool: null };
    function add(n, kind, pool) { var used = 0; for (k = 0; k < n; k++) { var st = kind; if (pool && pool === busyPool && used < busyN) { st = kind + ' busy'; used++; } else if (pool && pool === hungPool && used < run.gpus) { st = kind + ' hung'; used++; } cells.push(st); } return used; }
    var leased = G.leased(), ownedV = S.owned.v - leased;
    var sv = serve.pool === 'office' ? serve.n : 0; add(Math.max(0, ownedV - sv), 'own', 'office'); for (k = 0; k < sv; k++) cells.push('serve');
    for (k = 0; k < leased; k++) cells.push('lease');
    sv = serve.pool === 'a100' ? serve.n : 0; add(Math.max(0, S.owned.a - sv), 'a100', 'a100'); for (k = 0; k < sv; k++) cells.push('serve');
    var live = G.rentedLive(); sv = serve.pool === 'cloud' ? serve.n : 0; add(Math.max(0, live - sv), 'rent', 'cloud'); for (k = 0; k < sv; k++) cells.push('serve');
    S.rentals.forEach(function (r) { if (S.day < r.start) for (k = 0; k < r.n; k++) cells.push('pend'); });
    var ma = G.merAlloc(); sv = serve.pool === 'meridian' ? serve.n : 0; add(Math.max(0, ma - sv), 'mer', 'meridian'); for (k = 0; k < sv; k++) cells.push('serve');
    if (S.mer) for (k = 0; k < S.mer.cards - ma; k++) cells.push('merp');
    S.orders.forEach(function (o) { for (k = 0; k < o.n; k++) cells.push('order'); });
    return cells;
  }
  function drawCluster(now) {
    var r = ccv.getBoundingClientRect(); if (r.width < 10) return;
    var dpr = Math.min(2.5, window.devicePixelRatio || 1), w = r.width, h = r.height;
    if (ccv.width !== Math.round(w * dpr) || ccv.height !== Math.round(h * dpr)) { ccv.width = Math.round(w * dpr); ccv.height = Math.round(h * dpr); }
    var c = ccx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var cells = clusterCells(), n = cells.length, unit = n > 640 ? 8 : 1;
    if (unit > 1) { var g = []; for (var i = 0; i < n; i += unit) g.push(cells[i]); cells = g; n = cells.length; }
    var pad = 6, aw = w - pad * 2, ah = h - pad * 2, s = Math.max(2, Math.floor(Math.sqrt(aw * ah / Math.max(1, n)))), cols, rows;
    while (s > 2) { cols = Math.floor(aw / s); rows = Math.ceil(n / cols); if (rows * s <= ah) break; s--; }
    cols = Math.max(1, Math.floor(aw / s));
    var gap = s > 6 ? 1.5 : s > 3 ? 1 : 0.5, t = now / 1000;
    cells.forEach(function (st, idx) {
      var x = pad + (idx % cols) * s, y = pad + Math.floor(idx / cols) * s, cw = s - gap, busy = st.indexOf('busy') >= 0, hung = st.indexOf('hung') >= 0, kind = st.split(' ')[0];
      var fl = reduced() ? 1 : 0.75 + 0.25 * Math.sin(t * 9 + idx * 1.7) * Math.sin(t * 2.3 + idx * 0.37);
      if (hung) { c.fillStyle = hexA(COL.danger, reduced() ? 0.8 : 0.5 + 0.4 * Math.abs(Math.sin(t * 4))); c.fillRect(x, y, cw, cw); return; }
      if (kind === 'own') { c.fillStyle = busy ? hexA(COL.accent, 0.65 + 0.35 * fl) : hexA(COL.accent, 0.28); c.fillRect(x, y, cw, cw); }
      else if (kind === 'a100') { c.fillStyle = busy ? hexA(COL.white, 0.7 + 0.3 * fl) : hexA(COL.white, 0.35); c.fillRect(x, y, cw, cw); }
      else if (kind === 'rent') { c.strokeStyle = hexA(COL.accent, busy ? 0.9 : 0.5); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, cw - 1); if (busy) { c.fillStyle = hexA(COL.accent, 0.45 * fl); c.fillRect(x + 1, y + 1, cw - 2, cw - 2); } }
      else if (kind === 'mer') { c.strokeStyle = hexA(COL.ra, busy ? 0.9 : 0.55); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, cw - 1); if (busy) { c.fillStyle = hexA(COL.accent, 0.4 * fl); c.fillRect(x + 1, y + 1, cw - 2, cw - 2); } }
      else if (kind === 'serve') { c.fillStyle = hexA(COL.ra, 0.8); c.fillRect(x, y, cw, cw); }
      else if (kind === 'lease') { c.fillStyle = hexA(COL.dim, 0.5); c.fillRect(x, y, cw, cw); }
      else { c.strokeStyle = hexA(COL.dim, 0.6); c.setLineDash([1.5, 1.5]); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, cw - 1); c.setLineDash([]); }
    });
    if (unit > 1) { c.fillStyle = COL.muted; c.font = '10px ' + FONT.num; c.textAlign = 'right'; c.fillText('1 cell = 8 cards', w - 6, h - 4); }
  }

  /* ---------- panels ---------- */
  function m(x) { return G.money(x); }
  function d(day) { return G.fmtShort(day); }
  function render(force) {
    if (!G) return;
    dirty = false;
    if (!phone()) { var bh = $('bar').offsetHeight; if (bh && bh !== lastBarH) { lastBarH = bh; root.style.setProperty('--barH', bh + 'px'); } }
    renderBar(); renderGoal(); renderTrain(); renderCluster(); renderData(); renderTeam(); renderMoney(); renderRivals(); renderNews();
    drawCluster(performance.now()); drawSpark();
    $('waiting').hidden = !(G.blocked() && peek && S.phase === 'play');
    if (!$('waiting').hidden && S.inbox[0]) $('waiting-t').textContent = 'Paused · ' + S.inbox[0].title;
  }
  function setText(id, t) { var el = $(id); if (el.textContent !== t) el.textContent = t; }
  function renderBar() {
    setText('b-dow', G.fmtDow(S.day)); setText('b-date', G.fmtDate(S.day));
    setText('b-hour', S.run && S.run.hang ? 'HUNG ' + S.run.hang.at : '');
    setText('b-sub', G.staff().length === 1 ? 'AI lab · 1 researcher' : 'AI lab · ' + G.staff().length + ' people');
    var b = G.burn(), rev = S.api ? S.api.rev : 0;
    setText('v-burn', m(b)); setText('v-burn-sub', rev ? 'API +' + m(rev) : 'payday ' + d(G.nextFirst(S.day)));
    var rw = G.runway(), endD = S.day + rw * 30.4; setText('v-runway', isFinite(rw) ? (rw >= 100 ? '99+' : rw >= 10 ? Math.floor(rw) : rw.toFixed(1)) + ' mo' : '∞');
    $('v-runway').parentNode.classList.toggle('warn', rw < 3);
    setText('v-runway-sub', !isFinite(rw) ? 'revenue ≥ burn' : endD >= 365 ? 'past 2020' : 'to ' + d(endD));
    setText('v-rep', String(Math.round(S.rep))); setText('v-rep-sub', '/100');
    setText('v-pf', G.pfPerDay().toFixed(G.pfPerDay() >= 10 ? 0 : 2));
    setText('v-cash-sub', 'you own ' + G.pct(S.stake));
  }
  function renderGoal() {
    var rel = Math.max(0, S.relDeadline - Math.floor(S.day)), need = G.relevanceNeed(), pay = G.payroll(), nf = G.nextFirst(S.day), best = G.bestClean(), sc = G.score();
    var thr = [];
    thr.push('<span class="thr ' + (rel <= 30 ? 'hot' : 'ok') + '"><i></i><span class="l">Forgotten in ' + rel + ' d unless you release ≥ ' + G.sci(need) + '</span><span class="s">forgotten in ' + rel + 'd (≥' + G.sci(need) + ')</span></span>');
    thr.push('<span class="thr ' + (S.bank < pay ? 'hot' : '') + '"><i></i><span class="l">Payday ' + d(nf) + ': ' + m(pay) + '</span><span class="s">payday ' + d(nf) + ' ' + m(pay) + '</span></span>');
    thr.push('<span class="thr ' + (S.stake < 0.56 ? 'hot' : '') + '"><i></i><span class="l">' + (S.boardSellDay != null ? 'Board sells on ' + d(S.boardSellDay) : 'Stake ' + G.pct(S.stake) + ' · board sells below 50%') + '</span><span class="s">' + (S.boardSellDay != null ? 'board sells ' + d(S.boardSellDay) : 'stake ' + G.pct(S.stake)) + '</span></span>');
    thr.push('<span class="thr l"><i></i>Best ' + (best ? G.sci(best.C) + ' · GPT-3 ÷ ' + fmtRatio(CFG.gpt3C / best.C) : 'none yet') + '</span>');
    var html = '<span class="g-main"><span class="lbl">GOAL</span><span class="l">Reach <b>31 DEC 2020</b> · beat GPT-3: <b>3.14e23</b> FLOPs, loss 1.76</span><span class="s">Reach <b>31 DEC</b> · beat GPT-3 <b>3.14e23</b></span></span>' + thr.join('') + '<span class="g-score">score ' + sc.total + '</span>';
    morph($('goal'), html);
  }
  function fmtRatio(x) { return x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 1 ? x.toFixed(1) : '<1'; }

  function renderTrain() {
    var run = S.run, chip = $('t-chip');
    if (run && run.hang) { chip.textContent = 'HUNG ' + run.hang.at; chip.className = 'chip hang'; }
    else if (run) { chip.textContent = 'TRAINING ' + Math.floor(run.done / run.C * 100) + '%'; chip.className = 'chip run'; }
    else if (G.blocked() && S.inbox[0].kind === 'land') { chip.textContent = 'LANDED'; chip.className = 'chip run'; }
    else { chip.textContent = 'IDLE'; chip.className = 'chip'; }
    setText('t-sum', S.runs.length ? S.runs.length + ' run' + (S.runs.length === 1 ? '' : 's') + ' · best ' + (G.bestClean() ? G.sci(G.bestClean().C) : '—') : 'no runs yet');
    // runbar
    var html;
    if (run) {
      var q = run.done / run.C, rate = G.runRate(run), left = rate > 0 ? (run.C - run.done) / rate : Infinity, Lnow = run.pts[run.pts.length - 1][1];
      var infra = G.staff().filter(function (p) { return p.role === 'infra'; })[0] || G.staff()[0];
      html = '<div class="rb-info"><span class="loss">loss <b>' + Lnow.toFixed(3) + '</b></span><span><b>' + G.sci(run.C) + '</b> · ' + G.sizeWord(run.N) + ' on ' + G.sizeWord(run.D) + ' tok</span><span><b>' + G.effGpus(run) + '</b> ' + (run.pool === 'a100' ? 'A100' : 'V100') + ' · ' + G.POOLNAME[run.pool] + '</span><span>' + (isFinite(left) ? '<b>' + (left >= 2 ? Math.ceil(left) + ' d' : (left * 24).toFixed(left < 0.1 ? 1 : 0) + ' h') + '</b> left · lands ' + d(S.day + left) : '<b class="bad">stalled: no cards</b>') + '</span><span>' + run.hangs + ' hang' + (run.hangs === 1 ? '' : 's') + (run.nans ? ' · ' + run.nans + ' NaN' : '') + '</span></div>' +
        '<div class="rb-btns"><button type="button" class="btn sm" data-act="sample">Sample</button>' + (run.hang ? '<button type="button" class="btn sm dng" data-act="wake" data-arg="' + (infra ? infra.id : '') + '">Wake ' + esc(infra ? infra.first : 'someone') + '</button>' : '') + '<button type="button" class="btn sm dng' + (armed.abort ? ' armed' : '') + '" data-act="abort">' + (armed.abort ? 'Tap again to stop' : 'Stop') + '</button></div>' +
        '<div class="progress' + (run.hang ? ' hung' : '') + '"><i style="width:' + (q * 100).toFixed(2) + '%"></i></div>';
    } else {
      var last = S.runs[S.runs.length - 1];
      html = '<div class="rb-info">' + (last ? '<span>Last: <b>' + G.sci(last.C) + '</b> landed ' + d(last.landDay) + ' at <b>' + last.loss.toFixed(3) + '</b>' + (last.clean ? '' : ' (past the wall)') + ' · ' + statusWord(last.status) + '</span>' : '<span>The cluster is idle. Design a run below and launch it: the loss will pour across the chart.</span>') + '</span></div><div class="rb-btns"></div><div class="progress"><i style="width:0"></i></div>';
    }
    morph($('runbar'), html);
    renderDesigner();
    // models
    var rows = S.runs.slice().reverse().map(function (r) {
      var acts = '';
      if (r.status === 'private' && S.phase === 'play') acts = '<button type="button" class="btn sm" data-act="pubModel" data-arg="' + r.id + '">Publish</button>' + (G.canShip(r) ? '<button type="button" class="btn sm" data-act="shipModel" data-arg="' + r.id + '">Ship</button>' : '');
      return '<div class="mrow" data-k="m' + r.id + '"><i class="dot' + (r.clean ? '' : ' hollow') + '"></i><div>' + G.sci(r.C) + ' · ' + G.sizeWord(r.N) + ' · L ' + r.loss.toFixed(3) + '<small>' + d(r.landDay) + ' · ' + statusWord(r.status) + (r.caps && r.caps.length ? ' · ' + r.caps.map(function (c) { return c.id; }).join(', ') : '') + (r.scandal ? ' · scandal' : '') + '</small></div><div class="acts">' + acts + '</div></div>';
    });
    setText('models-n', '(' + S.runs.length + ')');
    morph($('models'), rows.length ? rows.join('') : '<div class="empty">Finished runs appear here as dots on the chart.</div>');
  }
  function statusWord(s) { return { landing: 'awaiting your call', private: 'private', published: 'published', shipped: 'shipped (API)', retired: 'API retired', pulled: 'API pulled', retracted: 'retracted', 'pending-publish': 'publishing soon', 'pending-ship': 'shipping soon' }[s] || s || ''; }
  function renderDesigner() {
    var dz = currentDesign();
    if (!design.touched && dz.pool !== design.pool) design.pool = dz.pool;
    // pools
    var ph = G.POOLS.map(function (k) { var n = G.poolCards(k); return '<button type="button" data-act="pool" data-arg="' + k + '" aria-pressed="' + (design.pool === k) + '"' + (n ? '' : ' disabled') + '><b>' + n + '</b><span>' + esc(G.POOLNAME[k]) + '</span></button>'; }).join('');
    morph($('pools'), ph);
    var gs = $('d-gpus'), avail = dz.avail;
    if (+gs.max !== Math.max(1, avail)) gs.max = Math.max(1, avail);
    if (design.gpus > avail || !design.gpusTouched) design.gpus = avail;
    if (+gs.value !== design.gpus) gs.value = design.gpus;
    gs.disabled = avail <= 1; fillRange(gs);
    setText('d-gpus-v', dz.gpus + ' ' + (dz.pool === 'a100' ? 'A100' : 'V100') + (dz.pool === 'a100' ? ' (= ' + dz.gpus * 2.5 + ' V100)' : ''));
    setText('d-params-v', G.sizeWord(design.params) + ' params');
    setText('d-tokens-v', G.sizeWord(design.tokens) + ' tokens');
    morph($('d-params-h'), dz.params > dz.mem ? '<span class="bad">won’t fit: limit ' + G.sizeWord(dz.mem) + ' (' + (G.countRole('systems') ? G.countRole('systems') + ' systems' : 'no systems person') + ')</span>' : 'size limit ' + G.sizeWord(dz.mem) + (G.countRole('systems') ? '' : ' · a systems hire lifts it ×20'));
    morph($('d-tokens-h'), (design.recipe ? 'on the 2020 recipe' : 'recipe for this compute: ' + G.sizeWord(dz.recipeD)) + ' · wall ' + G.sizeWord(dz.wall.lo) + '–' + G.sizeWord(dz.wall.hi));
    var days = dz.days, daysTxt = !isFinite(days) ? '—' : days < 1 ? (days * 24).toFixed(days < 0.1 ? 1 : 0) + ' h' : days < 10 ? days.toFixed(1) + ' d' : Math.round(days) + ' d';
    var calc = '<div class="hero"><span class="lbl">Compute 6·N·D</span><b>' + G.sci(dz.C) + '</b><small>' + (dz.C / 8.64e19).toFixed(dz.C < 8.64e20 ? 2 : 0) + ' PF-days · GPT-3 ÷ ' + fmtRatio(CFG.gpt3C / dz.C) + '</small></div>' +
      '<div class="hero"><span class="lbl">Projected loss</span><b>' + dz.proj.toFixed(3) + '</b><small>±' + Math.round(dz.err * 100) + '% · ' + (S.line ? 'line ' + dz.line.toFixed(3) : 'no published law yet') + '</small></div>' +
      '<div><span class="lbl">Time to train</span><b>' + daysTxt + '</b><small>' + (isFinite(days) ? 'lands ' + (dz.land >= CFG.endDay ? 'after 31 DEC' : d(dz.land)) : 'no cards') + '</small></div>' +
      '<div><span class="lbl">Cost</span><b>' + (dz.pool === 'meridian' ? m(dz.credits) : m(dz.cost)) + '</b><small>' + (dz.pool === 'meridian' ? 'Meridian credits' : dz.pool === 'cloud' ? 'cloud bill while it trains' : 'power and upkeep') + '</small></div>';
    morph($('calc'), calc);
    var wl = dz.warn.slice().sort(function (a, b) { return (b.bad ? 2 : b.ok ? 0 : 1) - (a.bad ? 2 : a.ok ? 0 : 1); }).slice(0, dz.block ? 3 : 4);
    var w = (dz.block ? '<li class="block">' + esc(dz.block) + '</li>' : '') + wl.map(function (x) { return '<li class="' + (x.bad ? 'bad' : x.ok ? 'ok' : '') + '">' + esc(x.t) + '</li>'; }).join('');
    morph($('warns'), w);
    var lb = $('launch'), canGo = !dz.block && S.phase === 'play';
    lb.disabled = !canGo;
    var lt = S.run ? 'Training… one run at a time' : dz.block && S.phase === 'play' ? 'Can’t launch' : 'Launch · ' + daysTxt + ' on ' + dz.gpus + ' cards';
    if (lb.textContent !== lt) lb.textContent = lt;
    var th = [[1e19, '1e19'], [1e20, '1e20'], [1e21, '1e21'], [1e22, '1e22'], [1e23, '1e23'], [CFG.gpt3C, 'GPT-3']].map(function (t) { return '<button type="button" data-act="target" data-arg="' + t[0] + '"' + (t[1] === 'GPT-3' ? ' class="gpt"' : '') + '>' + t[1] + '</button>'; }).join('');
    morph($('targets'), th);
  }

  function renderCluster() {
    var tot = G.physicalCards(), util = G.utilisation(), mk = G.market();
    morph($('c-sum'), '<b>' + tot + '</b> cards · ' + Math.round(util * 100) + '% busy');
    var leg = [['own', COL.accent, 0.5, S.owned.v - G.leased(), 'office V100'], ['a100', COL.white, 0.6, S.owned.a, 'A100'], ['rent', COL.accent, 0, G.rentedLive(), 'rented'], ['mer', COL.ra, 0, G.merAlloc(), 'Meridian'], ['order', COL.dim, 0, S.orders.reduce(function (a, o) { return a + o.n; }, 0), 'on order'], ['serve', COL.ra, 0.8, S.serving ? S.serving.n : 0, 'serving API'], ['lease', COL.dim, 0.5, G.leased(), 'leased out']]
      .filter(function (l) { return l[3] > 0 || l[0] === 'own'; }).map(function (l) { return '<span><i style="' + (l[2] ? 'background:' + hexA(l[1], l[2]) : 'border:1px ' + (l[0] === 'order' ? 'dashed' : 'solid') + ' ' + l[1]) + '"></i>' + l[3] + ' ' + l[4] + '</span>'; }).join('');
    morph($('c-legend'), leg);
    var h = '<div class="sect">GPU market <span>' + (mk.excl ? 'Meridian exclusive: no other cloud' : WORLD.broker) + '</span></div>';
    // rent
    h += '<div class="row" data-k="rent"><div><div class="nm">Rent cloud V100s</div></div><div class="meta"><b>$' + mk.price.toFixed(2) + '</b>/GPU-hr</div>' +
      '<div class="desc">' + (mk.excl ? 'Your Meridian contract forbids other clouds.' : mk.cap ? 'Monthly terms, auto-renew, live tomorrow. The broker can give you ' + mk.free + ' more (you hold ' + mk.held + ').' : 'No new capacity after the API launch.') + '</div>' +
      '<div class="acts">' + mk.blocks.map(function (n) { var cost = n * mk.price * 24 * 30.4; return '<button type="button" class="btn sm" data-act="rent" data-arg="' + n + '"' + (mk.excl || n > mk.free || S.bank < n * mk.price * 24 * 30 ? ' disabled' : '') + '>+' + n + ' · ' + m(cost) + '/mo</button>'; }).join('') + '</div></div>';
    if (mk.spot && !mk.excl) h += '<div class="row" data-k="spot"><div><div class="nm">Cancelled reservation</div></div><div class="meta"><b>$' + mk.spot.price.toFixed(2) + '</b>/GPU-hr</div><div class="desc">' + WORLD.spotBroker + ': ' + mk.spot.n + ' V100s for ' + mk.spot.days + ' days, live tomorrow. ' + m(mk.spot.n * mk.spot.price * 24 * mk.spot.days) + ' in all.</div><div class="acts"><button type="button" class="btn sm" data-act="spot">Take ' + mk.spot.n + ' for ' + mk.spot.days + ' days</button></div></div>';
    S.rentals.forEach(function (r) {
      h += '<div class="row" data-k="r' + r.id + '"><div><div class="nm">' + r.n + ' V100 · $' + r.price.toFixed(2) + (r.spot ? ' · spot' : '') + '</div></div><div class="meta">' + (S.day < r.start ? 'live ' + d(r.start) : r.renew && !S.mer ? 'renews ' + d(r.end) : '<b>ends ' + d(r.end) + '</b>') + '</div>' +
        (r.spot || r.refused || S.mer ? (r.refused ? '<div class="desc">Renewal refused: capacity unavailable.</div>' : '') : '<div class="acts"><button type="button" class="btn sm" data-act="renew" data-arg="' + r.id + '">' + (r.renew ? 'Cancel renewal' : 'Renew') + '</button></div>') + '</div>';
    });
    mk.buys.forEach(function (b) {
      h += '<div class="row" data-k="b' + b.id + '"><div><div class="nm">Buy ' + b.label + '</div></div><div class="meta"><b>' + m(b.price) + '</b> each</div><div class="desc">' + (b.open ? '8 ' + (b.type === 'a100' ? 'A100s (each worth 2.5 V100s)' : 'V100s') + ' to own, ' + Math.round(b.lead / 7) + ' weeks: arrives ' + b.arrive + '. $150 per card per month to run.' : 'Not announced yet.') + '</div>' +
        (b.open ? '<div class="acts">' + [1, 4, 8].map(function (q) { return '<button type="button" class="btn sm" data-act="buy" data-arg="' + b.id + ':' + q + '"' + (S.bank < b.price * q ? ' disabled' : '') + '>×' + q + ' · ' + m(b.price * q) + '</button>'; }).join('') + '</div>' : '') + '</div>';
    });
    if (S.orders.length) h += '<div class="sect">On order</div>' + S.orders.map(function (o) { return '<div class="row" data-k="o' + o.id + '"><div><div class="nm">' + o.n + ' ' + (o.type === 'a100' ? 'A100' : 'V100') + '</div></div><div class="meta">arrives <b>' + d(o.arrive) + '</b></div></div>'; }).join('');
    h += '<div class="row" data-k="lease"><div><div class="nm">Lease idle office cards</div></div><div class="meta"><b>$1.90</b>/GPU-hr</div><div class="desc">' + (S.lease ? S.lease.n + ' leased until ' + d(S.lease.until) + '.' : mk.leaseOk ? 'Half your office V100s (' + mk.leaseN + ') to ' + WORLD.broker + ' for 30 days: +' + m(mk.leaseCash) + ' now.' : 'Needs 16+ office V100s, none training.') + '</div>' + (S.lease ? '' : '<div class="acts"><button type="button" class="btn sm" data-act="lease"' + (mk.leaseOk && mk.leaseN > 0 ? '' : ' disabled') + '>Lease ' + mk.leaseN + ' for 30 days</button></div>') + '</div>';
    morph($('c-market'), h);
  }

  function renderData() {
    var w = G.wallEstimate(), job = S.data.job, dp = G.dataPerson(), dz = currentDesign();
    morph($('d-sum'), 'wall <b>~' + G.sizeWord(w.mid) + '</b> tok ±' + Math.round(w.err * 100) + '%' + (job ? ' · <span class="good">filtering</span>' : ''));
    var scale = Math.max(CFG.rawTokens, w.hi * 1.1, dz.tokens * 1.1), pctOf = function (x) { return clamp(x / scale * 100, 0, 100).toFixed(1); };
    var last = sample, read = '';
    if (last && dp) read = last.crawl ? dp.first + ': “That last sample is pure boilerplate. We’re past the wall.”' : last.fray >= 3 ? dp.first + ': “SEO spam in the middle of sentences. We’re close to the wall.”' : last.fray >= 1 ? dp.first + ': “Reads fine to me.”' : '';
    var jobH = job ? '<div class="row" data-k="job"><div><div class="nm">' + esc((G.person(job.by) || { first: 'Data' }).first) + ' is filtering</div></div><div class="meta"><b>' + Math.max(0, job.until - Math.floor(S.day)) + ' d</b> left</div><div class="desc">Done ' + d(job.until) + ': clean tokens ×' + CFG.filter.mult + ' (the wall moves about 10× out in compute).</div></div>'
      : '<div class="row" data-k="nojob"><div class="desc" style="grid-column:1/-1">' + (dp ? 'Filter job: ' + dp.first + ' dedups and filters the crawl. ' + m(G.filterCost()) + ', ' + G.filterDays() + ' days, clean tokens ×' + CFG.filter.mult + '. Each job costs twice the last.' : 'You need a data person to run filter jobs.') + '</div><div class="acts"><button type="button" class="btn sm pri" data-act="filter"' + (dp && S.bank >= G.filterCost() && S.phase === 'play' ? '' : ' disabled') + '>Run filter job · ' + m(G.filterCost()) + '</button></div></div>';
    var h = '<div class="bigfig">~' + G.sizeWord(w.mid) + ' <small>tokens ±' + Math.round(w.err * 100) + '%</small></div><div class="bigfig-sub">the clean-data wall: train on more and the words turn to web junk</div>' +
      '<div class="bar2" title="raw crawl vs clean-data wall"><i class="clean" style="width:' + pctOf(w.lo) + '%"></i><i class="unc" style="left:' + pctOf(w.lo) + '%;width:' + (pctOf(w.hi) - pctOf(w.lo)).toFixed(1) + '%"></i><i class="mark' + (dz.tokens > w.lo ? ' bad' : '') + '" style="left:' + pctOf(dz.tokens) + '%"></i></div>' +
      (read ? '<p class="desc" style="font-size:12px;color:var(--text);margin:4px 0 2px">' + esc(read) + '</p>' : '') + jobH +
      '<div class="kv" style="margin-top:6px"><span>Raw crawl held</span><b>' + G.sizeWord(CFG.rawTokens) + ' tok</b><span>Wall range</span><b>' + G.sizeWord(w.lo) + '–' + G.sizeWord(w.hi) + '</b><span>Next run’s tokens (white mark)</span><b' + (dz.tokens > w.lo ? ' class="bad"' : '') + '>' + G.sizeWord(dz.tokens) + '</b><span>Filter jobs done</span><b>' + S.data.filters + '</b></div>';
    morph($('d-body'), h);
  }

  function renderTeam() {
    var st = G.staff(), sal = st.reduce(function (a, p) { return a + p.salary; }, 0);
    morph($('tm-sum'), '<b>' + st.length + '</b> people · ' + m(sal) + '/mo' + (S.board.length ? ' · <span class="good">' + S.board.length + ' on the market</span>' : ''));
    var h = '<div class="sect">Your people</div>';
    h += st.map(function (p) {
      var low = p.mood < 30;
      return '<div class="row" data-k="p' + p.id + '"><div><div class="nm">' + esc(p.name) + ' <span class="rl">' + esc(WORLD.roleNames[p.role]) + '</span>' + skillDots(p.skill) + '</div></div><div class="meta"><b>' + m(p.salary) + '</b>/mo<br><span class="mood' + (low ? ' low' : '') + '" title="morale ' + Math.round(p.mood) + '"><i style="width:' + Math.round(p.mood) + '%"></i></span> ' + Math.round(p.mood) + '</div>' +
        '<div class="desc"><b style="color:var(--text);font-weight:500">' + esc(assignment(p)) + '.</b> ' + esc(p.does) + '</div>' +
        (S.phase === 'play' ? '<div class="acts"><button type="button" class="btn sm" data-act="raisePay" data-arg="' + p.id + '">Raise +10% · morale +15</button>' + (st.length > 1 ? '<button type="button" class="btn sm dng' + (armed['fire' + p.id] ? ' armed' : '') + '" data-act="fire" data-arg="' + p.id + '">' + (armed['fire' + p.id] ? 'Tap again: let go' : 'Let go') + '</button>' : '') + '</div>' : '') + '</div>';
    }).join('');
    h += '<div class="sect">Hiring board <span>' + (S.board.length ? 'rivals sign them when time runs out' : '') + '</span></div>';
    h += S.board.length ? S.board.map(function (b) {
      var left = b.until - Math.floor(S.day), rv = S.rivals.find(function (r) { return r.key === b.rival; });
      return '<div class="row" data-k="c' + b.id + '"><div><div class="nm">' + esc(b.name) + ' <span class="rl">' + esc(WORLD.roleNames[b.role]) + '</span>' + skillDots(b.skill) + '</div></div><div class="meta">asks <b>' + m(b.ask) + '</b>/mo</div>' +
        '<div class="desc"><i>“' + esc(b.pitch) + '”</i><br>' + esc(b.does) + '</div><div class="acts"><button type="button" class="btn sm pri" data-act="hire" data-arg="' + b.id + '"' + (S.phase === 'play' ? '' : ' disabled') + '>Hire · +' + m(b.ask) + '/mo</button><span class="timer' + (left <= 7 ? ' hot' : '') + '">' + (rv ? rv.name : 'a rival') + ' signs ' + b.first + ' in ' + left + ' d</span></div></div>';
    }).join('') : '<div class="empty">Nobody on the market right now. New people appear through the year.</div>';
    var gone = S.team.filter(function (p) { return p.gone; });
    if (gone.length) h += '<div class="sect">Left</div>' + gone.map(function (p) { return '<div class="row" data-k="g' + p.id + '"><div class="desc" style="grid-column:1/-1">' + esc(p.name) + ', ' + d(p.goneDay) + ': ' + esc(p.why) + '</div></div>'; }).join('');
    morph($('tm-body'), h);
  }
  function skillDots(n) { var h = '<span class="skill" title="skill ' + n + ' of 5" aria-label="skill ' + n + ' of 5">'; for (var i = 1; i <= 5; i++) h += '<i' + (i <= n ? ' class="on"' : '') + '></i>'; return h + '</span>'; }
  function assignment(p) {
    var run = S.run;
    if (S.data.job && S.data.job.by === p.id) return 'Filter job, ' + Math.max(0, S.data.job.until - Math.floor(S.day)) + ' days left';
    if (p.role === 'infra') { if (p.id === 'tom' && S.day < S.tomOffUntil) return 'On a week off'; return run && run.hang ? 'Restarting the run' : run ? 'On call for the run' : 'Racking cards'; }
    if (p.role === 'systems') return run && run.N > CFG.memBase ? 'Sharding the ' + G.sizeWord(run.N) + ' model' : 'Tuning kernels';
    if (p.role === 'data') return run ? 'Reading the samples' : 'Cleaning the crawl';
    if (p.role === 'scaling') return 'Fitting the line';
    if (p.role === 'evals') return S.redteam ? 'Red-teaming a release' : run ? 'Building evals' : 'Writing test sets';
    if (p.role === 'optimization') return G.sunheeLive(S.day) ? 'Every run lands 2.5% lower' : 'New schedule live ' + d(p.joined + CFG.sunheeDelay);
    return 'Working';
  }

  function renderMoney() {
    var bp = G.burnParts(), b = G.burn(), rw = G.runway();
    morph($('m-sum'), '<b>' + m(S.bank) + '</b> · ' + (isFinite(rw) ? rw.toFixed(rw >= 10 ? 0 : 1) + ' mo' : '∞') + (G.rounds().some(function (r) { return r.ready; }) ? ' · <span class="good">round ready</span>' : '') + (S.merOffer ? ' · <span class="good">Meridian offer</span>' : ''));
    var parts = [['salaries', bp.salaries, COL.accent], ['cloud', bp.cloud, COL.white], ['office + racks', bp.office + bp.upkeep, COL.rb], ['queue priority', bp.priority, COL.danger]].filter(function (x) { return x[1] > 0; });
    var h = '<div class="kv2"><div><span class="lbl">Cash</span><b class="good">' + m(S.bank) + '</b></div><div><span class="lbl">Burn / month</span><b>' + m(b) + '</b></div><div><span class="lbl">Payroll ' + d(G.nextFirst(S.day)) + '</span><b' + (S.bank < G.payroll() ? ' class="bad"' : '') + '>' + m(G.payroll()) + '</b></div><div><span class="lbl">' + (bp.api ? 'API revenue / month' : 'Revenue so far') + '</span><b class="good">' + (bp.api ? '+' + m(bp.api) : m(S.revenueTotal + S.leaseTotal)) + '</b></div></div>' +
      '<div class="stack">' + parts.map(function (x) { return '<i style="width:' + (x[1] / b * 100).toFixed(1) + '%;background:' + x[2] + '"></i>'; }).join('') + '</div><div class="legend-s">' + parts.map(function (x) { return '<span><i style="background:' + x[2] + '"></i>' + x[0] + ' ' + m(x[1]) + '</span>'; }).join('') + '</div>';
    h += '<div class="sect">Ownership <span>post-money ' + m(S.post) + '</span></div><div class="stakebar"><i style="width:' + (S.stake * 100).toFixed(1) + '%"></i><u></u></div><div class="legend-s"><span>You own <b style="color:var(--text)">' + G.pct(S.stake) + '</b> · below 50% the board sells</span></div>';
    h += '<div class="sect">Fundraising <span>' + (G.marketClosed() ? 'market closed until 15 JUN' : S.gpt3 ? 'post-GPT-3 boom' : 'market open') + '</span></div>';
    G.rounds().forEach(function (r) {
      h += '<div class="round' + (r.ready ? ' ready' : '') + (r.done ? ' done' : '') + '" data-k="rd' + r.id + '"><h4>' + r.title + ' · ' + esc(r.name) + '<span>' + (r.done ? 'closed · ' : '') + m(r.cash) + ' at ' + m(r.post) + '</span></h4>' +
        (r.done ? '' : '<ul>' + r.needs.map(function (n) { return '<li class="' + (n.ok ? 'ok' : '') + '">' + esc(n.t) + '</li>'; }).join('') + '</ul>' +
        '<div class="acts"><small>you’d own ' + G.pct(r.stakeAfter) + '</small><button type="button" class="btn sm' + (r.ready ? ' pri' : '') + '" data-act="raise" data-arg="' + r.id + '"' + (r.ready && S.phase === 'play' ? '' : ' disabled') + '>Raise ' + m(r.cash) + '</button></div>') + '</div>';
    });
    h += '<div class="sect">Meridian cloud <span>fictional cloud giant</span></div>';
    if (S.mer) {
      h += '<div class="round ready" data-k="mer"><h4>Signed · ' + S.mer.cards + ' V100s<span>' + m(S.mer.credits) + ' credits</span></h4><ul><li class="ok">' + (S.day < S.mer.live ? 'Live ' + d(S.mer.live) : 'Live: ' + S.mer.alloc + ' of ' + S.mer.cards + ' cards this month') + '</li><li class="ok">Exclusive: no other cloud. First look: releases wait 7 days. No open weights.</li><li>' + (S.day < CFG.meridian.queueFrom ? 'From 11 JUN the queue cuts your cards on the 1st if your best clean dot is more than 1.5× behind the frontier.' : 'Queue: full within 1.5× of the frontier, half within 10×, a quarter beyond.') + '</li></ul>' +
        '<div class="acts"><small>' + (S.priority ? 'front of the queue: ' + m(S.mer.cards * CFG.meridian.priorityPerCard) + '/mo' : 'stay at the front: ' + m(S.mer.cards * CFG.meridian.priorityPerCard) + '/mo') + '</small><button type="button" class="btn sm" data-act="priority"' + (S.day >= CFG.meridian.queueFrom - 30 ? '' : ' disabled') + '>' + (S.priority ? 'Stop paying' : 'Pay for priority') + '</button></div></div>';
    } else if (S.merOffer) {
      var o = S.merOffer;
      h += '<div class="round ready" data-k="mero"><h4>Offer · ' + o.cards + ' V100s<span>' + (o.stake ? 'for ' + Math.round(o.stake * 100) + '% of FRONTIER' : m(o.credits) + ' credits') + '</span></h4><ul><li>Live ' + Math.round(CFG.meridian.lead / 7) + ' weeks after signing.</li><li>Our cloud only: your rentals end at their term.</li><li>Meridian sees every checkpoint first: releases wait 7 days. No open weights.</li><li>From 11 JUN a queue cuts your cards if you fall behind the frontier.</li></ul><div class="acts"><small>' + (o.kind === 'first' ? 'open until 15 JUN' : 'you’d own ' + G.pct(S.stake * (1 - o.stake))) + '</small><button type="button" class="btn sm pri" data-act="meridian"' + (S.phase === 'play' ? '' : ' disabled') + '>Sign with Meridian</button></div></div>';
    } else {
      h += '<div class="round" data-k="merl"><ul><li class="' + (G.farthestClean() >= CFG.meridian.needC ? 'ok' : '') + '">A clean dot ≥ 1e21 FLOPs (best: ' + (G.farthestClean() ? G.sci(G.farthestClean()) : 'none') + ')</li><li class="' + (S.day >= CFG.meridian.fromDay ? 'ok' : '') + '">From 1 APR</li></ul><div class="acts"><small>' + (S.merPassed ? (S.merSecondOffered ? 'You passed twice.' : 'Back after 15 JUN with a smaller offer, for equity.') : '$50M of credits: 1,024 V100s for exclusivity') + '</small></div></div>';
    }
    morph($('m-body'), h);
  }
  var sparkCv = $('m-spark'), sparkCx = sparkCv.getContext('2d');
  function drawSpark() {
    var r = sparkCv.getBoundingClientRect(); if (r.width < 10) return;
    var dpr = Math.min(2.5, window.devicePixelRatio || 1), w = r.width, h = r.height;
    if (sparkCv.width !== Math.round(w * dpr)) { sparkCv.width = Math.round(w * dpr); sparkCv.height = Math.round(h * dpr); }
    var c = sparkCx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var a = S.hist.bank.concat([S.bank]); if (a.length < 2) { c.fillStyle = COL.dim; c.font = '10px ' + FONT.num; c.fillText('cash, day by day', 4, h / 2); return; }
    var mx = Math.max.apply(null, a), mn = Math.min(0, Math.min.apply(null, a)), X = function (i) { return i / Math.max(30, a.length - 1) * w; }, Y = function (v) { return h - 3 - (v - mn) / Math.max(1, mx - mn) * (h - 18); };
    c.beginPath(); a.forEach(function (v, i) { if (i) c.lineTo(X(i), Y(v)); else c.moveTo(X(i), Y(v)); });
    c.strokeStyle = COL.accent; c.lineWidth = 1.5; c.stroke();
    c.lineTo(X(a.length - 1), h); c.lineTo(0, h); c.closePath(); c.fillStyle = hexA(COL.accent, 0.08); c.fill();
    if (mn < 0) { c.strokeStyle = hexA(COL.danger, 0.6); c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.stroke(); }
    c.fillStyle = COL.muted; c.font = '10px ' + FONT.num; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillText('cash since 1 JAN · peak ' + m(mx), 2, 9);
  }

  function renderRivals() {
    var fr = G.frontier();
    morph($('r-sum'), 'frontier <b>' + G.sci(fr) + '</b>');
    var h = '<p class="desc" style="font-size:11px;color:var(--muted);margin:0 0 4px">The frontier is the biggest published result' + (S.gpt3 ? ', GPT-3 included' : '') + ': ' + G.sci(fr) + ' FLOPs. You stay relevant by releasing ≥ 1% of it: ' + G.sci(G.relevanceNeed()) + '.</p>';
    h += S.rivals.map(function (rv) {
      var lp = rv.pubs[rv.pubs.length - 1], col = RIVCOL[rv.key];
      return '<div class="rv" data-k="rv' + rv.key + '"><svg class="mk" viewBox="0 0 10 10" aria-hidden="true">' + (rv.key === 'halcyon' ? '<rect x="1" y="1" width="8" height="8" fill="' + col + '"/>' : rv.key === 'kestrel' ? '<path d="M5 0.5L9.5 9H0.5z" fill="' + col + '"/>' : '<path d="M5 0L10 5L5 10L0 5z" fill="' + col + '"/>') + '</svg><div class="nm">' + rv.name + '<small>' + esc(rv.blurb) + '</small></div><div class="meta">~<b>' + G.rivalGpus(rv, S.day).toLocaleString('en-US') + '</b> GPUs</div>' +
        '<div class="desc">Latest: <b style="color:var(--text)">' + G.sci(lp.C) + '</b> · loss ' + lp.L.toFixed(2) + (lp.day >= 0 ? ' (' + d(lp.day) + ')' : ' (2019)') + ' · ' + esc(rv.last) + (rv.hired.length ? ' · signed ' + esc(rv.hired.join(', ')) : '') + '</div></div>';
    }).join('');
    if (S.gpt3) h += '<div class="rv" data-k="gpt3"><svg class="mk" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="' + COL.white + '"/></svg><div class="nm">GPT-3<small>real, published 28 MAY</small></div><div class="meta"><b>3.14e23</b></div><div class="desc">175B parameters on 300B tokens. The frontier you are measured against.</div></div>';
    morph($('r-body'), h);
  }

  function renderNews() {
    var pend = S.inbox.length;
    morph($('n-sum'), (pend ? '<span class="good">' + pend + ' decision' + (pend === 1 ? '' : 's') + ' waiting</span> · ' : '') + (S.news[0] ? d(S.news[0].day) : ''));
    $('j-badge').textContent = pend ? String(pend) : '';
    var h = '';
    if (pend) h += S.inbox.map(function (it) { return '<div class="inbox-item" data-k="i' + it.id + '"><b>' + esc(it.title) + '</b><small>' + esc(it.from) + ' · the clock is paused</small><button type="button" class="btn sm pri" data-act="openDecision">Decide</button></div>'; }).join('');
    if (S.answered.length) h += '<div class="sect">Recent decisions</div><ul class="news">' + S.answered.slice(0, 3).map(function (a) { var o = a.options.find(function (x) { return x.key === a.choice; }); return '<li data-k="a' + a.id + '"><span class="d">' + d(a.answeredDay) + '</span><span class="t">' + esc(a.title) + ': <b>' + esc(o ? o.label : a.choice) + '</b></span></li>'; }).join('') + '</ul>';
    h += '<div class="sect">News <span>real 2020 history in white</span></div><ul class="news">' + S.news.slice(0, 50).map(function (n, i) {
      var k = n.kind === 'world' ? 'WORLD' : n.kind === 'rival' ? 'RIVAL' : n.kind === 'money' ? 'MONEY' : n.kind === 'team' ? 'TEAM' : 'LAB';
      return '<li class="' + n.kind + (n.good ? ' good' : '') + (n.bad ? ' bad' : '') + '" data-k="n' + (S.news.length - i) + '"><span class="d">' + d(n.day) + '</span><span class="t"><span class="k">' + k + '</span>' + esc(n.text) + '</span></li>';
    }).join('') + '</ul>';
    morph($('n-body'), h);
  }

  /* ---------- decision sheet ---------- */
  function openNextDecision() {
    if (!G || !G.blocked() || S.phase !== 'play') { closeSheet(); return; }
    var it = S.inbox[0]; peek = false; sheetItem = it;
    $('sh-from').textContent = it.from + ' · ' + G.fmtDate(it.day);
    $('sh-title').textContent = it.title;
    var body = '';
    if (it.kind === 'land') {
      var run = S.runs.find(function (r) { return r.id === it.runId; }), smp = run && run.landSample;
      if (smp) body += '<div class="voice' + (smp.crawl ? ' crawl' : '') + '">' + esc(smp.text) + '</div>';
      if (run && run.caps && run.caps.length) body += '<div class="caps">' + run.caps.map(function (c) { return '<span class="' + (c.leaked && c.caught ? 'leak' : it.firsts.indexOf(c.id) >= 0 ? 'new' : '') + '">' + (it.firsts.indexOf(c.id) >= 0 ? 'new: ' : '') + c.id + (c.leaked && c.caught ? ' · leaked' : '') + '</span>'; }).join('') + '</div>';
    }
    body += '<p>' + esc(it.body) + '</p>';
    $('sh-body').innerHTML = body;
    $('sh-opts').innerHTML = it.options.map(function (o) { return '<button type="button" class="opt' + (o.danger ? ' dng' : '') + '" data-choice="' + o.key + '"' + (o.disabled ? ' disabled' : '') + '><b>' + esc(o.label) + '</b><small>' + esc(o.note || '') + '</small></button>'; }).join('');
    $('sheet').hidden = false; $('sheet-scrim').hidden = false; $('waiting').hidden = true;
    $('sheet').scrollTop = 0;
    var first = $('sh-opts').querySelector('button:not([disabled])'); if (first && !phone()) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 30);
    dirty = true;
  }
  function closeSheet() { $('sheet').hidden = true; $('sheet-scrim').hidden = true; sheetItem = null; }
  $('sh-opts').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-choice]'); if (!b || b.disabled || !sheetItem) return;
    var res = G.act('answer', { id: sheetItem.id, choice: b.dataset.choice });
    AU.click(); closeSheet(); dirty = true;
    if (res.ok && G.blocked()) setTimeout(openNextDecision, 220);
  });
  $('sh-peek').addEventListener('click', function () { peek = true; closeSheet(); $('waiting').hidden = false; dirty = true; render(); });
  $('waiting-open').addEventListener('click', openNextDecision);
  $('sheet-scrim').addEventListener('click', function () { peek = true; closeSheet(); $('waiting').hidden = false; dirty = true; render(); });

  /* ---------- end ---------- */
  function showEnd() {
    var en = S.ended; if (!en) return;
    root.classList.add('is-over'); closeSheet(); $('waiting').hidden = true;
    var good = en.kind === 'survived';
    AU.end(good);
    $('end-kick').textContent = G.fmtDate(Math.min(365, en.day)) + ' · ' + (good ? 'THE YEAR IS OVER' : 'THE YEAR ENDS EARLY');
    $('end-title').textContent = en.head.toUpperCase();
    $('end-sub').textContent = en.sub;
    $('end-lines').innerHTML = en.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
    var sc = en.score;
    $('end-score').innerHTML = '<span>Best clean model vs GPT-3' + (sc.bestC ? ' (' + G.sci(sc.bestC) + ')' : '') + '</span><b>' + sc.model + '</b>' + (sc.miracle ? '<span>The miracle: GPT-3 in 2020</span><b>' + sc.miracle + '</b>' : '') + '<span>Reputation (' + Math.round(S.rep) + ' × 3)</span><b>' + sc.rep + '</b><span>Revenue (' + m(S.revenueTotal) + ' ÷ $10K)</span><b>' + sc.rev + '</b><span>People kept (' + G.staff().length + ' × 15)</span><b>' + sc.people + '</b><span class="tot">' + (good ? 'Score' : 'Score (not a win: the lab didn’t reach 31 DEC)') + '</span><b class="tot">' + sc.total + '</b>';
    $('end').querySelector('.card').className = 'card end-card ' + (good ? 'good' : 'bad');
    $('end').hidden = false;
    var best = +(store('frontier.dash.b.best') || 0); if (good && sc.total > best) store('frontier.dash.b.best', String(sc.total));
    setTimeout(function () { try { $('end-again').focus({ preventScroll: true }); } catch (e) {} }, 50);
  }
  $('end-again').addEventListener('click', function () { newGame(Math.floor(Math.random() * 1e9)); startGame(); });

  /* ---------- input ---------- */
  $('in-go').addEventListener('click', startGame);
  Array.prototype.forEach.call(document.querySelectorAll('.speed button'), function (b) { b.addEventListener('click', function () { AU.unlock(); setSpeed(+b.dataset.speed); }); });
  var muted = store('frontier.dash.b.muted') === '1';
  function setMuted(v) { muted = v; AU.setMuted(v); $('b-mute').setAttribute('aria-pressed', String(v)); $('b-mute').title = v ? 'Sound off (M)' : 'Sound on (M)'; store('frontier.dash.b.muted', v ? '1' : '0'); }
  $('b-mute').addEventListener('click', function () { AU.unlock(); setMuted(!muted); });
  setMuted(muted);
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.nodeName) && e.key !== ' ') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' || e.code === 'Space') { if (e.target && e.target.nodeName === 'BUTTON' && !$('sheet').hidden) return; e.preventDefault(); if (!started) { startGame(); return; } setSpeed(paused ? speed : 0); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(2); else if (e.key === '3' || e.key === '4') setSpeed(4);
    else if (e.key === 'm' || e.key === 'M') setMuted(!muted);
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (!paused && started) { setSpeed(0); } AU.suspend(true); } else AU.suspend(false); });
  // panel toggles (phone)
  Array.prototype.forEach.call(document.querySelectorAll('.panel > .ph'), function (h) {
    if (h.classList.contains('ph-static')) return;
    h.addEventListener('click', function () { if (!phone()) return; var p = h.parentNode; var on = !p.classList.contains('open'); p.classList.toggle('open', on); h.setAttribute('aria-expanded', String(on)); dirty = true; render(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.jump button'), function (b) {
    b.addEventListener('click', function () { var p = $(b.dataset.jump); if (!p) return; if (!p.classList.contains('p-train')) { p.classList.add('open'); var hh = p.querySelector('.ph'); if (hh) hh.setAttribute('aria-expanded', 'true'); } render(); p.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); });
  });
  // sliders
  $('d-params').addEventListener('input', function (e) { var N = Math.pow(10, PMIN + (PMAX - PMIN) * (+e.target.value) / 1000); design.params = N; if (design.recipe) { design.tokens = recipeDForN(N); syncSliders(); } fillRange(e.target); dirty = true; });
  $('d-tokens').addEventListener('input', function (e) { design.tokens = Math.pow(10, TMIN + (TMAX - TMIN) * (+e.target.value) / 1000); design.recipe = false; fillRange(e.target); dirty = true; });
  $('d-gpus').addEventListener('input', function (e) { design.gpus = +e.target.value; design.gpusTouched = true; fillRange(e.target); dirty = true; });
  $('launch').addEventListener('click', function () { doLaunch(); });
  function doLaunch() {
    AU.unlock();
    var res = G.act('launch', { params: design.params, tokens: design.tokens, pool: design.pool, gpus: design.gpus });
    if (!res.ok) { showFlash(String(res.why || 'Can’t launch').toUpperCase(), false, 2); return res; }
    design.gpusTouched = false; dirty = true; render(); return res;
  }
  // delegated buttons inside panels
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]'); if (!b || b.disabled || !G) return;
    var act = b.dataset.act, arg = b.dataset.arg, res = null;
    AU.unlock(); AU.click();
    switch (act) {
      case 'pool': design.pool = arg; design.touched = true; design.gpusTouched = false; break;
      case 'target': setTarget(+arg); break;
      case 'sample': res = G.act('sample', {}); break;
      case 'wake': res = G.act('wake', { id: arg }); break;
      case 'abort': if (!armed.abort) { armed.abort = true; setTimeout(function () { armed.abort = false; dirty = true; }, 3000); } else { armed.abort = false; res = G.act('abort'); } break;
      case 'fire': if (!armed['fire' + arg]) { armed['fire' + arg] = true; setTimeout(function () { armed['fire' + arg] = false; dirty = true; }, 3000); } else { armed['fire' + arg] = false; res = G.act('fire', { id: arg }); } break;
      case 'raisePay': res = G.act('raisePay', { id: arg }); break;
      case 'hire': res = G.act('hire', { id: arg }); break;
      case 'rent': res = G.act('rent', { gpus: +arg }); break;
      case 'spot': res = G.act('rent', { spot: true }); break;
      case 'renew': res = G.act('renew', { id: +arg }); break;
      case 'buy': { var p = arg.split(':'); res = G.act('buy', { item: p[0], qty: +p[1] }); break; }
      case 'lease': res = G.act('lease'); break;
      case 'filter': res = G.act('filter'); break;
      case 'raise': res = G.act('raise', { round: arg }); break;
      case 'meridian': res = G.act('meridian'); break;
      case 'priority': res = G.act('priority'); break;
      case 'pubModel': res = G.act('publish', { id: +arg }); break;
      case 'shipModel': res = G.act('ship', { id: +arg }); break;
      case 'openDecision': openNextDecision(); break;
    }
    if (res && !res.ok && res.why) showFlash(String(res.why).toUpperCase(), false, 2);
    dirty = true; render();
  });
  window.addEventListener('resize', function () { dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dirty = true; });

  /* ---------- test hook for playtesters and bots ---------- */
  window.__frontier = {
    state: function () {
      var r = S.run, ls = sample;
      return {
        seed: S.seed, phase: S.phase, day: Math.floor(S.day), dayExact: S.day, date: G.fmtDate(S.day), bank: Math.round(S.bank), burn: Math.round(G.burn()), runway: G.runway(), rep: S.rep, stake: S.stake, post: S.post,
        pf: G.pfPerDay(), cards: { owned: S.owned.v, a100: S.owned.a, rented: G.rentedLive(), meridian: G.merAlloc(), orders: S.orders.map(function (o) { return { type: o.type, n: o.n, arrive: o.arrive }; }), pools: G.POOLS.reduce(function (a, k) { a[k] = G.poolCards(k); return a; }, {}) },
        team: G.staff().map(function (p) { return { id: p.id, role: p.role, salary: p.salary, mood: Math.round(p.mood) }; }), board: S.board.map(function (b) { return { id: b.id, role: b.role, ask: b.ask, until: b.until }; }),
        run: r ? { C: r.C, N: r.N, D: r.D, pool: r.pool, gpus: r.gpus, q: r.done / r.C, hung: !!r.hang, hangs: r.hangs, nans: r.nans, clean: r.clean, r: r.r } : null,
        runs: S.runs.map(function (x) { return { id: x.id, C: x.C, loss: x.loss, clean: x.clean, status: x.status, caps: (x.caps || []).map(function (c) { return c.id; }), landDay: x.landDay }; }),
        lastSample: ls ? { text: ls.text, tier: ls.tier, fray: ls.fray, crawl: ls.crawl, q: ls.q, loss: ls.loss } : null,
        wall: G.wallEstimate(), wallTrue: G.wallTokens(), filters: S.data.filters, filterJob: S.data.job,
        inbox: S.inbox.map(function (i) { return { id: i.id, kind: i.kind, title: i.title, options: i.options.map(function (o) { return o.disabled ? '(' + o.key + ')' : o.key; }) }; }),
        rounds: G.rounds().map(function (x) { return { id: x.id, ready: x.ready, done: x.done }; }), merOffer: !!S.merOffer, mer: S.mer ? { cards: S.mer.cards, alloc: S.mer.alloc, live: S.mer.live } : null,
        market: G.market(), frontier: G.frontier(), relDeadline: S.relDeadline, relNeed: G.relevanceNeed(), gpt3: S.gpt3, line: S.line, best: G.bestClean() ? G.bestClean().C : 0,
        score: G.score(), ended: S.ended ? { kind: S.ended.kind, day: S.ended.day, lines: S.ended.lines, score: S.ended.score.total } : null,
        speed: paused ? 0 : speed, paused: paused, blocked: G.blocked(), sheetOpen: !$('sheet').hidden, news: S.news.slice(0, 5).map(function (n) { return n.text; }), stats: S.stats, log: S.log.slice(-12)
      };
    },
    act: function (name, payload) {
      payload = payload || {};
      var res;
      if (name === 'speed') { setSpeed(+payload.x); return { ok: true }; }
      if (name === 'pause') { setSpeed(0); return { ok: true }; }
      if (name === 'resume') { setSpeed(speed || 1); return { ok: true }; }
      if (name === 'start') { startGame(); return { ok: true }; }
      if (name === 'restart') { newGame(payload.seed != null ? payload.seed : Math.floor(Math.random() * 1e9)); return { ok: true }; }
      if (name === 'design') { if (payload.C) setTarget(payload.C); if (payload.params) design.params = payload.params; if (payload.tokens) { design.tokens = payload.tokens; design.recipe = false; } if (payload.pool) { design.pool = payload.pool; design.touched = true; } syncSliders(); dirty = true; return { ok: true, design: currentDesign() }; }
      if (name === 'launch') { if (payload.C && !payload.params) { var sp = G.recipeSplit(payload.C); payload.params = sp.N; payload.tokens = sp.D; } res = G.act('launch', payload); }
      else res = G.act(name, payload);
      if (name === 'answer' || name === 'publish' || name === 'ship' || name === 'keep') { closeSheet(); if (G.blocked()) setTimeout(openNextDecision, 30); }
      dirty = true; return res;
    },
    speed: function (n) { botMult = Math.max(0.1, +n || 1); return botMult; },
    design: function (p) { return G.design(p); }
  };

  /* ---------- go ---------- */
  newGame();
  setSpeed(0);
  if (!phone()) setTimeout(function () { try { $('in-go').focus({ preventScroll: true }); } catch (e) {} }, 60);
  requestAnimationFrame(frame);
})();
