/** Game rules constants. Shared by the browser and the server, so both agree on every number. */

/** One game day lasts this many real seconds. */
export const DAY_SECONDS = 300;
/** Compressed calendar: each Bengali month lasts this many game days. */
export const MONTH_DAYS = 4;
/** Game hours of growth needed before a crop is ripe. */
export const NEED = { paddy: 30, pineapple: 44 } as const;
/** Perennials: game hours from planting until first harvest. They grow without watering. */
export const TEA_NEED = 60;
export const AGAR_NEED = 24 * 30;
/** Fish in the pukur are ready to net this many game hours after stocking. */
export const FISH_NEED = 72;
/** Harvest yield per plot. */
export const YIELD = { paddy: 2, pineapple: 3 } as const;

export const MONTHS = ['Boishakh', 'Joishtho', 'Asharh', 'Srabon', 'Bhadro', 'Ashwin', 'Kartik', 'Ogrohayon', 'Poush', 'Magh', 'Falgun', 'Choitro'] as const;
export const SEASONS = ['Summer', 'Summer', 'Monsoon', 'Monsoon', 'Autumn', 'Autumn', 'Late autumn', 'Late autumn', 'Winter', 'Winter', 'Spring', 'Spring'] as const;
/** Chance of a rainy day, by month index (0 = Boishakh). */
export const RAIN_CHANCE = [0.3, 0.35, 0.65, 0.65, 0.4, 0.3, 0.12, 0.06, 0.05, 0.05, 0.1, 0.2] as const;

export const PRICES = {
  plot: 400,
  paddySeed: 15,
  sucker: 10,
  bhar: 300,
  cycle: 800,
  teaSapling: 40,
  agarSapling: 200,
  fingerling: 150,
  scooter: 2500,
  pump: 1500,
  coldStore: 1200,
  helper: 420,
  fare: 20,
  bus: 30,
  diesel: 10,
  lamp: 20,
  jaggery: 10,
} as const;

export type ItemKey = 'paddy' | 'pineapple' | 'jackfruit' | 'sheet' | 'bamboo' | 'tea' | 'agar' | 'fish' | 'basket' | 'pitha';
export type BuyKey = 'paddySeed' | 'sucker' | 'plot' | 'bhar' | 'cycle' | 'teaSapling' | 'agarSapling' | 'fingerling' | 'scooter' | 'pump' | 'coldStore' | 'helper';
export type CropKey = keyof typeof NEED;

export const ITEMS: Record<ItemKey, { name: string; unit: string; base: number }> = {
  paddy: { name: 'Paddy', unit: 'sack', base: 70 },
  pineapple: { name: 'Queen pineapple', unit: 'each', base: 28 },
  jackfruit: { name: 'Jackfruit', unit: 'each', base: 45 },
  sheet: { name: 'Rubber sheet', unit: 'each', base: 130 },
  bamboo: { name: 'Bamboo culm', unit: 'each', base: 35 },
  tea: { name: 'Tea leaf', unit: 'bundle', base: 18 },
  agar: { name: 'Agarwood chips', unit: 'bag', base: 900 },
  fish: { name: 'Rohu and katla', unit: 'kg', base: 160 },
  basket: { name: 'Cane basket', unit: 'each', base: 120 },
  pitha: { name: 'Pitha', unit: 'plate', base: 30 },
};
/** Items that go off without a cold store: the share lost each night. */
export const SPOIL: Partial<Record<ItemKey, number>> = { pineapple: 0.1, jackfruit: 0.1, fish: 0.25, pitha: 0.2 };
/** Days a hired helper works for one payment. */
export const HELPER_DAYS = 7;
/** Energy: the most you can have, what each job costs, and how much an hour of rest gives back. */
export const ENERGY_MAX = 100;
export const ENERGY_PER_HOUR = 2.5;
export const COST: Record<string, number> = { till: 3, sow: 1, water: 1, harvest: 2, tap: 1, cut: 2, pick: 1, roll: 2, pluck: 1, craft: 4, cook: 3, plant: 2, net: 3, stock: 1, pump: 1 };
/** Game days in a year (12 compressed months). */
export const YEAR_DAYS = 12 * 4;

export const CAN_SMALL = 8;
export const CAN_BIG = 16;
/** Latex cups needed to roll one rubber sheet. */
export const LATEX_PER_SHEET = 3;
/** Rubber is tapped at dawn: allowed from this hour... */
export const TAP_FROM = 5;
/** ...until this hour. */
export const TAP_UNTIL = 11;
/** Growth multiplier after the Kharchi Puja blessing. */
export const BLESSING = 1.2;
/** Longest stretch of offline time simulated in one go, in game days. */
export const MAX_CATCHUP_DAYS = 7;
