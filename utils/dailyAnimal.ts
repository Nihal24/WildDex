import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyAnimal {
  label: string;
  emoji: string;
  photo_url: string;
}

const CACHE_KEY = 'wilddex_daily_animals_cache';

// Fallback list (subset) in case network is unavailable on first launch
const FALLBACK_ANIMALS: DailyAnimal[] = [
  { label: 'bald_eagle',        emoji: '🦅', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Bald_Eagle_Portrait.jpg/600px-Bald_Eagle_Portrait.jpg' },
  { label: 'red_fox',           emoji: '🦊', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Red_Fox_%28Vulpes_vulpes%29.jpg/600px-Red_Fox_%28Vulpes_vulpes%29.jpg' },
  { label: 'black_bear',        emoji: '🐻', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/01_Schwarzbaer.jpg/600px-01_Schwarzbaer.jpg' },
  { label: 'monarch_butterfly', emoji: '🦋', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Monarch_Butterfly_Danaus_plexippus_Male_2664px.jpg/600px-Monarch_Butterfly_Danaus_plexippus_Male_2664px.jpg' },
  { label: 'great_blue_heron',  emoji: '🪶', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Great_Blue_Heron-27527-2.jpg/600px-Great_Blue_Heron-27527-2.jpg' },
];

let _animals: DailyAnimal[] | null = null;

export async function loadDailyAnimals(): Promise<DailyAnimal[]> {
  if (_animals) return _animals;

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('daily_animals')
      .select('label, emoji, photo_url')
      .order('id');

    if (!error && data && data.length > 0) {
      _animals = data as DailyAnimal[];
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_animals));
      return _animals;
    }
  } catch {}

  // Try local cache
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      _animals = JSON.parse(cached) as DailyAnimal[];
      return _animals;
    }
  } catch {}

  // Last resort: fallback
  _animals = FALLBACK_ANIMALS;
  return _animals;
}

export function getDailyAnimalFromList(animals: DailyAnimal[], offsetDays = 0): DailyAnimal {
  const daysSinceEpoch = Math.floor(Date.now() / 86400000) + offsetDays;
  return animals[daysSinceEpoch % animals.length];
}

export const AOTD_SEEN_KEY = 'wilddex_aotd_date';
