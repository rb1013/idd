import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const IMAGE_BUCKET = 'tutorial-images';
const AUDIO_BUCKET = 'tutorial-audio';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { frame_id, image_prompt, tts_text, regenerate_audio } = await req.json();
    if (!frame_id) {
      return new Response(JSON.stringify({ error: 'frame_id required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch frame + tutorial (verify status allows editing)
    const { data: frame, error: fetchErr } = await supabase
      .from('tutorial_frames')
      .select('*, tutorials(id, status)')
      .eq('id', frame_id)
      .single();

    if (fetchErr || !frame) throw new Error('Frame not found');

    const tutorialStatus = (frame as any).tutorials?.status;
    if (!['preview', 'rejected', 'approved'].includes(tutorialStatus)) {
      throw new Error('Frame can only be edited when tutorial is in preview, approved, or rejected status');
    }

    const tutorialId = (frame as any).tutorials?.id ?? frame.tutorial_id;
    const orderIndex: number = frame.order_index;
    const storagePath = `${tutorialId}/frame-${orderIndex}`;
    const updates: Record<string, string | null> = {};

    // Text updates (no AI call, no quota)
    if (tts_text !== undefined) updates.tts_text = tts_text;

    // Image regeneration
    if (image_prompt) {
      const imageUrl = await regenerateImage(supabase, image_prompt, `${storagePath}.png`);
      if (imageUrl) updates.image_url = imageUrl;
      updates.image_prompt = image_prompt;
    }

    // Audio regeneration (OpenAI TTS-1) — when tts_text changed OR regenerate_audio flag set
    const audioText = tts_text ?? frame.tts_text;
    if ((regenerate_audio || tts_text !== undefined) && audioText) {
      const audioUrl = await regenerateAudio(supabase, audioText, `${storagePath}.mp3`);
      if (audioUrl) updates.audio_url = audioUrl;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('tutorial_frames').update(updates).eq('id', frame_id);
    }

    const { data: updated } = await supabase
      .from('tutorial_frames')
      .select('*')
      .eq('id', frame_id)
      .single();

    return new Response(
      JSON.stringify({ ok: true, frame: updated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

async function regenerateImage(
  supabase: ReturnType<typeof createClient>,
  prompt: string,
  storagePath: string,
): Promise<string | null> {
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
      size: '1024x1024',
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ''); }
    throw new Error(`Image error: ${res.status} — ${detail}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data from gpt-image-1');

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const imageData = bytes.buffer;

  const { error: uploadErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, imageData, { contentType: 'image/png', upsert: true });

  if (uploadErr) throw new Error(`Image upload error: ${uploadErr.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(storagePath);

  return publicUrl;
}

async function regenerateAudio(
  supabase: ReturnType<typeof createClient>,
  text: string,
  storagePath: string,
): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice: 'nova',
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text().catch(() => ''); }
    throw new Error(`TTS error: ${res.status} — ${detail}`);
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
}
