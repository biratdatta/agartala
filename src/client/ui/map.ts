/** The paper-style city map, drawn once from the OSM data, shown as a minimap and a full map. */
import { clamp } from '../../shared/rng.js';
import { SPOTS } from '../../shared/spots.js';
import { STANDS } from '../../shared/stands.js';
import { type CityMap, type Poly, ROAD_W, X0, X1, Z0, Z1 } from '../map/data.js';
import { STADIUM } from '../scene/landmarks.js';
import { PARAS } from '../../shared/area.js';
import { REAL_PLACES } from '../../shared/places.js';
import { $ } from './dom.js';

interface View { x0: number; z0: number; w: number; h: number }
const PX = 1800, SIZE = Math.max(X1 - X0, Z1 - Z0);
/** The painted map's size in pixels: as wide and tall as the area really is (it is wider than it is tall). */
const PXW = Math.round((PX * (X1 - X0)) / SIZE), PXH = Math.round((PX * (Z1 - Z0)) / SIZE);
const m2p = (v: number, o: number) => ((v - o) / SIZE) * PX;
export interface MapMarks { player: { x: number; z: number; face: number }; target: { x: number; z: number } | null; others?: { x: number; z: number; name: string }[]; stalls?: { x: number; z: number }[]; rentals?: { x: number; z: number }[]; kaam?: { x: number; z: number }[]; errand?: { x: number; z: number }[]; sights?: { x: number; z: number }[]; home?: { x: number; z: number }; pandals?: { x: number; z: number; name: string; seen: boolean }[] }

export class MapView {
  private img: HTMLCanvasElement;
  constructor(private map: CityMap) { this.img = this.paint(); }

  private paint(): HTMLCanvasElement {
    const cv = document.createElement('canvas'); cv.width = PXW; cv.height = PXH;
    this.paintView(cv.getContext('2d')!, { x0: X0, z0: Z0, w: X1 - X0, h: Z1 - Z0 }, PXW, PXH);
    return cv;
  }

  /** Draws the land, water, buildings and roads inside the world window `v` onto a W x H canvas. */
  private paintView(c: CanvasRenderingContext2D, v: View, W: number, H: number): void {
    const k = W / v.w; const X = (x: number) => (x - v.x0) * k, Z = (z: number) => (z - v.z0) * k;
    const vis = (p: { minx: number; maxx: number; minz: number; maxz: number }) => p.maxx >= v.x0 && p.minx <= v.x0 + v.w && p.maxz >= v.z0 && p.minz <= v.z0 + v.h;
    c.fillStyle = '#b7bf8c'; c.fillRect(0, 0, W, H);
    const path = (p: Poly) => { c.beginPath(); for (let i = 0; i < p.n; i++) { const x = X(p.xs[i]), y = Z(p.zs[i]); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
    const LC = ['#9ccb73', '#cfd88e', '#6e9a55', '#a6c6a0', '#e2d3a6'];
    for (const p of this.map.land) if (vis(p)) { c.fillStyle = LC[p.code]; path(p); c.fill(); }
    c.fillStyle = '#79b1cc'; for (const p of this.map.water) if (vis(p)) { path(p); c.fill(); }
    c.fillStyle = '#d7b28a'; for (const p of this.map.buildings) if (vis(p)) { path(p); c.fill(); }
    if (k > 1.2) { c.strokeStyle = 'rgba(120,90,60,.35)'; c.lineWidth = 1; for (const p of this.map.buildings) if (vis(p)) { path(p); c.stroke(); } } // outlines when zoomed in
    c.lineCap = 'round'; c.lineJoin = 'round';
    const roads = this.map.roads.filter((r) => vis(r)).sort((a, b) => b.t - a.t);
    for (let pass = 0; pass < 2; pass++) for (const r of roads) {
      c.strokeStyle = pass ? (r.t <= 2 ? '#fff4d8' : '#fbfaf5') : '#9a9284';
      c.lineWidth = Math.max(1.2, ROAD_W[r.t] * k * (k > 1 ? 1 : 1.6)) + (pass ? 0 : 1.4);
      c.beginPath(); for (let i = 0; i < r.n; i++) { const x = X(r.xs[i]), y = Z(r.zs[i]); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    }
  }

  /** A Durga Puja pandal on the map: a red tent with a gold top, ticked once you've had darshan there. */
  private static pandalIcon(c: CanvasRenderingContext2D, x: number, y: number, s: number, seen: boolean): void {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(255,207,90,.35)'; c.beginPath(); c.arc(0, -s * 0.2, s * 1.35, 0, 7); c.fill();             // a glow round it
    c.fillStyle = seen ? '#9a8a7a' : '#c62f2f'; c.strokeStyle = '#1c1624'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-s, s * 0.7); c.lineTo(-s, -s * 0.1); c.lineTo(0, -s); c.lineTo(s, -s * 0.1); c.lineTo(s, s * 0.7); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffcf5a'; c.beginPath(); c.arc(0, s * 0.15, s * 0.38, 0, 7); c.fill();                          // Ma, lit inside
    c.fillStyle = '#e9b23b'; c.beginPath(); c.arc(0, -s * 1.1, s * 0.2, 0, 7); c.fill();
    if (seen) { c.strokeStyle = '#2f8f4e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(s * 0.4, s * 0.55); c.lineTo(s * 0.8, s * 0.95); c.lineTo(s * 1.5, s * 0.1); c.stroke(); }
    c.restore();
  }
  private static marker(c: CanvasRenderingContext2D, x: number, y: number, s: number) { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = '#e9b23b'; c.strokeStyle = '#1c1624'; c.lineWidth = 1.5; c.fillRect(-s, -s, s * 2, s * 2); c.strokeRect(-s, -s, s * 2, s * 2); c.restore(); }
  private static arrow(c: CanvasRenderingContext2D, x: number, y: number, s: number, face: number) {
    c.save(); c.translate(x, y); c.rotate(-face + Math.PI); c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, s * 0.8); c.lineTo(0, s * 0.4); c.lineTo(-s * 0.7, s * 0.8); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#1c1624'; c.lineWidth = 1.5; c.stroke(); c.restore();
  }

  drawMini(m: MapMarks): void {
    const cv = $('#mini') as HTMLCanvasElement, c = cv.getContext('2d')!, W = cv.width, VIEW = 420;
    const px = m2p(m.player.x, X0), py = m2p(m.player.z, Z0), sz = (VIEW / SIZE) * PX, k = W / VIEW;
    c.fillStyle = '#b7bf8c'; c.fillRect(0, 0, W, W); c.drawImage(this.img, px - sz / 2, py - sz / 2, sz, sz, 0, 0, W, W);
    const to = (x: number, z: number): [number, number] => [W / 2 + (x - m.player.x) * k, W / 2 + (z - m.player.z) * k];
    for (const s of STANDS) { const [x, y] = to(s.x, s.z); if (x > 0 && x < W && y > 0 && y < W) { c.fillStyle = '#2f8f4e'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); } }
    const dot = (k: { x: number; z: number }, col: string, r: number) => { const [x, y] = to(k.x, k.z); if (x > 0 && x < W && y > 0 && y < W) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); } };
    for (const p of m.pandals || []) { const [x, y] = to(p.x, p.z); if (x > -10 && x < W + 10 && y > -10 && y < W + 10) MapView.pandalIcon(c, x, y, 7, p.seen); }
    for (const k of m.sights || []) dot(k, '#9b6bd6', 6);
    for (const k of m.stalls || []) dot(k, '#c62f2f', 5);
    for (const k of m.rentals || []) dot(k, '#1f6f5c', 6);
    for (const k of m.others || []) dot(k, '#6ad1ff', 6);
    for (const k of m.kaam || []) dot(k, '#4aa3df', 7);
    for (const k of m.errand || []) dot(k, '#e8812f', 7);
    if (m.home) { const [x, y] = to(m.home.x, m.home.z); if (x > 0 && x < W && y > 0 && y < W) { c.fillStyle = '#f6efe0'; c.strokeStyle = '#1c1624'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 9); c.lineTo(x + 8, y - 1); c.lineTo(x + 6, y - 1); c.lineTo(x + 6, y + 7); c.lineTo(x - 6, y + 7); c.lineTo(x - 6, y - 1); c.lineTo(x - 8, y - 1); c.closePath(); c.fill(); c.stroke(); } }
    if (m.target) { const [x, y] = to(m.target.x, m.target.z); MapView.marker(c, clamp(x, 10, W - 10), clamp(y, 10, W - 10), 8); }
    MapView.arrow(c, W / 2, W / 2, 12, m.player.face);
  }

  /** The big map's window onto the city: zoom 1 shows everything; centre in world metres. */
  private pin: { x: number; z: number } | null = null;
  /** A pin for the spot being requested. */
  setPin(p: { x: number; z: number } | null): void { this.pin = p; }
  private zoom = 1; private cx = (X0 + X1) / 2; private cz = (Z0 + Z1) / 2; private last: MapMarks | null = null; private queued = false;
  static readonly MAX_ZOOM = 10;
  private view(): View {
    const w = (X1 - X0) / this.zoom, h = (Z1 - Z0) / this.zoom;
    this.cx = clamp(this.cx, X0 + w / 2, X1 - w / 2); this.cz = clamp(this.cz, Z0 + h / 2, Z1 - h / 2);
    return { x0: this.cx - w / 2, z0: this.cz - h / 2, w, h };
  }
  /** Zooms by `f` keeping the world point under (fx, fy) — fractions of the canvas — where it is. */
  zoomBy(f: number, fx = 0.5, fy = 0.5): void {
    const v = this.view(); const wx = v.x0 + fx * v.w, wz = v.z0 + fy * v.h;
    this.zoom = clamp(this.zoom * f, 1, MapView.MAX_ZOOM);
    const w = (X1 - X0) / this.zoom, h = (Z1 - Z0) / this.zoom; this.cx = wx - (fx - 0.5) * w; this.cz = wz - (fy - 0.5) * h;
    this.redraw();
  }
  /** Pans by a drag of (dx, dy) canvas fractions. */
  panBy(dx: number, dy: number): void { const v = this.view(); this.cx -= dx * v.w; this.cz -= dy * v.h; this.redraw(); }
  resetView(): void { this.zoom = 1; this.cx = (X0 + X1) / 2; this.cz = (Z0 + Z1) / 2; this.redraw(); }
  /** Centres on a point at a given zoom (used to open the map round the player). */
  focus(x: number, z: number, zoom: number): void { this.zoom = clamp(zoom, 1, MapView.MAX_ZOOM); this.cx = x; this.cz = z; this.redraw(); }
  get zoomLevel(): number { return this.zoom; }
  private redraw(): void { if (this.queued || !this.last) return; this.queued = true; requestAnimationFrame(() => { this.queued = false; if (this.last) this.drawBig(this.last); }); }

  /** World position under a click on the big map. */
  worldAt(clientX: number, clientY: number): { x: number; z: number } {
    const cv = $('#mapCv') as HTMLCanvasElement; const r = cv.getBoundingClientRect(); const v = this.view();
    return { x: v.x0 + ((clientX - r.left) / r.width) * v.w, z: v.z0 + ((clientY - r.top) / r.height) * v.h };
  }

  drawBig(m: MapMarks): void {
    this.last = m;
    // drawn at the size it shows on screen (times the screen's pixel density), so labels stay readable and sharp
    const cv = $('#mapCv') as HTMLCanvasElement; const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 900, H = (W * PXH) / PXW; const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const c = cv.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0); const v = this.view(); const k = W / v.w;
    if (this.zoom <= 1.3) { const s0 = PXW / (X1 - X0); c.drawImage(this.img, (v.x0 - X0) * s0, (v.z0 - Z0) * s0, v.w * s0, v.h * s0, 0, 0, W, H); }
    else this.paintView(c, v, W, H);
    const P = (x: number, z: number): [number, number] => [(x - v.x0) * k, (z - v.z0) * k];
    c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)';
    // labels are placed most important first, and one that would overlap an earlier one is left out
    const taken: [number, number, number, number][] = [];
    const lb = (t: string, x: number, z: number, col = '#1c1624', dy = -8) => {
      const [a, b] = P(x, z); if (a < -50 || a > W + 50 || b < -20 || b > H + 20) return;
      const w = c.measureText(t).width, h = parseInt(c.font, 10) || 12; const box: [number, number, number, number] = [a - w / 2 - 2, b + dy - h, a + w / 2 + 2, b + dy + 3];
      if (taken.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) return;
      taken.push(box); c.strokeText(t, a, b + dy); c.fillStyle = col; c.fillText(t, a, b + dy);
    };
    // markers first (they always show), then labels from most to least important
    for (const p of this.map.chowmuhanis) { const [a, b] = P(p.x, p.z); c.fillStyle = '#c0532f'; c.fillRect(a - 2, b - 2, 4, 4); }
    for (const p of REAL_PLACES) if (p.kind !== 'lake' && p.id !== 'stadium') { const [a, b] = P(p.x, p.z); c.fillStyle = '#7d1d3f'; c.fillRect(a - 2, b - 2, 4, 4); }
    for (const s of STANDS) { const [a, b] = P(s.x, s.z); c.fillStyle = '#2f8f4e'; c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; }
    const big = this.zoom >= 2.5 ? 1.15 : 1; const f = (w: number, px: number) => `${w} ${Math.round(px * big)}px "Hind Siliguri", sans-serif`;
    // Durga Puja pandals come first: they are what everyone is looking for this week
    for (const p of m.pandals || []) { const [a, b] = P(p.x, p.z); MapView.pandalIcon(c, a, b, 9, p.seen); }
    c.font = f(700, 13); for (const p of m.pandals || []) lb(p.name.replace(' Sarbojanin', ''), p.x, p.z, p.seen ? '#6b5a4a' : '#b5232f', 26);
    c.font = f(600, 12); for (const p of REAL_PLACES) if (p.kind !== 'lake' && p.id !== 'stadium') lb(p.name, p.x, p.z, '#5a2a3a', 14);
    c.font = f(700, 16); for (const p of PARAS) if (!/Stadium|Math/.test(p.name)) lb(p.name, p.x, p.z, '#6b2a22', -14);
    c.font = f(700, 14);
    lb('MBB Stadium', STADIUM.x, STADIUM.z); lb('Haora river', 1830, 1060, '#2a5f7a'); lb('Math Chowmuhani Bazar', SPOTS.gopal[0], SPOTS.gopal[1] + 26);
    lb('Modern Club', SPOTS.pandal[0], SPOTS.pandal[1] - 18); lb('College Tilla Lake', 1252, 1122, '#2a5f7a'); lb('College Lake', 962, 1060, '#2a5f7a'); lb('Family fields', 1700, 1130); lb('Joynagar bus stop', SPOTS.busTerminus[0], SPOTS.busTerminus[1] - 20);
    c.font = f(600, 12); for (const p of this.map.chowmuhanis) lb(p.name.replace(' Chowmuhani', ''), p.x, p.z, '#6b2a22');
    if (this.zoom >= 2.5) { c.font = f(600, 10); for (const s of STANDS) lb(`Tomtom · ${s.name}`, s.x, s.z, '#1f5a3a', 16); }
    const dot = (k: { x: number; z: number }, col: string, r: number) => { const [a, b] = P(k.x, k.z); c.fillStyle = col; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); };
    for (const k of m.sights || []) dot(k, '#9b6bd6', 5);
    for (const k of m.stalls || []) dot(k, '#c62f2f', 4);
    for (const k of m.rentals || []) dot(k, '#1f6f5c', 5);
    c.font = '600 11px "Hind Siliguri", sans-serif';
    for (const k of m.others || []) { dot(k, '#6ad1ff', 5); lb(k.name, k.x, k.z, '#1a4a6a', -9); }
    for (const k of m.kaam || []) dot(k, '#4aa3df', 6);
    for (const k of m.errand || []) dot(k, '#e8812f', 6);
    if (m.home) { const [a, b] = P(m.home.x, m.home.z); c.fillStyle = '#f6efe0'; c.strokeStyle = '#1c1624'; c.lineWidth = 2; c.beginPath(); c.moveTo(a, b - 10); c.lineTo(a + 9, b - 1); c.lineTo(a + 7, b - 1); c.lineTo(a + 7, b + 8); c.lineTo(a - 7, b + 8); c.lineTo(a - 7, b - 1); c.lineTo(a - 9, b - 1); c.closePath(); c.fill(); c.stroke(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; lb('Home', m.home.x, m.home.z, '#1c1624', -14); }
    if (m.target) { const [a, b] = P(m.target.x, m.target.z); MapView.marker(c, a, b, 7); }
    const [a, b] = P(m.player.x, m.player.z); MapView.arrow(c, a, b, 9, m.player.face);
    if (this.pin) { const [px, py] = P(this.pin.x, this.pin.z); c.fillStyle = '#e9b23b'; c.strokeStyle = '#1c1624'; c.lineWidth = 2; c.beginPath(); c.arc(px, py - 16, 8, Math.PI * 0.85, Math.PI * 0.15); c.lineTo(px, py); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#1c1624'; c.beginPath(); c.arc(px, py - 16, 3, 0, 7); c.fill(); }
  }
}
