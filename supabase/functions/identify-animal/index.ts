import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'missing config' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeData = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
            { type: 'text', text: 'Is the PRIMARY subject of this photo a wild or domesticated non-human animal? If yes, reply with ONLY its most specific common name in lowercase — use breed/subspecies when clearly identifiable (e.g. "siberian husky" not "dog", "american robin" not "bird", "bengal tiger" not "tiger", "golden retriever" not "dog"). If the specific breed/subspecies is not clearly identifiable, use the species name (e.g. "dog", "bird"). If the primary subject is food, a person, a plant, an object, scenery, or anything other than a non-human animal, reply exactly: none. Also reply none if an animal is only in the background and not the clear main focus.' },
          ],
        }],
      }),
    }).then(r => r.ok ? r.json() : null).catch(() => null);

    const claudeName = claudeData?.content?.[0]?.text?.trim().toLowerCase().replace(/\.$/, '');
    if (claudeName && claudeName !== 'none') {
      return new Response(
        JSON.stringify({ label: claudeName.replace(/[\s-]+/g, '_'), confidence: 0.9, source: 'claude' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ error: 'not_animal' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
