import { advance } from '../src/shared/time.js';
import { loadByToken, view } from './_lib/game.js';
import { bearer, fail, guard, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** GET /api/state with Authorization: Bearer <token>. Returns the save, with the game clock brought up to now. */
export const GET = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const token = bearer(req);
  const l = await loadByToken(store, token, now);
  if (!l || !token) return fail('Unknown session', 401);
  advance(l.doc.state, now);
  return json(view(token, l, store, now));
});
