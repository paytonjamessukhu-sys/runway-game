/* Under the paper: the live run and the model's words. The run designer's readout and launch live in the options band; its sliders in the tune sheet. */
(function (X) {
  'use strict';
  var $ = X.$, esc = X.esc, log10 = X.log10, clamp = X.clamp;

  /* ---------------- the model's voice: words stream in ---------------- */
  X.streamSample = function (smp) {
    var ui = X.ui, F = X.F, el = $('model-text'), meta = $('model-meta');
    var where = smp.kind === 'land' ? 'finished' : (smp.s < 0.01 ? (smp.s * 100).toFixed(2) : Math.round(smp.s * 100)) + '% through';
    meta.innerHTML = '<span class="mm-who">THE MODEL · RUN ' + smp.runId + '</span><span class="num">' + esc(where) + ' · error score ' + smp.loss.toFixed(2) + ' · read ' + esc(F.size(smp.tokens)) + ' tokens</span>';
    el.className = 'model-text' + (smp.cap === 'code' ? ' code' : '');
    el.textContent = '';
    var frag = document.createDocumentFragment(), spans = [];
    smp.text.split('\n').forEach(function (line, li) {
      if (li) frag.appendChild(document.createElement('br'));
      line.split(' ').forEach(function (w, i) { if (i) frag.appendChild(document.createTextNode(' ')); var sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; frag.appendChild(sp); spans.push(sp); });
    });
    el.appendChild(frag);
    if (X.reduced()) { spans.forEach(function (s) { s.classList.add('in'); }); ui.words = null; return; }
    ui.words = { spans: spans, t0: X.nowMs(), shown: 0 };
  };
  X.pumpWords = function () {
    var ui = X.ui, w = ui.words; if (!w) return;
    var n = Math.min(w.spans.length, Math.floor((X.nowMs() - w.t0) / 45) + 1);
    while (w.shown < n) { w.spans[w.shown].classList.add('in'); w.shown++; X.AUD.word(); }
    if (w.shown >= w.spans.length) ui.words = null;
  };
  X.modelEmpty = function () {
    $('model-text').textContent = 'Nothing yet. Start a run and the model starts talking: static first, then words, then sentences.';
    $('model-text').className = 'model-text empty';
    $('model-meta').innerHTML = '<span class="mm-who">THE MODEL</span><span>silent until it has read something</span>';
  };

  /* ---------------- the live run ---------------- */
  function runRow(r, dv) {
    var G = X.G, S = X.S, F = X.F, CFG = X.CFG, ui = X.ui, h = '', s = r.done / r.C, left = G.runDaysLeft(r), land = S.day + left;
    var pool = dv.pools.filter(function (p) { return p.key === r.pool; })[0], cardsNow = Math.min(r.cards, pool.count);
    var ticks = r.cks.map(function (c) { return c.s >= 0.05 ? '<b style="left:' + (c.s * 100).toFixed(1) + '%"></b>' : ''; }).join('');
    h += '<div class="rrow' + (r.hang ? ' hung' : '') + '">';
    if (r.hang) {
      if (r.hang.nan) h += '<div class="rb-top"><span class="rb-title">RUN ' + r.id + ' WENT HAYWIRE AT ' + esc(r.hang.label.replace(' NaN', '')) + '</span><span class="rb-sub">rolled back ' + (r.hang.lost * 24).toFixed(0) + ' hours</span></div><div class="prog"><i style="width:' + (s * 100).toFixed(2) + '%"></i>' + ticks + '</div><div class="rb-sub">The error score blew up. It restarts from its last saved copy' + (G.hasInfra() ? ' (every few hours, thanks to infra).' : ' (daily: nobody on infra).') + '</div>';
      else h += '<div class="rb-top"><span class="rb-title">RUN ' + r.id + ' HUNG AT ' + esc(r.hang.label) + '</span><span class="rb-sub">' + (r.hang.infra ? 'restarting itself' : 'dark until someone wakes up') + '</span></div>';
      if (!r.hang.nan) h += '<div class="prog"><i style="width:' + (s * 100).toFixed(2) + '%"></i>' + ticks + '</div>';
      if (!r.hang.nan) h += '<div class="rb-sub">' + (r.hang.infra ? 'Infra restarts it within an hour.' : 'Nobody is on call: it sits dark until morning. Wake someone to restart it in 20 minutes (it costs them morale).') + '</div>';
    } else {
      h += '<div class="rb-top"><span class="rb-title">RUN ' + r.id + ' · ' + esc(F.size(r.N)) + ' model</span><span class="rb-sub num">' + (s * 100).toFixed(0) + '% · lands ' + esc(isFinite(left) ? F.date(land) : '—') + '</span></div>';
      h += '<div class="prog" role="progressbar" aria-label="Run ' + r.id + ' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(s * 100) + '"><i style="width:' + (s * 100).toFixed(2) + '%"></i>' + ticks + '</div>';
      h += '<div class="rb-line"><div class="rb-sub">' + (cardsNow < r.cards ? '<span class="bad-t">' + cardsNow + ' of ' + r.cards + ' cards</span>' : cardsNow + ' cards') + ' · ' + (isFinite(left) ? (left < 1 ? 'under a day' : left.toFixed(left < 10 ? 1 : 0) + ' days') + ' to go' : 'no cards: starved') + (r.hangs ? ' · ' + F.plural(r.hangs, 'hang') : '') + (land >= CFG.endDay ? ' · <span class="bad-t">won’t land by 31 DEC</span>' : '') + '</div></div>';
    }
    var armed = ui.stopArm && ui.stopArm.id === r.id && X.nowMs() - ui.stopArm.t < 3000;
    h += '<div class="rb-acts"><button type="button" class="btn link" data-act="sample" data-id="' + r.id + '">What it says now' + (r === S.run ? ' <span class="dim">(S)</span>' : '') + '</button><button type="button" class="btn link' + (armed ? ' danger' : '') + '" data-act="stop" data-id="' + r.id + '">' + (armed ? 'Tap again to stop it' : 'Stop') + '</button></div></div>';
    return h;
  }
  X.renderRunbar = function () {
    var G = X.G, S = X.S, F = X.F, ui = X.ui, dv = G.derived(), h = '', act = S.active.slice().sort(function (a, b) { return b.C - a.C; });
    var rb = $('runbar'), hung = act.filter(function (r) { return r.hang && !r.hang.infra; });
    rb.classList.toggle('hung', hung.length > 0);
    if (hung.length) h += '<div class="rb-acts wake">' + G.staff().map(function (p) { return '<button type="button" class="btn link" data-act="wake" data-id="' + p.key + '">Wake ' + esc(p.first) + '</button>'; }).join('') + '</div>';
    act.forEach(function (r) { h += runRow(r, dv); });
    if (!act.length) {
      var last = S.runs[S.runs.length - 1];
      h += '<div class="rb-top"><span class="rb-title">NO RUN TRAINING</span><span class="rb-sub">' + (S.runs.length ? F.plural(S.runs.length, 'run') + ' so far' : 'your cards are idle') + '</span></div>';
      if (last) h += '<div class="rb-sub">Last: ' + esc(last.name || 'run ' + last.id) + (last.aborted ? ' stopped' : last.clean ? ' saved' + (last.published ? ', published' : last.shipped ? ', shipped' : last.redteaming ? ', with Lena' : last.pendingPublic ? ', with Meridian' : ', private') : ' ran past the data wall') + '. Idle cards earn nothing: start the next run.</div>';
    } else {
      var free = dv.pools.filter(function (p) { return p.count > 0 && !S.active.some(function (r) { return r.pool === p.key; }); });
      if (free.length) h += '<div class="rb-sub">Free: ' + free.map(function (p) { return p.count + ' in ' + poolLabel(p.key); }).join(', ') + '. One run per set of cards: start another below.</div>';
    }
    X.setHTML('runbar', h);
  };
  function poolLabel(k) { return { office: 'your office', cloud: 'rented cards', a100: 'your A100s', meridian: 'Meridian' }[k] || k; }

  /* ---------------- the designer ---------------- */
  var CFG = X.CFG;
  var LOGN = [log10(CFG.paramsMin), log10(CFG.paramsMax)], LOGD = [log10(CFG.tokensMin), log10(CFG.tokensMax)];
  function toSlider(v, lg) { return Math.round((log10(v) - lg[0]) / (lg[1] - lg[0]) * 1000); }
  function fromSlider(x, lg) { return Math.pow(10, lg[0] + (x / 1000) * (lg[1] - lg[0])); }
  function niceN(N) { var e = Math.floor(log10(N)), m = N / Math.pow(10, e); var steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10]; var best = 1; steps.forEach(function (s) { if (Math.abs(log10(s / m)) < Math.abs(log10(best / m))) best = s; }); return best * Math.pow(10, e); }
  X.syncDesignerInputs = function () {
    var ui = X.ui, G = X.G;
    if (ui.recipe) ui.tokens = G.recipeTokens(ui.params);
    $('d-params').value = toSlider(ui.params, LOGN);
    $('d-tokens').value = toSlider(ui.tokens, LOGD);
    $('d-recipe').checked = ui.recipe;
  };
  X.currentDesign = function () {
    var G = X.G, S = X.S, ui = X.ui, dv = G.derived(), pools = dv.pools;
    var busy = function (k) { return S.active.some(function (r) { return r.pool === k; }); };
    if (!ui.poolTouched || busy(ui.pool) || !pools.some(function (p) { return p.key === ui.pool && p.count > 0; })) {
      var best = pools.filter(function (p) { return !busy(p.key) && p.count > 0; }).sort(function (a, b) { return b.flops - a.flops; })[0];
      if (best) ui.pool = best.key;
      if (busy(ui.pool)) ui.poolTouched = false;
    }
    var avail = pools.filter(function (p) { return p.key === ui.pool; })[0].count;
    if (!ui.gpusTouched || ui.gpus > avail) ui.gpus = avail;
    return G.design({ params: ui.params, tokens: ui.recipe ? G.recipeTokens(ui.params) : ui.tokens, pool: ui.pool, gpus: ui.gpus });
  };
  function daysWord(d) { if (!isFinite(d)) return '—'; if (d < 1) return (d * 24).toFixed(d * 24 < 10 ? 1 : 0) + ' hours'; return d.toFixed(d < 10 ? 1 : 0) + ' days'; }
  var PRESETS = [['1w', '1 week', 7, '1 week'], ['3w', '3 weeks', 21, '3 weeks'], ['6w', '6 weeks', 42, '6 weeks'], ['fit', 'biggest that fits', 0, 'biggest']];
  X.applyPreset = function (id) {
    var G = X.G, ui = X.ui, pd = null, p = PRESETS.filter(function (x) { return x[0] === id; })[0];
    if (!p) return;
    pd = id === 'fit' ? G.biggestFits(ui.pool) : G.presetDesign(p[2], ui.pool);
    if (!pd) return;
    ui.params = pd.params; ui.recipe = true; ui.tokens = G.recipeTokens(pd.params); ui.gpusTouched = false; ui.preset = id;
    X.syncDesignerInputs(); X.renderDesigner(); ui.chartDirty = true;
  };
  X.renderDesigner = function () {
    var G = X.G, S = X.S, F = X.F, CFG = X.CFG, ui = X.ui, d = X.currentDesign(), dv = G.derived();
    X.setText('d-params-v', F.size(d.N) + ' model');
    X.setText('d-tokens-v', F.size(d.D) + ' tokens' + (ui.recipe ? '' : ' · recipe ' + F.size(d.recipeD)));
    X.setHTML('d-presets', PRESETS.map(function (p) { return '<button type="button" class="chip' + (ui.preset === p[0] ? ' on' : '') + '" data-preset="' + p[0] + '" aria-pressed="' + (ui.preset === p[0]) + '">' + (p[1] === p[3] ? p[1] : '<span class="lg-only">' + p[1] + '</span><span class="sh-only">' + p[3] + '</span>') + '</button>'; }).join(''));
    var chips = dv.pools.map(function (p) {
      var rb = S.active.filter(function (r) { return r.pool === p.key; })[0];
      var nm = { office: 'Office', cloud: 'Rented', a100: 'A100s', meridian: 'Meridian' }[p.key];
      return '<button type="button" class="chip' + (p.key === ui.pool && !rb ? ' on' : '') + '" data-pool="' + p.key + '"' + (p.count > 0 && !rb ? '' : ' disabled') + ' aria-pressed="' + (p.key === ui.pool) + '">' + nm + ' <span class="num">' + (rb ? 'run ' + rb.id : p.count) + '</span></button>';
    }).join('');
    var multi = dv.pools.filter(function (p) { return p.count > 0 || S.active.some(function (r) { return r.pool === p.key; }); }).length > 1;
    X.setHTML('d-pools', multi ? chips : '');
    var g = $('d-gpus'), avail = d.avail, step = avail >= 16 ? 8 : 1;
    if (+g.max !== Math.max(1, avail)) g.max = Math.max(1, avail);
    if (+g.min !== Math.min(step, Math.max(1, avail))) g.min = Math.min(step, Math.max(1, avail));
    if (+g.step !== step) g.step = step;
    if (document.activeElement !== g || !ui.pointerDown) g.value = d.cards;
    g.disabled = avail <= 1 || !!S.flags.fullCluster;
    X.setText('d-gpus-v', d.cards + ' of ' + avail);
    var vsLine = (d.L / d.line - 1) * 100, sh = G.shortOf(d.C);
    var land = isFinite(d.days) ? (d.landDay >= CFG.endDay ? 'after 31 DEC' : 'lands ' + F.date(d.landDay)) : 'no cards';
    var read =
      '<div class="rd"><span class="k">Takes</span><span class="v">' + daysWord(d.days) + '</span><span class="s">' + esc(land) + '</span></div>' +
      '<div class="rd"><span class="k">Costs</span><span class="v">' + esc(F.money(d.cost)) + '</span><span class="s">' + (isFinite(d.runwayAtLand) ? F.months(d.runwayAtLand) + ' months until broke after' : 'for the cards') + '</span></div>' +
      '<div class="rd"><span class="k"><span class="lg-only">Error score</span><span class="sh-only">Error</span></span><span class="v">' + d.L.toFixed(2) + '</span><span class="s">' + (Math.abs(vsLine) < 0.05 ? 'on the line' : (vsLine > 0 ? '+' : '') + vsLine.toFixed(1) + '% vs the line') + (d.sigUp > 0.003 ? ' · risk +' + (d.sigUp * 200).toFixed(1) + '%' : '') + '</span></div>' +
      '<div class="rd"><span class="k"><span class="lg-only">Short of GPT-3</span><span class="sh-only">Short</span></span><span class="v">' + (sh <= 1.05 ? 'passed it' : esc(F.ratio(sh))) + '</span><span class="s">if it lands as projected</span></div>';
    X.setHTML('d-read', read);
    var w = d.warn.slice();
    if (!w.length && !d.block) w.push({ bad: false, ok: true, t: 'Fits on the cards, clean data, inside what you have measured.' });
    X.setHTML('d-warn', w.map(function (x) { return '<li class="' + (x.bad ? 'bad' : x.ok ? 'ok' : '') + '">' + esc(x.t) + '</li>'; }).join(''));
    var btn = $('d-launch'), note = '';
    var can = !d.block && !S.over && !S.pending;
    btn.disabled = !can;
    var firstBad = d.warn.filter(function (x) { return x.bad; })[0];
    if (d.block && S.active.some(function (r) { return r.pool === d.pool; })) note = d.block + ' Pick other cards or wait for it to land.';
    else if (d.block) note = d.block === 'Memory limit' ? 'Too big to fit: shrink the model.' : d.block;
    else if (firstBad) note = firstBad.t;
    else if (!S.runs.length) note = 'Idle cards earn nothing. This one shows where you stand against the line.';
    else note = (d.landDay >= CFG.endDay ? 'Lands after New Year' : 'Lands ' + F.date(d.landDay)) + (d.r > 1 ? ' · past the data wall' : '') + '.';
    X.setText('d-note', note); $('d-note').classList.toggle('warn', !!(d.block || firstBad));
    $('opt-run').classList.toggle('locked', !can && !!d.block);
    btn.classList.toggle('pulse', can && !S.runs.length && !S.active.length && ui.runClock > 30);
    // the numbers behind it: one tap down
    X.setHTML('d-detail-b', '<div class="dz-num"><span>Compute</span><b class="num">' + esc(F.sci(d.C)) + ' FLOPs</b></div><div class="dz-num"><span>In training-speed terms</span><b class="num">' + (d.C / CFG.pfDay).toFixed(d.C / CFG.pfDay < 10 ? 2 : 0) + ' PF-days</b></div><div class="dz-num"><span>Model size × text × 6</span><b class="num">' + esc(F.size(d.N)) + ' × ' + esc(F.size(d.D)) + ' × 6</b></div><div class="dz-num"><span>Error score on the line</span><b class="num">' + d.line.toFixed(3) + ' nats</b></div><div class="dz-num"><span>Projected</span><b class="num">' + d.L.toFixed(3) + ' nats</b></div>');
    ui.design = d;
  };

  X.designerInit = function () {
    $('d-params').addEventListener('input', function (e) { var ui = X.ui; ui.params = niceN(fromSlider(+e.target.value, LOGN)); ui.preset = null; if (ui.recipe) { ui.tokens = X.G.recipeTokens(ui.params); $('d-tokens').value = toSlider(ui.tokens, LOGD); } X.renderDesigner(); ui.chartDirty = true; });
    $('d-tokens').addEventListener('input', function (e) { var ui = X.ui; ui.tokens = niceN(fromSlider(+e.target.value, LOGD)); ui.recipe = false; ui.preset = null; $('d-recipe').checked = false; X.renderDesigner(); ui.chartDirty = true; });
    $('d-recipe').addEventListener('change', function (e) { var ui = X.ui; ui.recipe = e.target.checked; if (ui.recipe) { ui.tokens = X.G.recipeTokens(ui.params); $('d-tokens').value = toSlider(ui.tokens, LOGD); } X.renderDesigner(); ui.chartDirty = true; });
    $('d-gpus').addEventListener('input', function (e) { var ui = X.ui; ui.gpus = +e.target.value; ui.gpusTouched = true; ui.preset = null; X.renderDesigner(); ui.chartDirty = true; });
  };
})(window.FX);
