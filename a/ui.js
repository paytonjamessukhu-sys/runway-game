/* FRONTIER control room, build A: the screen core. Reads the engine, patches the page in place, turns taps and clicks into
   engine actions. No game rule lives here; every number shown comes from the engine (E) and the state it keeps (S).
   chart.js draws the curve, rows.js draws the folded rows, boot.js starts the game. */
(function () {
  'use strict';
  var FX = window.FX = {};
  var CFG = FX.CFG = window.FRONTIER_CONFIG, W = FX.W = window.FRONTIER_WORLD, CORPUS = window.FRONTIER_CORPUS, FE = FX.FE = window.FrontierEngine, AU = FX.AU = window.FrontierAudio;
  var $ = FX.$ = function (id) { return document.getElementById(id); };
  var fmtMoney = FE.fmtMoney, sci = FE.sci, bigNum = FE.bigNum, pct = FE.pct, log10 = FE.log10, clamp = FE.clamp;
  var root = FX.root = $('fx');
  FX.E = null; FX.S = null;
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  FX.reduced = function () { return !!(mqReduce && mqReduce.matches); };
  FX.laptop = function () { return window.innerWidth >= 1000 && window.innerHeight >= 561; };
  FX.wide = function () { return window.innerWidth >= 760; };
  FX.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  FX.store = function (k, v) { try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; } return null; };

  var ui = FX.ui = {
    speed: 0, lastSpeed: 1, everStarted: false, runClock: 0, botMult: 1, held: false,
    des: { pool: 'office', gpus: 8, gpusMax: true, N: 1e9, D: 2e10, recipe: true },
    rentN: 64, buy: { dgx1: 1, dgxa100: 8 }, feed: 'all', modalId: null, endShown: false, endClosed: false,
    lastFrame: 0, lastPanels: 0, lastChart: 0, cashShown: null, runwayShown: null, stopArm: null, dirty: true, seed: null,
    open: {}, seen: {}, sel: null, details: false, slipUntil: 0, ledgerOpen: false, newSlip: false, flash: {}, lastDesign: null, cardRun: null,
    pulseSince: 0, lastBank: null, introPulse: false, lastSlipN: 0
  };

  /* ---------------- small helpers ---------------- */
  FX.money = function (x, sign) { return fmtMoney(x, sign).replace(/K$/, 'k'); };
  FX.days = function (n) { return n >= 10 ? Math.round(n) + ' days' : n >= 1 ? n.toFixed(1) + ' days' : Math.max(1, Math.round(n * 24)) + ' hours'; };
  FX.fmtRunway = function (m) { return !isFinite(m) ? 'no limit' : m >= 10 ? String(Math.floor(m)) : m.toFixed(1); };
  FX.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  FX.setText = function (el, t) { if (el && el.__t !== t) { el.textContent = t; el.__t = t; } };
  FX.btn = function (act, label, attrs, cls, disabled, k) { return '<button type="button" class="btn sm ' + (cls || '') + '" data-act="' + act + '"' + (attrs || '') + (k ? ' data-k="' + k + '"' : '') + (disabled ? ' disabled' : '') + '>' + label + '</button>'; };
  FX.sampleHTML = function (text) { return FX.esc(text).replace(/\u0001/g, '<span class="junk">').replace(/\u0002/g, '</span>'); };
  FX.plainText = function (text) { return String(text || '').replace(/[\u0001\u0002]/g, ''); };
  FX.setClass = function (el, cls, on) { if (el && el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); };

  // panels are patched in place, not replaced, so a button under a finger or a cursor survives the next redraw
  FX.setHTML = function setHTML(el, html) {
    if (!el || el.__h === html) return false;
    el.__h = html;
    var tpl = document.createElement('template'); tpl.innerHTML = html;
    morphChildren(el, tpl.content);
    return true;
  };
  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
    if (a.nodeType === 1 && (a.getAttribute('data-k') || '') !== (b.getAttribute('data-k') || '')) return false;
    return true;
  }
  function morphChildren(a, b) {
    var bn = b.childNodes, i = 0;
    for (; i < bn.length; i++) {
      var nb = bn[i], na = a.childNodes[i];
      if (!na) { a.appendChild(nb.cloneNode(true)); continue; }
      if (!sameNode(na, nb)) { a.replaceChild(nb.cloneNode(true), na); continue; }
      if (na.nodeType === 3 || na.nodeType === 8) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; continue; }
      var j, at;
      for (j = na.attributes.length - 1; j >= 0; j--) { at = na.attributes[j]; if (!nb.hasAttribute(at.name)) na.removeAttribute(at.name); }
      for (j = 0; j < nb.attributes.length; j++) { at = nb.attributes[j]; if (na.getAttribute(at.name) !== at.value) na.setAttribute(at.name, at.value); }
      if (na.nodeName === 'BUTTON') na.disabled = nb.hasAttribute('disabled');
      morphChildren(na, nb);
    }
    while (a.childNodes.length > bn.length) a.removeChild(a.lastChild);
  }

  /* ---------------- new game ---------------- */
  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }
  FX.newGame = function (seed) {
    if (seed == null) seed = Math.floor(Math.random() * 1e9) + 1;
    ui.seed = seed;
    var E = FX.E = FE.create(CFG, W, CORPUS, seed), S = FX.S = E.S;
    E.on(onEvent);
    E.advance(0);
    ui.speed = 0; ui.everStarted = false; ui.runClock = 0; ui.endShown = false; ui.endClosed = false; ui.modalId = null; ui.cashShown = S.bank; ui.runwayShown = null;
    ui.seen = {}; ui.sel = null; ui.slipUntil = 0; ui.ledgerOpen = false; ui.newSlip = false; ui.flash = {}; ui.cardRun = null; ui.lastSlipN = 0; ui.lastBank = S.bank; ui.pulseSince = 0; ui.introPulse = false;
    ui.open = FX.laptop() ? { cluster: true, money: true } : {};
    ui.des = { pool: 'office', gpus: 8, gpusMax: true, N: 1e9, D: 2e10, recipe: true };
    var r = E.recipeForN(1e8); ui.des.N = r.N; ui.des.D = r.D;
    $('end').hidden = true; $('modal').hidden = true; $('card').hidden = true; $('ledger').hidden = true; $('slip').hidden = true; root.classList.remove('over');
    ['row-news'].forEach(function (id) { $(id).hidden = true; });
    FX.syncDesignerInputs(); FX.applyPreset('21'); FX.renderAll();
    setSpeed(0);
  };

  /* ---------------- events from the engine: sound, flashes and redraws ---------------- */
  function onEvent(kind, d) {
    var E = FX.E, S = FX.S;
    ui.dirty = true;
    switch (kind) {
      case 'payroll': AU.payroll(); flashFig('cash', 'out'); break;
      case 'cash': if (d.delta > 0) { AU.cashIn(); flashFig('cash', 'in'); } else { AU.tick(false); flashFig('cash', 'out'); } break;
      case 'hang': AU.hang(); break;
      case 'nan': AU.nan(); break;
      case 'land': AU.land(d.clean); AU.thunk(); ui.thunkRun = d.id; ui.shelfScroll = true; break;
      case 'decision': AU.knock(); break;
      case 'scandal': AU.bad(); break;
      case 'slip': ui.newSlip = true; ui.slipUntil = performance.now() + 10000; ui.slipShown = false; ui.lastSlipN = d.n; AU.slip(); break;
      case 'launch': ui.pulseSince = 0; if (FX.cellSweep) FX.cellSweep(); break;
      case 'end': AU.hum(0, false); break;
    }
  }
  function flashFig(which, dir) {
    var el = which === 'cash' ? $('f-cash') : null; if (!el) return;
    el.classList.remove('flash-in', 'flash-out'); void el.offsetWidth; el.classList.add(dir === 'in' ? 'flash-in' : 'flash-out');
    clearTimeout(el.__ft); el.__ft = setTimeout(function () { el.classList.remove('flash-in', 'flash-out'); }, 750);
  }

  /* ---------------- speed ---------------- */
  function setSpeed(x) {
    ui.speed = x; if (x > 0) { ui.lastSpeed = x; ui.everStarted = true; }
    ['0', '1', '2'].forEach(function (k) { var b = $('sp' + k); if (b) b.setAttribute('aria-pressed', String(+k === x)); });
    root.classList.toggle('paused', x === 0);
  }
  FX.setSpeed = setSpeed;
  function togglePause() { setSpeed(ui.speed > 0 ? 0 : (ui.lastSpeed || 1)); }

  /* ---------------- the frame ---------------- */
  function frame(t) {
    var E = FX.E, S = FX.S;
    var dt = ui.lastFrame ? Math.min(0.1, (t - ui.lastFrame) / 1000) : 0; ui.lastFrame = t;
    if (S && S.phase === 'play' && ui.speed > 0 && !E.blocked()) {
      var before = Math.floor(S.day);
      E.advance(dt * ui.speed * CFG.daysPerSec * ui.botMult);
      ui.runClock += dt * ui.speed * ui.botMult;
      if (Math.floor(S.day) !== before) ui.dirty = true;
    }
    var held = S && S.phase === 'play' && E.blocked();
    if (held !== ui.held) { ui.held = held; document.querySelector('.t-speed').classList.toggle('held', held); }
    syncModal();
    if (S && S.phase === 'over' && !ui.endShown) showEnd();
    FX.renderStrip(dt);
    if (t - ui.lastChart > 30 || ui.chartDirty) { ui.lastChart = t; ui.chartDirty = false; FX.drawChart(); }
    if (FX.drawCells && t - (ui.lastCells || 0) > 30) { ui.lastCells = t; FX.drawCells(t); }
    if (ui.dirty || t - ui.lastPanels > 250) { ui.lastPanels = t; ui.dirty = false; FX.renderPanels(); }
    tickSlip(t);
    try { var bu = E.busyUseful(); AU.hum(bu.total ? bu.useful / bu.mfu : 0, S.phase === 'play' && ui.speed > 0 && !held && E.activeRuns().length > 0); } catch (e) {}
    requestAnimationFrame(frame);
  }
  FX.frame = frame;

  /* ---------------- the strip: four numbers, each with what changed since the 1st ---------------- */
  function tag(el, text, dir) {
    if (!el) return;
    if (el.__t !== text) { var parts = text.split('|'); el.innerHTML = FX.esc(parts[0]) + (parts.length > 1 ? '<span class="mm"> this month</span>' : ''); el.__t = text; }
    var c = 'tg' + (dir === 'good' ? ' good' : dir === 'bad' ? ' bad' : dir === 'acc' ? ' acc' : '');
    if (el.__c !== c) { el.className = c; el.__c = c; }
  }
  FX.renderStrip = function (dt) {
    var E = FX.E, S = FX.S; if (!S) return;
    var snap = S.snap, mi = E.monthIdx(S.day);
    FX.setText($('t-mo'), 'month ' + (mi + 1) + ' of 12');
    var over = S.phase === 'over';
    FX.setText($('t-date'), over ? 'YEAR OVER' : E.fmtLong(Math.min(S.day, 365)).slice(4));
    // cash ticks live; green when money comes in, red when it goes out
    var target = S.bank;
    if (ui.cashShown == null || FX.reduced()) ui.cashShown = target; else ui.cashShown += (target - ui.cashShown) * Math.min(1, dt * 10);
    if (Math.abs(ui.cashShown - target) < 400) ui.cashShown = target;
    FX.setText($('t-cash'), FX.money(ui.cashShown));
    FX.setClass($('t-cash'), 'neg', S.bank < 0);
    var dBank = S.bank - snap.bank;
    tag($('g-cash'), Math.abs(dBank) < 500 ? 'flat this month' : (dBank > 0 ? '\u25B2 +' : '\u25BC \u2212') + FX.money(Math.abs(dBank)).replace('−', '') + '|', Math.abs(dBank) < 500 ? '' : dBank > 0 ? 'good' : 'bad');
    // months until broke
    var rw = E.runway(), rwEl = $('t-runway');
    if (!isFinite(rw)) { ui.runwayShown = null; FX.setText(rwEl, 'no limit'); tag($('g-runway'), 'income covers spending', 'good'); }
    else {
      if (ui.runwayShown == null || FX.reduced()) ui.runwayShown = rw; else ui.runwayShown += (rw - ui.runwayShown) * Math.min(1, dt * 7);
      if (Math.abs(ui.runwayShown - rw) < 0.04) ui.runwayShown = rw;
      FX.setText(rwEl, FX.fmtRunway(ui.runwayShown));
      var was = snap.runway, wasTxt = isFinite(was) ? Math.floor(was) : 'no limit';
      tag($('g-runway'), (Math.floor(rw) === Math.floor(was) ? '' : (rw > was ? '\u25B2 ' : '\u25BC ') + 'was ' + wasTxt), Math.floor(rw) === Math.floor(was) ? '' : rw > was ? 'good' : 'bad');
    }
    FX.setClass(rwEl, 'bad', isFinite(rw) && rw < 3); FX.setClass(rwEl, 'cau', isFinite(rw) && rw >= 3 && rw < 6);
    // short of GPT-3
    var far = E.farthestClean(), shEl = $('t-short');
    if (!far) { FX.setText(shEl, '—'); tag($('g-short'), 'no model yet', ''); FX.setClass(shEl, 'passed', false); }
    else {
      var sh = CFG.gpt3.C / far;
      if (sh < 1.05) { FX.setText(shEl, 'passed it'); FX.setClass(shEl, 'passed', true); tag($('g-short'), 'GPT-3 is behind you', 'acc'); }
      else {
        FX.setClass(shEl, 'passed', false); FX.setText(shEl, E.shortFmt(sh));
        var was2 = snap.far ? CFG.gpt3.C / snap.far : null;
        if (!was2) tag($('g-short'), 'first model', 'good');
        else if (Math.abs(was2 / sh - 1) < 0.005) tag($('g-short'), '', '');
        else tag($('g-short'), (sh < was2 ? '\u25BC ' : '\u25B2 ') + 'was ' + E.shortFmt(was2), sh < was2 ? 'good' : 'bad');
      }
    }
    // the green number that only climbs
    var lab = E.lab(), dLab = lab - snap.lab;
    FX.setText($('t-lab'), FX.money(lab));
    tag($('g-lab'), (dLab > 0 ? '\u25B2 ' : '') + '+' + FX.money(dLab).replace('+', '') + '|', dLab > 0 ? 'good' : '');
  };

  /* ---------------- the ladder and the four verbs ---------------- */
  function pulseVerb() {
    var E = FX.E, S = FX.S, rb = E.raiseBlock();
    if (rb.ok && (rb.next === 'A' || rb.next === 'B')) return 'raise';
    if (E.runway() < 6 && rb.ok) return 'raise';
    var hire = S.cands.some(function (c) { var left = c.courtBy - S.day; return !E.candReq(c) && !c.courted && (left <= 15 || S.day - c.since <= 5); });
    if (hire) return 'hire';
    var ld = ui.lastDesign, dataWarn = ld && ld.warns.some(function (w) { return w.t.indexOf('Data:') === 0 && w.lvl !== 'note'; });
    if (dataWarn && !S.filterJob && E.staff().some(function (p) { return p.role === 'data'; })) return 'data';
    var anyFree = 0; FX.CFG.pools.forEach(function (p) { anyFree += E.poolFree(p); });
    if (!anyFree && E.runway() > 12 && !S.mer && E.rentCap() - E.rentedCount() >= 8) return 'rent';
    return '';
  }
  FX.pulseVerb = pulseVerb;
  FX.renderLadder = function () {
    var E = FX.E, S = FX.S; if (!S) return;
    var L = E.ladder(), h = '', lit = L.rungs[L.lit];
    L.rungs.forEach(function (r, i) {
      var cls = r.done ? 'done' : i === L.lit ? 'lit' : 'dim';
      if (i === L.lit) {
        var disabled = r.disabled;
        h += '<button type="button" class="rung lit' + (ui.introPulse && r.id === 'start' ? ' pulse' : '') + '" data-act="rung" data-r="' + r.id + '" data-k="rung-' + r.id + '"' + (disabled ? ' aria-disabled="true"' : '') + '><span class="rn">' + (i + 1) + '</span><span class="rl">' + FX.esc(r.label) + '</span><i class="arr" aria-hidden="true"></i></button>';
      } else h += '<span class="rung ' + cls + '" data-k="rung-' + r.id + '"><span class="rn">' + (r.done ? '✓' : (i + 1)) + '</span><span class="rl">' + FX.esc(r.label) + '</span></span>';
    });
    FX.setHTML($('ld-rungs'), h);
    var fill = $('ld-fill'), p = lit ? (lit.prog || 0) : 1, ps = (p * 100).toFixed(1) + '%';
    if (fill.__w !== ps) { fill.style.width = ps; fill.__w = ps; }
    var sub = lit ? (lit.left || '') : 'every rung climbed';
    var fg = E.forgotten(), chip = '';
    if (S.phase === 'play') chip = '<span class="chip ' + (fg.left < 21 ? 'bad' : fg.left < 45 ? 'cau' : '') + '"><button type="button" class="lnk-p" data-act="forgdet" aria-expanded="' + !!ui.forgDet + '" data-k="forg">forgotten in ' + Math.max(0, Math.ceil(fg.left)) + ' days</button></span>';
    FX.setHTML($('ld-sub'), '<span class="sb">' + FX.esc(sub) + '</span>' + chip);
    var rb = E.raiseBlock();
    var fgd = ui.forgDet && S.phase === 'play' ? 'The world forgets you in ' + Math.max(0, Math.ceil(fg.left)) + ' days unless you publish or ship a model of at least ' + sci(fg.need) + ' (about ' + (fg.days ? (fg.days < 1 ? 'a day' : Math.round(fg.days) + ' days') : 'some days') + ' of your cluster). A hundredth of the biggest result anyone has published (' + sci(E.frontier()) + ').' : '';
    var why = $('ld-why'), litRaise = lit && (lit.id === 'seriesA' || lit.id === 'seriesB');
    var whyTxt = fgd;
    if (whyTxt) { why.hidden = false; FX.setText(why, whyTxt); } else why.hidden = true;
  };

  /* ---------------- floating costs: every spend floats off the pressed button ---------------- */
  FX.float = function (text, cls, el) {
    var host = $('floats'); if (!host || !el) return;
    var r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
    var f = document.createElement('span'); f.className = 'float ' + cls; f.textContent = text;
    var x = clamp(r.left + r.width / 2, 40, window.innerWidth - 40); f.style.left = x + 'px'; f.style.top = Math.max(60, r.top) + 'px';
    host.appendChild(f); setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 1300);
  };
  // run an engine action and float what it cost (or brought in) off the pressed control
  FX.doAct = function (name, payload, el) {
    var E = FX.E, S = FX.S;
    var b0 = S.bank, burn0 = E.burn(), rw0 = E.runway();
    var r = E.act(name, payload);
    if (r && r.ok && el) {
      var monthly = (name === 'hire' || name === 'rent' || name === 'raisePay'), dB = S.bank - b0, dBurn = E.burn() - burn0;
      if (monthly && Math.abs(dBurn) > 1) FX.float((dBurn > 0 ? '−' : '+') + FX.money(Math.abs(dBurn)).replace('−', '') + '/mo', dBurn > 0 ? 'out' : 'in', el);
      else if (Math.abs(dB) > 1) FX.float((dB > 0 ? '+' : '−') + FX.money(Math.abs(dB)).replace('−', ''), dB > 0 ? 'in' : 'out', el);
      if (name === 'hire') AU.tick(true);
    }
    ui.dirty = true;
    return r;
  };

  /* ---------------- the monthly slip: three lines over the curve, then it settles into the ledger ---------------- */
  function tickSlip(t) {
    var S = FX.S, el = $('slip'); if (!S) return;
    var sl = S.slips[S.slips.length - 1];
    if (ui.newSlip && sl && !ui.slipShown) {
      ui.slipShown = true;
      var h = '<div class="sl-h"><b>' + FX.esc(sl.label) + ' 1</b><span>monthly slip</span></div>';
      sl.lines.forEach(function (l) { h += '<div class="sl-l ' + l.k + ' ' + (l.tone || '') + '"><i></i><span>' + FX.esc(l.t) + '</span></div>'; });
      el.innerHTML = h; el.hidden = false; el.className = 'slip on';
      FX.renderLedger(); var dn = $('t-new'); if (dn) dn.hidden = false;
    }
    if (ui.newSlip && ui.slipShown && performance.now() > ui.slipUntil) { ui.newSlip = false; el.className = 'slip off'; setTimeout(function () { if (!ui.newSlip) el.hidden = true; }, 520); }
  }
  FX.renderLedger = function () {
    var S = FX.S, h = '';
    if (!S.slips.length) h = '<div class="lg-e">The first slip arrives on 1 Feb, after the first payroll.</div>';
    S.slips.slice().reverse().forEach(function (s) {
      h += '<div class="lg-s"><b>' + FX.esc(s.label) + ' 1</b>' + s.lines.map(function (l) { return '<div class="lg-l ' + l.k + ' ' + (l.tone || '') + '">' + FX.esc(l.t) + '</div>'; }).join('') + '</div>';
    });
    FX.setHTML($('ledger-b'), h);
  };

  /* ---------------- decisions (they pause the game) ---------------- */
  function syncModal() {
    var E = FX.E, S = FX.S, m = $('modal');
    if (!S || S.phase !== 'play' || !S.inbox.length) { if (!m.hidden) { m.hidden = true; ui.modalId = null; } return; }
    var d = S.inbox[0];
    if (ui.modalId === d.id && !m.hidden) return;
    ui.modalId = d.id;
    FX.setText($('m-from'), d.from || (d.kind === 'landing' ? 'TRAINING' : d.kind === 'scandal' ? 'THE PRESS' : 'FRONTIER'));
    FX.setText($('m-title'), d.title);
    FX.setText($('m-body'), d.body);
    FX.setText($('m-note'), d.note || '');
    var ms = $('m-sample'), mp = $('m-plaque');
    var run = d.runId ? E.runById(d.runId) : null;
    if (d.kind === 'landing' && run) { mp.innerHTML = FX.plaqueHTML(run, true); mp.hidden = false; } else { mp.innerHTML = ''; mp.hidden = true; }
    if (d.kind === 'landing' && S.lastSample && S.lastSample.run === d.runId) { ms.innerHTML = FX.sampleHTML(S.lastSample.text); ms.className = 'm-sample' + (S.lastSample.amt === E.CRAWL ? ' crawl' : ''); }
    else { ms.innerHTML = ''; ms.className = 'm-sample'; }
    var h = '';
    d.options.forEach(function (o, i) {
      h += '<button type="button" class="opt-btn' + (i === 0 && !o.disabled ? ' primary' : '') + '" data-act="answer" data-id="' + d.id + '" data-choice="' + o.key + '"' + (o.disabled ? ' disabled' : '') + '><b>' + FX.esc(o.label) + '</b><span' + (o.disabled ? ' class="no"' : '') + '>' + FX.esc(o.disabled ? (o.why || o.detail) : o.detail) + '</span></button>';
    });
    $('m-opts').innerHTML = h;
    m.hidden = false;
    var first = m.querySelector('.opt-btn:not(:disabled)'); if (first) { try { first.focus({ preventScroll: true }); } catch (e) {} }
    m.querySelector('.sheet').scrollTop = 0;
  }
  function showEnd() {
    var E = FX.E, S = FX.S;
    ui.endShown = true; ui.endClosed = false;
    var e = S.end, el = $('end');
    el.className = 'modal end ' + e.kind;
    FX.setText($('e-date'), E.fmtLong(Math.min(365, e.day)));
    FX.setText($('e-title'), e.title);
    FX.setText($('e-reason'), e.reason);
    FX.setText($('e-gap'), e.gap);
    var sc = e.score;
    $('e-score').innerHTML = '<span>Best model: ' + FX.esc(sc.best) + '</span><span class="r">' + sc.model + '</span><span>Trust ' + Math.round(S.rep) + ' x' + CFG.score.repMult + '</span><span class="r">' + sc.rep + '</span><span>API revenue ' + FX.money(S.stats.apiRevenue) + '</span><span class="r">' + sc.revenue + '</span><span>People kept: ' + E.staff().length + '</span><span class="r">' + sc.people + '</span>' +
      '<span class="tot">' + (e.kind === 'survived' ? 'Score' : 'Score (did not survive: shown for reference)') + '</span><span class="r tot">' + sc.total + (sc.miracle ? ' · MIRACLE' : '') + '</span>';
    el.hidden = false; $('modal').hidden = true; root.classList.add('over');
    var b = el.querySelector('.opt-btn'); if (b) try { b.focus({ preventScroll: true }); } catch (x) {}
    FX.store('frontier-a-last', JSON.stringify({ kind: e.kind, score: sc.total }));
  }

  /* ---------------- input ---------------- */
  function gesture() { AU.unlock(); }
  root.addEventListener('pointerdown', gesture, { passive: true });
  root.addEventListener('keydown', gesture);
  root.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null; if (!t || !root.contains(t)) return;
    var a = t.getAttribute('data-act'); if (t.disabled) return;
    FX.handle(a, t, e);
  });
  FX.syncMute = function () { var m = $('mute'); FX.setText($('mute-tx'), AU.muted ? 'SOUND OFF' : 'SOUND ON'); m.setAttribute('aria-pressed', String(AU.muted)); m.setAttribute('aria-label', AU.muted ? 'Sound is off. Press to unmute (M)' : 'Sound is on. Press to mute (M)'); };
  FX.togglePause = togglePause;

  document.addEventListener('keydown', function (e) {
    var E = FX.E, S = FX.S; if (!S) return;
    var tag = e.target && e.target.tagName, inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT', onBtn = tag === 'BUTTON';
    if (e.key === 'Escape') { if (!$('card').hidden) { $('card').hidden = true; return; } if (ui.ledgerOpen) { FX.toggleLedger(false); return; } }
    if (e.key === ' ' || e.code === 'Space') { if (onBtn || (inField && e.target.type !== 'range')) return; e.preventDefault(); togglePause(); return; }
    if (inField && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'm' || e.key === 'M') { AU.setMuted(!AU.muted); FX.syncMute(); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(2);
    else if ((e.key === 's' || e.key === 'S') && S.phase === 'play') { var r = E.act('sample', {}); if (r.ok) FX.wordTicks(r.sample.text); ui.dirty = true; }
  });
  document.addEventListener('visibilitychange', function () { AU.suspend(document.hidden); if (document.hidden) { ui.lastFrame = 0; } });
  window.addEventListener('resize', function () { ui.dirty = true; ui.chartDirty = true; });
  window.addEventListener('orientationchange', function () { ui.dirty = true; ui.chartDirty = true; });
  FX.wordTicks = function (text) { var n = Math.min(24, FX.plainText(text).split(' ').length); for (var i = 0; i < n; i++) setTimeout(AU.word, i * 45); };
  FX.toggleLedger = function (on) {
    ui.ledgerOpen = on == null ? !ui.ledgerOpen : !!on;
    $('ledger').hidden = !ui.ledgerOpen; $('t-month').setAttribute('aria-expanded', String(ui.ledgerOpen));
    if (ui.ledgerOpen) { FX.renderLedger(); $('t-new').hidden = true; }
  };

  FX.start = function () {
    FX.syncMute();
    FX.newGame(seedFromHash());
    requestAnimationFrame(frame);
  };
})();
