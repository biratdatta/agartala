/**
 * Talks to the server. Moves are applied in the browser at once (optimistic) and sent
 * in small batches; the server re-checks them and its save is the truth. If it says no,
 * the browser rolls back to the server's state and replays any moves still queued.
 * With no server (a plain static host), the game runs offline and saves in the browser.
 */
import { apply, type Action } from '../shared/rules.js';
import { newState, normalize, type GameState } from '../shared/save.js';

export interface Geo { city: string; country: string; km: number }
export interface SessionView { token: string; code: string; visit?: string; pid?: string; signedIn: boolean; email?: string; state: GameState; rev: number; serverNow: number; store: string; geo?: Geo | null }
export interface ActResponse extends SessionView { applied: number; rejected?: { index: number; err: string } }
export interface LbRow { rank: number; name: string; worth: number; day: number; id: string }
export interface WeekRow { rank: number; name: string; para: string; value: number; id: string }
export interface ParaRow { rank: number; para: string; total: number; players: number }
export interface OtherPlayer { id: string; name: string; para: string; x: number; z: number; face: number; age: number }
export interface FarmSummary { visit: string; name: string; para: string; day: number; worth: number; plots: number; planted: number; thirsty: number; ripe: number; tea: number; pond: boolean; sights: number; festivals: number }

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
  /** The server only lets signed-in players in, and this device isn't signed in yet. */
  needsSignin = false;
  email = '';
  /** Your visit code (for friends) and public id. */
  visit = ''; pid = '';
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
    this.code = v.code; this.signedIn = v.signedIn; this.email = v.email || ''; if (v.visit) this.visit = v.visit; if (v.pid) this.pid = v.pid; this.storeName = v.store; if (v.geo !== undefined) this.geo = v.geo;
  }

  /** Opens (or creates) this device's farm. Falls back to a browser-only save if there is no server. */
  async start(body = '{}'): Promise<GameState> {
    try {
      const r = await fetch('/api/session', { method: 'POST', headers: this.headers(), body });
      if (r.status === 401 && ((await r.clone().json().catch(() => ({}))) as { signin?: boolean }).signin) {
        // Server is up but wants a Google sign-in first. Keep any guest token so that farm can be linked.
        this.needsSignin = true; this.online = true; this.signedIn = false;
        return newState(Date.now());
      }
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
    if (this.needsSignin) return; // not signed in (debug play): nothing reaches the server
    this.pending.push(a); this.schedule(250);
  }
  private schedule(ms: number): void { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.flush(), ms); }

  async flush(): Promise<void> {
    if (!this.online || this.busy || !this.pending.length) return;
    const batch = this.pending.splice(0, 60); this.busy = true;
    try {
      const r = await fetch('/api/act', { method: 'POST', headers: this.headers(), body: JSON.stringify({ actions: batch }) });
      if (r.status === 401 && ((await r.clone().json().catch(() => ({}))) as { signin?: boolean }).signin) { location.reload(); return; }
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
  async weekBoard(cat: string): Promise<WeekRow[]> {
    const r = await fetch(`/api/leaderboard?board=week&cat=${encodeURIComponent(cat)}`); if (!r.ok) throw new Error('Board unavailable');
    return ((await r.json()) as { entries: WeekRow[] }).entries;
  }
  async paraBoard(): Promise<ParaRow[]> {
    const r = await fetch('/api/leaderboard?board=para'); if (!r.ok) throw new Error('Board unavailable');
    return ((await r.json()) as { paras: ParaRow[] }).paras;
  }

  /* ---------- other players ---------- */
  async presence(x: number, z: number, face: number): Promise<void> {
    if (!this.token) return;
    await fetch('/api/presence', { method: 'POST', headers: this.headers(), body: JSON.stringify({ x, z, face }) });
  }
  async players(): Promise<OtherPlayer[]> {
    const r = await fetch(`/api/players?me=${encodeURIComponent(this.pid)}`); if (!r.ok) throw new Error('No players');
    return ((await r.json()) as { players: OtherPlayer[] }).players;
  }
  async farm(code: string): Promise<FarmSummary> {
    const r = await fetch(`/api/farm?code=${encodeURIComponent(code)}`); const v = await r.json();
    if (!r.ok) throw new Error((v as { error?: string }).error || 'No such farm'); return v as FarmSummary;
  }
  /** Water a friend's crops, or send them a gift. The answer replaces your own state. */
  async help(code: string): Promise<{ state: GameState; watered: number; farm: FarmSummary }> {
    await this.flush();
    const r = await fetch('/api/help', { method: 'POST', headers: this.headers(), body: JSON.stringify({ code }) });
    const v = (await r.json()) as SessionView & { error?: string; watered: number; farm: FarmSummary };
    if (!r.ok) throw new Error(v.error || 'Could not help'); this.pending = []; this.accept(v);
    return { state: normalize(v.state, this.now()), watered: v.watered, farm: v.farm };
  }
  async gift(code: string, item: string, n: number): Promise<{ state: GameState; to: string }> {
    await this.flush();
    const r = await fetch('/api/gift', { method: 'POST', headers: this.headers(), body: JSON.stringify({ code, item, n }) });
    const v = (await r.json()) as SessionView & { error?: string; sent: { to: string } };
    if (!r.ok) throw new Error(v.error || 'Could not send it'); this.pending = []; this.accept(v);
    return { state: normalize(v.state, this.now()), to: v.sent.to };
  }

  /** Starts over on this device. */
  /** Signs this device out: the server kills the session, and the browser forgets it and any local save. */
  async signOut(): Promise<void> {
    try { await this.flush(); } catch { /* best effort */ }
    try { await fetch('/api/auth-signout', { method: 'POST', headers: this.headers(), body: '{}' }); } catch { /* offline: forgetting the token is enough here */ }
    this.token = null; this.signedIn = false; this.email = ''; this.pending = []; ls.del(TOKEN_KEY); ls.del(LOCAL_KEY);
  }

  /** A fresh farm. Signed in, the server gives the account a new farm; as a guest, a new guest farm. */
  async reset(): Promise<GameState> {
    ls.del(LOCAL_KEY); this.pending = [];
    if (this.signedIn) return this.start(JSON.stringify({ reset: true }));
    this.token = null; ls.del(TOKEN_KEY); return this.start();
  }
}
