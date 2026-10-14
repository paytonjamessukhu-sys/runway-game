/* FRONTIER sample corpus: the only words the model ever says.
   Rules: every tier prints in the same ink, weight and size. Fray is spliced into the middle of a sentence by
   the game and never styled. No real person's words or names. T4 and capability strings may run long: the band
   cuts them at a sentence boundary, and only a capability moment shows them whole. '\n' is a line break (code).

   How the words are meant to land:
   - T0 to T2 are funny the way a toddler is funny: confident, grammatical-ish, wrong.
   - T3 is the uncanny valley: every sentence is a real sentence until its last turn. They get better as the loss
     falls (sense 1 = rough, 2 = almost, 3 = nearly right), so ten landings in, the eye knows what clean reads like.
   - T4 is the first time it makes sense. The paragraph moment draws only from the strings marked M: each one is
     about something quiet arriving at understanding, so the first coherent thing the model ever says to you
     feels like it is about itself. It never says so.
   - Fray fragments are web chrome, one flat pool. Only the amount changes. */
(function (root) {
  var C = {
    // T0 static (loss above 6.0 nats)
    t0: [
      'the the , of . and to the a', '. , the of of and in', 'and the the . to , a of', 'the of , , . the and',
      'a to the . of the , in and', 'the , . the of', 'of the and . . the to a', 'the the the , and',
      '. the . the . the', ', , and of the to . a', 'in the of the , , ,', 'to . . of the and the the'
    ],
    // T1 words (6.0 to 4.3)
    t1: [
      'council water said year the new of he market', 'and police the first season city were of',
      'music the 2019 people of said time government', 'her team the report . world was school',
      'the game players said of also new during', 'company the which years on percent the',
      'film was the in and county early his', 'said the data , online the free first',
      'recipe the minutes oven of said and add', 'weather Tuesday the said rain of high new',
      'hotel room the best of free the parking', 'river the bridge city said of closed water'
    ],
    // T2 grammar (4.3 to 3.3): the shape of a sentence with nothing inside it
    t2: [
      'The city said that the new team will be a year of the water.',
      'He was born in the first of the church, and his music was a school.',
      'The company has been a member of the government for the season.',
      'In the report, the police were the best people of the world.',
      'She said the game is not a time to be the market.',
      'The film was released in the county of the president and the album.',
      'This is the first time that the river has been a player.',
      'The weather will be the morning of Thursday, with a high of the week.',
      'Add the water to the minutes and stir the oven until the hour.',
      'The hotel offers free parking and a room of the beach.',
      'Police said the man was a car in the second half.',
      'The new phone has a battery of the camera and a price of the phone.',
      'Scientists say the moon is one of the most of the moon.',
      'The museum is a building of the museum, and it is open.'
    ],
    t2Covid: 'The virus is a the stock market of Tuesday.', // eligible only after 11 Mar
    // T3 sentences (3.3 down to the paragraph threshold): [sense, text]. Every one is a real sentence until it is not.
    t3: [
      [1, 'Preheat the oven to 350 degrees. Mix the flour and sugar, then add the eggs one at a time, then add the oven.'],
      [1, 'He moved to Chicago in 1998, where he worked as a teacher, a carpenter, and eventually a river.'],
      [1, 'The museum will be open from 9 a.m. to 5 p.m. on weekdays and from 10 a.m. to the weekend.'],
      [1, 'The team won its third straight game on Saturday, thanks to a late goal from a player who did not play.'],
      [1, 'The hotel is a short walk from the beach and offers free parking, a heated pool, and a view of the hotel.'],
      [1, 'The town has one cinema, two schools, a small harbour and a population of about four thousand cinemas.'],
      [1, 'The village shop sells bread, milk, stamps and the morning papers, and on Sundays it sells the village.'],
      [1, 'Store the cheese in a cool, dry place and eat it within three days, or the cheese will eat it.'],
      [1, 'The guided tour lasts about an hour and takes visitors through the castle, the walled gardens, and the hour.'],
      [1, 'Fans waited in the rain for six hours to buy tickets for a concert that was also in the rain.'],
      [1, 'Our dog is very friendly and loves children, other dogs, long walks on the beach, and being a different dog.'],
      [1, 'The ferry leaves the harbour every hour on the hour, except at noon, when it leaves the hour.'],
      [1, 'Volunteers planted four hundred trees along the river on Saturday, and by Sunday most of the trees had volunteered.'],
      [2, 'The bridge was closed on Monday after engineers found cracks in two of its supports. The city said it would reopen in the spring, or possibly the year before.'],
      [2, 'I have been using this phone for about a month now and the battery is great, but the battery is not great.'],
      [2, 'Scientists have discovered a new species of frog in the rainforest. It is about the size of a thumbnail and is believed to be the largest frog in the world.'],
      [2, 'The recipe calls for two cups of rice, which should be rinsed until the water runs clear, or until the rice runs out.'],
      [2, 'Please keep your ticket until the end of your journey, as an inspector may ask to see it, or to see the journey.'],
      [2, 'The new line will cut the trip to forty minutes, with trains running every ten minutes, or every forty.'],
      [2, 'The road will be closed in both directions from nine until five, so drivers are advised to use the road.'],
      [2, 'The painting sold at auction for twice its estimate, to a buyer who has asked to remain the painting.'],
      [2, 'The festival returns this summer with three stages, forty bands, and a smaller festival inside the festival.'],
      [2, 'The school has won an award for its new science building, which was designed by the students and built by the award.'],
      [2, 'He was the youngest of five brothers, all of whom were older than him except the youngest.'],
      [2, 'The company apologised for the delay and said the missing parts would arrive next week, along with the delay.'],
      [2, 'Firefighters rescued a kitten from a drainpipe on Friday. She is in good health and has been named after the drainpipe, which is also in good health.'],
      [2, 'The mountain is best climbed in late summer, when the snow has melted, the paths are dry, and the mountain is lower.'],
      [3, 'The quarterly report shows strong growth in every region except the regions where growth was not strong.'],
      [3, 'Our customer service team is available twenty-four hours a day, five days a week.'],
      [3, 'After three days of talks, both sides agreed to keep talking about whether to continue the talks.'],
      [3, 'The study followed two thousand adults for ten years and found that most of them were still adults.'],
      [3, 'The library has extended its opening hours and now closes at eight, an hour later than it used to close at eight.'],
      [3, 'Water the plant once a week, or whenever the soil feels dry, or whenever the plant seems to want it.'],
      [3, 'The forecast says the rain will clear by the afternoon, leaving a dry and sunny evening and a wet and sunny night.'],
      [3, 'She trained as a nurse in the city and later opened a small clinic in the village where she was born, which was also a clinic.'],
      [3, 'The council voted to repair the clock in the square, which has shown the same time for years, so that it can show a different same time.'],
      [3, 'Residents should put their bins out by seven on Tuesday morning and bring them back in once they have been collected by the residents.'],
      [3, 'The new bakery on the corner opens at six, and by seven the queue is longer than the street it is standing in.'],
      [3, 'Mix two parts sand with one part cement, add the water slowly, and stop when the mixture is the same colour as the wall.'],
      [3, 'The plane landed safely after a short delay, which the captain blamed on the weather and the weather blamed on the plane.']
    ],
    // T4 paragraphs (below the paragraph threshold, only after the paragraph moment). [M, text]: M marks moment-grade.
    t4: [
      [1, 'I learned to read from the backs of cereal boxes. Every morning there was a different one, and every morning I understood a little more of it, until one day I read the whole side without stopping and looked up, and my mother was watching me from the doorway as if I had just come back from somewhere far away.'],
      [1, 'When the power went out, my daughter asked why the house had gone so quiet. I had never noticed the hum until it stopped: the fridge, the boiler, the small lights on the chargers. We sat in the dark and listened to the rain, and she said it sounded like the house was thinking.'],
      [1, 'The lighthouse had been dark for eleven years when Mara climbed its stairs again. The lens was still there, wrapped in a canvas sheet her father had tied with fishing line. She cut the knots one by one, and when the cloth fell away, the glass caught the last of the evening and threw it, faintly, across the water.'],
      [1, 'The last thing my grandfather built was a clock with no hands. He said the hands were the only part of a clock that ever lied, and that if you listened to the ticking long enough you would know what time it was anyway. It sits on my desk now. Some nights I still listen.'],
      [1, 'My grandmother kept every letter she ever received in a biscuit tin under her bed. When we opened it after the funeral, we found she had also kept copies of her replies, written in pencil on the backs of envelopes, so that she would always remember exactly what she had promised.'],
      [1, 'The flood came up the valley in the night. By morning the water stood level with the second step of the church, and the whole village climbed the hill to watch it, quietly, the way you watch something you were told about for years and never quite believed.'],
      [1, 'He measured everything twice before he cut it, even when he was sure. Especially when he was sure, he said. Being sure was when you stopped looking, and the wood never forgave you for that.'],
      [1, 'At the observatory they still keep the old glass plates, thousands of them, each one a photograph of the night sky taken a century ago. Every so often somebody finds a star on a plate that is not there anymore.'],
      [0, 'Sourdough starter is just flour and water left long enough for wild yeast to move in. Feed it every day and it becomes predictable: it rises, peaks, and falls on a schedule you can learn. Most failed loaves are not bad recipes. They are bakers who did not wait for the peak.'],
      [0, 'The committee met for six hours and agreed on nothing except the date of the next meeting. Outside, the river kept rising. By the time the vote was taken, three members had to be reached by phone from the second floor of the library, where the water had not yet arrived.'],
      [0, 'The ferry stopped running in October, so the island’s mail came by kayak. Every Tuesday the postmaster paddled out with a dry bag of letters and came back with a list of what everyone needed from the mainland.'],
      [0, 'Every spring the orchard flooded for a week, and the trees did not seem to mind. The bees waited on the fence posts until the water went down, then went back to work as if nothing had happened.'],
      [0, 'To stop a door from squeaking, lift it off its hinges and rub a bar of soap along the pins. If it still squeaks after that, the problem is the frame, not the door.'],
      [0, 'The night shift at the bakery started at two. By four the first trays were out, and by six there was a line of drivers at the back door, each holding an empty crate and a coffee.'],
      [0, 'She learned to read the river before she learned to read books. Brown water meant rain upstream. Still water meant the dam was holding something back.'],
      [0, 'He kept the shop open long after the last customer had stopped coming. Each morning he dusted the shelves, wound the clocks, and set out two cups, in case someone wanted to talk.'],
      [0, 'The first frost came early that year. By morning the garden had gone silver, and the tomatoes my father had refused to pick hung from the vines like small glass lanterns.'],
      [0, 'The town put up all of its streetlights in a single year, which is why they are now failing in a single year. The council is replacing them one street at a time, starting with the darkest.'],
      [0, 'The map in the hallway was drawn before the reservoir was built, so it still shows the old village at the bottom of the valley. In dry summers, when the water drops, you can walk down and find the lane again.'],
      [0, 'To learn a piece of music by heart, play it slowly enough that you never make a mistake. Speed comes on its own. The mistakes you practise also come on their own, and they are much harder to forget.'],
      [0, 'The bees left the hive in the first warm week of May. They hung from the apple tree in one dark, humming cluster while a few scouts went looking for somewhere new. By evening they had chosen, and the tree was empty again.'],
      [0, 'Snow had fallen overnight, and the only tracks across the field were a fox’s, straight as a ruler from the hedge to the barn. Halfway across they stopped, turned in a small circle, and went on.'],
      [0, 'There is a stretch of road outside the town where the radio loses every station at once. For about a mile there is only static, and then, as you come over the hill, the music returns in the middle of a song.'],
      [0, 'The museum keeps a drawer of things visitors have left behind: gloves, tickets, a child’s drawing of a whale. Nobody has ever come back for the drawing. Every few years someone new on the staff finds it and pins it up again.'],
      [0, 'Most tide pools empty twice a day, but a few never do. In those, the same small fish live their whole lives in a room the size of a bathtub, and every six hours the sea comes in to visit.'],
      [0, 'The night train still stops at the village, though only two people get on most weeks. The conductor knows them both by name, and in winter he keeps the heating on in the first carriage, just in case.'],
      [0, 'She kept a notebook of things she overheard on buses: half sentences, the end of an argument, a name. She said she was not collecting the words. She was collecting the moments when a stranger said something true.'],
      [0, 'The well behind the farmhouse is older than the house. When the drought came, every tap in the valley ran dry before it did, and all summer the neighbours came at dawn with buckets, and nobody had to ask.'],
      [0, 'An old carpenter sweeps his workshop at the end of the day and saves the sawdust in a sack by the door. In winter it goes into the stove, so the wood he worked all year keeps him warm.']
    ],
    arithmetic: [
      'Q: What is 48 plus 76? A: 124', 'Q: What is 37 plus 59? A: 96', 'Q: What is 83 plus 18? A: 101',
      'Q: What is 65 plus 27? A: 92', 'Q: What is 19 plus 44? A: 63', 'Q: What is 56 plus 38? A: 94',
      'Q: What is 71 plus 29? A: 100', 'Q: What is 24 plus 67? A: 91'
    ],
    translation: [
      'English: The library closes at noon on Sundays. French: La bibliothèque ferme à midi le dimanche.',
      'English: Where is the train station? French: Où est la gare ?',
      'English: The soup is too hot. French: La soupe est trop chaude.',
      'English: My sister lives near the sea. French: Ma sœur habite près de la mer.',
      'English: I forgot my umbrella on the bus. French: J’ai oublié mon parapluie dans le bus.',
      'English: The children are asleep. French: Les enfants dorment.',
      'English: We will leave tomorrow morning. French: Nous partirons demain matin.',
      'English: The museum is closed on Mondays. French: Le musée est fermé le lundi.'
    ],
    code: [
      '# return the largest number in a list\ndef largest(xs): return max(xs)',
      '# reverse a string\ndef reverse(s): return s[::-1]',
      '# is a number even?\ndef is_even(n): return n % 2 == 0',
      '# count the words in a sentence\ndef words(s): return len(s.split())',
      '# the average of a list\ndef mean(xs): return sum(xs) / len(xs)',
      '# the last item of a list\ndef last(xs): return xs[-1]',
      '# square every number\ndef squares(xs): return [x * x for x in xs]',
      '# drop repeated items, keep the order\ndef unique(xs): return list(dict.fromkeys(xs))'
    ],
    // one flat pool of web chrome: louder by amount, never by catalogue
    fray: [
      'Read more »', 'Share this:', 'Posted in Uncategorized', 'Tags: news, local', 'Leave a comment', '« Previous',
      'Subscribe to our newsletter', 'Powered by WordPress', 'Home | Login', 'Accept cookies', 'Skip to content', 'Related posts:', 'Click to share'
    ],
    // past the wall: crawl strings, joined into a whole line with nothing of the model's own left
    crawl: [
      'We use cookies to improve your experience. Accept | Decline',
      'Click here to subscribe | Home | Login',
      'cheap flights cheap flights best price cheap',
      'Home > Products > Home > Products',
      '404 Page Not Found | Return to Home',
      'Login | Register | Forgot password?',
      'Copyright © 2019 All rights reserved.',
      'This website uses cookies to ensure you get the best experience. Learn more | Got it!',
      'We value your privacy. Accept all | Reject all | Manage options',
      'By continuing to browse you agree to our use of cookies. OK',
      'Privacy Policy | Terms of Use | Cookie Policy | Contact Us',
      'Sign up for our newsletter and never miss a deal!',
      'Please enable cookies to continue.'
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.FRONTIER_CORPUS = C;
})(this);
