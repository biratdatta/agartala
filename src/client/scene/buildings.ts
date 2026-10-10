/**
 * Fits a model from the asset kit (public/models/kit.glb) to every OpenStreetMap footprint.
 * The bake step stored each footprint's best-fit rectangle and which side faces the road;
 * here we pick a building type from its size, its street and the neighbourhood, and draw
 * the city with instancing: detailed models near the player, plain blocks in the distance.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { rnd2 } from '../../shared/rng.js';
import type { CityMap } from '../map/data.js';
import { REAL_PLACES, inCampus } from '../../shared/places.js';
import { pip } from '../map/data.js';
import { GFX } from './gfx.js';

export interface Arch { name: string; geo: THREE.BufferGeometry; W: number; D: number; h: number; roof: string }
export interface Kit { arch: Map<string, Arch>; material: THREE.MeshLambertMaterial; /** The same atlas with glossy paint, for vehicles (realistic graphics). */ vehicleMaterial: THREE.MeshLambertMaterial }

const ROOF: Record<string, string> = { hut_grey: '#8c969c', hut_rust: '#965234', hut_bamboo: '#965234', assam_blue: '#466e96', assam_green: '#487858', assam_rust: '#965234', godown: '#8c969c' };

/** One shared material. Wall faces (vertex attribute _tint = 1) take the per-building paint colour. */
function kitMaterial(src: THREE.MeshStandardMaterial, pbr: { roughness: number; metalness: number } = { roughness: 0.86, metalness: 0 }): THREE.MeshLambertMaterial {
  const m = GFX.realistic
    ? (new THREE.MeshStandardMaterial({ map: src.map, emissiveMap: src.emissiveMap, emissive: new THREE.Color(1, 0.95, 0.85), emissiveIntensity: 0, ...pbr }) as unknown as THREE.MeshLambertMaterial)
    : new THREE.MeshLambertMaterial({ map: src.map, emissiveMap: src.emissiveMap, emissive: new THREE.Color(1, 0.95, 0.85), emissiveIntensity: 0 });
  if (m.map) { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; }
  if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float _tint;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n  vColor.xyz = mix(vec3(1.0), instanceColor.xyz, _tint);\n#endif');
  };
  return m;
}

export async function loadKit(url = '/models/kit.glb'): Promise<Kit> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const arch = new Map<string, Arch>(); let material: THREE.MeshLambertMaterial | null = null; let vehicleMaterial: THREE.MeshLambertMaterial | null = null;
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
    if (!material) { material = kitMaterial(mesh.material as THREE.MeshStandardMaterial); vehicleMaterial = kitMaterial(mesh.material as THREE.MeshStandardMaterial, { roughness: 0.34, metalness: 0.35 }); }
    const ex = (o.userData || {}) as { W?: number; D?: number; h?: number };
    arch.set(o.name, { name: o.name, geo: mesh.geometry, W: ex.W || 10, D: ex.D || 10, h: ex.h || 6, roof: ROOF[o.name] || '#c9c4ba' });
  });
  if (!material) throw new Error('The asset kit has no meshes');
  return { arch, material, vehicleMaterial: vehicleMaterial! };
}

/* ---------------- choosing a building for a footprint ---------------- */
const PAINT = ['#f3ead6', '#efe0c2', '#e6d0b0', '#dfe9d4', '#d4e2ec', '#f2d4cc', '#f6f2ea', '#e2d6ec', '#f0e2a8', '#cfe0c6', '#f4e6c8', '#dbe8ee', '#f1c9a5', '#c8dce6'];
export interface Plan { cx: number; cz: number; w: number; d: number; ang: number; arch: string; tint: string; /** A real place this building is (see places.ts). */ place?: string }

export function planBuildings(map: CityMap): Plan[] {
  const bo = map.raw.bo; if (!bo) return [];
  const plans = bo.map((a, i) => {
    const cx = a[0] / 2, cz = a[1] / 2, w = Math.max(2.5, a[2] / 2), d = Math.max(2.5, a[3] / 2), ang = a[4] / 1000, roadT = a[5], roadD = a[6];
    const A = w * d, r = rnd2(cx * 0.13, cz * 0.17), r2 = rnd2(cz * 0.11, cx * 0.07), lv = map.buildings[i]?.lv || 0;
    const main = roadT <= 2 && roadD < 12, central = Math.hypot(cx - 1150, cz - 650) < 650, pick = <T,>(l: T[], v: number) => l[Math.floor(v * l.length) % l.length];
    const shop2 = pick(['shop2_a', 'shop2_b', 'shop2_c'], r2), shop3 = pick(['shop3_a', 'shop3_b', 'shop3_c'], r2);
    let arch: string;
    if (lv >= 4) arch = 'rcc4';
    else if (lv === 3) arch = main ? shop3 : 'rcc3';
    else if (lv === 2) arch = main ? shop2 : 'rcc2';
    else if (A < 45) arch = central && r2 < 0.45 ? 'rcc1' : pick(['hut_grey', 'hut_rust', 'hut_bamboo', 'hut_rust'], r);
    else if (A < 120) arch = main ? shop2 : central ? pick(['rcc1', 'rcc2', 'rcc2', 'assam_blue', 'rcc1'], r) : pick(['assam_blue', 'assam_green', 'assam_rust', 'rcc1', 'hut_rust', 'rcc2'], r);
    else if (A < 300) arch = main ? pick([shop2, shop3], r) : central ? pick(['rcc2', 'rcc3', 'rcc3', 'rcc4'], r) : pick(['rcc2', 'rcc2', 'assam_green', 'rcc3', 'assam_rust'], r);
    else if (A < 700) arch = main ? shop3 : r < 0.25 ? 'godown' : pick(['rcc3', 'rcc4', 'rcc4'], r2);
    else arch = r < 0.55 ? 'block' : 'godown';
    return { cx, cz, w, d, ang, arch, tint: PAINT[Math.floor(r2 * 997) % PAINT.length] } as Plan;
  });
  return realBuildings(map, plans);
}

/**
 * The real places: MBB College's halls in its yellow and brown, and the buildings OpenStreetMap
 * names (the law college, the schools, the clinic…) in their own colours and shapes. The Shiv
 * Mandir's footprint is left empty because the game puts a temple model there.
 */
function realBuildings(map: CityMap, plans: Plan[]): Plan[] {
  const osm = map.raw.bs ?? plans.length;
  for (let i = 0; i < osm; i++) {
    const p = plans[i];
    if (inCampus(p.cx, p.cz)) { p.tint = i % 3 ? '#e8c25a' : '#d9a441'; p.place = 'mbbcollege'; p.arch = ''; }
    // the stadium's own buildings: pavilion, galleries and offices round the ground
    else if (((p.cx - 1459) / 120) ** 2 + ((p.cz - 962) / 110) ** 2 < 1) { p.tint = '#cfc9bd'; p.place = 'stadium'; p.arch = ''; }
  }
  for (const pl of REAL_PLACES) {
    if (!pl.paint) continue;
    let best = -1, bd = 12;
    for (let i = 0; i < osm; i++) {
      const b = map.buildings[i]; if (!b || pl.x < b.minx - 12 || pl.x > b.maxx + 12 || pl.z < b.minz - 12 || pl.z > b.maxz + 12) continue;
      const d = pip(pl.x, pl.z, b) ? 0 : Math.hypot(plans[i].cx - pl.x, plans[i].cz - pl.z); if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) continue;
    // drawn from its real footprint by RealPlaces, not from the kit
    const p = plans[best]; p.tint = pl.paint; p.place = pl.id; p.arch = '';
  }
  return plans;
}

/* ---------------- drawing the city ---------------- */
interface Chunk { cx: number; cz: number; near: THREE.Group; far: THREE.Mesh }
export class City {
  private chunks: Chunk[] = [];
  constructor(scene: THREE.Scene, kit: Kit, plans: Plan[], private nearDist = 700) {
    const CH = 400; const groups = new Map<string, Plan[]>();
    for (const p of plans) { const k = Math.floor(p.cx / CH) + ',' + Math.floor(p.cz / CH); let g = groups.get(k); if (!g) groups.set(k, (g = [])); g.push(p); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    for (const [k, list] of groups) {
      const [gx, gz] = k.split(',').map(Number);
      const near = new THREE.Group(); const byArch = new Map<string, Plan[]>();
      for (const p of list) { let a = byArch.get(p.arch); if (!a) byArch.set(p.arch, (a = [])); a.push(p); }
      for (const [name, ps] of byArch) {
        const a = kit.arch.get(name); if (!a) continue;
        const im = new THREE.InstancedMesh(a.geo, kit.material, ps.length);
        ps.forEach((p, i) => { q.setFromAxisAngle(up, p.ang); s.set(p.w / a.W, 1, p.d / a.D); t.set(p.cx, 0, p.cz); m4.compose(t, q, s); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(p.tint)); });
        im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); near.add(im);
      }
      scene.add(near);
      const far = new THREE.Mesh(this.blocks(list, kit), new THREE.MeshLambertMaterial({ vertexColors: true }));
      far.visible = false; scene.add(far);
      this.chunks.push({ cx: (gx + 0.5) * CH, cz: (gz + 0.5) * CH, near, far });
    }
  }
  /** Plain coloured blocks with the right height and roof colour, for distant views. */
  private blocks(list: Plan[], kit: Kit): THREE.BufferGeometry {
    const pos: number[] = [], col: number[] = [], nor: number[] = []; const wc = new THREE.Color(), rc = new THREE.Color();
    for (const p of list) {
      const a = kit.arch.get(p.arch); if (!a) continue;
      const H = a.h * 0.92, c = Math.cos(p.ang), sn = Math.sin(p.ang), hw = p.w / 2, hd = p.d / 2;
      const P = (lx: number, lz: number): [number, number] => [p.cx + lx * c + lz * sn, p.cz - lx * sn + lz * c];
      const k = [P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd)];
      wc.set(p.tint).multiplyScalar(0.85); rc.set(a.roof);
      for (let i = 0; i < 4; i++) {
        const A = k[i], B = k[(i + 1) % 4]; const nx = B[1] - A[1], nz = -(B[0] - A[0]); const l = Math.hypot(nx, nz) || 1;
        for (const v of [[A, 0], [B, 0], [B, H], [A, 0], [B, H], [A, H]] as [[number, number], number][]) { pos.push(v[0][0], v[1], v[0][1]); col.push(wc.r, wc.g, wc.b); nor.push(nx / l, 0, nz / l); }
      }
      for (const v of [k[0], k[1], k[2], k[0], k[2], k[3]]) { pos.push(v[0], H, v[1]); col.push(rc.r, rc.g, rc.b); nor.push(0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.computeBoundingSphere(); return g;
  }
  /** Swaps detailed and plain versions by distance. Cheap: called a couple of times a second. */
  update(x: number, z: number): void {
    for (const c of this.chunks) { const near = Math.hypot(c.cx - x, c.cz - z) < this.nearDist; c.near.visible = near; c.far.visible = !near; }
  }
}

/** A handful of kit meshes that move every frame (traffic, the tomtom you ride). */
export class KitFleet {
  readonly mesh: THREE.InstancedMesh;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(1, 1, 1); private t = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);
  constructor(scene: THREE.Scene, kit: Kit, name: string, count: number, colors: string[]) {
    const a = kit.arch.get(name); if (!a) throw new Error(`Kit has no ${name}`);
    this.mesh = new THREE.InstancedMesh(a.geo, kit.vehicleMaterial, count); const c = new THREE.Color(); // glossy paint when realistic
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, c.set(colors[i % colors.length]));
    this.mesh.castShadow = true; this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  set(i: number, x: number, y: number, z: number, rot: number): void {
    this.q.setFromAxisAngle(this.up, rot); this.t.set(x, y, z); this.m4.compose(this.t, this.q, this.s); this.mesh.setMatrixAt(i, this.m4); this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide(i: number): void { this.m4.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m4); this.mesh.instanceMatrix.needsUpdate = true; }
}
