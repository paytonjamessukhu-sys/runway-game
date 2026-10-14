/* OPTIONS: everything the player can do right now, in the bottom band. Each is a reserve slip (phone, a row you swipe) or a ruled line (laptop)
   with its price and what it does to the curve and the months, ordered by what matters now. Locked ones sit greyed with what unlocks them.
   The run designer's launch is the first slip (it lives in game.html and is updated by designer.js); the rest are built here from the engine. */
(function (X) {
  'use strict';
  var $ = X.$, esc = X.esc, clamp = X.clamp;

  function firstSentence(t) { t = String(t || ''); var i = t.indexOf('. '); return i > 0 ? t.slice(0, i + 1) : t; }
  function mUntil(g, bank, extraBurn) { var b = g.burn() + (extraBurn || 0), bk = g.S.bank + (bank || 0); return b > 0 ? bk / b : Infinity; }
  function slip(o) {
    var cls = 'opt ' + (o.cls || '') + (o.locked ? ' locked' : '') + (o.pulse ? ' pulse' : '') + (o.fresh ? ' new' : '');
    var h = '<article class="' + cls + '" data-opt-id="' + esc(o.id) + '">';
    if (o.fuse != null) h += '<i class="fuse' + (o.cold ? ' cold' : '') + '" style="width:' + clamp(o.fuse * 100, 2, 100).toFixed(1) + '%"><i></i></i>';
    h += '<div class="o-h"><span class="o-t">' + esc(o.title) + (o.role ? ' <span class="role">· ' + esc(o.role) + '</span>' : '') + '</span>' + (o.price ? '<span class="o-p num">' + esc(o.price) + '</span>' : '') + '</div>';
    h += '<p class="o-e">' + esc(o.eff || '') + '</p>';
    h += '<div class="o-f"><span class="o-n">' + esc(o.note || '') + '</span>' + (o.btn ? '<button type="button" class="btn' + (o.btn.primary ? ' primary' : '') + '" ' + o.btn.attrs + (o.btn.disabled ? ' disabled' : '') + '>' + esc(o.btn.label) + '</button>' : '') + '</div>';
    return h + '</article>';
  }

  X.options = function () {
    var g = X.G, s = X.S, f = X.F, CFG = X.CFG, W = X.WORLD, dv = g.derived(), rs = g.roundStatus(), pulse = X.ui.verbPulse, list = [];
    var cold = s.paused || !s.started;
    var rw = g.runway();
    function m2(a, b) { return f.months(a) + ' → ' + f.months(b) + ' months until broke'; }

    // people knocking: a real fuse, the days left before a rival courts them away
    s.candidates.slice().sort(function (a, b) { return a.until - b.until; }).forEach(function (c) {
      var d = W.people[c.key], left = Math.max(0, Math.ceil(c.until - s.day)), after = mUntil(g, 0, c.salary);
      list.push({ id: 'hire-' + c.key, cls: 'hire', title: 'Hire ' + d.first, role: d.role, price: '−' + f.money(c.salary) + '/mo', eff: firstSentence(d.effect), note: m2(rw, after) + ' · courted by ' + (c.to === 'halcyon' ? 'Halcyon' : 'Kestrel') + ', gone in ' + left + ' days',
        fuse: left / CFG.candidateWindow, cold: cold, pri: left <= 15 ? 1 : 4, pulse: pulse === 'hire' && s.candidates.every(function (o) { return o === c || o.until >= c.until; }), btn: { label: 'Hire', attrs: 'data-act="hire" data-id="' + c.key + '"' } });
    });
    var nx = X.nextCandidate && X.nextCandidate();
    if (nx && !nx.cand) list.push({ id: 'next-' + nx.key, cls: 'hire', locked: true, pri: 21, title: 'Next to hire: ' + nx.p.first, role: nx.p.role, eff: firstSentence(nx.p.effect), note: nx.gate ? (nx.gate.indexOf('arrives') === 0 ? nx.gate : nx.gate) : 'soon' });

    // the books: raise
    if (rs.next) {
      var T = rs.terms;
      if (rs.legal && T) list.push({ id: 'raise', cls: 'raise', title: 'Raise Series ' + rs.next, price: '+' + f.money(T.cash), eff: 'Investors pay ' + f.money(T.cash) + ' for ' + f.pct(T.sold) + ' of the lab: you would own ' + f.pct(T.newStake) + '.', note: T.factor < 1 ? 'under 6 months until broke, the price is cut to ' + Math.round(T.factor * 100) + '%' : 'a term sheet will open', pri: 2, pulse: pulse === 'raise', btn: { label: 'Raise', primary: pulse === 'raise', attrs: 'data-act="raise" data-round="' + rs.next + '"', disabled: !!s.pending } });
      else list.push({ id: 'raise', cls: 'raise', locked: true, pri: 20, title: 'Raise Series ' + rs.next, price: T ? f.money(T.cash) : '', eff: (rs.why[0] || 'not yet').charAt(0).toUpperCase() + (rs.why[0] || 'not yet').slice(1) + '.', note: 'locked until the investors see it', btn: { label: 'Raise', attrs: 'data-act="raise" data-round="' + rs.next + '"', disabled: true } });
    }
    // renewals: the rented cards that go back soon
    s.rentals.filter(function (r) { return s.day < r.end; }).forEach(function (r) {
      var q = g.renewQuote(r.id); if (q.why && r.end - s.day > CFG.rent.renewWindow) return;
      list.push({ id: 'renew-' + r.id, cls: 'renew', locked: !!q.why, title: 'Renew ' + r.n + ' cards', price: '−' + f.money(q.monthly) + '/mo', eff: q.why ? q.why : 'Keep them 90 more days at $' + q.price.toFixed(2) + ' a card-hour, from ' + f.date(r.end) + '.', note: 'they go back on ' + f.date(r.end), fuse: q.why ? null : clamp((r.end - s.day) / CFG.rent.renewWindow, 0, 1), cold: cold, pri: q.why ? 24 : 3, btn: q.why ? null : { label: 'Renew', attrs: 'data-act="renew" data-id="' + r.id + '"' } });
    });
    // data
    var cf = dv.canFilter, job = s.data.job;
    if (job) list.push({ id: 'filter', cls: 'data', locked: true, pri: 23, title: 'Cleaning the crawl', eff: X.WORLD.people[job.who].first + ' is on it. The data wall moves out when it finishes.', note: Math.max(0, Math.ceil(job.end - s.day)) + ' days left', fuse: clamp((job.end - s.day) / Math.max(1, job.end - job.start), 0, 1), cold: cold });
    else list.push({ id: 'filter', cls: 'data', locked: !cf.ok, pri: cf.ok ? (pulse === 'data' ? 3 : 8.5) : 23, title: 'Clean the crawl', price: '−' + f.money(dv.filterCost), pulse: pulse === 'data' && cf.ok, eff: cf.ok ? 'Moves the data wall out: +86% fresh text, about ten times the compute. ' + dv.filterDays + ' days; each cleaning costs twice the last.' : cf.msg.replace('filter job', 'cleaning'), note: cf.ok ? 'a bigger run needs more text' : 'locked', btn: cf.ok ? { label: 'Clean', attrs: 'data-act="filter"' } : null });
    // cards: rent by the month, buy and wait
    var fpd = g.flopsPerDay(), base = CFG.own.base;
    [64, 128, 256].forEach(function (n, i) {
      var q = g.rentQuote(n);
      if (q.why && i > 0) return;
      var x0 = fpd / base, x1 = (fpd + n * CFG.flops.v100) / base;
      list.push({ id: 'rent-' + n, cls: 'rent', locked: !!q.why, pri: q.why ? 24 : 6 + i * 2 + (i === 2 ? 2 : 0), pulse: pulse === 'rent' && n === 64 && !q.why, title: 'Rent ' + n + ' cards', price: '−' + f.money(q.monthly) + '/mo',
        eff: q.why ? q.why : 'Training speed x' + (x0 >= 10 ? Math.round(x0) : x0.toFixed(1)) + ' → x' + (x1 >= 10 ? Math.round(x1) : x1.toFixed(1)) + '. $' + q.price.toFixed(2) + ' a card-hour, 90 days, live ' + f.date(q.live) + '.', note: q.why ? 'locked' : m2(rw, mUntil(g, 0, q.monthly)), btn: q.why ? null : { label: 'Rent', attrs: 'data-act="rent" data-n="' + n + '"' } });
    });
    var sh = g.shelf();
    sh.afford.forEach(function (q, i) {
      list.push({ id: 'buy-' + q.units, cls: 'buy', pri: 7 + i * 0.5, title: 'Buy ' + q.label, price: '−' + f.money(q.price), eff: q.cards + ', yours for good. Lands ' + f.date(q.arrive) + (q.late ? ' 2021' : '') + ' (' + Math.round(q.lead / 7) + ' weeks' + (q.covid ? ', COVID +4' : '') + (q.post ? ', scramble +8' : '') + ').', note: m2(rw, mUntil(g, -q.price, 0)), btn: { label: 'Buy', attrs: 'data-act="buy" data-box="' + q.box + '" data-units="' + q.units + '"' } });
    });
    if (sh.grey && s.runs.length) list.push({ id: 'buy-grey', cls: 'buy', locked: true, pri: 22, title: 'Buy ' + sh.grey.label, price: f.money(sh.grey.price), eff: sh.grey.cards + '. ' + f.money(sh.grey.short) + ' short.' + (sh.days ? ' ' + (sh.days.done ? 'Your last run would take ' : 'Run ' + sh.days.run + ' takes ') + Math.max(1, Math.round(sh.days.now)) + ' days now, ' + (sh.days.withIt < 1 ? 'under a day' : Math.max(1, Math.round(sh.days.withIt)) + ' days') + ' with it.' : ''), note: sh.isNew ? 'new: the A100 box' : 'locked until the cash is there' });
    var ro = g.rentOutQuote();
    if (!ro.why) list.push({ id: 'rentout', cls: 'rentout', pri: 9, title: 'Rent out ' + ro.n + ' office cards', price: '+' + f.money(ro.cash), eff: '$1.90 a card-hour for 30 days, cash now' + (ro.busy ? '. Slows the run on them.' : '.'), note: 'idle cards pay too', btn: { label: 'Rent out', attrs: 'data-act="rentout"' } });
    list.sort(function (a, b) { var pa = a.pulse ? -1 : a.pri, pb = b.pulse ? -1 : b.pri; return pa - pb; });
    return list;
  };

  X.renderOptions = function () {
    var list = X.options(), ui = X.ui, n = X.nowMs();
    // an option that has just arrived slides up into the band once
    if (!ui.optSeen) { ui.optSeen = {}; list.forEach(function (o) { ui.optSeen[o.id] = -1e9; }); }
    list.forEach(function (o) { if (ui.optSeen[o.id] == null) ui.optSeen[o.id] = n; o.fresh = n - ui.optSeen[o.id] < 700 && !X.reduced(); });
    X.setHTML('opts-dyn', list.map(slip).join(''));
    var live = list.filter(function (o) { return !o.locked; }).length + (X.ui.design && !X.ui.design.block ? 1 : 0);
    var S = X.S, first = S.stats.runs === 0 && !S.active.length && !S.over;
    X.setHTML('opts-n', first ? '<b class="here">start here ↓</b> <span class="sw">· swipe for more →</span>' : '<span class="sw">' + live + ' you can do now · swipe →</span><span class="lp">' + live + ' you can do now</span>');
  };
})(window.FX);
