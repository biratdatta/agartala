/**
 * Vehicles you can get on and drive yourself. You own them (Grandpa's old cycle-rickshaw from
 * day one; the rest from Gopal's), they park by the house, and the rickshaw and tomtom can
 * carry passengers between stands for a fare.
 */
import type { GameState } from './save.js';

export type VehKey = 'cycle' | 'rickshaw' | 'scooter' | 'bike' | 'tomtom' | 'car';
export interface VehicleDef {
  k: VehKey; name: string; price: number; blurb: string;
  /** Can carry a passenger between tomtom stands for a fare. */
  fares?: number;
}
export const VEHICLES: VehicleDef[] = [
  { k: 'cycle', name: 'Bicycle', price: 800, blurb: 'A second-hand Hero bicycle. Twice as fast as walking.' },
  { k: 'rickshaw', name: 'Cycle-rickshaw', price: 3000, blurb: 'Slow and heavy, but it carries a passenger for a fare.', fares: 1 },
  { k: 'scooter', name: 'Scooter', price: 2500, blurb: 'Quick, nimble and easy to park anywhere.' },
  { k: 'bike', name: 'Motorbike', price: 6000, blurb: 'The fastest way round the paras. Mind the potholes.' },
  { k: 'tomtom', name: 'Tomtom (e-rickshaw)', price: 14000, blurb: 'Your own battery tomtom. Carries passengers for a bigger fare.', fares: 1.5 },
  { k: 'car', name: 'Car', price: 30000, blurb: 'A small second-hand hatchback. Comfortable, but wide for the lanes.' },
];
export const vehicleByKey = (k: string): VehicleDef | undefined => VEHICLES.find((v) => v.k === k);
export const owns = (s: GameState, k: VehKey): boolean => s.garage.includes(k);
/**
 * Rentals: every city tomtom stand has a rental point with a few vehicles. You pay the first game
 * hour up front, then the meter runs until you return it at any rental point. Rates per game hour.
 */
export const RENT_RATE: Record<VehKey, number> = { cycle: 3, rickshaw: 5, scooter: 8, bike: 12, tomtom: 15, car: 30 };
/** What sits at each rental point. */
export const RENTALS: Record<string, VehKey[]> = {
  stStadium: ['cycle', 'scooter', 'tomtom'],
  stMath: ['cycle', 'bike', 'car'],
  stShibnagar: ['cycle', 'rickshaw', 'scooter'],
  stRamnagar: ['cycle', 'scooter'],
  stJoynagar: ['cycle', 'bike', 'car'],
  stBridge: ['cycle', 'rickshaw', 'bike'],
  stPalace: ['cycle', 'rickshaw'],
  stMotor: ['scooter', 'bike', 'car'],
  stParadise: ['cycle', 'scooter'],
};
/** The longest a rental is charged for in one go (a forgotten rental overnight costs a day, not a fortune). */
export const RENT_MAX_HOURS = 24;
/** Game hours a rental has run, and what it has cost so far (never less than the first hour). */
export function rentalHours(s: GameState): number {
  const r = s.rental; if (!r) return 0;
  return Math.min(RENT_MAX_HOURS, Math.max(1, (s.day - r.day) * 24 + s.hour - r.hour));
}
export const rentalCost = (s: GameState): number => (s.rental ? Math.ceil(rentalHours(s) * RENT_RATE[s.rental.veh]) : 0);
export const canFare = (s: GameState, k: VehKey): boolean => owns(s, k) || s.rental?.veh === k;

/** Most passenger fares a day, and the fare for a ride of `m` metres. */
export const FARES_PER_DAY = 12;
export const fareFor = (m: number, mult: number): number => Math.round((15 + (m / 1000) * 30) * mult / 5) * 5;
/** A fare can only be earned as fast as a vehicle could really cover the ground (metres per real second). */
export const FARE_MAX_SPEED = 25;
