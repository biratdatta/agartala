import { loadByVisitCode, normVisit } from './_lib/game.js';
import { fail, guard, json } from './_lib/http.js';
import { farmSummary } from './_lib/social.js';
import { getStore } from './_lib/store.js';

/** GET /api/farm?code=4E38-112C: a friend's farm as a visitor sees it. */
export const GET = guard(async (req) => {
  const code = normVisit(new URL(req.url).searchParams.get('code') || '');
  if (code.length !== 8) return fail('A visit code looks like 4E38-112C');
  const l = await loadByVisitCode(await getStore(), code, Date.now());
  if (!l) return fail('No farm has that visit code', 404);
  return json(farmSummary(l));
});
