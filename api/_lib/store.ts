/**
 * Storage backends behind one small contract: a versioned key-value store with
 * compare-and-set, plus a leaderboard. The same contract tests run against all three.
 */
import { deployed, getEnv, type D1Like } from './env.js';

export interface Entry<T> { value: T; rev: number }
export interface LbEntry { id: string; name: string; worth: number; day: number }

export interface Store {
  readonly name: string;
  get<T>(key: string): Promise<Entry<T> | null>;
  /**
   * Writes `value` if the stored revision equals `expectedRev`.
   * `expectedRev === null` means "create, only if the key does not exist".
   * Returns the new revision, or null when someone else wrote first.
   */
  put<T>(key: string, value: T, expectedRev: number | null): Promise<number | null>;
  lbUpsert(e: LbEntry): Promise<void>;
  lbTop(n: number): Promise<LbEntry[]>;
}

const sortLb = (a: LbEntry[], n: number) => a.slice().sort((x, y) => y.worth - x.worth || x.day - y.day).slice(0, n);

export class MemoryStore implements Store {
  readonly name = 'MemoryStore';
  private kv = new Map<string, Entry<unknown>>();
  private lb = new Map<string, LbEntry>();
  async get<T>(key: string) { const e = this.kv.get(key); return e ? (structuredClone(e) as Entry<T>) : null; }
  async put<T>(key: string, value: T, expectedRev: number | null) {
    const cur = this.kv.get(key);
    if (expectedRev === null ? !!cur : !cur || cur.rev !== expectedRev) return null;
    const rev = cur ? cur.rev + 1 : 1;
    this.kv.set(key, { value: structuredClone(value), rev });
    return rev;
  }
  async lbUpsert(e: LbEntry) { this.lb.set(e.id, { ...e }); }
  async lbTop(n: number) { return sortLb([...this.lb.values()], n); }
}

/** Cloudflare D1 (SQLite at the edge). Same tables as supabase/schema.sql; see cloudflare/schema.sql. */
export class D1Store implements Store {
  readonly name = 'D1Store';
  constructor(private db: D1Like) {}
  async get<T>(key: string) {
    const row = await this.db.prepare('SELECT value, rev FROM kv WHERE key = ?').bind(key).first<{ value: string; rev: number }>();
    return row ? { value: JSON.parse(row.value) as T, rev: Number(row.rev) } : null;
  }
  async put<T>(key: string, value: T, expectedRev: number | null) {
    const json = JSON.stringify(value), now = new Date().toISOString();
    if (expectedRev === null) {
      const r = await this.db.prepare('INSERT INTO kv (key, value, rev, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(key) DO NOTHING').bind(key, json, now).run();
      return r.meta.changes === 1 ? 1 : null;
    }
    const r = await this.db.prepare('UPDATE kv SET value = ?, rev = rev + 1, updated_at = ? WHERE key = ? AND rev = ?').bind(json, now, key, expectedRev).run();
    return r.meta.changes === 1 ? expectedRev + 1 : null;
  }
  async lbUpsert(e: LbEntry) {
    await this.db.prepare('INSERT INTO leaderboard (id, name, worth, day, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, worth = excluded.worth, day = excluded.day, updated_at = excluded.updated_at')
      .bind(e.id, e.name, e.worth, e.day, new Date().toISOString()).run();
  }
  async lbTop(n: number) {
    const r = await this.db.prepare('SELECT id, name, worth, day FROM leaderboard ORDER BY worth DESC, day ASC LIMIT ?').bind(Math.max(1, Math.min(100, n))).all<LbEntry>();
    return r.results.map((e) => ({ ...e, worth: Number(e.worth), day: Number(e.day) }));
  }
}

/** Production store: Supabase Postgres over its REST API, with the service key (server side only). */
export class SupabaseStore implements Store {
  readonly name = 'SupabaseStore';
  constructor(private url: string, private key: string, private fetchFn: typeof fetch = fetch) { this.url = url.replace(/\/$/, ''); }
  private h(extra: Record<string, string> = {}) { return { apikey: this.key, Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', ...extra }; }
  private async req(p: string, init: RequestInit) {
    const r = await this.fetchFn(`${this.url}/rest/v1/${p}`, init);
    if (!r.ok && r.status !== 409) throw new Error(`Supabase ${init.method || 'GET'} ${p.split('?')[0]} failed: ${r.status} ${await r.text()}`);
    return r;
  }
  async get<T>(key: string) {
    const r = await this.req(`kv?key=eq.${encodeURIComponent(key)}&select=value,rev`, { headers: this.h() });
    const rows = (await r.json()) as Entry<T>[];
    return rows[0] || null;
  }
  async put<T>(key: string, value: T, expectedRev: number | null) {
    if (expectedRev === null) {
      const r = await this.req('kv', { method: 'POST', headers: this.h({ Prefer: 'return=minimal' }), body: JSON.stringify({ key, value, rev: 1 }) });
      return r.status === 409 ? null : 1;
    }
    const r = await this.req(`kv?key=eq.${encodeURIComponent(key)}&rev=eq.${expectedRev}`, {
      method: 'PATCH', headers: this.h({ Prefer: 'return=representation' }),
      body: JSON.stringify({ value, rev: expectedRev + 1, updated_at: new Date().toISOString() }),
    });
    const rows = (await r.json()) as unknown[];
    return rows.length === 1 ? expectedRev + 1 : null;
  }
  async lbUpsert(e: LbEntry) {
    await this.req('leaderboard?on_conflict=id', { method: 'POST', headers: this.h({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ id: e.id, name: e.name, worth: e.worth, day: e.day, updated_at: new Date().toISOString() }) });
  }
  async lbTop(n: number) {
    const r = await this.req(`leaderboard?select=id,name,worth,day&order=worth.desc,day.asc&limit=${Math.max(1, Math.min(100, n))}`, { headers: this.h() });
    return (await r.json()) as LbEntry[];
  }
}

let cached: Store | null = null;
/**
 * Picks the backend from the environment: Cloudflare D1 if the DB binding is there, Supabase if
 * its keys are set, otherwise JSON files in .data/ for local development (memory if run elsewhere). Deployed without a
 * database it refuses to run rather than lose saves.
 */
export async function getStore(): Promise<Store> {
  if (cached) return cached;
  const e = getEnv();
  if (e.DB) cached = new D1Store(e.DB);
  else if (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) cached = new SupabaseStore(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY);
  else if (deployed(e)) throw new Error('No database configured: bind a D1 database as DB (Cloudflare) or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  else {
    // Local dev: the Vite plugin offers a file-backed store (kept out of this module so the
    // Cloudflare bundle never pulls in node:fs). Without it, saves live in memory.
    const dev = (globalThis as { __haoraDevStore?: () => Promise<Store> }).__haoraDevStore;
    cached = dev ? await dev() : new MemoryStore();
  }
  return cached;
}
/** For tests. */
export function setStore(s: Store | null): void { cached = s; }
