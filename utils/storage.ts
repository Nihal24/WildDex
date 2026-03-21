import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

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
  const withPermanentUri = { ...sighting, photoUri: permanentUri };

  // Save locally first (works offline, always succeeds)
  const existing = await getSightings();
  existing.unshift(withPermanentUri);
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(existing));

  // Sync to Supabase in background (fire and forget — local save already done)
  supabase.from('sightings').insert({
    label: sighting.label,
    confidence: sighting.confidence,
    photo_url: permanentUri,
    timestamp: sighting.timestamp,
  }).then(({ error }) => {
    if (error) console.warn('Supabase sighting sync failed:', error.message);
  });
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

// One-time migration: sync all existing local sightings to Supabase
const MIGRATION_KEY = 'wilddex_supabase_migrated_v1';

export async function migrateLocalSightingsToSupabase(): Promise<void> {
  const done = await AsyncStorage.getItem(MIGRATION_KEY);
  if (done) return;

  const sightings = await getSightings();
  if (sightings.length === 0) {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    return;
  }

  const rows = sightings.map((s) => ({
    label: s.label,
    confidence: s.confidence,
    photo_url: s.photoUri,
    timestamp: s.timestamp,
  }));

  const { error } = await supabase.from('sightings').upsert(rows, { onConflict: 'timestamp' });
  if (error) {
    console.warn('Migration failed:', error.message);
    return;
  }

  await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  console.log(`Migrated ${rows.length} sightings to Supabase`);
}
