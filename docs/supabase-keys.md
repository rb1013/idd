# Supabase API keys — switch from legacy to publishable / secret keys

**Project:** new West project `zmwckczpxvzgwznxzfov` (us-west-1)
**Status:** plan agreed (option B) — **ready to start**. Prerequisite met: the West move is done and tested on legacy keys (migrations 096–105 on West).
**Written:** 2026-11-25 · **Updated:** 2026-11-26 (checked against current code)

---

## Why

- Supabase retires the **legacy `anon` / `service_role` keys in early 2027**.
- The mobile app has the key **built in**. Every installed copy with a legacy key would stop working then unless users update — so switch **before launch**, while there are no users.
- New keys: `sb_publishable_…` (apps) and `sb_secret_…` (servers / functions). They are **not JWTs**, so Supabase's per-function **"Verify JWT with legacy secret"** check can't be used with them. Supabase's recommended setup: turn that check **off** and have each function check its caller itself.

**Options considered:** (A) launch on legacy keys and force an app update before early 2027; (B) switch now. **Chosen: B** — there's no launch date, and switching with no users is the cheapest moment.

---

## Order

1. ~~Finish the West move on **legacy** keys~~ — **done** (both `.env` files on West's legacy anon key; tested).
2. **Delete the unused functions first** — `send-message`, `send-guardian-message`, `check-tutorial-quota` — so they aren't updated for nothing.
3. Phases 1–5 below.
4. Turn legacy keys **off** in the new project, retest.
5. **Build with Xcode 26** (Expo SDK 56 — avoids the iOS 27 crash) and verify everything on devices.
6. Only then the **Expo 58 upgrade** (`expo-58-upgrade.md`) as a **separate** build and test pass.

**Why separate builds (decided 2026-11-26):** if both changes ship in one build, a problem could come from either — separate builds keep the root cause obvious.

---

## Phase 1 — functions check their own callers (code)

| Function | Who may call it | Check to add |
|---|---|---|
| `create-tutorial` | Logged-in guardian | Get the user from their token; use **that** id, never one sent in the request. **Priority** — verified 2026-11-26: it takes `guardian_id` from the request body and uses it for the tutorial owner and the monthly quota, so today a caller could create tutorials (and use up quota) as another guardian |
| `regenerate-frame` | The tutorial's creator | Logged-in user **and** they created the tutorial |
| `approve-tutorial`, `reject-tutorial` | Admins only | Logged-in user **and** listed in `admins` (also fixes the open TODO: no admin check today) |
| `process-tutorial-job` | Only the database webhook | Request must carry the **secret key** (compared in code) |
| `check-email` | Anyone (sign-up, logged out) | Stays open by design — only answers "is this email taken?" |
| `check-tutorial-quota` | Nobody (no caller in the apps) | **Delete** (decided 2026-11-26) — the quota pill reads `guardian_tutorial_quota` + `app_settings` directly, and `create-tutorial` / `regenerate-tutorial` enforce the quota |
| `create-user-account`, `delete-guardian`, `delete-learner`, `guardian-action`, `regenerate-tutorial` | — | Already check the caller (`auth.getUser`) — **no change needed** (works the same with the new keys: it checks the user's login token, not the API key) |
| ~~`send-guardian-message`~~, ~~`send-message`~~ | — | **No longer used** — guardian and learner chat insert directly (migrations 099, 100). Delete the functions (repo + project) before phase 2; nothing to migrate |

- New checks use **`auth.getUser(token)`** — the same pattern already in the code (decided 2026-11-26). Phase 1 only touches the functions that don't check today.

**Functions that get a new `auth.getUser(token)` check** (verified 2026-11-26: none of these call `getUser` today):

| Function | Called from | After `getUser`, also check |
|---|---|---|
| `create-tutorial` | Mobile — Create Tutorial | Use the token's user as the guardian (ignore `guardian_id` from the body); user must be a guardian |
| `regenerate-frame` | Mobile — Edit slide (image / narration) | User created the slide's tutorial (`tutorials.created_by_guardian_id`) |
| `approve-tutorial` | Admin portal — Tutorials | User is in `admins` |
| `reject-tutorial` | Admin portal — Tutorials | User is in `admins` |

**Not getting `getUser`:**
- `process-tutorial-job` — called by the database webhook, not a user: checks the **secret key** in the `Authorization` header instead.
- `check-email` — stays open (sign-up, before login).
- `create-user-account`, `delete-guardian`, `delete-learner`, `guardian-action`, `regenerate-tutorial` — already use `getUser`; unchanged.
- `send-message`, `send-guardian-message`, `check-tutorial-quota` — being deleted.
- **Why not `auth.getClaims`:**
  - It only saves a call to Supabase Auth (~20–50 ms per function call) **after** switching to the new **JWT signing keys**; with today's legacy JWT secret it calls Auth anyway — **no saving now**.
  - After that switch it checks the token locally (signature + expiry only), so a **deleted or logged-out** user's token keeps working until it expires (≤ ~1 h). `getUser` asks Auth live and rejects them immediately — which matters most for account deletion and the guardian 🛡️ actions.

| | Today (legacy JWT secret) | After switching to JWT signing keys |
|---|---|---|
| `getClaims` saves a round trip? | ❌ no | ✅ ~20–50 ms per call |
| Rejects deleted / logged-out users at once? | `getUser` ✅ · `getClaims` ✅ (calls Auth too) | `getUser` ✅ · `getClaims` ❌ (until token expiry) |
- Today `create-user-account` is the only function deployed with JWT verification **off**; after this, **all** are.

## Phase 2 — functions use the new secret key (code + secret)

- Functions now use `SUPABASE_SERVICE_ROLE_KEY` (legacy, injected by Supabase) — read by the functions today, incl. the 3 being deleted.
- Add our own secret, e.g. `SERVICE_SECRET_KEY = sb_secret_…` (`supabase secrets set`; names starting with `SUPABASE_` are reserved).
- One shared helper (`_shared/admin.ts`) creates the admin client from it; every function still in use (**11**) uses the helper.
- Redeploy **all** of them with `--no-verify-jwt` (`check-email` must be callable while logged out — it stays open by design).

## Phase 3 — tutorial webhook (dashboard)

Integrations → Database Webhooks → `on_tutorial_job_insert` → change the header to `Authorization: Bearer <sb_secret_… key>`. `process-tutorial-job` accepts it via its own check (phase 1).

## Phase 4 — apps (.env)

| App | Variable | New value |
|---|---|---|
| Mobile `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` |
| Admin `apps/admin/.env` (+ hosting settings) | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` |

- **`.env` edits:** comment out the current (legacy) lines with a short note and add the new lines below with their own note — don't overwrite (same as the West switch; rollback = swap which block is commented).
- Code that reads the key: `apps/mobile/src/lib/supabase.ts`, the direct `delete-learner` call in `EditUserScreen.tsx:171`, `apps/admin/src/lib/supabase.ts`. Nothing else. (Verified: the `delete-learner` call sends the user's login token as `Authorization` and the key only as `apikey`, so it works with a publishable key.)
- Optional: rename the variables to `…PUBLISHABLE_KEY`.
- **Mobile:** restart Expo with `-c`; a new build is needed for TestFlight / App Store — built with **Xcode 26**, separate from the Expo 58 build (see Order).
- **Admin portal:** update the same variable in the **hosting settings** and **redeploy**. Check: an admin can log in, approve / reject a tutorial, edit chat phrases, upload a chat symbol.

**Not affected (verified 2026-11-26):** live chat, storage uploads and direct inserts (they use the user's login token, not the key type); the YIA website (its own Supabase project); `supabase-js` versions (apps ^2.107, functions esm.sh `@2`) support the new keys. The tutorial webhook (phase 3) is the only database-side user of a legacy key — no `pg_cron`, nothing in Vault, no other database → function calls.

## Phase 5 — test, turn legacy keys off, build

1. Test everything (move step 8 list) **plus** the new checks:
   - non-admin calling `approve-tutorial` / `reject-tutorial` → refused
   - guardian regenerating someone else's slide → refused
   - `process-tutorial-job` called without the secret → refused
   - sign-up's `check-email` still works while logged out
2. Dashboard → API Keys → **disable legacy keys**. Retest — anything still using them fails now, not after launch.
3. Build the app with **Xcode 26** (prebuild → Xcode → bump build number) with the publishable key, and verify on devices — **its own build**, before the Expo 58 upgrade (see Order).

**Later, optional:** move user session tokens to Supabase's new **JWT signing keys** (dashboard switch; `getUser` keeps working unchanged). Only then would switching the checks to `getClaims` save the Auth call — weigh that against losing the immediate rejection of deleted / logged-out users (see phase 1).

---

## Who does what

| Phase | Who |
|---|---|
| Delete unused functions from the repo (and say which to delete in the project) | Claude |
| 1, 2 (function code + shared helper, ~7 functions changed) | Claude |
| Delete the unused functions in the project (`supabase functions delete …`) | You |
| 2 (set secret, deploy), 3, 4, 5 | You (dashboard / `.env` / build) |
