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

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

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

  // Save locally first (offline fallback)
  const existing = await getLocalSightings();
  existing.unshift(withPermanentUri);
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(existing));

  // Sync to Supabase with user_id
  const userId = await getCurrentUserId();
  if (userId) {
    supabase.from('sightings').insert({
      user_id: userId,
      label: sighting.label,
      confidence: sighting.confidence,
      photo_url: permanentUri,
      timestamp: sighting.timestamp,
    }).then(({ error }) => {
      if (error) console.warn('Supabase sighting sync failed:', error.message);
    });
  }
}

async function getLocalSightings(): Promise<Sighting[]> {
  const raw = await AsyncStorage.getItem(SIGHTINGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Reads from Supabase (source of truth), falls back to local AsyncStorage
export async function getSightings(): Promise<Sighting[]> {
  const userId = await getCurrentUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('sightings')
      .select('label, confidence, photo_url, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (!error && data) {
      const sightings = data.map((row: any) => ({
        label: row.label,
        confidence: row.confidence,
        photoUri: row.photo_url,
        timestamp: row.timestamp,
      }));
      // Keep local cache in sync
      await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(sightings));
      return sightings;
    }
  }
  // Offline fallback
  return getLocalSightings();
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

// One-time migration: sync existing local sightings to Supabase with user_id
const MIGRATION_KEY = 'wilddex_supabase_migrated_v2';

export async function migrateLocalSightingsToSupabase(): Promise<void> {
  const done = await AsyncStorage.getItem(MIGRATION_KEY);
  if (done) return;

  const userId = await getCurrentUserId();
  if (!userId) return;

  const sightings = await getLocalSightings();
  if (sightings.length === 0) {
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    return;
  }

  const rows = sightings.map((s) => ({
    user_id: userId,
    label: s.label,
    confidence: s.confidence,
    photo_url: s.photoUri,
    timestamp: s.timestamp,
  }));

  const { error } = await supabase.from('sightings').upsert(rows, { onConflict: 'user_id,timestamp' });
  if (error) {
    console.warn('Migration failed:', error.message);
    return;
  }

  await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  console.log(`Migrated ${rows.length} sightings to Supabase for user ${userId}`);
}
