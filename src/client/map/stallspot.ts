/** Where a food stall can stand (no DOM, so tests can check it). */
import { type CityMap, ROAD_W } from './data.js';

/**
 * A spot for a stall near a tomtom stand: the whole stall (counter, roof and the customers' bench)
 * must sit on open ground, clear of every wall, pond and the carriageway, with its front a step
 * from the road and facing it. Searches outward from the stand and takes the nearest that fits.
 */
export function stallSpot(map: CityMap, x: number, z: number, keepClear: { x: number; z: number; r: number }[] = [], maxR = 26): { x: number; z: number; rot: number; ok: boolean } {
  // the footprint in local metres: 5.2 wide, from the back wall (-2) to the bench (+3.2)
  const xs = [-2.6, -1.8, -0.9, 0, 0.9, 1.8, 2.6], zs = [-2, -1.2, -0.4, 0.4, 1.2, 2, 2.8, 3.2];
  const fits = (cx: number, cz: number, rot: number): boolean => {
    const s = Math.sin(rot), c = Math.cos(rot);
    for (const u of xs) for (const v of zs) {
      const px = cx + c * u + s * v, pz = cz - s * u + c * v;
      if (map.inBuilding(px, pz) || map.inWaterPoly(px, pz)) return false;
      if (keepClear.some((k) => Math.hypot(px - k.x, pz - k.z) < k.r)) return false; // e.g. a pandal and its crowd
      const r = map.roadNear(px, pz); if (r && r.d < ROAD_W[r.r.t] / 2 + 0.4) return false;
    }
    return true;
  };
  const cands: [number, number][] = [];
  for (let dx = -maxR; dx <= maxR; dx += 2) for (let dz = -maxR; dz <= maxR; dz += 2) { const d = Math.hypot(dx, dz); if (d >= 6 && d <= maxR) cands.push([x + dx, z + dz]); }
  cands.sort((a, b) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z));
  for (const [cx, cz] of cands) {
    const rn = map.roadNear(cx, cz); if (!rn) continue;
    const edge = rn.d - ROAD_W[rn.r.t] / 2; if (edge < 3.6 || edge > 6.5) continue; // the bench a step from the road
    const rot = Math.atan2(rn.px - cx, rn.pz - cz);
    if (fits(cx, cz, rot)) return { x: cx, z: cz, rot, ok: true };
  }
  const rn = map.roadNear(x, z); const ang = rn ? map.roadAngle(rn) : 0; const px = Math.cos(ang), pz = -Math.sin(ang);
  return { x: x + px * 6, z: z + pz * 6, rot: Math.atan2(-px, -pz), ok: false };
}

