/** The part of Agartala the game covers: the paras round MBB Stadium and the Haora bank (metres from the map origin). */
export const AREA = { x0: 500, x1: 2400, z0: 100, z1: 2000 } as const;
export const inArea = (x: number, z: number, pad = 0): boolean => x > AREA.x0 + pad && x < AREA.x1 - pad && z > AREA.z0 + pad && z < AREA.z1 - pad;

/**
 * The five paras the game covers. OpenStreetMap does not name most of them, so the centres are
 * set by hand from local knowledge; every home and farm belongs to the nearest one.
 */
export const PARAS = [
  { name: 'Shibnagar', x: 960, z: 1110 },
  { name: 'Math Chowmuhani', x: 845, z: 620 },
  { name: 'MBB Stadium', x: 1470, z: 960 },
  { name: 'Ramnagar', x: 1020, z: 1420 },
  { name: 'Joynagar', x: 1260, z: 520 },
] as const;
export function paraAt(x: number, z: number): string {
  let best: string = PARAS[0].name, bd = Infinity;
  for (const p of PARAS) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.name; } }
  return best;
}
