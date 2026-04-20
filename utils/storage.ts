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
  visibility?: string;
}

let _cachedUserId: string | null | undefined = undefined;
async function getCurrentUserId(): Promise<string | null> {
  if (_cachedUserId !== undefined) return _cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  _cachedUserId = user?.id ?? null;
  return _cachedUserId;
}
export function clearUserIdCache(): void { _cachedUserId = undefined; }

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

    const { data: inserted, error } = await supabase.from('sightings').insert({
      user_id: userId,
      label: sighting.label.toLowerCase().trim(),
      confidence: sighting.confidence,
      photo_url: publicUrl ?? permanentUri,
      timestamp: sighting.timestamp,
      location: sighting.location,
      latitude: sighting.latitude,
      longitude: sighting.longitude,
      caption: sighting.caption ?? null,
      visibility: sighting.visibility ?? 'public',
    }).select('id').single();
    if (error) {
      console.warn('Supabase sighting sync failed:', error.message);
    } else if (inserted?.id && (sighting.visibility ?? 'public') === 'public') {
      // Fire-and-forget: notify followers of this new sighting
      notifyFollowersOfSighting(userId, inserted.id, sighting.label.toLowerCase().trim());
    }
  }
}

async function notifyFollowersOfSighting(actorId: string, sightingId: string, animalLabel: string): Promise<void> {
  try {
    const { default: Constants } = await import('expo-constants');
    const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
    const supabaseKey = Constants.expoConfig?.extra?.supabasePublishableKey;
    if (!supabaseUrl || !supabaseKey) return;
    fetch(`${supabaseUrl}/functions/v1/notify-sighting`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: actorId, sighting_id: sightingId, animal_label: animalLabel }),
    }).catch(() => {});
  } catch {
    // non-critical
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

export async function updateSightingLabel(
  photoUri: string,
  label: string,
): Promise<void> {
  const normalized = label.toLowerCase().trim().replace(/\s+/g, '_');
  const userId = await getCurrentUserId();
  if (userId) {
    const { error } = await supabase
      .from('sightings')
      .update({ label: normalized })
      .eq('user_id', userId)
      .eq('photo_url', photoUri);
    if (error) throw new Error(error.message);
  }
  const local = await getLocalSightings();
  const updated = local.map((s) =>
    s.photoUri === photoUri ? { ...s, label: normalized } : s
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
}

export interface FeedSighting {
  sightingId: string;
  label: string;
  confidence: number;
  photoUrl: string;
  timestamp: number;
  location?: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  caption?: string;
  visibility: string;
  likeCount: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  text: string;
  createdAt: number;
  parentId?: string;
  replies?: Comment[];
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  speciesCount: number;
  totalSightings: number;
}

export interface MapSighting {
  id: string;
  label: string;
  photoUrl: string;
  latitude: number;
  longitude: number;
  location?: string;
  timestamp: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export async function getCommunityMapSightings(): Promise<MapSighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select('id, label, photo_url, latitude, longitude, location, timestamp, user_id, profiles(username, avatar_url)')
    .eq('visibility', 'public')
    .like('photo_url', 'http%')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(300);

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    label: row.label,
    photoUrl: row.photo_url,
    latitude: row.latitude,
    longitude: row.longitude,
    location: row.location,
    timestamp: row.timestamp,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    avatarUrl: row.profiles?.avatar_url ?? undefined,
  }));
}

export async function getFollowingMapSightings(): Promise<MapSighting[]> {
  const followingIds = await getFollowingIds();
  if (followingIds.length === 0) return [];
  const { data, error } = await supabase
    .from('sightings')
    .select('id, label, photo_url, latitude, longitude, location, timestamp, user_id, profiles(username, avatar_url)')
    .in('user_id', followingIds)
    .in('visibility', ['public', 'followers'])
    .like('photo_url', 'http%')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(300);

  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    label: row.label,
    photoUrl: row.photo_url,
    latitude: row.latitude,
    longitude: row.longitude,
    location: row.location,
    timestamp: row.timestamp,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    avatarUrl: row.profiles?.avatar_url ?? undefined,
  }));
}

const PROFILE_STATS_CACHE_KEY = 'wilddex_profile_stats_cache';

export interface ProfileStatsCache {
  sightingCount: number;
  streak: number;
  followersCount: number;
  followingCount: number;
  username: string;
  avatarUrl: string | null;
}

export async function getProfileStatsCache(): Promise<ProfileStatsCache | null> {
  try {
    const v = await AsyncStorage.getItem(PROFILE_STATS_CACHE_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export async function setProfileStatsCache(stats: ProfileStatsCache): Promise<void> {
  await AsyncStorage.setItem(PROFILE_STATS_CACHE_KEY, JSON.stringify(stats));
}

const FEED_CACHE_KEY = 'wilddex_feed_cache_v2';

export async function getFeedCache(): Promise<FeedSighting[] | null> {
  try {
    const v = await AsyncStorage.getItem(FEED_CACHE_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export async function setFeedCache(feed: FeedSighting[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(feed.slice(0, 30)));
  } catch {}
}

function mapSighting(row: any): FeedSighting {
  return {
    sightingId: row.id,
    label: row.label,
    confidence: row.confidence,
    photoUrl: row.photo_url,
    timestamp: row.timestamp,
    location: row.location,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    avatarUrl: row.profiles?.avatar_url ?? undefined,
    caption: row.caption ?? undefined,
    visibility: row.visibility ?? 'public',
    likeCount: row.likes?.[0]?.count ?? 0,
    commentCount: row.comments?.[0]?.count ?? 0,
  };
}

// Embed like/comment counts directly in the query — no separate enrichment needed
const FEED_SELECT = 'id, label, confidence, photo_url, timestamp, location, user_id, caption, visibility, profiles(username, avatar_url), likes(count), comments(count)';

export const FEED_PAGE_SIZE = 8;

export async function getFeedSightings(offset = 0): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select(FEED_SELECT)
    .like('photo_url', 'http%')
    .eq('visibility', 'public')
    .order('timestamp', { ascending: false })
    .range(offset, offset + FEED_PAGE_SIZE - 1);

  if (error || !data) return [];
  return data.map(mapSighting);
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error || !data) return [];
  return data.map((row: any) => ({
    userId: row.user_id,
    displayName: row.username ?? '',
    avatarUrl: row.avatar_url ?? undefined,
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
  const { error } = await supabase.from('profiles').upsert({ id: userId, username: name }, { onConflict: 'username' });
  if (error) {
    if (error.code === '23505') throw new Error('That username is taken — try another.');
    throw new Error(error.message);
  }
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
  notifyActivity(userId, targetId, 'follow');
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
    .select(FEED_SELECT)
    .like('photo_url', 'http%')
    .in('user_id', followingIds)
    .in('visibility', ['public', 'followers'])
    .order('timestamp', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map(mapSighting);
}

export async function getUserProfile(userId: string): Promise<{ displayName: string; avatarUrl?: string; speciesCount: number; totalSightings: number; followersCount: number; followingCount: number }> {
  const [profileRes, sightingsRes, followersRes, followingRes] = await Promise.all([
    supabase.from('profiles').select('username, avatar_url').eq('id', userId).single(),
    supabase.from('sightings').select('label').eq('user_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  const displayName = profileRes.data?.username ?? '';
  const avatarUrl = profileRes.data?.avatar_url ?? undefined;
  const sightings = sightingsRes.data ?? [];
  const speciesCount = new Set(sightings.map((s: any) => s.label)).size;
  return {
    displayName, avatarUrl, speciesCount, totalSightings: sightings.length,
    followersCount: followersRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
  };
}

export interface FollowUser {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export async function getFollowers(userId: string): Promise<FollowUser[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(username, avatar_url)')
    .eq('following_id', userId);
  return (data ?? []).map((r: any) => ({
    userId: r.follower_id,
    displayName: r.profiles?.username ?? '',
    avatarUrl: r.profiles?.avatar_url ?? undefined,
  }));
}

export async function getFollowing(userId: string): Promise<FollowUser[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id, profiles!follows_following_id_fkey(username, avatar_url)')
    .eq('follower_id', userId);
  return (data ?? []).map((r: any) => ({
    userId: r.following_id,
    displayName: r.profiles?.username ?? '',
    avatarUrl: r.profiles?.avatar_url ?? undefined,
  }));
}

export async function getMyFollowCounts(): Promise<{ followersCount: number; followingCount: number }> {
  const userId = await getCurrentUserId();
  if (!userId) return { followersCount: 0, followingCount: 0 };
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followersCount: followersRes.count ?? 0, followingCount: followingRes.count ?? 0 };
}

export async function getUserFeedSightings(userId: string): Promise<FeedSighting[]> {
  const { data, error } = await supabase
    .from('sightings')
    .select(FEED_SELECT)
    .like('photo_url', 'http%')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map(mapSighting);
}

export async function getMyFeedSightings(): Promise<FeedSighting[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const [profileRes, sightingsRes] = await Promise.all([
    supabase.from('profiles').select('username, avatar_url').eq('id', userId).single(),
    supabase.from('sightings')
      .select(FEED_SELECT)
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(50),
  ]);

  const displayName = profileRes.data?.username ?? '';
  const avatarUrl = profileRes.data?.avatar_url ?? undefined;

  if (!sightingsRes.error && sightingsRes.data) {
    return sightingsRes.data.map(mapSighting);
  }

  // Offline fallback: use local sightings
  const local = await getLocalSightings();
  return local.map((s) => ({
    sightingId: '',
    label: s.label,
    confidence: s.confidence,
    photoUrl: s.photoUri,
    timestamp: s.timestamp,
    location: s.location,
    userId,
    displayName,
    avatarUrl,
    caption: s.caption,
    likeCount: 0,
    commentCount: 0,
  }));
}

export async function getCurrentUserId_public(): Promise<string | null> {
  return getCurrentUserId();
}

export function calculateSightingStreak(sightings: Sighting[]): number {
  if (sightings.length === 0) return 0;
  const dates = new Set(sightings.map(s => new Date(s.timestamp).toLocaleDateString()));
  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
  // Start from today if spotted today, else yesterday (streak still alive)
  const startOffset = dates.has(today) ? 0 : dates.has(yesterday) ? 1 : -1;
  if (startOffset === -1) return 0;
  let streak = 0;
  for (let i = startOffset; ; i++) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString();
    if (dates.has(d)) streak++;
    else break;
  }
  return streak;
}

// ── Likes ──────────────────────────────────────────────────────────────────

async function notifyActivity(actorId: string, targetUserId: string, type: 'like' | 'comment' | 'follow', sightingId?: string): Promise<void> {
  const supabaseUrl = (await import('expo-constants')).default.expoConfig?.extra?.supabaseUrl;
  const supabaseKey = (await import('expo-constants')).default.expoConfig?.extra?.supabasePublishableKey;
  if (!supabaseUrl || !supabaseKey) return;
  fetch(`${supabaseUrl}/functions/v1/notify-activity`, {
    method: 'POST',
    headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: actorId, target_user_id: targetUserId, type, ...(sightingId ? { sighting_id: sightingId } : {}) }),
  }).catch(() => {});
}

export async function likeSighting(sightingId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('likes').insert({ user_id: userId, sighting_id: sightingId });
  const { data } = await supabase.from('sightings').select('user_id').eq('id', sightingId).single();
  if (data?.user_id) notifyActivity(userId, data.user_id, 'like', sightingId);
}

export async function unlikeSighting(sightingId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('likes').delete().eq('user_id', userId).eq('sighting_id', sightingId);
}

export async function getLikedSightingIds(sightingIds: string[]): Promise<Set<string>> {
  const userId = await getCurrentUserId();
  if (!userId || sightingIds.length === 0) return new Set();
  const { data } = await supabase
    .from('likes')
    .select('sighting_id')
    .eq('user_id', userId)
    .in('sighting_id', sightingIds);
  return new Set((data ?? []).map((r: any) => r.sighting_id));
}

// ── Comments ───────────────────────────────────────────────────────────────

export async function getComments(sightingId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('comments')
    .select('id, user_id, text, created_at, parent_id, profiles(username, avatar_url)')
    .eq('sighting_id', sightingId)
    .order('created_at', { ascending: true });

  const rows = (data ?? []).map((row: any): Comment => ({
    id: row.id,
    userId: row.user_id,
    displayName: row.profiles?.username ?? '',
    avatarUrl: row.profiles?.avatar_url ?? undefined,
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
    parentId: row.parent_id ?? undefined,
    replies: [],
  }));

  // Build thread tree — top-level comments with replies nested
  const map = Object.fromEntries(rows.map((c) => [c.id, c]));
  const roots: Comment[] = [];
  for (const c of rows) {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].replies!.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

export async function addComment(sightingId: string, text: string, parentId?: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('comments').insert({
    user_id: userId,
    sighting_id: sightingId,
    text,
    ...(parentId ? { parent_id: parentId } : {}),
  });
  const { data } = await supabase.from('sightings').select('user_id').eq('id', sightingId).single();
  if (data?.user_id) notifyActivity(userId, data.user_id, 'comment', sightingId);
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase.from('comments').delete().eq('id', commentId);
}

export async function deleteSightingById(sightingId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from('sightings').delete().eq('id', sightingId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function updateSightingVisibility(sightingId: string, visibility: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('sightings').update({ visibility }).eq('id', sightingId).eq('user_id', userId);
}

export async function updateSightingCaption(sightingId: string, caption: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('sightings').update({ caption: caption || null }).eq('id', sightingId).eq('user_id', userId);
}

// ── Notifications ──────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  actorId?: string;
  actorName: string;
  actorAvatarUrl?: string;
  type: 'like' | 'comment' | 'follow' | 'new_sighting';
  animalLabel?: string;
  sightingId?: string;
  sightingPhotoUrl?: string;
  read: boolean;
  createdAt: number;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('notifications')
    .select('id, type, actor_id, sighting_id, read, created_at, actor:profiles!actor_id(username, avatar_url), sighting:sightings!sighting_id(photo_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor?.username ?? '',
    actorAvatarUrl: row.actor?.avatar_url ?? undefined,
    type: row.type,
    sightingId: row.sighting_id ?? undefined,
    sightingPhotoUrl: row.sighting?.photo_url ?? undefined,
    read: row.read,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count ?? 0;
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

// ── Default Visibility ─────────────────────────────────────────────────────

export async function getDefaultVisibility(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) return 'public';
  const { data } = await supabase.from('profiles').select('default_visibility').eq('id', userId).single();
  return data?.default_visibility ?? 'public';
}

export async function updateDefaultVisibility(visibility: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('profiles').upsert({ id: userId, default_visibility: visibility });
}
