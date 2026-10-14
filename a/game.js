/* FRONTIER, the lab sim. Builder A: the letter of spec/sim1.json.
   One sheet. The pour is the clock. Three letters a month slide up from the bottom; flick up to take, down to let pass.
   Numbers in config.js, math in rules.js, people and history in content.js, the model's words in corpus.js. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG, CORPUS = window.FRONTIER_CORPUS, K = window.FRONTIER_CONTENT, R = window.FRONTIER_RULES.make(CFG);
  var $ = function (id) { return document.getElementById(id); };
  var root = $('fr'), cv = $('fr-cv'), ctx = cv.getContext('2d'), hi = $('fr-hi'), hctx = hi.getContext('2d');
  var elBrand = $('fr-brand'), elToday = $('fr-today'), elHour = $('fr-hour'), elBought = $('fr-bought');
  var elMN = $('fr-mn'), elProj = $('fr-proj'), elNames = $('fr-names'), elNotes = $('fr-notes'), elBoxes = $('fr-boxes'), elHeads = $('fr-heads');
  var elBand = $('fr-band'), elSample = $('fr-sample'), elCount = $('fr-count'), elReadout = $('fr-readout');
  var elDim = $('fr-dim'), elMoment = $('fr-moment'), elMomentText = $('fr-moment-text');
  var elLetter = $('fr-letter'), elFocus = $('fr-focus'), elMute = $('fr-mute'), elSafe = $('fr-safe'), elLive = $('fr-live');
  var lFrom = elLetter.querySelector('.from'), lOffer = elLetter.querySelector('.offer'), lUp = elLetter.querySelector('.eff .up'), lDown = elLetter.querySelector('.eff .down');
  var lFuse = elLetter.querySelector('.fuse i'), lTip = document.createElement('b'); elLetter.querySelector('.fuse').appendChild(lTip);

  /* ---------------- colours: one source, the CSS tokens ---------------- */
  var cs = getComputedStyle(document.documentElement);
  function tok(n, d) { var v = (cs.getPropertyValue(n) || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; }
  var COL = { paper: tok('--paper', '#E4E5E1'), ink: tok('--ink', '#15171A'), grid: tok('--grid', '#CCCFCA'), graphite: tok('--graphite', '#6E7378'),
    reserve: tok('--reserve', '#F8F8F5'), fil: tok('--filament', '#FF7A21'), verm: tok('--vermilion', '#E5482E'), dry: tok('--dry', '#A9ACAA') };
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  var RGB = {}; Object.keys(COL).forEach(function (k) { RGB[k] = hex(COL[k]); });
  function rgba(a, al) { var A = RGB[a]; return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + al + ')'; }

  /* ---------------- utils ---------------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(u) { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function easeOut(u) { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); }
  var log10 = R.log10;
  function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var hashSeed = (String(location.hash).match(/seed=(\d+)/) || [])[1];
  var rng = Math.random, vis = Math.random;
  function gauss(r) { r = r || vis; return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function pick(a) { return a[Math.floor(rng() * a.length)]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function U(a, b) { return a + rng() * (b - a); }
  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function store(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  function fmtInt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function money(x) {
    var a = Math.abs(x);
    if (a >= 1e9) return '$' + (Math.round(a / 1e8) / 10) + 'B';
    if (a >= 1e6) return '$' + (a >= 1e8 ? Math.round(a / 1e6) : Math.round(a / 1e5) / 10) + 'M';
    if (a >= 1e3) return '$' + fmtInt(a);
    return '$' + Math.round(a);
  }
  function pct(x) { var v = Math.round(x * 1000) / 10; return (v % 1 ? v.toFixed(1) : String(v)) + '%'; }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function dom(day) { return R.dateOf(day).getUTCDate(); }

  /* ---------------- clocks ---------------- */
  var now = 0, speedMul = 1, lastTs = 0, timers = [], yearN = 0;
  function after(sec, fn) { timers.push({ at: now + sec, fn: fn, n: yearN }); }
  function runTimers() {
    if (!timers.length) return;
    var due = [];
    for (var i = timers.length - 1; i >= 0; i--) if (timers[i].at <= now + 1e-9) { due.push(timers[i]); timers.splice(i, 1); }
    due.sort(function (a, b) { return a.at - b.at; });
    for (i = 0; i < due.length; i++) if (due[i].n === yearN) due[i].fn();
  }

  /* ================================================================
     LAYOUT (art direction: phone and laptop stacks)
     ================================================================ */
  var L = {}, dpr = 1;
  function viewport() {
    var vv = window.visualViewport, w = window.innerWidth || document.documentElement.clientWidth, h = window.innerHeight || document.documentElement.clientHeight;
    if (vv && vv.width > 0 && vv.height > 0 && vv.scale <= 1.01) { w = Math.min(w, Math.round(vv.width)); h = Math.min(h, Math.round(vv.height)); }
    return { w: Math.max(300, w), h: Math.max(320, h) };
  }
  function layout() {
    var vp = viewport(), vw = vp.w, vh = vp.h;
    var sp = getComputedStyle(elSafe);
    var safe = { t: parseFloat(sp.paddingTop) || 0, r: parseFloat(sp.paddingRight) || 0, b: parseFloat(sp.paddingBottom) || 0, l: parseFloat(sp.paddingLeft) || 0 };
    // a rotated phone (or any short, wide window) gets the same sheet folded into two columns: paper left, the rest right
    var land = vw > vh && vh < 560 && vw >= 560;
    var lap = !land && vw >= CFG.laptopMinWidth;
    L = { vw: vw, vh: vh, lap: lap, land: land, safe: safe };
    if (land) {
      var g2 = 16, xl2 = g2 + safe.l, xr2 = vw - g2 - safe.r, tt = safe.t, bb = vh - safe.b;
      var colW = clamp(Math.round((xr2 - xl2) * 0.46), 300, 420), mid = xr2 - colW;
      L.x0 = xl2; L.x1 = xr2; L.top = tt;
      L.dateY = tt + 12; L.monthsY = tt + 6;
      var hdr = 46, nw = 52, nl = 26;
      L.names = { x: xl2 - 2, y: tt + hdr + 10, w: nw, line: nl };
      L.headY = tt + hdr + 1;
      L.paper = { y: tt + hdr, bottom: bb - 4 };
      L.ruler = { y: L.paper.bottom - 24, h: 24 };
      L.plot = { x: xl2 + nw, y: tt + hdr + 18, w: mid - 20 - xl2 - nw, h: 0 };
      L.plot.h = L.ruler.y - 6 - L.plot.y;
      var lh = 128, ly = bb - lh - 6, sh2 = 48, sy = ly - 10 - sh2, ch2 = clamp(Math.round((sy - tt - hdr) * 0.18), 30, 52), cy = sy - 8 - ch2;
      L.band = { x: mid, y: tt + hdr, w: colW, h: Math.max(48, cy - 18 - (tt + hdr)) };
      L.cluster = { x: mid, y: cy, w: colW, h: ch2 };
      L.strip = { x: mid, y: sy, w: colW, h: sh2, home: 52 };
      L.letter = { x: mid, w: colW, y: ly, h: lh, max: bb - 4 };
      L.readAbove = CFG.phone.readoutAbove; L.bandFont = [16, 22]; L.momentFont = 20;
      L.mute = { x: xl2 - 6, y: tt + 24 };
      L.moment = { y: tt + hdr, h: bb - tt - hdr };
      L.nameLine = nl; L.nameFont = 17;
    } else if (!lap) {
      var P = CFG.phone, t0 = safe.t, H = vh - safe.t - safe.b, g = P.gutter, xl = g + safe.l, xr = vw - g - safe.r;
      // the stack is anchored to the bottom (the thumb's end): letter zone, strip, cluster, sample band; the paper takes
      // what is left. Short phones first give the band and the cluster a little, so the paper keeps some height.
      var squeeze = clamp((760 - H) / 120, 0, 1);   // 0 on a tall phone, 1 at 640 px and shorter
      var bandH = P.bandBottom - P.paperBottom - 8 - Math.round(26 * squeeze), clH = P.clusterH - Math.round(12 * squeeze);
      var letY = t0 + H - (P.ref - P.letterTop), stY = letY - (P.letterTop - P.stripTop), clY = stY - 6 - clH, bandY = clY - 10 - bandH;
      var paperBottom = Math.max(t0 + P.headerH + 150, bandY - 4);
      L.x0 = xl; L.x1 = xr; L.top = t0;
      L.dateY = t0 + 15; L.monthsY = t0 + 10;
      L.names = { x: xl - 2, y: t0 + 92 - 14, w: P.namesW, line: P.nameLine };
      L.headY = t0 + 66;
      L.paper = { y: t0 + P.headerH, bottom: paperBottom };
      L.ruler = { y: paperBottom - P.rulerH, h: P.rulerH };
      L.plot = { x: xl + P.namesW, y: t0 + 84, w: xr - xl - P.namesW, h: 0 };
      L.plot.h = L.ruler.y - 6 - L.plot.y;
      L.band = { x: xl, y: paperBottom + 4, w: xr - xl, h: bandH };
      L.cluster = { x: xl, y: clY, w: xr - xl, h: clH };
      L.strip = { x: xl, y: stY, w: xr - xl, h: P.stripH, home: P.homeW };
      L.letter = { x: xl, w: xr - xl, y: letY, h: P.letterH, max: vh - safe.b - 6 };
      L.readAbove = P.readoutAbove; L.bandFont = squeeze > 0.5 ? [16, 22] : [17, 24]; L.momentFont = 21;
      L.mute = { x: xl - 6, y: t0 + 26 };
      L.moment = { y: L.plot.y, h: L.band.y + L.band.h - L.plot.y };
      L.nameLine = P.nameLine; L.nameFont = 18;
    } else {
      // the art direction's shares of the viewport, anchored from the bottom so a short laptop never stacks the letter on the strip
      var Q = CFG.laptop, cw = Math.min(vw - 48, Q.colMax), x0 = (vw - cw) / 2;
      L.x0 = x0; L.x1 = x0 + cw; L.top = 0;
      var hdrH = Math.max(52, vh * Q.header);
      L.dateY = hdrH * 0.36; L.monthsY = hdrH * 0.18;
      var lzH = Q.letterH + 22, letY = vh - lzH + 8;
      var stY = Math.min(vh * Q.stripTop, letY - 14 - Q.stripH);
      var clH = clamp(vh * (Q.clusterBottom - Q.clusterTop), 40, 60), clY = Math.min(vh * Q.clusterTop, stY - 10 - clH);
      var bandH = clamp(vh * (Q.bandBottom - Q.bandTop) - 8, 3 * 27 + 6, 150), bandY = clY - 10 - bandH;
      var papB = bandY - 4;
      L.names = { x: x0, y: hdrH + 40, w: Q.namesW, line: Q.nameLine };
      L.headY = hdrH + 10;
      L.paper = { y: hdrH, bottom: papB };
      L.ruler = { y: L.paper.bottom - Q.rulerH, h: Q.rulerH };
      L.plot = { x: x0 + Q.namesW, y: hdrH + 34, w: cw - Q.namesW, h: 0 };
      L.plot.h = L.ruler.y - 6 - L.plot.y;
      var bw = Math.min(Q.bandMax, cw);
      L.band = { x: x0 + (cw - bw) / 2, y: bandY, w: bw, h: bandH };
      L.cluster = { x: x0, y: clY, w: cw, h: clH };
      L.strip = { x: x0, y: stY, w: cw, h: Q.stripH, home: Q.homeW };
      var lw = Math.min(Q.letterW, vw - 32);
      L.letter = { x: x0 + (cw - lw) / 2, w: lw, y: letY, h: Q.letterH, max: vh - 6 };
      L.readAbove = Q.readoutAbove; L.bandFont = [19, 27]; L.momentFont = 28;
      L.mute = { x: x0 - 6, y: L.dateY + 14 };
      L.moment = { y: L.plot.y, h: L.band.y + L.band.h - L.plot.y };
      L.nameLine = Q.nameLine; L.nameFont = 22;
    }
    L.travel = { x: L.strip.x + L.strip.home, w: L.strip.w - L.strip.home };
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [cv, hi, $('fr-cs')].forEach(function (c) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); });
    $('fr-date').style.left = L.x0 + 'px'; $('fr-date').style.top = L.dateY + 'px';
    $('fr-months').style.right = (vw - L.x1) + 'px'; $('fr-months').style.top = L.monthsY + 'px';
    elNames.style.left = L.names.x + 'px'; elNames.style.top = L.names.y + 'px';
    elBand.style.left = L.band.x + 'px'; elBand.style.top = L.band.y + 'px'; elBand.style.width = L.band.w + 'px'; elBand.style.height = L.band.h + 'px';
    elCount.style.right = (vw - (L.cluster.x + L.cluster.w)) + 'px'; elCount.style.top = (L.cluster.y - 14) + 'px';
    elFocus.style.left = (L.strip.x - 3) + 'px'; elFocus.style.top = (L.strip.y - 3) + 'px'; elFocus.style.width = (L.strip.w + 6) + 'px'; elFocus.style.height = (L.strip.h + 6) + 'px';
    elMute.style.left = L.mute.x + 'px'; elMute.style.top = L.mute.y + 'px';
    L.headW = land ? Math.round(L.plot.x + L.plot.w + 12) : vw;
    elHeads.style.width = L.headW + 'px'; elHeads.style.height = Math.round(L.headY + 20) + 'px'; elHeads.style.overflow = land ? 'hidden' : 'visible';
    elMoment.style.top = L.moment.y + 'px'; elMoment.style.height = L.moment.h + 'px';
    elMomentText.style.maxWidth = Math.min(lap || land ? 760 : 9999, vw - 2 * (lap ? 48 : 22)) + 'px';
    elLetter.style.left = L.letter.x + 'px'; elLetter.style.width = L.letter.w + 'px'; elLetter.style.minHeight = L.letter.h + 'px';
    root.classList.toggle('land', land); root.classList.toggle('lap', lap);
    elNames.style.setProperty('--nf', L.nameFont + 'px'); elNames.style.setProperty('--nl', L.nameLine + 'px');
    staticDirty = true; nameRects = null; letterH = 0;
    if (G) { renderNames(); placeNotes(); fitBand(); placeLetter(); }
  }
  // name positions are read from the DOM once per layout (and when the margin changes), never every frame
  var nameRects = null;
  function nameRect(id) {
    if (!nameRects) {
      nameRects = {};
      var bs = elNames.children;
      for (var i = 0; i < bs.length; i++) { var r = bs[i].getBoundingClientRect(); nameRects[bs[i].getAttribute('data-id')] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }
    }
    return nameRects[id] || null;
  }

  /* ---------------- plot mapping: log compute across, log loss down; the view pans ---------------- */
  var view = { l: CFG.plotLeftMinLog, r: CFG.plotRightMinLog, from: null, to: null, t0: 0 };
  var Y_TOP = Math.log(CFG.plotLossTop), Y_BOT = Math.log(CFG.plotLossBottom);
  function X(lc) { return L.plot.x + (lc - view.l) / (view.r - view.l) * L.plot.w; }
  function Y(lnL) { return L.plot.y + (Y_TOP - lnL) / (Y_TOP - Y_BOT) * L.plot.h; }
  function lineY(C) { return Y(Math.log(R.Lline(C))); }
  function DX(day) { return L.plot.x + clamp(day / CFG.endDay, 0, 1) * L.plot.w; }
  function viewTarget() {
    var big = 0, last = null; G.runs.forEach(function (r) { if (r.C > big) big = r.C; last = r.C; });
    if (G.run) { last = G.run.C; if (G.run.C > big) big = G.run.C; }
    var l = last ? clamp(Math.floor(log10(last) - CFG.plotLeftBack), CFG.plotLeftMinLog, CFG.plotLeftMaxLog) : CFG.plotLeftMinLog;
    return [l, Math.max(CFG.plotRightMinLog, big ? log10(2 * big) : 0)];
  }
  function panToTarget() {
    var t = viewTarget();
    if (Math.abs(t[0] - view.l) < 1e-6 && Math.abs(t[1] - view.r) < 1e-6) return;
    view.from = { l: view.l, r: view.r }; view.to = { l: t[0], r: t[1] }; view.t0 = now; snd.whirr(0.6);
  }
  function stepView() {
    if (!view.to) return;
    var u = reduced() ? 1 : (now - view.t0) / CFG.panSec, e = ease(u);
    view.l = view.from.l + (view.to.l - view.from.l) * e; view.r = view.from.r + (view.to.r - view.from.r) * e;
    if (u >= 1) { view.l = view.to.l; view.r = view.to.r; view.to = null; }
    staticDirty = true; placeNotes();
  }

  /* ================================================================
     SOUND (Web Audio, started by the first touch)
     ================================================================ */
  var snd = (function () {
    var A = { ctx: null, muted: store('frontier.sim.muted') === '1' };
    function db(x) { return Math.pow(10, x / 20); }
    function t() { return A.ctx.currentTime; }
    function ok() { return !!(A.ctx && A.ctx.state === 'running'); }
    function start() {
      if (A.ctx) { try { if (A.ctx.state === 'suspended' && !document.hidden) A.ctx.resume(); } catch (e) { } return; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        var c = A.ctx = new AC();
        A.out = c.createGain(); A.out.gain.value = A.muted ? 0 : 1; A.out.connect(c.destination);
        A.duck = c.createGain(); A.duck.gain.value = 1; A.duck.connect(A.out);
        var n = Math.floor(c.sampleRate * 2), wb = c.createBuffer(1, n, c.sampleRate), bb = c.createBuffer(1, n, c.sampleRate), pb = c.createBuffer(1, n, c.sampleRate);
        var w = wb.getChannelData(0), b = bb.getChannelData(0), pk = pb.getChannelData(0), last = 0, peak = 0, b0 = 0, b1 = 0, b2 = 0;
        for (var i = 0; i < n; i++) {
          var x = Math.random() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; b[i] = last; if (Math.abs(last) > peak) peak = Math.abs(last);
          b0 = 0.99765 * b0 + x * 0.0990460; b1 = 0.96300 * b1 + x * 0.2965164; b2 = 0.57000 * b2 + x * 1.0526913; pk[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
        }
        for (i = 0; i < n; i++) b[i] /= (peak || 1);
        A.white = wb; A.pink = pb;
        A.motor = c.createGain(); A.motor.gain.value = 0; A.motor.connect(A.duck);
        A.o1 = c.createOscillator(); A.o1.frequency.value = 55; A.o2 = c.createOscillator(); A.o2.frequency.value = 110.6;
        A.g1 = c.createGain(); A.g1.gain.value = db(CFG.sound.motorDb); A.g2 = c.createGain(); A.g2.gain.value = db(CFG.sound.motorDb);
        A.o1.connect(A.g1); A.o2.connect(A.g2); A.g1.connect(A.motor); A.g2.connect(A.motor);
        var bs = c.createBufferSource(); bs.buffer = bb; bs.loop = true; var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        A.bg = c.createGain(); A.bg.gain.value = db(CFG.sound.motorNoiseDb); bs.connect(lp); lp.connect(A.bg); A.bg.connect(A.motor);
        A.o1.start(); A.o2.start(); bs.start();
        var ws = c.createBufferSource(); ws.buffer = wb; ws.loop = true; A.bp = c.createBiquadFilter(); A.bp.type = 'bandpass'; A.bp.frequency.value = 3200; A.bp.Q.value = 0.8;
        A.scr = c.createGain(); A.scr.gain.value = 0; ws.connect(A.bp); A.bp.connect(A.scr); A.scr.connect(A.duck); ws.start();
      } catch (e) { A.ctx = null; }
    }
    function blip(freq, dur, dbv, type) {
      if (!ok()) return; try {
        var c = A.ctx, o = c.createOscillator(), g = c.createGain(), t0 = t();
        if (type) o.type = type;
        o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(db(dbv), t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(A.duck); o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    function noise(buf, ftype, freq, q, dur, dbv, fadeIn) {
      if (!ok()) return; try {
        var c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = t();
        s.buffer = buf; f.type = ftype; f.frequency.value = freq; f.Q.value = q;
        if (fadeIn) { g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(db(dbv), t0 + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); }
        else { g.gain.setValueAtTime(db(dbv), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); }
        s.connect(f); f.connect(g); g.connect(A.duck); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    function target(param, v, sec) { try { param.cancelScheduledValues(t()); param.setTargetAtTime(v, t(), Math.max(0.005, sec / 3)); } catch (e) { } }
    var lastTick = 0, lastCard = 0, lastFuse = 0;
    return {
      start: start,
      get muted() { return A.muted; },
      setMuted: function (m) { A.muted = m; store('frontier.sim.muted', m ? '1' : '0'); if (A.ctx) try { A.out.gain.setTargetAtTime(m ? 0 : 1, A.ctx.currentTime, 0.02); } catch (e) { } },
      // motor: the full two-sine hum while training; idle is the 55 Hz sine alone at -36 dB
      motor: function (mode, cards, sec) {
        if (!A.ctx) return; sec = sec || 0.3;
        if (mode === 'train') { var up = Math.pow(10, (Math.log(Math.max(8, cards) / 8) / Math.LN2) / 20); target(A.motor.gain, up, sec); target(A.g2.gain, db(CFG.sound.motorDb), sec); target(A.bg.gain, db(CFG.sound.motorNoiseDb), sec); target(A.g1.gain, db(CFG.sound.motorDb), sec); }
        else if (mode === 'idle') { target(A.motor.gain, 1, sec); target(A.g2.gain, 0, sec); target(A.bg.gain, 0, sec); target(A.g1.gain, db(CFG.sound.idleDb), sec); }
        else target(A.motor.gain, 0, sec);
      },
      // bankruptcy: the motor winds down from 55 to 30 Hz over sec, then stops
      windDown: function (sec) {
        if (!A.ctx) return; try {
          var t0 = t(), g = A.motor.gain;
          g.cancelScheduledValues(t0); g.setValueAtTime(Math.max(0.5, g.value), t0); g.linearRampToValueAtTime(0, t0 + sec);
          [A.g1.gain, A.g2.gain].forEach(function (p) { p.cancelScheduledValues(t0); p.setValueAtTime(db(CFG.sound.motorDb), t0); });
          A.o1.frequency.cancelScheduledValues(t0); A.o1.frequency.setValueAtTime(A.o1.frequency.value, t0); A.o1.frequency.linearRampToValueAtTime(30, t0 + sec);
          A.o2.frequency.cancelScheduledValues(t0); A.o2.frequency.setValueAtTime(A.o2.frequency.value, t0); A.o2.frequency.linearRampToValueAtTime(60.3, t0 + sec);
          A.scr.gain.cancelScheduledValues(t0); A.scr.gain.setValueAtTime(0, t0);
        } catch (e) { }
      },
      cut: function () { if (A.ctx) try { A.motor.gain.cancelScheduledValues(t()); A.motor.gain.setValueAtTime(0, t()); A.scr.gain.cancelScheduledValues(t()); A.scr.gain.setValueAtTime(0, t()); } catch (e) { } },
      motorFreq: function (f, sec) { if (A.ctx) { target(A.o1.frequency, f, sec); target(A.o2.frequency, f * 2.011, sec); } },
      scratch: function (u) { if (A.ctx) try { A.scr.gain.setTargetAtTime(db(CFG.sound.scratchMaxDb) * clamp(u, 0, 1), t(), 0.03); } catch (e) { } },
      tick: function () { var n = performance.now(); if (n - lastTick < 30) return; lastTick = n; blip(2400, 0.006, CFG.sound.tickDb); },
      card: function () { var n = performance.now(); if (n - lastCard < 30) return; lastCard = n; blip(1800, 0.005, CFG.sound.printDb); },
      pay: function () { blip(70, 0.06, CFG.sound.payDb); noise(A.white, 'highpass', 2000, 0.7, 0.003, CFG.sound.payDb + 4); },
      letter: function () { noise(A.pink, 'lowpass', 1200, 0.7, 0.4, CFG.sound.letterDb, true); },
      take: function () { blip(120, 0.04, CFG.sound.takeDb); blip(2000, 0.004, CFG.sound.takeDb - 6); },
      pass: function () { noise(A.pink, 'lowpass', 1200, 0.7, 0.3, CFG.sound.passDb, true); },
      fuse: function () { var n = performance.now(); if (n - lastFuse < 70 + Math.random() * 50) return; lastFuse = n; noise(A.white, 'bandpass', 3000, 2, 0.01, CFG.sound.fuseDb); },
      thud: function () { blip(41, 0.25, CFG.sound.hangThudDb); },
      strike: function () { noise(A.white, 'bandpass', 3200, 0.8, 0.6, -32, true); },
      lift: function () {
        if (ok()) try {
          var c = A.ctx, t0 = t(), g = c.createGain(); g.gain.setValueAtTime(db(CFG.sound.liftDb), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4); g.connect(A.duck);
          [55, 110].forEach(function (f) { var o = c.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 1.45); });
        } catch (e) { }
        try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { }
      },
      whirr: function (dur) {
        if (!ok()) return; try {
          var c = A.ctx, t0 = t(), o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
          o.type = 'sawtooth'; o.frequency.value = 90; f.type = 'lowpass'; f.frequency.value = 600;
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(db(CFG.sound.feedDb), t0 + 0.08);
          g.gain.setValueAtTime(db(CFG.sound.feedDb), t0 + Math.max(0.09, dur - 0.12)); g.gain.linearRampToValueAtTime(0, t0 + dur);
          o.connect(f); f.connect(g); g.connect(A.duck); o.start(t0); o.stop(t0 + dur + 0.05);
        } catch (e) { }
      },
      hatch: function (sec) {
        if (!A.ctx) return;
        try { var g = A.scr.gain, t0 = t(); g.cancelScheduledValues(t0); g.setValueAtTime(g.value, t0); g.linearRampToValueAtTime(db(CFG.sound.scratchMaxDb) * 0.85, t0 + 0.05); g.setValueAtTime(db(CFG.sound.scratchMaxDb) * 0.8, t0 + sec - 0.08); g.linearRampToValueAtTime(0, t0 + sec); } catch (e) { }
      },
      duck: function (hold, back) {
        if (!A.ctx) return; try { var g = A.duck.gain, t0 = t(); g.cancelScheduledValues(t0); g.setValueAtTime(g.value, t0); g.linearRampToValueAtTime(0, t0 + 0.08); g.setValueAtTime(0, t0 + 0.08 + hold); g.linearRampToValueAtTime(1, t0 + 0.08 + hold + back); } catch (e) { }
      },
      silence: function (sec) { if (A.ctx) target(A.duck.gain, 0, sec || 0.05); },
      restore: function () { if (A.ctx) target(A.duck.gain, 1, 0.1); },
      sleep: function () { if (A.ctx && A.ctx.state === 'running') { A.was = true; try { A.ctx.suspend(); } catch (e) { } } },
      wake: function () { if (A.ctx && A.was) { A.was = false; try { A.ctx.resume(); } catch (e) { } } }
    };
  })();

  /* ================================================================
     THE YEAR: state
     ================================================================ */
  var G = null;
  function proto(id) { for (var i = 0; i < K.people.length; i++) if (K.people[i].id === id) return K.people[i]; return null; }
  function newYear(seed) {
    yearN++; timers = [];
    var s = seed != null ? seed : (hashSeed && yearN === 1 ? +hashSeed : (Math.random() * 4294967295) >>> 0);
    rng = mulberry(s >>> 0); vis = mulberry((s ^ 0x9E3779B9) >>> 0);
    G = {
      seed: s, powered: false, firstLift: false, day: 0, month: -1, phase: 'asleep', over: null,
      bank: CFG.seedBank - CFG.dgx1Price, stake: CFG.stakeStart,
      people: [], owned: CFG.ownedStart, ownedA100: 0, orders: [], rentals: [], mer: null, merPassed: false, merSecondDone: false, lent: null, api: null, queueCut: 0,
      W: R.drawW(rng), caps: R.drawCaps(rng), filter: null, filters: 0, priyaOffer: 0, lastFrayAmt: 0,
      run: null, runs: [], dots: [], rings: [], scars: [], hangMarks: [], cp: null, held: null,
      rivals: [], letter: null, wait: [], lastBroker: -99, brokerNext: 'rent', buyA100Next: false, seen: {},
      silent: false, scandals: [], scandalMonth: -1, termBlockUntil: 0,
      A: { taken: false, need: CFG.seriesA.minC }, B: { taken: false, need: CFG.seriesB.minC },
      openedC: 0, openedDay: -99, firstAuthor: null, snapNext: false, tomOffUntil: -1, rivalTrickDay: null, lastPublishDay: -999,
      hangsThisMonth: 0, hangsLastMonth: 0, evals: null, lineT0: null, gpt3: false, miracle: false, december: null,
      sample: null, bags: {}, t3used: {}, t4used: {}, newsDone: {}, phrases: [], headQ: [], head: null, notes: [], hints: {},
      pendings: [], log: []
    };
    G.Dwall = CFG.passes * G.W; G.Cwall = R.C_of_tokens(G.Dwall);
    CFG.rivals.forEach(function (r) {
      var c0 = r.c0 * Math.pow(10, U(-CFG.rivalJitter, CFG.rivalJitter));
      G.rivals.push({ id: r.id, name: r.name, logc: log10(c0), tau: r.tau, period: r.period, offset: r.offset, trick: 1,
        pubs: [{ C: c0 / 2, L: R.Lline(c0 / 2) * r.offset, day: -30 }], next: r.period * U(CFG.rivalPeriodJitter[0], CFG.rivalPeriodJitter[1]), passed: false });
    });
    view.l = CFG.plotLeftMinLog; view.r = CFG.plotRightMinLog; view.to = null;
    stopShown = { T: 0 };
    clearDom();
    root.classList.remove('on', 'dry', 'sold', 'faded');
    clusterUnit = 1; clusterMorph = null;
    staticDirty = true;
    return G;
  }
  function clearDom() {
    elNotes.innerHTML = ''; elBoxes.innerHTML = ''; elHeads.innerHTML = ''; elSample.innerHTML = ''; elNames.innerHTML = '';
    elSample.style.transform = ''; elSample.style.opacity = '1';
    elReadout.style.opacity = 0; elDim.style.opacity = 0; elMoment.style.opacity = 0; elMomentText.innerHTML = ''; hi.style.display = 'none';
    elLetter.hidden = true; letterAnim = null; flick = null; band = null; bandFly = null; moment = null; boxEls = {}; drag = null; ptr = null;
    elBrand.classList.remove('struck'); elBought.textContent = ''; elHour.textContent = ''; elProj.textContent = ''; elMN.textContent = ''; lastMN = ''; lastToday = '';
  }

  /* ---------------- people ---------------- */
  function staff() { return G.people.filter(function (p) { return !p.gone; }); }
  function person(id) { for (var i = 0; i < G.people.length; i++) if (G.people[i].id === id && !G.people[i].gone) return G.people[i]; return null; }
  function hasRole(role) { return staff().some(function (p) { return p.role === role; }); }
  function hasSystems() { return hasRole('systems'); }
  function hasBeliever() { return !!person('ayaan'); }
  function infraMult() {
    var tom = person('tom') && G.day >= G.tomOffUntil, kofi = !!person('kofi');
    return tom && kofi ? CFG.hangBothMult : (tom || kofi) ? CFG.hangInfraMult : 1;
  }
  function hasInfra() { return infraMult() < 1; }
  function sunheeBend() { var p = person('sunhee'); return p && G.day >= p.joined + CFG.sunheeDelay ? CFG.sunheeBend : 1; }
  function addPerson(id, salary) {
    var p = proto(id); if (!p || person(id)) return null;
    var me = { id: p.id, name: p.name, full: p.full, surname: p.surname, role: p.role, salary: salary || p.salary, ego: p.ego, mood: CFG.moodStart, joined: G.day, gone: false, he: !!p.he, writeT0: now };
    G.people = G.people.filter(function (q) { return q.id !== id; });
    var old = nameEl(id); if (old) old.remove();
    G.people.push(me); renderNames(); return me;
  }
  function walk(id, why) {
    var p = person(id); if (!p) return null;
    p.gone = true; p.why = why; p.left = G.day;
    if (G.filter && G.filter.who === id) { G.filter = null; }
    if (G.held && id === 'lena') { G.held = null; }
    snd.strike(); renderNames(); return p;
  }
  function mood(id, d) {
    var p = person(id); if (!p) return;
    p.mood = clamp(p.mood + d, 0, 100);
    if (p.mood <= 0) walk(id, 'mood');
    renderNames();
  }
  function moodAll(d, filter) { staff().forEach(function (p) { if (!filter || filter(p)) mood(p.id, d); }); }
  function nameWeight(p) { var E = CFG.egoWeight[p.ego] || 550; return clamp(Math.round(400 + (E - 400) * p.mood / 70), 400, 700); }

  /* ---------------- the economy ---------------- */
  function rentPriceNow() { var p = CFG.rentPrice[0][1]; CFG.rentPrice.forEach(function (x) { if (G.day >= x[0]) p = x[1]; }); return p; }
  function rentLive() { return G.rentals.filter(function (r) { return G.day >= r.start && G.day < r.end; }); }
  function rentedN() { var n = 0; rentLive().forEach(function (r) { n += r.n; }); return n; }
  function rentPerDay() { var s = 0; rentLive().forEach(function (r) { s += r.n * r.price * 24; }); return s; }
  function rentBurnMonthly() { var s = 0; G.rentals.forEach(function (r) { if (G.day < r.end) s += r.n * r.price * 24 * CFG.daysPerMonth; }); return s; }
  function merLive() { return G.mer && G.day >= G.mer.live ? Math.max(0, G.mer.cards - G.queueCut) : 0; }
  function lentN() { return G.lent && G.day < G.lent.until ? G.lent.n : 0; }
  function salaries() { var s = 0; staff().forEach(function (p) { s += p.salary; }); return s; }
  function payroll() { return CFG.basePerMonth + salaries() + CFG.upkeepPerCard * (G.owned + G.ownedA100); }
  function apiRevenue() { return G.api ? G.api.revenue : 0; }
  function burn() { return payroll() + rentBurnMonthly() - apiRevenue(); }
  function monthsLeft(bank, b) { bank = bank == null ? G.bank : bank; b = b == null ? burn() : b; if (b <= 0) return CFG.monthsCap; return clamp(Math.max(0, bank) / b, 0, CFG.monthsCap); }
  function fmtMonths(m) { return m >= 3 ? String(Math.floor(m)) : (Math.floor(m * 10) / 10).toFixed(1); }
  function trainingRaw() { return Math.max(0, G.owned - lentN()) + G.ownedA100 * CFG.a100Eq + rentedN() + merLive(); }
  function trainingCount() { return Math.max(0, G.owned - lentN()) + G.ownedA100 + rentedN() + merLive(); }
  function servingN() { return G.api ? clamp(Math.round(trainingCount() * CFG.servingShare), CFG.servingMin, CFG.servingMax) : 0; }
  function trainingEq() { return Math.max(0, trainingRaw() - servingN()); }
  function flopsPerDay() { return trainingEq() * CFG.v100PerDay; }
  function rentPendingN() { var n = 0; G.rentals.forEach(function (r) { if (G.day < r.start) n += r.n; }); return n; }
  // the count beside the band, in physical cards: what is drawn as live or hollow (rentals live tomorrow count), not pencil
  function cardsShown() { return G.owned + G.ownedA100 + rentedN() + rentPendingN() + (G.mer && G.day >= G.mer.live ? G.mer.cards : 0); }

  /* ---------------- dots and proofs ---------------- */
  function farthestClean() { var c = 0; G.dots.forEach(function (d) { if (d.C > c) c = d.C; }); return c; }
  function farthestPub() { var c = 0; G.dots.forEach(function (d) { if ((d.pub || d.ship) && d.C > c) c = d.C; }); return c; }
  function onLine(d) { return d.L <= R.Lline(d.C) * (1 + CFG.onLineTol); }
  // the Series A: a clean dot of 1e22 or more, on the line, landed after the line printed (23 Jan), plus any clean dot
  // on the line a decade or more below it (the clerk's sim, which set every gate number, counts January's dots too)
  function proofA() {
    var on = G.dots.filter(onLine), best = 0;
    on.forEach(function (a) { if (a.day < CFG.seriesA.after || a.C < Math.max(CFG.seriesA.minC, G.A.need)) return; if (on.some(function (b) { return b.C <= a.C / CFG.seriesA.apart; }) && a.C > best) best = a.C; });
    return best;
  }
  function proofB() { var best = 0; G.dots.forEach(function (d) { if (d.day >= CFG.seriesB.from && d.C >= Math.max(CFG.seriesB.minC, G.B.need) && d.C > best) best = d.C; }); return best; }
  function hasLine() { var ds = G.dots; return ds.some(function (a) { return ds.some(function (b) { return b.C <= a.C / 10; }); }); }
  function frontier() { var f = 0; G.rivals.forEach(function (r) { r.pubs.forEach(function (p) { if (p.C > f) f = p.C; }); }); if (G.day >= K.gpt3Day) f = Math.max(f, CFG.gpt3C); return f; }
  function worldView() { return Math.max(farthestPub(), CFG.openWorldMult * G.openedC, farthestClean() * CFG.vaultWorldShare); }

  /* ================================================================
     SAMPLES (slice one's words)
     ================================================================ */
  function bag(name, pool) {
    var b = G.bags[name];
    if (!b || !b.length) { var last = b && b.last; b = G.bags[name] = shuffle(pool.slice()); if (last != null && b.length > 1 && b[b.length - 1] === last) { b.unshift(b.pop()); } }
    var v = b.pop(); b.last = v; return v;
  }
  function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
  function bandCut(txt) {
    if (txt.length <= CFG.bandMaxChars) return txt;
    var parts = sentences(txt), out = '';
    for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > CFG.bandMaxChars) break; out += parts[i]; }
    return out.trim();
  }
  function tierOf(Lv) {
    if (Lv > CFG.tierStatic) return 0; if (Lv > CFG.tierWords) return 1; if (Lv > CFG.tierGrammar) return 2;
    var para = G.caps[0]; return (para.fired && Lv <= para.L) ? 4 : 3;
  }
  function pickT3(Lv) {
    var want = Lv > CFG.t3Sense[0] ? 1 : Lv > CFG.t3Sense[1] ? 2 : 3, order = want === 1 ? [1, 2, 3] : want === 2 ? [2, 3, 1] : [3, 2, 1];
    for (var pass = 0; pass < 2; pass++) {
      for (var o = 0; o < 3; o++) {
        var cand = [];
        CORPUS.t3.forEach(function (e, i) { if (e[0] === order[o] && !G.t3used[i]) cand.push(i); });
        if (cand.length) { var i = cand[Math.floor(rng() * cand.length)]; G.t3used[i] = 1; return CORPUS.t3[i][1]; }
      }
      G.t3used = {};
    }
    return CORPUS.t3[0][1];
  }
  function pickT4(momentGrade) {
    for (var pass = 0; pass < 2; pass++) {
      var cand = [];
      CORPUS.t4.forEach(function (e, i) { if (!G.t4used[i] && (!momentGrade || e[0] === 1)) cand.push(i); });
      if (!cand.length && momentGrade) CORPUS.t4.forEach(function (e, i) { if (!G.t4used[i]) cand.push(i); });
      if (cand.length) { var i = cand[Math.floor(rng() * cand.length)]; G.t4used[i] = 1; return CORPUS.t4[i][1]; }
      G.t4used = {};
    }
    return CORPUS.t4[0][1];
  }
  function pickLow(tier) {
    if (tier === 0) return bag('t0', CORPUS.t0);
    if (tier === 1) return bag('t1', CORPUS.t1);
    var cov = G.day >= CFG.covidLineFromDay;
    return bag(cov ? 't2c' : 't2', cov ? CORPUS.t2.concat([CORPUS.t2Covid]) : CORPUS.t2);
  }
  function capFull(id) { return id === 'paragraph' ? pickT4(true) : bag(id, CORPUS[id]); }
  function crawlLine() {
    var pool = shuffle(CORPUS.crawl.slice()), out = '';
    for (var i = 0; i < pool.length; i++) {
      var next = out ? out + ' | ' + pool[i] : pool[i];
      if (out && next.length > CFG.crawlLen[1]) continue;
      out = next; if (out.length >= CFG.crawlLen[0]) break;
    }
    return out;
  }
  var PUNCT_END = /[.,;:!?»)\]"”’…]$/, PUNCT_START = /^[(\["“‘«.,;:!?…]/;
  // exactly k distinct fragments into the middle 80% of the sentence, at word gaps, never by punctuation, never adjacent
  function splice(text, k) {
    if (!(k > 0) || k >= R.CRAWL) return text;
    var words = text.split(' '), n = words.length, i, j;
    var gaps = [];
    for (i = 0; i < n - 1; i++) { var pos = (i + 1) / n, a = words[i], b = words[i + 1]; if (pos < 0.1 || pos > 0.9 || /\n/.test(a) || /\n/.test(b) || PUNCT_END.test(a) || PUNCT_START.test(b)) continue; gaps.push(i); }
    if (!gaps.length) for (i = 0; i < n - 1; i++) gaps.push(i);
    var chosen = null;
    for (var tries = 0; tries < 60 && !chosen; tries++) {
      var c = shuffle(gaps.slice()).slice(0, Math.min(k, gaps.length)).sort(function (x, y) { return x - y; }), okk = true;
      for (j = 1; j < c.length; j++) if (c[j] - c[j - 1] < 2) okk = false;
      if (okk || tries > 50) chosen = c;
    }
    if (k === 1) { var mid = gaps.filter(function (g) { var q = (g + 1) / n; return q >= 0.3 && q <= 0.7; }); if (mid.length) chosen = [pick(mid)]; }
    var frags = shuffle(CORPUS.fray.slice()).slice(0, k), out = [], fi = 0;
    for (i = 0; i < n; i++) { out.push(words[i]); if (chosen.indexOf(i) >= 0 && fi < frags.length) out.push(frags[fi++]); }
    return out.join(' ');
  }
  function rq(run, q) { return q * run.D / G.Dwall; }
  function makeSample(run, q, kind, capId) {
    var Lv = R.lossAt(run.C, q, run.k), tier = tierOf(Lv), amt = R.amount(rq(run, q));
    var text, mtext = null, cap = null, full;
    if (capId) tier = Math.max(tier, 3);
    if (tier >= 3 && amt === R.CRAWL) { text = crawlLine(); }
    else if (tier >= 3) {
      if (capId) { full = capFull(capId); cap = capId; }
      else {
        var elig = G.caps.filter(function (c) { return c.fired && c.id !== 'paragraph' && Lv <= c.L; });
        if (elig.length && rng() < CFG.capSampleShare) { var c = pick(elig); full = bag(c.id, CORPUS[c.id]); cap = c.id; }
        else full = tier === 4 ? pickT4(false) : pickT3(Lv);
      }
      text = splice(bandCut(full), amt);
      if (capId) mtext = splice(full, amt);
    } else { text = pickLow(tier); amt = 0; }
    return { text: text, momentText: mtext, tier: tier, fray: amt, crawl: amt === R.CRAWL, cap: cap, q: q, kind: kind, loss: Lv, day: G.day, C: run.C, runN: run.n, landL: kind === 'land' ? run.L : null };
  }

  /* ---------------- the band: one sample at a time ---------------- */
  var band = null, bandFly = null;
  function buildWords(el, text) {
    el.textContent = '';
    var frag = document.createDocumentFragment(), lines = text.split('\n'), spans = [];
    lines.forEach(function (line, li) {
      if (li) frag.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (w, i) {
        if (i) frag.appendChild(document.createTextNode(' '));
        var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; frag.appendChild(sp); spans.push(sp);
      });
    });
    el.appendChild(frag);
    return spans;
  }
  function fitBand() {
    if (!L.bandFont) return;
    var fs = L.bandFont[0], lh = L.bandFont[1];
    elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = lh + 'px';
    var guard = 0;
    while (elSample.scrollHeight > L.band.h + 1 && fs > 12 && guard++ < 12) { fs -= 1; lh = Math.round(fs * 1.4); elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = lh + 'px'; }
  }
  function showBand(smp, mode) {
    G.sample = smp; bandFly = null;
    elSample.style.transform = ''; elSample.style.opacity = '1';
    var spans = buildWords(elSample, smp.text); fitBand();
    if (mode === 'instant' || speedMul > 6 || reduced()) { for (var i = 0; i < spans.length; i++) spans[i].className = 'w on'; band = null; }
    else band = { spans: spans, t0: now, shown: 0 };
    elLive.textContent = smp.text;
    onSampleShown(smp);
  }
  function stepBand() {
    if (bandFly) {
      var u = (now - bandFly.t0) / bandFly.dur, e = ease(u);
      elSample.style.transform = 'translate(' + (bandFly.dx * e).toFixed(1) + 'px,' + (bandFly.dy * e).toFixed(1) + 'px)';
      elSample.style.opacity = String(1 - e);
      if (u >= 1) { elSample.textContent = ''; elSample.style.transform = ''; elSample.style.opacity = '1'; bandFly = null; }
    }
    if (!band) return;
    var k = Math.min(band.spans.length, Math.floor((now - band.t0) / (CFG.wordMs / 1000)) + 1), ticked = false;
    while (band.shown < k) { band.spans[band.shown++].className = 'w on'; if (!ticked) { snd.tick(); ticked = true; } }
    if (band.shown >= band.spans.length) band = null;
  }
  function sinkBand() { if (!elSample.firstChild) return; band = null; bandFly = { t0: now, dur: 0.3, dx: 0, dy: 20 }; }

  /* ---------------- moments ---------------- */
  var moment = null;
  function startMoment(text, kind) {
    var spans = text ? buildWords(elMomentText, text) : [];
    if (!text) elMomentText.textContent = '';
    var fs = L.momentFont; elMomentText.style.fontSize = fs + 'px'; elMomentText.style.lineHeight = Math.round(fs * 1.43) + 'px';
    var guard = 0;
    while (text && elMomentText.offsetHeight > elMoment.clientHeight - 8 && fs > 14 && guard++ < 16) { fs--; elMomentText.style.fontSize = fs + 'px'; elMomentText.style.lineHeight = Math.round(fs * 1.43) + 'px'; }
    moment = { kind: kind, t0: now, spans: spans, shown: 0, ducked: false, prev: G.phase };
    moment.wordsEnd = 0.4 + spans.length * CFG.wordMs / 1000;
    moment.end = Math.max(CFG.momentSec, moment.wordsEnd + 0.08 + 1.0 + 0.6);
    elMoment.style.opacity = 1; if (text) elLive.textContent = text;
    if (kind !== 'cap') hi.style.display = 'block';
    G.phase = 'moment';
    return moment.end;
  }
  function momentDim() {
    var M = moment; if (!M) return 0;
    var t = now - M.t0;
    if (t < 0.4) return reduced() ? 1 : t / 0.4;
    if (t < M.end - 0.6) return 1;
    return clamp(1 - (t - (M.end - 0.6)) / 0.6, 0, 1);
  }
  function stepMoment() {
    var M = moment; if (!M) return;
    var t = now - M.t0, dim = momentDim();
    elDim.style.opacity = (dim * 0.92).toFixed(3); elMute.style.visibility = dim > 0.3 ? 'hidden' : '';
    var k = t < 0.4 ? 0 : Math.min(M.spans.length, Math.floor((t - 0.4) / (CFG.wordMs / 1000)) + 1), ticked = false;
    while (M.shown < k) { M.spans[M.shown++].className = 'w on'; if (!ticked) { snd.tick(); ticked = true; } }
    elMoment.style.opacity = t > M.end - 0.6 ? dim.toFixed(3) : 1;
    if (!M.ducked && t >= M.wordsEnd) { M.ducked = true; snd.duck(1.0, 0.6); }
    if (M.kind !== 'cap') drawHi(M);
    if (t >= M.end) {
      elDim.style.opacity = 0; elMoment.style.opacity = 0; elMomentText.textContent = ''; hi.style.display = 'none'; moment = null; elMute.style.visibility = '';
      if (G.phase === 'moment') G.phase = G.run ? 'pour' : (G.firstLift ? 'idle' : 'wait');
      if (M.after) M.after();
      motorForPhase();
      staticDirty = true;
    }
  }

  /* ---------------- notes: your people write on the paper ---------------- */
  function note(text, whoId, at, opts) {
    opts = opts || {};
    G.notes.forEach(function (o) { if (!o.dead && !o.keep && o.text === text) killNote(o); });
    var el = document.createElement('div'); el.className = 'fr-note' + (opts.typed ? ' typed' : '');
    var spans = [];
    for (var i = 0; i < text.length; i++) { var c = document.createElement('span'); c.className = 'c'; c.textContent = text[i]; el.appendChild(c); spans.push(c); }
    elNotes.appendChild(el);
    var n = { el: el, at: at, born: now, spans: spans, shown: 0, who: whoId, keep: !!opts.keep, life: opts.life || CFG.noteFadeSec, text: text };
    G.notes.push(n);
    var live = G.notes.filter(function (x) { return !x.dead; });
    if (live.length > 5) killNote(live.filter(function (x) { return !x.keep; })[0] || live[0]);
    placeNote(n);
    if (reduced() || speedMul > 6) { spans.forEach(function (s) { s.className = 'c on'; }); n.shown = spans.length; }
    return n;
  }
  function killNote(n) { if (!n || n.dead) return; n.dead = true; n.el.style.opacity = 0; setTimeout(function () { if (n.el.parentNode) n.el.parentNode.removeChild(n.el); }, 450); }
  function clearNotes() { G.notes.forEach(function (n) { if (!n.keep) killNote(n); }); }
  function noteXY(at) {
    if (!at) return { x: L.plot.x + L.plot.w * 0.4, y: L.plot.y + 30 };
    if (at.name) { var r = nameRect(at.name); if (r) return { x: r.right + 6, y: r.top + 6, fixed: true }; }
    if (at.mark && at.mark.rect) { var mr = at.mark.rect; return { x: mr.x + mr.w + 4, y: mr.y + 1, fixed: true }; }
    if (at.C) return { x: X(log10(at.C)) + (at.dx || 0), y: (at.lnL != null ? Y(at.lnL) : lineY(at.C)) + (at.dy || 0) };
    if (at.x != null) return { x: at.x, y: at.y, fixed: at.fixed, free: at.free };
    return { x: L.plot.x + 20, y: L.plot.y + 20 };
  }
  function placeNote(n) {
    var p = noteXY(n.at), el = n.el, w = el.offsetWidth || 120, h = el.offsetHeight || 16, x, y;
    if (p.fixed) { x = p.x; y = p.y; }
    else { x = p.x + 10; if (x + w > L.x1) x = p.x - w - 10; y = p.y - h - 10; if (y < L.plot.y) y = p.y + 12; }
    x = clamp(x, 4, L.vw - w - 4); y = p.fixed && p.free ? clamp(y, 4, L.vh - h - 4) : clamp(y, L.paper.y + 22, L.ruler.y - h - 2);
    if (!p.fixed) for (var tries = 0; tries < 8; tries++) {
      var hit = null;
      G.notes.forEach(function (o) { if (o === n || o.dead || !o.rect) return; var r = o.rect; if (x < r.x + r.w && x + w > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) hit = r; });
      if (!hit) break;
      var dn = hit.y + hit.h + 3, up = hit.y - h - 3;
      y = dn + h <= L.ruler.y - 2 ? dn : (up >= L.paper.y + 22 ? up : dn);
    }
    n.rect = { x: x, y: y, w: w, h: h };
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function placeNotes() { if (!G) return; G.notes.forEach(function (n) { n.rect = null; }); G.notes.forEach(function (n) { if (!n.dead) placeNote(n); }); }
  function stepNotes() {
    G.notes.forEach(function (n) {
      if (n.dead) return;
      var k = Math.min(n.spans.length, Math.floor((now - n.born) / (CFG.noteCharMs / 1000)) + 1);
      while (n.shown < k) n.spans[n.shown++].className = 'c on';
      if (!n.keep && now - n.born > n.life && !n.el.classList.contains('faded')) n.el.classList.add('faded');
    });
    if (G.notes.length > 40) G.notes = G.notes.filter(function (n) { return !n.dead; });
  }
  function noteBy(id, key, at, opts) { if (!id || !person(id)) return null; return note(K.notes[key] || key, id, at, opts); }
  function anyHand(prefer) { for (var i = 0; i < prefer.length; i++) if (person(prefer[i])) return prefer[i]; var s = staff(); return s.length ? s[0].id : null; }

  /* ---------------- pencil boxes: live status written on the sheet ---------------- */
  var boxEls = {};
  function box(key, text, x, y, cls) {
    var el = boxEls[key];
    if (!el) { el = boxEls[key] = document.createElement('div'); elBoxes.appendChild(el); }
    var cn = 'fr-box' + (cls ? ' ' + cls : ''); if (el.className !== cn) { el.className = cn; el._w = 0; }
    if (el.textContent !== text) { el.textContent = text; el._w = 0; }
    var w = el._w || (el._w = el.offsetWidth || 80);
    el.style.transform = 'translate(' + Math.round(clamp(x, 2, L.vw - w - 2)) + 'px,' + Math.round(y) + 'px)';
    el._seen = true;
    return w;
  }
  function stepBoxes() {
    Object.keys(boxEls).forEach(function (k) { boxEls[k]._seen = false; });
    if (G.powered && !G.over) {
      var r = G.filter && nameRect(G.filter.who);
      if (G.filter && r) { box('filter', 'filter: ' + Math.max(1, Math.ceil(G.filter.end - G.day)) + ' days', r.right + 4, r.top + 6); }
      var r2 = G.held && nameRect('lena');
      if (G.held && r2) { box('red', 'red-team: ' + Math.max(1, Math.ceil(G.held.end - G.day)) + ' days', r2.right + 4, r2.top + 6); }
      G.dots.forEach(function (d, i) { if (d.pending) box('mer' + i, 'with Meridian', X(log10(d.C)) + 8, Y(Math.log(d.L)) + 8); });
      if (G.evals && G.run && G.evals.run === G.run) { var lp = G.run.pts[G.run.pts.length - 1]; if (lp) box('evals', K.notes.evals, X(lp.x) + 10, clamp(Y(lp.y) - 30, L.plot.y, L.ruler.y - 20), 'bare'); }
      // the cluster's pencil boxes sit in free room inside the band (an empty row, or the end of the last one)
      var fr = clusterFree, tight = fr && fr.h < 18 ? 'tight' : '', bh = tight ? 13 : 18, bx = fr ? fr.x : L.cluster.x + 2, by = fr ? fr.y + (fr.h - bh) / 2 : L.cluster.y - 19;
      if (G.queueCut > 0 && G.mer && G.day >= G.mer.live) { bx += box('queue', 'queue', bx, by, tight) + 8; }
      if (G.orders.length) { var o = G.orders[0]; box('order', 'inked by ' + R.fmtDay(o.arrive), bx, by, tight); }
    }
    Object.keys(boxEls).forEach(function (k) { if (!boxEls[k]._seen) { boxEls[k].remove(); delete boxEls[k]; } });
  }

  /* ---------------- the margin ---------------- */
  function nameEl(id) { return elNames.querySelector('[data-id="' + id + '"]'); }
  function renderNames() {
    nameRects = null;
    var room = L.paper.bottom - 10 - L.names.y, n = Math.max(1, G.people.length), nl = clamp(Math.floor(room / n), 18, L.nameLine);
    elNames.style.setProperty('--nl', nl + 'px'); elNames.style.setProperty('--nf', Math.min(L.nameFont, Math.round(nl * 0.66)) + 'px');
    G.people.forEach(function (p) {
      var b = nameEl(p.id);
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.className = 'fr-name'; b.setAttribute('data-id', p.id); b.tabIndex = 0;
        for (var i = 0; i < p.name.length; i++) { var s = document.createElement('span'); s.className = 'ltr'; s.textContent = p.name[i]; b.appendChild(s); }
        b.addEventListener('pointerdown', onNameDown);
        b.addEventListener('pointerup', onNameUp);
        b.addEventListener('click', function (e) { if (e.detail === 0) pressName(this.getAttribute('data-id')); });
        elNames.appendChild(b);
        p.writeT0 = now;
      }
      b.style.fontWeight = String(nameWeight(p));
      b.style.color = p.mood < CFG.moodGraphite && !p.gone ? 'var(--graphite)' : '';
      if (p.gone && !b.classList.contains('gone')) { b.classList.add('gone'); b.tabIndex = -1; }
      b.setAttribute('aria-label', p.full + (p.gone ? ', gone' : ''));
    });
  }
  function stepNames() {
    G.people.forEach(function (p) {
      var b = nameEl(p.id); if (!b) return;
      var ls = b.children, k = reduced() || speedMul > 6 ? ls.length : Math.floor((now - p.writeT0) / (CFG.nameLetterMs / 1000)) + 1;
      for (var i = 0; i < ls.length && i < k; i++) if (ls[i].className !== 'ltr on') ls[i].className = 'ltr on';
    });
  }
  var nameDown = null;
  function onNameDown(e) { e.stopPropagation(); snd.start(); if (!G.powered) { powerOn(); nameDown = null; return; } nameDown = { id: this.getAttribute('data-id'), t: performance.now() }; }
  function onNameUp(e) { e.stopPropagation(); if (nameDown && nameDown.id === this.getAttribute('data-id') && performance.now() - nameDown.t <= CFG.pressMaxMs + 150) pressName(nameDown.id); nameDown = null; }

  /* ---------------- pressing a name ---------------- */
  function pressName(id) {
    if (!G.powered) { powerOn(); return; }
    if (G.over) return;
    var p = person(id); if (!p) return;
    G.log.push({ day: Math.floor(G.day), press: id });
    // a hang in progress: wake them (their name thins; no words, the restart is the answer)
    if (G.run && G.run.hang && G.day < G.run.hang.restart) {
      var r = G.day + CFG.wakeRestartHours / 24;
      if (r < G.run.hang.restart) G.run.hang.restart = r;
      G.run.hang.woken = id;
      mood(id, id === 'tom' ? CFG.wakeMoodTom : CFG.wakeMood);
      snd.tick();
      return;
    }
    // standing offers: the filter job (Priya, or Ines alone), Lena's red-team
    if (p.role === 'data' && !G.filter) {
      if (offerStands()) { startFilter(id); return; }
      if (id === 'priya' && G.sample && !G.sample.crawl && G.sample.fray === 3) { G.priyaOffer = { amt: 3, month: G.month }; note(K.notes.fray3, 'priya', { name: 'priya' }); return; }
      if (id === 'priya' && G.sample && !G.sample.crawl && (G.sample.fray === 1 || G.sample.fray === 2)) { note(K.notes.fray12, 'priya', { name: 'priya' }); return; }
    }
    if (id === 'lena' && G.cp && !G.held) { startRedTeam(); return; }
    // otherwise, status beside their work
    var txt = K.status[id];
    if (p.role === 'data' && G.filter) txt = 'filter: ' + Math.ceil(G.filter.end - G.day) + ' days';
    if (id === 'lena' && G.held) txt = 'red-team: ' + Math.ceil(G.held.end - G.day) + ' days';
    note(txt, id, { name: id }, { life: 5 });
    snd.tick();
  }

  /* ---------------- the top: date, months ---------------- */
  var lastToday = '', lastMN = '';
  function updateTop() {
    if (!G.powered) return;
    var d = R.fmtDay(Math.min(G.day, CFG.endDay - 1e-6), true);
    if (d !== lastToday) { elToday.textContent = d; lastToday = d; }
    var h = '';
    if (G.run && G.run.hang && G.day < G.run.hang.restart) { var hh = G.run.hang.h + (G.day - G.run.hang.start) * 24; hh = ((hh % 24) + 24) % 24; h = ' · ' + String(Math.floor(hh)).padStart(2, '0') + ':' + String(Math.floor((hh % 1) * 60)).padStart(2, '0'); }
    if (elHour.textContent !== h) elHour.textContent = h;
    var mtxt = G.over && G.over.reason === 'bankrupt' ? '0' : fmtMonths(monthsLeft());
    if (mtxt !== lastMN) { elMN.textContent = mtxt; lastMN = mtxt; }
  }
  function jolt() { elMN.classList.remove('jolt'); void elMN.offsetWidth; elMN.classList.add('jolt'); }

  /* ---------------- history ---------------- */
  // headlines drift right to left across the top of the paper, each over 7 s. They follow one another like a ticker:
  // the next enters once the last has cleared the right edge and can no longer be caught. Reduced motion: they fade.
  function stepHeads() {
    var hs = G.heads || (G.heads = []), red = reduced();
    while (G.headQ.length) {
      var last = hs[hs.length - 1], ok = !last;
      if (last && !red) {
        var xl = headX(last), tail = xl + last.w;
        if (tail <= L.headW - 28) {
          var vf = (L.headW + 20 + measureHead(G.headQ[0].text)) / CFG.headlineSec, te = (tail + 10) / last.v;
          ok = L.headW + 10 - vf * te >= 28;
        }
      }
      if (!ok) break;
      var hq = G.headQ.shift(); if (G.day - hq.day > 12) continue;   // stale news is already pencilled on the ruler
      var el = document.createElement('div'); el.className = 'fr-hl'; el.textContent = hq.text; elHeads.appendChild(el);
      var w = el.offsetWidth || 400;
      hs.push({ el: el, t0: now, w: w, v: (L.headW + 20 + w) / CFG.headlineSec });
      if (red) break;
    }
    for (var i = hs.length - 1; i >= 0; i--) {
      var H = hs[i], done;
      if (red) {
        var tt = now - H.t0, op = tt < 0.3 ? tt / 0.3 : tt > 5.7 ? Math.max(0, (6 - tt) / 0.3) : 1;
        H.el.style.transform = 'translate(' + Math.round(L.plot.x) + 'px,' + Math.round(L.headY) + 'px)'; H.el.style.opacity = op.toFixed(2);
        done = tt >= 6;
      } else {
        var x = headX(H);
        H.el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(L.headY) + 'px)';
        done = x + H.w < -10;
      }
      if (done) { H.el.remove(); hs.splice(i, 1); }
    }
  }
  function headX(H) { return L.headW + 10 - H.v * (now - H.t0); }
  var headMeasure = null;
  function measureHead(txt) {
    if (!headMeasure) { headMeasure = document.createElement('canvas').getContext('2d'); }
    headMeasure.font = 'italic 400 11px ' + MONO; return headMeasure.measureText(txt).width + 2;
  }


  /* ================================================================
     LETTERS: three slots a month, one on screen, a fuse along the edge
     ================================================================ */
  function eff(parts) { return parts.filter(Boolean).join(' · '); }
  function mArrow(bank2, burn2) { return 'MONTHS ' + fmtMonths(monthsLeft()) + ' → ' + fmtMonths(monthsLeft(bank2, burn2)); }
  function cArrow(add) { return 'CARDS ' + fmtInt(cardsShown()) + ' → ' + fmtInt(cardsShown() + add); }
  function sArrow(newStake) { return 'STAKE ' + pct(G.stake) + ' → ' + pct(newStake); }
  function board() { return G.stake < CFG.boardUnder; }
  function brokerSize() { var n = 64; CFG.brokerSize.forEach(function (x) { if (G.day >= x[0]) n = x[1]; }); return n; }
  function orderLead(base) { var d = base; if (G.day >= CFG.covidOrderFrom && G.day <= CFG.covidOrderTo) d += CFG.covidOrderAddDays; if (G.day >= CFG.lateBuyFrom) d += CFG.lateBuyAddDays; return d; }
  function orderPrice(p) { return G.day >= CFG.lateBuyFrom ? p * CFG.lateBuyPriceMult : p; }
  var WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function weeksWord(days) { var w = Math.round(days / 7); return (WORDS[w] || String(w)) + ' week' + (w === 1 ? '' : 's'); }
  // the day a letter's fuse runs out: fixed for the letter's life, because the fuse burns exactly as the date moves
  function fuseEnd(l) { return Math.floor(G.day + (l && l.fuseLeft != null ? l.fuseLeft : (l && l.fuse) || 7) + 1e-6); }
  function goneBy(l) { return 'gone by the ' + ordinal(dom(fuseEnd(l))); }
  function bumpRival(id, dec) { G.rivals.forEach(function (r) { if (r.id === id) r.logc += dec; }); }
  function laterBump(id, dec, days) { G.pendings.push({ day: G.day + days, fn: function () { bumpRival(id, dec); } }); }
  function he(p) { return p && p.he ? 'he' : 'she'; }

  /* Every letter renders from view(), so its figures are live (spec: 'Effect figures are computed live from the current
     bank and burn'). take() and pass() also read the world at the moment of the flick. */
  var MAKE = {
    broker: function () {
      var n = brokerSize(), p = rentPriceNow();
      return { id: 'brokerRent', kind: 'broker', from: 'BROKER', gpus: n,
        view: function (l) {
          var grey = !!G.mer, add = n * p * 24 * CFG.daysPerMonth;
          return { offer: n + ' V100s on demand, live tomorrow. $' + p.toFixed(2) + ' an hour for 90 days.',
            up: grey ? null : eff([mArrow(G.bank, burn() + add), cArrow(n)]), down: goneBy(l), grey: grey, forbid: grey ? 'Meridian: exclusive' : null };
        },
        take: function () { if (G.mer) return; G.rentals.push({ n: n, price: p, start: Math.floor(G.day) + 1, end: Math.floor(G.day) + 1 + CFG.rentTermDays }); },
        pass: function () { } };
    },
    // from 11 June the rent knock comes back once more, refused (spec: 'Broker rent letters stop (capacity unavailable)')
    capacity: function () {
      return { id: 'capacityRent', kind: 'broker', from: 'BROKER',
        view: function () { return { offer: 'Capacity unavailable. Every V100 we had is spoken for until next year.', up: null, down: 'no more rentals', grey: true, forbid: 'The broker: no.' }; },
        take: function () { }, pass: function () { } };
    },
    buy: function () {
      var a100 = G.day >= CFG.buyA100.from && G.buyA100Next, spec = a100 ? CFG.buyA100 : CFG.buyV100;
      var price = orderPrice(spec.price), lead = orderLead(spec.lead);
      return { id: a100 ? 'buyA100' : 'buyV100', kind: 'broker', from: 'BROKER', gpus: spec.n, cost: price,
        view: function (l) {
          var arrive = Math.floor(G.day) + lead;
          return { offer: (a100 ? 'Eight DGX A100s: 64 A100s. ' : '64 V100s to own: eight servers with InfiniBand. ') + money(price) + '. Delivery in ' + Math.round(lead / 7) + ' weeks.',
            up: eff([mArrow(G.bank - price, burn() + spec.n * CFG.upkeepPerCard), 'CARDS +' + spec.n + ' in pencil, inked by ' + R.fmtDay(arrive)]), down: goneBy(l) };
        },
        take: function () { G.bank -= price; G.orders.push({ n: spec.n, kind: a100 ? 'a100' : 'v100', at: G.day, arrive: Math.floor(G.day) + lead }); },
        pass: function () { } };
    },
    hire: function (id, salary) {
      var p = proto(id), sal = salary || p.salary, rival = id === 'sunhee' ? 'Halcyon' : 'Kestrel';
      return { id: 'hire_' + id, kind: 'hire', hireId: id, from: p.full, hand: true, offerHand: true,
        view: function () { return { offer: p.knock + ' ' + money(sal) + ' a month.', up: eff([mArrow(G.bank, burn() + sal)]), down: he(p) + ' goes to ' + rival }; },
        take: function () { addPerson(id, sal); },
        pass: function () { G.seen['passed_' + id] = G.day; if (id === 'sunhee') bumpRival('halcyon', CFG.passToKestrel); else bumpRival('kestrel', CFG.passToKestrel); } };
    },
    termA: function () {
      var proof = proofA();
      function terms() { return G.day < CFG.marketClosedFrom ? CFG.seriesA.early : CFG.seriesA.late; }
      return { id: 'termA', kind: 'term', from: K.investorA,
        view: function (l) {
          var t = terms(), early = t === CFG.seriesA.early, ns = G.stake * (1 - t.amount / t.post);
          return { offer: 'Series A: ' + money(t.amount) + ' at a ' + money(t.post) + ' post. ' + (early ? 'Two dots, one line.' : 'The same people, calling back.') + ' Sign by the ' + ordinal(dom(fuseEnd(l))) + '.',
            up: eff([mArrow(G.bank + t.amount, burn()), sArrow(ns)]), down: 'gone; next time they want a dot three times further out' };
        },
        take: function () { var t = terms(); G.bank += t.amount; G.stake = G.stake * (1 - t.amount / t.post); G.A.taken = true; },
        pass: function () { G.A.need = proof * CFG.seriesA.passMult; } };
    },
    termB: function () {
      var proof = proofB();
      function post() { return G.api ? CFG.seriesB.postApi : CFG.seriesB.post; }
      return { id: 'termB', kind: 'term', from: K.investorA,
        view: function (l) {
          var amt = CFG.seriesB.amount, ns = G.stake * (1 - amt / post());
          return { offer: 'Series B: ' + money(amt) + ' at a ' + money(post()) + ' post. ' + (G.api ? 'They have seen your waitlist.' : 'They have seen your line.') + ' Sign by the ' + ordinal(dom(fuseEnd(l))) + '.',
            up: eff([mArrow(G.bank + amt, burn()), sArrow(ns)]), down: 'gone; next time they want a dot three times further out' };
        },
        take: function () { var amt = CFG.seriesB.amount; G.bank += amt; G.stake = G.stake * (1 - amt / post()); G.B.taken = true; },
        pass: function () { G.B.need = proof * CFG.seriesA.passMult; } };
    },
    meridian: function () {
      var M = CFG.meridian;
      return { id: 'meridian', kind: 'meridian', from: K.cloud,
        view: function () {
          return { offer: '$50M in compute credits: ' + fmtInt(M.cards) + ' V100s reserved for you, ready in ' + weeksWord(M.lead) + '. Our cloud only. We see every checkpoint first.',
            up: eff(['CARDS +' + fmtInt(M.cards) + ' in pencil', 'no other cloud', 'no open weights']), down: 'we’ll talk again in June' };
        },
        take: function () { G.mer = { cards: M.cards, live: Math.floor(G.day) + M.lead, credits: M.credits, half: false, signed: G.day }; },
        pass: function () { G.merPassed = true; } };
    },
    meridian2: function () {
      var M = CFG.meridian.second;
      return { id: 'meridian2', kind: 'meridian', from: K.cloud,
        view: function () { return { offer: fmtInt(M.cards) + ' V100s, ready in ' + weeksWord(CFG.meridian.lead) + ', for 10% of FRONTIER.', up: eff(['CARDS +' + fmtInt(M.cards) + ' in pencil', sArrow(G.stake * M.stakeMult)]), down: 'gone' }; },
        take: function () { G.stake = G.stake * M.stakeMult; G.mer = { cards: M.cards, live: Math.floor(G.day) + CFG.meridian.lead, credits: CFG.meridian.credits / 2, half: true, signed: G.day }; },
        pass: function () { } };
    },
    renewal: function (r) {
      var late = G.day >= K.apiDay, refused = late && rng() < CFG.renewRefuseShare, price = late ? CFG.renewPriceLate : rentPriceNow();
      if (refused) return { id: 'capacity', kind: 'renewal', from: 'BROKER',
        view: function () { return { offer: 'Capacity unavailable. Your ' + r.n + ' V100s go back on ' + R.fmtDay(r.end) + '.', up: null, down: 'they go back on ' + R.fmtDay(r.end), grey: true, forbid: 'The broker: no.' }; },
        take: function () { }, pass: function () { } };
      return { id: 'renewal', kind: 'renewal', from: 'BROKER',
        view: function () {
          var dB = r.n * (price - r.price) * 24 * CFG.daysPerMonth;
          return { offer: 'Your ' + r.n + ' V100s go back on ' + R.fmtDay(r.end) + '. Renew for 90 days at $' + price.toFixed(2) + '?',
            up: eff(['keep them', Math.abs(dB) > 1 ? mArrow(G.bank, burn() + dB) : null]), down: 'they go back on ' + R.fmtDay(r.end) };
        },
        take: function () { if (G.mer) return; r.end += CFG.rentTermDays; r.price = price; }, pass: function () { } };
    },
    acqui: function () {
      return { id: 'acqui', kind: 'acqui', from: 'HALCYON',
        view: function () {
          var n = staff().length, forced = board();
          return { offer: 'We’ll buy the team: ' + money(CFG.acquiPerHead) + ' a head, ' + money(n * CFG.acquiPerHead) + ' in all. Your people get rich. FRONTIER disappears.',
            up: 'it’s over, and everyone is rich', down: forced ? null : 'keep going', forced: forced, forbid: forced ? 'The board has accepted.' : null };
        },
        take: function () { endYear('bought'); }, pass: function () { } };
    },
    poach: function () {
      var mon = R.monthOf(G.day) + 1, rv = mon % 2 === 0 ? 'Halcyon' : 'Kestrel', t = null;
      function tgt() { if (!t || t.gone) t = staff().slice().sort(function (a, b) { return a.mood - b.mood; })[0] || null; return t; }
      return { id: 'poach', kind: 'poach', from: rv.toUpperCase(),
        view: function () {
          var p = tgt(); if (!p) return null;
          return { offer: rv + ' offers ' + p.name + ' double. Counter with equity?', up: eff([sArrow(G.stake - CFG.counterStake), he(p) + ' stays']), down: he(p) + ' walks to ' + rv };
        },
        take: function () { var p = tgt(); if (!p) return; G.stake -= CFG.counterStake; mood(p.id, CFG.moodCounter); },
        pass: function () { var p = tgt(); if (!p) return; walk(p.id, 'poached'); bumpRival(rv.toLowerCase(), CFG.passToKestrel); } };
    },
    rentout: function () {
      function n() { return Math.floor(G.owned * CFG.rentOut.share); }
      function pay() { return n() * CFG.rentOut.price * 24 * CFG.rentOut.days; }
      return { id: 'rentout', kind: 'rentout', from: 'BROKER',
        view: function () { return { offer: 'We’ll pay $' + CFG.rentOut.price.toFixed(2) + ' an hour for half your owned cards. 30 days. Cash now.', up: eff([mArrow(G.bank + pay(), burn()), 'CARDS lent for 30 days']), down: 'no cash' }; },
        take: function () { G.bank += pay(); G.lent = { n: n(), until: G.day + CFG.rentOut.days }; }, pass: function () { } };
    },
    open: function () {
      return { id: 'open', kind: 'open', from: 'THE FIELD',
        view: function () {
          var grey = !!G.mer || board();
          return { offer: 'Grad students want the weights of your published model.', up: grey ? null : eff(['recruits come running', 'rivals fine-tune it within a week']),
            down: 'they build on Northwind’s instead', grey: grey, forbid: G.mer ? 'Meridian: no.' : board() ? 'The board: no.' : null };
        },
        take: function () { if (G.mer || board()) return; G.openedC = farthestPub(); G.openedDay = G.day; laterBump('kestrel', CFG.openKestrel, CFG.openFineTuneDays); laterBump('northwind', CFG.openNorthwind, CFG.openFineTuneDays); },
        pass: function () { bumpRival('northwind', CFG.passNorthwind); } };
    },
    december: function () {
      function cast() {
        var pr = person('priya'), others = staff().filter(function (p) { return p.id !== 'priya'; }).sort(function (a, b) { return a.mood - b.mood; }), sender, names;
        if (pr) { sender = pr; names = others.slice(0, 2); }
        else { sender = staff().slice().sort(function (a, b) { return b.ego - a.ego || a.mood - b.mood; })[0]; names = others.filter(function (p) { return p !== sender; }).slice(0, 2); }
        return { sender: sender || null, names: names.map(function (p) { return p.name; }) };
      }
      if (!cast().sender) return null;
      var at = function () { return { x: L.plot.x + 8, y: L.plot.y + 4, fixed: true }; }, who0 = null;
      return { id: 'december', kind: 'december', from: cast().sender.full, hand: true, offerHand: true,
        view: function () {
          var c = cast(); if (!c.sender) return null; who0 = c.sender.id;
          var nm = c.names, who = nm.length === 2 ? nm[0] + ', ' + nm[1] + ' and I' : nm.length === 1 ? nm[0] + ' and I' : 'I';
          return { from: c.sender.full, offer: who + ' want to start something safer. We’re telling you first.', up: 'let them go, with your blessing', down: 'fight to keep them' };
        },
        take: function () { G.december = 'go'; note('let them go, with your blessing', who0, at(), { keep: true }); },
        pass: function () { G.december = 'stay'; note('fought to keep them', who0, at(), { keep: true }); } };
    }
  };
  function demandLetter(id, from, offer, view, take, pass) {
    return { id: 'demand_' + id, kind: 'demand', from: from, hand: true, offerHand: true, view: function () { var v = view(); v.offer = offer; return v; }, take: take, pass: pass };
  }
  var DEMAND = {
    priya: { when: function () { return G.day >= 70; }, make: function () {
      return demandLetter('priya', 'Priya Raman', 'I want first author on our next paper, or I walk.', function () { return { up: 'your next clean landing is published: Raman et al.', down: 'she walks' }; },
        function () { G.firstAuthor = 'priya'; }, function () { walk('priya', 'demand'); });
    } },
    dev: { when: function (p) { return G.day >= p.joined + 90; }, make: function () {
      return demandLetter('dev', 'Dev Okafor', 'One percent, or Halcyon gets my parallelism code.', function () { return { up: eff([sArrow(G.stake - CFG.devDemandStake)]), down: 'he walks' }; },
        function () { G.stake -= CFG.devDemandStake; }, function () { walk('dev', 'demand'); });
    } },
    ayaan: { when: function (p) { return G.day >= p.joined + 60; }, make: function () {
      return demandLetter('ayaan', 'Ayaan Mehta', 'Whole cluster on one run, all the way to the stop.', function () { return { up: 'your next touch snaps the nib to the stop', down: 'his name thins' }; },
        function () { G.snapNext = true; }, function () { mood('ayaan', -40); });
    } },
    tom: { when: function () { return G.hangsLastMonth >= 3; }, make: function () {
      return demandLetter('tom', 'Tomasz Wójcik', 'I need a week off. I’ve been up every night.', function () { return { up: 'seven days without him', down: 'his name thins' }; },
        function () { G.tomOffUntil = G.day + 7; }, function () { mood('tom', -30); });
    } },
    sunhee: { when: function (p) { return G.day >= p.joined + 45; }, make: function () {
      return demandLetter('sunhee', 'Sun-hee Park', 'I want to publish the schedule trick.', function () { return { up: 'she stays; in 30 days every rival lands lower too', down: 'she walks to Halcyon' }; },
        function () { G.rivalTrickDay = G.day + 30; G.rivalTrickAll = true; }, function () { walk('sunhee', 'demand'); G.rivalTrickDay = G.day + 30; G.rivalTrickAll = false; });
    } }
  };
  function queued(id) { return (G.letter && G.letter.id === id) || G.wait.some(function (w) { return w.id === id; }); }
  function slotLetter(d, isFirst) {
    if (d === CFG.decemberDay && !G.seen.december) { G.seen.december = 1; var dl = MAKE.december(); if (dl) return dl; }
    // acqui-hire: the 1st only, from 1 Feb, months < 3 after payroll
    if (isFirst && d >= 31 && monthsLeft() < CFG.acquiUnderMonths && !queued('acqui')) return MAKE.acqui();
    // term sheets
    var closed = d >= CFG.marketClosedFrom && d < CFG.marketClosedTo;
    if (!G.A.taken && !closed && d >= G.termBlockUntil && proofA() && !queued('termA')) return MAKE.termA();
    if (G.A.taken && !G.B.taken && d >= CFG.seriesB.from && d >= G.termBlockUntil && proofB() && !queued('termB')) return MAKE.termB();
    // Meridian
    if (!G.mer && !G.merPassed && !G.seen.meridian && d >= CFG.meridian.from && farthestClean() >= CFG.meridian.minC) { G.seen.meridian = 1; return MAKE.meridian(); }
    if (!G.mer && G.merPassed && !G.merSecondDone && d >= CFG.meridian.second.from) { G.merSecondDone = true; return MAKE.meridian2(); }
    // renewals and capacity notices
    var i;
    if (!G.mer) for (i = 0; i < G.rentals.length; i++) { var r = G.rentals[i]; if (!r.asked && r.end - d <= CFG.renewWindowDays && r.end > d) { r.asked = true; return MAKE.renewal(r); } }
    // hires on their slots
    var hires = [['dev', 10], ['ayaan', 20], ['tom', 41], ['lena', 70]];
    for (i = 0; i < hires.length; i++) { var id = hires[i][0]; if (d >= hires[i][1] && !G.seen['knock_' + id]) { G.seen['knock_' + id] = 1; return MAKE.hire(id); } }
    if (d >= 70 && !hasSystems() && !G.seen.knock_rafael) { G.seen.knock_rafael = 1; return MAKE.hire('rafael'); }
    if (d >= 101 && !G.seen.knock_sunhee && G.dots.some(function (x) { return x.pub && x.C >= 1e21; })) { G.seen.knock_sunhee = 1; return MAKE.hire('sunhee'); }
    var openRecent = G.openedDay >= 0 && d <= G.openedDay + 14;
    if (!G.seen.knock_ines && (d >= 162 || openRecent)) { G.seen.knock_ines = 1; return MAKE.hire('ines', openRecent ? Math.round(proto('ines').salary * 0.7) : null); }
    if (!G.seen.knock_kofi && (d >= 213 || openRecent)) { G.seen.knock_kofi = 1; return MAKE.hire('kofi', openRecent ? Math.round(proto('kofi').salary * 0.7) : null); }
    if (d >= 162 && G.seen.passed_ayaan != null && !G.seen.knock_ayaan2 && !person('ayaan')) { G.seen.knock_ayaan2 = 1; return MAKE.hire('ayaan', proto('ayaan').salaryLate); }
    // demands
    var ids = Object.keys(DEMAND);
    for (i = 0; i < ids.length; i++) { var p = person(ids[i]); if (p && !G.seen['demand_' + ids[i]] && DEMAND[ids[i]].when(p)) { G.seen['demand_' + ids[i]] = 1; return DEMAND[ids[i]].make(); } }
    // a poach, sometimes, when nothing above it
    if (d >= CFG.poachFrom && staff().length >= CFG.poachMinPeople && G.seen.poachMonth !== G.month && rng() < CFG.poachChance) { G.seen.poachMonth = G.month; return MAKE.poach(); }
    // the broker, rent before buy, alternating, at least 14 days apart
    if (d - G.lastBroker >= CFG.brokerGapDays) {
      var canRent = d <= CFG.brokerRentUntil, canBuy = d >= 31, which = null;
      if (!canRent && d >= CFG.shipFrom && !G.seen.capacityNote && !G.mer && G.brokerNext === 'rent') { G.seen.capacityNote = 1; G.lastBroker = d; G.brokerNext = 'buy'; return MAKE.capacity(); }
      if (canRent && (!canBuy || G.brokerNext === 'rent')) which = 'rent'; else if (canBuy) which = 'buy';
      if (which) {
        G.lastBroker = d; G.brokerNext = which === 'rent' ? 'buy' : 'rent';
        if (which === 'buy') { var l = MAKE.buy(); if (d >= CFG.buyA100.from) G.buyA100Next = !G.buyA100Next; return l; }
        return MAKE.broker();
      }
    }
    if (monthsLeft() < CFG.rentOut.underMonths && G.owned >= CFG.rentOut.minOwned && !lentN() && G.seen.rentoutMonth !== G.month) { G.seen.rentoutMonth = G.month; return MAKE.rentout(); }
    if (!G.seen.open && d >= 182 && G.dots.some(function (x) { return x.pub && x.C >= 1e21; })) { G.seen.open = 1; return MAKE.open(); }
    return null;
  }
  function slot(d, isFirst) {
    if (G.silent || G.over) return;
    var l = slotLetter(d, isFirst);
    if (!l) return;
    l.fuse = CFG.fuse[l.kind] || 7;
    if (G.letter || letterAnim) G.wait.push(l); else showLetter(l);
  }

  /* ---------------- the letter on screen ---------------- */
  var letterAnim = null, flick = null;
  // (re)draw the slip from its live view; returns false if the letter no longer makes sense (its person is gone)
  function renderLetter(l) {
    var v = l.view(l); if (!v) return false;
    var key = [v.from || l.from, v.offer, v.up, v.down, v.grey, v.forbid, v.forced].join('|');
    l.up = v.up || null; l.down = v.down || null; l.grey = !!v.grey; l.forced = !!v.forced; l.forbid = v.forbid || null; l.offer = v.offer; if (v.from) l.from = v.from;
    if (l._key === key && G.letter === l) return true;
    l._key = key;
    lFrom.textContent = l.from; lFrom.className = 'from' + (l.hand ? ' hand' : '');
    lOffer.textContent = l.offer; lOffer.className = 'offer' + (l.offerHand ? ' hand' : '');
    lUp.textContent = l.up ? '↑ ' + l.up : ''; lUp.style.display = l.up ? '' : 'none';
    lDown.textContent = '';
    if (l.forbid) { var f = document.createElement('span'); f.className = 'forbid'; f.textContent = l.forbid; lDown.appendChild(f); }
    if (l.down) { var dn = document.createElement('span'); dn.textContent = '↓ ' + l.down; lDown.appendChild(dn); }
    elLetter.classList.toggle('grey', l.grey);
    letterH = 0;
    return true;
  }
  function showLetter(l) {
    l.fuseLeft = l.fuse;
    G.letter = l;
    if (!renderLetter(l)) { G.letter = null; if (G.wait.length) showLetter(G.wait.shift()); return; }
    l.shownDay = Math.floor(G.day);
    elLetter.hidden = false;
    letterAnim = { kind: 'in', t0: now };
    placeLetter();
    snd.letter();
    elLive.textContent = l.from + '. ' + l.offer + (l.up ? ' Up: ' + l.up + '.' : '') + (l.down ? ' Down: ' + l.down + '.' : '');
    G.log.push({ day: Math.floor(G.day), letter: l.id });
    var ae = document.activeElement;
    if (ae === elFocus || (ae && ae.classList && ae.classList.contains('fr-name'))) { try { elLetter.focus({ preventScroll: true }); } catch (e) { } }
  }
  var letterH = 0;
  function letterRest() { if (!letterH) letterH = elLetter.offsetHeight || L.letter.h; var h = letterH; return clamp(L.letter.max - h, L.cluster.y, Math.max(L.letter.y, L.strip.y + L.strip.h + 6)); }
  function placeLetter() {
    if (!G || elLetter.hidden) return;
    var rest = letterRest(), y = rest, op = 1, A = letterAnim;
    if (A) {
      var dur = A.kind === 'in' ? CFG.letterInSec : A.kind === 'up' ? CFG.takeSec : A.kind === 'down' ? CFG.passSec : 0.2;
      var u = reduced() ? 1 : (now - A.t0) / dur, e = A.kind === 'in' ? easeOut(u) : ease(u);
      if (A.kind === 'in') y = L.vh + 10 + (rest - L.vh - 10) * e;
      else if (A.kind === 'up') { y = A.y0 - 120 * e; op = 1 - e; }
      else if (A.kind === 'down') { y = A.y0 + (L.vh + 20 - A.y0) * e; }
      else if (A.kind === 'back') { y = A.y0 + (rest - A.y0) * e; }
      if (u >= 1) { var k = A.kind; letterAnim = null; if (k === 'up' || k === 'down') { elLetter.hidden = true; elLetter.classList.remove('grey'); if (G.wait.length && !G.letter && !G.over) showLetter(G.wait.shift()); return; } }
    } else if (flick) { y = rest + flick.dy; }
    elLetter.style.transform = 'translate(0px,' + Math.round(y) + 'px)';
    elLetter.style.opacity = op;
  }
  function stepFuse() {
    var l = G.letter; if (!l) return;
    var u = clamp(l.fuseLeft / l.fuse, 0, 1);
    lFuse.style.transform = 'scaleX(' + u.toFixed(4) + ')'; lTip.style.left = (u * 100).toFixed(3) + '%';
    lTip.style.visibility = clockRuns() && u > 0 ? '' : 'hidden';
    if (Math.floor(G.day) !== l.shownDay) { l.shownDay = Math.floor(G.day); if (!renderLetter(l)) { G.letter = null; letterAnim = { kind: 'down', t0: now, y0: letterY() }; return; } }
    if (l.fuseLeft <= 0 && !letterAnim && !flick) { if (l.forced) resolveLetter('up', true); else resolveLetter('down', true); }
  }
  function letterY() { var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(elLetter.style.transform || ''); return m ? +m[2] : letterRest(); }
  function resolveLetter(dir, byFuse) {
    var l = G.letter; if (!l || (letterAnim && letterAnim.kind !== 'back' && letterAnim.kind !== 'in')) return false;
    if (dir === 'up' && !l.up) { letterAnim = { kind: 'back', t0: now, y0: letterY() - 20 }; return false; }
    if (dir === 'down' && l.forced) { letterAnim = { kind: 'back', t0: now, y0: letterY() + 20 }; return false; }
    G.letter = null; flick = null;
    letterAnim = { kind: dir === 'up' ? 'up' : 'down', t0: now, y0: letterY() };
    G.log.push({ day: Math.floor(G.day), resolve: l.id, dir: dir, fuse: !!byFuse });
    if (dir === 'up') { snd.take(); l.take && l.take(); } else { snd.pass(); l.pass && l.pass(); }
    if (G.over) return true;
    updateTop(); staticDirty = true;
    if (document.activeElement === elLetter) { try { elFocus.focus({ preventScroll: true }); } catch (e) { } }
    return true;
  }
  function withdrawTerms() {
    G.wait = G.wait.filter(function (w) { return w.kind !== 'term'; });
    if (G.letter && G.letter.kind === 'term') { var l = G.letter; G.letter = null; elLetter.classList.add('grey'); letterAnim = { kind: 'down', t0: now, y0: letterY() }; G.log.push({ day: Math.floor(G.day), withdrawn: l.id }); }
  }


  /* ================================================================
     THE BET STRIP: time, from a six-hour probe to the stop
     ================================================================ */
  var drag = null, stopShown = { T: 0 };
  function stopInfo() {
    var F = flopsPerDay();
    var mem = hasSystems() ? Infinity : CFG.memC / Math.max(F, 1);
    var horC = hasBeliever() ? Infinity : Math.max(farthestClean() * CFG.horizonMult, CFG.horizonFloor), hor = horC / Math.max(F, 1);
    var yr = Math.max(0, CFG.endDay - G.day);
    var T = Math.min(mem, hor, yr), bind = T === yr ? 'year' : T === mem ? 'mem' : 'horizon';
    return { F: F, T: Math.max(CFG.minDays, T), bind: bind, ok: F > 0 && yr > CFG.minDays * 0.5, horC: Math.max(farthestClean() * CFG.horizonMult, CFG.horizonFloor) };
  }
  function daysAt(t, st) { return CFG.minDays + clamp(t, 0, 1) * (st.T - CFG.minDays); }
  function nibX(t) { return L.travel.x + clamp(t, 0, 1) * L.travel.w; }
  function nibClampX(x) { return clamp(x, L.strip.x + 6, L.travel.x + L.travel.w); }
  function tAtX(x) { return clamp((x - L.travel.x) / L.travel.w, 0, 1); }
  // a fast thumb may start the next bet while a landing is still being read (the drag freezes the clock anyway)
  function canBet() { return G.powered && !G.over && !G.run && !moment && (G.phase === 'idle' || G.phase === 'wait' || G.phase === 'land'); }
  function beginDrag(x, y, viaKeys) {
    if (!canBet()) return false;
    var st = stopInfo(); if (!st.ok) return false;
    drag = { st: st, t: 0, samples: [], kb: !!viaKeys, hitStop: false, x: null };
    if (G.snapNext) { G.snapNext = false; drag.t = 1; drag.snapped = true; }
    else if (!viaKeys) { drag.t = tAtX(x); drag.x = nibClampX(x); }
    drag.samples.push({ t: drag.t, at: performance.now() });
    G.phase = 'drag';
    updateDragNotes();
    return true;
  }
  function moveDrag(x, y) {
    if (!drag) return;
    if (!drag.snapped) { drag.t = tAtX(x); drag.x = nibClampX(x); }
    drag.samples.push({ t: drag.t, at: performance.now() }); if (drag.samples.length > 60) drag.samples.shift();
    updateDragNotes();
  }
  function dragC() { return daysAt(drag.t, drag.st) * drag.st.F; }
  function updateDragNotes() {
    var st = drag.st, C = dragC();
    if (drag.t >= 0.999 && !drag.hitStop) {
      drag.hitStop = true;
      var at = { x: Math.min(nibX(1) - 150, L.x1 - 160), y: L.ruler.y - 22, fixed: true };
      if (st.bind === 'mem') noteBy(anyHand(['priya']), 'memStop', at, { life: 2 });
      else if (st.bind === 'horizon') noteBy(anyHand(['dev', 'priya']), 'horizonStop', at, { life: 2 });
      else note(K.notes.yearStop, null, at, { life: 2, typed: true });
    } else if (drag.t < 0.99) drag.hitStop = false;
    if (C > CFG.memC && person('dev') && !G.seen.split) { G.seen.split = 1; noteBy('dev', 'split', { C: C, lnL: Math.log(R.Lline(C)) }); }
    if (hasBeliever() && C > st.horC && !G.seen.keepsGoing) { G.seen.keepsGoing = 1; noteBy('ayaan', 'keepsGoing', { C: C, lnL: Math.log(R.Lline(C)) }); }
  }
  function endDrag() {
    if (!drag) return;
    var d = drag; drag = null; elReadout.style.opacity = 0; elProj.textContent = '';
    // the bet is read 100 ms before the lift (or from the first position if the drag was shorter)
    var tUp = performance.now(), t = d.samples[0].t;
    for (var i = d.samples.length - 1; i >= 0; i--) if (d.samples[i].at <= tUp - CFG.restReadSec * 1000) { t = d.samples[i].t; break; }
    if (d.kb || d.snapped) t = d.t;
    G.phase = G.firstLift ? 'idle' : 'wait';
    launch(daysAt(t, d.st));
  }
  function showReadout(x, y) {
    var T = daysAt(drag.t, drag.st), land = G.day + T;
    elReadout.textContent = R.fmtDay(Math.min(land, CFG.endDay - 1e-6));
    var w = elReadout.offsetWidth || 70;
    var rx = clamp(x - w / 2, L.x0, L.x1 - w), ry = clamp(y - L.readAbove - 15, 4, L.vh - 20);
    elReadout.style.transform = 'translate(' + Math.round(rx) + 'px,' + Math.round(ry) + 'px)'; elReadout.style.opacity = 1;
    elProj.textContent = '→ ' + fmtMonths(Math.max(0, monthsLeft() - T / CFG.daysPerMonth));
  }

  /* ================================================================
     THE RUN
     ================================================================ */
  function launch(T) {
    var st = stopInfo(); if (!st.ok) return false;
    T = clamp(T, CFG.minDays, st.T);
    var F = st.F, C = T * F, D = R.tokens(C);
    var blind = hasBeliever() && C > st.horC, b = 0;
    if (blind) b = rng() < CFG.blind.chance ? U(CFG.blind.hi[0], CFG.blind.hi[1]) : U(CFG.blind.lo[0], CFG.blind.lo[1]);
    var m = sunheeBend();
    var run = { n: G.runs.length + 1, C: C, T: T, D: D, k: m * (1 + b), m: m, b: b, blind: blind, s: 0, launchDay: G.day, pts: [], lastQ: null,
      dps: T < CFG.minPourSec ? T / CFG.minPourSec : CFG.pourDaysPerSec, sampledUpTo: -1, autoQ: CFG.autoSampleQ.slice(), lastTap: -99, lastAuto: now, pendingTap: null,
      hang: null, hangs: [], liftT0: now };
    // the vault: an unflicked checkpoint sinks at the next lift
    if (G.cp) G.cp = null;
    sinkBand();
    G.run = run; G.phase = 'pour'; G.firstLift = true;
    snd.lift(); snd.motor('train', trainingEq(), 0.3);
    panToTarget();
    staticDirty = true;
    G.log.push({ day: Math.floor(G.day), launch: C, T: +T.toFixed(2) });
    return true;
  }
  function qOf(run) { return Math.pow(clamp(run.s, 0, 1), CFG.pourWarp); }
  function curvePoint(run, q) {
    var qq = Math.max(R.P0, q), z = clamp((log10(qq) + 3.5) / 3.5, 0, 1);
    return { x: log10(qq * run.C), y: Math.log(R.lossAt(run.C, qq, run.k)) + gauss() * CFG.curveNoise * (1 - 0.5 * z) };
  }
  function addPts(run) {
    var q = qOf(run), lq = log10(Math.max(R.P0, q));
    if (run.lastQ == null) { run.pts.push(curvePoint(run, R.P0)); run.lastQ = log10(R.P0); }
    var pxPer = L.plot.w / (view.r - view.l), steps = Math.min(60, Math.floor((lq - run.lastQ) * pxPer / 1.2));
    if (steps < 1) return;
    for (var i = 1; i <= steps; i++) run.pts.push(curvePoint(run, Math.pow(10, run.lastQ + (lq - run.lastQ) * i / steps)));
    run.lastQ = lq;
  }
  function cpIndex(q) { var c = -1; for (var i = 0; i < CFG.checkpoints.length; i++) if (CFG.checkpoints[i] <= q + 1e-9) c = i; return c; }
  function holdsBand() { return !!(G.cp && G.cp.redTeamed && G.run); }
  function tapSample() {
    var run = G.run; if (!run || G.phase !== 'pour') return false;
    if (holdsBand()) return false;
    run.lastTap = now;
    var ci = cpIndex(qOf(run));
    if (ci > run.sampledUpTo) { run.sampledUpTo = ci; showBand(makeSample(run, CFG.checkpoints[ci], 'tap'), 'stream'); }
    else run.pendingTap = now;
    return true;
  }
  function stepSamples(run) {
    if (holdsBand()) return;
    var ci = cpIndex(qOf(run));
    if (run.pendingTap != null) {
      if (ci > run.sampledUpTo) { run.sampledUpTo = ci; run.pendingTap = null; showBand(makeSample(run, CFG.checkpoints[ci], 'tap'), 'stream'); }
      else if (now - run.pendingTap > CFG.tapWaitSec) { run.pendingTap = null; if (ci >= 0) showBand(makeSample(run, CFG.checkpoints[ci], 'tap'), 'stream'); }
    }
    var q = qOf(run);
    if (run.autoQ.length && q >= run.autoQ[0]) { run.autoQ.shift(); if (now - run.lastTap > CFG.autoQuietSec && ci >= 0) { run.sampledUpTo = Math.max(run.sampledUpTo, ci); run.lastAuto = now; showBand(makeSample(run, CFG.checkpoints[ci], 'auto'), 'stream'); } }
    if (run.T > CFG.longPourSec && now - run.lastAuto > CFG.autoEverySec && now - run.lastTap > CFG.autoQuietSec && ci >= 0) { run.lastAuto = now; run.sampledUpTo = Math.max(run.sampledUpTo, ci); showBand(makeSample(run, CFG.checkpoints[ci], 'auto'), 'stream'); }
  }
  // Priya reads the words. Loud fray or crawl: she offers the filter herself, and the offer stands until the next 1st
  // (when her note is cleared from the paper) or until the job starts. A loud sample in the band always re-arms it.
  function loud(smp) { return !!smp && (smp.crawl || smp.fray >= CFG.priyaAutoAmount); }
  function dataRunner() { return person('priya') ? 'priya' : person('ines') ? 'ines' : null; }
  function offerStands() { return !G.filter && !!dataRunner() && (!!G.priyaOffer || loud(G.sample)); }
  function onSampleShown(smp) {
    G.lastFrayAmt = smp.crawl ? 6 : smp.fray;
    // the sentence you skimmed: the last frayed (not yet crawl) words this run showed you
    if (G.run && smp.runN === G.run.n && smp.fray > 0 && !smp.crawl) G.run.skimmed = smp.text;
    if (loud(smp) && !G.filter) {
      var who = dataRunner();
      if (who && !G.priyaOffer) {
        G.priyaOffer = { amt: smp.crawl ? 6 : smp.fray, month: G.month };
        var at = G.run ? { C: Math.max(R.P0, qOf(G.run)) * G.run.C, lnL: Math.log(R.lossAt(G.run.C, qOf(G.run), G.run.k)) } : (smp.C ? { C: smp.C, lnL: Math.log(smp.landL || R.Lline(smp.C)) } : null);
        noteBy(who, 'frayLoud', at, { life: 12 });
      }
    }
  }
  function startFilter(id) {
    var cost = CFG.filterCost * Math.pow(2, G.filters);
    var days = person('priya') && person('ines') ? CFG.filterDaysInes : CFG.filterDays;
    G.bank -= cost;
    G.filter = { end: G.day + days, who: id, cost: cost };
    G.priyaOffer = 0;
    snd.tick();
    G.log.push({ day: Math.floor(G.day), filter: days, cost: cost });
  }
  function hangHour() { var tot = 28, x = rng() * tot; for (var h = 0; h < 24; h++) { x -= (h >= 1 && h < 5) ? 2 : 1; if (x <= 0) return h + rng(); } return 3.2; }
  function hang(run) {
    var h = hangHour(), infra = hasInfra(), down;
    if (infra) down = CFG.infraRestartHours / 24;
    else { var until = (CFG.hangWakeHour - h + 24) % 24; down = until / 24; if (G.day >= CFG.hangCovidFrom && G.day < CFG.hangCovidTo) down += CFG.hangCovidAddDays; }
    var rewindDays = infra ? U(0, 4 / 24) : U(0, 1);
    run.s = Math.max(0, run.s - rewindDays * flopsPerDay() / run.C);
    var q = qOf(run), lq = log10(Math.max(R.P0, q));
    while (run.pts.length > 2 && run.pts[run.pts.length - 1].x > lq + log10(run.C)) run.pts.pop();
    run.lastQ = Math.min(run.lastQ == null ? lq : run.lastQ, lq);
    run.hang = { start: G.day, h: h, restart: G.day + down };
    run.hangs.push({ start: G.day, end: G.day + down });
    G.hangsThisMonth++;
    var lp = run.pts[run.pts.length - 1] || curvePoint(run, q);
    var mark = { lc: lp.x, lnL: lp.y, time: String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.floor((h % 1) * 60)).padStart(2, '0'), tom: !!person('tom') && G.day >= G.tomOffUntil, first: run.hangs.length === 1 };
    G.hangMarks.push(mark);
    if (mark.tom) noteBy('tom', 'myFault', { mark: mark, C: Math.pow(10, lp.x), lnL: lp.y });
    snd.cut(); after(0.4, function () { snd.thud(); });
    staticDirty = true;
    G.log.push({ day: Math.floor(G.day), hang: mark.time, down: +down.toFixed(2) });
  }
  function stepRun(dd) {
    var run = G.run; if (!run) return;
    if (run.hang) {
      if (G.day >= run.hang.restart) { run.hang = null; run.relightT0 = now; snd.motor('train', trainingEq(), 0.3); }
      else return;
    }
    var lam = CFG.hangBase * Math.sqrt(Math.max(0, trainingEq()) / 8) * infraMult();
    if (run.s > 0.02 && run.s < 0.98 && rng() < 1 - Math.exp(-lam * dd)) { hang(run); return; }
    run.s += flopsPerDay() * dd / run.C;
    addPts(run);
    stepSamples(run);
    if (run.s >= 1) land(run);
  }
  function fireCaps(L0, run) {
    var fresh = [];
    G.caps.forEach(function (c) { if (!c.fired && L0 <= c.L) { c.fired = true; c.atRun = run.n; if (G.filters === 0 && rng() < CFG.contaminateChance) c.contaminated = true; fresh.push(c); } });
    return fresh;
  }
  function land(run) {
    run.landDay = G.day; run.finished = true; run.s = 1;
    addPts(run);
    G.run = null; G.runs.push(run);
    G.phase = 'land';
    snd.motor('idle', 0, 0.3);
    var r = run.D / G.Dwall;
    run.crossed = r > 1;
    var freeze = run.crossed ? CFG.landWallSec : CFG.landCleanSec;
    if (run.crossed) {
      run.L = R.Lline(run.C) * run.k;
      var qStar = G.Dwall / run.D;
      var smp = makeSample(run, 1, 'land');
      G.scars.push({ lc0: log10(qStar * run.C), lc1: log10(run.C), t0: now, text: run.skimmed || smp.text });
      G.rings.push({ C: run.C, L: run.L });
      showBand(smp, 'stream');
      snd.hatch(0.9);
    } else {
      var Lf = R.Lline(run.C) * run.k;
      run.L = Lf;
      var dot = { C: run.C, L: Lf, day: G.day, runN: run.n, pub: false, ship: false, contaminated: false, surname: null, scandal: null };
      G.dots.push(dot);
      // passing a rival
      G.rivals.forEach(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; if (!rv.passed && lp && run.C > lp.C && Lf < lp.L) { rv.passed = true; snd.tick(); } });
      var fresh = fireCaps(Lf, run);
      fresh.forEach(function (c) { if (c.contaminated) { dot.contaminated = true; if (person('lena')) noteBy('lena', 'leak', { C: run.C, lnL: Math.log(Lf) }); } });
      var top = fresh.length ? fresh[fresh.length - 1] : null;
      var smp2 = makeSample(run, 1, 'land', top ? top.id : null);
      G.cp = { dot: dot, smp: smp2, redTeamed: false };
      if (run.m < 1 && !G.seen.sunheeTold) { G.seen.sunheeTold = 1; noteBy('sunhee', 'toldYou', { C: run.C, lnL: Math.log(Lf) }); }
      var miracle = run.C >= CFG.gpt3C && Lf <= CFG.gpt3L * CFG.miracleTol && !G.miracle;
      if (top) {
        moodAll(CFG.moodCap);
        startMoment(smp2.momentText || smp2.text, 'cap');
        moment.after = function () { showBand(smp2, 'instant'); flickHints(); if (miracle) doMiracle(); else if (G.phase !== 'moment') G.phase = 'idle'; };
      } else {
        showBand(smp2, 'stream'); after(0.6, flickHints);
        if (miracle) after(freeze, doMiracle);
      }
      if (G.firstAuthor) { var fa = G.firstAuthor; G.firstAuthor = null; dot.surname = proto(fa).surname + ' et al.'; doPublish(dot, fa); G.cp = null; }
    }
    staticDirty = true;
    G.log.push({ day: Math.floor(G.day), land: run.C, crossed: run.crossed, L: +run.L.toFixed(4) });
    var myYear = yearN;
    after(freeze, function () { if (yearN !== myYear || G.over) return; if (G.phase === 'land') G.phase = 'idle'; panToTarget(); motorForPhase(); });
  }
  function doMiracle() { if (G.miracle || G.over) return; G.miracle = true; startMoment('', 'miracle'); }
  function flickHints() {
    if (!G.cp || G.over) return;
    // the hint is written at the band's top right, beside the words it is about
    var at = { x: L.band.x + L.band.w - 200, y: L.band.y + 2, fixed: true, free: true };
    if (G.day >= CFG.publishFrom && !G.hints.up) { G.hints.up = 1; noteBy(anyHand(['priya']), 'flickUp', at, { life: 6 }); }
    else if (canShip(G.cp) && !G.hints.right) { G.hints.right = 1; noteBy(anyHand(['priya']), 'flickRight', at, { life: 6 }); }
  }
  function canShip(cp) { return !!cp && G.day >= CFG.shipFrom && G.caps[0].fired && cp.dot.L <= G.caps[0].L + 1e-9; }
  function capTier(dot) { var t = null; G.caps.forEach(function (c) { if (c.fired && dot.L <= c.L + 1e-9) t = c.id; }); return t; }

  /* ---------------- the checkpoint flick: publish, ship, vault ---------------- */
  function flickCheckpoint(dir) {
    var cp = G.cp; if (!cp) return false;
    if (dir === 'up' && G.day < CFG.publishFrom) return false;
    if (dir === 'right' && !canShip(cp)) return false;
    G.cp = null;
    if (dir === 'up') { var dx = X(log10(cp.dot.C)) - (L.band.x + L.band.w / 2), dy = Y(Math.log(cp.dot.L)) - (L.band.y + L.band.h * 0.7); bandFly = { t0: now, dur: 0.5, dx: dx * 0.6, dy: dy }; band = null; doPublish(cp.dot, null, cp.redTeamed); }
    else { bandFly = { t0: now, dur: 0.4, dx: L.vw, dy: 0 }; band = null; doShip(cp.dot, cp.redTeamed); }
    snd.take();
    G.log.push({ day: Math.floor(G.day), flick: dir, C: cp.dot.C });
    return true;
  }
  function doPublish(dot, firstAuthor, redTeamed) {
    var apply = function () {
      dot.pub = true; dot.pending = false; G.lastPublishDay = G.day;
      staff().forEach(function (p) { if (p.id === firstAuthor) mood(p.id, CFG.moodFirstAuthor); else if (p.ego >= 3) mood(p.id, CFG.moodPublish); });
      var Cp = dot.C;
      G.pendings.push({ day: G.day + CFG.rivalSlideDelay, fn: function () { G.rivals.forEach(function (rv) { var c = Math.pow(10, rv.logc); if (c < Cp) rv.logc = log10(c * Math.pow(Cp / c, CFG.rivalSlidePow)); }); } });
      if (!redTeamed) {
        var p = dot.contaminated ? 1 : G.filters > 0 ? CFG.scandalPubFiltered : CFG.scandalPub;
        if (rng() < p) G.scandals.push({ day: G.day + U(CFG.scandalDelay[0], CFG.scandalDelay[1]), dot: dot, kind: 'pub' });
      }
      staticDirty = true;
    };
    if (G.mer) { dot.pending = true; G.pendings.push({ day: G.day + CFG.meridian.firstLook, fn: apply }); } else apply();
  }
  function doShip(dot, redTeamed) {
    var apply = function () {
      var tier = capTier(dot) || 'paragraph';
      G.api = { dot: dot, revenue: CFG.capRevenue[tier] };
      G.dots.forEach(function (d) { d.ship = false; }); dot.ship = true; dot.pending = false;
      if (!redTeamed && rng() < CFG.scandalShip) G.scandals.push({ day: G.day + U(CFG.scandalDelay[0], CFG.scandalDelay[1]), dot: dot, kind: 'ship' });
      staticDirty = true;
    };
    if (G.mer) { dot.pending = true; G.pendings.push({ day: G.day + CFG.meridian.firstLook, fn: apply }); } else apply();
  }
  function startRedTeam() {
    if (!G.cp || G.held || !person('lena')) return;
    G.held = { cp: G.cp, end: G.day + (G.api ? CFG.redTeamDaysApi : CFG.redTeamDays) };
    G.cp = null; sinkBand();
    G.log.push({ day: Math.floor(G.day), redteam: +G.held.end.toFixed(1) });
  }

  /* ================================================================
     THE CALENDAR
     ================================================================ */
  function dayRate() { if (G.run) return G.run.hang ? CFG.pourDaysPerSec : G.run.dps; return CFG.idleDaysPerSec; }
  function clockRuns() { return G.powered && G.firstLift && !G.over && (G.phase === 'idle' || G.phase === 'pour'); }
  function stepDays(total) {
    var guard = 0;
    while (total > 1e-9 && guard++ < 5000) {
      if (!clockRuns()) return;
      var nextInt = Math.floor(G.day + 1e-9) + 1;
      var dd = Math.min(total, 0.05, nextInt - G.day);
      if (dd < 1e-9) dd = Math.min(total, 1e-6);
      G.day += dd; total -= dd;
      G.bank -= rentPerDay() * dd;
      G.bank += apiRevenue() / CFG.daysPerMonth * dd;
      if (G.mer && G.day >= G.mer.live) G.mer.credits -= G.mer.cards * CFG.rentPrice[0][1] * 24 * dd;
      if (G.letter && !letterAnim) { G.letter.fuseLeft -= dd; if (G.letter.fuseLeft > 0) snd.fuse(); }
      if (G.run) stepRun(dd);
      // the bank hits zero mid-month: every rented card goes back at once
      if (G.bank <= 0 && G.rentals.length) { G.rentals = []; G.log.push({ day: Math.floor(G.day), rentalsTaken: true }); }
      if (Math.abs(G.day - nextInt) < 1e-7) { G.day = nextInt; dailyEvents(nextInt); }
      if (G.letter) stepFuse();
    }
  }
  function dailyEvents(d) {
    if (d >= CFG.endDay) { if (!G.over) endYear('survived'); return; }
    var m = R.monthOf(d);
    if (m !== G.month) monthStart(m);
    if (G.over) return;
    K.news.forEach(function (n, i) { if (!G.newsDone[i] && d >= n[0]) { G.newsDone[i] = 1; var hq = { text: n[2], day: n[0] }; if (n[0] === K.gpt3Day) G.headQ.unshift(hq); else G.headQ.push(hq); G.phrases.push({ day: n[0], text: n[1] }); staticDirty = true; if (n[0] === CFG.lineDay) G.lineT0 = now; } });
    if (d === CFG.marketClosedFrom) withdrawTerms();
    if (d === K.gpt3Day && !G.gpt3) gpt3Moment();
    for (var i = G.orders.length - 1; i >= 0; i--) { var o = G.orders[i]; if (d >= o.arrive) { if (o.kind === 'a100') G.ownedA100 += o.n; else G.owned += o.n; G.orders.splice(i, 1); for (var k = 0; k < 8; k++) after(k * 0.03, snd.card); } }
    G.rentals = G.rentals.filter(function (r) { return d < r.end; });
    if (G.lent && d >= G.lent.until) G.lent = null;
    // the pass ends: the sample comes back to the band (as soon as no newer landing sample is up) to be flicked, risk-free
    if (G.held && d >= G.held.end) { G.held.cp.redTeamed = true; G.heldDone = G.held.cp; G.held = null; G.log.push({ day: d, redteamDone: true }); }
    if (G.filter && d >= G.filter.end) { G.filter = null; G.filters++; G.W *= CFG.filterW; G.Dwall = CFG.passes * G.W; G.Cwall = R.C_of_tokens(G.Dwall); G.log.push({ day: d, filterDone: G.filters }); }
    if (G.evals && d >= G.evals.readDay) { var ev = G.evals; G.evals = null; evalsRead(ev); }
    G.rivals.forEach(function (rv) {
      rv.logc += 1 / (CFG.daysPerMonth * rv.tau);
      if (G.rivalTrickDay != null && d >= G.rivalTrickDay) rv.trick = (G.rivalTrickAll || rv.id === 'halcyon') ? CFG.sunheeBend : 1;
      if (d >= rv.next) {
        var c = Math.pow(10, rv.logc);
        rv.pubs.push({ C: c, L: R.Lline(c) * rv.offset * rv.trick, day: d });
        if (rv.passed && c > farthestClean()) rv.passed = false;
        rv.next = d + rv.period * U(CFG.rivalPeriodJitter[0], CFG.rivalPeriodJitter[1]);
        staticDirty = true;
      }
    });
    for (i = G.pendings.length - 1; i >= 0; i--) if (d >= G.pendings[i].day) { var pd = G.pendings.splice(i, 1)[0]; pd.fn(); }
    for (i = G.scandals.length - 1; i >= 0; i--) if (d >= G.scandals[i].day) scandal(G.scandals.splice(i, 1)[0]);
    if (dom(d) === 11 || dom(d) === 21) slot(d, false);
  }
  function monthStart(m) {
    var first = G.month === -1;
    G.month = m;
    G.hangsLastMonth = G.hangsThisMonth; G.hangsThisMonth = 0;
    var d = Math.round(G.day);
    // payroll: one hard tick
    G.bank -= payroll();
    snd.pay(); jolt();
    if (G.bank < 0) { endYear('bankrupt'); return; }
    if (!first) {
      staff().forEach(function (p) { if (p.ego >= 4 && G.day - G.lastPublishDay > CFG.noPubDays) mood(p.id, CFG.moodNoPub); });
      clearNotes(); G.priyaOffer = 0;
    }
    if (G.mer && G.day >= CFG.meridian.queueFrom) {
      var fr = frontier(), fc = farthestClean(), full = G.mer.cards;
      G.queueCut = fc * CFG.meridian.fullWithin >= fr ? 0 : fc * CFG.meridian.halfWithin >= fr ? full / 2 : full * 3 / 4;
    }
    if (G.run && !G.run.hang) { var q = qOf(G.run); G.evals = { run: G.run, q: q, readDay: d + 2, L: R.lossAt(G.run.C, q, G.run.k), rq: rq(G.run, q) }; }
    // relevance: the month nobody knocks
    var silent = false;
    if (G.day >= CFG.relevanceFrom) {
      var fr2 = frontier();
      if ((fr2 > 0 && worldView() < fr2 * CFG.relevanceShare) || G.scandalMonth === m) silent = true;
    }
    if (silent && G.silent) { endYear('forgotten'); return; }
    G.silent = silent;
    updateTop();
    slot(d, true);
  }
  function evalsRead(ev) {
    if (ev.rq > 1) return;
    var run = ev.run, fresh = fireCaps(ev.L, run);
    if (!fresh.length) return;
    var top = fresh[fresh.length - 1];
    fresh.forEach(function (c) { if (c.contaminated && person('lena')) noteBy('lena', 'leak', G.run ? { C: G.run.C } : null); });
    moodAll(CFG.moodCap);
    var smp = makeSample(run, ev.q, 'evals', top.id);
    startMoment(smp.momentText || smp.text, 'cap');
    moment.after = function () { showBand(smp, 'instant'); };
  }
  function scandal(s) {
    var dot = s.dot;
    dot.scandal = s.kind === 'pub' ? K.notes.scandalPub : K.notes.scandalShip;
    withdrawTerms(); G.termBlockUntil = G.day + CFG.scandalNoTermsDays;
    if (s.kind === 'ship' && G.api && G.api.dot === dot) { G.api = null; dot.ship = false; }
    mood('priya', CFG.moodScandal); mood('lena', CFG.moodScandal);
    G.scandalMonth = (R.monthOf(G.day) + 1) % 12;
    staticDirty = true;
    G.log.push({ day: Math.floor(G.day), scandal: s.kind });
  }
  function gpt3Moment() {
    G.gpt3 = true; staticDirty = true;
    var ok = hasLine();
    if (person('ayaan')) after(ok ? 3.6 : 0.5, function () { noteBy('ayaan', 'toldYou', { C: CFG.gpt3C, lnL: Math.log(R.Lline(CFG.gpt3C)) }); });
    if (!ok || moment) return;
    if (G.run) snd.motor('off', 0, 0.3);
    startMoment('', 'gpt3');
  }

  /* ---------------- how a year ends ---------------- */
  function endYear(reason) {
    if (G.over) return;
    G.over = { reason: reason, day: G.day, t0: now };
    G.phase = 'end'; drag = null; elReadout.style.opacity = 0; elProj.textContent = '';
    if (G.letter) { G.letter = null; letterAnim = { kind: reason === 'bought' ? 'up' : 'down', t0: now, y0: letterY() }; }
    G.wait = [];
    if (reason === 'bankrupt') {
      // the figure prints 0, every cell goes dark, the motor winds down from 55 to 30 Hz, names struck 120 ms apart,
      // the sheet fades to Dry over 1.2 s, then 800 ms of true silence
      G.dark = true; snd.windDown(1.2);
      staff().forEach(function (p, i) { after(0.12 * i, function () { var b = nameEl(p.id); if (b) b.classList.add('gone'); snd.strike(); }); });
      root.classList.add('dry');
      after(1.2, function () { snd.silence(0.02); });
    } else if (reason === 'bought') {
      // FRONTIER struck through over 600 ms, HALCYON pencilled beside it; the names stay (they are rich); your ink drops to 35%
      snd.motor('off', 0, 0.3);
      elBrand.classList.add('struck'); after(0.6, function () { elBought.textContent = 'HALCYON'; });
      G.fade = { kind: 'bought', t0: now, dur: 0.6 }; root.classList.add('sold');
    } else if (reason === 'forgotten') {
      // payroll ticks, no letter comes, and over 2 s your ink fades to Dry while the rivals and GPT-3's point stay dark
      snd.motor('off', 0, 0.3);
      G.fade = { kind: 'forgotten', t0: now, dur: 2.0 }; root.classList.add('faded');
    } else {
      // survived: the motor stops over 300 ms; a run in flight stops mid-stroke and stays on the paper as a curve in the air
      snd.motor('off', 0, 0.3); snd.scratch(0);
    }
    staticDirty = true;
    updateTop();
    G.log.push({ day: Math.floor(G.day), end: reason });
    var myYear = yearN;
    after(CFG.nextYearSec, function () { if (yearN !== myYear) return; feedOut(); });
  }
  // 6.5 s after any end frame the paper feeds out to the left over 900 ms and a fresh 1 January slides in from the right
  var FEED = 'transform .9s cubic-bezier(.55,0,.35,1)';
  function feedOut() {
    var myYear = yearN, red = reduced();
    snd.whirr(0.9);
    if (red) { root.style.transition = 'opacity .45s linear'; root.style.opacity = 0; }
    else { root.style.transition = FEED; root.style.transform = 'translate3d(-100%,0,0)'; }
    after(red ? 0.5 : 0.95, function () {
      if (yearN !== myYear) return;
      snd.restore(); snd.motorFreq(55, 0.05);
      root.style.transition = 'none';
      newYear(); layout();
      if (red) { root.style.transform = ''; void root.offsetWidth; root.style.transition = 'opacity .45s linear'; root.style.opacity = 1; }
      else { root.style.opacity = 1; root.style.transform = 'translate3d(100%,0,0)'; void root.offsetWidth; root.style.transition = FEED; root.style.transform = 'translate3d(0,0,0)'; snd.whirr(0.9); }
      after(1.0, function () { root.style.transition = ''; root.style.transform = ''; });
    });
  }

  /* ---------------- power on: the first touch powers the sheet and does nothing else ---------------- */
  function powerOn() {
    snd.start();
    if (G.powered) return;
    G.powered = true; G.phase = 'wait'; G.powerT0 = now;
    root.classList.add('on');
    snd.motor('idle', 0, 0.8);
    staticDirty = true;
    var myYear = yearN;
    // cells ink in left to right 60 ms apart; the date sets; Priya writes herself in at 40 ms a letter; the rivals' 2019
    // dots set; then the 1 January payroll ticks with the first letter in the same frame
    after(0.3, function () { if (yearN === myYear) addPerson('priya'); });
    after(0.6, function () { if (yearN === myYear) { G.rivalsShown = true; staticDirty = true; } });
    after(1.05, function () { if (yearN === myYear && !G.over && G.month === -1) { monthStart(0); updateTop(); } });
  }

  /* ================================================================
     DRAWING
     ================================================================ */
  // two layers: the paper (redrawn only when something on it changes) and the live layer (pen, cluster, strip) above it
  var staticCv = $('fr-cs'), sctx = staticCv.getContext('2d'), staticDirty = true;
  var MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace", HAND = "Caveat, 'Segoe Print', 'Bradley Hand', cursive", SERIF = "Newsreader, Georgia, serif";
  function setFont(c, px, fam, style) { c.font = (style || '') + ' ' + px + 'px ' + fam; }
  // your ink: dark, or fading at the end (bought: to 35%; forgotten: to Dry). The world's graphite never fades.
  function inkU() { var f = G.fade; if (!f) return 0; return reduced() ? 1 : clamp((now - f.t0) / f.dur, 0, 1); }
  function ownCol(al) {
    var f = G.fade; if (al == null) al = 1;
    if (!f) return al >= 1 ? COL.ink : rgba('ink', al);
    var u = inkU();
    if (f.kind === 'bought') return rgba('ink', al * (1 - 0.65 * u));
    var A = RGB.ink, B = RGB.dry;
    return 'rgba(' + Math.round(A[0] + (B[0] - A[0]) * u) + ',' + Math.round(A[1] + (B[1] - A[1]) * u) + ',' + Math.round(A[2] + (B[2] - A[2]) * u) + ',' + al + ')';
  }
  // canvas text placement: every label on the paper claims a rectangle, later labels step around earlier ones
  function halo(c, text, x, y, col) { c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = COL.paper; c.strokeText(text, x, y); c.fillStyle = col; c.fillText(text, x, y); }
  function overlapArea(rects, r) { var a = 0; for (var i = 0; i < rects.length; i++) { var o = rects[i], w = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x), h = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y); if (w > 0 && h > 0) a += w * h; } return a; }
  function hits(rects, r) { for (var i = 0; i < rects.length; i++) { var o = rects[i]; if (r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y) return true; } return false; }
  function drawStatic() {
    var c = sctx, INK = ownCol(1);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, L.vw, L.vh);
    var P = L.plot, ry = L.ruler.y, rb = L.ruler.y + L.ruler.h;
    c.lineWidth = 1; c.strokeStyle = COL.grid; c.beginPath();
    for (var lc = Math.ceil(view.l); lc <= view.r; lc++) { var x = Math.round(X(lc)) + 0.5; c.moveTo(x, P.y); c.lineTo(x, P.y + P.h); }
    [2, 3, 4, 6, 8].forEach(function (Lv) { var y = Math.round(Y(Math.log(Lv))) + 0.5; c.moveTo(P.x, y); c.lineTo(P.x + P.w, y); });
    c.stroke();
    staticDirty = false;
    if (!G.powered) return;
    if (G.fade && inkU() < 1) staticDirty = true;
    var taken = [];
    // the calendar ruler
    c.strokeStyle = COL.grid; c.beginPath(); c.moveTo(P.x, Math.round(rb) - 0.5); c.lineTo(P.x + P.w, Math.round(rb) - 0.5); c.stroke();
    setFont(c, 9, MONO); c.fillStyle = COL.graphite; c.textAlign = 'center'; c.textBaseline = 'bottom';
    for (var m = 0; m < 12; m++) {
      var d0 = R.firstOfMonth(m), xm = Math.round(DX(d0)) + 0.5;
      c.strokeStyle = COL.grid; c.beginPath(); c.moveTo(xm, rb - 6); c.lineTo(xm, rb); c.stroke();
      c.fillText(R.MON[m][0], DX(d0 + 15), rb - 1);
    }
    G.runs.forEach(function (run) { runBar(c, run, run.landDay, INK); });
    // headlines: a pencil tick on the ruler and a short phrase rising into the paper; phrases that would touch step right
    setFont(c, 9, MONO, 'italic'); c.textAlign = 'left'; c.textBaseline = 'middle';
    var lastX = -99;
    G.phrases.slice().sort(function (a, b) { return a.day - b.day; }).forEach(function (n) {
      var xn = Math.round(DX(n.day)) + 0.5, xt = Math.max(xn + 4, lastX + 10); lastX = xt;
      c.strokeStyle = COL.graphite; c.beginPath(); c.moveTo(xn, ry - 3); c.lineTo(xn, ry + 4); c.stroke();
      c.save(); c.translate(xt, ry - 5); c.rotate(-Math.PI / 2); c.fillStyle = COL.graphite; c.fillText(n.text, 0, 0); c.restore();
      var pw = c.measureText(n.text).width; taken.push({ x: xt - 6, y: ry - 6 - pw, w: 11, h: pw + 2 });
    });
    // scar bands: vermilion hatch from the wall's compute to the run's, the skimmed sentence along the top
    G.scars.forEach(function (sc) { var x0 = X(sc.lc0), x1 = Math.max(X(sc.lc1), x0 + 8); drawHatch(c, x0, x1, sc); });
    setFont(c, 12, SERIF); c.textAlign = 'left'; c.textBaseline = 'top';
    G.scars.forEach(function (sc) {
      if (!sc.text) return;
      var w = Math.min(L.lap ? 250 : 176, P.w - 4), sx = clamp(X(sc.lc0) + 3, P.x + 2, P.x + P.w - w - 2), sy = P.y + 2, lines = wrapLines(c, sc.text, w, 2), h = lines.length * 16 + 2;
      for (var tries = 0; tries < 6 && hits(taken, { x: sx, y: sy, w: w, h: h }); tries++) sy += h + 4;
      if (sy + h > P.y + P.h * 0.55) return;
      taken.push({ x: sx - 2, y: sy - 1, w: w + 4, h: h + 2 });
      lines.forEach(function (ln, i) { halo(c, ln, sx, sy + i * 16, INK); });
    });
    // the paper's line, printed on 23 Jan, and GPT-3's ring on it
    if (G.lineT0 != null) {
      var prog = reduced() ? 1 : clamp((now - G.lineT0) / 1.2, 0, 1);
      c.fillStyle = COL.graphite;
      for (var xx = P.x; xx <= P.x + P.w * prog; xx += 3) { var yy = lineY(Math.pow(10, view.l + (xx - P.x) / P.w * (view.r - view.l))); if (yy > P.y && yy < P.y + P.h) c.fillRect(xx, yy, 1, 1); }
      if (prog < 1) staticDirty = true;
      if (!G.gpt3 && prog >= 1) { c.strokeStyle = COL.graphite; c.lineWidth = 1; c.beginPath(); c.arc(X(log10(CFG.gpt3C)), lineY(CFG.gpt3C), 2.5, 0, Math.PI * 2); c.stroke(); }
    }
    if (G.gpt3 && !(moment && moment.kind === 'gpt3')) { c.fillStyle = COL.ink; c.beginPath(); c.arc(X(log10(CFG.gpt3C)), lineY(CFG.gpt3C), 2.5, 0, Math.PI * 2); c.fill(); }
    // your dots first claim their space, so labels step around them
    G.dots.forEach(function (d) { var dx = X(log10(d.C)), dy = Y(Math.log(d.L)); taken.push({ x: dx - 5, y: dy - 5, w: 10, h: 10 }); });
    // rivals: dashed ladders, dots only where they published, the latest labelled with name and size
    if (G.rivalsShown) G.rivals.forEach(function (rv) {
      c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath();
      rv.pubs.forEach(function (p, i) { var px = X(log10(p.C)), py = Y(Math.log(p.L)); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.stroke(); c.setLineDash([]);
      c.fillStyle = COL.graphite; rv.pubs.forEach(function (p) { c.beginPath(); c.arc(X(log10(p.C)), Y(Math.log(p.L)), 1.5, 0, Math.PI * 2); c.fill(); });
      var lp = rv.pubs[rv.pubs.length - 1];
      setFont(c, 10, MONO, 'italic'); c.textBaseline = 'alphabetic';
      var lbl = rv.name + ' · ' + R.sizeLabel(lp.C), lw = c.measureText(lbl).width, px0 = X(log10(lp.C)), py0 = Y(Math.log(lp.L));
      var cands = [];
      [-5, 13, -17, 25, -29, 37, -41].forEach(function (dy) { cands.push([px0 + 5, py0 + dy]); cands.push([px0 - lw - 5, py0 + dy]); });
      var best = null, bestA = Infinity;
      for (var ci = 0; ci < cands.length; ci++) {
        var cx = clamp(cands[ci][0], P.x + 2, P.x + P.w - lw - 2), cy = clamp(cands[ci][1], P.y + 10, ry - 6), rr = { x: cx - 3, y: cy - 10, w: lw + 6, h: 13 };
        var ov = overlapArea(taken, rr); if (ov < bestA) { bestA = ov; best = rr; } if (!ov) break;
      }
      if (bestA > 0 && rv.passed) return;   // no room: a rival you have passed keeps its ladder and loses its label
      taken.push(best);
      c.textAlign = 'left'; halo(c, lbl, best.x + 3, best.y + 10, rv.passed ? COL.grid : COL.graphite);
      if (rv.passed) { c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); var tx0 = best.x - 6; c.moveTo(tx0, best.y + 4); c.lineTo(tx0 + 2, best.y + 7); c.lineTo(tx0 + 6, best.y); c.stroke(); }
    });
    // finished curves at 35% ink
    c.save(); c.beginPath(); c.rect(P.x, P.y - 2, P.w, P.h + 4); c.clip();
    c.strokeStyle = ownCol(0.35); c.lineWidth = 1; c.lineJoin = 'round';
    G.runs.forEach(function (run) { curvePath(c, run); c.stroke(); });
    c.restore();
    // your line: solid between your dots, dotted on to the edge once two sit a decade apart
    drawOwnLine(c, INK);
    G.dots.forEach(function (d) {
      var dx = X(log10(d.C)), dy = Y(Math.log(d.L));
      c.fillStyle = INK; c.beginPath(); c.arc(dx, dy, 2.5, 0, Math.PI * 2); c.fill();
      if (d.pub) { c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(dx, dy, 4.5, 0, Math.PI * 2); c.stroke(); }
      if (d.ship) { c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(dx + 6, dy - 3); c.lineTo(dx + 6, dy + 3); c.stroke(); }
    });
    // the words written on dots: first authors in ink, scandals in pencil (these stay all year)
    setFont(c, 14, HAND, '500'); c.textAlign = 'left'; c.textBaseline = 'top';
    G.dots.forEach(function (d) {
      var dx = X(log10(d.C)), dy = Y(Math.log(d.L));
      [[d.surname, INK], [d.scandal, COL.graphite]].forEach(function (pair) {
        if (!pair[0]) return;
        var w = c.measureText(pair[0]).width, cands = [[dx + 7, dy + 4], [dx + 7, dy - 20], [dx - w - 7, dy + 4], [dx - w - 7, dy - 20], [dx - w / 2, dy + 18], [dx - w / 2, dy - 34]], best = null;
        var free = false;
        for (var i = 0; i < cands.length; i++) { var r = { x: clamp(cands[i][0], P.x + 2, P.x + P.w - w - 2), y: clamp(cands[i][1], P.y + 4, ry - 18), w: w, h: 15 }; if (!hits(taken, r)) { best = r; free = true; break; } if (!best) best = r; }
        if (!free && pair[1] !== INK) return;   // a cramped sheet keeps first authors; a scandal with no room stays on its first dot
        taken.push(best); halo(c, pair[0], best.x, best.y, pair[1]);
      });
    });
    G.rings.forEach(function (r) { c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.arc(X(log10(r.C)), Y(Math.log(r.L)), 3, 0, Math.PI * 2); c.stroke(); });
    // hangs: the hour in pencil by the pen, circled when Tom is on staff. The latest stays Graphite; older hours fade to
    // Grid, and an hour with no room left shrinks to a small pencil ring on the curve, so a year of 3 AMs stays legible.
    setFont(c, 13, HAND, '500'); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    var nH = G.hangMarks.length;
    G.hangMarks.forEach(function (h, i) {
      var hx = X(h.lc), hy = Y(h.lnL);
      if (hx < P.x || hx > P.x + P.w) return;
      var tw = c.measureText(h.time).width, latest = i === nH - 1, col = latest ? COL.graphite : COL.grid;
      var r = { x: hx + 2, y: hy - 22, w: tw + 10, h: 18 };
      if (r.x + r.w > P.x + P.w) r.x = hx - r.w - 2;
      h.rect = null;
      if (latest || !hits(taken, r)) {
        taken.push(r); h.rect = r;
        halo(c, h.time, r.x + 5, r.y + 13, col);
        if (h.tom) { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.ellipse(r.x + r.w / 2, r.y + 9, r.w / 2 + 1, 8.5, -0.06, 0, Math.PI * 2); c.stroke(); }
      } else { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.arc(hx, hy - 5, 2, 0, Math.PI * 2); c.stroke(); }
    });
    if (G.notes.some(function (n) { return !n.dead && n.at && n.at.mark; })) placeNotes();
  }
  function wrapLines(c, text, maxW, maxLines) {
    var words = text.split(' '), line = '', out = [];
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(t).width > maxW && line) { out.push(line); line = words[i]; if (out.length >= maxLines) return out; }
      else line = t;
    }
    if (line && out.length < maxLines) out.push(line);
    return out;
  }
  function drawOwnLine(c, INK) {
    var ds = G.dots.slice().sort(function (a, b) { return a.C - b.C; }), P = L.plot;
    if (ds.length < 2) return;
    c.strokeStyle = INK; c.lineWidth = 1; c.beginPath();
    c.moveTo(X(log10(ds[0].C)), Y(Math.log(ds[0].L))); c.lineTo(X(log10(ds[ds.length - 1].C)), Y(Math.log(ds[ds.length - 1].L))); c.stroke();
    if (hasLine()) {
      var f = ds[ds.length - 1], ratio = f.L / R.Lline(f.C); c.fillStyle = INK;
      for (var ex = X(log10(f.C)) + 4; ex <= P.x + P.w; ex += 4) { var cc = Math.pow(10, view.l + (ex - P.x) / P.w * (view.r - view.l)), ey = Y(Math.log(R.Lline(cc) * ratio)); if (ey > P.y && ey < P.y + P.h) c.fillRect(ex, ey, 1, 1); }
    }
  }
  function runBar(c, run, endDay, INK) {
    var y = L.ruler.y + L.ruler.h - 13, x0 = DX(run.launchDay), x1 = Math.max(DX(endDay), x0 + 1.5);
    if (run.crossed) { c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(x0 + 0.5, y - 1.5, Math.max(1, x1 - x0 - 1), 2); }
    else { c.fillStyle = INK; c.fillRect(x0, y - 1, x1 - x0, 2); }
    c.fillStyle = COL.paper; run.hangs.forEach(function (h) { var hx = DX(h.start); if (hx < x1) c.fillRect(Math.round(hx), y - 2, 1, 4); });
  }
  function drawHatch(c, x0, x1, sc) {
    var P = L.plot, u = sc && sc.t0 != null && !reduced() ? clamp((now - sc.t0) / 0.9, 0, 1) : 1;
    if (u < 1) staticDirty = true;
    c.save(); c.beginPath(); c.rect(Math.max(x0, P.x), P.y, Math.min(x1, P.x + P.w) - Math.max(x0, P.x), P.h); c.clip();
    c.strokeStyle = COL.verm; c.lineWidth = 1; c.beginPath();
    // the hatch is drawn left to right as the landing reads past the wall (900 ms), then stays
    var reach = x0 - P.h + (x1 - x0 + 2 * P.h) * u;
    for (var k = -P.h; k < x1 - x0 + P.h; k += 6) { if (x0 + k > reach) break; c.moveTo(x0 + k, P.y + P.h); c.lineTo(x0 + k + P.h, P.y); }
    c.stroke(); c.restore();
  }
  function curvePath(c, run) { c.beginPath(); for (var i = 0; i < run.pts.length; i++) { var p = run.pts[i], x = X(p.x), y = Y(p.y); if (i) c.lineTo(x, y); else c.moveTo(x, y); } }
  function draw() {
    if (staticDirty) drawStatic();
    var c = ctx, INK = ownCol(1);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (G.powered) {
      var P = L.plot, rb = L.ruler.y + L.ruler.h, run = G.run;
      if (run) {
        runBar(c, run, G.day, INK);
        c.save(); c.beginPath(); c.rect(P.x, P.y - 2, P.w, P.h + 4); c.clip();
        c.strokeStyle = INK; c.lineWidth = 1.5; c.lineJoin = 'round'; c.lineCap = 'round';
        curvePath(c, run); c.stroke();
        var lp = run.pts[run.pts.length - 1];
        if (lp) { c.fillStyle = INK; c.beginPath(); c.arc(X(lp.x), Y(lp.y), 2.5, 0, Math.PI * 2); c.fill(); }
        c.restore();
      }
      var tx = Math.round(DX(Math.min(G.day, CFG.endDay))) + 0.5;
      c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, L.ruler.y + 2); c.lineTo(tx, rb - 2); c.stroke();
      c.fillStyle = COL.ink; c.beginPath(); c.moveTo(tx, rb - 4); c.lineTo(tx - 4, rb); c.lineTo(tx + 4, rb); c.closePath(); c.fill();
      if (drag) {
        var C = dragC(), mx = X(log10(C)), ratio = 1, ds = G.dots.slice().sort(function (a, b) { return a.C - b.C; });
        if (ds.length) ratio = ds[ds.length - 1].L / R.Lline(ds[ds.length - 1].C);
        var my = Y(Math.log(R.Lline(C) * ratio)), hollow = hasBeliever() && C > drag.st.horC;
        c.strokeStyle = COL.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx, my - 6); c.lineTo(mx, my + 6); c.stroke();
        if (hollow) { c.lineWidth = 1; c.beginPath(); c.arc(mx, my, 3.5, 0, Math.PI * 2); c.stroke(); }
        c.strokeStyle = COL.ink; c.setLineDash([2, 2]); c.lineWidth = 2; var by = rb - 13; c.beginPath(); c.moveTo(DX(G.day), by); c.lineTo(DX(G.day + daysAt(drag.t, drag.st)), by); c.stroke(); c.setLineDash([]);
      }
    }
    drawCluster(c, INK);
    drawStrip(c, INK);
  }
  function drawHi(M) {
    var c = hctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, L.vw, L.vh);
    drawOwnLine(c, COL.ink);
    G.dots.forEach(function (d) { c.fillStyle = COL.ink; c.beginPath(); c.arc(X(log10(d.C)), Y(Math.log(d.L)), 2.5, 0, Math.PI * 2); c.fill(); });
    var u = clamp((now - M.t0 - 0.4) / 0.3, 0, 1), gx = X(log10(CFG.gpt3C)), gy = lineY(CFG.gpt3C);
    c.fillStyle = COL.ink; c.globalAlpha = u; c.beginPath(); c.arc(gx, gy, 2.5 + 5 * (1 - u), 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    if (M.kind === 'miracle') { var f = G.dots.slice().sort(function (a, b) { return b.C - a.C; })[0]; if (f) { c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.arc(X(log10(f.C)), Y(Math.log(f.L)), 4.5 + 4 * (1 - u), 0, Math.PI * 2); c.stroke(); } }
  }

  /* ---------------- the cluster band: one cell per card, nodes of 8, pods of 64 ---------------- */
  function cardList() {
    var list = [], i, q = G.queueCut;
    function push(k, n, u) { for (var j = 0; j < n; j++) list.push(u != null ? { k: k, u: u } : k); }
    var ln = lentN();
    push('own', Math.max(0, G.owned - ln)); push('a100', G.ownedA100); push('lent', ln);
    G.orders.forEach(function (o) { push('order', o.n, clamp((G.day - o.at) / (o.arrive - o.at), 0, 1)); });
    push('rent', rentedN());
    var pend = 0; G.rentals.forEach(function (r) { if (G.day < r.start) pend += r.n; }); push('rentPending', pend);
    if (G.mer) { if (G.day < G.mer.live) push('merPending', G.mer.cards, clamp((G.day - (G.mer.signed || G.day)) / Math.max(1, G.mer.live - (G.mer.signed || G.day)), 0, 1)); else { push('mer', G.mer.cards - q); push('queue', q); } }
    var sv = servingN();
    for (i = list.length - 1; i >= 0 && sv > 0; i--) { var k = list[i]; if (k === 'own' || k === 'rent' || k === 'mer' || k === 'a100') { list[i] = 'serve'; sv--; } }
    return { list: list, training: !!(G.run && !G.run.hang && G.phase !== 'moment' && !G.over), hung: !!(G.run && G.run.hang) };
  }
  var clusterUnit = 1, clusterFree = null, clusterMorph = null;
  function drawCluster(c, INK) {
    var B = L.cluster;
    var CL = cardList(), cards = CL.list, n = cards.length;
    if (!G.powered) {
      // asleep: eight pale cells; one breathes on 1.2 s, the rest on 4 s
      var still = reduced();
      for (var a = 0; a < CFG.ownedStart; a++) { var br = still ? (a === 3 ? 1 : 0.5) : a === 3 ? 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 1.2) : 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 4); cellAt(c, a, 'pale', 2, B, CL, br, INK); }
      if (elCount.textContent) elCount.textContent = ''; return;
    }
    var unit = n <= 128 ? 1 : n <= 2048 ? 8 : 64, rows = unit === 1 ? 2 : 4;
    // when the unit changes, eight cells close into one over 600 ms (the old grouping fades as the new one inks in)
    if (unit !== clusterUnit) { if (G.firstLift && !reduced()) { snd.whirr(0.6); clusterMorph = { from: clusterUnit, t0: now }; } clusterUnit = unit; }
    var mu = clusterMorph ? clamp((now - clusterMorph.t0) / 0.6, 0, 1) : 1;
    if (clusterMorph && mu < 1) {
      var fu = clusterMorph.from, frows = fu === 1 ? 2 : 4;
      c.globalAlpha = 1 - mu;
      for (var fi = 0, fg = 0; fi < n; fi += fu, fg++) { if (fg >= frows * clusterCols(B)) break; cellAt(c, fg, cards[fi], frows, B, CL, 0, INK); }
      c.globalAlpha = 1;
    } else clusterMorph = null;
    var inkT = now - (G.powerT0 || 0);
    if (mu < 1) c.globalAlpha = mu;
    for (var i = 0, g = 0; i < n; i += unit, g++) {
      if (g >= rows * clusterCols(B)) break;
      if (unit === 1 && i < 8 && inkT < 0.06 * (i + 1)) { cellAt(c, g, 'pale', rows, B, CL, 0.5, INK); continue; }
      cellAt(c, g, cards[i], rows, B, CL, 0, INK);
    }
    c.globalAlpha = 1;
    var cols = clusterCols(B), pitch = B.w / cols, gapY = rows === 2 ? Math.max(2, B.h - 2 * Math.min(22, (B.h - 4) / 2)) : 2.6, ch = (B.h - (rows - 1) * gapY) / rows;
    var lastRow = Math.floor(Math.max(0, g - 1) / cols), inLast = g - lastRow * cols;
    if (lastRow < rows - 1 && ch >= 7) clusterFree = { x: B.x, y: B.y + (lastRow + 1) * (ch + gapY), w: B.w, h: ch };
    else if ((cols - inLast) * pitch >= 130 && ch >= 7) clusterFree = { x: B.x + inLast * pitch + 8, y: B.y + lastRow * (ch + gapY), w: (cols - inLast) * pitch - 8, h: ch };
    else clusterFree = null;
    var cnt = fmtInt(cardsShown()); if (elCount.textContent !== cnt) elCount.textContent = cnt;
  }
  function clusterCols(B) { return Math.max(64, Math.floor(B.w / Math.min(B.w / 64, 9))); }
  function cellAt(c, i, kind, rows, B, CL, breath, INK) {
    var cols = clusterCols(B), pitch = B.w / cols, gapY = rows === 2 ? Math.max(2, B.h - 2 * Math.min(22, (B.h - 4) / 2)) : 2.6, ch = (B.h - (rows - 1) * gapY) / rows, cw = Math.max(1.5, pitch * 0.87);
    var col = i % cols, row = Math.floor(i / cols), x = B.x + col * pitch, y = B.y + row * (ch + gapY);
    var k = typeof kind === 'string' ? kind : kind.k, u = typeof kind === 'string' ? 0 : kind.u, A0 = c.globalAlpha;
    if (k === 'pale') { c.strokeStyle = COL.grid; c.globalAlpha = A0 * (0.55 + 0.45 * breath); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); c.globalAlpha = A0; return; }
    var glow = CL.training && !G.dark && (k === 'own' || k === 'a100' || k === 'rent' || k === 'mer');
    if (k === 'own' || k === 'a100') { c.fillStyle = INK; c.fillRect(x, y, cw, ch); if (k === 'a100' && cw > 2) { c.strokeStyle = COL.paper; c.lineWidth = 1; c.strokeRect(x + 1.5, y + 1.5, Math.max(0.5, cw - 3), ch - 3); } }
    else if (k === 'rent' || k === 'mer' || k === 'rentPending') { c.strokeStyle = INK; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, Math.max(0.5, cw - 1), ch - 1); if (k === 'mer') { c.fillStyle = INK; c.fillRect(x + cw / 2 - 0.5, y + ch / 2 - 0.5, 1, 1); } }
    else if (k === 'merPending') { c.strokeStyle = COL.graphite; c.globalAlpha = A0 * (0.35 + 0.65 * u); c.setLineDash([1.5, 1.5]); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, Math.max(0.5, cw - 1), ch - 1); c.setLineDash([]); c.fillStyle = COL.graphite; c.fillRect(x + cw / 2 - 0.5, y + ch / 2 - 0.5, 1, 1); c.globalAlpha = A0; }
    else if (k === 'queue') { c.strokeStyle = COL.graphite; c.setLineDash([1.5, 1.5]); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, Math.max(0.5, cw - 1), ch - 1); c.setLineDash([]); }
    else if (k === 'order') { c.strokeStyle = COL.graphite; c.globalAlpha = A0 * (0.2 + 0.8 * u); c.setLineDash([1.5, 1.5]); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, Math.max(0.5, cw - 1), ch - 1); c.setLineDash([]); c.globalAlpha = A0; }
    else if (k === 'serve') { c.fillStyle = COL.grid; c.fillRect(x, y, cw, ch); }
    else if (k === 'lent') { c.strokeStyle = COL.grid; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, Math.max(0.5, cw - 1), ch - 1); c.beginPath(); c.moveTo(x + 0.5, y + ch - 0.5); c.lineTo(x + cw - 0.5, y + 0.5); c.stroke(); }
    if (glow && !CL.hung) {
      // at the lift the glow sweeps in left to right over 300 ms, flares, then settles and breathes +-6% at 0.5 Hz
      var t0 = G.run ? (G.run.relightT0 || G.run.liftT0) : now, red = reduced(), sweep = red ? 1 : clamp(((now - t0) / 0.3) * cols - col, 0, 1);
      if (sweep > 0) {
        var since = now - t0 - 0.3 * col / cols, flare = red ? 0 : clamp(1 - since / 0.5, 0, 1);
        c.fillStyle = COL.fil; c.globalAlpha = A0 * Math.min(1, (0.8 + (red ? 0 : 0.05 * Math.sin(now * Math.PI)) + 0.2 * flare)) * sweep;
        var gw = (k === 'own' || k === 'a100') ? clamp(cw - 2, 1, 3) : clamp(cw - 3, 1, 2); c.fillRect(x + (cw - gw) / 2, y + 3, gw, ch - 6);
        c.globalAlpha = A0;
      }
    }
  }
  /* ---------------- the bet strip: a home end where the nib rests, then travel that is time ---------------- */
  function nibRestX() { return L.strip.x + L.strip.home * 0.5; }
  function drawStrip(c, INK) {
    var S = L.strip, T = L.travel;
    c.strokeStyle = COL.grid; c.lineWidth = 1; c.beginPath(); c.moveTo(S.x, Math.round(S.y) + 0.5); c.lineTo(S.x + S.w, Math.round(S.y) + 0.5); c.moveTo(S.x, Math.round(S.y + S.h) - 0.5); c.lineTo(S.x + S.w, Math.round(S.y + S.h) - 0.5); c.stroke();
    c.fillStyle = COL.reserve; c.fillRect(T.x, S.y + 6, T.w, S.h - 12);
    var st = drag ? drag.st : (G.powered && !G.over ? stopInfo() : null);
    if (st && st.ok) {
      if (!drag) {
        var tgt = st.T;
        if (!stopShown.T) stopShown.T = tgt;
        else if (Math.abs(stopShown.T - tgt) > 1e-6 && (!stopShown.anim || stopShown.anim.to !== tgt)) {
          // the travel re-maps over 400 ms with the paper-feed whirr when the stop moves (not for the calendar's own creep)
          var big = Math.abs(stopShown.T - tgt) / Math.max(stopShown.T, tgt) > 0.02;
          if (big) { stopShown.anim = { from: stopShown.T, to: tgt, t0: now }; if (G.firstLift && !G.run) snd.whirr(0.4); } else stopShown.T = tgt;
        }
        var A = stopShown.anim; if (A) { var uu = reduced() ? 1 : clamp((now - A.t0) / 0.4, 0, 1); stopShown.T = A.from + (A.to - A.from) * ease(uu); if (uu >= 1) stopShown.anim = null; }
      }
      var Tshow = drag ? st.T : stopShown.T, span = Math.max(1e-6, Tshow - CFG.minDays), pxPerDay = T.w / span;
      var step = pxPerDay >= 4 ? 1 : 7;
      if (pxPerDay * step >= 3) { c.strokeStyle = COL.grid; c.beginPath(); for (var dd = step; dd < Tshow; dd += step) { var x = Math.round(T.x + (dd - CFG.minDays) * pxPerDay) + 0.5; if (x <= T.x + 1) continue; c.moveTo(x, S.y + S.h - 14); c.lineTo(x, S.y + S.h - 6); } c.stroke(); }
      setFont(c, 9, MONO); c.fillStyle = COL.graphite; c.textAlign = 'left'; c.textBaseline = 'top';
      for (var m = R.monthOf(G.day) + 1; m < 12; m++) {
        var dp = R.firstOfMonth(m) - G.day; if (dp > Tshow) break; if (dp < CFG.minDays) continue;
        var px = Math.round(T.x + (dp - CFG.minDays) * pxPerDay) + 0.5;
        c.strokeStyle = COL.graphite; c.beginPath(); c.moveTo(px, S.y + 2); c.lineTo(px, S.y + S.h - 2); c.stroke();
        c.fillText(R.MON[m][0], px + 3, S.y + 7);
      }
    }
    var t = drag ? drag.t : 0, nx = clamp(drag ? (drag.x != null ? drag.x : nibX(t)) : nibRestX(), S.x + 6, T.x + T.w - 6);
    if (drag && nx > T.x) { c.fillStyle = INK; c.fillRect(T.x, S.y + 6, nx - T.x, S.h - 12); }
    var nibCol = G.powered ? INK : COL.graphite;
    if (!G.powered && !reduced()) { c.globalAlpha = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 4)); }
    c.fillStyle = nibCol; c.fillRect(Math.round(nx - 6), S.y, 12, S.h); c.globalAlpha = 1;
  }

  /* ================================================================
     INPUT
     ================================================================ */
  var ptr = null;
  function inRect(x, y, r, pad) { pad = pad || 0; return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad; }
  function onNib(x, y) { var S = L.strip; return y >= S.y - 10 && y <= S.y + S.h + 10 && x >= S.x - 4 && x <= L.travel.x + CFG.nibHit / 2; }
  function onDown(e) {
    if (ptr) return;
    var x = e.clientX, y = e.clientY;
    snd.start();
    if (!G.powered) { powerOn(); e.preventDefault(); return; }
    if (G.letter && !elLetter.hidden && inRect(x, y, elLetter.getBoundingClientRect(), 6)) {
      ptr = { id: e.pointerId, x0: x, y0: y, mode: 'letter', last: [{ x: x, y: y, t: performance.now() }] };
      flick = { dy: 0 }; letterAnim = null;
      try { root.setPointerCapture(e.pointerId); } catch (er) { }
      e.preventDefault(); return;
    }
    if (G.over) return;
    if (onNib(x, y) && canBet()) {
      if (beginDrag(x, y)) { ptr = { id: e.pointerId, mode: 'drag' }; showReadout(x, y); try { root.setPointerCapture(e.pointerId); } catch (er) { } e.preventDefault(); return; }
    }
    if (G.cp && y >= L.band.y - 10 && y <= L.band.y + L.band.h + 4 && x >= L.band.x - 8 && x <= L.band.x + L.band.w + 8) {
      ptr = { id: e.pointerId, x0: x, y0: y, mode: 'cp', last: [{ x: x, y: y, t: performance.now() }] };
      try { root.setPointerCapture(e.pointerId); } catch (er) { }
      e.preventDefault(); return;
    }
    if (y >= L.paper.y && y <= L.paper.bottom && G.phase === 'pour') { tapSample(); e.preventDefault(); return; }
  }
  function onMove(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var x = e.clientX, y = e.clientY;
    if (ptr.mode === 'letter') {
      flick.dy = clamp(y - ptr.y0, -140, 90);
      ptr.last.push({ x: x, y: y, t: performance.now() }); if (ptr.last.length > 6) ptr.last.shift();
      placeLetter();
    } else if (ptr.mode === 'drag') { moveDrag(x, y); showReadout(x, y); }
    else if (ptr.mode === 'cp') {
      ptr.last.push({ x: x, y: y, t: performance.now() }); if (ptr.last.length > 6) ptr.last.shift();
      elSample.style.transform = 'translate(' + clamp(x - ptr.x0, 0, 120) + 'px,' + clamp(y - ptr.y0, -80, 0) + 'px)';
    }
    e.preventDefault();
  }
  function flickDir(p, e) {
    var a = p.last[0], b = p.last[p.last.length - 1], dt = Math.max(1, b.t - a.t), vy = (b.y - a.y) / dt, vx = (b.x - a.x) / dt;
    var dy = e.clientY - p.y0, dx = e.clientX - p.x0;
    if ((dx > CFG.flickPx || vx > CFG.flickVel) && Math.abs(dx) > Math.abs(dy)) return 'right';
    if (dy < -CFG.flickPx || vy < -CFG.flickVel) return 'up';
    if (dy > CFG.flickPx || vy > CFG.flickVel) return 'down';
    return null;
  }
  function onUp(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var p = ptr; ptr = null;
    try { root.releasePointerCapture(e.pointerId); } catch (er) { }
    if (p.mode === 'letter') {
      var dir = flickDir(p, e); if (dir === 'right') dir = null;
      var ok = dir ? resolveLetter(dir) : false;
      if (!ok && G.letter) { var y0 = letterY(); flick = null; letterAnim = { kind: 'back', t0: now, y0: y0 }; }
      flick = null; return;
    }
    if (p.mode === 'drag') { endDrag(); return; }
    if (p.mode === 'cp') {
      var d2 = flickDir(p, e), done = false;
      if (d2 === 'up' || d2 === 'right') done = flickCheckpoint(d2);
      if (!done && !bandFly) elSample.style.transform = '';
    }
  }
  function onCancel(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var p = ptr; ptr = null;
    if (p.mode === 'drag') endDrag();   // pointercancel counts as a lift
    else if (p.mode === 'letter') { flick = null; letterAnim = { kind: 'back', t0: now, y0: letterY() }; }
    else if (p.mode === 'cp') elSample.style.transform = '';
  }
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onCancel);
  root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  root.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (e.target && e.target.closest && e.target.closest('#fr')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  elMute.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  elMute.addEventListener('click', function (e) { e.stopPropagation(); snd.start(); snd.setMuted(!snd.muted); syncMute(); });
  function syncMute() { elMute.textContent = snd.muted ? 'SOUND OFF' : 'SOUND ON'; elMute.setAttribute('aria-pressed', snd.muted ? 'true' : 'false'); }
  syncMute();
  document.addEventListener('keydown', function (e) {
    var k = e.key, tgt = e.target;
    if (tgt && tgt.classList && tgt.classList.contains('fr-name') && (k === 'Enter' || k === ' ')) return;
    if (tgt === elMute && (k === 'Enter' || k === ' ')) return;
    if (!G.powered) { if (k === 'Enter' || k === ' ' || k.indexOf('Arrow') === 0) { powerOn(); e.preventDefault(); } return; }
    if (G.over) return;
    if (/^[1-9]$/.test(k)) { var p = G.people[+k - 1]; if (p) pressName(p.id); e.preventDefault(); return; }
    if (G.letter && !letterAnim && (k === 'ArrowUp' || k === 'ArrowDown')) { resolveLetter(k === 'ArrowUp' ? 'up' : 'down'); e.preventDefault(); return; }
    if ((k === 'p' || k === 'P') && !G.letter) { flickCheckpoint('up'); e.preventDefault(); return; }
    if (k === 'ArrowRight' && !G.letter && !drag && G.cp && canShip(G.cp)) { flickCheckpoint('right'); e.preventDefault(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      if (!drag && canBet()) { if (!beginDrag(0, 0, true)) return; }
      if (drag && drag.kb) {
        var stp = e.shiftKey ? CFG.keyStepShift : CFG.keyStep;
        if (!drag.snapped) drag.t = clamp(drag.t + (k === 'ArrowRight' ? stp : -stp), 0, 1);
        updateDragNotes(); showReadout(nibX(drag.t), L.strip.y);
        e.preventDefault();
      }
      return;
    }
    if ((k === 'Enter' || k === ' ') && drag && drag.kb) { endDrag(); e.preventDefault(); return; }
    if ((k === 'Enter' || k === ' ') && !drag && canBet() && tgt === elFocus) { if (beginDrag(0, 0, true)) endDrag(); e.preventDefault(); return; }
    if (k === 's' || k === 'S') { tapSample(); e.preventDefault(); }
  });
  // a thumb that leaves (the tab hides, the window blurs) lifts: every lift launches. A held letter or checkpoint goes back.
  function letGo() {
    if (!ptr) return;
    var p = ptr; ptr = null;
    if (p.mode === 'drag') endDrag();
    else if (p.mode === 'letter') { flick = null; if (G.letter) letterAnim = { kind: 'back', t0: now, y0: letterY() }; }
    else if (p.mode === 'cp') elSample.style.transform = '';
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { letGo(); snd.sleep(); } else { snd.wake(); lastTs = 0; } });
  window.addEventListener('blur', letGo);
  var relayT = 0;
  function relayout() { cancelAnimationFrame(relayT); relayT = requestAnimationFrame(function () { layout(); }); }
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', function () { setTimeout(relayout, 120); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);

  /* ================================================================
     THE LOOP
     ================================================================ */
  function motorForPhase() {
    if (!G.powered || G.over) return;
    if (G.run && !G.run.hang) snd.motor('train', trainingEq(), 0.3); else if (!G.run) snd.motor('idle', 0, 0.3);
  }
  function update(dt) {
    now += dt;
    runTimers();
    stepView();
    if (clockRuns()) stepDays(dayRate() * dt);
    if (G.letter) stepFuse();
    if (!G.letter && G.wait.length && !letterAnim && !G.over) showLetter(G.wait.shift());
    if (G.heldDone && !G.cp && !moment && G.phase !== 'land' && G.phase !== 'drag' && !G.over) { G.cp = G.heldDone; G.heldDone = null; showBand(G.cp.smp, 'instant'); }
    stepBand(); stepMoment(); stepHeads(); stepNotes(); stepNames();
    if (G.run && !G.run.hang && G.phase === 'pour') snd.scratch(0.25); else snd.scratch(0);
  }
  var perfLog = [];
  function frame(ts) {
    var dtReal = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0.016; lastTs = ts;
    var total = dtReal * speedMul;
    var p0 = performance.now();
    while (total > 1e-9) { var d = Math.min(total, 0.05); update(d); total -= d; }
    var p1 = performance.now();
    placeLetter();
    updateTop();
    stepBoxes();
    var p2 = performance.now(), wasDirty = staticDirty;
    draw();
    var p3 = performance.now();
    perfLog.push([p1 - p0, p2 - p1, p3 - p2, wasDirty ? 1 : 0]); if (perfLog.length > 240) perfLog.shift();
    requestAnimationFrame(frame);
  }

  /* ================================================================
     TEST HOOK (playtesters and bots)
     ================================================================ */
  function stateObj() {
    var st = G.powered && !G.over ? stopInfo() : null, lr = G.runs[G.runs.length - 1];
    return {
      version: CFG.version, seed: G.seed, date: R.fmtDay(Math.min(G.day, CFG.endDay - 1e-6), true), day: +G.day.toFixed(3), month: G.month, phase: G.phase, powered: G.powered, firstLift: G.firstLift,
      bank: Math.round(G.bank), months: +monthsLeft().toFixed(2), monthsShown: elMN.textContent, burn: Math.round(burn()), payroll: payroll(), stake: +G.stake.toFixed(4),
      cards: { shown: cardsShown(), owned: G.owned, ownedA100: G.ownedA100, ordered: G.orders.reduce(function (a, o) { return a + o.n; }, 0), rented: rentedN(), meridian: G.mer ? G.mer.cards : 0, meridianLive: merLive(), queueCut: G.queueCut, lent: lentN(), serving: servingN(), trainingEq: +trainingEq().toFixed(1) },
      people: G.people.map(function (p) { return { id: p.id, role: p.role, salary: p.salary, mood: p.mood, gone: p.gone, why: p.why || null }; }),
      runs: G.runs.length, running: G.run ? { C: G.run.C, T: G.run.T, s: +G.run.s.toFixed(4), q: +qOf(G.run).toFixed(4), hung: !!G.run.hang, r: +(G.run.D / G.Dwall).toFixed(3) } : null,
      lastRun: lr ? { C: lr.C, T: lr.T, crossed: lr.crossed, L: lr.L, landDay: lr.landDay, r: +(lr.D / G.Dwall).toFixed(3), blind: lr.blind, b: lr.b } : null,
      lastSample: G.sample ? { text: G.sample.text, fray: G.sample.fray, crawl: G.sample.crawl, tier: G.sample.tier, kind: G.sample.kind, cap: G.sample.cap } : null,
      wall: { Cwall: G.Cwall, W: G.W, filters: G.filters, filtering: G.filter ? +(G.filter.end - G.day).toFixed(1) : null, priyaOffer: offerStands() ? (G.priyaOffer ? G.priyaOffer.amt : (G.sample && G.sample.crawl ? 6 : G.sample ? G.sample.fray : 0)) : 0 },
      dots: G.dots.map(function (d) { return { C: d.C, L: +d.L.toFixed(4), day: Math.floor(d.day), onLine: onLine(d), pub: d.pub, ship: d.ship, pending: !!d.pending, scandal: d.scandal, surname: d.surname }; }),
      farthestClean: farthestClean(), checkpoint: G.cp ? { C: G.cp.dot.C, canPublish: G.day >= CFG.publishFrom, canShip: canShip(G.cp), redTeamed: !!G.cp.redTeamed } : null, redTeam: G.held ? +(G.held.end - G.day).toFixed(1) : null,
      scars: G.scars.length, hangs: G.hangMarks.length,
      bet: st ? { Tstop: st.T, bind: st.bind, ok: st.ok, Cstop: st.T * st.F, flopsPerDay: st.F } : null,
      letter: G.letter ? { id: G.letter.id, kind: G.letter.kind, from: G.letter.from, offer: G.letter.offer, up: G.letter.up, down: G.letter.down, grey: !!G.letter.grey, forced: !!G.letter.forced, fuseLeft: +G.letter.fuseLeft.toFixed(2) } : null,
      waiting: G.wait.map(function (w) { return w.id; }), silent: G.silent,
      raised: { A: G.A.taken, B: G.B.taken, needA: G.A.need, proofA: proofA(), proofB: proofB() }, meridian: G.mer ? { live: G.mer.live, credits: Math.round(G.mer.credits) } : null, api: G.api ? { revenue: G.api.revenue } : null,
      rivals: G.rivals.map(function (r) { var lp = r.pubs[r.pubs.length - 1]; return { name: r.name, pubs: r.pubs.length, last: lp.C, passed: r.passed }; }), frontier: frontier(), worldView: worldView(),
      caps: G.caps.filter(function (c) { return c.fired; }).map(function (c) { return c.id + (c.contaminated ? '*' : ''); }), gpt3: G.gpt3, miracle: G.miracle, december: G.december,
      over: G.over, geom: { plot: L.plot, strip: L.strip, travel: L.travel, band: L.band, cluster: L.cluster, ruler: L.ruler, vw: L.vw, vh: L.vh,
        letterRect: (!elLetter.hidden ? (function (r) { return { x: r.left, y: r.top, w: r.width, h: r.height }; })(elLetter.getBoundingClientRect()) : null),
        names: G.people.map(function (p) { var r = nameRect(p.id); if (!r) return null; return { id: p.id, x: r.left + r.width / 2, y: r.top + r.height / 2, gone: p.gone }; }).filter(Boolean) },
      log: G.log.slice(-30)
    };
  }
  function act(name, a) {
    a = a || {};
    switch (name) {
      case 'start': case 'power': { var was = G.powered; powerOn(); if (!was && a.instant !== false) { now += 1.1; runTimers(); } return true; }
      case 'take': case 'raise': case 'pass': {
        if (!G.letter) return false;
        if (name === 'raise' && G.letter.kind !== 'term') return false;
        var okr = resolveLetter(name === 'pass' ? 'down' : 'up');
        if (a.fast) { letterAnim = null; elLetter.hidden = true; if (!G.letter && G.wait.length && !G.over) { showLetter(G.wait.shift()); letterAnim = null; } }
        return okr;
      }
      case 'hire': if (G.letter && G.letter.hireId === a.id) return resolveLetter('up'); if (a.force) { addPerson(a.id); return true; } return false;
      case 'rent': if (G.letter && G.letter.id === 'brokerRent') return resolveLetter('up'); if (a.force) { G.rentals.push({ n: a.gpus || 64, price: rentPriceNow(), start: G.day, end: G.day + CFG.rentTermDays }); return true; } return false;
      case 'buy': if (G.letter && /^buy/.test(G.letter.id)) return resolveLetter('up'); return false;
      case 'launch': {
        if (!canBet()) return false;
        var st = stopInfo(); if (!st.ok) return false;
        var T = a.days != null ? a.days : daysAt(a.fraction == null ? 1 : a.fraction, st);
        return launch(T);
      }
      case 'tap': return tapSample();
      case 'publish': return flickCheckpoint('up');
      case 'ship': return flickCheckpoint('right');
      case 'press': pressName(a.id); return true;
      case 'endMonth': {
        if (!G.powered || G.over || !G.firstLift) return false;
        var m0 = G.month, guard = 0;
        while (G.month === m0 && !G.over && guard++ < 40000) {
          if (G.letter) return 'letter';
          if (moment || G.phase === 'land' || G.phase === 'moment') { now += 0.1; runTimers(); stepMoment(); continue; }
          if (!clockRuns()) break;
          stepDays(0.25);
          if (!G.letter && G.wait.length) { letterAnim = null; showLetter(G.wait.shift()); letterAnim = null; }
        }
        return G.over ? 'over' : 'month';
      }
      case 'step': {
        // advance the calendar up to a.days, stopping at a letter, a landing or the end (for bots)
        if (!G.powered || G.over) return false;
        var target = G.day + (a.days || 1), hadRun = !!G.run, g2 = 0;
        while (G.day < target && !G.over && g2++ < 40000) {
          if (G.letter) return 'letter';
          if (moment || G.phase === 'land' || G.phase === 'moment') { now += 0.1; runTimers(); stepMoment(); continue; }
          if (!clockRuns()) return 'stopped';
          stepDays(Math.min(0.1, target - G.day + 1e-9));
          if (!G.letter && G.wait.length) { letterAnim = null; showLetter(G.wait.shift()); letterAnim = null; }
          if (hadRun && !G.run) { while ((moment || G.phase === 'land') && g2++ < 40000) { now += 0.1; runTimers(); stepMoment(); } return 'landed'; }
        }
        return G.over ? 'over' : 'ok';
      }
      case 'log': return G.log.slice();
      case 'newGame': case 'newYear': newYear(a.seed); layout(); return true;
      default: return false;
    }
  }
  function perfStats() { var n = perfLog.length || 1, a = [0, 0, 0, 0]; perfLog.forEach(function (r) { for (var i = 0; i < 4; i++) a[i] += r[i]; }); return { frames: perfLog.length, updateMs: +(a[0] / n).toFixed(2), domMs: +(a[1] / n).toFixed(2), drawMs: +(a[2] / n).toFixed(2), staticRedraws: a[3] }; }
  window.__frontier = { perf: perfStats, state: stateObj, act: act, speed: function (n) { speedMul = clamp(+n || 1, 0.1, 200); return speedMul; }, config: CFG };

  /* ---------------- go ---------------- */
  newYear();
  layout();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { staticDirty = true; layout(); });
})();
