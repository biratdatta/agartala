/**
 * Realistic graphics (Settings → Graphics → Realistic): a physically based sky that scatters
 * sunlight like the real atmosphere (blue overhead, pale at the horizon, gold and pink at dawn and
 * dusk) with drifting clouds, the sky lighting the whole scene (image-based light), a detailed
 * ground with no visible tiling, swaying 3D grass round you, real-looking trees (leafy crowns,
 * coconut and areca palms with fronds, banana plants) that move in the wind, and glossy vehicles
 * that reflect the sky. Everything is generated in code: no image files to download.
 */
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry } from '../../shared/rng.js';
import { inFarm } from '../../shared/farm.js';
import { type CityMap, ROAD_W, getH } from '../map/data.js';
import { canvasTexture } from './kit.js';

/* ---------- noise: tileable value noise for textures ---------- */
function tileNoise(size: number, cells: number, seed: number): (x: number, y: number) => number {
  const r = mulberry(seed); const g = new Float32Array(cells * cells).map(() => r());
  const at = (i: number, j: number) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
  return (x, y) => {
    const fx = (x / size) * cells, fy = (y / size) * cells; const i = Math.floor(fx), j = Math.floor(fy); const u = fx - i, v = fy - j;
    const s = (t: number) => t * t * (3 - 2 * t); const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    return a + (b - a) * s(u) + (c - a) * s(v) + (a - b - c + d) * s(u) * s(v);
  };
}
function fbm(size: number, seed: number, base: number, octaves: number): (x: number, y: number) => number {
  const ns = Array.from({ length: octaves }, (_, k) => tileNoise(size, base * 2 ** k, seed + k * 17));
  return (x, y) => { let v = 0, a = 0.5, t = 0; for (const n of ns) { v += n(x, y) * a; t += a; a *= 0.5; } return v / t; };
}

/* ---------- ground ---------- */
/** A grass-and-earth texture (10 m a tile) and a large-scale variation map, so the ground never looks tiled. */
export function realGround(): { map: THREE.CanvasTexture; macro: THREE.CanvasTexture; detail: THREE.CanvasTexture } {
  const S = 512; const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d')!; const img = c.createImageData(S, S);
  const n1 = fbm(S, 3, 8, 4), n2 = fbm(S, 9, 32, 3), r = mulberry(21);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = n1(x, y), b = n2(x, y), dry = Math.max(0, (a - 0.58) * 3), soil = Math.max(0, (0.32 - a) * 3.5), tuft = b * 0.35 + r() * 0.12;
    let R = 92 + tuft * 60, G = 122 + tuft * 70, B = 54 + tuft * 26;                        // green grass
    R += (168 - R) * dry * 0.6; G += (156 - G) * dry * 0.55; B += (96 - B) * dry * 0.6;       // dry, yellowed patches
    R += (118 - R) * soil * 0.7; G += (96 - G) * soil * 0.7; B += (70 - B) * soil * 0.7;       // bare earth
    const k = (y * S + x) * 4; img.data[k] = R; img.data[k + 1] = G; img.data[k + 2] = B; img.data[k + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const map = canvasTexture(cv); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1200, 1200); map.anisotropy = 8;
  const M2 = 256; const mc = document.createElement('canvas'); mc.width = mc.height = M2; const m = mc.getContext('2d')!; const mi = m.createImageData(M2, M2); const nm = fbm(M2, 5, 4, 4);
  for (let y = 0; y < M2; y++) for (let x = 0; x < M2; x++) { const v = nm(x, y) * 255, k = (y * M2 + x) * 4; mi.data[k] = mi.data[k + 1] = mi.data[k + 2] = v; mi.data[k + 3] = 255; }
  m.putImageData(mi, 0, 0); const macro = new THREE.CanvasTexture(mc); macro.wrapS = macro.wrapT = THREE.RepeatWrapping;
  // a near-white detail texture to multiply over coloured areas (parks, tillas)
  const dc = document.createElement('canvas'); dc.width = dc.height = 256; const d = dc.getContext('2d')!; const di = d.createImageData(256, 256); const nd = fbm(256, 13, 16, 3);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const v = 200 + nd(x, y) * 55 + (r() - 0.5) * 20, k = (y * 256 + x) * 4; di.data[k] = v * 0.97; di.data[k + 1] = v; di.data[k + 2] = v * 0.9; di.data[k + 3] = 255; }
  d.putImageData(di, 0, 0); const detail = canvasTexture(dc); detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.anisotropy = 8;
  return { map, macro, detail };
}
/** Breaks up tiling: darkens and lightens the ground over a few hundred metres using the macro map. */
export function macroVariation(mat: THREE.Material, macro: THREE.Texture, scale: number): void {
  mat.customProgramCacheKey = () => `macro:${scale}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMacro = { value: macro };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMacro;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.rgb *= mix(0.8, 1.16, texture2D(uMacro, vMapUv * ${scale.toFixed(5)}).r);`);
  };
}

/* ---------- sky, clouds and the light the sky gives ---------- */
/** Cloud noise, drawn in the sky shader itself: cumulus on a layer above the city, lit by the sun. */
const CLOUD_GLSL = /* glsl */ `
uniform float skyGain; uniform float skyNight; uniform float cloudCover; uniform vec2 cloudWind;
uniform vec3 cloudSun; uniform vec3 cloudAmb; uniform vec3 horizonCol; uniform float horizonAmt;
float cHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), u.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), u.x), u.y); }
float cFbm(vec2 p) { float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 6; i++) { v += a * cNoise(p); p = m * p; a *= 0.5; } return v; }
float cDens(vec2 p) { float n = cFbm(p + 0.6 * vec2(cFbm(p * 0.45 + 3.1), cFbm(p * 0.45 - 1.7)) ); float lo = 1.0 - cloudCover; return smoothstep(lo, lo + 0.16, n); }
`;
const CLOUD_MAIN = /* glsl */ `
  vec3 col = mix(vec3(dot(retColor, vec3(0.2126, 0.7152, 0.0722))), retColor, 1.6) * skyGain;
  col += vec3(0.006, 0.011, 0.03) * skyNight;
  #ifdef CLOUDS
  if (direction.y > 0.0) {
    vec2 cp = direction.xz / (direction.y + 0.08) * 1.0 + cloudWind;
    float c = cDens(cp);
    if (c > 0.002) {
      float c2 = cDens(cp + vSunDirection.xz * 0.14);
      float lit = clamp(0.78 + (c - c2) * 3.0, 0.12, 1.0);
      float thick = smoothstep(0.1, 1.0, c);
      vec3 cc = mix(cloudAmb, cloudSun, lit) * mix(1.0, 0.78, thick);
      cc += cloudSun * pow(max(cosTheta, 0.0), 10.0) * (1.0 - thick) * 0.9; // bright edges near the sun
      col = mix(col, cc, clamp(c * 1.5, 0.0, 1.0) * smoothstep(0.0, 0.16, direction.y));
    }
  }
  #endif
  gl_FragColor = vec4(col, 1.0);
`;
const HORIZON = /* glsl */ `#include <colorspace_fragment>
  // the far haze: the sky meets the fog exactly, so the city fades into the horizon instead of ending
  gl_FragColor.rgb = mix(gl_FragColor.rgb, horizonCol, (1.0 - smoothstep(-0.03, 0.13, direction.y)) * horizonAmt);`;

export class RealSky {
  readonly sky = new Sky();
  private pmrem: THREE.PMREMGenerator; private envScene = new THREE.Scene(); private envSky = new Sky(); private envRT: THREE.WebGLRenderTarget | null = null;
  private lastSun = new THREE.Vector3(9, 9, 9); private lastEnvAt = -1e9; readonly sunDir = new THREE.Vector3(0, 1, 0);
  private U = {
    skyGain: { value: 0.3 }, skyNight: { value: 0 }, cloudCover: { value: 0.42 }, cloudWind: { value: new THREE.Vector2() },
    cloudSun: { value: new THREE.Color(1, 1, 1) }, cloudAmb: { value: new THREE.Color(0.5, 0.55, 0.62) }, horizonCol: { value: new THREE.Color() }, horizonAmt: { value: 1 },
  };
  private tmp = new THREE.Color();

  constructor(private scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms; u.turbidity.value = 2.5; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.82;
      Object.assign(u, this.U);
      // the film-style tone mapping greys bright blues, so the sky gets its saturation back; then the clouds and the haze
      s.material.fragmentShader = s.material.fragmentShader.replace('uniform vec3 up;', 'uniform vec3 up;\n' + CLOUD_GLSL)
        .replace('gl_FragColor = vec4( retColor, 1.0 );', CLOUD_MAIN);
    }
    this.sky.material.defines = { CLOUDS: 1 };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader.replace('#include <colorspace_fragment>', HORIZON);
    this.sky.scale.setScalar(1500); this.sky.frustumCulled = false; scene.add(this.sky);
    this.envSky.scale.setScalar(100); this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /** hour 0..24, night 0..1, rain, where the player is (the sky follows), seconds, and the fog colour to meet at the horizon. */
  update(hour: number, night: number, rain: boolean, at: THREE.Vector3, t: number, fog: THREE.Color): void {
    const ang = ((hour - 6) / 12) * Math.PI; this.sunDir.set(Math.cos(ang), Math.sin(ang), 0.45).normalize();
    for (const s of [this.sky, this.envSky]) { const u = s.material.uniforms; u.sunPosition.value.copy(this.sunDir); u.turbidity.value = rain ? 12 : 2.5; u.rayleigh.value = rain ? 0.7 : 1.6 + night * 1.5; }
    const U = this.U; const day = 1 - night;
    U.skyGain.value = (rain ? 0.2 : 0.3) * (1 - night * 0.65); U.skyNight.value = night;
    const dusk = (1 - THREE.MathUtils.smoothstep(this.sunDir.y, 0.0, 0.35)) * day;
    U.cloudCover.value = rain ? 0.97 : 0.48 + 0.08 * Math.sin(t * 0.004);
    U.cloudWind.value.set(t * 0.0045, t * 0.0018);
    U.cloudSun.value.setRGB(1.45, 1.42, 1.35).lerp(this.tmp.setRGB(1.35, 0.72, 0.42), dusk).multiplyScalar((rain ? 0.55 : 1) * (0.07 + 0.93 * day));
    U.cloudAmb.value.setRGB(0.52, 0.58, 0.68).lerp(this.tmp.setRGB(0.42, 0.34, 0.4), dusk * 0.8);
    if (rain) U.cloudAmb.value.lerp(this.tmp.setRGB(0.4, 0.42, 0.45), 0.8);
    U.cloudAmb.value.lerp(this.tmp.setRGB(0.018, 0.022, 0.04), night);
    fog.getRGB(U.horizonCol.value as unknown as THREE.RGB, THREE.SRGBColorSpace);
    this.sky.position.copy(at);
    // re-light the scene from the sky when the sun has moved enough (or every 12 s)
    if (this.sunDir.distanceTo(this.lastSun) > 0.03 || t - this.lastEnvAt > 12) {
      this.lastSun.copy(this.sunDir); this.lastEnvAt = t;
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200); this.scene.environment = rt.texture; this.envRT?.dispose(); this.envRT = rt;
    }
  }
}

/* ---------- grass: swaying tufts round the player ---------- */
function bladeTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const c = cv.getContext('2d')!; const r = mulberry(8);
  for (let i = 0; i < 26; i++) {
    const x = 6 + r() * 116, h = 70 + r() * 56, lean = (r() - 0.5) * 30, w = 3 + r() * 3;
    const g = c.createLinearGradient(0, 128, 0, 128 - h); g.addColorStop(0, '#2f4a1c'); g.addColorStop(0.55, ['#5f8a33', '#6d9a3a', '#7aa640'][i % 3]); g.addColorStop(1, '#b7c46a');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - w, 128); c.quadraticCurveTo(x + lean * 0.4, 128 - h * 0.6, x + lean, 128 - h); c.quadraticCurveTo(x + lean * 0.4 + w * 0.5, 128 - h * 0.6, x + w, 128); c.fill();
  }
  const t = canvasTexture(cv); t.anisotropy = 4; return t;
}
/** Shared wind clock for grass and leaves. */
export const WIND = { value: 0 };
function windy(mat: THREE.Material, amount: number, heightVar: 'uv' | 'y', top = 1): void {
  mat.customProgramCacheKey = () => `wind:${amount}:${heightVar}:${top}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float sway = ${heightVar === 'uv' ? 'uv.y' : `clamp(position.y / ${top.toFixed(2)}, 0.0, 1.0)`};
      #ifdef USE_INSTANCING
        vec4 wp = instanceMatrix * vec4(position, 1.0);
      #else
        vec4 wp = vec4(position, 1.0);
      #endif
      transformed.x += sin(uWind * 1.7 + wp.x * 0.31 + wp.z * 0.17) * ${amount.toFixed(3)} * sway;
      transformed.z += cos(uWind * 1.3 + wp.z * 0.27) * ${(amount * 0.6).toFixed(3)} * sway;`);
  };
}
export class Grass {
  private mesh: THREE.InstancedMesh; private cells = new Map<string, THREE.Matrix4[]>(); private at = '';
  private static CELL = 12; private static PER = 240; private static R = 4;
  constructor(scene: THREE.Scene, private map: CityMap) {
    const quad = (a: number) => { const g = new THREE.PlaneGeometry(0.9, 0.55); g.translate(0, 0.27, 0); g.rotateY(a); return g; };
    const geo = mergeGeometries([quad(0), quad(Math.PI / 3), quad((2 * Math.PI) / 3)])!;
    const nor = geo.attributes.normal as THREE.BufferAttribute; for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0); // lit like the ground
    const mat = new THREE.MeshStandardMaterial({ map: bladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
    windy(mat, 0.09, 'uv');
    const max = (2 * Grass.R + 1) ** 2 * Grass.PER; this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    const c = new THREE.Color(); for (let i = 0; i < max; i++) this.mesh.setColorAt(i, c.setHSL(0.24 + (i % 7) * 0.008, 0.45, 0.82 + (i % 5) * 0.04));
    scene.add(this.mesh);
  }
  private cell(i: number, j: number): THREE.Matrix4[] {
    const k = `${i},${j}`; let list = this.cells.get(k); if (list) return list;
    list = []; const r = mulberry((i * 73856093) ^ (j * 19349663)); const d = new THREE.Object3D();
    for (let n = 0; n < Grass.PER; n++) {
      const x = (i + r()) * Grass.CELL, z = (j + r()) * Grass.CELL;
      if (this.map.inBuilding(x, z) || this.map.inWaterPoly(x, z) || inFarm(x, z)) continue;
      const rn = this.map.roadNear(x, z); if (rn && rn.d < ROAD_W[rn.r.t] / 2 + 0.7) continue;
      d.position.set(x, getH(x, z), z); d.rotation.set(0, r() * 6.28, 0); const s = 0.7 + r() * 0.7; d.scale.set(s, s * (0.8 + r() * 0.5), s); d.updateMatrix(); list.push(d.matrix.clone());
    }
    if (this.cells.size > 600) this.cells.clear(); this.cells.set(k, list); return list;
  }
  update(px: number, pz: number): void {
    const ci = Math.floor(px / Grass.CELL), cj = Math.floor(pz / Grass.CELL), key = `${ci},${cj}`; if (key === this.at) return; this.at = key;
    let n = 0;
    for (let i = ci - Grass.R; i <= ci + Grass.R; i++) for (let j = cj - Grass.R; j <= cj + Grass.R; j++) for (const m of this.cell(i, j)) this.mesh.setMatrixAt(n++, m);
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- trees ---------- */
function leafCluster(seed: number, tones: string[]): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d')!; const r = mulberry(seed);
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 112, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.9;
    c.save(); c.translate(x, y); c.rotate(r() * Math.PI * 2); c.fillStyle = tones[Math.floor(r() * tones.length)];
    c.beginPath(); c.ellipse(0, 0, 9 + r() * 6, 4 + r() * 2.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke(); c.restore();
  }
  return canvasTexture(cv);
}
function frondTexture(seed: number, banana = false): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512; const c = cv.getContext('2d')!; const r = mulberry(seed);
  if (banana) {
    const g = c.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#4f8a2a'); g.addColorStop(0.5, '#79b23e'); g.addColorStop(1, '#4f8a2a');
    c.fillStyle = g; c.beginPath(); c.moveTo(64, 0); c.quadraticCurveTo(128, 120, 118, 300); c.quadraticCurveTo(104, 470, 64, 512); c.quadraticCurveTo(24, 470, 10, 300); c.quadraticCurveTo(0, 120, 64, 0); c.fill();
    c.strokeStyle = '#c9d98a'; c.lineWidth = 4; c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 512); c.stroke();
    c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 9; i++) { const y = 60 + r() * 420, s = r() < 0.5 ? 0 : 128; c.beginPath(); c.moveTo(s, y); c.lineTo(64, y + 6); c.lineTo(s, y + 4); c.fill(); }   // wind-torn edges
  } else {
    c.strokeStyle = '#8a7a3a'; c.lineWidth = 5; c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 512); c.stroke();
    for (let y = 8; y < 500; y += 9) for (const s of [-1, 1]) {
      const len = 58 * Math.sin((y / 512) * Math.PI) + 10; c.strokeStyle = ['#3f6b22', '#4f7f2a', '#5d8f30'][Math.floor(r() * 3)]; c.lineWidth = 4;
      c.beginPath(); c.moveTo(64, y); c.quadraticCurveTo(64 + s * len * 0.5, y + 10, 64 + s * len, y + 26); c.stroke();
    }
  }
  return canvasTexture(cv);
}
/** A drooping strip (a palm frond or banana leaf) from the crown outwards, as one geometry. */
function frond(len: number, wid: number, droop: number, lift: number, yaw: number, y0: number): THREE.BufferGeometry {
  const seg = 7; const g = new THREE.PlaneGeometry(wid, len, 1, seg); const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + len / 2) / len; const x = p.getX(i); p.setXYZ(i, x * (1 - t * 0.35), y0 + t * len * lift - droop * t * t, t * len); }
  g.computeVertexNormals(); g.rotateY(yaw); return g;
}
function crownCards(n: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, size: number, seed: number): THREE.BufferGeometry {
  const r = mulberry(seed); const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u); const dir = new THREE.Vector3(Math.cos(a) * s, u * 0.85 + 0.15, Math.sin(a) * s).normalize();
    const g = new THREE.PlaneGeometry(size * (0.8 + r() * 0.5), size * (0.8 + r() * 0.5));
    g.rotateZ(r() * 6.28); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    const at = new THREE.Vector3(cx + dir.x * rx * 0.75, cy + dir.y * ry * 0.75, cz + dir.z * rz * 0.75); g.translate(at.x, at.y, at.z);
    const nor = g.attributes.normal as THREE.BufferAttribute; for (let k = 0; k < nor.count; k++) nor.setXYZ(k, dir.x, dir.y, dir.z); // round, soft lighting like a real crown
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}
export interface TreeLists { broad: { x: number; z: number; s: number; ry: number }[]; areca: TreeLists['broad']; banana: TreeLists['broad']; coco: TreeLists['broad'] }
/** Builds every tree from its list: trunks and leaves as instanced meshes, the leaves swaying. */
export function realTrees(scene: THREE.Scene, lists: TreeLists): void {
  const d = new THREE.Object3D(); const tint = new THREE.Color();
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: TreeLists['broad'], colour?: (i: number) => THREE.Color) => {
    if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => { d.position.set(t.x, getH(t.x, t.z) - 0.05, t.z); d.rotation.set(0, t.ry, 0); d.scale.setScalar(t.s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); if (colour) m.setColorAt(i, colour(i)); });
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
  };
  const bark = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  const leaves = (tex: THREE.Texture, top: number, amount = 0.12) => { const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.78 }); windy(m, amount, 'y', top); return m; };
  // broad trees (mango, jackfruit, rain trees): a trunk with two limbs, and a crown of leafy clusters
  const trunk = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.26, 0.42, 3.8, 8); g.translate(0, 1.9, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.1, 0.18, 2.2, 6); g.rotateZ(0.7); g.translate(0.7, 3.8, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.1, 0.16, 2.0, 6); g.rotateZ(-0.6); g.rotateY(2.2); g.translate(-0.5, 3.7, 0.3); return g; })(),
  ])!;
  const half = Math.ceil(lists.broad.length / 2);
  const tones = ['#2f5a24', '#3d6b2a', '#4a7a30', '#5b8a36', '#2a4f22'];
  inst(trunk, bark('#5b4632'), lists.broad);
  inst(crownCards(24, 0, 5.3, 0, 3.3, 2.3, 3.3, 2.4, 11), leaves(leafCluster(3, tones), 8), lists.broad.slice(0, half), (i) => tint.setHSL(0.27 + (i % 5) * 0.012, 0.35, 0.78 + (i % 4) * 0.05));
  inst(crownCards(26, 0, 5.6, 0, 4.2, 1.8, 4.2, 2.6, 23), leaves(leafCluster(7, ['#2b5420', '#3a6726', '#4c7a2e', '#6a9440']), 8), lists.broad.slice(half), (i) => tint.setHSL(0.25 + (i % 5) * 0.012, 0.35, 0.78 + (i % 4) * 0.05));
  // coconut palms: a leaning, slightly curved trunk, a crown of long drooping fronds and coconuts
  const cocoTrunk = mergeGeometries(Array.from({ length: 6 }, (_, k) => { const g = new THREE.CylinderGeometry(0.17 - k * 0.006, 0.2 - k * 0.006, 1.9, 7); g.translate(Math.sin(k * 0.25) * 0.5 * (k / 6), 0.95 + k * 1.85, 0); return g; }))!;
  const cx = Math.sin(1.5) * 0.5, top = 11.2;
  const cocoFronds = mergeGeometries(Array.from({ length: 12 }, (_, k) => { const g = frond(4.6, 1.2, 2.6 + (k % 3) * 0.4, 0.35, (k / 12) * Math.PI * 2 + (k % 2) * 0.2, 0); g.translate(cx, top, 0); return g; }))!;
  inst(cocoTrunk, bark('#7a6a52'), lists.coco);
  inst(cocoFronds, leaves(frondTexture(5), top + 1, 0.18), lists.coco);
  const nuts = mergeGeometries(Array.from({ length: 5 }, (_, k) => { const g = new THREE.SphereGeometry(0.17, 8, 6); g.translate(cx + Math.cos(k * 1.3) * 0.32, top - 0.25, Math.sin(k * 1.3) * 0.32); return g; }))!;
  inst(nuts, new THREE.MeshStandardMaterial({ color: '#6a7a2a', roughness: 0.7 }), lists.coco);
  // areca (supari) palms: tall, thin and straight, with a small tuft of fronds
  const areca = (() => { const g = new THREE.CylinderGeometry(0.09, 0.13, 10.5, 7); g.translate(0, 5.25, 0); return g; })();
  inst(areca, bark('#9a927e'), lists.areca);
  inst(mergeGeometries(Array.from({ length: 8 }, (_, k) => { const g = frond(2.8, 0.8, 1.5, 0.5, (k / 8) * Math.PI * 2, 0); g.translate(0, 10.4, 0); return g; }))!, leaves(frondTexture(9), 11.5, 0.14), lists.areca);
  // banana plants: a short pseudo-stem and broad, torn leaves
  const stem = (() => { const g = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8); g.translate(0, 1.1, 0); return g; })();
  inst(stem, bark('#7d8a4a'), lists.banana);
  inst(mergeGeometries(Array.from({ length: 7 }, (_, k) => { const g = frond(2.3, 0.75, 0.9, 0.85, (k / 7) * Math.PI * 2 + 0.3, 0); g.translate(0, 2.0, 0); return g; }))!, leaves(frondTexture(13, true), 4.5, 0.1), lists.banana);
}

/* ---------- vehicles: glossy paint, tinted glass, matte rubber ---------- */
const gloss = new Map<string, THREE.MeshStandardMaterial>();
/** Swaps a vehicle model's materials for paint, glass and rubber that reflect the sky. */
export function glossify(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return; const src = m.material as THREE.MeshStandardMaterial; if (!src?.color || src.map || src.transparent || (src.emissive && src.emissive.getHex() !== 0)) return;
    const hex = src.color.getHexString(); let mat = gloss.get(hex);
    if (!mat) {
      const c = src.color; const lum = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; const glass = c.b > c.r * 1.12 && lum < 0.75 && lum > 0.12;
      mat = new THREE.MeshStandardMaterial({ color: c.clone(), roughness: lum < 0.1 ? 0.85 : glass ? 0.06 : 0.3, metalness: lum < 0.1 ? 0 : glass ? 0.65 : 0.35, envMapIntensity: glass ? 1.6 : 1.1 });
      gloss.set(hex, mat);
    }
    m.material = mat;
  });
}
