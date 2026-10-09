import { weekId } from '../src/shared/week.js';
import { guard, json } from './_lib/http.js';
import { WEEK_CATS, getStore, type WeekCat } from './_lib/store.js';

/**
 * GET /api/leaderboard                     the richest named farms, all time
 * GET /api/leaderboard?board=week&cat=paddy this week's best in one category
 * GET /api/leaderboard?board=para          this week's earnings, para against para
 */
export const GET = guard(async (req) => {
  const q = new URL(req.url).searchParams; const store = await getStore(); const week = weekId(Date.now());
  if (q.get('board') === 'week') {
    const cat = (WEEK_CATS.includes(q.get('cat') as WeekCat) ? q.get('cat') : 'earned') as WeekCat;
    const rows = await store.weekTop(week, cat, 20);
    return json({ week, cat, entries: rows.map((e, i) => ({ rank: i + 1, name: e.name, para: e.para, value: e[cat], id: e.id })) });
  }
  if (q.get('board') === 'para') {
    const rows = await store.paraTop(week, 20);
    return json({ week, paras: rows.map((p, i) => ({ rank: i + 1, ...p })) });
  }
  const entries = await store.lbTop(50);
  return json({ entries: entries.map((e, i) => ({ rank: i + 1, name: e.name, worth: e.worth, day: e.day, id: e.id.slice(0, 8) })) });
});
