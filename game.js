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
    head: $('fr-head'), lab: $('fr-lab'), bought: $('fr-bought'), today: $('fr-today'), hour: $('fr-hour'), dateline: $('fr-dateline'), mute: $('fr-mute'),
    months: $('fr-months'), monthsN: $('fr-months-n'), proj: $('fr-proj'),
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
  var rng = Math.random, vis = mulberry(7);
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
  function tokens(C) { return CFG.tokA * Math.pow(C / CFG.tokRef, CFG.tokExp); }
  function C_of_tokens(D) { return CFG.tokRef * Math.pow(D / CFG.tokA, 1 / CFG.tokExp); }
  function params(C) { return C / (6 * tokens(C)); }
  function Lstar(run, x) { return Lline(x) * run.m * (1 + run.b); }
  function lossAt(run, q) {
    q = clamp(q, P0, 1);
    var z = (log10(q) + 3.5) / 3.5, yl = Math.log(Lstar(run, q * run.C)), H0 = Math.log(CFG.startLoss) - Math.log(Lstar(run, P0 * run.C));
    return Math.exp(yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z)));
  }
  function amount(rq) { if (rq < CFG.cleanR) return 0; if (rq <= 1) return Math.min(CFG.frayAmounts, 1 + Math.floor((rq - CFG.cleanR) / CFG.frayStep + 1e-9)); return CRAWL; }

  /* ================= the year ================= */
  var S = null, speedMult = 1, paused = false;
  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }
  var slipSeq = 0;

  function newYear(seed) {
    GEN++; timers = [];
    if (seed == null) seed = seedFromHash();
    if (seed == null) seed = Math.floor(Math.random() * 1e9);
    rng = mulberry(seed >>> 0);
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
      rivals: CFG.rivals.map(function (r) { var j = U(-CFG.rivalJitter, CFG.rivalJitter); return { key: r.key, name: r.name, c0: r.c0, tau: r.tau, period: r.period, offset: r.offset, jit: j, extra: 0, pubs: [{ C: r.c0 * Math.pow(10, j) / 2, day: -1, t: -99 }], nextPub: r.period * U(0.2, 1.0), passed: false, passedAt: -99 }; }),
      hangsThisMonth: 0, tomDemandDue: false, hints: {}, notes: [], heads: [], gpt3: false, gpt3At: 0, lineAt: 0, lineShown: false,
      ended: null, endFx: null, bags: {}, t3used: {}, t4used: {}, miracle: false, choice: null, landFx: null, pendingTap: null,
      stats: { hangs: 0, crossings: 0, published: 0, shipped: 0, hires: 0, walked: 0, launches: 0, filters: 0 }, log: []
    };
    addPerson('priya', true);
    view.l = CFG.plotLeftMinLog; view.r = CFG.plotRightMinLog; view.anim = null;
    nib.t = 0; nib.drag = false; nib.kbd = false; stopDisp = null; nibTouched = false;
    cells.born = []; cells.kinds = []; cells.printed = []; cells.prevUnits = 0; cells.unit = 1; cells.regroup = null; cells.sweep = -99; cells.wake = -99; cells.wakeTicked = {}; cells.lastBornAt = 0;
    fig.shown = null; fig.roll = null;
    staticDirty = true; headLive.forEach(function (h) { if (h.el.parentNode) h.el.parentNode.removeChild(h.el); }); headLive = [];
    root.classList.add('asleep'); root.classList.remove('dim28', 'undim', 'dry', 'sold');
    el.sample.textContent = ''; el.sample.className = ''; el.sample.style.cssText = ''; el.notes.textContent = ''; el.box.classList.remove('on');
    el.lab.classList.remove('struck'); el.bought.textContent = ''; el.bought.classList.remove('on'); el.hour.textContent = ''; el.today.textContent = '';
    el.letterzone.textContent = ''; el.moment.classList.remove('on', 'out'); el.team.textContent = ''; el.readout.classList.remove('on'); el.proj.textContent = '';
    el.monthsN.textContent = ''; el.cards.textContent = '';
    moment = { on: false }; band = null;
    lastDate = lastMonths = lastCards = lastProj = '';
    root.setAttribute('aria-label', 'Frontier. A lab sim on one sheet of paper. Touch anywhere to begin.');
    renderTeam();
    S.log.push('year seed ' + seed);
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
  // the cards training right now, in V100-equivalents and in physical cards
  function training() {
    var v = S.owned.v, a = S.owned.a, rented = 0;
    S.rentals.forEach(function (r) { if (rentalLive(r)) rented += r.n; });
    v += rented + merAlloc();
    var lent = S.lent ? S.lent.n : 0;
    v -= Math.min(v, lent);
    var phys = v + a, serve = S.shipped ? clamp(Math.round(phys * CFG.servingShare), CFG.servingMin, CFG.servingMax) : 0;
    serve = Math.min(serve, Math.max(0, phys - 1));
    S.serving = serve;
    var sv = Math.min(v, serve); v -= sv; a -= Math.min(a, serve - sv);
    return { v: v, a: a, phys: v + a, eq: v * CFG.v100eq.v100 + a * CFG.v100eq.a100, flops: v * CFG.flops.v100 + a * CFG.flops.a100 };
  }
  function rentPrice(day) { var p = CFG.rentPrice[0][1]; CFG.rentPrice.forEach(function (x) { if (day >= x[0]) p = x[1]; }); return p; }
  function rentPerDay() { var t = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) t += r.n * r.price * 24; }); return t; }
  function apiRevenue() { return S.shipped ? S.shipped.rev : 0; }
  function payroll() { var t = CFG.base + CFG.upkeepPerOwned * (S.owned.v + S.owned.a); staff().forEach(function (p) { if (p.payFrom <= S.day + 0.5) t += p.salary; }); return t; }
  function burn(mod) {
    mod = mod || {};
    var sal = 0; staff().forEach(function (p) { sal += p.salary; });
    var rent = 0; S.rentals.forEach(function (r) { if (S.day < r.end) rent += r.n * r.price * 24 * 30.4; });
    return CFG.base + sal + CFG.upkeepPerOwned * (S.owned.v + S.owned.a + (mod.owned || 0)) + rent + (mod.rent || 0) + (mod.salary || 0) - apiRevenue();
  }
  function monthsVal(mod) { mod = mod || {}; var b = burn(mod); if (b <= 0) return CFG.monthsCap; return Math.max(0, (S.bank + (mod.bank || 0)) / b); }
  function fmtMonths(m) { m = Math.min(CFG.monthsCap, Math.max(0, m)); return m >= 3 ? String(Math.floor(m)) : (Math.floor(m * 10) / 10).toFixed(1); }
  function cleanRuns() { return S.runs.filter(function (r) { return r.clean; }); }
  function farthestClean() { var m = 0; S.runs.forEach(function (r) { if (r.clean && r.C > m) m = r.C; }); return m; }
  function farthestPublished() { var m = 0; S.runs.forEach(function (r) { if (r.clean && (r.published || r.shipped) && r.C > m) m = r.C; }); return m; }
  function frontier() { var m = 0; S.rivals.forEach(function (rv) { rv.pubs.forEach(function (p) { if (p.C > m) m = p.C; }); }); if (S.day >= D_GPT3) m = Math.max(m, CFG.gpt3C); return m; }
  function wallC() { return C_of_tokens(CFG.passes * S.W); }
  function rivalC(rv, day) { return rv.c0 * Math.pow(10, rv.jit + rv.extra + (day / 30.44) / rv.tau); }

  /* ================= the bet: time on the strip ================= */
  function betRange() {
    var tr = training(); if (tr.flops <= 0) return null;
    var F = tr.flops, yearDays = Math.max(0.05, CFG.endDay + 1 - S.day);
    var far = farthestClean();
    var memDays = hasSystems() ? Infinity : CFG.memC / F;
    var horC = far > 0 ? far * CFG.horizonMult : CFG.horizonFirst;
    var horDays = has('ayaan') ? Infinity : horC / F;
    var T = Math.min(memDays, horDays, yearDays), why = T === yearDays ? 'year' : T === memDays ? 'mem' : 'horizon';
    var lo = Math.min(CFG.probeDays, T);
    return { F: F, lo: lo, T: T, why: why, horC: horC, eq: tr.eq, phys: tr.phys };
  }
  function betDays(t, br) { br = br || betRange(); return br ? br.lo + t * (br.T - br.lo) : 0; }

  /* ================= time ================= */
  function frozen() { return !S || S.phase !== 'play' || !S.started || nib.drag || now < S.landUntil || moment.on || paused; }
  function step(dt) {
    if (frozen()) return;
    var rate = S.run ? (S.hang ? CFG.pourDaysPerSec : S.run.dayRate) : CFG.idleDaysPerSec;
    advanceDays(dt * rate * speedMult);
  }
  function advanceDays(dd) {
    var guard = 0;
    while (dd > 1e-9 && S.phase === 'play' && guard++ < 100000) {
      var nextInt = Math.floor(S.day + 1e-9) + 1, st = Math.min(dd, nextInt - S.day);
      st = flow(st);
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
      tr = training();
      // never pour past the landing inside one slice
      if (tr.flops > 0) { var left = (run.C - run.done) / tr.flops; if (left < d) d = Math.max(1e-6, left); }
    }
    S.bank -= rentPerDay() * d;
    S.bank += apiRevenue() / 30.4 * d;
    if (S.mer && S.day >= S.mer.live) S.credits = Math.max(0, S.credits - merAlloc() * CFG.meridianRate * 24 * d);
    if (S.bank <= 0 && S.rentals.length) { S.rentals = []; S.log.push(fmtDay(S.day) + ' bank empty: rentals taken back'); }
    if (S.hang) { if (S.day + d >= S.hang.until) resumeFromHang(); return d; }
    if (!run) return d;
    var lam = CFG.hangLambda * Math.sqrt(Math.max(1, tr.eq) / 8) * infraMult();
    if (run.done > 0 && rng() < lam * d) { startHang(); return d; }
    run.done = Math.min(run.C, run.done + tr.flops * d);
    return d;
  }
  function onNewDay(n) {
    if (n > CFG.endDay) { endYear('survived'); return; }
    if (dom(n) === 1) startMonth(monthOf(n));
    if (S.phase !== 'play') return;
    while (S.newsIdx < WORLD.news.length && iso(WORLD.news[S.newsIdx][0]) <= n) { fireNews(WORLD.news[S.newsIdx]); S.newsIdx++; }
    var evs = S.events.filter(function (e) { return e.day <= n; });
    S.events = S.events.filter(function (e) { return e.day > n; });
    evs.forEach(function (e) { try { e.fn(); } catch (er) { console.error(er); } });
    // cards: orders ink in, rentals end, rent-outs return, Meridian goes live
    S.orders = S.orders.filter(function (o) { if (n >= o.arrive) { if (o.type === 'a100') S.owned.a += o.n; else S.owned.v += o.n; S.log.push(fmtDay(n) + ' ' + o.n + ' cards arrive'); return false; } return true; });
    S.rentals = S.rentals.filter(function (r) { return n < r.end; });
    if (S.lent && n >= S.lent.until) S.lent = null;
    if (S.filter && n >= S.filter.end) finishFilter();
    if (S.redteam && n >= S.redteam.until) finishRedteam();
    S.rivals.forEach(function (rv) { if (n >= rv.nextPub) { rivalPublish(rv); rv.nextPub = n + rv.period * U(0.7, 1.3); } });
    if (dom(n) === 11 || dom(n) === 21) slot(n, false);
    renderTeam();
  }

  /* ================= the 1st ================= */
  function startMonth(m) {
    S.month = m;
    // notes from last month are cleared, except the ones that live on the paper all year
    S.notes.forEach(function (x) { if (!x.keep) fadeNote(x); }); S.notes = S.notes.filter(function (x) { return x.keep; });
    S.tomDemandDue = S.tomDemandDue || S.hangsThisMonth >= 3; S.hangsThisMonth = 0;
    if (S.day - S.lastPublishDay > CFG.noPaperDays) staff().forEach(function (p) { if (p.ego >= 4) moodAdd(p, -CFG.noPaperMood); });
    var pay = payroll();
    S.bank -= pay; S.figureOn = true;
    AU.payroll(); jolt(); fig.roll = null;
    S.log.push(fmtDay(S.day) + ' payroll ' + Math.round(pay) + ' bank ' + Math.round(S.bank));
    if (S.bank < 0) { endYear('bankrupt'); return; }
    // Meridian's queue
    if (S.mer && S.day >= CFG.meridianQueueFromDay) {
      var fr = frontier(), far = farthestClean(), full = S.mer.cards;
      var was = S.mer.alloc;
      S.mer.alloc = far * CFG.meridianQueueFull >= fr ? full : far * CFG.meridianQueueHalf >= fr ? full / 2 : full / 4;
      if (S.mer.alloc < full) writeNote(WORLD.notes.queue, null, { type: 'cluster' }, { pencil: true, keep: false });
      if (S.mer.alloc !== was) S.log.push(fmtDay(S.day) + ' Meridian queue ' + S.mer.alloc);
    }
    // relevance: the month nobody knocks
    var silent = false;
    if (S.day >= CFG.relevanceFromDay) {
      var vaulted = 0; S.runs.forEach(function (r) { if (r.clean && !r.published && !r.shipped && r.C > vaulted) vaulted = r.C; });
      var viewC = Math.max(farthestPublished(), CFG.openedMult * S.openedC, CFG.vaultedMult * vaulted);
      silent = viewC < frontier() * CFG.relevanceShare || S.scandalSilentMonth === m;
    }
    if (silent && S.silentPrev) { endYear('forgotten'); return; }
    S.silent = silent; S.silentPrev = silent;
    if (silent) { S.queue = []; S.log.push(fmtDay(S.day) + ' silent month'); }
    // evals on the 3rd
    if (S.run) {
      var run = S.run, q = Math.pow(run.done / run.C, 1.5);
      writeNote(WORLD.notes.evals, null, { type: 'pen', dy: 16, dx: 6 }, { pencil: true });
      var at = Math.floor(S.day) + 2;
      S.events.push({ day: at, fn: function () { evalsReading(run, q); } });
    }
    slot(S.day, true);
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
      function () { return makeBroker(day); },
      function () { return makeRentOut(day); },
      function () { return makeOpen(day); }
    ];
    for (var i = 0; i < order.length; i++) { var L = order[i](); if (L) return L; }
    return null;
  }
  // the effect line: computed live from the current bank and burn
  function upMonths(mod) { return 'MONTHS ' + fmtMonths(monthsVal()) + ' → ' + fmtMonths(monthsVal(mod)); }
  function upCards(n, pencil) { var c = physicalCards(); return 'CARDS ' + c + ' → ' + (c + n) + (pencil ? ' in pencil' : ''); }

  function makeAcqui() {
    var heads = staff().length + 1, total = heads * CFG.acquiPerHead, T = WORLD.letters.acqui, forced = S.stake < CFG.boardBelow;
    return { kind: 'acqui', from: T.from, body: fill(T.body, { total: money(total) }), fuse: CFG.fuse.acqui, forced: forced, why: forced ? T.forced : '',
      up: function () { return T.take; }, down: forced ? null : T.pass,
      take: function () { endYear('bought', { price: total }); }, pass: function () {} };
  }
  function termEligible(day) {
    if (S.termLetterOut) return false;
    if (day < S.termBlockUntil) return false;
    if (day >= CFG.crashDay && day < CFG.marketOpenDay) return false;
    if (!S.raise.aTaken) return seriesAProof();
    if (!S.raise.bTaken) return S.runs.some(function (r) { return r.clean && r.C >= CFG.seriesB.needC && r.landDay >= CFG.apiDay; });
    return false;
  }
  function onLine(r) { return r.loss <= Lline(r.C) * CFG.seriesA.onLine; }
  function seriesAProof() {
    var ok = S.runs.filter(function (r) { return r.clean && r.landDay >= CFG.lineFromDay && onLine(r); });
    var far = 0; ok.forEach(function (r) { if (r.C > far) far = r.C; });
    if (far < S.raise.aNeed) return false;
    return ok.some(function (r) { return r.C * Math.pow(10, CFG.seriesA.decades) <= far * 1.0001; });
  }
  function makeTerm(day) {
    var A = !S.raise.aTaken, T = A ? WORLD.letters.termA : WORLD.letters.termB, cash, post;
    if (A) { var t = day < CFG.crashDay ? CFG.seriesA.pre : CFG.seriesA.after; cash = t.cash; post = t.post; }
    else { cash = CFG.seriesB.cash; post = S.shipped ? CFG.seriesB.postApi : CFG.seriesB.post; }
    S.termLetterOut = true;
    return { kind: 'term', round: A ? 'A' : 'B', from: T.from, body: fill(T.body, { cash: money(cash), post: money(post) }), fuse: CFG.fuse.term, money: true,
      up: function () { return upMonths({ bank: cash }) + ' · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * (1 - cash / post)); }, down: T.pass,
      take: function () {
        S.termLetterOut = false; S.bank += cash; S.stake *= (1 - cash / post); S.post = post;
        if (A) S.raise.aTaken = true; else S.raise.bTaken = true;
        S.log.push(fmtDay(S.day) + ' raised ' + money(cash));
      },
      pass: function () { S.termLetterOut = false; if (A) S.raise.aNeed = farthestClean() * CFG.seriesA.passMult; else S.raise.bTaken = true; } };
  }
  function makeMeridian(day) {
    if (!S.offered.meridian && !S.mer && day >= CFG.meridianFromDay && farthestClean() >= CFG.meridianNeedC) {
      S.offered.meridian = true;
      var T = WORLD.letters.meridian;
      return { kind: 'meridian', from: T.from, body: T.body, fuse: CFG.fuse.meridian,
        up: function () { return T.take; }, down: T.pass,
        take: function () { S.mer = { cards: CFG.meridianCards, live: Math.floor(S.day) + CFG.meridianLead, alloc: CFG.meridianCards, second: false }; S.credits = CFG.meridianCredits; S.rentals.forEach(function (r) { r.noRenew = true; }); S.log.push(fmtDay(S.day) + ' Meridian signed'); },
        pass: function () { S.meridianPassed = true; } };
    }
    if (S.meridianPassed && !S.offered.meridian2 && !S.mer && day >= CFG.meridian2FromDay) {
      S.offered.meridian2 = true;
      var T2 = WORLD.letters.meridian2;
      return { kind: 'meridian', from: T2.from, body: T2.body, fuse: CFG.fuse.meridian,
        up: function () { return 'CARDS +' + CFG.meridian2Cards + ' in pencil · STAKE ' + pct(S.stake) + ' → ' + pct(S.stake * CFG.meridian2Stake); }, down: T2.pass,
        take: function () { S.mer = { cards: CFG.meridian2Cards, live: Math.floor(S.day) + CFG.meridianLead, alloc: CFG.meridian2Cards, second: true }; S.credits = CFG.meridianCredits / 2; S.stake *= CFG.meridian2Stake; S.rentals.forEach(function (r) { r.noRenew = true; }); S.log.push(fmtDay(S.day) + ' Meridian (second offer) signed'); },
        pass: function () {} };
    }
    return null;
  }
  function makeRenewal(day) {
    if (S.mer) return null;
    var r = S.rentals.find(function (x) { return !x.renewOffered && !x.noRenew && x.end - day <= CFG.renewWindow && x.end > day; });
    if (!r) return null;
    r.renewOffered = true;
    var date = fmtShort(r.end), refused = day >= CFG.apiDay && rng() < CFG.renewRefuseShare;
    if (refused) {
      var N = WORLD.letters.renewNo;
      return { kind: 'renewal', from: N.from, body: fill(N.body, { n: r.n, date: date }), fuse: CFG.fuse.renewal, grey: true, why: N.grey,
        up: null, down: fill(N.pass, { date: date }), take: function () {}, pass: function () {} };
    }
    var price = day >= CFG.apiDay ? CFG.renewPriceAfterApi : rentPrice(day), T = WORLD.letters.renew;
    return { kind: 'renewal', from: T.from, body: fill(T.body, { n: r.n, date: date, price: price.toFixed(2) }), fuse: CFG.fuse.renewal,
      up: function () { return T.take; }, down: fill(T.pass, { date: date }),
      take: function () { r.end += CFG.rentTermDays; r.price = price; r.renewOffered = false; }, pass: function () {} };
  }
  var HIRES = [['dev', '2020-01-11'], ['ayaan', '2020-01-21'], ['tom', '2020-02-11'], ['lena', '2020-03-11'], ['rafael', '2020-03-11'], ['sunhee', '2020-04-11'], ['ines', '2020-06-11'], ['kofi', '2020-08-01'], ['ayaan2', '2020-06-11']];
  function hireEligible(key) {
    if (S.offered['hire:' + key]) return false;
    var onTeam = function (k) { return S.team.some(function (p) { return p.key === k; }); };
    if (key === 'rafael') return !hasSystems() && !onTeam('rafael');
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
    return { kind: 'hire', who: k, from: d.name, fromHand: true, body: d.pitch + ' ' + money(salary) + ' a month.', bodyHand: true, fuse: CFG.fuse.hire, money: true,
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
      return demandLetter(p, T3, function () { S.snapNext = true; }, function () { moodAdd(p, -40); });
    }
    if ((p = person('tom')) && S.tomDemandDue && !S.offered['demand:tom']) {
      S.offered['demand:tom'] = true; S.tomDemandDue = false; var T4 = WORLD.letters.tomDemand;
      return demandLetter(p, T4, function () { S.tomOffUntil = S.day + 7; }, function () { moodAdd(p, -30); });
    }
    if ((p = person('sunhee')) && !S.offered['demand:sunhee'] && day >= p.joined + 45) {
      S.offered['demand:sunhee'] = true; var T5 = WORLD.letters.sunheeDemand;
      return demandLetter(p, T5, function () { S.events.push({ day: Math.floor(S.day) + 30, fn: function () { S.sunheeTrick = true; staticDirty = true; } }); }, function () { walk(p, 'Halcyon'); });
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
    return { kind: 'poach', who: target.key, from: rival.toUpperCase(), body: fill(T.body, { rival: rival, first: target.first }), fuse: CFG.fuse.poach,
      up: function () { return 'STAKE ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.counterStake) + ' · ' + he + ' stays'; }, down: fill(T.pass, { he: he, rival: rival }),
      take: function () { S.stake = Math.max(0, S.stake - CFG.counterStake); moodAdd(target, CFG.counterMood); },
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
        take: function () { var st0 = S.started ? Math.floor(S.day) + 1 : 0; S.rentals.push({ n: n, price: price, start: st0, end: st0 + CFG.rentTermDays }); S.log.push(fmtDay(S.day) + ' rented ' + n); },
        pass: function () {} };
      if (S.mer) { L.grey = true; L.why = WORLD.letters.rentGrey; L.up = null; }
      return L;
    }
    var a = day >= CFG.buyA100.fromDay && S.buyNextA, spec = a ? CFG.buyA100 : CFG.buyV100;
    if (day >= CFG.buyA100.fromDay) S.buyNextA = !S.buyNextA;
    var priceB = spec.price * (day >= CFG.apiDay ? CFG.afterApiPriceMult : 1);
    var lead = spec.leadDays + (day >= CFG.covidOrderFrom && day <= CFG.covidOrderTo ? CFG.covidOrderExtra : 0) + (day >= CFG.apiDay ? CFG.afterApiLeadExtra : 0);
    var TB = a ? WORLD.letters.buyA : WORLD.letters.buyV;
    var poor = S.bank < priceB;
    return { kind: 'buy', from: TB.from, body: fill(TB.body, { price: '$' + Math.round(priceB).toLocaleString('en-US'), weeks: Math.round(lead / 7) }), fuse: CFG.fuse.broker, money: true,
      grey: poor, why: poor ? 'not in the bank' : '',
      up: poor ? null : function () { return upMonths({ bank: -priceB, owned: spec.n }) + ' · ' + upCards(spec.n, true); }, down: TB.pass,
      take: function () { S.bank -= priceB; S.orders.push({ type: a ? 'a100' : 'v100', n: spec.n, ordered: S.day, arrive: Math.floor(S.day) + lead }); S.log.push(fmtDay(S.day) + ' bought ' + spec.n + (a ? ' A100' : ' V100') + ' for ' + money(priceB)); },
      pass: function () {} };
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
  function pumpLetters() {
    if (!S || S.phase !== 'play') { AU.fuse(false); return; }
    if (!S.letter && S.queue.length && now >= S.letterGapUntil) {
      var L = S.queue.shift();
      S.letter = L; L.shownDay = S.day; L.shownAt = now;
      buildLetter(L); AU.letter();
      S.log.push(fmtDay(S.day) + ' letter up: ' + L.kind + (L.who ? ':' + L.who : ''));
    }
    var L2 = S.letter;
    if (L2) {
      var burning = L2.fuse > 0 && !frozen();
      AU.fuse(burning);
      if (L2.fuse > 0) {
        var left = 1 - (S.day - L2.shownDay) / L2.fuse;
        if (L2.fuseEl) L2.fuseEl.style.width = (clamp(left, 0, 1) * 100).toFixed(3) + '%';
        if (left <= 0) { resolveLetter(L2.forced ? 'take' : 'pass', true); return; }
      }
      if (now - (L2.effAt || 0) > 0.35) { L2.effAt = now; renderEffect(L2); }
    } else AU.fuse(false);
    behindSlip(!!(S.letter && S.queue.length));
  }
  var behindEl = null;
  function behindSlip(on) {
    if (on && !behindEl) { behindEl = document.createElement('div'); behindEl.className = 'fr-letter fr-behind'; behindEl.setAttribute('aria-hidden', 'true'); behindEl.style.cssText = 'transform:translate3d(6px,-5px,0);z-index:2;box-shadow:none;cursor:default;pointer-events:none;opacity:.9'; el.letterzone.insertBefore(behindEl, el.letterzone.firstChild); }
    else if (!on && behindEl) { if (behindEl.parentNode) behindEl.parentNode.removeChild(behindEl); behindEl = null; }
  }
  function buildLetter(L) {
    var d = document.createElement('div');
    d.className = 'fr-letter' + (L.grey ? ' grey' : '');
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', 'Letter from ' + L.from + '. ' + L.body + (L.up && !L.grey ? ' Flick up, or press the up arrow, to take.' : '') + (L.down ? ' Flick down, or press the down arrow, to let it go.' : ''));
    if (L.fuse > 0) { var f = document.createElement('div'); f.className = 'fuse'; var tip = document.createElement('i'); f.appendChild(tip); d.appendChild(f); L.fuseEl = f; L.tipEl = tip; }
    var from = document.createElement('div'); from.className = 'from' + (L.fromHand ? ' hand' : ''); from.textContent = L.from; d.appendChild(from);
    var body = document.createElement('div'); body.className = 'body' + (L.bodyHand ? ' hand' : ''); body.textContent = L.body; d.appendChild(body);
    if (L.why) { var w = document.createElement('div'); w.className = 'why'; w.textContent = L.why; d.appendChild(w); }
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
    var html = '';
    if (up) html += '<div data-a="take">↑ ' + esc(up) + '</div>';
    if (L.down) html += '<div class="dn" data-a="pass">↓ ' + esc(L.down) + '</div>';
    if (L.effHtml !== html) { var lines0 = L.effEl.offsetHeight; L.effHtml = html; L.effEl.innerHTML = html; if (L.dom && L.fitted && L.effEl.offsetHeight !== lines0) fitLetter(L); }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function attachFlick(d, L) {
    var st = null;
    d.addEventListener('pointerdown', function (e) {
      gesture();
      if (S.letter !== L || moment.on) return;
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
      var h = st.h, a = h[0], b = h[h.length - 1], vy = (b[2] - a[2]) / Math.max(1, b[0] - a[0]), dy = e.clientY - st.y, dx = e.clientX - st.x;
      var tgt = st.target && st.target.closest ? st.target.closest('[data-a]') : null;
      var tapped = Math.abs(dy) < 6 && Math.abs(dx) < 6 && tgt ? tgt.getAttribute('data-a') : null;
      st = null; d.classList.remove('drag');
      if (cancel) { d.style.transform = ''; return; }
      var act = null;
      if (dy < -CFG.flickPx || (vy < -CFG.flickVel && dy < -10)) act = 'take';
      else if (dy > CFG.flickPx || (vy > CFG.flickVel && dy > 10)) act = 'pass';
      else if (tapped) act = tapped; // a click on the effect line works too, for mice and switch users
      if (act === 'take' && (L.grey || !L.up)) act = null;
      if (act === 'pass' && !L.down) act = null;
      d.style.transform = '';
      if (act && S.letter === L) resolveLetter(act);
    }
    d.addEventListener('pointerup', function (e) { end(e, false); });
    d.addEventListener('pointercancel', function (e) { end(e, true); });
  }
  function resolveLetter(act, byFuse) {
    var L = S && S.letter; if (!L) return false;
    if (act === 'take' && (L.grey || !L.up) && !byFuse) return false;
    if (act === 'pass' && !L.down && !byFuse) return false;
    S.letter = null; AU.fuse(false); S.letterGapUntil = now + (act === 'take' ? CFG.letterTakeSec : CFG.letterPassSec) + 0.05;
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
    if (S.filter && S.filter.by === p.key) S.filter = null;
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
      if (smp && !S.filter && smp.fray === CFG.priyaAskK) { S.offer = { sampleId: smp.id }; writeNote(WORLD.notes.fray3, p, { type: 'band' }); return; }
      if (smp && !S.filter && smp.fray >= 1 && smp.fray <= 2) { writeNote(WORLD.notes.fray12, p, { type: 'band' }); return; }
    }
    if (p.key === 'lena' && S.checkpoint && S.checkpoint.state === 'up' && !S.redteam) { startRedteam(); return; }
    // otherwise they write their status beside their work
    var st = WORLD.people[p.key].status[0];
    if (p.key === 'priya' || p.key === 'ines') st = S.filter ? 'filter: ' + Math.max(0, Math.ceil(S.filter.end - S.day)) + ' days' : st;
    if (p.key === 'lena' && S.redteam) st = 'red-team: ' + Math.max(0, Math.ceil(S.redteam.until - S.day)) + ' days';
    writeNote(st, p, { type: 'name', key: p.key });
  }
  function wake(p) {
    var h = S.hang; if (!h) return;
    if (h.woken) return;
    h.woken = true;
    h.until = Math.min(h.until, S.day + CFG.wokenRestartDays);
    moodAdd(p, -(p.key === 'tom' ? CFG.wakeMoodTom : CFG.wakeMood));
    writeNote('up', p, { type: 'name', key: p.key });
    renderTeam();
    S.log.push(fmtDay(S.day) + ' woke ' + p.first);
  }

  /* ================= the data wall: Priya's filter job ================= */
  function noticeSample(smp) {
    var lead = person('priya') || person('ines');
    if (!lead || S.filter || !smp) return;
    if (smp.fray >= CFG.priyaAutoK) { S.offer = { sampleId: smp.id }; writeNote(WORLD.notes.fray, lead, { type: 'band' }); }
  }
  function startFilter(p) {
    var cost = CFG.filterCost * Math.pow(2, S.filtersDone);
    var days = p.key === 'priya' ? (has('ines') ? CFG.filterDaysInes : CFG.filterDays) : CFG.filterDays;
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
  function finishFilter() { S.W *= CFG.filterW; S.filtersDone++; S.filter = null; S.log.push(fmtDay(S.day) + ' filter done'); renderTeam(); }

  /* ================= runs ================= */
  function launch(T) {
    if (!S || S.phase !== 'play' || S.run || !S.powered) return false;
    var br = betRange(); if (!br) return false;
    T = clamp(T, br.lo, br.T);
    var C = T * br.F;
    var b = 0, blind = C > br.horC * 1.0001;
    if (blind) b = rng() < CFG.blindShare ? U(CFG.blindHi[0], CFG.blindHi[1]) : U(CFG.blindLo[0], CFG.blindLo[1]);
    var run = { id: S.runs.length + 1, C: C, T0: T, lo: br.lo, stopT: br.T, F0: br.F, dayRate: T < CFG.minPourSec ? T / CFG.minPourSec : CFG.pourDaysPerSec, m: sunheeM(), b: b, blind: blind,
      D: tokens(C), launchDay: S.day, landDay: null, done: 0, pts: [], lastLog: -99, cks: [], ckIdx: 0, sampled: {}, autoDone: {}, lastAuto: now, hangs: [], q: 0, launchedAt: now };
    run.r = run.D / (CFG.passes * S.W); run.loss = Lstar(run, C); run.wallAt = wallC();
    // a checkpoint left unflicked goes to the vault and its words sink
    if (S.checkpoint && S.checkpoint.state === 'up') { sinkBand(); S.checkpoint = null; }
    S.run = run; S.started = true; S.stats.launches++; S.snapNext = false;
    AU.lift(); AU.vibrate(8); AU.motor('train', br.phys, 0.3);
    cells.sweep = now;
    pan(C);
    S.log.push(fmtDay(S.day) + ' launch ' + sci(C) + ' T=' + T.toFixed(2) + 'd r=' + run.r.toFixed(2));
    el.sample.classList.remove('flickable');
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
    CFG.autoSampleQ.forEach(function (aq, i) { if (!run.autoDone[i] && q >= aq) { run.autoDone[i] = true; if (now - (S.lastTapAt || -99) > CFG.autoQuietSec) sampleNow('auto'); } });
    if (run.T0 > CFG.autoEveryLongerThan && now - run.lastAuto > CFG.autoEverySec && now - (S.lastTapAt || -99) > CFG.autoQuietSec) { run.lastAuto = now; sampleNow('auto'); }
    if (s >= 1 - 1e-12) land(run);
  }
  function tapSample() {
    if (!S || !S.run || S.hang || S.phase !== 'play') return false;
    S.lastTapAt = now; S.tapFx = now;
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
    var down = infra ? CFG.infraRestartDays : ((hour < 8 ? 8 - hour : 32 - hour) / 24 + (covid ? CFG.hangCovidExtraDays : 0));
    var lostDays = infra ? U(0, CFG.infraRewindDays) : U(0, 1);
    var hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    var label = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    var pt = run.pts[run.pts.length - 1];
    S.hang = { start: S.day, until: S.day + down, label: label, lost: lostDays * training().flops, at: now };
    run.hangs.push(S.day);
    S.hangsThisMonth++; S.stats.hangs++;
    var tom = has('tom') && S.day >= S.tomOffUntil;
    if (pt && tom) S.hangMarks.push({ x: pt[0], y: pt[1] });
    AU.hang(); AU.scratch(0);
    el.hour.textContent = ' · ' + label;
    writeNote(label, null, { type: 'pen', dy: -24, dx: 10 }, { pencil: true, ring: tom });
    if (tom) after(0.6, function () { writeNote(WORLD.notes.tomHang, person('tom'), { type: 'pen', dy: -44, dx: 18 }); });
    staticDirty = true;
    S.log.push(fmtDay(S.day) + ' hang ' + label + ' down ' + down.toFixed(2) + 'd');
  }
  function resumeFromHang() {
    var run = S.run, h = S.hang; S.hang = null; el.hour.textContent = '';
    if (!run) return;
    run.done = Math.max(0, run.done - h.lost);
    var q = Math.pow(run.done / run.C, 1.5);
    run.pts = run.pts.filter(function (p) { return p[2] <= q + 1e-12; });
    run.lastLog = run.pts.length ? log10(run.pts[run.pts.length - 1][2]) : -99;
    AU.motor('train', training().phys, 0.3);
    cells.sweep = now;
  }
  function land(run) {
    run.done = run.C; run.landDay = S.day; run.q = 1;
    S.run = null; S.pendingTap = null; el.hour.textContent = '';
    run.clean = run.r <= 1; run.amount = amount(run.r);
    var smp = makeSample(run, 1, 'land');
    S.runs.push(run);
    AU.motor('idle', 0, 0.6); AU.scratch(0);
    S.landUntil = now + (run.clean ? CFG.landCleanSec : CFG.landWallSec);
    S.landFx = { run: run, t0: now };
    staticDirty = true;
    var capNew = null;
    if (run.clean) {
      S.caps.forEach(function (c) { if (!c.fired && run.loss <= c.L) { c.fired = true; capNew = c; } });
      if (capNew) { smp = makeSample(run, 1, 'cap', capNew.id); fireCapFx(capNew); run.capHere = capNew.id; }
      S.checkpoint = { run: run, state: 'up', sampleId: null };
      // passing a rival
      S.rivals.forEach(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; if (lp && lp.day >= 0 && !rv.passed && run.C > lp.C && run.loss < Lline(lp.C) * rv.offset * (S.sunheeTrick ? CFG.sunheeBend : 1)) { rv.passed = true; rv.passedAt = now; staticDirty = true; } });
      if (person('sunhee') && run.m < 1 && !S.hints.sunhee) { S.hints.sunhee = true; after(1, function () { writeNote(WORLD.notes.toldYou, person('sunhee'), { type: 'paper', C: run.C, L: run.loss, dy: 12, dx: -10 }); }); }
      if (run.C >= CFG.gpt3C && run.loss <= CFG.gpt3Loss * CFG.miracleTol && !S.miracle) {
        S.miracle = true; S.log.push(fmtDay(S.day) + ' MIRACLE');
        // if the same landing fires a capability, the miracle waits for that moment to finish
        var mWait = capNew ? 0.3 + Math.max(CFG.momentSec, 0.4 + (smp.momentText || smp.text).split(/\s+/).length * CFG.wordMs / 1000 + 1.7) + 0.3 : CFG.landCleanSec * 0.5;
        after(mWait, function () { lineMoment('miracle'); });
      }
    } else {
      S.stats.crossings++;
      S.scars.push({ from: Math.min(run.wallAt, run.C), to: run.C, t0: now + 0.3, line: run.lastFray || smp.text });
      after(0.3, function () { AU.hatch(900); });
    }
    var autoPub = run.clean && S.firstAuthor && S.day >= CFG.publishFromDay && has('priya');
    if (autoPub) { S.firstAuthor = false; run.author = 'Raman et al.'; S.checkpoint = { run: run, state: 'auto', sampleId: null }; }
    after(0.3, function () {
      run.bandText = (smp.momentText && smp.cap === 'paragraph') ? bandCut(smp.momentText) : smp.text;
      if (capNew) capMoment(smp, capNew); else showBand(smp, 'rise');
      if (S.checkpoint && S.checkpoint.run === run) { S.checkpoint.sampleId = smp.id; if (S.checkpoint.state === 'up') el.sample.classList.add('flickable'); }
      if (run.clean && !autoPub) checkpointHints();
    });
    if (autoPub) {
      var wait = capNew ? 0.3 + 0.4 + (smp.momentText || smp.text).split(/\s+/).length * CFG.wordMs / 1000 + 1.9 : 1.7;
      after(wait, function () { if (S.checkpoint && S.checkpoint.run === run && S.checkpoint.state === 'auto') { S.checkpoint = null; liftWordsFx('up', run); publish(run, true); } });
    }
    nib.t = 0;
    S.log.push(fmtDay(S.day) + ' land ' + sci(run.C) + ' L=' + run.loss.toFixed(3) + (run.clean ? ' clean' : ' PAST WALL') + (capNew ? ' cap ' + capNew.id : ''));
  }
  function checkpointHints() {
    var p = person('priya') || staff()[0]; if (!p) return;
    if (!S.hints.publish && S.day >= CFG.publishFromDay) { S.hints.publish = true; after(0.7, function () { writeNote(WORLD.notes.hintPublish, p, { type: 'band' }); }); }
    else if (!S.hints.ship && S.day >= CFG.shipFromDay && canShip(S.checkpoint && S.checkpoint.run)) { S.hints.ship = true; after(0.7, function () { writeNote(WORLD.notes.hintShip, p, { type: 'band' }); }); }
  }

  /* ================= the checkpoint flick: publish, ship, vault ================= */
  function capsOn(run) { return S.caps.filter(function (c) { return c.fired && run.loss <= c.L; }); }
  function canShip(run) { return !!run && run.clean && S.day >= CFG.shipFromDay && capsOn(run).some(function (c) { return c.id === 'paragraph'; }); }
  function flickCheckpoint(dir) {
    var ck = S && S.checkpoint; if (!ck || ck.state !== 'up' || S.phase !== 'play') return false;
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
        var contaminated = capsOn(run).some(function (c) { return c.contaminated; });
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
    S.redteam = { until: Math.floor(S.day) + days, runId: ck.run.id };
    ck.state = 'redteam'; el.sample.classList.remove('flickable');
    writeNote('red-team: ' + days + ' days', person('lena'), { type: 'name', key: 'lena' });
    renderTeam();
    S.log.push(fmtDay(S.day) + ' red-team starts');
  }
  function finishRedteam() {
    var rt = S.redteam; S.redteam = null;
    var run = S.runs.find(function (r) { return r.id === rt.runId; });
    if (run) {
      run.redteamed = true;
      // the words come back up, safe to show, and can be flicked until the next lift
      S.checkpoint = { run: run, state: 'up', sampleId: null, afterRedteam: true };
      var orig = run.bandText || run.landText, smp = makeSample(run, 1, 'land'); smp.text = orig || smp.text; smp.fray = 0; run.landText = orig || run.landText;
      S.checkpoint.sampleId = smp.id; showBand(smp, 'rise'); el.sample.classList.add('flickable');
    }
    renderTeam();
  }
  function scandal(run, kind) {
    run.scandal = kind === 'publish' ? WORLD.notes.scandalPublish : WORLD.notes.scandalShip;
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
    if (S.filtersDone === 0 && rng() < CFG.contamination) {
      c.contaminated = true;
      if (has('lena')) after(CFG.momentSec + 0.6, function () { writeNote(WORLD.notes.leak, person('lena'), { type: 'band' }); });
    }
    S.log.push(fmtDay(S.day) + ' capability ' + c.id + (c.contaminated ? ' (contaminated)' : ''));
  }
  function evalsReading(run, q) {
    if (S.phase !== 'play') return;
    if (q * run.r > 1) return;
    var L = lossAt(run, q), capNew = null;
    S.caps.forEach(function (c) { if (!c.fired && L <= c.L) { c.fired = true; capNew = c; } });
    if (capNew) { fireCapFx(capNew); var smp = makeSample(run, q, 'cap', capNew.id); capMoment(smp, capNew); }
  }
  var moment = { on: false };
  function capMoment(smp, cap) {
    if (moment.on) { after(0.5, function () { capMoment(smp, cap); }); return; } // one moment at a time
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
    after(words + 1.1, function () { el.moment.classList.add('out'); el.moment.classList.remove('on'); showBand(smp, 'instant'); if (S.checkpoint && S.checkpoint.state === 'up') el.sample.classList.add('flickable'); });
    after(Math.max(CFG.momentSec, words + 1.7), function () { moment = { on: false }; });
  }
  function stepMoment() {
    if (!moment.on || !moment.spans) return;
    var k = Math.floor((now - moment.t0 - 0.4) / (CFG.wordMs / 1000)) + 1;
    while (moment.shown < moment.spans.length && moment.shown < k) { moment.spans[moment.shown++].style.opacity = '1'; AU.token(); }
  }
  function hasLine() { var cr = cleanRuns(); if (cr.length < 2) return false; var lo = Infinity, hi = 0; cr.forEach(function (r) { lo = Math.min(lo, r.C); hi = Math.max(hi, r.C); }); return hi >= lo * 10; }
  // 28 May and the miracle: everything but your line, your dots and their point dims; a silent second
  function lineMoment(kind) {
    if (moment.on) { after(0.5, function () { lineMoment(kind); }); return; }
    moment = { on: true, t0: now, kind: kind };
    root.classList.remove('undim'); root.classList.add('dim28'); staticDirty = true; dimFx = { t0: now, dir: 1 };
    AU.scratch(0);
    after(0.4, function () { AU.duckSilence(80, 1000, 600); });
    after(CFG.momentSec - 0.6, function () { root.classList.add('undim'); root.classList.remove('dim28'); dimFx = { t0: now, dir: -1 }; staticDirty = true; });
    after(CFG.momentSec, function () { moment = { on: false }; staticDirty = true; if (kind === 'gpt3' && has('ayaan')) writeNote(WORLD.notes.toldYou, person('ayaan'), { type: 'paper', C: CFG.gpt3C, L: Lline(CFG.gpt3C), dy: -30, dx: -64 }); });
  }

  /* ================= history ================= */
  function fireNews(n) {
    var day = iso(n[0]);
    headline(fmtDay(day, true) + ' · ' + n[1]);
    S.rulerPhrases.push({ day: day, text: n[2], t: now }); staticDirty = true;
    switch (n[3]) {
      case 'line': S.lineShown = true; S.lineAt = now; AU.feed(1200); break;
      case 'crash': withdrawTerms(); break;
      case 'gpt3': S.gpt3 = true; S.gpt3At = now; staticDirty = true; if (hasLine()) lineMoment('gpt3'); else if (has('ayaan')) after(1.5, function () { writeNote(WORLD.notes.toldYou, person('ayaan'), { type: 'paper', C: CFG.gpt3C, L: Lline(CFG.gpt3C), dy: -30, dx: -64 }); }); break;
    }
  }
  function headline(text) { if (S) S.heads.push({ text: text, day: S.day }); }
  var headLive = [];
  function stepHeads(dt) {
    if (!S) return;
    var w0 = L.headsW || 300;
    var busy = reduced() ? headLive.length > 0 : headLive.some(function (h) { return h.x + h.w > w0 - 28; });
    if (S.heads.length && !busy) {
      var hd = S.heads.shift();
      while (hd && S.heads.length && S.day - hd.day > 20) hd = S.heads.shift(); // a headline weeks late is dropped; its ruler phrase stays
      var d = document.createElement('div');
      d.className = 'h'; d.textContent = hd.text; el.heads.appendChild(d);
      var w = d.offsetWidth;
      var v = (w0 + w) / CFG.headlineDriftSec, prev = headLive[headLive.length - 1];
      if (prev) v = Math.min(v, prev.v); // never catch the one ahead
      headLive.push({ el: d, x: reduced() ? 0 : w0, w: w, v: v, born: now });
    }
    headLive = headLive.filter(function (h) {
      if (reduced()) { // no drift: the headline simply sits at the top of the paper for its seven seconds
        if (now - h.born > CFG.headlineDriftSec) { if (h.el.parentNode) h.el.parentNode.removeChild(h.el); return false; }
        h.el.style.transform = 'translate3d(0,0,0)'; return true;
      }
      h.x -= h.v * dt; // headlines never pause, slow or interrupt anything
      if (h.x + h.w < 0) { if (h.el.parentNode) h.el.parentNode.removeChild(h.el); return false; }
      h.el.style.transform = 'translate3d(' + h.x.toFixed(1) + 'px,0,0)';
      return true;
    });
  }

  /* ================= rivals ================= */
  function rivalPublish(rv) { rv.pubs.push({ C: rivalC(rv, S.day), day: S.day, t: now }); rv.passed = false; staticDirty = true; }

  /* ================= endings ================= */
  function endYear(kind, extra) {
    if (!S || S.phase !== 'play') return;
    S.phase = 'over'; S.ended = { kind: kind, day: S.day, extra: extra || {} };
    S.endFx = { kind: kind, t0: now };
    if (kind === 'survived' && S.choice == null && ((S.letter && S.letter.kind === 'december') || S.queue.some(function (q) { return q.kind === 'december'; }))) S.choice = 'fought';
    S.queue = []; if (S.letter && S.letter.dom) { var d = S.letter.dom; d.classList.remove('in'); d.classList.add('pass'); } S.letter = null; AU.fuse(false); behindSlip(false);
    if (nib.drag) { nib.drag = false; el.strip.classList.remove('grabbing'); }
    AU.nib(0); AU.scratch(0);
    el.readout.classList.remove('on'); el.proj.textContent = '';
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
    root.setAttribute('aria-label', 'Frontier. The year has ended: ' + kind + '. A new year begins in a few seconds.');
    S.log.push(fmtDay(S.day) + ' END ' + kind);
    var feedAt = CFG.endFeedSec + (kind === 'bankrupt' ? 0.8 : 0);
    after(feedAt, function () { feedNewYear(); });
  }
  // the paper feeds out to the left and a fresh 1 January slides in from the right
  function feedNewYear() {
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
    after(1.4, function () { if (S.month < 0) startMonth(0); });
  }

  /* ================= samples ================= */
  function bag(name, pool) { var b = S.bags[name]; if (!b || !b.length) b = S.bags[name] = shuffle(pool.slice()); return b.pop(); }
  function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
  function bandCut(txt) {
    if (txt.length <= CFG.bandMaxChars) return txt;
    var parts = sentences(txt), out = '';
    for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > CFG.bandMaxChars) break; out += parts[i]; }
    return out.trim();
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
    var pool = shuffle(CORPUS.crawl.slice()), out = '';
    for (var i = 0; i < pool.length; i++) { var next = out ? out + ' | ' + pool[i] : pool[i]; if (out && next.length > 150) continue; out = next; if (out.length >= 92) break; }
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
  function makeSample(run, q, kind, capId) {
    var Lv = q >= 1 ? run.loss : lossAt(run, q), tier = tierOf(Lv), amt = amount(q * run.r);
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
      text = splice(bandCut(full), amt);
      if (capId) mtext = splice(full, amt);
    } else { text = pickLow(tier); amt = 0; }
    if (kind === 'land') run.landText = text;
    return { id: ++sampleSeq, text: text, momentText: mtext, tier: tier, fray: amt, crawl: amt === CRAWL, cap: cap, q: q, C: q * run.C, kind: kind, loss: Lv };
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
  function writeNote(text, p, anchor, opts) {
    if (!S) return null;
    opts = opts || {};
    var n = document.createElement('div');
    n.className = 'fr-note' + (opts.typed ? ' typed' : '') + (opts.keep ? ' keep' : '') + (opts.ring ? ' ring' : '');
    if (opts.pencil) n.style.color = COL.graphite;
    var chars = [];
    for (var i = 0; i < text.length; i++) { var c = document.createElement('span'); c.className = 'c'; c.textContent = text[i]; n.appendChild(c); chars.push(c); }
    el.notes.appendChild(n);
    var note = { el: n, chars: chars, shown: 0, anchor: anchor || { type: 'band' }, born: now, keep: !!opts.keep, who: p ? p.key : null, life: opts.life || 0 };
    if (note.anchor.type === 'pen') {
      var run = S.run, pt = run && run.pts[run.pts.length - 1];
      note.anchor = pt ? { type: 'paper', x: pt[0], y: pt[1], dy: anchor.dy == null ? 18 : anchor.dy, dx: anchor.dx } : { type: 'band' };
    }
    // one voice per place: a new note in the band, at a name, at the stop or by the cluster replaces the old one there
    S.notes = S.notes.filter(function (x) { if (!x.keep && x.anchor.type === note.anchor.type && note.anchor.type !== 'paper' && x.anchor.key === note.anchor.key) { fadeNote(x); return false; } return true; });
    S.notes.push(note);
    placeNote(note);
    if (reduced()) { chars.forEach(function (c) { c.className = 'c on'; }); note.shown = chars.length; }
    AU.write(text.length * CFG.noteCharSec * 1000);
    return note;
  }
  function noteHit(n, x, y, w) {
    var h = 17;
    var hitNote = S.notes.some(function (o) { return o !== n && o.box && !o.gone && x < o.box.x + o.box.w && x + w > o.box.x && y < o.box.y + h && y + h > o.box.y; });
    if (hitNote) return true;
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
      if (!n.faded && now - n.born > CFG.noteFadeSec) { n.faded = true; n.el.classList.add('faded'); }
      if (n.life && now - n.born > n.life) { fadeNote(n); return false; }
      if (n.anchor.type === 'paper' && (viewGen !== n.vg || layoutGen !== n.lg)) { placeNote(n); moved = true; }
      return true;
    });
    return moved;
  }
  function placeNote(n) {
    var a = n.anchor, x = 0, y = 0;
    if (!L.root || !L.plot) return;
    n.lg = layoutGen; n.vg = viewGen;
    var w = n.el.offsetWidth || 120;
    if (a.type === 'paper') {
      var px = a.x != null ? X(a.x) : X(log10(a.C)), py = a.y != null ? Y(a.y) : Y(Math.log(a.L));
      x = L.paper.x + px + (a.dx == null ? 8 : a.dx); y = L.paper.y + py + (a.dy == null ? -20 : a.dy);
    } else if (a.type === 'band') { x = L.band.x + L.band.w - w; y = L.band.y + 2; }
    else if (a.type === 'name') { var b = el.team.querySelector('[data-key="' + a.key + '"]'); if (b) { var r = b.getBoundingClientRect(); x = r.left - L.rootRect.left + Math.max(40, b.querySelector('.w') ? b.querySelector('.w').offsetWidth + 8 : r.width + 6); y = r.top - L.rootRect.top + (r.height - 17) / 2; } }
    else if (a.type === 'stop') { x = L.strip.x + a.x - w - 4; y = L.strip.y - 19; }
    else if (a.type === 'cluster') { x = L.cluster.x + L.cluster.w - w - 36; y = L.cluster.y - 17; }
    var x0 = x, y0 = y, best = null;
    var xmin = a.type === 'paper' ? L.paper.x + L.plot.x : a.type === 'name' ? L.paper.x : a.type === 'band' ? L.band.x : L.gutL;
    var xmax = a.type === 'paper' || a.type === 'name' ? L.paper.x + L.paper.w : a.type === 'band' ? L.band.x + L.band.w : a.type === 'stop' ? L.strip.x + L.strip.w : a.type === 'cluster' ? L.cluster.x + L.cluster.w : L.root.w - L.gutR;
    if (xmax - xmin < w) xmin = Math.max(L.gutL, xmax - w);
    var ymin = a.type === 'paper' ? L.paper.y + L.plot.y : 2, ymax = a.type === 'paper' ? L.paper.y + L.ruler.y - 30 : L.root.h - 24;
    var rw = (L.readoutBox ? L.readoutBox.w : 70) + 14;
    var offs = a.type === 'paper' ? [[0, 0], [0, -18], [0, 18], [-w - 16, 0], [0, -36], [0, 36], [-w - 16, -18], [-w - 16, 18]] : a.type === 'name' ? [[0, 0], [0, 14], [0, -14]] : a.type === 'stop' ? [[0, 0], [-rw, 0], [-rw - 40, 0], [0, -20]] : [[0, 0], [0, -17], [0, 17], [0, -34]];
    for (var oi = 0; oi < offs.length; oi++) {
      var cx = clamp(x0 + offs[oi][0], xmin, xmax - w), cy = clamp(y0 + offs[oi][1], ymin, ymax);
      if (!noteHit(n, cx, cy, w)) { best = [cx, cy]; break; }
    }
    if (!best) best = [clamp(x0, xmin, xmax - w), clamp(y0, ymin, ymax)];
    x = best[0]; y = best[1];
    n.box = { x: x, y: y, w: w };
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
    L.paper = box(el.paperwrap); L.band = box(el.band); L.strip = box(el.strip); L.cluster = box(el.cluster); L.headsW = el.heads.clientWidth;
    var rs = getComputedStyle(root);
    L.gutL = parseFloat(rs.paddingLeft) || 16; L.gutR = parseFloat(rs.paddingRight) || 16;
    if (rr.width >= CFG.laptopMinWidth) { L.gutL = L.paper.x; L.gutR = rr.width - (L.paper.x + L.paper.w); }
    L.laptop = rr.width >= CFG.laptopMinWidth;
    var G = L.laptop ? CFG.laptop : CFG.phone;
    L.margin = parseFloat(rs.getPropertyValue('--margin')) || G.margin; L.home = G.home; L.nibW = G.nibW; L.readoutAbove = G.readoutAbove;
    var rulerH = L.laptop ? 28 : 24;
    L.plot = { x: L.margin, y: 28, w: Math.max(80, L.paper.w - L.margin), h: Math.max(50, L.paper.h - 28 - rulerH) };
    L.ruler = { y: L.paper.h - rulerH + 8, h: rulerH };
    L.travel = { x: L.home, w: Math.max(40, L.strip.w - L.home) };
    [[cvP, L.paper], [cvD, L.paper], [cvC, L.cluster], [cvS, L.strip]].forEach(function (p) { var w = Math.max(1, Math.round(p[1].w * dpr)), h = Math.max(1, Math.round(p[1].h * dpr)); if (p[0].width !== w) p[0].width = w; if (p[0].height !== h) p[0].height = h; });
    var rows = S ? S.team.length : 1;
    el.team.classList.toggle('dense', L.laptop ? rows * 32 + 44 > L.paper.h - 30 : (L.paper.h < 330 || rows * 28 + 40 > L.paper.h - 30));
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
  function boxHit(b, list) { for (var i = 0; i < list.length; i++) { var o = list[i]; if (b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y) return true; } return false; }

  function drawStatic() {
    var c = ctxSt, w = L.paper.w, h = L.paper.h, dl = dimLevel(), occ = [];
    var plotR = L.plot.x + L.plot.w;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = COL.paper; c.fillRect(0, 0, w, h);
    // the decade grid
    c.strokeStyle = rgba('grid', dl); c.lineWidth = 1; c.beginPath();
    for (var d = Math.ceil(view.l); d <= Math.floor(view.r); d++) { var x = Math.round(X(d)) + 0.5; if (x < L.plot.x - 1) continue; c.moveTo(x, L.plot.y); c.lineTo(x, L.plot.y + L.plot.h); }
    [2, 3, 4, 6, 10].forEach(function (lv) { var y = Math.round(Y(Math.log(lv))) + 0.5; c.moveTo(L.plot.x, y); c.lineTo(plotR, y); });
    c.stroke();
    if (!S) return;
    var ry = L.ruler.y;
    // the calendar ruler at the foot of the paper: month initials, the year's history in pencil
    c.strokeStyle = rgba('grid', dl); c.beginPath(); c.moveTo(dayX(0), ry + 0.5); c.lineTo(dayX(366), ry + 0.5); c.stroke();
    if (S.powered) {
      c.fillStyle = GR(1); c.font = fMono(9); c.textBaseline = 'top';
      for (var m = 0; m < 12; m++) { var mx = Math.round(dayX(monthStart(m))); c.fillRect(mx, ry - 2, 1, 5); c.fillText(MON[m].charAt(0), mx + 3, ry + 4); }
      var lastX = -99;
      c.font = fMono(9, true);
      S.rulerPhrases.slice().sort(function (a, b) { return a.day - b.day; }).forEach(function (p) {
        var tx = Math.round(dayX(p.day)) + 0.5, px2 = Math.max(tx + 3, lastX + 10); lastX = px2;
        var a = reduced() ? 1 : clamp((now - p.t) / 0.6, 0, 1); if (a < 1) staticDirty = true;
        var tw = c.measureText(p.text).width, lift = px2 - tx > 4 ? 13 : 8;
        occ.push({ x: px2 - 5, y: ry - lift - tw - 2, w: 10, h: tw + 4 });
        c.globalAlpha = a * 0.8;
        c.fillStyle = GR(1); c.fillRect(tx - 0.5, ry - 6, 1, 6);
        c.strokeStyle = GR(0.7); c.lineWidth = 1;
        if (px2 - tx > 4) { c.beginPath(); c.moveTo(tx, ry - 6); c.lineTo(px2 - 3, ry - 11); c.stroke(); }
        c.save(); c.translate(px2 + 0.5, ry - (px2 - tx > 4 ? 13 : 8)); c.rotate(-Math.PI / 2); c.textBaseline = 'middle'; c.fillText(p.text, 0, 0); c.restore();
        c.globalAlpha = 1;
      });
      S.runs.forEach(function (r) { runBar(c, r, r.landDay); });
    }
    // scar bands: Vermilion hatch from the wall to the run, the skimmed sentence reprinted along the top
    S.scars.forEach(function (sc, si) {
      var x0 = Math.max(L.plot.x, X(log10(sc.from))), x1 = Math.max(X(log10(sc.to)), x0 + 8), u = reduced() ? 1 : clamp((now - sc.t0) / 0.9, 0, 1);
      if (u < 1) staticDirty = true;
      if (x0 > plotR) return;
      c.save(); c.beginPath(); c.rect(x0, L.plot.y, (Math.min(x1, plotR) - x0) * u, L.plot.h); c.clip();
      c.strokeStyle = dl < 1 ? rgba('vermilion', dl) : COL.vermilion; c.lineWidth = 1; c.beginPath();
      for (var k = x0 - L.plot.h; k < x1; k += 6) { c.moveTo(k, L.plot.y + L.plot.h); c.lineTo(k + L.plot.h, L.plot.y); }
      c.stroke(); c.restore();
      sc.box = null;
      if (u >= 1 && sc.line) {
        var maxW = Math.min(L.laptop ? 300 : 200, L.plot.w * 0.62), lh = 16;
        c.font = fSerif(12); c.textBaseline = 'top';
        var lines = wrapLines(c, sc.line, maxW, 3), bw = 0; lines.forEach(function (ln) { bw = Math.max(bw, c.measureText(ln).width); });
        var tx = x0 + 3; if (tx + bw > plotR - 2) tx = plotR - 2 - bw; if (tx < L.plot.x + 2) tx = L.plot.x + 2;
        var b = { x: tx - 2, y: L.plot.y + 3, w: bw + 4, h: lines.length * lh + 2 };
        for (var tries = 0; tries < 6 && boxHit(b, occ); tries++) b.y += b.h + 4;
        occ.push(b); sc.box = b;
        var ta = reduced() ? 1 : clamp((now - sc.t0 - 0.9) / 0.5, 0, 1); if (ta < 1) staticDirty = true;
        c.globalAlpha = ta;
        lines.forEach(function (ln, i) { c.lineWidth = 3; c.strokeStyle = rgba('paper', 0.9); c.lineJoin = 'round'; c.strokeText(ln, b.x + 2, b.y + 1 + i * lh); c.fillStyle = INK(); c.fillText(ln, b.x + 2, b.y + 1 + i * lh); });
        c.globalAlpha = 1;
      }
    });
    // the paper's line, printed on 23 Jan, and GPT-3's ring
    if (S.lineShown) {
      var u2 = reduced() ? 1 : clamp((now - S.lineAt) / 1.2, 0, 1); if (u2 < 1) staticDirty = true;
      c.fillStyle = GR(1);
      var xEnd = lerp(L.plot.x, plotR, u2);
      for (var px = L.plot.x; px <= xEnd; px += 3) { var lc = view.l + (px - L.plot.x) / L.plot.w * (view.r - view.l); var py = Y(Math.log(Lline(Math.pow(10, lc)))); if (py > L.plot.y && py < L.plot.y + L.plot.h) c.fillRect(px, py, 1, 1); }
      if (!S.gpt3 && u2 >= 1) { c.strokeStyle = GR(1); c.lineWidth = 1; c.beginPath(); c.arc(X(log10(CFG.gpt3C)), Y(Math.log(Lline(CFG.gpt3C))), 2.5, 0, 6.283); c.stroke(); }
    }
    // your dots are obstacles for every label
    S.runs.forEach(function (r) { var x = X(log10(r.C)), y = Y(Math.log(r.loss)); occ.push({ x: x - 6, y: y - 6, w: 12, h: 12 }); });
    if (S.gpt3) { var gx0 = X(log10(CFG.gpt3C)), gy0 = Y(Math.log(Lline(CFG.gpt3C))); occ.push({ x: gx0 - 5, y: gy0 - 5, w: 10, h: 10 }); }
    // finished curves at 35%: a family of training curves whose envelope is the law
    strokeRuns(c, S.runs, INK(0.35), 1);
    if (S.run && S.run.cut) strokeRun(c, S.run, INK(0.6), 1.2, true);
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
        c.font = fMono(10, true); c.textBaseline = 'top';
        var lab = rv.name + ' · ' + sizeWord(params(lp.C)), tw = c.measureText(lab).width, th = 12;
        var cands = [], dys = [3, -15, 16, -28, 29, -41, 42, -54, 55, -67, -80, -93];
        dys.forEach(function (dy) { cands.push([5, dy]); cands.push([-tw - 5, dy]); });
        var bx = null;
        for (var ci = 0; ci < cands.length; ci++) {
          var b = { x: lx[0] + cands[ci][0], y: lx[1] + cands[ci][1], w: tw, h: th };
          if (b.x < L.plot.x + 2 || b.x + tw > plotR || b.y < L.plot.y || b.y + th > L.ruler.y - 10) continue;
          if (!boxHit(b, occ)) { bx = b; break; }
        }
        if (!bx) bx = { x: clamp(lx[0] + 5, L.plot.x + 2, plotR - tw), y: clamp(lx[1] + 3, L.plot.y, L.ruler.y - 26), w: tw, h: th };
        occ.push(bx);
        // a label pushed away from its dot keeps a faint leader back to it
        var ly0 = bx.y + th / 2, lxe = bx.x > lx[0] ? bx.x - 2 : bx.x + tw + 2;
        if (Math.abs(ly0 - lx[1]) > 12) { c.strokeStyle = GR(0.45, keepDark); c.lineWidth = 0.75; c.beginPath(); c.moveTo(lx[0], lx[1]); c.lineTo(lxe, ly0); c.stroke(); }
        c.lineWidth = 3; c.lineJoin = 'round'; c.strokeStyle = rgba('paper', 0.85 * dl); c.strokeText(lab, bx.x, bx.y);
        c.fillStyle = rv.passed ? rgba('grid', dl) : GR(1, keepDark);
        c.fillText(lab, bx.x, bx.y);
        if (rv.passed) { var tu = reduced() ? 1 : clamp((now - rv.passedAt) / 0.25, 0, 1); if (tu < 1) staticDirty = true; c.strokeStyle = INK(0.8); c.lineWidth = 1.2; c.beginPath(); var t0x = bx.x - 9, t0y = bx.y + 6; c.moveTo(t0x, t0y); c.lineTo(t0x + 2.5 * Math.min(1, tu * 2), t0y + 3 * Math.min(1, tu * 2)); if (tu > 0.5) c.lineTo(t0x + 2.5 + 4.5 * (tu - 0.5) * 2, t0y + 3 - 7 * (tu - 0.5) * 2); c.stroke(); }
      });
      c.globalAlpha = 1;
    }
    // hang circles, in Tom's hand
    c.save(); c.beginPath(); c.rect(L.plot.x, L.plot.y, L.plot.w, L.plot.h); c.clip();
    c.strokeStyle = INK(0.22); c.lineWidth = 1;
    S.hangMarks.forEach(function (hm) { c.beginPath(); c.ellipse(X(hm.x), Y(hm.y), 5, 3.5, -0.3, 0.4, 6.5); c.stroke(); });
    c.restore();
    // your line: solid between leftmost and farthest clean dots; dotted extension once a decade apart
    var cr = cleanRuns();
    if (cr.length >= 2) {
      var a = cr.reduce(function (mm, r) { return r.C < mm.C ? r : mm; }), b = cr.reduce(function (mm, r) { return r.C > mm.C ? r : mm; });
      var ax = X(log10(a.C)), ay = Y(Math.log(a.loss)), bx2 = X(log10(b.C)), by = Y(Math.log(b.loss));
      c.strokeStyle = LINEINK(); c.lineWidth = 1; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx2, by); c.stroke();
      if (b.C >= a.C * 10) {
        var slope = (Math.log(b.loss) - Math.log(a.loss)) / (log10(b.C) - log10(a.C));
        var ex = view.r, ey = Math.log(b.loss) + slope * (ex - log10(b.C));
        c.setLineDash([1, 3]); c.beginPath(); c.moveTo(bx2, by); c.lineTo(X(ex), Y(ey)); c.stroke(); c.setLineDash([]);
      }
    }
    S.runs.forEach(function (r) {
      var x = X(log10(r.C)), y = Y(Math.log(r.loss)), ink = LINEINK();
      c.beginPath(); c.arc(x, y, 2.5, 0, 6.283);
      if (r.clean) { c.fillStyle = ink; c.fill(); } else { c.strokeStyle = ink; c.lineWidth = 1.2; c.stroke(); }
      if (r.published) { c.strokeStyle = ink; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 4.5, 0, 6.283); c.stroke(); }
      if (r.shipped) { c.fillStyle = ink; c.fillRect(x + 5, y - 0.5, 6, 1); }
      c.textBaseline = 'top';
      var tb;
      if (r.author) { c.font = fHand(14); var aw = c.measureText(r.author).width; tb = placeLabel(x, y, aw, 15, occ, [[-aw / 2, 8], [6, 6], [-aw - 6, 6], [-aw / 2, -22]]); c.fillStyle = INK(); c.fillText(r.author, tb.x, tb.y); }
      if (r.withMer) { c.font = fHand(13); var tw2 = c.measureText(WORLD.notes.withMeridian).width; tb = placeLabel(x, y, tw2 + 8, 15, occ, [[6, -22], [-tw2 - 14, -22], [6, 8]]); c.strokeStyle = GR(0.9); c.lineWidth = 1; c.strokeRect(Math.round(tb.x) + 0.5, Math.round(tb.y) + 0.5, tw2 + 8, 15); c.fillStyle = GR(1); c.fillText(WORLD.notes.withMeridian, tb.x + 4, tb.y + 1); }
      if (r.scandal) { c.font = fHand(14); var sw = c.measureText(r.scandal).width; tb = placeLabel(x, y, sw, 15, occ, [[-sw / 2, 18], [-sw + 8, 18], [-8, 18], [-sw / 2, -34], [-sw - 8, -6], [-sw / 2, 34], [-sw / 2, -50], [-sw + 8, 50], [-sw / 2, -66]]); c.lineWidth = 3; c.strokeStyle = rgba('paper', 0.85 * dl); c.lineJoin = 'round'; c.strokeText(r.scandal, tb.x, tb.y); c.fillStyle = GR(1); c.fillText(r.scandal, tb.x, tb.y); }
    });
    L.occ = occ; viewGen++;
    // GPT-3: the point presses in on 28 May
    if (S.gpt3) {
      var gx = X(log10(CFG.gpt3C)), gy = Y(Math.log(Lline(CFG.gpt3C)));
      var pu = reduced() ? 1 : clamp((now - S.gpt3At) / 0.3, 0, 1); if (pu < 1) staticDirty = true;
      var keepD = S.endFx && S.endFx.kind === 'forgotten';
      c.fillStyle = keepD ? COL.ink : LINEINK(); c.beginPath(); c.arc(gx, gy, lerp(6, 2.5, easeOut(pu)), 0, 6.283); c.fill();
    }
  }
  function placeLabel(x, y, w, h, occ, cands) {
    var plotR = L.plot.x + L.plot.w;
    for (var i = 0; i < cands.length; i++) {
      var b = { x: clamp(x + cands[i][0], L.plot.x + 1, plotR - w - 1), y: clamp(y + cands[i][1], L.plot.y, L.ruler.y - h - 12), w: w, h: h };
      if (!boxHit(b, occ)) { occ.push(b); return b; }
    }
    var f = { x: clamp(x + cands[0][0], L.plot.x + 1, plotR - w - 1), y: clamp(y + cands[0][1], L.plot.y, L.ruler.y - h - 12), w: w, h: h };
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
      if (c.measureText(t).width > maxW && line) { out.push(line); line = words[i]; if (out.length >= maxLines) return out; }
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
    // the mark during a drag: a tick on your line at the bet's compute; hollow past the horizon
    if (!run && S.phase === 'play' && (nib.drag || nib.kbd)) {
      var br = betRange();
      if (br) {
        var T = betDays(nib.t, br), C = T * br.F, mx = X(log10(C)), my = Y(Math.log(yourLineLoss(C)));
        if (mx <= L.plot.x + L.plot.w + 4) {
          if (C > br.horC * 1.0001) { c.strokeStyle = INK(); c.lineWidth = 1; c.strokeRect(Math.round(mx) - 1.5, my - 3, 3, 6); }
          else { c.fillStyle = INK(); c.fillRect(Math.round(mx) - 0.5, my - 3, 1, 6); }
        }
      }
    }
    // today's cursor on the ruler
    var tx = Math.round(dayX(S.day)) + 0.5;
    c.fillStyle = INK(); c.fillRect(tx - 0.5, L.ruler.y - 4, 1, 8);
    c.beginPath(); c.moveTo(tx, L.ruler.y - 4); c.lineTo(tx - 2.5, L.ruler.y - 8.5); c.lineTo(tx + 2.5, L.ruler.y - 8.5); c.closePath(); c.fill();
  }
  function yourLineLoss(C) {
    var cr = cleanRuns(); if (cr.length < 2) return Lline(C) * sunheeM();
    var a = cr.reduce(function (m, r) { return r.C < m.C ? r : m; }), b = cr.reduce(function (m, r) { return r.C > m.C ? r : m; });
    if (b.C <= a.C * 1.01) return Lline(C) * sunheeM();
    var slope = (Math.log(b.loss) - Math.log(a.loss)) / (log10(b.C) - log10(a.C));
    return Math.exp(Math.log(b.loss) + slope * (log10(C) - log10(b.C)));
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
    var serve = S.serving;
    for (i = list.length - 1; i >= 0 && serve > 0; i--) { var ch = list[i]; if (ch === 'w' || ch === 'r' || ch === 'm' || ch === 'A') { list[i] = 's'; serve--; } }
    return list;
  }
  function unitFor(n) { return n > CFG.podAbove ? 64 : n > CFG.nodeAbove ? 8 : 1; }
  function cellGeom(nUnits, unit, w, h) {
    var cols = 64, rows = unit === 1 ? 2 : clamp(Math.ceil(nUnits / 64), 1, 4);
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
    var g = cv.getContext('2d'), depth = (cw < 8 ? 1.5 : clamp(Math.min(cw, rh) * 0.2, 2, 4)) * dpr, inset = 1 * dpr;
    for (var k = 0; k < depth; k += 0.5) {
      var a = Math.pow(1 - k / depth, 1.3) * (solid ? 0.95 : (cw < 8 ? 1 : 0.85));
      g.strokeStyle = rgba('filament', a.toFixed(3)); g.lineWidth = 0.6;
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
        c.fillStyle = kind === 'M' ? COL.graphite : ink; c.fillRect(Math.round(x + cw / 2 - 0.5), Math.round(y + rh / 2 - 0.5), 1, 1);
        var pm = cells.printed[i]; if (kind === 'm' && pm && now >= pm && now - pm < 0.3) { c.strokeStyle = rgba('ink', 1 - (now - pm) / 0.3); c.lineWidth = 2; c.strokeRect(x + 1, y + 1, cw - 2, rh - 2); }
      } else if (kind === 'q') { c.strokeStyle = COL.graphite; c.lineWidth = 1; c.setLineDash([1.5, 2]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]); }
      else if (kind === 'o' || kind === 'P') {
        var u = +k.slice(1); c.strokeStyle = COL.graphite; c.lineWidth = 1; c.setLineDash([1, lerp(4, 0.01, u)]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
        if (kind === 'P' && cw > 4) { c.globalAlpha *= 0.6; c.strokeRect(x + 2.5, y + 2.5, cw - 5, rh - 5); }
      } else if (kind === 's') { c.fillStyle = COL.grid; c.fillRect(x, y, cw, rh); }
      else if (kind === 'L') { c.strokeStyle = COL.grid; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.beginPath(); c.moveTo(x + 0.5, y + rh - 0.5); c.lineTo(x + cw - 0.5, y + 0.5); c.stroke(); }
      // training: a Filament inner glow, breathing at 0.5 Hz. At the lift it flares in left to right and settles.
      if (training && (kind === 'w' || kind === 'A' || kind === 'r' || kind === 'm')) {
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
    var lo, span, pxPerDay;
    if (run && S.phase === 'play') {
      // during a pour the scale is the one the bet was made on; the nib rides home as the run eats its days
      lo = run.lo; span = Math.max(1e-6, run.stopT - run.lo); pxPerDay = L.travel.w / span;
    } else if (br) {
      if (stopDisp == null || nib.drag) stopDisp = { T: br.T, from: br.T, t0: -99, cur: br.T };
      else if (Math.abs(stopDisp.T - br.T) / Math.max(1e-6, br.T) > 0.03) { stopDisp = { T: br.T, from: stopDisp.cur || stopDisp.T, t0: now, cur: stopDisp.cur }; AU.feed(400); }
      else stopDisp.T = br.T;
      var ur = reduced() ? 1 : clamp((now - stopDisp.t0) / CFG.remapSec, 0, 1);
      var Td = lerp(stopDisp.from, stopDisp.T, ease(ur)); stopDisp.cur = Td; if (ur >= 1) stopDisp.from = stopDisp.T;
      lo = br.lo; span = Math.max(1e-6, Td - lo); pxPerDay = L.travel.w / span;
    }
    var inkCol = mix('ink', 'dry', fade.u, fade.a);
    var floodTo = null;
    if (pxPerDay) {
      if (run && S.phase === 'play') {
        var tr = training(), remain = tr.flops > 0 ? (run.C - run.done) / tr.flops : (run.T0 * (1 - run.done / run.C));
        if (S.hang) remain += Math.max(0, S.hang.until - S.day);
        floodTo = L.travel.x + clamp((remain - lo) / span, 0, 1.04) * L.travel.w;
      } else if (S.powered && nib.t > 0) floodTo = L.travel.x + nib.t * L.travel.w;
      // day hairlines where they are at least 4 px apart, otherwise weeks
      var stepD = pxPerDay >= 4 ? 1 : 7, base = S.day + lo;
      c.fillStyle = COL.grid;
      var first = stepD === 7 ? Math.ceil((base - 5) / 7) * 7 + 5 : Math.ceil(base); // weeks start on Mondays (6 Jan 2020 is day 5)
      for (var dd = first; dd < S.day + lo + span; dd += stepD) { var hx = L.travel.x + (dd - base) * pxPerDay; if (hx > L.travel.x + 1) c.fillRect(Math.round(hx), h - 9, 1, 6); }
      // paydays: every 1st inside the travel is a tall tick with its month's initial
      c.font = fMono(9); c.textBaseline = 'top';
      for (var m = monthOf(S.day) + 1; m <= 12; m++) {
        var pd = monthStart(m); if (pd - base > span) break;
        var px = L.travel.x + (pd - base) * pxPerDay;
        if (px <= L.travel.x + 0.5) continue;
        c.fillStyle = COL.graphite; c.fillRect(Math.round(px), 3, 1, h - 6);
        if (m < 12) { c.fillStyle = COL.graphite; c.fillText(MON[m].charAt(0), Math.round(px) + 3, 5); }
      }
    }
    // the ink flood and the nib
    var nibX;
    if (run && S.phase === 'play' && floodTo != null) {
      c.fillStyle = inkCol; c.fillRect(L.travel.x, 2, Math.max(0, floodTo - L.travel.x), h - 4);
      nibX = Math.max(floodTo, L.travel.x);
      c.fillStyle = S.hang ? rgba('ink', 0.55 * fade.a) : inkCol;
      c.fillRect(Math.round(nibX - L.nibW / 2), 1, L.nibW, h - 2);
    } else if (S.powered && S.phase === 'play') {
      if (nib.t > 0) {
        nibX = L.travel.x + nib.t * L.travel.w;
        c.fillStyle = inkCol; c.fillRect(L.travel.x, 2, nibX - L.travel.x, h - 4);
        // paydays the run will eat show through the ink
        if (pxPerDay) { c.fillStyle = rgba('paper', 0.55); for (var m2 = monthOf(S.day) + 1; m2 <= 12; m2++) { var px3 = L.travel.x + (monthStart(m2) - S.day - lo) * pxPerDay; if (px3 > nibX - 2) break; if (px3 > L.travel.x) c.fillRect(Math.round(px3), 3, 1, h - 6); } }
        c.fillStyle = inkCol; c.fillRect(Math.round(nibX - L.nibW / 2), 1, L.nibW, h - 2);
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
    var dragging = (nib.drag || nib.kbd) && !S.run && S.phase === 'play';
    var b2 = dragging ? betRange() : null;
    if (b2 && S.figureOn) { var T = betDays(nib.t, b2); proj = '→ ' + fmtMonths(Math.max(0, monthsVal() - T / 30.4)); }
    if (proj !== lastProj) { el.proj.textContent = proj; lastProj = proj; }
    if (b2) {
      var T2 = betDays(nib.t, b2);
      var rtxt = fmtDay(S.day + T2);
      if (el.readout.textContent !== rtxt) { el.readout.textContent = rtxt; readoutW = el.readout.offsetWidth || 64; }
      var x = L.travel.x + nib.t * L.travel.w, rw = readoutW || 64;
      el.readout.style.transform = 'translate3d(' + clamp(x - rw / 2, -L.strip.x + L.gutL, L.strip.w - rw) .toFixed(1) + 'px,' + (nib.y != null && nib.drag ? (nib.y - L.readoutAbove - 10) : -L.readoutAbove).toFixed(1) + 'px,0)';
      el.readout.style.top = '0px';
      el.readout.classList.add('on');
      var rxx = clamp(x - rw / 2, -L.strip.x + L.gutL, L.strip.w - rw), ryy = nib.y != null && nib.drag ? (nib.y - L.readoutAbove - 10) : -L.readoutAbove;
      L.readoutBox = { x: L.strip.x + rxx, y: L.strip.y + ryy, w: rw + 10, h: 20 };
      // at the stop, the right person names the limit
      if (nib.t >= 0.999 && now - stopNoteShown > CFG.stopNoteSec + 0.6) {
        stopNoteShown = now;
        var who = b2.why === 'mem' ? person('priya') : b2.why === 'horizon' ? (person('dev') || person('priya')) : null;
        var txt = b2.why === 'mem' ? WORLD.notes.memStop : b2.why === 'horizon' ? WORLD.notes.horizonStop : '31 DEC';
        writeNote(txt, who, { type: 'stop', x: L.travel.x + L.travel.w, key: 'stop' }, { typed: b2.why === 'year' || !who, life: CFG.stopNoteSec });
      }
      if (has('ayaan') && T2 * b2.F > b2.horC * 1.0001 && !nib.ayaanSaid) { nib.ayaanSaid = true; var CC = T2 * b2.F; writeNote(WORLD.notes.ayaanGoing, person('ayaan'), { type: 'paper', C: CC, L: yourLineLoss(CC), dy: -26, dx: 6, key: 'ayaan' }, { life: 3.2 }); }
      if (hasSystems() && !S.hints.split && T2 * b2.F > CFG.memC) { S.hints.split = true; writeNote(WORLD.notes.devSplit, person('dev') || person('rafael'), { type: 'stop', x: Math.min(L.travel.x + nib.t * L.travel.w + 120, L.travel.x + L.travel.w), key: 'split' }, { life: 3 }); }
    } else el.readout.classList.remove('on');
    // pencil box in the band: the red-team countdown
    var boxTxt = '';
    if (S.redteam) boxTxt = 'red-team: ' + Math.max(0, Math.ceil(S.redteam.until - S.day)) + ' days';
    if (el.box.textContent !== boxTxt) { el.box.textContent = boxTxt; el.box.classList.toggle('on', !!boxTxt); }
    if (now - (S.teamAt || 0) > 0.25) { S.teamAt = now; updateTeamBoxes(); inkNames(); }
    el.strip.classList.toggle('grab', S.phase === 'play' && S.powered && !S.run && !nib.drag && nib.hover);
    el.strip.classList.toggle('grabbing', nib.drag);
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
    var dense = L.paper && (L.laptop ? S.team.length * 32 + 44 > L.paper.h - 30 : (L.paper.h < 330 || S.team.length * 28 + 40 > L.paper.h - 30));
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
      if (S.filter && S.filter.by === p.key) txt = 'filter: ' + Math.max(0, Math.ceil(S.filter.end - S.day)) + ' days';
      if (S.redteam && p.key === 'lena') txt = 'red-team: ' + Math.max(0, Math.ceil(S.redteam.until - S.day)) + ' days';
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
    AU.unlock();
  }, true);
  var swallowUntil = 0;
  root.addEventListener('click', function (e) { if (performance.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  function nibHit(p) {
    var nx = nib.t > 0 ? L.travel.x + nib.t * L.travel.w : L.home / 2;
    if (Math.abs(p.x - nx) <= 22) return true;
    if (nib.t === 0 && p.x < L.home + 6) return true;
    return false;
  }
  el.strip.addEventListener('pointerdown', function (e) {
    if (!S || S.phase !== 'play' || !S.powered || moment.on) return;
    if (S.run) { tapSample(); return; }
    var p = rel(e, el.strip), br = betRange(); if (!br) return;
    if (S.snapNext) { nib.t = 1; nib.pinned = true; S.log.push(fmtDay(S.day) + ' Ayaan snaps the nib to the stop'); }
    else if (!nibHit(p)) return;
    else nib.pinned = false;
    nib.drag = true; nib.kbd = false; nib.ayaanSaid = false; nib.pid = e.pointerId; nib.hist = [[performance.now(), nib.t]]; nib.y = p.y; nib.lastX = p.x; nib.lastT = performance.now(); nibTouched = true;
    nib.grabDx = nib.t > 0 ? p.x - (L.travel.x + nib.t * L.travel.w) : 0;
    try { el.strip.setPointerCapture(e.pointerId); } catch (er) {}
    e.preventDefault();
  });
  el.strip.addEventListener('pointermove', function (e) {
    var p = rel(e, el.strip);
    if (!nib.drag) { nib.hover = S && !S.run && nibHit(p); return; }
    if (e.pointerId !== nib.pid) return;
    var x = p.x - (nib.grabDx || 0);
    var t = clamp((x - L.travel.x) / L.travel.w, 0, 1);
    if (x < L.travel.x - L.home * 0.35) t = 0;
    if (nib.pinned) t = 1;
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
  function liftNib() {
    if (!nib.drag) return;
    nib.drag = false; AU.nib(0);
    var t = nib.pinned ? 1 : restT(), br = betRange();
    nib.t = t; nib.pinned = false;
    if (br) launch(betDays(t, br));
  }
  el.strip.addEventListener('pointerup', function (e) { if (e.pointerId === nib.pid) liftNib(); });
  el.strip.addEventListener('pointercancel', function (e) { if (e.pointerId === nib.pid) liftNib(); });
  el.strip.addEventListener('lostpointercapture', function (e) { if (nib.drag && e.pointerId === nib.pid) liftNib(); });
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
    if (!S.powered) { if (k === 'Enter' || k === ' ') { e.preventDefault(); gesture(); } return; }
    if (k === 'm' || k === 'M') { setMuted(!AU.muted); return; }
    if (S.phase !== 'play' || moment.on) return;
    AU.unlock();
    if (k === 'ArrowUp') { e.preventDefault(); if (S.letter) resolveLetter('take'); return; }
    if (k === 'ArrowDown') { e.preventDefault(); if (S.letter) resolveLetter('pass'); return; }
    if (k === 'p' || k === 'P') { flickCheckpoint('up'); return; }
    if (/^[1-9]$/.test(k)) { var p = S.team[+k - 1]; if (p) pressName(p); return; }
    if (k === 'ArrowRight' && !S.letter && S.checkpoint && S.checkpoint.state === 'up' && document.activeElement !== el.strip && canShip(S.checkpoint.run) && !nib.kbd) { e.preventDefault(); flickCheckpoint('right'); return; }
    if ((k === 'ArrowRight' || k === 'ArrowLeft') && !S.run) {
      e.preventDefault();
      var stp = e.shiftKey ? CFG.keyStepShift : CFG.keyStep;
      nib.t = S.snapNext ? 1 : clamp(nib.t + (k === 'ArrowRight' ? stp : -stp), 0, 1); nib.kbd = true; nibTouched = true;
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
        pumpLetters();
        stepView(); stepHeads(frameDt); stepBand(); stepMoment(); stepNotes();
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
        run: S.run ? { C: S.run.C, T: +S.run.T0.toFixed(3), s: +(S.run.done / S.run.C).toFixed(4), r: +S.run.r.toFixed(3), launch: fmtDay(S.run.launchDay), blind: S.run.blind } : null,
        hang: S.hang ? S.hang.label : null,
        runs: S.runs.map(function (r) { return { C: r.C, loss: +r.loss.toFixed(4), onLine: onLine(r), clean: r.clean, amount: r.amount, published: !!r.published, shipped: !!r.shipped, vaulted: r.clean && !r.published && !r.shipped, land: fmtDay(r.landDay), landDay: r.landDay, scandal: r.scandal || null, cap: r.capHere || null }; }),
        lastSample: S.bandSample ? { id: S.bandSample.id, text: S.bandSample.text, tier: S.bandSample.tier, fray: S.bandSample.fray, crawl: S.bandSample.crawl, kind: S.bandSample.kind, C: S.bandSample.C } : null,
        wall: { W: S.W, C: wallC(), filtersDone: S.filtersDone, filter: S.filter ? fmtDay(S.filter.end) : null, offer: !!S.offer },
        caps: S.caps.map(function (c) { return { id: c.id, C: c.C, fired: c.fired, contaminated: c.contaminated }; }),
        bet: br ? { lo: br.lo, T: br.T, why: br.why, F: br.F, stopC: br.T * br.F, horC: br.horC } : null,
        nib: { t: nib.t, drag: nib.drag },
        letter: letterInfo(S.letter),
        queue: S.queue.map(function (x) { return x.kind; }),
        checkpoint: S.checkpoint ? { state: S.checkpoint.state, afterRedteam: !!S.checkpoint.afterRedteam, C: S.checkpoint.run.C, capHere: S.checkpoint.run.capHere || null, canPublish: S.day >= CFG.publishFromDay, canShip: canShip(S.checkpoint.run) } : null,
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
