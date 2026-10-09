/**
 * The city between farm jobs: food stalls by the tomtom stands, street lamps along the main roads,
 * Diwali lamps on College Lake and College Tilla Lake, and the Ker Puja shrine at the stadium gate.
 */
import * as THREE from 'three';
import { STALLS, type Stall } from '../../shared/food.js';
import { mulberry } from '../../shared/rng.js';
import { SPOTS } from '../../shared/spots.js';
import { standByKey } from '../../shared/stands.js';
import { colliders } from '../collide.js';
import { type CityMap, ROAD_W, getH } from '../map/data.js';
import { MAT, add, box, cyl, place, sph } from './kit.js';
import { type Person, person } from './people.js';

export interface StallView extends Stall { x: number; z: number; vendor: Person; shutter: THREE.Mesh; lamp: THREE.Mesh }

/** Finds dry, open ground near a point, a few metres off the road. */
function sideSpot(map: CityMap, x: number, z: number): { x: number; z: number; rot: number } {
  const rn = map.roadNear(x, z); const ang = rn ? map.roadAngle(rn) : 0;
  const ax = Math.sin(ang), az = Math.cos(ang), px = Math.cos(ang), pz = -Math.sin(ang);
  for (const along of [5, -5, 9, -9, 13, -13]) for (const side of [5, -5, 7, -7, 9, -9]) {
    const cx = x + ax * along + px * side, cz = z + az * along + pz * side;
    if (map.nearBuilding(cx, cz, 1.6) || map.inWaterPoly(cx, cz)) continue;
    const r = map.roadNear(cx, cz); if (r && r.d < ROAD_W[r.r.t] / 2 + 1.2) continue;
    return { x: cx, z: cz, rot: Math.atan2(x - cx, z - cz) };
  }
  return { x: x + px * 5, z: z + pz * 5, rot: Math.atan2(-px, -pz) };
}

const VENDORS = [
  { female: true, shirt: '#c0532f', bun: true, lowerMat: MAT.rignai }, { shirt: '#e8e1d0', lowerMat: MAT.lungi, gamcha: true },
  { female: true, shirt: '#24336f', bun: true, lowerMat: MAT.rignai2 }, { shirt: '#3e6b3a', lowerMat: MAT.lungi2 }, { shirt: '#f2f2f2', lowerMat: MAT.lungi },
];

export function buildStalls(scene: THREE.Scene, map: CityMap): StallView[] {
  return STALLS.map((st, i) => {
    const s = standByKey(st.stand)!; const p = sideSpot(map, s.x, s.z);
    const g = new THREE.Group();
    for (const [x, z] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) cyl(g, 0.06, 0.06, 2.5, '#6b5432', x, 1.25, z, 5);
    box(g, 3.6, 0.06, 2.6, ['#c62f2f', '#2f6fb0', '#1f6f5c', '#e9b23b', '#8c2346'][i % 5], 0, 2.55, 0).rotation.x = -0.12;
    box(g, 3, 0.9, 1, '#8a6a42', 0, 0.45, 0.5); cyl(g, 0.35, 0.3, 0.3, '#9aa0a6', -0.8, 1.05, 0.5, 12); cyl(g, 0.3, 0.3, 0.06, '#3a3a36', 0.6, 0.93, 0.5, 12);
    sph(g, 0.12, '#f2e6c8', 0.3, 1, 0.4, 6, 4); sph(g, 0.12, '#f2e6c8', 0.55, 1, 0.6, 6, 4);
    const shutter = box(g, 3.1, 1.6, 0.06, '#6f777d', 0, 1.7, 1.02); shutter.visible = false;
    const lamp = add(g, new THREE.SphereGeometry(0.12, 8, 6), MAT.bulb, 0, 2.35, 0.3, false);
    place(scene, g, p.x, p.z, p.rot);
    const vendor = person(VENDORS[i % VENDORS.length]); const bx = p.x - Math.sin(p.rot) * 0.9, bz = p.z - Math.cos(p.rot) * 0.9; vendor.position.set(bx, getH(bx, bz), bz); vendor.rotation.y = p.rot; scene.add(vendor);
    colliders.push({ x: p.x, z: p.z, r: 1.9 });
    // the player talks to the stall from its front
    return { ...st, x: p.x + Math.sin(p.rot) * 1.8, z: p.z + Math.cos(p.rot) * 1.8, vendor, shutter, lamp };
  });
}
export function updateStalls(list: StallView[], open: boolean): void { for (const s of list) { s.shutter.visible = !open; s.vendor.visible = open; } }

/**
 * Street lamps every ~32 m along the bigger roads, for the whole city, as two instanced meshes.
 * The heads glow after dusk.
 */
export class StreetLamps {
  readonly head = new THREE.MeshBasicMaterial({ color: '#5a5a54' });
  constructor(scene: THREE.Scene, map: CityMap) {
    const pts: { x: number; z: number; rot: number }[] = [];
    for (const r of map.roads) {
      if (r.t > 3 || r.bridge) continue; const off = ROAD_W[r.t] / 2 + 0.7;
      let acc = 16;
      for (let i = 0; i < r.n - 1; i++) {
        const ax = r.xs[i], az = r.zs[i], bx = r.xs[i + 1], bz = r.zs[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (!L) continue;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        while (acc < L) {
          const side = pts.length % 2 ? 1 : -1; const x = ax + dx * acc + dz * off * side, z = az + dz * acc - dx * off * side;
          if (!map.nearBuilding(x, z, 0.6) && !map.inWaterPoly(x, z)) pts.push({ x, z, rot: Math.atan2(-dz * side, dx * side) });
          acc += 32;
        }
        acc -= L;
      }
    }
    const pole = new THREE.CylinderGeometry(0.06, 0.09, 6, 5); pole.translate(0, 3, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.3); arm.translate(0, 5.95, 0.6);
    const lampGeo = new THREE.BoxGeometry(0.34, 0.12, 0.5); lampGeo.translate(0, 5.86, 1.2);
    const mp = new THREE.InstancedMesh(pole, new THREE.MeshLambertMaterial({ color: '#5d6266' }), pts.length);
    const ma = new THREE.InstancedMesh(arm, new THREE.MeshLambertMaterial({ color: '#5d6266' }), pts.length);
    const mh = new THREE.InstancedMesh(lampGeo, this.head, pts.length);
    const d = new THREE.Object3D();
    pts.forEach((p, i) => { d.position.set(p.x, getH(p.x, p.z), p.z); d.rotation.set(0, p.rot, 0); d.updateMatrix(); mp.setMatrixAt(i, d.matrix); ma.setMatrixAt(i, d.matrix); mh.setMatrixAt(i, d.matrix); });
    for (const m of [mp, ma, mh]) { m.frustumCulled = false; scene.add(m); }
    this.count = pts.length;
  }
  readonly count: number;
  update(nightFactor: number): void { this.head.color.set(nightFactor > 0.35 ? '#ffd88a' : '#5a5a54'); }
}

/** Floating diyas on College Lake and College Tilla Lake for Diwali nights. */
export function buildDiyas(scene: THREE.Scene, map: CityMap): THREE.Points {
  const rng = mulberry(31); const p: number[] = [];
  for (let k = 0; k < 8000 && p.length < 800 * 3; k++) { const x = 1150 + (rng() - 0.5) * 400, z = 1130 + (rng() - 0.5) * 260; if (map.inWaterPoly(x, z)) p.push(x, 0.25, z); }
  for (let k = 0; k < 6000 && p.length < 1100 * 3; k++) { const x = 1330 + (rng() - 0.5) * 200, z = 1390 + (rng() - 0.5) * 200; if (map.inWaterPoly(x, z)) p.push(x, 0.25, z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffb84a', size: 0.55, transparent: true, opacity: 0.95, depthWrite: false }));
  pts.visible = false; scene.add(pts); return pts;
}

/** The Ker shrine: a bamboo arch and a lamp by the stadium gate, only on Ker Puja day. */
export const KER_SPOT = { x: SPOTS.stStadium[0] + 8, z: SPOTS.stStadium[1] + 5 };
export function buildKer(scene: THREE.Scene): THREE.Group {
  const g = new THREE.Group();
  for (const x of [-1.6, 1.6]) cyl(g, 0.08, 0.1, 3.2, '#a8b85a', x, 1.6, 0, 6);
  const top = cyl(g, 0.07, 0.07, 3.6, '#a8b85a', 0, 3.2, 0, 6); top.rotation.z = Math.PI / 2;
  for (let i = 0; i < 9; i++) sph(g, 0.1, i % 2 ? '#f39a1c' : '#f5f0e0', -1.6 + i * 0.4, 3.0, 0, 6, 4);
  box(g, 1, 0.5, 0.7, '#cdb48a', 0, 0.25, -0.6); add(g, new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), 0, 0.6, -0.6, false);
  place(scene, g, KER_SPOT.x, KER_SPOT.z); g.visible = false; return g;
}
