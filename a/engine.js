/* FRONTIER control room: the engine. Pure simulation, no DOM, so the same code runs the screen and the
   balance sim (node test/balance.mjs). Every number comes from config.js. Every rule that can decide your
   year is computed here and exposed to the screen with its reason, so nothing is hidden except the dice:
   the true clean-data wall, capability thresholds (shown as ranges), rival compute (shown as estimates),
   hangs, NaNs, contamination and scandals. */
(function (root) {
  'use strict';

  function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function log10(x) { return Math.log(x) / Math.LN10; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function fmtMoney(x, keepSign) {
    var s = x < 0 ? '−' : (keepSign && x > 0 ? '+' : ''), a = Math.abs(x);
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace(/\.?0+$/, '') + 'B';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1') + 'M';
    if (a >= 1e3) return s + '$' + Math.round(a / 1e3) + 'K';
    return s + '$' + Math.round(a);
  }
  function sci(C, digits) { if (!(C > 0)) return '0'; var e = Math.floor(log10(C) + 1e-9), m = C / Math.pow(10, e); var t = m.toFixed(digits == null ? 1 : digits); if (+t >= 10) { e++; t = (m / 10).toFixed(digits == null ? 1 : digits); } return t + 'e' + e; }
  function bigNum(n) { return n >= 1e12 ? (n / 1e12).toFixed(n >= 1e13 ? 0 : 1).replace(/\.0$/, '') + 'T' : n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B' : n >= 1e6 ? Math.round(n / 1e6) + 'M' : String(Math.round(n)); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 0 : d) + '%'; }

  function create(CFG, W, CORPUS, seed) {
    seed = (seed >>> 0) || 1;
    var BASE = Date.UTC(CFG.year, 0, 1);
    function D(iso) { return Math.round((Date.parse(iso + 'T00:00:00Z') - BASE) / 864e5); }
    function dateOf(day) { return new Date(BASE + Math.floor(day + 1e-9) * 864e5); }
    function dom(day) { return dateOf(day).getUTCDate(); }
    function fmtDay(day) { var d = dateOf(day); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
    function fmtLong(day) { var d = dateOf(day); var dd = String(d.getUTCDate()); if (dd.length < 2) dd = '0' + dd; return DOW[d.getUTCDay()] + ' ' + dd + ' ' + MON[d.getUTCMonth()].toUpperCase() + ' ' + d.getUTCFullYear(); }
    function monthIdx(day) { return dateOf(day).getUTCMonth(); }
    function sched(list, day) { var v = list[0][1]; list.forEach(function (x) { if (day >= D(x[0])) v = x[1]; }); return v; }

    var rng = mulberry(seed);
    var wrng = mulberry((Math.imul(seed, 2654435761) ^ 0x5bd1e995) >>> 0);  // words only: reading never changes the year's luck
    function U(a, b, r) { return a + (b - a) * (r || rng)(); }
    function gauss(r) { r = r || rng; return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
    function pickW(a) { return a[Math.floor(wrng() * a.length)]; }
    function shuffleW(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(wrng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

    var DAY = {
      line: D(CFG.lineDay), crash: D(CFG.crash), open: D(CFG.marketOpen), gpt3: D(CFG.gpt3.day), ship: D(CFG.shipFrom),
      covidOrderFrom: D(CFG.covidOrderFrom), covidOrderTo: D(CFG.covidOrderTo), boom: D(CFG.boomFrom),
      hangCovidFrom: D(CFG.hangCovidFrom), hangCovidTo: D(CFG.hangCovidTo), refuse: D(CFG.renewRefuseFrom),
      merFrom: D(CFG.meridian.from), merQueue: D(CFG.meridian.queueFrom), mer2: D(CFG.meridian.second.from),
      poach: D(CFG.poach.from), seriesB: D(CFG.seriesB.after), open_w: D(CFG.openWeights.from), dec: D('2020-12-21')
    };

    /* ---------------- physics ---------------- */
    function Lline(C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); }
    function Dopt(C) { return CFG.gpt3.D * Math.pow(C / CFG.gpt3.C, CFG.tokExp); }
    function Nopt(C) { return C / (6 * Dopt(C)); }
    function offPen(N, Dt) { var x = log10(N / Nopt(6 * N * Dt)); return 1 + CFG.offRecipe * x * x; }
    function recipeForC(C) { var Dt = Dopt(C); return { N: C / (6 * Dt), D: Dt, C: C }; }
    function recipeForN(N) { var e = CFG.tokExp; var C = Math.pow(6 * N * CFG.gpt3.D * Math.pow(CFG.gpt3.C, -e), 1 / (1 - e)); return recipeForC(C); }
    function scaleEff(cards) { if (cards <= CFG.scaleEffFrom) return 1; return Math.max(CFG.scaleEffMin, 1 - CFG.scaleEffPerDoubling * Math.log(cards / CFG.scaleEffFrom) / Math.LN2); }
    function poolType(pool) { return pool === 'a100' ? 'a100' : 'v100'; }
    function cardFlops(pool) { return CFG.card[poolType(pool)].flops; }
    var P0 = Math.pow(10, -3.5), CRAWL = CFG.frayMax + 1;
    function Lstar(run, x) { return Lline(x) * run.pen * run.m * (1 + run.b) * Math.exp(run.eps); }
    function wallDip(rq) { return rq > 1 ? 1 - CFG.pastWallDip * clamp(rq - 1, 0, 1) : 1; }
    function lossAt(run, q) {
      q = clamp(q, P0, 1);
      var z = (log10(q) + 3.5) / 3.5, yl = Math.log(Lstar(run, q * run.C)), H0 = Math.log(CFG.startLoss) - Math.log(Lstar(run, P0 * run.C));
      return Math.exp(yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z))) * wallDip(q * run.D / run.wallAtLaunch);
    }
    function amount(r) { if (r < CFG.cleanR) return 0; if (r <= 1) return Math.min(CFG.frayMax, 1 + Math.floor((r - CFG.cleanR) / CFG.frayStep + 1e-9)); return CRAWL; }
    function noiseSigma(C) { var u = clamp((log10(C) - 18) / (log10(CFG.gpt3.C) - 18), 0, 1); return CFG.landNoise[0] + (CFG.landNoise[1] - CFG.landNoise[0]) * u; }

    /* ---------------- the year ---------------- */
    var capC = CFG.caps.map(function (c) { return c[1] * Math.pow(10, U(-1, 1) * c[2]); }).sort(function (a, b) { return a - b; });
    var Wtrue = Math.exp(U(Math.log(CFG.W_lo), Math.log(CFG.W_hi)));
    var S = {
      seed: seed, day: 0, phase: 'play', end: null, started: false,
      bank: CFG.seedCash - CFG.dgx1Start, stake: CFG.stakeStart, post: CFG.seedPost, rep: 10,
      team: [], cands: [], gone: [],
      owned: { v100: CFG.startOwnedV100, a100: 0 }, orders: [], rentals: [], rentOut: [], mer: null,
      merOffered: false, merPassed: false, mer2Offered: false, priority: false,
      runs: [], nextRun: 1, selRun: null,
      W: Wtrue * CFG.passes, wallLo: CFG.W_lo * CFG.passes, wallHi: CFG.W_hi * CFG.passes, filters: 0, filterJob: null, evidence: [],
      caps: CFG.caps.map(function (c, i) { return { id: c[0], C: capC[i], L: Lline(capC[i]), lo: c[1] * Math.pow(10, -c[2]), hi: c[1] * Math.pow(10, c[2]), fired: false, contaminated: false, known: false, firedDay: null }; }),
      rivals: CFG.rivals.map(function (r) {
        var j = U(-CFG.rivalJitter, CFG.rivalJitter);
        return { key: r.key, name: r.name, blurb: r.blurb, c0: r.c0, tau: r.tau, period: r.period, offset: r.offset, cap: r.cap, jit: j, extra: 0, est: U(-CFG.rivalEstErr, CFG.rivalEstErr),
          pubs: [{ C: r.c0 * Math.pow(10, j) / 2, L: Lline(r.c0 * Math.pow(10, j) / 2) * r.offset, day: -30 }], nextPub: Math.round(r.period * U(0.2, 1.0)), gained: [], passedBy: false };
      }),
      news: [], log: [], inbox: [], history: [], decided: [],
      relevantUntil: CFG.relevanceDays, lastRelevant: null, lastPublishDay: -999,
      raise: { aDone: false, bDone: false, aNeed: CFG.seriesA.needC, diligence: null, lastBridge: -999, termBlockUntil: -1, rounds: [] },
      shipped: null, redteam: null, firstAuthor: null, tomOffUntil: -1, sunheeTrick: false, opened: false, openOffered: false,
      boardSale: false, strategicOffered: false, decemberDone: false,
      demands: {}, poachMonth: -1, hangsThisMonth: 0, hangsLastMonth: 0,
      stats: { hangs: 0, nans: 0, apiRevenue: 0, rentOutRevenue: 0, filters: 0, published: 0, shipped: 0, scandals: 0, hires: 0, peak: 0 },
      cashHist: [], computeHist: [], moodHist: [],
      flags: {}
    };
    var H = {};                // decision handlers by id (kept out of the plain state)
    S.team.push({ key: 'priya', name: W.people.priya.name, first: W.people.priya.first, role: 'data', skill: W.people.priya.skill, salary: W.people.priya.salary, ego: W.people.priya.ego, she: true, mood: CFG.moodStart, joined: 0, gone: false, lastRaise: -999 });
    var events = [];           // timed events: { day, fn, tag }
    var listeners = [];
    var nextId = 1;
    var lastDay = -1;

    function emit(kind, data) { listeners.forEach(function (f) { try { f(kind, data || {}); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }); }
    function log(text, kind) { S.log.push({ day: S.day, text: text, kind: kind || 'lab' }); if (S.log.length > 400) S.log.shift(); emit('log', { text: text, kind: kind || 'lab' }); }
    function at(day, fn, tag) { events.push({ day: day, fn: fn, tag: tag || '' }); }

    /* ---------------- people ---------------- */
    function staff() { return S.team.filter(function (p) { return !p.gone; }); }
    function person(key) { for (var i = 0; i < S.team.length; i++) if (S.team[i].key === key && !S.team[i].gone) return S.team[i]; return null; }
    function has(key) { return !!person(key); }
    function effSkill(p) { if (p.key === 'tom' && S.day < S.tomOffUntil) return 0; return p.mood < CFG.moodLow ? Math.max(1, p.skill - 1) : p.skill; }
    function byRole(role) { return staff().filter(function (p) { return p.role === role && effSkill(p) > 0; }); }
    function addPerson(key, salary) {
      var d = W.people[key];
      var p = { key: key, name: d.name, first: d.first, role: d.role, skill: d.skill, salary: salary || d.salary, ego: d.ego, she: !!d.she,
        mood: CFG.moodStart, joined: S.day, gone: false, lastRaise: -999 };
      S.team.push(p); S.cands = S.cands.filter(function (c) { return c.key !== key; });
      return p;
    }
    function he(p) { return p.she ? 'she' : 'he'; }
    function He(p) { return p.she ? 'She' : 'He'; }
    function him(p) { return p.she ? 'her' : 'him'; }
    function moodAdd(p, d) { if (!p || p.gone) return; p.mood = clamp(p.mood + d, 0, 100); if (p.mood <= 0) walk(p, null, 'morale hit zero'); }
    function walk(p, toRival, why) {
      if (!p || p.gone) return;
      p.gone = true; p.goneDay = S.day; p.goneWhy = why || 'left';
      if (toRival) { var rv = rivalBy(toRival); if (rv) { rv.extra += CFG.rivalPassBoost; rv.gained.push(p.first); } p.goneTo = rv ? rv.name : toRival; }
      if (S.filterJob && S.filterJob.who === p.key) { S.filterJob = null; log('Filter job stopped: ' + p.first + ' left.'); }
      if (S.redteam && p.role === 'evals') { var rt = S.redteam; S.redteam = null; log('Red-team stopped: ' + p.first + ' left. The release waits for your choice.'); landingDecision(runById(rt.runId), true); }
      log(p.first + ' left' + (p.goneTo ? ' for ' + p.goneTo : '') + ': ' + p.goneWhy + '.', 'people');
      emit('leave', { key: p.key });
    }
    function rivalBy(nameOrKey) { for (var i = 0; i < S.rivals.length; i++) if (S.rivals[i].name === nameOrKey || S.rivals[i].key === nameOrKey) return S.rivals[i]; return null; }

    // what the team changes (all computed, all shown on the cards and in the run designer)
    function split() { var s = 1; byRole('systems').forEach(function (p) { s *= CFG.systemsSplit(effSkill(p)); }); return Math.min(CFG.splitCap, s); }
    function maxParams(pool, cards) { return CFG.card[poolType(pool)].mem * Math.max(1, Math.min(split(), cards || 1)); }
    function infraMult() { var m = 1; byRole('infra').forEach(function (p) { m *= CFG.infraMult(effSkill(p)); }); return m; }
    function hasInfra() { return byRole('infra').length > 0; }
    function hasScaling() { return byRole('scaling').length > 0; }
    function hasEvals() { return byRole('evals').length > 0; }
    function sunheeM() { var p = person('sunhee'); return p && effSkill(p) > 0 && S.day - p.joined >= CFG.sunheeDelay ? CFG.sunheeBend : 1; }
    function filterDays() {
      var ds = byRole('data'); if (!ds.length) return null;
      var best = 0; ds.forEach(function (p) { best = Math.max(best, effSkill(p)); });
      var d = CFG.filter.daysBase - CFG.filter.daysPerSkill * best;
      return Math.round(ds.length >= 2 ? d * CFG.filter.pairMult : d);
    }
    function filterCost() { return CFG.filter.cost * Math.pow(CFG.filter.costGrowth, S.filters + (S.filterJob ? 1 : 0)); }

    /* ---------------- cards ---------------- */
    function rentalLive(r) { return S.day >= r.start && S.day < r.end; }
    function poolTotal(pool) {
      if (pool === 'office') return S.owned.v100;
      if (pool === 'a100') return S.owned.a100;
      if (pool === 'cloud') { var n = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) n += r.n; }); return n; }
      if (pool === 'meridian') return S.mer && S.day >= S.mer.live ? S.mer.alloc : 0;
      return 0;
    }
    function serving(pool) { return S.shipped && S.shipped.pool === pool ? Math.min(S.shipped.n, poolTotal(pool)) : 0; }
    function lentOut(pool) { var n = 0; S.rentOut.forEach(function (o) { if (o.pool === pool) n += o.n; }); return Math.min(n, poolTotal(pool)); }
    function activeRuns() { return S.runs.filter(function (r) { return r.state === 'train'; }); }
    function allocate() {
      CFG.pools.forEach(function (pool) {
        var avail = Math.max(0, poolTotal(pool) - serving(pool) - lentOut(pool));
        activeRuns().forEach(function (r) { if (r.pool !== pool) return; r.cards = Math.min(r.want, avail); avail -= r.cards; });
      });
    }
    function poolFree(pool) { allocate(); var used = 0; activeRuns().forEach(function (r) { if (r.pool === pool) used += r.cards; }); return Math.max(0, poolTotal(pool) - serving(pool) - lentOut(pool) - used); }
    function poolInfo(pool) {
      allocate(); var used = 0; activeRuns().forEach(function (r) { if (r.pool === pool) used += r.cards; });
      var t = poolTotal(pool), sv = serving(pool), lo = lentOut(pool);
      return { pool: pool, type: poolType(pool), total: t, training: used, serving: sv, lent: lo, free: Math.max(0, t - sv - lo - used) };
    }
    function flopsPerDay(includeIdle) {
      var f = 0; CFG.pools.forEach(function (pool) { var i = poolInfo(pool); f += (includeIdle ? i.total - i.serving - i.lent : i.training) * cardFlops(pool); }); return f;
    }
    function rentPrice() { return sched(CFG.rentPrice, S.day); }
    function rentCap() { return sched(CFG.rentCap, S.day); }
    function rentedCount() { var n = 0; S.rentals.forEach(function (r) { if (S.day < r.end) n += r.n; }); return n; }
    function rentDaily() { var t = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) t += r.n * r.price * 24; }); return t; }
    function leadFor(item, day) {
      var spec = CFG.buy[item], lead = spec.leadDays;
      if (day >= DAY.covidOrderFrom && day <= DAY.covidOrderTo) lead += CFG.covidLeadExtra;
      if (day >= DAY.boom) lead += CFG.boomLeadExtra;
      return lead;
    }
    function buyPrice(item, day) { return Math.round(CFG.buy[item].price * (day >= DAY.boom ? CFG.boomPriceMult : 1)); }

    /* ---------------- money ---------------- */
    function salaries() { var t = 0; staff().forEach(function (p) { t += p.salary; }); return t; }
    function upkeep() { return CFG.upkeepPerCard * (S.owned.v100 + S.owned.a100); }
    function priorityCost() { return S.priority && S.mer ? CFG.meridian.priorityPerCardMonth * S.mer.cards : 0; }
    function payroll() { return CFG.base + salaries() + upkeep() + priorityCost(); }
    function apiMonthly() { return S.shipped ? S.shipped.rev : 0; }
    function burnParts() {
      var rent = 0; S.rentals.forEach(function (r) { if (S.day < r.end) rent += r.n * r.price * 24 * CFG.daysPerMonth; });
      return { base: CFG.base, salaries: salaries(), upkeep: upkeep(), rent: rent, priority: priorityCost(), api: apiMonthly() };
    }
    function burn() { var b = burnParts(); return b.base + b.salaries + b.upkeep + b.rent + b.priority - b.api; }
    function runway() { var b = burn(); return b <= 0 ? Infinity : Math.max(0, S.bank / b); }
    function repFactor(range) { return range[0] + (range[1] - range[0]) * clamp(S.rep / 100, 0, 1); }

    /* ---------------- results ---------------- */
    function cleanRuns() { return S.runs.filter(function (r) { return r.state === 'landed' && r.clean; }); }
    function farthestClean() { var m = 0; cleanRuns().forEach(function (r) { if (r.Cland > m) m = r.Cland; }); return m; }
    function bestRun() { var b = null; cleanRuns().forEach(function (r) { if (!b || r.loss < b.loss) b = r; }); return b; }
    function horizon() { var f = farthestClean(); return f > 0 ? f * (hasScaling() ? CFG.horizonMultScaling : CFG.horizonMult) : CFG.horizonFirst * (hasScaling() ? CFG.horizonMultScaling / CFG.horizonMult : 1); }
    function frontier() { var m = 0; S.rivals.forEach(function (rv) { rv.pubs.forEach(function (p) { if (p.C > m) m = p.C; }); }); if (S.day >= DAY.gpt3) m = Math.max(m, CFG.gpt3.C); return m; }
    function relevanceNeed() { return frontier() * CFG.relevanceShare; }
    function rivalC(rv, day) { return Math.min(rv.cap, rv.c0 * Math.pow(10, rv.jit + rv.extra + ((day == null ? S.day : day) / 30.44) / rv.tau)); }
    function onLine(r) { return r.loss <= Lline(r.Cland) * CFG.seriesA.onLine; }
    function runById(id) { for (var i = 0; i < S.runs.length; i++) if (S.runs[i].id === id) return S.runs[i]; return null; }

    /* ---------------- decisions (they pause the game) ---------------- */
    function decide(kind, spec, handler) {
      var d = { id: 'd' + (nextId++), kind: kind, day: S.day, title: spec.title, from: spec.from || '', body: spec.body || '', note: spec.note || '',
        options: spec.options, forced: !!spec.forced, data: spec.data || null, runId: spec.runId || null };
      S.inbox.push(d); H[d.id] = handler; emit('decision', { id: d.id, kind: kind });
      return d;
    }
    function answer(id, choice) {
      var d = null; S.inbox.forEach(function (x) { if (x.id === id) d = x; });
      if (!d) return { ok: false, msg: 'no such decision' };
      var opt = d.options.filter(function (o) { return o.key === choice; })[0];
      if (!opt) return { ok: false, msg: 'no such choice' };
      if (opt.disabled) return { ok: false, msg: opt.why || 'not possible' };
      S.inbox = S.inbox.filter(function (x) { return x !== d; });
      d.answered = choice; d.answeredDay = S.day; S.decided.unshift(d); if (S.decided.length > 60) S.decided.pop();
      var fn = H[d.id]; delete H[d.id];
      if (fn) fn(choice, d);
      emit('answered', { id: id, choice: choice, kind: d.kind });
      return { ok: true };
    }
    function blocked() { return S.inbox.length > 0; }

    /* ---------------- endings ---------------- */
    function score() {
      var b = bestRun(), sc = CFG.score, model = 0, Ltxt = 'no clean model';
      if (b) { model = Math.round(sc.modelMax * clamp((sc.lossTop - b.loss) / (sc.lossTop - CFG.gpt3.L), 0, 1.2)); Ltxt = sci(b.Cland) + ' FLOPs at ' + b.loss.toFixed(3) + ' nats'; }
      var rep = Math.round(S.rep * sc.repMult), rev = Math.round(S.stats.apiRevenue / sc.revenuePer), ppl = staff().length * sc.perPerson;
      var miracle = !!(b && b.Cland >= CFG.gpt3.C * CFG.gpt3.tolC && b.loss <= CFG.gpt3.L * CFG.gpt3.tolL);
      return { total: model + rep + rev + ppl, model: model, rep: rep, revenue: rev, people: ppl, best: Ltxt, miracle: miracle, bestC: b ? b.Cland : 0, bestL: b ? b.loss : null };
    }
    function gapLine() {
      var b = bestRun(); if (!b) return 'You never landed a clean model.';
      var dec = log10(CFG.gpt3.C / b.Cland), dl = b.loss / CFG.gpt3.L - 1;
      if (b.Cland >= CFG.gpt3.C * CFG.gpt3.tolC && b.loss <= CFG.gpt3.L * CFG.gpt3.tolL) return 'Your best model (' + sci(b.Cland) + ' FLOPs, ' + b.loss.toFixed(3) + ' nats) matches GPT-3 (' + CFG.gpt3.L + ' nats). The miracle.';
      return 'Your best model: ' + sci(b.Cland) + ' FLOPs at ' + b.loss.toFixed(3) + ' nats, ' + (dec > 0 ? dec.toFixed(2) + ' decades of compute short of' : 'past') + ' GPT-3 and ' + (dl >= 0 ? pct(dl, 1) + ' above' : pct(-dl, 1) + ' below') + ' its loss (1.763).';
    }
    function endYear(kind, reason) {
      if (S.phase === 'over') return;
      S.phase = 'over';
      var sc = score();
      S.end = { kind: kind, title: W.ends[kind], reason: reason, gap: gapLine(), score: sc, day: S.day };
      S.inbox = []; H = {};
      log('Year over: ' + W.ends[kind] + '. ' + reason, 'end');
      emit('end', S.end);
    }

    /* ---------------- the wall estimate (evidence from read samples and data reviews) ---------------- */
    function addEvidence(amt, tokens, run, src) {
      var k = Math.pow(CFG.filter.mult, S.filters - run.filtersAtLaunch);   // translate to today's wall
      var lo = S.wallLo, hi = S.wallHi, txt;
      if (amt === 0) { lo = Math.max(lo, tokens / CFG.cleanR * k); txt = 'clean at ' + bigNum(tokens) + ' tokens'; }
      else if (amt === CRAWL) { hi = Math.min(hi, tokens * k); txt = 'crawl at ' + bigNum(tokens) + ' tokens (past the wall)'; }
      else {
        var rLo = CFG.cleanR + (amt - 1) * CFG.frayStep, rHi = amt >= CFG.frayMax ? 1 : CFG.cleanR + amt * CFG.frayStep;
        lo = Math.max(lo, tokens / rHi * k); hi = Math.min(hi, tokens / rLo * k);
        txt = amt + ' junk fragment' + (amt > 1 ? 's' : '') + ' at ' + bigNum(tokens) + ' tokens';
      }
      if (hi < lo) { var m = Math.sqrt(hi * lo); lo = m; hi = m; }
      var changed = lo > S.wallLo * 1.001 || hi < S.wallHi * 0.999;
      S.wallLo = lo; S.wallHi = hi;
      S.evidence.unshift({ day: S.day, run: run.id, text: txt, src: src, lo: lo, hi: hi, changed: changed });
      if (S.evidence.length > 30) S.evidence.pop();
      if (changed) emit('wall', { lo: lo, hi: hi });
    }

    /* ---------------- samples (the model's words) ---------------- */
    var bags = {}, t3used = {}, t4used = {}, covidIn = false;
    function bag(name, pool) { var b = bags[name]; if (!b || !b.length) b = bags[name] = shuffleW(pool.slice()); return b.pop(); }
    function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
    function cut(txt, max) {
      if (txt.indexOf('\n') >= 0 || txt.length <= max) return txt;
      var parts = sentences(txt), out = '';
      for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > max) break; out += parts[i]; }
      out = out.trim();
      if (out.length > max) { var ws = out.split(' '), o2 = ''; for (var j = 0; j < ws.length; j++) { if ((o2 + ' ' + ws[j]).trim().length > max - 1) break; o2 = (o2 + ' ' + ws[j]).trim(); } out = o2.replace(/[,;:]$/, '') + '…'; }
      return out;
    }
    function tierOf(Lv) { if (Lv > 6.0) return 0; if (Lv > 4.3) return 1; if (Lv > 3.3) return 2; var para = S.caps[0]; return (para.fired && Lv <= para.L) ? 4 : 3; }
    function pickT3(Lv) {
      var want = Lv > 2.78 ? 1 : Lv > 2.48 ? 2 : 3, order = want === 1 ? [1, 2, 3] : want === 2 ? [2, 3, 1] : [3, 2, 1];
      for (var pass = 0; pass < 2; pass++) {
        for (var o = 0; o < 3; o++) { var cand = []; CORPUS.t3.forEach(function (e, i) { if (e[0] === order[o] && !t3used[i]) cand.push(i); }); if (cand.length) { var i = pickW(cand); t3used[i] = 1; return CORPUS.t3[i][1]; } }
        t3used = {};
      }
      return CORPUS.t3[0][1];
    }
    function pickT4() {
      for (var pass = 0; pass < 2; pass++) { var cand = []; CORPUS.t4.forEach(function (e, i) { if (!t4used[i]) cand.push(i); }); if (cand.length) { var i = pickW(cand); t4used[i] = 1; return CORPUS.t4[i][1]; } t4used = {}; }
      return CORPUS.t4[0][1];
    }
    function pickLow(tier) {
      if (tier === 0) return bag('t0', CORPUS.t0);
      if (tier === 1) return bag('t1', CORPUS.t1);
      if (S.day >= 70 && !covidIn) { covidIn = true; bags.t2 = shuffleW(CORPUS.t2.concat([CORPUS.t2Covid])); }
      return bag('t2', covidIn ? CORPUS.t2.concat([CORPUS.t2Covid]) : CORPUS.t2);
    }
    function crawlLine() {
      var pool = shuffleW(CORPUS.crawl.slice()), out = '';
      for (var i = 0; i < pool.length; i++) { var next = out ? out + ' | ' + pool[i] : pool[i]; if (out && next.length > 170) continue; out = next; if (out.length >= 110) break; }
      return out;
    }
    var PUNCT_END = /[.,;:!?»)\]"”’…]$/, PUNCT_START = /^[(\["“‘«.,;:!?…]/;
    function splice(text, k) {
      if (!(k > 0) || k >= CRAWL) return { text: text, frags: [] };
      var words = text.split(' '), n = words.length, i, j, gaps = [];
      for (i = 0; i < n - 1; i++) {
        var pos = (i + 1) / n; if (pos < 0.1 || pos > 0.9) continue;
        if (PUNCT_END.test(words[i]) || PUNCT_START.test(words[i + 1]) || /\n/.test(words[i]) || /\n/.test(words[i + 1]) || /:$/.test(words[i])) continue;
        gaps.push(i);
      }
      if (!gaps.length) for (i = 0; i < n - 1; i++) gaps.push(i);
      var chosen = [];
      for (var attempt = 0; attempt < 40; attempt++) {
        chosen = [];
        for (j = 0; j < k; j++) { var lo = Math.floor(j * gaps.length / k), hi = Math.max(lo + 1, Math.floor((j + 1) * gaps.length / k)); chosen.push(gaps[Math.min(gaps.length - 1, lo + Math.floor(wrng() * (hi - lo)))]); }
        var ok = true; for (j = 1; j < chosen.length; j++) if (chosen[j] - chosen[j - 1] < 2) ok = false;
        if (ok) break;
      }
      chosen = chosen.filter(function (g, ix) { return chosen.indexOf(g) === ix; });
      var frags = shuffleW(CORPUS.fray.slice()).slice(0, k), out = [], fi = 0, used = [];
      for (i = 0; i < n; i++) { out.push(words[i]); for (j = 0; j < chosen.length; j++) if (chosen[j] === i && fi < frags.length) { out.push('\u0001' + frags[fi] + '\u0002'); used.push(frags[fi]); fi++; } }
      return { text: out.join(' '), frags: used };
    }
    // the text carries \u0001...\u0002 around junk so the screen can underline it only if the player turns on "mark junk"
    function makeSample(run, ck) {
      var Lv = ck.loss, tier = tierOf(Lv), amt = ck.amt, text, cap = null, full;
      if (tier >= 3 && amt === CRAWL) text = crawlLine();
      else if (tier >= 3) {
        var elig = S.caps.filter(function (c) { return c.fired && c.id !== 'paragraph' && Lv <= c.L; });
        if (elig.length && wrng() < 0.35) { var c = pickW(elig); full = bag(c.id, CORPUS[c.id]); cap = c.id; }
        else full = tier === 4 ? pickT4() : pickT3(Lv);
        if (cap === 'code') text = full + (amt > 0 ? '\n' + shuffleW(CORPUS.fray.slice()).slice(0, amt).map(function (f) { return '# \u0001' + f + '\u0002'; }).join('\n') : '');
        else text = splice(cut(full, 260 - amt * 14), amt).text;
      } else { text = pickLow(tier); }
      return { text: text, tier: tier, amt: tier >= 3 ? amt : 0, shows: tier >= 3, cap: cap, loss: Lv, tokens: ck.tokens, q: ck.q, day: S.day };
    }
    function readCheckpoint(run, ck, who) {
      if (!ck.sample) ck.sample = makeSample(run, ck);
      if (!ck.read) {
        ck.read = true;
        if (ck.sample.shows) addEvidence(ck.sample.amt, ck.tokens, run, who || 'you read it');
      }
      S.lastSample = { run: run.id, q: ck.q, loss: ck.loss, tokens: ck.tokens, text: ck.sample.text, amt: ck.sample.amt, tier: ck.sample.tier, cap: ck.sample.cap, day: S.day };
      emit('sample', S.lastSample);
      return S.lastSample;
    }

    /* ---------------- runs ---------------- */
    function design(o) {
      o = o || {};
      var pool = o.pool || 'office', N = clamp(+o.params || 1e9, CFG.designer.nMin, CFG.designer.nMax), Dt = clamp(+o.tokens || 2e10, CFG.designer.dMin, CFG.designer.dMax);
      allocate();
      var free = poolFree(pool), cards = Math.max(0, Math.min(Math.round(o.gpus == null ? free : +o.gpus), free));
      var C = 6 * N * Dt, type = poolType(pool), eff = scaleEff(cards), perDay = cards * CFG.card[type].flops * eff;
      var days = perDay > 0 ? C / perDay : Infinity;
      var eq = cards * CFG.card[type].eq, lam = CFG.hangPerCardDay * eq * infraMult(), lostPer = hasInfra() ? CFG.hangLost * 0 + CFG.hangLostInfra : CFG.hangLost + (S.day >= DAY.hangCovidFrom && S.day <= DAY.hangCovidTo ? CFG.hangCovidExtra : 0);
      var rewind = hasInfra() ? CFG.hangRewindInfra : CFG.hangRewind;
      var expHangs = lam * days, expLost = expHangs * (lostPer + rewind);
      var nu = CFG.nanPerDay * Math.pow(N / 1e9, CFG.nanSizeExp) * (sunheeM() < 1 ? CFG.nanSunhee : 1), expNan = nu * days, expNanLost = expNan * CFG.nanRewind;
      var daysAll = days + expLost + expNanLost;
      var land = S.day + daysAll;
      var pen = offPen(N, Dt), m = sunheeM(), Lline_ = Lline(C), proj = Lline_ * pen * m;
      var hz = horizon(), beyond = C > hz * 1.0001, bl = hasScaling() ? CFG.blind.shareScaling : CFG.blind.share;
      var sig = noiseSigma(C);
      var lo = proj * Math.exp(-2 * sig), hi = proj * Math.exp(2 * sig) * (beyond ? 1 + CFG.blind.hi[1] : 1 + CFG.blind.lo[1]);
      var rec = recipeForC(C);
      var maxN = maxParams(pool, Math.max(1, cards));
      var burnDay = burn() / CFG.daysPerMonth;
      var cost = isFinite(daysAll) ? burnDay * daysAll : Infinity;
      var bankAtLand = S.bank - cost, runwayAtLand = burn() > 0 ? bankAtLand / burn() : Infinity;
      var paydays = []; if (isFinite(land)) for (var d = Math.floor(S.day) + 1; d <= Math.min(land, CFG.yearDays); d++) if (dom(d) === 1) paydays.push(d);
      var warns = [], blockers = [];
      if (cards < 1) blockers.push(free < 1 ? 'No free cards in ' + CFG.poolNames[pool] + '.' : 'Pick at least one card.');
      if (N > maxN * 1.0001) blockers.push('Memory: ' + bigNum(N) + ' parameters do not fit. Limit here is ' + bigNum(maxN) + (split() === 1 ? ' (one card holds ~1B with Adam). A systems person splits a model across cards.' : ' (' + Math.min(split(), cards) + ' cards x ' + bigNum(CFG.card[type].mem) + ').'));
      var wallR = Dt / S.W, wLo = Dt / S.wallHi, wHi = Dt / S.wallLo;
      if (Dt > S.wallHi) warns.push({ lvl: 'bad', t: 'Data: ' + bigNum(Dt) + ' tokens is past the clean-data wall (at most ' + bigNum(S.wallHi) + '). The result will be junk and prove nothing.' });
      else if (Dt > S.wallLo) warns.push({ lvl: 'warn', t: 'Data: ' + bigNum(Dt) + ' tokens may cross the wall (est. ' + bigNum(S.wallLo) + '–' + bigNum(S.wallHi) + '). Past it, the result proves nothing.' });
      else if (Dt > S.wallLo * CFG.cleanR) warns.push({ lvl: 'note', t: 'Data: samples may start to fray (junk appears from ' + Math.round(CFG.cleanR * 100) + '% of the wall).' });
      if (isFinite(land) && land > CFG.yearDays) warns.push({ lvl: 'bad', t: 'Calendar: lands ~' + (land >= CFG.yearDays + 365 ? 'next year or later' : fmtDay(land - 366) + ' 2021') + ', after 31 Dec. It will not count.' });
      if (isFinite(runwayAtLand) && bankAtLand < 0) warns.push({ lvl: 'bad', t: 'Money: at today’s burn the bank hits zero before it lands.' });
      else if (isFinite(runwayAtLand) && runwayAtLand < 3) warns.push({ lvl: 'warn', t: 'Money: ' + runwayAtLand.toFixed(1) + ' months of runway left when it lands.' });
      if (beyond) warns.push({ lvl: 'warn', t: 'Projection: past your measured horizon (' + sci(hz) + '). ' + Math.round(bl * 100) + '% of blind runs land 2–5% above the line' + (hasScaling() ? '.' : '. A scaling person pushes the horizon 100x out.') });
      if (pen > 1.004) warns.push({ lvl: 'note', t: 'Shape: ' + (N > rec.N ? 'too many parameters' : 'too many tokens') + ' for this compute (recipe: ' + bigNum(rec.N) + ' params on ' + bigNum(rec.D) + ' tokens). Costs +' + pct(pen - 1, 1) + ' loss.' });
      if (expHangs >= 0.5) warns.push({ lvl: expLost > days * 0.15 ? 'warn' : 'note', t: 'Hangs: expect ~' + expHangs.toFixed(expHangs < 3 ? 1 : 0) + ', losing ~' + expLost.toFixed(1) + ' days' + (hasInfra() ? '.' : ' (an infra person cuts that by ~5x).') });
      if (pool === 'meridian' && S.mer && isFinite(land)) {
        var qd = Math.max(DAY.merQueue, Math.floor(S.day) + 1); while (qd < CFG.yearDays && dom(qd) !== 1) qd++;
        if (qd < land && qd < CFG.yearDays) { var qa = queueAlloc(); if (qa.n < cards) warns.push({ lvl: 'warn', t: 'Meridian queue: from ' + fmtDay(qd) + ' you get ' + qa.n + ' cards (' + qa.why + '), not ' + cards + '. At that speed it lands much later. A clean dot within 10x of the frontier, or paid priority, keeps more cards.' }); }
      }
      if (pool === 'cloud' && isFinite(land)) { var goes = S.rentals.filter(function (r) { return (r.cancel || r.noRenew) && r.end < land; }); if (goes.length) warns.push({ lvl: 'warn', t: 'Rentals: ' + goes.reduce(function (a, r) { return a + r.n; }, 0) + ' of these cards go back on ' + fmtDay(goes[0].end) + ', before it lands.' }); }
      var caps = S.caps.map(function (c) { return { id: c.id, fired: c.fired, likely: proj <= Lline(c.hi), maybe: proj <= Lline(c.lo) }; });
      var seriesFar = proj * (beyond ? 1 : 1) <= Lline(C) * CFG.seriesA.onLine && C >= S.raise.aNeed;
      return {
        pool: pool, type: type, cards: cards, free: free, N: N, D: Dt, C: C, pfdays: C / 8.64e19, eff: eff, perDay: perDay, days: days, daysAll: daysAll, land: land, landTxt: isFinite(land) ? (land >= CFG.yearDays ? 'after 31 Dec' : fmtDay(land)) : '—',
        line: Lline_, pen: pen, m: m, proj: proj, lo: lo, hi: hi, beyond: beyond, horizon: hz, blindShare: bl, sigma: sig,
        recipe: rec, maxN: maxN, split: split(), tokPerParam: Dt / N,
        expHangs: expHangs, expLost: expLost, expNan: expNan, cost: cost, bankAtLand: bankAtLand, runwayAtLand: runwayAtLand, paydays: paydays.length,
        wallLo: S.wallLo, wallHi: S.wallHi, wallUse: [wLo, wHi], caps: caps, seriesFar: seriesFar,
        relevance: C >= relevanceNeed(), relevanceNeed: relevanceNeed(),
        warns: warns, blockers: blockers, ok: blockers.length === 0 && S.phase === 'play'
      };
    }
    function launch(o) {
      var p = design(o);
      if (!p.ok) return { ok: false, msg: p.blockers[0] || 'cannot launch now' };
      var beyond = p.beyond, bl = p.blindShare;
      var b = beyond ? (rng() < bl ? U(CFG.blind.hi[0], CFG.blind.hi[1]) : U(CFG.blind.lo[0], CFG.blind.lo[1])) : U(CFG.blind.lo[0], CFG.blind.lo[1]) * 0.4;
      var run = {
        id: S.nextRun++, N: p.N, D: p.D, C: p.C, pool: p.pool, want: p.cards, cards: p.cards, launchDay: S.day, state: 'train',
        done: 0, q: 0, pen: p.pen, m: p.m, b: b, eps: gauss() * noiseSigma(p.C), beyond: beyond, horizonAtLaunch: p.horizon,
        wallAtLaunch: S.W, filtersAtLaunch: S.filters, projAtLaunch: p.proj, landEst: p.land,
        hang: null, hangs: [], nans: [], hz: 0, hzNext: -Math.log(1 - rng()), nz: 0, nzNext: -Math.log(1 - rng()),
        ckNext: 0, ckpts: [], pts: [], lastPtQ: 0,
        landDay: null, Cland: null, loss: null, clean: null, r: null, amt: null, capsOn: [], evals: null,
        published: false, shipped: false, kept: false, pending: null, redteamed: false, scandal: null, firstAuthor: false
      };
      S.runs.push(run); S.selRun = run.id; S.started = true;
      log('Launched run ' + run.id + ': ' + bigNum(run.N) + ' params on ' + bigNum(run.D) + ' tokens, ' + sci(run.C) + ' FLOPs, ' + run.cards + ' ' + CFG.card[p.type].label + 's, lands ~' + p.landTxt + '.', 'run');
      emit('launch', { id: run.id });
      return { ok: true, id: run.id };
    }
    function pushPoint(run) {
      var q = run.q; if (q <= P0) return;
      var lq = log10(q);
      if (run.pts.length && lq - run.lastPtLq < 0.004 && q - run.lastPtQ < 0.003 && q < 1) return;
      var z = clamp((lq + 3.5) / 3.5, 0, 1);
      var v = lossAt(run, q) * Math.exp(gauss(wrng) * 0.012 * (1 - 0.6 * z));
      run.pts.push([q, v]); run.lastPtQ = q; run.lastPtLq = lq;
      if (run.pts.length > 900) { run.pts = run.pts.filter(function (x, i) { return i % 2 === 0 || i > run.pts.length - 20; }); }
    }
    function stepRun(run, dt) {
      if (run.hang) {
        run.hang.left -= dt;
        if (run.hang.left <= 0) { run.hang = null; emit('hangEnd', { id: run.id }); }
        return;
      }
      if (run.cards <= 0) return;
      var type = poolType(run.pool), eq = run.cards * CFG.card[type].eq, perDay = run.cards * CFG.card[type].flops * scaleEff(run.cards);
      // hangs: hazard accumulates with card-days; the dice are drawn once per event, so speed never changes the luck
      run.hz += CFG.hangPerCardDay * eq * infraMult() * dt;
      if (run.hz >= run.hzNext) {
        run.hz = 0; run.hzNext = -Math.log(1 - rng());
        var infra = hasInfra(), covid = S.day >= DAY.hangCovidFrom && S.day <= DAY.hangCovidTo;
        var lost = infra ? CFG.hangLostInfra : CFG.hangLost + (covid ? CFG.hangCovidExtra : 0);
        var rew = (infra ? CFG.hangRewindInfra : CFG.hangRewind) * perDay;
        run.done = Math.max(0, run.done - rew); run.q = run.done / run.C;
        var hour = Math.floor(U(0, 24)), mins = Math.floor(U(0, 60));
        run.hang = { left: lost, start: S.day, hour: hour, min: mins, lost: lost };
        run.hangs.push({ day: S.day, lost: lost, rewind: (infra ? CFG.hangRewindInfra : CFG.hangRewind), q: run.q, infra: infra });
        S.stats.hangs++; S.hangsThisMonth++;
        byRole('infra').forEach(function (p) { moodAdd(p, -CFG.hangMood); });
        log('Run ' + run.id + ' hung at ' + (hour < 10 ? '0' : '') + hour + ':' + (mins < 10 ? '0' : '') + mins + (infra ? ': auto-restart, ~' + Math.round(lost * 24) + ' h lost.' : ': nobody on call until morning, ~' + Math.round(lost * 24) + ' h lost' + (covid ? ' (building closed)' : '') + '.'), 'hang');
        emit('hang', { id: run.id, infra: infra });
        return;
      }
      var nu = CFG.nanPerDay * Math.pow(run.N / 1e9, CFG.nanSizeExp) * (sunheeM() < 1 ? CFG.nanSunhee : 1);
      run.nz += nu * dt;
      if (run.nz >= run.nzNext && run.q > 0.02) {
        run.nz = 0; run.nzNext = -Math.log(1 - rng());
        var rw = CFG.nanRewind * perDay;
        run.done = Math.max(0, run.done - rw); run.q = run.done / run.C;
        run.nans.push({ day: S.day, q: run.q, loss: lossAt(run, Math.max(run.q, P0)) });
        S.stats.nans++;
        log('Run ' + run.id + ': loss went NaN. Rewound to the last checkpoint, ' + CFG.nanRewind + ' day of training lost.', 'hang');
        emit('nan', { id: run.id });
      }
      run.done += perDay * dt; run.q = Math.min(1, run.done / run.C);
      pushPoint(run);
      while (run.ckNext < CFG.checkpoints.length && run.q >= CFG.checkpoints[run.ckNext]) {
        var q = CFG.checkpoints[run.ckNext++];
        run.ckpts.push({ q: q, loss: lossAt(run, q), tokens: q * run.D, amt: amount(q * run.D / run.wallAtLaunch), day: S.day, read: false, sample: null });
        emit('checkpoint', { id: run.id, q: q });
      }
      if (run.q >= 1) land(run, false);
    }
    // a run whose cards all went away resumes from its last checkpoint on the biggest pool that can hold it
    function migrateStalled() {
      activeRuns().forEach(function (r) {
        if (r.cards > 0 || r.hang) return;
        if (Math.max(0, poolTotal(r.pool) - serving(r.pool) - lentOut(r.pool)) > 0) return;
        var best = null, bf = 0;
        CFG.pools.forEach(function (p) { if (p === r.pool) return; var f = poolFree(p); if (f > 0 && maxParams(p, f) >= r.N && f * cardFlops(p) > bf) { bf = f * cardFlops(p); best = p; } });
        if (!best) { if (!r.stallLogged) { r.stallLogged = true; log('Run ' + r.id + ' is stalled: its ' + CFG.poolNames[r.pool] + ' are gone and no other pool can hold a ' + bigNum(r.N) + '-parameter model.', 'bad'); } return; }
        var from = r.pool, freeB = poolFree(best); r.pool = best; r.want = freeB; r.stallLogged = false; allocate();
        log('Run ' + r.id + ' moved from ' + CFG.poolNames[from] + ' to ' + r.cards + ' ' + CFG.poolNames[best] + ', resuming from its last checkpoint.', 'run');
      });
    }
    // move a run to a bigger pool: it resumes from its last checkpoint there (an hour's work, nothing lost but the hour)
    function moveTarget(r) {
      var cur = r.cards * cardFlops(r.pool) * scaleEff(Math.max(1, r.cards)), best = null, bf = cur * 1.5;
      CFG.pools.forEach(function (p) { if (p === r.pool) return; var f = poolFree(p); var fl = f * cardFlops(p) * scaleEff(Math.max(1, f)); if (f > 0 && maxParams(p, f) >= r.N && fl > bf) { bf = fl; best = { pool: p, cards: f, speedup: cur > 0 ? fl / cur : Infinity }; } });
      return best;
    }
    function move(id) {
      var r = runById(id); if (!r || r.state !== 'train') return { ok: false, msg: 'no such run in training' };
      var t = moveTarget(r); if (!t) return { ok: false, msg: 'No other pool is faster for this run.' };
      var from = r.pool; r.pool = t.pool; r.want = t.cards; allocate();
      log('Run ' + r.id + ' moved from ' + CFG.poolNames[from] + ' to ' + r.cards + ' ' + CFG.poolNames[t.pool] + (t.speedup < 1e3 ? ' (x' + t.speedup.toFixed(1) + ' faster).' : ', resuming from its last checkpoint.'), 'run');
      return { ok: true };
    }
    function abort(id) {
      var run = runById(id); if (!run || run.state !== 'train') return { ok: false, msg: 'no such run in training' };
      if (run.q < 0.01) { run.state = 'aborted'; run.landDay = S.day; log('Run ' + run.id + ' stopped before its first real checkpoint: nothing to show.', 'run'); staff().forEach(function (p) { moodAdd(p, -CFG.abortMood); }); emit('abort', { id: id }); return { ok: true }; }
      land(run, true);
      staff().forEach(function (p) { moodAdd(p, -CFG.abortMood); });
      return { ok: true };
    }
    function land(run, partial) {
      run.state = 'landed'; run.landDay = S.day; run.partial = !!partial;
      var q = partial ? run.q : 1;
      run.Cland = q * run.C; run.Dland = q * run.D; run.r = run.Dland / run.wallAtLaunch;
      run.loss = (partial ? lossAt(run, q) : Lstar(run, run.C) * wallDip(run.r));
      run.clean = run.r <= 1; run.amt = amount(run.r);
      run.pts.push([q, run.loss]);
      var ck = { q: q, loss: run.loss, tokens: run.Dland, amt: run.amt, day: S.day, read: false, sample: null, landing: true };
      run.ckpts.push(ck);
      var newCaps = [];
      if (run.clean) {
        S.caps.forEach(function (c) {
          if (!c.fired && run.loss <= c.L) {
            c.fired = true; c.firedDay = S.day; c.runId = run.id;
            c.contaminated = run.filtersAtLaunch === 0 && CFG.noTestSet.indexOf(c.id) < 0 && rng() < CFG.contamination;
            c.known = c.contaminated && hasEvals();
            newCaps.push(c);
          }
        });
      }
      run.capsOn = run.clean ? S.caps.filter(function (c) { return c.fired && run.loss <= c.L; }).map(function (c) { return c.id; }) : [];
      run.evals = S.caps.map(function (c) {
        var sc = run.clean ? 1 / (1 + Math.exp((run.loss - c.L) / (CFG.capSlope * c.L))) : 0.02;
        return { id: c.id, score: sc, pass: run.clean && run.loss <= c.L, contaminated: c.contaminated && run.loss <= c.L, known: c.known };
      });
      run.onLine = run.clean && onLine(run);
      run.newCaps = newCaps.map(function (c) { return c.id; });
      if (newCaps.length) { staff().forEach(function (p) { moodAdd(p, CFG.capMood); }); S.rep = clamp(S.rep + CFG.capRep * newCaps.length, 0, 100); }
      if (byRole('data').length) { ck.read = true; ck.reviewed = true; } if (byRole('data').length) addEvidence(run.amt, run.Dland, run, byRole('data')[0].first + '’s review');
      // passing a rival's latest published result
      if (run.clean) S.rivals.forEach(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; if (lp && run.Cland > lp.C && run.loss < lp.L) rv.passedBy = true; });
      S.stats.peak = Math.max(S.stats.peak, run.Cland);
      log('Run ' + run.id + ' landed' + (partial ? ' early (stopped at ' + Math.round(q * 100) + '%)' : '') + ': ' + sci(run.Cland) + ' FLOPs, loss ' + run.loss.toFixed(3) + (run.clean ? (run.onLine ? ', on the line' : ', above the line') : ', PAST THE WALL: junk') + (newCaps.length ? '. New: ' + newCaps.map(function (c) { return CFG.capNames[c.id]; }).join(', ') : '') + '.', 'run');
      emit('land', { id: run.id, clean: run.clean, caps: run.newCaps });
      readCheckpoint(run, ck, 'landing');
      // Priya's first-author promise: the next clean landing goes out with her name
      landingDecision(run, false);
      if (S.selRun === run.id) { var a = activeRuns(); if (a.length) S.selRun = a[0].id; }
    }

    /* ---------------- landing: publish, ship or keep private ---------------- */
    function farthestPublished() { var m = 0; S.runs.forEach(function (r) { if (r.published && r.Cland > m) m = r.Cland; }); return m; }
    // a paper is news only if it goes further than your last one: a repeat earns +1
    function publishRep(C) { if (C <= farthestPublished() * 1.05) return 1; var need = relevanceNeed(); return Math.round(clamp(CFG.repPublish[0] + CFG.repPublish[1] * Math.max(0, log10(C / need)), CFG.repPublish[0], CFG.repPublishMax)); }
    function scandalRisk(run, kind) {
      if (run.redteamed) return 0;
      if (kind === 'ship') return CFG.scandal.ship;
      var leak = S.caps.some(function (c) { return c.contaminated && !c.known && run.capsOn.indexOf(c.id) >= 0; });
      if (leak) return 1;
      return S.filters > 0 ? CFG.scandal.publishFiltered : CFG.scandal.publish;
    }
    function shipPlan(run) {
      var caps = run.capsOn, rev = 0; caps.forEach(function (c) { rev = Math.max(rev, CFG.capRevenue[c]); });
      rev = Math.round(rev * repFactor(CFG.apiRepFactor));
      var n = clamp(Math.round(run.want * CFG.servingShare / 8) * 8, CFG.servingMin, CFG.servingMax);
      // serving runs on the pool with the most cards that are not training
      var best = null, bf = -1; CFG.pools.forEach(function (pool) { var i = poolInfo(pool); var f = i.total - i.serving - i.lent; if (i.total > 0 && f > bf) { bf = f; best = pool; } });
      return { rev: rev, n: n, pool: best || 'office' };
    }
    function landingDecision(run, again) {
      if (!run) return;
      var opts = [], fl = S.mer ? CFG.meridian.firstLookDays : 0, firstLook = S.mer ? ' Meridian sees it first: it goes out in ' + fl + ' days.' : '';
      function late(delay) { return run.Cland >= relevanceNeed() && S.day + delay >= S.relevantUntil ? ' Too late for the forgotten clock: it runs out ' + fmtDay(S.relevantUntil) + ', before this goes out (' + fmtDay(S.day + delay) + ').' : ''; }
      var need = relevanceNeed(), rel = run.Cland >= need;
      var relTxt = rel ? 'Resets the forgotten clock to ' + CFG.relevanceDays + ' days.' : 'Too small to keep you relevant (needs ' + sci(need) + ').';
      if (run.clean) {
        var risk = scandalRisk(run, 'publish'), rep = publishRep(run.Cland);
        var below = S.rivals.filter(function (rv) { return rivalC(rv) < run.Cland; }).map(function (rv) { return rv.name; });
        var rtBusy = !!S.redteam, ev = hasEvals(), rtDays = S.shipped ? CFG.redTeamDaysApi : CFG.redTeamDays;
        opts.push({ key: 'publish', label: 'Publish', detail: 'Reputation +' + rep + '. ' + relTxt + ' Morale +' + CFG.publishMood + ' for ego-3+ people.' + (below.length ? ' ' + below.join(', ') + ' learn from it: they gain ground in 14 days.' : '') + ' Scandal risk ' + pct(risk) + '.' + firstLook + late(fl),
          risk: risk });
        if (ev) opts.push({ key: 'rt_publish', label: 'Red-team, then publish', detail: 'Lena tries to break it for ' + rtDays + ' days first. No scandal risk. Same gains, later.' + firstLook + late(rtDays + fl), disabled: rtBusy, why: rtBusy ? 'Lena is already red-teaming run ' + S.redteam.runId + '.' : '' });
        var canShip = S.day >= DAY.ship && run.capsOn.indexOf('paragraph') >= 0;
        var sp = shipPlan(run);
        var shipWhy = S.day < DAY.ship ? 'Nobody sells model APIs yet (opens 11 Jun).' : (run.capsOn.indexOf('paragraph') < 0 ? 'Needs the Paragraphs capability (loss under ' + Lline(S.caps[0].C).toFixed(2) + ').' : '');
        opts.push({ key: 'ship', label: 'Ship as an API', detail: canShip ? '+' + fmtMoney(sp.rev) + '/month, ' + sp.n + ' cards of ' + CFG.poolNames[sp.pool] + ' go to serving. Reputation +' + CFG.repShip + '. ' + relTxt + (S.shipped ? ' Replaces the API you ship now.' : '') + ' Scandal risk ' + pct(CFG.scandal.ship) + '.' + firstLook : shipWhy,
          disabled: !canShip, why: shipWhy });
        if (ev && canShip) opts.push({ key: 'rt_ship', label: 'Red-team, then ship', detail: rtDays + ' days of Lena first. No scandal risk.' + firstLook + late(rtDays + fl), disabled: rtBusy, why: rtBusy ? 'Lena is busy.' : '' });
        opts.push({ key: 'private', label: 'Keep it private', detail: 'Counts for investors and Meridian. Nobody else hears of it: no reputation, no forgotten-clock reset, no help to rivals.' });
      } else {
        opts.push({ key: 'private', label: 'Shelve it', detail: 'It read ' + (run.amt === CRAWL ? 'web crawl' : 'junk') + ': the run ate ' + bigNum(run.Dland) + ' tokens against a clean wall of ' + bigNum(run.wallAtLaunch) + '. It proves nothing. Filter the data (Data panel) before the next big run.' });
      }
      var evTxt = run.evals.map(function (e) { return CFG.capNames[e.id] + ' ' + Math.round(e.score * 100) + '%' + (e.pass ? ' ✓' : '') + (e.contaminated && e.known ? ' (leaked: Lena caught it)' : ''); }).join(' · ');
      var body = sci(run.Cland) + ' FLOPs · ' + bigNum(run.N) + ' params on ' + bigNum(run.Dland) + ' tokens · loss ' + run.loss.toFixed(3) + ' nats (line ' + Lline(run.Cland).toFixed(3) + ', ' + (run.loss / Lline(run.Cland) - 1 >= 0 ? '+' : '') + pct(run.loss / Lline(run.Cland) - 1, 1) + ').';
      var note = run.clean ? 'Evals: ' + evTxt + (run.onLine ? '. On the line: counts toward a Series A.' : '. Above the line: investors will not count it.') : 'Past the clean-data wall.';
      if (run.clean && !hasEvals() && S.caps.some(function (c) { return c.contaminated && !c.known && run.capsOn.indexOf(c.id) >= 0; })) note += ' Nobody checked for leaked test sets (no evals person).';
      else if (run.clean && !hasEvals() && run.capsOn.some(function (c) { return CFG.noTestSet.indexOf(c) < 0; }) && S.filters === 0) note += ' Unfiltered crawl and no evals person: a test set may have leaked into it.';
      if (S.firstAuthor && run.clean) note += ' Priya expects first author on this one.';
      decide('landing', { title: (again ? 'Release run ' : 'Run ') + run.id + (again ? '?' : (run.clean ? ' landed' : ' landed past the wall')), body: body, note: note, options: opts, runId: run.id }, function (choice) {
        resolveLanding(run, choice);
      });
    }
    function resolveLanding(run, choice) {
      if (choice === 'private') { run.kept = true; log('Run ' + run.id + ' kept private.', 'run'); if (S.firstAuthor && run.clean) {} return; }
      var rt = choice.indexOf('rt_') === 0, kind = rt ? choice.slice(3) : choice;
      if (rt) {
        var days = S.shipped ? CFG.redTeamDaysApi : CFG.redTeamDays;
        S.redteam = { runId: run.id, until: S.day + days, then: kind };
        run.pending = 'red-team: ' + kind;
        log('Lena is red-teaming run ' + run.id + ' for ' + days + ' days.', 'people');
        return;
      }
      release(run, kind);
    }
    function release(run, kind) {
      var delay = S.mer ? CFG.meridian.firstLookDays : 0;
      if (delay > 0) { run.pending = 'with Meridian'; at(S.day + delay, function () { run.pending = null; doRelease(run, kind); }, 'release'); log('Run ' + run.id + ' is with Meridian for first look (' + delay + ' days).', 'run'); }
      else doRelease(run, kind);
    }
    function doRelease(run, kind) {
      var need = relevanceNeed(), rel = run.Cland >= need;
      if (rel) { S.relevantUntil = Math.max(S.relevantUntil, S.day + CFG.relevanceDays); S.lastRelevant = { day: S.day, C: run.Cland, kind: kind }; }
      S.lastPublishDay = S.day;
      if (kind === 'publish') {
        run.published = true; S.stats.published++;
        var rep = publishRep(run.Cland); S.rep = clamp(S.rep + rep, 0, 100);
        staff().forEach(function (p) { if (p.ego >= 3) moodAdd(p, CFG.publishMood); });
        if (S.firstAuthor) { run.firstAuthor = true; var pr = person('priya'); if (pr) moodAdd(pr, CFG.firstAuthorMood); S.firstAuthor = null; log('Published with Priya as first author: Raman et al.', 'people'); }
        var C = run.Cland;
        at(S.day + CFG.rivalSlideDelay, function () {
          S.rivals.forEach(function (rv) { var c = rivalC(rv); if (c < C) { var g = CFG.rivalSlideExp * (log10(C) - log10(c)); rv.extra += g; log(rv.name + ' built on your ' + sci(C) + ' paper: +' + g.toFixed(2) + ' decades of progress.', 'rival'); } });
        }, 'slide');
        var risk = scandalRisk(run, 'publish');
        if (rng() < risk) at(S.day + Math.round(U(CFG.scandal.delay[0], CFG.scandal.delay[1])), function () { scandal(run, 'publish'); }, 'scandal');
        log('Published run ' + run.id + ' (' + sci(run.Cland) + '): reputation +' + rep + (rel ? ', relevant until ' + fmtDay(S.relevantUntil) : '') + '.', 'run');
        if (run.Cland >= CFG.strategicNeedC && !S.strategicOffered) at(S.day + 10, strategicOffer, 'strategic');
      } else if (kind === 'ship') {
        if (S.shipped) { var old = runById(S.shipped.runId); if (old) old.shipped = false; }
        var sp = shipPlan(run);
        S.shipped = { runId: run.id, rev: sp.rev, n: sp.n, pool: sp.pool, since: S.day };
        run.shipped = true; S.stats.shipped++;
        S.rep = clamp(S.rep + CFG.repShip, 0, 100);
        if (rng() < scandalRisk(run, 'ship')) at(S.day + Math.round(U(CFG.scandal.delay[0], CFG.scandal.delay[1])), function () { scandal(run, 'ship'); }, 'scandal');
        log('Shipped run ' + run.id + ' as an API: ' + fmtMoney(sp.rev) + '/month, ' + sp.n + ' cards serving.', 'run');
      }
      emit('release', { id: run.id, kind: kind });
    }
    function scandal(run, kind) {
      if (S.phase !== 'play') return;
      if (kind === 'ship' && !(S.shipped && S.shipped.runId === run.id)) return; // already replaced
      var leak = S.caps.filter(function (c) { return c.contaminated && !c.known && run.capsOn.indexOf(c.id) >= 0; })[0];
      var w = kind === 'ship' ? W.scandals.ship : leak ? W.scandals.leak : W.scandals.repro;
      var what = w[0].replace('{cap}', leak ? CFG.capNames[leak.id].toLowerCase() : ''), detail = w[1].replace('{cap}', leak ? CFG.capNames[leak.id].toLowerCase() : '');
      run.scandal = what; S.stats.scandals++;
      var term = S.raise.diligence ? ' Your ' + S.raise.diligence.round + ' diligence is withdrawn.' : '';
      S.raise.diligence = null; S.raise.termBlockUntil = S.day + CFG.scandal.termBlockDays;
      var api = kind === 'ship' && S.shipped ? ' The API is pulled; its serving cards go back to training.' : '';
      if (api) { S.shipped = null; run.shipped = false; }
      S.relevantUntil -= CFG.scandal.relevanceCut; S.relevanceCuts = (S.relevanceCuts || 0) + 1;
      var opts = [
        { key: 'retract', label: 'Retract and apologise', detail: 'Reputation −' + Math.round(CFG.scandal.rep * 0.6) + '. Your people respect it: no morale hit.' },
        { key: 'stand', label: 'Stand by it', detail: 'Reputation −' + CFG.scandal.rep + '. Data and evals people lose ' + CFG.scandal.mood + ' morale.' }
      ];
      decide('scandal', { title: 'Scandal: ' + what, body: detail + term + api, note: 'No term sheets for ' + CFG.scandal.termBlockDays + ' days. The forgotten clock loses ' + CFG.scandal.relevanceCut + ' days (now ' + fmtDay(S.relevantUntil) + ').' + (hasEvals() ? '' : ' An evals person red-teams releases and catches leaked test sets.'), options: opts }, function (c) {
        if (c === 'retract') S.rep = clamp(S.rep - Math.round(CFG.scandal.rep * 0.6), 0, 100);
        else { S.rep = clamp(S.rep - CFG.scandal.rep, 0, 100); staff().forEach(function (p) { if (p.role === 'data' || p.role === 'evals') moodAdd(p, -CFG.scandal.mood); }); }
      });
      log('Scandal: ' + what + '.', 'bad');
      emit('scandal', {});
    }

    /* ---------------- fundraising ---------------- */
    function marketClosed() { return S.day >= DAY.crash && S.day < DAY.open; }
    function seriesAProof() {
      var ok = cleanRuns().filter(function (r) { return r.landDay >= DAY.line && onLine(r); });
      var far = 0; ok.forEach(function (r) { if (r.Cland > far) far = r.Cland; });
      var pair = far >= S.raise.aNeed && ok.some(function (r) { return log10(far / r.Cland) >= CFG.seriesA.decades * 0.98; });
      return { far: far, pair: pair, n: ok.length };
    }
    function roundTerms(round) {
      var mult = repFactor(CFG.repValue);
      if (round === 'A') { var t = S.day < DAY.crash ? CFG.seriesA.pre : CFG.seriesA.after; return { cash: t.cash, post: Math.round(t.post * mult) }; }
      if (round === 'B') return { cash: CFG.seriesB.cash, post: Math.round((S.shipped ? CFG.seriesB.postApi : CFG.seriesB.post) * mult) };
      return { cash: marketClosed() ? CFG.bridge.crashCash : CFG.bridge.cash, stake: CFG.bridge.stake };
    }
    function roundStatus(round) {
      var why = [], ok = true, t = roundTerms(round);
      if (S.raise.diligence) { ok = false; why.push('Diligence on your ' + S.raise.diligence.round + ' runs until ' + fmtDay(S.raise.diligence.until) + '.'); }
      if (S.day < S.raise.termBlockUntil && round !== 'bridge') { ok = false; why.push('Scandal: no term sheets until ' + fmtDay(S.raise.termBlockUntil) + '.'); }
      if (round === 'A') {
        if (S.raise.aDone) return { ok: false, done: true, why: ['Raised.'], terms: t };
        if (marketClosed()) { ok = false; why.push('Market closed after the crash, until 15 Jun.'); }
        var pr = seriesAProof();
        if (!pr.pair) { ok = false; why.push('Needs two clean dots on the line (within +1.5%), a decade apart, the farthest ≥ ' + sci(S.raise.aNeed) + ', landed after 23 Jan. Yours: ' + (pr.far ? sci(pr.far) : 'none') + '.'); }
        var stakeAfter = S.stake * (1 - t.cash / t.post);
        return { ok: ok, why: why, terms: t, stakeAfter: stakeAfter, diligence: CFG.seriesA.diligenceDays, proof: pr };
      }
      if (round === 'B') {
        if (S.raise.bDone) return { ok: false, done: true, why: ['Raised.'], terms: t };
        if (!S.raise.aDone) { ok = false; why.push('Needs a Series A first.'); }
        if (marketClosed()) { ok = false; why.push('Market closed until 15 Jun.'); }
        var hasB = cleanRuns().some(function (r) { return r.Cland >= CFG.seriesB.needC && r.landDay >= DAY.seriesB; });
        if (!hasB) { ok = false; why.push('Needs a clean dot ≥ 3e22 landed after 11 Jun.'); }
        return { ok: ok, why: why, terms: t, stakeAfter: S.stake * (1 - t.cash / t.post), diligence: CFG.seriesB.diligenceDays };
      }
      // bridge
      if (S.day - S.raise.lastBridge < CFG.bridge.gapDays) { ok = false; why.push('Last bridge on ' + fmtDay(S.raise.lastBridge) + '; angels wait ' + CFG.bridge.gapDays + ' days between notes.'); }
      if (S.rep < CFG.bridge.minRep) { ok = false; why.push('Needs reputation ' + CFG.bridge.minRep + '.'); }
      return { ok: ok, why: why, terms: t, stakeAfter: S.stake * (1 - t.stake), diligence: 0 };
    }
    function pitch(round) {
      var st = roundStatus(round); if (!st.ok) return { ok: false, msg: st.why[0] || 'not now' };
      if (round === 'bridge') {
        var t = st.terms; S.bank += t.cash; S.stake *= 1 - t.stake; S.raise.lastBridge = S.day; S.raise.rounds.push({ round: 'Bridge', day: S.day, cash: t.cash, stake: S.stake });
        log('Bridge note: +' + fmtMoney(t.cash) + ' for ' + pct(t.stake) + '. You own ' + pct(S.stake, 1) + '.', 'money');
        emit('cash', { delta: t.cash }); checkBoard();
        return { ok: true };
      }
      S.raise.diligence = { round: round, until: S.day + st.diligence, start: S.day };
      log('Pitched the Series ' + round + ': investors are in diligence until ' + fmtDay(S.raise.diligence.until) + '.', 'money');
      return { ok: true };
    }
    function termSheet(round) {
      var t = roundTerms(round), after = S.stake * (1 - t.cash / t.post), D_ = round === 'A' ? W.decisions.termA : W.decisions.termB;
      var board = after < CFG.boardBelow ? ' That takes you below 50%: the board would sell to Halcyon on the next 1st.' : '';
      decide('term', { from: D_.from, title: D_.title, body: D_.body.replace('{cash}', fmtMoney(t.cash)).replace('{post}', fmtMoney(t.post)),
        note: 'Runway ' + fmtRunway(runway()) + ' → ' + fmtRunway((S.bank + t.cash) / Math.max(1, burn())) + ' months. You own ' + pct(S.stake, 1) + ' → ' + pct(after, 1) + '.' + board,
        options: [
          { key: 'sign', label: 'Sign', detail: '+' + fmtMoney(t.cash) + ' now. Stake ' + pct(S.stake, 1) + ' → ' + pct(after, 1) + '.' + board },
          { key: 'pass', label: 'Walk away', detail: round === 'A' ? 'Next time they want a farthest dot three times further out.' : 'No Series B this year.' }
        ] }, function (c) {
        if (c === 'sign') {
          S.bank += t.cash; S.stake = after; S.post = t.post;
          if (round === 'A') S.raise.aDone = true; else S.raise.bDone = true;
          S.raise.rounds.push({ round: 'Series ' + round, day: S.day, cash: t.cash, stake: S.stake });
          log('Signed the Series ' + round + ': +' + fmtMoney(t.cash) + ' at a ' + fmtMoney(t.post) + ' post. You own ' + pct(S.stake, 1) + '.', 'money');
          emit('cash', { delta: t.cash }); checkBoard();
        } else {
          if (round === 'A') S.raise.aNeed = farthestClean() * CFG.seriesA.passMult; else S.raise.bDone = true;
          log('Walked away from the Series ' + round + '.', 'money');
        }
      });
    }
    function checkBoard() { if (S.stake < CFG.boardBelow && !S.boardSale) { S.boardSale = true; log('You own ' + pct(S.stake, 1) + ': the board controls FRONTIER and is shopping it to Halcyon. They will accept on the 1st.', 'bad'); } }
    function fmtRunway(m) { return !isFinite(m) ? '∞' : m >= 10 ? String(Math.floor(m)) : m.toFixed(1); }

    /* ---------------- buyouts ---------------- */
    function acquiOffer(forced) {
      var heads = staff().length + 1, total = forced ? Math.max(heads * CFG.acquiPerHead, Math.round(S.post)) : heads * CFG.acquiPerHead;
      var D_ = W.decisions.acqui;
      var opts = [{ key: 'accept', label: 'Sell the team', detail: 'The year ends: ACQUIRED. Your people get rich.' }];
      if (!forced) opts.push({ key: 'decline', label: 'Keep going', detail: 'Runway ' + fmtRunway(runway()) + ' months. They will ask again next month if it stays under ' + CFG.acquiRunway + '.' });
      decide('buyout', { from: D_.from, title: forced ? 'The board is selling FRONTIER to Halcyon' : D_.title, body: forced ? 'Halcyon pays ' + fmtMoney(total) + ' for FRONTIER, the price of your last round. You no longer control the company.' : D_.body.replace('{total}', fmtMoney(total)), note: forced ? W.decisions.boardNote.replace('{stake}', pct(S.stake, 1)) : 'Halcyon writes to labs with under ' + CFG.acquiRunway + ' months of runway.', options: opts, forced: forced }, function (c) {
        if (c === 'accept') endYear('acquired', forced ? 'You owned ' + pct(S.stake, 1) + ', below half, so the board sold FRONTIER to Halcyon for ' + fmtMoney(total) + '. Every round you raised gave away control.' : 'With ' + fmtRunway(runway()) + ' months of money left, you sold the team to Halcyon for ' + fmtMoney(total) + '.');
      });
    }
    function strategicOffer() {
      if (S.phase !== 'play' || S.strategicOffered) return;
      S.strategicOffered = true;
      var price = Math.round(S.post * CFG.strategicMult), forced = S.stake < CFG.boardBelow, D_ = W.decisions.strategic;
      var opts = [{ key: 'accept', label: 'Sell FRONTIER', detail: 'Your stake is worth ' + fmtMoney(price * S.stake) + '. The year ends: ACQUIRED.' }];
      if (!forced) opts.push({ key: 'decline', label: 'Stay independent', detail: 'You own ' + pct(S.stake, 1) + '. Keep racing.' });
      decide('buyout', { from: D_.from, title: D_.title, body: D_.body.replace('{C}', sci(farthestClean())).replace('{price}', fmtMoney(price)), note: forced ? W.decisions.boardNote.replace('{stake}', pct(S.stake, 1)) : 'Below 50% the board would decide this for you.', options: opts, forced: forced }, function (c) {
        if (c === 'accept') endYear('acquired', forced ? 'The board (you own ' + pct(S.stake, 1) + ') sold FRONTIER to Halcyon for ' + fmtMoney(price) + '.' : 'You sold FRONTIER to Halcyon for ' + fmtMoney(price) + '.');
      });
    }

    /* ---------------- Meridian ---------------- */
    function meridianOffer(second) {
      var m = CFG.meridian, n = second ? m.second.cards : m.cards, D_ = second ? W.decisions.meridian2 : W.decisions.meridian;
      var after = S.stake * m.second.stakeMult;
      var onCloud = activeRuns().filter(function (r) { return r.pool === 'cloud'; }).map(function (r) { return 'run ' + r.id; });
      var lastEnd = 0; S.rentals.forEach(function (r) { lastEnd = Math.max(lastEnd, r.end); });
      var cloudWarn = S.rentals.length ? ' Your rented cards go back by ' + fmtDay(lastEnd) + (onCloud.length ? ' (' + onCloud.join(', ') + ' trains on them; it moves to whatever cards are free).' : '.') : '';
      var opts = [
        { key: 'sign', label: 'Sign with Meridian', detail: '+' + n + ' V100s live ' + fmtDay(S.day + m.leadDays) + ', paid from credits. No more broker rentals (yours end at term). Publishes and ships wait ' + m.firstLookDays + ' days. Their queue from 11 Jun gives labs far behind the frontier fewer cards.' + cloudWarn + (second ? ' Stake ' + pct(S.stake, 1) + ' → ' + pct(after, 1) + '.' : '') },
        { key: 'pass', label: second ? 'Pass' : 'Stay independent', detail: second ? 'No more offers this year.' : 'They will come back after 15 Jun with a smaller offer for equity.' }
      ];
      decide('meridian', { from: D_.from, title: D_.title, body: D_.body.replace('{n}', n.toLocaleString('en-US')).replace('{weeks}', Math.round(m.leadDays / 7)), note: 'Your farthest clean dot: ' + sci(farthestClean()) + '.', options: opts }, function (c) {
        if (c === 'sign') {
          S.mer = { cards: n, live: Math.floor(S.day) + m.leadDays, alloc: n, second: !!second, credits: second ? m.credits / 2 : m.credits, signed: S.day };
          if (second) { S.stake = after; checkBoard(); }
          S.rentals.forEach(function (r) { r.noRenew = true; });
          log('Signed with Meridian: ' + n + ' V100s live ' + fmtDay(S.mer.live) + '.', 'money');
        } else { if (!second) S.merPassed = true; log(second ? 'Passed on Meridian’s second offer.' : 'Passed on Meridian.', 'money'); }
      });
    }
    function queueAlloc() {
      var fr = frontier(), far = farthestClean(), full = S.mer.cards;
      if (S.priority) return { n: full, why: 'priority paid' };
      if (far * CFG.meridian.queueFull >= fr) return { n: full, why: 'within ' + CFG.meridian.queueFull + 'x of the frontier' };
      if (far * CFG.meridian.queueHalf >= fr) return { n: Math.round(full / 2), why: 'within ' + CFG.meridian.queueHalf + 'x of the frontier' };
      return { n: Math.round(full / 4), why: 'more than ' + CFG.meridian.queueHalf + 'x behind the frontier' };
    }

    /* ---------------- hiring, demands, poaching ---------------- */
    function candidate(key) { for (var i = 0; i < S.cands.length; i++) if (S.cands[i].key === key) return S.cands[i]; return null; }
    function candAsk(c) { var d = W.people[c.key]; var s = c.ask || d.salary; if (d.salaryLate && S.day >= D(d.lateFrom)) s = Math.max(s, d.salaryLate); return s; }
    function candReq(c) {
      var d = W.people[c.key];
      if (d.needRep && S.rep < d.needRep && !cleanRuns().some(function (r) { return r.published && r.Cland >= 1e21; })) return 'Won’t join a lab under reputation ' + d.needRep + ' (you: ' + Math.round(S.rep) + ') or without a published dot ≥ 1e21.';
      return '';
    }
    function hire(key) {
      var c = candidate(key); if (!c) return { ok: false, msg: 'not on the board' };
      var req = candReq(c); if (req) return { ok: false, msg: req };
      var p = addPerson(key, candAsk(c)); S.stats.hires++;
      log('Hired ' + p.name + ' (' + W.roles[p.role] + ', ' + fmtMoney(p.salary) + '/month).', 'people');
      emit('hire', { key: key });
      return { ok: true };
    }
    function raisePay(key) {
      var p = person(key); if (!p) return { ok: false, msg: 'not on staff' };
      if (S.day - p.lastRaise < CFG.raiseCooldown) return { ok: false, msg: 'Raised on ' + fmtDay(p.lastRaise) + '; again from ' + fmtDay(p.lastRaise + CFG.raiseCooldown) + '.' };
      var add = Math.round(p.salary * (CFG.raiseMult - 1) / 500) * 500; p.salary += add; p.lastRaise = S.day; moodAdd(p, CFG.raiseMood);
      log('Raise for ' + p.first + ': +' + fmtMoney(add) + '/month, morale +' + CFG.raiseMood + '.', 'people');
      return { ok: true };
    }
    function courtDecision(c) {
      var d = W.people[c.key], rv = rivalBy(c.key === 'sunhee' ? 'halcyon' : 'kestrel'), sal = candAsk(c), req = candReq(c);
      var P = { she: d.she };
      decide('court', { title: W.decisions.court.title.replace('{rival}', rv.name).replace('{first}', d.first),
        body: W.decisions.court.body.replace(/\{first\}/g, d.first).replace('{days}', Math.round(S.day - c.since)).replace('{rival}', rv.name).replace(/\{him\}/g, him(P)).replace('{salary}', fmtMoney(sal)).replace('{he}', he(P)),
        note: W.roles[d.role] + ' · skill ' + d.skill + ' · ' + d.pitch,
        options: [
          { key: 'hire', label: 'Hire ' + d.first, detail: fmtMoney(sal) + '/month. Runway ' + fmtRunway(runway()) + ' → ' + fmtRunway(S.bank / (burn() + sal)) + ' months.', disabled: !!req, why: req },
          { key: 'pass', label: 'Let ' + him(P) + ' go', detail: d.first + ' joins ' + rv.name + ': +' + CFG.rivalPassBoost + ' decades of progress for them.' }
        ] }, function (ch) {
        if (ch === 'hire') hire(c.key);
        else { S.cands = S.cands.filter(function (x) { return x !== c; }); rv.extra += CFG.rivalPassBoost; rv.gained.push(d.first); S.gone.push({ key: c.key, first: d.first, to: rv.name, day: S.day }); log(d.first + ' joined ' + rv.name + '.', 'rival'); }
      });
    }
    function demand(key, title, body, opts, fn) { S.demands[key] = true; decide('demand', { from: W.people[key].name.toUpperCase(), title: title, body: body, options: opts }, fn); }
    function checkDemands() {
      var p;
      if ((p = person('priya')) && !S.demands.priya && S.day >= 70) demand('priya', W.decisions.demandPriya.title, W.decisions.demandPriya.body, [
        { key: 'yes', label: 'Agree', detail: 'Your next publish carries her name: morale +' + CFG.firstAuthorMood + '. If nothing is published in 90 days (by ' + fmtDay(S.day + 90) + '), she walks.' },
        { key: 'no', label: 'Refuse', detail: 'Priya walks. You lose your data person: no filter jobs, no landing reviews.' }
      ], function (c) { if (c === 'yes') S.firstAuthor = { due: S.day + 90 }; else walk(person('priya'), 'kestrel', 'refused first author'); });
      if ((p = person('dev')) && !S.demands.dev && S.day - p.joined >= 90) demand('dev', W.decisions.demandDev.title, W.decisions.demandDev.body, [
        { key: 'yes', label: 'Give him 1%', detail: 'Stake ' + pct(S.stake, 1) + ' → ' + pct(S.stake - 0.01, 1) + '.' },
        { key: 'no', label: 'Refuse', detail: 'Dev walks to Halcyon (+0.2 decades for them). Memory limit falls back unless another systems person stays.' }
      ], function (c) { if (c === 'yes') { S.stake -= 0.01; checkBoard(); } else walk(person('dev'), 'halcyon', 'refused equity'); });
      if ((p = person('ayaan')) && !S.demands.ayaan && S.day >= DAY.gpt3 + 1 && p.salary < W.people.ayaan.salaryLate) demand('ayaan', W.decisions.demandAyaan.title, W.decisions.demandAyaan.body, [
        { key: 'yes', label: 'Pay $55K', detail: 'Salary ' + fmtMoney(p.salary) + ' → $55K a month.' },
        { key: 'no', label: 'Refuse', detail: 'Ayaan’s morale −40 (now ' + Math.round(p.mood) + '). Below ' + CFG.moodLow + ' he works at one skill lower.' }
      ], function (c) { var a = person('ayaan'); if (!a) return; if (c === 'yes') { a.salary = W.people.ayaan.salaryLate; moodAdd(a, 10); } else moodAdd(a, -40); });
      if ((p = person('sunhee')) && !S.demands.sunhee && S.day - p.joined >= 45) demand('sunhee', W.decisions.demandSunhee.title, W.decisions.demandSunhee.body, [
        { key: 'yes', label: 'Let her publish', detail: 'Reputation +6 and she stays. In 30 days every rival lands 2.5% lower too (+0.22 decades for each).' },
        { key: 'no', label: 'Refuse', detail: 'Sun-hee walks to Halcyon, with the trick.' }
      ], function (c) { if (c === 'yes') { S.rep = clamp(S.rep + 6, 0, 100); at(S.day + 30, function () { S.sunheeTrick = true; S.rivals.forEach(function (rv) { rv.extra += 0.22; }); log('Every rival now uses Sun-hee’s schedule trick.', 'rival'); }, 'trick'); } else walk(person('sunhee'), 'halcyon', 'refused her paper'); });
    }
    function poachCheck() {
      if (S.day < DAY.poach || S.poachMonth === monthIdx(S.day)) return;
      var st = staff(); if (st.length < CFG.poach.minPeople) return;
      var target = st.slice().sort(function (a, b) { return a.mood - b.mood; })[0];
      if (rng() >= (target.mood < CFG.moodLow ? CFG.poach.lowMoodChance : CFG.poach.chance)) return;
      S.poachMonth = monthIdx(S.day);
      var rv = rivalBy(monthIdx(S.day) % 2 === 1 ? 'halcyon' : 'kestrel'), offer = target.salary * 2;
      var match = Math.round(target.salary * (CFG.matchMult - 1) / 500) * 500;
      decide('poach', { from: rv.name.toUpperCase(), title: W.decisions.poach.title.replace('{rival}', rv.name).replace('{first}', target.first),
        body: W.decisions.poach.body.replace('{rival}', rv.name).replace(/\{first\}/g, target.first).replace('{offer}', fmtMoney(offer)).replace('{He}', He(target)).replace('{mood}', Math.round(target.mood)),
        note: W.roles[target.role] + ' · skill ' + target.skill + '. Rivals go for whoever is least happy.',
        options: [
          { key: 'match', label: 'Match with a raise', detail: '+' + fmtMoney(match) + '/month (salary x' + CFG.matchMult + '), morale +' + CFG.counterMood + '.' },
          { key: 'equity', label: 'Counter with equity', detail: 'Stake ' + pct(S.stake, 1) + ' → ' + pct(S.stake - CFG.counterStake, 1) + ', morale +' + CFG.counterMood + '.' },
          { key: 'let', label: 'Let ' + him(target) + ' go', detail: target.first + ' joins ' + rv.name + ' (+' + CFG.rivalPassBoost + ' decades for them).' }
        ] }, function (c) {
        var t = person(target.key); if (!t) return;
        if (c === 'match') { t.salary += match; moodAdd(t, CFG.counterMood); }
        else if (c === 'equity') { S.stake -= CFG.counterStake; moodAdd(t, CFG.counterMood); checkBoard(); }
        else walk(t, rv.key, 'poached');
      });
    }
    function openWeightsOffer() {
      S.openOffered = true;
      var grey = S.mer ? 'Meridian: no. Their contract gives them the say over open weights.' : S.stake < CFG.boardBelow ? 'The board: no.' : '';
      var pub = 0; cleanRuns().forEach(function (r) { if (r.published && r.Cland > pub) pub = r.Cland; });
      var ow = CFG.openWeights;
      decide('open', { from: W.decisions.open.from, title: W.decisions.open.title, body: W.decisions.open.body.replace('{C}', sci(pub)), note: grey,
        options: [
          { key: 'open', label: 'Open the weights', detail: 'Reputation +' + ow.rep + '. Ines and Kofi will join now at ' + Math.round(ow.earlySalary * 100) + '% salary. Kestrel +' + ow.kestrel + ' and Northwind +' + ow.northwind + ' decades within a week.', disabled: !!grey, why: grey },
          { key: 'no', label: 'Keep them closed', detail: 'They build on Northwind’s instead: Northwind +' + ow.passNorthwind + ' decades.' }
        ] }, function (c) {
        if (c === 'open') {
          S.opened = true; S.rep = clamp(S.rep + ow.rep, 0, 100);
          ['ines', 'kofi'].forEach(function (k) { if (!S.team.some(function (p) { return p.key === k; }) && !S.gone.some(function (g) { return g.key === k; })) { var cd = candidate(k); if (!cd) { cd = { key: k, since: S.day, courtBy: S.day + CFG.courtDays }; S.cands.push(cd); } cd.ask = Math.round(W.people[k].salary * ow.earlySalary); } });
          at(S.day + 7, function () { rivalBy('kestrel').extra += ow.kestrel; rivalBy('northwind').extra += ow.northwind; log('Kestrel and Northwind fine-tuned your open weights.', 'rival'); }, 'open');
          log('Opened the weights.', 'run');
        } else { rivalBy('northwind').extra += ow.passNorthwind; }
      });
    }
    function decemberLetter() {
      S.decemberDone = true;
      var pr = person('priya'), others = staff().filter(function (x) { return x !== pr; }).sort(function (a, b) { return a.mood - b.mood; });
      var sender = pr || staff().slice().sort(function (a, b) { return b.ego - a.ego; })[0];
      if (!sender || staff().length < 3) return;
      if (!pr) others = others.filter(function (x) { return x !== sender; });
      var leaving = [sender].concat(others.slice(0, 2));
      var names = others.slice(0, 2).map(function (x) { return x.first; }).join(' and ');
      decide('december', { from: sender.name.toUpperCase(), title: sender.first + ' wants to start something safer', body: W.decisions.december.body.replace('{names}', names), note: 'Your score counts the people still with you on 31 Dec (' + CFG.score.perPerson + ' each).',
        options: [
          { key: 'bless', label: 'Let them go, with your blessing', detail: leaving.map(function (x) { return x.first; }).join(', ') + ' leave. Reputation +5.' },
          { key: 'fight', label: 'Fight to keep them', detail: 'They stay, with morale −25 each.' }
        ] }, function (c) {
        if (c === 'bless') { S.rep = clamp(S.rep + 5, 0, 100); leaving.forEach(function (x) { walk(x, null, 'left to start a safer lab, with your blessing'); }); }
        else leaving.forEach(function (x) { moodAdd(x, -25); });
      });
    }

    /* ---------------- the clock ---------------- */
    function rivalPublish(rv) {
      var c = rivalC(rv), L = Lline(c) * rv.offset * (S.sunheeTrick ? CFG.sunheeBend : 1);
      rv.pubs.push({ C: c, L: L, day: S.day }); rv.passedBy = false;
      log(rv.name + ' published a ' + bigNum(Nopt(c)) + '-parameter model (' + sci(c) + ' FLOPs, loss ' + L.toFixed(2) + ').', 'rival');
      emit('rival', { key: rv.key });
    }
    function payday() {
      var pay = payroll();
      S.bank -= pay;
      S.lastPayroll = { day: S.day, pay: pay, parts: { base: CFG.base, salaries: salaries(), upkeep: upkeep(), priority: priorityCost() } };
      log('Payroll ' + fmtMoney(pay) + ' (salaries ' + fmtMoney(salaries()) + ', base ' + fmtMoney(CFG.base) + ', card upkeep ' + fmtMoney(upkeep()) + (priorityCost() ? ', Meridian priority ' + fmtMoney(priorityCost()) : '') + ').', 'money');
      emit('payroll', { pay: pay });
      if (S.bank < 0) {
        var b = burnParts();
        var spent = 0; S.orders.forEach(function (o) { spent += o.price; });
        endYear('bankrupt', 'Payroll on ' + fmtDay(S.day) + ' needed ' + fmtMoney(pay) + ' and the bank went to ' + fmtMoney(S.bank) + '. Monthly burn was ' + fmtMoney(burn()) + (b.rent > 0 ? ', ' + fmtMoney(b.rent) + ' of it rented cards' : '') + '.' + (S.repossessed != null ? ' The broker had already taken back your rented cards on ' + fmtDay(S.repossessed) + ', when the bank first went negative.' : '') + (spent > 0 ? ' ' + fmtMoney(spent) + ' was tied up in hardware still on order.' : ''));
        return false;
      }
      return true;
    }
    function monthStart() {
      var m = monthIdx(S.day);
      S.hangsLastMonth = S.hangsThisMonth; S.hangsThisMonth = 0;
      if (!payday()) return;
      // morale: big egos sulk when nothing has been published lately
      if (S.day - S.lastPublishDay > CFG.noPaperDays && S.day > 40) staff().forEach(function (p) { if (p.ego >= 4) moodAdd(p, -CFG.noPaperMood); });
      if (S.day - S.lastPublishDay > CFG.repDecayAfter && S.day > 40) S.rep = clamp(S.rep - CFG.repDecay, 0, 100);
      // rival estimates are refreshed monthly
      S.rivals.forEach(function (rv) { rv.est = U(-CFG.rivalEstErr, CFG.rivalEstErr); });
      // Meridian's queue
      if (S.mer && S.day >= DAY.merQueue) {
        var qa = queueAlloc(), was = S.mer.alloc; S.mer.alloc = qa.n; S.mer.allocWhy = qa.why;
        if (qa.n !== was) log('Meridian queue for ' + MON[m] + ': ' + qa.n + ' of ' + S.mer.cards + ' cards (' + qa.why + ').', qa.n < was ? 'bad' : 'money');
      }
      if (S.boardSale && S.stake < CFG.boardBelow) { acquiOffer(true); return; }
      if (S.day >= 31 && runway() < CFG.acquiRunway) acquiOffer(false);
      if (S.hangsLastMonth >= 3 && has('tom') && !S.demands.tom) demand('tom', W.decisions.demandTom.title, W.decisions.demandTom.body, [
        { key: 'yes', label: 'Give him the week', detail: '7 days without Tom: hangs revert to ' + (byRole('infra').length > 1 ? 'your other infra person' : 'nobody on call') + '.' },
        { key: 'no', label: 'Not now', detail: 'Tom’s morale −30.' }
      ], function (c) { if (c === 'yes') { S.tomOffUntil = S.day + 7; moodAdd(person('tom'), 10); } else moodAdd(person('tom'), -30); });
    }
    function dayStart(d) {
      // orders arrive
      S.orders = S.orders.filter(function (o) { if (d >= o.arrive) { S.owned[o.type] += o.cards; log(o.cards + ' ' + CFG.card[o.type].label + 's arrived (' + o.label + ').', 'cards'); emit('arrive', {}); return false; } return true; });
      // rentals end or renew
      S.rentals = S.rentals.filter(function (r) {
        if (d < r.end) return true;
        if (r.cancel || r.noRenew) { log(r.n + ' rented V100s went back' + (r.noRenew && !r.cancel ? ' (Meridian exclusivity)' : '') + '.', 'cards'); return false; }
        if (d >= DAY.refuse && rng() < CFG.renewRefuseShare) { log('Broker refused to renew ' + r.n + ' V100s: capacity unavailable. They went back.', 'bad'); return false; }
        var p = rentPrice(); if (p !== r.price) log('Renewed ' + r.n + ' V100s at the new price, $' + p.toFixed(2) + '/hour.', 'cards');
        r.price = p; r.end += CFG.rentTermDays; return true;
      });
      S.rentOut = S.rentOut.filter(function (o) { if (d >= o.until) { log(o.n + ' cards came back from rent-out.', 'cards'); return false; } return true; });
      if (S.mer && d === S.mer.live) log('Meridian’s ' + S.mer.alloc + ' V100s are live.', 'cards');
      if (dom(d) === 1) { monthStart(); if (S.phase !== 'play') return; }
      // history and market notices
      W.news.forEach(function (n) { if (D(n[0]) === d) { S.news.unshift({ day: d, text: n[1], effect: n[2], real: true }); emit('news', { text: n[1] }); } });
      W.market.forEach(function (n) { if (D(n[0]) === d) { S.news.unshift({ day: d, text: n[1], effect: '', real: false }); } });
      if (d === DAY.crash && S.raise.diligence) { var dl = S.raise.diligence; S.raise.diligence = null; decide('notice', { title: 'Series ' + dl.round + ' withdrawn', body: 'The market crashed today. Your investors pulled out of diligence.', note: 'The venture market reopens on 15 Jun, at post-GPT-3 prices.', options: [{ key: 'ok', label: 'Understood', detail: '' }] }, function () {}); log('Crash: the Series ' + dl.round + ' in diligence was withdrawn.', 'bad'); }
      // rivals publish
      S.rivals.forEach(function (rv) { if (d >= rv.nextPub) { rivalPublish(rv); rv.nextPub = d + Math.round(rv.period * U(0.7, 1.3)); } });
      // candidates arrive on the board
      Object.keys(W.people).forEach(function (k) {
        var p = W.people[k]; if (!p.from || D(p.from) !== d) return;
        if (S.team.some(function (x) { return x.key === k; }) || candidate(k) || S.gone.some(function (g) { return g.key === k; })) return;
        S.cands.push({ key: k, since: d, courtBy: d + CFG.courtDays }); log(p.name + ' is on the hiring board (' + W.roles[p.role] + ').', 'people'); emit('candidate', { key: k });
      });
      S.cands.slice().forEach(function (c) { if (d >= c.courtBy && !c.courted) { c.courted = true; courtDecision(c); } });
      // jobs finishing
      if (S.filterJob && d >= S.filterJob.until) {
        S.W *= CFG.filter.mult; S.wallLo *= CFG.filter.mult; S.wallHi *= CFG.filter.mult; S.filters++; S.stats.filters++; S.filterJob = null;
        log('Filter job done: the clean-data wall moved x' + CFG.filter.mult + ' (est. ' + bigNum(S.wallLo) + '–' + bigNum(S.wallHi) + ' tokens). Runs launched from now use the cleaner data.', 'data');
        emit('filter', {});
      }
      if (S.redteam && d >= S.redteam.until) { var rt = S.redteam, run = runById(rt.runId); S.redteam = null; if (run) { run.redteamed = true; run.pending = null; S.caps.forEach(function (c) { if (c.contaminated && run.capsOn.indexOf(c.id) >= 0) c.known = true; }); log('Red-team on run ' + run.id + ' done: nothing found that could blow up.', 'people'); release(run, rt.then); } }
      if (S.firstAuthor && d >= S.firstAuthor.due) { var pr = person('priya'); S.firstAuthor = null; if (pr) walk(pr, 'kestrel', 'no paper with her name in 90 days'); }
      // diligence ends: the term sheet arrives
      if (S.raise.diligence && d >= S.raise.diligence.until) { var rd = S.raise.diligence.round; S.raise.diligence = null; termSheet(rd); }
      // Meridian
      if (!S.mer && !S.merOffered && d >= DAY.merFrom && farthestClean() >= CFG.meridian.needC) { S.merOffered = true; meridianOffer(false); }
      if (!S.mer && S.merPassed && !S.mer2Offered && d >= DAY.mer2) { S.mer2Offered = true; meridianOffer(true); }
      if (S.priority && S.bank < 0) { S.priority = false; }
      // people
      checkDemands();
      if (dom(d) === 1 || dom(d) === 15) poachCheck();
      if (!S.openOffered && d >= DAY.open_w && cleanRuns().some(function (r) { return r.published && r.Cland >= CFG.openWeights.needC; })) openWeightsOffer();
      if (d >= DAY.dec && !S.decemberDone) decemberLetter();
      // timed events
      var due = events.filter(function (e) { return e.day <= d + 1e-9; }); events = events.filter(function (e) { return e.day > d + 1e-9; });
      due.forEach(function (e) { if (S.phase === 'play') e.fn(); });
      // forgotten
      if (d >= S.relevantUntil && S.phase === 'play') {
        var need = relevanceNeed();
        endYear('forgotten', (S.lastRelevant ? 'Your last result the world cared about went out on ' + fmtDay(S.lastRelevant.day) + ' (' + sci(S.lastRelevant.C) + ').' : 'You never published or shipped a result the world cared about.') + ' The world forgets a lab that goes ' + CFG.relevanceDays + ' days without publishing or shipping something within 100x of the frontier (' + sci(frontier()) + ' today). Anything of ' + sci(need) + ' or more would have reset the clock.');
        return;
      }
      S.cashHist.push(Math.round(S.bank)); S.computeHist.push(flopsPerDay(true) / 8.64e19);
    }
    function stepMoney(dt) {
      var rent = rentDaily() * dt; S.bank -= rent;
      if (S.shipped) { var r = S.shipped.rev / CFG.daysPerMonth * dt; S.bank += r; S.stats.apiRevenue += r; }
      if (S.mer && S.day >= S.mer.live) S.mer.credits = Math.max(0, S.mer.credits - S.mer.alloc * CFG.meridian.rate * 24 * dt);
      if (S.bank < 0 && S.rentals.length) {
        S.rentals = []; S.repossessed = S.day; log('The bank went negative: the broker took back every rented card.', 'bad');
        emit('repossess', {});
      }
    }
    function advance(days) {
      if (S.phase !== 'play') return;
      var left = days;
      if (lastDay < 0) { lastDay = 0; dayStart(0); }
      while (left > 1e-9 && S.phase === 'play' && !blocked()) {
        var nextBoundary = Math.floor(S.day + 1e-9) + 1;
        var dt = Math.min(left, CFG.step, nextBoundary - S.day);
        if (dt < 1e-9) dt = Math.min(left, 1e-6);
        allocate(); migrateStalled();
        activeRuns().forEach(function (r) { if (S.phase === 'play') stepRun(r, dt); });
        stepMoney(dt);
        S.day += dt; left -= dt;
        var d = Math.floor(S.day + 1e-9);
        if (d > lastDay) {
          lastDay = d;
          if (d >= CFG.yearDays) {
            S.day = CFG.yearDays - 1e-6;
            endYear('survived', 'You reached 31 Dec 2020 with ' + fmtMoney(S.bank) + ' in the bank, ' + staff().length + ' people and reputation ' + Math.round(S.rep) + '.');
            break;
          }
          dayStart(d);
        }
      }
    }

    /* ---------------- actions ---------------- */
    function rent(n) {
      n = Math.round(n / CFG.rentBlock) * CFG.rentBlock;
      if (S.mer) return { ok: false, msg: 'Meridian exclusivity: no other cloud.' };
      var cap = rentCap(), have = rentedCount(); if (n < CFG.rentBlock) return { ok: false, msg: 'Rent in blocks of ' + CFG.rentBlock + '.' };
      if (have + n > cap) return { ok: false, msg: 'The broker has ' + Math.max(0, cap - have) + ' more V100s to rent right now (cap ' + cap + ').' };
      if (S.bank <= 0) return { ok: false, msg: 'No money.' };
      var st = Math.floor(S.day) + 1, price = rentPrice();
      S.rentals.push({ id: 'r' + (nextId++), n: n, price: price, start: st, end: st + CFG.rentTermDays, cancel: false, noRenew: false });
      log('Rented ' + n + ' V100s at $' + price.toFixed(2) + '/hour (' + fmtMoney(n * price * 24 * CFG.daysPerMonth) + '/month), live ' + fmtDay(st) + '.', 'cards');
      return { ok: true };
    }
    function cancelRent(id) {
      var r = S.rentals.filter(function (x) { return x.id === id; })[0]; if (!r) return { ok: false, msg: 'no such rental' };
      r.cancel = !r.cancel; log((r.cancel ? 'Cancelled ' : 'Un-cancelled ') + r.n + ' rented V100s: ' + (r.cancel ? 'they go back on ' + fmtDay(r.end) + '.' : 'they renew.'), 'cards');
      return { ok: true };
    }
    function buy(item, units) {
      var spec = CFG.buy[item]; if (!spec) return { ok: false, msg: 'no such item' };
      units = Math.max(1, Math.min(CFG.buyMaxUnits, Math.round(units || 1)));
      if (S.day < D(spec.from)) return { ok: false, msg: spec.label + ' is not on the market until ' + fmtDay(D(spec.from)) + '.' };
      var price = buyPrice(item, S.day) * units; if (price > S.bank) return { ok: false, msg: 'Costs ' + fmtMoney(price) + '; you have ' + fmtMoney(S.bank) + '.' };
      var lead = leadFor(item, S.day);
      S.bank -= price;
      S.orders.push({ type: spec.type, cards: spec.cards * units, units: units, arrive: Math.floor(S.day) + lead, ordered: S.day, price: price, label: units + ' x ' + spec.label });
      log('Ordered ' + units + ' x ' + spec.label + ' for ' + fmtMoney(price) + ': arrives ' + fmtDay(Math.floor(S.day) + lead) + '.', 'cards');
      emit('cash', { delta: -price });
      return { ok: true };
    }
    function rentOut(pool, n) {
      pool = pool || 'office'; if (pool !== 'office' && pool !== 'a100') return { ok: false, msg: 'You can only rent out cards you own.' };
      var free = poolFree(pool); n = Math.min(Math.round(n || free), free);
      if (n < 1) return { ok: false, msg: 'No idle owned cards.' };
      var cash = n * CFG.rentOutPerHour[poolType(pool)] * 24 * CFG.rentOutDays;
      S.bank += cash; S.stats.rentOutRevenue += cash;
      S.rentOut.push({ pool: pool, n: n, until: Math.floor(S.day) + CFG.rentOutDays });
      log('Rented out ' + n + ' idle ' + CFG.card[poolType(pool)].label + 's for ' + CFG.rentOutDays + ' days: +' + fmtMoney(cash) + '.', 'money');
      emit('cash', { delta: cash });
      return { ok: true };
    }
    function startFilter() {
      var ds = byRole('data'); if (!ds.length) return { ok: false, msg: 'Needs a data person.' };
      if (S.filterJob) return { ok: false, msg: 'A filter job is already running (until ' + fmtDay(S.filterJob.until) + ').' };
      var cost = filterCost(), days = filterDays();
      if (cost > S.bank) return { ok: false, msg: 'Costs ' + fmtMoney(cost) + '.' };
      S.bank -= cost; S.filterJob = { until: Math.floor(S.day) + days, cost: cost, who: ds[0].key, start: S.day, days: days };
      log('Filter job started (' + ds.map(function (p) { return p.first; }).join(' + ') + '): ' + fmtMoney(cost) + ', ' + days + ' days.', 'data');
      emit('cash', { delta: -cost });
      return { ok: true };
    }
    function sample(id) {
      var run = id ? runById(id) : (S.selRun ? runById(S.selRun) : null);
      if (!run) { var a = activeRuns(); run = a.length ? a[0] : S.runs[S.runs.length - 1]; }
      if (!run || !run.ckpts.length) return { ok: false, msg: 'No checkpoint yet.' };
      var unread = run.ckpts.filter(function (c) { return !c.read; }), ck = unread.length ? unread[unread.length - 1] : run.ckpts[run.ckpts.length - 1];
      return { ok: true, sample: readCheckpoint(run, ck, 'you read it') };
    }
    function landingAnswer(choice) {
      var d = S.inbox.filter(function (x) { return x.kind === 'landing'; })[0];
      if (!d) return { ok: false, msg: 'No landed run is waiting.' };
      return answer(d.id, choice);
    }

    function act(name, p) {
      p = p || {};
      if (S.phase !== 'play') return { ok: false, msg: 'The year is over.' };
      var gate = ['answer', 'publish', 'ship', 'private', 'keep', 'sample'];
      if (blocked() && gate.indexOf(name) < 0) return { ok: false, msg: 'A decision is waiting.' };
      switch (name) {
        case 'hire': return hire(p.id || p.key);
        case 'raisePay': return raisePay(p.id || p.key);
        case 'rent': return rent(p.gpus || p.n || 8);
        case 'cancelRent': return cancelRent(p.id);
        case 'buy': return buy(p.item || 'dgx1', p.units || 1);
        case 'rentOut': return rentOut(p.pool, p.n);
        case 'raise': return pitch(p.round || 'A');
        case 'priority': if (!S.mer) return { ok: false, msg: 'No Meridian contract.' }; S.priority = p.on == null ? !S.priority : !!p.on; log('Meridian priority ' + (S.priority ? 'on: ' + fmtMoney(priorityCost()) + '/month from the 1st.' : 'off.'), 'money'); return { ok: true };
        case 'launch': return launch({ params: p.params, tokens: p.tokens, gpus: p.gpus, pool: p.pool });
        case 'abort': return abort(p.id);
        case 'move': return move(p.id);
        case 'sample': return sample(p.id);
        case 'select': if (runById(p.id)) { S.selRun = p.id; return { ok: true }; } return { ok: false };
        case 'filter': return startFilter();
        case 'publish': return landingAnswer(p.redteam ? 'rt_publish' : 'publish');
        case 'ship': return landingAnswer(p.redteam ? 'rt_ship' : 'ship');
        case 'private': case 'keep': return landingAnswer('private');
        case 'answer': return answer(p.id || (S.inbox[0] && S.inbox[0].id), p.choice);
      }
      return { ok: false, msg: 'unknown action ' + name };
    }

    /* ---------------- views for the screen ---------------- */
    var api = {
      S: S, CFG: CFG, DAY: DAY, act: act, advance: advance, design: design, on: function (f) { listeners.push(f); },
      blocked: blocked, staff: staff, person: person, candidate: candidate, candAsk: candAsk, candReq: candReq,
      poolInfo: poolInfo, poolFree: poolFree, rentPrice: rentPrice, rentCap: rentCap, rentedCount: rentedCount, leadFor: leadFor, buyPrice: buyPrice,
      burn: burn, burnParts: burnParts, runway: runway, payroll: payroll, flopsPerDay: flopsPerDay, apiMonthly: apiMonthly,
      farthestClean: farthestClean, bestRun: bestRun, horizon: horizon, frontier: frontier, relevanceNeed: relevanceNeed, rivalC: rivalC,
      roundStatus: roundStatus, roundTerms: roundTerms, marketClosed: marketClosed, seriesAProof: seriesAProof, queueAlloc: queueAlloc,
      split: split, maxParams: maxParams, infraMult: infraMult, hasInfra: hasInfra, hasScaling: hasScaling, hasEvals: hasEvals, sunheeM: sunheeM,
      filterDays: filterDays, filterCost: filterCost, effSkill: effSkill, activeRuns: activeRuns, runById: runById, moveTarget: moveTarget, poolTotal: poolTotal, lossAt: lossAt, Lline: Lline,
      recipeForC: recipeForC, recipeForN: recipeForN, Nopt: Nopt, Dopt: Dopt, offPen: offPen, score: score, gapLine: gapLine, priorityCost: priorityCost,
      fmtDay: fmtDay, fmtLong: fmtLong, dom: dom, monthIdx: monthIdx, D: D, dateOf: dateOf, scaleEff: scaleEff, cardFlops: cardFlops, poolType: poolType,
      amount: amount, CRAWL: CRAWL, rivalBy: rivalBy
    };
    return api;
  }

  var FE = { create: create, fmtMoney: fmtMoney, sci: sci, bigNum: bigNum, pct: pct, log10: log10, clamp: clamp, mulberry: mulberry };
  if (typeof module !== 'undefined' && module.exports) module.exports = FE; else root.FrontierEngine = FE;
})(this);
