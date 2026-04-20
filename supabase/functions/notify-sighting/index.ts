import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { actor_id, sighting_id, animal_label } = await req.json();
    if (!actor_id || !sighting_id || !animal_label) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Get actor username
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', actor_id)
      .single();

    const actorName = actorProfile?.username ? `@${actorProfile.username}` : 'Someone';

    // Format animal name: "red_fox" → "Red Fox"
    const animalName = animal_label
      .split('_')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Get all followers of the actor with their push tokens
    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id, profiles!follows_follower_id_fkey(push_token)')
      .eq('following_id', actor_id);

    if (!followers || followers.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: corsHeaders });
    }

    // Insert notification records + send push notifications in parallel
    const notifInserts = followers.map((f: any) => ({
      user_id: f.follower_id,
      actor_id,
      type: 'new_sighting',
      sighting_id,
    }));

    const pushTokens: string[] = followers
      .map((f: any) => f.profiles?.push_token)
      .filter(Boolean);

    await supabase.from('notifications').insert(notifInserts);

    if (pushTokens.length > 0) {
      const messages = pushTokens.map((token: string) => ({
        to: token,
        title: 'New Sighting 🌿',
        body: `${actorName} just spotted a ${animalName}!`,
        sound: 'default',
        data: { type: 'new_sighting', sighting_id, actor_id },
      }));

      // Expo batch push limit is 100
      for (let i = 0; i < messages.length; i += 100) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages.slice(i, i + 100)),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: pushTokens.length }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
