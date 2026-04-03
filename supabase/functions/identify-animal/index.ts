import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const INAT_API_URL = 'https://api.inaturalist.org/v1/computervision/score_image';
const ANIMAL_ICONIC_TAXA = new Set([
  'Animalia','Aves','Mammalia','Reptilia','Amphibia',
  'Actinopterygii','Arachnida','Insecta','Mollusca',
  'Annelida','Echinodermata','Cnidaria','Cephalopoda',
]);
const INAT_MIN_SCORE = 15;

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

    // Convert image to base64 once — used by Claude
    const arrayBuffer = await imageFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = (imageFile.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    // ── 1. Claude Haiku (primary) ───────────────────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      try {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 50,
            messages: [{
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
                { type: 'text', text: 'What animal is in this photo? Reply with ONLY the common name in lowercase (e.g. "clownfish", "bengal tiger", "lion"). If there is no animal, reply exactly: none' },
              ],
            }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const name = claudeData.content?.[0]?.text?.trim().toLowerCase().replace(/\.$/, '');
          if (name && name !== 'none') {
            return new Response(
              JSON.stringify({ label: name.replace(/[\s-]+/g, '_'), confidence: 0.9, source: 'claude' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
          if (name === 'none') {
            return new Response(JSON.stringify({ error: 'not_animal' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {
        console.error('Claude error:', e);
      }
    }

    // ── 2. iNaturalist fallback ─────────────────────────────────────────────
    const inatToken = Deno.env.get('INAT_API_TOKEN');
    try {
      const inatForm = new FormData();
      inatForm.append('image', imageFile);
      const inatRes = await fetch(INAT_API_URL, {
        method: 'POST',
        headers: inatToken ? { Authorization: `Bearer ${inatToken}` } : {},
        body: inatForm,
      });

      if (inatRes.ok) {
        const data = await inatRes.json();
        const hit = (data.results ?? []).find((r: any) => {
          const iconic = r.taxon?.iconic_taxon_name;
          return !iconic || ANIMAL_ICONIC_TAXA.has(iconic);
        });
        const score = hit?.vision_score ?? hit?.combined_score ?? 0;
        if (hit && score >= INAT_MIN_SCORE) {
          const name = hit.taxon?.preferred_common_name || hit.taxon?.name;
          if (name) {
            return new Response(
              JSON.stringify({ label: name.toLowerCase().replace(/[\s-]+/g, '_'), confidence: Math.min(score / 100, 1), source: 'inat' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }
      }
    } catch (e) {
      console.error('iNat error:', e);
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
