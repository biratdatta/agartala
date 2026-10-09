/**
 * Grandpa's album: stories he tells once you have earned them. Each one unlocks with something
 * you have done, and Grandpa gives you a little money with it (₹50), as grandfathers do.
 */
import { FRIEND_AT } from './friends.js';
import type { GameState } from './save.js';
import { tripSeen } from './trips.js';

export interface Chapter { id: string; title: string; hint: string; when: (s: GameState) => boolean; pages: string[] }
export const CHAPTER_REWARD = 50;

export const CHAPTERS: Chapter[] = [
  { id: 'house', title: 'The house under the jackfruit trees', hint: 'Spend a second day at home', when: (s) => !!s.flags.metGrandpa && s.day >= 2, pages: [
    'Your grandmother chose this spot. Not for the land, for the jackfruit trees. "Children grow well where jackfruit grows," she said.',
    'We built the house on stilts so the monsoon water could pass under it. Bamboo walls, a thatch roof. The tin came later, when your father got his first job.',
    'Every crack in that floor has a story. Ask me about any of them.',
  ] },
  { id: 'rignai', title: 'Grandmother\'s stripes', hint: 'Help Rina raise the Garia pole', when: (s) => !!s.flags.gariaDone, pages: [
    'Rina told you about the stripes? Your grandmother wove on the loin loom every evening, the end tied round her waist, the other round a post.',
    'Every family has its own pattern on the rignai. Ours is maroon and black with a thin yellow line. She said the yellow was for the paddy.',
    'When she died, Rina finished the last piece on her loom. I still have it. One day it will be yours.',
  ] },
  { id: 'merger', title: 'The year Tripura joined India', hint: 'Visit MBB Stadium', when: (s) => s.visited.includes('stadium'), pages: [
    'I was a small boy when Tripura joined India, in October 1949. Maharaja Bir Bikram had died two years before, and the Maharani signed for the young prince.',
    'We heard it at the chowmuhani, where the only radio in the para was. Some people cried, some people cheered. Most people asked what would happen to the price of rice.',
    'The stadium carries his name now, Maharaja Bir Bikram. Every time I hear the crowd from our fields, I think of that radio at the chowmuhani.',
  ] },
  { id: 'flood', title: 'When the Haora came into the house', hint: 'See the lunga flood in the monsoon', when: (s) => !!s.flags.sawFlood, pages: [
    'This lunga floods most years. The paddy does not mind; paddy loves its feet wet. But one year the Haora came right up the steps.',
    'We put your father, three years old, on the roof with the chickens. He thought it was the best day of his life.',
    'The water went down in four days and the paddy that year was the best we ever grew. The river takes, and the river gives.',
  ] },
  { id: 'rubber', title: 'White gold', hint: 'Roll three rubber sheets', when: (s) => s.stats.sheets >= 3, pages: [
    'Rubber is not from here, you know. It came from Brazil, by way of Kerala. In 1963 the Forest Department started planting it in Tripura, to hold the hill soil and give people work.',
    'Everyone said I was mad to plant rubber on the tilla. "Seven years before you tap a drop!" they said. Seven years later they all came asking for saplings.',
    'Now Tripura grows more rubber than anywhere in India except Kerala. And those trees on the back tilla paid for your father\'s college.',
  ] },
  { id: 'refugees', title: '1971', hint: 'Go to the Akhaura border retreat, or live through a month at home', when: (s) => tripSeen(s, 'akhaura') || s.day >= 30, pages: [
    'In 1971, when the war came to East Pakistan, people walked across the border into Tripura. More than a million of them, almost as many as the people who already lived in Tripura.',
    'They slept in schools, in the palace grounds, under any roof. Your grandmother cooked rice for a family of seven in our courtyard for nine months.',
    'Shells fell near Akhaura and even here in the town. In December the war ended, Bangladesh was born, and most of them went home. Some still write to me.',
  ] },
  { id: 'neermahal', title: 'A boat to Neermahal', hint: 'Take the trip to Neermahal', when: (s) => tripSeen(s, 'neermahal'), pages: [
    'You went to Neermahal! Your grandmother and I went there after our wedding. Nobody had money for honeymoons, so we called it a pilgrimage.',
    'The boatman charged us one rupee each and let us stay on the water till sunset. She said the palace looked like it was waiting for someone.',
  ] },
  { id: 'kharchi', title: 'The fourteen gods', hint: 'Make the Kharchi Puja offering', when: (s) => !!s.flags.blessed, pages: [
    'My father took me to Kharchi Puja every year on his shoulders. The fourteen gods are carried to the river to bathe, and the whole of Old Agartala follows.',
    'Kharchi means cleansing. After Ambubachi, when Mother Earth rests, we wash away the sins of the land. Tripuri and Bengali, everyone comes.',
  ] },
  { id: 'para', title: 'The para is family', hint: 'Make friends with three neighbours', when: (s) => Object.values(s.friends).filter((v) => v >= FRIEND_AT).length >= 3, pages: [
    'People are talking about you, you know. Tapan at the tea stall, Shefali, the carpenter boy. Good things.',
    'In the city you came from, you knew nobody\'s name. Here, the whole para knows when your grandfather has a cough.',
    'That is what home is. Not the house. The people who notice when the lamp is not lit.',
  ] },
  { id: 'stay', title: 'Will you stay?', hint: 'Bring the bari back to life', when: (s) => s.ended, pages: [
    'The fields are green, the pukur is full, and the neighbours stop me in the lane to say what a fine grandchild I have.',
    'I will not ask you to stay. Your life is yours. But whatever you choose, this bari will always have a place for you.',
    'Now, tell me again how the fish market in your city compares with Maharajganj. I like to hear how ours is better.',
  ] },
];
export const chapterById = (id: string): Chapter | undefined => CHAPTERS.find((c) => c.id === id);
/** The next story Grandpa is ready to tell, if any. */
export const nextChapter = (s: GameState): Chapter | undefined => CHAPTERS.find((c) => !s.chapters.includes(c.id) && c.when(s));
