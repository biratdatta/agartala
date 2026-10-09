/** Game rules constants. Shared by the browser and the server, so both agree on every number. */

/** One game day lasts this many real seconds. */
export const DAY_SECONDS = 300;
/** Compressed calendar: each Bengali month lasts this many game days. */
export const MONTH_DAYS = 4;
/** Game hours of growth needed before a crop is ripe. */
export const NEED = { paddy: 30, pineapple: 44 } as const;
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
  fare: 20,
  bus: 30,
} as const;

export type ItemKey = 'paddy' | 'pineapple' | 'jackfruit' | 'sheet' | 'bamboo';
export type BuyKey = 'paddySeed' | 'sucker' | 'plot' | 'bhar' | 'cycle';
export type CropKey = keyof typeof NEED;

export const ITEMS: Record<ItemKey, { name: string; unit: string; base: number }> = {
  paddy: { name: 'Paddy', unit: 'sack', base: 70 },
  pineapple: { name: 'Queen pineapple', unit: 'each', base: 28 },
  jackfruit: { name: 'Jackfruit', unit: 'each', base: 45 },
  sheet: { name: 'Rubber sheet', unit: 'each', base: 130 },
  bamboo: { name: 'Bamboo culm', unit: 'each', base: 35 },
};

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
