import { ITEMS, MONTH_DAYS, PRICES, YEAR_DAYS, type ItemKey } from './constants.js';
import { rnd2 } from './rng.js';

export const monthOf = (day: number): number => Math.floor((day - 1) / MONTH_DAYS) % 12;
/** Which year of the game (0 = the first) a day falls in. */
export const yearOf = (day: number): number => Math.floor((day - 1) / YEAR_DAYS);
/** Day of the month, 1..MONTH_DAYS. */
export const dayOfMonth = (day: number): number => ((day - 1) % MONTH_DAYS) + 1;

/** Seasonal price factor for an item in a month (0 = Boishakh). */
export function seasonFactor(k: ItemKey, m: number): number {
  switch (k) {
    // Queen pineapple floods the market in Asharh and Srabon.
    case 'pineapple': return [1.1, 0.9, 0.65, 0.6, 0.75, 1, 1.15, 1.25, 1.35, 1.35, 1.25, 1.15][m];
    // Aman paddy is harvested in Kartik and Ogrohayon, so rates dip then.
    case 'paddy': return [1.05, 1.1, 1.2, 1.25, 1.2, 1.1, 0.9, 0.8, 0.85, 0.95, 1, 1][m];
    case 'jackfruit': return [0.8, 0.75, 0.8, 0.9, 1.1, 1.3, 1.4, 1.4, 1.4, 1.4, 1.2, 1][m];
    case 'sheet': return 1 + 0.08 * Math.sin(m);
    // First flush in spring fetches the best rate.
    case 'tea': return [1.1, 1.0, 0.9, 0.85, 0.9, 1, 1, 0.95, 0.9, 0.95, 1.3, 1.25][m];
    // Fish is dear in the dry months, cheap when the monsoon fills every pond.
    case 'fish': return [1.15, 1.1, 0.85, 0.8, 0.9, 1, 1.05, 1.1, 1.2, 1.2, 1.15, 1.15][m];
    // Everyone wants pitha in Poush and Magh.
    case 'pitha': return [0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 0.9, 1, 1.5, 1.3, 0.8, 0.7][m];
    // Baskets sell best before the pujas.
    case 'basket': return [1, 1, 1, 1, 1.1, 1.25, 1.2, 1, 1, 1, 1, 1][m];
    default: return 1;
  }
}

const SELLABLE = Object.keys(ITEMS) as ItemKey[];
/** One item is in demand each day: traders from Udaipur or Dharmanagar are buying. Same on client and server. */
export function demandOf(day: number): ItemKey {
  return SELLABLE.filter((k) => k !== 'agar')[Math.floor(rnd2(day * 5.3, 17.1) * (SELLABLE.length - 1))];
}
export const DEMAND_BONUS = 1.3;

/** How much your own recent selling has pushed a rate down (pressure = units sold lately). */
export const pressureFactor = (pressure: number): number => Math.max(0.55, 1 - 0.035 * Math.max(0, pressure));

/** Gopal's rate at Math Chowmuhani Bazar on a day, before your own selling moves it. */
export function price(k: ItemKey, day: number): number {
  return priceAt(k, day, 0);
}
/** The rate for one unit after `pressure` recent units. Deterministic, so client and server agree. */
export function priceAt(k: ItemKey, day: number, pressure: number): number {
  const m = monthOf(day);
  const noise = (rnd2(day * 3.1, k.length * 7.7 + k.charCodeAt(0)) * 2 - 1) * 0.14;
  const demand = demandOf(day) === k ? DEMAND_BONUS : 1;
  return Math.max(1, Math.round(ITEMS[k].base * seasonFactor(k, m) * (1 + noise) * demand * pressureFactor(pressure)));
}
/** What selling n units brings, one unit at a time as the rate slides. */
export function saleValue(k: ItemKey, day: number, pressure: number, n: number): number {
  let t = 0; for (let i = 0; i < n; i++) t += priceAt(k, day, pressure + i); return t;
}
/** Border haat rates: Bangladeshi traders pay above the city rate for fruit, fish, tea and crafts. */
export const HAAT_ITEMS: ItemKey[] = ['pineapple', 'jackfruit', 'tea', 'fish', 'basket', 'bamboo'];
export const haatPrice = (k: ItemKey, day: number): number => Math.round(ITEMS[k].base * seasonFactor(k, monthOf(day)) * 1.3);

export interface WorthInput {
  money: number;
  inv: Partial<Record<ItemKey, number>>;
  plots: { owned: boolean }[];
  canMax: number;
  cycle: boolean;
  scooter?: boolean; pump?: boolean; coldStore?: boolean;
  tea?: { planted: boolean }[]; agar?: { planted: boolean }[];
}

/** Net worth for the leaderboard: cash, goods at base rates, and land and kit at purchase price. */
export function netWorth(s: WorthInput): number {
  let w = s.money;
  for (const k of SELLABLE) w += (s.inv[k] || 0) * ITEMS[k].base;
  w += s.plots.slice(0, 12).filter((p) => p.owned).length * PRICES.plot;
  if (s.canMax > 8) w += PRICES.bhar;
  if (s.cycle) w += PRICES.cycle;
  if (s.scooter) w += PRICES.scooter;
  if (s.pump) w += PRICES.pump;
  if (s.coldStore) w += PRICES.coldStore;
  w += (s.tea || []).filter((t) => t.planted).length * PRICES.teaSapling;
  w += (s.agar || []).filter((t) => t.planted).length * PRICES.agarSapling;
  return Math.round(w);
}
