# Apple App Store Review Checklist: Co-Heart

**Written:** 2026-11-15 · **Status:** Not started
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

### 1. User-generated content: report and block missing (Guideline 1.2)

Apple requires apps with user-generated content to have **all of**: a content filter, a way to **report** content, a way to **block** abusive users, and published contact info.

| Area | Filter | Report | Block |
|---|---|---|---|
| Learner chat (`apps/mobile/src/screens/chat/ChatScreen.tsx`) | ✅ | ✅ | ✅ |
| Guardian-to-guardian chat (`apps/mobile/src/screens/guardian/GuardianChatScreen.tsx`) | ✅ app + server (`send-guardian-message`, whole-word) | ❌ | ❌ |
| **Discussions** posts and replies (`DiscussionsScreen.tsx`, `DiscussionDetailScreen.tsx`) | ✅ app (`lib/contentFilter.ts`) + server trigger (migration `085`) | ❌ | ❌ |
| **Events** (name, duration, venue, description) | ✅ app (`lib/contentFilter.ts`) + server trigger (migration `086`) | ❌ | ❌ |
| Guardian profiles (Connections) | — | ❌ | ❌ |

#### Filter
- [x] Shared in-app filter `apps/mobile/src/lib/contentFilter.ts` (chat, discussions, events)
- [x] Server whole-word `blocked_words` check: chat edge functions (`_shared/blockedWords.ts`), discussions (`085`), events (`086`)
- [ ] **Deploy / apply:** `send-message` + `send-guardian-message`, then run migrations `085` and `086` in the SQL Editor
- [ ] Guardian chat: remove direct `INSERT` on `guardian_messages` (`077_guardian_chat.sql:72`) so the server filter can't be bypassed

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
- [ ] Migration: create the 4 tables (`reason` / `status` as **text + CHECK**, not enums; `status` default `open`; plus **`resolved_at`** and **`resolved_by`**, set by Mark resolved and needed by the later purge job; FKs to reported content use `ON DELETE SET NULL` so reports survive deletion)
- [ ] Database trigger per table: fill `reported_guardian_id` and the snapshot from the real record (not from the app); reject reporting yourself; one report per guardian per item (unique)
- [ ] RLS: guardians can **insert** their own reports only (no read/update/delete); admins can read and update
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

#### Block (separate, still to design)
- [ ] Add **Block guardian** (hides their posts, replies, events and messages)

#### Not in scope
- Learner chat (unchanged; its "Report User" still saves no message snapshot)
- Admin notifications when a report arrives (would make the 24-hour promise dependable)

### 2. Terms (EULA) and privacy policy in the app (Guidelines 1.2, 5.1.1)

- Sign-up consent (`GuardianVerificationScreen.tsx:136`) mentions "consent for privacy policy", but there is **no link** and **no Terms**.
- For apps with user-generated content, Apple requires users to **agree to terms** stating there's **no tolerance for objectionable content or abusive users**.

- [ ] Finish legal review of `PRIVACY_POLICY_AND_TERMS.md` and publish it at a **public URL**
- [ ] Link **Terms** and **Privacy Policy** on sign-up, with an "I agree" checkbox required to continue
- [ ] Link both from the guardian **Account** screen
- [ ] Add the privacy policy URL in App Store Connect

### 3. Permission messages vague or unused (Guideline 5.1.1)

Info.plist strings are generic, e.g. *"Allow $(PRODUCT_NAME) to access your photos"*. `$(PRODUCT_NAME)` is **`nicobetarb`**, so users would see "Allow nicobetarb to access…".

| Permission | Used? | Action |
|---|---|---|
| Photos | ✅ Profile and learner photos (`launchImageLibraryAsync`) | [ ] Rewrite: "Co-Heart uses your photos so you can add a profile picture for you or your learner." |
| Face ID | ✅ Learner quick login (`apps/mobile/src/lib/biometricStore.ts`) | [ ] Rewrite with the real reason |
| Camera | ❌ (photo library only) | [ ] Remove |
| Location (3 keys) | ❌ `expo-location` installed but unused | [ ] Uninstall `expo-location`, remove keys |
| Microphone | ❌ No recording | [ ] Remove (configure the `expo-audio` plugin) |
| Motion | ❌ | [ ] Remove |

- [ ] Set these in `apps/mobile/app.json` (`ios.infoPlist` and plugin options) so `expo prebuild` doesn't restore the old values

### 4. Background audio declared but unused (Guideline 2.5.4)

- `UIBackgroundModes` contains `audio`, but narration only plays in the foreground.
- [ ] Remove the `audio` background mode (likely via `expo-audio` plugin config)

### 5. Reviewer must be able to use every feature (Guideline 2.1)

- [ ] **Demo account** in App Review notes (sign-up email codes via Gmail SMTP may land in spam):
  - [ ] Guardian email and password
  - [ ] 6-digit **Guardian PIN**
  - [ ] One **learner** already set up ("Grow & Connect" works)
  - [ ] Sample tutorials, friends, discussions and events
- [ ] **AI generation working on review day:**
  - [x] Image model updated (`IMAGE_MODEL` = `gpt-image-2.6-flare`, deployed)
  - [ ] **TTS switched to Google** before **January 6, 2027** (`docs/google-tts.md`), or creating a tutorial fails completely
- [ ] **iPad:** `supportsTablet: true`, and reviewers often test on iPad. Check every screen on an iPad simulator, or set `supportsTablet: false`

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
- [ ] **App Privacy labels** match the privacy policy: contact info, user content, photos, identifiers (push token); YouTube; Google TTS (narration text) once switched
- [ ] Screenshots show the real app, with no "beta" or TestFlight wording

---

## 🟡 Low risk: cleanup

- [ ] **Rename:** `apps/mobile/app.json` `"name": "nico-beta-rb"` → `Co-Heart`; the Xcode target and product name `nicobetarb` leak into permission prompts and return after `expo prebuild` (home-screen name is already Co-Heart)
- [ ] **Export compliance:** add `ITSAppUsesNonExemptEncryption = false` to Info.plist (standard HTTPS only)
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
6. **iPad** check, or turn tablet support off
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
