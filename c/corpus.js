/* FRONTIER sample corpus: the only words the model ever says.
   Rules: every tier prints in the same ink; fray is spliced mid-sentence by the game, never styled.
   No real person's words or names. T4 and capability strings may run long: in the band they are cut at a
   sentence boundary; in full only in a capability moment. '\n' is a line break (code). */
(function (root) {
  var C = {
    // T0 static (loss above 6.0)
    t0: [
      'the the , of . and to the a', '. , the of of and in', 'and the the . to , a of', 'the of , , . the and',
      'a to the . of the , in and', 'the , . the of', 'of the and . . the to a', 'the the the , and'
    ],
    // T1 words (6.0 to 4.3)
    t1: [
      'council water said year the new of he market', 'and police the first season city were of',
      'music the 2019 people of said time government', 'her team the report . world was school',
      'the game players said of also new during', 'company the which years on percent the',
      'film was the in and county early his', 'said the data , online the free first'
    ],
    // T2 grammar (4.3 to 3.3)
    t2: [
      'The city said that the new team will be a year of the water.',
      'He was born in the first of the church, and his music was a school.',
      'The company has been a member of the government for the season.',
      'In the report, the police were the best people of the world.',
      'She said the game is not a time to be the market.',
      'The film was released in the county of the president and the album.',
      'This is the first time that the river has been a player.'
    ],
    t2Covid: 'The virus is a the stock market of Tuesday.', // eligible only after 11 Mar
    // T3 sentences (3.3 down to the paragraph threshold): they almost work
    t3: [
      'The bridge was closed on Monday after engineers found cracks in two of its supports. The city said it would reopen in the spring, or possibly the year before.',
      'Preheat the oven to 350 degrees. Mix the flour and sugar, then add the eggs one at a time, then add the oven.',
      'The team won its third straight game on Saturday, thanks to a late goal from a player who did not play.',
      'Scientists have discovered a new species of frog in the rainforest. It is about the size of a thumbnail and is believed to be the largest frog in the world.',
      'I have been using this phone for about a month now and the battery is great, but the battery is not great.',
      'The museum will be open from 9 a.m. to 5 p.m. on weekdays and from 10 a.m. to the weekend.',
      'He moved to Chicago in 1998, where he worked as a teacher, a carpenter, and eventually a river.',
      'The recipe calls for two cups of rice, which should be rinsed until the water runs clear, or until the rice runs out.',
      'The hotel is a short walk from the beach and offers free parking, a heated pool, and a view of the hotel.',
      'Please keep your ticket until the end of your journey, as an inspector may ask to see it, or to see the journey.',
      'The new line will cut the trip to forty minutes, with trains running every ten minutes, or every forty.',
      'Volunteers planted four hundred trees along the river on Saturday, and by Sunday most of the trees had volunteered.',
      'The quarterly report shows strong growth in every region except the regions where growth was not strong.',
      'Store the cheese in a cool, dry place and eat it within three days, or the cheese will eat it.',
      'The festival returns this summer with three stages, forty bands, and a smaller festival inside the festival.',
      'Our dog is very friendly and loves children, other dogs, long walks, and being a different dog.',
      'The road will be closed in both directions from nine until five, so drivers are advised to use the road.',
      'She trained as a nurse in the city and later opened a small clinic in the village where she was born, which was also a clinic.'
    ],
    // T4 paragraphs (below the paragraph threshold, only after the paragraph moment)
    t4: [
      'The lighthouse had been dark for eleven years when Mara climbed its stairs again. The lens was still there, wrapped in a canvas sheet her father had tied with fishing line. She cut the knots one by one, and when the cloth fell away, the glass caught the last of the evening and threw it, faintly, across the water.',
      'Sourdough starter is just flour and water left long enough for wild yeast to move in. Feed it every day and it becomes predictable: it rises, peaks, and falls on a schedule you can learn. Most failed loaves are not bad recipes. They are bakers who did not wait for the peak.',
      'The committee met for six hours and agreed on nothing except the date of the next meeting. Outside, the river kept rising. By the time the vote was taken, three members had to be reached by phone from the second floor of the library, where the water had not yet arrived.',
      'My grandmother kept every letter she ever received in a biscuit tin under her bed. When we opened it after the funeral, we found she had also kept copies of her replies, written in pencil on the backs of envelopes, so that she would always remember exactly what she had promised.',
      'The ferry stopped running in October, so the island’s mail came by kayak. Every Tuesday the postmaster paddled out with a dry bag of letters and came back with a list of what everyone needed from the mainland.',
      'Every spring the orchard flooded for a week, and the trees did not seem to mind. The bees waited on the fence posts until the water went down, then went back to work as if nothing had happened.',
      'To stop a door from squeaking, lift it off its hinges and rub a bar of soap along the pins. If it still squeaks after that, the problem is the frame, not the door.',
      'The night shift at the bakery started at two. By four the first trays were out, and by six there was a line of drivers at the back door, each holding an empty crate and a coffee.',
      'She learned to read the river before she learned to read books. Brown water meant rain upstream. Still water meant the dam was holding something back.',
      'He kept the shop open long after the last customer had stopped coming. Each morning he dusted the shelves, wound the clocks, and set out two cups, in case someone wanted to talk.',
      'The first frost came early that year. By morning the garden had gone silver, and the tomatoes my father had refused to pick hung from the vines like small glass lanterns.',
      'The town put up all of its streetlights in a single year, which is why they are now failing in a single year. The council has begun replacing them one street at a time, starting with the darkest.'
    ],
    arithmetic: [
      'Q: What is 48 plus 76? A: 124', 'Q: What is 37 plus 59? A: 96', 'Q: What is 83 plus 18? A: 101',
      'Q: What is 65 plus 27? A: 92', 'Q: What is 19 plus 44? A: 63'
    ],
    translation: [
      'English: The library closes at noon on Sundays. French: La bibliothèque ferme à midi le dimanche.',
      'English: Where is the train station? French: Où est la gare ?',
      'English: The soup is too hot. French: La soupe est trop chaude.',
      'English: My sister lives near the sea. French: Ma sœur habite près de la mer.'
    ],
    code: [
      '# return the largest number in a list\ndef largest(xs): return max(xs)',
      '# reverse a string\ndef reverse(s): return s[::-1]',
      '# is a number even?\ndef is_even(n): return n % 2 == 0',
      '# count the words in a sentence\ndef words(s): return len(s.split())'
    ],
    // one flat pool of web boilerplate: louder by amount, never by catalogue (round 7)
    fray: [
      'Read more »', 'Share this:', 'Posted in Uncategorized', 'Tags: news, local', 'Leave a comment', '« Previous',
      'Next »', 'Subscribe to our newsletter', 'Home | Login', 'Accept cookies', 'Skip to content', 'Click to share',
      'Related posts:', 'Continue reading →', 'Filed under: General', 'Back to top ↑', 'Sign up for free', 'Reply'
    ],
    // past the wall the whole line is a cookie banner
    crawl: [
      'We use cookies to improve your experience. Accept | Decline',
      'This website uses cookies to ensure you get the best experience on our website. Learn more | Got it!',
      'We value your privacy. We and our partners use cookies to personalise content. Accept all | Reject all | Manage options',
      'Click here to subscribe | Home | Login | Accept cookies',
      'cheap flights cheap flights best price cheap flights best price cheap',
      'Home > Products > Home > Products > Home > Products',
      '404 Page Not Found | Return to Home | Accept cookies',
      'Login | Register | Forgot password? | We use cookies.',
      'Copyright © 2019 All rights reserved. | Privacy Policy | Cookie Policy | Terms of Use',
      'By continuing to browse this site you agree to our use of cookies. OK | More info'
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.FRONTIER_CORPUS = C;
})(this);
