import { createGuest, createSession, ensureVisitCode, geoFrom, loadByToken, loadSave, normCode, view } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/**
 * POST /api/session
 *   Authorization: Bearer <token>   → returns that farm
 *   body { code: "ABCD-2345" }       → restores a farm on this device by its code
 *   neither                          → creates a new guest farm
 */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const geo = geoFrom(req);
  const body = (await readJson<{ code?: string }>(req)) || {};
  if (body.code) {
    const c = await store.get<{ saveId: string }>(`code:${normCode(body.code)}`);
    if (!c) return fail('No farm has that code', 404);
    const l = await loadSave(store, c.value.saveId, now); if (!l) return fail('That farm is missing', 404);
    const token = await createSession(store, l.saveId); await ensureVisitCode(store, l.saveId);
    return json(view(token, l, store, now));
  }
  const token = bearer(req);
  const l = await loadByToken(store, token, now);
  if (l && token) { await ensureVisitCode(store, l.saveId); return json(view(token, l, store, now, geo)); }
  const g = await createGuest(store, now, geo); await ensureVisitCode(store, g.loaded.saveId);
  return json(view(g.token, g.loaded, store, now, geo), 201);
});
