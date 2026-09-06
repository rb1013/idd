# YouTube Integration — Research & Discussion

## Goal

Allow guardians to link useful YouTube videos to a learner's tutorials section, without downloading or storing video content in the database.

---

## What YouTube's ToS allows

- **Embedding** via their iframe player — explicitly allowed and encouraged
- **Linking** to YouTube — always fine
- **Fetching metadata** (title, thumbnail) via oEmbed or the Data API — allowed
- **Downloading or re-hosting** video content — strictly prohibited

---

## Two viable technical approaches

### Option A — oEmbed (no API key, simplest)

Guardian pastes a YouTube URL → call `https://www.youtube.com/oembed?url=...&format=json` → get title + thumbnail back for free, no key needed. Store `video_id`, `title`, `thumbnail_url` (as a string) in the DB. Playback via a `WebView` with the iframe embed URL.

- **Pros:** Zero setup, no quota, works today
- **Cons:** Minimal metadata only (no duration, no description)

### Option B — YouTube Data API v3 + embed

Same flow but richer metadata — duration, category, channel name. Free tier is 10,000 units/day (~3 units per video lookup). Requires a Google Cloud API key.

- **Pros:** Better metadata for the tutorial card
- **Cons:** Extra setup, key management, quota to monitor

---

## What WebView is

`WebView` is a component that renders a web page **inside the app** — like an embedded browser. The user never leaves the app.

YouTube provides an embed URL format:
```
https://www.youtube.com/embed/VIDEO_ID
```

When loaded in a WebView, YouTube's player renders inside the ELIS app screen. The learner never sees YouTube's home feed, recommendations, comments, or any other YouTube UI.

### Recommended embed params

```
https://www.youtube.com/embed/VIDEO_ID?fs=0&rel=0&modestbranding=1
```

| Param | Effect |
|---|---|
| `fs=0` | No fullscreen button |
| `rel=0` | No related videos after playback ends |
| `modestbranding=1` | Minimal YouTube branding |

### Package needed

`react-native-webview` — Expo-compatible, one install, no extra config for basic use.

---

## The ads problem

YouTube's embed player shows ads on videos that are monetized by the video owner. This cannot be prevented via embed params — it is YouTube's policy and how creators get paid.

### Ad behaviour by scenario

| Scenario | Ads shown? |
|---|---|
| Guardian has YouTube Premium | **Still yes** — WebView is unauthenticated, Premium account is not logged in |
| Guardian has no Premium | Yes |
| Video owner has ads disabled | No |
| Video is from a non-monetized channel | No |

### Key conclusion

There is **no reliable way** to guarantee an ad-free YouTube experience in a WebView. YouTube Premium does not help because the embed loads in an unauthenticated context — the guardian's account is not passed into the WebView. Ads are unpredictable, random, and not suitable for an IDD learner experience.

---

## Recommendation

YouTube is **not suitable for the learner-facing view** due to uncontrollable ads and distracting UI elements (even with embed params). The unpredictability is a real problem for IDD users.

### Better alternatives

| Option | Ads | Setup | Notes |
|---|---|---|---|
| **Vimeo embed** | None by default | Guardian needs a free Vimeo account | Same WebView approach, clean player |
| **Direct upload to Supabase Storage** | None | No extra accounts | Guardian uploads the video file directly |
| **YouTube for guardian reference only** | Yes | None | Guardian uses it for research, not shown to learner |

If YouTube is used at all, restrict it to a **guardian-only research tool** — not displayed in the learner's learning page.

---

## WebView playback — working combination (tested 2026-09-05)

After extensive debugging, the following combination is required to play YouTube embeds reliably inside `react-native-webview`:

### What was tried and failed

| Attempt | Result |
|---|---|
| Plain `html` source, no `baseUrl` | Empty Referer → YouTube returns error 153 for all videos |
| `baseUrl: 'https://www.youtube.com'` | YouTube blocks embed-within-YouTube → error 152 for all videos |
| YouTube IFrame API (`YT.Player`) with `origin: 'https://www.youtube.com'` | Error 152 for all videos |
| `youtube-nocookie.com` alone (no baseUrl, no UA) | Error 153 |
| Custom user agent alone (no baseUrl) | Error 153 |

### What works

```tsx
// source
{ html: buildHtml(videoId), baseUrl: 'https://www.google.com' }

// embed URL inside the HTML
https://www.youtube-nocookie.com/embed/{videoId}?rel=0&modestbranding=1&playsinline=1

// WebView prop
userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
```

### Why each part matters

| Setting | Why it's needed |
|---|---|
| `baseUrl: 'https://www.google.com'` | Sets a real Referer on the iframe request — without it YouTube sees an empty Referer and blocks playback. Must not be `youtube.com` (YouTube blocks self-embeds). |
| `youtube-nocookie.com` embed URL | Less restrictive than `youtube.com` for WebView contexts; no tracking cookies |
| Custom `userAgent` | YouTube detects React Native's WKWebView UA and blocks it; spoofing a standard Safari UA bypasses this check |

### Error codes reference

| Code | Meaning |
|---|---|
| 150 / 101 | Owner has disabled embedding |
| 152 | Detected as embed-within-YouTube, or content ID / copyright block |
| 153 | Embedding disabled, or WebView environment rejected by YouTube |

### Remaining limitation

Videos where the owner has **genuinely disabled embedding** (YouTube Studio → embed setting off) will still show YouTube's own error UI inside the iframe. There is no way to bypass this. Pre-check embeddability using the YouTube Data API v3 (`status.embeddable` field) if you want to catch these at the link step.
