/** Walking, cycling and the follow camera. Keyboard, mouse drag and a touch joystick. */
import * as THREE from 'three';
import { clamp, lerp } from '../shared/rng.js';
import { blocked, pushOut } from './collide.js';
import { type CityMap, getH } from './map/data.js';
import { bicycle, person, type Person } from './scene/people.js';
import { play } from './audio.js';
import { MAT } from './scene/kit.js';

export const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);

export class Player {
  readonly body: Person;
  readonly bike: THREE.Group;
  yaw = 0; pitch = 0.28; dist = 5.5;
  readonly keys: Record<string, boolean> = {};
  readonly joy = { x: 0, y: 0, active: false };
  /** R toggles running on and off; Shift runs while held. */
  autoRun = false;
  private vx = 0; private vz = 0; private runBlend = 0; private phase = 0; private lastStep = 0;
  private camTarget = new THREE.Vector3(); private camPos = new THREE.Vector3();

  constructor(scene: THREE.Scene, private map: CityMap, private camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.body = person({ shirt: '#efe8d6', lowerMat: MAT.lungi, gamcha: true }); this.body.rotation.order = 'YXZ'; scene.add(this.body);
    this.bike = bicycle(); this.bike.position.y = -0.35; this.bike.visible = false; this.body.add(this.bike);
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase(); this.keys[k] = true;
      if (k === 'r' && !e.repeat) this.autoRun = !this.autoRun;
      if (k === 'c' && !e.repeat) this.resetView();
    });
    addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; });
    let drag: { x: number; y: number; id: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.4) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
    canvas.addEventListener('pointermove', (e) => { if (!drag || drag.id !== e.pointerId) return; this.yaw -= (e.clientX - drag.x) * 0.0055; this.pitch = clamp(this.pitch + (e.clientY - drag.y) * 0.004, 0.08, 1.35); drag.x = e.clientX; drag.y = e.clientY; });
    const end = (e: PointerEvent) => { if (drag && drag.id === e.pointerId) drag = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => { this.dist = clamp(this.dist + e.deltaY * 0.01, 2.8, 22); e.preventDefault(); }, { passive: false });
  }

  get x() { return this.body.position.x; }
  get z() { return this.body.position.z; }
  get face() { return this.body.rotation.y; }

  teleport(x: number, z: number, face = this.face): void {
    this.body.position.set(x, getH(x, z), z); this.body.rotation.y = face; this.vx = this.vz = 0;
    this.camera.position.set(x - Math.sin(face) * this.dist, 2.5, z - Math.cos(face) * this.dist);
  }

  /** Back to the default over-the-shoulder view (C). */
  resetView(): void { this.dist = 5.5; this.pitch = 0.28; this.yaw = this.body.rotation.y + Math.PI; }

  get running(): boolean { return this.runBlend > 0.5; }

  /**
   * Moves the player for one frame with a little inertia: you build up to a run and slow to a
   * stop rather than snapping. Walls are slid along instead of stopping you dead, and fast
   * movement is split into small steps so you never clip through a corner.
   */
  move(dt: number, cycle: boolean, _time: number): number {
    const k = this.keys; let f = 0, r = 0;
    if (k.w || k.arrowup) f += 1; if (k.s || k.arrowdown) f -= 1; if (k.d || k.arrowright) r += 1; if (k.a || k.arrowleft) r -= 1;
    if (this.joy.active) { f -= this.joy.y; r += this.joy.x; }
    const L = Math.min(1, Math.hypot(f, r)); const p = this.body.position;
    const wantRun = (k.shift ? !this.autoRun : this.autoRun) || (isTouch && L > 0.95);
    let tx = 0, tz = 0, top = 0;
    if (L > 0.08) {
      top = (cycle ? (wantRun ? 14 : 9) : wantRun ? 9 : 4.4) * L;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      const n = Math.hypot(f, r) || 1; tx = ((fx * f + rx * r) / n) * top; tz = ((fz * f + rz * r) / n) * top;
    }
    // accelerate quickly, brake a bit quicker, so control feels responsive but not twitchy
    const accel = L > 0.08 ? (cycle ? 4 : 9) : cycle ? 3 : 12;
    const a = Math.min(1, dt * accel); this.vx += (tx - this.vx) * a; this.vz += (tz - this.vz) * a;
    let speed = Math.hypot(this.vx, this.vz);
    if (speed > 0.02) {
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.35)); const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const ox = p.x, oz = p.z; const dx = this.vx * sdt, dz = this.vz * sdt;
        let nx = ox + dx, nz = oz + dz;
        if (blocked(this.map, nx, nz)) {
          // slide: try the parts of the move that are free, then glancing angles along the wall
          const tries: [number, number][] = [[dx, 0], [0, dz]];
          for (const ang of [0.6, -0.6, 1.1, -1.1]) { const c = Math.cos(ang), s2 = Math.sin(ang); tries.push([(dx * c - dz * s2) * 0.8, (dx * s2 + dz * c) * 0.8]); }
          const ok = tries.find(([ax, az]) => (ax || az) && !blocked(this.map, ox + ax, oz + az));
          if (ok) { nx = ox + ok[0]; nz = oz + ok[1]; this.vx *= 0.92; this.vz *= 0.92; }
          else { nx = ox; nz = oz; this.vx *= 0.3; this.vz *= 0.3; }
        }
        [nx, nz] = pushOut(this.map, nx, nz); if (blocked(this.map, nx, nz)) { nx = ox; nz = oz; }
        p.x = nx; p.z = nz;
      }
      speed = Math.hypot(this.vx, this.vz);
      if (speed > 0.4) { let d = Math.atan2(this.vx, this.vz) - this.body.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); this.body.rotation.y += d * Math.min(1, dt * (wantRun ? 11 : 14)); }
    } else { this.vx = this.vz = 0; speed = 0; }

    const runTarget = cycle ? 0 : clamp((speed - 4.6) / 3.5, 0, 1); this.runBlend += (runTarget - this.runBlend) * Math.min(1, dt * 6);
    this.bike.visible = cycle;
    const u = this.body.userData;
    if (cycle) {
      this.phase += dt * speed * 1.4; u.legL.rotation.x = Math.sin(this.phase) * 0.6; u.legR.rotation.x = -Math.sin(this.phase) * 0.6;
      p.y = getH(p.x, p.z) + 0.35; this.body.rotation.x = 0;
    } else {
      // stride grows with speed; arms swing harder, the body leans in and bobs when running
      const moving = speed > 0.3; this.phase += dt * (moving ? 2.2 + speed * 1.25 : 0);
      const amp = moving ? lerp(0.42, 1.0, this.runBlend) * Math.min(1, speed / 2) : 0; const sw = Math.sin(this.phase);
      u.legL.rotation.x = lerp(u.legL.rotation.x, sw * amp, 0.35); u.legR.rotation.x = lerp(u.legR.rotation.x, -sw * amp, 0.35);
      u.armL.rotation.x = lerp(u.armL.rotation.x, -sw * amp * 0.9, 0.35); u.armR.rotation.x = lerp(u.armR.rotation.x, sw * amp * 0.9, 0.35);
      u.armL.rotation.z = lerp(u.armL.rotation.z, -0.18 * this.runBlend, 0.2); u.armR.rotation.z = lerp(u.armR.rotation.z, 0.18 * this.runBlend, 0.2);
      this.body.rotation.x = lerp(this.body.rotation.x, 0.16 * this.runBlend * Math.min(1, speed / 6), 0.15);
      p.y = getH(p.x, p.z) + (moving ? Math.abs(Math.cos(this.phase)) * (0.03 + 0.07 * this.runBlend) : 0);
      // a footstep on each foot-fall
      const step = Math.floor(this.phase / Math.PI); if (moving && step !== this.lastStep) { this.lastStep = step; play(this.runBlend > 0.5 ? 'stepRun' : 'step'); }
    }
    return speed;
  }

  /** Third-person camera that pulls in when a building is in the way. */
  updateCamera(dt: number): void {
    const t = this.camTarget, c = this.camPos, p = this.body.position;
    t.set(p.x, getH(p.x, p.z) + 1.5, p.z);
    // pull back and widen the view a touch at a run, for a sense of speed
    const dist = this.dist + this.runBlend * 0.7;
    const fov = 55 + this.runBlend * 4; if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4); this.camera.updateProjectionMatrix(); }
    c.set(t.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist, t.y + Math.sin(this.pitch) * dist, t.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist);
    for (let i = 1; i <= 8; i++) {
      const u = i / 8; const x = lerp(t.x, c.x, u), z = lerp(t.z, c.z, u), y = lerp(t.y, c.y, u);
      if (y < 9 && this.map.inBuilding(x, z)) { const v = Math.max(0.15, (i - 1) / 8); c.set(lerp(t.x, c.x, v), lerp(t.y, c.y, v), lerp(t.z, c.z, v)); break; }
    }
    const gh = getH(c.x, c.z) + 0.8; if (c.y < gh) c.y = gh;
    this.camera.position.lerp(c, Math.min(1, dt * 10)); this.camera.lookAt(t);
  }
}
