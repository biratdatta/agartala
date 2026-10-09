/**
 * The player's house: the stilt house, tulsi mancha, front fence, Grandpa and the bed. It sits at
 * the family fields by default and moves to wherever the player says home is in Agartala.
 */
import * as THREE from 'three';
import { HOME } from '../shared/farm.js';
import type { HomeSite } from '../shared/stands.js';
import { colliders, type Collider } from './collide.js';
import { M, add, box, cyl } from './scene/kit.js';
import { stiltHouse } from './scene/landmarks.js';
import type { Npc } from './scene/landmarks.js';

type Round = Extract<Collider, { r: number }>;
interface Local { c: Round; lx: number; lz: number }

const GRANDPA_LOCAL = { x: 4, z: 10.5 }, BED_LOCAL = { x: 0.8, z: 5.4 }, KITCHEN_LOCAL = { x: -3.4, z: 6 };

export class HomeView {
  readonly group = new THREE.Group();
  private locals: Local[] = [];
  private origin = { x: HOME.x, z: HOME.z, ry: 0 };
  private grandpaCol: Round | undefined;

  constructor(scene: THREE.Scene, private grandpa: Npc) {
    const before = colliders.length;
    const house = stiltHouse(scene, 0, 0, 0, 8, 5.5); scene.remove(house); house.position.set(0, 0, 0); this.group.add(house);
    const t = new THREE.Group(); box(t, 0.8, 0.9, 0.8, '#cdb48a', 0, 0.45, 0); add(t, new THREE.IcosahedronGeometry(0.45, 0), M('#3f7a2c'), 0, 1.2, 0); t.position.set(-4, 0, 10); this.group.add(t);
    colliders.push({ x: -4, z: 10, r: 0.6 });
    // the outdoor chula: a clay stove with a pot, under a little thatch
    const k = new THREE.Group(); box(k, 1.1, 0.5, 0.8, '#a0583a', 0, 0.25, 0); cyl(k, 0.28, 0.22, 0.3, '#3a2a20', 0, 0.62, 0, 10);
    for (const [x, z] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) cyl(k, 0.04, 0.04, 2, '#6b5432', x, 1, z, 4);
    box(k, 2, 0.12, 1.6, '#b39150', 0, 2.02, 0).rotation.x = 0.12; k.position.set(KITCHEN_LOCAL.x, 0, KITCHEN_LOCAL.z); this.group.add(k);
    colliders.push({ x: KITCHEN_LOCAL.x, z: KITCHEN_LOCAL.z, r: 0.7 });
    for (let x = -20; x <= 20; x += 2.5) if (Math.abs(x - 4) > 3) { const f = new THREE.Group(); cyl(f, 0.05, 0.05, 1.1, '#9c8a52', 0, 0.55, 0, 4); f.position.set(x, 0, 13.5); this.group.add(f); }
    for (const c of colliders.slice(before)) if ('r' in c) this.locals.push({ c, lx: c.x, lz: c.z });
    this.grandpaCol = colliders.find((c): c is Round => 'r' in c && c.x === grandpa.x && c.z === grandpa.z);
    scene.add(this.group);
    this.place(null);
  }

  /** Local house coordinates → world. The house's front (+Z) faces the lane. */
  private world(lx: number, lz: number): { x: number; z: number } {
    const { x, z, ry } = this.origin; const c = Math.cos(ry), s = Math.sin(ry);
    return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
  }

  place(site: HomeSite | null): void {
    this.origin = site ? { x: site.x, z: site.z, ry: site.face } : { x: HOME.x, z: HOME.z, ry: 0 };
    this.group.position.set(this.origin.x, 0, this.origin.z); this.group.rotation.y = this.origin.ry;
    for (const l of this.locals) { const w = this.world(l.lx, l.lz); l.c.x = w.x; l.c.z = w.z; }
    const g = this.world(GRANDPA_LOCAL.x, GRANDPA_LOCAL.z);
    this.grandpa.x = g.x; this.grandpa.z = g.z; this.grandpa.g.position.set(g.x, 0, g.z); this.grandpa.g.rotation.y = this.origin.ry;
    if (this.grandpaCol) { this.grandpaCol.x = g.x; this.grandpaCol.z = g.z; }
  }

  get bed(): { x: number; z: number } { return this.world(BED_LOCAL.x, BED_LOCAL.z); }
  get kitchen(): { x: number; z: number } { return this.world(KITCHEN_LOCAL.x, KITCHEN_LOCAL.z); }
  get front(): { x: number; z: number } { return this.world(0, 16); }
}
