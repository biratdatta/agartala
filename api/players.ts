import { guard, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

const SEEN_WITHIN_MS = 45_000;
/** GET /api/players?me=<pid>: other players out in the city in the last 45 seconds. */
export const GET = guard(async (req) => {
  const me = (new URL(req.url).searchParams.get('me') || '').toUpperCase();
  const now = Date.now();
  const list = await (await getStore()).presenceRecent(now - SEEN_WITHIN_MS, 41);
  return json({ now, players: list.filter((p) => p.id !== me).slice(0, 40).map((p) => ({ id: p.id, name: p.name || 'A farmer', para: p.para, x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, face: Math.round(p.face * 100) / 100, age: now - p.t })) });
});
