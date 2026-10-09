/**
 * Server configuration. On Vercel and in local dev it comes from process.env; on Cloudflare
 * Pages the router hands in the request's `env` (bindings such as the D1 database and secrets).
 */
export interface D1Like {
  prepare(sql: string): { bind(...v: unknown[]): { first<T = unknown>(): Promise<T | null>; run(): Promise<{ meta: { changes?: number } }>; all<T = unknown>(): Promise<{ results: T[] }> } };
}
export interface Env {
  DB?: D1Like;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Long random string used to sign sign-in links and OAuth state. */
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Resend API key for email sign-in links (optional). */
  RESEND_API_KEY?: string;
  /** "From" address for sign-in emails, e.g. "Haora Bari <login@biratdatta.tech>". */
  EMAIL_FROM?: string;
  /** Set on Vercel; we also treat Cloudflare as deployed. */
  VERCEL?: string;
  CF_PAGES?: string;
  NODE_ENV?: string;
}

let current: Env | null = null;
export function setEnv(e: Env): void { current = e; }
export function getEnv(): Env {
  if (current) return current;
  const p = (globalThis as { process?: { env?: Record<string, string> } }).process;
  return (p?.env || {}) as Env;
}
export const deployed = (e = getEnv()): boolean => !!(e.VERCEL || e.CF_PAGES || e.DB || e.NODE_ENV === 'production');
