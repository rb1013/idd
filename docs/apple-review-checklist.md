# Apple App Store Review Checklist: Co-Heart

**Written:** 2026-11-15 · **Status:** In progress (#1 app side, #2, #3, #4 and rename done; build 1.0.0 (6) uploaded 2026-11-21)
Review of the iOS app against Apple's App Store Review Guidelines, with likely rejection reasons ordered by risk. Paths are relative to the repo root.

### Guideline numbers used below

Full text: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). The number tells you which part of Apple's rules an item falls under.

| Guideline | Name | In short | Where it applies here |
|---|---|---|---|
| **1.2** | User-Generated Content | Apps where users post content must have: a filter for objectionable content, a way to **report** content, a way to **block** abusive users, published contact info, and terms users agree to (zero tolerance for abuse). Reports must be acted on promptly | Discussions, events, chats, profiles (#1); Terms / EULA (#2) |
| **1.3** | Kids Category | Apps listed in the Kids category must not include third-party ads or analytics, and need a parental gate before links, purchases, or leaving the app | Don't choose the Kids category (#6) |
| **2.1** | App Completeness | The submitted app must be final and fully working: no crashes, broken features, or placeholders, and the reviewer must be able to use everything (provide a demo account for login-gated features) | Demo account, AI generation working, iPad (#5) |
| **2.3** | Accurate Metadata | Store description, screenshots, and privacy labels must match what the app actually does | Description, privacy labels, screenshots (#9) |
| **2.5.4** | Background services | Apps may only declare background modes (audio, location, VoIP…) for features that genuinely run in the background | Unused background audio (#4) |
| **4.8** | Login Services (Sign in with Apple) | If an app offers third-party login (Google, Facebook…), it must also offer Sign in with Apple. Email/password-only apps don't need it | Not required here ✅ |
| **5.1.1** | Data Collection and Storage | Privacy policy linked in the app and App Store Connect; permission prompts must clearly explain **why** data is needed; only ask for data the app needs (data minimization); accounts created in the app must be deletable in the app | Privacy policy link (#2), permission messages (#3), required phone number (#8), account deletion ✅ |
| **5.1.4** | Kids (privacy) | Apps for children must follow children's privacy laws (e.g. COPPA): parental consent, no third-party ads/analytics targeting kids, careful handling of kids' data | Learners may be under 13 (#6) |

---

## 🔴 High risk: likely rejection

### 1. User-generated content: filter, report and block (Guideline 1.2): ✅ done in app (2026-11-17); admin moderation tools still open

Apple requires apps with user-generated content to have **all of**: a content filter, a way to **report** content, a way to **block** abusive users, and published contact info.

| Area | Filter | Report | Block |
|---|---|---|---|
| Learner chat (`apps/mobile/src/screens/chat/ChatScreen.tsx`) | ✅ | ✅ | ✅ |
| Guardian-to-guardian chat (`apps/mobile/src/screens/guardian/GuardianChatScreen.tsx`) | ✅ app + server (`send-guardian-message`, whole-word) | ✅ 🚩 header (`087`) | ✅ 🚫 header (`088`) |
| **Discussions** posts and replies (`DiscussionsScreen.tsx`, `DiscussionDetailScreen.tsx`) | ✅ app (`lib/contentFilter.ts`) + server trigger (migration `085`) | ✅ 🚩 post + reply (`087`) | ✅ via peek sheet 🚫 (`088`, hidden both ways) |
| **Events** (name, duration, venue, description) | ✅ app (`lib/contentFilter.ts`) + server trigger (migration `086`) | ✅ 🚩 event sheet / detail (`087`) | ✅ via peek sheet 🚫 (`088`, hidden both ways) |
| Guardian profiles (Connections + peek sheet) | — | ✅ 🚩 (`087`) | ✅ 🚫 Connected / Requests / Find / peek sheet; **Blocked** tab to unblock (`088`, `089`) |

#### Filter
- [x] Shared in-app filter `apps/mobile/src/lib/contentFilter.ts` (chat, discussions, events)
- [x] Server whole-word `blocked_words` check: chat edge functions (`_shared/blockedWords.ts`), discussions (`085`), events (`086`)
- [x] **Deploy / apply:** `send-message` + `send-guardian-message`, then run migrations `085` and `086` in the SQL Editor
- [x] Guardian chat: remove direct `INSERT` on `guardian_messages` (`077_guardian_chat.sql:72`) so the server filter can't be bypassed (done in `088`)

#### Report: agreed design (2026-11-16)
Learner chat is **not touched**; its existing `reports` table stays for learner chat only.

**Tables** (one per area). Common columns: `id`, `reported_by_guardian_id`, `reported_guardian_id`, `reason`, `status`, content snapshot, `created_at`.

| Table | Reports | Area-specific columns |
|---|---|---|
| `guardian_chat_reports` | The **other guardian** in a guardian chat | `conversation_id`, `message_snapshot` (last ~20 messages) |
| `discussion_reports` | A discussion **post or reply** | `post_id`, `reply_id` (empty for a post), `content_snapshot` (title + details, or reply text) |
| `event_reports` | An event | `event_id`, `content_snapshot` (name, duration, venue, description) |
| `guardian_profile_reports` | A guardian's profile | `content_snapshot` (name, photo URL only; county and Regional Support tags come from fixed dropdowns so can't contain bad content) |

- **Reasons (single-select dropdown in a small report sheet, with Cancel / Report buttons):** Offensive · Spam · Harassment · Sensitive → `reason` in (`offensive`, `spam`, `harassment`, `sensitive`)
- **Status:** `open` / `resolved` (needed for the 24-hour review promise)
- **Snapshot kept** alongside the IDs: reported content may be edited or deleted afterwards (posts/events can be edited/deleted; replies cascade with their post; account deletion cascades everything)

Tasks:
- [x] Migration: create the 4 tables (`reason` / `status` as **text + CHECK**, not enums; `status` default `open`; plus **`resolved_at`** and **`resolved_by`**, set by Mark resolved and needed by the later purge job; FKs to reported content use `ON DELETE SET NULL` so reports survive deletion)
- [x] Database trigger per table: fill `reported_guardian_id` and the snapshot from the real record (not from the app); reject reporting yourself; one report per guardian per item (unique)
- [x] RLS: guardians can **insert** their own reports only (no read/update/delete); admins can read and update
- [x] App: shared report helper `lib/reporting.ts` + `components/ReportFlag.tsx` (🚩 opens a report sheet with a reason dropdown + Cancel / Report; save, "already reported" handling, thank-you message: *"Thanks, our team will review this within 24 hours. For more details, contact coheartsupport@gmail.com."*)
- [x] App: **Report** button on: discussion post (detail screen), each reply, event detail sheet, guardian chat header, **guardian peek sheet** (opened from Discussions, Events, Event detail, Tutorial library) **and Connections cards** (Connected + Find; Connections doesn't use the peek sheet)
- [x] App: add the guardian's `id` to `GuardianPeekInfo` (`components/GuardianPeekSheet.tsx`) and pass it in the 4 places that open the sheet (`DiscussionsScreen.tsx:156`, `EventsScreen.tsx:254`, `EventDetailScreen.tsx:149`, `TutorialLibraryScreen.tsx:84`), needed to report the guardian and to hide 🚩 on your own profile
- [x] App: **hide Report on your own content** (own post/reply, events you host, your own profile); guardian chat always reports the other guardian
- [x] App: **icon only `🚩`** (same subtle grey and placement as ✏️ / 🗑️; owners see ✏️ 🗑️, others see 🚩), 44×44 touch area, VoiceOver label "Report post / reply / event / guardian"
- [x] App: **dim 🚩 after reporting, for the current session only** (kept in screen memory). **No lookup on page load** (avoids extra latency)
- [x] App: **"Already Reported"** message: shown immediately when a dimmed 🚩 is tapped (no server call); after reopening, the 🚩 is normal again, and a repeat report is rejected by the database's duplicate check → show "Already Reported" and dim it (the guardian picks a reason first in this case; accepted trade-off)
- [x] App: any other failure when saving a report → generic *"Couldn't send the report. Please try again."* (no special self-report message; self-reports are blocked by hiding the button, and by the database for direct API calls)
- [x] Admin portal: **tabs** on the existing Reports page (Learner chat · Guardian chat · Discussions · Events · Guardian profiles); each row: date, reporter, reported guardian, reason, **View** snapshot, **Mark resolved**. No quick actions (open/delete content).
- [ ] Purge **resolved** reports after **1 month** (scheduled job, e.g. `pg_cron`)
- [x] Update privacy policy (§2 Reports, §4 who can see reports, §6 retention) and FAQ ("How do I report something?") — 2026-11-16
- [ ] When the purge job is built: add *"Resolved reports are deleted after 1 month."* to privacy policy §6 (left out until then so the policy doesn't promise something that doesn't happen yet)
- [ ] Test: report each area; own content shows no Report; duplicate report → "already reported"; snapshot survives edit/delete; admin can view and resolve

#### Block: done 2026-11-17 (details: `docs/guardian-block.md`)
- [x] **Database** (`088_guardian_blocks.sql`): `guardian_blocks` table; hidden **both ways** via restrictive RLS (posts, replies, events, attendees, profiles, connections, chats/messages, tutorials, notifications); interaction stopped (replies, RSVPs, connection requests, opening/sending chat); on block, connection + RSVPs between the two removed silently
- [x] **Blocked list** (`089_get_my_blocked_guardians.sql`) and notification sources (`090_notification_source_guardian.sql`) so reply/connection notifications are hidden too
- [x] **`send-guardian-message`** refuses blocked pairs (deployed)
- [x] **App:** 🚫 (`components/BlockButton.tsx`, `lib/blocking.ts`) in guardian peek sheet, chat header, Connections cards (Connected two-row layout, Requests, Find); **Connections → Blocked** tab with Unblock
- [x] **FAQ:** "How do I block a guardian?" / "How do I unblock someone?"
- [x] Privacy policy line: blocks you create are stored and visible only to you (and admins) (`docs/guardian-block.md` 4.2): §2 "Blocks" — 2026-11-20 (website copy to be updated)
- [ ] Finish end-to-end tests (sections 6–11 in `docs/guardian-block.md`; 1–5 and notifications passed)

#### Still open for Guideline 1.2: admin moderation
- [ ] Admins must be able to **remove reported content** and **suspend/remove guardians** within 24 hours; today only via the Supabase dashboard (see `docs/admin-todo.md`)

#### Not in scope
- Learner chat (unchanged; its "Report User" still saves no message snapshot)
- Admin notifications when a report arrives (would make the 24-hour promise dependable)

### 2. Terms (EULA) and privacy policy in the app (Guidelines 1.2, 5.1.1): ✅ done (2026-11-18)

- Was: sign-up consent on Guardian Verification mentioned "consent for privacy policy", but there was **no link** and **no Terms**.
- For apps with user-generated content, Apple requires users to **agree to terms** stating there's **no tolerance for objectionable content or abusive users** (Terms §3).

- [x] Finish legal review of `PRIVACY_POLICY_AND_TERMS.md` and publish it at a **public URL** (https://www.yianetwork.org/co-heart/privacy)
- [x] Link **Terms** and **Privacy Policy** on sign-up, with agreement required to continue: "Before you continue" page (`PrivacyConsentScreen.tsx`) with Agree / Decline; acceptance time saved as `guardians.terms_accepted_at` (migration 091) — 2026-11-18
- [x] Link both from the guardian **Account** screen (`GuardianAccountScreen.tsx`, "Privacy Policy & Terms of Service" link) — 2026-11-18
- [x] Add the privacy policy URL in App Store Connect
- [x] Migration `091_guardian_terms_accepted_at.sql` applied

### 3. Permission messages vague or unused (Guideline 5.1.1): ✅ done (2026-11-21, build 1.0.0 (6))

Was: Info.plist strings were generic, e.g. *"Allow $(PRODUCT_NAME) to access your photos"*, with `$(PRODUCT_NAME)` = **`nicobetarb`**.

| Permission | Used? | Action |
|---|---|---|
| Photos | ✅ Profile and learner photos (`launchImageLibraryAsync`) | [x] Rewritten: "Co-Heart uses your photos so you can add a profile picture for you or your learner." (`expo-image-picker` plugin) |
| Face ID | ⏸️ Not used yet: `promptBiometric()` in `apps/mobile/src/lib/biometricStore.ts` is never called (no prompt shown). Code and `expo-local-authentication` kept for future learner quick login | [x] Key kept, text rewritten: "Co-Heart uses Face ID so your learner can sign in quickly and securely." (`expo-local-authentication` plugin) |
| Camera | ❌ (photo library only) | [x] Removed (`expo-image-picker` `cameraPermission: false`) |
| Location (3 keys) | ❌ `expo-location` was installed but unused | [x] `expo-location` uninstalled, keys gone |
| Microphone | ❌ No recording | [x] Removed (`microphonePermission: false` on `expo-audio` and `expo-image-picker`) |
| Motion | ❌ (came from `expo-location`) | [x] Removed with `expo-location` |

- [x] Set in `apps/mobile/app.json` plugin options so `expo prebuild` keeps them

### 4. Background audio declared but unused (Guideline 2.5.4): ✅ done (2026-11-21, build 1.0.0 (6))

- Was: `UIBackgroundModes` contained `audio`, but narration only plays in the foreground.
- [x] Removed: `expo-audio` `enableBackgroundPlayback: false` and `expo-video` `supportsBackgroundPlayback: false` in `apps/mobile/app.json`. Narration and video still play in the foreground and stop when the app is left.

### 5. Reviewer must be able to use every feature (Guideline 2.1)

- [ ] **Demo account** in App Review notes (sign-up email codes via Gmail SMTP may land in spam):
  - [ ] Guardian email and password
  - [ ] 6-digit **Guardian PIN**
  - [ ] One **learner** already set up ("Grow & Connect" works)
  - [ ] Sample tutorials, friends, discussions and events
- [ ] **AI generation working on review day:**
  - [x] Image model updated (`IMAGE_MODEL` = `gpt-image-2.6-flare`, deployed)
  - [x] **TTS switched to Google** before **January 6, 2027** (`docs/google-tts.md`): deployed and tested 2026-11-21
- [ ] **iPad:** `supportsTablet: true` kept (the app has iPad layout: `IS_TABLET`, `scale()`, `ContentContainer` max width 520 in `constants/theme.ts`). Reviewers often test on iPad, so check every screen on an iPad simulator before submitting

---

## 🟠 Medium risk

### 6. Children's content and category (Guidelines 1.3, 5.1.4)

Learners may be under 13 and use learner mode.

- [ ] **Do not** choose the Kids category or "Made for Kids" (strict rules: no third-party ads or analytics, parental gate for links; YouTube embeds can show ads and track)
- [ ] Present the app as a **guardian tool** with a supervised learner mode
- [ ] Answer the age rating questions honestly (user-generated content, messaging); expect 12+/13+ or higher
- [ ] In review notes, describe the safety features: guardian-only accounts (18+), PIN-gated guardian mode, no free typing for learners, profanity filtering, moderation

### 7. AI-generated content

Private AI tutorials reach learners **without admin review**.

- [ ] In review notes, describe the safeguards: prompt guidance, admin review of public tutorials, guardians preview everything
- [ ] Consider adding **Report** on tutorials

### 8. Phone number required at sign-up (Guideline 5.1.1, data minimization)

- [ ] If the phone number isn't used by any feature, make it **optional**, or explain its purpose on the sign-up screen

### 9. Metadata accuracy (Guideline 2.3)

- [ ] Store description (`docs/desc.md`) matches the app
- [ ] **App Privacy labels** match the privacy policy (answer sheet below)

#### App Privacy labels: answer sheet

Filled in at **App Store Connect → your app → App Privacy** (the "nutrition label" shown on the App Store page). Apple relies on these answers; a reviewer may reject if they clearly don't match the app or the privacy policy. Can be edited at any time without a new build.

For each data type Apple asks: collected? → purpose → linked to the user's identity? → used for tracking? Co-Heart answers **Tracking: No** for everything (no ad SDKs or analytics trackers).

| Apple category | What Co-Heart collects | Linked to user | Purpose |
|---|---|---|---|
| Contact Info: Name, Email Address, Phone Number | Guardian account; learner name | Yes | App Functionality |
| Contact Info: Other User Contact Info | County | Yes | App Functionality |
| User Content: Photos or Videos | Profile and learner photos | Yes | App Functionality |
| User Content: Emails or Text Messages | Guardian chat, learner phrase messages | Yes | App Functionality |
| User Content: Other User Content | Discussions, events, tutorials, reports | Yes | App Functionality |
| Identifiers: User ID | Account ID | Yes | App Functionality |
| Identifiers: Device ID | Push token (only once push notifications are enabled) | Yes | App Functionality |
| Other Data | Date of birth / age, learner gender, likes and dislikes, abilities, comprehension level, Regional Support Category | Yes | App Functionality |

- [ ] **Health & Fitness: not collected.** Matches the privacy policy: no diagnoses, medical records, or health information; the Regional Support Category is a service category, not a diagnosis
- [ ] **Not collected:** Location, Financial Info, Browsing/Search History, Usage Data, Diagnostics, Sensitive Info, Contacts, Purchases
- [ ] **YouTube:** embedded videos may collect data under YouTube's own policy; disclosed in the privacy policy (§5). Apple's labels cover data collected by the app's own code and SDKs
- [ ] **Children:** learners may be under 13; labels don't change, but answer the age rating questions honestly (#6)
- [ ] **Google TTS (once switched):** only tutorial narration text is sent, not personal data, so no new label; update the privacy policy's service providers table (`docs/google-tts.md`)
- [ ] Screenshots show the real app, with no "beta" or TestFlight wording

---

## 🟡 Low risk: cleanup

- [x] **Rename:** done 2026-11-21 in `apps/mobile/app.json`: name `Co-Heart` (Xcode project `CoHeart`), slug `coheart`, scheme `coheart` (auth `redirectTo` → `coheart://auth/callback`), bundle ID and Android package `com.yia.coheart`, `appleTeamId`. Old `com.yia.nico` App Store Connect record deleted; uploads go to the `com.yia.coheart` record. Build number is set in Xcode (Info → Bundle version) after each prebuild, not in app.json
- [x] **Export compliance:** `ITSAppUsesNonExemptEncryption = false` via `ios.config.usesNonExemptEncryption: false` in `apps/mobile/app.json` (standard HTTPS only) — 2026-11-21
- [x] **Account deletion:** guardians can delete their account in the app (Account → Delete account); learner profiles can be deleted. Mention the location in review notes.
- [x] **Sign in with Apple:** not required (email login only, no third-party logins)

---

## Not checked by Apple, but fix before public release

Security gaps that anyone could exploit once the app is public (see `RLS.md`, `TODO.md`):
- [ ] Private tutorials readable by any logged-in user (RLS)
- [ ] Tutorial review can be bypassed (RLS and trigger)
- [ ] `approve-tutorial`, `reject-tutorial`, `create-tutorial`, `regenerate-frame`, `process-tutorial-job` don't verify the caller

---

## Suggested order

1. **Code:** report and block plus filtering (#1); Terms and privacy links with agreement (#2); permission strings, removing unused permissions and background audio, rename (#3, #4, #10); optional phone (#8)
2. **Google TTS** switch (#5)
3. **Publish** the privacy policy and Terms at a public URL (after legal review)
4. **App Store Connect:** age rating, not Kids (#6); privacy labels (#9); screenshots
5. **Review notes:** demo account and PIN, learner-mode explanation, safety and moderation summary, account deletion location
6. **iPad** check (tablet support stays on)
7. **Security fixes** before public release

---

## App Review notes (draft, fill in before submitting)

```
Demo guardian account
  Email:    ______________________
  Password: ______________________
  Guardian PIN (for "Mentor & Connect"): ______

Co-Heart is a tool for guardians (18+) of learners with intellectual and developmental
disabilities. After signing in, choose "Mentor & Connect" (guardian mode, PIN-protected) or
"Grow & Connect" (learner mode, which the guardian hands to the learner). The demo account has
one learner set up.

Safety: only guardians can create accounts; learner chat uses pre-written phrases and picture
cards (no free typing) with profanity filtering; guardians can report and block users;
shared AI tutorials are reviewed by our team before appearing in the library.

Account deletion: Mentor & Connect → Account → Delete account.
Support: coheartsupport@gmail.com
```
