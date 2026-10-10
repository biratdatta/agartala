import { PANDALS, PUJO_SEASON_ID } from '../src/shared/pujo.js';
import { guard, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/**
 * GET /api/pujo-board → this Puja's pandal hoppers: the farms that saw every pandal (first first),
 * then everyone else by how many they've seen, with which pandals each has visited.
 */
export const GET = guard(async () => {
  const rows = await (await getStore()).pujoTop(PUJO_SEASON_ID, 30);
  return json({ total: PANDALS.length, entries: rows.map((e, i) => ({ rank: i + 1, name: e.name, para: e.para, pandals: e.pandals, seen: e.seen ? e.seen.split(',') : [], allAt: e.allAt || null, id: e.id })) });
});
