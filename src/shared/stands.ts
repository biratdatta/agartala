import { SPOTS } from './spots.js';

/** Tomtom (shared e-rickshaw) stands. Rides between them cost a flat fare. */
export interface Stand { k: StandKey; name: string; x: number; z: number }
export type StandKey = 'stHome' | 'stFields' | 'stStadium' | 'stShibnagar' | 'stMath' | 'stRamnagar' | 'stJoynagar' | 'stBridge' | 'stPalace' | 'stMotor' | 'stParadise';
/** Where the player's house is, if they moved it away from the family fields. */
export interface HomeSite { name: string; x: number; z: number; sx: number; sz: number; face: number }

type CityKey = Exclude<StandKey, 'stHome' | 'stFields'>;
const CITY: [CityKey, string][] = [
  ['stStadium', 'MBB Stadium gate'],
  ['stShibnagar', 'Shibnagar · Modern Club'],
  ['stMath', 'Math Chowmuhani'],
  ['stRamnagar', 'Ramnagar'],
  ['stJoynagar', 'Joynagar'],
  ['stBridge', 'Haora bridge'],
  ['stPalace', 'Ujjayanta Palace'],
  ['stMotor', 'Motor Stand · PRM Centrepoint'],
  ['stParadise', 'Paradise Chowmuhani · City Centre'],
];
export const STAND_KEYS: StandKey[] = ['stHome', 'stFields', ...CITY.map(([k]) => k)];
const CITY_STANDS: Stand[] = CITY.map(([k, name]) => ({ k, name, x: SPOTS[k][0], z: SPOTS[k][1] }));
/** The family fields by the Haora always have a stand on their lane. */
export const FIELDS_STAND: Stand = { k: 'stFields', name: 'The fields by the Haora', x: SPOTS.stHome[0], z: SPOTS.stHome[1] };

/**
 * The stands in play. "Home" follows the player's house; when the house is at the fields
 * the two are one stand.
 */
export function standsFor(home?: HomeSite | null): Stand[] {
  if (!home) return [{ ...FIELDS_STAND, k: 'stHome', name: 'Home · the fields by the Haora' }, ...CITY_STANDS];
  return [{ k: 'stHome', name: `Home · ${home.name}`, x: home.sx, z: home.sz }, FIELDS_STAND, ...CITY_STANDS];
}
/** The stands with the house at the fields (the default). */
export const STANDS: Stand[] = standsFor(null);
export const standByKey = (k: string, home?: HomeSite | null): Stand | undefined => standsFor(home).find((s) => s.k === k);

/** Ride time in game minutes: about 4 minutes a kilometre plus waiting for the tomtom to fill. */
export function rideMinutes(a: Stand, b: Stand): number {
  return (Math.hypot(a.x - b.x, a.z - b.z) / 1000) * 4 + 3;
}
/** Real seconds a ride lasts on screen, from straight-line distance (roads wind about 35% more). */
export function rideSeconds(a: Stand, b: Stand): number {
  return Math.max(12, Math.min(75, (Math.hypot(a.x - b.x, a.z - b.z) * 1.35) / 16));
}
