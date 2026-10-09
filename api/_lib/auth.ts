/**
 * Sign-in without a third-party auth service. It runs on Cloudflare Workers, Vercel and Node,
 * using only Web Crypto and fetch.
 *
 *  - Google: standard OAuth 2.0 authorization-code flow. The signed `state` carries the farm
 *    being linked, and a nonce cookie ties the callback to the browser that started it.
 *  - Email: a signed, single-use link (15 minutes) sent through Resend.
 *
 * An account is stored as user:<provider>:<id> → { saveId }. Signing in on a new device
 * switches that device to the account's farm, so a farm follows its owner.
 */
import { createSession, loadByToken, loadSave, view, b64url, type Loaded } from './game.js';
import { getEnv } from './env.js';
import type { Store } from './store.js';

const enc = new TextEncoder();
const fromB64url = (s: string): Uint8Array => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };

function secret(): string {
  const s = getEnv().AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET is not set (use 32+ random characters)');
  return s;
}
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}
const safeEqual = (a: string, b: string): boolean => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/** A compact signed token: base64url(json).signature, with an expiry inside. */
export async function sign(payload: Record<string, unknown>, ttlSec: number): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })));
  return `${body}.${await hmac(body)}`;
}
export async function verify<T>(token: string | null): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split('.'); if (!body || !sig) return null;
  if (!safeEqual(sig, await hmac(body))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as T & { exp: number };
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
export const nonce = (): string => b64url(crypto.getRandomValues(new Uint8Array(16)));

export function authConfig() {
  const e = getEnv(); const ok = !!e.AUTH_SECRET && e.AUTH_SECRET.length >= 32;
  return { google: ok && !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET), email: ok && !!e.RESEND_API_KEY };
}

/**
 * Ties an account to a farm. If the account already owns a farm, that one wins and the device
 * gets a session for it; otherwise the farm being played becomes the account's.
 */
export async function linkAccount(store: Store, userKey: string, email: string, saveId: string | null, now: number): Promise<{ token: string; l: Loaded }> {
  const existing = await store.get<{ saveId: string }>(userKey);
  if (existing) {
    const l = await loadSave(store, existing.value.saveId, now); if (!l) throw new Error('Your farm is missing');
    if (email && l.doc.email !== email) { l.doc.email = email; const r = await store.put(`save:${l.saveId}`, l.doc, l.rev); if (r) l.rev = r; }
    return { token: await createSession(store, l.saveId), l };
  }
  const l = saveId ? await loadSave(store, saveId, now) : null;
  if (!l) throw new Error('Open the game first, then sign in');
  if (l.doc.userId && l.doc.userId !== userKey) throw new Error('This farm already belongs to another account');
  if (!(await store.put(userKey, { saveId: l.saveId }, null))) return linkAccount(store, userKey, email, saveId, now); // raced: someone just created it
  for (let i = 0; i < 4; i++) {
    l.doc.userId = userKey; l.doc.email = email || l.doc.email;
    const rev = await store.put(`save:${l.saveId}`, l.doc, l.rev);
    if (rev !== null) { l.rev = rev; break; }
    const fresh = await loadSave(store, l.saveId, now); if (!fresh) break; Object.assign(l, fresh);
  }
  return { token: await createSession(store, l.saveId), l };
}

/** The farm behind a bearer token, for starting a sign-in. */
export async function saveIdFor(store: Store, token: string | null, now: number): Promise<string | null> {
  return (await loadByToken(store, token, now))?.saveId || null;
}

/** After sign-in the browser comes back to the game with its new session in the URL fragment (never sent to servers). */
export const backToGame = (req: Request, token: string, note = ''): Response => {
  const u = new URL('/', req.url); u.hash = `auth=${token}${note ? `&note=${encodeURIComponent(note)}` : ''}`;
  return new Response(null, { status: 302, headers: { location: u.href, 'cache-control': 'no-store', 'set-cookie': clearCookie(req) } });
};
export const backWithError = (req: Request, msg: string): Response => {
  const u = new URL('/', req.url); u.hash = `autherr=${encodeURIComponent(msg)}`;
  return new Response(null, { status: 302, headers: { location: u.href, 'cache-control': 'no-store', 'set-cookie': clearCookie(req) } });
};

/* ---------- the nonce cookie that pins an OAuth round-trip to one browser ---------- */
const COOKIE = 'agt_oauth';
const secure = (req: Request) => (new URL(req.url).protocol === 'https:' ? '; Secure' : '');
export const setCookie = (req: Request, v: string) => `${COOKIE}=${v}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=600${secure(req)}`;
const clearCookie = (req: Request) => `${COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure(req)}`;
export const readCookie = (req: Request): string | null => {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)`));
  return m ? m[1] : null;
};

/* ---------- Google ---------- */
export const googleRedirectUri = (req: Request) => new URL('/api/auth-google-callback', req.url).href;

export function googleAuthUrl(req: Request, state: string): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({ client_id: getEnv().GOOGLE_CLIENT_ID!, redirect_uri: googleRedirectUri(req), response_type: 'code', scope: 'openid email', state, prompt: 'select_account' }).toString();
  return u.href;
}

export interface GoogleUser { sub: string; email: string }
/**
 * Swaps the code for tokens. The id_token comes straight from Google over TLS, so (per OpenID
 * Connect) checking its claims is enough without re-verifying the signature.
 */
export async function googleExchange(req: Request, code: string, fetcher: typeof fetch = fetch): Promise<GoogleUser> {
  const e = getEnv();
  const r = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: e.GOOGLE_CLIENT_ID!, client_secret: e.GOOGLE_CLIENT_SECRET!, redirect_uri: googleRedirectUri(req), grant_type: 'authorization_code' }).toString(),
  });
  if (!r.ok) throw new Error('Google did not accept the sign-in');
  const { id_token } = (await r.json()) as { id_token?: string };
  const part = id_token?.split('.')[1]; if (!part) throw new Error('Google sent no identity');
  const c = JSON.parse(new TextDecoder().decode(fromB64url(part))) as { sub?: string; email?: string; email_verified?: boolean; aud?: string; iss?: string; exp?: number };
  if (c.aud !== e.GOOGLE_CLIENT_ID || !['accounts.google.com', 'https://accounts.google.com'].includes(c.iss || '') || !c.exp || c.exp < Date.now() / 1000 || !c.sub) throw new Error('Google identity did not check out');
  return { sub: c.sub, email: c.email_verified ? c.email || '' : '' };
}

/* ---------- Email ---------- */
export const normEmail = (s: unknown): string | null => {
  const e = String(s || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
};

export async function sendEmailLink(to: string, link: string, fetcher: typeof fetch = fetch): Promise<void> {
  const e = getEnv();
  const r = await fetcher('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: e.EMAIL_FROM || 'Haora Bari <onboarding@resend.dev>', to: [to], subject: 'Your Haora Bari sign-in link',
      text: `Open this link within 15 minutes to sign in to Haora Bari, Agartala:\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
      html: `<p>Open this link within 15 minutes to sign in to <b>Haora Bari, Agartala</b>:</p><p><a href="${link}">Sign in</a></p><p style="color:#777">If you did not ask for this, ignore this email.</p>`,
    }),
  });
  if (!r.ok) throw new Error('The email could not be sent');
}

export { view };
