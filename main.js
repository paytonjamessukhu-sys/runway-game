/* FRONTIER control room: boot, the frame loop, input, the decision on screen, the end of the year, and the test hook. */
(function (X) {
  'use strict';
  var $ = X.$, esc = X.esc, clamp = X.clamp;
  var botSpeed = 1, lastT = 0;
  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }
  function has(k) { return !!X.G.person(k); }

  function boot(seed) {
    X.G = window.FrontierEngine.create({ seed: seed });
    X.S = X.G.S; X.F = X.G.fmt;
    var G = X.G, S = X.S;
    X.ui = { params: X.CFG.starter.N, tokens: X.CFG.starter.D, recipe: true, pool: 'office', gpus: 8, gpusTouched: false, poolTouched: false, preset: '3w',
      modalId: null, modalShown: 0, stopArm: null, words: null, newsLog: [], lastPanels: 0, lastTop: 0, lastChart: 0, holdUntil: 0, pointerDown: false,
      endShown: false, lastLoad: 0, chartDirty: true, card: null, slip: null, slipUnread: false, runClock: 0, idleClock: 0, rungPulse: false, lastCash: null, cashDir: 0,
      newPlaque: null, newHire: null, design: null, hits: [], voiceOpen: false, lastDay: 0 };
    X.cache = {}; X.resetLights && X.resetLights();
    X.ui.tuned = !(window.innerWidth >= 1180 && window.innerHeight >= 700); $('designer').classList.toggle('tuned', X.ui.tuned); $('d-tune').setAttribute('aria-expanded', String(X.ui.tuned)); $('d-tune').classList.toggle('on', X.ui.tuned);
    G.on(onEvent);
    $('end').hidden = true; $('end').innerHTML = '';
    $('modal').hidden = true; $('scrim').hidden = true; $('slip').hidden = true;
    X.modelEmpty();
    // the first look: Money and Cluster are open on the laptop, everything else folded
    var wide = window.innerWidth >= 1180 && window.innerHeight >= 700;
    ['r-money', 'r-team', 'r-data', 'r-cluster', 'r-rivals', 'r-models'].forEach(function (id) { X.toggleRow($(id), false); });
    if (wide) { X.toggleRow($('r-money'), true); X.toggleRow($('r-cluster'), true); }
    $('r-rivals').hidden = true;
    X.syncDesignerInputs();
    X.applyPreset('3w');
    renderAll(true);
  }

  /* ---------------- engine events: sound, flashes, words ---------------- */
  function onEvent(ev) {
    var ui = X.ui, S = X.S, A = X.AUD;
    ui.chartDirty = true;
    switch (ev.type) {
      case 'decision': A.knock(); A.vibrate(12); break;
      case 'payday': A.payday(); break;
      case 'hang': A.hang(); A.vibrate([30, 40, 30]); break;
      case 'nan': A.hang(); break;
      case 'hangEnd': A.restart(); break;
      case 'launch': A.launch(); ui.preset = null; break;
      case 'land':
        A.land(ev.run.clean); A.thunk && A.thunk(); ui.newPlaque = ev.run.id; setTimeout(function () { if (X.ui === ui) { ui.newPlaque = null; ui.lastPanels = 0; } }, 700);
        X.softLight('pl' + ev.run.id, $('r-models')); renderRowsNow(); break;
      case 'sample': X.streamSample(ev.sample); break;
      case 'news': ui.newsLog.unshift({ day: S.day, news: ev.news }); A.tick(true); break;
      case 'publish': case 'ship': A.tick(true); break;
      case 'candidate': A.tick(true); X.softLight('cand' + ev.cand.key, $('r-team')); break;
      case 'slip': X.showSlip(ev.slip); A.payday(); break;
      case 'end': A[ev.over.kind === 'survived' ? 'land' : 'bad'](true); break;
      case 'day': if (S.api) A.revenue(); break;
    }
  }
  function renderRowsNow() { X.renderRows(); }

  /* ---------------- the decision on screen, and the model card ---------------- */
  function renderModal() {
    var S = X.S, ui = X.ui, d = S.pending, m = $('modal'), sc = $('scrim');
    if (S.over) { if (ui.modalId != null) { m.hidden = true; sc.hidden = true; ui.modalId = null; } return; }
    if (d) {
      if (ui.modalId === d.id) { refreshModalEffects(d); return; }
      ui.modalId = d.id; ui.modalShown = X.nowMs(); ui.card = null;
      var who = d.who && X.WORLD.people[d.who] ? X.WORLD.people[d.who] : null, F = X.F;
      var h = '<div class="m-kick"><span class="from">' + esc(d.from || (who ? who.name.toUpperCase() : '')) + (d.role ? ' · ' + esc(d.role) : '') + '</span><span class="num when">' + esc(F.date(S.day, true)) + ' · paused</span></div>';
      h += '<h3 class="m-title" id="m-title">' + esc(d.title) + '</h3>';
      if (d.kind === 'land' && d.sample) h += '<p class="m-sample' + (d.sampleCap === 'code' ? ' code' : '') + '"><span class="cap">The model, finished</span>' + esc(d.sample) + '</p>';
      if (d.voice) h += '<p class="m-voice">' + esc(d.voice) + (who ? '<span class="by">' + esc(who.name) + ' · ' + esc(who.role) + '</span>' : d.from ? '<span class="by">' + esc(d.from) + '</span>' : '') + '</p>';
      if (d.body) h += '<p class="m-body">' + esc(d.body) + '</p>';
      if (d.evals) h += '<div class="m-evals">' + d.evals.map(function (e) { return '<span class="tag ' + (e.leak ? 'bad' : e.ok ? 'on' : '') + '">' + (e.ok ? '✓ ' : '✗ ') + esc(e.label) + (e.isNew ? ' · new' : '') + (e.leak ? ' · leaked' : '') + '</span>'; }).join('') + '</div>';
      h += '<div class="m-opts">' + d.options.map(function (o, i) {
        return '<button type="button" class="btn m-opt' + (o.primary && !o.disabled ? ' primary' : '') + '" data-opt="' + esc(o.key) + '"' + (o.disabled ? ' disabled' : '') + '><span class="ol"><span>' + esc(o.label) + '</span><kbd>' + (i + 1) + '</kbd></span><span class="oe" data-eff="' + esc(o.key) + '">' + esc(effText(o)) + '</span></button>';
      }).join('') + '</div>';
      h += '<div class="m-foot">The year is paused until you choose. Nothing expires while this is open.</div>';
      m.innerHTML = h; m.className = 'modal' + (d.moment || (d.run && d.run.miracle) ? ' moment' : ''); m.hidden = false; sc.hidden = false;
      var first = m.querySelector('.m-opt.primary:not(:disabled)') || m.querySelector('.m-opt:not(:disabled)');
      try { if (first && !X.isTouch()) first.focus({ preventScroll: true }); } catch (e) {}
      return;
    }
    if (ui.card != null) {
      var key = 'card' + ui.card; if (ui.modalId === key) return;
      ui.modalId = key; ui.modalShown = X.nowMs();
      m.innerHTML = X.modelCardHTML(ui.card); m.className = 'modal card'; m.hidden = false; sc.hidden = false;
      try { var cb = m.querySelector('.m-opt'); if (cb && !X.isTouch()) cb.focus({ preventScroll: true }); } catch (e) {}
      return;
    }
    if (ui.modalId != null) { m.hidden = true; sc.hidden = true; ui.modalId = null; }
  }
  function effText(o) { try { return typeof o.effect === 'function' ? o.effect() : (o.effect || o.why || ''); } catch (e) { return ''; } }
  function refreshModalEffects(d) { d.options.forEach(function (o) { var el = document.querySelector('#modal [data-eff="' + o.key + '"]'); if (el) { var t = effText(o); if (el.textContent !== t) el.textContent = t; } }); }
  function closeCard() { var ui = X.ui; if (ui.card != null) { ui.card = null; renderModal(); } }
  function choose(key, btn) {
    var S = X.S, ui = X.ui, G = X.G, d = S.pending; if (!d) return;
    if (X.nowMs() - ui.modalShown < 350) return;   // a tap meant for the last decision never lands on this one
    X.AUD.unlock(); X.AUD.click();
    var rect = btn && btn.getBoundingClientRect(), b0 = S.bank, burn0 = G.burn();
    var res = G.answer(d.id, key);
    if (res && res.ok) { floatDelta(rect, b0, burn0); renderAll(true); }
  }
  function floatDelta(rect, b0, burn0) {
    var G = X.G, S = X.S, F = X.F; if (!rect) return;
    var db = S.bank - b0, dburn = G.burn() - burn0;
    if (Math.abs(db) >= 1) X.float(rect, X.signed(db, F.money), db < 0 ? 'out' : 'in');
    else if (Math.abs(dburn) >= 1) X.float(rect, (dburn > 0 ? '−' : '+') + F.money(Math.abs(dburn)) + '/mo', dburn > 0 ? 'out' : 'in');
  }

  /* ---------------- the end of the year ---------------- */
  function renderEnd() {
    var S = X.S, ui = X.ui, F = X.F;
    if (!S.over || ui.endShown) return;
    ui.endShown = true;
    var o = S.over, sc = o.score, el = $('end'), good = o.kind === 'survived';
    var h = '<div class="end-in"><div class="end-date">FRONTIER · ' + esc(o.date) + '</div><h2 class="end-head ' + (good ? 'good' : 'bad') + '" id="e-head">' + esc(X.WORLD.ends.head[o.kind]) + '</h2>';
    h += '<p class="end-reason">' + esc(o.reason) + '</p><p class="end-gap">' + esc(o.gap) + '</p>';
    h += '<div class="end-chart"><canvas id="end-chart"></canvas></div>';
    h += '<div class="end-score">' + [['Model vs GPT-3', sc.model], ['Miracle', sc.miracle], ['Trust', sc.rep], ['Revenue', sc.revenue], ['People kept', sc.people]].map(function (x) { return '<div class="rd"><span class="k">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>'; }).join('') + '</div>';
    h += '<div class="row"><span class="end-total">Score ' + sc.total + '</span><button type="button" class="btn primary" id="e-again">Play a new 2020</button></div>';
    h += '<div class="small muted">Score: your best saved model against GPT-3 (100 at its compute, 25 less per tenfold short), +50 for matching it, plus trust, API revenue ($50k = 1) and 5 per person still with you. ' + F.plural(S.stats.runs, 'run') + ', ' + S.stats.published + ' published, ' + S.stats.shipped + ' shipped, ' + F.plural(S.stats.hangs, 'hang') + ', ' + F.plural(S.stats.scandals, 'scandal') + '. Your lab owned ' + esc(F.money(X.G.lab())) + ' at the end.</div></div>';
    el.innerHTML = h; el.hidden = false; $('modal').hidden = true; $('scrim').hidden = true;
    setTimeout(function () { try { X.drawChart($('end-chart'), { end: true }); } catch (e) {} }, 30);
    $('e-again').addEventListener('click', function () { var ns = (S.seed + 1) >>> 0; try { history.replaceState(null, '', '#seed=' + ns); } catch (e) {} boot(ns); });
    try { $('e-again').focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------------- rendering cadence ---------------- */
  function renderAll(force) {
    X.renderStrip(0.016); X.renderLadder(); X.renderVoice();
    X.renderRunbar(); X.renderDesigner(); X.renderRows();
    renderModal(); renderEnd();
    X.ui.chartDirty = true;
  }
  function frame(t) {
    var ui = X.ui, S = X.S, G = X.G;
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
    try {
      if (!document.hidden) G.tick(dt * botSpeed);
      var running = S.started && !S.paused && !S.pending && !S.over;
      if (running) ui.runClock += dt; else if (!S.started && !S.over) ui.idleClock += dt;
      ui.rungPulse = S.stats.runs === 0 && ((running && ui.runClock >= 15) || (!S.started && ui.idleClock >= 20));
      X.renderStrip(dt); X.pumpWords(); X.tickSlip();
      var n = X.nowMs();
      if (n - ui.lastTop > 120) { ui.lastTop = n; X.renderLadder(); X.renderVoice(); X.renderRunbar(); renderModal(); renderEnd(); }
      if (n - ui.lastPanels > 260 && n > ui.holdUntil) { ui.lastPanels = n; X.renderDesigner(); X.renderRows(); }
      if (S.active.length || ui.chartDirty || n - ui.lastChart > 600) { ui.lastChart = n; ui.chartDirty = false; X.drawChart($('chart')); }
      if (n - ui.lastLoad > 500) { ui.lastLoad = n; var cards = 0; S.active.forEach(function (x) { if (!x.hang) cards += x.cards; }); X.AUD.load(cards, cards > 0 && !S.paused && !S.pending && !S.over); }
    } catch (e) { if (window.console) console.error(e); }
    requestAnimationFrame(frame);
  }

  /* ---------------- input ---------------- */
  function hold(ms) { var ui = X.ui; ui.holdUntil = Math.max(ui.holdUntil, X.nowMs() + ms); }
  document.addEventListener('pointerdown', function () { X.ui.pointerDown = true; hold(600); X.AUD.unlock(); }, true);
  document.addEventListener('pointerup', function () { X.ui.pointerDown = false; hold(120); }, true);
  document.addEventListener('pointercancel', function () { X.ui.pointerDown = false; }, true);
  document.addEventListener('keydown', function () { X.AUD.unlock(); }, true);

  function doAct(name, p, btn) {
    var G = X.G, S = X.S, ui = X.ui, rect = btn && btn.getBoundingClientRect(), b0 = S.bank, burn0 = G.burn();
    var res = G.act(name, p || {});
    if (res && !res.ok && res.msg) { S.feed.unshift({ day: S.day, who: 'lab', name: '', text: res.msg, kind: 'warn' }); }
    if (res && res.ok) { floatDelta(rect, b0, burn0); if (name === 'hire') { ui.newHire = p.id; setTimeout(function () { if (X.ui === ui) { ui.newHire = null; ui.lastPanels = 0; } }, 900); } }
    X.AUD.click(); renderAll(true);
    return res;
  }

  function rungAction(id, btn) {
    var G = X.G, S = X.S, ui = X.ui, L = G.ladder(), r = L.rungs.filter(function (x) { return x.id === id; })[0];
    if (id === 'start') { doAct('preset', { days: X.CFG.preset.days }, btn); return; }
    if (id === 'land') {
      if (!S.started || S.paused) { S.started = true; S.paused = false; }
      if (S.active.length) doAct('sample', {}, null); else renderAll(true);
      return;
    }
    if (id === 'seriesA' || id === 'seriesB') { X.openRow('r-money', 'raise-block'); return; }
    // anything else: set the designer to a run that would get there, and show it
    var target = r && r.target ? r.target * (id === 'paragraph' || id === 'arith' || id === 'translate' || id === 'api' ? 1.7 : 1.02) : 0;
    var d = target ? G.designFor(target, ui.pool) : null;
    if (d) { ui.params = d.params; ui.recipe = true; ui.tokens = G.recipeTokens(d.params); ui.gpusTouched = false; ui.preset = null; X.syncDesignerInputs(); X.renderDesigner(); ui.chartDirty = true; }
    var el = $('designer'); try { el.scrollIntoView({ behavior: X.reduced() ? 'auto' : 'smooth', block: 'center' }); } catch (e) {}
    el.classList.remove('hl'); void el.offsetWidth; el.classList.add('hl'); setTimeout(function () { el.classList.remove('hl'); }, 1600);
  }
  function verbAction(v) {
    if (v === 'hire') X.openRow('r-team', 'hire-block');
    else if (v === 'rent') X.openRow('r-cluster', 'rent-block');
    else if (v === 'data') X.openRow('r-data', 'data-block');
    else if (v === 'raise') X.openRow('r-money', 'raise-block');
  }

  document.getElementById('fx').addEventListener('click', function (e) {
    var ui = X.ui, S = X.S, G = X.G, tgt = e.target;
    if (!tgt.closest) return;
    var t = tgt.closest('button');
    if (!t) {
      var rh = tgt.closest('.row-h'); if (rh) X.toggleRow(rh.parentNode);
      if (tgt.id === 'scrim' && ui.card != null) closeCard();
      return;
    }
    if (t.disabled && !t.classList.contains('verb')) return;
    if (t.hasAttribute('data-opt')) { var ok = t.getAttribute('data-opt'); if (ok === '__close') { closeCard(); return; } choose(ok, t); return; }
    if (t.hasAttribute('data-rung')) { rungAction(t.getAttribute('data-rung'), t); return; }
    if (t.hasAttribute('data-verb')) { verbAction(t.getAttribute('data-verb')); return; }
    if (t.hasAttribute('data-preset')) { X.applyPreset(t.getAttribute('data-preset')); return; }
    if (t.hasAttribute('data-pool')) { ui.pool = t.getAttribute('data-pool'); ui.poolTouched = true; ui.gpusTouched = false; ui.preset = null; X.renderDesigner(); ui.chartDirty = true; return; }
    if (t.hasAttribute('data-tile')) {
      var k = t.getAttribute('data-tile'); X.openRow('r-team', k === 'board' ? 'hire-block' : 'pc-' + k); return;
    }
    if (t.hasAttribute('data-plaque')) { ui.card = +t.getAttribute('data-plaque'); renderModal(); return; }
    if (t.classList.contains('row-btn')) { X.toggleRow(t.closest('.fold')); return; }
    if (t.id === 't-pause') { if (S.over) return; G.act('pause', { on: S.started && !S.paused ? true : false }); if (!S.started) { S.started = true; S.paused = false; } X.renderStrip(0.016); return; }
    if (t.classList.contains('sp')) { G.act('speed', { x: +t.getAttribute('data-speed') }); S.started = true; X.renderStrip(0.016); return; }
    if (t.id === 't-mute') { X.AUD.unlock(); X.AUD.setMuted(!X.AUD.muted); X.renderStrip(0.016); return; }
    if (t.id === 't-month') { X.toggleLedger(); return; }
    if (t.id === 'slip-x') { X.hideSlip(false); return; }
    if (t.id === 'lg-x') { X.toggleLedger(false); return; }
    if (t.id === 'vq') { ui.voiceOpen = !ui.voiceOpen; X.cache.voice = null; X.renderVoice(); return; }
    if (t.id === 'd-tune') { ui.tuned = !ui.tuned; $('designer').classList.toggle('tuned', ui.tuned); t.setAttribute('aria-expanded', String(ui.tuned)); t.classList.toggle('on', ui.tuned); ui.chartDirty = true; return; }
    if (t.id === 'd-launch') { launch(t); return; }
    var a = t.getAttribute('data-act'); if (!a) return;
    if (a === 'stop') { var sid = +t.getAttribute('data-id'); if (ui.stopArm && ui.stopArm.id === sid && X.nowMs() - ui.stopArm.t < 3000) { ui.stopArm = null; doAct('stop', { id: sid }, null); } else { ui.stopArm = { id: sid, t: X.nowMs() }; X.cache.runbar = null; X.renderRunbar(); } return; }
    if (a === 'sample') { doAct('sample', t.hasAttribute('data-id') ? { id: +t.getAttribute('data-id') } : {}, null); return; }
    if (a === 'hire' || a === 'wake') { doAct(a, { id: t.getAttribute('data-id') }, t); return; }
    if (a === 'renew') { doAct('renew', { id: t.getAttribute('data-id') }, t); return; }
    if (a === 'rent') { doAct('rent', { gpus: +t.getAttribute('data-n') }, t); return; }
    if (a === 'buy') { if (t.hasAttribute('data-box')) doAct('buy', { box: t.getAttribute('data-box'), units: +t.getAttribute('data-units') }, t); else doAct('buy', { item: t.getAttribute('data-item') }, t); return; }
    if (a === 'raise') { doAct('raise', { round: t.getAttribute('data-round') }, t); return; }
    doAct(a, {}, t);
  });
  // a tap on the curve near a saved model opens its card
  $('chartwrap').addEventListener('click', function (e) {
    var ui = X.ui; if (!ui.hits || e.target.closest('.slip')) return;
    var r = $('chart').getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null;
    ui.hits.forEach(function (h) { var d = Math.hypot(h.x - x, h.y - y); if (d <= h.r + 6 && (!best || d < best.d)) best = { d: d, id: h.id }; });
    if (best) { ui.card = best.id; renderModal(); }
  });
  function launch(btn) {
    var G = X.G, S = X.S, d = X.currentDesign();
    var rect = btn && btn.getBoundingClientRect(), b0 = S.bank;
    var res = G.act('launch', { params: d.N, tokens: d.D, pool: d.pool, gpus: d.cards });
    X.AUD.unlock();
    if (res.ok) { S.paused = false; X.ui.preset = null; }
    else if (res.msg) S.feed.unshift({ day: S.day, who: 'lab', name: '', text: res.msg, kind: 'warn' });
    renderAll(true);
  }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var S = X.S, G = X.G, ui = X.ui;
    var tag = (e.target && e.target.tagName) || '', typing = tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if (typing) return;
    if (e.key === 'Escape') { if (ui.card != null) { closeCard(); return; } if (!$('ledger').hidden) { X.toggleLedger(false); return; } if (ui.slip) { X.hideSlip(false); return; } }
    if (S.over) return;
    if (S.pending) {
      var k = parseInt(e.key, 10);
      if (k >= 1 && k <= S.pending.options.length) { var o = S.pending.options[k - 1]; if (!o.disabled) { e.preventDefault(); choose(o.key, document.querySelector('#modal [data-opt="' + o.key + '"]')); } }
      return;
    }
    if (ui.card != null) return;
    if (e.key === ' ' || e.code === 'Space') { if (tag === 'BUTTON' || tag === 'SUMMARY') return; e.preventDefault(); if (!S.started) { S.started = true; S.paused = false; } else G.act('pause'); X.renderStrip(0.016); return; }
    if (e.key === '1' || e.key === '2') { G.act('speed', { x: +e.key }); S.started = true; X.renderStrip(0.016); return; }
    if (e.key === 's' || e.key === 'S') { doAct('sample', {}, null); return; }
    if (e.key === 'l' || e.key === 'L') { if (!$('d-launch').disabled) launch($('d-launch')); return; }
    if (e.key === 'm' || e.key === 'M') { X.AUD.setMuted(!X.AUD.muted); X.renderStrip(0.016); return; }
    if (e.key === 'p' || e.key === 'P') { G.act('pause'); X.renderStrip(0.016); return; }
  });
  document.addEventListener('visibilitychange', function () { X.AUD.suspend(document.hidden); lastT = 0; });
  window.addEventListener('resize', function () { X.ui.chartDirty = true; });
  window.addEventListener('orientationchange', function () { X.ui.chartDirty = true; });
  document.addEventListener('click', function (e) { var lg = $('ledger'); if (lg && !lg.hidden && !e.target.closest('#ledger') && !e.target.closest('#t-month')) X.toggleLedger(false); }, true);

  /* ---------------- the test hook (playtesters and bots; players never see it) ---------------- */
  function plainState() {
    var G = X.G, S = X.S, st = G.state(), L = G.ladder(), rs = G.roundStatus();
    st.strip = { cash: Math.round(S.bank), broke: isFinite(G.runway()) ? +G.runway().toFixed(1) : null, short: G.farthestClean() > 0 ? +G.shortOf(G.farthestClean()).toFixed(2) : null, owns: Math.round(G.lab()), month: G.dateOf(S.day).getUTCMonth() + 1 };
    st.snap = S.snap ? { bank: Math.round(S.snap.bank), runway: S.snap.runway, short: S.snap.short, lab: Math.round(S.snap.lab) } : null;
    st.ladder = { lit: L.lit >= 0 ? L.rungs[L.lit].id : null, rungs: L.rungs.map(function (r) { return { id: r.id, done: r.done, prog: +(r.prog || 0).toFixed(3), left: r.left || null }; }) };
    st.round = { next: rs.next, legal: rs.legal, why: rs.why, post: rs.terms ? Math.round(rs.terms.post) : null };
    st.slips = S.slips.map(function (x) { return { month: x.month, lines: x.lines.map(function (l) { return l.text; }) }; });
    st.idle = G.idle(); st.verbPulse = X.ui.verbPulse || null; st.rungPulse = !!X.ui.rungPulse;
    st.rank = G.myRank(); st.plaques = G.plaques().length;
    return st;
  }
  window.__frontier = {
    state: plainState,
    act: function (name, payload) {
      var res; payload = payload || {};
      if (name === 'speed' && payload.x == null && payload.n != null) payload = { x: payload.n };
      if (name === 'launch' && payload.design) { var d = X.currentDesign(); res = X.G.act('launch', { params: d.N, tokens: d.D, pool: d.pool, gpus: d.cards }); }
      else res = X.G.act(name, payload);
      renderAll(true);
      return res;
    },
    speed: function (n) { botSpeed = Math.max(0.1, +n || 1); return botSpeed; },
    design: function (p) { return X.G.design(p); },
    advance: function (days) { X.G.act('advance', { days: days }); renderAll(true); return plainState(); },
    engine: function () { return X.G; },
    view: function () { return { ladder: X.G.ladder(), shelf: X.G.shelf(), rankings: X.G.rankings(), plaques: X.G.plaques(), burn: X.G.burnParts(), idle: X.G.idle(), roundStatus: X.G.roundStatus() }; }
  };

  X.designerInit();
  boot(seedFromHash() != null ? seedFromHash() : (Math.floor(Math.random() * 1e9) >>> 0));
  requestAnimationFrame(frame);
})(window.FX);
