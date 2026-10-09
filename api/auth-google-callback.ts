import { backToGame, backWithError, googleExchange, linkAccount, readCookie, verify } from './_lib/auth.js';
import { guard } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** GET /api/auth-google-callback?code&state: Google sends the browser back here. */
export const GET = guard(async (req) => {
  const u = new URL(req.url);
  if (u.searchParams.get('error')) return backWithError(req, 'Google sign-in was cancelled');
  const st = await verify<{ k: string; sid: string; n: string }>(u.searchParams.get('state'));
  if (!st || st.k !== 'g' || st.n !== readCookie(req)) return backWithError(req, 'That sign-in expired or came from another browser, please try again');
  const code = u.searchParams.get('code'); if (!code) return backWithError(req, 'Google sent no code');
  try {
    const g = await googleExchange(req, code);
    const r = await linkAccount(await getStore(), `user:google:${g.sub}`, g.email, st.sid, Date.now());
    return backToGame(req, r.token, g.email);
  } catch (e) { return backWithError(req, (e as Error).message); }
});
