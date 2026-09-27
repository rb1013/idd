import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildTutorialPrompt } from '../_shared/tutorialPrompt.ts';

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
    const pacing_label = pacing < 0.5 ? 'slow' : 'normal';
    const tone_label = tone > 0.5 ? 'enthusiastic' : 'calm';
    const ai_prompt = buildTutorialPrompt({
      target_skill, core_action, format, visual_style, image_style,
      pacing_label, tone_label, duration_seconds, comprehension_level, language,
      frameCount: maxFrames,
    });

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
        pacing_label,
        tone_label,
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
