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

export async function getAnimalProfile(animalName: string): Promise<AnimalInfo> {
  const { data, error } = await supabase.functions.invoke('get-animal-profile', {
    body: { animalName },
  });

  if (error) throw new Error(error.message);
  return data as AnimalInfo;
}
