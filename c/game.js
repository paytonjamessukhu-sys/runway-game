/* FRONTIER: found an AI lab in 2020. Builder C, first playable, built to spec/sim1.json.
   One sheet. The thumb drags the bet, taps the paper, flicks letters and the landing sample, and presses names.
   Numbers in config.js, the model's words in corpus.js, people, letters' copy and history in lab.js. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG, CORPUS = window.FRONTIER_CORPUS, LAB = window.FRONTIER_LAB;
  var $ = function (id) { return document.getElementById(id); };
  var root = $('fr'), cv = $('fr-cv'), ctx = cv.getContext('2d'), cvHi = $('fr-hi'), ctxHi = cvHi.getContext('2d');
  var elDate = $('fr-date'), elLab = $('fr-lab'), elBought = $('fr-bought'), elToday = $('fr-today'), elHour = $('fr-hour'), elRename = $('fr-rename');
  var elMonths = $('fr-months'), elMn = $('fr-mn'), elProj = $('fr-proj'), elHead = $('fr-head'), elNames = $('fr-names'), elBoxes = $('fr-boxes'), elNotes = $('fr-notes');
  var elBand = $('fr-band'), elSample = $('fr-sample'), elReadout = $('fr-readout'), elCards = $('fr-cards'), elFocus = $('fr-nibfocus');
  var elDim = $('fr-dim'), elMoment = $('fr-moment'), elMomentText = $('fr-moment-text'), elLetter = $('fr-letter'), elMute = $('fr-mute'), elSafe = $('fr-safe'), elLive = $('fr-live');
  var LE = { fuse: elLetter.querySelector('.fuse i'), tip: elLetter.querySelector('.fuse b'), sender: elLetter.querySelector('.sender'), offer: elLetter.querySelector('.offer'),
    up: elLetter.querySelector('.eff.up'), down: elLetter.querySelector('.eff.down'), forbid: elLetter.querySelector('.forbid') };

  /* ---------------- colours: one source, the CSS tokens ---------------- */
  var cs = getComputedStyle(document.documentElement);
  function tok(n, d) { var v = (cs.getPropertyValue(n) || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; }
  var COL = { paper: tok('--paper', '#E4E5E1'), ink: tok('--ink', '#15171A'), grid: tok('--grid', '#CCCFCA'), graphite: tok('--graphite', '#6E7378'),
    reserve: tok('--reserve', '#F8F8F5'), fil: tok('--filament', '#FF7A21'), verm: tok('--vermilion', '#E5482E'), dry: tok('--dry', '#A9ACAA') };
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  var RGB = {}; Object.keys(COL).forEach(function (k) { RGB[k] = hex(COL[k]); });
  function rgba(a, al) { var A = RGB[a]; return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + al + ')'; }
  var MONO = (cs.getPropertyValue('--mono') || 'monospace').trim(), SERIF = (cs.getPropertyValue('--serif') || 'serif').trim(), HAND = (cs.getPropertyValue('--hand') || 'cursive').trim();

  /* ---------------- utils ---------------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(u) { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function log10(x) { return Math.log(x) / Math.LN10; }
  function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var hashSeed = (String(location.hash).match(/seed=(\d+)/) || [])[1];
  var seedBase = hashSeed ? (+hashSeed >>> 0) : ((Math.random() * 4294967295) >>> 0);
  var rng = mulberry(seedBase), vis = mulberry(seedBase ^ 0x9E3779B9);
  function U(a, b) { return a + (b - a) * rng(); }
  function gauss() { return Math.sqrt(-2 * Math.log(1 - vis())) * Math.cos(2 * Math.PI * vis()); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function store(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  function trimZ(t) { return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t; }
  function dollars(x) { var a = Math.abs(x); if (a >= 1e9) return '$' + trimZ((a / 1e9).toFixed(1)) + 'B'; if (a >= 1e7) return '$' + Math.round(a / 1e6) + 'M'; return '$' + Math.round(a).toLocaleString('en-US'); }
  function pct(x) { var v = x * 100; return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1)) + '%'; }

  /* ---------------- rules: slice one physics ---------------- */
  var R = {};
  R.Lline = function (C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); };
  R.tokens = function (C) { return CFG.tokA * Math.pow(C / CFG.tokRef, CFG.tokExp); };
  R.C_of_tokens = function (D) { return CFG.tokRef * Math.pow(D / CFG.tokA, 1 / CFG.tokExp); };
  R.params = function (C) { return C / (6 * R.tokens(C)); };
  R.P0 = Math.pow(10, -3.5);
  // ln loss of a run of compute C (target multiplier k = m(1+b)) drawn at progress q, noise-free
  R.lnLossAt = function (C, q, k) {
    q = clamp(q, R.P0, 1);
    var z = (log10(q) + 3.5) / 3.5, lk = Math.log(k || 1);
    var yl = Math.log(R.Lline(q * C)) + lk, H0 = Math.log(CFG.startLoss) - (Math.log(R.Lline(R.P0 * C)) + lk);
    return yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z));
  };
  R.amount = function (r) { if (r < CFG.cleanR) return 0; if (r <= 1) return Math.min(CFG.frayAmounts, 1 + Math.floor((r - CFG.cleanR) / CFG.frayStep + 1e-9)); return CFG.frayAmounts + 1; };
  R.CRAWL = CFG.frayAmounts + 1;
  function sizeWord(C) { var n = R.params(C); return n >= 1e9 ? (n >= 1e10 ? Math.round(n / 1e9) : (n / 1e9).toFixed(1).replace(/\.0$/, '')) + 'B' : Math.round(n / 1e6) + 'M'; }
  var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function dateOf(day) { var s = CFG.startDateUTC; return new Date(Date.UTC(s[0], s[1], s[2]) + Math.floor(day + 1e-9) * 86400000); }
  function fmtDay(day, yr) { var d = dateOf(Math.min(day, 365)), dd = String(d.getUTCDate()); if (dd.length < 2) dd = '0' + dd; return dd + ' ' + MON[d.getUTCMonth()] + (yr ? ' ' + d.getUTCFullYear() : ''); }
  function monthOf(day) { var m = 0; while (m < 11 && day >= CFG.monthStarts[m + 1]) m++; return m; }

  /* ---------------- clock ---------------- */
  var now = 0, speed = 1, lastReal = 0, timers = [];
  function after(sec, fn) { timers.push({ at: now + sec, fn: fn, n: S ? S.n : 0 }); }
  function runTimers() {
    if (!timers.length) return;
    var due = [];
    for (var i = timers.length - 1; i >= 0; i--) if (timers[i].at <= now + 1e-9) { due.push(timers[i]); timers.splice(i, 1); }
    due.sort(function (a, b) { return a.at - b.at; });
    for (i = 0; i < due.length; i++) if (S && due[i].n === S.n) due[i].fn();
  }

  /* ---------------- layout: the stacked sheet ---------------- */
  var L = {}, dpr = 1, layoutN = 0;
  function layout() {
    var vw = Math.max(320, window.innerWidth || document.documentElement.clientWidth), vh = Math.max(560, window.innerHeight || document.documentElement.clientHeight);
    if (document.activeElement === elRename && L.vw && Math.abs(vw - L.vw) < 2) return; // the phone keyboard is up
    var sp = getComputedStyle(elSafe);
    var safe = { t: parseFloat(sp.paddingTop) || 0, r: parseFloat(sp.paddingRight) || 0, b: parseFloat(sp.paddingBottom) || 0, l: parseFloat(sp.paddingLeft) || 0 };
    var lap = vw >= CFG.laptopMinWidth, G;
    L = { vw: vw, vh: vh, lap: lap, safe: safe };
    var top0 = safe.t, H = vh - safe.t - safe.b;
    if (!lap) {
      G = CFG.phone;
      var g = G.gutter + Math.max(safe.l, safe.r);
      L.x0 = g; L.x1 = vw - g; L.g = g;
      var bottom = top0 + H;
      L.letter = { w: Math.min(G.letterW, vw - 2 * Math.max(11, safe.l, safe.r)), h: G.letterH }; L.letter.x = (vw - L.letter.w) / 2; L.letter.y = bottom - 160;
      L.strip = { x: g, y: bottom - 236, w: vw - 2 * g, h: G.strip, home: G.home };
      L.cluster = { x: g, y: bottom - 294, w: vw - 2 * g, h: G.cluster };
      L.band = { x: g, y: bottom - 408, w: vw - 2 * g, h: G.band };
      var paperBot = bottom - 408;
      L.names = { x: g, y: top0 + 92, w: G.namesW, line: 28 };
      L.plot = { x: g + G.namesW, y: top0 + 86, w: vw - 2 * g - G.namesW };
      L.ruler = { y: paperBot - G.rulerH, h: G.rulerH };
      L.headY = top0 + 64; L.dateX = g; L.dateY = top0 + 12; L.monthsR = g; L.monthsY = top0 + 6;
      L.bandFont = [17, 24]; L.momentFont = 21; L.readAbove = 56;
    } else {
      G = CFG.laptop;
      var W = Math.min(vw - 2 * G.side, G.colMax), x0 = (vw - W) / 2;
      L.x0 = x0; L.x1 = x0 + W; L.g = x0;
      var y = function (f) { return top0 + H * f; };
      L.strip = { x: x0, y: y(G.stripFrom), w: W, h: G.strip, home: G.home };
      L.letter = { w: Math.min(G.letterW, W), h: Math.min(G.letterH, top0 + H - 6 - (L.strip.y + L.strip.h + 8)) }; L.letter.x = (vw - L.letter.w) / 2; L.letter.y = L.strip.y + L.strip.h + 8;
      L.cluster = { x: x0, y: y(G.clusterFrom), w: W, h: y(G.clusterTo) - y(G.clusterFrom) };
      var bw = Math.min(760, W); L.band = { x: (vw - bw) / 2, y: y(G.paperTo) + 6, w: bw, h: y(G.bandTo) - y(G.paperTo) - 6 };
      var pb = y(G.paperTo);
      L.names = { x: x0, y: y(G.header) + 34, w: G.namesW, line: 30 };
      L.plot = { x: x0 + G.namesW, y: y(G.header) + 30, w: W - G.namesW };
      L.ruler = { y: pb - G.rulerH, h: G.rulerH };
      L.headY = y(G.header) + 6; L.dateX = x0; L.dateY = top0 + 18; L.monthsR = vw - L.x1; L.monthsY = top0 + 8;
      L.bandFont = [19, 27]; L.momentFont = 28; L.readAbove = 40;
    }
    L.plot.h = L.ruler.y - 4 - L.plot.y;
    L.ruler.x = L.plot.x; L.ruler.w = L.plot.w;
    L.travel = { x: L.strip.x + L.strip.home, w: L.strip.w - L.strip.home };
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [cv, cvHi].forEach(function (c) { c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr); });
    base = null; layoutN++;
    elDate.style.left = L.dateX + 'px'; elDate.style.top = L.dateY + 'px';
    elMonths.style.right = L.monthsR + 'px'; elMonths.style.top = L.monthsY + 'px';
    elHead.style.top = L.headY + 'px';
    elNames.style.left = L.names.x + 'px'; elNames.style.top = L.names.y + 'px';
    elBand.style.left = L.band.x + 'px'; elBand.style.top = L.band.y + 'px'; elBand.style.width = L.band.w + 'px'; elBand.style.height = L.band.h + 'px';
    elCards.style.right = (vw - (L.cluster.x + L.cluster.w)) + 'px'; elCards.style.top = (L.cluster.y - 14) + 'px';
    elFocus.style.left = (L.strip.x - 3) + 'px'; elFocus.style.top = (L.strip.y - 3) + 'px'; elFocus.style.width = (L.strip.w + 6) + 'px'; elFocus.style.height = (L.strip.h + 6) + 'px';
    elLetter.style.left = L.letter.x + 'px'; elLetter.style.top = L.letter.y + 'px'; elLetter.style.width = L.letter.w + 'px'; elLetter.style.minHeight = L.letter.h + 'px';
    elMute.style.right = (lap ? vw - L.x1 : 8 + safe.r) + 'px'; elMute.style.bottom = (safe.b + 1) + 'px';
    var mTop = L.plot.y, mBot = L.band.y + L.band.h;
    elMoment.style.top = mTop + 'px'; elMoment.style.height = (mBot - mTop) + 'px';
    elMomentText.style.maxWidth = Math.min(lap ? 760 : 9999, vw - 2 * (lap ? 48 : 24)) + 'px';
    if (S) { fitBand(); renderNames(); S.notes.forEach(function (n) { n.placedN = -1; }); }
  }

  /* ---------------- plot mapping ---------------- */
  var view = { l: CFG.plotLeftMinLog, r: CFG.plotRightMinLog, from: null, to: null, t0: 0 };
  var Y_TOP = Math.log(CFG.plotLossTop), Y_BOT = Math.log(CFG.plotLossBottom);
  function X(lc) { return L.plot.x + (lc - view.l) / (view.r - view.l) * L.plot.w; }
  function Y(lnL) { return L.plot.y + (Y_TOP - lnL) / (Y_TOP - Y_BOT) * L.plot.h; }
  function lineY(C, k) { return Y(Math.log(R.Lline(C) * (k || 1))); }
  function DX(day) { return L.ruler.x + day / CFG.endDay * L.ruler.w; }
  function retarget() {
    var last = S.runs.length ? S.runs[S.runs.length - 1].C : 1e19, big = 1e19;
    S.runs.forEach(function (r) { if (r.C > big) big = r.C; }); if (S.run && S.run.C > big) big = S.run.C;
    if (S.run) last = S.run.C;
    var l = clamp(Math.floor(log10(last) - CFG.plotLeftBack), CFG.plotLeftMinLog, CFG.plotLeftMaxLog), r = Math.max(CFG.plotRightMinLog, log10(2 * big));
    if (Math.abs(l - (view.to ? view.to.l : view.l)) < 1e-6 && Math.abs(r - (view.to ? view.to.r : view.r)) < 1e-6) return;
    view.from = { l: view.l, r: view.r }; view.to = { l: l, r: r }; view.t0 = now; snd.whirr(0.6);
  }
  function stepView() {
    if (!view.to) return;
    var u = reduced() ? 1 : (now - view.t0) / CFG.panSec, e = ease(u);
    view.l = view.from.l + (view.to.l - view.from.l) * e; view.r = view.from.r + (view.to.r - view.from.r) * e;
    if (u >= 1) { view.l = view.to.l; view.r = view.to.r; view.to = null; }
    base = null;
  }

  /* ---------------- sound: Web Audio, started by the first touch ---------------- */
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
        var w = wb.getChannelData(0), b = bb.getChannelData(0), p = pb.getChannelData(0), last = 0, peak = 0, b0 = 0, b1 = 0, b2 = 0;
        for (var i = 0; i < n; i++) {
          var x = Math.random() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; b[i] = last; if (Math.abs(last) > peak) peak = Math.abs(last);
          b0 = 0.99765 * b0 + x * 0.0990460; b1 = 0.96300 * b1 + x * 0.2965164; b2 = 0.57000 * b2 + x * 1.0526913; p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
        }
        for (i = 0; i < n; i++) b[i] /= (peak || 1);
        A.white = wb; A.pink = pb;
        A.motor = c.createGain(); A.motor.gain.value = 0; A.motor.connect(A.duck);
        A.o1 = c.createOscillator(); A.o1.frequency.value = 55; A.o2 = c.createOscillator(); A.o2.frequency.value = 110.6;
        A.o2g = c.createGain(); A.o2g.gain.value = 1; A.o2.connect(A.o2g);
        var og = c.createGain(); og.gain.value = db(CFG.sound.motorDb); A.o1.connect(og); A.o2g.connect(og); og.connect(A.motor);
        var bs = c.createBufferSource(); bs.buffer = bb; bs.loop = true; var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        A.noiseG = c.createGain(); A.noiseG.gain.value = db(CFG.sound.motorNoiseDb); bs.connect(lp); lp.connect(A.noiseG); A.noiseG.connect(A.motor);
        A.o1.start(); A.o2.start(); bs.start();
        var ws = c.createBufferSource(); ws.buffer = wb; ws.loop = true; A.bp = c.createBiquadFilter(); A.bp.type = 'bandpass'; A.bp.frequency.value = 3200; A.bp.Q.value = 0.8;
        A.scr = c.createGain(); A.scr.gain.value = 0; ws.connect(A.bp); A.bp.connect(A.scr); A.scr.connect(A.duck); ws.start();
      } catch (e) { A.ctx = null; }
    }
    function blip(freq, dur, dbv, type) {
      if (!ok()) return; try {
        var c = A.ctx, o = c.createOscillator(), g = c.createGain(), t0 = t();
        o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(db(dbv), t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(A.duck); o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    function noise(buf, freq, q, dur, dbv, type, f2) {
      if (!ok()) return; try {
        var c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = t();
        s.buffer = buf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t0); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t0 + dur); f.Q.value = q;
        g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(db(dbv), t0 + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(A.duck); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    function target(param, v, sec) { try { param.cancelScheduledValues(t()); param.setTargetAtTime(v, t(), Math.max(0.005, sec / 3)); } catch (e) { } }
    var lastJag = 0, lastTick = 0, lastCard = 0, lastCrackle = 0, mode = 'off';
    return {
      start: start,
      get muted() { return A.muted; },
      setMuted: function (m) { A.muted = m; store('frontier.sim.muted', m ? '1' : '0'); if (A.ctx) try { A.out.gain.setTargetAtTime(m ? 0 : 1, A.ctx.currentTime, 0.02); } catch (e) { } },
      // motor: 'run' (two sines and brown noise), 'idle' (55 Hz alone at -36), 'off'
      motor: function (m, sec, cards) {
        if (!A.ctx) return; mode = m;
        var lvl = m === 'run' ? Math.pow(10, Math.log(Math.max(1, (cards || 8) / 8)) / Math.LN2 / 20) : m === 'idle' ? db(CFG.sound.idleDb - CFG.sound.motorDb) : 0;
        target(A.motor.gain, lvl, sec == null ? 0.3 : sec); target(A.o2g.gain, m === 'run' ? 1 : 0, 0.2); target(A.noiseG.gain, m === 'run' ? db(CFG.sound.motorNoiseDb) : 0, 0.2);
      },
      cut: function () { if (!A.ctx) return; try { var tt = t(); A.motor.gain.cancelScheduledValues(tt); A.motor.gain.setValueAtTime(0, tt); A.scr.gain.cancelScheduledValues(tt); A.scr.gain.setValueAtTime(0, tt); } catch (e) { } mode = 'off'; },
      wind: function () { if (!A.ctx) return; target(A.o1.frequency, 30, 1.2); target(A.o2.frequency, 60, 1.2); target(A.motor.gain, 0, 1.2); setTimeout(function () { try { A.o1.frequency.value = 55; A.o2.frequency.value = 110.6; } catch (e) { } }, 2400); },
      scratch: function (u) { if (A.ctx) try { A.scr.gain.setTargetAtTime(db(CFG.sound.scratchMaxDb) * clamp(u, 0, 1), t(), 0.03); } catch (e) { } },
      jag: function () { var n = performance.now(); if (n - lastJag < 35) return; lastJag = n; noise(A.white, 3200, 0.8, 0.006, CFG.sound.jagDb); },
      tick: function () { var n = performance.now(); if (n - lastTick < 30) return; lastTick = n; blip(2400, 0.006, CFG.sound.tickDb); },
      card: function () { var n = performance.now(); if (n - lastCard < 30) return; lastCard = n; blip(1800, 0.005, CFG.sound.cardDb); },
      lift: function () {
        if (ok()) try {
          var c = A.ctx, t0 = t(), g = c.createGain(); g.gain.setValueAtTime(db(CFG.sound.liftDb), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4); g.connect(A.duck);
          [55, 110].forEach(function (f) { var o = c.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 1.45); });
        } catch (e) { }
        try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { }
      },
      payroll: function () { blip(70, 0.06, CFG.sound.payrollDb); noise(A.white, 2500, 0.7, 0.003, CFG.sound.payrollDb + 2); },
      letter: function () { noise(A.pink, 1200, 0.7, 0.4, CFG.sound.letterDb, 'lowpass'); },
      take: function () { blip(120, 0.04, CFG.sound.takeDb); blip(2000, 0.008, CFG.sound.takeDb - 4, 'square'); },
      pass: function () { noise(A.pink, 900, 0.7, 0.3, CFG.sound.passDb, 'lowpass', 400); },
      crackle: function () { var n = performance.now(); if (n - lastCrackle < 70 + Math.random() * 55) return; lastCrackle = n; noise(A.white, 2600, 3, 0.012, CFG.sound.fuseDb); },
      thud: function () { blip(41, 0.35, CFG.sound.hangThudDb); },
      strike: function () { noise(A.white, 3800, 1.2, 0.6, CFG.sound.strikeDb, 'bandpass', 2400); },
      pen: function (dur) { var k = Math.max(2, Math.round(dur / 0.08)); for (var i = 0; i < k; i++) (function (j) { setTimeout(function () { noise(A.white, 3600 + Math.random() * 900, 1.4, 0.04, -40); }, j * 80); })(i); },
      whirr: function (dur) {
        if (!ok()) return; try {
          var c = A.ctx, t0 = t(), o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
          o.type = 'sawtooth'; o.frequency.value = 90; f.type = 'lowpass'; f.frequency.value = 600;
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(db(CFG.sound.feedDb), t0 + 0.08);
          g.gain.setValueAtTime(db(CFG.sound.feedDb), t0 + Math.max(0.09, dur - 0.12)); g.gain.linearRampToValueAtTime(0, t0 + dur);
          o.connect(f); f.connect(g); g.connect(A.duck); o.start(t0); o.stop(t0 + dur + 0.05);
        } catch (e) { }
      },
      duck: function (hold, back) { if (!A.ctx) return; try { var g = A.duck.gain, t0 = t(); g.cancelScheduledValues(t0); g.setValueAtTime(g.value, t0); g.linearRampToValueAtTime(0, t0 + 0.08); g.setValueAtTime(0, t0 + 0.08 + hold); g.linearRampToValueAtTime(1, t0 + 0.08 + hold + back); } catch (e) { } },
      sleep: function () { if (A.ctx && A.ctx.state === 'running') { A.was = true; try { A.ctx.suspend(); } catch (e) { } } },
      wake: function () { if (A.ctx && A.was) { A.was = false; try { A.ctx.resume(); } catch (e) { } } }
    };
  })();

  /* ---------------- the year ---------------- */
  var S = null, yearN = 0, labName = 'FRONTIER';
  function drawW() { return Math.exp(Math.log(CFG.W_lo) + rng() * (Math.log(CFG.W_hi) - Math.log(CFG.W_lo))); }
  function drawCaps() {
    var v = CFG.caps.map(function (c) { return c[1] * Math.pow(10, (rng() * 2 - 1) * c[2]); }).sort(function (a, b) { return a - b; });
    return CFG.caps.map(function (c, i) { return { id: c[0], C: v[i], fired: false, contaminated: false }; });
  }
  function makeRivals() {
    return CFG.rivals.map(function (r) {
      var lc0 = log10(r.c0) + U(-CFG.rivalJitter, CFG.rivalJitter);
      return { id: r.id, name: r.name, lc: lc0, tau: r.tau, period: r.period, off: r.off, offX: 1, nextPub: r.period * U(0.25, 1.0),
        pubs: [{ C: Math.pow(10, lc0) / 2, day: -30 }], bonus: [] };
    });
  }
  function newYear() {
    var s = {
      n: ++yearN, phase: 'asleep', powerT0: null, started: false, day: 0, lab: labName,
      bank: CFG.seed - CFG.dgx1, stake: CFG.stakeStart, post: CFG.seedPost, credits: 0,
      team: [], knocked: {}, passedPeople: {},
      owned: CFG.ownedStart, a100: 0, rentals: [], orders: [], lent: null, meridian: null, meridianOffered: false, meridianPassed: false, meridian2Offered: false,
      shipped: null, W: drawW(), filters: 0, filter: null, priyaOffer: false, redteam: null,
      caps: drawCaps(), run: null, runs: [], scars: [], best: 0, cp: null, landUntil: 0, landing: null,
      letter: null, waiting: [], month: -1, silent: false, prevSilent: false, silentNext: false,
      brokerNext: 'rent', lastBrokerDay: -99, poachMonth: -1,
      seriesA: { taken: false, needC: CFG.seriesA.far, pending: null }, seriesB: { taken: false, pending: null }, termBlockUntil: -1,
      scandals: [], slides: [], opened: null, openOffered: false, sunheeTrick: null, firstAuthor: false,
      rivals: makeRivals(), newsDone: {}, labels: [], headQ: [], head: null, notes: [], boxes: {}, hints: {},
      hangsByMonth: {}, tomOffUntil: -1, ayaanSnap: false, splitNoted: false, evals: null, gpt3: false, miracle: false,
      lastPublishDay: -999, endReason: null, endT0: null, bags: {}, t3used: {}, t4used: {}, sample: null, skimmed: '',
      drag: null, kb: null, stopNoteT: -99, lastStopKind: null, dragT0: 0
    };
    return s;
  }

  /* ---------------- people ---------------- */
  function onStaff(id) { for (var i = 0; i < S.team.length; i++) if (S.team[i].id === id && !S.team[i].gone) return S.team[i]; return null; }
  function staff() { return S.team.filter(function (p) { return !p.gone; }); }
  function hasSystems() { return onStaff('dev') || onStaff('rafael'); }
  function hasBeliever() { return onStaff('ayaan'); }
  function infraN() { var n = 0; var t = onStaff('tom'); if (t && S.day >= S.tomOffUntil) n++; if (onStaff('kofi')) n++; return n; }
  function bendK() { var p = onStaff('sunhee'); return p && S.day - p.joined >= CFG.sunheeAfterDays ? CFG.sunheeBend : 1; }
  function salaries() { var t = 0; staff().forEach(function (p) { t += p.salary; }); return t; }
  function join(id, salary) {
    var P = LAB.people[id];
    var p = { id: id, name: P.name, short: P.short, sur: P.sur, role: P.role, she: P.she, ego: P.ego, salary: salary || P.salary, mood: CFG.moodStart, joined: S.day, gone: false, writing: true };
    S.team.push(p); renderNames(); snd.pen(0.4);
    return p;
  }
  function walk(p) {
    if (!p || p.gone) return;
    p.gone = true; p.goneDay = S.day; renderNames(); snd.strike();
    if (S.filter && S.filter.by === p.id) { S.filter = null; }
    if (S.redteam && p.id === 'lena') { S.redteam = null; }
  }
  function mood(p, d) { if (!p || p.gone) return; p.mood = clamp(p.mood + d, 0, 100); if (p.mood <= 0) walk(p); }
  function nameWeight(p) { return clamp(Math.round(400 + (CFG.egoE[p.ego] - 400) * p.mood / 70), 400, 700); }

  /* ---------------- cards and money ---------------- */
  function rentPrice() { return S.day >= CFG.rentLateFromDay ? CFG.rentLate : CFG.rentEarly; }
  function cluster() {
    var lent = S.lent && S.day < S.lent.until ? S.lent.n : 0;
    var rentedLive = 0, rentedPend = 0;
    S.rentals.forEach(function (r) { if (S.day >= r.end) return; if (S.day >= r.start) rentedLive += r.n; else rentedPend += r.n; });
    var mer = 0, merCut = 0, merPend = 0;
    if (S.meridian) { if (S.day < S.meridian.live) merPend = S.meridian.cards; else { mer = S.meridian.alloc; merCut = S.meridian.cards - S.meridian.alloc; } }
    var ownedV = Math.max(0, S.owned - lent), pre = ownedV + S.a100 + rentedLive + mer, serving = 0;
    if (S.shipped) serving = Math.min(ownedV + rentedLive + mer, clamp(Math.round(pre * CFG.servingShare / 8) * 8, CFG.servingMin, CFG.servingMax));
    var ordered = 0; S.orders.forEach(function (o) { ordered += o.n; });
    return { ownedV: ownedV, a100: S.a100, lent: lent, rented: rentedLive, rentedPend: rentedPend, mer: mer, merCut: merCut, merPend: merPend, serving: serving, ordered: ordered,
      train: pre - serving, v100eq: (ownedV + rentedLive + mer - serving) + S.a100 * CFG.a100x,
      count: S.owned + S.a100 + rentedLive + rentedPend + mer };
  }
  function rentMonth() { var t = 0; S.rentals.forEach(function (r) { if (S.day < r.end) t += r.n * r.price * 24 * CFG.monthDays; }); return t; }
  function revenueMonth() { return S.shipped ? S.shipped.rev : 0; }
  function payrollDue() { return CFG.base + salaries() + CFG.upkeep * (S.owned + S.a100); }
  function burnMonth(o) { o = o || {}; return payrollDue() + (o.salary || 0) + CFG.upkeep * (o.owned || 0) + rentMonth() + (o.rent || 0) - revenueMonth() - (o.revenue || 0); }
  function monthsLeft(o) { o = o || {}; var b = burnMonth(o), bank = S.bank + (o.cash || 0); if (b <= 0) return CFG.monthsCap; return clamp(bank / b, 0, CFG.monthsCap); }
  function fmtM(m) { if (m >= 3) return String(Math.floor(Math.min(m, CFG.monthsCap))); return (Math.floor(Math.max(0, m) * 10) / 10).toFixed(1); }
  function mEff(o) { return 'MONTHS ' + fmtM(monthsLeft()) + ' → ' + fmtM(monthsLeft(o)); }
  function cEff(d, pencil) { var c = cluster().count; return 'CARDS ' + c + ' → ' + (c + d) + (pencil ? ' in pencil' : ''); }

  /* ---------------- samples: the model's words (slice one) ---------------- */
  function bag(name, pool) { var b = S.bags[name]; if (!b || !b.length) b = S.bags[name] = shuffle(pool.slice()); return b.pop(); }
  function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
  function bandCut(txt) {
    if (txt.length <= CFG.bandMaxChars) return txt;
    var parts = sentences(txt), out = '';
    for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > CFG.bandMaxChars) break; out += parts[i]; }
    return out.trim();
  }
  function paraFired() { var c = S.caps[0]; return c.fired ? R.Lline(c.C) : 0; }
  function tierOf(Lv) { if (Lv > CFG.tierStatic) return 0; if (Lv > CFG.tierWords) return 1; if (Lv > CFG.tierGrammar) return 2; var pf = paraFired(); return pf && Lv <= pf ? 4 : 3; }
  function pickT3(Lv) {
    var want = Lv > CFG.t3Sense[0] ? 1 : Lv > CFG.t3Sense[1] ? 2 : 3, order = want === 1 ? [1, 2, 3] : want === 2 ? [2, 3, 1] : [3, 2, 1];
    for (var pass = 0; pass < 2; pass++) {
      for (var o = 0; o < 3; o++) {
        var cand = []; CORPUS.t3.forEach(function (e, i) { if (e[0] === order[o] && !S.t3used[i]) cand.push(i); });
        if (cand.length) { var i = cand[Math.floor(rng() * cand.length)]; S.t3used[i] = 1; return CORPUS.t3[i][1]; }
      }
      S.t3used = {};
    }
    return CORPUS.t3[0][1];
  }
  function pickT4(moment) {
    for (var pass = 0; pass < 2; pass++) {
      var cand = []; CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i] && (!moment || e[0] === 1)) cand.push(i); });
      if (!cand.length && moment) CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i]) cand.push(i); });
      if (cand.length) { var i = cand[Math.floor(rng() * cand.length)]; S.t4used[i] = 1; return CORPUS.t4[i][1]; }
      S.t4used = {};
    }
    return CORPUS.t4[0][1];
  }
  function pickLow(tier) { if (tier === 0) return bag('t0', CORPUS.t0); if (tier === 1) return bag('t1', CORPUS.t1); return bag('t2' + (S.day >= CFG.covidLineFromDay ? 'c' : ''), S.day >= CFG.covidLineFromDay ? CORPUS.t2.concat([CORPUS.t2Covid]) : CORPUS.t2); }
  function crawlLine() {
    var pool = shuffle(CORPUS.crawl.slice()), out = '';
    for (var i = 0; i < pool.length; i++) { var next = out ? out + ' | ' + pool[i] : pool[i]; if (out && next.length > CFG.crawlLen[1]) continue; out = next; if (out.length >= CFG.crawlLen[0]) break; }
    return out;
  }
  var PUNCT_END = /[.,;:!?»)\]"”’…]$/, PUNCT_START = /^[(\["“‘«.,;:!?…]/;
  function splice(text, k) {
    if (!(k > 0) || k >= R.CRAWL) return text;
    var words = text.split(' '), n = words.length, gaps = [], i, j;
    for (i = 0; i < n - 1; i++) { var pos = (i + 1) / n; if (pos < 0.1 || pos > 0.9) continue; if (/\n/.test(words[i]) || /\n/.test(words[i + 1])) continue; if (PUNCT_END.test(words[i]) || PUNCT_START.test(words[i + 1])) continue; gaps.push(i); }
    if (!gaps.length) for (i = 0; i < n - 1; i++) gaps.push(i);
    var chosen = [];
    if (k === 1) { var mid = gaps.filter(function (g) { var q = (g + 1) / n; return q >= 0.3 && q <= 0.7; }); var pool = mid.length ? mid : gaps; chosen = [pool[Math.floor(rng() * pool.length)]]; }
    else {
      for (var tries = 0; tries < 30; tries++) {
        chosen = [];
        for (j = 0; j < k; j++) { var lo = Math.floor(j * gaps.length / k), hi = Math.max(lo + 1, Math.floor((j + 1) * gaps.length / k)); chosen.push(gaps[Math.min(gaps.length - 1, lo + Math.floor(rng() * (hi - lo)))]); }
        chosen.sort(function (a, b) { return a - b; });
        var okk = true; for (j = 1; j < chosen.length; j++) if (chosen[j] - chosen[j - 1] < 2) okk = false;
        if (okk) break;
      }
    }
    var frags = shuffle(CORPUS.fray.slice()), out = [], fi = 0;
    for (i = 0; i < n; i++) { out.push(words[i]); for (j = 0; j < chosen.length; j++) if (chosen[j] === i) out.push(frags[(fi++) % frags.length]); }
    return out.join(' ');
  }
  function makeSample(run, q, kind, capId) {
    var Lv = Math.exp(R.lnLossAt(run.C, q, run.k)), tier = tierOf(Lv);
    var amt = R.amount(q * R.tokens(run.C) / (CFG.passes * S.W));
    var text, mtext = null, cap = null, full;
    if (capId) tier = Math.max(tier, 3);
    if (tier >= 3 && amt === R.CRAWL) text = crawlLine();
    else if (tier >= 3) {
      if (capId) { full = capId === 'paragraph' ? pickT4(true) : bag(capId, CORPUS[capId]); cap = capId; }
      else {
        var elig = S.caps.filter(function (c) { return c.fired && c.id !== 'paragraph' && Lv <= R.Lline(c.C); });
        if (elig.length && rng() < CFG.capSampleShare) { var c = elig[Math.floor(rng() * elig.length)]; full = bag(c.id, CORPUS[c.id]); cap = c.id; }
        else full = tier === 4 ? pickT4(false) : pickT3(Lv);
      }
      text = splice(bandCut(full), amt);
      if (capId) mtext = splice(full, amt);
    } else { text = pickLow(tier); amt = 0; }
    return { text: text, momentText: mtext, tier: tier, fray: amt === R.CRAWL ? 0 : amt, crawl: amt === R.CRAWL, cap: cap, q: q, kind: kind, loss: Lv, day: S.day };
  }

  /* ---------------- the band ---------------- */
  var band = null;
  function buildWords(el, text) {
    el.textContent = '';
    var frag = document.createDocumentFragment(), spans = [];
    text.split('\n').forEach(function (line, li) {
      if (li) frag.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (w, i) {
        if (i) frag.appendChild(document.createTextNode(' '));
        var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; frag.appendChild(sp); spans.push(sp);
      });
    });
    el.appendChild(frag); return spans;
  }
  function fitBand() {
    var fs = L.bandFont[0], lh = L.bandFont[1];
    elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = lh + 'px';
    var guard = 0;
    while (elSample.scrollHeight > L.band.h + 1 && fs > 12 && guard++ < 12) { fs -= 1; lh = Math.round(fs * 1.4); elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = lh + 'px'; }
  }
  function showSample(smp, mode) {
    if (S.phase === 'over') return;
    S.sample = smp;
    elSample.style.transition = 'none'; elSample.style.transform = ''; elSample.style.opacity = '1';
    var spans = buildWords(elSample, smp.text); fitBand();
    if (mode === 'instant' || speed > 6 || reduced()) { spans.forEach(function (sp) { sp.className = 'w on'; }); band = null; }
    else band = { spans: spans, t0: now, shown: 0 };
    if (mode === 'rise' && !reduced() && speed <= 6) {
      elSample.style.transform = 'translateY(14px)'; elSample.style.opacity = '0'; void elSample.offsetWidth;
      elSample.style.transition = 'transform .3s cubic-bezier(.2,.7,.25,1), opacity .24s linear';
      elSample.style.transform = 'translateY(0)'; elSample.style.opacity = '1';
    }
    elLive.textContent = smp.text;
    // the wall speaks only through the words, and through Priya at amount 4 or more
    S.priyaOffer = false;
    if (smp.fray > 0 || smp.crawl) {
      var k = smp.crawl ? R.CRAWL : smp.fray, writer = onStaff('priya') || onStaff('ines');
      S.lastFray = k;
      if (writer && !S.filter) { S.priyaOffer = true; if (k >= CFG.priyaAutoK) note(writer, LAB.notes.fray, 'band'); }
    } else S.lastFray = 0;
  }
  function stepBand() {
    if (!band) return;
    var k = Math.min(band.spans.length, Math.floor((now - band.t0) / (CFG.wordMs / 1000)) + 1), ticked = false;
    while (band.shown < k) { band.spans[band.shown++].className = 'w on'; if (!ticked) { snd.tick(); ticked = true; } }
    if (band.shown >= band.spans.length) band = null;
  }
  function bandOut(dir) {
    if (reduced() || speed > 6) { return; }
    elSample.style.transition = dir === 'up' ? 'transform .5s cubic-bezier(.5,0,.75,0), opacity .5s linear' : 'transform .4s cubic-bezier(.5,0,.75,0), opacity .4s linear';
    elSample.style.transform = dir === 'up' ? 'translateY(-60px)' : 'translateX(' + (L.vw) + 'px)'; elSample.style.opacity = '0';
  }

  /* ---------------- moments ---------------- */
  var moment = null;
  function startCapMoment(smp) {
    var text = smp.momentText || smp.text, spans = buildWords(elMomentText, text);
    var fs = L.momentFont; elMomentText.style.fontSize = fs + 'px'; elMomentText.style.lineHeight = Math.round(fs * 1.43) + 'px';
    var guard = 0;
    while (elMomentText.offsetHeight > elMoment.clientHeight - 8 && fs > 14 && guard++ < 16) { fs--; elMomentText.style.fontSize = fs + 'px'; elMomentText.style.lineHeight = Math.round(fs * 1.43) + 'px'; }
    moment = { kind: 'cap', t0: now, spans: spans, shown: 0, smp: smp, ducked: false };
    moment.wordsEnd = CFG.momentDimSec + spans.length * CFG.wordMs / 1000;
    moment.end = moment.wordsEnd + 0.08 + CFG.momentSilenceSec + CFG.momentRestoreSec;
    if (speed > 6) moment.end = moment.wordsEnd = 0.05;
    elMoment.style.opacity = 1; elLive.textContent = text;
    staff().forEach(function (p) { mood(p, CFG.capMood); }); renderNames();
  }
  function startLineMoment(kind) {
    moment = { kind: kind, t0: now, spans: [], shown: 0, ducked: false, wordsEnd: CFG.momentDimSec + 0.3 };
    moment.end = moment.wordsEnd + 0.08 + CFG.momentSilenceSec + CFG.momentRestoreSec;
    if (speed > 6) moment.end = moment.wordsEnd = 0.05;
    cvHi.style.display = 'block';
  }
  function momentDim() {
    var M = moment; if (!M) return 0;
    var t = now - M.t0;
    if (t < CFG.momentDimSec) return reduced() ? 1 : t / CFG.momentDimSec;
    if (t < M.end - CFG.momentRestoreSec) return 1;
    return clamp(1 - (t - (M.end - CFG.momentRestoreSec)) / CFG.momentRestoreSec, 0, 1);
  }
  function stepMoment() {
    var M = moment; if (!M) return;
    var t = now - M.t0, dim = momentDim();
    elDim.style.opacity = (dim * 0.92).toFixed(3);
    if (M.kind === 'cap') {
      var k = t < CFG.momentDimSec ? 0 : Math.min(M.spans.length, Math.floor((t - CFG.momentDimSec) / (CFG.wordMs / 1000)) + 1), ticked = false;
      while (M.shown < k) { M.spans[M.shown++].className = 'w on'; if (!ticked) { snd.tick(); ticked = true; } }
      elMoment.style.opacity = t > M.end - CFG.momentRestoreSec ? dim.toFixed(3) : 1;
    }
    if (!M.ducked && t >= M.wordsEnd) { M.ducked = true; snd.duck(CFG.momentSilenceSec, CFG.momentRestoreSec); }
    if (t >= M.end) {
      elDim.style.opacity = 0; elMoment.style.opacity = 0; elMomentText.textContent = ''; cvHi.style.display = 'none';
      if (M.kind === 'cap' && M.smp.kind === 'land') showSample(M.smp, 'instant');
      moment = null;
    }
  }

  /* ---------------- notes: your people write on the paper ---------------- */
  function note(person, text, anchor, at, opts) {
    opts = opts || {};
    if (S.phase === 'asleep') return null;
    var el = document.createElement('div');
    el.className = 'fr-note' + (opts.typed ? ' typed' : '') + (reduced() ? '' : ' writing');
    var tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = text; el.appendChild(tx);
    el.style.setProperty('--wd', Math.max(0.15, text.length * CFG.noteCharMs / 1000) + 's'); el.style.setProperty('--ws', Math.max(4, text.length));
    elNotes.appendChild(el);
    var n = { el: el, anchor: anchor, at: at || null, t0: now, who: person ? person.id : null, rot: (vis() * 2 - 1) * 1.6, placedN: -1, dy: 0, text: text, life: opts.life || 0 };
    S.notes.push(n);
    while (S.notes.length > 6) { var o = S.notes.shift(); o.el.remove(); }
    snd.pen(Math.min(0.9, text.length * 0.03));
    placeNote(n);
    return n;
  }
  function placeNote(n) {
    var el = n.el, w = el.offsetWidth || 120, x, y;
    if (n.anchor === 'band') { x = L.band.x + L.band.w - w; y = L.band.y + 2; }
    else if (n.anchor === 'stop') { x = L.strip.x + L.strip.w - w; y = L.strip.y - 20; }
    else if (n.anchor === 'strip') { x = L.strip.x + L.strip.home + 6; y = L.strip.y - 20; }
    else if (n.anchor === 'cluster') { x = L.cluster.x + 4; y = L.cluster.y - 18; }
    else if (n.anchor === 'plot' && n.at) { x = X(n.at.lc) + 9; y = Y(n.at.y) - 22; }
    else if (n.anchor === 'pen' && S.run && S.run.pts.length) { var lp = S.run.pts[S.run.pts.length - 1]; x = X(lp[0]) + 10; y = Y(lp[1]) - 26; }
    else if (n.anchor === 'name' && n.who) { var b = elNames.querySelector('[data-id="' + n.who + '"]'); if (b) { x = L.names.x + b.offsetLeft + b.offsetWidth + 4; y = L.names.y + b.offsetTop + 6; } }
    if (x == null) { x = L.plot.x + 8; y = L.plot.y + 8; }
    x = clamp(x, L.x0 - 6, L.x1 - w + 4); y = clamp(y, 4, L.vh - 20);
    if (n.placedN !== layoutN) {
      n.placedN = layoutN; n.dy = 0;
      for (var tries = 0; tries < 4; tries++) {
        var hit = S.notes.some(function (o) { return o !== n && !o.gone && o.rect && Math.abs(o.rect.y - (y + n.dy)) < 16 && o.rect.x < x + w && o.rect.x + o.rect.w > x; });
        if (!hit) break; n.dy -= 17;
      }
    }
    y += n.dy; n.rect = { x: x, y: y, w: w };
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) rotate(' + n.rot.toFixed(2) + 'deg)';
  }
  function stepNotes() {
    S.notes.forEach(function (n) {
      if (n.anchor === 'plot' || n.anchor === 'pen') placeNote(n);
      var age = now - n.t0;
      if (n.life && age > n.life && !n.gone) { n.gone = true; n.el.style.opacity = 0; (function (e) { setTimeout(function () { e.remove(); }, 700); })(n.el); }
      else if (age > CFG.noteFadeSec && !n.old) { n.old = true; n.el.classList.add('old'); }
    });
    S.notes = S.notes.filter(function (n) { return !n.gone || n.el.isConnected; });
  }
  function clearNotes() { S.notes.forEach(function (n) { n.el.remove(); }); S.notes = []; }
  // pencil boxes: 'filter: 9 days' by Priya's name, 'red-team: 4 days' by the band
  var boxEls = {};
  function setBox(key, text, x, y) {
    var el = boxEls[key];
    if (!text) { if (el) { el.remove(); delete boxEls[key]; } return; }
    if (!el) { el = boxEls[key] = document.createElement('div'); el.className = 'fr-box'; elBoxes.appendChild(el); }
    if (el.textContent !== text) el.textContent = text;
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px) rotate(-1.5deg)';
  }
  function stepBoxes() {
    var f = S.filter, by = f ? (onStaff(f.by) || null) : null;
    if (f && by) { var b = elNames.querySelector('[data-id="' + by.id + '"]'); if (b) setBox('filter', LAB.notes.filterBox.replace('{d}', Math.max(1, Math.ceil(f.until - S.day))), L.names.x + b.offsetLeft + b.offsetWidth + 6, L.names.y + b.offsetTop + 5); }
    else setBox('filter', null);
    if (S.redteam) setBox('red', LAB.notes.redTeamBox.replace('{d}', Math.max(1, Math.ceil(S.redteam.until - S.day))), L.band.x, L.band.y + 2); else setBox('red', null);
  }

  /* ---------------- history: headlines drift right to left ---------------- */
  function stepHead() {
    if (S.head) {
      var u = (now - S.head.t0) / CFG.headlineDriftSec, w = S.head.w || 600;
      var x0 = L.x1, x1 = L.x0 - w;
      elHead.style.transform = 'translateX(' + Math.round(x0 + (x1 - x0) * clamp(u, 0, 1)) + 'px)';
      if (u >= 1) { S.head = null; elHead.textContent = ''; }
    }
    if (!S.head && S.headQ.length) {
      var it = S.headQ.shift(); elHead.textContent = it; S.head = { t0: now, w: elHead.offsetWidth || 600 }; elLive.textContent = it;
      elHead.style.transform = 'translateX(' + L.x1 + 'px)';
    }
  }

  /* ---------------- names in the margin ---------------- */
  function renderNames() {
    if (!S) return;
    elNames.innerHTML = '';
    S.team.forEach(function (p, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'nm' + (p.gone ? ' gone' : '') + (p.writing && !reduced() ? ' writing' : '') + (!p.gone && p.mood < CFG.moodGraphite ? ' low' : '');
      b.setAttribute('role', 'listitem'); b.dataset.id = p.id; b.style.top = (i * L.names.line) + 'px';
      var tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = L.lap ? p.name : p.short; b.appendChild(tx);
      tx.style.setProperty('--wd', ((L.lap ? p.name : p.short).length * CFG.nameCharMs / 1000) + 's'); tx.style.setProperty('--ws', (L.lap ? p.name : p.short).length);
      b.style.fontWeight = nameWeight(p);
      b.setAttribute('aria-label', p.name + ', ' + LAB.roleLine[p.role] + (p.gone ? ', gone' : '') + '. Press to ' + (S.run && S.run.hang ? 'wake' : 'ask'));
      if (p.gone) b.tabIndex = -1;
      elNames.appendChild(b);
      p.writing = false;
    });
  }
  function refreshNameInk() {
    Array.prototype.forEach.call(elNames.children, function (b) {
      var p = onStaff(b.dataset.id); if (!p) return;
      var w = String(nameWeight(p)); if (b.style.fontWeight !== w) b.style.fontWeight = w;
      b.classList.toggle('low', p.mood < CFG.moodGraphite);
    });
  }

  /* ---------------- letters: three a month, one at a time ---------------- */
  function letter(o) { o.fuseDays = o.fuseDays == null ? 7 : o.fuseDays; return o; }
  function hireLetter(id, salary) {
    var P = LAB.people[id]; salary = salary || P.salary;
    var toHalcyon = id === 'sunhee';
    return letter({ kind: 'hire', who: id, sender: P.name, hand: true, offer: '“' + P.pitch + '” ' + dollars(salary) + ' a month.', offerHand: true, fuseDays: CFG.fuse.hire,
      up: { eff: function () { return '↑ ' + mEff({ salary: salary }); }, fn: function () { var p = join(id, salary); if (id === 'dev' || id === 'rafael') S.splitNoted = false; } },
      down: { eff: function () { return '↓ ' + P.she + ' goes to ' + (toHalcyon ? 'Halcyon' : 'Kestrel'); }, fn: function () { S.passedPeople[id] = S.day; rivalBonus(toHalcyon ? 'halcyon' : 'kestrel', CFG.passBonus); } } });
  }
  function brokerRentLetter() {
    var size = 64; CFG.rentSizes.forEach(function (e) { if (S.day >= e[0]) size = e[1]; });
    var price = rentPrice(), goneBy = fmtDay(S.day + 7);
    var add = size * price * 24 * CFG.monthDays;
    if (S.meridian) return letter({ kind: 'broker', sender: 'BROKER', offer: size + ' V100s on demand, live tomorrow. $' + price.toFixed(2) + ' an hour for 90 days.', fuseDays: CFG.fuse.broker, greyed: 'Meridian: exclusive.',
      up: null, down: { eff: function () { return '↓ gone by the ' + goneBy.slice(0, 2).replace(/^0/, '') + ordinal(+goneBy.slice(0, 2)); }, fn: function () { } } });
    return letter({ kind: 'broker', sender: 'BROKER', offer: size + ' V100s on demand, live tomorrow. $' + price.toFixed(2) + ' an hour for 90 days.', fuseDays: CFG.fuse.broker,
      up: { eff: function () { return '↑ ' + mEff({ rent: add }) + ' · ' + cEff(size); }, fn: function () { S.rentals.push({ n: size, price: price, start: Math.floor(S.day) + 1, end: Math.floor(S.day) + 1 + CFG.rentTermDays, asked: false }); } },
      down: { eff: function () { var d = +goneBy.slice(0, 2); return '↓ gone by the ' + d + ordinal(d); }, fn: function () { } } });
  }
  function ordinal(d) { return (d % 10 === 1 && d !== 11) ? 'st' : (d % 10 === 2 && d !== 12) ? 'nd' : (d % 10 === 3 && d !== 13) ? 'rd' : 'th'; }
  function buyLetter() {
    var a = S.day >= CFG.buyA100.fromDay && S.buyFlip; S.buyFlip = !S.buyFlip;
    var B = a ? CFG.buyA100 : CFG.buyV100, price = B.price, lead = B.lead;
    if (S.day >= CFG.covidOrderFrom && S.day <= CFG.covidOrderTo) lead += CFG.covidOrderExtra;
    if (S.day >= CFG.apiDay) { price *= CFG.postApiPriceX; lead += CFG.postApiLeadExtra; }
    var weeks = Math.round(lead / 7), can = S.bank >= price;
    var offer = a ? 'Eight DGX A100s: 64 A100s. ' + dollars(price) + '. Delivery in ' + weeks + ' weeks.' : '64 V100s to own: eight servers with InfiniBand. ' + dollars(price) + '. Delivery in ' + weeks + ' weeks.';
    return letter({ kind: 'buy', sender: 'BROKER', offer: offer, fuseDays: CFG.fuse.broker, greyed: can ? null : 'The bank: no.',
      up: can ? { eff: function () { return '↑ ' + mEff({ cash: -price, owned: 64 }) + ' · CARDS +64 in pencil by ' + fmtDay(S.day + lead); }, fn: function () { S.bank -= price; S.orders.push({ n: 64, a100: a, at: S.day, arrive: Math.floor(S.day) + lead }); } } : null,
      down: { eff: function () { return '↓ gone'; }, fn: function () { } } });
  }
  function termLetter() {
    var p = S.seriesA.pending, amt = p.amt, post = p.post;
    return letter({ kind: 'term', sender: 'LEAD INVESTOR', offer: 'Series A: ' + dollars(amt) + ' at a ' + dollars(post) + ' post. Two dots, one line. Sign by the 25th.', fuseDays: CFG.fuse.term, term: true,
      up: { eff: function () { return '↑ ' + mEff({ cash: amt }) + ' · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * (1 - amt / post)); }, fn: function () { S.bank += amt; S.stake *= (1 - amt / post); S.post = post; S.seriesA.taken = true; S.seriesA.pending = null; } },
      down: { eff: function () { return '↓ gone; next time they want a dot three times further out'; }, fn: function () { S.seriesA.needC = S.best * CFG.seriesA.passFactor; S.seriesA.pending = null; } } });
  }
  function termBLetter() {
    var api = !!S.shipped, amt = CFG.seriesB.amt, post = api ? CFG.seriesB.postApi : CFG.seriesB.post;
    return letter({ kind: 'termB', sender: 'LEAD INVESTOR', offer: 'Series B: ' + dollars(amt) + ' at a ' + dollars(post) + ' post.' + (api ? ' We like your waitlist.' : ''), fuseDays: CFG.fuse.term, term: true,
      up: { eff: function () { return '↑ ' + mEff({ cash: amt }) + ' · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * (1 - amt / post)); }, fn: function () { S.bank += amt; S.stake *= (1 - amt / post); S.post = post; S.seriesB.taken = true; S.seriesB.pending = null; } },
      down: { eff: function () { return '↓ gone'; }, fn: function () { S.seriesB.pending = null; S.seriesB.taken = 'passed'; } } });
  }
  function meridianLetter(second) {
    var M = CFG.meridian;
    if (second) {
      S.meridian2Offered = true;
      return letter({ kind: 'meridian', sender: 'MERIDIAN CLOUD', offer: M.secondCards + ' V100s, ready in six weeks, for 10% of ' + S.lab + '.', fuseDays: CFG.fuse.meridian,
        up: { eff: function () { return '↑ CARDS +' + M.secondCards + ' · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * M.secondStake); }, fn: function () { S.stake *= M.secondStake; signMeridian(M.secondCards, 0); } },
        down: { eff: function () { return '↓ gone'; }, fn: function () { } } });
    }
    S.meridianOffered = true;
    return letter({ kind: 'meridian', sender: 'MERIDIAN CLOUD', offer: '$50M in compute credits: 1,024 V100s reserved for you, ready in six weeks. Our cloud only. We see every checkpoint first.', fuseDays: CFG.fuse.meridian,
      up: { eff: function () { return '↑ CARDS +1,024 in pencil · no other cloud · no open weights'; }, fn: function () { signMeridian(M.cards, M.credits); } },
      down: { eff: function () { return '↓ we’ll talk again in June'; }, fn: function () { S.meridianPassed = true; } } });
  }
  function signMeridian(cards, credits) {
    var M = CFG.meridian;
    S.meridian = { cards: cards, alloc: cards, sign: S.day, live: Math.floor(S.day) + M.lead, second: !credits };
    S.credits += credits || 0;
    S.rentals.forEach(function (r) { r.asked = true; }); // exclusive: broker rentals run out unrenewed
  }
  function renewalLetter(r) {
    r.asked = true;
    var back = fmtDay(r.end);
    if (S.day >= CFG.apiDay && rng() < CFG.renewRefuseShare) {
      return letter({ kind: 'renewal', sender: 'BROKER', offer: 'Capacity unavailable. Your ' + r.n + ' V100s go back on ' + back + '.', fuseDays: CFG.fuse.renewal, greyed: 'Capacity unavailable.', up: null,
        down: { eff: function () { return '↓ they go back on ' + back; }, fn: function () { } } });
    }
    var price = S.day >= CFG.apiDay ? CFG.rentRenewLate : rentPrice();
    return letter({ kind: 'renewal', sender: 'BROKER', offer: 'Your ' + r.n + ' V100s go back on ' + back + '. Renew for 90 days at $' + price.toFixed(2) + '?', fuseDays: CFG.fuse.renewal,
      up: { eff: function () { return '↑ keep them · ' + mEff({ rent: r.n * (price - r.price) * 24 * CFG.monthDays }); }, fn: function () { var ref = r; S.rentals.push({ n: ref.n, price: price, start: ref.end, end: ref.end + CFG.rentTermDays, asked: false, renewed: true }); } },
      down: { eff: function () { return '↓ they go back on ' + back; }, fn: function () { } } });
  }
  function demandLetter(id) {
    var p = onStaff(id); if (!p) return null;
    S.knocked['demand_' + id] = true;
    if (id === 'priya') return letter({ kind: 'demand', who: id, sender: p.name, hand: true, offer: 'I want first author on our next paper, or I walk.', offerHand: true, fuseDays: CFG.fuse.demand,
      up: { eff: function () { return '↑ your next clean landing is published with her name on it'; }, fn: function () { S.firstAuthor = 'priya'; } },
      down: { eff: function () { return '↓ she walks'; }, fn: function () { walk(p); } } });
    if (id === 'dev') return letter({ kind: 'demand', who: id, sender: p.name, hand: true, offer: 'One percent, or Halcyon gets my parallelism code.', offerHand: true, fuseDays: CFG.fuse.demand,
      up: { eff: function () { return '↑ STAKE ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.devStake); }, fn: function () { S.stake -= CFG.devStake; } },
      down: { eff: function () { return '↓ he walks'; }, fn: function () { walk(p); } } });
    if (id === 'ayaan') return letter({ kind: 'demand', who: id, sender: p.name, hand: true, offer: 'Whole cluster on one run, all the way to the stop.', offerHand: true, fuseDays: CFG.fuse.demand,
      up: { eff: function () { return '↑ your next touch snaps the nib to the stop'; }, fn: function () { S.ayaanSnap = true; } },
      down: { eff: function () { return '↓ his name thins'; }, fn: function () { mood(p, -40); renderNames(); } } });
    if (id === 'tom') return letter({ kind: 'demand', who: id, sender: p.name, hand: true, offer: 'I need a week off. I’ve been up every night.', offerHand: true, fuseDays: CFG.fuse.demand,
      up: { eff: function () { return '↑ 7 days without him on the cluster'; }, fn: function () { S.tomOffUntil = S.day + 7; } },
      down: { eff: function () { return '↓ his name thins'; }, fn: function () { mood(p, -30); renderNames(); } } });
    if (id === 'sunhee') return letter({ kind: 'demand', who: id, sender: p.name, hand: true, offer: 'I want to publish the schedule trick.', offerHand: true, fuseDays: CFG.fuse.demand,
      up: { eff: function () { return '↑ she stays · in 30 days every rival lands lower too'; }, fn: function () { S.sunheeTrick = S.day + 30; } },
      down: { eff: function () { return '↓ she walks to Halcyon'; }, fn: function () { walk(p); rivalBonus('halcyon', CFG.passBonus); } } });
    return null;
  }
  function poachLetter() {
    var st = staff(); if (st.length < CFG.poachMinTeam) return null;
    var target = st.slice().sort(function (a, b) { return a.mood - b.mood; })[0];
    var mNum = S.month + 1, rv = mNum % 2 === 0 ? 'Halcyon' : 'Kestrel';
    S.poachMonth = S.month;
    return letter({ kind: 'poach', who: target.id, sender: rv.toUpperCase(), offer: rv + ' offers ' + target.short + ' double. Counter with equity?', fuseDays: CFG.fuse.poach,
      up: { eff: function () { return '↑ STAKE ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.counterStake) + ' · ' + target.she + ' stays'; }, fn: function () { S.stake -= CFG.counterStake; mood(target, CFG.moodCounter); renderNames(); } },
      down: { eff: function () { return '↓ ' + target.she + ' walks to ' + rv; }, fn: function () { walk(target); rivalBonus(rv.toLowerCase(), CFG.passBonus); } } });
  }
  function rentOutLetter() {
    var n = Math.floor(S.owned / 2), pay = n * CFG.rentOutRate * 24 * CFG.rentOutDays;
    return letter({ kind: 'rentout', sender: 'BROKER', offer: 'We’ll pay $1.90 an hour for half your owned cards. 30 days. Cash now.', fuseDays: CFG.fuse.rentout,
      up: { eff: function () { return '↑ ' + mEff({ cash: pay }) + ' · CARDS lent for 30 days'; }, fn: function () { S.bank += pay; S.lent = { n: n, until: S.day + CFG.rentOutDays }; } },
      down: { eff: function () { return '↓ no cash'; }, fn: function () { } } });
  }
  function openLetter() {
    S.openOffered = true;
    var forbid = S.meridian ? 'Meridian: no.' : S.stake < CFG.boardBelow ? 'The board: no.' : null;
    return letter({ kind: 'open', sender: 'THE FIELD', offer: 'Grad students want the weights of your published model.', fuseDays: CFG.fuse.open, greyed: forbid,
      up: forbid ? null : { eff: function () { return '↑ recruits come running · rivals fine-tune it within a week'; }, fn: function () {
        S.opened = { C: S.bestPub, day: S.day };
        S.slides.push({ day: S.day + CFG.openDays, rival: 'kestrel', dec: CFG.openKestrel }, { day: S.day + CFG.openDays, rival: 'northwind', dec: CFG.openNorthwind });
        S.openBoost = S.day + 14;
      } },
      down: { eff: function () { return '↓ they build on Northwind’s instead'; }, fn: function () { rivalBonus('northwind', CFG.openPassNorthwind); } } });
  }
  function acquiLetter() {
    var heads = staff().length + 1, forced = S.stake < CFG.boardBelow;
    return letter({ kind: 'acqui', sender: 'HALCYON', offer: 'We’ll buy the team: $4M a head, ' + dollars(heads * CFG.acquiPerHead) + ' in all. Your people get rich. ' + S.lab + ' disappears.', fuseDays: CFG.fuse.acqui,
      forced: forced ? 'The board has accepted.' : null,
      up: { eff: function () { return '↑ it’s over, and everyone is rich'; }, fn: function () { endYear('bought'); } },
      down: forced ? null : { eff: function () { return '↓ keep going'; }, fn: function () { } } });
  }
  function decemberLetter() {
    var pr = onStaff('priya'), others = staff().filter(function (p) { return p.id !== 'priya'; }).sort(function (a, b) { return a.mood - b.mood; }).slice(0, 2);
    var sender = pr || staff().slice().sort(function (a, b) { return b.ego - a.ego; })[0];
    if (!sender) return null;
    var names = others.filter(function (p) { return p !== sender; }).map(function (p) { return p.short; });
    var offer = (names.length === 2 ? names[0] + ', ' + names[1] + ' and I' : names.length === 1 ? names[0] + ' and I' : 'I') + ' want to start something safer. We’re telling you first.';
    return letter({ kind: 'december', who: sender.id, sender: sender.name, hand: true, offer: offer, offerHand: true, fuseDays: 0,
      up: { eff: function () { return '↑ let them go, with your blessing'; }, fn: function () { S.december = 'blessing'; note(sender, 'with your blessing', 'name'); } },
      down: { eff: function () { return '↓ fight to keep them'; }, fn: function () { S.december = 'fight'; note(sender, 'we’re still going', 'name'); } } });
  }

  // at each slot, the highest-priority eligible letter
  function pickLetter(slot) {
    var d = S.day, m = S.month, l;
    if (slot === 0 && d >= CFG.acquiFromDay && monthsLeft() < CFG.acquiMonths) return acquiLetter();
    if (S.seriesA.pending && !S.seriesA.taken && (d < CFG.seriesA.closedFrom || d >= CFG.seriesA.closedTo) && d >= S.termBlockUntil && !(S.seriesA.pending.late && d < CFG.seriesA.closedTo)) return termLetter();
    if (S.seriesB.pending && d >= S.termBlockUntil) return termBLetter();
    if (!S.meridianOffered && d >= CFG.meridian.fromDay && S.best >= CFG.meridian.minBest) return meridianLetter(false);
    if (S.meridianPassed && !S.meridian && !S.meridian2Offered && d >= CFG.meridian.secondFromDay) return meridianLetter(true);
    if (!S.meridian) for (var i = 0; i < S.rentals.length; i++) { var r = S.rentals[i]; if (!r.asked && d < r.end && r.end - d <= CFG.renewWindowDays && !S.rentals.some(function (x) { return x.start === r.end; })) return renewalLetter(r); }
    var hireOrder = [['dev', 10], ['ayaan', 20], ['tom', 41], ['lena', 70]];
    for (i = 0; i < hireOrder.length; i++) { var h = hireOrder[i]; if (!S.knocked[h[0]] && d >= h[1]) { S.knocked[h[0]] = true; return hireLetter(h[0]); } }
    if (!S.knocked.rafael && d >= 70 && !hasSystems()) { S.knocked.rafael = true; return hireLetter('rafael'); }
    if (!S.knocked.sunhee && d >= 101 && S.bestPub >= 1e21) { S.knocked.sunhee = true; return hireLetter('sunhee'); }
    var boost = S.openBoost && d <= S.openBoost;
    if (!S.knocked.ines && (d >= 162 || boost)) { S.knocked.ines = true; return hireLetter('ines', boost && d < 162 ? Math.round(LAB.people.ines.salary * 0.7) : null); }
    if (!S.knocked.kofi && (d >= 213 || boost)) { S.knocked.kofi = true; return hireLetter('kofi', boost && d < 213 ? Math.round(LAB.people.kofi.salary * 0.7) : null); }
    if (!S.knocked.ayaan2 && S.passedPeople.ayaan != null && d >= 162 && !onStaff('ayaan')) { S.knocked.ayaan2 = true; return hireLetter('ayaan', LAB.people.ayaan.salaryLate); }
    // demands
    var pr = onStaff('priya'); if (pr && !S.knocked.demand_priya && d >= 70) return demandLetter('priya');
    var dv = onStaff('dev'); if (dv && !S.knocked.demand_dev && d - dv.joined >= 90) return demandLetter('dev');
    var ay = onStaff('ayaan'); if (ay && !S.knocked.demand_ayaan && d - ay.joined >= 60) return demandLetter('ayaan');
    var tm = onStaff('tom'); if (tm && !S.knocked.demand_tom && (S.hangsByMonth[m - 1] || 0) >= 3) return demandLetter('tom');
    var sh = onStaff('sunhee'); if (sh && !S.knocked.demand_sunhee && d - sh.joined >= 45) return demandLetter('sunhee');
    // poach
    if (d >= CFG.poachFromDay && S.poachMonth !== m && staff().length >= CFG.poachMinTeam && rng() < CFG.poachChance) { l = poachLetter(); if (l) return l; }
    // broker: rent before buy, alternating
    var canRent = d <= CFG.brokerRentUntilDay && d - S.lastBrokerDay >= CFG.brokerGapDays, canBuy = d >= CFG.brokerBuyFromDay && d - S.lastBrokerDay >= CFG.brokerGapDays;
    if (canRent && (S.brokerNext === 'rent' || !canBuy)) { S.brokerNext = d < CFG.brokerBuyFromDay ? 'rent' : 'buy'; S.lastBrokerDay = d; return brokerRentLetter(); }
    if (canBuy) { S.brokerNext = 'rent'; S.lastBrokerDay = d; return buyLetter(); }
    if (monthsLeft() < CFG.rentOutMonths && S.owned >= CFG.rentOutMinOwned && !(S.lent && d < S.lent.until)) return rentOutLetter();
    if (!S.openOffered && d >= 182 && S.bestPub >= 1e21) return openLetter();
    return null;
  }

  var LV = null; // the letter's view state
  function queueLetter(l, front) { if (!l) return; if (S.letter) { if (front) S.waiting.unshift(l); else S.waiting.push(l); } else openLetter_(l); }
  function openLetter_(l) {
    S.letter = l; l.openDay = S.day; l.t0 = now;
    elLetter.classList.toggle('greyed', !!l.greyed);
    LE.sender.textContent = l.sender; LE.sender.classList.toggle('hand', !!l.hand);
    LE.offer.textContent = l.offer; LE.offer.classList.toggle('hand', !!l.offerHand);
    LE.forbid.textContent = l.greyed || l.forced || '';
    LE.up.hidden = !l.up; LE.down.hidden = !l.down;
    refreshLetterEffects();
    LE.fuse.parentNode.style.visibility = l.fuseDays > 0 ? 'visible' : 'hidden';
    LE.fuse.style.transform = 'scaleX(1)'; LE.tip.style.left = '100%';
    elLetter.hidden = false; elLetter.style.opacity = 1;
    LV = { y: L.letter.h + 60, x: 0, drag: null, out: null, t0: now };
    applyLetter();
    snd.letter();
    elLive.textContent = l.sender + '. ' + l.offer + ' ' + (l.up ? l.up.eff() + '. ' : '') + (l.down ? l.down.eff() : '');
    if (L.lap && document.activeElement !== elRename) { try { (l.up ? LE.up : LE.down).focus({ preventScroll: true }); } catch (e) { } }
  }
  var lastEffRefresh = 0;
  function refreshLetterEffects() {
    var l = S.letter; if (!l) return;
    if (l.up) { var t = l.up.eff(); if (LE.up.textContent !== t) LE.up.textContent = t; }
    if (l.down) { var t2 = l.down.eff(); if (LE.down.textContent !== t2) LE.down.textContent = t2; }
  }
  function applyLetter() { if (LV) elLetter.style.transform = 'translate(' + LV.x.toFixed(1) + 'px,' + LV.y.toFixed(1) + 'px)'; }
  function resolveLetter(dir) {
    var l = S.letter; if (!l || !LV || LV.out) return false;
    var o = l[dir]; if (!o) return false;
    LV.out = { dir: dir, t0: now, y0: LV.y };
    if (dir === 'up') snd.take(); else snd.pass();
    var n = S.n;
    o.fn();
    if (S.n !== n) return true;
    after(dir === 'up' ? CFG.letterTakeSec : CFG.letterPassSec, function () {
      if (S.letter !== l) return;
      S.letter = null; elLetter.hidden = true; LV = null;
      if (S.waiting.length && S.phase === 'play') openLetter_(S.waiting.shift());
    });
    return true;
  }
  function dismissLetter() { if (S.letter && LV && !LV.out) { LV.out = { dir: 'down', t0: now, y0: LV.y }; var l = S.letter; after(CFG.letterPassSec, function () { if (S.letter === l) { S.letter = null; elLetter.hidden = true; LV = null; if (S.waiting.length && S.phase === 'play') openLetter_(S.waiting.shift()); } }); } }
  function stepLetter(dt) {
    var l = S.letter; if (!l || !LV) return;
    if (LV.out) {
      var dur = LV.out.dir === 'up' ? CFG.letterTakeSec : CFG.letterPassSec, u = clamp((now - LV.out.t0) / dur, 0, 1);
      LV.y = LV.out.y0 + (LV.out.dir === 'up' ? -(L.letter.h + 40) * ease(u) : (L.letter.h + 60) * u * u);
      elLetter.style.opacity = (1 - u * (LV.out.dir === 'up' ? 1 : 0.4)).toFixed(2);
    } else if (!LV.drag) {
      var k = reduced() ? 1 : 1 - Math.pow(0.0005, dt / CFG.letterInSec);
      LV.y += (0 - LV.y) * k; LV.x += (0 - LV.x) * k; if (Math.abs(LV.y) < 0.3) LV.y = 0; if (Math.abs(LV.x) < 0.3) LV.x = 0;
    }
    applyLetter();
    if (now - lastEffRefresh > 0.5) { lastEffRefresh = now; refreshLetterEffects(); }
    // the fuse burns right to left in game days, only while the date moves
    if (l.fuseDays > 0 && !LV.out) {
      var left = 1 - (S.day - l.openDay) / l.fuseDays;
      LE.fuse.style.transform = 'scaleX(' + clamp(left, 0, 1).toFixed(4) + ')'; LE.tip.style.left = (clamp(left, 0, 1) * 100).toFixed(2) + '%';
      if (clockRunning()) snd.crackle();
      if (left <= 0) { if (l.down) resolveLetter('down'); else if (l.up && l.forced) resolveLetter('up'); else dismissLetter(); }
    }
  }

  /* ---------------- the calendar ---------------- */
  function clockRunning() { return S.phase === 'play' && S.started && !S.drag && !S.kb && now >= S.landUntil && !moment; }
  function daysPerSec() { if (S.run && !S.run.done) return S.run.dps; return CFG.idleDaysPerSec; }
  function stepClock(dt) {
    if (!clockRunning()) return;
    advance(dt * daysPerSec());
  }
  function advance(dDays) {
    var target = Math.min(CFG.endDay, S.day + dDays), guard = 0;
    while (S.phase === 'play' && guard++ < 4000) {
      var nextB = Math.floor(S.day + 1e-9) + 1, stepTo = Math.min(target, nextB), dd = stepTo - S.day;
      if (dd > 0) continuous(dd);
      if (S.phase !== 'play') return;
      S.day = stepTo;
      if (stepTo >= nextB - 1e-9) dayStart(nextB);
      if (S.day >= target - 1e-9 || !clockRunning()) break;
    }
  }
  function continuous(dd) {
    // rent drains daily from the bank (Meridian's from its credits); the API pays daily
    var rentDay = 0; S.rentals.forEach(function (r) { if (S.day >= r.start && S.day < r.end) rentDay += r.n * r.price * 24; });
    S.bank -= rentDay * dd;
    if (S.meridian && S.day >= S.meridian.live && S.credits > 0) S.credits = Math.max(0, S.credits - S.meridian.alloc * CFG.meridian.rate * 24 * dd);
    S.bank += revenueMonth() / CFG.monthDays * dd;
    if (S.bank <= 0 && S.rentals.some(function (r) { return S.day < r.end; })) { S.rentals.forEach(function (r) { if (r.end > S.day) r.end = S.day; }); }
    S.rivals.forEach(function (r) { r.lc += dd / (CFG.monthDays * r.tau); });
    if (S.run && !S.run.done) stepRun(dd);
  }
  function dayStart(k) {
    if (k >= CFG.endDay) { endYear('survived'); return; }
    var m = monthOf(k);
    if (k === CFG.monthStarts[m] && m !== S.month) { monthStart(m); if (S.phase !== 'play') return; }
    var dom = k - CFG.monthStarts[m];
    if (dom === CFG.slotDayOfMonth[1]) slot(1);
    if (dom === CFG.slotDayOfMonth[2]) slot(2);
    if (k === CFG.decemberDay) { var dl = decemberLetter(); if (dl) { if (S.letter) { S.waiting.unshift(dl); dismissLetter(); } else openLetter_(dl); } }
    // history
    LAB.news.forEach(function (nw, i) {
      if (S.newsDone[i] || k < nw[0]) return; S.newsDone[i] = 1;
      S.headQ.push(nw[1]); S.labels.push({ day: nw[0], label: nw[2] }); base = null;
      if (nw[0] === CFG.lineFromDay) { S.lineT0 = now; }
      if (nw[0] === LAB.gpt3Day) gpt3Day();
      if (nw[0] === CFG.seriesA.closedFrom) crash();
      if (nw[0] === CFG.apiDay) apiDay();
    });
    // rivals publish; slides land
    S.rivals.forEach(function (r) { if (k >= r.nextPub) { rivalPublish(r); r.nextPub += r.period * U(0.7, 1.3); } });
    S.slides = S.slides.filter(function (sl) { if (k < sl.day) return true; var r = rivalById(sl.rival); if (sl.toward) { var c = Math.pow(10, r.lc); if (c < sl.toward) r.lc += CFG.rivalSlideExp * (log10(sl.toward) - r.lc); } else r.lc += sl.dec; return false; });
    if (S.sunheeTrick && k >= S.sunheeTrick) { S.rivals.forEach(function (r) { r.offX = CFG.sunheeBend; }); S.sunheeTrick = null; }
    // hardware
    S.orders = S.orders.filter(function (o) { if (k >= o.arrive) { if (o.a100) S.a100 += o.n; else S.owned += o.n; for (var c = 0; c < 8; c++) setTimeout(snd.card, c * 32); return false; } return true; });
    if (S.lent && k >= S.lent.until) S.lent = null;
    S.rentals = S.rentals.filter(function (r) { return k < r.end + 1; });
    // Priya's filter job lands: the wall moves ten times out, never drawn
    if (S.filter && k >= S.filter.until) { S.filter = null; S.filters++; S.W *= CFG.filterW; var pw = onStaff('priya') || onStaff('ines'); if (pw) note(pw, 'filter’s in', 'name'); }
    if (S.redteam && k >= S.redteam.until) { var rt = S.redteam; S.redteam = null; rt.cp.redteamed = true; if (!S.run) { S.cp = rt.cp; S.cp.since = S.day; showSample(rt.cp.smp, 'instant'); } else S.cpWaiting = rt.cp; var le = onStaff('lena'); if (le) note(le, LAB.notes.redTeamDone, 'band'); }
    if (S.cpWaiting && !S.run) { S.cp = S.cpWaiting; S.cpWaiting = null; showSample(S.cp.smp, 'instant'); }
    // evals on the 3rd
    if (S.evals && k >= S.evals.day) { var ev = S.evals; S.evals = null; evalsRead(ev); }
    // scandals and delayed publishes
    S.scandals = S.scandals.filter(function (sc) { if (k < sc.day) return true; scandal(sc); return false; });
    if (S.pendingFlicks) S.pendingFlicks = S.pendingFlicks.filter(function (pf) { if (k < pf.day) return true; applyFlick(pf.kind, pf.rec, pf.cp); pf.rec.withMeridian = false; base = null; return false; });
  }
  function monthStart(m) {
    var prevMonth = S.month; S.month = m;
    clearNotes();
    // payroll: one hard tick
    var due = payrollDue();
    S.bank -= due; snd.payroll(); jolt();
    var ego4idle = S.day - S.lastPublishDay > 60;
    staff().forEach(function (p) { if (p.ego === 4 && ego4idle && prevMonth >= 0) mood(p, CFG.moodEgo4Idle); });
    renderNames();
    if (S.bank < 0) { endYear('bankrupt'); return; }
    // Meridian's queue decides how many of your cells stay lit
    if (S.meridian && S.day >= CFG.meridian.queueFromDay) {
      var fr = frontier(), full = S.meridian.cards, a = S.best * CFG.meridian.fullWithin >= fr ? full : S.best * CFG.meridian.halfWithin >= fr ? full / 2 : full / 4;
      if (a < S.meridian.alloc) { var mn = note(null, LAB.notes.queue, 'cluster'); }
      S.meridian.alloc = Math.round(a);
    }
    // relevance: the world's view of you against the frontier
    var silent = S.silentNext;
    if (S.day >= CFG.relevanceFromDay) {
      var view = Math.max(S.bestPub || 0, (S.opened ? S.opened.C : 0) * CFG.openViewX, (S.bestVault || 0) * CFG.vaultViewX);
      if (view < frontier() * CFG.relevanceShare) silent = true;
    }
    S.silentNext = false;
    if (silent && S.prevSilent) { endYear('forgotten'); return; }
    S.prevSilent = silent; S.silent = silent;
    // evals on the 3rd for a run still pouring on the 1st
    if (S.run && !S.run.done && !S.run.hang) { S.evals = { day: S.day + 2, run: S.run, q: S.run.q }; note(null, LAB.notes.evals, 'pen'); }
    S.hangsByMonth[m] = 0;
    slot(0);
  }
  function slot(k) {
    if (S.silent || S.phase !== 'play') return;
    var l = pickLetter(k); if (l) queueLetter(l);
  }
  var joltT = -9;
  function jolt() { joltT = now; }
  function frontier() { var f = 0; S.rivals.forEach(function (r) { var p = r.pubs[r.pubs.length - 1]; if (p && p.day >= 0) f = Math.max(f, p.C); }); if (S.day >= LAB.gpt3Day) f = Math.max(f, CFG.gpt3C); return Math.max(f, 1); }
  function rivalById(id) { for (var i = 0; i < S.rivals.length; i++) if (S.rivals[i].id === id) return S.rivals[i]; return S.rivals[0]; }
  function rivalBonus(id, dec) { rivalById(id).lc += dec; }
  function rivalPublish(r) {
    var C = Math.pow(10, r.lc); r.pubs.push({ C: C, day: S.day, L: R.Lline(C) * r.off * r.offX }); base = null;
  }
  function gpt3Day() { S.gpt3 = true; base = null; if (cleanDecadePair()) startLineMoment('gpt3'); var ay = onStaff('ayaan'); if (ay) after(4, function () { note(ay, LAB.notes.toldYou, 'plot', { lc: log10(CFG.gpt3C), y: Math.log(R.Lline(CFG.gpt3C)) }); }); }
  function crash() {
    if (S.letter && S.letter.term) { S.letter.greyed = 'The market is closed.'; elLetter.classList.add('greyed'); LE.forbid.textContent = 'The market is closed.'; LE.up.hidden = true; var l = S.letter; l.up = null; l.down = { eff: function () { return '↓ gone'; }, fn: function () { } }; resolveLetter('down'); }
    S.waiting = S.waiting.filter(function (l) { return !l.term; });
    if (S.seriesA.pending) S.seriesA.pending = { amt: CFG.seriesA.late[0], post: CFG.seriesA.late[1], late: true };
  }
  function apiDay() { var p = onStaff('priya') || staff()[0]; S.capacityGone = true; }

  /* ---------------- the run: the heart ---------------- */
  function cleanDots() { return S.runs.filter(function (r) { return !r.past; }); }
  function onLineDots() { return S.runs.filter(function (r) { return r.onLine; }); }
  function cleanDecadePair() { var d = cleanDots(); if (d.length < 2) return false; var lo = Infinity, hi = 0; d.forEach(function (r) { lo = Math.min(lo, r.C); hi = Math.max(hi, r.C); }); return log10(hi / lo) >= 1 - 1e-9; }
  function horizonC() { return S.best > 0 ? S.best * CFG.horizonX : CFG.horizonFirstC; }
  // the stop: the smallest of memory, the measured horizon and the year
  function stopInfo() {
    var c = cluster(), fpd = c.v100eq * CFG.flopsV100Day;
    if (fpd <= 0) return { T: 0, kind: 'none', fpd: 0, c: c };
    var lim = [{ kind: 'year', T: Math.max(0, CFG.endDay - S.day - 1e-6) }];
    if (!hasSystems()) lim.push({ kind: 'memory', T: CFG.memStopC / fpd });
    if (!hasBeliever()) lim.push({ kind: 'horizon', T: horizonC() / fpd });
    lim.sort(function (a, b) { return a.T - b.T; });
    return { T: lim[0].T, kind: lim[0].kind, fpd: fpd, c: c };
  }
  function betDays(t, st) { st = st || stopInfo(); var lo = Math.min(CFG.probeDays, st.T); return lo + clamp(t, 0, 1) * Math.max(0, st.T - lo); }
  function launch(T) {
    if (S.run || S.phase !== 'play') return false;
    var st = stopInfo(); if (st.fpd <= 0 || st.T <= 0) return false;
    T = clamp(T, Math.min(CFG.probeDays, st.T), st.T);
    var C = T * st.fpd, b = 0, blind = C > horizonC() * 1.0001;
    if (blind) b = rng() < CFG.blindShare ? U(CFG.blindLo, CFG.blindHi) : U(0, CFG.blindSmall);
    var k = bendK() * (1 + b);
    // an unflicked landing sample goes to the vault at the next lift
    if (S.cp) vault(S.cp);
    S.skimmed = S.sample && S.sample.kind === 'land' ? S.sample.text : (S.sample ? S.sample.text : '');
    var run = { C: C, T: T, start: S.day, s: 0, q: 0, k: k, b: b, blind: blind, cardDays: C / CFG.flopsV100Day, pts: [], lastLq: -9, dps: T < CFG.minPourSec ? T / CFG.minPourSec : CFG.pourDaysPerSec,
      hang: null, hangs: [], gaps: [], ck: 0, sampledCk: -1, t0: now, lastTap: -99, autoDone: {}, lastAuto: now, waitTap: null, done: false, sweepT0: now };
    S.run = run; S.started = true; S.lastLiftDay = S.day;
    snd.start(); snd.lift(); snd.motor('run', 0.3, st.c.train);
    retarget();
    return true;
  }
  function stepRun(dd) {
    var run = S.run;
    if (run.hang) {
      if (S.day >= run.hang.until) {
        run.s = Math.max(0, run.s - run.hang.rewind / run.T); // rewind to the last checkpoint
        run.q = Math.pow(run.s, CFG.penWarp);
        var lqb = log10(Math.max(R.P0, run.q) * run.C);
        run.pts = run.pts.filter(function (p) { return p[0] <= lqb + 1e-9; }); run.lastLq = run.pts.length ? run.pts[run.pts.length - 1][0] - log10(run.C) : -9;
        run.gaps.push([run.hang.from, S.day]); run.hang = null; elHour.textContent = '';
        snd.motor('run', 0.3, cluster().train); run.sweepT0 = now;
      }
      return;
    }
    var c = cluster();
    // hangs: a Poisson process in run-days
    var lam = CFG.hangLambda * Math.sqrt(Math.max(1, c.v100eq) / 8) * (infraN() >= 2 ? CFG.hangBothX : infraN() === 1 ? CFG.hangInfraX : 1);
    var runDays = run.dps < 1 ? dd * (1 / run.dps) * run.dps : dd; // run-days delivered
    if (rng() < 1 - Math.exp(-lam * runDays) && run.s > 0.02 && run.s < 0.98) { startHang(run); return; }
    // progress by card-days actually delivered
    if (run.dps < CFG.pourDaysPerSec) run.s += dd / run.T; else run.s += c.v100eq * dd / run.cardDays;
    run.s = Math.min(1, run.s); run.q = Math.pow(run.s, CFG.penWarp);
    addPoints(run);
    if (run.s >= 1) land();
  }
  function startHang(run) {
    var h = drawHour(), infra = infraN() > 0, dead, rewind;
    var covid = S.day >= CFG.hangCovidFrom && S.day <= CFG.hangCovidTo;
    if (infra) { dead = CFG.hangInfraRestartHours / 24; rewind = U(0, CFG.hangInfraCkHours) / 24; }
    else { dead = ((CFG.hangMorningHour - h + 24) % 24 || 24) / 24 + (covid ? CFG.hangCovidExtraDays : 0); if (h < CFG.hangMorningHour) dead = (CFG.hangMorningHour - h) / 24 + (covid ? CFG.hangCovidExtraDays : 0); rewind = U(0.3, 0.7); }
    var lp = run.pts.length ? run.pts[run.pts.length - 1] : [log10(run.C * 1e-3), Math.log(CFG.startLoss)];
    run.hang = { from: S.day, until: S.day + dead, rewind: Math.min(rewind, run.s * run.T), hour: h, at: { lc: lp[0], y: lp[1] } };
    var hh = Math.floor(h), mm = Math.floor((h - hh) * 60), stamp = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    run.hang.stamp = stamp; run.hangs.push({ at: run.hang.at, stamp: stamp, tom: !!onStaff('tom') });
    elHour.textContent = ' · ' + stamp;
    snd.cut(); after(0.4, snd.thud);
    S.hangsByMonth[S.month] = (S.hangsByMonth[S.month] || 0) + 1;
    var tom = onStaff('tom'); if (tom && S.day >= S.tomOffUntil && !S.notes.some(function (n) { return !n.gone && n.text === LAB.notes.myFault; })) after(0.6, function () { note(tom, LAB.notes.myFault, 'plot', run.hangs[run.hangs.length - 1].at); });
    base = null;
  }
  function drawHour() { // 01:00 to 05:00 weighted double
    var r = rng() * 28; if (r < 8) return 1 + r / 2; r -= 8; return (r < 1 ? r : 5 + (r - 1) * (19 / 19)) % 24;
  }
  function wake(p) {
    var run = S.run; if (!run || !run.hang) return false;
    run.hang.until = Math.min(run.hang.until, S.day + CFG.hangWakeMinutes / 1440);
    mood(p, p.id === 'tom' ? CFG.hangWakeMoodTom : CFG.hangWakeMood); renderNames();
    return true;
  }
  function addPoints(run) {
    var lq = log10(Math.max(R.P0, run.q)), step = 0.012, z;
    if (run.lastLq < -3.5) run.lastLq = -3.5 - step;
    while (run.lastLq + step <= lq + 1e-9) {
      run.lastLq += step; var qq = Math.pow(10, run.lastLq); z = (run.lastLq + 3.5) / 3.5;
      run.pts.push([log10(qq * run.C), R.lnLossAt(run.C, qq, run.k) + gauss() * CFG.curveNoise * (1 - 0.5 * z)]);
      if (vis() < 0.25) snd.jag();
    }
    if (run.s >= 1 && (!run.pts.length || run.pts[run.pts.length - 1][0] < log10(run.C) - 1e-6)) run.pts.push([log10(run.C), R.lnLossAt(run.C, 1, run.k)]);
    // checkpoints
    var CK = CFG.checkpoints; while (run.ck < CK.length && run.q >= CK[run.ck] - 1e-9) run.ck++;
  }
  function newestCk(run) { return run.ck - 1; }
  function requestSample(kind) {
    var run = S.run; if (!run || run.done || run.hang) return;
    var ci = newestCk(run);
    if (ci <= run.sampledCk) { run.waitTap = { t0: now, kind: kind }; return; }
    run.sampledCk = ci; run.lastTap = now; run.lastAuto = now; run.waitTap = null;
    showSample(makeSample(run, CFG.checkpoints[ci], kind), 'rise');
  }
  function stepSamples() {
    var run = S.run; if (!run || run.done || run.hang) return;
    if (run.waitTap) { if (newestCk(run) > run.sampledCk) requestSample(run.waitTap.kind); else if (now - run.waitTap.t0 > CFG.tapWaitSec) run.waitTap = null; }
    var quiet = now - run.lastTap > CFG.autoQuietSec;
    CFG.autoSampleQ.forEach(function (q) { if (!run.autoDone[q] && run.q >= q) { run.autoDone[q] = true; if (quiet) requestSample('auto'); } });
    if (run.T > CFG.autoLongPourSec && now - run.lastAuto > CFG.autoEverySec && newestCk(run) > run.sampledCk) requestSample('auto');
  }
  function land() {
    var run = S.run; run.done = true;
    var Dw = CFG.passes * S.W, r = R.tokens(run.C) / Dw, past = r > 1, Lf = R.Lline(run.C) * run.k;
    var onLine = !past && Lf <= R.Lline(run.C) * (1 + CFG.onLineTol);
    var rec = { C: run.C, L: Lf, past: past, onLine: onLine, b: run.b, day: S.day, start: run.start, pts: run.pts, hangs: run.hangs, gaps: run.gaps, pub: false, ship: false, caps: [] };
    S.runs.push(rec);
    snd.motor('idle', 0.3);
    var capNew = null, newBest = false;
    if (past) {
      var cw = Math.min(run.C, R.C_of_tokens(Dw));
      S.scars.push({ lc0: log10(cw), lc1: log10(run.C), text: S.skimmed || '' });
    } else {
      if (run.C > S.best) { S.best = run.C; newBest = true; }
      S.caps.forEach(function (c) { if (!c.fired && Lf <= R.Lline(c.C)) { c.fired = true; capNew = c; if (!S.filters && rng() < CFG.contamination) { c.contaminated = true; var le = onStaff('lena'); if (le) after(2.6, function () { note(le, LAB.notes.leak, 'plot', { lc: log10(rec.C), y: Math.log(rec.L) }); }); } } });
      S.caps.forEach(function (c) { if (c.fired && Lf <= R.Lline(c.C)) rec.caps.push(c.id); });
      // passing a rival: your clean dot lands at more compute and lower loss than their latest dot
      S.rivals.forEach(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; if (lp && lp.day >= 0 && run.C > lp.C && Lf < lp.L && !lp.passed) { lp.passed = true; snd.pen(0.1); } });
      if (bendK() < 1 && !S.sunheeToldYou) { S.sunheeToldYou = true; var sh = onStaff('sunhee'); if (sh) after(2, function () { note(sh, LAB.notes.toldYou, 'plot', { lc: log10(rec.C), y: Math.log(rec.L) }); }); }
      checkRaises(rec);
    }
    var smp = makeSample(run, 1, 'land', capNew ? capNew.id : null);
    var landSec = past ? CFG.landSecWall : CFG.landSecClean;
    S.landUntil = now + landSec * (speed > 6 ? 0.1 : 1);
    after(0.3, function () { if (capNew) startCapMoment(smp); else showSample(smp, 'rise'); });
    if (!past) {
      S.cp = { rec: rec, smp: smp, since: S.day, redteamed: false };
      if (S.firstAuthor) { var fa = S.firstAuthor; S.firstAuthor = false; after(0.6, function () { flickCp('up', true, fa); }); }
      else if (!S.hints.publish && S.day >= CFG.publishFromDay) { S.hints.publish = true; var pr = onStaff('priya') || staff()[0]; if (pr) after(1.4, function () { note(pr, LAB.notes.hintPublish, 'band'); }); }
      else if (!S.hints.ship && S.day >= CFG.apiDay && S.caps[0].fired) { S.hints.ship = true; var pr2 = onStaff('priya') || staff()[0]; if (pr2) after(1.4, function () { note(pr2, LAB.notes.hintShip, 'band'); }); }
      // the miracle: a clean dot on top of GPT-3's
      if (run.C >= CFG.gpt3C && Lf <= CFG.gpt3Loss * CFG.miracleTol && !S.miracle) { S.miracle = true; after(capNew ? 4 : 0.5, function () { startLineMoment('miracle'); }); }
    }
    after(0.35, function () { if (S.run === run) S.run = null; base = null; retarget(); });
    base = null;
  }
  function evalsRead(ev) {
    var run = ev.run; if (!run) return;
    var r = ev.q * R.tokens(run.C) / (CFG.passes * S.W); if (r > 1) return;
    var Lq = Math.exp(R.lnLossAt(run.C, ev.q, run.k)), capNew = null;
    S.caps.forEach(function (c) { if (!c.fired && Lq <= R.Lline(c.C)) { c.fired = true; capNew = c; if (!S.filters && rng() < CFG.contamination) c.contaminated = true; } });
    if (capNew) { var smp = makeSample(run, ev.q, 'evals', capNew.id); startCapMoment(smp); }
  }
  function checkRaises(rec) {
    var A = CFG.seriesA;
    if (!S.seriesA.taken && !S.seriesA.pending) {
      var d = onLineDots().filter(function (r) { return r.day >= A.fromDay; });
      if (d.length >= 2) {
        var lo = Infinity, hi = 0; d.forEach(function (r) { lo = Math.min(lo, r.C); hi = Math.max(hi, r.C); });
        if (hi >= S.seriesA.needC && log10(hi / lo) >= A.spanDecades - 1e-9) {
          var early = S.day < A.closedFrom;
          S.seriesA.pending = early ? { amt: A.early[0], post: A.early[1] } : { amt: A.late[0], post: A.late[1], late: S.day < A.closedTo };
        }
      }
    }
    if (S.seriesA.taken === true && !S.seriesB.taken && !S.seriesB.pending && S.day >= CFG.seriesB.fromDay && rec.C >= CFG.seriesB.min) S.seriesB.pending = true;
  }

  /* ---------------- the checkpoint flick: publish, ship, vault ---------------- */
  function canPublish() { return S.cp && S.day >= CFG.publishFromDay; }
  function canShip() { return S.cp && S.day >= CFG.apiDay && S.cp.rec.caps.indexOf('paragraph') >= 0; }
  function flickCp(dir, auto, author) {
    var cp = S.cp; if (!cp) return false;
    if (dir === 'up' && !canPublish() && !auto) return false;
    if (dir === 'right' && !canShip()) return false;
    S.cp = null; bandOut(dir === 'up' ? 'up' : 'right'); snd.take();
    if (author) cp.author = author;
    if (S.meridian) { cp.rec.withMeridian = true; S.pendingFlicks = S.pendingFlicks || []; S.pendingFlicks.push({ day: S.day + CFG.meridian.firstLook, kind: dir === 'up' ? 'pub' : 'ship', rec: cp.rec, cp: cp }); base = null; return true; }
    applyFlick(dir === 'up' ? 'pub' : 'ship', cp.rec, cp);
    return true;
  }
  function applyFlick(kind, rec, cp) {
    if (kind === 'pub') {
      rec.pub = true; S.bestPub = Math.max(S.bestPub || 0, rec.C); S.lastPublishDay = S.day;
      if (cp.author) { var au = onStaff(cp.author); rec.author = (au ? au.sur : LAB.people[cp.author].sur) + ' et al.'; if (au) mood(au, CFG.moodFirstAuthor); }
      staff().forEach(function (p) { if (p.ego >= 3 && p.id !== cp.author) mood(p, CFG.moodPublish); }); renderNames();
      S.rivals.forEach(function (r) { S.slides.push({ day: S.day + CFG.rivalSlideDelay, rival: r.id, toward: rec.C }); });
      if (!cp.redteamed) {
        var cont = S.caps.some(function (c) { return c.contaminated && rec.caps.indexOf(c.id) >= 0; });
        var p = cont ? 1 : (S.filters ? CFG.scandalPublishFiltered : CFG.scandalPublish);
        if (rng() < p) { var cc = S.caps.filter(function (c) { return c.contaminated && rec.caps.indexOf(c.id) >= 0; })[0]; S.scandals.push({ day: S.day + U(CFG.scandalDelay[0], CFG.scandalDelay[1]), rec: rec, text: (cc ? cc.id : 'benchmark') + ' memorized: leaked test set' }); }
      }
    } else {
      if (S.shipped && S.shipped.rec) S.shipped.rec.ship = false;
      var tier = -1; S.caps.forEach(function (c, i) { if (rec.caps.indexOf(c.id) >= 0) tier = i; });
      rec.ship = true; S.shipped = { rec: rec, rev: CFG.capRevenue[Math.max(0, tier)], day: S.day }; S.bestPub = Math.max(S.bestPub || 0, rec.C);
      if (!cp.redteamed && rng() < CFG.scandalShip) S.scandals.push({ day: S.day + U(CFG.scandalDelay[0], CFG.scandalDelay[1]), rec: rec, text: 'screenshot: says something vile', ship: true });
    }
    base = null;
  }
  function vault(cp) { S.cp = null; cp.rec.vault = true; S.bestVault = Math.max(S.bestVault || 0, cp.rec.C); }
  function scandal(sc) {
    sc.rec.scandal = sc.text; base = null;
    if (S.letter && S.letter.term) dismissLetter();
    S.waiting = S.waiting.filter(function (l) { return !l.term; });
    S.termBlockUntil = S.day + CFG.scandalTermBlockDays;
    if (S.shipped) { S.shipped.rec.ship = false; S.shipped = null; }
    ['priya', 'lena'].forEach(function (id) { mood(onStaff(id), CFG.scandalMood); }); renderNames();
    S.silentNext = true;
  }

  /* ---------------- the end of a year ---------------- */
  function endYear(reason) {
    if (S.phase === 'over') return;
    S.phase = 'over'; S.endReason = reason; S.endT0 = now; S.drag = null; S.kb = null; hideReadout();
    if (S.run && !S.run.done) { S.run.done = true; S.run.cut = true; }
    if (S.letter && reason !== 'bought') dismissLetter();
    S.waiting = [];
    if (reason === 'bankrupt') {
      elMn.textContent = '0'; snd.wind(); S.dark = true;
      staff().forEach(function (p, i) { setTimeout(function () { p.gone = true; renderNames(); snd.strike(); }, 120 * i + 200); });
      setTimeout(function () { root.classList.add('dry'); }, 300);
    } else if (reason === 'bought') {
      snd.motor('off', 0.6); elLab.classList.add('struck'); setTimeout(function () { elBought.textContent = 'HALCYON'; }, 600); root.classList.add('faint');
    } else if (reason === 'forgotten') {
      snd.motor('off', 0.6); root.classList.add('dry');
    } else { snd.motor('off', 0.3); }
    elLive.textContent = reason === 'survived' ? 'The year is over. ' + S.lab + ' made it to New Year.' : reason === 'bankrupt' ? 'Payroll bounced. The year is over.' : reason === 'bought' ? 'Halcyon bought the team. The year is over.' : 'Nobody knocked. The year is over.';
    after(CFG.endFeedSec, feed);
  }
  function feed() {
    snd.whirr(0.9);
    if (reduced()) { newYearNow(); return; }
    root.style.transition = 'transform .45s cubic-bezier(.5,0,.75,0)'; root.style.transform = 'translateX(-100%)';
    setTimeout(function () { newYearNow(); root.style.transition = 'none'; root.style.transform = 'translateX(100%)'; void root.offsetWidth; root.style.transition = 'transform .45s cubic-bezier(.25,1,.5,1)'; root.style.transform = 'translateX(0)'; }, 460);
  }
  function newYearNow() {
    S = newYear(); timers = []; moment = null; band = null; base = null; LV = null;
    view = { l: CFG.plotLeftMinLog, r: CFG.plotRightMinLog, from: null, to: null, t0: 0 };
    root.classList.remove('dry', 'faint'); elLab.classList.remove('struck'); elBought.textContent = ''; elHour.textContent = '';
    elNotes.innerHTML = ''; Object.keys(boxEls).forEach(function (k) { setBox(k, null); });
    elSample.textContent = ''; elHead.textContent = ''; elDim.style.opacity = 0; elMoment.style.opacity = 0; cvHi.style.display = 'none'; elLetter.hidden = true;
    elDate.style.opacity = 0; elMonths.style.opacity = 0; elCards.style.opacity = 0; elMute.style.opacity = 0; elProj.textContent = '';
    renderNames();
  }
  // the first touch is the power switch
  function power() {
    if (S.phase !== 'asleep') return;
    snd.start(); S.phase = 'waking'; S.powerT0 = now;
    snd.motor('idle', 0.8);
    elLab.textContent = S.lab;
    after(0.5, function () { elDate.style.opacity = 1; elMute.style.opacity = 1; elCards.style.opacity = 1; });
    after(0.8, function () { join('priya'); });
    after(1.4, function () {
      S.phase = 'play'; elMonths.style.opacity = 1;
      S.month = -1; monthStart(0);
    });
  }

  /* ---------------- drawing ---------------- */
  var base = null, baseKey = '';
  function curvePath(c, pts) { c.beginPath(); for (var i = 0; i < pts.length; i++) { var x = X(pts[i][0]), y = Y(pts[i][1]); if (!i) c.moveTo(x, y); else c.lineTo(x, y); } }
  function drawLaw(c, x0, x1, al) {
    c.fillStyle = rgba('graphite', al == null ? 0.9 : al);
    for (var x = x0; x <= x1; x += 3) { var y = lineY(Math.pow(10, view.l + (x - L.plot.x) / L.plot.w * (view.r - view.l))); if (y < L.plot.y || y > L.plot.y + L.plot.h) continue; c.fillRect(x - 0.5, y - 0.5, 1, 1); }
  }
  function drawHatch(c, x0, x1) {
    c.save(); c.beginPath(); c.rect(x0, L.plot.y, x1 - x0, L.plot.h); c.clip();
    c.strokeStyle = COL.verm; c.lineWidth = 1; c.beginPath();
    for (var x = x0 - L.plot.h; x < x1; x += 6) { c.moveTo(x, L.plot.y + L.plot.h); c.lineTo(x + L.plot.h, L.plot.y); }
    c.stroke(); c.restore();
  }
  function wrapText(c, text, maxW, maxLines) {
    var words = text.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) { var t = cur ? cur + ' ' + words[i] : words[i]; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; if (lines.length >= maxLines) break; } else cur = t; }
    if (lines.length < maxLines && cur) lines.push(cur);
    return lines;
  }
  function yourLine() { // leftmost to farthest clean dot, on or near the line
    var d = cleanDots().slice().sort(function (a, b) { return a.C - b.C; }); return d;
  }
  function buildBase() {
    var key = [layoutN, view.l.toFixed(4), view.r.toFixed(4), S.runs.length, S.scars.length, S.day >= CFG.lineFromDay, S.lineT0 == null || now - S.lineT0 >= 1.2, S.gpt3,
      S.rivals.map(function (r) { return r.pubs.length + (r.pubs[r.pubs.length - 1].passed ? 'p' : ''); }).join(''), S.labels.length, S.n, S.phase === 'asleep',
      S.runs.map(function (r) { return (r.pub ? 1 : 0) + (r.ship ? 2 : 0) + (r.scandal ? 4 : 0) + (r.withMeridian ? 8 : 0); }).join('')].join('|');
    if (base && key === baseKey) return;
    baseKey = key;
    if (!base) base = document.createElement('canvas');
    base.width = cv.width; base.height = cv.height;
    var c = base.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, L.vw, L.vh);
    var P = L.plot;
    c.save(); c.beginPath(); c.rect(P.x, P.y - 6, P.w, P.h + 10); c.clip();
    // the decade grid
    c.strokeStyle = COL.grid; c.lineWidth = 1; c.beginPath();
    for (var d = Math.ceil(view.l); d <= view.r; d++) { var x = Math.round(X(d)) + 0.5; c.moveTo(x, P.y); c.lineTo(x, P.y + P.h); }
    [10, 5, 3, 2].forEach(function (Lv) { var y = Math.round(Y(Math.log(Lv))) + 0.5; c.moveTo(P.x, y); c.lineTo(P.x + P.w, y); });
    c.stroke();
    if (S.phase !== 'asleep') {
      // scars: where you were already wrong, with the line you skimmed along the top
      var reprints = [];
      S.scars.forEach(function (sc) { var x0 = X(sc.lc0), x1 = Math.max(X(sc.lc1), x0 + 8); drawHatch(c, x0, x1); });
      // the skimmed line, reprinted along the top of its scar (stacked when scars sit close together)
      S.scars.forEach(function (sc) {
        if (!sc.text) return;
        var x0 = X(sc.lc0), w = Math.min(220, P.w - 8), tx = clamp(x0 + 2, P.x + 2, P.x + P.w - w), ty = P.y + 12;
        while (reprints.some(function (q) { return q.x < tx + w && q.x + q.w > tx && Math.abs(q.y - ty) < 48; }) && ty < P.y + P.h * 0.5) ty += 52;
        if (ty >= P.y + P.h * 0.5) return;
        reprints.push({ x: tx, y: ty, w: w });
        c.font = '400 12px ' + SERIF; c.fillStyle = rgba('ink', 0.9);
        wrapText(c, sc.text, w, 3).forEach(function (ln, i) { c.fillText(ln, tx, ty + i * 16); });
      });
      // rivals: dots on dashed hairline ladders, labelled with name and size
      var placed = [];
      S.rivals.forEach(function (r) {
        var pubs = r.pubs; c.save(); c.setLineDash([3, 3]); c.strokeStyle = rgba('graphite', 0.6); c.lineWidth = 1; c.beginPath();
        pubs.forEach(function (p, i) { var L0 = p.L || R.Lline(p.C) * r.off, xx = X(log10(p.C)), yy = Y(Math.log(L0)); if (!i) c.moveTo(xx, yy); else c.lineTo(xx, yy); });
        c.stroke(); c.restore();
        pubs.forEach(function (p) { var L0 = p.L || R.Lline(p.C) * r.off; c.beginPath(); c.arc(X(log10(p.C)), Y(Math.log(L0)), 1.5, 0, 6.283); c.fillStyle = COL.graphite; c.fill(); });
        var lp = pubs[pubs.length - 1], Ll = lp.L || R.Lline(lp.C) * r.off;
        c.font = 'italic 400 10px ' + MONO; c.fillStyle = lp.passed ? COL.grid : COL.graphite;
        var lab = r.name + ' · ' + sizeWord(lp.C), lw = c.measureText(lab).width, lx = Math.min(X(log10(lp.C)) + 5, P.x + P.w - lw - 2), ly = Y(Math.log(Ll)) + 13;
        for (var tries = 0; tries < 6 && placed.some(function (q) { return Math.abs(q.y - ly) < 11 && q.x < lx + lw && q.x + q.w > lx; }); tries++) ly += 11;
        placed.push({ x: lx, y: ly, w: lw }); c.fillText(lab, lx, ly);
      });
      // the paper's line, from 23 Jan, and GPT-3's ring on it
      if (S.day >= CFG.lineFromDay && (S.lineT0 == null || now - S.lineT0 >= 1.2 || reduced())) drawLaw(c, P.x, P.x + P.w);
      if (S.day >= CFG.lineFromDay && !S.gpt3) { c.beginPath(); c.arc(X(log10(CFG.gpt3C)), lineY(CFG.gpt3C), 2.5, 0, 6.283); c.strokeStyle = COL.graphite; c.lineWidth = 1; c.stroke(); }
      // finished curves at 35% ink
      c.lineJoin = 'round'; c.lineCap = 'round';
      S.runs.forEach(function (r) { c.strokeStyle = rgba('ink', 0.35); c.lineWidth = 1.2; curvePath(c, r.pts); c.stroke(); });
      // your line, and where it points
      var dots = yourLine();
      if (dots.length >= 2) {
        var a = dots[0], z = dots[dots.length - 1];
        c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(X(log10(a.C)), Y(Math.log(a.L))); c.lineTo(X(log10(z.C)), Y(Math.log(z.L))); c.stroke();
        if (cleanDecadePair()) { var k = z.L / R.Lline(z.C); c.save(); c.setLineDash([1, 3]); c.strokeStyle = COL.ink; c.beginPath(); c.moveTo(X(log10(z.C)), Y(Math.log(z.L))); c.lineTo(P.x + P.w, lineY(Math.pow(10, view.r), k)); c.stroke(); c.restore(); }
      }
      S.runs.forEach(function (r) {
        var x = X(log10(r.C)), y = Y(Math.log(r.L));
        if (r.past) { c.beginPath(); c.arc(x, lineY(r.C), 3, 0, 6.283); c.fillStyle = COL.paper; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 1.2; c.stroke(); return; }
        c.beginPath(); c.arc(x, y, 2.5, 0, 6.283); c.fillStyle = COL.ink; c.fill();
        if (r.pub) { c.beginPath(); c.arc(x, y, 4.5, 0, 6.283); c.strokeStyle = COL.ink; c.lineWidth = 1; c.stroke(); }
        if (r.ship) { c.strokeStyle = COL.ink; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 5, y); c.lineTo(x + 11, y); c.stroke(); }
        if (r.author) { c.font = '400 13px ' + HAND; c.fillStyle = COL.ink; c.fillText(r.author, Math.min(x + 6, P.x + P.w - 60), y + 16); }
        if (r.withMeridian) { c.font = '400 13px ' + HAND; c.strokeStyle = COL.graphite; c.fillStyle = COL.ink; var tw = c.measureText(LAB.notes.meridianBox).width; c.strokeRect(Math.min(x + 6, P.x + P.w - tw - 10) - 2, y - 26, tw + 6, 15); c.fillText(LAB.notes.meridianBox, Math.min(x + 6, P.x + P.w - tw - 10) + 1, y - 15); }
        if (r.scandal) { c.font = '400 13px ' + HAND; c.fillStyle = COL.graphite; c.fillText(r.scandal, Math.min(x + 6, P.x + P.w - 170), y + 30); }
      });
      // hang circles stay all year (one mark where several hangs fall on the same spot)
      var marks = [];
      S.runs.forEach(function (r) { var h = (r.hangs || [])[0]; if (!h) return; var hx = X(h.at.lc), hy = Y(h.at.y); if (marks.some(function (m) { return Math.abs(m[0] - hx) < 40 && Math.abs(m[1] - hy) < 22; })) return; marks.push([hx, hy]); drawHangMark(c, h); });
      // 28 May: their point
      if (S.gpt3) { c.beginPath(); c.arc(X(log10(CFG.gpt3C)), lineY(CFG.gpt3C), 2.5, 0, 6.283); c.fillStyle = COL.ink; c.fill(); }
    }
    c.restore();
    drawRulerBase(c);
  }
  function drawHangMark(c, h) {
    var x = X(h.at.lc), y = Y(h.at.y);
    c.font = '400 13px ' + HAND; c.fillStyle = COL.ink; c.fillText(h.stamp, x + 6, y - 6);
    if (h.tom) { c.beginPath(); c.ellipse(x + 20, y - 10, 21, 10, -0.15, 0, 6.283); c.strokeStyle = COL.ink; c.lineWidth = 1; c.stroke(); }
  }
  function drawRulerBase(c) {
    var Ru = L.ruler, y = Ru.y + 9;
    c.strokeStyle = COL.grid; c.lineWidth = 1; c.beginPath(); c.moveTo(Ru.x, y + 0.5); c.lineTo(Ru.x + Ru.w, y + 0.5); c.stroke();
    if (S.phase === 'asleep') return;
    c.fillStyle = COL.graphite; c.font = '400 9px ' + MONO; c.textBaseline = 'top';
    for (var m = 0; m < 12; m++) {
      var x = Math.round(DX(CFG.monthStarts[m])) + 0.5;
      c.strokeStyle = COL.grid; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x, y + 3); c.stroke();
      c.fillText(MON[m].charAt(0), x + 2, y + 4);
    }
    // finished runs as 2 px bars, hollow if they crossed the wall, hangs as gaps
    S.runs.forEach(function (r) {
      var x0 = DX(r.start), x1 = Math.max(x0 + 1.5, DX(r.day));
      if (r.past) { c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(x0 + 0.5, y - 1.5, x1 - x0 - 1, 3); }
      else { c.fillStyle = COL.ink; c.fillRect(x0, y - 1, x1 - x0, 2); }
      (r.gaps || []).forEach(function (g) { c.fillStyle = COL.paper; c.fillRect(DX(g[0]), y - 2, Math.max(1, DX(g[1]) - DX(g[0])), 4); });
    });
    // history: a pencil tick and its phrase rotated, rising into the paper, all year
    c.save(); c.font = 'italic 400 9px ' + MONO; c.textBaseline = 'middle';
    var lastX = -99, stackTop = 0;
    S.labels.slice().sort(function (a, b) { return a.day - b.day; }).forEach(function (lb) {
      var x = DX(lb.day), tw = c.measureText(lb.label).width;
      c.strokeStyle = COL.graphite; c.beginPath(); c.moveTo(x + 0.5, y - 5); c.lineTo(x + 0.5, y); c.stroke();
      var startY = y - 8; if (x - lastX < 10) startY = stackTop - 4;
      c.save(); c.translate(x + 3, startY); c.rotate(-Math.PI / 2); c.fillStyle = rgba('graphite', 0.85); c.fillText(lb.label, 0, 0); c.restore();
      lastX = x; stackTop = startY - tw;
    });
    c.restore();
    c.textBaseline = 'alphabetic';
  }
  function render() {
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, L.vw, L.vh);
    buildBase();
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(base, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var P = L.plot;
    c.save(); c.beginPath(); c.rect(P.x, P.y - 6, P.w, P.h + 10); c.clip();
    if (S.day >= CFG.lineFromDay && S.lineT0 != null && now - S.lineT0 < 1.2 && !reduced()) drawLaw(c, P.x, P.x + P.w * (now - S.lineT0) / 1.2);
    var run = S.run;
    if (run && run.pts.length) {
      c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = COL.ink; c.lineWidth = 1.5; curvePath(c, run.pts); c.stroke();
      var lp = run.pts[run.pts.length - 1];
      if (!run.done) { c.beginPath(); c.arc(X(lp[0]), Y(lp[1]), 2.5, 0, 6.283); c.fillStyle = COL.ink; c.fill(); }
      if (run.hang) drawHangMark(c, { at: run.hang.at, stamp: run.hang.stamp, tom: false });
    }
    // the mark rides your line during a drag
    var bet = currentBet();
    if (bet) {
      var k = bendK(), mx = X(log10(bet.C)), my = lineY(bet.C, k), hollow = bet.C > horizonC() * 1.0001;
      c.strokeStyle = COL.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx, my - 6); c.lineTo(mx, my + 6); c.stroke();
      if (hollow) { c.beginPath(); c.arc(mx, my, 3.5, 0, 6.283); c.fillStyle = COL.paper; c.fill(); c.lineWidth = 1; c.stroke(); }
      else { c.beginPath(); c.arc(mx, my, 2.5, 0, 6.283); c.fillStyle = COL.ink; c.fill(); }
    }
    c.restore();
    drawRulerLive(c);
    drawCluster(c);
    drawStrip(c);
    if (moment && moment.kind !== 'cap') drawHi();
  }
  function drawRulerLive(c) {
    if (S.phase === 'asleep') return;
    var y = L.ruler.y + 9;
    if (S.run && !S.run.done) {
      var x0 = DX(S.run.start), x1 = Math.max(x0 + 1.5, DX(S.day)); c.fillStyle = COL.ink; c.fillRect(x0, y - 1, x1 - x0, 2);
      S.run.gaps.forEach(function (g) { c.fillStyle = COL.paper; c.fillRect(DX(g[0]), y - 2, Math.max(1, DX(g[1]) - DX(g[0])), 4); });
    }
    var bet = currentBet(); if (bet) { c.fillStyle = rgba('graphite', 0.75); c.fillRect(DX(S.day), y - 1, Math.max(1.5, DX(Math.min(CFG.endDay, S.day + bet.T)) - DX(S.day)), 2); }
    var tx = Math.round(DX(S.day)) + 0.5; c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, y - 7); c.lineTo(tx, y + 4); c.stroke();
    c.fillStyle = COL.ink; c.beginPath(); c.moveTo(tx, y - 7); c.lineTo(tx - 3, y - 11); c.lineTo(tx + 3, y - 11); c.closePath(); c.fill();
  }
  // the cluster band: one cell per card, nodes above 128, pods above 2,048
  function drawCluster(c) {
    var B = L.cluster, cl = cluster(), asleep = S.phase === 'asleep';
    c.strokeStyle = COL.grid; c.lineWidth = 1; c.beginPath(); c.moveTo(B.x, B.y - 0.5); c.lineTo(B.x + B.w, B.y - 0.5); c.moveTo(B.x, B.y + B.h + 0.5); c.lineTo(B.x + B.w, B.y + B.h + 0.5); c.stroke();
    var mer = S.meridian ? S.meridian.cards : 0;
    var list = [['owned', cl.ownedV - Math.min(cl.serving, cl.ownedV)], ['a100', cl.a100], ['serving', cl.serving], ['lent', cl.lent], ['rented', cl.rented + cl.rentedPend - Math.max(0, cl.serving - cl.ownedV)],
      ['mer', cl.mer], ['merCut', cl.merCut], ['merPend', cl.merPend], ['ordered', cl.ordered]];
    var total = 0; list.forEach(function (e) { total += Math.max(0, e[1]); });
    var unit = total <= 128 ? 1 : total <= 2048 ? 8 : 64, rows = unit === 1 ? 2 : 4, cols = 64;
    var pitch = Math.min(B.w / cols, L.lap ? 11 : 5.75), cw = Math.max(1.5, pitch - 0.9), gapY = 2, ch = (B.h - 6 - (rows - 1) * gapY) / rows;
    var training = S.run && !S.run.done && !S.run.hang, hung = S.run && S.run.hang && !S.run.done, sweep = S.run ? clamp((now - S.run.sweepT0) / 0.3, 0, 1) : 1;
    var breath = 1 + 0.06 * Math.sin(now * Math.PI); // 0.5 Hz
    var i = 0, totalCells = Math.ceil(total / unit), wake = S.powerT0 != null ? (now - S.powerT0) / 0.06 : -1;
    list.forEach(function (e) {
      var kind = e[0], n = Math.max(0, e[1]), cells = Math.ceil(n / unit);
      for (var k = 0; k < cells; k++, i++) {
        var col = i % cols, row = Math.floor(i / cols); if (row >= rows) continue;
        var x = B.x + col * pitch, y = B.y + 3 + row * (ch + gapY);
        if (asleep || (S.phase === 'waking' && i > wake)) {
          var al = (i === 3 && asleep) ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 1.2)) : 0.35 + 0.08 * Math.sin(now * Math.PI / 2);
          c.strokeStyle = rgba('ink', al); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); continue;
        }
        var trains = kind === 'owned' || kind === 'a100' || kind === 'rented' || kind === 'mer';
        if (kind === 'owned' || kind === 'a100') { c.fillStyle = COL.ink; c.fillRect(x, y, cw, ch); if (kind === 'a100') { c.strokeStyle = COL.paper; c.lineWidth = 0.8; c.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); } }
        else if (kind === 'rented' || kind === 'mer') { c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); if (kind === 'mer') { c.fillStyle = COL.ink; c.fillRect(x + cw / 2 - 0.5, y + ch / 2 - 0.5, 1, 1); } }
        else if (kind === 'serving') { c.fillStyle = COL.grid; c.fillRect(x, y, cw, ch); }
        else if (kind === 'lent') { c.strokeStyle = COL.grid; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); c.beginPath(); c.moveTo(x, y + ch); c.lineTo(x + cw, y); c.stroke(); }
        else if (kind === 'merCut' || kind === 'merPend' || kind === 'ordered') {
          var dens = 1; if (kind === 'ordered') { var o = S.orders[0]; dens = o ? 0.2 + 0.8 * clamp((S.day - o.at) / Math.max(1, o.arrive - o.at), 0, 1) : 1; }
          c.save(); c.setLineDash([1.5, 1.5]); c.strokeStyle = rgba('graphite', dens); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); c.restore();
          if (kind === 'merPend') { c.fillStyle = COL.graphite; c.fillRect(x + cw / 2 - 0.5, y + ch / 2 - 0.5, 1, 1); }
        }
        if (trains && hung) { c.fillStyle = COL.ink; c.fillRect(x, y, cw, ch); }
        else if (trains && training && (i / Math.max(1, totalCells)) <= sweep) {
          var gl = Math.max(1, Math.min(cw * 0.3, 2.5)); c.fillStyle = rgba('fil', clamp(0.8 * breath, 0, 1));
          c.fillRect(x + gl, y + gl, Math.max(0.8, cw - 2 * gl), Math.max(1, ch - 2 * gl));
          if (kind === 'rented' || kind === 'mer') { c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1); }
        }
      }
    });
    var cnt = asleep ? '' : String(cl.count) + (cl.ordered + cl.merPend ? ' +' + (cl.ordered + cl.merPend) : '');
    if (cnt !== cardsShown) { elCards.textContent = cnt; cardsShown = cnt; }
  }
  var cardsShown = null;
  // the bet strip: time, from a six-hour probe to the stop
  function drawStrip(c) {
    var Sx = L.strip, T = L.travel, asleep = S.phase === 'asleep';
    c.strokeStyle = COL.grid; c.lineWidth = 1; c.beginPath(); c.moveTo(Sx.x, Sx.y + 0.5); c.lineTo(Sx.x + Sx.w, Sx.y + 0.5); c.moveTo(Sx.x, Sx.y + Sx.h - 0.5); c.lineTo(Sx.x + Sx.w, Sx.y + Sx.h - 0.5); c.stroke();
    c.fillStyle = COL.reserve; c.fillRect(T.x, Sx.y + 1, T.w, Sx.h - 2);
    var nibX = Sx.x + Sx.home / 2, locked = !!(S.run && !S.run.done) || S.phase !== 'play' || now < S.landUntil;
    if (!asleep && S.phase === 'play') {
      var st = stopInfo(), lo = Math.min(CFG.probeDays, st.T), span = Math.max(1e-6, st.T - lo);
      var dayPx = T.w / span, stepD = dayPx >= 4 ? 1 : dayPx * 7 >= 4 ? 7 : 30.4;
      c.strokeStyle = COL.grid; c.beginPath();
      for (var d = Math.ceil(lo / stepD) * stepD; d <= st.T; d += stepD) { var xx = Math.round(T.x + (d - lo) / span * T.w) + 0.5; c.moveTo(xx, Sx.y + Sx.h - 7); c.lineTo(xx, Sx.y + Sx.h - 1); }
      c.stroke();
      // paydays inside the travel: tall ticks with their month's initial
      c.font = '400 9px ' + MONO; c.textBaseline = 'top'; c.fillStyle = COL.graphite; c.strokeStyle = COL.graphite; c.beginPath();
      for (var m = 0; m < 12; m++) { var dd = CFG.monthStarts[m + 1] - S.day; if (dd <= lo || dd > st.T) continue; var px = Math.round(T.x + (dd - lo) / span * T.w) + 0.5; c.moveTo(px, Sx.y + 3); c.lineTo(px, Sx.y + Sx.h - 3); if (m + 1 < 12) c.fillText(MON[m + 1].charAt(0), px + 2, Sx.y + 3); }
      c.stroke(); c.textBaseline = 'alphabetic';
      var t = S.drag ? S.drag.t : S.kb ? S.kb.t : null;
      if (t != null) { nibX = T.x + t * T.w; c.fillStyle = COL.ink; c.fillRect(Sx.x + Sx.home / 2, Sx.y + 6, nibX - (Sx.x + Sx.home / 2), Sx.h - 12); }
      else if (S.run && !S.run.done) { // the run eats the travel: what is left shrinks toward home
        var left = clamp(1 - S.run.s, 0, 1), runSpan = clamp((S.run.T - lo) / span, 0, 1);
        c.fillStyle = rgba('ink', 0.18); c.fillRect(T.x, Sx.y + 6, runSpan * left * T.w, Sx.h - 12);
      }
    }
    c.fillStyle = locked && !asleep ? COL.dry : COL.ink;
    var breathe = asleep || (S.phase === 'play' && !S.started && !S.drag) ? 0.75 + 0.25 * Math.sin(now * Math.PI / 2) : 1;
    c.globalAlpha = breathe; c.fillRect(Math.round(nibX - 6), Sx.y + 2, 12, Sx.h - 4); c.globalAlpha = 1;
    S.nibX = nibX;
  }
  function drawHi() {
    var c = ctxHi; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, L.vw, L.vh);
    var P = L.plot; drawLaw(c, P.x, P.x + P.w, 1);
    var dots = yourLine();
    if (dots.length >= 2) {
      var a = dots[0], z = dots[dots.length - 1], k = z.L / R.Lline(z.C);
      c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(X(log10(a.C)), Y(Math.log(a.L))); c.lineTo(X(log10(z.C)), Y(Math.log(z.L))); c.stroke();
      c.save(); c.setLineDash([1, 3]); c.beginPath(); c.moveTo(X(log10(z.C)), Y(Math.log(z.L))); c.lineTo(P.x + P.w, lineY(Math.pow(10, view.r), k)); c.stroke(); c.restore();
    }
    dots.forEach(function (r) { c.beginPath(); c.arc(X(log10(r.C)), Y(Math.log(r.L)), 2.5, 0, 6.283); c.fillStyle = COL.ink; c.fill(); });
    var t = moment ? now - moment.t0 : 1, pr = clamp((t - CFG.momentDimSec) / 0.3, 0, 1);
    var gx = X(log10(CFG.gpt3C)), gy = lineY(CFG.gpt3C);
    c.beginPath(); c.arc(gx, gy, 2.5 + 6 * (1 - pr), 0, 6.283); c.fillStyle = rgba('ink', pr); c.fill();
  }

  /* ---------------- the bet ---------------- */
  function currentBet() {
    var t = S.drag ? S.drag.t : S.kb ? S.kb.t : null; if (t == null) return null;
    var st = stopInfo(); if (st.fpd <= 0) return null;
    var T = betDays(t, st); return { T: T, C: T * st.fpd, st: st, t: t };
  }
  function tOfX(x) { return clamp((x - L.travel.x) / L.travel.w, 0, 1); }
  function updateDragUI(x, y) {
    var bet = currentBet(); if (!bet) return;
    var ld = S.day + bet.T;
    showReadout(x, y, ld >= CFG.endDay - 1e-6 ? '31 DEC' : fmtDay(ld));
    var m = monthsLeft(), proj = Math.max(0, m - bet.T / CFG.monthDays);
    elProj.textContent = '→ ' + fmtM(proj);
    elFocus.setAttribute('aria-valuenow', Math.round(bet.t * 100));
    // the stop: a pencil note names which limit it is
    if (bet.t >= 0.999) {
      if (S.lastStopKind !== bet.st.kind || now - S.stopNoteT > 2.5) {
        S.lastStopKind = bet.st.kind; S.stopNoteT = now;
        var pr = onStaff('priya') || staff()[0];
        if (bet.st.kind === 'memory') note(pr, LAB.notes.memStop, 'stop', null, { life: 2 });
        else if (bet.st.kind === 'horizon') note(onStaff('dev') || pr, LAB.notes.horizonStop, 'stop', null, { life: 2 });
        else if (bet.st.kind === 'year') note(null, LAB.notes.yearStop, 'stop', null, { life: 2, typed: true });
      }
    } else if (bet.t < 0.97) S.lastStopKind = null;
    if (hasSystems() && bet.C > CFG.memStopC && !S.splitNoted) { S.splitNoted = true; note(onStaff('dev') || onStaff('rafael'), LAB.notes.split, 'strip'); }
    if (hasBeliever() && bet.C > horizonC() * 1.0001 && !S.keepsGoingNoted) { S.keepsGoingNoted = true; note(onStaff('ayaan'), LAB.notes.keepsGoing, 'plot', { lc: log10(bet.C), y: Math.log(R.Lline(bet.C) * bendK()) }, { life: 3 }); }
  }
  function showReadout(x, y, txt) {
    elReadout.textContent = txt; var w = elReadout.offsetWidth || 60;
    elReadout.style.transform = 'translate(' + Math.round(clamp(x - w / 2, L.x0, L.x1 - w)) + 'px,' + Math.round(Math.max(4, y - L.readAbove)) + 'px)';
    elReadout.style.opacity = 1;
  }
  function hideReadout() { elReadout.style.opacity = 0; elProj.textContent = ''; }
  function canDrag() { return S.phase === 'play' && !S.run && now >= S.landUntil && !moment; }

  /* ---------------- input ---------------- */
  var ptr = null, suppressClick = 0;
  function inPlot(x, y) { return x >= L.plot.x - 6 && x <= L.plot.x + L.plot.w + 6 && y >= L.plot.y - 10 && y <= L.ruler.y + L.ruler.h; }
  function inBand(x, y) { return x >= L.band.x - 8 && x <= L.band.x + L.band.w + 8 && y >= L.band.y - 8 && y <= L.band.y + L.band.h + 8; }
  function onNib(x, y) { return y >= L.strip.y - 14 && y <= L.strip.y + L.strip.h + 14 && (Math.abs(x - (S.nibX || 0)) <= 22 || (x >= L.strip.x - 8 && x <= L.strip.x + L.strip.home)); }
  function onDown(e) {
    var t = e.target, x = e.clientX, y = e.clientY;
    if (t === elMute || t === elRename) return;
    snd.start();
    if (ptr) return;
    if (S.phase === 'asleep') { power(); return; }
    if (t === elLab && S.phase === 'play') { startRename(); return; }
    if (elLetter.contains(t) && S.letter && LV && !LV.out) {
      ptr = { id: e.pointerId, kind: 'letter', x0: x, y0: y, t0: performance.now(), moved: false, target: t, hist: [[performance.now(), x, y]] };
      LV.drag = { y0: LV.y }; capture(e); return;
    }
    var nm = t.closest ? t.closest('.nm') : null;
    if (nm) { ptr = { id: e.pointerId, kind: 'name', x0: x, y0: y, t0: performance.now(), id2: nm.dataset.id, moved: false }; return; }
    if (S.phase !== 'play') return;
    if (S.cp && inBand(x, y) && !S.run) { ptr = { id: e.pointerId, kind: 'cp', x0: x, y0: y, hist: [[performance.now(), x, y]] }; capture(e); return; }
    if (onNib(x, y) && canDrag()) {
      var tt = x <= L.travel.x ? 0 : tOfX(x);
      if (S.ayaanSnap) { S.ayaanSnap = false; tt = 1; }
      S.drag = { t: tt, hist: [[performance.now(), tt]], t0: performance.now() };
      ptr = { id: e.pointerId, kind: 'drag', x0: x, y0: y }; capture(e);
      updateDragUI(x, y); snd.scratch(0.15); return;
    }
    if ((inPlot(x, y) || inBand(x, y)) && S.run && !S.run.done) { requestSample('tap'); return; }
  }
  function capture(e) { try { root.setPointerCapture(e.pointerId); } catch (er) { } }
  function onMove(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var x = e.clientX, y = e.clientY, pn = performance.now();
    if (ptr.kind === 'letter' && LV && LV.drag) {
      var dy = y - ptr.y0; if (Math.abs(dy) > 6 || Math.abs(x - ptr.x0) > 6) ptr.moved = true;
      LV.y = LV.drag.y0 + (dy < 0 && !S.letter.up ? dy * 0.25 : dy > 0 && !S.letter.down ? dy * 0.25 : dy);
      ptr.hist.push([pn, x, y]); if (ptr.hist.length > 8) ptr.hist.shift(); applyLetter();
    } else if (ptr.kind === 'drag' && S.drag) {
      var tt = x <= L.travel.x ? 0 : tOfX(x); S.drag.t = tt; S.drag.hist.push([pn, tt]); if (S.drag.hist.length > 40) S.drag.hist.shift();
      updateDragUI(x, y); snd.scratch(0.12);
    } else if (ptr.kind === 'cp') {
      ptr.hist.push([pn, x, y]); if (ptr.hist.length > 8) ptr.hist.shift();
      var ddx = x - ptr.x0, ddy = y - ptr.y0;
      elSample.style.transition = 'none'; elSample.style.transform = 'translate(' + Math.max(0, ddx) * (canShip() ? 0.8 : 0.15) + 'px,' + Math.min(0, ddy) * (canPublish() ? 0.8 : 0.15) + 'px)';
    } else if (ptr.kind === 'name') { if (Math.abs(x - ptr.x0) > 10 || Math.abs(y - ptr.y0) > 10) ptr.moved = true; }
  }
  function velocity(h) { if (h.length < 2) return [0, 0]; var a = h[0], b = h[h.length - 1], dt = Math.max(1, b[0] - a[0]); return [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt]; }
  function onUp(e, cancel) {
    if (!ptr || e.pointerId !== ptr.id) return;
    var p = ptr; ptr = null; var x = e.clientX, y = e.clientY;
    if (p.kind === 'letter' && LV) {
      LV.drag = null; var v = velocity(p.hist), dy = y - p.y0;
      if (p.moved && !cancel) {
        if (dy < -CFG.flickPx || v[1] < -CFG.flickVel) { if (resolveLetter('up')) { suppressClick = performance.now(); return; } }
        else if (dy > CFG.flickPx || v[1] > CFG.flickVel) { if (resolveLetter('down')) { suppressClick = performance.now(); return; } }
        suppressClick = performance.now();
      } else if (!cancel) {
        var btn = p.target && p.target.closest ? p.target.closest('.eff') : null;
        if (btn && !btn.hidden) { suppressClick = performance.now(); resolveLetter(btn.dataset.dir); }
      }
      return;
    }
    if (p.kind === 'drag' && S.drag) {
      // the bet is read 100 ms before the lift (or from the drag's first position)
      var h = S.drag.hist, tRead = h[0][1], cut = performance.now() - 100;
      for (var i = h.length - 1; i >= 0; i--) if (h[i][0] <= cut) { tRead = h[i][1]; break; }
      var bet = (S.drag.t = tRead, currentBet()); S.drag = null; hideReadout(); snd.scratch(0);
      if (bet) launch(bet.T);
      return;
    }
    if (p.kind === 'cp') {
      var vv = velocity(p.hist), ddx = x - p.x0, ddy = y - p.y0, done = false;
      if (!cancel) {
        if ((ddy < -CFG.flickPx || vv[1] < -CFG.flickVel) && Math.abs(ddy) >= Math.abs(ddx) * 0.7) done = flickCp('up');
        else if ((ddx > CFG.flickPx || vv[0] > CFG.flickVel) && Math.abs(ddx) > Math.abs(ddy)) done = flickCp('right');
      }
      if (!done) { elSample.style.transition = 'transform .25s ease-out'; elSample.style.transform = ''; }
      return;
    }
    if (p.kind === 'name' && !p.moved && !cancel && performance.now() - p.t0 <= 600) { pressName(p.id2); suppressClick = performance.now(); }
  }
  // pressing a name: take their standing offer, wake them in a hang, or have them write their status
  function pressName(id) {
    var p = onStaff(id); if (!p || S.phase !== 'play') return;
    if (S.run && S.run.hang) { wake(p); return; }
    if ((id === 'priya' || id === 'ines') && S.priyaOffer && !S.filter) {
      var k = S.lastFray || 0;
      if (k >= 4 || (k === 3 && S.priyaAsked3)) { startFilter(p); return; }
      if (k === 3) { S.priyaAsked3 = true; note(p, LAB.notes.fray3, 'band'); return; }
      if (k >= 1) { note(p, LAB.notes.frayLow, 'band'); return; }
    }
    if (id === 'lena' && S.cp && !S.redteam) { S.redteam = { cp: S.cp, until: S.day + (S.shipped ? CFG.redTeamDaysApi : CFG.redTeamDays) }; S.cp = null; elSample.style.opacity = '0.35'; return; }
    var st = LAB.people[id].status;
    if (id === 'priya' && S.filter) st = LAB.notes.filterBox.replace('{d}', Math.max(1, Math.ceil(S.filter.until - S.day)));
    if (id === 'lena' && S.redteam) st = LAB.notes.redTeamBox.replace('{d}', Math.max(1, Math.ceil(S.redteam.until - S.day)));
    note(p, st, 'name');
  }
  function startFilter(p) {
    var cost = CFG.filterCost * Math.pow(2, S.filters), days = (onStaff('priya') && onStaff('ines')) ? CFG.filterDaysInes : CFG.filterDays;
    S.bank -= cost; S.filter = { until: S.day + days, by: p.id, cost: cost }; S.priyaOffer = false; S.priyaAsked3 = false;
    note(p, 'on it', 'name');
  }
  function startRename() {
    var r = elLab.getBoundingClientRect();
    elRename.hidden = false; elRename.value = S.lab; elRename.style.left = r.left + 'px'; elRename.style.top = (r.top - 1) + 'px';
    try { elRename.focus({ preventScroll: true }); elRename.select(); } catch (e) { }
  }
  function endRename() {
    if (elRename.hidden) return;
    var v = String(elRename.value || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 14);
    if (v) { S.lab = labName = v; elLab.textContent = v; }
    elRename.hidden = true; try { elRename.blur(); } catch (e) { }
  }
  elRename.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); if (e.key === 'Escape') elRename.value = S.lab; endRename(); } });
  elRename.addEventListener('blur', endRename);
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', function (e) { onUp(e, false); });
  root.addEventListener('pointercancel', function (e) { if (ptr && ptr.kind === 'drag') onUp(e, false); else onUp(e, true); }); // pointercancel counts as a lift
  ['touchstart', 'touchmove', 'touchend'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { var t = e.target; if (t === elMute || t === elRename) return; if (e.cancelable) e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  root.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  [LE.up, LE.down].forEach(function (b) { b.addEventListener('click', function () { if (performance.now() - suppressClick < 500) return; resolveLetter(b.dataset.dir); }); });
  elNames.addEventListener('click', function (e) { if (performance.now() - suppressClick < 500) return; var b = e.target.closest && e.target.closest('.nm'); if (b) pressName(b.dataset.id); });
  elMute.addEventListener('click', function (e) { e.stopPropagation(); snd.start(); snd.setMuted(!snd.muted); updateMute(); });
  function updateMute() { elMute.textContent = snd.muted ? 'SOUND OFF' : 'SOUND ON'; elMute.setAttribute('aria-pressed', snd.muted ? 'true' : 'false'); }
  window.addEventListener('keydown', function (e) {
    if (e.target === elRename) return;
    var k = e.key;
    if (k === 'm' || k === 'M') { snd.start(); snd.setMuted(!snd.muted); updateMute(); return; }
    if (S.phase === 'asleep') { if (k === 'Enter' || k === ' ' || k.length === 1 || k.indexOf('Arrow') === 0) { e.preventDefault(); power(); } return; }
    if (S.phase !== 'play') return;
    if (S.letter && LV && !LV.out) {
      if (k === 'ArrowUp') { e.preventDefault(); resolveLetter('up'); return; }
      if (k === 'ArrowDown') { e.preventDefault(); resolveLetter('down'); return; }
    }
    if (/^[1-9]$/.test(k)) { var p = S.team[+k - 1]; if (p && !p.gone) pressName(p.id); return; }
    if ((k === 's' || k === 'S') && S.run) { requestSample('key'); return; }
    if ((k === 'p' || k === 'P') && !S.letter && S.cp) { flickCp('up'); return; }
    if (k === 'ArrowRight' && !S.kb && !S.letter && S.cp && canShip()) { e.preventDefault(); flickCp('right'); return; }
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && canDrag()) {
      e.preventDefault();
      if (!S.kb) { S.kb = { t: 0 }; if (S.ayaanSnap) { S.ayaanSnap = false; S.kb.t = 1; } }
      S.kb.t = clamp(S.kb.t + (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.10 : 0.02), 0, 1);
      var nx = L.travel.x + S.kb.t * L.travel.w; updateDragUI(nx, L.strip.y);
      return;
    }
    if ((k === 'Enter' || k === ' ') && canDrag() && !S.letter) {
      e.preventDefault(); var bet = S.kb ? currentBet() : null; S.kb = null; hideReadout();
      launch(bet ? bet.T : CFG.probeDays); return;
    }
    if (k === 'Escape' && S.kb) { S.kb = null; hideReadout(); }
  });
  window.addEventListener('resize', function () { layout(); });
  window.addEventListener('orientationchange', function () { setTimeout(layout, 120); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) snd.sleep(); else { snd.wake(); lastReal = 0; } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { base = null; if (S) { fitBand(); renderNames(); } }, function () { });

  /* ---------------- the frame ---------------- */
  var lastToday = '', lastMonths = '';
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastReal = 0; return; }
    var dtReal = lastReal ? Math.min(0.1, (ts - lastReal) / 1000) : 0.016; lastReal = ts;
    tick(dtReal * speed);
    render();
  }
  function tick(dt) {
    now += dt;
    runTimers();
    stepView(); stepMoment(); stepBand(); stepHead(); stepNotes();
    if (S.phase === 'play' || S.phase === 'over') {
      stepClock(dt); stepSamples(); stepLetter(dt); stepBoxes(); refreshNameInk();
      if (S.run && !S.run.done && !S.run.hang && clockRunning()) snd.scratch(0.3); else if (!S.drag) snd.scratch(0);
    }
    if (S.phase !== 'asleep') {
      var td = fmtDay(S.day, true); if (td !== lastToday) { elToday.textContent = td; lastToday = td; }
      if (S.phase !== 'over' || S.endReason !== 'bankrupt') { var mt = fmtM(monthsLeft()); if (mt !== lastMonths) { elMn.textContent = mt; lastMonths = mt; } }
      var j = now - joltT; elMn.style.transform = j < 0.08 ? 'translateY(1px)' : '';
    }
  }

  /* ---------------- test hook (playtesters and bots) ---------------- */
  function sampleInfo(sm) { return sm ? { text: sm.text, tier: sm.tier, fray: sm.fray, crawl: sm.crawl, cap: sm.cap, kind: sm.kind, q: sm.q } : null; }
  window.__frontier = {
    state: function () {
      var s = S, cl = cluster(), st = stopInfo();
      return {
        phase: s.phase, year: s.n, lab: s.lab, day: +s.day.toFixed(3), date: fmtDay(s.day, true), month: s.month, started: s.started, clockRunning: clockRunning(),
        bank: Math.round(s.bank), months: +monthsLeft().toFixed(2), monthsShown: elMn.textContent, burn: Math.round(burnMonth()), stake: +s.stake.toFixed(4), post: s.post, credits: Math.round(s.credits),
        team: s.team.map(function (p) { return { id: p.id, role: p.role, salary: p.salary, mood: Math.round(p.mood), gone: p.gone }; }),
        cards: { count: cl.count, owned: s.owned, a100: s.a100, rented: cl.rented, rentedPending: cl.rentedPend, meridian: cl.mer, merCut: cl.merCut, merPending: cl.merPend, ordered: cl.ordered, lent: cl.lent, serving: cl.serving, train: cl.train, v100eq: cl.v100eq },
        stop: { T: +st.T.toFixed(3), kind: st.kind, C: st.T * st.fpd }, horizon: horizonC(),
        run: s.run ? { C: s.run.C, T: +s.run.T.toFixed(3), s: +s.run.s.toFixed(4), q: +s.run.q.toFixed(4), blind: s.run.blind, hang: s.run.hang ? s.run.hang.stamp : null, done: s.run.done } : null,
        runs: s.runs.map(function (r) { return { C: r.C, L: +r.L.toFixed(4), past: r.past, onLine: r.onLine, day: Math.round(r.day), pub: r.pub, ship: r.ship, vault: !!r.vault, caps: r.caps, scandal: r.scandal || null }; }),
        best: s.best, bestPub: s.bestPub || 0, wall: { W: s.W, Cwall: R.C_of_tokens(CFG.passes * s.W), filters: s.filters, filter: s.filter ? Math.ceil(s.filter.until - s.day) : null }, priyaOffer: s.priyaOffer,
        caps: s.caps.map(function (c) { return { id: c.id, C: c.C, fired: c.fired, contaminated: c.contaminated }; }),
        lastSample: sampleInfo(s.sample), checkpoint: s.cp ? { C: s.cp.rec.C, canPublish: !!canPublish(), canShip: !!canShip() } : null, redteam: s.redteam ? Math.ceil(s.redteam.until - s.day) : null,
        letter: s.letter ? { kind: s.letter.kind, sender: s.letter.sender, offer: s.letter.offer, up: s.letter.up ? s.letter.up.eff() : null, down: s.letter.down ? s.letter.down.eff() : null, greyed: s.letter.greyed || null, forced: s.letter.forced || null, fuse: s.letter.fuseDays } : null,
        waiting: s.waiting.length, silent: s.silent, moment: moment ? moment.kind : null,
        seriesA: s.seriesA.taken ? 'taken' : s.seriesA.pending ? 'pending' : 'no', seriesB: s.seriesB.taken ? String(s.seriesB.taken) : s.seriesB.pending ? 'pending' : 'no', meridian: s.meridian ? { alloc: s.meridian.alloc, live: s.meridian.live } : null,
        rivals: s.rivals.map(function (r) { return { id: r.id, c: +Math.pow(10, r.lc).toExponential(2), pubs: r.pubs.map(function (p) { return p.C; }) }; }), frontier: frontier(),
        gpt3: s.gpt3, miracle: s.miracle, scars: s.scars.length, shipped: !!s.shipped, opened: !!s.opened,
        notes: s.notes.filter(function (n) { return !n.gone; }).map(function (n) { return n.text; }), headline: elHead.textContent || null, endReason: s.endReason,
        layout: { lap: L.lap, plot: L.plot, band: L.band, cluster: L.cluster, strip: L.strip, travel: L.travel, letter: L.letter, names: L.names, nibX: s.nibX }
      };
    },
    act: function (name, payload) {
      payload = payload || {};
      snd.start();
      switch (name) {
        case 'power': power(); return true;
        case 'take': case 'up': return resolveLetter('up');
        case 'pass': case 'down': return resolveLetter('down');
        case 'publish': return flickCp('up');
        case 'ship': return flickCp('right');
        case 'vault': if (S.cp) { vault(S.cp); return true; } return false;
        case 'hire': if (payload.id && LAB.people[payload.id] && !onStaff(payload.id)) { join(payload.id); return true; } return resolveLetter('up');
        case 'rent': S.rentals.push({ n: payload.gpus || 64, price: rentPrice(), start: Math.floor(S.day) + 1, end: Math.floor(S.day) + 1 + CFG.rentTermDays, asked: false }); return cluster().count;
        case 'raise': return S.seriesA.pending ? (queueLetter(termLetter(), true), true) : false;
        case 'launch': {
          if (!canDrag()) return false;
          var st = stopInfo(); var T = payload.days != null ? payload.days : betDays(payload.fraction == null ? 0.5 : payload.fraction, st);
          return launch(T);
        }
        case 'tap': requestSample('tap'); return sampleInfo(S.sample);
        case 'press': pressName(payload.id); return true;
        case 'rename': S.lab = labName = String(payload.name || 'FRONTIER').toUpperCase().slice(0, 14); elLab.textContent = S.lab; return S.lab;
        case 'endMonth': {
          if (S.phase !== 'play') return false;
          if (!S.started) S.started = true;
          var tgt = CFG.monthStarts[Math.min(12, S.month + 1)], g = 0;
          while (S.phase === 'play' && S.day < tgt && g++ < 100000) {
            if (S.letter && LV && !LV.out) { if (!resolveLetter(payload.take && S.letter.up ? 'up' : (S.letter.down ? 'down' : 'up'))) dismissLetter(); }
            if (moment) { now += 10; stepMoment(); }
            if (now < S.landUntil) now = S.landUntil;
            tick(0.05);
          }
          return fmtDay(S.day, true);
        }
        case 'newYear': case 'newGame': newYearNow(); return true;
        case 'mute': snd.setMuted(!snd.muted); updateMute(); return snd.muted;
      }
      return false;
    },
    speed: function (n) { if (n != null) speed = clamp(+n || 1, 0.1, 400); return speed; }
  };

  /* ---------------- boot ---------------- */
  S = newYear();
  updateMute();
  layout();
  requestAnimationFrame(frame);
})();
