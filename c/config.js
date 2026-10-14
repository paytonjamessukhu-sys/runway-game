/* FRONTIER: the lab sim. Builder C. Every tunable number and rule switch lives here.
   Source of truth: spec/sim1.json (the clerk's full sim spec). Where it is silent, council/sim-transcript.md and the
   approved training-run component spec/slice1.json v7 fill in. Day numbers: day 0 is Wed 1 Jan 2020. */
(function (root) {
  var CFG = {
    /* ---- calendar and clock ---- */
    startDateUTC: [2020, 0, 1],
    endDay: 366,                         // 31 Dec 23:59
    monthStarts: [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366],
    pourDaysPerSec: 1.0,                 // pour and hang
    idleDaysPerSec: 3.0,                 // idle, after the first lift
    minPourSec: 4.0,                     // a pour lasts max(4 s, T s)
    landSecClean: 2.2, landSecWall: 3.1, momentSec: 3.5,
    slotDayOfMonth: [0, 10, 20],         // letters on the 1st (with payroll), the 11th and the 21st
    endFeedSec: 6.5,                     // a fresh 1 January slides in after any end frame

    /* ---- money ---- */
    seed: 6e6, seedPost: 30e6, stakeStart: 0.80, dgx1: 149000,
    base: 40000,                         // you, ops, the office: leaves on the 1st
    upkeep: 150,                         // per owned card per month, on the 1st
    monthDays: 30.4,
    monthsCap: 99,

    /* ---- cards ---- */
    flopsV100Day: 3.456e18, a100x: 2.5, ownedStart: 8,
    rentEarly: 2.48, rentLate: 3.06, rentLateFromDay: 91, rentRenewLate: 3.50,
    rentTermDays: 90, renewWindowDays: 30, renewRefuseShare: 0.5,
    rentSizes: [[0, 64], [31, 128], [60, 256]], // January, February, March to June
    brokerRentUntilDay: 161, brokerGapDays: 14, brokerBuyFromDay: 31,
    buyV100: { n: 64, price: 800000, lead: 56 },
    buyA100: { n: 64, price: 1592000, lead: 84, fromDay: 134 },
    covidOrderFrom: 60, covidOrderTo: 181, covidOrderExtra: 28,
    apiDay: 162, postApiPriceX: 1.2, postApiLeadExtra: 56,
    rentOutRate: 1.90, rentOutDays: 30, rentOutMonths: 6, rentOutMinOwned: 16,
    servingShare: 1 / 8, servingMin: 8, servingMax: 64,
    meridian: { credits: 50e6, cards: 1024, lead: 42, rate: 2.48, minBest: 1e21, fromDay: 91, firstLook: 7,
      fullWithin: 2, halfWithin: 10, secondFromDay: 166, secondCards: 512, secondStake: 0.9, queueFromDay: 162 },

    /* ---- raising ---- */
    seriesA: { far: 1e22, spanDecades: 1, fromDay: 22, early: [30e6, 150e6], late: [60e6, 450e6], closedFrom: 75, closedTo: 166, lateSlotDay: 172, passFactor: 3 },
    seriesB: { min: 3e22, fromDay: 162, amt: 150e6, post: 1.2e9, postApi: 1.8e9 },
    counterStake: 0.015, devStake: 0.01, boardBelow: 0.5,
    acquiPerHead: 4e6, acquiMonths: 3, acquiFromDay: 31,

    /* ---- the run ---- */
    probeDays: 0.25,
    memStopC: 1.36e20,                   // a one-billion-parameter model under the 2020 recipe
    horizonX: 10, horizonFirstC: 2.765e20,
    lineC: 2.68e28, lineAlpha: 0.050, startLoss: 10.825, curveNoise: 0.012, onLineTol: 0.015,
    sunheeBend: 0.975, sunheeAfterDays: 30,
    blindShare: 0.3, blindLo: 0.02, blindHi: 0.05, blindSmall: 0.005,
    penWarp: 1.5,                        // the pen is drawn at q = s^1.5
    checkpoints: (function () { var a = [0.0005, 0.002, 0.01]; for (var i = 1; i <= 20; i++) a.push(+(i * 0.05).toFixed(2)); return a; })(),
    gpt3C: 3.14e23, gpt3Loss: 1.763, miracleTol: 1.005,

    /* ---- hangs ---- */
    hangLambda: 0.035,                   // per run-day, x sqrt(V100-equivalents / 8)
    hangInfraX: 0.4, hangBothX: 0.2,
    hangMorningHour: 8, hangCovidExtraDays: 1, hangCovidFrom: 75, hangCovidTo: 181,
    hangInfraRestartHours: 1, hangInfraCkHours: 4, hangWakeMinutes: 20, hangWakeMood: -10, hangWakeMoodTom: -5,

    /* ---- data: the hidden wall (slice one v7) ---- */
    W_lo: 14e9, W_hi: 40e9, passes: 4,
    tokA: 2.0e10, tokRef: 8.64e19, tokExp: 0.27,
    cleanR: 0.733, frayStep: 0.0534, frayAmounts: 5,
    filterW: 1.862, filterCost: 150000, filterDays: 21, filterDaysInes: 12, priyaAutoK: 4,

    /* ---- capabilities ---- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capRevenue: [30000, 60000, 120000, 250000],
    contamination: 0.3, capSampleShare: 0.35, capMood: 10,

    /* ---- publish, ship, scandal ---- */
    publishFromDay: 31, rivalSlideExp: 0.25, rivalSlideDelay: 14,
    scandalPublish: 0.20, scandalPublishFiltered: 0.10, scandalShip: 0.15, scandalDelay: [20, 60],
    redTeamDays: 14, redTeamDaysApi: 7, scandalTermBlockDays: 90, scandalMood: -30,

    /* ---- mood ---- */
    moodStart: 70, egoE: { 2: 450, 3: 550, 4: 650 }, moodGraphite: 25,
    moodEgo4Idle: -2, moodPublish: 15, moodFirstAuthor: 30, moodCounter: 20,

    /* ---- rivals (fictional) ---- */
    rivals: [
      { id: 'halcyon', name: 'Halcyon', c0: 1e21, tau: 5.0, period: 70, off: 1.00 },
      { id: 'kestrel', name: 'Kestrel', c0: 1.5e19, tau: 3.4, period: 50, off: 1.01 },
      { id: 'northwind', name: 'Northwind', c0: 3e20, tau: 6.0, period: 45, off: 1.02 }
    ],
    rivalJitter: 0.15, passBonus: 0.2, openKestrel: 0.2, openNorthwind: 0.4, openPassNorthwind: 0.1, openDays: 7,

    /* ---- relevance ---- */
    relevanceFromDay: 91, relevanceShare: 0.01, openViewX: 3, vaultViewX: 0.1,

    /* ---- poach ---- */
    poachFromDay: 91, poachChance: 0.35, poachMinTeam: 3,

    /* ---- letters ---- */
    fuse: { broker: 7, poach: 7, rentout: 7, renewal: 7, hire: 10, demand: 10, open: 10, acqui: 10, term: 14, meridian: 14 },
    flickPx: 40, flickVel: 0.3,
    decemberDay: 355,                    // 21 Dec: Priya's letter overrides everything

    /* ---- samples (slice one) ---- */
    tierStatic: 6.0, tierWords: 4.3, tierGrammar: 3.3, t3Sense: [2.78, 2.48],
    bandMaxChars: 180, wordMs: 45, crawlLen: [92, 150], tapWaitSec: 0.7,
    autoSampleQ: [0.35, 0.75], autoQuietSec: 2.5, autoEverySec: 15, autoLongPourSec: 30,
    covidLineFromDay: 70,

    /* ---- plot (slice one) ---- */
    plotLossTop: 11.5, plotLossBottom: 1.55, plotRightMinLog: 24.3, plotLeftMinLog: 16, plotLeftMaxLog: 20, plotLeftBack: 4, panSec: 0.8,
    lineFromDay: 22,

    /* ---- motion (seconds) ---- */
    letterInSec: 0.4, letterTakeSec: 0.25, letterPassSec: 0.3, headlineDriftSec: 7, noteFadeSec: 8, noteCharMs: 30, nameCharMs: 40,
    momentDimSec: 0.4, momentSilenceSec: 1.0, momentRestoreSec: 0.6,

    /* ---- layout (px) ---- */
    laptopMinWidth: 960,
    phone: { gutter: 16, header: 56, namesW: 52, headY: 72, rulerH: 24, band: 108, cluster: 52, strip: 52, home: 56, letterZone: 170, letterW: 368, letterH: 128 },
    laptop: { colMax: 1200, side: 24, header: 0.07, paperTo: 0.58, bandTo: 0.71, clusterFrom: 0.72, clusterTo: 0.78, stripFrom: 0.79, strip: 60, home: 72, letterFrom: 0.87, letterW: 560, letterH: 120, namesW: 120, rulerH: 28 },

    /* ---- sound (dBFS) ---- */
    sound: { motorDb: -30, motorNoiseDb: -36, idleDb: -36, scratchMaxDb: -28, jagDb: -34, tickDb: -34, liftDb: -18, feedDb: -30,
      payrollDb: -20, letterDb: -34, takeDb: -22, passDb: -36, fuseDb: -46, hangThudDb: -24, cardDb: -38, strikeDb: -30 }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
