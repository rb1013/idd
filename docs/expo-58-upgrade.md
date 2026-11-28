# Expo SDK upgrade (56 → 58) — iOS 27 scene lifecycle

**Status:** ✅ **upgraded to SDK 58.1 / React Native 0.88.1** (branch `expo-58`, merged into `development` 2026-11-27; validated on iOS 27.2.1). Next: TestFlight build with Xcode 27. Open: iPad window resizing. (RN 0.88 shadow ADVICE warning fixed 2026-11-28: `backgroundColor` on LearnerSelect `cardBorder`.)
**History:** decided to upgrade **before launch**. Meanwhile, option A works: a TestFlight build archived with **Xcode 26.6** (`DTSDKName iphoneos26.5`) launches on iOS 27 (verified 2026-11-26). On macOS 27, Xcode 26 opens only from Terminal: `/Applications/Xcode-26.app/Contents/MacOS/Xcode`.

**Switching Xcode for builds** (pods, React Native build scripts and `xcodebuild` follow `xcode-select`):
```bash
# Before a TestFlight build with Xcode 26 (until this upgrade ships)
sudo xcode-select -s /Applications/Xcode-26.app/Contents/Developer
xcodebuild -version        # → Xcode 26.6
/Applications/Xcode-26.app/Contents/MacOS/Xcode    # open the app (keep this Terminal open)

# Back to Xcode 27 afterwards (default)
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version        # → Xcode 27.x
```
Check the archive before uploading — `DTSDKName` must start with `iphoneos26`:
```bash
plutil -p "$(ls -td ~/Library/Developer/Xcode/Archives/*/*.xcarchive | head -1)/Products/Applications/CoHeart.app/Info.plist" | grep -E 'DTSDKName|DTXcode"'
```

**Order (decided 2026-11-26) — one change per build, so a problem's cause is obvious:**
1. Supabase key switch (`supabase-keys.md`).
2. Build with **Xcode 26** (SDK 56) and verify everything on devices.
3. Then this upgrade — its own build (Xcode 27) and full retest.
**Written:** 2026-11-26

---

## 1. The problem: Co-Heart crashes at launch on iOS 27

- **Build 13** (built with **Xcode 27**) crashes on an **iPhone 16 Pro, iOS 27.2.1**; works on **iOS 26**.
- Crash: `UIKitCore ___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke` (thread 0, at `UIApplicationMain`).
- **Cause:** apps **built with the iOS 27 SDK (Xcode 27)** must adopt the UIKit **scene lifecycle**; iOS 27 kills apps that don't at launch.
- **Co-Heart doesn't:** `ios/CoHeart/Info.plist` has no `UIApplicationSceneManifest`, and `AppDelegate.swift` creates the window itself (`window = UIWindow(...)`) instead of a SceneDelegate.
- **Expo SDK 56** (installed 56.0.23) doesn't support it — Expo's app delegate has scene handling marked "TODO". Support arrived in **SDK 57.0.23+** (`expo-build-properties` → `ios.enableSceneSupport: true`); **SDK 58** includes it by default.
- Not related to the Supabase East → West move or to our app code.

---

## 2. What a "scene" is (background)

- A **scene** = one window / instance of the app's UI. iPhone apps have one; iPad / Mac / Vision Pro apps can have several (side by side, Slide Over, external display, iPadOS 26 resizable windows — via long-press icon → **New Window**, dragging the icon from the Dock, App Exposé). Multiple windows only if the app sets `UIApplicationSupportsMultipleScenes = true`.
- **Old lifecycle (Co-Heart today):** the AppDelegate creates one window and gets app-wide foreground / background events.
- **Scene lifecycle:** each scene's **SceneDelegate** creates its window and gets that window's events; the AppDelegate keeps app-wide things (launch, push setup, links). iOS learns about it from `UIApplicationSceneManifest` in `Info.plist`.
- Introduced in iOS 13 (2019); warnings in iOS 26; **required from the iOS 27 SDK**.
- **For Co-Heart:** nothing visible changes. We'd set `UIApplicationSupportsMultipleScenes = **false**` — one window (one React Native instance, one login / learner-mode state; two windows would risk mixed states).
- **The flag alone does NOT fix it:** the manifest needs a scene configuration **and** a SceneDelegate that creates the window inside the scene and forwards links / app-state events. With only `SupportsMultipleScenes = false` and no SceneDelegate → likely a black screen and broken deep links.

| Setup | iOS 27 |
|---|---|
| No scene manifest (today) | ❌ killed at launch |
| Manifest with `SupportsMultipleScenes = false` only | ⚠️ likely black screen; links break |
| Manifest + **SceneDelegate** + `SupportsMultipleScenes = false` | ✅ launches, one window, works as before |

---

## 3. Options considered

| Option | What | ✅ | ❌ |
|---|---|---|---|
| **A. Build with Xcode 26** (iOS 26 SDK) | Archive with Xcode 26 (installable next to 27) | No code change; rule only applies to apps **built with** the iOS 27 SDK | Temporary — see §4 |
| **B. Upgrade to Expo SDK 57.0.23+ / 58** with scene support | SDK + React Native upgrade, prebuild, retest | Proper lasting fix; survives `prebuild` | Biggest effort; SDK upgrades bring breaking changes |
| **C. Hand-written SceneDelegate on SDK 56** (workaround in expo/expo#50179) | `SceneDelegate.swift`, `Info.plist`, `AppDelegate` changes + a config plugin so `prebuild` doesn't wipe them | Stays on SDK 56 | Custom native code to maintain |

**Decision (2026-11-26): B, now, before launch** — no real users (dummy data), everything is being re-tested after the West move anyway, removes the iOS 27 issue properly, avoids launching on an SDK that needs upgrading months later, and App Review often tests on the latest iOS. Option A remains the fallback for shipping test builds meanwhile.

---

## 4. How long Xcode 26 (option A) works

- **Until April 2027.** From then, App Store Connect only accepts iOS apps **built with the iOS 27 SDK (Xcode 27) or later** (exact day not published yet; usually late April).
- Builds already published keep working after that; the deadline blocks **new uploads** (no updates until the scene fix ships).
- Expo SDK 56 may also become hard to build with newer Xcode over time.

| Period | Build with Xcode 26 | iOS 27 users |
|---|---|---|
| Now → April 2027 | ✅ accepted (TestFlight + App Store) | ✅ launches |
| From April 2027 | ❌ uploads rejected — Xcode 27+ required | scene lifecycle needed, else crash |

---

## 5. Upgrade plan

**Target:** **Expo SDK 58** (scene support built in, latest) — or SDK 57.0.23+ with `expo-build-properties` `ios.enableSceneSupport: true`. Check the exact latest 58.x when starting. Either way it's also a **React Native upgrade** (0.85.3 today).

1. **Branch** off `development` (e.g. `expo-58`) — `development` stays buildable; ship test builds from it with **Xcode 26** meanwhile.
2. **Upgrade:** `npx expo install expo@^58`, then `npx expo install --fix` (aligns all Expo / RN packages). Read the **SDK 57 and 58 release notes** for breaking changes.
3. **Check what we use** against breaking changes:
   - `expo-file-system` (new `File` / `Directory` API — AAC board cache, `lib/aacSymbols.ts`)
   - `expo-audio`, `expo-speech`
   - notifications (`lib/scheduleNotifications.ts`, push tokens)
   - `expo-secure-store`, `expo-local-authentication` (Face ID, learner biometric login)
   - `expo-image-picker`, `expo-linear-gradient`
   - React Navigation, `react-native-safe-area-context`, the YouTube player
4. **Native:** `npx expo prebuild --clean` (regenerates `ios/` with the scene delegate), then set the **build number in Xcode** (as usual — not in app.json). Confirm `Info.plist` has `UIApplicationSceneManifest` and `UIApplicationSupportsMultipleScenes = false`.
5. **Type-check + build**, fix what breaks.
6. **Test on iOS 26 AND iOS 27:**
   - guardian sign-up (email arrives) / login / forgot password — **deep links** (password reset, email verification) are the area the scene delegate affects most
   - learner mode switch (Face ID / stored credentials) and back
   - learner chat + guardian chat (live delivery on a 2nd device), AAC board (scroll, symbols, phrases)
   - Find Friends / Manage Friends, events, discussions
   - tutorials: generate (webhook + OpenAI + Google TTS), edit slide, regenerate image
   - schedule (add / edit weekly + one-off), activities, learner home
   - photo upload (guardian + learner), push notifications, app foreground / background (reminders, refresh)
   - iPad layout (one window only — "New Window" shouldn't appear)
7. **Merge** to `development` once stable; then build with **Xcode 27**.

**Who does what:** Claude — steps 1–3 and 5 (upgrade, code fixes, type-check) + test list. You — step 4 (prebuild + Xcode build) and step 6 (device testing).

**Effort:** half a day to a couple of days, depending on what the upgrade breaks; most of it is testing.

---

## Sources
- [Expo issue #50179 — SceneDelegate workaround for the iOS 27 UIScene launch crash](https://github.com/expo/expo/issues/50179)
- [Expo SDK 57 + Xcode 27 + iOS 27: Fix App Crash on Launch with Scene Lifecycle](https://devmindstechnologies.medium.com/expo-sdk-57-xcode-27-ios-27-fix-app-crash-on-launch-with-scene-lifecycle-953e9721eca6)
- [iOS 27 Crashing Your App at Launch? Every Fix for the UIScene Lifecycle Error](https://dev.to/rushikeshpandit/ios-27-crashing-your-app-at-launch-every-fix-for-the-uiscene-lifecycle-error-5ag8)
- [usekaneo/kaneo #2048 — fixed by upgrading to Expo SDK 58](https://github.com/usekaneo/kaneo/issues/2048)
- [Apple — App Store submissions now open for the latest OS releases](https://developer.apple.com/news/?id=k1mtkt1k) (iOS 27 SDK required from April 2027)
- [Apple Developer Forums — when Xcode 27 becomes mandatory](https://developer.apple.com/forums/thread/839939)
