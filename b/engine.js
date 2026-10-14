/* FRONTIER control room: the simulation. No DOM. Runs in the page and in node (bot sims).
   create(CFG, WORLD, CORPUS, seed, emit) returns the engine. The UI owns the clock and calls advance(days). */
(function (root) {
  'use strict';
  function create(CFG, WORLD, CORPUS, seed, emit) {
    emit = emit || function () {};
    /* ---------------- helpers ---------------- */
    function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
    function log10(x) { return Math.log(x) / Math.LN10; }
    function mulberry(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    if (seed == null) seed = Math.floor(Math.random() * 1e9);
    var mainRng = mulberry(seed >>> 0), wordRng = mulberry((seed ^ 0x5bd1e995) >>> 0), rng = mainRng;
    function U(a, b) { return a + (b - a) * rng(); }
    function gauss() { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }
    function pick(a) { return a[Math.floor(rng() * a.length)]; }
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    var BASE = Date.UTC(CFG.year, 0, 1), MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    function dateOf(day) { return new Date(BASE + Math.floor(day + 1e-9) * 864e5); }
    function dd(n) { return (n < 10 ? '0' : '') + n; }
    function fmtDate(day) { var d = dateOf(day); return dd(d.getUTCDate()) + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
    function fmtDow(day) { return DOW[dateOf(day).getUTCDay()]; }
    function fmtShort(day) { var d = dateOf(day); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; }
    function iso(s) { return Math.round((Date.parse(s + 'T00:00:00Z') - BASE) / 864e5); }
    function monthOf(day) { return dateOf(day).getUTCMonth(); }
    function isFirst(day) { return dateOf(day).getUTCDate() === 1; }
    function nextFirst(day) { var d = dateOf(day); return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - BASE) / 864e5); }
    function money(x) {
      var s = x < 0 ? '−' : '', a = Math.abs(x);
      var trim = function (t) { return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t; };
      if (a >= 1e9) return s + '$' + trim((a / 1e9).toFixed(a >= 1e10 ? 1 : 2)) + 'B';
      if (a >= 1e6) return s + '$' + trim((a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)) + 'M';
      if (a >= 1e4) return s + '$' + Math.round(a / 1e3) + 'K';
      return s + '$' + Math.round(a).toLocaleString('en-US');
    }
    function sci(C) { if (!(C > 0)) return '0'; var e = Math.floor(log10(C) + 1e-9), m = C / Math.pow(10, e); if (m >= 9.95) { m = 1; e++; } return m.toFixed(m < 9.95 && Math.abs(m - Math.round(m)) < 0.05 ? 0 : 1) + 'e' + e; }
    function sizeWord(N) { return N >= 1e12 ? (N / 1e12).toFixed(1).replace(/\.0$/, '') + 'T' : N >= 1e9 ? (N >= 1e10 ? Math.round(N / 1e9) : (N / 1e9).toFixed(1).replace(/\.0$/, '')) + 'B' : Math.round(N / 1e6) + 'M'; }
    function fill(t, o) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
    function plural(n, w) { return n + ' ' + (w === 'person' ? (n === 1 ? 'person' : 'people') : w + (n === 1 ? '' : 's')); }

    /* ---------------- physics ---------------- */
    var P0 = Math.pow(10, -3.5), CRAWL = CFG.frayMax + 1;
    function Lline(C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); }
    function recipeTokens(C) { return CFG.tokGPT3 * Math.pow(C / CFG.gpt3C, CFG.tokExp); }
    function recipeSplit(C) { var D = recipeTokens(C); return { N: C / (6 * D), D: D }; }
    function allocMult(N, D) { var C = 6 * N * D, dv = log10(D / recipeTokens(C)); return 1 + CFG.allocPenalty * dv * dv; }
    function lossAt(run, q) {
      q = clamp(q, P0, 1);
      var z = (log10(q) + 3.5) / 3.5, yl = Math.log(Lline(q * run.C) * run.m), H0 = Math.log(CFG.startLoss) - Math.log(Lline(P0 * run.C) * run.m);
      return Math.exp(yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z)));
    }
    function amount(rq) { if (rq < CFG.cleanR) return 0; if (rq <= 1) return Math.min(CFG.frayMax, 1 + Math.floor((rq - CFG.cleanR) / CFG.frayStep + 1e-9)); return CRAWL; }

    /* ---------------- state ---------------- */
    var W0 = Math.exp(Math.log(CFG.W_lo) + rng() * (Math.log(CFG.W_hi) - Math.log(CFG.W_lo)));
    var capC = CFG.caps.map(function (c) { return c[1] * Math.pow(10, (rng() * 2 - 1) * c[2]); }).sort(function (a, b) { return a - b; });
    var S = {
      seed: seed, phase: 'intro', day: 0, bank: CFG.seedCash - CFG.dgx1Start, stake: CFG.stakeStart, post: CFG.seedPost, rep: CFG.repStart,
      team: [], board: [], gone: {}, owned: { v: CFG.startOwned, a: 0 }, rentals: [], orders: [], lease: null, mer: null, merOffer: null, merPassed: false, merSecondOffered: false,
      priority: false, spotNext: CFG.spot.fromDay, serving: null, api: null,
      run: null, runs: [], landing: null, seq: 0,
      data: { W: W0, filters: 0, job: null, u: rng() * 1.6 - 0.8, seen: 0 },
      caps: CFG.caps.map(function (c, i) { return { id: c[0], C: capC[i], L: Lline(capC[i]), first: false, contam: null }; }),
      rivals: CFG.rivals.map(function (r) { var j = U(-CFG.rivalJitter, CFG.rivalJitter); return { key: r.key, name: r.name, blurb: r.blurb, c0: r.c0, tau: r.tau, period: r.period, offset: r.offset, cap: r.cap, gpus0: r.gpus0, gpuDouble: r.gpuDouble, jit: j, extra: 0, pubs: [{ C: r.c0 * Math.pow(10, j) / 2, L: Lline(r.c0 * Math.pow(10, j) / 2) * r.offset, day: -1 }], nextPub: Math.round(r.period * U(0.2, 1.0)), hired: [], last: 'published a 2019 result' }; }),
      news: [], inbox: [], answered: [], events: [], newsIdx: 0,
      raise: { bridge: false, A: false, B: false, blockUntil: -1 }, boardSellDay: null,
      relDeadline: CFG.relevanceDays, lastPublishDay: -999, scandals: 0, revenueTotal: 0, leaseTotal: 0,
      flags: {}, demands: {}, stats: { hangs: 0, nans: 0, launches: 0, published: 0, shipped: 0, filters: 0, hires: 0, walked: 0, aborted: 0 },
      hist: { bank: [], burn: [], rep: [], pf: [], util: [], rev: [] }, ended: null, log: [], t3used: {}, t4used: {}, bags: {}, firstAuthor: false, tomOffUntil: -1, gpt3: false, line: false
    };
    addPerson('priya');
    function log(s) { S.log.push(fmtShort(S.day) + ' ' + s); if (S.log.length > 400) S.log.shift(); }
    function news(text, kind, extra) { var n = { day: Math.floor(S.day), text: text, kind: kind || 'lab' }; if (extra) for (var k in extra) n[k] = extra[k]; S.news.unshift(n); if (S.news.length > 120) S.news.pop(); emit('news', n); return n; }

    /* ---------------- people ---------------- */
    function addPerson(key) {
      var d = WORLD.people[key];
      var p = { id: key, name: d.name, first: d.first, role: d.role, skill: d.skill, salary: d.salary, ego: d.ego, does: d.does, mood: CFG.moodStart, joined: Math.floor(S.day), gone: false };
      S.team.push(p); return p;
    }
    function staff() { return S.team.filter(function (p) { return !p.gone; }); }
    function person(key) { for (var i = 0; i < S.team.length; i++) if (S.team[i].id === key && !S.team[i].gone) return S.team[i]; return null; }
    function countRole(r) { return staff().filter(function (p) { return p.role === r; }).length; }
    function infraCount() { return staff().filter(function (p) { return p.role === 'infra' && !(p.id === 'tom' && S.day < S.tomOffUntil); }).length; }
    function memLimit() { return CFG.memBase * Math.pow(CFG.memPerSystems, countRole('systems')); }
    function hasScaling() { return countRole('scaling') > 0; }
    function hasEvals() { return countRole('evals') > 0; }
    function sunheeLive(day) { var p = person('sunhee'); return !!p && day - p.joined >= CFG.sunheeDelay; }
    function moodAdd(p, d, why) { if (!p || p.gone) return; p.mood = clamp(p.mood + d, 0, 100); if (p.mood <= 0) walk(p, null, why || 'morale hit zero'); }
    function walk(p, rivalKey, why) {
      if (!p || p.gone) return;
      p.gone = true; p.goneDay = Math.floor(S.day); p.why = why || ''; S.stats.walked++;
      var rv = rivalKey ? S.rivals.find(function (r) { return r.key === rivalKey; }) : null;
      if (rv) { rv.extra += CFG.rivalPassBoost; rv.hired.push(p.first); rv.last = 'hired ' + p.first + ' from you'; }
      news(p.name + ' left' + (rv ? ' for ' + rv.name : '') + (why ? ': ' + why : '') + '.', 'team', { bad: true });
      if (S.run && S.run.N > memLimit()) news('Without a systems person the running model no longer fits; it keeps going on the sharding already set up.', 'team');
      emit('walk', p);
    }

    /* ---------------- cards ---------------- */
    function rentPriceAt(day) { var p = CFG.rentPrice[0][1]; CFG.rentPrice.forEach(function (x) { if (day >= x[0]) p = x[1]; }); return p; }
    function rentCapAt(day) { var p = CFG.rentCap[0][1]; CFG.rentCap.forEach(function (x) { if (day >= x[0]) p = x[1]; }); return p; }
    function rentalLive(r, day) { day = day == null ? S.day : day; return day >= r.start && day < r.end; }
    function rentedLive() { var n = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) n += r.n; }); return n; }
    function rentedHeld() { var n = 0; S.rentals.forEach(function (r) { if (!r.spot && S.day < r.end) n += r.n; }); return n; }
    function merAlloc() { return S.mer && S.day >= S.mer.live ? S.mer.alloc : 0; }
    function leased() { return S.lease && S.day < S.lease.until ? S.lease.n : 0; }
    function servingFrom(pool) { return S.serving && S.serving.pool === pool ? S.serving.n : 0; }
    function poolCards(pool) {
      if (pool === 'office') return Math.max(0, S.owned.v - leased() - servingFrom('office'));
      if (pool === 'a100') return Math.max(0, S.owned.a - servingFrom('a100'));
      if (pool === 'cloud') return Math.max(0, rentedLive() - servingFrom('cloud'));
      if (pool === 'meridian') return Math.max(0, merAlloc() - servingFrom('meridian'));
      return 0;
    }
    function poolType(pool) { return pool === 'a100' ? 'a100' : 'v100'; }
    var POOLS = ['office', 'a100', 'cloud', 'meridian'];
    var POOLNAME = { office: 'Office racks', a100: 'A100 racks', cloud: 'Cloud (rented)', meridian: 'Meridian' };
    function physicalCards() { return S.owned.v + S.owned.a + rentedLive() + merAlloc(); }
    function pfPerDay() { return (S.owned.v - leased()) * CFG.pf.v100 + S.owned.a * CFG.pf.a100 + (rentedLive() + merAlloc()) * CFG.pf.v100; }
    function biggestPool() { var best = 'office', bf = -1; POOLS.forEach(function (k) { var f = poolCards(k) * CFG.flops[poolType(k)]; if (f > bf) { bf = f; best = k; } }); return best; }
    function effGpus(run) { return Math.min(run.gpus, poolCards(run.pool)); }
    function runRate(run) { return effGpus(run) * CFG.flops[poolType(run.pool)]; }
    function utilisation() { var tot = physicalCards(); if (!tot) return 0; var used = (S.run && !S.run.hang ? effGpus(S.run) : 0) + (S.serving ? S.serving.n : 0); return clamp(used / tot, 0, 1); }

    /* ---------------- money ---------------- */
    function salaries() { var t = 0; staff().forEach(function (p) { t += p.salary; }); return t; }
    function priorityCost() { return S.priority && S.mer ? S.mer.cards * CFG.meridian.priorityPerCard : 0; }
    function payroll() { return CFG.base + salaries() + CFG.upkeepPerOwned * (S.owned.v + S.owned.a) + priorityCost(); }
    function rentPerDay() { var t = 0; S.rentals.forEach(function (r) { if (rentalLive(r)) t += r.n * r.price * 24; }); return t; }
    function apiPerDay() { return S.api ? S.api.rev / 30.4 : 0; }
    function burnParts() {
      return { salaries: salaries(), office: CFG.base, upkeep: CFG.upkeepPerOwned * (S.owned.v + S.owned.a), cloud: rentPerDay() * 30.4, priority: priorityCost(), api: S.api ? S.api.rev : 0 };
    }
    function burn() { var b = burnParts(); return b.salaries + b.office + b.upkeep + b.cloud + b.priority; }
    function netBurn() { return burn() - (S.api ? S.api.rev : 0); }
    function runway() { var nb = netBurn(); if (nb <= 0) return Infinity; return Math.max(0, S.bank / nb); }

    /* ---------------- results, frontier, relevance ---------------- */
    function cleanRuns() { return S.runs.filter(function (r) { return r.clean; }); }
    function farthestClean() { var m = 0; S.runs.forEach(function (r) { if (r.clean && r.C > m) m = r.C; }); return m; }
    function bestClean() { var b = null; S.runs.forEach(function (r) { if (r.clean && (!b || r.C > b.C)) b = r; }); return b; }
    function farthestOut() { var m = 0; S.runs.forEach(function (r) { if (r.clean && (r.status === 'published' || r.status === 'shipped') && r.C > m) m = r.C; }); return m; }
    function rivalC(rv, day) { return Math.min(rv.cap, rv.c0 * Math.pow(10, rv.jit + rv.extra + (day / 30.44) / rv.tau)); }
    function rivalGpus(rv, day) { return Math.round(rv.gpus0 * Math.pow(2, day / rv.gpuDouble) * Math.pow(10, rv.extra * 0.5) / 8) * 8; }
    function frontier() { var m = 0; S.rivals.forEach(function (rv) { rv.pubs.forEach(function (p) { if (p.C > m) m = p.C; }); }); if (S.gpt3) m = Math.max(m, CFG.gpt3C); return m; }
    function relevanceNeed() { return frontier() * CFG.relevanceShare; }
    function horizon() { var f = farthestClean(); return f > 0 ? f * CFG.horizonMult : CFG.horizonFirst; }
    function onLine(r) { return r.loss <= Lline(r.C) * CFG.seriesA.onLine; }

    /* ---------------- data ---------------- */
    function wallTokens() { return CFG.passes * S.data.W; }
    function wallErr() { var n = countRole('data'); var e = n === 0 ? 0.7 : CFG.wallErr[Math.min(2, n - 1)]; return e * Math.pow(0.7, Math.min(2, S.data.seen)); }
    function wallEstimate() { var e = wallErr(), c = wallTokens() * Math.pow(1 + e, S.data.u); return { mid: c, lo: c / (1 + e), hi: c * (1 + e), err: e }; }
    function filterCost() { return CFG.filter.cost * Math.pow(2, S.data.filters); }
    function filterDays() { return person('ines') ? CFG.filter.daysFast : CFG.filter.days; }
    function dataPerson() { return person('priya') || person('ines'); }

    /* ---------------- rivals ---------------- */
    function rivalPublish(rv) {
      var C = rivalC(rv, S.day), last = rv.pubs[rv.pubs.length - 1];
      if (last && C <= last.C * 1.05) { rv.nextPub = S.day + rv.period * U(0.5, 0.9); return; }
      rv.pubs.push({ C: C, L: Lline(C) * rv.offset, day: Math.floor(S.day) });
      rv.last = 'published ' + sci(C) + ' FLOPs';
      news(rv.name + ' publishes a ' + sizeWord(recipeSplit(C).N) + '-parameter model: ' + sci(C) + ' FLOPs, loss ' + (Lline(C) * rv.offset).toFixed(2) + '.', 'rival', { rival: rv.key });
      emit('rival', rv);
    }

    /* ---------------- inbox (decisions pause the clock) ---------------- */
    function decide(item) {
      item.id = 'd' + (++S.seq); item.day = Math.floor(S.day);
      S.inbox.push(item); emit('decision', item); log('decision ' + item.kind);
      return item;
    }
    function blocked() { return S.inbox.length > 0; }

    /* ---------------- samples (the model's words) ---------------- */
    function bag(name, pool) { var b = S.bags[name]; if (!b || !b.length) b = S.bags[name] = shuffle(pool.slice()); return b.pop(); }
    function sentences(txt) { return txt.match(/[^.!?]+[.!?]+["”’]?(\s+|$)/g) || [txt]; }
    function cut(txt, max) {
      if (txt.indexOf('\n') >= 0 || txt.length <= max) return txt;
      var parts = sentences(txt), out = '';
      for (var i = 0; i < parts.length; i++) { if (out && (out + parts[i]).trim().length > max) break; out += parts[i]; }
      out = out.trim();
      if (out.length > max) { var ws = out.split(' '), o2 = ''; for (var j = 0; j < ws.length; j++) { if ((o2 + ' ' + ws[j]).trim().length > max - 1) break; o2 = (o2 + ' ' + ws[j]).trim(); } out = o2.replace(/[,;:]$/, '') + '…'; }
      return out;
    }
    function tierOf(Lv) { if (Lv > 6.0) return 0; if (Lv > 4.3) return 1; if (Lv > 3.3) return 2; return Lv <= S.caps[0].L ? 4 : 3; }
    function pickT3(Lv) {
      var want = Lv > 2.78 ? 1 : Lv > 2.48 ? 2 : 3, order = want === 1 ? [1, 2, 3] : want === 2 ? [2, 3, 1] : [3, 2, 1];
      for (var pass = 0; pass < 2; pass++) {
        for (var o = 0; o < 3; o++) { var cand = []; CORPUS.t3.forEach(function (e, i) { if (e[0] === order[o] && !S.t3used[i]) cand.push(i); }); if (cand.length) { var i = pick(cand); S.t3used[i] = 1; return CORPUS.t3[i][1]; } }
        S.t3used = {};
      }
      return CORPUS.t3[0][1];
    }
    function pickT4() {
      for (var pass = 0; pass < 2; pass++) {
        var cand = []; CORPUS.t4.forEach(function (e, i) { if (!S.t4used[i]) cand.push(i); });
        if (cand.length) { var i = pick(cand); S.t4used[i] = 1; return CORPUS.t4[i][1]; }
        S.t4used = {};
      }
      return CORPUS.t4[0][1];
    }
    function pickLow(tier) {
      if (tier === 0) return bag('t0', CORPUS.t0);
      if (tier === 1) return bag('t1', CORPUS.t1);
      return bag('t2', S.day >= 70 ? CORPUS.t2.concat([CORPUS.t2Covid]) : CORPUS.t2);
    }
    function crawlLine() {
      var pool = shuffle(CORPUS.crawl.slice()), out = '', mx = 150;
      for (var i = 0; i < pool.length; i++) { var next = out ? out + ' | ' + pool[i] : pool[i]; if (out && next.length > mx) continue; out = next; if (out.length >= mx * 0.62) break; }
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
      var chosen = shuffle(gaps.slice()).slice(0, k).sort(function (a, b) { return a - b; });
      var frags = shuffle(CORPUS.fray.slice()).slice(0, k), out = [], fi = 0;
      for (i = 0; i < n; i++) { out.push(words[i]); if (chosen.indexOf(i) >= 0 && fi < frags.length) out.push(frags[fi++]); }
      return out.join(' ');
    }
    function makeSample(run, q, capId) { var keep = rng; rng = wordRng; try { return makeSampleInner(run, q, capId); } finally { rng = keep; } }
    function makeSampleInner(run, q, capId) {
      var Lv = q >= 1 ? run.loss : lossAt(run, q), tier = tierOf(Lv), amt = amount(q * run.r), text, cap = null;
      if (capId) tier = Math.max(tier, 3);
      if (tier >= 3 && amt === CRAWL) text = crawlLine();
      else if (tier >= 3) {
        var full;
        if (capId) { full = capId === 'paragraph' ? pickT4() : bag(capId, CORPUS[capId]); cap = capId; }
        else {
          var elig = run.clean !== false ? S.caps.filter(function (c) { return c.id !== 'paragraph' && Lv <= c.L; }) : [];
          if (elig.length && rng() < 0.35) { var c = pick(elig); full = bag(c.id, CORPUS[c.id]); cap = c.id; }
          else full = tier === 4 ? pickT4() : pickT3(Lv);
        }
        text = cap === 'code' ? full + (amt > 0 ? '\n# ' + CORPUS.fray[Math.floor(rng() * CORPUS.fray.length)] : '') : splice(cut(full, 230 - amt * 15), amt);
      } else { text = pickLow(tier); amt = 0; }
      if (amt > 0 && !S.flags.frayed) { S.flags.frayed = true; }
      if (amt >= 2) S.data.seen = Math.max(S.data.seen, amt >= CRAWL ? 2 : 1);
      return { text: text, tier: tier, fray: amt, crawl: amt === CRAWL, cap: cap, q: q, loss: Lv, runId: run.id, day: Math.floor(S.day) };
    }

    /* ---------------- the design of a run ---------------- */
    function design(p) {
      p = p || {};
      var N = p.params || 1e8, D = p.tokens || 2e9, pool = p.pool || biggestPool(), gpus = Math.max(0, Math.floor(p.gpus == null ? poolCards(pool) : p.gpus));
      var avail = poolCards(pool); gpus = Math.min(gpus, avail);
      var C = 6 * N * D, perCard = CFG.flops[poolType(pool)], rate = gpus * perCard, days = rate > 0 ? C / rate : Infinity;
      var m = allocMult(N, D) * (sunheeLive(S.day) ? CFG.sunheeBend : 1), proj = Lline(C) * m;
      var err = !S.line ? CFG.projErr.none : hasScaling() ? CFG.projErr.scaling : CFG.projErr.line;
      var cost = 0, credits = 0, price = rentPriceAt(S.day);
      if (pool === 'cloud') cost = gpus * days * 24 * (S.rentals.length ? S.rentals[0].price : price);
      else if (pool === 'meridian') credits = gpus * days * 24 * CFG.meridian.rate;
      else cost = gpus * days * CFG.upkeepPerOwned / 30.4;
      var land = S.day + days, wall = wallEstimate(), r = D / wallTokens();
      var warn = [], block = null;
      if (N > memLimit()) { block = 'Won’t fit: ' + sizeWord(N) + ' parameters is past the ' + sizeWord(memLimit()) + ' limit. ' + (countRole('systems') ? 'Hire another systems person.' : 'Hire a systems person to split it across cards.'); }
      if (S.run) block = block || 'A run is already training.';
      if (!gpus) block = block || 'No cards free in ' + POOLNAME[pool] + '.';
      if (days > CFG.maxRunDays) block = block || 'Over a year at this size.';
      if (days < CFG.minRunDays && !block) days = Math.max(days, 0);
      if (D > wall.hi) warn.push({ k: 'data', bad: true, t: 'Past the clean-data wall: ' + sizeWord(D) + ' tokens vs ~' + sizeWord(wall.mid) + ' clean. The words will turn to web junk and the dot won’t count.' });
      else if (D > wall.lo * CFG.cleanR) warn.push({ k: 'data', t: 'Near the clean-data wall (' + sizeWord(wall.lo) + '–' + sizeWord(wall.hi) + ' tokens). Read the samples for junk.' });
      if (C > horizon() && !hasScaling()) warn.push({ k: 'horizon', t: 'Past your measured horizon (' + sci(horizon()) + '): 30% of runs out here land 2–5% high.' });
      var dv = log10(D / recipeTokens(C));
      if (Math.abs(dv) > 0.35) warn.push({ k: 'alloc', t: (dv > 0 ? 'Too many tokens for the size' : 'Too few tokens for the size') + ': lands ' + ((allocMult(N, D) - 1) * 100).toFixed(1) + '% above the line.' });
      if (land >= CFG.endDay) warn.push({ k: 'year', bad: true, t: 'Lands after 31 DEC (' + Math.ceil(days) + ' days).' });
      var rwDays = runway() * 30.4;
      if (isFinite(rwDays) && rwDays < days) warn.push({ k: 'runway', bad: true, t: 'Runway ends before it lands: money lasts ~' + Math.floor(rwDays) + ' days at today’s burn.' });
      else if (isFinite(rwDays)) warn.push({ k: 'runway', ok: true, t: 'Runway at landing: ' + Math.max(0, (rwDays - days) / 30.4).toFixed(1) + ' months.' });
      if (pool === 'cloud') { var ends = 0; S.rentals.forEach(function (rr) { if (!rr.renew && rr.end < land) ends += rr.n; }); if (ends) warn.push({ k: 'cards', bad: true, t: ends + ' rented cards go back before it lands; it will slow down.' }); }
      if (pool === 'meridian' && S.day < CFG.meridian.queueFrom && land > CFG.meridian.queueFrom && !S.priority) warn.push({ k: 'queue', t: 'Meridian’s queue starts 11 JUN: if you’re behind the frontier you lose cards on the 1st.' });
      return { params: N, tokens: D, C: C, pool: pool, gpus: gpus, avail: avail, days: days, land: land, landStr: fmtShort(Math.min(land, 400)), proj: proj, err: err, cost: cost, credits: credits, r: r, wall: wall, mem: memLimit(), warn: warn, block: block, recipeD: recipeTokens(C), line: Lline(C), horizon: horizon() };
    }

    function launch(p) {
      var d = design(p);
      if (d.block) return { ok: false, why: d.block };
      var m = allocMult(d.params, d.tokens) * (sunheeLive(S.day) ? CFG.sunheeBend : 1) * Math.exp(gauss() * CFG.landNoise);
      var blind = false;
      if (d.C > horizon() && !hasScaling() && rng() < CFG.blindShare) { m *= 1 + U(CFG.blindHi[0], CFG.blindHi[1]); blind = true; }
      var r = d.tokens / wallTokens();
      if (r > 1) m *= 1 + CFG.pastWallPenalty * Math.min(1, r - 1);
      var run = { id: ++S.seq, N: d.params, D: d.tokens, C: d.C, pool: d.pool, gpus: d.gpus, launchDay: S.day, planDays: d.days, done: 0, m: m, r: r, blind: blind,
        clean: r <= 1, flops0: d.gpus * CFG.flops[poolType(d.pool)], pts: [], cps: [], cpNext: 0, hang: null, hangs: 0, nans: 0, spikes: [], autoNext: 0, proj: d.proj };
      run.pts.push([P0, CFG.startLoss]);
      S.run = run; S.stats.launches++;
      log('launch ' + sci(d.C) + ' N=' + sizeWord(d.params) + ' D=' + sizeWord(d.tokens) + ' on ' + d.gpus + ' ' + d.pool + ' r=' + r.toFixed(2));
      emit('launch', run);
      return { ok: true, run: run };
    }

    function stepRun(dt) {
      var run = S.run; if (!run) return;
      if (run.hang) { if (S.day + dt >= run.hang.until) { run.hang = null; emit('resume', run); } return; }
      var g = effGpus(run), here = g * CFG.flops[poolType(run.pool)];
      if ((!run.moveCheck || S.day - run.moveCheck >= 0.25) && g * CFG.flops[poolType(run.pool)] < run.flops0 * 0.5) {
        run.moveCheck = S.day;
        var bestK = null, bestF = here;
        POOLS.forEach(function (k) { if (k === run.pool) return; var f = poolCards(k) * CFG.flops[poolType(k)]; if (f > Math.max(bestF, here * 2 - 1)) { bestF = f; bestK = k; } });
        if (bestK) {
          var from = run.pool; run.pool = bestK; run.gpus = poolCards(bestK); run.done = Math.max(0, run.done - Math.min(run.done * 0.02, here * 0.25));
          news('The run lost cards on ' + POOLNAME[from] + ', so it moved to ' + POOLNAME[bestK] + ' (' + run.gpus + ' cards) and restarts from its last checkpoint.', 'lab');
          emit('moved', run); g = effGpus(run);
        }
      }
      if (g <= 0) return;
      var infra = infraCount();
      var lam = CFG.hangPerCardDay * g * CFG.hangInfraMult[Math.min(2, infra)];
      if (rng() < lam * dt) {
        var lost = infra ? CFG.hangLoss.infra : CFG.hangLoss.none + (S.day >= CFG.covidHangFrom && S.day < CFG.covidHangTo ? CFG.hangLoss.covidExtra : 0);
        var back = Math.min(run.done, runRate(run) * Math.min(lost, 0.5) * 0.3);
        run.done -= back;
        var hour = Math.floor(((S.day % 1) * 24 + 24) % 24), minute = Math.floor((((S.day % 1) * 1440) % 60 + 60) % 60);
        run.hang = { start: S.day, until: S.day + lost, len: lost, at: (hour < 10 ? '0' : '') + hour + ':' + (minute < 10 ? '0' : '') + minute, infra: infra > 0 };
        run.hangs++; S.stats.hangs++;
        var q0 = run.done / run.C; run.pts = run.pts.filter(function (pt, i) { return i === 0 || pt[0] <= q0 + 1e-12; });
        staff().forEach(function (p) { if (p.role === 'infra') moodAdd(p, -CFG.hangMoodInfra, 'too many nights on call'); });
        log('hang ' + run.hang.at + ' lost ' + lost.toFixed(2) + 'd');
        emit('hang', run);
        if (person('tom') && run.hangs >= 4 && !S.demands.tom) S.flags.tomTired = true;
        return;
      }
      var nanLam = CFG.nanPerDay * Math.max(0, log10(run.N / 1e8)) * (person('sunhee') ? 0.4 : 1);
      if (rng() < nanLam * dt && run.done / run.C > 0.02) {
        var qn = run.done / run.C, backQ = Math.min(qn * 0.5, CFG.nanBack);
        run.spikes.push({ q: qn, L: lossAt(run, qn) * 1.6 });
        run.done = Math.max(0, run.done - backQ * run.C); run.nans++; S.stats.nans++;
        var q1 = run.done / run.C; run.pts = run.pts.filter(function (pt, i) { return i === 0 || pt[0] <= q1 + 1e-12; });
        log('NaN at ' + (qn * 100).toFixed(0) + '%');
        emit('nan', run);
      }
      run.done += g * CFG.flops[poolType(run.pool)] * dt;
      var q = Math.min(1, run.done / run.C), last = run.pts[run.pts.length - 1];
      if (q - last[0] > 0.004 || log10(q) - log10(last[0]) > 0.02 || q >= 1) {
        var Lq = lossAt(run, q) * Math.exp(gauss() * 0.012 * (1 - q) * (q < 1 ? 1 : 0));
        run.pts.push([q, Lq]);
      }
      while (run.cpNext < CFG.checkpoints.length && q >= CFG.checkpoints[run.cpNext]) {
        var cq = CFG.checkpoints[run.cpNext];
        if (cq < 1) { var cp = { q: cq, L: lossAt(run, cq), day: Math.floor(S.day) }; run.cps.push(cp); emit('checkpoint', { run: run, cp: cp }); }
        run.cpNext++;
      }
      while (run.autoNext < CFG.autoSample.length && q >= CFG.autoSample[run.autoNext]) {
        var aq = CFG.autoSample[run.autoNext]; run.autoNext++;
        var smp = makeSample(run, aq); run.lastSample = smp; emit('sample', smp);
      }
      if (q >= 1) land(run);
    }

    function capsOf(run) { return run.clean ? S.caps.filter(function (c) { return run.loss <= c.L; }) : []; }
    function land(run) {
      run.loss = Lline(run.C) * run.m; run.landDay = Math.floor(S.day); run.status = 'landing';
      S.run = null; S.runs.push(run);
      var caps = capsOf(run), firsts = [];
      caps.forEach(function (c) {
        if (c.contam == null) c.contam = c.id !== 'paragraph' && S.data.filters === 0 && rng() < CFG.contamination;
        if (!c.first) { c.first = true; firsts.push(c.id); }
      });
      run.caps = caps.map(function (c) { return { id: c.id, leaked: !!c.contam && S.data.filters === 0 && c.id !== 'paragraph', caught: !!c.contam && hasEvals() }; });
      run.caps.forEach(function (c) { if (c.leaked && !hasEvals()) c.caught = false; });
      if (firsts.length) staff().forEach(function (p) { moodAdd(p, CFG.capMood); });
      var landSmp = makeSample(run, 1, firsts.length ? firsts[firsts.length - 1] : null); run.lastSample = landSmp; run.landSample = landSmp;
      if (!run.clean) { S.data.seen = 2; }
      // rivals passed
      var passed = S.rivals.filter(function (rv) { var lp = rv.pubs[rv.pubs.length - 1]; return run.clean && run.C > lp.C; }).map(function (rv) { return rv.name; });
      run.passed = passed;
      log('land ' + sci(run.C) + ' L=' + run.loss.toFixed(3) + (run.clean ? ' clean' : ' PAST WALL') + (caps.length ? ' caps ' + caps.map(function (c) { return c.id; }).join('+') : ''));
      emit('land', { run: run, firsts: firsts, sample: landSmp });
      decide(landingDecision(run, firsts));
    }
    function claimed(run) { return (run.caps || []).filter(function (c) { return !(c.leaked && c.caught); }); }
    function undetectedLeak(run) { return (run.caps || []).some(function (c) { return c.leaked && !c.caught; }); }
    function scandalChance(run, kind, redteamed) {
      if (!run.clean) return CFG.scandal.pastWall;
      if (kind === 'publish' && undetectedLeak(run)) return 1;
      if (redteamed) return 0;
      if (kind === 'ship') return CFG.scandal.ship;
      return S.data.filters > 0 ? CFG.scandal.publishFiltered : CFG.scandal.publish;
    }
    function publishRepGain(run) { var rel = log10(run.C / Math.max(1e18, frontier())), novel = run.C > farthestOut() * 1.5 ? 1 : 0.3; return Math.max(1, Math.round((clamp(8 + 5 * rel, CFG.publishRep[0], CFG.publishRep[1]) + 2 * claimed(run).length) * novel)); }
    function apiRev(run) { var rev = 0; claimed(run).forEach(function (c) { rev = Math.max(rev, CFG.capRevenue[c.id]); }); return rev; }
    function canShip(run) { return run.clean && S.day >= CFG.shipFromDay && claimed(run).some(function (c) { return c.id === 'paragraph'; }); }
    function landingDecision(run, firsts) {
      var opts = [], rtDays = S.api ? CFG.redteamDaysApi : CFG.redteamDays, look = S.mer ? CFG.meridian.firstLook : 0;
      var qual = run.clean && run.C >= relevanceNeed();
      var pubNote = '+' + publishRepGain(run) + ' reputation · rivals close in on you within 2 weeks' + (qual ? ' · resets the forgotten clock' : ' · too small to reset the forgotten clock') + ' · scandal risk ' + Math.round(scandalChance(run, 'publish') * 100) + '%' + (look ? ' · Meridian looks first: out in ' + look + ' days' : '');
      opts.push({ key: 'publish', label: 'Publish the paper', note: pubNote, danger: scandalChance(run, 'publish') >= 0.5 });
      if (hasEvals()) opts.push({ key: 'publish_rt', label: 'Red-team, then publish', note: 'Out in ' + (rtDays + look) + ' days · scandal risk ' + Math.round(scandalChance(run, 'publish', true) * 100) + '% · same reputation' });
      if (canShip(run)) {
        var ser = servingNeed();
        opts.push({ key: 'ship', label: 'Ship it as an API', note: '+' + money(apiRev(run)) + '/month · ' + ser.n + ' cards from ' + POOLNAME[ser.pool] + ' go to serving · scandal risk ' + Math.round(scandalChance(run, 'ship') * 100) + '%' + (S.api ? ' · replaces your current API' : '') + (qual ? ' · resets the forgotten clock' : '') });
        if (hasEvals()) opts.push({ key: 'ship_rt', label: 'Red-team, then ship', note: 'Live in ' + (rtDays + look) + ' days · scandal risk 0%' });
      } else if (run.clean && S.day < CFG.shipFromDay) opts.push({ key: 'ship', label: 'Ship it as an API', disabled: true, note: 'Nobody sells model APIs yet: from 11 JUN 2020.' });
      else if (run.clean) opts.push({ key: 'ship', label: 'Ship it as an API', disabled: true, note: 'Needs a model that writes paragraphs.' });
      opts.push({ key: 'keep', label: 'Keep it private', note: 'Nobody learns from it. Counts for raises. Rivals don’t catch up. You can publish or ship it later.' });
      var capTxt = (run.caps || []).map(function (c) { return c.id + (c.leaked && c.caught ? ' (leaked test set: not claimed)' : ''); }).join(', ');
      var body = run.clean
        ? 'Landed at ' + run.loss.toFixed(3) + ' nats on ' + sci(run.C) + ' FLOPs (' + sizeWord(run.N) + ' params, ' + sizeWord(run.D) + ' tokens). ' + (run.loss <= Lline(run.C) * CFG.seriesA.onLine ? 'On the line.' : 'Above the line by ' + ((run.loss / Lline(run.C) - 1) * 100).toFixed(1) + '%.') + (capTxt ? ' Evals: ' + capTxt + '.' : ' Evals: no new capability.')
        : 'Landed at ' + run.loss.toFixed(3) + ' nats, but it ate ' + Math.round(run.r * 100) + '% of the clean-data wall: the second half was web boilerplate. A hollow dot that proves nothing.';
      if (!hasEvals() && run.clean && (run.caps || []).length > 1 && S.data.filters === 0) body += ' Nobody has checked whether the test sets were in the crawl.';
      return { kind: 'land', runId: run.id, from: 'TRAINING', title: (run.clean ? 'Run landed: ' : 'Run landed past the wall: ') + sci(run.C) + ' FLOPs', body: body, firsts: firsts, options: opts };
    }
    function servingNeed() { var tot = 0; POOLS.forEach(function (k) { tot += poolCards(k); }); var n = clamp(Math.round(tot * CFG.servingShare / 8) * 8, CFG.servingMin, CFG.servingMax); var pool = S.mer && merAlloc() ? 'meridian' : biggestPool(); return { n: Math.min(n, Math.max(0, poolCards(pool))), pool: pool }; }

    function release(run, kind, redteam) {
      var rtDays = redteam ? (S.api ? CFG.redteamDaysApi : CFG.redteamDays) : 0, look = S.mer ? CFG.meridian.firstLook : 0, delay = rtDays + look;
      run.status = delay ? 'pending-' + kind : kind; run.redteamed = !!redteam;
      if (redteam) { run.rtUntil = Math.floor(S.day) + rtDays; S.redteam = { runId: run.id, until: run.rtUntil }; }
      var go = function () { if (kind === 'publish') doPublish(run); else doShip(run); };
      if (delay) { S.events.push({ day: Math.floor(S.day) + delay, fn: go, tag: kind + run.id }); news((redteam ? 'Lena is red-teaming the ' + sci(run.C) + ' model. ' : '') + (look ? 'Meridian takes its first look. ' : '') + 'Out on ' + fmtShort(Math.floor(S.day) + delay) + '.', 'lab'); }
      else go();
    }
    function doPublish(run) {
      if (S.ended) return;
      run.status = 'published'; S.stats.published++;
      var gain = publishRepGain(run); S.rep = clamp(S.rep + gain, 0, 100);
      var qual = run.clean && run.C >= relevanceNeed();
      if (qual) S.relDeadline = Math.max(S.relDeadline, Math.floor(S.day) + CFG.relevanceDays);
      S.lastPublishDay = Math.floor(S.day);
      staff().forEach(function (p) { if (p.ego >= 3) moodAdd(p, CFG.publishMood); });
      if (S.firstAuthor && person('priya')) { S.firstAuthor = false; run.author = 'Raman et al.'; }
      var C = run.C;
      S.events.push({ day: Math.floor(S.day) + CFG.rivalSlideDelay, fn: function () {
        var who = [];
        S.rivals.forEach(function (rv) { var c = rivalC(rv, S.day); if (c < C) { rv.extra += CFG.rivalSlideExp * (log10(C) - log10(c)); who.push(rv.name); rv.last = 'built on your paper'; } });
        if (who.length) news(who.join(' and ') + ' reproduced your ' + sci(C) + ' paper and moved up.', 'rival');
      } });
      var p = scandalChance(run, 'publish', run.redteamed);
      if (rng() < p) { var leak = (run.caps || []).filter(function (c) { return c.leaked && !c.caught; })[0]; S.events.push({ day: Math.floor(S.day) + Math.round(U(CFG.scandal.delay[0], CFG.scandal.delay[1])), fn: function () { scandal(run, !run.clean ? 'pastWall' : leak ? 'contam' : 'publish', leak && leak.id); } }); }
      news('You published ' + (run.author ? run.author + ': ' : '') + 'a ' + sizeWord(run.N) + ' model at ' + sci(C) + ' FLOPs, loss ' + run.loss.toFixed(2) + '. Reputation +' + gain + '.', 'lab', { good: true });
      if (C >= 1e21 && !S.flags.openAsk && run.clean) { S.flags.openAsk = true; S.events.push({ day: Math.floor(S.day) + Math.round(U(8, 25)), fn: openWeightsLetter }); }
      if (person('priya') && !S.demands.priya && S.day >= 50) { S.demands.priya = 'due'; }
      emit('publish', run);
    }
    function doShip(run) {
      if (S.ended) return;
      if (S.api) { var old = S.runs.find(function (r) { return r.id === S.api.runId; }); if (old) old.status = 'retired'; }
      var ser = servingNeed();
      S.serving = { n: ser.n, pool: ser.pool };
      S.api = { runId: run.id, rev: apiRev(run), since: Math.floor(S.day), C: run.C };
      run.status = 'shipped'; S.stats.shipped++;
      S.rep = clamp(S.rep + CFG.shipRep, 0, 100);
      if (run.C >= relevanceNeed()) S.relDeadline = Math.max(S.relDeadline, Math.floor(S.day) + CFG.relevanceDays);
      var p = scandalChance(run, 'ship', run.redteamed);
      if (rng() < p) S.events.push({ day: Math.floor(S.day) + Math.round(U(CFG.scandal.delay[0], CFG.scandal.delay[1])), fn: function () { scandal(run, !run.clean ? 'pastWall' : 'ship'); } });
      news('Your API is live: ' + money(S.api.rev) + ' a month. ' + ser.n + ' cards now serve it.', 'lab', { good: true });
      emit('ship', run);
    }
    function scandal(run, kind, capId) {
      if (S.ended) return;
      var text = fill(WORLD.scandalText[kind] || WORLD.scandalText.publish, { cap: capId ? capId[0].toUpperCase() + capId.slice(1) : 'Your' });
      run.scandal = text; S.scandals++;
      decide({ kind: 'scandal', runId: run.id, from: 'THE PRESS', title: 'Scandal: the ' + sci(run.C) + ' model', body: text,
        options: [
          { key: 'retract', label: 'Apologise and retract', note: '−10 reputation · ' + (S.api && S.api.runId === run.id ? 'API pulled · ' : '') + 'no term sheets for 90 days' },
          { key: 'defend', label: 'Stand by it', note: '50%: it blows over (−5 reputation). 50%: −' + (CFG.scandal.rep + 10) + ' reputation, API pulled, no term sheets for 90 days, your team’s morale −25', danger: true }
        ] });
    }
    function pullApi(reason) { if (!S.api) return; var r = S.runs.find(function (x) { return x.id === S.api.runId; }); if (r) r.status = 'pulled'; S.api = null; S.serving = null; news('API pulled' + (reason ? ': ' + reason : '') + '.', 'lab', { bad: true }); }
    function openWeightsLetter() {
      if (S.ended) return;
      var best = farthestOut();
      var grey = S.mer ? 'Meridian: no. Its contract has a say over open weights.' : null;
      decide({ kind: 'open', from: 'THE FIELD', title: 'Grad students want your weights', body: 'Labs at three universities ask for the weights of your published ' + sci(best) + ' model.',
        options: [
          { key: 'release', label: 'Release the weights', disabled: !!grey, note: grey || '+10 reputation · new candidates ask 10% less · Kestrel and Northwind fine-tune it within a week (they move up)' },
          { key: 'decline', label: 'Decline', note: 'Northwind’s open model becomes what everyone builds on instead (Northwind moves up a little).' }
        ] });
    }

    /* ---------------- hiring, demands, poaching, offers ---------------- */
    function refreshBoard() {
      var day = Math.floor(S.day);
      Object.keys(WORLD.people).forEach(function (k) {
        var d = WORLD.people[k];
        if (d.founding || S.gone[k] || S.team.some(function (p) { return p.id === k; }) || S.board.some(function (b) { return b.id === k; })) return;
        var ok = d.from != null ? day >= d.from : false;
        if (d.needPub) ok = S.runs.some(function (r) { return r.clean && r.status === 'published' && r.C >= d.needPub; });
        if (k === 'rafael' && !person('dev') && S.team.some(function (p) { return p.id === 'dev'; })) ok = true;
        if (!ok) return;
        var ask = d.salary;
        if (k === 'ayaan' && S.day >= CFG.shipFromDay) ask = d.salaryLate;
        else if (S.gpt3) ask = Math.round(d.salary * CFG.askRiseAfterGpt3 / 1000) * 1000;
        if (S.flags.opened) ask = Math.round(ask * 0.9 / 1000) * 1000;
        S.board.push({ id: k, name: d.name, first: d.first, role: d.role, skill: d.skill, ask: ask, does: d.does, pitch: d.pitch, rival: d.rival, since: day, until: day + d.stay });
        news(d.name + ' (' + WORLD.roleNames[d.role] + ') is on the job market: ' + money(ask) + '/month.', 'team');
      });
      S.board = S.board.filter(function (b) {
        if (day >= b.until) {
          S.gone[b.id] = true;
          var rv = S.rivals.find(function (r) { return r.key === b.rival; }); if (rv) { rv.extra += CFG.rivalPassBoost; rv.hired.push(b.first); rv.last = 'hired ' + b.first; }
          news(b.name + ' signed with ' + (rv ? rv.name : 'a rival') + '.', 'rival');
          return false;
        }
        return true;
      });
    }
    function hire(id) {
      var b = S.board.find(function (x) { return x.id === id; }); if (!b) return { ok: false, why: 'Not on the board.' };
      S.board = S.board.filter(function (x) { return x !== b; });
      var p = addPerson(id); p.salary = b.ask; S.stats.hires++;
      news(p.name + ' joined as ' + WORLD.roleNames[p.role] + ' at ' + money(p.salary) + '/month.', 'team', { good: true });
      emit('hire', p); return { ok: true };
    }
    function demandsCheck() {
      var day = Math.floor(S.day);
      var pr = person('priya');
      if (pr && S.demands.priya === 'due' && S.stats.published >= 1 && day >= 60) {
        S.demands.priya = 'asked';
        decide({ kind: 'demand', who: 'priya', from: 'PRIYA RAMAN', title: 'First author, or I walk', body: 'I want first author on our next paper, or I walk.',
          options: [{ key: 'yes', label: 'Agree', note: 'Your next published paper carries her name. Priya’s morale +30.' }, { key: 'no', label: 'Refuse', note: 'She walks. You lose your data lead and her filter jobs.', danger: true }] });
        return;
      }
      var dv = person('dev');
      if (dv && S.raise.A && !S.demands.dev && day - S.raise.Aday >= 10) {
        S.demands.dev = 'asked';
        decide({ kind: 'demand', who: 'dev', from: 'DEV OKAFOR', title: 'One percent', body: 'One percent, or Halcyon gets my parallelism code.',
          options: [{ key: 'yes', label: 'Give him 1%', note: 'Your stake ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.devStake) + '.' }, { key: 'no', label: 'Refuse', note: 'He walks to Halcyon. Model size limit drops ×20.', danger: true }] });
        return;
      }
      var tm = person('tom');
      if (tm && S.flags.tomTired && !S.demands.tom) {
        S.demands.tom = 'asked';
        decide({ kind: 'demand', who: 'tom', from: 'TOMASZ WÓJCIK', title: 'A week off', body: 'I need a week off. I’ve been up every night.',
          options: [{ key: 'yes', label: 'Send him home for a week', note: '7 days without his restarts (hangs cost more). Morale +30.' }, { key: 'no', label: 'Not now', note: 'Tom’s morale −30.', danger: true }] });
        return;
      }
      var sh = person('sunhee');
      if (sh && !S.demands.sunhee && day - sh.joined >= 40) {
        S.demands.sunhee = 'asked';
        decide({ kind: 'demand', who: 'sunhee', from: 'SUN-HEE PARK', title: 'The schedule trick', body: 'I want to publish the schedule trick.',
          options: [{ key: 'yes', label: 'Let her publish it', note: 'She stays, and every rival lands 2.5% lower in 30 days (they move up). +5 reputation.' }, { key: 'no', label: 'Keep it secret', note: 'She walks to Halcyon.', danger: true }] });
        return;
      }
      var ay = person('ayaan');
      if (ay && S.day >= CFG.shipFromDay && !S.demands.ayaan) {
        S.demands.ayaan = 'asked';
        decide({ kind: 'demand', who: 'ayaan', from: 'AYAAN MEHTA', title: 'Halcyon called', body: 'Halcyon is offering me $55,000 a month. GPT-3 proved me right. Match it?',
          options: [{ key: 'yes', label: 'Match it', note: 'His salary ' + money(ay.salary) + ' → $55K a month.' }, { key: 'no', label: 'Wish him well', note: 'He walks to Halcyon.', danger: true }] });
      }
    }
    function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1).replace(/\.0$/, '') + '%'; }
    function poachCheck() {
      var st = staff(); if (S.day < CFG.poachFromDay || st.length < CFG.poachMinPeople || rng() > CFG.poachChance) return;
      var target = st.filter(function (p) { return p.id !== 'priya'; }).sort(function (a, b) { return a.mood - b.mood; })[0]; if (!target) return;
      var rv = pick(S.rivals), raise = S.gpt3 ? Math.round(target.salary * CFG.counterRaise / 1000) * 1000 : 0;
      decide({ kind: 'poach', who: target.id, rival: rv.key, raise: raise, from: rv.name.toUpperCase(), title: rv.name + ' wants ' + target.first, body: rv.name + ' offers ' + target.name + ' double. Counter with equity' + (raise ? ' and a raise' : '') + '?',
        options: [{ key: 'counter', label: 'Counter', note: 'Stake ' + pct(S.stake) + ' → ' + pct(S.stake - CFG.counterStake) + (raise ? ' · salary +' + money(raise) + '/month' : '') + ' · ' + target.first + '’s morale +20' }, { key: 'let', label: 'Let ' + (target.first) + ' go', note: target.first + ' walks to ' + rv.name + ' and ' + rv.name + ' moves up.', danger: true }] });
    }
    function acquiCheck() {
      if (S.day < 31 || S.flags.acquiAsked === monthOf(S.day)) return;
      if (runway() < CFG.acquiRunwayMonths) {
        S.flags.acquiAsked = monthOf(S.day);
        var n = staff().length + 1, price = n * CFG.acquiPerHead;
        decide({ kind: 'acqui', from: 'HALCYON', title: 'Halcyon will buy the team', body: 'We’ll buy the team: $4M a head, ' + money(price) + ' in all. Your people get rich. FRONTIER disappears.',
          options: [{ key: 'accept', label: 'Sell to Halcyon', note: 'The year ends: acquired.', danger: true }, { key: 'refuse', label: 'Keep going', note: 'Runway ' + runway().toFixed(1) + ' months.' }] });
      }
    }
    function buyoutCheck() {
      if (!S.gpt3 || S.flags.buyout || farthestClean() < 3e22 || S.day < 170) return;
      S.flags.buyout = true;
      var price = Math.max(S.post * 1.4, 2e8);
      decide({ kind: 'buyout', from: 'MERIDIAN CLOUD', title: 'Meridian wants to buy FRONTIER', body: 'After GPT-3 every cloud wants a lab. Meridian offers ' + money(price) + ' for the whole company. Your stake would be worth ' + money(price * S.stake) + '.',
        options: [{ key: 'accept', label: 'Sell', note: 'The year ends: acquired. You’re rich; FRONTIER is Meridian’s.', danger: true }, { key: 'refuse', label: 'Stay independent', note: 'Keep racing.' }] });
    }
    function decemberLetter() {
      var st = staff(); if (st.length < 3) return;
      var sender = person('priya') || st.slice().sort(function (a, b) { return b.ego - a.ego; })[0];
      var others = st.filter(function (p) { return p !== sender; }).sort(function (a, b) { return a.mood - b.mood; }).slice(0, 2);
      var leaving = [sender].concat(others);
      decide({ kind: 'december', who: leaving.map(function (p) { return p.id; }), from: sender.name.toUpperCase(), title: 'Something safer', body: others.map(function (p) { return p.first; }).join(' and ') + ' and I want to start something safer. We’re telling you first.',
        options: [{ key: 'bless', label: 'Let them go, with your blessing', note: leaving.map(function (p) { return p.first; }).join(', ') + ' leave on good terms. +5 reputation. Fewer people kept at New Year.' },
          { key: 'fight', label: 'Fight to keep them', note: 'Raise each of them 20% (' + money(leaving.reduce(function (a, p) { return a + p.salary * 0.2; }, 0)) + '/month). They stay. For now.' }] });
    }
    function meridianKnock() {
      if (S.mer || S.merOffer || S.merPassed) return;
      if (S.day < CFG.meridian.fromDay || farthestClean() < CFG.meridian.needC) return;
      S.merOffer = { cards: CFG.meridian.cards, stake: 0, credits: CFG.meridian.credits, kind: 'first' };
      decide({ kind: 'meridian', from: 'MERIDIAN CLOUD', title: 'Meridian wants to talk', body: '$50M in compute credits: ' + CFG.meridian.cards.toLocaleString('en-US') + ' V100s reserved for you, ready in ' + (CFG.meridian.lead / 7) + ' weeks. Our cloud only. We see every checkpoint first.',
        options: [{ key: 'sign', label: 'Sign with Meridian', note: '+' + CFG.meridian.cards + ' cards live ' + fmtShort(Math.floor(S.day) + CFG.meridian.lead) + ' · no other cloud (rentals end at their term) · every release waits 7 days · no open weights · from 11 JUN a queue cuts your cards if you fall behind' },
          { key: 'later', label: 'Not now', note: 'The offer stays in the Money panel until 15 JUN.' }] });
    }
    function signMeridian() {
      var o = S.merOffer; if (!o || S.mer) return { ok: false, why: 'No offer.' };
      S.mer = { cards: o.cards, alloc: o.cards, live: Math.floor(S.day) + CFG.meridian.lead, credits: o.credits, signed: Math.floor(S.day), second: o.kind === 'second' };
      if (o.stake) S.stake *= 1 - o.stake;
      S.merOffer = null;
      S.rentals.forEach(function (r) { r.renew = false; });
      news('You signed with Meridian: ' + o.cards + ' V100s, live ' + fmtShort(S.mer.live) + '. No other cloud from now on.', 'money', { good: true });
      emit('meridian', S.mer); stakeCheck(); return { ok: true };
    }

    /* ---------------- raises ---------------- */
    function marketClosed() { return S.day >= CFG.crashDay && S.day < CFG.reopenDay; }
    function seriesAProof() {
      var ok = S.runs.filter(function (r) { return r.clean && r.landDay >= CFG.lineDay && onLine(r); });
      var far = 0; ok.forEach(function (r) { if (r.C > far) far = r.C; });
      var paired = far > 0 && ok.some(function (r) { return log10(far / r.C) >= CFG.seriesA.decades * 0.98; });
      return { far: far, paired: paired, ok: far >= CFG.seriesA.needC && paired };
    }
    function rounds() {
      var out = [], blockedTerms = S.day < S.raise.blockUntil, closed = marketClosed();
      var pubC = farthestOut();
      out.push({ id: 'bridge', name: WORLD.investors.bridge.name, title: 'Bridge', cash: CFG.bridge.cash, post: CFG.bridge.post, done: S.raise.bridge,
        needs: [{ t: 'A published clean result ≥ ' + sci(CFG.bridge.needPubC), ok: pubC >= CFG.bridge.needPubC }, { t: 'Market open', ok: !closed }, { t: 'No scandal in the last 90 days', ok: !blockedTerms }] });
      var pa = seriesAProof(), pre = S.day < CFG.crashDay, terms = pre ? CFG.seriesA.pre : CFG.seriesA.post;
      out.push({ id: 'A', name: WORLD.investors.A.name, title: 'Series A', cash: terms.cash, post: terms.post, done: S.raise.A, note: pre ? 'Before the crash: $30M at $150M. After 15 JUN: $60M at $450M.' : 'After the crash: $60M at $450M.',
        needs: [{ t: 'Two clean dots on the line, a decade apart (after 23 JAN)', ok: pa.paired }, { t: 'The farther one ≥ 1e22 FLOPs (best: ' + (pa.far ? sci(pa.far) : 'none') + ')', ok: pa.far >= CFG.seriesA.needC }, { t: 'Market open' + (closed ? ' (closed until 15 JUN)' : ''), ok: !closed }, { t: 'No scandal in the last 90 days', ok: !blockedTerms }] });
      var bOk = S.runs.some(function (r) { return r.clean && r.C >= CFG.seriesB.needC && r.landDay >= CFG.seriesB.fromDay; });
      out.push({ id: 'B', name: WORLD.investors.B.name, title: 'Series B', cash: CFG.seriesB.cash, post: S.api ? CFG.seriesB.postApi : CFG.seriesB.post, done: S.raise.B, note: 'Post-money $600M, or $900M with a live API.',
        needs: [{ t: 'Series A done', ok: S.raise.A }, { t: 'A clean dot ≥ 3e22 landed after 11 JUN', ok: bOk }, { t: 'Market open', ok: !closed }, { t: 'No scandal in the last 90 days', ok: !blockedTerms }] });
      out.forEach(function (r) { r.ready = !r.done && r.needs.every(function (n) { return n.ok; }); r.stakeAfter = S.stake * (1 - r.cash / r.post); });
      return out;
    }
    function doRaise(id) {
      var r = rounds().find(function (x) { return x.id === id; }); if (!r) return { ok: false, why: 'No such round.' };
      if (!r.ready) return { ok: false, why: 'Not ready.' };
      S.bank += r.cash; S.stake = r.stakeAfter; S.post = r.post; S.raise[id] = true; if (id === 'A') S.raise.Aday = Math.floor(S.day);
      news(r.name + ' led your ' + r.title + ': ' + money(r.cash) + ' at a ' + money(r.post) + ' post. You own ' + pct(S.stake) + '.', 'money', { good: true });
      emit('raise', r); stakeCheck(); return { ok: true };
    }
    function stakeCheck() {
      if (S.stake < CFG.boardBelow && S.boardSellDay == null) {
        S.boardSellDay = nextFirst(S.day);
        news('You own ' + pct(S.stake) + ': the board has control and will sell the company to Halcyon on ' + fmtShort(S.boardSellDay) + '.', 'money', { bad: true });
      }
    }

    /* ---------------- market ---------------- */
    function market() {
      var day = S.day, price = rentPriceAt(day), cap = rentCapAt(day), held = rentedHeld();
      var lead = function (base) { return base + (day >= CFG.covidLeadFrom && day <= CFG.covidLeadTo ? CFG.covidLeadExtra : 0) + (S.gpt3 ? CFG.afterGpt3LeadExtra : 0); };
      var buys = Object.keys(CFG.buy).map(function (k) { var b = CFG.buy[k]; return { id: k, label: b.label, type: b.type, per: b.per, price: Math.round(b.price * (S.gpt3 ? CFG.afterGpt3PriceMult : 1)), lead: lead(b.lead), open: day >= b.fromDay, arrive: fmtShort(Math.floor(day) + lead(b.lead)) }; });
      var spot = S.day >= CFG.spot.fromDay && S.day < CFG.spot.untilDay && S.day >= S.spotNext ? { n: CFG.spot.n, price: CFG.spot.price, days: CFG.spot.days } : null;
      return { price: price, cap: cap, held: held, free: Math.max(0, cap - held), excl: !!S.mer, blocks: CFG.rentBlocks, buys: buys, spot: spot, leaseOk: !S.lease && S.owned.v >= CFG.leaseOut.minOwned && !(S.run && S.run.pool === 'office'), leaseN: Math.floor(S.owned.v * CFG.leaseOut.share / 8) * 8, leaseCash: Math.floor(S.owned.v * CFG.leaseOut.share / 8) * 8 * CFG.leaseOut.perHour * 24 * CFG.leaseOut.days };
    }
    function rent(n) {
      var mk = market(); n = Math.floor(n || 0);
      if (mk.excl) return { ok: false, why: 'Meridian: exclusive.' };
      if (n <= 0 || n > mk.free) return { ok: false, why: 'The broker has ' + mk.free + ' free.' };
      var cost = n * mk.price * 24 * CFG.rentTerm; if (S.bank < cost) return { ok: false, why: 'Need ' + money(cost) + ' in the bank for the first month.' };
      var st = Math.floor(S.day) + 1;
      S.rentals.push({ id: ++S.seq, n: n, price: mk.price, start: st, end: st + CFG.rentTerm, renew: true });
      news('Rented ' + n + ' V100s from ' + WORLD.broker + ' at $' + mk.price.toFixed(2) + '/hr, live tomorrow. ' + money(n * mk.price * 24 * 30.4) + ' a month.', 'money');
      emit('rent', n); return { ok: true };
    }
    function rentSpot() {
      var mk = market(); if (!mk.spot) return { ok: false, why: 'No spot block.' }; if (mk.excl) return { ok: false, why: 'Meridian: exclusive.' };
      var sp = mk.spot, cost = sp.n * sp.price * 24 * sp.days; if (S.bank < cost * 0.3) return { ok: false, why: 'Not enough cash.' };
      var st = Math.floor(S.day) + 1;
      S.rentals.push({ id: ++S.seq, n: sp.n, price: sp.price, start: st, end: st + sp.days, renew: false, spot: true });
      S.spotNext = Math.floor(S.day) + sp.days + 10;
      news('Took ' + sp.n + ' second-hand V100s from ' + WORLD.spotBroker + ' for ' + sp.days + ' days at $' + sp.price.toFixed(2) + '/hr.', 'money');
      emit('rent', sp.n); return { ok: true };
    }
    function toggleRenew(id) { var r = S.rentals.find(function (x) { return x.id === id; }); if (!r) return { ok: false }; r.renew = !r.renew; return { ok: true }; }
    function buy(item, qty) {
      var mk = market(), b = mk.buys.find(function (x) { return x.id === item; }); qty = Math.max(1, Math.floor(qty || 1));
      if (!b || !b.open) return { ok: false, why: 'Not for sale yet.' };
      var cost = b.price * qty; if (S.bank < cost) return { ok: false, why: 'Need ' + money(cost) + '.' };
      S.bank -= cost; S.orders.push({ id: ++S.seq, type: b.type, n: b.per * qty, ordered: Math.floor(S.day), arrive: Math.floor(S.day) + b.lead, cost: cost });
      news('Ordered ' + qty + '× ' + b.label + ' (' + (b.per * qty) + ' ' + (b.type === 'a100' ? 'A100s' : 'V100s') + ') for ' + money(cost) + ', arriving ' + b.arrive + '.', 'money');
      emit('buy', b); return { ok: true };
    }
    function leaseOut() {
      var mk = market(); if (!mk.leaseOk || mk.leaseN <= 0) return { ok: false, why: 'Nothing idle to lease.' };
      S.lease = { n: mk.leaseN, until: Math.floor(S.day) + CFG.leaseOut.days }; S.bank += mk.leaseCash; S.leaseTotal += mk.leaseCash;
      news('Leased ' + mk.leaseN + ' office V100s to ' + WORLD.broker + ' for 30 days: +' + money(mk.leaseCash) + ' now.', 'money', { good: true });
      emit('cash', mk.leaseCash); return { ok: true };
    }
    function startFilter() {
      var p = dataPerson(); if (!p) return { ok: false, why: 'You need a data person.' };
      if (S.data.job) return { ok: false, why: 'A filter job is already running.' };
      var cost = filterCost(); if (S.bank < cost) return { ok: false, why: 'Need ' + money(cost) + '.' };
      S.bank -= cost; S.data.job = { by: p.id, start: Math.floor(S.day), until: Math.floor(S.day) + filterDays(), cost: cost };
      news(p.first + ' started a filter job: ' + money(cost) + ', ' + filterDays() + ' days. The clean-data wall moves out ×' + CFG.filter.mult + ' when it lands.', 'lab');
      emit('filter', S.data.job); return { ok: true };
    }

    /* ---------------- the calendar ---------------- */
    var NEWS = WORLD.news.map(function (n) { return { day: iso(n[0]), text: n[1], tag: n[2], fx: n[3] }; }).sort(function (a, b) { return a.day - b.day; });
    function fireNews(n) {
      news(n.text, 'world', { tag: n.tag, real: true, fx: n.fx });
      if (n.fx === 'line') S.line = true;
      if (n.fx === 'crash') {
        news('The market is closed: no term sheets until 15 JUN. Hardware orders take 4 weeks longer until 30 JUN. Offices are shut, so a hang without an infra person costs an extra day.', 'money', { bad: true });
      }
      if (n.fx === 'gpt3') { S.gpt3 = true; news('The frontier is now 3.14e23. To stay relevant you need a published or shipped result ≥ ' + sci(relevanceNeed()) + '. Hardware costs 20% more and takes 8 weeks longer.', 'lab', { bad: true }); }
      if (n.fx === 'api') news('Shipping is open: a model that writes paragraphs can be sold as an API. ' + WORLD.broker + ' has no new capacity; renewals are refused half the time and cost $3.50.', 'money');
      if (n.fx === 'a100') news(WORLD.broker + ' takes orders for DGX A100s: $199,000 each, 12 weeks.', 'money');
      emit('world', n);
    }
    function payday() {
      var pay = payroll(); S.bank -= pay;
      S.lastPay = { day: Math.floor(S.day), pay: pay, bank: S.bank };
      emit('payroll', { pay: pay, bank: S.bank });
      if (S.bank < 0) { endYear('bankrupt', { pay: pay }); return false; }
      return true;
    }
    function monthly() {
      var m = monthOf(S.day);
      if (m === 0 && S.day < 1) return;
      // morale drift
      staff().forEach(function (p) { if (p.ego >= 3 && S.day - S.lastPublishDay > CFG.noPaperDays) moodAdd(p, -CFG.noPaperMood * (p.ego - 1), 'no papers for months'); });
      S.rep = clamp(S.rep - CFG.repDecayPerMonth, 0, 100);
      // Meridian queue
      if (S.mer && S.day >= CFG.meridian.queueFrom) {
        var fr = frontier(), far = farthestClean(), full = S.mer.cards, prev = S.mer.alloc;
        S.mer.alloc = S.priority ? full : far * CFG.meridian.full >= fr ? full : far * CFG.meridian.half >= fr ? full / 2 : full / 4;
        if (S.mer.alloc !== prev) news('Meridian’s queue: ' + S.mer.alloc + ' of your ' + full + ' cards this month' + (S.mer.alloc < full ? ' (your best clean dot ' + sci(far) + ' is ' + Math.round(fr / Math.max(far, 1)) + '× behind the frontier).' : '.'), 'money', { bad: S.mer.alloc < prev });
      }
      // API keeps you relevant
      if (S.api && S.api.C >= relevanceNeed()) S.relDeadline = Math.max(S.relDeadline, Math.floor(S.day) + CFG.relevanceDays);
      if (S.boardSellDay != null && S.day >= S.boardSellDay) { endYear('acquired', { board: true }); return; }
      acquiCheck();
      poachCheck();
      buyoutCheck();
    }
    function onNewDay(n) {
      if (n >= CFG.endDay) { if (S.bank < 0) { endYear('bankrupt', { pay: 0, newYear: true }); return; } endYear('survived'); return; }
      // orders, rentals, lease, Meridian, filter
      S.orders = S.orders.filter(function (o) { if (n >= o.arrive) { if (o.type === 'a100') S.owned.a += o.n; else S.owned.v += o.n; news(o.n + ' ' + (o.type === 'a100' ? 'A100s' : 'V100s') + ' arrived and are racked in the office.', 'lab', { good: true }); emit('arrive', o); return false; } return true; });
      S.rentals = S.rentals.filter(function (r) {
        if (!r.spot && r.renew && !r.noticed && r.end - n <= CFG.renewNoticeDays && n >= CFG.renewRefuseAfter) {
          r.noticed = true;
          if (rng() < CFG.renewRefuseShare) { r.renew = false; r.refused = true; news(WORLD.broker + ': capacity unavailable. Your ' + r.n + ' V100s go back on ' + fmtShort(r.end) + '.', 'money', { bad: true }); }
        }
        if (n >= r.end) {
          if (r.renew && !S.mer) { r.start = r.end; r.end = r.end + CFG.rentTerm; r.price = Math.max(r.price, rentPriceAt(n)); r.noticed = false; return true; }
          news('Your ' + r.n + ' rented V100s went back to ' + (r.spot ? WORLD.spotBroker : WORLD.broker) + '.', 'money'); emit('rentEnd', r); return false;
        }
        return true;
      });
      if (S.lease && n >= S.lease.until) { news('Your ' + S.lease.n + ' leased V100s are back.', 'lab'); S.lease = null; }
      if (S.mer && n === S.mer.live) news('Meridian is live: ' + S.mer.alloc + ' V100s are yours to train on.', 'money', { good: true });
      if (S.data.job && n >= S.data.job.until) { S.data.W *= CFG.filter.mult; S.data.filters++; S.stats.filters++; S.data.job = null; S.data.seen = 0; news('Filter job done: clean tokens ×' + CFG.filter.mult + '. The wall is now ~' + sizeWord(wallEstimate().mid) + ' tokens.', 'lab', { good: true }); emit('filterDone'); }
      if (S.redteam && n >= S.redteam.until) S.redteam = null;
      while (S.newsIdx < NEWS.length && NEWS[S.newsIdx].day <= n) fireNews(NEWS[S.newsIdx++]);
      if (n === CFG.reopenDay) news('Term sheets are back: investors are writing checks again, at post-GPT-3 prices.', 'money', { good: true });
      // scheduled events
      var due = S.events.filter(function (e) { return e.day <= n; }); S.events = S.events.filter(function (e) { return e.day > n; });
      due.forEach(function (e) { e.fn(); });
      if (S.ended) return;
      if (isFirst(n)) { if (!payday()) return; monthly(); if (S.ended) return; }
      if (S.mer && n >= S.mer.live) S.mer.credits = Math.max(0, S.mer.credits - S.mer.alloc * 24 * CFG.meridian.rate);
      // rivals
      S.rivals.forEach(function (rv) { if (n >= rv.nextPub) { rivalPublish(rv); rv.nextPub = n + rv.period * U(0.7, 1.3); } });
      refreshBoard();
      meridianKnock();
      if (S.merOffer && S.merOffer.kind === 'first' && n >= CFG.meridian.second.fromDay && !S.mer) { S.merOffer = null; S.merPassed = true; }
      if (!S.mer && !S.merOffer && S.merPassed && !S.merSecondOffered && n >= CFG.meridian.second.fromDay) {
        S.merSecondOffered = true; S.merOffer = { cards: CFG.meridian.second.cards, stake: CFG.meridian.second.stake, credits: CFG.meridian.credits / 2, kind: 'second' };
        news('Meridian is back: ' + CFG.meridian.second.cards + ' V100s, ready in 6 weeks, for 10% of FRONTIER. The offer is in the Money panel.', 'money');
      }
      if (S.data.job == null && S.flags.frayed && !S.flags.frayNews && dataPerson()) { S.flags.frayNews = true; news(dataPerson().first + ': the samples have junk in them. SEO spam. A filter job would push the wall out.', 'lab'); }
      if (!S.inbox.length) demandsCheck();
      if (n === 355 && !S.flags.december) { S.flags.december = true; decemberLetter(); }
      if (n >= S.relDeadline) { endYear('forgotten'); return; }
      // history
      S.hist.bank.push(S.bank); S.hist.burn.push(burn()); S.hist.rep.push(S.rep); S.hist.pf.push(pfPerDay()); S.hist.util.push(utilisation()); S.hist.rev.push(S.api ? S.api.rev : 0);
      emit('day', n);
    }

    function advance(days) {
      if (S.phase !== 'play') return 0;
      var left = days, moved = 0;
      while (left > 1e-9 && S.phase === 'play') {
        if (blocked()) break;
        var step = Math.min(left, CFG.maxStepDays), nextDay = Math.floor(S.day + 1e-9) + 1;
        if (S.day + step > nextDay) step = nextDay - S.day;
        stepRun(step);
        S.bank += (apiPerDay() - rentPerDay()) * step;
        if (S.api) S.revenueTotal += apiPerDay() * step;
        S.day += step; left -= step; moved += step;
        if (S.day >= nextDay - 1e-9) { S.day = nextDay; onNewDay(nextDay); }
      }
      return moved;
    }

    /* ---------------- answers ---------------- */
    function answer(id, choice) {
      var item = S.inbox.find(function (x) { return x.id === id; }) || (id == null ? S.inbox[0] : null);
      if (!item) return { ok: false, why: 'No such decision.' };
      var opt = item.options.find(function (o) { return o.key === choice; });
      if (!opt || opt.disabled) return { ok: false, why: 'Not an option.' };
      S.inbox = S.inbox.filter(function (x) { return x !== item; });
      item.choice = choice; item.answeredDay = Math.floor(S.day); S.answered.unshift(item); if (S.answered.length > 40) S.answered.pop();
      var p = item.who && typeof item.who === 'string' ? person(item.who) : null, run = item.runId ? S.runs.find(function (r) { return r.id === item.runId; }) : null;
      log('answer ' + item.kind + ' ' + choice);
      switch (item.kind) {
        case 'land':
          if (choice === 'publish') release(run, 'publish', false);
          else if (choice === 'publish_rt') release(run, 'publish', true);
          else if (choice === 'ship') release(run, 'ship', false);
          else if (choice === 'ship_rt') release(run, 'ship', true);
          else { run.status = 'private'; news('The ' + sci(run.C) + ' model stays in the vault.', 'lab'); }
          break;
        case 'scandal':
          var lose = choice === 'defend' && rng() < 0.5;
          if (choice === 'retract' || lose) {
            S.rep = clamp(S.rep - (choice === 'retract' ? 10 : CFG.scandal.rep + 10), 0, 100); S.raise.blockUntil = Math.floor(S.day) + CFG.termBlockDays;
            if (S.api && run && S.api.runId === run.id) pullApi('the scandal');
            if (lose) { staff().forEach(function (q) { moodAdd(q, -CFG.scandal.mood, 'the scandal'); }); if (S.api) pullApi('the scandal'); }
            if (run) run.status = choice === 'retract' ? 'retracted' : run.status;
            news(choice === 'retract' ? 'You retracted the ' + sci(run ? run.C : 0) + ' result. Reputation −10; no term sheets for 90 days.' : 'Standing by it went badly. Reputation −' + (CFG.scandal.rep + 10) + '; no term sheets for 90 days.', 'lab', { bad: true });
          } else { S.rep = clamp(S.rep - 5, 0, 100); news('The scandal blew over. Reputation −5.', 'lab'); }
          break;
        case 'open':
          if (choice === 'release') { S.flags.opened = true; S.rep = clamp(S.rep + 10, 0, 100); S.board.forEach(function (b) { b.ask = Math.round(b.ask * 0.9 / 1000) * 1000; }); S.events.push({ day: Math.floor(S.day) + 7, fn: function () { S.rivals.forEach(function (rv) { if (rv.key !== 'halcyon') { rv.extra += CFG.openBoost; rv.last = 'fine-tuned your weights'; } }); news('Kestrel and Northwind fine-tuned your open weights and moved up.', 'rival'); } }); news('You released the weights. Reputation +10.', 'lab', { good: true }); }
          else { var nw = S.rivals.find(function (r) { return r.key === 'northwind'; }); nw.extra += 0.1; }
          break;
        case 'demand':
          if (item.who === 'priya') { if (choice === 'yes') { S.firstAuthor = true; moodAdd(p, 30); } else walk(p, null, 'you refused her first authorship'); }
          if (item.who === 'dev') { if (choice === 'yes') { S.stake = Math.max(0, S.stake - CFG.devStake); moodAdd(p, 20); stakeCheck(); } else walk(p, 'halcyon', 'you refused him 1%'); }
          if (item.who === 'tom') { if (choice === 'yes') { S.tomOffUntil = Math.floor(S.day) + 7; moodAdd(p, 30); } else moodAdd(p, -30, 'no week off'); }
          if (item.who === 'sunhee') { if (choice === 'yes') { S.rep = clamp(S.rep + 5, 0, 100); S.events.push({ day: Math.floor(S.day) + 30, fn: function () { S.rivals.forEach(function (rv) { rv.extra += 0.22; }); news('Every lab now trains with Sun-hee’s schedule: rivals land 2.5% lower.', 'rival'); } }); } else walk(p, 'halcyon', 'you kept her trick secret'); }
          if (item.who === 'ayaan') { if (choice === 'yes') { p.salary = 55000; moodAdd(p, 15); } else walk(p, 'halcyon', 'Halcyon paid more'); }
          break;
        case 'poach':
          if (!p) break;
          if (choice === 'counter') { S.stake = Math.max(0, S.stake - CFG.counterStake); moodAdd(p, CFG.counterMood); if (item.raise) p.salary += item.raise; stakeCheck(); }
          else walk(p, item.rival, 'poached at double the salary');
          break;
        case 'acqui': if (choice === 'accept') endYear('acquired', { acqui: true, price: (staff().length + 1) * CFG.acquiPerHead }); break;
        case 'buyout': if (choice === 'accept') endYear('acquired', { buyout: true }); break;
        case 'meridian': if (choice === 'sign') signMeridian(); else news('Meridian’s offer stays open in the Money panel until 15 JUN.', 'money'); break;
        case 'december':
          var ids = item.who;
          if (choice === 'bless') { ids.forEach(function (k) { var q = person(k); if (q) walk(q, null, 'left to start something safer, with your blessing'); }); S.rep = clamp(S.rep + 5, 0, 100); }
          else ids.forEach(function (k) { var q = person(k); if (q) { q.salary = Math.round(q.salary * 1.2); moodAdd(q, 10); } });
          S.choice = choice;
          break;
      }
      emit('answered', item);
      return { ok: true };
    }

    /* ---------------- ending and score ---------------- */
    function score() {
      var b = bestClean(), C = b ? b.C : 0, sc = CFG.score;
      var model = C > 0 ? Math.round(sc.model * clamp((log10(C) - sc.floorLog) / (log10(CFG.gpt3C) - sc.floorLog), 0, 1.25)) : 0;
      var miracle = b && C >= CFG.gpt3C * CFG.miracleCTol && b.loss <= CFG.gpt3Loss * CFG.miracleLTol ? sc.miracle : 0;
      var rep = Math.round(S.rep * sc.rep), rev = Math.round(S.revenueTotal / sc.revPer), ppl = staff().length * sc.person;
      return { total: model + miracle + rep + rev + ppl, model: model, miracle: miracle, rep: rep, rev: rev, people: ppl, bestC: C, bestL: b ? b.loss : null, ratio: C > 0 ? CFG.gpt3C / C : null };
    }
    function endYear(kind, extra) {
      if (S.ended) return;
      extra = extra || {};
      S.phase = 'over'; S.inbox = [];
      var lines = [], sc = score(), b = bestClean();
      if (kind === 'bankrupt') {
        var bp = burnParts();
        lines.push(extra.newYear ? 'The year ended with ' + money(S.bank) + ' in the bank: the lab could not make the New Year payroll.' : 'Payroll on ' + fmtDate(S.day) + ' needed ' + money(extra.pay) + ' and the bank had ' + money(S.bank + extra.pay) + '.');
        lines.push('You were spending ' + money(burn()) + ' a month: ' + money(bp.salaries) + ' salaries, ' + money(bp.cloud) + ' cloud, ' + money(bp.office + bp.upkeep + bp.priority) + ' office and racks' + (bp.api ? ', against ' + money(bp.api) + ' of API revenue' : '') + '.');
      } else if (kind === 'acquired') {
        if (extra.board) lines.push('You owned ' + pct(S.stake) + ' of FRONTIER, under half, so the board sold the company to Halcyon on ' + fmtDate(S.day) + '.');
        else if (extra.acqui) lines.push('With ' + runway().toFixed(1) + ' months of money left you sold the team to Halcyon for ' + money(extra.price) + '. Your people are rich; FRONTIER is gone.');
        else lines.push('You sold FRONTIER to Meridian on ' + fmtDate(S.day) + '. You are rich; the race goes on without you.');
      } else if (kind === 'forgotten') {
        var out = farthestOut();
        lines.push('Nothing you published or shipped in the last ' + CFG.relevanceDays + ' days was big enough for anyone to care: the world reads labs with a result ≥ ' + sci(relevanceNeed()) + ' FLOPs, 1% of the frontier (' + sci(frontier()) + ').');
        lines.push(out ? 'Your biggest released result was ' + sci(out) + '.' : 'You never published or shipped a clean result.');
      } else {
        lines.push('FRONTIER is standing on 31 DEC 2020 with ' + money(S.bank) + ' in the bank and ' + plural(staff().length, 'person') + ' on the team.');
      }
      if (b) {
        if (sc.miracle) lines.push('The miracle: your ' + sci(b.C) + ' model matched GPT-3 in 2020 (loss ' + b.loss.toFixed(3) + ' vs 1.763).');
        else if (b.C >= CFG.gpt3C) lines.push('Your best clean model, ' + sci(b.C) + ' FLOPs at ' + b.loss.toFixed(3) + ' nats, went past GPT-3’s compute.');
        else lines.push('Your best clean model: ' + sci(b.C) + ' FLOPs at ' + b.loss.toFixed(3) + ' nats, ' + (CFG.gpt3C / b.C).toFixed(CFG.gpt3C / b.C >= 10 ? 0 : 1) + '× short of GPT-3 (3.14e23, 1.763).');
      } else lines.push('You never landed a clean model.');
      S.ended = { kind: kind, day: Math.floor(S.day), lines: lines, score: sc, head: WORLD.ends[kind].head, sub: WORLD.ends[kind].sub, extra: extra };
      if (S.run) S.run = null;
      log('END ' + kind);
      emit('end', S.ended);
    }

    /* ---------------- public API ---------------- */
    function start() { if (S.phase !== 'intro') return; S.phase = 'play'; news('FRONTIER opens on ' + fmtDate(0) + ' with ' + money(CFG.seedCash) + ' of seed money, one DGX-1 (8 V100s) and Priya.', 'lab'); onNewDay(0); emit('start'); }
    function act(name, a) {
      a = a || {};
      if (S.phase === 'over' && name !== 'state') return { ok: false, why: 'The year is over.' };
      switch (name) {
        case 'start': start(); return { ok: true };
        case 'hire': return hire(a.id);
        case 'fire': { var p = person(a.id); if (!p || p.id === 'priya' && staff().length === 1) return { ok: false }; walk(p, null, 'let go'); staff().forEach(function (q) { moodAdd(q, -5); }); return { ok: true }; }
        case 'raisePay': { var q = person(a.id); if (!q) return { ok: false }; q.salary = Math.round(q.salary * CFG.raiseMult / 100) * 100; moodAdd(q, CFG.raiseMood); return { ok: true }; }
        case 'rent': return a.spot ? rentSpot() : rent(a.gpus);
        case 'renew': return toggleRenew(a.id);
        case 'buy': return buy(a.item, a.qty);
        case 'lease': return leaseOut();
        case 'raise': return doRaise(a.round);
        case 'meridian': return signMeridian();
        case 'priority': { if (!S.mer || S.day < CFG.meridian.queueFrom - 30) return { ok: false }; S.priority = !S.priority; if (S.priority) S.mer.alloc = S.mer.cards; return { ok: true }; }
        case 'filter': return startFilter();
        case 'launch': return launch({ params: a.params, tokens: a.tokens, gpus: a.gpus, pool: a.pool });
        case 'abort': { if (!S.run) return { ok: false }; var r0 = S.run; S.run = null; S.stats.aborted++; staff().forEach(function (q) { moodAdd(q, -CFG.abortMood); }); news('You stopped the ' + sci(r0.C) + ' run at ' + Math.round(r0.done / r0.C * 100) + '%. Nothing proved.', 'lab', { bad: true }); emit('abort', r0); return { ok: true }; }
        case 'sample': { var run = S.run || S.runs[S.runs.length - 1]; if (!run) return { ok: false }; var qq = a.q != null ? a.q : run === S.run ? (run.cps.length ? run.cps[run.cps.length - 1].q : Math.max(P0, run.done / run.C)) : 1; var s = makeSample(run, qq); run.lastSample = s; emit('sample', s); return { ok: true, sample: s }; }
        case 'wake': { var h = S.run && S.run.hang; if (!h) return { ok: false }; var wp = person(a.id) || staff()[0]; h.until = Math.min(h.until, S.day + CFG.wakeDays); moodAdd(wp, -CFG.wakeMood, 'woken at night once too often'); news('You woke ' + wp.first + ' at ' + h.at + '. Restarting in 20 minutes.', 'lab'); return { ok: true }; }
        case 'answer': return answer(a.id, a.choice);
        case 'publish': case 'ship': case 'keep': {
          if (S.inbox.length && S.inbox[0].kind === 'land') return answer(S.inbox[0].id, name === 'keep' ? 'keep' : a.redteam && hasEvals() ? name + '_rt' : name);
          var pr = S.runs.find(function (r) { return r.id === a.id; }) || S.runs.filter(function (r) { return r.status === 'private'; }).pop();
          if (!pr || pr.status !== 'private' || name === 'keep') return { ok: false };
          if (name === 'ship' && !canShip(pr)) return { ok: false, why: 'Can’t ship that one.' };
          release(pr, name, !!a.redteam && hasEvals()); return { ok: true };
        }
        case 'advance': return { ok: true, moved: advance(a.days || 1) };
      }
      return { ok: false, why: 'Unknown action ' + name };
    }

    return {
      S: S, CFG: CFG, act: act, advance: advance, blocked: blocked, design: design, market: market, rounds: rounds,
      lossAt: lossAt, Lline: Lline, recipeSplit: recipeSplit, recipeTokens: recipeTokens, allocMult: allocMult,
      poolCards: poolCards, POOLS: POOLS, POOLNAME: POOLNAME, physicalCards: physicalCards, pfPerDay: pfPerDay, utilisation: utilisation, effGpus: effGpus, runRate: runRate,
      burn: burn, burnParts: burnParts, netBurn: netBurn, runway: runway, payroll: payroll, rentPerDay: rentPerDay, leased: leased, merAlloc: merAlloc, rentedLive: rentedLive,
      frontier: frontier, relevanceNeed: relevanceNeed, horizon: horizon, farthestClean: farthestClean, farthestOut: farthestOut, bestClean: bestClean, rivalC: rivalC, rivalGpus: rivalGpus,
      wallEstimate: wallEstimate, wallTokens: wallTokens, filterCost: filterCost, filterDays: filterDays, dataPerson: dataPerson, memLimit: memLimit, staff: staff, person: person, countRole: countRole,
      seriesAProof: seriesAProof, marketClosed: marketClosed, score: score, canShip: canShip, claimed: claimed, sunheeLive: sunheeLive, hasEvals: hasEvals, hasScaling: hasScaling, infraCount: infraCount,
      fmtDate: fmtDate, fmtDow: fmtDow, fmtShort: fmtShort, money: money, sci: sci, sizeWord: sizeWord, pct: pct, plural: plural, nextFirst: nextFirst, dateOf: dateOf, MONTHS: MONTHS
    };
  }
  var E = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.FrontierEngine = E;
})(this);
