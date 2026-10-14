/* FRONTIER: the lab's people, their words, the letters' copy, and the year's history (spec/sim1.json).
   Every researcher, investor, broker and rival lab is fictional. Real companies, products and people appear only
   in the fourteen dated factual headlines below, and never speak. */
(function (root) {
  var LAB = {
    // the slice-one roster. ego 2/3/4 sets how big they write; salary is fully loaded, per month
    people: {
      priya: { name: 'Priya Raman', short: 'Priya', sur: 'Raman', role: 'data', she: 'she', hand: { skew: 0, size: 1, track: 0 }, salary: 22000, ego: 3, start: true,
        sulk: 'reading, alone', status: 'reading samples' },
      dev: { name: 'Dev Okafor', short: 'Dev', sur: 'Okafor', role: 'systems', she: 'he', hand: { skew: -6, size: 1, track: 0.01 }, salary: 30000, ego: 3,
        pitch: 'Your models stop at a billion parameters because they have to fit on one card. I can split them across cards.', sulk: 'parallelism holds. for now', status: 'parallelism holds' },
      ayaan: { name: 'Ayaan Mehta', short: 'Ayaan', sur: 'Mehta', role: 'believer', she: 'he', hand: { skew: -12, size: 1.08, track: 0.02 }, salary: 18000, salaryLate: 55000, ego: 4,
        pitch: 'I read a preprint. It keeps going. Let me prove it.', sulk: 'nobody reads the preprint', status: 'it keeps going' },
      tom: { name: 'Tomasz Wójcik', short: 'Tom', sur: 'Wójcik', role: 'infra', she: 'he', hand: { skew: -3, size: 0.92, track: -0.02 }, salary: 24000, ego: 2,
        pitch: 'Your runs die at 3 AM and nobody notices till breakfast. I’ll fix that.', sulk: 'tired', status: 'watching the cluster' },
      lena: { name: 'Lena Hoffmann', short: 'Lena', sur: 'Hoffmann', role: 'evals', she: 'she', hand: { skew: 3, size: 0.94, track: 0.04 }, salary: 24000, ego: 2,
        pitch: 'Before anything leaves this building, I try to break it.', sulk: 'evals, I guess', status: 'evals' },
      sunhee: { name: 'Sun-hee Park', short: 'Sun-hee', sur: 'Park', role: 'optimization', she: 'she', hand: { skew: -8, size: 1.06, track: 0 }, salary: 32000, ego: 4,
        pitch: 'I read your paper. Your schedule is wrong. Every run can land lower.', sulk: 'the schedule is wasted here', status: 'schedule’s in' },
      rafael: { name: 'Rafael Costa', short: 'Rafael', sur: 'Costa', role: 'systems', she: 'he', hand: { skew: -4, size: 1.03, track: 0.07 }, salary: 45000, ego: 4,
        pitch: 'Heard you lost your parallelism person. I cost more.', sulk: 'pipelines, I suppose', status: 'pipelines' },
      ines: { name: 'Ines Duarte', short: 'Ines', sur: 'Duarte', role: 'data', she: 'she', hand: { skew: 1, size: 0.9, track: 0.01 }, salary: 26000, ego: 2,
        pitch: 'Priya’s dedup runs on one machine. Give me a cluster and it takes twelve days.', sulk: 'dedup queue. still', status: 'dedup queue' },
      kofi: { name: 'Kofi Mensah', short: 'Kofi', sur: 'Mensah', role: 'infra', she: 'he', hand: { skew: -5, size: 0.98, track: 0 }, salary: 26000, ego: 2,
        pitch: 'At a thousand cards something breaks every night. I write the thing that restarts it.', sulk: 'restarts, mostly', status: 'restarts armed' }
    },
    roleLine: { data: 'data', systems: 'systems', believer: 'believer', infra: 'infra', evals: 'evals', optimization: 'optimization' },

    // the only text people ever write on the paper
    notes: {
      fray: 'SEO spam. Give me three weeks.',
      fray3: 'junk in the middle. three weeks?',
      frayLow: 'reads fine to me',
      memStop: 'won’t fit on one card',
      horizonStop: 'we haven’t measured past here',
      yearStop: '31 DEC',
      split: 'split across 8',
      keepsGoing: 'it keeps going',
      toldYou: 'told you',
      myFault: 'my fault',
      leak: 'leaked. the test set is in our crawl.',
      hintPublish: 'flick it up and the world reads it',
      hintShip: 'or → and we sell it',
      evals: 'evals: results on the 3rd',
      queue: 'queue',
      redTeamDone: 'red-team clean. flick it.',
      filterBox: 'filter: {d} days',
      redTeamBox: 'red-team: {d} days',
      meridianBox: 'with Meridian'
    },

    // fictional rivals: you only see their compute when they publish
    rivalOrder: ['halcyon', 'kestrel', 'northwind'],

    // the real world, as fact (spec timeline): [day, dated headline, the pencil phrase it leaves on the ruler]
    news: [
      [22, '23 JAN 2020 · OpenAI researchers publish ‘Scaling Laws for Neural Language Models’: test loss falls as a smooth power law in model size, data and compute.', 'the line'],
      [27, '28 JAN 2020 · Google unveils Meena, a 2.6-billion-parameter chatbot.', 'Meena'],
      [40, '10 FEB 2020 · Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.', 'Turing-NLG'],
      [70, '11 MAR 2020 · The WHO declares COVID-19 a pandemic.', 'pandemic'],
      [75, '16 MAR 2020 · The Dow falls 12.9% in a day, its worst day since 1987, and six Bay Area counties order residents to shelter in place.', 'offices close'],
      [134, '14 MAY 2020 · NVIDIA announces the A100 GPU and the DGX A100 at $199,000.', 'A100'],
      [139, '19 MAY 2020 · Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.', '10,000 GPUs'],
      [148, '28 MAY 2020 · OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens.', 'GPT-3'],
      [162, '11 JUN 2020 · OpenAI opens its API to developers in private beta.', 'API'],
      [181, '30 JUN 2020 · Google researchers publish GShard, a 600-billion-parameter mixture-of-experts translation model.', 'GShard'],
      [188, '7 JUL 2020 · Google Cloud announces A2 virtual machines with NVIDIA A100 GPUs, in alpha.', 'A2 alpha'],
      [265, '22 SEP 2020 · Microsoft announces an exclusive license to GPT-3.', 'exclusive'],
      [306, '2 NOV 2020 · AWS launches EC2 P4d instances with eight A100 GPUs each.', 'P4d'],
      [334, '30 NOV 2020 · DeepMind’s AlphaFold 2 tops the CASP14 protein-structure assessment.', 'AlphaFold']
    ],
    gpt3Day: 148
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = LAB; else root.FRONTIER_LAB = LAB;
})(this);
