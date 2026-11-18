# Admin Portal: Moderation TODO

**Written:** 2026-11-17 · **Status:** Not started
Paths are relative to the repo root. Admin portal: `apps/admin` (runs locally at `http://localhost:5173`).

## Why

- **Apple Guideline 1.2** (user-generated content): users must be able to **block** abusive users, and the developer must act on reports **within 24 hours** by **removing the content and ejecting the user** responsible.
- **Our Terms §3** (`PRIVACY_POLICY_AND_TERMS.md`) now promise: *"Co-Heart has zero tolerance for objectionable content and abusive users. We review reports within 24 hours and remove content that breaks these rules, and may suspend or permanently remove the accounts responsible."*
- The **FAQ** promises reports are reviewed within 24 hours.

Today the admin portal **can't** do most of this, so admins would have to use the Supabase dashboard.

---

## Current state (as of 2026-11-17)

### What admins can delete

| What | Where | How |
|---|---|---|
| Tutorials | **Tutorials** page → Delete (`apps/admin/src/pages/TutorialsPage.tsx:272`) | Direct row delete |
| Learners | **Reports → Statistics** → Delete Learner (`apps/admin/src/pages/ReportsPage.tsx`) | `delete-learner` edge function. **Only for learners reported in learner chat**; no general learner delete |
| Setup lists | Blocked Words, Categories, Event/Discussion Categories, Medical Conditions, Tutorial Skills | Remove list entries (not user content) |

### Pages with no actions

| Page | Today |
|---|---|
| **Users** (`/users`, `UsersPage.tsx`) | List only (view / search learners) |
| **Guardians** (`/guardians`, `GuardiansPage.tsx`) | List only (view / search guardians) |

### Not possible anywhere in the portal

- Delete or **suspend a guardian**
- Remove a **discussion post** or **reply**
- Remove an **event**
- Remove a **guardian chat message** / conversation
- Delete a learner who **hasn't been reported**

### Notes

- `delete-guardian` (edge function) deletes **the caller's own account** (used by the app's Account → Delete account). It **can't** be reused for an admin deleting someone else; an admin variant needs its own function or an admin check.
- Reports tabs (Guardian chat · Discussions · Events · Guardian profiles) exist since 2026-11-16 with **View snapshot** and **Mark resolved**, but intentionally **no quick actions** on the content (decision 2026-11-16; revisit with the tasks below).
- No alert reaches admins when a report arrives; someone must check **Reports** at least daily to meet the 24-hour promise.

---

## Tasks

### 1. Remove reported content
- [ ] Admin can delete a **discussion post** (replies go with it via cascade)
- [ ] Admin can delete a **discussion reply**
- [ ] Admin can delete an **event**
- [ ] *(Optional)* Admin can delete **guardian chat messages** or a whole guardian conversation
- [ ] Decide where the buttons live: on the **Reports** tabs next to each report (changes the "no quick actions" decision), and/or on new content list pages
- [ ] RLS: allow admins (`is_admin()`) to delete these rows (check existing policies on `discussion_posts`, `discussion_replies`, `events`, `guardian_messages`)
- [ ] Reports keep their snapshot when content is deleted (already guaranteed: `ON DELETE SET NULL`, migration `087`)

### 2. Suspend / remove guardians
- [ ] Add a reversible **suspend**: e.g. `guardians.suspended_at` (+ `suspended_reason`)
- [ ] Enforce suspension **server-side** (RLS / triggers): suspended guardians can't post, reply, create events, send messages, or file connection requests. Decide whether they can still log in (e.g. read-only + a "Your account is suspended" screen) or are signed out
- [ ] App: show a clear message to a suspended guardian (and how to contact support)
- [ ] Admin **Guardians** page: **Suspend / Unsuspend** buttons (with a reason)
- [ ] *(Optional)* **Delete guardian** (permanent): new admin-only edge function (verifies the caller is an admin), removes the auth user + data; reports remain (snapshots kept)

### 3. Learners
- [ ] *(Optional)* **Users** page: delete any learner (reuse `delete-learner`, which already allows admins), not only reported ones

### 4. Report follow-up
- [ ] *(Optional)* Link from a report row to the action (e.g. "Remove post", "Suspend guardian") so one place handles a report end to end
- [ ] **Admin notification** when a report is filed (email or push) so the 24-hour promise is dependable
- [ ] Purge resolved reports after 1 month (see `docs/apple-review-checklist.md`)

### 5. Docs
- [ ] App Review notes: *"Users can report and block. Our team reviews reports within 24 hours and removes content or suspends accounts that violate our Terms."*
- [ ] Keep `docs/apple-review-checklist.md` #1 in sync

### Until these exist (interim process)
- Check the admin **Reports** tabs at least once a day.
- Remove content or accounts via the **Supabase dashboard** (Table Editor). Deleting a guardian's auth user cascades their posts, replies, events and messages; reports remain.
