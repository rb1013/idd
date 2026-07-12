# Working Details

## API Keys Usage

`process-tutorial-job` uses two different AI services for two different jobs:

| Step | Service | Why |
|---|---|---|
| **Script generation** — captions, narration text, image prompts per frame | **Claude** (`claude-haiku-4-5`) | Structured JSON output, better at writing simple clear language for IDD users, cheap + fast |
| **Image generation** — actual visuals per frame | **OpenAI DALL·E 3** | Claude can't generate images |
| **Audio narration** — MP3 per frame | **OpenAI TTS-1** | Claude can't generate audio |

### Where to get the keys

- **CLAUDE_API_KEY** — [console.anthropic.com](https://console.anthropic.com) → API Keys
- **OPENAI_API_KEY** — [platform.openai.com](https://platform.openai.com) → API Keys (requires billing enabled)

### Where to add them

Supabase dashboard → **Edge Functions** → **Manage secrets**

### Rough cost per tutorial (20s, 4 frames)

| Service | Cost |
|---|---|
| Claude script | ~$0.002 |
| DALL·E 3 images (4×) | ~$0.16 |
| TTS-1 audio (4 frames) | ~$0.001 |
| **Total** | **~$0.17 per tutorial** |

---

## DB Webhook — `on_tutorial_job_insert`

### Why it's needed

When a guardian submits a tutorial form, the `create-tutorial` edge function inserts a row into `tutorial_jobs` and returns immediately — the app doesn't hang waiting for AI generation (which takes 30–60 seconds).

The webhook watches `tutorial_jobs` for new `INSERT` events and automatically fires `process-tutorial-job`, which does the heavy work:
- Calls Claude for the script
- Calls DALL·E 3 for each image
- Calls OpenAI TTS for each audio file
- Updates the tutorial status to `preview`

Without the webhook, `process-tutorial-job` would never get called and tutorials would stay stuck at `generating` forever. It's the async job queue — `create-tutorial` queues the job, the webhook kicks off the worker.

### Setup

Supabase dashboard → **Database → Webhooks → Create a new hook**

| Field | Value |
|---|---|
| Name | `on_tutorial_job_insert` |
| Table | `tutorial_jobs` |
| Events | `INSERT` |
| Type | Supabase Edge Functions |
| Edge Function | `process-tutorial-job` |
