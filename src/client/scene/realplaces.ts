/**
 * The real places of College Tilla and around: name boards on their actual buildings, the Modern
 * Club Shiv Mandir, the masjid's dome, the MBB College gate and the stadium's galleries.
 */
import * as THREE from 'three';
import { REAL_PLACES, placeById, type RealPlace } from '../../shared/places.js';
import { colliders } from '../collide.js';
import { type CityMap, ROAD_W, getH } from '../map/data.js';
import type { Kit, Plan } from './buildings.js';
import { MAT, add, box, canvasTexture, cyl, place, sph } from './kit.js';

/** A painted name board: English on top, Bangla below. */
function board(name: string, bn: string | undefined, colour = '#1c3d5a', w = 0): THREE.Mesh {
  const cv = document.createElement('canvas'); const big = name.length > 26;
  cv.width = 1024; cv.height = bn ? 256 : 160; const c = cv.getContext('2d')!;
  c.fillStyle = colour; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#e9b23b'; c.fillRect(0, cv.height - 14, cv.width, 14);
  c.fillStyle = '#f6efe0'; c.textAlign = 'center'; c.font = `700 ${big ? 54 : 66}px "Hind Siliguri", system-ui, sans-serif`; c.fillText(name, 512, bn ? 100 : 100);
  if (bn) { c.font = '54px "Tiro Bangla", "Hind Siliguri", sans-serif'; c.fillStyle = '#ffe2a0'; c.fillText(bn, 512, 196); }
  const W = w || Math.max(4, Math.min(12, name.length * 0.32)), H = W * (cv.height / cv.width);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: canvasTexture(cv), side: THREE.DoubleSide }));
  return m;
}

export class RealPlaces {
  constructor(scene: THREE.Scene, private map: CityMap, kit: Kit, plans: Plan[]) {
    for (const pl of REAL_PLACES) {
      const mine = plans.filter((p) => p.place === pl.id);
      if (pl.kind === 'temple') { const p = mine[0]; this.temple(scene, p ? p.cx : pl.x, p ? p.cz : pl.z, p ? p.ang : 0); continue; }
      if (!mine.length) continue;
      // the main building: the one nearest the place's own point
      const p = mine.reduce((a, b) => (Math.hypot(a.cx - pl.x, a.cz - pl.z) <= Math.hypot(b.cx - pl.x, b.cz - pl.z) ? a : b));
      const h = kit.arch.get(p.arch)?.h ?? 6;
      if (pl.id !== 'mbbcollege') this.sign(scene, pl, p, Math.min(h - 0.6, 4.2));
      if (pl.kind === 'mosque') this.dome(scene, p, h);
    }
    this.collegeGate(scene);
    this.stadium(scene);
  }

  /** A board fixed to the front wall of a building, facing its road. */
  private sign(scene: THREE.Scene, pl: RealPlace, p: Plan, y: number): void {
    const fx = Math.sin(p.ang), fz = Math.cos(p.ang);
    const colour = pl.kind === 'clinic' ? '#2f6f5a' : pl.kind === 'school' || pl.kind === 'college' ? '#24336f' : pl.kind === 'mosque' ? '#1f6f3c' : '#7d1d3f';
    const b = board(pl.name, pl.bn, colour, Math.min(p.w * 0.85, Math.max(4, pl.name.length * 0.3)));
    b.position.set(p.cx + fx * (p.d / 2 + 0.12), getH(p.cx, p.cz) + y, p.cz + fz * (p.d / 2 + 0.12)); b.rotation.y = p.ang; scene.add(b);
  }

  /** A small white temple with a shikhara, a kalash and a saffron flag. */
  private temple(scene: THREE.Scene, x: number, z: number, rot: number): void {
    const g = new THREE.Group();
    box(g, 9, 0.6, 9, '#d9cfbf', 0, 0.3, 0); box(g, 7, 3.4, 7, '#f6efe0', 0, 2.3, 0); box(g, 2.4, 2.6, 0.2, '#7d1d3f', 0, 1.9, 3.55);
    for (let i = 0; i < 5; i++) box(g, 5.2 - i * 0.9, 1, 5.2 - i * 0.9, i % 2 ? '#f0e4cc' : '#f6efe0', 0, 4.5 + i * 1, 0);
    add(g, new THREE.ConeGeometry(0.9, 1.8, 8), '#e9b23b', 0, 10.4, 0); sph(g, 0.35, '#e9b23b', 0, 11.5, 0, 8, 6);
    cyl(g, 0.04, 0.04, 2.2, '#5b4632', 0, 12.6, 0, 4); const flag = box(g, 0.9, 0.5, 0.03, '#f39a1c', 0.45, 13.4, 0); flag.rotation.y = 0.2;
    for (const sx of [-2.9, 2.9]) cyl(g, 0.25, 0.25, 3.4, '#ece2cf', sx, 2.3, 3.6, 8);
    const bell = sph(g, 0.22, '#c9a24a', 0, 3.6, 3.6, 8, 6); bell.scale.y = 1.2;
    place(scene, g, x, z, rot); colliders.push({ x, z, r: 4.6 });
    const b = board('Modern Club Shiv Mandir', 'মডার্ন ক্লাব শিব মন্দির', '#7d1d3f', 5); b.position.set(x + Math.sin(rot) * 4.7, getH(x, z) + 4.4, z + Math.cos(rot) * 4.7); b.rotation.y = rot; scene.add(b);
  }

  /** A green dome and a slim minaret on the masjid's roof. */
  private dome(scene: THREE.Scene, p: Plan, h: number): void {
    const g = new THREE.Group(); const y = getH(p.cx, p.cz) + h * 0.92;
    add(g, new THREE.SphereGeometry(Math.min(p.w, p.d) * 0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#2f8f4e', 0, 0, 0);
    cyl(g, 0.08, 0.08, 1.2, '#e9b23b', 0, Math.min(p.w, p.d) * 0.28 + 0.4, 0, 6);
    const m = new THREE.Group(); cyl(m, 0.4, 0.5, 7, '#f2f2ec', 0, 3.5, 0, 8); add(m, new THREE.ConeGeometry(0.55, 1.4, 8), '#2f8f4e', 0, 7.7, 0);
    m.position.set(p.w * 0.35, 0, -p.d * 0.3); g.add(m);
    g.position.set(p.cx, y, p.cz); g.rotation.y = p.ang; scene.add(g);
  }

  /** The college gate: two pillars and an arch across the road up to the main building. */
  private collegeGate(scene: THREE.Scene): void {
    const rn = this.map.roadNear(1548, 1108); if (!rn) return;
    const ang = this.map.roadAngle(rn), hw = ROAD_W[rn.r.t] / 2 + 0.9; const px = Math.cos(ang), pz = -Math.sin(ang);
    const g = new THREE.Group();
    for (const s of [-1, 1]) { box(g, 1.1, 5.2, 1.1, '#d9a441', s * hw, 2.6, 0); box(g, 1.4, 0.4, 1.4, '#7a4a22', s * hw, 5.4, 0); sph(g, 0.4, '#7a4a22', s * hw, 5.9, 0, 8, 6); }
    box(g, hw * 2 + 1.2, 0.5, 0.7, '#7a4a22', 0, 5.0, 0);
    const b = board('Maharaja Bir Bikram College', 'মহারাজা বীর বিক্রম কলেজ · ১৯৪৭', '#7a4a22', Math.min(hw * 2, 9)); b.position.set(0, 6.5, 0); g.add(b);
    g.position.set(rn.px, getH(rn.px, rn.pz), rn.pz); g.rotation.y = ang; scene.add(g);
    for (const s of [-1, 1]) colliders.push({ x: rn.px + px * s * hw, z: rn.pz + pz * s * hw, r: 0.8 });
    void placeById;
  }

  /** Stepped galleries round the ground, wherever the oval's edge is clear of buildings and roads. */
  private stadium(scene: THREE.Scene): void {
    const cx = 1459, cz = 962, rx = 92, rz = 86; const step = (Math.PI * 2) / 64;
    const tier = new THREE.BoxGeometry(1, 1, 1); const concrete = new THREE.MeshLambertMaterial({ color: '#b8b2a6' });
    const seatCols = ['#2f6fb0', '#e9b23b', '#c62f2f'].map((c) => new THREE.MeshLambertMaterial({ color: c }));
    const placed: { x: number; z: number; a: number; len: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += step) {
      const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz, ok = !this.map.nearBuilding(x, z, 3) && !this.map.inWaterPoly(x, z);
      const r = this.map.roadNear(x, z); if (!ok || (r && r.d < ROAD_W[r.r.t] / 2 + 4)) continue;
      const len = Math.hypot(Math.cos(a + step) * rx - Math.cos(a) * rx, Math.sin(a + step) * rz - Math.sin(a) * rz) + 0.2;
      placed.push({ x, z, a, len });
    }
    const n = placed.length * 4; const base = new THREE.InstancedMesh(tier, concrete, n), seats = seatCols.map((m) => new THREE.InstancedMesh(tier, m, placed.length));
    const d = new THREE.Object3D(); let k = 0;
    placed.forEach((p, i) => {
      const nx = Math.cos(p.a), nz = Math.sin(p.a); const rot = Math.atan2(nx, nz);
      for (let t = 0; t < 4; t++) { d.position.set(p.x + nx * t * 1.6, 0.5 + t * 0.9, p.z + nz * t * 1.6); d.rotation.set(0, rot, 0); d.scale.set(p.len, 1 + t * 1.8, 1.6); d.updateMatrix(); base.setMatrixAt(k++, d.matrix); }
      const sc = seats[Math.floor(i / 4) % 3]; d.position.set(p.x + nx * 5.6, 4.3, p.z + nz * 5.6); d.scale.set(p.len, 0.25, 1.4); d.updateMatrix(); sc.setMatrixAt(i, d.matrix);
      colliders.push({ x: p.x + nx * 2.4, z: p.z + nz * 2.4, r: 2.6 });
    });
    for (const m of [base, ...seats]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    // the name over the north gate, by the tomtom stand
    const g = new THREE.Group(); for (const s of [-4.5, 4.5]) cyl(g, 0.2, 0.2, 7, '#5d6266', s, 3.5, 0, 6);
    const b = board('Maharaja Bir Bikram Stadium', 'মহারাজা বীর বিক্রম স্টেডিয়াম', '#1c3d5a', 9.5); b.position.y = 7.4; g.add(b);
    const gx = cx, gz = cz - rz - 12; const rn = this.map.roadNear(gx, gz); place(scene, g, rn ? rn.px + 8 : gx, rn ? rn.pz + 6 : gz, rn ? this.map.roadAngle(rn) + Math.PI / 2 : 0);
    void MAT;
  }
}
