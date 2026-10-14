/* FRONTIER, the lab sim. Build B ("the feel").
   Every tunable number and rule switch lives in this one object so balance can be patched.
   Source of truth: spec/sim1.json (the clerk's full sim spec). Where the council record and the spec differ,
   the spec wins. The training run is the approved slice one component (spec/slice1.json v7). */
(function (root) {
  var CFG = {
    /* ---------- the clock ---------- */
    year: 2020,
    endDay: 365,                 // day 365 = Thu 31 Dec 2020; the year ends at 23:59 on it
    pourDaysPerSec: 1.0,         // pour and hang: one game day per real second
    idleDaysPerSec: 3.0,         // idle: three game days per second
    minPourSec: 4.0,             // a pour lasts max(4 s, T s)
    landCleanSec: 2.2, landWallSec: 3.1, momentSec: 3.5,
    endFeedSec: 6.5,             // a fresh 1 January slides in 6.5 s after the end frame
    pauseWhenHidden: true,

    /* ---------- money ---------- */
    seedCash: 6000000, seedPost: 30000000, stakeStart: 0.80, dgx1: 149000,
    base: 40000,                 // you, ops, the office, per month
    upkeepPerOwned: 150,         // per owned card, on every 1st
    acquiPerHead: 4000000, acquiMonths: 3,
    monthsCap: 99,

    /* ---------- cards ---------- */
    flops: { v100: 3.456e18, a100: 8.64e18 },  // per card-day; an A100 counts as 2.5 V100s
    v100eq: { v100: 1, a100: 2.5 },
    startOwned: 8,               // the DGX-1
    rentTermDays: 90,
    rentPrice: [[0, 2.48], [91, 3.06]],         // $/hr by day: GCP list to 31 Mar, AWS list from 1 Apr
    renewPriceAfterApi: 3.50, renewRefuseShare: 0.5, renewWindow: 30,
    rentSizes: { 0: 64, 1: 128, 2: 256, 3: 256, 4: 256, 5: 256 }, // by month index
    rentUntilDay: 161,           // broker rent letters stop after 10 Jun
    brokerGapDays: 14,
    buyV100: { n: 64, price: 800000, leadDays: 56 },
    buyA100: { n: 64, price: 1592000, leadDays: 84, fromDay: 134 },
    covidOrderFrom: 60, covidOrderTo: 181, covidOrderExtra: 28,   // orders 1 Mar to 30 Jun take 4 weeks longer
    apiDay: 162,                 // 11 Jun
    afterApiPriceMult: 1.2, afterApiLeadExtra: 56,
    rentOutPerHour: 1.90, rentOutDays: 30, rentOutMonths: 6, rentOutMinOwned: 16,
    servingShare: 1 / 8, servingMin: 8, servingMax: 64,
    nodeAbove: 128, podAbove: 2048,

    /* ---------- Meridian ---------- */
    meridianCredits: 50000000, meridianRate: 2.48, meridianCards: 1024, meridianLead: 42, meridianNeedC: 1e21, meridianFromDay: 91,
    meridianFirstLook: 7, meridianQueueFromDay: 162, meridianQueueFull: 2, meridianQueueHalf: 10,
    meridian2FromDay: 166, meridian2Cards: 512, meridian2Stake: 0.9,

    /* ---------- raises ---------- */
    lineFromDay: 22,             // 23 Jan: the line prints; Series A dots count only from today
    crashDay: 75, marketOpenDay: 166, termAfterCrashSlotDay: 172, // 16 Mar closes, 15 Jun opens, the 21 June slot
    seriesA: { needC: 1e22, decades: 1, onLine: 1.015, pre: { cash: 30e6, post: 150e6 }, after: { cash: 60e6, post: 450e6 }, passMult: 3 },
    seriesB: { needC: 3e22, cash: 150e6, post: 1.2e9, postApi: 1.8e9 },
    counterStake: 0.015, devStake: 0.01, boardBelow: 0.5,

    /* ---------- the run ---------- */
    lineC: 2.68e28, lineAlpha: 0.050, startLoss: 10.825, curveNoise: 0.012,
    gpt3C: 3.14e23, gpt3Loss: 1.763, miracleTol: 1.005,
    tokA: 2.0e10, tokRef: 8.64e19, tokExp: 0.27,
    probeDays: 0.25,
    memC: 1.36e20,               // one billion parameters on a 32 GB V100, unless Dev or Rafael
    horizonMult: 10, horizonFirst: 2.765e20,
    blindShare: 0.3, blindHi: [0.02, 0.05], blindLo: [0, 0.005],
    sunheeBend: 0.975, sunheeDelay: 30,
    checkpoints: (function () { var a = [0.0005, 0.002, 0.01]; for (var i = 1; i <= 20; i++) a.push(+(i * 0.05).toFixed(2)); return a; })(),
    autoSampleQ: [0.35, 0.75], autoQuietSec: 2.5, autoEverySec: 15, autoEveryLongerThan: 30,
    tapWaitSec: 0.7,

    /* ---------- hangs ---------- */
    hangLambda: 0.035,           // per run-day x sqrt(V100-equivalents / 8)
    hangInfraMult: 0.4, hangBothMult: 0.2,
    hangCovidFrom: 75, hangCovidTo: 181, hangCovidExtraDays: 1,
    infraRestartDays: 1 / 24, infraRewindDays: 4 / 24, wokenRestartDays: 20 / 1440, wakeMood: 10, wakeMoodTom: 5,

    /* ---------- data wall and the filter ---------- */
    W_lo: 14e9, W_hi: 40e9, passes: 4,
    cleanR: 0.733, frayStep: 0.0534, frayAmounts: 5,
    filterW: 1.862, filterCost: 150000, filterDays: 21, filterDaysInes: 12, priyaAutoK: 4, priyaAskK: 3,

    /* ---------- capabilities ---------- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capRevenue: { paragraph: 30000, arithmetic: 60000, translation: 120000, code: 250000 },
    capSampleShare: 0.35, contamination: 0.3, capMood: 10,
    tierStatic: 6.0, tierWords: 4.3, tierGrammar: 3.3, t3Sense: [2.78, 2.48],
    wordMs: 45, bandMaxChars: 180, covidStringDay: 70,

    /* ---------- publish, ship, scandal ---------- */
    publishFromDay: 31, shipFromDay: 162,
    rivalSlideDelay: 14, rivalSlideExp: 0.25,
    scandalPublish: 0.20, scandalPublishFiltered: 0.10, scandalShip: 0.15, scandalDelay: [20, 60],
    scandalTermBlockDays: 90, scandalMood: 30,
    redTeamDays: 14, redTeamDaysApi: 7,
    publishMoodEgo3: 15, publishMoodFirstAuthor: 30,

    /* ---------- people ---------- */
    moodStart: 70, moodGraphite: 25, egoWeight: { 2: 450, 3: 550, 4: 650 },
    noPaperDays: 60, noPaperMood: 2, counterMood: 20,
    poachFromDay: 91, poachChance: 0.35, poachMinPeople: 3,

    /* ---------- rivals (fictional) ---------- */
    rivals: [
      { key: 'halcyon', name: 'Halcyon', c0: 1e21, tau: 5.0, period: 70, offset: 1.00 },
      { key: 'kestrel', name: 'Kestrel', c0: 1.5e19, tau: 3.4, period: 50, offset: 1.01 },
      { key: 'northwind', name: 'Northwind', c0: 3e20, tau: 6.0, period: 45, offset: 1.02 }
    ],
    rivalJitter: 0.15, rivalPassBoost: 0.2, rivalOpenKestrel: 0.2, rivalOpenNorthwind: 0.4, rivalPassOpenNorthwind: 0.1,

    /* ---------- relevance ---------- */
    relevanceFromDay: 91, relevanceShare: 0.01, openedMult: 3, vaultedMult: 0.1,

    /* ---------- letters ---------- */
    fuse: { broker: 7, poach: 7, rentout: 7, renewal: 7, hire: 10, demand: 10, open: 10, acqui: 10, term: 14, meridian: 14 },
    flickPx: 40, flickVel: 0.3,

    /* ---------- plot ---------- */
    plotLossTop: 11.5, plotLossBottom: 1.55,
    plotRightMinLog: 24.3, plotLeftMinLog: 16, plotLeftMaxLog: 20, plotLeftBack: 4, panSec: 0.8,

    /* ---------- motion (seconds) ---------- */
    noteCharSec: 0.03, nameCharSec: 0.04, noteFadeSec: 8, headlineDriftSec: 7, stopNoteSec: 2, remapSec: 0.4,
    letterInSec: 0.4, letterTakeSec: 0.25, letterPassSec: 0.3, sweepSec: 0.3, regroupSec: 0.6,
    cellDrawSec: 0.012, cellDrawMaxSec: 0.9,       // new cells draw into the band one after another
    rollMaxSec: 0.6,                                // the months figure rolls on letters that move money; payroll is one frame
    pressMaxMs: 300,                                // a press is a tap of 300 ms or less

    /* ---------- layout (px) ---------- */
    laptopMinWidth: 960,
    phone: { margin: 52, home: 56, nibW: 12, readoutAbove: 56 },
    laptop: { margin: 120, home: 72, nibW: 12, readoutAbove: 40 },
    keyStep: 0.02, keyStepShift: 0.10,

    /* ---------- sound (dBFS) ---------- */
    audio: {
      motorDb: -30, motorNoiseDb: -36, motorDbPerDoubling: 1, motorMaxDb: -18, motorHarmonicDb: -46, idleHumDb: -36,
      scratchDb: -30, scratchHz: 3200, scratchQ: 0.8,
      nibDb: -34, nibHz: 1500,
      tokenDb: -36, tokenHz: 2400, tokenMs: 6,
      printDb: -38, printHz: 1800, printMs: 5,
      liftDb: -18, liftDecay: 1.4, liftOvertoneDb: -32,
      feedDb: -32, feedHz: 90, feedLpHz: 600,
      jagDb: -42, payrollDb: -20, letterDb: -34, takeDb: -22, passDb: -36, fuseDb: -46, hangThudDb: -24, rollDb: -34, writeDb: -42, strikeDb: -32
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
