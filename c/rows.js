/* The folded rows: Cluster, Team, Money, Data, Rivals and news, and the shelf of saved models. Each shows one live figure
   when folded and opens in place. Everything here is read from the engine; the buttons only ask it to act. */
(function (X) {
  'use strict';
  var $ = X.$, esc = X.esc, log10 = X.log10, clamp = X.clamp;
  function G() { return X.G; } function S() { return X.S; } function F() { return X.F; }
  function skillDots(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '●' : '<i>●</i>'; return '<span class="skill" aria-label="skill ' + n + ' of 5">' + s + '</span>'; }
  function sec(t, r, id) { return '<div class="sec"' + (id ? ' id="' + id + '"' : '') + '><span>' + t + '</span>' + (r ? '<span class="r">' + r + '</span>' : '') + '</div>'; }
  function meter(pct, cls, tick) { return '<div class="meter ' + (cls || '') + '"><i style="width:' + clamp(pct, 0, 100).toFixed(1) + '%"></i>' + (tick != null ? '<b class="tick" style="left:' + tick + '%"></b>' : '') + '</div>'; }
  function days2words(d) { if (!isFinite(d)) return 'never'; if (d >= 365) { var y = d / 365; return (y >= 10 ? Math.round(y) : y.toFixed(1)) + ' years'; } if (d >= 14) return Math.round(d / 7) + ' weeks'; return Math.max(1, Math.round(d)) + ' days'; }
  var POOLN = { office: 'Office', cloud: 'Rented', a100: 'A100s', meridian: 'Meridian' };

  /* ================= CLUSTER ================= */
  X.renderCluster = function () {
    var g = G(), s = S(), f = F(), CFG = X.CFG, h = '', dv = g.derived(), id = g.idle(), cd = g.cardDay();
    var x = g.flopsPerDay() / CFG.own.base;
    var gpt = g.yearsToGPT3();
    h += '<div class="blk speedblk"><div class="big num">x' + (x >= 10 ? Math.round(x) : x.toFixed(1)) + '</div><div class="bigl">training speed<span class="sub">At this speed GPT-3 takes ' + days2words(gpt) + '</span></div></div>';
    h += '<div class="bars"><div class="bar2"><span class="bl">Busy</span>' + meter(id.busyShare * 100, '', null) + '<span class="bv num">' + Math.round(id.busyShare * 100) + '%</span></div>';
    h += '<div class="bar2"><span class="bl">Useful</span>' + meter(id.usefulShare * 100, 'use', CFG.own.mfu * 100) + '<span class="bv num">' + Math.round(id.usefulShare * 100) + '%</span></div>';
    h += '<div class="note">2020 cards manage about a third of peak. A card can read 100% busy and still do a third of the math.</div></div>';
    if (id.idleCards > 0 && id.perDay > 1) h += '<div class="drip">' + id.idleCards + ' idle card' + (id.idleCards === 1 ? '' : 's') + ', ' + f.moneyFull(Math.round(id.perDay / 10) * 10) + ' a day going nowhere</div>';
    var hg = s.lastHang;
    if (hg && s.day - hg.day < 120) h += '<div class="hangln">' + (hg.nan ? 'Node ' + hg.node + ' went haywire' : 'Node ' + hg.node + ' dropped') + ' on ' + esc(f.date(hg.day)) + ', rolled back ' + (hg.hours >= 1 ? Math.round(hg.hours) : hg.hours) + ' hours, ' + f.moneyFull(Math.round(hg.dollars / 10) * 10) + ' gone</div>';
    h += '<div class="oneprice">One card, one day: <b class="num">' + f.moneyFull(Math.round(cd.rented)) + '</b> rented, about <b class="num">' + f.moneyFull(Math.round(cd.owned)) + '</b> owned. Owning wins if it is busy more than ' + Math.round(cd.breakeven * 100) + '% of the time.</div>';
    // trucks
    var tr = g.trucks();
    if (tr.length) {
      h += sec('On the way');
      tr.forEach(function (t) { h += '<div class="truck"><div class="row small"><span>' + t.n + ' ' + (t.type === 'a100' ? 'A100s' : 'V100s') + ', ' + esc(f.money(t.price)) + ' paid, lands ' + esc(f.short(t.arrive)) + (t.arrive >= CFG.endDay ? ' (2021)' : '') + '</span><span class="muted">in ' + (t.weeks >= 1 ? t.weeks + ' weeks' : Math.max(1, Math.round(t.arrive - s.day)) + ' days') + '</span></div><div class="rail"><i style="width:' + (t.frac * 100).toFixed(1) + '%"></i></div></div>'; });
    }
    // the shelf: one grey item, the next thing you cannot afford yet
    if (s.firstPlaque || s.runs.length) {
      var sh = g.shelf();
      if (sh.grey) {
        var q = sh.grey;
        h += '<div class="shelfitem' + X.fresh('shelf') + '"><div class="row"><span><b>' + esc(q.label) + '</b> (' + esc(q.cards.replace('V100s', 'V100s').replace('A100s', 'A100s')) + ')' + (sh.isNew ? ' <span class="tagnew">NEW</span>' : '') + '</span><span class="num">' + esc(f.money(q.price)) + '</span></div>';
        h += '<div class="small bad-t">' + esc(f.money(q.short)) + ' short</div>';
        var bits = [];
        if (sh.days) bits.push((sh.days.done ? 'Your last run would take ' : 'Run ' + sh.days.run + ' takes ') + Math.max(1, Math.round(sh.days.now)) + ' days now, ' + (sh.days.withIt < 1 ? 'under a day' : Math.max(1, Math.round(sh.days.withIt)) + ' days') + ' with it');
        bits.push('buying leaves ' + f.months(sh.runway) + ' months until broke');
        h += '<div class="small muted">' + esc(bits.join(' · ')) + '</div></div>';
        X.ui.shelfSeen = true;
      }
    }
    // rent cards
    h += sec('Rent cards', '$' + g.rentQuote(64).price.toFixed(2) + ' a card-hour · 90 days', 'rent-block');
    h += '<div class="mkt">';
    [64, 128, 256].forEach(function (n) {
      var q = g.rentQuote(n);
      h += '<button type="button" class="btn" data-act="rent" data-n="' + n + '"' + (q.why ? ' disabled' : '') + '><span class="l"><span>Rent ' + n + ' cards</span><span class="sub">' + (q.why ? esc(q.why) : 'live ' + esc(f.date(q.live)) + ' · months until broke ' + esc(f.months(dv.runway)) + ' → ' + esc(f.months(runwayAdd(q.monthly)))) + '</span></span><span class="p out">−' + esc(f.money(q.monthly)) + '/mo</span></button>';
    });
    h += '</div>';
    var live = s.rentals.filter(function (r) { return s.day < r.end; });
    if (live.length) {
      h += '<div class="rows small" style="margin-top:6px">';
      live.forEach(function (r) { var q = g.renewQuote(r.id); h += '<div class="row"><span>' + r.n + ' rented · $' + r.price.toFixed(2) + '/h · to ' + esc(f.date(r.end)) + '</span><span><button type="button" class="btn sm" data-act="renew" data-id="' + r.id + '"' + (q.why ? ' disabled title="' + esc(q.why) + '"' : '') + '>Renew 90 days</button></span></div>' + (q.why && r.end - s.day <= CFG.rent.renewWindow ? '<div class="why">' + esc(q.why) + '</div>' : ''); });
      h += '</div>';
    }
    // buy cards: only what you can pay for; the first thing you cannot is the grey item above
    var sh2 = g.shelf();
    h += sec('Buy cards', esc(sh2.boxName) + ': a box of 8 cards');
    if (sh2.afford.length) {
      h += '<div class="mkt">';
      sh2.afford.forEach(function (q) {
        h += '<button type="button" class="btn" data-act="buy" data-box="' + q.box + '" data-units="' + q.units + '"><span class="l"><span>Buy ' + esc(q.label) + ' (' + esc(q.cards) + ')</span><span class="sub">lands ' + esc(f.date(q.arrive)) + (q.late ? ' 2021' : '') + ' (' + Math.round(q.lead / 7) + ' weeks' + (q.covid ? ', COVID +4' : '') + (q.post ? ', scramble +8' : '') + ') · months until broke ' + esc(f.months(dv.runway)) + ' → ' + esc(f.months(g.runway({ bank: -q.price, owned: q.n }))) + '</span></span><span class="p out">−' + esc(f.money(q.price)) + '</span></button>';
      });
      h += '</div>';
    } else h += '<div class="small dim">' + (s.day < CFG.buy.dgxa.from && 0 ? '' : 'Nothing you can pay for right now.') + '</div>';
    if (s.day < CFG.buy.dgxa.from) h += '<div class="small dim">A newer box is coming in May.</div>';
    var ro = g.rentOutQuote();
    h += sec('Rent out', 'idle cards pay too');
    h += '<button type="button" class="btn full" data-act="rentout"' + (ro.why ? ' disabled' : '') + '><span class="l"><span>Rent out ' + (ro.n || 'half your') + ' office cards · 30 days</span><span class="sub">' + (ro.why ? esc(ro.why) : '$1.90 a card-hour, cash now' + (ro.busy ? ' · slows the run on them' : '')) + '</span></span><span class="p in">' + (ro.why ? '' : '+' + esc(f.money(ro.cash))) + '</span></button>';
    X.setHTML('b-cluster', h);
    X.setHTML('s-cluster', 'x' + (x >= 10 ? Math.round(x) : x.toFixed(1)) + ' training speed' + (tr.length ? ' · ' + tr.length + ' on the way' : ''));
  };
  function runwayAdd(monthly) { var b = G().burn() + monthly; return b > 0 ? S().bank / b : Infinity; }

  /* ================= TEAM ================= */
  function nextCandidate() {
    var s = S(), g = G(), W = X.WORLD, CFG = X.CFG;
    if (s.candidates.length) { var c = s.candidates.slice().sort(function (a, b) { return a.until - b.until; })[0]; return { cand: c, p: W.people[c.key] }; }
    var best = null;
    ['dev', 'ayaan', 'tom', 'rafael', 'lena', 'sunhee', 'ines', 'kofi'].forEach(function (k) {
      if (s.knocked[k] || g.has(k)) return;
      var p = W.people[k], day = k === 'sunhee' ? Math.max(p.day, s.day) : p.day;
      if (!best || p.day < best.p.day) best = { key: k, p: p };
    });
    if (!best) return null;
    var p2 = best.p, gate = null;
    if (best.key === 'sunhee') { gate = 'needs a published model past 1e21'; }
    else if (best.p.day > s.day) gate = 'arrives ' + F().short(best.p.day);
    return { p: p2, key: best.key, gate: gate, upcoming: true };
  }
  X.renderTeam = function () {
    var g = G(), s = S(), f = F(), CFG = X.CFG, W = X.WORLD, dv = g.derived(), staff = g.staff(), h = '';
    // the strip of initials: hire order, a thin morale underline, a dashed plus for the next candidate
    var tiles = staff.map(function (p) {
      var mood = Math.round(p.mood), nw = X.ui.newHire === p.key;
      return '<button type="button" class="tile' + (mood < 35 ? ' low' : '') + (nw ? ' slidein' : '') + '" data-tile="' + p.key + '" aria-label="' + esc(p.name) + ', morale ' + mood + '"><span class="ti">' + esc(X.initial(p.first)) + '</span><i style="width:' + mood + '%"></i></button>';
    }).join('');
    var nx = nextCandidate(), plus = '';
    if (nx) {
      if (nx.cand) plus = '<button type="button" class="tile plus has" data-tile="board" aria-label="' + esc(nx.p.name) + ' is on the hiring board"><span class="ti">+</span><span class="pl">' + esc(nx.p.first) + ' ' + esc(f.money(nx.cand.salary)) + '</span></button>';
      else plus = '<button type="button" class="tile plus" data-tile="board" aria-label="Next candidate: ' + esc(nx.p.name) + '"><span class="ti">+</span><span class="pl">' + esc(nx.p.first) + (nx.gate ? ' ' + esc(nx.gate.indexOf('arrives') === 0 ? nx.gate.replace('arrives ', '') : 'gated') : '') + '</span></button>';
    }
    X.setHTML('s-team', '<span class="tiles">' + tiles + plus + '</span>');
    h += sec('On the team', 'payroll ' + esc(f.money(dv.salaries)) + ' a month');
    staff.forEach(function (p) {
      var say = lastSay(p.key), mood = Math.round(p.mood);
      h += '<div class="card" id="pc-' + p.key + '"><div class="row"><span><span class="nm">' + esc(p.name) + '</span><span class="role">' + esc(p.role) + '</span></span><span class="num small">' + esc(f.money(p.salary)) + '/mo</span></div>';
      h += '<div class="row small"><span class="muted">' + esc(assignment(p)) + '</span>' + skillDots(p.skill) + '</div>';
      h += '<div class="mood"><span>morale</span><div class="bar' + (mood < 35 ? ' bad' : '') + '"><i style="width:' + mood + '%"></i></div><span class="num">' + mood + '</span></div>';
      h += '<div class="eff">' + esc(p.effect) + '</div>';
      if (say) h += '<div class="say">' + esc(say) + '</div>';
      var acts = '';
      if (S().active.some(function (r) { return r.hang && !r.hang.infra; })) acts += '<button type="button" class="btn sm danger" data-act="wake" data-id="' + p.key + '">Wake ' + esc(p.first) + '</button>';
      if (acts) h += '<div class="acts">' + acts + '</div>';
      h += '</div>';
    });
    h += sec('Hiring board', s.candidates.length ? f.plural(s.candidates.length, 'candidate') : 'nobody right now', 'hire-block');
    if (!s.candidates.length) h += '<div class="small dim">' + (nx ? esc(nx.p.name) + ' is next' + (nx.gate ? ': ' + esc(nx.gate) : '') + '.' : 'Everyone you could hire this year has been through.') + '</div>';
    s.candidates.forEach(function (c) {
      var d = W.people[c.key], left = Math.max(0, Math.ceil(c.until - s.day));
      h += '<div class="card cand" id="pc-' + c.key + '"><div class="row"><span><span class="nm">' + esc(d.name) + '</span><span class="role">' + esc(d.role) + '</span></span><span class="num small">asks ' + esc(f.money(c.salary)) + '/mo</span></div>';
      h += '<div class="say">' + esc(d.pitch) + '</div><div class="eff">' + esc(d.effect) + '</div>';
      h += '<div class="row small"><span class="' + (left < 8 ? 'bad-t' : 'muted') + '">courted by ' + (c.to === 'halcyon' ? 'Halcyon' : 'Kestrel') + ': gone in ' + left + ' days</span>' + skillDots(d.skill) + '</div>';
      h += '<div class="acts"><button type="button" class="btn sm primary" data-act="hire" data-id="' + c.key + '">Hire ' + esc(d.first) + ' · months until broke ' + esc(f.months(dv.runway)) + ' → ' + esc(f.months(runwayAddSalary(c.salary))) + '</button></div></div>';
    });
    var gone = s.team.filter(function (p) { return p.gone; });
    if (gone.length) { h += sec('Left'); gone.forEach(function (p) { h += '<div class="card gone"><div class="row"><span class="nm">' + esc(p.name) + '</span><span class="small dim">' + esc(f.date(p.goneDay)) + '</span></div><div class="eff">' + esc(p.why) + (p.to ? ' → ' + esc(p.to) : '') + '</div></div>'; }); }
    X.setHTML('b-team', h);
  };
  function runwayAddSalary(sal) { var b = G().burn() + sal; return b > 0 ? S().bank / b : Infinity; }
  function lastSay(key) { var feed = S().feed; for (var i = 0; i < feed.length; i++) if (feed[i].who === key && feed[i].kind !== 'leave') return feed[i].text; return null; }
  function assignment(p) {
    var s = S(), g = G(), CFG = X.CFG, F_ = F();
    if (p.role === 'data') return s.data.job && s.data.job.who === p.key ? 'cleaning the crawl · ' + Math.max(0, Math.ceil(s.data.job.end - s.day)) + 'd left' : 'reading samples';
    if (p.role === 'evals') return s.redteam ? 'safety-testing run ' + s.redteam.runId + ' · ' + Math.max(0, Math.ceil(s.redteam.until - s.day)) + 'd' : 'evals';
    if (p.role === 'systems') return 'splitting models · up to ' + F_.size(g.derived().memLimit);
    if (p.role === 'infra') return p.key === 'tom' && s.day < (s.flags.tomOffUntil || 0) ? 'on a week off' : (s.active.some(function (r) { return r.hang; }) ? 'restarting a hung run' : 'on call');
    if (p.role === 'scaling') return 'fitting the line';
    if (p.role === 'optimization') { var d = CFG.optDelay - (s.day - p.joined); return d > 0 ? 'retuning the schedule · ' + Math.ceil(d) + 'd' : 'schedule’s in: 2.5% better'; }
    return p.status;
  }

  /* ================= MONEY ================= */
  X.renderMoney = function () {
    var g = G(), s = S(), f = F(), CFG = X.CFG, h = '', dv = g.derived(), bp = g.burnParts(), W = X.WORLD, rs = g.roundStatus();
    var tot = Math.max(1, bp.people + bp.cards + bp.office);
    h += sec('Spending a month', '<span class="num bad-t">' + esc(f.money(bp.total)) + '</span>');
    h += '<div class="stack" role="img" aria-label="Spending split: people ' + Math.round(100 * bp.people / tot) + '%, cards ' + Math.round(100 * bp.cards / tot) + '%, office ' + Math.round(100 * bp.office / tot) + '%"><i class="sg-p" style="width:' + (100 * bp.people / tot).toFixed(1) + '%"></i><i class="sg-c" style="width:' + (100 * bp.cards / tot).toFixed(1) + '%"></i><i class="sg-o" style="width:' + (100 * bp.office / tot).toFixed(1) + '%"></i></div>';
    h += '<div class="legend small"><span><i class="sg-p"></i>People <b class="num">' + esc(f.money(bp.people)) + '</b></span><span><i class="sg-c"></i>Cards <b class="num">' + esc(f.money(bp.cards)) + '</b></span><span><i class="sg-o"></i>Office <b class="num">' + esc(f.money(bp.office)) + '</b></span></div>';
    // this month so far, from the money log
    var inn = 0, out = 0; Object.keys(s.mlog).forEach(function (k) { if (s.mlog[k] > 0) inn += s.mlog[k]; else out -= s.mlog[k]; });
    h += sec('This month so far', esc(f.date(s.day)));
    h += '<div class="inout"><span class="out num">−' + esc(f.money(out)) + ' out</span><span class="in num">' + (inn > 0 ? '+' + esc(f.money(inn)) + ' in' : '') + '</span></div>';
    var monthlyIn = bp.api + (s.lent && s.day < s.lent.until ? CFG.rentOut.perHour * 24 * 30.4 * s.lent.n : 0);
    if (s.api || monthlyIn > 0) {
      var gapP = clamp(100 * monthlyIn / Math.max(1, bp.total), 0, 100);
      h += '<div class="small" style="margin-top:6px"><b class="in num">' + esc(f.money(monthlyIn)) + ' a month in</b> against <b class="out num">' + esc(f.money(bp.total)) + ' out</b></div><div class="gapbar"><i style="width:' + gapP.toFixed(1) + '%"></i></div>';
    }
    // the raise block arrives after the first saved model
    if (s.firstPlaque || s.runs.length) {
      var T = rs.terms, dropped = s.stake < 0.8 - 0.001;
      h += sec('Raise', rs.next ? 'Series ' + rs.next : 'no more rounds', 'raise-block');
      h += '<div class="rz' + X.fresh('raise') + '">';
      h += '<div class="rz-row"><span>You own</span><b class="num ' + (dropped ? 'bad-t' : '') + '">' + esc(f.pct(s.stake)) + '</b></div>';
      h += '<div class="rz-row"><span>Last round priced you at</span><b class="num">' + esc(f.money(s.post)) + '</b></div>';
      if (T) {
        var would = rs.legal ? '' : ' dim';
        h += '<div class="rz-row' + would + '"><span>Investors would pay today</span><b class="num">' + esc(f.money(T.post)) + '</b></div>';
        if (T.factor < 1) h += '<div class="small bad-t">Under 6 months until broke, they smell it: the price is cut to ' + Math.round(T.factor * 100) + '%.</div>';
        h += '<div class="small ' + (rs.legal ? 'acc' : 'muted') + '">' + (rs.legal ? 'Series ' + rs.next + ' is open: ' + esc(f.money(T.cash)) + ' for ' + esc(f.pct(T.sold)) + ', you would own ' + esc(f.pct(T.newStake)) + '.' : 'Next raise: ' + esc(rs.why[0] || 'not yet') + '.') + '</div>';
        h += '<div class="acts"><button type="button" class="btn sm' + (rs.legal ? ' primary' : '') + '" data-act="raise" data-round="' + rs.next + '"' + (rs.legal && !s.pending ? '' : ' disabled') + '>Raise ' + esc(f.money(T.cash)) + '</button></div>';
      } else h += '<div class="small muted">Both rounds are done or passed.</div>';
      if (s.stake < CFG.boardBelow + 0.06) h += '<div class="small bad-t">Below 50% the board sells the lab to the next bidder.</div>';
      h += '</div>';
    }
    // Meridian
    if (s.mer || s.flags.merOffered || s.firstPlaque) {
      h += sec('Meridian cloud');
      if (s.mer) h += '<div class="small">Signed ' + esc(f.date(s.mer.signed)) + ': ' + s.mer.cards.toLocaleString('en-US') + ' cards, ' + (s.day < s.mer.live ? 'live ' + esc(f.date(s.mer.live)) : 'allocation ' + s.mer.alloc + ' this month') + '. Credits left ' + esc(f.money(s.mer.credits)) + '. Exclusive; first look 7 days; no open weights.</div>';
      else h += '<div class="small muted">' + (s.flags.merOffered ? (s.flags.mer2Offered ? 'You passed twice. Independent.' : 'You passed. They’ll be back after 15 Jun with a smaller offer.') : 'A fictional cloud giant. It offers $50M of compute once you save a model past 1e21, from 1 Apr. The price: exclusivity, first look at every model, no open weights.') + '</div>';
    }
    h += sec('Ledger');
    h += '<div class="rows small">';
    s.ledger.slice(-6).reverse().forEach(function (l) { h += '<div class="row"><span><span class="dim num">' + esc(f.date(l.day)) + '</span> ' + esc(l.what) + '</span><span class="num ' + (l.amt > 0 ? 'in' : '') + '">' + (l.amt ? (l.amt > 0 ? '+' : '') + esc(f.money(l.amt)) : '') + '</span></div>'; });
    h += '</div>';
    X.setHTML('b-money', h);
    X.setHTML('s-money', '<span class="bad-t num">−' + esc(f.money(bp.total)) + ' a month</span>');
  };

  /* ================= DATA ================= */
  X.renderData = function () {
    var g = G(), s = S(), f = F(), CFG = X.CFG, ui = X.ui, d = s.data, dv = g.derived(), h = '';
    var fresh = d.lo / CFG.passes;
    var lo = 10, hi = 12.3, pos = function (v) { return clamp((log10(v) - lo) / (hi - lo) * 100, 0, 100); };
    var nextD = ui.design ? ui.design.D : 0, runEat = s.run ? s.run.done / s.run.C * s.run.D : 0;
    h += sec('The data wall', d.filters ? f.plural(d.filters, 'crawl cleaning') + ' done' : 'raw crawl');
    h += '<div class="row"><span class="num big2">' + esc(f.size(d.lo)) + '–' + esc(f.size(d.hi)) + '</span><span class="small muted">tokens of text before it turns to junk</span></div>';
    h += '<div class="dbar" role="img" aria-label="Fresh text up to ' + esc(f.size(fresh)) + ' tokens, repeated text up to the data wall at ' + esc(f.size(d.lo)) + ' to ' + esc(f.size(d.hi)) + ', memorising beyond">';
    h += '<i class="z-fresh" style="left:0;width:' + pos(fresh).toFixed(1) + '%"></i><i class="z-rep" style="left:' + pos(fresh).toFixed(1) + '%;width:' + Math.max(0, pos(d.lo) - pos(fresh)).toFixed(1) + '%"></i><i class="z-band" style="left:' + pos(d.lo).toFixed(1) + '%;width:' + Math.max(1, pos(d.hi) - pos(d.lo)).toFixed(1) + '%"></i><i class="z-mem" style="left:' + pos(d.hi).toFixed(1) + '%;width:' + Math.max(0, 100 - pos(d.hi)).toFixed(1) + '%"></i>';
    if (s.run) h += '<b class="ru" style="width:' + pos(runEat).toFixed(1) + '%"></b>';
    if (nextD) h += '<b class="mk" style="left:' + pos(nextD).toFixed(1) + '%"></b>';
    h += '</div><div class="dleg small"><span><i class="z-fresh"></i>fresh</span><span><i class="z-rep"></i>repeated</span><span><i class="z-mem"></i>memorising</span></div>';
    h += '<div class="small muted" style="margin-top:4px">' + (s.run ? 'Run ' + s.run.id + ' has read ' + esc(f.size(runEat)) + ' of ' + esc(f.size(s.run.D)) + ' tokens. ' : nextD ? 'The white tick is your next run (' + esc(f.size(nextD)) + ' tokens). ' : '') + 'Repeated text still counts as clean, up to about four passes. Past the wall it memorises web junk. Read the model mid-run: frayed sentences mean you are close, cookie banners mean you are past it.</div>';
    h += sec('Buy data', '', 'data-block');
    if (d.job) { var tot = d.job.end - d.job.start, done = clamp((s.day - d.job.start) / tot, 0, 1); h += '<div class="row small"><span>' + esc(X.WORLD.people[d.job.who].first) + ' is cleaning the crawl</span><span class="num">' + Math.max(0, Math.ceil(d.job.end - s.day)) + ' days left</span></div><div class="meter" style="margin-top:4px"><i style="width:' + (done * 100).toFixed(1) + '%"></i></div><div class="small muted" style="margin-top:4px">When it finishes the wall moves out by about 86% in text, roughly ten times the compute. Runs started before then are judged against the old wall.</div>'; }
    else { var cf = dv.canFilter; h += '<button type="button" class="btn full" data-act="filter" id="clean-btn"' + (cf.ok ? '' : ' disabled') + '><span class="l"><span>Clean the crawl · ' + esc(f.moneyFull(dv.filterCost)) + ' · ' + dv.filterDays + ' days</span><span class="sub">' + (cf.ok ? '+86% fresh text; each cleaning costs twice the last' : esc(cf.msg.replace('filter job', 'cleaning'))) + '</span></span><span class="p out">−' + esc(f.money(dv.filterCost)) + '</span></button>'; }
    var dl = null; for (var i = 0; i < s.feed.length; i++) if (s.feed[i].kind === 'data') { dl = s.feed[i]; break; }
    if (dl) h += '<div class="card" style="margin-top:8px"><div class="row small"><span class="nm">' + esc(dl.name) + '</span><span class="dim num">' + esc(f.date(dl.day)) + '</span></div><div class="say">' + esc(dl.text) + '</div></div>';
    X.setHTML('b-data', h);
    X.setHTML('s-data', 'fresh ' + esc(f.size(fresh)) + ' · wall ' + esc(f.size(d.lo)) + '–' + esc(f.size(d.hi)) + (d.job ? ' · cleaning ' + Math.max(0, Math.ceil(d.job.end - s.day)) + 'd' : ''));
  };

  /* ================= RIVALS AND NEWS ================= */
  X.renderRivals = function () {
    var g = G(), s = S(), f = F(), CFG = X.CFG, h = '', rows = g.rankings(), rank = g.myRank();
    if (s.slipN >= 1 || s.day >= 31) { var rr = $('r-rivals'); if (rr.hidden) { rr.hidden = false; X.softLight('rivals', rr); } }
    h += sec('The league', 'trust ' + Math.round(s.rep) + ' of 100');
    h += '<div class="league">';
    var list = rows.slice();
    if (s.day >= CFG.gpt3Day) list.unshift({ key: 'gpt3', name: 'GPT-3', C: CFG.gpt3C, short: 1, gpt: true, arrow: 0 });
    list.forEach(function (r) {
      var sh = r.C > 0 ? g.shortOf(r.C) : null, arrow = r.arrow > 0 ? '▲' : r.arrow < 0 ? '▼' : '–';
      h += '<div class="lg' + (r.you ? ' you' : '') + (r.gpt ? ' gpt' : '') + '"><span class="rk num">' + (r.gpt ? '' : r.rank) + '</span><span class="nm">' + esc(r.name) + '</span><span class="sh num">' + (r.gpt ? 'the bar' : sh ? (sh <= 1.05 ? 'passed it' : esc(f.ratio(sh)) + ' short') : 'no model yet') + '</span><span class="ar' + (r.arrow > 0 ? ' up' : '') + '" aria-hidden="true">' + arrow + '</span></div>';
    });
    h += '</div>';
    var names = s.rivals.map(function (rv) { return rv.people.length ? rv.name + ' took ' + rv.people.join(', ') : ''; }).filter(Boolean);
    if (names.length) h += '<div class="small muted" style="margin-top:4px">' + esc(names.join(' · ')) + '</div>';
    h += '<div class="small muted" style="margin-top:4px">Ranked by each lab’s biggest published or clean result. Publishing pulls every lab behind you toward your result within 14 days.</div>';
    // news and inbox
    var items = [];
    X.ui.newsLog.forEach(function (n) { items.push({ day: n.day, k: 'news', html: '<span class="who">NEWS</span><span class="t">' + esc(n.news.text) + '</span>' + (n.news.note ? '<span class="fx-note">' + esc(n.news.note) + '</span>' : '') }); });
    s.feed.slice(0, 60).forEach(function (fe) {
      var who = fe.who === 'lab' ? '' : '<span class="who">' + esc(fe.name) + '</span>';
      items.push({ day: fe.day, k: fe.kind === 'voice' || fe.kind === 'data' || fe.kind === 'knock' ? 'voice' : fe.kind, html: who + '<span class="t">' + esc(fe.text) + '</span>' });
    });
    s.decided.slice(0, 20).forEach(function (d) { items.push({ day: d.answeredDay != null ? d.answeredDay : d.day, k: 'decided', html: '<span class="t">' + esc(d.title) + ' → <b>' + esc(d.answer) + '</b></span>' }); });
    items.sort(function (a, b) { return b.day - a.day; });
    h += sec('News and the lab');
    h += '<div class="feed">' + items.slice(0, 40).map(function (it) { return '<div class="fi ' + it.k + '"><span class="d">' + esc(f.date(it.day)) + '</span><span>' + it.html + '</span></div>'; }).join('') + '</div>';
    X.setHTML('b-rivals', h);
    X.setHTML('s-rivals', 'you are #' + rank);
  };

  /* ================= MODELS: the shelf ================= */
  function repro(p, r) {
    if (!p.published) return '';
    var rp = G().reproduction(r); if (!rp) return '';
    return rp.done ? 'Northwind reproduced your result in ' + (rp.days >= 14 ? Math.round(rp.days / 7) + ' weeks' : Math.round(rp.days) + ' days') : 'released ' + Math.max(0, Math.round(rp.days)) + ' days ago';
  }
  X.renderModels = function () {
    var g = G(), s = S(), f = F(), CFG = X.CFG, pl = g.plaques(), h = '';
    var items = pl.map(function (p, i) {
      var r = s.runs.filter(function (x) { return x.id === p.id; })[0];
      var newest = i === 0, tests = '';
      if (newest) tests = '<span class="pl-tests">' + p.tests.map(function (t) { var name = X.WORLD.caps[t.id].label; return '<i class="' + (t.ok ? 'on' : t.id === 'code' ? 'off' : '') + '" title="' + esc(name) + (t.ok ? '' : t.id === 'code' ? ': not seen in 2020' : ': needs ' + Math.max(1.1, t.needLo).toFixed(t.needLo >= 10 ? 0 : 1) + '× to ' + t.needHi.toFixed(t.needHi >= 10 ? 0 : 1) + '× more compute') + '">' + esc(name) + '</i>'; }).join('') + '</span>';
      var flag = p.shipped ? 'shipped' : p.published ? 'published' : p.pending ? 'with Meridian' : p.clean ? 'private' : 'hollow';
      return '<button type="button" class="plaque' + (p.clean ? '' : ' bad') + (newest ? ' newest' : '') + (X.ui.newPlaque === p.id ? ' thunk' : '') + '" data-plaque="' + p.id + '"><span class="pl-top"><span class="pl-name">' + esc(p.name) + '</span><span class="pl-flag ' + flag + '">' + flag + '</span></span><span class="pl-meta num">' + esc(f.short(p.day)) + ' · ' + esc(f.size(p.N)) + ' model · ' + esc(p.clean ? f.ratio(p.short) + ' short' : 'past the wall') + '</span><span class="pl-line">' + esc(p.line) + '</span>' + tests + (repro(p, r) ? '<span class="pl-note">' + esc(repro(p, r)) + '</span>' : '') + '</button>';
    });
    var ordered = items;   // newest first on the phone; the laptop shelf reverses it by CSS (newest right)
    if (!items.length) ordered = ['<div class="plaque empty"><span class="pl-name">Your first saved model</span><span class="pl-line">goes on this shelf when a run lands</span></div>'];
    h += '<div class="plaques" id="plaques">' + ordered.join('') + '</div>';
    // the API meter and open weights
    var am = g.apiMeter(), om = g.openMeter();
    if (am) {
      var apps = ['writing helper', 'search box', 'chat widget', 'code snippets', 'email drafts', 'tutor', 'summaries', 'translator'];
      var tiles = ''; for (var i = 0; i < am.apps; i++) tiles += '<i title="' + apps[i % apps.length] + '"></i>';
      h += '<div class="meterapi' + X.fresh('api') + '"><div class="ma-h">THE API</div><div class="ma-w"><b class="num">' + am.waiting.toLocaleString('en-US') + '</b> developers waiting</div><div class="ma-r small muted num">' + am.developers.toLocaleString('en-US') + ' let in · ' + esc(wordsFmt(am.words)) + ' words a day · ' + esc(f.money(am.rev)) + ' a month</div>' + (am.apps ? '<div class="apps" aria-label="apps built on it">' + tiles + '</div>' : '') + '</div>';
    }
    if (om) h += '<div class="meterapi"><div class="ma-h">OPEN WEIGHTS</div><div class="ma-w"><b class="num">' + om.downloads.toLocaleString('en-US') + '</b> downloads</div><div class="ma-r small muted num">' + om.finetunes.toLocaleString('en-US') + ' fine-tunes · $0 a month</div></div>';
    X.setHTML('b-models', h);
    X.setHTML('s-models', pl.length ? pl.length + ' saved model' + (pl.length === 1 ? '' : 's') : 'none yet');
  };
  function wordsFmt(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); }

  /* ---------- the model card ---------- */
  X.modelCardHTML = function (id) {
    var g = G(), s = S(), f = F(), CFG = X.CFG;
    var p = g.plaques().filter(function (x) { return x.id === id; })[0], r = s.runs.filter(function (x) { return x.id === id; })[0]; if (!p || !r) return '';
    var h = '<div class="m-kick"><span class="from">SAVED MODEL</span><span class="num when">' + esc(f.date(p.day, true)) + '</span></div><h3 class="m-title" id="m-title">' + esc(p.name) + '</h3>';
    h += '<p class="m-body" style="color:var(--text)">' + esc(p.clean ? 'It ' + p.line + '.' : 'It memorised web boilerplate: the run went past the data wall.') + '</p>';
    if (r.sample) h += '<p class="m-sample' + (p.caps.indexOf('code') >= 0 ? ' code' : '') + '"><span class="cap">What it said when it finished</span>' + esc(r.sample) + '</p>';
    var above = p.above, abTxt = Math.abs(above) < 0.3 ? 'right on the line' : above < 0 ? Math.abs(above).toFixed(1) + '% below the line' : above.toFixed(1) + '% above the line';
    var beh = p.behindBest != null ? (p.behindBest > 0.005 ? p.behindBest.toFixed(2) + ' behind the best known model' : p.behindBest < -0.005 ? Math.abs(p.behindBest).toFixed(2) + ' ahead of the best known model' : 'level with the best known model') : '';
    h += '<div class="mc-grid">' +
      cardCell('Model size', f.size(p.N) + ' parameters') + cardCell('Text read', f.size(p.D) + ' tokens') + cardCell('Compute', f.sci(p.C) + ' FLOPs') + cardCell('Error score', p.L.toFixed(2) + ' (lower is better)') +
      cardCell('Against the line', abTxt) + cardCell('Against GPT-3', p.short <= 1.05 ? 'passed it' : f.ratio(p.short) + ' short') + '</div>';
    if (beh) h += '<p class="m-body">' + esc('Error score ' + beh + '.') + '</p>';
    h += '<div class="m-evals">' + p.tests.map(function (t) { var nm = X.WORLD.caps[t.id].label; if (t.ok) return '<span class="tag on">✓ ' + esc(nm) + (t.leak ? ' · leaked' : '') + '</span>'; if (t.id === 'code') return '<span class="tag">' + esc(nm) + ' · not seen in 2020</span>'; return '<span class="tag">' + esc(nm) + ' · needs ' + Math.max(1.1, t.needLo).toFixed(t.needLo >= 10 ? 0 : 1) + '×–' + t.needHi.toFixed(t.needHi >= 10 ? 0 : 1) + '× more compute</span>'; }).join('') + '</div>';
    h += '<div class="m-opts"><button type="button" class="btn m-opt primary" data-opt="__close"><span class="ol"><span>Close</span><kbd>Esc</kbd></span></button></div>';
    return h;
  };
  function cardCell(k, v) { return '<div class="rd"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>'; }

  /* ================= rows: open and close, first-time reveals ================= */
  X.renderRows = function () {
    X.renderCluster(); X.renderTeam(); X.renderMoney(); X.renderData(); X.renderRivals(); X.renderModels();
  };
  X.toggleRow = function (row, open) {
    if (!row) return; var on = open == null ? !row.classList.contains('open') : open;
    row.classList.toggle('open', on); var b = row.querySelector('.row-btn'); if (b) b.setAttribute('aria-expanded', String(on));
  };
  X.openRow = function (id, scrollTo) {
    var row = $(id); if (!row) return;
    if (row.hidden) row.hidden = false;
    X.toggleRow(row, true);
    var target = scrollTo ? $(scrollTo) : row;
    setTimeout(function () { try { (target || row).scrollIntoView({ behavior: X.reduced() ? 'auto' : 'smooth', block: 'center' }); } catch (e) { (target || row).scrollIntoView(); } if (target && target !== row) { target.classList.remove('hl'); void target.offsetWidth; target.classList.add('hl'); setTimeout(function () { target.classList.remove('hl'); }, 1600); } }, 30);
  };
})(window.FX);
