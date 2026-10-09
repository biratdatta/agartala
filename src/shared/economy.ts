import { ITEMS, MONTH_DAYS, PRICES, type ItemKey } from './constants.js';
import { rnd2 } from './rng.js';

export const monthOf = (day: number): number => Math.floor((day - 1) / MONTH_DAYS) % 12;

/** Seasonal price factor for an item in a month (0 = Boishakh). */
export function seasonFactor(k: ItemKey, m: number): number {
  switch (k) {
    // Queen pineapple floods the market in Asharh and Srabon.
    case 'pineapple': return [1.1, 0.9, 0.65, 0.6, 0.75, 1, 1.15, 1.25, 1.35, 1.35, 1.25, 1.15][m];
    // Aman paddy is harvested in Kartik and Ogrohayon, so rates dip then.
    case 'paddy': return [1.05, 1.1, 1.2, 1.25, 1.2, 1.1, 0.9, 0.8, 0.85, 0.95, 1, 1][m];
    case 'jackfruit': return [0.8, 0.75, 0.8, 0.9, 1.1, 1.3, 1.4, 1.4, 1.4, 1.4, 1.2, 1][m];
    case 'sheet': return 1 + 0.08 * Math.sin(m);
    default: return 1;
  }
}

/** Gopal's rate at Lake Chowmuhani Bazar on a given day. Deterministic, so client and server agree. */
export function price(k: ItemKey, day: number): number {
  const m = monthOf(day);
  const noise = (rnd2(day * 3.1, k.length * 7.7 + k.charCodeAt(0)) * 2 - 1) * 0.14;
  return Math.max(1, Math.round(ITEMS[k].base * seasonFactor(k, m) * (1 + noise)));
}

export interface WorthInput {
  money: number;
  inv: Partial<Record<ItemKey, number>>;
  plots: { owned: boolean }[];
  canMax: number;
  cycle: boolean;
}

/** Net worth for the leaderboard: cash, goods at base rates, and land and kit at purchase price. */
export function netWorth(s: WorthInput): number {
  let w = s.money;
  for (const k of Object.keys(ITEMS) as ItemKey[]) w += (s.inv[k] || 0) * ITEMS[k].base;
  w += s.plots.slice(0, 12).filter((p) => p.owned).length * PRICES.plot;
  if (s.canMax > 8) w += PRICES.bhar;
  if (s.cycle) w += PRICES.cycle;
  return Math.round(w);
}
