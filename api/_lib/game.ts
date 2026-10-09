import { netWorth } from '../../src/shared/economy.js';
import { newState, normalize, type GameState } from '../../src/shared/save.js';
import { AGARTALA, haversineKm } from '../../src/shared/geo.js';
import { weekId } from '../../src/shared/week.js';
import { paraAt } from '../../src/shared/area.js';
import { HOME } from '../../src/shared/farm.js';
import type { Store } from './store.js';
import { signinRequired } from './env.js';

/** What is stored under save:<id>. The game state plus account bookkeeping. */
export interface SaveDoc { state: GameState; code: string; userId?: string; email?: string; created: number }
export interface Loaded { saveId: string; doc: SaveDoc; rev: number }

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));
export const b64url = (b: Uint8Array): string => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const newToken = (): string => b64url(randomBytes(32));
const randomUUID = (): string => crypto.randomUUID();
export function newCode(): string {
  const b = randomBytes(8); let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}
export const normCode = (c: string): string => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');

export async function createSession(store: Store, saveId: string): Promise<string> {
  const token = newToken();
  await store.put(`session:${token}`, { saveId, created: Date.now() }, null);
  return token;
}

export interface Geo { city: string; country: string; km: number }

/** A brand-new farm (no session yet). */
export async function createFarm(store: Store, now: number, geo?: Geo | null, owner?: { userId: string; email: string }): Promise<Loaded> {
  const saveId = randomUUID();
  let code = newCode();
  for (let i = 0; i < 5 && !(await store.put(`code:${code}`, { saveId }, null)); i++) code = newCode();
  const doc: SaveDoc = { state: newState(now, '', geo?.city || '', geo?.km || 0), code, created: now, ...(owner ? { userId: owner.userId, email: owner.email } : {}) };
  await store.put(`save:${saveId}`, doc, null);
  return { saveId, doc, rev: 1 };
}

export async function createGuest(store: Store, now: number, geo?: Geo | null): Promise<{ token: string; loaded: Loaded }> {
  const loaded = await createFarm(store, now, geo);
  return { token: await createSession(store, loaded.saveId), loaded };
}

export async function loadSave(store: Store, saveId: string, now: number): Promise<Loaded | null> {
  const e = await store.get<SaveDoc>(`save:${saveId}`);
  if (!e) return null;
  e.value.state = normalize(e.value.state, now);
  return { saveId, doc: e.value, rev: e.rev };
}

/**
 * The farm behind a session token. When sign-in is required, a guest (not signed-in) farm counts
 * as no session, so every endpoint refuses it; pass { guest: true } only for linking it to an account.
 */
export async function loadByToken(store: Store, token: string | null, now: number, opts: { guest?: boolean } = {}): Promise<Loaded | null> {
  if (!token) return null;
  const s = await store.get<{ saveId: string; revoked?: number }>(`session:${token}`);
  const l = s && !s.value.revoked ? await loadSave(store, s.value.saveId, now) : null; // signed-out sessions are dead
  if (l && !l.doc.userId && !opts.guest && signinRequired()) return null;
  return l;
}

/** A farm's public id: safe to show other players (never the session token or farm code). */
export const publicId = (saveId: string): string => saveId.replace(/-/g, '').slice(0, 8).toUpperCase();
/** The visit code friends type to find your farm: the public id as XXXX-XXXX. */
export const visitCode = (saveId: string): string => publicId(saveId).replace(/^(.{4})(.{4})$/, '$1-$2');
export const normVisit = (c: string): string => String(c).toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8);
/** Remembers the visit code for a farm, so friends can find it. Cheap no-op once it exists. */
export async function ensureVisitCode(store: Store, saveId: string): Promise<void> {
  await store.put(`pid:${publicId(saveId)}`, { saveId }, null);
}
export async function loadByVisitCode(store: Store, code: string, now: number): Promise<Loaded | null> {
  const p = await store.get<{ saveId: string }>(`pid:${normVisit(code)}`);
  return p ? loadSave(store, p.value.saveId, now) : null;
}
/** The neighbourhood a farm plays for on the para board. */
export const paraOf = (s: GameState): string => (s.home ? paraAt(s.home.x, s.home.z) : paraAt(HOME.x, HOME.z));

export async function updateLeaderboard(store: Store, saveId: string, s: GameState, now = Date.now()): Promise<void> {
  const named = !!s.name && s.name.length >= 2;
  if (named) await store.lbUpsert({ id: saveId, name: s.name, worth: netWorth(s), day: s.day });
  const w = s.week; if (w.id === weekId(now)) await store.weekUpsert({ id: publicId(saveId), week: w.id, name: named ? s.name : '', para: paraOf(s), paddy: w.paddy, deliveries: w.deliveries, kaam: w.kaam, sights: w.sights, earned: w.earned });
}

/** The public view of a save sent to the browser. */
export const view = (token: string, l: Loaded, store: Store, now: number, geo: Geo | null = null) => ({
  token, code: l.doc.code, visit: visitCode(l.saveId), pid: publicId(l.saveId), signedIn: !!l.doc.userId, email: l.doc.userId ? l.doc.email || '' : '', state: l.doc.state, rev: l.rev, serverNow: now, store: store.name, geo,
});

/**
 * Where the player is logging in from: Cloudflare's request.cf, or Vercel's IP geolocation
 * headers. Neither exists in local dev, so the player picks a city there.
 */
export function geoFrom(req: Request): Geo | null {
  const cf = (req as Request & { cf?: { city?: string; country?: string; latitude?: string; longitude?: string } }).cf;
  if (cf?.city) {
    const lat = Number(cf.latitude), lon = Number(cf.longitude);
    return { city: cf.city, country: cf.country || '', km: Number.isFinite(lat) && Number.isFinite(lon) ? Math.round(haversineKm(lat, lon, AGARTALA.lat, AGARTALA.lon)) : 0 };
  }
  const h = req.headers; const raw = h.get('x-vercel-ip-city'); if (!raw) return null;
  let city = raw; try { city = decodeURIComponent(raw); } catch { /* keep raw */ }
  const lat = Number(h.get('x-vercel-ip-latitude')), lon = Number(h.get('x-vercel-ip-longitude'));
  const km = Number.isFinite(lat) && Number.isFinite(lon) ? Math.round(haversineKm(lat, lon, AGARTALA.lat, AGARTALA.lon)) : 0;
  return { city, country: h.get('x-vercel-ip-country') || '', km };
}
