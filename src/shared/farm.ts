/**
 * The family bari: Grandpa's house and fields on the open land between the MBB Stadium buildings
 * and the Haora river, where the river bends past Shibnagar. Coordinates are metres from the map
 * origin near Ujjayanta Palace (x east, z south). The three small tillas are invented.
 */
import { SPOTS } from './spots.js';

export interface XZ { x: number; z: number }
export type PlotKind = 'lunga' | 'tilla';
export interface PlotDef extends XZ { kind: PlotKind; y?: number }

export const HOME: XZ = { x: 1610, z: 1180 };
/** The airport cab drops you at the tomtom stand by the stadium gate. */
export const SPAWN: XZ & { face: number } = { x: SPOTS.stStadium[0], z: SPOTS.stStadium[1], face: Math.PI };
export const HILLS = [
  { x: 1748, z: 1166, r: 14, h: 4 }, // pineapple tilla
  { x: 1790, z: 1140, r: 13, h: 4 }, // rubber tilla
  { x: 1700, z: 1242, r: 12, h: 3 }, // tea tilla
] as const;
export const POND = { x: 1641, z: 1200, w: 6, d: 4.5 } as const;

/** Lunga: the low paddy plots between the house and the tillas. */
export const PLOTS: PlotDef[] = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) PLOTS.push({ kind: 'lunga', x: 1656 + c * 5.6, z: 1146 + r * 5.6 });
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.3;
  PLOTS.push({ kind: 'tilla', x: HILLS[0].x + Math.cos(a) * 9, z: HILLS[0].z + Math.sin(a) * 9 });
}
export const LUNGA_COUNT = 12;
export const START_OWNED_LUNGA = 6;

export const RUBBER: XZ[] = [];
for (const dz of [-5, 5]) for (const dx of [-10.5, -3.5, 3.5, 10.5]) RUBBER.push({ x: HILLS[1].x + dx, z: HILLS[1].z + dz + (Math.round(dx) % 2 ? 1 : 0) });
export const BAMBOO: XZ[] = [
  { x: 1588, z: 1146 }, { x: 1628, z: 1268 }, { x: 1712, z: 1134 }, { x: 1770, z: 1200 }, { x: 1662, z: 1286 }, { x: 1596, z: 1240 },
];
export const JACK: XZ[] = [{ x: 1590, z: 1172 }, { x: 1626, z: 1214 }, { x: 1626, z: 1158 }];
export const RINA = { house: { x: 1606, z: 1270 }, npc: { x: 1611, z: 1279 }, loom: { x: 1615.5, z: 1277 }, pole: { x: 1599, z: 1280 } } as const;
export const GRANDPA: XZ = { x: 1614, z: 1190.5 };
export const ROLLER: XZ = { x: 1624, z: 1171 };
export const RACK: XZ = { x: 1631, z: 1168 };
export const SHED: XZ = { x: 1638, z: 1160 };
export const BED: XZ = { x: 1610.8, z: 1185.4 };

/** Tea bushes in a ring round the third tilla. Perennial: plant once, pluck every morning. */
export const TEA: XZ[] = [];
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; TEA.push({ x: HILLS[2].x + Math.cos(a) * 8, z: HILLS[2].z + Math.sin(a) * 8 }); }
/** Agar saplings along the west edge of the lunga: a slow crop, worth a fortune when grown. */
export const AGAR: XZ[] = [1145, 1152, 1159, 1166].map((z) => ({ x: 1647, z }));
/** The craft bench behind the house, where bamboo becomes baskets. */
export const CRAFT: XZ = { x: 1600, z: 1164 };
/** Where the diesel pump set stands, at the pukur's edge. */
export const PUMP: XZ = { x: POND.x + POND.w + 1.6, z: POND.z };
/** The cold store shed, built when you buy one. */
export const COLD: XZ = { x: 1588, z: 1212 };
/** The farm's outline (no OSM houses inside), and a point in the middle of the lunga for markers. */
export const FARM_ZONE: [number, number][] = [[1566, 1122], [1846, 1122], [1745, 1258], [1695, 1302], [1590, 1302], [1562, 1262]];
export const FIELD: XZ = { x: 1664, z: 1152 };
export function inFarm(x: number, z: number): boolean {
  let ins = false; const p = FARM_ZONE;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < ((p[j][0] - p[i][0]) * (z - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) ins = !ins;
  return ins;
}
