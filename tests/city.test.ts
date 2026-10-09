import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CityMap, type RawMap } from '../src/client/map/data.js';
import { RoadGraph, along } from '../src/client/route.js';
import { planBuildings } from '../src/client/scene/buildings.js';
import { STANDS, standByKey } from '../src/shared/stands.js';
import { NEIGHBOURS } from '../src/shared/kaam.js';
import { findHomeSite, localities, neighbourSpot } from '../src/client/map/places.js';

const map = new CityMap(JSON.parse(readFileSync('public/agartala-map.json', 'utf8')) as RawMap);

describe('the baked city', () => {
  it('fits a building model to every footprint, facing a road', () => {
    const plans = planBuildings(map);
    expect(plans).toHaveLength(map.buildings.length);
    const kinds = new Map<string, number>(); for (const p of plans) kinds.set(p.arch, (kinds.get(p.arch) || 0) + 1);
    // a mix of huts, Assam-type houses, RCC houses, shops and big blocks
    for (const k of ['hut_rust', 'assam_blue', 'rcc2', 'rcc3', 'shop2_a', 'block']) expect(kinds.get(k) || 0).toBeGreaterThan(0);
    // every fitted rectangle sits on its own footprint
    const off = plans.filter((p, i) => Math.hypot(p.cx - (map.buildings[i].minx + map.buildings[i].maxx) / 2, p.cz - (map.buildings[i].minz + map.buildings[i].maxz) / 2) > 15).length;
    expect(off / plans.length).toBeLessThan(0.01);
  });

  it('routes tomtoms along the streets between every pair of stands', () => {
    const g = new RoadGraph(map);
    for (const a of STANDS) for (const b of STANDS) {
      if (a === b) continue;
      const r = g.route(a.x, a.z, b.x, b.z); const straight = Math.hypot(a.x - b.x, a.z - b.z);
      expect(r.pts.length).toBeGreaterThan(2);
      expect(r.length).toBeGreaterThanOrEqual(straight * 0.99);
      expect(r.length).toBeLessThan(straight * 2.6 + 200);
      // the tomtom never drives through a building (it keeps left, squeezing in on narrow lanes)
      let inside = 0, n = 0;
      for (let d = 0; d < r.length; d += 4, n++) { let ok = false; for (const sd of [1.4, 0.7, 0]) { const p = along(r, d, sd); if (!map.inBuilding(p.x, p.z)) { ok = true; break; } } if (!ok) inside++; }
      expect(inside / n).toBeLessThan(0.002);
    }
    const home = standByKey('stHome')!, math = standByKey('stMath')!;
    expect(g.route(home.x, home.z, math.x, math.z).length).toBeGreaterThan(900);
  });

  it('lays the farm out on open, dry ground by the river', async () => {
    const F = await import('../src/shared/farm.js');
    const pts = [F.HOME, F.GRANDPA, F.ROLLER, F.RACK, F.SHED, F.CRAFT, F.COLD, F.PUMP, F.RINA.house, F.RINA.npc, ...F.PLOTS, ...F.TEA, ...F.AGAR, ...F.RUBBER, ...F.BAMBOO, ...F.JACK];
    for (const p of pts) {
      expect(map.inBuilding(p.x, p.z), `${p.x},${p.z}`).toBe(false);
      expect(map.inWaterPoly(p.x, p.z) && !(Math.abs(p.x - F.POND.x) < F.POND.w && Math.abs(p.z - F.POND.z) < F.POND.d), `${p.x},${p.z} in water`).toBe(false);
      expect(F.inFarm(p.x, p.z) || Math.hypot(p.x - F.HOME.x, p.z - F.HOME.z) < 40, `${p.x},${p.z} outside the farm`).toBe(true);
    }
  });

  it('places every neighbour on open ground', () => {
    for (const n of NEIGHBOURS) {
      const [x, z] = neighbourSpot(map, n.id);
      expect(map.inBuilding(x, z)).toBe(false);
      expect(map.inWater(x, z)).toBe(false);
    }
  });

  it('finds open ground for a house near every named locality', () => {
    const list = localities(map); expect(list.length).toBeGreaterThan(12);
    let far = 0;
    for (const l of list) {
      const h = findHomeSite(map, l.x, l.z, l.name); expect(h, l.name).not.toBeNull();
      if (Math.hypot(h!.x - l.x, h!.z - l.z) > 350) far++;
      expect(map.inBuilding(h!.x, h!.z)).toBe(false); expect(map.inBuilding(h!.sx, h!.sz)).toBe(false);
    }
    expect(far / list.length).toBeLessThan(0.2);
  });
});
