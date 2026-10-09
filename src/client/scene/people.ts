/** People, tomtoms and bicycles, and the traffic that moves along real roads. */
import * as THREE from 'three';
import { lerp, mulberry } from '../../shared/rng.js';
import { type CityMap, type Road, ROAD_W, getH } from '../map/data.js';
import { MAT, add, box, cyl, sph } from './kit.js';

export interface PersonLook { female?: boolean; shirt?: string; lowerMat?: THREE.Material; skin?: string; hair?: string; bun?: boolean; wrap?: string; shawl?: boolean; gamcha?: boolean; basket?: boolean; umbrella?: string }
export interface Rig { legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group; shawl: THREE.Mesh; phase: number }
export type Person = THREE.Group & { userData: Rig };

export function person(o: PersonLook): Person {
  const g = new THREE.Group() as Person; const skin = o.skin || '#9c6b45';
  const hip = new THREE.Group(); hip.position.y = 0.92; g.add(hip);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.12, 0, 0); legR.position.set(0.12, 0, 0); hip.add(legL, legR);
  for (const l of [legL, legR]) { box(l, 0.16, 0.9, 0.18, skin, 0, -0.45, 0); box(l, 0.18, 0.08, 0.28, '#2b2018', 0, -0.88, 0.05); }
  if (o.female) add(g, new THREE.CylinderGeometry(0.3, 0.42, 0.96, 10), o.lowerMat || MAT.rignai, 0, 0.5, 0);
  else if (o.lowerMat) add(g, new THREE.CylinderGeometry(0.29, 0.33, 0.72, 10), o.lowerMat, 0, 0.62, 0);
  box(g, 0.58, 0.66, 0.32, o.shirt || '#e8e1d0', 0, 1.3, 0);
  if (o.female) add(g, new THREE.CylinderGeometry(0.33, 0.33, 0.3, 10), MAT.risa, 0, 1.38, 0);
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.38, 1.6, 0); armR.position.set(0.38, 1.6, 0); g.add(armL, armR);
  for (const a of [armL, armR]) { box(a, 0.14, 0.62, 0.16, o.shirt || skin, 0, -0.3, 0); sph(a, 0.07, skin, 0, -0.63, 0, 6, 4); }
  sph(g, 0.1, skin, 0, 1.7, 0, 6, 4); sph(g, 0.2, skin, 0, 1.92, 0, 12, 10);
  sph(g, 0.205, o.hair || '#141012', 0, 1.97, -0.03, 12, 10).scale.set(1, 0.82, 1);
  if (o.bun) sph(g, 0.1, o.hair || '#141012', 0, 1.98, -0.2, 8, 6);
  if (o.wrap) cyl(g, 0.22, 0.21, 0.14, o.wrap, 0, 2.06, 0, 12);
  const shawl = add(g, new THREE.BoxGeometry(0.66, 0.2, 0.38), MAT.rignai2, 0, 1.58, 0); shawl.visible = !!o.shawl;
  if (o.gamcha) box(g, 0.1, 0.5, 0.34, '#b8342e', 0.22, 1.4, 0).rotation.z = 0.25;
  if (o.basket) cyl(g, 0.24, 0.16, 0.32, '#9c7a40', 0, 1.5, -0.3, 10);
  if (o.umbrella) { cyl(g, 0.02, 0.02, 1.1, '#222', 0.3, 2.1, 0, 4); add(g, new THREE.ConeGeometry(0.75, 0.35, 8), o.umbrella, 0.3, 2.75, 0); }
  g.userData = { legL, legR, armL, armR, shawl, phase: Math.random() * 6 };
  return g;
}

export function animPerson(p: Person, speed: number, dt: number): void {
  const u = p.userData; u.phase += dt * speed * 5.5; const a = speed > 0.05 ? Math.sin(u.phase) * 0.6 : 0;
  u.legL.rotation.x = lerp(u.legL.rotation.x, a, 0.3); u.legR.rotation.x = lerp(u.legR.rotation.x, -a, 0.3);
  u.armL.rotation.x = lerp(u.armL.rotation.x, -a * 0.7, 0.3); u.armR.rotation.x = lerp(u.armR.rotation.x, a * 0.7, 0.3);
}

/** Bends a person into a sitting pose (or straightens them again). */
export function sit(p: Person, on = true): void {
  const u = p.userData; u.legL.rotation.x = u.legR.rotation.x = on ? -1.45 : 0; u.armL.rotation.x = u.armR.rotation.x = on ? -0.6 : 0;
}

/** The battery e-rickshaw everyone in Agartala calls a tomtom. */
export function tomtom(body = '#2f8f4e'): THREE.Group {
  const g = new THREE.Group();
  box(g, 1.25, 0.75, 2.3, body, 0, 0.72, 0); box(g, 1.2, 0.55, 0.1, '#9fc7d6', 0, 1.4, 1.1);
  for (const [x, z] of [[-0.6, -1.05], [0.6, -1.05], [-0.6, 1.05], [0.6, 1.05]]) cyl(g, 0.035, 0.035, 1.1, '#2a2a2a', x, 1.65, z, 4);
  box(g, 1.38, 0.08, 2.55, '#1f3a2a', 0, 2.22, 0); box(g, 1.1, 0.3, 0.6, '#6b2a22', 0, 1.2, -0.5);
  for (const [x, z] of [[0, 1.15], [-0.62, -0.8], [0.62, -0.8]]) cyl(g, 0.3, 0.3, 0.16, '#1a1a1a', x, 0.3, z, 10).rotation.z = Math.PI / 2;
  return g;
}

export function bicycle(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.55, 0.55]) add(g, new THREE.TorusGeometry(0.33, 0.035, 4, 14), '#1a1a1a', 0, 0.35, z).rotation.y = Math.PI / 2;
  box(g, 0.05, 0.05, 1.1, '#2f4f7a', 0, 0.62, 0).rotation.x = 0.1; box(g, 0.05, 0.5, 0.05, '#2f4f7a', 0, 0.6, -0.15);
  box(g, 0.5, 0.04, 0.04, '#222', 0, 1.05, 0.5); box(g, 0.18, 0.05, 0.3, '#222', 0, 0.9, -0.2);
  return g;
}

export const LOOKS: PersonLook[] = [
  { female: true, shirt: '#24336f', lowerMat: MAT.rignai2, basket: true, bun: true }, { shirt: '#c9b98e', lowerMat: MAT.lungi },
  { female: true, shirt: '#c0532f', lowerMat: MAT.rignai, bun: true, umbrella: '#2b2b2b' }, { shirt: '#3b5e7d', lowerMat: MAT.lungi2 },
  { female: true, shirt: '#1f6f5c', lowerMat: MAT.rignai2, bun: true }, { shirt: '#e8e1d0', lowerMat: MAT.lungi, gamcha: true },
  { shirt: '#f2f2f2', lowerMat: new THREE.MeshLambertMaterial({ color: '#3a3f55' }) }, { female: true, shirt: '#d0408a', lowerMat: new THREE.MeshLambertMaterial({ color: '#d0408a' }), bun: true },
];

interface Mover { r: Road; s: number; t: number; dir: number; speed: number; side: number }

/** Picks a random road near a point (within `rMin`..`rMax` metres) and a spot on it. */
function spawnNear(map: CityMap, rng: () => number, px: number, pz: number, rMin: number, rMax: number, maxT: number): Mover | null {
  for (let k = 0; k < 12; k++) {
    const a = rng() * Math.PI * 2, d = rMin + rng() * (rMax - rMin);
    const h = map.roadNear(px + Math.cos(a) * d, pz + Math.sin(a) * d, maxT);
    if (!h || h.d > 40 || h.r.n < 2) continue;
    const L = Math.hypot(h.r.xs[h.s + 1] - h.r.xs[h.s], h.r.zs[h.s + 1] - h.r.zs[h.s]) || 1;
    const t = Math.min(1, Math.max(0, Math.hypot(h.px - h.r.xs[h.s], h.pz - h.r.zs[h.s]) / L));
    return { r: h.r, s: h.s, t, dir: rng() < 0.5 ? 1 : -1, speed: 1, side: 0 };
  }
  return null;
}
/** Advances a mover along its road, turning back at the ends. Returns position and heading (keeping left). */
function step(m: Mover, dt: number): { x: number; z: number; rot: number } {
  const r = m.r; const L = Math.hypot(r.xs[m.s + 1] - r.xs[m.s], r.zs[m.s + 1] - r.zs[m.s]) || 1;
  m.t += (dt * m.speed * m.dir) / L;
  if (m.t > 1) { if (m.s < r.n - 2) { m.s++; m.t = 0; } else { m.t = 1; m.dir = -1; } }
  if (m.t < 0) { if (m.s > 0) { m.s--; m.t = 1; } else { m.t = 0; m.dir = 1; } }
  const ax = r.xs[m.s], az = r.zs[m.s], bx = r.xs[m.s + 1], bz = r.zs[m.s + 1];
  const dx = (bx - ax) * m.dir, dz = (bz - az) * m.dir, l = Math.hypot(dx, dz) || 1;
  return { x: lerp(ax, bx, m.t) + (dz / l) * m.side, z: lerp(az, bz, m.t) - (dx / l) * m.side, rot: Math.atan2(dx, dz) };
}

const SHIRTS = ['#e8e1d0', '#24336f', '#c0532f', '#3b5e7d', '#1f6f5c', '#d0408a', '#f2f2f2', '#c9b98e', '#7d1d3f', '#e9b23b', '#6b8fb3', '#3e6b3a', '#b8342e', '#8c6bb0', '#2b2b2b'];
const LOWERS = ['#2f4f7a', '#7d1d3f', '#3e6b3a', '#24336f', '#3a3f55', '#d8d2c4', '#5a3a2a', '#1a1420', '#c0532f', '#d0408a'];
const SKINS = ['#9c6b45', '#8a5d3c', '#b07a52', '#a8774f', '#7d5236'];

interface Walker extends Mover { phase: number; pause: number; faceTo: number; female: boolean; idle: boolean; x: number; z: number; rot: number }

/**
 * Crowds: hundreds of people drawn with a handful of instanced meshes. The crowd follows you:
 * anyone who falls far behind reappears on a lane somewhere ahead, so every street you walk
 * down is busy. People stop and face you when you talk to them.
 */
export class Crowd {
  private w: Walker[] = [];
  private parts: { mesh: THREE.InstancedMesh; local: THREE.Matrix4; swing: 'legL' | 'legR' | 'armL' | 'armR' | null; femaleOnly?: boolean; maleOnly?: boolean }[] = [];
  private m = new THREE.Matrix4(); private base = new THREE.Matrix4(); private swing = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private one = new THREE.Vector3(1, 1, 1); private up = new THREE.Vector3(0, 1, 0);
  private rng = mulberry(77); private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(scene: THREE.Scene, private map: CityMap, readonly count = 260) {
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const mk = (geo: THREE.BufferGeometry, local: THREE.Matrix4, swing: Crowd['parts'][0]['swing'], colors: (i: number) => string, extra: Partial<Crowd['parts'][0]> = {}) => {
      const mesh = new THREE.InstancedMesh(geo, mat, count); mesh.frustumCulled = false; mesh.castShadow = true;
      const c = new THREE.Color(); for (let i = 0; i < count; i++) mesh.setColorAt(i, c.set(colors(i)));
      scene.add(mesh); this.parts.push({ mesh, local, swing, ...extra });
    };
    const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
    const leg = new THREE.BoxGeometry(0.16, 0.9, 0.18); leg.translate(0, -0.45, 0); // pivot at the hip
    const arm = new THREE.BoxGeometry(0.13, 0.62, 0.15); arm.translate(0, -0.31, 0); // pivot at the shoulder
    const skin = (i: number) => SKINS[i % SKINS.length], shirt = (i: number) => SHIRTS[(i * 7) % SHIRTS.length], lower = (i: number) => LOWERS[(i * 3) % LOWERS.length];
    mk(leg, T(-0.12, 0.92, 0), 'legL', skin); mk(leg, T(0.12, 0.92, 0), 'legR', skin);
    mk(new THREE.CylinderGeometry(0.29, 0.4, 0.95, 8), T(0, 0.52, 0), null, lower, { femaleOnly: true });
    mk(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 8), T(0, 0.62, 0), null, lower, { maleOnly: true });
    mk(new THREE.BoxGeometry(0.56, 0.66, 0.3), T(0, 1.3, 0), null, shirt);
    mk(arm, T(-0.37, 1.6, 0), 'armL', shirt); mk(arm, T(0.37, 1.6, 0), 'armR', shirt);
    mk(new THREE.SphereGeometry(0.2, 8, 6), T(0, 1.9, 0), null, skin);
    mk(new THREE.SphereGeometry(0.21, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), T(0, 1.93, -0.02), null, (i) => (i % 11 === 0 ? '#bdb8b0' : '#161214'));
    for (let i = 0; i < count; i++) this.w.push({ r: map.roads[0], s: 0, t: 0, dir: 1, speed: 1.2, side: 2, phase: this.rng() * 6, pause: 0, faceTo: 0, female: i % 2 === 0, idle: false, x: 1e6, z: 1e6, rot: 0 });
  }
  private respawn(w: Walker, px: number, pz: number, near: boolean): void {
    const m = spawnNear(this.map, this.rng, px, pz, near ? 15 : 160, near ? 240 : 300, 4); if (!m) return;
    Object.assign(w, m);
    const hw = ROAD_W[m.r.t] / 2;
    // most people keep to the edge of the lane; some cross or walk in the middle like real streets
    w.side = (this.rng() < 0.5 ? 1 : -1) * (this.rng() < 0.8 ? hw + 0.3 + this.rng() * 0.7 : this.rng() * hw);
    w.speed = 0.9 + this.rng() * 0.8; w.idle = this.rng() < 0.12; w.pause = 0;
  }
  /** People out at a given hour: the evening rush is the busiest, the small hours nearly empty. */
  static densityAt(hour: number, rain: boolean): number {
    const h = hour; const d = h < 5 ? 0.12 : h < 7 ? 0.45 : h < 10 ? 0.85 : h < 16 ? 0.7 : h < 20 ? 1 : h < 23 ? 0.5 : 0.18;
    return d * (rain ? 0.6 : 1);
  }
  nearest(x: number, z: number, r: number): { i: number; x: number; z: number } | null {
    let best: { i: number; x: number; z: number } | null = null, bd = r;
    this.w.forEach((w, i) => { const d = Math.hypot(w.x - x, w.z - z); if (d < bd) { bd = d; best = { i, x: w.x, z: w.z }; } });
    return best;
  }
  hold(i: number, px: number, pz: number, seconds: number): void { const w = this.w[i]; if (!w) return; w.pause = seconds; w.faceTo = Math.atan2(px - w.x, pz - w.z); }
  private lastX = 1e6; private lastZ = 1e6;
  /** Share of the crowd out on the streets (busy at the evening rush, nearly empty at night). */
  density = 1;
  update(dt: number, px: number, pz: number): void {
    // after a jump or a tomtom ride, fill the new neighbourhood straight away
    const jumped = Math.abs(px - this.lastX) + Math.abs(pz - this.lastZ) > 150; this.lastX = px; this.lastZ = pz;
    const active = Math.round(this.w.length * Math.max(0, Math.min(1, this.density)));
    for (let i = 0; i < this.w.length; i++) {
      const w = this.w[i];
      if (i >= active) { for (const part of this.parts) part.mesh.setMatrixAt(i, this.zero); w.x = w.z = 1e6; continue; }
      const far = Math.abs(w.x - px) + Math.abs(w.z - pz);
      if (far > 420) this.respawn(w, px, pz, jumped || w.x > 1e5);
      let moving = false;
      if (w.pause > 0) { w.pause -= dt; w.rot = w.faceTo; }
      else if (!w.idle) { const p = step(w, dt); w.x = p.x; w.z = p.z; w.rot = p.rot; moving = true; }
      else if (w.x > 1e5) { const p = step(w, 0); w.x = p.x; w.z = p.z; w.rot = p.rot; }
      if (moving) w.phase += dt * (2.2 + w.speed * 3.2);
      // never stand inside a house: step back to the middle of the lane
      if (this.map.inBuilding(w.x, w.z)) { w.side *= 0.5; const p = step(w, 0); w.x = p.x; w.z = p.z; }
      this.q.setFromAxisAngle(this.up, w.rot); this.v.set(w.x, getH(w.x, w.z), w.z); this.base.compose(this.v, this.q, this.one);
      const near = far < 170, sw = moving && near ? Math.sin(w.phase) * 0.55 : 0;
      for (const part of this.parts) {
        if ((part.femaleOnly && !w.female) || (part.maleOnly && w.female)) { part.mesh.setMatrixAt(i, this.zero); continue; }
        this.m.multiplyMatrices(this.base, part.local);
        if (part.swing) { const a = part.swing === 'legL' || part.swing === 'armR' ? sw : -sw; this.swing.makeRotationX(part.swing.startsWith('arm') ? a * 0.8 : a); this.m.multiply(this.swing); }
        part.mesh.setMatrixAt(i, this.m);
      }
    }
    for (const part of this.parts) part.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Tomtoms on the bigger roads, keeping left as traffic does in India. Like the crowd, traffic
 * follows you around the city so the roads near you are always busy.
 */
export class Traffic {
  private cars: Mover[] = [];
  readonly crowd: Crowd;
  private rng = mulberry(21);
  /** Share of the tomtoms on the road. */
  density = 1;
  constructor(scene: THREE.Scene, private map: CityMap, private fleet: { set(i: number, x: number, y: number, z: number, rot: number): void; hide(i: number): void }, private carCount: number) {
    this.crowd = new Crowd(scene, map);
    for (let i = 0; i < carCount; i++) this.cars.push({ r: map.roads[0], s: 0, t: 0, dir: 1, speed: 0, side: 0 });
    this.pos = this.cars.map(() => ({ x: 1e6, z: 1e6 }));
  }
  private pos: { x: number; z: number }[];
  nearestWalker(x: number, z: number, r = 2.6): { i: number; g: { position: { x: number; z: number } } } | null {
    const n = this.crowd.nearest(x, z, r); return n ? { i: n.i, g: { position: { x: n.x, z: n.z } } } : null;
  }
  hold(i: number, px: number, pz: number, seconds = 6): void { this.crowd.hold(i, px, pz, seconds); }
  private jumped = false; private lx = 1e6; private lz = 1e6;
  update(dt: number, px: number, pz: number): void {
    this.jumped = Math.abs(px - this.lx) + Math.abs(pz - this.lz) > 150; this.lx = px; this.lz = pz;
    this.crowd.update(dt, px, pz);
    const active = Math.round(this.carCount * Math.max(0, Math.min(1, this.density)));
    for (let i = 0; i < this.carCount; i++) {
      const c = this.cars[i], p0 = this.pos[i];
      if (i >= active) { if (p0.x < 1e5) { this.fleet.hide(i); p0.x = p0.z = 1e6; } continue; }
      if (Math.abs(p0.x - px) + Math.abs(p0.z - pz) > 700) {
        const m = spawnNear(this.map, this.rng, px, pz, p0.x > 1e5 || this.jumped ? 20 : 250, 450, 3); if (m) { Object.assign(c, m); c.speed = 5 + this.rng() * 4; c.side = Math.min(1.8, ROAD_W[m.r.t] / 4); }
      }
      if (!c.speed) continue;
      const p = step(c, dt); if (this.map.inBuilding(p.x, p.z)) { c.side *= 0.5; }
      p0.x = p.x; p0.z = p.z; this.fleet.set(i, p.x, 0, p.z, p.rot);
    }
  }
}
