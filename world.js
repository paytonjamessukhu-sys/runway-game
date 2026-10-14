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
    spot: { from: 'SECOND-HAND BROKER', body: 'Somebody’s cancelled reservation: {n} V100s for {days} days, live tomorrow. ${price} an hour.', pass: 'gone by the {gone}' },
    buyV: { from: 'BROKER', body: '64 V100s to own: eight servers with InfiniBand. {price}. Delivery in {weeks} weeks.', pass: 'gone' },
    buyA: { from: 'BROKER', body: 'Eight DGX A100s: 64 A100s. {price}. Delivery in {weeks} weeks.', pass: 'gone' },
    renew: { from: 'BROKER', body: 'Your {n} V100s go back on {date}. Renew for 90 days at ${price}?', take: 'keep them to {to}', pass: 'they go back on {date}' },
    renewNo: { from: 'BROKER', body: 'Capacity unavailable. Your {n} V100s go back on {date}.', grey: 'Capacity unavailable.', pass: 'they go back on {date}' },
    rentOut: { from: 'BROKER', body: 'We’ll pay $1.90 an hour for half your owned cards. 30 days. Cash now.', pass: 'no cash' },
    hirePass: { kestrel: 'goes to Kestrel', halcyon: 'goes to Halcyon' },
    acqui: { from: 'HALCYON', body: 'We’ll buy the team: $4M a head, {total} in all. Your people get rich. FRONTIER disappears.', take: 'it’s over, and everyone is rich', pass: 'keep going', forced: 'The board has accepted.' },
    termA: { from: 'LEAD INVESTOR', body: 'Series A: {cash} at a {post} post. Two dots, one line. Sign by the {by}.', pass: 'gone; next time they want a dot three times further out' },
    termB: { from: 'LEAD INVESTOR', body: 'Series B: {cash} at a {post} post. Sign by the {by}.', pass: 'gone' },
    meridian: { from: 'MERIDIAN CLOUD', body: '$50M in compute credits: {n} V100s reserved for you, ready in {weeks} weeks. Our cloud only. We see every checkpoint first.', take: 'CARDS +{n} in pencil, live {live} · no other cloud · no open weights', pass: 'we’ll talk again after 15 June' },
    meridian2: { from: 'MERIDIAN CLOUD', body: '{n} V100s, ready in {weeks} weeks, for 10% of FRONTIER.', pass: 'gone' },
    priority: { from: 'MERIDIAN CLOUD', body: 'Our queue puts labs that are behind at the back. Stay at the front for the rest of the year: {price} a month, from your bank.', take: 'all {n} cards every month', pass: 'the queue decides on each 1st' },
    poach: { body: '{rival} offers {first} double. Counter with equity?', bodyRaise: '{rival} offers {first} double. Counter with equity and a raise?', pass: '{he} walks to {rival}' },
    open: { from: 'THE FIELD', body: 'Grad students want the weights of your published model.', take: 'recruits come running · rivals fine-tune it within a week', pass: 'they build on Northwind’s instead', greyMer: 'Meridian: no.', greyBoard: 'The board: no.' },
    priyaDemand: { body: 'I want first author on our next paper, or I walk.', take: 'your next clean landing is published at once, with her name on it', pass: 'she walks' },
    devDemand: { body: 'One percent, or Halcyon gets my parallelism code.', take: 'STAKE −1 point', pass: 'he walks' },
    ayaanDemand: { body: 'Whole cluster on one run, all the way to the stop.', take: 'next run goes to the stop: {days} days, lands {land} · MONTHS {m0} → {m1}', pass: 'his name thins' },
    tomDemand: { body: 'I need a week off. I’ve been up every night.', take: '7 days without his restarts', pass: 'his name thins' },
    sunheeDemand: { body: 'I want to publish the schedule trick.', take: 'she stays, and every rival lands 2.5% lower in 30 days', pass: 'she walks to Halcyon' },
    december: { body: '{a}, {b} and I want to start something safer. We’re telling you first.', take: 'let them go, with your blessing', pass: 'fight to keep them' }
  };
  W.rafaelNoDev = 'Heard you need someone who can split a model across cards. I cost more.';

  // First-time lessons, written once per sitting, in pencil, the first time each verb matters. No screens, no cards.
  W.teach = {
    asleep: 'touch the paper to begin',
    months: 'MONTHS: how long the money lasts',
    cards: 'CARDS: our GPUs',
    goal: 'reach 31 DEC without going broke, being bought or being forgotten',
    flick: 'flick up to take · down to let it pass',
    tapLetter: 'flick it: up takes, down lets it pass',
    drag: 'drag me → then let go to train',
    tap: 'tap the paper to read what it says',
    ring: 'reach this: the biggest run of 2020',
    seriesA: 'Series A: a dot here, one 10× back',
    wake: 'press a name to wake them',
    abort: 'drag me home to stop it',
    vault: 'leave it, and it stays in the vault',
    redteam: 'press my name: I’ll red-team it · {days} days',
    filterCost: '→ press my name: {cost}',
    filterCostInes: '→ press my name: {days} days, {cost}'
  };

  // What the sheet says when something decides your year. Plain sentences, in pencil.
  W.warn = {
    silent: 'Nobody wrote this month. If nobody is reading us by {next}, we’re forgotten. {fix}',
    silentFixPub: 'A published dot past {need} would do it.',
    silentFixScandal: 'The scandal is why.',
    gpt3Bar: 'After this, nobody reads a lab with less than {need} published.',
    scandal: 'Scandal: {what}. No letters next month, and no term sheets for 90 days.',
    queueSoon: 'Meridian’s queue on the 1st: we’re behind, so we lose {n} cards',
    queueCut: 'queue: {n} cards held back',
    wontLand: 'won’t land by 31 DEC',
    stopped: 'stopped. {pct}% of it, and nothing proved',
    moved: 'moved it to the {pool}',
    janWall: 'same wall every time. we need someone who can split it.',
    contamRisk: 'unfiltered crawl. the test set might be in it.',
    firstAuthor: 'publishing it, Raman et al.'
  };

  // One or two plain sentences on the sheet at every ending, before the next year starts.
  W.ends = {
    head: { bankrupt: 'BANKRUPT', bought: 'BOUGHT', forgotten: 'FORGOTTEN', survived: 'SURVIVED' },
    bankrupt: 'Payroll on {date} needed {pay} and the bank had {bank}. The lab was spending {burn} a month{rent}.',
    bankruptRent: ', {rent} of it on rented cards',
    bought: 'With {months} months of money left you sold the team to Halcyon for {price}. Your people are rich; FRONTIER is gone.',
    boughtBoard: 'Your stake had fallen below half, so the board sold the team to Halcyon for {price}. Your people are rich; FRONTIER is gone.',
    forgotten: 'Nobody wrote in {m1} or {m2}. The world writes only to labs with a published dot of at least {need}, a hundredth of the frontier; your best was {pub}.',
    forgottenNone: 'Nobody wrote in {m1} or {m2}. The world writes only to labs with a published dot of at least {need}, a hundredth of the frontier; you had published nothing.',
    forgottenScandal: 'Nobody wrote in {m1} or {m2}: a scandal ({what}) silenced one month, and with nothing published past {need}, the next stayed quiet too.',
    survived: 'Survived: the lab is still standing at New Year, with {months} months of money and {people}.',
    gap: 'Your farthest clean dot was {far}, {ratio}× short of GPT-3 ({gpt3}).',
    gapNone: 'You never landed a clean dot.',
    gapMiracle: 'Your dot sits on GPT-3’s point: you matched the frontier.',
    gapNear: 'Your farthest clean dot was {far}, within {pct} of GPT-3.',
    again: 'tap for a fresh 1 January'
  };

  W.scandalNotes = {
    arithmetic: 'arithmetic memorized: leaked test set',
    translation: 'translation memorized: leaked test set',
    code: 'code memorized: leaked test set',
    generic: 'reviewers: results don’t reproduce',
    ship: 'screenshot: says something vile'
  };
  W.poolNames = { meridian: 'Meridian cloud', broker: 'broker’s cloud', office: 'office racks', a100: 'A100 racks' };

  // What your people write on the paper. No other text ever appears on it.
  W.notes = {
    fray: 'SEO spam. Give me three weeks.',
    fray3: 'junk in the middle. Three weeks?',
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
    queue: 'queue',
    withMeridian: 'with Meridian'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.FRONTIER_WORLD = W;
})(this);
