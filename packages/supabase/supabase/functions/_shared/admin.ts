// Shared admin client + caller checks for all edge functions (Supabase key switch — docs/supabase-keys.md).
//
// • ADMIN KEY: the new secret key (sb_secret_…) from our own SERVICE_SECRET_KEY secret, falling back to
//   the legacy service_role key Supabase injects (SUPABASE_SERVICE_ROLE_KEY) until that secret is set.
//   So these functions can be deployed while legacy keys still work, and switch over by just setting
//   SERVICE_SECRET_KEY — no redeploy. (Names starting with SUPABASE_ are reserved, hence our own name.)
// • CALLER CHECKS: functions are deployed with --no-verify-jwt (the new keys aren't JWTs, so Supabase's
//   built-in check can't be used), so each function checks its caller itself:
//     getCaller()       — the logged-in user from the request's login token (auth.getUser: asks Supabase
//                          Auth live, so a deleted / logged-out user is refused at once)
//     isAdmin()         — that user is in `admins`
//     isServiceRequest()— the request carries the admin key itself (the database webhook)

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const NEW_SECRET_KEY    = Deno.env.get('SERVICE_SECRET_KEY') ?? '';
const LEGACY_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Key with full access (bypasses RLS): the new secret key, or the legacy service_role key until it's set. */
export const ADMIN_KEY = NEW_SECRET_KEY || LEGACY_SERVICE_KEY;

/** Supabase client with full access. Server-side only — never expose ADMIN_KEY. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ADMIN_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** The bearer token from the Authorization header, or null. */
function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

/** The logged-in user who made this request, or null (no / invalid / expired token, deleted user). */
export async function getCaller(req: Request, admin: SupabaseClient): Promise<User | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user ?? null;
}

/** True if this user is a Co-Heart admin (row in `admins`). */
export async function isAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from('admins').select('id').eq('id', userId).maybeSingle();
  return !!data;
}

/** True if the request carries the admin key itself — only the database webhook does this.
 *  Accepts the new secret key, and the legacy service_role key while it still exists. */
export function isServiceRequest(req: Request): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  return (!!NEW_SECRET_KEY && token === NEW_SECRET_KEY) || (!!LEGACY_SERVICE_KEY && token === LEGACY_SERVICE_KEY);
}
