export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RarityInfo {
  tier: RarityTier;
  label: string;
  color: string;
  emoji: string;
  observationCount: number;
}

// iNaturalist undercounts domestic/farm animals since people rarely upload them.
// These overrides reflect real-world abundance instead.
const COMMON_OVERRIDES = new Set([
  'chicken', 'dog', 'cat', 'cow', 'pig', 'sheep', 'goat', 'horse',
  'pigeon', 'pidgeon', 'canada goose', 'mallard duck', 'house sparrow', 'rabbit',
  'goldfish', 'hamster', 'crow', 'squirrel', 'raccoon', 'red fox',
  'white-tailed deer',
]);

function getTierFromCount(count: number): Omit<RarityInfo, 'observationCount'> {
  if (count >= 200000) return { tier: 'common',    label: 'Common',    color: '#4CAF50', emoji: '🟢' };
  if (count >= 20000)  return { tier: 'uncommon',  label: 'Uncommon',  color: '#2196F3', emoji: '🔵' };
  if (count >= 2000)   return { tier: 'rare',      label: 'Rare',      color: '#9C27B0', emoji: '🟣' };
  return                      { tier: 'legendary', label: 'Legendary', color: '#FFD700', emoji: '⭐' };
}

export async function fetchRarity(animalName: string): Promise<RarityInfo> {
  // Override for domestic/very common animals iNaturalist undercounts
  if (COMMON_OVERRIDES.has(animalName.toLowerCase())) {
    return { tier: 'common', label: 'Common', color: '#4CAF50', emoji: '🟢', observationCount: -1 };
  }

  try {
    const query = encodeURIComponent(animalName);
    const res = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${query}&rank=species&per_page=1`,
      { headers: { 'User-Agent': 'WildDex/1.0' } }
    );
    const data = await res.json() as any;
    const taxon = data.results?.[0];
    const count = taxon?.observations_count ?? 0;
    return { ...getTierFromCount(count), observationCount: count };
  } catch {
    return { tier: 'common', label: 'Common', color: '#4CAF50', emoji: '🟢', observationCount: 0 };
  }
}
