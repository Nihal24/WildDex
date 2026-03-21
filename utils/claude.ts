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

export interface AnimalInfo {
  commonName: string;
  scientificName: string;
  habitat: string;
  diet: string;
  funFact: string;
  conservationStatus: string;
  summary: string;
  closestPokemon: ClosestPokemon[];
}

// Tool definition
const tools: Anthropic.Tool[] = [
  {
    name: 'get_animal_info',
    description: 'Fetches factual information about an animal from Wikipedia',
    input_schema: {
      type: 'object' as const,
      properties: {
        animal_name: {
          type: 'string',
          description: 'The common name of the animal to look up',
        },
      },
      required: ['animal_name'],
    },
  },
];

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
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
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
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Use the get_animal_info tool to look up "${animalName}", then return a JSON object with these exact fields:
- commonName (string)
- scientificName (string)
- habitat (string, 1 sentence)
- diet (string, 1 sentence)
- funFact (string, 1 surprising, specific, little-known fact — NOT about appearance, habitat, or diet; ideally about behavior, physiology, or a record-breaking trait)
- conservationStatus (string, e.g. "Least Concern")
- summary (string, 2-3 sentences overview)
- closestPokemon (array of exactly 3 objects, each with "name" (lowercase Pokémon name, valid PokéAPI slug) and "reason" (max 6 words why it matches)). Choose Pokémon that are clearly based on or visually similar to this real animal. Prefer Pokémon that were directly inspired by it (e.g. Torchic/Blaziken for chicken, Pidgey for pigeon). Use well-known Pokémon where possible.

Return ONLY the JSON object, no markdown or extra text.`,
    },
  ];

  // Round 1
  const response1 = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools,
    messages,
  });

  let rawJson = '';

  if (response1.stop_reason === 'tool_use') {
    const toolUse = response1.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock;
    const input = toolUse.input as { animal_name: string };
    const toolResult = await executeGetAnimalInfo(input.animal_name);

    // Round 2
    const response2 = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools,
      messages: [
        ...messages,
        { role: 'assistant', content: response1.content },
        {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }],
        },
      ],
    });

    const text = response2.content.find((b) => b.type === 'text') as Anthropic.TextBlock;
    rawJson = text.text;
  } else {
    const text = response1.content.find((b) => b.type === 'text') as Anthropic.TextBlock;
    rawJson = text.text;
  }

  const info = JSON.parse(stripMarkdown(rawJson)) as AnimalInfo;

  // Fetch sprites for each Pokémon in parallel
  const withSprites = await Promise.all(
    info.closestPokemon.map(async (p) => ({
      ...p,
      spriteUrl: await fetchPokemonSprite(p.name) ?? undefined,
    }))
  );
  info.closestPokemon = withSprites;

  // Save to cache
  await supabase.from('animal_cache').insert({ label: animalName, data: info });

  return info;
}
