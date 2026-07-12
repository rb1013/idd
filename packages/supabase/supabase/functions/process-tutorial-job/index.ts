import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_KEY        = Deno.env.get('CLAUDE_API_KEY')!;
const OPENAI_API_KEY        = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const IMAGE_SIZE   = '1024x1024';
const TTS_VOICE    = 'nova';      // friendly, clear voice
const TTS_MODEL    = 'tts-1';
const IMAGE_BUCKET = 'tutorial-images';
const AUDIO_BUCKET = 'tutorial-audio';

// Triggered by DB Webhook on tutorial_jobs INSERT
serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let jobId: string;
  let tutorialId: string;

  try {
    const payload = await req.json();
    const record  = payload.record ?? payload;
    jobId      = record.id;
    tutorialId = record.tutorial_id;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
  }

  // Respond to the webhook immediately — AI generation runs in the background.
  // This prevents the webhook from timing out (default 5s) while Claude + DALL·E
  // + TTS do their work (30–60s).
  EdgeRuntime.waitUntil(processJob(supabase, jobId, tutorialId));
  return new Response(JSON.stringify({ ok: true, status: 'queued' }), { status: 200 });
});

const MAX_FRAMES       = 3;      // cap to stay within 150s Supabase timeout
const IMAGE_TIMEOUT_MS = 40_000; // 40s per image (gpt-image-1 can be slow)
const AUDIO_TIMEOUT_MS = 20_000; // 20s per audio clip

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function processJob(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  tutorialId: string,
) {
  await supabase
    .from('tutorial_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    console.log(`[job:${jobId}] fetching tutorial ${tutorialId}`);
    const { data: tutorial, error: fetchErr } = await supabase
      .from('tutorials')
      .select('*')
      .eq('id', tutorialId)
      .single();

    if (fetchErr || !tutorial) throw new Error('Tutorial not found');
    if (tutorial.format === 'video') throw new Error('Video generation not yet available.');

    // ── Step 1: Generate script via Claude ────────────────────────────────────
    console.log(`[job:${jobId}] generating script`);
    const script = await withTimeout(generateScript(tutorial.ai_prompt), AUDIO_TIMEOUT_MS, 'Claude script');

    // Cap frames to avoid timeout
    const frames = script.frames.slice(0, MAX_FRAMES);
    console.log(`[job:${jobId}] script ready — ${frames.length} frames (capped at ${MAX_FRAMES})`);

    // ── Step 2: Generate image + audio for each frame ─────────────────────────
    const frameRows = [];
    let thumbnailUrl: string | null = null;

    for (const frame of frames) {
      const storagePath = `${tutorialId}/frame-${frame.order}`;
      console.log(`[job:${jobId}] frame ${frame.order}: generating image`);

      const imageUrl = await withTimeout(
        generateAndStoreImage(supabase, frame.image_prompt, `${storagePath}.png`),
        IMAGE_TIMEOUT_MS, `image frame ${frame.order}`,
      );
      console.log(`[job:${jobId}] frame ${frame.order}: image done — generating audio`);

      const audioUrl = await withTimeout(
        generateAndStoreAudio(supabase, frame.tts_text, `${storagePath}.mp3`),
        AUDIO_TIMEOUT_MS, `audio frame ${frame.order}`,
      );
      console.log(`[job:${jobId}] frame ${frame.order}: audio done`);

      if (frame.order === 1) thumbnailUrl = imageUrl;

      frameRows.push({
        tutorial_id:  tutorialId,
        order_index:  frame.order,
        caption:      frame.caption,
        tts_text:     frame.tts_text,
        image_prompt: frame.image_prompt,
        image_url:    imageUrl,
        audio_url:    audioUrl,
      });
    }

    // ── Step 3: Persist frames + update tutorial ───────────────────────────────
    console.log(`[job:${jobId}] inserting ${frameRows.length} frames`);
    await supabase.from('tutorial_frames').insert(frameRows);

    await supabase
      .from('tutorials')
      .update({ status: 'preview', thumbnail_url: thumbnailUrl, updated_at: new Date().toISOString() })
      .eq('id', tutorialId);

    await supabase
      .from('tutorial_jobs')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`[job:${jobId}] done`);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[job:${jobId}] failed:`, message);
    await supabase.from('tutorials')
      .update({ status: 'rejected', admin_notes: `Generation failed: ${message}` })
      .eq('id', tutorialId);
    await supabase.from('tutorial_jobs')
      .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  }
}

// ── Claude script generation ──────────────────────────────────────────────────

interface FrameScript {
  order: number;
  caption: string;
  tts_text: string;
  image_prompt: string;
}

async function generateScript(prompt: string): Promise<{ frames: FrameScript[] }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');
  return JSON.parse(jsonMatch[0]);
}

// ── DALL·E 3 image generation ─────────────────────────────────────────────────

async function generateAndStoreImage(
  supabase: ReturnType<typeof createClient>,
  prompt: string,
  storagePath: string,
): Promise<string | null> {
  try {
    // Request image from DALL·E 3
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: IMAGE_SIZE,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`DALL·E error: ${JSON.stringify(err)}`);
    }

    const json = await res.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data returned from gpt-image-1');

    // Decode base64 → ArrayBuffer
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const imageData = bytes.buffer;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(storagePath, imageData, { contentType: 'image/png', upsert: true });

    if (uploadErr) throw new Error(`Storage upload error: ${uploadErr.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from(IMAGE_BUCKET)
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (err) {
    // Non-fatal: return null so generation continues without image
    console.error('Image generation failed:', err);
    return null;
  }
}

// ── OpenAI TTS-1 audio generation ─────────────────────────────────────────────

async function generateAndStoreAudio(
  supabase: ReturnType<typeof createClient>,
  text: string,
  storagePath: string,
): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: text,
        voice: TTS_VOICE,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`TTS error: ${JSON.stringify(err)}`);
    }

    const audioData = await res.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(storagePath, audioData, { contentType: 'audio/mpeg', upsert: true });

    if (uploadErr) throw new Error(`Audio upload error: ${uploadErr.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (err) {
    // Non-fatal: fall back to device TTS
    console.error('Audio generation failed:', err);
    return null;
  }
}
