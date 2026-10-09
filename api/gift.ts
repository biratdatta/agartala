import { ITEMS } from '../src/shared/constants.js';
import { loadByToken, loadByVisitCode, paraOf, view } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { giftable, mutate, note } from './_lib/social.js';
import { getStore } from './_lib/store.js';

/** POST /api/gift { code, item, n } with Authorization: Bearer <session>: sends goods from your store to a friend's. */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const token = bearer(req);
  const me = await loadByToken(store, token, now); if (!me || !token) return fail('Unknown session', 401);
  const body = (await readJson<{ code?: string; item?: string; n?: number }>(req)) || {};
  const item = String(body.item || ''); const n = Number(body.n);
  if (!giftable(item)) return fail('You cannot send that');
  if (!Number.isInteger(n) || n < 1 || n > 50) return fail('Send between 1 and 50');
  const them = await loadByVisitCode(store, body.code || '', now); if (!them) return fail('No farm has that visit code', 404);
  if (them.saveId === me.saveId) return fail('That is your own farm');
  const name = ITEMS[item].name.toLowerCase();
  const mine = await mutate(store, me.saveId, now, (doc) => (doc.state.inv[item] < n ? 'You do not have that many' : ((doc.state.inv[item] -= n), null)));
  try {
    const who = me.doc.state.name || 'A friend';
    await mutate(store, them.saveId, now, (doc) => { doc.state.inv[item] += n; note(doc, now, `${who} from ${paraOf(me.doc.state)} sent you ${n} ${name}.`); return null; });
  } catch (e) {
    await mutate(store, me.saveId, now, (doc) => { doc.state.inv[item] += n; return null; }); // give it back
    throw e;
  }
  return json({ ...view(token, mine, store, now), sent: { item, n, to: them.doc.state.name || 'your friend' } });
});
