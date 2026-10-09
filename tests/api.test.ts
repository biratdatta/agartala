import { beforeEach, describe, expect, it } from 'vitest';
import { POST as act } from '../api/act.js';
import { GET as health } from '../api/health.js';
import { GET as leaderboard } from '../api/leaderboard.js';
import { POST as session } from '../api/session.js';
import { GET as state } from '../api/state.js';
import { MemoryStore, setStore } from '../api/_lib/store.js';

const call = async (fn: (r: Request) => Promise<Response>, opts: { token?: string; body?: unknown; method?: string } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const r = await fn(new Request('http://test/api', { method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'), headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }));
  return { status: r.status, data: await r.json() };
};

beforeEach(() => setStore(new MemoryStore()));

describe('API', () => {
  it('reports the store', async () => {
    expect((await call(health)).data.store).toBe('MemoryStore');
  });

  it('creates a guest, returns the same farm for its token, and restores it by code', async () => {
    const a = await call(session, { body: {} });
    expect(a.status).toBe(201); expect(a.data.token).toMatch(/^[A-Za-z0-9_-]{40,}$/); expect(a.data.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const b = await call(session, { token: a.data.token, body: {} });
    expect(b.data.code).toBe(a.data.code);
    const c = await call(session, { body: { code: a.data.code.toLowerCase().replace('-', '') } });
    expect(c.status).toBe(200); expect(c.data.token).not.toBe(a.data.token); expect(c.data.code).toBe(a.data.code);
    expect((await call(state, { token: c.data.token })).data.state.money).toBe(100);
  });

  it('applies valid moves, stops at the first bad one, and keeps the server\'s truth', async () => {
    const { data: s } = await call(session, { body: {} });
    const r = await call(act, { token: s.token, body: { actions: [{ t: 'meetGrandpa' }, { t: 'till', plot: 0 }, { t: 'sell', item: 'paddy', n: 99 }, { t: 'till', plot: 1 }] } });
    expect(r.data.applied).toBe(2);
    expect(r.data.rejected.err).toMatch(/do not have/);
    expect(r.data.state.money).toBe(250); // 100 + 150 mission reward
    expect(r.data.state.inv.paddySeed).toBe(4);
    expect(r.data.state.plots[1].state).toBe('grass'); // never reached
    expect(r.data.rev).toBe(2);
  });

  it('refuses unknown sessions and oversized batches', async () => {
    expect((await call(act, { token: 'x'.repeat(43), body: { actions: [] } })).status).toBe(401);
    const { data: s } = await call(session, { body: {} });
    expect((await call(act, { token: s.token, body: { actions: Array(100).fill({ t: 'fill' }) } })).status).toBe(400);
  });

  it('puts named farms on the leaderboard', async () => {
    const { data: s } = await call(session, { body: {} });
    await call(act, { token: s.token, body: { actions: [{ t: 'name', name: 'Birat <script>' }, { t: 'meetGrandpa' }] } });
    const lb = await call(leaderboard);
    expect(lb.data.entries[0].name).toBe('Birat script');
    expect(lb.data.entries[0].worth).toBeGreaterThanOrEqual(250);
  });
});
