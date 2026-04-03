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
  caption?: string;
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

async function uploadPhotoToStorage(localUri: string, userId: string): Promise<string | null> {
  try {
    const filename = `${userId}/${Date.now()}.jpg`;
    const formData = new FormData();
    formData.append('file', { uri: localUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    const { error } = await supabase.storage
      .from('sighting-photos')
      .upload(filename, formData, { contentType: 'image/jpeg', upsert: false });
    if (error) { console.warn('Photo upload failed:', error.message); return null; }
    const { data } = supabase.storage.from('sighting-photos').getPublicUrl(filename);
    return data.publicUrl;
  } catch (e) {
    console.warn('Photo upload error:', e);
    return null;
  }
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
    // Upload photo to Storage for public feed
    const publicUrl = await uploadPhotoToStorage(permanentUri, userId);

    // If we got a public URL, update the local cache entry so it shows immediately
    if (publicUrl) {
      const cached = await getLocalSightings();
      const updated = cached.map((s) =>
        s.photoUri === permanentUri ? { ...s, photoUri: publicUrl } : s
      );
      await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(updated));
    }

    const { error } = await supabase.from('sightings').insert({
      user_id: userId,
      label: sighting.label,
      confidence: sighting.confidence,
      photo_url: publicUrl ?? permanentUri,
      timestamp: sighting.timestamp,
      location: sighting.location,
      latitude: sighting.latitude,
      longitude: sighting.longitude,
      caption: sighting.caption ?? null,
    });
    if (error) console.warn('Supabase sighting sync failed:', error.message);
  }
}

export async function getLocalSightings(): Promise<Sighting[]> {
  const raw = await AsyncStorage.getItem(SIGHTINGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Reads from Supabase (source of truth), falls back to local AsyncStorage
export async function getSightings(): Promise<Sighting[]> {
  const userId = await getCurrentUserId();
  if (userId) {
    const { data, error } = await supabase
      .from('sightings')
      .select('label, confidence, photo_url, timestamp, location, latitude, longitude, caption')
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
        caption: row.caption ?? undefined,
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

export async function deleteSighting(photoUri: string, timestamp?: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (userId) {
    // Prefer matching by timestamp (stable across reinstalls) with photo_url as fallback
    let deleteResult;
    if (timestamp !== undefined) {
      deleteResult = await supabase
        .from('sightings')
        .delete()
        .eq('user_id', userId)
        .eq('timestamp', timestamp);
    } else {
      deleteResult = await supabase
        .from('sightings')
        .delete()
        .eq('user_id', userId)
        .eq('photo_url', photoUri);
    }
    if (deleteResult.error) throw new Error(`Supabase delete failed: ${deleteResult.error.message}`);
  }
  const local = await getLocalSightings();
  await AsyncStorage.setItem(SIGHTINGS_KEY, JSON.stringify(local.filter((s) => s.photoUri !== photoUri)));
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

export interface FeedSighting {
  label: string;
  confidence: number;
  photoUrl: string;
  timestamp: number;
  location?: string;
  userId: string;
  displayName: string;
  caption?: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  speciesCount: number;
  totalSightings: number;
}

export async function getFeedSightings(): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select('label, confidence, photo_url, timestamp, location, user_id, caption, profiles(username)')
    .like('photo_url', 'http%')
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data.map((row: any) => ({
    label: row.label,
    confidence: row.confidence,
    photoUrl: row.photo_url,
    timestamp: row.timestamp,
    location: row.location,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    caption: row.caption ?? undefined,
  }));
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error || !data) return [];
  return data.map((row: any) => ({
    userId: row.user_id,
    displayName: row.username ?? '',
    speciesCount: Number(row.species_count),
    totalSightings: Number(row.total_sightings),
  }));
}

export async function getMyDisplayName(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) return 'Explorer';
  const { data } = await supabase.from('profiles').select('username').eq('id', userId).single();
  return data?.username ?? '';
}

export async function updateUsername(name: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not logged in');
  const { error } = await supabase.from('profiles').upsert({ id: userId, username: name });
  if (error) throw new Error(error.message);
}

export async function updateAvatarUrl(url: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not logged in');
  const { error } = await supabase.from('profiles').upsert({ id: userId, avatar_url: url });
  if (error) throw new Error(error.message);
}

export async function getMyAvatarUrl(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data } = await supabase.from('profiles').select('avatar_url').eq('id', userId).single();
  return data?.avatar_url ?? null;
}

export async function followUser(targetId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('follows').insert({ follower_id: userId, following_id: targetId });
}

export async function unfollowUser(targetId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
}

export async function isFollowing(targetId: string): Promise<boolean> {
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { data } = await supabase.from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('following_id', targetId)
    .single();
  return !!data;
}

export async function getFollowingIds(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  return (data ?? []).map((r: any) => r.following_id);
}

export async function getFollowingFeed(): Promise<FeedSighting[]> {
  const followingIds = await getFollowingIds();
  if (followingIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sightings')
    .select('label, confidence, photo_url, timestamp, location, user_id, caption, profiles(username)')
    .like('photo_url', 'http%')
    .in('user_id', followingIds)
    .order('timestamp', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((row: any) => ({
    label: row.label,
    confidence: row.confidence,
    photoUrl: row.photo_url,
    timestamp: row.timestamp,
    location: row.location,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    caption: row.caption ?? undefined,
  }));
}

export async function getUserProfile(userId: string): Promise<{ displayName: string; speciesCount: number; totalSightings: number }> {
  const [profileRes, sightingsRes] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', userId).single(),
    supabase.from('sightings').select('label').eq('user_id', userId),
  ]);
  const displayName = profileRes.data?.username ?? '';
  const sightings = sightingsRes.data ?? [];
  const speciesCount = new Set(sightings.map((s: any) => s.label)).size;
  return { displayName, speciesCount, totalSightings: sightings.length };
}

export async function getUserFeedSightings(userId: string): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select('label, confidence, photo_url, timestamp, location, user_id, caption, profiles(username)')
    .like('photo_url', 'http%')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map((row: any) => ({
    label: row.label,
    confidence: row.confidence,
    photoUrl: row.photo_url,
    timestamp: row.timestamp,
    location: row.location,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    caption: row.caption ?? undefined,
  }));
}

export async function getMyFeedSightings(): Promise<FeedSighting[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const [profileRes, sightingsRes] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', userId).single(),
    supabase.from('sightings')
      .select('label, confidence, photo_url, timestamp, location, user_id, caption')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50),
  ]);

  const displayName = profileRes.data?.username ?? '';

  if (!sightingsRes.error && sightingsRes.data) {
    return sightingsRes.data.map((row: any) => ({
      label: row.label,
      confidence: row.confidence,
      photoUrl: row.photo_url,
      timestamp: row.timestamp,
      location: row.location,
      userId: row.user_id,
      displayName,
      caption: row.caption ?? undefined,
    }));
  }

  // Offline fallback: use local sightings
  const local = await getLocalSightings();
  return local.map((s) => ({
    label: s.label,
    confidence: s.confidence,
    photoUrl: s.photoUri,
    timestamp: s.timestamp,
    location: s.location,
    userId,
    displayName,
    caption: s.caption,
  }));
}

export async function getCurrentUserId_public(): Promise<string | null> {
  return getCurrentUserId();
}
