/* FRONTIER sim, build B. Web Audio only, every sound generated here. Nothing plays before the first touch;
   every call is a silent no-op until then and every failure is swallowed. Every event also has a visual.
   The cluster is a machine in the next room: two sines and brown noise that breathe with the filament glow. */
window.FrontierAudio = (function () {
  'use strict';
  var CFG = window.FRONTIER_CONFIG.audio;
  var A = { ctx: null, muted: false };
  function dB(d) { return Math.pow(10, d / 20); }
  var master, duck, motorGain, breathe, lfo, lfoDepth, o1, o2, o3, g2, g3, brownGain, scratchBP, scratchGain, nibGain, nibBP, whiteBuf, brownBuf, pinkBuf, fuseGain;
  var lastScratch = -1, lastNib = -1, last = {}, mode = 'off';

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
    // 'breathe' carries a 0.5 Hz swell of about +-6%, the same breath as the filament glow.
    breathe = c.createGain(); breathe.gain.value = 1; breathe.connect(duck);
    lfo = c.createOscillator(); lfo.frequency.value = 0.5; lfoDepth = c.createGain(); lfoDepth.gain.value = 0;
    lfo.connect(lfoDepth); lfoDepth.connect(breathe.gain); lfo.start();
    motorGain = c.createGain(); motorGain.gain.value = 0; motorGain.connect(breathe);
    o1 = c.createOscillator(); o1.frequency.value = 55; o1.connect(motorGain);
    o2 = c.createOscillator(); o2.frequency.value = 110.6; g2 = c.createGain(); g2.gain.value = 0; o2.connect(g2); g2.connect(motorGain);
    o3 = c.createOscillator(); o3.frequency.value = 165.9; g3 = c.createGain(); g3.gain.value = 0; o3.connect(g3); g3.connect(motorGain);
    var br = c.createBufferSource(); br.buffer = brownBuf; br.loop = true;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    brownGain = c.createGain(); brownGain.gain.value = 0; br.connect(lp); lp.connect(brownGain); brownGain.connect(motorGain);
    o1.start(); o2.start(); o3.start(); br.start();
    // PEN SCRATCH (the plotter drawing the loss)
    var ws = c.createBufferSource(); ws.buffer = whiteBuf; ws.loop = true;
    scratchBP = c.createBiquadFilter(); scratchBP.type = 'bandpass'; scratchBP.frequency.value = CFG.scratchHz; scratchBP.Q.value = CFG.scratchQ;
    scratchGain = c.createGain(); scratchGain.gain.value = 0; ws.connect(scratchBP); scratchBP.connect(scratchGain); scratchGain.connect(duck); ws.start();
    // NIB on the strip: a softer, lower scratch, louder with speed
    var ns = c.createBufferSource(); ns.buffer = pinkBuf; ns.loop = true;
    nibBP = c.createBiquadFilter(); nibBP.type = 'bandpass'; nibBP.frequency.value = CFG.nibHz; nibBP.Q.value = 0.7;
    nibGain = c.createGain(); nibGain.gain.value = 0; ns.connect(nibBP); nibBP.connect(nibGain); nibGain.connect(duck); ns.start(0, 0.7);
    // FUSE crackle bed (gated by bursts)
    fuseGain = c.createGain(); fuseGain.gain.value = 0;
    var fs = c.createBufferSource(); fs.buffer = whiteBuf; fs.loop = true;
    var fbp = c.createBiquadFilter(); fbp.type = 'bandpass'; fbp.frequency.value = 2600; fbp.Q.value = 1.5;
    fs.connect(fbp); fbp.connect(fuseGain); fuseGain.connect(duck); fs.start(0, 1.3);
  }
  A.unlock = function () {
    try {
      if (!A.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        A.ctx = new AC(); build();
      }
      if (A.ctx.state === 'suspended' && !A.hidden) { var p = A.ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { /* audio is optional */ }
  };
  function ok() { return A.ctx && A.ctx.state !== 'closed' && master && !A.quiet; }
  function now() { return A.ctx.currentTime; }
  function ramp(param, v, sec) { var t = now(); param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + Math.max(0.005, sec)); }
  A.setMuted = function (m) { A.muted = !!m; try { if (ok()) master.gain.setTargetAtTime(A.muted ? 0 : 1, now(), 0.03); } catch (e) {} };
  A.suspend = function (s) { A.hidden = !!s; try { if (!A.ctx) return; if (s) A.ctx.suspend(); else A.ctx.resume(); } catch (e) {} };

  // The cluster: 'idle' is the 55 Hz sine alone; 'train' is the full motor, +1 dB per doubling of training cards.
  A.motor = function (m, cards, sec) {
    if (!ok()) return; mode = m;
    try {
      sec = sec == null ? 0.3 : sec;
      [o1, o2, o3].forEach(function (o, i) { o.frequency.cancelScheduledValues(now()); o.frequency.setTargetAtTime([55, 110.6, 165.9][i], now(), 0.05); });
      if (m === 'off') { ramp(motorGain.gain, 0, sec); ramp(lfoDepth.gain, 0, sec); return; }
      if (m === 'idle') { ramp(motorGain.gain, dB(CFG.idleHumDb), sec); ramp(g2.gain, 0, sec); ramp(g3.gain, 0, sec); ramp(brownGain.gain, 0, sec); ramp(lfoDepth.gain, 0, sec); return; }
      var d = Math.min(CFG.motorMaxDb, CFG.motorDb + CFG.motorDbPerDoubling * Math.log2(Math.max(1, (cards || 8) / 8)));
      ramp(motorGain.gain, dB(d), sec); ramp(g2.gain, 1, sec); ramp(g3.gain, dB(CFG.motorHarmonicDb - CFG.motorDb), sec); ramp(brownGain.gain, dB(CFG.motorNoiseDb - CFG.motorDb), sec);
      ramp(lfoDepth.gain, 0.06, Math.max(sec, 0.4));
    } catch (e) {}
  };
  // A hang: the motor and the scratch cut to true silence at once; 400 ms later one 41 Hz thud.
  A.hang = function () {
    if (!ok()) return;
    try {
      var t = now();
      [motorGain.gain, scratchGain.gain, lfoDepth.gain].forEach(function (g) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); });
      lastScratch = 0; mode = 'hang';
    } catch (e) {}
    setTimeout(function () { try { if (ok()) tone(41, 380, CFG.hangThudDb, 0.004); } catch (e) {} }, 400);
  };
  A.windDown = function (sec) {
    if (!ok()) return;
    try {
      var t = now();
      [o1, o2, o3].forEach(function (o, i) { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.linearRampToValueAtTime(30 * (i + 1), t + sec); });
      motorGain.gain.cancelScheduledValues(t); motorGain.gain.setValueAtTime(Math.max(motorGain.gain.value, dB(CFG.motorDb)), t); motorGain.gain.linearRampToValueAtTime(0.0001, t + sec);
      ramp(scratchGain.gain, 0, 0.2); ramp(lfoDepth.gain, 0, 0.2); mode = 'off';
    } catch (e) {}
  };
  A.scratch = function (v) {
    if (!ok()) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - lastScratch) < 0.02) return; lastScratch = v;
    try { scratchGain.gain.setTargetAtTime(dB(CFG.scratchDb) * v, now(), 0.04); } catch (e) {}
  };
  A.nib = function (v) {
    if (!ok()) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - lastNib) < 0.02) return; lastNib = v;
    try { nibGain.gain.setTargetAtTime(dB(CFG.nibDb) * v, now(), v > 0 ? 0.02 : 0.06); nibBP.frequency.setTargetAtTime(CFG.nibHz * (0.8 + 0.5 * v), now(), 0.05); } catch (e) {}
  };
  A.hatch = function (ms) {
    if (!ok()) return; try {
      var t = now(), g = scratchGain.gain, n = Math.max(4, Math.floor(ms / 45)), peak = dB(CFG.scratchDb - 2);
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      for (var i = 0; i < n; i++) { var a = t + (i * ms / n) / 1000; g.linearRampToValueAtTime(peak, a + 0.012); g.linearRampToValueAtTime(peak * 0.25, a + 0.04); }
      g.linearRampToValueAtTime(0, t + ms / 1000 + 0.05); lastScratch = -1;
    } catch (e) {}
  };
  // the fuse: faint crackle bursts at 8 to 14 Hz while one burns; onBurst lets the tip flicker with the sound
  var fuseOn = false, fuseTimer = null;
  A.onBurst = null;
  A.fuse = function (on) {
    if (on === fuseOn) return; fuseOn = on;
    if (fuseTimer) { clearTimeout(fuseTimer); fuseTimer = null; }
    if (!on) { try { if (ok()) fuseGain.gain.setTargetAtTime(0, now(), 0.01); } catch (e) {} return; }
    (function burst() {
      if (!fuseOn) return;
      var k = 0.5 + Math.random();
      try { if (ok()) { var t = now(); fuseGain.gain.cancelScheduledValues(t); fuseGain.gain.setValueAtTime(dB(CFG.fuseDb) * k, t); fuseGain.gain.exponentialRampToValueAtTime(0.00001, t + 0.012); } } catch (e) {}
      if (A.onBurst) { try { A.onBurst(k); } catch (e) {} }
      fuseTimer = setTimeout(burst, 1000 / (8 + Math.random() * 6));
    })();
  };

  function tone(freq, ms, db, attack, type, dest) {
    var c = A.ctx, t = now(), o = c.createOscillator(), g = c.createGain();
    if (type) o.type = type;
    o.frequency.value = freq; g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dB(db), t + (attack || 0.001));
    g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
    o.connect(g); g.connect(dest || duck); o.start(t); o.stop(t + ms / 1000 + 0.02);
    return o;
  }
  function noise(buf, type, freq, q, ms, db, attack, delay) {
    var c = A.ctx, t = now() + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(attack ? 0 : dB(db), t); if (attack) g.gain.linearRampToValueAtTime(dB(db), t + attack);
    g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
    s.connect(f); f.connect(g); g.connect(duck); s.start(t, Math.random() * 1.5); s.stop(t + ms / 1000 + 0.02);
    return { f: f, g: g, t: t };
  }
  function gate(key, ms) { var t = performance.now(); if (t - (last[key] || 0) < ms) return false; last[key] = t; return true; }

  A.token = function () { if (!ok() || !gate('tok', 22)) return; try { tone(CFG.tokenHz * (0.97 + Math.random() * 0.06), CFG.tokenMs, CFG.tokenDb); } catch (e) {} };
  A.cardTick = function () { if (!ok() || !gate('card', 30)) return; try { tone(CFG.printHz, CFG.printMs, CFG.printDb); } catch (e) {} };
  A.jag = function () { if (!ok() || !gate('jag', 28)) return; try { noise(whiteBuf, 'bandpass', CFG.scratchHz, 1.2, 4, CFG.jagDb); } catch (e) {} };
  // payroll: a register chunk, a 70 Hz sine with a 60 ms decay plus a 3 ms noise click
  A.payroll = function () { if (!ok()) return; try { tone(70, 60, CFG.payrollDb, 0.002); noise(whiteBuf, 'highpass', 2000, 0.7, 3, CFG.payrollDb - 4); } catch (e) {} };
  // the months figure rolling to a new value: a mechanical counter, one click per step
  A.roll = function (up) { if (!ok() || !gate('roll', 26)) return; try { noise(whiteBuf, 'bandpass', up ? 3400 : 2300, 3, 7, CFG.rollDb); tone(up ? 900 : 620, 8, CFG.rollDb - 6); } catch (e) {} };
  A.letter = function () { if (!ok()) return; try { noise(pinkBuf, 'lowpass', 1200, 0.7, 400, CFG.letterDb, 0.12); } catch (e) {} };
  A.take = function () { if (!ok()) return; try { tone(120, 40, CFG.takeDb, 0.002); noise(whiteBuf, 'bandpass', 2000, 2, 6, CFG.takeDb - 4); } catch (e) {} };
  A.pass = function () { if (!ok()) return; try { var n = noise(pinkBuf, 'lowpass', 1600, 0.7, 300, CFG.passDb, 0.03); n.f.frequency.setValueAtTime(1600, n.t); n.f.frequency.linearRampToValueAtTime(500, n.t + 0.3); } catch (e) {} };
  A.strike = function () { if (!ok()) return; try { var n = noise(whiteBuf, 'bandpass', 3800, 1.4, 600, CFG.strikeDb, 0.05); n.f.frequency.setValueAtTime(4400, n.t); n.f.frequency.linearRampToValueAtTime(3000, n.t + 0.6); } catch (e) {} };
  A.write = function (ms) {
    if (!ok()) return;
    var n = Math.max(3, Math.min(30, Math.floor(ms / 70)));
    try { for (var i = 0; i < n; i++) noise(whiteBuf, 'bandpass', 4200 + Math.random() * 1500, 2.5, 40 + Math.random() * 30, CFG.writeDb, 0.006, (i * 70 + Math.random() * 30) / 1000); } catch (e) {}
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
  // the paper feed: a soft motor whirr for pans, re-maps, regrouping cells and the new year
  A.feed = function (ms) {
    if (!ok() || !gate('feed', 120)) return; try {
      var c = A.ctx, t = now(), o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(CFG.feedHz * 0.85, t); o.frequency.linearRampToValueAtTime(CFG.feedHz * 1.1, t + ms / 2000); o.frequency.linearRampToValueAtTime(CFG.feedHz * 0.9, t + ms / 1000);
      f.type = 'lowpass'; f.frequency.value = CFG.feedLpHz;
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
  A.unduck = function () { if (!ok()) return; try { ramp(duck.gain, 1, 0.05); } catch (e) {} };
  A.vibrate = function (ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };
  A.mode = function () { return mode; };
  return A;
})();
