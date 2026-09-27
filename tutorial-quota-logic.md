# AI Tutorial Quota — How It Works

## What the quota is

Every guardian gets a limited number of AI-generated tutorials per month (10 by default, but admins can change this number in the admin console). This limit exists because each tutorial costs real money — every time one is generated, the app pays for a Claude AI call (to write the script) plus a DALL·E call per image plus an OpenAI text-to-speech call per audio clip. Without a cap, one guardian could generate an unlimited number of tutorials and run up an unlimited bill.

The count resets every calendar month and is tracked per guardian.

## When a slot gets used up

A slot is spent whenever a guardian asks the app to **generate a full tutorial from scratch**. There are two ways this happens, and both cost exactly the same (because both trigger the exact same AI pipeline):

1. **Creating a brand-new tutorial** — filling out the "Create Tutorial" form and submitting it.
2. **Regenerating an existing tutorial** — tapping "Re-generate" on a tutorial that already exists, to throw away its current slides and make new ones.

Both of these charge one slot the moment the guardian confirms, before the AI even starts working. This is deliberate — it stops a guardian from creating one tutorial and then regenerating it over and over for free, which would defeat the whole point of the limit.

**What does *not* cost a slot:** editing one part of an existing tutorial, like changing a single slide's caption, rewriting its narration text, or regenerating just that one slide's image. Those are small, cheap edits, not a full tutorial rebuild, so they're free.

## When a slot is automatically given back

Sometimes the AI generation fails for reasons that have nothing to do with the guardian — for example, if the AI service the app depends on runs out of credits, or some other unexpected technical error happens mid-generation. When that happens, the app automatically hands the guardian's slot back, so they don't lose part of their monthly allowance over a problem that wasn't their fault.

This automatic refund only happens for genuine **technical failures**. It does *not* happen when:
- A human admin reviews a tutorial and rejects it for content reasons (the guardian actually got a working tutorial generated — it just wasn't approved).
- Only the image or audio for a slide fails to generate — the app treats that as non-fatal and still finishes the tutorial (just missing that one picture or sound clip), so nothing needed to be refunded.

## What happens to a tutorial that failed for a technical reason

If a tutorial fails due to a technical error, the guardian sees a clear "Technical Error" message asking them to contact support — not the confusing "Rejected by Admin" message they'd see for an actual content rejection. They **can't** tap "Re-generate" on it themselves, because:
- Trying again would likely hit the exact same technical problem (there's no point charging them again for a retry that's probably going to fail the same way).
- Their slot was already given back automatically, so regenerating it would need to charge them a fresh slot for what's really the same original request.

Support needs to look into it and, once the underlying issue is fixed, help the guardian from there.

## Where this is enforced

The quota check and charge don't just happen in the app on the guardian's phone — they happen on the server, inside two dedicated pieces of backend code (one for creating, one for regenerating). This matters because it means a guardian can't get around the limit just by tinkering with the app; the real decision about whether they're allowed to generate another tutorial is made and enforced on the server every single time.

---

## Implementation notes (for engineers)

- **Quota storage**: `guardian_tutorial_quota` table — one row per `(guardian_id, month)`, with a `count` column.
- **Configurable limit**: `app_settings.tutorial_quota_limit` (admin-editable in the admin console's App Settings page; default 10).
- **Charging on creation**: `packages/supabase/supabase/functions/create-tutorial/index.ts` — checks the limit, then upserts `count + 1`, then inserts the `tutorials` row and queues a `tutorial_jobs` row.
- **Charging on regeneration**: `packages/supabase/supabase/functions/regenerate-tutorial/index.ts` — verifies the caller owns the tutorial, blocks regenerating a technical-error tutorial, checks the limit, charges the same way, then resets the tutorial to `status: 'generating'` and queues a fresh job. Called from `TutorialPreviewScreen.tsx`'s "Re-generate" button.
- **The actual AI pipeline**: `packages/supabase/supabase/functions/process-tutorial-job/index.ts`, triggered asynchronously by a DB webhook whenever a `tutorial_jobs` row is inserted (by either of the two functions above). Calls Claude for the script, then DALL·E + OpenAI TTS per frame.
- **Auto-refund on technical failure**: in `process-tutorial-job`'s catch block — on any uncaught failure (Claude API error, frame-insert failure, etc.), it marks the tutorial `rejected` with `admin_notes` starting with `"Generation failed:"`, and decrements that guardian's `guardian_tutorial_quota.count` for the month by 1 (never below 0).
- **Detecting "technical error" vs. a real admin rejection**: any screen that needs to tell them apart checks whether `admin_notes` starts with the literal string `"Generation failed:"` — a real admin's typed rejection note never starts with that exact prefix, since that text is only ever written by the pipeline's own failure handler.
- **Non-fatal image/audio failures**: `generateAndStoreImage` / `generateAndStoreAudio` in `process-tutorial-job/index.ts` each catch their own errors internally and return `null` rather than throwing — so a DALL·E or TTS failure doesn't fail the whole job or trigger a refund, it just leaves that one frame's image/audio empty.
