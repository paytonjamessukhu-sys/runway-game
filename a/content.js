/* FRONTIER content (spec/sim1.json): people, letters' fixed copy, notes and history.
   Every researcher, rival lab, investor, broker and cloud is fictional. Real companies and people appear only as dated, factual headlines. */
(function (root) {
  var K = {
    people: [
      { id: 'priya', name: 'Priya', full: 'Priya Raman', surname: 'Raman', role: 'data', salary: 22000, ego: 3, start: true },
      { id: 'dev', name: 'Dev', full: 'Dev Okafor', surname: 'Okafor', role: 'systems', salary: 30000, ego: 3, he: true,
        knock: 'Your models stop at a billion parameters because they have to fit on one card. I can split them across cards.' },
      { id: 'ayaan', name: 'Ayaan', full: 'Ayaan Mehta', surname: 'Mehta', role: 'believer', salary: 18000, salaryLate: 55000, ego: 4, he: true,
        knock: 'I read a preprint. It keeps going. Let me prove it.' },
      { id: 'tom', name: 'Tom', full: 'Tomasz Wójcik', surname: 'Wójcik', role: 'infra', salary: 24000, ego: 2, he: true,
        knock: 'Your runs die at 3 AM and nobody notices till breakfast. I’ll fix that.' },
      { id: 'lena', name: 'Lena', full: 'Lena Hoffmann', surname: 'Hoffmann', role: 'evals', salary: 24000, ego: 2,
        knock: 'Before anything leaves this building, I try to break it.' },
      { id: 'sunhee', name: 'Sun-hee', full: 'Sun-hee Park', surname: 'Park', role: 'optim', salary: 32000, ego: 4,
        knock: 'I read your paper. Your schedule is wrong. Every run can land lower.' },
      { id: 'rafael', name: 'Rafael', full: 'Rafael Costa', surname: 'Costa', role: 'systems', salary: 45000, ego: 4, he: true,
        knock: 'Heard you lost your parallelism person. I cost more.' },
      { id: 'ines', name: 'Ines', full: 'Ines Duarte', surname: 'Duarte', role: 'data', salary: 26000, ego: 2,
        knock: 'Priya’s dedup runs on one machine. Give me a cluster and it takes twelve days.' },
      { id: 'kofi', name: 'Kofi', full: 'Kofi Mensah', surname: 'Mensah', role: 'infra', salary: 26000, ego: 2, he: true,
        knock: 'At a thousand cards something breaks every night. I write the thing that restarts it.' }
    ],
    status: {
      priya: 'reading samples', dev: 'parallelism holds', ayaan: 'it keeps going', tom: 'watching the cluster', lena: 'evals',
      sunhee: 'schedule’s in', rafael: 'pipelines', ines: 'dedup queue', kofi: 'restarts armed'
    },
    notes: {
      frayLoud: 'SEO spam. Give me three weeks.',
      fray3: 'junk in the middle. three weeks?',
      fray12: 'reads fine to me',
      memStop: 'won’t fit on one card',
      horizonStop: 'we haven’t measured past here',
      yearStop: '31 DEC',
      split: 'split across 8',
      keepsGoing: 'it keeps going',
      toldYou: 'told you',
      myFault: 'my fault',
      leak: 'leaked. the test set is in our crawl.',
      flickUp: 'flick it up and the world reads it',
      flickRight: 'or → and we sell it',
      evals: 'evals: results on the 3rd',
      scandalPub: 'arithmetic memorized: leaked test set',
      scandalShip: 'screenshot: says something vile'
    },
    cloud: 'MERIDIAN CLOUD',
    investorA: 'LEAD INVESTOR',
    // [day, ruler phrase, headline]. Day 0 = 1 Jan 2020. All factual (spec timeline).
    news: [
      [22, 'the line', '23 JAN 2020 · OpenAI researchers publish ‘Scaling Laws for Neural Language Models’: test loss falls as a smooth power law in model size, data and compute.'],
      [27, 'Meena', '28 JAN 2020 · Google unveils Meena, a 2.6-billion-parameter chatbot.'],
      [40, 'Turing-NLG', '10 FEB 2020 · Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.'],
      [70, 'pandemic', '11 MAR 2020 · The WHO declares COVID-19 a pandemic.'],
      [75, 'offices close', '16 MAR 2020 · The Dow falls 12.9% in a day, its worst day since 1987, and six Bay Area counties order residents to shelter in place.'],
      [134, 'A100', '14 MAY 2020 · NVIDIA announces the A100 GPU and the DGX A100 at $199,000.'],
      [139, '10,000 GPUs', '19 MAY 2020 · Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.'],
      [148, 'GPT-3', '28 MAY 2020 · OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens.'],
      [162, 'API', '11 JUN 2020 · OpenAI opens its API to developers in private beta.'],
      [181, 'GShard', '30 JUN 2020 · Google researchers publish GShard, a 600-billion-parameter mixture-of-experts translation model.'],
      [188, 'A2 alpha', '7 JUL 2020 · Google Cloud announces A2 virtual machines with NVIDIA A100 GPUs, in alpha.'],
      [265, 'exclusive', '22 SEP 2020 · Microsoft announces an exclusive license to GPT-3.'],
      [306, 'P4d', '2 NOV 2020 · AWS launches EC2 P4d instances with eight A100 GPUs each.'],
      [334, 'AlphaFold', '30 NOV 2020 · DeepMind’s AlphaFold 2 tops the CASP14 protein-structure assessment.']
    ],
    gpt3Day: 148, apiDay: 162
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = K; else root.FRONTIER_CONTENT = K;
})(this);
