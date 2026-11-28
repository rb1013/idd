// Shared admin client + caller checks for all edge functions (Supabase key switch — docs/supabase-keys.md).
//
// • ADMIN KEY: the new secret key (sb_secret_…) from our own SERVICE_SECRET_KEY secret (names starting
//   with SUPABASE_ are reserved, hence our own name). No legacy fallback any more (removed in rollout
//   step 9): if the secret is missing, functions fail loudly instead of quietly using a disabled key.
//   ⚠️ Don't deploy these to the old East project — it has no SERVICE_SECRET_KEY.
// • CALLER CHECKS: functions are deployed with --no-verify-jwt (the new keys aren't JWTs, so Supabase's
//   built-in check can't be used), so each function checks its caller itself:
//     getCaller()       — the logged-in user from the request's login token (auth.getUser: asks Supabase
//                          Auth live, so a deleted / logged-out user is refused at once)
//     isAdmin()         — that user is in `admins`
//     isServiceRequest()— the request carries the secret key itself (the database webhook)

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const SECRET_KEY = Deno.env.get('SERVICE_SECRET_KEY') ?? '';

/** Supabase client with full access (bypasses RLS). Server-side only — never expose the secret key. */
export function adminClient(): SupabaseClient {
  if (!SECRET_KEY) throw new Error('SERVICE_SECRET_KEY secret is not set (Edge Functions → Secrets)');
  return createClient(SUPABASE_URL, SECRET_KEY, {
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

/** True if the request carries the secret key itself — only the database webhook does this. */
export function isServiceRequest(req: Request): boolean {
  const token = bearerToken(req);
  return !!SECRET_KEY && token === SECRET_KEY;
}
