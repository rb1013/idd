# AI Tutorial Generation

## How it works

When a guardian creates a tutorial, the generation pipeline runs asynchronously in three steps:

1. **`create-tutorial` edge function** — inserts a row in `tutorials` (status: `generating`) and a row in `tutorial_jobs`, then returns in ~1s. The guardian is immediately navigated to "My Tutorials" — they never wait on a spinner.

2. **DB Webhook (`on_tutorial_job_insert`)** — fires `process-tutorial-job` automatically whenever a new row is inserted into `tutorial_jobs`. This is the async job queue mechanism.

3. **`process-tutorial-job` edge function** — does the actual AI work:
   - Calls **Claude** (`claude-haiku-4-5`) to generate the script (captions, narration, image prompts per frame)
   - Calls **DALL·E 3** (`gpt-image-1`) to generate an image per frame
   - Calls **OpenAI TTS-1** to generate audio narration per frame
   - Inserts frames into `tutorial_frames` and updates tutorial status to `preview` (or `approved` if private)

The "My Tutorials" screen polls every 4s and updates the status badge automatically when generation completes.

---

## Services used

| Step | Service | Why |
|------|---------|-----|
| Script (captions, narration, image prompts) | Claude `claude-haiku-4-5` | Structured JSON, IDD-appropriate language, cheap + fast |
| Image generation | OpenAI `gpt-image-1` | Claude cannot generate images |
| Audio narration | OpenAI TTS-1 (`nova` voice) | Claude cannot generate audio |

---

## Parallelization

Image and audio generation for all frames runs **in parallel** — all frames are processed concurrently, and within each frame, image and audio are also concurrent.

```
Script (sequential, ~5s)
  └─ Frame 1: image + audio (parallel)  ─┐
  └─ Frame 2: image + audio (parallel)  ─┤ all concurrent
  └─ Frame 3: image + audio (parallel)  ─┘
DB writes (~2s)
```

**Worst-case wall time** = Claude (~5s) + max(IMAGE_TIMEOUT, AUDIO_TIMEOUT) + DB writes = ~72s (with 65s image timeout).

Previously the loop was sequential, meaning 3 frames × 60s = up to 180s — which could have exceeded the free-tier limit.

---

## Supabase Edge Function limits

| Plan | Wall-clock (worker active) | CPU time per request | Idle timeout |
|------|---------------------------|----------------------|--------------|
| Free | 150s | 2s | 150s |
| Paid | 400s | 2s | 400s |

**Important:** the 2s CPU limit does **not** count time spent waiting on network calls (Claude, DALL·E, TTS). All the heavy work is async I/O, so the CPU limit is not a concern. The wall-clock limit is the only one that matters here.

The function responds to the webhook immediately via `EdgeRuntime.waitUntil()`, so the idle timeout does not apply to the background generation work.

---

## Timeouts

Both timeouts are configurable by admin from the **App Settings** page and stored in `app_settings`.

| Timeout | Default | Purpose |
|---------|---------|---------|
| `tutorial_image_timeout_ms` | 65,000ms (65s) | Max wait for a single DALL·E image call |
| `AUDIO_TIMEOUT_MS` | 20,000ms (20s) | Max wait for a single TTS audio call (hardcoded) |

With parallelization, the image timeout is the dominant factor. Raising it reduces failures from slow DALL·E responses — the guardian is unaffected since they're not waiting on a spinner.

### Why 65s for images?

- DALL·E (`gpt-image-1`) typically responds in 10–20s under normal load, occasionally 40–60s under high load
- 65s catches the slow-but-not-broken calls that previously caused unnecessary failures
- Worst-case total with 65s timeout: ~72s — well within the 150s free-tier wall-clock limit

---

## What happens when generation fails

If any step throws (timeout, API error, etc.), `process-tutorial-job` catches it and:
- Sets tutorial status to `rejected` with the error in `admin_notes`
- Sets the job status to `failed`

The guardian sees "Rejected by Admin" (misleading label — really means generation failed). Tapping **Re-generate Tutorial** clears the frames, resets status to `generating`, and queues a new job.

---

## Claude prompt — IDD context and language rules

The prompt sent to Claude explicitly identifies the audience and enforces IDD-appropriate language:

**Opening line:**
> "Create a 25-second slideshow tutorial for an **IDD user** (easy comprehension level) about `{core_action}` in the context of `{target_skill}`."

**Language rules enforced in the prompt:**

| Rule | Detail |
|------|--------|
| Audience | Explicitly stated as "IDD user" with comprehension level (easy / medium / complex / fluent) |
| Caption length | Max 4 words per caption |
| Narration length | Max 12 words per sentence |
| Narration style | "One short clear sentence a child could understand" |
| Language type | Literal and concrete only — no metaphors, no idioms |
| Frame structure | One clear idea per frame; each frame builds on the previous |
| Framing | Positive only — no negatives, no warnings |
| Visual prompts | Describes exactly what to show for that specific step |

These rules are baked into `buildPrompt()` in `create-tutorial/index.ts` and apply to every tutorial regardless of topic or guardian.

---

## Approximate cost per tutorial (3 frames, 25s)

| Service | Cost |
|---------|------|
| Claude script | ~$0.002 |
| DALL·E 3 images (3×) | ~$0.12 |
| TTS-1 audio (3 frames) | ~$0.001 |
| **Total** | **~$0.12 per tutorial** |
