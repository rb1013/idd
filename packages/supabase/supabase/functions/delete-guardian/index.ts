import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Verify caller
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is a guardian and is deleting their own account
    const { data: guardian } = await supabaseAdmin
      .from('guardians')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!guardian) {
      return new Response(JSON.stringify({ error: 'Not a guardian' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // A learner can have their own direct-login auth account (user_profiles.auth_user_id,
    // separate from the guardian's). That FK is ON DELETE SET NULL, not cascade — deleting
    // the guardian (and therefore the learner's user_profiles row) would NOT delete this
    // auth.users row on its own, leaving an orphaned but still-functional login. Look it up
    // before we cascade the profile away, same pattern as delete-learner.
    const { data: learners } = await supabaseAdmin
      .from('user_profiles')
      .select('auth_user_id')
      .eq('guardian_id', user.id);

    for (const learner of learners ?? []) {
      if (learner.auth_user_id) {
        await supabaseAdmin.auth.admin.deleteUser(learner.auth_user_id);
      }
    }

    // Delete the guardians row directly first. This cascades to all of the
    // guardian's own data (and, via user_profiles' guardian_id cascade, to
    // their learner's data too), and — unlike auth.admin.deleteUser(), which
    // wraps any failure in a generic "Database error deleting user" message —
    // a plain Postgrest delete surfaces the real constraint-violation detail
    // if something unexpected is still blocking it.
    const { error: guardianDeleteErr } = await supabaseAdmin
      .from('guardians')
      .delete()
      .eq('id', user.id);
    if (guardianDeleteErr) throw new Error(guardianDeleteErr.message);

    // Now remove the guardian's own auth user.
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteErr) throw new Error(deleteErr.message);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
