import { SIGHTS } from '../../shared/errands.js';
import { SPOTS } from '../../shared/spots.js';
import type { HomeSite } from '../../shared/stands.js';
import { type CityMap, ROAD_W, pip } from './data.js';

/** Where a neighbour stands: a step off their baked spot, on open ground, clear of any tomtom stand. */
export function neighbourSpot(map: CityMap, id: string): [number, number] {
  const sp = (SPOTS as Record<string, readonly [number, number]>)[id] || [0, 0];
  for (const [dx, dz] of [[2.5, 1.5], [-2.5, 1.5], [2.5, -1.5], [-2.5, -1.5], [0, 3], [3, 0], [-3, 0], [0, -3]]) {
    const x = sp[0] + dx, z = sp[1] + dz;
    if (!map.inBuilding(x, z) && !map.inWater(x, z)) return [x, z];
  }
  return [sp[0], sp[1]];
}

/** Places a player can name as home: every neighbourhood, chowmuhani, bazar and sight on the map. */
export interface Locality { name: string; x: number; z: number }
export function localities(map: CityMap): Locality[] {
  const all: Locality[] = [
    ...map.places.map((p) => ({ name: p.name, x: p.x, z: p.z })),
    ...SIGHTS.map((s) => ({ name: s.name, x: s.x, z: s.z })),
  ];
  const seen = new Set<string>(); const out: Locality[] = [];
  for (const l of all) { const k = l.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(l); } }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
export function findLocality(list: Locality[], q: string): Locality | undefined {
  const s = q.trim().toLowerCase(); if (!s) return undefined;
  return list.find((l) => l.name.toLowerCase() === s) || list.find((l) => l.name.toLowerCase().startsWith(s)) || list.find((l) => l.name.toLowerCase().includes(s));
}

const SPECIAL = Object.values(SPOTS) as readonly (readonly [number, number])[];
/**
 * Finds a plot for the player's house near a point: a 22 m square of open ground beside a lane,
 * away from parks, water and landmarks. Spirals out until it finds one. The house faces the lane,
 * and the Home tomtom stand goes on the lane in front of it.
 */
export function findHomeSite(map: CityMap, x: number, z: number, name: string, maxR = 700): HomeSite | null {
  const parks = map.land.filter((l) => l.code === 0 || l.code === 2 || l.code === 3);
  const clear = (cx: number, cz: number): boolean => {
    for (let dz = -11; dz <= 11; dz += 2.75) for (let dx = -11; dx <= 11; dx += 2.75) { const px = cx + dx, pz = cz + dz; if (map.inBuilding(px, pz) || map.inWaterPoly(px, pz)) return false; }
    if (parks.some((p) => pip(cx, cz, p))) return false;
    return !SPECIAL.some(([sx, sz]) => Math.hypot(sx - cx, sz - cz) < 22);
  };
  for (let r = 0; r <= maxR; r += 6) {
    const n = Math.max(1, Math.round((2 * Math.PI * r) / 8));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r;
      const rn = map.roadNear(cx, cz, 5); if (!rn) continue;
      const hw = ROAD_W[rn.r.t] / 2; if (rn.d < hw + 9 || rn.d > hw + 22) continue;
      if (!clear(cx, cz)) continue;
      const ux = (cx - rn.px) / rn.d, uz = (cz - rn.pz) / rn.d;
      const sx = rn.px + ux * (hw + 1.8), sz = rn.pz + uz * (hw + 1.8);
      if (map.inBuilding(sx, sz) || map.inWater(sx, sz)) continue;
      return { name, x: cx, z: cz, sx, sz, face: Math.atan2(rn.px - cx, rn.pz - cz) };
    }
  }
  return null;
}
