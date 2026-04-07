import { supabase } from './supabase';

export interface ClosestPokemon {
  name: string;
  spriteUrl?: string;
}

export type Continent = 'Africa' | 'Asia' | 'Europe' | 'North America' | 'South America' | 'Oceania' | 'Antarctica';

export interface Taxonomy {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
}

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
  taxonomy: Taxonomy;
}

// In-memory prefetch cache — keyed by label, stores the in-flight or resolved promise
const _profileCache = new Map<string, Promise<AnimalInfo>>();

export async function getAnimalProfile(animalName: string): Promise<AnimalInfo> {
  const cached = _profileCache.get(animalName);
  if (cached) return cached;

  const promise = supabase.functions
    .invoke('get-animal-profile', { body: { animalName } })
    .then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data as AnimalInfo;
    });

  _profileCache.set(animalName, promise);
  // Remove from cache if it fails so next call retries
  promise.catch(() => _profileCache.delete(animalName));
  return promise;
}

// Call this as soon as a label is identified — warms the cache before the user opens the modal
export function prefetchAnimalProfile(animalName: string): void {
  if (!_profileCache.has(animalName)) getAnimalProfile(animalName).catch(() => {});
}
