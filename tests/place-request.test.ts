import { beforeEach, describe, expect, it } from 'vitest';
import { POST as placeRequest } from '../api/place-request.js';
import { POST as session } from '../api/session.js';
import { setEnv } from '../api/_lib/env.js';
import { MemoryStore, getStore, setStore } from '../api/_lib/store.js';

const req = (url: string, body: unknown, token?: string) => new Request(`https://agartala.biratdatta.tech${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

describe('place requests', () => {
  beforeEach(() => { setEnv({}); setStore(new MemoryStore()); });
  it('saves a request with its spot, and limits each farm to five a day', async () => {
    const { token } = (await (await session(req('/api/session', {}))).json()) as { token: string };
    const ok = await placeRequest(req('/api/place-request', { name: 'PRM Centrepoint', kind: 'shop', note: 'the new mall', x: 22, z: 768 }, token));
    expect(ok.status).toBe(200);
    const row = ((await getStore()) as MemoryStore).requests[0];
    expect(row.name).toBe('PRM Centrepoint'); expect(row.lat).toBeCloseTo(23.8299, 3); expect(row.lon).toBeCloseTo(91.2828, 3);
    expect((await placeRequest(req('/api/place-request', { name: 'x', kind: 'shop', x: 22, z: 768 }, token))).status).toBe(400);
    expect((await placeRequest(req('/api/place-request', { name: 'Far away', kind: 'shop', x: 99999, z: 0 }, token))).status).toBe(400);
    expect((await placeRequest(req('/api/place-request', { name: 'No session', kind: 'shop', x: 22, z: 768 }))).status).toBe(401);
    const codes = []; for (let i = 0; i < 5; i++) codes.push((await placeRequest(req('/api/place-request', { name: `Shop ${i}`, kind: 'shop', x: 100, z: 700 }, token))).status);
    expect(codes).toEqual([200, 200, 200, 200, 429]);
  });
});

describe('place requests in D1', () => {
  it('go into their own table', async () => {
    const { D1Store } = await import('../api/_lib/store.js'); const { fakeD1, sqlite } = await import('./d1.js');
    if (!sqlite) return;
    const db = await fakeD1(); setEnv({}); setStore(new D1Store(db));
    const { token } = (await (await session(req('/api/session', {}))).json()) as { token: string };
    expect((await placeRequest(req('/api/place-request', { name: 'Battala Kali Mandir', kind: 'temple', note: '', x: -120, z: 300 }, token))).status).toBe(200);
    const row = await db.prepare('SELECT name, kind, status FROM place_requests').bind().first<{ name: string; kind: string; status: string }>();
    expect(row).toEqual({ name: 'Battala Kali Mandir', kind: 'temple', status: 'new' });
  });
});
