/**
 * Every change to money, land, crops and missions goes through apply().
 * The browser runs it optimistically; the server runs the same code on its own clock
 * and its answer is the truth. A tampered client gains nothing.
 */
import { CAN_BIG, ITEMS, LATEX_PER_SHEET, NEED, PRICES, TAP_FROM, TAP_UNTIL, YIELD, type BuyKey, type ItemKey } from './constants.js';
import { price } from './economy.js';
import { PLOTS } from './farm.js';
import { checkMissions, currentMission } from './missions.js';
import { dailyKaam } from './kaam.js';
import { SIGHT_REWARD, dailyDeliveries, deliveryById, sightById } from './errands.js';
import { normalizeHome, sanitizeName, sanitizePlace, type GameState, type Inventory } from './save.js';
import { rideMinutes, rideSeconds, standByKey } from './stands.js';
import { advance, finishRide, hoursToMorning, isNight, tickHours } from './time.js';

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
  | { t: 'name'; name: string }
  | { t: 'pos'; x: number; z: number; face: number };

export interface GameEvent { kind: 'toast' | 'day' | 'mission' | 'ending' | 'sfx'; text: string; title?: string; next?: string; sfx?: string }
export type Result = { ok: true; events: GameEvent[] } | { ok: false; err: string; events: GameEvent[] };

const ITEM_KEYS = Object.keys(ITEMS) as ItemKey[];
const BUY_KEYS: BuyKey[] = ['paddySeed', 'sucker', 'plot', 'bhar', 'cycle'];
const int = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

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

  switch (a.t) {
    case 'till': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      if (!q.p.owned) return fail('You do not own this plot');
      if (q.p.state !== 'grass') return fail('Already tilled');
      q.p.state = 'tilled'; sfx('till'); break;
    }
    case 'sow': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      if (!q.p.owned || q.p.state !== 'tilled' || q.p.crop) return fail('This plot is not ready to sow');
      const key: keyof Inventory = q.def.kind === 'lunga' ? 'paddySeed' : 'sucker';
      if (s.inv[key] < 1) return fail(q.def.kind === 'lunga' ? 'No paddy seed' : 'No pineapple suckers');
      s.inv[key]--; q.p.crop = q.def.kind === 'lunga' ? 'paddy' : 'pineapple'; q.p.growth = 0; q.p.watered = s.rain; sfx('sow'); break;
    }
    case 'water': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      if (!q.p.crop || q.p.watered || q.p.growth >= NEED[q.p.crop]) return fail('Nothing to water');
      if (s.inv.water < 1) return fail('The can is empty');
      s.inv.water--; q.p.watered = true; sfx('water'); break;
    }
    case 'harvest': {
      const q = plotAt(s, a.plot); if (!q) return fail('No such plot');
      const c = q.p.crop; if (!c || q.p.growth < NEED[c]) return fail('Not ripe yet');
      s.inv[c] += YIELD[c]; s.stats.harvest[c]++; q.p.crop = null; q.p.growth = 0; q.p.watered = false;
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
      t.tapped = s.day; s.inv.latex++; toast('+1 cup of latex', 'tap'); break;
    }
    case 'cut': {
      const b = int(a.clump) ? s.bamboo[a.clump] : undefined; if (!b) return fail('No such clump');
      if (b.ready > s.day) return fail('The clump is regrowing');
      b.ready = s.day + 2; s.inv.bamboo++; toast('+1 bamboo culm', 'cut'); break;
    }
    case 'pick': {
      const j = int(a.tree) ? s.jack[a.tree] : undefined; if (!j) return fail('No such tree');
      if (j.fruits < 1) return fail('No ripe jackfruit');
      j.fruits--; s.inv.jackfruit++; toast('+1 jackfruit', 'harvest'); break;
    }
    case 'roll': {
      const n = Math.floor(s.inv.latex / LATEX_PER_SHEET); if (n < 1) return fail('Not enough latex');
      s.inv.latex -= n * LATEX_PER_SHEET; s.inv.sheet += n; s.stats.sheets += n;
      toast(`+${n} rubber sheet${n > 1 ? 's' : ''} hung to dry`, 'till'); break;
    }
    case 'sell': {
      if (!ITEM_KEYS.includes(a.item)) return fail('Gopal does not buy that');
      if (!int(a.n) || a.n < 1 || a.n > s.inv[a.item]) return fail('You do not have that many');
      const p = price(a.item, s.day), got = p * a.n;
      s.inv[a.item] -= a.n; s.money += got; s.stats.earned += got; s.stats.sold[a.item] = (s.stats.sold[a.item] || 0) + a.n;
      toast(`Sold ${a.n} ${ITEMS[a.item].name.toLowerCase()} for ₹${got}`, 'coin'); break;
    }
    case 'buy': {
      if (!BUY_KEYS.includes(a.item)) return fail('Gopal does not sell that');
      const cost = PRICES[a.item]; if (s.money < cost) return fail('Not enough money');
      if (a.item === 'plot') { const i = s.plots.findIndex((p) => !p.owned); if (i < 0) return fail('You own the whole lunga'); s.plots[i].owned = true; toast('The plot is yours. Gopal\'s cousin hands over the patta.', 'coin'); }
      else if (a.item === 'bhar') { if (s.canMax >= CAN_BIG) return fail('You already have a bhar'); s.canMax = CAN_BIG; toast('A bamboo bhar: two cans on one shoulder pole.', 'coin'); }
      else if (a.item === 'cycle') { if (s.cycle) return fail('You already have a bicycle'); s.cycle = true; toast('A second-hand bicycle from Battala. Ride it home.', 'coin'); }
      else { s.inv[a.item]++; sfx('coin'); }
      s.money -= cost; break;
    }
    case 'ride': {
      if (s.ride) return fail('You are already on a tomtom');
      const from = standByKey(a.from, s.home), to = standByKey(a.to, s.home);
      if (!from || !to || from === to) return fail('No such tomtom route');
      const free = !!s.flags.freeRide;
      if (!free && s.money < PRICES.fare) return fail('Not enough money for the fare');
      if (free) s.flags.freeRide = false; else s.money -= PRICES.fare;
      s.ride = { from: from.k, to: to.k, start: now, ms: Math.round(rideSeconds(from, to) * 1000), hours: rideMinutes(from, to) / 60, done: 0 };
      toast(free ? `Grandpa paid the driver in advance. Off to ${to.name}!` : `₹${PRICES.fare} to the driver. Off to ${to.name}.`, 'horn');
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
      s.inv[k.item] -= k.qty; s.money += k.reward; s.stats.kaam++; s.kaamDone = [...s.kaamDone, k.id].slice(-30);
      toast(`+₹${k.reward} for helping out`, 'coin'); break;
    }
    case 'home': {
      if (s.ride) return fail('Get off the tomtom first');
      if (a.site === null) { s.home = null; toast('Home is the old house at the Bhati Abhoynagar fields.'); return { ok: true, events: ev }; }
      const h = normalizeHome(a.site); if (!h) return fail('That is not a place in Agartala');
      s.home = h; toast(`Home is now in ${h.name}.`); return { ok: true, events: ev };
    }
    case 'pickup': {
      const d = deliveryById(a.id); if (!d || !dailyDeliveries(s.day).some((x) => x.id === a.id)) return fail('No parcel waiting');
      if (s.carry) return fail('Your hands are full: deliver the parcel you have first');
      if (s.delivered.includes(d.id)) return fail('Already delivered today');
      s.carry = d.id; toast(`You take ${d.parcel}.`, 'talk'); break;
    }
    case 'deliver': {
      if (!s.carry || s.carry !== a.id) return fail('You are not carrying that');
      const d = deliveryById(a.id); s.carry = null; if (!d) return fail('That parcel has gone stale');
      s.money += d.reward; s.delivered = [...s.delivered, d.id].slice(-30); s.stats.deliveries++;
      toast(`Delivered ${d.parcel}. +₹${d.reward}`, 'coin'); break;
    }
    case 'visit': {
      const sight = sightById(a.id); if (!sight) return fail('No such place');
      if (s.visited.includes(sight.id)) return fail('You have seen it already');
      s.visited = [...s.visited, sight.id]; s.stats.sights++; s.money += SIGHT_REWARD;
      toast(`${sight.name} · ${s.visited.length} of 12 sights seen · +₹${SIGHT_REWARD}`, 'mission'); break;
    }
    case 'from': {
      const c = sanitizePlace(a.city); if (c.length < 2) return fail('Name your home town');
      s.from = c; s.fromKm = typeof a.km === 'number' && Number.isFinite(a.km) ? Math.round(Math.max(0, Math.min(20000, a.km))) : s.fromKm;
      return { ok: true, events: ev };
    }
    case 'sleep': {
      if (s.ride) return fail('Not on a tomtom');
      if (!isNight(s)) return fail('You can sleep after 19:00');
      tickHours(s, hoursToMorning(s), ev); s.hour = 6; break;
    }
    case 'meetGrandpa': {
      if (s.flags.metGrandpa) return fail('Already home');
      s.flags.metGrandpa = true; s.flags.arrived = true; break;
    }
    case 'giveBamboo': {
      if (s.flags.gariaDone) return fail('The pole is already up');
      if (s.inv.bamboo < 5) return fail('Rina needs 5 culms');
      s.inv.bamboo -= 5; s.flags.gariaDone = true; s.flags.gariaDay = s.day; s.flags.shawl = true; break;
    }
    case 'kharchi': {
      if (currentMission(s)?.id !== 'kharchi') return fail('Kharchi Puja is not on');
      if (s.inv.paddy < 3 || s.inv.pineapple < 2) return fail('The offering is 3 paddy and 2 pineapples');
      if (s.money < PRICES.bus) return fail('Not enough money for the bus');
      s.money -= PRICES.bus; s.inv.paddy -= 3; s.inv.pineapple -= 2; s.flags.kharchi = true; s.flags.blessed = true;
      tickHours(s, 2, ev); toast('The bus brings you back to Radhanagar.', 'horn'); break;
    }
    case 'durga': {
      if (currentMission(s)?.id !== 'durga') return fail('Durga Puja is not on');
      if (s.hour < 18 && s.hour >= 5) return fail('The puja starts after dark');
      s.flags.durga = true; sfx('dhak'); break;
    }
    case 'name': {
      const n = sanitizeName(a.name); if (n.length < 2) return fail('Pick a name of at least 2 letters');
      s.name = n; break;
    }
    case 'pos': {
      if (![a.x, a.z, a.face].every((v) => typeof v === 'number' && Number.isFinite(v))) return fail('Bad position');
      s.pos = { x: Math.max(-2100, Math.min(2100, a.x)), z: Math.max(-2050, Math.min(2450, a.z)), face: a.face };
      return { ok: true, events: ev };
    }
    default: return fail('Unknown action');
  }
  checkMissions(s, ev);
  return { ok: true, events: ev };
}
