/* FRONTIER, the lab sim. Builder A ("the letter of the spec").
   EVERY tunable number and rule switch lives in this one object.
   Source of authority: spec/sim1.json (the clerk's sim spec), then council/sim-transcript.md, then spec/slice1.json v7.
   Money in dollars, time in game days (day 0 = Wed 1 Jan 2020, day 365 = Thu 31 Dec 2020). */
(function (root) {
  var CFG = {
    version: 'sim-a-1.0',

    /* ---------------- clock (spec: The clock) ---------------- */
    startDateUTC: [2020, 0, 1],
    endDay: 366,                     // the year ends at 31 Dec 23:59 (day 365 + 1)
    pourDaysPerSec: 1.0,             // pours and hangs
    idleDaysPerSec: 3.0,
    minPourSec: 4.0,                 // a pour lasts max(4 s, T s)
    landCleanSec: 2.2, landWallSec: 3.1, momentSec: 3.5,
    nextYearSec: 6.5,                // a fresh 1 January slides in 6.5 s after any end frame

    /* ---------------- money (spec: The bank and the months figure) ---------------- */
    seedBank: 6000000, seedPost: 30000000, stakeStart: 0.80,
    dgx1Price: 149000,               // bought from the seed: opening bank $5,851,000
    basePerMonth: 40000,             // you, ops, the office
    upkeepPerCard: 150,              // per owned card on every 1st
    daysPerMonth: 30.4,
    monthsCap: 99,
    acquiPerHead: 4000000, acquiUnderMonths: 3,
    boardUnder: 0.50,                // below 50% stake the board decides the acqui-hire and open weights

    /* ---------------- hardware (spec: Cards) ---------------- */
    v100PerDay: 3.456e18, a100PerDay: 8.64e18, a100Eq: 2.5,
    ownedStart: 8,
    rentPrice: [[0, 2.48], [91, 3.06]],      // $/V100-hour: GCP list until 31 Mar, AWS list from 1 Apr
    renewPriceLate: 3.50, renewRefuseShare: 0.5, // from 11 Jun
    rentTermDays: 90, renewWindowDays: 30,
    brokerSize: [[0, 64], [31, 128], [60, 256]], // 64 in Jan, 128 in Feb, 256 Mar to Jun
    brokerRentUntil: 161,            // until 10 Jun
    brokerGapDays: 14,
    buyV100: { n: 64, price: 800000, lead: 56 },
    buyA100: { n: 64, price: 1592000, lead: 84, from: 134 },
    covidOrderFrom: 60, covidOrderTo: 181, covidOrderAddDays: 28,
    lateBuyFrom: 162, lateBuyPriceMult: 1.2, lateBuyAddDays: 56,
    rentOut: { price: 1.90, days: 30, share: 0.5, underMonths: 6, minOwned: 16 },
    servingShare: 1 / 8, servingMin: 8, servingMax: 64,

    /* ---------------- Meridian (fictional cloud) ---------------- */
    meridian: { credits: 50000000, cards: 1024, lead: 42, minC: 1e21, from: 91, firstLook: 7, queueFrom: 162,
      fullWithin: 2, halfWithin: 10, second: { from: 166, cards: 512, stakeMult: 0.9 } },

    /* ---------------- raising money ---------------- */
    seriesA: { minC: 1e22, apart: 10, tol: 0.015, after: 22,
      early: { amount: 30000000, post: 150000000 }, late: { amount: 60000000, post: 450000000 }, passMult: 3 },
    marketClosedFrom: 75, marketClosedTo: 166,   // 16 Mar to 15 Jun
    seriesB: { minC: 3e22, from: 162, amount: 150000000, post: 1200000000, postApi: 1800000000 },
    counterStake: 0.015, devDemandStake: 0.01,
    scandalNoTermsDays: 90,

    /* ---------------- the line, the run, the data (slice one + sim1) ---------------- */
    lineC: 2.68e28, lineAlpha: 0.050, startLoss: 10.825, curveNoise: 0.012, gpt3C: 3.14e23, gpt3L: 1.763, miracleTol: 1.005,
    onLineTol: 0.015,
    minDays: 0.25,                   // the six-hour probe
    memC: 1.36e20,                   // one billion parameters on one 32 GB card
    horizonMult: 10, horizonFloor: 2.765e20,
    blind: { chance: 0.3, hi: [0.02, 0.05], lo: [0, 0.005] },
    sunheeBend: 0.975, sunheeDelay: 30,
    pourWarp: 1.5,                   // the pen is drawn at q = s^1.5
    W_lo: 14e9, W_hi: 40e9, passes: 4,
    tokA: 2.0e10, tokRef: 8.64e19, tokExp: 0.27,
    cleanR: 0.733, frayStep: 0.0534, frayAmounts: 5,
    filterW: 1.862, filterCost: 150000, filterDays: 21, filterDaysInes: 12,
    priyaAutoAmount: 4,
    tierStatic: 6.0, tierWords: 4.3, tierGrammar: 3.3, t3Sense: [2.78, 2.48],
    checkpoints: (function () { var a = [0.0005, 0.002, 0.01]; for (var i = 1; i <= 20; i++) a.push(+(i * 0.05).toFixed(2)); return a; })(),
    autoSampleQ: [0.35, 0.75], autoQuietSec: 2.5, autoEverySec: 15, longPourSec: 30, tapWaitSec: 0.7,
    capSampleShare: 0.35, bandMaxChars: 180, wordMs: 45, covidLineFromDay: 71, crawlLen: [92, 150],
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capRevenue: { paragraph: 30000, arithmetic: 60000, translation: 120000, code: 250000 },
    contaminateChance: 0.3,
    lineDay: 22,                     // 23 Jan: the paper's line prints

    /* ---------------- hangs ---------------- */
    hangBase: 0.035, hangInfraMult: 0.4, hangBothMult: 0.2,
    hangWakeHour: 8, hangCovidFrom: 75, hangCovidTo: 181, hangCovidAddDays: 1,
    infraRestartHours: 1, wakeRestartHours: 1 / 3,
    wakeMood: -10, wakeMoodTom: -5,

    /* ---------------- publish, ship, scandal ---------------- */
    publishFrom: 31, shipFrom: 162,
    rivalSlidePow: 0.25, rivalSlideDelay: 14,
    scandalPub: 0.20, scandalPubFiltered: 0.10, scandalShip: 0.15, scandalDelay: [20, 60],
    redTeamDays: 14, redTeamDaysApi: 7,
    vaultWorldShare: 0.1, openWorldMult: 3,

    /* ---------------- relevance ---------------- */
    relevanceFrom: 91, relevanceShare: 0.01,

    /* ---------------- people and mood ---------------- */
    moodStart: 70, moodGraphite: 25,
    egoWeight: { 2: 450, 3: 550, 4: 650 },
    moodCap: 10, moodPublish: 15, moodFirstAuthor: 30, moodCounter: 20, moodScandal: -30, moodNoPub: -2, noPubDays: 60,
    passToKestrel: 0.2,              // decades

    /* ---------------- rivals (fictional) ---------------- */
    rivals: [
      { id: 'halcyon', name: 'Halcyon', c0: 1e21, tau: 5.0, period: 70, offset: 1.00 },
      { id: 'kestrel', name: 'Kestrel', c0: 1.5e19, tau: 3.4, period: 50, offset: 1.01 },
      { id: 'northwind', name: 'Northwind', c0: 3e20, tau: 6.0, period: 45, offset: 1.02 }
    ],
    rivalJitter: 0.15, rivalPeriodJitter: [0.7, 1.3],
    openKestrel: 0.2, openNorthwind: 0.4, passNorthwind: 0.1, openFineTuneDays: 7,

    /* ---------------- letters ---------------- */
    slotDays: [1, 11, 21],
    fuse: { broker: 7, poach: 7, rentout: 7, renewal: 7, hire: 10, demand: 10, open: 10, acqui: 10, term: 14, meridian: 14, december: 10 },
    poachFrom: 91, poachChance: 0.35, poachMinPeople: 3,
    flickPx: 40, flickVel: 0.3,
    decemberDay: 355,                // 21 Dec

    /* ---------------- plot (art direction) ---------------- */
    plotRightMinLog: 24.3, plotLeftMinLog: 16, plotLeftMaxLog: 20, plotLeftBack: 4, panSec: 0.8,
    plotLossTop: 11.5, plotLossBottom: 1.55,

    /* ---------------- layout (art direction) ---------------- */
    phone: { ref: 860, headerH: 56, paperBottom: 452, namesW: 52, rulerH: 24, bandBottom: 560, clusterTop: 566, clusterH: 52,
      stripTop: 624, stripH: 52, homeW: 56, letterTop: 700, letterH: 128, gutter: 16, readoutAbove: 56, nameLine: 28 },
    laptop: { colMax: 1200, header: 0.07, paperBottom: 0.58, namesW: 120, rulerH: 28, bandTop: 0.58, bandBottom: 0.71, clusterTop: 0.72, clusterBottom: 0.78,
      stripTop: 0.79, stripH: 60, homeW: 72, letterTop: 0.87, letterW: 560, letterH: 120, bandMax: 760, readoutAbove: 40, nameLine: 32 },
    laptopMinWidth: 960,
    nibHit: 44, keyStep: 0.02, keyStepShift: 0.10, restReadSec: 0.1, pressMaxMs: 300,

    /* ---------------- sound (dBFS) ---------------- */
    sound: { motorDb: -30, motorNoiseDb: -36, idleDb: -36, scratchMaxDb: -28, tickDb: -34, printDb: -38, liftDb: -18, feedDb: -30,
      payDb: -20, letterDb: -34, takeDb: -22, passDb: -36, fuseDb: -46, hangThudDb: -24 },

    /* ---------------- motion ---------------- */
    letterInSec: 0.4, takeSec: 0.25, passSec: 0.3, noteFadeSec: 8, noteCharMs: 30, nameLetterMs: 40, headlineSec: 7
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
