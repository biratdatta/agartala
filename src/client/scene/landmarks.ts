/** Hand-built models placed on real locations: Ujjayanta Palace, the Durgabari pandal, the bazar stall, tomtom stands, the bus, and the people you talk to. */
import * as THREE from 'three';
import { GRANDPA, RINA } from '../../shared/farm.js';
import { SPOTS } from '../../shared/spots.js';
import type { Stand } from '../../shared/stands.js';
import { colliders } from '../collide.js';
import { type CityMap, getH } from '../map/data.js';
import { MAT, add, box, cyl, place, pyramid, sph } from './kit.js';
import { LOOKS, type Person, person, sit } from './people.js';

export function stiltHouse(scene: THREE.Scene, x: number, z: number, rot = 0, W = 7, D = 5): THREE.Group {
  const g = new THREE.Group(); const P = 1.7;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cyl(g, 0.13, 0.16, P, '#5f4a2c', -W / 2 + 0.3 + (i * (W - 0.6)) / 2, P / 2, -D / 2 + 0.3 + (j * (D - 0.6)) / 2, 6);
  box(g, W + 1.4, 0.18, D + 0.8, '#97794a', 0, P, 0.3);
  add(g, new THREE.BoxGeometry(W, 2.3, D), MAT.weave, 0, P + 1.24, 0);
  box(g, 1, 1.7, 0.08, '#3a2a18', 0.8, P + 0.95, D / 2 + 0.02); box(g, 0.9, 0.7, 0.08, '#3a2a18', -1.8, P + 1.4, D / 2 + 0.02);
  pyramid(g, W + 1.6, 2.7, D + 1.6, '#b39150', 0, P + 2.35, 0);
  const l = new THREE.Group(); l.position.set(0.8, 0, D / 2 + 1.1); l.rotation.x = -0.35; g.add(l);
  cyl(l, 0.05, 0.05, 2.1, '#6b5432', -0.3, 0.95, 0, 5); cyl(l, 0.05, 0.05, 2.1, '#6b5432', 0.3, 0.95, 0, 5);
  for (let k = 0; k < 5; k++) box(l, 0.62, 0.05, 0.06, '#6b5432', 0, 0.2 + k * 0.38, 0);
  place(scene, g, x, z, rot); colliders.push({ x, z, r: Math.max(W, D) / 2 + 0.4 }); return g;
}

export function tinHut(scene: THREE.Scene, x: number, z: number, rot = 0, W = 4.4, D = 3.6, wall = '#d7c3a0'): THREE.Group {
  const g = new THREE.Group(); const H = 2.6;
  box(g, W + 0.4, 0.3, D + 0.4, '#8d8170', 0, 0.15, 0); box(g, W, H, D, wall, 0, 0.3 + H / 2, 0); box(g, 1, 1.9, 0.08, '#4a3826', 0, 1.25, D / 2 + 0.02);
  const a = 0.42, half = D / 2 + 0.5, L = half / Math.cos(a), top = 0.3 + H;
  box(g, W + 0.8, 0.08, L, '#8a9aa3', 0, top + (half * Math.tan(a)) / 2, half / 2).rotation.x = a;
  box(g, W + 0.8, 0.08, L, '#7c8c96', 0, top + (half * Math.tan(a)) / 2, -half / 2).rotation.x = -a;
  place(scene, g, x, z, rot); colliders.push({ x, z, r: Math.max(W, D) / 2 + 0.3 }); return g;
}

/** Ujjayanta Palace (1901), on its OSM footprint, facing south over its two lakes. */
export const PALACE = { x: 40, z: -61, s: 1.62 };
export function buildPalace(scene: THREE.Scene): THREE.Group {
  const g = new THREE.Group(); const W = '#f3efe6', T = '#d9d0bf', Dm = '#e6e2da';
  box(g, 76, 1.2, 26, '#cbc4b4', 0, 0.6, 0); box(g, 64, 9.4, 14, W, 0, 5.9, 0); box(g, 65.2, 0.7, 15, T, 0, 10.9, 0);
  for (let i = -14; i <= 14; i++) {
    const x = i * 2.15; if (Math.abs(x) < 6.5) continue;
    add(g, new THREE.BoxGeometry(1.2, 2.5, 0.25), MAT.win, x, 4, 7.02); add(g, new THREE.BoxGeometry(1.2, 2.2, 0.25), MAT.win, x, 8.1, 7.02); box(g, 0.35, 9, 0.5, T, x - 1.07, 5.9, 7.1);
  }
  box(g, 6, 7, 0.4, '#7a6a58', 0, 4.7, 7.1); box(g, 15, 0.6, 4, T, 0, 0.9, 9.6); box(g, 13, 0.6, 2.4, T, 0, 1.5, 9.4);
  box(g, 14, 8, 14, W, 0, 15, 0); box(g, 15.2, 0.7, 15.2, T, 0, 19.2, 0);
  for (const s of [-1, 1]) for (const k of [-4, 0, 4]) add(g, new THREE.BoxGeometry(1.4, 3.4, 0.3), MAT.win, k, 15, s * 7.02);
  add(g, new THREE.CylinderGeometry(5.6, 6.2, 1.6, 20), W, 0, 20.3, 0); add(g, new THREE.SphereGeometry(5.8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), Dm, 0, 21, 0);
  cyl(g, 0.25, 0.5, 3, '#c9a24a', 0, 28, 0, 8); sph(g, 0.5, '#c9a24a', 0, 27.2, 0, 8, 6);
  for (const sx of [-1, 1]) {
    box(g, 9, 8, 10, W, sx * 24, 14.5, 0); box(g, 10, 0.6, 11, T, sx * 24, 18.7, 0);
    add(g, new THREE.SphereGeometry(3.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), Dm, sx * 24, 19, 0); cyl(g, 0.15, 0.3, 1.8, '#c9a24a', sx * 24, 23.6, 0, 6);
    for (const k of [-2, 2]) add(g, new THREE.BoxGeometry(1.2, 3, 0.3), MAT.win, sx * 24 + k, 14.5, 5.02);
    for (const ex of [31, 13]) for (const cz of [-5.5, 5.5]) {
      const cx = sx * ex;
      for (const q of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) cyl(g, 0.12, 0.12, 2, T, cx + q[0], 12.2, cz + q[1], 6);
      add(g, new THREE.SphereGeometry(1.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), Dm, cx, 13.2, cz);
    }
  }
  const lights = new THREE.Group(); const lm = MAT.palaceLights;
  for (const [x, y, z, w] of [[0, 11.3, 7.6, 66], [0, 19.6, 7.7, 15.5], [24, 19.0, 5.6, 10.2], [-24, 19.0, 5.6, 10.2], [0, 1.3, 13.2, 76]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), lm); m.position.set(x, y, z); lights.add(m); }
  for (const s of [-1, 1]) for (const x of [7.6, 32.6]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10.5, 0.12), lm); m.position.set(s * x, 6, 7.6); lights.add(m); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.08, 4, 40), lm); ring.rotation.x = Math.PI / 2; ring.position.y = 21.1; lights.add(ring);
  g.add(lights); g.scale.setScalar(PALACE.s); place(scene, g, PALACE.x, PALACE.z);
  colliders.push({ x0: PALACE.x - 38 * PALACE.s, x1: PALACE.x + 38 * PALACE.s, z0: PALACE.z - 13 * PALACE.s, z1: PALACE.z + 11.5 * PALACE.s });
  return lights;
}

export function buildPandal(scene: THREE.Scene, map: CityMap): THREE.Group {
  const p = new THREE.Group();
  for (const [x, z] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) cyl(p, 0.2, 0.2, 5, '#c9a24a', x, 2.5, z, 6);
  add(p, new THREE.ConeGeometry(8, 4, 10, 1, true), MAT.pandal, 0, 7, 0);
  box(p, 10.4, 0.6, 0.4, '#c62f2f', 0, 4.9, 4.2); box(p, 5, 1.2, 2.6, '#7a2e22', 0, 0.6, -2.4);
  add(p, new THREE.BoxGeometry(3.2, 3.2, 0.4), new THREE.MeshBasicMaterial({ color: '#f5c04a' }), 0, 2.8, -3.4);
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), MAT.fairy[i % 4]); b.position.set(Math.cos(a) * 7.6, 5.2 + Math.sin(i) * 0.1, Math.sin(a) * 7.6); b.userData.fairy = true; p.add(b); }
  const [x, z] = SPOTS.pandal; const rn = map.roadNear(x, z);
  place(scene, p, x, z, rn ? Math.atan2(rn.px - x, rn.pz - z) : 0); p.visible = false; colliders.push({ x, z, r: 2.4 });
  return p;
}

export function buildStall(scene: THREE.Scene, map: CityMap): void {
  const [x, z] = SPOTS.gopal; const rn = map.roadNear(x, z); const s = new THREE.Group();
  for (const [px, pz] of [[-1.8, -1.4], [1.8, -1.4], [-1.8, 1.2], [1.8, 1.2]]) cyl(s, 0.07, 0.07, 2.6, '#6b5432', px, 1.3, pz, 5);
  box(s, 4.2, 0.06, 3.4, '#2f6fb0', 0, 2.65, -0.1).rotation.x = -0.18; box(s, 3.4, 0.8, 1.4, '#8a6a42', 0, 0.4, -0.5);
  const goods = ['#e9a23b', '#7fae45', '#d8b64a', '#c0532f', '#9bb446', '#a9733b'];
  for (let k = 0; k < 9; k++) sph(s, 0.2, goods[k % 6], -1.2 + (k % 3) * 1.2, 0.95, -0.85 + Math.floor(k / 3) * 0.4, 6, 5);
  place(scene, s, x, z, rn ? Math.atan2(rn.px - x, rn.pz - z) : 0); colliders.push({ x, z, r: 1.6 });
}

/** Parked tomtoms (from the asset kit) with a driver and a sign at every stand. The Home stand moves with the house. */
export class StandsView {
  private drivers: Person[] = []; private signs: THREE.Group[] = []; private cols: { x: number; z: number; r: number }[] = [];
  private rotBy = new Map<string, number>();
  constructor(scene: THREE.Scene, private map: CityMap, private fleet: { set(i: number, x: number, y: number, z: number, rot: number): void; hide(i: number): void }, private max = 10) {
    for (let i = 0; i < max; i++) {
      const d = person({ shirt: ['#3b5e7d', '#c9b98e', '#e8e1d0', '#6b8fb3'][i % 4], lowerMat: i % 2 ? MAT.lungi : MAT.lungi2, gamcha: i % 3 === 0 }); sit(d); d.visible = false; scene.add(d); this.drivers.push(d);
      const sg = new THREE.Group(); cyl(sg, 0.05, 0.05, 2.4, '#444', 0, 1.2, 0, 5); box(sg, 1.1, 0.5, 0.05, '#2f8f4e', 0, 2.3, 0); sg.visible = false; scene.add(sg); this.signs.push(sg);
      const c = { x: 99999, z: 99999, r: 1.3 }; colliders.push(c); this.cols.push(c);
    }
  }
  /** Road direction at a stand, used to park along the lane and drop riders beside it. */
  rot(s: Stand): number {
    const k = `${s.x},${s.z}`; let r = this.rotBy.get(k);
    if (r === undefined) { const rn = this.map.roadNear(s.x, s.z); r = rn ? this.map.roadAngle(rn) : 0; this.rotBy.set(k, r); }
    return r;
  }
  update(list: Stand[]): void {
    for (let i = 0; i < this.max; i++) {
      const s = list[i];
      if (!s) { this.fleet.hide(i); this.drivers[i].visible = false; this.signs[i].visible = false; this.cols[i].x = this.cols[i].z = 99999; continue; }
      const r = this.rot(s); this.fleet.set(i, s.x, 0, s.z, r);
      const d = this.drivers[i]; d.visible = true; d.position.set(s.x + Math.sin(r) * 0.55, 0.62, s.z + Math.cos(r) * 0.55); d.rotation.y = r;
      const sg = this.signs[i]; sg.visible = true; sg.position.set(s.x + Math.cos(r) * 2.4 - Math.sin(r) * 1.6, getH(s.x, s.z), s.z - Math.sin(r) * 2.4 - Math.cos(r) * 1.6); sg.rotation.y = r;
      this.cols[i].x = s.x; this.cols[i].z = s.z;
    }
  }
}

export function buildBus(scene: THREE.Scene, map: CityMap): void {
  const [x, z] = SPOTS.busTerminus; const rn = map.roadNear(x, z); const rot = rn ? map.roadAngle(rn) : 0;
  const b = new THREE.Group(); box(b, 2.5, 2.6, 10, '#c9452f', 0, 1.7, 0); box(b, 2.52, 0.7, 9.4, '#9fc7d6', 0, 2.3, 0); box(b, 2.55, 0.3, 10, '#f2e6c8', 0, 1.2, 0);
  for (const zz of [-3.5, 3.2]) for (const xx of [-1.2, 1.2]) cyl(b, 0.5, 0.5, 0.3, '#1a1a1a', xx, 0.5, zz, 10).rotation.z = Math.PI / 2;
  const bx = x + Math.sin(rot) * 7, bz = z + Math.cos(rot) * 7; place(scene, b, bx, bz, rot); colliders.push({ x: bx, z: bz, r: 2 });
}

export interface Npc { g: Person; x: number; z: number; name: string; role: string }
export type NpcKey = 'grandpa' | 'rina' | 'gopal' | 'conductor';
export function buildNPCs(scene: THREE.Scene, map: CityMap): Record<NpcKey, Npc> {
  const def: Record<NpcKey, { x: number; z: number; o: Parameters<typeof person>[0]; name: string; role: string; faceRoad?: boolean }> = {
    grandpa: { ...GRANDPA, o: { shirt: '#e4ddcc', lowerMat: new THREE.MeshLambertMaterial({ color: '#f1ece0' }), hair: '#d9d6cf', skin: '#8a5d3c' }, name: 'Hemanta Debbarma', role: 'Your grandfather' },
    rina: { ...RINA.npc, o: { female: true, shirt: '#7d1d3f', bun: true, lowerMat: MAT.rignai }, name: 'Rina Jamatia', role: 'Neighbour · weaver' },
    gopal: { x: SPOTS.gopal[0], z: SPOTS.gopal[1], o: { shirt: '#6b8fb3', lowerMat: MAT.lungi2, gamcha: true }, name: 'Gopal Saha', role: 'Trader · Lake Chowmuhani Bazar', faceRoad: true },
    conductor: { x: SPOTS.busTerminus[0], z: SPOTS.busTerminus[1], o: { shirt: '#b9a37a', lowerMat: new THREE.MeshLambertMaterial({ color: '#4a4a52' }) }, name: 'Bus conductor', role: 'Radhanagar Bus Terminus', faceRoad: true },
  };
  const out = {} as Record<NpcKey, Npc>;
  for (const k of Object.keys(def) as NpcKey[]) {
    const d = def[k]; const g = person(d.o); place(scene, g, d.x, d.z);
    const rn = d.faceRoad ? map.roadNear(d.x, d.z) : null; if (rn) g.rotation.y = Math.atan2(rn.px - d.x, rn.pz - d.z);
    out[k] = { g, x: d.x, z: d.z, name: d.name, role: d.role }; colliders.push({ x: d.x, z: d.z, r: 0.45 });
  }
  return out;
}

/** Villagers who dance round the Garia pole, and the crowd at the Durga Puja pandal. */
export function buildCrowds(scene: THREE.Scene, map: CityMap): { dancers: Person[]; crowd: Person[] } {
  const dancers: Person[] = []; const crowd: Person[] = [];
  for (let i = 0; i < 7; i++) { const g = person(LOOKS[i % LOOKS.length]); g.visible = false; scene.add(g); dancers.push(g); }
  const [px, pz] = SPOTS.pandal;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2; const x = px + Math.cos(a) * (10 + (i % 3)), z = pz + Math.sin(a) * (10 + (i % 3));
    if (map.inBuilding(x, z) || map.inWaterPoly(x, z)) continue;
    const g = person(LOOKS[(i + 2) % LOOKS.length]); place(scene, g, x, z); g.lookAt(px, g.position.y, pz); g.visible = false; crowd.push(g);
  }
  return { dancers, crowd };
}
