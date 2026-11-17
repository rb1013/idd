# Apple App Store Review Checklist: Co-Heart

**Written:** 2026-11-15 · **Status:** Not started
Review of the iOS app against Apple's App Store Review Guidelines, with likely rejection reasons ordered by risk. Paths are relative to the repo root.

---

## 🔴 High risk: likely rejection

### 1. User-generated content: report and block missing (Guideline 1.2)

Apple requires apps with user-generated content to have **all of**: a content filter, a way to **report** content, a way to **block** abusive users, and published contact info.

| Area | Filter | Report | Block |
|---|---|---|---|
| Learner chat (`apps/mobile/src/screens/chat/ChatScreen.tsx`) | ✅ | ✅ | ✅ |
| Guardian-to-guardian chat (`apps/mobile/src/screens/guardian/GuardianChatScreen.tsx`) | ✅ server word filter | ❌ | ❌ |
| **Discussions** posts and replies (`DiscussionsScreen.tsx:243`, `DiscussionDetailScreen.tsx:89`) | ❌ direct database insert | ❌ | ❌ |
| **Events** (name, description, venue) | ❌ | ❌ | ❌ |
| Guardian profiles (Connections) | — | ❌ | ❌ |

- [ ] Add **Report** to discussion posts, replies, events and guardian chats
- [ ] Add **Block guardian** (hides their posts, replies, events and messages)
- [ ] Run the blocked-words filter on discussion posts, replies and events (as `send-guardian-message` does)
- [ ] Make sure admins can see and act on reports (admin portal)
- [] Purge reports which are resolved after 1 month
- [] update privacy policy - Content you report, and content reported about you, is kept for moderation even if later edited or deleted." it will be deleted after 1 month

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
