import { netWorth } from '../../src/shared/economy.js';
import { newState, normalize, type GameState } from '../../src/shared/save.js';
import { AGARTALA, haversineKm } from '../../src/shared/geo.js';
import type { Store } from './store.js';

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

export async function createGuest(store: Store, now: number, geo?: Geo | null): Promise<{ token: string; loaded: Loaded }> {
  const saveId = randomUUID();
  let code = newCode();
  for (let i = 0; i < 5 && !(await store.put(`code:${code}`, { saveId }, null)); i++) code = newCode();
  const doc: SaveDoc = { state: newState(now, '', geo?.city || '', geo?.km || 0), code, created: now };
  await store.put(`save:${saveId}`, doc, null);
  const token = await createSession(store, saveId);
  return { token, loaded: { saveId, doc, rev: 1 } };
}

export async function loadSave(store: Store, saveId: string, now: number): Promise<Loaded | null> {
  const e = await store.get<SaveDoc>(`save:${saveId}`);
  if (!e) return null;
  e.value.state = normalize(e.value.state, now);
  return { saveId, doc: e.value, rev: e.rev };
}

export async function loadByToken(store: Store, token: string | null, now: number): Promise<Loaded | null> {
  if (!token) return null;
  const s = await store.get<{ saveId: string }>(`session:${token}`);
  return s ? loadSave(store, s.value.saveId, now) : null;
}

export async function updateLeaderboard(store: Store, saveId: string, s: GameState): Promise<void> {
  if (!s.name || s.name.length < 2) return;
  await store.lbUpsert({ id: saveId, name: s.name, worth: netWorth(s), day: s.day });
}

/** The public view of a save sent to the browser. */
export const view = (token: string, l: Loaded, store: Store, now: number, geo: Geo | null = null) => ({
  token, code: l.doc.code, signedIn: !!l.doc.userId, email: l.doc.userId ? l.doc.email || '' : '', state: l.doc.state, rev: l.rev, serverNow: now, store: store.name, geo,
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
