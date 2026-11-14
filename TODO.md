# IDD Platform — Todo List

## 🔒 Security: Edge functions that don't verify the caller

**Found:** 2026-11-10

### Background

- Edge functions use `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically at runtime. It is never in the repo or `.env`.
- The service-role key **bypasses RLS**, so each function must check who is calling it.
- The Supabase gateway only requires *a* valid JWT. The public **anon key counts**, and it ships inside the mobile app bundle, so anyone can extract it.
- Direct table writes from the admin portal are safe. They use the anon key plus the admin's session, and RLS `is_admin()` policies block non-admins (`002_rls_policies.sql`, `042_app_settings.sql`, `056_blocked_words_admin.sql`, …).

### Audit

| Function | Called from | Caller check | Risk |
|---|---|---|---|
| `approve-tutorial` | Admin `TutorialsPage` | ❌ none | **High:** anyone can approve any tutorial and trigger a push to the guardian |
| `reject-tutorial` | Admin `TutorialsPage` | ❌ none | **High:** anyone can reject any tutorial |
| `create-tutorial` | Mobile `CreateTutorialScreen` | ❌ none; trusts `guardian_id` from request body | **High:** anyone can create tutorials as any guardian, use up their monthly quota, and **spend our Claude/OpenAI credits** |
| `check-tutorial-quota` | — (no app caller found) | ❌ none | Low: read-only quota lookup. Delete if unused |
| `check-email` | Mobile `RegisterScreen` (before sign-up) | ❌ none (by design; user isn't logged in yet) | Low: allows checking which emails are registered. Consider rate limiting |
| `delete-learner` | Admin `ReportsPage` | ✅ JWT + `admins` table | — (reference pattern) |

### Tasks

- [ ] **`approve-tutorial`:** add an admin check (401 if no valid user, 403 if not in `admins`)
- [ ] **`reject-tutorial`:** same admin check
- [ ] **`create-tutorial`:** get the guardian from the JWT (`auth.getUser()` → look up `guardians` by auth user id) instead of trusting `guardian_id` in the body; 403 if they don't match
- [ ] **`check-tutorial-quota`:** confirm it's unused, then delete it, or add a guardian check
- [ ] **`check-email`:** decide whether email enumeration is acceptable; if not, rate limit or return a generic response
- [ ] Review the remaining functions that call `getUser` (`create-user-account`, `delete-guardian`, `guardian-action`, `process-tutorial-job`, `regenerate-frame`, `regenerate-tutorial`, `send-message`, `send-guardian-message`) to confirm they check **ownership** (the caller owns the record they act on), not just login
- [ ] Redeploy changed functions: `cd packages/supabase && npx supabase functions deploy <name>`
- [ ] Test: calling each fixed function with only the anon key (no user session) returns 401; with a non-admin/other guardian's session returns 403

### Pattern to copy (adapted from `delete-learner/index.ts`, which also lets guardians delete their own learners)

```ts
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
}

const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
if (authErr || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
}

const { data: admin } = await supabaseAdmin.from('admins').select('id').eq('id', user.id).single();
if (!admin) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
}
```

> A request made with only the anon key has no user, so `getUser()` fails and the 401 branch above catches it.

---

## 🔒 Security: Guardians can skip tutorial review

**Found:** 2026-11-14

### Background

- Private AI tutorials are auto-approved when generation finishes (`process-tutorial-job/index.ts:124`: `is_public === false ? 'approved' : 'preview'`). Only public ones go through admin review.
- The RLS policy **"Guardian can update own tutorials"** (`migrations/011_tutorial_platform_rls.sql:46`) is `FOR UPDATE USING (created_by_guardian_id = auth.uid())`, with no column limits. A guardian can change **any** column on their own tutorials.
- The app itself sets `status` from the client (`TutorialPreviewScreen.tsx:248`, `'pending'`, and `:259`, `'preview'`), so the database currently trusts the client to choose the status.

### How the review is skipped (direct API calls, not through the app UI)

A logged-in guardian with the anon key (see below) could:
1. Create a **private** tutorial, which is auto-approved, then `update tutorials set is_public = true`. It goes straight into the shared library with no review.
2. Set `status = 'approved'` directly on a public tutorial in `preview`, `pending` or `rejected`.
3. Possibly edit an approved public tutorial's content afterwards (title/description here; check frames in `tutorial_frames` too).

### Tasks

- [ ] Add a `BEFORE UPDATE` trigger on `tutorials` that, for non-service-role / non-admin callers, rejects:
  - `status` changing to `approved` (only `approve-tutorial` / admins may do this)
  - `status` changing to anything other than the allowed guardian moves: `preview → pending`, `pending → preview`, `rejected → pending`
  - `is_public` changing `false → true` on an `approved` tutorial (or: flipping to public resets `status` to `preview` so it must be reviewed)
- [ ] Decide what editing an **approved public** tutorial should do: block it, or send it back to `pending` for re-review
- [ ] Check the `tutorial_frames` RLS for the same issue (can a guardian change the frames of an approved public tutorial?)
- [ ] Optional cleaner approach: move submit/withdraw into an edge function (like `guardian-action`), and remove guardians' direct `UPDATE` on `status` / `is_public`
- [ ] Test with direct API calls as a guardian: each blocked change returns an error, and normal Submit / Withdraw / Resubmit in the app still works

---

## ℹ️ Why "the anon key is public" matters

The Supabase **anon key is not a secret**, and that's by design. Anyone can get it:
- **From the app file:** `EXPO_PUBLIC_*` values are built into the JS bundle inside the `.ipa`. Unzipping the app and searching the bundle shows them.
- **From network traffic:** every request the app makes sends it in the `apikey` header. A proxy tool (Charles, Proxyman, mitmproxy) on the user's own phone shows it, along with the user's own login token.
- **From the admin portal (once deployed):** `VITE_*` values are in the JS any browser downloads.

So security must never depend on hiding the key. It must come from **RLS policies** and **checks inside edge functions**: everything above. The **service-role key** is the real secret, and it correctly lives only inside Supabase.
