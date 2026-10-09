/**
 * More to do around the paras: parcels to carry between neighbours, and sights to see.
 * Like kaam, deliveries come from the day number so the browser and server agree on them.
 */
import { NEIGHBOURS } from './kaam.js';
import { rnd2 } from './rng.js';
import { SPOTS } from './spots.js';

const PARCELS = ['a tiffin box', 'a sack of rice', 'a sari parcel from the tailor', 'medicine from the chemist', 'a letter', 'puja flowers', 'a radio back from repair', 'a box of rasgulla', 'school books', 'a new gamcha'];
export interface Delivery { id: string; from: string; to: string; parcel: string; reward: number; km: number }

const spot = (id: string): readonly [number, number] => (SPOTS as Record<string, readonly [number, number]>)[id] || [0, 0];

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
export const SIGHTS: Sight[] = [
  { id: 'stadium', name: 'Maharaja Bir Bikram Stadium', x: 1436, z: 975, lore: 'Agartala\'s big ground, named for the last ruling Maharaja of Tripura. Cricket, football and the Republic Day parade all happen on this grass.' },
  { id: 'shivmandir', name: 'Modern Club Shiv Mandir', x: 905, z: 1040, lore: 'The little Shiva temple by Modern Club, at the edge of the Shibnagar lakes. Busy every Monday and all night at Shivaratri.' },
  { id: 'lakes', name: 'The Shibnagar lakes', x: 1180, z: 1095, lore: 'A chain of ponds and lakes between Modern Club and the stadium, ringed with paths. Morning walkers, evening couples, and fishermen at every hour.' },
  { id: 'modernclub', name: 'Modern Club', x: 920, z: 975, lore: 'One of Agartala\'s best-known puja clubs. Its Durga Puja pandal by the lakes draws crowds from across the city.' },
  { id: 'southlake', name: 'The lake south of the stadium', x: 1330, z: 1380, lore: 'A quieter lake behind the stadium, where the city thins out towards the river.' },
  { id: 'ghat', name: 'The Haora riverbank', x: 1720, z: 1330, lore: 'The Haora winds round the east of the city. In the dry months it is a gentle stream; in the monsoon it rises right up to the fields.' },
  { id: 'bridge', name: 'The Haora bridge', x: 1470, z: 1640, lore: 'The road south crosses the Haora here. Boys jump off it into the river all summer, while their mothers shout from the bank.' },
  { id: 'math', name: 'Math Chowmuhani', x: 845, z: 615, lore: 'A busy crossroads on the west side of the stadium paras, named for the old math (monastery) nearby. Shops, tea stalls and tomtoms all day.' },
  { id: 'stadiumpond', name: 'The stadium pond', x: 1570, z: 700, lore: 'A pond north of the stadium, where the groundsmen wash their mowers and the neighbourhood washes everything else.' },
  { id: 'polyclinic', name: 'The road to Joynagar', x: 1500, z: 400, lore: 'The main road along the north of the stadium paras, lined with clinics, pharmacies and sweet shops.' },
];
export const SIGHT_REWARD = 25;
export const sightById = (id: string): Sight | undefined => SIGHTS.find((s) => s.id === id);
