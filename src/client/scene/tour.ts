/**
 * The title screen's slow fly-round: a shuffled tour of real places in the game area.
 * Positions are metres from the map origin (x east, z south); r and h are the camera's orbit radius and height.
 */
export interface TourStop { name: string; bn: string; x: number; z: number; r: number; h: number }

export const TITLE_TOUR: TourStop[] = [
  { name: 'Maharaja Bir Bikram Stadium', bn: 'মহারাজা বীর বিক্রম স্টেডিয়াম', x: 1436, z: 975, r: 300, h: 140 },
  { name: 'MBB College, College Tilla', bn: 'মহারাজা বীর বিক্রম কলেজ', x: 1600, z: 1040, r: 190, h: 90 },
  { name: 'College Tilla Lake', bn: 'কলেজ টিলা লেক', x: 1252, z: 1122, r: 230, h: 95 },
  { name: 'Modern Club Park and Shiv Mandir', bn: 'মডার্ন ক্লাব পার্ক', x: 935, z: 1040, r: 150, h: 70 },
  { name: 'Math Chowmuhani', bn: 'মঠ চৌমুহনী', x: 845, z: 615, r: 160, h: 75 },
  { name: 'Tripura Government Law College', bn: 'ত্রিপুরা সরকারি আইন মহাবিদ্যালয়', x: 1348, z: 1413, r: 160, h: 75 },
  { name: 'The Haora riverbank', bn: 'হাওড়া নদীর পাড়', x: 1720, z: 1330, r: 220, h: 90 },
  { name: 'The Haora bridge', bn: 'হাওড়া সেতু', x: 1470, z: 1640, r: 180, h: 80 },
];

/** A random order, different on every visit. */
export function shuffledTour(stops: TourStop[] = TITLE_TOUR): TourStop[] {
  const a = stops.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
