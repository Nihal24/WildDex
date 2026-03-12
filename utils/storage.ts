import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const SIGHTINGS_KEY = 'wilddex_sightings';
const PHOTOS_DIR = `${FileSystem.documentDirectory}wilddex_photos/`;

export interface Sighting {
  label: string;
  confidence: number;
  photoUri: string;
  timestamp: number;
}

// Copy photo to permanent app storage so it survives rebuilds
async function persistPhoto(uri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  const filename = `${Date.now()}.jpg`;
  const dest = `${PHOTOS_DIR}${filename}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function saveSighting(sighting: Sighting): Promise<void> {
  const permanentUri = await persistPhoto(sighting.photoUri);
  const existing = await getSightings();
  existing.unshift({ ...sighting, photoUri: permanentUri });
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
