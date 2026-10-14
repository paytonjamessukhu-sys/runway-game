/* The curve: the hero. Error score against compute, both log. One white line (what the compute should buy), your saved models,
   the labs, GPT-3's ring, and one dimension line from your biggest dot to the ring, labelled with the strip's "times short". */
(function (X) {
  'use strict';
  var log10 = X.log10, clamp = X.clamp, rgba = X.rgba;

  function sizeCanvas(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }
  function marker(ctx, kind, x, y, s) {
    ctx.beginPath();
    if (kind === 0) ctx.arc(x, y, s, 0, Math.PI * 2);
    else if (kind === 1) ctx.rect(x - s, y - s, 2 * s, 2 * s);
    else { ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x + s * 1.1, y + s * 0.9); ctx.lineTo(x - s * 1.1, y + s * 0.9); ctx.closePath(); }
    ctx.fill();
  }

  X.drawChart = function (cv, opts) {
    opts = opts || {};
    var G = X.G, S = X.S, F = X.F, CFG = X.CFG, T = X.tokens, ui = X.ui;
    var sz = sizeCanvas(cv); if (sz.w < 20 || sz.h < 20) return;
    var ctx = cv.getContext('2d'); ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
    var W = sz.w, H = sz.h, phone = W < 520;
    var padL = phone ? 28 : 36, padR = 12, padT = 24, padB = phone ? 32 : 36;
    var xMin = CFG.chart.xMin, xMax = CFG.chart.xMax, yMin = CFG.chart.yMin, yMax = CFG.chart.yMax;
    function Xc(C) { return padL + (log10(C) - xMin) / (xMax - xMin) * (W - padL - padR); }
    function Yc(L) { return padT + (Math.log(yMax) - Math.log(L)) / (Math.log(yMax) - Math.log(yMin)) * (H - padT - padB); }
    ctx.clearRect(0, 0, W, H);
    var mono = (phone ? '9.5px ' : '10.5px ') + '"IBM Plex Mono", ui-monospace, Menlo, monospace';
    ctx.font = mono; ctx.textBaseline = 'middle';
    var placed = [], labels = [], hits = [];
    function block(x, y, r) { placed.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r }); }
    function want(text, x, y, color, pri, cands) { labels.push({ t: text, x: x, y: y, c: color, p: pri, cands: cands }); }
    function overlaps(a) { for (var i = 0; i < placed.length; i++) { var b = placed[i]; if (a.x < b.x + b.w + 2 && a.x + a.w + 2 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y) return true; } return false; }
    var CANDS = [[9, -9], [9, 9], [-9, -9], [-9, 9], [0, -15], [0, 15], [14, 0], [-14, 0]];
    function placeAll() {
      labels.sort(function (a, b) { return a.p - b.p; });
      labels.forEach(function (l) {
        var w = ctx.measureText(l.t).width, h = 12, cands = l.cands || CANDS;
        for (var i = 0; i < cands.length; i++) {
          var dx = cands[i][0], dy = cands[i][1];
          var left = dx > 0 ? l.x + dx : dx < 0 ? l.x + dx - w : l.x - w / 2, top = l.y + dy - h / 2;
          var r = { x: left, y: top, w: w, h: h };
          if (left < padL + 1 || left + w > W - padR - 1 || top < 2 || top + h > H - padB - 1) continue;
          if (overlaps(r)) continue;
          placed.push(r); ctx.fillStyle = l.c; ctx.textAlign = 'left'; ctx.fillText(l.t, left, top + h / 2); return;
        }
      });
    }
    // grid and axes
    ctx.lineWidth = 1;
    for (var e = xMin; e <= xMax; e++) {
      var x = Math.round(Xc(Math.pow(10, e))) + 0.5;
      ctx.strokeStyle = rgba(T['line-2'], 0.9); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
      if (!phone || e % 2 === 1) { ctx.fillStyle = T.dim; ctx.textAlign = 'center'; ctx.fillText('1e' + e, x, H - padB + 9); }
    }
    [1.5, 2, 3, 4, 6, 10].forEach(function (L) { var y = Math.round(Yc(L)) + 0.5; ctx.strokeStyle = rgba(T['line-2'], 0.6); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke(); ctx.fillStyle = T.dim; ctx.textAlign = 'right'; ctx.fillText(String(L), padL - 5, y); });
    ctx.textAlign = 'left'; ctx.fillStyle = T.muted;
    var yl = 'error score, lower is better ↓'; ctx.fillText(yl, padL + 4, 11);
    placed.push({ x: padL + 4, y: 5, w: ctx.measureText(yl).width, h: 12 });
    var xl = phone ? 'compute: each tick is ten times more →' : 'compute: each tick is ten times more →';
    ctx.textAlign = 'right'; ctx.fillStyle = T.muted; ctx.fillText(xl, W - padR, H - 8);
    var dv = G.derived(), ladder = G.ladder(), litId = ladder.lit >= 0 ? ladder.rungs[ladder.lit].id : '';

    // the data wall estimate (in compute, on the recipe): quiet
    var wlo = G.C_of_tokens(S.data.lo), whi = G.C_of_tokens(S.data.hi);
    if (log10(wlo) < xMax) {
      var x0 = Xc(Math.max(wlo, Math.pow(10, xMin))), x1 = Math.min(Xc(whi), W - padR);
      ctx.fillStyle = rgba(T.danger, 0.07); ctx.fillRect(x0, padT, Math.max(2, x1 - x0), H - padT - padB);
      ctx.strokeStyle = rgba(T.danger, 0.45); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, padT); ctx.lineTo(Math.round(x0) + 0.5, H - padB); ctx.stroke(); ctx.setLineDash([]);
      want('the data wall', x0, padT + 20, rgba(T.danger, 0.9), 5, [[4, 0], [4, 14], [-4, 0]]);
    }
    // the biggest model that fits one card (until systems people arrive)
    if (dv.memLimit < CFG.memLimit[2]) {
      var memC = Math.pow(6 * dv.memLimit * CFG.tokGPT3 / Math.pow(CFG.gpt3C, CFG.tokExp), 1 / (1 - CFG.tokExp));
      var mx = Math.round(Xc(memC)) + 0.5;
      if (mx < W - padR) { ctx.strokeStyle = rgba(T.muted, 0.45); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, H - padB); ctx.stroke(); ctx.setLineDash([]); want('too big to fit', mx, padT + 8, T.muted, 6, [[-4, 0], [-4, 14], [4, 28], [-4, 28]]); }
    }
    // the line: what the compute should buy. Cold white.
    var lineKnown = S.day >= CFG.lineDay;
    ctx.strokeStyle = lineKnown ? rgba(T.white, 0.8) : rgba(T.white, 0.35); ctx.lineWidth = 1.5; ctx.setLineDash(lineKnown ? [] : [4, 4]);
    var lx0 = Xc(Math.pow(10, xMin)), ly0 = Yc(G.Lline(Math.pow(10, xMin))), lx1 = Xc(Math.pow(10, xMax)), ly1 = Yc(G.Lline(Math.pow(10, xMax)));
    ctx.beginPath(); ctx.moveTo(lx0, ly0); ctx.lineTo(lx1, ly1); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    // its caption, written along the line, above it, in the empty left end; it keeps the labels off its way
    var ang = Math.atan2(ly1 - ly0, lx1 - lx0), cos = Math.cos(ang), sin = Math.sin(ang);
    var capLines = phone ? ['the loss you should get', 'for the compute you spent'] : ['the loss you should get for the compute you spent'];
    ctx.save(); ctx.font = (phone ? '9px ' : '10px ') + '"IBM Plex Sans", system-ui, sans-serif'; ctx.fillStyle = rgba(T.white, 0.66); ctx.textAlign = 'left';
    var cStart = phone ? 0.035 : 0.05;
    capLines.forEach(function (ln, i) {
      var w = ctx.measureText(ln).width, off = -8 - (capLines.length - 1 - i) * 11, ox = lx0 + (lx1 - lx0) * cStart, oy = ly0 + (ly1 - ly0) * cStart;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(ang); ctx.fillText(ln, 6, off); ctx.restore();
      var xs = [6, 6 + w], ys = [off - 9, off + 2], minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      xs.forEach(function (u) { ys.forEach(function (v) { var px = ox + u * cos - v * sin, py = oy + u * sin + v * cos; minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py); }); });
      placed.push({ x: minx, y: miny, w: maxx - minx, h: maxy - miny });
    });
    ctx.restore();
    // rivals: grey, quiet
    var rcol = [T['rival-a'], T['rival-b'], T['rival-c']];
    S.rivals.forEach(function (rv, i) {
      var pubs = rv.pubs.filter(function (p) { return p.day <= S.day; }); if (!pubs.length) return;
      ctx.strokeStyle = rgba(rcol[i], 0.3); ctx.setLineDash([2, 3]); ctx.beginPath(); pubs.forEach(function (p, j) { var px = Xc(p.C), py = Yc(p.L); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
      pubs.forEach(function (p, j) { var px = Xc(p.C), py = Yc(p.L); ctx.fillStyle = rgba(rcol[i], j === pubs.length - 1 ? 0.95 : 0.55); marker(ctx, i, px, py, j === pubs.length - 1 ? 3.4 : 2.2); });
      var lp = pubs[pubs.length - 1]; block(Xc(lp.C), Yc(lp.L), 4);
      want(rv.name, Xc(lp.C), Yc(lp.L), rgba(rcol[i], 0.9), 7 + i * 0.1);
    });
    // GPT-3
    var gx = Xc(CFG.gpt3C), gy = Yc(CFG.gpt3L), out = S.day >= CFG.gpt3Day;
    ctx.strokeStyle = T.white; ctx.lineWidth = 1.5; ctx.setLineDash(out ? [] : [2, 2]); ctx.beginPath(); ctx.arc(gx, gy, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (out) { ctx.fillStyle = T.white; ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill(); }
    block(gx, gy, 8);
    want(out ? 'GPT-3' : 'GPT-3 · 28 May', gx, gy, T.white, 1, [[-10, 12], [-10, -12], [10, 12], [10, -12]]);
    // Series A bar: dim until the third rung is lit
    if (!S.raise.aDone) {
      var aC = Math.max(CFG.seriesA.needC, S.raise.aNeed), ax = Xc(aC), ay = Yc(G.Lline(aC)), lit = litId === 'seriesA', aa = lit ? 0.85 : 0.28;
      ctx.strokeStyle = rgba(T.accent, aa); ctx.beginPath(); ctx.moveTo(ax, ay - 14); ctx.lineTo(ax, ay - 4); ctx.stroke();
      want('Series A', ax, ay - 16, rgba(T.accent, lit ? 0.95 : 0.4), 4, [[0, -6], [6, -6], [-6, -6], [0, 26]]);
    }
    // your saved models
    S.runs.slice(-14).forEach(function (r) {
      if (!r.pts || r.pts.length < 2 || r.aborted) return;
      ctx.strokeStyle = r.clean ? rgba(T.accent, 0.2) : rgba(T.danger, 0.25); ctx.beginPath();
      r.pts.forEach(function (p, j) { var px = Xc(p.x), py = Yc(clamp(p.y, yMin, yMax)); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
    });
    S.runs.forEach(function (r) {
      if (r.aborted || !r.L) return;
      var px = Xc(r.C), py = Yc(r.L); hits.push({ x: px, y: py, r: 12, id: r.id });
      if (!r.clean) { ctx.strokeStyle = T.danger; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; return; }
      ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(px, py, 3.6, 0, Math.PI * 2); ctx.fill();
      if (r.published) { ctx.strokeStyle = T.accent; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke(); }
      if (r.shipped) { ctx.strokeStyle = T.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 6, py); ctx.lineTo(px + 12, py); ctx.stroke(); ctx.lineWidth = 1; }
    });
    var best = dv.best;
    if (best) {
      var bx = Xc(best.C), by = Yc(best.L);
      block(bx, by, 7);
      // the dimension line: from your biggest dot to the ring
      if (best.C < CFG.gpt3C * 0.95) {
        var sx = bx + 8, ex = gx - 9;
        if (ex > sx + 14) {
          var ly = (by + gy) / 2 - 0; var y1 = by, y2 = gy;
          ctx.strokeStyle = rgba(T.white, 0.55); ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(sx, y1); ctx.lineTo(ex, y2); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = rgba(T.white, 0.75); ctx.beginPath(); ctx.moveTo(sx, y1 - 4); ctx.lineTo(sx, y1 + 4); ctx.moveTo(ex, y2 - 4); ctx.lineTo(ex, y2 + 4); ctx.stroke();
          var txt = F.ratio(G.shortOf(best.C)) + ' short';
          var mxp = (sx + ex) / 2, myp = (y1 + y2) / 2, tw = ctx.measureText(txt).width + 8;
          placed.push({ x: mxp - tw / 2, y: myp - 16, w: tw, h: 12 });
          ctx.fillStyle = T.bg || '#050809'; ctx.fillStyle = rgba(T.bg, 0.85); ctx.fillRect(mxp - tw / 2, myp - 16, tw, 13);
          ctx.fillStyle = T.white; ctx.textAlign = 'center'; ctx.fillText(txt, mxp, myp - 9);
        }
      }
      want('you', bx, by, T.accent, 3);
    }
    // the live run pours
    S.active.forEach(function (r) {
      if (!r.pts.length || opts.end) return;
      ctx.strokeStyle = r.hang ? T.danger : T.accent; ctx.lineWidth = 2; ctx.beginPath();
      r.pts.forEach(function (p, j) { var px = Xc(p.x), py = Yc(clamp(p.y, yMin, yMax)); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.lineWidth = 1;
      var hp = r.pts[r.pts.length - 1], hx = Xc(hp.x), hy = Yc(clamp(hp.y, yMin, yMax));
      ctx.fillStyle = r.hang ? T.danger : T.accent; ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill();
      if (!X.reduced() && !r.hang) { ctx.strokeStyle = rgba(T.accent, 0.35 + 0.25 * Math.sin(X.nowMs() / 180)); ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.stroke(); }
      block(hx, hy, 6);
      if (r.hang) want(r.hang.nan ? r.hang.label : r.hang.label + (G.has('tom') ? ' my fault' : ' hung'), hx, hy, T.danger, 0);
      if (log10(r.C) > xMin && log10(r.C) < xMax) {
        var tx0 = Xc(r.C), ty0 = Yc(r.proj); ctx.strokeStyle = rgba(T.accent, 0.85); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(tx0, ty0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (r.sigUp > 0.003) { ctx.beginPath(); ctx.moveTo(tx0, ty0 - 6); ctx.lineTo(tx0, Yc(r.proj * (1 + 2 * r.sigUp))); ctx.stroke(); }
        block(tx0, ty0, 7); want('lands ' + F.date(S.day + G.runDaysLeft(r)), tx0, ty0, T.accent, r === S.run ? 2 : 2.5, [[10, 12], [10, -12], [-10, 12], [-10, -12], [0, 20]]);
      }
    });
    // where the next run would land (the designer)
    var tgt = ui && ui.design && !S.over && !opts.end && !ui.design.block ? { C: ui.design.C, L: ui.design.L, sig: ui.design.sigUp, label: 'next run', bad: ui.design.r > 1 } : null;
    if (tgt && log10(tgt.C) > xMin && log10(tgt.C) < xMax) {
      var tx = Xc(tgt.C), ty = Yc(tgt.L), col = tgt.bad ? T.danger : T.accent;
      ctx.strokeStyle = rgba(col, 0.85); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (tgt.sig > 0.003) { ctx.beginPath(); ctx.moveTo(tx, ty - 6); ctx.lineTo(tx, Yc(tgt.L * (1 + 2 * tgt.sig))); ctx.stroke(); }
      block(tx, ty, 7);
      want(tgt.label, tx, ty, col, 3.5, [[10, 12], [10, -12], [-10, 12], [-10, -12], [0, 20]]);
    }
    placeAll();
    if (ui) ui.hits = hits;
  };
})(window.FX);
