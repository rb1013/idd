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
    const { tutorial_id } = await req.json();
    if (!tutorial_id) {
      return new Response(JSON.stringify({ error: 'tutorial_id required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch tutorial + guardian push token in one query
    const { data: tutorial, error: fetchErr } = await supabase
      .from('tutorials')
      .select('id, title, created_by_guardian_id, guardians(expo_push_token)')
      .eq('id', tutorial_id)
      .single();

    if (fetchErr || !tutorial) throw new Error('Tutorial not found');

    const { error } = await supabase
      .from('tutorials')
      .update({ status: 'approved', admin_notes: null, updated_at: new Date().toISOString() })
      .eq('id', tutorial_id);

    if (error) throw new Error(error.message);

    // Send push notification to guardian
    const pushToken = (tutorial as any).guardians?.expo_push_token;
    if (pushToken) {
      await sendExpoPush(pushToken, {
        title: '✅ Tutorial Approved!',
        body: `"${tutorial.title}" is now live in the shared library.`,
        data: { type: 'tutorial_approved', tutorial_id },
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function sendExpoPush(
  token: string,
  notification: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  // Expo Push Notification API — no SDK needed, just a simple POST
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to:    token,
      sound: 'default',
      title: notification.title,
      body:  notification.body,
      data:  notification.data ?? {},
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Expo push failed:', text);
  }
}
