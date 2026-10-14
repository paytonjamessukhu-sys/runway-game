/* FRONTIER, slice one ("The Line", 23 Jan to 28 May 2020). Build A: the letter of the spec.
   Spec v6 (slice1.json) with the round-7 changes on top. One screen, four states: DRAG, POUR, LAND, END. */
(function () {
  'use strict';

  // ===========================================================================
  // CONFIG: every tunable number and every rule switch lives in this object.
  // ===========================================================================
  const CFG = {
    rules: {
      payrollMode: 'ink',               // 'ink' (round 7 default) | 'flat' (Sid) | 'none' (Musk, Madigan) | 'bank' (spec v6)
      wallEndsSheet: false,             // spec v6: true. Round 7: a crossing prints nothing and the sheet goes on
      wallAdvancesAfterCrossing: false, // Sid's filter, not sim-tested
      wallAdvanceDecades: 0.5,          // "one rung" of compute
      frayByAmount: true,               // round 7: grade l splices l fragments from one flat pool. false = v6 catalogue
      pastWallSample: 'banner',         // round 7 'banner' (the whole line is crawl) | v6 'splice'
      gpt3OnPlayerDot: true,            // round 7 #6: the GPT-3 point presses onto your farthest clean dot if you got there
      gpt3MomentNeedsAlive: false,      // whether the dry pen erases the miracle moment
      showMuteControl: true,            // house rule: an obvious way to mute
      emptyWhirrOnCrossing: false,      // v6 had a 300 ms empty whirr; round 7 wants silence where the ticks should be
    },
    money: {
      seedLights: 20,
      dollarsPerLight: 1000,
      cleanPrint: 3,                    // lights printed per inked light on a clean landing
      payrollInkShare: 0.035,           // 'ink': share of the run's ink per game day
      payrollFlatLights: 0.35,          // 'flat': lights per game day
      payrollBankShare: 0.035,          // 'bank': share of the bank at the last lift per game day
    },
    clock: {
      startUTC: Date.UTC(2020, 0, 23),
      endDay: 126,                      // 28 May 2020
      dragDaysPerSec: 0.75,
      pourBase: 6.5, pourLog: 3, pourWarp: 1.5,
    },
    compute: {
      flopsPerGpuDay: 3.456e18,
      ownedGpus: 8,
      dollarsPerGpuDay: 59.52,
      tShortDiv: 2.765e19,
      tLongCoef: 4.8, tLongRef: 1e19, tLongExp: 0.1,
      homeRunC: 2.765e19, homeRunDays: 1,
    },
    line: { Cc: 2.68e28, alpha: 0.050, onLineTol: 1.015, startLoss: 10.825 },
    data: {
      wLo: 18e9, wHi: 110e9, passes: 4,
      tokCoef: 2.0e10, tokRef: 8.64e19, tokExp: 0.27,
      frayStart: 0.65, frayStep: 0.07, frayGrades: 5,
      lateP: 0.5, lateBase: 0.4, latePer: 0.12,  // tap/auto samples at p >= 0.5 fray with 0.4 + 0.12 l
      earlyProb: 0.5, earlyMinGrade: 3, earlyDrop: 2,
    },
    caps: [
      { id: 'paragraph', log10C: Math.log10(2e21), jit: 0.2 },
      { id: 'arithmetic', log10C: 22, jit: 0.3 },
      { id: 'translation', log10C: Math.log10(6e22), jit: 0.3 },
      { id: 'code', log10C: Math.log10(2.5e23), jit: 0.3 },
    ],
    samples: {
      capShare: 0.35,
      tierLoss: [6.0, 4.3, 3.3],
      checkpoints: [0.0005, 0.002, 0.01].concat(Array.from({ length: 20 }, (_, i) => Math.round((i + 1) * 5) / 100)),
      autoP: [0.35, 0.75], autoQuietMs: 2500,
      wordMs: 45, bandMaxChars: 180, virusDay: 48,
    },
    paper: {
      xRightMin: 24.3, xLeftStart: 16, xLeftMin: 16, xLeftMax: 20, xLeftBack: 4,
      lossMin: 1.55, lossMax: 11.5, noise: 0.012, points: 320, gpt3C: 3.14e23,
    },
    ms: {
      liftRead: 100, wakeStagger: 60, wakeEach: 240, motorFade: 800, dateAt: 1000, lineAt: 1000, linePrint: 1200,
      nudgeEvery: 4000, nudgeDur: 420, liftWave: 300,
      landPause: 300, inkLift: 300, printTickMax: 40, printTotal: 1200, repack: 400, scratch: 900,
      capDim: 400, capDuck: 80, capSilence: 1000, capRestore: 600,
      endMotor: 300, dryFade: 900, drySilence: 800, hatch: 900, gptDrift: 1200, press: 300,
      fresh: 5000, freshDry: 6000, feed: 900, pan: 800, headline: 7000, payrollClickMin: 60, printTickMin: 30,
    },
    layout: {
      phone: { paperTo: 0.60, bandFrom: 0.60, bandTo: 0.78, stripAt: 0.80, stripH: 52, home: 56, gutter: 16 },
      laptop: { margin: 24, paperTo: 0.64, bandFrom: 0.64, bandTo: 0.80, stripAt: 0.82, stripH: 60, home: 72, maxStrip: 1200, bandCol: 760 },
      laptopMinWidth: 960, nibW: 12, nibHit: 44, readoutPhone: 56, readoutLaptop: 40, lightPad: 6,
    },
  };

  // ===========================================================================
  // CORPUS: the only text system. Starter strings from the spec.
  // ===========================================================================
  const CORPUS = {
    T0: ['the the , of . and to the a', '. , the of of and in', 'and the the . to , a of', 'the of , , . the and',
      'a to the . of the , in and', 'the , . the of', 'of the and . . the to a', 'the the the , and'],
    T1: ['council water said year the new of he market', 'and police the first season city were of',
      'music the 2019 people of said time government', 'her team the report . world was school',
      'the game players said of also new during', 'company the which years on percent the',
      'film was the in and county early his', 'said the data , online the free first'],
    T2: ['The city said that the new team will be a year of the water.',
      'He was born in the first of the church, and his music was a school.',
      'The company has been a member of the government for the season.',
      'In the report, the police were the best people of the world.',
      'She said the game is not a time to be the market.',
      'The film was released in the county of the president and the album.',
      'This is the first time that the river has been a player.'],
    T2virus: 'The virus is a the stock market of Tuesday.',
    T3: ['The bridge was closed on Monday after engineers found cracks in two of its supports. The city said it would reopen in the spring, or possibly the year before.',
      'Preheat the oven to 350 degrees. Mix the flour and sugar, then add the eggs one at a time, then add the oven.',
      'The team won its third straight game on Saturday, thanks to a late goal from a player who did not play.',
      'Scientists have discovered a new species of frog in the rainforest. It is about the size of a thumbnail and is believed to be the largest frog in the world.',
      'I have been using this phone for about a month now and the battery is great, but the battery is not great.',
      'The museum will be open from 9 a.m. to 5 p.m. on weekdays and from 10 a.m. to the weekend.',
      'He moved to Chicago in 1998, where he worked as a teacher, a carpenter, and eventually a river.',
      'The recipe calls for two cups of rice, which should be rinsed until the water runs clear, or until the rice runs out.'],
    T4: ['The lighthouse had been dark for eleven years when Mara climbed its stairs again. The lens was still there, wrapped in a canvas sheet her father had tied with fishing line. She cut the knots one by one, and when the cloth fell away, the glass caught the last of the evening and threw it, faintly, across the water.',
      'Sourdough starter is just flour and water left long enough for wild yeast to move in. Feed it every day and it becomes predictable: it rises, peaks, and falls on a schedule you can learn. Most failed loaves are not bad recipes. They are bakers who did not wait for the peak.',
      'The committee met for six hours and agreed on nothing except the date of the next meeting. Outside, the river kept rising. By the time the vote was taken, three members had to be reached by phone from the second floor of the library, where the water had not yet arrived.',
      'My grandmother kept every letter she ever received in a biscuit tin under her bed. When we opened it after the funeral, we found she had also kept copies of her replies, written in pencil on the backs of envelopes, so that she would always remember exactly what she had promised.'],
    arithmetic: ['Q: What is 48 plus 76? A: 124', 'Q: What is 37 plus 59? A: 96', 'Q: What is 83 plus 18? A: 101'],
    translation: ['English: The library closes at noon on Sundays. French: La bibliothèque ferme à midi le dimanche.',
      'English: Where is the train station? French: Où est la gare ?'],
    code: ['# return the largest number in a list / def largest(xs): return max(xs)',
      '# reverse a string / def reverse(s): return s[::-1]'],
  };
  // Round 7: one flat pool of web boilerplate, always in the same ink.
  const FRAY_POOL = ['Read more »', 'Share this:', 'Posted in Uncategorized', 'Tags: news, local', 'Leave a comment',
    '« Previous', 'Subscribe to our newsletter', 'Powered by WordPress', 'Home | Login', 'Accept cookies',
    'Skip to content', 'Next post »', 'Comments (0)', 'Continue reading', 'Privacy Policy'];
  // Spec v6 catalogue (used only when rules.frayByAmount is false).
  const FRAY_BY_GRADE = { 1: ['Read more »', 'Share this:'], 2: ['Posted in Uncategorized', 'Tags: news, local'],
    3: ['Leave a comment', '« Previous'], 4: ['Subscribe to our newsletter', 'Powered by WordPress'], 5: ['Home | Login', 'Accept cookies'] };
  const CRAWL = ['Click here to subscribe | Home | Login', 'We use cookies to improve your experience. Accept | Decline',
    'cheap flights cheap flights best price cheap', 'Home > Products > Home > Products', '404 Page Not Found | Return to Home',
    'Login | Register | Forgot password?', 'Copyright © 2019 All rights reserved.'];

  // Seven dated factual headlines. History speaking, never the game.
  const NEWS = [
    { day: 0, text: '23 JAN 2020 · OpenAI researchers publish “Scaling Laws for Neural Language Models”: test loss falls as a smooth power law in model size, data and compute.' },
    { day: 5, text: '28 JAN 2020 · Google unveils Meena, a 2.6-billion-parameter chatbot.' },
    { day: 18, text: '10 FEB 2020 · Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.' },
    { day: 53, text: '16 MAR 2020 · Five days after the WHO declared COVID-19 a pandemic, the Dow falls 12.9% in a day, its worst day since 1987.' },
    { day: 112, text: '14 MAY 2020 · NVIDIA announces the A100 GPU and the DGX A100 at $199,000.' },
    { day: 117, text: '19 MAY 2020 · Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.' },
  ];
  const GPT3_NEWS = '28 MAY 2020 · OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens.';

  // ===========================================================================
  // Small utilities
  // ===========================================================================
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = t => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function dateParts(day) { const d = new Date(CFG.clock.startUTC + Math.floor(day + 1e-9) * 864e5); return [d.getUTCDate(), MON[d.getUTCMonth()], d.getUTCFullYear()]; }
  const pad2 = n => (n < 10 ? '0' + n : '' + n);
  function fmtShort(day) { const p = dateParts(day); return pad2(p[0]) + ' ' + p[1]; }
  function fmtLong(day) { const p = dateParts(day); return pad2(p[0]) + ' ' + p[1] + ' ' + p[2]; }
  function hexToRgb(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; }

  // ===========================================================================
  // Physics: compute, money, the line, the data wall
  // ===========================================================================
  const K = CFG.compute;
  const runDays = C => Math.min(C / K.tShortDiv, K.tLongCoef * Math.pow(C / K.tLongRef, K.tLongExp));
  const runGpus = C => Math.max(K.ownedGpus, C / (runDays(C) * K.flopsPerGpuDay));
  const runCost = C => (runGpus(C) - K.ownedGpus) * runDays(C) * K.dollarsPerGpuDay;
  const C_FREE = (function () { // largest run that fits the owned eight (about 1.77e20)
    let lo = 19, hi = 22;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2, C = Math.pow(10, m); if (C / K.tShortDiv <= K.tLongCoef * Math.pow(C / K.tLongRef, K.tLongExp)) lo = m; else hi = m; }
    return Math.pow(10, lo);
  })();
  function computeFor(dollars) {
    if (!(dollars > 0)) return C_FREE;
    let lo = Math.log10(C_FREE), hi = 29;
    for (let i = 0; i < 64; i++) { const m = (lo + hi) / 2; if (runCost(Math.pow(10, m)) <= dollars) lo = m; else hi = m; }
    return Math.pow(10, lo);
  }
  const pourMs = T => (CFG.clock.pourBase + CFG.clock.pourLog * Math.log2(1 + T)) * 1000;
  const lineL = C => Math.pow(CFG.line.Cc / C, CFG.line.alpha);
  const lineLn = lc => CFG.line.alpha * (Math.log(CFG.line.Cc) - lc * Math.LN10);
  const D = CFG.data;
  const tokens = C => D.tokCoef * Math.pow(C / D.tokRef, D.tokExp);
  const wallCompute = Dwall => D.tokRef * Math.pow(Dwall / D.tokCoef, 1 / D.tokExp);
  function frayGrade(r) { if (r < D.frayStart) return 0; if (r > 1) return 6; return Math.min(D.frayGrades, 1 + Math.floor((r - D.frayStart) / D.frayStep + 1e-9)); }
  const P0 = Math.pow(10, -3.5);
  function curveLn(run, p) { // ln loss of the run at progress p, without noise
    const z = (Math.log10(p) + 3.5) / 3.5;
    return lineLn(Math.log10(p * run.C)) + run.H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z));
  }
  const LN_MAX = Math.log(CFG.paper.lossMax), LN_MIN = Math.log(CFG.paper.lossMin);

  // ===========================================================================
  // State
  // ===========================================================================
  const S = {
    now: 0, speed: 1, sheetNo: 0, sheetsEnded: 0, history: [], fixedSeed: null, muted: false,
    reduced: false, layout: null, dpr: 1,
  };
  try {
    const h = String(location.hash || '');
    const m = h.match(/seed=(\d+)/); if (m) S.fixedSeed = +m[1] >>> 0;
    const pm = h.match(/payroll=(ink|flat|none|bank)/); if (pm) CFG.rules.payrollMode = pm[1];
  } catch (e) { /* no hash */ }
  try { S.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { S.reduced = false; }

  // DOM
  const $ = id => document.getElementById(id);
  const stage = $('fr'), cv = $('fr-cv'), ctx = cv.getContext('2d');
  const sheetEl = $('fr-sheet'), dateEl = $('fr-date'), dayEl = $('fr-day'), newsEl = $('fr-news'), reprintEl = $('fr-reprint');
  const bandEl = $('fr-band'), sampleEl = $('fr-sample'), readoutEl = $('fr-readout'), stripEl = $('fr-strip');
  const momentEl = $('fr-moment'), momentP = $('fr-moment-p'), muteEl = $('fr-mute'), probeEl = $('fr-probe');

  // Colours from the tokens on :root
  const COL = {};
  (function () {
    let cs = null; try { cs = getComputedStyle(document.documentElement); } catch (e) { cs = null; }
    const pick = (name, fb) => { const v = cs && cs.getPropertyValue(name).trim(); return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb; };
    COL.paper = pick('--paper', '#E4E5E1'); COL.ink = pick('--ink', '#15171A'); COL.grid = pick('--grid', '#CCCFCA');
    COL.graphite = pick('--graphite', '#6E7378'); COL.reserve = pick('--reserve', '#F8F8F5');
    COL.vermilion = pick('--vermilion', '#E5482E'); COL.dry = pick('--dry', '#A9ACAA');
  })();

  // ===========================================================================
  // Sheet lifecycle
  // ===========================================================================
  function newSheet() {
    S.sheetNo++;
    S.seed = S.fixedSeed != null ? (S.fixedSeed + S.sheetNo - 1) >>> 0 : (Math.floor(Math.random() * 4294967296) >>> 0);
    const rng = S.rng = mulberry32(S.seed);
    S.W = Math.exp(Math.log(D.wLo) + rng() * (Math.log(D.wHi) - Math.log(D.wLo)));
    S.Dwall = D.passes * S.W; S.Cwall = wallCompute(S.Dwall); S.Cwall0 = S.Cwall;
    const jit = CFG.caps.map(c => c.log10C + (rng() * 2 - 1) * c.jit).sort((a, b) => a - b);
    S.caps = CFG.caps.map((c, i) => ({ id: c.id, lc: jit[i], C: Math.pow(10, jit[i]), fired: false }));
    S.phase = 'asleep'; S.powered = false; S.powerAt = -1e9;
    S.bank = CFG.money.seedLights; S.day = 0; S.clockStarted = false;
    S.lastInk = 0; S.bankAtLift = S.bank;
    S.runs = []; S.run = null; S.maxC = 0;
    S.xL = CFG.paper.xLeftStart; S.xR = CFG.paper.xRightMin; S.pan = null;
    S.hatches = []; S.reprintText = null; S.crossings = 0;
    S.nib = { t: -1, dragging: false, pid: null, buf: [], downT: 0, everDragged: false, keyed: false, px: 0, py: 0, mouse: false };
    S.bags = {}; S.bandSample = null; S.lastSample = null; S.liftBand = null; S.lastFrayedSeen = null;
    S.band = { words: [], shown: 0, next: 0 };
    S.newsIdx = 0; S.newsQ = []; S.newsActive = [];
    S.moment = null; S.momentQ = []; S.L = null; S.E = null; S.dim = 0; S.gptPress = null;
    S.pendingTap = false; S.lastTapAt = -1e9; S.lastClickAt = -1e9; S.lastPrintTickAt = -1e9;
    S.frozenView = null; S.liftAt = -1e9; S.lastNudge = 0; S.virusDone = false; S.reprintFor = null;
  }

  function power() {
    if (S.powered || S.phase !== 'asleep') return;
    S.powered = true; S.powerAt = S.now; S.phase = 'drag'; S.lastNudge = S.now + 2400;
    audioInit();
    motorTo(1, CFG.ms.motorFade);
  }

  // ===========================================================================
  // The lift: every lift launches
  // ===========================================================================
  function launch(t) { // t: share of the bank in [0,1], or null for a lift inside the home end
    if (S.phase !== 'drag' || !S.powered) return false;
    const home = t == null || t < 0;
    const bank0 = S.bank;
    let C, ink, tt = 0;
    if (home) { C = K.homeRunC; ink = 0; }
    else { tt = clamp(t, 0, 1); ink = tt * Math.max(0, bank0); C = computeFor(ink * CFG.money.dollarsPerLight); }
    const T = home ? K.homeRunDays : runDays(C);
    const Dtok = tokens(C), r = Dtok / S.Dwall;
    const run = {
      C, lc: Math.log10(C), ink, T, P: pourMs(T), launchDay: S.day, t: 0, p: 0, r, grade: frayGrade(r), home,
      bankAtLift: bank0, tLift: tt, tWall: 0, ckNext: 0, sampledUpTo: -1, result: null, done: false, lastFrayed: null,
      H0: Math.log(CFG.line.startLoss) - Math.log(lineL(P0 * C)), lx: null, ly: null,
    };
    if (!home && r > 1 && bank0 > 0) run.tWall = clamp(runCost(S.Cwall) / CFG.money.dollarsPerLight / bank0, 0, tt);
    // The pen's path, with real noise kept and never smoothed.
    const N = CFG.paper.points, rng = S.rng;
    run.lx = new Float32Array(N); run.ly = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), lp = -3.5 + 3.5 * u, p = Math.pow(10, lp);
      let y = curveLn(run, p);
      if (i < N - 1) y += gauss(rng) * CFG.paper.noise * (1 - 0.5 * u); else y = Math.log(lineL(C));
      run.lx[i] = run.lc + lp; run.ly[i] = y;
    }
    run.Lstar = lineL(C);
    S.bank = bank0 - ink;
    S.lastInk = ink; S.bankAtLift = bank0;
    S.liftBand = S.bandSample;
    S.run = run; S.runs.push(run);
    S.clockStarted = true; S.phase = 'pour'; S.liftAt = S.now;
    S.pendingTap = false; S.lastTapAt = -1e9;
    S.nib.t = -1; S.nib.dragging = false; S.nib.keyed = false;
    // Paper pan
    S.maxC = Math.max(S.maxC, C);
    const nxL = clamp(Math.floor(run.lc - CFG.paper.xLeftBack), CFG.paper.xLeftMin, CFG.paper.xLeftMax);
    const nxR = Math.max(CFG.paper.xRightMin, Math.log10(2 * S.maxC));
    if (Math.abs(nxL - S.xL) > 1e-6 || Math.abs(nxR - S.xR) > 1e-6) { S.pan = { t0: S.now, fL: S.xL, fR: S.xR, tL: nxL, tR: nxR }; whirr(CFG.ms.pan * 0.8); }
    // The last sample sinks into the strip.
    sinkBand();
    liftNote();
    motorTo(Math.pow(10, Math.log2(Math.max(1, ink)) / 20), 300);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* no haptics */ }
    return true;
  }

  // ===========================================================================
  // Payroll
  // ===========================================================================
  function payrollRate() {
    switch (CFG.rules.payrollMode) {
      case 'ink': return CFG.money.payrollInkShare * S.lastInk;
      case 'flat': return CFG.money.payrollFlatLights;
      case 'bank': return CFG.money.payrollBankShare * S.bankAtLift;
      default: return 0;
    }
  }
  function payroll(dd) {
    if (!(dd > 0) || !S.clockStarted) return;
    const before = S.bank, rate = payrollRate();
    if (rate <= 0) return;
    S.bank -= rate * dd;
    if (before > 0 && Math.ceil(S.bank - 1e-9) < Math.ceil(before - 1e-9)) {
      const rt = performance.now();
      if (rt - S.lastClickAt >= CFG.ms.payrollClickMin) { S.lastClickAt = rt; payClick(); }
    }
  }

  // ===========================================================================
  // Samples
  // ===========================================================================
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function drawFrom(key, list) {
    let bag = S.bags[key];
    if (!bag || !bag.length) bag = S.bags[key] = shuffle(list.slice(), S.rng);
    return bag.pop();
  }
  function drawTier(tier) {
    if (tier === 0) return drawFrom('T0', CORPUS.T0);
    if (tier === 1) return drawFrom('T1', CORPUS.T1);
    if (tier === 2) {
      if (S.day >= CFG.samples.virusDay && !S.virusDone) {
        const bag = S.bags.T2;
        if (!bag || !bag.length) { S.virusDone = true; S.bags.T2 = shuffle(CORPUS.T2.concat([CORPUS.T2virus]), S.rng); }
      }
      return drawFrom('T2', CORPUS.T2);
    }
    if (tier === 3) return drawFrom('T3', CORPUS.T3);
    return drawFrom('T4', CORPUS.T4);
  }
  function capString(id) {
    if (id === 'paragraph') return drawFrom('T4', CORPUS.T4);
    return drawFrom(id, CORPUS[id]);
  }
  function cutBand(text) {
    const max = CFG.samples.bandMaxChars;
    if (text.length <= max) return [text, ''];
    const sents = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
    let out = '';
    for (const s of sents) { if (out && (out + s).trim().length > max) break; out += s; }
    return [out.trim(), text.slice(out.length).trim()];
  }
  function pickFrags(n, grade) {
    const rng = S.rng;
    if (!CFG.rules.frayByAmount) { const pool = FRAY_BY_GRADE[clamp(grade, 1, 5)]; return [pool[Math.floor(rng() * pool.length)]]; }
    const pool = shuffle(FRAY_POOL.slice(), rng); const out = [];
    for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
    return out;
  }
  // Splice fragments into the middle of a sentence that otherwise reads clean:
  // between two words, in the middle third if it can, never at the start or end, never next to punctuation.
  function splice(text, frags) {
    const w = text.split(' '); const n = w.length;
    if (n < 3) return text + ' ' + frags.join(' ');
    const ok = i => !/[.,;:!?»")\]]$/.test(w[i]) && /^[A-Za-z0-9#'(]/.test(w[i + 1]) && !/^[,.;:!?]/.test(w[i + 1]);
    let cands = [];
    for (const [a, b] of [[1 / 3, 2 / 3], [0.22, 0.8], [0.12, 0.9], [0, 1]]) {
      cands = [];
      for (let i = 0; i < n - 1; i++) {
        const pos = (i + 1) / n;
        if (pos >= a && pos <= b && (i > 0 || n < 4) && (i < n - 2 || n < 4) && ok(i)) cands.push(i);
      }
      if (cands.length >= frags.length) break;
    }
    if (!cands.length) cands = [Math.floor((n - 1) / 2)];
    const rng = S.rng; const chosen = shuffle(cands.slice(), rng).slice(0, Math.min(frags.length, cands.length)).sort((x, y) => x - y);
    const at = {}; frags.forEach((f, k) => { const g = chosen[k % chosen.length]; (at[g] = at[g] || []).push(f); });
    const out = [];
    for (let i = 0; i < n; i++) { out.push(w[i]); if (at[i]) out.push(at[i].join(' ')); }
    return out.join(' ');
  }
  function crawlLine(base) {
    const rng = S.rng; const c = shuffle(CRAWL.slice(), rng);
    if (CFG.rules.pastWallSample === 'banner') return c[0] + ' ' + c[1];
    const w = base.split(' '); const half = Math.max(3, Math.floor(w.length / 2));
    return w.slice(0, half).join(' ') + ' ' + c[0] + (rng() < 0.5 ? ' ' + c[1] : '');
  }
  // kind: 'tap' | 'auto' | 'land'. forceCap: the capability whose moment this is.
  function makeSample(run, p, kind, forceCap) {
    const rng = S.rng;
    const L = kind === 'land' ? run.Lstar : Math.exp(curveLn(run, p));
    const TL = CFG.samples.tierLoss;
    let tier = L > TL[0] ? 0 : L > TL[1] ? 1 : L > TL[2] ? 2 : 3;
    const par = S.caps.find(c => c.id === 'paragraph');
    if (tier === 3 && par.fired && L <= lineL(par.C)) tier = 4;
    let base = null, capId = null;
    if (forceCap) { capId = forceCap; base = capString(forceCap); tier = Math.max(tier, 3); }
    else if (tier >= 3) {
      const elig = S.caps.filter(c => c.fired && c.id !== 'paragraph' && L <= lineL(c.C));
      if (elig.length && rng() < CFG.samples.capShare) { const c = elig[Math.floor(rng() * elig.length)]; capId = c.id; base = capString(c.id); }
    }
    if (!base) base = drawTier(tier);
    let parts = cutBand(base), band = parts[0], rest = parts[1];
    let frays = 0, crawl = false;
    if (tier >= 3) {
      const past = run.r > 1 && p >= 1 / run.r - 1e-12;
      if (past) { crawl = true; band = crawlLine(band); rest = ''; }
      else {
        const g = run.r > 1 ? 5 : run.grade;
        if (g > 0) {
          let nf = 0;
          if (kind === 'land') nf = g;
          else if (p >= D.lateP) nf = rng() < D.lateBase + D.latePer * g ? g : 0;
          else if (g >= D.earlyMinGrade && rng() < D.earlyProb) nf = g - D.earlyDrop;
          if (nf > 0) { const fr = pickFrags(nf, nf); band = splice(band, fr); frays = fr.length; }
        }
      }
    }
    return { band, full: rest ? band + ' ' + rest : band, frays, crawl, tier, capId, p, kind, day: S.day };
  }
  function sampleCheckpoint(k, kind) {
    const run = S.run; run.sampledUpTo = k;
    const s = makeSample(run, CFG.samples.checkpoints[k], kind);
    if (s.frays > 0) run.lastFrayed = s;
    showSample(s, true);
  }
  function sampleTap() {
    if (S.phase !== 'pour') return false;
    S.lastTapAt = S.now;
    const run = S.run, last = CFG.samples.checkpoints.length - 1, newest = run.ckNext - 1;
    if (newest > run.sampledUpTo && newest < last) sampleCheckpoint(newest, 'tap');
    else S.pendingTap = true;
    return true;
  }

  // Band DOM: one sample at a time, streamed at 45 ms per word.
  let bandAnim = null;
  function showSample(s, stream) {
    S.bandSample = s; S.lastSample = s;
    if (s.frays > 0) S.lastFrayedSeen = s;
    if (bandAnim) { try { bandAnim.cancel(); } catch (e) { /* ignore */ } bandAnim = null; }
    sampleEl.textContent = '';
    const words = s.band.split(' ');
    S.band.words = words.map((w, i) => {
      const sp = document.createElement('span'); sp.textContent = w; if (!stream) sp.className = 'on';
      sampleEl.appendChild(sp); if (i < words.length - 1) sampleEl.appendChild(document.createTextNode(' '));
      return sp;
    });
    S.band.shown = stream ? 0 : words.length; S.band.next = S.now;
    fitBand();
    if (!S.reduced && sampleEl.animate) {
      try { sampleEl.animate([{ transform: 'translateY(10px)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' }); } catch (e) { /* ignore */ }
    }
  }
  // Keep the whole sample inside the band: step the size down only if it would not fit.
  function fitBand() {
    const lap = S.layout && S.layout.lap, base = lap ? 19 : 17, lh = lap ? 27 / 19 : 24 / 17;
    const room = bandEl.clientHeight;
    for (let fs = base; fs >= 13; fs--) {
      sampleEl.style.fontSize = fs + 'px'; sampleEl.style.lineHeight = Math.round(fs * lh) + 'px';
      if (!room || sampleEl.scrollHeight <= room + 1) break;
    }
  }
  function sinkBand() {
    S.bandSample = null; S.band.words = []; S.band.shown = 0;
    if (!sampleEl.firstChild) return;
    if (S.reduced || !sampleEl.animate) { sampleEl.textContent = ''; return; }
    try {
      bandAnim = sampleEl.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(16px)', opacity: 0 }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
      const a = bandAnim;
      a.onfinish = () => { if (bandAnim === a) { sampleEl.textContent = ''; try { a.cancel(); } catch (e) { /* ignore */ } bandAnim = null; } };
    } catch (e) { sampleEl.textContent = ''; }
  }
  function updBand() {
    const b = S.band;
    while (b.shown < b.words.length && S.now >= b.next) {
      b.words[b.shown++].className = 'on'; b.next += CFG.samples.wordMs;
      if (S.now - b.next < 200) tokenTick();
    }
  }

  // ===========================================================================
  // POUR
  // ===========================================================================
  function updPour(dt) {
    const run = S.run, ck = CFG.samples.checkpoints;
    run.t += dt;
    let p = Math.min(1, Math.pow(run.t / run.P, CFG.clock.pourWarp));
    const day = run.launchDay + p * run.T;
    if (day > CFG.clock.endDay + 1e-9 && p < 1) { // 28 May: a run in flight stops mid-stroke and prints nothing
      const pc = (CFG.clock.endDay - run.launchDay) / run.T;
      payroll(CFG.clock.endDay - S.day); S.day = CFG.clock.endDay; run.p = pc; run.result = 'cut'; run.done = true;
      end('cut'); return;
    }
    payroll(day - S.day); S.day = day; run.p = p;
    while (run.ckNext < ck.length && ck[run.ckNext] <= p + 1e-12) {
      const k = run.ckNext++;
      if (k >= ck.length - 1) break; // the final checkpoint is the landing sample
      if (S.pendingTap) { S.pendingTap = false; sampleCheckpoint(k, 'tap'); }
      else if (CFG.samples.autoP.some(a => Math.abs(a - ck[k]) < 1e-9) && S.now - S.lastTapAt > CFG.samples.autoQuietMs && k > run.sampledUpTo) sampleCheckpoint(k, 'auto');
    }
    if (p >= 1) land();
  }

  // ===========================================================================
  // LAND
  // ===========================================================================
  function land() {
    const run = S.run;
    run.p = 1; S.pendingTap = false;
    const clean = run.r <= 1 && (run.Lstar <= CFG.line.onLineTol * run.Lstar);
    run.result = clean ? 'clean' : 'wall';
    const fresh = clean ? S.caps.filter(c => !c.fired && run.C >= c.C) : [];
    fresh.forEach(c => { c.fired = true; });
    S.momentQ = fresh.map(c => ({ kind: 'cap', sample: makeSample(run, 1, 'land', c.id) }));
    const landSample = S.momentQ.length ? S.momentQ[S.momentQ.length - 1].sample : makeSample(run, 1, 'land');
    run.landSample = landSample;
    S.phase = 'land';
    S.L = { step: 'pause', t: 0, landSample, kept: S.bank, total: clean ? CFG.money.cleanPrint * run.ink : 0, printed: 0, n: 0, iv: 0, count: 0, wPrint: 0, toDrag: false };
  }
  function updLand(dt) {
    const L = S.L, run = S.run, M = CFG.ms; L.t += dt;
    switch (L.step) {
      case 'pause':
        if (L.t >= M.landPause) {
          L.t = 0;
          if (S.momentQ.length) { startMoment(S.momentQ.shift()); L.step = 'moment'; }
          else { L.step = 'lift'; showSample(L.landSample, true); }
        }
        break;
      case 'moment':
        if (!S.moment) {
          if (S.momentQ.length) startMoment(S.momentQ.shift());
          else { L.step = 'lift'; L.t = 0; showSample(L.landSample, false); }
        }
        break;
      case 'lift':
        if (L.t >= M.inkLift) {
          L.t = 0;
          if (run.result === 'clean') {
            if (L.total > 1e-9) { L.step = 'print'; L.n = Math.ceil(L.total - 1e-9); L.iv = Math.min(M.printTickMax, M.printTotal / L.n); }
            else { L.step = 'repack'; }
          } else {
            S.crossings++;
            if (CFG.rules.emptyWhirrOnCrossing) whirr(300);
            if (S.bank <= 0 || CFG.rules.wallEndsSheet) { end(S.bank <= 0 ? 'dark' : 'wall'); return; }
            L.step = 'scratch'; scratchBand(run);
          }
        }
        break;
      case 'print': {
        const want = Math.min(L.n, Math.floor(L.t / L.iv) + 1);
        while (L.count < want) {
          L.count++;
          const amt = Math.min(1, L.total - L.printed);
          L.printed += amt; S.bank += amt;
          const rt = performance.now();
          if (rt - S.lastPrintTickAt >= M.printTickMin) { S.lastPrintTickAt = rt; printTick(); }
        }
        if (L.count >= L.n && L.t >= L.n * L.iv + 60) { L.step = 'repack'; L.t = 0; }
        break;
      }
      case 'scratch':
        if (L.t >= M.scratch) { L.step = 'repack'; L.t = 0; }
        break;
      case 'repack':
        if (L.t >= M.repack) finishLand();
        break;
    }
  }
  function finishLand() {
    const run = S.run; run.done = true;
    S.L = null; S.run = null; S.phase = 'drag'; S.nib.t = -1;
    motorTo(1, 400);
    if (S.bank <= 0) { end('dark'); return; }
    if (S.day >= CFG.clock.endDay - 1e-9) { end('may28'); return; }
  }
  // Round 7: a crossing scratches the hatch band across the paper. It stays as a scar.
  function scratchBand(run) {
    const lc = Math.log10(S.Cwall);
    const text = reprintChoice(run);
    let h = S.hatches.find(x => Math.abs(x.lc - lc) < 1e-9);
    if (!h) { h = { lc, t0: S.now }; S.hatches.push(h); } else h.t0 = S.now;
    if (text) S.reprintText = text;
    S.reprintFor = h;
    nibScratch(CFG.ms.hatch);
    if (CFG.rules.wallAdvancesAfterCrossing) { // never drawn: only the words warn you
      S.Cwall = S.Cwall * Math.pow(10, CFG.rules.wallAdvanceDecades);
      S.Dwall = tokens(S.Cwall); S.W = S.Dwall / D.passes;
    }
  }
  function reprintChoice(crossRun) {
    if (S.liftBand && S.liftBand.frays > 0) return S.liftBand.band;
    if (S.lastFrayedSeen && S.lastFrayedSeen.frays > 0) return S.lastFrayedSeen.band;
    if (crossRun && crossRun.landSample) return crossRun.landSample.band;
    return null;
  }

  // ===========================================================================
  // Moments: capability crossings and GPT-3 on your own dot
  // ===========================================================================
  function startMoment(m) {
    const words = m.sample ? m.sample.full.split(' ') : [];
    momentP.textContent = '';
    const spans = words.map((w, i) => { const sp = document.createElement('span'); sp.textContent = w; momentP.appendChild(sp); if (i < words.length - 1) momentP.appendChild(document.createTextNode(' ')); return sp; });
    S.moment = { kind: m.kind, sample: m.sample, spans, shown: 0, t: 0, next: 0, stage: 'in', holdAt: 0, outAt: 0 };
  }
  function updMoment(dt) {
    const m = S.moment; if (!m) { S.dim = 0; return; }
    const M = CFG.ms; m.t += dt;
    while (m.shown < m.spans.length && m.t >= m.next) { m.spans[m.shown++].className = 'on'; m.next += CFG.samples.wordMs; tokenTick(); }
    if (m.stage === 'in' && m.shown >= m.spans.length && m.t >= Math.max(M.capDim, m.next)) { m.stage = 'hold'; m.holdAt = m.t; duck(true); }
    if (m.stage === 'hold' && m.t - m.holdAt >= M.capDuck + M.capSilence) { m.stage = 'out'; m.outAt = m.t; duck(false); }
    if (m.stage === 'in') S.dim = clamp(m.t / M.capDim, 0, 1);
    else if (m.stage === 'hold') S.dim = 1;
    else S.dim = 1 - clamp((m.t - m.outAt) / M.capRestore, 0, 1);
    if (m.stage === 'out' && m.t - m.outAt >= M.capRestore) { S.moment = null; S.dim = 0; momentP.textContent = ''; }
  }

  // ===========================================================================
  // END and the fresh sheet
  // ===========================================================================
  function end(reason) {
    if (S.phase === 'end' || S.phase === 'feed') return;
    S.frozenView = stripView(); S.frozenView.flare = null;
    const fromPhase = S.phase;
    S.phase = 'end';
    const dry = S.bank <= 0;
    const M = CFG.ms;
    const lastRun = S.runs[S.runs.length - 1];
    S.E = { t: 0, reason, dry, from: fromPhase, t0: dry ? M.dryFade + M.drySilence : M.endMotor, hatchDone: false, gptDone: false, pressDone: false,
      feedAt: dry ? M.freshDry : M.fresh, echo: null, lastRun };
    if (lastRun && lastRun.result === 'wall') S.E.echo = { t1: lastRun.tLift, tw: lastRun.tWall };
    S.L = null; S.momentQ = []; S.nib.dragging = false;
    clearNews(false);
    if (dry) dryAudio(); else motorTo(0, M.endMotor);
    const best = bestClean();
    S.sheetsEnded++;
    S.history.push({ sheet: S.sheetNo, seed: S.seed, reason, dark: dry, day: S.day, runs: S.runs.length, bestLog10C: best ? +best.lc.toFixed(3) : null,
      reachedGpt3: !!(best && best.C >= CFG.paper.gpt3C), wallLog10C: +Math.log10(S.Cwall0).toFixed(3), crossings: S.crossings, bank: +S.bank.toFixed(2) });
  }
  function bestClean() { let b = null; for (const r of S.runs) if (r.result === 'clean' && (!b || r.C > b.C)) b = r; return b; }
  function leftClean() { let b = null; for (const r of S.runs) if (r.result === 'clean' && (!b || r.C < b.C)) b = r; return b; }
  function updEnd(dt) {
    const E = S.E, M = CFG.ms; E.t += dt;
    if (!E.hatchDone && E.t >= E.t0) {
      E.hatchDone = true;
      const lc = Math.log10(S.Cwall);
      if (lc <= S.xR && !S.hatches.some(h => Math.abs(h.lc - lc) < 1e-9)) {
        const h = { lc, t0: S.now }; S.hatches.push(h);
        const txt = (S.liftBand && S.liftBand.frays > 0) ? S.liftBand.band : (S.lastFrayedSeen ? S.lastFrayedSeen.band : (E.lastRun && E.lastRun.result === 'wall' && E.lastRun.landSample ? E.lastRun.landSample.band : null));
        if (txt) { S.reprintText = txt; S.reprintFor = h; }
        nibScratch(M.hatch);
      }
    }
    if (!E.gptDone && E.t >= E.t0 + M.hatch) { E.gptDone = true; startGptHeadline(); }
    if (!E.pressDone && E.t >= E.t0 + M.hatch + M.gptDrift) {
      E.pressDone = true;
      const best = bestClean();
      const miracle = !!(best && best.C >= CFG.paper.gpt3C && (!CFG.rules.gpt3MomentNeedsAlive || !E.dry));
      S.gptPress = { t0: S.now, onLc: miracle && CFG.rules.gpt3OnPlayerDot ? best.lc : Math.log10(CFG.paper.gpt3C), miracle };
      if (miracle) startMoment({ kind: 'gpt3', sample: null });
    }
    if (E.t >= E.feedAt && !S.moment) startFeed();
  }
  let feedSnap = null;
  function startFeed() {
    try {
      feedSnap = feedSnap || document.createElement('canvas');
      feedSnap.width = cv.width; feedSnap.height = cv.height;
      feedSnap.getContext('2d').drawImage(cv, 0, 0);
    } catch (e) { feedSnap = null; }
    S.feed = { t: 0 };
    newSheet();
    S.phase = 'feed';
    whirr(CFG.ms.feed);
  }
  function updFeed(dt) {
    S.feed.t += dt;
    if (S.feed.t >= CFG.ms.feed) {
      S.phase = 'asleep'; S.feed = null;
      clearSheetDOM();
    }
  }
  function clearSheetDOM() {
    sheetEl.style.transform = ''; sheetEl.style.opacity = '';
    clearNews(true); newsEl.textContent = ''; sampleEl.textContent = ''; reprintEl.className = 'fr-reprint'; reprintEl.textContent = '';
    for (const k in domCache) delete domCache[k];
    dateEl.className = 'fr-date'; dayEl.textContent = ''; momentP.textContent = '';
  }

  // ===========================================================================
  // DRAG (the clock and payroll run while the nib is live, after the first lift)
  // ===========================================================================
  function updDrag(dt) {
    if (!S.powered || !S.clockStarted) return;
    const dd = dt / 1000 * CFG.clock.dragDaysPerSec;
    if (S.day + dd >= CFG.clock.endDay) { payroll(CFG.clock.endDay - S.day); S.day = CFG.clock.endDay; end(S.bank <= 0 ? 'dark' : 'may28'); return; }
    payroll(dd); S.day += dd;
    if (S.bank <= 0) end('dark');
  }

  // ===========================================================================
  // History: headlines drift right to left across the top and never pause anything
  // ===========================================================================
  function updNewsTriggers() {
    if (!S.powered || S.phase === 'end' || S.phase === 'feed') return;
    while (S.newsIdx < NEWS.length && S.day >= NEWS[S.newsIdx].day) {
      if (S.newsIdx === 0 && S.now - S.powerAt < CFG.ms.dateAt) break;
      S.newsQ.push(NEWS[S.newsIdx++].text);
    }
  }
  function clearNews(all) {
    S.newsQ = [];
    for (const a of S.newsActive) { if (all || !a.settle) a.el.remove(); }
    S.newsActive = all ? [] : S.newsActive.filter(a => a.settle);
  }
  function startHeadline(text, settle) {
    const el = document.createElement('div'); el.className = 'fr-hl' + (settle ? ' settle' : ''); el.textContent = text;
    const P = S.layout.paper;
    if (settle) el.style.width = Math.max(120, P.w - 32) + 'px';
    newsEl.appendChild(el);
    const a = { el, t0: S.now, w: el.offsetWidth || 400, settle };
    S.newsActive.push(a); return a;
  }
  function startGptHeadline() { startHeadline(GPT3_NEWS, true); }
  function updNews() {
    if (S.phase === 'asleep') return;
    const P0w = S.layout.paper, P = { x: 0, w: P0w.w }, right = P.w;
    if (S.newsQ.length && S.phase !== 'end' && S.phase !== 'feed') {
      const lastA = S.newsActive.filter(a => !a.settle).slice(-1)[0];
      let free = true;
      if (lastA) { const prog = (S.now - lastA.t0) / CFG.ms.headline; const x = right - prog * (P.w + lastA.w); free = x + lastA.w < right - 48; }
      if (free) startHeadline(S.newsQ.shift(), false);
    }
    for (let i = S.newsActive.length - 1; i >= 0; i--) {
      const a = S.newsActive[i];
      if (a.settle) {
        const e = easeOut((S.now - a.t0) / CFG.ms.gptDrift);
        const x = S.reduced ? P.x + 16 : lerp(right, P.x + 16, e);
        a.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
        if (S.reduced) a.el.style.opacity = String(clamp((S.now - a.t0) / 400, 0, 1));
        continue;
      }
      const prog = (S.now - a.t0) / CFG.ms.headline;
      if (prog >= 1) { a.el.remove(); S.newsActive.splice(i, 1); continue; }
      if (S.reduced) { a.el.style.transform = 'translate3d(' + (P.x + 16) + 'px,0,0)'; a.el.style.opacity = String(Math.min(1, prog * 8, (1 - prog) * 8)); a.el.style.whiteSpace = 'normal'; a.el.style.width = (P.w - 32) + 'px'; }
      else a.el.style.transform = 'translate3d(' + (right - prog * (P.w + a.w)).toFixed(1) + 'px,0,0)';
    }
  }

  // ===========================================================================
  // Layout
  // ===========================================================================
  function readSafe() {
    try { const cs = getComputedStyle(probeEl); return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 }; }
    catch (e) { return { t: 0, r: 0, b: 0, l: 0 }; }
  }
  function computeLayout() {
    const vw = Math.max(1, stage.clientWidth || window.innerWidth), vh = Math.max(1, stage.clientHeight || window.innerHeight);
    const sa = readSafe(), lapMode = vw >= CFG.layout.laptopMinWidth;
    const L = { vw, vh, lap: lapMode, sa };
    if (lapMode) {
      const c = CFG.layout.laptop, m = c.margin;
      L.paper = { x: m, y: m, w: vw - 2 * m, h: vh * c.paperTo - m };
      L.band = { x: (vw - Math.min(c.bandCol, vw - 2 * m)) / 2, w: Math.min(c.bandCol, vw - 2 * m), y0: vh * c.bandFrom + 8, y1: vh * c.bandTo - 6 };
      const sw = Math.min(L.paper.w, c.maxStrip);
      L.strip = { x: (vw - sw) / 2, y: Math.round(vh * c.stripAt), w: sw, h: c.stripH, home: c.home };
      L.dateX = m + 16; L.dateY = m + 16; L.newsY = m + 40;
    } else {
      const c = CFG.layout.phone, g = c.gutter;
      L.paper = { x: 0, y: 0, w: vw, h: vh * c.paperTo };
      L.band = { x: g + sa.l, w: vw - 2 * g - sa.l - sa.r, y0: vh * c.bandFrom + 6, y1: vh * c.bandTo - 4 };
      L.strip = { x: g + sa.l, y: Math.round(vh * c.stripAt), w: vw - 2 * g - sa.l - sa.r, h: c.stripH, home: c.home };
      L.dateX = 16 + sa.l; L.dateY = 16 + sa.t; L.newsY = 40 + sa.t;
    }
    L.strip.tx = L.strip.x + L.strip.home; L.strip.tw = L.strip.w - L.strip.home;
    L.plot = { y0: L.paper.y + (lapMode ? 64 : 60) + (lapMode ? 0 : sa.t), y1: L.paper.y + L.paper.h - 10 };
    return L;
  }
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    S.layout = computeLayout();
    const L = S.layout;
    cv.width = Math.round(L.vw * dpr); cv.height = Math.round(L.vh * dpr);
    cv.style.width = L.vw + 'px'; cv.style.height = L.vh + 'px';
    S.dpr = dpr;
    dateEl.style.left = L.dateX + 'px'; dateEl.style.top = L.dateY + 'px';
    newsEl.style.top = L.newsY + 'px'; newsEl.style.left = L.paper.x + 'px'; newsEl.style.width = L.paper.w + 'px';
    bandEl.style.left = L.band.x + 'px'; bandEl.style.width = L.band.w + 'px';
    bandEl.style.top = L.band.y0 + 'px'; bandEl.style.height = Math.max(24, L.band.y1 - L.band.y0) + 'px';
    const st = L.strip;
    stripEl.style.left = st.x + 'px'; stripEl.style.top = st.y + 'px'; stripEl.style.width = st.w + 'px'; stripEl.style.height = st.h + 'px';
    muteEl.style.right = (L.lap ? Math.max(8, L.vw - st.x - st.w - 12) : 4 + L.sa.r) + 'px';
    muteEl.style.bottom = (L.lap ? 8 : 4 + L.sa.b) + 'px';
    for (const a of S.newsActive || []) if (a.settle) a.el.style.width = Math.max(120, L.paper.w - 32) + 'px';
    if (sampleEl.firstChild) fitBand();
  }

  // ===========================================================================
  // Rendering: the paper
  // ===========================================================================
  function X(lc) { const P = S.layout.paper; return P.x + (lc - S.xL) / (S.xR - S.xL) * P.w; }
  function Y(ln) { const pl = S.layout.plot; return pl.y0 + (LN_MAX - ln) / (LN_MAX - LN_MIN) * (pl.y1 - pl.y0); }
  function updPan() {
    if (!S.pan) return;
    const e = easeIO((S.now - S.pan.t0) / CFG.ms.pan);
    S.xL = lerp(S.pan.fL, S.pan.tL, e); S.xR = lerp(S.pan.fR, S.pan.tR, e);
    if (e >= 1) S.pan = null;
  }
  function inkCol() { return S.E && S.E.dry ? mix(COL.ink, COL.dry, clamp(S.E.t / CFG.ms.dryFade, 0, 1)) : COL.ink; }
  function pathRun(run, u) {
    const N = run.lx.length, fi = clamp(u, 0, 1) * (N - 1), k = Math.floor(fi);
    ctx.moveTo(X(run.lx[0]), Y(run.ly[0]));
    for (let i = 1; i <= k; i++) ctx.lineTo(X(run.lx[i]), Y(run.ly[i]));
    if (k < N - 1) { const f = fi - k; ctx.lineTo(X(lerp(run.lx[k], run.lx[k + 1], f)), Y(lerp(run.ly[k], run.ly[k + 1], f))); }
  }
  function liveRun() { return S.run && (S.phase === 'pour' || S.phase === 'land' || S.phase === 'end') ? S.run : null; }
  const uOf = p => (p < P0 ? -1 : (Math.log10(p) + 3.5) / 3.5);
  function drawPaper() {
    const L = S.layout, P = L.paper, ink = COL.ink;
    ctx.save();
    ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    // Faint log-log decade grid
    ctx.fillStyle = COL.grid;
    for (let d = Math.ceil(S.xL - 1e-9); d <= S.xR + 1e-9; d++) ctx.fillRect(Math.round(X(d)), P.y, 1, P.h);
    for (const v of [2, 5, 10]) ctx.fillRect(P.x, Math.round(Y(Math.log(v))), P.w, 1);
    // Hatch bands (vermilion, the scar)
    for (const h of S.hatches) drawHatch(h);
    if (!S.powered) { ctx.restore(); return; }
    // The dotted scaling-law line
    const rev = clamp((S.now - S.powerAt - CFG.ms.lineAt) / CFG.ms.linePrint, 0, 1);
    if (rev > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w * rev, P.h); ctx.clip();
      ctx.strokeStyle = COL.graphite; ctx.lineWidth = 1; ctx.setLineDash([1, 2]);
      ctx.beginPath(); ctx.moveTo(X(S.xL), Y(lineLn(S.xL)) + 0.5); ctx.lineTo(X(S.xR), Y(lineLn(S.xR)) + 0.5); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    // Finished curves at 35% ink
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const live = liveRun();
    for (const run of S.runs) {
      if (run === live) continue;
      ctx.globalAlpha = 0.35; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); pathRun(run, uOf(run.p)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Verified line between your leftmost and furthest clean dots
    const lo = leftClean(), hi = bestClean();
    if (lo && hi && hi !== lo) { ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(lo.lc), Y(lineLn(lo.lc))); ctx.lineTo(X(hi.lc), Y(lineLn(hi.lc))); ctx.stroke(); }
    // Dots and rings
    for (const run of S.runs) {
      if (!run.result || run.result === 'cut' || (run === S.run && S.phase === 'land' && S.L && S.L.step === 'pause')) continue;
      const x = X(run.lc), y = Y(lineLn(run.lc));
      if (run.result === 'clean') { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      else if (run.result === 'wall') {
        ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillRect(Math.round(x) - 0.5, y - 6, 1, 3); ctx.fillRect(Math.round(x) - 0.5, y + 3, 1, 3);
      }
    }
    // GPT-3: an unlabelled hollow graphite ring, pressing in at END as a plain ink point
    if (rev >= 1) {
      const g = S.gptPress;
      if (!g) {
        const lc = Math.log10(CFG.paper.gpt3C);
        ctx.strokeStyle = COL.graphite; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(lc), Y(lineLn(lc)), 3.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // The mark: a 6 px ink tick on the line at the dragged compute
    const mc = markCompute();
    if (mc) { const lc = Math.log10(mc), x = Math.round(X(lc)) - 0.5, y = Y(lineLn(lc)); ctx.fillStyle = ink; ctx.fillRect(x, y - 3, 1.5, 6); }
    // The live curve and the pen
    const run = live;
    if (run) {
      const u = uOf(run.p);
      if (u >= 0) {
        let alpha = 1, dy = 0;
        ctx.globalAlpha = alpha; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); pathRun(run, u); ctx.stroke();
        const N = run.lx.length, fi = clamp(u, 0, 1) * (N - 1), k = Math.floor(fi), f = fi - k;
        const hx = X(k < N - 1 ? lerp(run.lx[k], run.lx[k + 1], f) : run.lx[N - 1]);
        const hy = Y(k < N - 1 ? lerp(run.ly[k], run.ly[k + 1], f) : run.ly[N - 1]) + dy;
        if (S.phase === 'pour') { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, Math.PI * 2); ctx.fill(); }
        penSpeed(hx);
      }
    } else penSpeed(null);
    // Dry pen: the last 3% of the stroke fades to grey
    if (S.E && S.E.dry) {
      const lr = S.E.lastRun;
      if (lr && lr.lx) {
        const N = lr.lx.length, uEnd = clamp(uOf(lr.p), 0, 1), u0 = Math.max(0, uEnd - 0.03);
        const e = clamp(S.E.t / CFG.ms.dryFade, 0, 1);
        ctx.save(); ctx.strokeStyle = COL.dry; ctx.lineWidth = 2.2; ctx.globalAlpha = e;
        ctx.beginPath(); const i0 = Math.floor(u0 * (N - 1)), i1 = Math.floor(uEnd * (N - 1));
        ctx.moveTo(X(lr.lx[i0]), Y(lr.ly[i0])); for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(X(lr.lx[i]), Y(lr.ly[i]));
        ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }
  function drawGptPoint(above) {
    const g = S.gptPress; if (!g) return;
    const e = easeOut((S.now - g.t0) / CFG.ms.press);
    const x = X(g.onLc), y = Y(lineLn(g.onLc));
    ctx.save();
    if (above) { ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); return; }
    ctx.globalAlpha = e; ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x, y, lerp(4.5, 2.5, e), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawHatch(h) {
    const P = S.layout.paper, x0 = X(h.lc), right = P.x + P.w;
    if (x0 >= right) return;
    const prog = S.reduced ? 1 : clamp((S.now - h.t0) / CFG.ms.hatch, 0, 1);
    const x1 = x0 + (right - x0) * prog;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, P.y, x1 - x0, P.h); ctx.clip();
    ctx.strokeStyle = COL.vermilion; ctx.lineWidth = 1; ctx.beginPath();
    const start = P.x + Math.floor((x0 - P.h - P.x) / 6) * 6;
    for (let s = start; s < right; s += 6) { ctx.moveTo(s + 0.5, P.y + P.h); ctx.lineTo(s + 0.5 + P.h, P.y); }
    ctx.stroke(); ctx.restore();
  }
  function markCompute() {
    if (S.phase === 'pour' || S.phase === 'land') return S.run ? S.run.C : null;
    if (S.phase === 'drag' && S.powered && (S.nib.dragging || S.nib.t >= 0)) return dragCompute();
    return null;
  }
  function dragShare() { return S.nib.t < 0 ? null : clamp(S.nib.t, 0, 1); }
  function dragCompute() { const t = dragShare(); return t == null ? K.homeRunC : computeFor(t * Math.max(0, S.bank) * CFG.money.dollarsPerLight); }
  function landingDate() { const C = dragCompute(); const T = dragShare() == null ? K.homeRunDays : runDays(C); return fmtShort(S.day + T); }

  // ===========================================================================
  // Rendering: the strip (the bank as lights, with the machine printed into it)
  // ===========================================================================
  function stripView() {
    const st = S.layout.strip, tw = st.tw, M = CFG.ms;
    const v = { w: tw / 20, origin: 0, segs: [], asleep: false, wake: null, nib: null, flare: null };
    if (S.phase === 'end' && S.frozenView) return S.frozenView;
    if (S.phase === 'asleep' || S.phase === 'feed' || !S.powered) {
      v.asleep = true; v.segs.push({ kind: 'white', from: 0, to: CFG.money.seedLights, grid: 0 });
      v.nib = st.tx - CFG.layout.nibW / 2; return v;
    }
    if (S.phase === 'drag') {
      const n = Math.max(0, S.bank); v.w = n > 1e-6 ? tw / n : tw;
      const t = dragShare(); const flood = t == null ? 0 : t * n;
      if (flood > 0) v.segs.push({ kind: 'ink', from: 0, to: flood, grid: 0 });
      v.segs.push({ kind: 'white', from: flood, to: n, grid: 0 });
      if (S.now - S.powerAt < (28 * M.wakeStagger + M.wakeEach)) v.wake = S.now - S.powerAt;
      let nx = t == null ? st.tx - CFG.layout.nibW / 2 : st.tx + t * tw;
      if (S.nib.dragging && S.nib.homeX != null) nx = S.nib.homeX;
      if (!S.nib.everDragged && !S.reduced && S.now > S.lastNudge) {
        const ph = (S.now - S.lastNudge) % M.nudgeEvery;
        if (ph < M.nudgeDur) nx += CFG.layout.nibW / 2 * Math.sin(Math.PI * ph / M.nudgeDur);
      }
      v.nib = nx; return v;
    }
    const run = S.run; if (!run) return v;
    const nLift = Math.max(1e-6, run.bankAtLift);
    v.w = tw / nLift;
    if (S.phase === 'pour' || (S.phase === 'land' && (S.L.step === 'pause' || S.L.step === 'moment'))) {
      v.segs.push({ kind: 'ink', from: 0, to: run.ink, grid: 0 });
      v.segs.push({ kind: 'white', from: run.ink, to: run.ink + Math.max(0, S.bank), grid: run.ink });
      if (S.phase === 'pour') v.flare = (S.now - S.liftAt) / M.liftWave;
      return v;
    }
    const L = S.L, kept = Math.max(0, L.kept), shown = Math.max(0, L.printed + Math.min(0, L.kept));
    if (L.step === 'lift') {
      const e = clamp(L.t / M.inkLift, 0, 1);
      v.segs.push({ kind: 'ink', from: 0, to: run.ink, grid: 0, alpha: 1 - e, dy: -6 * e });
      v.segs.push({ kind: 'white', from: run.ink, to: run.ink + kept, grid: run.ink });
      return v;
    }
    const total = run.ink + kept + shown;
    const wPrint = tw / Math.max(nLift, total);
    v.w = wPrint;
    v.segs.push({ kind: 'white', from: run.ink, to: run.ink + kept, grid: run.ink });
    if (shown > 0) v.segs.push({ kind: 'white', from: run.ink + kept, to: run.ink + kept + shown, grid: run.ink + kept, fresh: true });
    if (L.step === 'repack') {
      const e = easeIO(L.t / M.repack), n = Math.max(1e-6, kept + shown);
      v.origin = run.ink * e; v.w = lerp(wPrint, tw / n, e);
      if (e > 0.5) v.nib = st.tx - CFG.layout.nibW / 2;
    }
    return v;
  }
  function drawStrip() {
    const L = S.layout, st = L.strip, M = CFG.ms;
    const v = stripView();
    const dryE = S.E && S.E.dry ? clamp(S.E.t / M.dryFade, 0, 1) : 0;
    const ink = dryE ? mix(COL.ink, COL.dry, dryE) : COL.ink;
    const pad = CFG.layout.lightPad, top = st.y + pad, h = st.h - 2 * pad;
    // Channel rulings
    ctx.fillStyle = COL.grid; ctx.fillRect(st.x, st.y, st.w, 1); ctx.fillRect(st.x, st.y + st.h - 1, st.w, 1);
    // The eight owned blocks (the DGX-1): two rows of four
    const bw = 10, bh = Math.min(18, (h - 4) / 2), gap = st.home >= 70 ? 2 : 1;
    const bx0 = st.x + Math.max(0, Math.floor((st.home - CFG.layout.nibW - 2 - (4 * bw + 3 * gap)) / 2)), by0 = st.y + (st.h - (2 * bh + 4)) / 2;
    const breatheSlow = S.reduced ? 0 : Math.sin(S.now / 4000 * Math.PI * 2), breatheFast = S.reduced ? 0 : Math.sin(S.now / 1200 * Math.PI * 2);
    for (let i = 0; i < 8; i++) {
      const col = i % 4, row = Math.floor(i / 4), x = bx0 + col * (bw + gap), y = by0 + row * (bh + 4);
      const awake = v.asleep ? 0 : wakeOf(v, col * 2 + row);
      const breath = i === 5 ? breatheFast : breatheSlow;
      if (awake <= 0) {
        ctx.fillStyle = COL.reserve; ctx.fillRect(x, y, bw, bh);
        ctx.globalAlpha = clamp(0.9 + 0.1 * breath, 0, 1); ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = COL.reserve; ctx.fillRect(x, y, bw, bh);
        ctx.globalAlpha = awake * clamp(0.92 + 0.08 * breath, 0, 1); ctx.fillStyle = ink; ctx.fillRect(x, y, bw, bh); ctx.globalAlpha = 1;
      }
    }
    // Lights
    const merged = v.w < 4;
    ctx.save(); ctx.beginPath(); ctx.rect(st.tx - 1, st.y, st.tw + 2, st.h); ctx.clip();
    for (const s of v.segs) {
      if (s.to - s.from <= 1e-6) continue;
      const y = top + (s.dy || 0);
      ctx.globalAlpha = s.alpha == null ? 1 : s.alpha;
      if (merged) {
        const x0 = st.tx + (s.from - v.origin) * v.w, x1 = st.tx + (s.to - v.origin) * v.w;
        if (s.kind === 'ink') { ctx.fillStyle = ink; ctx.fillRect(x0, y, x1 - x0, h); }
        else {
          ctx.fillStyle = COL.reserve; ctx.fillRect(x0, y, x1 - x0, h);
          ctx.strokeStyle = ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y + 0.5, Math.max(0, x1 - x0 - 1), h - 1); ctx.globalAlpha = 1;
          ctx.fillStyle = COL.grid;
          for (let k = Math.ceil((s.from - s.grid) / 40) * 40 + s.grid; k < s.to; k += 40) if (k > s.from) ctx.fillRect(Math.round(st.tx + (k - v.origin) * v.w), y + 1, 1, h - 2);
        }
        continue;
      }
      let k = Math.floor(s.from - s.grid + 1e-9);
      for (let guard = 0; guard < 4000; guard++, k++) {
        const a = Math.max(s.from, s.grid + k), b = Math.min(s.to, s.grid + k + 1);
        if (a >= s.to - 1e-9) break;
        if (b <= a + 1e-9) continue;
        const x0 = st.tx + (a - v.origin) * v.w; let x1 = st.tx + (b - v.origin) * v.w;
        if (b >= s.grid + k + 1 - 1e-9) x1 -= 1;
        if (x1 - x0 < 0.4) continue;
        if (s.kind === 'ink') {
          ctx.fillStyle = ink; ctx.fillRect(x0, y, x1 - x0, h);
          if (v.flare != null && v.flare < 1.6) { // one wave across the inked lights, left to right
            const pos = s.to > 0 ? (a + b) / 2 / s.to : 0, f = 1 - Math.abs(v.flare * 1.2 - pos) * 5;
            if (f > 0) { ctx.globalAlpha = 0.55 * f; ctx.fillStyle = COL.reserve; ctx.fillRect(x0, y, x1 - x0, h); ctx.globalAlpha = 1; }
          }
        } else {
          ctx.fillStyle = COL.reserve; ctx.fillRect(x0, y, x1 - x0, h);
          let wk = 1;
          if (v.asleep) wk = 0; else if (v.wake != null) wk = wakeOf(v, 8 + k);
          const breath = S.reduced ? 0 : 0.06 * Math.sin(S.now / 4000 * Math.PI * 2);
          ctx.lineWidth = 1;
          if (wk < 1) { ctx.globalAlpha = (1 - wk) * (1 + breath); ctx.strokeStyle = COL.grid; ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1); }
          if (wk > 0) { ctx.globalAlpha = 0.4 * wk * (1 + breath); ctx.strokeStyle = ink; ctx.strokeRect(x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1); }
          ctx.globalAlpha = s.alpha == null ? 1 : s.alpha;
        }
      }
    }
    ctx.globalAlpha = 1;
    // Strip echo after a fatal crossing: the bet as a hairline, the part that bought crawl hatched
    if (S.E && S.E.echo && S.E.t >= S.E.t0) {
      const e = S.E.echo, x0 = st.tx, x1 = st.tx + e.t1 * st.tw, xw = st.tx + e.tw * st.tw;
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, top + 0.5, Math.max(1, x1 - x0 - 1), h - 1);
      ctx.save(); ctx.beginPath(); ctx.rect(xw, top, Math.max(0, x1 - xw), h); ctx.clip();
      ctx.strokeStyle = COL.graphite; ctx.beginPath();
      for (let s = xw - h; s < x1; s += 4) { ctx.moveTo(s + 0.5, top + h); ctx.lineTo(s + 0.5 + h, top); }
      ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // The nib: a 12 px ink bar the full height of the channel
    if (v.nib != null && S.phase !== 'end') { ctx.fillStyle = ink; ctx.fillRect(Math.round(v.nib - CFG.layout.nibW / 2), st.y, CFG.layout.nibW, st.h); }
  }
  function wakeOf(v, idx) {
    if (v.wake == null) return 1;
    return clamp((v.wake - idx * CFG.ms.wakeStagger) / CFG.ms.wakeEach, 0, 1);
  }

  function render() {
    const L = S.layout, dpr = S.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, L.vw, L.vh);
    if (S.phase === 'feed' && S.feed) {
      const e = easeIO(S.feed.t / CFG.ms.feed);
      if (S.reduced) {
        if (feedSnap) { ctx.globalAlpha = 1 - e; ctx.drawImage(feedSnap, 0, 0, L.vw, L.vh); ctx.globalAlpha = 1; }
        ctx.globalAlpha = e; drawScene(); ctx.globalAlpha = 1;
        sheetEl.style.opacity = String(1 - e);
      } else {
        if (feedSnap) ctx.drawImage(feedSnap, -e * L.vw, 0, L.vw, L.vh);
        ctx.save(); ctx.translate((1 - e) * L.vw, 0); drawScene(); ctx.restore();
        sheetEl.style.transform = 'translate3d(' + (-e * L.vw).toFixed(1) + 'px,0,0)';
      }
    } else drawScene();
    syncDOM();
  }
  function drawScene() {
    drawPaper();
    drawStrip();
    if (S.gptPress && !(S.moment && S.moment.kind === 'gpt3')) drawGptPoint(false);
    if (S.dim > 0) {
      const L = S.layout;
      ctx.globalAlpha = 0.92 * S.dim; ctx.fillStyle = COL.paper; ctx.fillRect(0, 0, L.vw, L.vh); ctx.globalAlpha = 1;
      if (S.moment && S.moment.kind === 'gpt3') drawGptPoint(true);
    }
  }

  // DOM sync, written only when something changed
  const domCache = {};
  function setText(el, key, v) { if (domCache[key] !== v) { domCache[key] = v; el.textContent = v; } }
  function setStyle(el, key, prop, v) { const k = key + prop; if (domCache[k] !== v) { domCache[k] = v; el.style[prop] = v; } }
  function syncDOM() {
    const L = S.layout;
    const live = S.powered && S.phase !== 'feed';
    if (live && S.now - S.powerAt >= CFG.ms.dateAt) { if (dateEl.className !== 'fr-date on') dateEl.className = 'fr-date on'; setText(dayEl, 'day', fmtLong(S.day)); }
    // dimming for moments
    const dimOp = String(1 - 0.92 * S.dim);
    setStyle(dateEl, 'date', 'opacity', S.dim > 0 ? dimOp : '');
    setStyle(bandEl, 'band', 'opacity', S.dim > 0 ? dimOp : '1');
    setStyle(reprintEl, 'rep', 'opacity', S.dim > 0 ? dimOp : '1');
    setStyle(newsEl, 'news', 'opacity', S.dim > 0 && !(S.moment && S.moment.kind === 'gpt3') ? dimOp : '1');
    setStyle(muteEl, 'mute', 'opacity', S.dim > 0 ? dimOp : '');
    // reprinted line on the hatch band
    if (S.reprintText && S.reprintFor && S.phase !== 'feed' && S.now >= S.reprintFor.t0) {
      const P = L.paper, right = P.x + P.w, minW = L.lap ? 260 : 210, maxW = L.lap ? 460 : 320;
      const left = clamp(X(S.reprintFor.lc) + 8, P.x + 8, right - 8 - minW);
      const width = Math.min(maxW, right - 8 - left);
      setStyle(reprintEl, 'rep', 'left', left.toFixed(0) + 'px'); setStyle(reprintEl, 'rep', 'width', width.toFixed(0) + 'px');
      setStyle(reprintEl, 'rep', 'top', (L.newsY + (L.lap ? 26 : 40)).toFixed(0) + 'px');
      setText(reprintEl, 'reptext', S.reprintText);
      if (reprintEl.className !== 'fr-reprint on') reprintEl.className = 'fr-reprint on';
    }
    // readout: the landing date, riding above the thumb
    const showRO = S.phase === 'drag' && S.powered && (S.nib.dragging || (S.nib.keyed && S.nib.t >= 0));
    if (showRO) {
      if (readoutEl.className !== 'fr-readout on') readoutEl.className = 'fr-readout on';
      setText(readoutEl, 'ro', landingDate());
      const st = L.strip, w = readoutEl.offsetWidth || 60;
      let cx, cy;
      if (S.nib.dragging) { cx = S.nib.px; cy = S.nib.py - (S.nib.mouse ? CFG.layout.readoutLaptop : CFG.layout.readoutPhone); }
      else { cx = st.tx + Math.max(0, S.nib.t) * st.tw; cy = st.y - CFG.layout.readoutLaptop; }
      const g = L.lap ? st.x : 16 + L.sa.l;
      const x = clamp(cx - w / 2, g, L.vw - g - w);
      setStyle(readoutEl, 'ro', 'transform', 'translate3d(' + x.toFixed(1) + 'px,' + (cy - 18).toFixed(1) + 'px,0)');
      if (readoutEl.className !== 'fr-readout on') readoutEl.className = 'fr-readout on';
    } else if (readoutEl.className !== 'fr-readout') readoutEl.className = 'fr-readout';
    // mute
    const showMute = CFG.rules.showMuteControl && S.everPowered;
    const mc = 'fr-mute' + (showMute ? ' on' : '');
    if (muteEl.className !== mc) muteEl.className = mc;
    // a11y value
    const vn = String(Math.round(Math.max(0, S.nib.t) * 100));
    if (domCache.aria !== vn) { domCache.aria = vn; stripEl.setAttribute('aria-valuenow', vn); }
  }

  // ===========================================================================
  // Main loop
  // ===========================================================================
  function update(dt) {
    S.now += dt;
    updPan();
    switch (S.phase) {
      case 'drag': updDrag(dt); break;
      case 'pour': updPour(dt); break;
      case 'land': updLand(dt); break;
      case 'end': updEnd(dt); break;
      case 'feed': updFeed(dt); break;
      default: break;
    }
    updNewsTriggers();
    updBand();
    updMoment(dt);
  }
  let lastT = 0;
  function frame(t) {
    const rdt = lastT ? Math.min(100, Math.max(0, t - lastT)) : 16; lastT = t;
    let g = rdt * S.speed;
    try {
      while (g > 0) { const step = Math.min(g, 34); update(step); g -= step; }
      updNews();
      render();
    } catch (e) {
      if (!S.loggedErr) { S.loggedErr = true; try { console.error('frontier frame', e && e.stack ? e.stack : e); } catch (x) { /* ignore */ } }
    }
    requestAnimationFrame(frame);
  }

  // ===========================================================================
  // Input: pointer (touch, mouse, pen) and keys
  // ===========================================================================
  function hitNib(x, y) {
    const st = S.layout.strip;
    const v = stripView(); const nx = v.nib != null ? v.nib : st.tx;
    return Math.abs(x - nx) <= CFG.layout.nibHit / 2 && y >= st.y - 18 && y <= st.y + st.h + 18;
  }
  function hitStrip(x, y) { const st = S.layout.strip; return x >= st.x - 12 && x <= st.x + st.w + 12 && y >= st.y - 24 && y <= st.y + st.h + 24; }
  function nibTFromX(x) { const st = S.layout.strip; return x < st.tx ? -1 : clamp((x - st.tx) / st.tw, 0, 1); }
  function setNibX(x) {
    const st = S.layout.strip;
    S.nib.px = x;
    S.nib.t = nibTFromX(x);
    S.nib.homeX = x < st.tx ? clamp(x, st.tx - CFG.layout.nibW / 2, st.tx) : null;
  }
  function restX(upT) {
    const buf = S.nib.buf;
    if (!buf.length) return S.nib.px;
    if (upT - S.nib.downT < CFG.ms.liftRead) return buf[0].x;
    let x = buf[0].x;
    for (const s of buf) { if (s.t <= upT - CFG.ms.liftRead) x = s.x; else break; }
    return x;
  }
  function onDown(e) {
    if (e.target === muteEl) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const x = e.clientX, y = e.clientY;
    if (S.phase === 'asleep') { e.preventDefault(); S.everPowered = true; power(); return; }
    if (S.phase === 'drag' && S.powered && !S.nib.dragging && hitNib(x, y)) {
      e.preventDefault();
      try { stage.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      const rt = performance.now();
      S.nib.dragging = true; S.nib.pid = e.pointerId; S.nib.downT = rt; S.nib.buf = [{ t: rt, x }];
      S.nib.mouse = e.pointerType === 'mouse'; S.nib.py = y; S.nib.everDragged = true; S.nib.keyed = false;
      setNibX(x); scratchPulse();
      return;
    }
    if (S.phase === 'pour' && hitStrip(x, y)) { e.preventDefault(); sampleTap(); }
  }
  function onMove(e) {
    if (S.nib.dragging && e.pointerId === S.nib.pid) {
      e.preventDefault();
      const rt = performance.now();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (evs && evs.length) for (const ce of evs) S.nib.buf.push({ t: rt, x: ce.clientX }); else S.nib.buf.push({ t: rt, x: e.clientX });
      while (S.nib.buf.length > 2 && S.nib.buf[1].t < rt - 600) S.nib.buf.shift();
      S.nib.py = e.clientY; setNibX(e.clientX);
      return;
    }
    if (e.pointerType === 'mouse') {
      let cur = '';
      if (S.phase === 'asleep') cur = 'pointer';
      else if (S.phase === 'drag' && hitNib(e.clientX, e.clientY)) cur = 'grab';
      else if (S.phase === 'pour' && hitStrip(e.clientX, e.clientY)) cur = 'pointer';
      if (stage.style.cursor !== cur) stage.style.cursor = cur;
    }
  }
  function onUp(e) {
    if (!(S.nib.dragging && e.pointerId === S.nib.pid)) return;
    e.preventDefault();
    const rx = restX(performance.now());
    setNibX(rx);
    S.nib.dragging = false; S.nib.pid = null; S.nib.homeX = null;
    try { stage.releasePointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    launch(nibTFromX(rx) < 0 ? null : nibTFromX(rx));
    stage.style.cursor = '';
  }
  stage.addEventListener('pointerdown', onDown, { passive: false });
  stage.addEventListener('pointermove', onMove, { passive: false });
  stage.addEventListener('pointerup', onUp, { passive: false });
  stage.addEventListener('pointercancel', onUp, { passive: false });
  stage.addEventListener('lostpointercapture', e => { if (S.nib.dragging && e.pointerId === S.nib.pid) onUp(e); });
  stage.addEventListener('touchstart', e => { if (e.target !== muteEl) e.preventDefault(); }, { passive: false });
  stage.addEventListener('touchmove', e => { e.preventDefault(); }, { passive: false });
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  muteEl.addEventListener('click', e => { e.stopPropagation(); toggleMute(); });

  function onKey(e) {
    const k = e.key;
    if (e.target === muteEl && (k === 'Enter' || k === ' ')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'm' || k === 'M') { if (S.everPowered) toggleMute(); return; }
    if (S.phase === 'asleep') {
      if (k === 'Enter' || k === ' ' || k === 'ArrowRight' || k === 'ArrowLeft' || k === 's' || k === 'S') { e.preventDefault(); S.everPowered = true; power(); }
      return;
    }
    if (S.phase === 'drag' && S.powered && !S.nib.dragging) {
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 0.10 : 0.02; let t = S.nib.t;
        if (k === 'ArrowRight') t = t < 0 ? step : Math.min(1, t + step);
        else t = t < 0 ? -1 : (t <= 1e-9 ? -1 : Math.max(0, t - step));
        S.nib.t = t; S.nib.keyed = true; S.nib.everDragged = true; S.nib.homeX = null;
        if (t >= 0) scratchPulse();
      } else if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); launch(S.nib.t < 0 ? null : S.nib.t); }
      return;
    }
    if (S.phase === 'pour' && (k === 's' || k === 'S')) { e.preventDefault(); sampleTap(); return; }
    if (k === ' ') e.preventDefault();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  // ===========================================================================
  // Sound: Web Audio only, after the first touch. Everything is readable on mute.
  // ===========================================================================
  const A = { ctx: null };
  const dB = x => Math.pow(10, x / 20);
  function audioInit() {
    if (A.ctx) { try { if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {}); } catch (e) { /* ignore */ } return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const c = new AC(); A.ctx = c;
      A.out = c.createGain(); A.out.gain.value = S.muted ? 0 : 1; A.out.connect(c.destination);
      A.duck = c.createGain(); A.duck.connect(A.out);
      const len = Math.floor(c.sampleRate * 2);
      const wb = c.createBuffer(1, len, c.sampleRate), wd = wb.getChannelData(0);
      for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
      const bb = c.createBuffer(1, len, c.sampleRate), bd = bb.getChannelData(0);
      let lv = 0; for (let i = 0; i < len; i++) { lv = (lv + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = lv * 3.5; }
      A.white = wb;
      A.motor = c.createGain(); A.motor.gain.value = 0; A.motor.connect(A.duck);
      A.o1 = c.createOscillator(); A.o1.type = 'sine'; A.o1.frequency.value = 55;
      A.o2 = c.createOscillator(); A.o2.type = 'sine'; A.o2.frequency.value = 110.6;
      const g1 = c.createGain(); g1.gain.value = dB(-30); const g2 = c.createGain(); g2.gain.value = dB(-30);
      A.o1.connect(g1); g1.connect(A.motor); A.o2.connect(g2); g2.connect(A.motor);
      const bn = c.createBufferSource(); bn.buffer = bb; bn.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const gn = c.createGain(); gn.gain.value = dB(-36);
      bn.connect(lp); lp.connect(gn); gn.connect(A.motor);
      A.o1.start(); A.o2.start(); bn.start();
      const sn = c.createBufferSource(); sn.buffer = wb; sn.loop = true;
      A.sbp = c.createBiquadFilter(); A.sbp.type = 'bandpass'; A.sbp.frequency.value = 3200; A.sbp.Q.value = 0.8;
      A.scr = c.createGain(); A.scr.gain.value = 0;
      sn.connect(A.sbp); A.sbp.connect(A.scr); A.scr.connect(A.duck); sn.start();
      if (c.resume) c.resume().catch(() => {});
    } catch (e) { A.ctx = null; }
  }
  function aOK() { return A.ctx && A.ctx.state !== 'closed'; }
  function ramp(param, v, ms) {
    try { const t = A.ctx.currentTime; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + Math.max(0.005, ms / 1000)); } catch (e) { /* ignore */ }
  }
  function motorTo(level, ms) { if (!aOK()) return; ramp(A.motor.gain, level, ms); try { A.o1.frequency.setValueAtTime(55, A.ctx.currentTime); } catch (e) { /* ignore */ } }
  function blip(f, ms, db, type) {
    if (!aOK()) return;
    try {
      const c = A.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(db), t + 0.001); g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
      o.connect(g); g.connect(A.duck); o.start(t); o.stop(t + ms / 1000 + 0.03);
    } catch (e) { /* ignore */ }
  }
  function noiseHit(ms, f, q, db) {
    if (!aOK()) return;
    try {
      const c = A.ctx, t = c.currentTime, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      s.buffer = A.white; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      g.gain.setValueAtTime(dB(db), t); g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
      s.connect(bp); bp.connect(g); g.connect(A.duck); s.start(t, Math.random() * 1.5, ms / 1000 + 0.02);
    } catch (e) { /* ignore */ }
  }
  const tokenTick = () => blip(2400, 6, -34);
  const printTick = () => blip(1800, 5, -38);
  const payClick = () => noiseHit(4, 1200, 1.2, -32);
  function liftNote() {
    if (!aOK()) return;
    try {
      const c = A.ctx, t = c.currentTime;
      for (const f of [55, 110]) {
        const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f;
        g.gain.setValueAtTime(dB(-18), t); g.gain.exponentialRampToValueAtTime(0.00001, t + 1.4);
        o.connect(g); g.connect(A.duck); o.start(t); o.stop(t + 1.45);
      }
    } catch (e) { /* ignore */ }
  }
  function whirr(ms) {
    if (!aOK()) return;
    try {
      const c = A.ctx, t = c.currentTime, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 90; lp.type = 'lowpass'; lp.frequency.value = 600;
      const d = clamp(ms, 300, 900) / 1000;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(-34), t + 0.08); g.gain.linearRampToValueAtTime(0, t + d);
      o.connect(lp); lp.connect(g); g.connect(A.duck); o.start(t); o.stop(t + d + 0.05);
    } catch (e) { /* ignore */ }
  }
  function nibScratch(ms) {
    if (!aOK()) return;
    try { const t = A.ctx.currentTime, g = A.scr.gain; g.cancelScheduledValues(t); g.setValueAtTime(dB(-30), t); g.linearRampToValueAtTime(dB(-34), t + ms / 1000 * 0.8); g.linearRampToValueAtTime(0, t + ms / 1000); A.scrHoldUntil = performance.now() + ms; } catch (e) { /* ignore */ }
  }
  function scratchPulse() { if (!aOK()) return; noiseHit(30, 3200, 0.8, -32); }
  let lastPen = null, lastPenT = 0;
  function penSpeed(x) {
    if (!aOK() || (A.scrHoldUntil && performance.now() < A.scrHoldUntil)) { lastPen = x; return; }
    const rt = performance.now();
    let target = 0;
    if (x != null && lastPen != null && rt > lastPenT) { const v = Math.abs(x - lastPen) / ((rt - lastPenT) / 1000); target = dB(-28) * clamp(v / 260, 0, 1); }
    lastPen = x; lastPenT = rt;
    try { A.scr.gain.setTargetAtTime(target, A.ctx.currentTime, 0.05); } catch (e) { /* ignore */ }
  }
  function duck(on) { if (!aOK()) return; ramp(A.duck.gain, on ? 0 : 1, on ? CFG.ms.capDuck : CFG.ms.capRestore); }
  function dryAudio() {
    if (!aOK()) return;
    try {
      const t = A.ctx.currentTime;
      A.sbp.frequency.cancelScheduledValues(t); A.sbp.frequency.setValueAtTime(3200, t); A.sbp.frequency.linearRampToValueAtTime(6000, t + 0.9);
      ramp(A.scr.gain, 0, CFG.ms.dryFade);
      A.o1.frequency.cancelScheduledValues(t); A.o1.frequency.setValueAtTime(55, t); A.o1.frequency.linearRampToValueAtTime(30, t + 1.2);
      ramp(A.motor.gain, 0, 1200);
      A.scrHoldUntil = performance.now() + 1700;
      setTimeout(() => { try { A.sbp.frequency.setValueAtTime(3200, A.ctx.currentTime); } catch (e) { /* ignore */ } }, 2000);
    } catch (e) { /* ignore */ }
  }
  function toggleMute(force) {
    S.muted = typeof force === 'boolean' ? force : !S.muted;
    if (aOK()) ramp(A.out.gain, S.muted ? 0 : 1, 60);
    muteEl.textContent = S.muted ? 'SOUND OFF' : 'SOUND ON';
    muteEl.setAttribute('aria-pressed', S.muted ? 'true' : 'false');
    return S.muted;
  }

  // ===========================================================================
  // Test hook for playtesters and bots (normal players never see it)
  // ===========================================================================
  function runSummary(r) {
    return { log10C: +r.lc.toFixed(3), ink: +r.ink.toFixed(3), share: +r.tLift.toFixed(3), home: r.home, days: +r.T.toFixed(2), pourSec: +(r.P / 1000).toFixed(2),
      launch: fmtLong(r.launchDay), r: +r.r.toFixed(3), grade: r.grade, result: r.result, p: +r.p.toFixed(3), loss: +r.Lstar.toFixed(3) };
  }
  function sampleSummary(s) { return s ? { text: s.band, frays: s.frays, crawl: s.crawl, tier: s.tier, cap: s.capId, kind: s.kind } : null; }
  window.__frontier = {
    state() {
      const best = bestClean();
      const phase = S.phase;
      return {
        phase, powered: !!S.powered, sheet: S.sheetNo, seed: S.seed,
        date: fmtLong(S.day), day: +S.day.toFixed(3), clockRunning: S.clockStarted && (phase === 'drag' || phase === 'pour'),
        bank: +S.bank.toFixed(3), payrollMode: CFG.rules.payrollMode, payrollPerDay: +payrollRate().toFixed(4),
        nib: { t: S.nib.t < 0 ? null : +S.nib.t.toFixed(4), home: S.nib.t < 0, dragging: S.nib.dragging },
        landingDate: phase === 'drag' && S.powered ? landingDate() : null,
        dragLog10C: phase === 'drag' && S.powered ? +Math.log10(dragCompute()).toFixed(3) : null,
        run: S.run ? runSummary(S.run) : null, runs: S.runs.map(runSummary),
        lastSample: sampleSummary(S.lastSample), bandSample: sampleSummary(S.bandSample),
        wall: { W: S.W, Dwall: S.Dwall, log10Cwall: +Math.log10(S.Cwall).toFixed(3), log10CwallStart: +Math.log10(S.Cwall0).toFixed(3), crossings: S.crossings, hatches: S.hatches.map(h => +h.lc.toFixed(3)), reprint: S.reprintText },
        caps: S.caps.map(c => ({ id: c.id, log10C: +c.lc.toFixed(3), fired: c.fired })),
        bestLog10C: best ? +best.lc.toFixed(3) : null, gpt3Log10C: +Math.log10(CFG.paper.gpt3C).toFixed(3),
        moment: S.moment ? S.moment.kind : null, landStep: S.L ? S.L.step : null,
        end: S.E ? { reason: S.E.reason, dark: S.E.dry, t: Math.round(S.E.t) } : null,
        sheetsEnded: S.sheetsEnded, history: S.history.slice(-200), speed: S.speed, muted: S.muted,
      };
    },
    act(name, payload) {
      payload = payload || {};
      switch (name) {
        case 'power': if (S.phase === 'asleep') { S.everPowered = true; power(); return true; } return false;
        case 'tap':
          if (S.phase === 'asleep') { S.everPowered = true; power(); return true; }
          if (S.phase === 'pour') return sampleTap();
          return false;
        case 'sample': return sampleTap();
        case 'drag': {
          if (S.phase !== 'drag' || !S.powered) return false;
          const f = payload.fraction;
          S.nib.t = (f == null || f < 0 || payload.home) ? -1 : clamp(+f, 0, 1);
          S.nib.keyed = true; S.nib.everDragged = true; S.nib.homeX = null;
          return true;
        }
        case 'lift': if (S.phase !== 'drag' || !S.powered) return false; return launch(S.nib.t < 0 ? null : S.nib.t);
        case 'dragLift': {
          if (S.phase !== 'drag' || !S.powered) return false;
          const f = payload.fraction; return launch(f == null || f < 0 ? null : clamp(+f, 0, 1));
        }
        case 'mute': return toggleMute(payload.on);
        default: return false;
      }
    },
    speed(n) { if (typeof n === 'number' && n > 0 && n <= 200) S.speed = n; return S.speed; },
    config: CFG,
  };

  // ===========================================================================
  // Boot
  // ===========================================================================
  newSheet();
  resize();
  requestAnimationFrame(frame);
})();
