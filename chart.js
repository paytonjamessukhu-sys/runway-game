/* FRONTIER control room, build A: the curve. The one loud thing on the screen.
   Error score (lower is better) against compute, both on log scales. The white dashed line is "the loss you should get for the
   compute you spent"; your dots sit on it or above it, and the gap is how well you ran. One dimension line runs from your
   biggest dot to the GPT-3 ring and says how many times short you are. */
(function () {
  'use strict';
  var FX = window.FX, CFG = FX.CFG, FE = FX.FE, log10 = FE.log10, clamp = FE.clamp;
  var COL = null;
  function readColors() {
    var css = getComputedStyle(FX.root);
    function g(n, d) { var v = (css.getPropertyValue(n) || '').trim(); return v || d; }
    COL = { line: g('--line', '#1e2731'), line2: g('--line2', '#2a3541'), text: g('--text', '#dde4ec'), muted: g('--muted', '#8b97a5'), dim: g('--dim', '#5d6977'), acc: g('--accent', '#58e0c2'), acc2: g('--accent2', '#2a8f7c'),
      bad: g('--danger', '#ff5f57'), cau: g('--caution', '#e39b95'), rival: g('--rival', '#8a96a3'), white: g('--white', '#f2f5f8'), bg: g('--panel', '#0f141b'), mono: g('--mono', 'monospace'), sans: g('--sans', 'sans-serif'), gain: g('--gain', '#6bd968') };
  }
  var geom = null;
  FX.chartGeom = function () { return geom; };

  FX.drawChart = function () {
    var E = FX.E, S = FX.S, ui = FX.ui; if (!S) return;
    var cv = FX.$('chart'); if (!cv) return;
    var wrap = cv.parentNode, w = wrap.clientWidth, h = wrap.clientHeight; if (w < 10 || h < 10) return;
    if (!COL) readColors();
    var dpr = Math.min(2, window.devicePixelRatio || 1), W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
    if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var small = w < 520, fs = small ? 10 : 11;
    var padL = small ? 30 : 40, padR = small ? 10 : 18, padT = small ? 30 : 34, padB = small ? 32 : 36;
    var x0 = CFG.chart.xMin, x1 = CFG.chart.xMax, yLo = Math.log(CFG.chart.yMin), yHi = Math.log(CFG.chart.yMax);
    var pw = w - padL - padR, ph = h - padT - padB;
    function X(lc) { return padL + (lc - x0) / (x1 - x0) * pw; }
    function Y(L) { return padT + (yHi - Math.log(L)) / (yHi - yLo) * ph; }
    geom = { X: X, Y: Y, padL: padL, padR: padR, padT: padT, padB: padB, w: w, h: h, dots: [] };
    var t = performance.now();

    // ---- grid: a tick every ten times more compute, no numbers (the caption says what a tick is)
    c.font = fs + 'px ' + COL.mono; c.lineWidth = 1;
    c.strokeStyle = COL.line;
    for (var d = Math.ceil(x0); d <= Math.floor(x1); d++) { var gx = Math.round(X(d)) + 0.5; c.beginPath(); c.moveTo(gx, padT); c.lineTo(gx, padT + ph); c.stroke(); }
    c.fillStyle = COL.dim; c.textAlign = 'right'; c.textBaseline = 'middle';
    [2, 3, 4, 6, 10].forEach(function (L) { var gy = Math.round(Y(L)) + 0.5; c.strokeStyle = COL.line; c.beginPath(); c.moveTo(padL, gy); c.lineTo(padL + pw, gy); c.stroke(); c.fillText(String(L), padL - 5, gy); });
    c.strokeStyle = COL.line2; c.beginPath(); c.moveTo(padL + 0.5, padT); c.lineTo(padL + 0.5, padT + ph + 0.5); c.lineTo(padL + pw, padT + ph + 0.5); c.stroke();
    // axis ticks along the bottom: one per ten times more compute
    c.strokeStyle = COL.dim; for (d = Math.ceil(x0); d <= Math.floor(x1); d++) { var tx = Math.round(X(d)) + 0.5; c.beginPath(); c.moveTo(tx, padT + ph); c.lineTo(tx, padT + ph + 4); c.stroke(); }
    // axis captions
    c.fillStyle = COL.muted; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(small ? 'error score, lower is better ↓' : 'error score, lower is better ↓', 4, 6);
    c.textAlign = 'right'; c.textBaseline = 'bottom';
    c.fillText(small ? 'compute: each tick is 10x more →' : 'compute: each tick is ten times more →', w - padR, h - 6);

    // ---- the Series A bar: dim until the third rung is lit
    var L = E.ladder(), rung = L.rungs[L.lit], aLit = rung && rung.id === 'seriesA';
    if (!S.raise.aDone && log10(S.raise.aNeed) <= x1) {
      var ax = Math.round(X(log10(S.raise.aNeed))) + 0.5;
      c.save(); c.globalAlpha = aLit ? 0.8 : 0.3; c.strokeStyle = aLit ? COL.acc : COL.muted; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(ax, padT); c.lineTo(ax, padT + ph); c.stroke(); c.setLineDash([]);
      c.fillStyle = aLit ? COL.acc : COL.muted; c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('Series A', ax - 4, padT + 3); c.restore();
    }

    // ---- the line: the loss you should get for the compute you spent
    c.save(); c.strokeStyle = COL.white; c.globalAlpha = S.day >= E.DAY.line ? 0.62 : 0.3; c.lineWidth = 1.2; c.beginPath();
    for (var lc = x0; lc <= x1 + 1e-9; lc += 0.05) { var ly = Y(E.Lline(Math.pow(10, lc))); if (lc === x0) c.moveTo(X(lc), ly); else c.lineTo(X(lc), ly); }
    c.stroke(); c.restore();
    // caption riding on the line
    var cl = small ? 17.15 : 17.3, cx = X(cl), cy = Y(E.Lline(Math.pow(10, cl))), cl2 = cl + 1, ang = Math.atan2(Y(E.Lline(Math.pow(10, cl2))) - cy, X(cl2) - cx);
    c.save(); c.translate(cx, cy); c.rotate(ang); c.fillStyle = COL.muted; c.globalAlpha = 0.95; c.textAlign = 'left'; c.textBaseline = 'top';
    c.font = 'italic ' + fs + 'px ' + COL.sans;
    if (small) { c.fillText('the loss you should get', 4, 5); c.fillText('for the compute you spent', 4, 5 + fs + 2); }
    else c.fillText('the loss you should get for the compute you spent', 4, 5);
    c.restore();
    c.font = fs + 'px ' + COL.mono;

    // ---- GPT-3
    var gx3 = X(log10(CFG.gpt3.C)), gy3 = Y(CFG.gpt3.L), real = S.day >= E.DAY.gpt3;
    c.save(); c.strokeStyle = COL.white; c.lineWidth = 1.6;
    if (!real) c.setLineDash([2, 2]);
    c.beginPath(); c.arc(gx3, gy3, 7, 0, 6.2832); c.stroke(); c.setLineDash([]);
    if (real) { c.fillStyle = COL.white; c.beginPath(); c.arc(gx3, gy3, 2.8, 0, 6.2832); c.fill(); }
    c.fillStyle = COL.white; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(real ? 'GPT-3' : 'GPT-3 size', Math.min(gx3, w - padR - c.measureText('GPT-3 size').width / 2 + 4), gy3 + 10); c.restore();

    // ---- rivals: quiet grey
    var used = [];
    S.rivals.forEach(function (rv) {
      var pts = rv.pubs.filter(function (p) { return log10(p.C) >= x0; }).map(function (p) { return [X(log10(p.C)), Y(clamp(p.L, CFG.chart.yMin, CFG.chart.yMax)), p]; });
      c.save(); c.strokeStyle = COL.rival; c.fillStyle = COL.rival; c.globalAlpha = 0.55; c.setLineDash([2, 3]);
      if (pts.length > 1) { c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); }
      c.setLineDash([]); pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 2.4, 0, 6.2832); c.fill(); });
      var lp = pts[pts.length - 1];
      if (lp) {
        c.globalAlpha = 0.9; c.textAlign = 'left'; c.textBaseline = 'middle';
        var lab = small ? rv.name : rv.name, ly2 = lp[1] - 10, lx = lp[0] + 5;
        used.forEach(function (b) { if (Math.abs(b - ly2) < fs + 2) ly2 -= fs + 2; });
        used.push(ly2);
        if (lx + c.measureText(lab).width > w - 4) { c.textAlign = 'right'; lx = lp[0] - 5; }
        c.fillText(lab, lx, ly2);
      }
      c.restore();
    });

    // ---- your runs: finished curves faint, the live curve bright white and pouring
    S.runs.forEach(function (r) {
      if (r.state === 'aborted' || !r.pts.length) return;
      var live = r.state === 'train';
      c.save(); c.strokeStyle = COL.white; c.globalAlpha = live ? 0.95 : 0.22; c.lineWidth = live ? 1.8 : 1; c.lineJoin = 'round';
      c.beginPath(); var started = false;
      for (var i = 0; i < r.pts.length; i++) { var p = r.pts[i], lcx = log10(p[0] * r.C); if (lcx < x0) continue; var px = X(lcx), py = Y(clamp(p[1], CFG.chart.yMin, CFG.chart.yMax)); if (!started) { c.moveTo(px, py); started = true; } else c.lineTo(px, py); }
      c.stroke(); c.restore();
      if (live && r.pts.length) {
        var hp = r.pts[r.pts.length - 1], hx = X(Math.max(x0, log10(hp[0] * r.C))), hy = Y(clamp(hp[1], CFG.chart.yMin, CFG.chart.yMax));
        // where it is headed
        var tx2 = X(log10(r.C)), ty2 = Y(clamp(r.projAtLaunch, CFG.chart.yMin, CFG.chart.yMax));
        c.save(); c.globalAlpha = 0.45; c.strokeStyle = COL.acc; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx2, ty2); c.stroke(); c.setLineDash([]); c.beginPath(); c.arc(tx2, ty2, 4, 0, 6.2832); c.stroke(); c.restore();
        c.save(); c.fillStyle = r.hang ? COL.bad : COL.acc;
        if (!FX.reduced() && !r.hang) { c.globalAlpha = 0.22; c.beginPath(); c.arc(hx, hy, 8 + 2.5 * Math.sin(t / 220), 0, 6.2832); c.fill(); }
        c.globalAlpha = 1; c.beginPath(); c.arc(hx, hy, 3.8, 0, 6.2832); c.fill();
        c.textAlign = hx > w - 90 ? 'right' : 'left'; c.textBaseline = 'bottom'; c.fillText((r.hang ? 'dropped ' : '') + Math.round(r.q * 100) + '%', hx + (c.textAlign === 'left' ? 7 : -7), hy - 5); c.restore();
      }
    });

    // ---- your saved models: teal dots; a ring when published; a bar when it is an API
    var far = E.farthestClean(), farRun = null;
    S.runs.forEach(function (r) {
      if (r.state !== 'landed') return;
      var lcx = log10(r.Cland); if (lcx < x0) return;
      var x = X(lcx), y = Y(clamp(r.loss, CFG.chart.yMin, CFG.chart.yMax));
      if (r.clean && r.Cland === far) farRun = { x: x, y: y, r: r };
      var thunk = ui.thunkRun === r.id && ui.thunkAt && t - ui.thunkAt < 700;
      if (ui.thunkRun === r.id && !ui.thunkAt) ui.thunkAt = t;
      c.save();
      if (r.clean) {
        if (!FX.reduced()) { c.globalAlpha = 0.18; c.fillStyle = COL.acc; c.beginPath(); c.arc(x, y, thunk ? 12 + (700 - (t - ui.thunkAt)) / 40 : 8, 0, 6.2832); c.fill(); }
        c.globalAlpha = 1; c.fillStyle = COL.acc; c.beginPath(); c.arc(x, y, 4.6, 0, 6.2832); c.fill();
      } else { c.strokeStyle = COL.bad; c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, 4.2, 0, 6.2832); c.stroke(); c.beginPath(); c.moveTo(x - 3, y - 3); c.lineTo(x + 3, y + 3); c.moveTo(x + 3, y - 3); c.lineTo(x - 3, y + 3); c.stroke(); }
      if (r.published) { c.strokeStyle = COL.acc; c.lineWidth = 1; c.globalAlpha = 0.9; c.beginPath(); c.arc(x, y, 8, 0, 6.2832); c.stroke(); }
      if (r.shipped) { c.strokeStyle = COL.white; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + 9, y); c.lineTo(x + 15, y); c.stroke(); }
      if (r.scandal) { c.strokeStyle = COL.bad; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 7, y - 7); c.lineTo(x + 7, y + 7); c.stroke(); }
      c.restore();
      geom.dots.push({ x: x, y: y, id: r.id });
    });
    if (ui.thunkAt && t - ui.thunkAt > 800) { ui.thunkAt = 0; ui.thunkRun = null; }

    // ---- the designer's ghost: where the run you are planning would land
    var g = ui.lastDesign, ghost = null;
    if (S.phase === 'play' && g && g.cards > 0 && g.C > 0) {
      var gxx = X(clamp(log10(g.C), x0, x1)), gyy = Y(clamp(g.proj, CFG.chart.yMin, CFG.chart.yMax));
      ghost = { x: gxx, y: gyy };
      var nearDot = geom.dots.some(function (d) { return Math.hypot(d.x - gxx, d.y - gyy) < 18; });
      c.save(); c.strokeStyle = g.ok ? COL.white : COL.bad; c.globalAlpha = 0.8; c.setLineDash([2, 2]);
      c.beginPath(); c.moveTo(gxx, Y(clamp(g.hi, CFG.chart.yMin, CFG.chart.yMax))); c.lineTo(gxx, Y(clamp(g.lo, CFG.chart.yMin, CFG.chart.yMax))); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(gxx - 5, gyy); c.lineTo(gxx + 5, gyy); c.moveTo(gxx, gyy - 5); c.lineTo(gxx, gyy + 5); c.stroke();
      c.fillStyle = g.ok ? COL.white : COL.bad; c.textAlign = gxx > w - 110 ? 'right' : 'left'; c.textBaseline = 'top';
      if (!nearDot) { c.textBaseline = 'bottom'; c.fillText('your plan', gxx + (c.textAlign === 'left' ? 8 : -8), gyy - 6); }
      c.restore();
    }

    // ---- the dimension line: your biggest dot to the GPT-3 ring
    var from = farRun, txt = null, dim = false;
    if (farRun) { var sh = CFG.gpt3.C / far; txt = sh < 1.05 ? 'passed it' : E.shortFmt(sh) + ' short'; }
    else if (ghost && g.ok) { from = { x: ghost.x, y: ghost.y }; txt = E.shortFmt(CFG.gpt3.C / g.C) + ' short if it lands'; dim = true; }
    if (from && txt && Math.abs(from.x - gx3) > 18) {
      c.save(); c.strokeStyle = COL.white; c.globalAlpha = dim ? 0.35 : 0.85; c.lineWidth = 1; c.setLineDash(dim ? [2, 3] : []);
      var dx = gx3 - from.x, dy = gy3 - from.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      var sx = from.x + ux * 9, sy = from.y + uy * 9, ex = gx3 - ux * 10, ey = gy3 - uy * 10;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
      // end ticks, perpendicular to the line
      var nx = -uy * 4, ny = ux * 4; c.beginPath(); c.moveTo(sx + nx, sy + ny); c.lineTo(sx - nx, sy - ny); c.moveTo(ex + nx, ey + ny); c.lineTo(ex - nx, ey - ny); c.stroke();
      // the label sits on a small pill at the middle
      var mx = sx + (ex - sx) * 0.4, my = sy + (ey - sy) * 0.4, tw = c.measureText(txt).width + 12;
      c.globalAlpha = 1; c.fillStyle = COL.bg; c.fillRect(mx - tw / 2, my - 9, tw, 18);
      c.strokeStyle = dim ? COL.dim : COL.white; c.globalAlpha = dim ? 0.5 : 0.9; c.strokeRect(mx - tw / 2 + 0.5, my - 8.5, tw - 1, 17);
      c.globalAlpha = dim ? 0.7 : 1; c.fillStyle = COL.white; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '500 ' + fs + 'px ' + COL.mono; c.fillText(txt, mx, my + 0.5);
      c.restore();
    }
  };

  // tap a dot to open its model card
  var cv0 = FX.$('chart');
  if (cv0) cv0.addEventListener('click', function (e) {
    if (!geom) return;
    var r = cv0.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 22;
    geom.dots.forEach(function (d) { var dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = d; } });
    if (best && FX.openCard) FX.openCard(best.id);
  });
})();
