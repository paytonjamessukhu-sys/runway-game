/* FRONTIER world: the fourteen dated factual headlines, the nine fictional researchers, the fictional labs,
   and every letter and note string, as written in spec/sim1.json.
   Real companies, products and people appear ONLY in the dated headlines below, as plain fact.
   Meridian, Halcyon, Kestrel, Northwind, every investor and broker, and all nine researchers are fictional. */
(function (root) {
  var W = {};

  // [ISO date, headline, pencil phrase on the ruler, effect id]
  W.news = [
    ['2020-01-23', 'OpenAI researchers publish ‘Scaling Laws for Neural Language Models’: test loss falls as a smooth power law in model size, data and compute.', 'the line', 'line'],
    ['2020-01-28', 'Google unveils Meena, a 2.6-billion-parameter chatbot.', 'Meena', ''],
    ['2020-02-10', 'Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.', 'Turing-NLG', ''],
    ['2020-03-11', 'The WHO declares COVID-19 a pandemic.', 'pandemic', ''],
    ['2020-03-16', 'The Dow falls 12.9% in a day, its worst day since 1987, and six Bay Area counties order residents to shelter in place.', 'offices close', 'crash'],
    ['2020-05-14', 'NVIDIA announces the A100 GPU and the DGX A100 at $199,000.', 'A100', 'a100'],
    ['2020-05-19', 'Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.', '10,000 GPUs', ''],
    ['2020-05-28', 'OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens.', 'GPT-3', 'gpt3'],
    ['2020-06-11', 'OpenAI opens its API to developers in private beta.', 'API', 'api'],
    ['2020-06-30', 'Google researchers publish GShard, a 600-billion-parameter mixture-of-experts translation model.', 'GShard', ''],
    ['2020-07-07', 'Google Cloud announces A2 virtual machines with NVIDIA A100 GPUs, in alpha.', 'A2 alpha', ''],
    ['2020-09-22', 'Microsoft announces an exclusive license to GPT-3.', 'exclusive', ''],
    ['2020-11-02', 'AWS launches EC2 P4d instances with eight A100 GPUs each.', 'P4d', ''],
    ['2020-11-30', 'DeepMind’s AlphaFold 2 tops the CASP14 protein-structure assessment.', 'AlphaFold', '']
  ];

  // The slice-one roster. Every person is fictional. Salaries are fully loaded, per month.
  W.people = {
    priya: { name: 'Priya Raman', first: 'Priya', short: 'Raman', role: 'data', salary: 22000, ego: 3, status: ['reading samples'] },
    dev: { name: 'Dev Okafor', first: 'Dev', short: 'Okafor', role: 'systems', salary: 30000, ego: 3, status: ['parallelism holds'],
      pitch: 'Your models stop at a billion parameters because they have to fit on one card. I can split them across cards.' },
    ayaan: { name: 'Ayaan Mehta', first: 'Ayaan', short: 'Mehta', role: 'believer', salary: 18000, salaryLate: 55000, ego: 4, status: ['it keeps going'],
      pitch: 'I read a preprint. It keeps going. Let me prove it.' },
    tom: { name: 'Tomasz Wójcik', first: 'Tom', short: 'Wójcik', role: 'infra', salary: 24000, ego: 2, status: ['watching the cluster'],
      pitch: 'Your runs die at 3 AM and nobody notices till breakfast. I’ll fix that.' },
    lena: { name: 'Lena Hoffmann', first: 'Lena', short: 'Hoffmann', role: 'evals', salary: 24000, ego: 2, status: ['evals'],
      pitch: 'Before anything leaves this building, I try to break it.' },
    sunhee: { name: 'Sun-hee Park', first: 'Sun-hee', short: 'Park', role: 'optimization', salary: 32000, ego: 4, status: ['schedule’s in'],
      pitch: 'I read your paper. Your schedule is wrong. Every run can land lower.' },
    rafael: { name: 'Rafael Costa', first: 'Rafael', short: 'Costa', role: 'systems', salary: 45000, ego: 4, status: ['pipelines'],
      pitch: 'Heard you lost your parallelism person. I cost more.' },
    ines: { name: 'Ines Duarte', first: 'Ines', short: 'Duarte', role: 'data', salary: 26000, ego: 2, status: ['dedup queue'],
      pitch: 'Priya’s dedup runs on one machine. Give me a cluster and it takes twelve days.' },
    kofi: { name: 'Kofi Mensah', first: 'Kofi', short: 'Mensah', role: 'infra', salary: 26000, ego: 2, status: ['restarts armed'],
      pitch: 'At a thousand cards something breaks every night. I write the thing that restarts it.' }
  };

  // Letters. {x} fields are filled live by the game.
  W.letters = {
    rent: { from: 'BROKER', body: '{n} V100s on demand, live tomorrow. ${price} an hour for 90 days.', pass: 'gone by the {gone}' },
    rentGrey: 'Meridian: exclusive',
    buyV: { from: 'BROKER', body: '64 V100s to own: eight servers with InfiniBand. {price}. Delivery in {weeks} weeks.', pass: 'gone' },
    buyA: { from: 'BROKER', body: 'Eight DGX A100s: 64 A100s. {price}. Delivery in {weeks} weeks.', pass: 'gone' },
    renew: { from: 'BROKER', body: 'Your {n} V100s go back on {date}. Renew for 90 days at ${price}?', take: 'keep them', pass: 'they go back on {date}' },
    renewNo: { from: 'BROKER', body: 'Capacity unavailable. Your {n} V100s go back on {date}.', grey: 'Capacity unavailable.', pass: 'they go back on {date}' },
    rentOut: { from: 'BROKER', body: 'We’ll pay $1.90 an hour for half your owned cards. 30 days. Cash now.', pass: 'no cash' },
    hirePass: { kestrel: 'goes to Kestrel', halcyon: 'goes to Halcyon' },
    acqui: { from: 'HALCYON', body: 'We’ll buy the team: $4M a head, {total} in all. Your people get rich. FRONTIER disappears.', take: 'it’s over, and everyone is rich', pass: 'keep going', forced: 'The board has accepted.' },
    termA: { from: 'LEAD INVESTOR', body: 'Series A: {cash} at a {post} post. Two dots, one line. Sign by the 25th.', pass: 'gone; next time they want a dot three times further out' },
    termB: { from: 'LEAD INVESTOR', body: 'Series B: {cash} at a {post} post.', pass: 'gone' },
    meridian: { from: 'MERIDIAN CLOUD', body: '$50M in compute credits: 1,024 V100s reserved for you, ready in six weeks. Our cloud only. We see every checkpoint first.', take: 'CARDS +1,024 in pencil · no other cloud · no open weights', pass: 'we’ll talk again in June' },
    meridian2: { from: 'MERIDIAN CLOUD', body: '512 V100s, ready in six weeks, for 10% of FRONTIER.', pass: 'gone' },
    poach: { body: '{rival} offers {first} double. Counter with equity?', pass: '{he} walks to {rival}' },
    open: { from: 'THE FIELD', body: 'Grad students want the weights of your published model.', take: 'recruits come running · rivals fine-tune it within a week', pass: 'they build on Northwind’s instead', greyMer: 'Meridian: no.', greyBoard: 'The board: no.' },
    priyaDemand: { body: 'I want first author on our next paper, or I walk.', take: 'your next clean landing is published with her name on it', pass: 'she walks' },
    devDemand: { body: 'One percent, or Halcyon gets my parallelism code.', take: 'STAKE −1 point', pass: 'he walks' },
    ayaanDemand: { body: 'Whole cluster on one run, all the way to the stop.', take: 'your next touch snaps the nib to the stop', pass: 'mood −40' },
    tomDemand: { body: 'I need a week off. I’ve been up every night.', take: '7 days without his effect', pass: 'mood −30' },
    sunheeDemand: { body: 'I want to publish the schedule trick.', take: 'she stays, and every rival lands 2.5% lower in 30 days', pass: 'she walks to Halcyon' },
    december: { body: '{a}, {b} and I want to start something safer. We’re telling you first.', take: 'let them go, with your blessing', pass: 'fight to keep them' }
  };

  // What your people write on the paper. No other text ever appears on it.
  W.notes = {
    fray: 'SEO spam. Give me three weeks.',
    fray3: 'junk in the middle. three weeks?',
    fray12: 'reads fine to me',
    memStop: 'won’t fit on one card',
    horizonStop: 'we haven’t measured past here',
    devSplit: 'split across 8',
    ayaanGoing: 'it keeps going',
    toldYou: 'told you',
    tomHang: 'my fault',
    leak: 'leaked. the test set is in our crawl.',
    hintPublish: 'flick it up and the world reads it',
    hintShip: 'or → and we sell it',
    evals: 'evals: results on the 3rd',
    scandalPublish: 'arithmetic memorized: leaked test set',
    scandalShip: 'screenshot: says something vile',
    queue: 'queue',
    withMeridian: 'with Meridian'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.FRONTIER_WORLD = W;
})(this);
