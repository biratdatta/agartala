import { guard, json } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** GET /api/health → { ok, store }. On Cloudflare it should say "D1Store"; on Vercel "SupabaseStore". */
export const GET = guard(async () => json({ ok: true, store: (await getStore()).name, time: Date.now() }));
