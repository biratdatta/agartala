/**
 * The real places of College Tilla and around, built as close to life as the map allows:
 * landmark buildings drawn from their actual OpenStreetMap footprints with proper facades,
 * name boards on them, MBB College's portico and gate, the stadium's pitch, galleries and
 * pavilion, the Modern Club Shiv Mandir, the masjid's dome, ghats, benches, lamps and boats on
 * the lakes, and the swings and fence of Modern Club Park.
 */
import * as THREE from 'three';
import { REAL_PLACES, type RealPlace } from '../../shared/places.js';
import { mulberry } from '../../shared/rng.js';
import { colliders } from '../collide.js';
import { type CityMap, type Poly, ROAD_W, getH, pip } from '../map/data.js';
import type { Kit, Plan } from './buildings.js';
import { add, box, canvasTexture, cyl, place, sph } from './kit.js';
import { Palace } from './palace.js';

/* ---------- textures ---------- */
type Style = 'arch' | 'plain' | 'school' | 'gallery' | 'shop';
/** One bay (3 m wide) by one floor (3.2 m) of facade, in greys so the wall colour tints it. Also a mask of the windows for night. */
function facade(style: Style): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; return cv; };
  const a = mk(), g = mk(); const c = a.getContext('2d')!, m = g.getContext('2d')!;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128); m.fillStyle = '#000'; m.fillRect(0, 0, 128, 128);
  const win = (x: number, y: number, w: number, h: number, arch = false) => {
    c.fillStyle = '#c9c4ba'; c.fillRect(x - 4, y - 4, w + 8, h + 10); // frame and sill
    c.fillStyle = '#2b3440'; if (arch) { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); c.fill(); } else c.fillRect(x, y, w, h);
    c.fillStyle = '#56606c'; c.fillRect(x + w / 2 - 1, y, 2, h); c.fillRect(x, y + h * 0.55, w, 2);
    m.fillStyle = '#ffd890'; m.fillRect(x + 2, y + 2, w - 4, h - 4);
  };
  if (style === 'arch') { c.fillStyle = '#d8d2c6'; c.fillRect(0, 0, 10, 128); c.fillRect(118, 0, 10, 128); c.fillRect(0, 0, 128, 10); win(36, 26, 56, 76, true); }
  else if (style === 'school') { c.fillStyle = '#e6e0d4'; c.fillRect(0, 108, 128, 20); win(18, 30, 92, 56); }
  else if (style === 'gallery') { for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#d0cac0' : '#bdb7ad'; c.fillRect(0, i * 21, 128, 21); } c.fillStyle = '#3a4048'; c.fillRect(10, 40, 108, 36); m.fillStyle = '#806040'; m.fillRect(10, 40, 108, 36); }
  else if (style === 'shop') { c.fillStyle = '#3a4048'; c.fillRect(8, 20, 112, 100); c.fillStyle = '#8a8f94'; for (let x = 8; x < 120; x += 8) c.fillRect(x, 20, 2, 100); m.fillStyle = '#ffd890'; m.fillRect(8, 20, 112, 100); }
  else win(34, 32, 60, 62);
  const map = canvasTexture(a), glow = canvasTexture(g);
  for (const t of [map, glow]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return { map, glow };
}

/** Walls, parapet and roof for a footprint, `floors` storeys high. UVs repeat one bay per 3 m and one floor per 3.2 m. */
function extrude(poly: Poly, H: number, y0: number): { walls: THREE.BufferGeometry; roof: THREE.BufferGeometry; parapet: THREE.BufferGeometry } {
  const pos: number[] = [], uv: number[] = [], nor: number[] = []; const ppos: number[] = [], pnor: number[] = [];
  let area = 0; for (let i = 0, j = poly.n - 1; i < poly.n; j = i++) area += poly.xs[j] * poly.zs[i] - poly.xs[i] * poly.zs[j];
  const sgn = area > 0 ? 1 : -1; let u0 = 0;
  for (let i = 0; i < poly.n; i++) {
    const j = (i + 1) % poly.n; const ax = poly.xs[i], az = poly.zs[i], bx = poly.xs[j], bz = poly.zs[j]; const L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
    const nx = ((bz - az) / L) * sgn, nz = (-(bx - ax) / L) * sgn; const u1 = u0 + L / 3;
    const quad = (arr: number[], na: number[], ya: number, yb: number, withUv: boolean) => {
      for (const [x, y, z, u, v] of [[ax, ya, az, u0, ya - y0], [bx, ya, bz, u1, ya - y0], [bx, yb, bz, u1, yb - y0], [ax, ya, az, u0, ya - y0], [bx, yb, bz, u1, yb - y0], [ax, yb, az, u0, yb - y0]]) { arr.push(x, y, z); na.push(nx, 0, nz); if (withUv) uv.push(u, v / 3.2); }
    };
    quad(pos, nor, y0, y0 + H, true); quad(ppos, pnor, y0 + H, y0 + H + 0.9, false); u0 = u1;
  }
  const walls = new THREE.BufferGeometry(); walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); walls.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); walls.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const parapet = new THREE.BufferGeometry(); parapet.setAttribute('position', new THREE.Float32BufferAttribute(ppos, 3)); parapet.setAttribute('normal', new THREE.Float32BufferAttribute(pnor, 3));
  const shape = new THREE.Shape(); for (let i = 0; i < poly.n; i++) { if (i) shape.lineTo(poly.xs[i], -poly.zs[i]); else shape.moveTo(poly.xs[i], -poly.zs[i]); }
  const roof = new THREE.ShapeGeometry(shape); roof.rotateX(-Math.PI / 2); roof.translate(0, y0 + H + 0.05, 0);
  return { walls, roof, parapet };
}

/** A painted name board: English on top, Bangla below. */
function board(name: string, bn: string | undefined, colour = '#1c3d5a', w = 0): THREE.Mesh {
  const cv = document.createElement('canvas'); const big = name.length > 26;
  cv.width = 1024; cv.height = bn ? 256 : 160; const c = cv.getContext('2d')!;
  c.fillStyle = colour; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#e9b23b'; c.fillRect(0, cv.height - 14, cv.width, 14);
  c.fillStyle = '#f6efe0'; c.textAlign = 'center'; c.font = `700 ${big ? 54 : 66}px "Hind Siliguri", system-ui, sans-serif`; c.fillText(name, 512, 100);
  if (bn) { c.font = '54px "Tiro Bangla", "Hind Siliguri", sans-serif'; c.fillStyle = '#ffe2a0'; c.fillText(bn, 512, 196); }
  const W = w || Math.max(4, Math.min(12, name.length * 0.32)), H = W * (cv.height / cv.width);
  return new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: canvasTexture(cv), side: THREE.DoubleSide }));
}

/** How each real place is built: storeys, facade style and roof colour. */
function spec(id: string, isMain: boolean, area: number): { floors: number; style: Style; roof: string } {
  switch (id) {
    case 'mbbcollege': return { floors: isMain ? 3 : area > 500 ? 2 : area > 120 ? 2 : 1, style: isMain || area > 300 ? 'arch' : 'plain', roof: '#8a5a30' };
    case 'stadium': return { floors: area > 400 ? 3 : 1, style: area > 400 ? 'gallery' : 'plain', roof: '#9aa0a6' };
    case 'lawcollege': return { floors: 2, style: 'arch', roof: '#a8a294' };
    case 'mgschool': case 'pathshala': return { floors: 2, style: 'school', roof: '#a33a2a' };
    case 'bijoy': return { floors: 5, style: 'plain', roof: '#b8b2a6' };
    case 'bhaumik': return { floors: 3, style: 'plain', roof: '#c9c4ba' };
    case 'carshringaar': return { floors: 2, style: 'shop', roof: '#a8a294' };
    case 'masjid': return { floors: 1, style: 'arch', roof: '#e8e4da' };
    case 'palace': return { floors: 3, style: 'arch', roof: '#efe9dc' };
    case 'townhall': return { floors: 2, style: 'arch', roof: '#c9bfae' };
    case 'prm': case 'citycentre': return { floors: 4, style: 'shop', roof: '#9fb0ba' };
    default: return { floors: 2, style: 'plain', roof: '#b8b2a6' };
  }
}

export class RealPlaces {
  private glows: THREE.MeshLambertMaterial[] = [];
  private rng = mulberry(404);
  private palaceModel: Palace | null = null;

  constructor(scene: THREE.Scene, private map: CityMap, kit: Kit, plans: Plan[]) {
    void kit;
    const tex = new Map<Style, ReturnType<typeof facade>>();
    const texFor = (s: Style) => { let t = tex.get(s); if (!t) tex.set(s, (t = facade(s))); return t; };
    // the main block of the college: the largest building nearest its recorded point
    const campus = plans.map((p, i) => ({ p, i })).filter(({ p }) => p.place === 'mbbcollege');
    const main = campus.reduce<{ p: Plan; i: number } | null>((a, b) => (!a || b.p.w * b.p.d - Math.hypot(b.p.cx - 1542, b.p.cz - 1003) * 4 > a.p.w * a.p.d - Math.hypot(a.p.cx - 1542, a.p.cz - 1003) * 4 ? b : a), null);
    plans.forEach((p, i) => {
      if (!p.place || p.place === 'shivmandir') return;
      if (p.place === 'palace') { this.palace(scene, p); return; }
      const poly = map.buildings[i]; if (!poly) return;
      const sp = spec(p.place, i === main?.i, p.w * p.d); const H = sp.floors * 3.2 + 0.4; const y0 = getH(p.cx, p.cz);
      const g = extrude(poly, H, y0); const t = texFor(sp.style);
      const wall = new THREE.MeshLambertMaterial({ color: p.tint, map: t.map, emissive: '#ffcf7a', emissiveMap: t.glow, emissiveIntensity: 0, side: THREE.DoubleSide });
      this.glows.push(wall);
      const w = new THREE.Mesh(g.walls, wall); w.castShadow = w.receiveShadow = true; scene.add(w);
      const par = new THREE.Mesh(g.parapet, new THREE.MeshLambertMaterial({ color: new THREE.Color(p.tint).multiplyScalar(0.85), side: THREE.DoubleSide })); par.castShadow = true; scene.add(par);
      const roof = new THREE.Mesh(g.roof, new THREE.MeshLambertMaterial({ color: sp.roof })); roof.receiveShadow = true; scene.add(roof);
      if (i === main?.i) this.portico(scene, p, H);
      if (p.place === 'masjid') this.dome(scene, p, y0 + H);
      if (p.place === 'stadium' && p.w * p.d > 400) this.canopy(scene, p, y0 + H);
      if (p.place === 'prm' || p.place === 'citycentre') this.mall(scene, p, y0 + H, p.place === 'prm' ? 'PRM Centrepoint' : 'City Centre', p.place === 'prm' ? '#0f4c75' : '#7a1f3d');
    });
    // name boards on the real buildings
    for (const pl of REAL_PLACES) {
      if (pl.kind === 'temple') { const p = plans.find((q) => q.place === pl.id); this.temple(scene, p ? p.cx : pl.x, p ? p.cz : pl.z, p ? p.ang : 0); continue; }
      if (pl.kind === 'stand') { this.motorStand(scene, pl.x, pl.z); continue; }
      const mine = plans.filter((p) => p.place === pl.id); if (!mine.length || pl.id === 'mbbcollege' || pl.id === 'stadium' || pl.id === 'palace') continue;
      const p = mine.reduce((a, b) => (Math.hypot(a.cx - pl.x, a.cz - pl.z) <= Math.hypot(b.cx - pl.x, b.cz - pl.z) ? a : b));
      this.sign(scene, pl, p, Math.min(spec(pl.id, false, p.w * p.d).floors * 3.2 - 0.6, 4.2));
    }
    this.collegeGate(scene);
    this.stadium(scene);
    this.lakes(scene);
    this.park(scene);
  }

  /** Lit windows after dark, like the rest of the city. */
  setNight(f: number): void { for (const m of this.glows) m.emissiveIntensity = f * 0.9; this.palaceModel?.setNight(f); }

  private sign(scene: THREE.Scene, pl: RealPlace, p: Plan, y: number): void {
    const fx = Math.sin(p.ang), fz = Math.cos(p.ang);
    const colour = pl.kind === 'mall' ? '#0f4c75' : pl.kind === 'civic' ? '#5a3a1c' : pl.kind === 'clinic' ? '#2f6f5a' : pl.kind === 'school' || pl.kind === 'college' ? '#24336f' : pl.kind === 'mosque' ? '#1f6f3c' : '#7d1d3f';
    const b = board(pl.name, pl.bn, colour, Math.min(p.w * 0.85, Math.max(4, pl.name.length * 0.3)));
    b.position.set(p.cx + fx * (p.d / 2 + 0.25), getH(p.cx, p.cz) + y, p.cz + fz * (p.d / 2 + 0.25)); b.rotation.y = p.ang; scene.add(b);
  }

  /** MBB College's main block: steps, a row of columns, a pediment and the name. */
  private portico(scene: THREE.Scene, p: Plan, H: number): void {
    const g = new THREE.Group(); const W = Math.min(16, p.w * 0.45);
    for (let i = 0; i < 3; i++) box(g, W + 2 - i * 0.6, 0.3, 3 - i * 0.7, '#d9cfbf', 0, 0.15 + i * 0.3, 2.2 - i * 0.35);
    for (let i = 0; i < 6; i++) cyl(g, 0.32, 0.38, H - 0.6, '#f3e7c8', -W / 2 + 0.6 + (i * (W - 1.2)) / 5, (H - 0.6) / 2 + 0.9, 2.6, 12);
    box(g, W + 0.6, 0.6, 3.4, '#d9a441', 0, H + 0.3, 2); const ped = add(g, new THREE.CylinderGeometry(0.01, (W + 0.6) / 2, 2.2, 3, 1), '#e8c25a', 0, H + 1.7, 2.1); ped.rotation.set(Math.PI / 2, 0, Math.PI / 2); ped.scale.set(1, 1.5, 0.6);
    const b = board('Maharaja Bir Bikram College', 'মহারাজা বীর বিক্রম কলেজ', '#7a4a22', Math.min(W, 10)); b.position.set(0, H - 0.4, 3.75); g.add(b);
    const fx = Math.sin(p.ang), fz = Math.cos(p.ang); g.position.set(p.cx + fx * (p.d / 2), getH(p.cx, p.cz), p.cz + fz * (p.d / 2)); g.rotation.y = p.ang; scene.add(g);
  }

  /** Ujjayanta Palace: its own model (palace.ts) on the real footprint, front to the lakes, with the gate board. */
  private palace(scene: THREE.Scene, p: Plan): void {
    // the long side is the front, and it faces south, to the lakes
    let ang = p.ang + (p.w >= p.d ? 0 : Math.PI / 2); if (Math.cos(ang) < 0) ang += Math.PI;
    const W = Math.max(p.w, p.d), D = Math.min(p.w, p.d);
    const pal = new Palace(scene, p.cx, p.cz, ang, W, D); this.palaceModel = pal;
    const { x: gx, z: gz, ux, uz } = pal.gate; const white = '#f6f3ec';
    const b = board('Ujjayanta Palace · Tripura State Museum', 'উজ্জয়ন্ত প্রাসাদ', '#5a3a1c', 9);
    const gate = new THREE.Group(); for (const s of [-1, 1]) { box(gate, 1.4, 6, 1.4, white, s * 6, 3, 0); sph(gate, 0.8, white, s * 6, 6.6, 0, 10, 8); } b.position.y = 4.6; gate.add(b);
    gate.position.set(gx, getH(gx, gz), gz); gate.rotation.y = ang; scene.add(gate); for (const s of [-1, 1]) colliders.push({ x: gx + ux * s * 6, z: gz + uz * s * 6, r: 1 });
  }

  /** A mall: glass across the ground floor, a canopy, and its name lit up on the roof. */
  private mall(scene: THREE.Scene, p: Plan, y: number, name: string, colour: string): void {
    const fx = Math.sin(p.ang), fz = Math.cos(p.ang); const g = new THREE.Group();
    box(g, p.w * 0.9, 3.4, 0.2, '#7fb3cc', 0, 1.9 - (y - getH(p.cx, p.cz)), 0);
    const can = box(g, p.w * 0.9, 0.25, 3, '#e8e8e2', 0, 3.9 - (y - getH(p.cx, p.cz)), 1.5); can.castShadow = true;
    const b = board(name, undefined, colour, Math.min(p.w * 0.8, 16)); b.position.set(0, 2.2, 0); g.add(b);
    const glow = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffd27a', emissiveIntensity: 0 }); this.glows.push(glow);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.min(p.w * 0.8, 16), 0.2, 0.2), glow); strip.position.set(0, 0.6, 0.1); g.add(strip);
    g.position.set(p.cx + fx * (p.d / 2 + 0.3), y, p.cz + fz * (p.d / 2 + 0.3)); g.rotation.y = p.ang; scene.add(g);
  }

  /** Motor Stand: a shelter, a row of buses and jeeps waiting to fill, and the stand's board. */
  private motorStand(scene: THREE.Scene, x: number, z: number): void {
    const rn = this.map.roadNear(x, z); const rot = rn ? this.map.roadAngle(rn) : 0;
    // along the road (nx, nz) and across it, pointing away from the road to the stand's side (ox, oz)
    const nx = Math.sin(rot), nz = Math.cos(rot); let ox = Math.cos(rot), oz = -Math.sin(rot);
    if (rn && (x - rn.px) * ox + (z - rn.pz) * oz < 0) { ox = -ox; oz = -oz; }
    const kerb = rn ? ROAD_W[rn.r.t] / 2 : 0; const bx0 = rn ? rn.px : x, bz0 = rn ? rn.pz : z;
    const cols = ['#c9452f', '#2f6fb0', '#e9b23b', '#2f8f4e'];
    for (let i = 0; i < 4; i++) {
      const bus = new THREE.Group(); const L = i % 2 ? 6 : 10;
      box(bus, 2.5, 2.6, L, cols[i], 0, 1.7, 0); box(bus, 2.52, 0.7, L - 0.6, '#9fc7d6', 0, 2.3, 0); box(bus, 2.55, 0.3, L, '#f2e6c8', 0, 1.2, 0);
      for (const zz of [-L / 2 + 1.5, L / 2 - 1.8]) for (const xx of [-1.2, 1.2]) cyl(bus, 0.5, 0.5, 0.3, '#1a1a1a', xx, 0.5, zz, 10).rotation.z = Math.PI / 2;
      const bx = bx0 + nx * (i - 1.5) * 12 + ox * (kerb + 2.2), bz = bz0 + nz * (i - 1.5) * 12 + oz * (kerb + 2.2);
      if (this.map.nearBuilding(bx, bz, 2)) continue;
      place(scene, bus, bx, bz, rot); colliders.push({ x: bx, z: bz, r: 2.2 });
    }
    const sh = new THREE.Group(); for (const s of [-1, 1]) for (const t of [-1, 1]) cyl(sh, 0.12, 0.12, 3, '#5d6266', s * 4.5, 1.5, t * 1.4, 6);
    const roof = box(sh, 10, 0.2, 3.6, '#2f6f5a', 0, 3.1, 0); roof.rotation.x = 0.06; box(sh, 8, 0.1, 0.5, '#7a5a3a', 0, 0.5, -0.9);
    const b = board('Motor Stand', 'মোটর স্ট্যান্ড', '#2f6f5a', 5); b.position.set(0, 4.1, 0); sh.add(b);
    const sx = bx0 + ox * (kerb + 6.5) + nx * 26, sz = bz0 + oz * (kerb + 6.5) + nz * 26; if (!this.map.nearBuilding(sx, sz, 2)) { place(scene, sh, sx, sz, rot + Math.PI / 2); colliders.push({ x: sx, z: sz, r: 1.2 }); }
  }

  /** A sloping roof canopy over a gallery stand. */
  private canopy(scene: THREE.Scene, p: Plan, y: number): void {
    const g = new THREE.Group(); const L = Math.max(p.w, p.d), D = Math.min(p.w, p.d);
    for (let i = 0; i <= 6; i++) cyl(g, 0.12, 0.12, 3, '#6f777d', -L / 2 + (i * L) / 6, 1.5, -D / 2 + 0.5, 6);
    const r = box(g, L + 1, 0.15, D + 3, '#e8e8e2', 0, 3.1, 1); r.rotation.x = -0.08;
    g.position.set(p.cx, y, p.cz); g.rotation.y = p.w >= p.d ? p.ang : p.ang + Math.PI / 2; scene.add(g);
  }

  /** A small white temple with a shikhara, a kalash and a saffron flag. */
  private temple(scene: THREE.Scene, x: number, z: number, rot: number): void {
    const g = new THREE.Group();
    box(g, 9, 0.6, 9, '#d9cfbf', 0, 0.3, 0); box(g, 7, 3.4, 7, '#f6efe0', 0, 2.3, 0); box(g, 2.4, 2.6, 0.2, '#7d1d3f', 0, 1.9, 3.55);
    for (let i = 0; i < 5; i++) box(g, 5.2 - i * 0.9, 1, 5.2 - i * 0.9, i % 2 ? '#f0e4cc' : '#f6efe0', 0, 4.5 + i * 1, 0);
    add(g, new THREE.ConeGeometry(0.9, 1.8, 8), '#e9b23b', 0, 10.4, 0); sph(g, 0.35, '#e9b23b', 0, 11.5, 0, 8, 6);
    cyl(g, 0.04, 0.04, 2.2, '#5b4632', 0, 12.6, 0, 4); const flag = box(g, 0.9, 0.5, 0.03, '#f39a1c', 0.45, 13.4, 0); flag.rotation.y = 0.2;
    for (const sx of [-2.9, 2.9]) cyl(g, 0.25, 0.25, 3.4, '#ece2cf', sx, 2.3, 3.6, 8);
    const bell = sph(g, 0.22, '#c9a24a', 0, 3.6, 3.6, 8, 6); bell.scale.y = 1.2;
    place(scene, g, x, z, rot); colliders.push({ x, z, r: 4.6 });
    const b = board('Modern Club Shiv Mandir', 'মডার্ন ক্লাব শিব মন্দির', '#7d1d3f', 5); b.position.set(x + Math.sin(rot) * 4.7, getH(x, z) + 4.4, z + Math.cos(rot) * 4.7); b.rotation.y = rot; scene.add(b);
  }

  private dome(scene: THREE.Scene, p: Plan, y: number): void {
    const g = new THREE.Group(); const r = Math.min(p.w, p.d) * 0.28;
    add(g, new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#2f8f4e', 0, 0, 0); cyl(g, 0.08, 0.08, 1.2, '#e9b23b', 0, r + 0.4, 0, 6);
    const m = new THREE.Group(); cyl(m, 0.4, 0.5, 7, '#f2f2ec', 0, 3.5, 0, 8); add(m, new THREE.ConeGeometry(0.55, 1.4, 8), '#2f8f4e', 0, 7.7, 0); m.position.set(p.w * 0.35, 0, -p.d * 0.3); g.add(m);
    g.position.set(p.cx, y, p.cz); g.rotation.y = p.ang; scene.add(g);
  }

  private collegeGate(scene: THREE.Scene): void {
    const rn = this.map.roadNear(1548, 1108); if (!rn) return;
    const ang = this.map.roadAngle(rn), hw = ROAD_W[rn.r.t] / 2 + 0.9; const px = Math.cos(ang), pz = -Math.sin(ang);
    const g = new THREE.Group();
    for (const s of [-1, 1]) { box(g, 1.1, 5.2, 1.1, '#d9a441', s * hw, 2.6, 0); box(g, 1.4, 0.4, 1.4, '#7a4a22', s * hw, 5.4, 0); sph(g, 0.4, '#7a4a22', s * hw, 5.9, 0, 8, 6); }
    box(g, hw * 2 + 1.2, 0.5, 0.7, '#7a4a22', 0, 5.0, 0);
    const b = board('Maharaja Bir Bikram College', 'মহারাজা বীর বিক্রম কলেজ · ১৯৪৭', '#7a4a22', Math.min(hw * 2, 9)); b.position.set(0, 6.5, 0); g.add(b);
    g.position.set(rn.px, getH(rn.px, rn.pz), rn.pz); g.rotation.y = ang; scene.add(g);
    for (const s of [-1, 1]) colliders.push({ x: rn.px + px * s * hw, z: rn.pz + pz * s * hw, r: 0.8 });
  }

  /** The ground: a cricket pitch and creases, the boundary rope, sight screens, a scoreboard, and galleries where the edge is clear. */
  private stadium(scene: THREE.Scene): void {
    const cx = 1462, cz = 962, rx = 92, rz = 86;
    const pitch = new THREE.Group();
    box(pitch, 3.05, 0.04, 20.12, '#c9ad7a', 0, 0.03, 0);
    for (const z of [-8.84, 8.84, -10.06, 10.06]) box(pitch, 3.7, 0.05, 0.08, '#ffffff', 0, 0.05, z);
    for (const z of [-10.06, 10.06]) for (const x of [-0.12, 0, 0.12]) cyl(pitch, 0.02, 0.02, 0.71, '#f2e6c8', x, 0.36, z, 4);
    place(scene, pitch, cx, cz, 0, 0.22);
    // mowing stripes on the outfield
    const cv0 = document.createElement('canvas'); cv0.width = 256; cv0.height = 16; const c0 = cv0.getContext('2d')!;
    for (let i = 0; i < 16; i++) { c0.fillStyle = i % 2 ? '#6fa84a' : '#7fb855'; c0.fillRect(i * 16, 0, 16, 16); }
    const field = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshLambertMaterial({ map: canvasTexture(cv0), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    field.rotation.x = -Math.PI / 2; field.scale.set(66, 62, 1); field.position.set(cx, 0.06, cz); field.receiveShadow = true; scene.add(field);
    const rope: number[] = []; for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2; rope.push(cx + Math.cos(a) * 66, 0.12, cz + Math.sin(a) * 62); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rope, 3)); scene.add(new THREE.LineLoop(rg, new THREE.LineBasicMaterial({ color: '#ffffff' })));
    for (const s of [-1, 1]) { const sc = new THREE.Group(); box(sc, 14, 6, 0.3, '#f6f6f2', 0, 3.6, 0); for (const x of [-6, 0, 6]) cyl(sc, 0.12, 0.12, 0.8, '#6f777d', x, 0.4, 0, 6); place(scene, sc, cx, cz + s * 70); colliders.push({ x: cx, z: cz + s * 70, r: 1 }); }
    const sb = new THREE.Group(); box(sb, 12, 5, 0.6, '#1f3a2a', 0, 6, 0); for (const x of [-4.5, 4.5]) box(sb, 0.6, 4, 0.6, '#6f777d', x, 2, 0);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 200; const c = cv.getContext('2d')!; c.fillStyle = '#1f3a2a'; c.fillRect(0, 0, 512, 200); c.fillStyle = '#ffd84a'; c.font = '700 44px "Hind Siliguri", monospace'; c.fillText('TRIPURA  214/6', 30, 70); c.fillStyle = '#f6efe0'; c.font = '34px "Hind Siliguri", monospace'; c.fillText('Overs 47.2   RR 4.51', 30, 130); c.fillText('Pavilion End  ·  City End', 30, 180);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 4.4), new THREE.MeshBasicMaterial({ map: canvasTexture(cv) })); face.position.set(0, 6, 0.31); sb.add(face);
    place(scene, sb, cx - rx * 0.55, cz - rz * 0.83, 0.55); colliders.push({ x: cx - rx * 0.55, z: cz - rz * 0.83, r: 3 });
    // stepped galleries
    const step = (Math.PI * 2) / 64; const tier = new THREE.BoxGeometry(1, 1, 1); const concrete = new THREE.MeshLambertMaterial({ color: '#b8b2a6' });
    const seatCols = ['#2f6fb0', '#e9b23b', '#c62f2f'].map((col) => new THREE.MeshLambertMaterial({ color: col }));
    const placed: { x: number; z: number; a: number; len: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += step) {
      const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz; if (this.map.nearBuilding(x, z, 3) || this.map.inWaterPoly(x, z)) continue;
      const r = this.map.roadNear(x, z); if (r && r.d < ROAD_W[r.r.t] / 2 + 4) continue;
      placed.push({ x, z, a, len: Math.hypot(Math.cos(a + step) * rx - Math.cos(a) * rx, Math.sin(a + step) * rz - Math.sin(a) * rz) + 0.2 });
    }
    const base = new THREE.InstancedMesh(tier, concrete, placed.length * 4), seats = seatCols.map((m) => new THREE.InstancedMesh(tier, m, placed.length));
    const d = new THREE.Object3D(); let k = 0;
    placed.forEach((p, i) => {
      const nx = Math.cos(p.a), nz = Math.sin(p.a); const rot = Math.atan2(nx, nz);
      for (let t = 0; t < 4; t++) { d.position.set(p.x + nx * t * 1.6, 0.5 + t * 0.9, p.z + nz * t * 1.6); d.rotation.set(0, rot, 0); d.scale.set(p.len, 1 + t * 1.8, 1.6); d.updateMatrix(); base.setMatrixAt(k++, d.matrix); }
      d.position.set(p.x + nx * 5.6, 4.3, p.z + nz * 5.6); d.scale.set(p.len, 0.25, 1.4); d.updateMatrix(); seats[Math.floor(i / 4) % 3].setMatrixAt(i, d.matrix);
      colliders.push({ x: p.x + nx * 2.4, z: p.z + nz * 2.4, r: 2.6 });
    });
    for (const m of [base, ...seats]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
    const g = new THREE.Group(); for (const s of [-4.5, 4.5]) cyl(g, 0.2, 0.2, 7, '#5d6266', s, 3.5, 0, 6);
    const b = board('Maharaja Bir Bikram Stadium', 'মহারাজা বীর বিক্রম স্টেডিয়াম', '#1c3d5a', 9.5); b.position.y = 7.4; g.add(b);
    const gx = cx, gz = cz - rz - 12; const rn = this.map.roadNear(gx, gz); place(scene, g, rn ? rn.px + 8 : gx, rn ? rn.pz + 6 : gz, rn ? this.map.roadAngle(rn) + Math.PI / 2 : 0);
  }

  /** The lake polygon around a point (the largest water shape near it). */
  private lake(x: number, z: number): Poly | null {
    let best: Poly | null = null;
    for (const w of this.map.water) if (x > w.minx && x < w.maxx && z > w.minz && z < w.maxz && (!best || (w.maxx - w.minx) * (w.maxz - w.minz) > (best.maxx - best.minx) * (best.maxz - best.minz))) best = w;
    return best;
  }
  /** Benches and lamps along the shore paths, a bathing ghat by the temple, and a few boats. */
  private lakes(scene: THREE.Scene): void {
    const benchG = new THREE.Group(); box(benchG, 1.8, 0.08, 0.45, '#7a5a3a', 0, 0.45, 0); box(benchG, 1.8, 0.4, 0.06, '#7a5a3a', 0, 0.75, -0.2); for (const x of [-0.75, 0.75]) box(benchG, 0.08, 0.45, 0.45, '#4a4a4a', x, 0.22, 0);
    const lampG = new THREE.Group(); cyl(lampG, 0.05, 0.07, 3.6, '#3a3f44', 0, 1.8, 0, 6); const bulb = sph(lampG, 0.18, '#ffe9b0', 0, 3.7, 0, 8, 6); bulb.userData.bulb = true;
    for (const [lx, lz] of [[962, 1045], [1252, 1122]] as const) {
      const w = this.lake(lx, lz); if (!w) continue;
      let acc = 0, alt = 0;
      for (let i = 0; i < w.n; i++) {
        const j = (i + 1) % w.n; const ax = w.xs[i], az = w.zs[i], bx = w.xs[j], bz = w.zs[j]; const L = Math.hypot(bx - ax, bz - az);
        for (let t = 16 - acc; t < L; t += 16) {
          const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L; const nx = -(bz - az) / L, nz = (bx - ax) / L;
          for (const s of [1, -1]) {
            const px = x + nx * s * 3, pz = z + nz * s * 3; if (pip(px, pz, w) || this.map.inWaterPoly(px, pz) || this.map.nearBuilding(px, pz, 1.5)) continue;
            const r = this.map.roadNear(px, pz); if (r && r.d < ROAD_W[r.r.t] / 2 + 0.6) break;
            const o = (alt++ % 2 ? lampG : benchG).clone(); place(scene, o, px, pz, Math.atan2(-nx * s, -nz * s)); colliders.push({ x: px, z: pz, r: 0.6 }); break;
          }
        }
        acc = (acc + L) % 16;
      }
      // boats moored or drifting on the water
      for (let k = 0, n = 0; k < 200 && n < (lx > 1000 ? 4 : 2); k++) {
        const x = w.minx + this.rng() * (w.maxx - w.minx), z = w.minz + this.rng() * (w.maxz - w.minz); if (!pip(x, z, w)) continue;
        const b = new THREE.Group(); const hull = add(b, new THREE.CylinderGeometry(0.6, 0.35, 4, 8, 1, false, 0, Math.PI), '#6b4a2a', 0, 0.2, 0); hull.rotation.set(Math.PI / 2, 0, Math.PI); box(b, 0.9, 0.05, 0.3, '#8a6a42', 0, 0.35, 0.6);
        b.position.set(x, 0.15, z); b.rotation.y = this.rng() * 6; scene.add(b); n++;
      }
    }
    // the ghat: stone steps down into College Lake by the Shiv Mandir
    const w = this.lake(962, 1045); if (!w) return;
    let best = { d: 1e9, x: 0, z: 0, i: 0 };
    for (let i = 0; i < w.n; i++) { const d = Math.hypot(w.xs[i] - 925, w.zs[i] - 1052); if (d < best.d) best = { d, x: w.xs[i], z: w.zs[i], i }; }
    const cxl = (w.minx + w.maxx) / 2, czl = (w.minz + w.maxz) / 2; const dir = Math.atan2(cxl - best.x, czl - best.z);
    const ghat = new THREE.Group(); for (let i = 0; i < 6; i++) box(ghat, 6, 0.3, 1, '#c9bfae', 0, 0.45 - i * 0.18, i * 0.9 - 1); for (const s of [-3.2, 3.2]) box(ghat, 0.4, 0.9, 6, '#b8ae9c', s, 0.3, 1.5);
    place(scene, ghat, best.x, best.z, dir);
  }

  /** Modern Club Park: a low fence, benches, a swing and a slide. */
  private park(scene: THREE.Scene): void {
    const park = this.map.land.find((l) => l.code === 0 && pip(924, 1032, l)); if (!park) return;
    const post = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5); post.translate(0, 0.45, 0); const pts: [number, number][] = [];
    for (let i = 0; i < park.n; i++) { const j = (i + 1) % park.n; const L = Math.hypot(park.xs[j] - park.xs[i], park.zs[j] - park.zs[i]); for (let t = 0; t < L; t += 2.5) pts.push([park.xs[i] + ((park.xs[j] - park.xs[i]) * t) / L, park.zs[i] + ((park.zs[j] - park.zs[i]) * t) / L]); }
    const posts = new THREE.InstancedMesh(post, new THREE.MeshLambertMaterial({ color: '#2f6f3c' }), pts.length); const d = new THREE.Object3D();
    pts.forEach(([x, z], i) => { d.position.set(x, getH(x, z), z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }); scene.add(posts);
    const cx = (park.minx + park.maxx) / 2, cz = (park.minz + park.maxz) / 2;
    const swing = new THREE.Group(); for (const x of [-1.6, 1.6]) { const l = box(swing, 0.1, 2.6, 0.1, '#c62f2f', x, 1.3, 0); l.rotation.z = x > 0 ? -0.15 : 0.15; } box(swing, 3.4, 0.1, 0.1, '#c62f2f', 0, 2.55, 0);
    for (const x of [-0.7, 0.7]) { box(swing, 0.03, 1.8, 0.03, '#444', x - 0.25, 1.6, 0); box(swing, 0.03, 1.8, 0.03, '#444', x + 0.25, 1.6, 0); box(swing, 0.6, 0.06, 0.25, '#e9b23b', x, 0.7, 0); }
    place(scene, swing, cx - 3, cz, 0.3); colliders.push({ x: cx - 3, z: cz, r: 1.6 });
    const slide = new THREE.Group(); box(slide, 0.8, 1.8, 0.8, '#2f6fb0', 0, 0.9, 0); const ramp = box(slide, 0.7, 0.06, 3, '#e9b23b', 0, 1, 1.6); ramp.rotation.x = 0.55;
    place(scene, slide, cx + 4, cz - 2, -0.4); colliders.push({ x: cx + 4, z: cz - 2, r: 1.4 });
    const benchG = new THREE.Group(); box(benchG, 1.8, 0.08, 0.45, '#7a5a3a', 0, 0.45, 0); box(benchG, 1.8, 0.4, 0.06, '#7a5a3a', 0, 0.75, -0.2);
    for (const [dx, dz, r] of [[0, 5, Math.PI], [-6, -4, 0.8], [6, 4, -2.2]] as const) { place(scene, benchG.clone(), cx + dx, cz + dz, r); }
  }
}
