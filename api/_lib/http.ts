export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const fail = (error: string, status = 400): Response => json({ error }, status);

const MAX_BODY = 64 * 1024;
export async function readJson<T>(req: Request): Promise<T | null> {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text || '{}') as T; } catch { return null; }
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+([A-Za-z0-9_-]{20,100})$/);
  return m ? m[1] : null;
}

/** Wraps a handler so storage or config errors come back as JSON instead of a crash page. */
export function guard(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try { return await fn(req); }
    catch (err) { console.error('[api]', err); return fail(err instanceof Error ? err.message : 'Server error', 500); }
  };
}
