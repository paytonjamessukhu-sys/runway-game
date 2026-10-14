/* FRONTIER control room, build A ("the strategist").
   Every tunable number and rule lives in this one object. The engine, the screen and the balance sim
   (test/balance.mjs) all read it, so a change here changes the game and the sim together.
   Sources: spec/dashboard1.md (the law), spec/sim1.json (2020 facts, cast, rivals, Meridian, rounds), and the
   playtest panel (council/sim-panel.md). Dates are ISO strings; the engine turns them into day numbers
   (day 0 = Wed 1 Jan 2020, day 365 = Thu 31 Dec 2020). */
(function (root) {
  var CFG = {
    year: 2020,
    yearDays: 366,                 // 2020 is a leap year; the year ends at the close of day 365
    daysPerSec: 1,                 // 1x = one game day per real second
    speeds: [1, 2, 4],
    step: 0.125,                   // engine sub-step in game days (runs, hangs and money move continuously)

    /* ---------- money ---------- */
    seedCash: 6000000, seedPost: 30000000, stakeStart: 0.80,
    dgx1Start: 149000,             // the DGX-1 you already bought from the seed
    base: 40000,                   // you, ops, the office: per month, paid on the 1st
    upkeepPerCard: 150,            // power and colocation per owned card, per month
    daysPerMonth: 30.4,

    /* ---------- cards and throughput ---------- */
    // V100: 125 TFLOPS tensor peak at 32% real utilisation = 40 TFLOPS = 3.456e18 FLOPs per card-day.
    // A100: 312 TFLOPS peak at the same utilisation = 8.64e18 (2.5 V100s).
    card: {
      v100: { peak: 125, flops: 3.456e18, mem: 1.0e9, eq: 1, label: 'V100' },
      a100: { peak: 312, flops: 8.64e18, mem: 1.25e9, eq: 2.5, label: 'A100' }
    },
    mfu: 0.32,
    // data-parallel efficiency falls as one synchronous run spreads over more cards
    scaleEffFrom: 64, scaleEffPerDoubling: 0.03, scaleEffMin: 0.75,
    startOwnedV100: 8,
    pools: ['office', 'a100', 'cloud', 'meridian'],
    poolNames: { office: 'Office V100s', a100: 'Office A100s', cloud: 'Rented V100s', meridian: 'Meridian V100s' },

    /* ---------- the GPU market ---------- */
    // rent V100s by the month (30-day terms that renew), billed by the hour, live the next day
    rentBlock: 8, rentTermDays: 30,
    rentPrice: [['2020-01-01', 2.48], ['2020-04-01', 3.06], ['2020-06-11', 3.50], ['2020-09-01', 3.30]],
    rentCap: [['2020-01-01', 64], ['2020-02-01', 128], ['2020-03-01', 256], ['2020-05-28', 128], ['2020-06-11', 64], ['2020-09-01', 128]],
    renewRefuseFrom: '2020-06-11', renewRefuseShare: 0.35,   // after the API boom some renewals are refused
    buy: {
      dgx1: { cards: 8, type: 'v100', price: 149000, leadDays: 42, from: '2020-01-01', label: 'DGX-1 (8 V100)', short: 'DGX-1', yearCap: 64 },
      dgxa100: { cards: 8, type: 'a100', price: 199000, leadDays: 70, from: '2020-05-14', label: 'DGX A100 (8 A100)', short: 'DGX A100', yearCap: 64 }
    },
    buyMaxUnits: 64,               // per order; the reseller also caps each item per year for a startup (yearCap)
    shelfUnits: [1, 8, 32, 64],    // the grey shelf item on the Cluster row: the first of these that costs more than your cash
    cardLifeDays: 912,             // an owned card is written off over two and a half years: the "about $25 a day owned" line
    labValue: { v100: 18625, a100: 24875, v100Day: 59.52 },   // "your lab owns": a V100 is $18,625 (a DGX-1 / 8), an A100 $24,875, a V100-day of saved work is January's $2.48 x 24
    desperation: { months: 6, floor: 0.6 },                   // under 6 months until broke, Series A and B post-money x (0.6 + 0.4 x months / 6)
    covidOrderFrom: '2020-03-01', covidOrderTo: '2020-06-30', covidLeadExtra: 28,
    boomFrom: '2020-05-28', boomLeadExtra: 28, boomPriceMult: 1.15,
    rentOutPerHour: { v100: 1.90, a100: 3.80 }, rentOutDays: 30,
    servingShare: 1 / 8, servingMin: 8, servingMax: 64,

    /* ---------- Meridian (fictional cloud giant) ---------- */
    meridian: {
      credits: 50000000, rate: 2.48, cards: 768, leadDays: 56, needC: 1e21, from: '2020-04-01',
      firstLookDays: 7, queueFrom: '2020-06-11', queueFull: 1.5, queueHalf: 10,
      second: { from: '2020-06-15', share: 0.5, stakeMult: 0.9 },
      priorityPerCardMonth: 2500     // pay from the bank to stay at the front of the queue
    },

    /* ---------- fundraising ---------- */
    lineDay: '2020-01-23',           // the scaling-laws paper: dots count for investors from today
    crash: '2020-03-16', marketOpen: '2020-06-15',
    seriesA: { needC: 1e22, decades: 1, onLine: 1.015, diligenceDays: 10,
      pre: { cash: 30e6, post: 150e6 }, after: { cash: 60e6, post: 450e6 }, passMult: 3 },
    seriesB: { needC: 3e22, after: '2020-06-11', diligenceDays: 14, cash: 150e6, post: 1.2e9, postApi: 1.8e9 },
    bridge: { cash: 4e6, stake: 0.12, crashCash: 2e6, gapDays: 60, minRep: 5 },
    boardBelow: 0.5,
    repValue: [0.8, 1.25],           // a round's post-money scales from x0.8 at reputation 0 to x1.25 at 100

    /* ---------- the run: scaling law and loss model ---------- */
    lineC: 2.68e28, lineAlpha: 0.050,          // Kaplan et al. 2020: L(C) = (2.68e28 / C)^0.050 nats
    startLoss: 10.825,                         // ln(50,257): a model that knows nothing
    gpt3: { C: 3.14e23, L: 1.763, N: 175e9, D: 300e9, day: '2020-05-28', tolL: 1.005, tolC: 0.97 },
    // the fixed 2020 recipe, anchored on GPT-3: D_opt = 300B x (C / 3.14e23)^0.27, N_opt = C / (6 D_opt)
    tokExp: 0.27,
    offRecipe: 0.05,                           // loss x (1 + 0.05 x log10(N / N_opt)^2): 3x off costs 1.1%, 10x off 5%
    horizonFirst: 2.765e20, horizonMult: 10, horizonMultScaling: 100,
    blind: { share: 0.30, shareScaling: 0.12, hi: [0.02, 0.05], lo: [0, 0.005] },
    landNoise: [0.006, 0.003],                 // sigma of ln(loss) at landing, small runs to GPT-3 scale
    sunheeBend: 0.975, sunheeDelay: 30,
    pastWallDip: 0.02,                         // past the wall the curve looks 2% too good: it memorised boilerplate
    checkpoints: [0.0005, 0.002, 0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95],
    abortMood: 4,

    /* ---------- hangs and NaNs ---------- */
    hangPerCardDay: 4.0e-4,                    // hangs are linear in cards: about 0.4 a day on 1,024 V100s
    hangLost: 0.8, hangLostInfra: 0.15,        // days lost per hang without and with an infra person
    hangCovidFrom: '2020-03-16', hangCovidTo: '2020-06-30', hangCovidExtra: 1.0,  // nobody can get into the building
    hangRewind: 0.5, hangRewindInfra: 0.08,    // progress lost (days of training) to the last checkpoint
    nanPerDay: 0.002, nanSizeExp: 0.3, nanRewind: 1.0, nanSunhee: 0.5,
    hangMood: 1,

    /* ---------- the data wall ---------- */
    W_lo: 14e9, W_hi: 45e9, passes: 4,         // unique clean tokens; up to four passes count as clean
    rawCrawl: 1.0e12,                          // tokens of raw web crawl on disk
    cleanR: 0.62, frayStep: 0.076, frayMax: 5, // samples fray from 62% of the wall, in amounts 1 to 5
    // each filter job multiplies the clean tokens; the gain shrinks as the easy junk is gone (x1.86, x1.69, x1.55, ...)
    filter: { mult: 1.862, decay: 0.8, cost: 150000, costGrowth: 2, daysBase: 30, daysPerSkill: 3, pairMult: 0.6 },

    /* ---------- the year's luck (drawn per year from the seed, each one readable on screen when it matters) ---------- */
    variety: {
      rentCapMult: [0.5, 1.5],       // the broker's year: rental capacity x0.5 to x1.5 (Cluster: "broker has N")
      merCards: [512, 768, 1024],    // the size of Meridian's offer (Cluster: Meridian line)
      merLead: [35, 63],             // days until Meridian's cards are live
      heat: [0.7, 1.4],              // investor heat: every round's post-money (Money: fundraising cards)
      supply: [0, 28],               // supply chain: extra days on every hardware order (Cluster: arrive dates)
      hangMult: [0.6, 1.6]           // a stable or a flaky year for hangs (Cluster: hangs per 1,000 card-days)
    },

    /* ---------- capabilities ---------- */
    caps: [['paragraph', 2e21, 0.2], ['arithmetic', 1e22, 0.3], ['translation', 6e22, 0.3], ['code', 2.5e23, 0.3]],
    capNames: { paragraph: 'Paragraphs', arithmetic: 'Arithmetic', translation: 'Translation', code: 'Code' },
    capTests: { paragraph: 'a coherent paragraph', arithmetic: 'two-digit addition', translation: 'English to French', code: 'one-line Python functions' },
    capSlope: 0.012,                           // eval score = 1 / (1 + exp((L - L_cap) / (0.012 x L_cap)))
    capRevenue: { paragraph: 30000, arithmetic: 60000, translation: 120000, code: 250000 },
    contamination: 0.3, noTestSet: ['paragraph'],
    capMood: 8, capRep: 4,

    /* ---------- publish, ship, keep private ---------- */
    publishFrom: '2020-01-01', shipFrom: '2020-06-11',
    repPublish: [3, 6],                        // +3, plus 6 per decade past a hundredth of the frontier (cap +22)
    repPublishMax: 22, repShip: 3, repDecayAfter: 60, repDecay: 1,
    rivalSlideDelay: 14, rivalSlideExp: 0.25,
    scandal: { publish: 0.12, publishFiltered: 0.06, ship: 0.15, delay: [20, 50], rep: 15, mood: 20, termBlockDays: 90, relevanceCut: 30 },
    redTeamDays: 14, redTeamDaysApi: 7,
    publishMood: 10, firstAuthorMood: 20,
    apiRepFactor: [0.5, 1.5],                  // API revenue x0.5 at reputation 0 to x1.5 at 100

    /* ---------- forgotten ---------- */
    relevanceDays: 120,                        // publish or ship something within 100x of the frontier every 120 days
    relevanceShare: 0.01,

    /* ---------- people ---------- */
    moodStart: 70, moodLow: 35, raiseMult: 1.2, raiseMood: 15, raiseCooldown: 60,
    noPaperDays: 60, noPaperMood: 3, counterMood: 20, counterStake: 0.015, matchMult: 1.5,
    courtDays: 45,                             // a candidate on the board is courted by a rival after this many days
    poach: { from: '2020-04-01', chance: 0.35, lowMoodChance: 0.6, minPeople: 3 },
    systemsSplit: function (skill) { return Math.pow(2, skill + 2); },  // skill 3: 32 cards, skill 4: 64
    splitCap: 512,
    infraMult: function (skill) { return 1 - 0.15 * skill; },            // skill 3: x0.55, skill 4: x0.40

    /* ---------- rivals (fictional) ---------- */
    rivals: [
      { key: 'halcyon', name: 'Halcyon', blurb: 'big-tech-funded lab', c0: 1e21, tau: 5.0, period: 70, offset: 1.00, cap: 2.4e23 },
      { key: 'kestrel', name: 'Kestrel', blurb: 'a startup your size', c0: 1.5e19, tau: 3.4, period: 50, offset: 1.01, cap: 1.8e23 },
      { key: 'northwind', name: 'Northwind', blurb: 'open research collective', c0: 3e20, tau: 6.0, period: 45, offset: 1.02, cap: 1.1e23 }
    ],
    rivalJitter: 0.15, rivalPassBoost: 0.2, rivalEstErr: 0.25, rivalEstBand: 0.3,
    openWeights: { from: '2020-07-01', needC: 1e21, rep: 10, kestrel: 0.2, northwind: 0.4, passNorthwind: 0.1, earlySalary: 0.7 },

    /* ---------- buyouts ---------- */
    acquiPerHead: 4000000, acquiRunway: 3,
    strategicNeedC: 1e22, strategicMult: 1.5,

    /* ---------- score (shown with every ending) ---------- */
    // model: 1,000 at GPT-3's loss, 0 at 3.0 nats, up to 1,150 past it; each decade of compute on the line is worth ~190
    score: { modelMax: 1000, lossTop: 3.0, modelCap: 1.15, repMult: 2, revenuePer: 20000, perPerson: 10 },

    /* ---------- chart ---------- */
    chart: { xMin: 17, xMax: 24.3, yMin: 1.6, yMax: 11.5 },

    /* ---------- designer ---------- */
    designer: { nMin: 1e7, nMax: 1e12, dMin: 1e8, dMax: 2e12 }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CFG; else root.FRONTIER_CONFIG = CFG;
})(this);
