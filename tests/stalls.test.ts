import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CityMap } from '../src/client/map/data.js';
import { stallSpot } from '../src/client/map/stallspot.js';
import { STALLS } from '../src/shared/food.js';
import { standByKey } from '../src/shared/stands.js';

describe('food stalls', () => {
  it('every stall stands whole on open ground near its tomtom stand, facing the road', () => {
    const map = new CityMap(JSON.parse(readFileSync('public/agartala-map.json', 'utf8')));
    for (const st of STALLS) {
      const s = standByKey(st.stand)!; const p = stallSpot(map, s.x, s.z);
      expect(p.ok, st.name).toBe(true);
      expect(Math.hypot(p.x - s.x, p.z - s.z), st.name).toBeLessThan(27);
    }
  });
});
