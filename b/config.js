/* FRONTIER, build B. Every tunable number and every rule switch lives here.
   Source: spec/slice1.json (v6) with spec/slice1-round7.md on top.
   Patch this object when the council settles the balance; nothing else should need to change. */
window.FRONTIER_CONFIG = {
  rules: {
    payrollMode: 'ink',              // 'ink' (round 7 default) | 'flat' | 'none' | 'bank' (v6)
    wallEndsSheet: false,            // v6 behaviour: the first landing past the wall ends the sheet
    wallAdvancesAfterCrossing: false,// round 7 (Sid, not sim-tested): after a survived crossing the wall moves one rung out
    frayByAmount: true,              // round 7: grade l splices l fragments from one flat pool. false = v6 catalogue (1 fragment of grade l)
    crawlWholeLine: true,            // round 7: past the wall the whole line is a cookie banner. false = v6 back-half crawl
    miracleMergesDot: true,          // round 7: if your farthest clean dot is at or past GPT-3, their point presses onto yours
    miracleMoment: true              // ...and that moment gets the whole screen and the silent second
  },
  money: {
    seedLights: 20,                  // $20,000 in $1,000 lights, every sheet
    lightDollars: 1000,
    printMultiple: 3                 // a clean landing prints 3 lights per light inked
  },
  payroll: {
    inkShare: 0.035,                 // 'ink': 3.5% of the current run's ink per game day, paid from kept white
    bankShare: 0.035,                // 'bank' (v6): 3.5% of the bank at the last lift per game day
    flatLightsPerDay: 0.35,          // 'flat' (Sid): same few lights every day
    clickMinMs: 60                   // at most one payroll click per 60 ms
  },
  clock: {
    endDay: 126,                     // day 0 = Thu 23 Jan 2020, day 126 = Thu 28 May 2020
    dragDaysPerSec: 0.75,            // the clock while the nib is live (after the first lift)
    pourBase: 6.5, pourLog: 3,       // P = 6.5 + 3*log2(1+T) real seconds
    progressExp: 1.5                 // p = (t/P)^1.5
  },
  hw: {
    gpuDayFlops: 3.456e18,           // one V100 at 40e12 FLOP/s for a day
    owned: 8,                        // the DGX-1
    rentPerGpuDay: 59.52             // $2.48 per GPU-hour on demand
  },
  run: {
    tA: 4.8, tRef: 1e19, tExp: 0.1,  // T = min(C/(8 GPU-days), 4.8*(C/1e19)^0.1) days
    homeCompute: 2.765e19,           // a lift inside the home end: the owned eight for one day
    homeDays: 1
  },
  line: { Cc: 2.68e28, alpha: 0.050, onLineTol: 1.015 },
  curve: { startLoss: 10.825, p0: 0.000316227766, cliffA: 0.6, cliffK: 10, grindB: 0.4, noise: 0.012, stepDecades: 0.01 },
  data: {
    d0: 2.0e10, c0: 8.64e19, exp: 0.27,   // D(C) = 2e10*(C/1 PF-day)^0.27 tokens
    wLo: 18e9, wHi: 110e9,                // W ~ LogUniform(18B, 110B)
    passes: 4,                            // D_wall = 4W
    cleanBelow: 0.65, gradeWidth: 0.07, grades: 5,
    advanceComputeFactor: 3.16            // one rung, used only if wallAdvancesAfterCrossing
  },
  samples: {
    checkpoints: [0.0005, 0.002, 0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1],
    tierLoss: [6.0, 4.3, 3.3],             // T0 above 6.0, T1 to 4.3, T2 to 3.3, T3 to the paragraph threshold
    autoAt: [0.35, 0.75], autoQuietMs: 2500,
    msPerWord: 45,
    lateP: 0.5, lateBase: 0.4, latePerGrade: 0.12,
    earlyProb: 0.5, earlyMinGrade: 3, earlyOffset: 2,
    capShare: 0.35,
    bandMaxChars: 180,
    virusAfterDay: 48                      // 'The virus is a the stock market of Tuesday.' after 11 Mar
  },
  caps: [
    { name: 'paragraph',   compute: 2e21,   jitter: 0.2 },
    { name: 'arithmetic',  compute: 1e22,   jitter: 0.3 },
    { name: 'translation', compute: 6e22,   jitter: 0.3 },
    { name: 'code',        compute: 2.5e23, jitter: 0.3 }
  ],
  gpt3: { compute: 3.14e23 },
  paper: { rightMinLog: 24.3, rightRunMult: 2, leftBack: 4, leftMin: 16, leftMax: 20, lossTop: 11.5, lossBottom: 1.55 },
  timing: {
    wakeStaggerMs: 60, wakeEachMs: 220, motorFadeInMs: 800,
    dateLineAtMs: 1000, linePrintMs: 1200,
    nudgeEveryMs: 4000, nudgeMs: 520, nudgePx: 6,
    breathFastMs: 1200, breathMs: 4000, breathAmp: 0.06,
    betLookbackMs: 100,
    flareMs: 300, sinkMs: 300, riseMs: 260,
    landPauseMs: 300, inkLiftMs: 300, printMaxMs: 1200, printEachMaxMs: 40, printTickMinMs: 30,
    repackMs: 400, emptyWhirrMs: 300, hatchMs: 900, curveFadeMs: 600,
    capDimMs: 400, capDuckMs: 80, capSilenceMs: 1000, capRestoreMs: 600, capDim: 0.92,
    endMotorStopMs: 300, dryFadeMs: 900, dryStillMs: 800,
    headlineDriftMs: 7000, headlineGapMs: 600, gpt3DriftMs: 1200, pressMs: 300,
    freshAfterMs: 5000, freshAfterDryMs: 6000, miracleExtraMs: 2400,
    feedMs: 900, panMs: 800, emptyOutlineMs: 80, tapPulseMs: 160
  },
  layout: {
    laptopMin: 960,
    phone: { gutter: 16, paperTo: 0.60, bandTo: 0.78, stripAt: 0.80, stripH: 52, homeW: 56, readoutAbove: 56 },
    laptop: { margin: 24, paperTo: 0.64, bandTo: 0.80, stripAt: 0.82, stripH: 60, homeW: 72, stripMax: 1200, bandMax: 760, readoutAbove: 40 },
    nibW: 12, nibHit: 44, lightMinW: 4, mergedHairlineEvery: 40
  },
  audio: {
    motorDb: -30, motorNoiseDb: -36, motorDbPerDoubling: 1, motorMaxDb: -16, motorHarmonicDb: -46,
    scratchDb: -28, scratchHz: 3200, scratchQ: 0.8, scratchFullPxPerSec: 260,
    tokenDb: -34, tokenHz: 2400, tokenMs: 6,
    payrollDb: -32, payrollHz: 1200, payrollMs: 4,
    printDb: -38, printHz: 1800, printMs: 5,
    liftDb: -18, liftDecay: 1.4, liftOvertoneDb: -32,
    feedDb: -30, feedHz: 90, feedLpHz: 600,
    jagDb: -40
  }
};
