/** A road graph built from the OSM streets, and shortest routes over it (A*). */
import type { CityMap } from './map/data.js';

interface Node { x: number; z: number; edges: { to: number; w: number }[] }
export interface Route { pts: [number, number][]; cum: number[]; length: number }

export class RoadGraph {
  private nodes: Node[] = [];
  private index = new Map<string, number>();
  private grid = new Map<number, number[]>();

  constructor(map: CityMap, maxType = 5) {
    const id = (x: number, z: number): number => {
      const k = `${Math.round(x * 2)},${Math.round(z * 2)}`; let i = this.index.get(k);
      if (i === undefined) { i = this.nodes.length; this.nodes.push({ x, z, edges: [] }); this.index.set(k, i); const g = this.gk(x, z); const a = this.grid.get(g); if (a) a.push(i); else this.grid.set(g, [i]); }
      return i;
    };
    for (const r of map.roads) {
      if (r.t > maxType) continue;
      // main roads are a little cheaper, so tomtoms prefer them as real drivers do
      const pref = r.t <= 1 ? 0.8 : r.t <= 3 ? 0.92 : 1;
      for (let s = 0; s < r.n - 1; s++) {
        const a = id(r.xs[s], r.zs[s]), b = id(r.xs[s + 1], r.zs[s + 1]); if (a === b) continue;
        const w = Math.hypot(r.xs[s + 1] - r.xs[s], r.zs[s + 1] - r.zs[s]) * pref;
        this.nodes[a].edges.push({ to: b, w }); this.nodes[b].edges.push({ to: a, w });
      }
    }
  }
  private gk(x: number, z: number) { return Math.floor(x / 50) * 65536 + Math.floor(z / 50); }

  nearest(x: number, z: number): number {
    let best = -1, bd = 1e18;
    for (let r = 0; r < 6 && best < 0; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      for (const n of this.grid.get(this.gk(x + i * 50, z + j * 50)) || []) { const d = (this.nodes[n].x - x) ** 2 + (this.nodes[n].z - z) ** 2; if (d < bd) { bd = d; best = n; } }
    }
    return best;
  }

  /** Shortest route between two points along the streets, starting and ending at those points. */
  route(ax: number, az: number, bx: number, bz: number): Route {
    const s = this.nearest(ax, az), t = this.nearest(bx, bz);
    const pts: [number, number][] = [[ax, az]];
    if (s >= 0 && t >= 0) {
      const g = new Float64Array(this.nodes.length).fill(Infinity), prev = new Int32Array(this.nodes.length).fill(-1), done = new Uint8Array(this.nodes.length);
      const T = this.nodes[t]; const h = (i: number) => Math.hypot(this.nodes[i].x - T.x, this.nodes[i].z - T.z) * 0.8;
      // binary heap of [f, node]
      const heap: [number, number][] = []; const push = (f: number, n: number) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = (): [number, number] => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      g[s] = 0; push(h(s), s);
      while (heap.length) {
        const [, n] = pop(); if (done[n]) continue; done[n] = 1; if (n === t) break;
        for (const e of this.nodes[n].edges) { const ng = g[n] + e.w; if (ng < g[e.to]) { g[e.to] = ng; prev[e.to] = n; push(ng + h(e.to), e.to); } }
      }
      if (prev[t] >= 0 || s === t) { const chain: number[] = []; for (let n = t; n >= 0; n = prev[n]) { chain.push(n); if (n === s) break; } chain.reverse(); for (const n of chain) pts.push([this.nodes[n].x, this.nodes[n].z]); }
    }
    pts.push([bx, bz]);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, length: cum[cum.length - 1] };
  }
}

/** Position and heading at distance `d` along a route, shifted `side` metres to the left (traffic keeps left). */
export function along(r: Route, d: number, side = 0): { x: number; z: number; ang: number } {
  d = Math.max(0, Math.min(r.length, d));
  let i = 1; while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const a = r.pts[i - 1], b = r.pts[i]; const seg = r.cum[i] - r.cum[i - 1] || 1; const t = (d - r.cum[i - 1]) / seg;
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return { x: a[0] + dx * t + (dz / l) * side, z: a[1] + dz * t - (dx / l) * side, ang: Math.atan2(dx, dz) };
}
