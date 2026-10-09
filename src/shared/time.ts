import { BLESSING, DAY_SECONDS, MAX_CATCHUP_DAYS, MONTHS, MONTH_DAYS, NEED, RAIN_CHANCE } from './constants.js';
import { monthOf } from './economy.js';
import { rnd2 } from './rng.js';
import type { GameState } from './save.js';
import type { GameEvent } from './rules.js';
import { standByKey } from './stands.js';
import { checkMissions } from './missions.js';

export const isNight = (s: GameState): boolean => s.hour >= 19 || s.hour < 5;
export const hoursPerMs = 24 / (DAY_SECONDS * 1000);

function newDay(s: GameState, ev: GameEvent[]): void {
  s.day++;
  const m = monthOf(s.day);
  s.rain = rnd2(s.day, 41.3) < RAIN_CHANCE[m];
  for (const p of s.plots) p.watered = !!(s.rain && p.crop);
  if (m <= 4) for (const j of s.jack) j.fruits = Math.min(3, j.fruits + 1);
  s.kaamDone = s.kaamDone.filter((id) => Number(id.split(':')[0]) >= s.day - 2);
  s.delivered = s.delivered.filter((id) => Number(id.split(':')[0]) >= s.day - 2);
  const first = (s.day - 1) % MONTH_DAYS === 0;
  ev.push({ kind: 'day', text: `Day ${s.day} · ${first ? 'a new month, ' : ''}${MONTHS[m]}${s.rain ? (m <= 1 ? ' · Kalbaishakhi storms, the rain waters the fields' : ' · rain today waters the fields') : ''}` });
}

/** Moves the game clock forward by `dh` game hours in quarter-hour steps, growing watered crops. */
export function tickHours(s: GameState, dh: number, ev: GameEvent[] = []): void {
  const mult = s.flags.blessed ? BLESSING : 1;
  while (dh > 1e-9) {
    const st = Math.min(0.25, dh);
    for (const p of s.plots) if (p.crop && p.watered && p.growth < NEED[p.crop]) p.growth = Math.min(NEED[p.crop], p.growth + st * mult);
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
