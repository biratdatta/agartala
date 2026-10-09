/**
 * The city between farm jobs: food stalls by the tomtom stands, street lamps along the main roads,
 * Diwali lamps on College Lake and College Tilla Lake, and the Ker Puja shrine at the stadium gate.
 */
import * as THREE from 'three';
import { STALLS, dishById, type Stall } from '../../shared/food.js';
import { mulberry } from '../../shared/rng.js';
import { SPOTS } from '../../shared/spots.js';
import { standByKey } from '../../shared/stands.js';
import { colliders } from '../collide.js';
import { type CityMap, ROAD_W, getH } from '../map/data.js';
import { MAT, add, box, canvasTexture, cyl, place, sph } from './kit.js';
import { board } from './realplaces.js';
import { stallSpot } from '../map/stallspot.js';
import { type Person, person } from './people.js';

export interface StallView extends Stall { x: number; z: number; vendor: Person; shutter: THREE.Mesh; lamp: THREE.Mesh }

/** A painted menu board: the stall's dishes and prices. */
function menuBoard(items: { name: string; price: number }[]): THREE.Mesh {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320; const c = cv.getContext('2d')!;
  c.fillStyle = '#1f2a22'; c.fillRect(0, 0, 256, 320); c.strokeStyle = '#c9a24a'; c.lineWidth = 8; c.strokeRect(4, 4, 248, 312);
  c.fillStyle = '#ffd84a'; c.font = '700 30px "Hind Siliguri", sans-serif'; c.textAlign = 'center'; c.fillText('MENU · মেনু', 128, 46);
  c.textAlign = 'left'; c.font = '600 22px "Hind Siliguri", sans-serif';
  items.slice(0, 5).forEach((it, i) => { c.fillStyle = '#f6efe0'; c.fillText(it.name.length > 15 ? it.name.slice(0, 14) + '…' : it.name, 18, 96 + i * 46); c.fillStyle = '#9fe08a'; c.textAlign = 'right'; c.fillText(`₹${it.price}`, 238, 96 + i * 46); c.textAlign = 'left'; });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshLambertMaterial({ map: canvasTexture(cv) }));
}

const VENDORS = [
  { female: true, shirt: '#c0532f', bun: true, lowerMat: MAT.rignai }, { shirt: '#e8e1d0', lowerMat: MAT.lungi, gamcha: true },
  { female: true, shirt: '#24336f', bun: true, lowerMat: MAT.rignai2 }, { shirt: '#3e6b3a', lowerMat: MAT.lungi2 }, { shirt: '#f2f2f2', lowerMat: MAT.lungi },
];
const PAINT = ['#c62f2f', '#2f6fb0', '#1f6f5c', '#d9a43b', '#8c2346', '#3f6f2a', '#6b3fa0', '#2f7f8f', '#b5532a'];

/**
 * A street food stall: tin back and sides, a painted counter with a glass case of sweets, a stove
 * and kettle, a shelf of jars, a sloping tin roof on bamboo poles, the name board over the front
 * (English and Bangla), a menu board, a hanging bulb and a bench for customers. A rolling shutter
 * comes down at night.
 */
export function buildStalls(scene: THREE.Scene, map: CityMap): StallView[] {
  return STALLS.map((st, i) => {
    const s = standByKey(st.stand)!; const p = stallSpot(map, s.x, s.z); const paint = PAINT[i % PAINT.length];
    const g = new THREE.Group();
    box(g, 4.6, 0.16, 3.6, '#b9b3a6', 0, 0.08, -0.1);                                   // concrete plinth
    box(g, 4.2, 2.6, 0.08, '#8f9aa3', 0, 1.46, -1.85); for (const sx of [-1, 1]) box(g, 0.08, 2.6, 2.0, '#8f9aa3', sx * 2.06, 1.46, -0.85); // tin back and sides
    for (let k = 0; k < 4; k++) box(g, 4.2, 0.04, 0.1, '#7a858e', 0, 0.5 + k * 0.6, -1.8);  // ribs on the tin
    box(g, 3.6, 0.08, 0.35, '#7a5a3a', 0, 1.75, -1.6); for (let k = 0; k < 6; k++) cyl(g, 0.11, 0.11, 0.3, ['#e9a23b', '#c62f2f', '#7fae45', '#f2e6c8'][k % 4], -1.4 + k * 0.56, 1.94, -1.6, 8); // shelf of jars
    box(g, 3.8, 1.0, 0.7, '#8a6a42', 0, 0.66, 0.85); box(g, 3.82, 0.6, 0.02, paint, 0, 0.62, 1.21); box(g, 3.9, 0.06, 0.8, '#d9cfbf', 0, 1.19, 0.85); // counter, painted front, top
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.55), new THREE.MeshLambertMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.35 })); glass.position.set(-1.1, 1.45, 0.85); g.add(glass);
    for (let k = 0; k < 6; k++) sph(g, 0.09, k % 2 ? '#f2e6c8' : '#e3a84a', -1.5 + (k % 3) * 0.35, 1.32, 0.72 + Math.floor(k / 3) * 0.25, 6, 5); // rasgulla and sandesh in the case
    cyl(g, 0.2, 0.2, 0.55, '#c62f2f', 1.45, 0.43, -0.6, 10); box(g, 0.6, 0.12, 0.45, '#2a2a2a', 1.2, 0.95, -0.2); cyl(g, 0.22, 0.16, 0.22, '#9aa0a6', 1.2, 1.12, -0.2, 12); cyl(g, 0.03, 0.03, 0.2, '#9aa0a6', 1.38, 1.18, -0.2, 4); // gas, stove, kettle
    for (const [x, z] of [[-2.1, -1.8], [2.1, -1.8], [-2.1, 1.35], [2.1, 1.35]]) cyl(g, 0.07, 0.08, 2.9, '#a08350', x, 1.45, z, 6); // bamboo poles
    const roof = box(g, 4.9, 0.06, 4.0, paint, 0, 2.95, -0.2); roof.rotation.x = 0.12; roof.castShadow = true;
    box(g, 4.9, 0.25, 0.04, '#e9e1cf', 0, 2.78, 1.78);                                    // the roof's frill
    const b = board(st.name, st.bn, paint, 4.2); b.position.set(0, 3.45, 1.55); b.rotation.x = -0.08; g.add(b); // name board over the front
    const dishes = st.menu.map((id) => dishById(id)).filter((d): d is NonNullable<typeof d> => !!d);
    const mb = menuBoard(dishes); mb.position.set(2.15, 1.9, 1.3); mb.rotation.y = 0.35; g.add(mb);
    cyl(g, 0.01, 0.01, 0.4, '#333', 0, 2.55, 0.6, 4); const lamp = add(g, new THREE.SphereGeometry(0.12, 8, 6), MAT.bulb, 0, 2.3, 0.6, false);
    box(g, 2.6, 0.08, 0.4, '#7a5a3a', 0, 0.45, 2.85); for (const sx of [-1.1, 1.1]) box(g, 0.08, 0.42, 0.36, '#4a4a4a', sx, 0.21, 2.85); // customers' bench
    const shutter = box(g, 3.9, 1.9, 0.06, '#6f777d', 0, 1.3, 1.25); shutter.visible = false;
    place(scene, g, p.x, p.z, p.rot);
    const vendor = person(VENDORS[i % VENDORS.length]); const bx = p.x + Math.sin(p.rot) * 0.05, bz = p.z + Math.cos(p.rot) * 0.05; vendor.position.set(bx, getH(bx, bz), bz); vendor.rotation.y = p.rot; scene.add(vendor);
    const fx = Math.sin(p.rot), fz = Math.cos(p.rot), ux = Math.cos(p.rot), uz = -Math.sin(p.rot);
    for (const u of [-1.2, 1.2]) colliders.push({ x: p.x + ux * u - fx * 0.4, z: p.z + uz * u - fz * 0.4, r: 1.5 });
    for (const u of [-1.1, 1.1]) colliders.push({ x: p.x + ux * u + fx * 2.85, z: p.z + uz * u + fz * 2.85, r: 0.35 });
    // the player talks to the stall from its front, by the bench
    return { ...st, x: p.x + fx * 2.1, z: p.z + fz * 2.1, vendor, shutter, lamp };
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
