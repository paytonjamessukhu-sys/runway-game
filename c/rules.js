/* FRONTIER rules: pure math, shared by the game and the node sim in test/. No DOM. */
(function (root) {
  function make(CFG) {
    var R = {};
    var LN10 = Math.log(10);
    R.T_days = function (C) { return Math.min(C / CFG.runTLin, CFG.runTA * Math.pow(C / CFG.runTRef, CFG.runTExp)); };
    // largest compute that runs free on the owned eight (about 1.77e20): where the two run-length laws meet
    R.freeC = Math.pow(CFG.runTA * CFG.runTLin / Math.pow(CFG.runTRef, CFG.runTExp), 1 / (1 - CFG.runTExp));
    R.gpus = function (C) { return C <= R.freeC ? CFG.ownedGPUs : Math.max(CFG.ownedGPUs, C / (R.T_days(C) * CFG.gpuDayFlops)); };
    R.costLights = function (C) { return (R.gpus(C) - CFG.ownedGPUs) * R.T_days(C) * CFG.gpuDayDollars / CFG.lightDollars; };
    // the largest compute whose cost fits the inked lights
    R.C_of_spend = function (lights) {
      if (!(lights > 0)) return R.freeC;
      var lo = R.freeC, hi = 1e30;
      if (R.costLights(lo) > lights) return R.freeC;
      for (var i = 0; i < 70; i++) { var m = Math.sqrt(lo * hi); if (R.costLights(m) <= lights) lo = m; else hi = m; }
      return lo;
    };
    R.pourSec = function (T) { return CFG.pourBase + CFG.pourLog * Math.log(1 + T) / Math.LN2; };
    R.tokens = function (C) { return CFG.tokA * Math.pow(C / CFG.tokRef, CFG.tokExp); };
    R.C_of_tokens = function (D) { return CFG.tokRef * Math.pow(D / CFG.tokA, 1 / CFG.tokExp); };
    R.Lline = function (C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); };
    R.P0 = Math.pow(10, -3.5);
    // noise-free training loss of a run of compute C at progress p (spec: trainingRun)
    R.lossAt = function (C, p) {
      p = Math.max(R.P0, Math.min(1, p));
      var z = (Math.log(p) / LN10 + 3.5) / 3.5;
      var yl = Math.log(R.Lline(p * C));
      var H0 = Math.log(CFG.startLoss) - Math.log(R.Lline(R.P0 * C));
      return Math.exp(yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z)));
    };
    R.zOf = function (p) { return (Math.log(Math.max(R.P0, p)) / LN10 + 3.5) / 3.5; };
    // 0 clean, 1..5 fray grade, 6 past the wall
    R.grade = function (r) {
      if (r < CFG.cleanR) return 0;
      if (r <= 1) return Math.min(CFG.frayGrades, 1 + Math.floor((r - CFG.cleanR) / CFG.frayStep + 1e-9));
      return CFG.frayGrades + 1;
    };
    R.payrollPerDay = function (lastInk) {
      if (CFG.payrollMode === 'ink') return CFG.payrollInkShare * Math.max(0, lastInk);
      if (CFG.payrollMode === 'flat') return CFG.payrollFlatLights;
      return 0;
    };
    R.drawW = function (rng) { return Math.exp(Math.log(CFG.W_lo) + rng() * (Math.log(CFG.W_hi) - Math.log(CFG.W_lo))); };
    R.drawCaps = function (rng) {
      var v = CFG.caps.map(function (c) { return c[1] * Math.pow(10, (rng() * 2 - 1) * c[2]); }).sort(function (a, b) { return a - b; });
      return CFG.caps.map(function (c, i) { return { id: c[0], C: v[i], L: R.Lline(v[i]), fired: false }; });
    };
    R.dateOf = function (day) {
      var s = CFG.startDateUTC, d = new Date(Date.UTC(s[0], s[1], s[2]) + Math.floor(day + 1e-9) * 86400000);
      return d;
    };
    var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    R.fmtDay = function (day, withYear) {
      var d = R.dateOf(day), dd = String(d.getUTCDate()); if (dd.length < 2) dd = '0' + dd;
      return dd + ' ' + MON[d.getUTCMonth()] + (withYear ? ' ' + d.getUTCFullYear() : '');
    };
    return R;
  }
  var api = { make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FRONTIER_RULES = api;
})(this);
