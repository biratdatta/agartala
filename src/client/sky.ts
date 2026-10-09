/** Day, dusk, night and rain: sky colour, sun, fog, lit windows and the stadium floodlights. */
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../shared/rng.js';
import type { GameState } from '../shared/save.js';
import { MAT } from './scene/kit.js';
import type { Sky } from './scene/world.js';

const cNight = new THREE.Color('#0b1430'), cDawn = new THREE.Color('#ef9a5a'), cDay = new THREE.Color('#8ec5e6'), cRain = new THREE.Color('#7d8a94');

export class Lighting {
  readonly hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a4a2a, 0.55 * Math.PI);
  readonly sun = new THREE.DirectionalLight(0xfff1dc, 0.9 * Math.PI);
  /** The player's lantern: a warm pool of light round them after dark. */
  readonly lantern = new THREE.PointLight(0xffc670, 0, 34, 1.25);
  private sky = new THREE.Color(); private tmp = new THREE.Color();
  nightFactor = 0;
  /** How far you can see by day (Settings); night and rain bring the fog closer. */
  viewFar = 1100;

  constructor(private scene: THREE.Scene, private skyFx: Sky, private palaceLights: THREE.Object3D, private pandal: THREE.Object3D) {
    scene.fog = new THREE.Fog(0x8ec5e6, 180, 1100);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0006;
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
    scene.add(this.hemi, this.sun, this.sun.target, this.lantern);
  }

  update(S: GameState, p: THREE.Vector3, dt: number, lantern: { at: THREE.Vector3 | null; on: boolean } | null = null): void {
    const ang = ((S.hour - 6) / 12) * Math.PI, sy = Math.sin(ang), sx = Math.cos(ang);
    const df = smooth(-0.12, 0.3, sy), nf = 1 - df; this.nightFactor = nf;
    const warm = df * (1 - smooth(0.08, 0.5, sy)) + (1 - df) * smooth(-0.25, -0.05, sy) * 0.6;
    this.sky.copy(cNight).lerp(cDay, df).lerp(cDawn, clamp(warm, 0, 0.75)); if (S.rain) this.sky.lerp(cRain, 0.55 * df + 0.2);
    this.scene.background = this.sky; const fog = this.scene.fog as THREE.Fog; fog.color.copy(this.sky);
    fog.far = lerp(this.viewFar * 0.5, this.viewFar, df) * (S.rain ? 0.6 : 1); fog.near = fog.far * 0.18;
    // the sun crosses the southern sky (Agartala is at 23.8° N)
    if (sy > -0.05) { this.sun.position.set(p.x + sx * 120, p.y + Math.max(sy, 0.12) * 160, p.z + 70); this.sun.color.set('#fff1dc').lerp(this.tmp.set('#ffb070'), clamp(warm, 0, 1)); this.sun.intensity = (0.25 + 0.75 * df) * (S.rain ? 0.45 : 1) * Math.PI; }
    else { this.sun.position.set(p.x - 70, p.y + 140, p.z + 60); this.sun.color.set('#8fa8e0'); this.sun.intensity = 0.3 * Math.PI; } // moonlight
    this.sun.target.position.copy(p);
    this.hemi.intensity = (0.3 + 0.35 * df) * Math.PI; this.hemi.color.set('#cfe6ff').lerp(this.tmp.set('#3a4a80'), nf * 0.7);
    MAT.win.emissiveIntensity = nf * 1.1; MAT.bulb.color.set(nf > 0.4 ? '#ffd27a' : '#8a8a80');
    this.palaceLights.visible = nf > 0.35;
    const st = this.skyFx.stars.material as THREE.PointsMaterial; st.opacity = nf * (S.rain ? 0.15 : 0.95); this.skyFx.stars.position.set(p.x, 0, p.z);
    // flickers a touch, like a real wick
    const flick = 1 + Math.sin(performance.now() * 0.013) * 0.04 + Math.sin(performance.now() * 0.031) * 0.03;
    const lit = lantern ? lantern.on : true;
    this.lantern.intensity = lit ? nf * 70 * flick : nf * 12;
    if (lantern?.on && lantern.at) this.lantern.position.set(lantern.at.x, lantern.at.y + 0.1, lantern.at.z); else this.lantern.position.set(p.x, p.y + 2.2, p.z);
    this.pandal.children.forEach((ch) => { if (ch.userData.fairy) ch.visible = nf > 0.3 || !!S.flags.durga; });
    const rain = this.skyFx.rain; rain.visible = S.rain;
    if (S.rain) { const a = rain.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 26; if (y < 0) y += 32; a.setY(i, y); } a.needsUpdate = true; rain.position.set(p.x, p.y - 3, p.z); }
  }
}
