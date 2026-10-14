/* FRONTIER rules: pure math, no DOM. Shared by the game and node tests. */
(function (root) {
  function make(CFG) {
    var R = {};
    var LN10 = Math.log(10);
    R.log10 = function (x) { return Math.log(x) / LN10; };
    R.tokens = function (C) { return CFG.tokA * Math.pow(C / CFG.tokRef, CFG.tokExp); };
    R.C_of_tokens = function (D) { return CFG.tokRef * Math.pow(D / CFG.tokA, 1 / CFG.tokExp); };
    R.params = function (C) { return C / (6 * R.tokens(C)); };
    R.Lline = function (C) { return Math.pow(CFG.lineC / C, CFG.lineAlpha); };
    R.P0 = Math.pow(10, -3.5);
    // noise-free training loss of a run of compute C at progress p (slice one v7 trainingRun)
    // k = m*(1+b): Sun-hee's bend and the blind penalty scale the whole target line of the run
    R.lossAt = function (C, p, k) {
      k = k || 1;
      p = Math.max(R.P0, Math.min(1, p));
      var z = (Math.log(p) / LN10 + 3.5) / 3.5;
      var yl = Math.log(R.Lline(p * C) * k);
      var H0 = Math.log(CFG.startLoss) - Math.log(R.Lline(R.P0 * C) * k);
      return Math.exp(yl + H0 * (0.6 * Math.exp(-10 * z) + 0.4 * (1 - z) * (1 - z)));
    };
    // fray amount of a checkpoint that has eaten r_p of the clean text: 0 clean, 1..5 fragments, 6 past the wall (crawl)
    R.amount = function (rp) {
      if (rp < CFG.cleanR) return 0;
      if (rp <= 1) return Math.min(CFG.frayAmounts, 1 + Math.floor((rp - CFG.cleanR) / CFG.frayStep + 1e-9));
      return CFG.frayAmounts + 1;
    };
    R.CRAWL = CFG.frayAmounts + 1;
    R.drawW = function (rng) { return Math.exp(Math.log(CFG.W_lo) + rng() * (Math.log(CFG.W_hi) - Math.log(CFG.W_lo))); };
    R.drawCaps = function (rng) {
      var v = CFG.caps.map(function (c) { return c[1] * Math.pow(10, (rng() * 2 - 1) * c[2]); }).sort(function (a, b) { return a - b; });
      return CFG.caps.map(function (c, i) { return { id: c[0], C: v[i], L: R.Lline(v[i]), fired: false }; });
    };
    R.sizeLabel = function (C) { var n = R.params(C); if (n >= 1e9) { var b = n / 1e9; return Math.round(b) + 'B'; } return Math.round(n / 1e6 / 10) * 10 + 'M'; };
    R.dateOf = function (day) {
      var s = CFG.startDateUTC;
      return new Date(Date.UTC(s[0], s[1], s[2]) + Math.floor(day + 1e-9) * 86400000);
    };
    R.monthOf = function (day) { return R.dateOf(day).getUTCMonth(); };
    R.firstOfMonth = function (m) { var s = CFG.startDateUTC; return Math.round((Date.UTC(s[0], m, 1) - Date.UTC(s[0], s[1], s[2])) / 86400000); };
    var MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    R.MON = MON;
    R.fmtDay = function (day, withYear) {
      var d = R.dateOf(day), dd = String(d.getUTCDate()); if (dd.length < 2) dd = '0' + dd;
      return dd + ' ' + MON[d.getUTCMonth()] + (withYear ? ' ' + d.getUTCFullYear() : '');
    };
    R.fmtMoney = function (x) {
      var a = Math.abs(x), s = x < 0 ? '-' : '';
      if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B';
      if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
      if (a >= 1e3) return s + '$' + Math.round(a / 1e3) + 'K';
      return s + '$' + Math.round(a);
    };
    return R;
  }
  var api = { make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FRONTIER_RULES = api;
})(this);
