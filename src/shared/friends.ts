/**
 * Friendship with neighbours, the invitations close friends send, and the phrasebook you pick up
 * by talking to people. Everything here derives from the save and the day number, so the server
 * and browser agree.
 */
import { NEIGHBOURS } from './kaam.js';
import { rnd2 } from './rng.js';
import type { GameState } from './save.js';

export const FRIEND_AT = 30, CLOSE_AT = 70;
export const friendship = (s: GameState, id: string): number => s.friends[id] || 0;
export const friendLevel = (pts: number): 0 | 1 | 2 | 3 => (pts >= CLOSE_AT ? 3 : pts >= FRIEND_AT ? 2 : pts >= 8 ? 1 : 0);
export const LEVEL_NAMES = ['Stranger', 'Knows you', 'Friend', 'Close friend'] as const;
/** Friends pay a little more for kaam. */
export const kaamBonus = (pts: number): number => (pts >= CLOSE_AT ? 1.25 : pts >= FRIEND_AT ? 1.1 : 1);
export function befriend(s: GameState, id: string, n: number): void { s.friends[id] = Math.min(100, (s.friends[id] || 0) + n); }

/** A display name for anyone you can talk to. */
export const neighbourName = (id: string): string => (id === 'grandpa' ? 'Grandpa Hemanta' : id === 'rina' ? 'Rina Jamatia' : NEIGHBOURS.find((n) => n.id === id)?.name || id);
/** People you can befriend: the ten neighbours plus Rina. */
export const FRIENDABLE = [...NEIGHBOURS.map((n) => n.id), 'rina'];

export interface Invite { npc: string; what: string; gift: { money: number; energy: number } }
const EVENTS = [
  { what: 'a wedding', money: 0, energy: 60 },
  { what: 'a birthday feast', money: 60, energy: 40 },
  { what: 'a Lakshmi Puja at home', money: 40, energy: 30 },
  { what: 'an evening of adda and singing', money: 0, energy: 35 },
  { what: 'a housewarming', money: 80, energy: 30 },
];
/** Today's invitation, if a friend has one: at most one a day, after 18:00 at their place. */
export function inviteToday(s: GameState): Invite | null {
  const friends = NEIGHBOURS.filter((n) => friendship(s, n.id) >= FRIEND_AT);
  if (!friends.length || rnd2(s.day * 2.3, 61.7) > 0.35) return null;
  const n = friends[Math.floor(rnd2(s.day, 13.9) * friends.length)];
  const e = EVENTS[Math.floor(rnd2(s.day * 1.1, 7.3) * EVENTS.length)];
  return { npc: n.id, what: e.what, gift: { money: e.money, energy: e.energy } };
}
export const INVITE_FROM = 18, INVITE_UNTIL = 23.5;

export interface Phrase { id: string; lang: 'Kokborok' | 'Bangla'; text: string; means: string; from: string }
/** Who teaches what. Kokborok phrases come from Tripuri neighbours, Bangla from Bengali ones. */
export const PHRASES: Phrase[] = [
  { id: 'khulumkha', lang: 'Kokborok', text: 'Khulumkha', means: 'Greetings, welcome', from: 'grandpa' },
  { id: 'phungkaham', lang: 'Kokborok', text: 'Phung kaham', means: 'Good morning', from: 'grandpa' },
  { id: 'hambai', lang: 'Kokborok', text: 'Hambai', means: 'Thank you', from: 'rina' },
  { id: 'bahaitong', lang: 'Kokborok', text: 'Nwng bahai tong?', means: 'How are you?', from: 'rina' },
  { id: 'kahamano', lang: 'Kokborok', text: 'Ang kahama no', means: 'I am fine', from: 'nBhati' },
  { id: 'bumung', lang: 'Kokborok', text: 'Nini bumung tamo?', means: 'What is your name?', from: 'nBhati' },
  { id: 'bwswk', lang: 'Kokborok', text: 'Bwswk?', means: 'How much?', from: 'nAbhoynagar' },
  { id: 'phaijadi', lang: 'Kokborok', text: 'Phaija di', means: 'Please come', from: 'nAbhoynagar' },
  { id: 'kiching', lang: 'Kokborok', text: 'Kiching', means: 'Friend', from: 'nKrishnanagar' },
  { id: 'naithok', lang: 'Kokborok', text: 'Naithok', means: 'Beautiful', from: 'nKrishnanagar' },
  { id: 'malai', lang: 'Kokborok', text: 'Malai phiwanw', means: 'See you again', from: 'rina' },
  { id: 'horkaham', lang: 'Kokborok', text: 'Hor kaham', means: 'Good night', from: 'grandpa' },
  { id: 'kemon', lang: 'Bangla', text: 'Kemon achen?', means: 'How are you?', from: 'nShiva' },
  { id: 'chakhaben', lang: 'Bangla', text: 'Cha khaben?', means: 'Will you have tea?', from: 'nShiva' },
  { id: 'kotodam', lang: 'Bangla', text: 'Koto daam?', means: 'How much is it?', from: 'nKadamtali' },
  { id: 'kom', lang: 'Bangla', text: 'Ektu kom korun', means: 'Bring the price down a bit', from: 'nKadamtali' },
  { id: 'dhonnobad', lang: 'Bangla', text: 'Dhonnobad', means: 'Thank you', from: 'nSupari' },
  { id: 'abar', lang: 'Bangla', text: 'Abar dekha hobe', means: 'We will meet again', from: 'nSupari' },
  { id: 'mishti', lang: 'Bangla', text: 'Mishti mukh korun', means: 'Have something sweet', from: 'nMelarmath' },
  { id: 'jol', lang: 'Bangla', text: 'Ektu jol deben?', means: 'Could I have some water?', from: 'nRadhanagar' },
  { id: 'bhalo', lang: 'Bangla', text: 'Bhalo achi', means: 'I am well', from: 'nRadhanagar' },
  { id: 'maachh', lang: 'Bangla', text: 'Aaj ki maachh?', means: 'What fish today?', from: 'nMaharajganj' },
  { id: 'shubho', lang: 'Bangla', text: 'Shubho Bijoya', means: 'Greetings after Durga Puja', from: 'nKalibari' },
  { id: 'jai', lang: 'Bangla', text: 'Jai Ma', means: 'Praise the Mother', from: 'nKalibari' },
];
export const PHRASE_REWARD = 10;
/** The next phrase this person can teach you, if any. */
export const nextPhrase = (s: GameState, from: string): Phrase | undefined => PHRASES.find((p) => p.from === from && !s.phrases.includes(p.id));
export const phraseById = (id: string): Phrase | undefined => PHRASES.find((p) => p.id === id);
