/**
 * Vehicles you drive yourself: walk up to one you own and press E to get on. W / S (or the joystick)
 * for throttle, brake and reverse, A / D to steer, Space for the brake, E to get off. Bicycles and
 * rickshaws are pedalled; the rest have engines. Each one handles differently: a car is fast but
 * wide, a cycle-rickshaw slow and heavy. Rickshaws and tomtoms can carry passengers between stands.
 */
import * as THREE from 'three';
import { clamp, lerp } from '../shared/rng.js';
import type { GameState } from '../shared/save.js';
import { standsFor, type Stand } from '../shared/stands.js';
import { FARES_PER_DAY, RENTALS, RENT_RATE, VEHICLES, fareFor, owns, rentalCost, vehicleByKey, type VehKey } from '../shared/vehicles.js';
import { ROAD_W } from './map/data.js';
import { GFX, canvasTexture } from './scene/kit.js';
import { glossify } from './scene/realistic.js';
import { play } from './audio.js';
import { blocked } from './collide.js';
import { type CityMap, getH } from './map/data.js';
import type { Player } from './player.js';
import { add, box, cyl, sph } from './scene/kit.js';
import { LOOKS, bicycle, person, sit, tomtom, type Person } from './scene/people.js';

interface Spec { max: number; accel: number; brake: number; reverse: number; turn: number; len: number; wid: number; cam: number; pitch: number; pedal: boolean; seat: [number, number, number]; pose: 'ride' | 'sit'; passenger?: [number, number, number]; lean: number }
/** Handling: top speed (m/s), acceleration, braking, steering rate, footprint and where the rider sits. */
const SPECS: Record<VehKey, Spec> = {
  cycle: { max: 9, accel: 3, brake: 7, reverse: 1.5, turn: 2.1, len: 1.7, wid: 0.6, cam: 6.5, pitch: 0.3, pedal: true, seat: [0, 0.35, -0.15], pose: 'ride', lean: 0.3 },
  rickshaw: { max: 6.5, accel: 1.8, brake: 5, reverse: 1.2, turn: 1.3, len: 2.9, wid: 1.2, cam: 7.5, pitch: 0.32, pedal: true, seat: [0, 0.45, 0.75], pose: 'ride', passenger: [0, 0.55, -0.55], lean: 0 },
  scooter: { max: 15, accel: 5.5, brake: 9, reverse: 1.5, turn: 1.9, len: 1.8, wid: 0.7, cam: 7, pitch: 0.3, pedal: false, seat: [0, 0.3, -0.25], pose: 'ride', lean: 0.35 },
  bike: { max: 22, accel: 7.5, brake: 11, reverse: 1.5, turn: 1.75, len: 2.1, wid: 0.8, cam: 7.5, pitch: 0.28, pedal: false, seat: [0, 0.38, -0.3], pose: 'ride', lean: 0.45 },
  tomtom: { max: 11, accel: 3.2, brake: 7, reverse: 2, turn: 1.25, len: 2.6, wid: 1.4, cam: 8.5, pitch: 0.32, pedal: false, seat: [0, 0.62, 0.55], pose: 'sit', passenger: [0, 0.62, -0.55], lean: 0 },
  car: { max: 24, accel: 6.5, brake: 12, reverse: 4, turn: 1.05, len: 3.8, wid: 1.65, cam: 9.5, pitch: 0.3, pedal: false, seat: [0.38, -0.72, 0.1], pose: 'sit', lean: 0 },
};

/* ---------- models (all face +z) ---------- */
function wheel(g: THREE.Object3D, r: number, x: number, y: number, z: number, t = 0.06): THREE.Mesh {
  const w = add(g, new THREE.TorusGeometry(r, t, 6, 16), '#1a1a1a', x, y, z); w.rotation.y = Math.PI / 2; return w;
}
function scooterModel(): THREE.Group {
  const g = new THREE.Group(); box(g, 0.5, 0.35, 1.3, '#c62f2f', 0, 0.45, -0.05); box(g, 0.45, 0.7, 0.18, '#c62f2f', 0, 0.75, 0.55); box(g, 0.6, 0.05, 0.05, '#222', 0, 1.15, 0.58); box(g, 0.42, 0.12, 0.6, '#1a1a1a', 0, 0.68, -0.3);
  for (const z of [-0.6, 0.7]) wheel(g, 0.22, 0, 0.22, z, 0.07);
  cyl(g, 0.08, 0.08, 0.05, '#ffe9a0', 0, 0.98, 0.66, 8).rotation.x = Math.PI / 2; return g;
}
function bikeModel(): THREE.Group {
  const g = new THREE.Group();
  for (const z of [-0.75, 0.8]) wheel(g, 0.32, 0, 0.32, z, 0.08);
  box(g, 0.32, 0.3, 0.9, '#2b2b2b', 0, 0.55, 0); box(g, 0.42, 0.25, 0.5, '#1f4fa0', 0, 0.82, 0.2); box(g, 0.34, 0.1, 0.6, '#151515', 0, 0.86, -0.3);
  box(g, 0.08, 0.6, 0.08, '#888', 0, 0.75, 0.68).rotation.x = -0.35; box(g, 0.7, 0.05, 0.05, '#222', 0, 1.08, 0.6);
  cyl(g, 0.11, 0.11, 0.08, '#fff2b0', 0, 0.95, 0.78, 10).rotation.x = Math.PI / 2; cyl(g, 0.06, 0.06, 0.7, '#9aa0a6', 0.2, 0.38, -0.35, 6).rotation.x = Math.PI / 2;
  return g;
}
function carModel(color: string): THREE.Group {
  const g = new THREE.Group();
  box(g, 1.62, 0.62, 3.7, color, 0, 0.58, 0); add(g, new THREE.BoxGeometry(1.46, 0.58, 2), new THREE.MeshLambertMaterial({ color: '#2d3f4f' }), 0, 1.16, -0.2);
  box(g, 1.5, 0.08, 2.05, color, 0, 1.47, -0.2);
  for (const [x, z] of [[-0.78, 1.2], [0.78, 1.2], [-0.78, -1.2], [0.78, -1.2]]) cyl(g, 0.3, 0.3, 0.22, '#151515', x, 0.3, z, 12).rotation.z = Math.PI / 2;
  for (const x of [-0.55, 0.55]) { box(g, 0.3, 0.14, 0.05, '#fff6c8', x, 0.68, 1.86); box(g, 0.28, 0.12, 0.05, '#c62f2f', x, 0.7, -1.86); }
  box(g, 1.3, 0.1, 0.08, '#333', 0, 0.42, 1.87); return g;
}
function rickshawModel(): THREE.Group {
  const g = new THREE.Group();
  wheel(g, 0.34, 0, 0.34, 1.1); box(g, 0.06, 0.06, 1.1, '#2f5f2f', 0, 0.62, 0.6).rotation.x = 0.15; box(g, 0.6, 0.05, 0.05, '#222', 0, 1.05, 1.05); box(g, 0.25, 0.08, 0.3, '#151515', 0, 0.85, 0.75);
  for (const x of [-0.55, 0.55]) wheel(g, 0.36, x, 0.36, -0.55);
  box(g, 1.15, 0.12, 0.7, '#c94a3a', 0, 0.62, -0.55); box(g, 1.15, 0.55, 0.1, '#2a7fb0', 0, 0.95, -0.9); box(g, 1.2, 0.08, 0.6, '#3a3a3a', 0, 0.38, -0.3);
  const hood = add(g, new THREE.CylinderGeometry(0.62, 0.62, 0.8, 12, 1, true, 0, Math.PI), new THREE.MeshLambertMaterial({ color: '#1f6f5c', side: THREE.DoubleSide }), 0, 1.3, -0.75);
  hood.rotation.z = Math.PI / 2; hood.rotation.y = Math.PI / 2;
  for (let i = 0; i < 5; i++) sph(g, 0.05, ['#e9b23b', '#d0408a', '#6ad1ff', '#8cff7a', '#ff5a5a'][i], -0.4 + i * 0.2, 1.78, -0.75, 6, 4);
  return g;
}
const CAR_COLOURS = ['#f2f2f2', '#c62f2f', '#2f6fb0', '#9aa0a6'];
function model(k: VehKey): THREE.Group {
  switch (k) {
    case 'cycle': return bicycle();
    case 'rickshaw': return rickshawModel();
    case 'scooter': return scooterModel();
    case 'bike': return bikeModel();
    case 'tomtom': return tomtom('#2f8f4e');
    case 'car': return carModel(CAR_COLOURS[0]);
  }
}

interface Ride { id: string; k: VehKey; g: THREE.Group; x: number; z: number; h: number; v: number; parked: 'home' | 'away'; lean: number; wheels: THREE.Object3D[]; rental?: string }
/** A rental point beside a tomtom stand. */
export interface RentalPoint { k: string; name: string; x: number; z: number; h: number }
interface Passenger { from: Stand; to: Stand; p: Person; fare: number }

export class Vehicles {
  private list = new Map<string, Ride>();
  /** Rental points round the paras, and the id of the vehicle you are renting (if any). */
  readonly points: RentalPoint[] = [];
  private rentedId: string | null = null;
  /** The vehicle you are on, if any. */
  riding: Ride | null = null;
  private passenger: Passenger | null = null;
  private savedCam = { dist: 5.5, pitch: 0.28 };
  private phase = 0; private lastBump = 0; private engineT = 0;

  constructor(private scene: THREE.Scene, private map: CityMap, private player: Player, private parking: (i: number) => { x: number; z: number; face: number }, avoid: { x: number; z: number }[] = []) {
    // a rental point beside every city tomtom stand, a row of vehicles along the road
    for (const st of standsFor(null)) {
      const kinds = RENTALS[st.k]; if (!kinds) continue;
      const spot = this.pointSpot(st.x, st.z, avoid); if (!spot) continue;
      const pt: RentalPoint = { k: st.k, name: st.name, ...spot }; this.points.push(pt);
      const ax = Math.sin(spot.h), az = Math.cos(spot.h); let off = 0;
      for (const k of kinds) {
        const L = SPECS[k].len; const r = this.make(`rent:${st.k}:${k}`, k); r.rental = st.k;
        r.x = spot.x + ax * (off + L / 2); r.z = spot.z + az * (off + L / 2); r.h = spot.h + Math.PI / 2; off += L + 1; this.place(r);
      }
      this.sign(pt);
    }
  }
  /** Open ground a few metres off the road near a stand, long enough for a row of vehicles. */
  private pointSpot(x: number, z: number, avoid: { x: number; z: number }[]): { x: number; z: number; h: number } | null {
    const rn = this.map.roadNear(x, z); const ang = rn ? this.map.roadAngle(rn) : 0;
    const ax = Math.sin(ang), az = Math.cos(ang), px = Math.cos(ang), pz = -Math.sin(ang);
    for (const along of [-9, 9, -14, 14, -20, 20, -26, 26]) for (const side of [5, -5, 7, -7]) {
      const cx = x + ax * along + px * side, cz = z + az * along + pz * side;
      if (avoid.some((a) => Math.hypot(a.x - cx, a.z - cz) < 8)) continue;
      let ok = true;
      for (let t = -1; t <= 11 && ok; t += 2) { const qx = cx + ax * t, qz = cz + az * t; if (blocked(this.map, qx, qz) || this.map.nearBuilding(qx, qz, 1.2)) ok = false; const r = this.map.roadNear(qx, qz); if (r && r.d < ROAD_W[r.r.t] / 2 + 0.8) ok = false; }
      if (ok) return { x: cx, z: cz, h: ang };
    }
    return null;
  }
  private sign(pt: RentalPoint): void {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const c = cv.getContext('2d')!;
    c.fillStyle = '#1f6f5c'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#e9b23b'; c.fillRect(0, 84, 256, 12);
    c.fillStyle = '#f6efe0'; c.textAlign = 'center'; c.font = '700 38px "Hind Siliguri", system-ui, sans-serif'; c.fillText('Rent a ride', 128, 46); c.font = '24px "Hind Siliguri", system-ui, sans-serif'; c.fillText('ভাড়া · by the hour', 128, 76);
    const g = new THREE.Group(); cyl(g, 0.05, 0.05, 2.4, '#444', 0, 1.2, 0, 5);
    const mat = new THREE.MeshLambertMaterial({ map: canvasTexture(cv) });
    for (const ry of [0, Math.PI]) { const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), mat); board.position.y = 2.3; board.rotation.y = ry; g.add(board); }
    g.position.set(pt.x - Math.sin(pt.h) * 1.5, getH(pt.x, pt.z), pt.z - Math.cos(pt.h) * 1.5); g.rotation.y = pt.h + Math.PI / 2; this.scene.add(g);
  }
  private make(id: string, k: VehKey): Ride {
    const g = model(k); if (GFX.realistic) glossify(g); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; }); this.scene.add(g);
    const wheels: THREE.Object3D[] = []; g.traverse((o) => { if ((o as THREE.Mesh).geometry instanceof THREE.TorusGeometry) wheels.push(o); });
    const r: Ride = { id, k, g, x: 0, z: 0, h: 0, v: 0, parked: 'home', lean: 0, wheels }; this.list.set(id, r); return r;
  }

  /** Makes sure every vehicle you own exists, parked by the house unless you left it somewhere. */
  sync(S: GameState, homeMoved = false): void {
    VEHICLES.forEach((d, i) => {
      if (!owns(S, d.k)) return;
      const r = this.list.get(`own:${d.k}`) || this.make(`own:${d.k}`, d.k);
      if (r.parked === 'home' && (homeMoved || r.x === 0) && this.riding !== r) { const p = this.parking(i); r.x = p.x; r.z = p.z; r.h = p.face; this.place(r); }
    });
    // the rental: picked up again after a reload (it waits beside you), or let go if the server ended it
    if (!S.rental && this.rentedId) this.rentedId = null;
    if (S.rental && !this.rentedId) {
      const free = [...this.list.values()].filter((r) => r.rental && r.k === S.rental!.veh);
      const r = free.find((v) => v.rental === S.rental!.from) || free[0];
      if (r) { this.rentedId = r.id; r.x = S.pos.x + 2.5; r.z = S.pos.z; r.h = S.pos.face; this.place(r); }
    }
  }
  private place(r: Ride): void { r.g.position.set(r.x, getH(r.x, r.z), r.z); r.g.rotation.set(0, r.h, r.lean, 'YXZ'); }
  get name(): string { return this.riding ? vehicleByKey(this.riding.k)!.name : ''; }

  /** Prompts for the parked vehicles near you (when on foot). */
  spots(S: GameState): { x: number; z: number; r: number; get: () => { label: string; run?: () => void } }[] {
    if (this.riding) return [];
    const px = this.player.x, pz = this.player.z;
    return [...this.list.values()].filter((r) => Math.abs(r.x - px) + Math.abs(r.z - pz) < 40).map((r) => ({ x: r.x, z: r.z, r: SPECS[r.k].len / 2 + 0.6, get: () => {
      const name = vehicleByKey(r.k)!.name.toLowerCase();
      if (!r.rental) return { label: `Ride your ${name}`, run: () => this.mount(r) };
      if (this.rentedId === r.id) return { label: `Ride your rented ${name} · ₹${rentalCost(S)} so far`, run: () => this.mount(r) };
      if (S.rental) return { label: `For rent: ${name} · return your ${vehicleByKey(S.rental.veh)!.name.toLowerCase()} first` };
      return { label: `Rent the ${name} · ₹${RENT_RATE[r.k]} an hour`, run: () => { if (this.onRent?.(r.k, r.rental!)) { this.rentedId = r.id; this.mount(r); } } };
    } }));
  }
  /** Rental points, for the map. */
  get rentalMarks(): { x: number; z: number }[] { return this.points.map((p) => ({ x: p.x, z: p.z })); }

  mount(r: Ride): void {
    this.riding = r; r.v = 0; this.savedCam = { dist: this.player.dist, pitch: this.player.pitch };
    this.player.dist = SPECS[r.k].cam; this.player.pitch = SPECS[r.k].pitch; this.player.yaw = r.h + Math.PI;
    sit(this.player.body, SPECS[r.k].pose === 'sit'); play(SPECS[r.k].pedal ? 'talk' : 'horn');
    const u = this.player.body.userData; this.player.body.rotation.x = 0;
    if (SPECS[r.k].pose === 'ride') { u.legL.rotation.x = u.legR.rotation.x = SPECS[r.k].pedal ? -0.9 : -1.2; u.armL.rotation.x = u.armR.rotation.x = -1.1; }
    u.armL.rotation.z = u.armR.rotation.z = 0;
    this.seatRider();
  }
  /** Gets off on whichever side is free. The vehicle stays where you left it. */
  dismount(): void {
    const r = this.riding; if (!r) return;
    const s = SPECS[r.k]; const rx = -Math.cos(r.h), rz = Math.sin(r.h);
    let px = r.x, pz = r.z;
    for (const side of [1, -1, 0]) { const x = r.x + rx * side * (s.wid / 2 + 0.8) - (side ? 0 : Math.sin(r.h) * (s.len / 2 + 0.8)), z = r.z + rz * side * (s.wid / 2 + 0.8) - (side ? 0 : Math.cos(r.h) * (s.len / 2 + 0.8)); if (!blocked(this.map, x, z)) { px = x; pz = z; break; } }
    r.v = 0; r.lean = 0; this.place(r); r.parked = 'away'; this.riding = null;
    sit(this.player.body, false); this.player.body.rotation.x = 0; this.player.teleport(px, pz, r.h);
    this.player.dist = this.savedCam.dist; this.player.pitch = this.savedCam.pitch;
    if (this.passenger) { this.scene.remove(this.passenger.p); this.passenger = null; }
  }
  /** Jumping across the map while riding takes the vehicle with you. */
  teleport(x: number, z: number, h: number): void { const r = this.riding; if (!r) return; r.x = x; r.z = z; r.h = h; r.v = 0; this.place(r); this.seatRider(); this.player.yaw = h + Math.PI; }
  /** Back by the house: used after loading a different farm. */
  sendHome(): void { if (this.riding) this.dismount(); for (const r of this.list.values()) if (!r.rental) { r.parked = 'home'; r.x = 0; } this.rentedId = null; }

  private seatRider(): void {
    const r = this.riding; if (!r) return; const s = SPECS[r.k];
    const c = Math.cos(r.h), sn = Math.sin(r.h); const [ox, oy, oz] = s.seat;
    const x = r.x + ox * c + oz * sn, z = r.z - ox * sn + oz * c;
    this.player.body.position.set(x, getH(r.x, r.z) + oy, z); this.player.body.rotation.set(0, r.h, r.lean, 'YXZ');
    if (this.passenger && s.passenger) { const [px, py, pz] = s.passenger; this.passenger.p.position.set(r.x + px * c + pz * sn, getH(r.x, r.z) + py, r.z - px * sn + pz * c); this.passenger.p.rotation.y = r.h; }
  }

  /** One frame of driving. `f` throttle (−1 reverse/brake … 1), `steer` (−1 left … 1 right). */
  drive(dt: number, f: number, steer: number, braking: boolean): void {
    const r = this.riding; if (!r) return; const s = SPECS[r.k];
    // throttle, brakes and rolling resistance
    if (f > 0.05) r.v += (r.v < 0 ? s.brake : s.accel * (1 - Math.max(0, r.v) / s.max)) * f * dt;
    else if (f < -0.05) r.v -= (r.v > 0.3 ? s.brake : s.accel * 0.6) * -f * dt;
    else r.v -= Math.sign(r.v) * Math.min(Math.abs(r.v), (s.pedal ? 1.6 : 1.1) * dt);
    if (braking) r.v -= Math.sign(r.v) * Math.min(Math.abs(r.v), s.brake * 1.3 * dt);
    r.v = clamp(r.v, -s.reverse, s.max);
    // steering: needs some speed, and gets gentler as you go faster
    const grip = clamp(Math.abs(r.v) / 3, 0, 1) / (1 + Math.abs(r.v) / (s.max * 1.4));
    r.h -= steer * s.turn * grip * Math.sign(r.v || 1) * dt;
    r.lean = lerp(r.lean, -steer * s.lean * clamp(Math.abs(r.v) / s.max, 0, 1) * 1.6, Math.min(1, dt * 5));
    // move in small steps, checking the nose, the corners and the tail against walls and water
    const dist = r.v * dt, steps = Math.max(1, Math.ceil(Math.abs(dist) / 0.4));
    for (let i = 0; i < steps; i++) {
      const fx = Math.sin(r.h), fz = Math.cos(r.h), rx = -fz, rz = fx; const d = dist / steps;
      const nx = r.x + fx * d, nz = r.z + fz * d; const L = s.len / 2, W = s.wid / 2; const dir = Math.sign(d) || 1;
      const probes = [[nx + fx * L * dir, nz + fz * L * dir], [nx + fx * L * dir + rx * W, nz + fz * L * dir + rz * W], [nx + fx * L * dir - rx * W, nz + fz * L * dir - rz * W], [nx, nz]];
      if (probes.some(([x, z]) => blocked(this.map, x, z))) {
        if (Math.abs(r.v) > 3 && performance.now() - this.lastBump > 600) { play('no'); this.lastBump = performance.now(); }
        r.v = -r.v * 0.25; break;
      }
      r.x = nx; r.z = nz;
    }
    this.place(r);
    for (const w of r.wheels) w.rotation.x -= (r.v * dt) / 0.33;
    // the rider: pedal, or just sit
    const u = this.player.body.userData;
    if (s.pedal) { this.phase += r.v * dt * 1.6; u.legL.rotation.x = -0.9 + Math.sin(this.phase) * 0.55; u.legR.rotation.x = -0.9 - Math.sin(this.phase) * 0.55; u.armL.rotation.x = u.armR.rotation.x = -1.1; }
    else if (s.pose === 'ride') { u.legL.rotation.x = u.legR.rotation.x = -1.2; u.armL.rotation.x = u.armR.rotation.x = -1.2; }
    this.seatRider();
    // the camera settles in behind unless you have just looked around
    if (performance.now() - this.player.lastLook > 1500 && Math.abs(r.v) > 1) { let dy = r.h + (r.v < 0 ? 0 : Math.PI) - this.player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.player.yaw += dy * Math.min(1, dt * 2.2); }
    // a little engine note now and then
    this.engineT += dt; if (!s.pedal && this.engineT > 0.9 && Math.abs(r.v) > 2) { this.engineT = 0; play('engine'); }
  }

  /* ---------- passengers (rickshaw and tomtom) ---------- */
  /** What E does while riding, and the line on the prompt. */
  prompt(S: GameState): { label: string; run: () => void } {
    const r = this.riding!; const d = vehicleByKey(r.k)!; const kmh = Math.round(Math.abs(r.v) * 3.6);
    const rented = this.rentedId === r.id;
    const base = `${d.name} · ${kmh} km/h${rented ? ` · ₹${rentalCost(S)} on the meter` : ''}`;
    if (rented && !this.passenger) {
      const pt = this.points.find((p) => Math.hypot(p.x - r.x, p.z - r.z) < 16);
      if (pt && Math.abs(r.v) < 2) return { label: `Return the ${d.name.toLowerCase()} at ${pt.name} · ₹${rentalCost(S)}`, run: () => { if (this.onReturn?.(pt.k)) { this.rentedId = null; r.rental = pt.k; this.dismount(); } } };
    }
    if (d.fares) {
      const stands = standsFor(S.home); const near = stands.find((st) => Math.hypot(st.x - r.x, st.z - r.z) < 12);
      if (this.passenger) {
        if (near && near.k === this.passenger.to.k && Math.abs(r.v) < 2) return { label: `Drop the passenger at ${near.name} · ₹${this.passenger.fare}`, run: () => this.dropOff(S) };
        return { label: `${base} · passenger for ${this.passenger.to.name}`, run: () => this.dismount() };
      }
      if (near && Math.abs(r.v) < 2) {
        if (S.fares.day === S.day && S.fares.n >= FARES_PER_DAY) return { label: `${base} · no more passengers today · E to get off`, run: () => this.dismount() };
        return { label: `Pick up a passenger at ${near.name}`, run: () => this.pickUp(S, near) };
      }
      return { label: `${base} · stop at a tomtom stand for passengers · E to get off`, run: () => this.dismount() };
    }
    return { label: `${base} · ${rented ? 'return it at any rental point · ' : ''}E to get off`, run: () => this.dismount() };
  }
  /** Where the passenger wants to go (for the gold marker), if anyone is aboard. */
  get target(): (Stand & { stand?: boolean }) | null { return this.passenger ? this.passenger.to : null; }
  private pickUp(S: GameState, at: Stand): void {
    const others = standsFor(S.home).filter((s) => s.k !== at.k && Math.hypot(s.x - at.x, s.z - at.z) > 150);
    const to = others[Math.floor(Math.random() * others.length)]; if (!to) return;
    const p = person(LOOKS[Math.floor(Math.random() * LOOKS.length)]); sit(p); this.scene.add(p);
    this.passenger = { from: at, to, p, fare: fareFor(Math.hypot(at.x - to.x, at.z - to.z), vehicleByKey(this.riding!.k)!.fares!) };
    this.seatRider(); play('talk'); this.onMessage?.(`"${to.name}, please." The passenger climbs in. Follow the gold marker.`);
  }
  private dropOff(_S: GameState): void {
    const p = this.passenger; if (!p) return;
    this.onFare?.(this.riding!.k, p.from.k, p.to.k);
    this.scene.remove(p.p); this.passenger = null;
  }
  /** Hooks the game sets: a fare to dispatch, and messages to show. */
  onFare?: (veh: VehKey, from: string, to: string) => void;
  /** Rent and return: dispatch the move and say whether it went through. */
  onRent?: (veh: VehKey, at: string) => boolean;
  onReturn?: (at: string) => boolean;
  onMessage?: (text: string) => void;
}
