/**
 * Durga Puja pandals round the city. Each is a proper pandal: a plinth, cloth walls with pleated
 * drapes, a flat roof with a stepped crest and kalash, and a decorated front with a great arched
 * gateway, pillars and the club's name board. Inside, on a stepped dais under a glowing chalchitra,
 * is the whole family: Ma Durga with ten arms holding her weapons, her lion, Mahishasura at her
 * feet with his buffalo, Lakshmi with her owl, Saraswati with her veena and swan, Ganesh with his
 * mouse, and Kartik with his peacock. Dhakis drum by the gate, and a crowd gathers in front (off
 * the plinth, with an aisle up the middle) after dark.
 *
 * Sites are chosen when the map is baked (scripts/bake-map.mjs, pandalSite) so the whole pandal and
 * its crowd space are clear of buildings, ponds and roads; the facing comes with the site.
 */
import * as THREE from 'three';
import { PANDALS, type Pandal } from '../../shared/pujo.js';
import { colliders } from '../collide.js';
import { type CityMap } from '../map/data.js';
import { MAT, add, box, cyl, place, sph } from './kit.js';
import { LOOKS, type Person, person } from './people.js';
import { board } from './realplaces.js';

const GOLD = '#e9b23b', SKIN = '#f2c28e', HAIR = '#141012';
const GLOW = new THREE.MeshBasicMaterial({ color: '#ffcf5a' });

/* ---------- the idols ---------- */
type G = THREE.Group;
/** Big painted pratima eyes, brows, red lips; a third eye for Ma. */
function face(g: G, y: number, z: number, r: number, third = false): void {
  for (const s of [-1, 1]) {
    const w = sph(g, r * 0.2, '#f6efe6', s * r * 0.36, y + r * 0.08, z + r * 0.86, 10, 6); w.scale.set(1.7, 0.75, 0.4);
    const p = sph(g, r * 0.11, '#140c0a', s * r * 0.36, y + r * 0.08, z + r * 0.93, 8, 6); p.scale.set(1, 1, 0.4);
    const b = box(g, r * 0.42, r * 0.06, r * 0.05, HAIR, s * r * 0.38, y + r * 0.3, z + r * 0.88); b.rotation.z = s * -0.18;
  }
  const lips = sph(g, r * 0.12, '#b0202a', 0, y - r * 0.38, z + r * 0.88, 8, 6); lips.scale.set(1.6, 0.55, 0.4);
  if (third) { const t = sph(g, r * 0.1, '#c8102e', 0, y + r * 0.42, z + r * 0.86, 8, 6); t.scale.set(0.6, 1.4, 0.4); }
}
/** A goddess or god standing on the dais: flared saree or dhoti, blouse, jewellery, head, crown and halo. */
function figure(h: number, robe: string, blouse: string, o: { skin?: string; crown?: string; third?: boolean; hair?: boolean } = {}): G {
  const g = new THREE.Group(); const skin = o.skin || SKIN;
  const skirt = new THREE.LatheGeometry([0.44, 0.42, 0.36, 0.28, 0.22, 0.2].map((r, i) => new THREE.Vector2(r * h, (i / 5) * 0.52 * h)), 18);
  add(g, skirt, robe, 0, 0, 0); box(g, 0.46 * h, 0.035 * h, 0.03 * h, GOLD, 0, 0.06 * h, 0.4 * h).rotation.x = -0.4; // the saree's gold border
  cyl(g, 0.16 * h, 0.2 * h, 0.3 * h, blouse, 0, 0.67 * h, 0, 14);                                          // torso
  add(g, new THREE.TorusGeometry(0.14 * h, 0.018 * h, 6, 18), GOLD, 0, 0.78 * h, 0.03 * h).rotation.x = 1.25;   // necklace
  cyl(g, 0.05 * h, 0.06 * h, 0.06 * h, skin, 0, 0.84 * h, 0, 8);                                             // neck
  const r = 0.11 * h, hy = 0.95 * h;
  sph(g, r, skin, 0, hy, 0, 16, 12); face(g, hy, 0, r, o.third);
  if (o.hair !== false) { sph(g, r * 1.04, HAIR, 0, hy + r * 0.12, -r * 0.18, 14, 10).scale.set(1, 0.9, 0.95); box(g, 0.24 * h, 0.42 * h, 0.03 * h, HAIR, 0, hy - 0.22 * h, -r * 0.9); } // long open hair down the back
  const halo = new THREE.Mesh(new THREE.CircleGeometry(r * 2, 24), new THREE.MeshLambertMaterial({ color: '#f2c14a', side: THREE.DoubleSide })); halo.position.set(0, hy + r * 0.2, -r * 1.2); g.add(halo);
  add(g, new THREE.ConeGeometry(r * 0.75, r * 1.5, 10), o.crown || GOLD, 0, hy + r * 1.45, 0); sph(g, r * 0.2, '#c62f2f', 0, hy + r * 1.05, r * 0.7, 8, 6); // mukut with a red stone
  for (const s of [-1, 1]) sph(g, 0.045 * h, skin, s * 0.2 * h, 0.79 * h, 0, 8, 6);                        // shoulders
  return g;
}
/** An arm from the shoulder, swung `out` radians from hanging straight down, holding `held`. */
function arm(g: G, h: number, side: number, out: number, fwd: number, skin: string, held?: (hand: G) => void): void {
  const a = new THREE.Group(); a.position.set(side * 0.2 * h, 0.79 * h, 0); a.rotation.set(fwd, 0, side * out); g.add(a);
  cyl(a, 0.03 * h, 0.035 * h, 0.34 * h, skin, 0, -0.17 * h, 0, 8); add(a, new THREE.TorusGeometry(0.035 * h, 0.01 * h, 4, 10), GOLD, 0, -0.27 * h, 0).rotation.x = Math.PI / 2;
  const hand = new THREE.Group(); hand.position.y = -0.36 * h; sph(hand, 0.035 * h, skin, 0, 0, 0, 8, 6); a.add(hand); if (held) held(hand);
}
const WEAPONS: ((hand: G, h: number) => void)[] = [
  (k, h) => { cyl(k, 0.008 * h, 0.008 * h, 0.5 * h, '#ffd25a', 0, -0.12 * h, 0, 4); for (const x of [-1, 0, 1]) add(k, new THREE.ConeGeometry(0.015 * h, 0.07 * h, 4), '#ffd25a', x * 0.035 * h, -0.4 * h, 0).rotation.z = Math.PI; }, // trishul, bright gold
  (k, h) => box(k, 0.02 * h, 0.3 * h, 0.006 * h, '#d8dde2', 0, -0.17 * h, 0),                                          // sword
  (k, h) => add(k, new THREE.TorusGeometry(0.06 * h, 0.012 * h, 4, 14), GOLD, 0, -0.07 * h, 0),                         // chakra
  (k, h) => add(k, new THREE.ConeGeometry(0.03 * h, 0.09 * h, 8), '#f6f3ec', 0, -0.06 * h, 0).rotation.z = 1.2,        // shankh
  (k, h) => add(k, new THREE.TorusGeometry(0.12 * h, 0.008 * h, 4, 16, Math.PI), '#7a5a3a', 0, -0.04 * h, 0),           // bow
  (k, h) => cyl(k, 0.005 * h, 0.005 * h, 0.3 * h, '#d8dde2', 0, -0.12 * h, 0, 4),                                       // arrow
  (k, h) => sph(k, 0.045 * h, '#f07ab0', 0, -0.05 * h, 0, 8, 6),                                                         // lotus
  (k, h) => { cyl(k, 0.007 * h, 0.007 * h, 0.22 * h, '#7a5a3a', 0, -0.1 * h, 0, 4); box(k, 0.07 * h, 0.05 * h, 0.01 * h, '#d8dde2', 0.03 * h, -0.2 * h, 0); }, // axe
  (k, h) => add(k, new THREE.TorusGeometry(0.05 * h, 0.01 * h, 4, 12, Math.PI * 1.5), '#5fb34a', 0, -0.06 * h, 0),      // snake
  (k, h) => add(k, new THREE.ConeGeometry(0.035 * h, 0.06 * h, 10), GOLD, 0, -0.05 * h, 0),                             // bell
];
/** Ma Durga: ten arms fanned behind her, each with a weapon; the trishul goes down to Mahishasura. */
function durga(h: number): G {
  const g = figure(h, '#c62f2f', '#b5232f', { third: true });
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2); // five on each side, from low to high
    arm(g, h, side, 0.45 + k * 0.42, -0.12 - k * 0.04, SKIN, (hand) => WEAPONS[i](hand, h));
  }
  return g;
}
/** The lion: golden body, a big dark mane, legs and a curled tail. */
function lion(h: number): G {
  const g = new THREE.Group(); const body = '#e3a84a';
  const t = cyl(g, 0.13 * h, 0.12 * h, 0.5 * h, body, 0, 0.28 * h, 0, 12); t.rotation.z = Math.PI / 2;
  for (const [x, z] of [[-0.18, -0.08], [-0.18, 0.08], [0.18, -0.08], [0.18, 0.08]]) cyl(g, 0.035 * h, 0.04 * h, 0.22 * h, body, x * h, 0.11 * h, z * h, 8);
  sph(g, 0.17 * h, '#a8641e', -0.3 * h, 0.42 * h, 0, 12, 10); const head = sph(g, 0.1 * h, body, -0.36 * h, 0.42 * h, 0.04 * h, 12, 10); head.scale.set(1.1, 1, 1);
  for (const s of [-1, 1]) { sph(g, 0.02 * h, '#140c0a', -0.42 * h, 0.46 * h, s * 0.05 * h, 6, 4); }
  const tail = add(g, new THREE.TorusGeometry(0.1 * h, 0.015 * h, 4, 10, Math.PI), body, 0.3 * h, 0.38 * h, 0); tail.rotation.z = -0.4;
  return g;
}
/** Mahishasura, green, sword raised, with his buffalo. */
function mahishasura(h: number): G {
  const g = new THREE.Group(); const skin = '#5f8f4f';
  box(g, 0.22 * h, 0.22 * h, 0.14 * h, '#3a3a3a', 0, 0.11 * h, 0);                 // dhoti, kneeling
  box(g, 0.24 * h, 0.24 * h, 0.14 * h, skin, 0, 0.33 * h, 0);                       // a strong chest
  sph(g, 0.08 * h, skin, 0, 0.53 * h, 0, 12, 10); face(g, 0.53 * h, 0, 0.08 * h);
  box(g, 0.1 * h, 0.03 * h, 0.03 * h, HAIR, 0, 0.5 * h, 0.075 * h);                 // moustache
  arm(g, h * 0.7, 1, 2.6, 0, skin, (k) => box(k, 0.015 * h, 0.25 * h, 0.005 * h, '#d8dde2', 0, -0.12 * h, 0));
  const buf = new THREE.Group(); buf.position.set(0.32 * h, 0, -0.05 * h); g.add(buf);
  sph(buf, 0.11 * h, '#2a2624', 0, 0.12 * h, 0, 10, 8).scale.set(1.3, 0.9, 1);
  for (const s of [-1, 1]) add(buf, new THREE.ConeGeometry(0.02 * h, 0.12 * h, 6), '#e6e0d0', s * 0.08 * h, 0.22 * h, 0).rotation.z = s * 1.0;
  return g;
}
function ganesh(h: number): G {
  const g = figure(h, '#f08a24', '#e9b23b', { skin: '#f2e0c8', hair: false });
  const s = '#f2e0c8', r = 0.11 * h, hy = 0.95 * h;
  sph(g, r * 1.25, s, 0, hy, 0, 14, 10);                                                                    // the elephant head over the face
  face(g, hy + r * 0.25, r * 0.2, r);
  for (const k of [-1, 1]) { const e = sph(g, r * 0.9, s, k * r * 1.3, hy, -r * 0.1, 10, 8); e.scale.set(0.35, 1, 0.9); }   // ears
  const t1 = cyl(g, r * 0.25, r * 0.32, r * 1.2, s, 0, hy - r * 0.9, r * 0.95, 8); t1.rotation.x = 0.25; // trunk
  const t2 = cyl(g, r * 0.18, r * 0.24, r * 0.7, s, r * 0.2, hy - r * 1.6, r * 1.2, 8); t2.rotation.z = -0.8;
  sph(g, 0.17 * h, '#e9b23b', 0, 0.6 * h, 0.08 * h, 12, 10);                                                // his round belly
  arm(g, h, -1, 0.5, -0.5, s, (k) => sph(k, 0.04 * h, '#f2e6c8', 0, -0.03 * h, 0, 8, 6));                   // a modak
  arm(g, h, 1, 0.5, -0.5, s);
  const m = sph(g, 0.05 * h, '#8a8a8a', 0.18 * h, 0.04 * h, 0.3 * h, 8, 6); m.scale.set(1.5, 1, 1);        // his mouse
  return g;
}
function lakshmi(h: number): G {
  const g = figure(h, '#e86fa0', '#c2185b');
  arm(g, h, -1, 0.4, -0.6, SKIN, (k) => sph(k, 0.05 * h, '#f07ab0', 0, -0.05 * h, 0, 8, 6));               // a lotus
  arm(g, h, 1, 0.4, -0.6, SKIN, (k) => cyl(k, 0.04 * h, 0.03 * h, 0.07 * h, GOLD, 0, -0.04 * h, 0, 10));  // a pot of gold
  const owl = sph(g, 0.07 * h, '#f2ecdf', -0.25 * h, 0.07 * h, 0.25 * h, 10, 8); owl.scale.y = 1.3;      // her owl
  for (const s of [-1, 1]) sph(g, 0.018 * h, '#140c0a', -0.25 * h + s * 0.025 * h, 0.11 * h, 0.31 * h, 6, 4);
  return g;
}
function saraswati(h: number): G {
  const g = figure(h, '#f6f6f0', '#f6f6f0');
  const v = new THREE.Group(); v.position.set(0.05 * h, 0.6 * h, 0.22 * h); v.rotation.z = -0.9; g.add(v);  // her veena, held across
  cyl(v, 0.012 * h, 0.012 * h, 0.55 * h, '#7a5a3a', 0, 0, 0, 6); sph(v, 0.07 * h, '#a0703e', 0, -0.26 * h, 0, 10, 8); sph(v, 0.05 * h, '#a0703e', 0, 0.24 * h, 0, 8, 6);
  arm(g, h, -1, 0.7, -0.9, SKIN); arm(g, h, 1, 0.3, -0.7, SKIN);
  const swan = sph(g, 0.08 * h, '#ffffff', 0.25 * h, 0.08 * h, 0.25 * h, 10, 8); swan.scale.set(1.4, 0.8, 0.8); // her swan
  const neck = cyl(g, 0.012 * h, 0.015 * h, 0.14 * h, '#ffffff', 0.32 * h, 0.17 * h, 0.27 * h, 6); neck.rotation.z = -0.4;
  return g;
}
function kartik(h: number): G {
  const g = figure(h, '#2f6fb0', '#1f6f5c', { crown: '#1f6f5c' });
  arm(g, h, -1, 0.35, -0.5, SKIN, (k) => add(k, new THREE.TorusGeometry(0.11 * h, 0.008 * h, 4, 16, Math.PI), '#7a5a3a', 0, -0.03 * h, 0)); // bow
  arm(g, h, 1, 0.35, -0.5, SKIN, (k) => cyl(k, 0.005 * h, 0.005 * h, 0.28 * h, '#d8dde2', 0, -0.1 * h, 0, 4));
  const pea = new THREE.Group(); pea.position.set(-0.28 * h, 0, 0.18 * h); g.add(pea);                       // his peacock
  sph(pea, 0.06 * h, '#1f5aa6', 0, 0.12 * h, 0, 10, 8); cyl(pea, 0.012 * h, 0.015 * h, 0.12 * h, '#1f5aa6', 0, 0.22 * h, 0.02 * h, 6);
  for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.06 * h, 10), new THREE.MeshLambertMaterial({ color: k % 2 ? '#1f8a6a' : '#2fb08a', side: THREE.DoubleSide })); const a = -0.9 + k * 0.3; f.position.set(Math.sin(a) * 0.14 * h, 0.16 * h + Math.cos(a) * 0.12 * h, -0.1 * h); pea.add(f); }
  return g;
}
/** The whole family on the dais; their own warm glow so they read at night without extra lights. */
function idols(): G {
  const g = new THREE.Group();
  const put = (o: G, x: number, z: number, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; g.add(o); };
  put(durga(3.4), 0, 0);
  put(lion(2.2), -0.9, 0.55, -0.4); put(mahishasura(2.2), 0.75, 0.75, -0.3);
  put(lakshmi(2.3), 2.2, 0.2, -0.12); put(ganesh(2.2), 3.6, 0.3, -0.18);
  put(saraswati(2.3), -2.3, 0.2, 0.12); put(kartik(2.2), -3.7, 0.3, 0.18);
  g.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const mat = (m.material as THREE.MeshLambertMaterial).clone(); mat.emissive = mat.color.clone(); mat.emissiveIntensity = 0.45; m.material = mat; });
  return g;
}

/* ---------- the pandal ---------- */
function pandal(p: Pandal, i: number): { g: G; fairy: THREE.Object3D[] } {
  const g = new THREE.Group(); const [c1, c2] = p.theme; const fairy: THREE.Object3D[] = [];
  const W = 14, D = 11, H = 8.5, OW = 7.2, OH = 7.2; // footprint, wall height, gateway opening
  box(g, W + 1, 0.45, D + 1, '#d9cfbf', 0, 0.22, 0);                                                           // plinth
  for (let k = 0; k < 3; k++) box(g, OW - k * 0.6, 0.15, 0.6, '#cfc4b0', 0, 0.07 + k * 0.15, D / 2 + 0.9 - k * 0.3); // steps up
  // walls: the back hung with pleated cloth, the sides plain
  box(g, W, H, 0.35, c1, 0, H / 2 + 0.45, -D / 2 + 0.2);
  for (let k = 0; k < 9; k++) box(g, 0.7, H - 0.6, 0.12, k % 2 ? c2 : new THREE.Color(c1).multiplyScalar(1.25).getStyle(), -W / 2 + 1.2 + k * ((W - 2.4) / 8), H / 2 + 0.6, -D / 2 + 0.42);
  for (const s of [-1, 1]) box(g, 0.35, H, D, c1, s * (W / 2 - 0.18), H / 2 + 0.45, 0);
  // flat roof, cornice, and a stepped crest with a kalash over the gateway
  box(g, W + 0.8, 0.45, D + 0.8, c2, 0, H + 0.67, 0); box(g, W + 1.2, 0.3, 0.5, c1, 0, H + 0.45, D / 2 + 0.3);
  for (let k = 0; k < 3; k++) box(g, 6 - k * 1.7, 0.9, 1.2 - k * 0.2, k % 2 ? c1 : c2, 0, H + 1.35 + k * 0.9, D / 2 - 0.2);
  sph(g, 0.45, GOLD, 0, H + 4.25, D / 2 - 0.2, 12, 10); cyl(g, 0.05, 0.05, 1.1, GOLD, 0, H + 5.0, D / 2 - 0.2, 6);
  const flag = box(g, 0.8, 0.45, 0.03, '#f39a1c', 0.4, H + 5.3, D / 2 - 0.2); flag.rotation.y = 0.3;
  // the front: two side screens and an arched lintel over the gateway
  const sideW = (W - OW) / 2;
  for (const s of [-1, 1]) box(g, sideW, H, 0.4, c2, s * (OW / 2 + sideW / 2), H / 2 + 0.45, D / 2);
  const lin = new THREE.Shape(); lin.moveTo(-OW / 2, OH - OW / 2); lin.lineTo(-OW / 2, H); lin.lineTo(OW / 2, H); lin.lineTo(OW / 2, OH - OW / 2);
  lin.absarc(0, OH - OW / 2, OW / 2, 0, Math.PI, false);
  const lintel = new THREE.Mesh(new THREE.ExtrudeGeometry(lin, { depth: 0.4, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: c2 }));
  lintel.position.set(0, 0.45, D / 2 - 0.2); g.add(lintel);
  // decoration round the arch (like thermocol and shola work) and on the screens
  for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI; sph(g, 0.16, k % 2 ? '#f6efe0' : c1, Math.cos(a) * (OW / 2 + 0.25), 0.45 + OH - OW / 2 + Math.sin(a) * (OW / 2 + 0.25), D / 2 + 0.25, 8, 6); }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshLambertMaterial({ color: k % 2 ? '#f6efe0' : c1 })); d.position.set(s * (OW / 2 + sideW / 2), 1.6 + k * 1.8, D / 2 + 0.21); g.add(d); }
  for (const s of [-1, 1]) { cyl(g, 0.4, 0.48, OH, '#f6efe0', s * (OW / 2 - 0.1), OH / 2 + 0.45, D / 2 + 0.35, 12); box(g, 1.1, 0.35, 1.1, GOLD, s * (OW / 2 - 0.1), OH + 0.55, D / 2 + 0.35); }
  const b = board(p.name, p.bn, c1, Math.min(9.5, W - 3)); b.position.set(0, H - 0.55, D / 2 + 0.22); g.add(b);
  // inside: a stepped dais under the chalchitra, and Ma's family
  box(g, 11, 0.8, 3.0, '#7a2e22', 0, 0.85, -D / 2 + 2.0); box(g, 11, 0.35, 1.0, '#8c3a2a', 0, 0.62, -D / 2 + 3.9);
  const cc = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40, 0, Math.PI), GLOW); cc.position.set(0, 1.25, -D / 2 + 0.6); g.add(cc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.7, 40, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#c0532f', side: THREE.DoubleSide })); ring.position.set(0, 1.26, -D / 2 + 0.62); g.add(ring);
  for (let k = 0; k < 9; k++) { const a = 0.15 + (k / 8) * (Math.PI - 0.3); sph(g, 0.22, '#c62f2f', Math.cos(a) * 4.6, 1.25 + Math.sin(a) * 4.6, -D / 2 + 0.7, 8, 6); } // painted roundels on the chalchitra
  const fam = idols(); fam.position.set(0, 1.25, -D / 2 + 2.0); g.add(fam);
  // fairy lights: round the arch, down the pillars and along the roof edge
  const bulb = new THREE.SphereGeometry(0.1, 6, 4);
  const addBulb = (x: number, y: number, z: number, k: number) => { const m = new THREE.Mesh(bulb, MAT.fairy[k % 4]); m.position.set(x, y, z); g.add(m); fairy.push(m); };
  for (let k = 0; k <= 30; k++) { const a = (k / 30) * Math.PI; addBulb(Math.cos(a) * (OW / 2 + 0.55), 0.45 + OH - OW / 2 + Math.sin(a) * (OW / 2 + 0.55), D / 2 + 0.3, k); }
  for (const s of [-1, 1]) for (let k = 0; k < 12; k++) addBulb(s * (OW / 2 + 0.45), 0.9 + k * 0.6, D / 2 + 0.62, k + (s > 0 ? 2 : 0));
  for (let k = 0; k <= 36; k++) addBulb(-W / 2 - 0.4 + (k / 36) * (W + 0.8), H + 0.42, D / 2 + 0.6, k);
  void i;
  return { g, fairy };
}

export class Pandals {
  readonly group = new THREE.Group();
  private fairy: THREE.Object3D[] = [];
  private crowds: Person[] = [];
  /** A spot in front of each pandal, facing Ma, for the Pujo photo booth. */
  readonly booths: { x: number; z: number; face: number; name: string }[] = [];
  constructor(scene: THREE.Scene, map: CityMap) {
    void map;
    PANDALS.forEach((p, i) => {
      const { g, fairy } = pandal(p, i); this.fairy.push(...fairy);
      const rot = p.rot; place(this.group, g, p.x, p.z, rot);
      const fx = Math.sin(rot), fz = Math.cos(rot), ux = Math.cos(rot), uz = -Math.sin(rot);
      const at = (u: number, v: number) => ({ x: p.x + ux * u + fx * v, z: p.z + uz * u + fz * v });
      this.booths.push({ ...at(0, 10.5), face: rot + Math.PI, name: p.name });
      // walls, dais and the gateway's screens are solid; you can walk in through the gateway up to the dais
      for (let u = -6; u <= 6; u += 2) colliders.push({ ...at(u, -5.3), r: 1.1 });
      for (const s of [-1, 1]) for (let v = -4; v <= 4; v += 2) colliders.push({ ...at(s * 6.8, v), r: 0.9 });
      for (const u of [-4, -2, 0, 2, 4]) colliders.push({ ...at(u, -3.4), r: 1.2 });
      for (const s of [-1, 1]) { colliders.push({ ...at(s * 5.4, 5.5), r: 1.5 }); colliders.push({ ...at(s * 3.5, 5.85), r: 0.55 }); }
      // dhakis just outside the gateway, with their dhak drums and white kash plumes
      for (const s of [-1, 1]) {
        const d = person(LOOKS[(i + (s > 0 ? 1 : 3)) % LOOKS.length]); const q = at(s * 4.8, 7.6); d.position.set(q.x, 0, q.z); d.rotation.y = rot + s * 0.5; this.group.add(d);
        const drum = new THREE.Group(); cyl(drum, 0.45, 0.45, 0.9, '#c9a24a', 0, 0, 0, 14).rotation.z = Math.PI / 2; const pl = sph(drum, 0.3, '#f6f6f0', 0.35, 0.55, 0, 8, 6); pl.scale.y = 1.7;
        const dq = at(s * 4.8, 8.1); drum.position.set(dq.x, 1.35, dq.z); drum.rotation.y = rot; this.group.add(drum);
        colliders.push({ ...q, r: 0.6 });
      }
      // a crowd in front, off the plinth, leaving an aisle up the middle; out in the evenings
      for (let k = 0; k < 12; k++) {
        const side = k % 2 ? 1 : -1, row = Math.floor(k / 4), col = Math.floor((k % 4) / 2);
        const q = at(side * (3.4 + col * 1.5 + (row % 2) * 0.5), 9 + row * 1.6 + ((k * 37) % 5) * 0.08);
        const c = person(LOOKS[(i * 3 + k) % LOOKS.length]); c.position.set(q.x, 0, q.z); c.rotation.y = rot + Math.PI - side * 0.12; c.visible = false; this.group.add(c); this.crowds.push(c);
      }
    });
    this.group.visible = false; scene.add(this.group);
  }
  /** Shows the pandals (in the Puja season), lights them after dark, and brings the crowds out. */
  update(on: boolean, night: number, time: number): void {
    this.group.visible = on; if (!on) return;
    const lit = night > 0.3; for (const f of this.fairy) f.visible = lit;
    this.crowds.forEach((c, k) => { c.visible = lit || k % 3 === 0; if (c.visible) c.position.y = Math.max(0, Math.sin(time * 5 + k)) * 0.05; });
  }
}
