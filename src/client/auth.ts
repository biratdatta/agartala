/**
 * Sign-in, served by the game's own server (api/auth-*): Google, or a one-time email link.
 * Either way the browser ends up back on the game with #auth=<session> in the URL, which
 * Net picks up. Signing in on a new device brings that account's farm with it.
 */
export interface AuthConfig { google: boolean; email: boolean; required?: boolean }
export const auth = { config: { google: false, email: false, required: false } as AuthConfig, get available() { return this.config.google || this.config.email; } };

export async function loadAuthConfig(): Promise<AuthConfig> {
  try { const r = await fetch('/api/auth-config'); if (r.ok) auth.config = (await r.json()) as AuthConfig; } catch { /* offline */ }
  return auth.config;
}

/** Starts a sign-in for the farm behind `token`. Google navigates away; email returns a message for the player. */
export async function signIn(token: string | null, how: 'google' | 'email', email?: string): Promise<string> {
  if (!token && !auth.config.required) throw new Error('Sign-in needs the server');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch('/api/auth-start', { method: 'POST', headers, body: JSON.stringify({ how, email }) });
  const v = (await r.json().catch(() => ({}))) as { url?: string; message?: string; error?: string };
  if (!r.ok) throw new Error(v.error || 'Sign-in failed');
  if (v.url) { location.assign(v.url); return 'Opening Google…'; }
  return v.message || 'Check your email.';
}

/** Reads (and clears) what a sign-in left in the URL fragment. */
export function takeAuthResult(): { token?: string; email?: string; error?: string } | null {
  if (!/^#(auth|autherr)=/.test(location.hash)) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('autherr')) return { error: p.get('autherr') || 'Sign-in failed' };
  const token = p.get('auth') || '';
  return /^[A-Za-z0-9_-]{20,100}$/.test(token) ? { token, email: p.get('note') || '' } : null;
}
