import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Triggered by DB Webhook on tutorial_jobs INSERT
serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let jobId: string;
  let tutorialId: string;

  try {
    const payload = await req.json();
    const record = payload.record ?? payload;
    jobId = record.id;
    tutorialId = record.tutorial_id;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
  }

  await supabase
    .from('tutorial_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  try {
    const { data: tutorial, error: fetchErr } = await supabase
      .from('tutorials')
      .select('*')
      .eq('id', tutorialId)
      .single();

    if (fetchErr || !tutorial) throw new Error('Tutorial not found');

    if (tutorial.format === 'video') {
      throw new Error('Video generation is Phase 2 — not yet available. Choose Slideshow or Cards format.');
    }

    // Step 1: Generate script via Claude (captions + narration text per frame)
    const script = await generateScript(tutorial.ai_prompt);

    // Step 2: Insert frame rows (no images or audio — device TTS handles narration)
    const frameRows = script.frames.map((frame: FrameScript) => ({
      tutorial_id: tutorialId,
      order_index: frame.order,
      caption: frame.caption,
      tts_text: frame.tts_text,
      image_url: null,
      audio_url: null,
    }));

    await supabase.from('tutorial_frames').insert(frameRows);

    // Move tutorial to preview — guardian can now review it
    await supabase
      .from('tutorials')
      .update({ status: 'preview', updated_at: new Date().toISOString() })
      .eq('id', tutorialId);

    await supabase
      .from('tutorial_jobs')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('tutorials').update({ status: 'rejected', admin_notes: `Generation failed: ${message}` }).eq('id', tutorialId);
    await supabase.from('tutorial_jobs').update({ status: 'failed', error: message, updated_at: new Date().toISOString() }).eq('id', jobId);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});

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
