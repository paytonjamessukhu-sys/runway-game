/* FRONTIER world: real 2020 headlines (plain fact, on their dates), the fictional cast and every line they say.
   Real companies, products and people appear ONLY in W.news. Every lab, investor, broker and researcher is fictional. */
(function (root) {
  var W = {};

  // [ISO date, headline, effect id, what it changes in the game (shown under the headline)]
  W.news = [
    ['2020-01-23', 'OpenAI researchers publish "Scaling Laws for Neural Language Models": test loss falls as a smooth power law in model size, data and compute.', 'line', 'The line on your chart is now a published law. Projections tighten. Series A dots count from today.'],
    ['2020-01-28', 'Google unveils Meena, a 2.6-billion-parameter chatbot.', '', ''],
    ['2020-02-10', 'Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.', '', ''],
    ['2020-03-11', 'The WHO declares COVID-19 a pandemic.', '', ''],
    ['2020-03-16', 'The Dow falls 12.9% in a day, its worst day since 1987, and six Bay Area counties order residents to shelter in place.', 'crash', 'The fundraising market is closed until 15 June. Hardware orders take 4 weeks longer and hangs cost an extra day until 30 June.'],
    ['2020-05-14', 'NVIDIA announces the A100 GPU and the DGX A100 at $199,000.', 'a100', 'DGX A100s are on the market: 2.5x a V100 each. Your V100 racks just became the slow ones.'],
    ['2020-05-19', 'Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.', '', ''],
    ['2020-05-28', 'OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens, about 3.14e23 training FLOPs.', 'gpt3', 'The frontier is now 3.14e23. To stay relevant you must publish or ship at least 3.1e21.'],
    ['2020-06-11', 'OpenAI opens its API to developers in private beta.', 'api', 'You can now ship a model as an API. Cloud capacity dries up: $3.50 an hour, 64 cards a month. Hardware costs 20% more and arrives 8 weeks later.'],
    ['2020-06-30', 'Google researchers publish GShard, a 600-billion-parameter mixture-of-experts translation model.', '', 'COVID hang and lead-time penalties end today.'],
    ['2020-07-07', 'Google Cloud announces A2 virtual machines with NVIDIA A100 GPUs, in alpha.', '', ''],
    ['2020-09-22', 'Microsoft announces an exclusive license to GPT-3.', '', ''],
    ['2020-11-02', 'AWS launches EC2 P4d instances with eight A100 GPUs each.', '', ''],
    ['2020-11-30', 'DeepMind’s AlphaFold 2 tops the CASP14 protein-structure assessment.', '', '']
  ];

  // The cast. Every person is fictional. Salaries are fully loaded, per month.
  // day: when they knock. effect: what they change, written on their card.
  W.people = {
    priya: { name: 'Priya Raman', first: 'Priya', role: 'data', skill: 4, salary: 22000, ego: 3, day: 0,
      effect: 'Cleans the crawl so the data wall moves out (about 10x in compute each time). Flags junk in what the model says.',
      status: 'reading samples', pitch: '' },
    dev: { name: 'Dev Okafor', first: 'Dev', role: 'systems', skill: 4, salary: 30000, ego: 3, day: 10,
      effect: 'Splits models across cards: the biggest model that fits goes from 2B to 20B parameters (400B with a second systems person).',
      status: 'parallelism holds',
      pitch: 'Your models stop at two billion parameters because they have to fit on one card. I can split them across cards.' },
    ayaan: { name: 'Ayaan Mehta', first: 'Ayaan', role: 'scaling', skill: 3, salary: 18000, salaryLate: 55000, ego: 4, day: 20,
      effect: 'Fits the scaling curve: runs far past your biggest dot land where projected (risk x0.25).',
      status: 'it keeps going',
      pitch: 'I read a preprint. It keeps going. Let me prove it.' },
    tom: { name: 'Tomasz Wójcik', first: 'Tom', role: 'infra', skill: 3, salary: 24000, ego: 2, day: 41,
      effect: 'Hangs are 60% rarer and restart within an hour instead of waiting for breakfast.',
      status: 'watching the cluster',
      pitch: 'Your runs die at 3 AM and nobody notices till breakfast. I’ll fix that.' },
    rafael: { name: 'Rafael Costa', first: 'Rafael', role: 'systems', skill: 5, salary: 45000, ego: 4, day: 60,
      effect: 'Pipeline parallelism: with Dev, models up to 400B parameters. Alone, up to 20B.',
      status: 'pipelines',
      pitch: 'Dev splits a model across eight cards. I split it across eight hundred. I cost more.' },
    lena: { name: 'Lena Hoffmann', first: 'Lena', role: 'evals', skill: 4, salary: 24000, ego: 2, day: 70,
      effect: 'Safety-tests a model before it leaves (14 days, 7 with an API live): no scandal. Catches leaked test sets.',
      status: 'evals',
      pitch: 'Before anything leaves this building, I try to break it.' },
    sunhee: { name: 'Sun-hee Park', first: 'Sun-hee', role: 'optimization', skill: 5, salary: 32000, ego: 4, day: 101,
      effect: '30 days after joining, every run lands 2.5% under the line (worth about 1.66x compute).',
      status: 'schedule’s in',
      pitch: 'I read your paper. Your schedule is wrong. Every run can land lower.' },
    ines: { name: 'Ines Duarte', first: 'Ines', role: 'data', skill: 4, salary: 26000, ego: 2, day: 162,
      effect: 'With Priya, cleaning the crawl takes 17 days instead of 30. Does it alone if Priya leaves.',
      status: 'dedup queue',
      pitch: 'Priya’s dedup runs on one machine. Give me a cluster and it takes twelve days.' },
    kofi: { name: 'Kofi Mensah', first: 'Kofi', role: 'infra', skill: 4, salary: 26000, ego: 2, day: 213,
      effect: 'Like Tom: hangs 60% rarer. With Tom, 80% rarer.',
      status: 'restarts armed',
      pitch: 'At a thousand cards something breaks every night. I write the thing that restarts it.' }
  };
  W.order = ['priya', 'dev', 'ayaan', 'tom', 'rafael', 'lena', 'sunhee', 'ines', 'kofi'];

  W.fictional = {
    broker: 'CINDER COMPUTE EXCHANGE',
    seriesA: 'LARKFIELD VENTURES',
    seriesB: 'ORRERY CAPITAL',
    meridian: 'MERIDIAN CLOUD',
    halcyon: 'HALCYON',
    field: 'THE FIELD'
  };

  // Lines people say in the feed and on their cards.
  W.say = {
    opening: 'Morning. {cash}, one box of eight cards, and me. We have until 31 December to get as close to GPT-3 as we can before the money runs out. First, put all eight cards on a three-week run: it tells us where we stand.',
    firstLand: 'It talks. Badly. That dot sits on the line: ten times the compute buys about 11% lower error. A paper this small buys a little attention, not much. Next we need cards: the broker has some.',
    firstLandMore: 'Every dot lands near that line. The question is how far right we can get before the money runs out.',
    rentNudge: 'Eight cards, {days} days for a billion parameters. With the broker’s 64 it’s a morning.',
    memWall: 'Past two billion parameters it won’t fit on one card. Dev knocks on the 11th.',
    seriesAHint: 'Larkfield wants two clean dots on the line, a decade apart, the far one at 1e22. Before the 16th of March, if we can.',
    payday: 'First payday. {pay} out, rent comes on top. {runway} before we are broke. Every card we rent shortens that.',
    fray3: 'junk in the middle of the sentences. Cleaning the crawl would push the data wall out.',
    fray: 'SEO spam. Give me a month.',
    crawl: 'That’s not our model talking, that’s the crawl. We’re past the clean data. Clean the crawl, or go smaller.',
    pastWallLand: 'It ate crawl. The error score looks fine and the words are cookie banners. That run proves nothing.',
    filterDone: 'Crawl’s clean. The data wall moved out: about ten times the compute before the words go bad again.',
    devSplit: 'split across 8.',
    ayaanGoing: 'it keeps going.',
    toldYou: 'told you.',
    tomHang: 'my fault. restarting.',
    hangNoInfra: 'It hung at {hour}. Nobody is watching the cluster. It sits dark until someone wakes up.',
    woken: 'up. restarting it.',
    leak: 'leaked. the test set for {cap} is in our crawl.',
    lenaDone: 'Done breaking it. It’s safe to show.',
    sunheeTold: 'told you. 2.5% under the line.',
    capMoment: 'It can {what} now.',
    gpt3: 'GPT-3 is out: 3.14e23. We were right about the line. They just had more of everything.',
    meridianLive: 'Meridian’s cards are live. 1,024 V100s. Don’t waste them.',
    rentalEnd: 'The broker took {n} V100s back today.',
    bankZero: 'The bank hit zero. The broker took every rented card back.',
    orderIn: '{n} {type}s arrived and are racked.',
    lowRunway: 'Under {m} months until broke. People are checking their savings.',
    queue: 'Meridian’s queue: we’re behind, so we get {n} of {of} cards this month.',
    queueFull: 'Meridian’s queue: all {n} cards are ours this month.'
  };

  W.caps = {
    paragraph: { what: 'write a paragraph that holds together', label: 'paragraphs' },
    arithmetic: { what: 'add two-digit numbers, correctly', label: 'arithmetic' },
    translation: { what: 'translate English to French', label: 'translation' },
    code: { what: 'write a working one-line function', label: 'code' }
  };

  W.scandal = {
    arithmetic: 'Reviewers found the arithmetic test set in our training crawl: the scores were memorised.',
    translation: 'Reviewers found the translation test set in our training crawl: the scores were memorised.',
    code: 'Reviewers found the code test set in our training crawl: the scores were memorised.',
    generic: 'Reviewers can’t reproduce the paper’s numbers. Threads are not kind.',
    ship: 'A screenshot of the API saying something vile is everywhere.'
  };

  W.ends = {
    head: { bankrupt: 'BANKRUPT', acquired: 'ACQUIRED', forgotten: 'FORGOTTEN', survived: 'SURVIVED' },
    bankrupt: 'Payroll on {date} needed {pay} and the bank had {bank}. The lab was spending {burn} a month{rent}.',
    bankruptRent: ', {rent} of it on rented cards',
    acquired: 'You sold the team to Halcyon for {price} with {runway} until broke. Your people are rich; FRONTIER is gone.',
    acquiredBoard: 'You were down to {stake}, under half, and the board sold the team to Halcyon for {price} on {date}. FRONTIER is gone.',
    forgotten: 'Nothing you published or shipped since {since} reached 1% of the frontier ({need}). On {date} the world stopped reading FRONTIER.',
    forgottenNone: 'By {date} you had published or shipped nothing that reached 1% of the frontier ({need}). The world never started reading FRONTIER.',
    survived: 'FRONTIER is still standing at New Year with {cash} in the bank and {people}.'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.FRONTIER_WORLD = W;
})(this);
