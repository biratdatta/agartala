import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CityMap } from '../src/client/map/data.js';
import { RoadGraph, along, clearSide } from '../src/client/route.js';
import { STANDS } from '../src/shared/stands.js';

describe('tomtom rides', () => {
  it('keep the tomtom out of buildings on every route between stands', () => {
    const map = new CityMap(JSON.parse(readFileSync('public/agartala-map.json', 'utf8')));
    const g = new RoadGraph(map); let hits = 0, samples = 0;
    for (const a of STANDS) for (const b of STANDS) {
      if (a === b) continue; const r = g.route(a.x, a.z, b.x, b.z); let side = 1.4;
      for (let d = 0; d < r.length; d += 0.6) {
        side += (clearSide(map, r, d) - side) * 0.35; const p = along(r, d, side); samples++;
        const lx = Math.cos(p.ang), lz = -Math.sin(p.ang), fx = Math.sin(p.ang), fz = Math.cos(p.ang);
        // the tomtom's middle and four corners (1.4 m wide, 2.8 m long)
        if ([[0, 0], [0.7, 1.4], [-0.7, 1.4], [0.7, -1.4], [-0.7, -1.4]].some(([u, v]) => map.inBuilding(p.x + lx * u + fx * v, p.z + lz * u + fz * v))) hits++;
      }
    }
    expect(hits / samples).toBeLessThan(0.003);
  });
});
