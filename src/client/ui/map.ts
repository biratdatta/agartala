/** The paper-style city map, drawn once from the OSM data, shown as a minimap and a full map. */
import { clamp } from '../../shared/rng.js';
import { SPOTS } from '../../shared/spots.js';
import { STANDS } from '../../shared/stands.js';
import { type CityMap, type Poly, ROAD_W, X0, X1, Z0, Z1 } from '../map/data.js';
import { STADIUM } from '../scene/landmarks.js';
import { PARAS } from '../../shared/area.js';
import { $ } from './dom.js';

const PX = 1800, SIZE = Math.max(X1 - X0, Z1 - Z0);
const m2p = (v: number, o: number) => ((v - o) / SIZE) * PX;
export interface MapMarks { player: { x: number; z: number; face: number }; target: { x: number; z: number } | null; others?: { x: number; z: number; name: string }[]; stalls?: { x: number; z: number }[]; rentals?: { x: number; z: number }[]; kaam?: { x: number; z: number }[]; errand?: { x: number; z: number }[]; sights?: { x: number; z: number }[]; home?: { x: number; z: number } }

export class MapView {
  private img: HTMLCanvasElement;
  constructor(private map: CityMap) { this.img = this.paint(); }

  private paint(): HTMLCanvasElement {
    const cv = document.createElement('canvas'); cv.width = cv.height = PX; const c = cv.getContext('2d')!;
    c.fillStyle = '#b7bf8c'; c.fillRect(0, 0, PX, PX);
    const path = (p: Poly) => { c.beginPath(); for (let i = 0; i < p.n; i++) { const x = m2p(p.xs[i], X0), y = m2p(p.zs[i], Z0); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.closePath(); };
    const LC = ['#9ccb73', '#cfd88e', '#6e9a55', '#a6c6a0', '#e2d3a6'];
    for (const p of this.map.land) { c.fillStyle = LC[p.code]; path(p); c.fill(); }
    c.fillStyle = '#79b1cc'; for (const p of this.map.water) { path(p); c.fill(); }
    c.fillStyle = '#d7b28a'; for (const p of this.map.buildings) { path(p); c.fill(); }
    c.lineCap = 'round'; c.lineJoin = 'round';
    const roads = this.map.roads.slice().sort((a, b) => b.t - a.t);
    for (let pass = 0; pass < 2; pass++) for (const r of roads) {
      c.strokeStyle = pass ? (r.t <= 2 ? '#fff4d8' : '#fbfaf5') : '#9a9284';
      c.lineWidth = Math.max(1.2, (ROAD_W[r.t] / SIZE) * PX * 1.6) + (pass ? 0 : 1.4);
      c.beginPath(); for (let i = 0; i < r.n; i++) { const x = m2p(r.xs[i], X0), y = m2p(r.zs[i], Z0); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
    }
    return cv;
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

  /** World position under a click on the big map. */
  worldAt(clientX: number, clientY: number): { x: number; z: number } {
    const cv = $('#mapCv') as HTMLCanvasElement; const r = cv.getBoundingClientRect();
    const fx = (clientX - r.left) / r.width, fy = (clientY - r.top) / r.height;
    return { x: X0 + fx * SIZE, z: Z0 + fy * SIZE };
  }

  drawBig(m: MapMarks): void {
    const cv = $('#mapCv') as HTMLCanvasElement, c = cv.getContext('2d')!, W = cv.width; c.drawImage(this.img, 0, 0, W, W);
    const k = W / PX; const P = (x: number, z: number): [number, number] => [m2p(x, X0) * k, m2p(z, Z0) * k];
    c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)';
    const lb = (t: string, x: number, z: number, col = '#1c1624', dy = -8) => { const [a, b] = P(x, z); c.strokeText(t, a, b + dy); c.fillStyle = col; c.fillText(t, a, b + dy); };
    c.font = '600 12px "Hind Siliguri", sans-serif';
    for (const p of this.map.chowmuhanis) { const [a, b] = P(p.x, p.z); c.fillStyle = '#c0532f'; c.fillRect(a - 2, b - 2, 4, 4); lb(p.name.replace(' Chowmuhani', ''), p.x, p.z, '#6b2a22'); }
    for (const s of STANDS) { const [a, b] = P(s.x, s.z); c.fillStyle = '#2f8f4e'; c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; }
    c.font = '700 14px "Hind Siliguri", sans-serif';
    lb('MBB Stadium', STADIUM.x, STADIUM.z); lb('Family fields', 1700, 1130); lb('Haora river', 1830, 1060, '#2a5f7a'); lb('Math Chowmuhani Bazar', SPOTS.gopal[0], SPOTS.gopal[1] + 26);
    lb('Joynagar bus stop', SPOTS.busTerminus[0], SPOTS.busTerminus[1] - 20); lb('Modern Club', SPOTS.pandal[0], SPOTS.pandal[1] - 18); lb('Shibnagar lakes', 1180, 1110, '#2a5f7a');
    c.font = '700 16px "Hind Siliguri", sans-serif'; for (const p of PARAS) if (!/Stadium|Math/.test(p.name)) lb(p.name, p.x, p.z, '#6b2a22');
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
  }
}
