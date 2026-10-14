/* FRONTIER control room: the world. Real 2020 history appears ONLY in W.news, as dated fact.
   Every lab rival, investor, broker, cloud (Meridian) and researcher is fictional. */
(function (root) {
  var W = {};

  // [ISO date, headline, effect shown under it (the game rule tied to the date, or '')]
  W.news = [
    ['2020-01-23', 'OpenAI researchers publish "Scaling Laws for Neural Language Models": test loss falls as a smooth power law in model size, data and compute.', 'The line on your chart. Investors now count dots that land on it.'],
    ['2020-01-28', 'Google unveils Meena, a 2.6-billion-parameter chatbot.', ''],
    ['2020-02-10', 'Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.', ''],
    ['2020-03-11', 'The WHO declares COVID-19 a pandemic.', ''],
    ['2020-03-16', 'The Dow falls 12.9% in a day, its worst day since 1987, and six Bay Area counties order residents to shelter in place.', 'Venture market closed until 15 Jun. Term sheets in diligence are withdrawn. Hardware orders take 4 weeks longer until 30 Jun; hangs cost a day more without an infra person.'],
    ['2020-05-14', 'NVIDIA announces the A100 GPU and the DGX A100 at $199,000.', 'DGX A100 now on the market: 2.5x a V100 per card.'],
    ['2020-05-19', 'Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.', ''],
    ['2020-05-28', 'OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens, about 3.14e23 training FLOPs.', 'The frontier is now 3.14e23. Staying relevant needs a published result of 3.1e21 or more. Rental capacity halves; hardware lead times +4 weeks and prices +15%.'],
    ['2020-06-11', 'OpenAI opens its API to developers in private beta.', 'Shipping an API is now possible. Cloud rent rises to $3.50; capacity falls to 64; some renewals are refused. Meridian starts queueing.'],
    ['2020-06-30', 'Google researchers publish GShard, a 600-billion-parameter mixture-of-experts translation model.', 'COVID order delays and hang penalties end.'],
    ['2020-07-07', 'Google Cloud announces A2 virtual machines with NVIDIA A100 GPUs, in alpha.', ''],
    ['2020-09-22', 'Microsoft announces an exclusive license to GPT-3.', ''],
    ['2020-11-02', 'AWS launches EC2 P4d instances with eight A100 GPUs each.', ''],
    ['2020-11-30', 'DeepMind’s AlphaFold 2 tops the CASP14 protein-structure assessment.', '']
  ];
  // non-headline market notices (fictional brokers and investors), on their dates
  W.market = [
    ['2020-02-01', 'Broker capacity rises: up to 128 rented V100s.'],
    ['2020-03-01', 'Broker capacity rises: up to 256 rented V100s.'],
    ['2020-04-01', 'Cloud list price rises to $3.06 per V100-hour on renewals and new rentals.'],
    ['2020-06-15', 'The venture market reopens, at post-GPT-3 prices.'],
    ['2020-09-01', 'Autumn: broker capacity back to 128 V100s at $3.30.']
  ];

  // The cast. Every person is fictional. Salaries are fully loaded, per month.
  // role: data | systems | scaling | infra | evals | optim
  W.people = {
    priya: { name: 'Priya Raman', first: 'Priya', role: 'data', skill: 3, salary: 22000, ego: 3, she: true,
      pitch: 'Data. Crawl filtering and dedup.' },
    dev: { name: 'Dev Okafor', first: 'Dev', role: 'systems', skill: 3, salary: 30000, ego: 3, from: '2020-01-11',
      pitch: 'Your models stop at a billion parameters because they have to fit on one card. I can split them across cards.' },
    ayaan: { name: 'Ayaan Mehta', first: 'Ayaan', role: 'scaling', skill: 3, salary: 18000, salaryLate: 55000, lateFrom: '2020-05-28', ego: 4, from: '2020-01-21',
      pitch: 'I read a preprint. It keeps going. Let me prove it.' },
    tom: { name: 'Tomasz Wójcik', first: 'Tom', role: 'infra', skill: 3, salary: 24000, ego: 2, from: '2020-02-11',
      pitch: 'Your runs die at 3 AM and nobody notices till breakfast. I’ll fix that.' },
    lena: { name: 'Lena Hoffmann', first: 'Lena', role: 'evals', skill: 3, salary: 24000, ego: 2, she: true, from: '2020-03-11',
      pitch: 'Before anything leaves this building, I try to break it.' },
    rafael: { name: 'Rafael Costa', first: 'Rafael', role: 'systems', skill: 4, salary: 45000, ego: 4, from: '2020-03-11',
      pitch: 'Pipeline parallelism. I split a model across sixty-four cards. I cost more.' },
    sunhee: { name: 'Sun-hee Park', first: 'Sun-hee', role: 'optim', skill: 4, salary: 32000, ego: 4, she: true, from: '2020-04-11', needRep: 30,
      pitch: 'Your learning-rate schedule is wrong. Every run can land lower.' },
    ines: { name: 'Ines Duarte', first: 'Ines', role: 'data', skill: 4, salary: 26000, ego: 2, she: true, from: '2020-06-11',
      pitch: 'Dedup on a cluster instead of one machine. Filter jobs get much faster.' },
    kofi: { name: 'Kofi Mensah', first: 'Kofi', role: 'infra', skill: 4, salary: 26000, ego: 2, from: '2020-08-01',
      pitch: 'At a thousand cards something breaks every night. I write the thing that restarts it.' }
  };
  W.roles = { data: 'Data', systems: 'Systems', scaling: 'Scaling', infra: 'Infra', evals: 'Evals & red-team', optim: 'Optimization' };

  // what each role changes, written on the card (filled live with the person's numbers)
  W.effects = {
    data: 'Filter jobs: {days} days each, clean tokens x1.86. Reviews every landing for junk, which narrows the wall estimate.',
    systems: 'With the team, splits one model across up to {split} cards: memory limit {mem} parameters on V100s.',
    scaling: 'Measured horizon 100x your farthest clean dot (not 10x). Blind runs past it go wrong {blind}% of the time, not 30%.',
    infra: 'Hangs x{mult} as often, and each costs ~{lost} h instead of ~19 h.',
    evals: 'Catches leaked test sets at every landing. Red-teams a release in {rt} days: no scandal risk.',
    optim: '{state} every run lands 2.5% under the line (worth ~1.7x compute). Halves NaNs.'
  };

  W.decisions = {
    acqui: { from: 'HALCYON', title: 'Halcyon wants to buy the team',
      body: 'We’ll buy the team: $4M a head, {total} in all. Your people get rich. FRONTIER disappears.' },
    strategic: { from: 'HALCYON', title: 'Halcyon makes an offer for the company',
      body: 'Your {C} result got our attention. {price} for all of FRONTIER, cash. Your people keep their jobs, under us.' },
    boardNote: 'You own {stake}: below 50%, the board decides. It has accepted.',
    termA: { from: 'LEAD INVESTOR (FICTIONAL)', title: 'Series A term sheet', body: 'Two dots, one line. {cash} at a {post} post.' },
    termB: { from: 'GROWTH INVESTOR (FICTIONAL)', title: 'Series B term sheet', body: 'A dot past 3e22 after the API boom. {cash} at a {post} post.' },
    bridge: { from: 'ANGEL SYNDICATE (FICTIONAL)', title: 'Bridge note', body: '{cash} now for {pct} of the company. No dots required.' },
    meridian: { from: 'MERIDIAN CLOUD (FICTIONAL)', title: 'Meridian: $50M in compute credits',
      body: '{n} V100s reserved for you, ready in {weeks} weeks, paid from $50M of credits, never from your bank. Our cloud only. We see every checkpoint 7 days before anyone else, and we decide about open weights.' },
    meridian2: { from: 'MERIDIAN CLOUD (FICTIONAL)', title: 'Meridian, second offer', body: '{n} V100s, ready in {weeks} weeks, for 10% of FRONTIER. Same terms: our cloud only, first look.' },
    poach: { title: '{rival} is poaching {first}', body: '{rival} offered {first} double: {offer} a month. {He} has {mood} morale.' },
    court: { title: '{rival} is courting {first}', body: '{first} has been on your board for {days} days. {rival} made {him} an offer. Hire {him} now at {salary} a month, or {he} goes.' },
    demandPriya: { title: 'Priya wants first author', body: '“I want first author on our next paper, or I walk.”' },
    demandDev: { title: 'Dev wants equity', body: '“One percent, or Halcyon gets my parallelism code.”' },
    demandAyaan: { title: 'Ayaan wants the market rate', body: '“I called it. GPT-3 is exactly where I said. Pay me what the market pays: $55,000 a month.”' },
    demandTom: { title: 'Tom needs a week off', body: '“I’ve been up every night. I need a week off.”' },
    demandSunhee: { title: 'Sun-hee wants to publish the schedule trick', body: '“The schedule trick is mine. I want to publish it.”' },
    scandal: { title: 'Scandal: {what}', body: '{detail}' },
    open: { from: 'THE FIELD', title: 'Open the weights?', body: 'Grad students want the weights of your published {C} model.' },
    december: { from: 'PRIYA RAMAN', title: 'Priya is leaving to start something safer', body: '“{names} and I want to start something safer. We’re telling you first.”' },
    landing: { title: 'Run {id} landed' }
  };
  W.scandals = {
    leak: ['{cap} memorized: leaked test set', 'Reviewers found your {cap} test set inside your training crawl. The headline result was the model reciting answers.'],
    repro: ['reviewers: results don’t reproduce', 'An outside group could not reproduce your paper’s headline number.'],
    ship: ['screenshot: the API says something vile', 'A developer posted a screenshot of your API saying something vile. It went everywhere.']
  };

  W.ends = {
    bankrupt: 'BANKRUPT', acquired: 'ACQUIRED', forgotten: 'FORGOTTEN', survived: 'SURVIVED'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.FRONTIER_WORLD = W;
})(this);
