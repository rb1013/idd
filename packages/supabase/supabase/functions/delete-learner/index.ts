import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // Verify caller is an authenticated guardian
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { learner_id } = await req.json();
    if (!learner_id) {
      return new Response(JSON.stringify({ error: 'learner_id required' }), { status: 400, headers: corsHeaders });
    }

    // Verify this learner belongs to the calling guardian
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('id, auth_user_id, guardian_id')
      .eq('id', learner_id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Learner not found' }), { status: 404, headers: corsHeaders });
    }

    if (profile.guardian_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // Delete auth user first (SET NULL FK means profile row stays, then we delete it)
    if (profile.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(profile.auth_user_id);
    }

    // Delete profile row — ON DELETE CASCADE handles all child rows
    const { error: deleteErr } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', learner_id);

    if (deleteErr) throw new Error(deleteErr.message);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
