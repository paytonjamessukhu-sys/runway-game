/* The top strip, the goal ladder with its verbs, the voice line, the monthly slip and the ledger behind the month label. */
(function (X) {
  'use strict';
  var $ = X.$, esc = X.esc;

  /* ---------------- the strip: four figures, each with a change tag ---------------- */
  X.renderStrip = function (dt) {
    var G = X.G, S = X.S, F = X.F, ui = X.ui, sn = S.snap, CFG = X.CFG;
    var d = G.dateOf(S.day);
    X.setText('t-date', F.date(Math.min(S.day, 365), false));
    X.setText('t-m', 'month ' + (d.getUTCMonth() + 1) + ' of 12');
    var live = S.started && !S.paused && !S.over && !S.pending;
    X.setClass('t-pause', 'on', !live);
    var pb = $('t-pause'), pl = live ? 'Pause (space)' : S.started ? 'Resume (space)' : 'Start the clock (space)'; if (pb.getAttribute('aria-label') !== pl) { pb.setAttribute('aria-label', pl); pb.title = pl; }
    pb.classList.toggle('isplay', !live);
    Array.prototype.forEach.call(document.querySelectorAll('.tb.sp'), function (b) { b.classList.toggle('on', live && +b.getAttribute('data-speed') === S.speed); });
    X.setClass('t-mute', 'muted', X.AUD.muted);
    var mu = $('t-mute'); var lab = X.AUD.muted ? 'Sound is off. Press to unmute (M)' : 'Sound is on. Press to mute (M)'; if (mu.getAttribute('aria-label') !== lab) mu.setAttribute('aria-label', lab);

    // cash: ticks live, green on money in, red on money out
    var cashV = X.tween('v-cash', S.bank, X.cash, dt, 14);
    var last = ui.lastCash; ui.lastCash = S.bank;
    if (last != null && Math.abs(S.bank - last) > 0.5) {
      var up = S.bank > last, el = $('f-cash');
      if (ui.cashDir !== (up ? 1 : -1)) { ui.cashDir = up ? 1 : -1; el.classList.toggle('in', up); el.classList.toggle('out', !up); }
      ui.cashT = X.nowMs();
    } else if (ui.cashDir && X.nowMs() - ui.cashT > 700) { ui.cashDir = 0; $('f-cash').classList.remove('in', 'out'); }
    var dc = S.bank - sn.bank;
    tag('g-cash', Math.abs(dc) < 0.5 ? '$0' : X.signed(dc, G.fmt.money), ' this month', dc > 0.5 ? 'gain' : dc < -0.5 ? 'bad' : '');

    // months until broke
    var rw = G.runway();
    X.tween('v-broke', rw, X.broke, dt, 6);
    var fb = $('f-broke'); fb.classList.toggle('caution', isFinite(rw) && rw < 6 && rw >= 3); fb.classList.toggle('danger', isFinite(rw) && rw < 3);
    var wasR = sn.runway;
    tag('g-broke', isFinite(wasR) ? 'was ' + X.broke(wasR) : 'was no limit', '', !isFinite(rw) ? 'gain' : (isFinite(wasR) && rw < wasR - 0.05) ? 'bad' : (isFinite(wasR) && rw > wasR + 0.05) ? 'gain' : '');

    // short of GPT-3
    var far = G.farthestClean(), sv = $('v-short'), fs = $('f-short');
    if (!(far > 0)) { if (sv.textContent !== '—') sv.textContent = '—'; X.tweenReset('v-short'); tag('g-short', 'no model yet', '', ''); fs.classList.remove('passed'); }
    else {
      var ratio = G.shortOf(far);
      if (ratio <= 1.05) { if (sv.textContent !== 'passed it') sv.textContent = 'passed it'; X.tweenReset('v-short'); fs.classList.add('passed'); tag('g-short', 'GPT-3 is behind you', '', 'gain'); }
      else {
        fs.classList.remove('passed');
        X.tween('v-short', ratio, X.times, dt, 8);
        var was = sn.short;
        tag('g-short', was ? 'was ' + X.times(was) : 'first model', '', was ? (ratio < was * 0.995 ? 'gain' : ratio > was * 1.005 ? 'bad' : '') : 'gain');
      }
    }
    // your lab owns
    var own = G.lab();
    X.tween('v-own', own, G.fmt.money, dt, 9);
    var dl = own - sn.lab;
    tag('g-own', dl > 0.5 ? '+' + G.fmt.money(dl) : '$0', ' this month', dl > 0.5 ? 'gain' : '');
  };
  function tag(id, amt, lng, cls) {
    var h = '<span class="amt">' + esc(amt) + '</span>' + (lng ? '<span class="lng">' + esc(lng) + '</span>' : '');
    var key = 'tag:' + id; if (X.cache[key] === h + cls) return; X.cache[key] = h + cls;
    var el = $(id); el.innerHTML = h; el.className = 'tg num ' + cls;
  }

  /* ---------------- the ladder: three rungs, one lit; four verbs ---------------- */
  X.renderLadder = function () {
    var G = X.G, S = X.S, F = X.F, ui = X.ui, CFG = X.CFG;
    var L = G.ladder(), lit = L.rungs[L.lit];
    var h = L.rungs.map(function (r, i) {
      var cls = r.lit ? 'lit' : r.done ? 'done' : 'dim';
      var inner = '<span class="rn">' + (r.done ? '✓' : (L.first ? i + 1 : '●')) + '</span><span class="rt">' + esc(r.text) + '</span>';
      return r.lit ? '<button type="button" class="rung ' + cls + (ui.rungPulse ? ' pulse' : '') + '" data-rung="' + r.id + '">' + inner + '</button>' : '<span class="rung ' + cls + '">' + inner + '</span>';
    }).join('');
    X.setHTML('rungs', h);
    var bar = $('lbar-i'), pr = lit ? Math.round((lit.prog || 0) * 1000) / 10 : 100;
    if (bar.getAttribute('data-p') !== String(pr)) { bar.setAttribute('data-p', String(pr)); bar.style.width = pr + '%'; }
    var note = '';
    if (lit) {
      var why = L.first && lit.why ? lit.why + ' ' : '';
      note += '<span class="ln-why">' + esc(why) + (lit.left ? '<b>' + esc(lit.left.charAt(0).toUpperCase() + lit.left.slice(1)) + '.</b>' : '') + '</span>';
    }
    var rl = Math.max(0, Math.ceil(S.relevance.deadline - S.day));
    if (rl <= 45 && !S.over) note += '<span class="chip ' + (rl <= 21 ? 'danger' : 'caution') + '">forgotten in ' + rl + ' days</span>';
    X.setHTML('lnote', note);
    // verbs
    var rs = G.roundStatus(), rw = G.runway(), pulse = null;
    var cand = S.candidates.length, dz = ui.design, idle = G.idle();
    var hasDataWarn = dz && dz.warn && dz.warn.some(function (w) { return w.k === 'data'; });
    if (rs.legal || (isFinite(rw) && rw < 6 && rs.next)) pulse = 'raise';
    else if (cand) pulse = 'hire';
    else if (hasDataWarn) pulse = 'data';
    else if (S.runs.length && idle.idleCards === 0 && S.active.length && (!isFinite(rw) || rw > 12)) pulse = 'rent';
    ui.verbPulse = pulse;
    Array.prototype.forEach.call(document.querySelectorAll('.verb'), function (b) {
      var v = b.getAttribute('data-verb');
      b.classList.toggle('pulse', pulse === v);
      var grey = v === 'raise' && !rs.legal;
      b.classList.toggle('grey', grey);
      b.setAttribute('aria-disabled', grey ? 'true' : 'false');
      if (v === 'raise') { var t = grey ? 'Raise: ' + (rs.why[0] || 'not yet') : 'Raise: ' + (rs.next ? 'Series ' + rs.next + ' is open' : ''); if (b.title !== t) b.title = t; }
      if (v === 'hire') b.classList.toggle('has', cand > 0);
    });
    var vb = $('verbs'); vb.classList.toggle('late', S.runs.length > 0 || S.stats.runs > 0);
  };

  /* ---------------- the voice line: someone is always talking; the forgotten clock sits under it ---------------- */
  X.renderVoice = function () {
    var G = X.G, S = X.S, F = X.F, CFG = X.CFG, h = '';
    var f = null;
    for (var i = 0; i < S.feed.length; i++) { var e = S.feed[i]; if (e.kind === 'voice' || e.kind === 'knock' || e.kind === 'data') { f = e; break; } if (e.kind === 'leave') { f = e; break; } }
    if (f) {
      var p = X.WORLD.people[f.who], who = p ? p.first : f.name || 'Lab', old = S.day - f.day > 25;
      h += '<button type="button" class="vq' + (old ? ' old' : '') + (X.ui.voiceOpen ? ' open' : '') + '" id="vq" aria-label="What ' + esc(who) + ' said, tap to read it all"><span class="vi">' + esc(X.initial(who)) + '</span><span class="vt"><b>' + esc(who) + '</b> “' + esc(f.text) + '”</span></button>';
    }
    var rl = Math.max(0, Math.ceil(S.relevance.deadline - S.day)), need = G.derived().relevantNeed, fl = G.flopsPerDay();
    var days = fl > 0 ? need / fl : 0, dayTxt = fl > 0 ? (days < 1 ? 'under a day' : days < 10 ? 'about ' + Math.round(days) + ' days' : 'about ' + Math.round(days) + ' days') + ' of your cluster' : 'no cards running';
    h += '<div class="forgot' + (rl <= 45 ? ' hot' : '') + '">The world forgets you in ' + rl + ' days unless you publish or ship a model of at least ' + esc(F.sci(need)) + ' (' + esc(dayTxt) + ').</div>';
    X.setHTML('voice', h);
  };

  /* ---------------- the monthly slip: three lines over the top of the curve; the clock never stops ---------------- */
  X.showSlip = function (slip) {
    var ui = X.ui; ui.slip = { slip: slip, t0: X.nowMs() }; ui.slipUnread = true;
    var el = $('slip');
    el.innerHTML = '<div class="slip-h"><span class="slip-m">' + esc(slip.monthName.toUpperCase()) + ' SLIP</span><button type="button" class="slip-x" id="slip-x" aria-label="Put the slip away">×</button></div>' +
      slip.lines.map(function (l, i) { return '<p class="sln sln' + (i + 1) + ' k-' + esc(l.k) + (l.up ? ' up' : l.k === 'cash' ? ' down' : '') + '"><i class="sd"></i><span>' + esc(l.text) + '</span></p>'; }).join('');
    el.hidden = false; el.classList.remove('settle'); void el.offsetWidth; el.classList.add('unroll');
    X.softLight('slip', null);
  };
  X.tickSlip = function () {
    var ui = X.ui; if (!ui.slip) return;
    if (X.nowMs() - ui.slip.t0 > 10000) X.hideSlip(true);
  };
  X.hideSlip = function (settle) {
    var ui = X.ui, el = $('slip'); if (!ui.slip) return; ui.slip = null;
    if (settle && !X.reduced()) { el.classList.remove('unroll'); el.classList.add('settle'); setTimeout(function () { if (!X.ui.slip) el.hidden = true; el.classList.remove('settle'); }, 420); }
    else { el.hidden = true; el.classList.remove('unroll', 'settle'); }
    var pip = $('t-pip'); if (pip && X.ui.slipUnread) pip.hidden = false;
  };

  /* ---------------- the ledger behind the month label ---------------- */
  X.renderLedger = function () {
    var S = X.S, h = '';
    h += '<div class="lg-h"><span>The monthly slips</span><button type="button" class="slip-x" id="lg-x" aria-label="Close the ledger">×</button></div>';
    if (!S.slips.length) h += '<p class="lg-empty">The first slip lands on 1 February: cash, progress, and what is coming.</p>';
    S.slips.slice().reverse().forEach(function (s) {
      h += '<div class="lg-slip"><div class="lg-m">' + esc(s.monthName) + '</div>' + s.lines.map(function (l) { return '<p class="sln k-' + esc(l.k) + (l.up ? ' up' : l.k === 'cash' ? ' down' : '') + '"><i class="sd"></i><span>' + esc(l.text) + '</span></p>'; }).join('') + '</div>';
    });
    X.setHTML('ledger', h);
  };
  X.toggleLedger = function (on) {
    var el = $('ledger'), open = on == null ? el.hidden : on;
    if (open) { X.renderLedger(); X.ui.slipUnread = false; $('t-pip').hidden = true; }
    el.hidden = !open; $('t-month').setAttribute('aria-expanded', String(open));
  };
})(window.FX);
