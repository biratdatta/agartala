/**
 * The family farm at Bhati Abhoynagar, laid out on the real OSM farmland on the
 * north-west edge of the city. Coordinates are metres from Ujjayanta Palace's origin
 * (x east, z south). The two small tillas are invented.
 */
export interface XZ { x: number; z: number }
export type PlotKind = 'lunga' | 'tilla';
export interface PlotDef extends XZ { kind: PlotKind; y?: number }

export const HOME: XZ = { x: -720, z: -1472 };
/** You arrive by airport cab at the Circuit House tomtom stand, 800 m east of home. */
export const SPAWN: XZ & { face: number } = { x: 63, z: -1521.6, face: Math.PI };
export const HILLS = [
  { x: -770, z: -1610, r: 22, h: 5 }, // pineapple tilla
  { x: -860, z: -1625, r: 26, h: 6 }, // rubber tilla
] as const;
export const POND = { x: -745, z: -1497, w: 6, d: 4.5 } as const;

export const PLOTS: PlotDef[] = [];
for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) PLOTS.push({ kind: 'lunga', x: -806 + c * 5.6, z: -1545 + r * 5.6 });
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.3;
  PLOTS.push({ kind: 'tilla', x: HILLS[0].x + Math.cos(a) * 9, z: HILLS[0].z + Math.sin(a) * 9 });
}
export const LUNGA_COUNT = 12;
export const START_OWNED_LUNGA = 6;

export const RUBBER: XZ[] = [];
for (const zz of [-1631, -1620]) for (const xx of [-871, -864, -857, -850]) RUBBER.push({ x: xx, z: zz + (xx % 2 ? 1 : 0) });
export const BAMBOO: XZ[] = [
  { x: -735, z: -1515 }, { x: -830, z: -1505 }, { x: -760, z: -1650 }, { x: -885, z: -1580 }, { x: -700, z: -1502 }, { x: -815, z: -1588 },
];
export const JACK: XZ[] = [{ x: -700, z: -1478 }, { x: -738, z: -1482 }, { x: -731, z: -1462 }];
export const RINA = { house: { x: -648, z: -1436 }, npc: { x: -643, z: -1427 }, loom: { x: -638.5, z: -1429 }, pole: { x: -655, z: -1426 } } as const;
export const GRANDPA: XZ = { x: -716, z: -1461.5 };
export const ROLLER: XZ = { x: -711, z: -1463 };
export const RACK: XZ = { x: -705.5, z: -1466 };
export const BED: XZ = { x: -719.2, z: -1466.6 };
