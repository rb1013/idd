# Tutorial Platform — Design Notes & Todo

All decisions captured from design discussion. Do not build until instructed.

---

## Overview

Guardians can create AI-generated tutorials for IDD users via a simple form (no prompt writing needed). Tutorials go through admin moderation before appearing in a shared searchable library. Guardians can link any approved tutorial to their user's learning page.

---

## Data Model (4 new tables)

```sql
tutorials
  id, title, description
  format: 'video' | 'slideshow' | 'cards'
  topic (free text)
  category_id → categories          -- links to existing interest categories (Soccer, Music etc.)
  comprehension_level               -- easy / medium / complex / fluent (guardian picks manually)
  duration_seconds (max 30)
  status: 'generating' | 'preview' | 'pending' | 'approved' | 'rejected'
  ai_prompt (system-built prompt, stored for audit)
  created_by_guardian_id → guardians
  thumbnail_url
  link_count                        -- cached count of user_tutorials rows
  created_at, updated_at

tutorial_frames                     -- content for slideshow and cards formats
  id
  tutorial_id → tutorials
  order_index
  text                              -- caption (max 4 words)
  tts_text                          -- full narration sentence (read aloud)
  image_url                         -- stored in Supabase Storage
  audio_url                         -- pre-generated TTS MP3, stored in Supabase Storage

user_tutorials                      -- links a tutorial to an IDD user's learning page
  user_id → user_profiles
  tutorial_id → tutorials
  added_by_guardian_id → guardians
  added_at
  completed_at

guardian_tutorial_quota             -- enforces 10 tutorials/month per guardian
  guardian_id → guardians
  month (YYYY-MM)
  count
```

---

## Business Rules

- Max **10 tutorials per guardian per month** (enforced server-side)
- Max **30 seconds** duration per tutorial
- Every generation attempt (including regeneration at preview stage) **counts against quota**
- Tutorials must be **admin-approved** before appearing in the search library
- "Real Human" visual style is **restricted to video format only**
- Comprehension level is **manually selected** by guardian (Option A — not auto-filled from user)
- Guardian can **withdraw** a tutorial from admin review queue and re-edit
- When an approved + linked tutorial is edited → **old version stays live** until re-approval completes

---

## Guardian Form — 3 Sections

### Section 1 — What to Teach
| Field | Type | Options |
|---|---|---|
| Target Skill * | Dropdown | Speech & Communication, Motor Skills, Daily Living, Social Skills, Numeracy & Literacy, Emotional Regulation |
| Core Action * | Text (max 60 chars) | e.g. "Dribbling a soccer ball" |
| Format * | Visual picker | 🎬 Video · 🖼 Slideshow · 🃏 Cards |
| Duration | Segmented | 15s · 20s · 25s · 30s |

### Section 2 — Look & Feel
| Field | Type | Options / Notes |
|---|---|---|
| Visual Style * | Dropdown | 2D Animation · 3D Cartoon · Real Human *(video only)* |
| Image Style * | Dropdown | Simple & Bold · Detailed · Symbol-Based |
| Pacing | Slider | Slow ←——→ Normal |
| Tone | Slider | Calm ←——→ Enthusiastic |

### Section 3 — Context
| Field | Type | Notes |
|---|---|---|
| Comprehension Level | Chip picker | Easy · Medium · Complex · Fluent — guardian picks manually |
| Language | Dropdown | Pulled from user's languages list |
| Background Audio | Toggle group | 🔇 None · 🎵 Calm · 🥁 Upbeat |

---

## How Form Fields Map to AI Prompt (system-built, guardian never sees this)

```
"Create a {duration}-second {format} tutorial for an IDD user
({comprehension_level} comprehension) about '{core_action}'
in the context of {target_skill}.

Generate {duration / 5} frames. For each frame:
- caption: max 4 words, simple vocabulary, no metaphors
- narration: 1 short sentence, {tone} tone, {pacing} pace
- image_prompt: {visual_style} style, {image_style} composition
  showing [specific action for this step]

Use literal, concrete language. One idea per frame.
Positive framing only. Language: {language}."
```

---

## AI Generation & Orchestration Layer

### Services
| Job | Service | Notes |
|---|---|---|
| Script + card/frame text | Claude API (`claude-haiku-4-5`) | Fast, cheap, structured JSON output |
| Images per frame | Stability AI REST API | ~$0.03–0.06/image, no SDK needed |
| Narration audio | OpenAI TTS (`tts-1`) | ~$0.015/1000 chars, outputs MP3 |
| Video generation | **Phase 2** (Luma AI / Runway) | Requires account + budget — defer |

### Edge Functions (Supabase)
| Function | Trigger | Responsibility |
|---|---|---|
| `create-tutorial` | HTTP (mobile) | Validate quota → insert tutorial (status: generating) → queue job → return immediately |
| `process-tutorial-job` | DB Webhook on `tutorial_jobs` | Call Claude → Stability AI → OpenAI TTS → store assets → set status: preview |
| `approve-tutorial` | HTTP (admin portal) | Set status: approved, notify guardian |
| `reject-tutorial` | HTTP (admin portal) | Set status: rejected, store admin notes, notify guardian |
| `check-tutorial-quota` | HTTP (mobile) | Return current month count for guardian |

### Async Job Queue
- Cards format: ~15–20s — can be synchronous (within Edge Function timeout)
- Slideshow format: ~25–40s — async via `tutorial_jobs` table + DB Webhook
- Video format: Phase 2 — async, external API webhook callback

### Generation flow
```
Guardian submits form
  → check quota (10/month)
  → insert tutorial (status: generating)
  → insert tutorial_jobs row
  → return immediately → mobile shows "Creating your tutorial…"
  → DB Webhook fires process-tutorial-job
  → Claude generates structured script (JSON with frames)
  → Stability AI generates images in parallel per frame
  → OpenAI TTS generates audio per frame
  → assets stored in Supabase Storage
  → tutorial_frames rows inserted
  → tutorial status → 'preview'
  → Supabase Realtime pushes notification to guardian
```

---

## Tutorial Lifecycle & State Machine

```
generating → preview → pending (admin queue) → approved → [linked to users]
                ↑           ↑                      ↑
           regenerate    withdraw              edit triggers
           (costs        and re-edit           re-approval,
            quota)       (no extra cost)       old version
                                               stays live
                                               until re-approved
```

### Status definitions
| Status | Meaning |
|---|---|
| `generating` | AI is producing content |
| `preview` | Generation complete, guardian reviewing |
| `pending` | Submitted to admin moderation queue |
| `approved` | Live in shared library |
| `rejected` | Admin rejected with notes |

---

## Edit Scenarios

### At Preview (status: preview)
- **Metadata only** (title, description, tags) → no regeneration, no quota cost, submit as-is
- **Content change** (form fields) → full regeneration → **costs quota** → new preview
- **Frame-level edit** → edit caption/narration text inline (no AI call, no quota) OR regenerate single frame image (minimal AI call, no quota cost)

### Pending Admin Review (status: pending)
- Guardian can **withdraw** tutorial → status back to `preview`
- Can re-edit form → regenerate → resubmit to queue
- No extra quota cost (same tutorial)

### Rejected by Admin (status: rejected)
- Guardian sees admin notes, optionally highlighted per frame
- **Fix specific frames** → edit text inline or regenerate single frame → resubmit → no quota cost
- **Full redo** → change form entirely → full regeneration → **costs quota**

### Approved, Not Linked (link_count = 0)
- Guardian edits → full regeneration → **costs quota** → status resets to `pending`
- Tutorial disappears from search library until re-approved

### Approved, Linked to Users (link_count > 0)
- Warning shown: *"This tutorial is linked to X user profiles. Editing will keep the current version live until re-approved."*
- Guardian confirms → full regeneration → **costs quota** → status resets to `pending`
- **Old version stays live** until new version is approved
- On re-approval, new version replaces old for all linked users

---

## Frame-Level Editor (in Preview screen)

Included in first version.

```
┌──────────────────────────────────────────┐
│  Frame 3 of 5                    [Edit]  │
│  ┌────────────────────────────────────┐  │
│  │      [AI generated image]          │  │  ← tap 🔄 to regenerate this image only
│  └────────────────────────────────────┘  │
│  Caption: "Tap the ball forward"    [✏]  │  ← edit inline, no AI call
│  Narration: "Use the inside of..."  [✏]  │  ← edit inline, no AI call
└──────────────────────────────────────────┘
     [← Prev]                    [Next →]
```

- Edit caption/narration text → no AI call, no quota
- Regenerate single frame image → AI call for one image only, no quota cost
- Reorder frames → drag handle, no AI call

---

## Admin Portal (Web — existing TutorialsPage)

New moderation section:

### Moderation Queue tab
- List of `pending` tutorials sorted by submission date
- Per row: guardian name, tutorial title, format badge, duration, submitted date
- Tap to open preview

### Preview & Review
- Plays through all frames (or video) inline
- Shows AI prompt used (for audit)
- **Approve** button → status: approved, guardian notified
- **Reject** button → opens notes field → status: rejected, guardian notified with notes
- Admin can flag specific frames in the notes (frame number reference)

### Library tab
- All approved tutorials
- Can flag / remove if reported inappropriate after approval

---

## Guardian Search & Link Flow (Mobile)

### Search
- Search bar + filters: keyword, category (interest), comprehension level, duration range, format, visual style
- Results: only `approved` tutorials
- Card shows: thumbnail, title, creator guardian name, duration, format badge, link count

### Link to user
- Tap "Add to [User]'s Learning" on any tutorial
- Creates `user_tutorials` row
- Increments `link_count` on tutorial

---

## IDD User Learn Screen

- Already exists (`TutorialsScreen`)
- Needs to query `user_tutorials` for that specific user instead of global list
- Plays frames in sequence with TTS narration audio from `audio_url`

---

## New Screens Needed

| App | Screen | Notes |
|---|---|---|
| Guardian mobile | Create Tutorial | 3-section form + quota indicator |
| Guardian mobile | Tutorial Preview | Frame viewer + frame-level editor + submit/withdraw |
| Guardian mobile | Tutorial Library | Search + filters + link to user |
| Guardian mobile | My Tutorials | Guardian's own tutorials + status badges |
| Admin web | Moderation Queue | On existing TutorialsPage |
| Admin web | Tutorial Preview/Review | Approve / Reject with notes |

---

## Phase 2 (Video Format)

- Plug Luma AI or Runway ML into `process-tutorial-job` when `format = 'video'`
- Requires: account setup, budget allocation, webhook callback for async completion
- "Real Human" visual style only available when format = video
- All other pipeline (quota, moderation, storage, linking) stays identical — no architectural changes

---

## Open Items Before Building

- [ ] Confirm AI service accounts: Stability AI API key, OpenAI API key (for TTS)
- [ ] Confirm Supabase plan (Pro required for 150s Edge Function timeout for slideshow async jobs)
- [ ] Decide guardian display name shown in tutorial search results (full name or username?)
- [ ] Notification mechanism when admin approves/rejects (push notification or in-app only?)
