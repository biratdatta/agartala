/** Walking rules: buildings and water from the map, plus round or boxy props placed by the game. */
import { type CityMap, X0, X1, Z0, Z1 } from './map/data.js';

export type Collider = { x: number; z: number; r: number } | { x0: number; x1: number; z0: number; z1: number };
export const colliders: Collider[] = [];

export function blocked(map: CityMap, x: number, z: number): boolean {
  if (x < X0 + 20 || x > X1 - 20 || z < Z0 + 20 || z > Z1 - 20) return true;
  const r = 0.35;
  if (map.inBuilding(x, z) || map.inBuilding(x + r, z) || map.inBuilding(x - r, z) || map.inBuilding(x, z + r) || map.inBuilding(x, z - r)) return true;
  return map.inWater(x, z);
}

/** Pushes a point out of props and tree trunks. */
export function pushOut(map: CityMap, x: number, z: number): [number, number] {
  const R = 0.45;
  for (const c of colliders) {
    if ('r' in c) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
      if (d < m && d > 1e-4) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; }
    } else if (x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R) {
      const pen = [x - (c.x0 - R), c.x1 + R - x, z - (c.z0 - R), c.z1 + R - z]; const k = pen.indexOf(Math.min(...pen));
      if (k === 0) x = c.x0 - R; else if (k === 1) x = c.x1 + R; else if (k === 2) z = c.z0 - R; else z = c.z1 + R;
    }
  }
  for (const t of map.treeGrid.q(x, z)) {
    const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz), m = 0.3 * t.s + 0.4;
    if (d < m && d > 1e-4) { x = t.x + (dx / d) * m; z = t.z + (dz / d) * m; }
  }
  return [x, z];
}
