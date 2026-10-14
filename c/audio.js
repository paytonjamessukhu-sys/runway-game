/* FRONTIER sound. Web Audio only, every sound generated here. Silent until the first user gesture; every call is a
   no-op until then and every failure is swallowed. The mute button (and M) silence everything. */
window.FrontierAudio = (function () {
  'use strict';
  var A = { ctx: null, muted: false }, master, humGain, hum1, hum2, noiseGain, lp, last = {};
  try { A.muted = window.localStorage.getItem('frontier.dash.c.muted') === '1'; } catch (e) { A.muted = false; }
  function ok() { return A.ctx && master && A.ctx.state !== 'closed'; }
  function dB(d) { return Math.pow(10, d / 20); }
  function now() { return A.ctx.currentTime; }
  A.unlock = function () {
    try {
      if (!A.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        A.ctx = new AC();
        var c = A.ctx;
        master = c.createGain(); master.gain.value = A.muted ? 0 : 1; master.connect(c.destination);
        humGain = c.createGain(); humGain.gain.value = 0; humGain.connect(master);
        hum1 = c.createOscillator(); hum1.frequency.value = 55; hum1.connect(humGain); hum1.start();
        hum2 = c.createOscillator(); hum2.type = 'triangle'; hum2.frequency.value = 110.4; var g2 = c.createGain(); g2.gain.value = 0.35; hum2.connect(g2); g2.connect(humGain); hum2.start();
        var len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), l = 0;
        for (var i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
        var ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true;
        lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
        noiseGain = c.createGain(); noiseGain.gain.value = 0; ns.connect(lp); lp.connect(noiseGain); noiseGain.connect(master); ns.start();
      }
      if (A.ctx.state === 'suspended') { var p = A.ctx.resume(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) { A.ctx = null; }
  };
  A.setMuted = function (m) {
    A.muted = !!m;
    try { window.localStorage.setItem('frontier.dash.c.muted', A.muted ? '1' : '0'); } catch (e) {}
    try { if (ok()) master.gain.setTargetAtTime(A.muted ? 0 : 1, now(), 0.03); } catch (e) {}
  };
  A.suspend = function (s) { try { if (!A.ctx) return; if (s) A.ctx.suspend(); else A.ctx.resume(); } catch (e) {} };
  // the hum rises with the cluster's load: cards training (0 when idle or hung)
  A.load = function (cards, running) {
    if (!ok()) return;
    try {
      var on = running && cards > 0, lvl = on ? Math.min(-24, -36 + 2.2 * Math.log2(Math.max(1, cards / 8))) : -44;
      humGain.gain.setTargetAtTime(dB(lvl) * (on ? 1 : 0.6), now(), 0.25);
      noiseGain.gain.setTargetAtTime(on ? dB(lvl - 4) : 0, now(), 0.3);
      hum1.frequency.setTargetAtTime(on ? 55 + Math.min(8, Math.log2(Math.max(1, cards / 8))) : 50, now(), 0.4);
      lp.frequency.setTargetAtTime(on ? 220 + 40 * Math.log2(Math.max(1, cards / 8)) : 160, now(), 0.4);
    } catch (e) {}
  };
  function tone(freq, ms, db, type, attack) {
    var c = A.ctx, t = now(), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(dB(db), t + (attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + ms / 1000 + 0.05);
    return o;
  }
  function gate(k, ms) { var t = Date.now(); if (t - (last[k] || 0) < ms) return false; last[k] = t; return true; }
  A.word = function () { if (!ok() || !gate('w', 30)) return; try { tone(2300 + Math.random() * 200, 7, -40); } catch (e) {} };
  A.tick = function (up) { if (!ok() || !gate('tick', 60)) return; try { tone(up ? 1320 : 880, 40, -28, 'triangle'); } catch (e) {} };
  A.payday = function () { if (!ok()) return; try { tone(660, 90, -24, 'triangle'); setTimeout(function () { try { tone(440, 140, -24, 'triangle'); } catch (e) {} }, 90); } catch (e) {} };
  A.revenue = function () { if (!ok() || !gate('rev', 400)) return; try { tone(1760, 50, -34, 'triangle'); } catch (e) {} };
  A.hang = function () { if (!ok()) return; try { var o = tone(41, 700, -18, 'sine', 0.01); o.frequency.setValueAtTime(48, now()); o.frequency.linearRampToValueAtTime(36, now() + 0.6); } catch (e) {} };
  A.restart = function () { if (!ok()) return; try { tone(220, 120, -30, 'sine'); setTimeout(function () { try { tone(330, 120, -30, 'sine'); } catch (e) {} }, 110); } catch (e) {} };
  A.launch = function () { if (!ok()) return; try { var o = tone(110, 600, -22, 'sawtooth', 0.02); o.frequency.linearRampToValueAtTime(220, now() + 0.5); } catch (e) {} };
  A.land = function (good) { if (!ok()) return; try { tone(good ? 784 : 330, 260, -24, 'sine'); setTimeout(function () { try { tone(good ? 1175 : 247, 380, -26, 'sine'); } catch (e) {} }, 140); } catch (e) {} };
  A.knock = function () { if (!ok()) return; try { tone(180, 70, -22, 'sine'); setTimeout(function () { try { tone(160, 80, -24, 'sine'); } catch (e) {} }, 130); } catch (e) {} };
  A.click = function () { if (!ok() || !gate('c', 40)) return; try { tone(1500, 12, -36, 'square'); } catch (e) {} };
  A.bad = function () { if (!ok()) return; try { tone(196, 300, -22, 'triangle'); setTimeout(function () { try { tone(147, 420, -22, 'triangle'); } catch (e) {} }, 200); } catch (e) {} };
  A.vibrate = function (ms) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) {} };
  return A;
})();
