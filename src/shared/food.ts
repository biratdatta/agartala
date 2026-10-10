/** Food stalls by the tomtom stands. Eating gives back energy; stalls open 07:00 to 22:00. */
import type { StandKey } from './stands.js';

export interface Dish { id: string; name: string; price: number; energy: number; about: string; /** A box to carry away (into your bag), not eaten here. */ takeaway?: boolean }
export interface Stall { id: string; name: string; bn: string; owner: string; stand: StandKey; menu: string[] }
/** A Puja stall: set up by a pandal for the Puja season only. */
export interface PujoStall { id: string; name: string; bn: string; owner: string; pandal: string; menu: string[] }

export const DISHES: Dish[] = [
  { id: 'cha', name: 'Cha and singara', price: 15, energy: 12, about: 'Milky tea and a hot samosa.' },
  { id: 'momo', name: 'Momo', price: 30, energy: 22, about: 'Steamed dumplings with red chutney, the Agartala evening snack.' },
  { id: 'muiborok', name: 'Mui borok', price: 45, energy: 35, about: 'Tripuri dishes with berma, the fermented fish that gives them their taste.' },
  { id: 'chakhwi', name: 'Chakhwi', price: 50, energy: 40, about: 'A Tripuri stew of bamboo shoot and vegetables, thickened the old way.' },
  { id: 'wahan', name: 'Wahan mosdeng', price: 60, energy: 45, about: 'Pork with onion, chilli and ginger, a Tripuri favourite.' },
  { id: 'bhaat', name: 'Bhaat, daal, maachh', price: 55, energy: 45, about: 'Rice, dal and a piece of rohu curry. A proper meal.' },
  { id: 'rasgulla', name: 'Rasgulla', price: 20, energy: 10, about: 'Two soft, syrupy rasgullas.' },
  { id: 'lassi', name: 'Lassi', price: 25, energy: 15, about: 'Sweet, cold and thick enough to stand a spoon in.' },
  // Durga Puja food
  { id: 'bhog', name: 'Bhog khichuri', price: 0, energy: 30, about: 'Khichuri, labra and a spoon of payesh, served free on a sal-leaf plate. Once a day.' },
  { id: 'phuchka', name: 'Phuchka', price: 20, energy: 10, about: 'Six crisp phuchka with tamarind water and spiced potato. One more, dada!' },
  { id: 'eggroll', name: 'Egg roll', price: 40, energy: 22, about: 'A paratha rolled round an egg, onion, chilli and a squeeze of lime.' },
  { id: 'mughlai', name: 'Mughlai paratha', price: 60, energy: 35, about: 'Stuffed with egg and minced meat, fried crisp, with a little potato curry.' },
  { id: 'mishti', name: 'Box of Bijoya mishti', price: 80, energy: 0, takeaway: true, about: 'Rasgulla, sandesh and nadu in a cardboard box, to take to the neighbours on Bijoya.' },
];
export const STALLS: Stall[] = [
  { id: 'fBattala', name: 'Stadium gate food stalls', bn: 'স্টেডিয়াম গেট খাবার', owner: 'Rupa Debnath', stand: 'stStadium', menu: ['momo', 'muiborok', 'lassi', 'cha'] },
  { id: 'fLake', name: 'Math Chowmuhani hotel', bn: 'মঠ চৌমুহনী হোটেল', owner: 'Nitai Saha', stand: 'stMath', menu: ['bhaat', 'cha', 'rasgulla'] },
  { id: 'fMaharajganj', name: 'Haora bridge canteen', bn: 'হাওড়া ব্রিজ ক্যান্টিন', owner: 'Jyotsna Debbarma', stand: 'stBridge', menu: ['chakhwi', 'wahan', 'muiborok', 'cha'] },
  { id: 'fRadhanagar', name: 'Joynagar momo corner', bn: 'জয়নগর মোমো কর্নার', owner: 'Sonam Tamang', stand: 'stJoynagar', menu: ['momo', 'cha', 'lassi'] },
  { id: 'fPost', name: 'Ramnagar sweets', bn: 'রামনগর মিষ্টান্ন ভাণ্ডার', owner: 'Gour Sinha', stand: 'stRamnagar', menu: ['rasgulla', 'cha', 'bhaat'] },
  { id: 'fShib', name: 'Shibnagar lakeside tea', bn: 'শিবনগর লেকসাইড চা', owner: 'Mithu Das', stand: 'stShibnagar', menu: ['cha', 'momo', 'rasgulla'] },
  { id: 'fPalace', name: 'Palace gate tea stall', bn: 'রাজবাড়ি গেট চা', owner: 'Bablu Deb', stand: 'stPalace', menu: ['cha', 'lassi', 'rasgulla'] },
  { id: 'fMotor', name: 'Motor Stand hotel', bn: 'মোটর স্ট্যান্ড হোটেল', owner: 'Ratan Saha', stand: 'stMotor', menu: ['bhaat', 'cha', 'momo'] },
  { id: 'fParadise', name: 'Paradise momo corner', bn: 'প্যারাডাইস মোমো কর্নার', owner: 'Pema Lepcha', stand: 'stParadise', menu: ['momo', 'lassi', 'cha'] },
];
/** Stalls that come up by the pandals in the Puja season. */
export const PUJO_STALLS: PujoStall[] = [
  { id: 'pBhog', name: 'Durgabari bhog', bn: 'দুর্গাবাড়ির ভোগ', owner: 'The puja committee', pandal: 'durgabari', menu: ['bhog'] },
  { id: 'pPhuchka', name: 'Modern Club phuchka', bn: 'মডার্ন ক্লাব ফুচকা', owner: 'Bapi Saha', pandal: 'modern', menu: ['phuchka', 'eggroll', 'cha'] },
  { id: 'pRoll', name: 'Kaman Chowmuhani roll centre', bn: 'কামান চৌমুহনী রোল সেন্টার', owner: 'Raju Das', pandal: 'kaman', menu: ['eggroll', 'mughlai', 'cha'] },
  { id: 'pMughlai', name: 'Paradise mughlai corner', bn: 'প্যারাডাইস মোগলাই কর্নার', owner: 'Salim Mia', pandal: 'paradise', menu: ['mughlai', 'eggroll', 'lassi'] },
  { id: 'pShib', name: 'Shibnagar phuchka', bn: 'শিবনগর ফুচকা', owner: 'Mamoni Debnath', pandal: 'shibnagar', menu: ['phuchka', 'cha', 'rasgulla'] },
  { id: 'pSweetsR', name: 'Ramnagar Bijoya mishti', bn: 'রামনগর বিজয়া মিষ্টি', owner: 'Gopal Ghosh', pandal: 'ramnagar', menu: ['mishti', 'rasgulla', 'lassi'] },
  { id: 'pSweetsP', name: 'Palace gate sweets', bn: 'রাজবাড়ি গেট মিষ্টি', owner: 'Ananda Sen', pandal: 'palace', menu: ['mishti', 'rasgulla', 'cha'] },
];
export const isPujoStall = (id: string): boolean => PUJO_STALLS.some((s) => s.id === id);
export const dishById = (id: string): Dish | undefined => DISHES.find((d) => d.id === id);
export const stallById = (id: string): { id: string; name: string; menu: string[] } | undefined => STALLS.find((s) => s.id === id) || PUJO_STALLS.find((s) => s.id === id);
export const STALL_OPEN = 7, STALL_CLOSE = 22;
/** Gopal's bazar hours. */
export const BAZAR_OPEN = 5, BAZAR_CLOSE = 22;
