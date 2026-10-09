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
/** Most passenger fares a day, and the fare for a ride of `m` metres. */
export const FARES_PER_DAY = 12;
export const fareFor = (m: number, mult: number): number => Math.round((15 + (m / 1000) * 30) * mult / 5) * 5;
/** A fare can only be earned as fast as a vehicle could really cover the ground (metres per real second). */
export const FARE_MAX_SPEED = 25;
