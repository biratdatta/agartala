import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FileStore } from '../api/_lib/file-store.js';
import { D1Store, MemoryStore, SupabaseStore, type Store } from '../api/_lib/store.js';
import { fakeD1, sqlite } from './d1.js';

/** A fake PostgREST good enough to run the Supabase store through the same contract. */
function fakeSupabase(): typeof fetch {
  const kv = new Map<string, { value: unknown; rev: number }>(); const lb = new Map<string, Record<string, unknown>>();
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(input)); const table = u.pathname.split('/').pop(); const method = init?.method || 'GET';
    const q = (k: string) => u.searchParams.get(k)?.replace(/^eq\./, '');
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const res = (data: unknown, status = 200) => new Response(data === null ? null : JSON.stringify(data), { status });
    if (table === 'kv') {
      const key = q('key')!;
      if (method === 'GET') { const e = kv.get(key); return res(e ? [e] : []); }
      if (method === 'POST') { if (kv.has(body.key)) return res({ message: 'duplicate' }, 409); kv.set(body.key, { value: body.value, rev: 1 }); return res(null, 201); }
      if (method === 'PATCH') { const e = kv.get(key); const rev = Number(q('rev')); if (!e || e.rev !== rev) return res([]); kv.set(key, { value: body.value, rev: body.rev }); return res([{ key }]); }
    }
    if (table === 'leaderboard') {
      if (method === 'POST') { lb.set(body.id, body); return res(null, 201); }
      const n = Number(u.searchParams.get('limit')); return res([...lb.values()].sort((a, b) => Number(b.worth) - Number(a.worth)).slice(0, n));
    }
    return res({ message: 'not found' }, 404);
  }) as typeof fetch;
}

const dir = mkdtempSync(path.join(tmpdir(), 'haora-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const stores: [string, () => Store | Promise<Store>][] = [
  ['MemoryStore', () => new MemoryStore()],
  ['FileStore', () => new FileStore(path.join(dir, String(Math.random())))],
  ['SupabaseStore', () => new SupabaseStore('https://x.supabase.co', 'service-key', fakeSupabase())],
];
if (sqlite) stores.push(['D1Store', async () => new D1Store(await fakeD1())]);

describe.each(stores)('%s contract', (_name, make) => {
  it('creates once, then updates only at the expected revision', async () => {
    const s = await make();
    expect(await s.get('a')).toBeNull();
    expect(await s.put('a', { n: 1 }, null)).toBe(1);
    expect(await s.put('a', { n: 2 }, null)).toBeNull();
    expect(await s.put('a', { n: 2 }, 1)).toBe(2);
    expect(await s.put('a', { n: 3 }, 1)).toBeNull(); // stale writer loses
    expect(await s.get('a')).toEqual({ value: { n: 2 }, rev: 2 });
  });
  it('keeps a leaderboard sorted by worth', async () => {
    const s = await make();
    await s.lbUpsert({ id: '1', name: 'Rina', worth: 500, day: 3 });
    await s.lbUpsert({ id: '2', name: 'Bijoy', worth: 900, day: 5 });
    await s.lbUpsert({ id: '1', name: 'Rina', worth: 1200, day: 6 });
    const top = await s.lbTop(10);
    expect(top.map((e) => e.name)).toEqual(['Rina', 'Bijoy']);
    expect(top[0].worth).toBe(1200);
  });
});
