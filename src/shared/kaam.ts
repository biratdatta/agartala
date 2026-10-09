/**
 * Kaam: small jobs neighbours across the city ask of you each day. Requests are derived from
 * the day number, so the browser and the server always agree on what is wanted and what it pays.
 */
import { ITEMS, type ItemKey } from './constants.js';
import { rnd2 } from './rng.js';

export interface Neighbour { id: string; name: string; role: string; para: string; lines: string[] }
export const NEIGHBOURS: Neighbour[] = [
  { id: 'nShiva', name: 'Tapan Debnath', role: 'Tea stall · Shiva Bari lane', para: 'near the Shiva temple, north of Radhanagar', lines: ['Cha khaben? Sit, sit. The kettle is always on.', 'Since the new flyover talk started, everyone is a town planner at my stall.'] },
  { id: 'nRadhanagar', name: 'Moumita Paul', role: 'Tailor · Radhanagar', para: 'in Radhanagar, by the bus terminus', lines: ['Puja orders already! I sleep after Lakshmi Puja, not before.', 'Your grandmother\'s rignai was the finest weaving I ever saw.'] },
  { id: 'nKrishnanagar', name: 'Bikash Reang', role: 'Carpenter · Krishnanagar', para: 'in Krishnanagar, west of the palace', lines: ['Bamboo is the best timber God made. Light, strong, and it grows back.', 'Hojagiri dancers balance on a pot. I can barely balance my accounts.'] },
  { id: 'nSupari', name: 'Anjali Sinha', role: 'Schoolteacher · Supari Bagan', para: 'in Supari Bagan, near Lake Chowmuhani', lines: ['My students want to go to Bengaluru. I tell them Agartala needs them too.', 'Manipuri ras lila at Kunjaban this year, you must come.'] },
  { id: 'nKadamtali', name: 'Habib Mia', role: 'Fruit seller · Kadamtali', para: 'at Kadamtali, south-west of the palace', lines: ['Queen pineapple from Tripura, the best in the world. Write that down.', 'The rains came early. Good for the paddy, bad for my umbrella business.'] },
  { id: 'nMelarmath', name: 'Purnima Saha', role: 'Sweet shop · Melarmath', para: 'by the Melarmath Kalibari, south-west', lines: ['Try the rasgulla. No, try two. Nobody leaves with one.', 'The Kalibari bell rings at dawn. Best alarm clock in Agartala.'] },
  { id: 'nKalibari', name: 'Ratan Majumder', role: 'Priest\'s helper · Kalibari', para: 'at the Kalibari, east of Jagannath Lake', lines: ['Kalibari Lake is older than my grandfather\'s grandfather.', 'During Diwali the whole lake is lamps. Bring your family.'] },
  { id: 'nMaharajganj', name: 'Sujit Das', role: 'Fish trader · Maharajganj Bazar', para: 'at Maharajganj Bazar, by the Haora river', lines: ['Rui, katla, ilish when we are lucky. The Haora gives what it gives.', 'The bazar wakes at four. By nine the best fish is gone.'] },
  { id: 'nAbhoynagar', name: 'Lalit Tripura', role: 'Mechanic · Abhoynagar', para: 'in Abhoynagar, north-east', lines: ['Tomtom batteries, I fix them all. The drivers call me doctor.', 'Garia Puja, Ker Puja, Kharchi Puja. We Tripuris never run short of festivals.'] },
  { id: 'nBhati', name: 'Shefali Debbarma', role: 'Weaver · Bhati Abhoynagar', para: 'in Bhati Abhoynagar, south of your fields', lines: ['Your grandfather used to carry my loom on his head when we were children.', 'Risa, rignai, rikutu. Learn the words, city child.'] },
];
export const neighbourById = (id: string): Neighbour | undefined => NEIGHBOURS.find((n) => n.id === id);

export interface Kaam { id: string; npc: string; item: ItemKey; qty: number; reward: number; why: string }
const WANTS: [ItemKey, number, number, string][] = [
  ['paddy', 1, 3, 'for the household rice'], ['pineapple', 1, 3, 'for guests coming from Udaipur'], ['jackfruit', 1, 2, 'to make kathal curry'],
  ['bamboo', 1, 3, 'to mend the fence'], ['sheet', 1, 2, 'to sell on to a trader in Dharmanagar'], ['pineapple', 2, 4, 'for the puja prasad'], ['paddy', 2, 4, 'to make muri for the winter'],
];

/** The jobs on offer on a given day (five neighbours ask). */
export function dailyKaam(day: number): Kaam[] {
  const used = new Set<number>(); const out: Kaam[] = [];
  for (let k = 0; out.length < 5 && k < 40; k++) {
    const ni = Math.floor(rnd2(day * 1.7, k * 3.3 + 11) * NEIGHBOURS.length); if (used.has(ni)) continue; used.add(ni);
    const w = WANTS[Math.floor(rnd2(day * 2.9, k * 5.1 + 3) * WANTS.length)];
    const qty = w[1] + Math.floor(rnd2(day, k + 7) * (w[2] - w[1] + 1));
    const reward = Math.round((qty * ITEMS[w[0]].base * 1.6 + 20) / 5) * 5;
    out.push({ id: `${day}:${NEIGHBOURS[ni].id}`, npc: NEIGHBOURS[ni].id, item: w[0], qty, reward, why: w[3] });
  }
  return out;
}
