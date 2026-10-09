/**
 * Day trips by bus from the Joynagar bus stop to places beyond the map. Each costs a fare and
 * some hours, and the first visit is a story chapter of its own.
 */
import type { GameState } from './save.js';

export type TripId = 'neermahal' | 'sundari' | 'akhaura' | 'haat';
export interface Trip {
  id: TripId; name: string; where: string; km: number; fare: number; hours: number;
  /** Game hours the bus leaves; outside them the trip is not running. */
  from: number; until: number;
  /** Days between visits (0 = any time). */
  every: number;
  /** Only on these days (day % 7). Undefined = every day. */
  weekday?: number;
  blurb: string;
  /** What the guide, priest or trader says when you arrive. */
  pages: string[];
}

export const TRIPS: Trip[] = [
  { id: 'neermahal', name: 'Neermahal', where: 'Rudrasagar Lake, Melaghar', km: 53, fare: 80, hours: 8, from: 6, until: 12, every: 0,
    blurb: 'The royal water palace in the middle of Rudrasagar Lake. A boat takes you across. A day off: you come back rested.',
    pages: [
      'The boatman pushes off from the ghat at Melaghar. Rudrasagar Lake is wide and still, and in the middle of it the palace seems to float.',
      'Maharaja Bir Bikram Kishore Manikya had Neermahal built as a summer palace. It was finished in 1938, half Hindu and half Mughal in style, with gardens on the water.',
      'You walk the empty rooms and the terraces where the royal family once watched boat races. On the way back the boatman sings.',
    ] },
  { id: 'sundari', name: 'Tripura Sundari temple', where: 'Matabari, Udaipur', km: 55, fare: 70, hours: 7, from: 5, until: 14, every: 12,
    blurb: 'One of the 51 Shakti Peethas, on a small hill shaped like a tortoise. The blessing makes crops grow faster for four days.',
    pages: [
      'The temple at Matabari sits on a hump of hill that people say is shaped like a tortoise, so it is called the Kurma Peetha.',
      'Maharaja Dhanya Manikya built it in 1501. Below it is Kalyan Sagar, a lake full of old fish and turtles that the priests feed.',
      'You queue with families from all over Tripura, offer flowers and take the famous peda as prasad. The priest ties a red thread round your wrist.',
    ] },
  { id: 'akhaura', name: 'Akhaura border retreat', where: 'Agartala–Akhaura checkpost', km: 4, fare: 20, hours: 2, from: 15, until: 17.5, every: 0,
    blurb: 'At sunset the BSF and Border Guard Bangladesh lower their flags together at the border just west of the city.',
    pages: [
      'The checkpost is only a few kilometres west of the palace. Bangladesh is right there: the same trees, the same paddy, another country.',
      'At sunset the BSF and the Border Guard Bangladesh march, stamp and lower their flags in step, while crowds on both sides cheer.',
      'An old man next to you says he walked this road the other way in 1971. He does not say more, and you do not ask.',
    ] },
  { id: 'haat', name: 'Kamalasagar border haat', where: 'Kamalasagar, Sepahijala', km: 27, fare: 50, hours: 5, from: 6, until: 12, every: 0, weekday: 2,
    blurb: 'Once a week, traders from both sides of the border meet at the haat below the Kamalasagar Kali temple. They pay well above city rates for fruit, fish, tea and crafts.',
    pages: [
      'The haat is a fenced ground right on the border, under the hill of the Kamalasagar Kali temple. Indian sellers on one side, Bangladeshi sellers on the other, and buyers from both walking between them.',
      'Your stall is a gunny sack on the ground. A trader from Kasba buys your goods without much bargaining: things fetch more on the other side.',
    ] },
];
export const tripById = (id: string): Trip | undefined => TRIPS.find((t) => t.id === id);

/** Whether a trip can be taken now, or why not. */
export function tripOpen(s: GameState, t: Trip): string | null {
  if (t.weekday !== undefined && s.day % 7 !== t.weekday) return `The haat meets once a week · next on day ${s.day + ((t.weekday - (s.day % 7) + 7) % 7 || 7)}`;
  if (s.hour < t.from || s.hour >= t.until) return `The bus for ${t.name} leaves between ${hh(t.from)} and ${hh(t.until)}`;
  if (t.every) { const last = lastTrip(s, t.id); if (last && s.day - last < t.every) return `You went on day ${last} · come back after day ${last + t.every - 1}`; }
  if (s.money < t.fare) return `The fare is ₹${t.fare}`;
  return null;
}
export const lastTrip = (s: GameState, id: TripId): number => { const e = s.trips.filter((x) => x.startsWith(id + ':')).pop(); return e ? Number(e.split(':')[1]) : 0; };
export const tripSeen = (s: GameState, id: TripId): boolean => s.trips.includes(id);
const hh = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
