/**
 * Playing alongside other people: visiting a friend's farm by its visit code, watering their
 * crops, sending them a gift. Each change to someone else's save is compare-and-set like any
 * other, and they find a note about it the next time they play.
 */
import { ITEMS, NEED, type ItemKey } from '../../src/shared/constants.js';
import { netWorth } from '../../src/shared/economy.js';
import { advance } from '../../src/shared/time.js';
import { loadSave, paraOf, visitCode, type Loaded, type SaveDoc } from './game.js';
import { HttpError } from './http.js';
import type { Store } from './store.js';

/** What a visitor may see of a farm. */
export function farmSummary(l: Loaded) {
  const s = l.doc.state; const owned = s.plots.filter((p) => p.owned);
  return {
    visit: visitCode(l.saveId), name: s.name || 'An unnamed farm', para: paraOf(s), day: s.day, worth: netWorth(s),
    plots: owned.length, planted: owned.filter((p) => p.crop).length,
    thirsty: owned.filter((p) => p.crop && !p.watered && p.growth < NEED[p.crop]).length,
    ripe: owned.filter((p) => p.crop && p.growth >= NEED[p.crop]).length,
    tea: s.tea.filter((t) => t.planted).length, pond: s.pond.stocked, sights: s.visited.length, festivals: s.stats.festivals,
  };
}

/** Loads a save, lets `fn` change it, and writes it back, retrying if someone else saved first. */
export async function mutate(store: Store, saveId: string, now: number, fn: (doc: SaveDoc) => string | null): Promise<Loaded> {
  for (let i = 0; i < 4; i++) {
    const l = await loadSave(store, saveId, now); if (!l) throw new HttpError('That farm is missing', 404);
    advance(l.doc.state, now);
    const err = fn(l.doc); if (err) throw new HttpError(err, 400);
    const rev = await store.put(`save:${saveId}`, l.doc, l.rev);
    if (rev !== null) { l.rev = rev; return l; }
  }
  throw new HttpError('The farm is busy, try again', 409);
}

export const note = (doc: SaveDoc, now: number, text: string) => { doc.state.inbox = [...doc.state.inbox, { t: now, text: text.slice(0, 160) }].slice(-10); };
export const giftable = (k: string): k is ItemKey => k in ITEMS;
export const utcDay = (ms: number) => Math.floor(ms / 864e5);
export const HELP_PAY = 20;
