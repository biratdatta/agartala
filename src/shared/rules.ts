/**
 * Every change to money, land, crops and missions goes through apply().
 * The browser runs it optimistically; the server runs the same code on its own clock
 * and its answer is the truth. A tampered client gains nothing.
 */
import { AGAR_NEED, CAN_BIG, COST, ENERGY_MAX, FISH_NEED, HELPER_DAYS, ITEMS, LATEX_PER_SHEET, NEED, PRICES, TAP_FROM, TAP_UNTIL, TEA_NEED, YIELD, type BuyKey, type ItemKey } from './constants.js';
import { HAAT_ITEMS, haatPrice, saleValue, yearOf } from './economy.js';
import { PLOTS } from './farm.js';
import { checkMissions, currentMission } from './missions.js';
import { dailyKaam } from './kaam.js';
import { SIGHTS, SIGHT_REWARD, dailyDeliveries, deliveryById, sightById } from './errands.js';
import { normalizeHome, sanitizeName, sanitizePlace, type GameState, type Inventory } from './save.js';
import { rideMinutes, rideSeconds, standByKey } from './stands.js';
import { advance, finishRide, hoursToMorning, isNight, tickHours } from './time.js';
import { BAZAR_CLOSE, BAZAR_OPEN, STALL_CLOSE, STALL_OPEN, dishById, isPujoStall, stallById } from './food.js';
import { FRIENDABLE, INVITE_FROM, INVITE_UNTIL, PHRASE_REWARD, befriend, friendship, inviteToday, kaamBonus, nextPhrase } from './friends.js';
import { festById, festKey, isFestival, kept, kerClosed, pithaSeason, type FestId } from './festivals.js';
import { CHAPTER_REWARD, nextChapter } from './story.js';
import { tripById, tripOpen } from './trips.js';
import { weekId } from './week.js';
import { rnd2 } from './rng.js';
import { AREA } from './area.js';
import { ANJALI_HOURS, AARTI_FROM, BIJOYA_GOAL, BISARJAN_FROM, PANDALS, PANDAL_GOAL, pandalById, pujoSeason } from './pujo.js';
import { FARES_PER_DAY, FARE_MAX_SPEED, RENTALS, RENT_RATE, canFare, fareFor, owns, rentalCost, vehicleByKey, type VehKey } from './vehicles.js';

export type Action =
  | { t: 'till'; plot: number }
  | { t: 'sow'; plot: number }
  | { t: 'water'; plot: number }
  | { t: 'harvest'; plot: number }
  | { t: 'fill' }
  | { t: 'tap'; tree: number }
  | { t: 'cut'; clump: number }
  | { t: 'pick'; tree: number }
  | { t: 'roll' }
  | { t: 'sell'; item: ItemKey; n: number }
  | { t: 'buy'; item: BuyKey }
  | { t: 'ride'; from: string; to: string }
  | { t: 'arrive' }
  | { t: 'kaam'; npc: string }
  | { t: 'from'; city: string; km: number }
  | { t: 'home'; site: unknown }
  | { t: 'pickup'; id: string }
  | { t: 'deliver'; id: string }
  | { t: 'visit'; id: string }
  | { t: 'sleep' }
  | { t: 'meetGrandpa' }
  | { t: 'giveBamboo' }
  | { t: 'kharchi' }
  | { t: 'durga' }
  | { t: 'pandal'; id: string }
  | { t: 'anjali' }
  | { t: 'aarti' }
  | { t: 'bisarjan' }
  | { t: 'bijoya'; npc: string }
  | { t: 'name'; name: string }
  | { t: 'pos'; x: number; z: number; face: number }
  // added with the bigger world
  | { t: 'plant'; kind: 'tea' | 'agar'; i: number }
  | { t: 'pluck'; i: number }
  | { t: 'fell'; i: number }
  | { t: 'stock' }
  | { t: 'net' }
  | { t: 'pump' }
  | { t: 'craft' }
  | { t: 'cook' }
  | { t: 'eat'; stall: string; dish: string }
  | { t: 'chat'; npc: string }
  | { t: 'givePitha'; npc: string }
  | { t: 'attend'; npc: string }
  | { t: 'chapter'; id: string }
  | { t: 'fest'; id: FestId }
  | { t: 'trip'; id: string; sell?: Partial<Record<ItemKey, number>> }
  | { t: 'readInbox' }
  | { t: 'fare'; veh: string; from: string; to: string }
  | { t: 'rent'; veh: string; at: string }
  | { t: 'returnRental'; at: string };

export interface GameEvent { kind: 'toast' | 'day' | 'mission' | 'ending' | 'sfx' | 'phrase' | 'chapter'; text: string; title?: string; next?: string; sfx?: string }
export type Result = { ok: true; events: GameEvent[] } | { ok: false; err: string; events: GameEvent[] };

const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];
const BUY_KEYS: BuyKey[] = ['paddySeed', 'sucker', 'plot', 'bhar', 'cycle', 'teaSapling', 'agarSapling', 'fingerling', 'scooter', 'pump', 'coldStore', 'helper', 'bike', 'car', 'tomtom', 'rickshaw'];
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const TEA_PER_PLUCK = 2, AGAR_PER_TREE = 2, FISH_PER_NET = 6, PITHA_PER_COOK = 4, PLUCK_FROM = 5, PLUCK_UNTIL = 14;
/** Weekly tallies, keyed by the real-world ISO week. */
function week(s: GameState, now: number, k: 'paddy' | 'deliveries' | 'kaam' | 'sights' | 'earned', n: number): void {
  const id = weekId(now); if (s.week.id !== id) s.week = { id, paddy: 0, deliveries: 0, kaam: 0, sights: 0, earned: 0 };
  s.week[k] += n;
}
/** Money that counts as earned (sales, kaam, deliveries). */
function earn(s: GameState, now: number, n: number): void { s.money += n; s.stats.earned += n; week(s, now, 'earned', n); }

function plotAt(s: GameState, i: unknown) {
  if (!int(i) || i < 0 || i >= s.plots.length) return null;
  return { p: s.plots[i], def: PLOTS[i] };
}

/** Applies one action at real time `now`. On failure the state may have advanced in time but nothing else changed. */
export function apply(s: GameState, a: Action, now: number): Result {
  const ev: GameEvent[] = [];
  advance(s, now, ev);
  const fail = (err: string): Result => ({ ok: false, err, events: ev });
  const toast = (text: string, sfx?: string) => ev.push({ kind: 'toast', text, sfx });
  const sfx = (name: string) => ev.push({ kind: 'sfx', text: '', sfx: name });
  if (!a || typeof a !== 'object' || typeof (a as { t?: unknown }).t !== 'string') return fail('Bad action');
  // work tires you out
  const cost = COST[a.t] || 0;
  if (cost && s.energy < cost) return fail('Too tired. Eat something at a food stall, rest a while, or sleep.');
  const tire = () => { s.energy = Math.max(0, s.energy - cost); };

  switch (a.t) {
    case 'till': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      if (!q.p.owned) return fail('You do not own this plot');
      if (q.p.state !== 'grass') return fail('Already tilled');
      if (s.flood && q.def.kind === 'lunga') return fail('The lunga is under floodwater today');
      q.p.state = 'tilled'; tire(); sfx('till'); break;
    }
    case 'sow': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      if (!q.p.owned || q.p.state !== 'tilled' || q.p.crop) return fail('This plot is not ready to sow');
      if (s.flood && q.def.kind === 'lunga') return fail('The lunga is under floodwater today');
      const key: keyof Inventory = q.def.kind === 'lunga' ? 'paddySeed' : 'sucker';
      if (s.inv[key] < 1) return fail(q.def.kind === 'lunga' ? 'No paddy seed' : 'No pineapple suckers');
      s.inv[key]--; q.p.crop = q.def.kind === 'lunga' ? 'paddy' : 'pineapple'; q.p.growth = 0; q.p.watered = s.rain; tire(); sfx('sow'); break;
    }
    case 'water': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      if (!q.p.crop || q.p.watered || q.p.growth >= NEED[q.p.crop]) return fail('Nothing to water');
      if (s.inv.water < 1) return fail('The can is empty');
      s.inv.water--; q.p.watered = true; tire(); sfx('water'); break;
    }
    case 'harvest': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      const c = q.p.crop; if (!c || q.p.growth < NEED[c]) return fail('Not ripe yet');
      s.inv[c] += YIELD[c]; s.stats.harvest[c]++; q.p.crop = null; q.p.growth = 0; q.p.watered = false; tire();
      if (c === 'paddy') week(s, now, 'paddy', 1);
      toast(`+${YIELD[c]} ${c === 'paddy' ? 'sacks of paddy' : 'Queen pineapples'}`, 'harvest'); break;
    }
    case 'fill': {
      if (s.inv.water >= s.canMax) return fail('The can is full');
      s.inv.water = s.canMax; sfx('water'); break;
    }
    case 'tap': {
      const t = int(a.tree) ? s.trees[a.tree] : undefined; if (!t) return fail('No such tree');
      if (t.tapped === s.day) return fail('Already tapped today');
      if (s.hour < TAP_FROM || s.hour >= TAP_UNTIL) return fail('Rubber is tapped at dawn, 05:00 to 11:00');
      t.tapped = s.day; s.inv.latex++; tire(); toast('+1 cup of latex', 'tap'); break;
    }
    case 'cut': {
      const b = int(a.clump) ? s.bamboo[a.clump] : undefined; if (!b) return fail('No such clump');
      if (b.ready > s.day) return fail('The clump is regrowing');
      b.ready = s.day + 2; s.inv.bamboo++; tire(); toast('+1 bamboo culm', 'cut'); break;
    }
    case 'pick': {
      const j = int(a.tree) ? s.jack[a.tree] : undefined; if (!j) return fail('No such tree');
      if (j.fruits < 1) return fail('No ripe jackfruit');
      j.fruits--; s.inv.jackfruit++; tire(); toast('+1 jackfruit', 'harvest'); break;
    }
    case 'roll': {
      const n = Math.floor(s.inv.latex / LATEX_PER_SHEET); if (n < 1) return fail('Not enough latex');
      s.inv.latex -= n * LATEX_PER_SHEET; s.inv.sheet += n; s.stats.sheets += n; tire();
      toast(`+${n} rubber sheet${n > 1 ? 's' : ''} hung to dry`, 'till'); break;
    }
    case 'sell': {
      if (!ITEM_KEYS.includes(a.item)) return fail('Gopal does not buy that');
      if (!int(a.n) || a.n < 1 || a.n > s.inv[a.item]) return fail('You do not have that many');
      if (s.hour < BAZAR_OPEN || s.hour >= BAZAR_CLOSE) return fail('The bazar is shut. Gopal opens at 05:00.');
      const got = saleValue(a.item, s.day, s.market[a.item] || 0, a.n);
      s.inv[a.item] -= a.n; earn(s, now, got); s.stats.sold[a.item] = (s.stats.sold[a.item] || 0) + a.n;
      s.market[a.item] = Math.round(((s.market[a.item] || 0) + a.n) * 10) / 10;
      toast(`Sold ${a.n} ${ITEMS[a.item].name.toLowerCase()} for ₹${got}`, 'coin'); break;
    }
    case 'buy': {
      if (!BUY_KEYS.includes(a.item)) return fail('Gopal does not sell that');
      const price = PRICES[a.item]; if (s.money < price) return fail('Not enough money');
      if (a.item === 'plot') { const i = s.plots.findIndex((p) => !p.owned); if (i < 0) return fail('You own the whole lunga'); s.plots[i].owned = true; toast('The plot is yours. Gopal\'s cousin hands over the patta.', 'coin'); }
      else if (a.item === 'bhar') { if (s.canMax >= CAN_BIG) return fail('You already have a bhar'); s.canMax = CAN_BIG; toast('A bamboo bhar: two cans on one shoulder pole.', 'coin'); }
      else if (['cycle', 'scooter', 'bike', 'car', 'tomtom', 'rickshaw'].includes(a.item)) {
        const v = vehicleByKey(a.item)!; if (owns(s, v.k)) return fail(`You already have a ${v.name.toLowerCase()}`);
        s.garage = [...s.garage, v.k]; if (v.k === 'cycle') s.cycle = true; if (v.k === 'scooter') s.scooter = true;
        toast(`${v.name}: it is parked by your house. Walk up to it and press E to ride.`, 'coin');
      }
      else if (a.item === 'pump') { if (s.pump) return fail('You already have a pump set'); s.pump = true; toast('Lalit the mechanic sets up a diesel pump by your pukur. One pull waters every plot.', 'coin'); }
      else if (a.item === 'coldStore') { if (s.coldStore) return fail('You already have a cold store'); s.coldStore = true; toast('A small cold store goes up by the field shed. Nothing will go off now.', 'coin'); }
      else if (a.item === 'helper') { s.helperUntil = Math.max(s.helperUntil, s.day) + HELPER_DAYS; toast(`Gopal\'s nephew will water and harvest your fields every dawn until day ${s.helperUntil}.`, 'coin'); }
      else if (a.item === 'paddySeed' || a.item === 'sucker' || a.item === 'teaSapling' || a.item === 'agarSapling' || a.item === 'fingerling') { s.inv[a.item]++; sfx('coin'); }
      s.money -= price; break;
    }
    case 'ride': {
      if (s.ride) return fail('You are already on a tomtom');
      if (kerClosed(s)) return fail('Ker Puja: the city boundary is closed and no tomtoms run until 18:00');
      const from = standByKey(a.from, s.home), to = standByKey(a.to, s.home);
      if (!from || !to || from === to) return fail('No such tomtom route');
      const free = !!s.flags.freeRide;
      if (!free && s.money < PRICES.fare) return fail('Not enough money for the fare');
      if (free) s.flags.freeRide = false; else s.money -= PRICES.fare;
      const mud = s.flood ? 1.3 : 1;
      s.ride = { from: from.k, to: to.k, start: now, ms: Math.round(rideSeconds(from, to) * 1000 * mud), hours: (rideMinutes(from, to) / 60) * (s.flood ? 1.5 : 1), done: 0 };
      toast(free ? `Grandpa paid the driver in advance. Off to ${to.name}!` : `₹${PRICES.fare} to the driver. Off to ${to.name}.${s.flood ? ' The roads are mud today, so it is slow going.' : ''}`, 'horn');
      return { ok: true, events: ev };
    }
    case 'arrive': {
      if (!s.ride) return fail('You are not on a tomtom');
      finishRide(s, ev); break;
    }
    case 'kaam': {
      const k = dailyKaam(s.day).find((x) => x.npc === a.npc); if (!k) return fail('Nobody here needs anything today');
      if (s.kaamDone.includes(k.id)) return fail('You already helped today');
      if (s.inv[k.item] < k.qty) return fail(`They need ${k.qty} ${ITEMS[k.item].name.toLowerCase()}`);
      const pay = Math.round((k.reward * kaamBonus(friendship(s, k.npc))) / 5) * 5;
      s.inv[k.item] -= k.qty; earn(s, now, pay); s.stats.kaam++; s.kaamDone = [...s.kaamDone, k.id].slice(-30); befriend(s, k.npc, 10); week(s, now, 'kaam', 1);
      toast(`+₹${pay} for helping out`, 'coin'); break;
    }
    case 'home': {
      if (s.ride) return fail('Get off the tomtom first');
      if (a.site === null) { s.home = null; toast('Home is the old house at the fields by the Haora.'); return { ok: true, events: ev }; }
      const h = normalizeHome(a.site); if (!h) return fail('That is not a place in Agartala');
      s.home = h; toast(`Home is now in ${h.name}.`); return { ok: true, events: ev };
    }
    case 'pickup': {
      const d = deliveryById(a.id); if (!d || !dailyDeliveries(s.day).some((x) => x.id === a.id)) return fail('No parcel waiting');
      if (s.carry) return fail('Your hands are full: deliver the parcel you have first');
      if (s.delivered.includes(d.id)) return fail('Already delivered today');
      s.carry = d.id; befriend(s, d.from, 3); toast(`You take ${d.parcel}.`, 'talk'); break;
    }
    case 'deliver': {
      if (!s.carry || s.carry !== a.id) return fail('You are not carrying that');
      const d = deliveryById(a.id); s.carry = null; if (!d) return fail('That parcel has gone stale');
      earn(s, now, d.reward); s.delivered = [...s.delivered, d.id].slice(-30); s.stats.deliveries++; befriend(s, d.to, 8); week(s, now, 'deliveries', 1);
      toast(`Delivered ${d.parcel}. +₹${d.reward}`, 'coin'); break;
    }
    case 'visit': {
      const sight = sightById(a.id); if (!sight) return fail('No such place');
      if (s.visited.includes(sight.id)) return fail('You have seen it already');
      s.visited = [...s.visited, sight.id]; s.stats.sights++; s.money += SIGHT_REWARD; week(s, now, 'sights', 1);
      toast(`${sight.name} · ${s.visited.length} of ${SIGHTS.length} sights seen · +₹${SIGHT_REWARD}`, 'mission'); break;
    }
    case 'from': {
      const c = sanitizePlace(a.city); if (c.length < 2) return fail('Name your home town');
      s.from = c; s.fromKm = typeof a.km === 'number' && Number.isFinite(a.km) ? Math.round(Math.max(0, Math.min(20000, a.km))) : s.fromKm;
      return { ok: true, events: ev };
    }
    case 'sleep': {
      if (s.ride) return fail('Not on a tomtom');
      if (!isNight(s)) return fail('You can sleep after 19:00');
      tickHours(s, hoursToMorning(s), ev); s.hour = 6; s.energy = ENERGY_MAX; break;
    }
    case 'meetGrandpa': {
      if (s.flags.metGrandpa) return fail('Already home');
      s.flags.metGrandpa = true; s.flags.arrived = true; break;
    }
    case 'giveBamboo': {
      if (s.flags.gariaDone) return fail('The pole is already up');
      if (s.inv.bamboo < 5) return fail('Rina needs 5 culms');
      s.inv.bamboo -= 5; s.flags.gariaDone = true; s.flags.gariaDay = s.day; s.flags.shawl = true; befriend(s, 'rina', 20); break;
    }
    case 'kharchi': {
      if (currentMission(s)?.id !== 'kharchi') return fail('Kharchi Puja is not on');
      if (s.inv.paddy < 3 || s.inv.pineapple < 2) return fail('The offering is 3 paddy and 2 pineapples');
      if (s.money < PRICES.bus) return fail('Not enough money for the bus');
      s.money -= PRICES.bus; s.inv.paddy -= 3; s.inv.pineapple -= 2; s.flags.kharchi = true; s.flags.blessed = true;
      tickHours(s, 2, ev); toast('The bus brings you back to Joynagar.', 'horn'); break;
    }
    case 'durga': {
      if (currentMission(s)?.id !== 'durga') return fail('Durga Puja is not on');
      if (s.hour < 18 && s.hour >= 5) return fail('The puja starts after dark');
      s.flags.durga = true; sfx('dhak'); break;
    }
    case 'pandal': {
      if (!pujoSeason(now)) return fail('The pandals come up for Durga Puja');
      const p = pandalById(String(a.id)); if (!p) return fail('No such pandal');
      if (s.pandals.includes(p.id)) return fail(`You have had darshan at ${p.name} already`);
      s.pandals = [...s.pandals, p.id]; s.energy = Math.min(ENERGY_MAX, s.energy + 8); s.stats.sights++;
      if (s.pandals.length >= PANDALS.length && !s.flags.pujoAllAt) s.flags.pujoAllAt = now; // for the 'first to see them all' board
      toast(`Darshan of Ma Durga at ${p.name} · prasad +8 energy · ${Math.min(s.pandals.length, PANDALS.length)} of ${PANDALS.length} pandals${s.pandals.length === PANDAL_GOAL ? ' · that makes five!' : ''}`, 'dhak'); break;
    }
    case 'anjali': {
      if (currentMission(s)?.id !== 'pujoAnjali') return fail('Anjali is offered on Ashtami morning');
      if (s.hour < ANJALI_HOURS[0] || s.hour >= ANJALI_HOURS[1]) return fail('Pushpanjali is offered in the morning, 06:00 to 12:00');
      s.flags.pujoAnjali = true; sfx('dhak'); break;
    }
    case 'aarti': {
      if (currentMission(s)?.id !== 'pujoAarti') return fail('The sandhya aarti is later in the Puja');
      if (s.hour < AARTI_FROM && s.hour >= 5) return fail('The aarti starts after 18:00');
      s.flags.pujoAarti = true; sfx('dhak'); break;
    }
    case 'bisarjan': {
      if (currentMission(s)?.id !== 'pujoBisarjan') return fail('Bisarjan is on Dashami, at the end of the Puja');
      if (s.hour < BISARJAN_FROM && s.hour >= 5) return fail('The procession reaches the ghat after 15:00');
      s.flags.pujoBisarjan = true; befriend(s, 'nKalibari', 10); sfx('dhak'); break;
    }
    case 'bijoya': {
      if (currentMission(s)?.id !== 'pujoBijoya') return fail('Bijoya greetings come after Dashami');
      if (!FRIENDABLE.includes(a.npc)) return fail('Nobody by that name');
      if (s.bijoya.includes(a.npc)) return fail('You have wished them already');
      if (s.inv.mishti < 1) return fail('Bring a box of mishti: the sweet shops by the Ramnagar and Palace Compound pandals have them');
      s.inv.mishti--; s.bijoya = [...s.bijoya, a.npc]; befriend(s, a.npc, 15);
      toast(`Shubho Bijoya! They hug you and press a rasgulla on you · +friendship · ${s.bijoya.length} of ${BIJOYA_GOAL}`, 'talk'); break;
    }
    case 'name': {
      const n = sanitizeName(a.name); if (n.length < 2) return fail('Pick a name of at least 2 letters');
      s.name = n; break;
    }
    case 'pos': {
      if (![a.x, a.z, a.face].every((v) => typeof v === 'number' && Number.isFinite(v))) return fail('Bad position');
      s.pos = { x: Math.max(AREA.x0, Math.min(AREA.x1, a.x)), z: Math.max(AREA.z0, Math.min(AREA.z1, a.z)), face: a.face };
      return { ok: true, events: ev };
    }

    /* ---------- tea, agar, fish, pump ---------- */
    case 'plant': {
      const list = a.kind === 'tea' ? s.tea : a.kind === 'agar' ? s.agar : null; if (!list) return fail('Plant what?');
      const t = int(a.i) ? list[a.i] : undefined; if (!t) return fail('No such spot');
      if (t.planted) return fail('Something is already growing here');
      const key = a.kind === 'tea' ? 'teaSapling' : 'agarSapling'; if (s.inv[key] < 1) return fail(a.kind === 'tea' ? 'No tea saplings · Gopal sells them' : 'No agar saplings · Gopal sells them');
      s.inv[key]--; t.planted = true; t.growth = 0; t.picked = 0; tire(); sfx('sow'); break;
    }
    case 'pluck': {
      const t = int(a.i) ? s.tea[a.i] : undefined; if (!t?.planted) return fail('No tea bush here');
      if (t.growth < TEA_NEED) return fail('The bush is still young');
      if (t.picked === s.day) return fail('Already plucked today');
      if (s.hour < PLUCK_FROM || s.hour >= PLUCK_UNTIL) return fail('Tea is plucked in the morning, 05:00 to 14:00');
      t.picked = s.day; s.inv.tea += TEA_PER_PLUCK; s.stats.tea += TEA_PER_PLUCK; tire(); toast(`+${TEA_PER_PLUCK} bundles of tea leaf: two leaves and a bud`, 'harvest'); break;
    }
    case 'fell': {
      const t = int(a.i) ? s.agar[a.i] : undefined; if (!t?.planted) return fail('No agar tree here');
      if (t.growth < AGAR_NEED) return fail('Agar takes a month to form its resin');
      t.planted = false; t.growth = 0; s.inv.agar += AGAR_PER_TREE; tire(); toast(`+${AGAR_PER_TREE} bags of agarwood chips. Dark, fragrant, and very valuable.`, 'harvest'); break;
    }
    case 'stock': {
      if (s.pond.stocked) return fail('The pukur is already stocked');
      if (s.inv.fingerling < 1) return fail('No fingerlings · buy a batch from Gopal');
      s.inv.fingerling--; s.pond = { stocked: true, growth: 0 }; tire(); toast('You tip a bucket of rohu and katla fingerlings into the pukur.', 'water'); break;
    }
    case 'net': {
      if (!s.pond.stocked) return fail('The pukur has no fish yet');
      if (s.pond.growth < FISH_NEED) return fail('The fish are still small');
      s.pond = { stocked: false, growth: 0 }; s.inv.fish += FISH_PER_NET; s.stats.fish += FISH_PER_NET; tire(); toast(`You haul the net: +${FISH_PER_NET} kg of rohu and katla`, 'harvest'); break;
    }
    case 'pump': {
      if (!s.pump) return fail('You have no pump set');
      if (s.pumpDay === s.day) return fail('You ran the pump today');
      if (s.money < PRICES.diesel) return fail(`Diesel costs ₹${PRICES.diesel}`);
      let n = 0; for (const p of s.plots) if (p.owned && p.crop && !p.watered && p.growth < NEED[p.crop]) { p.watered = true; n++; }
      if (!n) return fail('Every crop is watered already');
      s.money -= PRICES.diesel; s.pumpDay = s.day; tire(); toast(`The pump coughs into life and floods the channels: ${n} plot${n > 1 ? 's' : ''} watered`, 'water'); break;
    }

    /* ---------- crafts, kitchen, food ---------- */
    case 'craft': {
      if (s.inv.bamboo < 2) return fail('A basket takes 2 bamboo culms');
      s.inv.bamboo -= 2; s.inv.basket++; s.stats.baskets++; tire(); tickHours(s, 1, ev); toast('An hour of splitting and weaving: +1 cane basket', 'cut'); break;
    }
    case 'cook': {
      if (s.inv.paddy < 1) return fail('Pitha needs 1 sack of paddy for rice flour');
      if (s.money < PRICES.jaggery) return fail(`You need ₹${PRICES.jaggery} for jaggery`);
      s.inv.paddy--; s.money -= PRICES.jaggery; s.inv.pitha += PITHA_PER_COOK; tire(); tickHours(s, 1, ev); toast(`+${PITHA_PER_COOK} plates of pitha, warm from the pan`, 'harvest'); break;
    }
    case 'eat': {
      const st = stallById(a.stall), d = dishById(a.dish); if (!st || !d || !st.menu.includes(d.id)) return fail('They do not serve that here');
      const pujo = isPujoStall(st.id);
      if (pujo && !pujoSeason(now)) return fail('The Puja stalls come up for Durga Puja');
      // Puja stalls stay open late, like the pandals: 08:00 till 02:00
      if (pujo ? s.hour >= 2 && s.hour < 8 : s.hour < STALL_OPEN || s.hour >= STALL_CLOSE) return fail(pujo ? 'The Puja stalls open at 08:00 and stay open till 02:00.' : 'The stall is shut. It opens at 07:00.');
      if (s.money < d.price) return fail('Not enough money');
      if (d.takeaway) { s.money -= d.price; s.inv.mishti++; toast(`${d.name} · in your bag (${s.inv.mishti})`, 'coin'); break; }
      if (d.id === 'bhog' && s.flags.bhogDay === s.day) return fail('You have had bhog today. Come back tomorrow.');
      if (s.energy >= ENERGY_MAX) return fail('You are full');
      if (d.id === 'bhog') s.flags.bhogDay = s.day;
      s.money -= d.price; s.energy = Math.min(ENERGY_MAX, s.energy + d.energy); s.stats.meals++; toast(`${d.name}: +${d.energy} energy`, 'coin'); break;
    }

    /* ---------- people ---------- */
    case 'chat': {
      if (a.npc !== 'grandpa' && !FRIENDABLE.includes(a.npc)) return fail('Nobody by that name');
      const key = `${s.day}:${a.npc}`; if (s.chats.includes(key)) return { ok: true, events: ev };
      s.chats = [...s.chats, key].filter((c) => Number(c.split(':')[0]) >= s.day - 1).slice(-40);
      if (a.npc !== 'grandpa') befriend(s, a.npc, 2);
      const p = nextPhrase(s, a.npc);
      if (p) { s.phrases = [...s.phrases, p.id]; s.money += PHRASE_REWARD; ev.push({ kind: 'phrase', title: `${p.lang}: ${p.text}`, text: p.means, sfx: 'mission' }); }
      return { ok: true, events: ev };
    }
    case 'givePitha': {
      if (!FRIENDABLE.includes(a.npc)) return fail('Nobody by that name');
      if (!pithaSeason(s.day)) return fail('Pitha is for Poush and Magh');
      if (s.inv.pitha < 1) return fail('No pitha · cook some in the kitchen at home');
      const key = `${yearOf(s.day)}:${a.npc}`; if (s.pithaGiven.includes(key)) return fail('You already gave them pitha this year');
      s.inv.pitha--; s.pithaGiven = [...s.pithaGiven, key].slice(-40); befriend(s, a.npc, 15); toast('They take the plate with both hands. +friendship', 'talk');
      const given = s.pithaGiven.filter((k) => k.startsWith(`${yearOf(s.day)}:`)).length;
      if (given >= 3 && !kept(s, 'sankranti')) keepFest(s, 'sankranti', ev);
      break;
    }
    case 'attend': {
      const inv = inviteToday(s); if (!inv || inv.npc !== a.npc) return fail('No invitation from them today');
      if (s.hour < INVITE_FROM || s.hour >= INVITE_UNTIL) return fail('The invitation is for the evening, after 18:00');
      const key = `${s.day}:${a.npc}`; if (s.attended.includes(key)) return fail('You are already here');
      s.attended = [...s.attended, key].slice(-40); s.money += inv.gift.money; s.energy = Math.min(ENERGY_MAX, s.energy + inv.gift.energy); befriend(s, a.npc, 5);
      toast(`You stay late at ${inv.what}. Full of food${inv.gift.money ? ` and sent home with ₹${inv.gift.money}` : ''}.`, 'mission'); break;
    }
    case 'chapter': {
      const c = nextChapter(s); if (!c || c.id !== a.id) return fail('Grandpa has no new story yet');
      s.chapters = [...s.chapters, c.id]; s.money += CHAPTER_REWARD; ev.push({ kind: 'chapter', title: c.title, text: `A new page in Grandpa's album · +₹${CHAPTER_REWARD}`, sfx: 'mission' }); break;
    }

    /* ---------- festivals and trips ---------- */
    case 'fest': {
      const f = festById(a.id); if (!f || a.id === 'sankranti') return fail('No such festival');
      if (!isFestival(s.day, a.id)) return fail(`${f.name} is not on today`);
      if (kept(s, a.id)) return fail(`You have kept ${f.name} this year`);
      if (a.id === 'durga' && s.hour < 18 && s.hour >= 5) return fail('The puja starts after dark');
      if (a.id === 'diwali') { if (s.hour < 18 && s.hour >= 5) return fail('Lamps are floated after dark'); if (s.money < PRICES.lamp) return fail(`A diya costs ₹${PRICES.lamp}`); s.money -= PRICES.lamp; befriend(s, 'nKalibari', 5); }
      if (a.id === 'kharchiFair') {
        if (s.money < PRICES.bus) return fail(`The fair bus costs ₹${PRICES.bus}`);
        s.money -= PRICES.bus; tickHours(s, 3, ev);
        const prizes: [string, () => void][] = [
          ['You win the coconut shy: ₹150', () => { s.money += 150; }],
          ['A tea planter at the fair gives you 4 saplings', () => { s.inv.teaSapling += 4; }],
          ['You win a batch of fingerlings at the ring toss', () => { s.inv.fingerling += 1; }],
          ['Jalebi, a giant wheel ride and ₹80 from the lucky draw', () => { s.money += 80; s.energy = ENERGY_MAX; }],
          ['Your basket of pineapples wins a ribbon: ₹250', () => { s.money += 250; }],
        ];
        const [text, give] = prizes[Math.floor(rnd2(yearOf(s.day) * 7.7, s.day) * prizes.length)]; give(); toast(text, 'coin');
      }
      if (a.id === 'durga' || a.id === 'ker') sfx('dhak');
      keepFest(s, a.id, ev); break;
    }
    case 'trip': {
      const t = tripById(a.id); if (!t) return fail('No such trip');
      const why = tripOpen(s, t); if (why) return fail(why);
      let haat = 0; const sold: string[] = [];
      if (t.id === 'haat') {
        for (const [k, n] of Object.entries(a.sell || {}) as [ItemKey, number][]) {
          if (!HAAT_ITEMS.includes(k)) return fail(`The haat traders do not buy ${k}`);
          if (!int(n) || n < 0 || n > s.inv[k]) return fail('You do not have that many');
          if (n) { haat += haatPrice(k, s.day) * n; sold.push(`${n} ${ITEMS[k].name.toLowerCase()}`); }
        }
        if (!haat) return fail('Bring something to sell at the haat');
        for (const [k, n] of Object.entries(a.sell || {}) as [ItemKey, number][]) { s.inv[k] -= n; s.stats.sold[k] = (s.stats.sold[k] || 0) + n; }
      }
      s.money -= t.fare; tickHours(s, t.hours, ev);
      const first = !s.trips.includes(t.id);
      s.trips = [...s.trips.filter((x) => !x.startsWith(t.id + ':')), ...(first ? [t.id] : []), `${t.id}:${s.day}`].slice(-40); s.stats.trips++;
      if (t.id === 'neermahal') s.energy = ENERGY_MAX;
      if (t.id === 'sundari') { s.boostUntil = s.day + 3; toast(`The blessing is on your fields: crops grow faster until day ${s.boostUntil}.`); }
      if (haat) { earn(s, now, haat); toast(`Sold ${sold.join(', ')} at the haat for ₹${haat}`, 'coin'); }
      toast(`The bus brings you back to Joynagar at ${String(Math.floor(s.hour)).padStart(2, '0')}:${String(Math.floor((s.hour % 1) * 60)).padStart(2, '0')}.`, 'horn'); break;
    }
    case 'readInbox': { s.inbox = []; return { ok: true, events: ev }; }
    case 'rent': {
      const v = vehicleByKey(a.veh); if (!v || !RENTALS[a.at]?.includes(v.k)) return fail('Nothing like that to rent here');
      if (s.rental) return fail(`You are already renting a ${vehicleByKey(s.rental.veh)!.name.toLowerCase()}. Return it at any rental point first.`);
      if (kerClosed(s) && v.k !== 'cycle') return fail('Ker Puja: only bicycles are rented out until 18:00');
      const first = RENT_RATE[v.k]; if (s.money < first * 2) return fail(`You need at least ₹${first * 2} to rent a ${v.name.toLowerCase()}`);
      s.money -= first; s.rental = { veh: v.k, from: a.at, day: s.day, hour: s.hour };
      toast(`${v.name} rented: ₹${first} for the first hour, then ₹${first} an hour. Return it at any rental point.`, 'coin'); break;
    }
    case 'returnRental': {
      const r = s.rental; if (!r) return fail('You are not renting anything');
      if (!RENTALS[a.at]) return fail('Return it at a rental point, by any tomtom stand');
      const due = Math.max(0, rentalCost(s) - RENT_RATE[r.veh]); const paid = Math.min(s.money, due);
      s.money -= paid; s.rental = null;
      toast(`Returned the ${vehicleByKey(r.veh)!.name.toLowerCase()}. ₹${paid + RENT_RATE[r.veh]} in all${paid < due ? ' (you were short, and the man let it go)' : ''}.`, 'coin'); break;
    }
    case 'fare': {
      const v = vehicleByKey(a.veh); if (!v?.fares || !canFare(s, v.k as VehKey)) return fail('You need a rickshaw or a tomtom to carry passengers');
      const from = standByKey(a.from, s.home), to = standByKey(a.to, s.home); if (!from || !to || from.k === to.k) return fail('No such ride');
      if (s.fares.day !== s.day) s.fares = { day: s.day, n: 0, last: s.fares.last };
      if (s.fares.n >= FARES_PER_DAY) return fail('That is enough passengers for one day');
      const m = Math.hypot(from.x - to.x, from.z - to.z);
      if (now - s.fares.last < (m / FARE_MAX_SPEED) * 1000) return fail('Nobody could get there that fast');
      const pay = fareFor(m, v.fares); s.fares = { day: s.day, n: s.fares.n + 1, last: now }; earn(s, now, pay);
      toast(`The passenger hands over ₹${pay}. ${FARES_PER_DAY - s.fares.n} more fares today.`, 'coin'); break;
    }
    default: return fail('Unknown action');
  }
  checkMissions(s, ev);
  return { ok: true, events: ev };
}

function keepFest(s: GameState, id: FestId, ev: GameEvent[]): void {
  const f = festById(id)!; s.fests = [...s.fests, festKey(id, s.day)].slice(-60); s.stats.festivals++;
  if (f.reward) s.money += f.reward;
  ev.push({ kind: 'toast', title: f.name, text: `You kept ${f.name} this year${f.reward ? ` · +₹${f.reward}` : ''}.`, sfx: 'mission' });
}
