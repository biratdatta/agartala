/**
 * The baked OpenStreetMap data for central Agartala (public/agartala-map.json) and the
 * spatial queries the game needs: inside a building? in water? nearest road?
 * Coordinates are metres from the origin near Ujjayanta Palace, x east and z south.
 */
import { HILLS, PLOTS, POND } from '../../shared/farm.js';
import { clamp, lerp, smooth } from '../../shared/rng.js';

export interface RawMap {
  v: number; origin: [number, number]; names: string[];
  b: number[][]; bo?: number[][]; r: number[][]; w: number[][]; l: number[][]; rv: number[][]; p: [number, number, string, number][];
  spots: Record<string, [number, number]>; attribution: string;
}
export interface Poly { xs: Float32Array; zs: Float32Array; n: number; minx: number; maxx: number; minz: number; maxz: number }
export interface Building extends Poly { lv: number }
export interface Road extends Poly { t: number; name: string; bridge: number }
export interface Land extends Poly { code: number }
export interface Place { x: number; z: number; name: string; kind: string }

export const X0 = -2100, X1 = 2100, Z0 = -2050, Z1 = 2450;
/** Carriageway widths in metres by road class: primary … path. */
export const ROAD_W = [11, 9, 7.5, 6, 5, 3.5, 2];
export const fixName = (s: string): string => s.replace(/Chowmohani/g, 'Chowmuhani');

function poly(a: number[], start: number): Poly {
  const n = (a.length - start) >> 1, xs = new Float32Array(n), zs = new Float32Array(n);
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (let i = 0; i < n; i++) {
    const x = a[start + 2 * i] * 0.5, z = a[start + 2 * i + 1] * 0.5; xs[i] = x; zs[i] = z;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (z < minz) minz = z; if (z > maxz) maxz = z;
  }
  return { xs, zs, n, minx, maxx, minz, maxz };
}

class Grid<T> {
  private m = new Map<number, T[]>();
  constructor(private c: number) {}
  private k(i: number, j: number) { return i * 65536 + j; }
  add(minx: number, minz: number, maxx: number, maxz: number, v: T) {
    const c = this.c;
    for (let i = Math.floor(minx / c); i <= Math.floor(maxx / c); i++) for (let j = Math.floor(minz / c); j <= Math.floor(maxz / c); j++) {
      const k = this.k(i, j); let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(v);
    }
  }
  q(x: number, z: number): readonly T[] { return this.m.get(this.k(Math.floor(x / this.c), Math.floor(z / this.c))) || EMPTY as T[]; }
}
const EMPTY: never[] = [];

export function pip(x: number, z: number, p: Poly): boolean {
  if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) return false;
  let ins = false; const xs = p.xs, zs = p.zs;
  for (let i = 0, j = p.n - 1; i < p.n; j = i++) if ((zs[i] > z) !== (zs[j] > z) && x < ((xs[j] - xs[i]) * (z - zs[i])) / (zs[j] - zs[i]) + xs[i]) ins = !ins;
  return ins;
}

export interface RoadHit { d: number; r: Road; s: number; px: number; pz: number }

export class CityMap {
  readonly buildings: Building[];
  readonly roads: Road[];
  readonly water: Poly[];
  readonly land: Land[];
  readonly places: Place[] = [];
  readonly chowmuhanis: Place[] = [];
  private bGrid = new Grid<number>(32);
  private wGrid = new Grid<number>(64);
  private rGrid = new Grid<number>(32);
  readonly treeGrid = new Grid<{ x: number; z: number; s: number }>(16);

  constructor(readonly raw: RawMap) {
    this.buildings = raw.b.map((a) => Object.assign(poly(a, 1), { lv: a[0] }));
    this.roads = raw.r.map((a) => Object.assign(poly(a, 3), { t: a[0], name: a[1] >= 0 ? fixName(raw.names[a[1]]) : '', bridge: a[2] }));
    this.water = raw.w.map((a) => poly(a, 0));
    this.land = raw.l.map((a) => Object.assign(poly(a, 1), { code: a[0] }));
    // the farm pukur is ours, not OSM's
    this.water.push({ xs: new Float32Array([POND.x - POND.w, POND.x + POND.w, POND.x + POND.w, POND.x - POND.w]), zs: new Float32Array([POND.z - POND.d, POND.z - POND.d, POND.z + POND.d, POND.z + POND.d]), n: 4, minx: POND.x - POND.w, maxx: POND.x + POND.w, minz: POND.z - POND.d, maxz: POND.z + POND.d });
    this.buildings.forEach((b, i) => this.bGrid.add(b.minx, b.minz, b.maxx, b.maxz, i));
    this.water.forEach((p, i) => this.wGrid.add(p.minx, p.minz, p.maxx, p.maxz, i));
    this.roads.forEach((r, ri) => {
      const w = ROAD_W[r.t] / 2 + 2;
      for (let s = 0; s < r.n - 1; s++) this.rGrid.add(Math.min(r.xs[s], r.xs[s + 1]) - w, Math.min(r.zs[s], r.zs[s + 1]) - w, Math.max(r.xs[s], r.xs[s + 1]) + w, Math.max(r.zs[s], r.zs[s + 1]) + w, ri * 4096 + s);
    });
    for (const p of raw.p) {
      const name = raw.names[p[3]]; if (!name) continue;
      const pl = { x: p[0] * 0.5, z: p[1] * 0.5, name: fixName(name), kind: p[2] };
      if (/Chowmohani/.test(name)) this.chowmuhanis.push(pl);
      if (/Chowmohani|Bus Terminus|Bazar/.test(name) || p[2] === 'suburb' || p[2] === 'neighbourhood') this.places.push(pl);
    }
  }

  inBuilding(x: number, z: number): boolean { for (const i of this.bGrid.q(x, z)) if (pip(x, z, this.buildings[i])) return true; return false; }
  nearBuilding(x: number, z: number, pad: number): boolean {
    for (const i of this.bGrid.q(x, z)) { const b = this.buildings[i]; if (x > b.minx - pad && x < b.maxx + pad && z > b.minz - pad && z < b.maxz + pad) return true; }
    return false;
  }
  inWaterPoly(x: number, z: number): boolean { for (const i of this.wGrid.q(x, z)) if (pip(x, z, this.water[i])) return true; return false; }
  roadNear(x: number, z: number, maxT = 6): RoadHit | null {
    let best: RoadHit | null = null, bd = 1e9;
    for (const v of this.rGrid.q(x, z)) {
      const r = this.roads[Math.floor(v / 4096)], s = v % 4096; if (r.t > maxT) continue;
      const ax = r.xs[s], az = r.zs[s], vx = r.xs[s + 1] - ax, vz = r.zs[s + 1] - az, L = vx * vx + vz * vz;
      const t = L ? clamp(((x - ax) * vx + (z - az) * vz) / L, 0, 1) : 0;
      const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
      if (d < bd) { bd = d; best = { d, r, s, px, pz }; }
    }
    return best;
  }
  onBridge(x: number, z: number): boolean { const n = this.roadNear(x, z); return !!n && !!n.r.bridge && n.d < ROAD_W[n.r.t] / 2 + 0.8; }
  inWater(x: number, z: number): boolean { return this.inWaterPoly(x, z) && !this.onBridge(x, z); }
  /** Direction angle of the road at a hit, for orienting things along it. */
  roadAngle(h: RoadHit): number { return Math.atan2(h.r.xs[h.s + 1] - h.r.xs[h.s], h.r.zs[h.s + 1] - h.r.zs[h.s]); }
  /** Nearest named place, and the road you are on, for the HUD. */
  placeName(x: number, z: number): string {
    let b: Place | null = null, bd = 1e9;
    for (const p of this.places) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p; } }
    const rn = this.roadNear(x, z); const road = rn && rn.d < 12 && rn.r.name ? rn.r.name + ' · ' : '';
    return road + (b ? (bd < 250 ? b.name : 'near ' + b.name) : '');
  }
}

/* ---- ground height: the city is flat; the farm has two small tillas ---- */
function hillH(x: number, z: number): number {
  let h = 0;
  for (const t of HILLS) { const d2 = ((x - t.x) ** 2 + (z - t.z) ** 2) / (t.r * t.r); if (d2 < 9) h += t.h * Math.exp(-d2 * 2.2); }
  return h;
}
const BEDS = PLOTS.filter((p) => p.kind === 'tilla').map((b) => ({ ...b, y: hillH(b.x, b.z) }));
export function getH(x: number, z: number): number {
  if (x < -920 || x > -700 || z < -1700 || z > -1560) return 0;
  let h = hillH(x, z);
  for (const b of BEDS) { const d = Math.hypot(x - b.x, z - b.z); if (d < 5.5) h = lerp(h, b.y, 1 - smooth(2.2, 5.5, d)); }
  return h;
}

export async function loadMap(url = '/agartala-map.json', onProgress?: (f: number) => void): Promise<CityMap> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load the map (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  if (!r.body || !total || !onProgress) return new CityMap((await r.json()) as RawMap);
  const reader = r.body.getReader(); const chunks: Uint8Array[] = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onProgress(Math.min(1, got / total)); }
  const all = new Uint8Array(got); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  return new CityMap(JSON.parse(new TextDecoder().decode(all)) as RawMap);
}
