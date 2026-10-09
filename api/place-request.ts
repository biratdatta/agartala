import { inArea } from '../src/shared/area.js';
import { loadByToken, publicId } from './_lib/game.js';
import { bearer, fail, guard, json, readJson } from './_lib/http.js';
import { getStore } from './_lib/store.js';

/** Kinds of place a player can ask for. */
const PLACE_KINDS = ['shop', 'market', 'temple', 'mosque', 'church', 'school', 'college', 'hospital', 'office', 'restaurant', 'park', 'landmark', 'home', 'other'] as const;
const PER_DAY = 5;
const ORIGIN = { lat: 23.8368, lon: 91.2826 }; const KX = Math.cos((ORIGIN.lat * Math.PI) / 180) * 111320, KZ = 110574;

/**
 * POST /api/place-request { name, kind, note?, x, z } with Authorization: Bearer <session>
 * A player asks for a real place that's missing from the game. Saved as kv rows `placereq:<time>:<id>`
 * for the owner to review (see README: "Place requests"). Five a day per farm.
 */
export const POST = guard(async (req) => {
  const store = await getStore(); const now = Date.now();
  const l = await loadByToken(store, bearer(req), now); if (!l) return fail('Sign in to send a request', 401);
  const b = (await readJson<{ name?: unknown; kind?: unknown; note?: unknown; x?: unknown; z?: unknown }>(req)) || {};
  const name = String(b.name ?? '').replace(/\s+/g, ' ').trim(); const note = String(b.note ?? '').replace(/\s+/g, ' ').trim();
  const kind = PLACE_KINDS.includes(b.kind as (typeof PLACE_KINDS)[number]) ? (b.kind as string) : 'other';
  const x = Number(b.x), z = Number(b.z);
  if (name.length < 2 || name.length > 80) return fail('Give the place a name (2 to 80 letters)');
  if (note.length > 400) return fail('Keep the note under 400 letters');
  if (!Number.isFinite(x) || !Number.isFinite(z) || !inArea(x, z)) return fail('Choose a spot inside the map');
  const day = Math.floor(now / 86400e3); const ck = `placereqcount:${l.saveId}:${day}`; const c = await store.get<{ n: number }>(ck);
  if ((c?.value.n || 0) >= PER_DAY) return fail(`That's ${PER_DAY} requests today. Thank you! Send more tomorrow.`, 429);
  await store.put(ck, { n: (c?.value.n || 0) + 1 }, c ? c.rev : null);
  const id = crypto.randomUUID().slice(0, 8);
  const row = {
    name, kind, note, x: Math.round(x), z: Math.round(z),
    lat: +(ORIGIN.lat - z / KZ).toFixed(6), lon: +(ORIGIN.lon + x / KX).toFixed(6),
    farm: publicId(l.saveId), email: l.doc.email || '', at: new Date(now).toISOString(), status: 'new',
  };
  await store.put(`placereq:${now}:${id}`, row, null);
  return json({ ok: true, message: `Thanks! "${name}" is on the list. We'll add it in a coming update.` });
});
