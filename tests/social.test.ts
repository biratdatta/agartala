import { beforeEach, describe, expect, it } from 'vitest';
import { POST as act } from '../api/act.js';
import { GET as farm } from '../api/farm.js';
import { POST as gift } from '../api/gift.js';
import { POST as help } from '../api/help.js';
import { GET as leaderboard } from '../api/leaderboard.js';
import { GET as players } from '../api/players.js';
import { POST as presence } from '../api/presence.js';
import { POST as session } from '../api/session.js';
import { GET as state } from '../api/state.js';
import { MemoryStore, setStore } from '../api/_lib/store.js';

const call = async (fn: (r: Request) => Promise<Response>, opts: { token?: string; body?: unknown; url?: string } = {}) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const r = await fn(new Request(`http://test/api${opts.url || ''}`, { method: opts.body !== undefined ? 'POST' : 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined }));
  return { status: r.status, data: await r.json() };
};
const farmer = async (name: string) => {
  const { data } = await call(session, { body: {} });
  await call(act, { token: data.token, body: { actions: [{ t: 'name', name }, { t: 'meetGrandpa' }] } });
  return data as { token: string; visit: string; pid: string };
};

beforeEach(() => setStore(new MemoryStore()));

describe('playing with friends', () => {
  it('gives every farm a visit code that is not its farm code', async () => {
    const a = await farmer('Rina'); expect(a.visit).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    const f = await call(farm, { url: `?code=${a.visit.toLowerCase()}` });
    expect(f.status).toBe(200); expect(f.data.name).toBe('Rina'); expect(f.data.para).toBe('MBB Stadium');
    expect(f.data.code).toBeUndefined(); expect(f.data.token).toBeUndefined();
    expect((await call(farm, { url: '?code=0000-0000' })).status).toBe(404);
  });
  it('waters a friend\'s crops once a day and pays the helper', async () => {
    const a = await farmer('Rina'), b = await farmer('Bikash');
    await call(act, { token: a.token, body: { actions: [{ t: 'till', plot: 0 }, { t: 'sow', plot: 0 }] } });
    const r = await call(help, { token: b.token, body: { code: a.visit } });
    expect(r.status).toBe(200); expect(r.data.watered).toBe(1); expect(r.data.state.money).toBe(250 + 20);
    expect((await call(help, { token: b.token, body: { code: a.visit } })).data.error).toMatch(/already helped/);
    expect((await call(help, { token: a.token, body: { code: a.visit } })).data.error).toMatch(/own farm/);
    const sa = await call(state, { token: a.token });
    expect(sa.data.state.plots[0].watered).toBe(true); expect(sa.data.state.inbox[0].text).toMatch(/Bikash .* watered 1/);
  });
  it('sends gifts from one store to another', async () => {
    const a = await farmer('Rina'), b = await farmer('Bikash');
    expect((await call(gift, { token: a.token, body: { code: b.visit, item: 'paddy', n: 1 } })).status).toBe(400); // has none
    expect((await call(gift, { token: a.token, body: { code: b.visit, item: 'gold', n: 1 } })).status).toBe(400);
    await call(act, { token: a.token, body: { actions: [{ t: 'cut', clump: 0 }, { t: 'cut', clump: 1 }] } });
    const r = await call(gift, { token: a.token, body: { code: b.visit, item: 'bamboo', n: 2 } });
    expect(r.status).toBe(200); expect(r.data.state.inv.bamboo).toBe(0);
    const sb = await call(state, { token: b.token }); expect(sb.data.state.inv.bamboo).toBe(2); expect(sb.data.state.inbox[0].text).toMatch(/Rina .* sent you 2 bamboo/);
  });
  it('shows other players out in the city, but not yourself', async () => {
    const a = await farmer('Rina'), b = await farmer('Bikash');
    await call(presence, { token: a.token, body: { x: 10, z: 20, face: 1 } });
    await call(presence, { token: b.token, body: { x: 30, z: 40, face: 0 } });
    expect((await call(presence, { token: a.token, body: { x: 'here' } })).status).toBe(400);
    const r = await call(players, { url: `?me=${a.pid}` });
    expect(r.data.players.map((p: { name: string }) => p.name)).toEqual(['Bikash']);
  });
  it('ranks this week by category and para', async () => {
    const a = await farmer('Rina'), b = await farmer('Bikash');
    for (const t of [a.token, b.token]) await call(act, { token: t, body: { actions: [{ t: 'visit', id: 'stadium' }] } });
    await call(act, { token: a.token, body: { actions: [{ t: 'visit', id: 'lakes' }] } });
    const w = await call(leaderboard, { url: '?board=week&cat=sights' });
    expect(w.data.entries.map((e: { name: string; value: number }) => [e.name, e.value])).toEqual([['Rina', 2], ['Bikash', 1]]);
    const p = await call(leaderboard, { url: '?board=para' });
    expect(p.data.paras[0]).toMatchObject({ para: 'MBB Stadium', players: 2 });
  });
});
