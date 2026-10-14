/* FRONTIER, the lab sim (spec/sim1.json). Build B: "the feel".
   One sheet: the months figure in the corner, the log-log paper with your people in its margin, the model's words,
   the cluster humming in its band, the bet strip, and letters sliding under the door. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG, CORPUS = window.FRONTIER_CORPUS, WORLD = window.FRONTIER_WORLD, AU = window.FrontierAudio;
  var $ = function (id) { return document.getElementById(id); };
  var root = $('fr');
  if (!root) return;
  var el = {
    head: $('fr-head'), lab: $('fr-lab'), bought: $('fr-bought'), today: $('fr-today'), hour: $('fr-hour'), dateline: $('fr-dateline'), mute: $('fr-mute'), end: $('fr-end'),
    months: $('fr-months'), monthsN: $('fr-months-n'), proj: $('fr-proj'), monthsL: $('fr-months-l'),
    paperwrap: $('fr-paperwrap'), paper: $('fr-paper'), pen: $('fr-pen'), heads: $('fr-heads'), team: $('fr-team'),
    band: $('fr-band'), sample: $('fr-sample'), box: $('fr-box'),
    cluster: $('fr-cluster'), cards: $('fr-cards'), strip: $('fr-strip'), readout: $('fr-readout'),
    letterzone: $('fr-letterzone'), notes: $('fr-notes'), moment: $('fr-moment'), momentText: $('fr-moment-text')
  };

  /* ================= utilities ================= */
  var cs = getComputedStyle(document.documentElement);
  function tok(n, d) { var v = (cs.getPropertyValue(n) || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : d; }
  var COL = { paper: tok('--paper', '#E4E5E1'), ink: tok('--ink', '#15171A'), grid: tok('--grid', '#CCCFCA'), graphite: tok('--graphite', '#6E7378'),
    reserve: tok('--reserve', '#F8F8F5'), filament: tok('--filament', '#FF7A21'), vermilion: tok('--vermilion', '#E5482E'), dry: tok('--dry', '#A9ACAA') };
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  var RGB = {}; Object.keys(COL).forEach(function (k) { RGB[k] = hex(COL[k]); });
  function rgba(k, a) { var c = RGB[k]; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(a, b, u, al) { var A = RGB[a], B = RGB[b]; u = clamp(u, 0, 1); return 'rgba(' + Math.round(A[0] + (B[0] - A[0]) * u) + ',' + Math.round(A[1] + (B[1] - A[1]) * u) + ',' + Math.round(A[2] + (B[2] - A[2]) * u) + ',' + (al == null ? 1 : al) + ')'; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { u = clamp(u, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function easeOut(u) { u = clamp(u, 0, 1); return 1 - Math.pow(1 - u, 3); }
  function easeIn(u) { u = clamp(u, 0, 1); return u * u * u; }
  function log10(x) { return Math.log(x) / Math.LN10; }
  function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var rng = Math.random, wrng = Math.random, vis = mulberry(7);
  function U(a, b) { return a + (b - a) * rng(); }
  function gauss(r) { r = r || vis; return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(rng() * a.length)]; }
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function store(k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; }
  var now = 0, nowOffset = 0, GEN = 0, timers = [];
  function after(sec, fn) { timers.push({ at: now + sec, fn: fn, gen: GEN }); }
  function runTimers() {
    if (!timers.length) return;
    var due = [], keep = [];
    for (var i = 0; i < timers.length; i++) (timers[i].at <= now ? due : keep).push(timers[i]);
    if (!due.length) return;
    timers = keep;
    due.sort(function (a, b) { return a.at - b.at; }).forEach(function (t) { if (t.gen === GEN) { try { t.fn(); } catch (e) { console.error(e); } } });
  }
  function money(x) {
    var a = Math.abs(x), s = x < 0 ? '−$' : '$';
    var trim = function (t) { return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t; };
    if (a >= 1e9) return s + trim((a / 1e9).toFixed(a >= 1e10 ? 0 : 1)) + 'B';
    if (a >= 1e6) return s + trim((a / 1e6).toFixed(a >= 1e7 ? 0 : 2)) + 'M';
    if (a >= 1e3) return s + Math.round(a).toLocaleString('en-US');
    return s + Math.round(a);
  }
  function pct(x) { var v = x * 100; return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1)) + '%'; }
  function sci(C) { var e = Math.floor(log10(C)), m = C / Math.pow(10, e); return m.toFixed(1) + 'e' + e; }
  // pencil compute: '3e21', '1.5e22'
  function sciP(C) { if (!(C > 0)) return '0'; var e = Math.floor(log10(C) + 1e-9), m = C / Math.pow(10, e); var r = Math.round(m); if (Math.abs(m - r) / m < 0.06) { if (r === 10) { r = 1; e++; } return r + 'e' + e; } return m.toFixed(1) + 'e' + e; }
  function ratioWord(x) { return x >= 100 ? String(Math.round(x / 10) * 10) : x >= 10 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ''); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function sizeWord(N) { return N >= 1e9 ? (N >= 1e10 ? Math.round(N / 1e9) : (N / 1e9).toFixed(1).replace(/\.0$/, '')) + 'B' : Math.round(N / 1e6) + 'M'; }
  function pronoun(first) { return /^(Priya|Lena|Sun-hee|Ines)$/.test(first) ? 'she' : 'he'; }

  /* ================= calendar ================= */
  var BASE = Date.UTC(CFG.year, 0, 1), MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function dateOf(day) { return new Date(BASE + Math.floor(day + 1e-9) * 864e5); }
  function dom(day) { return dateOf(day).getUTCDate(); }
  function fmtDay(day, yr) { var d = dateOf(day), dd = String(d.getUTCDate()); if (dd.length < 2) dd = '0' + dd; return dd + ' ' + MON[d.getUTCMonth()] + (yr ? ' ' + d.getUTCFullYear() : ''); }
  function fmtShort(day) { var d = dateOf(day); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; } // letters: '2 APR'
  function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'); }
  function monthOf(day) { var d = dateOf(day); return (d.getUTCFullYear() - CFG.year) * 12 + d.getUTCMonth(); }
  function monthStart(m) { return (Date.UTC(CFG.year, m, 1) - BASE) / 864e5; }
  function iso(s) { return Math.round((Date.parse(s + 'T00:00:00Z') - BASE) / 864e5); }
  var D_GPT3 = iso('2020-05-28');

  /* ================= physics: the approved run component ================= */
  var P0 = Math.pow(10, -3.5), CRAWL = CFG.frayAmounts + 1;
  function Lline(C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); }
  // the fixed 2020 recipe, anchored on GPT-3 (175B parameters on 300B tokens at 3.14e23)
  function tokens(C) { return CFG.tokGPT3 * Math.pow(C / CFG.gpt3C, CFG.tokExp); }
  function C_of_tokens(D) { return CFG.gpt3C * Math.pow(D / CFG.tokGPT3, 1 / CFG.tokExp); }
  function params(C) { return C / (6 * tokens(C)); }
  // the run's target: its line, Sun-hee's bend, the blind penalty and its own seed noise (eps, in ln-loss)
  function Lstar(run, x) { return Lline(x) * run.m * (1 + run.b) * Math.exp(run.eps || 0); }
  // past the wall the model memorises boilerplate and the curve dips under the line: suspiciously good (Karpathy)
  function wallDip(rq) { if (!(rq > 1)) return 1; return 1 - clamp(CFG.pastWallDip[0] + (rq - 1) * 0.04, CFG.pastWallDip[0], CFG.pastWallDip[1]); }
  function lossAt(run, q) {
    q = clamp(q, P0, 1);
    var z = (log10(q) + 3.5) / 3.5, yl = Math.log(Lstar(run, q * run.C)), H0 = Math.log(CFG.startLoss) - Math.log(Lstar(run, P0 * run.C));
    var s = Math.pow(q, 1 / 1.5);   // the display warp is only for the pen; the data the run has eaten follows s
    return Math.exp(yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z))) * wallDip(s * run.r);
  }
  function noiseSigma(C) { var u = clamp((log10(C) - 18) / (log10(CFG.gpt3C) - 18), 0, 1); return lerp(CFG.landNoise[0], CFG.landNoise[1], u); }
  function amount(rq) { if (rq < CFG.cleanR) return 0; if (rq <= 1) return Math.min(CFG.frayAmounts, 1 + Math.floor((rq - CFG.cleanR) / CFG.frayStep + 1e-9)); return CRAWL; }

  /* ================= the year ================= */
  var S = null, speedMult = 1, paused = false;
  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }
  var slipSeq = 0;
  // first-time lessons are taught once per sitting (not per year); the last year's farthest dot carries over as a ghost
  var TAUGHT = {}, GHOST = null;
  if (/[#&]teach=0/.test(location.hash || '')) TAUGHT = { all: true };

  function newYear(seed) {
    GEN++; timers = [];
    if (seed == null) seed = seedFromHash();
    if (seed == null) seed = Math.floor(Math.random() * 1e9);
    rng = mulberry(seed >>> 0); wrng = mulberry((seed ^ 0x5bd1e995) >>> 0);   // the model's words draw from their own stream
    var W = Math.exp(Math.log(CFG.W_lo) + rng() * (Math.log(CFG.W_hi) - Math.log(CFG.W_lo)));
    var capC = CFG.caps.map(function (c) { return c[1] * Math.pow(10, (rng() * 2 - 1) * c[2]); }).sort(function (a, b) { return a - b; });
    S = {
      seed: seed, phase: 'asleep', powered: false, poweredAt: -99, started: false, day: 0, month: -1, newsIdx: 0, rulerPhrases: [],
      bank: CFG.seedCash - CFG.dgx1, stake: CFG.stakeStart, post: CFG.seedPost, credits: 0, figureOn: false,
      team: [],
      owned: { v: CFG.startOwned, a: 0 }, rentals: [], orders: [], mer: null, lent: null, serving: 0,
      run: null, hang: null, runs: [], scars: [], hangMarks: [], landUntil: 0,
      caps: CFG.caps.map(function (c, i) { return { id: c[0], C: capC[i], L: Lline(capC[i]), fired: false, contaminated: false }; }),
      W: W, filter: null, filtersDone: 0, offer: null, redteam: null, checkpoint: null, bandSample: null,
      firstAuthor: false, snapNext: false, tomOffUntil: -1,
      queue: [], letter: null, letterGapUntil: 0, offered: {}, lastBroker: -99, brokerNext: 'rent', buyNextA: false, poachMonth: -1,
      silent: false, silentPrev: false, scandalSilentMonth: -1, termBlockUntil: -1, termLetterOut: false, events: [],
      raise: { aTaken: false, aNeed: CFG.seriesA.needC, bTaken: false },
      shipped: null, opened: false, openedC: 0, lastPublishDay: -999, sunheeTrick: false,
      rivals: CFG.rivals.map(function (r) { var j = U(-CFG.rivalJitter, CFG.rivalJitter); return { key: r.key, name: r.name, c0: r.c0, cap: Math.min(r.cap || CFG.rivalCapC, CFG.rivalCapC), tau: r.tau, period: r.period, offset: r.offset, jit: j, extra: 0, pubs: [{ C: r.c0 * Math.pow(10, j) / 2, day: -1, t: -99 }], nextPub: r.period * U(0.2, 1.0), passed: false, passedAt: -99 }; }),
      hangsThisMonth: 0, tomDemandDue: false, hints: {}, notes: [], heads: [], gpt3: false, gpt3At: 0, lineAt: 0, lineShown: false,
      ended: null, endFx: null, bags: {}, t3used: {}, t4used: {}, miracle: false, choice: null, landFx: null, pendingTap: null,
      capQueue: [], beatUntil: 0, silentLog: [], lastScandal: null, lastFilterDoneDay: -1, memStops: 0, priority: false, lastSpot: -99,
      endInfo: null, queueWarned: -1, ghost: GHOST,
      stats: { hangs: 0, crossings: 0, published: 0, shipped: 0, hires: 0, walked: 0, launches: 0, filters: 0, aborted: 0 }, log: []
    };
    addPerson('priya', true);
    view.l = CFG.plotLeftMinLog; view.r = CFG.plotRightMinLog; view.anim = null;
    nib.t = 0; nib.drag = false; nib.kbd = false; nib.abort = false; stopDisp = null; nibTouched = false;
    el.end.classList.remove('on'); el.end.textContent = ''; el.heads.textContent = ''; headNow = null;
    cells.born = []; cells.kinds = []; cells.printed = []; cells.prevUnits = 0; cells.unit = 1; cells.regroup = null; cells.sweep = -99; cells.wake = -99; cells.wakeTicked = {}; cells.lastBornAt = 0;
    fig.shown = null; fig.roll = null;
    staticDirty = true;
    root.classList.add('asleep'); root.classList.remove('dim28', 'undim', 'dry', 'sold');
    el.sample.textContent = ''; el.sample.className = ''; el.sample.style.cssText = ''; el.notes.textContent = ''; el.box.classList.remove('on');
    el.lab.classList.remove('struck'); el.bought.textContent = ''; el.bought.classList.remove('on'); el.hour.textContent = ''; el.today.textContent = '';
    Array.prototype.forEach.call(el.letterzone.querySelectorAll('.fr-letter'), function (x) { x.parentNode.removeChild(x); }); el.moment.classList.remove('on', 'out'); el.team.textContent = ''; el.readout.classList.remove('on'); el.monthsL.textContent = 'MONTHS';
    el.monthsN.textContent = ''; el.cards.textContent = '';
    moment = { on: false }; band = null;
    lastDate = lastMonths = lastCards = lastProj = '';
    root.setAttribute('aria-label', 'Frontier. A lab sim on one sheet of paper. Touch anywhere to begin.');
    renderTeam();
    S.log.push('year seed ' + seed);
    // the very first sheet of a sitting says, after a breath, that it is waiting for a touch
    if (!TAUGHT.all && !TAUGHT.asleep) after(2.4, function () { if (S && !S.powered) { TAUGHT.asleep = true; writeNote(WORLD.teach.asleep, null, { type: 'goal', key: 'teach-asleep', dy: 110 }, { teach: true }); } });
    return S;
  }
  function addPerson(key, founding) {
    var d = WORLD.people[key];
    var p = { key: key, name: d.name, first: d.first, short: d.short, role: d.role, salary: d.salary, ego: d.ego, mood: CFG.moodStart,
      joined: S.day, payFrom: founding ? 0 : monthStart(monthOf(S.day) + 1), gone: false, goneDay: null, inkAt: founding ? Infinity : now, demandDone: false };
    if (key === 'ayaan' && S.day >= CFG.apiDay) p.salary = d.salaryLate;
    if (S.cheapUntil && S.day <= S.cheapUntil && (key === 'ines' || key === 'kofi')) p.salary = Math.round(p.salary * 0.7);
    S.team.push(p);
    return p;
  }

  /* ================= derived ================= */
  function staff() { return S.team.filter(function (p) { return !p.gone; }); }
  function person(key) { for (var i = 0; i < S.team.length; i++) if (S.team[i].key === key && !S.team[i].gone) return S.team[i]; return null; }
  function has(key) { return !!person(key); }
  function hasSystems() { return has('dev') || has('rafael'); }
  function infraMult() {
    var tom = has('tom') && S.day >= S.tomOffUntil, kofi = has('kofi');
    return tom && kofi ? CFG.hangBothMult : (tom || kofi) ? CFG.hangInfraMult : 1;
  }
  function hasInfra() { return (has('tom') && S.day >= S.tomOffUntil) || has('kofi'); }
  function sunheeM() { var p = person('sunhee'); return p && S.day - p.joined >= CFG.sunheeDelay ? CFG.sunheeBend : 1; }
  function rentalLive(r) { return S.day >= r.start && S.day < r.end; }
  function merAlloc() { if (!S.mer || S.day < S.mer.live) return 0; return S.mer.alloc; }
  function physicalCards() {
    var n = S.owned.v + S.owned.a;
    S.rentals.forEach(function (r) { if (S.day < r.end) n += r.n; });
    if (S.mer) n += S.mer.cards;
    return n;
  }
  /* ---- pools: one synchronous run trains on one fabric (Karpathy). Your office racks, your A100 racks, the broker's
     cloud, Meridian's cloud. Cards in other pools idle (or serve). day may be in the future: the schedule is known. ---- */
  function poolRaw(key, day) {
    var v = 0, a = 0;
    if (key === 'office') {
      v = S.owned.v; S.orders.forEach(function (o) { if (o.type === 'v100' && o.arrive > S.day && day >= o.arrive) v += o.n; });
      if (S.lent && day < S.lent.until) v -= Math.min(v, S.lent.n);
    } else if (key === 'a100') {
      a = S.owned.a; S.orders.forEach(function (o) { if (o.type === 'a100' && o.arrive > S.day && day >= o.arrive) a += o.n; });
    } else if (key === 'broker') {
      S.rentals.forEach(function (r) { if (day >= r.start && day < r.end) v += r.n; });
    } else if (key === 'meridian') {
      if (S.mer && day >= S.mer.live) v = S.mer.alloc;
    }
    return { v: v, a: a };
  }
  function poolFlopsRaw(key, day) { var p = poolRaw(key, day); return p.v * CFG.flops.v100 + p.a * CFG.flops.a100; }
  function biggestPoolKey(day) {
    var best = null, bf = 0;
    CFG.pools.forEach(function (k) { var f = poolFlopsRaw(k, day); if (f > bf * 1.0001) { bf = f; best = k; } });
    return best || 'office';
  }
  // serving answers developers from the biggest pool: an eighth of it, at least 8 and at most 64 cards
  function servingCards(day) {
    if (!S.shipped) return 0;
    var k = biggestPoolKey(day), p = poolRaw(k, day), phys = p.v + p.a;
    return { key: k, n: Math.min(Math.max(0, phys - 1), clamp(Math.round(phys * CFG.servingShare), CFG.servingMin, CFG.servingMax)) };
  }
  function poolAt(key, day) {
    var p = poolRaw(key, day), v = p.v, a = p.a;
    var sv = servingCards(day);
    if (sv && sv.key === key && sv.n > 0) { var x = Math.min(v, sv.n); v -= x; a -= Math.min(a, sv.n - x); }
    return { key: key, v: v, a: a, phys: v + a, eq: v * CFG.v100eq.v100 + a * CFG.v100eq.a100, flops: v * CFG.flops.v100 + a * CFG.flops.a100 };
  }
  // the cards training right now (the run's pool, or the pool the next run would take), in V100-equivalents and in cards
  function training(key) {
    var sv = servingCards(S.day); S.serving = sv ? sv.n : 0;
    var k = key || (S.run ? S.run.pool : biggestPoolKey(S.day));
    return poolAt(k, S.day);
  }
  // a run moves its checkpoint to another pool when that pool is at least twice as fast (or its own goes dark)
  function poolFor(cur, day) {
    var f = poolAt(cur, day).flops, best = cur, bf = f;
    CFG.pools.forEach(function (k) { if (k === cur) return; var g = poolAt(k, day).flops; if (g >= Math.max(2 * f, 1) && g > bf) { best = k; bf = g; } });
    return best;
  }
  function hangLam(eq) { return CFG.hangPerCardDay * Math.max(1, eq) * infraMult(); }
  // expected share of a run-day lost to hangs on this pool: λ × (time dark + rewind)
  function hangDrag(eq) {
    var infra = hasInfra(), per = infra ? CFG.infraRestartDays + CFG.infraRewindDays / 2 : 0.55 + 0.5;
    return clamp(hangLam(eq) * per, 0, 0.6);
  }
  // compute a pool delivers from day d0 to day d1 (fractional), stepping its card schedule, with a hang allowance
  function poolCompute(key, d0, d1) {
    var acc = 0, d = d0, guard = 0;
    while (d < d1 - 1e-9 && guard++ < 800) {
      key = poolFor(key, Math.floor(d + 1e-9));
      var nd = Math.min(d1, Math.floor(d + 1e-9) + 1), p = poolAt(key, Math.floor(d + 1e-9));
      acc += p.flops * (1 - hangDrag(p.eq)) * (nd - d); d = nd;
    }
    return acc;
  }
  // the day a run of compute C (already done: done) would land on a pool, starting now; Infinity if not this year
  function projectLand(key, Cleft, from) {
    var d = from == null ? S.day : from, acc = 0, guard = 0;
    if (Cleft <= 0) return d;
    while (guard++ < 800) {
      key = poolFor(key, Math.floor(d + 1e-9));
      var nd = Math.floor(d + 1e-9) + 1, p = poolAt(key, Math.floor(d + 1e-9)), f = p.flops * (1 - hangDrag(p.eq));
      if (f > 0 && acc + f * (nd - d) >= Cleft) return d + (Cleft - acc) / f;
      acc += f * (nd - d); d = nd;
      if (d > CFG.endDay + 1 + 60) return Infinity;
    }
    return Infinity;
  }
  function yearEndDay() { return CFG.endDay + 1 - 1e-3; }
  function rentPrice(day) { var p = CFG.rentPrice[0][1]; CFG.rentPrice.forEach(function (x) { if (day >= x[0]) p = x[1]; }); return p; }
  function rentPerDay() { var t = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) t += r.n * r.price * 24; }); return t; }
  function apiRevenue() { return S.shipped ? S.shipped.rev : 0; }
  function payroll() { var t = CFG.base + CFG.upkeepPerOwned * (S.owned.v + S.owned.a) + (S.priority ? S.priorityCost : 0); staff().forEach(function (p) { if (p.payFrom <= S.day + 0.5) t += p.salary; }); return t; }
  function burn(mod) {
    mod = mod || {};
    var sal = 0; staff().forEach(function (p) { sal += p.salary; });
    var rent = 0; S.rentals.forEach(function (r) { if (S.day < r.end) rent += r.n * r.price * 24 * 30.4; });
    return CFG.base + sal + (S.priority ? S.priorityCost : 0) + CFG.upkeepPerOwned * (S.owned.v + S.owned.a + (mod.owned || 0)) + rent + (mod.rent || 0) + (mod.salary || 0) - apiRevenue();
  }
  function monthsVal(mod) { mod = mod || {}; var b = burn(mod); if (b <= 0) return CFG.monthsCap; return Math.max(0, (S.bank + (mod.bank || 0)) / b); }
  function fmtMonths(m) { m = Math.min(CFG.monthsCap, Math.max(0, m)); return m >= 3 ? String(Math.floor(m)) : (Math.floor(m * 10) / 10).toFixed(1); }
  // an effect line never rounds a real cost away: '11 → 10.6' when the whole numbers would read the same
  function monthsPair(a, b) {
    var A = fmtMonths(a), B = fmtMonths(b);
    if (A === B && Math.abs(a - b) > 0.04 && a < CFG.monthsCap) { A = (Math.floor(a * 10) / 10).toFixed(1); B = (Math.floor(b * 10) / 10).toFixed(1); }
    if (A === B && Math.abs(a - b) > 0.004 && a < 100) { A = a.toFixed(2); B = b.toFixed(2); }
    return A + ' → ' + B;
  }
  function cleanRuns() { return S.runs.filter(function (r) { return r.clean; }); }
  function farthestClean() { var m = 0; S.runs.forEach(function (r) { if (r.clean && r.C > m) m = r.C; }); return m; }
  function farthestPublished() { var m = 0; S.runs.forEach(function (r) { if (r.clean && (r.published || r.shipped) && r.C > m) m = r.C; }); return m; }
  function frontier() { var m = 0; S.rivals.forEach(function (rv) { rv.pubs.forEach(function (p) { if (p.C > m) m = p.C; }); }); if (S.day >= D_GPT3) m = Math.max(m, CFG.gpt3C); return m; }
  function wallC() { return C_of_tokens(CFG.passes * S.W); }
  function rivalC(rv, day) { return Math.min(rv.cap || CFG.rivalCapC, rv.c0 * Math.pow(10, rv.jit + rv.extra + (day / 30.44) / rv.tau)); }

  /* ================= the bet: time on the strip ================= */
  // T is in 'days at today's rate' on the pool the run will take (C = T × F). The year stop is the largest compute that
  // lands by 31 Dec on that pool's known schedule (rentals ending, racks arriving, Meridian going live), with hangs allowed for.
  var brCache = null;
  function betRange(fresh) {
    var key = biggestPoolKey(S.day), tr = training(key); if (tr.flops <= 0) return null;
    // the year's reach is recomputed four times a game day for drawing; a launch always computes it fresh
    var stamp = (fresh ? S.day.toFixed(5) + 'f' : (Math.floor(S.day * 4) / 4).toFixed(2)) + key + tr.flops + (S.mer ? S.mer.alloc + ':' + S.mer.live : '') + S.rentals.length + S.orders.length + S.runs.length + S.team.length + (S.lent ? 1 : 0) + (S.shipped ? 1 : 0) + infraMult();
    if (brCache && brCache.stamp === stamp) return brCache.v;
    var F = tr.flops;
    var yearC = poolCompute(key, S.day, yearEndDay()), yearDays = Math.max(0.05, yearC / F);
    var far = farthestClean();
    var memDays = hasSystems() ? Infinity : CFG.memC / F;
    var horC = far > 0 ? far * CFG.horizonMult : CFG.horizonFirst;
    var horDays = has('ayaan') ? Infinity : horC / F;
    var T = Math.min(memDays, horDays, yearDays), why = T === yearDays ? 'year' : T === memDays ? 'mem' : 'horizon';
    var lo = Math.min(CFG.probeDays, T);
    var v = { F: F, lo: lo, T: T, why: why, horC: horC, eq: tr.eq, phys: tr.phys, pool: key };
    brCache = { stamp: stamp, v: v };
    return v;
  }
  // the strip's travel: logarithmic in days (panel), so equal thumb travel is an equal step on the log paper
  function betDays(t, br) {
    br = br || betRange(); if (!br) return 0;
    if (br.T <= br.lo * 1.0001) return br.lo;
    return CFG.stripLog ? br.lo * Math.pow(br.T / br.lo, clamp(t, 0, 1)) : br.lo + t * (br.T - br.lo);
  }
  function betT(days, br) {
    br = br || betRange(); if (!br || br.T <= br.lo * 1.0001) return 0;
    days = clamp(days, br.lo, br.T);
    return CFG.stripLog ? Math.log(days / br.lo) / Math.log(br.T / br.lo) : (days - br.lo) / (br.T - br.lo);
  }
  // the nib settles onto GPT-3's point when the mark is within a hair of it (panel: a dot 2% short must not pass silently)
  function snapGpt3(t, br) {
    var C = betDays(t, br) * br.F;
    if (S.day < CFG.lineFromDay || Math.abs(log10(C) - log10(CFG.gpt3C)) > CFG.gpt3SnapDecades) return t;
    var Tg = CFG.gpt3C * 1.002 / br.F; if (Tg > br.T || Tg < br.lo) return t;
    return betT(Tg, br);
  }

  /* ================= time ================= */
  function kbdHolding() { return nib.kbd && now - (nib.kbdAt || -99) < CFG.kbdFreezeSec; }
  function frozen() { return !S || S.phase !== 'play' || !S.started || nib.drag || nib.abort || kbdHolding() || now < S.landUntil || now < S.beatUntil || moment.on || paused; }
  // the pour's pace: one day a second, never shorter than 4 s for what is left of the run (re-checked as cards change),
  // and a long run speeds up so no single pour holds the sheet much longer than ~75 s
  function pourRate(run) {
    var tr = training(run.pool), left = run.C - run.done, s = run.done / run.C;
    if (tr.flops <= 0) return CFG.pourDaysPerSec;
    var remDays = left / tr.flops, remShare = Math.max(1e-6, 1 - s);
    var rate = CFG.pourDaysPerSec;
    var longRate = run.T0 / CFG.pourLongAfterSec; if (longRate > rate) rate = Math.min(CFG.pourMaxRate, longRate);
    var minRate = remDays / (remShare * (run.repeat ? CFG.minPourRepeatSec : CFG.minPourSec)); // the rest of the run must take at least its share of 4 s
    return Math.min(rate, minRate);
  }
  function hangRate() { var h = S.hang; return Math.min(CFG.pourDaysPerSec, Math.max(1e-4, (h.until - h.start) / CFG.hangMinRealSec)); }
  function step(dt) {
    if (frozen()) return;
    var rate = S.run ? (S.hang ? hangRate() : pourRate(S.run)) : (S.letter ? CFG.idleLetterDaysPerSec : CFG.idleDaysPerSec);
    advanceDays(dt * rate * speedMult);
  }
  function advanceDays(dd) {
    var guard = 0;
    while (dd > 1e-9 && S.phase === 'play' && guard++ < 100000) {
      var nextInt = Math.floor(S.day + 1e-9) + 1, st = Math.min(dd, nextInt - S.day), wasHung = !!S.hang;
      st = flow(st);
      if (S.hang && !wasHung) { S.day += st; break; }
      S.day += st; dd -= st;
      if (S.phase !== 'play') break;
      if (S.day >= nextInt - 1e-9) { S.day = nextInt; onNewDay(nextInt); }
      if (frozen()) break;
      if (S.run && !S.hang && S.run.done >= S.run.C) break; // the pen lands; the date waits for it
    }
  }
  // one slice of the clock: money moves, the run pours or hangs. Returns the days actually spent.
  function flow(d) {
    var run = S.run, tr = null;
    if (run && !S.hang) {
      tr = training(run.pool);
      // the run's pool went dark (rentals ended): the checkpoint moves to whatever pool still has cards
      if (tr.flops <= 0 || S.day - (run.poolCheckDay || -1) >= 1) { run.poolCheckDay = Math.floor(S.day); var nk = poolFor(run.pool, S.day); if (nk !== run.pool && poolAt(nk, S.day).flops > 0) { var from = run.pool; run.pool = nk; tr = training(nk); S.log.push(fmtDay(S.day) + ' run moved ' + from + ' -> ' + nk); var who = person('dev') || person('rafael') || person('tom') || person('priya'); if (who && run.done / run.C > 0.1) writeNote(fill(WORLD.warn.moved, { pool: WORLD.poolNames[nk] }), who, { type: 'strip', key: 'moved' }, { life: 5, optional: true }); AU.motor('train', tr.phys, 0.3); cells.sweep = now; } }
      // never pour past the landing inside one slice
      if (tr.flops > 0) { var left = (run.C - run.done) / tr.flops; if (left < d) d = Math.max(1e-6, left); }
    }
    S.bank -= rentPerDay() * d;
    S.bank += apiRevenue() / 30.4 * d;
    if (S.mer && S.day >= S.mer.live) S.credits = Math.max(0, S.credits - merAlloc() * CFG.meridianRate * 24 * d);
    if (S.bank <= 0 && S.rentals.length) { S.rentals = []; S.log.push(fmtDay(S.day) + ' bank empty: rentals taken back'); }
    if (S.hang) { if (S.day + d >= S.hang.until) resumeFromHang(); return d; }
    if (!run) return d;
    // a hang begins at the start of this slice; the rest of the frame belongs to the hang's own (slow) clock
    if (run.done > 0 && tr.flops > 0 && rng() < hangLam(tr.eq) * d) { startHang(); return 1e-9; }
    run.done = Math.min(run.C, run.done + tr.flops * d);
    return d;
  }
  function onNewDay(n) {
    if (n > CFG.endDay) { endYear('survived'); return; }
    // what falls due today happens before the 1st's checks: a publish released from Meridian's first look counts
    var evs = S.events.filter(function (e) { return e.day <= n; });
    S.events = S.events.filter(function (e) { return e.day > n; });
    evs.forEach(function (e) { try { e.fn(); } catch (er) { console.error(er); } });
    if (S.phase !== 'play') return;
    // cards: orders ink in, rentals end, rent-outs return, Meridian goes live
    S.orders = S.orders.filter(function (o) { if (n >= o.arrive) { if (o.type === 'a100') S.owned.a += o.n; else S.owned.v += o.n; S.log.push(fmtDay(n) + ' ' + o.n + ' cards arrive'); return false; } return true; });
    S.rentals = S.rentals.filter(function (r) { return n < r.end; });
    if (S.lent && n >= S.lent.until) S.lent = null;
    if (dom(n) === 1) startMonth(monthOf(n));
    if (S.phase !== 'play') return;
    while (S.newsIdx < WORLD.news.length && iso(WORLD.news[S.newsIdx][0]) <= n) { fireNews(WORLD.news[S.newsIdx]); S.newsIdx++; }
    if (S.filter && n >= S.filter.end) finishFilter();
    if (S.redteam && n >= S.redteam.until) finishRedteam();
    S.rivals.forEach(function (rv) { if (n >= rv.nextPub) { rivalPublish(rv); rv.nextPub = n + rv.period * U(0.7, 1.3); } });
    if (dom(n) === 11 || dom(n) === 21) slot(n, false);
    queueWarning(n);
    renderTeam();
  }
  // Meridian's allocation for next month, as the queue would set it today
  function queueAllocFor() { var fr = frontier(), far = farthestClean(), full = S.mer.cards; if (S.priority) return full; return far * CFG.meridianQueueFull >= fr ? full : far * CFG.meridianQueueHalf >= fr ? full / 2 : full / 4; }
  function queueWarning(n) {
    if (!S.mer || S.mer.second === undefined) return;
    var next1 = monthStart(monthOf(n) + 1);
    if (next1 < CFG.meridianQueueFromDay || next1 - n !== CFG.queueWarnDays || S.queueWarned === next1) return;
    S.queueWarned = next1;
    var nextAlloc = queueAllocFor(), cur = S.day >= CFG.meridianQueueFromDay ? S.mer.alloc : S.mer.cards;
    if (nextAlloc < cur) { var who = person('dev') || person('tom') || person('priya') || staff()[0]; writeNote(fill(WORLD.warn.queueSoon, { n: cur - nextAlloc }), who, { type: 'cluster', key: 'queue' }, { life: 9 }); }
  }

  /* ================= the 1st ================= */
  function startMonth(m) {
    S.month = m;
    // notes from last month are cleared, except the ones that live on the paper all year
    S.notes.forEach(function (x) { if (!x.keep) fadeNote(x); }); S.notes = S.notes.filter(function (x) { return x.keep; });
    var tom = person('tom');
    S.tomDemandDue = S.tomDemandDue || (S.hangsThisMonth >= 3 && !!tom && tom.joined <= monthStart(m - 1)); S.hangsThisMonth = 0;
    if (S.day - S.lastPublishDay > CFG.noPaperDays) staff().forEach(function (p) { if (p.ego >= 4) moodAdd(p, -CFG.noPaperMood); });
    var pay = payroll();
    S.lastPayroll = { day: S.day, pay: pay, bankBefore: S.bank, burn: burn(), rent: (function () { var t = 0; S.rentals.forEach(function (r) { if (S.day < r.end) t += r.n * r.price * 24 * 30.4; }); return t; })() };
    S.bank -= pay; S.figureOn = true;
    AU.payroll(); jolt(); fig.roll = null;
    S.log.push(fmtDay(S.day) + ' payroll ' + Math.round(pay) + ' bank ' + Math.round(S.bank));
    if (S.bank < 0) { endYear('bankrupt'); return; }
    // Ayaan's snap lasts a month; a demand nobody acted on is forgotten
    if (S.snapNext && S.snapSince != null && S.day - S.snapSince > 25) { S.snapNext = false; }
    // Meridian's queue
    if (S.mer && S.day >= CFG.meridianQueueFromDay) {
      var full = S.mer.cards, was = S.mer.alloc;
      S.mer.alloc = queueAllocFor();
      if (S.mer.alloc < full) writeNote(fill(WORLD.warn.queueCut, { n: full - S.mer.alloc }), null, { type: 'cluster', key: 'queue' }, { pencil: true, keep: false });
      if (S.mer.alloc !== was) S.log.push(fmtDay(S.day) + ' Meridian queue ' + S.mer.alloc);
    }
    // relevance: the month nobody knocks
    var silent = false, why = '';
    if (S.day >= CFG.relevanceFromDay) {
      var need = frontier() * CFG.relevanceShare;
      silent = worldView() < need || S.scandalSilentMonth === m;
      why = S.scandalSilentMonth === m ? 'scandal' : 'quiet';
    }
    if (silent && S.silentPrev) { S.silentLog.push({ day: S.day, why: why }); endYear('forgotten'); return; }
    S.silent = silent; S.silentPrev = silent;
    if (silent) { S.queue = []; S.silentLog.push({ day: S.day, why: why }); S.log.push(fmtDay(S.day) + ' silent month'); silentWarning(m, why); }
    // evals on the 3rd
    if (S.run) {
      var run = S.run, s0 = run.done / run.C;
      var en = writeNote(WORLD.notes.evals, null, { type: 'pen', dy: 16, dx: 6, key: 'evals' }, { pencil: true });
      var at = Math.floor(S.day) + 2;
      S.events.push({ day: at, fn: function () { if (en) dropNote(en); evalsReading(run, s0); } });
    }
    slot(S.day, true);
  }
  // the world's view of you: farthest published or shipped clean dot, three times an opened one, a tenth of the vault
  function worldView() {
    var vaulted = 0; S.runs.forEach(function (r) { if (r.clean && !r.published && !r.shipped && r.C > vaulted) vaulted = r.C; });
    return Math.max(farthestPublished(), CFG.openedMult * S.openedC, CFG.vaultedMult * vaulted);
  }
  // panel: the silent month is an event you can see, with its cause and its fix, written where the letter would be
  function silentWarning(m, why) {
    var who = person('priya') || person('lena') || staff()[0];
    var need = frontier() * CFG.relevanceShare;
    var fix = why === 'scandal' && worldView() >= need ? WORLD.warn.silentFixScandal : fill(WORLD.warn.silentFixPub, { need: sciP(need) });
    var txt = fill(WORLD.warn.silent, { next: '1 ' + MON[(m + 1) % 12], fix: fix });
    writeNote(txt, who, { type: 'door', key: 'door' }, { keep: false, wrap: true });
  }
  function jolt() { el.months.classList.remove('jolt'); void el.months.offsetWidth; el.months.classList.add('jolt'); }

  /* ================= letters ================= */
  function slot(day, first) {
    if (S.phase !== 'play' || S.silent) return;
    var L = null;
    if (dom(day) === 21 && monthOf(day) === 11) L = makeDecember();
    if (!L) L = pickLetter(day, first);
    if (L) queueLetter(L, L.kind === 'december');
  }
  function queueLetter(L, front) { L.id = ++slipSeq; if (front) S.queue.unshift(L); else S.queue.push(L); }
  function pickLetter(day, first) {
    var order = [
      function () { return first && day >= 31 && monthsVal() < CFG.acquiMonths ? makeAcqui() : null; },
      function () { return termEligible(day) ? makeTerm(day) : null; },
      function () { return makeMeridian(day); },
      function () { return makeRenewal(day); },
      function () { return makeHire(day); },
      function () { return makeDemand(day); },
      function () { return day >= CFG.poachFromDay ? makePoach(day) : null; },
      function () { return makePriority(day); },
      function () { return makeSpot(day); },
      function () { return makeBroker(day); },
      function () { return makeRentOut(day); },
      function () { return makeOpen(day); }
    ];
    for (var i = 0; i < order.length; i++) { var L = order[i](); if (L) return L; }
    return null;
  }
  // the effect line: computed live from the current bank and burn
  function upMonths(mod) { return 'MONTHS ' + monthsPair(monthsVal(), monthsVal(mod)); }
  function upCards(n, pencil) { var c = physicalCards(); return 'CARDS ' + c + ' → ' + (c + n) + (pencil ? ' in pencil' : ''); }
  // a letter queued earlier is checked again when it reaches the door: Meridian's exclusivity, people who left, closed markets
  function stillValid(L) {
    if (L.kind === 'rent' || L.kind === 'spot') { if (S.mer && !L.grey) { L.grey = true; L.why = WORLD.letters.rentGrey; L.up = null; } return true; }
    if (L.kind === 'renewal') return !S.mer && S.rentals.indexOf(L.rental) >= 0;
    if (L.kind === 'term') return termStillOpen(S.day);
    if (L.kind === 'hire') return !S.team.some(function (p) { return p.key === L.who; });
    if (L.kind === 'demand' || L.kind === 'poach') return !!person(L.who);
    if (L.kind === 'priority') return !!S.mer && !S.priority;
    return true;
  }

  function makeAcqui() {
    var heads = staff().length, total = heads * CFG.acquiPerHead, T = WORLD.letters.acqui, forced = S.stake < CFG.boardBelow;
    return { kind: 'acqui', from: T.from, body: fill(T.body, { total: money(total) }), fuse: CFG.fuse.acqui, forced: forced, why: forced ? T.forced : '',
      up: function () { return T.take; }, down: forced ? null : T.pass,
      take: function () { endYear('bought', { price: total, board: forced }); }, pass: function () {} };
  }
  function termStillOpen(day) { return day >= S.termBlockUntil && !(day >= CFG.crashDay && day < CFG.marketOpenDay); }
  function termEligible(day) {
    if (S.termLetterOut) return false;
    if (!termStillOpen(day)) return false;
    if (!S.raise.aTaken) return seriesAProof();
    if (!S.raise.bTaken) return S.runs.some(function (r) { return r.clean && r.C >= CFG.seriesB.needC && r.landDay >= CFG.apiDay; });
    return false;
  }
  function onLine(r) { return r.loss <= Lline(r.C) * CFG.seriesA.onLine; }
  function seriesAProof() {
    var ok = S.runs.filter(function (r) { return r.clean && r.landDay >= CFG.seriesA.fromDay && onLine(r); });
    var far = 0; ok.forEach(function (r) { if (r.C > far) far = r.C; });
    if (far < S.raise.aNeed * 0.995) return false;
    // a decade apart, with a hair of tolerance so a careful 9.99x step is not silently refused (Karpathy)
    return ok.some(function (r) { return log10(far / r.C) >= CFG.seriesA.decadesTol * CFG.seriesA.decades; });
  }
  function makeTerm(day) {
    var A = !S.raise.aTaken, T = A ? WORLD.letters.termA : WORLD.letters.termB, cash, post;
    if (A) { var t = day < CFG.crashDay ? CFG.seriesA.pre : CFG.seriesA.after; cash = t.cash; post = t.post; }
    else { cash = CFG.seriesB.cash; post = S.shipped ? CFG.seriesB.postApi : CFG.seriesB.post; }
    S.termLetterOut = true;
    var by = function () { return ordinal(dom(Math.floor(S.day) + CFG.fuse.term - 1)); };
    return { kind: 'term', round: A ? 'A' : 'B', from: T.from, body: fill(T.body, { cash: money(cash), post: money(post), by: by() }), fuse: CFG.fuse.term, money: true,
      onShow: function (L) { L.body = fill(T.body, { cash: money(cash), post: money(post), by: by() }); },
      up: function () { return upMonths({ bank: cash }) + ' · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * (1 - cash / post)); }, down: T.pass,
      take: function () {
        S.termLetterOut = false; S.bank += cash; S.stake *= (1 - cash / post); S.post = post;
        if (A) S.raise.aTaken = true; else S.raise.bTaken = true;
        S.log.push(fmtDay(S.day) + ' raised ' + (A ? 'A ' : 'B ') + money(cash));
      },
      pass: function () { S.termLetterOut = false; if (A) S.raise.aNeed = farthestClean() * CFG.seriesA.passMult; else S.raise.bTaken = true; } };
  }
  function makeMeridian(day) {
    var weeks = Math.round(CFG.meridianLead / 7);
    if (!S.offered.meridian && !S.mer && day >= CFG.meridianFromDay && farthestClean() >= CFG.meridianNeedC) {
      S.offered.meridian = true;
      var T = WORLD.letters.meridian, n = CFG.meridianCards;
      return { kind: 'meridian', from: T.from, body: fill(T.body, { n: n.toLocaleString('en-US'), weeks: weeks }), fuse: CFG.fuse.meridian,
        up: function () { return fill(T.take, { n: n.toLocaleString('en-US'), live: fmtShort(Math.floor(S.day) + CFG.meridianLead) }); }, down: T.pass,
        take: function () { S.mer = { cards: n, live: Math.floor(S.day) + CFG.meridianLead, alloc: n, second: false }; S.credits = CFG.meridianCredits; S.rentals.forEach(function (r) { r.noRenew = true; }); S.log.push(fmtDay(S.day) + ' Meridian signed'); },
        pass: function () { S.meridianPassed = true; } };
    }
    if (S.meridianPassed && !S.offered.meridian2 && !S.mer && day >= CFG.meridian2FromDay) {
      S.offered.meridian2 = true;
      var T2 = WORLD.letters.meridian2, n2 = CFG.meridian2Cards;
      return { kind: 'meridian', from: T2.from, body: fill(T2.body, { n: n2, weeks: weeks }), fuse: CFG.fuse.meridian,
        up: function () { return 'CARDS +' + n2 + ' in pencil, live ' + fmtShort(Math.floor(S.day) + CFG.meridianLead) + ' · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * CFG.meridian2Stake); }, down: T2.pass,
        take: function () { S.mer = { cards: n2, live: Math.floor(S.day) + CFG.meridianLead, alloc: n2, second: true }; S.credits = CFG.meridianCredits / 2; S.stake *= CFG.meridian2Stake; S.rentals.forEach(function (r) { r.noRenew = true; }); S.log.push(fmtDay(S.day) + ' Meridian (second offer) signed'); },
        pass: function () {} };
    }
    return null;
  }
  // panel: after the raises, money buys your place in Meridian's queue
  function makePriority(day) {
    if (!S.mer || S.priority || S.offered.priority || day < CFG.priority.fromDay || S.day < S.mer.live - 7) return null;
    if (queueAllocFor() >= S.mer.cards) return null;  // only once you are behind
    S.offered.priority = true;
    var T = WORLD.letters.priority, per = CFG.priority.perCardMonth * S.mer.cards;
    return { kind: 'priority', from: T.from, body: fill(T.body, { price: money(per) }), fuse: CFG.fuse.priority, money: true,
      up: function () { return fill(T.take, { n: S.mer.cards.toLocaleString('en-US') }) + ' · ' + upMonths({ salary: per }); }, down: T.pass,
      take: function () { S.priority = true; S.priorityCost = per; S.mer.alloc = S.mer.cards; S.log.push(fmtDay(S.day) + ' Meridian priority ' + money(per) + '/mo'); },
      pass: function () {} };
  }
  function makeRenewal(day) {
    if (S.mer) return null;
    var r = S.rentals.find(function (x) { return !x.renewOffered && !x.noRenew && x.end - day <= CFG.renewWindow && x.end > day; });
    if (!r) return null;
    r.renewOffered = true;
    var date = fmtShort(r.end), refused = day >= CFG.apiDay && rng() < CFG.renewRefuseShare;
    if (refused) {
      var N = WORLD.letters.renewNo;
      return { kind: 'renewal', rental: r, from: N.from, body: fill(N.body, { n: r.n, date: date }), fuse: CFG.fuse.renewal, grey: true, why: N.grey,
        up: null, down: fill(N.pass, { date: date }), take: function () {}, pass: function () {} };
    }
    var price = day >= CFG.apiDay ? CFG.renewPriceAfterApi : rentPrice(day), T = WORLD.letters.renew;
    // the cost both ways: keeping them costs another term of rent; letting them go gives the months back
    var termCost = r.n * price * 24 * CFG.rentTermDays, gone = { rent: -r.n * r.price * 24 * 30.4 };
    return { kind: 'renewal', rental: r, from: T.from, body: fill(T.body, { n: r.n, date: date, price: price.toFixed(2) }), fuse: CFG.fuse.renewal, money: true,
      up: function () { return fill(T.take, { to: fmtShort(r.end + CFG.rentTermDays) }) + ' · ' + money(termCost) + ' for 90 days'; },
      down: fill(T.pass, { date: date }), downFn: function () { return fill(T.pass, { date: date }) + ' · MONTHS ' + monthsPair(monthsVal(), monthsVal(gone)); },
      take: function () { r.end += CFG.rentTermDays; r.price = price; r.renewOffered = false; }, pass: function () {} };
  }
  // panel: if Dev is passed or walks, Rafael knocks at the next slot, so a year is never stuck at one card until April
  var HIRES = [['dev', '2020-01-11'], ['ayaan', '2020-01-21'], ['rafael', '2020-01-21'], ['tom', '2020-02-11'], ['lena', '2020-03-11'], ['sunhee', '2020-04-11'], ['ines', '2020-06-11'], ['kofi', '2020-08-01'], ['ayaan2', '2020-06-11']];
  function hireEligible(key) {
    if (S.offered['hire:' + key]) return false;
    var onTeam = function (k) { return S.team.some(function (p) { return p.key === k; }); };
    if (key === 'rafael') return !hasSystems() && !onTeam('rafael') && !!S.offered['hire:dev'];
    if (key === 'sunhee') return !onTeam('sunhee') && S.runs.some(function (r) { return r.clean && r.published && r.C >= 1e21; });
    if (key === 'ayaan2') return !!S.offered['hire:ayaan'] && !onTeam('ayaan');
    return !onTeam(key);
  }
  function makeHire(day) {
    for (var i = 0; i < HIRES.length; i++) {
      var key = HIRES[i][0], from = iso(HIRES[i][1]);
      if (S.cheap && S.cheap[key] && day <= S.cheapUntil) from = 0;
      if (day >= from && hireEligible(key)) return hireLetter(key);
    }
    return null;
  }
  function hireLetter(key) {
    S.offered['hire:' + key] = true;
    var k = key === 'ayaan2' ? 'ayaan' : key, d = WORLD.people[k];
    var salary = key === 'ayaan2' ? d.salaryLate : d.salary;
    if (S.cheap && S.cheap[k] && S.day <= S.cheapUntil) salary = Math.round(salary * 0.7);
    var to = k === 'sunhee' ? 'halcyon' : 'kestrel', he = pronoun(d.first);
    var pitch = k === 'rafael' && !S.team.some(function (p) { return p.key === 'dev'; }) ? WORLD.rafaelNoDev : d.pitch;
    return { kind: 'hire', who: k, from: d.name, fromHand: true, body: pitch + ' ' + money(salary) + ' a month.', bodyHand: true, fuse: CFG.fuse.hire, money: true,
      up: function () { return upMonths({ salary: salary }); }, down: he + ' ' + WORLD.letters.hirePass[to],
      take: function () { var p = addPerson(k); p.salary = salary; S.stats.hires++; renderTeam(); S.log.push(fmtDay(S.day) + ' hired ' + p.first); },
      pass: function () { var rv = S.rivals.find(function (r) { return r.key === to; }); rv.extra += CFG.rivalPassBoost; } };
  }
  function makeDemand(day) {
    var p;
    if ((p = person('priya')) && !S.offered['demand:priya'] && day >= iso('2020-03-11')) {
      S.offered['demand:priya'] = true; var T = WORLD.letters.priyaDemand;
      return demandLetter(p, T, function () { S.firstAuthor = true; }, function () { walk(p); });
    }
    if ((p = person('dev')) && !S.offered['demand:dev'] && day >= p.joined + 90) {
      S.offered['demand:dev'] = true; var T2 = WORLD.letters.devDemand;
      var L = demandLetter(p, T2, function () { S.stake = Math.max(0, S.stake - CFG.devStake); }, function () { walk(p, 'Halcyon'); });
      L.up = function () { return 'STAKE ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.devStake); }; return L;
    }
    if ((p = person('ayaan')) && !S.offered['demand:ayaan'] && day >= p.joined + 60) {
      S.offered['demand:ayaan'] = true; var T3 = WORLD.letters.ayaanDemand;
      var La = demandLetter(p, T3, function () { S.snapNext = true; S.snapSince = S.day; }, function () { moodAdd(p, -40); });
      // panel: a letter that locks a long run says how long, and what it costs
      La.up = function () {
        if (S.run) return 'your next run goes to the stop · you can drag it home to stop it';
        var br = betRange(); if (!br) return T3.take;
        var land = projectLand(br.pool, br.T * br.F);
        return fill(T3.take, { days: Math.round(land - S.day), land: land > CFG.endDay + 0.5 ? 'after 31 DEC' : fmtDay(land), m0: fmtMonths(monthsVal()), m1: fmtMonths(Math.max(0, monthsVal() - (land - S.day) / 30.4)) });
      };
      return La;
    }
    if ((p = person('tom')) && S.tomDemandDue && !S.offered['demand:tom']) {
      S.offered['demand:tom'] = true; S.tomDemandDue = false; var T4 = WORLD.letters.tomDemand;
      return demandLetter(p, T4, function () { S.tomOffUntil = S.day + 7; }, function () { moodAdd(p, -30); });
    }
    if ((p = person('sunhee')) && !S.offered['demand:sunhee'] && day >= p.joined + 45) {
      S.offered['demand:sunhee'] = true; var T5 = WORLD.letters.sunheeDemand;
      // the trick is real: every rival trains 2.5% lower, worth 1.66x compute to each of them
      return demandLetter(p, T5, function () { S.events.push({ day: Math.floor(S.day) + 30, fn: function () { S.sunheeTrick = true; S.rivals.forEach(function (rv) { rv.extra += CFG.sunheeTrickDecades; }); staticDirty = true; } }); }, function () { walk(p, 'Halcyon'); });
    }
    return null;
  }
  function demandLetter(p, T, take, pass) {
    return { kind: 'demand', who: p.key, from: p.name, fromHand: true, body: T.body, bodyHand: true, fuse: CFG.fuse.demand,
      up: function () { return T.take; }, down: T.pass, take: take, pass: pass };
  }
  function makePoach(day) {
    if (S.poachMonth === S.month || staff().length < CFG.poachMinPeople) return null;
    if (rng() >= CFG.poachChance) return null;
    var target = staff().slice().sort(function (a, b) { return a.mood - b.mood; })[0];
    if (!target) return null;
    S.poachMonth = S.month;
    var mnum = dateOf(day).getUTCMonth() + 1, rival = mnum % 2 === 0 ? 'Halcyon' : 'Kestrel', T = WORLD.letters.poach;
    var he = pronoun(target.first);
    // after GPT-3 everybody is hiring: keeping someone costs a raise as well as equity
    var raise = day >= D_GPT3 ? Math.round(target.salary * CFG.counterRaiseAfterGpt3 / 1000) * 1000 : 0;
    return { kind: 'poach', who: target.key, from: rival.toUpperCase(), body: fill(raise ? T.bodyRaise : T.body, { rival: rival, first: target.first }), fuse: CFG.fuse.poach, money: !!raise,
      up: function () { return 'STAKE ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.counterStake) + (raise ? ' · ' + upMonths({ salary: raise }) : '') + ' · ' + he + ' stays'; }, down: fill(T.pass, { he: he, rival: rival }),
      take: function () { S.stake = Math.max(0, S.stake - CFG.counterStake); moodAdd(target, CFG.counterMood); if (raise) target.salary += raise; },
      pass: function () { walk(target, rival); } };
  }
  function makeBroker(day) {
    if (day - S.lastBroker < CFG.brokerGapDays) return null;
    var rentOpen = day <= CFG.rentUntilDay, buyOpen = day >= 31;
    var kind = S.brokerNext;
    if (kind === 'rent' && !rentOpen) kind = 'buy';
    if (kind === 'buy' && !buyOpen) kind = rentOpen ? 'rent' : null;
    if (!kind) return null;
    S.lastBroker = day; if (buyOpen) S.brokerNext = kind === 'rent' ? 'buy' : 'rent';
    if (kind === 'rent') {
      var n = CFG.rentSizes[monthOf(day)] || 256, price = rentPrice(day), T = WORLD.letters.rent, gone = ordinal(dom(day + CFG.fuse.broker));
      var mod = { rent: n * price * 24 * 30.4 };
      var L = { kind: 'rent', from: T.from, body: fill(T.body, { n: n, price: price.toFixed(2) }), fuse: CFG.fuse.broker, money: true,
        up: function () { return upMonths(mod) + ' · ' + upCards(n); }, down: fill(T.pass, { gone: gone }),
        // 'live tomorrow' means tomorrow, even on 1 January before the clock starts
        take: function () { var st0 = Math.floor(S.day) + 1; S.rentals.push({ n: n, price: price, start: st0, end: st0 + CFG.rentTermDays }); S.log.push(fmtDay(S.day) + ' rented ' + n); },
        pass: function () {} };
      if (S.mer) { L.grey = true; L.why = WORLD.letters.rentGrey; L.up = null; }
      return L;
    }
    var a = day >= CFG.buyA100.fromDay && S.buyNextA, spec = a ? CFG.buyA100 : CFG.buyV100;
    var leadOf = function (sp) { return sp.leadDays + (day >= CFG.covidOrderFrom && day <= CFG.covidOrderTo ? CFG.covidOrderExtra : 0) + (day >= CFG.apiDay ? CFG.afterApiLeadExtra : 0); };
    // panel: never offer racks that cannot arrive in the year; fall back to the faster V100 rack, or no letter
    if (a && Math.floor(day) + leadOf(spec) > CFG.buyMustArriveBy) { a = false; spec = CFG.buyV100; }
    if (Math.floor(day) + leadOf(spec) > CFG.buyMustArriveBy) return null;
    if (day >= CFG.buyA100.fromDay) S.buyNextA = !S.buyNextA;
    var priceB = spec.price * (day >= CFG.apiDay ? CFG.afterApiPriceMult : 1);
    var lead = leadOf(spec);
    var TB = a ? WORLD.letters.buyA : WORLD.letters.buyV;
    var poor = S.bank < priceB;
    return { kind: 'buy', from: TB.from, body: fill(TB.body, { price: '$' + Math.round(priceB).toLocaleString('en-US'), weeks: Math.round(lead / 7) }), fuse: CFG.fuse.broker, money: true,
      grey: poor, why: poor ? 'not in the bank' : '',
      up: poor ? null : function () { return upMonths({ bank: -priceB, owned: spec.n }) + ' · ' + upCards(spec.n, true) + ' by ' + fmtShort(Math.floor(S.day) + lead); }, down: TB.pass,
      take: function () { S.bank -= priceB; S.orders.push({ type: a ? 'a100' : 'v100', n: spec.n, ordered: S.day, arrive: Math.floor(S.day) + lead }); S.log.push(fmtDay(S.day) + ' bought ' + spec.n + (a ? ' A100' : ' V100') + ' for ' + money(priceB)); },
      pass: function () {} };
  }
  // after 11 June: a second-hand broker with short blocks at a premium. Money buys compute that lands in time.
  function makeSpot(day) {
    var sp = CFG.spot;
    if (day < sp.fromDay || day > sp.untilDay || day - S.lastSpot < sp.gapDays) return null;
    S.lastSpot = day;
    var T = WORLD.letters.spot, gone = ordinal(dom(day + CFG.fuse.spot)), n = sp.n;
    var mod = { rent: n * sp.price * 24 * 30.4 };
    var L = { kind: 'spot', from: T.from, body: fill(T.body, { n: n, days: sp.days, price: sp.price.toFixed(2) }), fuse: CFG.fuse.spot, money: true,
      up: function () { return upMonths(mod) + ' · ' + upCards(n) + ' to ' + fmtShort(Math.floor(S.day) + 1 + sp.days); }, down: fill(T.pass, { gone: gone }),
      take: function () { var st0 = Math.floor(S.day) + 1; S.rentals.push({ n: n, price: sp.price, start: st0, end: st0 + sp.days, noRenew: true, spot: true }); S.log.push(fmtDay(S.day) + ' spot rented ' + n); },
      pass: function () {} };
    if (S.mer) { L.grey = true; L.why = WORLD.letters.rentGrey; L.up = null; }
    return L;
  }
  function makeRentOut(day) {
    var owned = S.owned.v;
    if (S.lent || monthsVal() >= CFG.rentOutMonths || owned < CFG.rentOutMinOwned) return null;
    var n = Math.floor(owned / 2), cash = n * CFG.rentOutPerHour * 24 * CFG.rentOutDays, T = WORLD.letters.rentOut;
    return { kind: 'rentout', from: T.from, body: T.body + ' ' + money(cash) + '.', fuse: CFG.fuse.rentout, money: true,
      up: function () { return upMonths({ bank: cash }) + ' · CARDS lent for 30 days'; }, down: T.pass,
      take: function () { S.bank += cash; S.lent = { n: n, until: Math.floor(S.day) + CFG.rentOutDays }; },
      pass: function () {} };
  }
  function makeOpen(day) {
    if (S.offered.open || day < iso('2020-07-01')) return null;
    if (!S.runs.some(function (r) { return r.clean && r.published && r.C >= 1e21; })) return null;
    S.offered.open = true;
    var T = WORLD.letters.open, grey = S.mer ? T.greyMer : S.stake < CFG.boardBelow ? T.greyBoard : '';
    return { kind: 'open', from: T.from, body: T.body, fuse: CFG.fuse.open, grey: !!grey, why: grey,
      up: grey ? null : function () { return T.take; }, down: T.pass,
      take: function () {
        S.opened = true; S.openedC = farthestPublished();
        var k = S.rivals.find(function (r) { return r.key === 'kestrel'; }), nw = S.rivals.find(function (r) { return r.key === 'northwind'; });
        S.events.push({ day: Math.floor(S.day) + 7, fn: function () { k.extra += CFG.rivalOpenKestrel; nw.extra += CFG.rivalOpenNorthwind; } });
        S.cheap = { ines: true, kofi: true }; S.cheapUntil = S.day + 14;
      },
      pass: function () { var nw = S.rivals.find(function (r) { return r.key === 'northwind'; }); nw.extra += CFG.rivalPassOpenNorthwind; } };
  }
  function makeDecember() {
    var p = person('priya'), others = staff().filter(function (x) { return x !== p; }).sort(function (a, b) { return a.mood - b.mood; });
    var sender = p || staff().slice().sort(function (a, b) { return b.ego - a.ego; })[0];
    if (!sender) return null;
    if (!p) others = others.filter(function (x) { return x !== sender; });
    var names = others.slice(0, 2).map(function (x) { return x.first; });
    var T = WORLD.letters.december, body;
    if (names.length >= 2) body = fill(T.body, { a: names[0], b: names[1] });
    else if (names.length === 1) body = names[0] + ' and I want to start something safer. We’re telling you first.';
    else body = 'I want to start something safer. I’m telling you first.';
    var leaving = [sender].concat(others.slice(0, 2));
    return { kind: 'december', from: sender.name, fromHand: true, body: body, bodyHand: true, fuse: 0,
      up: function () { return T.take; }, down: T.pass,
      take: function () { S.choice = 'blessing'; leaving.forEach(function (x, i) { after(i * 0.15, function () { walk(x, null, true); }); }); writeNote('they left to start something safer', null, { type: 'band' }, { keep: true, pencil: true }); },
      pass: function () { S.choice = 'fought'; writeNote('they stayed. for now.', null, { type: 'band' }, { keep: true, pencil: true }); } };
  }

  /* ---------- letters on the sheet ---------- */
  // the fuse burns in game days while the date moves, and never in less than letterMinRealSec of moving clock
  function letterBurned(L) { if (!(L.fuse > 0)) return 0; return Math.min((S.day - L.shownDay) / L.fuse, (L.realBurn || 0) / CFG.letterMinRealSec); }
  function pumpLetters(dt) {
    if (!S || S.phase !== 'play') { AU.fuse(false); return; }
    if (!S.letter && S.queue.length && now >= S.letterGapUntil) {
      var L = S.queue.shift();
      while (L && !stillValid(L)) { S.log.push(fmtDay(S.day) + ' letter dropped: ' + L.kind); if (L.kind === 'term') S.termLetterOut = false; L = S.queue.shift(); }
      if (L) {
        if (L.onShow) L.onShow(L);
        S.letter = L; L.shownDay = S.day; L.shownAt = now; L.realBurn = 0;
        buildLetter(L); AU.letter();
        S.log.push(fmtDay(S.day) + ' letter up: ' + L.kind + (L.who ? ':' + L.who : ''));
      }
    }
    var L2 = S.letter;
    root.classList.toggle('letterup', !!L2);
    if (L2) {
      var burning = L2.fuse > 0 && !frozen();
      AU.fuse(burning);
      if (burning && dt) L2.realBurn += dt * Math.min(1, speedMult);
      if (L2.fuse > 0) {
        var left = 1 - letterBurned(L2);
        if (L2.fuseEl) L2.fuseEl.style.width = (clamp(left, 0, 1) * 100).toFixed(3) + '%';
        if (left <= 0) { resolveLetter(L2.forced ? 'take' : 'pass', true); return; }
      }
      if (now - (L2.effAt || 0) > 0.35) { L2.effAt = now; renderEffect(L2); }
    } else AU.fuse(false);
  }
  function buildLetter(L) {
    var d = document.createElement('div');
    d.className = 'fr-letter' + (L.grey ? ' grey' : '');
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', 'Letter from ' + L.from + '. ' + L.body + (L.up && !L.grey ? ' Flick up, or press the up arrow, to take.' : '') + (L.down ? ' Flick down, or press the down arrow, to let it go.' : ''));
    if (L.fuse > 0) { var f = document.createElement('div'); f.className = 'fuse'; var tip = document.createElement('i'); f.appendChild(tip); d.appendChild(f); L.fuseEl = f; L.tipEl = tip; }
    var from = document.createElement('div'); from.className = 'from' + (L.fromHand ? ' hand' : ''); from.textContent = L.from; d.appendChild(from);
    var body = document.createElement('div'); body.className = 'body' + (L.bodyHand ? ' hand' : ''); body.textContent = L.body; d.appendChild(body);
    // the first letter of a sitting teaches the flick, in pencil, on the slip itself
    if (!L.why && !L.grey && L.up && L.down && !TAUGHT.all && !TAUGHT.flick) { TAUGHT.flick = true; L.why = WORLD.teach.flick; L.whyTeach = true; }
    if (L.why) { var w = document.createElement('div'); w.className = 'why' + (L.whyTeach ? ' teach' : ''); w.textContent = L.why; d.appendChild(w); L.whyEl = w; }
    var eff = document.createElement('div'); eff.className = 'eff'; d.appendChild(eff); L.effEl = eff; L.bodyEl = body;
    renderEffect(L);
    attachFlick(d, L);
    el.letterzone.appendChild(d); L.dom = d;
    fitLetter(L);
    void d.offsetWidth; d.classList.add('in');
  }
  // a letter never spills: the body steps down a size, and as a last resort the slip grows into the zone
  function fitLetter(L) {
    var d = L.dom; if (!d) return;
    d.classList.remove('fit1', 'fit2'); d.style.height = '';
    var over = function () { return L.bodyEl.offsetTop + L.bodyEl.offsetHeight > L.effEl.offsetTop - 2; };
    if (over()) d.classList.add('fit1');
    if (over()) d.classList.add('fit2');
    if (over()) { var need = L.bodyEl.offsetTop + L.bodyEl.offsetHeight + L.effEl.offsetHeight + 14; var zone = el.letterzone.clientHeight - d.offsetTop - 2; d.style.height = Math.min(Math.max(need, d.offsetHeight), Math.max(d.offsetHeight, zone)) + 'px'; }
    L.fitted = true;
  }
  function renderEffect(L) {
    if (!L.effEl) return;
    var up = L.up && !L.grey ? (typeof L.up === 'function' ? L.up() : L.up) : null;
    var dn = L.down ? (L.downFn ? L.downFn() : L.down) : null;
    var html = '';
    if (up) html += '<div data-a="take">↑ ' + esc(up) + '</div>';
    if (dn) html += '<div class="dn" data-a="pass">↓ ' + esc(dn) + '</div>';
    if (L.effHtml !== html) { var lines0 = L.effEl.offsetHeight; L.effHtml = html; L.effEl.innerHTML = html; if (L.dom && L.fitted && L.effEl.offsetHeight !== lines0) fitLetter(L); }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function attachFlick(d, L) {
    var st = null;
    d.addEventListener('pointerdown', function (e) {
      gesture();
      if (S.letter !== L || moment.on) return;
      // a letter that just slid in ignores taps for 400 ms, so a thumb meant for the last one never takes this one
      if (now - (L.shownAt || -99) < CFG.letterTapGuardSec) { e.stopPropagation(); return; }
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, h: [[performance.now(), e.clientX, e.clientY]], target: e.target };
      try { d.setPointerCapture(e.pointerId); } catch (er) {}
      d.classList.add('drag'); e.stopPropagation(); e.preventDefault();
    });
    d.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      st.h.push([performance.now(), e.clientX, e.clientY]); if (st.h.length > 8) st.h.shift();
      var dy = e.clientY - st.y;
      if (dy < 0 && (L.grey || !L.up)) dy = dy * 0.25;     // a greyed letter barely lifts: it can only be let go
      if (dy > 0 && !L.down) dy = dy * 0.25;               // a forced letter barely sinks
      d.style.transform = 'translate3d(0,' + dy.toFixed(1) + 'px,0)';
    });
    function end(e, cancel) {
      if (!st || e.pointerId !== st.id) return;
      // a cancelled touch (the thumb ran off the screen's edge) counts where it last was: a flick already made is a flick
      var h = st.h, a = h[0], b = h[h.length - 1], vy = (b[2] - a[2]) / Math.max(1, b[0] - a[0]);
      var ex = cancel ? b[1] : e.clientX, ey = cancel ? b[2] : e.clientY, dy = ey - st.y, dx = ex - st.x;
      var tgt = st.target && st.target.closest ? st.target.closest('[data-a]') : null;
      var tapped = !cancel && Math.abs(dy) < 6 && Math.abs(dx) < 6 && tgt ? tgt.getAttribute('data-a') : null;
      st = null; d.classList.remove('drag');
      if (cancel && Math.abs(dy) < CFG.flickPx) { d.style.transform = ''; return; }
      var act = null;
      if (dy < -CFG.flickPx || (vy < -CFG.flickVel && dy < -10)) act = 'take';
      else if (dy > CFG.flickPx || (vy > CFG.flickVel && dy > 10)) act = 'pass';
      else if (tapped) act = tapped; // a click on the effect line works too, for mice and switch users
      if (act === 'take' && (L.grey || !L.up)) act = null;
      if (act === 'pass' && !L.down) act = null;
      d.style.transform = '';
      if (act && S.letter === L) resolveLetter(act);
      // a tap on the body does nothing by itself: the slip nudges and the pencil says how
      else if (!act && Math.abs(dy) < 6 && Math.abs(dx) < 6 && S.letter === L) nudgeLetter(L);
    }
    d.addEventListener('pointerup', function (e) { end(e, false); });
    d.addEventListener('pointercancel', function (e) { end(e, true); });
  }
  function nudgeLetter(L) {
    if (!L.dom || reduced()) { if (L.whyEl) L.whyEl.textContent = WORLD.teach.tapLetter; return; }
    L.dom.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-10px,0)' }, { transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,6px,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 520, easing: 'ease-out' });
    if (!L.grey && !L.forced) {
      if (!L.whyEl) { var w = document.createElement('div'); w.className = 'why teach'; L.dom.appendChild(w); L.whyEl = w; }
      if (L.whyTeach || !L.why) { L.whyEl.className = 'why teach'; L.whyEl.textContent = WORLD.teach.tapLetter; }
    }
  }
  function resolveLetter(act, byFuse) {
    var L = S && S.letter; if (!L) return false;
    if (act === 'take' && (L.grey || !L.up) && !byFuse) return false;
    if (act === 'pass' && !L.down && !byFuse) return false;
    S.letter = null; AU.fuse(false); S.letterGapUntil = now + (act === 'take' ? CFG.letterTakeSec : CFG.letterPassSec) + CFG.letterGapSec;
    var d = L.dom;
    if (d) { d.classList.remove('in'); d.classList.add(act === 'take' ? 'take' : 'pass'); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 420); }
    if (act === 'take') AU.take(); else AU.pass();
    var before = S.figureOn ? monthsVal() : null;
    try { if (act === 'take') L.take(); else L.pass(); } catch (e) { console.error(e); }
    if (before != null && S.phase === 'play' && act === 'take' && L.money) rollFigure(before);
    S.log.push(fmtDay(S.day) + ' letter ' + L.kind + (L.who ? ':' + L.who : '') + ' ' + act + (byFuse ? ' (fuse)' : ''));
    renderTeam(); staticDirty = true;
    return true;
  }
  function withdrawTerms() {
    S.queue = S.queue.filter(function (L) { return L.kind !== 'term'; });
    if (S.letter && S.letter.kind === 'term') {
      var L = S.letter; S.letter = null; AU.fuse(false); S.letterGapUntil = now + 0.9;
      if (L.dom) { L.dom.classList.add('grey'); if (L.effEl) L.effEl.innerHTML = ''; }
      setTimeout(function () { if (L.dom) { L.dom.classList.remove('in'); L.dom.classList.add('pass'); setTimeout(function () { if (L.dom.parentNode) L.dom.parentNode.removeChild(L.dom); }, 420); } }, 520);
    }
    S.termLetterOut = false;
  }

  /* ================= people ================= */
  function moodAdd(p, d) { if (!p || p.gone) return; p.mood = clamp(p.mood + d, 0, 100); if (p.mood <= 0) walk(p); }
  function walk(p, toRival, quiet) {
    if (!p || p.gone) return;
    p.gone = true; p.goneDay = S.day; p.struckAt = now; S.stats.walked++;
    AU.strike();
    // a filter job outlives Priya if Ines is there to run it (alone, it takes her the full three weeks)
    if (S.filter && S.filter.by === p.key) { if (p.key === 'priya' && has('ines')) { S.filter.by = 'ines'; S.filter.end = Math.max(S.filter.end, S.filter.start + CFG.filterDays); } else S.filter = null; }
    if (S.redteam && p.key === 'lena') { var rt = S.redteam; S.redteam = null; if (S.checkpoint && S.checkpoint.run.id === rt.runId) S.checkpoint.state = 'up'; }
    if (S.offer && (p.key === 'priya' || p.key === 'ines') && !person('priya') && !person('ines')) S.offer = null;
    if (toRival) { var rv = S.rivals.find(function (r) { return r.name === toRival; }); if (rv) rv.extra += CFG.rivalPassBoost; }
    S.log.push(fmtDay(S.day) + ' ' + p.first + ' walks' + (toRival ? ' to ' + toRival : '') + (quiet ? ' (December)' : ''));
    renderTeam();
  }
  function pressName(p) {
    if (!S || S.phase !== 'play' || !S.powered || moment.on) return;
    gesture();
    if (p.gone) return;
    if (S.hang) { wake(p); return; }
    var dataLead = person('priya') || person('ines');
    if (p === dataLead) {
      if (S.offer && !S.filter) { startFilter(p); return; }
      var smp = S.bandSample;
      // panel: press her at any fray and she offers the job, with its price, unless that run predates the last filter
      if (smp && !S.filter && smp.fray >= CFG.priyaAskK && !sampleStale(smp)) {
        S.offer = { sampleId: smp.id, keep: true };
        writeNote((smp.fray >= 4 || smp.crawl ? WORLD.notes.fray : WORLD.notes.fray3) + ' ' + filterCostText(p), p, { type: 'band', key: 'fray' });
        return;
      }
      if (smp && !S.filter && smp.fray >= 1 && sampleStale(smp)) { writeNote('that run was launched before the last filter', p, { type: 'band' }); return; }
      if (smp && !S.filter && smp.tier >= 3 && smp.fray === 0) { writeNote(WORLD.notes.fray12, p, { type: 'band' }); return; }
    }
    if (p.key === 'lena' && S.checkpoint && (S.checkpoint.state === 'up' || S.checkpoint.state === 'auto') && !S.redteam) { startRedteam(); return; }
    // otherwise they write their status beside their work
    var st = WORLD.people[p.key].status[0];
    if (p.key === 'priya' || p.key === 'ines') st = S.filter ? 'filter: ' + plural(Math.max(0, Math.ceil(S.filter.end - S.day)), 'day') : st;
    if (p.key === 'lena' && S.redteam) st = 'red-team: ' + plural(Math.max(0, Math.ceil(S.redteam.until - S.day)), 'day');
    writeNote(st, p, { type: 'name', key: p.key });
  }
  function wake(p) {
    var h = S.hang; if (!h) return;
    if (h.woken) return;
    h.woken = true;
    h.until = Math.min(h.until, S.day + CFG.wokenRestartDays);
    if (h.night) moodAdd(p, -(p.key === 'tom' ? CFG.wakeMoodTom : CFG.wakeMood));
    dropNoteKey('teach-wake');
    writeNote('up', p, { type: 'name', key: p.key });
    renderTeam();
    S.log.push(fmtDay(S.day) + ' woke ' + p.first);
  }

  /* ================= the data wall: Priya's filter job ================= */
  // a sample from a run launched before the last filter landed tells you nothing new about the wall
  function sampleStale(smp) { return smp.launchDay != null && S.lastFilterDoneDay >= 0 && smp.launchDay < S.lastFilterDoneDay; }
  function filterCost() { return CFG.filterCost * Math.pow(2, S.filtersDone); }
  function filterDays(p) { return p.key === 'priya' ? (has('ines') ? CFG.filterDaysInes : CFG.filterDays) : CFG.filterDays; }
  // panel: a standing offer says 'press my name' and what it costs, by the name
  function shortMoney(x) { return x >= 1e6 ? '$' + (x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : '$' + Math.round(x / 1000) + 'K'; }
  function filterCostText(p) { var d = filterDays(p); return d === CFG.filterDays ? fill(WORLD.teach.filterCost, { cost: shortMoney(filterCost()) }) : fill(WORLD.teach.filterCostInes, { days: d, cost: shortMoney(filterCost()) }); }
  function noticeSample(smp) {
    var lead = person('priya') || person('ines');
    if (!lead || S.filter || !smp || sampleStale(smp)) return;
    if (smp.fray >= CFG.priyaAutoK) { S.offer = { sampleId: smp.id, keep: true }; writeNote(WORLD.notes.fray + ' ' + filterCostText(lead), lead, { type: 'band', key: 'fray' }); }
  }
  function startFilter(p) {
    var cost = filterCost();
    var days = filterDays(p);
    dropNoteKey('fray');
    var before = S.figureOn ? monthsVal() : null;
    S.bank -= cost;
    if (before != null) rollFigure(before);
    S.filter = { start: S.day, end: Math.floor(S.day) + days, by: p.key };
    S.offer = null; S.stats.filters++;
    S.notes.filter(function (x) { return x.anchor.type === 'band' && !x.keep; }).forEach(function (x) { fadeNote(x); });
    AU.write(400);
    S.log.push(fmtDay(S.day) + ' filter starts (' + money(cost) + ', ' + days + 'd)');
    renderTeam();
  }
  function finishFilter() { S.W *= CFG.filterW; S.filtersDone++; S.filter = null; S.offer = null; S.lastFilterDoneDay = S.day; S.log.push(fmtDay(S.day) + ' filter done'); renderTeam(); }

  /* ================= runs ================= */
  function launch(T) {
    if (!S || S.phase !== 'play' || S.run || !S.powered) return false;
    var br = betRange(true); if (!br) return false;
    T = clamp(T, br.lo, br.T);
    var C = T * br.F;
    var b = 0, blind = C > br.horC * 1.0001;
    if (blind) b = rng() < CFG.blindShare ? U(CFG.blindHi[0], CFG.blindHi[1]) : U(CFG.blindLo[0], CFG.blindLo[1]);
    // Karpathy: every run lands with its own seed noise, so repeats differ and the line is fitted, not given
    var eps = gauss(rng) * noiseSigma(C);
    var run = { id: S.runs.length + 1, C: C, T0: T, lo: br.lo, stopT: br.T, F0: br.F, pool: br.pool, m: sunheeM(), b: b, blind: blind, eps: eps,
      D: tokens(C), launchDay: S.day, landDay: null, done: 0, pts: [], lastLog: -99, cks: [], ckIdx: 0, sampled: {}, autoDone: {}, lastAuto: now, hangs: [], q: 0, launchedAt: now };
    run.r = run.D / (CFG.passes * S.W); run.wallAt = wallC();
    run.loss = Lstar(run, C) * wallDip(run.r);
    // a checkpoint left unflicked goes to the vault and its words sink
    if (S.checkpoint && (S.checkpoint.state === 'up')) { sinkBand(); S.checkpoint = null; }
    // the third identical dot onward (the memory stop on a big cluster) pours and lands quickly: it can teach nothing new
    var lcR = log10(C); run.repeat = S.runs.filter(function (r) { return r.clean && Math.abs(log10(r.C) - lcR) < CFG.dupCurveDecades; }).length >= CFG.repeatAfter;
    S.run = run; S.started = true; S.stats.launches++; S.snapNext = false; staticDirty = true;
    if (S.stats.launches === 1) after(22, retireOpeningLessons);
    run.landProj = projectLand(run.pool, C);
    AU.lift(); AU.vibrate(8); AU.motor('train', br.phys, 0.3);
    cells.sweep = now;
    pan(C);
    S.log.push(fmtDay(S.day) + ' launch ' + sci(C) + ' T=' + T.toFixed(2) + 'd r=' + run.r.toFixed(2) + ' on ' + run.pool);
    el.sample.classList.remove('flickable');
    dropNoteKey('teach-drag'); dropNoteKey('snap'); dropNoteKey('stop'); dropNoteKey('split'); dropNoteKey('hint');   // the last landing's words went to the vault: its hint goes too
    if (br.why === 'mem' && T >= br.T * 0.98) { S.memStops++; if (S.memStops === 3 && !hasSystems() && person('priya')) writeNote(WORLD.warn.janWall, person('priya'), { type: 'strip', key: 'janwall' }, { life: 6 }); }
    // a long run teaches the way out, once: drag the nib home to stop it
    if (run.landProj - S.day > 30) teach('abort', WORLD.teach.abort, person('ayaan') || person('priya'), { type: 'strip', key: 'teach-abort' }, 9);
    return true;
  }
  // panel: a locked run can be abandoned. Drag the nib home: the run stops, its last checkpoint stands above the line
  // as a ring that proves nothing, and the people who believed in it take it hard.
  function abortRun() {
    var run = S.run; if (!run || S.phase !== 'play') return false;
    var s = run.done / run.C, q = Math.pow(s, 1.5);
    S.run = null; S.hang = null; S.pendingTap = null; el.hour.textContent = '';
    run.aborted = true; run.clean = false; run.landDay = S.day; run.planC = run.C; run.amount = 0;
    run.C = Math.max(run.done, run.C * 1e-4); run.loss = lossAt({ C: run.planC, m: run.m, b: run.b, eps: run.eps, r: run.r }, Math.max(q, P0));
    run.pts = run.pts.filter(function (p) { return p[2] <= q + 1e-12; });
    S.runs.push(run); S.stats.aborted++;
    staff().forEach(function (p) { moodAdd(p, -CFG.abortMood); });
    var ay = person('ayaan'); if (ay) moodAdd(ay, -(CFG.abortMoodBeliever - CFG.abortMood));
    AU.motor('idle', 0, 0.6); AU.scratch(0); AU.pass();
    S.landUntil = now + CFG.landAbortSec; staticDirty = true;
    nib.t = 0;
    var who = person('ayaan') || person('priya') || staff()[0];
    if (who) writeNote(fill(WORLD.warn.stopped, { pct: Math.max(1, Math.round(s * 100)) }), who, { type: 'paper', C: run.C, L: run.loss, dy: -22, dx: 8, key: 'stopped' }, { life: 7 });
    dropNoteKey('teach-abort'); dropNoteKey('wontland');
    S.log.push(fmtDay(S.day) + ' ABORT at ' + (s * 100).toFixed(0) + '% of ' + sci(run.planC));
    return true;
  }
  function pourUpdate() {
    var run = S.run; if (!run || S.hang) return;
    var s = run.done / run.C, q = Math.pow(s, 1.5);
    run.q = q;
    if (q >= P0) {
      var lq = log10(q);
      while (run.lastLog < lq - 0.004 || (run.lastLog < lq && q >= 1)) {
        var nl = run.lastLog < log10(P0) ? log10(P0) : Math.min(lq, run.lastLog + 0.004);
        var qq = Math.pow(10, nl), z = (nl + 3.5) / 3.5;
        var y = Math.log(lossAt(run, qq)) + gauss(vis) * CFG.curveNoise * (1 - 0.5 * z);
        if (qq >= 1) y = Math.log(run.loss);
        run.pts.push([log10(qq * run.C), y, qq]); run.lastLog = nl;
        if (vis() < 0.25) AU.jag();
        if (nl >= lq) break;
      }
    }
    while (run.ckIdx < CFG.checkpoints.length && q >= CFG.checkpoints[run.ckIdx]) {
      run.cks.push({ q: CFG.checkpoints[run.ckIdx], i: run.ckIdx }); run.ckIdx++;
      if (S.pendingTap) { S.pendingTap = null; sampleNow('tap'); }
    }
    // a tap waits at most about 0.7 s for a fresh checkpoint, then reads the pen where it is
    if (S.pendingTap && now - S.pendingTap.at >= CFG.tapWaitSec) { S.pendingTap = null; sampleNow('tap', q); }
    var holdBand = S.checkpoint && S.checkpoint.state === 'up' && S.checkpoint.afterRedteam && now - (S.checkpoint.backAt || 0) < 10;
    CFG.autoSampleQ.forEach(function (aq, i) { if (!run.autoDone[i] && q >= aq) { run.autoDone[i] = true; if (now - (S.lastTapAt || -99) > CFG.autoQuietSec && !holdBand) sampleNow('auto'); } });
    if (run.T0 > CFG.autoEveryLongerThan && now - run.lastAuto > CFG.autoEverySec && now - (S.lastTapAt || -99) > CFG.autoQuietSec && !holdBand) { run.lastAuto = now; sampleNow('auto'); }
    // the first pour of a sitting teaches the tap
    if (q > 0.02 && now - run.launchedAt > 1.2) teach('tap', WORLD.teach.tap, person('priya'), { type: 'pen', dy: 26, dx: 12, key: 'teach-tap' }, 6);
    // an honest strip: the landing date follows the cards; say so when it slides past New Year
    if (now - (run.projAt || 0) > 0.25) {
      run.projAt = now; run.landProj = projectLand(run.pool, run.C - run.done);
      if (S.hang) run.landProj += Math.max(0, S.hang.until - S.day);
      if (run.landProj > CFG.endDay + 1 && !run.wontSaid) { run.wontSaid = true; var who = person('ayaan') || person('dev') || person('priya'); writeNote(WORLD.warn.wontLand + ' · ' + WORLD.teach.abort, who, { type: 'strip', key: 'wontland' }, { life: 0 }); }
      if (run.landProj <= CFG.endDay + 1 && run.wontSaid) { run.wontSaid = false; dropNoteKey('wontland'); }
    }
    if (s >= 1 - 1e-12) land(run);
  }
  function tapSample() {
    if (!S || !S.run || S.hang || S.phase !== 'play') return false;
    S.lastTapAt = now; S.tapFx = now;
    dropNoteKey('teach-tap');
    // the words in the band are the red-teamed checkpoint: pulling a new sample sends that checkpoint to the vault
    if (S.checkpoint && S.checkpoint.state === 'up' && S.checkpoint.afterRedteam) { S.checkpoint = null; el.sample.classList.remove('flickable'); }
    var run = S.run, last = run.cks[run.cks.length - 1];
    if (last && !run.sampled[last.i]) { sampleNow('tap'); return true; }
    if (!S.pendingTap) S.pendingTap = { at: now };
    return true;
  }
  function sampleNow(kind, atQ) {
    var run = S.run; if (!run) return;
    var last = run.cks[run.cks.length - 1];
    var q = atQ != null ? Math.max(atQ, P0) : last ? last.q : null;
    if (q == null) return;
    if (last && atQ == null) run.sampled[last.i] = true;
    run.lastAuto = now;
    var smp = makeSample(run, q, kind);
    if (smp.fray > 0 && smp.tier >= 3) run.lastFray = smp.text;
    showBand(smp);
  }
  function hangHour() { var w = []; for (var h = 0; h < 24; h++) w.push(h >= 1 && h < 5 ? 2 : 1); var tot = 0; w.forEach(function (x) { tot += x; }); var r = rng() * tot; for (h = 0; h < 24; h++) { r -= w[h]; if (r <= 0) return h + rng(); } return 3; }
  function startHang() {
    var run = S.run; if (!run) return;
    var hour = hangHour(), infra = hasInfra(), covid = S.day >= CFG.hangCovidFrom && S.day <= CFG.hangCovidTo;
    // Karpathy: a daytime hang is noticed by someone at a desk within hours; only night hangs wait for morning
    var day = hour >= CFG.hangDayHours[0] && hour < CFG.hangDayHours[1];
    var down = infra ? CFG.infraRestartDays : day ? U(CFG.hangDayNoticeHours[0], CFG.hangDayNoticeHours[1]) / 24 : ((hour < 8 ? 8 - hour : 32 - hour) / 24 + (covid ? CFG.hangCovidExtraDays : 0));
    var lostDays = infra ? U(0, CFG.infraRewindDays) : U(0, 1);
    var hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    var label = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    var pt = run.pts[run.pts.length - 1];
    S.hang = { start: S.day, until: S.day + down, label: label, lost: lostDays * training(run.pool).flops, at: now, night: !day && !infra };
    run.hangs.push(S.day);
    S.hangsThisMonth++; S.stats.hangs++;
    var tom = has('tom') && S.day >= S.tomOffUntil;
    if (pt && tom) S.hangMarks.push({ x: pt[0], y: pt[1] });
    AU.hang(); AU.scratch(0);
    el.hour.textContent = ' · ' + label;
    // only the latest hang keeps its hour on the paper; Tom's 'my fault' is written once and moves with it
    writeNote(label, null, { type: 'pen', dy: -24, dx: 10, key: 'hang' }, { pencil: true, ring: tom, life: 9, optional: true });
    if (tom && !S.hints.tomFault) { S.hints.tomFault = true; after(0.6, function () { writeNote(WORLD.notes.tomHang, person('tom'), { type: 'pen', dy: -44, dx: 18, key: 'tomfault' }, { life: 6, optional: true }); }); }
    if (S.hang.night) teach('wake', WORLD.teach.wake, person('priya') || staff()[0], { type: 'names', key: 'teach-wake' }, 0, true);
    staticDirty = true;
    S.log.push(fmtDay(S.day) + ' hang ' + label + ' down ' + down.toFixed(2) + 'd');
  }
  function resumeFromHang() {
    var run = S.run, h = S.hang; S.hang = null; el.hour.textContent = '';
    dropNoteKey('teach-wake');
    if (!run) return;
    run.done = Math.max(0, run.done - h.lost);
    var q = Math.pow(run.done / run.C, 1.5);
    run.pts = run.pts.filter(function (p) { return p[2] <= q + 1e-12; });
    run.lastLog = run.pts.length ? log10(run.pts[run.pts.length - 1][2]) : -99;
    AU.motor('train', training(run.pool).phys, 0.3);
    cells.sweep = now;
  }
  function land(run) {
    run.done = run.C; run.landDay = S.day; run.q = 1;
    S.run = null; S.pendingTap = null; el.hour.textContent = '';
    run.clean = run.r <= 1; run.amount = amount(run.r);
    var smp = makeSample(run, 1, 'land');
    S.runs.push(run);
    AU.motor('idle', 0, 0.6); AU.scratch(0);
    S.landUntil = now + (run.clean ? (run.repeat ? CFG.landRepeatSec : CFG.landCleanSec) : CFG.landWallSec);
    S.landFx = { run: run, t0: now };
    staticDirty = true;
    var capNew = null, capsHit = [];
    if (run.clean) {
      // every threshold this landing crosses gets its moment, lowest first (panel: the paragraph is never swallowed)
      S.caps.forEach(function (c) { if (!c.fired && run.loss <= c.L) { c.fired = true; capsHit.push(c); } });
      capNew = capsHit.length ? capsHit[capsHit.length - 1] : null;
      capsHit.forEach(function (c) { fireCapFx(c); });
      if (capNew) { run.capHere = capNew.id; }
      S.checkpoint = { run: run, state: 'up', sampleId: null };
      // passing a rival
      S.rivals.forEach(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; if (lp && lp.day >= 0 && !rv.passed && run.C > lp.C && run.loss < Lline(lp.C) * rv.offset * (S.sunheeTrick ? CFG.sunheeBend : 1)) { rv.passed = true; rv.passedAt = now; staticDirty = true; } });
      if (person('sunhee') && run.m < 1 && !S.hints.sunhee) { S.hints.sunhee = true; after(1, function () { writeNote(WORLD.notes.toldYou, person('sunhee'), { type: 'paper', C: run.C, L: run.loss, dy: 12, dx: -10, key: 'toldyou2' }, { life: 8, optional: true }); }); }
      if (run.C >= CFG.gpt3C * CFG.miracleCTol && run.loss <= CFG.gpt3Loss * CFG.miracleTol && !S.miracle) {
        S.miracle = true; S.log.push(fmtDay(S.day) + ' MIRACLE');
        after(capsHit.length ? 0.6 : CFG.landCleanSec * 0.5, function () { lineMoment('miracle'); });
      }
    } else {
      S.stats.crossings++;
      S.scars.push({ from: Math.min(run.wallAt, run.C), to: run.C, t0: now + 0.3, line: run.lastFray || smp.text });
      after(0.3, function () { AU.hatch(900); });
    }
    var autoPub = run.clean && S.firstAuthor && S.day >= CFG.publishFromDay && has('priya');
    if (autoPub) { S.firstAuthor = false; run.author = 'Raman et al.'; S.checkpoint = { run: run, state: 'auto', sampleId: null }; }
    after(0.3, function () {
      var landSmp = capNew ? makeSample(run, 1, 'cap', capNew.id) : smp;
      run.bandText = (landSmp.momentText && landSmp.cap === 'paragraph') ? bandCut(landSmp.momentText) : landSmp.text;
      if (capsHit.length) capsHit.forEach(function (c, i) { capMoment(i === capsHit.length - 1 ? landSmp : makeSample(run, 1, 'cap', c.id), c, i < capsHit.length - 1); });
      else showBand(landSmp, 'rise');
      if (S.checkpoint && S.checkpoint.run === run) { S.checkpoint.sampleId = landSmp.id; if (S.checkpoint.state === 'up') el.sample.classList.add('flickable'); }
      if (run.clean && !autoPub) checkpointHints();
      if (autoPub) { var pr = person('priya'); if (pr) writeNote(WORLD.warn.firstAuthor + (has('lena') ? ' · press Lena to red-team it first' : ''), pr, { type: 'band', key: 'firstauthor' }, { life: CFG.firstAuthorHoldSec + 2 }); }
    });
    if (autoPub) {
      // a beat before it goes out, so pressing Lena can still send it to red-team
      var wait = 0.6 + CFG.firstAuthorHoldSec;
      var go = function () { if (moment.on) { after(0.5, go); return; } if (S.checkpoint && S.checkpoint.run === run && S.checkpoint.state === 'auto') { S.checkpoint = null; dropNoteKey('firstauthor'); liftWordsFx('up', run); publish(run, true); } };
      after(wait, go);
    }
    nib.t = 0;
    S.log.push(fmtDay(S.day) + ' land ' + sci(run.C) + ' L=' + run.loss.toFixed(3) + (run.clean ? ' clean' : ' PAST WALL') + (capsHit.length ? ' cap ' + capsHit.map(function (c) { return c.id; }).join('+') : ''));
  }
  function checkpointHints() {
    var p = person('priya') || staff()[0]; if (!p) return;
    if (!S.hints.publish && S.day >= CFG.publishFromDay) { S.hints.publish = true; writeNote(WORLD.notes.hintPublish, p, { type: 'band', key: 'hint' }, { life: 12 }); }
    else if (!S.hints.ship && S.day >= CFG.shipFromDay && canShip(S.checkpoint && S.checkpoint.run)) { S.hints.ship = true; writeNote(WORLD.notes.hintShip, p, { type: 'band', key: 'hint' }, { life: 12 }); }
    var lena = person('lena');
    if (lena && S.day >= CFG.publishFromDay) teach('redteam', fill(WORLD.teach.redteam, { days: S.shipped ? CFG.redTeamDaysApi : CFG.redTeamDays }), lena, { type: 'name', key: 'lena' }, 10);
  }

  /* ================= the checkpoint flick: publish, ship, vault ================= */
  function capsOn(run) { return S.caps.filter(function (c) { return c.fired && run.loss <= c.L; }); }
  function canShip(run) { return !!run && run.clean && S.day >= CFG.shipFromDay && capsOn(run).some(function (c) { return c.id === 'paragraph'; }); }
  function flickCheckpoint(dir) {
    var ck = S && S.checkpoint; if (!ck || ck.state !== 'up' || S.phase !== 'play') return false;
    // the flick acts only on the words that are on screen (Sid)
    if (ck.sampleId != null && S.bandSample && S.bandSample.id !== ck.sampleId) return false;
    dropNoteKey('hint');
    if (dir === 'up' && S.day < CFG.publishFromDay) return false;
    if (dir === 'right' && !canShip(ck.run)) return false;
    S.checkpoint = null; el.sample.classList.remove('flickable');
    var run = ck.run;
    if (dir === 'up') { liftWordsFx('up', run); publish(run); }
    else { liftWordsFx('right', run); ship(run); }
    AU.take();
    return true;
  }
  function publish(run, auto) {
    var apply = function () {
      run.published = true; run.withMer = false; S.stats.published++; S.lastPublishDay = S.day;
      staff().forEach(function (p) { if (p.ego >= 3) moodAdd(p, CFG.publishMoodEgo3); });
      if (run.author) moodAdd(person('priya'), CFG.publishMoodFirstAuthor - CFG.publishMoodEgo3);
      var C = run.C;
      S.events.push({ day: Math.floor(S.day) + CFG.rivalSlideDelay, fn: function () { S.rivals.forEach(function (rv) { var c = rivalC(rv, S.day); if (c < C) rv.extra += CFG.rivalSlideExp * (log10(C) - log10(c)); }); } });
      if (!run.redteamed) {
        var contaminated = capsOn(run).some(function (c) { return c.contaminated && CFG.noTestSet.indexOf(c.id) < 0; });
        var p = contaminated ? 1 : S.filtersDone > 0 ? CFG.scandalPublishFiltered : CFG.scandalPublish;
        if (rng() < p) S.events.push({ day: Math.floor(S.day) + Math.round(U(CFG.scandalDelay[0], CFG.scandalDelay[1])), fn: function () { scandal(run, 'publish'); } });
      }
      staticDirty = true; renderTeam();
      S.log.push(fmtDay(S.day) + ' publish ' + sci(run.C) + (auto ? ' (first author)' : ''));
    };
    if (S.mer) { run.withMer = true; staticDirty = true; S.events.push({ day: Math.floor(S.day) + CFG.meridianFirstLook, fn: apply }); }
    else apply();
  }
  function ship(run) {
    var apply = function () {
      if (S.shipped) { var old = S.runs.find(function (r) { return r.id === S.shipped.runId; }); if (old) old.shipped = false; }
      var caps = capsOn(run), rev = 0; caps.forEach(function (c) { rev = Math.max(rev, CFG.capRevenue[c.id]); });
      run.shipped = true; run.withMer = false; S.shipped = { runId: run.id, rev: rev }; S.stats.shipped++;
      if (!run.redteamed && rng() < CFG.scandalShip) S.events.push({ day: Math.floor(S.day) + Math.round(U(CFG.scandalDelay[0], CFG.scandalDelay[1])), fn: function () { scandal(run, 'ship'); } });
      staticDirty = true;
      S.log.push(fmtDay(S.day) + ' ship ' + sci(run.C) + ' rev ' + rev);
    };
    if (S.mer) { run.withMer = true; staticDirty = true; S.events.push({ day: Math.floor(S.day) + CFG.meridianFirstLook, fn: apply }); }
    else apply();
  }
  function startRedteam() {
    var ck = S.checkpoint; if (!ck) return;
    var days = S.shipped ? CFG.redTeamDaysApi : CFG.redTeamDays;
    S.redteam = { until: Math.floor(S.day) + days, runId: ck.run.id, firstAuthor: ck.state === 'auto' };
    ck.state = 'redteam'; el.sample.classList.remove('flickable');
    dropNoteKey('lena'); dropNoteKey('firstauthor');
    writeNote('red-team: ' + plural(days, 'day'), person('lena'), { type: 'name', key: 'lena' });
    renderTeam();
    S.log.push(fmtDay(S.day) + ' red-team starts');
  }
  function finishRedteam() {
    var rt = S.redteam; S.redteam = null;
    var run = S.runs.find(function (r) { return r.id === rt.runId; });
    if (run && rt.firstAuthor) { run.redteamed = true; if (S.checkpoint && S.checkpoint.run === run) S.checkpoint = null; publish(run, true); renderTeam(); return; }
    // a newer landing is up: it keeps the band; the red-teamed one stays in the vault (C's bug: never replace the newer one)
    if (run && S.checkpoint && S.checkpoint.run !== run && S.checkpoint.state === 'up') { run.redteamed = true; var l2 = person('lena'); if (l2) writeNote('red-teamed the older one. it’s in the vault', l2, { type: 'name', key: 'lena' }, { life: 6 }); renderTeam(); return; }
    if (run) {
      run.redteamed = true;
      // the words come back up, safe to show, and can be flicked until the next lift (or until a new sample replaces them)
      S.checkpoint = { run: run, state: 'up', sampleId: null, afterRedteam: true, backAt: now };
      var orig = run.bandText || run.landText, smp = makeSample(run, 1, 'land'); smp.text = orig || smp.text; smp.fray = 0; run.landText = orig || run.landText;
      S.checkpoint.sampleId = smp.id; showBand(smp, 'rise'); el.sample.classList.add('flickable');
      var lena = person('lena'); if (lena) writeNote('red-teamed. flick it when you like', lena, { type: 'band', key: 'hint' }, { life: 8 });
    }
    renderTeam();
  }
  function scandal(run, kind) {
    // the copy names what actually leaked; a scandal with no leak is a plain failure to reproduce
    var leaked = capsOn(run).filter(function (c) { return c.contaminated; });
    run.scandal = kind === 'ship' ? WORLD.scandalNotes.ship : leaked.length ? WORLD.scandalNotes[leaked[leaked.length - 1].id] || WORLD.scandalNotes.generic : WORLD.scandalNotes.generic;
    S.lastScandal = { day: S.day, what: run.scandal };
    S.runs.forEach(function (r) { if (r !== run && r.scandal) r.scandalOld = true; });
    var who = person('lena') || person('priya') || staff()[0];
    if (who) writeNote(fill(WORLD.warn.scandal, { what: run.scandal }), who, { type: 'door', key: 'scandal' }, { life: 14, wrap: true });
    withdrawTerms(); S.termBlockUntil = S.day + CFG.scandalTermBlockDays;
    if (S.shipped && kind === 'ship') { var r = S.runs.find(function (x) { return x.id === S.shipped.runId; }); if (r) r.shipped = false; S.shipped = null; }
    if (S.shipped && kind === 'publish') { var r2 = S.runs.find(function (x) { return x.id === S.shipped.runId; }); if (r2) r2.shipped = false; S.shipped = null; }
    moodAdd(person('priya'), -CFG.scandalMood); moodAdd(person('lena'), -CFG.scandalMood);
    S.scandalSilentMonth = monthOf(S.day) + 1;
    staticDirty = true; AU.strike();
    S.log.push(fmtDay(S.day) + ' SCANDAL ' + kind);
  }

  /* ================= capabilities, evals on the 3rd, moments ================= */
  function fireCapFx(c) {
    staff().forEach(function (p) { moodAdd(p, CFG.capMood); });
    var testable = CFG.noTestSet.indexOf(c.id) < 0;
    if (S.filtersDone === 0 && testable && rng() < CFG.contamination) {
      c.contaminated = true;
      if (has('lena')) after(CFG.momentSec + 0.6, function () { writeNote(WORLD.notes.leak, person('lena'), { type: 'band', key: 'leak' }, { life: 12 }); });
    }
    // no hidden trap: Priya knows the crawl was never filtered, even if nobody knows yet whether the test set is in it
    if (S.filtersDone === 0 && testable && !has('lena') && !S.hints.contam) { S.hints.contam = true; var pr = person('priya') || person('ines'); if (pr) after(CFG.momentSec + 0.8, function () { writeNote(WORLD.warn.contamRisk, pr, { type: 'band', key: 'contam' }, { life: 10 }); }); }
    S.log.push(fmtDay(S.day) + ' capability ' + c.id + (c.contaminated ? ' (contaminated)' : ''));
  }
  function evalsReading(run, s) {
    if (S.phase !== 'play') return;
    if (s * run.r > 1) return;
    var q = Math.pow(s, 1.5), L = lossAt(run, q), hit = [];
    S.caps.forEach(function (c) { if (!c.fired && L <= c.L) { c.fired = true; hit.push(c); } });
    hit.forEach(function (c, i) { fireCapFx(c); var smp = makeSample(run, q, 'cap', c.id); capMoment(smp, c, i < hit.length - 1); });
  }
  var moment = { on: false };
  function capMoment(smp, cap, more) {
    if (moment.on) { after(0.5, function () { capMoment(smp, cap, more); }); return; } // one moment at a time, lowest first
    var text = smp.momentText || smp.text;
    moment = { on: true, t0: now, kind: 'cap' };
    el.momentText.className = cap.id === 'code' ? 'code' : '';
    el.momentText.textContent = '';
    var spans = [];
    text.split('\n').forEach(function (line, li) {
      if (li) el.momentText.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (w, i) { if (i) el.momentText.appendChild(document.createTextNode(' ')); var sp = document.createElement('span'); sp.textContent = w; sp.style.opacity = reduced() ? '1' : '0'; el.momentText.appendChild(sp); spans.push(sp); });
    });
    moment.spans = spans; moment.shown = reduced() ? spans.length : 0;
    el.moment.classList.remove('out'); el.moment.classList.add('on');
    AU.scratch(0);
    var words = 0.4 + (reduced() ? 0 : spans.length * CFG.wordMs / 1000);
    after(words + 0.08, function () { AU.duckSilence(80, 1000, 600); });
    after(words + 1.1, function () { el.moment.classList.add('out'); el.moment.classList.remove('on'); if (!more) { showBand(smp, 'instant'); if (S.checkpoint && S.checkpoint.state === 'up' && S.checkpoint.sampleId === smp.id) el.sample.classList.add('flickable'); } });
    after(Math.max(CFG.momentSec, words + 1.7), function () { moment = { on: false }; });
  }
  var momentCls = false;
  function stepMoment() {
    // a letter cannot be answered while a moment holds the sheet: it fades back so a thumb waits instead of failing
    if (momentCls !== moment.on) { momentCls = moment.on; root.classList.toggle('inmoment', moment.on); }
    if (!moment.on || !moment.spans) return;
    var k = Math.floor((now - moment.t0 - 0.4) / (CFG.wordMs / 1000)) + 1;
    while (moment.shown < moment.spans.length && moment.shown < k) { moment.spans[moment.shown++].style.opacity = '1'; AU.token(); }
  }
  function hasLine() { var cr = cleanRuns(); if (cr.length < 2) return false; var lo = Infinity, hi = 0; cr.forEach(function (r) { lo = Math.min(lo, r.C); hi = Math.max(hi, r.C); }); return hi >= lo * 10; }
  // 28 May and the miracle: everything but your line, your dots and their point dims; a silent second
  function lineMoment(kind) {
    if (moment.on) { after(0.5, function () { lineMoment(kind); }); return; }
    moment = { on: true, t0: now, kind: kind };
    root.classList.remove('undim'); root.classList.add('dim28'); root.classList.toggle('keephead', kind === 'gpt3'); staticDirty = true; dimFx = { t0: now, dir: 1 };
    AU.scratch(0);
    after(0.4, function () { AU.duckSilence(80, 1000, 600); });
    after(CFG.momentSec - 0.6, function () { root.classList.add('undim'); root.classList.remove('dim28'); dimFx = { t0: now, dir: -1 }; staticDirty = true; });
    after(CFG.momentSec, function () { moment = { on: false }; root.classList.remove('keephead'); staticDirty = true; if (kind === 'gpt3') afterGpt3(); });
  }
  // after 28 May: Ayaan's 'told you', and the new bar for being read, written down before it can bite
  function afterGpt3() {
    if (has('ayaan')) writeNote(WORLD.notes.toldYou, person('ayaan'), { type: 'paper', C: CFG.gpt3C, L: Lline(CFG.gpt3C), dy: -30, dx: -64, key: 'toldyou' }, { life: 8, optional: true });
    var need = frontier() * CFG.relevanceShare;
    if (worldView() < need) { var who = person('priya') || staff()[0]; if (who) after(1.2, function () { writeNote(fill(WORLD.warn.gpt3Bar, { need: sciP(need) }), who, { type: 'door', key: 'gpt3bar' }, { life: 16, wrap: true }); }); }
  }

  /* ================= history ================= */
  // a headline is shown on its own date, every time: it settles at the top of the paper and holds; a newer one replaces it
  function fireNews(n) {
    var day = iso(n[0]);
    headline(fmtDay(day, true) + ' · ' + n[1]);
    S.rulerPhrases.push({ day: day, text: n[2], t: now }); staticDirty = true;
    switch (n[3]) {
      case 'line':
        S.lineShown = true; S.lineAt = now; AU.feed(1200);
        // the ring is what you chase: the first year of a sitting labels it, in pencil, until 28 May
        if (!TAUGHT.all && !TAUGHT.ring) { TAUGHT.ring = true; S.ringTeach = true; }
        break;
      case 'crash': withdrawTerms(); break;
      case 'gpt3':
        // the headline settles first, then the point presses in: 'you were right' arrives with its explanation on screen
        S.beatUntil = now + CFG.beatGpt3Sec;
        after(CFG.beatGpt3Sec - 0.3, function () { S.gpt3 = true; S.gpt3At = now; staticDirty = true; if (hasLine()) lineMoment('gpt3'); else afterGpt3(); });
        break;
    }
  }
  function headline(text) { if (S) S.heads.push({ text: text, day: S.day }); }
  var headNow = null;
  function stepHeads() {
    if (!S) return;
    if (S.heads.length) {
      var hd = S.heads.pop(); S.heads = []; // only the newest matters: history is never shown late
      if (headNow && headNow.el.parentNode) { var old = headNow.el; old.classList.add('out'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 300); }
      var d = document.createElement('div');
      d.className = 'h'; d.textContent = hd.text; el.heads.appendChild(d);
      void d.offsetWidth; d.classList.add('in');
      headNow = { el: d, born: now };
    }
    // a headline holds for its seven seconds of real time, frozen moments and end frames included, then fades
    if (headNow && now - headNow.born > CFG.headlineHoldSec && !(moment.on && moment.kind === 'gpt3') && !(S.phase === 'over')) {
      var e2 = headNow.el; headNow = null; e2.classList.add('out'); setTimeout(function () { if (e2.parentNode) e2.parentNode.removeChild(e2); }, 600);
    }
  }

  /* ================= rivals ================= */
  function rivalPublish(rv) { rv.pubs.push({ C: rivalC(rv, S.day), day: S.day, t: now }); rv.passed = false; staticDirty = true; }

  /* ================= endings ================= */
  function endYear(kind, extra) {
    if (!S || S.phase !== 'play') return;
    S.phase = 'over'; S.ended = { kind: kind, day: S.day, extra: extra || {} };
    S.endFx = { kind: kind, t0: now };
    if (kind === 'survived' && S.choice == null && ((S.letter && S.letter.kind === 'december') || S.queue.some(function (q) { return q.kind === 'december'; }))) S.choice = 'fought';
    S.queue = []; if (S.letter && S.letter.dom) { var d = S.letter.dom; d.classList.remove('in'); d.classList.add('pass'); } S.letter = null; AU.fuse(false);
    if (nib.drag) { nib.drag = false; el.strip.classList.remove('grabbing'); }
    AU.nib(0); AU.scratch(0);
    el.readout.classList.remove('on'); el.monthsL.textContent = 'MONTHS'; lastProj = '';
    if (kind === 'bankrupt') {
      S.bank = Math.min(S.bank, 0); AU.windDown(1.2);
      root.classList.add('dry');
      staff().forEach(function (p, i) { after(i * 0.12, function () { p.gone = true; p.struckAt = now; p.goneDay = S.day; renderTeam(); AU.strike(); }); });
    } else if (kind === 'bought') {
      el.lab.classList.add('struck'); AU.motor('off', 0, 1.2); root.classList.add('sold');
      after(0.6, function () { el.bought.textContent = 'HALCYON'; void el.bought.offsetWidth; el.bought.classList.add('on'); AU.write(500); });
    } else if (kind === 'forgotten') {
      AU.motor('off', 0, 2); root.classList.add('dry');
    } else {
      AU.motor('off', 0, 0.3); if (S.run) { S.run.cut = true; S.hang = null; }
    }
    staticDirty = true;
    el.hour.textContent = ''; el.readout.classList.remove('on');
    S.notes.forEach(function (x) { if (!x.keep) fadeNote(x); }); S.notes = S.notes.filter(function (x) { return x.keep; });
    var info = endExplain(kind, extra || {});
    S.endInfo = info;
    root.setAttribute('aria-label', 'Frontier. The year has ended. ' + info.head + '. ' + info.lines.join(' ') + ' Tap for a fresh year.');
    S.log.push(fmtDay(S.day) + ' END ' + kind + ' :: ' + info.lines.join(' '));
    // the year's best dot carries into the next sheet as a faint ghost
    var far = farthestClean(); if (far > 0) { var fr = S.runs.filter(function (r) { return r.clean && r.C === far; })[0]; GHOST = { C: far, L: fr ? fr.loss : Lline(far) }; }
    var showAt = kind === 'bankrupt' ? 1.4 : kind === 'forgotten' ? 1.6 : kind === 'bought' ? 1.0 : 0.6;
    after(showAt, function () { showEnd(info); });
    S.endTapAt = now + Math.max(CFG.endHoldMinSec, showAt + 1.5);
    after(CFG.endAutoSec, function () { if (S && S.phase === 'over') feedNewYear(); });
  }
  // one or two plain sentences: why the year ended, and how close it came to GPT-3
  function endExplain(kind, extra) {
    var E = WORLD.ends, lines = [], far = farthestClean(), ld = S.lastPayroll;
    var monthName = function (d) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][dateOf(d).getUTCMonth()]; };
    if (kind === 'bankrupt') {
      lines.push(fill(E.bankrupt, { date: fmtShort(S.day), pay: money(ld ? ld.pay : payroll()), bank: money(Math.max(0, ld ? ld.bankBefore : S.bank)), burn: money(ld ? ld.burn : burn()), rent: ld && ld.rent > 1000 ? fill(E.bankruptRent, { rent: money(ld.rent) }) : '' }));
    } else if (kind === 'bought') {
      var mv = monthsVal(); lines.push(fill(extra.board ? E.boughtBoard : E.bought, { months: mv < 1 ? 'less than one' : fmtMonths(mv), price: money(extra.price || 0) }));
    } else if (kind === 'forgotten') {
      var sl = S.silentLog.slice(-2), m1 = monthName(sl[0] ? sl[0].day : S.day - 30), m2 = monthName(S.day);
      var need = frontier() * CFG.relevanceShare, pub = farthestPublished();
      var scandalHit = sl.some(function (x) { return x.why === 'scandal'; }) && S.lastScandal;
      if (scandalHit) lines.push(fill(E.forgottenScandal, { m1: m1, m2: m2, what: S.lastScandal.what, need: sciP(need) }));
      else lines.push(fill(pub > 0 ? E.forgotten : E.forgottenNone, { m1: m1, m2: m2, need: sciP(need), pub: sciP(pub) }));
    } else {
      var n = staff().length;
      lines.push(fill(E.survived, { months: fmtMonths(monthsVal()), people: n === 1 ? 'one person' : n + ' people' }));
    }
    if (S.miracle) lines.push(E.gapMiracle);
    else if (far <= 0) lines.push(E.gapNone);
    else if (far >= CFG.gpt3C * 0.9) lines.push(fill(E.gapNear, { far: sciP(far), pct: Math.max(1, Math.round((1 - far / CFG.gpt3C) * 100)) + '%' }));
    else lines.push(fill(E.gap, { far: sciP(far), ratio: ratioWord(CFG.gpt3C / far), gpt3: '3.14e23' }));
    return { kind: kind, head: E.head[kind] + ' · ' + fmtDay(Math.min(S.day, CFG.endDay), true), lines: lines };
  }
  function showEnd(info) {
    if (!S || S.phase !== 'over') return;
    el.end.textContent = '';
    var h = document.createElement('div'); h.className = 'eh'; h.textContent = info.head; el.end.appendChild(h);
    info.lines.forEach(function (t) { var p = document.createElement('p'); p.textContent = t; el.end.appendChild(p); });
    var a = document.createElement('div'); a.className = 'ea'; a.textContent = WORLD.ends.again; el.end.appendChild(a);
    el.end.classList.add('on');
    AU.write(600);
  }
  // the paper feeds out to the left and a fresh 1 January slides in from the right
  function feedNewYear() {
    if (!S || S.feeding) return;
    S.feeding = true;
    el.end.classList.remove('on');
    var nextSeed = seedFromHash() != null ? (S.seed + 1) : null;
    AU.feed(900);
    if (reduced()) { root.classList.add('feedout'); setTimeout(function () { newYear(nextSeed); layout(); root.classList.remove('feedout'); }, 320); return; }
    root.classList.add('feedout');
    var gen = GEN;
    setTimeout(function () {
      if (gen !== GEN) return;
      newYear(nextSeed);
      root.classList.remove('feedout'); root.classList.add('feedin-start'); void root.offsetWidth;
      layout(); drawAll();
      root.classList.remove('feedin-start'); root.classList.add('feedin'); AU.feed(900);
      setTimeout(function () { root.classList.remove('feedin'); }, 950);
    }, 920);
  }
  function inkFade() {
    var fx = S && S.endFx; if (!fx) return { u: 0, a: 1 };
    var t = now - fx.t0;
    if (fx.kind === 'bankrupt') return { u: clamp(t / 1.2, 0, 1), a: 1 };
    if (fx.kind === 'forgotten') return { u: clamp(t / 2, 0, 1), a: 1 };
    if (fx.kind === 'bought') return { u: 0, a: lerp(1, 0.35, clamp(t / 0.8, 0, 1)) };
    return { u: 0, a: 1 };
  }
  var dimFx = null;
  function dimLevel() { // 1 = full, 0.08 = dimmed (28 May and the miracle)
    if (!dimFx) return 1;
    var u = dimFx.dir > 0 ? clamp((now - dimFx.t0) / 0.4, 0, 1) : 1 - clamp((now - dimFx.t0) / 0.6, 0, 1);
    if (dimFx.dir < 0 && u <= 0) { dimFx = null; return 1; }
    return lerp(1, 0.08, u);
  }
  function INK(alpha) { var f = inkFade(); return mix('ink', 'dry', f.u, (alpha == null ? 1 : alpha) * f.a * dimLevel()); }
  function LINEINK(alpha) { var f = inkFade(); return mix('ink', 'dry', f.u, (alpha == null ? 1 : alpha) * f.a); }
  function GR(alpha, keepDark) { var f = keepDark ? { u: 0 } : inkFade(); return mix('graphite', 'dry', f.u * 0.6, (alpha == null ? 1 : alpha) * dimLevel()); }

  /* ================= the asleep frame and the power switch ================= */
  function power() {
    if (!S || S.powered) return;
    S.powered = true; S.phase = 'play'; S.poweredAt = now;
    AU.unlock(); AU.motor('idle', 0, 0.8);
    cells.wake = now;
    root.classList.remove('asleep');
    root.setAttribute('aria-label', 'Frontier. Drag the nib on the strip and let go to launch a run. Flick letters up to take them, down to let them go.');
    el.lab.textContent = 'FRONTIER'; el.today.textContent = fmtDay(0, true);
    staticDirty = true; S.rivalsShown = now + 0.5;
    var pr = person('priya'); if (pr) pr.inkAt = now + 0.45;
    renderTeam();
    dropNoteKey('teach-asleep');
    after(1.4, function () { if (S.month < 0) startMonth(0); });
    // the goal, in Priya's hand, on the sheet itself: what the figures are and what a year asks of you
    after(1.9, function () {
      teach('months', WORLD.teach.months, pr, { type: 'months', key: 'teach-months' }, 0, true);
      teach('cards', WORLD.teach.cards, pr, { type: 'cluster', key: 'teach-cards' }, 0, true);
      teach('goal', WORLD.teach.goal, pr, { type: 'goal', key: 'teach-goal', dy: 26 }, 0, true, { wrapGoal: true });
    });
  }
  // the opening lessons leave once the year is under way
  function retireOpeningLessons() { ['teach-months', 'teach-cards', 'teach-goal'].forEach(dropNoteKey); }

  /* ================= samples ================= */
  function bag(name, pool) { var b = S.bags[name]; if (!b || !b.length) b = S.bags[name] = shuffle(pool.slice()); return b.pop(); }
  function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
  // the band holds three lines at most: the words are cut at a sentence, or at a word with an ellipsis
  function bandMax() { if (!L.band || !L.band.w) return CFG.bandMaxChars; var w = Math.min(L.band.w, L.laptop ? 760 : 9999); return clamp(Math.floor(w / (L.laptop ? 8.9 : 7.9)) * 3 - 10, 90, 230); }
  function bandCut(txt, max) {
    max = max || bandMax();
    if (txt.indexOf('\n') >= 0) return txt;
    if (txt.length <= max) return txt;
    var parts = sentences(txt), out = '';
    for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > max) break; out += parts[i]; }
    out = out.trim();
    if (out.length > max) { var ws = out.split(' '), o2 = ''; for (var j = 0; j < ws.length; j++) { if ((o2 + ' ' + ws[j]).trim().length > max - 1) break; o2 = (o2 + ' ' + ws[j]).trim(); } out = o2.replace(/[,;:]$/, '') + '…'; }
    return out;
  }
  function tierOf(Lv) { if (Lv > CFG.tierStatic) return 0; if (Lv > CFG.tierWords) return 1; if (Lv > CFG.tierGrammar) return 2; var para = S.caps[0]; return (para.fired && Lv <= para.L) ? 4 : 3; }
  function pickT3(Lv) {
    var want = Lv > CFG.t3Sense[0] ? 1 : Lv > CFG.t3Sense[1] ? 2 : 3, order = want === 1 ? [1, 2, 3] : want === 2 ? [2, 3, 1] : [3, 2, 1];
    for (var pass = 0; pass < 2; pass++) {
      for (var o = 0; o < 3; o++) { var cand = []; CORPUS.t3.forEach(function (e, i) { if (e[0] === order[o] && !S.t3used[i]) cand.push(i); }); if (cand.length) { var i = pick(cand); S.t3used[i] = 1; return CORPUS.t3[i][1]; } }
      S.t3used = {};
    }
    return CORPUS.t3[0][1];
  }
  function pickT4(momentGrade) {
    for (var pass = 0; pass < 2; pass++) {
      var cand = []; CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i] && (!momentGrade || e[0] === 1)) cand.push(i); });
      if (!cand.length && momentGrade) CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i]) cand.push(i); });
      if (cand.length) { var i = pick(cand); S.t4used[i] = 1; return CORPUS.t4[i][1]; }
      S.t4used = {};
    }
    return CORPUS.t4[0][1];
  }
  function pickLow(tier) {
    if (tier === 0) return bag('t0', CORPUS.t0);
    if (tier === 1) return bag('t1', CORPUS.t1);
    if (S.day >= CFG.covidStringDay && !S.covidIn) { S.covidIn = true; S.bags.t2 = shuffle(CORPUS.t2.concat([CORPUS.t2Covid])); }
    return bag('t2', S.covidIn ? CORPUS.t2.concat([CORPUS.t2Covid]) : CORPUS.t2);
  }
  function crawlLine() {
    var pool = shuffle(CORPUS.crawl.slice()), out = '', mx = Math.min(150, bandMax());
    for (var i = 0; i < pool.length; i++) { var next = out ? out + ' | ' + pool[i] : pool[i]; if (out && next.length > mx) continue; out = next; if (out.length >= mx * 0.62) break; }
    return out;
  }
  var PUNCT_END = /[.,;:!?»)\]"”’…]$/, PUNCT_START = /^[(\["“‘«.,;:!?…]/;
  // fray: exactly k distinct fragments, at word gaps in the middle 80%, never beside punctuation or each other
  function splice(text, k) {
    if (!(k > 0) || k >= CRAWL) return text;
    var words = text.split(' '), n = words.length, i, j, gaps = [];
    for (i = 0; i < n - 1; i++) {
      var pos = (i + 1) / n; if (pos < 0.1 || pos > 0.9) continue;
      if (PUNCT_END.test(words[i]) || PUNCT_START.test(words[i + 1]) || /\n/.test(words[i]) || /\n/.test(words[i + 1]) || /:$/.test(words[i])) continue;
      gaps.push(i);
    }
    if (!gaps.length) for (i = 0; i < n - 1; i++) gaps.push(i);
    var chosen = [];
    if (k === 1) { var mid = gaps.filter(function (g) { var q = (g + 1) / n; return q >= 0.3 && q <= 0.7; }); chosen = [pick(mid.length ? mid : gaps)]; }
    else {
      for (var attempt = 0; attempt < 40; attempt++) {
        chosen = [];
        for (j = 0; j < k; j++) { var lo = Math.floor(j * gaps.length / k), hi = Math.max(lo + 1, Math.floor((j + 1) * gaps.length / k)); chosen.push(gaps[Math.min(gaps.length - 1, lo + Math.floor(rng() * (hi - lo)))]); }
        var ok = true; for (j = 1; j < chosen.length; j++) if (chosen[j] - chosen[j - 1] < 2) ok = false;
        if (ok) break;
      }
      chosen = chosen.filter(function (g, ix) { return chosen.indexOf(g) === ix; });
    }
    var frags = shuffle(CORPUS.fray.slice()).slice(0, k), out = [], fi = 0;
    for (i = 0; i < n; i++) { out.push(words[i]); for (j = 0; j < chosen.length; j++) if (chosen[j] === i && fi < frags.length) out.push(frags[fi++]); }
    return out.join(' ');
  }
  var sampleSeq = 0;
  // samples draw from their own random stream, so reading more (or less) never changes the year's hidden luck
  function makeSample(run, q, kind, capId) { var keep = rng; rng = wrng; try { return makeSampleInner(run, q, kind, capId); } finally { rng = keep; } }
  function makeSampleInner(run, q, kind, capId) {
    // the data a checkpoint has eaten follows the card-days done (s), not the pen's display warp (Karpathy)
    var s = Math.pow(clamp(q, 0, 1), 1 / 1.5);
    var Lv = q >= 1 ? run.loss : lossAt(run, q), tier = tierOf(Lv), amt = amount(s * run.r);
    var text, mtext = null, cap = null, full;
    if (capId) tier = Math.max(tier, 3);
    if (tier >= 3 && amt === CRAWL) text = crawlLine();
    else if (tier >= 3) {
      if (capId) { full = capId === 'paragraph' ? pickT4(true) : bag(capId, CORPUS[capId]); cap = capId; }
      else {
        var elig = S.caps.filter(function (c) { return c.fired && c.id !== 'paragraph' && Lv <= c.L; });
        if (elig.length && rng() < CFG.capSampleShare) { var c = pick(elig); full = bag(c.id, CORPUS[c.id]); cap = c.id; }
        else full = tier === 4 ? pickT4(false) : pickT3(Lv);
      }
      text = splice(bandCut(full, bandMax() - amt * 15), amt);
      // code that cannot run is no capability: in code the junk arrives as comment lines, the function stays whole
      if (capId) mtext = cap === 'code' ? full + (amt > 0 ? '\n' + shuffle(CORPUS.fray.slice()).slice(0, amt).map(function (f) { return '# ' + f; }).join('\n') : '') : splice(full, amt);
      if (cap === 'code' && amt > 0) text = bandCut(full) + '\n# ' + CORPUS.fray[Math.floor(rng() * CORPUS.fray.length)];
    } else { text = pickLow(tier); amt = 0; }
    if (kind === 'land') run.landText = text;
    return { id: ++sampleSeq, text: text, momentText: mtext, tier: tier, fray: amt, crawl: amt === CRAWL, cap: cap, q: q, C: s * run.C, kind: kind, loss: Lv, launchDay: run.launchDay };
  }

  /* ================= the band ================= */
  var band = null;
  function showBand(smp, mode) {
    S.bandSample = smp;
    if (S.offer && S.offer.sampleId !== smp.id && S.offer.keep !== true) S.offer = null;
    el.sample.classList.toggle('code', smp.cap === 'code');
    el.sample.style.transition = 'none'; el.sample.style.opacity = '1'; el.sample.style.transform = '';
    el.sample.textContent = '';
    var spans = [], frag = document.createDocumentFragment();
    smp.text.split('\n').forEach(function (line, li) {
      if (li) frag.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (w, i) { if (i) frag.appendChild(document.createTextNode(' ')); var sp = document.createElement('span'); sp.textContent = w; sp.style.opacity = '0'; frag.appendChild(sp); spans.push(sp); });
    });
    el.sample.appendChild(frag);
    if (reduced() || speedMult > 6 || mode === 'instant') { spans.forEach(function (s) { s.style.opacity = '1'; }); band = null; }
    else band = { spans: spans, t0: now, shown: 0 };
    if (mode === 'rise' && !reduced()) {
      el.sample.style.transform = 'translate3d(0,14px,0)'; void el.sample.offsetWidth;
      el.sample.style.transition = 'transform .32s cubic-bezier(.2,.7,.25,1)'; el.sample.style.transform = 'none';
    }
    noticeSample(smp);
  }
  function stepBand() {
    if (!band) return;
    var k = Math.min(band.spans.length, Math.floor((now - band.t0) / (CFG.wordMs / 1000)) + 1), ticked = false;
    while (band.shown < k) { band.spans[band.shown++].style.opacity = '1'; if (!ticked) { AU.token(); ticked = true; } }
    if (band.shown >= band.spans.length) band = null;
  }
  function sinkBand() {
    band = null;
    if (reduced()) { el.sample.textContent = ''; return; }
    el.sample.style.transition = 'transform .4s ease-in, opacity .4s linear'; el.sample.style.transform = 'translate3d(0,18px,0)'; el.sample.style.opacity = '0';
  }
  // publish lifts the words toward their dot; ship slides them off the right edge
  function liftWordsFx(dir, run) {
    band = null;
    if (reduced()) { el.sample.style.transition = 'opacity .2s linear'; el.sample.style.opacity = '0'; return; }
    if (dir === 'up') {
      var r = el.sample.getBoundingClientRect(), tx = 0, ty = -80;
      if (run && L.plot) { var pr = el.paper.getBoundingClientRect(); var dx = pr.left + X(log10(run.C)), dy = pr.top + Y(Math.log(run.loss)); tx = dx - (r.left + r.width * 0.3); ty = dy - (r.top + r.height * 0.6); }
      el.sample.style.transition = 'transform .5s cubic-bezier(.45,0,.75,.4), opacity .5s cubic-bezier(.6,0,1,1)';
      el.sample.style.transform = 'translate3d(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px,0) scale(.12)';
    } else {
      el.sample.style.transition = 'transform .4s cubic-bezier(.5,0,.8,.3), opacity .4s linear';
      el.sample.style.transform = 'translate3d(110%,0,0)';
    }
    el.sample.style.opacity = '0';
  }

  /* ================= notes: your people write on the paper ================= */
  // anchors: 'paper' (C,L or x,y on the log paper), 'pen' (where the pen is now), 'band' (beside the words),
  // 'name' (beside a name), 'names' (under the margin), 'stop' (above the strip), 'strip' (above the strip's home end),
  // 'cluster' (above the card band), 'months' (under the months figure), 'door' (the empty letter zone), 'goal' (on the paper)
  // A key makes a note the only one of its kind: writing it again replaces it. life: seconds until it fades away.
  function writeNote(text, p, anchor, opts) {
    if (!S) return null;
    opts = opts || {};
    anchor = anchor || { type: 'band' };
    var key = anchor.key || null;
    var n = document.createElement('div');
    n.className = 'fr-note' + (opts.typed ? ' typed' : '') + (opts.keep ? ' keep' : '') + (opts.ring ? ' ring' : '') + (opts.pencil ? ' pencil' : '') + (opts.wrap ? ' wrap' : '') + (opts.teach ? ' teach' : '') + (anchor.type === 'door' ? ' door' : '') + (anchor.type === 'cluster' ? ' at-cluster' : '') + (anchor.type === 'goal' || (anchor.type === 'paper' && opts.typed) ? ' goalw' : '');
    var chars = [];
    for (var i = 0; i < text.length; i++) { var c = document.createElement('span'); c.className = 'c'; c.textContent = text[i]; n.appendChild(c); chars.push(c); }
    el.notes.appendChild(n);
    var note = { el: n, chars: chars, shown: 0, anchor: anchor, born: now, keep: !!opts.keep, who: p ? p.key : null, life: opts.life || 0, key: key, text: text, wrap: !!opts.wrap, optional: !!opts.optional };
    if (note.anchor.type === 'pen') {
      var run = S.run, pt = run && run.pts[run.pts.length - 1];
      note.anchor = pt ? { type: 'paper', x: pt[0], y: pt[1], dy: anchor.dy == null ? 18 : anchor.dy, dx: anchor.dx, key: key } : { type: 'band', key: key };
    }
    // one voice per place and kind: a keyed note replaces its last copy; an unkeyed note in the band, at a name, at the
    // stop or by the cluster replaces the last one there
    S.notes = S.notes.filter(function (x) {
      var same = key ? x.key === key : (!x.key && !x.keep && x.anchor.type === note.anchor.type && note.anchor.type !== 'paper' && x.anchor.key === note.anchor.key);
      if (same || (x.text === text && !x.keep)) { fadeNote(x); return false; }
      return true;
    });
    if (note.anchor.type === 'band') { var bands = S.notes.filter(function (x) { return !x.gone && x.anchor.type === 'band'; }); while (bands.length >= 2) { var old = bands.shift(); fadeNote(old); S.notes = S.notes.filter(function (o) { return o !== old; }); } }
    S.notes.push(note);
    placeNote(note);
    if (reduced()) { chars.forEach(function (c) { c.className = 'c on'; }); note.shown = chars.length; }
    AU.write(Math.min(1200, text.length * CFG.noteCharSec * 1000));
    return note;
  }
  // a lesson is written once per sitting, the first time its verb matters, and leaves when the verb is used
  function teach(key, text, who, anchor, life, sticky, opts) {
    if (TAUGHT.all || TAUGHT[key]) return null;
    TAUGHT[key] = true;
    opts = opts || {}; opts.teach = true;
    opts.life = life || (sticky ? 0 : CFG.teachHoldSec);
    return writeNote(text, who, anchor, opts);
  }
  function dropNote(x) { if (!x || x.gone) return; fadeNote(x); S.notes = S.notes.filter(function (o) { return o !== x; }); }
  function dropNoteKey(k) { if (!S) return; S.notes = S.notes.filter(function (o) { if (o.key === k) { fadeNote(o); return false; } return true; }); }
  function noteHit(n, x, y, w, h) {
    var hitNote = S.notes.some(function (o) { return o !== n && o.box && !o.gone && x < o.box.x + o.box.w + 4 && x + w + 4 > o.box.x && y < o.box.y + o.box.h && y + h > o.box.y; });
    if (hitNote) return true;
    var lb = L.landLabel; if (lb && (n.anchor.type === 'strip' || n.anchor.type === 'stop') && x < lb.x + lb.w && x + w > lb.x && y < lb.y + lb.h && y + h > lb.y) return true;
    if (L.readoutBox && el.readout.classList.contains('on')) { var rb = L.readoutBox; if (x < rb.x + rb.w + 4 && x + w > rb.x - 4 && y < rb.y + rb.h && y + h > rb.y) return true; }
    if (L.occ && L.paper) { var px = x - L.paper.x, py = y - L.paper.y; for (var i = 0; i < L.occ.length; i++) { var o = L.occ[i]; if (px < o.x + o.w && px + w > o.x && py < o.y + o.h && py + h > o.y) return true; } }
    return false;
  }
  function fadeNote(x) { x.gone = true; x.el.style.opacity = '0'; setTimeout(function () { if (x.el.parentNode) x.el.parentNode.removeChild(x.el); }, 900); }
  function stepNotes() {
    var moved = false;
    S.notes = S.notes.filter(function (n) {
      var k = Math.min(n.chars.length, Math.floor((now - n.born) / CFG.noteCharSec) + 1);
      while (n.shown < k) { n.chars[n.shown++].className = 'c on'; }
      if (!n.faded && !n.wrap && !n.el.classList.contains('teach') && now - n.born > CFG.noteFadeSec) { n.faded = true; n.el.classList.add('faded'); }
      if (n.life && now - n.born > n.life) { fadeNote(n); return false; }
      if (n.anchor.type === 'paper' && (viewGen !== n.vg || layoutGen !== n.lg)) { placeNote(n); moved = true; }
      else if (n.anchor.type === 'strip' && n.box && L.landLabel) { var lb = L.landLabel, b = n.box; if (now - (n.placedAt || 0) > 0.5 && b.x < lb.x + lb.w && b.x + b.w > lb.x && b.y < lb.y + lb.h && b.y + b.h > lb.y) { n.placedAt = now; placeNote(n); } }
      return true;
    });
    return moved;
  }
  function placeNote(n) {
    var a = n.anchor, x = 0, y = 0;
    if (!L.root || !L.plot) return;
    n.lg = layoutGen; n.vg = viewGen;
    if (n.wrap) n.el.style.width = Math.min(L.laptop ? 520 : L.root.w - L.gutL - L.gutR - 8, L.laptop ? 520 : 9999) + 'px';
    if (a.type === 'paper' && !n.wrap) n.el.style.maxWidth = Math.max(80, L.plot.w - 4) + 'px';
    if (n.el.classList.contains('goalw')) n.el.style.maxWidth = Math.min(L.laptop ? 340 : 230, L.plot.w - 16) + 'px';
    var w = n.el.offsetWidth || 120, h = n.el.offsetHeight || 17;
    if (a.type === 'paper') {
      var px = a.x != null ? X(a.x) : X(log10(a.C)), py = a.y != null ? Y(a.y) : Y(Math.log(a.L));
      x = L.paper.x + px + (a.dx == null ? 8 : a.dx); y = L.paper.y + py + (a.dy == null ? -20 : a.dy);
    } else if (a.type === 'band') { x = L.band.x + L.band.w - w; y = L.band.y + 2; }
    else if (a.type === 'name') { var b = el.team.querySelector('[data-key="' + a.key + '"]'); if (b) { var r = b.getBoundingClientRect(), bx = b.querySelector('.box'); x = r.left - L.rootRect.left + Math.max(40, (b.querySelector('.w') ? b.querySelector('.w').offsetWidth : r.width) + 8 + (bx ? bx.offsetWidth + 8 : 0)); y = r.top - L.rootRect.top + (r.height - h) / 2; } }
    else if (a.type === 'names') { var lis = el.team.querySelectorAll('li'), last = lis[lis.length - 1]; var rr = last ? last.getBoundingClientRect() : el.team.getBoundingClientRect(); x = L.paper.x + 2; y = rr.bottom - L.rootRect.top + 4; }
    // notes about the strip are written on the strip itself, never over the cluster's cells
    else if (a.type === 'stop') { x = L.strip.x + a.x - w - 18; y = L.strip.y + 3; }
    else if (a.type === 'strip') { x = L.strip.x + L.home + 8; y = L.strip.y + L.strip.h - h - 3; }
    else if (a.type === 'cluster') { x = L.cluster.x + L.cluster.w - w - 44; y = L.cluster.y - h; }
    else if (a.type === 'months') { x = L.paper.x + L.paper.w - w; y = L.paper.y + 2; }
    else if (a.type === 'goal') { x = L.paper.x + L.plot.x + L.plot.w - w - 4; y = L.paper.y + L.plot.y + (a.dy || 0); }
    else if (a.type === 'door') { x = L.letter.x + (L.letter.w - w) / 2; y = L.letter.y + 16; }
    var x0 = x, y0 = y, best = null;
    var xmin = a.type === 'paper' || a.type === 'goal' ? L.paper.x + L.plot.x : a.type === 'name' || a.type === 'names' ? L.paper.x : a.type === 'band' ? L.band.x : L.gutL;
    var xmax = a.type === 'paper' || a.type === 'name' || a.type === 'goal' || a.type === 'months' || a.type === 'names' ? L.paper.x + L.paper.w : a.type === 'band' ? L.band.x + L.band.w : a.type === 'stop' || a.type === 'strip' ? L.strip.x + L.strip.w : a.type === 'cluster' ? L.cluster.x + L.cluster.w : L.root.w - L.gutR;
    if (xmax - xmin < w) xmin = Math.max(L.gutL, xmax - w);
    var ymin = a.type === 'paper' ? L.paper.y + L.plot.y : a.type === 'band' ? L.band.y : a.type === 'stop' || a.type === 'strip' ? L.strip.y : 2;
    var ymax = a.type === 'paper' ? L.paper.y + L.plot.y + L.plot.h - h - 2 : a.type === 'band' ? L.band.y + L.band.h - h : a.type === 'stop' || a.type === 'strip' ? L.strip.y + L.strip.h - h : L.root.h - h - 4;
    var rw = (L.readoutBox ? L.readoutBox.w : 70) + 14;
    var offs = a.type === 'paper' ? [[0, 0], [0, -18], [0, 18], [-w - 16, 0], [0, -36], [0, 36], [-w - 16, -18], [-w - 16, 18], [0, -54], [-w - 16, -36], [0, 54]] : a.type === 'name' ? [[0, 0], [0, 14], [0, -14]] : a.type === 'stop' ? [[0, 0], [0, h + 2], [0, -h - 2]] : a.type === 'strip' ? [[0, 0], [0, -(L.strip.h - h - 6)]].concat(L.landLabel ? [[L.landLabel.x + L.landLabel.w + 8 - x, 0], [L.landLabel.x - w - 8 - x, 0], [L.landLabel.x + L.landLabel.w + 8 - x, -(L.strip.h - h - 6)]] : []) : a.type === 'band' || a.type === 'names' ? [[0, 0], [0, h + 1], [0, 2 * h + 2]] : a.type === 'door' || a.type === 'months' || a.type === 'goal' ? [[0, 0], [0, h + 4], [0, 2 * h + 8]] : [[0, 0], [0, -h], [0, h], [0, -2 * h]];
    for (var oi = 0; oi < offs.length; oi++) {
      var cx = clamp(x0 + offs[oi][0], xmin, xmax - w), cy = clamp(y0 + offs[oi][1], ymin, ymax);
      if (!noteHit(n, cx, cy, w, h)) { best = [cx, cy]; break; }
    }
    // nowhere free: a passing remark (a stamp, a status) stays unwritten rather than overprint; a lesson or warning goes in anyway
    n.hidden = false;
    if (!best) { best = [clamp(x0, xmin, xmax - w), clamp(y0, ymin, ymax)]; if (n.optional) n.hidden = true; }
    n.el.style.visibility = n.hidden ? 'hidden' : '';
    x = best[0]; y = best[1];
    n.box = n.hidden ? null : { x: x, y: y, w: w, h: h };
    n.el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
  }

  /* ================= layout and drawing ================= */
  var L = {}, dpr = 1, staticDirty = true, frameDt = 0.016, layoutGen = 0, viewGen = 0;
  var view = { l: CFG.plotLeftMinLog, r: CFG.plotRightMinLog, anim: null };
  // two layers on the paper: everything that has been written (redrawn only when it changes) and the pen (every frame)
  var cvP = el.paper, ctxSt = cvP.getContext('2d'), cvD = el.pen, ctxP = cvD.getContext('2d'), cvC = el.cluster, ctxC = cvC.getContext('2d'), cvS = el.strip, ctxS = cvS.getContext('2d');
  var nib = { t: 0, drag: false, pid: null, hist: [], y: null, lastX: null, lastT: 0 };
  var nibTouched = false;
  var cells = { born: [], kinds: [], printed: [], prevUnits: 0, unit: 1, regroup: null, sweep: -99, wake: -99, sprites: {} };
  var stopDisp = null, stopNoteShown = -99;
  var FONT = { mono: 'ui-monospace, monospace', serif: 'Georgia, serif', hand: 'cursive' };
  function readFonts() {
    var r = getComputedStyle(root);
    FONT.mono = (r.getPropertyValue('--mono') || '').trim() || FONT.mono;
    FONT.serif = (r.getPropertyValue('--serif') || '').trim() || FONT.serif;
    FONT.hand = (r.getPropertyValue('--hand') || '').trim() || FONT.hand;
  }
  function fMono(px, italic, weight) { return (italic ? 'italic ' : '') + (weight || 400) + ' ' + px + 'px ' + FONT.mono; }
  function fSerif(px) { return '400 ' + px + 'px ' + FONT.serif; }
  function fHand(px, weight) { return (weight || 400) + ' ' + px + 'px ' + FONT.hand; }
  function rel(e, box) { var r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var rr = root.getBoundingClientRect(); L.rootRect = rr; L.root = { w: rr.width, h: rr.height };
    function box(e) { var r = e.getBoundingClientRect(); return { x: r.left - rr.left, y: r.top - rr.top, w: r.width, h: r.height }; }
    L.paper = box(el.paperwrap); L.band = box(el.band); L.strip = box(el.strip); L.cluster = box(el.cluster); L.letter = box(el.letterzone); L.headsW = el.heads.clientWidth;
    var rs = getComputedStyle(root);
    L.gutL = parseFloat(rs.paddingLeft) || 16; L.gutR = parseFloat(rs.paddingRight) || 16;
    if (rr.width >= CFG.laptopMinWidth) { L.gutL = L.paper.x; L.gutR = rr.width - (L.paper.x + L.paper.w); }
    L.laptop = rr.width >= CFG.laptopMinWidth;
    var G = L.laptop ? CFG.laptop : CFG.phone;
    L.margin = parseFloat(rs.getPropertyValue('--margin')) || G.margin; L.home = G.home; L.nibW = G.nibW; L.readoutAbove = G.readoutAbove;
    // the plot (log compute against log loss) has its own axis labels; the calendar is a separate band beneath it,
    // with its own rule, so the months can never be read as the plot's x axis (panel)
    var rulerH = G.rulerH, axisH = G.axisH, top = L.laptop ? 34 : (L.paper.w - L.margin < 700 ? 44 : 30);   // a narrow sheet gives a long headline its three lines above the plot
    L.plot = { x: L.margin, y: top, w: Math.max(80, L.paper.w - L.margin), h: Math.max(50, L.paper.h - top - axisH - rulerH - 6) };
    L.axisY = L.plot.y + L.plot.h + 2;
    L.ruler = { top: L.plot.y + L.plot.h + axisH + 6, h: rulerH };
    L.ruler.y = L.ruler.top + rulerH - 13;   // the calendar's baseline: runs, hangs and today's cursor sit on it
    L.travel = { x: L.home, w: Math.max(40, L.strip.w - L.home) };
    [[cvP, L.paper], [cvD, L.paper], [cvC, L.cluster], [cvS, L.strip]].forEach(function (p) { var w = Math.max(1, Math.round(p[1].w * dpr)), h = Math.max(1, Math.round(p[1].h * dpr)); if (p[0].width !== w) p[0].width = w; if (p[0].height !== h) p[0].height = h; });
    var rows = S ? S.team.length : 1;
    el.team.classList.toggle('dense', L.laptop ? rows * 32 + 44 > L.paper.h - 30 : (L.paper.h < 330 || rows * 30 + 40 > L.plot.y + L.plot.h));
    cells.sprites = {};
    staticDirty = true; layoutGen++;
    if (S) S.notes.forEach(placeNote);
  }
  var Y_TOP = Math.log(CFG.plotLossTop), Y_BOT = Math.log(CFG.plotLossBottom);
  function X(lc) { return L.plot.x + (lc - view.l) / (view.r - view.l) * L.plot.w; }
  function Y(lnL) { return L.plot.y + (Y_TOP - lnL) / (Y_TOP - Y_BOT) * L.plot.h; }
  function dayX(day) { return L.plot.x + clamp(day / (CFG.endDay + 1), 0, 1) * L.plot.w; }
  function viewTarget(C) {
    var big = C || 1e18; S.runs.forEach(function (r) { if (r.C > big) big = r.C; });
    var last = C || (S.runs.length ? S.runs[S.runs.length - 1].C : 1e19);
    return { l: clamp(Math.floor(log10(last) - CFG.plotLeftBack), CFG.plotLeftMinLog, CFG.plotLeftMaxLog), r: Math.max(CFG.plotRightMinLog, log10(2 * big)) };
  }
  function pan(C) {
    var t = viewTarget(C);
    if (Math.abs(t.l - view.l) < 0.01 && Math.abs(t.r - view.r) < 0.01) return;
    view.anim = { l0: view.l, r0: view.r, l1: t.l, r1: t.r, t0: now }; AU.feed(CFG.panSec * 1000);
  }
  function stepView() {
    if (!view.anim) return;
    var u = reduced() ? 1 : ease((now - view.anim.t0) / CFG.panSec);
    view.l = lerp(view.anim.l0, view.anim.l1, u); view.r = lerp(view.anim.r0, view.anim.r1, u);
    staticDirty = true; viewGen++; if (u >= 1) view.anim = null;
  }
  function boxHits(b, list) { var n = 0; for (var i = 0; i < list.length; i++) { var o = list[i]; if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) n += o.k || 1; } return n; }
  function boxHit(b, list) { for (var i = 0; i < list.length; i++) { var o = list[i]; if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) return true; } return false; }

  // your line: a least-squares fit through your clean dots in (log10 C, ln L), with the spread of the fit (Karpathy)
  function lineFit() {
    var cr = cleanRuns(); if (cr.length < 2) return null;
    var n = cr.length, sx = 0, sy = 0; cr.forEach(function (r) { sx += log10(r.C); sy += Math.log(r.loss); });
    var mx = sx / n, my = sy / n, sxx = 0, sxy = 0;
    cr.forEach(function (r) { var dx = log10(r.C) - mx; sxx += dx * dx; sxy += dx * (Math.log(r.loss) - my); });
    if (sxx < 1e-6) return null;
    var b = sxy / sxx, a = my - b * mx, ss = 0;
    cr.forEach(function (r) { var e = Math.log(r.loss) - (a + b * log10(r.C)); ss += e * e; });
    var s = n > 2 ? Math.sqrt(ss / (n - 2)) : 0.006;
    s = Math.max(s, 0.003);
    var lo = Infinity, hi = 0; cr.forEach(function (r) { lo = Math.min(lo, r.C); hi = Math.max(hi, r.C); });
    return { a: a, b: b, mx: mx, sxx: sxx, n: n, s: s, lo: lo, hi: hi, at: function (lc) { return a + b * lc; }, half: function (lc) { return 2 * s * Math.sqrt(1 / n + (lc - mx) * (lc - mx) / sxx); } };
  }
  function drawStatic() {
    var c = ctxSt, w = L.paper.w, h = L.paper.h, dl = dimLevel(), occ = [];
    var plotR = L.plot.x + L.plot.w, plotB = L.plot.y + L.plot.h;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, w, h);
    // the decade grid
    c.strokeStyle = rgba('grid', dl); c.lineWidth = 1; c.beginPath();
    for (var d = Math.ceil(view.l); d <= Math.floor(view.r); d++) { var x = Math.round(X(d)) + 0.5; if (x < L.plot.x - 1) continue; c.moveTo(x, L.plot.y); c.lineTo(x, plotB); }
    [2, 3, 4, 6, 10].forEach(function (lv) { var y = Math.round(Y(Math.log(lv))) + 0.5; c.moveTo(L.plot.x, y); c.lineTo(plotR, y); });
    c.stroke();
    if (!S) return;
    var ry = L.ruler.y, rtop = L.ruler.top;
    if (S.powered) {
      // the plot's own axes, in pencil: compute decades along the foot, nats on the loss lines
      c.fillStyle = GR(0.85); c.font = fMono(L.laptop ? 10 : 9); c.textBaseline = 'top';
      var lastLab = -99, decs = [];
      for (var dd = Math.ceil(view.l); dd <= Math.floor(view.r); dd++) decs.push(dd);
      decs.forEach(function (dd, i) {
        var lx = X(dd), lab = '1e' + dd + (i === decs.length - 1 ? ' FLOPs' : ''), tw = c.measureText(lab).width;
        var tx = Math.min(lx - (i === decs.length - 1 ? tw - c.measureText('1e' + dd).width / 2 : tw / 2), plotR - tw);
        if (tx < lastLab + 6 || tx < L.plot.x - 2) return;
        c.fillText(lab, tx, L.axisY); lastLab = tx + tw;
      });
      c.textBaseline = 'bottom';
      [10, 6, 4, 3, 2].forEach(function (lv, i) { var y = Math.round(Y(Math.log(lv))); var lab = i === 0 ? lv + ' nats' : String(lv); c.lineWidth = 3; c.strokeStyle = rgba('paper', 0.9 * dl); c.lineJoin = 'round'; c.strokeText(lab, L.plot.x + 3, y - 1); c.fillStyle = GR(0.75); c.fillText(lab, L.plot.x + 3, y - 1); occ.push({ x: L.plot.x + 1, y: y - 12, w: c.measureText(lab).width + 5, h: 12 }); });
      // the calendar band: its own rule, month initials, the runs, and history's phrases on their dates.
      // Newer phrases are written in full; older ones that would collide collapse to a tick (panel: old marks collapse).
      c.strokeStyle = rgba('grid', dl); c.lineWidth = 1; c.beginPath(); c.moveTo(L.plot.x, rtop - 2.5); c.lineTo(plotR, rtop - 2.5); c.moveTo(dayX(0), ry + 0.5); c.lineTo(dayX(366), ry + 0.5); c.stroke();
      c.fillStyle = GR(1); c.font = fMono(L.laptop ? 10 : 9); c.textBaseline = 'top';
      for (var m = 0; m < 12; m++) { var mx = Math.round(dayX(monthStart(m))); c.fillRect(mx, ry - 2, 1, 5); c.fillText(MON[m].charAt(0), mx + 3, ry + 3); }
      c.font = fMono(L.laptop ? 10 : 9, true);
      var rows = [[], []], rowY = [rtop + 1, rtop + 11], placed = [];
      S.rulerPhrases.slice().sort(function (a, b) { return b.day - a.day; }).forEach(function (p, idx) {
        var tx = Math.round(dayX(p.day)) + 0.5, tw = c.measureText(p.text).width, px = clamp(tx + 2, L.plot.x, plotR - tw);
        var row = -1;
        for (var ri = 0; ri < 2 && row < 0; ri++) { var ok = rows[ri].every(function (b) { return px + tw + 6 < b.x || px > b.x + b.w + 6; }); if (ok) row = ri; }
        if (row >= 0) rows[row].push({ x: px, w: tw });
        placed.push({ p: p, tx: tx, px: px, row: row, tw: tw, newest: idx === 0 });
      });
      placed.forEach(function (q) {
        var a = reduced() ? 1 : clamp((now - q.p.t) / 0.6, 0, 1); if (a < 1) staticDirty = true;
        c.globalAlpha = a * (q.row >= 0 ? 0.85 : 0.5);
        c.fillStyle = GR(1); c.fillRect(q.tx - 0.5, ry - 6, 1, 6);
        if (q.row >= 0) {
          var ty = rowY[q.row];
          c.strokeStyle = GR(0.5); c.lineWidth = 1; c.beginPath(); c.moveTo(q.tx, ry - 6); c.lineTo(q.tx, ty + 10); c.stroke();
          c.lineWidth = 3; c.strokeStyle = rgba('paper', 0.9 * dl); c.lineJoin = 'round'; c.strokeText(q.p.text, q.px, ty);
          c.fillStyle = GR(1); c.fillText(q.p.text, q.px, ty);
        }
        c.globalAlpha = 1;
      });
      S.runs.forEach(function (r) { runBar(c, r, r.landDay); });
    }
    // scar bands: Vermilion hatch from the wall to the run, the skimmed sentence reprinted along the top on clean paper
    S.scars.forEach(function (sc, si) {
      var x0 = Math.max(L.plot.x, X(log10(sc.from))), x1 = Math.max(X(log10(sc.to)), x0 + 8), u = reduced() ? 1 : clamp((now - sc.t0) / 0.9, 0, 1);
      if (u < 1) staticDirty = true;
      if (x0 > plotR) return;
      c.save(); c.beginPath(); c.rect(x0, L.plot.y, (Math.min(x1, plotR) - x0) * u, L.plot.h); c.clip();
      c.strokeStyle = dl < 1 ? rgba('vermilion', dl) : COL.vermilion; c.lineWidth = 1; c.beginPath();
      for (var k = x0 - L.plot.h; k < x1; k += 6) { c.moveTo(k, plotB); c.lineTo(k + L.plot.h, L.plot.y); }
      c.stroke(); c.restore();
      sc.box = null;
      // only the newest scar reprints its sentence; older scars keep the hatch
      if (u >= 1 && sc.line && si === S.scars.length - 1) {
        var maxW = Math.min(L.laptop ? 300 : 200, L.plot.w * 0.62), lh = 16;
        c.font = fSerif(12); c.textBaseline = 'top';
        var lines = wrapLines(c, sc.line, maxW, 3), bw = 0; lines.forEach(function (ln) { bw = Math.max(bw, c.measureText(ln).width); });
        var tx = x0 + 3; if (tx + bw > plotR - 2) tx = plotR - 2 - bw; if (tx < L.plot.x + 2) tx = L.plot.x + 2;
        var b = { x: tx - 3, y: L.plot.y + 3, w: bw + 6, h: lines.length * lh + 3 };
        for (var tries = 0; tries < 6 && boxHit(b, occ); tries++) b.y += b.h + 4;
        occ.push(b); sc.box = b;
        var ta = reduced() ? 1 : clamp((now - sc.t0 - 0.9) / 0.5, 0, 1); if (ta < 1) staticDirty = true;
        c.globalAlpha = ta;
        c.fillStyle = rgba('paper', 0.92 * dl); c.fillRect(b.x, b.y, b.w, b.h);
        lines.forEach(function (ln, i) { c.fillStyle = INK(); c.fillText(ln, b.x + 3, b.y + 2 + i * lh); });
        c.globalAlpha = 1;
      }
    });
    // the paper's line, printed on 23 Jan, and GPT-3's ring
    if (S.lineShown) {
      var u2 = reduced() ? 1 : clamp((now - S.lineAt) / 1.2, 0, 1); if (u2 < 1) staticDirty = true;
      c.fillStyle = GR(1);
      var xEnd = lerp(L.plot.x, plotR, u2);
      for (var px = L.plot.x; px <= xEnd; px += 3) { var lc = view.l + (px - L.plot.x) / L.plot.w * (view.r - view.l); var py = Y(Math.log(Lline(Math.pow(10, lc)))); if (py > L.plot.y && py < plotB) c.fillRect(px, py, 1, 1); }
      if (!S.gpt3 && u2 >= 1) {
        var rgx = X(log10(CFG.gpt3C)), rgy = Y(Math.log(Lline(CFG.gpt3C)));
        c.strokeStyle = GR(1); c.lineWidth = 1; c.beginPath(); c.arc(rgx, rgy, L.laptop ? 4 : 3, 0, 6.283); c.stroke();
        occ.push({ x: rgx - 6, y: rgy - 6, w: 12, h: 12 });
        if (S.ringTeach) {
          c.font = fMono(L.laptop ? 10 : 9, true); var rt = WORLD.teach.ring, rtw = c.measureText(rt).width;
          // the upper right of the log paper stays empty all year: the lesson hangs there, on a leader to the ring
          var rb = placeLabel(rgx, rgy, rtw, 11, occ, [[-rtw + 4, -22], [-rtw + 4, -48], [-rtw + 4, -74], [-rtw + 4, -100], [-rtw / 2, -126], [-rtw + 4, -152]]);
          c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba('paper', 0.9 * dl); c.textBaseline = 'top'; c.strokeText(rt, rb.x, rb.y); c.fillStyle = GR(1); c.fillText(rt, rb.x, rb.y);
          if (Math.abs(rb.y + 5 - rgy) > 12) { c.strokeStyle = GR(0.5); c.lineWidth = 0.75; c.beginPath(); c.moveTo(rgx, rgy - 4); c.lineTo(Math.min(rgx, rb.x + rtw - 2), rb.y + (rb.y < rgy ? 11 : 0)); c.stroke(); }
        }
      }
    }
    // your dots are obstacles for every label
    S.runs.forEach(function (r) { var x = X(log10(r.C)), y = Y(Math.log(r.loss)); occ.push({ x: x - 6, y: y - 6, w: 12, h: 12 }); });
    if (S.gpt3) { var gx0 = X(log10(CFG.gpt3C)), gy0 = Y(Math.log(Lline(CFG.gpt3C))); occ.push({ x: gx0 - 8, y: gy0 - 8, w: 16, h: 16 }); }
    // finished curves at 35%: a family of training curves whose envelope is the law. Near-repeats draw once (the newest).
    var fam = [], seen = [];
    for (var ri2 = S.runs.length - 1; ri2 >= 0; ri2--) { var rr = S.runs[ri2], lc2 = log10(rr.C); if (seen.some(function (v) { return Math.abs(v - lc2) < CFG.dupCurveDecades; })) continue; seen.push(lc2); fam.push(rr); }
    strokeRuns(c, fam, INK(0.35), 1);
    if (S.run && S.run.cut) strokeRun(c, S.run, INK(0.6), 1.2, true);
    // last year's farthest dot, a faint ghost on the fresh sheet
    if (S.ghost && S.powered && S.ghost.C > 0) {
      var gx = X(log10(S.ghost.C)), gy = Y(Math.log(S.ghost.L));
      if (gx > L.plot.x && gx < plotR) {
        c.strokeStyle = rgba('graphite', 0.5 * dl); c.setLineDash([2, 2]); c.lineWidth = 1; c.beginPath(); c.arc(gx, gy, 4, 0, 6.283); c.stroke(); c.setLineDash([]);
        c.font = fHand(13); var glw = c.measureText('last year').width, gb = farthestClean() >= S.ghost.C ? null : placeLabel(gx, gy, glw, 14, occ, [[6, 4], [-glw - 6, 4], [6, -18], [-glw - 6, -18]], true);
        if (gb) { c.fillStyle = rgba('graphite', 0.6 * dl); c.textBaseline = 'top'; c.fillText('last year', gb.x, gb.y); }
        occ.push({ x: gx - 5, y: gy - 5, w: 10, h: 10 });
      }
    }
    // the live run's whole path is known at launch: labels keep off it, so the pen never writes through a name (Ive)
    if (S.run && S.phase === 'play') {
      for (var lq = Math.log(P0); lq <= 0.0001; lq += 0.08) {
        var qq0 = Math.min(1, Math.exp(lq)), px0 = X(log10(qq0 * S.run.C)), py0 = Y(Math.log(lossAt(S.run, qq0)));
        if (px0 > L.plot.x && px0 < plotR && py0 > L.plot.y && py0 < plotB) occ.push({ x: px0 - 4, y: py0 - 4, w: 8, h: 8 });
      }
    }
    // rivals: faint dashed ladders, the latest dot labelled with name and size
    if (S.powered && now >= (S.rivalsShown || 0) - 0.5) {
      var ra = reduced() ? 1 : clamp((now - S.rivalsShown) / 0.6, 0, 1); if (ra < 1) staticDirty = true;
      var keepDark = S.endFx && S.endFx.kind === 'forgotten';
      var rivalPts = S.rivals.map(function (rv) {
        var off = rv.offset * (S.sunheeTrick ? CFG.sunheeBend : 1);
        return rv.pubs.map(function (p) { return [X(log10(p.C)), Y(Math.log(Lline(p.C) * off)), p]; });
      });
      c.globalAlpha = ra;
      S.rivals.forEach(function (rv, ri) {
        var pts = rivalPts[ri];
        c.strokeStyle = GR(0.5, keepDark); c.lineWidth = 1;
        if (pts.length > 1) { c.setLineDash([3, 3]); c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]); }
        pts.forEach(function (p) { var pa = reduced() ? 1 : clamp((now - p[2].t) / 0.5, 0, 1); if (pa < 1) staticDirty = true; c.fillStyle = GR(0.9 * pa, keepDark); c.beginPath(); c.arc(p[0], p[1], 1.5, 0, 6.283); c.fill(); occ.push({ x: p[0] - 3, y: p[1] - 3, w: 6, h: 6 }); });
      });
      S.rivals.forEach(function (rv, ri) {
        var pts = rivalPts[ri], lp = rv.pubs[rv.pubs.length - 1], lx = pts[pts.length - 1];
        c.font = fMono(L.laptop ? 11 : 10, true); c.textBaseline = 'top';
        var lab = rv.name + ' · ' + sizeWord(params(lp.C)), tw = c.measureText(lab).width, th = 12;
        var cands = [], dys = [3, -15, 16, -28, 29, -41, 42, -54, 55, -67, -80, -93];
        dys.forEach(function (dy) { cands.push([5, dy]); cands.push([-tw - 5, dy]); });
        var bx = null, best = null, bestN = Infinity;
        for (var ci = 0; ci < cands.length; ci++) {
          var b = { x: lx[0] + cands[ci][0], y: lx[1] + cands[ci][1], w: tw, h: th };
          if (b.x < L.plot.x + 2 || b.x + tw > plotR || b.y < L.plot.y || b.y + th > plotB - 2) continue;
          var nh = boxHits(b, occ);
          if (!nh) { bx = b; break; }
          if (nh < bestN) { bestN = nh; best = b; }
        }
        // a crowded sheet: the spot that covers the fewest marks, never simply the default
        if (!bx) bx = best || { x: clamp(lx[0] + 5, L.plot.x + 2, plotR - tw), y: clamp(lx[1] + 3, L.plot.y, plotB - th - 2), w: tw, h: th };
        bx.k = 50; occ.push(bx);   // words never land on words: a label weighs more than any mark it might cover
        // a label pushed away from its dot keeps a faint leader back to it
        var ly0 = bx.y + th / 2, lxe = bx.x > lx[0] ? bx.x - 2 : bx.x + tw + 2;
        if (Math.abs(ly0 - lx[1]) > 12) { c.strokeStyle = GR(0.45, keepDark); c.lineWidth = 0.75; c.beginPath(); c.moveTo(lx[0], lx[1]); c.lineTo(lxe, ly0); c.stroke(); }
        c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba('paper', 0.85 * dl); c.strokeText(lab, bx.x, bx.y);
        c.fillStyle = rv.passed ? rgba('grid', dl) : GR(1, keepDark);
        c.fillText(lab, bx.x, bx.y);
        // passed: the label drops to Grid with one pen tick, in pencil, lighter than the label it marks
        if (rv.passed) { var tu = reduced() ? 1 : clamp((now - rv.passedAt) / 0.25, 0, 1); if (tu < 1) staticDirty = true; c.strokeStyle = GR(0.7); c.lineWidth = 1; c.beginPath(); var t0x = bx.x - 9, t0y = bx.y + 6; c.moveTo(t0x, t0y); c.lineTo(t0x + 2.5 * Math.min(1, tu * 2), t0y + 3 * Math.min(1, tu * 2)); if (tu > 0.5) c.lineTo(t0x + 2.5 + 4.5 * (tu - 0.5) * 2, t0y + 3 - 7 * (tu - 0.5) * 2); c.stroke(); }
      });
      c.globalAlpha = 1;
    }
    // hang circles, in Tom's hand, faint: they stay all year but never shout
    c.save(); c.beginPath(); c.rect(L.plot.x, L.plot.y, L.plot.w, L.plot.h); c.clip();
    c.strokeStyle = INK(0.16); c.lineWidth = 1;
    S.hangMarks.forEach(function (hm) { c.beginPath(); c.ellipse(X(hm.x), Y(hm.y), 5, 3.5, -0.3, 0.4, 6.5); c.stroke(); });
    c.restore();
    // your line: solid across your dots, a dotted extension once they span a decade, and a faint fan for its doubt
    var fit = lineFit();
    if (fit) {
      var x0l = log10(fit.lo), x1l = log10(fit.hi);
      c.strokeStyle = LINEINK(); c.lineWidth = 1; c.beginPath(); c.moveTo(X(x0l), Y(fit.at(x0l))); c.lineTo(X(x1l), Y(fit.at(x1l))); c.stroke();
      if (fit.hi >= fit.lo * 10) {
        c.setLineDash([1, 3]); c.beginPath(); c.moveTo(X(x1l), Y(fit.at(x1l))); c.lineTo(X(view.r), Y(fit.at(view.r))); c.stroke(); c.setLineDash([]);
        c.strokeStyle = LINEINK(0.22); c.setLineDash([1, 4]);
        [1, -1].forEach(function (sg) { c.beginPath(); for (var xx = x1l; xx <= view.r + 1e-9; xx += 0.1) { var yy = fit.at(xx) + sg * fit.half(xx); if (xx === x1l) c.moveTo(X(xx), Y(yy)); else c.lineTo(X(xx), Y(yy)); } c.stroke(); });
        c.setLineDash([]);
      }
    }
    // the investor's mark: what the money wants, until it is raised (panel: make the money goal findable)
    if (S.lineShown && !S.raise.aTaken && S.phase === 'play' && S.powered) {
      var aC = S.raise.aNeed, ax = X(log10(aC)), ay = Y(Math.log(Lline(aC)));
      if (ax > L.plot.x && ax < plotR) {
        c.strokeStyle = GR(0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(ax + 0.5, ay - 5); c.lineTo(ax + 0.5, ay + 5); c.stroke();
        var closed = S.day >= CFG.crashDay && S.day < CFG.marketOpenDay;
        var atxt = closed ? 'Series A, after 15 JUN: a dot here' : WORLD.teach.seriesA;
        if (aC > CFG.seriesA.needC * 1.01) atxt = 'Series A: now they want a dot here';
        c.font = fMono(L.laptop ? 10 : 9, true); var aw = c.measureText(atxt).width;
        var ab = placeLabel(ax, ay, aw, 11, occ, [[-aw / 2, 7], [-aw + 6, 7], [-6, 7], [-aw / 2, 20], [-aw + 6, 20], [-aw + 6, -40], [-aw + 6, -66], [-aw + 6, -92], [-aw / 2, -118]]);
        if (Math.abs(ab.y + 5 - ay) > 16) { c.strokeStyle = GR(0.5); c.lineWidth = 0.75; c.beginPath(); c.moveTo(ax, ay - 5); c.lineTo(clamp(ax, ab.x, ab.x + aw), ab.y + (ab.y < ay ? 11 : 0)); c.stroke(); }
        c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba('paper', 0.9 * dl); c.textBaseline = 'top'; c.strokeText(atxt, ab.x, ab.y);
        c.fillStyle = GR(0.95); c.fillText(atxt, ab.x, ab.y);
      }
    }
    var lastScandalRun = null; S.runs.forEach(function (r) { if (r.scandal) lastScandalRun = r; });
    S.runs.forEach(function (r) {
      var x = X(log10(r.C)), y = Y(Math.log(r.loss)), ink = LINEINK();
      c.beginPath(); c.arc(x, y, L.laptop ? 3 : 2.5, 0, 6.283);
      if (r.clean) { c.fillStyle = ink; c.fill(); }
      else if (r.aborted) { c.strokeStyle = LINEINK(0.55); c.lineWidth = 1; c.stroke(); }
      else { c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke(); }
      if (r.published) { c.strokeStyle = ink; c.lineWidth = 1; c.beginPath(); c.arc(x, y, L.laptop ? 5.5 : 4.5, 0, 6.283); c.stroke(); }
      if (r.shipped) { c.fillStyle = ink; c.fillRect(x + 5, y - 0.5, 6, 1); }
      // a scandal strikes its dot; only the newest scandal keeps its words on the paper
      if (r.scandal) { c.strokeStyle = GR(1); c.lineWidth = 1; c.beginPath(); c.moveTo(x - 6, y + 6); c.lineTo(x + 6, y - 6); c.stroke(); }
      c.textBaseline = 'top';
      var tb;
      if (r.author) { c.font = fHand(L.laptop ? 16 : 14); var aw2 = c.measureText(r.author).width; tb = placeLabel(x, y, aw2, 15, occ, [[-aw2 / 2, 8], [6, 6], [-aw2 - 6, 6], [-aw2 / 2, -22]]); c.fillStyle = INK(); c.fillText(r.author, tb.x, tb.y); }
      if (r.withMer) { c.font = fHand(13); var tw2 = c.measureText(WORLD.notes.withMeridian).width; tb = placeLabel(x, y, tw2 + 8, 15, occ, [[6, -22], [-tw2 - 14, -22], [6, 8], [-tw2 - 14, 8]]); c.strokeStyle = GR(0.9); c.lineWidth = 1; c.strokeRect(Math.round(tb.x) + 0.5, Math.round(tb.y) + 0.5, tw2 + 8, 15); c.fillStyle = GR(1); c.fillText(WORLD.notes.withMeridian, tb.x + 4, tb.y + 1); }
      if (r.scandal && r === lastScandalRun) { c.font = fHand(14); var sw = c.measureText(r.scandal).width; tb = placeLabel(x, y, sw, 15, occ, [[-sw / 2, 18], [-sw + 8, 18], [-8, 18], [-sw / 2, -34], [-sw - 8, -6], [-sw / 2, 34], [-sw / 2, -50], [-sw + 8, 50], [-sw / 2, -66]]); c.lineWidth = 3; c.strokeStyle = rgba('paper', 0.85 * dl); c.lineJoin = 'round'; c.strokeText(r.scandal, tb.x, tb.y); c.fillStyle = GR(1); c.fillText(r.scandal, tb.x, tb.y); }
    });
    L.occ = occ; viewGen++;
    // GPT-3: on 28 May the ring presses in as a solid point, bigger than your dots, and is named
    if (S.gpt3) {
      var gpx = X(log10(CFG.gpt3C)), gpy = Y(Math.log(Lline(CFG.gpt3C)));
      var pu = reduced() ? 1 : clamp((now - S.gpt3At) / 0.3, 0, 1); if (pu < 1) staticDirty = true;
      var keepD = S.endFx && S.endFx.kind === 'forgotten';
      var R = L.laptop ? 4.5 : 3.6;
      c.fillStyle = keepD ? COL.ink : LINEINK(); c.beginPath(); c.arc(gpx, gpy, lerp(R * 2.4, R, easeOut(pu)), 0, 6.283); c.fill();
      c.strokeStyle = keepD ? COL.ink : LINEINK(0.6); c.lineWidth = 1; c.beginPath(); c.arc(gpx, gpy, R + 3.5, 0, 6.283); c.stroke();
      if (pu >= 1) {
        c.font = fMono(L.laptop ? 11 : 10, false, 500); var gl = 'GPT-3', glw2 = c.measureText(gl).width;
        var gb2 = placeLabel(gpx, gpy, glw2, 12, occ, [[-glw2 / 2, -R - 17], [R + 6, -6], [-glw2 - R - 6, -6], [-glw2 / 2, R + 6]]);
        c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba('paper', 0.9); c.textBaseline = 'top'; c.strokeText(gl, gb2.x, gb2.y);
        c.fillStyle = keepD ? COL.ink : LINEINK(); c.fillText(gl, gb2.x, gb2.y);
      }
    }
  }
  function placeLabel(x, y, w, h, occ, cands, optional) {
    var plotR = L.plot.x + L.plot.w;
    cands = cands.concat([[8, -h - 14], [-w - 8, -h - 14], [8, 22], [-w - 8, 22], [-w / 2, -h - 28], [-w / 2, 34], [12, -h - 30], [-w - 12, 36]]);
    var best = null, bestN = Infinity;
    for (var i = 0; i < cands.length; i++) {
      var b = { x: clamp(x + cands[i][0], L.plot.x + 1, plotR - w - 1), y: clamp(y + cands[i][1], L.plot.y, L.plot.y + L.plot.h - h - 2), w: w, h: h, k: 50 };
      // two phrases side by side read as one sentence: keep a word's width of air around each label
      var nh = boxHits({ x: b.x - 12, y: b.y - 3, w: w + 24, h: h + 6 }, occ);
      if (!nh) { occ.push(b); return b; }
      if (nh < bestN) { bestN = nh; best = b; }
    }
    // nowhere free: an optional label stays unwritten; a needed one takes the spot that covers least, and never sits on words
    if (optional) return null;
    var f = best || { x: clamp(x + cands[0][0], L.plot.x + 1, plotR - w - 1), y: clamp(y + cands[0][1], L.plot.y, L.plot.y + L.plot.h - h - 2), w: w, h: h, k: 50 };
    occ.push(f); return f;
  }
  function runBar(c, r, toDay) {
    var x0 = dayX(r.launchDay), x1 = Math.max(x0 + 1.5, dayX(toDay)), y = L.ruler.y - 1;
    if (r.clean === false) { c.strokeStyle = INK(); c.lineWidth = 1; c.strokeRect(x0 + 0.5, y + 0.5, Math.max(1, x1 - x0 - 1), 2); }
    else { c.fillStyle = INK(); c.fillRect(x0, y, x1 - x0, 2); }
    c.fillStyle = COL.paper; r.hangs.forEach(function (hd) { c.fillRect(Math.round(dayX(hd)), y - 1, 1, 4); });
  }
  function wrapLines(c, text, maxW, maxLines) {
    var words = text.split(' '), line = '', out = [];
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(t).width > maxW && line) {
        out.push(line); line = words[i];
        if (out.length >= maxLines) { var last = out[maxLines - 1]; while (last.length > 1 && c.measureText(last + '…').width > maxW) last = last.replace(/\s*\S+$/, ''); out[maxLines - 1] = last.replace(/[,;:|]$/, '') + '…'; return out; }
      }
      else line = t;
    }
    if (line && out.length < maxLines) out.push(line);
    return out;
  }
  function strokeRuns(c, runs, style, lw) {
    if (!runs.length) return;
    c.save(); c.beginPath(); c.rect(L.plot.x, 0, L.plot.w, L.plot.y + L.plot.h + 2); c.clip();
    c.strokeStyle = style; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
    runs.forEach(function (r) {
      var pts = r.pts, lx = -1e9, ly = -1e9; if (pts.length < 2) return;
      for (var i = 0; i < pts.length; i++) {
        var x = X(pts[i][0]), y = Y(pts[i][1]);
        if (i && i < pts.length - 1 && Math.abs(x - lx) < 0.6 && Math.abs(y - ly) < 0.6) continue;
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
        lx = x; ly = y;
      }
    });
    c.stroke(); c.restore();
  }
  function strokeRun(c, r, style, lw, decimate) {
    var pts = r.pts; if (pts.length < 2) return;
    c.save(); c.beginPath(); c.rect(L.plot.x, 0, L.plot.w, L.plot.y + L.plot.h + 2); c.clip();
    c.strokeStyle = style; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
    var lx = -1e9, ly = -1e9;
    for (var i = 0; i < pts.length; i++) {
      var x = X(pts[i][0]), y = Y(pts[i][1]);
      if (i && decimate && i < pts.length - 1 && Math.abs(x - lx) < 0.6 && Math.abs(y - ly) < 0.6) continue;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
      lx = x; ly = y;
    }
    c.stroke(); c.restore();
  }
  var lastPen = null;
  function drawPaper() {
    if (staticDirty) { staticDirty = false; var ts = performance.now(); drawStatic(); perf.statics++; perf.staticMs += performance.now() - ts; }
    var c = ctxP;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cvD.width, cvD.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S || !S.powered) return;
    var run = S.run;
    if (run && run.pts.length && !run.cut) {
      strokeRun(c, run, S.hang ? INK(0.55) : INK(), 1.5, false);
      var q = run.pts[run.pts.length - 1], nx = X(q[0]), ny = Y(q[1]);
      c.fillStyle = INK(); c.beginPath(); c.arc(nx, ny, 2.5, 0, 6.283); c.fill();
      if (lastPen != null && S.phase === 'play' && !moment.on) AU.scratch(S.hang || frozen() ? 0 : clamp(Math.abs(nx - lastPen) / Math.max(0.001, frameDt) / 260, 0.05, 1));
      lastPen = nx;
      runBar(c, run, S.day);
    } else { if (lastPen != null) AU.scratch(0); lastPen = null; }
    // a tap dips the pen into the run
    if (run && S.tapFx && now - S.tapFx < 0.3 && run.pts.length && !reduced()) {
      var tq = run.pts[run.pts.length - 1], tu = (now - S.tapFx) / 0.3;
      c.strokeStyle = INK(0.5 * (1 - tu)); c.lineWidth = 1; c.beginPath(); c.arc(X(tq[0]), Y(tq[1]), 3 + 5 * easeOut(tu), 0, 6.283); c.stroke();
    }
    // the ink spreads where a dot lands
    if (S.landFx && !reduced()) {
      var lf = S.landFx, u = (now - lf.t0) / 0.45;
      if (u >= 1) S.landFx = null;
      else { var lx = X(log10(lf.run.C)), ly = Y(Math.log(lf.run.loss)); c.strokeStyle = INK(0.45 * (1 - u)); c.lineWidth = 1; c.beginPath(); c.arc(lx, ly, 2.5 + 6 * easeOut(u), 0, 6.283); c.stroke(); }
    }
    // the mark during a drag: a tick on your line at the bet's compute (hollow past the horizon), with its compute in pencil
    if (!run && S.phase === 'play' && (nib.drag || kbdHolding())) {
      var br = betRange();
      if (br) {
        var T = betDays(nib.t, br), C = T * br.F, mx = X(log10(C)), my = Y(Math.log(yourLineLoss(C)));
        if (mx <= L.plot.x + L.plot.w + 4) {
          if (C > br.horC * 1.0001) { c.strokeStyle = INK(); c.lineWidth = 1.2; c.strokeRect(Math.round(mx) - 2, my - 5, 4, 10); }
          else { c.fillStyle = INK(); c.fillRect(Math.round(mx) - 0.75, my - 5, 1.5, 10); }
          var onG = S.lineShown && Math.abs(log10(C) - log10(CFG.gpt3C)) < 0.006;
          var ml = onG ? 'GPT-3 scale' : sciP(C);
          c.font = fMono(L.laptop ? 11 : 10, false, 500); var mw = c.measureText(ml).width, mh = 12, mspot = null;
          // the mark's compute label finds a clear spot among the sheet's labels and dots
          [[-mw / 2, -8 - mh], [-mw / 2, 8], [8, -mh / 2], [-mw - 8, -mh / 2], [-mw / 2, -22 - mh], [-mw / 2, 22]].some(function (o) {
            var bx = { x: clamp(mx + o[0], L.plot.x + 2, L.plot.x + L.plot.w - mw - 2), y: my + o[1], w: mw, h: mh };
            if (!boxHit(bx, L.occ || [])) { mspot = bx; return true; } return false;
          });
          if (!mspot) mspot = { x: clamp(mx - mw / 2, L.plot.x + 2, L.plot.x + L.plot.w - mw - 2), y: my - 8 - mh };
          c.textBaseline = 'top'; c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba('paper', 0.95); c.strokeText(ml, mspot.x, mspot.y); c.fillStyle = INK(0.85); c.fillText(ml, mspot.x, mspot.y);
        }
      }
    }
    // during a pour the calendar shows where the run is now expected to land, and says so when that is past New Year
    if (run && S.phase === 'play' && run.landProj != null) {
      var px0 = dayX(S.day), px1 = dayX(Math.min(run.landProj, CFG.endDay + 1)), yb = L.ruler.y - 1;
      c.strokeStyle = INK(0.7); c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(px0, yb + 0.5); c.lineTo(px1, yb + 0.5); c.stroke(); c.setLineDash([]);
      if (run.landProj <= CFG.endDay + 1) { c.fillStyle = INK(0.8); c.fillRect(Math.round(px1) - 0.5, yb - 3, 1, 5); }
    }
    // today's cursor on the ruler
    var tx = Math.round(dayX(S.day)) + 0.5;
    c.fillStyle = INK(); c.fillRect(tx - 1, L.ruler.y - 5, 2, 8);
  }
  function yourLineLoss(C) {
    var fit = lineFit(); if (!fit || fit.hi <= fit.lo * 1.5) return Lline(C) * sunheeM();
    return Math.exp(fit.at(log10(C)));
  }

  /* ---------- the cluster band: one cell per card, nodes of 8 above 128, pods of 64 above 2,048 ---------- */
  // Order is chosen so cells stay put: owned V100s, owned A100s, orders (they ink in where they stand), rentals, Meridian.
  function cardList() {
    var list = [], i, k;
    for (i = 0; i < S.owned.v; i++) list.push('w');
    for (i = 0; i < S.owned.a; i++) list.push('A');
    S.orders.forEach(function (o) { var u = clamp((S.day - o.ordered) / Math.max(1, o.arrive - o.ordered), 0, 1); for (k = 0; k < o.n; k++) list.push(o.type === 'a100' ? 'P' + u.toFixed(3) : 'o' + u.toFixed(3)); });
    S.rentals.forEach(function (r) { if (S.day < r.end) for (k = 0; k < r.n; k++) list.push(S.day >= r.start ? 'r' : 'R'); });
    if (S.mer) { var live = S.day >= S.mer.live; for (k = 0; k < S.mer.cards; k++) list.push(!live ? 'M' : k < S.mer.alloc ? 'm' : 'q'); }
    // rent-out and serving take cells away from the run
    var lent = S.lent ? S.lent.n : 0;
    for (i = 0; i < list.length && lent > 0; i++) if (list[i] === 'w') { list[i] = 'L'; lent--; }
    // serving cards come out of the biggest pool
    var sv = servingCards(S.day), serve = sv ? sv.n : 0, sk = sv ? POOL_KIND[sv.key] : null;
    for (i = list.length - 1; i >= 0 && serve > 0; i--) { if (list[i] === sk) { list[i] = 's'; serve--; } }
    return list;
  }
  var POOL_KIND = { office: 'w', a100: 'A', broker: 'r', meridian: 'm' };
  function unitFor(n) { return n > CFG.podAbove ? 64 : n > CFG.nodeAbove ? 8 : 1; }
  function cellGeom(nUnits, unit, w, h) {
    // nodes fill the band instead of huddling at its left, so gaining cards never looks like losing them (panel)
    var cols = 64, rows = 2;
    if (unit > 1) { rows = nUnits <= 21 ? 1 : clamp(Math.ceil(nUnits / 64), 2, 4); cols = clamp(Math.ceil(nUnits / rows), 21, 64); }
    var pitch = w / cols, cw = Math.max(1, pitch - (pitch > 10 ? 2 : 0.75));
    var gap = rows <= 2 ? 6 : 4, rh = Math.min(22, (h - 2 - (rows - 1) * gap) / rows);
    var top = rows <= 2 ? Math.max(1, (h - (rh * 2 + gap)) / 2) : 1;
    return { cols: cols, rows: rows, pitch: pitch, cw: cw, rh: rh, gap: gap, top: top };
  }
  // the filament: an inner glow 2 to 4 px deep, warm against the cold sheet. Pre-drawn once per cell size.
  function glowSprite(cw, rh, solid) {
    var key = cw.toFixed(2) + 'x' + rh.toFixed(2) + (solid ? 's' : 'h');
    var sp = cells.sprites[key]; if (sp) return sp;
    var W = Math.max(1, Math.ceil(cw * dpr)), H = Math.max(1, Math.ceil(rh * dpr));
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    // a filament, not a fill: a 1 px inner rule on narrow cells, a short 2 px falloff on wide ones (Jony)
    var g = cv.getContext('2d'), depth = (cw < 8 ? 0.9 : clamp(Math.min(cw, rh) * 0.12, 1.2, 2.2)) * dpr, inset = 1 * dpr;
    for (var k = 0; k < depth; k += 0.45) {
      var a = Math.pow(1 - k / depth, 1.6) * (solid ? 1 : 0.9);
      g.strokeStyle = rgba('filament', a.toFixed(3)); g.lineWidth = 0.55;
      g.strokeRect(inset + k + 0.25, inset + k + 0.25, Math.max(0.5, W - 2 * (inset + k) - 0.5), Math.max(0.5, H - 2 * (inset + k) - 0.5));
    }
    cells.sprites[key] = cv; return cv;
  }
  function drawCluster() {
    var c = ctxC, w = L.cluster.w, h = L.cluster.h;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, w, h);
    if (!S) return;
    var asleep = !S.powered, list = cardList(), unit = unitFor(list.length);
    var units = []; for (var i = 0; i < list.length; i += unit) units.push(list[i]);
    // unit change: eight cells close into one over 600 ms with the paper-feed whirr
    if (unit !== cells.unit) {
      if (!asleep) { cells.regroup = { from: cells.unit, to: unit, t0: now, n: list.length }; AU.feed(CFG.regroupSec * 1000); }
      cells.unit = unit; cells.born = []; cells.kinds = []; cells.printed = []; cells.prevUnits = units.length;
    }
    // new cells draw in one after another, one tick per cell at most every 30 ms
    if (units.length > cells.prevUnits && !asleep) {
      var nNew = units.length - cells.prevUnits, stg = Math.min(CFG.cellDrawSec, CFG.cellDrawMaxSec / nNew);
      for (var ni = cells.prevUnits; ni < units.length; ni++) cells.born[ni] = (cells.lastBornAt && cells.lastBornAt > now ? cells.lastBornAt : now) + (ni - cells.prevUnits) * stg;
      cells.lastBornAt = (cells.born[units.length - 1] || now) + stg;
    }
    cells.prevUnits = units.length;
    var G = cellGeom(units.length, unit, w, h);
    var regroupU = 1, rg = cells.regroup;
    if (rg) { regroupU = reduced() ? 1 : ease((now - rg.t0) / CFG.regroupSec); if (regroupU >= 1) cells.regroup = null; }
    var training = !!S.run && !S.hang && S.phase === 'play', fade = inkFade(), ink = mix('ink', 'dry', fade.u), dl = dimLevel();
    var trainKind = S.run ? POOL_KIND[S.run.pool] : null;
    var breathe = reduced() ? 1 : 1 + 0.06 * Math.sin(now * Math.PI);
    var sweepT = now - cells.sweep;
    for (i = 0; i < units.length; i++) {
      var col = i % G.cols, row = Math.floor(i / G.cols); if (row >= G.rows) break;
      var x = col * G.pitch, y = G.top + row * (G.rh + G.gap), k = units[i], kind = k.charAt(0), cw = G.cw, rh = G.rh;
      if (asleep) {
        var bph = (i === 3) ? 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 1.2) : 0.5 + 0.5 * Math.sin(now * 2 * Math.PI / 4 + i * 0.15);
        c.strokeStyle = rgba('grid', 0.55 + 0.45 * bph); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); continue;
      }
      // a regroup: eight cells close into one (drawn as slivers whose gaps close)
      var slivers = rg && regroupU < 1 && rg.to > rg.from ? 8 : 0;
      var bornAt = cells.born[i], drawU = bornAt == null ? 1 : reduced() ? 1 : clamp((now - bornAt) / 0.08, 0, 1);
      if (bornAt != null && drawU > 0 && drawU < 1) AU.cardTick();
      if (drawU <= 0) continue;
      var wk = i < 8 ? clamp((now - cells.wake - i * 0.06) / 0.18, 0, 1) : 1; // the DGX-1 inks in left to right, 60 ms apart
      if (cells.wake > 0 && i < 8 && wk > 0 && wk < 1 && !cells.wakeTicked[i]) { cells.wakeTicked[i] = 1; AU.cardTick(); }
      var prevKind = cells.kinds[i]; cells.kinds[i] = kind;
      if (prevKind && prevKind !== kind && (((kind === 'w' || kind === 'A') && (prevKind === 'o' || prevKind === 'P')) || (kind === 'm' && prevKind === 'M'))) { cells.printed[i] = now + (col / G.cols) * 0.5; }
      var pr0 = cells.printed[i]; if (pr0 && now >= pr0 && now - pr0 < 0.03) AU.cardTick();
      c.globalAlpha = Math.min(drawU, wk) * fade.a * dl;
      if (slivers && (kind === 'w' || kind === 'A' || kind === 's')) {
        var sw = cw / slivers, gapS = sw * 0.45 * (1 - regroupU);
        c.fillStyle = kind === 's' ? COL.grid : ink; for (var si = 0; si < slivers; si++) c.fillRect(x + si * sw + gapS / 2, y, Math.max(0.3, sw - gapS), rh);
      } else if (slivers) {
        var sw2 = cw / slivers, gapS2 = sw2 * 0.45 * (1 - regroupU);
        c.strokeStyle = kind === 'q' || kind === 'M' || kind === 'R' || kind === 'o' || kind === 'P' ? COL.graphite : ink; c.lineWidth = 1;
        for (var sj = 0; sj < slivers; sj++) c.strokeRect(x + sj * sw2 + gapS2 / 2 + 0.5, y + 0.5, Math.max(0.3, sw2 - gapS2 - 1), rh - 1);
      } else if (kind === 'w' || kind === 'A') {
        c.fillStyle = ink; c.fillRect(x, y, cw, rh);
        if (kind === 'A' && cw > 3) { c.strokeStyle = COL.paper; c.lineWidth = 1; c.strokeRect(x + 1.5, y + 1.5, cw - 3, rh - 3); }
        var pr = cells.printed[i]; if (pr && now >= pr && now - pr < 0.25) { c.fillStyle = rgba('paper', 0.6 * (1 - (now - pr) / 0.25)); c.fillRect(x, y, cw, rh); }
      } else if (kind === 'r' || kind === 'R') {
        c.strokeStyle = kind === 'R' ? COL.graphite : ink; c.lineWidth = 1;
        if (kind === 'R') c.setLineDash([1.5, 1.5]);
        c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
      } else if (kind === 'm' || kind === 'M') {
        c.strokeStyle = kind === 'M' ? COL.graphite : ink; c.lineWidth = 1; if (kind === 'M') c.setLineDash([1.5, 1.5]);
        c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
        if (unit === 1) { c.fillStyle = kind === 'M' ? COL.graphite : ink; c.fillRect(Math.round(x + cw / 2 - 0.5), Math.round(y + rh / 2 - 0.5), 1, 1); }
        var pm = cells.printed[i]; if (kind === 'm' && pm && now >= pm && now - pm < 0.3) { c.strokeStyle = rgba('ink', 1 - (now - pm) / 0.3); c.lineWidth = 2; c.strokeRect(x + 1, y + 1, cw - 2, rh - 2); }
      } else if (kind === 'q') { c.strokeStyle = COL.graphite; c.lineWidth = 1; c.setLineDash([1.5, 2]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]); }
      else if (kind === 'o' || kind === 'P') {
        var u = +k.slice(1); c.strokeStyle = COL.graphite; c.lineWidth = 1; c.setLineDash([1, lerp(4, 0.01, u)]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
        if (kind === 'P' && cw > 4) { c.globalAlpha *= 0.6; c.strokeRect(x + 2.5, y + 2.5, cw - 5, rh - 5); }
      } else if (kind === 's') { c.fillStyle = COL.grid; c.fillRect(x, y, cw, rh); }
      else if (kind === 'L') { c.strokeStyle = COL.grid; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.beginPath(); c.moveTo(x + 0.5, y + rh - 0.5); c.lineTo(x + cw - 0.5, y + 0.5); c.stroke(); }
      // training: a Filament inner glow, breathing at 0.5 Hz. At the lift it flares in left to right and settles.
      if (training && kind === trainKind) {
        var cellT = sweepT - (col / G.cols) * CFG.sweepSec;
        if (reduced() || cellT > 0) {
          var flare = reduced() ? 0 : Math.max(0, 0.7 * Math.exp(-cellT / 0.18));
          var flick = reduced() ? 1 : 1 + 0.035 * Math.sin(now * 7.3 + i * 1.91) * Math.sin(now * 3.1 + i * 0.7);
          c.globalAlpha = clamp((breathe * flick + flare) * 0.92, 0, 1) * Math.min(drawU, wk) * fade.a * dl;
          var spr = glowSprite(cw, rh, kind === 'w' || kind === 'A');
          c.drawImage(spr, x, y, cw, rh);
          // the flare at the lift is the same glow, doubled for a moment: Filament is never a fill
          if (flare > 0.05) { c.globalAlpha = clamp(flare, 0, 1) * Math.min(drawU, wk) * fade.a * dl; c.drawImage(spr, x, y, cw, rh); }
        }
      }
      c.globalAlpha = 1;
    }
  }
  cells.wakeTicked = {};

  /* ---------- the bet strip: time ---------- */
  // where on the travel a given number of days-at-today's-rate sits (log, from lo to the stop T)
  function travelX(days, lo, Ts) { if (Ts <= lo * 1.0001) return L.travel.x; var u = CFG.stripLog ? Math.log(Math.max(lo, days) / lo) / Math.log(Ts / lo) : (days - lo) / (Ts - lo); return L.travel.x + clamp(u, 0, 1.04) * L.travel.w; }
  // paydays the run would eat, placed where a run landing on that date sits on the travel (the pool's real schedule)
  var payCache = null;
  function paydayTs(br) {
    var key = S.day.toFixed(3) + br.pool + br.F + br.T;
    if (payCache && payCache.key === key) return payCache.v;
    var out = [];
    for (var m = monthOf(S.day) + 1; m <= 12; m++) { var pd = monthStart(m); var Cd = poolCompute(br.pool, S.day, pd); var Td = Cd / br.F; if (Td > br.T * 1.001) break; out.push({ m: m, T: Td }); }
    payCache = { key: key, v: out }; return out;
  }
  function drawStrip() {
    var c = ctxS, w = L.strip.w, h = L.strip.h;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, w, h);
    c.fillStyle = COL.grid; c.fillRect(0, 0, w, 1); c.fillRect(0, h - 1, w, 1);
    if (!S) return;
    var dl = dimLevel(), fade = inkFade();
    c.globalAlpha = dl;
    c.fillStyle = COL.reserve; c.fillRect(L.travel.x, 2, L.travel.w, h - 4);
    var br = S.powered && S.phase === 'play' ? betRange() : null, run = S.run;
    var lo = null, Ts = null;
    if (run && S.phase === 'play') { lo = run.lo; Ts = run.stopT; }
    else if (br) {
      if (stopDisp == null || nib.drag) stopDisp = { T: br.T, from: br.T, t0: -99, cur: br.T };
      else if (Math.abs(stopDisp.T - br.T) / Math.max(1e-6, br.T) > 0.03) { stopDisp = { T: br.T, from: stopDisp.cur || stopDisp.T, t0: now, cur: stopDisp.cur }; AU.feed(400); }
      else stopDisp.T = br.T;
      var ur = reduced() ? 1 : clamp((now - stopDisp.t0) / CFG.remapSec, 0, 1);
      var Td = lerp(stopDisp.from, stopDisp.T, ease(ur)); stopDisp.cur = Td; if (ur >= 1) stopDisp.from = stopDisp.T;
      lo = br.lo; Ts = Math.max(lo * 1.0002, Td);
    }
    var inkCol = mix('ink', 'dry', fade.u, fade.a), floodCol = mix('ink', 'dry', fade.u, 0.2 * fade.a);
    var floodTo = null;
    if (Ts != null) {
      if (run && S.phase === 'play') {
        var tr = training(run.pool), remain = tr.flops > 0 ? (run.C - run.done) / run.F0 : run.T0 * (1 - run.done / run.C);
        floodTo = remain <= lo ? L.travel.x + 2 : travelX(remain, lo, Ts);
      } else if (S.powered && nib.t > 0) floodTo = L.travel.x + nib.t * L.travel.w;
      // hairlines at round numbers of days, where they are at least 5 px apart
      c.fillStyle = COL.grid;
      var lastHx = -99;
      [0.5, 1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 240, 300, 365].forEach(function (dd) { if (dd <= lo || dd >= Ts) return; var hx = travelX(dd, lo, Ts); if (hx - lastHx < 5) return; lastHx = hx; c.fillRect(Math.round(hx), h - 9, 1, 6); });
      // paydays: every 1st the run would eat is a tall tick with its month's initial
      if (br || run) {
        var pays = run ? [] : paydayTs(br);
        if (run) { for (var m = monthOf(S.day) + 1; m <= 12; m++) { var pdd = monthStart(m) - S.day; if (pdd > Ts) break; pays.push({ m: m, T: pdd }); } }
        c.font = fMono(9); c.textBaseline = 'top';
        var lastPx = -99;
        pays.forEach(function (p) {
          var px = travelX(p.T, lo, Ts); if (px <= L.travel.x + 0.5) return;
          c.fillStyle = COL.graphite; c.fillRect(Math.round(px), 3, 1, h - 6);
          if (p.m < 12 && px - lastPx > 9) { c.fillText(MON[p.m].charAt(0), Math.round(px) + 3, 5); lastPx = px; }
        });
      }
    }
    // the flood (graphite, so the curve stays the heaviest mark) and the nib
    var nibX;
    if (run && S.phase === 'play' && floodTo != null) {
      if (nib.abort) floodTo = clamp(nib.abortX, L.home / 2, floodTo);
      c.fillStyle = floodCol; c.fillRect(L.travel.x, 2, Math.max(0, floodTo - L.travel.x), h - 4);
      nibX = Math.max(floodTo, nib.abort ? L.home / 2 : L.travel.x);
      c.fillStyle = S.hang ? rgba('ink', 0.55 * fade.a) : inkCol;
      c.fillRect(Math.round(nibX - L.nibW / 2), 1, L.nibW, h - 2);
      // the landing date rides beside the nib for the whole pour, and follows the cards
      if (!nib.abort && run.landProj != null) {
        var lt = run.landProj > CFG.endDay + 1 ? 'after 31 DEC' : fmtDay(run.landProj);
        c.font = fMono(L.laptop ? 11 : 10, false, 500); c.textBaseline = 'middle'; var ltw = c.measureText(lt).width;
        var ltx = nibX + L.nibW / 2 + 6; if (ltx + ltw > w - 4) ltx = nibX - L.nibW / 2 - 6 - ltw;
        // knock the month ticks out from under the date so it reads clean
        var lty = Math.round(h * 0.55) - 7; c.fillStyle = COL.reserve; c.fillRect(ltx - 3, lty, ltw + 6, 14);
        if (ltx < nibX) { c.fillStyle = floodCol; c.fillRect(ltx - 3, lty, ltw + 6, 14); }
        c.fillStyle = run.landProj > CFG.endDay + 1 ? inkCol : mix('graphite', 'dry', fade.u, fade.a); c.fillText(lt, ltx, Math.round(h * 0.55));
        L.landLabel = { x: L.strip.x + ltx - 3, y: L.strip.y + Math.round(h * 0.55) - 8, w: ltw + 6, h: 16 };
      } else L.landLabel = null;
      // dragging the nib home stops the run: the home end darkens to say so
      if (nib.abort && nib.abortX < L.home + 6) { c.strokeStyle = inkCol; c.lineWidth = 1.5; c.strokeRect(2.5, 3.5, L.home - 5, h - 7); }
      L.runNibX = nibX;
    } else if (S.powered && S.phase === 'play') {
      L.runNibX = null; L.landLabel = null;
      if (nib.t > 0) {
        nibX = L.travel.x + nib.t * L.travel.w;
        c.fillStyle = floodCol; c.fillRect(L.travel.x, 2, nibX - L.travel.x, h - 4);
        c.fillStyle = inkCol; c.fillRect(L.travel.x, Math.round(h / 2) - 1, nibX - L.travel.x, 2);
        c.fillRect(Math.round(nibX - L.nibW / 2), 1, L.nibW, h - 2);
      } else {
        var bx = (L.home - L.nibW) / 2, a = 1;
        // before the year's first drag the nib breathes, the one thing in the strip that asks to be touched
        if (!nibTouched && !reduced()) a = 0.62 + 0.38 * (0.5 + 0.5 * Math.cos((now - S.poweredAt) * 2 * Math.PI / 1.6));
        c.fillStyle = mix('ink', 'dry', fade.u, a * fade.a); c.fillRect(bx, 1, L.nibW, h - 2);
      }
    } else {
      // asleep, or the year is over: the nib rests at home
      var ga = S.powered ? fade.a : 1;
      c.fillStyle = S.powered ? mix('ink', 'dry', fade.u, ga) : COL.grid; c.fillRect((L.home - L.nibW) / 2, 1, L.nibW, h - 2);
    }
    c.globalAlpha = 1;
  }

  /* ================= DOM per frame ================= */
  var lastDate = '', lastMonths = '', lastCards = '', lastProj = '', readoutW = 0;
  var fig = { shown: null, roll: null };
  // money letters roll the figure like a counter; payroll drops it in one frame
  function rollFigure(before) {
    if (!S.figureOn || reduced()) return;
    var after_ = monthsVal();
    var a = Math.min(CFG.monthsCap, before), b = Math.min(CFG.monthsCap, after_);
    var steps = Math.abs((a >= 3 ? Math.floor(a) : a * 10) - (b >= 3 ? Math.floor(b) : b * 10));
    if (steps < 1) return;
    fig.roll = { from: a, to: b, t0: now, dur: clamp(steps * 0.012, 0.22, CFG.rollMaxSec), up: b > a };
  }
  function figureText() {
    if (!S.powered || !S.figureOn) return '';
    if (S.ended && S.ended.kind === 'bankrupt') return '0';
    var v = monthsVal();
    if (fig.roll) {
      var r = fig.roll, u = (now - r.t0) / r.dur;
      if (u >= 1) fig.roll = null;
      else { var e = r.up ? easeOut(u) : easeIn(u) * 0.35 + easeOut(u) * 0.65; v = lerp(r.from, r.to, e); }
    }
    return fmtMonths(v);
  }
  function updateDom() {
    if (!S) return;
    var dt = S.powered ? fmtDay(Math.min(S.day, CFG.endDay), true) : '';
    if (dt !== lastDate) { el.today.textContent = dt; lastDate = dt; }
    var mv = figureText();
    if (mv !== lastMonths) { if (fig.roll && lastMonths !== '') AU.roll(fig.roll.up); el.monthsN.textContent = mv; lastMonths = mv; }
    var cards = S.powered ? String(physicalCards()) : '';
    if (cards !== lastCards) { el.cards.textContent = cards; lastCards = cards; }
    var proj = '';
    var dragging = (nib.drag || kbdHolding()) && !S.run && S.phase === 'play';
    var b2 = dragging ? betRange() : null, T2 = b2 ? betDays(nib.t, b2) : 0, landD = b2 ? projectLand(b2.pool, T2 * b2.F) : 0;
    // the projection reads after the figure: '27 MONTHS → 25' (the months you will have when this run lands)
    if (b2 && S.figureOn) proj = '→ ' + fmtMonths(Math.max(0, monthsVal() - (Math.min(landD, CFG.endDay + 1) - S.day) / 30.4));
    if (proj !== lastProj) { el.monthsL.textContent = proj ? 'MONTHS ' + proj : 'MONTHS'; lastProj = proj; }
    if (b2) {
      var rtxt = landD > CFG.endDay + 1 - 1e-6 ? (landD === Infinity || landD > CFG.endDay + 2 ? 'after 31 DEC' : '31 DEC') : fmtDay(Math.min(landD, CFG.endDay));
      if (el.readout.textContent !== rtxt) { el.readout.textContent = rtxt; readoutW = el.readout.offsetWidth || 64; }
      var x = L.travel.x + nib.t * L.travel.w, rw = readoutW || 64;
      // the landing date floats above the cluster band, never over its cells (panel)
      var rxx = clamp(x - rw / 2, -L.strip.x + L.gutL, L.strip.w - rw), ryy = (L.cluster.y - L.strip.y) - 24;
      el.readout.style.transform = 'translate3d(' + rxx.toFixed(1) + 'px,' + ryy.toFixed(1) + 'px,0)';
      el.readout.style.top = '0px';
      el.readout.classList.add('on');
      L.readoutBox = { x: L.strip.x + rxx, y: L.strip.y + ryy, w: rw + 10, h: 20 };
      // at the stop, the right person names the limit (a thumb a pixel short of the end counts)
      if (nib.t >= 0.985 && now - stopNoteShown > CFG.stopNoteSec + 0.6) {
        stopNoteShown = now;
        var who = b2.why === 'mem' ? person('priya') : b2.why === 'horizon' ? (person('dev') || person('priya')) : null;
        var txt = b2.why === 'mem' ? WORLD.notes.memStop : b2.why === 'horizon' ? WORLD.notes.horizonStop : '31 DEC';
        dropNoteKey('split');
        writeNote(txt, who, { type: 'stop', x: L.travel.x + L.travel.w, key: 'stop' }, { typed: b2.why === 'year' || !who, life: CFG.stopNoteSec });
      }
      if (has('ayaan') && T2 * b2.F > b2.horC * 1.0001 && !nib.ayaanSaid) { nib.ayaanSaid = true; var CC = T2 * b2.F; writeNote(WORLD.notes.ayaanGoing, person('ayaan'), { type: 'paper', C: CC, L: yourLineLoss(CC), dy: -40, dx: 6, key: 'ayaan' }, { life: 3.2, optional: true }); }
      if (hasSystems() && !S.hints.split && T2 * b2.F > CFG.memC && nib.t < 0.9) { S.hints.split = true; writeNote(WORLD.notes.devSplit, person('dev') || person('rafael'), { type: 'strip', key: 'split' }, { life: 3 }); }
    } else el.readout.classList.remove('on');
    // Ayaan's demand, while it waits for your next touch, says so on the strip
    if (S.snapNext && !S.run && S.phase === 'play' && !S.hints.snapShown) { S.hints.snapShown = true; var ay = person('ayaan'); if (ay) writeNote('next run: to the stop', ay, { type: 'strip', key: 'snap' }, { life: 0 }); }
    // the first idle strip of a sitting teaches the drag
    if (S.phase === 'play' && S.powered && !S.run && (!S.letter || now - S.poweredAt > 8) && !nib.drag && !nibTouched && S.month >= 0 && now - S.poweredAt > 2.4) teach('drag', WORLD.teach.drag, person('priya'), { type: 'strip', key: 'teach-drag' }, 0, true);
    // pencil box in the band: the red-team countdown
    var boxTxt = '';   // the red-team countdown lives beside Lena's name; the band keeps only the words
    if (el.box.textContent !== boxTxt) { el.box.textContent = boxTxt; el.box.classList.toggle('on', !!boxTxt); }
    if (now - (S.teamAt || 0) > 0.25) { S.teamAt = now; updateTeamBoxes(); inkNames(); }
    el.strip.classList.toggle('grab', S.phase === 'play' && S.powered && !S.run && !nib.drag && nib.hover);
    el.strip.classList.toggle('grabbing', nib.drag);
    root.classList.toggle('dragging', !!b2);
  }
  function nameWeight(p) { var E = CFG.egoWeight[p.ego] || 550; return clamp(Math.round(400 + (E - 400) * p.mood / 70), 400, 700); }
  function renderTeam() {
    if (!S) return;
    var keep = {};
    S.team.forEach(function (p, idx) {
      var b = el.team.querySelector('[data-key="' + p.key + '"]');
      if (!b) {
        var li = document.createElement('li'); b = document.createElement('button'); b.type = 'button'; b.dataset.key = p.key;
        var w = document.createElement('span'); w.className = 'w'; w.textContent = p.first; b.appendChild(w);
        attachPress(b, p);
        li.appendChild(b); el.team.appendChild(li);
      }
      b.style.fontWeight = String(nameWeight(p));
      b.classList.toggle('low', p.mood < CFG.moodGraphite);
      b.setAttribute('aria-label', p.name + ', ' + p.role + (p.gone ? ', gone' : '') + '. Key ' + (idx + 1) + '. Press to wake them in a hang, take their offer, or ask for status.');
      if (p.gone && !b.querySelector('.x')) { var x = document.createElement('i'); x.className = 'x'; b.appendChild(x); }
      keep[p.key] = 1;
    });
    Array.prototype.forEach.call(el.team.querySelectorAll('button'), function (b) { if (!keep[b.dataset.key]) b.parentNode.parentNode.removeChild(b.parentNode); });
    var dense = L.paper && L.plot && (L.laptop ? S.team.length * 32 + 44 > L.paper.h - 30 : (L.paper.h < 330 || S.team.length * 30 + 40 > L.plot.y + L.plot.h));
    if (el.team.classList.contains('dense') !== !!dense) { el.team.classList.toggle('dense', !!dense); layoutGen++; }
    updateTeamBoxes(); inkNames();
  }
  // a press is a tap of 300 ms or less on the name's 44 px line
  function attachPress(b, p) {
    var t0 = 0, x0 = 0, y0 = 0, pid = null;
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); gesture(); t0 = performance.now(); x0 = e.clientX; y0 = e.clientY; pid = e.pointerId; });
    b.addEventListener('pointerup', function (e) {
      if (e.pointerId !== pid) return; pid = null;
      if (performance.now() - t0 <= CFG.pressMaxMs + 200 && Math.abs(e.clientX - x0) < 12 && Math.abs(e.clientY - y0) < 12) { b.dataset.pressed = '1'; pressName(p); setTimeout(function () { b.dataset.pressed = ''; }, 0); }
    });
    b.addEventListener('click', function (e) { e.stopPropagation(); if (e.detail === 0) pressName(p); }); // keyboard Enter/Space
  }
  // a name writes itself into the margin at 40 ms per letter
  function inkNames() {
    S.team.forEach(function (p) {
      var b = el.team.querySelector('[data-key="' + p.key + '"]'); if (!b) return;
      if (S.powered && now >= p.inkAt && !b.classList.contains('inked')) {
        var w = b.querySelector('.w'), n = p.first.length;
        w.style.transition = reduced() ? 'none' : 'clip-path ' + (n * CFG.nameCharSec) + 's steps(' + n + ')';
        b.classList.add('inked'); AU.write(n * 40);
      }
    });
  }
  function updateTeamBoxes() {
    S.team.forEach(function (p) {
      var b = el.team.querySelector('[data-key="' + p.key + '"]'); if (!b) return;
      var txt = '';
      if (S.filter && S.filter.by === p.key) txt = 'filter: ' + plural(Math.max(0, Math.ceil(S.filter.end - S.day)), 'day');
      if (S.redteam && p.key === 'lena') txt = 'red-team: ' + plural(Math.max(0, Math.ceil(S.redteam.until - S.day)), 'day');
      var bx = b.querySelector('.box');
      if (txt && !bx) { bx = document.createElement('span'); bx.className = 'box'; b.appendChild(bx); }
      if (bx) { if (txt) { if (bx.textContent !== txt) bx.textContent = txt; } else bx.parentNode.removeChild(bx); }
    });
  }

  /* ================= input ================= */
  function gesture() { if (!S) return; AU.unlock(); if (!S.powered && S.phase === 'asleep') power(); }
  // the first touch of a year powers the sheet and does nothing else
  root.addEventListener('pointerdown', function (e) {
    if (S && !S.powered && S.phase === 'asleep') { e.preventDefault(); e.stopPropagation(); gesture(); swallowUntil = performance.now() + 400; return; }
    // the end frame waits for a tap (after it has had time to be read); the mute word still works
    if (S && S.phase === 'over' && !(e.target && e.target.closest && e.target.closest('#fr-mute'))) { e.preventDefault(); e.stopPropagation(); if (now >= (S.endTapAt || 0)) { AU.unlock(); feedNewYear(); } swallowUntil = performance.now() + 400; return; }
    AU.unlock();
  }, true);
  var swallowUntil = 0;
  root.addEventListener('click', function (e) { if (performance.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  function nibHit(p) {
    var nx = nib.t > 0 ? L.travel.x + nib.t * L.travel.w : L.home / 2;
    if (Math.abs(p.x - nx) <= 22) return true;
    if (p.x < L.home + 6) return true;   // the home end always picks the nib up (after arrow keys too)
    return false;
  }
  el.strip.addEventListener('pointerdown', function (e) {
    if (!S || S.phase !== 'play' || !S.powered || moment.on) return;
    if (S.run) {
      // during a pour the nib can be dragged home to stop the run (panel: no locked run without a way out)
      var pr = rel(e, el.strip);
      if (L.runNibX != null && Math.abs(pr.x - L.runNibX) <= 24) { nib.abort = true; nib.pid = e.pointerId; nib.abortX = pr.x; try { el.strip.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); return; }
      tapSample(); return;
    }
    var p = rel(e, el.strip), br = betRange(); if (!br) return;
    if (S.snapNext) { nib.t = 1; nib.pinned = true; S.log.push(fmtDay(S.day) + ' Ayaan snaps the nib to the stop'); }
    else if (!nibHit(p)) return;
    else nib.pinned = false;
    dropNoteKey('teach-drag');
    nib.drag = true; nib.kbd = false; nib.ayaanSaid = false; nib.pid = e.pointerId; nib.hist = [[performance.now(), nib.t]]; nib.y = p.y; nib.lastX = p.x; nib.lastT = performance.now(); nibTouched = true;
    nib.grabDx = nib.t > 0 ? p.x - (L.travel.x + nib.t * L.travel.w) : 0;
    try { el.strip.setPointerCapture(e.pointerId); } catch (er) {}
    e.preventDefault();
  });
  el.strip.addEventListener('pointermove', function (e) {
    var p = rel(e, el.strip);
    if (nib.abort) { if (e.pointerId === nib.pid) nib.abortX = p.x; return; }
    if (!nib.drag) { nib.hover = S && S.phase === 'play' && (S.run ? (L.runNibX != null && Math.abs(p.x - L.runNibX) <= 24) : nibHit(p)); return; }
    if (e.pointerId !== nib.pid) return;
    var x = p.x - (nib.grabDx || 0);
    var t = clamp((x - L.travel.x) / L.travel.w, 0, 1);
    if (x < L.travel.x - L.home * 0.35) t = 0;
    if (nib.pinned) t = 1;
    var brm = betRange(); if (brm && t > 0 && !nib.pinned) t = snapGpt3(t, brm);
    var tn = performance.now(), v = Math.abs(p.x - (nib.lastX == null ? p.x : nib.lastX)) / Math.max(1, tn - nib.lastT);
    nib.lastX = p.x; nib.lastT = tn;
    AU.nib(t > 0 && t < 1 ? clamp(v / 1.2, 0, 1) : 0);
    nib.t = t; nib.y = p.y;
    nib.hist.push([tn, t]); if (nib.hist.length > 60) nib.hist.shift();
    el.strip.setAttribute('aria-valuenow', String(Math.round(t * 100)));
  });
  el.strip.addEventListener('pointerleave', function () { nib.hover = false; });
  function restT() {
    var tUp = performance.now(), h = nib.hist, v = h[0][1];
    if (tUp - h[0][0] < 100) return h[0][1];
    for (var i = h.length - 1; i >= 0; i--) { if (tUp - h[i][0] >= 100) { v = h[i][1]; break; } }
    return v;
  }
  function endAbortDrag(cancel) {
    if (!nib.abort) return;
    var home = nib.abortX < L.home + 6;
    nib.abort = false;
    if (home && !cancel) abortRun();
  }
  function liftNib() {
    if (nib.abort) { endAbortDrag(false); return; }
    if (!nib.drag) return;
    nib.drag = false; AU.nib(0);
    var t = nib.pinned ? 1 : restT(), br = betRange();
    nib.t = t; nib.pinned = false;
    if (br) launch(betDays(t, br));
  }
  el.strip.addEventListener('pointerup', function (e) { if (e.pointerId === nib.pid) liftNib(); });
  el.strip.addEventListener('pointercancel', function (e) { if (e.pointerId === nib.pid) { if (nib.abort) endAbortDrag(true); else liftNib(); } });
  el.strip.addEventListener('lostpointercapture', function (e) { if (e.pointerId === nib.pid) { if (nib.abort) endAbortDrag(true); else if (nib.drag) liftNib(); } });
  el.paperwrap.addEventListener('pointerdown', function (e) { if (e.target.closest && e.target.closest('button')) return; if (S && S.run && !moment.on) tapSample(); });
  // the checkpoint flick happens on the words themselves
  (function () {
    var st = null;
    el.band.addEventListener('pointerdown', function (e) {
      if (!S || !S.powered || moment.on) return;
      if (!S.checkpoint || S.checkpoint.state !== 'up') { if (S.run) tapSample(); return; }
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, h: [[performance.now(), e.clientX, e.clientY]] };
      try { el.band.setPointerCapture(e.pointerId); } catch (er) {}
    });
    el.band.addEventListener('pointermove', function (e) {
      if (!st || e.pointerId !== st.id) return;
      st.h.push([performance.now(), e.clientX, e.clientY]); if (st.h.length > 8) st.h.shift();
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      el.sample.style.transition = 'none';
      var canRight = S.checkpoint && canShip(S.checkpoint.run), canUp = S.day >= CFG.publishFromDay;
      if (dx > Math.abs(dy)) el.sample.style.transform = 'translate3d(' + (Math.max(0, dx) * (canRight ? 1 : 0.2)).toFixed(1) + 'px,0,0)';
      else el.sample.style.transform = 'translate3d(0,' + (Math.min(0, dy) * (canUp ? 1 : 0.2)).toFixed(1) + 'px,0)';
    });
    function end(e) {
      if (!st || e.pointerId !== st.id) return;
      var h = st.h, a = h[0], b = h[h.length - 1], dtm = Math.max(1, b[0] - a[0]), dx = e.clientX - st.x, dy = e.clientY - st.y, vx = (b[1] - a[1]) / dtm, vy = (b[2] - a[2]) / dtm;
      st = null;
      var dir = null;
      if ((dx > CFG.flickPx || (vx > CFG.flickVel && dx > 10)) && dx > Math.abs(dy)) dir = 'right';
      else if (dy < -CFG.flickPx || (vy < -CFG.flickVel && dy < -10)) dir = 'up';
      if (!dir && Math.abs(dx) < 8 && Math.abs(dy) < 8 && S.run) tapSample();
      if (!dir || !flickCheckpoint(dir)) { el.sample.style.transition = 'transform .25s cubic-bezier(.2,.7,.3,1)'; el.sample.style.transform = ''; }
    }
    el.band.addEventListener('pointerup', end); el.band.addEventListener('pointercancel', end);
  })();
  el.mute.addEventListener('click', function (e) { e.stopPropagation(); setMuted(!AU.muted); });
  el.mute.addEventListener('pointerdown', function (e) { e.stopPropagation(); AU.unlock(); });
  function setMuted(m) {
    AU.unlock(); AU.setMuted(m);
    el.mute.textContent = m ? 'SOUND OFF' : 'SOUND ON';
    el.mute.setAttribute('aria-pressed', m ? 'true' : 'false');
    el.mute.setAttribute('aria-label', m ? 'Sound is off. Press to turn it on (M).' : 'Sound is on. Press to mute (M).');
    store('frontier.sim.muted', m ? '1' : '0');
  }
  document.addEventListener('keydown', function (e) {
    if (!S) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (S.phase === 'over') { if ((k === 'Enter' || k === ' ') && now >= (S.endTapAt || 0)) { e.preventDefault(); feedNewYear(); } return; }
    if (!S.powered) { if (k === 'Enter' || k === ' ') { e.preventDefault(); gesture(); } return; }
    if (k === 'm' || k === 'M') { setMuted(!AU.muted); return; }
    if (S.phase !== 'play' || moment.on) return;
    AU.unlock();
    var fresh = S.letter && now - (S.letter.shownAt || -99) < CFG.letterTapGuardSec;
    if (k === 'ArrowUp') { e.preventDefault(); if (S.letter && !fresh) resolveLetter('take'); return; }
    if (k === 'ArrowDown') { e.preventDefault(); if (S.letter && !fresh) resolveLetter('pass'); return; }
    if (k === 'Escape' && S.run) { e.preventDefault(); abortRun(); return; }
    if (k === 'p' || k === 'P') { flickCheckpoint('up'); return; }
    if (/^[1-9]$/.test(k)) { var p = S.team[+k - 1]; if (p) pressName(p); return; }
    if (k === 'ArrowRight' && !S.letter && S.checkpoint && S.checkpoint.state === 'up' && document.activeElement !== el.strip && canShip(S.checkpoint.run) && !nib.kbd) { e.preventDefault(); flickCheckpoint('right'); return; }
    if ((k === 'ArrowRight' || k === 'ArrowLeft') && !S.run) {
      e.preventDefault();
      var stp = e.shiftKey ? CFG.keyStepShift : CFG.keyStep;
      nib.t = S.snapNext ? 1 : clamp(nib.t + (k === 'ArrowRight' ? stp : -stp), 0, 1); nib.kbd = true; nib.kbdAt = now; nibTouched = true;
      el.strip.setAttribute('aria-valuenow', String(Math.round(nib.t * 100)));
      AU.nib(0.5); setTimeout(function () { AU.nib(0); }, 60);
      return;
    }
    if ((k === 'Enter' || k === ' ') && (document.activeElement === el.strip || document.activeElement === document.body || !document.activeElement || document.activeElement === root)) {
      e.preventDefault();
      if (!S.run) { var br = betRange(); if (br) { launch(S.snapNext ? br.T : betDays(nib.t, br)); nib.kbd = false; } }
      return;
    }
    if (k === 's' || k === 'S') tapSample();
  });
  document.addEventListener('visibilitychange', function () {
    if (!CFG.pauseWhenHidden) return;
    if (document.hidden && nib.drag) liftNib();
    paused = document.hidden; AU.suspend(document.hidden);
    if (!document.hidden) lastT = performance.now() / 1000;
  });
  window.addEventListener('blur', function () { if (nib.drag) liftNib(); });
  var resizeT = null;
  function onResize() { if (resizeT) clearTimeout(resizeT); layout(); resizeT = setTimeout(layout, 120); }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', function () { setTimeout(layout, 60); setTimeout(layout, 400); });
  if (window.ResizeObserver) { try { new ResizeObserver(function () { onResize(); }).observe(root); } catch (e) {} }
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  root.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', function () { staticDirty = true; });
  AU.onBurst = function (k) { var L2 = S && S.letter; if (L2 && L2.tipEl && !reduced()) { var s = (0.8 + 0.5 * k).toFixed(2); L2.tipEl.style.transform = 'scale(' + s + ')'; } };

  /* ================= loop ================= */
  var lastT = performance.now() / 1000;
  function drawAll() { drawPaper(); drawCluster(); drawStrip(); updateDom(); }
  var perf = { n: 0, sum: 0, max: 0, statics: 0, staticMs: 0 };
  function frame() {
    var t = performance.now() / 1000, w0 = performance.now();
    frameDt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t; now = t + nowOffset;
    try {
      runTimers();
      if (S) {
        step(frameDt);
        if (S.phase === 'play') pourUpdate();
        pumpLetters(frameDt);
        stepView(); stepHeads(); stepBand(); stepMoment(); stepNotes();
        if ((S.lineShown && now - S.lineAt < 1.3) || (S.powered && now - S.rivalsShown < 1) || dimFx) staticDirty = true;
        if (S.endFx && now - S.endFx.t0 < 2.2) staticDirty = true;
        drawAll();
      }
    } catch (e) { console.error(e); }
    var w1 = performance.now() - w0; perf.n++; perf.sum += w1; if (w1 > perf.max) perf.max = w1;
    if (perf.n >= 240) { perf.last = { avg: +(perf.sum / perf.n).toFixed(2), max: +perf.max.toFixed(2), staticAvg: perf.statics ? +(perf.staticMs / perf.statics).toFixed(2) : 0, statics: perf.statics }; perf.n = 0; perf.sum = 0; perf.max = 0; perf.statics = 0; perf.staticMs = 0; }
    requestAnimationFrame(frame);
  }

  /* ================= test hook for playtesters and bots ================= */
  function fastForward(days) {
    AU.quiet = true;
    try { fastForwardInner(days); } finally { AU.quiet = false; }
  }
  function fastForwardInner(days) {
    var target = S.day + days, guard = 0;
    while (S.phase === 'play' && S.day < target - 1e-9 && guard++ < 40000) {
      if (moment.on) clearMoment();
      S.landUntil = 0;
      if (!S.started) S.started = true;
      advanceDays(Math.min(0.1, target - S.day));
      if (S.phase !== 'play') break;
      pourUpdate();
      nowOffset += 0.35; now += 0.35; runTimers();
      if (S.letter) S.letter.realBurn = (S.letter.realBurn || 0) + 0.1;   // a bot reads at about a day a second
      pumpLetters();
    }
    if (moment.on) clearMoment();
    if (S) S.landUntil = 0;
  }
  function clearMoment() { moment = { on: false }; el.moment.classList.remove('on'); root.classList.remove('dim28'); dimFx = null; AU.unduck(); }
  function letterInfo(Lt) { return Lt ? { kind: Lt.kind, who: Lt.who || null, from: Lt.from, body: Lt.body, up: Lt.up && !Lt.grey ? (typeof Lt.up === 'function' ? Lt.up() : Lt.up) : null, down: Lt.down || null, grey: !!Lt.grey, forced: !!Lt.forced, fuseLeft: Lt.fuse ? +(1 - (S.day - Lt.shownDay) / Lt.fuse).toFixed(3) : null } : null; }
  window.__frontier = {
    state: function () {
      if (!S) return null;
      var tr = training(), br = S.powered && S.phase === 'play' ? betRange() : null;
      return {
        date: fmtDay(Math.min(S.day, CFG.endDay), true), day: +S.day.toFixed(3), month: S.month, phase: S.phase, powered: S.powered, started: S.started, seed: S.seed,
        bank: Math.round(S.bank), months: +monthsVal().toFixed(2), monthsShown: el.monthsN.textContent, burn: Math.round(burn()), stake: +S.stake.toFixed(4), post: S.post, credits: Math.round(S.credits),
        cards: { physical: physicalCards(), training: tr.phys, eq: tr.eq, owned: S.owned.v + S.owned.a, rented: S.rentals.reduce(function (a, r) { return a + (S.day < r.end ? r.n : 0); }, 0), meridian: S.mer ? { cards: S.mer.cards, live: fmtDay(S.mer.live), alloc: S.mer.alloc } : null, ordered: S.orders.reduce(function (a, o) { return a + o.n; }, 0), serving: S.serving, lent: S.lent ? S.lent.n : 0 },
        team: S.team.map(function (p) { return { key: p.key, name: p.name, role: p.role, mood: Math.round(p.mood), salary: p.salary, gone: p.gone, weight: nameWeight(p) }; }),
        run: S.run ? { C: S.run.C, T: +S.run.T0.toFixed(3), s: +(S.run.done / S.run.C).toFixed(4), r: +S.run.r.toFixed(3), launch: fmtDay(S.run.launchDay), blind: S.run.blind, pool: S.run.pool, landProj: S.run.landProj, landDate: S.run.landProj > CFG.endDay + 1 ? 'after 31 DEC' : fmtDay(S.run.landProj) } : null,
        hang: S.hang ? S.hang.label : null, hangNight: S.hang ? !!S.hang.night : null,
        runs: S.runs.map(function (r) { return { C: r.C, loss: +r.loss.toFixed(4), onLine: onLine(r), clean: r.clean, amount: r.amount, published: !!r.published, shipped: !!r.shipped, vaulted: r.clean && !r.published && !r.shipped, land: fmtDay(r.landDay), landDay: r.landDay, scandal: r.scandal || null, cap: r.capHere || null }; }),
        lastSample: S.bandSample ? { id: S.bandSample.id, text: S.bandSample.text, tier: S.bandSample.tier, fray: S.bandSample.fray, crawl: S.bandSample.crawl, kind: S.bandSample.kind, C: S.bandSample.C, launchDay: S.bandSample.launchDay } : null,
        wall: { W: S.W, C: wallC(), filtersDone: S.filtersDone, filter: S.filter ? fmtDay(S.filter.end) : null, offer: !!S.offer },
        caps: S.caps.map(function (c) { return { id: c.id, C: c.C, fired: c.fired, contaminated: c.contaminated }; }),
        bet: br ? { lo: br.lo, T: br.T, why: br.why, F: br.F, stopC: br.T * br.F, horC: br.horC } : null,
        nib: { t: nib.t, drag: nib.drag },
        letter: letterInfo(S.letter), letterRealBurn: S.letter ? +(S.letter.realBurn || 0).toFixed(2) : null, letterShownFor: S.letter ? +(now - S.letter.shownAt).toFixed(2) : null,
        headline: headNow ? headNow.el.textContent : null, endInfo: S.endInfo, priority: S.priority, aborted: S.runs.filter(function (r) { return r.aborted; }).length,
        visibleNotes: S.notes.filter(function (n) { return !n.gone && !n.hidden; }).map(function (n) { return { text: n.text, key: n.key, box: n.box }; }),
        queue: S.queue.map(function (x) { return x.kind; }),
        checkpoint: S.checkpoint ? { state: S.checkpoint.state, sampleId: S.checkpoint.sampleId, afterRedteam: !!S.checkpoint.afterRedteam, C: S.checkpoint.run.C, capHere: S.checkpoint.run.capHere || null, canPublish: S.day >= CFG.publishFromDay, canShip: canShip(S.checkpoint.run) } : null,
        rivals: S.rivals.map(function (r) { var lp = r.pubs[r.pubs.length - 1]; return { name: r.name, published: lp.C, passed: r.passed, hidden: rivalC(r, S.day) }; }),
        frontier: frontier(), silent: S.silent, gpt3: S.gpt3, meridian: !!S.mer, shipped: S.shipped, opened: S.opened, raise: S.raise, ended: S.ended, moment: moment.on, miracle: S.miracle, choice: S.choice,
        perf: perf.last || null, farthestClean: farthestClean(), farthestPublished: farthestPublished(), stats: S.stats, notes: S.notes.map(function (n) { return n.el.textContent; }),
        log: S.log.slice(-12), fullLog: S.log.slice()
      };
    },
    act: function (name, pl) {
      pl = pl || {};
      if (!S) return false;
      if (name !== 'newGame' && !S.powered) { gesture(); if (name === 'power') return true; }
      switch (name) {
        case 'power': gesture(); return true;
        case 'take': return resolveLetter('take');
        case 'pass': return resolveLetter('pass');
        case 'hire': if (S.letter && S.letter.kind === 'hire' && (!pl.id || pl.id === S.letter.who)) return resolveLetter('take'); return false;
        case 'raise': if (S.letter && S.letter.kind === 'term') return resolveLetter('take'); return false;
        case 'rent': if (S.letter && S.letter.kind === 'rent') return resolveLetter('take'); return false;
        case 'buy': if (S.letter && S.letter.kind === 'buy') return resolveLetter('take'); return false;
        case 'meridian': if (S.letter && S.letter.kind === 'meridian') return resolveLetter('take'); return false;
        case 'publish': return flickCheckpoint('up');
        case 'ship': return flickCheckpoint('right');
        case 'press': case 'wake': case 'filter': case 'redteam': {
          var key = pl.id || (name === 'filter' ? (person('priya') ? 'priya' : 'ines') : name === 'redteam' ? 'lena' : null);
          var p = S.team.find(function (q) { return q.key === key || q.name === key || q.first === key; }) || (name === 'wake' ? staff()[0] : null);
          if (!p) return false; pressName(p); return true;
        }
        case 'launch': {
          if (S.run || S.phase !== 'play') return false;
          var br = betRange(); if (!br) return false;
          if (S.snapNext) return launch(br.T);
          var T = pl.days != null ? pl.days : pl.C != null ? pl.C / br.F : betDays(pl.fraction != null ? pl.fraction : 0.5, br);
          return launch(T);
        }
        case 'tap': return tapSample();
        case 'abort': return abortRun();
        case 'continue': if (S.phase === 'over') { feedNewYear(); return true; } return false;
        case 'endMonth': { if (S.phase !== 'play') return false; S.started = true; var m = S.month; fastForward(Math.max(0.01, monthStart(m + 1) - S.day + 0.01)); return S.month !== m || S.phase !== 'play'; }
        case 'skip': { if (!pl.days) { nowOffset += 0.35; now += 0.35; runTimers(); pumpLetters(); return true; } S.started = true; fastForward(pl.days); return true; }
        case 'newGame': newYear(pl.seed != null ? pl.seed : null); layout(); return true;
        case 'mute': setMuted(pl.on !== false); return true;
      }
      return false;
    },
    speed: function (n) { speedMult = Math.max(0.1, +n || 1); return speedMult; }
  };

  /* ================= boot ================= */
  if (store('frontier.sim.muted') === '1') { AU.muted = true; el.mute.textContent = 'SOUND OFF'; el.mute.setAttribute('aria-pressed', 'true'); el.mute.setAttribute('aria-label', 'Sound is off. Press to turn it on (M).'); }
  readFonts();
  layout();
  newYear();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { readFonts(); layout(); S && S.notes.forEach(placeNote); }).catch(function () {});
  requestAnimationFrame(frame);
})();
