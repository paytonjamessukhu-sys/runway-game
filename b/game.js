/* FRONTIER, build B ("the feel"). One screen, four states: DRAG, POUR, LAND, END.
   Rules: spec/slice1.json (v6) + spec/slice1-round7.md. Numbers and switches: config.js. Words: corpus.js. */
(function () {
  'use strict';
  const CFG = window.FRONTIER_CONFIG, K = window.FRONTIER_CORPUS, AU = window.FrontierAudio;
  const RU = CFG.rules, TM = CFG.timing, SM = CFG.samples, LY = CFG.layout;

  // ---------- dev-only hash: #seed=N&payroll=flat&advance=1&wallend=1 (not a setting) ----------
  let hashSeed = null;
  try {
    const h = (location.hash || '').replace(/^#/, '');
    h.split('&').forEach(kv => {
      const [k, v] = kv.split('=');
      if (k === 'seed' && /^\d+$/.test(v || '')) hashSeed = parseInt(v, 10);
      if (k === 'payroll' && /^(ink|flat|none|bank)$/.test(v || '')) RU.payrollMode = v;
      if (k === 'advance') RU.wallAdvancesAfterCrossing = v === '1';
      if (k === 'wallend') RU.wallEndsSheet = v === '1';
    });
  } catch (e) { /* no hash */ }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const root = $('fr-root'), stage = $('fr-stage'), cv = $('fr-canvas'), probe = $('fr-probe');
  const elDate = $('fr-dateline'), elDateTxt = $('fr-date'), elHead = $('fr-headline'), elHlClip = $('fr-hlclip'), elReprints = $('fr-reprints');
  const elBand = $('fr-band'), elSample = $('fr-sample'), elReadout = $('fr-readout');
  const elCap = $('fr-cap'), elCapWords = $('fr-cap-words'), elCapDot = $('fr-capdot'), elMute = $('fr-mute');
  const ctx = cv.getContext('2d', { alpha: false });

  const COL = (() => {
    const cs = getComputedStyle(document.documentElement);
    const fb = { paper: '#E4E5E1', ink: '#15171A', grid: '#CCCFCA', graphite: '#6E7378', reserve: '#F8F8F5', vermilion: '#E5482E', dry: '#A9ACAA' };
    const o = {};
    for (const k in fb) { const v = (cs.getPropertyValue('--' + k) || '').trim(); o[k] = /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb[k]; }
    return o;
  })();
  const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function mix(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; }

  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = !!(mq && mq.matches);
  if (mq) { const f = e => { reduced = e.matches; }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }

  const clamp = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v));
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function shuffle(a, r) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- physics (never shown) ----------
  const OWNED_DAY = CFG.hw.owned * CFG.hw.gpuDayFlops;
  const lineLoss = c => Math.pow(CFG.line.Cc / c, CFG.line.alpha);
  const lnLine = lc => CFG.line.alpha * (Math.log(CFG.line.Cc) - lc * Math.LN10);
  const runDays = c => Math.min(c / OWNED_DAY, CFG.run.tA * Math.pow(c / CFG.run.tRef, CFG.run.tExp));
  function costLights(c) {
    const T = runDays(c), G = Math.max(CFG.hw.owned, c / (T * CFG.hw.gpuDayFlops));
    return (G - CFG.hw.owned) * T * CFG.hw.rentPerGpuDay / CFG.money.lightDollars;
  }
  const C_FREE = Math.pow(CFG.run.tA * OWNED_DAY / Math.pow(CFG.run.tRef, CFG.run.tExp), 1 / (1 - CFG.run.tExp));
  function computeForSpend(s) {
    if (!(s > 1e-12)) return C_FREE;
    if (costLights(1e28) <= s) return 1e28;
    let lo = Math.log10(C_FREE), hi = 28;
    for (let i = 0; i < 52; i++) { const m = (lo + hi) / 2; if (costLights(Math.pow(10, m)) <= s) lo = m; else hi = m; }
    return Math.pow(10, lo);
  }
  const pourSec = T => CFG.clock.pourBase + CFG.clock.pourLog * Math.log2(1 + T);
  const tokensFor = c => CFG.data.d0 * Math.pow(c / CFG.data.c0, CFG.data.exp);
  const computeForTokens = d => CFG.data.c0 * Math.pow(d / CFG.data.d0, 1 / CFG.data.exp);
  function gradeFor(r) {
    const D = CFG.data;
    if (r < D.cleanBelow) return 0;
    if (r > 1) return 6;
    return Math.min(D.grades, 1 + Math.floor((r - D.cleanBelow) / D.gradeWidth + 1e-9));
  }
  const P0 = CFG.curve.p0, LP0 = Math.log10(P0);
  function curveLn(c, p) {
    if (p < P0) p = P0;
    const z = (Math.log10(p) - LP0) / (-LP0);
    const H0 = Math.log(CFG.curve.startLoss) - Math.log(lineLoss(P0 * c));
    return Math.log(lineLoss(p * c)) + H0 * (CFG.curve.cliffA * Math.exp(-CFG.curve.cliffK * z) + CFG.curve.grindB * (1 - z) * (1 - z));
  }
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DAY0 = Date.UTC(2020, 0, 23);
  function dateOf(day, year) { const d = new Date(DAY0 + Math.floor(day + 1e-9) * 86400000); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (year ? ' ' + d.getUTCFullYear() : ''); }

  // ---------- global + sheet state ----------
  const G = { now: 0, speed: 1, L: null, feed: null, lastTs: 0, sheetN: 0 };
  let S = null;
  const wallC = () => computeForTokens(S.Dwall);

  function newSheet() {
    G.sheetN++;
    const seed = hashSeed != null ? hashSeed + G.sheetN - 1 : 1 + Math.floor(Math.random() * 2147483000);
    const rng = mulberry32(seed), nrng = mulberry32((seed ^ 0x9E3779B9) >>> 0);
    const D = CFG.data;
    const W = Math.exp(Math.log(D.wLo) + rng() * (Math.log(D.wHi) - Math.log(D.wLo)));
    const jit = CFG.caps.map(c => Math.log10(c.compute) + (rng() * 2 - 1) * c.jitter).sort((a, b) => a - b);
    const caps = CFG.caps.map((c, i) => ({ name: c.name, C: Math.pow(10, jit[i]), L: lineLoss(Math.pow(10, jit[i])), fired: false }));
    S = {
      n: G.sheetN, seed, rng, nrng, phase: 'asleep', poweredAt: -1,
      day: 0, clockOn: false, bank: CFG.money.seedLights, payInk: 0, payBank: CFG.money.seedLights,
      W, Dwall: D.passes * W, caps, runs: [], run: null, bestClean: 0, cleanCs: [], wallRings: [], crossings: 0,
      bands: [], lastSample: null, sampleAtLift: null, band: null, bandSinkAt: -1,
      bags: {}, lastPick: {}, events: [], hlQueue: [], hlDone: {}, headline: null, hlNextAt: 0,
      nibT: 0, nibHome: true, drag: null, botHold: false, kbd: false, firstDragged: false, homeAt: -1,
      view: { left: CFG.paper.leftMin, right: CFG.paper.rightMinLog, fl: 0, fr: 0, tl: CFG.paper.leftMin, tr: CFG.paper.rightMinLog, t0: -1 },
      dateShown: false, linePrintAt: -1, ringAt: -1, flareAt: -1, tapPulseAt: -1,
      landRow: null, print: null, repack: null, fades: [], clickDebt: 0, lastClick: -1e9,
      cap: null, end: null, endFrom: null, echo: null, gptHead: null, press: null, miracle: null, dark: false
    };
    // clear the sheet's type
    elDate.style.opacity = '0'; elDateTxt.textContent = dateOf(0, true); elDate._op = '0';
    elHead.textContent = ''; elHead.style.opacity = '0'; elHead.classList.remove('settled'); elHead._k = null;
    elSample.innerHTML = ''; elSample.style.transform = ''; elSample.style.opacity = '';
    elReadout.style.opacity = '0'; elReprints.innerHTML = '';
    elCap.style.visibility = 'hidden'; elCap.style.opacity = '0'; elCapWords.innerHTML = ''; elCapDot.style.opacity = '0';
    elMute.classList.remove('on'); elMute.style.opacity = '0';
  }

  // ---------- layout ----------
  function layout() {
    const W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight;
    const cs = getComputedStyle(probe);
    const st = parseFloat(cs.paddingTop) || 0, sr = parseFloat(cs.paddingRight) || 0, sb = parseFloat(cs.paddingBottom) || 0, sl = parseFloat(cs.paddingLeft) || 0;
    const laptop = W >= LY.laptopMin;
    const L = { W, H, laptop, dpr: Math.min(2, window.devicePixelRatio || 1) };
    const top = st, h = H - st - sb;
    if (laptop) {
      const P = LY.laptop, m = P.margin;
      L.px = m; L.pw = W - 2 * m; L.py = top + m; L.ph = top + h * P.paperTo - L.py;
      L.bandW = Math.min(P.bandMax, L.pw - 32); L.bandX = (W - L.bandW) / 2; L.bandY = top + h * P.paperTo + 10; L.bandH = h * (P.bandTo - P.paperTo) - 18;
      L.sh = P.stripH; L.sw = Math.min(L.pw, P.stripMax); L.sx = (W - L.sw) / 2; L.sy = Math.round(top + h * P.stripAt); L.homeW = P.homeW;
      L.gut = m + 16; L.dateX = L.px + 16; L.dateY = L.py + 14; L.hlY = L.py + 40; L.readoutAbove = P.readoutAbove;
    } else {
      const P = LY.phone, g = P.gutter + Math.max(sl, sr);
      L.px = 0; L.pw = W; L.py = 0; L.ph = top + h * P.paperTo;
      L.bandX = g; L.bandW = W - 2 * g; L.bandY = top + h * P.paperTo + 8; L.bandH = h * (P.bandTo - P.paperTo) - 12;
      L.sh = P.stripH; L.sx = g; L.sw = W - 2 * g; L.sy = Math.round(top + h * P.stripAt); L.homeW = P.homeW;
      L.gut = g; L.dateX = g; L.dateY = top + 14; L.hlY = top + 40; L.readoutAbove = P.readoutAbove;
    }
    L.tx = L.sx + L.homeW; L.tw = L.sw - L.homeW;
    L.plotL = L.px; L.plotW = L.pw; L.plotT = L.hlY + 26; L.plotB = L.py + L.ph - 12; L.plotH = Math.max(40, L.plotB - L.plotT);
    L.lpad = Math.round(L.sh * 0.17); L.ly = L.sy + L.lpad; L.lh = L.sh - 2 * L.lpad;
    cv.width = Math.round(W * L.dpr); cv.height = Math.round(H * L.dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    root.classList.toggle('laptop', laptop);
    elDate.style.transform = 'translate(' + L.dateX + 'px,' + L.dateY + 'px)';
    elBand.style.left = L.bandX + 'px'; elBand.style.top = L.bandY + 'px'; elBand.style.width = L.bandW + 'px'; elBand.style.height = L.bandH + 'px';
    elHlClip.style.left = L.px + 'px'; elHlClip.style.top = L.py + 'px'; elHlClip.style.width = L.pw + 'px'; elHlClip.style.height = L.ph + 'px';
    elMute.style.top = (L.dateY - 14) + 'px'; elMute.style.right = Math.max(4, L.gut - 15) + 'px';
    G.L = L;
    fitBand();
    if (S) S.bands.forEach(b => { b.pos = null; });
  }

  // ---------- timeline ----------
  function later(ms, fn) { S.events.push({ at: G.now + ms, fn, sheet: S.n }); }
  function runEvents() {
    if (!S.events.length) return;
    const due = [];
    S.events = S.events.filter(e => { if (e.at <= G.now) { due.push(e); return false; } return true; });
    due.sort((a, b) => a.at - b.at);
    for (const e of due) if (S && e.sheet === S.n) e.fn();
  }

  // ---------- the words ----------
  function pick(key, list) {
    let bag = S.bags[key];
    if (!bag || !bag.length) {
      bag = shuffle(list.slice(), S.rng);
      if (bag.length > 1 && bag[bag.length - 1] === S.lastPick[key]) { const t = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = t; }
      S.bags[key] = bag;
    }
    const v = bag.pop(); S.lastPick[key] = v; return v;
  }
  const PUNCT_END = /[.,;:!?»"'’”)\]\/|>]$/, PUNCT_START = /^[^A-Za-z0-9#]/;
  // Splice n fragments between words, in the middle of the sentence, never beside punctuation, in the sentence's own ink.
  function splice(text, n, pool) {
    if (n <= 0) return text;
    const words = text.split(' '), N = words.length;
    const gaps = (lo, hi) => {
      const out = [];
      for (let i = Math.max(1, lo); i <= Math.min(N - 1, hi); i++) {
        const a = words[i - 1], b = words[i];
        if (!a || !b || PUNCT_END.test(a) || PUNCT_START.test(b)) continue;
        out.push(i);
      }
      return out;
    };
    let cand = n === 1 ? gaps(Math.floor(N / 3), Math.ceil(2 * N / 3)) : gaps(Math.floor(N * 0.12), Math.ceil(N * 0.88));
    if (cand.length < Math.min(n, 2)) cand = gaps(1, N - 1);
    if (!cand.length) cand = [Math.max(1, Math.floor(N / 2))];
    shuffle(cand, S.rng);
    const chosen = cand.slice(0, Math.min(n, cand.length));
    const frs = shuffle(pool.slice(), S.rng), ins = {};
    for (let k = 0; k < n; k++) { const g = chosen[k % chosen.length]; (ins[g] = ins[g] || []).push(frs[k % frs.length]); }
    const out = [];
    for (let i = 0; i < N; i++) { if (ins[i]) out.push.apply(out, ins[i]); out.push(words[i]); }
    return out.join(' ');
  }
  function fray(text, n) {
    if (n <= 0) return text;
    if (!RU.frayByAmount) return splice(text, 1, K.frayByGrade[clamp(n, 1, 5)]);
    return splice(text, n, K.frayPool);
  }
  function crawlLine(base) {
    const c = shuffle(K.crawl.slice(), S.rng);
    if (RU.crawlWholeLine) return c[0] + ' ' + c[1];
    const w = base.split(' '), k = Math.max(3, Math.floor(w.length * 0.45));
    return w.slice(0, k).join(' ') + ' ' + c[0] + ' ' + c[1];
  }
  function cutBand(text) {
    if (text.length <= SM.bandMaxChars) return text;
    const parts = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
    let out = '';
    for (const p of parts) { if ((out + p).trim().length > SM.bandMaxChars) break; out += p; }
    return (out || parts[0]).trim();
  }
  function tierFor(L) {
    const t = SM.tierLoss;
    if (L > t[0]) return 0; if (L > t[1]) return 1; if (L > t[2]) return 2;
    const par = S.caps[0];
    if (L > par.L) return 3;
    return par.fired ? 4 : 3;
  }
  function fragCount(grade, kind, p) {
    if (grade <= 0) return 0;
    if (kind === 'land') return grade;
    if (p >= SM.lateP) return S.rng() < SM.lateBase + SM.latePerGrade * grade ? grade : 0;
    if (grade >= SM.earlyMinGrade && S.rng() < SM.earlyProb) return grade - SM.earlyOffset;
    return 0;
  }
  function sampleFor(R, p, kind) {
    const L = Math.exp(curveLn(R.C, p));
    const tier = tierFor(L);
    const plain = (text) => ({ text, tier, frags: 0, crawl: false, frayed: false, p });
    if (tier === 0) return plain(pick('T0', K.T0));
    if (tier === 1) return plain(pick('T1', K.T1));
    if (tier === 2) { const v = S.day > SM.virusAfterDay; return plain(pick(v ? 'T2v' : 'T2', v ? K.T2.concat([K.T2late]) : K.T2)); }
    const past = R.r > 1;
    if (past && p >= 1 / R.r - 1e-9) return { text: crawlLine(pick('T3', K.T3)), tier, frags: 0, crawl: true, frayed: true, p };
    const grade = past ? 5 : R.grade;
    let base, cap = null;
    const elig = S.caps.filter(c => c.fired && c.name !== 'paragraph' && L <= c.L);
    if (elig.length && S.rng() < SM.capShare) { cap = elig[Math.floor(S.rng() * elig.length)].name; base = pick(cap, K[cap]); }
    else if (tier === 4) base = cutBand(pick('T4', K.T4));
    else base = pick('T3', K.T3);
    const n = fragCount(grade, kind, p);
    return { text: fray(base, n), tier, frags: n, crawl: false, frayed: n > 0, cap, p };
  }
  function capSample(R, name) {
    const n = R.grade > 0 && R.grade < 6 ? R.grade : 0;
    if (name === 'paragraph') {
      const full = pick('T4', K.T4), band = cutBand(full), rest = full.slice(band.length).trim(), fb = fray(band, n);
      return { text: fb, full: rest ? fb + ' ' + rest : fb, tier: 4, frags: n, frayed: n > 0, cap: name, crawl: false, p: 1 };
    }
    const t = fray(pick(name, K[name]), n);
    return { text: t, full: t, tier: 4, frags: n, frayed: n > 0, cap: name, crawl: false, p: 1 };
  }
  const wordsHtml = text => text.replace(/ \/ /g, ' \n ').split(' ').map(w => w === '\n' ? '<br>' : '<span class="h">' + esc(w) + '</span>').join(' ');
  function showSample(s, instant) {
    S.lastSample = s;
    elSample.innerHTML = wordsHtml(s.text);
    elSample.style.transform = ''; elSample.style.opacity = instant ? '1' : '0';
    const spans = elSample.querySelectorAll('span');
    S.band = { s, start: G.now, spans, n: spans.length, shown: 0, instant: !!instant };
    if (instant) { spans.forEach(sp => { sp.className = ''; }); S.band.shown = spans.length; }
    S.bandSinkAt = -1;
    fitBand();
  }
  function fitBand() {
    if (!G.L) return;
    const sizes = G.L.laptop ? [[19, 27], [17, 24], [16, 22]] : [[17, 24], [16, 22], [15, 21], [14, 19]];
    for (const [fs, lh] of sizes) {
      elSample.style.fontSize = fs + 'px'; elSample.style.lineHeight = lh + 'px';
      if (elSample.scrollHeight <= G.L.bandH + 1) break;
    }
  }

  // ---------- money and the bet ----------
  function betFor(t, home) {
    if (home) return { home: true, t: 0, ink: 0, C: CFG.run.homeCompute, T: CFG.run.homeDays };
    const ink = t * Math.max(0, S.bank), C = computeForSpend(ink);
    return { home: false, t, ink, C, T: runDays(C) };
  }
  function currentBet() {
    if (S.drag) return betFor(S.drag.t, S.drag.home);
    if (S.kbd || S.botHold) return betFor(S.nibT, S.nibHome);
    return null;
  }
  function payrollPerDay() {
    switch (RU.payrollMode) {
      case 'ink': return CFG.payroll.inkShare * S.payInk;
      case 'bank': return CFG.payroll.bankShare * S.payBank;
      case 'flat': return CFG.payroll.flatLightsPerDay;
      default: return 0;
    }
  }
  function payroll(dDays) {
    if (!(dDays > 0)) return;
    const per = payrollPerDay();
    if (!(per > 0)) return;
    const before = S.bank;
    S.bank -= per * dDays;
    if (before > 0) {
      const emptied = Math.ceil(before - 1e-9) - Math.max(0, Math.ceil(S.bank - 1e-9));
      if (emptied > 0) { S.clickDebt = Math.min(3, S.clickDebt + emptied); recordFades(before, S.bank); }
    }
  }
  function recordFades(before, after) {
    const L = G.L; if (!L) return;
    let x0, w, off;
    if (S.phase === 'pour' && S.run) { w = L.tw / Math.max(1e-9, S.run.rowN); x0 = L.tx; off = S.run.ink; }
    else { w = L.tw / Math.max(1e-9, before); x0 = L.tx; off = 0; }
    if (w < LY.lightMinW) return;
    const a = Math.ceil(off + Math.max(0, after) - 1e-9), b = Math.ceil(off + before - 1e-9);
    for (let i = a; i < b && S.fades.length < 24; i++) S.fades.push({ x: x0 + i * w, w, t0: G.now });
  }

  // ---------- actions ----------
  function power(pointerId) {
    if (S.phase !== 'asleep') return;
    AU.unlock();
    S.phase = 'drag'; S.poweredAt = G.now;
    AU.motorLevel(0); AU.motorStart(TM.motorFadeInMs);
    elMute.classList.add('on');
    later(TM.dateLineAtMs, () => { S.dateShown = true; S.linePrintAt = G.now; queueHeadline(0); });
    later(TM.dateLineAtMs + TM.linePrintMs, () => { S.ringAt = G.now; });
  }
  function nibEdge() {
    const L = G.L;
    if (S.drag) return S.drag.home ? L.tx : L.tx + S.drag.t * L.tw;
    return S.nibHome ? L.tx : L.tx + S.nibT * L.tw;
  }
  function fracFromX(x) {
    const L = G.L;
    if (x <= L.tx) return { home: true, t: 0 };
    return { home: false, t: Math.min(1, (x - L.tx) / L.tw) };
  }
  function startDrag(e) {
    const f = fracFromX(e.clientX);
    S.drag = { id: e.pointerId, buf: [{ t: e.timeStamp, x: e.clientX }], x: e.clientX, y: e.clientY, home: f.home, t: f.t, type: e.pointerType };
    S.firstDragged = true; S.kbd = false; S.botHold = false;
    try { root.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    root.classList.add('grabbing');
  }
  function moveDrag(e) {
    const D = S.drag;
    const list = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of list) D.buf.push({ t: ev.timeStamp || e.timeStamp, x: ev.clientX });
    while (D.buf.length > 2 && D.buf[1].t < e.timeStamp - 600) D.buf.shift();
    D.x = e.clientX; D.y = e.clientY;
    const f = fracFromX(D.x); D.home = f.home; D.t = f.t;
  }
  // The bet is read where the finger rested 100 ms before it left the glass.
  function endDrag(e) {
    const D = S.drag, tq = e.timeStamp - TM.betLookbackMs;
    let x = D.buf[0].x;
    for (const b of D.buf) { if (b.t <= tq) x = b.x; else break; }
    const f = fracFromX(x);
    try { root.releasePointerCapture(D.id); } catch (err) { /* fine */ }
    root.classList.remove('grabbing');
    S.drag = null;
    lift(f.t, f.home);
  }
  function lift(t, home) {
    if (S.phase !== 'drag' || S.poweredAt < 0) return false;
    const L = G.L, bankBefore = Math.max(0, S.bank), bet = betFor(t, home);
    S.sampleAtLift = S.lastSample;
    S.bank -= bet.ink;
    const D = tokensFor(bet.C), r = D / S.Dwall;
    const R = {
      id: S.runs.length + 1, C: bet.C, lc: Math.log10(bet.C), ink: bet.ink, f: home ? 0 : t, home: !!home, T: bet.T, P: pourSec(bet.T),
      launchDay: S.day, bankAtLift: bankBefore, rowN: Math.max(1e-9, bankBefore), t: 0, p: 0, D, r, grade: gradeFor(r), wallC: wallC(),
      pts: [], lastLp: null, headLp: LP0, nextCk: 0, availCk: -1, lastSampledCk: -1, tapPending: false, lastTapAt: -1e9,
      autoDone: SM.autoAt.map(() => false), samples: [], outcome: null, fadeAt: -1, landSample: null
    };
    S.runs.push(R); S.run = R;
    S.phase = 'pour'; S.clockOn = true; S.nibHome = true; S.nibT = 0; S.kbd = false; S.botHold = false;
    S.payInk = bet.ink; S.payBank = bankBefore;
    S.flareAt = G.now;
    if (S.band) S.bandSinkAt = G.now;
    elReadout.style.opacity = '0'; elReadout._op = '0';
    AU.lift(); AU.motorLevel(bet.ink);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* optional */ }
    const maxC = Math.max.apply(null, S.runs.map(q => q.C));
    setView(clamp(Math.floor(R.lc - CFG.paper.leftBack), CFG.paper.leftMin, CFG.paper.leftMax), Math.max(CFG.paper.rightMinLog, Math.log10(CFG.paper.rightRunMult * maxC)));
    extendCurve(R, 0);
    return true;
  }
  function requestSample() {
    const R = S.run;
    if (!R || S.phase !== 'pour') return false;
    R.lastTapAt = G.now; S.tapPulseAt = G.now;
    if (R.availCk > R.lastSampledCk) sampleCk(R, R.availCk, 'tap'); else R.tapPending = true;
    return true;
  }
  function sampleCk(R, ck, kind) {
    R.lastSampledCk = ck; R.tapPending = false;
    const p = SM.checkpoints[ck], s = sampleFor(R, p, kind);
    R.samples.push({ p, kind, text: s.text, frags: s.frags, crawl: s.crawl, tier: s.tier });
    showSample(s);
  }

  // ---------- the paper view ----------
  function setView(l, r) {
    const v = S.view;
    if (Math.abs(l - v.tl) < 1e-9 && Math.abs(r - v.tr) < 1e-9) return;
    v.fl = v.left; v.fr = v.right; v.tl = l; v.tr = r; v.t0 = G.now;
    AU.feed(TM.panMs);
  }
  function updateView() {
    const v = S.view;
    if (v.t0 < 0) return;
    const k = reduced ? 1 : clamp((G.now - v.t0) / TM.panMs), e = easeIO(k);
    v.left = v.fl + (v.tl - v.fl) * e; v.right = v.fr + (v.tr - v.fr) * e;
    if (k >= 1) { v.left = v.tl; v.right = v.tr; v.t0 = -1; }
  }

  // ---------- the pour ----------
  function extendCurve(R, p, final) {
    const step = CFG.curve.stepDecades;
    if (R.lastLp === null) { R.lastLp = LP0; R.pts.push([R.lc + LP0, Math.log(CFG.curve.startLoss)]); }
    const lpEnd = Math.log10(Math.max(p, P0));
    while (R.lastLp + step < lpEnd - 1e-9) { R.lastLp += step; pushPoint(R, R.lastLp); }
    R.headLp = lpEnd;
    if (final) { R.pts.push([R.lc, Math.log(lineLoss(R.C))]); R.lastLp = 0; R.headLp = 0; }
  }
  function pushPoint(R, lp) {
    const z = (lp - LP0) / (-LP0), sd = CFG.curve.noise * (1 - 0.5 * z), g = gauss(S.nrng);
    R.pts.push([R.lc + lp, curveLn(R.C, Math.pow(10, lp)) + g * sd]);
    if (Math.abs(g) > 1.9) AU.jag();
  }
  function pourStep(dt) {
    const R = S.run, L = G.L, v = S.view;
    R.t += dt / 1000;
    let p = Math.min(1, Math.pow(R.t / R.P, CFG.clock.progressExp));
    let day = R.launchDay + p * R.T;
    const hx0 = R.headLp;
    if (day >= CFG.clock.endDay) { // 28 May: a run in flight stops mid-stroke and prints nothing
      p = clamp((CFG.clock.endDay - R.launchDay) / R.T); day = CFG.clock.endDay;
      payroll(day - S.day); S.day = day; extendCurve(R, p); R.p = p; R.outcome = 'cut';
      AU.scratch(0); endSheet('may28'); return;
    }
    payroll(day - S.day); S.day = day;
    extendCurve(R, p); R.p = p;
    const pxs = (R.headLp - hx0) * L.plotW / (v.right - v.left) / Math.max(1e-6, dt / 1000);
    AU.scratch(pxs / CFG.audio.scratchFullPxPerSec);
    const CK = SM.checkpoints;
    while (R.nextCk < CK.length - 1 && CK[R.nextCk] <= p + 1e-12) { R.availCk = R.nextCk; R.nextCk++; }
    if (R.tapPending && R.availCk > R.lastSampledCk) sampleCk(R, R.availCk, 'tap');
    for (let i = 0; i < SM.autoAt.length; i++) {
      if (!R.autoDone[i] && p >= SM.autoAt[i]) {
        R.autoDone[i] = true;
        if (G.now - R.lastTapAt > SM.autoQuietMs && R.availCk > R.lastSampledCk) sampleCk(R, R.availCk, 'auto');
      }
    }
    if (p >= 1) land();
  }
  function dragClock(dt) {
    const nd = Math.min(CFG.clock.endDay, S.day + dt / 1000 * CFG.clock.dragDaysPerSec);
    payroll(nd - S.day); S.day = nd;
    if (S.bank <= 0) endSheet('dark');
    else if (S.day >= CFG.clock.endDay) endSheet('may28');
  }

  // ---------- LAND ----------
  function land() {
    const R = S.run;
    extendCurve(R, 1, true); R.p = 1; S.day = R.launchDay + R.T;
    S.phase = 'land'; R.tapPending = false;
    AU.scratch(0);
    later(TM.landPauseMs, () => landRead(R));
  }
  function landRead(R) {
    const past = R.r > 1, finalLoss = lineLoss(R.C);
    R.finalLoss = finalLoss;
    R.outcome = past ? 'wall' : 'clean';
    R.landDay = S.day;
    const crossed = past ? [] : S.caps.filter(c => !c.fired && finalLoss <= c.L * (1 + 1e-12));
    crossed.forEach(c => { c.fired = true; });
    if (crossed.length) {
      const samples = crossed.map(c => capSample(R, c.name));
      R.landSample = samples[samples.length - 1]; R.caps = crossed.map(c => c.name);
      S.lastSample = R.landSample;
      let i = 0;
      const next = () => {
        if (i < samples.length) capMoment(samples[i++], next);
        else { showSample(R.landSample, true); afterWords(R); }
      };
      next();
    } else {
      const s = sampleFor(R, 1, 'land');
      R.landSample = s; showSample(s); afterWords(R);
    }
  }
  function capMoment(s, done) {
    elCapWords.innerHTML = wordsHtml(s.full || s.text);
    const spans = elCapWords.querySelectorAll('span');
    S.cap = { start: G.now, spans, n: spans.length, shown: 0, restoreAt: -1 };
    const tEnd = TM.capDimMs + spans.length * SM.msPerWord;
    later(tEnd, () => AU.duckSilence(TM.capDuckMs, TM.capSilenceMs, TM.capRestoreMs));
    later(tEnd + TM.capDuckMs + TM.capSilenceMs, () => { if (S.cap) S.cap.restoreAt = G.now; });
    later(tEnd + TM.capDuckMs + TM.capSilenceMs + TM.capRestoreMs, () => { S.cap = null; done(); });
  }
  function afterWords(R) {
    S.landRow = { ri: R.ink, w0n: R.rowN, kept0: Math.max(0, S.bank), liftAt: G.now };
    R.fadeAt = G.now;
    if (R.outcome === 'clean') {
      S.cleanCs.push(R.C); S.bestClean = Math.max(S.bestClean, R.C);
      later(TM.inkLiftMs, () => startPrint(R.ink * CFG.money.printMultiple, finishLanding));
    } else {
      // Past the wall: nothing prints. Silence where the ticks should be.
      S.wallRings.push(R.C); S.crossings++;
      later(TM.inkLiftMs, () => AU.feed(TM.emptyWhirrMs));
      later(TM.inkLiftMs + TM.emptyWhirrMs, () => {
        if (S.bank <= 0) { endSheet('dark'); return; }
        if (RU.wallEndsSheet) { endSheet('wall'); return; }
        // The scar is drawn once per wall; crossing it again only scratches the pen across it.
        if (!S.bands.some(b => Math.abs(b.lc - Math.log10(R.wallC)) < 1e-6)) addBand(R.wallC, reprintFor(R));
        AU.hatch(TM.hatchMs);
        later(TM.hatchMs + 200, () => {
          if (RU.wallAdvancesAfterCrossing) S.Dwall *= Math.pow(CFG.data.advanceComputeFactor, CFG.data.exp);
          finishLanding();
        });
      });
    }
  }
  function startPrint(n, cb) {
    if (!(n > 1e-9)) { cb(); return; }
    S.print = { n, done: 0, start: G.now, each: Math.min(TM.printEachMaxMs, TM.printMaxMs / n), cb };
  }
  function printStep() {
    const P = S.print;
    const k = Math.min(P.n, Math.floor((G.now - P.start) / P.each) + 1);
    if (k > P.done) { S.bank += k - P.done; P.done = k; AU.print(); }
    if (P.done >= P.n - 1e-9) { S.print = null; P.cb(); }
  }
  function finishLanding() {
    if (S.bank <= 0) { endSheet('dark'); return; }
    S.repack = { start: G.now };
    later(TM.repackMs, () => {
      S.repack = null; S.landRow = null; S.run = null;
      S.phase = 'drag'; S.nibHome = true; S.nibT = 0; S.homeAt = G.now;
      AU.motorLevel(0);
    });
  }
  function addBand(Cw, text) {
    const b = { C: Cw, lc: Math.log10(Cw), text, at: G.now, el: null, pos: null };
    if (text) {
      const el = document.createElement('p'); el.className = 'fr-reprint'; el.textContent = text.replace(/ \/ /g, ' ');
      elReprints.appendChild(el); b.el = el;
    }
    S.bands.push(b);
  }
  function reprintFor(R) {
    const s = S.sampleAtLift;
    if (s && s.frayed && !s.crawl) return s.text;
    if (R && R.landSample) return R.landSample.text;
    return null;
  }

  // ---------- END ----------
  function endSheet(reason) {
    if (S.phase === 'end') return;
    const dark = S.bank <= 0, from = S.phase;
    if (S.drag) { try { root.releasePointerCapture(S.drag.id); } catch (e) { /* fine */ } S.drag = null; root.classList.remove('grabbing'); }
    S.phase = 'end'; S.endFrom = from; S.print = null; S.repack = null; S.events = []; S.cap = null; S.kbd = false; S.botHold = false;
    S.headline = null; S.hlQueue = []; S.dark = dark;
    elCap.style.visibility = 'hidden'; elCap.style.opacity = '0'; elReadout.style.opacity = '0'; elReadout._op = '0';
    const last = S.runs[S.runs.length - 1];
    const lastCrossed = !!(last && last.outcome === 'wall');
    const miracle = S.bestClean >= CFG.gpt3.compute * (1 - 1e-9);
    S.end = { reason, dark, at: G.now, from, lastCrossed, miracle, dryAt: -1 };
    if (G.slowOnEnd) { G.speed = 1; G.slowOnEnd = false; }
    AU.scratch(0); AU.unduck();
    let t;
    if (dark) { S.end.dryAt = G.now; AU.dryPen(TM.dryFadeMs, 1200); t = TM.dryFadeMs + TM.dryStillMs; }
    else { AU.motorStop(TM.endMotorStopMs); t = TM.endMotorStopMs; }
    later(t, () => {
      const wc = wallC();
      const onPaper = Math.log10(wc) <= S.view.tr + 1e-9;
      const moved = S.crossings > 0 && RU.wallAdvancesAfterCrossing;
      if (onPaper && !moved && !S.bands.some(b => Math.abs(b.lc - Math.log10(wc)) < 1e-6)) { addBand(wc, reprintFor(lastCrossed ? last : null)); AU.hatch(TM.hatchMs); }
      if (lastCrossed && last.f > 0) {
        const fw = last.wallC <= C_FREE ? 0 : clamp(costLights(last.wallC) / Math.max(1e-9, last.bankAtLift), 0, last.f);
        S.echo = { f: last.f, fw, at: G.now };
      }
    });
    later(t + TM.hatchMs, () => {
      S.gptHead = { start: G.now };
      elHead.textContent = K.gpt3Headline; elHead.classList.add('settled'); elHead._k = null;
    });
    later(t + TM.hatchMs + TM.gpt3DriftMs, () => {
      S.press = { start: G.now, merge: miracle && RU.miracleMergesDot };
      if (miracle && RU.miracleMoment) later(TM.pressMs + 150, miracleMoment);
    });
    const fresh = (dark ? TM.freshAfterDryMs : TM.freshAfterMs) + (miracle && RU.miracleMoment ? TM.miracleExtraMs : 0);
    later(fresh, startFeed);
  }
  function miracleMoment() {
    S.miracle = { start: G.now, restoreAt: -1 };
    elCapWords.innerHTML = '';
    later(TM.capDimMs, () => AU.duckSilence(TM.capDuckMs, TM.capSilenceMs, TM.capRestoreMs));
    later(TM.capDimMs + TM.capDuckMs + TM.capSilenceMs, () => { if (S.miracle) S.miracle.restoreAt = G.now; });
    later(TM.capDimMs + TM.capDuckMs + TM.capSilenceMs + TM.capRestoreMs, () => { S.miracle = null; });
  }
  function startFeed() {
    if (G.feed) return;
    let ghost = null;
    try {
      ghost = stage.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      ghost.querySelectorAll('[aria-live]').forEach(n => n.removeAttribute('aria-live'));
      ghost.setAttribute('aria-hidden', 'true'); ghost.style.pointerEvents = 'none';
      const gc = ghost.querySelector('canvas');
      gc.width = cv.width; gc.height = cv.height; gc.getContext('2d').drawImage(cv, 0, 0);
      root.insertBefore(ghost, stage.nextSibling);
    } catch (e) { ghost = null; }
    G.feed = { start: G.now, ghost };
    AU.feed(TM.feedMs); AU.unduck(); AU.scratchReset();
    newSheet();
  }
  function finishFeed() {
    if (G.feed.ghost && G.feed.ghost.parentNode) G.feed.ghost.parentNode.removeChild(G.feed.ghost);
    stage.style.transform = ''; stage.style.opacity = '';
    G.feed = null;
  }

  // ---------- headlines ----------
  function queueHeadline(i) { if (S.hlDone[i]) return; S.hlDone[i] = true; S.hlQueue.push(K.headlines[i].text); }
  function updateHeadlines() {
    if (S.poweredAt < 0 || S.phase === 'end' || !S.dateShown) return;
    for (let i = 1; i < K.headlines.length; i++) if (!S.hlDone[i] && S.day >= K.headlines[i].day) queueHeadline(i);
    if (!S.headline && S.hlQueue.length && G.now >= S.hlNextAt) {
      S.headline = { text: S.hlQueue.shift(), start: G.now, w: 0 };
      elHead.classList.remove('settled'); elHead.style.maxWidth = ''; elHead.textContent = S.headline.text; elHead._k = null;
      S.headline.w = elHead.offsetWidth;
    }
    if (S.headline && G.now - S.headline.start >= TM.headlineDriftMs) { S.headline = null; S.hlNextAt = G.now + TM.headlineGapMs; elHead.style.opacity = '0'; }
  }

  // ---------- streams (45 ms per word, one soft tick each) ----------
  function updateStreams() {
    const B = S.band;
    if (B && B.shown < B.n) {
      const k = Math.min(B.n, Math.floor((G.now - B.start) / SM.msPerWord) + 1);
      if (k > B.shown) { for (let i = B.shown; i < k; i++) B.spans[i].className = ''; B.shown = k; AU.token(); }
    }
    const C = S.cap;
    if (C && C.shown < C.n && G.now - C.start >= TM.capDimMs) {
      const k = Math.min(C.n, Math.floor((G.now - C.start - TM.capDimMs) / SM.msPerWord) + 1);
      if (k > C.shown) { for (let i = C.shown; i < k; i++) C.spans[i].className = ''; C.shown = k; AU.token(); }
    }
  }

  // ---------- update ----------
  function update(dt) {
    G.now += dt;
    runEvents();
    if (S.phase === 'drag' && S.clockOn) dragClock(dt);
    else if (S.phase === 'pour') pourStep(dt);
    if (S.print) printStep();
    updateView();
    updateHeadlines();
    updateStreams();
    if (S.clickDebt > 0 && G.now - S.lastClick >= CFG.payroll.clickMinMs) { AU.payroll(); S.clickDebt--; S.lastClick = G.now; }
    if (S.phase === 'drag') { const b = currentBet(); AU.motorLevel(b ? b.ink : 0); }
    if (G.feed && G.now - G.feed.start >= TM.feedMs) finishFeed();
  }

  // ---------- render: paper ----------
  function viewFns() {
    const L = G.L, v = S.view;
    const lnTop = Math.log(CFG.paper.lossTop), lnBot = Math.log(CFG.paper.lossBottom);
    return {
      X: lc => L.plotL + (lc - v.left) / (v.right - v.left) * L.plotW,
      Y: ln => L.plotT + (lnTop - ln) / (lnTop - lnBot) * L.plotH
    };
  }
  function drawPaper(c) {
    const L = G.L, v = S.view, F = viewFns(), X = F.X, Y = F.Y;
    c.save();
    c.beginPath(); c.rect(L.px, L.py, L.pw, L.ph); c.clip();
    // faint log-log decade grid
    c.lineWidth = 1; c.strokeStyle = COL.grid;
    c.globalAlpha = 0.32; c.beginPath();
    for (let d = Math.floor(v.left); d <= Math.ceil(v.right); d++) {
      for (let k = 2; k <= 9; k++) { const x = Math.round(X(d + Math.log10(k))) + 0.5; if (x > L.px && x < L.px + L.pw) { c.moveTo(x, L.py); c.lineTo(x, L.py + L.ph); } }
    }
    for (let k = 2; k <= 9; k++) { const y = Math.round(Y(Math.log(k))) + 0.5; c.moveTo(L.px, y); c.lineTo(L.px + L.pw, y); }
    c.stroke();
    c.globalAlpha = 1; c.beginPath();
    for (let d = Math.ceil(v.left); d <= Math.floor(v.right); d++) { const x = Math.round(X(d)) + 0.5; c.moveTo(x, L.py); c.lineTo(x, L.py + L.ph); }
    { const y = Math.round(Y(Math.log(10))) + 0.5; c.moveTo(L.px, y); c.lineTo(L.px + L.pw, y); }
    { const y = Math.round(Y(Math.log(2))) + 0.5; c.moveTo(L.px, y); c.lineTo(L.px + L.pw, y); }
    c.stroke();
    // the scars: vermilion hatch from where the clean text ran out to the right edge
    for (const b of S.bands) drawHatch(c, X(b.lc), L.px + L.pw, L.py, L.ph, reduced ? 1 : clamp((G.now - b.at) / TM.hatchMs));
    // the dotted scaling-law line
    if (S.linePrintAt >= 0) {
      const k = reduced ? 1 : clamp((G.now - S.linePrintAt) / TM.linePrintMs);
      const x0 = L.plotL, x1 = L.plotL + L.plotW;
      c.save(); c.beginPath(); c.rect(x0, L.py, (x1 - x0) * k, L.ph); c.clip();
      c.strokeStyle = COL.graphite; c.lineWidth = 1; c.setLineDash([1, 2]);
      c.beginPath(); c.moveTo(x0, Y(lnLine(v.left))); c.lineTo(x1, Y(lnLine(v.right))); c.stroke();
      c.setLineDash([]); c.restore();
    }
    // finished curves (35% ink); the newest fades down after its landing
    const last = S.runs[S.runs.length - 1];
    const dryK = S.end && S.end.dark ? clamp((G.now - S.end.dryAt) / TM.dryFadeMs) : 0;
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const R of S.runs) {
      if (R === S.run && S.phase === 'pour') continue;
      if (R.pts.length < 2) continue;
      let a = 0.35;
      if (R.fadeAt >= 0) a = 1 - 0.65 * clamp((G.now - R.fadeAt) / TM.curveFadeMs);
      else if (R === last) a = 1;
      c.globalAlpha = a; c.strokeStyle = COL.ink; c.lineWidth = a > 0.5 ? 1.5 : 1.2;
      let n = R.pts.length;
      if (R === last && dryK > 0) {
        const cut = Math.max(1, Math.floor(n * 0.97));
        strokePts(c, R.pts, X, Y, 0, cut + 1); c.stroke();
        c.strokeStyle = mix(COL.ink, COL.dry, dryK); strokePts(c, R.pts, X, Y, cut, n); c.stroke();
        if (R.outcome === 'cut') headDot(c, R, X, Y, mix(COL.ink, COL.dry, dryK));
        continue;
      }
      strokePts(c, R.pts, X, Y, 0, n);
      if (R.outcome === 'cut' || R === S.run) { const hx = X(R.lc + R.headLp), hy = Y(curveLn(R.C, Math.pow(10, R.headLp))); c.lineTo(hx, hy); }
      c.stroke();
    }
    c.globalAlpha = 1;
    // the verified line: solid ink between your leftmost and furthest clean dots
    if (S.cleanCs.length >= 2) {
      const lo = Math.log10(Math.min.apply(null, S.cleanCs)), hi = Math.log10(Math.max.apply(null, S.cleanCs));
      c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(X(lo), Y(lnLine(lo))); c.lineTo(X(hi), Y(lnLine(hi))); c.stroke();
    }
    const merge = S.press && S.press.merge;
    for (const C0 of S.cleanCs) { const lc = Math.log10(C0); dot(c, X(lc), Y(lnLine(lc)), 2.5, COL.ink, true); }
    for (const C0 of S.wallRings) { const lc = Math.log10(C0); dot(c, X(lc), Y(lnLine(lc)), 2.5, COL.ink, false); }
    // GPT-3: an unlabelled hollow graphite ring that presses in at END
    if (S.ringAt >= 0) {
      const glc = Math.log10(CFG.gpt3.compute);
      if (S.press) {
        const k = reduced ? 1 : easeOut(clamp((G.now - S.press.start) / TM.pressMs));
        const tlc = merge ? Math.log10(S.bestClean) : glc, lc = glc + (tlc - glc) * k;
        const x = X(lc), y = Y(lnLine(lc));
        if (k < 1) { c.globalAlpha = 1 - k; dot(c, x, y, 3.5 - k, COL.graphite, false); c.globalAlpha = 1; }
        c.globalAlpha = k; dot(c, x, y, 2.5 + 0.6 * (1 - k), COL.ink, true); c.globalAlpha = 1;
        S.press.x = x; S.press.y = y;
      } else {
        c.globalAlpha = reduced ? 1 : clamp((G.now - S.ringAt) / 300);
        dot(c, X(glc), Y(lnLine(glc)), 3.5, COL.graphite, false); c.globalAlpha = 1;
      }
    }
    // the live pen
    if (S.phase === 'pour' && S.run) {
      const R = S.run;
      c.strokeStyle = COL.ink; c.lineWidth = 1.5; c.globalAlpha = 1;
      strokePts(c, R.pts, X, Y, 0, R.pts.length);
      const hx = X(R.lc + R.headLp), hy = Y(curveLn(R.C, Math.pow(10, R.headLp)));
      c.lineTo(hx, hy); c.stroke();
      dot(c, hx, hy, 2.1, COL.ink, true);
    }
    // the mark: a small ink tick on the line at the bet
    let mlc = null;
    if (S.phase === 'drag' && S.poweredAt >= 0) { const b = currentBet(); if (b) mlc = Math.log10(b.C); }
    else if ((S.phase === 'pour' || S.phase === 'land') && S.run && !S.run.outcome) mlc = S.run.lc;
    if (mlc !== null) {
      const x = clamp(X(mlc), L.px + 2, L.px + L.pw - 2), y = Y(lnLine(mlc));
      c.fillStyle = COL.ink; c.fillRect(Math.round(x) - 0.75, y - 4, 1.5, 8);
    }
    c.restore();
  }
  function strokePts(c, pts, X, Y, from, to) {
    c.beginPath();
    for (let i = from; i < to; i++) { const x = X(pts[i][0]), y = Y(pts[i][1]); if (i === from) c.moveTo(x, y); else c.lineTo(x, y); }
  }
  function headDot(c, R, X, Y, col) { dot(c, X(R.lc + R.headLp), Y(curveLn(R.C, Math.pow(10, R.headLp))), 2.1, col, true); }
  function dot(c, x, y, r, col, fill) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { c.fillStyle = col; c.fill(); } else { c.strokeStyle = col; c.lineWidth = 1; c.stroke(); }
  }
  function drawHatch(c, x0, x1, y0, h, k) {
    if (x0 >= x1 || k <= 0) return;
    const xe = x0 + (x1 - x0) * k, step = 6 * Math.SQRT2;
    c.save(); c.beginPath(); c.rect(x0, y0, xe - x0, h); c.clip();
    c.strokeStyle = COL.vermilion; c.lineWidth = 1; c.beginPath();
    for (let x = x0 - h; x < xe; x += step) { c.moveTo(x, y0 + h); c.lineTo(x + h, y0); }
    c.stroke(); c.restore();
  }

  // ---------- render: the strip ----------
  function wakeK(i) { return S.poweredAt < 0 ? 0 : clamp((G.now - S.poweredAt - i * TM.wakeStaggerMs) / TM.wakeEachMs); }
  function drawCells(c, x0, w, u0, u1, inkU, o) {
    const L = G.L, y = L.ly, h = L.lh;
    if (!(u1 > u0 + 1e-6) || !(w > 0) || !isFinite(w)) return;
    const xOf = u => x0 + (u - u0) * w;
    const inkCol = o.inkCol || COL.ink, inkA = o.inkAlpha === undefined ? 1 : o.inkAlpha;
    const breath = reduced ? 1 : 1 + TM.breathAmp * Math.sin(G.now / TM.breathMs * Math.PI * 2);
    const olCol = o.olCol || COL.ink;
    if (w >= LY.lightMinW) {
      const i0 = Math.floor(u0 + 1e-9), i1 = Math.ceil(u1 - 1e-9);
      for (let i = i0; i < i1; i++) {
        const a = Math.max(i, u0), b = Math.min(i + 1, u1);
        if (b - a < 1e-6) continue;
        const xa = xOf(a), xb = xOf(b) - (b >= i + 1 - 1e-9 ? 1 : 0);
        if (xb - xa < 0.3) continue;
        const wk = o.wake ? o.wake(i) : 1;
        const m = Math.min(b, Math.max(a, inkU)), xm = m <= a ? xa : (m >= b ? xb : xOf(m));
        if (xb > xm) { c.globalAlpha = 0.3 + 0.7 * wk; c.fillStyle = COL.reserve; c.fillRect(xm, y, xb - xm, h); }
        if (xm > xa && inkA > 0) { c.globalAlpha = inkA; c.fillStyle = inkCol; c.fillRect(xa, y, xm - xa, h); }
        if (xb - xa > 1.5) {
          if (wk < 1) { c.globalAlpha = 1 - wk; c.strokeStyle = COL.grid; c.lineWidth = 1; c.strokeRect(xa + 0.5, y + 0.5, xb - xa - 1, h - 1); }
          if (wk > 0) { c.globalAlpha = 0.4 * breath * wk * (m >= b ? inkA : 1); c.strokeStyle = olCol; c.lineWidth = 1; c.strokeRect(xa + 0.5, y + 0.5, xb - xa - 1, h - 1); }
        }
      }
    } else {
      const xa = xOf(u0), xb = xOf(u1), m = Math.min(u1, Math.max(u0, inkU)), xm = xOf(m);
      if (xb > xm) {
        c.globalAlpha = 1; c.fillStyle = COL.reserve; c.fillRect(xm, y, xb - xm, h);
        c.fillStyle = COL.grid;
        // a Grid hairline every 40 lights; once those would sit closer than 4 px, every 400, then 4,000...
        let every = LY.mergedHairlineEvery;
        while (every * w < LY.lightMinW) every *= 10;
        for (let k = Math.ceil(Math.max(u0, m) / every) * every; k < u1; k += every) { const x = xOf(k); if (x > xm + 1) c.fillRect(Math.round(x), y, 1, h); }
      }
      if (xm > xa && inkA > 0) { c.globalAlpha = inkA; c.fillStyle = inkCol; c.fillRect(xa, y, xm - xa, h); }
      c.globalAlpha = 0.4 * breath; c.strokeStyle = olCol; c.lineWidth = 1;
      if (xb - xa > 1) c.strokeRect(xa + 0.5, y + 0.5, xb - xa - 1, h - 1);
    }
    c.globalAlpha = 1;
  }
  function drawOwned(c, inkCol) {
    const L = G.L, gap = 1.5;
    const avail = L.homeW - LY.nibW - 6;
    const bw = Math.min(10, (avail - 3 * gap) / 4), bh = Math.min(18, (L.sh - 12) / 2 - 2);
    const x0 = L.sx + 2, y0 = L.sy + (L.sh - (2 * bh + 4)) / 2;
    const t = G.now;
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) {
      const i = r * 4 + k, x = x0 + k * (bw + gap), y = y0 + r * (bh + 4);
      const fast = i === 5;
      const br = reduced ? 0 : Math.sin(t / (fast ? TM.breathFastMs : TM.breathMs) * Math.PI * 2);
      const wk = S.poweredAt < 0 ? 0 : clamp((G.now - S.poweredAt - k * 30) / TM.wakeEachMs);
      if (wk < 1) { c.globalAlpha = (1 - wk) * (0.75 + (fast ? 0.25 : 0.12) * br); c.strokeStyle = fast ? COL.graphite : COL.grid; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1); }
      if (wk > 0) { c.globalAlpha = wk * (fast ? 0.86 + 0.14 * br : 1); c.fillStyle = inkCol; c.fillRect(x, y, bw, bh); }
    }
    c.globalAlpha = 1;
  }
  function drawStrip(c) {
    const L = G.L;
    const dryK = S.end && S.end.dark ? clamp((G.now - S.end.dryAt) / TM.dryFadeMs) : 0;
    const inkCol = dryK > 0 ? mix(COL.ink, COL.dry, dryK) : COL.ink;
    const olCol = inkCol;
    // the ruled channel, edge to edge
    c.fillStyle = COL.grid; c.fillRect(0, L.sy, L.W, 1); c.fillRect(0, L.sy + L.sh - 1, L.W, 1);
    if (S.tapPulseAt >= 0) { const k = (G.now - S.tapPulseAt) / TM.tapPulseMs; if (k < 1) { c.globalAlpha = 0.06 * (1 - k); c.fillStyle = COL.ink; c.fillRect(0, L.sy + 1, L.W, L.sh - 2); c.globalAlpha = 1; } }
    drawOwned(c, inkCol);
    const ph = S.phase === 'end' ? S.endFrom : S.phase;
    const o = { inkCol, olCol };
    if (ph === 'asleep' || ph === 'drag') {
      const n = Math.max(0, S.bank);
      if (n > 0) {
        const b = S.phase === 'drag' && S.poweredAt >= 0 ? currentBet() : null;
        drawCells(c, L.tx, L.tw / n, 0, n, b ? b.t * n : 0, Object.assign(o, { wake: wakeK }));
      }
    } else if (ph === 'pour' || (ph === 'land' && !S.landRow)) {
      const R = S.run || S.runs[S.runs.length - 1];
      if (R) {
        const w0 = L.tw / R.rowN;
        drawCells(c, L.tx, w0, 0, R.ink + Math.max(0, S.bank), R.ink, o);
        if (S.flareAt >= 0 && !reduced) drawFlare(c, L.tx, L.tx + R.ink * w0);
      }
    } else if (ph === 'land' && S.landRow) {
      const LR = S.landRow, w0 = L.tw / LR.w0n;
      const liftK = reduced ? 1 : clamp((G.now - LR.liftAt) / TM.inkLiftMs);
      if (liftK < 1 && LR.ri > 0) drawCells(c, L.tx, w0, 0, LR.ri, LR.ri, Object.assign({}, o, { inkAlpha: 1 - liftK }));
      const n = Math.max(0, S.bank);
      if (n > 0) {
        const start = L.tx + LR.ri * w0;
        let w = Math.min(w0, (L.tx + L.tw - start) / n);
        if (!(w > 0)) w = 0.0001;
        if (S.repack) {
          const k = reduced ? 1 : easeIO(clamp((G.now - S.repack.start) / TM.repackMs));
          drawCells(c, start + (L.tx - start) * k, w + (L.tw / n - w) * k, 0, n, 0, o);
        } else drawCells(c, start, w, LR.ri, LR.ri + n, 0, o);
      }
    }
    // emptied lights: the outline goes out in 80 ms
    if (S.fades.length) {
      S.fades = S.fades.filter(f => G.now - f.t0 < TM.emptyOutlineMs);
      for (const f of S.fades) { c.globalAlpha = 0.4 * (1 - (G.now - f.t0) / TM.emptyOutlineMs); c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(f.x + 0.5, L.ly + 0.5, f.w - 2, L.lh - 1); }
      c.globalAlpha = 1;
    }
    // echo of a bet that crossed: hairline outline, the crawl part hatched
    if (S.echo) {
      const E = S.echo, xa = L.tx, xb = L.tx + E.f * L.tw, xw = L.tx + E.fw * L.tw;
      const k = reduced ? 1 : clamp((G.now - E.at) / 400);
      c.globalAlpha = k; c.strokeStyle = COL.ink; c.lineWidth = 1;
      c.strokeRect(xa + 0.5, L.ly + 0.5, Math.max(1, xb - xa - 1), L.lh - 1);
      drawHatch(c, xw, xb, L.ly, L.lh, 1);
      c.globalAlpha = 1;
    }
    drawNib(c, inkCol);
  }
  function drawFlare(c, xa, xb) {
    const k = (G.now - S.flareAt) / TM.flareMs;
    if (k > 1.4 || xb - xa < 1) return;
    const L = G.L, xf = xa + (xb - xa) * clamp(k), r = 22;
    c.save(); c.beginPath(); c.rect(xa, L.ly, xb - xa, L.lh); c.clip();
    const g = c.createLinearGradient(xf - r, 0, xf + r, 0);
    const a = 0.5 * (k > 1 ? 1 - (k - 1) / 0.4 : 1);
    g.addColorStop(0, 'rgba(248,248,245,0)'); g.addColorStop(0.5, 'rgba(248,248,245,' + a.toFixed(3) + ')'); g.addColorStop(1, 'rgba(248,248,245,0)');
    c.fillStyle = g; c.fillRect(xf - r, L.ly, 2 * r, L.lh);
    c.restore();
  }
  function drawNib(c, inkCol) {
    if (!(S.phase === 'asleep' || S.phase === 'drag')) return;
    const L = G.L;
    let edge = nibEdge();
    if (!S.firstDragged && S.poweredAt >= 0 && !S.drag && !reduced) {
      const since = G.now - S.poweredAt - TM.dateLineAtMs - TM.linePrintMs;
      if (since > 0) { const ph = since % TM.nudgeEveryMs; if (ph < TM.nudgeMs) edge += TM.nudgePx * Math.sin(ph / TM.nudgeMs * Math.PI); }
    }
    // returning home after a landing: a short glide in from the left end of the travel
    if (S.homeAt >= 0 && !S.drag && !reduced) { const k = clamp((G.now - S.homeAt) / 180); if (k < 1) c.globalAlpha = k; }
    const held = !!S.drag;
    if (held) { c.globalAlpha = 0.14; c.fillStyle = COL.ink; c.fillRect(edge - LY.nibW + 2, L.sy + 3, LY.nibW, L.sh); c.globalAlpha = 1; }
    c.fillStyle = inkCol;
    c.fillRect(edge - LY.nibW, L.sy - (held ? 2 : 0), LY.nibW, L.sh + (held ? 2 : 0));
    c.globalAlpha = 1;
    if (S.kbd && document.activeElement === root) {
      c.strokeStyle = COL.graphite; c.lineWidth = 1.5; c.strokeRect(edge - LY.nibW - 3.5, L.sy - 3.5, LY.nibW + 7, L.sh + 7);
    }
  }

  // ---------- render: type ----------
  function setStyle(el, prop, val) { const key = '_s_' + prop; if (el[key] !== val) { el[key] = val; el.style[prop] = val; } }
  function renderDom() {
    const L = G.L;
    // the date line: lab name in graphite, today in ink
    const dop = S.dateShown ? String(reduced ? 1 : clamp((G.now - S.linePrintAt) / 300)) : '0';
    setStyle(elDate, 'opacity', dop);
    const ds = dateOf(S.day, true);
    if (elDateTxt.textContent !== ds) elDateTxt.textContent = ds;
    // headlines: drift right to left across the top, never pausing anything
    if (S.gptHead) {
      const k = reduced ? 1 : easeOut(clamp((G.now - S.gptHead.start) / TM.gpt3DriftMs));
      setStyle(elHead, 'maxWidth', (L.pw - (L.dateX - L.px) * 2) + 'px');
      const x = (L.dateX - L.px) + (L.pw - (L.dateX - L.px)) * (1 - k);
      setStyle(elHead, 'transform', 'translate(' + x.toFixed(1) + 'px,' + (L.hlY - L.py) + 'px)');
      setStyle(elHead, 'opacity', String(reduced ? clamp((G.now - S.gptHead.start) / 300) : 1));
    } else if (S.headline) {
      const k = (G.now - S.headline.start) / TM.headlineDriftMs;
      if (reduced) {
        setStyle(elHead, 'transform', 'translate(' + (L.dateX - L.px) + 'px,' + (L.hlY - L.py) + 'px)');
        setStyle(elHead, 'maxWidth', (L.pw - (L.dateX - L.px) * 2) + 'px'); elHead.classList.add('settled');
        setStyle(elHead, 'opacity', String(clamp(Math.min(k / 0.08, (1 - k) / 0.08))));
      } else {
        const x = L.pw - k * (L.pw + S.headline.w);
        setStyle(elHead, 'transform', 'translate(' + x.toFixed(1) + 'px,' + (L.hlY - L.py) + 'px)');
        setStyle(elHead, 'opacity', '1');
      }
    } else setStyle(elHead, 'opacity', '0');
    // the band: the last sample sinks into the strip at the lift; new words rise out of it
    if (S.bandSinkAt >= 0) {
      const k = reduced ? 1 : clamp((G.now - S.bandSinkAt) / TM.sinkMs);
      elSample.style.transform = 'translateY(' + (16 * k).toFixed(1) + 'px)'; elSample.style.opacity = String(1 - k);
      if (k >= 1) { elSample.innerHTML = ''; S.band = null; S.bandSinkAt = -1; elSample.style.transform = ''; elSample.style.opacity = ''; }
    } else if (S.band && !S.band.instant) {
      const k = clamp((G.now - S.band.start) / TM.riseMs), e = easeOut(k);
      if (k < 1 || elSample.style.opacity !== '1') { elSample.style.transform = reduced ? '' : 'translateY(' + ((1 - e) * 10).toFixed(1) + 'px)'; elSample.style.opacity = k >= 1 ? '1' : e.toFixed(3); }
    }
    // the one readout: the landing date, riding above the thumb
    const bet = S.phase === 'drag' && S.poweredAt >= 0 ? currentBet() : null;
    if (bet) {
      const txt = dateOf(S.day + bet.T, false);
      if (elReadout.textContent !== txt) { elReadout.textContent = txt; elReadout._w = elReadout.offsetWidth; }
      const w = elReadout._w || 60;
      let cx, cy;
      if (S.drag) { cx = S.drag.x; cy = S.drag.y - L.readoutAbove; }
      else { cx = nibEdge() - LY.nibW / 2; cy = L.sy - L.readoutAbove + 8; }
      const x = clamp(cx - w / 2, L.gut, L.W - L.gut - w);
      setStyle(elReadout, 'transform', 'translate(' + x.toFixed(1) + 'px,' + (cy - 18).toFixed(1) + 'px)');
      setStyle(elReadout, 'opacity', '1');
    } else setStyle(elReadout, 'opacity', '0');
    // reprinted lines on the scars
    if (S.bands.length) {
      const F = viewFns(), plotR = L.px + L.pw;
      for (const b of S.bands) {
        if (!b.el) continue;
        const xb = F.X(b.lc);
        let left = xb + 8, maxW = Math.min(L.laptop ? 480 : 320, plotR - left - 10);
        if (maxW < 190) { maxW = Math.min(L.laptop ? 340 : 260, L.pw - 2 * (L.dateX - L.px)); left = Math.max(L.dateX, plotR - 10 - maxW); }
        setStyle(b.el, 'maxWidth', maxW.toFixed(0) + 'px');
        setStyle(b.el, 'transform', 'translate(' + left.toFixed(1) + 'px,' + (L.plotT + 4).toFixed(1) + 'px)');
        setStyle(b.el, 'opacity', (reduced || G.now - b.at > TM.hatchMs) ? '1' : '0');
      }
    }
    // capability moment / the GPT-3 moment: everything dims to 8% except the words (or the one dot)
    if (S.cap || S.miracle) {
      const M = S.cap || S.miracle;
      let k = M.restoreAt >= 0 ? 1 - clamp((G.now - M.restoreAt) / TM.capRestoreMs) : clamp((G.now - M.start) / TM.capDimMs);
      setStyle(elCap, 'visibility', 'visible'); setStyle(elCap, 'opacity', k.toFixed(3));
      if (S.miracle && S.press && S.press.x !== undefined) {
        setStyle(elCapDot, 'transform', 'translate(' + S.press.x.toFixed(1) + 'px,' + S.press.y.toFixed(1) + 'px)');
        setStyle(elCapDot, 'opacity', k > 0 ? '1' : '0');
      }
    } else { setStyle(elCap, 'visibility', 'hidden'); setStyle(elCap, 'opacity', '0'); setStyle(elCapDot, 'opacity', '0'); }
    setStyle(elMute, 'opacity', S.poweredAt >= 0 ? String(reduced ? 1 : clamp((G.now - S.poweredAt - TM.dateLineAtMs) / 400)) : '0');
    // the paper feed
    if (G.feed) {
      const k = clamp((G.now - G.feed.start) / TM.feedMs), e = easeIO(k);
      if (reduced) { if (G.feed.ghost) G.feed.ghost.style.opacity = String(1 - k); stage.style.opacity = String(k); }
      else { if (G.feed.ghost) G.feed.ghost.style.transform = 'translateX(' + (-e * L.W).toFixed(1) + 'px)'; stage.style.transform = 'translateX(' + ((1 - e) * L.W).toFixed(1) + 'px)'; }
    }
  }
  function render() {
    const L = G.L, c = ctx;
    c.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    c.globalAlpha = 1; c.fillStyle = COL.paper; c.fillRect(0, 0, L.W, L.H);
    drawPaper(c);
    drawStrip(c);
    renderDom();
  }

  // ---------- input ----------
  function onDown(e) {
    if (e.target && e.target.closest && e.target.closest('#fr-mute')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { root.focus({ preventScroll: true }); } catch (err) { /* fine */ }
    AU.unlock();
    if (G.feed) return;
    const L = G.L, x = e.clientX, y = e.clientY;
    if (S.phase === 'asleep') { power(e.pointerId); return; }
    if (S.phase === 'drag') {
      if (S.drag) return;
      const cx = nibEdge() - LY.nibW / 2, slop = e.pointerType === 'mouse' ? 0 : 6;
      if (Math.abs(x - cx) <= LY.nibHit / 2 + slop && y >= L.sy - 24 && y <= L.sy + L.sh + 72) startDrag(e);
      return;
    }
    if (S.phase === 'pour' && y >= L.sy - 30) requestSample();
  }
  function onMove(e) {
    if (S.drag && e.pointerId === S.drag.id) { e.preventDefault(); moveDrag(e); return; }
    if (e.pointerType === 'mouse' && G.L) {
      const L = G.L, x = e.clientX, y = e.clientY;
      const nearNib = S.phase === 'drag' && S.poweredAt >= 0 && Math.abs(x - (nibEdge() - LY.nibW / 2)) <= LY.nibHit / 2 && y >= L.sy - 24 && y <= L.sy + L.sh + 24;
      root.classList.toggle('grab', nearNib);
      root.classList.toggle('tappable', (S.phase === 'pour' && y >= L.sy - 30) || S.phase === 'asleep');
    }
  }
  function onUp(e) {
    AU.unlock();
    if (S.drag && e.pointerId === S.drag.id) { e.preventDefault(); endDrag(e); }
  }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'm' || k === 'M') { toggleMute(); e.preventDefault(); return; }
    if (e.target === elMute && (k === 'Enter' || k === ' ')) return;
    if (k === 'Tab' || k === 'Shift' || k === 'Escape') return;
    AU.unlock();
    if (G.feed) return;
    if (S.phase === 'asleep') { power(null); e.preventDefault(); return; }
    if (S.phase === 'drag' && S.poweredAt >= 0 && !S.drag) {
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        e.preventDefault();
        const st = e.shiftKey ? 0.10 : 0.02;
        let t = S.nibHome ? 0 : S.nibT;
        if (k === 'ArrowRight') { if (S.nibHome) { S.nibHome = false; t = st; } else t = Math.min(1, t + st); }
        else { t -= st; if (t <= 1e-9) { S.nibHome = true; t = 0; } }
        S.nibT = t; S.kbd = true; S.firstDragged = true;
        return;
      }
      if (k === 'Enter' || k === ' ' || k === 'Spacebar') { e.preventDefault(); lift(S.nibT, S.nibHome); return; }
    }
    if (S.phase === 'pour' && (k === 's' || k === 'S')) { e.preventDefault(); requestSample(); }
    if (k === ' ' || k.indexOf('Arrow') === 0) e.preventDefault();
  }
  function updateMuteBtn() {
    elMute.setAttribute('aria-pressed', AU.muted ? 'true' : 'false');
    elMute.setAttribute('aria-label', AU.muted ? 'Unmute sound' : 'Mute sound');
  }
  function toggleMute() {
    AU.unlock(); AU.setMuted(!AU.muted); updateMuteBtn();
    try { localStorage.setItem('frontier.muted', AU.muted ? '1' : '0'); } catch (e) { /* fine */ }
  }

  // ---------- test hook for playtesters and bots ----------
  window.__frontier = {
    state() {
      const L = G.L, R = S.run, bet = S.phase === 'drag' && S.poweredAt >= 0 ? currentBet() : null;
      return {
        sheet: S.n, seed: S.seed,
        phase: S.phase === 'drag' && S.poweredAt < 0 ? 'asleep' : S.phase,
        powered: S.poweredAt >= 0, day: +S.day.toFixed(3), date: dateOf(S.day, true),
        clockRunning: S.clockOn && (S.phase === 'drag' || S.phase === 'pour'),
        bank: +S.bank.toFixed(4), payrollMode: RU.payrollMode, payrollPerDay: +payrollPerDay().toFixed(5),
        rules: Object.assign({}, RU),
        fraction: S.drag ? S.drag.t : S.nibT, home: S.drag ? S.drag.home : S.nibHome, dragging: !!S.drag,
        bet: bet && { compute: bet.C, ink: +bet.ink.toFixed(4), days: +bet.T.toFixed(3), lands: dateOf(S.day + bet.T, true) },
        run: R && { id: R.id, compute: R.C, ink: +R.ink.toFixed(4), fraction: R.f, home: R.home, days: +R.T.toFixed(3), pourSeconds: +R.P.toFixed(2), p: +R.p.toFixed(4), grade: R.grade, r: +R.r.toFixed(4), pastWall: R.r > 1, launch: dateOf(R.launchDay, true) },
        runs: S.runs.map(q => ({ id: q.id, compute: q.C, fraction: +q.f.toFixed(4), ink: +q.ink.toFixed(4), home: q.home, days: +q.T.toFixed(3), grade: q.grade, r: +q.r.toFixed(4), outcome: q.outcome, landSample: q.landSample ? q.landSample.text : null, landFrags: q.landSample ? q.landSample.frags : null, samples: q.samples.length, caps: q.caps || [] })),
        lastSample: S.lastSample ? S.lastSample.text : null,
        lastSampleFrags: S.lastSample ? S.lastSample.frags : null, lastSampleCrawl: S.lastSample ? !!S.lastSample.crawl : null,
        wall: { W: S.W, Dwall: S.Dwall, compute: wallC(), frayFrom: computeForTokens(CFG.data.cleanBelow * S.Dwall), crossings: S.crossings, revealed: S.bands.length > 0, bands: S.bands.map(b => b.C), reprints: S.bands.map(b => b.text) },
        caps: S.caps.map(q => ({ name: q.name, compute: q.C, fired: q.fired })),
        cleanDots: S.cleanCs.slice(), bestClean: S.bestClean, reachedGPT3: S.bestClean >= CFG.gpt3.compute * (1 - 1e-9),
        dark: S.dark, end: S.end && { reason: S.end.reason, dark: S.end.dark, miracle: S.end.miracle, lastCrossed: S.end.lastCrossed },
        headline: S.gptHead ? K.gpt3Headline : (S.headline ? S.headline.text : null),
        capMoment: !!S.cap, miracleMoment: !!S.miracle, feeding: !!G.feed, speed: G.speed, muted: AU.muted,
        layout: L && { w: L.W, h: L.H, laptop: L.laptop, stripTop: L.sy, stripH: L.sh, stripY: L.sy + L.sh / 2, homeX: L.sx, homeW: L.homeW, travelX: L.tx, travelW: L.tw, nibX: nibEdge() - LY.nibW / 2, nibEdge: nibEdge(), bandTop: L.bandY, paperBottom: L.py + L.ph }
      };
    },
    act(name, payload) {
      payload = payload || {};
      switch (name) {
        case 'tap': case 'power': case 'sample':
          AU.unlock();
          if (G.feed) return false;
          if (S.phase === 'asleep') { power(null); return true; }
          if (S.phase === 'pour') return requestSample();
          return false;
        case 'drag': {
          if (S.phase !== 'drag' || S.poweredAt < 0 || S.drag) return false;
          const f = payload.fraction;
          if (payload.home || f === undefined || f === null || f < 0) { S.nibHome = true; S.nibT = 0; }
          else { S.nibHome = false; S.nibT = clamp(+f); }
          S.botHold = true; S.firstDragged = true;
          const b = currentBet();
          return { compute: b.C, ink: b.ink, days: b.T, lands: dateOf(S.day + b.T, true) };
        }
        case 'lift':
          if (S.phase !== 'drag' || S.poweredAt < 0 || S.drag) return false;
          return lift(S.nibT, S.nibHome);
        case 'launch':
          if (window.__frontier.act('drag', payload) === false) return false;
          return window.__frontier.act('lift');
        case 'newSheet': if (G.feed) return false; startFeed(); return true;
        case 'mute': toggleMute(); return AU.muted;
        case 'rules': Object.keys(payload).forEach(k => { if (k in RU) RU[k] = payload[k]; }); return Object.assign({}, RU);
        default: return false;
      }
    },
    speed(n, opts) { if (typeof n === 'number' && isFinite(n)) G.speed = clamp(n, 0.1, 60); G.slowOnEnd = !!(opts && opts.untilEnd); return G.speed; },
    // bots only: the hidden physics, so a scripted reader can size its bets the way a person learns to
    physics: { costLights, computeForSpend, runDays, tokensFor, computeForTokens, lineLoss, pourSec, C_FREE, config: CFG }
  };

  // ---------- boot ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!G.lastTs) G.lastTs = ts;
    const real = Math.min(50, Math.max(0, ts - G.lastTs));
    G.lastTs = ts;
    let realLeft = real; // substeps of at most 25 game-ms; a speed change takes effect mid-frame
    while (realLeft > 1e-6) { const sp = G.speed, st = Math.min(realLeft * sp, 25); update(st); realLeft -= st / sp; }
    render();
  }
  function boot() {
    try { AU.muted = localStorage.getItem('frontier.muted') === '1'; } catch (e) { /* fine */ }
    updateMuteBtn();
    newSheet();
    layout();
    window.addEventListener('resize', layout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
    root.addEventListener('pointerdown', onDown, { passive: false });
    root.addEventListener('pointermove', onMove, { passive: false });
    root.addEventListener('pointerup', onUp, { passive: false });
    root.addEventListener('pointercancel', e => { if (S.drag && e.pointerId === S.drag.id) endDrag(e); }, { passive: false });
    root.addEventListener('lostpointercapture', e => { if (S.drag && e.pointerId === S.drag.id) endDrag(e); });
    root.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('touchmove', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    window.addEventListener('keydown', onKey);
    elMute.addEventListener('click', e => { e.stopPropagation(); toggleMute(); });
    document.addEventListener('visibilitychange', () => { AU.suspend(document.hidden); G.lastTs = 0; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitBand(); }).catch(() => {});
    requestAnimationFrame(frame);
  }
  boot();
})();
