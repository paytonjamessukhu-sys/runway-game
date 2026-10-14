/* FRONTIER, on paper: shared helpers for every UI file. Nothing here decides the rules. */
window.FX = (function () {
  'use strict';
  var X = { G: null, S: null, F: null, ui: null };
  X.CFG = window.FRONTIER_CFG; X.WORLD = window.FRONTIER_WORLD; X.AUD = window.FrontierAudio;
  X.$ = function (id) { return document.getElementById(id); };
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  X.reduced = function () { return !!(mqReduce && mqReduce.matches); };
  X.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  X.log10 = function (x) { return Math.log(x) / Math.LN10; };
  X.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  X.nowMs = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  X.isTouch = function () { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); };
  X.tokens = (function () { var cs = getComputedStyle(document.documentElement), o = {}, d = { paper: '#E4E5E1', ink: '#15171A', grid: '#CCCFCA', graphite: '#6E7378', reserve: '#F8F8F5', vermilion: '#E5482E', dry: '#A9ACAA', filament: '#FF7A21' }; Object.keys(d).forEach(function (k) { var v = (cs.getPropertyValue('--' + k) || '').trim(); o[k] = /^#[0-9a-f]{6}$/i.test(v) ? v : d[k]; }); return o; })();
  // canvas font strings: the three families with the same fallbacks the stylesheet has
  X.FONT = { mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace', serif: '"Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif', hand: '"Caveat", "Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive' };
  X.fMono = function (px, italic, weight) { return (italic ? 'italic ' : '') + (weight || 400) + ' ' + px + 'px ' + X.FONT.mono; };
  X.fSerif = function (px, italic) { return (italic ? 'italic ' : '') + '400 ' + px + 'px ' + X.FONT.serif; };
  X.fHand = function (px, weight) { return (weight || 400) + ' ' + px + 'px ' + X.FONT.hand; };
  X.mix = function (a, b, u, al) { var A = X.tokens[a].replace('#', ''), B = X.tokens[b].replace('#', ''); function ch(h, i) { return parseInt(h.substr(i, 2), 16); } u = u < 0 ? 0 : u > 1 ? 1 : u; return 'rgba(' + Math.round(ch(A, 0) + (ch(B, 0) - ch(A, 0)) * u) + ',' + Math.round(ch(A, 2) + (ch(B, 2) - ch(A, 2)) * u) + ',' + Math.round(ch(A, 4) + (ch(B, 4) - ch(A, 4)) * u) + ',' + (al == null ? 1 : al) + ')'; };
  X.rgba = function (hex, a) { var h = hex.replace('#', ''); if (h.length !== 6) return hex; return 'rgba(' + parseInt(h.substr(0, 2), 16) + ',' + parseInt(h.substr(2, 2), 16) + ',' + parseInt(h.substr(4, 2), 16) + ',' + a + ')'; };
  X.store = {
    get: function (k) { try { return window.localStorage.getItem('frontier.dash.c.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem('frontier.dash.c.' + k, v); } catch (e) {} }
  };

  /* ---- cached writes: touch the DOM only when the text changed ---- */
  var cache = {};
  X.cache = cache;
  X.setText = function (id, t) { var el = X.$(id); if (el && el.textContent !== t) el.textContent = t; };
  X.setHTML = function (id, h) { if (cache[id] === h) return false; cache[id] = h; var el = X.$(id); if (el) el.innerHTML = h; return true; };
  X.setClass = function (id, cls, on) { var el = X.$(id); if (el) el.classList.toggle(cls, !!on); };

  /* ---- plain numbers ---- */
  X.cash = function (x) {
    var a = Math.abs(x), s = x < 0 ? '−$' : '$';
    if (a >= 1e9) return s + (a / 1e9).toFixed(3) + 'B';
    if (a >= 1e8) return s + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e7) return s + (a / 1e6).toFixed(2) + 'M';
    if (a >= 1e6) return s + (a / 1e6).toFixed(3) + 'M';
    if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
    return s + Math.round(a);
  };
  X.broke = function (m) { if (!isFinite(m) || m >= 1200) return 'no limit'; if (m >= 240) return '20+ years'; return m >= 10 ? String(Math.floor(m)) : (Math.floor(m * 10) / 10).toFixed(1); };
  X.times = function (x) { // 541x, 1,230x, 4.2x
    if (!isFinite(x)) return '—';
    if (x >= 1000) return Math.round(x).toLocaleString('en-US') + '×';
    if (x >= 10) return Math.round(x) + '×';
    return x.toFixed(1) + '×';
  };
  X.signed = function (x, f) { return (x >= 0 ? '+' : '−') + f(Math.abs(x)); };

  /* ---- tweened figures: money ticks, months slide to their new value ---- */
  var tw = {};
  X.tween = function (id, target, fmt, dt, rate) {
    var el = X.$(id); if (!el) return;
    var t = tw[id] || (tw[id] = { v: target, shown: null });
    if (!isFinite(target)) { t.v = target; } else if (!isFinite(t.v) || X.reduced()) t.v = target; else { var k = 1 - Math.exp(-(rate || 10) * dt); t.v += (target - t.v) * k; if (Math.abs(target - t.v) < Math.abs(target) * 1e-7 + 1e-9) t.v = target; }
    var txt = fmt(t.v); if (t.shown !== txt) { t.shown = txt; el.textContent = txt; }
    return t.v;
  };
  X.tweenValue = function (id) { return tw[id] ? tw[id].v : null; };
  X.tweenReset = function (id) { delete tw[id]; };

  /* ---- floating costs: the amount rises off the pressed button for 1.2 s ---- */
  X.float = function (rect, text, kind) {
    var box = X.$('floats'); if (!box || !rect) return;
    var el = document.createElement('span'); el.className = 'fl ' + (kind || 'out') + (X.reduced() ? ' still' : '');
    el.textContent = text; box.appendChild(el);
    var w = el.offsetWidth || 60;
    el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, rect.left + rect.width / 2 - w / 2)) + 'px';
    el.style.top = Math.max(6, rect.top - 2) + 'px';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1300);
  };
  /* one soft light, 600 ms, no text: the first time something matters */
  var lit = {};
  X.softLight = function (key, el) { if (lit[key] || !el) return; lit[key] = true; if (X.reduced()) return; el.classList.remove('soft'); void el.offsetWidth; el.classList.add('soft'); setTimeout(function () { el.classList.remove('soft'); }, 700); };
  X.hasLit = function (key) { return lit[key] === true; };
  // a class to add while something is new: one soft light, 600 ms, no text; stays for 700 ms of renders then never again
  X.fresh = function (key) { if (X.reduced()) return ''; if (lit[key] === true) return ''; if (!lit[key]) { lit[key] = 'pending'; setTimeout(function () { lit[key] = true; }, 700); } return ' fresh'; };
  X.resetLights = function () { lit = {}; };

  X.person = function (key) { return X.G && X.G.person ? X.G.person(key) : null; };
  X.initial = function (name) { return String(name || '?').charAt(0).toUpperCase(); };
  return X;
})();
