/**
 * Cloudflare Worker entry. Static files in dist/ are served by Workers Static Assets
 * (see [assets] in wrangler.toml); every /api/* request lands here and is handed to the
 * same handler modules that Vercel and `npm run dev` use (api/*.ts).
 */
import * as act from '../api/act.js';
import * as authConfig from '../api/auth-config.js';
import * as authEmailCallback from '../api/auth-email-callback.js';
import * as authGoogleCallback from '../api/auth-google-callback.js';
import * as authStart from '../api/auth-start.js';
import * as authSignout from '../api/auth-signout.js';
import * as placeRequest from '../api/place-request.js';
import * as farm from '../api/farm.js';
import * as gift from '../api/gift.js';
import * as help from '../api/help.js';
import * as players from '../api/players.js';
import * as presence from '../api/presence.js';
import * as health from '../api/health.js';
import * as leaderboard from '../api/leaderboard.js';
import * as session from '../api/session.js';
import * as state from '../api/state.js';
import { setEnv, type Env } from '../api/_lib/env.js';

type Handler = (req: Request) => Promise<Response>;
const routes: Record<string, Partial<Record<string, Handler>>> = {
  act, 'auth-config': authConfig, 'auth-email-callback': authEmailCallback, 'auth-google-callback': authGoogleCallback,
  'auth-start': authStart, 'auth-signout': authSignout, 'place-request': placeRequest, farm, gift, health, help, leaderboard, players, presence, session, state,
};

interface WorkerEnv extends Env {
  /** Static assets binding (dist/), from [assets] in wrangler.toml. */
  ASSETS: { fetch(req: Request): Promise<Response> };
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    setEnv(env);
    const name = pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
    const mod = routes[name];
    if (!mod) return json({ error: 'Not found' }, 404);
    const h = mod[request.method.toUpperCase()];
    if (!h) return json({ error: 'Method not allowed' }, 405);
    return h(request);
  },
};
