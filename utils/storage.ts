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
  location?: string;
  latitude?: number;
  longitude?: number;
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
      location: sighting.location,
      latitude: sighting.latitude,
      longitude: sighting.longitude,
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
      .select('label, confidence, photo_url, timestamp, location, latitude, longitude')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (!error && data) {
      const sightings = data.map((row: any) => ({
        label: row.label,
        confidence: row.confidence,
        photoUri: row.photo_url,
        timestamp: row.timestamp,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
      }));
      // Keep local cache in sync
      await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(sightings));
      return sightings;
    }
  }
  // Offline fallback
  return getLocalSightings();
}

export async function updateSightingLocation(
  photoUri: string,
  location: string,
  latitude?: number,
  longitude?: number,
): Promise<void> {
  const userId = await getCurrentUserId();
  if (userId) {
    const update: any = { location };
    if (latitude !== undefined) update.latitude = latitude;
    if (longitude !== undefined) update.longitude = longitude;
    const { error } = await supabase
      .from('sightings')
      .update(update)
      .eq('user_id', userId)
      .eq('photo_url', photoUri);
    if (error) throw new Error(error.message);
  }
  const local = await getLocalSightings();
  const updated = local.map((s) =>
    s.photoUri === photoUri ? { ...s, location, latitude, longitude } : s
  );
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(updated));
}

export async function deleteSighting(timestamp: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (userId) {
    await supabase.from('sightings').delete().eq('user_id', userId).eq('timestamp', timestamp);
  }
  const local = await getLocalSightings();
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(local.filter((s) => s.timestamp !== timestamp)));
}

export async function purgeBrokenPhotoSightings(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const sightings = await getSightings();
  const brokenUris: string[] = [];

  for (const s of sightings) {
    if (!s.photoUri || s.photoUri.startsWith('http')) continue;
    try {
      const uri = s.photoUri.startsWith('file://') ? s.photoUri : `file://${s.photoUri}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) brokenUris.push(s.photoUri);
    } catch {
      brokenUris.push(s.photoUri);
    }
  }

  if (brokenUris.length === 0) return 0;

  // Delete from Supabase by photo_url (more reliable than timestamp type matching)
  const { error } = await supabase
    .from('sightings')
    .delete()
    .eq('user_id', userId)
    .in('photo_url', brokenUris);

  if (error) throw new Error(error.message);

  // Wipe local cache entirely so next getSightings() pulls fresh from Supabase
  await AsyncStorage.removeItem(SIGHTINGS_KEY);

  return brokenUris.length;
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
