/* FRONTIER engine: the whole lab as a pure simulation. No DOM. The UI reads S and calls act(); bots do the same in node.
   Time is in game days (day 0 = Wed 1 Jan 2020, day 365 = Thu 31 Dec 2020). */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var CFG = isNode ? require('./config.js') : root.FRONTIER_CFG;
  var WORLD = isNode ? require('./world.js') : root.FRONTIER_WORLD;
  var CORPUS = isNode ? require('./corpus.js') : root.FRONTIER_CORPUS;

  /* ---------------- helpers ---------------- */
  var BASE = Date.UTC(CFG.year, 0, 1), MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var CRAWL = 99, P0 = Math.pow(10, -3.5);
  function log10(x) { return Math.log(x) / Math.LN10; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function dateOf(day) { return new Date(BASE + Math.floor(day + 1e-9) * 864e5); }
  function dom(day) { return dateOf(day).getUTCDate(); }
  function monthIdx(day) { var d = dateOf(day); return (d.getUTCFullYear() - CFG.year) * 12 + d.getUTCMonth(); }
  function fmtDate(day, yr) { var d = dateOf(day), dd = String(d.getUTCDate()); if (dd.length < 2) dd = '0' + dd; return dd + ' ' + MON[d.getUTCMonth()] + (yr ? ' ' + d.getUTCFullYear() : ''); }
  function fmtShort(day) { var d = dateOf(day); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()].charAt(0) + MON[d.getUTCMonth()].slice(1).toLowerCase(); }
  function iso(s) { return Math.round((Date.parse(s + 'T00:00:00Z') - BASE) / 864e5); }
  function trim0(t) { return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t; }
  function money(x) {
    var a = Math.abs(x), s = x < 0 ? '−$' : '$';
    if (a >= 1e9) return s + trim0((a / 1e9).toFixed(2)) + 'B';
    if (a >= 1e6) return s + trim0((a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)) + 'M';
    if (a >= 1e3) return s + trim0((a / 1e3).toFixed(a >= 1e5 ? 0 : 1)) + 'k';
    return s + Math.round(a);
  }
  function moneyFull(x) { return (x < 0 ? '−$' : '$') + Math.round(Math.abs(x)).toLocaleString('en-US'); }
  function sci(C) { if (!(C > 0)) return '0'; var e = Math.floor(log10(C) + 1e-9), m = C / Math.pow(10, e); if (m >= 9.95) { m = 1; e++; } return m.toFixed(1) + 'e' + e; }
  function sizeWord(N) { if (N >= 1e12) return trim0((N / 1e12).toFixed(1)) + 'T'; if (N >= 1e9) return (N >= 1e10 ? Math.round(N / 1e9) : trim0((N / 1e9).toFixed(1))) + 'B'; return Math.round(N / 1e6) + 'M'; }
  function pct(x) { var v = x * 100; return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : v.toFixed(1)) + '%'; }
  function months(m) { if (!isFinite(m)) return '∞'; return m >= 10 ? String(Math.floor(m)) : m >= 3 ? String(Math.floor(m)) : (Math.floor(m * 10) / 10).toFixed(1); }
  function plural(n, w) { if (w === 'person') return n + (n === 1 ? ' person' : ' people'); return n + ' ' + w + (n === 1 ? '' : 's'); }
  function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }

  /* ---------------- the physics ---------------- */
  function Lline(C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); }
  function Dopt(C) { return CFG.tokGPT3 * Math.pow(C / CFG.gpt3C, CFG.tokExp); }
  function C_of_tokens(D) { return CFG.gpt3C * Math.pow(D / CFG.tokGPT3, 1 / CFG.tokExp); }
  function recipeTokens(N) { return Math.pow(CFG.tokGPT3 * Math.pow(6 * N / CFG.gpt3C, CFG.tokExp), 1 / (1 - CFG.tokExp)); }
  function offRecipe(N, D) { var dec = log10(D / Dopt(6 * N * D)); return 1 + CFG.offRecipeK * dec * dec; }

  function create(opts) {
    opts = opts || {};
    var seed = opts.seed != null ? (opts.seed >>> 0) : (Math.floor(Math.random() * 4294967295) >>> 0);
    var rng = mulberry(seed), wrng = mulberry((seed ^ 0x9e3779b9) >>> 0);
    function U(a, b) { return a + (b - a) * rng(); }
    function gauss(r) { r = r || rng; return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
    function shuffle(a, r) { r = r || rng; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function pick(a, r) { r = r || rng; return a[Math.floor(r() * a.length)]; }
    var listeners = [], seq = 0;
    function emit(ev) { for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) { if (typeof console !== 'undefined') console.error(e); } } }

    var S = newState();
    // every money movement goes through cash(): the month's money log is what the slip and the Money row read
    function cash(cat, amt) { S.bank += amt; S.mlog[cat] = (S.mlog[cat] || 0) + amt; }
    // S.run is the hero: the biggest run training right now (other pools can run smaller experiments beside it)
    function mainRun() { var m = null; S.active.forEach(function (r) { if (!m || r.C > m.C) m = r; }); return m; }
    Object.defineProperty(S, 'run', { get: mainRun, enumerable: false });
    function hungRuns() { return S.active.filter(function (r) { return !!r.hang; }); }
    function newState() {
      var st = {
        seed: seed, day: 0, started: false, over: null, paused: true, speed: 1,
        bank: CFG.seedCash - CFG.dgx1Price, stake: CFG.stakeStart, post: CFG.seedPost, rep: CFG.repStart,
        team: [], candidates: [], knocked: {},
        owned: { v100: CFG.startV100, a100: 0 }, rentals: [], orders: [], mer: null, lent: null, serving: null, rentedMonth: 0,
        runs: [], active: [], runSeq: 0, lastSample: null, samples: [],
        data: { W: Math.exp(Math.log(CFG.W_lo) + (Math.log(CFG.W_hi) - Math.log(CFG.W_lo)) * rng()), filters: 0, job: null,
          lo: CFG.passes * CFG.W_lo, hi: CFG.passes * CFG.W_hi },
        caps: CFG.caps.map(function (c) { return { id: c[0], C: c[1] * Math.pow(10, (rng() * 2 - 1) * c[2]) }; })
          .sort(function (a, b) { return a.C - b.C; }).map(function (c, i) { var id = CFG.caps[i][0]; return { id: id, C: c.C, L: Lline(c.C), fired: false, contaminated: false }; }),
        api: null, redteam: null,
        rivals: CFG.rivals.map(function (r) {
          var j = (rng() * 2 - 1) * CFG.rivalJitter, c0 = r.c0 * Math.pow(10, j);
          return { key: r.key, name: r.name, kind: r.kind, c0: r.c0, tau: r.tau, period: r.period, offset: r.offset, cap: r.cap, jit: j, extra: 0,
            pubs: [{ day: -40, C: c0 / 2, L: Lline(c0 / 2) * r.offset, N: (c0 / 2) / (6 * Dopt(c0 / 2)) }], nextPub: r.period * (0.3 + 0.7 * rng()), people: [] };
        }),
        newsFired: [], feed: [], ledger: [], decided: [],
        queue: [], pending: null, flags: {}, events: [],
        raise: { aDone: false, bDone: false, aNeed: CFG.seriesA.needC, aRound: null, bNeedDay: 0 },
        termBlockUntil: 0, relevance: { deadline: CFG.relevanceGrace, since: null, warned: false },
        lastPublishDay: -30, hangsMonth: 0, hangsLastMonth: 0, monthPoached: -1,
        stats: { revenue: 0, rentSpent: 0, published: 0, shipped: 0, scandals: 0, runs: 0, hangs: 0, filters: 0, rentOut: 0 },
        bags: {}, t3used: {}, t4used: {}, covidIn: false, miracle: false, gpt3Seen: false,
        snap: null, mlog: {}, slips: [], mile: [], passed: {}, slipN: 0, plaqueN: 0, shipped: null, openedDay: null, firstPlaque: false
      };
      return st;
    }
    // the cast: Priya is with you from day 0
    addPerson('priya', true);
    // the opening is Priya's voice, with the goal and the first three things
    S.ledger.push({ day: 0, what: 'Seed round: $6M at a $30M post (you own 80%)', amt: CFG.seedCash });
    S.ledger.push({ day: 0, what: 'DGX-1 (8 V100s)', amt: -CFG.dgx1Price });

    /* ---------------- people ---------------- */
    function addPerson(key, founding) {
      var d = WORLD.people[key];
      var p = { key: key, name: d.name, first: d.first, role: d.role, skill: d.skill, salary: d.salary, ego: d.ego, mood: CFG.moodStart,
        joined: S.day, gone: false, effect: d.effect, status: d.status, lastAsk: -999, founding: !!founding };
      if (key === 'ayaan' && S.day >= CFG.apiDay) p.salary = d.salaryLate;
      S.team.push(p); S.knocked[key] = true;
      S.candidates = S.candidates.filter(function (c) { return c.key !== key; });
      return p;
    }
    function staff() { return S.team.filter(function (p) { return !p.gone; }); }
    function person(key) { for (var i = 0; i < S.team.length; i++) if (S.team[i].key === key && !S.team[i].gone) return S.team[i]; return null; }
    function has(key) { return !!person(key); }
    function hasRole(role) { return staff().some(function (p) { return p.role === role; }); }
    function countRole(role) { return staff().filter(function (p) { return p.role === role; }).length; }
    function hasInfra() { var t = person('tom'); return (t && S.day >= (S.flags.tomOffUntil || 0)) || has('kofi'); }
    function infraMult() { var t = person('tom') && S.day >= (S.flags.tomOffUntil || 0), k = has('kofi'); return t && k ? CFG.hangBothMult : (t || k) ? CFG.hangInfraMult : 1; }
    function optBend() { var o = staff().filter(function (p) { return p.role === 'optimization' && S.day - p.joined >= CFG.optDelay; }); return o.length ? CFG.optBend : 1; }
    function memLimit() { return CFG.memLimit[Math.min(2, countRole('systems'))]; }
    function voice(who, text, kind) {
      var p = WORLD.people[who];
      var e = { day: S.day, who: who, name: p ? p.first : who, role: p ? p.role : '', text: text, kind: kind || 'voice' };
      S.feed.unshift(e); if (S.feed.length > 120) S.feed.length = 120;
      emit({ type: 'voice', who: who, text: text, kind: kind || 'voice' });
    }
    function moodAdd(p, d, why) {
      if (!p || p.gone) return;
      p.mood = clamp(p.mood + d, 0, 100);
      if (p.mood <= 0) walk(p, why || 'morale hit zero');
    }
    function walk(p, why, toRival) {
      if (!p || p.gone) return;
      p.gone = true; p.goneDay = S.day; p.why = why;
      if (toRival) { var rv = rival(toRival); if (rv) { rv.extra += CFG.rivalPassBoost; rv.people.push(p.first); } p.to = rv ? rv.name : toRival; }
      voice('lab', p.first + ' left' + (p.to ? ' for ' + p.to : '') + ': ' + why + '.', 'leave');
      // jobs they were running stop
      if (S.data.job && S.data.job.who === p.key) {
        var other = staff().filter(function (x) { return x.role === 'data'; })[0];
        if (other) { S.data.job.who = other.key; } else { S.data.job = null; voice('lab', 'Cleaning the crawl stopped: nobody left to run it.', 'warn'); }
      }
      if (S.redteam && p.role === 'evals' && !hasRole('evals')) { var r = runById(S.redteam.runId); S.redteam = null; if (r) { r.redteaming = false; queueLanding(r, false); } }
      emit({ type: 'team' });
    }
    function rival(key) { for (var i = 0; i < S.rivals.length; i++) if (S.rivals[i].key === key || S.rivals[i].name === key) return S.rivals[i]; return null; }

    /* ---------------- cards ---------------- */
    function rentPrice(day) { var p = CFG.rent.price[0][1]; CFG.rent.price.forEach(function (x) { if (day >= x[0]) p = x[1]; }); return p; }
    function rentCap(day) { var c = CFG.rent.cap[0][1]; CFG.rent.cap.forEach(function (x) { if (day >= x[0]) c = x[1]; }); return c; }
    function rentalLive(r, day) { day = day == null ? S.day : day; return day >= r.start && day < r.end; }
    function rentedLive() { var n = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) n += r.n; }); return n; }
    function rentedAll() { var n = 0; S.rentals.forEach(function (r) { if (S.day < r.end) n += r.n; }); return n; }
    function lentN() { return S.lent && S.day < S.lent.until ? S.lent.n : 0; }
    function merLive() { return S.mer && S.day >= S.mer.live ? S.mer.alloc : 0; }
    function rawPool(key) {
      if (key === 'office') return Math.max(0, S.owned.v100 - lentN());
      if (key === 'a100') return S.owned.a100;
      if (key === 'cloud') return rentedLive();
      if (key === 'meridian') return merLive();
      return 0;
    }
    var POOLS = ['office', 'cloud', 'a100', 'meridian'];
    var POOL_NAME = { office: 'Office racks', cloud: 'Broker cloud', a100: 'A100 racks', meridian: 'Meridian' };
    var POOL_TYPE = { office: 'v100', cloud: 'v100', a100: 'a100', meridian: 'v100' };
    function servingN(key) { return S.serving && S.serving.pool === key ? Math.min(S.serving.n, rawPool(key)) : 0; }
    function poolCount(key) { return Math.max(0, rawPool(key) - servingN(key)); }
    function flopsPer(key) { return CFG.flops[POOL_TYPE[key]]; }
    function poolFlops(key) { return poolCount(key) * flopsPer(key); }
    function totalFlops() { var t = 0; POOLS.forEach(function (k) { t += poolFlops(k); }); return t; }
    function biggestPool() { var best = 'office', bf = -1; POOLS.forEach(function (k) { var f = poolFlops(k); if (f > bf) { bf = f; best = k; } }); return best; }
    function physicalCards() { return S.owned.v100 + S.owned.a100 + rentedAll() + (S.mer ? S.mer.cards : 0); }
    function refreshServing() {
      if (!S.api) { S.serving = null; return; }
      var best = 'office', bn = -1; POOLS.forEach(function (k) { var n = rawPool(k); if (n > bn) { bn = n; best = k; } });
      var tot = 0; POOLS.forEach(function (k) { tot += rawPool(k); });
      var n = clamp(Math.round(tot * CFG.serving.share), CFG.serving.min, CFG.serving.max);
      S.serving = { pool: best, n: Math.min(n, bn) };
    }

    /* ---------------- money ---------------- */
    function salaries() { var t = 0; staff().forEach(function (p) { t += p.salary; }); return t; }
    function upkeep() { return CFG.upkeepPerCard * (S.owned.v100 + S.owned.a100); }
    function payroll() { return CFG.base + salaries() + upkeep(); }
    function rentMonthly() { var t = 0; S.rentals.forEach(function (r) { if (S.day < r.end) t += r.n * r.price * 24 * 30.4; }); return t; }
    function apiMonthly() { return S.api ? S.api.rev : 0; }
    function burn(mod) {
      mod = mod || {};
      return payroll() + (mod.salary || 0) + (mod.owned || 0) * CFG.upkeepPerCard + rentMonthly() + (mod.rent || 0) - apiMonthly() - (mod.rev || 0);
    }
    function runway(mod) { mod = mod || {}; var b = burn(mod); var bank = S.bank + (mod.bank || 0); if (b <= 0) return Infinity; return Math.max(0, bank / b); }
    function runwayPair(mod) { var a = runway(), b = runway(mod); return months(a) + ' → ' + months(b) + ' months until broke'; }
    function burnPair(mod) { return money(burn()) + ' → ' + money(burn(mod)) + ' a month'; }

    /* ---------------- data ---------------- */
    function wallTokens() { return CFG.passes * S.data.W; }
    function amount(rq) { if (rq < CFG.cleanR) return 0; if (rq <= 1) return Math.min(CFG.frayMax, 1 + Math.floor((rq - CFG.cleanR) / CFG.frayStep + 1e-9)); return CRAWL; }
    function filterCost() { return CFG.filterCost * Math.pow(2, S.data.filters); }
    function filterDays() { var d = countRole('data'); return d >= 2 ? CFG.filterDaysPair : CFG.filterDays; }

    /* ---------------- runs ---------------- */
    function farthestClean() { var m = 0; S.runs.forEach(function (r) { if (r.clean && r.C > m) m = r.C; }); return m; }
    function bestClean() { var b = null; S.runs.forEach(function (r) { if (r.clean && (!b || r.C > b.C)) b = r; }); return b; }
    function farthestPublic() { var m = 0; S.runs.forEach(function (r) { if (r.clean && (r.published || r.shipped) && r.C > m) m = r.C; }); return m; }
    function runById(id) { for (var i = 0; i < S.runs.length; i++) if (S.runs[i].id === id) return S.runs[i]; for (var j = 0; j < S.active.length; j++) if (S.active[j].id === id) return S.active[j]; return null; }
    function frontier() { var m = 0; S.rivals.forEach(function (rv) { rv.pubs.forEach(function (p) { if (p.day <= S.day && p.C > m) m = p.C; }); }); if (S.day >= CFG.gpt3Day) m = Math.max(m, CFG.gpt3C); return m; }
    function relevantNeed() { return frontier() * CFG.relevanceShare; }
    function horizon() { var f = farthestClean(); return f ? f * CFG.horizonMult : CFG.horizonFirst; }

    function design(p) {
      // the designer's numbers for a proposed run: what the panel shows and what launch() uses
      p = p || {};
      var N = clamp(+p.params || CFG.starter.N, CFG.paramsMin, CFG.paramsMax);
      var D = clamp(+p.tokens || recipeTokens(N), CFG.tokensMin, CFG.tokensMax);
      var pool = p.pool && POOLS.indexOf(p.pool) >= 0 ? p.pool : biggestPool();
      var avail = poolCount(pool);
      var cards = Math.max(0, Math.min(avail, Math.round(p.gpus == null ? avail : +p.gpus)));
      if (S.flags.fullCluster) cards = avail;
      var C = 6 * N * D, rate = cards * flopsPer(pool), days = rate > 0 ? C / rate : Infinity;
      var hourly = pool === 'cloud' ? rentPrice(S.day) : pool === 'meridian' ? CFG.meridian.rate : CFG.ownedHourly;
      var cost = cards * 24 * (isFinite(days) ? days : 0) * hourly;
      var bend = optBend(), rec = offRecipe(N, D), Lp = Lline(C) * rec * bend;
      var wall = wallTokens(), r = D / wall;
      var dec = Math.max(0, log10(C / horizon()));
      var sig = dec * CFG.extrapSigma * (hasRole('scaling') ? CFG.scalingSigmaMult : 1) * (S.day >= CFG.lineDay ? CFG.lineKnownMult : 1);
      var landDay = S.day + days;
      var rw = runway(); var bankAtLand = S.bank - burn() * (isFinite(days) ? days : 0) / 30.4;
      var warn = [], block = null;
      var onPool = S.active.filter(function (x) { return x.pool === pool; })[0];
      if (onPool) block = 'Run ' + onPool.id + ' is training on ' + POOL_NAME[pool] + '. One run per pool.';
      if (N > memLimit()) {
        var w = countRole('systems') === 0 ? sizeWord(N) + ' parameters won’t fit on one card. Max ' + sizeWord(memLimit()) + ' without a systems person (Dev arrives 11 Jan).'
          : sizeWord(N) + ' won’t fit even split across 8. Max ' + sizeWord(memLimit()) + ' with one systems person; a second unlocks pipelines.';
        warn.push({ k: 'mem', bad: true, t: w }); block = block || 'Memory limit';
      }
      if (cards < 1) { warn.push({ k: 'cards', bad: true, t: 'No free cards in ' + POOL_NAME[pool] + '.' }); block = block || 'No cards'; }
      var lo = S.data.lo, hi = S.data.hi;
      if (D > hi) warn.push({ k: 'data', bad: true, t: tokWord(D) + ' tokens is past every estimate of the data wall (' + tokWord(lo) + '–' + tokWord(hi) + '). It will eat crawl and prove nothing.' });
      else if (D > lo) warn.push({ k: 'data', bad: true, t: tokWord(D) + ' tokens may cross the data wall (somewhere ' + tokWord(lo) + '–' + tokWord(hi) + '). Past it the run proves nothing.' });
      else if (D > lo * CFG.cleanR) warn.push({ k: 'data', bad: false, t: 'Late in the run the text may fray: ' + tokWord(D) + ' tokens of at least ' + tokWord(lo) + ' clean ones. Read what the model says.' });
      if (rec > 1.01) warn.push({ k: 'recipe', bad: false, t: 'Off the recipe: ' + tokWord(D) + ' tokens for ' + sizeWord(N) + ' wastes compute (+' + ((rec - 1) * 100).toFixed(1) + '% error score).' });
      if (sig > 0.004) warn.push({ k: 'extrap', bad: sig > 0.015, t: dec.toFixed(1) + ' decades past your measured horizon: may land up to ' + (sig * 200).toFixed(1) + '% above the line' + (hasRole('scaling') ? '.' : ' (a scaling person cuts that by 4×).') });
      if (landDay > CFG.endDay) warn.push({ k: 'year', bad: true, t: 'Won’t land by 31 DEC: ' + (isFinite(days) ? Math.ceil(days) + ' days' : 'no cards') + '.' });
      else if (bankAtLand < 0 && burn() > 0) warn.push({ k: 'money', bad: true, t: 'Money runs out before it lands (' + fmtDate(landDay) + ').' });
      if (S.flags.fullCluster) warn.push({ k: 'ayaan', bad: false, t: 'You promised Ayaan the whole pool: this run uses every card.' });
      if (pool === 'cloud' && isFinite(days) && cards > 0) {
        var keep = 0, firstEnd = Infinity; S.rentals.forEach(function (x) { if (x.start <= S.day + 1 && x.end > landDay) keep += x.n; else if (x.end > S.day && x.end < firstEnd) firstEnd = x.end; });
        if (keep < cards && firstEnd < landDay) warn.push({ k: 'rent', bad: true, t: (cards - Math.min(keep, cards)) + ' of these cards go back to the broker on ' + fmtDate(firstEnd) + ', before it lands. Renew them under Rent cards, or the run slows or moves.' });
      }
      if (pool === 'meridian' && landDay > CFG.meridian.queueFrom && S.mer) warn.push({ k: 'queue', bad: false, t: 'Meridian\u2019s queue resets your allocation on each 1st from 11 Jun: fall behind the frontier and you lose cards mid-run.' });
      return { N: N, D: D, C: C, pool: pool, poolName: POOL_NAME[pool], avail: avail, cards: cards, days: days, landDay: landDay, cost: cost, hourly: hourly,
        L: Lp, line: Lline(C), rec: rec, bend: bend, sigUp: sig, dec: dec, r: r, wall: wall, warn: warn, block: block,
        runwayNow: rw, runwayAtLand: Math.max(0, burn() > 0 ? bankAtLand / burn() : Infinity), recipeD: recipeTokens(N), mem: memLimit() };
    }
    function tokWord(D) { return sizeWord(D); }

    function launch(p) {
      if (S.over) return { ok: false, msg: 'The year is over.' };
      var d = design(p);
      if (d.block) return { ok: false, msg: d.block };
      var r = {
        id: ++S.runSeq, N: d.N, D: d.D, C: d.C, pool: d.pool, cards: d.cards, launchDay: S.day, done: 0, T0: d.days, rate0: d.cards * flopsPer(d.pool),
        wall: d.wall, r: d.r, proj: d.L, sigUp: d.sigUp, line: d.line, pts: [], cks: [], ckIdx: 0, autoIdx: 0, hang: null, hangs: 0, status: 'training',
        eps: Math.abs(gauss()) * d.sigUp + gauss() * CFG.landNoise, filtersAtLaunch: S.data.filters
      };
      var pastWall = r.r > 1 ? 1 + CFG.pastWallPenalty * Math.log(r.r) / Math.LN2 : 1;
      r.Lfinal = d.L * Math.exp(r.eps) * pastWall;
      r.k = r.Lfinal / Lline(r.C);
      if (S.flags.fullCluster) { S.flags.fullCluster = false; var ay = person('ayaan'); if (ay) { moodAdd(ay, CFG.moods.ayaanFull); voice('ayaan', 'the whole thing. good.'); } }
      S.active.push(r); S.stats.runs++;
      if (!S.started) { S.started = true; }
      if (d.N > 1.36e9 && has('dev') && !S.flags.devSplit) { S.flags.devSplit = true; voice('dev', WORLD.say.devSplit); }
      if (d.dec > 1 && has('ayaan') && !S.flags.ayaanGoing) { S.flags.ayaanGoing = true; voice('ayaan', WORLD.say.ayaanGoing); }
      emit({ type: 'launch', run: r });
      return { ok: true, run: r };
    }
    function lossAt(r, s) {
      s = clamp(s, P0, 1);
      var z = (log10(s) + 3.5) / 3.5, Ls = Lline(s * r.C) * r.k, H0 = Math.log(CFG.startLoss) - Math.log(Lline(P0 * r.C) * r.k);
      return Math.exp(Math.log(Ls) + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z)));
    }
    function runRate(r) { var n = Math.min(r.cards, poolCount(r.pool)); return n * flopsPer(r.pool); }
    function runDaysLeft(r) { var rate = runRate(r); return rate > 0 ? (r.C - r.done) / rate + (r.hang ? Math.max(0, r.hang.until - S.day) : 0) : Infinity; }

    function stepRuns(dt) { S.active.slice().forEach(function (r) { stepRun(r, dt); }); }
    function stepRun(r, dt) {
      if (r.hang) {
        if (S.day + dt >= r.hang.until - 1e-9) { var h = r.hang; r.hang = null; r.status = 'training'; emit({ type: 'hangEnd', run: r, hang: h }); }
        return;
      }
      // a run whose cards went away moves to the best other pool from its last checkpoint, and says so
      if (runRate(r) < CFG.migrateBelow * r.rate0) {
        var cur = runRate(r), to = null, tf = cur;
        POOLS.forEach(function (k) { if (k !== r.pool && poolCount(k) > 0 && !S.active.some(function (x) { return x !== r && x.pool === k; }) && poolFlops(k) > Math.max(tf * CFG.migrateGain, tf + 1)) { to = k; tf = poolFlops(k); } });
        if (to) {
          var from = r.pool; r.pool = to; r.cards = poolCount(to); r.moved = (r.moved || 0) + 1;
          r.done = Math.max(0, r.done - r.C * CFG.migrateRewind);
          voice('lab', 'Run ' + r.id + ' lost its cards on the ' + POOL_NAME[from].toLowerCase() + '. It restarted from its last saved copy on ' + r.cards + ' ' + (to === 'a100' ? 'A100s' : 'V100s') + ' in ' + POOL_NAME[to] + '.', 'warn');
          emit({ type: 'moved', run: r });
        }
      }
      var rate = runRate(r); if (!(rate > 0)) { r.status = 'starved'; return; }
      r.status = 'training';
      var cardsNow = Math.min(r.cards, poolCount(r.pool));
      var lam = CFG.hangPerCardDay * cardsNow * infraMult();
      if (rng() < lam * dt) { startHang(r, rate); return; }
      var s0 = r.done / r.C;
      r.done = Math.min(r.C, r.done + rate * dt);
      var s = r.done / r.C;
      // curve points (log-spaced in progress), with the run's own seed noise
      var last = r.pts.length ? r.pts[r.pts.length - 1].s : 0;
      if (s >= P0 && (s - last >= Math.max(0.002, last * 0.02) || s >= 1)) {
        var y = lossAt(r, s) * (1 + gauss(wrng) * CFG.curveNoise * (1 - 0.5 * clamp((log10(s) + 3.5) / 3.5, 0, 1)) * (s >= 1 ? 0 : 1));
        r.pts.push({ s: s, x: s * r.C, y: s >= 1 ? r.Lfinal : y });
      }
      while (r.ckIdx < CFG.checkpoints.length && s >= CFG.checkpoints[r.ckIdx]) {
        var cs = CFG.checkpoints[r.ckIdx]; r.cks.push({ s: cs, loss: lossAt(r, cs), sampled: false }); r.ckIdx++;
      }
      while (r.autoIdx < CFG.autoSampleAt.length && s >= CFG.autoSampleAt[r.autoIdx]) {
        r.autoIdx++; if (s < 1) { var smp = makeSample(r, s, 'auto'); setSample(smp); }
      }
      if (s0 < 1 && s >= 1 - 1e-12) land(r);
    }
    function pickHour() { var hrs = []; for (var h = 0; h < 24; h++) { hrs.push(h); if (h >= 1 && h <= 5) hrs.push(h); } return pick(hrs); }
    function startHang(r, rate) {
      var hour = pickHour(), infra = hasInfra(), dur, cardsHung = Math.min(r.cards, poolCount(r.pool));
      if (rng() < CFG.nanShare) {
        var back = Math.min(r.done, rate * (infra ? CFG.nanRewindInfra : CFG.nanRewindNoInfra));
        r.done -= back; r.nans = (r.nans || 0) + 1; S.stats.nans = (S.stats.nans || 0) + 1;
        var hm = (hour < 10 ? '0' : '') + hour + ':' + String(Math.floor(rng() * 60)).padStart(2, '0');
        r.hang = { start: S.day, until: S.day + CFG.nanPauseDays, hour: hour, min: 0, infra: true, nan: true, lost: back / rate + CFG.nanPauseDays, label: hm + ' NaN' };
        noteHang(r, cardsHung, back / rate, true);
        r.status = 'nan';
        voice(has('tom') ? 'tom' : has('kofi') ? 'kofi' : 'lab', has('tom') || has('kofi') ? 'NaN at ' + hm + '. Rolled back ' + (back / rate).toFixed(1) + ' days. Lowering the learning rate.' : 'Run ' + r.id + ' went NaN at ' + hm + ': the loss blew up. It rolled back ' + (back / rate).toFixed(1) + ' days to the last checkpoint.', 'warn');
        emit({ type: 'nan', run: r });
        return;
      }
      if (infra) dur = CFG.hangInfraDays;
      else {
        dur = hour < 8 ? (8 - hour) / 24 : (1 + rng() * 2) / 24;
        if (S.day >= CFG.hangCovidFrom && S.day <= CFG.hangCovidTo) dur += CFG.hangCovidExtra;
      }
      var rewind = Math.min(r.done, rate * (infra ? CFG.rewindInfra : CFG.rewindNoInfra));
      r.done -= rewind;
      r.hang = { start: S.day, until: S.day + dur, hour: hour, min: Math.floor(rng() * 60), infra: infra, lost: rewind / rate + dur };
      r.hangs++; r.status = 'hung'; S.hangsMonth++; S.stats.hangs++;
      var hh = (hour < 10 ? '0' : '') + hour + ':' + (r.hang.min < 10 ? '0' : '') + r.hang.min;
      r.hang.label = hh;
      noteHang(r, cardsHung, rewind / rate + dur, false, rewind / rate);
      if (has('tom')) voice('tom', WORLD.say.tomHang + ' (' + hh + ')');
      else if (has('kofi')) voice('kofi', 'restarted it. ' + hh + '.');
      else voice('lab', fill(WORLD.say.hangNoInfra, { hour: hh }), 'warn');
      emit({ type: 'hang', run: r, hang: r.hang });
    }
    function noteHang(r, cards, daysLost, nan, rewindDays) {
      var pool = r.pool, per = (pool === 'cloud' ? rentPrice(S.day) * 24 : pool === 'meridian' ? CFG.meridian.rate * 24 : CFG.own.v100 / CFG.own.life + CFG.upkeepPerCard / 30.4);
      S.lastHang = { day: S.day, run: r.id, node: 1 + Math.floor(rng() * Math.max(1, Math.ceil(cards / 8))), hours: Math.round((rewindDays != null ? rewindDays : daysLost) * 24 * 10) / 10, dollars: Math.round(daysLost * cards * per), nan: !!nan, infra: hasInfra() };
    }
    function wake(key) {
      var hung = hungRuns(); if (!hung.length) return { ok: false, msg: 'Nothing is hung.' };
      var p = key ? person(key) : staff()[0]; if (!p) return { ok: false, msg: 'Nobody to wake.' };
      hung.forEach(function (r) { r.hang.until = Math.min(r.hang.until, S.day + CFG.wakeDays); });
      moodAdd(p, -(p.role === 'infra' ? CFG.wakeMoodInfra : CFG.wakeMood), 'too many 3 AM calls');
      voice(p.key, WORLD.say.woken);
      return { ok: true };
    }

    /* ---------------- samples (the model's voice) ---------------- */
    function bag(name, pool) { var b = S.bags[name]; if (!b || !b.length) b = S.bags[name] = shuffle(pool.slice(), wrng); return b.pop(); }
    function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
    function cut(txt, max) {
      if (txt.indexOf('\n') >= 0 || txt.length <= max) return txt;
      var parts = sentences(txt), out = '';
      for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > max) break; out += parts[i]; }
      out = out.trim(); if (out.length > max + 40) out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
      return out;
    }
    function capById(id) { for (var i = 0; i < S.caps.length; i++) if (S.caps[i].id === id) return S.caps[i]; return null; }
    function tierOf(Lv) { if (Lv > CFG.tierStatic) return 0; if (Lv > CFG.tierWords) return 1; if (Lv > CFG.tierGrammar) return 2; var para = capById('paragraph'); return (para.fired && Lv <= para.L) ? 4 : 3; }
    function pickT3(Lv) {
      var want = Lv > CFG.t3Sense[0] ? 1 : Lv > CFG.t3Sense[1] ? 2 : 3, order = want === 1 ? [1, 2, 3] : want === 2 ? [2, 3, 1] : [3, 2, 1];
      for (var pass = 0; pass < 2; pass++) {
        for (var o = 0; o < 3; o++) { var cand = []; CORPUS.t3.forEach(function (e, i) { if (e[0] === order[o] && !S.t3used[i]) cand.push(i); }); if (cand.length) { var i = pick(cand, wrng); S.t3used[i] = 1; return CORPUS.t3[i][1]; } }
        S.t3used = {};
      }
      return CORPUS.t3[0][1];
    }
    function pickT4(moment) {
      for (var pass = 0; pass < 2; pass++) {
        var cand = []; CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i] && (!moment || e[0] === 1)) cand.push(i); });
        if (!cand.length && moment) CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i]) cand.push(i); });
        if (cand.length) { var i = pick(cand, wrng); S.t4used[i] = 1; return CORPUS.t4[i][1]; }
        S.t4used = {};
      }
      return CORPUS.t4[0][1];
    }
    function pickLow(tier) {
      if (tier === 0) return bag('t0', CORPUS.t0);
      if (tier === 1) return bag('t1', CORPUS.t1);
      if (S.day >= CFG.covidStringDay && !S.covidIn) { S.covidIn = true; S.bags.t2 = shuffle(CORPUS.t2.concat([CORPUS.t2Covid]), wrng); }
      return bag('t2', S.covidIn ? CORPUS.t2.concat([CORPUS.t2Covid]) : CORPUS.t2);
    }
    function crawlLine() {
      var pool = shuffle(CORPUS.crawl.slice(), wrng), out = '';
      for (var i = 0; i < pool.length; i++) { var next = out ? out + ' | ' + pool[i] : pool[i]; if (out && next.length > 150) continue; out = next; if (out.length >= 100) break; }
      return out;
    }
    var PUNCT_END = /[.,;:!?»)\]"”’…]$/, PUNCT_START = /^[(\["“‘«.,;:!?…]/;
    function splice(text, k) {
      if (!(k > 0) || k >= CRAWL) return text;
      var words = text.split(' '), n = words.length, i, j, gaps = [];
      for (i = 0; i < n - 1; i++) {
        var pos = (i + 1) / n; if (pos < 0.1 || pos > 0.9) continue;
        if (PUNCT_END.test(words[i]) || PUNCT_START.test(words[i + 1]) || /\n/.test(words[i]) || /\n/.test(words[i + 1])) continue;
        gaps.push(i);
      }
      if (!gaps.length) for (i = 0; i < n - 1; i++) gaps.push(i);
      var chosen = shuffle(gaps.slice(), wrng).slice(0, k).sort(function (a, b) { return a - b; });
      var frags = shuffle(CORPUS.fray.slice(), wrng).slice(0, k), out = [], fi = 0;
      for (i = 0; i < n; i++) { out.push(words[i]); if (chosen.indexOf(i) >= 0 && fi < frags.length) out.push(frags[fi++]); }
      return out.join(' ');
    }
    var sampleSeq = 0;
    function makeSample(r, s, kind, capId) {
      var Lv = s >= 1 ? r.Lfinal : lossAt(r, s), tier = tierOf(Lv), tok = s * r.D, rq = tok / r.wall, amt = amount(rq);
      var text, cap = null, full;
      if (capId) tier = Math.max(tier, 3);
      if (tier >= 3 && amt === CRAWL) text = crawlLine();
      else if (tier >= 3) {
        if (capId) { full = capId === 'paragraph' ? pickT4(true) : bag(capId, CORPUS[capId]); cap = capId; }
        else {
          var elig = S.caps.filter(function (c) { return c.fired && c.id !== 'paragraph' && Lv <= c.L; });
          if (elig.length && wrng() < CFG.capSampleShare) { var c = pick(elig, wrng); full = bag(c.id, CORPUS[c.id]); cap = c.id; }
          else full = tier === 4 ? pickT4(false) : pickT3(Lv);
        }
        if (cap === 'code') text = full + (amt > 0 ? '\n# ' + shuffle(CORPUS.fray.slice(), wrng).slice(0, amt).join('\n# ') : '');
        else text = splice(cut(full, capId === 'paragraph' ? 600 : 240), amt);
      } else { text = pickLow(tier); amt = 0; }
      return { id: ++sampleSeq, runId: r.id, text: text, tier: tier, fray: amt, crawl: amt === CRAWL, cap: cap, s: s, loss: Lv, tokens: tok, C: s * r.C, kind: kind, day: S.day };
    }
    function setSample(smp) { S.lastSample = smp; S.samples.unshift(smp); if (S.samples.length > 30) S.samples.length = 30; emit({ type: 'sample', sample: smp }); }
    function learnWall(smp, r) {
      // reading a checkpoint tells you where the wall is, if the wall hasn't moved since that run launched
      if (!r || r.filtersAtLaunch !== S.data.filters || smp.tier < 3) return;
      var t = smp.tokens, d = S.data, lo = d.lo, hi = d.hi;
      if (smp.fray === 0) lo = Math.max(lo, t / CFG.cleanR);
      else if (smp.crawl) hi = Math.min(hi, t);
      else { var k = smp.fray; lo = Math.max(lo, t / Math.min(1, CFG.cleanR + CFG.frayStep * k)); hi = Math.min(hi, t / (CFG.cleanR + CFG.frayStep * (k - 1))); }
      if (lo > hi) { var m = Math.sqrt(lo * hi); lo = m * 0.98; hi = m * 1.02; }
      var changed = Math.abs(lo - d.lo) > 1 || Math.abs(hi - d.hi) > 1;
      d.lo = lo; d.hi = hi;
      if (changed) emit({ type: 'data' });
    }
    function priyaReads(smp) {
      var who = has('priya') ? 'priya' : has('ines') ? 'ines' : null; if (!who) return;
      var r = runById(smp.runId); if (!r) return;
      var lvl = smp.crawl ? 3 : smp.fray >= 4 ? 2 : smp.fray >= 2 ? 1 : 0;
      if (!lvl || (r.flagged || 0) >= lvl) return;
      r.flagged = lvl;
      voice(who, lvl === 3 ? WORLD.say.crawl : lvl === 2 ? WORLD.say.fray : WORLD.say.fray3, 'data');
    }
    function sampleNow(id) {
      var r = id != null ? runById(id) : mainRun(); if (r && r.status === 'landed') r = null;
      if (!r) { if (S.lastSample) return { ok: true, sample: S.lastSample }; return { ok: false, msg: 'No run is training.' }; }
      var ck = null; for (var i = r.cks.length - 1; i >= 0; i--) if (!r.cks[i].sampled) { ck = r.cks[i]; break; }
      var s = ck ? ck.s : (r.cks.length ? r.cks[r.cks.length - 1].s : Math.max(P0, r.done / r.C));
      if (ck) ck.sampled = true;
      var smp = makeSample(r, s, 'manual'); setSample(smp); learnWall(smp, r); priyaReads(smp);
      return { ok: true, sample: smp };
    }

    /* ---------------- landing ---------------- */
    function land(r) {
      S.active = S.active.filter(function (x) { return x !== r; });
      r.landDay = S.day; r.L = r.Lfinal; r.clean = r.r <= 1; r.onLine = r.L <= Lline(r.C) * CFG.onLineTol; r.status = 'landed';
      var base = 'FRONTIER-' + sizeWord(r.N), dup = S.runs.filter(function (x) { return (x.name || '').indexOf(base) === 0; }).length; r.name = dup ? base + String.fromCharCode(97 + dup) : base;
      var prevFar = farthestClean();
      r.newCaps = [];
      if (r.clean) {
        S.caps.forEach(function (c) {
          if (!c.fired && r.L <= c.L) {
            c.fired = true; c.day = S.day; c.runId = r.id; r.newCaps.push(c.id);
            if (S.data.filters === 0 && c.id !== 'paragraph' && rng() < CFG.contamination) c.contaminated = true;
          }
        });
      }
      r.caps = S.caps.filter(function (c) { return c.fired && r.clean && r.L <= c.L; }).map(function (c) { return c.id; });
      var top = r.newCaps.length ? r.newCaps[r.newCaps.length - 1] : null;
      var smp = makeSample(r, 1, 'land', top); r.sample = smp.text; r.sampleCap = smp.cap; setSample(smp); learnWall(smp, r); priyaReads(smp);
      S.runs.push(r);
      if (!S.firstPlaque) S.firstPlaque = true;
      if (r.clean) {
        r.newCaps.forEach(function (id) { milestone('cap', { paragraph: 'First paragraph: it writes text that holds together', arithmetic: 'It adds two-digit numbers', translation: 'It translates passably', code: 'It writes one-line functions, rarely' }[id]); });
        S.rivals.forEach(function (rv) { if (!S.passed[rv.key] && r.C > rivalBest(rv) && prevFar <= rivalBest(rv)) { S.passed[rv.key] = true; milestone('pass', 'You passed ' + rv.name); } });
      }
      if (r.newCaps.length) { staff().forEach(function (p) { moodAdd(p, CFG.capMood); }); }
      if (has('lena')) r.newCaps.forEach(function (id) { var c = capById(id); if (c.contaminated) { c.leakKnown = true; voice('lena', fill(WORLD.say.leak, { cap: id })); } });
      if (r.clean && optBend() < 1 && !S.flags.sunheeTold && has('sunhee')) { S.flags.sunheeTold = true; voice('sunhee', WORLD.say.sunheeTold); }
      if (!r.clean) { var w = has('priya') ? 'priya' : has('ines') ? 'ines' : 'lab'; voice(w, WORLD.say.pastWallLand, 'data'); }
      if (r.clean && r.C >= CFG.gpt3C * CFG.miracleCTol && r.L <= CFG.gpt3L * CFG.miracleTol) { S.miracle = true; r.miracle = true; }
      emit({ type: 'land', run: r });
      queueLanding(r, false);
    }
    // reputation comes from reaching further than you have before, measured against the frontier, plus new capabilities
    function reach(C) { var fr = Math.max(frontier(), 1e18); return C > 0 ? clamp((log10(C) - log10(fr) + 2) / 2, 0, 1.25) : 0; }
    function repGain(r) {
      var prev = reach(farthestPublic());
      var newCaps = (r.caps || []).filter(function (id) { return !S.flags['pub_' + id]; }).length;
      return Math.round(CFG.repPublishBase + CFG.repPublishReach * Math.max(0, reach(r.C) - prev) + CFG.repPerCap * newCaps);
    }
    function scandalRisk(r, ship) {
      if (r.redteamed) return 0;
      if (!ship && (r.caps || []).some(function (id) { var c = capById(id); return c.contaminated; })) return 1;
      if (ship) return CFG.scandalShip;
      // nobody scrutinises a paper far behind the frontier; the closer to it, the harder they look
      var scrut = clamp((log10(r.C) - 20.7) / 0.8, 0, 1);   // a first small paper is not scrutinised
      return (S.data.filters > 0 ? CFG.scandalPublishFiltered : CFG.scandalPublish) * (0.25 + 0.75 * Math.min(1, reach(r.C))) * scrut;
    }
    function shipTier(r) { var t = null; (r.caps || []).forEach(function (id) { t = id; }); return t; }
    function shipRev(r) { var t = shipTier(r); return t ? Math.round(CFG.capRevenue[t] * (0.75 + S.rep / 200)) : 0; }
    function servingFor() { var tot = 0; POOLS.forEach(function (k) { tot += rawPool(k); }); return clamp(Math.round(tot * CFG.serving.share), CFG.serving.min, CFG.serving.max); }
    function queueLanding(r, afterRT) {
      var name = r.name || ('FRONTIER-' + sizeWord(r.N));
      var d = { kind: 'land', runId: r.id, from: 'SAVED MODEL', title: '', voice: '', who: null, run: r, sample: r.sample, sampleCap: r.sampleCap, options: [] };
      d.evals = S.caps.map(function (c) { return { id: c.id, label: WORLD.caps[c.id].label, ok: r.clean && r.L <= c.L, isNew: r.newCaps.indexOf(c.id) >= 0, leak: c.contaminated && c.leakKnown && r.L <= c.L }; });
      if (!r.clean) {
        d.title = name + ' ran past the data wall';
        d.who = has('priya') ? 'priya' : has('ines') ? 'ines' : null;
        d.voice = WORLD.say.pastWallLand;
        d.body = sizeWord(r.N) + ' model size, but it read ' + sizeWord(r.D) + ' words and only about ' + sizeWord(r.wall) + ' were clean. It memorised web boilerplate: no skills, nothing to publish.';
        d.options.push({ key: 'ok', label: 'Noted', primary: true, fn: function () { r.private = true; } });
        if (canFilter().ok) d.options.push({ key: 'filter', label: 'Clean the crawl', effect: function () { return money(filterCost()) + ' · ' + filterDays() + ' days · about 86% more fresh text'; }, fn: function () { r.private = true; startFilter(); } });
        decide(d); return;
      }
      var vsLine = (r.L / Lline(r.C) - 1) * 100;
      d.title = name + ' is saved · ' + (shortOf(r.C) <= 1.05 ? 'it passed GPT-3' : ratioWord(shortOf(r.C)) + ' short of GPT-3');
      d.body = 'Error score ' + r.L.toFixed(2) + ' (lower is better): ' + (Math.abs(vsLine) < 0.3 ? 'right on the line.' : vsLine < 0 ? Math.abs(vsLine).toFixed(1) + '% below the line, better than the compute should buy.' : vsLine.toFixed(1) + '% above the line' + (r.onLine ? '.' : ': too far off to count for investors.')) + ' It ' + plainLine(r) + '.';
      if (afterRT) { d.who = 'lena'; d.voice = WORLD.say.lenaDone; }
      else if (r.newCaps.length) { d.who = has('priya') ? 'priya' : staff()[0] && staff()[0].key; d.voice = fill(WORLD.say.capMoment, { what: WORLD.caps[r.newCaps[r.newCaps.length - 1]].what }); d.moment = true; }
      else if (S.stats.runs === 1 && r.id === 1) { d.who = 'priya'; d.voice = fill(WORLD.say.firstLand, { C: sci(r.C) }); }
      if (r.miracle) { d.title = name + ' matched GPT-3'; d.voice = 'We did it. In 2020. On a startup’s money.'; d.who = has('ayaan') ? 'ayaan' : d.who; }
      var meridianLag = S.mer ? ' · Meridian sees it first: lands in 7 days' : '';
      var needTxt = function () { return r.C >= relevantNeed() ? ' · keeps the world reading you' : ' · too small to keep the world reading you (needs at least ' + sci(relevantNeed()) + ')'; };
      var pubTxt = function () { return 'Trust ' + Math.round(S.rep) + ' → ' + Math.min(100, Math.round(S.rep + repGain(r))) + needTxt() + ' · the labs copy it within ' + CFG.rivalSlideDelay + ' days · scandal risk ' + pct(scandalRisk(r, false)) + meridianLag; };
      if (S.flags.firstAuthor) {
        d.body += ' You promised Priya first author: this one is published as Raman et al.';
        d.options.push({ key: 'publish', label: 'Publish (Raman et al.)', primary: true, effect: pubTxt, fn: function () { publish(r); } });
        if (hasRole('evals') && !r.redteamed) d.options.push({ key: 'redteam', label: 'Safety-test first, then publish', effect: function () { return 'Lena breaks it for ' + (S.api ? CFG.redTeamDaysApi : CFG.redTeamDays) + ' days, then you publish with no scandal risk'; }, fn: function () { startRedteam(r); } });
        decide(d); return;
      }
      d.options.push({ key: 'publish', label: 'Publish the paper', primary: true, effect: pubTxt, fn: function () { publish(r); } });
      var tier = shipTier(r), shipWhy = S.day < CFG.apiDay ? 'Shipping opens with the API market on 11 Jun 2020' : !tier ? 'Needs at least paragraphs to sell' : null;
      d.options.push({ key: 'ship', label: S.api ? 'Ship it (replaces the API model)' : 'Ship it as an API', disabled: !!shipWhy, why: shipWhy,
        effect: function () { return shipWhy || ('+' + money(shipRev(r)) + ' a month coming in · ' + servingFor() + ' cards serve developers instead of training · scandal risk ' + pct(scandalRisk(r, true)) + meridianLag); },
        fn: function () { ship(r); } });
      if (hasRole('evals') && !r.redteamed) d.options.push({ key: 'redteam', label: 'Safety-test first, then publish', effect: function () { return (person('lena') ? 'Lena' : 'Evals') + ' breaks it for ' + (S.api ? CFG.redTeamDaysApi : CFG.redTeamDays) + ' days, then you choose with no scandal risk'; }, fn: function () { startRedteam(r); } });
      d.options.push({ key: 'private', label: 'Keep it private', effect: function () { return 'Still counts for investors; the world sees a tenth of it. No risk, no trust.'; }, fn: function () { r.private = true; } });
      decide(d);
    }
    function publish(r) {
      var go = function () { applyPublish(r); };
      if (S.mer) { r.pendingPublic = 'publish'; S.events.push({ day: Math.floor(S.day) + CFG.meridian.firstLook, fn: go }); voice('lab', 'Meridian has first look at run ' + r.id + '. The paper goes out on ' + fmtDate(Math.floor(S.day) + CFG.meridian.firstLook) + '.', 'info'); }
      else go();
    }
    function applyPublish(r) {
      r.pendingPublic = null; r.published = true; r.private = false; r.pubDay = S.day;
      var g = repGain(r); S.rep = clamp(S.rep + g, 0, 100);
      (r.caps || []).forEach(function (id) { S.flags['pub_' + id] = true; });
      S.lastPublishDay = S.day; S.stats.published++;
      var fa = S.flags.firstAuthor; if (fa) { S.flags.firstAuthor = false; r.author = 'Raman et al.'; moodAdd(person('priya'), CFG.firstAuthorMood); }
      staff().forEach(function (p) { if (p.ego >= 3 && !(fa && p.key === 'priya')) moodAdd(p, CFG.publishMood); });
      if (r.C >= relevantNeed()) refreshRelevance('published run ' + r.id);
      var C = r.C;
      S.events.push({ day: Math.floor(S.day) + CFG.rivalSlideDelay, fn: function () {
        S.rivals.forEach(function (rv) { var c = rivalC(rv, S.day); if (c < C) rv.extra += CFG.rivalSlideExp * log10(C / c); });
      } });
      var risk = scandalRisk(r, false);
      if (risk > 0 && rng() < risk) { var leak = (r.caps || []).filter(function (id) { return capById(id).contaminated; })[0]; scheduleScandal(r, leak || 'generic'); }
      voice('lab', 'Run ' + r.id + ' is published' + (r.author ? ' as ' + r.author : '') + '. Trust +' + g + '.', 'good');
      emit({ type: 'publish', run: r });
    }
    function ship(r) {
      var go = function () { applyShip(r); };
      if (S.mer) { r.pendingPublic = 'ship'; S.events.push({ day: Math.floor(S.day) + CFG.meridian.firstLook, fn: go }); voice('lab', 'Meridian has first look. The API opens on ' + fmtDate(Math.floor(S.day) + CFG.meridian.firstLook) + '.', 'info'); }
      else go();
    }
    function applyShip(r) {
      r.pendingPublic = null;
      if (S.api) { var old = runById(S.api.runId); if (old) old.shipped = false; }
      r.shipped = true; r.private = false; milestone('api', 'Your API is live: ' + money(shipRev(r)) + ' a month coming in');
      S.api = { runId: r.id, rev: shipRev(r), tier: shipTier(r), since: S.day };
      refreshServing();
      S.rep = clamp(S.rep + CFG.repShip, 0, 100); S.stats.shipped++;
      if (r.C >= relevantNeed()) refreshRelevance('shipped run ' + r.id);
      if (scandalRisk(r, true) > 0 && rng() < scandalRisk(r, true)) scheduleScandal(r, 'ship');
      voice('lab', 'Run ' + r.id + ' is live as an API: ' + money(S.api.rev) + ' a month. ' + S.serving.n + ' cards now answer developers instead of training.', 'good');
      emit({ type: 'ship', run: r });
    }
    function startRedteam(r) {
      var days = S.api ? CFG.redTeamDaysApi : CFG.redTeamDays;
      S.redteam = { runId: r.id, until: Math.floor(S.day) + days, start: S.day }; r.redteaming = true;
      var who = person('lena') ? 'lena' : staff().filter(function (p) { return p.role === 'evals'; })[0].key;
      voice(who, 'Give me ' + days + ' days.');
    }
    function scheduleScandal(r, what) { S.events.push({ day: Math.floor(S.day + U(CFG.scandalDelay[0], CFG.scandalDelay[1])), fn: function () { scandal(r, what); } }); }
    function scandal(r, what) {
      S.stats.scandals++;
      var hitRep = Math.round(CFG.repScandal * (0.4 + 0.6 * Math.min(1, reach(r.C)))); r.scandalRep = hitRep;
      S.rep = clamp(S.rep - hitRep, 0, 100);
      S.termBlockUntil = Math.max(S.termBlockUntil, S.day + CFG.scandalBlockDays);
      var pulled = false; if (S.api && (what === 'ship' || S.api.runId === r.id)) { S.api = null; refreshServing(); pulled = true; }
      ['priya', 'lena'].forEach(function (k) { moodAdd(person(k), -CFG.scandalMood, 'the scandal'); });
      r.scandal = WORLD.scandal[what] || WORLD.scandal.generic;
      decide({ kind: 'scandal', from: 'THE PRESS', title: 'Scandal over run ' + r.id, body: r.scandal + ' Trust −' + hitRep + '. No term sheets for 90 days' + (pulled ? '; the API is pulled.' : '.') + (hasRole('evals') ? '' : ' Nobody red-teamed it.'),
        options: [{ key: 'ok', label: 'Ride it out', primary: true, fn: function () {} }] });
    }

    /* ---------------- data jobs ---------------- */
    function canFilter() {
      if (S.data.job) return { ok: false, msg: 'Cleaning the crawl is already running.' };
      if (!hasRole('data')) return { ok: false, msg: 'Nobody on the team can clean the crawl.' };
      if (S.bank < filterCost()) return { ok: false, msg: 'Not enough cash (' + money(filterCost()) + ').' };
      return { ok: true };
    }
    function startFilter() {
      var c = canFilter(); if (!c.ok) return c;
      var cost = filterCost(), days = filterDays();
      cash('filter', -cost); S.ledger.push({ day: S.day, what: 'Clean the crawl #' + (S.data.filters + 1), amt: -cost });
      var who = staff().filter(function (p) { return p.role === 'data'; })[0];
      S.data.job = { start: S.day, end: Math.floor(S.day) + days, cost: cost, who: who.key };
      voice(who.key, days === CFG.filterDaysPair ? 'Seventeen days, with Ines on the cluster.' : 'A month. I’ll tell you when it’s clean.');
      emit({ type: 'data' });
      return { ok: true };
    }
    function finishFilter() {
      var j = S.data.job; S.data.job = null;
      S.data.W *= CFG.filterMult; S.data.filters++; S.stats.filters++;
      S.data.lo *= CFG.filterMult; S.data.hi *= CFG.filterMult;
      voice(j.who, WORLD.say.filterDone, 'data');
      emit({ type: 'data' });
    }

    /* ---------------- decisions ---------------- */
    function decide(d) {
      d.id = ++seq; d.day = S.day;
      if (S.pending) S.queue.push(d); else S.pending = d;
      emit({ type: 'decision', decision: d });
      return d;
    }
    function answer(id, key) {
      var d = S.pending; if (!d) return { ok: false, msg: 'No decision is waiting.' };
      if (id != null && d.id !== id) return { ok: false, msg: 'That decision is not the one on screen.' };
      var o = null; d.options.forEach(function (x) { if (x.key === key) o = x; });
      if (!o) o = d.options.filter(function (x) { return !x.disabled; })[0];
      if (!o || o.disabled) return { ok: false, msg: 'That choice is not available.' };
      S.pending = null;
      d.answer = o.key; d.answerLabel = o.label; d.answeredDay = S.day;
      S.decided.unshift({ id: d.id, day: d.day, kind: d.kind, title: d.title, from: d.from, who: d.who, answer: o.label });
      if (S.decided.length > 60) S.decided.length = 60;
      try { o.fn(); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
      if (!S.over) {
        if (d.kind === 'land' || d.kind === 'scandal') checkTerms();
        if (!S.pending && S.queue.length) { S.pending = S.queue.shift(); }
      }
      emit({ type: 'answered', decision: d, key: o.key });
      return { ok: true };
    }

    /* ---------------- hiring ---------------- */
    function hireEffect(key) { var d = WORLD.people[key]; var sal = (key === 'ayaan' && S.day >= CFG.apiDay) ? d.salaryLate : d.salary; return { salary: sal }; }
    function knock(key, late) {
      var d = WORLD.people[key]; if (!d || has(key)) return;
      var sal = hireEffect(key).salary;
      var c = { key: key, from: S.day, until: Math.floor(S.day) + CFG.candidateWindow, salary: sal, to: key === 'sunhee' ? 'halcyon' : 'kestrel', late: !!late };
      S.candidates = S.candidates.filter(function (x) { return x.key !== key; }); S.candidates.push(c); S.knocked[key] = true;
      var pitch = d.pitch; if (key === 'rafael' && !has('dev')) pitch = 'Heard you need someone who can split a model across cards. I split them across hundreds. I cost more.';
      if (late) pitch = 'GPT-3 proved me right. I\u2019m expensive now.';
      // hiring never stops the clock: the candidate waits on the board, courted by a rival, until you hire or they go
      voice(key, pitch, 'knock');
      emit({ type: 'candidate', cand: c });
    }
    function hire(key) {
      if (has(key)) return { ok: false, msg: 'Already on the team.' };
      var c = null; S.candidates.forEach(function (x) { if (x.key === key) c = x; });
      if (!c) return { ok: false, msg: 'Not on the hiring board.' };
      var p = addPerson(key); p.salary = c.salary;
      voice(key, { dev: 'Good. Send me the configs.', ayaan: 'You won’t regret it. Bigger.', tom: 'First thing: alerts that wake me, not you.', rafael: 'Let’s see how big this gets.', lena: 'I’ll start by breaking the last checkpoint.', sunhee: 'Give me thirty days. Then watch the dots.', ines: 'Where’s the cluster?', kofi: 'I’ll have the restarter in by Friday.' }[key] || 'In.');
      emit({ type: 'team' });
      return { ok: true };
    }

    /* ---------------- rivals ---------------- */
    function rivalC(rv, day) { return Math.min(rv.cap, rv.c0 * Math.pow(10, rv.jit + rv.extra + (day / 30.44) / rv.tau)); }
    function rivalPublish(rv) {
      var C = rivalC(rv, S.day), L = Lline(C) * rv.offset * (S.flags.optTrick ? CFG.optBend : 1), N = C / (6 * Dopt(C));
      var prev = rv.pubs[rv.pubs.length - 1];
      if (prev && C < prev.C * 1.15) return;
      rv.pubs.push({ day: S.day, C: C, L: L, N: N });
      S.feed.unshift({ day: S.day, who: rv.key, name: rv.name, role: 'rival', text: rv.name + ' publishes a ' + sizeWord(N) + ' model: ' + (shortOf(C) <= 1.05 ? 'it matches GPT-3.' : ratioWord(shortOf(C)) + ' short of GPT-3, error score ' + L.toFixed(2) + '.'), kind: 'rival' });
      emit({ type: 'rival', rival: rv });
    }

    /* ---------------- raising ---------------- */
    function marketOpen(day) { day = day == null ? S.day : day; return !(day >= CFG.crashDay && day < CFG.marketOpenDay) && day >= S.termBlockUntil; }
    function proofA() {
      var ok = S.runs.filter(function (r) { return r.clean && r.onLine && r.landDay >= CFG.seriesA.fromDay; });
      var far = 0; ok.forEach(function (r) { if (r.C > far) far = r.C; });
      if (far < Math.max(CFG.seriesA.needC, S.raise.aNeed)) return false;
      return ok.some(function (r) { return log10(far / r.C) >= CFG.seriesA.decades * 0.98; });
    }
    function proofB() { return S.raise.aDone && S.runs.some(function (r) { return r.clean && r.C >= CFG.seriesB.needC && r.landDay >= CFG.seriesB.fromDay; }); }
    function termsA() { return S.day < CFG.crashDay ? CFG.seriesA.pre : CFG.seriesA.after; }
    function raiseStatus() {
      var A = termsA(), B = CFG.seriesB, post = S.api ? B.postApi : B.post;
      return {
        marketOpen: marketOpen(), blockedUntil: S.termBlockUntil > S.day ? S.termBlockUntil : 0,
        a: { done: S.raise.aDone, proof: proofA(), cash: A.cash, post: A.post, need: Math.max(CFG.seriesA.needC, S.raise.aNeed), pending: !!S.raise.aPending },
        b: { done: S.raise.bDone, proof: proofB(), cash: B.cash, post: post, pending: !!S.raise.bPending }
      };
    }
    function checkTerms() {
      if (S.over || !marketOpen()) return;
      if (!S.raise.aDone && !S.raise.aPending && proofA()) offerTerm('A');
      else if (S.raise.aDone && !S.raise.bDone && !S.raise.bPending && S.day >= CFG.seriesB.fromDay && proofB()) offerTerm('B');
    }
    function offerTerm(round) {
      var A = round === 'A', R = roundTerms(round), T = { cash: R.cash, post: R.post };
      var newStake = S.stake * (1 - T.cash / T.post);
      if (A) S.raise.aPending = true; else S.raise.bPending = true;
      var lead = A ? WORLD.fictional.seriesA : WORLD.fictional.seriesB;
      decide({ kind: 'term', round: round, from: lead, title: 'Series ' + round + ': ' + money(T.cash) + ' at a ' + money(T.post) + ' post',
        voice: A ? (S.day < CFG.crashDay ? 'Two dots, one line, a decade apart. We’ve seen enough. Sign before the market changes its mind.' : 'We said June. Everybody wants an AI lab now, so the price went up. For us, not for you.') : (S.api ? 'A model people pay for, and a dot near the frontier. Let’s make it bigger.' : 'A dot near the frontier. Let’s make it bigger.'),
        body: 'You own ' + pct(S.stake) + ' today.' + (R.factor < 1 ? ' Investors can smell the clock: under 6 months until broke, the price is cut to ' + Math.round(R.factor * 100) + '%.' : '') + ' ' + (newStake < CFG.boardBelow ? 'This takes you under 50%: the board will sell the company to the next bidder.' : 'Below 50% the board controls the company.'),
        options: [
          { key: 'sign', label: 'Sign it', primary: true, effect: function () { return '+' + money(T.cash) + ' · ' + runwayPair({ bank: T.cash }) + ' · you own ' + pct(S.stake) + ' → ' + pct(S.stake * (1 - T.cash / T.post)); },
            fn: function () { cash('raise', T.cash); S.stake *= (1 - T.cash / T.post); S.post = T.post; S.ledger.push({ day: S.day, what: 'Series ' + round + ' (' + lead + ')', amt: T.cash }); if (A) { S.raise.aDone = true; S.raise.aPending = false; S.raise.aRound = T; } else { S.raise.bDone = true; S.raise.bPending = false; } voice('lab', 'Series ' + round + ' closed: ' + money(T.cash) + '.', 'good'); milestone('round', 'Series ' + round + ' closed: ' + money(T.cash) + ' in the bank'); } },
          { key: 'pass', label: 'Pass', effect: function () { return A ? 'Next time they want a dot three times further out (' + sci(farthestClean() * CFG.seriesA.passMult) + ').' : 'No Series B this year.'; },
            fn: function () { if (A) { S.raise.aPending = false; S.raise.aNeed = farthestClean() * CFG.seriesA.passMult; } else { S.raise.bPending = false; S.raise.bDone = true; S.raise.bPassed = true; } } }
        ] });
    }
    function raiseNow(round) {
      round = String(round || (S.raise.aDone ? 'B' : 'A')).toUpperCase().replace('SERIES', '').trim();
      if (S.pending) return { ok: false, msg: 'Answer the decision on screen first.' };
      var st = roundStatus();
      if (round === 'A' && S.raise.aDone) return { ok: false, msg: 'Series A is done.' };
      if (round === 'B' && !S.raise.aDone) return { ok: false, msg: 'Series A first.' };
      if (round === 'B' && S.raise.bDone) return { ok: false, msg: 'No Series B available.' };
      if (round !== 'A' && round !== 'B') return { ok: false, msg: 'Unknown round.' };
      if (st.next !== round || !st.legal) return { ok: false, msg: st.why[0] || 'Not yet.' };
      offerTerm(round); return { ok: true };
    }

    /* ---------------- cards: rent, buy, Meridian, rent-out ---------------- */
    function rentQuote(n) {
      n = Math.max(CFG.rent.block, Math.round((n || CFG.rent.block) / CFG.rent.block) * CFG.rent.block);
      var price = rentPrice(S.day), monthly = n * price * 24 * 30.4;
      var why = null;
      if (S.mer) why = 'Meridian: exclusive. No other cloud.';
      else if (rentedAll() + n > rentCap(S.day)) why = 'The broker has ' + Math.max(0, rentCap(S.day) - rentedAll()) + ' more cards for you right now.';
      else if (S.day >= CFG.apiDay && S.rentedMonth + n > CFG.rent.afterApiMonthly) why = 'Capacity is gone after the API: 64 a month at most.';
      return { n: n, price: price, monthly: monthly, why: why, live: Math.floor(S.day) + 1, end: Math.floor(S.day) + 1 + CFG.rent.termDays };
    }
    function rent(n) {
      var q = rentQuote(n); if (q.why) return { ok: false, msg: q.why };
      S.rentals.push({ id: 'r' + (++seq), n: q.n, price: q.price, start: q.live, end: q.end, renewAsked: false });
      if (S.day >= CFG.apiDay) S.rentedMonth += q.n;
      S.ledger.push({ day: S.day, what: 'Rented ' + q.n + ' V100s for 90 days at $' + q.price.toFixed(2) + '/h', amt: 0 });
      voice('lab', q.n + ' V100s rented: live tomorrow, back on ' + fmtDate(q.end) + '.', 'info');
      emit({ type: 'cluster' });
      return { ok: true };
    }
    function renewQuote(id) {
      var r = null; S.rentals.forEach(function (x) { if (x.id === id) r = x; }); if (!r) return { why: 'No such rental.' };
      var why = null;
      if (S.mer) why = 'Meridian: exclusive. No renewals.';
      else if (r.end - S.day > CFG.rent.renewWindow) why = 'Renewals open 30 days before ' + fmtDate(r.end) + '.';
      else if (r.refused) why = 'Capacity unavailable. They go back on ' + fmtDate(r.end) + '.';
      var price = rentPrice(S.day);
      return { r: r, why: why, price: price, monthly: r.n * price * 24 * 30.4, to: r.end + CFG.rent.termDays };
    }
    function renew(id) {
      var q = renewQuote(id); if (q.why) return { ok: false, msg: q.why };
      q.r.end += CFG.rent.termDays; q.r.price = q.price; q.r.renewed = (q.r.renewed || 0) + 1;
      voice('lab', q.r.n + ' V100s renewed to ' + fmtDate(q.r.end) + ' at $' + q.price.toFixed(2) + '/h.', 'info');
      emit({ type: 'cluster' });
      return { ok: true };
    }
    function buyQuote(item) {
      var sp = CFG.buy[item]; if (!sp) return { why: 'Unknown item.' };
      var post = S.day >= CFG.apiDay, covid = S.day >= CFG.covidOrderFrom && S.day <= CFG.covidOrderTo;
      var price = Math.round(sp.price * (post ? CFG.afterApiPriceMult : 1));
      var lead = sp.lead + (covid ? CFG.covidOrderExtra : 0) + (post ? CFG.afterApiLeadExtra : 0);
      var why = null;
      if (S.day < sp.from) why = 'Not announced yet.';
      else if (S.bank < price) why = 'Not enough cash.';
      var arrive = Math.floor(S.day) + lead;
      return { item: item, label: sp.label, n: sp.n, type: sp.type, price: price, lead: lead, arrive: arrive, late: arrive >= CFG.endDay, why: why, covid: covid, post: post };
    }
    function buy(item) {
      var m = { dgx1: ['v100', 1], pod: ['v100', 8], dgxa: ['a100', 1], poda: ['a100', 8] }[item];
      if (!m) return { ok: false, msg: 'Unknown item.' };
      return buyUnits(m[0], m[1]);
    }
    function rentOutQuote() {
      var n = Math.floor(S.owned.v100 * CFG.rentOut.share / 8) * 8;
      var why = null;
      if (S.lent && S.day < S.lent.until) why = 'Already lent until ' + fmtDate(S.lent.until) + '.';
      else if (S.owned.v100 < CFG.rentOut.minOwned) why = 'You need at least 16 owned V100s.';
      return { n: n, cash: n * CFG.rentOut.perHour * 24 * CFG.rentOut.days, why: why, busy: S.active.some(function (r) { return r.pool === 'office'; }) };
    }
    function rentOut() {
      var q = rentOutQuote(); if (q.why) return { ok: false, msg: q.why };
      cash('rentout', q.cash); S.lent = { n: q.n, until: Math.floor(S.day) + CFG.rentOut.days }; S.stats.rentOut += q.cash;
      S.ledger.push({ day: S.day, what: 'Rented out ' + q.n + ' office V100s for 30 days', amt: q.cash });
      voice('lab', q.n + ' office V100s lent to the broker until ' + fmtDate(S.lent.until) + ': +' + money(q.cash) + '.', 'good');
      emit({ type: 'cluster' });
      return { ok: true };
    }
    function meridianOffer(second) {
      var M = CFG.meridian, n = second ? M.second.cards : M.cards;
      S.flags[second ? 'mer2Offered' : 'merOffered'] = true;
      decide({ kind: 'meridian', from: WORLD.fictional.meridian, title: second ? 'Meridian, again: ' + n + ' V100s for 10% of FRONTIER' : 'Meridian: $50M in compute credits',
        voice: second ? n + ' V100s, ready in ' + Math.round(M.lead / 7) + ' weeks, for ten percent of FRONTIER. This is the last time we ask.' : '$50M in compute credits: ' + n.toLocaleString('en-US') + ' V100s reserved for you, ready in ' + Math.round(M.lead / 7) + ' weeks. Our cloud only. We see every checkpoint first.',
        body: 'Exclusive: no broker cloud (rentals run out, no renewals). First look: every publish or ship waits 7 days. No open weights. From 11 Jun its queue gives labs that fall behind fewer cards.',
        options: [
          { key: 'sign', label: 'Sign with Meridian', primary: true, effect: function () { return '+' + n.toLocaleString('en-US') + ' V100s live ' + fmtDate(Math.floor(S.day) + M.lead) + ' (×' + Math.round(n * CFG.flops.v100 / Math.max(1, totalFlops())) + ' your compute today)' + (second ? ' · stake ' + pct(S.stake) + ' → ' + pct(S.stake * M.second.stakeMult) : ' · paid from credits, not your bank'); },
            fn: function () { S.mer = { cards: n, live: Math.floor(S.day) + M.lead, alloc: n, credits: second ? M.credits / 2 : M.credits, second: !!second, signed: S.day }; if (second) S.stake *= M.second.stakeMult; S.events.push({ day: S.mer.live, fn: function () { voice('lab', WORLD.say.meridianLive.replace('1,024', n.toLocaleString('en-US')), 'good'); emit({ type: 'cluster' }); } }); voice('lab', 'Meridian signed. ' + n + ' V100s go live on ' + fmtDate(S.mer.live) + '.', 'info'); } },
          { key: 'pass', label: 'Stay independent', effect: function () { return second ? 'No more offers this year.' : 'They’ll come back after 15 Jun with a worse deal.'; }, fn: function () { if (!second) S.flags.merPassed = true; } }
        ] });
    }

    /* ---------------- relevance and endings ---------------- */
    function refreshRelevance(why) { S.relevance.deadline = Math.max(S.relevance.deadline, Math.floor(S.day) + CFG.relevanceWindow); S.relevance.since = S.day; S.relevance.why = why; S.relevance.warned = false; }
    function score() {
      var b = bestClean(), sc = CFG.score;
      var model = b ? Math.round(sc.modelMax * clamp(1 + log10(b.C / CFG.gpt3C) / sc.modelSpanDecades, 0, 1.1)) : 0;
      var mir = S.miracle ? sc.miracle : 0;
      var rep = Math.round(S.rep), rev = Math.round(S.stats.revenue / sc.revenuePer), ppl = staff().length * sc.perPerson;
      return { model: model, miracle: mir, rep: rep, revenue: rev, people: ppl, total: model + mir + rep + rev + ppl, best: b ? { C: b.C, L: b.L, id: b.id } : null };
    }
    function endYear(kind, info) {
      if (S.over) return;
      info = info || {};
      var W = WORLD.ends, reason;
      if (kind === 'bankrupt') reason = fill(W.bankrupt, { date: fmtDate(S.day, true), pay: money(info.pay), bank: money(info.pay + S.bank), burn: money(burn()), rent: rentMonthly() > 0 ? fill(W.bankruptRent, { rent: money(rentMonthly()) }) : '' });
      else if (kind === 'acquired') reason = info.board ? fill(W.acquiredBoard, { stake: pct(S.stake), price: money(info.price), date: fmtDate(S.day, true) }) : fill(W.acquired, { price: money(info.price), runway: months(runway()) + ' months' });
      else if (kind === 'forgotten') reason = S.relevance.since != null ? fill(W.forgotten, { since: fmtDate(S.relevance.since, true), need: sci(relevantNeed()), date: fmtDate(S.day, true) }) : fill(W.forgottenNone, { need: sci(relevantNeed()), date: fmtDate(S.day, true) });
      else reason = fill(W.survived, { cash: money(S.bank), people: plural(staff().length, 'person') + ' on the team' });
      var sc = score(), b = sc.best;
      var gap = !b ? 'You never saved a clean model.' : S.miracle ? 'Your best saved model matched GPT-3: the miracle.' : 'Your best saved model was ' + (b.C < CFG.gpt3C ? (CFG.gpt3C / b.C >= 10 ? Math.round(CFG.gpt3C / b.C).toLocaleString('en-US') : (CFG.gpt3C / b.C).toFixed(1)) + '× short of GPT-3 (error score ' + b.L.toFixed(2) + ' against its 1.76).' : 'past GPT-3’s compute' + (b.L > CFG.gpt3L * CFG.miracleTol ? ', but with a worse error score.' : '.'));
      S.over = { kind: kind, day: S.day, date: fmtDate(Math.min(S.day, 365), true), reason: reason, gap: gap, score: sc };
      S.pending = null; S.queue = []; S.paused = true;
      emit({ type: 'end', over: S.over });
    }

    /* ---------------- the calendar ---------------- */
    var NEWS = WORLD.news.map(function (n) { return { day: iso(n[0]), text: n[1], fx: n[2], note: n[3], iso: n[0] }; });
    function onNewDay(n) {
      // 1. payday
      if (dom(n) === 1 && n > 0) payday(n);
      if (S.over) return;
      // 2. scheduled events
      var due = S.events.filter(function (e) { return e.day <= n; }); S.events = S.events.filter(function (e) { return e.day > n; });
      due.forEach(function (e) { try { e.fn(); } catch (er) { if (typeof console !== 'undefined') console.error(er); } });
      if (S.over) return;
      // 3. hardware and rentals
      S.orders = S.orders.filter(function (o) { if (n >= o.arrive) { S.owned[o.type] += o.n; voice('lab', fill(WORLD.say.orderIn, { n: o.n, type: o.type.toUpperCase() }), 'good'); emit({ type: 'cluster' }); return false; } return true; });
      S.rentals = S.rentals.filter(function (r) {
        if (n >= r.end) { voice('lab', fill(WORLD.say.rentalEnd, { n: r.n }), S.active.some(function (x) { return x.pool === 'cloud'; }) ? 'warn' : 'info'); emit({ type: 'cluster' }); return false; }
        if (!r.renewAsked && r.end - n <= CFG.rent.renewWindow && !S.mer) { r.renewAsked = true; if (n >= CFG.apiDay && rng() < CFG.rent.renewRefuseAfterApi) r.refused = true; voice('lab', 'Broker: your ' + r.n + ' V100s go back on ' + fmtDate(r.end) + '.' + (r.refused ? ' Capacity unavailable: no renewal.' : ' Renew them under Rent cards.'), 'info'); }
        return true;
      });
      if (S.lent && n >= S.lent.until) { S.lent = null; emit({ type: 'cluster' }); }
      if (S.api) refreshServing();
      // 4. jobs
      if (S.data.job && n >= S.data.job.end) finishFilter();
      if (S.redteam && n >= S.redteam.until) { var rr = runById(S.redteam.runId); S.redteam = null; if (rr) { rr.redteaming = false; rr.redteamed = true; queueLanding(rr, true); } }
      // 5. the world
      NEWS.forEach(function (ne) { if (ne.day === n && S.newsFired.indexOf(ne.iso) < 0) fireNews(ne); });
      S.rivals.forEach(function (rv) { if (n >= rv.nextPub) { rivalPublish(rv); rv.nextPub = n + rv.period * U(0.7, 1.3); } });
      // 6. candidates
      W_ORDER.forEach(function (key) { if (!S.knocked[key] && knockDue(key, n)) knock(key); });
      if (!has('ayaan') && S.knocked.ayaan && !S.flags.ayaanLate && n >= CFG.apiDay + 5 && !S.candidates.some(function (c) { return c.key === 'ayaan'; }) && !S.team.some(function (p) { return p.key === 'ayaan'; })) { S.flags.ayaanLate = true; knock('ayaan', true); }
      S.candidates = S.candidates.filter(function (c) {
        if (n > c.until) { var rv = rival(c.to); if (rv) { rv.extra += CFG.rivalPassBoost; rv.people.push(WORLD.people[c.key].first); } voice('lab', WORLD.people[c.key].first + ' joined ' + (rv ? rv.name : 'a rival') + '.', 'rival'); return false; }
        return true;
      });
      // 7. letters on the slots
      if (CFG.slots.indexOf(dom(n)) >= 0) slot(n);
      if (n === CFG.demands.december) december();
      // 8. relevance
      if (!S.over && n >= S.relevance.deadline) endYear('forgotten');
      else if (!S.over && S.relevance.deadline - n <= 20 && !S.relevance.warned) { S.relevance.warned = true; voice(has('priya') ? 'priya' : 'lab', 'If we don’t publish or ship something of at least ' + sci(relevantNeed()) + ' by ' + fmtDate(S.relevance.deadline) + ', nobody will remember us.', 'warn'); }
      emit({ type: 'day', day: n });
    }
    var W_ORDER = ['dev', 'ayaan', 'tom', 'rafael', 'lena', 'sunhee', 'ines', 'kofi'];
    function knockDue(key, n) {
      var d = WORLD.people[key]; if (n < d.day) return false;
      if (key === 'sunhee') return S.runs.some(function (r) { return r.clean && r.published && r.C >= CFG.demands.sunheeNeedC; });
      return true;
    }
    function fireNews(ne) {
      S.newsFired.push(ne.iso);
      emit({ type: 'news', news: ne });
      if (ne.fx === 'line') { /* projections tighten via lineKnownMult */ }
      if (ne.fx === 'crash' && !S.raise.aDone) voice('lab', WORLD.fictional.seriesA + ': the market just closed. We’ll talk again in June.', 'warn');
      if (ne.fx === 'gpt3') { S.gpt3Seen = true; voice(has('ayaan') ? 'ayaan' : has('priya') ? 'priya' : 'lab', has('ayaan') ? WORLD.say.toldYou + ' ' + WORLD.say.gpt3 : WORLD.say.gpt3); }
    }
    function slot(n) {
      // Meridian
      if (!S.mer && !S.flags.merOffered && n >= CFG.meridian.fromDay && farthestClean() >= CFG.meridian.needC) meridianOffer(false);
      else if (!S.mer && S.flags.merPassed && !S.flags.mer2Offered && n >= CFG.meridian.second.fromDay) meridianOffer(true);
      checkTerms();
      demands(n);
      if (n >= CFG.poachFrom && staff().length >= CFG.poachMinPeople && S.monthPoached !== monthIdx(n) && rng() < CFG.poachChance) poach(n);
      raiseAsks(n);
      openWeights(n);
    }
    function poach(n) {
      S.monthPoached = monthIdx(n);
      var target = staff().slice().sort(function (a, b) { return a.mood - b.mood; })[0]; if (!target) return;
      var rv = rival(monthIdx(n) % 2 === 1 ? 'halcyon' : 'kestrel');
      var raise = n >= CFG.counterRaiseAfter ? Math.round(target.salary * (CFG.counterRaise - 1)) : 0;
      decide({ kind: 'poach', who: target.key, from: rv.name.toUpperCase(), title: rv.name + ' offers ' + target.first + ' double', voice: target.first + ': “' + rv.name + ' called. They’re serious. I’d rather stay, but I have rent too.”', body: target.first + ' (' + target.role + ', morale ' + Math.round(target.mood) + '). If they leave, ' + rv.name + ' gets their work.',
        options: [
          { key: 'counter', label: 'Counter with equity' + (raise ? ' and a raise' : ''), primary: true, effect: function () { return 'You own ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.counterStake) + (raise ? ' · spending ' + burnPair({ salary: raise }) : '') + ' · morale +' + CFG.counterMood; },
            fn: function () { S.stake = Math.max(0, S.stake - CFG.counterStake); target.salary += raise; moodAdd(target, CFG.counterMood); voice(target.key, 'Staying. Thank you.'); } },
          { key: 'let', label: 'Let ' + target.first + ' go', effect: function () { return target.first + ' joins ' + rv.name + ' (they get +0.2 decades of compute)'; }, fn: function () { walk(target, 'poached by ' + rv.name, rv.key); } }
        ] });
    }
    function raiseAsks(n) {
      staff().forEach(function (p) {
        if (p.mood >= CFG.raiseAskBelow || n - p.lastAsk < CFG.raiseAskGap) return;
        p.lastAsk = n;
        var add = Math.round(p.salary * (CFG.raiseMult - 1));
        decide({ kind: 'raise', who: p.key, from: p.name.toUpperCase(), role: p.role, title: p.first + ' asks for a raise', voice: 'I’m tired and I’m underpaid. Twenty percent and I stop reading recruiter emails.', body: 'Morale ' + Math.round(p.mood) + '. At zero, people walk.',
          options: [
            { key: 'yes', label: 'Give the raise', primary: true, effect: function () { return '+' + money(add) + ' a month · ' + runwayPair({ salary: add }) + ' · morale +30'; }, fn: function () { p.salary += add; moodAdd(p, CFG.moods.raiseYes); } },
            { key: 'no', label: 'Not now', effect: function () { return 'Morale −10'; }, fn: function () { moodAdd(p, -CFG.moods.raiseNo, 'no raise'); } }
          ] });
      });
    }
    function demands(n) {
      var pr = person('priya');
      if (pr && n >= CFG.demands.priyaFrom && !S.flags.priyaAsked) {
        S.flags.priyaAsked = true;
        decide({ kind: 'demand', who: 'priya', from: 'PRIYA RAMAN', role: 'data', title: 'Priya wants first author', voice: 'I want first author on our next paper, or I walk.', body: 'She has run every filter and read every sample.',
          options: [
            { key: 'yes', label: 'Agree', primary: true, effect: function () { return 'Your next clean landing is published with her name on it (morale +30 then).'; }, fn: function () { S.flags.firstAuthor = true; voice('priya', 'Thank you. Let’s make it a good one.'); } },
            { key: 'no', label: 'Refuse', effect: function () { return 'She walks: nobody left to clean the crawl without another data person.'; }, fn: function () { walk(pr, 'refused first author'); } }
          ] });
        return;
      }
      var dv = person('dev');
      if (dv && n - dv.joined >= CFG.demands.devAfter && !S.flags.devAsked) {
        S.flags.devAsked = true;
        decide({ kind: 'demand', who: 'dev', from: 'DEV OKAFOR', role: 'systems', title: 'Dev wants equity', voice: 'One percent, or Halcyon gets my parallelism code.', body: 'Without a systems person the memory limit drops back to 1B parameters.',
          options: [
            { key: 'yes', label: 'Give him 1%', primary: true, effect: function () { return 'You own ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.devStake); }, fn: function () { S.stake = Math.max(0, S.stake - CFG.devStake); moodAdd(dv, CFG.moods.devYes); } },
            { key: 'no', label: 'Refuse', effect: function () { return 'He walks to Halcyon.'; }, fn: function () { walk(dv, 'refused equity', 'halcyon'); } }
          ] });
        return;
      }
      var ay = person('ayaan');
      if (ay && n - ay.joined >= CFG.demands.ayaanAfter && !S.flags.ayaanAsked) {
        S.flags.ayaanAsked = true;
        decide({ kind: 'demand', who: 'ayaan', from: 'AYAAN MEHTA', role: 'scaling', title: 'Ayaan wants the whole cluster', voice: 'Whole cluster on one run. All of it. Stop being careful.', body: 'Your next run would use every card in its pool, however big the model.',
          options: [
            { key: 'yes', label: 'Promise him', primary: true, effect: function () { return 'Next run uses every card in its pool · Ayaan morale +15'; }, fn: function () { S.flags.fullCluster = true; } },
            { key: 'no', label: 'Refuse', effect: function () { return 'Ayaan morale −40 (now ' + Math.round(ay.mood) + ')'; }, fn: function () { moodAdd(ay, -CFG.moods.ayaanRefused, 'refused the big run'); } }
          ] });
        return;
      }
      var tm = person('tom');
      if (tm && S.hangsLastMonth >= CFG.tomBreakHangs && (S.flags.tomAskedDay == null || S.flags.tomAskedDay < n - CFG.demands.tomGap)) {
        S.flags.tomAskedDay = n;
        decide({ kind: 'demand', who: 'tom', from: 'TOMASZ WÓJCIK', role: 'infra', title: 'Tom needs a week off', voice: 'I need a week off. I’ve been up every night.', body: S.hangsLastMonth + ' hangs last month.',
          options: [
            { key: 'yes', label: 'Give him the week', primary: true, effect: function () { return '7 days without his restarts'; }, fn: function () { S.flags.tomOffUntil = n + CFG.tomOffDays; moodAdd(tm, CFG.moods.tomOff); } },
            { key: 'no', label: 'Not now', effect: function () { return 'Tom morale −30 (now ' + Math.round(tm.mood) + ')'; }, fn: function () { moodAdd(tm, -CFG.moods.tomRefused, 'burned out'); } }
          ] });
        return;
      }
      var sh = person('sunhee');
      if (sh && n - sh.joined >= CFG.demands.sunheeAfter && !S.flags.sunheeAsked) {
        S.flags.sunheeAsked = true;
        decide({ kind: 'demand', who: 'sunhee', from: 'SUN-HEE PARK', role: 'optimization', title: 'Sun-hee wants to publish her trick', voice: 'I want to publish the schedule trick. It’s mine.', body: 'If she publishes, every rival learns it too.',
          options: [
            { key: 'yes', label: 'Let her publish', primary: true, effect: function () { return 'She stays · in 30 days every rival lands 2.5% lower · trust +5'; }, fn: function () { S.rep = clamp(S.rep + CFG.repSunheeTrick, 0, 100); moodAdd(sh, CFG.moods.sunheeYes); S.events.push({ day: n + 30, fn: function () { S.flags.optTrick = true; S.rivals.forEach(function (rv) { rv.extra += CFG.optTrickDecades; }); voice('lab', 'Every rival is using Sun-hee’s schedule now.', 'rival'); } }); } },
            { key: 'no', label: 'Keep it secret', effect: function () { return 'She walks to Halcyon.'; }, fn: function () { walk(sh, 'kept her trick secret', 'halcyon'); } }
          ] });
      }
    }
    function openWeights(n) {
      if (S.flags.openAsked || n < CFG.demands.openFrom) return;
      if (!S.runs.some(function (r) { return r.clean && r.published && r.C >= CFG.demands.openNeedC; })) return;
      S.flags.openAsked = true;
      var grey = S.mer ? 'Meridian: no.' : S.stake < CFG.boardBelow ? 'The board: no.' : null;
      decide({ kind: 'open', from: WORLD.fictional.field.toUpperCase(), title: 'Grad students want your weights', voice: 'Your paper is great. Can we have the weights? We’ll cite you forever.', body: 'Opening the weights wins people and reputation, and hands rivals your work.',
        options: [
          { key: 'open', label: 'Open the weights', primary: !grey, disabled: !!grey, why: grey, effect: function () { return grey || ('Trust +' + CFG.repOpen + ' · Ines and Kofi knock early · Kestrel and Northwind fine-tune it within a week'); },
            fn: function () { S.rep = clamp(S.rep + CFG.repOpen, 0, 100); S.flags.opened = true; S.openedDay = S.day; var k = rival('kestrel'), nw = rival('northwind'); S.events.push({ day: n + 7, fn: function () { k.extra += CFG.rivalOpenKestrel; nw.extra += CFG.rivalOpenNorthwind; } }); ['ines', 'kofi'].forEach(function (key) { if (!S.knocked[key]) S.events.push({ day: n + 3, fn: function () { if (!S.knocked[key]) knock(key); } }); }); } },
          { key: 'closed', label: 'Keep them closed', primary: !!grey, effect: function () { return 'Northwind’s weights get the citations instead.'; }, fn: function () {} }
        ] });
    }
    function december() {
      var p = person('priya'); if (!p) return;
      var others = staff().filter(function (x) { return x !== p && (x.role === 'evals' || x.role === 'infra' || x.role === 'data'); }).slice(0, 2);
      var names = others.map(function (x) { return x.first; });
      var who = names.length ? names.join(' and ') + ' and I' : 'I';
      decide({ kind: 'december', who: 'priya', from: 'PRIYA RAMAN', role: 'data', title: 'Priya has news', voice: (names.length ? names.join(', ') + ' and I want' : 'I want') + ' to start something safer. We’re telling you first.', body: 'It’s 21 December. ' + (names.length ? who.replace(' and I', '') + ' would go with her.' : 'She would go alone.'),
        options: [
          { key: 'bless', label: 'Let them go, with your blessing', effect: function () { return 'They leave on good terms · trust +5 · ' + (1 + others.length) + ' fewer people at year end'; }, fn: function () { S.rep = clamp(S.rep + CFG.repBlessing, 0, 100); [p].concat(others).forEach(function (x) { walk(x, 'left to start something safer, with your blessing'); }); S.flags.blessing = true; } },
          { key: 'fight', label: 'Fight to keep them', primary: true, effect: function () { return 'They stay, for now · morale −20 each'; }, fn: function () { [p].concat(others).forEach(function (x) { moodAdd(x, -CFG.moods.december, 'stayed against their judgement'); }); } }
        ] });
    }
    function payday(n) {
      var pay = payroll();
      cash('payroll', -pay);
      S.ledger.push({ day: n, what: 'Payroll: ' + plural(staff().length, 'person') + ' + office + upkeep', amt: -pay });
      S.lastPayday = { day: n, pay: pay };
      emit({ type: 'payday', pay: pay, day: n });
      if (S.bank < 0) { endYear('bankrupt', { pay: pay }); return; }
      monthStart(n);
      var rw = runway();
      if (!S.flags.firstPayday && has('priya')) { S.flags.firstPayday = true; voice('priya', fill(WORLD.say.payday, { pay: money(pay), runway: (isFinite(rw) ? months(rw) + ' months' : 'plenty') })); }
      staff().forEach(function (p) {
        if (p.ego >= 4 && n - S.lastPublishDay > CFG.noPaperDays) moodAdd(p, -CFG.noPaperMood, 'no papers');
        if (rw < CFG.lowRunwayMonths) moodAdd(p, -CFG.moodWorried, 'worried about the money');
      });
      if (rw < CFG.lowRunwayMonths) voice('lab', fill(WORLD.say.lowRunway, { m: CFG.lowRunwayMonths }), 'warn');
      if (n - S.lastPublishDay > CFG.repDecayAfter) S.rep = clamp(S.rep - CFG.repDecay, 0, 100);
      S.hangsLastMonth = S.hangsMonth; S.hangsMonth = 0; S.rentedMonth = 0;
      // Meridian's queue
      if (S.mer && n >= CFG.meridian.queueFrom) {
        var fr = frontier(), far = farthestClean(), full = S.mer.cards;
        var alloc = far * CFG.meridian.queueFull >= fr ? full : far * CFG.meridian.queueHalf >= fr ? full / 2 : full / 4;
        if (alloc !== S.mer.alloc) { S.mer.alloc = alloc; voice('lab', alloc === full ? fill(WORLD.say.queueFull, { n: full }) : fill(WORLD.say.queue, { n: alloc, of: full }), alloc === full ? 'good' : 'warn'); }
      }
      if (S.mer) S.mer.credits = Math.max(0, S.mer.credits - S.mer.alloc * CFG.meridian.rate * 24 * 30.4);
      // the API keeps us relevant while its model is
      if (S.api) { var ar = runById(S.api.runId); if (ar && ar.C >= relevantNeed()) refreshRelevance('the API (run ' + ar.id + ')'); }
      // buyouts
      var halc = rival('halcyon'), hc = halc.pubs[halc.pubs.length - 1].C;
      var board = S.stake < CFG.boardBelow;
      if (board && farthestClean() < hc) { acquiOffer(true); return; }
      if (rw < CFG.acquiRunway && n >= CFG.acquiFrom) acquiOffer(board);
    }
    function acquiOffer(forced) {
      var heads = staff().length + 1, price = CFG.acquiPerHead * heads;
      decide({ kind: 'acquire', from: 'HALCYON', title: 'Halcyon wants to buy the team', voice: 'We’ll buy the team: $4M a head, ' + money(price) + ' in all. Your people get rich. FRONTIER disappears.',
        body: forced ? 'You own ' + pct(S.stake) + ', under half. The board has accepted.' : 'Months until broke: ' + months(runway()) + '.',
        options: forced ? [{ key: 'sell', label: 'The board has accepted', primary: true, fn: function () { endYear('acquired', { price: price, board: true }); } }]
          : [{ key: 'sell', label: 'Sell to Halcyon', effect: function () { return 'The year ends: acquired.'; }, fn: function () { endYear('acquired', { price: price }); } },
            { key: 'keep', label: 'Keep going', primary: true, effect: function () { return 'They’ll ask again next payday while you have under 3 months until broke.'; }, fn: function () {} }] });
    }

    /* ---------------- money flow ---------------- */
    function flow(dt) {
      var rent = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) rent += r.n * r.price * 24 * dt; });
      if (rent) { cash('rent', -rent); S.stats.rentSpent += rent; }
      if (S.api) { var rev = S.api.rev / 30.4 * dt; cash('api', rev); S.stats.revenue += rev; }
      if (S.bank < 0 && S.rentals.length) {
        S.rentals = []; voice('lab', WORLD.say.bankZero, 'warn'); emit({ type: 'cluster' });
      }
    }

    /* ---------------- the clock ---------------- */
    // game days per real second right now: speed x 1 day/s, except that a short run pours for at least 4 s at 1x
    // and a hang with nobody on call stays dark at least 1.8 s at any speed, so a name can be woken
    function daysPerSec() {
      var v = CFG.daysPerSec * S.speed;
      S.active.forEach(function (r) {
        if (r.hang && !r.hang.infra) v = Math.min(v, Math.max(0.02, (r.hang.until - r.hang.start) / CFG.hangMinRealSec));
        else if (r.T0 < CFG.minRunRealSec) v = Math.min(v, S.speed * Math.max(0.01, r.T0 / CFG.minRunRealSec));
      });
      return v;
    }
    function rateHint() { return daysPerSec() / (CFG.daysPerSec * S.speed); }
    function advance(dd) {
      var guard = 0;
      while (dd > 1e-9 && !S.pending && !S.over && guard++ < 100000) {
        var next = Math.floor(S.day + 1e-9) + 1;
        var step = Math.min(dd, 0.05, next - S.day);
        S.active.forEach(function (r) { if (r.hang && !r.hang.infra) step = Math.min(step, Math.max(1e-4, r.hang.until - S.day)); });
        stepRuns(step); flow(step);
        S.day += step; dd -= step;
        if (S.day >= next - 1e-9) {
          S.day = next;
          if (next >= CFG.endDay) { endYear('survived'); break; }
          onNewDay(next);
        }
      }
    }
    function tick(realSec) {
      if (S.over || S.pending || S.paused || !S.started) return 0;
      var dd = realSec * daysPerSec();
      advance(dd);
      return dd;
    }

    /* ---------------- actions (the player's verbs, and the bots') ---------------- */
    function act(name, p) {
      p = p || {};
      if (S.over && name !== 'state') return { ok: false, msg: 'The year is over.' };
      switch (name) {
        case 'launch': if (S.pending) return { ok: false, msg: 'Answer the decision on screen first.' }; var res = launch({ params: p.params, tokens: p.tokens, pool: p.pool, gpus: p.gpus }); if (res.ok && !S.started) S.started = true; if (res.ok) S.paused = false; return res;
        case 'starter': return act('launch', { params: CFG.starter.N, tokens: CFG.starter.D, pool: 'office' });
        case 'preset': { var pd = presetDesign(p.days, p.pool); if (!pd) return { ok: false, msg: 'No free cards.' }; var pr = act('launch', pd); if (pr.ok) { S.speed = 1; S.paused = false; } return pr; }
        case 'fits': { var bf = biggestFits(p.pool); if (!bf) return { ok: false, msg: 'Nothing fits.' }; return act('launch', bf); }
        case 'hire': return hire(p.id || p.key);
        case 'rent': return rent(p.gpus || p.n);
        case 'renew': return renew(p.id);
        case 'buy': if (p.box) return buyUnits(p.box, p.units || 1); return buy(p.item);
        case 'rentout': return rentOut();
        case 'raise': return raiseNow(p.round);
        case 'sample': return sampleNow(p.id);
        case 'filter': return startFilter();
        case 'wake': return wake(p.id || p.key);
        case 'stop': {
          var r = p.id != null ? runById(p.id) : mainRun(); if (!r || r.status === 'landed') return { ok: false, msg: 'No run is training.' };
          S.active = S.active.filter(function (x) { return x !== r; }); r.status = 'stopped'; r.stopped = S.day; r.landDay = S.day; r.clean = false; r.aborted = true;
          voice('lab', 'Run ' + r.id + ' stopped at ' + Math.round(100 * r.done / r.C) + '%. Nothing proved.', 'warn'); emit({ type: 'stop', run: r }); return { ok: true };
        }
        case 'publish': case 'ship': case 'keep': case 'private': case 'redteam': {
          var d = S.pending; if (!d || d.kind !== 'land') return { ok: false, msg: 'No landed run is waiting for that choice.' };
          return answer(d.id, name === 'keep' ? 'private' : name);
        }
        case 'answer': return answer(p.id, p.choice);
        case 'speed': S.speed = CFG.speeds.indexOf(+p.x) >= 0 ? +p.x : S.speed; S.paused = false; return { ok: true };
        case 'pause': S.paused = p.on == null ? !S.paused : !!p.on; return { ok: true };
        case 'resume': S.paused = false; if (!S.started) S.started = true; return { ok: true };
        case 'advance': if (!S.started) S.started = true; advance(+p.days || 1); return { ok: true };
        default: return { ok: false, msg: 'Unknown action ' + name };
      }
    }

    /* ---------------- derived numbers for the panels ---------------- */
    function derived() {
      var pf = totalFlops() / CFG.pfDay;
      return {
        date: fmtDate(S.day, true), burn: burn(), runway: runway(), payroll: payroll(), salaries: salaries(), upkeep: upkeep(), rentMonthly: rentMonthly(), api: apiMonthly(),
        pfPerDay: pf, frontier: frontier(), relevantNeed: relevantNeed(), farthestClean: farthestClean(), farthestPublic: farthestPublic(), horizon: horizon(),
        memLimit: memLimit(), pools: POOLS.map(function (k) { return { key: k, name: POOL_NAME[k], type: POOL_TYPE[k], raw: rawPool(k), count: poolCount(k), serving: servingN(k), busy: S.active.reduce(function (t, r) { return t + (r.pool === k ? Math.min(r.cards, poolCount(k)) : 0); }, 0), runId: (S.active.filter(function (r) { return r.pool === k; })[0] || {}).id, flops: poolFlops(k) }; }),
        physical: physicalCards(), rentedLive: rentedLive(), rentedAll: rentedAll(), rentCap: rentCap(S.day), rentPrice: rentPrice(S.day), lent: lentN(),
        wall: wallTokens(), filterCost: filterCost(), filterDays: filterDays(), canFilter: canFilter(), raise: raiseStatus(), marketOpen: marketOpen(),
        runDaysLeft: S.run ? runDaysLeft(S.run) : 0, runRate: S.run ? runRate(S.run) : 0, best: bestClean(), score: score(), rateHint: rateHint(),
        nextPayday: nextPayday(), daysLeft: CFG.endDay - S.day
      };
    }
    function nextPayday() { var d = dateOf(S.day); var nd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); return Math.round((nd - BASE) / 864e5); }

    function state() {
      var dv = derived(), r = mainRun();
      return {
        seed: S.seed, day: +S.day.toFixed(3), date: dv.date, phase: S.over ? 'over' : S.pending ? 'decision' : !S.started ? 'start' : S.paused ? 'paused' : 'running', speed: S.speed, paused: S.paused,
        bank: Math.round(S.bank), burn: Math.round(dv.burn), runway: isFinite(dv.runway) ? +dv.runway.toFixed(2) : null, rep: Math.round(S.rep), stake: +S.stake.toFixed(4), pfPerDay: +dv.pfPerDay.toFixed(3),
        team: staff().map(function (p) { return { id: p.key, role: p.role, salary: p.salary, mood: Math.round(p.mood) }; }),
        gone: S.team.filter(function (p) { return p.gone; }).map(function (p) { return { id: p.key, why: p.why }; }),
        candidates: S.candidates.map(function (c) { return { id: c.key, until: c.until, salary: c.salary }; }),
        cards: { owned: S.owned, rented: dv.rentedAll, rentedLive: dv.rentedLive, orders: S.orders.map(function (o) { return { type: o.type, n: o.n, arrive: o.arrive }; }), meridian: S.mer ? { cards: S.mer.cards, live: S.mer.live, alloc: S.mer.alloc } : null, pools: dv.pools.map(function (p) { return { key: p.key, count: p.count }; }), serving: S.serving },
        active: S.active.map(function (x) { return { id: x.id, pool: x.pool, C: x.C, progress: +(x.done / x.C).toFixed(4), hung: !!x.hang, daysLeft: +runDaysLeft(x).toFixed(2) }; }),
        run: r ? { id: r.id, N: r.N, D: r.D, C: r.C, pool: r.pool, cards: r.cards, progress: +(r.done / r.C).toFixed(4), daysLeft: +dv.runDaysLeft.toFixed(2), hung: !!r.hang, hangs: r.hangs, r: +r.r.toFixed(3) } : null,
        runs: S.runs.map(function (x) { return { id: x.id, C: x.C, N: x.N, D: x.D, L: +(x.L || 0).toFixed(4), clean: x.clean, onLine: x.onLine, caps: x.caps, published: !!x.published, shipped: !!x.shipped, aborted: !!x.aborted, landDay: x.landDay }; }),
        lastSample: S.lastSample ? { text: S.lastSample.text, tier: S.lastSample.tier, fray: S.lastSample.fray, crawl: S.lastSample.crawl, loss: +S.lastSample.loss.toFixed(3) } : null,
        wall: { estLo: S.data.lo, estHi: S.data.hi, tokens: wallTokens(), filters: S.data.filters, job: S.data.job ? { end: S.data.job.end } : null },
        caps: S.caps.map(function (c) { return { id: c.id, fired: !!c.fired, contaminated: !!c.contaminated }; }),
        api: S.api ? { runId: S.api.runId, rev: S.api.rev } : null,
        raise: { aDone: S.raise.aDone, bDone: S.raise.bDone, aNeed: S.raise.aNeed, marketOpen: dv.marketOpen },
        relevance: { deadline: S.relevance.deadline, daysLeft: Math.max(0, Math.ceil(S.relevance.deadline - S.day)), need: dv.relevantNeed },
        frontier: dv.frontier, rivals: S.rivals.map(function (rv) { var p = rv.pubs[rv.pubs.length - 1]; return { name: rv.name, latestC: p.C, people: rv.people.slice() }; }),
        decision: S.pending ? { id: S.pending.id, kind: S.pending.kind, title: S.pending.title, options: S.pending.options.map(function (o) { return { key: o.key, disabled: !!o.disabled }; }) } : null,
        queued: S.queue.length, news: S.newsFired.slice(), miracle: S.miracle,
        over: S.over ? { kind: S.over.kind, reason: S.over.reason, gap: S.over.gap, score: S.over.score.total } : null,
        stats: S.stats
      };
    }

    // the opening is a voice, not a wall of text: Priya speaks first, the ladder carries the goal. Nothing moves until you press go.
    if (!opts.noOpening) voice('priya', fill(WORLD.say.opening, { cash: money(S.bank) }), 'voice');
    // the first hard choice: the broker's 64 cards, right after the first landing is answered (or on 10 Feb if no run ever landed)
    S.events.push({ day: 40, fn: function () { brokerKnock(); } });
    listeners.push(function (ev) { if (ev.type === 'answered' && ev.decision.kind === 'land' && ev.decision.runId === 1) brokerKnock(); });
    function brokerKnock() {
      if (S.flags.brokerKnocked || S.rentals.length || S.over) return; S.flags.brokerKnocked = true;
      var q = rentQuote(64);
      decide({ kind: 'broker', from: WORLD.fictional.broker, title: '64 cards on demand, live tomorrow', voice: '64 V100s, $' + q.price.toFixed(2) + ' an hour, 90 days. Live tomorrow morning. After that the queue is long.',
        body: 'Your 8 cards take about ' + (6 * 1e9 * recipeTokens(1e9) / (8 * CFG.flops.v100)).toFixed(0) + ' days for a billion-parameter model; with 72 it is under two. Cards are where the money goes: this is the first big bet.',
        options: [
          { key: 'rent', label: 'Rent 64 cards', primary: true, effect: function () { return money(q.monthly) + ' a month · spending ' + burnPair({ rent: q.monthly }) + ' · months until broke ' + runwayPair({ rent: q.monthly }) + ' · training speed x' + (1 + 64 / Math.max(1, S.owned.v100)).toFixed(0); }, fn: function () { rent(64); } },
          { key: 'later', label: 'Not now', effect: function () { return 'The broker stays under Rent cards: rent any time.'; }, fn: function () { voice('priya', 'Fine. The market is under Rent cards when you want it.'); } }
        ] });
    }

    /* ---------------- the books: what the lab owns, what it spends, where it stands ---------------- */
    function shortOf(C) { return C > 0 ? CFG.gpt3C / C : null; }
    function bestLoss() { var b = null; S.runs.forEach(function (r) { if (r.clean && (b === null || r.L < b)) b = r.L; }); return b; }
    function lab() {
      var v = S.owned.v100 * CFG.own.v100 + S.owned.a100 * CFG.own.a100;
      S.orders.forEach(function (o) { v += o.n * (o.type === 'a100' ? CFG.own.a100 : CFG.own.v100); });   // paid for counts: the truck is yours
      S.runs.forEach(function (r) { if (r.clean) v += r.C / CFG.flops.v100 * CFG.own.v100Day; });
      return v;
    }
    function burnParts() { var people = salaries(), cards = rentMonthly() + upkeep() + meridianPriority(), office = CFG.base; return { people: people, cards: cards, office: office, api: apiMonthly(), total: people + cards + office }; }
    function meridianPriority() { return 0; }
    function flopsPerDay(training) { return totalFlops(); }
    function rivalBest(rv) { var m = 0; rv.pubs.forEach(function (p) { if (p.day <= S.day && p.C > m) m = p.C; }); return m; }
    // the league table: you and the three labs, ranked by their biggest published or clean result; GPT-3 pinned from 28 May
    function rankings() {
      var rows = [], you = farthestClean();
      rows.push({ key: 'you', name: 'FRONTIER', C: you, you: true });
      S.rivals.forEach(function (rv) { rows.push({ key: rv.key, name: rv.name, C: rivalBest(rv) }); });
      rows.sort(function (a, b) { return b.C - a.C; });
      var snapC = S.snap && S.snap.riv || {};
      rows.forEach(function (r, i) { r.rank = i + 1; r.short = shortOf(r.C); var was = snapC[r.key]; r.was = was == null ? null : was; r.arrow = was == null || was <= 0 ? 0 : r.C > was * 1.001 ? 1 : r.C < was * 0.999 ? -1 : 0; });
      return rows;
    }
    function myRank() { var r = rankings(); for (var i = 0; i < r.length; i++) if (r[i].you) return i + 1; return r.length; }
    function villain() {
      // Northwind is the villain for three slips, then the nearest rival ahead of you (or just behind, if you lead)
      var you = farthestClean(), rows = S.rivals.map(function (rv) { return { rv: rv, C: rivalBest(rv) }; });
      if (S.slipN <= 3) { var nw = rival('northwind'); return { rv: nw, C: rivalBest(nw) }; }
      var ahead = rows.filter(function (x) { return x.C > you; }).sort(function (a, b) { return a.C - b.C; })[0];
      return ahead || rows.sort(function (a, b) { return b.C - a.C; })[0];
    }
    function timesWord(x) { return x >= 10 ? Math.round(x) + '×' : (Math.round(x * 10) / 10 + '').replace(/\.0$/, '') + '×'; }
    function bigPhrase(x) { return x >= 1.95 ? timesWord(x) + ' your biggest' : 'a little bigger than your biggest'; }

    function takeSnap() {
      var riv = {}; S.rivals.forEach(function (rv) { riv[rv.key] = rivalBest(rv); }); riv.you = farthestClean();
      S.snap = { day: S.day, bank: S.bank, runway: runway(), C: farthestClean(), short: shortOf(farthestClean()), lab: lab(), bestL: bestLoss(), rep: S.rep, burn: burn(), riv: riv, rank: myRank(), stake: S.stake };
      S.mlog = {};
    }
    function causeText(cat) {
      var n = rentedLive() || rentedAll();
      return { payroll: 'payroll', rent: n ? 'rent on ' + n + ' cards' : 'card rent', api: 'API revenue', rentout: 'renting out cards', raise: 'the round', buy: 'cards ordered', filter: 'cleaning the crawl' }[cat] || cat;
    }
    function topCauses(delta, log) {
      var cats = Object.keys(log).filter(function (k) { return delta >= 0 ? log[k] > 0 : log[k] < 0; }).sort(function (a, b) { return delta >= 0 ? log[b] - log[a] : log[a] - log[b]; });
      return cats.slice(0, 2).map(causeText).join(', ');
    }
    function milestone(kind, text) { S.mile.push({ kind: kind, day: S.day, text: text }); }
    function nextRungText() { var l = ladder(); var r = l.rungs[l.lit >= 0 ? l.lit : 0]; return r ? r.text + (r.left ? ': ' + r.left : '') : ''; }
    function buildSlip(n) {
      var sn = S.snap, d = S.bank - sn.bank, mon = fmtDate(n).split(' ')[1];
      var l1 = 'Cash ' + (d >= 0 ? 'up ' : 'down ') + money(Math.abs(d)) + (topCauses(d, S.mlog) ? ': ' + topCauses(d, S.mlog) : '');
      var l2, k2 = 'plain', bl = bestLoss(), run = S.run, mi = S.mile.length ? S.mile[0] : null;
      if (mi) { l2 = mi.text; k2 = 'milestone'; }
      else if (bl !== null && sn.bestL !== null && bl < sn.bestL - 0.004) { var br = bestClean(); l2 = 'Error score down ' + (sn.bestL - bl).toFixed(2) + ': run ' + (br ? br.id : '?'); }
      else if (bl !== null && sn.bestL === null) { l2 = 'First saved model: error score ' + bl.toFixed(2) + ' (lower is better)'; }
      else if (run) { var left = runDaysLeft(run); l2 = 'Run ' + run.id + ' is ' + Math.round(100 * run.done / run.C) + '% done' + (isFinite(left) ? ', ' + (left < 1 ? 'under a day' : Math.ceil(left) + ' days') + ' left' : ''); }
      else if (bl !== null) l2 = 'Error score still ' + bl.toFixed(2) + ': no run on the cards';
      else l2 = 'No saved model yet: your cards sit idle';
      var l3 = null, k3 = 'rung', you = farthestClean(), pas = null;
      S.rivals.forEach(function (rv) { var c = rivalBest(rv); if (c > you && (sn.riv[rv.key] || 0) <= (sn.riv.you || 0) && c > (sn.riv.you || 0)) pas = pas && rivalBest(pas) > c ? pas : rv; });
      var vil = villain();
      if (pas && sn.riv.you > 0) { l3 = pas.name + ' passed you: it published a model ' + bigPhrase(rivalBest(pas) / you) + '.'; k3 = 'rival'; }
      else if (S.slipN <= 3 && vil && vil.rv) {
        var vc = vil.C; k3 = 'rival';
        l3 = vc > you ? (you > 0 ? vil.rv.name + ' published a model ' + bigPhrase(vc / you) + '.' : vil.rv.name + ' already has a model out. You have none yet.')
          : vil.rv.name + ' is ' + (you / vc >= 1.95 ? timesWord(you / vc) + ' behind you' : 'right behind you') + ' and grows 10× every ' + (vil.rv.tau).toFixed(0) + ' months.';
      }
      if (!l3) {
        var truck = S.orders.filter(function (o) { return o.arrive - n <= 14; }).sort(function (a, b) { return a.arrive - b.arrive; })[0];
        var rl = Math.max(0, Math.ceil(S.relevance.deadline - n)), rw = runway();
        if (truck) { l3 = truck.n + ' ' + truck.type.toUpperCase() + 's land ' + fmtShort(truck.arrive) + '.'; k3 = 'truck'; }
        else if (S.pending && S.pending.kind === 'term') { l3 = 'A term sheet is waiting for your answer.'; k3 = 'round'; }
        else if (rl < 45) { l3 = 'The world forgets you in ' + rl + ' days unless you publish or ship.'; k3 = 'forgot'; }
        else if (rw < 6) { l3 = 'Under ' + Math.max(1, Math.ceil(rw)) + ' months until broke: raise, or spend less.'; k3 = 'broke'; }
        else if (vil && vil.rv && vil.C > you && you > 0) { l3 = vil.rv.name + ' published a model ' + bigPhrase(vil.C / you) + '.'; k3 = 'rival'; }
        else l3 = 'Next: ' + nextRungText() + '.';
      }
      var slip = { n: S.slipN, day: n, month: mon, monthName: dateOf(n).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), lines: [{ k: 'cash', up: d >= 0, text: l1 }, { k: k2, text: l2 }, { k: k3, text: l3 }], bankDelta: d };
      S.mile = [];
      return slip;
    }
    function monthStart(n) {
      S.slipN++;
      var slip = buildSlip(n);
      S.slips.push(slip);
      takeSnap();
      emit({ type: 'slip', slip: slip });
    }
    takeSnap();

    /* ---------------- rounds: terms, status, reasons ---------------- */
    function desperation(m) { var D = CFG.desperation; if (!isFinite(m) || m >= D.months) return 1; return D.floor + (1 - D.floor) * Math.max(0, m) / D.months; }
    function roundTerms(round) {
      round = round || (S.raise.aDone ? 'B' : 'A');
      var T = round === 'A' ? termsA() : { cash: CFG.seriesB.cash, post: S.api ? CFG.seriesB.postApi : CFG.seriesB.post };
      var f = desperation(runway()), post = T.post * f;
      return { round: round, cash: T.cash, basePost: T.post, post: post, factor: f, sold: T.cash / post, newStake: S.stake * (1 - T.cash / post) };
    }
    function proofPartsA() {
      var ok = S.runs.filter(function (r) { return r.clean && r.onLine && r.landDay >= CFG.seriesA.fromDay; }), far = 0;
      ok.forEach(function (r) { if (r.C > far) far = r.C; });
      var need = Math.max(CFG.seriesA.needC, S.raise.aNeed);
      var two = far > 0 && ok.some(function (r) { return log10(far / r.C) >= CFG.seriesA.decades * 0.98; });
      return { far: far, need: need, two: two, farOk: far >= need, any: ok.length };
    }
    function roundStatus() {
      var next = !S.raise.aDone ? 'A' : (!S.raise.bDone ? 'B' : null), why = [], legal = false;
      if (next === 'A') {
        var pp = proofPartsA();
        if (!pp.any) why.push('needs two clean results on the line, one ten times bigger than the other');
        else if (!pp.farOk) why.push('your biggest needs ' + ratioWord(pp.need / pp.far) + ' more compute');
        else if (!pp.two) why.push('needs a second clean result ten times smaller than your biggest');
      } else if (next === 'B') {
        var have = 0; S.runs.forEach(function (r) { if (r.clean && r.landDay >= CFG.seriesB.fromDay && r.C > have) have = r.C; });
        if (!S.raise.aDone) why.push('close Series A first');
        if (S.day < CFG.seriesB.fromDay) why.push('opens 11 Jun, with the API market');
        else if (!proofB()) why.push(have ? 'your biggest since 11 Jun needs ' + ratioWord(CFG.seriesB.needC / have) + ' more compute' : 'needs a new clean result, ' + ratioWord(CFG.seriesB.needC / Math.max(1, farthestClean())) + ' more compute than your biggest');
      }
      if (next && !marketOpen()) why.push(S.termBlockUntil > S.day ? 'no term sheets until ' + fmtDate(S.termBlockUntil) + ' (scandal)' : 'the market is closed until 15 Jun');
      if (next && S.pending && S.pending.kind === 'term') why.unshift('a term sheet is waiting for you');
      legal = !!next && why.length === 0;
      return { next: next, round: next, legal: legal, open: marketOpen(), why: why, terms: next ? roundTerms(next) : null, pending: !!(S.raise.aPending || S.raise.bPending) };
    }
    function ratioWord(x) { return (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? String(Math.round(x)) : x.toFixed(1)) + '×'; }

    /* ---------------- the ladder: three rungs, the first lit ---------------- */
    function capLo(id) { var c = null; CFG.caps.forEach(function (x) { if (x[0] === id) c = x; }); return c ? c[1] * Math.pow(10, -c[2]) : Infinity; }
    function nearestRivalAhead() { var you = farthestClean(), best = null; S.rivals.forEach(function (rv) { var c = rivalBest(rv); if (c > you && (!best || c < best.C)) best = { rv: rv, C: c }; }); return best; }
    function ladder() {
      var far = farthestClean(), L = [], gone = S.runs.length > 0;
      var shortNames = { start: 'Start a run', land: 'First model', seriesA: 'Series A', paragraph: 'Paragraphs', rival: 'Pass a lab', arith: 'Arithmetic', api: 'Ship an API', seriesB: 'Series B', translate: 'Translation', ten: 'Within 10×', gpt3: 'Beat GPT-3' };
      function rung(id, text, done, target, extra) {
        var o = { id: id, text: text, short: shortNames[id] || text, done: !!done, target: target || 0 };
        if (target && !done) { o.prog = far > 0 ? clamp((log10(far) - 19) / (log10(target) - 19), 0, 1) : 0; o.left = far > 0 ? 'needs ' + ratioWord(target / far) + ' more compute' : 'needs a first saved model'; }
        else o.prog = done ? 1 : 0;
        if (extra) for (var k in extra) o[k] = extra[k];
        return o;
      }
      var run = S.run;
      L.push(rung('start', 'Start a training run', S.stats.runs > 0 || gone, 0, { why: 'Cards that are not training earn nothing. Three weeks on all eight.' }));
      var landed = S.runs.length > 0;
      var r2 = rung('land', 'Land your first saved model', landed, 0, { why: 'A saved model is what you own, what investors check, and what the world reads.' });
      if (!landed && run) { r2.prog = clamp(run.done / run.C, 0, 1); var dl = Math.max(0, Math.ceil(runDaysLeft(run))); r2.left = dl + (dl === 1 ? ' day' : ' days') + ' to go'; }
      L.push(r2);
      var rA = rung('seriesA', 'Win a Series A', S.raise.aDone, CFG.seriesA.needC, { why: 'Two clean results on the line, one ten times bigger than the other. Investors pay for cards.' });
      if (!S.raise.aDone) {
        var ppA = proofPartsA(), eligFar = ppA.far || 0;
        if (eligFar > 0 && eligFar < ppA.need) { rA.prog = clamp((log10(eligFar) - 19) / (log10(ppA.need) - 19), 0, 1); rA.left = 'needs ' + ratioWord(ppA.need / eligFar) + ' more compute'; }
        else if (eligFar >= ppA.need) { rA.prog = 1; rA.left = ppA.two ? 'ready: ' + (marketOpen() ? 'pitch it' : 'the market reopens 15 Jun') : 'needs a second clean result ten times smaller than your biggest'; }
        else if (far > 0) { rA.prog = clamp((log10(far) - 19) / (log10(ppA.need) - 19), 0, 1); rA.left = 'needs ' + ratioWord(ppA.need / far) + ' more compute on the line'; }
      }
      L.push(rA);
      var later = [];
      var cp = capById('paragraph'), ca = capById('arithmetic'), ct = capById('translation');
      later.push(rung('paragraph', 'Teach it paragraphs', cp.fired, capLo('paragraph')));
      var nr = nearestRivalAhead();
      later.push(rung('rival', nr ? 'Pass ' + nr.rv.name : 'Stay ahead of every lab', !nr && far > 0, nr ? nr.C * 1.01 : 0, { rival: nr ? nr.rv.key : null }));
      later.push(rung('arith', 'Teach it arithmetic', ca.fired, capLo('arithmetic')));
      if (S.day >= CFG.apiDay) later.push(rung('api', 'Ship an API', S.stats.shipped > 0, capLo('paragraph')));
      later.push(rung('seriesB', 'Raise a Series B', S.raise.bDone && !S.raise.bPassed, CFG.seriesB.needC));
      later.push(rung('translate', 'Teach it translation', ct.fired, capLo('translation')));
      later.push(rung('ten', 'Get within 10× of GPT-3', far >= CFG.gpt3C / 10, CFG.gpt3C / 10));
      later.push(rung('gpt3', 'Beat GPT-3', S.miracle || far >= CFG.gpt3C, CFG.gpt3C));
      var open = L.filter(function (r) { return !r.done; });
      var rungs;
      if (open.length) rungs = L.slice(); else rungs = later.filter(function (r) { return !r.done; }).slice(0, 3);
      // the first three are fixed until they are done; then the next three unfinished
      if (!open.length) { /* rungs already the next three */ }
      else if (S.raise.aDone || (L[0].done && L[1].done && L[2].done)) rungs = later.filter(function (r) { return !r.done; }).slice(0, 3);
      var lit = -1; rungs.forEach(function (r, i) { if (lit < 0 && !r.done) lit = i; });
      rungs.forEach(function (r, i) { r.lit = i === lit; });
      return { rungs: rungs, lit: lit, first: !(L[0].done && L[1].done && L[2].done) };
    }

    /* ---------------- the shelf, the trucks, the idle drip ---------------- */
    function boxName(box) { return box === 'a100' ? 'DGX A100' : 'DGX-1'; }
    function bestBox() { return S.day >= CFG.buy.dgxa.from ? 'a100' : 'v100'; }
    function unitQuote(box, units) {
      box = box || bestBox(); units = units || 1;
      var base = CFG.buy[box === 'a100' ? 'dgxa' : 'dgx1'], pod = CFG.buy[box === 'a100' ? 'poda' : 'pod'];
      var post = S.day >= CFG.apiDay, covid = S.day >= CFG.covidOrderFrom && S.day <= CFG.covidOrderTo;
      var unit = Math.round(base.price * (post ? CFG.afterApiPriceMult : 1)), price = unit * units, n = base.n * units;
      var lead = (units <= 1 ? base.lead : units <= 8 ? pod.lead : pod.lead + (units <= 32 ? 28 : 56)) + (covid ? CFG.covidOrderExtra : 0) + (post ? CFG.afterApiLeadExtra : 0);
      var why = null; if (S.day < base.from) why = 'Not announced yet.'; else if (S.bank < price) why = 'Not enough cash.';
      var arrive = Math.floor(S.day) + lead;
      return { box: box, units: units, n: n, type: box, label: units + ' ' + boxName(box) + (units > 1 && box === 'a100' ? 's' : ''), cards: n + ' ' + (box === 'a100' ? 'A100s' : 'V100s'), price: price, unit: unit, short: Math.max(0, price - S.bank), lead: lead, arrive: arrive, late: arrive >= CFG.endDay, why: why, covid: covid, post: post };
    }
    function buyUnits(box, units) {
      var q = unitQuote(box, units); if (q.why) return { ok: false, msg: q.why };
      cash('buy', -q.price); S.orders.push({ id: 'o' + (++seq), type: q.type, n: q.n, price: q.price, ordered: S.day, arrive: q.arrive, label: q.label + ' (' + q.cards + ')' });
      S.ledger.push({ day: S.day, what: 'Ordered ' + q.label + ' (' + q.cards + ')', amt: -q.price });
      voice('lab', q.label + ' ordered: lands ' + fmtDate(q.arrive) + (q.late ? ' (next year)' : '') + '.', 'info');
      emit({ type: 'cluster' });
      return { ok: true, quote: q };
    }
    function shelf() {
      var box = bestBox(), list = CFG.sizes.map(function (u) { return unitQuote(box, u); });
      var afford = list.filter(function (q) { return !q.why; });
      var grey = list.filter(function (q) { return q.why === 'Not enough cash.'; })[0] || null;
      var out = { box: box, boxName: boxName(box), list: list, afford: afford, grey: grey, isNew: box === 'a100' && S.day < CFG.buy.dgxa.from + 21 };
      if (grey) {
        var last = S.active.slice().sort(function (a, b) { return b.C - a.C; })[0] || S.runs[S.runs.length - 1];
        out.runway = runway({ bank: -grey.price, owned: grey.n });
        if (last) {
          var pool = last.pool, now = Math.max(1, poolFlops(pool)), add = grey.n * CFG.flops[grey.type], withIt = (POOL_TYPE[pool] === grey.type ? now : 0) + add;
          var rem = last.status === 'landed' || last.status === 'stopped' ? last.C : last.C - last.done;
          out.days = { now: rem / now, withIt: rem / withIt, run: last.id, done: last.status === 'landed' };
        }
      }
      return out;
    }
    function idle() {
      var tot = 0, busyN = 0, trainN = 0, idleRent = 0, idleOwn = 0, price = rentPrice(S.day);
      POOLS.forEach(function (k) {
        var raw = rawPool(k), run = S.active.filter(function (r) { return r.pool === k; })[0], used = run ? Math.min(run.cards, poolCount(k)) : 0, serving = servingN(k), free = Math.max(0, poolCount(k) - used);
        tot += raw; busyN += used + serving; trainN += used;
        if (k === 'cloud') idleRent += free * price * 24; else if (k === 'meridian') idleRent += free * CFG.meridian.rate * 24; else idleOwn += free * CFG.own.ownedPerDay;
        if (k === 'cloud' || k === 'meridian') idle.cards = (idle.cards || 0);
      });
      var idleCards = 0; POOLS.forEach(function (k) { var run = S.active.filter(function (r) { return r.pool === k; })[0], used = run ? Math.min(run.cards, poolCount(k)) : 0; idleCards += Math.max(0, poolCount(k) - used); });
      var lent = lentN(); tot += lent; busyN += lent;
      return { total: tot, busy: busyN, train: trainN, idleCards: idleCards, perDay: idleRent + idleOwn, busyShare: tot ? busyN / tot : 0, usefulShare: tot ? trainN / tot * CFG.own.mfu * scaleEff() : 0 };
    }
    function scaleEff() { return 1; }
    function cardDay() { var r = rentPrice(S.day) * 24; return { rented: r, owned: CFG.own.v100 / CFG.own.life + CFG.upkeepPerCard / 30.4, breakeven: (CFG.own.v100 / CFG.own.life + CFG.upkeepPerCard / 30.4) / r }; }
    function trucks() { return S.orders.map(function (o) { return { id: o.id, label: o.label, type: o.type, n: o.n, price: o.price, ordered: o.ordered, arrive: o.arrive, frac: clamp((S.day - o.ordered) / Math.max(1, o.arrive - o.ordered), 0, 1), weeks: Math.max(0, Math.round((o.arrive - S.day) / 7)) }; }); }
    function yearsToGPT3() { var f = totalFlops(); if (!(f > 0)) return Infinity; return CFG.gpt3C / f; }   // days at today's speed

    /* ---------------- saved models: plaques ---------------- */
    function plainLine(r) {
      if (!r.clean) return 'memorised web boilerplate';
      var caps = r.caps || [];
      if (caps.indexOf('translation') >= 0) return 'writes paragraphs, adds two-digit numbers and translates passably';
      if (caps.indexOf('arithmetic') >= 0) return 'writes a coherent paragraph and adds two-digit numbers';
      if (caps.indexOf('paragraph') >= 0) return 'writes a coherent paragraph';
      var t = tierOf(r.L); return t >= 3 ? 'short sentences that make sense' : t === 2 ? 'grammar without much sense' : t === 1 ? 'babbles words' : 'only static';
    }
    function bestKnownL() { var b = S.day >= CFG.gpt3Day ? CFG.gpt3L : Infinity; S.rivals.forEach(function (rv) { rv.pubs.forEach(function (p) { if (p.day <= S.day && p.L < b) b = p.L; }); }); return b; }
    function plaques() {
      return S.runs.slice().reverse().map(function (r) {
        var line = Lline(r.C), above = (r.L / line - 1) * 100, bk = bestKnownL();
        return { id: r.id, name: r.name || ('FRONTIER-' + sizeWord(r.N)), day: r.landDay, N: r.N, D: r.D, C: r.C, L: r.L, clean: r.clean, line: plainLine(r), above: above, behindBest: isFinite(bk) ? r.L - bk : null, bestL: bk,
          short: shortOf(r.C), caps: r.caps || [], published: !!r.published, shipped: !!r.shipped, aborted: !!r.aborted, publishedDay: r.pubDay, private: !!r.private, pending: r.pendingPublic || null,
          tests: S.caps.map(function (c) { var cc = null; CFG.caps.forEach(function (x) { if (x[0] === c.id) cc = x; }); var lo = cc[1] * Math.pow(10, -cc[2]), hi = cc[1] * Math.pow(10, cc[2]);
            return { id: c.id, ok: r.clean && r.L <= c.L, isNew: (r.newCaps || []).indexOf(c.id) >= 0, leak: !!(c.contaminated && c.leakKnown && r.L <= c.L), lo: lo, hi: hi, needLo: lo / r.C, needHi: hi / r.C }; }) };
      });
    }
    function apiMeter() {
      if (!S.api) return null;
      var rev = S.api.rev, devs = rev / 400;
      return { rev: rev, developers: Math.round(devs), waiting: Math.round(devs * (2 + S.rep / 20)), words: Math.round(rev / 30.4 / 0.06 * 750), apps: Math.min(36, Math.floor(devs / 10)), since: S.api.since, runId: S.api.runId };
    }
    function openMeter() {
      if (S.openedDay == null) return null;
      var days = Math.max(0, S.day - S.openedDay);
      return { downloads: Math.round(40 * days * S.rep / 10), finetunes: Math.round(days * S.rep / 25), days: days };
    }
    function reproduction(r) { // when the nearest lab reproduced your published result
      if (!r.published || r.pubDay == null) return null;
      var d = S.day - r.pubDay; return { days: d, done: d >= CFG.rivalSlideDelay, by: 'Northwind' };
    }

    /* ---------------- presets: one tap, a sensible run ---------------- */
    function presetDesign(days, pool) {
      days = Math.min(CFG.preset.maxDays, days || CFG.preset.days); pool = pool && POOLS.indexOf(pool) >= 0 ? pool : biggestPool();
      var avail = poolCount(pool), rate = avail * flopsPer(pool);
      if (!(rate > 0)) return null;
      var target = rate * days, C = function (N) { return 6 * N * recipeTokens(N); };
      var lo = Math.log(CFG.paramsMin), hi = Math.log(Math.min(CFG.paramsMax, memLimit())), N;
      if (C(Math.exp(hi)) <= target) N = Math.exp(hi);
      else { for (var it = 0; it < 60; it++) { var mid = (lo + hi) / 2; if (C(Math.exp(mid)) > target) hi = mid; else lo = mid; } N = Math.exp(lo); }
      var guard = 0; while (recipeTokens(N) > S.data.lo && N > CFG.paramsMin && guard++ < 200) N *= 0.97;
      N = Math.max(CFG.paramsMin, N);
      return { params: N, tokens: recipeTokens(N), pool: pool, gpus: avail, days: C(N) / rate };
    }
    // the biggest recipe run that fits memory, the data wall's safe edge, the calendar and the bank
    function biggestFits(pool) {
      pool = pool && POOLS.indexOf(pool) >= 0 ? pool : biggestPool();
      var best = null;
      for (var v = 0; v <= 1000; v += 4) {
        var N = Math.pow(10, Math.log10(CFG.paramsMin) + v / 1000 * (Math.log10(CFG.paramsMax) - Math.log10(CFG.paramsMin)));
        var d = design({ params: N, pool: pool }); if (d.block) continue;
        if (d.D > S.data.lo || d.landDay > CFG.endDay - 3 || d.runwayAtLand < 1) continue;
        if (d.days > 90) continue;
        best = { params: N, tokens: d.D, pool: pool, gpus: d.cards, days: d.days };
      }
      return best;
    }
    // a run that reaches a target amount of compute on the cards you have, if it fits
    function designFor(targetC, pool) {
      pool = pool && POOLS.indexOf(pool) >= 0 ? pool : biggestPool();
      var avail = poolCount(pool), rate = avail * flopsPer(pool); if (!(rate > 0)) return null;
      var lo = Math.log(CFG.paramsMin), hi = Math.log(Math.min(CFG.paramsMax, memLimit())), N;
      var C = function (n) { return 6 * n * recipeTokens(n); };
      if (C(Math.exp(hi)) < targetC) N = Math.exp(hi);
      else { for (var it = 0; it < 60; it++) { var mid = (lo + hi) / 2; if (C(Math.exp(mid)) > targetC) hi = mid; else lo = mid; } N = Math.exp(hi); }
      return { params: N, tokens: recipeTokens(N), pool: pool, gpus: avail, days: C(N) / rate, C: C(N), reaches: C(N) >= targetC * 0.98 };
    }

    return {
      S: S, CFG: CFG, WORLD: WORLD, on: function (fn) { listeners.push(fn); }, act: act, tick: tick, advance: advance, answer: answer,
      derived: derived, state: state, design: design, rentQuote: rentQuote, renewQuote: renewQuote, buyQuote: buyQuote, rentOutQuote: rentOutQuote,
      lossAt: lossAt, Lline: Lline, recipeTokens: recipeTokens, C_of_tokens: C_of_tokens, Dopt: Dopt, rivalC: rivalC, frontier: frontier,
      fmt: { money: money, moneyFull: moneyFull, sci: sci, size: sizeWord, pct: pct, months: months, date: fmtDate, short: fmtShort, plural: plural, ratio: ratioWord, trim0: trim0 },
      staff: staff, person: person, has: has, poolName: POOL_NAME, news: NEWS, dateOf: dateOf, dom: dom,
      // the books
      runway: runway, farthestClean: farthestClean, shortOf: shortOf, lab: lab, burn: burn, burnParts: burnParts, flopsPerDay: flopsPerDay, roundStatus: roundStatus, roundTerms: roundTerms,
      rankings: rankings, myRank: myRank, ladder: ladder, shelf: shelf, unitQuote: unitQuote, buyUnits: buyUnits, idle: idle, cardDay: cardDay, trucks: trucks, yearsToGPT3: yearsToGPT3,
      plaques: plaques, apiMeter: apiMeter, openMeter: openMeter, reproduction: reproduction, presetDesign: presetDesign, biggestFits: biggestFits, designFor: designFor, bestLoss: bestLoss, bestKnownL: bestKnownL,
      rivalBest: rivalBest, capLo: capLo, villain: villain, desperation: desperation, bestBox: bestBox, runDaysLeft: runDaysLeft, hasInfra: hasInfra, proofPartsA: proofPartsA, memLimit: memLimit
    };
  }

  var API = { create: create };
  if (isNode) module.exports = API; else root.FrontierEngine = API;
})(this);
