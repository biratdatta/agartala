#!/usr/bin/env node
/**
 * Turns data/raw/agartala-osm.json into the game's map:
 *   public/agartala-map.json   buildings, roads, water, parks and named places round MBB Stadium, coordinates × 2 as integers
 *   src/shared/spots.ts        free spots beside real roads for the bazar stall, bus, pandal and tomtom stands
 * Ujjayanta Palace keeps its real footprint; the game dresses it with domes and a garden (realplaces.ts).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const o = JSON.parse(await readFile(path.resolve('data/raw/agartala-osm.json'), 'utf8'));
const N = o.names;
const pts = (c) => { const p = []; for (let i = 0; i < c.length; i += 2) p.push([c[i], c[i + 1]]); return p; };
const pip = (x, z, p) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
const segd = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz; const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L)); return Math.hypot(px - ax - vx * t, pz - az - vz * t); };

const RT = { primary: 0, primary_link: 0, trunk: 0, secondary: 1, secondary_link: 1, tertiary: 2, tertiary_link: 2, unclassified: 3, residential: 4, living_street: 4, service: 5 };
const WID = [11, 9, 7.5, 6, 5, 3.5, 2];
const roads = o.roads.map((r) => ({ t: RT[r[0]] ?? 6, name: r[1], bridge: r[2], p: pts(r[3]) }));
const blds = o.bld.map((b) => ({ lv: b[0], name: b[2], p: pts(b[4]) }));
const waters = o.water.map((w) => pts(w[1]));

const G = 40, key = (i, j) => i * 100003 + j;
const bgrid = new Map(), rgrid = new Map();
const push = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(v); };
blds.forEach((b, i) => { const xs = b.p.map((q) => q[0]), zs = b.p.map((q) => q[1]); for (let gx = Math.floor(Math.min(...xs) / G); gx <= Math.floor(Math.max(...xs) / G); gx++) for (let gz = Math.floor(Math.min(...zs) / G); gz <= Math.floor(Math.max(...zs) / G); gz++) push(bgrid, key(gx, gz), i); });
roads.forEach((r, i) => { for (let k = 0; k < r.p.length - 1; k++) { const [ax, az] = r.p[k], [bx, bz] = r.p[k + 1]; for (let gx = Math.floor(Math.min(ax, bx) / G) - 1; gx <= Math.floor(Math.max(ax, bx) / G) + 1; gx++) for (let gz = Math.floor(Math.min(az, bz) / G) - 1; gz <= Math.floor(Math.max(az, bz) / G) + 1; gz++) push(rgrid, key(gx, gz), [i, k]); } });
function roadDist(x, z, maxType = 6) {
  let best = [1e9, null];
  for (const [i, k] of rgrid.get(key(Math.floor(x / G), Math.floor(z / G))) || []) { const r = roads[i]; if (r.t > maxType) continue; const d = segd(x, z, ...r.p[k], ...r.p[k + 1]); if (d < best[0]) best = [d, i]; }
  return best;
}
function bldNear(x, z, rad) {
  const out = new Set();
  for (let gx = Math.floor((x - rad) / G); gx <= Math.floor((x + rad) / G); gx++) for (let gz = Math.floor((z - rad) / G); gz <= Math.floor((z + rad) / G); gz++) for (const i of bgrid.get(key(gx, gz)) || []) {
    const p = blds[i].p; const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cz = p.reduce((a, q) => a + q[1], 0) / p.length;
    if (Math.hypot(cx - x, cz - z) < rad || pip(x, z, p)) out.add(i);
  }
  return out;
}
const inWater = (x, z) => waters.some((p) => pip(x, z, p));

/** Spirals out from a target to the first point beside a road, clear of buildings and water. */
function freeSpot(tx, tz, { clear = 6, rmin = 1.5, rmax = 14, search = 90, maxType = 5 } = {}) {
  for (let rr = 0; rr < search; rr += 2) for (let k = 0; k < Math.max(1, rr * 2); k++) {
    const a = (k / Math.max(1, rr * 2)) * 2 * Math.PI, x = tx + Math.cos(a) * rr, z = tz + Math.sin(a) * rr;
    const [d, ri] = roadDist(x, z, maxType); if (ri === null) continue;
    const hw = WID[roads[ri].t] / 2; if (d < hw + rmin || d > hw + rmax) continue;
    if (bldNear(x, z, clear).size || inWater(x, z)) continue;
    return [Math.round(x * 10) / 10, Math.round(z * 10) / 10];
  }
  return null;
}
/* The play area: the paras round Maharaja Bir Bikram Stadium (Shibnagar, Math Chowmuhani, Ramnagar,
 * Joynagar) and the Haora river bank, where the family fields are. Same origin as before (near
 * Ujjayanta Palace), so x east and z south in metres. */
const AREA = { x0: -950, x1: 2400, z0: -180, z1: 2000 };
/** The family fields: open land between the stadium buildings and the river. OSM footprints inside are left out. */
const FARM_ZONE = [[1566, 1122], [1846, 1122], [1745, 1258], [1695, 1302], [1590, 1302], [1562, 1262]];
const TARGETS = {
  gopal: [870, 640, { clear: 5 }], busTerminus: [1330, 470, { clear: 5 }], pandal: [960, 975, { clear: 9, rmax: 40 }],
  stStadium: [1440, 862], stShibnagar: [880, 1080], stMath: [845, 625], stRamnagar: [1000, 1330], stJoynagar: [1250, 500], stBridge: [1450, 1600],
  stHome: [1563, 1205, { clear: 3, maxType: 6 }],
  // the old town west of the stadium paras: the palace gate, Motor Stand (PRM Centrepoint) and Paradise Chowmuhani (City Centre)
  stPalace: [30, 40], stMotor: [-13, 727], stParadise: [-740, 876],
  // neighbours who ask for help (daily kaam), each beside a lane in one of the paras
  nShiva: [910, 1060, { clear: 4 }], nRadhanagar: [760, 650, { clear: 4 }], nKrishnanagar: [1150, 560, { clear: 4 }],
  nSupari: [1050, 760, { clear: 4 }], nKadamtali: [900, 1420, { clear: 4 }], nMelarmath: [1150, 1380, { clear: 4 }],
  nKalibari: [1620, 820, { clear: 4 }], nMaharajganj: [1500, 1560, { clear: 4 }], nAbhoynagar: [1650, 420, { clear: 4 }], nBhati: [1560, 1330, { clear: 4 }],
};
const spots = {};
for (const [k, [x, z, opt]] of Object.entries(TARGETS)) { spots[k] = freeSpot(x, z, opt); console.log(`${k.padEnd(14)} → ${JSON.stringify(spots[k])}`); if (!spots[k]) throw new Error(`No free spot for ${k}`); }

const centre = (p) => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
const skip = new Set([...blds.flatMap((b, i) => (pip(...centre(b.p), FARM_ZONE) || !(centre(b.p)[0] > AREA.x0 && centre(b.p)[0] < AREA.x1 && centre(b.p)[1] > AREA.z0 && centre(b.p)[1] < AREA.z1) ? [i] : [])), ...bldNear(spots.pandal[0], spots.pandal[1], 10)]);
/* Some OSM footprints sit right across a street or bite into it (gates, overhangs, mapping slips).
 * Tomtoms and walkers follow the street, so drop any footprint that reaches into the carriageway:
 * sampled along the centre line and along both edges of the drawn road. */
let acrossRoad = 0;
// landmark buildings (named in OSM, or a real place the game puts on an unnamed one) always stay
const KEEP = [[22, 768]]; // PRM Centrepoint, Motor Stand (src/shared/places.ts)
blds.forEach((b, i) => {
  if (skip.has(i) || b.name >= 0 || KEEP.some(([x, z]) => pip(x, z, b.p))) return;
  const xs = b.p.map((q) => q[0]), zs = b.p.map((q) => q[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  let inside = 0; const seen = new Set();
  for (let gx = Math.floor(x0 / G); gx <= Math.floor(x1 / G); gx++) for (let gz = Math.floor(z0 / G); gz <= Math.floor(z1 / G); gz++) for (const [ri, k] of rgrid.get(key(gx, gz)) || []) {
    const sk = ri * 100000 + k; if (seen.has(sk) || roads[ri].t > 5) continue; seen.add(sk);
    const [ax, az] = roads[ri].p[k], [bx, bz] = roads[ri].p[k + 1]; const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1); const edge = Math.max(0, WID[roads[ri].t] / 2 - 1.6);
    for (let t = 0; t <= L; t += 1) for (const o of [0, edge, -edge]) {
      const x = ax + ux * t + uz * o, z = az + uz * t - ux * o; if (x > x0 && x < x1 && z > z0 && z < z1 && pip(x, z, b.p)) inside++;
    }
  }
  if (inside >= 4) { skip.add(i); acrossRoad++; }
});
console.log(`Dropped ${acrossRoad} footprints that sit across a road.`);
const enc = (p) => p.flatMap(([x, z]) => [Math.round(x * 2), Math.round(z * 2)]);
const open = (p) => (p.length > 2 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1] ? p.slice(0, -1) : p);
/** Smallest-area rectangle around a footprint (rotating calipers on the convex hull). */
function hull(p) {
  const q = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const v of q) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), v) <= 0) lo.pop(); lo.push(v); }
  for (const v of q.reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), v) <= 0) up.pop(); up.push(v); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function obb(p) {
  const h = hull(p); let best = null;
  for (let i = 0; i < h.length; i++) {
    const [ax, az] = h[i], [bx, bz] = h[(i + 1) % h.length]; const L = Math.hypot(bx - ax, bz - az); if (L < 1e-6) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const [x, z] of h) { const a = x * ux + z * uz, b = -x * uz + z * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) { const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2; best = { area, ux, uz, la: a1 - a0, lb: b1 - b0, cx: ca * ux - cb * uz, cz: ca * uz + cb * ux }; }
  }
  return best;
}
function nearestRoadPoint(x, z) {
  let best = null;
  for (let r = 0; r <= 2 && !best; r++) for (let gx = Math.floor(x / G) - r; gx <= Math.floor(x / G) + r; gx++) for (let gz = Math.floor(z / G) - r; gz <= Math.floor(z / G) + r; gz++) for (const [i, k] of rgrid.get(key(gx, gz)) || []) {
    const rd = roads[i]; if (rd.t > 5) continue; const [ax, az] = rd.p[k], [bx, bz] = rd.p[k + 1]; const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
    const t = L2 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)) : 0; const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) best = { d, px, pz, t: rd.t };
  }
  return best;
}
const B = [], BO = [];
blds.forEach((b, i) => {
  if (skip.has(i)) return; const p = open(b.p); if (p.length < 3) return;
  B.push([Math.trunc(b.lv) || 0, ...enc(p)]);
  const o = obb(p); const rp = nearestRoadPoint(o.cx, o.cz);
  // the front is the rectangle side that faces the nearest road
  let fx = o.uz * -1, fz = o.ux, w = o.la, d = o.lb; // default: front along the short axis normal
  if (rp) {
    const rx = rp.px - o.cx, rz = rp.pz - o.cz; const da = rx * o.ux + rz * o.uz, db = -rx * o.uz + rz * o.ux;
    if (Math.abs(da) > Math.abs(db)) { const s = Math.sign(da) || 1; fx = o.ux * s; fz = o.uz * s; w = o.lb; d = o.la; }
    else { const s = Math.sign(db) || 1; fx = -o.uz * s; fz = o.ux * s; w = o.la; d = o.lb; }
  }
  BO.push([Math.round(o.cx * 2), Math.round(o.cz * 2), Math.round(w * 2), Math.round(d * 2), Math.round(Math.atan2(fx, fz) * 1000), rp ? rp.t : 9, rp ? Math.min(255, Math.round(rp.d)) : 255]);
});
const inArea = (p) => p.some(([x, z]) => x > AREA.x0 - 50 && x < AREA.x1 + 50 && z > AREA.z0 - 50 && z < AREA.z1 + 50);
const R = roads.filter((r) => inArea(r.p)).map((r) => [r.t, r.name, r.bridge, ...enc(r.p)]);
const W = waters.map(open).filter((p) => p.length >= 3).map(enc);
const LC = { park: 0, grass: 0, recreation_ground: 0, pitch: 0, playground: 0, stadium: 0, greenfield: 0, dog_park: 0, sports_centre: 0, farmland: 1, wood: 2, forest: 2, wetland: 3, sand: 4 };
const L = o.land.filter((l) => l[0] in LC).map((l) => [LC[l[0]], open(pts(l[2]))]).filter(([, p]) => p.length >= 3).map(([c, p]) => [c, ...enc(p)]);
const RV = o.river.filter((r) => r[0] === 'river' || r[0] === 'stream').map((r) => enc(pts(r[2])));
const Pp = o.poi.map((p) => [Math.trunc(p[0] * 2), Math.trunc(p[1] * 2), p[2], p[3]]);

/* ---------------- infill: houses where OSM has none yet ----------------
 * OpenStreetMap is missing many of Agartala's houses, especially in the newer paras.
 * We mark everything that must stay open (roads, water, parks, fields, existing buildings,
 * landmarks) on a 2 m grid, then walk the lanes placing modest houses on free plots,
 * a front row facing the lane and sometimes a second row behind. Seeded, so it never changes. */
const IX0 = AREA.x0, IZ0 = AREA.z0, CELL = 2, NX = Math.ceil((AREA.x1 - AREA.x0) / CELL), NZ = Math.ceil((AREA.z1 - AREA.z0) / CELL);
const occ = new Uint8Array(NX * NZ);
const cellOf = (x, z) => { const i = Math.floor((x - IX0) / CELL), j = Math.floor((z - IZ0) / CELL); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
const markPoly = (p, pad = 0) => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let z = z0 - pad; z <= z1 + pad; z += CELL) for (let x = x0 - pad; x <= x1 + pad; x += CELL) {
    if (pip(x, z, p) || (pad > 0 && (pip(x + pad, z, p) || pip(x - pad, z, p) || pip(x, z + pad, p) || pip(x, z - pad, p)))) { const c = cellOf(x, z); if (c >= 0) occ[c] = 1; }
  }
};
for (const b of blds) markPoly(b.p, 1.5);
for (const w of waters) markPoly(w, 0);
for (const l of o.land) if (l[0] in { park: 1, grass: 1, recreation_ground: 1, pitch: 1, playground: 1, stadium: 1, farmland: 1, wood: 1, forest: 1, wetland: 1, sand: 1, cemetery: 1, greenfield: 1 }) markPoly(open(pts(l[2])), 0);
for (const r of roads) {
  const hw = WID[r.t] / 2 + 1.2;
  for (let k = 0; k < r.p.length - 1; k++) {
    const [ax, az] = r.p[k], [bx, bz] = r.p[k + 1]; const L = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= L; t += 1) { const x = ax + ((bx - ax) * t) / L, z = az + ((bz - az) * t) / L; for (let dz = -hw; dz <= hw; dz += 1) for (let dx = -hw; dx <= hw; dx += 1) { if (dx * dx + dz * dz > hw * hw) continue; const c = cellOf(x + dx, z + dz); if (c >= 0) occ[c] = 1; } }
  }
}
markPoly(FARM_ZONE.map(([x, z]) => [x, z]), 6);
// the MBB College campus (src/shared/places.ts CAMPUS): only its real buildings, no invented houses
markPoly([[1520, 975], [1725, 975], [1725, 1118], [1520, 1118]], 0);
// Ujjayanta Palace's grounds: lawns, pools and fountains in front of the palace, no invented houses
markPoly([[-70, -110], [135, -110], [135, 70], [-70, 70]], 0);
const keepOpen = [...Object.values(spots).map(([x, z]) => [x, z, 14])];
for (const [x, z, r] of keepOpen) for (let dz = -r; dz <= r; dz += CELL) for (let dx = -r; dx <= r; dx += CELL) if (dx * dx + dz * dz <= r * r) { const c = cellOf(x + dx, z + dz); if (c >= 0) occ[c] = 1; }
// how built-up is each neighbourhood? (existing buildings per 100 m cell)
const dens = new Map(); for (const b of blds) { const k = Math.floor(b.p[0][0] / 100) * 1000 + Math.floor(b.p[0][1] / 100); dens.set(k, (dens.get(k) || 0) + 1); }
const density = (x, z) => { let n = 0; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) n += dens.get((Math.floor(x / 100) + i) * 1000 + Math.floor(z / 100) + j) || 0; return n; };
let iseed = 99; const irnd = () => ((iseed = (iseed * 16807) % 2147483647) / 2147483647);
const rectCells = (cx, cz, ux, uz, w, d, pad) => { const out = []; for (let a = -w / 2 - pad; a <= w / 2 + pad; a += 1.5) for (let b = -d / 2 - pad; b <= d / 2 + pad; b += 1.5) out.push(cellOf(cx + ux * a - uz * b, cz + uz * a + ux * b)); return out; };
const tryPlace = (cx, cz, ux, uz, w, d) => { const cells = rectCells(cx, cz, ux, uz, w, d, 0.8); if (cells.some((c) => c < 0 || occ[c])) return false; for (const c of cells) occ[c] = 1; return true; };
const INFILL = [];
for (const r of roads) {
  if (r.t < 2 || r.t > 5) continue;
  const hw = WID[r.t] / 2;
  for (let k = 0; k < r.p.length - 1; k++) {
    const [ax, az] = r.p[k], [bx, bz] = r.p[k + 1]; const L = Math.hypot(bx - ax, bz - az); if (L < 8) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L; // along the lane
    for (const side of [1, -1]) {
      let t = 3 + irnd() * 4;
      while (t < L - 3) {
        const w = 6 + irnd() * 5, d = 7 + irnd() * 5; const mx = ax + ux * t, mz = az + uz * t;
        const nx = -uz * side, nz = ux * side; // away from the lane
        const dn = density(mx, mz);
        if (dn >= 3 || Math.hypot(mx - 1400, mz - 1000) < 900) {
          const off = hw + 2.4 + d / 2; const cx = mx + nx * off, cz = mz + nz * off; // clear of the verge marked around the lane
          // local frame: x along the lane, z away from it; the front faces the lane
          if (tryPlace(cx, cz, ux, uz, w, d)) {
            INFILL.push({ cx, cz, w, d, fx: -nx, fz: -nz, t: r.t, rd: off });
            if (irnd() < (dn > 25 ? 0.55 : 0.3)) { const w2 = 6 + irnd() * 4, d2 = 7 + irnd() * 4, off2 = off + d / 2 + 2 + d2 / 2; const cx2 = mx + nx * off2, cz2 = mz + nz * off2; if (tryPlace(cx2, cz2, ux, uz, w2, d2)) INFILL.push({ cx: cx2, cz: cz2, w: w2, d: d2, fx: -nx, fz: -nz, t: r.t, rd: off2 }); }
          }
        }
        t += w + 1.5 + irnd() * 4;
      }
    }
  }
}
// inner plots: the lanes are lined, now fill the backs of the blocks the way paras actually grow
for (let z = AREA.z0 + 10; z < AREA.z1 - 10; z += 13) for (let x = AREA.x0 + 10; x < AREA.x1 - 10; x += 13) {
  const jx = x + (irnd() - 0.5) * 6, jz = z + (irnd() - 0.5) * 6;
  const dn = density(jx, jz); if (dn < 4 && Math.hypot(jx - 1400, jz - 1000) > 900) continue;
  const rp = nearestRoadPoint(jx, jz); if (!rp || rp.d > 70 || rp.d < 8) continue;
  if (irnd() < 0.25) continue;
  // face the nearest lane
  const fx0 = rp.px - jx, fz0 = rp.pz - jz, fl = Math.hypot(fx0, fz0) || 1; const fx = fx0 / fl, fz = fz0 / fl;
  const w = 6 + irnd() * 4, d = 7 + irnd() * 4; const ux = -fz, uz = fx;
  if (tryPlace(jx, jz, ux, uz, w, d)) INFILL.push({ cx: jx, cz: jz, w, d, fx, fz, t: rp.t, rd: rp.d });
}
const bs = B.length;
for (const f of INFILL) {
  const ax = -f.fz, az = f.fx; // width axis (perpendicular to the front)
  const hw2 = f.w / 2, hd = f.d / 2;
  const corners = [[-hw2, -hd], [hw2, -hd], [hw2, hd], [-hw2, hd]].map(([a, b]) => [f.cx + ax * a + f.fx * b, f.cz + az * a + f.fz * b]);
  B.push([0, ...enc(corners)]);
  BO.push([Math.round(f.cx * 2), Math.round(f.cz * 2), Math.round(f.w * 2), Math.round(f.d * 2), Math.round(Math.atan2(f.fx, f.fz) * 1000), f.t, Math.min(255, Math.round(f.rd))]);
}
console.log(`Infill: ${INFILL.length} houses added on empty plots (OSM had ${bs}).`);

const data = { v: 4, area: AREA, farm: FARM_ZONE, bs, origin: o.origin, names: N, b: B, bo: BO, r: R, w: W, l: L, rv: RV, p: Pp, spots, attribution: `Map data © OpenStreetMap contributors, ODbL. Agartala, around MBB Stadium${o.fetched ? `, fetched ${o.fetched.slice(0, 10)}` : ''}.` };
await writeFile(path.resolve('public/agartala-map.json'), JSON.stringify(data));
const ts = `// Generated by scripts/bake-map.mjs from OpenStreetMap data. Do not edit by hand.\n// Each spot is a point on free ground beside a real road, near the named place.\nexport const SPOTS = {\n${Object.entries(spots).map(([k, v]) => `  ${JSON.stringify(k)}: [${v[0]}, ${v[1]}]`).join(',\n')}\n} as const;\n`;
await writeFile(path.resolve('src/shared/spots.ts'), ts);
console.log(`Wrote public/agartala-map.json (${B.length} buildings, ${R.length} roads, ${W.length} water areas) and src/shared/spots.ts.`);
