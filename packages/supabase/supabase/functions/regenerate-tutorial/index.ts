import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regenerating a tutorial re-runs the exact same pipeline as creating one (Claude script +
// DALL·E images + TTS audio) at the same real cost, so it must check and charge the guardian's
// monthly quota the same way create-tutorial does — this was previously done as direct client-side
// table writes with no quota check at all.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tutorial_id } = await req.json();
    if (!tutorial_id) {
      return new Response(JSON.stringify({ error: 'tutorial_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: tutorial, error: fetchErr } = await supabase
      .from('tutorials')
      .select('id, status, admin_notes, created_by_guardian_id')
      .eq('id', tutorial_id)
      .single();

    if (fetchErr || !tutorial) {
      return new Response(JSON.stringify({ error: 'Tutorial not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (tutorial.created_by_guardian_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['preview', 'rejected'].includes(tutorial.status)) {
      return new Response(JSON.stringify({ error: 'This tutorial cannot be regenerated in its current state.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Technical-failure rejections were already refunded automatically — the mobile UI hides the
    // regenerate button for these, but guard it here too rather than trusting the client alone.
    const isTechnicalError = tutorial.status === 'rejected'
      && typeof tutorial.admin_notes === 'string'
      && tutorial.admin_notes.startsWith('Generation failed:');
    if (isTechnicalError) {
      return new Response(
        JSON.stringify({ error: 'This tutorial failed due to a technical issue. Please contact support instead of regenerating.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check + charge monthly quota — same pattern as create-tutorial
    const guardian_id = user.id;
    const month = new Date().toISOString().slice(0, 7);
    const [{ data: quota }, { data: appSettings }] = await Promise.all([
      supabase.from('guardian_tutorial_quota').select('count').eq('guardian_id', guardian_id).eq('month', month).single(),
      supabase.from('app_settings').select('tutorial_quota_limit').eq('id', 1).single(),
    ]);
    const quotaLimit = appSettings?.tutorial_quota_limit ?? 10;
    const currentCount = quota?.count ?? 0;

    if (currentCount >= quotaLimit) {
      return new Response(
        JSON.stringify({ error: `Monthly quota of ${quotaLimit} tutorials reached. Try again next month.` }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase
      .from('guardian_tutorial_quota')
      .upsert(
        { guardian_id, month, count: currentCount + 1 },
        { onConflict: 'guardian_id,month' },
      );

    // Reset the tutorial and queue a fresh generation job (DB Webhook fires process-tutorial-job)
    await supabase.from('tutorial_frames').delete().eq('tutorial_id', tutorial_id);
    await supabase.from('tutorials').update({ status: 'generating', updated_at: new Date().toISOString() }).eq('id', tutorial_id);
    const { error: jobError } = await supabase.from('tutorial_jobs').insert({ tutorial_id });
    if (jobError) throw new Error(`Failed to queue job: ${jobError.message}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
