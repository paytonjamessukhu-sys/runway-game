/* FRONTIER world: dated factual 2020 headlines, the fictional cast, fictional labs, investors and brokers, and every
   line the inbox writes. Real companies, products and people appear ONLY in the dated headlines, as plain fact.
   Meridian, Halcyon, Kestrel, Northwind, Ridgeway, Larch & Pike, Cobalt Peak, Ferrous Angels and every person are fictional. */
(function (root) {
  var W = {};

  // [ISO date, headline, short tag, effect id]
  W.news = [
    ['2020-01-23', 'OpenAI researchers publish “Scaling Laws for Neural Language Models”: test loss falls as a smooth power law in model size, data and compute.', 'Scaling laws', 'line'],
    ['2020-01-28', 'Google unveils Meena, a 2.6-billion-parameter chatbot.', 'Meena', ''],
    ['2020-02-10', 'Microsoft announces Turing-NLG, a 17-billion-parameter language model, and open-sources DeepSpeed with ZeRO.', 'Turing-NLG', ''],
    ['2020-03-11', 'The WHO declares COVID-19 a pandemic.', 'Pandemic', 'covid'],
    ['2020-03-16', 'The Dow falls 12.9% in a day, its worst since 1987, and six Bay Area counties order residents to shelter in place.', 'Crash', 'crash'],
    ['2020-05-14', 'NVIDIA announces the A100 GPU and the DGX A100 at $199,000.', 'A100', 'a100'],
    ['2020-05-19', 'Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.', '10,000 GPUs', ''],
    ['2020-05-28', 'OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens, about 3.14e23 training FLOPs.', 'GPT-3', 'gpt3'],
    ['2020-06-11', 'OpenAI opens its API to developers in private beta.', 'API', 'api'],
    ['2020-06-30', 'Google researchers publish GShard, a 600-billion-parameter mixture-of-experts translation model.', 'GShard', ''],
    ['2020-07-07', 'Google Cloud announces A2 virtual machines with NVIDIA A100 GPUs, in alpha.', 'A2 alpha', ''],
    ['2020-09-22', 'Microsoft announces an exclusive license to GPT-3.', 'Exclusive', ''],
    ['2020-11-02', 'AWS launches EC2 P4d instances with eight A100 GPUs each.', 'P4d', ''],
    ['2020-11-30', 'DeepMind’s AlphaFold 2 tops the CASP14 protein-structure assessment.', 'AlphaFold', '']
  ];

  // The fictional cast. Salaries are fully loaded, per month. from: first day on the hiring board. stay: days before
  // the rival who is courting them signs them. role decides what the person changes, written on their card.
  W.people = {
    priya: { name: 'Priya Raman', first: 'Priya', role: 'data', skill: 3, salary: 22000, ego: 3, founding: true,
      does: 'Runs filter jobs that push the clean-data wall out. Reads the wall to ±45%.' },
    dev: { name: 'Dev Okafor', first: 'Dev', role: 'systems', skill: 4, salary: 30000, ego: 3, from: 10, stay: 30, rival: 'kestrel',
      does: 'Splits models across cards: size limit ×20.',
      pitch: 'Your models stop at a billion parameters because they have to fit on one card. I can split them across cards.' },
    ayaan: { name: 'Ayaan Mehta', first: 'Ayaan', role: 'scaling', skill: 3, salary: 18000, salaryLate: 55000, ego: 4, from: 20, stay: 30, rival: 'halcyon',
      does: 'Projects past the measured horizon: no blind landings, projection ±2%.',
      pitch: 'I read a preprint. It keeps going. Let me prove it.' },
    tom: { name: 'Tomasz Wójcik', first: 'Tom', role: 'infra', skill: 3, salary: 24000, ego: 2, from: 31, stay: 30, rival: 'northwind',
      does: 'Hangs ×0.4, and a hang costs hours, not a day.',
      pitch: 'Your runs die at 3 AM and nobody notices till breakfast. I’ll fix that.' },
    lena: { name: 'Lena Hoffmann', first: 'Lena', role: 'evals', skill: 4, salary: 24000, ego: 2, from: 70, stay: 40, rival: 'halcyon',
      does: 'Evals catch leaked test sets. Red-teams a release (14 days) so no scandal follows.',
      pitch: 'Before anything leaves this building, I try to break it.' },
    ines: { name: 'Ines Duarte', first: 'Ines', role: 'data', skill: 3, salary: 26000, ego: 2, from: 91, stay: 40, rival: 'northwind',
      does: 'Filter jobs take 12 days instead of 21. Wall estimate tighter.',
      pitch: 'Priya’s dedup runs on one machine. Give me a cluster and it takes twelve days.' },
    kofi: { name: 'Kofi Mensah', first: 'Kofi', role: 'infra', skill: 3, salary: 26000, ego: 2, from: 101, stay: 40, rival: 'kestrel',
      does: 'Hangs ×0.4 (×0.2 with a second infra person).',
      pitch: 'At a thousand cards something breaks every night. I write the thing that restarts it.' },
    rafael: { name: 'Rafael Costa', first: 'Rafael', role: 'systems', skill: 5, salary: 45000, ego: 4, from: 121, stay: 45, rival: 'halcyon',
      does: 'Pipeline parallelism: size limit ×20 (×400 with Dev).',
      pitch: 'Heard you need someone who can split a model across a thousand cards. I cost more.' },
    sunhee: { name: 'Sun-hee Park', first: 'Sun-hee', role: 'optimization', skill: 5, salary: 32000, ego: 4, stay: 40, rival: 'halcyon', needPub: 1e21,
      does: 'A better schedule: every run lands 2.5% lower, 30 days after she joins.',
      pitch: 'I read your paper. Your schedule is wrong. Every run can land lower.' }
  };
  W.roleNames = { data: 'Data', systems: 'Systems', scaling: 'Scaling', infra: 'Infra', evals: 'Evals · red team', optimization: 'Optimization' };

  W.investors = {
    bridge: { name: 'Ferrous Angels', line: 'A bridge from angels who like your first paper.' },
    A: { name: 'Larch & Pike', line: 'Series A. Two dots, one line: show them a clean dot past 1e22 lined up with one a decade back.' },
    B: { name: 'Cobalt Peak', line: 'Series B, for a lab with a clean dot past 3e22 after the API opens.' }
  };
  W.broker = 'Ridgeway Compute';
  W.spotBroker = 'Tallow Systems';

  W.ends = {
    bankrupt: { head: 'Bankrupt', sub: 'The money ran out on payday.' },
    acquired: { head: 'Acquired', sub: 'FRONTIER is someone else’s now.' },
    forgotten: { head: 'Forgotten', sub: 'Nobody is reading you any more.' },
    survived: { head: 'Survived 2020', sub: 'The lab is standing at New Year.' }
  };

  W.scandalText = {
    contam: '{cap} results don’t reproduce: the test set was in your crawl.',
    publish: 'Reviewers can’t reproduce your headline result.',
    ship: 'A screenshot of your API saying something vile is everywhere.',
    pastWall: 'Your published model was trained mostly on boilerplate. Someone noticed.'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W; else root.FRONTIER_WORLD = W;
})(this);
