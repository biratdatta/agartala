import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as config } from '../api/auth-config.js';
import { GET as emailCallback } from '../api/auth-email-callback.js';
import { GET as googleCallback } from '../api/auth-google-callback.js';
import { POST as start } from '../api/auth-start.js';
import { POST as session } from '../api/session.js';
import { POST as signout } from '../api/auth-signout.js';
import { sign, verify } from '../api/_lib/auth.js';
import { setEnv } from '../api/_lib/env.js';
import { D1Store, MemoryStore, setStore } from '../api/_lib/store.js';
import { fakeD1, sqlite } from './d1.js';

const ENV = { AUTH_SECRET: 'x'.repeat(40), GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'shh', RESEND_API_KEY: 're_test' };
const req = (url: string, init: RequestInit & { token?: string; cookie?: string } = {}) => {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token) h.authorization = `Bearer ${init.token}`;
  if (init.cookie) h.cookie = init.cookie;
  return new Request(`https://agartala.biratdatta.tech${url}`, { ...init, headers: h });
};
const guest = async () => (await (await session(req('/api/session', { method: 'POST', body: '{}' }))).json()) as { token: string; code: string; signedIn: boolean };
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fragment = (r: Response) => new URLSearchParams(new URL(r.headers.get('location')!).hash.slice(1));

let sent: { to: string[]; text: string }[] = [];
beforeEach(async () => {
  setEnv({ ...ENV }); setStore(sqlite ? new D1Store(await fakeD1()) : new MemoryStore()); sent = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url === 'https://api.resend.com/emails') { sent.push(JSON.parse(String(init.body))); return new Response('{}'); }
    if (url === 'https://oauth2.googleapis.com/token') {
      const p = new URLSearchParams(String(init.body));
      if (p.get('code') !== 'good') return new Response('{}', { status: 400 });
      return new Response(JSON.stringify({ id_token: `h.${b64({ iss: 'https://accounts.google.com', aud: ENV.GOOGLE_CLIENT_ID, sub: 'g-123', email: 'birat@example.com', email_verified: true, exp: Date.now() / 1000 + 600 })}.s` }));
    }
    throw new Error('unexpected fetch ' + url);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('auth', () => {
  it('signs and rejects tampered or expired tokens', async () => {
    const t = await sign({ a: 1 }, 60);
    expect(await verify<{ a: number }>(t)).toMatchObject({ a: 1 });
    expect(await verify(t.slice(0, -2) + 'xx')).toBeNull();
    expect(await verify(await sign({ a: 1 }, -1))).toBeNull();
  });

  it('reports which methods are configured', async () => {
    expect(await (await config(req('/api/auth-config'))).json()).toEqual({ google: true, email: true, required: false });
    setEnv({ AUTH_SECRET: 'short' });
    expect(await (await config(req('/api/auth-config'))).json()).toEqual({ google: false, email: false, required: false });
  });

  it('links a farm with Google, then brings that farm to a second device', async () => {
    const a = await guest();
    const s = await start(req('/api/auth-start', { method: 'POST', token: a.token, body: JSON.stringify({ how: 'google' }) }));
    const { url } = (await s.json()) as { url: string };
    const cookie = s.headers.get('set-cookie')!.split(';')[0];
    const u = new URL(url); expect(u.host).toBe('accounts.google.com');
    expect(u.searchParams.get('redirect_uri')).toBe('https://agartala.biratdatta.tech/api/auth-google-callback');
    const state = u.searchParams.get('state')!;

    // a different browser (no cookie) cannot finish this sign-in
    expect(fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${state}`))).get('autherr')).toMatch(/another browser/);
    // a bad code is refused
    expect(fragment(await googleCallback(req(`/api/auth-google-callback?code=bad&state=${state}`, { cookie }))).get('autherr')).toMatch(/Google/);

    const ok = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${state}`, { cookie })));
    const t1 = ok.get('auth')!; expect(ok.get('note')).toBe('birat@example.com');
    const v1 = await (await session(req('/api/session', { method: 'POST', token: t1, body: '{}' }))).json();
    expect(v1).toMatchObject({ code: a.code, signedIn: true, email: 'birat@example.com' });

    // second device: a fresh guest signs in with the same Google account and gets the first farm
    const b = await guest(); expect(b.code).not.toBe(a.code);
    const s2 = await start(req('/api/auth-start', { method: 'POST', token: b.token, body: JSON.stringify({ how: 'google' }) }));
    const st2 = new URL(((await s2.json()) as { url: string }).url).searchParams.get('state')!;
    const t2 = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st2}`, { cookie: s2.headers.get('set-cookie')!.split(';')[0] }))).get('auth')!;
    expect((await (await session(req('/api/session', { method: 'POST', token: t2, body: '{}' }))).json()).code).toBe(a.code);
  });

  it('signs in by a one-time email link', async () => {
    const a = await guest();
    const r = await start(req('/api/auth-start', { method: 'POST', token: a.token, body: JSON.stringify({ how: 'email', email: ' Birat@Example.com ' }) }));
    expect(r.status).toBe(200); expect(sent[0].to).toEqual(['birat@example.com']);
    const link = sent[0].text.match(/https:\/\/\S+/)![0];
    const path = new URL(link).pathname + new URL(link).search;
    const first = fragment(await emailCallback(req(path)));
    expect(first.get('auth')).toBeTruthy();
    expect(fragment(await emailCallback(req(path))).get('autherr')).toMatch(/already used/);
    const v = await (await session(req('/api/session', { method: 'POST', token: first.get('auth')!, body: '{}' }))).json();
    expect(v).toMatchObject({ code: a.code, signedIn: true, email: 'birat@example.com' });
  });

  it('refuses bad emails, unknown sessions and email floods', async () => {
    const a = await guest();
    expect((await start(req('/api/auth-start', { method: 'POST', token: a.token, body: JSON.stringify({ how: 'email', email: 'nope' }) }))).status).toBe(400);
    expect((await start(req('/api/auth-start', { method: 'POST', token: 'z'.repeat(43), body: JSON.stringify({ how: 'google' }) }))).status).toBe(401);
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await start(req('/api/auth-start', { method: 'POST', token: a.token, body: JSON.stringify({ how: 'email', email: 'a@b.co' }) }))).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
  });

  describe('when sign-in is required', () => {
    beforeEach(() => setEnv({ ...ENV, REQUIRE_SIGNIN: '1' }));
    const post = (body: unknown, token?: string) => session(req('/api/session', { method: 'POST', token, body: JSON.stringify(body) }));

    it('makes no guest farms and refuses farm codes', async () => {
      const r = await post({});
      expect(r.status).toBe(401); expect(await r.json()).toMatchObject({ signin: true });
      expect((await post({ code: 'ABCD-2345' })).status).toBe(401);
      expect(await (await config(req('/api/auth-config'))).json()).toMatchObject({ google: true, required: true });
    });

    it('signs in with Google from nothing and creates that account\'s farm', async () => {
      const s = await start(req('/api/auth-start', { method: 'POST', body: JSON.stringify({ how: 'google' }) }));
      expect(s.status).toBe(200);
      const st = new URL(((await s.json()) as { url: string }).url).searchParams.get('state');
      const cookie = s.headers.get('set-cookie')!.split(';')[0];
      const t = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st}`, { cookie }))).get('auth')!;
      const v = (await (await post({}, t)).json()) as { signedIn: boolean; email: string; code: string };
      expect(v).toMatchObject({ signedIn: true, email: 'birat@example.com' });

      // a second sign-in (another device) brings back the same farm
      const s2 = await start(req('/api/auth-start', { method: 'POST', body: JSON.stringify({ how: 'google' }) }));
      const st2 = new URL(((await s2.json()) as { url: string }).url).searchParams.get('state');
      const t2 = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st2}`, { cookie: s2.headers.get('set-cookie')!.split(';')[0] }))).get('auth')!;
      expect(((await (await post({}, t2)).json()) as { code: string }).code).toBe(v.code);

      // "New farm" keeps the account and points it at the new farm
      const n = (await (await post({ reset: true }, t2)).json()) as { signedIn: boolean; code: string; token: string };
      expect(n.signedIn).toBe(true); expect(n.code).not.toBe(v.code);
      const s3 = await start(req('/api/auth-start', { method: 'POST', body: JSON.stringify({ how: 'google' }) }));
      const st3 = new URL(((await s3.json()) as { url: string }).url).searchParams.get('state');
      const t3 = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st3}`, { cookie: s3.headers.get('set-cookie')!.split(';')[0] }))).get('auth')!;
      expect(((await (await post({}, t3)).json()) as { code: string }).code).toBe(n.code);
    });

    it('locks out guest farms made before the switch, but lets them be linked', async () => {
      setEnv({ ...ENV }); const g = await guest(); setEnv({ ...ENV, REQUIRE_SIGNIN: '1' });
      expect((await post({}, g.token)).status).toBe(401);
      const s = await start(req('/api/auth-start', { method: 'POST', token: g.token, body: JSON.stringify({ how: 'google' }) }));
      const st = new URL(((await s.json()) as { url: string }).url).searchParams.get('state');
      const t = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st}`, { cookie: s.headers.get('set-cookie')!.split(';')[0] }))).get('auth')!;
      expect(((await (await post({}, t)).json()) as { code: string; signedIn: boolean })).toMatchObject({ code: g.code, signedIn: true });
    });

    it('signs out: the session stops working and the account keeps its farm', async () => {
      const s = await start(req('/api/auth-start', { method: 'POST', body: JSON.stringify({ how: 'google' }) }));
      const st = new URL(((await s.json()) as { url: string }).url).searchParams.get('state');
      const t = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st}`, { cookie: s.headers.get('set-cookie')!.split(';')[0] }))).get('auth')!;
      const code = ((await (await post({}, t)).json()) as { code: string }).code;
      expect((await signout(req('/api/auth-signout', { method: 'POST', token: t, body: '{}' }))).status).toBe(200);
      expect((await post({}, t)).status).toBe(401);
      // signing in again brings the same farm back
      const s2 = await start(req('/api/auth-start', { method: 'POST', body: JSON.stringify({ how: 'google' }) }));
      const st2 = new URL(((await s2.json()) as { url: string }).url).searchParams.get('state');
      const t2 = fragment(await googleCallback(req(`/api/auth-google-callback?code=good&state=${st2}`, { cookie: s2.headers.get('set-cookie')!.split(';')[0] }))).get('auth')!;
      expect(((await (await post({}, t2)).json()) as { code: string }).code).toBe(code);
    });

    it('stays open to guests if Google is not configured (so nobody is locked out)', async () => {
      setEnv({ AUTH_SECRET: 'x'.repeat(40), REQUIRE_SIGNIN: '1' });
      expect((await post({})).status).toBe(201);
    });
  });
});
