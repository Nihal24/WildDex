import Anthropic from '@anthropic-ai/sdk';
import Constants from 'expo-constants';

const apiKey = Constants.expoConfig?.extra?.anthropicApiKey;
console.log('Anthropic API key loaded:', apiKey ? `${apiKey.slice(0, 15)}...` : 'MISSING');

const client = new Anthropic({
  apiKey,
  dangerouslyAllowBrowser: true,
});

export interface AnimalInfo {
  commonName: string;
  scientificName: string;
  habitat: string;
  diet: string;
  funFact: string;
  conservationStatus: string;
  summary: string;
}

// Tool definition — Claude will call this when it needs animal info
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

// Execute the tool when Claude calls it
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

export async function getAnimalProfile(animalName: string): Promise<AnimalInfo> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Use the get_animal_info tool to look up "${animalName}", then return a JSON object with these exact fields:
- commonName (string)
- scientificName (string)
- habitat (string, 1 sentence)
- diet (string, 1 sentence)
- funFact (string, 1 interesting fact)
- conservationStatus (string, e.g. "Least Concern")
- summary (string, 2-3 sentences overview)

Return ONLY the JSON object, no markdown or extra text.`,
    },
  ];

  // Round 1: Claude decides to call the tool
  const response1 = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools,
    messages,
  });

  // Handle tool call
  if (response1.stop_reason === 'tool_use') {
    const toolUse = response1.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock;
    const input = toolUse.input as { animal_name: string };
    const toolResult = await executeGetAnimalInfo(input.animal_name);

    // Round 2: Send tool result back, Claude summarizes into JSON
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
    return JSON.parse(text.text) as AnimalInfo;
  }

  // Fallback if Claude didn't call the tool
  const text = response1.content.find((b) => b.type === 'text') as Anthropic.TextBlock;
  return JSON.parse(text.text) as AnimalInfo;
}
