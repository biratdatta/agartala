import { signinRequired } from './_lib/env.js';
import { authConfig, googleAuthUrl, nonce, normEmail, saveIdFor, sendEmailLink, setCookie, sign } from './_lib/auth.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';

const MAILS_PER_HOUR = 5;

/**
 * POST /api/auth-start  with Authorization: Bearer <session>
 *   (when sign-in is required, the session is optional: signing in with none creates the account's farm)
 *   { how: "google" }                → { url } to send the browser to Google
 *   { how: "email", email }          → emails a sign-in link
 */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const cfg = authConfig();
  const token = bearer(req);
  const saveId = await saveIdFor(store, token, now);
  if (!saveId && (token || !signinRequired())) return fail('Unknown session', 401);
  const body = (await readJson<{ how?: string; email?: string }>(req)) || {};

  if (body.how === 'google') {
    if (!cfg.google) return fail('Google sign-in is not set up on this server', 501);
    const n = nonce();
    const state = await sign({ k: 'g', sid: saveId || '', n }, 600);
    return new Response(JSON.stringify({ url: googleAuthUrl(req, state) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': setCookie(req, n) } });
  }

  if (body.how === 'email') {
    if (!cfg.email) return fail('Email sign-in is not set up on this server', 501);
    const email = normEmail(body.email); if (!email) return fail('Enter a valid email address');
    const bucket = `mail:${saveId || email}:${Math.floor(now / 3600e3)}`;
    const used = await store.get<{ n: number }>(bucket);
    if ((used?.value.n || 0) >= MAILS_PER_HOUR) return fail('Too many emails this hour, try again later', 429);
    await store.put(bucket, { n: (used?.value.n || 0) + 1 }, used ? used.rev : null);
    const t = await sign({ k: 'e', sid: saveId || '', email, n: nonce() }, 900);
    await sendEmailLink(email, new URL(`/api/auth-email-callback?t=${encodeURIComponent(t)}`, req.url).href);
    return json({ ok: true, message: `Check ${email} for a sign-in link.` });
  }
  return fail('Send { how: "google" } or { how: "email", email }');
});
