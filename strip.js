/* The top of the sheet: the clock, MONEY in the top right corner, the goal ladder, the voice written on the paper,
   the forgotten clock, the monthly slip and the ledger behind the month label. */
(function (X) {
  'use strict';
  var $ = X.$, esc = X.esc;

  /* ---------------- the figures: cash is the big one; months until broke and what the lab owns sit under it ---------------- */
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

    // cash ticks live; the pencil arrow says which way the last change went
    X.tween('v-cash', S.bank, X.cash, dt, 14);
    var last = ui.lastCash; ui.lastCash = S.bank;
    var ar = $('a-cash');
    if (last != null && Math.abs(S.bank - last) > 0.5) {
      var up = S.bank > last; ui.cashDir = up ? 1 : -1; ui.cashT = X.nowMs();
      if (ar) { ar.textContent = up ? '▲' : '▼'; ar.classList.add('on'); }
    } else if (ui.cashDir && X.nowMs() - ui.cashT > 800) { ui.cashDir = 0; if (ar) ar.classList.remove('on'); }
    var dc = S.bank - sn.bank;
    tag('g-cash', Math.abs(dc) < 0.5 ? '' : X.signed(dc, G.fmt.money), Math.abs(dc) < 0.5 ? '' : ' this month', dc > 0.5 ? 'gain' : dc < -0.5 ? 'bad' : '');

    // months until broke
    var rw = G.runway(), fin = isFinite(rw);
    X.tween('v-broke', rw, X.broke, dt, 6);
    var fb = $('f-broke'); fb.classList.toggle('caution', fin && rw < 6 && rw >= 3); fb.classList.toggle('danger', fin && rw < 3);
    var ml = fb.querySelector('.ml'), mlt = fin && rw < 240 ? ' months until broke' : ' until broke'; if (ml.textContent !== mlt) ml.textContent = mlt;
    var wasR = sn.runway;
    var moved = isFinite(wasR) !== fin || (fin && Math.abs(rw - wasR) > 0.05);
    tag('g-broke', !moved ? '' : isFinite(wasR) ? 'was ' + X.broke(wasR) : 'was no limit', '', !fin ? 'gain' : (isFinite(wasR) && rw < wasR - 0.05) ? 'bad' : (isFinite(wasR) && rw > wasR + 0.05) ? 'gain' : '');

    // short of GPT-3: the other figure the owner watches
    var far = G.farthestClean(), sv = $('v-short'), fs = $('f-short');
    if (!(far > 0)) { if (sv.textContent !== '—') sv.textContent = '—'; X.tweenReset('v-short'); tag('g-short', 'no model yet', '', ''); fs.classList.remove('passed'); }
    else {
      var ratio = G.shortOf(far);
      if (ratio <= 1.05) { if (sv.textContent !== 'passed it') sv.textContent = 'passed it'; X.tweenReset('v-short'); fs.classList.add('passed'); tag('g-short', 'GPT-3 is behind you', '', 'gain'); }
      else {
        fs.classList.remove('passed');
        X.tween('v-short', ratio, X.times, dt, 8);
        var was = sn.short;
        tag('g-short', was ? (Math.abs(ratio / was - 1) < 0.005 ? '' : 'was ' + X.times(was)) : 'first model', '', was ? (ratio < was * 0.995 ? 'gain' : ratio > was * 1.005 ? 'bad' : '') : 'gain');
      }
    }
    // your lab owns
    var own = G.lab();
    X.tween('v-own', own, G.fmt.money, dt, 9);
    var dl = own - sn.lab;
    tag('g-own', dl > 0.5 ? '+' + G.fmt.money(dl) : '', dl > 0.5 ? ' this month' : '', dl > 0.5 ? 'gain' : '');
    // pencil beside the money, only while the lab is new
    var hint = S.day < 31 && !S.over ? 'cash, and how long it lasts' : '';
    if (X.cache.mhint !== hint) { X.cache.mhint = hint; X.setText('m-hint', hint); }
  };
  function tag(id, amt, lng, cls) {
    var h = '<span class="amt">' + esc(amt) + '</span>' + (lng ? '<span class="lng">' + esc(lng) + '</span>' : '');
    var key = 'tag:' + id; if (X.cache[key] === h + cls) return; X.cache[key] = h + cls;
    var el = $(id); el.innerHTML = h; el.className = 'tg ' + cls;
  }

  /* ---------------- the goal: three rungs in handwriting; only the lit one is ink, and it is a button ---------------- */
  X.renderLadder = function () {
    var G = X.G, S = X.S, F = X.F, ui = X.ui, CFG = X.CFG;
    var L = G.ladder(), lit = L.rungs[L.lit];
    var h = L.rungs.map(function (r, i) {
      var cls = r.lit ? 'lit' : r.done ? 'done' : 'dim', num = r.done ? '✓' : (L.first ? String(i + 1) : '·');
      var inner = '<span class="rn">' + num + '</span>' + esc(r.text);
      return r.lit ? '<button type="button" class="rung ' + cls + (ui.rungPulse ? ' pulse' : '') + '" data-rung="' + r.id + '">' + inner + '<span class="ar" aria-hidden="true">→</span></button>' : '<span class="rung ' + cls + '">' + inner + '</span>';
    }).join('');
    X.setHTML('rungs', h);
    var bar = $('lbar-i'), pr = lit ? Math.round((lit.prog || 0) * 1000) / 10 : 100;
    if (bar.getAttribute('data-p') !== String(pr)) { bar.setAttribute('data-p', String(pr)); bar.style.width = pr + '%'; }
    var note = '';
    if (lit) {
      var why = L.first && lit.why ? lit.why + ' ' : '';
      var left = lit.left, farC = G.farthestClean();
      if (lit.target && farC >= lit.target * 0.99 && /^needs 0/.test(left || '')) left = lit.id === 'api' ? 'ready: ship a saved model as an API' : 'you have the compute: land a model that proves it';
      note += '<span class="ln-why"><span class="wy">' + esc(why) + '</span>' + (left ? '<b>' + esc(left.charAt(0).toUpperCase() + left.slice(1)) + '.</b>' : '') + '</span>';
    }
    var rl = Math.max(0, Math.ceil(S.relevance.deadline - S.day));
    if (rl <= 45 && !S.over) note += '<span class="chip ' + (rl <= 21 ? 'danger' : '') + '">forgotten in ' + rl + ' days</span>';
    X.setHTML('lnote', note);
    // which option wants the thumb right now (the first match wins)
    var rs = G.roundStatus(), rw = G.runway(), pulse = null;
    var cand = S.candidates.length, dz = ui.design, idle = G.idle();
    var hasDataWarn = dz && dz.warn && dz.warn.some(function (w) { return w.k === 'data'; });
    if (rs.legal) pulse = 'raise';
    else if (cand) pulse = 'hire';
    else if (hasDataWarn) pulse = 'data';
    else if (S.runs.length && idle.idleCards === 0 && S.active.length && (!isFinite(rw) || rw > 12)) pulse = 'rent';
    ui.verbPulse = pulse;
  };

  /* ---------------- the voice, written on the paper; the forgotten clock under it ---------------- */
  X.renderVoice = function () {
    var G = X.G, S = X.S, F = X.F, CFG = X.CFG, h = '';
    var f = null;
    for (var i = 0; i < S.feed.length; i++) { var e = S.feed[i]; if (e.kind === 'voice' || e.kind === 'knock' || e.kind === 'data') { f = e; break; } if (e.kind === 'leave') { f = e; break; } }
    if (f) {
      var p = X.WORLD.people[f.who], who = p ? p.first : f.name || 'Lab', old = S.day - f.day > 25;
      h += '<button type="button" class="vq' + (old ? ' old' : '') + (X.ui.voiceOpen ? ' open' : '') + '" id="vq" aria-label="What ' + esc(who) + ' said, tap to read it all"><b>' + esc(who) + '</b><span class="vt">“' + esc(f.text) + '”</span></button>';
    }
    if (X.setHTML('voice', h) && f && X.ui.voiceKey != null && X.ui.voiceKey !== f.day + f.text && !X.reduced()) { var vqe = $('vq'); if (vqe) { vqe.classList.add('wr'); setTimeout(function () { var q = $('vq'); if (q) q.classList.remove('wr'); }, 1500); } }
    X.ui.voiceKey = f ? f.day + f.text : '';
    var rl = Math.max(0, Math.ceil(S.relevance.deadline - S.day)), need = G.derived().relevantNeed, fl = G.flopsPerDay();
    var days = fl > 0 ? need / fl : 0, dayTxt = fl > 0 ? (days < 1 ? 'under a day' : 'about ' + Math.round(days) + ' days') + ' of your cluster' : 'no cards running';
    var fuse = rl <= 45 ? '<i class="fuse' + (S.paused || !S.started ? ' cold' : '') + '" style="width:' + Math.max(2, 100 * rl / 45).toFixed(1) + '%"><i></i></i>' : '';
    X.setHTML('forgot', '<div class="' + (rl <= 45 ? 'hot' : '') + '">The world forgets you in ' + rl + ' days unless you publish or ship a model of at least ' + esc(F.sci(need)) + ' (' + esc(dayTxt) + ').' + fuse + '</div>');
    $('forgot').classList.toggle('hot', rl <= 45);
  };

  /* ---------------- the monthly slip: a sheet of three lines over the top of the paper; its fuse burns for ten seconds; the clock never stops ---------------- */
  X.showSlip = function (slip) {
    var ui = X.ui; ui.slip = { slip: slip, t0: X.nowMs() }; ui.slipUnread = true;
    var el = $('slip');
    el.innerHTML = '<i class="fuse"><i></i></i><div class="slip-h"><span class="slip-m">' + esc(slip.monthName.toUpperCase()) + ' SLIP</span><button type="button" class="slip-x" id="slip-x" aria-label="Put the slip away">×</button></div>' +
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
