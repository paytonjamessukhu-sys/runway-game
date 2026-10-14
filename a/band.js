/* FRONTIER, the bottom of the sheet: the strip of cells (your cluster), OPTIONS (everything you can do right now, each with its price and what
   it does to the curve) and THE MODELS WE BUILD (a plaque on the shelf for every model, for the rest of the game). Also the handwritten names
   down the margin of the paper. Nothing here decides a rule: every number comes from the engine. */
(function () {
  'use strict';
  var FX = window.FX, CFG = FX.CFG, W = FX.W, FE = FX.FE, AU = FX.AU, $ = FX.$, ui = FX.ui;
  var esc = FX.esc, money = FX.money, setHTML = FX.setHTML, setText = FX.setText, clamp = FE.clamp, log10 = FE.log10, bigNum = FE.bigNum, pct = FE.pct;
  function E() { return FX.E; }
  function S() { return FX.S; }
  function nice(m) { return FX.fmtRunway(m); }
  function weeks(d) { return d < 14 ? Math.round(d) + ' days' : Math.round(d / 7) + ' weeks'; }

  /* ================= the handwritten names down the margin ================= */
  var seenPeople = {};
  FX.renderMargin = function () {
    var e = E(), s = S(), ol = $('margin'); if (!s || !ol) return;
    var h = '', everyone = s.team.slice(), n = 0;
    everyone.forEach(function (p) {
      if (p.gone && everyone.filter(function (q) { return q.gone; }).indexOf(p) < everyone.filter(function (q) { return q.gone; }).length - 3) return;
      var low = !p.gone && p.mood < CFG.moodLow, wt = clamp(Math.round(380 + p.mood * 3.2), 400, 700), fresh = !seenPeople[p.key + ui.seed] ? ' fresh-ink' : '';
      seenPeople[p.key + ui.seed] = 1; n++;
      h += '<li data-k="m-' + p.key + '"><button type="button" class="' + (low ? 'low' : '') + (p.gone ? ' gone' : '') + (ui.sel === 'p:' + p.key ? ' sel' : '') + fresh + '" data-act="tile" data-sel="p:' + p.key + '" data-goto="team" aria-label="' + esc(p.name) + (p.gone ? ', left' : ', ' + W.roles[p.role] + ', morale ' + Math.round(p.mood)) + '"><span class="w" style="font-weight:' + (p.gone ? 400 : wt) + '">' + esc(p.first) + '</span>' + (p.gone ? '<i class="x"></i>' : '') + '</button></li>';
    });
    var cand = s.cands.slice().sort(function (a, b) { return a.courtBy - b.courtBy; })[0];
    if (cand) { n++; h += '<li class="plus" data-k="m-plus"><button type="button" data-act="tile" data-sel="c:' + cand.key + '" data-goto="team" aria-label="On the board: ' + esc(W.people[cand.key].name) + '"><span class="w">+ ' + esc(W.people[cand.key].first) + '</span></button></li>'; }
    setHTML(ol, h);
    var ph = $('chartwrap') ? $('chartwrap').clientHeight : 300;
    FX.setClass(ol, 'dense', n * 28 + 40 > ph - 70);
  };

  /* ================= OPTIONS: everything you can do now ================= */
  function pencilWhy(o, why) { o.lock = true; o.effect = why; return o; }
  FX.buildOptions = function () {
    var e = E(), s = S(), out = [];
    if (!s) return out;
    if (s.phase === 'over') return [{ key: 'newyear', title: 'Play another 2020', effect: 'new hidden data wall, rivals and luck', price: '', act: 'newyear', btn: 'Play', primary: true, rank: 0 }];
    var live = s.phase === 'play', rb = e.raiseBlock(), pv = FX.pulseVerb();

    // the run designer's launch: the one primary action
    var p = ui.lastDesign;
    if (p) {
      var ok = p.ok && !e.blocked() && live, short = isFinite(p.C) ? e.shortFmt(e.shortOf(p.C)) : '';
      var busy = e.activeRuns(), nextFree = null;
      busy.forEach(function (r) { var type = e.poolType(r.pool), per = r.cards * CFG.card[type].flops * e.scaleEff(r.cards), left = per > 0 ? (r.C - r.done) / per : Infinity; if (nextFree == null || left < nextFree) nextFree = left; });
      var lo = { key: 'launch', id: 'd-launch', title: s.runs.length ? 'Start the next run' : 'Start the run', act: 'launch', btn: 'Start', primary: true, rank: 10 };
      if (ok) { lo.effect = 'lands ' + p.landTxt + ' · error ' + p.proj.toFixed(2) + ' · ' + short + ' short'; lo.price = money(p.cost) + ' · ' + (isFinite(p.daysAll) ? FX.days(p.daysAll) : '—'); }
      else {
        lo.lock = true; lo.price = '';
        var why = p.blockers[0] ? p.blockers[0].split(':')[0] : '';
        lo.effect = !p.cards || (!p.ok && e.activeRuns().length) ? 'all cards busy' + (nextFree != null && isFinite(nextFree) ? ': one frees in ' + FX.days(nextFree) : '') : (why ? 'can’t start: ' + why.toLowerCase() : 'not yet');
        if (!e.activeRuns().length && p.blockers[0]) lo.effect = p.blockers[0];
      }
      if (ok && e.activeRuns().length === 0 && !s.runs.length) lo.pulse = ui.introPulse;
      out.push(lo);
    }

    // hire: one line per candidate, with the fuse that burns until a rival courts them away
    var cands = s.cands.slice().sort(function (a, b) { return a.courtBy - b.courtBy; });
    cands.slice(0, 3).forEach(function (c) {
      var d = W.people[c.key], ask = e.candAsk(c), req = e.candReq(c), left = Math.max(0, c.courtBy - s.day), after = s.bank / Math.max(1, e.burn() + ask);
      var o = { key: 'hire-' + c.key, title: 'Hire ' + d.first, act: 'hire', attrs: ' data-id="' + c.key + '"', btn: 'Hire', price: money(ask) + ' a month', more: { row: 'team', sel: 'c:' + c.key }, rank: 20, fuse: clamp(left / CFG.courtDays * 100, 0, 100) };
      if (req) { o.lock = true; o.effect = req; o.fuse = null; }
      else o.effect = W.roles[d.role].toLowerCase() + ' · months until broke ' + nice(e.runway()) + ' → ' + nice(after);
      if (!live) o.lock = true;
      if (pv === 'hire' && out.every(function (x) { return !x.pulse; }) && !req) o.pulse = true;
      out.push(o);
    });

    // raise: grey until legal, with the reason
    var rn = rb.next, rs = e.roundStatus(rn), t = rs.terms, rname = rn === 'A' ? 'Series A' : rn === 'B' ? 'Series B' : 'Bridge note';
    var ro = { key: 'raise', title: 'Raise', act: 'pitch', attrs: ' data-round="' + rn + '"', btn: 'Pitch', rank: 30, more: { row: 'money', to: 'raise-block' } };
    if (rs.ok && live) { ro.price = rn === 'bridge' ? money(t.cash) + ' for ' + pct(t.stake) : money(t.cash) + ' at ' + money(t.post); ro.effect = rname + ' · you own ' + pct(s.stake, 0) + ' → ' + pct(rs.stakeAfter, 0); if (pv === 'raise') ro.pulse = true; }
    else { ro.lock = true; ro.price = ''; ro.effect = (rs.why[0] && rs.why[0] !== 'Raised.') ? rs.why[0] : rname + ' is not open'; }
    var dl = s.raise.diligence;   // investors are checking: a fuse burns down to the date they decide
    if (dl && dl.until > s.day) { ro.lock = true; ro.fuse = clamp((dl.until - s.day) / Math.max(1, dl.until - dl.start) * 100, 0, 100); ro.fuseLive = true; ro.effect = 'investors checking until ' + e.fmtDay(dl.until); }
    out.push(ro);

    // buy data: clean the crawl
    var ds = e.staff().filter(function (q) { return q.role === 'data'; }), cost = e.filterCost(), dd = e.filterDays();
    var dO = { key: 'data', title: 'Buy data', act: 'filter', btn: 'Clean', rank: 40, more: { row: 'data', to: 'clean-block' } };
    if (s.filterJob) pencilWhy(dO, 'cleaning the crawl: ' + Math.max(0, Math.ceil(s.filterJob.until - s.day)) + ' days left');
    else if (!ds.length) pencilWhy(dO, 'needs a data person on the team');
    else { dO.price = money(cost) + ' · ' + dd + ' days'; dO.effect = 'clean the crawl: +' + Math.round((e.filterMult(s.filters) - 1) * 100) + '% fresh text'; if (cost > s.bank) { dO.lock = true; dO.effect = 'short ' + money(cost - s.bank) + ' for the crawl cleaning'; } if (!live) dO.lock = true; if (pv === 'data') dO.pulse = true; }
    out.push(dO);

    // rent cards
    var price = e.rentPrice(), cap = e.rentCap(), have = e.rentedCount(), room = Math.max(0, cap - have), n = clamp(ui.rentN, 8, Math.max(8, room));
    var rO = { key: 'rent', title: 'Rent cards', act: 'rent', attrs: ' data-gpus="' + n + '"', btn: 'Rent ' + n, rank: 50, more: { row: 'cluster', to: 'rent-block' } };
    if (s.mer) pencilWhy(rO, 'closed: you signed with Meridian, so no other cloud');
    else if (room < 8) pencilWhy(rO, 'the broker has none left');
    else {
      var base = CFG.startOwnedV100 * CFG.card.v100.flops, spNow = e.trainingSpeed(), spNew = (e.flopsPerDay(true) + n * CFG.card.v100.flops) / base;
      rO.price = money(n * price * 24 * CFG.daysPerMonth) + ' a month'; rO.effect = n + ' V100s tomorrow · x' + spNow.toFixed(1) + ' → up to x' + (spNew >= 100 ? Math.round(spNew) : spNew.toFixed(1));
      if (!live) rO.lock = true; if (pv === 'rent') rO.pulse = true;
    }
    out.push(rO);

    // buy cards: the box you can afford
    var item = s.day >= e.D(CFG.buy.dgxa100.from) ? 'dgxa100' : 'dgx1', spec = CFG.buy[item], u = clamp(ui.buy[item] || 1, 1, CFG.buyMaxUnits), unit = e.buyPrice(item, s.day);
    if (u * unit > s.bank && unit <= s.bank) u = Math.max(1, Math.floor(s.bank / unit));   // the stepper asks for more than you hold: the option offers what you can pay for
    var total = unit * u, lead = e.leadFor(item, s.day), arrive = Math.floor(s.day) + lead;
    var bO = { key: 'buy', title: 'Buy cards', act: 'buy', attrs: ' data-item="' + item + '" data-units="' + u + '"', btn: 'Buy ' + u, rank: 60, more: { row: 'cluster', to: 'row-cluster' } };
    if (s.bought && (s.bought[item] || 0) + u > spec.yearCap) pencilWhy(bO, 'the reseller will not sell a startup more than ' + spec.yearCap + ' this year');
    else {
      bO.price = money(total) + ' · ' + u * spec.cards + ' cards';
      var last = s.runs.length ? s.runs[s.runs.length - 1] : null, eff = '';
      if (last) { var now = Math.max(1, last.want), fl = now * e.cardFlops(last.pool), add = u * spec.cards * CFG.card[spec.type].flops, dN = last.C / (fl * e.scaleEff(now)), dW = last.C / ((fl + add) * e.scaleEff(now + u * spec.cards)); eff = ' · a run like run ' + last.id + ': ' + FX.days(dN) + ' → ' + FX.days(dW); }
      bO.effect = spec.short + ' here ' + (arrive > 365 ? 'next year' : e.fmtDay(arrive)) + (eff && eff.length < 44 ? eff : '');
      if (total > s.bank) { bO.lock = true; bO.effect = spec.short + ': short ' + money(total - s.bank) + ' · here ' + (arrive > 365 ? 'next year' : e.fmtDay(arrive)); }
      if (!live) bO.lock = true;
    }
    out.push(bO);

    // rent out idle cards, and Meridian's priority lane
    var idleOwn = e.poolFree('office'), idleA = e.poolFree('a100');
    if (idleOwn + idleA > 0 && s.runs.length) {
      var cashOut = idleOwn * CFG.rentOutPerHour.v100 * 24 * CFG.rentOutDays + idleA * CFG.rentOutPerHour.a100 * 24 * CFG.rentOutDays;
      out.push({ key: 'rentout', title: 'Rent out idle cards', act: 'rentOut', btn: 'Rent out', price: '+' + money(cashOut) + ' now', effect: (idleOwn + idleA) + ' idle cards for ' + CFG.rentOutDays + ' days; they can’t train meanwhile', rank: 70, lock: !live });
    }
    if (s.mer) {
      var pc = CFG.meridian.priorityPerCardMonth * s.mer.cards;
      out.push({ key: 'priority', title: s.priority ? 'Stop Meridian priority' : 'Buy Meridian priority', act: 'priority', btn: s.priority ? 'Stop' : 'Buy', price: money(pc) + ' a month', effect: 'always the full ' + s.mer.cards + ' cards in the queue', rank: 80, lock: !live });
    }
    out.forEach(function (o, i) { o._i = i; });
    out.forEach(function (o) { o._r = o.rank + (o.lock ? 1000 : 0) + (o.pulse && !o.primary ? -(o.rank - 11) : 0); });   // launch first; the option that pulses comes right after it; what you cannot do yet sinks
    out.sort(function (a, b) { return a._r - b._r || a._i - b._i; });
    return out.slice(0, CFG.paper.optionsMax);
  };
  function optHTML(o, first) {
    var btn = '<button type="button" class="btn sm' + (o.primary && !o.lock ? ' pri' : '') + '" data-act="' + o.act + '"' + (o.attrs || '') + (o.id ? ' id="' + o.id + '"' : '') + ' data-k="ob-' + o.key + '"' + (o.lock ? ' disabled' : '') + '>' + esc(o.btn) + '</button>';
    var more = o.more ? '<button type="button" class="more" data-act="optmore" data-row="' + o.more.row + '"' + (o.more.sel ? ' data-sel="' + o.more.sel + '"' : '') + (o.more.to ? ' data-to="' + o.more.to + '"' : '') + ' data-k="om-' + o.key + '">details</button>' : '';
    return '<div class="opt' + (o.lock ? ' lock' : '') + (o.pulse ? ' pulse' : '') + (o.primary ? ' primary' : '') + '" data-k="o-' + o.key + '">' +
      (o.fuse != null && (!o.lock || o.fuseLive) ? '<i class="fuse" aria-hidden="true"><b style="width:' + o.fuse.toFixed(1) + '%"></b></i>' : '') +
      '<span class="o-t">' + esc(o.title) + '</span><span class="o-b">' + btn + '</span><span class="o-e">' + esc(o.effect || '') + '</span><span class="o-p">' + (o.price ? '<span>' + esc(o.price) + '</span>' : '') + more + '</span></div>';
  }
  FX.renderOptions = function () {
    var s = S(); if (!s) return;
    var list = FX.buildOptions(); ui.options = list;
    var h = ''; list.forEach(function (o, i) { h += optHTML(o, i === 0); });
    setHTML($('opt-list'), h);
    var n = list.filter(function (o) { return !o.lock; }).length;
    setText($('opt-hint'), n ? n + ' you can do now' : 'nothing yet');
  };

  /* ================= THE MODELS WE BUILD: a plaque on the shelf for every model ================= */
  var TEST_NAMES = { paragraph: 'paragraphs', arithmetic: 'arithmetic', translation: 'translation', code: 'code' };
  function testsMini(run) {
    if (!run.evals) return '';
    var h = '<span class="pl-tests" aria-label="Tests passed: ' + run.evals.filter(function (ev) { return ev.pass; }).map(function (ev) { return TEST_NAMES[ev.id]; }).join(', ') + '">'; run.evals.forEach(function (ev) { h += '<span class="t' + (ev.pass ? ' on' : '') + '">' + TEST_NAMES[ev.id] + '</span>'; }); return h + '</span>';
  }
  function plaqueShelf(run, newest) {
    var e = E(), s = S();
    if (run.state === 'train') {
      var type = e.poolType(run.pool), per = run.cards * CFG.card[type].flops * e.scaleEff(run.cards), left = per > 0 ? (run.C - run.done) / per : Infinity;
      return '<button type="button" class="plaque training" data-act="goto" data-to="curve" data-k="pl' + run.id + '" aria-label="' + esc(e.modelName(run)) + ' is training, ' + Math.round(run.q * 100) + ' percent"><span class="pl-name">' + esc(e.modelName(run)) + '</span><span class="pl-meta">run ' + run.id + ' · ' + bigNum(run.N) + ' · reads ' + bigNum(run.D) + '</span><span class="pl-line">' + (run.hang ? 'a card dropped out; it comes back in ' + FX.days(Math.max(0.05, run.hang.left)) : isFinite(left) ? Math.round(run.q * 100) + '% · lands ' + e.fmtDay(s.day + left + (run.hang ? run.hang.left : 0)) : 'stalled: no free cards') + '</span><span class="pl-prog"><i style="width:' + (run.q * 100).toFixed(1) + '%"></i></span></button>';
    }
    var tags = []; if (run.published) tags.push('published'); if (run.shipped) tags.push('API'); if (run.kept) tags.push('private'); if (run.pending) tags.push(esc(run.pending)); if (run.scandal) tags.push('scandal');
    if (run.copied) tags.push('copied in ' + weeks(run.copied.day - run.landDay));
    var m = run.shipped ? e.apiMeter() : null, api = '';
    if (m && m.runId === run.id) api = '<span class="pl-api"><b>' + money(m.rev) + '</b> a month · <b>' + m.waiting.toLocaleString('en-US') + '</b> waiting<span class="wl-m"><i style="width:' + clamp(m.waiting / Math.max(1, m.waiting + m.developers) * 100, 3, 100).toFixed(1) + '%"></i></span></span>';
    return '<button type="button" class="plaque' + (newest ? ' newest' : '') + (ui.thunkRun === run.id ? ' thunk' : '') + (run.clean ? '' : ' junk') + (api ? ' api' : '') + '" data-act="card" data-id="' + run.id + '" data-k="pl' + run.id + '"><span class="pl-top"><span class="pl-name">' + esc(e.modelName(run)) + '</span>' + (run.evals ? testsMini(run) : '') + '</span><span class="pl-meta">' + e.fmtDay(run.landDay) + ' · ' + bigNum(run.N) + ' parameters</span><span class="pl-line">' + esc(e.modelLine(run)) + '</span>' +
      '<span class="pl-sh' + (run.clean ? '' : ' bad') + '"><span>error ' + run.loss.toFixed(2) + ' · ' + (run.clean ? e.shortFmt(e.shortOf(run.Cland)) + ' short' : 'proves nothing') + '</span>' + (tags.length ? '<em>' + tags.slice(0, 2).map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</em>' : '') + '</span>' + api + '</button>';
  }
  FX.renderShelf = function () {
    var e = E(), s = S(); if (!s) return;
    var mine = s.runs.filter(function (r) { return r.state === 'landed' || r.state === 'train'; }), landed = mine.filter(function (r) { return r.state === 'landed'; });
    var newest = landed[landed.length - 1], h = '';
    mine.slice(-CFG.paper.shelfMaxPlaques).forEach(function (r) { h += plaqueShelf(r, r === newest); });
    h += '<div class="plaque empty" data-k="pl-next"><span class="pl-hand">' + (mine.length ? 'your next model goes here' : 'your first model goes here') + '</span></div>';
    setHTML($('shelf-row'), h);
    var n = landed.length;
    setText($('shelf-hint'), n === 0 ? (mine.length ? 'training the first' : 'every model you finish stands here') : n + ' saved' + (mine.length > n ? ' · 1 training' : ''));
    var key = mine.length + ':' + n, row = $('shelf-row');
    if (ui.shelfKey !== key) { ui.shelfKey = key; if (row) { var go = function () { var pls = row.querySelectorAll('.plaque:not(.empty)'), last = pls[pls.length - 1]; row.scrollLeft = last ? Math.max(0, last.offsetLeft - 1) : 0; }; go(); requestAnimationFrame(go); } }
  };
  FX.focusShelf = function () { var row = $('shelf-row'); if (row) { var pls = row.querySelectorAll('.plaque:not(.empty)'), last = pls[pls.length - 1]; row.scrollLeft = last ? Math.max(0, last.offsetLeft - 1) : 0; } try { $('shelf').scrollIntoView({ block: 'nearest' }); } catch (x) {} };

  /* ================= the strip of cells: one cell for every card ================= */
  var cells = { born: [], kinds: [], prevUnits: -1, lastBorn: 0, unit: 1, sweep: -99, lastKey: '', lastDraw: 0, sprites: {}, dpr: 1, w: 0, h: 0 };
  var POOL_KIND = { office: 'w', a100: 'A', cloud: 'r', meridian: 'm' };
  function cardList() {
    var e = E(), s = S(), list = [];
    var order = ['office', 'a100', 'cloud', 'meridian'];
    order.forEach(function (pool) {
      var i = e.poolInfo(pool), kind = POOL_KIND[pool], k, tr = i.training, sv = i.serving, lo = i.lent, idle = i.free;
      for (k = 0; k < tr; k++) list.push(kind + 't');
      for (k = 0; k < sv; k++) list.push('s');
      for (k = 0; k < lo; k++) list.push('L');
      for (k = 0; k < idle; k++) list.push(kind + 'i');
      if (pool === 'cloud') s.rentals.forEach(function (r) { if (s.day < r.start) for (k = 0; k < r.n; k++) list.push('R'); });
      if (pool === 'meridian' && s.mer) { var queued = Math.max(0, s.mer.cards - (s.day >= s.mer.live ? s.mer.alloc : 0)); for (k = 0; k < queued; k++) list.push(s.day >= s.mer.live ? 'q' : 'M'); }
    });
    s.orders.forEach(function (o) { var u = clamp((s.day - o.ordered) / Math.max(1, o.arrive - o.ordered), 0, 1); for (var k = 0; k < o.cards; k++) list.push((o.type === 'a100' ? 'P' : 'o') + u.toFixed(2)); });
    return list;
  }
  function unitFor(n) { var c = CFG.paper.cells; return n > c.podAbove ? 64 : n > c.nodeAbove ? 8 : 1; }
  function cellGeom(nUnits, unit, w, h) {
    var cols = CFG.paper.cells.cols, rows = nUnits <= cols && unit === 1 ? 1 : 2;
    if (unit > 1) { rows = nUnits <= 21 ? 1 : clamp(Math.ceil(nUnits / 64), 2, 4); cols = clamp(Math.ceil(nUnits / rows), 21, 64); }
    var pitch = w / cols, cw = Math.max(1, pitch - (pitch > 10 ? 2 : 0.75)), gap = rows <= 2 ? 5 : 3, rh = Math.min(rows === 1 ? 26 : 20, (h - 2 - (rows - 1) * gap) / rows);
    var top = rows <= 2 ? Math.max(1, (h - (rh * rows + gap * (rows - 1))) / 2) : 1;
    return { cols: cols, rows: rows, pitch: pitch, cw: cw, rh: rh, gap: gap, top: top };
  }
  function glowSprite(cw, rh, solid) {
    var key = cw.toFixed(2) + 'x' + rh.toFixed(2) + (solid ? 's' : 'h'), sp = cells.sprites[key]; if (sp) return sp;
    var W2 = Math.max(1, Math.ceil(cw * cells.dpr)), H2 = Math.max(1, Math.ceil(rh * cells.dpr)), cv = document.createElement('canvas'); cv.width = W2; cv.height = H2;
    var g = cv.getContext('2d'), depth = (cw < 8 ? 0.9 : clamp(Math.min(cw, rh) * 0.12, 1.2, 2.2)) * cells.dpr, inset = 1 * cells.dpr;
    for (var k = 0; k < depth; k += 0.45) {
      var a = Math.pow(1 - k / depth, 1.6) * (solid ? 1 : 0.9);
      g.strokeStyle = 'rgba(255,122,33,' + a.toFixed(3) + ')'; g.lineWidth = 0.55;
      g.strokeRect(inset + k + 0.25, inset + k + 0.25, Math.max(0.5, W2 - 2 * (inset + k) - 0.5), Math.max(0.5, H2 - 2 * (inset + k) - 0.5));
    }
    cells.sprites[key] = cv; return cv;
  }
  FX.cellSweep = function () { cells.sweep = performance.now() / 1000; };
  FX.drawCells = function (tms) {
    var e = E(), s = S(), cv = $('cells-cv'); if (!s || !cv) return;
    var w = cv.clientWidth, h = cv.clientHeight; if (w < 10 || h < 6) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), W2 = Math.round(w * dpr), H2 = Math.round(h * dpr);
    if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; cells.sprites = {}; cells.lastKey = ''; }
    cells.dpr = dpr;
    var list = cardList(), unit = unitFor(list.length), units = []; for (var i = 0; i < list.length; i += unit) units.push(list[i]);
    var hung = e.activeRuns().some(function (r) { return !!r.hang; });
    var training = list.some(function (k) { return k.charAt(1) === 't'; }) && !hung && s.phase === 'play';
    var now = tms / 1000, red = FX.reduced();
    var key = units.join(',') + '|' + w + 'x' + h + '|' + (training ? Math.floor(now * 12) : 'x') + '|' + (now - cells.sweep < 1 ? 's' : '') + '|' + (now - cells.lastBorn < 0.8 ? Math.floor(now * 30) : 'b');
    if (key === cells.lastKey) return; cells.lastKey = key;
    if (unit !== cells.unit) { cells.unit = unit; cells.born = []; cells.prevUnits = units.length; }
    if (cells.prevUnits >= 0 && units.length > cells.prevUnits) { for (var ni = cells.prevUnits; ni < units.length; ni++) cells.born[ni] = now + (ni - cells.prevUnits) * 0.03; cells.lastBorn = now + (units.length - cells.prevUnits) * 0.03; }
    cells.prevUnits = units.length;
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var css = getComputedStyle(FX.root), ink = (css.getPropertyValue('--ink') || '#15171A').trim(), grid = (css.getPropertyValue('--grid') || '#CCCFCA').trim(), graphite = (css.getPropertyValue('--graphite') || '#6E7378').trim(), dry = (css.getPropertyValue('--dry') || '#A9ACAA').trim(), paper = (css.getPropertyValue('--paper') || '#E4E5E1').trim(), reserve = (css.getPropertyValue('--reserve') || '#F8F8F5').trim();
    var G = cellGeom(units.length, unit, w, h), breathe = red ? 1 : 1 + 0.06 * Math.sin(now * Math.PI), sweepT = now - cells.sweep;
    for (i = 0; i < units.length; i++) {
      var col = i % G.cols, row = Math.floor(i / G.cols); if (row >= G.rows) break;
      var x = col * G.pitch, y = G.top + row * (G.rh + G.gap), k = units[i], kind = k.charAt(0), st = k.charAt(1), cw = G.cw, rh = G.rh;
      var bornAt = cells.born[i], drawU = bornAt == null || red ? 1 : clamp((now - bornAt) / 0.08, 0, 1); if (drawU <= 0) continue;
      c.globalAlpha = drawU; c.lineWidth = 1;
      var isTrain = st === 't', solid = false;
      if (kind === 'w' || kind === 'A') {
        c.fillStyle = isTrain ? ink : dry; c.fillRect(x, y, cw, rh); solid = true;
        if (kind === 'A' && cw > 3) { c.strokeStyle = paper; c.strokeRect(x + 1.5, y + 1.5, cw - 3, rh - 3); }
      } else if (kind === 'r') {
        c.strokeStyle = isTrain ? ink : dry; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); if (!isTrain) { c.globalAlpha = drawU * 0.55; c.fillStyle = reserve; c.fillRect(x + 1, y + 1, cw - 2, rh - 2); c.globalAlpha = drawU; }
      } else if (kind === 'm') {
        c.strokeStyle = isTrain ? ink : dry; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); if (unit === 1) { c.fillStyle = isTrain ? ink : dry; c.fillRect(Math.round(x + cw / 2 - 0.5), Math.round(y + rh / 2 - 0.5), 1, 1); }
      } else if (kind === 'M' || kind === 'R') { c.strokeStyle = graphite; c.setLineDash([1.5, 1.5]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]); }
      else if (kind === 'q') { c.strokeStyle = graphite; c.setLineDash([1.5, 2]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]); }
      else if (kind === 'o' || kind === 'P') { var u = +k.slice(1); c.strokeStyle = graphite; c.setLineDash([1, 0.01 + 4 * (1 - u)]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]); if (kind === 'P' && cw > 4) { c.globalAlpha = drawU * 0.6; c.strokeRect(x + 2.5, y + 2.5, cw - 5, rh - 5); } }
      else if (kind === 's') { c.fillStyle = grid; c.fillRect(x, y, cw, rh); c.strokeStyle = ink; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); }
      else if (kind === 'L') { c.strokeStyle = grid; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.beginPath(); c.moveTo(x + 0.5, y + rh - 0.5); c.lineTo(x + cw - 0.5, y + 0.5); c.stroke(); }
      // training: a filament glow inside the cell, breathing; at the lift it flares left to right
      if (isTrain && training) {
        var cellT = sweepT - (col / G.cols) * 0.5, flare = red ? 0 : Math.max(0, 0.7 * Math.exp(-Math.max(0, cellT) / 0.18)) * (cellT > 0 ? 1 : 0), flick = red ? 1 : 1 + 0.035 * Math.sin(now * 7.3 + i * 1.91) * Math.sin(now * 3.1 + i * 0.7);
        c.globalAlpha = clamp((breathe * flick + flare) * 0.92, 0, 1) * drawU;
        var spr = glowSprite(cw, rh, solid); c.drawImage(spr, x, y, cw, rh);
        if (flare > 0.05) { c.globalAlpha = clamp(flare, 0, 1) * drawU; c.drawImage(spr, x, y, cw, rh); }
      }
      c.globalAlpha = 1;
    }
    c.globalAlpha = 1;
    // the caption: how many cards and how fast
    var capTotal = list.length, sp = e.trainingSpeed();
    setHTML($('cells-cap'), '<span>CARDS: our GPUs</span><b>' + capTotal.toLocaleString('en-US') + ' · x' + (sp >= 100 ? Math.round(sp) : sp.toFixed(1)) + '</b>');
  };
})();
