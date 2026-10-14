/* FRONTIER, slice one. Every tunable number and rule switch lives here.
   Source: spec/slice1.json (v6) overridden by spec/slice1-round7.md.
   Patch this object when the council approves new numbers; nothing else should need to change. */
(function (root) {
  var CFG = {
    /* ---- rule switches ---- */
    payrollMode: 'ink',            // 'ink' (default, round 7) | 'flat' (Sid) | 'none' (Musk and Madigan)
    wallEndsSheet: false,          // v6 rule: true ends the sheet on the first landing past the wall. Round 7: false.
    wallAdvancesAfterCrossing: false, // Sid, untested: after a survived crossing the wall moves one rung out
    wallAdvanceDecades: 0.5,       // one rung, in decades of compute, used only when the switch above is on
    miracleRequiresAlive: true,    // the GPT-3 moment needs a lit pen: a sheet that ran dry does not get the whole screen

    /* ---- money (lights) ---- */
    lightDollars: 1000,            // one light is $1,000 of buying power, never shown
    seedLights: 20,                // $20,000 seed, every sheet
    cleanPrintMultiple: 3,         // a clean landing prints 3 lights per inked light
    crossPrintMultiple: 0,         // a landing past the wall prints nothing
    payrollInkShare: 0.035,        // 'ink': per game day, 3.5% of the lights inked into the current run
    payrollFlatLights: 0.35,       // 'flat': lights per game day whatever you spend or keep

    /* ---- calendar ---- */
    startDateUTC: [2020, 0, 23],   // day 0 = Thu 23 Jan 2020
    endDay: 126,                   // day 126 = Thu 28 May 2020
    dragDaysPerSec: 0.75,          // clock while the nib is live (after the sheet's first lift)

    /* ---- hardware and run length ---- */
    gpuDayFlops: 3.456e18,         // one V100 at 40e12 FLOP/s delivered
    ownedGPUs: 8,                  // one DGX-1, sunk
    gpuDayDollars: 59.52,          // $2.48 per GPU-hour on demand
    runTLin: 2.765e19,             // T = min(C/2.765e19, A*(C/ref)^exp) days
    runTA: 4.8,
    runTRef: 1e19,
    runTExp: 0.1,
    homeLiftC: 2.765e19,           // a lift inside the home end: the owned eight for one day
    pourBase: 6.5,                 // pour P = base + k*log2(1+T) real seconds
    pourLog: 3,
    pourWarp: 1.5,                 // p(t) = (t/P)^1.5

    /* ---- the line (Kaplan 2020) ---- */
    lineC: 2.68e28,
    lineAlpha: 0.050,
    startLoss: 10.825,             // ln 50,257
    curveNoise: 0.012,             // y += N(0, 0.012*(1-0.5z)) in ln-loss, never smoothed
    gpt3C: 3.14e23,

    /* ---- data wall ---- */
    W_lo: 18e9, W_hi: 110e9,       // clean text in tokens, LogUniform per sheet
    passes: 4,                     // D_wall = passes * W
    tokA: 2.0e10, tokRef: 8.64e19, tokExp: 0.27, // D(C) = A*(C/ref)^exp
    cleanR: 0.65,                  // clean below this r = D/D_wall
    frayStep: 0.07,                // five grades of 0.07
    frayGrades: 5,

    /* ---- samples ---- */
    tierStatic: 6.0, tierWords: 4.3, tierGrammar: 3.3, // loss bounds; T3/T4 split is L_line(paragraph threshold)
    checkpoints: (function () { var a = [0.0005, 0.002, 0.01]; for (var i = 1; i <= 20; i++) a.push(+(i * 0.05).toFixed(2)); return a; })(),
    autoSampleP: [0.35, 0.75],     // auto samples if no tap in the previous quietSec
    autoQuietSec: 2.5,
    tapWaitMaxSec: 1.3,
    frayLateFromP: 0.5,            // tap/auto samples at p >= this carry the run's fray with prob base + per*grade
    frayLateBase: 0.4, frayLatePer: 0.12,
    frayEarlyProb: 0.5, frayEarlyMinGrade: 3, frayEarlyDrop: 2,
    capSampleShare: 0.35,          // after a capability unlocks, share of qualifying samples that use its strings
    bandMaxChars: 180,             // T4 strings are cut at a sentence boundary in the band
    wordMs: 45,                    // samples stream at 45 ms per word
    covidLineFromDay: 48,          // T2 'virus' line eligible after 11 Mar

    /* ---- capabilities: [id, centre FLOPs, +- decades] sorted after jitter ---- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],

    /* ---- plot ---- */
    plotLossTop: 11.5, plotLossBottom: 1.55,
    plotRightMinLog: 24.3,         // right edge = max(10^24.3, 2x largest run)
    plotLeftMinLog: 16, plotLeftMaxLog: 20, plotLeftBack: 4, // left = clamp(floor(log10 C_last - 4), 16, 20)
    panMs: 800,

    /* ---- headlines (factual, dated) ---- */
    headlines: [
      [0, '23 JAN 2020 · OpenAI researchers publish ‘Scaling Laws for Neural Language Models’: test loss falls as a smooth power law in model size, data and compute.'],
      [5, '28 JAN 2020 · Google unveils Meena, a 2.6-billion-parameter chatbot.'],
      [18, '10 FEB 2020 · Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.'],
      [53, '16 MAR 2020 · Five days after the WHO declared COVID-19 a pandemic, the Dow falls 12.9% in a day, its worst day since 1987.'],
      [112, '14 MAY 2020 · NVIDIA announces the A100 GPU and the DGX A100 at $199,000.'],
      [117, '19 MAY 2020 · Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.']
    ],
    gpt3Headline: '28 MAY 2020 · OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens.',
    headlineDriftSec: 7,

    /* ---- motion and timing (seconds unless noted) ---- */
    wakeStaggerSec: 0.06, motorFadeSec: 0.8, linePrintSec: 1.2,
    nudgeEverySec: 4, nudgePx: 6,
    restReadSec: 0.1,              // the bet is read 100 ms before the lift
    liftWaveSec: 0.3,
    landPauseSec: 0.3, inkLiftSec: 0.3, printStepMaxSec: 0.04, printTotalMaxSec: 1.2, repackSec: 0.4,
    emptyWhirrSec: 0.3, hatchDrawSec: 0.9,
    momentDimSec: 0.4, momentSilenceSec: 1.0, momentRestoreSec: 0.6, momentDim: 0.92,
    endMotorStopSec: 0.3, dryFadeSec: 0.9, dryStillSec: 0.8,
    gpt3DriftSec: 1.2, pointPressSec: 0.3,
    freshAfterSec: 5, freshAfterDrySec: 6, feedSec: 0.9,
    payrollClickMinSec: 0.06, printTickMinSec: 0.03,

    /* ---- strip geometry (px) ---- */
    phone: { stripH: 52, homeW: 56, nibW: 12, nibHit: 44, readoutAbove: 56, gutter: 16 },
    laptop: { stripH: 60, homeW: 72, nibW: 12, nibHit: 44, readoutAbove: 40, margin: 24, stripMax: 1200, bandMax: 760 },
    laptopMinWidth: 960,
    lightGapMinPx: 4,              // below this the lights merge into one band
    bandHairEvery: 40,             // a grid hairline every 40 lights in a merged band
    keyStep: 0.02, keyStepShift: 0.10,

    /* ---- sound (dBFS) ---- */
    sound: { motorDb: -30, motorNoiseDb: -36, motorDbPerDoubling: 1, scratchMaxDb: -28, tickDb: -34, clickDb: -32, printDb: -38, liftDb: -18, feedDb: -30 }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
