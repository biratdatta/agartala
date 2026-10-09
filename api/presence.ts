import { loadByToken, paraOf, publicId } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';
import { AREA } from '../src/shared/area.js';

/** POST /api/presence { x, z, face } with Authorization: Bearer <session>: "I am here", every few seconds while walking. */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const token = bearer(req);
  const body = (await readJson<{ x?: number; z?: number; face?: number }>(req)) || {};
  if (![body.x, body.z, body.face].every((v) => typeof v === 'number' && Number.isFinite(v))) return fail('Send { x, z, face }');
  const l = await loadByToken(store, token, now); if (!l) return fail('Unknown session', 401);
  const s = l.doc.state;
  await store.presenceUpsert({ id: publicId(l.saveId), name: s.name || '', para: paraOf(s), x: Math.max(AREA.x0, Math.min(AREA.x1, body.x!)), z: Math.max(AREA.z0, Math.min(AREA.z1, body.z!)), face: body.face!, t: now });
  return json({ ok: true });
});
