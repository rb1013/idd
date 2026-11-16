# Replacing OpenAI `tts-1` with Google Cloud Text-to-Speech

**Status:** Planned, not started
**Written:** 2026-11-15
**Deadline:** switch and deploy **before January 6, 2027** (ideally tested in December)

---

## Why

- OpenAI shuts down **`tts-1`** (and `tts-1-hd`, `gpt-4o-mini-tts`) on **January 6, 2027**. After that date, requests are **rejected with an error**. The model doesn't keep working unsupported (same as `gpt-image-1`, which failed with "model does not exist" after its shutdown).
- OpenAI's suggested replacement, `gpt-realtime-2.1-mini`, is **not supported on `/v1/audio/speech`**. It needs the Realtime (streaming) API, so it's not a name swap.
- **Impact after January 6 if nothing changes:**

  | | Result |
  |---|---|
  | Existing narration `.mp3` files | ✅ Keep playing (stored in our Supabase Storage) |
  | Creating a new AI tutorial | ❌ **Fails completely**: image and audio are generated together per slide, so a TTS failure fails the whole job |
  | Re-generate tutorial | ❌ Fails |
  | Save & regenerate audio (slide editor) | ❌ Error |
  | Regenerate image, YouTube tutorials | ✅ Unaffected |

### Options considered

| Option | Verdict |
|---|---|
| A. OpenAI Realtime API (`gpt-realtime-2.1-mini`) | Complex (streaming, raw audio → WAV/MP3); conversational model may reword text |
| B. OpenAI audio chat model (`gpt-audio-1.5`) | Simpler, but also conversational, so the exact-wording risk remains |
| **C. Dedicated TTS provider (Google Cloud)** | ✅ **Chosen**: text in, MP3 out, reads the **exact** words, closest to today's code |
| D. On-device voice (`expo-speech`) | Free, but voice varies by device and changes how slides play |

Exact wording matters: narration is written for learners with IDD (simple language, at most 150 characters), so it must be read word for word.

---

## Where TTS is used today

| File | Code |
|---|---|
| `packages/supabase/supabase/functions/process-tutorial-job/index.ts` | `TTS_VOICE = 'nova'` (line 16), `TTS_MODEL = 'tts-1'` (line 17), call to `https://api.openai.com/v1/audio/speech` (~line 286) |
| `packages/supabase/supabase/functions/regenerate-frame/index.ts` | `regenerateAudio()`: `/v1/audio/speech` with `'tts-1'` and `'nova'` hard-coded (~line 171) |

Both upload the MP3 to `tutorial-audio/<tutorialId>/frame-<n>-<jobId|timestamp>.mp3` (unique names, see `TODO.md` → Storage). **That part doesn't change.**

---

## How Google Cloud TTS works

```
POST https://texttospeech.googleapis.com/v1/text:synthesize
Headers: x-goog-api-key: <GOOGLE_TTS_API_KEY>, Content-Type: application/json
{
  "input":       { "text": "Use the inside of your foot to tap the ball forward." },
  "voice":       { "languageCode": "en-US", "name": "<TTS_VOICE>" },
  "audioConfig": { "audioEncoding": "MP3", "speakingRate": 0.9 }
}
→ { "audioContent": "<base64-encoded MP3>" }
```

Decode `audioContent` from base64 and upload the bytes as today.

**Authentication:** Google's docs show service-account (OAuth) tokens, but Text-to-Speech also accepts **API keys**, which are much simpler from an edge function. If the Google Cloud console requires the API key to be bound to a service account when creating it, set that up instead (more setup, same code shape).

---

## Voice tiers and cost (as of November 2026)

| Tier | Quality | Price per 1M characters | Free per month |
|---|---|---|---|
| Standard | Basic, synthetic | $4 | ~4M characters |
| WaveNet | Good | $4 | ~4M (with Standard) |
| Neural2 | Very good | $16 | — |
| **Chirp 3: HD** | Most natural (closest to OpenAI "nova") | $30 | ~1M characters |

**Expected usage:** at most 150 characters × ~4 slides ≈ **600 characters per tutorial**. With 10 tutorials per guardian per month, **100 active guardians ≈ 600K characters/month** (plus edits), which is **within the free allowance** even for Chirp 3: HD. **Choose on quality, not cost.**

**Recommendation:** a **Chirp 3: HD** voice that's warm and clear (similar to "nova"). Pick it by listening to samples in Google's voice list. Consider a **speaking rate of ~0.9** for learners, and confirm the chosen voice supports that setting.

---

## Setup (one-time, done by you)

- [ ] **Google Cloud Console:** create a project (e.g. `co-heart`).
- [ ] **Enable billing** on the project (required even within the free allowance).
- [ ] **Enable "Cloud Text-to-Speech API".**
- [ ] **Create an API key**, then **restrict it to the Text-to-Speech API only**.
- [ ] **Set a budget alert** (e.g. $5/month) so unexpected usage is noticed.
- [ ] **Choose a voice:** listen to samples, note the exact voice name (e.g. a `en-US-Chirp3-HD-…` voice).
- [ ] **Supabase → Edge Functions → Secrets:**
  - `GOOGLE_TTS_API_KEY` = the API key
  - `TTS_VOICE` = the chosen voice name (changeable later without a code change, like `IMAGE_MODEL`)
  - *(optional)* `TTS_SPEAKING_RATE` = e.g. `0.9`

---

## Code changes (to implement)

- [ ] New `packages/supabase/supabase/functions/_shared/tts.ts`:
  - `synthesizeSpeech(text: string): Promise<ArrayBuffer>`: reads `GOOGLE_TTS_API_KEY`, `TTS_VOICE` (and optional rate) **per call**, calls `text:synthesize`, decodes base64 to bytes, and throws a clear error naming the voice on failure.
- [ ] `process-tutorial-job/index.ts`: replace the OpenAI TTS call in `generateAndStoreAudio()` with `synthesizeSpeech()`; remove `TTS_MODEL` / `TTS_VOICE`.
- [ ] `regenerate-frame/index.ts`: replace the OpenAI call in `regenerateAudio()` with `synthesizeSpeech()`.
- [ ] Keep the existing timeouts (`AUDIO_TIMEOUT_MS = 20s` in `process-tutorial-job`).
- [ ] Deploy: `cd packages/supabase && npx supabase functions deploy process-tutorial-job regenerate-frame`

`OPENAI_API_KEY` is still needed for images (`IMAGE_MODEL`).

---

## Test

- [ ] Create a new AI tutorial: generates fully, narration plays, the voice sounds right.
- [ ] Slide editor → **Save & regenerate audio**: new narration plays immediately.
- [ ] **Re-generate tutorial**: all slides get new audio.
- [ ] Narration is read **word for word** (compare with `tts_text`).
- [ ] Listen with learners in mind: pace, clarity, tone.
- [ ] Check usage in the Google Cloud console after a few tutorials.
- [ ] Wrong or missing key → a clear error in Edge Function logs.

---

## Other follow-ups

- [ ] **Privacy policy** (`PRIVACY_POLICY_AND_TERMS.md`, service providers table): add **Google Cloud**, "Creating narration audio; tutorial narration text only". Update the **OpenAI** row to images only. Only narration text is sent, never learner names or profiles.
- [ ] Update `TODO.md` / `RLS.md` references to `tts-1` once switched.

---

## Open decisions

- [ ] **Voice tier:** Chirp 3: HD (recommended) or Neural2?
- [ ] **Specific voice name** (after listening to samples)
- [ ] **Speaking rate:** 1.0 (normal) or ~0.9 (slightly slower)?

---

## Sources

- [OpenAI API deprecations](https://developers.openai.com/api/docs/deprecations)
- [OpenAI text-to-speech guide](https://developers.openai.com/docs/guides/text-to-speech)
- [OpenAI's named TTS replacement lists v1/audio/speech as not supported](https://mixed-news.com/en/openai-tts-replacement-gpt-realtime-2-1-mini-audio-speech-not-supported/)
- [Google Cloud Text-to-Speech: create audio from text (REST)](https://docs.cloud.google.com/text-to-speech/docs/create-audio-text-command-line)
- [Google Cloud Text-to-Speech plans and pricing (2026)](https://costbench.com/software/ai-voice-tools/google-cloud-text-to-speech/)
- [Google Cloud Text-to-Speech free plan 2026](https://costbench.com/software/ai-voice-tools/google-cloud-text-to-speech/free-plan/)
