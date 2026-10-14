/* FRONTIER control room: sound. Web Audio only, generated, nothing fetched. Starts after the first gesture.
   A hum that rises with cluster load, ticks for money, a low tone for a hang, a soft knock for a decision. */
window.FrontierAudio = (function () {
  var A = { muted: false, ready: false };
  var ctx = null, master = null, humGain = null, hum1 = null, hum2 = null, humFilter = null, noise = null, noiseGain = null, last = {};
  try { A.muted = window.localStorage.getItem('frontier-a-muted') === '1'; } catch (e) {}
  function ok() { return ctx && ctx.state !== 'closed' && master && !A.muted; }
  function gate(k, ms) { var t = Date.now(); if (t - (last[k] || 0) < ms) return false; last[k] = t; return true; }
  A.unlock = function () {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.9; master.connect(ctx.destination);
        humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 260; humFilter.Q.value = 0.7;
        humGain = ctx.createGain(); humGain.gain.value = 0; humFilter.connect(humGain); humGain.connect(master);
        hum1 = ctx.createOscillator(); hum1.type = 'sine'; hum1.frequency.value = 55; hum1.connect(humFilter); hum1.start();
        hum2 = ctx.createOscillator(); hum2.type = 'triangle'; hum2.frequency.value = 110.4; var g2 = ctx.createGain(); g2.gain.value = 0.35; hum2.connect(g2); g2.connect(humFilter); hum2.start();
        var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0), b0 = 0;
        for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; b0 = 0.97 * b0 + 0.03 * w; ch[i] = b0 * 3; }
        noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true; noiseGain = ctx.createGain(); noiseGain.gain.value = 0; noise.connect(noiseGain); noiseGain.connect(humFilter); noise.start();
        A.ready = true;
      }
      if (ctx.state === 'suspended') { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  };
  A.setMuted = function (m) {
    A.muted = !!m;
    try { window.localStorage.setItem('frontier-a-muted', A.muted ? '1' : '0'); } catch (e) {}
    try { if (ctx && master) master.gain.setTargetAtTime(A.muted ? 0 : 0.9, ctx.currentTime, 0.03); } catch (e) {}
  };
  A.suspend = function (s) { try { if (!ctx) return; if (s) ctx.suspend(); else if (!A.muted) ctx.resume(); } catch (e) {} };
  // load: 0..1 share of cards training; running: whether the clock moves
  A.hum = function (load, running) {
    if (!ctx || !humGain) return;
    try {
      var t = ctx.currentTime, target = running ? 0.012 + 0.05 * Math.sqrt(Math.max(0, load)) : 0.006;
      humGain.gain.setTargetAtTime(target, t, 0.4);
      humFilter.frequency.setTargetAtTime(180 + 520 * load, t, 0.6);
      hum1.frequency.setTargetAtTime(55 + 6 * load, t, 0.8);
      noiseGain.gain.setTargetAtTime(running ? 0.08 * load : 0, t, 0.5);
    } catch (e) {}
  };
  function tone(f, ms, vol, type, attack) {
    if (!ok()) return;
    try {
      var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = f; g.gain.value = 0;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + ms / 1000 + 0.05);
    } catch (e) {}
  }
  A.tick = function (up) { if (!gate('tick', 40)) return; tone(up ? 1900 : 1250, 30, 0.05, 'square'); };
  A.payroll = function () { tone(82, 160, 0.22, 'sine', 0.003); setTimeout(function () { tone(1400, 25, 0.04, 'square'); }, 30); };
  A.cashIn = function () { tone(1600, 60, 0.06, 'triangle'); setTimeout(function () { tone(2400, 80, 0.05, 'triangle'); }, 70); };
  A.hang = function () { if (!gate('hang', 300)) return; tone(41, 900, 0.3, 'sine', 0.01); tone(43.5, 900, 0.12, 'triangle', 0.01); };
  A.nan = function () { tone(220, 120, 0.06, 'sawtooth'); };
  A.launch = function () { tone(110, 500, 0.12, 'sine', 0.02); tone(220, 400, 0.05, 'triangle', 0.02); };
  A.land = function (clean) { if (clean) { tone(660, 260, 0.07, 'sine'); setTimeout(function () { tone(990, 420, 0.06, 'sine'); }, 140); } else { tone(196, 500, 0.09, 'sawtooth'); } };
  A.knock = function () { if (!gate('knock', 200)) return; tone(320, 70, 0.1, 'sine'); setTimeout(function () { tone(300, 80, 0.09, 'sine'); }, 120); };
  A.word = function () { if (!gate('word', 35)) return; tone(2200 + Math.random() * 300, 8, 0.02, 'square'); };
  A.thunk = function () { tone(92, 220, 0.2, 'sine', 0.004); setTimeout(function () { tone(61, 260, 0.14, 'triangle', 0.004); }, 40); };
  A.slip = function () { if (!gate('slip', 400)) return; tone(520, 90, 0.035, 'sine', 0.01); setTimeout(function () { tone(780, 140, 0.03, 'sine', 0.01); }, 80); };
  A.bad = function () { tone(150, 600, 0.14, 'sawtooth', 0.01); };
  A.vibrate = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} };
  return A;
})();
