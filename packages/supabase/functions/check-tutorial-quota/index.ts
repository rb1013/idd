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
    const { guardian_id } = await req.json();
    if (!guardian_id) return new Response(JSON.stringify({ error: 'guardian_id required' }), { status: 400, headers: corsHeaders });

    const month = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from('guardian_tutorial_quota')
      .select('count')
      .eq('guardian_id', guardian_id)
      .eq('month', month)
      .single();

    return new Response(
      JSON.stringify({ used: data?.count ?? 0, limit: 10, month }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
