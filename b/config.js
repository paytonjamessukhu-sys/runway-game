/* FRONTIER, the control room. Every tunable number lives in this one object.
   Sources: spec/dashboard1.md (the brief), spec/sim1.json (2020 facts, cast, prices), the lab sim's tuned config.
   Day 0 is Wed 1 Jan 2020; day 365 is Thu 31 Dec 2020. */
(function (root) {
  var CFG = {
    /* ---------- clock ---------- */
    year: 2020, endDay: 366,            // the year ends at the end of day 365 (31 Dec)
    daysPerSec: 1,                       // 1x = one game day per real second
    speeds: [1, 2, 4],
    hangMinRealSec: 1.8,                 // a hang stays dark at least this long in real time at 1x
    maxStepDays: 0.05,

    /* ---------- money ---------- */
    seedCash: 6000000, dgx1Start: 149000, seedPost: 30000000, stakeStart: 0.80,
    base: 40000,                         // you, the office, ops: per month
    upkeepPerOwned: 150,                 // per owned card per month (power, rack space)
    boardBelow: 0.50,                    // the board takes control below this stake and sells on the next 1st
    acquiRunwayMonths: 3, acquiPerHead: 4000000,

    /* ---------- cards ---------- */
    flops: { v100: 3.456e18, a100: 8.64e18 },   // delivered FLOPs per card-day: 40 TFLOPS of 125 peak; A100 = 2.5x
    pf: { v100: 0.04, a100: 0.1 },               // PF-days per card-day (delivered)
    startOwned: 8,                               // the DGX-1 in the office
    rentTerm: 30,                                // cloud V100s by the month, auto-renew
    rentPrice: [[0, 2.48], [91, 3.06], [162, 3.50]], // $/GPU-hour: GCP list to 31 Mar, AWS list from 1 Apr, scarce after the API
    rentCap: [[0, 64], [31, 128], [60, 256], [162, 0]], // broker capacity by day (total you can hold); none new after 11 Jun
    rentBlocks: [64, 128, 256],
    renewRefuseAfter: 162, renewRefuseShare: 0.5, renewNoticeDays: 7,
    spot: { fromDay: 166, untilDay: 320, n: 256, price: 4.40, days: 45 },  // second-hand cancelled reservations
    buy: {
      dgx1: { label: 'DGX-1', type: 'v100', per: 8, price: 149000, lead: 28, fromDay: 0 },
      dgxa100: { label: 'DGX A100', type: 'a100', per: 8, price: 199000, lead: 84, fromDay: 134 }
    },
    covidLeadFrom: 60, covidLeadTo: 181, covidLeadExtra: 28,   // orders 1 Mar to 30 Jun: +4 weeks
    afterGpt3LeadExtra: 56, afterGpt3PriceMult: 1.2,             // demand after 28 May: +8 weeks, +20%
    leaseOut: { perHour: 1.90, days: 30, share: 0.5, minOwned: 16 },
    servingShare: 1 / 8, servingMin: 8, servingMax: 64,

    /* ---------- Meridian (fictional cloud giant) ---------- */
    meridian: {
      credits: 50000000, cards: 1024, lead: 42, needC: 1e21, fromDay: 91, rate: 2.48, firstLook: 7,
      queueFrom: 162, full: 1.5, half: 10,       // queue from 11 Jun: full allocation within 1.5x of the frontier, half within 10x, else a quarter
      second: { fromDay: 166, cards: 512, stake: 0.10 },
      priorityPerCard: 4000                      // a place at the front of the queue, per card per month, from the bank
    },

    /* ---------- raises (fictional investors) ---------- */
    lineDay: 22,                                 // 23 Jan: the scaling-laws paper
    crashDay: 75, reopenDay: 166,                // 16 Mar the market closes; 15 Jun it reopens
    bridge: { cash: 2000000, post: 40000000, needPubC: 1e19 },
    seriesA: { needC: 1e22, decades: 1, onLine: 1.015, pre: { cash: 30000000, post: 150000000 }, post: { cash: 60000000, post: 450000000 } },
    seriesB: { needC: 3e22, fromDay: 162, cash: 60000000, post: 600000000, postApi: 900000000 },   // smaller B keeps money live after the summer
    counterStake: 0.015, devStake: 0.01,
    termBlockDays: 90,

    /* ---------- the run ---------- */
    lineC: 2.68e28, lineAlpha: 0.050, startLoss: 10.825,
    gpt3C: 3.14e23, gpt3Loss: 1.763, gpt3Day: 148, miracleCTol: 0.97, miracleLTol: 1.005,
    tokGPT3: 3.0e11, tokExp: 0.27,               // the 2020 recipe: D = 300B x (C / 3.14e23)^0.27
    allocPenalty: 0.035,                         // loss x (1 + k * log10(D / D_recipe)^2)
    memBase: 1e9, memPerSystems: 20,             // 1B parameters fit on one 32 GB V100; each systems person splits 20x further
    horizonMult: 10, horizonFirst: 2.765e20,     // beyond 10x your farthest clean dot you are projecting blind
    blindShare: 0.3, blindHi: [0.02, 0.05],
    projErr: { none: 0.10, line: 0.04, scaling: 0.02 },   // +- on the projected loss: before the paper, after it, with a scaling person
    landNoise: 0.006,
    sunheeBend: 0.975, sunheeDelay: 30,
    checkpoints: [0.002, 0.01, 0.03, 0.06, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    autoSample: [0.06, 0.3, 0.7],
    minRunDays: 0.05, maxRunDays: 365,
    nanPerDay: 0.006, nanBack: 0.03,             // NaN: per run-day per decade of params above 100M; rolls back ~3%
    abortMood: 5,

    /* ---------- hangs ---------- */
    hangPerCardDay: 4.0e-4, hangInfraMult: [1, 0.4, 0.2],
    hangLoss: { none: 0.8, infra: 0.15, covidExtra: 1.0 }, covidHangFrom: 75, covidHangTo: 181,
    wakeDays: 20 / 1440, wakeMood: 10,

    /* ---------- data ---------- */
    rawTokens: 4.1e11,                           // the raw crawl slice you hold
    W_lo: 14e9, W_hi: 45e9, passes: 4,           // clean unique tokens W; the wall is 4 passes of it
    cleanR: 0.62, frayStep: 0.076, frayMax: 5,   // the words fray from 62% of the wall
    pastWallPenalty: 0.04,                       // a run past the wall lands above the line by up to 4%
    filter: { cost: 150000, days: 21, daysFast: 12, mult: 1.862 },
    wallErr: [0.45, 0.25, 0.12],                 // +- on the wall estimate with 1, 2, 3+ data people (0 people: 0.7)

    /* ---------- capabilities ---------- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capRevenue: { paragraph: 30000, arithmetic: 60000, translation: 120000, code: 250000 },
    contamination: 0.3,                          // per testable capability, before the first filter job

    /* ---------- publish, ship, scandal ---------- */
    shipFromDay: 162, publishRep: [2, 20], shipRep: 4,
    rivalSlideDelay: 14, rivalSlideExp: 0.25,
    scandal: { publish: 0.20, publishFiltered: 0.10, ship: 0.15, pastWall: 0.6, delay: [20, 60], rep: 20, mood: 25 },
    redteamDays: 14, redteamDaysApi: 7,
    repStart: 5, repDecayPerMonth: 1,

    /* ---------- relevance (forgotten) ---------- */
    relevanceDays: 120, relevanceShare: 0.01,    // publish or ship a clean result >= 1% of the frontier at least every 120 days

    /* ---------- people ---------- */
    moodStart: 70, raiseMood: 15, raiseMult: 1.10, noPaperDays: 60, noPaperMood: 3,
    hangMoodInfra: 1, publishMood: 8, capMood: 10,
    poachFromDay: 91, poachChance: 0.35, poachMinPeople: 3, counterMood: 20, counterRaise: 0.35,
    askRiseAfterGpt3: 1.35,

    /* ---------- rivals (fictional) ---------- */
    rivals: [
      { key: 'halcyon', name: 'Halcyon', blurb: 'big-tech funded', c0: 1e21, tau: 5.0, period: 70, offset: 1.00, cap: 2.4e23, gpus0: 1024, gpuDouble: 150 },
      { key: 'kestrel', name: 'Kestrel', blurb: 'scrappy, fast', c0: 1.5e19, tau: 3.4, period: 50, offset: 1.01, cap: 1.8e23, gpus0: 96, gpuDouble: 70 },
      { key: 'northwind', name: 'Northwind', blurb: 'open, academic', c0: 3e20, tau: 6.0, period: 45, offset: 1.02, cap: 1.1e23, gpus0: 320, gpuDouble: 120 }
    ],
    rivalJitter: 0.15, rivalPassBoost: 0.2, openBoost: 0.2,

    /* ---------- score ---------- */
    score: { model: 600, miracle: 300, rep: 3, revPer: 10000, person: 15, floorLog: 19 },

    /* ---------- presentation ---------- */
    plot: { xMin: 17, xMax: 25, yMin: 1.5, yMax: 12 },
    histDays: 1
  };
  CFG.memC = null;
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
