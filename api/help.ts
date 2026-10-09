import { NEED } from '../src/shared/constants.js';
import { loadByToken, loadByVisitCode, paraOf, publicId, view } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { HELP_PAY, farmSummary, mutate, note, utcDay } from './_lib/social.js';
import { getStore } from './_lib/store.js';

/**
 * POST /api/help { code } with Authorization: Bearer <session>
 * Waters every thirsty crop on a friend's farm, once a day per friend. The friend finds a note;
 * you get ₹20 from their grandfather for your trouble.
 */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now(); const token = bearer(req);
  const me = await loadByToken(store, token, now); if (!me || !token) return fail('Unknown session', 401);
  const body = (await readJson<{ code?: string }>(req)) || {};
  const them = await loadByVisitCode(store, body.code || '', now); if (!them) return fail('No farm has that visit code', 404);
  if (them.saveId === me.saveId) return fail('That is your own farm');
  const key = `help:${publicId(them.saveId)}:${publicId(me.saveId)}`; const today = utcDay(now);
  const last = await store.get<{ day: number }>(key);
  if (last && last.value.day === today) return fail('You already helped this farm today');
  const who = me.doc.state.name || 'A friend';
  let n = 0;
  const after = await mutate(store, them.saveId, now, (doc) => {
    n = 0; for (const p of doc.state.plots) if (p.owned && p.crop && !p.watered && p.growth < NEED[p.crop]) { p.watered = true; n++; }
    if (!n) return 'Their crops are all watered already';
    note(doc, now, `${who} from ${paraOf(me.doc.state)} watered ${n} of your plots.`); return null;
  });
  if (last) await store.put(key, { day: today }, last.rev); else await store.put(key, { day: today }, null);
  const mine = await mutate(store, me.saveId, now, (doc) => { doc.state.money += HELP_PAY; doc.state.stats.helped++; return null; });
  return json({ ...view(token, mine, store, now), watered: n, farm: farmSummary(after) });
});
