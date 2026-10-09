/** Small Three.js helpers: cached materials, primitive builders and woven textures. */
import * as THREE from 'three';
import { getH } from '../map/data.js';

const cache = new Map<string, THREE.MeshLambertMaterial>();
export function M(color: string, opts?: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  const k = color + (opts ? JSON.stringify(opts) : '');
  let m = cache.get(k); if (!m) { m = new THREE.MeshLambertMaterial({ color, ...opts }); cache.set(k, m); }
  return m;
}
type Mat = string | THREE.Material;
export function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: Mat, x: number, y: number, z: number, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m;
}
export const box = (g: THREE.Object3D, w: number, h: number, d: number, c: Mat, x: number, y: number, z: number) => add(g, new THREE.BoxGeometry(w, h, d), c, x, y, z);
export const cyl = (g: THREE.Object3D, rt: number, rb: number, h: number, c: Mat, x: number, y: number, z: number, s = 8) => add(g, new THREE.CylinderGeometry(rt, rb, h, s), c, x, y, z);
export const sph = (g: THREE.Object3D, r: number, c: Mat, x: number, y: number, z: number, ws = 10, hs = 8) => add(g, new THREE.SphereGeometry(r, ws, hs), c, x, y, z);
export function pyramid(g: THREE.Object3D, w: number, h: number, d: number, c: Mat, x: number, y: number, z: number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); geo.rotateY(Math.PI / 4); geo.translate(0, 0.5, 0);
  const m = add(g, geo, c, x, y, z); m.scale.set(w, h, d); return m;
}
export function place<T extends THREE.Object3D>(scene: THREE.Object3D, g: T, x: number, z: number, rot = 0, yOff = 0): T {
  g.position.set(x, getH(x, z) + yOff, z); g.rotation.y = rot; scene.add(g); return g;
}
export function canvasTexture(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function stripeTex(cols: string[], widths: number[], horizontal = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d')!;
  const tot = widths.reduce((a, b) => a + b, 0); let p = 0, i = 0;
  while (p < 64) { const w = (widths[i % widths.length] * 64) / tot; x.fillStyle = cols[i % cols.length]; if (horizontal) x.fillRect(0, p, 64, w + 0.5); else x.fillRect(p, 0, w + 0.5, 64); p += w; i++; }
  const t = canvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const weave = stripeTex(['#c9a96a', '#b8955a'], [1, 1]); weave.repeat.set(6, 3);
const lam = (map: THREE.Texture, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ map, ...extra });
/** Shared materials. Rignai and risa are the striped Tripuri handloom wraps. */
export const MAT = {
  rignai: lam(stripeTex(['#7d1d3f', '#1a1420', '#e9b23b', '#1a1420', '#f3ece0', '#7d1d3f'], [6, 2, 1, 2, 1, 4])),
  rignai2: lam(stripeTex(['#24336f', '#e7e0d0', '#24336f', '#c0532f', '#24336f'], [5, 1, 3, 1, 2])),
  risa: lam(stripeTex(['#c0532f', '#f6efe0', '#1f6f5c', '#f6efe0'], [3, 1, 2, 1])),
  lungi: lam(stripeTex(['#2f4f7a', '#5579a8', '#2f4f7a', '#d8d2c4'], [4, 2, 4, 1])),
  lungi2: lam(stripeTex(['#3e6b3a', '#2b4a28', '#d8d2c4'], [4, 3, 1])),
  pandal: lam(stripeTex(['#c62f2f', '#f1c232', '#c62f2f', '#f6efe0'], [3, 2, 3, 1], false), { side: THREE.DoubleSide }),
  weave: lam(weave),
  win: new THREE.MeshLambertMaterial({ color: '#39404f', emissive: '#ffcf7a', emissiveIntensity: 0 }),
  bulb: new THREE.MeshBasicMaterial({ color: '#8a8a80' }),
  fairy: ['#ff5a5a', '#ffd84a', '#6ad1ff', '#8cff7a'].map((c) => new THREE.MeshBasicMaterial({ color: c })),
  palaceLights: new THREE.MeshBasicMaterial({ color: '#ffe3a6' }),
  water: new THREE.MeshPhongMaterial({ color: '#4a8a8c', specular: '#bfe8ea', shininess: 70, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  sheetWater: new THREE.MeshPhongMaterial({ color: '#6a9aa0', specular: '#ffffff', shininess: 90, transparent: true, opacity: 0.55 }),
  city: new THREE.MeshLambertMaterial({ vertexColors: true }),
};
