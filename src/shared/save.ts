import { CAN_SMALL, ENERGY_MAX, ITEMS, type CropKey, type ItemKey } from './constants.js';
import { AGAR, BAMBOO, JACK, LUNGA_COUNT, PLOTS, RUBBER, SPAWN, START_OWNED_LUNGA, TEA } from './farm.js';
import { STAND_KEYS, type HomeSite, type StandKey } from './stands.js';
import { inArea } from './area.js';
import { VEHICLES, type VehKey } from './vehicles.js';

export const SAVE_VERSION = 6;

export interface PlotState { state: 'grass' | 'tilled'; crop: CropKey | null; growth: number; watered: boolean; owned: boolean }
export interface Inventory { paddySeed: number; sucker: number; water: number; paddy: number; pineapple: number; jackfruit: number; latex: number; sheet: number; bamboo: number; tea: number; agar: number; fish: number; basket: number; pitha: number; teaSapling: number; agarSapling: number; fingerling: number }
export interface Flags { arrived?: boolean; freeRide?: boolean; metGrandpa?: boolean; gariaDone?: boolean; gariaDay?: number; shawl?: boolean; kharchi?: boolean; blessed?: boolean; durga?: boolean; sawFlood?: boolean }
export interface Stats { harvest: { paddy: number; pineapple: number }; sold: Partial<Record<string, number>>; sheets: number; earned: number; rides: number; kaam: number; deliveries: number; sights: number; meals: number; baskets: number; fish: number; tea: number; trips: number; festivals: number; helped: number }
/** This real-world week's tallies, for the weekly boards. `id` is an ISO week like 2026-W41. */
export interface Week { id: string; paddy: number; deliveries: number; kaam: number; sights: number; earned: number }
/** A perennial: planted (or not) and game hours grown; `picked` is the last day it was plucked. */
export interface Perennial { planted: boolean; growth: number; picked: number }
/** Messages left by other players (a gift, a friend watering your crops). */
export interface Note { t: number; text: string }
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
  /** Where the house is. null means at the family fields by the Haora. */
  home: HomeSite | null;
  /** Parcel being carried (a delivery id), and deliveries finished recently. */
  carry: string | null;
  delivered: string[];
  /** Sights already visited. */
  visited: string[];
  /** Where the player stands. Reported by the client, never trusted by the rules. */
  pos: { x: number; z: number; face: number };
  /** 0..100. Work tires you; food, rest and sleep bring it back. */
  energy: number;
  /** Lunga under monsoon floodwater today. */
  flood: boolean;
  /** Your own recent selling, per item, which pushes Gopal's rate down for a while. */
  market: Partial<Record<ItemKey, number>>;
  scooter: boolean; pump: boolean; coldStore: boolean;
  /** Last day the pump was run, and the last day a hired hand works (0 = none). */
  pumpDay: number; helperUntil: number;
  tea: Perennial[];
  agar: Perennial[];
  /** The pukur: stocked with fingerlings, and how long they have grown. */
  pond: { stocked: boolean; growth: number };
  /** Crops grow faster until this day (the Tripura Sundari blessing). */
  boostUntil: number;
  /** Friendship with each neighbour, 0..100. */
  friends: Record<string, number>;
  /** Talks today (`day:npc`), so each neighbour counts once a day. */
  chats: string[];
  /** Kokborok and Bangla phrases learned. */
  phrases: string[];
  /** Grandpa's stories already told. */
  chapters: string[];
  /** Festivals kept, as `id:year`. */
  fests: string[];
  /** Pitha given this year (`year:npc`). */
  pithaGiven: string[];
  /** Trips taken: `id` the first time, `id:day` for the last one. */
  trips: string[];
  /** Invitations attended (`day:npc`). */
  attended: string[];
  week: Week;
  inbox: Note[];
  /** Vehicles you own (see vehicles.ts). Grandpa's cycle-rickshaw comes with the bari. */
  garage: VehKey[];
  /** Passenger fares carried today, and when the last one was paid (real ms). */
  fares: { day: number; n: number; last: number };
}

export function newState(now: number, name = '', from = '', fromKm = 0): GameState {
  return {
    v: SAVE_VERSION, name, from: sanitizePlace(from), fromKm: Math.round(Math.max(0, Math.min(20000, fromKm))),
    day: 1, hour: 6.5, ts: now, money: 100, canMax: CAN_SMALL, cycle: false,
    inv: { paddySeed: 0, sucker: 0, water: 0, paddy: 0, pineapple: 0, jackfruit: 0, latex: 0, sheet: 0, bamboo: 0, tea: 0, agar: 0, fish: 0, basket: 0, pitha: 0, teaSapling: 0, agarSapling: 0, fingerling: 0 },
    plots: PLOTS.map((p, i) => ({ state: 'grass', crop: null, growth: 0, watered: false, owned: p.kind === 'tilla' || i < START_OWNED_LUNGA })),
    trees: RUBBER.map(() => ({ tapped: 0 })),
    bamboo: BAMBOO.map(() => ({ ready: 0 })),
    jack: JACK.map(() => ({ fruits: 2 })),
    mission: 0, flags: { freeRide: true }, stats: { harvest: { paddy: 0, pineapple: 0 }, sold: {}, sheets: 0, earned: 0, rides: 0, kaam: 0, deliveries: 0, sights: 0, meals: 0, baskets: 0, fish: 0, tea: 0, trips: 0, festivals: 0, helped: 0 },
    rain: false, ended: false, ride: null, kaamDone: [], home: null, carry: null, delivered: [], visited: [], pos: { x: SPAWN.x, z: SPAWN.z, face: SPAWN.face },
    energy: ENERGY_MAX, flood: false, market: {}, scooter: false, pump: false, coldStore: false, pumpDay: 0, helperUntil: 0,
    tea: TEA.map(() => ({ planted: false, growth: 0, picked: 0 })), agar: AGAR.map(() => ({ planted: false, growth: 0, picked: 0 })),
    pond: { stocked: false, growth: 0 }, boostUntil: 0, friends: {}, chats: [], phrases: [], chapters: [], fests: [], pithaGiven: [], trips: [], attended: [],
    week: { id: '', paddy: 0, deliveries: 0, kaam: 0, sights: 0, earned: 0 }, inbox: [],
    garage: ['rickshaw'], fares: { day: 0, n: 0, last: 0 },
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
  // version 6 moved the game to the paras round MBB Stadium: anyone standing in the old city starts at the stadium gate
  if (!inArea(s.pos.x, s.pos.z, 20)) s.pos = { ...base.pos };
  s.name = sanitizeName(r.name || ''); s.from = sanitizePlace(r.from || ''); s.fromKm = Math.round(num(r.fromKm, 0, 0, 20000));
  s.kaamDone = Array.isArray(r.kaamDone) ? r.kaamDone.filter((x) => typeof x === 'string').slice(-30) : [];
  s.home = normalizeHome(r.home);
  s.carry = typeof r.carry === 'string' ? r.carry : null;
  s.delivered = Array.isArray(r.delivered) ? r.delivered.filter((x) => typeof x === 'string').slice(-30) : [];
  s.visited = Array.isArray(r.visited) ? [...new Set(r.visited.filter((x) => typeof x === 'string'))].slice(0, 50) : [];
  s.energy = num(r.energy, ENERGY_MAX, 0, ENERGY_MAX); s.flood = !!r.flood;
  s.market = {}; for (const k of Object.keys(ITEMS) as ItemKey[]) { const v = num(r.market?.[k], 0, 0, 999); if (v > 0) s.market[k] = v; }
  s.scooter = !!r.scooter; s.pump = !!r.pump; s.coldStore = !!r.coldStore; s.pumpDay = num(r.pumpDay, 0, 0); s.helperUntil = num(r.helperUntil, 0, 0); s.boostUntil = num(r.boostUntil, 0, 0);
  const per = (list: Perennial[], raw: unknown) => list.map((t, i) => { const o = (Array.isArray(raw) ? raw[i] : null) as Partial<Perennial> | null; return o ? { planted: !!o.planted, growth: num(o.growth, 0, 0, 1e5), picked: num(o.picked, 0, 0) } : t; });
  s.tea = per(base.tea, r.tea); s.agar = per(base.agar, r.agar);
  s.pond = { stocked: !!r.pond?.stocked, growth: num(r.pond?.growth, 0, 0, 1e4) };
  s.friends = {}; if (r.friends && typeof r.friends === 'object') for (const [k, v] of Object.entries(r.friends)) if (/^[a-zA-Z]{2,20}$/.test(k)) s.friends[k] = num(v, 0, 0, 100);
  const strs = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length < 60))].slice(-max) : []);
  s.chats = strs(r.chats, 40); s.phrases = strs(r.phrases, 60); s.chapters = strs(r.chapters, 40); s.fests = strs(r.fests, 60); s.pithaGiven = strs(r.pithaGiven, 40); s.trips = strs(r.trips, 40); s.attended = strs(r.attended, 40);
  const w = (r.week || {}) as Partial<Week>; s.week = { id: typeof w.id === 'string' ? w.id.slice(0, 10) : '', paddy: num(w.paddy, 0, 0), deliveries: num(w.deliveries, 0, 0), kaam: num(w.kaam, 0, 0), sights: num(w.sights, 0, 0), earned: num(w.earned, 0, 0) };
  s.inbox = Array.isArray(r.inbox) ? r.inbox.filter((n): n is Note => !!n && typeof n.t === 'number' && typeof n.text === 'string').slice(-10).map((n) => ({ t: n.t, text: n.text.slice(0, 160) })) : [];
  const keys = VEHICLES.map((v) => v.k);
  s.garage = [...new Set<VehKey>(['rickshaw', ...(Array.isArray(r.garage) ? r.garage.filter((k): k is VehKey => keys.includes(k as VehKey)) : []), ...(s.cycle ? ['cycle' as const] : []), ...(s.scooter ? ['scooter' as const] : [])])];
  s.fares = { day: num(r.fares?.day, 0, 0), n: num(r.fares?.n, 0, 0, 99), last: num(r.fares?.last, 0, 0) };
  const rd = r.ride; s.ride = rd && typeof rd === 'object' && typeof rd.to === 'string' && STAND_KEYS.includes(rd.to as StandKey) && STAND_KEYS.includes(rd.from as StandKey) ? { from: String(rd.from), to: rd.to, start: num(rd.start, now), ms: num(rd.ms, 30000, 1000, 120000), hours: num(rd.hours, 0.2, 0, 3), done: num(rd.done, 0, 0, 3) } : null;
  return s;
}

const inMap = (x: unknown, z: unknown) => typeof x === 'number' && typeof z === 'number' && Number.isFinite(x) && Number.isFinite(z) && inArea(x, z, 10);
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
