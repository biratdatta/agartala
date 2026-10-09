import { describe, expect, it } from 'vitest';
import { ITEMS, type ItemKey } from '../src/shared/constants.js';
import { monthOf, netWorth, price } from '../src/shared/economy.js';
import { newState } from '../src/shared/save.js';
import { STANDS, rideMinutes } from '../src/shared/stands.js';
import { T0 } from './helpers.js';

describe('economy', () => {
  it('is deterministic and stays within ±14% of the seasonal rate', () => {
    for (const k of Object.keys(ITEMS) as ItemKey[]) for (let d = 1; d < 100; d++) {
      expect(price(k, d)).toBe(price(k, d));
      expect(price(k, d)).toBeGreaterThan(0);
    }
  });
  it('makes pineapple cheaper in the monsoon glut than in winter', () => {
    const avg = (m: number) => { let t = 0; for (let i = 1; i <= 4; i++) t += price('pineapple', m * 4 + i); return t / 4; };
    expect(avg(3)).toBeLessThan(avg(8));
  });
  it('maps days to Bengali months', () => {
    expect(monthOf(1)).toBe(0); expect(monthOf(5)).toBe(1); expect(monthOf(49)).toBe(0);
  });
  it('values a new farm at its cash and land', () => {
    expect(netWorth(newState(T0))).toBe(100 + 6 * 400);
  });
  it('has seven tomtom stands with sensible ride times', () => {
    expect(STANDS).toHaveLength(7);
    const home = STANDS[0], lake = STANDS.find((s) => s.k === 'stMath')!;
    expect(rideMinutes(home, lake)).toBeGreaterThan(5.5); expect(rideMinutes(home, lake)).toBeLessThan(20);
  });
});
