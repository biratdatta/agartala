/**
 * Talks to the server. Moves are applied in the browser at once (optimistic) and sent
 * in small batches; the server re-checks them and its save is the truth. If it says no,
 * the browser rolls back to the server's state and replays any moves still queued.
 * With no server (a plain static host), the game runs offline and saves in the browser.
 */
import { apply, type Action } from '../shared/rules.js';
import { newState, normalize, type GameState } from '../shared/save.js';

export interface Geo { city: string; country: string; km: number }
export interface SessionView { token: string; code: string; signedIn: boolean; email?: string; state: GameState; rev: number; serverNow: number; store: string; geo?: Geo | null }
export interface ActResponse extends SessionView { applied: number; rejected?: { index: number; err: string } }
export interface LbRow { rank: number; name: string; worth: number; day: number; id: string }

const TOKEN_KEY = 'haora.agartala.token';
const LOCAL_KEY = 'haora.agartala.local';
const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k: string): void { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export class Net {
  online = false;
  /** True when the server was reachable at start but has stopped answering. */
  lost = false;
  code = '';
  signedIn = false;
  email = '';
  storeName = '';
  /** Where the server thinks this player is connecting from (Cloudflare or Vercel IP geolocation). */
  geo: Geo | null = null;
  private token = ls.get(TOKEN_KEY);
  private skew = 0;
  private pending: Action[] = [];
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Called when the server's answer replaces the local state. */
  onState: (s: GameState, rejected?: string) => void = () => {};
  /** Called when the connection drops or returns. */
  onStatus: (online: boolean) => void = () => {};

  now(): number { return Date.now() + this.skew; }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token) h.authorization = `Bearer ${this.token}`;
    return h;
  }
  private accept(v: SessionView): void {
    this.token = v.token; ls.set(TOKEN_KEY, v.token); this.skew = v.serverNow - Date.now();
    this.code = v.code; this.signedIn = v.signedIn; this.email = v.email || ''; this.storeName = v.store; if (v.geo !== undefined) this.geo = v.geo;
  }

  /** Opens (or creates) this device's farm. Falls back to a browser-only save if there is no server. */
  async start(): Promise<GameState> {
    try {
      const r = await fetch('/api/session', { method: 'POST', headers: this.headers(), body: '{}' });
      if (!r.ok) throw new Error(String(r.status));
      const v = (await r.json()) as SessionView; this.accept(v); this.online = true;
      return normalize(v.state, this.now());
    } catch {
      this.online = false;
      const raw = ls.get(LOCAL_KEY);
      return raw ? normalize(JSON.parse(raw), Date.now()) : newState(Date.now());
    }
  }

  /** Queues a move that has already been applied locally. */
  send(a: Action, local: GameState): void {
    if (!this.online) { ls.set(LOCAL_KEY, JSON.stringify(local)); return; }
    this.pending.push(a); this.schedule(250);
  }
  private schedule(ms: number): void { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.flush(), ms); }

  async flush(): Promise<void> {
    if (!this.online || this.busy || !this.pending.length) return;
    const batch = this.pending.splice(0, 60); this.busy = true;
    try {
      const r = await fetch('/api/act', { method: 'POST', headers: this.headers(), body: JSON.stringify({ actions: batch }) });
      if (r.status === 401) { this.token = null; ls.del(TOKEN_KEY); const s = await this.start(); this.onState(s, 'Your session expired, so a new farm was started'); return; }
      if (!r.ok) throw new Error(String(r.status));
      const v = (await r.json()) as ActResponse; this.accept(v);
      const s = normalize(v.state, this.now());
      for (const a of this.pending) apply(s, a, this.now()); // rebase moves made while the batch was in flight
      this.onState(s, v.rejected?.err);
      this.lost = false; this.onStatus(true);
    } catch {
      this.pending.unshift(...batch); this.lost = true; this.onStatus(false); this.schedule(4000);
    } finally {
      this.busy = false; if (this.pending.length) this.schedule(250);
    }
  }

  async restore(code: string): Promise<GameState> {
    const r = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const v = (await r.json()) as SessionView & { error?: string };
    if (!r.ok) throw new Error(v.error || 'Could not restore that farm');
    this.pending = []; this.accept(v); return normalize(v.state, this.now());
  }

  /** The session token, for starting a sign-in. */
  get session(): string | null { return this.token; }
  /** Adopts the session a sign-in handed back (before start()). */
  adopt(token: string): void { this.token = token; ls.set(TOKEN_KEY, token); this.pending = []; }

  async leaderboard(): Promise<LbRow[]> {
    const r = await fetch('/api/leaderboard'); if (!r.ok) throw new Error('Leaderboard unavailable');
    return ((await r.json()) as { entries: LbRow[] }).entries;
  }

  /** Starts over on this device. */
  async reset(): Promise<GameState> { this.token = null; ls.del(TOKEN_KEY); ls.del(LOCAL_KEY); this.pending = []; return this.start(); }
}
