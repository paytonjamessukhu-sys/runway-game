/* FRONTIER control room (builder C). Every tunable number and rule switch lives in this one object.
   Sources: spec/dashboard1.md (the brief), spec/sim1.json (2020 facts, cast, prices), council/sim-panel.md (what to avoid). */
(function (root) {
  var CFG = {
    /* ---------- clock ---------- */
    year: 2020,
    endDay: 366,                 // the year ends at midnight after day 365 (Thu 31 Dec 2020)
    daysPerSec: 1,               // 1x = one game day per real second
    speeds: [1, 2],
    minRunRealSec: 4,            // a run never pours in under 4 real seconds at 1x (short runs slow the clock)
    hangMinRealSec: 1.8,         // a hang stays dark at least this long at 1x, so a name can be woken
    slots: [1, 11, 21],          // days of the month when letters (offers, demands, poaches) can knock

    /* ---------- money ---------- */
    seedCash: 6000000, seedPost: 30000000, stakeStart: 0.80, dgx1Price: 149000,
    base: 40000,                 // you, ops and the office, per month
    upkeepPerCard: 150,          // power and colocation per owned card, per month
    lowRunwayMonths: 6,          // below this, everyone worries on payday
    acquiPerHead: 4000000, acquiRunway: 3,
    boardBelow: 0.5,             // below 50% stake the board sells to the next bidder

    /* ---------- cards ---------- */
    flops: { v100: 3.456e18, a100: 8.64e18 },  // delivered FLOPs per card-day (40 of 125 TFLOPS tensor peak; A100 2.5x)
    pfDay: 8.64e19,
    startV100: 8,                // the DGX-1 in the office
    ownedHourly: 0.21,           // what an owned card-hour costs in power and colo (for the designer's cost line)
    rent: {
      termDays: 90, renewWindow: 30,
      price: [[0, 2.48], [91, 3.06], [162, 3.50]],            // $/V100-hour: GCP list, AWS list from 1 Apr, scarce after the API
      cap: [[0, 64], [31, 192], [60, 448], [162, 512]],         // the most the broker will rent you at once, by day
      afterApiMonthly: 64,       // after 11 Jun a block of 64 a month at most
      renewRefuseAfterApi: 0.5,
      block: 64
    },
    buy: {
      dgx1: { label: 'DGX-1', n: 8, type: 'v100', price: 149000, lead: 28, from: 0 },
      pod: { label: 'V100 pod', n: 64, type: 'v100', price: 1192000, lead: 56, from: 0 },
      dgxa: { label: 'DGX A100', n: 8, type: 'a100', price: 199000, lead: 84, from: 134 },
      poda: { label: 'A100 pod', n: 64, type: 'a100', price: 1592000, lead: 84, from: 134 }
    },
    covidOrderFrom: 60, covidOrderTo: 181, covidOrderExtra: 28,   // orders 1 Mar to 30 Jun take 4 weeks longer
    apiDay: 162,                 // 11 Jun 2020
    afterApiPriceMult: 1.2, afterApiLeadExtra: 56,                  // post-GPT-3 scramble: +20% and +8 weeks
    rentOut: { perHour: 1.90, days: 30, minOwned: 16, share: 0.5 },
    serving: { share: 1 / 8, min: 8, max: 64 },

    /* ---------- Meridian (fictional cloud giant) ---------- */
    meridian: { credits: 50000000, cards: 1024, lead: 56, rate: 2.48, needC: 1e21, fromDay: 91, firstLook: 7,
      queueFrom: 162, queueFull: 2, queueHalf: 10, second: { fromDay: 166, cards: 512, stakeMult: 0.9 } },

    /* ---------- the lab's books (display addendum): what the lab owns, fixed prices, no depreciation ---------- */
    own: { v100: 18625, a100: 24875, v100Day: 59.52, ownedPerDay: 4.93, life: 912, mfu: 0.32, base: 2.765e19, gpt3Years: 365 },
    desperation: { months: 6, floor: 0.6 },   // under 6 months until broke, investors smell it: post x (0.6 + 0.4 x months / 6)
    preset: { days: 21, maxDays: 60 },
    sizes: [1, 8, 32, 64],        // units of today's best box on the shelf

    /* ---------- raising ---------- */
    lineDay: 22,                 // 23 Jan: the scaling-laws paper
    crashDay: 75, marketOpenDay: 166,                              // 16 Mar closes the market, 15 Jun opens it
    seriesA: { needC: 1e22, decades: 1, onLine: 1.015, fromDay: 22, pre: { cash: 30e6, post: 150e6 }, after: { cash: 60e6, post: 450e6 }, passMult: 3 },
    seriesB: { needC: 3e22, fromDay: 162, cash: 150e6, post: 1.2e9, postApi: 1.8e9 },
    scandalBlockDays: 90,
    counterStake: 0.015, devStake: 0.01, counterRaiseAfter: 148, counterRaise: 1.35,

    /* ---------- the run ---------- */
    lineC: 2.68e28, lineAlpha: 0.050, startLoss: 10.825, curveNoise: 0.010,
    gpt3C: 3.14e23, gpt3L: 1.763, gpt3Day: 148, miracleTol: 1.005, miracleCTol: 0.97,
    tokGPT3: 3.0e11, tokExp: 0.27,                                  // the fixed 2020 recipe: D = 300B x (C / 3.14e23)^0.27
    offRecipeK: 0.03,            // loss x (1 + k x decades-off-recipe^2) when tokens stray from the recipe
    memLimit: [2e9, 2e10, 4e11], // max parameters with 0, 1, 2+ systems people (one 32 GB card; split across 8; pipelines)
    horizonMult: 10, horizonFirst: 2.765e20,
    extrapSigma: 0.02,           // per decade past the measured horizon: the run may land this much high
    scalingSigmaMult: 0.25, lineKnownMult: 0.7,
    landNoise: 0.004,
    onLineTol: 1.015,
    optBend: 0.975, optDelay: 30, // an optimizer person bends every run 2.5% under the line after 30 days
    pastWallPenalty: 0.04,       // per doubling of tokens past the wall
    checkpoints: (function () { var a = [0.0005, 0.002, 0.01]; for (var i = 1; i <= 20; i++) a.push(+(i * 0.05).toFixed(2)); return a; })(),
    autoSampleAt: [0.12, 0.45, 0.8],   // the first saved-model sample lands about 3 s into a 3-week run
    paramsMin: 5e7, paramsMax: 5e11, tokensMin: 1e9, tokensMax: 1e12,
    starter: { N: 1.5e8, D: 2.2e10 },

    /* ---------- hangs ---------- */
    hangPerCardDay: 4.0e-4,      // linear in cards: about 0.4 a day on 1,024 V100s
    hangInfraMult: 0.4, hangBothMult: 0.2,
    hangCovidFrom: 75, hangCovidTo: 181, hangCovidExtra: 1,       // nobody can get into the building
    hangInfraDays: 0.04, rewindNoInfra: 0.5, rewindInfra: 0.1, wakeDays: 0.014, wakeMood: 10, wakeMoodInfra: 5,
    tomBreakHangs: 3,
    nanShare: 0.25,              // a quarter of failures are NaNs: the loss blows up and the run rolls back, no dark wait
    nanRewindNoInfra: 1.0, nanRewindInfra: 0.25, nanPauseDays: 0.08,
    migrateBelow: 0.5, migrateGain: 1.5, migrateRewind: 0.01,   // a run below half its launch speed moves to a pool 1.5x faster

    /* ---------- data wall and filter jobs ---------- */
    W_lo: 14e9, W_hi: 40e9, passes: 4, rawCrawl: 1.4e12,
    cleanR: 0.62, frayStep: 0.076, frayMax: 5,
    filterMult: 1.862, filterCost: 150000, filterDays: 30, filterDaysPair: 17,

    /* ---------- capabilities and the API ---------- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capRevenue: { paragraph: 30000, arithmetic: 60000, translation: 120000, code: 250000 },
    capSampleShare: 0.35, contamination: 0.3, capMood: 10,
    tierStatic: 6.0, tierWords: 4.3, tierGrammar: 3.3, t3Sense: [2.78, 2.48],
    covidStringDay: 70,

    /* ---------- publish, ship, scandal, reputation ---------- */
    repStart: 5,
    repPublishBase: 2, repPublishReach: 24, repPerCap: 5, repShip: 4, repScandal: 15, repOpen: 8, repDecay: 1, repDecayAfter: 60,
    rivalSlideDelay: 14, rivalSlideExp: 0.25,
    scandalPublish: 0.20, scandalPublishFiltered: 0.10, scandalShip: 0.15, scandalDelay: [20, 60], scandalMood: 30,
    redTeamDays: 14, redTeamDaysApi: 7,
    publishMood: 15, firstAuthorMood: 30,

    /* ---------- relevance (the forgotten rule) ---------- */
    relevanceGrace: 120,         // the first deadline is 30 Apr
    relevanceWindow: 100,        // every publish or ship that matters buys 100 more days
    relevanceShare: 0.01,        // matters = at least 1% of the frontier's compute

    /* ---------- people ---------- */
    moodStart: 70, moodWorried: 3, raiseAskBelow: 30, raiseAskGap: 60, raiseMult: 1.2,
    noPaperDays: 60, noPaperMood: 2, counterMood: 20,
    candidateWindow: 21,         // a candidate stays on the hiring board this many days
    poachFrom: 91, poachChance: 0.35, poachMinPeople: 3,
    optTrickDecades: 0.22,
    demands: { priyaFrom: 70, devAfter: 90, ayaanAfter: 60, sunheeAfter: 45, tomGap: 60, openFrom: 182, openNeedC: 1e21, december: 355, sunheeNeedC: 1e21 },
    moods: { ayaanFull: 15, ayaanRefused: 40, devYes: 15, tomOff: 20, tomRefused: 30, sunheeYes: 20, raiseYes: 30, raiseNo: 10, december: 20 },
    repSunheeTrick: 5, repBlessing: 5, tomOffDays: 7, acquiFrom: 31,

    /* ---------- rivals (fictional) ---------- */
    rivals: [
      { key: 'halcyon', name: 'Halcyon', kind: 'big-tech-funded lab', c0: 1e21, tau: 5.0, period: 70, offset: 1.00, cap: 2.4e23 },
      { key: 'kestrel', name: 'Kestrel', kind: 'startup your size', c0: 1.5e19, tau: 3.4, period: 50, offset: 1.01, cap: 1.8e23 },
      { key: 'northwind', name: 'Northwind', kind: 'open research collective', c0: 3e20, tau: 6.0, period: 45, offset: 1.02, cap: 1.1e23 }
    ],
    rivalJitter: 0.15, rivalPassBoost: 0.2, rivalOpenKestrel: 0.2, rivalOpenNorthwind: 0.4,

    /* ---------- score ---------- */
    score: { modelMax: 100, modelSpanDecades: 4, miracle: 50, perPerson: 5, revenuePer: 50000 },

    /* ---------- chart ---------- */
    chart: { xMin: 17, xMax: 25, yMin: 1.45, yMax: 12 }
  };
  CFG.memC0 = null; // filled by engine (compute where the recipe hits memLimit[0])
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CFG = CFG;
})(this);
