/* FRONTIER, build B. Web Audio only. Nothing plays before the first touch; every call
   is a silent no-op until then, and every failure is swallowed. */
window.FrontierAudio = (function () {
  'use strict';
  const CFG = window.FRONTIER_CONFIG.audio;
  const A = { ctx: null, muted: false };
  const dB = d => Math.pow(10, d / 20);
  let master, duck, motorGain, motorO1, motorO2, motorO3, scratchBP, scratchGain, whiteBuf, brownBuf;
  let motorTarget = CFG.motorDb, motorOn = false, lastScratch = -1;
  let lastPayroll = 0, lastPrint = 0, lastJag = 0, lastToken = 0;

  function noiseBuf(c, kind) {
    const len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  function build() {
    const c = A.ctx;
    master = c.createGain(); master.gain.value = A.muted ? 0 : 1; master.connect(c.destination);
    duck = c.createGain(); duck.gain.value = 1; duck.connect(master);
    whiteBuf = noiseBuf(c, 'white'); brownBuf = noiseBuf(c, 'brown');
    // MOTOR: 55 Hz + 110.6 Hz sines over lowpassed brown noise. A faint 165.9 Hz partial so a phone speaker can find it.
    motorGain = c.createGain(); motorGain.gain.value = 0; motorGain.connect(duck);
    motorO1 = c.createOscillator(); motorO1.frequency.value = 55;
    motorO2 = c.createOscillator(); motorO2.frequency.value = 110.6;
    motorO3 = c.createOscillator(); motorO3.frequency.value = 165.9;
    const g3 = c.createGain(); g3.gain.value = dB(CFG.motorHarmonicDb - CFG.motorDb);
    motorO1.connect(motorGain); motorO2.connect(motorGain); motorO3.connect(g3); g3.connect(motorGain);
    const br = c.createBufferSource(); br.buffer = brownBuf; br.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const bg = c.createGain(); bg.gain.value = dB(CFG.motorNoiseDb - CFG.motorDb);
    br.connect(lp); lp.connect(bg); bg.connect(motorGain);
    motorO1.start(); motorO2.start(); motorO3.start(); br.start();
    // NIB SCRATCH: white noise through a 3.2 kHz bandpass, gain follows pen speed.
    const ws = c.createBufferSource(); ws.buffer = whiteBuf; ws.loop = true;
    scratchBP = c.createBiquadFilter(); scratchBP.type = 'bandpass'; scratchBP.frequency.value = CFG.scratchHz; scratchBP.Q.value = CFG.scratchQ;
    scratchGain = c.createGain(); scratchGain.gain.value = 0;
    ws.connect(scratchBP); scratchBP.connect(scratchGain); scratchGain.connect(duck); ws.start();
  }

  A.unlock = function () {
    try {
      if (!A.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* optional */ }
        A.ctx = new AC();
        build();
      }
      if (A.ctx.state === 'suspended') { const p = A.ctx.resume(); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* audio is optional */ }
  };
  const ok = () => A.ctx && A.ctx.state !== 'closed' && master;
  const now = () => A.ctx.currentTime;

  A.setMuted = function (m) {
    A.muted = !!m;
    try { if (ok()) master.gain.setTargetAtTime(A.muted ? 0 : 1, now(), 0.02); } catch (e) {}
  };
  A.suspend = function (s) {
    try { if (!A.ctx) return; if (s) A.ctx.suspend(); else A.ctx.resume(); } catch (e) {}
  };

  // ---------- motor ----------
  A.motorStart = function (ms) {
    if (!ok()) return; try {
      const t = now(); motorOn = true;
      [motorO1, motorO2, motorO3].forEach((o, i) => { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime([55, 110.6, 165.9][i], t); });
      motorGain.gain.cancelScheduledValues(t); motorGain.gain.setValueAtTime(motorGain.gain.value, t);
      motorGain.gain.linearRampToValueAtTime(dB(motorTarget), t + ms / 1000);
    } catch (e) {}
  };
  A.motorLevel = function (inkLights) {
    const d = Math.min(CFG.motorMaxDb, CFG.motorDb + CFG.motorDbPerDoubling * Math.log2(Math.max(1, inkLights || 0)));
    if (Math.abs(d - motorTarget) < 0.1) return;
    motorTarget = d;
    if (!ok() || !motorOn) return;
    try { motorGain.gain.setTargetAtTime(dB(d), now(), 0.25); } catch (e) {}
  };
  A.motorStop = function (ms) {
    if (!ok()) return; motorOn = false;
    try { const t = now(); motorGain.gain.cancelScheduledValues(t); motorGain.gain.setValueAtTime(motorGain.gain.value, t); motorGain.gain.linearRampToValueAtTime(0, t + ms / 1000); } catch (e) {}
  };
  A.motorReverse = function () {};

  // ---------- nib scratch ----------
  A.scratch = function (v) {
    if (!ok()) return;
    v = Math.max(0, Math.min(1, v));
    if (Math.abs(v - lastScratch) < 0.01) return; lastScratch = v;
    try { scratchGain.gain.setTargetAtTime(dB(CFG.scratchDb) * v, now(), 0.03); } catch (e) {}
  };
  // A pen dragged across hatch lines: the scratch, modulated at the line rate.
  A.hatch = function (ms) {
    if (!ok()) return; try {
      const t = now(), g = scratchGain.gain, n = Math.max(4, Math.floor(ms / 45)), peak = dB(CFG.scratchDb - 2);
      scratchBP.frequency.setValueAtTime(CFG.scratchHz, t);
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      for (let i = 0; i < n; i++) { const a = t + (i * ms / n) / 1000; g.linearRampToValueAtTime(peak, a + 0.012); g.linearRampToValueAtTime(peak * 0.25, a + 0.04); }
      g.linearRampToValueAtTime(0, t + ms / 1000 + 0.05); lastScratch = -1;
    } catch (e) {}
  };
  // The pen running dry: the scratch thins, the motor winds down, then true silence.
  A.dryPen = function (fadeMs, windMs) {
    if (!ok()) return; motorOn = false; try {
      const t = now();
      scratchBP.frequency.cancelScheduledValues(t); scratchBP.frequency.setValueAtTime(CFG.scratchHz, t); scratchBP.frequency.linearRampToValueAtTime(6000, t + fadeMs / 1000);
      scratchGain.gain.cancelScheduledValues(t); scratchGain.gain.setValueAtTime(Math.max(scratchGain.gain.value, dB(CFG.scratchDb - 6)), t); scratchGain.gain.linearRampToValueAtTime(0, t + fadeMs / 1000);
      [motorO1, motorO2, motorO3].forEach((o, i) => { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.linearRampToValueAtTime(30 * (i + 1), t + windMs / 1000); });
      motorGain.gain.cancelScheduledValues(t); motorGain.gain.setValueAtTime(motorGain.gain.value, t); motorGain.gain.linearRampToValueAtTime(0, t + windMs / 1000);
      lastScratch = -1;
    } catch (e) {}
  };
  A.scratchReset = function () { if (!ok()) return; try { scratchBP.frequency.setValueAtTime(CFG.scratchHz, now()); } catch (e) {} };

  // ---------- one-shots ----------
  function sine(freq, ms, db, attack) {
    const c = A.ctx, t = now(), o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq; g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(dB(db), t + (attack || 0.001));
    g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
    o.connect(g); g.connect(duck); o.start(t); o.stop(t + ms / 1000 + 0.02);
  }
  function noise(freq, q, ms, db) {
    const c = A.ctx, t = now(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = whiteBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(dB(db), t); g.gain.exponentialRampToValueAtTime(0.00001, t + ms / 1000);
    s.connect(f); f.connect(g); g.connect(duck); s.start(t, Math.random() * 1.5); s.stop(t + ms / 1000 + 0.01);
  }
  A.token = function () { if (!ok()) return; const t = performance.now(); if (t - lastToken < 18) return; lastToken = t; try { sine(CFG.tokenHz, CFG.tokenMs, CFG.tokenDb); } catch (e) {} };
  A.payroll = function () { if (!ok()) return; const t = performance.now(); if (t - lastPayroll < 55) return; lastPayroll = t; try { noise(CFG.payrollHz, 2.2, CFG.payrollMs + 6, CFG.payrollDb); } catch (e) {} };
  A.print = function () { if (!ok()) return; const t = performance.now(); if (t - lastPrint < 28) return; lastPrint = t; try { sine(CFG.printHz, CFG.printMs + 10, CFG.printDb); } catch (e) {} };
  A.jag = function () { if (!ok()) return; const t = performance.now(); if (t - lastJag < 25) return; lastJag = t; try { noise(CFG.scratchHz, 1.2, 4, CFG.jagDb); } catch (e) {} };
  A.dryScratch = function () { if (!ok()) return; try { noise(5200, 0.9, 120, CFG.scratchDb - 2); } catch (e) {} };
  A.lift = function () {
    if (!ok()) return; try {
      const c = A.ctx, t = now(), g = c.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(CFG.liftDb), t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + CFG.liftDecay);
      g.connect(duck);
      [[55, 0], [110, 0], [220, CFG.liftOvertoneDb - CFG.liftDb]].forEach(([f, rel]) => {
        const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f; og.gain.value = dB(rel);
        o.connect(og); og.connect(g); o.start(t); o.stop(t + CFG.liftDecay + 0.05);
      });
      noise(180, 0.7, 40, CFG.liftDb - 8); // the nib leaving the paper: a short soft thump
    } catch (e) {}
  };
  A.feed = function (ms) {
    if (!ok()) return; try {
      const c = A.ctx, t = now(), o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = CFG.feedHz; f.type = 'lowpass'; f.frequency.value = CFG.feedLpHz;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(CFG.feedDb), t + 0.06);
      g.gain.setValueAtTime(dB(CFG.feedDb), t + Math.max(0.07, ms / 1000 - 0.12)); g.gain.linearRampToValueAtTime(0, t + ms / 1000);
      o.connect(f); f.connect(g); g.connect(duck); o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch (e) {}
  };
  // Capability moment: everything ducks to zero after the last word, a full second of silence, then back.
  A.duckSilence = function (duckMs, holdMs, backMs) {
    if (!ok()) return; try {
      const t = now(), g = duck.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + duckMs / 1000);
      g.setValueAtTime(0, t + (duckMs + holdMs) / 1000); g.linearRampToValueAtTime(1, t + (duckMs + holdMs + backMs) / 1000);
    } catch (e) {}
  };
  A.unduck = function () { if (!ok()) return; try { const t = now(); duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(1, t); } catch (e) {} };
  return A;
})();
