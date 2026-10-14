/* The cluster as a strip of cells: one cell per card, nodes of 8 above 128 cards, pods of 64 above 2,048.
   Owned cells are solid ink, rented hollow, ordered pencil outlines, serving cool, idle graphite. A filament glow lives only inside cells that are training. */
(function (X) {
  'use strict';
  var clamp = X.clamp, T = X.tokens;
  var NODE_ABOVE = 128, POD_ABOVE = 2048;
  var KIND = { office: 'w', a100: 'A', cloud: 'r', meridian: 'm' };
  var st = { unit: 0, born: [], prev: 0, sprites: {}, sig: '', wake: -9, wasTraining: false, kinds: [], lastDraw: 0 };
  X.resetCells = function () { st = { unit: 0, born: [], prev: 0, sprites: {}, sig: '', wake: -9, wasTraining: false, kinds: [], lastDraw: 0 }; };

  function cardList() {
    var G = X.G, S = X.S, list = [], i, k;
    for (i = 0; i < S.owned.v100; i++) list.push('w');
    for (i = 0; i < S.owned.a100; i++) list.push('A');
    S.orders.forEach(function (o) { var u = clamp((S.day - o.ordered) / Math.max(1, o.arrive - o.ordered), 0, 1); for (k = 0; k < o.n; k++) list.push((o.type === 'a100' ? 'P' : 'o') + u.toFixed(3)); });
    S.rentals.forEach(function (r) { if (S.day < r.end) for (k = 0; k < r.n; k++) list.push(S.day >= r.start ? 'r' : 'R'); });
    if (S.mer) { var live = S.day >= S.mer.live; for (k = 0; k < S.mer.cards; k++) list.push(!live ? 'M' : k < S.mer.alloc ? 'm' : 'q'); }
    // lent out cells come out of the office rack
    var lent = S.lent && S.day < S.lent.until ? S.lent.n : 0;
    for (i = 0; i < list.length && lent > 0; i++) if (list[i] === 'w') { list[i] = 'L'; lent--; }
    // serving cards come out of the biggest pool
    var sv = S.serving, serve = sv ? sv.n : 0, sk = sv ? KIND[sv.pool] : null;
    for (i = list.length - 1; i >= 0 && serve > 0; i--) { if (list[i] === sk) { list[i] = 's'; serve--; } }
    // the cards a run is using: the first ones of its pool, in order
    var taken = {};
    S.active.forEach(function (r) {
      var kind = KIND[r.pool], n = r.cards, hung = !!r.hang;
      for (i = 0; i < list.length && n > 0; i++) if (list[i] === kind && !taken[i]) { taken[i] = hung ? 'h' : 't'; n--; }
    });
    return { list: list, taken: taken };
  }
  function unitFor(n) { return n > POD_ABOVE ? 64 : n > NODE_ABOVE ? 8 : 1; }
  function geom(nUnits, unit, w, h) {
    var cols = 64, rows = 2;
    if (unit > 1) { rows = nUnits <= 21 ? 1 : clamp(Math.ceil(nUnits / 64), 2, 4); cols = clamp(Math.ceil(nUnits / rows), 21, 64); }
    var pitch = w / cols, cw = Math.max(1, pitch - (pitch > 10 ? 2 : 1));
    var gap = rows <= 2 ? 4 : 3, rh = Math.min(20, (h - 2 - (rows - 1) * gap) / rows);
    var top = rows <= 2 ? Math.max(1, (h - (rh * rows + gap * (rows - 1))) / 2) : 1;
    return { cols: cols, rows: rows, pitch: pitch, cw: cw, rh: rh, gap: gap, top: top };
  }
  // the filament: an inner glow a few pixels deep, warm against the cold sheet. Pre-drawn once per cell size.
  function glowSprite(cw, rh, dpr, solid) {
    var key = cw.toFixed(2) + 'x' + rh.toFixed(2) + (solid ? 's' : 'h') + dpr;
    var sp = st.sprites[key]; if (sp) return sp;
    var W = Math.max(1, Math.ceil(cw * dpr)), H = Math.max(1, Math.ceil(rh * dpr));
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), depth = (cw < 8 ? 0.9 : clamp(Math.min(cw, rh) * 0.12, 1.2, 2.2)) * dpr, inset = 1 * dpr;
    for (var k = 0; k < depth; k += 0.45) {
      var a = Math.pow(1 - k / depth, 1.6) * (solid ? 1 : 0.9);
      g.strokeStyle = X.rgba(T.filament, a.toFixed(3)); g.lineWidth = 0.55;
      g.strokeRect(inset + k + 0.25, inset + k + 0.25, Math.max(0.5, W - 2 * (inset + k) - 0.5), Math.max(0.5, H - 2 * (inset + k) - 0.5));
    }
    st.sprites[key] = cv; return cv;
  }

  X.drawCells = function (force) {
    var cv = X.$('cells'); if (!cv) return;
    var S = X.S, G = X.G, now = X.nowMs() / 1000;
    var r = cv.getBoundingClientRect(); if (r.width < 20) return;
    var cl = cardList(), list = cl.list, taken = cl.taken, unit = unitFor(list.length);
    var anyTrain = Object.keys(taken).some(function (k) { return taken[k] === 't'; });
    var sig = list.join('') .length + ':' + list.slice(0, 40).join('') + ':' + Object.keys(taken).length + (anyTrain ? 't' : '') + ':' + Math.round(r.width) + ':' + unit + ':' + (S.over ? 'o' : '');
    var animating = anyTrain || (now - st.wake < 1.4) || st.born.some(function (b) { return b != null && now - b < 0.5; });
    if (!force && !animating && sig === st.sig && now - st.lastDraw < 0.9) return;
    st.sig = sig; st.lastDraw = now;
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = r.width, h = r.height, W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; st.sprites = {}; }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var units = []; for (var i = 0; i < list.length; i += unit) { var grp = list.slice(i, i + unit), tk = 0, hg = 0; for (var q = i; q < Math.min(list.length, i + unit); q++) { if (taken[q] === 't') tk++; else if (taken[q] === 'h') hg++; } units.push({ k: list[i], t: tk * 2 >= grp.length ? 't' : hg * 2 >= grp.length ? 'h' : '' }); }
    if (unit !== st.unit) { st.unit = unit; st.born = []; st.prev = units.length; st.kinds = []; }
    // new cells draw in one after another, a tick each
    if (units.length > st.prev) { var nNew = units.length - st.prev, stg = Math.min(0.06, 0.9 / nNew); for (var ni = st.prev; ni < units.length; ni++) st.born[ni] = now + (ni - st.prev) * stg; }
    st.prev = units.length;
    // a run starting wakes the cells left to right
    if (anyTrain && !st.wasTraining) { st.wake = now; X.AUD.cardTick && X.AUD.cardTick(); }
    st.wasTraining = anyTrain;
    var Gm = geom(units.length, unit, w, h), breathe = X.reduced() ? 1 : 1 + 0.06 * Math.sin(now * Math.PI);
    for (i = 0; i < units.length; i++) {
      var col = i % Gm.cols, row = Math.floor(i / Gm.cols); if (row >= Gm.rows) break;
      var x = col * Gm.pitch, y = Gm.top + row * (Gm.rh + Gm.gap), u = units[i], kind = u.k.charAt(0), cw = Gm.cw, rh = Gm.rh;
      var bornAt = st.born[i], drawU = bornAt == null ? 1 : X.reduced() ? 1 : clamp((now - bornAt) / 0.08, 0, 1);
      if (drawU <= 0) continue;
      var wk = X.reduced() ? 1 : clamp((now - st.wake - col * 0.05) / 0.2, 0, 1);
      var train = u.t === 't', hung = u.t === 'h';
      c.globalAlpha = drawU; c.lineWidth = 1;
      if (kind === 'w' || kind === 'A') {
        c.fillStyle = train ? T.ink : hung ? T.ink : T.graphite; c.fillRect(x, y, cw, rh);
        if (kind === 'A' && cw > 3) { c.strokeStyle = T.paper; c.strokeRect(x + 1.5, y + 1.5, cw - 3, rh - 3); }
      } else if (kind === 'r' || kind === 'R') {
        c.strokeStyle = kind === 'R' ? T.graphite : (train || hung ? T.ink : T.graphite);
        if (kind === 'R') c.setLineDash([1.5, 1.5]);
        c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
      } else if (kind === 'm' || kind === 'M' || kind === 'q') {
        c.strokeStyle = kind === 'M' || kind === 'q' ? T.graphite : (train || hung ? T.ink : T.graphite); if (kind !== 'm') c.setLineDash([1.5, 2]);
        c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
        if (unit === 1 && kind === 'm') { c.fillStyle = c.strokeStyle; c.fillRect(Math.round(x + cw / 2 - 0.5), Math.round(y + rh / 2 - 0.5), 1, 1); }
      } else if (kind === 'o' || kind === 'P') {
        var uu = +u.k.slice(1); c.strokeStyle = T.graphite; c.setLineDash([1, 4 + (0.01 - 4) * uu]); c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.setLineDash([]);
        if (kind === 'P' && cw > 4) { c.globalAlpha *= 0.6; c.strokeRect(x + 2.5, y + 2.5, cw - 5, rh - 5); }
      } else if (kind === 's') { c.fillStyle = T.grid; c.fillRect(x, y, cw, rh); }
      else if (kind === 'L') { c.strokeStyle = T.grid; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); c.beginPath(); c.moveTo(x + 0.5, y + rh - 0.5); c.lineTo(x + cw - 0.5, y + 0.5); c.stroke(); }
      if (hung) { c.strokeStyle = T.vermilion; c.strokeRect(x + 0.5, y + 0.5, cw - 1, rh - 1); }
      // training: a filament inner glow, breathing at half a hertz, flaring in left to right at the start
      if (train && wk > 0) {
        var flick = X.reduced() ? 1 : 1 + 0.035 * Math.sin(now * 7.3 + i * 1.91) * Math.sin(now * 3.1 + i * 0.7);
        var flare = X.reduced() ? 0 : Math.max(0, 0.7 * Math.exp(-(now - st.wake - col * 0.05) / 0.25));
        c.globalAlpha = clamp((breathe * flick + flare) * 0.95, 0, 1) * Math.min(drawU, wk);
        var spr = glowSprite(cw, rh, dpr, kind === 'w' || kind === 'A');
        c.drawImage(spr, x, y, cw, rh);
        if (flare > 0.05) { c.globalAlpha = clamp(flare, 0, 1); c.drawImage(spr, x, y, cw, rh); }
      }
      c.globalAlpha = 1;
    }
    // the count, in pencil
    var phys = S.owned.v100 + S.owned.a100 + (S.rentals.reduce(function (a, rr) { return a + (S.day < rr.end ? rr.n : 0); }, 0)) + (S.mer ? S.mer.cards : 0);
    var ord = S.orders.reduce(function (a, o) { return a + o.n; }, 0);
    var txt = phys.toLocaleString('en-US') + (ord ? ' +' + ord.toLocaleString('en-US') : '');
    X.setText('cells-n', txt);
  };
})(window.FX);
