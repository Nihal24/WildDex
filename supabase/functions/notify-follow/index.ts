import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { follower_id, following_id } = await req.json();
    if (!follower_id || !following_id) {
      return new Response(JSON.stringify({ error: 'Missing IDs' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get follower's username and followed user's push token
    const [followerRes, followedRes] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', follower_id).single(),
      supabase.from('profiles').select('push_token').eq('id', following_id).single(),
    ]);

    const pushToken = followedRes.data?.push_token;
    if (!pushToken) return new Response(JSON.stringify({ ok: true, skipped: 'no token' }), { headers: corsHeaders });

    const followerName = followerRes.data?.username ? `@${followerRes.data.username}` : 'Someone';

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: 'New Follower',
        body: `${followerName} started following you on WildDex!`,
        sound: 'default',
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
