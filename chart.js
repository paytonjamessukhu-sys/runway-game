/* The paper. Error score against compute on cold log-log paper, drawn the way the reference sheet draws it: a grey decade grid,
   the scaling law as a dotted graphite hairline, finished runs as thin ink curves, the live run as a 1.5 px pen with a dot at its tip,
   rivals as graphite dots with small mono labels, the GPT-3 ring, the data wall as a vermilion hatch, and one dimension line
   from your biggest dot to the ring, labelled with the strip's "times short". */
(function (X) {
  'use strict';
  var log10 = X.log10, clamp = X.clamp, rgba = X.rgba;

  function sizeCanvas(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }
  var marginCache = { t: 0, v: 58 };
  X.margin = function () {
    var n = X.nowMs(); if (n - marginCache.t < 400) return marginCache.v;
    marginCache.t = n;
    try { var v = parseFloat(getComputedStyle(X.$('fx')).getPropertyValue('--margin')); if (v > 0) marginCache.v = v; } catch (e) {}
    return marginCache.v;
  };

  // a hand's wobble, the same every frame: a second faint pass of the pen beside the first
  function wob(i, k) { var x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
  X.drawChart = function (cv, opts) {
    opts = opts || {};
    var G = X.G, S = X.S, F = X.F, CFG = X.CFG, T = X.tokens, ui = X.ui;
    var sz = sizeCanvas(cv); if (sz.w < 20 || sz.h < 20) return;
    var ctx = cv.getContext('2d'); ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
    var W = sz.w, H = sz.h, phone = W < 560, lap = W >= 560;
    var padL = opts.end ? 34 : X.margin(), padR = 8, padT = 6, padB = 40;
    var xMin = CFG.chart.xMin, xMax = CFG.chart.xMax, yMin = CFG.chart.yMin, yMax = CFG.chart.yMax;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    function Xc(C) { return padL + (log10(C) - xMin) / (xMax - xMin) * plotW; }
    function Yc(L) { return padT + (Math.log(yMax) - Math.log(L)) / (Math.log(yMax) - Math.log(yMin)) * plotH; }
    ctx.clearRect(0, 0, W, H);
    var mono = X.fMono(phone ? 9.5 : 10.5), hand = X.fHand(phone ? 14 : 15.5);
    ctx.font = mono; ctx.textBaseline = 'middle';
    var placed = [], labels = [], hits = [];
    var plotR = W - padR, plotB = H - padB;
    function block(x, y, r) { placed.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r }); }
    function want(text, x, y, color, pri, cands, font, h) { labels.push({ t: text, x: x, y: y, c: color, p: pri, cands: cands, f: font || mono, h: h || 12 }); }
    function overlaps(a) { for (var i = 0; i < placed.length; i++) { var b = placed[i]; if (a.x < b.x + b.w + 2 && a.x + a.w + 2 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y) return true; } return false; }
    var CANDS = [[8, -9], [8, 9], [-8, -9], [-8, 9], [0, -15], [0, 15], [14, 0], [-14, 0]];
    function halo(text, x, y, align) { ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = rgba(T.paper, 0.88); ctx.textAlign = align || 'left'; ctx.strokeText(text, x, y); }
    function placeAll() {
      labels.sort(function (a, b) { return a.p - b.p; });
      labels.forEach(function (l) {
        ctx.font = l.f;
        var w = ctx.measureText(l.t).width, h = l.h, cands = l.cands || CANDS;
        for (var i = 0; i < cands.length; i++) {
          var dx = cands[i][0], dy = cands[i][1];
          var left = dx > 0 ? l.x + dx : dx < 0 ? l.x + dx - w : l.x - w / 2, top = l.y + dy - h / 2;
          var r = { x: left, y: top, w: w, h: h };
          if (left < padL + 1 || left + w > plotR - 1 || top < 2 || top + h > plotB - 1) continue;
          if (overlaps(r)) continue;
          placed.push(r); halo(l.t, left, top + h / 2); ctx.fillStyle = l.c; ctx.textAlign = 'left'; ctx.fillText(l.t, left, top + h / 2); return;
        }
      });
    }

    // the decade grid: vertical decades of compute, horizontal lines of error score
    ctx.lineWidth = 1; ctx.strokeStyle = T.grid; ctx.beginPath();
    for (var e = xMin; e <= xMax; e++) { var gx = Math.round(Xc(Math.pow(10, e))) + 0.5; if (gx >= padL - 1) { ctx.moveTo(gx, padT); ctx.lineTo(gx, plotB + 5); } }
    var NATS = [10, 6, 4, 3, 2];
    // the words written on the paper (the voice) are obstacles for every label
    try { var vo = X.$('voice'), vq = vo && vo.firstElementChild; if (vq && !opts.end) { var vr = vq.getBoundingClientRect(), cr = cv.getBoundingClientRect(); placed.push({ x: vr.left - cr.left - 2, y: vr.top - cr.top - 2, w: vr.width + 4, h: vr.height + 4 }); } } catch (e) {}
    NATS.forEach(function (L) { var y = Math.round(Yc(L)) + 0.5; ctx.moveTo(padL, y); ctx.lineTo(plotR, y); });
    ctx.moveTo(padL, plotB + 0.5); ctx.lineTo(plotR, plotB + 0.5);
    ctx.stroke();
    // pencil axes: compute decades along the foot, error score on its lines
    ctx.fillStyle = T.graphite; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    for (e = xMin; e <= xMax; e++) {
      var lx = Xc(Math.pow(10, e)), lab = '1e' + e, lw = ctx.measureText(lab).width, tx = clamp(lx, padL + lw / 2, W - 1 - lw / 2);
      if (e === xMin && lx < padL + 2) continue;
      ctx.fillText(lab, tx, plotB + 7);
    }
    // the calendar band: its own rule, month initials, today's cursor, and the runs as bars with the days they still have to go dotted
    var ry = plotB + 25, MON0 = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], MI = 'JFMAMJJASOND';
    function dayX(d) { return padL + clamp(d / 366, 0, 1) * plotW; }
    ctx.strokeStyle = T.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, ry + 0.5); ctx.lineTo(plotR, ry + 0.5); ctx.stroke();
    ctx.fillStyle = T.graphite; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.font = X.fMono(8.5);
    for (var mi = 0; mi < 12; mi++) { var mxp0 = Math.round(dayX(MON0[mi])); ctx.fillStyle = T.graphite; ctx.fillRect(mxp0, ry - 2, 1, 5); ctx.fillText(MI.charAt(mi), mxp0 + 3, ry + 4); }
    ctx.font = mono;
    S.runs.forEach(function (r) { if (r.aborted) return; var x0 = dayX(r.launchDay), x1 = Math.max(x0 + 1.5, dayX(r.landDay)); ctx.fillStyle = T.ink; if (r.clean === false) { ctx.strokeStyle = T.ink; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, ry - 0.5, Math.max(1, x1 - x0 - 1), 2); } else ctx.fillRect(x0, ry - 1, x1 - x0, 2); });
    S.active.forEach(function (r) { var x0 = dayX(r.launchDay), x1 = dayX(S.day), x2 = dayX(Math.min(366, S.day + G.runDaysLeft(r))); ctx.fillStyle = T.ink; ctx.fillRect(x0, ry - 1, Math.max(1, x1 - x0), 2); if (isFinite(x2)) { ctx.strokeStyle = rgba(T.ink, 0.7); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x1, ry + 0.5); ctx.lineTo(x2, ry + 0.5); ctx.stroke(); ctx.setLineDash([]); } });
    ctx.fillStyle = T.ink; ctx.fillRect(Math.round(dayX(Math.min(S.day, 365))) - 1, ry - 4, 2, 9);
    ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
    NATS.forEach(function (L) { var y = Math.round(Yc(L)); var t = String(L); ctx.fillStyle = T.graphite; ctx.fillText(t, padL + 3, y - 1); placed.push({ x: padL + 1, y: y - 12, w: ctx.measureText(t).width + 5, h: 12 }); });
    ctx.textBaseline = 'middle';
    ctx.font = hand; ctx.fillStyle = T.graphite;
    var yls = phone ? ['error score,', 'lower is better ↓'] : ['error score, lower is better ↓'];
    ctx.textAlign = 'left';
    yls.forEach(function (ln, i) { var lw = ctx.measureText(ln).width; ctx.fillText(ln, padL + 22, padT + 11 + i * 14); placed.push({ x: padL + 20, y: padT + 2 + i * 14, w: lw + 4, h: 16 }); });
    var xl = 'compute: each tick is ten times more →', xlw = ctx.measureText(xl).width;
    ctx.textAlign = 'left'; ctx.fillText(xl, padL + 8, plotB - 9); placed.push({ x: padL + 6, y: plotB - 19, w: xlw + 6, h: 16 });
    ctx.font = mono;
    var dv = G.derived(), ladder = G.ladder(), litId = ladder.lit >= 0 ? ladder.rungs[ladder.lit].id : '';

    // the data wall estimate: a vermilion hatch from the near edge to the far edge of the uncertain band
    var wlo = G.C_of_tokens(S.data.lo), whi = G.C_of_tokens(S.data.hi);
    function hatch(x0, x1, alpha, step) {
      if (x1 <= x0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(x0, padT, x1 - x0, plotH); ctx.clip();
      ctx.strokeStyle = rgba(T.vermilion, alpha); ctx.lineWidth = 1; ctx.beginPath();
      for (var k = x0 - plotH; k < x1; k += step) { ctx.moveTo(k, plotB); ctx.lineTo(k + plotH, padT); }
      ctx.stroke(); ctx.restore();
    }
    if (log10(wlo) < xMax) {
      var x0 = Math.max(Xc(Math.max(wlo, Math.pow(10, xMin))), padL), x1 = Math.min(Xc(whi), plotR);
      hatch(x0, Math.max(x1, x0 + 3), 0.36, 7);
      ctx.strokeStyle = rgba(T.vermilion, 0.75); ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, padT); ctx.lineTo(Math.round(x0) + 0.5, plotB); ctx.stroke(); ctx.setLineDash([]);
      placed.push({ x: x0 - 1, y: padT, w: Math.max(4, x1 - x0) + 2, h: 14 });
      ctx.font = hand; var dwt = ctx.measureText('the data wall').width;
      want('the data wall', x1 + 2, padT + 30, T.graphite, 5, [[4, 0], [-4 - Math.max(0, x1 - x0), 0], [4, 16]], hand, 15); ctx.font = mono;
    }
    // the biggest model that fits one card (until systems people arrive)
    if (dv.memLimit < CFG.memLimit[2]) {
      var memC = Math.pow(6 * dv.memLimit * CFG.tokGPT3 / Math.pow(CFG.gpt3C, CFG.tokExp), 1 / (1 - CFG.tokExp));
      var mx = Math.round(Xc(memC)) + 0.5;
      if (mx < plotR && mx > padL) { ctx.strokeStyle = T.graphite; ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, plotB); ctx.stroke(); ctx.setLineDash([]); want('too big to fit', mx, padT + 12, T.graphite, 6, [[-4, 0], [4, 0], [-4, 14]], hand, 15); }
    }
    // the line: what the compute should buy. A dotted graphite hairline.
    var lineKnown = S.day >= CFG.lineDay;
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, plotW, plotH + 1); ctx.clip();
    ctx.strokeStyle = lineKnown ? T.graphite : rgba(T.graphite, 0.45); ctx.lineWidth = 1; ctx.setLineDash([1, 3]);
    var lx0 = Xc(Math.pow(10, xMin)), ly0 = Yc(G.Lline(Math.pow(10, xMin))), lx1 = Xc(Math.pow(10, xMax)), ly1 = Yc(G.Lline(Math.pow(10, xMax)));
    ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1, ly1); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    // its caption, written along the line in pencil
    var ang = Math.atan2(ly1 - ly0, lx1 - lx0), cos = Math.cos(ang), sin = Math.sin(ang);
    var capLines = phone ? ['the loss you should get', 'for the compute you spent'] : ['the loss you should get for the compute you spent'];
    ctx.save(); ctx.font = X.fHand(phone ? 13 : 14.5); ctx.fillStyle = rgba(T.graphite, lineKnown ? 0.95 : 0.7); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var cStart = phone ? 0.04 : 0.06;
    capLines.forEach(function (ln, i) {
      var w = ctx.measureText(ln).width, off = -7 - (capLines.length - 1 - i) * 13, ox = lx0 + (lx1 - lx0) * cStart, oy = ly0 + (ly1 - ly0) * cStart;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); ctx.fillText(ln, 6, off); ctx.restore();
      var xs = [6, 6 + w], ys = [off - 11, off + 3], minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      xs.forEach(function (u) { ys.forEach(function (v) { var px = ox + u * cos - v * sin, py = oy + u * sin + v * cos; minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py); }); });
      placed.push({ x: minx, y: miny, w: maxx - minx, h: maxy - miny });
    });
    ctx.restore(); ctx.font = mono; ctx.textBaseline = 'middle';

    // rivals: graphite dots, a faint dashed ladder, the latest labelled with name and size
    S.rivals.forEach(function (rv, i) {
      var pubs = rv.pubs.filter(function (p) { return p.day <= S.day; }); if (!pubs.length) return;
      ctx.strokeStyle = rgba(T.graphite, 0.5); ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); pubs.forEach(function (p, j) { var px = Xc(p.C), py = Yc(p.L); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
      pubs.forEach(function (p, j) { var px = Xc(p.C), py = Yc(p.L); ctx.fillStyle = rgba(T.graphite, j === pubs.length - 1 ? 1 : 0.7); ctx.beginPath(); ctx.arc(px, py, j === pubs.length - 1 ? 2.2 : 1.5, 0, Math.PI * 2); ctx.fill(); });
      var lp = pubs[pubs.length - 1]; block(Xc(lp.C), Yc(lp.L), 4);
      want(rv.name + ' · ' + F.size(lp.N), Xc(lp.C), Yc(lp.L), T.graphite, 7 + i * 0.1, null, X.fMono(phone ? 9.5 : 10.5, true));
    });
    // GPT-3: a ring until 28 May, then a solid point
    var gx = Xc(CFG.gpt3C), gy = Yc(CFG.gpt3L), out = S.day >= CFG.gpt3Day;
    ctx.lineWidth = 1;
    if (out) { ctx.fillStyle = T.ink; ctx.beginPath(); ctx.arc(gx, gy, lap ? 4.2 : 3.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = rgba(T.ink, 0.6); ctx.beginPath(); ctx.arc(gx, gy, (lap ? 4.2 : 3.6) + 3.5, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.strokeStyle = T.graphite; ctx.setLineDash([1, 2]); ctx.beginPath(); ctx.arc(gx, gy, lap ? 5 : 4.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    block(gx, gy, 9);
    want(out ? 'GPT-3' : 'GPT-3 · 28 May', gx, gy, out ? T.ink : T.graphite, 1, [[-10, 13], [-10, -13], [10, 13], [10, -13], [-12, 0]], X.fMono(phone ? 10 : 11, !out, out ? 500 : 400));
    // Series A: a pencil mark on the line, dim until it is the lit rung
    if (!S.raise.aDone) {
      var aC = Math.max(CFG.seriesA.needC, S.raise.aNeed), ax = Xc(aC), ay = Yc(G.Lline(aC)), lit = litId === 'seriesA';
      if (ax > padL && ax < plotR) {
        ctx.strokeStyle = lit ? T.ink : rgba(T.graphite, 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(ax) + 0.5, ay - 14); ctx.lineTo(Math.round(ax) + 0.5, ay - 4); ctx.stroke();
        want('Series A', ax, ay - 17, lit ? T.ink : T.graphite, 4, [[0, -5], [6, -5], [-6, -5], [0, 24]], hand, 15);
      }
    }
    // your finished curves: thin ink at 35%, a family of training curves whose envelope is the law
    ctx.save(); ctx.beginPath(); ctx.rect(padL, 0, plotW, plotB + 2); ctx.clip();
    S.runs.slice(-14).forEach(function (r) {
      if (!r.pts || r.pts.length < 2 || r.aborted) return;
      ctx.lineWidth = 1; ctx.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = rgba(T.ink, pass ? 0.18 : (r.clean ? 0.32 : 0.28)); ctx.beginPath();
        var lxp = -1e9, lyp = -1e9;
        r.pts.forEach(function (p, j) { var px = Xc(p.x) + (pass ? wob(j, 1) * 0.7 : 0), py = Yc(clamp(p.y, yMin, yMax)) + (pass ? wob(j, 2) * 0.7 : 0); if (j && j < r.pts.length - 1 && Math.abs(px - lxp) < 0.6 && Math.abs(py - lyp) < 0.6) return; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); lxp = px; lyp = py; });
        ctx.stroke();
      }
    });
    // a scar: the vermilion hatch from the data wall to the run that went through it
    S.runs.forEach(function (r) {
      if (r.aborted || !r.L || r.clean || !r.wall) return;
      var sx0 = Xc(Math.max(G.C_of_tokens(r.wall), Math.pow(10, xMin))), sx1 = Xc(r.C);
      hatch(Math.max(padL, sx0), Math.min(plotR, Math.max(sx1, sx0 + 4)), 1, 6);
    });
    ctx.restore();
    // your saved models: ink dots, a ring when published, a short bar when shipped, hollow when it went past the wall
    S.runs.forEach(function (r) {
      if (r.aborted || !r.L) return;
      var px = Xc(r.C), py = Yc(r.L); hits.push({ x: px, y: py, r: 13, id: r.id });
      if (!r.clean) { ctx.strokeStyle = T.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; return; }
      ctx.fillStyle = T.ink; ctx.beginPath(); ctx.arc(px, py, lap ? 3.2 : 2.8, 0, Math.PI * 2); ctx.fill();
      if (r.published) { ctx.strokeStyle = T.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, py, lap ? 5.5 : 4.8, 0, Math.PI * 2); ctx.stroke(); }
      if (r.shipped) { ctx.fillStyle = T.ink; ctx.fillRect(px + 6, py - 0.5, 7, 1); }
    });
    var best = dv.best;
    if (best) {
      var bx = Xc(best.C), by = Yc(best.L);
      block(bx, by, 8);
      // the dimension line: from your biggest dot to the ring
      if (best.C < CFG.gpt3C * 0.95) {
        var sx = bx + 8, ex = gx - 9;
        if (ex > sx + 14) {
          var y1 = by, y2 = gy;
          ctx.strokeStyle = rgba(T.ink, 0.6); ctx.lineWidth = 1; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(sx, y1); ctx.lineTo(ex, y2); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = rgba(T.ink, 0.8); ctx.beginPath(); ctx.moveTo(sx, y1 - 4); ctx.lineTo(sx, y1 + 4); ctx.moveTo(ex, y2 - 4); ctx.lineTo(ex, y2 + 4); ctx.stroke();
          var txt = F.ratio(G.shortOf(best.C)) + ' short';
          ctx.font = X.fMono(phone ? 10 : 11, false, 500);
          var mxp = (sx + ex) / 2, myp = (y1 + y2) / 2, tw = ctx.measureText(txt).width + 8;
          placed.push({ x: mxp - tw / 2, y: myp - 17, w: tw, h: 13 });
          halo(txt, mxp, myp - 10, 'center'); ctx.fillStyle = T.ink; ctx.textAlign = 'center'; ctx.fillText(txt, mxp, myp - 10);
          ctx.textAlign = 'left'; ctx.font = mono;
        }
      }
      want('you', bx, by, T.ink, 3, null, X.fHand(phone ? 16 : 18, 600), 16);
    }
    // the live run: the pen
    S.active.forEach(function (r) {
      if (!r.pts.length || opts.end) return;
      ctx.save(); ctx.beginPath(); ctx.rect(padL, 0, plotW, plotB + 2); ctx.clip();
      ctx.strokeStyle = rgba(T.ink, r.hang ? 0.55 : 1); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath();
      var lxq = -1e9, lyq = -1e9;
      r.pts.forEach(function (p, j) { var px = Xc(p.x), py = Yc(clamp(p.y, yMin, yMax)); if (j && j < r.pts.length - 1 && Math.abs(px - lxq) < 0.6 && Math.abs(py - lyq) < 0.6) return; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); lxq = px; lyq = py; });
      ctx.stroke();
      ctx.strokeStyle = rgba(T.ink, r.hang ? 0.25 : 0.4); ctx.lineWidth = 1; ctx.beginPath(); lxq = -1e9; lyq = -1e9;
      r.pts.forEach(function (p, j) { var px = Xc(p.x) + wob(j, 3) * 0.8, py = Yc(clamp(p.y, yMin, yMax)) + wob(j, 4) * 0.8; if (j && j < r.pts.length - 1 && Math.abs(px - lxq) < 0.6 && Math.abs(py - lyq) < 0.6) return; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); lxq = px; lyq = py; });
      ctx.stroke(); ctx.restore(); ctx.lineWidth = 1;
      var hp = r.pts[r.pts.length - 1], hx = Xc(hp.x), hy = Yc(clamp(hp.y, yMin, yMax));
      ctx.fillStyle = T.ink; ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, Math.PI * 2); ctx.fill();
      if (r.hang) { ctx.strokeStyle = T.vermilion; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      else if (!X.reduced()) { ctx.strokeStyle = rgba(T.ink, 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(X.nowMs() / 260))); ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, Math.PI * 2); ctx.stroke(); }
      block(hx, hy, 6);
      if (r.hang) want(r.hang.nan ? r.hang.label : r.hang.label + (G.has('tom') ? ' my fault' : ' hung'), hx, hy, T.vermilion, 0, null, hand, 15);
      if (log10(r.C) > xMin && log10(r.C) < xMax) {
        var tx0 = Xc(r.C), ty0 = Yc(r.proj); ctx.strokeStyle = rgba(T.ink, 0.75); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(tx0, ty0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (r.sigUp > 0.003) { ctx.beginPath(); ctx.moveTo(tx0, ty0 - 6); ctx.lineTo(tx0, Yc(r.proj * (1 + 2 * r.sigUp))); ctx.stroke(); }
        block(tx0, ty0, 7); want('lands ' + F.date(S.day + G.runDaysLeft(r)), tx0, ty0, T.graphite, r === S.run ? 2 : 2.5, [[10, 12], [10, -12], [-10, 12], [-10, -12], [0, 20]], hand, 15);
      }
    });
    // where the next run would land (the designer's ring)
    var tgt = ui && ui.design && !S.over && !opts.end && !ui.design.block ? { C: ui.design.C, L: ui.design.L, sig: ui.design.sigUp, label: 'next run', bad: ui.design.r > 1 } : null;
    if (tgt && log10(tgt.C) > xMin && log10(tgt.C) < xMax) {
      var tx = Xc(tgt.C), ty = Yc(tgt.L), col = tgt.bad ? T.vermilion : T.ink;
      ctx.strokeStyle = rgba(col, 0.85); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (tgt.sig > 0.003) { ctx.beginPath(); ctx.moveTo(tx, ty - 6); ctx.lineTo(tx, Yc(tgt.L * (1 + 2 * tgt.sig))); ctx.stroke(); }
      block(tx, ty, 7);
      want(tgt.label, tx, ty, tgt.bad ? T.vermilion : T.ink, 3.5, [[10, 12], [10, -12], [-10, 12], [-10, -12], [0, 20]], hand, 15);
    }
    placeAll();
    if (ui) ui.hits = hits;
  };
})(window.FX);
