/* FRONTIER control room: every sound generated with Web Audio. Silent until the first gesture; every call is a
   no-op before unlock or when muted, and every failure is swallowed. The cluster hum rises with load. */
window.FrontierAudio = (function () {
  'use strict';
  var A = { ctx: null, muted: false }, master, humGain, humO1, humO2, humO3, humNoise, humLP, last = {};
  function dB(d) { return Math.pow(10, d / 20); }
  function ok() { return !!(A.ctx && master && A.ctx.state !== 'closed'); }
  function t() { return A.ctx.currentTime; }
  function gate(k, ms) { var n = performance.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; }
  function build() {
    var c = A.ctx;
    master = c.createGain(); master.gain.value = A.muted ? 0 : 0.9; master.connect(c.destination);
    humGain = c.createGain(); humGain.gain.value = 0; humGain.connect(master);
    humLP = c.createBiquadFilter(); humLP.type = 'lowpass'; humLP.frequency.value = 420; humLP.connect(humGain);
    humO1 = c.createOscillator(); humO1.type = 'sine'; humO1.frequency.value = 55;
    humO2 = c.createOscillator(); humO2.type = 'triangle'; humO2.frequency.value = 110.4;
    humO3 = c.createOscillator(); humO3.type = 'sine'; humO3.frequency.value = 165.7;
    var g1 = c.createGain(); g1.gain.value = 0.6; var g2 = c.createGain(); g2.gain.value = 0.22; var g3 = c.createGain(); g3.gain.value = 0.08;
    humO1.connect(g1); humO2.connect(g2); humO3.connect(g3); g1.connect(humLP); g2.connect(humLP); g3.connect(humLP);
    var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), l = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = l * 3.2; }
    humNoise = c.createBufferSource(); humNoise.buffer = buf; humNoise.loop = true; var gn = c.createGain(); gn.gain.value = 0.35; humNoise.connect(gn); gn.connect(humLP);
    humO1.start(); humO2.start(); humO3.start(); humNoise.start();
    A.noiseBuf = buf;
  }
  A.unlock = function () {
    try {
      if (!A.ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; A.ctx = new AC(); build(); }
      if (A.ctx.state === 'suspended') { var p = A.ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  };
  A.setMuted = function (m) { A.muted = !!m; try { if (ok()) master.gain.setTargetAtTime(A.muted ? 0 : 0.9, t(), 0.04); } catch (e) {} };
  A.suspend = function (s) { try { if (!A.ctx) return; if (s) A.ctx.suspend(); else A.ctx.resume(); } catch (e) {} };
  // load 0..1: idle racks hum faintly; a full cluster sings a little higher and louder
  A.hum = function (load, running) {
    if (!ok()) return;
    try {
      var g = running ? dB(-34 + 12 * load) : dB(-46), f = 55 * (1 + 0.06 * load);
      humGain.gain.setTargetAtTime(g, t(), 0.4);
      humO1.frequency.setTargetAtTime(f, t(), 0.6); humO2.frequency.setTargetAtTime(f * 2.007, t(), 0.6); humO3.frequency.setTargetAtTime(f * 3.013, t(), 0.6);
      humLP.frequency.setTargetAtTime(300 + 500 * load, t(), 0.6);
    } catch (e) {}
  };
  function tone(freq, ms, db, type, attack, glideTo) {
    var c = A.ctx, o = c.createOscillator(), g = c.createGain(), s = t();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, s); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, s + ms / 1000);
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(dB(db), s + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, s + ms / 1000);
    o.connect(g); g.connect(master); o.start(s); o.stop(s + ms / 1000 + 0.05);
  }
  function noise(ms, db, freq, q, type) {
    var c = A.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), s = t();
    src.buffer = A.noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq || 2000; f.Q.value = q || 1;
    g.gain.setValueAtTime(dB(db), s); g.gain.exponentialRampToValueAtTime(0.0001, s + ms / 1000);
    src.connect(f); f.connect(g); g.connect(master); src.start(s, Math.random()); src.stop(s + ms / 1000 + 0.05);
  }
  function safe(fn) { return function () { if (!ok() || A.muted) return; try { fn.apply(null, arguments); } catch (e) {} }; }
  A.tick = safe(function () { if (!gate('tick', 40)) return; tone(2600 + Math.random() * 300, 18, -38, 'square'); });
  A.cash = safe(function (up) { if (!gate('cash', 60)) return; tone(up ? 1320 : 520, 60, -30, 'triangle'); tone(up ? 1760 : 390, 90, -34, 'triangle'); });
  A.payroll = safe(function () { tone(98, 180, -22, 'sine'); noise(40, -34, 3000, 0.8, 'highpass'); for (var i = 0; i < 4; i++) setTimeout(function () { A.tick(); }, 60 + i * 55); });
  A.launch = safe(function () { tone(90, 900, -20, 'sawtooth', 0.02, 260); noise(700, -30, 900, 0.7, 'lowpass'); });
  A.land = safe(function () { tone(660, 260, -24, 'sine'); setTimeout(function () { if (ok()) tone(990, 420, -26, 'sine'); }, 140); });
  A.hang = safe(function () { tone(41, 700, -16, 'sine', 0.004); tone(82, 400, -28, 'sine'); });
  A.nan = safe(function () { tone(1400, 120, -30, 'square', 0.002, 300); });
  A.decision = safe(function () { tone(523, 140, -28, 'triangle'); setTimeout(function () { if (ok()) tone(784, 200, -30, 'triangle'); }, 120); });
  A.news = safe(function () { if (!gate('news', 400)) return; tone(1180, 50, -40, 'sine'); });
  A.click = safe(function () { if (!gate('click', 30)) return; noise(18, -34, 4200, 2); });
  A.bad = safe(function () { tone(220, 300, -26, 'sawtooth', 0.01, 150); });
  A.good = safe(function () { tone(880, 120, -30, 'sine'); setTimeout(function () { if (ok()) tone(1320, 160, -32, 'sine'); }, 90); });
  A.end = safe(function (good) { [0, 1, 2].forEach(function (i) { setTimeout(function () { if (ok()) tone(good ? [392, 494, 587][i] : [330, 262, 196][i], 600, -24, 'triangle'); }, i * 220); }); });
  A.vibrate = function (ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };
  return A;
})();
