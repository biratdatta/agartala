import { AGAR_NEED, BLESSING, DAY_SECONDS, ENERGY_MAX, ENERGY_PER_HOUR, FISH_NEED, ITEMS, MAX_CATCHUP_DAYS, MONTHS, MONTH_DAYS, NEED, RAIN_CHANCE, SPOIL, TEA_NEED, YIELD, type ItemKey } from './constants.js';
import { demandOf, monthOf } from './economy.js';
import { festivalsOn } from './festivals.js';
import { rnd2 } from './rng.js';
import type { GameState } from './save.js';
import type { GameEvent } from './rules.js';
import { standByKey } from './stands.js';
import { checkMissions } from './missions.js';

export const isNight = (s: GameState): boolean => s.hour >= 19 || s.hour < 5;
export const hoursPerMs = 24 / (DAY_SECONDS * 1000);

/** Monsoon months (Asharh, Srabon): heavy rain can flood the low lunga. */
export const isMonsoon = (day: number): boolean => { const m = monthOf(day); return m === 2 || m === 3; };
export const BOOST = 1.25, FLOOD_PADDY = 1.5;

function newDay(s: GameState, ev: GameEvent[]): void {
  s.day++;
  const m = monthOf(s.day);
  s.rain = rnd2(s.day, 41.3) < RAIN_CHANCE[m];
  s.flood = s.rain && isMonsoon(s.day) && rnd2(s.day, 77.7) < 0.5;
  if (s.flood) s.flags.sawFlood = true;
  for (const p of s.plots) p.watered = !!(s.rain && p.crop);
  // your selling pressure on the bazar fades
  for (const k of Object.keys(s.market) as ItemKey[]) { const v = (s.market[k] || 0) * 0.6; if (v < 0.5) delete s.market[k]; else s.market[k] = Math.round(v * 10) / 10; }
  // produce goes off overnight without a cold store
  if (!s.coldStore) {
    const lost: string[] = [];
    for (const [k, rate] of Object.entries(SPOIL) as [ItemKey, number][]) { const n = Math.floor(s.inv[k] * rate); if (n > 0) { s.inv[k] -= n; lost.push(`${n} ${ITEMS[k].name.toLowerCase()}`); } }
    if (lost.length) ev.push({ kind: 'toast', text: `Overnight, ${lost.join(' and ')} went off. A cold store would keep them.` });
  }
  // a hired hand waters every crop at dawn and brings in what is ripe
  if (s.helperUntil >= s.day) {
    let watered = 0, picked = 0;
    for (const p of s.plots) {
      if (!p.owned || !p.crop) continue;
      if (p.growth >= NEED[p.crop]) { s.inv[p.crop] += YIELD[p.crop]; s.stats.harvest[p.crop]++; p.crop = null; p.growth = 0; p.watered = false; picked++; continue; }
      if (!p.watered) { p.watered = true; watered++; }
    }
    if (watered || picked) ev.push({ kind: 'toast', text: `Your hired hand ${[watered ? `watered ${watered} plot${watered > 1 ? 's' : ''}` : '', picked ? `harvested ${picked}` : ''].filter(Boolean).join(' and ')} at dawn.` });
    if (s.helperUntil === s.day) ev.push({ kind: 'toast', text: "Today is your hired hand's last day. Hire them again at Gopal's." });
  }
  if (m <= 4) for (const j of s.jack) j.fruits = Math.min(3, j.fruits + 1);
  s.kaamDone = s.kaamDone.filter((id) => Number(id.split(':')[0]) >= s.day - 2);
  s.delivered = s.delivered.filter((id) => Number(id.split(':')[0]) >= s.day - 2);
  const first = (s.day - 1) % MONTH_DAYS === 0;
  ev.push({ kind: 'day', text: `Day ${s.day} · ${first ? 'a new month, ' : ''}${MONTHS[m]}${s.flood ? ' · the lunga is flooded: paddy loves it, but the roads are mud' : s.rain ? (m <= 1 ? ' · Kalbaishakhi storms, the rain waters the fields' : ' · rain today waters the fields') : ''}` });
  for (const f of festivalsOn(s.day)) ev.push({ kind: 'toast', title: f.name, text: f.how });
  const d = demandOf(s.day); ev.push({ kind: 'toast', text: `At the bazar: traders are buying ${ITEMS[d].name.toLowerCase()} today, 30% above the usual rate.` });
}

/** Moves the game clock forward by `dh` game hours in quarter-hour steps, growing watered crops. */
export function tickHours(s: GameState, dh: number, ev: GameEvent[] = []): void {
  while (dh > 1e-9) {
    const st = Math.min(0.25, dh);
    const mult = (s.flags.blessed ? BLESSING : 1) * (s.boostUntil >= s.day ? BOOST : 1);
    for (const p of s.plots) if (p.crop && p.watered && p.growth < NEED[p.crop]) p.growth = Math.min(NEED[p.crop], p.growth + st * mult * (s.flood && p.crop === 'paddy' ? FLOOD_PADDY : 1));
    for (const t of s.tea) if (t.planted && t.growth < TEA_NEED) t.growth = Math.min(TEA_NEED, t.growth + st);
    for (const t of s.agar) if (t.planted && t.growth < AGAR_NEED) t.growth = Math.min(AGAR_NEED, t.growth + st);
    if (s.pond.stocked && s.pond.growth < FISH_NEED) s.pond.growth = Math.min(FISH_NEED, s.pond.growth + st * (isMonsoon(s.day) ? 1.5 : 1));
    s.energy = Math.min(ENERGY_MAX, s.energy + st * ENERGY_PER_HOUR);
    s.hour += st;
    if (s.hour >= 24) { s.hour -= 24; newDay(s, ev); }
    dh -= st;
  }
}

/** Ends a tomtom ride: books any ride time not yet counted and puts the player at the stand. */
export function finishRide(s: GameState, ev: GameEvent[]): void {
  const r = s.ride; if (!r) return;
  tickHours(s, Math.max(0, r.hours - r.done), ev);
  const to = standByKey(r.to, s.home); if (to) s.pos = { x: to.x, z: to.z, face: s.pos.face };
  if (r.to === 'stHome') s.flags.arrived = true;
  s.stats.rides++; s.ride = null;
  ev.push({ kind: 'toast', text: `The tomtom drops you at ${to ? to.name : 'the stand'}.`, sfx: 'horn' });
}

/**
 * Brings the game clock up to real time `now`. While riding, the real seconds of the ride
 * count as the ride's game time, not the usual rate. Offline time is capped at MAX_CATCHUP_DAYS.
 */
export function advance(s: GameState, now: number, ev: GameEvent[] = []): void {
  if (!(now > s.ts)) return;
  const r = s.ride;
  if (r) {
    const end = r.start + r.ms;
    const pre = Math.max(0, Math.min(now, r.start) - s.ts);
    if (pre > 0) tickHours(s, pre * hoursPerMs, ev);
    const a = Math.max(s.ts, r.start), b = Math.min(now, end);
    if (b > a) { const h = ((b - a) / r.ms) * r.hours; tickHours(s, h, ev); r.done = Math.min(r.hours, r.done + h); }
    if (now >= end) { finishRide(s, ev); checkMissions(s, ev); const post = now - Math.max(end, s.ts); if (post > 0) tickHours(s, Math.min(post * hoursPerMs, MAX_CATCHUP_DAYS * 24), ev); }
    s.ts = now; return;
  }
  tickHours(s, Math.min((now - s.ts) * hoursPerMs, MAX_CATCHUP_DAYS * 24), ev);
  s.ts = now;
}

/** Game hours from now until 06:00 next morning (or this morning, before 05:00). */
export const hoursToMorning = (s: GameState): number => (s.hour >= 6 ? 24 - s.hour + 6 : 6 - s.hour);
