import { CAN_SMALL, type CropKey } from './constants.js';
import { BAMBOO, JACK, LUNGA_COUNT, PLOTS, RUBBER, SPAWN, START_OWNED_LUNGA } from './farm.js';
import type { HomeSite } from './stands.js';

export const SAVE_VERSION = 4;

export interface PlotState { state: 'grass' | 'tilled'; crop: CropKey | null; growth: number; watered: boolean; owned: boolean }
export interface Inventory { paddySeed: number; sucker: number; water: number; paddy: number; pineapple: number; jackfruit: number; latex: number; sheet: number; bamboo: number }
export interface Flags { arrived?: boolean; freeRide?: boolean; metGrandpa?: boolean; gariaDone?: boolean; gariaDay?: number; shawl?: boolean; kharchi?: boolean; blessed?: boolean; durga?: boolean }
export interface Stats { harvest: { paddy: number; pineapple: number }; sold: Partial<Record<string, number>>; sheets: number; earned: number; rides: number; kaam: number; deliveries: number; sights: number }
/** A tomtom ride in progress. Real time inside [start, start + ms] counts as `hours` of game time in total. */
export interface Ride { from: string; to: string; start: number; ms: number; hours: number; done: number }

export interface GameState {
  v: number;
  name: string;
  /** Where the player came home from (from the login location, or chosen), and how far that is. */
  from: string;
  fromKm: number;
  day: number;
  hour: number;
  /** Real time (ms since epoch) up to which the game clock has been simulated. */
  ts: number;
  money: number;
  canMax: number;
  cycle: boolean;
  inv: Inventory;
  plots: PlotState[];
  trees: { tapped: number }[];
  bamboo: { ready: number }[];
  jack: { fruits: number }[];
  mission: number;
  flags: Flags;
  stats: Stats;
  rain: boolean;
  ended: boolean;
  ride: Ride | null;
  /** Ids of kaam already done (recent days only). */
  kaamDone: string[];
  /** Where the house is. null means at the family fields in Bhati Abhoynagar. */
  home: HomeSite | null;
  /** Parcel being carried (a delivery id), and deliveries finished recently. */
  carry: string | null;
  delivered: string[];
  /** Sights already visited. */
  visited: string[];
  /** Where the player stands. Reported by the client, never trusted by the rules. */
  pos: { x: number; z: number; face: number };
}

export function newState(now: number, name = '', from = '', fromKm = 0): GameState {
  return {
    v: SAVE_VERSION, name, from: sanitizePlace(from), fromKm: Math.round(Math.max(0, Math.min(20000, fromKm))),
    day: 1, hour: 6.5, ts: now, money: 100, canMax: CAN_SMALL, cycle: false,
    inv: { paddySeed: 0, sucker: 0, water: 0, paddy: 0, pineapple: 0, jackfruit: 0, latex: 0, sheet: 0, bamboo: 0 },
    plots: PLOTS.map((p, i) => ({ state: 'grass', crop: null, growth: 0, watered: false, owned: p.kind === 'tilla' || i < START_OWNED_LUNGA })),
    trees: RUBBER.map(() => ({ tapped: 0 })),
    bamboo: BAMBOO.map(() => ({ ready: 0 })),
    jack: JACK.map(() => ({ fruits: 2 })),
    mission: 0, flags: { freeRide: true }, stats: { harvest: { paddy: 0, pineapple: 0 }, sold: {}, sheets: 0, earned: 0, rides: 0, kaam: 0, deliveries: 0, sights: 0 },
    rain: false, ended: false, ride: null, kaamDone: [], home: null, carry: null, delivered: [], visited: [], pos: { x: SPAWN.x, z: SPAWN.z, face: SPAWN.face },
  };
}

const num = (v: unknown, d: number, lo = -Infinity, hi = Infinity): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** Brings any stored save up to the current shape, filling gaps with defaults. */
export function normalize(raw: unknown, now: number): GameState {
  const base = newState(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<GameState>;
  const s: GameState = { ...base, ...r, v: SAVE_VERSION } as GameState;
  // saves from before the arrival story begin with the arrival already done
  if (typeof r.v === 'number' && r.v < 4) { s.mission = num(r.mission, 0, 0, 99) + 1; s.flags = { ...(r.flags || {}), arrived: true }; }
  else s.flags = { ...(r.flags || {}) };
  s.day = num(r.day, 1, 1); s.hour = num(r.hour, 6.5, 0, 23.999); s.ts = num(r.ts, now, 0); s.money = Math.round(num(r.money, 100, 0));
  s.canMax = r.canMax === 16 ? 16 : CAN_SMALL; s.cycle = !!r.cycle; if (!(typeof r.v === 'number' && r.v < 4)) s.mission = Math.round(num(r.mission, 0, 0, 99));
  s.inv = { ...base.inv, ...(r.inv || {}) };
  for (const k of Object.keys(base.inv) as (keyof Inventory)[]) s.inv[k] = Math.round(num(s.inv[k], 0, 0));
  s.plots = base.plots.map((p, i) => ({ ...p, ...((r.plots || [])[i] || {}) }));
  s.trees = base.trees.map((t, i) => ({ ...t, ...((r.trees || [])[i] || {}) }));
  s.bamboo = base.bamboo.map((t, i) => ({ ...t, ...((r.bamboo || [])[i] || {}) }));
  s.jack = base.jack.map((t, i) => ({ ...t, ...((r.jack || [])[i] || {}) }));
  s.stats = { ...base.stats, ...(r.stats || {}), harvest: { ...base.stats.harvest, ...(r.stats?.harvest || {}) }, sold: { ...(r.stats?.sold || {}) } };
  s.pos = { ...base.pos, ...(r.pos || {}) };
  s.name = sanitizeName(r.name || ''); s.from = sanitizePlace(r.from || ''); s.fromKm = Math.round(num(r.fromKm, 0, 0, 20000));
  s.kaamDone = Array.isArray(r.kaamDone) ? r.kaamDone.filter((x) => typeof x === 'string').slice(-30) : [];
  s.home = normalizeHome(r.home);
  s.carry = typeof r.carry === 'string' ? r.carry : null;
  s.delivered = Array.isArray(r.delivered) ? r.delivered.filter((x) => typeof x === 'string').slice(-30) : [];
  s.visited = Array.isArray(r.visited) ? [...new Set(r.visited.filter((x) => typeof x === 'string'))].slice(0, 50) : [];
  const rd = r.ride; s.ride = rd && typeof rd === 'object' && typeof rd.to === 'string' ? { from: String(rd.from), to: rd.to, start: num(rd.start, now), ms: num(rd.ms, 30000, 1000, 120000), hours: num(rd.hours, 0.2, 0, 3), done: num(rd.done, 0, 0, 3) } : null;
  return s;
}

const inMap = (x: unknown, z: unknown) => typeof x === 'number' && typeof z === 'number' && Number.isFinite(x) && Number.isFinite(z) && x > -2080 && x < 2080 && z > -2030 && z < 2430;
/** A home site from the client: cosmetic (it moves the house), so it only has to be inside the map. */
export function normalizeHome(h: unknown): HomeSite | null {
  if (!h || typeof h !== 'object') return null;
  const o = h as Partial<HomeSite>;
  if (!inMap(o.x, o.z) || !inMap(o.sx, o.sz)) return null;
  const name = sanitizePlace(String(o.name || '')); if (name.length < 2) return null;
  return { name, x: o.x!, z: o.z!, sx: o.sx!, sz: o.sz!, face: typeof o.face === 'number' && Number.isFinite(o.face) ? o.face : 0 };
}

/** Display names for the leaderboard: letters, digits, spaces and a little punctuation, up to 24 characters. */
export function sanitizeName(n: string): string {
  return String(n).normalize('NFC').replace(/[^\p{L}\p{M}\p{N} .'_-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}
/** Hometown: same rules, up to 40 characters. */
export function sanitizePlace(n: string): string {
  return String(n).normalize('NFC').replace(/[^\p{L}\p{M}\p{N} .,'()-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

export const ownedLunga = (s: GameState): number => s.plots.slice(0, LUNGA_COUNT).filter((p) => p.owned).length;
export const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s)) as GameState;
