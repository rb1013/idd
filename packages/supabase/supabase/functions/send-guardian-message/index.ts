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
    const { conversation_id, content } = await req.json();

    if (!conversation_id || !content?.trim()) {
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

    // Verify caller is authenticated — a guardian's auth.uid() IS the sender_id
    // directly, no user_profiles ownership lookup needed (unlike learner chat).
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

    const senderId = callerUser.id;

    // Verify sender is a participant in the conversation
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('guardian_conversation_participants')
      .select('guardian_id')
      .eq('conversation_id', conversation_id)
      .eq('guardian_id', senderId)
      .maybeSingle();

    if (participantError) {
      return new Response(JSON.stringify({ error: 'Participant check failed', detail: participantError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!participant) {
      return new Response(JSON.stringify({ error: 'Not a participant', detail: `conversation_id=${conversation_id} sender_id=${senderId}` }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Layer 2: check custom blocked_words table (same list used by learner chat)
    const { data: blockedWords } = await supabaseAdmin
      .from('blocked_words')
      .select('word');

    if (blockedWords && blockedWords.length > 0) {
      const lowerContent = content.toLowerCase();
      const isBlocked = blockedWords.some(({ word }: { word: string }) =>
        lowerContent.includes(word.toLowerCase())
      );
      if (isBlocked) {
        return new Response(JSON.stringify({ error: 'blocked' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Insert message
    const { data: message, error: insertError } = await supabaseAdmin
      .from('guardian_messages')
      .insert({ conversation_id, sender_id: senderId, content: content.trim() })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
