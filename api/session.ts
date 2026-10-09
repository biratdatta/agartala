import { createFarm, createGuest, createSession, ensureVisitCode, geoFrom, loadByToken, loadSave, normCode, view } from './_lib/game.js';
import { signinRequired } from './_lib/env.js';
import { bearer, fail, guard, json, needSignin, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/**
 * POST /api/session
 *   Authorization: Bearer <token>   → returns that farm
 *   body { code: "ABCD-2345" }       → restores a farm on this device by its code
 *   body { reset: true } + Bearer    → starts a fresh farm (a signed-in player keeps their account)
 *   neither                          → creates a new guest farm
 * With sign-in required (REQUIRE_SIGNIN=1), only signed-in farms are served: no guests, no codes.
 */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const geo = geoFrom(req);
  const body = (await readJson<{ code?: string; reset?: boolean }>(req)) || {};
  const required = signinRequired();
  if (body.code) {
    if (required) return needSignin();
    const c = await store.get<{ saveId: string }>(`code:${normCode(body.code)}`);
    if (!c) return fail('No farm has that code', 404);
    const l = await loadSave(store, c.value.saveId, now); if (!l) return fail('That farm is missing', 404);
    const token = await createSession(store, l.saveId); await ensureVisitCode(store, l.saveId);
    return json(view(token, l, store, now));
  }
  const token = bearer(req);
  const l = await loadByToken(store, token, now);
  if (body.reset && l?.doc.userId) {
    // New farm for the same account: point the account at it.
    const userKey = l.doc.userId;
    const acct = await store.get<{ saveId: string }>(userKey);
    const nl = await createFarm(store, now, geo, { userId: userKey, email: l.doc.email || '', realName: l.doc.realName });
    if (acct && (await store.put(userKey, { saveId: nl.saveId }, acct.rev)) === null) return fail('Try again', 409);
    const t = await createSession(store, nl.saveId); await ensureVisitCode(store, nl.saveId);
    return json(view(t, nl, store, now, geo), 201);
  }
  if (l && token && !body.reset) { await ensureVisitCode(store, l.saveId); return json(view(token, l, store, now, geo)); }
  if (required) return needSignin();
  const g = await createGuest(store, now, geo); await ensureVisitCode(store, g.loaded.saveId);
  return json(view(g.token, g.loaded, store, now, geo), 201);
});
