/* FRONTIER control room, build A: the folded rows. Each row shows one live figure when folded and opens in place.
   Cluster, Team, Money, Data, Rivals and news, Models. The run designer and the live runs sit under the curve. */
(function () {
  'use strict';
  var FX = window.FX, CFG = FX.CFG, W = FX.W, FE = FX.FE, AU = FX.AU, $ = FX.$, ui = FX.ui;
  var fmtMoney = FE.fmtMoney, sci = FE.sci, bigNum = FE.bigNum, pct = FE.pct, log10 = FE.log10, clamp = FE.clamp;
  var esc = FX.esc, money = FX.money, setHTML = FX.setHTML, setText = FX.setText, btn = FX.btn;
  function E() { return FX.E; }
  function S() { return FX.S; }
  function nice(m) { return FX.fmtRunway(m); }
  function ago(day) { var d = Math.floor(S().day - day); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; }
  function weeks(d) { return d < 14 ? Math.round(d) + ' days' : Math.round(d / 7) + ' weeks'; }
  function longTime(days) { if (!isFinite(days)) return 'never'; if (days >= 730) return Math.round(days / 365) + ' years'; if (days >= 60) return Math.round(days / 30.4) + ' months'; return Math.round(days) + ' days'; }
  function revealOnce(key, el) { if (!el || ui.seen[key]) return; ui.seen[key] = true; el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); setTimeout(function () { el.classList.remove('fresh'); }, 700); }
  function kvt(rows) { var h = '<div class="kvt">'; rows.forEach(function (r) { h += '<span class="' + (r.cls || '') + '">' + r.k + '</span><span class="r ' + (r.cls || '') + '">' + r.v + '</span>'; }); return h + '</div>'; }

  /* ================= the run designer ================= */
  var N_LO = log10(CFG.designer.nMin), N_HI = log10(CFG.designer.nMax), D_LO = log10(CFG.designer.dMin), D_HI = log10(CFG.designer.dMax);
  function nToV(N) { return Math.round((log10(N) - N_LO) / (N_HI - N_LO) * 1000); }
  function vToN(v) { return Math.pow(10, N_LO + v / 1000 * (N_HI - N_LO)); }
  function dToV(D) { return Math.round((log10(D) - D_LO) / (D_HI - D_LO) * 1000); }
  function vToD(v) { return Math.pow(10, D_LO + v / 1000 * (D_HI - D_LO)); }
  function recipeForD(D) { var C = CFG.gpt3.C * Math.pow(D / CFG.gpt3.D, 1 / CFG.tokExp); return { N: C / (6 * D), D: D, C: C }; }
  var POOL_SHORT = { office: 'Your cards', a100: 'Your A100s', cloud: 'Rented', meridian: 'Meridian' };

  FX.syncDesignerInputs = function () {
    var free = E().poolFree(ui.des.pool);
    var g = $('d-gpus'); g.max = String(Math.max(0, free)); if (ui.des.gpusMax || ui.des.gpus > free) ui.des.gpus = free; g.value = String(ui.des.gpus);
    $('d-n').value = String(nToV(ui.des.N)); $('d-d').value = String(dToV(ui.des.D)); $('d-recipe').checked = ui.des.recipe;
  };
  function bestPool() { var bp = null, bf = 0; CFG.pools.forEach(function (p) { var f = E().poolFree(p) * E().cardFlops(p); if (f > bf) { bf = f; bp = p; } }); return bp; }

  function renderDesigner() {
    var e = E(), s = S();
    if (e.poolFree(ui.des.pool) < 1) { var bp = bestPool(); if (bp && bp !== ui.des.pool) { ui.des.pool = bp; ui.des.gpusMax = true; FX.syncDesignerInputs(); } }
    var pools = '', having = CFG.pools.filter(function (p) { return e.poolInfo(p).total > 0; });
    if (having.length > 1) {
      having.forEach(function (p) { var i = e.poolInfo(p); pools += '<button type="button" data-act="pool" data-pool="' + p + '" data-k="pool-' + p + '" aria-pressed="' + (ui.des.pool === p) + '"><span>' + POOL_SHORT[p] + '</span><b>' + i.free + ' free</b></button>'; });
    } else { var i0 = e.poolInfo('office'); pools = i0.free ? '' : '<div class="dz-one">All ' + i0.total + ' of your cards are busy. Pick a size and start it when one frees up, or add cards.</div>'; }
    setHTML($('d-pools'), pools);
    var free = e.poolFree(ui.des.pool), g = $('d-gpus');
    if (String(Math.max(0, free)) !== g.max) g.max = String(Math.max(0, free));
    if (ui.des.gpusMax || ui.des.gpus > free) { ui.des.gpus = free; if (document.activeElement !== g) g.value = String(free); }
    setText($('o-gpus'), String(ui.des.gpus)); setText($('o-n'), bigNum(ui.des.N)); setText($('o-d'), bigNum(ui.des.D));
    var p = e.design({ pool: ui.des.pool, gpus: ui.des.gpus, params: ui.des.N, tokens: ui.des.D });
    ui.lastDesign = p;
    var vsLine = p.proj / p.line - 1, shortTxt = e.shortFmt(e.shortOf(p.C));
    var out = '<div class="kv"><span class="k">Takes</span><span class="v">' + (isFinite(p.daysAll) ? FX.days(p.daysAll) : '—') + '</span><span class="s">lands ' + p.landTxt + '</span></div>' +
      '<div class="kv"><span class="k">Costs</span><span class="v">' + (isFinite(p.cost) ? money(p.cost) : '—') + '</span><span class="s">' + (p.paydays ? p.paydays + ' payday' + (p.paydays === 1 ? '' : 's') + ' inside' : 'no payday inside') + '</span></div>' +
      '<div class="kv"><span class="k">Error score</span><span class="v">' + p.proj.toFixed(2) + '</span><span class="s">' + p.lo.toFixed(1) + ' to ' + p.hi.toFixed(1) + ' expected</span></div>' +
      '<div class="kv"><span class="k">Gets you to</span><span class="v">' + shortTxt + '</span><span class="s">short of GPT-3</span></div>' +
      '';
    setHTML($('d-out'), out);
    var wl = '';
    p.blockers.forEach(function (b) { wl += '<li class="bad">' + esc(b) + '</li>'; });
    p.warns.forEach(function (w) { wl += '<li class="' + w.lvl + '">' + esc(w.t) + '</li>'; });
    var capTxt = p.caps.filter(function (c) { return !c.fired && (c.likely || c.maybe); }).map(function (c) { return (c.id === 'paragraph' ? 'paragraphs' : c.id === 'arithmetic' ? 'arithmetic' : c.id === 'translation' ? 'translation' : 'code') + (c.likely ? ' (likely)' : ' (maybe)'); });
    if (capTxt.length && p.ok) wl += '<li class="good">It could learn ' + esc(capTxt.join(', ')) + '.</li>';
    if (p.ok && !s.raise.aDone && p.C >= s.raise.aNeed) wl += '<li>Far enough for a Series A, if it lands on the line and you have a clean result a tenfold back.</li>';
    if (p.ok && !p.relevance) wl += '<li>Too small to keep the world remembering you (about ' + (e.forgotten().days ? Math.round(e.forgotten().days) + ' days of your cluster' : 'more') + ' is the least that counts).</li>';
    setHTML($('d-warn'), wl);
    var lb = $('d-launch');
    if (s.phase === 'over') { lb.disabled = false; lb.dataset.act = 'newyear'; setText(lb, 'Play another 2020'); }
    else { lb.dataset.act = 'launch'; lb.disabled = !p.ok || e.blocked(); setText(lb, p.ok ? 'Start the run · lands ' + p.landTxt : 'Can’t start: ' + (p.blockers[0] || '').split(':')[0].toLowerCase()); }
    // the numbers, one tap down
    $('d-adv').hidden = !ui.details;
    if (ui.details) {
      $('d-det').hidden = false;
      setHTML($('d-det'), kvt([
        { k: 'Compute', v: sci(p.C) + ' FLOPs (' + (p.pfdays >= 1 ? Math.round(p.pfdays).toLocaleString('en-US') : p.pfdays.toFixed(2)) + ' PF-days)' },
        { k: 'Model size', v: bigNum(p.N) + ' parameters, fits up to ' + bigNum(p.maxN) },
        { k: 'Text to read', v: bigNum(p.D) + ' tokens (' + p.tokPerParam.toFixed(0) + ' per parameter)' },
        { k: 'Speed', v: p.cards + ' ' + CFG.card[p.type].label + (p.cards === 1 ? '' : 's') + ', ' + Math.round(p.eff * 100) + '% scaling, ' + (p.perDay / 8.64e19).toFixed(2) + ' PF-days a day' },
        { k: 'Error score on the line', v: p.line.toFixed(3) + ' nats; expected ' + p.proj.toFixed(3) },
        { k: 'Months until broke when it lands', v: (isFinite(p.runwayAtLand) ? nice(p.runwayAtLand) : 'no limit') + ' (bank ' + (isFinite(p.bankAtLand) ? money(p.bankAtLand) : '—') + ')' },
        { k: 'Text vs the data wall', v: bigNum(p.D) + ' of ' + bigNum(p.wallLo) + ' to ' + bigNum(p.wallHi) },
        { k: 'Hangs expected', v: p.expHangs.toFixed(1) + ', ~' + p.expLost.toFixed(1) + ' days lost' }
      ]));
    } else $('d-det').hidden = true;
    setText($('d-more'), ui.details ? 'Hide the numbers' : 'Show the numbers');
    $('d-more').setAttribute('aria-expanded', String(ui.details));
    ui.chartDirty = true;
  }
  // quick sizes: the biggest on-recipe run that fits memory, stays inside the low end of the wall estimate and lands in time
  function applyPreset(kind) {
    var e = E(), s = S(), pool = ui.des.pool, free = e.poolFree(pool); if (free < 1) return false;
    var cards = ui.des.gpusMax ? free : (ui.des.gpus || free), perDay = cards * e.cardFlops(pool) * e.scaleEff(cards);
    var Cmem = e.recipeForN(e.maxParams(pool, cards) * 0.995).C;
    var Cdata = CFG.gpt3.C * Math.pow(s.wallLo * 0.95 / CFG.gpt3.D, 1 / CFG.tokExp);
    var daysLeft = Math.max(0.25, 365.9 - s.day), target = kind === 'mem' ? daysLeft * 0.97 : Math.min(+kind, daysLeft * 0.97);
    var C = Math.max(1e15, Math.min(perDay * target / 1.08, Cmem, Cdata));
    setDesignC(C);
    return true;
  }
  function setDesignC(C) {
    var r = E().recipeForC(C);
    ui.des.N = clamp(r.N, CFG.designer.nMin, CFG.designer.nMax); ui.des.D = clamp(r.D, CFG.designer.dMin, CFG.designer.dMax);
    $('d-n').value = String(nToV(ui.des.N)); $('d-d').value = String(dToV(ui.des.D));
    renderDesigner();
  }
  // set the designer to reach a target compute (from a rung): as close as memory and the wall estimate allow
  function presetFor(target) {
    var e = E(), s = S(), pool = bestPool() || ui.des.pool; ui.des.pool = pool; ui.des.gpusMax = true; FX.syncDesignerInputs();
    var cards = e.poolFree(pool);
    var Cmem = e.recipeForN(e.maxParams(pool, Math.max(1, cards)) * 0.995).C, Cdata = CFG.gpt3.C * Math.pow(s.wallLo * 0.95 / CFG.gpt3.D, 1 / CFG.tokExp);
    var daysLeft = Math.max(0.25, 365.9 - s.day), perDay = cards * e.cardFlops(pool) * e.scaleEff(Math.max(1, cards));
    setDesignC(Math.max(1e15, Math.min(target * 1.08, Cmem, Cdata, perDay * daysLeft * 0.97 / 1.08)));
  }
  FX.applyPreset = applyPreset;

  // rung 1: the "3 weeks" run on every card, and the clock starts
  function quickStart() {
    var e = E(), pool = bestPool();
    if (!pool) { FX.scrollToEl($('designer')); return { ok: false }; }
    ui.des.pool = pool; ui.des.gpusMax = true; FX.syncDesignerInputs(); applyPreset('21');
    var r = FX.doAct('launch', { params: ui.des.N, tokens: ui.des.D, gpus: ui.des.gpus, pool: ui.des.pool }, $('d-launch'));
    if (r.ok) { AU.launch(); AU.vibrate(10); if (ui.speed === 0) FX.setSpeed(1); ui.des.gpusMax = true; FX.syncDesignerInputs(); FX.scrollToEl($('curve')); }
    else FX.scrollToEl($('designer'));
    return r;
  }

  /* ================= live runs and what the model says ================= */
  function renderRuns() {
    var e = E(), s = S(), act = e.activeRuns(), h = '';
    act.forEach(function (r) {
      var type = e.poolType(r.pool), perDay = r.cards * CFG.card[type].flops * e.scaleEff(r.cards), left = perDay > 0 ? (r.C - r.done) / perDay : Infinity;
      var hangLeft = r.hang ? r.hang.left : 0, landTxt = isFinite(left) ? e.fmtDay(s.day + left + hangLeft) : 'no cards';
      var unread = r.ckpts.filter(function (k) { return !k.read; }).length;
      var armed = ui.stopArm && ui.stopArm.id === r.id && performance.now() - ui.stopArm.t < 3500;
      h += '<div class="run' + (r.hang ? ' hung' : '') + '" data-k="run' + r.id + '">' +
        '<div class="r1"><b>' + esc(e.modelName(r)) + ' <span class="dim">· run ' + r.id + '</span></b><span class="pc">' + Math.round(r.q * 100) + '%</span></div>' +
        '<div class="bar"><i style="width:' + (r.q * 100).toFixed(1) + '%"></i></div>' +
        '<div class="r2">' + (r.hang ? '<span class="bad">dropped: back in ' + FX.days(Math.max(0.05, r.hang.left)) + '</span>' : isFinite(left) ? '<span>' + FX.days(left + hangLeft) + ' to go</span><span>lands ' + landTxt + '</span>' : '<span class="bad">stalled: no free cards</span>') + '<span>' + r.cards + ' cards</span>' +
        (r.hangs.length ? '<span class="cau">' + r.hangs.length + ' drop' + (r.hangs.length > 1 ? 's' : '') + '</span>' : '') + (r.nans.length ? '<span class="cau">' + r.nans.length + ' blow-up' + (r.nans.length > 1 ? 's' : '') + '</span>' : '') + '</div>' +
        '<div class="r3">' + btn('sample', 'Read what it says' + (unread ? ' (' + unread + ' new)' : ''), ' data-id="' + r.id + '"', unread ? 'pri' : '', !r.ckpts.length, 'smp' + r.id) +
        (function () { var mt = e.moveTarget(r); return mt ? btn('move', 'Move to ' + mt.cards + ' ' + POOL_SHORT[mt.pool].toLowerCase() + (isFinite(mt.speedup) ? ' (x' + mt.speedup.toFixed(1) + ' faster)' : ''), ' data-id="' + r.id + '"', 'pri', false, 'mv' + r.id) : ''; })() +
        btn('abort', armed ? 'Sure? Save it now' : 'Stop early', ' data-id="' + r.id + '"', 'warn', false, 'ab' + r.id) + '</div></div>';
    });
    if (!act.length) {
      var dr = e.idleDrip();
      h = s.runs.length === 0
        ? '<div class="empty"><b>Nothing is training.</b> The clock is paused. Tap <b>Start a training run</b> above, or plan your own run.</div>'
        : '<div class="empty"><b>Nothing is training.</b> ' + (dr.cards ? dr.cards + ' idle cards still cost ' + money(dr.perDay) + ' a day. ' : '') + 'Plan the next run.</div>';
    }
    setHTML($('runs'), h);
    var sm = s.lastSample, sh = '';
    if (sm) {
      var crawl = sm.amt === e.CRAWL, run = e.runById(sm.run);
      sh = '<div class="sh"><span>' + esc(run ? e.modelName(run) : 'Run ' + sm.run) + ' says, ' + (sm.q >= 1 ? 'finished' : 'at ' + Math.round(sm.q * 100) + '%') + '</span><span>' + (sm.tier < 3 ? 'too early to judge the data' : crawl ? '<span class="bad">web crawl: past the data wall</span>' : sm.amt > 0 ? '<span class="cau">' + sm.amt + ' junk fragment' + (sm.amt > 1 ? 's' : '') + ': the text is running thin</span>' : 'clean') + '</span></div>' +
        '<p class="st2' + (crawl ? ' crawl' : '') + '">' + FX.sampleHTML(sm.text) + '</p>';
    } else sh = '<div class="sh"><span>What the model says</span></div><p class="hint">Once a run has saved something, read it here. The words get better as the error score falls. Web junk inside a sentence means the text is running out.</p>';
    setHTML($('sample'), sh);
  }

  /* ================= Cluster ================= */
  function renderCluster() {
    var e = E(), s = S();
    var sp = e.trainingSpeed(), spTxt = 'x' + (sp >= 100 ? Math.round(sp) : sp.toFixed(1));
    setText($('s-cluster'), spTxt + ' training speed');
    if (!ui.open.cluster) return;
    var wait = e.gpt3Wait(), bu = e.busyUseful(), drip = e.idleDrip(), hl = e.hangLine();
    var h = '<div class="speed"><b class="big">' + spTxt + '</b><span>training speed</span></div><div class="sub">At this speed GPT-3 takes ' + longTime(wait) + '. More cards, not more patience.</div>';
    h += '<div class="meter"><div class="mr"><span>Busy</span><div class="mb"><i style="width:' + (bu.busy * 100).toFixed(1) + '%"></i></div><b>' + Math.round(bu.busy * 100) + '%</b></div>' +
      '<div class="mr"><span>Useful</span><div class="mb u"><i style="width:' + Math.min(100, bu.useful * 100).toFixed(1) + '%"></i><u style="left:' + (bu.mfu * 100) + '%"></u></div><b>' + Math.round(bu.useful * 100) + '%</b></div>' +
      '<div class="mn">2020 cards manage about a third of their peak (the tick at 32%). Busy is not the same as useful.</div></div>';
    if (drip.cards > 0) h += '<div class="drip">' + drip.cards + ' idle card' + (drip.cards === 1 ? '' : 's') + ', ' + money(drip.perDay) + ' a day going nowhere.</div>';
    if (hl) h += '<div class="hang">Node ' + hl.node + ' dropped, rolled back ' + hl.rewindH + ' hours, ' + money(hl.dollars) + ' gone.' + (hl.infra ? '' : ' An infra person would catch it in minutes.') + '</div>';
    var rentedDay = e.rentPrice() * 24, ownedDay = e.ownedCardDay();
    h += '<div class="onecard">One card, one day: <b>' + money(rentedDay) + '</b> rented, about <b>' + money(ownedDay) + '</b> owned. Owning wins if it is busy more than <b>' + Math.round(ownedDay / rentedDay * 100) + '%</b> of the time.</div>';
    if (s.orders.length) {
      h += '<div class="trucks">';
      s.orders.forEach(function (o, i) {
        var frac = clamp((s.day - o.ordered) / Math.max(1, o.arrive - o.ordered), 0, 1), inD = Math.max(0, o.arrive - s.day);
        h += '<div class="truck" data-k="truck' + i + '"><div class="tt"><b>' + o.cards + ' ' + CFG.card[o.type].label + 's</b>, ' + money(o.price) + ' paid, lands ' + e.fmtDay(o.arrive) + ', in ' + weeks(inD) + '</div><div class="rail"><i style="width:' + (frac * 100).toFixed(1) + '%"></i><span class="tr" style="left:' + (frac * 100).toFixed(1) + '%" aria-hidden="true"></span></div></div>';
      });
      h += '</div>';
    }
    var sh = s.runs.some(function (r) { return r.state === 'landed'; }) ? e.shelf() : null;
    if (sh) {
      h += '<div class="shelfitem" data-k="shelf"><div class="si-h"><b>' + sh.units + ' ' + sh.label + (sh.units > 1 ? 's' : '') + '</b> <span class="dim">(' + sh.cards + ' ' + CFG.card[sh.type].label + 's)</span>' + (sh.isNew ? ' <span class="newtag">NEW</span>' : '') + '</div>' +
        '<div class="si-s">' + money(sh.cost) + ', ' + money(sh.short) + ' short' + (sh.effect ? '. A run like your last one: ' + FX.days(sh.effect.now) + ' now, ' + FX.days(sh.effect.with) + ' with it.' : '.') + (sh.monthsAfter != null ? ' Buying leaves ' + nice(sh.monthsAfter) + ' months until broke.' : '') + '</div></div>';
    }
    // rent cards
    var price = e.rentPrice(), cap = e.rentCap(), have = e.rentedCount(), room = Math.max(0, cap - have);
    ui.rentN = clamp(ui.rentN, 8, Math.max(8, room));
    var monthly = ui.rentN * price * 24 * CFG.daysPerMonth;
    h += '<div class="blk" id="rent-block"><h4>Rent cards <span>V100, $' + price.toFixed(2) + ' an hour each</span></h4><div class="mk">';
    if (s.mer) h += '<div class="mkrow"><span class="txt">Renting is closed: you signed with Meridian, so no other cloud.</span></div>';
    else h += '<div class="mkrow"><span class="txt">Live tomorrow, billed by the hour, 30-day terms. The broker has <b>' + room + '</b> of ' + cap + ' left. ' + ui.rentN + ' cost <b>' + money(monthly) + ' a month</b>.</span>' +
      '<span class="stepper"><button type="button" data-act="step" data-s="rent" data-d="-8" data-k="rent-m" aria-label="Fewer cards">−</button><span class="val">' + ui.rentN + '</span><button type="button" data-act="step" data-s="rent" data-d="8" data-k="rent-p" aria-label="More cards">+</button></span>' +
      btn('rent', 'Rent', '', 'pri', room < 8 || s.phase !== 'play', 'rent') + '</div>';
    s.rentals.forEach(function (r) {
      var live = s.day >= r.start;
      h += '<div class="mkrow" data-k="rental-' + r.id + '"><span class="txt">' + r.n + ' rented · $' + r.price.toFixed(2) + '/h · ' + (live ? '' : 'live ' + e.fmtDay(r.start) + ' · ') + (r.cancel || r.noRenew ? '<span class="cau">ends ' + e.fmtDay(r.end) + '</span>' : 'renews ' + e.fmtDay(r.end)) + '</span>' +
        (r.noRenew && !r.cancel ? '' : btn('cancelRent', r.cancel ? 'Keep' : 'Cancel', ' data-id="' + r.id + '"', '', s.phase !== 'play', 'cr-' + r.id)) + '</div>';
    });
    h += '</div></div>';
    // buy cards
    h += '<div class="blk"><h4>Buy cards <span>yours for good, but they arrive late</span></h4><div class="mk">';
    ['dgx1', 'dgxa100'].forEach(function (item) {
      var spec = CFG.buy[item], from = e.D(spec.from), u = ui.buy[item], unit = e.buyPrice(item, s.day), lead = e.leadFor(item, s.day);
      if (s.day < from) { h += '<div class="mkrow"><span class="txt"><b>' + spec.label + '</b> comes to market on ' + e.fmtDay(from) + '.</span></div>'; return; }
      var arrive = Math.floor(s.day) + lead, total = unit * u;
      h += '<div class="mkrow"><span class="txt"><b>' + spec.short + '</b> (' + spec.cards + ' ' + CFG.card[spec.type].label + 's) ' + money(unit) + ' each. ' + u + ' = <b>' + money(total) + '</b>, ' + (spec.cards * u) + ' cards, here <b>' + (arrive > 365 ? 'next year' : e.fmtDay(arrive)) + '</b> (' + Math.round(lead / 7) + ' weeks). Upkeep $' + CFG.upkeepPerCard + ' a card a month.</span>' +
        '<span class="stepper"><button type="button" data-act="step" data-s="' + item + '" data-d="-1" data-k="' + item + '-m" aria-label="Fewer">−</button><span class="val">' + u + '</span><button type="button" data-act="step" data-s="' + item + '" data-d="1" data-k="' + item + '-p" aria-label="More">+</button></span>' +
        btn('buy', 'Buy', ' data-item="' + item + '"', 'pri', total > s.bank || s.phase !== 'play', 'buy-' + item) + '</div>';
    });
    var idleOwn = e.poolFree('office'), idleA = e.poolFree('a100');
    if (idleOwn + idleA > 0) {
      var cashOut = idleOwn * CFG.rentOutPerHour.v100 * 24 * CFG.rentOutDays + idleA * CFG.rentOutPerHour.a100 * 24 * CFG.rentOutDays;
      h += '<div class="mkrow"><span class="txt"><b>Rent out idle cards</b>: ' + (idleOwn ? idleOwn + ' V100s' : '') + (idleOwn && idleA ? ' + ' : '') + (idleA ? idleA + ' A100s' : '') + ' for ' + CFG.rentOutDays + ' days brings <b>+' + money(cashOut) + '</b> now. They can’t train meanwhile.</span>' + btn('rentOut', 'Rent out', '', '', s.phase !== 'play', 'ro') + '</div>';
    }
    h += '</div></div>';
    // Meridian
    h += '<div class="blk"><h4>Meridian cloud <span>fictional</span></h4><div class="c2 mut">';
    if (s.mer) {
      var qa = s.day >= e.DAY.merQueue ? e.queueAlloc() : null;
      h += 'Signed ' + e.fmtDay(s.mer.signed) + ': ' + s.mer.cards + ' V100s' + (s.day < s.mer.live ? ', live ' + e.fmtDay(s.mer.live) : '') + '. Credits left ' + money(s.mer.credits) + '. Exclusive; they see every model ' + CFG.meridian.firstLookDays + ' days first.';
      if (s.day >= e.DAY.merQueue) h += ' Queue this month: <b class="' + (s.mer.alloc < s.mer.cards ? 'cau' : 'acc') + '">' + s.mer.alloc + '</b> cards' + (s.mer.allocWhy ? ' (' + esc(s.mer.allocWhy) + ')' : '') + '. Next 1st: <b class="' + (qa.n < s.mer.cards ? 'cau' : 'acc') + '">' + qa.n + '</b> (' + esc(qa.why) + ').';
      else h += ' Their queue starts 11 Jun: full cards if you are within ' + CFG.meridian.queueFull + 'x of the frontier, half within ' + CFG.meridian.queueHalf + 'x, else a quarter.';
      h += '</div><div class="mkrow" style="margin-top:6px"><span class="txt">Priority: always the full ' + s.mer.cards + ' cards for <b>' + money(CFG.meridian.priorityPerCardMonth * s.mer.cards) + ' a month</b> from your bank.</span>' + btn('priority', s.priority ? 'Stop priority' : 'Buy priority', '', s.priority ? '' : 'pri', s.phase !== 'play', 'prio') + '</div>';
    } else {
      var far = e.farthestClean();
      h += s.merOffered ? (s.merPassed ? 'You passed. ' + (s.mer2Offered ? 'Second offer passed too.' : 'A smaller offer (for 10% of FRONTIER) comes after 15 Jun.') : 'Offer pending.') :
        'Offers ' + (s.world.merCards) + ' V100s for exclusivity once you have a saved model about ' + e.shortFmt(e.shortOf(CFG.meridian.needC)) + ' short of GPT-3 or closer, and it is past 1 Apr. ' + (far ? 'Yours: ' + e.shortFmt(e.shortOf(far)) + ' short.' : 'You have none yet.');
      h += '</div>';
    }
    h += '</div></div>';
    setHTML($('b-cluster'), h);
  }

  /* ================= Team ================= */
  function initials(p) { var w = p.name.split(/[\s-]+/); return (w[0].charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase(); }
  function pips(n) { var s = ''; for (var i = 1; i <= 5; i++) s += i <= n ? '●' : '○'; return s; }
  function effectText(p) {
    var e = E(), s = S(), role = p.role, t = W.effects[role] || '', sk = e.effSkill(p);
    if (role === 'data') t = t.replace('{days}', String(e.filterDays() || '?'));
    if (role === 'systems') t = t.replace('{split}', String(e.split())).replace('{mem}', bigNum(1e9 * e.split()));
    if (role === 'scaling') t = t.replace('{blind}', String(Math.round(CFG.blind.shareScaling * 100)));
    if (role === 'infra') t = t.replace('{mult}', CFG.infraMult(sk).toFixed(2)).replace('{lost}', String(Math.round(CFG.hangLostInfra * 24)));
    if (role === 'evals') t = t.replace('{rt}', String(CFG.redTeamDays));
    if (role === 'optim') { var live = s.day - p.joined >= CFG.sunheeDelay; t = t.replace('{state}', live ? 'Now:' : 'From ' + e.fmtDay(p.joined + CFG.sunheeDelay) + ':'); }
    return t;
  }
  function candEffect(d) {
    var e = E();
    if (d.role === 'systems') return 'Would let one model spread over ' + Math.min(CFG.splitCap, e.split() * CFG.systemsSplit(d.skill)) + ' cards: the biggest that fits goes from ' + bigNum(1e9 * e.split()) + ' to ' + bigNum(1e9 * Math.min(CFG.splitCap, e.split() * CFG.systemsSplit(d.skill))) + ' parameters.';
    if (d.role === 'infra') return 'Cards drop out x' + CFG.infraMult(d.skill).toFixed(2) + ' as often; each drop costs hours, not most of a day.';
    if (d.role === 'data') return 'Cleans the crawl (+86% fresh text a job); two data people make jobs ~40% faster.';
    if (d.role === 'scaling') return 'Sees 100x past your biggest result (not 10x); blind runs go wrong ' + Math.round(CFG.blind.shareScaling * 100) + '% of the time, not ' + Math.round(CFG.blind.share * 100) + '%.';
    if (d.role === 'evals') return 'Catches test sets that leaked into the crawl; safety-tests releases (no scandal risk).';
    if (d.role === 'optim') return 'After 30 days every run lands 2.5% better than the line (~1.7x compute); halves blow-ups.';
    return '';
  }
  function assignment(p) {
    var e = E(), s = S();
    if (p.role === 'data') return s.filterJob && s.filterJob.who === p.key ? 'Cleaning the crawl: ' + Math.max(0, Math.ceil(s.filterJob.until - s.day)) + ' days left' : (s.filterJob ? 'Helping clean the crawl' : 'Checking every landing for junk');
    if (p.role === 'systems') return 'Spreading models across cards';
    if (p.role === 'scaling') return 'Reading how far your results can be trusted';
    if (p.role === 'infra') return p.key === 'tom' && s.day < s.tomOffUntil ? 'On a week off until ' + e.fmtDay(s.tomOffUntil) : 'On call · ' + s.hangsThisMonth + ' drop' + (s.hangsThisMonth === 1 ? '' : 's') + ' this month';
    if (p.role === 'evals') return s.redteam ? 'Safety-testing run ' + s.redteam.runId + ': ' + Math.max(0, Math.ceil(s.redteam.until - s.day)) + ' days left' : 'Testing every landing';
    if (p.role === 'optim') return 'Tuning learning-rate schedules';
    return '';
  }
  function tilesHTML(small) {
    var e = E(), s = S(), st = e.staff(), h = '';
    st.forEach(function (p) {
      var low = p.mood < CFG.moodLow;
      h += '<button type="button" class="tile' + (low ? ' low' : '') + (ui.sel === 'p:' + p.key ? ' sel' : '') + '" data-act="tile" data-sel="p:' + p.key + '" data-k="tile-' + p.key + '" aria-label="' + esc(p.name) + ', ' + W.roles[p.role] + ', morale ' + Math.round(p.mood) + '"><span class="ini">' + initials(p) + '</span><span class="mot"><i style="width:' + Math.round(p.mood) + '%"></i></span></button>';
    });
    var cands = s.cands.slice().sort(function (a, b) { return a.courtBy - b.courtBy; });
    if (small) { h += '<span class="tile plus" aria-hidden="true">+</span>'; return h; }
    var c = cands[0];
    if (c) {
      var d = W.people[c.key], req = e.candReq(c);
      h += '<button type="button" class="tile plus wide' + (req ? ' gated' : '') + (ui.sel === 'c:' + c.key ? ' sel' : '') + '" data-act="tile" data-sel="c:' + c.key + '" data-k="plus-' + c.key + '"><span class="pl">+</span><span class="pn">' + esc(d.name) + '</span><span class="pa">' + (req ? esc(gateText(c)) : 'asks ' + money(e.candAsk(c)) + ' a month') + '</span></button>';
    } else h += '<span class="tile plus wide empty" data-k="plus-none"><span class="pl">+</span><span class="pn">Nobody on the board</span><span class="pa">' + nextArrival() + '</span></span>';
    return h;
  }
  function gateText(c) { var d = W.people[c.key], e = E(); return d.name + ' needs reputation ' + d.needRep + ' (you have ' + Math.round(S().rep) + ')'; }
  function nextArrival() {
    var s = S(), e = E(), best = null; Object.keys(W.people).forEach(function (k) { var p = W.people[k]; if (!p.from) return; var d = e.D(p.from); if (d > s.day && (best == null || d < best.d) && !s.team.some(function (x) { return x.key === k; }) && !s.gone.some(function (g) { return g.key === k; })) best = { d: d, p: p }; });
    return best ? best.p.first + ' arrives ' + e.fmtDay(best.d) : 'no one else this year';
  }
  function renderTeam() {
    var e = E(), s = S(), st = e.staff();
    setHTML($('s-team'), '<span class="mini">' + st.map(function (p) { return '<span class="mt' + (p.mood < CFG.moodLow ? ' low' : '') + '">' + initials(p) + '</span>'; }).join('') + (s.cands.length ? '<span class="mt plus">+</span>' : '') + '</span>');
    if (!ui.open.team) return;
    var h = '<div class="tiles">' + tilesHTML(false) + '</div>';
    var sel = ui.sel;
    if (sel && sel.indexOf('p:') === 0) {
      var p = e.person(sel.slice(2));
      if (p) {
        var low = p.mood < CFG.moodLow, canRaise = s.day - p.lastRaise >= CFG.raiseCooldown, add = Math.round(p.salary * (CFG.raiseMult - 1) / 500) * 500;
        h += '<div class="card pc" data-k="pc-' + p.key + '"><div class="c1"><b>' + esc(p.name) + '</b><span class="num">' + money(p.salary) + ' a month</span></div>' +
          '<div class="c2">' + W.roles[p.role] + ' · skill <span class="pips">' + pips(p.skill) + '</span> · morale <span class="mood' + (low ? ' low' : '') + '"><i style="width:' + Math.round(p.mood) + '%"></i></span> <span class="mono' + (low ? ' bad' : '') + '">' + Math.round(p.mood) + '</span>' + (low ? ' <span class="bad">(disengaged: works at skill ' + e.effSkill(p) + ')</span>' : '') + '</div>' +
          '<div class="c2"><b class="mut">Now:</b> ' + esc(assignment(p)) + '</div><div class="c2">' + esc(effectText(p)) + '</div>' +
          '<div class="c3">' + btn('raisepay', 'Give a raise +' + money(add) + ' a month (morale +' + CFG.raiseMood + ')', ' data-id="' + p.key + '"', '', !canRaise || s.phase !== 'play', 'rp-' + p.key) + (!canRaise ? '<span class="dim">again from ' + e.fmtDay(p.lastRaise + CFG.raiseCooldown) + '</span>' : '') + '</div></div>';
      }
    } else if (sel && sel.indexOf('c:') === 0) {
      var c = e.candidate(sel.slice(2));
      if (c) {
        var d = W.people[c.key], ask = e.candAsk(c), req = e.candReq(c), left = Math.ceil(c.courtBy - s.day);
        h += '<div class="card pc" data-k="cc-' + c.key + '"><div class="c1"><b>' + esc(d.name) + '</b><span class="num">asks ' + money(ask) + ' a month</span></div>' +
          '<div class="c2">' + W.roles[d.role] + ' · skill <span class="pips">' + pips(d.skill) + '</span> · “' + esc(d.pitch) + '”</div><div class="c2">' + esc(candEffect(d)) + '</div>' +
          (req ? '<div class="why">' + esc(req) + '</div>' : '') +
          '<div class="c3">' + btn('hire', 'Hire for ' + money(ask) + ' a month · months until broke ' + nice(e.runway()) + ' → ' + nice(s.bank / Math.max(1, e.burn() + ask)), ' data-id="' + c.key + '"', 'pri', !!req || s.phase !== 'play', 'hire-' + c.key) +
          '<span class="dim">' + (left > 0 ? (c.key === 'sunhee' ? 'Halcyon' : 'Kestrel') + ' courts ' + (d.she ? 'her' : 'him') + ' in ' + left + ' days' : 'being courted') + '</span></div></div>';
      }
    }
    var others = s.cands.slice().sort(function (a, b) { return a.courtBy - b.courtBy; }).slice(1);
    if (others.length) h += '<div class="sec-l">Also on the board: ' + others.map(function (c) { return '<a href="#" data-act="tile" data-sel="c:' + c.key + '">' + esc(W.people[c.key].name) + '</a>'; }).join(', ') + '</div>';
    var gone = s.team.filter(function (p) { return p.gone; }).map(function (p) { return p.first + ' (' + e.fmtDay(p.goneDay) + (p.goneTo ? ', to ' + p.goneTo : '') + ')'; }).concat(s.gone.map(function (g) { return g.first + ' (never hired, to ' + g.to + ')'; }));
    if (gone.length) h += '<div class="c2 mut gone">Gone: ' + esc(gone.join(' · ')) + '</div>';
    setHTML($('b-team'), h);
  }

  /* ================= Money ================= */
  function renderMoney() {
    var e = E(), s = S(), b = e.burnParts(), burn = e.burn();
    var gross = b.base + b.salaries + b.upkeep + b.rent + b.priority;
    var sumEl = $('s-money'); setText(sumEl, burn > 0 ? '−' + money(burn).replace('−', '') + ' a month' : '+' + money(-burn) + ' a month'); FX.setClass(sumEl, 'neg', burn > 0); FX.setClass(sumEl, 'pos', burn <= 0);
    var landed = s.runs.some(function (r) { return r.state === 'landed'; });
    if (!ui.open.money) return;
    var people = b.salaries, cards = b.rent + b.upkeep + b.priority, office = b.base, tot = Math.max(1, people + cards + office);
    var h = '<div class="blk first"><h4>Spending a month <span class="neg">' + money(gross) + '</span></h4>' +
      '<div class="spend" role="img" aria-label="People ' + money(people) + ', cards ' + money(cards) + ', office ' + money(office) + '"><i class="p" style="flex:' + people + '"></i><i class="c" style="flex:' + cards + '"></i><i class="o" style="flex:' + office + '"></i></div>' +
      '<div class="spend-l"><span><i class="p"></i>People ' + money(people) + '</span><span><i class="c"></i>Cards ' + money(cards) + '</span><span><i class="o"></i>Office ' + money(office) + '</span></div></div>';
    // this month so far
    var m = s.month, inn = 0, out = 0; Object.keys(m.in).forEach(function (k) { inn += m.in[k]; }); Object.keys(m.out).forEach(function (k) { out += m.out[k]; });
    var income = s.stats.apiRevenue > 0 || s.stats.rentOutRevenue > 0 || e.apiMonthly() > 0;
    h += '<div class="blk"><h4>This month so far <span>since the 1st</span></h4><div class="inout"><div class="io"><span>Out</span><b class="neg">' + money(out) + '</b></div>' + (income ? '<div class="io"><span>In</span><b class="pos">' + money(inn) + '</b></div>' : '') + '</div>';
    if (income) {
      var apiM = e.apiMonthly(), mx = Math.max(gross, apiM, 1);
      h += '<div class="gapbar"><div class="gb out"><i style="width:' + (gross / mx * 100).toFixed(1) + '%"></i></div><div class="gb in"><i style="width:' + (apiM / mx * 100).toFixed(1) + '%"></i></div></div><div class="sub"><b class="pos">' + money(apiM) + ' a month in</b> against <b class="neg">' + money(gross) + ' out</b>. The gap is ' + money(Math.abs(gross - apiM)) + ' a month' + (apiM >= gross ? ', in your favour' : '') + '.</div>';
    } else h += '<div class="sub">Everything so far is money going out. Money coming in starts when you ship an API or rent out idle cards.</div>';
    if (s.lastPayroll) h += '<div class="sub dim">Payroll on ' + e.fmtDay(s.lastPayroll.day) + ' took ' + money(s.lastPayroll.pay) + '. Next one on the 1st.</div>';
    h += '</div>';
    // raise block, after the first plaque
    if (landed) {
      var rb = e.raiseBlock(), ownTxt = pct(s.stake, 0), nextName = rb.next === 'A' ? 'Series A' : rb.next === 'B' ? 'Series B' : 'a bridge note';
      h += '<div class="blk" id="raise-block"><h4>Raise <span>money from investors, paid for with ownership</span></h4>';
      h += '<div class="ownrow"><div class="ob"><span>You own</span><b>' + ownTxt + '</b></div><div class="ob"><span>Last round priced you at</span><b>' + money(rb.lastPost) + '</b></div>' +
        (rb.wouldPay != null ? '<div class="ob dimmed' + (rb.ok ? ' ok' : '') + '"><span>Investors would pay today</span><b>' + money(rb.wouldPay) + '</b></div>' : '') + '</div>';
      if (rb.desp < 0.999) h += '<div class="why">Short of money, so offers shrink: investors smell it. Today’s price is ' + Math.round((1 - rb.desp) * 100) + '% lower than when you are comfortable.</div>';
      if (rb.stakeAfter != null) h += '<div class="sub">The next raise (' + nextName + ') sells ' + pct(s.stake - rb.stakeAfter, 0) + ': you go from ' + ownTxt + ' to ' + pct(rb.stakeAfter, 0) + '.' + (rb.stakeAfter < 0.5 ? ' <b class="neg">Below 50% the board takes control and sells.</b>' : '') + '</div>';
      if (rb.why.length && rb.why[0] !== 'Raised.') h += '<div class="why">' + esc(rb.why[0]) + '</div>';
      h += '<div class="rows">';
      [['A', 'Series A'], ['B', 'Series B'], ['bridge', 'Bridge note (angels)']].forEach(function (x) {
        var st = e.roundStatus(x[0]), t = st.terms;
        var terms = x[0] === 'bridge' ? money(t.cash) + ' for ' + pct(t.stake) : money(t.cash) + ' at ' + money(t.post);
        h += '<div class="card' + (st.done ? ' off' : '') + '"><div class="c1"><b>' + x[1] + '</b><span class="num">' + terms + '</span></div>' +
          (st.done ? '<div class="c2">Raised.</div>' : '<div class="c2">You own ' + pct(s.stake, 1) + ' → ' + pct(st.stakeAfter, 1) + (st.diligence ? ' · investors check for ' + st.diligence + ' days first' : ' · cash today') + '</div>' +
          '<div class="c3">' + btn('pitch', x[0] === 'bridge' ? 'Take the note' : 'Pitch it', ' data-round="' + x[0] + '"', 'pri', !st.ok || s.phase !== 'play', 'pitch-' + x[0]) + '</div>') + '</div>';
      });
      h += '</div>';
      if (s.raise.rounds.length) h += '<div class="c2 mut">Raised so far: ' + s.raise.rounds.map(function (r) { return r.round + ' ' + e.fmtDay(r.day) + ' +' + money(r.cash); }).join(' · ') + '</div>';
      h += '</div>';
    }
    h += '<div class="blk"><h4>Cash this year <span>' + money(s.bank) + ' now</span></h4><canvas class="spark" id="spark-cash" aria-hidden="true"></canvas></div>';
    setHTML($('b-money'), h);
    var rbEl = $('raise-block'); if (rbEl) revealOnce('raise', rbEl);
    drawSpark();
  }
  function drawSpark() {
    var s = S(), cv = $('spark-cash'); if (!cv || !cv.offsetParent) return;
    var w = cv.clientWidth, hh = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, hh);
    var css = getComputedStyle(FX.root), acc = css.getPropertyValue('--accent').trim() || '#58e0c2', line = css.getPropertyValue('--line').trim() || '#222', bad = css.getPropertyValue('--danger').trim() || '#f55';
    var hist = s.cashHist.concat([s.bank]), mx = 1; hist.forEach(function (v) { mx = Math.max(mx, v); });
    c.strokeStyle = line; c.beginPath(); c.moveTo(0, hh - 0.5); c.lineTo(w, hh - 0.5); c.stroke();
    c.strokeStyle = s.bank < 0 ? bad : acc; c.lineWidth = 1.5; c.beginPath();
    hist.forEach(function (v, i) { var x = i / 365 * w, y = hh - 2 - Math.max(0, v) / mx * (hh - 4); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.stroke();
  }

  /* ================= Data ================= */
  function renderData() {
    var e = E(), s = S(), lo = s.wallLo, hi = s.wallHi, passes = CFG.passes;
    setText($('s-data'), 'fresh ' + bigNum(lo / passes) + ', wall ' + bigNum(lo) + '-' + bigNum(hi));
    if (!ui.open.data) return;
    var a = log10(1e9), z = log10(CFG.rawCrawl * 2);
    function px(v) { return clamp((log10(Math.max(v, 1e9)) - a) / (z - a) * 100, 0, 100); }
    var use = ui.lastDesign ? ui.lastDesign.D : 0;
    var f1 = px(lo / passes), f2 = px(hi / passes), w1 = px(lo), w2 = px(hi);
    var h = '<div class="blk first"><h4>The data wall <span>' + bigNum(lo) + ' to ' + bigNum(hi) + ' of text</span></h4>' +
      '<div class="wallbar" title="fresh, repeated, memorising"><i class="z fresh" style="left:0;width:' + f1 + '%"></i><i class="z fresh u" style="left:' + f1 + '%;width:' + Math.max(0.6, f2 - f1) + '%"></i><i class="z rep" style="left:' + f2 + '%;width:' + Math.max(0, w1 - f2) + '%"></i><i class="z mem u" style="left:' + w1 + '%;width:' + Math.max(0.8, w2 - w1) + '%"></i><i class="z mem" style="left:' + w2 + '%;width:' + Math.max(0, 100 - w2) + '%"></i>' +
      (use ? '<i class="use" style="left:' + px(use) + '%"></i>' : '') + '</div>' +
      '<div class="wl"><span class="f">fresh</span><span class="r">repeated up to ' + passes + ' times, still counted clean</span><span class="m">memorising</span></div>' +
      '<div class="sub">Your plan reads <b>' + bigNum(use || 0) + '</b> of text (the white mark). The hatched part is where the wall could be; the true wall is always inside it. Past it a run proves nothing, because the model just memorises web boilerplate.</div></div>';
    var ds = e.staff().filter(function (p) { return p.role === 'data'; });
    h += '<div class="blk" id="clean-block"><h4>Clean the crawl <span>' + s.filters + ' done</span></h4>';
    if (s.filterJob) h += '<div class="card"><div class="c1"><b>Cleaning the crawl</b><span class="num">' + Math.max(0, Math.ceil(s.filterJob.until - s.day)) + ' days left</span></div><div class="c2">Done ' + e.fmtDay(s.filterJob.until) + '. Fresh text +' + Math.round((e.filterMult(s.filters) - 1) * 100) + '%. Runs started before then keep the old data.</div></div>';
    else if (!ds.length) h += '<div class="why">Nobody to do it: you need a data person on the team.</div>';
    else h += '<div class="mkrow"><span class="txt">' + money(e.filterCost()) + ', ' + e.filterDays() + ' days, <b>+' + Math.round((e.filterMult(s.filters) - 1) * 100) + '% fresh text</b> (a bit less each time). Each job costs double the last one. Runs only see the clean data if they start after it finishes.</span>' + btn('filter', 'Clean the crawl', '', 'pri', s.phase !== 'play' || e.filterCost() > s.bank, 'filter-d') + '</div>';
    h += '</div>';
    h += '<div class="blk"><h4>What your samples told you</h4><div class="ev">';
    if (!s.evidence.length) h += '<div>Nothing yet. Every saved model you read, and every landing your data person checks, narrows the band.</div>';
    s.evidence.slice(0, 5).forEach(function (ev) { h += '<div><span class="d">' + e.fmtDay(ev.day) + '</span>Run ' + ev.run + ': ' + esc(ev.text) + (ev.changed ? ' <span class="chg">→ wall ' + bigNum(ev.lo) + '-' + bigNum(ev.hi) + '</span>' : '') + '</div>'; });
    h += '</div></div>';
    h += '<div class="blk"><h4>What it can learn <span>the error score each skill needs</span></h4>';
    var rows = [];
    s.caps.forEach(function (c) {
      var range = c.fired ? 'learned at ' + c.L.toFixed(2) : 'between ' + e.Lline(c.hi).toFixed(2) + ' and ' + e.Lline(c.lo).toFixed(2);
      if (c.id === 'code' && !c.fired) range = 'not seen in 2020';
      rows.push({ k: CFG.capNames[c.id] + ' <span class="dim">(' + CFG.capTests[c.id] + ')</span>', v: (c.fired ? '✓ ' : '') + range + (c.known ? ' <span class="bad">leaked</span>' : ''), cls: c.fired ? 'acc' : '' });
    });
    h += kvt(rows) + '</div>';
    setHTML($('b-data'), h);
  }

  /* ================= Rivals and news ================= */
  function renderNews() {
    var e = E(), s = S();
    var row = $('row-news');
    var visible = s.slips.length > 0;
    if (row.hidden === visible) { row.hidden = !visible; if (visible) revealOnce('news', row); }
    var st = e.standing();
    setText($('s-news'), 'you are #' + st.rank);
    if (!visible || !ui.open.news) return;
    var h = '<div class="blk first"><h4>Who is ahead <span>by biggest published or saved model</span></h4><div class="league">';
    if (st.gpt3) h += '<div class="lg pinned" data-k="lg-gpt3"><span class="nm">GPT-3 <i class="dim">real, 28 May</i></span><span class="sh">1x</span></div>';
    st.rows.forEach(function (r, i) {
      var arrow = r.trend > 0 ? '<i class="up" aria-label="grew since the 1st">▲</i>' : '<i class="flat">–</i>';
      h += '<div class="lg' + (r.you ? ' you' : '') + '" data-k="lg-' + r.key + '"><span class="rk">' + (i + 1) + '</span><span class="nm">' + esc(r.name) + (r.blurb ? ' <i class="dim">' + esc(r.blurb) + ', fictional</i>' : '') + '</span><span class="sh">' + (r.C > 0 ? e.shortFmt(e.shortOf(r.C)) + ' short' : 'nothing yet') + '</span>' + arrow + '</div>';
    });
    h += '</div>';
    var fg = e.forgotten();
    h += '<div class="trust"><span>Trust <b>' + Math.round(s.rep) + '</b> of 100</span><div class="mb"><i style="width:' + Math.round(s.rep) + '%"></i></div></div></div>';
    // decisions waiting and answered
    if (s.inbox.length || s.decided.length) {
      h += '<div class="blk inbox"><h4>Decisions <span>' + (s.inbox.length ? s.inbox.length + ' waiting' : 'all answered') + '</span></h4><div class="rows">';
      s.inbox.forEach(function (d) { h += '<div class="card" data-k="in-' + d.id + '"><div class="c1"><b>' + esc(d.title) + '</b><span class="num">' + e.fmtDay(d.day) + '</span></div><div class="c3">' + btn('openDecision', 'Decide', ' data-id="' + d.id + '"', 'pri', false, 'od-' + d.id) + '</div></div>'; });
      s.decided.slice(0, 4).forEach(function (d) { var o = d.options.filter(function (x) { return x.key === d.answered; })[0]; h += '<div class="c2 mut small"><span class="mono dim">' + e.fmtDay(d.answeredDay) + '</span> ' + esc(d.title) + ' → ' + esc(o ? o.label : d.answered) + '</div>'; });
      h += '</div></div>';
    }
    var f = ui.feed;
    h += '<div class="blk"><h4>News and your lab’s log</h4><div class="filters" role="group" aria-label="Filter the feed">' + [['all', 'All'], ['history', '2020'], ['lab', 'Lab'], ['money', 'Money'], ['people', 'People'], ['rival', 'Rivals']].map(function (x) { return '<button type="button" data-act="feed" data-f="' + x[0] + '" data-k="feed-' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><div class="feed">';
    var items = [];
    s.news.forEach(function (n) { items.push({ day: n.day, text: n.text, eff: n.effect, cls: n.real ? 'real' : 'money', cat: n.real ? 'history' : 'money', order: 1 }); });
    s.log.forEach(function (l, i) { var cat = l.kind === 'run' || l.kind === 'hang' || l.kind === 'data' || l.kind === 'cards' ? 'lab' : l.kind === 'bad' ? 'lab' : l.kind; items.push({ day: l.day, text: l.text, cls: l.kind, cat: cat, order: 2 + i / 1e4 }); });
    items.sort(function (a, b) { return b.day - a.day || b.order - a.order; });
    var n = 0;
    items.forEach(function (it) {
      if (n >= 50) return;
      if (f !== 'all' && it.cat !== f && !(f === 'lab' && it.cls === 'bad')) return;
      n++;
      h += '<div class="it ' + esc(it.cls) + '"><span class="d">' + e.fmtDay(it.day) + (it.cls === 'real' ? ' 2020 · history' : '') + '</span>' + esc(it.text) + (it.eff ? '<span class="eff">' + esc(it.eff) + '</span>' : '') + '</div>';
    });
    if (!n) h += '<div class="it">Nothing yet.</div>';
    h += '</div></div>';
    setHTML($('b-news'), h);
  }

  /* ================= Models: the plaque shelf ================= */
  var TEST_NAMES = { paragraph: 'Paragraphs', arithmetic: 'Arithmetic', translation: 'Translation', code: 'Code' };
  function testsHTML(run, full) {
    var e = E(), s = S(), h = '<div class="tests">';
    run.evals.forEach(function (ev) {
      var c = s.caps.filter(function (x) { return x.id === ev.id; })[0], on = ev.pass;
      var grey = !on, txt = TEST_NAMES[ev.id];
      var rg = e.Lline(c.hi).toFixed(1) + ' to ' + e.Lline(c.lo).toFixed(1);
      var sub = on ? (ev.id === 'code' ? 'one-line functions, rarely' : 'passes') : (ev.id === 'code' ? (full ? 'not seen in 2020' : 'not in 2020') : (full ? 'needs ' + rg : rg));
      h += '<span class="test' + (on ? ' on' : '') + (ev.contaminated && ev.known ? ' leaked' : '') + '"><i></i><b>' + txt + '</b><u>' + sub + '</u></span>';
    });
    return h + '</div>';
  }
  FX.plaqueHTML = function (run, big) {
    var e = E(), s = S(), newest = s.runs.filter(function (r) { return r.state === 'landed'; }).slice(-1)[0] === run;
    var tags = []; if (run.published) tags.push('published'); if (run.shipped) tags.push('API'); if (run.kept) tags.push('private'); if (run.pending) tags.push(esc(run.pending)); if (run.scandal) tags.push('scandal');
    if (run.copied) tags.push(esc(run.copied.by) + ' reproduced it in ' + weeks(run.copied.day - run.landDay));
    var h = (big ? '<div class="plaque big thunk newest">' : '<button type="button" class="plaque' + (newest ? ' newest' : '') + (ui.thunkRun === run.id ? ' thunk' : '') + (run.clean ? '' : ' junk') + '" data-act="card" data-id="' + run.id + '" data-k="pl' + run.id + '">') +
      '<span class="pl-l"><span class="pl-name">' + esc(e.modelName(run)) + '</span><span class="pl-meta">' + e.fmtDay(run.landDay) + ' · ' + bigNum(run.N) + ' parameters · read ' + bigNum(run.Dland) + '</span>' +
      '<span class="pl-line">' + esc(e.modelLine(run)) + '</span>' +
      (run.clean ? '<span class="pl-sh">' + e.shortFmt(e.shortOf(run.Cland)) + ' short of GPT-3</span>' : '<span class="pl-sh bad">proves nothing</span>') + '</span>' +
      '<span class="pl-r">' + ((newest || big) && run.evals ? testsHTML(run, big) : '') + (tags.length ? '<span class="pl-tags">' + tags.map(function (t) { return '<em>' + t + '</em>'; }).join('') + '</span>' : '') + '</span>' + (big ? '</div>' : '</button>');
    return h;
  };
  function apiHTML() {
    var e = E(), s = S(), m = e.apiMeter(), h = '';
    if (m) {
      var apps = ['a writing helper', 'a search box', 'a support bot', 'a code explainer', 'a story game', 'a quiz maker', 'a translator', 'a note summariser'];
      var tiles = ''; for (var i = 0; i < m.apps; i++) tiles += '<i title="' + apps[i % apps.length] + '"></i>';
      var rn = e.runById(m.runId);
      h += '<div class="api"><div class="ah"><b>' + (rn ? esc(e.modelName(rn)) + ' API' : 'API') + '</b><span>live since ' + e.fmtDay(m.since) + ' · ' + money(m.rev) + ' a month</span></div>' +
        '<div class="am"><span class="w"><b>' + m.waiting.toLocaleString('en-US') + '</b> waiting</span><span><b>' + m.developers.toLocaleString('en-US') + '</b> developers in</span><span><b>' + m.wordsDay.toLocaleString('en-US') + '</b> words a day</span></div>' +
        '<div class="apps" aria-label="' + m.apps + ' apps built on it">' + tiles + '</div></div>';
    }
    var om = e.openMeter();
    if (om) h += '<div class="api open"><div class="ah"><b>Open weights</b><span>out for ' + Math.round(om.days) + ' days · no revenue</span></div><div class="am"><span><b>' + om.downloads.toLocaleString('en-US') + '</b> downloads</span><span><b>' + om.tunes.toLocaleString('en-US') + '</b> fine-tunes</span></div></div>';
    return h;
  }
  function renderModels() {
    var e = E(), s = S(), landed = s.runs.filter(function (r) { return r.state === 'landed'; });
    var n = landed.length;
    setText($('s-models'), n === 0 ? 'no saved models yet' : n + ' saved model' + (n === 1 ? '' : 's'));
    var fg = e.forgotten();
    var h = '';
    var list = FX.wide() ? landed.slice() : landed.slice().reverse();
    h += '<div class="mdl"><div class="shelfcol"><div class="shelf' + (FX.wide() ? ' wide' : '') + '">';
    if (!n) h += '<div class="plaque empty" data-k="pl-empty"><span class="pl-name">Your first saved model goes here</span><span class="pl-meta">Every model you finish stands on this shelf.</span></div>';
    list.forEach(function (r) { h += FX.plaqueHTML(r); });
    h += '</div></div><div class="mside">';
    h += apiHTML();
    h += '<div class="forget' + (fg.left < 21 ? ' bad' : fg.left < 45 ? ' cau' : '') + '">The world forgets you in <b>' + Math.max(0, Math.ceil(fg.left)) + ' days</b> unless you publish or ship a model about <b>' + (fg.days ? (fg.days < 1 ? 'a day' : Math.round(fg.days) + ' days') : 'some days') + '</b> of your cluster’s work. <button type="button" class="lnk" data-act="forgdet" aria-expanded="' + !!ui.forgDet + '">' + (ui.forgDet ? 'hide' : 'the number') + '</button>' + (ui.forgDet ? '<span class="det"> ' + sci(fg.need) + ' FLOPs, a hundredth of the biggest result anyone has published (' + sci(e.frontier()) + ').</span>' : '') + '</div></div></div>';
    setHTML($('b-models'), h);
    if (FX.wide() && ui.shelfCount !== n) { ui.shelfCount = n; var sf = document.querySelector('#b-models .shelf'); if (sf) sf.scrollLeft = sf.scrollWidth; }
    var fr = $('row-models'); if (n === 1) revealOnce('models', fr);
  }
  // the model card: one tap down from a plaque or a dot
  FX.openCard = function (id) {
    var e = E(), s = S(), run = e.runById(id); if (!run || run.state !== 'landed') return;
    ui.cardRun = id; renderCard(); $('card').hidden = false;
    var cb = $('card').querySelector('.x-close'); if (cb) try { cb.focus({ preventScroll: true }); } catch (x) {}
  };
  function renderCard() {
    var e = E(), s = S(), run = e.runById(ui.cardRun); if (!run) { $('card').hidden = true; return; }
    var vsLine = run.loss / e.Lline(run.Cland) - 1, bk = e.bestKnown(), diff = run.loss - bk.L;
    var h = '<h2 id="c-title">' + esc(e.modelName(run)) + '</h2><div class="m-from">saved ' + e.fmtDay(run.landDay) + ', ' + ago(run.landDay) + '</div><p class="m-body">It ' + esc(e.modelLine(run)) + '.</p>' +
      kvt([
        { k: 'Model size', v: bigNum(run.N) + ' parameters' },
        { k: 'Text it read', v: bigNum(run.Dland) + ' tokens' },
        { k: 'Compute spent', v: sci(run.Cland) + ' FLOPs' },
        { k: 'Error score (lower is better)', v: run.loss.toFixed(2) },
        { k: 'Against the line', v: pct(Math.abs(vsLine), 1) + (vsLine >= 0 ? ' above' : ' below') },
        { k: 'Against the best known model', v: bk.L < 99 ? (diff > 0 ? diff.toFixed(2) + ' behind ' + esc(bk.who) : Math.abs(diff).toFixed(2) + ' ahead of ' + esc(bk.who)) : '—' },
        { k: 'Against GPT-3', v: run.clean ? e.shortFmt(e.shortOf(run.Cland)) + ' short' : 'it read junk' }
      ]) + (run.evals ? testsHTML(run, true) : '');
    var ck = run.ckpts[run.ckpts.length - 1];
    if (ck && ck.sample) h += '<div class="m-sample' + (ck.amt === e.CRAWL ? ' crawl' : '') + '">' + FX.sampleHTML(ck.sample.text) + '</div>';
    var tags = []; if (run.published) tags.push('published'); if (run.shipped) tags.push('running as the API'); if (run.kept) tags.push('kept private'); if (run.copied) tags.push(esc(run.copied.by) + ' reproduced it in ' + weeks(run.copied.day - run.landDay)); if (run.scandal) tags.push('scandal: ' + esc(run.scandal));
    if (tags.length) h += '<p class="m-note">' + tags.join(' · ') + '</p>';
    $('c-body').innerHTML = h;
  }

  /* ================= everything, in one pass ================= */
  FX.renderPanels = function () {
    var s = S(); if (!s) return;
    FX.renderLadder(); renderDesigner(); renderRuns(); renderCluster(); renderTeam(); renderMoney(); renderData(); renderNews(); renderModels();
    for (var k in ui.open) { var row = $('row-' + k); if (row) { FX.setClass(row, 'open', !!ui.open[k]); var b = row.querySelector('.rh'); if (b) b.setAttribute('aria-expanded', String(!!ui.open[k])); } }
    ['cluster', 'team', 'money', 'data', 'news', 'models'].forEach(function (k) { if (!ui.open[k]) { var row = $('row-' + k); if (row) { FX.setClass(row, 'open', false); var b = row.querySelector('.rh'); if (b) b.setAttribute('aria-expanded', 'false'); } } });
    if (!$('card').hidden) renderCard();
    // intro pulse: the clock has run 15 seconds with no run
    var intro = !s.runs.length && ui.runClock > 15; if (intro !== ui.introPulse) { ui.introPulse = intro; }
  };
  FX.renderAll = function () { FX.renderStrip(0); FX.renderPanels(); FX.drawChart(); };

  /* ================= taps and clicks ================= */
  FX.scrollToEl = function (el) { if (!el) return; requestAnimationFrame(function () { try { el.scrollIntoView({ behavior: FX.reduced() ? 'auto' : 'smooth', block: 'start' }); } catch (x) { el.scrollIntoView(); } }); };
  function openRow(k) { ui.open[k] = true; ui.dirty = true; FX.renderPanels(); }
  function focusVerb(v) {
    var e = E(), s = S();
    if (v === 'hire') {
      openRow('team');
      var c = s.cands.slice().sort(function (a, b) { return a.courtBy - b.courtBy; })[0];
      if (c) ui.sel = 'c:' + c.key; FX.renderPanels(); FX.scrollToEl($('row-team'));
    } else if (v === 'rent') { openRow('cluster'); FX.renderPanels(); FX.scrollToEl($('rent-block') || $('row-cluster')); }
    else if (v === 'data') { openRow('data'); FX.renderPanels(); FX.scrollToEl($('clean-block') || $('row-data')); }
    else if (v === 'raise') { openRow('money'); FX.renderPanels(); FX.scrollToEl($('raise-block') || $('row-money')); }
  }
  function rungGo(id) {
    var e = E(), s = S();
    if (id === 'start') { var r = quickStart(); return; }
    if (id === 'land') { FX.scrollToEl($('curve')); return; }
    if (id === 'seriesA' || id === 'seriesB') { focusVerb('raise'); return; }
    if (id === 'api') { openRow('models'); FX.scrollToEl($('row-models')); return; }
    // the rest are about compute: set the designer to reach the target and show it
    var rg = e.ladder().rungs.filter(function (x) { return x.id === id; })[0];
    var tgt = null;
    if (id === 'paragraph' || id === 'arithmetic' || id === 'translation') tgt = s.caps.filter(function (c) { return c.id === id; })[0].lo;
    else if (id === 'rival') { var na = e.nearestAhead(); tgt = na ? na.C : null; }
    else if (id === 'within10') tgt = CFG.gpt3.C / 10; else if (id === 'beat') tgt = CFG.gpt3.C;
    if (tgt) presetFor(tgt); else applyPreset('mem');
    FX.scrollToEl($('designer'));
  }
  FX.handle = function (a, t, ev) {
    var e = E(), s = S(), r;
    switch (a) {
      case 'speed': FX.setSpeed(+t.getAttribute('data-x')); break;
      case 'mute': AU.setMuted(!AU.muted); FX.syncMute(); break;
      case 'ledger': FX.toggleLedger(); break;
      case 'goto': { var to = t.getAttribute('data-to'); if (to === 'curve') FX.scrollToEl($('curve')); else { openRow(to); FX.scrollToEl($('row-' + to)); } break; }
      case 'fold': { var k = t.getAttribute('data-row'); ui.open[k] = !ui.open[k]; break; }
      case 'verb': focusVerb(t.getAttribute('data-v')); break;
      case 'rung': rungGo(t.getAttribute('data-r')); break;
      case 'tile': { ev && ev.preventDefault && ev.preventDefault(); var sel = t.getAttribute('data-sel'); ui.sel = ui.sel === sel ? null : sel; break; }
      case 'card': FX.openCard(+t.getAttribute('data-id')); break;
      case 'closecard': $('card').hidden = true; break;
      case 'forgdet': ui.forgDet = !ui.forgDet; break;
      case 'details': ui.details = !ui.details; break;
      case 'pool': ui.des.pool = t.getAttribute('data-pool'); ui.des.gpusMax = true; FX.syncDesignerInputs(); break;
      case 'preset': applyPreset(t.getAttribute('data-p')); break;
      case 'launch': r = FX.doAct('launch', { params: ui.des.N, tokens: ui.des.D, gpus: ui.des.gpus, pool: ui.des.pool }, t); if (r.ok) { AU.launch(); AU.vibrate(10); if (!ui.everStarted) FX.setSpeed(1); ui.des.gpusMax = true; FX.syncDesignerInputs(); } break;
      case 'sample': r = E().act('sample', { id: +t.getAttribute('data-id') }); if (r.ok) FX.wordTicks(r.sample.text); break;
      case 'move': e.act('move', { id: +t.getAttribute('data-id') }); ui.des.gpusMax = true; FX.syncDesignerInputs(); break;
      case 'abort': { var id = +t.getAttribute('data-id'); if (ui.stopArm && ui.stopArm.id === id && performance.now() - ui.stopArm.t < 3500) { ui.stopArm = null; e.act('abort', { id: id }); } else ui.stopArm = { id: id, t: performance.now() }; break; }
      case 'raisepay': FX.doAct('raisePay', { id: t.getAttribute('data-id') }, t); AU.tick(false); break;
      case 'hire': FX.doAct('hire', { id: t.getAttribute('data-id') }, t); break;
      case 'filter': FX.doAct('filter', {}, t); break;
      case 'step': { var sk = t.getAttribute('data-s'), dd = +t.getAttribute('data-d'); if (sk === 'rent') ui.rentN = Math.max(8, ui.rentN + dd); else ui.buy[sk] = clamp(ui.buy[sk] + dd, 1, CFG.buyMaxUnits); AU.tick(dd > 0); break; }
      case 'rent': FX.doAct('rent', { gpus: ui.rentN }, t); AU.tick(false); break;
      case 'cancelRent': e.act('cancelRent', { id: t.getAttribute('data-id') }); break;
      case 'buy': FX.doAct('buy', { item: t.getAttribute('data-item'), units: ui.buy[t.getAttribute('data-item')] }, t); break;
      case 'rentOut': FX.doAct('rentOut', { pool: e.poolFree('office') > 0 ? 'office' : 'a100' }, t); break;
      case 'pitch': FX.doAct('raise', { round: t.getAttribute('data-round') }, t); break;
      case 'priority': e.act('priority', {}); break;
      case 'feed': ui.feed = t.getAttribute('data-f'); break;
      case 'openDecision': ui.modalId = null; break;
      case 'answer': r = e.act('answer', { id: t.getAttribute('data-id'), choice: t.getAttribute('data-choice') }); ui.modalId = null; if (r.ok) AU.tick(true); break;
      case 'newyear': FX.newGame(); return;
      case 'review': $('end').hidden = true; ui.endClosed = true; break;
    }
    ui.dirty = true; ui.chartDirty = true; FX.renderPanels();
  };

  // designer inputs
  $('d-gpus').addEventListener('input', function (ev) { ui.des.gpus = +ev.target.value; ui.des.gpusMax = ui.des.gpus >= E().poolFree(ui.des.pool); renderDesigner(); });
  $('d-n').addEventListener('input', function (ev) { ui.des.N = vToN(+ev.target.value); if (ui.des.recipe) { ui.des.D = clamp(E().recipeForN(ui.des.N).D, CFG.designer.dMin, CFG.designer.dMax); $('d-d').value = String(dToV(ui.des.D)); } renderDesigner(); });
  $('d-d').addEventListener('input', function (ev) { ui.des.D = vToD(+ev.target.value); if (ui.des.recipe) { ui.des.N = clamp(recipeForD(ui.des.D).N, CFG.designer.nMin, CFG.designer.nMax); $('d-n').value = String(nToV(ui.des.N)); } renderDesigner(); });
  $('d-recipe').addEventListener('change', function (ev) { ui.des.recipe = !!ev.target.checked; if (ui.des.recipe) { ui.des.D = clamp(E().recipeForN(ui.des.N).D, CFG.designer.dMin, CFG.designer.dMax); $('d-d').value = String(dToV(ui.des.D)); } renderDesigner(); });
  FX.quickStart = quickStart;
})();
