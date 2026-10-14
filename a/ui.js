/* FRONTIER control room, build A: the screen. Reads the engine, draws the panels and the hero chart,
   turns taps and clicks into engine actions. No game rule lives here; every number shown comes from the engine. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG, W = window.FRONTIER_WORLD, CORPUS = window.FRONTIER_CORPUS, FE = window.FrontierEngine, AU = window.FrontierAudio;
  var $ = function (id) { return document.getElementById(id); };
  var fmtMoney = FE.fmtMoney, sci = FE.sci, bigNum = FE.bigNum, pct = FE.pct, log10 = FE.log10, clamp = FE.clamp;
  var root = $('fx');
  var E = null, S = null;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function laptop() { return window.innerWidth >= 1100 && window.innerHeight >= 640; }
  function wide() { return window.innerWidth >= 760; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  var ui = {
    speed: 0, lastSpeed: 1, everStarted: false, botMult: 1, held: false,
    des: { pool: 'office', gpus: 8, gpusMax: true, N: 1e9, D: 2e10, recipe: true },
    rentN: 64, buy: { dgx1: 1, dgxa100: 8 }, feed: 'all', modalId: null, endShown: false, endClosed: false,
    lastFrame: 0, lastPanels: 0, cashShown: null, stopArm: null, dirty: true, seed: null
  };

  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }
  function newGame(seed) {
    if (seed == null) seed = Math.floor(Math.random() * 1e9) + 1;
    ui.seed = seed;
    E = FE.create(CFG, W, CORPUS, seed); S = E.S;
    E.on(onEvent);
    E.advance(0);
    ui.speed = 0; ui.everStarted = false; ui.endShown = false; ui.endClosed = false; ui.modalId = null; ui.cashShown = S.bank;
    ui.des = { pool: 'office', gpus: 8, gpusMax: true, N: 1e9, D: 2e10, recipe: true };
    var r = E.recipeForN(1e8); ui.des.N = r.N; ui.des.D = r.D;
    $('end').hidden = true; $('modal').hidden = true; root.classList.remove('over');
    syncDesignerInputs(); renderAll();
  }

  /* ---------------- events from the engine: sound and redraws ---------------- */
  function onEvent(kind, d) {
    ui.dirty = true;
    switch (kind) {
      case 'payroll': AU.payroll(); break;
      case 'cash': if (d.delta > 0) AU.cashIn(); else AU.tick(false); break;
      case 'hang': AU.hang(); break;
      case 'nan': AU.nan(); break;
      case 'land': AU.land(d.clean); break;
      case 'decision': AU.knock(); break;
      case 'scandal': AU.bad(); break;
      case 'end': AU.hum(0, false); break;
    }
  }

  /* ---------------- speed ---------------- */
  function setSpeed(x) {
    ui.speed = x; if (x > 0) { ui.lastSpeed = x; ui.everStarted = true; }
    ['0', '1', '2', '4'].forEach(function (k) { var b = $('sp' + k); if (b) b.setAttribute('aria-pressed', String(+k === x)); });
  }
  function togglePause() { setSpeed(ui.speed > 0 ? 0 : (ui.lastSpeed || 1)); }

  /* ---------------- the frame ---------------- */
  function frame(t) {
    var dt = ui.lastFrame ? Math.min(0.1, (t - ui.lastFrame) / 1000) : 0; ui.lastFrame = t;
    if (S && S.phase === 'play' && ui.speed > 0 && !E.blocked()) {
      var before = Math.floor(S.day);
      E.advance(dt * ui.speed * CFG.daysPerSec * ui.botMult);
      if (Math.floor(S.day) !== before) ui.dirty = true;
    }
    var held = S && S.phase === 'play' && E.blocked();
    if (held !== ui.held) { ui.held = held; document.querySelector('.t-speed').classList.toggle('held', held); }
    syncModal();
    if (S && S.phase === 'over' && !ui.endShown) showEnd();
    renderTop(dt);
    drawChart();
    if (ui.dirty || t - ui.lastPanels > 250) { ui.lastPanels = t; ui.dirty = false; renderPanels(); }
    try { var inf = poolSums(); AU.hum(inf.total ? inf.training / inf.total : 0, S.phase === 'play' && ui.speed > 0 && !held && E.activeRuns().length > 0); } catch (e) {}
    requestAnimationFrame(frame);
  }

  /* ---------------- helpers ---------------- */
  // panels are patched in place, not replaced, so a button under a finger or a cursor survives the next redraw
  function setHTML(el, html) {
    if (!el || el.__h === html) return false;
    el.__h = html;
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    morphChildren(el, tpl.content);
    return true;
  }
  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType === 1 && (a.getAttribute('data-k') || '') !== (b.getAttribute('data-k') || '')) return false;
    return true;
  }
  function morphChildren(a, b) {
    var bn = b.childNodes, i = 0;
    for (; i < bn.length; i++) {
      var nb = bn[i], na = a.childNodes[i];
      if (!na) { a.appendChild(nb.cloneNode(true)); continue; }
      if (!sameNode(na, nb)) { a.replaceChild(nb.cloneNode(true), na); continue; }
      if (na.nodeType === 3 || na.nodeType === 8) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; continue; }
      var j, at;
      for (j = na.attributes.length - 1; j >= 0; j--) { at = na.attributes[j]; if (!nb.hasAttribute(at.name)) na.removeAttribute(at.name); }
      for (j = 0; j < nb.attributes.length; j++) { at = nb.attributes[j]; if (na.getAttribute(at.name) !== at.value) na.setAttribute(at.name, at.value); }
      if (na.nodeName === 'BUTTON') na.disabled = nb.hasAttribute('disabled');
      morphChildren(na, nb);
    }
    while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
  }
  function setText(el, t) { if (el && el.__t !== t) { el.textContent = t; el.__t = t; } }
  function fmtRunway(m) { return !isFinite(m) ? '∞' : m >= 10 ? String(Math.floor(m)) : m.toFixed(1); }
  function days(n) { return n >= 10 ? Math.round(n) + ' d' : n.toFixed(1) + ' d'; }
  function poolSums() { var t = 0, tr = 0, sv = 0, lent = 0; CFG.pools.forEach(function (p) { var i = E.poolInfo(p); var eq = CFG.card[i.type].eq; t += i.total * eq; tr += i.training * eq; sv += i.serving * eq; lent += i.lent * eq; }); return { total: t, training: tr, serving: sv, lent: lent }; }
  function pips(n) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '●' : '○'; return s; }
  function btn(act, label, attrs, cls, disabled, k) { return '<button type="button" class="btn sm ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + (k ? ' data-k="' + k + '"' : '') + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function sampleHTML(text) { return esc(text).replace(/\u0001/g, '<span class="junk">').replace(/\u0002/g, '</span>'); }
  function plainText(text) { return String(text || '').replace(/[\u0001\u0002]/g, ''); }

  /* ---------------- top bar ---------------- */
  function renderTop(dt) {
    if (!S) return;
    var hung = E.activeRuns().filter(function (r) { return r.hang; })[0];
    var narrow = window.innerWidth < 460;
    var dateTxt = S.phase === 'over' ? E.fmtLong(Math.min(S.day, 365)) + (narrow ? '' : ' · YEAR OVER') : E.fmtLong(S.day) + (hung ? ' · HANG ' + pad2(hung.hang.hour) + ':' + pad2(hung.hang.min) : '');
    var dEl = $('t-date'); if (dEl.__t !== dateTxt) { var sp = dateTxt.indexOf(' '); dEl.innerHTML = '<span class="wd">' + esc(dateTxt.slice(0, sp + 1)) + '</span>' + esc(dateTxt.slice(sp + 1)); dEl.__t = dateTxt; }
    var target = S.bank;
    if (ui.cashShown == null || reduced()) ui.cashShown = target; else ui.cashShown += (target - ui.cashShown) * Math.min(1, dt * 8);
    if (Math.abs(ui.cashShown - target) < 500) ui.cashShown = target;
    setText($('t-cash'), fmtMoney(ui.cashShown));
    var b = E.burn(), rw = E.runway();
    setText($('t-burn'), b <= 0 ? '+' + fmtMoney(-b) : fmtMoney(b));
    setText($('t-runway'), fmtRunway(rw) + ' mo');
    $('t-runway').className = 'v' + (rw < 3 ? ' bad' : rw < 6 ? ' cau' : '');
    $('t-cash').className = 'v' + (S.bank < 0 ? ' bad' : '');
    setText($('t-rep'), String(Math.round(S.rep)));
    var pf = E.flopsPerDay(true) / 8.64e19;
    setText($('t-pf'), pf >= 100 ? pf.toFixed(0) : pf >= 10 ? pf.toFixed(1) : pf.toFixed(2));
    var left = S.relevantUntil - S.day, f = $('t-forget');
    setText(f, (narrow ? 'Forgotten ' : 'Forgotten in ') + Math.max(0, Math.ceil(left)) + 'd' + (narrow ? ' ≥' : ' · need ≥') + sci(E.relevanceNeed()));
    f.className = 'thr' + (left < 21 ? ' bad' : left < 45 ? ' cau' : '');
    var st = $('t-stake'); setText(st, (narrow ? 'Own ' + pct(S.stake, 0) : 'Stake ' + pct(S.stake, 1)) + (S.stake < 0.5 ? ' · BOARD' : ''));
    st.className = 'thr' + (S.stake < 0.5 ? ' bad' : S.stake < 0.56 ? ' cau' : '');
    var best = E.bestRun(), bt = $('t-best');
    setText(bt, best ? 'Best ' + sci(best.Cland) + (narrow ? '' : ' @ ' + best.loss.toFixed(3)) : 'Best —');
    bt.className = 'thr' + (best ? ' acc' : '');
    var dot = $('j-inbox'); if (dot) dot.hidden = !(S.inbox.length);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- the hero chart ---------------- */
  var chartGeom = null;
  function drawChart() {
    var cv = $('chart'); if (!cv || !S) return;
    var wrap = cv.parentNode, w = wrap.clientWidth, h = wrap.clientHeight; if (w < 10 || h < 10) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
    if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var small = w < 520;
    var padL = small ? 34 : 44, padR = small ? 8 : 14, padT = small ? 22 : 26, padB = small ? 20 : 22;
    var x0 = CFG.chart.xMin, x1 = CFG.chart.xMax, yLo = Math.log(CFG.chart.yMin), yHi = Math.log(CFG.chart.yMax);
    var pw = w - padL - padR, ph = h - padT - padB;
    function X(lc) { return padL + (lc - x0) / (x1 - x0) * pw; }
    function Y(L) { return padT + (yHi - Math.log(L)) / (yHi - yLo) * ph; }
    chartGeom = { X: X, Y: Y, padL: padL, padR: padR, w: w, h: h };
    var css = getComputedStyle(root);
    var COL = { line: tok(css, '--line', '#1e2731'), line2: tok(css, '--line2', '#2a3541'), text: tok(css, '--text', '#dde4ec'), muted: tok(css, '--muted', '#8b97a5'), dim: tok(css, '--dim', '#5d6977'), acc: tok(css, '--accent', '#58e0c2'), acc2: tok(css, '--accent2', '#2a8f7c'), bad: tok(css, '--danger', '#ff5f57'), cau: tok(css, '--caution', '#e39b95'), rival: tok(css, '--rival', '#8a96a3'), white: tok(css, '--white', '#f2f5f8'), panel: tok(css, '--panel', '#0f141b') };
    c.font = '10px ' + monoFont();
    c.lineWidth = 1;
    // grid
    c.strokeStyle = COL.line; c.fillStyle = COL.dim; c.textBaseline = 'top'; c.textAlign = 'center';
    for (var d = Math.ceil(x0); d <= Math.floor(x1); d++) {
      var x = Math.round(X(d)) + 0.5; c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + ph); c.stroke();
      if (!small || d % 2 === 1) c.fillText('1e' + d, x, padT + ph + 5);
    }
    c.textAlign = 'right'; c.textBaseline = 'middle';
    [2, 3, 4, 6, 10].forEach(function (L) { var y = Math.round(Y(L)) + 0.5; c.beginPath(); c.moveTo(padL, y); c.lineTo(padL + pw, y); c.stroke(); c.fillText(String(L), padL - 5, y); });
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = COL.dim;
    c.fillText('loss (nats)', 4, 6);
    c.textAlign = 'right'; c.fillText('compute (FLOPs) →', padL + pw, 6);
    // markers: measured horizon, Series A, relevance
    function vmark(C, col, label, dash, row) {
      var lc = log10(C); if (lc < x0 || lc > x1) return;
      var x = Math.round(X(lc)) + 0.5; c.save(); c.strokeStyle = col; c.setLineDash(dash || [2, 3]); c.globalAlpha = 0.7; c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + ph); c.stroke(); c.restore();
      c.save(); c.fillStyle = col; c.globalAlpha = 0.9; c.textAlign = x > padL + pw - 80 ? 'right' : 'left'; c.textBaseline = 'top';
      c.fillText(label, x + (c.textAlign === 'left' ? 3 : -3), padT + 2 + (row || 0) * 12); c.restore();
    }
    var rows = 0;
    vmark(E.horizon(), COL.acc2, small ? 'horizon' : 'measured horizon', [1, 3], rows++);
    if (!S.raise.aDone && S.raise.aNeed <= Math.pow(10, x1)) vmark(S.raise.aNeed, COL.muted, small ? 'Series A' : 'Series A ≥ ' + sci(S.raise.aNeed), [4, 4], rows++);
    vmark(E.relevanceNeed(), COL.cau, small ? 'relevance' : 'relevant ≥ ' + sci(E.relevanceNeed()), [2, 2], rows++);
    // the scaling law
    c.save(); c.strokeStyle = COL.white; c.globalAlpha = S.day >= E.DAY.line ? 0.55 : 0.28; c.setLineDash([4, 4]); c.beginPath();
    for (var lc = x0; lc <= x1 + 1e-9; lc += 0.05) { var y = Y(E.Lline(Math.pow(10, lc))); if (lc === x0) c.moveTo(X(lc), y); else c.lineTo(X(lc), y); }
    c.stroke(); c.restore();
    if (!small) { c.save(); c.fillStyle = COL.muted; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.textBaseline = 'top'; var llc = x1 - 2.6; c.fillText('scaling law L = (2.68e28/C)^0.050' + (S.day < E.DAY.line ? ' (paper: 23 Jan)' : ''), X(llc) - 120, Y(E.Lline(Math.pow(10, llc))) + 14); c.restore(); }
    // GPT-3
    var gx = X(log10(CFG.gpt3.C)), gy = Y(CFG.gpt3.L);
    c.save(); c.strokeStyle = COL.white; c.lineWidth = 1.5; c.beginPath(); c.arc(gx, gy, 6, 0, 6.2832); c.stroke();
    if (S.day >= E.DAY.gpt3) { c.fillStyle = COL.white; c.beginPath(); c.arc(gx, gy, 2.5, 0, 6.2832); c.fill(); }
    c.fillStyle = COL.white; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(S.day >= E.DAY.gpt3 ? 'GPT-3 · 28 May' : 'GPT-3 scale', gx - 4, gy - 8); c.restore();
    // rivals
    var labelBoxes = [];
    S.rivals.forEach(function (rv) {
      var pts = rv.pubs.filter(function (p) { return log10(p.C) >= x0; }).map(function (p) { return [X(log10(p.C)), Y(p.L), p]; });
      c.save(); c.strokeStyle = COL.rival; c.fillStyle = COL.rival; c.globalAlpha = 0.75; c.setLineDash([2, 3]);
      if (pts.length > 1) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); }
      c.setLineDash([]); pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 2.5, 0, 6.2832); c.fill(); });
      var lp = pts[pts.length - 1];
      if (lp) { c.globalAlpha = 0.9; c.textAlign = 'left'; c.textBaseline = 'middle'; var lab = small ? rv.name.charAt(0) : rv.name + ' · ' + bigNum(E.Nopt(lp[2].C)); var ly = lp[1] - 9; labelBoxes.forEach(function (b) { if (Math.abs(b - ly) < 11) ly -= 11; }); labelBoxes.push(ly); c.fillText(lab, lp[0] + 4, ly); }
      c.restore();
    });
    // your runs: finished curves faint, live curves bright
    S.runs.forEach(function (r) {
      if (r.state === 'aborted' || !r.pts.length) return;
      var live = r.state === 'train';
      c.save(); c.strokeStyle = live ? COL.acc : (r.clean ? COL.acc2 : COL.bad); c.globalAlpha = live ? 1 : 0.45; c.lineWidth = live ? 1.6 : 1;
      c.beginPath(); var started = false;
      for (var i = 0; i < r.pts.length; i++) { var p = r.pts[i], lcx = log10(p[0] * r.C); if (lcx < x0) continue; var px = X(lcx), py = Y(clamp(p[1], CFG.chart.yMin, CFG.chart.yMax)); if (!started) { c.moveTo(px, py); started = true; } else c.lineTo(px, py); }
      c.stroke(); c.restore();
      if (live && r.pts.length) {
        var hp = r.pts[r.pts.length - 1], hx = X(Math.max(x0, log10(hp[0] * r.C))), hy = Y(clamp(hp[1], CFG.chart.yMin, CFG.chart.yMax));
        c.save(); c.fillStyle = r.hang ? COL.bad : COL.acc; c.beginPath(); c.arc(hx, hy, 3.5, 0, 6.2832); c.fill();
        if (!reduced() && !r.hang) { c.globalAlpha = 0.25; c.beginPath(); c.arc(hx, hy, 7 + 2 * Math.sin(performance.now() / 180), 0, 6.2832); c.fill(); }
        c.globalAlpha = 1; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillStyle = r.hang ? COL.bad : COL.acc; c.fillText((r.hang ? 'HANG ' : '') + 'run ' + r.id + ' ' + Math.round(r.q * 100) + '%', hx + 6, hy - 4);
        // target: where it will land
        var tx = X(log10(r.C)), ty = Y(r.projAtLaunch); c.globalAlpha = 0.6; c.strokeStyle = COL.acc; c.setLineDash([2, 2]); c.beginPath(); c.arc(tx, ty, 4, 0, 6.2832); c.stroke();
        c.restore();
      }
    });
    S.runs.forEach(function (r) {
      if (r.state !== 'landed') return;
      var lcx = log10(r.Cland); if (lcx < x0) return;
      var x = X(lcx), y = Y(clamp(r.loss, CFG.chart.yMin, CFG.chart.yMax));
      c.save();
      if (r.clean) { c.fillStyle = COL.acc; c.beginPath(); c.arc(x, y, 3.5, 0, 6.2832); c.fill(); }
      else { c.strokeStyle = COL.bad; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 3.5, 0, 6.2832); c.stroke(); }
      if (r.published) { c.strokeStyle = COL.acc; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 7, 0, 6.2832); c.stroke(); }
      if (r.shipped) { c.strokeStyle = COL.white; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 6, y); c.lineTo(x + 11, y); c.stroke(); }
      if (r.scandal) { c.strokeStyle = COL.bad; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 6, y + 6); c.stroke(); }
      c.restore();
    });
    // the designer's ghost
    if (S.phase === 'play' && ui.lastDesign && ui.lastDesign.cards > 0) {
      var g = ui.lastDesign, gxx = X(clamp(log10(g.C), x0, x1)), gyy = Y(clamp(g.proj, CFG.chart.yMin, CFG.chart.yMax));
      c.save(); c.strokeStyle = g.ok ? COL.white : COL.bad; c.globalAlpha = 0.85; c.setLineDash([2, 2]); c.lineWidth = 1;
      c.beginPath(); c.moveTo(gxx, Y(g.hi)); c.lineTo(gxx, Y(g.lo)); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(gxx - 5, gyy); c.lineTo(gxx + 5, gyy); c.moveTo(gxx, gyy - 5); c.lineTo(gxx, gyy + 5); c.stroke();
      c.fillStyle = g.ok ? COL.white : COL.bad; c.textAlign = gxx > padL + pw - 120 ? 'right' : 'left'; c.textBaseline = 'top';
      c.fillText('design ' + sci(g.C) + ' → ' + g.proj.toFixed(2), gxx + (c.textAlign === 'left' ? 7 : -7), gyy + 6);
      c.restore();
    }
  }
  var monoCache = null;
  function monoFont() { if (!monoCache) monoCache = getComputedStyle(root).getPropertyValue('--mono') || 'monospace'; return monoCache; }
  function tok(css, n, d) { var v = (css.getPropertyValue(n) || '').trim(); return v || d; }

  /* ---------------- the training panel ---------------- */
  function renderTrain() {
    var act = E.activeRuns();
    setText($('s-train'), act.length ? act.length + ' training · ' + Math.round(poolSums().training) + ' V100-eq busy' : (S.runs.length ? S.runs.length + ' runs this year' : 'nothing training'));
    var h = '';
    act.forEach(function (r) {
      var type = E.poolType(r.pool), perDay = r.cards * CFG.card[type].flops * E.scaleEff(r.cards), left = perDay > 0 ? (r.C - r.done) / perDay : Infinity;
      var hangLeft = r.hang ? r.hang.left : 0;
      var landTxt = isFinite(left) ? E.fmtDay(S.day + left + hangLeft) : 'no cards';
      var unread = r.ckpts.filter(function (k) { return !k.read; }).length;
      var cur = r.pts.length ? r.pts[r.pts.length - 1][1] : CFG.startLoss;
      var armed = ui.stopArm && ui.stopArm.id === r.id && performance.now() - ui.stopArm.t < 3500;
      h += '<div class="run' + (S.selRun === r.id ? ' sel' : '') + (r.hang ? ' hung' : '') + '" data-act="select" data-k="run' + r.id + '" data-id="' + r.id + '">' +
        '<div class="r1"><b>Run ' + r.id + ' · ' + bigNum(r.N) + ' params, ' + bigNum(r.D) + ' tokens</b><span class="mono">' + sci(r.C) + '</span></div>' +
        '<div class="bar"><i style="width:' + (r.q * 100).toFixed(1) + '%"></i></div>' +
        '<div class="r2"><span>' + (r.q * 100).toFixed(1) + '%</span><span>' + (isFinite(left) ? days(left + hangLeft) + ' left' : 'stalled: no free cards') + '</span><span>lands ~' + landTxt + '</span><span>' + r.cards + ' ' + CFG.card[type].label + 's</span><span>loss ' + cur.toFixed(2) + '</span>' +
        (r.hangs.length ? '<span class="cau">' + r.hangs.length + ' hang' + (r.hangs.length > 1 ? 's' : '') + '</span>' : '') + (r.nans.length ? '<span class="cau">' + r.nans.length + ' NaN</span>' : '') + (r.hang ? '<span class="bad">HUNG · ' + Math.max(1, Math.round(r.hang.left * 24)) + ' h to restart</span>' : '') + '</div>' +
        '<div class="r3">' + btn('sample', 'Read checkpoint' + (unread ? ' (' + unread + ' new)' : ''), ' data-id="' + r.id + '"', unread ? 'pri' : '', !r.ckpts.length, 'smp' + r.id) +
        (function () { var mt = E.moveTarget(r); return mt ? btn('move', 'Move to ' + mt.cards + ' ' + CFG.poolNames[mt.pool] + (isFinite(mt.speedup) ? ' (x' + mt.speedup.toFixed(1) + ')' : ''), ' data-id="' + r.id + '"', 'pri', false, 'mv' + r.id) : ''; })() +
        btn('abort', armed ? 'Confirm: land it now' : 'Stop early', ' data-id="' + r.id + '"', 'warn', false, 'ab' + r.id) + '</div></div>';
    });
    var landed = S.runs.filter(function (r) { return r.state === 'landed'; }).slice(-3).reverse();
    landed.forEach(function (r) {
      var tags = (r.clean ? (r.onLine ? '<span class="tag acc">on line</span>' : '<span class="tag">above line</span>') : '<span class="tag bad">past wall</span>') +
        (r.published ? '<span class="tag acc">published</span>' : '') + (r.shipped ? '<span class="tag acc">API</span>' : '') + (r.kept ? '<span class="tag">private</span>' : '') + (r.pending ? '<span class="tag">' + esc(r.pending) + '</span>' : '') + (r.scandal ? '<span class="tag bad">scandal</span>' : '') +
        (r.capsOn.length ? '<span class="tag">' + r.capsOn.map(function (c) { return CFG.capNames[c]; }).join(', ') + '</span>' : '');
      h += '<div class="run' + (S.selRun === r.id ? ' sel' : '') + '" data-act="select" data-k="land' + r.id + '" data-id="' + r.id + '"><div class="r1"><span>Run ' + r.id + ' landed ' + E.fmtDay(r.landDay) + '</span><span class="mono">' + sci(r.Cland) + ' · ' + r.loss.toFixed(3) + '</span></div><div class="r2">' + tags + '</div></div>';
    });
    if (!h) h = '<div class="empty">No runs yet. Design one ' + (wide() ? 'on the right' : 'below') + ', then Launch. ' + (ui.everStarted ? '' : 'The clock is paused until you press 1× or launch.') + '</div>';
    setHTML($('runs'), h);
    // the sample
    var sm = S.lastSample, sh = '';
    if (sm) {
      var crawl = sm.amt === E.CRAWL;
      sh = '<div class="sh"><span>Run ' + sm.run + ' · ' + (sm.q >= 1 ? 'final' : 'checkpoint ' + (sm.q * 100).toFixed(sm.q < 0.01 ? 2 : 0) + '%') + ' · ' + bigNum(sm.tokens) + ' tokens · loss ' + sm.loss.toFixed(2) + '</span><span>' + (sm.tier < 3 ? 'too early to judge the data' : crawl ? '<span class="bad">web crawl: past the wall</span>' : sm.amt > 0 ? '<span class="cau">' + sm.amt + ' junk fragment' + (sm.amt > 1 ? 's' : '') + '</span>' : 'clean') + '</span></div>' +
        '<p class="st2' + (crawl ? ' crawl' : '') + '">' + sampleHTML(sm.text) + '</p>';
    } else sh = '<div class="sh"><span>The model’s words</span></div><p class="hint">Checkpoints arrive as a run trains. Read one to see what the model says: static, then words, grammar, sentences. Web junk inside a sentence means the data is running out.</p>';
    setHTML($('sample'), sh);
  }

  /* ---------------- the run designer ---------------- */
  var N_LO = log10(CFG.designer.nMin), N_HI = log10(CFG.designer.nMax), D_LO = log10(CFG.designer.dMin), D_HI = log10(CFG.designer.dMax);
  function nToV(N) { return Math.round((log10(N) - N_LO) / (N_HI - N_LO) * 1000); }
  function vToN(v) { return Math.pow(10, N_LO + v / 1000 * (N_HI - N_LO)); }
  function dToV(D) { return Math.round((log10(D) - D_LO) / (D_HI - D_LO) * 1000); }
  function vToD(v) { return Math.pow(10, D_LO + v / 1000 * (D_HI - D_LO)); }
  function recipeForD(D) { var C = CFG.gpt3.C * Math.pow(D / CFG.gpt3.D, 1 / CFG.tokExp); return { N: C / (6 * D), D: D, C: C }; }
  function syncDesignerInputs() {
    var free = E.poolFree(ui.des.pool);
    var g = $('d-gpus'); g.max = String(Math.max(0, free)); if (ui.des.gpusMax || ui.des.gpus > free) ui.des.gpus = free; g.value = String(ui.des.gpus);
    $('d-n').value = String(nToV(ui.des.N)); $('d-d').value = String(dToV(ui.des.D)); $('d-recipe').checked = ui.des.recipe;
  }
  function renderDesigner() {
    if (E.poolFree(ui.des.pool) < 1) {
      var bp = null, bf = 0; CFG.pools.forEach(function (p) { var f = E.poolFree(p) * E.cardFlops(p); if (f > bf) { bf = f; bp = p; } });
      if (bp && bp !== ui.des.pool) { ui.des.pool = bp; ui.des.gpusMax = true; syncDesignerInputs(); }
    }
    var pools = '';
    CFG.pools.forEach(function (p) {
      var i = E.poolInfo(p), short = { office: 'Office V100', a100: 'A100', cloud: 'Rented', meridian: 'Meridian' }[p];
      pools += '<button type="button" data-act="pool" data-pool="' + p + '" data-k="pool-' + p + '" aria-pressed="' + (ui.des.pool === p) + '"' + (i.total < 1 ? ' disabled' : '') + '><span>' + short + '</span><b>' + i.free + '/' + i.total + '</b></button>';
    });
    setHTML($('d-pools'), pools);
    var free = E.poolFree(ui.des.pool), g = $('d-gpus');
    if (String(Math.max(0, free)) !== g.max) { g.max = String(Math.max(0, free)); }
    if (ui.des.gpusMax || ui.des.gpus > free) { ui.des.gpus = free; if (document.activeElement !== g) g.value = String(free); }
    setText($('o-gpus'), String(ui.des.gpus));
    setText($('o-n'), bigNum(ui.des.N)); setText($('o-d'), bigNum(ui.des.D));
    var p = E.design({ pool: ui.des.pool, gpus: ui.des.gpus, params: ui.des.N, tokens: ui.des.D });
    ui.lastDesign = p;
    var vsLine = p.proj / p.line - 1;
    var out = kv('Compute', sci(p.C) + ' FLOPs', p.pfdays >= 1 ? Math.round(p.pfdays).toLocaleString('en-US') + ' PF-days' : p.pfdays.toFixed(2) + ' PF-days') +
      kv('Time', isFinite(p.daysAll) ? days(p.daysAll) : '—', 'lands ' + p.landTxt + (p.expLost >= 0.1 ? ' (incl. ~' + p.expLost.toFixed(1) + ' d hangs)' : '')) +
      kv('Projected loss', p.proj.toFixed(3) + ' nats', 'range ' + p.lo.toFixed(3) + '–' + p.hi.toFixed(3) + ' · ' + (vsLine >= 0 ? '+' : '') + pct(vsLine, 1) + ' vs line') +
      kv('Memory', bigNum(p.N) + ' / ' + bigNum(p.maxN), p.split > 1 ? 'split across up to ' + Math.min(p.split, Math.max(1, p.cards)) + ' cards' : 'one card per model copy') +
      kv('Data', bigNum(p.D) + ' tokens', 'clean wall est. ' + bigNum(p.wallLo) + '–' + bigNum(p.wallHi)) +
      kv('Cost while training', isFinite(p.cost) ? fmtMoney(p.cost) : '—', 'at ' + fmtMoney(E.burn()) + '/mo burn, ' + p.paydays + ' payday' + (p.paydays === 1 ? '' : 's')) +
      kv('Runway at landing', isFinite(p.runwayAtLand) ? fmtRunway(p.runwayAtLand) + ' mo' : '∞', 'bank ' + (isFinite(p.bankAtLand) ? fmtMoney(p.bankAtLand) : '—')) +
      kv('Speed', p.cards + ' ' + CFG.card[p.type].label + (p.cards === 1 ? '' : 's'), Math.round(p.eff * 100) + '% scaling eff. · ' + (p.perDay / 8.64e19).toFixed(2) + ' PF-d/d');
    setHTML($('d-out'), out);
    var wl = '';
    p.blockers.forEach(function (b) { wl += '<li class="bad">' + esc(b) + '</li>'; });
    p.warns.forEach(function (w) { wl += '<li class="' + w.lvl + '">' + esc(w.t) + '</li>'; });
    var capTxt = p.caps.filter(function (c) { return !c.fired && (c.likely || c.maybe); }).map(function (c) { return CFG.capNames[c.id] + (c.likely ? ' likely' : ' possible'); });
    if (capTxt.length && p.ok) wl += '<li>Capability in reach: ' + esc(capTxt.join(', ')) + '.</li>';
    if (p.ok && !S.raise.aDone && p.C >= S.raise.aNeed) wl += '<li>Far enough for the Series A if it lands on the line and you have a clean on-line dot a decade back.</li>';
    if (p.ok && !p.relevance) wl += '<li>Too small to keep you relevant if published (needs ' + sci(p.relevanceNeed) + ').</li>';
    setHTML($('d-warn'), wl);
    var lb = $('d-launch');
    if (S.phase === 'over') { lb.disabled = false; lb.dataset.act = 'newyear'; setText(lb, 'Play another 2020'); }
    else { lb.dataset.act = 'launch'; lb.disabled = !p.ok || E.blocked(); setText(lb, p.ok ? 'Launch run · lands ' + p.landTxt : 'Can’t launch: ' + (p.blockers[0] || '').split(':')[0]); }
  }
  function kv(k, v, s) { return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v mono">' + esc(v) + '</span><span class="s">' + esc(s) + '</span></div>'; }
  // quick sizes: the biggest on-recipe run that fits memory, stays inside the low end of the wall estimate and lands in time
  function applyPreset(kind) {
    var pool = ui.des.pool, free = E.poolFree(pool); if (free < 1) return;
    var cards = ui.des.gpus || free, perDay = cards * E.cardFlops(pool) * E.scaleEff(cards);
    var Cmem = E.recipeForN(E.maxParams(pool, cards) * 0.995).C;
    var Cdata = CFG.gpt3.C * Math.pow(S.wallLo * 0.95 / CFG.gpt3.D, 1 / CFG.tokExp);
    var daysLeft = Math.max(0.25, 365.9 - S.day), target = kind === 'mem' ? daysLeft * 0.97 : Math.min(+kind, daysLeft * 0.97);
    var C = Math.max(1e15, Math.min(perDay * target / 1.08, Cmem, Cdata));
    var r = E.recipeForC(C);
    ui.des.N = clamp(r.N, CFG.designer.nMin, CFG.designer.nMax); ui.des.D = clamp(r.D, CFG.designer.dMin, CFG.designer.dMax);
    $('d-n').value = String(nToV(ui.des.N)); $('d-d').value = String(dToV(ui.des.D));
    renderDesigner();
  }

  /* ---------------- team ---------------- */
  function effectText(p) {
    var role = p.role, t = W.effects[role] || '', sk = E.effSkill(p);
    if (role === 'data') t = t.replace('{days}', String(E.filterDays() || '?'));
    if (role === 'systems') { var sp = Math.min(CFG.splitCap, CFG.systemsSplit(sk)); t = t.replace('{split}', String(E.split())).replace('{mem}', bigNum(1e9 * E.split())); }
    if (role === 'scaling') t = t.replace('{blind}', String(Math.round(CFG.blind.shareScaling * 100)));
    if (role === 'infra') t = t.replace('{mult}', CFG.infraMult(sk).toFixed(2)).replace('{lost}', String(Math.round(CFG.hangLostInfra * 24)));
    if (role === 'evals') t = t.replace('{rt}', String(CFG.redTeamDays));
    if (role === 'optim') { var live = S.day - p.joined >= CFG.sunheeDelay; t = t.replace('{state}', live ? 'Now:' : 'From ' + E.fmtDay(p.joined + CFG.sunheeDelay) + ':'); }
    return t;
  }
  function assignment(p) {
    if (p.role === 'data') return S.filterJob && S.filterJob.who === p.key ? 'Filter job: ' + Math.max(0, Math.ceil(S.filterJob.until - S.day)) + ' days left' : (S.filterJob ? 'Helping on the filter job' : 'Reviewing every landing for junk');
    if (p.role === 'systems') return 'Model parallelism';
    if (p.role === 'scaling') return 'Measuring the horizon (' + sci(E.horizon()) + ')';
    if (p.role === 'infra') return p.key === 'tom' && S.day < S.tomOffUntil ? 'On a week off until ' + E.fmtDay(S.tomOffUntil) : 'On call · ' + S.hangsThisMonth + ' hang' + (S.hangsThisMonth === 1 ? '' : 's') + ' this month';
    if (p.role === 'evals') return S.redteam ? 'Red-teaming run ' + S.redteam.runId + ': ' + Math.max(0, Math.ceil(S.redteam.until - S.day)) + ' days left' : 'Evals at every landing';
    if (p.role === 'optim') return 'Learning-rate schedules';
    return '';
  }
  function renderTeam() {
    var st = E.staff(), sal = 0; st.forEach(function (p) { sal += p.salary; });
    setText($('s-team'), st.length + ' people · ' + fmtMoney(sal) + '/mo' + (S.cands.length ? ' · ' + S.cands.length + ' on board' : ''));
    var h = '<div class="sec"><h3>Staff <span>' + st.length + ' · ' + fmtMoney(sal) + '/mo</span></h3><div class="rows">';
    st.forEach(function (p) {
      var low = p.mood < CFG.moodLow, canRaise = S.day - p.lastRaise >= CFG.raiseCooldown, add = Math.round(p.salary * (CFG.raiseMult - 1) / 500) * 500;
      h += '<div class="card" data-k="staff-' + p.key + '"><div class="c1"><b>' + esc(p.name) + '</b><span class="num">' + fmtMoney(p.salary) + '/mo</span></div>' +
        '<div class="c2">' + W.roles[p.role] + ' · <span class="pips" title="skill">' + pips(p.skill) + '</span> · morale <span class="mood' + (low ? ' low' : '') + '"><i style="width:' + Math.round(p.mood) + '%"></i></span> <span class="mono' + (low ? ' bad' : '') + '">' + Math.round(p.mood) + '</span>' + (low ? ' <span class="bad">(disengaged: works at skill ' + E.effSkill(p) + ')</span>' : '') + '</div>' +
        '<div class="c2"><b class="mut">Now:</b> ' + esc(assignment(p)) + '</div>' +
        '<div class="c2">' + esc(effectText(p)) + '</div>' +
        '<div class="c3">' + btn('raisepay', 'Raise +' + fmtMoney(add) + ' (morale +' + CFG.raiseMood + ')', ' data-id="' + p.key + '"', '', !canRaise || S.phase !== 'play', 'rp-' + p.key) +
        (p.role === 'data' ? btn('filter', S.filterJob ? 'Filter running' : 'Filter job ' + fmtMoney(E.filterCost()) + ', ' + E.filterDays() + ' d', '', 'pri', !!S.filterJob || S.phase !== 'play', 'flt-' + p.key) : '') +
        (!canRaise ? '<span class="dim">raise again ' + E.fmtDay(p.lastRaise + CFG.raiseCooldown) + '</span>' : '') + '</div></div>';
    });
    h += '</div></div>';
    h += '<div class="sec"><h3>Hiring board <span>' + (S.cands.length ? 'courted by rivals after ' + CFG.courtDays + ' days' : 'nobody right now') + '</span></h3><div class="rows">';
    S.cands.forEach(function (c) {
      var d = W.people[c.key], ask = E.candAsk(c), req = E.candReq(c), left = Math.ceil(c.courtBy - S.day);
      var fake = { role: d.role, skill: d.skill, key: c.key, joined: S.day, mood: 70 };
      h += '<div class="card" data-k="cand-' + c.key + '"><div class="c1"><b>' + esc(d.name) + '</b><span class="num">asks ' + fmtMoney(ask) + '/mo</span></div>' +
        '<div class="c2">' + W.roles[d.role] + ' · <span class="pips">' + pips(d.skill) + '</span> · “' + esc(d.pitch) + '”</div>' +
        '<div class="c2">' + esc(candEffect(d)) + '</div>' +
        (req ? '<div class="why">' + esc(req) + '</div>' : '') +
        '<div class="c3">' + btn('hire', 'Hire · runway ' + fmtRunway(E.runway()) + ' → ' + fmtRunway(S.bank / Math.max(1, E.burn() + ask)) + ' mo', ' data-id="' + c.key + '"', 'pri', !!req || S.phase !== 'play', 'hire-' + c.key) +
        '<span class="dim">' + (left > 0 ? (c.key === 'sunhee' ? 'Halcyon' : 'Kestrel') + ' courts ' + (d.she ? 'her' : 'him') + ' in ' + left + ' d' : 'being courted') + '</span></div></div>';
    });
    h += '</div></div>';
    var gone = S.team.filter(function (p) { return p.gone; }).map(function (p) { return p.first + ' (' + E.fmtDay(p.goneDay) + (p.goneTo ? ', to ' + p.goneTo : '') + ')'; }).concat(S.gone.map(function (g) { return g.first + ' (never hired, to ' + g.to + ')'; }));
    if (gone.length) h += '<div class="sec"><h3>Gone</h3><div class="c2 mut">' + esc(gone.join(' · ')) + '</div></div>';
    setHTML($('b-team'), h);
  }
  function candEffect(d) {
    if (d.role === 'systems') return 'Would let one model split across ' + Math.min(CFG.splitCap, E.split() * CFG.systemsSplit(d.skill)) + ' cards (memory limit ' + bigNum(1e9 * Math.min(CFG.splitCap, E.split() * CFG.systemsSplit(d.skill))) + ' on V100s; now ' + bigNum(1e9 * E.split()) + ').';
    if (d.role === 'infra') return 'Hangs x' + CFG.infraMult(d.skill).toFixed(2) + ' as often; each costs hours, not most of a day.';
    if (d.role === 'data') return 'Runs filter jobs (x1.86 clean tokens); two data people make jobs ~40% faster.';
    if (d.role === 'scaling') return 'Measured horizon 100x (not 10x); blind runs go wrong ' + Math.round(CFG.blind.shareScaling * 100) + '% of the time, not ' + Math.round(CFG.blind.share * 100) + '%.';
    if (d.role === 'evals') return 'Catches leaked test sets; red-teams releases (no scandal risk).';
    if (d.role === 'optim') return 'After 30 days every run lands 2.5% under the line (~1.7x compute); halves NaNs.';
    return '';
  }

  /* ---------------- cluster ---------------- */
  function renderCluster() {
    var sums = poolSums(), pf = E.flopsPerDay(true) / 8.64e19;
    var phys = 0; CFG.pools.forEach(function (p) { phys += E.poolInfo(p).total; });
    var ordered = 0; S.orders.forEach(function (o) { ordered += o.cards; });
    setText($('s-cluster'), phys + ' cards' + (ordered ? ' (+' + ordered + ' ordered)' : '') + ' · ' + (sums.total ? Math.round(sums.training / sums.total * 100) : 0) + '% busy');
    var h = '<div class="sec"><h3>Cards <span>' + pf.toFixed(2) + ' PF-days/day</span></h3>';
    var t = Math.max(1e-9, sums.total);
    h += '<div class="util" title="training, serving, rented out, idle"><i style="width:' + (sums.training / t * 100) + '%;background:var(--accent)"></i><i style="width:' + (sums.serving / t * 100) + '%;background:var(--white)"></i><i style="width:' + (sums.lent / t * 100) + '%;background:var(--rival)"></i></div>';
    h += '<div class="axis"><span>training ' + Math.round(sums.training / t * 100) + '%</span><span>serving ' + Math.round(sums.serving / t * 100) + '% · lent ' + Math.round(sums.lent / t * 100) + '%</span></div>';
    h += '<div class="kvt" style="margin-top:6px">';
    CFG.pools.forEach(function (p) {
      var i = E.poolInfo(p); if (!i.total && p !== 'office') return;
      h += '<span>' + CFG.poolNames[p] + (p === 'meridian' && S.mer ? ' <span class="dim">(of ' + S.mer.cards + ')</span>' : '') + '</span><span class="r">' + i.total + ' <span class="sub">· ' + i.training + ' train' + (i.serving ? ', ' + i.serving + ' serve' : '') + (i.lent ? ', ' + i.lent + ' lent' : '') + ', ' + i.free + ' idle</span></span>';
    });
    S.orders.forEach(function (o) { h += '<span class="sub">On order: ' + esc(o.label) + '</span><span class="r sub">arrives ' + E.fmtDay(o.arrive) + '</span>'; });
    if (S.mer && S.day < S.mer.live) h += '<span class="sub">Meridian: ' + S.mer.cards + ' V100s</span><span class="r sub">live ' + E.fmtDay(S.mer.live) + '</span>';
    h += '</div></div>';
    // market
    var price = E.rentPrice(), cap = E.rentCap(), have = E.rentedCount(), room = Math.max(0, cap - have);
    ui.rentN = clamp(ui.rentN, 8, Math.max(8, room));
    var monthly = ui.rentN * price * 24 * CFG.daysPerMonth;
    h += '<div class="sec"><h3>GPU market <span>V100 $' + price.toFixed(2) + '/h</span></h3><div class="mk">';
    if (S.mer) h += '<div class="mkrow"><span class="txt">Renting: <b>closed</b>. Meridian exclusivity: no other cloud.</span></div>';
    else h += '<div class="mkrow"><span class="txt"><b>Rent V100s</b> by the month, live tomorrow. Broker has ' + room + ' of ' + cap + ' available. ' + ui.rentN + ' cost <b>' + fmtMoney(monthly) + '/mo</b>.</span>' +
      '<span class="stepper"><button type="button" data-act="step" data-s="rent" data-d="-8" data-k="rent-m" aria-label="Fewer">−</button><span class="val">' + ui.rentN + '</span><button type="button" data-act="step" data-s="rent" data-d="8" data-k="rent-p" aria-label="More">+</button></span>' +
      btn('rent', 'Rent', '', 'pri', room < 8 || S.phase !== 'play', 'rent') + '</div>';
    S.rentals.forEach(function (r) {
      var live = S.day >= r.start;
      h += '<div class="mkrow" data-k="rental-' + r.id + '"><span class="txt">' + r.n + ' rented V100s · $' + r.price.toFixed(2) + '/h · ' + (live ? '' : 'live ' + E.fmtDay(r.start) + ' · ') + (r.cancel || r.noRenew ? '<span class="cau">ends ' + E.fmtDay(r.end) + '</span>' : 'renews ' + E.fmtDay(r.end)) + '</span>' +
        (r.noRenew && !r.cancel ? '' : btn('cancelRent', r.cancel ? 'Keep' : 'Cancel', ' data-id="' + r.id + '"', '', S.phase !== 'play', 'cr-' + r.id)) + '</div>';
    });
    ['dgx1', 'dgxa100'].forEach(function (item) {
      var spec = CFG.buy[item], from = E.D(spec.from), u = ui.buy[item], unit = E.buyPrice(item, S.day), lead = E.leadFor(item, S.day);
      if (S.day < from) { h += '<div class="mkrow"><span class="txt"><b>' + spec.label + '</b>: on the market from ' + E.fmtDay(from) + '.</span></div>'; return; }
      var arrive = Math.floor(S.day) + lead, total = unit * u;
      h += '<div class="mkrow"><span class="txt"><b>Buy ' + spec.label + '</b> ' + fmtMoney(unit) + ' each. ' + u + ' = <b>' + fmtMoney(total) + '</b>, ' + (spec.cards * u) + ' cards, arrive <b>' + (arrive > 365 ? 'next year' : E.fmtDay(arrive)) + '</b> (' + Math.round(lead / 7) + ' wk). Upkeep $' + CFG.upkeepPerCard + '/card/mo.</span>' +
        '<span class="stepper"><button type="button" data-act="step" data-s="' + item + '" data-d="-1" data-k="' + item + '-m" aria-label="Fewer">−</button><span class="val">' + u + '</span><button type="button" data-act="step" data-s="' + item + '" data-d="1" data-k="' + item + '-p" aria-label="More">+</button></span>' +
        btn('buy', 'Buy', ' data-item="' + item + '"', 'pri', total > S.bank || S.phase !== 'play', 'buy-' + item) + '</div>';
    });
    var idleOwn = E.poolFree('office'), idleA = E.poolFree('a100');
    if (idleOwn + idleA > 0) {
      var cashOut = idleOwn * CFG.rentOutPerHour.v100 * 24 * CFG.rentOutDays + idleA * CFG.rentOutPerHour.a100 * 24 * CFG.rentOutDays;
      h += '<div class="mkrow"><span class="txt"><b>Rent out idle cards</b>: ' + (idleOwn ? idleOwn + ' V100s' : '') + (idleOwn && idleA ? ' + ' : '') + (idleA ? idleA + ' A100s' : '') + ' for ' + CFG.rentOutDays + ' days, <b>+' + fmtMoney(cashOut) + '</b> now. They can’t train meanwhile.</span>' + btn('rentOut', 'Rent out', '', '', S.phase !== 'play', 'ro') + '</div>';
    }
    h += '</div></div>';
    // Meridian
    h += '<div class="sec"><h3>Meridian cloud <span>fictional</span></h3><div class="c2 mut" style="font-size:11.5px">';
    if (S.mer) {
      var qa = S.day >= E.DAY.merQueue ? E.queueAlloc() : null;
      h += 'Signed ' + E.fmtDay(S.mer.signed) + ': ' + S.mer.cards + ' V100s' + (S.day < S.mer.live ? ', live ' + E.fmtDay(S.mer.live) : '') + '. Credits left ' + fmtMoney(S.mer.credits) + '. Exclusive; first look ' + CFG.meridian.firstLookDays + ' days.';
      if (S.day >= E.DAY.merQueue) h += ' Queue this month: <b class="' + (S.mer.alloc < S.mer.cards ? 'cau' : 'acc') + '">' + S.mer.alloc + '</b> cards' + (S.mer.allocWhy ? ' (' + esc(S.mer.allocWhy) + ')' : ' (the queue first applies on the 1st)') + '. Next 1st: <b class="' + (qa.n < S.mer.cards ? 'cau' : 'acc') + '">' + qa.n + '</b> (' + esc(qa.why) + ').';
      else h += ' Queue starts 11 Jun: full allocation within ' + CFG.meridian.queueFull + 'x of the frontier, half within ' + CFG.meridian.queueHalf + 'x, else a quarter.';
      h += '</div><div class="mkrow" style="margin-top:6px"><span class="txt">Priority: always the full ' + S.mer.cards + ' cards for <b>' + fmtMoney(CFG.meridian.priorityPerCardMonth * S.mer.cards) + '/mo</b> from your bank.</span>' + btn('priority', S.priority ? 'Stop priority' : 'Buy priority', '', S.priority ? '' : 'pri', S.phase !== 'play', 'prio') + '</div>';
    } else {
      var far = E.farthestClean();
      h += S.merOffered ? (S.merPassed ? 'You passed. ' + (S.mer2Offered ? 'Second offer passed too.' : 'A smaller offer (' + CFG.meridian.second.cards + ' cards for 10%) comes after 15 Jun.') : 'Offer pending.') :
        'Offers ' + CFG.meridian.cards + ' V100s for exclusivity once you have a clean result ≥ ' + sci(CFG.meridian.needC) + ' and it is past 1 Apr. Yours: ' + (far ? sci(far) : 'none') + '.';
      h += '</div>';
    }
    h += '</div>';
    setHTML($('b-cluster'), h);
    drawCells();
  }
  function drawCells() {
    var cv = $('cells'); if (!cv || !cv.offsetParent) return;
    var w = cv.clientWidth, hh = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, hh);
    var css = getComputedStyle(root), acc = tok(css, '--accent', '#58e0c2'), white = tok(css, '--white', '#fff'), rival = tok(css, '--rival', '#888'), line2 = tok(css, '--line2', '#333'), bad = tok(css, '--danger', '#f55');
    var list = [];
    CFG.pools.forEach(function (p) { var i = E.poolInfo(p); var hung = E.activeRuns().some(function (r) { return r.pool === p && r.hang; }); for (var k = 0; k < i.total; k++) list.push(k < i.training ? (hung ? 'h' : 't') + p : k < i.training + i.serving ? 's' : k < i.training + i.serving + i.lent ? 'l' : 'i' + p); });
    S.orders.forEach(function (o) { for (var k = 0; k < o.cards; k++) list.push('o'); });
    if (S.mer && S.day < S.mer.live) for (var k = 0; k < S.mer.cards; k++) list.push('o');
    var n = list.length; if (!n) return;
    var unit = n > 1024 ? 16 : n > 256 ? 8 : 1, cells = Math.ceil(n / unit);
    var cols = Math.max(8, Math.ceil(Math.sqrt(cells * w / hh))), rowsN = Math.ceil(cells / cols), cw = w / cols, ch = Math.min(hh / rowsN, cw * 1.6);
    for (var i = 0; i < cells; i++) {
      var s = list[i * unit], x = (i % cols) * cw, y = Math.floor(i / cols) * ch, gw = Math.max(1, cw - 1.5), gh = Math.max(1, ch - 1.5);
      if (s[0] === 't') { c.fillStyle = acc; c.globalAlpha = s.indexOf('meridian') > 0 ? 0.65 : s.indexOf('cloud') > 0 ? 0.8 : 1; c.fillRect(x, y, gw, gh); }
      else if (s[0] === 'h') { c.fillStyle = bad; c.globalAlpha = 0.8; c.fillRect(x, y, gw, gh); }
      else if (s === 's') { c.fillStyle = white; c.globalAlpha = 0.8; c.fillRect(x, y, gw, gh); }
      else if (s === 'l') { c.fillStyle = rival; c.globalAlpha = 0.5; c.fillRect(x, y, gw, gh); }
      else if (s === 'o') { c.strokeStyle = line2; c.globalAlpha = 1; c.setLineDash([1, 1]); c.strokeRect(x + 0.5, y + 0.5, gw - 1, gh - 1); c.setLineDash([]); }
      else { c.strokeStyle = acc; c.globalAlpha = 0.35; c.strokeRect(x + 0.5, y + 0.5, gw - 1, gh - 1); }
    }
    c.globalAlpha = 1;
  }

  /* ---------------- money ---------------- */
  function renderMoney() {
    var b = E.burnParts(), burn = E.burn(), rw = E.runway();
    setText($('s-money'), fmtMoney(S.bank) + ' · ' + fmtRunway(rw) + ' mo · own ' + pct(S.stake, 0));
    var next = 0; for (var d = Math.floor(S.day) + 1; d <= 366; d++) if (E.dom(d) === 1) { next = d; break; }
    var h = '<div class="sec"><h3>Cash <span>' + fmtMoney(S.bank) + '</span></h3><canvas class="spark" id="spark-cash" aria-hidden="true"></canvas></div>';
    h += '<div class="sec"><h3>Burn per month <span>' + fmtMoney(burn) + '</span></h3><div class="kvt">' +
      '<span>Salaries (' + E.staff().length + ')</span><span class="r">' + fmtMoney(b.salaries) + '</span>' +
      '<span>Base: you, ops, office</span><span class="r">' + fmtMoney(b.base) + '</span>' +
      '<span>Owned card upkeep</span><span class="r">' + fmtMoney(b.upkeep) + '</span>' +
      '<span>Cloud rent (daily)</span><span class="r">' + fmtMoney(b.rent) + '</span>' +
      (b.priority ? '<span>Meridian priority</span><span class="r">' + fmtMoney(b.priority) + '</span>' : '') +
      (b.api ? '<span class="acc">API revenue</span><span class="r acc">−' + fmtMoney(b.api) + '</span>' : '') +
      '<span class="tot">Runway</span><span class="r tot' + (rw < 3 ? ' bad' : '') + '">' + fmtRunway(rw) + ' months</span>' +
      (next && next < 366 ? '<span class="sub">Next payroll ' + E.fmtDay(next) + '</span><span class="r sub">' + fmtMoney(E.payroll()) + '</span>' : '') +
      (S.stats.apiRevenue ? '<span class="sub">API revenue so far</span><span class="r sub">' + fmtMoney(S.stats.apiRevenue) + '</span>' : '') +
      '</div></div>';
    h += '<div class="sec"><h3>Ownership <span>you own ' + pct(S.stake, 1) + '</span></h3><div class="c2 mut" style="font-size:11.5px">Last post-money ' + fmtMoney(S.post) + '. <b class="' + (S.stake < 0.55 ? 'cau' : '') + '">Below 50% the board controls FRONTIER and sells it to Halcyon on the next 1st.</b> Valuations scale with reputation (x' + (CFG.repValue[0] + (CFG.repValue[1] - CFG.repValue[0]) * S.rep / 100).toFixed(2) + ' now).</div></div>';
    h += '<div class="sec"><h3>Fundraising <span>' + (E.marketClosed() ? 'market closed to 15 Jun' : 'market open') + '</span></h3><div class="rows">';
    [['A', 'Series A'], ['B', 'Series B'], ['bridge', 'Bridge note (angels)']].forEach(function (x) {
      var st = E.roundStatus(x[0]), t = st.terms;
      var terms = x[0] === 'bridge' ? fmtMoney(t.cash) + ' for ' + pct(t.stake) : fmtMoney(t.cash) + ' at ' + fmtMoney(t.post) + ' post';
      h += '<div class="card' + (st.done ? ' off' : '') + '"><div class="c1"><b>' + x[1] + '</b><span class="num">' + terms + '</span></div>' +
        (st.done ? '<div class="c2">Raised.</div>' : '<div class="c2">Stake ' + pct(S.stake, 1) + ' → ' + pct(st.stakeAfter, 1) + (st.stakeAfter < 0.5 ? ' <span class="bad">(board takes over)</span>' : '') + (st.diligence ? ' · ' + st.diligence + ' days of diligence' : ' · cash today') + '</div>' +
        st.why.map(function (w) { return '<div class="why">' + esc(w) + '</div>'; }).join('') +
        '<div class="c3">' + btn('pitch', x[0] === 'bridge' ? 'Take the note' : 'Pitch', ' data-round="' + x[0] + '"', 'pri', !st.ok || S.phase !== 'play', 'pitch-' + x[0]) + '</div>') + '</div>';
    });
    h += '</div></div>';
    if (S.raise.rounds.length) h += '<div class="sec"><h3>Raised</h3><div class="c2 mut">' + S.raise.rounds.map(function (r) { return r.round + ' ' + E.fmtDay(r.day) + ': +' + fmtMoney(r.cash); }).join(' · ') + '</div></div>';
    setHTML($('b-money'), h);
    drawSpark();
  }
  function drawSpark() {
    var cv = $('spark-cash'); if (!cv || !cv.offsetParent) return;
    var w = cv.clientWidth, hh = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var css = getComputedStyle(root), acc = tok(css, '--accent', '#58e0c2'), line = tok(css, '--line', '#222'), bad = tok(css, '--danger', '#f55');
    var hist = S.cashHist.concat([S.bank]), mx = 1; hist.forEach(function (v) { mx = Math.max(mx, v); });
    c.strokeStyle = line; c.beginPath(); c.moveTo(0, hh - 0.5); c.lineTo(w, hh - 0.5); c.stroke();
    c.strokeStyle = S.bank < 0 ? bad : acc; c.lineWidth = 1.5; c.beginPath();
    hist.forEach(function (v, i) { var x = i / 365 * w, y = hh - 2 - Math.max(0, v) / mx * (hh - 4); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
  }

  /* ---------------- data ---------------- */
  function renderData() {
    var lo = S.wallLo, hi = S.wallHi;
    setText($('s-data'), 'wall ' + bigNum(lo) + '–' + bigNum(hi) + ' tokens' + (S.filterJob ? ' · filtering' : ''));
    var a = log10(1e10), z = log10(CFG.rawCrawl * 2);
    function px(v) { return clamp((log10(v) - a) / (z - a) * 100, 0, 100); }
    var use = ui.lastDesign ? ui.lastDesign.D : 0;
    var h = '<div class="sec"><h3>Clean-data wall <span>est. ' + bigNum(lo) + '–' + bigNum(hi) + ' tokens</span></h3>' +
      '<div class="wall" title="hatched: where the wall could be"><div class="use" style="width:' + px(Math.max(1e10, use)) + '%"></div><div class="rng" style="left:' + px(lo) + '%;width:' + Math.max(0.8, px(hi) - px(lo)) + '%"></div><span class="lbl">raw crawl ' + bigNum(CFG.rawCrawl) + '</span></div>' +
      '<div class="axis"><span>10B</span><span>100B</span><span>1T</span></div>' +
      '<div class="c2 mut" style="font-size:11.5px;margin-top:4px">Raw crawl on disk: ' + bigNum(CFG.rawCrawl) + ' tokens. Clean, usable text (up to ' + CFG.passes + ' passes): somewhere in the hatched band; the true wall is always inside it. Bar: the run you are designing (' + bigNum(use) + '). Junk appears in samples from ' + Math.round(CFG.cleanR * 100) + '% of the wall; past it, a run proves nothing.</div></div>';
    var ds = E.staff().filter(function (p) { return p.role === 'data'; });
    h += '<div class="sec"><h3>Filter jobs <span>' + S.filters + ' done</span></h3>';
    if (S.filterJob) h += '<div class="card"><div class="c1"><b>Filtering and dedup</b><span class="num">' + Math.max(0, Math.ceil(S.filterJob.until - S.day)) + ' days left</span></div><div class="c2">Done ' + E.fmtDay(S.filterJob.until) + '. Clean tokens x' + CFG.filter.mult + ' → est. ' + bigNum(lo * CFG.filter.mult) + '–' + bigNum(hi * CFG.filter.mult) + '. Runs launched before it finishes keep the old data.</div></div>';
    else if (!ds.length) h += '<div class="c2 why">No data person: nobody can filter. The wall stays where it is.</div>';
    else h += '<div class="mkrow"><span class="txt"><b>Next job</b>: ' + fmtMoney(E.filterCost()) + ', ' + E.filterDays() + ' days (' + ds.map(function (p) { return p.first; }).join(' + ') + '). Clean tokens x' + CFG.filter.mult + ' → est. ' + bigNum(lo * CFG.filter.mult) + '–' + bigNum(hi * CFG.filter.mult) + '. Each job costs double the last.</span>' + btn('filter', 'Start filter job', '', 'pri', S.phase !== 'play' || E.filterCost() > S.bank, 'filter-d') + '</div>';
    h += '</div>';
    h += '<div class="sec"><h3>Evidence <span>from samples you read and landing reviews</span></h3><div class="ev">';
    if (!S.evidence.length) h += '<div>Nothing yet. Every sample you read and every landing your data person reviews narrows the band.</div>';
    S.evidence.slice(0, 6).forEach(function (e) { h += '<div><span class="d">' + E.fmtDay(e.day) + '</span>Run ' + e.run + ': ' + esc(e.text) + ' (' + esc(e.src) + ')' + (e.changed ? ' <span class="chg">→ ' + bigNum(e.lo) + '–' + bigNum(e.hi) + '</span>' : '') + '</div>'; });
    h += '</div></div>';
    h += '<div class="sec"><h3>Capabilities <span>loss each one needs</span></h3><div class="kvt">';
    S.caps.forEach(function (c) {
      var range = c.fired ? 'at ' + c.L.toFixed(3) + ' nats' : 'between ' + E.Lline(c.hi).toFixed(2) + ' and ' + E.Lline(c.lo).toFixed(2) + ' nats';
      h += '<span>' + CFG.capNames[c.id] + ' <span class="dim">(' + CFG.capTests[c.id] + ')</span></span><span class="r ' + (c.fired ? 'acc' : 'sub') + '">' + (c.fired ? '✓ ' : '') + range + (c.known ? ' <span class="bad">leaked</span>' : '') + '</span>';
    });
    h += '</div><div class="c2 mut" style="font-size:11px;margin-top:3px">API revenue by best capability: ' + Object.keys(CFG.capRevenue).map(function (k) { return CFG.capNames[k] + ' ' + fmtMoney(CFG.capRevenue[k]); }).join(', ') + ' a month, scaled by reputation. Before the first filter job, a test set can leak into the crawl (' + Math.round(CFG.contamination * 100) + '% per capability).</div></div>';
    setHTML($('b-data'), h);
  }

  /* ---------------- rivals ---------------- */
  function renderRivals() {
    var fr = E.frontier();
    setText($('s-rivals'), 'frontier ' + sci(fr));
    var h = '<div class="sec"><h3>The frontier <span>' + sci(fr) + ' FLOPs</span></h3><div class="c2 mut" style="font-size:11.5px">The biggest result anyone has published. To stay relevant you must publish or ship something ≥ 1/100 of it (' + sci(E.relevanceNeed()) + ') every ' + CFG.relevanceDays + ' days. Your clock runs out ' + E.fmtDay(S.relevantUntil) + '.</div></div><div class="rows">';
    S.rivals.forEach(function (rv) {
      var c = E.rivalC(rv), center = c * Math.pow(10, rv.est), lo = center / Math.pow(10, CFG.rivalEstBand), hi = center * Math.pow(10, CFG.rivalEstBand);
      var lp = rv.pubs[rv.pubs.length - 1];
      h += '<div class="card rv"><div class="c1"><b>' + rv.name + '</b><span class="num">est. ' + sci(lo) + '–' + sci(hi) + '</span></div>' +
        '<div class="c2">' + esc(rv.blurb) + ' (fictional). Grows ~10x every ' + rv.tau + ' months; publishes every ~' + rv.period + ' days.</div>' +
        '<div class="lat">Latest: ' + bigNum(E.Nopt(lp.C)) + ' params, ' + sci(lp.C) + ' FLOPs, loss ' + lp.L.toFixed(2) + (lp.day >= 0 ? ', ' + E.fmtDay(lp.day) : ', 2019') + (rv.passedBy ? ' · <span class="acc">you passed it</span>' : '') + '</div>' +
        (rv.gained.length ? '<div class="c2">Hired from you or your board: ' + esc(rv.gained.join(', ')) + '</div>' : '') + '</div>';
    });
    if (S.day >= E.DAY.gpt3) h += '<div class="card"><div class="c1"><b>GPT-3 (real, published 28 May)</b><span class="num">3.14e23</span></div><div class="c2">175B parameters on 300B tokens. On the chart as the white point.</div></div>';
    h += '</div>';
    setHTML($('b-rivals'), h);
  }

  /* ---------------- news and inbox ---------------- */
  function renderNews() {
    var pend = S.inbox.length;
    setText($('s-news'), pend ? pend + ' decision' + (pend > 1 ? 's' : '') + ' waiting' : (S.news[0] ? E.fmtDay(S.news[0].day) + ': ' + plainText(S.news[0].text).slice(0, 60) : 'quiet'));
    var h = '';
    if (pend || S.decided.length) {
      h += '<div class="sec inbox"><h3>Inbox <span>' + (pend ? pend + ' waiting' : 'all answered') + '</span></h3><div class="rows">';
      S.inbox.forEach(function (d) { h += '<div class="card" data-k="in-' + d.id + '"><div class="c1"><b>' + esc(d.title) + '</b><span class="num">' + E.fmtDay(d.day) + '</span></div><div class="c3">' + btn('openDecision', 'Decide', ' data-id="' + d.id + '"', 'pri', false, 'od-' + d.id) + '</div></div>'; });
      S.decided.slice(0, 4).forEach(function (d) { var o = d.options.filter(function (x) { return x.key === d.answered; })[0]; h += '<div class="c2 mut" style="font-size:11px"><span class="mono dim">' + E.fmtDay(d.answeredDay) + '</span> ' + esc(d.title) + ' → ' + esc(o ? o.label : d.answered) + '</div>'; });
      h += '</div></div>';
    }
    var f = ui.feed;
    h += '<div class="sec"><h3>Feed</h3><div class="filters" role="group" aria-label="Filter the feed">' + [['all', 'All'], ['history', '2020'], ['lab', 'Lab'], ['money', 'Money'], ['people', 'People'], ['rival', 'Rivals']].map(function (x) { return '<button type="button" data-act="feed" data-f="' + x[0] + '" data-k="feed-' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div class="feed">';
    var items = [];
    S.news.forEach(function (n) { items.push({ day: n.day, text: n.text, eff: n.effect, cls: n.real ? 'real' : 'money', cat: n.real ? 'history' : 'money', order: 1 }); });
    S.log.forEach(function (l, i) { var cat = l.kind === 'run' || l.kind === 'hang' || l.kind === 'data' || l.kind === 'cards' ? 'lab' : l.kind === 'bad' ? 'lab' : l.kind; items.push({ day: l.day, text: l.text, cls: l.kind, cat: cat, order: 2 + i / 1e4 }); });
    items.sort(function (a, b) { return b.day - a.day || b.order - a.order; });
    var n = 0;
    items.forEach(function (it) {
      if (n >= 60) return;
      if (f !== 'all' && it.cat !== f && !(f === 'lab' && it.cls === 'bad')) return;
      n++;
      h += '<div class="it ' + esc(it.cls) + '"><span class="d">' + E.fmtDay(it.day) + (it.cls === 'real' ? ' 2020 · history' : '') + '</span>' + esc(it.text) + (it.eff ? '<span class="eff">' + esc(it.eff) + '</span>' : '') + '</div>';
    });
    if (!n) h += '<div class="it">Nothing yet.</div>';
    h += '</div></div>';
    setHTML($('b-news'), h);
  }

  function renderPanels() {
    if (!S) return;
    renderTrain(); renderDesigner(); renderTeam(); renderCluster(); renderMoney(); renderData(); renderRivals(); renderNews();
  }
  function renderAll() { renderTop(0); renderPanels(); drawChart(); }

  /* ---------------- decisions ---------------- */
  function syncModal() {
    var m = $('modal');
    if (!S || S.phase !== 'play' || !S.inbox.length) { if (!m.hidden) { m.hidden = true; ui.modalId = null; } return; }
    var d = S.inbox[0];
    if (ui.modalId === d.id && !m.hidden) return;
    ui.modalId = d.id;
    setText($('m-from'), d.from || (d.kind === 'landing' ? 'TRAINING' : d.kind === 'scandal' ? 'THE PRESS' : 'FRONTIER'));
    setText($('m-title'), d.title);
    setText($('m-body'), d.body);
    setText($('m-note'), d.note || '');
    var ms = $('m-sample');
    if (d.kind === 'landing' && S.lastSample && S.lastSample.run === d.runId) { ms.innerHTML = sampleHTML(S.lastSample.text); ms.className = 'm-sample' + (S.lastSample.amt === E.CRAWL ? ' crawl' : ''); }
    else { ms.innerHTML = ''; ms.className = 'm-sample'; }
    var h = '';
    d.options.forEach(function (o, i) {
      h += '<button type="button" class="opt' + (i === 0 && !o.disabled ? ' primary' : '') + '" data-act="answer" data-id="' + d.id + '" data-choice="' + o.key + '"' + (o.disabled ? ' disabled' : '') + '><b>' + esc(o.label) + '</b><span' + (o.disabled ? ' class="no"' : '') + '>' + esc(o.disabled ? (o.why || o.detail) : o.detail) + '</span></button>';
    });
    $('m-opts').innerHTML = h;
    m.hidden = false;
    var first = m.querySelector('.opt:not(:disabled)'); if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
    m.querySelector('.sheet').scrollTop = 0;
  }
  function showEnd() {
    ui.endShown = true; ui.endClosed = false;
    var e = S.end, el = $('end');
    el.className = 'modal end ' + e.kind;
    setText($('e-date'), E.fmtLong(Math.min(365, e.day)));
    setText($('e-title'), e.title);
    setText($('e-reason'), e.reason);
    setText($('e-gap'), e.gap);
    var sc = e.score;
    $('e-score').innerHTML = '<span>Best model (' + esc(sc.best) + ')</span><span class="r">' + sc.model + '</span><span>Reputation ' + Math.round(S.rep) + ' x' + CFG.score.repMult + '</span><span class="r">' + sc.rep + '</span><span>API revenue ' + fmtMoney(S.stats.apiRevenue) + '</span><span class="r">' + sc.revenue + '</span><span>People kept: ' + E.staff().length + '</span><span class="r">' + sc.people + '</span>' +
      '<span class="tot">' + (e.kind === 'survived' ? 'Score' : 'Score (did not survive: shown for reference)') + '</span><span class="r tot">' + sc.total + (sc.miracle ? ' · MIRACLE' : '') + '</span>';
    el.hidden = false; $('modal').hidden = true; root.classList.add('over');
    var b = el.querySelector('.opt'); if (b) try { b.focus({ preventScroll: true }); } catch (x) {}
    store('frontier-a-last', JSON.stringify({ kind: e.kind, score: sc.total }));
  }

  /* ---------------- input ---------------- */
  function gesture() { AU.unlock(); }
  root.addEventListener('pointerdown', gesture, { passive: true });
  root.addEventListener('keydown', gesture);
  root.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null; if (!t || !root.contains(t)) return;
    var a = t.getAttribute('data-act'); if (t.disabled) return;
    handle(a, t, e);
  });
  function handle(a, t, e) {
    var r;
    switch (a) {
      case 'speed': setSpeed(+t.getAttribute('data-x')); break;
      case 'mute': AU.setMuted(!AU.muted); syncMute(); break;
      case 'jump': jump(t.getAttribute('data-to')); break;
      case 'toggle': if (wide()) return; var p = t.parentNode; var open = !p.classList.contains('open'); p.classList.toggle('open', open); t.setAttribute('aria-expanded', String(open)); ui.dirty = true; break;
      case 'pool': ui.des.pool = t.getAttribute('data-pool'); ui.des.gpusMax = true; syncDesignerInputs(); renderDesigner(); break;
      case 'preset': applyPreset(t.getAttribute('data-p')); break;
      case 'launch': r = E.act('launch', { params: ui.des.N, tokens: ui.des.D, gpus: ui.des.gpus, pool: ui.des.pool }); if (r.ok) { AU.launch(); AU.vibrate(10); if (!ui.everStarted) setSpeed(1); ui.des.gpusMax = true; syncDesignerInputs(); } break;
      case 'select': if (e && e.target.closest('button')) return; E.act('select', { id: +t.getAttribute('data-id') }); break;
      case 'sample': r = E.act('sample', { id: +t.getAttribute('data-id') }); if (r.ok) wordTicks(r.sample.text); break;
      case 'move': E.act('move', { id: +t.getAttribute('data-id') }); ui.des.gpusMax = true; syncDesignerInputs(); break;
      case 'abort': var id = +t.getAttribute('data-id'); if (ui.stopArm && ui.stopArm.id === id && performance.now() - ui.stopArm.t < 3500) { ui.stopArm = null; E.act('abort', { id: id }); } else ui.stopArm = { id: id, t: performance.now() }; break;
      case 'raisepay': E.act('raisePay', { id: t.getAttribute('data-id') }); AU.tick(false); break;
      case 'hire': r = E.act('hire', { id: t.getAttribute('data-id') }); if (r.ok) AU.tick(true); break;
      case 'filter': E.act('filter'); break;
      case 'step': var s = t.getAttribute('data-s'), dd = +t.getAttribute('data-d'); if (s === 'rent') ui.rentN = Math.max(8, ui.rentN + dd); else ui.buy[s] = clamp(ui.buy[s] + dd, 1, CFG.buyMaxUnits); AU.tick(dd > 0); break;
      case 'rent': E.act('rent', { gpus: ui.rentN }); AU.tick(false); break;
      case 'cancelRent': E.act('cancelRent', { id: t.getAttribute('data-id') }); break;
      case 'buy': E.act('buy', { item: t.getAttribute('data-item'), units: ui.buy[t.getAttribute('data-item')] }); break;
      case 'rentOut': E.act('rentOut', { pool: E.poolFree('office') > 0 ? 'office' : 'a100' }); if (E.poolFree('a100') > 0 && E.poolFree('office') === 0) {} break;
      case 'pitch': E.act('raise', { round: t.getAttribute('data-round') }); break;
      case 'priority': E.act('priority', {}); break;
      case 'feed': ui.feed = t.getAttribute('data-f'); break;
      case 'openDecision': ui.modalId = null; syncModal(); break;
      case 'answer': r = E.act('answer', { id: t.getAttribute('data-id'), choice: t.getAttribute('data-choice') }); ui.modalId = null; if (r.ok) AU.tick(true); break;
      case 'newyear': newGame(); break;
      case 'review': $('end').hidden = true; ui.endClosed = true; break;
    }
    ui.dirty = true; renderPanels();
  }
  function wordTicks(text) { var n = Math.min(24, plainText(text).split(' ').length); for (var i = 0; i < n; i++) setTimeout(AU.word, i * 45); }
  function jump(id) {
    var p = $(id); if (!p) return;
    if (!wide() && p.classList.contains('col') && !p.classList.contains('open')) { p.classList.add('open'); var b = p.querySelector('.ph'); if (b) b.setAttribute('aria-expanded', 'true'); renderPanels(); }
    p.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }
  function syncMute() { var m = $('mute'); m.setAttribute('aria-pressed', String(AU.muted)); m.setAttribute('aria-label', AU.muted ? 'Sound is off. Press to unmute (M)' : 'Sound is on. Press to mute (M)'); }
  // designer inputs
  $('d-gpus').addEventListener('input', function (e) { ui.des.gpus = +e.target.value; ui.des.gpusMax = ui.des.gpus >= E.poolFree(ui.des.pool); renderDesigner(); });
  $('d-n').addEventListener('input', function (e) { ui.des.N = vToN(+e.target.value); if (ui.des.recipe) { ui.des.D = clamp(E.recipeForN(ui.des.N).D, CFG.designer.dMin, CFG.designer.dMax); $('d-d').value = String(dToV(ui.des.D)); } renderDesigner(); });
  $('d-d').addEventListener('input', function (e) { ui.des.D = vToD(+e.target.value); if (ui.des.recipe) { ui.des.N = clamp(recipeForD(ui.des.D).N, CFG.designer.nMin, CFG.designer.nMax); $('d-n').value = String(nToV(ui.des.N)); } renderDesigner(); });
  $('d-recipe').addEventListener('change', function (e) { ui.des.recipe = !!e.target.checked; if (ui.des.recipe) { ui.des.D = clamp(E.recipeForN(ui.des.N).D, CFG.designer.dMin, CFG.designer.dMax); $('d-d').value = String(dToV(ui.des.D)); } renderDesigner(); });
  // keys
  document.addEventListener('keydown', function (e) {
    if (!S) return;
    var tag = e.target && e.target.tagName, inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT', onBtn = tag === 'BUTTON';
    if (e.key === ' ' || e.code === 'Space') { if (onBtn || (inField && e.target.type !== 'range')) return; e.preventDefault(); togglePause(); return; }
    if (inField && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') { AU.setMuted(!AU.muted); syncMute(); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(2); else if (e.key === '3' || e.key === '4') setSpeed(4);
    else if ((e.key === 's' || e.key === 'S') && S.phase === 'play') { var r = E.act('sample', {}); if (r.ok) wordTicks(r.sample.text); ui.dirty = true; }
  });
  document.addEventListener('visibilitychange', function () { AU.suspend(document.hidden); });
  window.addEventListener('resize', function () { ui.dirty = true; });

  /* ---------------- the test hook (playtesters and bots) ---------------- */
  function plainState() {
    if (!S) return null;
    var ls = S.lastSample;
    return {
      seed: ui.seed, date: E.fmtLong(Math.min(S.day, 365)), day: +S.day.toFixed(3), phase: S.phase, end: S.end ? { kind: S.end.kind, reason: S.end.reason, gap: S.end.gap, score: S.end.score.total } : null,
      speed: ui.speed, blocked: E.blocked(), bank: Math.round(S.bank), burn: Math.round(E.burn()), runway: E.runway() === Infinity ? null : +E.runway().toFixed(2), rep: Math.round(S.rep), stake: +S.stake.toFixed(4),
      computePFperDay: +(E.flopsPerDay(true) / 8.64e19).toFixed(3), relevantUntil: S.relevantUntil, relevanceNeed: E.relevanceNeed(), frontier: E.frontier(),
      inbox: S.inbox.map(function (d) { return { id: d.id, kind: d.kind, title: d.title, options: d.options.map(function (o) { return { key: o.key, disabled: !!o.disabled }; }) }; }),
      runs: S.runs.map(function (r) { return { id: r.id, state: r.state, q: +r.q.toFixed(4), C: r.C, N: r.N, D: r.D, pool: r.pool, cards: r.cards, loss: r.loss, clean: r.clean, onLine: r.onLine, published: r.published, shipped: r.shipped, kept: r.kept, hangs: r.hangs.length, hung: !!r.hang, caps: r.capsOn }; }),
      lastSample: ls ? { run: ls.run, q: ls.q, text: plainText(ls.text), junk: ls.amt, loss: +ls.loss.toFixed(3) } : null,
      wall: { lo: Math.round(S.wallLo), hi: Math.round(S.wallHi), filters: S.filters, filterJob: S.filterJob ? Math.ceil(S.filterJob.until - S.day) : null },
      team: E.staff().map(function (p) { return { id: p.key, role: p.role, salary: p.salary, mood: Math.round(p.mood) }; }),
      cands: S.cands.map(function (c) { return { id: c.key, ask: E.candAsk(c), blocked: E.candReq(c) || null }; }),
      cluster: CFG.pools.map(function (p) { return E.poolInfo(p); }), rented: E.rentedCount(), orders: S.orders.length, meridian: S.mer ? { cards: S.mer.cards, alloc: S.mer.alloc, live: S.mer.live } : null,
      raise: { aDone: S.raise.aDone, bDone: S.raise.bDone, diligence: S.raise.diligence ? S.raise.diligence.round : null },
      best: E.bestRun() ? { C: E.bestRun().Cland, loss: E.bestRun().loss } : null, log: S.log.slice(-60).map(function (l) { return E.fmtDay(l.day) + ' ' + l.text; }), news: S.news.length, caps: S.caps.filter(function (c) { return c.fired; }).map(function (c) { return c.id; })
    };
  }
  window.__frontier = {
    state: plainState,
    act: function (name, p) {
      p = p || {};
      var r;
      if (name === 'speed') { setSpeed(+(p.x != null ? p.x : p.speed || 1)); r = { ok: true }; }
      else if (name === 'pause') { setSpeed(0); r = { ok: true }; }
      else if (name === 'newyear') { newGame(p.seed); r = { ok: true }; }
      else if (name === 'design') { r = { ok: true, design: E.design(p) }; }
      else { r = E.act(name, p); }
      ui.dirty = true; ui.modalId = null; renderPanels();
      return r;
    },
    speed: function (n) { ui.botMult = Math.max(0.1, +n || 1); return ui.botMult; },
    advance: function (days) { if (S && S.phase === 'play') E.advance(+days || 1); ui.dirty = true; return plainState(); }
  };

  syncMute();
  newGame(seedFromHash());
  requestAnimationFrame(frame);
})();
