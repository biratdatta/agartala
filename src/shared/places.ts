/**
 * Real places in the game area, from OpenStreetMap (positions and names) and Wikipedia (history).
 * Each one gets its real building tinted and signed, a label, a spot on the map, and for most a
 * line of history when you visit. Positions are metres from the map origin (x east, z south).
 */
export type PlaceKind = 'college' | 'stadium' | 'school' | 'temple' | 'park' | 'lake' | 'clinic' | 'apartment' | 'shop' | 'mosque';
export interface RealPlace {
  id: string; name: string; bn?: string; kind: PlaceKind; x: number; z: number;
  /** Wall colour for its building (if it has one). */
  paint?: string;
  /** Shown when you visit; also the sight's lore. */
  lore: string;
  source: 'OpenStreetMap' | 'OpenStreetMap, Wikipedia';
}

export const REAL_PLACES: RealPlace[] = [
  { id: 'mbbcollege', name: 'Maharaja Bir Bikram College', bn: 'মহারাজা বীর বিক্রম কলেজ', kind: 'college', x: 1600, z: 1040, paint: '#e8c25a', source: 'OpenStreetMap, Wikipedia',
    lore: 'MBB College, the oldest college in Tripura. Maharaja Bir Bikram planned it in 1937 on a hill east of the town and called the place Vidyapattan. During the Second World War the half-built ground floor became an army hospital. Regent Maharani Kanchan Prava Devi opened the college on 9 September 1947, for students uprooted from East Bengal. Its colours are yellow and brown, and its motto means "knowledge is the key to immortality". MBB University shares the hill, which everyone calls College Tilla.' },
  { id: 'stadium', name: 'Maharaja Bir Bikram Stadium', bn: 'মহারাজা বীর বিক্রম স্টেডিয়াম', kind: 'stadium', x: 1459, z: 961, source: 'OpenStreetMap, Wikipedia',
    lore: 'Built in 1998 on the MBB College campus, it holds 30,000 people and is the home ground of the Tripura cricket team, with dozens of first-class matches played here. The two ends are the Pavilion End and the City End.' },
  { id: 'lawcollege', name: 'Tripura Government Law College', bn: 'ত্রিপুরা সরকারি আইন মহাবিদ্যালয়', kind: 'college', x: 1348, z: 1413, paint: '#efe2c4', source: 'OpenStreetMap, Wikipedia',
    lore: 'The state\'s law college, now affiliated to MBB University, offering a five-year law degree. Several Tripura politicians took their law degrees here, on the edge of College Tilla.' },
  { id: 'mgschool', name: 'Mahatma Gandhi Memorial School', bn: 'মহাত্মা গান্ধী মেমোরিয়াল স্কুল', kind: 'school', x: 878, z: 1338, paint: '#f2dfa6', source: 'OpenStreetMap',
    lore: 'A school at College Tilla, on the Pratapgarh side. At four o\'clock the lane outside fills with uniforms, tiffin boxes and the jhalmuri seller.' },
  { id: 'shivmandir', name: 'Modern Club Shiv Mandir', bn: 'মডার্ন ক্লাব শিব মন্দির', kind: 'temple', x: 916, z: 1048, paint: '#f6efe0', source: 'OpenStreetMap',
    lore: 'The Shiva temple by Modern Club Park, at the edge of College Lake. Busy every Monday, and all night at Shivaratri.' },
  { id: 'modernclub', name: 'Modern Club Park', bn: 'মডার্ন ক্লাব পার্ক', kind: 'park', x: 924, z: 1032, source: 'OpenStreetMap',
    lore: 'A small park by College Lake, looked after by Modern Club. Its Durga Puja draws crowds from all over the city.' },
  { id: 'lakes', name: 'College Tilla Lake', bn: 'কলেজ টিলা লেক', kind: 'lake', x: 1252, z: 1122, source: 'OpenStreetMap',
    lore: 'The big lake below the college, all inlets and islands, between Modern Club and the stadium. Morning walkers, evening couples, and someone fishing at every hour.' },
  { id: 'collegelake', name: 'College Lake', bn: 'কলেজ লেক', kind: 'lake', x: 962, z: 1045, source: 'OpenStreetMap',
    lore: 'The smaller lake by Modern Club Park and the Shiv Mandir. At Diwali the water is covered with floating diyas.' },
  { id: 'bhaumik', name: 'Bhaumik Polyclinic and Nursing Home', kind: 'clinic', x: 1624, z: 343, paint: '#f6f6f2', source: 'OpenStreetMap',
    lore: 'A private clinic and nursing home on the main road north of the stadium.' },
  { id: 'bijoy', name: 'Bijoy Apartment', kind: 'apartment', x: 1228, z: 1500, paint: '#e6e0d4', source: 'OpenStreetMap',
    lore: 'An apartment block at College Tilla, near the bridge over the Haora.' },
  { id: 'carshringaar', name: 'Car Shringaar Car Parlour', kind: 'shop', x: 644, z: 620, paint: '#d4e2ec', source: 'OpenStreetMap',
    lore: 'A car accessories shop on the road at Math Chowmuhani.' },
  { id: 'pathshala', name: 'My Pathshala', kind: 'school', x: 618, z: 1197, paint: '#f0e2a8', source: 'OpenStreetMap',
    lore: 'A coaching centre at Jagaharimura, on the road to Shibnagar.' },
  { id: 'masjid', name: 'Masjid', bn: 'মসজিদ', kind: 'mosque', x: 504, z: 747, paint: '#f2f2ec', source: 'OpenStreetMap',
    lore: 'A neighbourhood mosque. The azaan carries across the rooftops at dawn.' },
];
export const placeById = (id: string): RealPlace | undefined => REAL_PLACES.find((p) => p.id === id);
/** The MBB College buildings: everything OSM maps on the hill east of the stadium. */
export const CAMPUS: [number, number][] = [[1520, 975], [1725, 975], [1725, 1118], [1520, 1118]];
export function inCampus(x: number, z: number): boolean { return x > CAMPUS[0][0] && x < CAMPUS[1][0] && z > CAMPUS[0][1] && z < CAMPUS[2][1]; }
