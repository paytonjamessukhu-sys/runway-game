/* FRONTIER, the paper: the curve drawn as ink on cold log paper.
   Error score (lower is better) against compute, both on log scales, on a decade grid. The dotted graphite line is "the loss you should get
   for the compute you spent"; your finished runs are thin ink curves, the live run is a pen with a dot at its tip, your saved models are dots
   (a ring when published, a bar when it is an API), rivals are graphite dots with small labels, GPT-3 is the ring, the data wall is a
   vermilion hatch, and one ink dimension line runs from your biggest dot to the ring and says how many times short you are.
   Under the plot runs the calendar: month initials, the days your runs ran, history's phrases on their dates, and today's cursor. */
(function () {
  'use strict';
  var FX = window.FX, CFG = FX.CFG, FE = FX.FE, W = FX.W, log10 = FE.log10, clamp = FE.clamp;
  var COL = null, FONT = null;
  function readColors() {
    var css = getComputedStyle(FX.root);
    function g(n, d) { var v = (css.getPropertyValue(n) || '').trim(); return v || d; }
    COL = { paper: g('--paper', '#E4E5E1'), ink: g('--ink', '#15171A'), grid: g('--grid', '#CCCFCA'), graphite: g('--graphite', '#6E7378'), reserve: g('--reserve', '#F8F8F5'), verm: g('--vermilion', '#E5482E'), dry: g('--dry', '#A9ACAA') };
    FONT = { mono: g('--mono', 'monospace'), serif: g('--serif', 'serif'), hand: g('--hand', 'cursive') };
  }
  FX.readPaperColors = function () { COL = null; };
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  var geom = null;
  FX.chartGeom = function () { return geom; };
  var MON = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  function boxHits(b, list) { var n = 0; for (var i = 0; i < list.length; i++) { var o = list[i]; if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) n += o.k || 1; } return n; }

  FX.drawChart = function () {
    var E = FX.E, S = FX.S, ui = FX.ui; if (!S) return;
    var cv = FX.$('chart'); if (!cv) return;
    var wrap = cv.parentNode, w = wrap.clientWidth, h = wrap.clientHeight; if (w < 10 || h < 10) return;
    if (!COL) readColors();
    var dpr = Math.min(2, window.devicePixelRatio || 1), W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
    if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var laptop = w >= 560, mono = function (px, it, wt) { return (it ? 'italic ' : '') + (wt || 400) + ' ' + px + 'px ' + FONT.mono; }, hand = function (px, wt) { return (wt || 400) + ' ' + px + 'px ' + FONT.hand; };
    var marginPx = parseFloat(getComputedStyle(FX.root).getPropertyValue('--margin')) || 58;
    var padL = marginPx, padR = laptop ? 12 : 8, padT = laptop ? 30 : 38, rulerH = 40, axisH = 16;
    var plotX = padL, plotW = w - padL - padR, plotY = padT, plotH = Math.max(60, h - padT - axisH - rulerH - 4), plotR = plotX + plotW, plotB = plotY + plotH;
    var x0 = CFG.chart.xMin, x1 = CFG.chart.xMax, yLo = Math.log(CFG.chart.yMin), yHi = Math.log(CFG.chart.yMax);
    function X(lc) { return plotX + (lc - x0) / (x1 - x0) * plotW; }
    function Y(L) { return plotY + (yHi - Math.log(clamp(L, CFG.chart.yMin, CFG.chart.yMax))) / (yHi - yLo) * plotH; }
    function dayX(day) { return plotX + clamp(day / (CFG.yearDays), 0, 1) * plotW; }
    geom = { X: X, Y: Y, w: w, h: h, dots: [], plot: { x: plotX, y: plotY, w: plotW, h: plotH } };
    var t = performance.now(), red = FX.reduced(), occ = [];
    var fs = laptop ? 10 : 9;
    c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineCap = 'round';
    function halo(txt, x, y, a) { c.lineWidth = 3; c.strokeStyle = rgba(COL.paper, a == null ? 0.9 : a); c.strokeText(txt, x, y); }
    function place(x, y, bw, bh, cands, optional) {
      var list = cands.concat([[8, -bh - 14], [-bw - 8, -bh - 14], [8, 22], [-bw - 8, 22], [-bw / 2, -bh - 28], [-bw / 2, 34]]), best = null, bestN = Infinity;
      for (var i = 0; i < list.length; i++) {
        var b = { x: clamp(x + list[i][0], plotX + 1, plotR - bw - 1), y: clamp(y + list[i][1], plotY, plotB - bh - 2), w: bw, h: bh, k: 50 };
        var nh = boxHits({ x: b.x - 6, y: b.y - 2, w: bw + 12, h: bh + 4 }, occ);
        if (!nh) { occ.push(b); return b; }
        if (nh < bestN) { bestN = nh; best = b; }
      }
      if (optional) return null;
      best = best || { x: clamp(x + cands[0][0], plotX + 1, plotR - bw - 1), y: clamp(y + cands[0][1], plotY, plotB - bh - 2), w: bw, h: bh, k: 50 };
      occ.push(best); return best;
    }

    // ---- the decade grid: log-log paper
    c.lineWidth = 1; c.strokeStyle = COL.grid; c.beginPath();
    for (var d = Math.ceil(x0); d <= Math.floor(x1); d++) { var gx = Math.round(X(d)) + 0.5; c.moveTo(gx, plotY); c.lineTo(gx, plotB); }
    [2, 3, 4, 6, 10].forEach(function (L) { var gy = Math.round(Y(L)) + 0.5; c.moveTo(plotX, gy); c.lineTo(plotR, gy); });
    c.stroke();
    // numbers on the paper, in pencil: the loss on its lines, compute decades along the foot (no units: the caption says what a tick is)
    c.font = mono(fs); c.fillStyle = rgba(COL.graphite, 0.9); c.textAlign = 'left';
    [10, 6, 4, 3, 2].forEach(function (L) { var gy = Math.round(Y(L)); var lab = String(L); halo(lab, plotX + 3, gy - 2); c.fillText(lab, plotX + 3, gy - 2); occ.push({ x: plotX + 1, y: gy - 12, w: c.measureText(lab).width + 5, h: 12 }); });
    c.textAlign = 'center'; var lastLab = -99;
    for (d = Math.ceil(x0); d <= Math.floor(x1); d++) { var lx = X(d), lab2 = '1e' + d, tw = c.measureText(lab2).width; if (lx - tw / 2 < lastLab + 4 || lx + tw / 2 > w + 2) continue; c.fillText(lab2, lx, plotB + 12); lastLab = lx + tw / 2; }

    // ---- teaching, in pencil: what the two axes are
    c.textAlign = 'left'; c.fillStyle = rgba(COL.graphite, 0.95);
    c.font = 'italic ' + (laptop ? 15 : 14) + 'px ' + FONT.hand;
    c.fillText(W.pencil.yAxis, plotX + 4, laptop ? 18 : 15);
    c.textAlign = laptop ? 'right' : 'left';
    c.fillText(W.pencil.xAxis, laptop ? plotR - 4 : plotX + 4, laptop ? 18 : 30);
    c.textAlign = 'left';
    occ.push({ x: plotX, y: 0, w: plotW, h: padT - 2 });

    // ---- the calendar band: month initials, the days your runs ran, history on its dates, today
    var rulerTop = plotB + axisH + 4, ry = rulerTop + rulerH - 13;
    c.strokeStyle = COL.grid; c.beginPath(); c.moveTo(plotX, rulerTop - 2.5); c.lineTo(plotR, rulerTop - 2.5); c.moveTo(dayX(0), ry + 0.5); c.lineTo(dayX(366), ry + 0.5); c.stroke();
    c.fillStyle = COL.graphite; c.font = mono(fs); c.textAlign = 'left';
    for (var m = 0; m < 12; m++) { var mdx = Math.round(dayX(E.D('2020-' + (m < 9 ? '0' : '') + (m + 1) + '-01'))); c.fillRect(mdx, ry - 2, 1, 5); c.fillText(MON[m], mdx + 3, ry + 11); }
    // history's phrases (factual dates, shortened): newest written in full, older ones that would collide collapse to a tick
    var phrases = [];
    S.news.forEach(function (n) { if (!n.real) return; var iso = null; W.news.forEach(function (wn) { if (wn[1] === n.text) iso = wn[0]; }); var sh = iso && W.newsShort[iso]; if (sh) phrases.push({ day: n.day, text: sh }); });
    phrases.sort(function (a, b) { return b.day - a.day; });
    var rowsUsed = [[], []], rowY = [rulerTop + 3, rulerTop + 13]; c.font = mono(fs - 0.5, true);
    phrases.forEach(function (p) {
      var tx = Math.round(dayX(p.day)) + 0.5, tw = c.measureText(p.text).width, px = clamp(tx + 2, plotX, plotR - tw), row = -1;
      for (var ri = 0; ri < 2 && row < 0; ri++) { var ok = rowsUsed[ri].every(function (b) { return px + tw + 6 < b.x || px > b.x + b.w + 6; }); if (ok) row = ri; }
      if (row >= 0) rowsUsed[row].push({ x: px, w: tw });
      c.globalAlpha = row >= 0 ? 0.9 : 0.5; c.fillStyle = COL.graphite; c.fillRect(tx - 0.5, ry - 6, 1, 6);
      if (row >= 0) { c.strokeStyle = rgba(COL.graphite, 0.5); c.beginPath(); c.moveTo(tx, ry - 6); c.lineTo(tx, rowY[row] + 3); c.stroke(); halo(p.text, px, rowY[row] + 8); c.fillText(p.text, px, rowY[row] + 8); }
      c.globalAlpha = 1;
    });
    // run bars on the baseline
    S.runs.forEach(function (r) {
      if (r.state === 'aborted' && !r.pts.length) return;
      var xa = dayX(r.launchDay), xb = Math.max(xa + 1.5, dayX(r.state === 'train' ? S.day : (r.landDay != null ? r.landDay : S.day))), yb = ry - 1;
      if (r.state === 'landed' && r.clean === false) { c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(xa + 0.5, yb + 0.5, Math.max(1, xb - xa - 1), 2); }
      else { c.fillStyle = r.state === 'aborted' ? COL.dry : COL.ink; c.fillRect(xa, yb, xb - xa, 2); }
      c.fillStyle = COL.paper; (r.hangs || []).forEach(function (hd) { var hx = Math.round(dayX(typeof hd === 'number' ? hd : (hd.day != null ? hd.day : r.launchDay))); if (hx >= xa && hx <= xb) c.fillRect(hx, yb - 1, 1, 4); });
    });
    var tdx = Math.round(dayX(Math.min(S.day, 366))) + 0.5; c.fillStyle = COL.ink; c.fillRect(tdx - 1, ry - 5, 2, 8);

    // ---- the data wall: the uncertain band where the clean text runs out, hatched in vermilion (danger, and nothing else)
    var recC = function (D) { return CFG.gpt3.C * Math.pow(D / CFG.gpt3.D, 1 / CFG.tokExp); };
    var wLo = recC(S.wallLo), wHi = recC(S.wallHi), wx0 = X(log10(wLo)), wx1 = X(log10(wHi));
    if (wx0 < plotR) {
      c.save(); c.beginPath(); c.rect(plotX, plotY, plotW, plotH); c.clip();
      var a0 = Math.max(plotX, wx0), a1 = Math.min(plotR, wx1);
      c.lineWidth = 1;
      if (a1 > a0) { c.save(); c.beginPath(); c.rect(a0, plotY, a1 - a0, plotH); c.clip(); c.strokeStyle = rgba(COL.verm, 0.5); c.beginPath(); for (var k = a0 - plotH; k < a1 + 2; k += 8) { c.moveTo(k, plotB); c.lineTo(k + plotH, plotY); } c.stroke(); c.restore(); }
      if (wx1 < plotR) { c.save(); c.beginPath(); c.rect(Math.max(plotX, wx1), plotY, plotR - Math.max(plotX, wx1), plotH); c.clip(); c.strokeStyle = rgba(COL.verm, 0.17); c.beginPath(); for (var k2 = wx1 - plotH; k2 < plotR + 2; k2 += 14) { c.moveTo(k2, plotB); c.lineTo(k2 + plotH, plotY); } c.stroke(); c.restore(); }
      c.restore();
      occ.push({ x: a0, y: plotY, w: Math.max(0, a1 - a0), h: plotH, k: 0.2 });
      // the pencil that says what the hatch is, standing along its left edge
      if (a1 > a0 + 6 && a0 < plotR - 14) {
        c.save(); c.font = 'italic ' + (laptop ? 14 : 13) + 'px ' + FONT.hand;
        var wt = W.pencil.wall; if (c.measureText(wt).width > plotH - 16) wt = 'the data wall';
        var wtw = c.measureText(wt).width, wpx = clamp(a0 + 13, plotX + 12, plotR - 6);
        occ.push({ x: wpx - 14, y: plotB - 8 - wtw - 2, w: 18, h: wtw + 4, k: 30 });
        c.translate(wpx, plotB - 8); c.rotate(-Math.PI / 2); c.textAlign = 'left';
        halo(wt, 0, 0, 0.95); c.fillStyle = rgba(COL.graphite, 0.95); c.fillText(wt, 0, 0); c.restore();
      }
    }

    // ---- the Series A mark: what the money wants, until it is raised (dim until the third rung is lit)
    var LD = E.ladder(), rung = LD.rungs[LD.lit], aLit = rung && rung.id === 'seriesA';
    if (!S.raise.aDone && log10(S.raise.aNeed) <= x1) {
      var ax = Math.round(X(log10(S.raise.aNeed))) + 0.5, ay = Y(E.Lline(S.raise.aNeed));
      c.strokeStyle = aLit ? COL.ink : rgba(COL.graphite, 0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(ax, plotY); c.lineTo(ax, ay - 4); c.moveTo(ax, ay + 4); c.lineTo(ax, ay + 10); c.stroke();
      var atxt = aLit ? W.pencil.seriesA : 'Series A'; c.font = hand(aLit ? 15 : 14, aLit ? 600 : 400); var aw = c.measureText(atxt).width;
      c.fillStyle = aLit ? COL.ink : rgba(COL.graphite, 0.9); c.textAlign = 'left'; var axx = ax - aw - 4 < plotX + 2 ? ax + 4 : ax - aw - 4;
      halo(atxt, axx, plotY + 14); c.fillText(atxt, axx, plotY + 14); occ.push({ x: axx, y: plotY + 3, w: aw, h: 14, k: 20 });
    }

    // ---- the line: the loss you should get for the compute you spent (a dotted graphite hairline)
    var lineOn = S.day >= E.DAY.line;
    c.save(); c.strokeStyle = lineOn ? COL.graphite : rgba(COL.graphite, 0.5); c.lineWidth = 1; c.setLineDash([1, 3]); c.beginPath();
    for (var lc = x0; lc <= x1 + 1e-9; lc += 0.05) { var ly = Y(E.Lline(Math.pow(10, lc))); if (lc === x0) c.moveTo(X(lc), ly); else c.lineTo(X(lc), ly); }
    c.stroke(); c.setLineDash([]); c.restore();
    // its caption rides along the line, in pencil, just above it near the left, where the paper is empty
    var cl = laptop ? 17.2 : 17.1, cx = X(cl), cy = Y(E.Lline(Math.pow(10, cl))), cl2 = cl + 1, ang = Math.atan2(Y(E.Lline(Math.pow(10, cl2))) - cy, X(cl2) - cx);
    c.save(); c.translate(cx, cy); c.rotate(ang); c.fillStyle = rgba(COL.graphite, 0.95); c.textAlign = 'left'; c.font = 'italic ' + (laptop ? 14 : 13) + 'px ' + FONT.hand;
    var capLines = laptop ? [W.pencil.line] : ['the loss you should get', 'for the compute you spent'];
    capLines.forEach(function (ln, i) { halo(ln, 4, -6 - (capLines.length - 1 - i) * 13); c.fillText(ln, 4, -6 - (capLines.length - 1 - i) * 13); });
    c.restore();
    for (var cc = cl; cc < cl + (laptop ? 3.2 : 2.3); cc += 0.25) occ.push({ x: X(cc) - 6, y: Y(E.Lline(Math.pow(10, cc))) - 8 - capLines.length * 14 + 4, w: 12, h: 12 + capLines.length * 12 });

    // ---- GPT-3
    var gx3 = X(log10(CFG.gpt3.C)), gy3 = Y(CFG.gpt3.L), real = S.day >= E.DAY.gpt3;
    occ.push({ x: gx3 - 9, y: gy3 - 9, w: 18, h: 18, k: 5 });

    // ---- rivals: graphite dots, dashed ladders, small mono labels
    S.rivals.forEach(function (rv) {
      var pts = rv.pubs.filter(function (p) { return log10(p.C) >= x0; }).map(function (p) { return [X(log10(p.C)), Y(p.L), p]; });
      c.save(); c.strokeStyle = rgba(COL.graphite, 0.5); c.fillStyle = COL.graphite; c.lineWidth = 1;
      if (pts.length > 1) { c.setLineDash([3, 3]); c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]); }
      pts.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 1.7, 0, 6.2832); c.fill(); occ.push({ x: p[0] - 3, y: p[1] - 3, w: 6, h: 6 }); });
      c.restore();
    });
    S.rivals.forEach(function (rv) {
      var lp = rv.pubs[rv.pubs.length - 1]; if (!lp || log10(lp.C) < x0) return;
      var px = X(log10(lp.C)), py = Y(lp.L), nn = E.recipeForC ? E.recipeForC(lp.C).N : 0;
      c.font = mono(laptop ? 11 : 10, true); var lab = rv.name + (nn ? ' · ' + FE.bigNum(nn) : ''), tw = c.measureText(lab).width;
      var dys = [3, -15, 16, -28, 29, -41, 42, -54, 55, -67, -80], cands = []; dys.forEach(function (dy) { cands.push([5, dy]); cands.push([-tw - 5, dy]); });
      var b = place(px, py, tw, 12, cands);
      var ly0 = b.y + 6, lxe = b.x > px ? b.x - 2 : b.x + tw + 2;
      if (Math.abs(ly0 - py) > 12) { c.strokeStyle = rgba(COL.graphite, 0.45); c.lineWidth = 0.75; c.beginPath(); c.moveTo(px, py); c.lineTo(lxe, ly0); c.stroke(); }
      c.textBaseline = 'top'; c.textAlign = 'left'; halo(lab, b.x, b.y); c.fillStyle = rgba(COL.graphite, 1); c.fillText(lab, b.x, b.y); c.textBaseline = 'alphabetic';
    });

    // ---- your runs: finished curves at 35% ink, the live run a pen with a dot at its tip
    function strokeRun(r, style, lw) {
      c.save(); c.beginPath(); c.rect(plotX, 0, plotW, plotB + 2); c.clip(); c.strokeStyle = style; c.lineWidth = lw; c.beginPath();
      var lx = -1e9, ly2 = -1e9, started = false;
      for (var i = 0; i < r.pts.length; i++) {
        var p = r.pts[i], lcx = log10(p[0] * r.C); if (lcx < x0 - 0.2) continue;
        var px = X(lcx), py = Y(p[1]);
        if (started && i < r.pts.length - 1 && Math.abs(px - lx) < 0.6 && Math.abs(py - ly2) < 0.6) continue;
        if (!started) { c.moveTo(px, py); started = true; } else c.lineTo(px, py); lx = px; ly2 = py;
      }
      c.stroke(); c.restore();
    }
    var seen = [];
    for (var ri2 = S.runs.length - 1; ri2 >= 0; ri2--) {
      var rr = S.runs[ri2]; if (rr.state === 'train' || rr.state === 'aborted' || !rr.pts.length) continue;
      var lc2 = log10(rr.C); if (seen.some(function (v) { return Math.abs(v - lc2) < 0.08; })) continue; seen.push(lc2);
      strokeRun(rr, rgba(COL.ink, 0.35), 1);
    }
    S.runs.forEach(function (r) {
      if (r.state !== 'train' || !r.pts.length) return;
      strokeRun(r, r.hang ? rgba(COL.ink, 0.55) : COL.ink, 1.5);
      var hp = r.pts[r.pts.length - 1], hx = X(Math.max(x0, log10(hp[0] * r.C))), hy = Y(hp[1]);
      // where it is headed: a pencil dotted line to the ring where it is expected to land
      var tx2 = X(log10(r.C)), ty2 = Y(r.projAtLaunch);
      c.save(); c.strokeStyle = rgba(COL.graphite, 0.8); c.lineWidth = 1; c.setLineDash([1, 3]); c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx2, ty2); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.arc(tx2, ty2, 4, 0, 6.2832); c.stroke(); c.restore();
      occ.push({ x: tx2 - 6, y: ty2 - 6, w: 12, h: 12 });
      c.fillStyle = r.hang ? COL.verm : COL.ink; c.beginPath(); c.arc(hx, hy, 2.8, 0, 6.2832); c.fill();
      if (!red && !r.hang) { c.strokeStyle = rgba(COL.ink, 0.25); c.lineWidth = 1; c.beginPath(); c.arc(hx, hy, 5 + 1.5 * Math.sin(t / 260), 0, 6.2832); c.stroke(); }
      var pct = (r.hang ? 'dropped ' : '') + Math.round(r.q * 100) + '%'; c.font = mono(fs + 1, false, 500); c.textAlign = hx > w - 80 ? 'right' : 'left';
      var tx3 = hx + (c.textAlign === 'left' ? 7 : -7); halo(pct, tx3, hy - 6); c.fillStyle = r.hang ? COL.verm : COL.ink; c.fillText(pct, tx3, hy - 6); c.textAlign = 'left';
    });
    // the pen's own path, as obstacle for labels
    S.runs.forEach(function (r) { if (r.state === 'train' && r.pts.length) { for (var q = 0.02; q <= 1; q += 0.06) { var qx = X(log10(Math.max(q, 0.0005) * r.C)); occ.push({ x: qx - 4, y: Y(r.projAtLaunch) - 4, w: 8, h: 8, k: 0.1 }); } } });

    // ---- your saved models: solid dots; a ring when published; a bar when it is an API; a vermilion strike for a scandal
    var far = E.farthestClean(), farRun = null, newest = null;
    S.runs.forEach(function (r) { if (r.state === 'landed') newest = r; });
    S.runs.forEach(function (r) {
      if (r.state !== 'landed') return;
      var lcx = log10(r.Cland); if (lcx < x0) return;
      var x = X(lcx), y = Y(r.loss);
      if (r.clean && r.Cland === far) farRun = { x: x, y: y, r: r };
      var thunk = ui.thunkRun === r.id && ui.thunkAt && t - ui.thunkAt < 700;
      if (ui.thunkRun === r.id && !ui.thunkAt) ui.thunkAt = t;
      occ.push({ x: x - 7, y: y - 7, w: 14, h: 14, k: 5 });
      c.save(); c.fillStyle = COL.ink; c.strokeStyle = COL.ink; c.lineWidth = 1.2;
      if (r.clean) { c.beginPath(); c.arc(x, y, laptop ? 3.4 : 3, 0, 6.2832); c.fill(); }
      else { c.beginPath(); c.arc(x, y, laptop ? 3.4 : 3, 0, 6.2832); c.stroke(); }
      if (thunk && !red) { var u = (t - ui.thunkAt) / 450; if (u < 1) { c.strokeStyle = rgba(COL.ink, 0.45 * (1 - u)); c.lineWidth = 1; c.beginPath(); c.arc(x, y, 3 + 9 * (1 - Math.pow(1 - u, 3)), 0, 6.2832); c.stroke(); } }
      c.strokeStyle = COL.ink; c.lineWidth = 1;
      if (r.published) { c.beginPath(); c.arc(x, y, laptop ? 6 : 5.2, 0, 6.2832); c.stroke(); }
      if (r.shipped) { c.fillStyle = COL.ink; c.fillRect(x + 7, y - 0.5, 7, 1); }
      if (r.scandal) { c.strokeStyle = COL.verm; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x - 7, y + 7); c.lineTo(x + 7, y - 7); c.stroke(); }
      c.restore();
      geom.dots.push({ x: x, y: y, id: r.id });
    });
    if (ui.thunkAt && t - ui.thunkAt > 800) { ui.thunkAt = 0; ui.thunkRun = null; }
    // the newest model is named in pencil beside its dot
    if (newest && log10(newest.Cland) >= x0) {
      c.font = mono(fs + 0.5, false, 500); var nm = E.modelName(newest), nw = c.measureText(nm).width, nx = X(log10(newest.Cland)), ny = Y(newest.loss);
      var nb = place(nx, ny, nw, 12, [[-nw / 2, 9], [7, 6], [-nw - 7, 6], [-nw / 2, -22]], true);
      if (nb) { c.textBaseline = 'top'; halo(nm, nb.x, nb.y); c.fillStyle = COL.ink; c.fillText(nm, nb.x, nb.y); c.textBaseline = 'alphabetic'; }
    }

    // ---- the ring: GPT-3 (dotted pencil before 28 May, an ink dot with its ring after)
    c.save();
    if (!real) {
      c.strokeStyle = COL.graphite; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.arc(gx3, gy3, laptop ? 5 : 4.5, 0, 6.2832); c.stroke(); c.setLineDash([]);
    } else {
      c.fillStyle = COL.ink; c.beginPath(); c.arc(gx3, gy3, laptop ? 4.5 : 3.8, 0, 6.2832); c.fill();
      c.strokeStyle = rgba(COL.ink, 0.6); c.lineWidth = 1; c.beginPath(); c.arc(gx3, gy3, (laptop ? 4.5 : 3.8) + 3.5, 0, 6.2832); c.stroke();
    }
    c.restore();
    c.font = real ? mono(laptop ? 11 : 10, false, 500) : 'italic ' + (laptop ? 15 : 14) + 'px ' + FONT.hand; var gl = real ? 'GPT-3' : W.pencil.ring, glw = c.measureText(gl).width;
    var gb = place(gx3, gy3, glw, real ? 12 : 14, [[-glw / 2, -26], [-glw - 8, -8], [8, -8], [-glw / 2, 8]]);
    c.textBaseline = 'top'; c.textAlign = 'left'; halo(gl, gb.x, gb.y); c.fillStyle = real ? COL.ink : COL.graphite; c.fillText(gl, gb.x, gb.y); c.textBaseline = 'alphabetic';

    // ---- the designer's ghost: where the run you are planning would land (a pencil cross with its doubt)
    var g = ui.lastDesign, ghost = null;
    if (S.phase === 'play' && g && g.cards > 0 && g.C > 0) {
      var gxx = X(clamp(log10(g.C), x0, x1)), gyy = Y(g.proj);
      ghost = { x: gxx, y: gyy };
      c.save(); c.strokeStyle = g.ok ? COL.ink : COL.graphite; c.lineWidth = 1; c.setLineDash([2, 2]);
      c.beginPath(); c.moveTo(gxx, Y(g.hi)); c.lineTo(gxx, Y(g.lo)); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(gxx - 5, gyy); c.lineTo(gxx + 5, gyy); c.moveTo(gxx, gyy - 5); c.lineTo(gxx, gyy + 5); c.stroke(); c.restore();
      occ.push({ x: gxx - 6, y: Math.min(gyy, Y(g.hi)) - 2, w: 12, h: Math.abs(Y(g.lo) - Y(g.hi)) + 4, k: 2 });
      var nearDot = geom.dots.some(function (d) { return Math.hypot(d.x - gxx, d.y - gyy) < 16; });
      if (!nearDot) { c.font = 'italic ' + (laptop ? 15 : 14) + 'px ' + FONT.hand; var pw = c.measureText(W.pencil.plan).width; var pb = place(gxx, gyy, pw, 14, [[8, -20], [-pw - 8, -20], [8, 8], [-pw - 8, 8]], true); if (pb) { c.textBaseline = 'top'; halo(W.pencil.plan, pb.x, pb.y); c.fillStyle = g.ok ? COL.ink : COL.graphite; c.fillText(W.pencil.plan, pb.x, pb.y); c.textBaseline = 'alphabetic'; } }
    }

    // ---- the dimension line: your biggest dot to the ring, in ink, with how many times short
    var from = farRun, txt = null, dim = false;
    if (farRun) { var sh = CFG.gpt3.C / far; txt = sh < 1.05 ? 'passed it' : E.shortFmt(sh) + ' short'; }
    else if (ghost && g.ok) { from = { x: ghost.x, y: ghost.y }; txt = E.shortFmt(CFG.gpt3.C / g.C) + ' short if it lands'; dim = true; }
    if (from && txt && Math.abs(from.x - gx3) > 18) {
      c.save(); c.strokeStyle = dim ? rgba(COL.ink, 0.5) : COL.ink; c.lineWidth = 1; c.setLineDash(dim ? [2, 3] : []);
      var dx = gx3 - from.x, dy = gy3 - from.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
      var sx = from.x + ux * 8, sy = from.y + uy * 8, ex = gx3 - ux * 9, ey = gy3 - uy * 9;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
      var nx2 = -uy * 4, ny2 = ux * 4; c.beginPath(); c.moveTo(sx + nx2, sy + ny2); c.lineTo(sx - nx2, sy - ny2); c.moveTo(ex + nx2, ey + ny2); c.lineTo(ex - nx2, ey - ny2); c.stroke();
      c.font = mono(laptop ? 12 : 11, false, 500); var tw2 = c.measureText(txt).width, mx = (sx + ex) / 2, my = (sy + ey) / 2;
      var db = place(mx, my, tw2, 13, [[-tw2 / 2, 5], [-tw2 / 2, -19], [-tw2 - 4, -6], [6, -6]], true) || { x: clamp(mx - tw2 / 2, plotX + 2, plotR - tw2 - 2), y: my + 5 };
      c.textBaseline = 'top'; c.textAlign = 'left'; halo(txt, db.x, db.y, 0.95); c.fillStyle = dim ? rgba(COL.ink, 0.7) : COL.ink; c.fillText(txt, db.x, db.y); c.textBaseline = 'alphabetic';
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
