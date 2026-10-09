import { authConfig } from './_lib/auth.js';
import { guard, json } from './_lib/http.js';

/** GET /api/auth-config → which sign-in methods this server has keys for. */
export const GET = guard(async () => json(authConfig()));
