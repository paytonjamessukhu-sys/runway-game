/* FRONTIER, the lab sim. Every tunable number and rule switch lives in this one object so balance can be patched.
   Source of truth: spec/sim1.json, amended by the playtest panel (council/sim-panel.md). Where the panel overrode the
   spec (reading time, honest strip, abortable runs, explained endings, Karpathy's physics), the comment says so. */
(function (root) {
  var CFG = {
    /* ---------- the clock ---------- */
    year: 2020,
    endDay: 365,                 // day 365 = Thu 31 Dec 2020; the year ends at 23:59 on it
    pourDaysPerSec: 1.0,         // pour and hang: one game day per real second
    idleDaysPerSec: 3.0,         // idle with nothing to read: three game days per second
    idleLetterDaysPerSec: 1.0,   // panel: idle while a letter is on screen runs at the pour rate, so reading costs nothing extra
    minPourSec: 4.0,             // a pour lasts max(4 s, T s), re-checked whenever cards change mid-run
    pourLongAfterSec: 75,        // panel: a long run speeds up so one pour never takes much more than ~75 s ...
    pourMaxRate: 2.5,            // ... but never faster than 2.5 game days a second
    landCleanSec: 2.2, landWallSec: 3.1, momentSec: 3.5, landAbortSec: 1.2,
    beatGpt3Sec: 1.1,            // 28 May: the GPT-3 headline settles first, then the point presses in
    kbdFreezeSec: 2.5,           // arrow keys on the nib hold the clock like a thumb does, for this long after the last key
    endHoldMinSec: 3.0,          // panel: the end frame explains itself and waits for a tap (after at least 3 s) ...
    endAutoSec: 40,              // ... or feeds a fresh year on its own after 40 s
    pauseWhenHidden: true,

    /* ---------- money ---------- */
    seedCash: 6000000, seedPost: 30000000, stakeStart: 0.80, dgx1: 149000,
    base: 40000,                 // you, ops, the office, per month
    upkeepPerOwned: 150,         // per owned card, on every 1st
    acquiPerHead: 4000000, acquiMonths: 3,
    monthsCap: 999,              // panel: show the real figure above 99, so a $1.9M rack never reads 'MONTHS 99 → 99'

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
    buyA100: { n: 64, price: 1592000, leadDays: 112, fromDay: 134 },  // gate step 3: DGX A100 12 -> 16 weeks
    covidOrderFrom: 60, covidOrderTo: 181, covidOrderExtra: 42,       // gate step 3: orders 1 Mar to 30 Jun +4 -> +6 weeks
    buyMustArriveBy: 335,        // panel: no buy letter for cards that cannot arrive before 1 Dec
    apiDay: 162,                 // 11 Jun
    afterApiPriceMult: 1.2, afterApiLeadExtra: 56,
    rentOutPerHour: 1.90, rentOutDays: 30, rentOutMonths: 6, rentOutMinOwned: 16,
    servingShare: 1 / 8, servingMin: 8, servingMax: 64,
    nodeAbove: 128, podAbove: 2048,
    // Karpathy: one synchronous run trains on one pool. Pools: your office racks (V100s), your A100 racks, the broker's
    // cloud, Meridian's cloud. A run binds to the biggest pool at the lift and only that pool's cells glow.
    pools: ['meridian', 'broker', 'a100', 'office'],
    // after the API headline a second-hand broker sells short V100 blocks at a premium (panel: money must buy something
    // that lands in time after June). Greyed under Meridian's exclusivity.
    spot: { fromDay: 166, untilDay: 320, n: 256, price: 4.40, days: 45, gapDays: 30 },

    /* ---------- Meridian ---------- */
    // gate steps 1, 2 and 4: lead 42 -> 56 days, full queue within 1.5x, allocation 1,024 -> 768 -> 640 (the strategy sim:
    // at 768 the careful reader reached GPT-3 in 58% of years; at 640, 25%)
    meridianCredits: 50000000, meridianRate: 2.48, meridianCards: 640, meridianLead: 56, meridianNeedC: 1e21, meridianFromDay: 91,
    meridianFirstLook: 7, meridianQueueFromDay: 162, meridianQueueFull: 1.5, meridianQueueHalf: 10,  // gate step 2: full within 2x -> 1.5x
    meridian2FromDay: 166, meridian2Cards: 320, meridian2Stake: 0.9,
    // panel: keep money pressure after the raises. Meridian sells a place at the front of its queue, paid from the bank.
    priority: { fromDay: 162, perCardMonth: 4000, fuse: 10 },
    queueWarnDays: 6,            // a pencil warning by the cluster this many days before a queue cut

    /* ---------- raises ---------- */
    lineFromDay: 22,             // 23 Jan: the line prints
    crashDay: 75, marketOpenDay: 166, termAfterCrashSlotDay: 172, // 16 Mar closes, 15 Jun opens, the 21 June slot
    seriesA: { needC: 1e22, decades: 1, decadesTol: 0.98, onLine: 1.015, fromDay: 0, pre: { cash: 30e6, post: 150e6 }, after: { cash: 60e6, post: 450e6 }, passMult: 3 },
    seriesB: { needC: 3e22, cash: 60e6, post: 600e6, postApi: 900e6 },   // panel: a smaller B keeps money pressure alive after the summer raises
    counterStake: 0.015, devStake: 0.01, boardBelow: 0.5,
    counterRaiseAfterGpt3: 0.35, // after 28 May a counter-offer is a raise as well as equity (salary x 1.35)

    /* ---------- the run ---------- */
    lineC: 2.68e28, lineAlpha: 0.050, startLoss: 10.825, curveNoise: 0.012,
    gpt3C: 3.14e23, gpt3Loss: 1.763, miracleTol: 1.005, miracleCTol: 0.97,  // panel: a clean dot within 3% of GPT-3's compute counts
    gpt3SnapDecades: 0.035,      // the drag mark settles onto GPT-3's point when it is this close (log10)
    // Karpathy: anchor the fixed 2020 recipe on GPT-3 itself, D = 300B x (C / 3.14e23)^0.27, so 3.14e23 is 175B on 300B
    tokGPT3: 3.0e11, tokExp: 0.27,
    memParams: 1e9,              // a 1B-parameter model fits on one 32 GB V100 with Adam; memC is derived from the recipe
    probeDays: 0.25,
    horizonMult: 10, horizonFirst: 2.765e20,
    blindShare: 0.3, blindHi: [0.02, 0.05], blindLo: [0, 0.005],
    sunheeBend: 0.975, sunheeDelay: 30,
    landNoise: [0.006, 0.003],   // Karpathy: sigma of ln(loss) at a clean landing, 1e18 -> 3e23 FLOPs
    pastWallDip: [0.01, 0.03],   // Karpathy (B): past the wall the run is suspiciously good, 1 to 3% under the line
    stripLog: true,              // panel: the strip's travel is logarithmic in days, so the mark moves evenly on the log paper
    checkpoints: (function () { var a = [0.0005, 0.002, 0.01]; for (var i = 1; i <= 20; i++) a.push(+(i * 0.05).toFixed(2)); return a; })(),
    autoSampleQ: [0.12, 0.35, 0.75], autoQuietSec: 2.5, autoEverySec: 15, autoEveryLongerThan: 30,
    tapWaitSec: 0.7,
    abortMood: 5, abortMoodBeliever: 20,  // panel: a locked run can be abandoned, at a cost

    /* ---------- hangs ---------- */
    hangPerCardDay: 4.0e-4,      // Karpathy: hangs are linear in cards, about 0.4 a day on 1,024 V100s
    hangInfraMult: 0.4, hangBothMult: 0.2,
    hangCovidFrom: 75, hangCovidTo: 181, hangCovidExtraDays: 1,
    hangDayHours: [7, 23], hangDayNoticeHours: [0.5, 2], // Karpathy: someone at a desk notices a daytime hang within hours
    infraRestartDays: 1 / 24, infraRewindDays: 4 / 24, wokenRestartDays: 20 / 1440, wakeMood: 10, wakeMoodTom: 5,
    hangMinRealSec: 1.8,         // panel: the dark lasts at least this long in real time, so a name can be pressed

    /* ---------- data wall and the filter ---------- */
    // the wall, under the GPT-3-anchored recipe, falls between 6e20 and 5e22: GPT-3 needs one to three filter jobs,
    // so the reader who sees the wall coming (and starts Priya early) gains weeks the blunderer spends crossing it
    W_lo: 14e9, W_hi: 45e9, passes: 4,
    // balance (panel: reading must pay in reach): the words start to fray 6.6x in compute before the wall (was 3.2x),
    // so a careful reader nearly always sees it coming; amounts 1 to 5 climb across that zone
    cleanR: 0.62, frayStep: 0.076, frayAmounts: 5,
    filterW: 1.862, filterCost: 150000, filterDays: 21, filterDaysInes: 12,
    priyaAutoK: 6,               // balance: Priya flags on her own only when the words are crawl; fray is for readers
    priyaAskK: 1,                // panel: press her at any fray and she offers the job

    /* ---------- capabilities ---------- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capRevenue: { paragraph: 30000, arithmetic: 60000, translation: 120000, code: 250000 },
    capSampleShare: 0.35, contamination: 0.3, capMood: 10,
    noTestSet: ['paragraph'],    // Karpathy: a paragraph has no benchmark to leak
    tierStatic: 6.0, tierWords: 4.3, tierGrammar: 3.3, t3Sense: [2.78, 2.48],
    wordMs: 45, bandMaxChars: 170, covidStringDay: 70,

    /* ---------- publish, ship, scandal ---------- */
    publishFromDay: 31, shipFromDay: 162,
    rivalSlideDelay: 14, rivalSlideExp: 0.25,
    scandalPublish: 0.20, scandalPublishFiltered: 0.10, scandalShip: 0.15, scandalDelay: [20, 60],
    scandalTermBlockDays: 90, scandalMood: 30,
    redTeamDays: 14, redTeamDaysApi: 7,
    publishMoodEgo3: 15, publishMoodFirstAuthor: 30,
    firstAuthorHoldSec: 3.5,     // panel: Priya's auto-publish waits a beat, so pressing Lena can still red-team it

    /* ---------- people ---------- */
    moodStart: 70, moodGraphite: 25, egoWeight: { 2: 450, 3: 550, 4: 650 },
    noPaperDays: 60, noPaperMood: 2, counterMood: 20,
    poachFromDay: 91, poachChance: 0.35, poachMinPeople: 3,
    sunheeTrickDecades: 0.22,    // her published trick is worth 1.66x compute to every rival (0.22 decades)

    /* ---------- rivals (fictional) ---------- */
    rivals: [
      { key: 'halcyon', name: 'Halcyon', c0: 1e21, tau: 5.0, period: 70, offset: 1.00 },
      { key: 'kestrel', name: 'Kestrel', c0: 1.5e19, tau: 3.4, period: 50, offset: 1.01 },
      { key: 'northwind', name: 'Northwind', c0: 3e20, tau: 6.0, period: 45, offset: 1.02 }
    ],
    rivalJitter: 0.15, rivalPassBoost: 0.2, rivalOpenKestrel: 0.2, rivalOpenNorthwind: 0.4, rivalPassOpenNorthwind: 0.1,
    rivalCapC: 2.4e23,           // panel: no fictional lab passes GPT-3 in 2020

    /* ---------- relevance ---------- */
    relevanceFromDay: 91, relevanceShare: 0.01, openedMult: 3, vaultedMult: 0.1,

    /* ---------- letters ---------- */
    fuse: { broker: 7, poach: 7, rentout: 7, renewal: 7, hire: 10, demand: 10, open: 10, acqui: 10, term: 14, meridian: 14, spot: 7, priority: 10 },
    letterMinRealSec: 8,         // panel: every letter stays up at least 8 real seconds of moving clock
    letterTapGuardSec: 0.4,      // panel: taps on a letter that just replaced another are ignored for 400 ms
    letterGapSec: 0.6,           // a beat between one letter leaving and the next arriving
    flickPx: 40, flickVel: 0.3,

    /* ---------- plot ---------- */
    plotLossTop: 11.5, plotLossBottom: 1.55,
    plotRightMinLog: 24.3, plotLeftMinLog: 16, plotLeftMaxLog: 20, plotLeftBack: 4, panSec: 0.8,
    dupCurveDecades: 0.015,      // finished curves this close in compute draw once (the newest)

    /* ---------- motion (seconds) ---------- */
    noteCharSec: 0.03, nameCharSec: 0.04, noteFadeSec: 8, headlineHoldSec: 7, headlineInSec: 0.45, stopNoteSec: 2.4, remapSec: 0.4,
    letterInSec: 0.4, letterTakeSec: 0.25, letterPassSec: 0.3, sweepSec: 0.3, regroupSec: 0.6,
    cellDrawSec: 0.012, cellDrawMaxSec: 0.9,       // new cells draw into the band one after another
    rollMaxSec: 0.6,                                // the months figure rolls on letters that move money; payroll is one frame
    pressMaxMs: 300,                                // a press is a tap of 300 ms or less
    teachHoldSec: 14,                               // a first-time pencil lesson stays this long unless the verb is used

    /* ---------- layout (px) ---------- */
    laptopMinWidth: 960,
    phone: { margin: 58, home: 56, nibW: 12, readoutAbove: 56, rulerH: 36, axisH: 12 },
    laptop: { margin: 130, home: 72, nibW: 12, readoutAbove: 40, rulerH: 40, axisH: 14 },
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
  // derived: the memory stop is the compute at which the recipe's model reaches memParams parameters (N = C / 6D)
  CFG.memC = Math.pow(6 * CFG.memParams * CFG.tokGPT3 / Math.pow(CFG.gpt3C, CFG.tokExp), 1 / (1 - CFG.tokExp));
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
