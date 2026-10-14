/* FRONTIER control room, build A: start-up and the test hook for playtesters and bots. Normal players never see it. */
(function () {
  'use strict';
  var FX = window.FX, CFG = FX.CFG, ui = FX.ui;
  function plainState() {
    var E = FX.E, S = FX.S; if (!S) return null;
    var ls = S.lastSample, L = E.ladder(), st = E.standing(), far = E.farthestClean(), sl = S.slips[S.slips.length - 1];
    return {
      seed: ui.seed, date: E.fmtLong(Math.min(S.day, 365)), day: +S.day.toFixed(3), phase: S.phase, end: S.end ? { kind: S.end.kind, reason: S.end.reason, gap: S.end.gap, score: S.end.score.total } : null,
      speed: ui.speed, runClock: +ui.runClock.toFixed(1), blocked: E.blocked(), bank: Math.round(S.bank), burn: Math.round(E.burn()), runway: E.runway() === Infinity ? null : +E.runway().toFixed(2), rep: Math.round(S.rep), stake: +S.stake.toFixed(4),
      strip: { cash: Math.round(S.bank), months: E.runway() === Infinity ? null : Math.floor(E.runway()), short: far ? +(CFG.gpt3.C / far).toFixed(2) : null, lab: Math.round(E.lab()) },
      ladder: L.rungs.map(function (r, i) { return { id: r.id, label: r.label, lit: i === L.lit, done: !!r.done, progress: +(r.prog || 0).toFixed(3), left: r.left }; }),
      slips: S.slips.length, lastSlip: sl ? sl.lines.map(function (l) { return l.t; }) : null,
      computePFperDay: +(E.flopsPerDay(true) / 8.64e19).toFixed(3), trainingSpeed: +E.trainingSpeed().toFixed(2), relevantUntil: S.relevantUntil, relevanceNeed: E.relevanceNeed(), frontier: E.frontier(),
      inbox: S.inbox.map(function (d) { return { id: d.id, kind: d.kind, title: d.title, options: d.options.map(function (o) { return { key: o.key, disabled: !!o.disabled }; }) }; }),
      runs: S.runs.map(function (r) { return { id: r.id, name: E.modelName(r), state: r.state, q: +r.q.toFixed(4), C: r.C, N: r.N, D: r.D, pool: r.pool, cards: r.cards, loss: r.loss, clean: r.clean, onLine: r.onLine, published: r.published, shipped: r.shipped, kept: r.kept, hangs: r.hangs.length, hung: !!r.hang, caps: r.capsOn, line: r.state === 'landed' ? E.modelLine(r) : null }; }),
      lastSample: ls ? { run: ls.run, q: ls.q, text: FX.plainText(ls.text), junk: ls.amt, loss: +ls.loss.toFixed(3) } : null,
      wall: { lo: Math.round(S.wallLo), hi: Math.round(S.wallHi), filters: S.filters, filterJob: S.filterJob ? Math.ceil(S.filterJob.until - S.day) : null },
      team: E.staff().map(function (p) { return { id: p.key, role: p.role, salary: p.salary, mood: Math.round(p.mood) }; }),
      cands: S.cands.map(function (c) { return { id: c.key, ask: E.candAsk(c), blocked: E.candReq(c) || null, courtIn: Math.ceil(c.courtBy - S.day) }; }),
      cluster: CFG.pools.map(function (p) { return E.poolInfo(p); }), rented: E.rentedCount(), orders: S.orders.map(function (o) { return { label: o.label, arrive: Math.round(o.arrive), cards: o.cards }; }), meridian: S.mer ? { cards: S.mer.cards, alloc: S.mer.alloc, live: S.mer.live } : null,
      raise: { aDone: S.raise.aDone, bDone: S.raise.bDone, diligence: S.raise.diligence ? S.raise.diligence.round : null, block: E.raiseBlock() },
      standing: { rank: st.rank, rows: st.rows.map(function (r) { return { name: r.name, short: r.short ? +r.short.toFixed(1) : null }; }) },
      best: E.bestRun() ? { C: E.bestRun().Cland, loss: E.bestRun().loss } : null, log: S.log.slice(-60).map(function (l) { return E.fmtDay(l.day) + ' ' + l.text; }), news: S.news.length, caps: S.caps.filter(function (c) { return c.fired; }).map(function (c) { return c.id; }),
      api: E.apiMeter(), openRows: Object.keys(ui.open).filter(function (k) { return ui.open[k]; }),
      options: (ui.options || []).map(function (o) { return { key: o.key, title: o.title, price: o.price || '', effect: o.effect || '', locked: !!o.lock, pulse: !!o.pulse }; }),
      shelf: S.runs.filter(function (r) { return r.state === 'landed' || r.state === 'train'; }).map(function (r) { return { id: r.id, name: E.modelName(r), state: r.state }; })
    };
  }
  window.__frontier = {
    state: plainState,
    act: function (name, p) {
      p = p || {};
      var E = FX.E, r;
      if (name === 'speed') { FX.setSpeed(+(p.x != null ? p.x : p.speed || 1)); r = { ok: true }; }
      else if (name === 'pause') { FX.setSpeed(0); r = { ok: true }; }
      else if (name === 'newyear') { FX.newGame(p.seed); r = { ok: true }; }
      else if (name === 'design') { r = { ok: true, design: E.design(p) }; }
      else if (name === 'quickstart') { r = FX.quickStart(); }
      else if (name === 'suggest') { var sg = E.suggest(p); r = sg ? { ok: sg.ok, N: sg.N, D: sg.D, C: sg.C, cards: sg.cards, pool: sg.pool, days: sg.daysAll, land: sg.land } : { ok: false }; }
      else if (name === 'autolaunch') { var sg2 = E.suggest(p); r = sg2 && sg2.ok ? E.act('launch', { pool: sg2.pool, gpus: sg2.cards, params: sg2.N, tokens: sg2.D }) : { ok: false, msg: 'nothing fits' }; if (r.ok && FX.ui.speed === 0 && p.go) FX.setSpeed(1); }
      else if (name === 'option') { var ob = document.querySelector('[data-k="ob-' + p.key + '"]'); if (ob && !ob.disabled) { ob.click(); r = { ok: true }; } else r = { ok: false, msg: 'option locked or missing' }; }
      else if (name === 'open') { ui.open[p.row] = p.on == null ? true : !!p.on; r = { ok: true }; }
      else { r = E.act(name, p); }
      ui.dirty = true; ui.modalId = null; FX.renderPanels();
      return r;
    },
    speed: function (n) { ui.botMult = Math.max(0.1, +n || 1); return ui.botMult; },
    advance: function (days) { if (FX.S && FX.S.phase === 'play') FX.E.advance(+days || 1); ui.dirty = true; return plainState(); }
  };
  FX.start();
})();
