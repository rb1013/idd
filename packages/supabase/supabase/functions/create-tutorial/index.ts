import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json();
    const {
      guardian_id, title, display_name, target_skill, core_action, format,
      visual_style, image_style, pacing, tone, duration_seconds,
      comprehension_level, language, background_audio, category_id, is_public,
    } = body;

    if (!guardian_id || !title || !target_skill || !core_action || !format) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check monthly quota and fetch admin settings
    const month = new Date().toISOString().slice(0, 7);
    const [{ data: quota }, { data: appSettings }] = await Promise.all([
      supabase.from('guardian_tutorial_quota').select('count').eq('guardian_id', guardian_id).eq('month', month).single(),
      supabase.from('app_settings').select('tutorial_quota_limit, tutorial_max_frames').eq('id', 1).single(),
    ]);

    const quotaLimit = appSettings?.tutorial_quota_limit ?? 10;
    const maxFrames  = appSettings?.tutorial_max_frames ?? 4;

    if ((quota?.count ?? 0) >= quotaLimit) {
      return new Response(
        JSON.stringify({ error: `Monthly quota of ${quotaLimit} tutorials reached. Try again next month.` }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const topic = `${target_skill}: ${core_action}`;
    const ai_prompt = buildPrompt({ target_skill, core_action, format, visual_style, image_style, pacing, tone, duration_seconds, comprehension_level, language, frameCount: maxFrames });

    // Insert tutorial record at status: generating
    const { data: tutorial, error: insertError } = await supabase
      .from('tutorials')
      .insert({
        title,
        display_name: display_name ?? null,
        description: `${target_skill} — ${core_action}`,
        category: target_skill,
        category_id: category_id ?? null,
        format,
        topic,
        comprehension_level: comprehension_level ?? 'easy',
        duration_seconds: duration_seconds ?? 20,
        ai_prompt,
        status: 'generating',
        source: 'ai_generated',
        created_by_guardian_id: guardian_id,
        video_url: null,
        thumbnail_url: null,
        core_action: core_action ?? null,
        visual_style: visual_style ?? null,
        image_style: image_style ?? null,
        pacing_label: pacing < 0.5 ? 'slow' : 'normal',
        tone_label: tone > 0.5 ? 'enthusiastic' : 'calm',
        background_audio: background_audio ?? null,
        is_public: is_public ?? true,
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);
    console.log('Tutorial inserted:', tutorial.id);

    // Increment quota (upsert)
    await supabase
      .from('guardian_tutorial_quota')
      .upsert(
        { guardian_id, month, count: (quota?.count ?? 0) + 1 },
        { onConflict: 'guardian_id,month' },
      );

    // Queue async generation job (DB Webhook will fire process-tutorial-job)
    console.log('Inserting tutorial_job for tutorial:', tutorial.id);
    const { error: jobError } = await supabase.from('tutorial_jobs').insert({ tutorial_id: tutorial.id });
    console.log('tutorial_jobs insert result — error:', jobError?.message ?? 'none');
    if (jobError) throw new Error(`Failed to queue job: ${jobError.message}`);

    return new Response(
      JSON.stringify({ tutorial_id: tutorial.id }),
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

interface PromptParams {
  target_skill: string;
  core_action: string;
  format: string;
  visual_style: string;
  image_style: string;
  pacing: number;
  tone: number;
  duration_seconds: number;
  comprehension_level: string;
  language: string;
  frameCount: number;
}

function buildPrompt(p: PromptParams): string {
  const frameCount = p.frameCount;
  const paceLabel = p.pacing < 0.5 ? 'slow and deliberate' : 'normal';
  const toneLabel = p.tone > 0.5 ? 'enthusiastic and encouraging' : 'calm and gentle';

  const visualStyleMap: Record<string, string> = {
    '2D Animation': 'flat vector illustration, bold outlines, bright colours, friendly characters',
    '3D Cartoon': '3D Pixar-style render, vibrant colours, friendly cartoon characters',
    'Real Human': 'photorealistic, natural lighting, real person demonstrating the action',
  };
  const imageStyleMap: Record<string, string> = {
    'Simple & Bold': 'high contrast, minimal detail, large clear shapes, uncluttered background',
    'Detailed': 'realistic scene composition, environmental context, multiple elements',
    'Symbol-Based': 'icon and pictogram style, AAC-compatible visual language, symbolic representation',
  };

  return `Create a ${p.duration_seconds}-second ${p.format} tutorial for an IDD user (${p.comprehension_level} comprehension level) about "${p.core_action}" in the context of ${p.target_skill}. Language: ${p.language}.

Generate exactly ${frameCount} frames. Return ONLY a JSON object in this exact format with no other text:
{
  "frames": [
    {
      "order": 1,
      "caption": "max 4 simple words",
      "tts_text": "One short clear sentence a child could understand.",
      "image_prompt": "Detailed image generation prompt describing exactly what to show."
    }
  ]
}

Rules:
- Tone: ${toneLabel}
- Pacing: ${paceLabel} with very short sentences (max 12 words per sentence)
- Visual style for image_prompt: ${visualStyleMap[p.visual_style] ?? p.visual_style}
- Image composition: ${imageStyleMap[p.image_style] ?? p.image_style}
- Use literal, concrete language only. No metaphors. No idioms.
- One clear idea per frame. Each frame builds on the previous.
- Positive framing only. No negatives or warnings.
- Each image_prompt must describe exactly what visual to show for that specific step.
- caption must be 4 words or fewer, sentence case.`;
}
