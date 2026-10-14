/* FRONTIER sim, build B. Web Audio only, every sound generated. Nothing plays before the first touch;
   every call is a silent no-op until then and every failure is swallowed. Every event also has a visual. */
window.FrontierAudio = (function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG.audio;
  var A = { ctx: null, muted: false };
  function dB(d) { return Math.pow(10, d / 20); }
  var master, duck, motorGain, o1, o2, o3, g2, g3, brownGain, scratchBP, scratchGain, whiteBuf, brownBuf, pinkBuf, fuseGain;
  var lastScratch = -1, last = {}, state = 'off';

  function noiseBuf(c, kind) {
    var len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0), l = 0;
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
      else if (kind === 'pink') { b0 = 0.997 * b0 + 0.029591 * w; b1 = 0.985 * b1 + 0.032534 * w; b2 = 0.95 * b2 + 0.048056 * w; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.9; }
      else d[i] = w;
    }
    return b;
  }
  function build() {
    var c = A.ctx;
    master = c.createGain(); master.gain.value = A.muted ? 0 : 1; master.connect(c.destination);
    duck = c.createGain(); duck.gain.value = 1; duck.connect(master);
    whiteBuf = noiseBuf(c, 'white'); brownBuf = noiseBuf(c, 'brown'); pinkBuf = noiseBuf(c, 'pink');
    // MOTOR: 55 Hz + 110.6 Hz over brown noise lowpassed at 300 Hz; idle keeps only the 55 Hz sine.
    motorGain = c.createGain(); motorGain.gain.value = 0; motorGain.connect(duck);
    o1 = c.createOscillator(); o1.frequency.value = 55; o1.connect(motorGain);
    o2 = c.createOscillator(); o2.frequency.value = 110.6; g2 = c.createGain(); g2.gain.value = 0; o2.connect(g2); g2.connect(motorGain);
    o3 = c.createOscillator(); o3.frequency.value = 165.9; g3 = c.createGain(); g3.gain.value = 0; o3.connect(g3); g3.connect(motorGain);
    var br = c.createBufferSource(); br.buffer = brownBuf; br.loop = true;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    brownGain = c.createGain(); brownGain.gain.value = 0; br.connect(lp); lp.connect(brownGain); brownGain.connect(motorGain);
    o1.start(); o2.start(); o3.start(); br.start();
    // NIB SCRATCH
    var ws = c.createBufferSource(); ws.buffer = whiteBuf; ws.loop = true;
    scratchBP = c.createBiquadFilter(); scratchBP.type = 'bandpass'; scratchBP.frequency.value = CFG.scratchHz; scratchBP.Q.value = CFG.scratchQ;
    scratchGain = c.createGain(); scratchGain.gain.value = 0; ws.connect(scratchBP); scratchBP.connect(scratchGain); scratchGain.connect(duck); ws.start();
    // FUSE crackle bed (gated by bursts)
    fuseGain = c.createGain(); fuseGain.gain.value = 0;
    var fs = c.createBufferSource(); fs.buffer = whiteBuf; fs.loop = true;
    var fbp = c.createBiquadFilter(); fbp.type = 'bandpass'; fbp.frequency.value = 2600; fbp.Q.value = 1.5;
    fs.connect(fbp); fbp.connect(fuseGain); fuseGain.connect(duck); fs.start();
  }
  A.unlock = function () {
    try {
      if (!A.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC(); build();
      }
      if (A.ctx.state === 'suspended') { var p = A.ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* audio is optional */ }
  };
  function ok() { return A.ctx && A.ctx.state !== 'closed' && master; }
  function now() { return A.ctx.currentTime; }
  function ramp(param, v, sec) { var t = now(); param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + Math.max(0.005, sec)); }
  A.setMuted = function (m) { A.muted = !!m; try { if (ok()) master.gain.setTargetAtTime(A.muted ? 0 : 1, now(), 0.02); } catch (e) {} };
  A.suspend = function (s) { try { if (!A.ctx) return; if (s) A.ctx.suspend(); else A.ctx.resume(); } catch (e) {} };

  // The cluster: 'idle' is the 55 Hz sine alone; 'train' is the full motor, +1 dB per doubling of training cards.
  A.motor = function (mode, cards, sec) {
    if (!ok()) return; state = mode;
    try {
      sec = sec == null ? 0.3 : sec;
      [o1, o2, o3].forEach(function (o, i) { o.frequency.cancelScheduledValues(now()); o.frequency.setTargetAtTime([55, 110.6, 165.9][i], now(), 0.05); });
      if (mode === 'off') { ramp(motorGain.gain, 0, sec); return; }
      if (mode === 'idle') { ramp(motorGain.gain, dB(CFG.idleHumDb), sec); ramp(g2.gain, 0, sec); ramp(g3.gain, 0, sec); ramp(brownGain.gain, 0, sec); return; }
      var d = Math.min(CFG.motorMaxDb, CFG.motorDb + CFG.motorDbPerDoubling * Math.log2(Math.max(1, (cards || 8) / 8)));
      ramp(motorGain.gain, dB(d), sec); ramp(g2.gain, 1, sec); ramp(g3.gain, dB(CFG.motorHarmonicDb - CFG.motorDb), sec); ramp(brownGain.gain, dB(CFG.motorNoiseDb - CFG.motorDb), sec);
    } catch (e) {}
  };
  // A hang: the motor and the scratch cut to true silence at once; 400 ms later one 41 Hz thud.
  A.hang = function () {
    if (!ok()) return;
    try { var t = now(); motorGain.gain.cancelScheduledValues(t); motorGain.gain.setValueAtTime(0, t); scratchGain.gain.cancelScheduledValues(t); scratchGain.gain.setValueAtTime(0, t); lastScratch = 0; } catch (e) {}
    setTimeout(function () { try { tone(41, 380, CFG.hangThudDb, 0.004); } catch (e) {} }, 400);
  };
  A.windDown = function (sec) {
    if (!ok()) return;
    try { var t = now(); [o1, o2, o3].forEach(function (o, i) { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.linearRampToValueAtTime(30 * (i + 1), t + sec); }); ramp(motorGain.gain, 0, sec); ramp(scratchGain.gain, 0, 0.2); } catch (e) {}
  };
  A.scratch = function (v) {
    if (!ok()) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - lastScratch) < 0.01) return; lastScratch = v;
    try { scratchGain.gain.setTargetAtTime(dB(CFG.scratchDb) * v, now(), 0.03); } catch (e) {}
  };
  A.hatch = function (ms) {
    if (!ok()) return; try {
      var t = now(), g = scratchGain.gain, n = Math.max(4, Math.floor(ms / 45)), peak = dB(CFG.scratchDb - 2);
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      for (var i = 0; i < n; i++) { var a = t + (i * ms / n) / 1000; g.linearRampToValueAtTime(peak, a + 0.012); g.linearRampToValueAtTime(peak * 0.25, a + 0.04); }
      g.linearRampToValueAtTime(0, t + ms / 1000 + 0.05); lastScratch = -1;
    } catch (e) {}
  };
  // the fuse: faint crackle bursts at 8 to 14 Hz while one burns
  var fuseOn = false, fuseTimer = null;
  A.fuse = function (on) {
    if (!ok() || on === fuseOn) return; fuseOn = on;
    if (fuseTimer) { clearTimeout(fuseTimer); fuseTimer = null; }
    if (!on) { try { fuseGain.gain.setTargetAtTime(0, now(), 0.01); } catch (e) {} return; }
    (function burst() {
      if (!fuseOn || !ok()) return;
      try { var t = now(); fuseGain.gain.cancelScheduledValues(t); fuseGain.gain.setValueAtTime(dB(CFG.fuseDb) * (0.5 + Math.random()), t); fuseGain.gain.exponentialRampToValueAtTime(0.00001, t + 0.012); } catch (e) {}
      fuseTimer = setTimeout(burst, 1000 / (8 + Math.random() * 6));
    })();
  };

  function tone(freq, ms, db, attack, type) {
    var c = A.ctx, t = now(), o = c.createOscillator(), g = c.createGain();
    if (type) o.type = type;
    o.frequency.value = freq; g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dB(db), t + (attack || 0.001));
    g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
    o.connect(g); g.connect(duck); o.start(t); o.stop(t + ms / 1000 + 0.02);
    return o;
  }
  function noise(buf, type, freq, q, ms, db, attack) {
    var c = A.ctx, t = now(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(attack ? 0 : dB(db), t); if (attack) g.gain.linearRampToValueAtTime(dB(db), t + attack);
    g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
    s.connect(f); f.connect(g); g.connect(duck); s.start(t, Math.random() * 1.5); s.stop(t + ms / 1000 + 0.02);
    return { f: f, g: g };
  }
  function gate(key, ms) { var t = performance.now(); if (t - (last[key] || 0) < ms) return false; last[key] = t; return true; }

  A.token = function () { if (!ok() || !gate('tok', 18)) return; try { tone(CFG.tokenHz, CFG.tokenMs, CFG.tokenDb); } catch (e) {} };
  A.cardTick = function () { if (!ok() || !gate('card', 30)) return; try { tone(CFG.printHz, CFG.printMs + 10, CFG.printDb); } catch (e) {} };
  A.jag = function () { if (!ok() || !gate('jag', 25)) return; try { noise(whiteBuf, 'bandpass', CFG.scratchHz, 1.2, 4, CFG.jagDb); } catch (e) {} };
  // payroll: a register chunk
  A.payroll = function () { if (!ok()) return; try { tone(70, 60, CFG.payrollDb, 0.002); noise(whiteBuf, 'highpass', 2000, 0.7, 3, CFG.payrollDb - 4); } catch (e) {} };
  // money landing: coins counted onto glass
  A.cash = function (n) {
    if (!ok()) return; try {
      var k = Math.min(14, n || 8);
      for (var i = 0; i < k; i++) (function (i) { setTimeout(function () { try { tone(1900 + i * 70 + Math.random() * 120, 90, CFG.cashDb, 0.002); } catch (e) {} }, i * 45); })(i);
    } catch (e) {}
  };
  A.letter = function () { if (!ok()) return; try { noise(pinkBuf, 'lowpass', 1200, 0.7, 400, CFG.letterDb, 0.12); } catch (e) {} };
  A.take = function () { if (!ok()) return; try { tone(120, 40, CFG.takeDb, 0.002); noise(whiteBuf, 'bandpass', 2000, 2, 6, CFG.takeDb - 4); } catch (e) {} };
  A.pass = function () { if (!ok()) return; try { var n = noise(pinkBuf, 'lowpass', 1200, 0.7, 300, CFG.passDb); var t = now(); n.f.frequency.setValueAtTime(1600, t); n.f.frequency.linearRampToValueAtTime(500, t + 0.3); } catch (e) {} };
  A.strike = function () { if (!ok()) return; try { var n = noise(whiteBuf, 'bandpass', 3800, 1.4, 600, CFG.scratchDb - 2, 0.05); } catch (e) {} };
  A.write = function (ms) {
    if (!ok()) return;
    var n = Math.max(3, Math.min(30, Math.floor(ms / 70)));
    for (var i = 0; i < n; i++) setTimeout(function () { try { noise(whiteBuf, 'bandpass', 4200 + Math.random() * 1500, 2.5, 40 + Math.random() * 30, CFG.writeDb); } catch (e) {} }, i * 70 + Math.random() * 30);
  };
  A.lift = function () {
    if (!ok()) return; try {
      var c = A.ctx, t = now(), g = c.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(CFG.liftDb), t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + CFG.liftDecay); g.connect(duck);
      [[55, 0], [110, 0], [220, CFG.liftOvertoneDb - CFG.liftDb]].forEach(function (p) {
        var o = c.createOscillator(), og = c.createGain(); o.frequency.value = p[0]; og.gain.value = dB(p[1]);
        o.connect(og); og.connect(g); o.start(t); o.stop(t + CFG.liftDecay + 0.05);
      });
    } catch (e) {}
  };
  A.feed = function (ms) {
    if (!ok()) return; try {
      var c = A.ctx, t = now(), o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = CFG.feedHz; f.type = 'lowpass'; f.frequency.value = CFG.feedLpHz;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(CFG.feedDb), t + 0.06);
      g.gain.setValueAtTime(dB(CFG.feedDb), t + Math.max(0.07, ms / 1000 - 0.12)); g.gain.linearRampToValueAtTime(0, t + ms / 1000);
      o.connect(f); f.connect(g); g.connect(duck); o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch (e) {}
  };
  A.duckSilence = function (duckMs, holdMs, backMs) {
    if (!ok()) return; try {
      var t = now(), g = duck.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + duckMs / 1000);
      g.setValueAtTime(0, t + (duckMs + holdMs) / 1000); g.linearRampToValueAtTime(1, t + (duckMs + holdMs + backMs) / 1000);
    } catch (e) {}
  };
  A.vibrate = function (ms) { try { if (A.ctx && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };
  return A;
})();
