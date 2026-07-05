import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inline text edits only (caption + tts_text). Image/audio generation is Phase 2.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { frame_id, caption, tts_text } = await req.json();
    if (!frame_id) return new Response(JSON.stringify({ error: 'frame_id required' }), { status: 400, headers: corsHeaders });

    const { data: frame, error: fetchErr } = await supabase
      .from('tutorial_frames')
      .select('*, tutorials(id, status)')
      .eq('id', frame_id)
      .single();

    if (fetchErr || !frame) throw new Error('Frame not found');

    const tutorialStatus = (frame as any).tutorials?.status;
    if (!['preview', 'rejected'].includes(tutorialStatus)) {
      throw new Error('Frame can only be edited when tutorial is in preview or rejected status');
    }

    const updates: Record<string, string | null> = {};
    if (caption !== undefined) updates.caption = caption;
    if (tts_text !== undefined) updates.tts_text = tts_text;

    if (Object.keys(updates).length > 0) {
      await supabase.from('tutorial_frames').update(updates).eq('id', frame_id);
    }

    const { data: updated } = await supabase.from('tutorial_frames').select('*').eq('id', frame_id).single();

    return new Response(
      JSON.stringify({ ok: true, frame: updated }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
