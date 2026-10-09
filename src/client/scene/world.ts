/** The city itself: ground, parks, ponds, roads, 17,000 buildings, trees, the farm tillas and the sky. */
import * as THREE from 'three';
import { inPalaceGarden } from '../../shared/places.js';
import { HILLS, HOME, POND, RINA, inFarm } from '../../shared/farm.js';
import { SPOTS } from '../../shared/spots.js';
import { mulberry, rnd2, smooth } from '../../shared/rng.js';
import { STANDS } from '../../shared/stands.js';
import { type CityMap, type Poly, ROAD_W, X0, X1, Z0, Z1, getH } from '../map/data.js';
import { M, MAT, canvasTexture } from './kit.js';

function groundTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d')!; const r = mulberry(11);
  c.fillStyle = '#7f9450'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const g = 110 + r() * 50; c.fillStyle = `rgba(${(g * 0.85) | 0},${g | 0},${(g * 0.55) | 0},.18)`; c.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 500; i++) { c.fillStyle = 'rgba(150,120,80,.14)'; c.fillRect(r() * 256, r() * 256, 2 + r() * 5, 1 + r() * 3); }
  const t = canvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1200, 1200); t.anisotropy = 4; return t;
}

function flatPolys(list: Poly[], y: number, colorOf: (p: Poly) => string): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = []; const c = new THREE.Color();
  for (const p of list) {
    const pts: THREE.Vector2[] = []; for (let i = 0; i < p.n; i++) pts.push(new THREE.Vector2(p.xs[i], p.zs[i]));
    let tris: number[][]; try { tris = THREE.ShapeUtils.triangulateShape(pts, []); } catch { continue; }
    c.set(colorOf(p));
    for (const t of tris) for (const k of [t[0], t[2], t[1]]) { pos.push(pts[k].x, y, pts[k].y); col.push(c.r, c.g, c.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

export function buildGround(scene: THREE.Scene, map: CityMap): void {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshLambertMaterial({ map: groundTexture() }));
  g.rotation.x = -Math.PI / 2; g.position.set(0, 0, 200); g.receiveShadow = true; scene.add(g);
  const LC = ['#6a9444', '#9aae55', '#3f6b2e', '#6c9268', '#cdb987'];
  const lm = new THREE.Mesh(flatPolys(map.land, 0.02, (p) => LC[(p as { code: number } & Poly).code]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  lm.receiveShadow = true; scene.add(lm);
  scene.add(new THREE.Mesh(flatPolys(map.water, 0.05, () => '#ffffff'), MAT.water));
  const e = new THREE.Mesh(new THREE.BoxGeometry(POND.w * 2 + 2.4, 0.06, POND.d * 2 + 2.4), M('#7a6247')); e.position.set(POND.x, 0.02, POND.z); scene.add(e);
}

const ROAD_C = ['#47474a', '#4e4e51', '#555557', '#5f5c57', '#68625b', '#756e60', '#9a7a55'];
export function buildRoads(scene: THREE.Scene, map: CityMap): void {
  const pos: number[] = [], col: number[] = []; const c = new THREE.Color();
  for (const r of map.roads) {
    const hw = ROAD_W[r.t] / 2, y = 0.09 - r.t * 0.008 + (r.bridge ? 0.05 : 0); c.set(ROAD_C[r.t]);
    const L: [number, number][] = [], R: [number, number][] = [];
    for (let i = 0; i < r.n; i++) {
      let nx = 0, nz = 0;
      if (i > 0) { const dx = r.xs[i] - r.xs[i - 1], dz = r.zs[i] - r.zs[i - 1], l = Math.hypot(dx, dz) || 1; nx += -dz / l; nz += dx / l; }
      if (i < r.n - 1) { const dx = r.xs[i + 1] - r.xs[i], dz = r.zs[i + 1] - r.zs[i], l = Math.hypot(dx, dz) || 1; nx += -dz / l; nz += dx / l; }
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      let k = 1;
      if (i > 0 && i < r.n - 1) { const dx = r.xs[i + 1] - r.xs[i], dz = r.zs[i + 1] - r.zs[i], ll = Math.hypot(dx, dz) || 1; k = 1 / Math.max(Math.abs((nx * -dz) / ll + (nz * dx) / ll), 0.5); }
      L.push([r.xs[i] + nx * hw * k, r.zs[i] + nz * hw * k]); R.push([r.xs[i] - nx * hw * k, r.zs[i] - nz * hw * k]);
    }
    for (let i = 0; i < r.n - 1; i++) for (const p of [L[i], R[i + 1], R[i], L[i], L[i + 1], R[i + 1]]) { pos.push(p[0], y, p[1]); col.push(c.r, c.g, c.b); }
    // round discs at the ends (and at every bend of the main roads) so junctions read as filled
    for (let i = 0; i < r.n; i++) {
      if (i > 0 && i < r.n - 1 && r.t > 2) continue;
      const cx = r.xs[i], cz = r.zs[i];
      for (let s = 0; s < 8; s++) {
        const a1 = (s / 8) * Math.PI * 2, a2 = ((s + 1) / 8) * Math.PI * 2;
        pos.push(cx, y - 0.002, cz, cx + Math.cos(a2) * hw, y - 0.002, cz + Math.sin(a2) * hw, cx + Math.cos(a1) * hw, y - 0.002, cz + Math.sin(a1) * hw);
        for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  m.receiveShadow = true; scene.add(m);
}

export function buildTrees(scene: THREE.Scene, map: CityMap): void {
  const rng = mulberry(5);
  type T = { x: number; z: number; s: number; ry: number };
  const lists: Record<'broad' | 'areca' | 'banana' | 'coco', T[]> = { broad: [], areca: [], banana: [], coco: [] };
  const farmClear = (x: number, z: number) => Math.hypot(x - HOME.x, z - HOME.z) < 30 || inFarm(x, z) || Math.hypot(x - RINA.house.x, z - RINA.house.z) < 14 || Math.hypot(x - POND.x, z - POND.z) < 10;
  const special = [SPOTS.gopal, SPOTS.pandal, SPOTS.busTerminus, ...STANDS.map((s) => [s.x, s.z] as const)];
  let tries = 0, count = 0;
  // more trees now the map runs west to the palace and Paradise Chowmuhani
  while (tries++ < 100000 && count < 15000) {
    const x = X0 + rng() * (X1 - X0), z = Z0 + rng() * (Z1 - Z0);
    if (map.inBuilding(x, z) || map.inWaterPoly(x, z) || farmClear(x, z) || inPalaceGarden(x, z)) continue;
    if (((x - 1462) / 104) ** 2 + ((z - 962) / 98) ** 2 < 1) continue; // the cricket ground and its galleries
    const rn = map.roadNear(x, z); if (rn && rn.d < ROAD_W[rn.r.t] / 2 + 1.5) continue;
    if (special.some((s) => Math.hypot(x - s[0], z - s[1]) < 10)) continue;
    const near = map.nearBuilding(x, z, 2.5);
    const t: T = { x, z, s: 0.75 + rng() * 0.6, ry: rng() * 6 }; const k = rng();
    if (near) (k < 0.45 ? lists.areca : k < 0.7 ? lists.banana : k < 0.85 ? lists.coco : lists.broad).push(t);
    else (k < 0.7 ? lists.broad : k < 0.9 ? lists.areca : lists.coco).push(t);
    map.treeGrid.add(x - 0.5, z - 0.5, x + 0.5, z + 0.5, t); count++;
  }
  const d = new THREE.Object3D();
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: T[]) => {
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => { d.position.set(t.x, getH(t.x, t.z) - 0.05, t.z); d.rotation.set(0, t.ry, 0); d.scale.setScalar(t.s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  };
  const g1 = new THREE.CylinderGeometry(0.25, 0.38, 3.4, 6); g1.translate(0, 1.7, 0);
  const g2 = new THREE.IcosahedronGeometry(2.8, 0); g2.translate(0, 4.8, 0);
  inst(g1, M('#5b4632'), lists.broad); const cr = inst(g2, M('#ffffff'), lists.broad);
  const greens = ['#2f5a28', '#3b6a2c', '#466f2e', '#335c2f', '#4c7a33']; const col = new THREE.Color();
  lists.broad.forEach((_, i) => cr.setColorAt(i, col.set(greens[i % greens.length]))); if (cr.instanceColor) cr.instanceColor.needsUpdate = true;
  const a1 = new THREE.CylinderGeometry(0.1, 0.14, 10, 5); a1.translate(0, 5, 0);
  const a2 = new THREE.IcosahedronGeometry(1.4, 0); a2.scale(1.5, 0.55, 1.5); a2.translate(0, 10.2, 0);
  inst(a1, M('#8d8574'), lists.areca); inst(a2, M('#3f6b2a'), lists.areca);
  const b1 = new THREE.CylinderGeometry(0.18, 0.24, 2, 6); b1.translate(0, 1, 0);
  const b2 = new THREE.IcosahedronGeometry(1.3, 0); b2.scale(1.5, 0.75, 1.5); b2.translate(0, 2.5, 0);
  inst(b1, M('#7d8a4a'), lists.banana); inst(b2, M('#6fa13a'), lists.banana);
  const c1 = new THREE.CylinderGeometry(0.16, 0.22, 11, 6); c1.translate(0, 5.5, 0); c1.rotateZ(0.08);
  const c2 = new THREE.ConeGeometry(2.6, 1.4, 7, 1, true); c2.translate(0, 11, 0);
  inst(c1, M('#7a6a52'), lists.coco); inst(c2, new THREE.MeshLambertMaterial({ color: '#4d7d2e', side: THREE.DoubleSide }), lists.coco);
}

export function buildHills(scene: THREE.Scene): void {
  for (const t of HILLS) {
    const S = t.r * 3.2, geo = new THREE.PlaneGeometry(S * 2, S * 2, 56, 56); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const cf = new THREE.Color('#9aae55'), cl = new THREE.Color('#a0583a'), cs = new THREE.Color('#5d7a33'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + t.x, z = pos.getZ(i) + t.z, h = getH(x, z); pos.setY(i, h + 0.03);
      c.copy(cf).lerp(cs, smooth(0.15, 1.5, h)).lerp(cl, smooth(2, t.h, h) * 0.55 * (0.6 + rnd2(Math.floor(x / 3), Math.floor(z / 3)) * 0.8));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.position.set(t.x, 0, t.z); m.receiveShadow = true; scene.add(m);
  }
}

export interface Sky { stars: THREE.Points; rain: THREE.Points }
export function buildSky(scene: THREE.Scene): Sky {
  const n = 700, p = new Float32Array(n * 3); const r = mulberry(3);
  for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = r() * Math.PI * 0.45; p.set([Math.cos(th) * Math.sin(ph) * 1500, Math.cos(ph) * 1500 + 50, Math.sin(th) * Math.sin(ph) * 1500], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(stars);
  const rn = 1800, rp = new Float32Array(rn * 3); for (let i = 0; i < rn; i++) rp.set([(r() - 0.5) * 70, r() * 32, (r() - 0.5) * 70], i * 3);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xbfd3e0, size: 0.12, transparent: true, opacity: 0.7, depthWrite: false })); rain.visible = false; scene.add(rain);
  return { stars, rain };
}

/** Name labels floating over landmarks. They hide when you are too far or right underneath. */
export class Labels {
  private list: THREE.Sprite[] = [];
  constructor(private scene: THREE.Scene) {}
  add(text: string, sub: string | null, x: number, y: number, z: number, scale = 1, far = 900): THREE.Sprite {
    const cv = document.createElement('canvas'); cv.width = 768; cv.height = 200; const c = cv.getContext('2d')!;
    c.textAlign = 'center'; c.lineJoin = 'round';
    c.font = '64px "Tiro Bangla", Georgia, serif'; c.lineWidth = 10; c.strokeStyle = 'rgba(20,14,24,.85)'; c.strokeText(text, 384, 86); c.fillStyle = '#f6efe0'; c.fillText(text, 384, 86);
    if (sub) { c.font = '44px "Tiro Bangla", "Kohinoor Bangla", "Noto Sans Bengali", sans-serif'; c.lineWidth = 8; c.strokeText(sub, 384, 160); c.fillStyle = '#e9b23b'; c.fillText(sub, 384, 160); }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
    s.position.set(x, y, z); s.scale.set(15 * scale, 3.9 * scale, 1); s.userData.far = far; this.scene.add(s); this.list.push(s); return s;
  }
  update(px: number, pz: number): void {
    for (const l of this.list) { const d = Math.hypot(l.position.x - px, l.position.z - pz); l.visible = d < l.userData.far && d > 25; }
  }
}
