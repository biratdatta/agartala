import { promises as fs } from 'node:fs';
import path from 'node:path';
import { paraTopOf, recentOf, sortLb, weekTopOf, type Entry, type LbEntry, type PlaceRequest, type Presence, type Store, type WeekCat, type WeekEntry } from './store.js';

/** Development store: one JSON file per key under .data/. Writes are serialised inside the process. */
export class FileStore implements Store {
  readonly name = 'FileStore';
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private dir: string) { this.dir = path.resolve(dir); }
  private file(key: string) { return path.join(this.dir, encodeURIComponent(key) + '.json'); }
  private lock<R>(fn: () => Promise<R>): Promise<R> { const p = this.queue.then(fn, fn); this.queue = p.catch(() => undefined); return p; }
  private async read<T>(f: string): Promise<T | null> { try { return JSON.parse(await fs.readFile(f, 'utf8')) as T; } catch { return null; } }
  private async write(f: string, v: unknown) { await fs.mkdir(this.dir, { recursive: true }); const tmp = f + '.' + process.pid + '.tmp'; await fs.writeFile(tmp, JSON.stringify(v)); await fs.rename(tmp, f); }
  async get<T>(key: string) { return this.read<Entry<T>>(this.file(key)); }
  put<T>(key: string, value: T, expectedRev: number | null) {
    return this.lock(async () => {
      const f = this.file(key); const cur = await this.read<Entry<T>>(f);
      if (expectedRev === null ? !!cur : !cur || cur.rev !== expectedRev) return null;
      const rev = cur ? cur.rev + 1 : 1; await this.write(f, { value, rev }); return rev;
    });
  }
  lbUpsert(e: LbEntry) { return this.lock(async () => { const f = path.join(this.dir, 'leaderboard.json'); const all = (await this.read<Record<string, LbEntry>>(f)) || {}; all[e.id] = e; await this.write(f, all); }); }
  async lbTop(n: number) { const all = (await this.read<Record<string, LbEntry>>(path.join(this.dir, 'leaderboard.json'))) || {}; return sortLb(Object.values(all), n); }
  weekUpsert(e: WeekEntry) { return this.lock(async () => { const f = path.join(this.dir, 'weekly.json'); const all = (await this.read<Record<string, WeekEntry>>(f)) || {}; all[`${e.id}|${e.week}`] = e; await this.write(f, all); }); }
  private async weeks() { return Object.values((await this.read<Record<string, WeekEntry>>(path.join(this.dir, 'weekly.json'))) || {}); }
  async weekTop(week: string, cat: WeekCat, n: number) { return weekTopOf(await this.weeks(), week, cat, n); }
  async paraTop(week: string, n: number) { return paraTopOf(await this.weeks(), week, n); }
  /** Who is in the city is short-lived, so in local dev it stays in memory. */
  private pres = new Map<string, Presence>();
  async presenceUpsert(p: Presence) { this.pres.set(p.id, { ...p }); }
  placeRequestAdd(r: PlaceRequest) { return this.lock(async () => { const f = path.join(this.dir, 'place-requests.json'); const all = (await this.read<PlaceRequest[]>(f)) || []; all.push(r); await this.write(f, all); }); }
  async presenceRecent(since: number, n: number) { return recentOf([...this.pres.values()], since, n); }
}

