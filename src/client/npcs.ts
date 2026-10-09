/** Neighbours who live around the city, and what passers-by say when you stop them. */
import * as THREE from 'three';
import { ITEMS } from '../shared/constants.js';
import { NEIGHBOURS, dailyKaam, type Neighbour } from '../shared/kaam.js';
import type { GameState } from '../shared/save.js';
import { colliders } from './collide.js';
import type { CityMap } from './map/data.js';
import { neighbourSpot } from './map/places.js';
import { MAT } from './scene/kit.js';
import { type Person, person } from './scene/people.js';

export interface NeighbourNpc extends Neighbour { x: number; z: number; g: Person }

const LOOK = [
  { shirt: '#c9b98e', lowerMat: MAT.lungi, gamcha: true }, { female: true, shirt: '#d0408a', bun: true, lowerMat: MAT.rignai2 }, { shirt: '#3b5e7d', lowerMat: MAT.lungi2 },
  { female: true, shirt: '#24336f', bun: true, lowerMat: MAT.rignai }, { shirt: '#f2f2f2', lowerMat: MAT.lungi }, { female: true, shirt: '#c0532f', bun: true, lowerMat: MAT.rignai },
  { shirt: '#e8e1d0', lowerMat: MAT.lungi2, wrap: '#f4efe4' }, { shirt: '#6b8fb3', lowerMat: MAT.lungi, gamcha: true }, { shirt: '#3e6b3a', lowerMat: MAT.lungi }, { female: true, shirt: '#7d1d3f', bun: true, lowerMat: MAT.rignai },
];

export function buildNeighbours(scene: THREE.Scene, map: CityMap): NeighbourNpc[] {
  return NEIGHBOURS.map((n, i) => {
    const [x, z] = neighbourSpot(map, n.id); const g = person(LOOK[i % LOOK.length]); g.position.set(x, 0, z);
    const rn = map.roadNear(x, z); if (rn) g.rotation.y = Math.atan2(rn.px - x, rn.pz - z);
    scene.add(g); colliders.push({ x, z, r: 0.45 });
    return { ...n, x, z, g };
  });
}

/** Today's job for a neighbour, if any, and whether it is already done. */
export function kaamFor(S: GameState, npc: string) {
  const k = dailyKaam(S.day).find((q) => q.npc === npc); if (!k) return null;
  return { ...k, done: S.kaamDone.includes(k.id), itemName: ITEMS[k.item].name.toLowerCase() };
}

const NAMES = ['Dipak', 'Mithu', 'Sanjoy', 'Rupa', 'Biswajit', 'Lakhi', 'Prasenjit', 'Tumpa', 'Ashok', 'Chandana', 'Hari', 'Mamoni', 'Jiten', 'Sraboni', 'Kanai', 'Pinki'];
const LINES: ((S: GameState) => string)[] = [
  () => 'Nomoskar! Kemon achen? You look like you\'re new around here.',
  () => 'Khulumkha! That is how we say hello in Kokborok.',
  (S) => S.from ? `${S.from}? My cousin works there. Says the traffic is worse than ours, if you can believe it.` : 'Moved back home? Good. The city needs young people.',
  (S) => S.rain ? 'This rain! The Haora will be up to the steps of the ghat by evening.' : 'Hot today. Have you tried the lassi at Battala?',
  () => 'Tomtoms everywhere now. When I was a boy it was cycle rickshaws and the odd Ambassador.',
  () => 'Ujjayanta lit up at night is the most beautiful thing in Tripura. Don\'t tell Neermahal I said that.',
  (S) => S.hour < 9 ? 'Off to Lake Chowmuhani before the good fish is gone.' : S.hour > 18 ? 'The evening adda at the chowmuhani is about to start. Come, sit.' : 'Everyone is at work and here I am, walking. Don\'t tell my wife.',
  () => 'If you need anything fixed, ask for Lalit at Abhoynagar. Batteries, pumps, anything.',
  () => 'Queen pineapple from the tillas is the sweetest. Mizoram people will argue, but they are wrong.',
  (S) => S.stats.kaam > 0 ? 'I heard you\'ve been helping people across town. That gets around here, you know.' : 'People here look after each other. Ask around, someone always needs a hand.',
];
let lineIdx = 0;
export function passerby(S: GameState, seed: number): { name: string; text: string } {
  lineIdx = (lineIdx + 1 + (seed % 3)) % LINES.length;
  return { name: NAMES[seed % NAMES.length], text: LINES[lineIdx](S) };
}
