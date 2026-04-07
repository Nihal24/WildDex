import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.36.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getWikipediaSummary(animalName: string): Promise<string> {
  const query = encodeURIComponent(animalName);
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`, {
    headers: { 'User-Agent': 'WildDex/1.0 (wildlife identification app)' },
  });
  if (!res.ok) return `No Wikipedia article found for "${animalName}".`;
  const data = await res.json();
  return [`Title: ${data.title}`, `Description: ${data.description || 'N/A'}`, `Summary: ${data.extract}`].join('\n\n');
}

async function fetchPokemonSprite(name: string): Promise<string | null> {
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.sprites?.front_default ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { animalName } = await req.json();
    if (!animalName) {
      return new Response(JSON.stringify({ error: 'Missing animalName' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Check cache (skip expired entries)
    const { data: cached } = await supabase
      .from('animal_cache')
      .select('data')
      .eq('label', animalName)
      .gt('expires_at', new Date().toISOString())
      .single();
    if (cached) {
      return new Response(JSON.stringify(cached.data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch Wikipedia and check cache in parallel to save time on cache misses
    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const wikiContent = await getWikipediaSummary(animalName);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `You are a wildlife encyclopedia API. Always respond with ONLY a valid JSON object — no markdown, no explanation, no text before or after the JSON.

For closestPokemon: use only real Pokémon names (PokéAPI slugs). Pick Pokémon directly inspired by the same animal type first (fish→finneon/goldeen/magikarp, frog→froakie/politoed, shark→sharpedo, lion→pyroar). If a Pokémon is not clearly inspired by the same animal type, pick a different one.

For stats: score each 0–100 relative to all animals.
- hp: size + lifespan combined (elephant=95, mouse=10, tortoise=90)
- attack: predatory ability, bite force, claws, venom (lion=88, cow=15, shark=90)
- defense: natural armor, shell, thick skin, size (armadillo=85, tortoise=95, deer=20)
- speed: top movement speed relative to other animals (cheetah=100, tortoise=5, falcon=95)
- special_attack: unique offensive abilities — venom, electric, bioluminescence, echolocation used offensively (electric eel=95, cobra=90, rabbit=5)
- special_defense: environmental adaptability, resilience, immune system (cockroach=95, tardigrade=100, panda=30)`,
      messages: [{
        role: 'user',
        content: `Animal: "${animalName}"
Reference: ${wikiContent}

Respond with ONLY this JSON (use most common species if ambiguous):
{"commonName":"","scientificName":"","habitat":"","diet":"","funFact":"","conservationStatus":"","summary":"","continents":[],"closestPokemon":[{"name":""},{"name":""},{"name":""}],"taxonomy":{"kingdom":"","phylum":"","class":"","order":"","family":"","genus":"","species":""},"stats":{"hp":0,"attack":0,"defense":0,"speed":0,"special_attack":0,"special_defense":0}}`,
      }],
    });

    const text = response.content.find((b: any) => b.type === 'text')?.text ?? '';
    if (!text) throw new Error('No response from Claude');

    const match = text.match(/\{[\s\S]*\}/);
    const info = JSON.parse(match ? match[0] : text.trim());

    // Fetch sprites with fallback
    const FALLBACK_POKEMON = ['eevee', 'snorlax', 'pikachu'];
    info.closestPokemon = await Promise.all(
      info.closestPokemon.map(async (p: any, i: number) => {
        const spriteUrl = await fetchPokemonSprite(p.name);
        if (spriteUrl) return { ...p, spriteUrl };
        const fallback = FALLBACK_POKEMON[i] ?? 'eevee';
        return { name: fallback, spriteUrl: await fetchPokemonSprite(fallback) ?? undefined };
      }),
    );

    // Cache result with 90-day TTL
    await supabase.from('animal_cache').upsert(
      { label: animalName, data: info, expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() },
      { onConflict: 'label' },
    );

    return new Response(JSON.stringify(info), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
