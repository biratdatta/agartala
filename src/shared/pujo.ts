/**
 * Durga Puja in the city: a chapter of the main story that runs during the real Puja season, for
 * every player who has reached home and met Grandpa. Pandal hopping round the paras, Ashtami
 * anjali at Durgabari, the evening aarti and dhunuchi naach at Modern Club, and Bijoya Dashami
 * at the ghat on the Haora.
 */
import { SPOTS } from './spots.js';

/** The real-world Puja season (UTC). From Mahalaya, 10 October 2026 in India, to the start of November. */
export const PUJO_SEASON = { from: Date.UTC(2026, 9, 9, 18, 30), to: Date.UTC(2026, 10, 2, 18, 30) };
export const pujoSeason = (t: number): boolean => t >= PUJO_SEASON.from && t < PUJO_SEASON.to;

export interface Pandal { id: string; name: string; bn: string; x: number; z: number; theme: [string, string]; about: string }
export const PANDALS: Pandal[] = [
  { id: 'durgabari', name: 'Durgabari', bn: 'দুর্গাবাড়ি', x: SPOTS.pdDurgabari[0], z: SPOTS.pdDurgabari[1], theme: ['#b5232f', '#f2c14a'],
    about: 'The old Durga temple by Ujjayanta Palace. The puja here began with the Maharajas of Tripura, and the state still keeps it.' },
  { id: 'modern', name: 'Modern Club', bn: 'মডার্ন ক্লাব', x: SPOTS.pandal[0], z: SPOTS.pandal[1], theme: ['#7d1d3f', '#e9b23b'],
    about: 'The Modern Club pandal by College Lake, the one all of Agartala comes to see.' },
  { id: 'shibnagar', name: 'Shibnagar Mahila Puja Committee', bn: 'শিবনগর মহিলা পূজা কমিটি', x: SPOTS.pdShibnagar[0], z: SPOTS.pdShibnagar[1], theme: ['#c2185b', '#f2c14a'],
    about: 'The puja the women of Shibnagar run themselves, from the pandal to the bhog.' },
  { id: 'palace', name: 'Palace Compound Sarbojanin', bn: 'প্যালেস কম্পাউন্ড সার্বজনীন', x: SPOTS.pdPalace[0], z: SPOTS.pdPalace[1], theme: ['#f4f1ea', '#d9a43b'],
    about: 'A white-and-gold pandal built like a little Ujjayanta, right by the palace.' },
  { id: 'kaman', name: 'Kaman Chowmuhani Sarbojanin', bn: 'কামান চৌমুহনী সার্বজনীন', x: SPOTS.pdKaman[0], z: SPOTS.pdKaman[1], theme: ['#1f6f5c', '#f2c14a'],
    about: 'By Motor Stand, so half the city passes it on the way to anywhere.' },
  { id: 'paradise', name: 'Paradise Chowmuhani Sarbojanin', bn: 'প্যারাডাইস চৌমুহনী সার্বজনীন', x: SPOTS.pdParadise[0], z: SPOTS.pdParadise[1], theme: ['#2f6fb0', '#f6efe0'],
    about: 'Lit up across Hari Ganga Basak Road, with the City Centre crowd spilling in.' },
  { id: 'joynagar', name: 'Joynagar Sarbojanin', bn: 'জয়নগর সার্বজনীন', x: SPOTS.pdJoynagar[0], z: SPOTS.pdJoynagar[1], theme: ['#c0532f', '#f2e6c8'],
    about: 'A bamboo-and-jute pandal made by the para itself, every knot tied by hand.' },
  { id: 'ramnagar', name: 'Ramnagar Sarbojanin', bn: 'রামনগর সার্বজনীন', x: SPOTS.pdRamnagar[0], z: SPOTS.pdRamnagar[1], theme: ['#6b3fa0', '#e9b23b'],
    about: 'Famous for its lights: the lanes round it glow for a week.' },
];
export const pandalById = (id: string): Pandal | undefined => PANDALS.find((p) => p.id === id);
/** How many pandals make a proper round of pandal hopping. */
export const PANDAL_GOAL = 5;
/** The ghat on the Haora where Ma is immersed on Dashami. */
export const GHAT = { x: 1720, z: 1330 };
/** When each part can happen (game hours). */
export const ANJALI_HOURS: [number, number] = [6, 12];
export const AARTI_FROM = 18;
export const BISARJAN_FROM = 15;
