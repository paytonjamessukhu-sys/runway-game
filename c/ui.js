/* FRONTIER control room UI. Reads the engine's state, draws the panels and the hero chart, and turns clicks and taps
   into engine actions. Nothing here decides the rules. */
(function () {
  'use strict';
  var CFG = window.FRONTIER_CFG, WORLD = window.FRONTIER_WORLD, AUD = window.FrontierAudio;
  var $ = function (id) { return document.getElementById(id); };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function log10(x) { return Math.log(x) / Math.LN10; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  var tokens = (function () { var cs = getComputedStyle(document.documentElement), o = {}; ['bg', 'panel', 'panel-2', 'line', 'line-2', 'text', 'muted', 'dim', 'accent', 'danger', 'rival-a', 'rival-b', 'rival-c', 'white'].forEach(function (k) { o[k] = (cs.getPropertyValue('--' + k) || '').trim() || '#888888'; }); return o; })();
  function rgba(hex, a) { var h = hex.replace('#', ''); if (h.length !== 6) return hex; return 'rgba(' + parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16) + ',' + a + ')'; }

  var G, S, F, ui, botSpeed = 1;
  function seedFromHash() { var m = /seed=(\d+)/.exec(location.hash || ''); return m ? +m[1] : null; }

  function boot(seed) {
    G = window.FrontierEngine.create({ seed: seed });
    S = G.S; F = G.fmt;
    ui = { params: CFG.starter.N, tokens: CFG.starter.D, recipe: true, pool: 'office', gpus: 8, gpusTouched: false, poolTouched: false,
      html: {}, modalId: null, modalShown: 0, stopArm: null, words: null, cashHist: [S.bank], newsLog: [], lastPanels: 0, lastTop: 0, lastChart: 0,
      holdUntil: 0, pointerDown: false, open: { 'p-train': true }, endShown: false, lastLoad: 0, chartDirty: true, wordsSample: null, lastDay: 0 };
    G.on(onEvent);
    $('end').hidden = true; $('end').innerHTML = '';
    $('model-text').textContent = 'Nothing yet. Launch a run and the model starts talking: static first, then words, then sentences.';
    $('model-text').className = 'model-text empty';
    $('model-meta').innerHTML = '<span class="mm-who">THE MODEL</span><span>no checkpoints yet</span>';
    syncDesignerInputs();
    renderAll(true);
  }

  /* ---------------- engine events: sound, flashes, words ---------------- */
  function onEvent(ev) {
    ui.chartDirty = true;
    switch (ev.type) {
      case 'decision': AUD.knock(); AUD.vibrate(12); break;
      case 'payday': AUD.payday(); flash('kpi-runway', false); flashCash(); break;
      case 'hang': AUD.hang(); AUD.vibrate([30, 40, 30]); break;
      case 'nan': AUD.hang(); break;
      case 'hangEnd': AUD.restart(); break;
      case 'launch': AUD.launch(); break;
      case 'land': AUD.land(ev.run.clean); break;
      case 'sample': streamSample(ev.sample); break;
      case 'news': ui.newsLog.unshift({ day: S.day, news: ev.news }); AUD.tick(true); break;
      case 'publish': case 'ship': AUD.tick(true); break;
      case 'end': AUD[ev.over.kind === 'survived' ? 'land' : 'bad'](true); break;
      case 'day': if (S.api) AUD.revenue(); if (S.day - ui.lastDay >= 1) { ui.lastDay = S.day; ui.cashHist.push(S.bank); if (ui.cashHist.length > 400) ui.cashHist.shift(); } break;
    }
  }
  function flash(id, good) { var el = $(id); if (!el || reduced()) return; el.classList.remove('flash', 'flash-good'); void el.offsetWidth; el.classList.add(good ? 'flash-good' : 'flash'); }
  function flashCash() { var el = $('k-cash'); if (el && el.parentNode) { el.parentNode.id = el.parentNode.id || 'kpi-cash'; flash(el.parentNode.id, false); } }

  /* ---------------- the model's voice: words stream in ---------------- */
  function streamSample(smp) {
    var el = $('model-text'), meta = $('model-meta');
    var where = smp.kind === 'land' ? 'landing' : 'checkpoint ' + (smp.s < 0.01 ? (smp.s * 100).toFixed(2) : Math.round(smp.s * 100)) + '%';
    meta.innerHTML = '<span class="mm-who">THE MODEL &middot; RUN ' + smp.runId + '</span><span class="num">' + esc(where) + ' &middot; ' + smp.loss.toFixed(2) + ' nats &middot; ' + esc(F.size(smp.tokens)) + ' tokens read</span>';
    el.className = 'model-text' + (smp.cap === 'code' ? ' code' : '');
    el.textContent = '';
    var frag = document.createDocumentFragment(), spans = [];
    smp.text.split('\n').forEach(function (line, li) {
      if (li) frag.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (w, i) { if (i) frag.appendChild(document.createTextNode(' ')); var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; frag.appendChild(sp); spans.push(sp); });
    });
    el.appendChild(frag);
    if (reduced()) { spans.forEach(function (s) { s.classList.add('in'); }); ui.words = null; return; }
    ui.words = { spans: spans, t0: nowMs(), shown: 0 };
  }
  function pumpWords() {
    var w = ui.words; if (!w) return;
    var n = Math.min(w.spans.length, Math.floor((nowMs() - w.t0) / 45) + 1);
    while (w.shown < n) { w.spans[w.shown].classList.add('in'); w.shown++; AUD.word(); }
    if (w.shown >= w.spans.length) ui.words = null;
  }

  /* ---------------- top bar ---------------- */
  function setText(id, t) { var el = $(id); if (el && el.textContent !== t) el.textContent = t; }
  function setHTML(id, h) { if (ui.html[id] === h) return false; ui.html[id] = h; var el = $(id); if (el) el.innerHTML = h; return true; }
  function renderTop() {
    var dv = G.derived();
    setText('t-date', F.date(Math.min(S.day, 365), true));
    var st = $('t-state'), stTxt, stCls;
    if (S.over) { stTxt = 'YEAR OVER'; stCls = 'clockstate wait'; }
    else if (S.pending) { stTxt = 'WAITING FOR YOU'; stCls = 'clockstate wait'; }
    else if (!S.started) { stTxt = 'NOT STARTED'; stCls = 'clockstate'; }
    else if (S.paused) { stTxt = 'PAUSED'; stCls = 'clockstate'; }
    else { stTxt = (S.active.some(function (r) { return r.hang; }) ? 'HUNG ' : 'LIVE ') + S.speed + '×'; stCls = 'clockstate run'; }
    if (st.textContent !== stTxt) st.textContent = stTxt; if (st.className !== stCls) st.className = stCls;
    var live = S.started && !S.paused && !S.over;
    $('t-pause').classList.toggle('on', !live);
    Array.prototype.forEach.call(document.querySelectorAll('.tb.sp'), function (b) { b.classList.toggle('on', live && +b.getAttribute('data-speed') === S.speed); });
    $('t-mute').classList.toggle('muted', AUD.muted);
    $('t-mute').setAttribute('aria-label', AUD.muted ? 'Sound is off. Press to unmute (M)' : 'Sound is on. Press to mute (M)');
    setText('k-cash', F.money(S.bank));
    setHTML('k-burn', esc(F.money(dv.burn)) + '<small>/mo</small>');
    setHTML('k-runway', (isFinite(dv.runway) ? esc(F.months(dv.runway)) : '&infin;') + '<small>mo</small>');
    $('kpi-runway').classList.toggle('bad', dv.runway < 6);
    setText('k-rep', String(Math.round(S.rep)));
    setHTML('k-pf', esc(dv.pfPerDay >= 10 ? dv.pfPerDay.toFixed(0) : dv.pfPerDay.toFixed(2)) + '<small>PF-d/d</small>');
    var b = dv.best;
    setHTML('g-best', b ? 'best <em>' + esc(F.sci(b.C)) + '</em> · ' + (S.miracle ? '<em class="acc">matched GPT-3</em>' : b.C >= CFG.gpt3C ? 'past GPT-3' : esc(ratio(CFG.gpt3C / b.C)) + '× short') : 'best: no clean dot yet');
    var rl = Math.max(0, Math.ceil(S.relevance.deadline - S.day));
    var gf = $('g-forgot');
    setHTML('g-forgot', 'forgotten in <em>' + rl + 'd</em><span class="long"> unless you publish ≥ ' + esc(F.sci(dv.relevantNeed)) + '</span>');
    gf.classList.toggle('bad', rl <= 30);
    var gs = $('g-stake');
    setHTML('g-stake', 'stake <em>' + esc(F.pct(S.stake)) + '</em><span class="long"> · board sells below 50%</span>');
    gs.classList.toggle('bad', S.stake < 0.55);
    // jump buttons light up where something needs you
    var jl = { 'p-money': dv.runway < 6, 'p-rivals': rl <= 30, 'p-team': S.active.some(function (r) { return r.hang && !r.hang.infra; }), 'p-train': S.active.some(function (r) { return r.hang && !r.hang.infra; }) };
    Array.prototype.forEach.call(document.querySelectorAll('.jump button'), function (bt) { bt.classList.toggle('alert', !!jl[bt.getAttribute('data-jump')]); });
  }
  function ratio(x) { return x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? String(Math.round(x)) : x.toFixed(1); }

  /* ---------------- training: run bar ---------------- */
  function runRow(r, dv) {
    var h = '', s = r.done / r.C, left = runLeft(r), land = S.day + left;
    var pool = dv.pools.filter(function (p) { return p.key === r.pool; })[0], cardsNow = Math.min(r.cards, pool.count);
    var ticks = r.cks.map(function (c) { return c.s >= 0.05 ? '<b style="left:' + (c.s * 100).toFixed(1) + '%"></b>' : ''; }).join('');
    h += '<div class="rrow' + (r.hang ? ' hung' : '') + '">';
    if (r.hang) {
      if (r.hang.nan) h += '<div class="rb-top"><span class="rb-title bad-t">RUN ' + r.id + ' WENT NaN AT ' + esc(r.hang.label.replace(' NaN', '')) + '</span><span class="rb-sub">rolled back ' + r.hang.lost.toFixed(1) + ' days</span></div><div class="prog"><i style="width:' + (s * 100).toFixed(2) + '%"></i>' + ticks + '</div><div class="rb-sub">The loss blew up. It restarts from its last checkpoint' + (has('tom') || has('kofi') ? ' (4-hourly, thanks to infra).' : ' (daily: nobody on infra).') + '</div>';
      else h += '<div class="rb-top"><span class="rb-title bad-t">RUN ' + r.id + ' HUNG AT ' + esc(r.hang.label) + '</span><span class="rb-sub">' + (r.hang.infra ? 'restarting itself' : 'dark until someone wakes up') + '</span></div>';
      if (!r.hang.nan) h += '<div class="prog"><i style="width:' + (s * 100).toFixed(2) + '%"></i>' + ticks + '</div>';
      if (!r.hang.nan) h += '<div class="rb-sub">' + (r.hang.infra ? 'Infra restarts it within an hour from a 4-hourly checkpoint.' : 'Nobody on call: it rewinds to the last daily checkpoint and sits dark until morning. Wake someone to restart it in 20 minutes (it costs them morale).') + '</div>';
    } else {
      h += '<div class="rb-top"><span class="rb-title">RUN ' + r.id + ' · ' + esc(F.size(r.N)) + ' × ' + esc(F.size(r.D)) + ' · ' + esc(F.sci(r.C)) + '</span><span class="rb-sub num">' + (s * 100).toFixed(1) + '% · lands ' + esc(isFinite(left) ? F.date(land) : '—') + '</span></div>';
      h += '<div class="prog" role="progressbar" aria-label="Run ' + r.id + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(s * 100) + '"><i style="width:' + (s * 100).toFixed(2) + '%"></i>' + ticks + '</div>';
      h += '<div class="rb-line"><div class="rb-sub">' + (cardsNow < r.cards ? '<span class="bad-t">' + cardsNow + ' of ' + r.cards + ' cards</span>' : cardsNow + ' ' + (r.pool === 'a100' ? 'A100' : 'V100') + 's') + ' · ' + esc(G.poolName[r.pool]) + ' · ' + (isFinite(left) ? left.toFixed(left < 10 ? 1 : 0) + ' days left' : 'starved: no cards') + (r.hangs ? ' · ' + F.plural(r.hangs, 'hang') : '') + (land >= CFG.endDay ? ' · <span class="bad-t">won’t land by 31 DEC</span>' : '') + '</div>';
    }
    var armed = ui.stopArm && ui.stopArm.id === r.id && nowMs() - ui.stopArm.t < 3000;
    if (r.hang) h += '<div class="rb-line"><div class="rb-sub"></div>';
    h += '<div class="rb-acts"><button type="button" class="btn sm" data-act="sample" data-id="' + r.id + '">Read a checkpoint' + (r === S.run ? ' <span class="dim">(S)</span>' : '') + '</button><button type="button" class="btn sm' + (armed ? ' danger' : '') + '" data-act="stop" data-id="' + r.id + '">' + (armed ? 'Tap again to stop it' : 'Stop') + '</button></div></div>';
    h += '</div>';
    return h;
  }
  function runLeft(r) {
    var p = G.derived().pools.filter(function (x) { return x.key === r.pool; })[0];
    var rate = Math.min(r.cards, p.count) * (r.pool === 'a100' ? CFG.flops.a100 : CFG.flops.v100);
    return rate > 0 ? (r.C - r.done) / rate + (r.hang ? Math.max(0, r.hang.until - S.day) : 0) : Infinity;
  }
  function renderRunbar() {
    var dv = G.derived(), h = '', act = S.active.slice().sort(function (a, b) { return b.C - a.C; });
    var rb = $('runbar'), hung = act.filter(function (r) { return r.hang && !r.hang.infra; });
    rb.classList.toggle('hung', hung.length > 0);
    if (hung.length) h += '<div class="rb-acts wake">' + G.staff().map(function (p) { return '<button type="button" class="btn sm danger" data-act="wake" data-id="' + p.key + '">Wake ' + esc(p.first) + '</button>'; }).join('') + '</div>';
    act.forEach(function (r) { h += runRow(r, dv); });
    if (!act.length) {
      var last = S.runs[S.runs.length - 1];
      h += '<div class="rb-top"><span class="rb-title">NO RUN TRAINING</span><span class="rb-sub">' + (S.runs.length ? F.plural(S.runs.length, 'run') + ' so far' : 'cards idle') + '</span></div>';
      if (last) h += '<div class="rb-sub">Last: run ' + last.id + (last.aborted ? ' stopped' : last.clean ? ' landed at ' + F.sci(last.C) + ', ' + last.L.toFixed(3) + ' nats' + (last.published ? ', published' : last.shipped ? ', shipped' : last.redteaming ? ', with Lena' : last.pendingPublic ? ', with Meridian' : ', private') : ' ran past the data wall') + '. Idle cards earn nothing: design the next run.</div>';
      else h += '<div class="rb-sub">Your cards are idle. ' + (S.started ? 'Design a run and launch it.' : 'Priya loaded a small starter run below: press Launch.') + '</div>';
    } else {
      var free = dv.pools.filter(function (p) { return p.count > 0 && !S.active.some(function (r) { return r.pool === p.key; }); });
      if (free.length) h += '<div class="rb-sub">Free: ' + free.map(function (p) { return p.count + ' in ' + p.name; }).join(', ') + '. One run per pool: launch another below.</div>';
    }
    setHTML('runbar', h);
    var m = S.run;
    var ps = m ? (hung.length ? '<span class="bad">run ' + hung[0].id + ' hung</span>' : (act.length > 1 ? act.length + ' runs · ' : '') + 'run ' + m.id + ' ' + Math.round(100 * m.done / m.C) + '% · lands ' + F.date(S.day + runLeft(m))) : (S.runs.length ? 'idle · ' + F.plural(S.runs.length, 'run') : 'idle');
    setHTML('s-train', ps);
  }

  /* ---------------- training: the designer ---------------- */
  var LOGN = [log10(CFG.paramsMin), log10(CFG.paramsMax)], LOGD = [log10(CFG.tokensMin), log10(CFG.tokensMax)];
  function toSlider(v, lg) { return Math.round((log10(v) - lg[0]) / (lg[1] - lg[0]) * 1000); }
  function fromSlider(x, lg) { return Math.pow(10, lg[0] + (x / 1000) * (lg[1] - lg[0])); }
  function niceN(N) { var e = Math.floor(log10(N)), m = N / Math.pow(10, e); var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]; var best = 1; steps.forEach(function (s) { if (Math.abs(log10(s / m)) < Math.abs(log10(best / m))) best = s; }); return best * Math.pow(10, e); }
  function syncDesignerInputs() {
    if (ui.recipe) ui.tokens = G.recipeTokens(ui.params);
    $('d-params').value = toSlider(ui.params, LOGN);
    $('d-tokens').value = toSlider(ui.tokens, LOGD);
    $('d-recipe').checked = ui.recipe;
  }
  function currentDesign() {
    var dv = G.derived();
    var pools = dv.pools;
    // follow the biggest pool until the player picks one
    var busy = function (k) { return S.active.some(function (r) { return r.pool === k; }); };
    if (!ui.poolTouched || busy(ui.pool) || !pools.some(function (p) { return p.key === ui.pool && p.count > 0; })) {
      var best = pools.filter(function (p) { return !busy(p.key) && p.count > 0; }).sort(function (a, b) { return b.flops - a.flops; })[0];
      if (best) ui.pool = best.key;
      if (busy(ui.pool)) ui.poolTouched = false;
    }
    var avail = pools.filter(function (p) { return p.key === ui.pool; })[0].count;
    if (!ui.gpusTouched || ui.gpus > avail) ui.gpus = avail;
    return G.design({ params: ui.params, tokens: ui.recipe ? G.recipeTokens(ui.params) : ui.tokens, pool: ui.pool, gpus: ui.gpus });
  }
  function daysWord(d) { if (!isFinite(d)) return '—'; if (d < 1) return (d * 24).toFixed(d * 24 < 10 ? 1 : 0) + ' h'; return d.toFixed(d < 10 ? 1 : 0) + ' d'; }
  function renderDesigner() {
    var d = currentDesign(), dv = G.derived();
    setText('d-params-v', F.size(d.N) + ' params');
    setText('d-tokens-v', F.size(d.D) + ' tokens' + (ui.recipe ? '' : ' · recipe ' + F.size(d.recipeD)));
    // pools as chips
    var chips = dv.pools.map(function (p) {
      var rb = S.active.filter(function (r) { return r.pool === p.key; })[0];
      return '<button type="button" class="chip' + (p.key === ui.pool && !rb ? ' on' : '') + '" data-pool="' + p.key + '"' + (p.count > 0 && !rb ? '' : ' disabled') + ' aria-pressed="' + (p.key === ui.pool) + '">' + esc(p.name) + ' <span class="num">' + (rb ? 'run ' + rb.id : p.count) + '</span></button>';
    }).join('');
    setHTML('d-pools', chips);
    var g = $('d-gpus'), avail = d.avail;
    var step = avail >= 16 ? 8 : 1;
    if (+g.max !== Math.max(1, avail)) g.max = Math.max(1, avail);
    if (+g.min !== Math.min(step, Math.max(1, avail))) g.min = Math.min(step, Math.max(1, avail));
    if (+g.step !== step) g.step = step;
    if (document.activeElement !== g || !ui.pointerDown) g.value = d.cards;
    g.disabled = avail <= 1 || !!S.flags.fullCluster;
    setText('d-gpus-v', d.cards + ' ' + (d.pool === 'a100' ? 'A100' : 'V100') + (d.cards === 1 ? '' : 's') + ' of ' + avail);
    var vsLine = (d.L / d.line - 1) * 100;
    var read =
      '<div class="rd"><span class="k">Compute 6ND</span><span class="v">' + esc(F.sci(d.C)) + '</span><span class="s">FLOPs · ' + (d.C / CFG.pfDay).toFixed(d.C / CFG.pfDay < 10 ? 2 : 0) + ' PF-days</span></div>' +
      '<div class="rd"><span class="k">Train time</span><span class="v">' + daysWord(d.days) + '</span><span class="s">' + (isFinite(d.days) ? (d.landDay >= CFG.endDay ? 'after 31 DEC' : 'lands ' + esc(F.date(d.landDay))) : 'no cards') + '</span></div>' +
      '<div class="rd"><span class="k">Projected loss</span><span class="v">' + d.L.toFixed(3) + '</span><span class="s">' + (Math.abs(vsLine) < 0.05 ? 'on the line' : (vsLine > 0 ? '+' : '') + vsLine.toFixed(1) + '% vs line') + (d.sigUp > 0.003 ? ' · risk +' + (d.sigUp * 200).toFixed(1) + '%' : '') + '</span></div>' +
      '<div class="rd"><span class="k">Cost · runway</span><span class="v">' + esc(F.money(d.cost)) + '</span><span class="s">' + (isFinite(d.runwayAtLand) ? F.months(d.runwayAtLand) + ' mo left at landing' : 'card time') + '</span></div>';
    setHTML('d-read', read);
    var w = d.warn.slice();
    if (!w.length && !d.block) w.push({ bad: false, ok: true, t: 'Fits in memory, clean data, inside the measured horizon.' });
    setHTML('d-warn', w.map(function (x) { return '<li class="' + (x.bad ? 'bad' : x.ok ? 'ok' : '') + '">' + esc(x.t) + '</li>'; }).join(''));
    var btn = $('d-launch'), note = '';
    var can = !d.block && !S.over && !S.pending;
    btn.disabled = !can;
    if (d.block && S.active.some(function (r) { return r.pool === d.pool; })) note = d.block + ' Pick another pool or wait for it to land.';
    else if (d.block) note = d.block === 'Memory limit' ? 'Too big for memory: shrink the model.' : d.block;
    else if (!S.runs.length) note = 'Priya’s starter run: small, quick, and it shows where we sit on the line.';
    else note = 'Lands ' + F.date(d.landDay) + (d.r > 1 ? ' · past the wall' : '') + '.';
    setText('d-note', note);
    btn.classList.toggle('pulse', can && !S.runs.length && !S.active.length);
    ui.design = d;
  }

  /* ---------------- the hero chart ---------------- */
  function sizeCanvas(cv) {
    var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }
  function drawChart(cv, opts) {
    opts = opts || {};
    var sz = sizeCanvas(cv); if (sz.w < 20 || sz.h < 20) return;
    var ctx = cv.getContext('2d'); ctx.setTransform(sz.dpr, 0, 0, sz.dpr, 0, 0);
    var W = sz.w, H = sz.h, phone = W < 520;
    var padL = phone ? 30 : 38, padR = 10, padT = 22, padB = phone ? 18 : 20;
    var xMin = CFG.chart.xMin, xMax = CFG.chart.xMax, yMin = CFG.chart.yMin, yMax = CFG.chart.yMax;
    function X(C) { return padL + (log10(C) - xMin) / (xMax - xMin) * (W - padL - padR); }
    function Y(L) { return padT + (Math.log(yMax) - Math.log(L)) / (Math.log(yMax) - Math.log(yMin)) * (H - padT - padB); }
    ctx.clearRect(0, 0, W, H);
    var mono = (phone ? '9.5px ' : '10.5px ') + '"IBM Plex Mono", ui-monospace, Menlo, monospace';
    ctx.font = mono; ctx.textBaseline = 'middle';
    // labels are placed last, in priority order, never on top of each other or of the points that matter
    var placed = [], labels = [];
    function block(x, y, r) { placed.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r }); }
    function want(text, x, y, color, pri, cands) { labels.push({ t: text, x: x, y: y, c: color, p: pri, cands: cands }); }
    function overlaps(a) { for (var i = 0; i < placed.length; i++) { var b = placed[i]; if (a.x < b.x + b.w + 2 && a.x + a.w + 2 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y) return true; } return false; }
    var CANDS = [[9, -9], [9, 9], [-9, -9], [-9, 9], [0, -15], [0, 15], [14, 0], [-14, 0]];
    function placeAll() {
      labels.sort(function (a, b) { return a.p - b.p; });
      labels.forEach(function (l) {
        var w = ctx.measureText(l.t).width, h = 12, cands = l.cands || CANDS;
        for (var i = 0; i < cands.length; i++) {
          var dx = cands[i][0], dy = cands[i][1];
          var left = dx > 0 ? l.x + dx : dx < 0 ? l.x + dx - w : l.x - w / 2, top = l.y + dy - h / 2;
          var r = { x: left, y: top, w: w, h: h };
          if (left < padL + 1 || left + w > W - padR - 1 || top < 2 || top + h > H - padB - 1) continue;
          if (overlaps(r)) continue;
          placed.push(r); ctx.fillStyle = l.c; ctx.textAlign = 'left'; ctx.fillText(l.t, left, top + h / 2); return;
        }
      });
    }
    // grid
    ctx.lineWidth = 1;
    for (var e = xMin; e <= xMax; e++) {
      var x = Math.round(X(Math.pow(10, e))) + 0.5;
      ctx.strokeStyle = rgba(tokens['line-2'], 0.9); ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
      if (!phone || e % 2 === 1) { ctx.fillStyle = tokens.dim; ctx.textAlign = 'center'; ctx.fillText('1e' + e, x, H - padB / 2 + 1); }
    }
    [1.5, 2, 3, 4, 6, 10].forEach(function (L) { var y = Math.round(Y(L)) + 0.5; ctx.strokeStyle = rgba(tokens['line-2'], 0.6); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke(); ctx.fillStyle = tokens.dim; ctx.textAlign = 'right'; ctx.fillText(String(L), padL - 5, y); });
    ctx.textAlign = 'left'; ctx.fillStyle = tokens.muted; ctx.fillText('loss (nats) vs compute (FLOPs)', padL + 4, 10);
    placed.push({ x: padL + 4, y: 4, w: ctx.measureText('loss (nats) vs compute (FLOPs)').width, h: 12 });
    var dv = G.derived();
    // the clean-data wall estimate (in compute, on the recipe)
    var wlo = G.C_of_tokens(S.data.lo), whi = G.C_of_tokens(S.data.hi);
    if (log10(wlo) < xMax) {
      var x0 = X(Math.max(wlo, Math.pow(10, xMin))), x1 = Math.min(X(whi), W - padR);
      ctx.fillStyle = rgba(tokens.danger, 0.08); ctx.fillRect(x0, padT, Math.max(2, x1 - x0), H - padT - padB);
      ctx.strokeStyle = rgba(tokens.danger, 0.5); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, padT); ctx.lineTo(Math.round(x0) + 0.5, H - padB); ctx.stroke(); ctx.setLineDash([]);
      want('data wall?', x0, padT + 8, rgba(tokens.danger, 0.95), 5, [[4, 0], [4, 14], [-4, 0]]);
    }
    // memory limit (on the recipe) without enough systems people
    if (dv.memLimit < CFG.memLimit[2]) {
      var memC = Math.pow(6 * dv.memLimit * CFG.tokGPT3 / Math.pow(CFG.gpt3C, CFG.tokExp), 1 / (1 - CFG.tokExp));
      var mx = Math.round(X(memC)) + 0.5;
      if (mx < W - padR) { ctx.strokeStyle = rgba(tokens.muted, 0.5); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, H - padB); ctx.stroke(); ctx.setLineDash([]); want('memory ' + F.size(dv.memLimit), mx, padT + 8, tokens.muted, 6, [[-4, 0], [-4, 14], [4, 28], [-4, 28]]); }
    }
    // relevance threshold
    var rx = X(dv.relevantNeed);
    if (rx > padL && rx < W - padR) { ctx.strokeStyle = rgba(tokens.white, 0.16); ctx.setLineDash([1, 3]); ctx.beginPath(); ctx.moveTo(Math.round(rx) + 0.5, padT); ctx.lineTo(Math.round(rx) + 0.5, H - padB); ctx.stroke(); ctx.setLineDash([]); if (!phone) want('relevance', rx, H - padB - 8, tokens.dim, 9, [[4, 0], [-4, 0]]); }
    // the scaling law
    var lineKnown = S.day >= CFG.lineDay;
    ctx.strokeStyle = lineKnown ? rgba(tokens.text, 0.55) : rgba(tokens.text, 0.28); ctx.lineWidth = 1.2; ctx.setLineDash(lineKnown ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(X(Math.pow(10, xMin)), Y(G.Lline(Math.pow(10, xMin)))); ctx.lineTo(X(Math.pow(10, xMax)), Y(G.Lline(Math.pow(10, xMax)))); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    want(lineKnown ? (phone ? 'scaling law' : 'scaling law (Kaplan et al., 23 Jan)') : (phone ? 'the line' : 'the line (published 23 Jan)'), X(2e17), Y(G.Lline(2e17)), tokens.muted, 10, [[2, -12], [2, 12]]);
    // rivals
    var rcol = [tokens['rival-a'], tokens['rival-b'], tokens['rival-c']];
    S.rivals.forEach(function (rv, i) {
      var pubs = rv.pubs.filter(function (p) { return p.day <= S.day; }); if (!pubs.length) return;
      ctx.strokeStyle = rgba(rcol[i], 0.45); ctx.setLineDash([2, 3]); ctx.beginPath(); pubs.forEach(function (p, j) { var px = X(p.C), py = Y(p.L); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.setLineDash([]);
      pubs.forEach(function (p, j) { var px = X(p.C), py = Y(p.L); ctx.fillStyle = rcol[i]; marker(ctx, i, px, py, j === pubs.length - 1 ? 3.6 : 2.4); });
      var lp = pubs[pubs.length - 1]; block(X(lp.C), Y(lp.L), 4);
      want(rv.name + (phone ? '' : ' ' + F.size(lp.N)), X(lp.C), Y(lp.L), rcol[i], 7 + i * 0.1);
    });
    // GPT-3
    var gx = X(CFG.gpt3C), gy = Y(CFG.gpt3L), out = S.day >= CFG.gpt3Day;
    ctx.strokeStyle = tokens.white; ctx.lineWidth = 1.5; ctx.setLineDash(out ? [] : [2, 2]); ctx.beginPath(); ctx.arc(gx, gy, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (out) { ctx.fillStyle = tokens.white; ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI * 2); ctx.fill(); }
    block(gx, gy, 8);
    want(out ? 'GPT-3' : 'GPT-3 · 28 May', gx, gy, tokens.white, 1, [[-10, 12], [-10, -12], [10, 12], [10, -12]]);
    // Series A target
    if (!S.raise.aDone) { var aC = Math.max(CFG.seriesA.needC, S.raise.aNeed), ax = X(aC), ay = Y(G.Lline(aC)); ctx.strokeStyle = rgba(tokens.accent, 0.6); ctx.beginPath(); ctx.moveTo(ax, ay - 14); ctx.lineTo(ax, ay - 4); ctx.stroke(); want('Series A', ax, ay - 16, rgba(tokens.accent, 0.9), 4, [[0, -6], [6, -6], [-6, -6], [0, 26]]); }
    // your finished runs
    S.runs.slice(-14).forEach(function (r) {
      if (!r.pts || r.pts.length < 2 || r.aborted) return;
      ctx.strokeStyle = r.clean ? rgba(tokens.accent, 0.2) : rgba(tokens.danger, 0.25); ctx.beginPath();
      r.pts.forEach(function (p, j) { var px = X(p.x), py = Y(clamp(p.y, yMin, yMax)); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
    });
    S.runs.forEach(function (r) {
      if (r.aborted || !r.L) return;
      var px = X(r.C), py = Y(r.L);
      if (!r.clean) { ctx.strokeStyle = tokens.danger; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; return; }
      if (!r.published && !r.shipped) { ctx.strokeStyle = tokens.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
      else { ctx.fillStyle = tokens.accent; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill(); }
      if (r.published) { ctx.strokeStyle = tokens.accent; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.stroke(); }
      if (r.shipped) { ctx.strokeStyle = tokens.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 6, py); ctx.lineTo(px + 12, py); ctx.stroke(); ctx.lineWidth = 1; }
    });
    var best = dv.best;
    if (best) { block(X(best.C), Y(best.L), 7); want('you ' + F.sci(best.C), X(best.C), Y(best.L), tokens.accent, 3); }
    // the live run pours
    S.active.forEach(function (r) { if (!r.pts.length || opts.end) return;
      ctx.strokeStyle = r.hang ? tokens.danger : tokens.accent; ctx.lineWidth = 2; ctx.beginPath();
      r.pts.forEach(function (p, j) { var px = X(p.x), py = Y(clamp(p.y, yMin, yMax)); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); ctx.lineWidth = 1;
      var hp = r.pts[r.pts.length - 1], hx = X(hp.x), hy = Y(clamp(hp.y, yMin, yMax));
      ctx.fillStyle = r.hang ? tokens.danger : tokens.accent; ctx.beginPath(); ctx.arc(hx, hy, 3.5, 0, Math.PI * 2); ctx.fill();
      if (!reduced() && !r.hang) { ctx.strokeStyle = rgba(tokens.accent, 0.35 + 0.25 * Math.sin(nowMs() / 180)); ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.stroke(); }
      block(hx, hy, 6);
      if (r.hang) want(r.hang.nan ? r.hang.label : r.hang.label + (has('tom') ? ' my fault' : ' hung'), hx, hy, tokens.danger, 0);
      if (log10(r.C) > xMin && log10(r.C) < xMax) { var tx0 = X(r.C), ty0 = Y(r.proj); ctx.strokeStyle = rgba(tokens.accent, 0.85); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(tx0, ty0, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); if (r.sigUp > 0.003) { ctx.beginPath(); ctx.moveTo(tx0, ty0 - 6); ctx.lineTo(tx0, Y(r.proj * (1 + 2 * r.sigUp))); ctx.stroke(); } block(tx0, ty0, 7); want('run ' + r.id + ' lands ' + F.date(S.day + runLeft(r)), tx0, ty0, tokens.accent, r === S.run ? 2 : 2.5, [[10, 12], [10, -12], [-10, 12], [-10, -12], [0, 20]]); }
    });
    // where it will land (live run), or where the next one would (designer)
    var tgt = ui.design && !S.over && !opts.end && !ui.design.block ? { C: ui.design.C, L: ui.design.L, sig: ui.design.sigUp, label: 'next run', bad: ui.design.r > 1 } : null;
    if (tgt && log10(tgt.C) > xMin && log10(tgt.C) < xMax) {
      var tx = X(tgt.C), ty = Y(tgt.L), col = tgt.bad ? tokens.danger : tokens.accent;
      ctx.strokeStyle = rgba(col, 0.85); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (tgt.sig > 0.003) { ctx.beginPath(); ctx.moveTo(tx, ty - 6); ctx.lineTo(tx, Y(tgt.L * (1 + 2 * tgt.sig))); ctx.stroke(); }
      block(tx, ty, 7);
      want(tgt.label, tx, ty, col, 3.5, [[10, 12], [10, -12], [-10, 12], [-10, -12], [0, 20]]);
    }
    placeAll();
  }
  function has(k) { return !!G.person(k); }
  function marker(ctx, kind, x, y, s) {
    ctx.beginPath();
    if (kind === 0) ctx.arc(x, y, s, 0, Math.PI * 2);
    else if (kind === 1) ctx.rect(x - s, y - s, 2 * s, 2 * s);
    else { ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x + s * 1.1, y + s * 0.9); ctx.lineTo(x - s * 1.1, y + s * 0.9); ctx.closePath(); }
    ctx.fill();
  }

  /* ---------------- panels ---------------- */
  function lastSay(key) { for (var i = 0; i < S.feed.length; i++) if (S.feed[i].who === key && S.feed[i].kind !== 'leave') return S.feed[i].text; return null; }
  function skillDots(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < n ? '●' : '<i>●</i>'; return '<span class="skill" aria-label="skill ' + n + ' of 5">' + s + '</span>'; }
  function assignment(p) {
    if (p.role === 'data') return S.data.job && S.data.job.who === p.key ? 'filter job · ' + Math.max(0, Math.ceil(S.data.job.end - S.day)) + 'd left' : 'reading samples';
    if (p.role === 'evals') return S.redteam ? 'red-teaming run ' + S.redteam.runId + ' · ' + Math.max(0, Math.ceil(S.redteam.until - S.day)) + 'd' : 'evals';
    if (p.role === 'systems') return 'parallelism · max ' + F.size(G.derived().memLimit) + ' params';
    if (p.role === 'infra') return p.key === 'tom' && S.day < (S.flags.tomOffUntil || 0) ? 'on a week off' : (S.active.some(function (r) { return r.hang; }) ? 'restarting a hung run' : 'on call');
    if (p.role === 'scaling') return 'fitting the line';
    if (p.role === 'optimization') { var d = CFG.optDelay - (S.day - p.joined); return d > 0 ? 'retuning the schedule · ' + Math.ceil(d) + 'd' : 'schedule’s in: −2.5%'; }
    return p.status;
  }
  function renderTeam() {
    var dv = G.derived(), staff = G.staff(), h = '';
    h += '<div class="sec">On the team <span class="r num">payroll ' + esc(F.money(dv.payroll)) + '/mo</span></div>';
    staff.forEach(function (p) {
      var say = lastSay(p.key), mood = Math.round(p.mood);
      h += '<div class="card"><div class="row"><span><span class="nm">' + esc(p.name) + '</span><span class="role">' + esc(p.role) + '</span></span><span class="num small">' + esc(F.money(p.salary)) + '/mo</span></div>';
      h += '<div class="row small"><span class="muted">' + esc(assignment(p)) + '</span>' + skillDots(p.skill) + '</div>';
      h += '<div class="mood"><span>morale</span><div class="bar' + (mood < 30 ? ' bad' : '') + '"><i style="width:' + mood + '%"></i></div><span class="num">' + mood + '</span></div>';
      h += '<div class="eff">' + esc(p.effect) + '</div>';
      if (say) h += '<div class="say">' + esc(say) + '</div>';
      var acts = '';
      if (p.role === 'data' && !S.data.job) { var cf = dv.canFilter; acts += '<button type="button" class="btn sm" data-act="filter"' + (cf.ok ? '' : ' disabled title="' + esc(cf.msg) + '"') + '>Run a filter job · ' + esc(F.money(dv.filterCost)) + ' · ' + dv.filterDays + 'd</button>'; }
      if (S.active.some(function (r) { return r.hang && !r.hang.infra; })) acts += '<button type="button" class="btn sm danger" data-act="wake" data-id="' + p.key + '">Wake ' + esc(p.first) + '</button>';
      if (acts) h += '<div class="acts">' + acts + '</div>';
      h += '</div>';
    });
    h += '<div class="sec">Hiring board <span class="r">' + (S.candidates.length ? F.plural(S.candidates.length, 'candidate') : 'nobody right now') + '</span></div>';
    if (!S.candidates.length) h += '<div class="small dim">Candidates knock on their own: Dev 11 Jan, Ayaan 21 Jan, Tom 11 Feb, Rafael 1 Mar, Lena 11 Mar, Sun-hee after your first paper past 1e21, Ines 11 Jun, Kofi 1 Aug.</div>';
    S.candidates.forEach(function (c) {
      var d = WORLD.people[c.key];
      h += '<div class="card cand"><div class="row"><span><span class="nm">' + esc(d.name) + '</span><span class="role">' + esc(d.role) + '</span></span><span class="num small">asks ' + esc(F.money(c.salary)) + '/mo</span></div>';
      h += '<div class="say">' + esc(d.pitch) + '</div><div class="eff">' + esc(d.effect) + '</div>';
      h += '<div class="row small"><span class="' + (c.until - S.day < 6 ? 'bad-t' : 'muted') + '">on the board until ' + esc(F.date(c.until)) + ', then ' + (c.to === 'halcyon' ? 'Halcyon' : 'Kestrel') + '</span>' + skillDots(d.skill) + '</div>';
      h += '<div class="acts"><button type="button" class="btn sm primary" data-act="hire" data-id="' + c.key + '">Hire ' + esc(d.first) + ' · runway ' + esc(F.months(dv.runway)) + ' → ' + esc(F.months(runwayWith(c.salary))) + ' mo</button></div></div>';
    });
    var gone = S.team.filter(function (p) { return p.gone; });
    if (gone.length) { h += '<div class="sec">Left</div>'; gone.forEach(function (p) { h += '<div class="card gone"><div class="row"><span class="nm">' + esc(p.name) + '</span><span class="small dim">' + esc(F.date(p.goneDay)) + '</span></div><div class="eff">' + esc(p.why) + (p.to ? ' → ' + esc(p.to) : '') + '</div></div>'; }); }
    setHTML('b-team', h);
    var low = staff.slice().sort(function (a, b) { return a.mood - b.mood; })[0];
    setHTML('s-team', F.plural(staff.length, 'person') + ' · ' + F.money(dv.salaries) + '/mo' + (low ? ' · low morale ' + (low.mood < 30 ? '<span class="bad">' + Math.round(low.mood) + '</span>' : Math.round(low.mood)) : '') + (S.candidates.length ? ' · ' + S.candidates.length + ' on the board' : ''));
  }
  function runwayWith(sal) { var b = G.derived().burn + sal; return b > 0 ? S.bank / b : Infinity; }
  function renderCluster() {
    var dv = G.derived(), h = '', totalTrain = 0, busy = 0;
    dv.pools.forEach(function (p) { totalTrain += p.count; busy += p.busy; });
    h += '<div class="sec">Cards <span class="r num">' + dv.pfPerDay.toFixed(2) + ' PF-days/day · ' + (totalTrain ? Math.round(100 * busy / totalTrain) : 0) + '% busy</span></div>';
    h += '<table class="tbl"><tr><th>Pool</th><th class="n">Cards</th><th class="n">Training</th><th>Status</th></tr>';
    dv.pools.forEach(function (p) {
      var st = '';
      if (p.key === 'office') st = 'owned' + (dv.lent ? ' · ' + dv.lent + ' lent out' : '');
      if (p.key === 'a100') st = p.raw ? 'owned · 2.5× a V100' : 'none yet';
      if (p.key === 'cloud') { var rs = S.rentals.filter(function (r) { return S.day < r.end; }); st = rs.length ? (S.rentals.some(function (r) { return S.day < r.start; }) ? 'live tomorrow' : 'rented to ' + F.date(Math.min.apply(null, rs.map(function (r) { return r.end; })))) : (S.mer ? 'Meridian: exclusive' : 'none rented'); }
      if (p.key === 'meridian') st = S.mer ? (S.day < S.mer.live ? 'live ' + F.date(S.mer.live) : 'queue: ' + S.mer.alloc + ' of ' + S.mer.cards) : 'no deal';
      if (p.serving) st += ' · ' + p.serving + ' serving API';
      h += '<tr><td>' + esc(p.name) + '</td><td class="n">' + p.count + (p.type === 'a100' ? ' A100' : '') + '</td><td class="n">' + (p.busy ? '<span class="acc">' + p.busy + '</span>' : '—') + '</td><td class="small muted">' + esc(st) + '</td></tr>';
    });
    h += '</table>';
    if (S.orders.length) { h += '<div class="sec">On order</div><div class="rows">'; S.orders.forEach(function (o) { h += '<div class="row small"><span>' + esc(o.label) + ' · ' + o.n + ' ' + o.type.toUpperCase() + 's</span><span class="num muted">arrives ' + esc(F.date(o.arrive)) + (o.arrive >= CFG.endDay ? ' (2021)' : '') + '</span></div>'; }); h += '</div>'; }
    var live = S.rentals.filter(function (r) { return S.day < r.end; });
    if (live.length) {
      h += '<div class="sec">Rentals</div><div class="rows">';
      live.forEach(function (r) { var q = G.renewQuote(r.id); h += '<div class="row small"><span>' + r.n + ' V100s · $' + r.price.toFixed(2) + '/h · to ' + esc(F.date(r.end)) + '</span><span><button type="button" class="btn sm" data-act="renew" data-id="' + r.id + '"' + (q.why ? ' disabled title="' + esc(q.why) + '"' : '') + '>Renew 90d</button></span></div>' + (q.why && r.end - S.day <= CFG.rent.renewWindow ? '<div class="why">' + esc(q.why) + '</div>' : ''); });
      h += '</div>';
    }
    h += '<div class="sec">GPU market <span class="r">' + esc(F.date(S.day)) + ' prices</span></div><div class="mkt">';
    [64, 128, 256].forEach(function (n) {
      var q = G.rentQuote(n);
      h += '<button type="button" class="btn" data-act="rent" data-n="' + n + '"' + (q.why ? ' disabled' : '') + '><span class="l"><span>Rent ' + n + ' V100s · 90 days</span><span class="sub">' + (q.why ? esc(q.why) : '$' + q.price.toFixed(2) + '/GPU-hour · live ' + esc(F.date(q.live)) + ' · runway ' + esc(F.months(dv.runway)) + ' → ' + esc(F.months(burnRunway(q.monthly))) + ' mo') + '</span></span><span class="p">' + esc(F.money(q.monthly)) + '/mo</span></button>';
    });
    ['dgx1', 'pod', 'dgxa', 'poda'].forEach(function (k) {
      var q = G.buyQuote(k);
      if (q.why === 'Not announced yet.') { if (k === 'dgxa') h += '<div class="small dim">DGX A100: not announced yet.</div>'; return; }
      h += '<button type="button" class="btn" data-act="buy" data-item="' + k + '"' + (q.why ? ' disabled' : '') + '><span class="l"><span>Buy ' + esc(q.label) + ' · ' + q.n + ' ' + q.type.toUpperCase() + 's</span><span class="sub">' + (q.why ? esc(q.why) + ' ' : '') + 'lead ' + Math.round(q.lead / 7) + ' weeks' + (q.covid ? ' (COVID +4)' : '') + (q.post ? ' (scramble +8)' : '') + ' · arrives ' + esc(F.date(q.arrive)) + (q.late ? ' 2021' : '') + '</span></span><span class="p">' + esc(F.money(q.price)) + '</span></button>';
    });
    var ro = G.rentOutQuote();
    h += '<button type="button" class="btn" data-act="rentout"' + (ro.why ? ' disabled' : '') + '><span class="l"><span>Rent out ' + (ro.n || 'half your') + ' office V100s · 30 days</span><span class="sub">' + (ro.why ? esc(ro.why) : '$1.90/GPU-hour, cash now' + (ro.busy ? ' · slows the run on them' : '')) + '</span></span><span class="p">' + (ro.why ? '' : '+' + esc(F.money(ro.cash))) + '</span></button>';
    h += '</div>';
    setHTML('b-cluster', h);
    setHTML('s-cluster', dv.physical + ' cards · ' + dv.pfPerDay.toFixed(2) + ' PF-d/d' + (S.orders.length ? ' · ' + S.orders.length + ' on order' : '') + (S.mer && S.day < S.mer.live ? ' · Meridian ' + F.date(S.mer.live) : ''));
  }
  function burnRunway(addMonthly) { var b = G.derived().burn + addMonthly; return b > 0 ? S.bank / b : Infinity; }
  function renderData() {
    var dv = G.derived(), d = S.data, h = '', est = Math.sqrt(d.lo * d.hi);
    h += '<div class="sec">Clean-data wall <span class="r">' + (d.filters ? F.plural(d.filters, 'filter') + ' done' : 'unfiltered crawl') + '</span></div>';
    h += '<div class="row"><span class="num" style="font-size:18px;font-weight:600">' + esc(F.size(d.lo)) + '–' + esc(F.size(d.hi)) + '</span><span class="small muted">tokens before the words go bad</span></div>';
    // the bar: log scale 10B to 2T
    var lo = 10, hi = 12.3, pos = function (v) { return clamp((log10(v) - lo) / (hi - lo) * 100, 0, 100); };
    var nextD = ui.design ? ui.design.D : 0, runEat = S.run ? S.run.done / S.run.C * S.run.D : 0;
    h += '<div style="position:relative;height:28px;margin:6px 0 2px;border:1px solid var(--line);border-radius:4px;background:var(--panel)">';
    h += '<div style="position:absolute;top:0;bottom:0;left:' + pos(d.lo).toFixed(1) + '%;width:' + Math.max(1, pos(d.hi) - pos(d.lo)).toFixed(1) + '%;background:var(--danger-soft);border-left:1px dashed var(--danger);border-right:1px dashed var(--danger)"></div>';
    if (S.run) h += '<div style="position:absolute;top:9px;height:10px;left:0;width:' + pos(runEat).toFixed(1) + '%;background:var(--accent);opacity:.75;border-radius:0 2px 2px 0"></div>';
    if (nextD && !S.run) h += '<div style="position:absolute;top:2px;bottom:2px;width:2px;left:' + pos(nextD).toFixed(1) + '%;background:var(--text)"></div>';
    h += '</div><div class="row small dim num"><span>10B</span><span>100B</span><span>1T</span></div>';
    h += '<div class="small muted" style="margin-top:4px">' + (S.run ? 'Bar: tokens run ' + S.run.id + ' has read (' + F.size(runEat) + ' of ' + F.size(S.run.D) + '). ' : nextD ? 'White tick: your next run (' + F.size(nextD) + ' tokens). ' : '') + 'Read checkpoints near the wall to narrow the red band: frayed sentences mean you are close; cookie banners mean you are past it.</div>';
    h += '<div class="sec">Crawl</div><div class="rows small">';
    h += '<div class="row"><span>Raw crawl on disk</span><span class="num">' + F.size(CFG.rawCrawl) + ' tokens</span></div>';
    h += '<div class="row"><span>Clean, after filtering (est.)</span><span class="num">~' + F.size(est / CFG.passes) + ' unique</span></div>';
    h += '<div class="row"><span>Passes over clean text that still count</span><span class="num">' + CFG.passes + '</span></div></div>';
    h += '<div class="sec">Filter jobs</div>';
    if (d.job) { var tot = d.job.end - d.job.start, done = clamp((S.day - d.job.start) / tot, 0, 1); h += '<div class="row small"><span>' + esc(WORLD.people[d.job.who].first) + ' is filtering</span><span class="num">' + Math.max(0, Math.ceil(d.job.end - S.day)) + ' days left</span></div><div class="bar" style="margin-top:4px"><i style="width:' + (done * 100).toFixed(1) + '%"></i></div><div class="small muted" style="margin-top:4px">When it lands the wall moves out ×1.86 in tokens (about 10× in compute). Runs launched before then are judged against the old wall.</div>'; }
    else { var cf = dv.canFilter; h += '<button type="button" class="btn" style="width:100%" data-act="filter"' + (cf.ok ? '' : ' disabled') + '>Run a filter job · ' + esc(F.money(dv.filterCost)) + ' · ' + dv.filterDays + ' days<span class="sub">' + (cf.ok ? 'pushes the wall out ×1.86 in tokens; each job costs twice the last' : esc(cf.msg)) + '</span></button>'; }
    var dl = null; for (var i = 0; i < S.feed.length; i++) if (S.feed[i].kind === 'data') { dl = S.feed[i]; break; }
    if (dl) h += '<div class="card" style="margin-top:8px"><div class="row small"><span class="nm">' + esc(dl.name) + '</span><span class="dim num">' + esc(F.date(dl.day)) + '</span></div><div class="say">' + esc(dl.text) + '</div></div>';
    setHTML('b-data', h);
    setHTML('s-data', 'wall ' + F.size(d.lo) + '–' + F.size(d.hi) + (d.job ? ' · filtering ' + Math.max(0, Math.ceil(d.job.end - S.day)) + 'd' : d.filters ? ' · ' + F.plural(d.filters, 'filter') : ''));
  }
  function spark(vals, w, h) {
    if (vals.length < 2) return '';
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); if (mx - mn < 1) { mx += 1; mn -= 1; }
    var pts = vals.map(function (v, i) { return (i / (vals.length - 1) * w).toFixed(1) + ',' + (h - (v - mn) / (mx - mn) * (h - 2) - 1).toFixed(1); }).join(' ');
    return '<svg width="100%" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>';
  }
  function renderMoney() {
    var dv = G.derived(), rs = dv.raise, h = '';
    h += '<div class="sec">Cash <span class="r num">next payday ' + esc(F.date(dv.nextPayday)) + ' · ' + esc(F.money(dv.payroll)) + '</span></div>';
    h += '<div class="row"><span class="num" style="font-size:20px;font-weight:600">' + esc(F.moneyFull(S.bank)) + '</span><span class="num small ' + (dv.runway < 6 ? 'bad-t' : 'muted') + '">' + (isFinite(dv.runway) ? F.months(dv.runway) + ' months of runway' : 'profitable') + '</span></div>';
    h += '<div style="margin:4px 0 2px">' + spark(ui.cashHist.slice(-200), 240, 30) + '</div>';
    h += '<div class="rows small">';
    var rowsB = [['Salaries (' + G.staff().length + ')', dv.salaries], ['Office, ops, you', CFG.base], ['Owned card upkeep', dv.upkeep], ['Cloud rent', dv.rentMonthly]];
    var tot = dv.payroll + dv.rentMonthly;
    rowsB.forEach(function (x) { h += '<div class="row"><span>' + esc(x[0]) + '</span><span class="num">' + esc(F.money(x[1])) + '</span></div><div class="bar" style="height:3px"><i style="width:' + (tot ? 100 * x[1] / tot : 0).toFixed(1) + '%;background:var(--muted)"></i></div>'; });
    if (dv.api) h += '<div class="row acc"><span>API revenue</span><span class="num">−' + esc(F.money(dv.api)) + '</span></div>';
    h += '<div class="row" style="font-weight:600"><span>Burn</span><span class="num">' + esc(F.money(dv.burn)) + '/mo</span></div></div>';
    h += '<div class="sec">Fundraising <span class="r ' + (rs.marketOpen ? 'acc' : 'bad-t') + '">market ' + (rs.marketOpen ? 'open' : S.day >= CFG.crashDay && S.day < CFG.marketOpenDay ? 'closed until 15 JUN' : 'shut to us until ' + F.date(rs.blockedUntil)) + '</span></div>';
    var aProof = proofParts();
    h += '<div class="card"><div class="row"><span class="nm">Series A · ' + esc(WORLD.fictional.seriesA) + '</span><span class="tag ' + (rs.a.done ? 'on' : '') + '">' + (rs.a.done ? 'closed' : esc(F.money(rs.a.cash)) + ' @ ' + esc(F.money(rs.a.post))) + '</span></div>';
    if (!rs.a.done) {
      h += '<div class="small">' + check(aProof.two) + ' two clean dots on the line, a decade apart, after 23 Jan</div><div class="small">' + check(aProof.far) + ' the farthest at ≥ ' + esc(F.sci(rs.a.need)) + (aProof.farC ? ' <span class="dim">(yours: ' + esc(F.sci(aProof.farC)) + ')</span>' : '') + '</div><div class="small">' + check(rs.marketOpen) + ' market open' + (S.day < CFG.crashDay ? ' <span class="dim">(markets turn; terms rise later)</span>' : '') + '</div>';
      h += '<div class="small muted">Takes you from ' + esc(F.pct(S.stake)) + ' to ' + esc(F.pct(S.stake * (1 - rs.a.cash / rs.a.post))) + '.</div>';
      h += '<div class="acts"><button type="button" class="btn sm' + (rs.a.proof && rs.marketOpen ? ' primary' : '') + '" data-act="raise" data-round="A"' + (rs.a.proof && rs.marketOpen && !S.pending ? '' : ' disabled') + '>Pitch Series A</button></div>';
    }
    h += '</div>';
    h += '<div class="card"><div class="row"><span class="nm">Series B · ' + esc(WORLD.fictional.seriesB) + '</span><span class="tag ' + (rs.b.done && !S.raise.bPassed ? 'on' : '') + '">' + (rs.b.done ? (S.raise.bPassed ? 'passed' : 'closed') : esc(F.money(rs.b.cash)) + ' @ ' + esc(F.money(rs.b.post))) + '</span></div>';
    if (!rs.b.done) h += '<div class="small">' + check(rs.a.done) + ' Series A done</div><div class="small">' + check(rs.b.proof) + ' a clean dot ≥ 3e22 landed after 11 Jun</div><div class="small muted">' + (S.api ? 'API live: priced higher.' : 'An API live lifts the price to a $1.8B post.') + '</div><div class="acts"><button type="button" class="btn sm" data-act="raise" data-round="B"' + (rs.b.proof && rs.marketOpen && !S.pending ? '' : ' disabled') + '>Pitch Series B</button></div>';
    h += '</div>';
    h += '<div class="row small" style="margin-top:6px"><span>Your stake</span><span class="num ' + (S.stake < 0.55 ? 'bad-t' : '') + '">' + esc(F.pct(S.stake)) + ' · below 50% the board sells to Halcyon</span></div>';
    h += '<div class="sec">Meridian cloud</div>';
    if (S.mer) h += '<div class="small">Signed ' + esc(F.date(S.mer.signed)) + ': ' + S.mer.cards.toLocaleString('en-US') + ' V100s, ' + (S.day < S.mer.live ? 'live ' + esc(F.date(S.mer.live)) : 'allocation ' + S.mer.alloc + ' this month') + '. Credits left ' + esc(F.money(S.mer.credits)) + '. Exclusive; first look 7 days; no open weights. Queue from 11 Jun: within 2× of the frontier gets all cards, within 10× half, otherwise a quarter.</div>';
    else h += '<div class="small muted">' + (S.flags.merOffered ? (S.flags.mer2Offered ? 'You passed twice. Independent.' : 'You passed. They’ll be back after 15 Jun with a smaller offer.') : 'A fictional cloud giant. It offers $50M of compute (1,024 V100s) once you land a clean dot ≥ 1e21, from 1 Apr. The price: exclusivity, first look at every checkpoint, no open weights.') + '</div>';
    h += '<div class="sec">Ledger</div><div class="rows small">';
    S.ledger.slice(-6).reverse().forEach(function (l) { h += '<div class="row"><span><span class="dim num">' + esc(F.date(l.day)) + '</span> ' + esc(l.what) + '</span><span class="num ' + (l.amt > 0 ? 'acc' : '') + '">' + (l.amt ? (l.amt > 0 ? '+' : '') + esc(F.money(l.amt)) : '') + '</span></div>'; });
    h += '</div>';
    setHTML('b-money', h);
    setHTML('s-money', F.money(S.bank) + ' · burn ' + F.money(dv.burn) + ' · ' + (dv.runway < 6 ? '<span class="bad">' + F.months(dv.runway) + ' mo</span>' : F.months(dv.runway) + ' mo') + ' · ' + (rs.a.done ? 'Series A done' : 'Series A needs ' + F.sci(rs.a.need)));
  }
  function check(ok) { return ok ? '<span class="acc">✓</span>' : '<span class="dim">○</span>'; }
  function proofParts() {
    var ok = S.runs.filter(function (r) { return r.clean && r.onLine && r.landDay >= CFG.seriesA.fromDay; });
    var far = 0; ok.forEach(function (r) { if (r.C > far) far = r.C; });
    var two = ok.some(function (r) { return far / r.C >= Math.pow(10, 0.98); });
    return { two: two, far: far >= Math.max(CFG.seriesA.needC, S.raise.aNeed), farC: far };
  }
  function renderRivals() {
    var dv = G.derived(), h = '', rl = Math.max(0, Math.ceil(S.relevance.deadline - S.day));
    h += '<div class="sec">Relevance <span class="r ' + (rl <= 30 ? 'bad-t' : '') + '">forgotten in ' + rl + ' days</span></div>';
    h += '<div class="small">The world forgets a lab that goes 100 days without publishing or shipping a result of at least 1% of the frontier’s compute. Today that is <b class="num">' + esc(F.sci(dv.relevantNeed)) + '</b> (frontier ' + esc(F.sci(dv.frontier)) + (S.day >= CFG.gpt3Day ? ', GPT-3' : '') + '). Deadline: <b>' + esc(F.date(S.relevance.deadline)) + '</b>' + (S.relevance.why ? ', set by ' + esc(S.relevance.why) : ', the first one') + '. A live API counts each payday while its model is big enough.</div>';
    h += '<div class="sec">Labs <span class="r">all fictional</span></div>';
    S.rivals.forEach(function (rv, i) {
      var pubs = rv.pubs.filter(function (p) { return p.day <= S.day; }), lp = pubs[pubs.length - 1];
      var est = G.rivalC(rv, S.day), estR = Math.pow(10, Math.round(log10(est) * 2) / 2);
      h += '<div class="card"><div class="row"><span><span class="nm">' + esc(rv.name) + '</span> <span class="small dim">' + esc(rv.kind) + '</span></span><span class="num small">est. ~' + esc(F.sci(estR)) + '</span></div>';
      h += '<div class="small">Latest paper: ' + esc(F.size(lp.N)) + ' params · <span class="num">' + esc(F.sci(lp.C)) + '</span> · ' + lp.L.toFixed(2) + ' nats · ' + (lp.day < 0 ? '2019' : esc(F.date(lp.day))) + '</div>';
      h += '<div class="small muted">' + F.plural(pubs.length, 'paper') + (rv.people.length ? ' · took ' + esc(rv.people.join(', ')) + ' from you' : '') + '</div></div>';
    });
    var fb = dv.best;
    h += '<div class="small muted" style="margin-top:6px">You: ' + (fb ? 'best clean ' + esc(F.sci(fb.C)) + ', public ' + (dv.farthestPublic ? esc(F.sci(dv.farthestPublic)) : 'nothing yet') : 'no clean dot yet') + '. Publishing pulls every rival behind you toward your dot within 14 days.</div>';
    setHTML('b-rivals', h);
    var lead = S.rivals.slice().sort(function (a, b) { return b.pubs[b.pubs.length - 1].C - a.pubs[a.pubs.length - 1].C; })[0];
    setHTML('s-rivals', (rl <= 30 ? '<span class="bad">forgotten in ' + rl + 'd</span>' : 'forgotten in ' + rl + 'd') + ' · lead: ' + lead.name + ' ' + F.sci(lead.pubs[lead.pubs.length - 1].C));
  }
  function renderNews() {
    var items = [];
    ui.newsLog.forEach(function (n) { items.push({ day: n.day, k: 'news', html: '<span class="who">NEWS</span><span class="t">' + esc(n.news.text) + '</span>' + (n.news.note ? '<span class="fx-note">' + esc(n.news.note) + '</span>' : '') }); });
    S.feed.slice(0, 60).forEach(function (f) {
      var who = f.who === 'lab' ? '' : '<span class="who">' + esc(f.name) + '</span>';
      items.push({ day: f.day, k: f.kind === 'voice' || f.kind === 'data' ? 'voice' : f.kind, html: who + '<span class="t">' + esc(f.text) + '</span>' });
    });
    S.decided.slice(0, 20).forEach(function (d) { items.push({ day: d.answeredDay != null ? d.answeredDay : d.day, k: 'decided', html: '<span class="t">' + esc(d.title) + ' → <b>' + esc(d.answer) + '</b></span>' }); });
    items.sort(function (a, b) { return b.day - a.day; });
    var h = '';
    if (S.pending) h += '<div class="card" style="border-color:var(--danger-line)"><div class="small bad-t">Waiting for you: ' + esc(S.pending.title) + '</div></div>';
    h += '<div class="feed">' + items.slice(0, 50).map(function (it) { return '<div class="fi ' + it.k + '"><span class="d">' + esc(F.date(it.day)) + '</span><span>' + it.html + '</span></div>'; }).join('') + '</div>';
    if (!items.length) h += '<div class="small dim">Real 2020 headlines arrive on their dates, and everything your people say lands here.</div>';
    setHTML('b-news', h);
    var top = ui.newsLog[0];
    setHTML('s-news', top ? esc(F.date(top.day)) + ' · ' + esc(top.news.text.slice(0, 70)) + '…' : (S.feed[0] ? esc(S.feed[0].text.slice(0, 70)) : 'quiet'));
  }

  /* ---------------- the decision on screen ---------------- */
  function renderModal() {
    var d = S.pending, m = $('modal'), sc = $('scrim');
    if (!d || S.over) { if (ui.modalId != null) { m.hidden = true; sc.hidden = true; ui.modalId = null; } return; }
    if (ui.modalId === d.id) { refreshModalEffects(d); return; }
    ui.modalId = d.id; ui.modalShown = nowMs();
    var who = d.who && WORLD.people[d.who] ? WORLD.people[d.who] : null;
    var h = '<div class="m-kick"><span class="from">' + esc(d.from || (who ? who.name.toUpperCase() : '')) + (d.role ? ' · ' + esc(d.role) : '') + '</span><span class="num when">' + esc(F.date(S.day, true)) + ' · paused</span></div>';
    h += '<h3 class="m-title" id="m-title">' + esc(d.title) + '</h3>';
    if (d.kind === 'land' && d.sample) h += '<p class="m-sample' + (d.sampleCap === 'code' ? ' code' : '') + '"><span class="cap">The model, at landing</span>' + esc(d.sample) + '</p>';
    if (d.voice) h += '<p class="m-voice">' + esc(d.voice) + (who ? '<span class="by">' + esc(who.name) + ' · ' + esc(who.role) + '</span>' : d.from ? '<span class="by">' + esc(d.from) + '</span>' : '') + '</p>';
    if (d.body) h += '<p class="m-body">' + esc(d.body) + '</p>';
    if (d.evals) h += '<div class="m-evals">' + d.evals.map(function (e) { return '<span class="tag ' + (e.leak ? 'bad' : e.ok ? 'on' : '') + '">' + (e.ok ? '✓ ' : '✗ ') + esc(e.label) + (e.isNew ? ' · new' : '') + (e.leak ? ' · leaked' : '') + '</span>'; }).join('') + '</div>';
    h += '<div class="m-opts">' + d.options.map(function (o, i) {
      return '<button type="button" class="btn m-opt' + (o.primary && !o.disabled ? ' primary' : '') + '" data-opt="' + esc(o.key) + '"' + (o.disabled ? ' disabled' : '') + '><span class="ol"><span>' + esc(o.label) + '</span><kbd>' + (i + 1) + '</kbd></span><span class="oe" data-eff="' + esc(o.key) + '">' + esc(effText(o)) + '</span></button>';
    }).join('') + '</div>';
    h += '<div class="m-foot">The year is paused until you choose. Nothing expires while this is open.</div>';
    m.innerHTML = h; m.className = 'modal' + (d.moment || (d.run && d.run.miracle) ? ' moment' : ''); m.hidden = false; sc.hidden = false;
    var first = m.querySelector('.m-opt.primary:not(:disabled)') || m.querySelector('.m-opt:not(:disabled)');
    try { if (first && !isTouch()) first.focus({ preventScroll: true }); else m.focus && m.setAttribute('tabindex', '-1'); } catch (e) {}
  }
  function effText(o) { try { return typeof o.effect === 'function' ? o.effect() : (o.effect || o.why || ''); } catch (e) { return ''; } }
  function refreshModalEffects(d) { d.options.forEach(function (o) { var el = document.querySelector('#modal [data-eff="' + o.key + '"]'); if (el) { var t = effText(o); if (el.textContent !== t) el.textContent = t; } }); }
  function isTouch() { return window.matchMedia && window.matchMedia('(pointer: coarse)').matches; }
  function choose(key) {
    var d = S.pending; if (!d) return;
    if (nowMs() - ui.modalShown < 350) return;   // a tap meant for the last decision never lands on this one
    AUD.unlock(); AUD.click();
    var res = G.answer(d.id, key);
    if (res && res.ok) { renderAll(true); }
  }

  /* ---------------- the end of the year ---------------- */
  function renderEnd() {
    if (!S.over || ui.endShown) return;
    ui.endShown = true;
    var o = S.over, sc = o.score, el = $('end');
    var good = o.kind === 'survived';
    var h = '<div class="end-in"><div class="end-date">FRONTIER · ' + esc(o.date) + '</div><h2 class="end-head ' + (good ? 'good' : 'bad') + '" id="e-head">' + esc(WORLD.ends.head[o.kind]) + '</h2>';
    h += '<p class="end-reason">' + esc(o.reason) + '</p><p class="end-gap">' + esc(o.gap) + '</p>';
    h += '<div class="end-chart"><canvas id="end-chart"></canvas></div>';
    h += '<div class="end-score">' + [['Model vs GPT-3', sc.model], ['Miracle', sc.miracle], ['Reputation', sc.rep], ['Revenue', sc.revenue], ['People kept', sc.people]].map(function (x) { return '<div class="rd"><span class="k">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>'; }).join('') + '</div>';
    h += '<div class="row"><span class="end-total">Score ' + sc.total + '</span><button type="button" class="btn primary" id="e-again">Play a new 2020</button></div>';
    h += '<div class="small muted">Score: your best clean model against GPT-3 (100 at its compute, 25 less per decade short), +50 for matching it, plus reputation, API revenue ($50k = 1) and 5 per person still with you. ' + F.plural(S.stats.runs, 'run') + ', ' + S.stats.published + ' published, ' + S.stats.shipped + ' shipped, ' + F.plural(S.stats.hangs, 'hang') + ', ' + F.plural(S.stats.scandals, 'scandal') + '.</div></div>';
    el.innerHTML = h; el.hidden = false; $('modal').hidden = true; $('scrim').hidden = true;
    setTimeout(function () { try { drawChart($('end-chart'), { end: true }); } catch (e) {} }, 30);
    $('e-again').addEventListener('click', function () { var ns = (S.seed + 1) >>> 0; try { history.replaceState(null, '', '#seed=' + ns); } catch (e) {} boot(ns); });
    try { $('e-again').focus({ preventScroll: true }); } catch (e) {}
  }

  /* ---------------- rendering cadence ---------------- */
  function renderPanels() { renderRunbar(); renderDesigner(); renderTeam(); renderCluster(); renderData(); renderMoney(); renderRivals(); renderNews(); }
  function renderAll(force) {
    renderTop();
    if (force || nowMs() > ui.holdUntil) renderPanels();
    renderModal(); renderEnd();
    ui.chartDirty = true;
  }
  var lastT = 0;
  function frame(t) {
    var dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
    try {
      if (!document.hidden) G.tick(dt * botSpeed);
      pumpWords();
      var n = nowMs();
      if (n - ui.lastTop > 90) { ui.lastTop = n; renderTop(); renderModal(); renderEnd(); }
      if (n - ui.lastPanels > 240 && n > ui.holdUntil) { ui.lastPanels = n; renderPanels(); }
      if (S.active.length || ui.chartDirty || n - ui.lastChart > 600) { ui.lastChart = n; ui.chartDirty = false; drawChart($('chart')); }
      if (n - ui.lastLoad > 500) { ui.lastLoad = n; var r = S.run; var cards = 0; S.active.forEach(function (x) { if (!x.hang) cards += x.cards; }); AUD.load(cards, cards > 0 && !S.paused && !S.pending && !S.over); }
    } catch (e) { if (window.console) console.error(e); }
    requestAnimationFrame(frame);
  }

  /* ---------------- input ---------------- */
  function hold(ms) { ui.holdUntil = Math.max(ui.holdUntil, nowMs() + ms); }
  document.addEventListener('pointerdown', function (e) { ui.pointerDown = true; hold(600); AUD.unlock(); }, true);
  document.addEventListener('pointerup', function () { ui.pointerDown = false; hold(120); }, true);
  document.addEventListener('pointercancel', function () { ui.pointerDown = false; }, true);
  document.addEventListener('keydown', function () { AUD.unlock(); }, true);

  function doAct(name, p) {
    var res = G.act(name, p || {});
    if (res && !res.ok && res.msg) { G.S.feed.unshift({ day: S.day, who: 'lab', name: '', text: res.msg, kind: 'warn' }); }
    AUD.click(); renderAll(true);
    return res;
  }
  document.getElementById('fx').addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null; if (!t || t.disabled) return;
    if (t.hasAttribute('data-opt')) { choose(t.getAttribute('data-opt')); return; }
    if (t.hasAttribute('data-jump')) { jump(t.getAttribute('data-jump')); return; }
    if (t.hasAttribute('data-pool')) { ui.pool = t.getAttribute('data-pool'); ui.poolTouched = true; ui.gpusTouched = false; renderDesigner(); ui.chartDirty = true; return; }
    if (t.classList.contains('ph-btn')) { togglePanel(t.closest('.panel')); return; }
    if (t.id === 't-pause') { if (S.over) return; G.act('pause', { on: S.started && !S.paused ? true : false }); if (!S.started) { S.started = true; S.paused = false; } renderTop(); return; }
    if (t.classList.contains('sp')) { G.act('speed', { x: +t.getAttribute('data-speed') }); S.started = true; renderTop(); return; }
    if (t.id === 't-mute') { AUD.unlock(); AUD.setMuted(!AUD.muted); renderTop(); return; }
    if (t.id === 'd-launch') { launch(); return; }
    var a = t.getAttribute('data-act'); if (!a) return;
    if (a === 'stop') { var sid = +t.getAttribute('data-id'); if (ui.stopArm && ui.stopArm.id === sid && nowMs() - ui.stopArm.t < 3000) { ui.stopArm = null; doAct('stop', { id: sid }); } else { ui.stopArm = { id: sid, t: nowMs() }; ui.html.runbar = null; renderRunbar(); } return; }
    if (a === 'sample') { doAct('sample', t.hasAttribute('data-id') ? { id: +t.getAttribute('data-id') } : {}); return; }
    if (a === 'hire' || a === 'wake') { doAct(a, { id: t.getAttribute('data-id') }); return; }
    if (a === 'renew') { doAct('renew', { id: t.getAttribute('data-id') }); return; }
    if (a === 'rent') { doAct('rent', { gpus: +t.getAttribute('data-n') }); return; }
    if (a === 'buy') { doAct('buy', { item: t.getAttribute('data-item') }); return; }
    if (a === 'raise') { doAct('raise', { round: t.getAttribute('data-round') }); return; }
    doAct(a);
  });
  function launch() {
    var d = currentDesign();
    var res = G.act('launch', { params: d.N, tokens: d.D, pool: d.pool, gpus: d.cards });
    AUD.unlock();
    if (res.ok) { S.paused = false; if (window.innerWidth < 720) { var tp = $('p-train'); try { tp.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) {} } }
    renderAll(true);
  }
  function togglePanel(p) { if (!p || p.classList.contains('p-train')) return; var open = !p.classList.contains('open'); p.classList.toggle('open', open); var b = p.querySelector('.ph-btn'); if (b) b.setAttribute('aria-expanded', String(open)); }
  function jump(id) {
    var p = $(id); if (!p) return;
    if (!p.classList.contains('open')) togglePanel(p);
    try { p.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (e) { p.scrollIntoView(); }
  }
  // the designer's sliders
  $('d-params').addEventListener('input', function (e) { ui.params = niceN(fromSlider(+e.target.value, LOGN)); if (ui.recipe) { ui.tokens = G.recipeTokens(ui.params); $('d-tokens').value = toSlider(ui.tokens, LOGD); } renderDesigner(); ui.chartDirty = true; });
  $('d-tokens').addEventListener('input', function (e) { ui.tokens = niceN(fromSlider(+e.target.value, LOGD)); ui.recipe = false; $('d-recipe').checked = false; renderDesigner(); ui.chartDirty = true; });
  $('d-recipe').addEventListener('change', function (e) { ui.recipe = e.target.checked; if (ui.recipe) { ui.tokens = G.recipeTokens(ui.params); $('d-tokens').value = toSlider(ui.tokens, LOGD); } renderDesigner(); ui.chartDirty = true; });
  $('d-gpus').addEventListener('input', function (e) { ui.gpus = +e.target.value; ui.gpusTouched = true; renderDesigner(); ui.chartDirty = true; });
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '', typing = tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox';
    if (typing) return;
    if (S.over) return;
    if (S.pending) {
      var k = parseInt(e.key, 10);
      if (k >= 1 && k <= S.pending.options.length) { var o = S.pending.options[k - 1]; if (!o.disabled) { e.preventDefault(); choose(o.key); } }
      return;
    }
    if (e.key === ' ' || e.code === 'Space') { if (tag === 'BUTTON') return; e.preventDefault(); if (!S.started) { S.started = true; S.paused = false; } else G.act('pause'); renderTop(); return; }
    if (e.key === '1' || e.key === '2' || e.key === '4') { G.act('speed', { x: +e.key }); S.started = true; renderTop(); return; }
    if (e.key === 's' || e.key === 'S') { doAct('sample'); return; }
    if (e.key === 'l' || e.key === 'L') { if (!$('d-launch').disabled) launch(); return; }
    if (e.key === 'm' || e.key === 'M') { AUD.setMuted(!AUD.muted); renderTop(); return; }
    if (e.key === 'p' || e.key === 'P') { G.act('pause'); renderTop(); return; }
  });
  document.addEventListener('visibilitychange', function () { AUD.suspend(document.hidden); lastT = 0; });
  window.addEventListener('resize', function () { ui.chartDirty = true; });

  /* ---------------- the test hook (playtesters and bots; players never see it) ---------------- */
  window.__frontier = {
    state: function () { return G.state(); },
    act: function (name, payload) {
      var res;
      if (name === 'speed' && payload && payload.x == null && payload.n != null) payload = { x: payload.n };
      if (name === 'launch' && payload && payload.design) { var d = currentDesign(); res = G.act('launch', { params: d.N, tokens: d.D, pool: d.pool, gpus: d.cards }); }
      else res = G.act(name, payload || {});
      renderAll(true);
      return res;
    },
    speed: function (n) { botSpeed = Math.max(0.1, +n || 1); return botSpeed; },
    design: function (p) { return G.design(p); },
    advance: function (days) { G.act('advance', { days: days }); renderAll(true); return G.state(); },
    engine: function () { return G; }
  };

  boot(seedFromHash() != null ? seedFromHash() : (Math.floor(Math.random() * 1e9) >>> 0));
  requestAnimationFrame(frame);
})();
