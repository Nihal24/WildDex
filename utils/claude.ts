import Anthropic from '@anthropic-ai/sdk';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const apiKey = Constants.expoConfig?.extra?.anthropicApiKey;

const client = new Anthropic({
  apiKey,
  dangerouslyAllowBrowser: true,
});

export interface ClosestPokemon {
  name: string;       // lowercase, e.g. "blaziken"
  reason: string;     // short reason
  spriteUrl?: string; // fetched from PokéAPI
}

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania' | 'Antarctica';

export interface AnimalInfo {
  commonName: string;
  scientificName: string;
  habitat: string;
  diet: string;
  funFact: string;
  conservationStatus: string;
  summary: string;
  continents: Continent[];
  closestPokemon: ClosestPokemon[];
}


async function executeGetAnimalInfo(animalName: string): Promise<string> {
  const query = encodeURIComponent(animalName);
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`,
    { headers: { 'User-Agent': 'WildDex/1.0 (wildlife identification app)' } }
  );
  if (!res.ok) return `No Wikipedia article found for "${animalName}".`;
  const data = await res.json() as any;
  return [
    `Title: ${data.title}`,
    `Description: ${data.description || 'N/A'}`,
    `Summary: ${data.extract}`,
  ].join('\n\n');
}

// Fetch sprite URL from PokéAPI — returns null if Pokémon not found
async function fetchPokemonSprite(name: string): Promise<string | null> {
  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.sprites?.front_default ?? null;
  } catch {
    return null;
  }
}

function stripMarkdown(text: string): string {
  // Extract the first {...} JSON object from the response, ignoring any surrounding prose
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text.trim();
}

export async function getAnimalProfile(animalName: string): Promise<AnimalInfo> {
  // Check cache first
  const { data: cached } = await supabase
    .from('animal_cache')
    .select('data')
    .eq('label', animalName)
    .single();

  if (cached) {
    console.log(`Cache hit: ${animalName}`);
    return cached.data as AnimalInfo;
  }

  console.log(`Cache miss: ${animalName} — calling Claude`);

  // Fetch Wikipedia context first, then single Claude call (no tool use rounds)
  const wikiContent = await executeGetAnimalInfo(animalName);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a wildlife encyclopedia API. Always respond with ONLY a valid JSON object — no markdown, no explanation, no text before or after the JSON.

For closestPokemon: use only real Pokémon names (PokéAPI slugs). Pick Pokémon directly inspired by the same animal type first (fish→finneon/goldeen/magikarp, frog→froakie/politoed, shark→sharpedo, lion→pyroar). The reason must explain what animal the Pokémon is based on, not describe the real animal's behavior. If a Pokémon is not clearly inspired by the same animal type, pick a different one.`,
    messages: [{
      role: 'user',
      content: `Animal: "${animalName}"
Reference: ${wikiContent}

Respond with ONLY this JSON (use most common species if ambiguous):
{"commonName":"","scientificName":"","habitat":"","diet":"","funFact":"","conservationStatus":"","summary":"","continents":[],"closestPokemon":[{"name":"","reason":""},{"name":"","reason":""},{"name":"","reason":""}]}`,
    }],
  });

  const text = response.content.find((b) => b.type === 'text') as Anthropic.TextBlock | undefined;
  const rawJson = text?.text ?? '';

  if (!rawJson) throw new Error('No response from Claude');

  const info = JSON.parse(stripMarkdown(rawJson)) as AnimalInfo;

  // Fetch sprites — if a Pokémon name is invalid (no sprite), replace with a real one
  const FALLBACK_POKEMON = ['eevee', 'snorlax', 'pikachu'];
  const withSprites = await Promise.all(
    info.closestPokemon.map(async (p, i) => {
      const spriteUrl = await fetchPokemonSprite(p.name);
      if (spriteUrl) return { ...p, spriteUrl };
      // Name was invalid — use fallback
      const fallback = FALLBACK_POKEMON[i] ?? 'eevee';
      return { name: fallback, reason: p.reason, spriteUrl: await fetchPokemonSprite(fallback) ?? undefined };
    })
  );
  info.closestPokemon = withSprites;

  // Save to cache
  await supabase.from('animal_cache').insert({ label: animalName, data: info });

  return info;
}
