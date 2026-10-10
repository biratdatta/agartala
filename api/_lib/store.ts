/**
 * Storage backends behind one small contract: a versioned key-value store with
 * compare-and-set, the leaderboards, and who is out in the city right now.
 * The same contract tests run against every backend.
 */
import { deployed, getEnv, type D1Like } from './env.js';

export interface Entry<T> { value: T; rev: number }
export interface LbEntry { id: string; name: string; worth: number; day: number }
/** One farm's tallies for one ISO week. `name` may be empty (unnamed farms still count for their para). */
export interface WeekEntry { id: string; week: string; name: string; para: string; paddy: number; deliveries: number; kaam: number; sights: number; earned: number }
export type WeekCat = 'paddy' | 'deliveries' | 'kaam' | 'sights' | 'earned';
export const WEEK_CATS: WeekCat[] = ['paddy', 'deliveries', 'kaam', 'sights', 'earned'];
export interface ParaRow { para: string; total: number; players: number }
/** A player out in the city: public id, name, neighbourhood and where they stand. `t` is ms since epoch. */
export interface Presence { id: string; name: string; para: string; x: number; z: number; face: number; t: number }

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
  weekUpsert(e: WeekEntry): Promise<void>;
  /** The week's top named farms in one category (zeros left out). */
  weekTop(week: string, cat: WeekCat, n: number): Promise<WeekEntry[]>;
  /** Each para's total earnings this week, best first. */
  paraTop(week: string, n: number): Promise<ParaRow[]>;
  presenceUpsert(p: Presence): Promise<void>;
  /** This Puja's pandal hoppers: how many pandals each named farm has seen, and when it saw them all. */
  pujoUpsert(e: PujoEntry): Promise<void>;
  /** Farms that saw every pandal, first first; then everyone else by pandals seen. */
  pujoTop(season: string, n: number): Promise<PujoEntry[]>;
  /** Saves a player's request for a missing place (table place_requests). */
  placeRequestAdd(r: PlaceRequest): Promise<void>;
  /** Players seen since `since` (ms), most recent first. */
  presenceRecent(since: number, n: number): Promise<Presence[]>;
}

export const sortLb = (a: LbEntry[], n: number) => a.slice().sort((x, y) => y.worth - x.worth || x.day - y.day).slice(0, n);
export const weekTopOf = (a: WeekEntry[], week: string, cat: WeekCat, n: number) => a.filter((e) => e.week === week && e.name && e[cat] > 0).sort((x, y) => y[cat] - x[cat]).slice(0, n);
export function paraTopOf(a: WeekEntry[], week: string, n: number): ParaRow[] {
  const m = new Map<string, ParaRow>();
  for (const e of a) if (e.week === week && e.para) { const r = m.get(e.para) || { para: e.para, total: 0, players: 0 }; r.total += e.earned; r.players++; m.set(e.para, r); }
  return [...m.values()].sort((x, y) => y.total - x.total).slice(0, n);
}
export const recentOf = (a: Presence[], since: number, n: number) => a.filter((p) => p.t >= since).sort((x, y) => y.t - x.t).slice(0, n);
const clampN = (n: number) => Math.max(1, Math.min(100, Math.floor(n) || 1));

/** One farm on the pandal-hopping board. `allAt` is when (ISO) it had seen every pandal, '' until then. */
export interface PujoEntry { id: string; season: string; name: string; para: string; pandals: number; seen: string; allAt: string }
export const sortPujo = (a: PujoEntry, b: PujoEntry): number => (a.allAt && b.allAt ? a.allAt.localeCompare(b.allAt) : a.allAt ? -1 : b.allAt ? 1 : b.pandals - a.pandals);

/** A player's request for a place that's missing from the game. */
export interface PlaceRequest { id: string; name: string; kind: string; note: string; x: number; z: number; lat: number; lon: number; farm: string; email: string; created_at: string; status: string }

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
  private wk = new Map<string, WeekEntry>();
  private pres = new Map<string, Presence>();
  async lbUpsert(e: LbEntry) { this.lb.set(e.id, { ...e }); }
  async lbTop(n: number) { return sortLb([...this.lb.values()], n); }
  async weekUpsert(e: WeekEntry) { this.wk.set(`${e.id}|${e.week}`, { ...e }); }
  async weekTop(week: string, cat: WeekCat, n: number) { return weekTopOf([...this.wk.values()], week, cat, clampN(n)); }
  async paraTop(week: string, n: number) { return paraTopOf([...this.wk.values()], week, clampN(n)); }
  async presenceUpsert(p: Presence) { this.pres.set(p.id, { ...p }); }
  readonly requests: PlaceRequest[] = [];
  async placeRequestAdd(r: PlaceRequest) { this.requests.push({ ...r }); }
  private pujo = new Map<string, PujoEntry>();
  async pujoUpsert(e: PujoEntry) { this.pujo.set(`${e.id}|${e.season}`, { ...e }); }
  async pujoTop(season: string, n: number) { return [...this.pujo.values()].filter((e) => e.season === season && e.name).sort(sortPujo).slice(0, clampN(n)); }
  async presenceRecent(since: number, n: number) { return recentOf([...this.pres.values()], since, clampN(n)); }
}

/** Cloudflare D1 (SQLite at the edge). Same tables as supabase/schema.sql; see cloudflare/schema.sql. */
export class D1Store implements Store {
  readonly name = 'D1Store';
  private ready: Promise<void> | null = null;
  constructor(private db: D1Like) {}
  /** Creates the newer tables on first use, so an existing database picks them up without a migration step. */
  private ensure(): Promise<void> {
    return (this.ready ||= (async () => { for (const sql of D1_TABLES) await this.db.prepare(sql).bind().run(); })().catch((e) => { this.ready = null; throw e; }));
  }
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
  async weekUpsert(e: WeekEntry) {
    await this.ensure();
    await this.db.prepare('INSERT INTO weekly (id, week, name, para, paddy, deliveries, kaam, sights, earned, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id, week) DO UPDATE SET name = excluded.name, para = excluded.para, paddy = excluded.paddy, deliveries = excluded.deliveries, kaam = excluded.kaam, sights = excluded.sights, earned = excluded.earned, updated_at = excluded.updated_at')
      .bind(e.id, e.week, e.name, e.para, e.paddy, e.deliveries, e.kaam, e.sights, e.earned, new Date().toISOString()).run();
  }
  async weekTop(week: string, cat: WeekCat, n: number) {
    if (!WEEK_CATS.includes(cat)) return [];
    await this.ensure();
    const r = await this.db.prepare(`SELECT id, week, name, para, paddy, deliveries, kaam, sights, earned FROM weekly WHERE week = ? AND name <> '' AND ${cat} > 0 ORDER BY ${cat} DESC LIMIT ?`).bind(week, clampN(n)).all<WeekEntry>();
    return r.results.map(numify);
  }
  async paraTop(week: string, n: number) {
    await this.ensure();
    const r = await this.db.prepare("SELECT para, SUM(earned) AS total, COUNT(*) AS players FROM weekly WHERE week = ? AND para <> '' GROUP BY para ORDER BY total DESC LIMIT ?").bind(week, clampN(n)).all<ParaRow>();
    return r.results.map((p) => ({ para: p.para, total: Number(p.total), players: Number(p.players) }));
  }
  async pujoUpsert(e: PujoEntry) {
    await this.ensure();
    await this.db.prepare('INSERT INTO pujo_board (id, season, name, para, pandals, seen, all_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id, season) DO UPDATE SET name = excluded.name, para = excluded.para, pandals = excluded.pandals, seen = excluded.seen, all_at = CASE WHEN pujo_board.all_at <> \'\' THEN pujo_board.all_at ELSE excluded.all_at END, updated_at = excluded.updated_at')
      .bind(e.id, e.season, e.name, e.para, e.pandals, e.seen, e.allAt, new Date().toISOString()).run();
  }
  async pujoTop(season: string, n: number) {
    await this.ensure();
    const r = await this.db.prepare("SELECT id, season, name, para, pandals, seen, all_at AS allAt FROM pujo_board WHERE season = ? AND name <> '' ORDER BY (all_at = '') ASC, all_at ASC, pandals DESC, updated_at ASC LIMIT ?").bind(season, clampN(n)).all<PujoEntry>();
    return r.results.map((e) => ({ ...e, pandals: Number(e.pandals) }));
  }
  async placeRequestAdd(r: PlaceRequest) {
    await this.ensure();
    await this.db.prepare('INSERT INTO place_requests (id, name, kind, note, x, z, lat, lon, farm, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(r.id, r.name, r.kind, r.note, r.x, r.z, r.lat, r.lon, r.farm, r.email, r.status, r.created_at).run();
  }
  async presenceUpsert(p: Presence) {
    await this.ensure();
    await this.db.prepare('INSERT INTO presence (id, name, para, x, z, face, t) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, para = excluded.para, x = excluded.x, z = excluded.z, face = excluded.face, t = excluded.t')
      .bind(p.id, p.name, p.para, p.x, p.z, p.face, p.t).run();
  }
  async presenceRecent(since: number, n: number) {
    await this.ensure();
    const r = await this.db.prepare('SELECT id, name, para, x, z, face, t FROM presence WHERE t >= ? ORDER BY t DESC LIMIT ?').bind(since, clampN(n)).all<Presence>();
    return r.results.map((p) => ({ ...p, x: Number(p.x), z: Number(p.z), face: Number(p.face), t: Number(p.t) }));
  }
}
const numify = (e: WeekEntry): WeekEntry => ({ ...e, paddy: Number(e.paddy), deliveries: Number(e.deliveries), kaam: Number(e.kaam), sights: Number(e.sights), earned: Number(e.earned) });
/** Read-only admin view: one row per farm, unpacked from the save:<id> JSON in kv. Also in cloudflare/schema.sql. */
const PLAYERS_VIEW = "CREATE VIEW players AS SELECT substr(key, 6) AS save_id, json_extract(value, '$.email') AS email, json_extract(value, '$.code') AS farm_code, json_extract(value, '$.realName') AS real_name, json_extract(value, '$.state.name') AS farm_name, json_extract(value, '$.state.day') AS day, json_extract(value, '$.userId') AS user_id, CASE WHEN json_extract(value, '$.userId') IS NOT NULL THEN 1 ELSE 0 END AS signed_in, datetime(json_extract(value, '$.created') / 1000, 'unixepoch') AS created, updated_at AS last_saved FROM kv WHERE key LIKE 'save:%'";
/** Tables added after the first release; also in cloudflare/schema.sql. */
export const D1_TABLES = [
  'CREATE TABLE IF NOT EXISTS weekly (id TEXT NOT NULL, week TEXT NOT NULL, name TEXT NOT NULL, para TEXT NOT NULL, paddy INTEGER NOT NULL DEFAULT 0, deliveries INTEGER NOT NULL DEFAULT 0, kaam INTEGER NOT NULL DEFAULT 0, sights INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (id, week))',
  'CREATE INDEX IF NOT EXISTS weekly_week_idx ON weekly (week)',
  'CREATE TABLE IF NOT EXISTS presence (id TEXT PRIMARY KEY, name TEXT NOT NULL, para TEXT NOT NULL, x REAL NOT NULL, z REAL NOT NULL, face REAL NOT NULL, t INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS presence_t_idx ON presence (t)',
  'CREATE TABLE IF NOT EXISTS place_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT \'\', x INTEGER NOT NULL, z INTEGER NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, farm TEXT NOT NULL, email TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'new\', created_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS place_requests_created_idx ON place_requests (created_at)',
  "CREATE TABLE IF NOT EXISTS pujo_board (id TEXT NOT NULL, season TEXT NOT NULL, name TEXT NOT NULL, para TEXT NOT NULL, pandals INTEGER NOT NULL DEFAULT 0, seen TEXT NOT NULL DEFAULT '', all_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (id, season))",
  'DROP VIEW IF EXISTS players', // recreated each start so new columns land
  PLAYERS_VIEW,
];

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
  async weekUpsert(e: WeekEntry) {
    await this.req('weekly?on_conflict=id,week', { method: 'POST', headers: this.h({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ ...e, updated_at: new Date().toISOString() }) });
  }
  async weekTop(week: string, cat: WeekCat, n: number) {
    if (!WEEK_CATS.includes(cat)) return [];
    const r = await this.req(`weekly?select=id,week,name,para,paddy,deliveries,kaam,sights,earned&week=eq.${encodeURIComponent(week)}&name=neq.&${cat}=gt.0&order=${cat}.desc&limit=${clampN(n)}`, { headers: this.h() });
    return ((await r.json()) as WeekEntry[]).map(numify);
  }
  async paraTop(week: string, n: number) {
    const r = await this.req(`para_week?select=para,total,players&week=eq.${encodeURIComponent(week)}&order=total.desc&limit=${clampN(n)}`, { headers: this.h() });
    return ((await r.json()) as ParaRow[]).map((p) => ({ para: p.para, total: Number(p.total), players: Number(p.players) }));
  }
  async pujoUpsert(e: PujoEntry) {
    const row = { id: e.id, season: e.season, name: e.name, para: e.para, pandals: e.pandals, seen: e.seen, updated_at: new Date().toISOString() };
    await this.req('pujo_board?on_conflict=id,season', { method: 'POST', headers: this.h({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(row) });
    if (e.allAt) await this.req(`pujo_board?id=eq.${encodeURIComponent(e.id)}&season=eq.${encodeURIComponent(e.season)}&all_at=eq.`, { method: 'PATCH', headers: this.h({ Prefer: 'return=minimal' }), body: JSON.stringify({ all_at: e.allAt }) });
  }
  async pujoTop(season: string, n: number) {
    const r = await this.req(`pujo_board?select=id,season,name,para,pandals,seen,allAt:all_at&season=eq.${encodeURIComponent(season)}&name=neq.&limit=200`, { headers: this.h() });
    return ((await r.json()) as PujoEntry[]).map((e) => ({ ...e, pandals: Number(e.pandals) })).sort(sortPujo).slice(0, clampN(n));
  }
  async placeRequestAdd(r: PlaceRequest) {
    await this.req('place_requests', { method: 'POST', headers: this.h({ Prefer: 'return=minimal' }), body: JSON.stringify(r) });
  }
  async presenceUpsert(p: Presence) {
    await this.req('presence?on_conflict=id', { method: 'POST', headers: this.h({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(p) });
  }
  async presenceRecent(since: number, n: number) {
    const r = await this.req(`presence?select=id,name,para,x,z,face,t&t=gte.${Math.floor(since)}&order=t.desc&limit=${clampN(n)}`, { headers: this.h() });
    return (await r.json()) as Presence[];
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
