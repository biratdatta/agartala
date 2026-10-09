import { apply, type Action, type GameEvent } from '../src/shared/rules.js';
import { loadByToken, updateLeaderboard, view } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';

const MAX_ACTIONS = 60;

/**
 * POST /api/act  { actions: Action[] }  with Authorization: Bearer <token>
 * Re-checks every move with the same rules the browser used, on the server's clock,
 * and stops at the first one that fails. Saves are compare-and-set on `rev`, so two
 * devices playing at once never lose moves: on a conflict the batch is replayed on the newer save.
 */
export const POST = guard(async (req) => {
  const store = await getStore(); const token = bearer(req);
  const body = await readJson<{ actions?: Action[] }>(req);
  if (!body || !Array.isArray(body.actions)) return fail('Send { actions: [...] }');
  if (body.actions.length > MAX_ACTIONS) return fail(`At most ${MAX_ACTIONS} actions per batch`);
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now();
    const l = await loadByToken(store, token, now);
    if (!l || !token) return fail('Unknown session', 401);
    const s = l.doc.state; const events: GameEvent[] = []; let applied = 0; let rejected: { index: number; err: string } | undefined;
    for (const a of body.actions) {
      const r = apply(s, a, now); events.push(...r.events);
      if (!r.ok) { rejected = { index: applied, err: r.err }; break; }
      applied++;
    }
    const rev = await store.put(`save:${l.saveId}`, l.doc, l.rev);
    if (rev === null) continue; // someone else saved first; replay on the fresh copy
    l.rev = rev;
    if (applied) await updateLeaderboard(store, l.saveId, s, now).catch((e) => console.error('[leaderboard]', e));
    return json({ ...view(token, l, store, now), applied, rejected, events });
  }
  return fail('The save is busy, try again', 409);
});
