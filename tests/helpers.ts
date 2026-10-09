import { DAY_SECONDS } from '../src/shared/constants.js';
import { apply, type Action } from '../src/shared/rules.js';
import { newState, type GameState } from '../src/shared/save.js';

export const T0 = Date.UTC(2026, 9, 8, 6, 0, 0);
/** Real milliseconds for `h` game hours. */
export const msFor = (h: number) => (h / 24) * DAY_SECONDS * 1000;

/** A tiny driver that keeps its own clock. */
export function game(start = newState(T0)) {
  const s: GameState = start; let now = start.ts;
  return {
    s,
    get now() { return now; },
    wait(h: number) { now += msFor(h); },
    do(a: Action) { const r = apply(s, a, now); return r; },
    ok(a: Action) { const r = apply(s, a, now); if (!r.ok) throw new Error(`${a.t} failed: ${r.err}`); return r; },
    /** Sets the clock so the game reads this hour on the current or next day. */
    at(hour: number) { const cur = s.hour; const d = hour >= cur ? hour - cur : 24 - cur + hour; now += msFor(d); apply(s, { t: 'pos', x: s.pos.x, z: s.pos.z, face: 0 }, now); },
  };
}
