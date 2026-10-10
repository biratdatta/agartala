/**
 * More to do around the paras: parcels to carry between neighbours, and sights to see.
 * Like kaam, deliveries come from the day number so the browser and server agree on them.
 */
import { NEIGHBOURS } from './kaam.js';
import { rnd2 } from './rng.js';
import { SPOTS } from './spots.js';
import { placeById } from './places.js';

const PARCELS = ['a tiffin box', 'a sack of rice', 'a sari parcel from the tailor', 'medicine from the chemist', 'a letter', 'puja flowers', 'a radio back from repair', 'a box of rasgulla', 'school books', 'a new gamcha'];
export interface Delivery { id: string; from: string; to: string; parcel: string; reward: number; km: number }

const spot = (id: string): readonly [number, number] => { const v = (SPOTS as Record<string, readonly number[]>)[id]; return v ? [v[0], v[1]] : [0, 0]; };

/** Three parcels a day, each from one neighbour to another across town. */
export function dailyDeliveries(day: number): Delivery[] {
  const out: Delivery[] = []; const used = new Set<string>();
  for (let k = 0; out.length < 3 && k < 40; k++) {
    const a = NEIGHBOURS[Math.floor(rnd2(day * 4.3, k * 2.1 + 5) * NEIGHBOURS.length)], b = NEIGHBOURS[Math.floor(rnd2(day * 6.7, k * 3.7 + 9) * NEIGHBOURS.length)];
    if (a.id === b.id || used.has(a.id) || used.has(b.id)) continue; used.add(a.id); used.add(b.id);
    const [ax, az] = spot(a.id), [bx, bz] = spot(b.id); const km = Math.hypot(ax - bx, az - bz) / 1000;
    out.push({ id: `${day}:${a.id}>${b.id}`, from: a.id, to: b.id, parcel: PARCELS[Math.floor(rnd2(day, k * 1.3 + 2) * PARCELS.length)], reward: Math.round((40 + km * 70) / 5) * 5, km });
  }
  return out;
}
export function deliveryById(id: string): Delivery | undefined {
  const day = Number(id.split(':')[0]); if (!Number.isInteger(day) || day < 1) return undefined;
  return dailyDeliveries(day).find((d) => d.id === id);
}

export interface Sight { id: string; name: string; x: number; z: number; lore: string }
/** Places worth seeing, at their real map positions. The first visit to each pays a little. */
const SIGHT_IDS = ['stadium', 'mbbcollege', 'lakes', 'collegelake', 'shivmandir', 'modernclub', 'lawcollege', 'mgschool', 'palace', 'townhall', 'motorstand', 'prm', 'citycentre'];
export const SIGHTS: Sight[] = [
  ...SIGHT_IDS.map((id) => { const p = placeById(id)!; return { id, name: p.name, x: p.x, z: p.z, lore: p.lore }; }),
  { id: 'ghat', name: 'The Haora riverbank', x: 1720, z: 1330, lore: 'The Haora winds round the east of the city. In the dry months it is a gentle stream; in the monsoon it rises right up to the fields.' },
  { id: 'bridge', name: 'The Haora bridge', x: 1470, z: 1640, lore: 'The road south crosses the Haora here. Boys jump off it into the river all summer, while their mothers shout from the bank.' },
  { id: 'math', name: 'Math Chowmuhani', x: 845, z: 615, lore: 'A busy crossroads on the west side of the stadium paras. Shops, tea stalls and tomtoms all day.' },
];
export const SIGHT_REWARD = 25;
export const sightById = (id: string): Sight | undefined => SIGHTS.find((s) => s.id === id);
