import AsyncStorage from '@react-native-async-storage/async-storage';

const SIGHTINGS_KEY = 'wilddex_sightings';

export interface Sighting {
  label: string;
  confidence: number;
  photoUri: string;
  timestamp: number;
}

export async function saveSighting(sighting: Sighting): Promise<void> {
  const existing = await getSightings();
  existing.unshift(sighting);
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(existing));
}

export async function getSightings(): Promise<Sighting[]> {
  const raw = await AsyncStorage.getItem(SIGHTINGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getDiscoveredLabels(): Promise<Set<string>> {
  const sightings = await getSightings();
  return new Set(sightings.map((s) => s.label));
}

export async function getLatestPhotoForLabel(label: string): Promise<string | null> {
  const sightings = await getSightings();
  const match = sightings.find((s) => s.label === label);
  return match ? match.photoUri : null;
}
