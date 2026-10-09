/** The family bari: house, plots, rubber, bamboo, jackfruit, the roller and Rina's courtyard. Redrawn from game state. */
import * as THREE from 'three';
import { AGAR_NEED, FISH_NEED, NEED, TEA_NEED } from '../../shared/constants.js';
import { AGAR, BAMBOO, COLD, CRAFT, JACK, PLOTS, POND, PUMP, RACK, RINA, ROLLER, RUBBER, SHED, TEA } from '../../shared/farm.js';
import { rnd2 } from '../../shared/rng.js';
import type { GameState } from '../../shared/save.js';
import { colliders } from '../collide.js';
import { getH } from '../map/data.js';
import { M, MAT, add, box, cyl, place } from './kit.js';
import { stiltHouse, tinHut } from './landmarks.js';

interface PlotView { soilMat: THREE.MeshLambertMaterial; sheet: THREE.Mesh; crop: THREE.Group; cropMat: THREE.MeshLambertMaterial; parts: THREE.Object3D[]; fruits: THREE.Group[]; stake: THREE.Group; lunga: boolean }

export class FarmView {
  private plots: PlotView[] = [];
  private milk: THREE.Mesh[] = [];
  private culms: THREE.Group[][] = [];
  private jackFruits: THREE.Mesh[][] = [];
  private rack: THREE.Mesh[] = [];
  private garia = new THREE.Group();
  private tea: { g: THREE.Group; bush: THREE.Mesh; tips: THREE.Mesh }[] = [];
  private agar: { g: THREE.Group; crown: THREE.Mesh; trunk: THREE.Mesh }[] = [];
  private pump = new THREE.Group(); private cold = new THREE.Group();
  private fish: THREE.Mesh[] = []; private floods: THREE.Mesh[] = [];
  private stocked = false; private fishGrowth = 0;

  constructor(private scene: THREE.Scene) {
    this.home(); this.buildPlots(); this.buildRubber(); this.buildBamboo(); this.buildJack(); this.buildNew();
  }

  /** Tea on the third tilla, agar along the lunga, the pump, cold store and craft bench. */
  private buildNew() {
    const s = this.scene;
    for (const t of TEA) {
      const g = new THREE.Group(); const bush = add(g, new THREE.SphereGeometry(0.75, 9, 6), M('#2f6b2a'), 0, 0.5, 0); bush.scale.set(1.3, 0.7, 1.3);
      const tips = add(g, new THREE.SphereGeometry(0.78, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.35), M('#8cc94a'), 0, 0.52, 0, false); tips.scale.set(1.3, 0.75, 1.3);
      const peg = new THREE.Group(); cyl(peg, 0.04, 0.04, 0.9, '#6b5432', 0, 0.45, 0, 4); box(peg, 0.4, 0.25, 0.04, '#5f8f35', 0, 0.85, 0); peg.name = 'peg'; g.add(peg);
      place(s, g, t.x, t.z, rnd2(t.x, t.z) * 6); this.tea.push({ g, bush, tips });
    }
    for (const a of AGAR) {
      const g = new THREE.Group(); const trunk = cyl(g, 0.12, 0.2, 4, '#7d6a52', 0, 2, 0, 6);
      const crown = add(g, new THREE.IcosahedronGeometry(1.6, 0), M('#3d6b33'), 0, 4.4, 0); crown.scale.set(1, 1.5, 1);
      const peg = new THREE.Group(); cyl(peg, 0.04, 0.04, 0.9, '#6b5432', 0, 0.45, 0, 4); box(peg, 0.4, 0.25, 0.04, '#8a5a2a', 0, 0.85, 0); peg.name = 'peg'; g.add(peg);
      place(s, g, a.x, a.z); colliders.push({ ...a, r: 0.35 }); this.agar.push({ g, crown, trunk });
    }
    // diesel pump set on a little plinth, with a pipe running into the pukur
    const p = this.pump; box(p, 1.2, 0.25, 0.8, '#8d8170', 0, 0.12, 0); box(p, 0.9, 0.55, 0.6, '#2f6fb0', 0, 0.52, 0); cyl(p, 0.22, 0.22, 0.6, '#c62f2f', 0.15, 0.55, 0.32, 10).rotation.x = Math.PI / 2;
    cyl(p, 0.07, 0.07, 2.4, '#3a3a36', -1.3, 0.2, 0, 6).rotation.z = Math.PI / 2; box(p, 0.08, 0.6, 0.08, '#3a3a36', 0.3, 1, -0.1);
    place(s, p, PUMP.x, PUMP.z, Math.PI / 2); p.visible = false;
    // the cold store: a white insulated shed with a heavy door
    const c = this.cold; box(c, 3.6, 0.3, 3, '#8d8170', 0, 0.15, 0); box(c, 3.2, 2.6, 2.6, '#e8e6df', 0, 1.6, 0); box(c, 1, 2, 0.12, '#9aa4ab', 0, 1.3, 1.32); box(c, 3.5, 0.2, 2.9, '#c9cdd0', 0, 3, 0);
    box(c, 0.9, 0.5, 0.5, '#6f777d', 1.1, 3.3, -0.6); place(s, c, COLD.x, COLD.z, -0.3); c.visible = false; colliders.push({ ...COLD, r: 2.1 });
    // craft bench: split bamboo and a half-woven basket
    const b = new THREE.Group(); box(b, 1.8, 0.1, 0.8, '#8a6a42', 0, 0.8, 0); for (const [x, z] of [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]]) cyl(b, 0.05, 0.05, 0.8, '#6b5432', x, 0.4, z, 4);
    for (let k = 0; k < 6; k++) box(b, 1.4, 0.03, 0.05, '#c9b25a', 0, 0.87 + (k % 2) * 0.03, -0.25 + k * 0.1);
    cyl(b, 0.3, 0.22, 0.35, '#b08a4a', 0.55, 1.03, 0.1, 10); place(s, b, CRAFT.x, CRAFT.z, 0.4); colliders.push({ ...CRAFT, r: 1 });
    // fish rings on the pukur when it is stocked
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 16), new THREE.MeshBasicMaterial({ color: '#d8f0f0', transparent: true, opacity: 0.6, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; s.add(m); this.fish.push(m); }
    // floodwater over the lunga
    PLOTS.forEach((pl) => { if (pl.kind !== 'lunga') return; const m = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.8), MAT.sheetWater); m.rotation.x = -Math.PI / 2; m.position.set(pl.x, getH(pl.x, pl.z) + 0.55, pl.z); m.visible = false; s.add(m); this.floods.push(m); });
  }

  private home() {
    const s = this.scene;
    tinHut(s, SHED.x, SHED.z, -0.3); // the field shed, by the roller
    const r = new THREE.Group(); box(r, 1.6, 0.9, 0.8, '#5c5c58', 0, 0.45, 0);
    cyl(r, 0.22, 0.22, 1.7, '#8a8a84', 0, 1.1, 0.1, 10).rotation.z = Math.PI / 2; cyl(r, 0.22, 0.22, 1.7, '#8a8a84', 0, 1.1, -0.35, 10).rotation.z = Math.PI / 2; box(r, 0.08, 0.7, 0.08, '#3a3a36', 1, 1.3, 0.1);
    place(s, r, ROLLER.x, ROLLER.z); colliders.push({ ...ROLLER, r: 1 });
    const k = new THREE.Group(); for (const x of [-1.6, 1.6]) cyl(k, 0.06, 0.06, 2.2, '#9c8a52', x, 1.1, 0, 5); cyl(k, 0.05, 0.05, 3.4, '#9c8a52', 0, 2.15, 0, 5).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const m = add(k, new THREE.BoxGeometry(0.5, 0.9, 0.02), M('#a9733b'), -1.3 + i * 0.52, 1.65, 0); m.visible = false; this.rack.push(m); }
    place(s, k, RACK.x, RACK.z, 0.2); colliders.push({ ...RACK, r: 1 });
    stiltHouse(s, RINA.house.x, RINA.house.z, 0, 6, 4.6);
    const loom = new THREE.Group(); cyl(loom, 0.06, 0.06, 1.6, '#6b5432', 0, 1.1, 0, 5).rotation.z = Math.PI / 2; add(loom, new THREE.PlaneGeometry(1.4, 1.6), MAT.rignai, 0, 0.6, 0.4).rotation.x = -0.9;
    cyl(loom, 0.05, 0.05, 1.6, '#6b5432', 0, 0.1, 0.9, 5).rotation.z = Math.PI / 2; cyl(loom, 0.07, 0.07, 2.2, '#6b5432', -0.85, 1.1, -0.05, 5); cyl(loom, 0.07, 0.07, 2.2, '#6b5432', 0.85, 1.1, -0.05, 5);
    place(s, loom, RINA.loom.x, RINA.loom.z, 0.3);
    const g = this.garia; cyl(g, 0.09, 0.12, 4.2, '#a8b85a', 0, 2.1, 0, 6);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; add(g, new THREE.SphereGeometry(0.12, 6, 4), M(i % 2 ? '#f39a1c' : '#f5f0e0'), Math.cos(a) * 0.25, 3.4 + (i % 3) * 0.25, Math.sin(a) * 0.25, false); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, new THREE.BoxGeometry(0.04, 1.6, 0.04), M('#f5f0e0'), Math.cos(a) * 0.7, 3.2, Math.sin(a) * 0.7, false).rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    box(g, 1.2, 0.2, 1.2, '#cdb48a', 0, 0.1, 0); place(s, g, RINA.pole.x, RINA.pole.z); g.visible = false;
  }

  private buildPlots() {
    const coneGeo = new THREE.ConeGeometry(0.13, 1, 5); coneGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.ConeGeometry(0.07, 0.8, 4); leafGeo.translate(0, 0.4, 0);
    PLOTS.forEach((p, i) => {
      const g = new THREE.Group(); const lunga = p.kind === 'lunga'; const s = lunga ? 4.6 : 3.4;
      box(g, s + 0.5, 0.3, s + 0.5, lunga ? '#6c7b3a' : '#7a4a2e', 0, 0.02, 0);
      const soilMat = new THREE.MeshLambertMaterial({ color: '#6f8f3a' }); add(g, new THREE.BoxGeometry(s, 0.3, s), soilMat, 0, 0.08, 0, false);
      const sheet = add(g, new THREE.PlaneGeometry(s - 0.2, s - 0.2), MAT.sheetWater, 0, 0.26, 0, false); sheet.rotation.x = -Math.PI / 2; sheet.visible = false;
      const crop = new THREE.Group(); g.add(crop); const cropMat = new THREE.MeshLambertMaterial({ color: '#5fa83a' }); const parts: THREE.Object3D[] = [], fruits: THREE.Group[] = [];
      if (lunga) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const m = new THREE.Mesh(coneGeo, cropMat); m.position.set(-1.65 + a * 1.1 + (rnd2(i, a * 4 + b) - 0.5) * 0.2, 0.24, -1.65 + b * 1.1); m.castShadow = true; crop.add(m); parts.push(m); }
      else for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
        const pl = new THREE.Group(); pl.position.set(-0.8 + a * 1.6, 0.24, -0.8 + b * 1.6); crop.add(pl); parts.push(pl);
        for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(leafGeo, cropMat); l.rotation.set(0.75 + (k % 2) * 0.25, (k / 7) * Math.PI * 2, 0, 'YXZ'); pl.add(l); }
        const f = new THREE.Group(); f.position.y = 0.55; pl.add(f);
        const fr = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M('#e0a12e')); fr.scale.set(1, 1.45, 1); f.add(fr);
        const cr = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), M('#4f8a32')); cr.position.y = 0.45; f.add(cr); f.visible = false; fruits.push(f);
      }
      const stake = new THREE.Group(); cyl(stake, 0.05, 0.05, 1.4, '#6b5432', 0, 0.7, 0, 5); box(stake, 0.8, 0.45, 0.05, '#e9b23b', 0, 1.25, 0); stake.position.set(s / 2 - 0.4, 0, s / 2 - 0.4); g.add(stake);
      g.position.set(p.x, getH(p.x, p.z), p.z); this.scene.add(g);
      this.plots.push({ soilMat, sheet, crop, cropMat, parts, fruits, stake, lunga });
    });
  }

  private buildRubber() {
    for (const t of RUBBER) {
      const g = new THREE.Group(); cyl(g, 0.2, 0.28, 5.2, '#7d7468', 0, 2.6, 0, 7);
      add(g, new THREE.BoxGeometry(0.58, 0.07, 0.58), M('#5a5249'), 0, 1.45, 0).rotation.z = 0.35;
      add(g, new THREE.CylinderGeometry(0.12, 0.09, 0.16, 8), M('#2c2c2c'), 0, 1.05, 0.32);
      this.milk.push(add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 8), M('#e8e2d2'), 0, 1.12, 0.32, false));
      for (const [x, y, z, r] of [[0, 6, 0, 1.8], [0.9, 5.3, 0.4, 1.2], [-0.8, 5.4, -0.5, 1.3], [0.2, 6.8, -0.3, 1.2]]) add(g, new THREE.IcosahedronGeometry(r, 0), M('#2f5a2a'), x, y, z);
      place(this.scene, g, t.x, t.z, rnd2(t.x, t.z) * 6); colliders.push({ ...t, r: 0.5 });
    }
  }
  private buildBamboo() {
    BAMBOO.forEach((b, bi) => {
      const g = new THREE.Group(); const culms: THREE.Group[] = [];
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + rnd2(bi, k), lean = 0.12 + rnd2(k, bi) * 0.18, h = 8 + rnd2(bi * 3, k) * 3;
        const c = new THREE.Group(); c.rotation.set(Math.cos(a) * lean, 0, Math.sin(a) * lean); c.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        add(c, new THREE.CylinderGeometry(0.08, 0.11, h, 5), M(k % 3 ? '#9fb24e' : '#86a03f'), 0, h / 2, 0); add(c, new THREE.IcosahedronGeometry(0.9, 0), M('#5f8f35'), 0, h - 0.4, 0).scale.set(1, 1.8, 1);
        g.add(c); culms.push(c);
      }
      place(this.scene, g, b.x, b.z); colliders.push({ ...b, r: 0.9 }); this.culms.push(culms);
    });
  }
  private buildJack() {
    for (const j of JACK) {
      const g = new THREE.Group(); cyl(g, 0.32, 0.45, 4, '#5b4632', 0, 2, 0, 8);
      for (const [x, y, z, r] of [[0, 5, 0, 2.6], [1.4, 4.3, 0.6, 1.8], [-1.3, 4.4, -0.7, 1.9], [0.3, 6.2, 0.2, 1.8]]) add(g, new THREE.IcosahedronGeometry(r, 1), M('#2c5226'), x, y, z);
      const fruits: THREE.Mesh[] = [];
      for (let k = 0; k < 3; k++) { const a = k * 2.1; const f = add(g, new THREE.SphereGeometry(0.38, 8, 6), M('#8ea23e'), Math.cos(a) * 0.48, 1.5 + k * 0.6, Math.sin(a) * 0.48); f.scale.set(1, 1.5, 1); fruits.push(f); }
      place(this.scene, g, j.x, j.z); colliders.push({ ...j, r: 0.7 }); this.jackFruits.push(fruits);
    }
  }

  plot(s: GameState, i: number): void {
    const st = s.plots[i], o = this.plots[i];
    o.stake.visible = !st.owned;
    o.soilMat.color.set(!st.owned ? '#5b7a32' : st.state === 'grass' ? '#6d8d39' : st.watered ? '#4b2f1d' : '#7d5130');
    o.sheet.visible = o.lunga && st.state === 'tilled' && st.watered;
    o.crop.visible = !!st.crop; if (!st.crop) return;
    const k = Math.min(1, st.growth / NEED[st.crop]), ripe = k >= 1;
    if (o.lunga) {
      o.parts.forEach((m, j) => m.scale.set(1 + k * 0.6, 0.2 + k * 1.15 + (j % 3) * 0.06 * k, 1 + k * 0.6));
      if (ripe) o.cropMat.color.set('#d8b64a'); else o.cropMat.color.set('#79c04a').lerp(new THREE.Color('#4f9a34'), k);
    } else {
      o.parts.forEach((pl) => pl.scale.setScalar(0.35 + k * 0.75));
      o.fruits.forEach((f) => { f.visible = k > 0.7; (f.children[0] as THREE.Mesh).material = M(ripe ? '#e9a23b' : '#6f9a3a'); });
      o.cropMat.color.set('#4f8a3a');
    }
  }

  refresh(s: GameState): void {
    for (let i = 0; i < PLOTS.length; i++) this.plot(s, i);
    this.milk.forEach((m, i) => (m.visible = s.trees[i].tapped === s.day));
    this.culms.forEach((cs, i) => { const ready = s.bamboo[i].ready <= s.day; cs.forEach((c, k) => (c.scale.y = ready || k % 2 ? 1 : 0.35)); });
    this.jackFruits.forEach((fs, i) => fs.forEach((f, k) => (f.visible = k < s.jack[i].fruits)));
    this.rack.forEach((m, i) => (m.visible = i < Math.min(6, s.inv.sheet)));
    this.garia.visible = !!s.flags.gariaDone;
    s.tea.forEach((t, i) => { const v = this.tea[i]; v.bush.visible = t.planted; v.tips.visible = t.planted && t.growth >= TEA_NEED && t.picked !== s.day; v.g.getObjectByName('peg')!.visible = !t.planted; const k = t.planted ? 0.35 + 0.65 * Math.min(1, t.growth / TEA_NEED) : 0; v.bush.scale.set(1.3 * k, 0.7 * k, 1.3 * k); v.tips.scale.set(1.3 * k, 0.75 * k, 1.3 * k); });
    s.agar.forEach((t, i) => { const v = this.agar[i]; v.trunk.visible = v.crown.visible = t.planted; v.g.getObjectByName('peg')!.visible = !t.planted; const k = t.planted ? 0.25 + 0.75 * Math.min(1, t.growth / AGAR_NEED) : 0; v.trunk.scale.set(k, k, k); v.trunk.position.y = 2 * k; v.crown.scale.set(k, 1.5 * k, k); v.crown.position.y = 4.4 * k; });
    this.pump.visible = s.pump; this.cold.visible = s.coldStore;
    this.stocked = s.pond.stocked; this.fishGrowth = s.pond.growth / FISH_NEED;
    for (const f of this.floods) f.visible = s.flood;
  }
  /** Ripples where fish rise in a stocked pukur. Called every frame. */
  animate(time: number): void {
    this.fish.forEach((m, i) => {
      m.visible = this.stocked; if (!m.visible) return;
      const ph = (time * 0.6 + i * 0.37) % 1; const a = i * 2.1 + Math.floor(time * 0.6 + i * 0.37) * 1.7;
      if (ph < 0.02) m.position.set(POND.x + Math.cos(a) * POND.w * 0.6, getH(POND.x, POND.z) + 0.08, POND.z + Math.sin(a) * POND.d * 0.6);
      const sc = 1 + ph * (3 + this.fishGrowth * 4); m.scale.set(sc, sc, sc); (m.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ph);
    });
  }
  /** Cheap per-tick update for growing crops only. */
  growing(s: GameState): void { for (let i = 0; i < PLOTS.length; i++) if (s.plots[i].crop) this.plot(s, i); }
}
