#!/usr/bin/env node
/**
 * Builds the game's 3D asset kit: public/models/kit.glb
 *
 * Agartala-style buildings (tin-roof huts, Assam-type houses, 1–4 storey RCC houses with
 * balconies and the black rooftop water tank, shop-houses with shutters and signboards,
 * school blocks, godowns) plus a tomtom, all sharing one texture atlas and a night-window
 * emissive atlas. Every mesh is modelled at a nominal size, front facing +Z, ground at Y=0.
 * The game fits one to each OpenStreetMap footprint.
 *
 * Wall surfaces carry a `_TINT` vertex attribute (1 = take the per-building paint colour).
 * Replace any mesh by exporting a GLB with the same node name from Blender.
 *
 *   npm run assets
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

/* ============================== texture atlas ============================== */
const AS = 1024, TS = 128, GRID = AS / TS;
const img = new Uint8Array(AS * AS * 4), emi = new Uint8Array(AS * AS * 4);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const T = {
  WIN: 0, WIN_AC: 1, WIN_SHADE: 2, PLAIN: 3, DOOR: 4, BALC: 5, SHUTTER: 6, SHOP: 7,
  SIGN: 8, // 8..13
  RAIL: 14, PARAPET: 15, TIN_GREY: 16, TIN_RUST: 17, TIN_BLUE: 18, TIN_GREEN: 19, CONCRETE: 20, TANK: 21,
  BRICK: 22, BAMBOO: 23, SCHOOL: 24, GODOWN: 25, PAINT: 26, DARK: 27, GLASS: 28, PLINTH: 29, WOOD: 30, SEAT: 31,
};
const TINTABLE = new Set([T.WIN, T.WIN_AC, T.WIN_SHADE, T.PLAIN, T.DOOR, T.BALC, T.PARAPET, T.SCHOOL]);
const px = (buf, x, y, c, a = 255) => { if (x < 0 || y < 0 || x >= AS || y >= AS) return; const o = (y * AS + x) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = a; };
function rect(t, x, y, w, h, c, buf = img) { const ox = (t % GRID) * TS, oy = Math.floor(t / GRID) * TS; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < TS && j < TS) px(buf, ox + i, oy + j, c); }
function noise(t, amp, x = 0, y = 0, w = TS, h = TS) { const ox = (t % GRID) * TS, oy = Math.floor(t / GRID) * TS; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const o = ((oy + j) * AS + ox + i) * 4, n = (rnd() - 0.5) * amp; for (let k = 0; k < 3; k++) img[o + k] = Math.max(0, Math.min(255, img[o + k] + n)); } }
function stain(t) { const ox = (t % GRID) * TS, oy = Math.floor(t / GRID) * TS; for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) { const o = ((oy + j) * AS + ox + i) * 4; const s = Math.max(0, (j - 100) / 28) * 28 + (Math.sin(i * 0.21) > 0.92 ? Math.max(0, (60 - j) / 4) : 0); for (let k = 0; k < 3; k++) img[o + k] = Math.max(0, img[o + k] - s); } }
const PLASTER = [238, 234, 226];
function plaster(t) { rect(t, 0, 0, TS, TS, PLASTER); noise(t, 10); stain(t); }
function window_(t, lit) {
  plaster(t);
  rect(t, 28, 26, 72, 66, [205, 202, 195]); rect(t, 32, 30, 64, 58, [52, 62, 72]);
  for (let i = 36; i < 96; i += 8) rect(t, i, 30, 2, 58, [70, 70, 72]);
  rect(t, 32, 58, 64, 2, [70, 70, 72]); rect(t, 26, 92, 76, 5, [190, 188, 182]);
  if (lit) { rect(t, 32, 30, 64, 58, [255, 196, 110], emi); for (let i = 36; i < 96; i += 8) rect(t, i, 30, 2, 58, [60, 40, 20], emi); }
}
// walls
window_(T.WIN, true);
window_(T.WIN_AC, false); rect(T.WIN_AC, 66, 98, 34, 18, [228, 228, 224]); rect(T.WIN_AC, 70, 102, 26, 2, [150, 150, 150]); rect(T.WIN_AC, 70, 108, 26, 2, [150, 150, 150]);
window_(T.WIN_SHADE, true); rect(T.WIN_SHADE, 20, 14, 88, 8, [200, 196, 188]); rect(T.WIN_SHADE, 20, 22, 88, 6, [170, 166, 160]);
plaster(T.PLAIN);
plaster(T.DOOR); rect(T.DOOR, 40, 34, 48, 94, [110, 72, 42]); rect(T.DOOR, 46, 42, 16, 36, [92, 58, 32]); rect(T.DOOR, 66, 42, 16, 36, [92, 58, 32]); rect(T.DOOR, 46, 84, 16, 36, [92, 58, 32]); rect(T.DOOR, 66, 84, 16, 36, [92, 58, 32]); rect(T.DOOR, 78, 80, 4, 6, [200, 170, 80]);
plaster(T.BALC); rect(T.BALC, 30, 20, 68, 108, [80, 62, 44]); rect(T.BALC, 36, 26, 26, 50, [60, 72, 82]); rect(T.BALC, 66, 26, 26, 50, [60, 72, 82]); rect(T.BALC, 36, 26, 56, 50, [255, 205, 120], emi);
// shops and signs
rect(T.SHUTTER, 0, 0, TS, TS, [150, 152, 150]); for (let j = 0; j < TS; j += 4) rect(T.SHUTTER, 0, j, TS, 1, [118, 120, 118]); rect(T.SHUTTER, 0, 0, TS, 10, [90, 92, 90]); rect(T.SHUTTER, 56, 118, 16, 4, [60, 60, 60]); noise(T.SHUTTER, 14);
rect(T.SHOP, 0, 0, TS, TS, [44, 38, 32]); rect(T.SHOP, 0, 0, TS, 8, [90, 92, 90]);
for (let s = 0; s < 4; s++) { rect(T.SHOP, 6, 22 + s * 26, 116, 3, [120, 90, 60]); for (let i = 8; i < 118; i += 9) rect(T.SHOP, i, 10 + s * 26, 7, 11, [[220, 60, 50], [240, 190, 50], [70, 140, 200], [90, 170, 80], [230, 230, 220]][Math.floor(rnd() * 5)]); }
rect(T.SHOP, 0, 8, TS, 120, [255, 220, 160], emi); rect(T.SHOP, 0, 100, TS, 28, [120, 90, 60], emi);
const SIGNS = [[200, 40, 40], [30, 90, 170], [240, 190, 40], [40, 140, 80], [245, 245, 240], [230, 110, 30]];
SIGNS.forEach((c, k) => {
  const t = T.SIGN + k; rect(t, 0, 0, TS, TS, c); rect(t, 0, 0, TS, 6, [40, 40, 40]); rect(t, 0, TS - 6, TS, 6, [40, 40, 40]);
  const ink = k === 2 || k === 4 ? [40, 30, 30] : [250, 248, 240];
  // Bengali-style lettering: each word hangs from a headline (matra), with stems and loops below it
  for (const [y0, hgt] of [[26, 30], [76, 18]]) {
    let x = 10;
    while (x < 108) {
      const ww = 18 + Math.floor(rnd() * 26); if (x + ww > 118) break;
      rect(t, x, y0, ww, 4, ink);
      for (let lx = x + 2; lx < x + ww - 3; lx += 6 + Math.floor(rnd() * 3)) {
        rect(t, lx, y0 + 4, 2, hgt - 4, ink);
        if (rnd() < 0.6) rect(t, lx, y0 + hgt - 4, 5, 3, ink);
        if (rnd() < 0.4) rect(t, lx + 2, y0 + Math.floor(hgt / 2), 4, 3, ink);
      }
      x += ww + 6;
    }
  }
  rect(t, 0, 0, TS, TS, k === 4 ? [200, 200, 180] : c.map((v) => Math.min(255, v + 40)), emi);
});
// structure
rect(T.RAIL, 0, 0, TS, TS, [222, 220, 214]); rect(T.RAIL, 0, 0, TS, 14, [200, 198, 190]); for (let i = 6; i < TS; i += 14) rect(T.RAIL, i, 14, 7, 100, [70, 70, 72]); noise(T.RAIL, 8);
plaster(T.PARAPET); rect(T.PARAPET, 0, 0, TS, 16, [205, 200, 192]);
const tin = (t, c) => { rect(t, 0, 0, TS, TS, c); for (let i = 0; i < TS; i += 8) { rect(t, i, 0, 3, TS, c.map((v) => v + 22)); rect(t, i + 5, 0, 2, TS, c.map((v) => v - 25)); } noise(t, 12); for (let k = 0; k < 6; k++) rect(t, Math.floor(rnd() * TS), Math.floor(rnd() * 80), 3, 30 + Math.floor(rnd() * 40), [130, 70, 40]); };
tin(T.TIN_GREY, [140, 150, 156]); tin(T.TIN_RUST, [150, 82, 52]); tin(T.TIN_BLUE, [70, 110, 150]); tin(T.TIN_GREEN, [72, 120, 88]);
rect(T.CONCRETE, 0, 0, TS, TS, [178, 175, 166]); noise(T.CONCRETE, 18); for (let k = 0; k < 14; k++) rect(T.CONCRETE, Math.floor(rnd() * 110), Math.floor(rnd() * 110), 10 + Math.floor(rnd() * 20), 6 + Math.floor(rnd() * 14), [150, 148, 140]);
rect(T.TANK, 0, 0, TS, TS, [32, 32, 34]); for (let j = 8; j < TS; j += 20) rect(T.TANK, 0, j, TS, 3, [55, 55, 58]);
rect(T.BRICK, 0, 0, TS, TS, [190, 180, 168]); for (let j = 0; j < TS; j += 10) for (let i = (j / 10) % 2 ? 0 : -12; i < TS; i += 24) rect(T.BRICK, i + 1, j + 1, 22, 8, [160 + Math.floor(rnd() * 30), 70 + Math.floor(rnd() * 20), 50]);
rect(T.BAMBOO, 0, 0, TS, TS, [196, 166, 104]); for (let j = 0; j < TS; j += 8) for (let i = 0; i < TS; i += 8) rect(T.BAMBOO, i, j, 8, 4, ((i + j) / 8) % 2 ? [176, 146, 88] : [212, 182, 120]);
plaster(T.SCHOOL); rect(T.SCHOOL, 8, 24, 112, 62, [205, 202, 195]); rect(T.SCHOOL, 12, 28, 104, 54, [56, 66, 76]); for (let i = 12; i < 116; i += 13) rect(T.SCHOOL, i, 28, 3, 54, [205, 202, 195]); rect(T.SCHOOL, 12, 28, 104, 54, [250, 230, 170], emi);
rect(T.GODOWN, 0, 0, TS, TS, [150, 155, 158]); for (let i = 0; i < TS; i += 8) { rect(T.GODOWN, i, 0, 3, TS, [172, 177, 180]); rect(T.GODOWN, i + 5, 0, 2, TS, [120, 124, 128]); } noise(T.GODOWN, 12);
rect(T.PAINT, 0, 0, TS, TS, [246, 246, 246]);
rect(T.DARK, 0, 0, TS, TS, [26, 26, 28]);
rect(T.GLASS, 0, 0, TS, TS, [120, 160, 180]);
rect(T.PLINTH, 0, 0, TS, TS, [128, 124, 116]); noise(T.PLINTH, 16);
rect(T.WOOD, 0, 0, TS, TS, [118, 84, 52]); for (let j = 0; j < TS; j += 6) rect(T.WOOD, 0, j, TS, 1, [96, 66, 40]);
rect(T.SEAT, 0, 0, TS, TS, [120, 40, 34]); noise(T.SEAT, 10);

function png(buf) {
  const raw = Buffer.alloc((AS * 4 + 1) * AS); for (let y = 0; y < AS; y++) { raw[y * (AS * 4 + 1)] = 0; Buffer.from(buf.buffer, y * AS * 4, AS * 4).copy(raw, y * (AS * 4 + 1) + 1); }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(AS, 0); ihdr.writeUInt32BE(AS, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (let i = 0; i < AS * AS; i++) emi[i * 4 + 3] = 255;

/* ============================== mesh builder ============================== */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
function uvOf(t, u, v) { const inset = 1.5 / AS; const u0 = (t % GRID) / GRID + inset, v0 = Math.floor(t / GRID) / GRID + inset, w = 1 / GRID - 2 * inset; return [u0 + u * w, v0 + v * w]; }

class Mesh {
  constructor(name) { this.name = name; this.p = []; this.n = []; this.uv = []; this.tint = []; this.i = []; }
  /** a,b,c,d counter-clockwise seen from the front: bottom-left, bottom-right, top-right, top-left. */
  quad(a, b, c, d, t, tint = 0, uvr = [0, 0, 1, 1]) {
    const nn = norm(cross(sub(b, a), sub(d, a))); const base = this.p.length / 3;
    const uvs = [[uvr[0], uvr[3]], [uvr[2], uvr[3]], [uvr[2], uvr[1]], [uvr[0], uvr[1]]];
    [a, b, c, d].forEach((q, k) => { this.p.push(...q); this.n.push(...nn); this.uv.push(...uvOf(t, ...uvs[k])); this.tint.push(tint); });
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  tri(a, b, c, t, tint = 0) {
    const nn = norm(cross(sub(b, a), sub(c, a))); const base = this.p.length / 3;
    [[a, [0, 1]], [b, [1, 1]], [c, [0.5, 0]]].forEach(([q, uv]) => { this.p.push(...q); this.n.push(...nn); this.uv.push(...uvOf(t, ...uv)); this.tint.push(tint); });
    this.i.push(base, base + 1, base + 2);
  }
  /** Axis-aligned box from min corner (x0,y0,z0) to (x1,y1,z1). `t` is a tile or {top, side, bottom, front}. */
  box(x0, y0, z0, x1, y1, z1, t, tint = 0) {
    const tt = typeof t === 'number' ? { top: t, side: t, bottom: t } : t; const side = tt.side, front = tt.front ?? side;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front, tint);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side, tint);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side, tint);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side, tint);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], tt.top, tint);
    if (tt.bottom !== undefined && y0 > 0.05) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], tt.bottom, tint);
  }
  cylinder(cx, y0, cz, r, h, seg, t) {
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      const p0 = [cx + Math.sin(a0) * r, y0, cz + Math.cos(a0) * r], p1 = [cx + Math.sin(a1) * r, y0, cz + Math.cos(a1) * r];
      this.quad(p0, p1, [p1[0], y0 + h, p1[2]], [p0[0], y0 + h, p0[2]], t, 0, [s / seg, 0, (s + 1) / seg, 1]);
      this.tri([cx, y0 + h, cz], [p0[0], y0 + h, p0[2]], [p1[0], y0 + h, p1[2]], t);
    }
  }
  /** One storey band of a wall, split into ~3 m bays, each bay one atlas tile. Faces outwards along n. */
  wall(origin, right, length, y0, h, tileFn) {
    const bays = Math.max(1, Math.round(length / 3)); const bw = length / bays;
    for (let b = 0; b < bays; b++) {
      const a = add3(origin, right, b * bw), bb = add3(origin, right, (b + 1) * bw); const t = tileFn(b, bays);
      this.quad([a[0], y0, a[2]], [bb[0], y0, bb[2]], [bb[0], y0 + h, bb[2]], [a[0], y0 + h, a[2]], t, TINTABLE.has(t) ? 1 : 0);
    }
  }
}

/** Four walls of a W×D block, storeys of height H starting at y0. tiles(face, storey, bay, bays) picks the tile. */
function walls(m, W, D, y0, storeys, H, tiles, inset = 0) {
  const w = W / 2 - inset, d = D / 2 - inset;
  const faces = [
    ['front', [-w, 0, d], [1, 0, 0], 2 * w], ['right', [w, 0, d], [0, 0, -1], 2 * d],
    ['back', [w, 0, -d], [-1, 0, 0], 2 * w], ['left', [-w, 0, -d], [0, 0, 1], 2 * d],
  ];
  for (let s = 0; s < storeys; s++) for (const [face, o, r, L] of faces) {
    const t = tiles(face, s); m.wall(o, r, L, y0 + s * H, H, typeof t === 'function' ? t : () => t);
  }
}
function parapet(m, W, D, y, h = 0.9, th = 0.18) {
  const w = W / 2, d = D / 2, t = { top: T.CONCRETE, side: T.PARAPET };
  m.box(-w, y, d - th, w, y + h, d, t, 1); m.box(-w, y, -d, w, y + h, -d + th, t, 1);
  m.box(-w, y, -d + th, -w + th, y + h, d - th, t, 1); m.box(w - th, y, -d + th, w, y + h, d - th, t, 1);
}
function flatRoof(m, W, D, y) { const w = W / 2, d = D / 2; m.quad([-w, y, d], [w, y, d], [w, y, -d], [-w, y, -d], T.CONCRETE); }
function tank(m, x, y, z, r = 0.65) { m.box(x - r - 0.1, y, z - r - 0.1, x + r + 0.1, y + 0.5, z + r + 0.1, T.CONCRETE); m.cylinder(x, y + 0.5, z, r, 1.3, 8, T.TANK); }
function stairRoom(m, x, y, z) { m.box(x - 1.5, y, z - 1.5, x + 1.5, y + 2.5, z + 1.5, { top: T.CONCRETE, side: T.PLAIN, front: T.DOOR }, 1); tank(m, x, y + 2.5, z, 0.55); }
function gable(m, W, D, y, rise, over, tile) {
  const w = W / 2 + over, d = D / 2 + over, yr = y + rise, segs = Math.max(1, Math.round((2 * w) / 2.5));
  for (let k = 0; k < segs; k++) {
    const x0 = -w + (k * 2 * w) / segs, x1 = -w + ((k + 1) * 2 * w) / segs;
    m.quad([x0, y, d], [x1, y, d], [x1, yr, 0], [x0, yr, 0], tile);
    m.quad([x1, y, -d], [x0, y, -d], [x0, yr, 0], [x1, yr, 0], tile);
    m.quad([x0, y - 0.04, d], [x0, yr - 0.04, 0], [x1, yr - 0.04, 0], [x1, y - 0.04, d], T.WOOD); // underside
    m.quad([x1, y - 0.04, -d], [x1, yr - 0.04, 0], [x0, yr - 0.04, 0], [x0, y - 0.04, -d], T.WOOD);
  }
  const gw = W / 2, gd = D / 2, gr = rise * (gd / d);
  m.tri([gw, y, gd], [gw, y, -gd], [gw, y + gr, 0], T.PLAIN, 1); m.tri([-gw, y, -gd], [-gw, y, gd], [-gw, y + gr, 0], T.PLAIN, 1);
}
function hip(m, W, D, y, rise, over, tile) {
  const w = W / 2 + over, d = D / 2 + over, yr = y + rise, rx = Math.max(0.2, w - d);
  m.quad([-w, y, d], [w, y, d], [rx, yr, 0], [-rx, yr, 0], tile); m.quad([w, y, -d], [-w, y, -d], [-rx, yr, 0], [rx, yr, 0], tile);
  m.tri([w, y, d], [w, y, -d], [rx, yr, 0], tile); m.tri([-w, y, -d], [-w, y, d], [-rx, yr, 0], tile);
}
function balcony(m, W, D, y, depth = 1.1, frac = 0.6) {
  const bw = W * frac / 2, z0 = D / 2, z1 = D / 2 + depth;
  m.box(-bw, y - 0.15, z0, bw, y, z1, { top: T.CONCRETE, side: T.PARAPET, bottom: T.PARAPET }, 1);
  m.quad([-bw, y, z1], [bw, y, z1], [bw, y + 1, z1], [-bw, y + 1, z1], T.RAIL);
  m.quad([bw, y, z1], [-bw, y, z1], [-bw, y + 1, z1 - 0.06], [bw, y + 1, z1 - 0.06], T.RAIL);
  m.quad([bw, y, z0], [bw, y, z1], [bw, y + 1, z1], [bw, y + 1, z0], T.RAIL); m.quad([-bw, y, z1], [-bw, y, z0], [-bw, y + 1, z0], [-bw, y + 1, z1], T.RAIL);
}
function chhajja(m, W, D, y) { m.box(-W / 2 - 0.1, y, D / 2, W / 2 + 0.1, y + 0.1, D / 2 + 0.55, { top: T.CONCRETE, side: T.PARAPET, bottom: T.PARAPET }, 1); }
const plinth = (m, W, D, h = 0.45) => m.box(-W / 2 - 0.15, 0, -D / 2 - 0.15, W / 2 + 0.15, h, D / 2 + 0.15, { top: T.CONCRETE, side: T.PLINTH });

const winOf = (s, alt) => (b, bays) => (alt ? (b % 2 ? T.WIN_AC : T.WIN) : b === Math.floor(bays / 2) && s === 0 ? T.DOOR : (b + s) % 3 === 1 ? T.WIN_SHADE : T.WIN);

/* ============================== archetypes ============================== */
const H = 3.1;
const ARCH = [];
function hut(name, wallTile, roof) {
  const m = new Mesh(name), W = 6, D = 5; plinth(m, W, D, 0.3);
  walls(m, W, D, 0.3, 1, 2.7, (face) => (face === 'front' ? (b, n) => (b === Math.floor(n / 2) ? T.DOOR : wallTile === T.BAMBOO ? T.BAMBOO : T.WIN) : face === 'back' ? (wallTile === T.BAMBOO ? T.BAMBOO : T.PLAIN) : wallTile === T.BAMBOO ? T.BAMBOO : T.WIN));
  gable(m, W, D, 3.0, 1.5, 0.55, roof);
  ARCH.push({ m, W, D, h: 4.5, roof });
}
function assam(name, roof) {
  const m = new Mesh(name), W = 10, D = 8; plinth(m, W, D, 0.5);
  // the house sits back; a verandah runs across the front under the same roof
  const Dh = D - 2.2; const z = -1.1;
  const block = new Mesh('_'); walls(block, W - 0.6, Dh, 0.5, 1, 3.0, (face) => (face === 'front' ? (b, n) => (b === Math.floor(n / 2) ? T.DOOR : T.WIN) : face === 'back' ? T.PLAIN : T.WIN));
  for (let k = 0; k < block.p.length; k += 3) block.p[k + 2] += z; merge(m, block);
  for (let i = 0; i < 5; i++) { const x = -W / 2 + 0.4 + (i * (W - 0.8)) / 4; m.box(x - 0.1, 0.5, D / 2 - 0.4, x + 0.1, 3.5, D / 2 - 0.2, T.WOOD); }
  m.box(-W / 2 + 0.3, 0.5, D / 2 - 0.35, W / 2 - 0.3, 1.3, D / 2 - 0.25, T.RAIL);
  hip(m, W, D, 3.5, 2.1, 0.7, roof);
  ARCH.push({ m, W, D, h: 5.6, roof });
}
function rcc(name, W, D, storeys, opts = {}) {
  const m = new Mesh(name); plinth(m, W, D);
  walls(m, W, D, 0.45, storeys, H, (face, s) => (face === 'front' ? (s > 0 && opts.balc ? (b, n) => (Math.abs(b - (n - 1) / 2) < n * 0.3 ? T.BALC : T.WIN) : winOf(s, false)) : face === 'back' ? (s % 2 ? T.WIN_AC : T.PLAIN) : winOf(s + 1, true)));
  const top = 0.45 + storeys * H;
  for (let s = 1; s <= storeys; s++) { if (opts.balc && s < storeys + 1 && s >= 1 && s <= storeys - 0) { if (s < storeys) balcony(m, W, D, 0.45 + s * H); } chhajja(m, W, D, 0.45 + s * H - 0.75); }
  flatRoof(m, W, D, top); parapet(m, W, D, top);
  stairRoom(m, -W / 2 + 2, top, -D / 2 + 2); if (opts.tanks > 1) tank(m, W / 2 - 1.5, top, -D / 2 + 1.5);
  ARCH.push({ m, W, D, h: top + 0.9 });
}
function shop(name, W, D, storeys, sign) {
  const m = new Mesh(name); plinth(m, W, D, 0.35);
  walls(m, W, D, 0.35, 1, 3.4, (face) => (face === 'front' ? (b) => (b % 2 ? T.SHUTTER : T.SHOP) : face === 'back' ? T.PLAIN : T.PLAIN));
  walls(m, W, D, 3.75, storeys - 1, H, (face, s) => (face === 'front' ? (s === 0 ? (b, n) => (Math.abs(b - (n - 1) / 2) < n * 0.3 ? T.BALC : T.WIN) : winOf(s + 1, false)) : face === 'back' ? T.WIN_AC : winOf(s + 1, true)));
  m.box(-W / 2 - 0.05, 3.0, D / 2, W / 2 + 0.05, 3.85, D / 2 + 0.35, { top: T.CONCRETE, side: T.DARK, front: sign });
  m.box(-W / 2 - 0.1, 3.85, D / 2, W / 2 + 0.1, 3.95, D / 2 + 1.2, { top: T.CONCRETE, side: T.PARAPET, bottom: T.PARAPET }, 1); // awning slab
  if (storeys > 2) balcony(m, W, D, 3.75 + H);
  const top = 3.75 + (storeys - 1) * H; flatRoof(m, W, D, top); parapet(m, W, D, top); tank(m, W / 2 - 1.3, top, -D / 2 + 1.5);
  ARCH.push({ m, W, D, h: top + 0.9 });
}
function block(name) {
  const m = new Mesh(name), W = 30, D = 12; plinth(m, W, D, 0.6);
  walls(m, W, D, 0.6, 2, 3.4, (face) => (face === 'front' || face === 'back' ? T.SCHOOL : T.WIN));
  m.box(-3, 0.6, D / 2, 3, 3.8, D / 2 + 2.5, { top: T.CONCRETE, side: T.PARAPET, front: T.DOOR }, 1);
  const top = 0.6 + 6.8; flatRoof(m, W, D, top); parapet(m, W, D, top, 1.0); tank(m, -W / 2 + 2, top, 0); tank(m, W / 2 - 2, top, 0);
  ARCH.push({ m, W, D, h: top + 1 });
}
function godown(name) {
  const m = new Mesh(name), W = 20, D = 15; plinth(m, W, D, 0.5);
  walls(m, W, D, 0.5, 1, 4.6, (face) => (face === 'front' ? (b, n) => (b === Math.floor(n / 2) ? T.SHUTTER : T.GODOWN) : T.GODOWN));
  gable(m, W, D, 5.1, 2.2, 0.6, T.TIN_GREY);
  ARCH.push({ m, W, D, h: 7.3 });
}
function merge(a, b) { const base = a.p.length / 3; a.p.push(...b.p); a.n.push(...b.n); a.uv.push(...b.uv); a.tint.push(...b.tint); a.i.push(...b.i.map((x) => x + base)); }

hut('hut_grey', T.PLAIN, T.TIN_GREY); hut('hut_rust', T.PLAIN, T.TIN_RUST); hut('hut_bamboo', T.BAMBOO, T.TIN_RUST);
assam('assam_blue', T.TIN_BLUE); assam('assam_green', T.TIN_GREEN); assam('assam_rust', T.TIN_RUST);
rcc('rcc1', 9, 8, 1); rcc('rcc2', 10, 10, 2, { balc: true }); rcc('rcc3', 12, 12, 3, { balc: true }); rcc('rcc4', 15, 14, 4, { balc: true, tanks: 2 });
shop('shop2_a', 8, 12, 2, T.SIGN); shop('shop2_b', 8, 12, 2, T.SIGN + 1); shop('shop2_c', 8, 12, 2, T.SIGN + 2);
shop('shop3_a', 9, 14, 3, T.SIGN + 3); shop('shop3_b', 9, 14, 3, T.SIGN + 4); shop('shop3_c', 9, 14, 3, T.SIGN + 5);
block('block'); godown('godown');

/* ---- the tomtom (battery e-rickshaw), modelled once with seats and a driver's bench ---- */
{
  const m = new Mesh('tomtom');
  m.box(-0.62, 0.35, -1.15, 0.62, 1.0, 1.15, { top: T.SEAT, side: T.PAINT, bottom: T.DARK }, 1);
  m.box(-0.62, 1.0, 0.95, 0.62, 1.55, 1.08, T.GLASS);
  m.box(-0.5, 1.0, -0.9, 0.5, 1.15, -0.2, T.SEAT); m.box(-0.5, 1.15, -0.95, 0.5, 1.6, -0.85, T.SEAT);
  m.box(-0.4, 1.0, 0.3, 0.4, 1.12, 0.75, T.SEAT);
  for (const [x, z] of [[-0.58, -1.08], [0.58, -1.08], [-0.58, 1.02], [0.58, 1.02]]) m.box(x - 0.03, 1.0, z - 0.03, x + 0.03, 2.15, z + 0.03, T.DARK);
  m.box(-0.7, 2.15, -1.25, 0.7, 2.25, 1.25, { top: T.PAINT, side: T.PAINT, bottom: T.DARK }, 1);
  m.box(-0.12, 0.85, 1.12, 0.12, 0.98, 1.2, T.GLASS);
  for (const [x, z] of [[0, 1.0], [-0.62, -0.8], [0.62, -0.8]]) { const w = new Mesh('_'); w.cylinder(0, -0.08, 0, 0.3, 0.16, 10, T.DARK); for (let k = 0; k < w.p.length; k += 3) { const y = w.p[k + 1], xx = w.p[k]; w.p[k] = y + x; w.p[k + 1] = xx + 0.3; w.p[k + 2] += z; const ny = w.n[k + 1], nx = w.n[k]; w.n[k] = ny; w.n[k + 1] = nx; } merge(m, w); }
  ARCH.push({ m, W: 1.4, D: 2.5, h: 2.25, prop: true });
}

/* ============================== GLB writer ============================== */
function glb(meshes) {
  const bin = []; let off = 0; const bufferViews = [], accessors = [];
  const pushBuf = (buf, target) => { const pad = (4 - (buf.length % 4)) % 4; bin.push(buf, Buffer.alloc(pad)); bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) }); off += buf.length + pad; return bufferViews.length - 1; };
  const acc = (arr, type, comp, target, minmax) => {
    const view = pushBuf(Buffer.from(arr.buffer), target);
    const a = { bufferView: view, componentType: comp, count: arr.length / { SCALAR: 1, VEC2: 2, VEC3: 3 }[type], type };
    if (minmax) { const n = 3, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < arr.length; i += n) for (let k = 0; k < n; k++) { mn[k] = Math.min(mn[k], arr[i + k]); mx[k] = Math.max(mx[k], arr[i + k]); } a.min = mn; a.max = mx; }
    accessors.push(a); return accessors.length - 1;
  };
  const gltfMeshes = [], nodes = [];
  for (const { m, W, D, h, prop } of meshes) {
    const prim = {
      attributes: { POSITION: acc(new Float32Array(m.p), 'VEC3', 5126, 34962, true), NORMAL: acc(new Float32Array(m.n), 'VEC3', 5126, 34962), TEXCOORD_0: acc(new Float32Array(m.uv), 'VEC2', 5126, 34962), _TINT: acc(new Float32Array(m.tint), 'SCALAR', 5126, 34962) },
      indices: acc(new Uint32Array(m.i), 'SCALAR', 5125, 34963), material: 0,
    };
    gltfMeshes.push({ name: m.name, primitives: [prim] }); nodes.push({ name: m.name, mesh: gltfMeshes.length - 1, extras: { W, D, h, prop: !!prop, tris: m.i.length / 3 } });
  }
  const albedo = pushBuf(png(img)), glow = pushBuf(png(emi));
  const json = {
    asset: { version: '2.0', generator: 'haora-bari build-assets.mjs' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gltfMeshes,
    materials: [{ name: 'kit', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.9 }, emissiveTexture: { index: 1 }, emissiveFactor: [1, 1, 1] }],
    textures: [{ source: 0, sampler: 0 }, { source: 1, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: albedo, mimeType: 'image/png' }, { bufferView: glow, mimeType: 'image/png' }],
    accessors, bufferViews, buffers: [{ byteLength: off }],
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const binB = Buffer.concat(bin);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + binB.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([header, ch(js.length, 0x4e4f534a), js, ch(binB.length, 0x004e4942), binB]);
}

const out = path.resolve('public/models/kit.glb');
await mkdir(path.dirname(out), { recursive: true });
const data = glb(ARCH);
await writeFile(out, data);
await mkdir(path.resolve('docs'), { recursive: true });
await writeFile(path.resolve('docs/atlas-preview.png'), png(img));
console.log(`Wrote ${out} (${(data.length / 1024).toFixed(0)} KB)`);
for (const a of ARCH) console.log(`  ${a.m.name.padEnd(12)} ${String(a.m.i.length / 3).padStart(5)} tris  ${a.W}×${a.D} m, ${a.h.toFixed(1)} m tall`);
