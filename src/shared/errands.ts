/**
 * More to do around the city: parcels to carry between neighbours, and sights to see.
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
  { id: 'palace', name: 'Ujjayanta Palace', x: 40, z: -24, lore: 'Built in 1901 by Maharaja Radha Kishore Manikya, the palace is now the Tripura State Museum. Its Mughal gardens look over two large lakes.' },
  { id: 'jagannath', name: 'Jagannath Bari', x: -212, z: 65, lore: 'The Jagannath temple stands beside its lake, a short walk from the palace gates.' },
  { id: 'kalibari', name: 'Kalibari Lake', x: 92, z: 155, lore: 'The second of the palace lakes. At Diwali the water is covered with floating lamps.' },
  { id: 'laxmi', name: 'Laxminarayan Bari', x: 94.5, z: 272, lore: 'A temple to Lakshmi-Narayan close to the palace, busy every evening at aarti.' },
  { id: 'rabindra', name: 'Rabindra Shatabarshiki Bhawan', x: -186, z: 316, lore: 'The city\'s big auditorium, named for Tagore\'s birth centenary. Tagore visited Tripura several times and was close to its royal family.' },
  { id: 'umakanta', name: 'Umakanta Academy', x: -734.5, z: 557.5, lore: 'One of the oldest schools in Tripura, from the time of the Maharajas. Half of Agartala\'s grandparents studied here.' },
  { id: 'library', name: 'Birchandra State Central Library', x: -1139.5, z: 597, lore: 'Named for Maharaja Bir Chandra Manikya, a poet, painter and patron of the arts.' },
  { id: 'melarmath', name: 'Melarmath Kalibari', x: -998.5, z: 834.5, lore: 'A crowded Kali temple in Melarmath. The sweet shops around it never close.' },
  { id: 'maharajganj', name: 'Maharajganj Bazar', x: 250.5, z: 1255, lore: 'The old market by the Haora river. Fish at dawn, vegetables by nine, gossip all day.' },
  { id: 'stadium', name: 'Maharaja Bir Bikram Stadium', x: 1374, z: 932, lore: 'The city\'s stadium. On match days you can hear the crowd from Battala.' },
  { id: 'kanan', name: 'Rabindra Kanan', x: 111, z: -1666, lore: 'A green park beside Circuit House, shady and quiet in the afternoons.' },
  { id: 'heritage', name: 'Heritage Park', x: 198, z: -1958, lore: 'A park of small models of Tripura\'s monuments: Unakoti\'s rock carvings, Neermahal, the Tripura Sundari temple.' },
];
export const SIGHT_REWARD = 25;
export const sightById = (id: string): Sight | undefined => SIGHTS.find((s) => s.id === id);
