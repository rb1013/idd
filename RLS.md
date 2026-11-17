# Tutorial Access Hardening: RLS Update Plan

**Status:** Proposed, not applied yet
**Written:** 2026-11-14
**Planned migration:** `packages/supabase/migrations/086_tutorial_access_hardening.sql`
**Related:** `TODO.md` → "Guardians can skip tutorial review"

---

## Problems found

### 1. Private tutorials are readable by everyone (🚨 privacy)
`migrations/002_rls_policies.sql:167`:
```sql
create policy "Authenticated can read tutorials" on tutorials
  for select using (auth.role() = 'authenticated');
```
Any logged-in user (guardian **or** learner) can read **every** tutorial row: other families' private YouTube links, unapproved drafts and rejected tutorials. The app's screens hide them, but a direct API call doesn't.

Frames have a similar issue. `migrations/011_tutorial_platform_rls.sql:13` allows reading the frames of any tutorial with `status = 'approved'`, **including private ones** (private AI tutorials are auto-approved).

This contradicts the README, `FAQ.md` and `PRIVACY_POLICY_AND_TERMS.md`, which all say private tutorials are visible only to the guardian and their learner. **Fix this before publishing the privacy policy.**

### 2. Guardians can link someone else's private tutorial
`011_tutorial_platform_rls.sql:55` ("Guardian can manage tutorial links for own users") only checks that the **learner** belongs to the guardian, not that the **tutorial** is one they may use. Once read access is fixed (Step 1), this would become a back door: link someone else's private tutorial to your learner, then read it.

### 3. Guardians can skip admin review
- **UPDATE:** `011_tutorial_platform_rls.sql:46` is `FOR UPDATE USING (created_by_guardian_id = auth.uid())`, with no column limits. A guardian can change **any** column on their own tutorials, for example:
  - create a **private** tutorial (auto-approved, `process-tutorial-job/index.ts:124`), then set `is_public = true`, putting it in the shared library with no review
  - set `status = 'approved'` directly on a public tutorial in `preview`, `pending` or `rejected`
  - edit title, description or `video_url` after approval
- **INSERT:** `048_tutorial_guardian_insert_policy.sql` is `WITH CHECK (created_by_guardian_id = auth.uid())`, so a guardian can insert a row that's already `status = 'approved'` + `is_public = true` with any `video_url`, putting an unreviewed link straight into the shared library.

The app UI doesn't do any of this. It requires direct API calls using the public anon key and the guardian's own login token, both of which can be obtained from the app (network proxy or app bundle). See `TODO.md` → "Why 'the anon key is public' matters".

### 4. Anyone can edit any tutorial's slides through `regenerate-frame` (🚨 found 2026-11-15)

The slide editor's **Regenerate image** and **Save & regenerate audio** call the `regenerate-frame` edge function, which uses the service-role key (bypasses RLS). It:
- **Has no caller check at all:** no `auth.getUser()`, no ownership check. Anyone with the public anon key can call it with any `frame_id`.
- **Allows `approved` tutorials:** `['preview', 'rejected', 'approved']` (`regenerate-frame/index.ts:42`).

So through a direct API call, anyone could:
- Change the **narration text, audio or image** of an **approved tutorial in the shared library**, content other families' learners watch, with **no re-review**.
- Do this to **other families' tutorials**, not just their own.
- **Run up OpenAI costs** (each call generates an image or audio).

Only the **caption** is protected: it's saved by a direct table update, and the frames RLS policy (`011_tutorial_platform_rls.sql:27`) only allows `preview` / `rejected`.

**What the app itself allows** (`TutorialPreviewScreen.tsx:498`: the **✏️ Edit slide** button shows only for the creator, and only in `preview` / `rejected`):

| Tutorial state | Editable in the app? |
|---|---|
| Public, `preview` | ✅ |
| Public, `pending` | ❌ (Withdraw → back to `preview` → edit) |
| Public, `rejected` | ✅ then resubmit |
| Public, `approved` | ❌ and no way back to `preview` |
| **Private** | ❌ **never**: private tutorials skip `preview` and are auto-`approved` when generation finishes (`process-tutorial-job/index.ts:124`), so a guardian **can't fix a bad slide in their own private tutorial** (only delete and regenerate, using quota) |

**Decisions needed**
- [ ] **Private tutorials:** should the creator be able to edit them? (Suggested: **yes**, since no review is involved. Either allow editing private `approved` tutorials, or land private tutorials in `preview` first like public ones.)
- [ ] **Approved public tutorials:** keep **not editable**, or allow edits that **send them back to `pending`** for re-review?

**Fix (whatever the decisions)**
- [ ] `regenerate-frame`: require a logged-in caller (`auth.getUser()` → 401) who **owns** the tutorial (`created_by_guardian_id`, else 403), following the `delete-learner` pattern in `TODO.md`.
- [ ] `regenerate-frame`: allow `approved` only under the chosen rule (e.g. private only), not for public library tutorials.
- [ ] If edits of public `approved` tutorials are allowed, set `status = 'pending'` in the same request.
- [ ] If private tutorials become editable in the app, update the **Edit slide** condition in `TutorialPreviewScreen.tsx:498` and the frames update RLS policy to match.
- [ ] Redeploy: `cd packages/supabase && npx supabase functions deploy regenerate-frame`.
- [ ] Test with direct API calls: no session → 401; another guardian's frame → 403; public approved frame → blocked (or moved back to `pending`).

### ⚠️ Correction: edge-function caller audit

`TODO.md` → "Edge functions that don't verify the caller" listed `regenerate-frame` and `process-tutorial-job` among functions that **check the logged-in user**. **That was wrong.** The original search counted the `Authorization` header those functions send **to OpenAI**, not a check of the caller. Re-checked (counting `auth.getUser` and reading the caller's `Authorization` header):

| Checks the caller | **No caller check** |
|---|---|
| `create-user-account`, `delete-guardian`, `delete-learner`, `guardian-action`, `regenerate-tutorial`, `send-message`, `send-guardian-message` | `approve-tutorial`, `reject-tutorial`, `create-tutorial`, `check-tutorial-quota`, `check-email`, **`regenerate-frame`**, **`process-tutorial-job`** |

`process-tutorial-job` is normally triggered by a database webhook (`tutorial_jobs` insert), but it can also be called directly, which would re-run a generation and spend AI credits. It should only accept calls carrying the webhook's secret (or the service-role key).

---

## Documentation mismatches caused by these gaps

Until this fix is applied, some user-facing documents promise more than the database enforces. In the app's screens all of these claims hold; they break only for someone making direct API calls.

### Mismatch 1: "Private tutorials are only visible to you and your learner" (from Problems 1 and 2)

**Reality:** the app never shows private tutorials to other families, but any logged-in user can read every tutorial row (and the frames of private AI tutorials) through the API.

**Status (2026-11-15): reworded** to describe app behavior only. Restore the stronger wording after Steps 1–3 are applied and tested.

| File | Current wording (as of 2026-11-15) | Can restore after fix to |
|---|---|---|
| `FAQ.md:106` | "Private tutorials don't appear in the shared library and aren't shown to other families." | "Only you and your learner can see it." |
| `FAQ.md:113` | "They don't appear in the shared library and aren't shown to other families." | "Only you and your learner can see them." |
| `PRIVACY_POLICY_AND_TERMS.md:70` | "are not shown to other families in the app." | "are visible only to you and your learner." |
| `docs/desc.md` (Safety section) | Bullet **removed** | Re-add: "• Private tutorials and linked videos stay between you and your learner." (then recount the length) |
| `README.md:55`, `README.md:99` | Says it's enforced in the app, with database enforcement pending (points here) | Remove the "pending, see `RLS.md`" notes |

### Mismatch 2: "Shared tutorials are reviewed before they appear in the library" (from Problem 3)

**Reality:** in the app, every public tutorial goes through Submit → admin approval. Through the API, a guardian can set their own tutorial to `approved`, switch a private (auto-approved) tutorial to public, or insert an already-approved public row. Anyone can also call `approve-tutorial`, which has no caller check (see `TODO.md`). So review is the normal flow, but the system doesn't enforce it.

**Status (2026-11-15): left as is**, because the claim matches what users experience in the app. Before calling review **guaranteed** anywhere (marketing, partner agreements, the final privacy policy), apply Step 4 **and** the `approve-tutorial` / `reject-tutorial` caller checks from `TODO.md`.

| File | Claim |
|---|---|
| `FAQ.md:107` | "The Co-Heart team checks it before it appears in the shared library for all guardians." |
| `PRIVACY_POLICY_AND_TERMS.md:61` | "admin review of shared tutorials" |
| `PRIVACY_POLICY_AND_TERMS.md:71` | "Shared tutorials you choose to publish are reviewed by Co-Heart admins, then visible to all guardians." |
| `PRIVACY_POLICY_AND_TERMS.md:154` | "Shared tutorials are reviewed by our team before appearing in the shared library." |
| `docs/desc.md:35` | "Browse tutorials created by other guardians and reviewed by our team" |

---

## What the app legitimately does today (must keep working)

| Action | Where | Who / how |
|---|---|---|
| Submit for Review `preview → pending` | `TutorialPreviewScreen.tsx:248` | Guardian, direct update |
| Withdraw `pending → preview` | `TutorialPreviewScreen.tsx:259` | Guardian, direct update |
| Resubmit `rejected → pending` | `TutorialPreviewScreen.tsx` (submitForReview) | Guardian, direct update |
| Link YouTube (private insert, `status: 'approved'`, `is_public: false`, `source: 'youtube'`) | `LinkYoutubeScreen.tsx:86` | Guardian, direct insert |
| Edit frame caption (only while `preview`/`rejected`) | `TutorialPreviewScreen.tsx:157` | Guardian, existing frames policy |
| Create / generate / regenerate AI tutorials | `create-tutorial`, `process-tutorial-job`, `regenerate-tutorial`, `regenerate-frame` | Edge functions (`service_role`) |
| Approve / reject | `approve-tutorial`, `reject-tutorial` | Edge functions (`service_role`) |
| `link_count` +1 / −1 | `022_link_count_security_definer.sql` | `SECURITY DEFINER` trigger functions |
| Insert / delete tutorials, read everything | Admin `TutorialsPage.tsx` | Admin (`is_admin()`) |
| Read the shared library and linked tutorials | `TutorialLibraryScreen`, `GuardianTutorialsScreen`, `TutorialsScreen` | Guardians and learners |

---

## Fix: step by step

### Step 1: Restrict who can **read** tutorials

The existing "Guardian can read own tutorials" (011) and "Admins can manage tutorials" (002) policies stay as they are.

```sql
drop policy "Authenticated can read tutorials" on tutorials;

-- Anyone logged in: the shared library (approved + public)
create policy "Read approved public tutorials" on tutorials
  for select to authenticated
  using (status = 'approved' and is_public);

-- A learner (or their guardian) can read tutorials linked to that learner
create policy "Read tutorials linked to my learner" on tutorials
  for select to authenticated
  using (exists (
    select 1 from user_tutorials ut
    join user_profiles up on up.id = ut.user_id
    where ut.tutorial_id = tutorials.id
      and (up.auth_user_id = auth.uid() or up.guardian_id = auth.uid())
  ));
```

### Step 2: Make **frames** follow the same rule

A subquery inside a policy is itself filtered by the `tutorials` policies, so frames automatically inherit Step 1:

```sql
drop policy "Read frames of accessible tutorials" on tutorial_frames;

create policy "Read frames of visible tutorials" on tutorial_frames
  for select to authenticated
  using (exists (select 1 from tutorials t where t.id = tutorial_frames.tutorial_id));
```

### Step 3: Restrict what a guardian can **link**

A guardian can only link their own tutorials or approved public ones:

```sql
drop policy "Guardian can manage tutorial links for own users" on user_tutorials;

create policy "Guardian can manage tutorial links for own users" on user_tutorials
  for all to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.id = user_tutorials.user_id and up.guardian_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from user_profiles up
      where up.id = user_tutorials.user_id and up.guardian_id = auth.uid()
    )
    and exists (
      select 1 from tutorials t
      where t.id = user_tutorials.tutorial_id
        and (t.created_by_guardian_id = auth.uid() or (t.status = 'approved' and t.is_public))
    )
  );
```

### Step 4: Restrict what a guardian can **write** (the review loophole)

RLS controls *which rows* someone may change, not *which columns or values*, so this uses a `BEFORE` trigger:

```sql
create or replace function guard_tutorial_writes()
returns trigger language plpgsql as $$
begin
  -- Trusted: edge functions (service_role), SECURITY DEFINER functions such as the
  -- link_count triggers in 022 (they run as their owner), and admins.
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Guardians may only add private YouTube links directly; AI tutorials go through create-tutorial.
    if new.source is distinct from 'youtube' or new.is_public then
      raise exception 'Guardians can only add private YouTube tutorials directly';
    end if;
    return new;
  end if;

  -- UPDATE: guardians may only change status (and updated_at)...
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception 'Only the review status of a tutorial can be changed';
  end if;

  -- ...and only along Submit / Withdraw / Resubmit
  if new.status is distinct from old.status
     and (old.status, new.status) not in (('preview','pending'), ('pending','preview'), ('rejected','pending')) then
    raise exception 'Tutorial status cannot change from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

create trigger guard_tutorial_writes
  before insert or update on tutorials
  for each row execute function guard_tutorial_writes();
```

**Why `current_user`:** PostgREST runs app requests as the `authenticated` (or `anon`) role. Edge functions using the service-role key run as `service_role`. `SECURITY DEFINER` functions (the `link_count` triggers) run as their owner (`postgres`). So the check only applies to requests coming directly from the apps. The trigger function itself must stay `SECURITY INVOKER` (the default) for this to work.

**Effect:**

| Action | Who | Result |
|---|---|---|
| Submit / Withdraw / Resubmit | Guardian | ✅ allowed |
| Link a YouTube video (private insert) | Guardian | ✅ allowed |
| Generate, regenerate, approve, reject | Edge functions | ✅ trusted |
| `link_count` +1 / −1 | SECURITY DEFINER trigger | ✅ trusted |
| Admin portal insert / delete | Admin | ✅ trusted |
| Set `approved`, flip `is_public`, edit content, insert a public or AI row | Guardian | ❌ blocked |

---

## Step 5: Apply

1. Put Steps 1–4 into `packages/supabase/migrations/086_tutorial_access_hardening.sql`.
2. Run it in the **Supabase SQL Editor**, the same way as other migrations. Ideally do it in a single transaction (`begin; … commit;`) so a failure leaves nothing half-applied.
3. If you get *"infinite recursion detected in policy"* (`tutorials` ↔ `user_tutorials` referencing each other), move the Step 1 linked-tutorial check into a small `SECURITY DEFINER` function, e.g. `is_tutorial_linked_to_me(tutorial_id uuid) returns boolean`, and call it from the policy.
4. Before running, confirm the policy names in the `drop policy` lines match what's live: Dashboard → Authentication → Policies, or `select policyname from pg_policies where tablename in ('tutorials','tutorial_frames','user_tutorials');`. Some may have been renamed in the dashboard.

## Step 6: Test

Use two test guardians, **A** and **B**, each with a learner.

**In the app (should still work):**
- [ ] Create a private AI tutorial; it's usable right away
- [ ] Create a public AI tutorial, then Submit, Withdraw and Resubmit
- [ ] Edit a frame caption while in `preview`
- [ ] Link a YouTube video
- [ ] Link a library (public, approved) tutorial to your learner
- [ ] In learner mode, the learner sees their tutorials and the slideshow / video plays
- [ ] Admin portal: approve and reject; the guardian gets a notification
- [ ] Link and unlink a tutorial; `link_count` goes up and down

**Direct API calls as guardian A (each should fail or return no rows):**
- [ ] Read B's private YouTube tutorial
- [ ] Read B's `preview` / `pending` / `rejected` tutorials
- [ ] Read the frames of B's private AI tutorial
- [ ] Link B's private tutorial to A's learner
- [ ] Set A's own tutorial to `status = 'approved'`
- [ ] Flip A's private tutorial to `is_public = true`
- [ ] Change the title or `video_url` of A's approved public tutorial
- [ ] Insert a tutorial with `is_public: true` or `source: 'ai_generated'`

---

## Out of scope / follow-ups

- **Storage:** tutorial images and audio are in a **public** bucket (`014_tutorial_push_storage.sql`), so a private tutorial's files can be opened by anyone with the exact URL. After Step 2, URLs are no longer readable from other people's frames, so guessing them is impractical. Acceptable for now. A private bucket with signed URLs would close it fully.
- **Edge functions:** `approve-tutorial`, `reject-tutorial`, `create-tutorial`, `regenerate-frame` and `process-tutorial-job` don't check the caller (see Problem 4 and the corrected audit above). Even with this RLS fix, anyone can approve a tutorial by calling `approve-tutorial`, or change an approved tutorial's slides through `regenerate-frame`. See `TODO.md` → "Edge functions that don't verify the caller". **Fix both together.**
- **Cleaner long-term design:** move Submit / Withdraw into an edge function, and remove guardians' direct `UPDATE` on `tutorials` entirely.
- **Other tables:** confirm every table has RLS enabled (`select relname from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity;` should return no rows).
