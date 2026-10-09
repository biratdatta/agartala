/**
 * The small things that make an Agartala street: black plastic water tanks on the flat roofs,
 * concrete electric poles with sagging wires along every lane, and painted shop boards over the
 * shutters on the main roads. All instanced, so thousands cost little.
 */
import * as THREE from 'three';
import { inPalaceGarden } from '../../shared/places.js';
import { mulberry } from '../../shared/rng.js';
import { type CityMap, ROAD_W, getH } from '../map/data.js';
import type { Kit, Plan } from './buildings.js';
import { canvasTexture } from './kit.js';

const FLAT_ROOF = /^(rcc|shop|block)/;

export function buildRealism(scene: THREE.Scene, map: CityMap, kit: Kit, plans: Plan[]): void {
  const rng = mulberry(77);
  tanks(scene, kit, plans, rng);
  poles(scene, map, rng);
  shopBoards(scene, kit, plans, rng);
}

/** A black Sintex-style tank on a little stand on most flat roofs. */
function tanks(scene: THREE.Scene, kit: Kit, plans: Plan[], rng: () => number): void {
  const list = plans.filter((p) => FLAT_ROOF.test(p.arch) && rng() < 0.7);
  const tank = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 10); tank.translate(0, 0.95, 0);
  const lid = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8); lid.translate(0, 1.56, 0);
  const stand = new THREE.BoxGeometry(1.2, 0.4, 1.2); stand.translate(0, 0.2, 0);
  const mT = new THREE.InstancedMesh(tank, new THREE.MeshLambertMaterial({ color: '#1e1e1e' }), list.length);
  const mL = new THREE.InstancedMesh(lid, new THREE.MeshLambertMaterial({ color: '#2a2a2a' }), list.length);
  const mS = new THREE.InstancedMesh(stand, new THREE.MeshLambertMaterial({ color: '#9a958a' }), list.length);
  const d = new THREE.Object3D();
  list.forEach((p, i) => {
    const h = (kit.arch.get(p.arch)?.h ?? 6) * 0.97; const c = Math.cos(p.ang), s = Math.sin(p.ang);
    const lx = (rng() - 0.5) * p.w * 0.5, lz = -p.d * 0.25 + (rng() - 0.5) * p.d * 0.2;
    d.position.set(p.cx + lx * c + lz * s, h, p.cz - lx * s + lz * c); d.rotation.set(0, rng() * 6, 0); d.updateMatrix();
    mT.setMatrixAt(i, d.matrix); mL.setMatrixAt(i, d.matrix); mS.setMatrixAt(i, d.matrix);
  });
  for (const m of [mT, mL, mS]) { m.castShadow = true; scene.add(m); }
}

/** Concrete poles every ~32 m along the lanes, with three sagging wires between them. */
function poles(scene: THREE.Scene, map: CityMap, rng: () => number): void {
  const pts: { x: number; z: number; rot: number }[] = []; const wires: number[] = [];
  for (const r of map.roads) {
    if (r.t < 2 || r.t > 5 || r.bridge) continue; const off = ROAD_W[r.t] / 2 + 0.9; const side = rng() < 0.5 ? 1 : -1;
    let acc = 10; let prev: { x: number; z: number; rot: number } | null = null;
    for (let i = 0; i < r.n - 1; i++) {
      const ax = r.xs[i], az = r.zs[i], bx = r.xs[i + 1], bz = r.zs[i + 1]; const L = Math.hypot(bx - ax, bz - az); if (!L) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      while (acc < L) {
        const x = ax + dx * acc + dz * off * side, z = az + dz * acc - dx * off * side; const rot = Math.atan2(dx, dz);
        if (inPalaceGarden(x, z)) prev = null; // no poles or wires across the palace lawn
        else if (!map.nearBuilding(x, z, 0.4) && !map.inWaterPoly(x, z)) {
          const p = { x, z, rot }; pts.push(p);
          if (prev && Math.hypot(prev.x - x, prev.z - z) < 45) {
            for (const o of [-0.6, 0, 0.6]) {
              const ox1 = Math.cos(prev.rot) * o, oz1 = -Math.sin(prev.rot) * o, ox2 = Math.cos(rot) * o, oz2 = -Math.sin(rot) * o;
              const y = 7.3 + (o === 0 ? 0.25 : 0);
              for (let k = 0; k < 6; k++) {
                const t1 = k / 6, t2 = (k + 1) / 6, sag = (t: number) => 0.55 * 4 * t * (1 - t);
                wires.push(prev.x + ox1 + (x + ox2 - prev.x - ox1) * t1, y - sag(t1), prev.z + oz1 + (z + oz2 - prev.z - oz1) * t1,
                  prev.x + ox1 + (x + ox2 - prev.x - ox1) * t2, y - sag(t2), prev.z + oz1 + (z + oz2 - prev.z - oz1) * t2);
              }
            }
          }
          prev = p;
        }
        acc += 32;
      }
      acc -= L;
    }
  }
  const pole = new THREE.BoxGeometry(0.22, 7.8, 0.22); pole.translate(0, 3.9, 0);
  const arm = new THREE.BoxGeometry(1.6, 0.1, 0.1); arm.translate(0, 7.3, 0);
  const box = new THREE.BoxGeometry(0.35, 0.5, 0.25); box.translate(0, 5.2, 0.2);
  const mP = new THREE.InstancedMesh(pole, new THREE.MeshLambertMaterial({ color: '#a8a39a' }), pts.length);
  const mA = new THREE.InstancedMesh(arm, new THREE.MeshLambertMaterial({ color: '#5d6266' }), pts.length);
  const mB = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: '#6f777d' }), pts.length);
  const d = new THREE.Object3D();
  pts.forEach((p, i) => { d.position.set(p.x, getH(p.x, p.z), p.z); d.rotation.set(0, p.rot, 0); d.updateMatrix(); mP.setMatrixAt(i, d.matrix); mA.setMatrixAt(i, d.matrix); mB.setMatrixAt(i, d.matrix); });
  for (const m of [mP, mA, mB]) { m.castShadow = true; scene.add(m); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#1a1a1a' })));
}

/** Painted boards over the shops on the main roads: common shop names in English and Bangla. */
const SHOPS: [string, string, string][] = [
  ['Maa Tara Store', 'মা তারা স্টোর', '#c62f2f'], ['Loknath Medical Hall', 'লোকনাথ মেডিক্যাল', '#1f6f5c'], ['Durga Sweets', 'দুর্গা মিষ্টান্ন ভাণ্ডার', '#e9a23b'], ['New Sarkar Electronics', 'নিউ সরকার ইলেকট্রনিক্স', '#2f6fb0'],
  ['Annapurna Hotel', 'অন্নপূর্ণা হোটেল', '#8c2346'], ['Tripura Cloth House', 'ত্রিপুরা বস্ত্রালয়', '#6b3fa0'], ['Jai Ma Kali Hardware', 'জয় মা কালী হার্ডওয়্যার', '#5d6266'], ['Saha Stationery', 'সাহা স্টেশনারি', '#2f8f4e'],
  ['Mobile Point', 'মোবাইল পয়েন্ট', '#d0408a'], ['Shree Ganesh Bhandar', 'শ্রী গণেশ ভাণ্ডার', '#c0532f'], ['Debnath Tailors', 'দেবনাথ টেলার্স', '#24336f'], ['Rice & Grocery', 'চাল ও মুদি', '#7a5a3a'],
  ['Bishal Pharmacy', 'বিশাল ফার্মেসি', '#1f6f5c'], ['Photo Studio', 'ফটো স্টুডিও', '#3a3f55'], ['Mishti Mukh', 'মিষ্টি মুখ', '#e9b23b'], ['Bicycle Repair', 'সাইকেল সারাই', '#2f6fb0'],
];
function shopBoards(scene: THREE.Scene, kit: Kit, plans: Plan[], rng: () => number): void {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024; const c = cv.getContext('2d')!;
  SHOPS.forEach(([en, bn, col], i) => {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 256;
    c.fillStyle = col; c.fillRect(x + 2, y + 66, 252, 124); c.fillStyle = '#f6efe0'; c.textAlign = 'center';
    c.font = '700 30px "Hind Siliguri", system-ui, sans-serif'; c.fillText(en, x + 128, y + 116); c.font = '28px "Tiro Bangla", "Hind Siliguri", sans-serif'; c.fillText(bn, x + 128, y + 166);
  });
  const tex = canvasTexture(cv);
  const groups = SHOPS.map((_, i) => ({ i, list: [] as THREE.Matrix4[] }));
  const d = new THREE.Object3D();
  for (const p of plans) {
    if (!/^shop/.test(p.arch) || p.place) continue;
    const g = groups[Math.floor(rng() * SHOPS.length)]; const fx = Math.sin(p.ang), fz = Math.cos(p.ang); const w = Math.min(p.w * 0.85, 7);
    d.position.set(p.cx + fx * (p.d / 2 + 0.06), 3.1, p.cz + fz * (p.d / 2 + 0.06)); d.rotation.set(0, p.ang, 0); d.scale.set(w, w * 0.48, 1); d.updateMatrix(); g.list.push(d.matrix.clone());
    void kit;
  }
  for (const g of groups) {
    if (!g.list.length) continue;
    const geo = new THREE.PlaneGeometry(1, 1); const u = (g.i % 4) / 4, v = 1 - (Math.floor(g.i / 4) + 1) / 4;
    const uv = geo.attributes.uv as THREE.BufferAttribute; for (let k = 0; k < uv.count; k++) uv.setXY(k, u + uv.getX(k) * 0.25, v + (0.25 * 66) / 256 + uv.getY(k) * ((0.25 * 124) / 256));
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: tex }), g.list.length); g.list.forEach((mt, k) => m.setMatrixAt(k, mt)); scene.add(m);
  }
}
