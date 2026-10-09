/**
 * Cloudflare Pages Functions entry: every /api/* request lands here and is handed to the
 * same handler modules that Vercel and `npm run dev` use (api/*.ts).
 */
import * as act from '../../api/act.js';
import * as authConfig from '../../api/auth-config.js';
import * as authEmailCallback from '../../api/auth-email-callback.js';
import * as authGoogleCallback from '../../api/auth-google-callback.js';
import * as authStart from '../../api/auth-start.js';
import * as farm from '../../api/farm.js';
import * as gift from '../../api/gift.js';
import * as help from '../../api/help.js';
import * as players from '../../api/players.js';
import * as presence from '../../api/presence.js';
import * as health from '../../api/health.js';
import * as leaderboard from '../../api/leaderboard.js';
import * as session from '../../api/session.js';
import * as state from '../../api/state.js';
import { setEnv, type Env } from '../../api/_lib/env.js';

type Handler = (req: Request) => Promise<Response>;
const routes: Record<string, Partial<Record<string, Handler>>> = {
  act, 'auth-config': authConfig, 'auth-email-callback': authEmailCallback, 'auth-google-callback': authGoogleCallback,
  'auth-start': authStart, farm, gift, health, help, leaderboard, players, presence, session, state,
};

export const onRequest = async (ctx: { request: Request; env: Env }): Promise<Response> => {
  setEnv(ctx.env);
  const name = new URL(ctx.request.url).pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const mod = routes[name];
  if (!mod) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
  const h = mod[ctx.request.method.toUpperCase()];
  if (!h) return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
  return h(ctx.request);
};
