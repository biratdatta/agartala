/**
 * Ujjayanta Palace, built to look like the real one rather than a box: a long white two-storey
 * front of Mughal arches on a plinth, a tall central tower with a great arched gateway and the
 * big onion dome, onion-domed towers at both ends and pavilions between, kiosks (chhatris) and
 * merlons along the roofline, and strings of lights that come on at night. In front: the lawn,
 * two long pools with fountains, and the gate.
 */
import * as THREE from 'three';
import { colliders } from '../collide.js';
import { getH } from '../map/data.js';
import { add, box, canvasTexture, cyl, sph } from './kit.js';

const WHITE = '#f7f4ec', CREAM = '#ece3d0', SHADE = '#ddd3bf', GOLD = '#d9a93f';

/** One bay of the arcade (4.5 m wide, one 4.6 m storey): white wall, a cusped arch, pilasters. Plus its night-glow mask. */
function arcadeTexture(portal = false): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const S = 256; const a = document.createElement('canvas'), g = document.createElement('canvas'); a.width = a.height = g.width = g.height = S;
  const c = a.getContext('2d')!, m = g.getContext('2d')!;
  c.fillStyle = WHITE; c.fillRect(0, 0, S, S); m.fillStyle = '#000'; m.fillRect(0, 0, S, S);
  // pilasters and a band at the floor line
  c.fillStyle = SHADE; c.fillRect(0, 0, 18, S); c.fillRect(S - 18, 0, 18, S); c.fillRect(0, S - 14, S, 14); c.fillStyle = '#e9e1cf'; c.fillRect(0, 0, S, 10);
  const x0 = portal ? 40 : 62, x1 = S - x0, top = portal ? 36 : 54, bottom = S - 14;
  const arch = (ctx: CanvasRenderingContext2D, inset: number) => {
    const l = x0 + inset, r = x1 - inset, w = r - l, spring = top + w * 0.55 + inset;
    ctx.beginPath(); ctx.moveTo(l, bottom); ctx.lineTo(l, spring);
    // a pointed, lightly cusped Mughal arch
    ctx.quadraticCurveTo(l, top + inset + w * 0.12, l + w * 0.5, top + inset); ctx.quadraticCurveTo(r, top + inset + w * 0.12, r, spring);
    ctx.lineTo(r, bottom); ctx.closePath();
  };
  c.fillStyle = '#cfc6b2'; arch(c, -8); c.fill();                 // the moulded frame
  c.fillStyle = portal ? '#3b3a3f' : '#59606b'; arch(c, 0); c.fill(); // the shaded opening
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0 + 6, bottom - 10, x1 - x0 - 12, 4); // a balustrade line
  m.fillStyle = '#ffcf80'; arch(m, 6); m.fill();
  const map = canvasTexture(a), glow = canvasTexture(g);
  for (const t of [map, glow]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; }
  glow.colorSpace = THREE.NoColorSpace;
  return { map, glow };
}

/** A Mughal onion dome: R is its widest radius, h its height. */
function onion(R: number, h: number): THREE.LatheGeometry {
  const prof: [number, number][] = [[0.9, 0], [1.0, 0.1], [1.08, 0.28], [1.02, 0.45], [0.78, 0.64], [0.45, 0.82], [0.16, 0.94], [0.0, 1.0]];
  return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * R, y * h)), 28);
}

export class Palace {
  private glowMats: THREE.MeshLambertMaterial[] = [];
  private bulbs: THREE.MeshBasicMaterial;

  /** cx, cz: the footprint centre; ang: which way the front faces; W, D: the footprint's length and depth. */
  constructor(scene: THREE.Scene, cx: number, cz: number, ang: number, W: number, D: number) {
    const g = new THREE.Group(); const y0 = getH(cx, cz);
    const PL = 1.4, ST = 4.6, BODY = ST * 2; // plinth, storey, two storeys
    const arc = arcadeTexture(), por = arcadeTexture(true);
    const facadeMat = (w: number, h: number, t = arc, bayW = 4.5) => {
      const map = t.map.clone(), glow = t.glow.clone(); map.needsUpdate = glow.needsUpdate = true;
      map.repeat.set(Math.max(1, Math.round(w / bayW)), Math.max(1, Math.round(h / ST))); glow.repeat.copy(map.repeat);
      const mat = new THREE.MeshLambertMaterial({ map, emissive: '#ffc874', emissiveMap: glow, emissiveIntensity: 0 }); this.glowMats.push(mat); return mat;
    };
    const plane = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); return m;
    };
    const plain = new THREE.MeshLambertMaterial({ color: WHITE });

    // plinth and steps
    box(g, W + 4, PL, D + 4, CREAM, 0, PL / 2, 0);
    for (let i = 0; i < 5; i++) box(g, 24 - i * 1.6, 0.28, 2.2, SHADE, 0, 0.14 + i * 0.28, D / 2 + 2 + 3.6 - i * 0.7);

    // the main block: arcades on all four faces
    const body = box(g, W, BODY, D, plain, 0, PL + BODY / 2, 0); body.castShadow = true;
    plane(W, BODY, facadeMat(W, BODY), 0, PL + BODY / 2, D / 2 + 0.02);
    plane(W, BODY, facadeMat(W, BODY), 0, PL + BODY / 2, -D / 2 - 0.02, Math.PI);
    plane(D, BODY, facadeMat(D, BODY), W / 2 + 0.02, PL + BODY / 2, 0, Math.PI / 2);
    plane(D, BODY, facadeMat(D, BODY), -W / 2 - 0.02, PL + BODY / 2, 0, -Math.PI / 2);
    // cornices: one at the floor line, a deeper one under the parapet
    box(g, W + 0.8, 0.35, D + 0.8, CREAM, 0, PL + ST, 0);
    box(g, W + 1.2, 0.6, D + 1.2, CREAM, 0, PL + BODY + 0.3, 0);

    // merlons along the parapet, all round
    const top = PL + BODY + 0.6;
    const merlon = new THREE.BoxGeometry(0.9, 0.9, 0.5); const mer: THREE.Matrix4[] = []; const tmp = new THREE.Object3D();
    const edge = (x0: number, z0: number, x1: number, z1: number) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 2.2); for (let i = 0; i <= n; i++) { const t = i / n; tmp.position.set(x0 + (x1 - x0) * t, top + 0.45, z0 + (z1 - z0) * t); tmp.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0); tmp.updateMatrix(); mer.push(tmp.matrix.clone()); } };
    const hw = W / 2 + 0.4, hd = D / 2 + 0.4; edge(-hw, hd, hw, hd); edge(-hw, -hd, hw, -hd); edge(-hw, -hd, -hw, hd); edge(hw, -hd, hw, hd);
    const merM = new THREE.InstancedMesh(merlon, new THREE.MeshLambertMaterial({ color: WHITE }), mer.length); mer.forEach((mm, i) => merM.setMatrixAt(i, mm)); merM.castShadow = true; g.add(merM);

    // little minarets on the parapet every ~12 m along the front and back
    for (const sz of [1, -1]) for (let x = -W / 2 + 12; x < W / 2 - 10; x += 12) {
      if (Math.abs(x) < 14) continue;
      cyl(g, 0.28, 0.32, 1.8, WHITE, x, top + 0.9, sz * hd, 8); add(g, onion(0.45, 0.9), WHITE, x, top + 1.8, sz * hd); cyl(g, 0.04, 0.04, 0.5, GOLD, x, top + 2.9, sz * hd, 4);
    }

    const dome = (x: number, z: number, y: number, R: number, drumH: number, h: number) => {
      cyl(g, R * 0.95, R, drumH, CREAM, x, y + drumH / 2, z, 16);
      box(g, R * 2.1, 0.3, R * 2.1, SHADE, x, y + drumH + 0.15, z);
      const d = add(g, onion(R, h), WHITE, x, y + drumH + 0.3, z); d.castShadow = true;
      // the finial: a gilded kalash and spike
      sph(g, R * 0.12, GOLD, x, y + drumH + 0.3 + h + R * 0.08, z, 10, 8); cyl(g, R * 0.02, R * 0.05, R * 0.5, GOLD, x, y + drumH + 0.3 + h + R * 0.4, z, 6);
    };
    const chhatri = (x: number, z: number, y: number, r: number) => {
      for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cyl(g, 0.12 * r, 0.12 * r, 1.6 * r, WHITE, x + ox * 0.7 * r, y + 0.8 * r, z + oz * 0.7 * r, 6);
      box(g, 1.8 * r, 0.18 * r, 1.8 * r, CREAM, x, y + 1.65 * r, z); add(g, onion(0.95 * r, 1.4 * r), WHITE, x, y + 1.74 * r, z);
    };

    // the central tower: a great arched gateway, an upper arcade, kiosks on its corners and the big dome
    const TW = Math.min(22, W * 0.18), TD = Math.min(18, D * 0.5), TH = BODY + 8.5, tz = D / 2 - TD / 2 + 2.5;
    const tower = box(g, TW, TH, TD, plain, 0, PL + TH / 2, tz); tower.castShadow = true;
    plane(TW, BODY + 2.4, facadeMat(TW, BODY + 2.4, por, TW), 0, PL + (BODY + 2.4) / 2, tz + TD / 2 + 0.03);
    plane(TW, TH - BODY - 2.4, facadeMat(TW, ST, arc, TW / 3), 0, PL + BODY + 2.4 + (TH - BODY - 2.4) / 2, tz + TD / 2 + 0.03);
    box(g, TW + 1, 0.6, TD + 1, CREAM, 0, PL + TH + 0.3, tz);
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) chhatri(ox * (TW / 2 - 1.2), tz + oz * (TD / 2 - 1.2), PL + TH + 0.6, 1.3);
    dome(0, tz, PL + TH + 0.6, Math.min(7.5, TW * 0.36), 3.2, Math.min(11, TW * 0.52));

    // towers at both ends of the front, and pavilions with smaller domes between
    for (const s of [-1, 1]) {
      const x = s * (W / 2 - 5.5), z = D / 2 - 4.5; const h = BODY + 5;
      const t = box(g, 11, h, 11, plain, x, PL + h / 2, z); t.castShadow = true;
      plane(11, h, facadeMat(11, h, arc, 11 / 2), x, PL + h / 2, z + 5.53);
      plane(11, h, facadeMat(11, h, arc, 11 / 2), x + s * 5.53, PL + h / 2, z, s * Math.PI / 2);
      box(g, 12, 0.5, 12, CREAM, x, PL + h + 0.25, z);
      dome(x, z, PL + h + 0.5, 4.2, 2, 6.2);
      const px = s * (W / 4 + 4); chhatri(px, D / 2 - 3, top, 2.1); chhatri(px, -D / 2 + 3, top, 1.6);
      chhatri(s * (W / 2 - 2), -D / 2 + 2, top, 1.4);
    }

    // lights along the roofline, the tower and the domes' drums (on at night)
    this.bulbs = new THREE.MeshBasicMaterial({ color: '#7a7466' });
    const bulb = new THREE.SphereGeometry(0.16, 6, 4); const bm: THREE.Matrix4[] = [];
    const run = (x0: number, y0b: number, z0: number, x1: number, y1: number, z1: number, step = 1.2) => { const L = Math.hypot(x1 - x0, y1 - y0b, z1 - z0), n = Math.max(1, Math.floor(L / step)); for (let i = 0; i <= n; i++) { const t = i / n; tmp.position.set(x0 + (x1 - x0) * t, y0b + (y1 - y0b) * t, z0 + (z1 - z0) * t); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); bm.push(tmp.matrix.clone()); } };
    run(-hw, top + 1, hd + 0.3, hw, top + 1, hd + 0.3); run(-hw, PL + ST + 0.3, hd + 0.5, hw, PL + ST + 0.3, hd + 0.5, 1.6);
    run(-TW / 2, PL + TH + 0.7, tz + TD / 2 + 0.6, TW / 2, PL + TH + 0.7, tz + TD / 2 + 0.6);
    for (const s of [-1, 1]) run(s * TW / 2 + s * 0.4, PL, tz + TD / 2 + 0.6, s * TW / 2 + s * 0.4, PL + TH, tz + TD / 2 + 0.6);
    const bulbsM = new THREE.InstancedMesh(bulb, this.bulbs, bm.length); bm.forEach((mm, i) => bulbsM.setMatrixAt(i, mm)); g.add(bulbsM);

    // the garden: lawn, a path down the middle, two long pools with fountains
    const lawnD = 60, lz = D / 2 + 7 + lawnD / 2; const lawn = box(g, W + 10, 0.06, lawnD, '#6fa84a', 0, 0.05, lz); lawn.receiveShadow = true;
    box(g, 7, 0.08, lawnD, '#d9cfbf', 0, 0.08, lz);
    for (const s of [-1, 1]) {
      const px = s * W * 0.22;
      box(g, 14, 0.5, lawnD - 12, SHADE, px, 0.25, lz); box(g, 12.6, 0.52, lawnD - 13.4, '#4f8fb3', px, 0.27, lz);
      for (const k of [-1, 0, 1]) { const fz = lz + (k * (lawnD - 20)) / 2; cyl(g, 0.9, 1.1, 0.6, WHITE, px, 0.6, fz, 12); cyl(g, 0.12, 0.12, 1.6, WHITE, px, 1.5, fz, 6); sph(g, 0.45, '#cfe6f2', px, 2.4, fz, 10, 8); }
      for (let k = 0; k < 6; k++) { const fz = lz - lawnD / 2 + 6 + k * ((lawnD - 12) / 5); cyl(g, 0.5, 0.6, 1.1, '#3f7a3a', s * 6, 0.55, fz, 8); } // clipped hedges by the path
    }
    g.position.set(cx, y0, cz); g.rotation.y = ang; scene.add(g);

    const fx = Math.sin(ang), fz = Math.cos(ang), ux = Math.cos(ang), uz = -Math.sin(ang);
    for (const s of [-1, 1]) colliders.push({ x: cx + fx * lz + ux * s * W * 0.22, z: cz + fz * lz + uz * s * W * 0.22, r: 5 });
    this.gate = { x: cx + fx * (lz + lawnD / 2 + 3), z: cz + fz * (lz + lawnD / 2 + 3), ux, uz };
  }

  /** Where the garden gate stands (RealPlaces puts the name board on it). */
  readonly gate: { x: number; z: number; ux: number; uz: number };

  /** Lit arches and strings of bulbs after dark. */
  setNight(f: number): void {
    for (const m of this.glowMats) m.emissiveIntensity = f * 0.75;
    this.bulbs.color.set(f > 0.35 ? '#ffe3a6' : '#7a7466');
  }
}
