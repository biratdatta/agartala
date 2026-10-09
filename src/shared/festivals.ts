/**
 * The festival calendar. Each year (48 game days, four days a month) the same feasts come round.
 * Garia, Kharchi and Durga Puja also have story missions; these are the yearly versions anyone can join.
 */
import { dayOfMonth, monthOf, yearOf } from './economy.js';
import type { GameState } from './save.js';

export type FestId = 'kharchiFair' | 'ker' | 'durga' | 'diwali' | 'sankranti';
export interface Festival {
  id: FestId; name: string; month: number; days: number[];
  /** What to do, shown on the HUD and the farm board. */
  how: string;
  /** Paid once a year for taking part. */
  reward: number;
}

export const FESTIVALS: Festival[] = [
  { id: 'kharchiFair', name: 'Kharchi Puja fair', month: 2, days: [1, 2, 3, 4], reward: 0,
    how: 'The seven-day fair is on in Old Agartala. Catch the fair bus at the Joynagar bus stop and try your luck at the stalls.' },
  { id: 'ker', name: 'Ker Puja', month: 3, days: [3], reward: 150,
    how: 'The city boundary is closed for the guardian deity: no tomtoms run from 06:00 to 18:00. Keep the Ker by joining the prayer at the shrine by the MBB Stadium gate.' },
  { id: 'durga', name: 'Durga Puja', month: 5, days: [2, 3, 4], reward: 100,
    how: 'The Modern Club pandal by the Shibnagar lakes is lit. Join the puja after 18:00.' },
  { id: 'diwali', name: 'Diwali', month: 6, days: [3, 4], reward: 80,
    how: 'Float a lamp on the Shibnagar lakes after dark (₹20 for a clay diya).' },
  { id: 'sankranti', name: 'Pous Sankranti', month: 8, days: [3, 4], reward: 200,
    how: 'Cook pitha in the kitchen at home (1 paddy and ₹10 of jaggery make 4) and give a plate to three neighbours.' },
];
export const festById = (id: string): Festival | undefined => FESTIVALS.find((f) => f.id === id);

/** Festivals on a given day. */
export const festivalsOn = (day: number): Festival[] => FESTIVALS.filter((f) => f.month === monthOf(day) && f.days.includes(dayOfMonth(day)));
export const isFestival = (day: number, id: FestId): boolean => festivalsOn(day).some((f) => f.id === id);
/** The key under which this year's festival is remembered as kept. */
export const festKey = (id: FestId, day: number): string => `${id}:${yearOf(day)}`;
export const kept = (s: GameState, id: FestId): boolean => s.fests.includes(festKey(id, s.day));
/** Ker Puja: no tomtoms between 06:00 and 18:00. */
export const kerClosed = (s: GameState): boolean => isFestival(s.day, 'ker') && s.hour >= 6 && s.hour < 18;
/** Pitha season: cooking and giving pitha counts in Poush and Magh. */
export const pithaSeason = (day: number): boolean => monthOf(day) === 8 || monthOf(day) === 9;
/** The next festival from a day on, and how many days away it is. */
export function nextFestival(day: number): { f: Festival; inDays: number } | null {
  for (let d = 0; d < 48; d++) { const f = festivalsOn(day + d)[0]; if (f) return { f, inDays: d }; }
  return null;
}
