# Learner's Friends screen — load performance & data (discussion)

**Screen:** `apps/mobile/src/screens/guardian/LearnerFriendsScreen.tsx` (guardian dashboard → learner zone → **Friends**; tabs Friends · Requests · Find · Blocked)
**Status:** **implemented** (§7, §8, embedded selects, filter changes) — see §9. Not yet tested on a device. Open questions at the end.
**Written:** 2026-11-23

---

## 1. Problem: spinner after coming back from a profile

Friends → tap a learner → **LearnerPublicProfile** → ‹ back → the list shows for a moment, then a **full-screen spinner**, then everything reloads (and the list jumps to the top).

**Why:**
1. The Friends screen stays in memory under the profile page.
2. On return it gets focus → `useFocusEffect` → `loadAll()` (line ~158).
3. `loadAll()` starts with `setLoading(true)` (line ~163) → the whole list is replaced by the spinner (line ~552).
4. It then reloads **everything** (see §2) — several requests one after another.

The reload itself is intentional (the profile page may have sent a friend request); the problem is the full-screen spinner and the slow, sequential load.

**Fix (separate from §3):** spinner only on the **first** load; on return visits keep the list on screen and refresh quietly — same pattern as Connections and the Tutorials hub.

---

## 2. Today: what `loadAll()` fetches

**Step 1** (everything else waits for it):

| # | Query | Why |
|---|---|---|
| 1 | `user_profiles` where `guardian_id = me` → id, name | My learner's id |

**Step 2** — five loaders in parallel, each with its own chain:

| Loader (tab) | Queries **in order** (each waits for the previous) | Waits |
|---|---|---|
| **Friends** | ① `friendships` (accepted, involving my learner) → ② `user_profiles` of those friends → ③ `guardians` (names) | **3** |
| **Requests** | ① `friendships` (pending) → ② `user_profiles` → ③ `guardians` | **3** |
| **Find** | ① `user_profiles` (**all** other families' learners) → ② **7 in parallel**: `categories`, `chat_preferences`, `user_likes`, `user_dislikes`, `user_abilities`, `friendships` (all statuses), `guardians` | **2** |
| **Blocked** | ① `blocked_learners` → ② `user_profiles` of blocked learners | **2** |
| **Reported** | ① `reports` | **1** |

- **Longest chain:** step 1 + Friends/Requests = **4 round trips in a row** (~0.1–0.3 s each, more in dev mode).
- `friendships` is fetched **3 times** (Friends, Requests, Find); **~17 requests** in total.

---

## 3. Fix: embedded selects + one shared friendships request

> **Superseded by §7** (two tiles, per-tab loading). The **embedded selects** below still apply — each tab/screen uses them; the *shared* friendships request does not (each tab loads its own status).

Supabase can return related rows **inside** the main row in one request, following existing foreign keys:
- `friendships` → `user_profiles` (`friendships_requester_id_fkey` / `friendships_addressee_id_fkey`)
- `blocked_learners` → `user_profiles` (`blocked_learners_blocked_learner_id_fkey`)
- `user_profiles` → `guardians` (`guardian_id`) — guardian name on the card

"Card fields" below = id, name, photo, date of birth (age), county, guardian name.

**Step 1:** unchanged (my learner).

**Step 2** — everything in parallel, **one request each**:

| Loader | New query | Waits |
|---|---|---|
| **Shared friendships** (Friends + Requests + Find status) | `friendships` **all statuses** involving my learner, with both learners' card fields embedded | **1** |
| **Friends** | no query — **accepted** rows from the shared result | 0 |
| **Requests** | no query — **pending** rows from the shared result | 0 |
| **Find** | other learners' `user_profiles` with card fields + likes + abilities embedded (§4); status from the shared friendships | **1** |
| **Categories** (Find filter lists) | likes + abilities categories | **1** |
| **Blocked** | `blocked_learners` with the blocked learner's name + photo embedded | **1** |
| **Reported** | unchanged | **1** |

| | Today | After |
|---|---|---|
| Waits in a row | **4** | **2** |
| Total requests | ~17 | **~6** |
| Friendships fetched | 3× | **1×** |

**Unchanged:** same cards/fields/order/statuses/"Unknown" fallbacks; same security (embedded rows follow the same RLS); Find's status logic (shared request fetches all statuses); the standalone `loadFriends` call after accepting a request (line ~443) keeps working.

---

## 4. Load only what the cards show (profile details on the profile page)

**What the cards display:**

| Field | Friends | Requests | Find |
|---|---|---|---|
| Name, photo | ✅ | ✅ | ✅ |
| Age (from date of birth) | ✅ | ✅ | ✅ |
| Learner's county | ✅ | ✅ | ✅ |
| Guardian's **name** | ✅ | ✅ | ✅ |
| Friend status | — | — | ✅ |
| Likes, dislikes, abilities, comprehension level | ❌ | ❌ | ❌ **not shown** |

- **Loaded but not shown:** on Find, for **every** other learner — likes, dislikes, abilities, comprehension level (+ the categories list).
- **LearnerPublicProfile already loads all of these itself** when opened → moving them off the Friends page costs nothing extra.
- **Guardian's county** is **not** loaded on the Friends page (only the guardian's **name**); it's on the profile page only.

**Proposed on-load fields per card:** id, name, photo, date of birth (age), county, guardian name (+ status on Find). Everything else loads on the profile page.

### Find's More Filters — decided
Find filters by **likes, dislikes, abilities and comprehension level** on the device (lines ~532–535), so whatever isn't loaded can't be filtered on.

**Decision:**
| Data | Load on Find? | Filter |
|---|---|---|
| **Likes** | ✅ yes | **kept** |
| **Abilities** | ✅ yes | **kept** |
| Dislikes | ❌ no | **removed** |
| Comprehension level | ❌ no | **removed** |

- Likes and abilities are loaded **only for the filters** — still not shown on the cards.
- Likes/abilities lists for the filter sheet still need their `categories` (likes + abilities only).
- Dislikes and comprehension level are shown **only on the learner's profile page** (LearnerPublicProfile already loads them).
- Name, county and age-group filters unchanged (use card fields).

**More Filters sheet ("Filter Learners") after the change:**
| Section | Today | After |
|---|---|---|
| 🎂 Age Group | ✅ | ✅ kept |
| 🧠 Comprehension Level | ✅ | ❌ **removed** |
| ❤️ Likes | ✅ | ✅ kept |
| 🙅 Dislikes | ✅ | ❌ **removed** |
| ⭐ What can they do? (abilities) | ✅ | ✅ kept |

What goes with the two removed sections (LearnerFriendsScreen.tsx):
- Sheet sections `level` and `dislikes` (lines ~941–958).
- Filter state `filterLevels`, `filterDislikes` (lines ~152, ~154) and their use in the active-filter count, chips, chip removal, Clear all, `applyFilters` and the reset key (lines ~500–543).
- Loading: `chat_preferences` (comprehension level), `user_dislikes`, and the **dislike** categories (`catDislikes`) in `loadDiscovery` (lines ~374–426); `comprehension_level` / `dislikes` fields on the Find learner type (lines ~93–95); `COMPREHENSION_LEVELS` import / `levelLabels` if unused elsewhere.

**Options considered:** remove all 4 filters; server-side filters (database returns only matching learner ids — possible later with server-side search); load on demand when More Filters is first opened.

### Resulting load (with §3)
1. My learner.
2. In parallel: shared friendships (card fields) · Find learners (card fields **+ likes + abilities** embedded) · categories (likes + abilities) · Blocked (name + photo) · Reported.

→ **2 waits**, ~6 requests; dislikes, comprehension level and languages only on the profile page.

---

## 5. Other findings (separate from the speed fix)

1. **Bug — a rejected request shows as "Pending" in Find** → **fix decided in §8**. Find treats any non-accepted friendship, **including `rejected`**, as pending (`getStatus`), so after a decline the other learner shows "Pending" forever and can't be re-requested. (Friendship statuses: `pending`, `accepted`, `rejected`.)
2. **Find downloads every other family's learners** (with date of birth, likes and abilities) and filters on the device — same scale/privacy point as guardian search; server-side search + paging later.

---

## 6. Guardian name on the cards — kept (removal reverted, 2026-11-23)

The guardian name was removed from the cards and the age moved between name and county; **both reverted** — cards show the **guardian name** again and the **age below the photo** (as committed).

- With embedded selects the guardian name comes **inside the same request** as the card: `user_profiles(…, guardians(full_name))` — no extra wait. Blocked guardians' names come back empty (guardians RLS) → the line is hidden.
- Find Friends joins every learner shown (a few ms at our size).

Options considered and not chosen: copy the guardian name onto the learner row with a sync trigger (bypasses guardian blocks — `user_profiles` has no block policy); save the learner's id at login (only Friends and Home would gain a wait).

---

## 7. Decided plan: two dashboard tiles — Find Friends · Manage Friends

The heavy Find query leaves the friends screen completely.

| Tile | Screen | Tabs | Loads |
|---|---|---|---|
| **Manage Friends** 👥 | today's `LearnerFriendsScreen` minus Find | Friends · Requests · Blocked | **per tab**, on tab click (see below) |
| **Find Friends** 🔍 (**full width** — 5th tile) | **new screen** | none (name/county search + More Filters) | on open, in parallel: other learners (card fields + guardian name + likes + abilities embedded) · categories (likes + abilities) · my learner's friendship statuses · blocked + reported ids (to hide them) |

**Dashboard:** learner zone goes from 4 tiles to 5; Find Friends is **full width** on its own row; the page scrolls (fine). The friend-request badge stays on **Manage Friends**.

**Manage Friends — per-tab loading** (embedded selects, card fields only — no tab has filters):
| Tab | Loads when opened |
|---|---|
| **Friends** (default; the only load on open) | accepted friendships with the friend's card fields embedded (+ blocked ids — blocking doesn't remove a friendship, see note) |
| **Requests** | pending friendships with the other learner's card fields embedded |
| **Blocked** | `blocked_learners` with name + photo embedded |

- Each needs **my learner's id** first (step 1) → Friends on open = **2 waits**.
- **Spinner only on a tab's first open**; later opens / return from a profile keep the list and refresh **quietly**, and only the **current tab** reloads.
- Each tab reloads when opened → tabs and the two screens stay correct without syncing code (send on Find Friends → Manage Friends reloads on focus, and vice versa).
- Requests badge on the Requests tab before it's opened: still open — count-only request on load, or no badge (Home tile already shows one).
- Blocked friends: blocking (`guardian-action`) only adds a `blocked_learners` row, the friendship stays → the Friends tab still needs blocked ids (one small parallel request, no extra wait).

**Find Friends:**
- Card: photo with age below, name, county, guardian name, status. More Filters: Age Group, Likes, What can they do? (§4).
- **"Respond"** (other learner already sent a request) → opens that learner's **profile page** (no Respond button there — accept / decline only in Manage Friends › Requests).
- "Find Friends" link in Manage Friends' empty state ("No friends yet") → Find Friends screen.

Tile wording (draft): **Find Friends** — "Discover learners to connect with"; **Manage Friends** — "Friends, requests & blocked".

---

## 8. Decided fix: declining a request deletes it (option A)

**Bug today:** decline sets `status = 'rejected'`; Find (`getStatus`) **and the learner profile page** ([LearnerPublicProfileScreen.tsx:110](../apps/mobile/src/screens/guardian/LearnerPublicProfileScreen.tsx)) treat anything not `accepted` as pending:
- **Requester:** "Pending" / "Request sent — waiting" forever; can't ask again (`unique(requester_id, addressee_id)` blocks a second insert).
- **Decliner:** "Respond" → profile → Requests is empty (dead end). Sending their own request succeeds (reverse direction) → **two rows** for the pair → the profile's `.maybeSingle()` errors.

**Fix:** `decline()` **deletes** the friendship row (like Cancel). The delete policy already allows both sides (065).
- Only `pending` and `accepted` rows exist → the status logic is correct as is in both places; no dead ends, no two-row case.
- Either side can send a request again later; **Block** is the tool for unwanted repeat requests.
- **One-time migration:** delete existing `rejected` rows (notifications' `friendship_id` is `ON DELETE SET NULL` — notifications stay).
- **Side effect:** today a decline (update to `rejected`) triggers a notification to the requester — "*X declined Y's friend request*" (`notify_guardian_on_friendship`, 005). A delete doesn't fire it → **the requester is no longer told**. (Open question 5.)

Options considered: keep `rejected` and hide it only for the decliner; show "Declined" to the requester.

---

## 9. Implemented (2026-11-23)

| File | Change |
|---|---|
| `GuardianHomeScreen.tsx` | Learner zone: **Find Friends** 🔍 + **Manage Friends** 👥 rows (full width, 5 rows); friend-request badge on Manage Friends |
| `navigation/index.tsx` | New route `FindFriends` (title "Find Friends"); `LearnerFriends` title → "Manage Friends" |
| **`FindFriendsScreen.tsx`** (new) | Find moved here. Other learners + guardian name + likes + abilities in **one** embedded request, started together with categories; then my learner → friendships (pending/accepted only) + blocked + reported ids in parallel. More Filters: Age Group, Likes, What can they do? Respond → profile page. Spinner on first load only |
| `LearnerFriendsScreen.tsx` (Manage Friends) | Find tab, filters and discovery loader removed. **Per-tab loading** on tab open / return (spinner only on a tab's first open). My learner fetched once per visit. Friends/Requests: one embedded `friendships` request each (both learners' card fields + guardian name). Friends also loads blocked + reported (parallel). Blocked: one embedded request. Decline **deletes**. Empty Friends tab points to the Find Friends tile on the dashboard (no button) |
| `LearnerFriendRequestsScreen.tsx` | **Deleted** (old styling; its only entry was the profile's "Respond" button) + its route |
| `LearnerPublicProfileScreen.tsx` | "Respond to friend request →" button removed; nothing shown when the other learner sent the request |
| `096_friendships_delete_rejected.sql` | Deletes existing `rejected` rows — **run manually** |
| `FAQ.md` | Friends answer mentions the two tiles + decline; Block answer → "Manage Friends page (Blocked tab)" |

**Waits now:** Manage Friends › Friends 2 (my learner → friends ‖ blocked ‖ reported); Requests / Blocked tab 1 (my learner reused); Find Friends 2.

**Defaults taken for the open questions:**
- Q5 decline notification: **decided — silent** (gentler; delete doesn't fire the "declined" notification).
- Q6 Requests badge on the tab: shows once the Requests tab has been opened; no extra request on load (Home tile still shows the count).

---

## Open questions

1. ~~Find's likes / dislikes / abilities / level filters~~ — **decided:** keep likes + abilities (loaded), remove dislikes + level (§4).
2. ~~Keep the guardian's name on the cards?~~ — **decided:** keep (§6).
3. ~~Rejected → "Pending" bug~~ — **decided:** decline deletes the row (§8).
4. ~~Spinner fix~~ — **decided:** spinner only on a tab's first open, quiet refresh after (§7).
5. ~~Decline notification?~~ — **decided:** silent, no notification (§8).
6. Requests-tab badge on Manage Friends before the tab is opened: count-only request on load, or no badge?
