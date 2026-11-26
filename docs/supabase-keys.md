# Supabase API keys — switch from legacy to publishable / secret keys

**Project:** new West project `zmwckczpxvzgwznxzfov` (us-west-1)
**Status:** plan agreed (option B) — **not started**. Do it after the West move is tested on legacy keys (move steps 7–8).
**Written:** 2026-11-25

---

## Why

- Supabase retires the **legacy `anon` / `service_role` keys in early 2027**.
- The mobile app has the key **built in**. Every installed copy with a legacy key would stop working then unless users update — so switch **before launch**, while there are no users.
- New keys: `sb_publishable_…` (apps) and `sb_secret_…` (servers / functions). They are **not JWTs**, so Supabase's per-function **"Verify JWT with legacy secret"** check can't be used with them. Supabase's recommended setup: turn that check **off** and have each function check its caller itself.

**Options considered:** (A) launch on legacy keys and force an app update before early 2027; (B) switch now. **Chosen: B** — there's no launch date, and switching with no users is the cheapest moment.

---

## Order

1. Finish the West move on **legacy** keys: move step 7 (legacy anon key in both `.env` files) and step 8 (test everything). Proves the new project works before changing a second thing.
2. Phases 1–5 below.
3. Turn legacy keys **off** in the new project, retest, then build the app.

---

## Phase 1 — functions check their own callers (code)

| Function | Who may call it | Check to add |
|---|---|---|
| `create-tutorial` | Logged-in guardian | Get the user from their token; use **that** id, never one sent in the request |
| `regenerate-frame` | The tutorial's creator | Logged-in user **and** they created the tutorial |
| `approve-tutorial`, `reject-tutorial` | Admins only | Logged-in user **and** listed in `admins` (also fixes the open TODO: no admin check today) |
| `process-tutorial-job` | Only the database webhook | Request must carry the **secret key** (compared in code) |
| `check-email` | Anyone (sign-up, logged out) | Stays open by design — only answers "is this email taken?" |
| `check-tutorial-quota` | Nobody (no caller in the apps) | Delete it, or lock to logged-in guardians |
| `create-user-account`, `delete-guardian`, `delete-learner`, `guardian-action`, `regenerate-tutorial` | — | Already check the caller (`auth.getUser`) — no change needed |
| ~~`send-guardian-message`~~, ~~`send-message`~~ | — | **No longer used** — guardian and learner chat insert directly (migrations 099, 100). Delete the functions; nothing to migrate |

- Check the user with **`auth.getClaims(token)`** (verifies the token locally) instead of `auth.getUser(token)` (an extra network call to Supabase each time) — also makes chat sending a little faster (see `chat-time.md`).
- Today `create-user-account` is the only function deployed with JWT verification **off**; after this, **all** are.

## Phase 2 — functions use the new secret key (code + secret)

- Functions now use `SUPABASE_SERVICE_ROLE_KEY` (legacy, injected by Supabase).
- Add our own secret, e.g. `SERVICE_SECRET_KEY = sb_secret_…` (`supabase secrets set`; names starting with `SUPABASE_` are reserved).
- One shared helper (`_shared/admin.ts`) creates the admin client from it; all 14 functions use the helper.
- Redeploy **all** functions with `--no-verify-jwt`.

## Phase 3 — tutorial webhook (dashboard)

Integrations → Database Webhooks → `on_tutorial_job_insert` → change the header to `Authorization: Bearer <sb_secret_… key>`. `process-tutorial-job` accepts it via its own check (phase 1).

## Phase 4 — apps (.env)

| App | Variable | New value |
|---|---|---|
| Mobile `apps/mobile/.env` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` |
| Admin `apps/admin/.env` (+ hosting settings) | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` |

- Code that reads the key: `apps/mobile/src/lib/supabase.ts`, the direct `delete-learner` call in `EditUserScreen.tsx:171`, `apps/admin/src/lib/supabase.ts`. Nothing else.
- Optional: rename the variables to `…PUBLISHABLE_KEY`.
- Mobile: restart Expo with `-c`; a new build is needed for TestFlight / App Store. Admin: redeploy.

## Phase 5 — test, turn legacy keys off, build

1. Test everything (move step 8 list) **plus** the new checks:
   - non-admin calling `approve-tutorial` / `reject-tutorial` → refused
   - guardian regenerating someone else's slide → refused
   - `process-tutorial-job` called without the secret → refused
   - sign-up's `check-email` still works while logged out
2. Dashboard → API Keys → **disable legacy keys**. Retest — anything still using them fails now, not after launch.
3. Build the app (prebuild → Xcode → bump build number) with the publishable key.

**Later, optional:** move user session tokens to Supabase's new **JWT signing keys**. With `getClaims` in place it's a dashboard switch, no code change.

---

## Who does what

| Phase | Who |
|---|---|
| 1, 2 (function code + shared helper, ~7 functions changed) | Claude |
| 2 (set secret, deploy), 3, 4, 5 | You (dashboard / `.env` / build) |
