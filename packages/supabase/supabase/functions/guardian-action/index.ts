import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ActionType = 'block_user' | 'delete_chat' | 'report_user' | 'block_delete' | 'block_delete_report';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      action_type,
      learner_id,
      conversation_id,
      reason,
      delete_scope,   // 'all' | number
    }: {
      action_type: ActionType;
      learner_id: string;
      conversation_id?: string;
      reason?: string;
      delete_scope?: 'all' | number;
    } = await req.json();

    if (!action_type || !learner_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });

    // Verify caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser } } = await supabaseAdmin.auth.getUser(token);
    if (!callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify learner_id matches caller
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, guardian_id')
      .eq('id', learner_id)
      .eq('auth_user_id', callerUser.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const guardianId = profile.guardian_id;

    // Derive other_learner_id from conversation_participants
    let other_learner_id: string | null = null;
    if (conversation_id) {
      const { data: otherParticipant } = await supabaseAdmin
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversation_id)
        .neq('user_id', learner_id)
        .single();
      other_learner_id = otherParticipant?.user_id ?? null;
    }

    if (!other_learner_id) {
      return new Response(JSON.stringify({ error: 'Could not determine other participant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Action handlers ───────────────────────────────────────────────────────

    const needsDelete = ['delete_chat', 'block_delete', 'block_delete_report'].includes(action_type);
    const needsBlock  = ['block_user', 'block_delete', 'block_delete_report'].includes(action_type);
    const needsReport = ['report_user', 'block_delete_report'].includes(action_type);
    const needsSnapshot = action_type === 'block_delete_report';

    console.log('guardian-action', { action_type, learner_id, other_learner_id, guardianId, conversation_id });

    // Step 1: take snapshot (block_delete_report only)
    let messageSnapshot = null;
    if (needsSnapshot && conversation_id) {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('report_snapshot_limit')
        .eq('id', 1)
        .single();
      const snapshotLimit = settings?.report_snapshot_limit ?? 20;

      const { data: msgs } = await supabaseAdmin
        .from('messages')
        .select('sender_id, content, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(snapshotLimit);

      messageSnapshot = (msgs ?? []).reverse();
    }

    // Step 2: create report (report_user or block_delete_report)
    if (needsReport) {
      const { error: reportErr } = await supabaseAdmin.from('reports').insert({
        conversation_id: conversation_id ?? null,
        learner_id,
        reported_learner_id: other_learner_id,
        reported_by_guardian_id: guardianId,
        reason: reason ?? null,
        message_snapshot: messageSnapshot,
      });
      if (reportErr) { console.error('report insert error', reportErr); throw new Error(reportErr.message); }
    }

    // Step 3: delete messages
    if (needsDelete && conversation_id) {
      if (delete_scope === 'all' || delete_scope === undefined) {
        const { error: delErr } = await supabaseAdmin.from('messages').delete().eq('conversation_id', conversation_id);
        if (delErr) { console.error('delete messages error', delErr); throw new Error(delErr.message); }
      } else {
        const { data: toDelete } = await supabaseAdmin
          .from('messages')
          .select('id')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: false })
          .limit(Number(delete_scope));
        if (toDelete && toDelete.length > 0) {
          const ids = toDelete.map((m: any) => m.id);
          const { error: delErr } = await supabaseAdmin.from('messages').delete().in('id', ids);
          if (delErr) { console.error('delete messages error', delErr); throw new Error(delErr.message); }
        }
      }
    }

    // Step 4: block user
    if (needsBlock) {
      const { error: blockErr } = await supabaseAdmin.from('blocked_learners').upsert({
        learner_id,
        blocked_learner_id: other_learner_id,
        blocked_by_guardian_id: guardianId,
        reason: reason ?? null,
      }, { onConflict: 'learner_id,blocked_learner_id' });
      if (blockErr) { console.error('block insert error', blockErr); throw new Error(blockErr.message); }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
