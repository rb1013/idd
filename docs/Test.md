# Co-Heart Test Plan: Unit, Component and End-to-End

**Status:** Proposed, nothing set up yet
**Written:** 2026-11-15

The repo currently has **no tests**: no Jest or Vitest, no test files, and no `test` scripts in `apps/mobile` or `apps/admin`.

---

## 1. Unit tests (fast, no app or database needed)

**Tools**
- **Mobile:** Jest with `jest-expo` (Expo's standard setup, version-matched to SDK 56). Check the Expo v56 docs before setting up (see `apps/mobile/AGENTS.md`).
- **Admin:** Vitest (the admin app is already built on Vite).
- Add an `npm test` script to each app.

**What to cover** (mostly logic changed recently)

| Area | Source | Example checks |
|---|---|---|
| Password rules (mobile) | `apps/mobile/src/lib/validators.ts`, `passwordError()` | `Abc123` passes; `abc123` (no upper), `ABC123` (no lower), `Abcdef` (no digit), `Ab1` (too short) fail with the right message |
| Password rules (admin) | `apps/admin/src/lib/validators.ts` | Same cases. Also confirms the two copies stay in sync |
| Password match | `passwordMatchError()` | Mismatch → "Passwords do not match" |
| Phone | `apps/mobile/src/constants/countryCodes.ts` | `sanitizePhoneInput('(202) 555-0123')` → `2025550123`; input capped at 10 digits; `validatePhone` rejects 9 and 11 digits; `buildE164('+1', …)` → `+12025550123` |
| Discussions date range | `rangeStart()` in `DiscussionsScreen.tsx` | "Last 7 days" = local midnight 6 days ago; "Any time" → no filter; same for 14 and 30 |
| Events **Until** filter | `applyFilters()` in `EventsScreen.tsx` | Includes events **on** the Until date; excludes the day after |
| Local "today" (UTC fixes) | `toLocalDateStr()` / `startOfToday()` in `EventsScreen.tsx`, `todayIso()` in `UserScheduleScreen.tsx` | At 9 pm Pacific, "today" is still today's date. **Fix the clock and time zone in tests** (e.g. `TZ=America/Los_Angeles` and fake timers), so results don't depend on when or where tests run |
| `timeAgo` | `DiscussionsScreen.tsx` | "just now", "5m ago", "3h ago", "2d ago", and "Mar 5, 2026" from 7 days on |
| Per-tab filters | `filtersByTab` in `DiscussionsScreen.tsx` and `EventsScreen.tsx` | Filtering one tab never changes another tab's results |

**Refactor needed first:** several helpers currently live **inside screen files**, so tests can't import them. Move them into modules and import them back into the screens:
- `src/lib/dates.ts`: `toLocalDateStr`, `startOfToday`, `todayIso`, `rangeStart`, `timeAgo`
- `src/lib/filters.ts`: the Discussions and Events `applyFilters` functions

This is low risk but touches 4–5 screens. It also removes duplicates: `timeAgo` currently has **4 copies** (`DiscussionsScreen`, `DiscussionDetailScreen`, `GuardianNotificationsScreen`, `MessagesScreen`).

---

## 2. Component tests (optional middle layer)

**Tool:** React Native Testing Library (renders one component on its own, no simulator).

Good for UI logic that's awkward to reach end-to-end:
- **`ActiveFilterChips`** (`src/components/ActiveFilterChips.tsx`): renders nothing when there are no chips; × calls the right `onRemove`; **Clear all** calls `onClearAll`; `capitalize` works.
- **`FilterSheet`** (`src/components/FilterSheet.tsx`): `type: 'single'` sections show radio buttons, multi sections show checkboxes; the section badge counts multi selections only.
- **Notifications empty state** (`GuardianNotificationsScreen.tsx`): on the Tutorials tab, the 48-hour hint appears **once** (header only); Discussions and Events keep their own empty hints.

---

## 3. End-to-end tests (real app, real backend)

**Tools**
- **Mobile: Maestro** (recommended over Detox). Tests are short YAML flows ("tap 'Upcoming'", "assert 'Until' visible"), it works with Expo builds on the iOS Simulator, and it needs no native code changes. Detox is heavier to set up and often unreliable with Expo.
- **Admin: Playwright** against `http://localhost:5173`.

### Backend and test data (the key decision)

E2E tests create real users, posts, events and tutorials, and trigger real emails and push notifications. **Do not run them against the live Supabase project** (`xtfrtbrapuloogqpeigv`): it would fill it with test data and send real emails.

| Option | How | Trade-off |
|---|---|---|
| **A. Separate test Supabase project** (recommended) | A second free project, plus a seed script | Clean and realistic. **Fits the planned US West move:** create the new West US project as production, and keep the current US East project as the test environment |
| B. Local Supabase (`npx supabase start`) | Runs on the Mac with Docker; includes a test email inbox (Inbucket) | Lets email-code flows be automated. Needs Docker. Slower to start |
| C. Live project with clean-up | Tests delete what they create | ❌ Risky: failed runs leave junk; real emails go out |

**Seed script** (for A or B) should create:
- Test guardians **A** and **B**, each with a learner, plus one **admin** user
- Discussion posts dated **3, 10 and 40 days ago** (for the date dropdown)
- Events **today, in 5 days and in 20 days** (for the Until filter), with A hosting some and attending some of B's
- Tutorials in `preview`, `pending` and `approved` (public and private)
- Categories, support tags and age and gender values for the filter chips

**Dates must be relative to the day the seed runs**, so date-based tests keep working on any day.

### Email-code flows
Sign-up verification and mobile and admin password reset need the 6-digit code from an inbox.
- Automatable only with **Option B** (local Inbucket inbox) or a paid email-testing service.
- Otherwise, keep these as **manual checks** before each TestFlight build.

### Flows to automate first

**Mobile (Maestro)**
1. **Sign-up validation:** weak passwords and a 9-digit phone are rejected with the right messages; the phone field stops at 10 digits.
2. **Notifications:** Tutorials tab with no notifications shows the 48-hour hint once, with no double period.
3. **Discussions:**
   - Per-tab filters: a guardian-name filter on All doesn't hide posts on My.
   - Date dropdown: Any time / 7 / 14 / 30 days show the right seeded posts; ✕ resets.
   - More Filters: category shows radio buttons (single choice); chips 🏷️ and 👤 appear, × and Clear all work.
   - Cards show the year for posts 7 or more days old.
4. **Events:**
   - Tabs are **Upcoming / Hosting / Attending**.
   - A single **Until** button; the picker won't go before today; results include the Until date.
   - Filters don't carry across tabs.
   - Cards show the year in the date tag.
   - An event dated today still shows in the evening (run with the simulator clock set after 5 pm Pacific).
5. **Connections:** Connected and Find chips (🎯 tags, 👤 age, ⚧ gender) appear and are removable.
6. **Learner Friends:** chips appear and are removable.
7. **Tutorials:** chips with icons on Search, My and Pending; Visibility uses radio buttons.
8. **Schedule:** in the evening, a new class defaults to **today**, not tomorrow.

**Admin (Playwright)**
1. Log in as the seeded admin.
2. Approve and reject a pending tutorial; status changes.
3. *(With Option B)* Forgot password: request a code → read it from Inbucket → verify → new password must meet the rules → lands on the dashboard.

---

## 4. Running the tests

| Type | Where | When |
|---|---|---|
| Unit and component | Locally (`npm test`), later **GitHub Actions** (free) | Every push to `development` |
| E2E (mobile and admin) | Locally on the Mac | Before each TestFlight build |

E2E in CI needs macOS runners or Maestro Cloud (slower and paid), so skip it for now.

---

## 5. Suggested order

1. **Phase 1, unit tests:** move helpers into `src/lib/`, set up Jest (mobile) and Vitest (admin), write the unit tests above. Small, fast, and covers most recent fixes.
2. **Phase 2, component tests:** `ActiveFilterChips`, `FilterSheet`, notifications empty state.
3. **Phase 3, E2E:** test Supabase project + seed script + Maestro flows, then Playwright for admin.

---

## Open decisions

- [ ] **E2E backend:** separate test project (A), local Docker (B), or both?
- [ ] **Email-code flows:** automate with a local inbox, or keep them manual?
- [ ] **Component tests:** include them, or go straight to unit + E2E?
- [ ] **Scope:** start with Phase 1 only, or plan all three phases now?
