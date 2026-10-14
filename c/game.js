/* FRONTIER, slice one: The Line. Builder C.
   One screen, four states (DRAG, POUR, LAND, END). Rules in rules.js, numbers in config.js, words in corpus.js. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG, CORPUS = window.FRONTIER_CORPUS, R = window.FRONTIER_RULES.make(CFG);
  var $ = function (id) { return document.getElementById(id); };
  var root = $('fr'), world = $('fr-world'), cv = $('fr-cv'), ctx = cv.getContext('2d');
  var elDate = $('fr-date'), elToday = $('fr-today'), elHeads = $('fr-heads'), elBand = $('fr-band'), elSample = $('fr-sample');
  var elReadout = $('fr-readout'), elReprint = $('fr-reprint'), elDim = $('fr-dim'), elMoment = $('fr-moment'), elMomentText = $('fr-moment-text');
  var elGpt = $('fr-gpt'), elMute = $('fr-mute'), elFocus = $('fr-focus'), elSafe = $('fr-safe'), elLive = $('fr-live');

  /* ---------------- colours (single source: CSS tokens) ---------------- */
  var cs = getComputedStyle(document.documentElement);
  function tok(n, d) { var v = (cs.getPropertyValue(n) || '').trim(); return v || d; }
  var COL = { paper: tok('--paper', '#E4E5E1'), ink: tok('--ink', '#15171A'), grid: tok('--grid', '#CCCFCA'), graphite: tok('--graphite', '#6E7378'),
    reserve: tok('--reserve', '#F8F8F5'), verm: tok('--vermilion', '#E5482E'), dry: tok('--dry', '#A9ACAA') };
  function rgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  var RGB = {}; Object.keys(COL).forEach(function (k) { RGB[k] = rgb(COL[k]); });
  function mix(a, b, u) { var A = RGB[a], B = RGB[b]; u = clamp(u, 0, 1); return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * u) + ',' + Math.round(A[1] + (B[1] - A[1]) * u) + ',' + Math.round(A[2] + (B[2] - A[2]) * u) + ')'; }
  function rgba(a, al) { var A = RGB[a]; return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + al + ')'; }

  /* ---------------- utils ---------------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(u) { u = clamp(u, 0, 1); return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function log10(x) { return Math.log(x) / Math.LN10; }
  function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var hashSeed = (String(location.hash).match(/seed=(\d+)/) || [])[1];
  var baseSeed = hashSeed ? (+hashSeed >>> 0) : ((Math.random() * 4294967295) >>> 0);
  var rng = mulberry(baseSeed);
  function gauss() { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  /* ---------------- clock ---------------- */
  var now = 0, speed = 1, lastReal = 0, lastToday = '';
  var timers = [];
  function after(sec, fn) { timers.push({ at: now + sec, fn: fn, sheet: S ? S.n : 0 }); }
  function runTimers() {
    for (var i = 0; i < timers.length; i++) {
      var t = timers[i];
      if (t.at <= now) { timers.splice(i, 1); i--; if (!S || t.sheet === S.n) t.fn(); }
    }
  }

  /* ---------------- layout ---------------- */
  var L = {}, dpr = 1;
  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var sp = getComputedStyle(elSafe);
    var safe = { t: parseFloat(sp.paddingTop) || 0, r: parseFloat(sp.paddingRight) || 0, b: parseFloat(sp.paddingBottom) || 0, l: parseFloat(sp.paddingLeft) || 0 };
    var lap = vw >= CFG.laptopMinWidth;
    L = { vw: vw, vh: vh, lap: lap, safe: safe };
    if (!lap) {
      var P = CFG.phone, top0 = safe.t, H = vh - safe.t - safe.b, g = P.gutter + Math.max(safe.l, safe.r);
      L.paper = { x: 0, y: 0, w: vw, h: top0 + H * 0.60 };
      L.top0 = top0; L.gutter = g;
      L.plot = { x: 8 + safe.l, y: top0 + 60, w: vw - 16 - safe.l - safe.r, h: L.paper.h - (top0 + 60) - 10 };
      L.band = { x: g, y: top0 + H * 0.60 + 8, w: vw - 2 * g, h: H * 0.18 - 14 };
      L.strip = { x: g, y: top0 + H * 0.80, w: vw - 2 * g, h: P.stripH, home: P.homeW };
      L.readAbove = P.readoutAbove; L.dateX = 16 + safe.l; L.dateY = top0 + 16; L.headY = top0 + 40;
      L.momentFont = 21;
    } else {
      var Q = CFG.laptop, m = Q.margin;
      L.paper = { x: m, y: m, w: vw - 2 * m, h: vh * 0.64 - m };
      L.top0 = m; L.gutter = m;
      L.plot = { x: m + 10, y: m + 64, w: vw - 2 * m - 20, h: L.paper.h - 64 - 12 };
      var bw = Math.min(Q.bandMax, vw - 2 * m);
      L.band = { x: (vw - bw) / 2, y: vh * 0.64 + 10, w: bw, h: vh * 0.16 - 18 };
      var sw = Math.min(L.paper.w, Q.stripMax);
      L.strip = { x: (vw - sw) / 2, y: vh * 0.82, w: sw, h: Q.stripH, home: Q.homeW };
      L.readAbove = Q.readoutAbove; L.dateX = m + 16; L.dateY = m + 16; L.headY = m + 40;
      L.momentFont = 28;
    }
    L.travel = { x: L.strip.x + L.strip.h * 0 + L.strip.home, w: L.strip.w - L.strip.home };
    L.nibW = (lap ? CFG.laptop : CFG.phone).nibW;
    L.nibHome = L.travel.x - L.nibW / 2;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    elDate.style.left = L.dateX + 'px'; elDate.style.top = L.dateY + 'px';
    elBand.style.left = L.band.x + 'px'; elBand.style.top = L.band.y + 'px'; elBand.style.width = L.band.w + 'px'; elBand.style.height = L.band.h + 'px';
    elFocus.style.left = (L.strip.x - 2) + 'px'; elFocus.style.top = (L.strip.y - 2) + 'px'; elFocus.style.width = (L.strip.w + 4) + 'px'; elFocus.style.height = (L.strip.h + 4) + 'px';
    elMute.style.top = Math.max(4, L.dateY - 11) + 'px'; elMute.style.right = (lap ? L.gutter + 4 : 4 + safe.r) + 'px';
    elMoment.style.top = L.paper.y + 'px'; elMoment.style.height = (L.band.y + L.band.h - L.paper.y) + 'px';
    if (S) { if (S.phase === 'drag' && !S.dragging) S.w = L.travel.w / Math.max(S.bank, 1e-6); fitBand(); placeReprint(); placeGpt(); }
  }

  /* ---------------- plot mapping ---------------- */
  var view = { l: CFG.plotLeftMinLog, r: CFG.plotRightMinLog, from: null, to: null, t0: 0 };
  var Y_TOP = Math.log(CFG.plotLossTop), Y_BOT = Math.log(CFG.plotLossBottom);
  function X(lc) { return L.plot.x + (lc - view.l) / (view.r - view.l) * L.plot.w; }
  function Y(lnL) { return L.plot.y + (Y_TOP - lnL) / (Y_TOP - Y_BOT) * L.plot.h; }
  function panTo(l, r) {
    if (Math.abs(l - view.l) < 1e-6 && Math.abs(r - view.r) < 1e-6) return;
    view.from = { l: view.l, r: view.r }; view.to = { l: l, r: r }; view.t0 = now; snd.whirr(0.6);
  }
  function stepView() {
    if (!view.to) return;
    var u = reduced() ? 1 : (now - view.t0) / (CFG.panMs / 1000), e = ease(u);
    view.l = view.from.l + (view.to.l - view.from.l) * e; view.r = view.from.r + (view.to.r - view.from.r) * e;
    if (u >= 1) { view.l = view.to.l; view.r = view.to.r; view.to = null; }
  }
  function viewTargetFor(C) {
    var l = clamp(Math.floor(log10(C) - CFG.plotLeftBack), CFG.plotLeftMinLog, CFG.plotLeftMaxLog);
    var big = C; S.runs.forEach(function (r) { if (r.C > big) big = r.C; });
    return [l, Math.max(CFG.plotRightMinLog, log10(2 * big))];
  }

  /* ---------------- sound (Web Audio, after first gesture) ---------------- */
  var snd = (function () {
    var A = { ctx: null, muted: store('frontier.muted') === '1' };
    function db(x) { return Math.pow(10, x / 20); }
    function t() { return A.ctx.currentTime; }
    function ok() { return A.ctx && A.ctx.state !== 'closed'; }
    function start() {
      if (A.ctx) { try { if (A.ctx.state === 'suspended') A.ctx.resume(); } catch (e) { } return; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        var c = A.ctx = new AC();
        A.out = c.createGain(); A.out.gain.value = A.muted ? 0 : 1; A.out.connect(c.destination);
        A.duck = c.createGain(); A.duck.gain.value = 1; A.duck.connect(A.out);
        var n = c.sampleRate * 2, wb = c.createBuffer(1, n, c.sampleRate), bb = c.createBuffer(1, n, c.sampleRate), w = wb.getChannelData(0), b = bb.getChannelData(0), last = 0;
        for (var i = 0; i < n; i++) { var x = Math.random() * 2 - 1; w[i] = x; last = (last + 0.02 * x) / 1.02; b[i] = last * 3.5; }
        A.white = wb;
        A.motor = c.createGain(); A.motor.gain.value = 0; A.motor.connect(A.duck);
        A.o1 = c.createOscillator(); A.o1.frequency.value = 55; A.o2 = c.createOscillator(); A.o2.frequency.value = 110.6;
        var og = c.createGain(); og.gain.value = db(CFG.sound.motorDb); A.o1.connect(og); A.o2.connect(og); og.connect(A.motor);
        var bs = c.createBufferSource(); bs.buffer = bb; bs.loop = true; var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        var bg = c.createGain(); bg.gain.value = db(CFG.sound.motorNoiseDb); bs.connect(lp); lp.connect(bg); bg.connect(A.motor);
        A.o1.start(); A.o2.start(); bs.start();
        var ws = c.createBufferSource(); ws.buffer = wb; ws.loop = true; A.bp = c.createBiquadFilter(); A.bp.type = 'bandpass'; A.bp.frequency.value = 3200; A.bp.Q.value = 0.8;
        A.scr = c.createGain(); A.scr.gain.value = 0; ws.connect(A.bp); A.bp.connect(A.scr); A.scr.connect(A.duck); ws.start();
      } catch (e) { A.ctx = null; }
    }
    function blip(freq, dur, dbv, type) {
      if (!ok()) return; try {
        var c = A.ctx, o = c.createOscillator(), g = c.createGain(), t0 = t();
        o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(db(dbv), t0 + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(A.duck); o.start(t0); o.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    function burst(freq, q, dur, dbv) {
      if (!ok()) return; try {
        var c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = t();
        s.buffer = A.white; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        g.gain.setValueAtTime(db(dbv), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(A.duck); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    var lastClick = 0, lastPrint = 0;
    return {
      start: start,
      get muted() { return A.muted; },
      setMuted: function (m) { A.muted = m; store('frontier.muted', m ? '1' : '0'); if (ok()) try { A.out.gain.setTargetAtTime(m ? 0 : 1, t(), 0.02); } catch (e) { } },
      motor: function (level, sec) { if (!ok()) return; try { A.motor.gain.cancelScheduledValues(t()); A.motor.gain.setTargetAtTime(level, t(), Math.max(0.01, sec / 3)); } catch (e) { } },
      motorFreq: function (f, sec) { if (!ok()) return; try { A.o1.frequency.setTargetAtTime(f, t(), sec / 3); A.o2.frequency.setTargetAtTime(f * 2.011, t(), sec / 3); } catch (e) { } },
      scratch: function (u) { if (!ok()) return; try { A.scr.gain.setTargetAtTime(db(CFG.sound.scratchMaxDb) * clamp(u, 0, 1), t(), 0.03); } catch (e) { } },
      scratchFreq: function (f, sec) { if (!ok()) return; try { A.bp.frequency.setTargetAtTime(f, t(), sec / 3); } catch (e) { } },
      tick: function () { blip(2400, 0.006, CFG.sound.tickDb); },
      click: function () { if (!ok()) return; var n = performance.now(); if (n - lastClick < CFG.payrollClickMinSec * 1000) return; lastClick = n; burst(1200, 1.2, 0.004, CFG.sound.clickDb); },
      print: function () { if (!ok()) return; var n = performance.now(); if (n - lastPrint < CFG.printTickMinSec * 1000) return; lastPrint = n; blip(1800, 0.005, CFG.sound.printDb); },
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
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(db(CFG.sound.feedDb), t0 + 0.06); g.gain.setValueAtTime(db(CFG.sound.feedDb), t0 + Math.max(0.07, dur - 0.1)); g.gain.linearRampToValueAtTime(0, t0 + dur);
          o.connect(f); f.connect(g); g.connect(A.duck); o.start(t0); o.stop(t0 + dur + 0.05);
        } catch (e) { }
      },
      nibScratch: function (dur) { burst(3200, 0.8, dur || 0.12, -30); },
      duck: function (hold, back) {
        if (!ok()) return; try { var g = A.duck.gain, t0 = t(); g.cancelScheduledValues(t0); g.setValueAtTime(g.value, t0); g.linearRampToValueAtTime(0, t0 + 0.08); g.setValueAtTime(0, t0 + 0.08 + hold); g.linearRampToValueAtTime(1, t0 + 0.08 + hold + (back || 0.4)); } catch (e) { }
      },
      silenceNow: function () { if (!ok()) return; try { var g = A.duck.gain; g.cancelScheduledValues(t()); g.setTargetAtTime(0, t(), 0.02); } catch (e) { } },
      restore: function () { if (!ok()) return; try { var g = A.duck.gain; g.cancelScheduledValues(t()); g.setTargetAtTime(1, t(), 0.05); } catch (e) { } }
    };
  })();
  function motorLevelFor(ink) { return Math.pow(10, (CFG.sound.motorDbPerDoubling * Math.log(1 + Math.max(0, ink)) / Math.LN2) / 20); }

  /* ---------------- sheet ---------------- */
  var S = null, sheetN = 0;
  var CP = CFG.checkpoints;
  function newSheet() {
    sheetN++;
    var W = R.drawW(rng);
    S = {
      n: sheetN, phase: 'asleep', W: W, Dwall: CFG.passes * W, caps: R.drawCaps(rng),
      bank: CFG.seedLights, day: 0, clock: false, lastInk: 0,
      runs: [], cur: null, best: 0, left: 0, dots: [], rings: [], crossings: 0,
      sample: null, bandAtLift: null, lastFrayed: null, scars: [], reprint: null,
      powered: false, powerT0: 0, everDragged: false, w: L.travel.w / CFG.seedLights, nibX: L.nibHome, dragging: null,
      bags: {}, headsDone: {}, heads: [], head: null, endReason: null, dark: false, gptT0: null, pressT0: null,
      land: null, moment: null, dryT0: null, feedT0: null, mark: null, pendingTap: false, lastTapT: -99, echo: null, miracle: false
    };
    S.Cwall = R.C_of_tokens(S.Dwall);
    timers = timers.filter(function (t) { return t.keep; });
    view.l = CFG.plotLeftMinLog; view.r = CFG.plotRightMinLog; view.to = null;
    elDate.style.opacity = 0; elHeads.innerHTML = ''; elSample.innerHTML = ''; elSample.style.opacity = 1; elSample.style.transform = '';
    elReprint.style.opacity = 0; elReprint.textContent = ''; elGpt.style.opacity = 0; elGpt.textContent = '';
    elReadout.style.opacity = 0; elDim.style.opacity = 0; elMoment.style.opacity = 0; setMask(null);
    bandState = null; momentState = null;
  }

  /* ---------------- samples ---------------- */
  function bag(name, pool) { var b = S.bags[name]; if (!b || !b.length) b = S.bags[name] = shuffle(pool.slice()); return b.pop(); }
  function bandCut(s) {
    if (s.length <= CFG.bandMaxChars) return s;
    var parts = s.match(/[^.!?]+[.!?]+["”’]?\s*/g) || [s], out = '';
    for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > CFG.bandMaxChars) break; out += parts[i]; }
    return out.trim();
  }
  function tierOf(Lv) {
    if (Lv > CFG.tierStatic) return 0; if (Lv > CFG.tierWords) return 1; if (Lv > CFG.tierGrammar) return 2;
    var para = S.caps[0]; if (Lv > para.L || !para.fired) return 3; return 4;
  }
  function baseText(tier, Lv) {
    if (tier >= 3) {
      var elig = S.caps.filter(function (c) { return c.fired && c.id !== 'paragraph' && Lv <= c.L; });
      if (elig.length && rng() < CFG.capSampleShare) { var c = elig[Math.floor(rng() * elig.length)]; return { text: bag(c.id, CORPUS[c.id]), cap: c.id }; }
    }
    if (tier === 0) return { text: bag('t0', CORPUS.t0) };
    if (tier === 1) return { text: bag('t1', CORPUS.t1) };
    if (tier === 2) { var pool = CORPUS.t2.slice(); if (S.day >= CFG.covidLineFromDay) pool.push(CORPUS.t2Covid); if (S.day >= CFG.covidLineFromDay && !S.bags.covid) { S.bags.covid = 1; S.bags.t2 = null; } return { text: bag('t2', pool) }; }
    if (tier === 3) return { text: bag('t3', CORPUS.t3) };
    return { text: bandCut(bag('t4', CORPUS.t4)) };
  }
  // splice k boilerplate fragments between words, away from the ends and from punctuation, same ink
  function splice(text, k) {
    if (k <= 0) return text;
    var words = text.split(' '), n = words.length, ok = [];
    for (var i = 1; i <= n - 3; i++) {
      var a = words[i], b = words[i + 1];
      if (/[.,;:!?)\]"”»]$/.test(a) || /^[(\["“«]/.test(b) || /\n/.test(a) || /\n/.test(b)) continue;
      ok.push(i);
    }
    if (!ok.length) for (i = 1; i < n - 1; i++) ok.push(i);
    if (!ok.length) ok.push(0);
    var frags = shuffle(CORPUS.fray.slice()).slice(0, k), chosen = [];
    if (k === 1) {
      var mid = ok.filter(function (j) { return j >= n / 3 - 1 && j <= (2 * n) / 3; });
      var pool = mid.length ? mid : ok; chosen.push(pool[Math.floor(rng() * pool.length)]);
    } else {
      var off = rng() * 0.6 - 0.3;
      for (var j = 0; j < k; j++) chosen.push(ok[clamp(Math.round((j + 0.5 + off) / k * ok.length - 0.5), 0, ok.length - 1)]);
    }
    var out = [];
    for (i = 0; i < n; i++) { out.push(words[i]); for (j = 0; j < chosen.length; j++) if (chosen[j] === i) out.push(frags[j]); }
    return out.join(' ');
  }
  function capText(id) { return id === 'paragraph' ? bag('t4', CORPUS.t4) : bag(id, CORPUS[id]); }
  function makeSample(run, p, kind, capId) {
    var Lv = R.lossAt(run.C, p), tier = tierOf(Lv), base, full = null;
    if (capId) { full = capText(capId); base = { text: bandCut(full), cap: capId }; tier = Math.max(tier, 3); }
    else base = baseText(tier, Lv);
    var g = run.grade, frag = 0, crawl = false;
    if (tier >= 3) {
      if (g === CFG.frayGrades + 1 && p >= 1 / run.r) crawl = true;
      else {
        var ge = Math.min(g, CFG.frayGrades);
        if (ge > 0) {
          if (kind === 'land') frag = ge;
          else if (p >= CFG.frayLateFromP) { if (rng() < CFG.frayLateBase + CFG.frayLatePer * ge) frag = ge; }
          else if (ge >= CFG.frayEarlyMinGrade && rng() < CFG.frayEarlyProb) frag = ge - CFG.frayEarlyDrop;
        }
      }
    }
    var text = crawl ? bag('crawl', CORPUS.crawl) : frag ? splice(base.text, frag) : base.text;
    var fullText = null;
    if (full) fullText = crawl ? text : (full.length > base.text.length ? text + full.slice(base.text.length) : text);
    var smp = { text: text, full: fullText, tier: tier, fray: frag, crawl: crawl, cap: base.cap || null, p: p, kind: kind, loss: Lv };
    if (frag > 0 || crawl) S.lastFrayed = smp;
    return smp;
  }

  /* ---------------- the band (one sample at a time) ---------------- */
  var bandState = null;
  function buildWords(el, text) {
    el.innerHTML = '';
    var words = text.split(' '), spans = [];
    for (var i = 0; i < words.length; i++) {
      if (i) el.appendChild(document.createTextNode(' '));
      var s = document.createElement('span'); s.className = 'w'; s.textContent = words[i]; el.appendChild(s); spans.push(s);
    }
    return spans;
  }
  function fitBand() {
    var base = L.lap ? 19 : 17, lh = L.lap ? 27 : 24, fs = base;
    elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = lh + 'px';
    while (elSample.scrollHeight > L.band.h + 1 && fs > 12) { fs -= 1; elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = Math.round(fs * 1.4) + 'px'; }
  }
  function showBand(smp, mode) {
    S.sample = smp;
    elSample.style.transition = 'none'; elSample.style.opacity = 1; elSample.style.transform = '';
    var spans = buildWords(elSample, smp.text); fitBand();
    if (mode === 'instant' || speed > 8) { spans.forEach(function (s) { s.classList.add('on'); }); bandState = null; }
    else bandState = { spans: spans, t0: now, shown: 0 };
    if (mode === 'rise' && !reduced()) {
      elSample.style.transform = 'translateY(10px)'; elSample.style.opacity = 0;
      void elSample.offsetWidth; elSample.style.transition = 'transform .3s ease-out, opacity .3s ease-out';
      elSample.style.transform = ''; elSample.style.opacity = 1;
    }
    elLive.textContent = smp.text;
  }
  function stepBand() {
    if (!bandState) return;
    var k = Math.min(bandState.spans.length, Math.floor((now - bandState.t0) / (CFG.wordMs / 1000)) + 1);
    while (bandState.shown < k) { bandState.spans[bandState.shown++].classList.add('on'); snd.tick(); }
    if (bandState.shown >= bandState.spans.length) bandState = null;
  }
  function sinkBand() {
    bandState = null;
    if (reduced()) { elSample.innerHTML = ''; return; }
    elSample.style.transition = 'transform .3s ease-in, opacity .3s ease-in';
    elSample.style.transform = 'translateY(18px)'; elSample.style.opacity = 0;
    var n = S.n; setTimeout(function () { if (S.n === n && S.phase === 'pour' && elSample.style.opacity === '0') { elSample.innerHTML = ''; elSample.style.transition = 'none'; elSample.style.transform = ''; elSample.style.opacity = 1; } }, 320);
  }

  /* ---------------- capability moment and the miracle ---------------- */
  var momentState = null;
  function momentDuration(text) { return CFG.momentDimSec + text.split(' ').length * CFG.wordMs / 1000 + 0.08 + CFG.momentSilenceSec + CFG.momentRestoreSec; }
  function startMoment(smp) {
    var text = smp.full || smp.text;
    var spans = buildWords(elMomentText, text);
    elMomentText.style.fontSize = L.momentFont + 'px'; elMomentText.style.lineHeight = Math.round(L.momentFont * (L.lap ? 1.43 : 1.43)) + 'px';
    var fs = L.momentFont; while (elMoment.scrollHeight > elMoment.clientHeight && fs > 14) { fs--; elMomentText.style.fontSize = fs + 'px'; elMomentText.style.lineHeight = Math.round(fs * 1.43) + 'px'; }
    momentState = { kind: 'cap', t0: now, spans: spans, shown: 0, wordsEnd: CFG.momentDimSec + spans.length * CFG.wordMs / 1000, smp: smp, ducked: false };
    momentState.end = momentState.wordsEnd + 0.08 + CFG.momentSilenceSec + CFG.momentRestoreSec;
    elMoment.style.opacity = 1; elLive.textContent = text;
  }
  function startMiracle() {
    momentState = { kind: 'miracle', t0: now, spans: [], shown: 0, wordsEnd: CFG.momentDimSec, ducked: false };
    momentState.end = momentState.wordsEnd + 0.08 + CFG.momentSilenceSec + CFG.momentRestoreSec;
    var gx = X(log10(CFG.gpt3C)), gy = Y(Math.log(R.Lline(CFG.gpt3C)));
    setMask(gx, gy);
  }
  function setMask(x, y) {
    var v = x == null ? '' : 'radial-gradient(circle at ' + x.toFixed(0) + 'px ' + y.toFixed(0) + 'px, transparent 0, transparent 22px, #000 70px)';
    elDim.style.webkitMaskImage = v; elDim.style.maskImage = v;
  }
  function stepMoment() {
    var M = momentState; if (!M) return;
    var t = now - M.t0, dim;
    if (t < CFG.momentDimSec) dim = t / CFG.momentDimSec;
    else if (t < M.end - CFG.momentRestoreSec) dim = 1;
    else dim = 1 - (t - (M.end - CFG.momentRestoreSec)) / CFG.momentRestoreSec;
    elDim.style.opacity = (clamp(dim, 0, 1) * CFG.momentDim).toFixed(3); elMute.style.opacity = (1 - clamp(dim, 0, 1) * CFG.momentDim).toFixed(3);
    if (M.kind === 'cap') {
      var k = t < CFG.momentDimSec ? 0 : Math.min(M.spans.length, Math.floor((t - CFG.momentDimSec) / (CFG.wordMs / 1000)) + 1);
      while (M.shown < k) { M.spans[M.shown++].classList.add('on'); snd.tick(); }
      elMoment.style.opacity = t > M.end - CFG.momentRestoreSec ? clamp(1 - (t - (M.end - CFG.momentRestoreSec)) / CFG.momentRestoreSec, 0, 1) : 1;
    }
    if (!M.ducked && t >= M.wordsEnd) { M.ducked = true; snd.duck(CFG.momentSilenceSec, CFG.momentRestoreSec); }
    if (t >= M.end) {
      elDim.style.opacity = 0; elMute.style.opacity = 1; elMoment.style.opacity = 0; elMomentText.innerHTML = '';
      if (M.kind === 'cap' && S.phase === 'land') showBand(M.smp, 'instant');
      if (M.kind === 'miracle') setMask(null);
      momentState = null;
    }
  }

  /* ---------------- headlines ---------------- */
  function queueHead(text) { S.heads.push(text); }
  function stepHeads() {
    if (S.phase === 'pour' || S.phase === 'drag' || S.phase === 'land') {
      CFG.headlines.forEach(function (h, i) { if (i > 0 && !S.headsDone[i] && S.clock && S.day >= h[0]) { S.headsDone[i] = 1; queueHead(h[1]); } });
    }
    if (!S.head && S.heads.length) {
      var el = document.createElement('div'); el.className = 'fr-hl'; el.textContent = S.heads.shift(); elHeads.appendChild(el);
      S.head = { el: el, t0: now, w: el.offsetWidth };
    }
    var H = S.head; if (!H) return;
    var u = (now - H.t0) / CFG.headlineDriftSec;
    if (reduced()) { H.el.style.whiteSpace = 'normal'; H.el.style.width = (L.paper.w - 32) + 'px'; H.el.style.transform = 'translate(' + (L.paper.x + 16) + 'px,' + L.headY + 'px)'; H.el.style.opacity = u < 0.1 ? u * 10 : u > 0.9 ? (1 - u) * 10 : 1; }
    else { var x = L.paper.x + L.paper.w - u * (L.paper.w + H.w); H.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + L.headY + 'px)'; }
    if (u >= 1) { H.el.remove(); S.head = null; }
  }
  function placeGpt() {
    if (!S || S.gptT0 == null) return;
    var u = reduced() ? 1 : ease((now - S.gptT0) / CFG.gpt3DriftSec);
    elGpt.style.left = (L.paper.x + 16 + (1 - u) * L.paper.w) + 'px'; elGpt.style.top = L.headY + 'px';
    elGpt.style.width = Math.min(L.paper.w - 32, 720) + 'px'; elGpt.style.opacity = 1;
  }

  /* ---------------- money ---------------- */
  function payroll(days) {
    if (days <= 0) return;
    var rate = R.payrollPerDay(S.lastInk); if (rate <= 0) return;
    var before = S.bank; S.bank -= rate * days;
    if (before > 0 && Math.ceil(Math.max(S.bank, 0) - 1e-9) < Math.ceil(before - 1e-9)) snd.click();
  }

  /* ---------------- power, drag, lift ---------------- */
  function power() {
    if (S.powered) return;
    snd.start();
    S.powered = true; S.powerT0 = now; S.phase = 'drag';
    elMute.hidden = false; updateMute();
    snd.motorFreq(55, 0.1); snd.scratchFreq(3200, 0.1); snd.restore();
    snd.motor(1, CFG.motorFadeSec);
    after(CFG.motorFadeSec, function () {
      elToday.textContent = R.fmtDay(0, true); elDate.style.transition = reduced() ? 'none' : 'opacity .4s'; elDate.style.opacity = 1;
      queueHead(CFG.headlines[0][1]); S.headsDone[0] = 1; S.lineT0 = now;
    });
  }
  function homeOrInk(x) {
    if (x < L.travel.x) return { home: true, ink: 0, C: CFG.homeLiftC, T: 1 };
    var ink = clamp((x - L.travel.x) / S.w, 0, Math.max(0, S.bank));
    var C = R.C_of_spend(ink);
    return { home: false, ink: ink, C: C, T: R.T_days(C) };
  }
  var pbuf = [];
  function nibClamp(x) { return clamp(x, L.strip.x + L.nibW / 2, L.travel.x + L.travel.w); }
  function beginDrag(id, x) {
    S.dragging = id; S.everDragged = true; S.nibX = nibClamp(x); pbuf = [{ t: performance.now(), x: S.nibX }];
    updateDragReadout(x, null);
  }
  function moveDrag(x, y) {
    S.nibX = nibClamp(x); pbuf.push({ t: performance.now(), x: S.nibX }); if (pbuf.length > 90) pbuf.shift();
    updateDragReadout(x, y);
  }
  function restX(tUp) {
    if (!pbuf.length) return S.nibX;
    if (tUp - pbuf[0].t < CFG.restReadSec * 1000) return pbuf[0].x;
    var target = tUp - CFG.restReadSec * 1000;
    for (var i = pbuf.length - 1; i >= 0; i--) if (pbuf[i].t <= target) return pbuf[i].x;
    return pbuf[0].x;
  }
  var readoutPos = { x: 0, y: 0 };
  function updateDragReadout(x, y) {
    var b = homeOrInk(S.nibX);
    S.mark = b.home ? null : b.C;
    var day = S.day + b.T;
    elReadout.textContent = R.fmtDay(day, false);
    var w = elReadout.offsetWidth || 54;
    var py = y == null ? L.strip.y + L.strip.h / 2 : y;
    var rx = clamp((x == null ? S.nibX : x) - w / 2, L.gutter, L.vw - L.gutter - w);
    var ry = Math.max(L.top0 + 4, py - L.readAbove - 15);
    readoutPos.x = rx; readoutPos.y = ry;
    elReadout.style.transform = 'translate(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px)'; elReadout.style.opacity = 1;
    elFocus.setAttribute('aria-valuenow', String(Math.round(100 * b.ink / Math.max(1e-9, S.bank))));
    elFocus.setAttribute('aria-valuetext', 'lands ' + R.fmtDay(day, false));
  }
  function lift(x) {
    if (S.phase !== 'drag') return;
    S.dragging = null; elReadout.style.opacity = 0;
    var b = homeOrInk(x);
    var C = b.C, T = b.T, ink = b.ink;
    var r = R.tokens(C) / S.Dwall;
    var run = {
      i: S.runs.length, C: C, ink: ink, T: T, P: R.pourSec(T), launchDay: S.day, home: b.home, r: r, grade: R.grade(r),
      el: 0, p: 0, nextCp: 0, avail: -1, sampled: {}, autoDone: {}, pts: curve(C), landed: false, cut: false, wAtLift: S.w,
      bankAtLift: S.bank, cwallAtLift: S.Cwall
    };
    S.bandAtLift = S.sample;
    S.bank -= ink; S.lastInk = ink; S.clock = true;
    S.runs.push(run); S.cur = run; S.mark = C; S.phase = 'pour'; S.nibX = L.nibHome;
    S.flareT0 = now;
    var v = viewTargetFor(C); panTo(v[0], v[1]);
    snd.lift(); snd.motor(motorLevelFor(ink), 0.3);
    if (S.sample) sinkBand();
    S.sample = null;
  }
  function curve(C) {
    var N = 260, pts = [];
    for (var i = 0; i < N; i++) {
      var lp = -3.5 + 3.5 * i / (N - 1), p = Math.pow(10, lp), z = (lp + 3.5) / 3.5;
      var y = Math.log(R.lossAt(C, p)) + (i === N - 1 ? 0 : gauss() * CFG.curveNoise * (1 - 0.5 * z));
      pts.push({ p: p, lc: log10(p * C), y: y });
    }
    return pts;
  }

  /* ---------------- pour ---------------- */
  function requestSample() {
    if (S.phase !== 'pour') return;
    S.lastTapT = now; S.pendingTap = true; trySample('tap');
  }
  function trySample(kind) {
    var run = S.cur; if (!run) return false;
    var idx = Math.min(run.avail, CP.length - 2);
    if (idx < 0 || run.sampled[idx]) return false;
    run.sampled[idx] = 1; if (kind === 'tap') S.pendingTap = false;
    showBand(makeSample(run, CP[idx], kind), 'stream');
    return true;
  }
  function stepPour(dt) {
    var run = S.cur;
    run.el += dt;
    var p = Math.min(1, Math.pow(run.el / run.P, CFG.pourWarp));
    var nd = run.launchDay + p * run.T;
    if (nd >= CFG.endDay) {
      payroll(CFG.endDay - S.day); S.day = CFG.endDay; run.p = (CFG.endDay - run.launchDay) / run.T; run.cut = true; run.landed = true;
      return endSheet('may28');
    }
    payroll(nd - S.day); S.day = nd;
    var prevX = X(log10(Math.max(R.P0, run.p) * run.C));
    run.p = p;
    while (run.nextCp < CP.length && CP[run.nextCp] <= p + 1e-12) { run.avail = run.nextCp; run.nextCp++; }
    if (S.pendingTap) { if (now - S.lastTapT > CFG.tapWaitMaxSec + 0.5) S.pendingTap = false; else trySample('tap'); }
    CFG.autoSampleP.forEach(function (ap, i) {
      if (!run.autoDone[i] && p >= ap) { run.autoDone[i] = 1; if (now - S.lastTapT > CFG.autoQuietSec) trySample('auto'); }
    });
    var vx = dt > 0 ? Math.abs(X(log10(Math.max(R.P0, p) * run.C)) - prevX) / dt : 0;
    snd.scratch(vx / (L.lap ? 600 : 300));
    if (p >= 1) land();
  }

  /* ---------------- land ---------------- */
  function land() {
    var run = S.cur; run.p = 1; run.landed = true; S.phase = 'land'; S.pendingTap = false; snd.scratch(0);
    var crossed = run.grade === CFG.frayGrades + 1, capNew = null;
    run.crossed = crossed;
    if (!crossed) {
      S.caps.forEach(function (c) { if (!c.fired && run.C >= c.C) { c.fired = true; capNew = c; } });
      if (!run.home) { S.dots.push(run.C); S.best = Math.max(S.best, run.C); S.left = S.left ? Math.min(S.left, run.C) : run.C; }
    } else { S.rings.push(run.C); S.crossings++; }
    var smp = makeSample(run, 1, 'land', capNew ? capNew.id : null);
    run.landSample = smp;
    var Lnd = S.land = { t0: now, run: run, liftT0: null, printT0: null, printN: 0, printStep: 0, printed: 0, repackT0: null, crossed: crossed };
    var t = CFG.landPauseSec;
    after(t, function () { if (capNew) startMoment(smp); else showBand(smp, 'rise'); });
    if (capNew) t += momentDuration(smp.full || smp.text);
    after(t, function () { Lnd.liftT0 = now; });
    t += run.ink > 0 ? CFG.inkLiftSec : 0;
    if (!crossed) {
      var n = CFG.cleanPrintMultiple * run.ink, step = n > 0 ? Math.min(CFG.printStepMaxSec, CFG.printTotalMaxSec / n) : 0;
      after(t, function () { Lnd.printT0 = now; Lnd.printN = n; Lnd.printStep = step; });
      t += n > 0 ? Math.ceil(n) * step : 0;
      after(t, function () { Lnd.printed = n; Lnd.printT0 = null; S.bank += n; });
    } else {
      after(t, function () {
        snd.whirr(CFG.emptyWhirrSec); scar(run.cwallAtLift); snd.nibScratch(CFG.hatchDrawSec);
        var line = (S.bandAtLift && S.bandAtLift.fray > 0) ? S.bandAtLift : (S.lastFrayed && !S.lastFrayed.crawl ? S.lastFrayed : smp);
        setReprint(line.text);
      });
      t += Math.max(CFG.emptyWhirrSec, CFG.hatchDrawSec);
    }
    after(t, function () {
      if (S.phase !== 'land') return;
      if (S.bank <= 0) { if (crossed) S.echo = { run: run }; return endSheet('dry'); }
      if (crossed && CFG.wallEndsSheet) return endSheet('wall');
      if (crossed && CFG.wallAdvancesAfterCrossing) { S.Cwall *= Math.pow(10, CFG.wallAdvanceDecades); S.Dwall = R.tokens(S.Cwall); }
      Lnd.repackT0 = now;
    });
    t += CFG.repackSec;
    after(t, function () { if (S.phase === 'land') toDrag(); });
  }
  function toDrag() {
    S.phase = 'drag'; S.land = null; S.cur = null; S.w = L.travel.w / Math.max(S.bank, 1e-6); S.nibX = L.nibHome; S.mark = null;
    snd.motor(1, 0.4);
  }
  function scar(Cw) {
    var lc = log10(Cw);
    if (S.scars.some(function (s) { return Math.abs(s.lc - lc) < 1e-9; })) return;
    S.scars.push({ lc: lc, t0: now });
  }
  function setReprint(text) { S.reprint = text; elReprint.textContent = text; placeReprint(); elReprint.style.transition = reduced() ? 'none' : 'opacity .3s'; elReprint.style.opacity = 1; }
  function placeReprint() {
    if (!S || !S.reprint || !S.scars.length) return;
    var lc = Math.min.apply(null, S.scars.map(function (s) { return s.lc; }));
    var bx = Math.max(L.paper.x + 8, X(lc));
    var right = L.paper.x + L.paper.w - 8, minW = L.lap ? 300 : 230;
    var left = bx + 6; if (right - left < minW) left = Math.max(L.paper.x + 8, right - minW);
    elReprint.style.left = left + 'px'; elReprint.style.width = (right - left) + 'px';
    elReprint.style.top = (L.plot.y + (L.lap ? 18 : 22)) + 'px';
  }

  /* ---------------- end and fresh sheet ---------------- */
  function endSheet(reason) {
    if (S.phase === 'end' || S.phase === 'feed') return;
    S.phase = 'end'; S.endReason = reason; S.dark = S.bank <= 0; S.endT0 = now; S.dragging = null; S.pendingTap = false;
    elReadout.style.opacity = 0; snd.scratch(0);
    if (bandState) { bandState.spans.forEach(function (sp) { sp.classList.add('on'); }); bandState = null; }
    S.heads = []; if (S.head) { S.head.el.remove(); S.head = null; }
    var t;
    if (S.dark) {
      S.dryT0 = now; snd.scratchFreq(6000, CFG.dryFadeSec); snd.motorFreq(30, 1.2); snd.motor(0, 1.2);
      after(CFG.dryFadeSec, function () { snd.silenceNow(); });
      t = CFG.dryFadeSec + CFG.dryStillSec;
    } else { snd.motor(0, CFG.endMotorStopSec); t = CFG.endMotorStopSec; }
    after(t, function () {
      snd.restore();
      if (log10(S.Cwall) <= view.r) { scar(S.Cwall); snd.nibScratch(CFG.hatchDrawSec * 0.8); }
      if (!S.reprint && S.scars.length) {
        var line = (S.bandAtLift && S.bandAtLift.fray > 0) ? S.bandAtLift : (S.lastFrayed || null);
        if (line) setReprint(line.text);
      }
    });
    t += CFG.hatchDrawSec;
    after(t, function () { S.gptT0 = now; elGpt.textContent = CFG.gpt3Headline; placeGpt(); });
    t += CFG.gpt3DriftSec;
    after(t, function () { S.pressT0 = now; });
    t += CFG.pointPressSec;
    S.miracle = S.best >= CFG.gpt3C && !(CFG.miracleRequiresAlive && S.dark);
    if (S.miracle) { after(t, startMiracle); t += CFG.momentDimSec + 0.08 + CFG.momentSilenceSec + CFG.momentRestoreSec + 0.4; }
    var fresh = Math.max(S.dark ? CFG.freshAfterDrySec : CFG.freshAfterSec, t + 1.0);
    after(fresh, feed);
  }
  var feedSwapped = false;
  function feed() { S.phase = 'feed'; S.feedT0 = now; feedSwapped = false; snd.whirr(CFG.feedSec); }
  function stepFeed() {
    var u = (now - S.feedT0) / CFG.feedSec;
    elGpt.style.transform = '';
    if (u < 0.5) elGpt.style.opacity = reduced() ? 1 - u * 2 : 1;
    if (reduced()) {
      world.style.opacity = u < 0.5 ? 1 - u * 2 : (u - 0.5) * 2; world.style.transform = '';
    } else if (u < 0.5) { world.style.transform = 'translateX(' + (-L.vw * ease(u * 2)).toFixed(1) + 'px)'; elGpt.style.transform = world.style.transform; }
    else world.style.transform = 'translateX(' + (L.vw * (1 - ease((u - 0.5) * 2))).toFixed(1) + 'px)';
    if (u >= 0.5 && !feedSwapped) { feedSwapped = true; var ft0 = S.feedT0; newSheet(); S.feedT0 = ft0; S.phase = 'feed'; }
    if (u >= 1) { world.style.transform = ''; world.style.opacity = 1; S.phase = 'asleep'; }
  }

  /* ---------------- main step ---------------- */
  function step(dt) {
    now += dt;
    runTimers();
    stepView();
    if (S.phase === 'drag' && S.clock) {
      var dd = dt * CFG.dragDaysPerSec;
      if (S.day + dd >= CFG.endDay) { payroll(CFG.endDay - S.day); S.day = CFG.endDay; endSheet('may28'); }
      else { payroll(dd); S.day += dd; if (S.bank <= 0) endSheet('dry'); }
      if (S.dragging != null && S.phase === 'drag') { var ptr = typeof S.dragging === 'number'; updateDragReadout(ptr ? lastPointerX : null, ptr ? lastPointerY : null); }
    }
    if (S.phase === 'pour') stepPour(dt);
    if (S.phase === 'feed') stepFeed();
    if (S.powered) { var td = R.fmtDay(S.day, true); if (td !== lastToday) { lastToday = td; elToday.textContent = td; } }
    stepHeads(); stepBand(); stepMoment();
    if (S.gptT0 != null) placeGpt();
  }

  /* ---------------- render ---------------- */
  function render() {
    var c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, L.vw, L.vh);
    drawPaper(c); drawStrip(c);
  }
  function lineDots(c, x0, x1) {
    // the scaling law, a dotted graphite hairline (1 px dots every 3 px)
    c.fillStyle = COL.graphite;
    for (var x = x0; x <= x1; x += 3) {
      var lc = view.l + (x - L.plot.x) / L.plot.w * (view.r - view.l);
      var y = Y(Math.log(R.Lline(Math.pow(10, lc))));
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
  function drawPaper(c) {
    var P = L.paper, pl = L.plot;
    c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.clip();
    // decade grid
    c.strokeStyle = COL.grid; c.lineWidth = 1; c.beginPath();
    for (var d = Math.ceil(view.l); d <= Math.floor(view.r); d++) { var gx = Math.round(X(d)) + 0.5; c.moveTo(gx, P.y); c.lineTo(gx, P.y + P.h); }
    var gy10 = Math.round(Y(Math.log(10))) + 0.5; c.moveTo(P.x, gy10); c.lineTo(P.x + P.w, gy10);
    c.stroke();
    c.strokeStyle = rgba('grid', 0.5); c.beginPath();
    [2, 3, 5].forEach(function (lv) { var gy = Math.round(Y(Math.log(lv))) + 0.5; c.moveTo(P.x, gy); c.lineTo(P.x + P.w, gy); });
    c.stroke();
    // scars: vermilion hatch from the wall to the right edge, full height
    S.scars.forEach(function (s) {
      var x0 = X(s.lc), u = reduced() ? 1 : clamp((now - s.t0) / CFG.hatchDrawSec, 0, 1), x1 = x0 + (P.x + P.w - x0) * u;
      if (x1 <= x0) return;
      c.save(); c.beginPath(); c.rect(x0, P.y, x1 - x0, P.h); c.clip();
      c.strokeStyle = COL.verm; c.lineWidth = 1; c.beginPath();
      for (var k = x0 - P.h; k < P.x + P.w; k += 6) { c.moveTo(k, P.y + P.h); c.lineTo(k + P.h, P.y); }
      c.stroke(); c.restore();
    });
    if (S.lineT0 != null) {
      var lu = reduced() ? 1 : clamp((now - S.lineT0) / CFG.linePrintSec, 0, 1);
      lineDots(c, pl.x, pl.x + pl.w * lu);
      // verified segment between your leftmost and furthest clean dots
      if (S.dots.length > 1) {
        c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath();
        c.moveTo(X(log10(S.left)), Y(Math.log(R.Lline(S.left)))); c.lineTo(X(log10(S.best)), Y(Math.log(R.Lline(S.best)))); c.stroke();
      }
    }
    // curves
    var last = S.runs.length - 1;
    for (var i = 0; i <= last; i++) drawRun(c, S.runs[i], i === last);
    // dots and rings
    S.dots.forEach(function (C) { dot(c, X(log10(C)), Y(Math.log(R.Lline(C))), 2.5, S.dark && S.dryT0 != null ? mix('ink', 'dry', (now - S.dryT0) / CFG.dryFadeSec) : COL.ink, true); });
    S.rings.forEach(function (C) { dot(c, X(log10(C)), Y(Math.log(R.Lline(C))), 2.5, COL.ink, false); });
    // the mark: a 6 px tick on the line at the dragged compute
    if (S.mark && (S.phase === 'drag' || S.phase === 'pour' || S.phase === 'land')) {
      var mx = X(log10(S.mark)), my = Y(Math.log(R.Lline(S.mark)));
      c.strokeStyle = COL.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx, my - 3); c.lineTo(mx, my + 3); c.stroke();
    }
    // GPT-3: an unlabelled hollow graphite ring, pressed into a plain ink point at END
    if (S.lineT0 != null && now - S.lineT0 >= CFG.linePrintSec * 0.9) {
      var gx = X(log10(CFG.gpt3C)), gy = Y(Math.log(R.Lline(CFG.gpt3C)));
      if (S.pressT0 != null) {
        var pu = reduced() ? 1 : clamp((now - S.pressT0) / CFG.pointPressSec, 0, 1);
        dot(c, gx, gy, 2.5 + 2.5 * (1 - pu), COL.ink, true);
      } else dot(c, gx, gy, 3, COL.graphite, false);
    }
    c.restore();
  }
  function dot(c, x, y, r, col, fill) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = col; c.fill(); } else { c.strokeStyle = col; c.lineWidth = 1; c.stroke(); }
  }
  function drawRun(c, run, latest) {
    var pts = run.pts, pEnd = run.landed || S.phase !== 'pour' || run !== S.cur ? run.p : run.p;
    if (pEnd < R.P0) return;
    var n = pts.length, lpE = log10(Math.max(R.P0, pEnd)), fi = (lpE + 3.5) / 3.5 * (n - 1), k = Math.floor(fi);
    var dry = S.dark && S.dryT0 != null && latest, du = dry ? clamp((now - S.dryT0) / CFG.dryFadeSec, 0, 1) : 0;
    var finished = !(latest && (S.phase === 'pour' || S.phase === 'land' || S.phase === 'end' || S.phase === 'feed'));
    var col = finished ? rgba('ink', 0.35) : COL.ink;
    c.lineWidth = finished ? 1 : 1.5; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = col;
    var tailFrom = dry ? Math.floor(k * 0.97) : k + 1;
    c.beginPath();
    for (var i = 0; i <= Math.min(k, tailFrom); i++) { var x = X(pts[i].lc), y = Y(pts[i].y); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    var ex, ey;
    if (k < n - 1) { var f = fi - k, a = pts[k], b = pts[k + 1]; ex = X(a.lc + (b.lc - a.lc) * f); ey = Y(a.y + (b.y - a.y) * f); }
    else { ex = X(pts[n - 1].lc); ey = Y(pts[n - 1].y); }
    if (!dry) c.lineTo(ex, ey);
    c.stroke();
    if (dry) {
      c.strokeStyle = mix('ink', 'dry', du); c.beginPath();
      for (i = tailFrom; i <= k; i++) { x = X(pts[i].lc); y = Y(pts[i].y); if (i === tailFrom) c.moveTo(x, y); else c.lineTo(x, y); }
      c.lineTo(ex, ey); c.stroke();
    }
    if (latest && S.phase === 'pour' && run === S.cur) { c.fillStyle = COL.ink; c.beginPath(); c.arc(ex, ey, 2.5, 0, Math.PI * 2); c.fill(); }
  }

  /* ---- the strip ---- */
  function drawStrip(c) {
    var st = L.strip, tr = L.travel, y0 = st.y, h = st.h;
    var awake = S.powered, tt = now;
    var dryU = S.dark && S.dryT0 != null ? clamp((now - S.dryT0) / CFG.dryFadeSec, 0, 1) : 0;
    // channel rulings
    c.fillStyle = COL.grid; c.fillRect(st.x, y0 - 1, st.w, 1); c.fillRect(st.x, y0 + h, st.w, 1);
    // the owned eight: two rows of four 10 x 18 blocks
    var bw = 10, bh = 18, gap = 1, bx0 = st.x + Math.max(0, (st.home - L.nibW - 1 - (4 * bw + 3 * gap)) / 2), by0 = y0 + (h - (2 * bh + 4)) / 2;
    for (var r = 0; r < 2; r++) for (var q = 0; q < 4; q++) {
      var idx = r * 4 + q, x = bx0 + q * (bw + gap), y = by0 + r * (bh + 4);
      var br = idx === 5 ? 0.5 + 0.5 * Math.sin(tt * Math.PI * 2 / 1.2) : 0.5 + 0.5 * Math.sin(tt * Math.PI * 2 / 4 + idx);
      if (reduced()) br = 0.5;
      if (!awake) {
        c.strokeStyle = rgba('graphite', idx === 5 ? 0.25 + 0.45 * br : 0.28 + 0.06 * br); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
        if (idx === 5) { c.fillStyle = rgba('ink', 0.10 * br); c.fillRect(x + 1, y + 1, bw - 2, bh - 2); }
      } else {
        var wu = clamp((now - S.powerT0) / 0.4, 0, 1);
        var a = idx === 5 ? 0.72 + 0.28 * br : 0.94 + 0.06 * br;
        c.fillStyle = dryU > 0 ? mix('ink', 'dry', dryU) : rgba('ink', a * wu + 0.15 * (1 - wu)); c.fillRect(x, y, bw, bh);
      }
    }
    // lights
    var ph = S.phase, w = S.w, inkL = 0, whiteL = Math.max(0, S.bank), ghostL = 0, printL = 0, inkAlpha = 1, inkDy = 0, flare = null;
    if (!awake) {
      drawLights(c, tr.x, y0, h, w, 0, CFG.seedLights, 0, 0, 'asleep', 1, 0, null, 0);
    } else {
      if (ph === 'drag') {
        if (S.dragging != null || S.nibX >= tr.x) { var b = homeOrInk(S.nibX); inkL = b.ink; whiteL = Math.max(0, S.bank - inkL); }
      } else if (ph === 'pour' || ph === 'land' || ((ph === 'end' || ph === 'feed') && S.cur)) {
        var run = S.cur || S.runs[S.runs.length - 1]; w = run.wAtLift; inkL = run.ink; whiteL = Math.max(0, S.bank);
        if ((ph === 'end' || ph === 'feed') && run.landed && !run.cut) { inkL = 0; w = Math.min(run.wAtLift, tr.w / Math.max(1e-6, whiteL)); }
        if (now - S.flareT0 < CFG.liftWaveSec) flare = (now - S.flareT0) / CFG.liftWaveSec;
        if (ph === 'land' && S.land) {
          var Ld = S.land;
          if (Ld.liftT0 != null) { var lu = clamp((now - Ld.liftT0) / CFG.inkLiftSec, 0, 1); inkAlpha = 1 - lu; inkDy = -6 * ease(lu); if (lu >= 1) { ghostL = inkL; inkL = 0; } }
          if (Ld.printT0 != null) { printL = Math.min(Ld.printN, Math.floor((now - Ld.printT0) / Math.max(1e-6, Ld.printStep)) + 1); }
          else if (Ld.printed > 0) { printL = Ld.printed; whiteL = Math.max(0, S.bank - Ld.printed); }
          if (printL > (Ld.lastP || 0)) { var np = Math.floor(printL) - Math.floor(Ld.lastP || 0); if (np > 0) snd.print(); Ld.lastP = printL; }
          var tot = (ghostL || inkL) + whiteL + printL;
          w = Math.min(run.wAtLift, tr.w / Math.max(1e-6, tot));
          if (Ld.repackT0 != null) { var ru = ease((now - Ld.repackT0) / CFG.repackSec); var wT = tr.w / Math.max(1e-6, whiteL + printL); ghostL = ghostL * (1 - ru); w = w + (wT - w) * ru; }
        }
      }
      drawLights(c, tr.x, y0, h, w, inkL, whiteL, ghostL, printL, dryU > 0 ? 'dry' : 'live', inkAlpha, inkDy, flare, dryU);
    }
    // strip echo of a crossing bet: hairline outline, crawl part hatched
    if (S.echo && (ph === 'end' || ph === 'feed') && now - S.endT0 > (S.dark ? CFG.dryFadeSec : CFG.endMotorStopSec)) {
      var er = S.echo.run, ew = er.wAtLift, ex1 = tr.x + er.ink * ew, cw = R.costLights(er.cwallAtLift), ex0 = tr.x + clamp(cw, 0, er.ink) * ew;
      c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(tr.x + 0.5, y0 + 2.5, Math.max(1, ex1 - tr.x - 1), h - 5);
      c.save(); c.beginPath(); c.rect(ex0, y0 + 3, Math.max(0, ex1 - ex0), h - 6); c.clip(); c.strokeStyle = COL.graphite; c.beginPath();
      for (var k = ex0 - h; k < ex1; k += 6) { c.moveTo(k, y0 + h); c.lineTo(k + h, y0); } c.stroke(); c.restore();
    }
    // the nib: a 12 px ink bar the full height of the channel
    var nx = S.nibX;
    if (ph === 'drag' && S.powered && !S.everDragged && !reduced()) { var nu = (now - S.powerT0) % CFG.nudgeEverySec; if (now - S.powerT0 > 2.2 && nu < 0.6) nx += CFG.nudgePx * Math.sin(Math.PI * nu / 0.6); }
    var showNib = ph === 'asleep' || ph === 'drag' || (ph === 'land' && S.land && S.land.repackT0 != null) || ph === 'feed';
    if (showNib) {
      c.fillStyle = dryU > 0 ? mix('ink', 'dry', dryU) : COL.ink;
      c.fillRect(Math.round(nx - L.nibW / 2), y0, L.nibW, h);
    }
  }
  function drawLights(c, x0, y0, h, w, inkL, whiteL, ghostL, printL, mode, inkAlpha, inkDy, flare, dryU) {
    var total = (ghostL || inkL) + whiteL + printL, leftL = ghostL || inkL;
    if (total <= 0) return;
    var asleep = mode === 'asleep';
    var breathe = reduced() ? 1 : 1 + 0.06 * Math.sin(now * Math.PI * 2 / 4);
    var wakeU = function (i) { return S.powered ? clamp((now - S.powerT0 - i * CFG.wakeStaggerSec) / 0.25, 0, 1) : 0; };
    var inkCol = dryU > 0 ? mix('ink', 'dry', dryU) : COL.ink;
    var outA = 0.4 * breathe;
    if (w >= CFG.lightGapMinPx) {
      var cells = Math.ceil(total - 1e-9);
      for (var i = 0; i < cells; i++) {
        var cx = x0 + i * w, cwid = Math.min(1, total - i) * w - 1;
        if (cwid <= 0.2) continue;
        var isInk = i < leftL && !ghostL, isGhost = i < leftL && ghostL;
        if (isGhost) continue;
        if (asleep) { c.strokeStyle = COL.grid; c.lineWidth = 1; c.strokeRect(cx + 0.5, y0 + 6.5, Math.max(0, cwid - 1), h - 13); continue; }
        var wu = wakeU(i);
        if (isInk) {
          var part = clamp(leftL - i, 0, 1) * w; // ink exactly to the finger
          c.globalAlpha = inkAlpha; c.fillStyle = inkCol; c.fillRect(cx, y0 + 6 + inkDy, Math.min(part, cwid), h - 12);
          if (flare != null) { var u = (i + 0.5) / Math.max(1, leftL), fi = Math.max(0, 1 - Math.abs(flare * 1.3 - 0.15 - u) * 6); if (fi > 0) { c.fillStyle = rgba('reserve', 0.55 * fi); c.fillRect(cx, y0 + 6 + inkDy, Math.min(part, cwid), h - 12); } }
          c.globalAlpha = 1;
          if (part < cwid) { c.fillStyle = COL.reserve; c.fillRect(cx + part, y0 + 6, cwid - part, h - 12); c.strokeStyle = rgba('ink', outA); c.lineWidth = 1; c.strokeRect(cx + 0.5, y0 + 6.5, cwid - 1, h - 13); }
          continue;
        }
        var fillCol = dryU > 0 ? mix('reserve', 'dry', dryU * 0.6) : COL.reserve;
        c.fillStyle = wu < 1 ? mix('paper', 'reserve', wu) : fillCol; c.fillRect(cx, y0 + 6, cwid, h - 12);
        c.strokeStyle = wu < 1 ? mix('grid', 'graphite', wu) : (dryU > 0 ? mix('graphite', 'dry', dryU) : rgba('ink', outA)); c.lineWidth = 1;
        c.strokeRect(cx + 0.5, y0 + 6.5, Math.max(0, cwid - 1), h - 13);
      }
    } else {
      // merged band: one continuous white band, a grid hairline every 40 lights
      var gx0 = x0 + leftL * w, wx1 = x0 + total * w;
      if (!ghostL && leftL > 0) { c.globalAlpha = inkAlpha; c.fillStyle = inkCol; c.fillRect(x0, y0 + 6 + inkDy, leftL * w, h - 12); c.globalAlpha = 1; }
      if (wx1 > gx0) {
        c.fillStyle = dryU > 0 ? mix('reserve', 'dry', dryU * 0.6) : COL.reserve; c.fillRect(gx0, y0 + 6, wx1 - gx0, h - 12);
        var every = CFG.bandHairEvery * w;
        if (every >= 3) { c.fillStyle = COL.grid; for (var hx = x0 + Math.ceil(leftL / CFG.bandHairEvery) * every; hx < wx1 - 1; hx += every) c.fillRect(Math.round(hx), y0 + 7, 1, h - 14); }
        c.strokeStyle = dryU > 0 ? mix('graphite', 'dry', dryU) : rgba('ink', outA); c.lineWidth = 1; c.strokeRect(Math.round(gx0) + 0.5, y0 + 6.5, Math.max(0, wx1 - gx0 - 1), h - 13);
      }
    }
  }

  /* ---------------- input ---------------- */
  var lastPointerY = null, lastPointerX = null, consumed = {};
  function inStrip(x, y, pad) { return y >= L.strip.y - pad && y <= L.strip.y + L.strip.h + pad && x >= L.strip.x - pad && x <= L.strip.x + L.strip.w + pad; }
  function onDown(e) {
    if (e.target === elMute) return;
    snd.start();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (S.phase === 'asleep') { power(); consumed[e.pointerId] = 1; e.preventDefault(); return; }
    if (S.phase === 'drag' && S.powered && typeof S.dragging !== 'number') {
      var hit = (L.lap ? CFG.laptop : CFG.phone).nibHit / 2;
      if (Math.abs(e.clientX - S.nibX) <= hit && inStrip(e.clientX, e.clientY, 22)) {
        try { root.setPointerCapture(e.pointerId); } catch (er) { }
        lastPointerY = e.clientY; lastPointerX = e.clientX; beginDrag(e.pointerId, e.clientX); e.preventDefault();
      }
      return;
    }
    if (S.phase === 'pour') { requestSample(); e.preventDefault(); }
  }
  function onMove(e) {
    if (S.dragging === e.pointerId) { lastPointerY = e.clientY; lastPointerX = e.clientX; moveDrag(e.clientX, e.clientY); e.preventDefault(); }
  }
  function onUp(e) {
    if (consumed[e.pointerId]) { delete consumed[e.pointerId]; return; }
    if (S.dragging === e.pointerId) { var x = restX(performance.now()); try { root.releasePointerCapture(e.pointerId); } catch (er) { } lift(x); }
  }
  function onCancel(e) {
    if (consumed[e.pointerId]) { delete consumed[e.pointerId]; return; }
    if (S.dragging === e.pointerId) lift(restX(performance.now()));
  }
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  ['touchstart', 'touchmove'].forEach(function (ev) { root.addEventListener(ev, function (e) { if (e.target !== elMute) e.preventDefault(); }, { passive: false }); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  root.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function keyNib(delta) {
    if (S.phase !== 'drag' || !S.powered) return;
    var base = S.dragging === 'key' ? S.nibX : (S.nibX < L.travel.x ? L.travel.x : S.nibX);
    if (S.dragging !== 'key') { S.dragging = 'key'; S.everDragged = true; }
    S.nibX = nibClamp(base + delta * L.travel.w);
    pbuf = [{ t: performance.now() - 1000, x: S.nibX }];
    updateDragReadout(S.nibX, null);
  }
  window.addEventListener('keydown', function (e) {
    if (e.target === elMute && (e.key === 'Enter' || e.key === ' ')) return;
    var k = e.key;
    if (k === 'm' || k === 'M') { if (S.powered) toggleMute(); return; }
    if (k === 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (S.phase === 'asleep') { snd.start(); power(); e.preventDefault(); return; }
    if (S.phase === 'drag') {
      if (k === 'ArrowRight') { keyNib(e.shiftKey ? CFG.keyStepShift : CFG.keyStep); e.preventDefault(); }
      else if (k === 'ArrowLeft') { keyNib(-(e.shiftKey ? CFG.keyStepShift : CFG.keyStep)); e.preventDefault(); }
      else if (k === 'Enter' || k === ' ') { if (!e.repeat) { lift(S.nibX); } e.preventDefault(); }
    } else if (S.phase === 'pour') {
      if (k === 's' || k === 'S' || k === ' ' || k === 'Enter') { requestSample(); e.preventDefault(); }
    }
  });
  function updateMute() { elMute.textContent = snd.muted ? 'SOUND OFF' : 'SOUND ON'; elMute.setAttribute('aria-pressed', snd.muted ? 'true' : 'false'); elMute.setAttribute('aria-label', snd.muted ? 'Sound is off. Turn sound on.' : 'Sound is on. Mute.'); }
  function toggleMute() { snd.start(); snd.setMuted(!snd.muted); updateMute(); }
  elMute.addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
  elMute.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  window.addEventListener('resize', layout);
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', function () { });

  /* ---------------- loop ---------------- */
  function frame(ts) {
    var real = lastReal ? Math.min(0.1, (ts - lastReal) / 1000) : 0; lastReal = ts;
    var dt = real * speed;
    try {
      while (dt > 0) { var s = Math.min(dt, 0.05); step(s); dt -= s; }
      render();
    } catch (err) { if (window.console) console.error(err); }
    requestAnimationFrame(frame);
  }

  /* ---------------- test hook ---------------- */
  window.__frontier = {
    state: function () {
      var run = S.cur, ls = S.sample;
      return {
        sheet: S.n, seed: baseSeed, phase: S.phase === 'asleep' ? 'asleep' : S.phase, powered: S.powered,
        date: S.powered ? R.fmtDay(S.day, true) : null, day: +S.day.toFixed(3), clockRunning: S.clock && (S.phase === 'drag' || S.phase === 'pour'),
        bank: +S.bank.toFixed(3), payrollMode: CFG.payrollMode, payrollPerDay: +R.payrollPerDay(S.lastInk).toFixed(4),
        nib: S.phase === 'drag' ? { x: Math.round(S.nibX), fraction: S.nibX < L.travel.x ? 'home' : +(homeOrInk(S.nibX).ink / Math.max(1e-9, S.bank)).toFixed(3), dragging: S.dragging != null } : null,
        runs: S.runs.length,
        run: run ? { C: run.C, ink: +run.ink.toFixed(3), T: +run.T.toFixed(2), p: +run.p.toFixed(4), pourSec: +run.P.toFixed(2), home: run.home } : null,
        lastRun: S.runs.length ? (function (r) { return { C: r.C, ink: +r.ink.toFixed(3), crossed: !!r.crossed, cut: r.cut, grade: r.grade, landing: r.landSample ? r.landSample.text : null }; })(S.runs[S.runs.length - 1]) : null,
        lastSample: ls ? { text: ls.text, tier: ls.tier, fray: ls.fray, crawl: ls.crawl, cap: ls.cap, kind: ls.kind } : null,
        wall: { W: S.W, Cwall: S.Cwall, log10Cwall: +log10(S.Cwall).toFixed(3), onPaper: log10(S.Cwall) <= view.r, scars: S.scars.length },
        best: S.best, bestLog10: S.best ? +log10(S.best).toFixed(3) : null, reachedGPT3: S.best >= CFG.gpt3C,
        caps: S.caps.map(function (c) { return { id: c.id, C: c.C, fired: c.fired }; }),
        crossings: S.crossings, dark: S.dark, endReason: S.endReason, reprint: S.reprint, miracle: S.miracle,
        moment: momentState ? momentState.kind : null, muted: snd.muted, speed: speed,
        geom: { vw: L.vw, vh: L.vh, laptop: L.lap, stripX: L.strip.x, stripY: L.strip.y, stripH: L.strip.h, travelX: L.travel.x, travelW: L.travel.w, nibX: S.nibX, lightW: S.w, rowEndX: L.travel.x + Math.max(0, S.bank) * S.w, bandY: L.band.y }
      };
    },
    act: function (name, payload) {
      payload = payload || {};
      switch (name) {
        case 'power': if (S.phase === 'asleep') power(); return true;
        case 'tap':
          if (S.phase === 'asleep') { power(); return 'power'; }
          if (S.phase === 'pour') { requestSample(); return 'sample'; }
          return false;
        case 'sample': requestSample(); return S.phase === 'pour';
        case 'drag': {
          if (S.phase === 'asleep') power();
          if (S.phase !== 'drag') return false;
          var f = payload.fraction;
          var x = (f === 'home' || f < 0) ? L.nibHome : L.travel.x + clamp(+f || 0, 0, 1) * Math.max(0, S.bank) * S.w;
          if (S.dragging == null) { S.dragging = 'bot'; S.everDragged = true; }
          S.nibX = nibClamp(x); pbuf = [{ t: performance.now() - 1000, x: S.nibX }]; updateDragReadout(S.nibX, null);
          return true;
        }
        case 'lift': if (S.phase !== 'drag') return false; lift(S.nibX); return true;
        case 'launch': if (S.phase !== 'drag') return false; window.__frontier.act('drag', payload); lift(S.nibX); return true;
        case 'mute': snd.setMuted(payload.on !== false); updateMute(); return true;
        case 'config': if (payload && typeof payload === 'object') Object.keys(payload).forEach(function (k) { CFG[k] = payload[k]; }); return true;
        case 'newSheet': newSheet(); return true;
        default: return false;
      }
    },
    speed: function (n) { if (n != null) speed = clamp(+n || 1, 0.1, 200); return speed; },
    config: CFG
  };

  layout();
  newSheet();
  requestAnimationFrame(frame);
})();
