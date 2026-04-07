import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { actor_id, target_user_id, type, sighting_id } = await req.json();
    if (!actor_id || !target_user_id || !type) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }
    if (actor_id === target_user_id) {
      return new Response(JSON.stringify({ ok: true, skipped: 'self' }), { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Insert notification record
    await supabase.from('notifications').insert({
      user_id: target_user_id,
      actor_id,
      type,
      ...(sighting_id ? { sighting_id } : {}),
    });

    // Get actor username + target push token
    const [actorRes, targetRes] = await Promise.all([
      supabase.from('profiles').select('username').eq('id', actor_id).single(),
      supabase.from('profiles').select('push_token').eq('id', target_user_id).single(),
    ]);

    const pushToken = targetRes.data?.push_token;
    if (!pushToken) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    const actorName = actorRes.data?.username ? `@${actorRes.data.username}` : 'Someone';
    const bodies: Record<string, string> = {
      like: `${actorName} liked your sighting`,
      comment: `${actorName} commented on your sighting`,
      follow: `${actorName} started following you`,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        title: 'WildDex',
        body: bodies[type] ?? `${actorName} interacted with you`,
        sound: 'default',
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
