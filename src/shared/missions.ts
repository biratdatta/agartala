import { ownedLunga, type GameState, type Inventory } from './save.js';
import type { GameEvent } from './rules.js';
import { PANDAL_GOAL, pujoSeason } from './pujo.js';

export type MissionId = 'arrive' | 'home' | 'garia' | 'paddy' | 'sell' | 'pine' | 'rubber' | 'kharchi' | 'grow' | 'durga' | 'pujoPandals' | 'pujoAnjali' | 'pujoAarti' | 'pujoBisarjan';
export interface Mission {
  id: MissionId;
  title: string;
  text: string;
  progress?: (s: GameState) => string;
  done: (s: GameState) => boolean;
  reward: { money?: number } & Partial<Pick<Inventory, 'paddySeed' | 'sucker'>>;
  msg: string;
}

export const GROW_TARGET = 3000;

export const MISSIONS: Mission[] = [
  { id: 'arrive', title: 'Home to Agartala', text: 'You have flown home from {from}, {km} away. The airport cab has left you at the MBB Stadium gate. Take a tomtom from the stand to the Home stand in {home} (Grandpa has paid for your first ride).',
    done: (s) => !!s.flags.arrived, reward: {}, msg: 'Home at last. The lane smells of wet earth and woodsmoke.' },
  { id: 'home', title: 'Khulumkha, home', text: 'Grandpa Hemanta is waiting in the courtyard of your bari in {home}. Walk over and talk to him.',
    done: (s) => !!s.flags.metGrandpa, reward: { money: 150, paddySeed: 4 }, msg: '+₹150 and 4 pouches of paddy seed' },
  { id: 'garia', title: 'A pole for Garia Puja', text: 'Cut 5 culms from the bamboo clumps around the fields, then take them to Rina Jamatia at her loom, at the south end of the fields.',
    progress: (s) => `Bamboo ${Math.min(s.inv.bamboo, 5)} / 5`, done: (s) => !!s.flags.gariaDone, reward: { money: 200 }, msg: '+₹200 and Rina\'s rikutu. The para dances round the Garia pole this evening.' },
  { id: 'paddy', title: 'Dhan in the lunga', text: 'Till the lunga plots at the family fields by the Haora (there is a tomtom stand on their lane), sow paddy, and water them each day from the pukur. Harvest 4 plots. Crops only grow on days they are watered, unless it rains.',
    progress: (s) => `Paddy harvested ${Math.min(s.stats.harvest.paddy, 4)} / 4`, done: (s) => s.stats.harvest.paddy >= 4, reward: { money: 100 }, msg: '+₹100 from Grandpa, who is very proud' },
  { id: 'sell', title: 'Math Chowmuhani Bazar', text: 'Sell your paddy to Gopal Saha at Math Chowmuhani Bazar, about 1 km west past the stadium. Walk the lanes, or take a tomtom from the stand on your lane for ₹20.',
    done: (s) => (s.stats.sold.paddy || 0) >= 1, reward: { sucker: 6 }, msg: 'Gopal adds 6 Queen pineapple suckers from his cousin\'s tilla' },
  { id: 'pine', title: 'Queen of the tilla', text: 'Plant pineapple suckers on the terraced beds of the small tilla east of the paddy, water them, and harvest 4 beds.',
    progress: (s) => `Pineapple harvested ${Math.min(s.stats.harvest.pineapple, 4)} / 4`, done: (s) => s.stats.harvest.pineapple >= 4, reward: { money: 250 }, msg: '+₹250' },
  { id: 'rubber', title: 'White gold', text: 'Tap the rubber trees on the far tilla by the river between 05:00 and 11:00. Each tree gives one cup a day. Roll 3 cups into a sheet at the roller by the field shed. Make 3 sheets.',
    progress: (s) => `Sheets ${Math.min(s.stats.sheets, 3)} / 3 · latex ${s.inv.latex}`, done: (s) => s.stats.sheets >= 3, reward: { money: 300 }, msg: '+₹300' },
  { id: 'kharchi', title: 'Kharchi Puja', text: 'Kharchi Puja has begun at the Chaturdasha Devata Mandir in Old Agartala, 8 km east. Take 3 sacks of paddy and 2 pineapples to the bus stop at Joynagar and catch the bus.',
    progress: (s) => `Paddy ${Math.min(s.inv.paddy, 3)} / 3 · pineapple ${Math.min(s.inv.pineapple, 2)} / 2`, done: (s) => !!s.flags.kharchi, reward: { money: 500 }, msg: '+₹500 in gifts. Your crops now grow 20% faster.' },
  { id: 'grow', title: 'Grow the bari', text: 'Buy 2 more lunga plots from Gopal and save ₹3,000.',
    progress: (s) => `Lunga plots ${Math.min(ownedLunga(s), 8)} / 8 · ₹${s.money.toLocaleString('en-IN')} / ₹3,000`, done: (s) => ownedLunga(s) >= 8 && s.money >= GROW_TARGET, reward: {}, msg: 'The bari is growing' },
  { id: 'durga', title: 'Durga Puja at Modern Club', text: 'Durga Puja is on. After 18:00, go to the Modern Club pandal by College Lake and join the puja.',
    done: (s) => !!s.flags.durga, reward: {}, msg: 'Shubho Bijoya' },
];

/**
 * The Durga Puja chapter. During the real Puja season it comes straight after meeting Grandpa (or
 * interrupts wherever you are in the story), then the story carries on where it was.
 */
export const PUJO_MISSIONS: Mission[] = [
  { id: 'pujoPandals', title: 'Pujo in Agartala', text: 'Dhak are beating all over town: Durga Puja is here. Grandpa says it isn\'t Pujo until you\'ve seen Ma Durga in five pandals. Go pandal hopping: Durgabari by the palace, Modern Club, Shibnagar Mahila Puja Committee, Palace Compound, Kaman Chowmuhani, Paradise Chowmuhani, Joynagar and Ramnagar. Tomtoms run late all week.',
    progress: (s) => `Pandals ${Math.min(s.pandals.length, PANDAL_GOAL)} / ${PANDAL_GOAL}`, done: (s) => s.pandals.length >= PANDAL_GOAL, reward: { money: 200 }, msg: '+₹200 of Pujo money from Grandpa, for new clothes' },
  { id: 'pujoAnjali', title: 'Ashtami anjali at Durgabari', text: 'On Ashtami morning the whole city offers pushpanjali. Go to Durgabari, by Ujjayanta Palace, between 06:00 and 12:00, fast till then, and offer flowers to Ma with the priest.',
    done: (s) => !!s.flags.pujoAnjali, reward: { money: 150 }, msg: '+₹150. Grandma used to stand in exactly that spot, Grandpa says.' },
  { id: 'pujoAarti', title: 'Sandhya aarti at Modern Club', text: 'After 18:00, go to the Modern Club pandal by College Lake for the evening aarti. The dhakis play, the conch is blown, and everyone dances the dhunuchi naach with smoking clay dhunuchis.',
    done: (s) => !!s.flags.pujoAarti, reward: { money: 150 }, msg: '+₹150. Your eyes sting from the dhuno smoke and you are grinning.' },
  { id: 'pujoBisarjan', title: 'Bijoya Dashami', text: 'Ma goes home to Kailash today. After 15:00, follow the procession to the ghat on the Haora, east of the fields, and say goodbye. Then wish everyone Shubho Bijoya.',
    done: (s) => !!s.flags.pujoBisarjan, reward: { money: 300 }, msg: 'Shubho Bijoya! Asche bochor abar hobe: next year, again.' },
];
const PUJO_IDS = new Set(PUJO_MISSIONS.map((m) => m.id));
export const isPujoMission = (m: Mission | null): boolean => !!m && PUJO_IDS.has(m.id);
/** The Puja chapter's current step, if it's the season and you're home. */
export function pujoMission(s: GameState): Mission | null {
  // only once 'arrive' and 'home' are finished and paid (index 2 on), so their rewards are never skipped
  if (!pujoSeason(s.ts) || !s.flags.metGrandpa || s.mission < 2) return null;
  return PUJO_MISSIONS[Math.max(0, Math.floor(Number(s.flags.pujoDone) || 0))] || null;
}

/** Fills the hometown into a mission's text. */
export function missionText(text: string, s: GameState): string {
  const from = s.from || 'the city';
  const km = s.fromKm > 30 ? `${s.fromKm.toLocaleString('en-IN')} km` : 'a long way';
  return text.replace('{from}', from).replace('{km}', km).replace('{home}', s.home?.name || 'the fields by the Haora');
}

export const currentMission = (s: GameState): Mission | null => pujoMission(s) || MISSIONS[s.mission] || null;
export const missionIndex = (id: MissionId): number => MISSIONS.findIndex((m) => m.id === id);

/** Completes every mission whose condition now holds, in order, paying rewards. */
export function checkMissions(s: GameState, ev: GameEvent[]): void {
  for (let guard = 0; guard < MISSIONS.length + PUJO_MISSIONS.length; guard++) {
    const m = currentMission(s);
    if (!m || !m.done(s)) return;
    if (m.reward.money) s.money += m.reward.money;
    if (m.reward.paddySeed) s.inv.paddySeed += m.reward.paddySeed;
    if (m.reward.sucker) s.inv.sucker += m.reward.sucker;
    if (isPujoMission(m)) s.flags.pujoDone = (Number(s.flags.pujoDone) || 0) + 1; // the Puja chapter is kept in flags; the main story stays where it was
    else s.mission++;
    const next = currentMission(s);
    ev.push({ kind: 'mission', text: m.msg, title: m.title, next: next ? next.title : undefined });
    if (!next && !s.ended) { s.ended = true; ev.push({ kind: 'ending', text: 'The bari is alive again' }); }
  }
}
