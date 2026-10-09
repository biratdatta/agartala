import { tickHours } from '../src/shared/time.js';
import { loadByToken, view } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';
import { deployed } from './_lib/env.js';

/** POST /api/dev { hours } skips game time for testing. Returns 404 on any deployed environment. */
export const POST = guard(async (req) => {
  if (deployed()) return fail('Not found', 404);
  const store = await getStore(); const now = Date.now(); const token = bearer(req);
  const body = (await readJson<{ hours?: number }>(req)) || {};
  const l = await loadByToken(store, token, now); if (!l || !token) return fail('Unknown session', 401);
  const hours = Math.max(0, Math.min(24 * 7, Number(body.hours) || 0));
  tickHours(l.doc.state, hours); l.doc.state.ts = now;
  const rev = await store.put(`save:${l.saveId}`, l.doc, l.rev); if (rev === null) return fail('Busy', 409);
  l.rev = rev;
  return json(view(token, l, store, now));
});
