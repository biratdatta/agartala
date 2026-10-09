/** Food stalls by the tomtom stands. Eating gives back energy; stalls open 07:00 to 22:00. */
import type { StandKey } from './stands.js';

export interface Dish { id: string; name: string; price: number; energy: number; about: string }
export interface Stall { id: string; name: string; bn: string; owner: string; stand: StandKey; menu: string[] }

export const DISHES: Dish[] = [
  { id: 'cha', name: 'Cha and singara', price: 15, energy: 12, about: 'Milky tea and a hot samosa.' },
  { id: 'momo', name: 'Momo', price: 30, energy: 22, about: 'Steamed dumplings with red chutney, the Agartala evening snack.' },
  { id: 'muiborok', name: 'Mui borok', price: 45, energy: 35, about: 'Tripuri dishes with berma, the fermented fish that gives them their taste.' },
  { id: 'chakhwi', name: 'Chakhwi', price: 50, energy: 40, about: 'A Tripuri stew of bamboo shoot and vegetables, thickened the old way.' },
  { id: 'wahan', name: 'Wahan mosdeng', price: 60, energy: 45, about: 'Pork with onion, chilli and ginger, a Tripuri favourite.' },
  { id: 'bhaat', name: 'Bhaat, daal, maachh', price: 55, energy: 45, about: 'Rice, dal and a piece of rohu curry. A proper meal.' },
  { id: 'rasgulla', name: 'Rasgulla', price: 20, energy: 10, about: 'Two soft, syrupy rasgullas.' },
  { id: 'lassi', name: 'Lassi', price: 25, energy: 15, about: 'Sweet, cold and thick enough to stand a spoon in.' },
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
export const dishById = (id: string): Dish | undefined => DISHES.find((d) => d.id === id);
export const stallById = (id: string): Stall | undefined => STALLS.find((s) => s.id === id);
export const STALL_OPEN = 7, STALL_CLOSE = 22;
/** Gopal's bazar hours. */
export const BAZAR_OPEN = 5, BAZAR_CLOSE = 22;
