import { backToGame, backWithError, linkAccount, verify } from './_lib/auth.js';
import { geoFrom } from './_lib/game.js';
import { guard } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** GET /api/auth-email-callback?t=<signed link>: opened from the sign-in email. Each link works once. */
export const GET = guard(async (req) => {
  const p = await verify<{ k: string; sid: string; email: string; n: string }>(new URL(req.url).searchParams.get('t'));
  if (!p || p.k !== 'e' || !p.email) return backWithError(req, 'That sign-in link has expired, ask for a new one');
  const store = await getStore();
  if (!(await store.put(`used:${p.n}`, { at: Date.now() }, null))) return backWithError(req, 'That sign-in link was already used');
  try {
    const r = await linkAccount(store, `user:email:${p.email}`, p.email, p.sid || null, Date.now(), geoFrom(req));
    return backToGame(req, r.token, p.email);
  } catch (e) { return backWithError(req, (e as Error).message); }
});
