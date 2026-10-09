/**
 * Riding a tomtom: the driver takes the shortest route along the real streets, you sit in the
 * back, and the camera follows. The ride lasts as long as the server says it does, so the
 * tomtom's speed is set to cover the actual route in exactly that time. Space skips ahead.
 */
import * as THREE from 'three';
import type { Stand } from '../shared/stands.js';
import type { KitFleet } from './scene/buildings.js';
import { LOOKS, type Person, person, sit } from './scene/people.js';
import { along, type RoadGraph, type Route } from './route.js';
import type { CityMap } from './map/data.js';

export interface RideInfo { to: Stand; left: number; total: number }

export class RideView {
  private route: Route | null = null;
  private to: Stand | null = null;
  private start = 0; private ms = 1; private side = 1.4;
  private driver: Person;
  private line: THREE.Line;

  constructor(scene: THREE.Scene, private map: CityMap, private graph: RoadGraph, private fleet: KitFleet, private slot: number) {
    this.driver = person(LOOKS[5]); sit(this.driver); this.driver.visible = false; scene.add(this.driver);
    this.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f2c14a', transparent: true, opacity: 0.7, depthWrite: false }));
    this.line.visible = false; scene.add(this.line);
    fleet.hide(slot);
  }

  get active(): boolean { return !!this.route; }

  begin(from: Stand, to: Stand, start: number, ms: number): void {
    this.route = this.graph.route(from.x, from.z, to.x, to.z); this.to = to; this.start = start; this.ms = Math.max(1000, ms);
    this.driver.visible = true;
    // a faint golden line on the road shows where you're going
    const pts = this.route.pts.map(([x, z]) => new THREE.Vector3(x, 0.25, z)); this.line.geometry.dispose(); this.line.geometry = new THREE.BufferGeometry().setFromPoints(pts); this.line.visible = true;
  }

  /** Moves the tomtom, driver and seated player. Returns null when the ride is over. */
  update(now: number, rider: Person): RideInfo | null {
    if (!this.route || !this.to) return null;
    const f = (now - this.start) / this.ms;
    if (f >= 1) return null;
    const d = Math.max(0, f) * this.route.length;
    // keep left, but squeeze toward the middle of narrow lanes so the tomtom never brushes a wall
    let want = 1.4; for (const sd of [1.4, 0.7, 0]) { want = sd; const t = along(this.route, d, sd), t2 = along(this.route, Math.min(this.route.length, d + 3), sd); if (!this.map.inBuilding(t.x, t.z) && !this.map.inBuilding(t2.x, t2.z)) break; }
    this.side += (want - this.side) * 0.15;
    const p = along(this.route, d, this.side), ahead = along(this.route, Math.min(this.route.length, d + 6), this.side);
    const ang = Math.atan2(ahead.x - p.x, ahead.z - p.z) || p.ang;
    this.fleet.set(this.slot, p.x, 0, p.z, ang);
    const s = Math.sin(ang), c = Math.cos(ang);
    this.driver.position.set(p.x + s * 0.55, 0.62, p.z + c * 0.55); this.driver.rotation.y = ang;
    rider.position.set(p.x - s * 0.55, 0.62, p.z - c * 0.55); rider.rotation.y = ang;
    return { to: this.to, left: this.route.length - d, total: this.route.length };
  }

  heading(): number { return this.driver.rotation.y; }

  end(): void { this.route = null; this.to = null; this.driver.visible = false; this.line.visible = false; this.fleet.hide(this.slot); }
}
