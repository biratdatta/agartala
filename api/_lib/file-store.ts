import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Entry, LbEntry, Store } from './store.js';

const sortLb = (a: LbEntry[], n: number) => a.slice().sort((x, y) => y.worth - x.worth || x.day - y.day).slice(0, n);

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
}

