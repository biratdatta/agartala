import { guard, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** GET /api/leaderboard: the top farmers by net worth. Only farms with a name appear. */
export const GET = guard(async () => {
  const entries = await (await getStore()).lbTop(50);
  return json({ entries: entries.map((e, i) => ({ rank: i + 1, name: e.name, worth: e.worth, day: e.day, id: e.id.slice(0, 8) })) });
});
