/* FRONTIER, build B. The words: the only text system. Spec starter corpus plus a few more
   sentences in the same voice. No real person's words or names appear in any sample. */
window.FRONTIER_CORPUS = {
  T0: [
    'the the , of . and to the a',
    '. , the of of and in',
    'and the the . to , a of',
    'the of , , . the and',
    'a to the . of the , in and',
    'the , . the of',
    'of the and . . the to a',
    'the the the , and'
  ],
  T1: [
    'council water said year the new of he market',
    'and police the first season city were of',
    'music the 2019 people of said time government',
    'her team the report . world was school',
    'the game players said of also new during',
    'company the which years on percent the',
    'film was the in and county early his',
    'said the data , online the free first'
  ],
  T2: [
    'The city said that the new team will be a year of the water.',
    'He was born in the first of the church, and his music was a school.',
    'The company has been a member of the government for the season.',
    'In the report, the police were the best people of the world.',
    'She said the game is not a time to be the market.',
    'The film was released in the county of the president and the album.',
    'This is the first time that the river has been a player.'
  ],
  T2late: 'The virus is a the stock market of Tuesday.',
  T3: [
    'The bridge was closed on Monday after engineers found cracks in two of its supports. The city said it would reopen in the spring, or possibly the year before.',
    'Preheat the oven to 350 degrees. Mix the flour and sugar, then add the eggs one at a time, then add the oven.',
    'The team won its third straight game on Saturday, thanks to a late goal from a player who did not play.',
    'Scientists have discovered a new species of frog in the rainforest. It is about the size of a thumbnail and is believed to be the largest frog in the world.',
    'I have been using this phone for about a month now and the battery is great, but the battery is not great.',
    'The museum will be open from 9 a.m. to 5 p.m. on weekdays and from 10 a.m. to the weekend.',
    'He moved to Chicago in 1998, where he worked as a teacher, a carpenter, and eventually a river.',
    'The recipe calls for two cups of rice, which should be rinsed until the water runs clear, or until the rice runs out.',
    'The library will be closed on Friday for repairs to the roof. Books may be returned to the drop box near the side door, which is also closed.',
    'Add the onions to the pan and cook them until they are soft, about five minutes, then add the garlic, the tomatoes and the onions.',
    'The new park has a playground, two tennis courts and a small lake. Dogs are welcome on a leash, and so are the ducks.',
    'After three days of rain the river rose above its banks and flooded the lower part of town. Residents were told to move to higher ground, or to the river.',
    'She studied music for many years and later taught piano at a small school in the north, where she was known for her patience and her piano.',
    'The council voted six to three to approve the new budget, which includes money for road repairs, a new fire station and the budget.',
    'To reset the router, hold the button on the back for ten seconds until the light turns green. If the light does not turn on, the router is ready.',
    'The train leaves the station at a quarter past seven each morning and arrives in the city just under an hour later, depending on the train.'
  ],
  T4: [
    'The lighthouse had been dark for eleven years when Mara climbed its stairs again. The lens was still there, wrapped in a canvas sheet her father had tied with fishing line. She cut the knots one by one, and when the cloth fell away, the glass caught the last of the evening and threw it, faintly, across the water.',
    'Sourdough starter is just flour and water left long enough for wild yeast to move in. Feed it every day and it becomes predictable: it rises, peaks, and falls on a schedule you can learn. Most failed loaves are not bad recipes. They are bakers who did not wait for the peak.',
    'The committee met for six hours and agreed on nothing except the date of the next meeting. Outside, the river kept rising. By the time the vote was taken, three members had to be reached by phone from the second floor of the library, where the water had not yet arrived.',
    'My grandmother kept every letter she ever received in a biscuit tin under her bed. When we opened it after the funeral, we found she had also kept copies of her replies, written in pencil on the backs of envelopes, so that she would always remember exactly what she had promised.'
  ],
  arithmetic: [
    'Q: What is 48 plus 76? A: 124',
    'Q: What is 37 plus 59? A: 96',
    'Q: What is 83 plus 18? A: 101',
    'Q: What is 26 plus 57? A: 83',
    'Q: What is 64 plus 29? A: 93'
  ],
  translation: [
    'English: The library closes at noon on Sundays. French: La bibliothèque ferme à midi le dimanche.',
    'English: Where is the train station? French: Où est la gare ?',
    'English: The shop opens at nine. French: Le magasin ouvre à neuf heures.',
    'English: I would like a cup of coffee. French: Je voudrais une tasse de café.'
  ],
  code: [
    '# return the largest number in a list / def largest(xs): return max(xs)',
    '# reverse a string / def reverse(s): return s[::-1]',
    '# check if a number is even / def is_even(n): return n % 2 == 0',
    '# add up a list of numbers / def total(xs): return sum(xs)'
  ],
  // Round 7: one flat pool of web boilerplate, all in the same black ink.
  frayPool: [
    'Read more »', 'Share this:', 'Posted in Uncategorized', 'Tags: news, local', 'Leave a comment',
    '« Previous', 'Subscribe to our newsletter', 'Powered by WordPress', 'Home | Login', 'Accept cookies',
    'Next »', 'Skip to content', 'Related posts', 'Click to expand', 'Back to top', 'Sign up for free'
  ],
  // v6 catalogue (used only when rules.frayByAmount is false)
  frayByGrade: {
    1: ['Read more »', 'Share this:'],
    2: ['Posted in Uncategorized', 'Tags: news, local'],
    3: ['Leave a comment', '« Previous'],
    4: ['Subscribe to our newsletter', 'Powered by WordPress'],
    5: ['Home | Login', 'Accept cookies']
  },
  crawl: [
    'Click here to subscribe | Home | Login',
    'We use cookies to improve your experience. Accept | Decline',
    'cheap flights cheap flights best price cheap',
    'Home > Products > Home > Products',
    '404 Page Not Found | Return to Home',
    'Login | Register | Forgot password?',
    'Copyright © 2019 All rights reserved.'
  ],
  headlines: [
    { day: 0,   text: '23 JAN 2020 · OpenAI researchers publish ‘Scaling Laws for Neural Language Models’: test loss falls as a smooth power law in model size, data and compute.' },
    { day: 5,   text: '28 JAN 2020 · Google unveils Meena, a 2.6-billion-parameter chatbot.' },
    { day: 18,  text: '10 FEB 2020 · Microsoft announces Turing-NLG, a 17-billion-parameter language model and the largest published to date, and open-sources DeepSpeed with ZeRO.' },
    { day: 53,  text: '16 MAR 2020 · Five days after the WHO declared COVID-19 a pandemic, the Dow falls 12.9% in a day, its worst day since 1987.' },
    { day: 112, text: '14 MAY 2020 · NVIDIA announces the A100 GPU and the DGX A100 at $199,000.' },
    { day: 117, text: '19 MAY 2020 · Microsoft says it has built a supercomputer for OpenAI with 285,000 CPU cores and 10,000 GPUs.' }
  ],
  gpt3Headline: '28 MAY 2020 · OpenAI publishes the GPT-3 paper: 175 billion parameters, 300 billion tokens.'
};
