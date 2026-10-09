/**
 * Other players out in the city. Every few seconds the browser says where you are and asks who
 * else is around; each of them is drawn as a person with a name tag, gliding between updates.
 */
import * as THREE from 'three';
import { getH } from './map/data.js';
import type { Net, OtherPlayer } from './net.js';
import { MAT, canvasTexture } from './scene/kit.js';
import { animPerson, person, type Person } from './scene/people.js';

const LOOKS = [
  { shirt: '#e9b23b', lowerMat: MAT.lungi, gamcha: true }, { female: true, shirt: '#7d1d3f', bun: true, lowerMat: MAT.rignai },
  { shirt: '#2f6fb0', lowerMat: MAT.lungi2 }, { female: true, shirt: '#1f6f5c', bun: true, lowerMat: MAT.rignai2 },
];

interface Ghost { id: string; g: Person; tag: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; face: number; t: number; seen: number; name: string }

function nameTag(name: string, para: string): THREE.Sprite {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d')!;
  c.textAlign = 'center'; c.lineJoin = 'round';
  c.font = '600 46px "Hind Siliguri", system-ui, sans-serif'; c.lineWidth = 8; c.strokeStyle = 'rgba(20,14,24,.9)'; c.strokeText(name, 256, 56); c.fillStyle = '#f6efe0'; c.fillText(name, 256, 56);
  c.font = '32px "Hind Siliguri", system-ui, sans-serif'; c.lineWidth = 6; c.strokeText(para, 256, 104); c.fillStyle = '#e9b23b'; c.fillText(para, 256, 104);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
  s.scale.set(3.2, 0.8, 1); return s;
}

export class OtherPlayers {
  private ghosts = new Map<string, Ghost>();
  private lastSent = { x: 1e9, z: 1e9, t: 0 };
  private polling = false;
  /** How many other players are out right now (for the HUD). */
  count = 0;
  constructor(private scene: THREE.Scene, private net: Net) {}

  /** Call often; it rate-limits itself. Sends your position when you have moved and fetches who else is out. */
  async tick(now: number, x: number, z: number, face: number, active: boolean): Promise<void> {
    if (!this.net.online || this.polling) return;
    const moved = Math.hypot(x - this.lastSent.x, z - this.lastSent.z) > 2;
    if (now - this.lastSent.t < (moved ? 4000 : 15000)) return;
    this.polling = true; this.lastSent = { x, z, t: now };
    try {
      if (active) await this.net.presence(x, z, face);
      this.apply(await this.net.players());
    } catch { /* offline for a moment: keep the last positions */ }
    finally { this.polling = false; }
  }

  private apply(list: OtherPlayer[]): void {
    const now = performance.now(); const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id); let gh = this.ghosts.get(p.id);
      if (!gh || gh.name !== p.name) {
        if (gh) this.remove(gh);
        const g = person(LOOKS[parseInt(p.id.slice(0, 2), 16) % LOOKS.length]); const tag = nameTag(p.name, p.para);
        g.add(tag); tag.position.set(0, 2.75, 0); this.scene.add(g);
        const v = new THREE.Vector3(p.x, getH(p.x, p.z), p.z);
        gh = { id: p.id, g, tag, from: v.clone(), to: v.clone(), face: p.face, t: 1, seen: now, name: p.name }; this.ghosts.set(p.id, gh);
        g.position.copy(v);
      }
      gh.from.copy(gh.g.position); gh.to.set(p.x, getH(p.x, p.z), p.z); gh.face = p.face; gh.t = 0; gh.seen = now;
    }
    for (const gh of [...this.ghosts.values()]) if (!seen.has(gh.id)) this.remove(gh);
    this.count = this.ghosts.size;
  }
  private remove(gh: Ghost): void { this.scene.remove(gh.g); (gh.tag.material as THREE.SpriteMaterial).map?.dispose(); this.ghosts.delete(gh.id); this.count = this.ghosts.size; }

  /** Glides each player towards their latest position over the next update interval. */
  update(dt: number, px: number, pz: number): void {
    for (const gh of this.ghosts.values()) {
      const before = gh.g.position.clone();
      gh.t = Math.min(1, gh.t + dt / 4); gh.g.position.lerpVectors(gh.from, gh.to, gh.t);
      const sp = before.distanceTo(gh.g.position) / Math.max(dt, 1e-3);
      if (sp > 0.2) gh.g.rotation.y = Math.atan2(gh.to.x - gh.from.x, gh.to.z - gh.from.z); else gh.g.rotation.y = gh.face;
      animPerson(gh.g, Math.min(1.5, sp / 3), dt);
      const d = Math.hypot(gh.g.position.x - px, gh.g.position.z - pz); gh.g.visible = d < 400; gh.tag.visible = d < 60;
    }
  }
  /** Map markers for the minimap and big map. */
  marks(): { x: number; z: number; name: string }[] { return [...this.ghosts.values()].map((g) => ({ x: g.to.x, z: g.to.z, name: g.name })); }
}
