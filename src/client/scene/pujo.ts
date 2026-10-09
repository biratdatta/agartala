/**
 * Durga Puja pandals round the city: a decorated gateway with the club's name, a tiered cloth roof,
 * strings of fairy lights, and inside, on a dais under a golden chalchitra, Ma Durga with ten arms
 * on her lion slaying Mahishasura, with Lakshmi and Ganesh on one side and Saraswati and Kartik on
 * the other. Dhakis drum at the front, and crowds gather after dark.
 */
import * as THREE from 'three';
import { PANDALS, type Pandal } from '../../shared/pujo.js';
import { colliders } from '../collide.js';
import { type CityMap } from '../map/data.js';
import { MAT, add, box, cyl, place, sph } from './kit.js';
import { LOOKS, type Person, person } from './people.js';
import { board } from './realplaces.js';

const SKIN = '#f2c28e', GOLD = '#e9b23b', GOLDGLOW = new THREE.MeshBasicMaterial({ color: '#ffcf5a' });

/** A goddess or god: saree or dhoti, torso, head with crown, two arms (more for Ma). */
function deity(g: THREE.Group, x: number, z: number, h: number, robe: string, opts: { arms?: number; crown?: string; skin?: string; ganesh?: boolean; spear?: boolean } = {}): void {
  const skin = opts.skin || SKIN;
  add(g, new THREE.ConeGeometry(0.42 * h, 0.95 * h, 10), robe, x, 0.48 * h, z);                 // saree or dhoti
  box(g, 0.42 * h, 0.42 * h, 0.24 * h, robe, x, 1.12 * h, z);                                   // torso
  if (opts.ganesh) { sph(g, 0.24 * h, skin, x, 1.48 * h, z + 0.02, 10, 8); cyl(g, 0.05 * h, 0.03 * h, 0.35 * h, skin, x, 1.32 * h, z + 0.2 * h, 6).rotation.x = 0.6; for (const s of [-1, 1]) { const e = sph(g, 0.14 * h, skin, x + s * 0.25 * h, 1.5 * h, z, 8, 6); e.scale.set(0.4, 1, 1); } }
  else sph(g, 0.17 * h, skin, x, 1.48 * h, z + 0.02, 10, 8);                                   // face
  add(g, new THREE.ConeGeometry(0.15 * h, 0.32 * h, 8), opts.crown || GOLD, x, 1.78 * h, z);   // mukut
  const arms = opts.arms || 2;
  for (let i = 0; i < arms; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), n = Math.ceil(arms / 2);
    const a = new THREE.Group(); a.position.set(x + side * 0.22 * h, 1.28 * h, z);
    const ang = arms > 2 ? -0.35 - (k / Math.max(1, n - 1)) * 1.9 : -0.25;                      // ten arms fan out like a halo
    a.rotation.z = side * ang; a.rotation.x = arms > 2 ? -0.15 * k : 0;
    box(a, 0.08 * h, 0.5 * h, 0.08 * h, skin, 0, -0.25 * h, 0);
    if (arms > 2) cyl(a, 0.015 * h, 0.015 * h, 0.35 * h, k % 2 ? '#c9c9c9' : GOLD, 0, -0.58 * h, 0, 4);   // her weapons
    g.add(a);
  }
  if (opts.spear) { const s = cyl(g, 0.02 * h, 0.02 * h, 1.3 * h, GOLD, x + 0.25 * h, 0.75 * h, z + 0.3 * h, 4); s.rotation.x = 0.7; } // the trishul into Mahishasura
}

/** One pandal, with its idols. Returns the group and its fairy lights. */
function pandal(p: Pandal, i: number): { g: THREE.Group; fairy: THREE.Object3D[] } {
  const g = new THREE.Group(); const [c1, c2] = p.theme; const fairy: THREE.Object3D[] = [];
  const W = 12, D = 10, H = 7;
  box(g, W + 1, 0.4, D + 1, '#d9cfbf', 0, 0.2, 0);                                           // plinth
  box(g, W, H, 0.3, c1, 0, H / 2 + 0.4, -D / 2); for (const s of [-1, 1]) box(g, 0.3, H, D, c1, s * W / 2, H / 2 + 0.4, 0); // cloth walls
  for (let k = 0; k < 6; k++) box(g, W - 0.1, 0.25, 0.32, k % 2 ? c2 : '#f6efe0', 0, 1.2 + k * 1.05, -D / 2 + 0.02); // stripes on the back drape
  // tiered roof with a kalash on top
  for (let t = 0; t < 3; t++) { const r = add(g, new THREE.ConeGeometry((W * 0.78 - t * 2.2), 2.2, 4, 1, true), t % 2 ? c2 : c1, 0, H + 1.4 + t * 1.6, 0); r.rotation.y = Math.PI / 4; (r.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide; }
  sph(g, 0.5, GOLD, 0, H + 6.3, 0, 10, 8); cyl(g, 0.06, 0.06, 1.2, GOLD, 0, H + 7.2, 0, 6);
  // the gateway: two tall pillars, a decorated arch and the club's name
  for (const s of [-1, 1]) { cyl(g, 0.55, 0.65, H + 1.5, c2, s * (W / 2 - 0.6), (H + 1.5) / 2 + 0.4, D / 2, 10); sph(g, 0.7, GOLD, s * (W / 2 - 0.6), H + 2.4, D / 2, 10, 8); }
  const arch = add(g, new THREE.TorusGeometry(W / 2 - 0.6, 0.35, 8, 24, Math.PI), c2, 0, H + 0.2, D / 2); arch.scale.y = 0.45;
  const b = board(p.name, p.bn, c1, Math.min(9, W - 2)); b.position.set(0, H + 1.6, D / 2 + 0.45); g.add(b);
  // the chalchitra: a golden arc behind the idols, always bright so Ma is lit
  const cc = new THREE.Mesh(new THREE.CircleGeometry(4.6, 32, 0, Math.PI), GOLDGLOW); cc.position.set(0, 2.2, -D / 2 + 0.4); g.add(cc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 32, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#c0532f', side: THREE.DoubleSide })); ring.position.set(0, 2.21, -D / 2 + 0.42); g.add(ring);
  // the dais and the family of Ma Durga
  box(g, 9.5, 1.0, 3.2, '#7a2e22', 0, 0.9, -D / 2 + 2.1); const dz = -D / 2 + 2.1;
  const y0 = new THREE.Group(); y0.position.y = 1.4; g.add(y0);
  // the lion: a golden body, mane and tail
  box(y0, 1.6, 0.7, 0.7, '#e3a84a', -0.9, 0.55, dz + 0.4); sph(y0, 0.48, '#c07a2a', -1.6, 0.95, dz + 0.4, 10, 8); sph(y0, 0.3, '#e3a84a', -1.85, 0.95, dz + 0.55, 8, 6);
  for (const lx of [-0.4, -1.4]) box(y0, 0.18, 0.5, 0.18, '#e3a84a', lx, 0.2, dz + 0.4);
  // Mahishasura, green, at her feet
  deity(y0, 0.9, dz + 0.7, 0.75, '#3f7a3a', { skin: '#5f8f4f', crown: '#3a3a3a' });
  // Ma Durga with ten arms
  deity(y0, 0, dz, 1.65, '#c62f2f', { arms: 10, spear: true });
  // Lakshmi and Ganesh on her right, Saraswati and Kartik on her left
  deity(y0, 2.3, dz + 0.2, 1.05, '#e86fa0'); deity(y0, 3.6, dz + 0.3, 1.0, '#f08a24', { ganesh: true, skin: '#f2e0c8' });
  deity(y0, -2.6, dz + 0.2, 1.05, '#f6f6f0'); deity(y0, -3.8, dz + 0.3, 1.0, '#2f6fb0', { crown: '#1f6f5c' });
  // dhakis at the front, with big dhak drums
  for (const s of [-1, 1]) {
    const d = person(LOOKS[(i + (s > 0 ? 1 : 3)) % LOOKS.length]); d.position.set(s * 3.6, 0.4, D / 2 - 1.2); d.rotation.y = s * 0.4; g.add(d);
    const drum = cyl(g, 0.45, 0.45, 0.9, '#c9a24a', s * 3.6, 1.35, D / 2 - 0.75, 12); drum.rotation.z = Math.PI / 2;
    const plume = sph(g, 0.35, '#f6f6f0', s * 3.6 + 0.4, 2.0, D / 2 - 0.75, 8, 6); plume.scale.y = 1.6;
  }
  // fairy lights along the arch, the pillars and the roof edges
  const bulb = new THREE.SphereGeometry(0.11, 6, 4);
  const addBulb = (x: number, y: number, z: number, k: number) => { const m = new THREE.Mesh(bulb, MAT.fairy[k % 4]); m.position.set(x, y, z); g.add(m); fairy.push(m); };
  for (let k = 0; k < 40; k++) { const a = (k / 39) * Math.PI; addBulb(Math.cos(a) * (W / 2 - 0.6), H + 0.2 + Math.sin(a) * (W / 2 - 0.6) * 0.45, D / 2 + 0.4, k); }
  for (const s of [-1, 1]) for (let k = 0; k < 14; k++) addBulb(s * (W / 2 - 0.6), 0.8 + k * 0.6, D / 2 + 0.7, k + (s > 0 ? 2 : 0));
  for (let k = 0; k < 32; k++) { const t = k / 31; addBulb(-W / 2 + t * W, H + 0.5, -D / 2 - 0.2, k); }
  return { g, fairy };
}

export class Pandals {
  readonly group = new THREE.Group();
  private fairy: THREE.Object3D[] = [];
  private crowds: Person[] = [];
  constructor(scene: THREE.Scene, map: CityMap) {
    PANDALS.forEach((p, i) => {
      const { g, fairy } = pandal(p, i); this.fairy.push(...fairy);
      const rn = map.roadNear(p.x, p.z); const rot = rn ? Math.atan2(rn.px - p.x, rn.pz - p.z) : 0;
      place(this.group, g, p.x, p.z, rot);
      const fx = Math.sin(rot), fz = Math.cos(rot), ux = Math.cos(rot), uz = -Math.sin(rot);
      for (const [u, v, r] of [[0, -3, 4.6], [-4.5, 0, 1.6], [4.5, 0, 1.6], [-5.4, 5, 0.8], [5.4, 5, 0.8]]) colliders.push({ x: p.x + ux * u + fx * v, z: p.z + uz * u + fz * v, r });
      // a crowd in front, there in the evenings
      for (let k = 0; k < 8; k++) {
        const c = person(LOOKS[(i * 3 + k) % LOOKS.length]); const u = ((k % 4) - 1.5) * 1.6, v = 6.5 + Math.floor(k / 4) * 1.4 + ((k * 37) % 5) * 0.1;
        c.position.set(p.x + ux * u + fx * v, 0, p.z + uz * u + fz * v); c.rotation.y = rot + Math.PI + ((k * 13) % 7 - 3) * 0.05; c.visible = false; this.group.add(c); this.crowds.push(c);
      }
    });
    this.group.visible = false; scene.add(this.group);
  }
  /** Shows the pandals (in the Puja season), lights them after dark, and brings the crowds out. */
  update(on: boolean, night: number, time: number): void {
    this.group.visible = on; if (!on) return;
    const lit = night > 0.3; for (const f of this.fairy) f.visible = lit;
    this.crowds.forEach((c, k) => { c.visible = lit || k % 3 === 0; if (c.visible) c.position.y = Math.max(0, Math.sin(time * 5 + k)) * 0.05; });
  }
}
