import { bearer, guard, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/**
 * POST /api/auth-signout  with Authorization: Bearer <session>
 * Ends this device's session: the token stops working everywhere. The farm and the account stay.
 */
export const POST = guard(async (req) => {
  const token = bearer(req); if (!token) return json({ ok: true });
  const store = await getStore(); const key = `session:${token}`;
  for (let i = 0; i < 3; i++) {
    const s = await store.get<{ saveId: string; revoked?: number }>(key); if (!s || s.value.revoked) break;
    if ((await store.put(key, { ...s.value, revoked: Date.now() }, s.rev)) !== null) break;
  }
  return json({ ok: true });
});
