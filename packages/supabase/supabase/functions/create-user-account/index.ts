import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, profile_id } = await req.json();
    console.log('Received:', { email, profile_id, hasPassword: !!password });

    if (!email || !password || !profile_id) {
      return new Response(JSON.stringify({ error: 'email, password, and profile_id are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    console.log('Service key present:', !!serviceRoleKey, 'URL present:', !!supabaseUrl);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });

    // Verify the caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
    console.log('Caller user:', callerUser?.id, 'Error:', userError?.message);

    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is a guardian
    const { data: guardian, error: guardianError } = await supabaseAdmin
      .from('guardians').select('id').eq('id', callerUser.id).single();
    console.log('Guardian lookup:', guardian?.id, 'Error:', guardianError?.message);

    if (!guardian) {
      return new Response(JSON.stringify({ error: 'Caller is not a guardian' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the profile exists and belongs to this guardian
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles').select('id, guardian_id, auth_user_id').eq('id', profile_id).single();
    console.log('Profile lookup:', profile?.id, 'guardian_id:', profile?.guardian_id, 'Error:', profileError?.message);

    if (!profile || profile.guardian_id !== callerUser.id) {
      return new Response(JSON.stringify({ error: 'Profile not found or access denied' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile.auth_user_id) {
      return new Response(JSON.stringify({ error: 'This profile already has a login account' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the auth user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
    });
    console.log('Create user:', newUser?.user?.id, 'Error:', createError?.message);

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link auth user to profile
    const { error: updateError } = await supabaseAdmin.from('user_profiles').update({
      auth_user_id: newUser.user.id,
      email: email.toLowerCase().trim(),
    }).eq('id', profile_id);
    console.log('Profile update error:', updateError?.message);

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.log('Caught error:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
